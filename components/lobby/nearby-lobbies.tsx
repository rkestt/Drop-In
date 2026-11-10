"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LobbyCard } from "./lobby-card";
import { CreateLobbyButton } from "./create-lobby-button";
import { MapPin } from "lucide-react";
import type { LobbySummary } from "./types";

/**
 * Raggio "Partite vicine" (bug #48): solo lobby entro questa distanza,
 * mai tutta Italia. Stesso default del RPC `nearby_courts`.
 */
export const NEARBY_RADIUS_M = 15000;

/** Max candidate aperte: le lobby sono effimere (auto-chiusura via cron). */
const OPEN_LOBBIES_LIMIT = 100;

/** Haversine in metri (nessuna dipendenza). */
function distanceM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

type NearbyState =
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      lobbies: LobbySummary[];
      nearestCourt: { id: string; name: string } | null;
    };

/**
 * Tab "Vicine": chiede la posizione, carica le lobby aperte con le
 * coordinate del campo e tiene solo quelle entro il raggio (bug #48),
 * ordinate per distanza reale. Senza posizione: messaggio + CTA "Trova un
 * campo", mai dati inventati. Senza lobby ma con campi vicini: CTA "Crea
 * una lobby" sul campo più vicino.
 */
export function NearbyLobbies({
  userId,
  onCount,
}: {
  userId: string;
  onCount: (n: number) => void;
}) {
  const [state, setState] = useState<NearbyState>({ kind: "locating" });
  const supabase = createClient();
  const router = useRouter();

  const load = useCallback(
    (lat: number, lng: number) => {
      let cancelled = false;
      (async () => {
        setState({ kind: "loading" });
        try {
          const { data: lobbiesData, error: lobbiesError } = await supabase
            .from("lobbies")
            .select(
              "id, court_id, start_time, max_players, status, courts(id, name, lat, lng), lobby_participants(user_id)"
            )
            .eq("status", "open")
            .order("start_time", { ascending: true })
            .limit(OPEN_LOBBIES_LIMIT);
          if (lobbiesError) throw lobbiesError;
          const rows = (lobbiesData ?? []) as Array<{
            id: string;
            court_id: string;
            start_time: string;
            max_players: number;
            status: string;
            courts: { id: string; name: string; lat: number; lng: number } | null;
            lobby_participants?: Array<{ user_id: string }>;
          }>;

          const allUserIds = [
            ...new Set(
              rows.flatMap((l) => (l.lobby_participants ?? []).map((p) => p.user_id))
            ),
          ];
          const nicknameMap = new Map<string, string | null>();
          if (allUserIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, nickname")
              .in("user_id", allUserIds);
            (profiles ?? []).forEach(
              (p: { user_id: string; nickname: string | null }) =>
                nicknameMap.set(p.user_id, p.nickname)
            );
          }

          const lobbies: LobbySummary[] = [];
          for (const l of rows) {
            if (!l.courts) continue;
            const d = distanceM(lat, lng, l.courts.lat, l.courts.lng);
            if (d > NEARBY_RADIUS_M) continue;
            const participants = (l.lobby_participants ?? []).map((p) => ({
              user_id: p.user_id,
              nickname: nicknameMap.get(p.user_id) ?? null,
            }));
            lobbies.push({
              id: l.id,
              court_id: l.court_id,
              start_time: l.start_time,
              max_players: l.max_players,
              status: l.status,
              court_name: l.courts.name ?? "Campo",
              participants_count: participants.length,
              participants,
              is_joined: participants.some((p) => p.user_id === userId),
              distance_m: d,
            });
          }
          lobbies.sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity));

          // Corte più vicina per la CTA "Crea una lobby" quando non c'è nulla.
          let nearestCourt: { id: string; name: string } | null =
            lobbies.length > 0
              ? { id: lobbies[0].court_id, name: lobbies[0].court_name }
              : null;
          if (!nearestCourt) {
            const { data: courts } = await supabase.rpc("nearby_courts", {
              p_lat: lat,
              p_lng: lng,
              p_radius_m: NEARBY_RADIUS_M,
              p_limit: 1,
            });
            const first = (courts as Array<{ id: string; name: string }> | null)?.[0];
            if (first) nearestCourt = { id: first.id, name: first.name };
          }

          if (!cancelled) {
            setState({ kind: "ready", lobbies, nearestCourt });
            onCount(lobbies.length);
          }
        } catch {
          if (!cancelled) setState({ kind: "error" });
        }
      })();
      return () => {
        cancelled = true;
      };
    },
    [supabase, userId, onCount]
  );

  useEffect(() => {
    let cancelled = false;
    if (!("geolocation" in navigator)) {
      setState({ kind: "denied" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!cancelled) load(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        if (!cancelled) setState({ kind: "denied" });
      },
      { timeout: 8000, maximumAge: 300000 }
    );
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Realtime: join/leave si riflettono senza reload (acceptance d20).
  useEffect(() => {
    const channel = supabase
      .channel("lobbies-nearby")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () =>
        router.refresh()
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_participants" }, () =>
        router.refresh()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, router]);

  if (state.kind === "locating" || state.kind === "loading") {
    return (
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Ricerca lobby vicine…
        </p>
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-card bg-[var(--bg-surface)]" />
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <div className="py-8 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Attiva la posizione per vedere le partite vicine
        </h2>
        <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
          Senza posizione non sappiamo cosa è vicino a te.
        </p>
        <Link
          href="/"
          className="mx-auto mt-3 flex min-h-11 w-full max-w-60 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)]"
        >
          Trova un campo
        </Link>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="py-8 text-center" role="alert">
        <p className="font-medium text-[var(--text-primary)]">
          Non riusciamo a caricare le lobby vicine.
        </p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="mx-auto mt-3 flex min-h-11 items-center justify-center rounded-control bg-[var(--bg-surface)] px-4 font-semibold text-[var(--text-primary)]"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (state.lobbies.length === 0) {
    return (
      <div className="py-8 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Nessuna lobby qui intorno
        </h2>
        <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
          Sii il primo.
        </p>
        <div className="mx-auto mt-3 w-full max-w-60 [&_button]:min-h-11 [&_button]:w-full">
          {state.nearestCourt ? (
            <CreateLobbyButton
              courtId={state.nearestCourt.id}
              courtName={state.nearestCourt.name}
            />
          ) : (
            <Link
              href="/"
              className="flex min-h-11 items-center justify-center rounded-control bg-[var(--accent)] px-4 font-semibold text-[var(--accent-foreground)]"
            >
              Trova un campo
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {state.lobbies.map((lobby) => (
        <li key={lobby.id}>
          <LobbyCard lobby={lobby} />
        </li>
      ))}
    </ul>
  );
}
