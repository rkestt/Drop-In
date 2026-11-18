import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createUserClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/url";
import type { Database, Json } from "@/lib/supabase/database.types";
import {
  findBlockingLobbies,
  isAlreadyDeletedError,
} from "@/lib/account/delete";
import { logEvent } from "@/lib/observability/structured";

// POST /api/account/delete (#94, Lane B): hard delete dell'account
// nell'ordine della decisione — pre-check 409, scrub notifiche altrui,
// storage, rate_limit_events, poi `auth.admin.deleteUser` (cascata).
// Il service-role e' istanziato solo qui, mai in lib ne' sul client.
// L'utente e' identificato dai cookie via `supabase.auth.getUser()`.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const AVATAR_BUCKET = "avatars";

function fail(step: string, detail: unknown) {
  logEvent({
    level: "error",
    event: "account.delete_failed",
    fields: { step, detail },
  });
  return NextResponse.json(
    { error: "Cancellazione non riuscita" },
    { status: 500 }
  );
}

export async function POST() {
  const supabase = await createUserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }
  const uid = user.id;

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return fail("config", "service role non configurato");
  }
  const admin = createClient<Database>(supabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Pre-check: lobby `open` non finite create da me con altri iscritti
  // bloccano con 409 (`ends_at > now`: anche iniziate ma in corso).
  // Solo quelle: finite e future senza altri iscritti passano
  // (cascata o creator NULL della 041).
  const { data: owned, error: ownedError } = await supabase
    .from("lobbies")
    .select("id, start_time, ends_at, status")
    .eq("creator_id", uid)
    .eq("status", "open");
  if (ownedError || !owned) {
    return fail("precheck_lobbies", ownedError?.message);
  }
  if (owned.length > 0) {
    const { data: joined, error: joinedError } = await supabase
      .from("lobby_participants")
      .select("lobby_id, user_id")
      .in(
        "lobby_id",
        owned.map((l) => l.id)
      );
    if (joinedError || !joined) {
      return fail("precheck_partecipanti", joinedError?.message);
    }
    const blocking = findBlockingLobbies(owned, joined, uid);
    if (blocking.length > 0) {
      return NextResponse.json(
        {
          error:
            "Non puoi eliminare l'account: hai lobby future con altri iscritti. Cancellale o attendi che finiscano, poi riprova.",
        },
        { status: 409 }
      );
    }
  }

  // 2. Scrub: sulle notifiche altrui si toglie la chiave `user_id` dove
  // vale me — uno UUID in un JSON di qualcun altro e' dato personale.
  const { data: dirty, error: scrubSelectError } = await admin
    .from("push_notifications")
    .select("id, data")
    .neq("user_id", uid)
    .filter("data->>user_id", "eq", uid);
  if (scrubSelectError || !dirty) {
    return fail("scrub_select", scrubSelectError?.message);
  }
  for (const row of dirty) {
    if (!row.data || typeof row.data !== "object" || Array.isArray(row.data)) {
      continue;
    }
    const { user_id: _removed, ...rest } = row.data as Record<string, Json>;
    void _removed;
    const { error: scrubUpdateError } = await admin
      .from("push_notifications")
      .update({ data: rest })
      .eq("id", row.id);
    if (scrubUpdateError) {
      return fail("scrub_update", scrubUpdateError.message);
    }
  }

  // 3. Storage prima del database: dopo `deleteUser` la cascata cancella le
  // righe utente e i file rimasti non sarebbero piu' mappabili all'account
  // (orfani irrecuperabili). Se un passo dopo la rimozione fallisce,
  // l'account resta funzionante ma senza avatar (re-caricabile): l'ordine
  // inverso lascerebbe file orfani di un utente cancellato, che e' peggio.
  // Il punto di non ritorno resta `deleteUser`.
  const { data: files, error: listError } = await admin.storage
    .from(AVATAR_BUCKET)
    .list(uid);
  if (listError) {
    return fail("avatar_list", listError.message);
  }
  if (files && files.length > 0) {
    const { error: removeError } = await admin.storage
      .from(AVATAR_BUCKET)
      .remove(files.map((f) => `${uid}/${f.name}`));
    if (removeError) {
      return fail("avatar_remove", removeError.message);
    }
    const { data: leftover, error: verifyError } = await admin.storage
      .from(AVATAR_BUCKET)
      .list(uid);
    if (verifyError || (leftover && leftover.length > 0)) {
      return fail("avatar_verify", verifyError?.message ?? "file rimasti");
    }
  }

  // 4. `rate_limit_events.subject` non ha FK: senza questo delete esplicito
  // resterebbero righe orfane (la cascata non le vede).
  const { error: rateLimitError } = await admin
    .from("rate_limit_events")
    .delete()
    .eq("subject", uid);
  if (rateLimitError) {
    return fail("rate_limit", rateLimitError.message);
  }

  // 5. Punto di non ritorno: cascata + revoca sessioni. Nessuna cascata
  // manuale oltre a questa (profili, partecipazioni, check-in, report,
  // review, preferiti, notifiche proprie, submission, subscription: tutto
  // ON DELETE CASCADE; lobby e corti: SET NULL voluto).
  const { error: deleteError } = await admin.auth.admin.deleteUser(uid);
  if (deleteError) {
    // Replay di una cancellazione gia' avvenuta (doppio invio): successo,
    // non 500. Senza tabella di stato, a questa scala.
    if (isAlreadyDeletedError(deleteError)) {
      return NextResponse.json({ ok: true, replay: true });
    }
    return fail("delete_user", deleteError.message);
  }

  // 6. Verifica: l'utente non deve piu' esistere.
  const { data: stillThere, error: verifyUserError } =
    await admin.auth.admin.getUserById(uid);
  if (verifyUserError && !isAlreadyDeletedError(verifyUserError)) {
    return fail("verify_user", verifyUserError.message);
  }
  if (stillThere?.user) {
    return fail("verify_user", "utente ancora presente");
  }

  return NextResponse.json({ ok: true });
}
