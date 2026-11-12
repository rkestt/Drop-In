"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  applyOutboxResult,
  classifyOutboxError,
  dueOutbox,
  pruneOutbox,
  type OutboxItem,
  type OutboxOutcome,
} from "@/lib/offline/outbox";
import {
  getOutboxServerSnapshot,
  getOutboxSnapshot,
  hydrateOutbox,
  subscribeOutbox,
  updateQueue,
} from "@/lib/offline/outbox-store";
import { OutboxBanner } from "@/components/offline/outbox-banner";

/**
 * Runner dell'outbox offline (issue #24): riproduce in ordine gli item dovuti
 * con il Supabase browser client e mostra lo stato via `OutboxBanner`.
 *
 * - Trigger: al mount, a ogni evento `online` e ogni 30 s finché c'è coda
 *   (ogni tick invia solo gli item dovuti — `nextAttemptAt <= now`).
 * - Mai un tentativo con `navigator.onLine === false`; mai due flush
 *   concorrenti (ref guard); invii sequenziali (niente duplicati da race).
 * - Un solo toast riepilogativo per flush e per esito, mai uno per item.
 * - Dopo un flush che ha scritto almeno una riga (`ok`) o ne ha trovata una
 *   già sul server (`duplicate`), `router.refresh()` così la UI riflette il DB.
 */
export function OutboxRunner() {
  const queue = useSyncExternalStore(
    subscribeOutbox,
    getOutboxSnapshot,
    getOutboxServerSnapshot,
  );
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [sending, setSending] = useState(false);
  // Primo render online come il server, valore reale nell'effect (stesso
  // pattern di `notification-list.tsx`, niente hydration mismatch).
  const [online, setOnline] = useState(true);
  const flushingRef = useRef(false);

  const executeItem = useCallback(
    async (item: OutboxItem): Promise<{ outcome: OutboxOutcome; errorMessage: string | null }> => {
      try {
        if (item.kind === "check_in") {
          const p = item.payload;
          const { error } = await supabase.from("check_ins").insert({
            user_id: String(p.user_id ?? ""),
            court_id: String(p.court_id ?? ""),
            lat: Number(p.lat),
            lng: Number(p.lng),
            accuracy: Number(p.accuracy),
            status: "active",
          });
          if (!error) return { outcome: "ok", errorMessage: null };
          const msg = error.code ? `${error.code} ${error.message}` : error.message;
          return { outcome: classifyOutboxError(msg), errorMessage: msg };
        }
        if (item.kind === "lobby_join") {
          const p = item.payload;
          const { error } = await supabase.from("lobby_participants").insert({
            lobby_id: String(p.lobby_id ?? ""),
            user_id: String(p.user_id ?? ""),
          });
          if (!error) return { outcome: "ok", errorMessage: null };
          const msg = error.code ? `${error.code} ${error.message}` : error.message;
          return { outcome: classifyOutboxError(msg), errorMessage: msg };
        }
        const p = item.payload;
        const { data, error } = await supabase
          .from("lobby_participants")
          .delete()
          .eq("lobby_id", String(p.lobby_id ?? ""))
          .eq("user_id", String(p.user_id ?? ""))
          .select("lobby_id");
        if (!error) {
          // 0 righe cancellate = la riga non c'era gia' piu': niente da
          // inviare, ma nemmeno un errore (l'effetto voluto c'e').
          if (!data || data.length === 0)
            return { outcome: "duplicate", errorMessage: null };
          return { outcome: "ok", errorMessage: null };
        }
        const msg = error.code ? `${error.code} ${error.message}` : error.message;
        return { outcome: classifyOutboxError(msg), errorMessage: msg };
      } catch (err) {
        // Rete giù a metà flush: fetch rifiutata, niente risposta PostgREST.
        const msg = err instanceof Error ? err.message : String(err);
        return { outcome: classifyOutboxError(msg), errorMessage: msg };
      }
    },
    [supabase],
  );

  const flush = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!navigator.onLine) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      const now = Date.now();
      const current = getOutboxSnapshot();
      const kept = pruneOutbox(current, now);
      const keptSet = new Set(kept);
      const prunedIds = new Set(
        current.filter((i) => !keptSet.has(i)).map((i) => i.id),
      );
      const pruned = prunedIds.size;
      if (pruned > 0)
        updateQueue((q) => q.filter((i) => !prunedIds.has(i.id)));
      const due = dueOutbox(kept, now);
      if (due.length === 0) {
        if (pruned > 0) {
          toast(
            pruned === 1
              ? "Operazione annullata: non è più valida"
              : `${pruned} operazioni annullate: non sono più valide`,
          );
        }
        return;
      }
      setSending(true);
      let ok = 0;
      let dup = 0;
      let trans = 0;
      let perm = pruned;
      for (const item of due) {
        const res = await executeItem(item);
        updateQueue((q) =>
          applyOutboxResult(q, item.id, res.outcome, Date.now(), res.errorMessage).queue,
        );
        if (res.outcome === "ok") ok += 1;
        else if (res.outcome === "duplicate") dup += 1;
        else if (res.outcome === "permanent") perm += 1;
        else trans += 1;
      }
      if (ok > 0) {
        toast.success(
          ok === 1 ? "1 operazione inviata" : `${ok} operazioni inviate`,
        );
      }
      if (dup > 0) toast("Operazione già registrata");
      if (trans > 0) {
        toast.error(
          trans === 1
            ? "1 operazione non riuscita: la riproveremo"
            : `${trans} operazioni non riuscite: le riproveremo`,
        );
      }
      if (perm > 0) {
        toast(
          perm === 1
            ? "Operazione annullata: non è più valida"
            : `${perm} operazioni annullate: non sono più valide`,
        );
      }
      if (ok + dup > 0) router.refresh();
    } finally {
      setSending(false);
      flushingRef.current = false;
    }
  }, [executeItem, router]);

  useEffect(() => {
    hydrateOutbox();
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flush();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    void flush();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [flush]);

  const hasPending = queue.length > 0;
  useEffect(() => {
    if (!hasPending) return;
    const t = window.setInterval(() => {
      void flush();
    }, 30_000);
    return () => window.clearInterval(t);
  }, [hasPending, flush]);

  return (
    <OutboxBanner
      pending={queue.length}
      sending={sending}
      online={online}
      onRetry={() => void flush()}
    />
  );
}
