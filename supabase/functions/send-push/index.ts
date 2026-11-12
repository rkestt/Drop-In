// Edge Function `send-push`: recapita le righe di `push_notifications`
// come Web Push agli endpoint in `push_subscriptions`.
// Chiamata da pg_cron/pg_net ogni minuto (vedi docs/push.md) con
// `Authorization: Bearer <PUSH_SECRET>`; body opzionale
// `{ "notification_id": "<uuid>" }` per recapitare una sola riga,
// altrimenti sweep delle righe non recapitate (max 50, le piu' vecchie).
// Il payload NON contiene l'URL: il service worker lo deriva da `data`
// con `notificationHref` (lib/notifications/link), cosi' esiste una sola
// implementazione della regola href.

import { createClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/web-push@3"
import webpush from "web-push";
import {
  attemptPatch,
  isDeliverable,
  MAX_PUSH_ATTEMPTS,
  shouldDropSubscription,
  type DeliveryOutcome,
  type PushRow,
} from "./delivery.ts";

const SWEEP_LIMIT = 50;

interface SweepRow extends PushRow {
  user_id: string;
  title: string;
  body: string;
  data: unknown;
}

interface SubscriptionRow {
  id: string;
  subscription: unknown;
}

/** Confronto a tempo quasi costante: basta qui, il segreto viaggia su TLS. */
function secretsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function env(name: string): string | null {
  const value = Deno.env.get(name);
  return value === undefined || value === "" ? null : value;
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

Deno.serve(async (req: Request): Promise<Response> => {
  const secret = env("PUSH_SECRET");
  if (!secret) {
    console.error("send-push: PUSH_SECRET non configurato.");
    return json(500, { ok: false, error: "Funzione non configurata." });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!secretsEqual(auth, `Bearer ${secret}`)) {
    return json(401, { ok: false, error: "Non autorizzato." });
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = env("VAPID_PUBLIC_KEY");
  const vapidPrivate = env("VAPID_PRIVATE_KEY");
  const vapidSubject = env("VAPID_SUBJECT") ?? "mailto:admin@example.com";
  if (!supabaseUrl || !serviceKey || !vapidPublic || !vapidPrivate) {
    console.error("send-push: env VAPID/Supabase incomplete.");
    return json(500, { ok: false, error: "Funzione non configurata." });
  }

  let notificationId: string | null = null;
  if (req.method === "POST") {
    try {
      const text = await req.text();
      if (text.trim() !== "") {
        const parsed: unknown = JSON.parse(text);
        if (
          typeof parsed === "object" && parsed !== null &&
          typeof (parsed as Record<string, unknown>).notification_id ===
            "string"
        ) {
          notificationId =
            (parsed as Record<string, string>).notification_id;
        }
      }
    } catch {
      return json(400, { ok: false, error: "Body non valido." });
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let rows: SweepRow[] | null = null;
  if (notificationId) {
    const { data, error } = await supabase
      .from("push_notifications")
      .select("id,user_id,title,body,data,push_sent_at,push_attempts,push_failed_at")
      .eq("id", notificationId)
      .limit(1);
    if (error) {
      console.error("send-push: lettura riga fallita:", error.message);
      return json(500, { ok: false, error: "Lettura fallita." });
    }
    if (!data || data.length === 0) {
      return json(404, { ok: false, error: "Notifica non trovata." });
    }
    rows = data as SweepRow[];
  } else {
    const { data, error } = await supabase
      .from("push_notifications")
      .select("id,user_id,title,body,data,push_sent_at,push_attempts,push_failed_at")
      .is("push_sent_at", null)
      .is("push_failed_at", null)
      .lt("push_attempts", MAX_PUSH_ATTEMPTS)
      .order("sent_at", { ascending: true })
      .limit(SWEEP_LIMIT);
    if (error) {
      console.error("send-push: sweep fallito:", error.message);
      return json(500, { ok: false, error: "Lettura fallita." });
    }
    rows = (data ?? []) as SweepRow[];
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let delivered = 0;
  let failed = 0;
  let skipped = 0;
  let noSubscription = 0;
  const now = new Date();

  for (const row of rows) {
    try {
      if (!isDeliverable(row)) {
        skipped += 1;
        continue;
      }

      const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id,subscription")
        .eq("user_id", row.user_id);
      if (subsError) {
        throw new Error(`subscription di ${row.id}: ${subsError.message}`);
      }
      const subscriptions = (subs ?? []) as SubscriptionRow[];

      let outcome: DeliveryOutcome;
      if (subscriptions.length === 0) {
        // Nessun endpoint: niente da recapitare, la riga resta comunque
        // leggibile nel centro notifiche in-app.
        outcome = { kind: "no_subscription" };
      } else {
        let okCount = 0;
        let failCount = 0;
        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              // Il JSON mai serializzato dal browser e' gia' nel formato
              // atteso da web-push (endpoint + keys).
              sub.subscription as Parameters<
                typeof webpush.sendNotification
              >[0],
              JSON.stringify({
                title: row.title,
                body: row.body,
                data: row.data ?? {},
                notificationId: row.id,
              }),
            );
            okCount += 1;
          } catch (err) {
            const raw = (err as { statusCode?: unknown }).statusCode;
            const status = typeof raw === "number" ? raw : null;
            if (shouldDropSubscription(status)) {
              const { error: delError } = await supabase
                .from("push_subscriptions")
                .delete()
                .eq("id", sub.id);
              if (delError) {
                console.error(
                  `send-push: rimozione subscription ${sub.id} fallita:`,
                  delError.message,
                );
              }
            } else {
              failCount += 1;
            }
          }
        }
        outcome = okCount > 0
          ? { kind: "delivered" }
          : failCount > 0
          ? { kind: "failed" }
          // Tutte le subscription erano scadute e sono state rimosse:
          // come non averne.
          : { kind: "no_subscription" };
      }

      const patch = attemptPatch(outcome, row, now);
      const { error: patchError } = await supabase
        .from("push_notifications")
        .update(patch)
        .eq("id", row.id);
      if (patchError) {
        throw new Error(`patch di ${row.id}: ${patchError.message}`);
      }

      if (outcome.kind === "delivered") {
        delivered += 1;
      } else if (outcome.kind === "no_subscription") {
        noSubscription += 1;
      } else {
        failed += 1;
      }
    } catch (err) {
      // Una riga guasta non ferma mai lo sweep.
      console.error(
        `send-push: riga ${row.id} saltata:`,
        err instanceof Error ? err.message : err,
      );
      failed += 1;
    }
  }

  return json(200, { ok: true, delivered, noSubscription, failed, skipped });
});
