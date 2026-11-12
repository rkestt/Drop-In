"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LobbyCard } from "./lobby-card";
import { CreateLobbyButton } from "./create-lobby-button";
import {
  courtDistanceM,
  isWithinRadiusM,
  NEARBY_RADIUS_M,
  OPEN_LOBBIES_LIMIT,
} from "@/lib/lobbies/nearby";
import { sportEmptyPhrase, sportMatches } from "@/lib/sport/sports";
import { useSport } from "@/lib/sport/sport-context";
import { MapPin } from "lucide-react";
import type { LobbySummary } from "./types";

type NearbyState =
  | { kind: "locating" }
  | { kind: "denied" }
  | { kind: "loading" }
  | { kind: "error" }
  | {
      kind: "ready";
      lobbies: LobbySummary[];
      nearestCourt: { id: string; name: string } | null;
      /** Vuoto perche': "radius" = niente nel raggio, "sport" = lobby nel
          raggio ma non per questo sport, null = non vuote. */
      emptyCause: "radius" | "sport" | null;
    };

/**
 * Tab "Vicine": chiede la posizione, carica le lobby aperte (campione di
 * `OPEN_LOBBIES_LIMIT`, vedi spec) con le coordinate del campo e tiene solo
 * quelle entro il raggio (bug #48), ordinate per distanza reale, poi filtra
 * per lo sport attivo (`sportMatches`, stesso predicato del RPC
 * `open_lobbies`: "multi" e liste ";" — bug #48 sport gap). Coordinate
 * campo assenti/non numeriche → riga esclusa (`courtDistanceM` = null).
 * Senza posizione: messaggio + CTA "Trova un campo", mai dati inventati.
 * Senza lobby ma con campi vicini: CTA "Crea una lobby" sul campo più
 * vicino (RPC solo per la CTA, vedi spec sui limiti).
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
  const { sport, pSport } = useSport();
  // Ultima posizione nota: gli eventi realtime ricaricano i DATI (load),
  // non le props server (router.refresh qui non servirebbe a nulla).
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  // Sport letto via ref: il cambio sport non deve rifare geolocalizzazione
  // (l'effect locate sotto dipende da `load`, che così resta stabile).
  const pSportRef = useRef(pSport);
  useEffect(() => {
    pSportRef.current = pSport;
  }, [pSport]);

  const load = useCallback(
    (lat: number, lng: number) => {
      let cancelled = false;
      coordsRef.current = { lat, lng };
      (async () => {
        setState({ kind: "loading" });
        try {
          const { data: lobbiesData, error: lobbiesError } = await supabase
            .from("lobbies")
            .select(
              "id, court_id, start_time, max_players, status, courts(id, name, sport, lat, lng, photo_path), lobby_participants(user_id)"
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
            courts: {
              id: string;
              name: string;
              sport: string | null;
              lat: number | null;
              lng: number | null;
              photo_path: string | null;
            } | null;
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
          // Due stadi separati: prima il raggio, poi lo sport. Così a lista
          // vuota si distingue "niente nel raggio" da "niente per lo sport".
          let anyInRadius = false;
          for (const l of rows) {
            if (!l.courts) continue;
            const d = courtDistanceM(lat, lng, l.courts.lat, l.courts.lng);
            // Null = coordinate inutilizzabili: esclusa, mai "distanza
            // sconosciuta" in una tab "Vicine". isWithinRadiusM riusa la
            // stessa matematica (haversine + guardia null); `d` serve solo
            // per mostrarla nella card.
            if (d === null || !isWithinRadiusM(lat, lng, l.courts.lat, l.courts.lng)) continue;
            anyInRadius = true;
            if (!sportMatches(l.courts.sport, pSportRef.current)) continue;
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
              court_sport: l.courts.sport,
              court_photo_path: l.courts.photo_path ?? null,
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
            setState({
              kind: "ready",
              lobbies,
              nearestCourt,
              emptyCause:
                lobbies.length > 0
                  ? null
                  : pSportRef.current !== null && anyInRadius
                    ? "sport"
                    : "radius",
            });
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

  const loadRef = useRef(load);
  loadRef.current = load;

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

  // Cambio sport: ri-filtra con l'ultima posizione nota, senza rifare
  // geolocalizzazione (al mount pSport è invariato: nessuna doppia fetch).
  const prevPSport = useRef(pSport);
  useEffect(() => {
    if (prevPSport.current === pSport) return;
    prevPSport.current = pSport;
    const c = coordsRef.current;
    if (c) loadRef.current(c.lat, c.lng);
  }, [pSport]);

  // Realtime efficace: join/leave ricaricano i dati con l'ultima posizione
  // nota. router.refresh() qui non servirebbe: la pagina non passa props
  // alle Vicine (i dati vivono in questo componente).
  useEffect(() => {
    const channel = supabase
      .channel("lobbies-nearby")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobbies" }, () => {
        const c = coordsRef.current;
        if (c) loadRef.current(c.lat, c.lng);
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobby_participants" },
        () => {
          const c = coordsRef.current;
          if (c) loadRef.current(c.lat, c.lng);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

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
          onClick={() => {
            const c = coordsRef.current;
            if (c) load(c.lat, c.lng);
          }}
          className="mx-auto mt-3 flex min-h-11 items-center justify-center rounded-control bg-[var(--bg-surface)] px-4 font-semibold text-[var(--text-primary)]"
        >
          Riprova
        </button>
      </div>
    );
  }

  if (state.lobbies.length === 0) {
    // Stesso pattern dell'empty state esistente (icona text-muted + CTA):
    // cambia solo il testo tra "niente nel raggio" e "niente per lo sport".
    // Senza "qui intorno" nella variante sport: il titolo resta su una riga
    // a 360 per ogni label.
    const sportCause =
      state.emptyCause === "sport" && sport !== null ? sport : null;
    return (
      <div className="py-8 text-center">
        <MapPin className="mx-auto mb-2 h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          {sportCause !== null
            ? `Nessuna lobby ${sportEmptyPhrase(sportCause)}`
            : "Nessuna lobby qui intorno"}
        </h2>
        <p className="mx-auto mt-1 max-w-60 text-sm text-[var(--text-secondary)]">
          {sportCause !== null ? "Ci sono partite di altri sport." : "Sii il primo."}
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
