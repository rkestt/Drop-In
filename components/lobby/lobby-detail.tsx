"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { enqueue } from "@/lib/offline/outbox-store";
import {
  formatAppCloseTime,
  formatAppDate,
  formatAppDay,
  formatAppTime,
} from "@/lib/datetime";
import { mapJoinError, mapLeaveError } from "@/lib/lobbies/join-errors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JoinLobbyDrawer } from "./join-lobby-drawer";
import { CreateLobbyButton } from "./create-lobby-button";
import type { LobbyParticipant } from "./types";

export interface LobbyDetailData {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
}

export interface LobbyCourtData {
  id: string;
  name: string;
  address: string | null;
  sport: string | null;
}

function initials(nickname: string | null): string {
  if (!nickname) return "?";
  const parts = nickname.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Dettaglio lobby (prototipo d12, stati aperta/piena/in corso/chiusa +
 * join ottimistico + posti esauriti): una sola CTA primaria per stato,
 * orari it-IT, posti `n/m`. Join ed esci aggiornano via realtime +
 * `router.refresh()`, mai reload.
 */
export function LobbyDetail({
  lobby,
  court,
  participants,
  userId,
  joinedInitial,
  userKarma,
  bannedUntil,
  courtApproved,
}: {
  lobby: LobbyDetailData;
  court: LobbyCourtData;
  participants: LobbyParticipant[];
  userId: string;
  joinedInitial: boolean;
  userKarma: number | null;
  bannedUntil: string | null;
  /** #76: false = campo non approvato (o illeggibile): join chiuso. */
  courtApproved: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [joined, setJoined] = useState(joinedInitial);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [joinCanRetry, setJoinCanRetry] = useState(true);
  // Mount-guard del ban (#78): `new Date(bannedUntil) > new Date()` dipende
  // dall'istante di render, quindi server e client potrebbero divergere
  // (mismatch di idratazione). Spento fino al mount: il primo render client
  // coincide sempre con il server, come in `install-prompt.tsx`.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Il server resta la verità: allinea l'ottimistico quando le props
  // rientrano dal refresh (es. join da un altro browser). Durante il volo
  // dell'insert le props non cambiano, quindi l'ottimistico non viene
  // mai clobberato a metà.
  useEffect(() => {
    setJoined(joinedInitial);
  }, [joinedInitial]);

  const count = participants.length + (joined && !joinedInitial ? 1 : 0);
  const isFull = count >= lobby.max_players;
  const banned =
    mounted && bannedUntil != null && new Date(bannedUntil) > new Date();
  const lowKarma = (userKarma ?? 90) < 50;

  // Realtime: join/leave dall'altro browser si riflettono entro secondi.
  useEffect(() => {
    const channel = supabase
      .channel(`lobby-detail-${lobby.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies", filter: `id=eq.${lobby.id}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobby_participants", filter: `lobby_id=eq.${lobby.id}` },
        () => router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router, lobby.id]);

  const confirmJoin = async () => {
    // #76: campo non approvato: il drawer non si apre mai (niente CTA),
    // ma se confirmJoin parte comunque (stale) non inserire nulla.
    if (!courtApproved) {
      setJoinOpen(false);
      setJoinError("Lobby non disponibile: il campo è in attesa di approvazione.");
      setJoinCanRetry(false);
      return;
    }
    // Lobby non più aperta (stale dopo refresh realtime, #77): niente
    // insert, niente coda — il join non potrà mai passare.
    if (lobby.status !== "open") {
      const mapped = mapJoinError({ status: lobby.status });
      setJoinOpen(false);
      setJoined(false);
      setJoinError(mapped.message);
      setJoinCanRetry(mapped.canRetry);
      return;
    }
    if (isFull) {
      const mapped = mapJoinError({ message: "posti esauriti" });
      setJoinOpen(false);
      setJoinError(mapped.message);
      setJoinCanRetry(mapped.canRetry);
      return;
    }
    // Offline: ottimistico + coda, il runner invia al reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setJoined(true);
      setJoinOpen(false);
      setJoinError(null);
      enqueue("lobby_join", { lobby_id: lobby.id, user_id: userId });
      toast("Richiesta in coda: ti uniamo appena torni online.");
      return;
    }
    setJoining(true);
    // Ottimistico: "Sei dentro" subito, rollback se il server rifiuta.
    setJoined(true);
    setJoinOpen(false);
    setJoinError(null);
    try {
      const { error } = await supabase.from("lobby_participants").insert({
        lobby_id: lobby.id,
        user_id: userId,
      });
      if (error) throw error;
      toast.success("Sei dentro", {
        description: `Ci vediamo alle ${formatAppTime(lobby.start_time)} al ${court.name}.`,
      });
      router.refresh();
    } catch (err) {
      // Mai raw Postgres/PostgREST in UI (#77): la mappa traduce il
      // trigger "lobby chiusa", il pieno, il duplicato e la rete caduta.
      const msg = err instanceof Error ? err.message : "";
      const code =
        err instanceof Error
          ? (err as { code?: unknown }).code
          : null;
      const mapped = mapJoinError({
        status: lobby.status,
        code: typeof code === "string" ? code : null,
        message: msg,
      });
      if (mapped.kind === "transient") {
        // Rete caduta: resta l'ottimistico, il runner invia al reconnect.
        enqueue("lobby_join", { lobby_id: lobby.id, user_id: userId });
        toast("Richiesta in coda: ti uniamo appena torni online.");
      } else {
        // Chiusa/piena/duplicato/permanent: esce dall'ottimistico
        // ("sei dentro" bloccato, mai) con testo italiano e retry solo
        // quando riprovare ha senso.
        setJoined(false);
        setJoinError(mapped.message);
        setJoinCanRetry(mapped.canRetry);
      }
    } finally {
      setJoining(false);
    }
  };

  const leave = async () => {
    // Conferma solo se la lobby è in corso, altrimenti esecuzione diretta.
    if (lobby.status === "in_progress" && !leaveArmed) {
      setLeaveArmed(true);
      return;
    }
    // Offline: ottimistico + coda, il runner invia al reconnect.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      enqueue("lobby_leave", { lobby_id: lobby.id, user_id: userId });
      setJoined(false);
      setLeaveArmed(false);
      toast("Uscita in coda.");
      return;
    }
    setLeaving(true);
    setLeaveError(null);
    try {
      const { error } = await supabase
        .from("lobby_participants")
        .delete()
        .eq("lobby_id", lobby.id)
        .eq("user_id", userId);
      if (error) throw error;
      setJoined(false);
      setLeaveArmed(false);
      toast.success("Sei uscito dalla lobby");
      router.refresh();
    } catch (err) {
      // Mai raw DB in UI (#77): rete → coda, resto → messaggio italiano.
      const msg = err instanceof Error ? err.message : "";
      const code =
        err instanceof Error
          ? (err as { code?: unknown }).code
          : null;
      const mapped = mapLeaveError({
        status: lobby.status,
        code: typeof code === "string" ? code : null,
        message: msg,
      });
      if (mapped.kind === "transient") {
        // Rete caduta: resta l'ottimistico, il runner invia al reconnect.
        enqueue("lobby_leave", { lobby_id: lobby.id, user_id: userId });
        setJoined(false);
        setLeaveArmed(false);
        toast("Uscita in coda.");
      } else {
        setLeaveError(mapped.message);
      }
    } finally {
      setLeaving(false);
    }
  };

  const statusLabel =
    lobby.status === "open"
      ? isFull
        ? "Al completo"
        : joined
          ? "Sei dentro"
          : "Aperta"
      : lobby.status === "in_progress"
        ? "In corso"
        : "Chiusa";
  const statusVariant =
    lobby.status === "open" && !isFull
      ? "accent"
      : lobby.status === "in_progress"
        ? "warning"
        : "default";

  const names = participants
    .map((p) => (p.user_id === userId ? null : (p.nickname ?? "Anonimo")))
    .filter((n): n is string => n !== null);
  // Solo tu dentro: gli avatar + conteggio bastano, niente riga nomi.
  const namesLine =
    names.length === 0 ? "" : names.slice(0, 4).join(", ") + (joined ? " + tu" : "");

  const showJoinCta =
    courtApproved &&
    !joined &&
    lobby.status === "open" &&
    !isFull &&
    !banned &&
    !lowKarma;
  // #76: mai "Crea lobby" su campo non approvato (vale anche a pieno).
  const showCreateCta =
    courtApproved && !joined && lobby.status === "open" && isFull;
  const showLeaveCta = joined && lobby.status !== "closed";

  return (
    <div className="space-y-4">
      {joined && lobby.status === "open" && (
        <div
          className="rounded-card border border-[var(--success)]/30 bg-[var(--success)]/10 p-3 text-sm text-[var(--text-primary)]"
          role="status"
        >
          Sei dentro. Ci vediamo alle {formatAppTime(lobby.start_time)} al {court.name}.
        </div>
      )}

      {joinError && (
        <div
          className="rounded-card border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm"
          role="alert"
        >
          <p className="font-semibold text-[var(--text-primary)]">{joinError}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {joinCanRetry && courtApproved && (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setJoinError(null);
                  setJoinOpen(true);
                }}
              >
                Riprova
              </Button>
            )}
            {courtApproved && (
              <CreateLobbyButton courtId={court.id} courtName={court.name} />
            )}
          </div>
        </div>
      )}

      {/* #76: campo non approvato → join chiuso, uscita sempre possibile. */}
      {!courtApproved && (
        <div
          className="rounded-card border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm text-[var(--text-primary)]"
          role="status"
        >
          Lobby non disponibile: il campo è in attesa di approvazione.
        </div>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
          {formatAppDay(lobby.start_time)}
        </p>
        <h1 className="mt-1 text-2xl font-bold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
          {court.name}
        </h1>
        <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
          {[court.sport, court.address].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div>
          <p className="font-[family-name:var(--font-syne)] text-3xl font-bold tabular-nums text-[var(--text-primary)]">
            {formatAppTime(lobby.start_time)}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {lobby.status === "closed"
              ? `Chiusa alle ${formatAppCloseTime(lobby.start_time)}`
              : `Si chiude alle ${formatAppCloseTime(lobby.start_time)}`}
          </p>
        </div>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Badge variant={statusVariant as any}>{statusLabel}</Badge>
      </div>

      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <div className="flex items-center gap-2">
          <div className="flex" aria-hidden="true">
            {participants.slice(0, 5).map((p) => (
              <span
                key={p.user_id}
                className={`-ms-2 inline-flex h-9 w-9 items-center justify-center rounded-full border bg-[var(--bg-elevated)] text-xs font-semibold first:ms-0 ${
                  p.user_id === userId
                    ? "border-[var(--accent)] text-[var(--text-primary)]"
                    : "border-[var(--border-strong)] text-[var(--text-secondary)]"
                }`}
              >
                {p.user_id === userId ? "TU" : initials(p.nickname)}
              </span>
            ))}
            {joined && !joinedInitial && (
              <span className="-ms-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--accent)] bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)]">
                TU
              </span>
            )}
          </div>
          <p className="font-[family-name:var(--font-syne)] text-xl font-bold tabular-nums text-[var(--text-primary)]">
            {count}/{lobby.max_players}
          </p>
          <p className="text-sm text-[var(--text-muted)]">giocatori</p>
        </div>
        {namesLine && (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{namesLine}</p>
        )}
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {isFull
            ? "Nessun posto libero"
            : `${lobby.max_players - count} ${lobby.max_players - count === 1 ? "posto libero" : "posti liberi"}`}
        </p>
      </div>

      {courtApproved && lobby.status === "open" && isFull && !joined && (
        <div
          className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3 text-sm text-[var(--text-primary)]"
          role="status"
        >
          Al completo: {count}/{lobby.max_players}. Crea la tua lobby.
        </div>
      )}

      {(lobby.status === "in_progress" || lobby.status === "closed") && (
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {lobby.status === "in_progress"
              ? `In corso dalle ${formatAppTime(lobby.start_time)}`
              : "Chiusa."}
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {lobby.status === "in_progress"
              ? `Le iscrizioni sono chiuse. La lobby si chiude alle ${formatAppCloseTime(lobby.start_time)}.`
              : `La lobby si è chiusa alle ${formatAppCloseTime(lobby.start_time)}. I check-in sono chiusi.`}
          </p>
        </div>
      )}

      {lobby.status === "open" && !isFull && (banned || lowKarma) && !joined && (
        <div
          className="rounded-card border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm"
          role="status"
        >
          {banned ? (
            <p className="text-[var(--text-primary)]">
              Sei sospeso fino a {formatAppDate(bannedUntil as string)}: non
              puoi unirti alle lobby.
            </p>
          ) : (
            <p className="text-[var(--text-primary)]">
              Karma {userKarma}, sotto la soglia di 50: non puoi unirti alle
              lobby. Torna sopra 50 con un check-in rispettato.
            </p>
          )}
        </div>
      )}

      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="border-b border-[var(--border)] p-3">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Il tuo karma
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
            {userKarma ?? "—"}
            <span className="font-normal text-[var(--text-secondary)]">
              {" "}
              · se non ti presenti perdi 3 punti
            </span>
          </p>
        </div>
        <div className="p-3">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Iscrizioni
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">
            {lobby.status === "closed"
              ? `Chiuse alle ${formatAppCloseTime(lobby.start_time)}`
              : `Chiudono alle ${formatAppCloseTime(lobby.start_time)}`}
          </p>
        </div>
      </div>

      <Link
        href={`/courts/${court.id}`}
        className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--accent)]"
      >
        Apri il campo <span aria-hidden="true">›</span>
      </Link>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        {showJoinCta && (
          <Button
            variant="primary"
            className="min-h-11 w-full"
            onClick={() => setJoinOpen(true)}
          >
            Unisciti
          </Button>
        )}
        {showCreateCta && (
          <div className="[&_button]:min-h-11 [&_button]:w-full">
            <CreateLobbyButton courtId={court.id} courtName={court.name} />
          </div>
        )}
        {showLeaveCta && (
          <>
            {leaveError && (
              <p className="text-sm text-[var(--danger)]" role="alert">
                {leaveError}
              </p>
            )}
            {leaveArmed ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[var(--text-secondary)]">
                  La partita è in corso: vuoi uscire davvero?
                </p>
                <Button
                  variant="primary"
                  className="min-h-11 w-full"
                  onClick={leave}
                  disabled={leaving}
                >
                  {leaving ? "Uscita…" : "Conferma uscita"}
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 w-full"
                  onClick={() => setLeaveArmed(false)}
                  disabled={leaving}
                >
                  Resta dentro
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                className="min-h-11 w-full"
                onClick={leave}
                disabled={leaving}
              >
                {leaving ? "Uscita…" : "Esci dalla lobby"}
              </Button>
            )}
          </>
        )}
      </div>

      {courtApproved && (
        <JoinLobbyDrawer
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          info={{
            courtName: court.name,
            startTime: lobby.start_time,
            freeSpots: lobby.max_players - count,
            maxPlayers: lobby.max_players,
            userKarma,
            bannedUntil,
          }}
          joining={joining}
          onConfirm={confirmJoin}
        />
      )}
    </div>
  );
}
