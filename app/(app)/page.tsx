"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/map/map-skeleton";
import { LoginModal } from "@/components/auth/login-modal";
import { BanBanner } from "@/components/karma/ban-banner";
import { Button } from "@/components/ui/button";
import { ReportedCourtsIndicator } from "@/components/report/reported-courts-indicator";
import { FirstRun } from "@/components/onboarding/first-run";
import { SportSelector } from "@/components/court/sport-selector";
import { CourtSearch } from "@/components/court/court-search";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MapPin, Users, Plus } from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { bboxInside, type BBox } from "@/lib/geo";
import {
  COURTS_CACHE_KEY,
  LOBBIES_CACHE_KEY,
  cacheAge,
  formatCacheAge,
  readCache,
  writeCache,
} from "@/lib/offline/cache";
import { ConnectionBanner } from "@/components/offline/connection-banner";
import { StaleBadge } from "@/components/offline/stale-badge";
import { useSport } from "@/lib/sport/sport-context";
import { sportLabel } from "@/lib/sport/sports";
import { safeNext } from "@/lib/auth/routes";

const CourtMap = dynamic(() => import("@/components/map/court-map").then((m) => ({ default: m.CourtMap })), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
  status: string | null;
  sport: string | null;
  venue_type: string | null;
  source: string;
  photo_url: string | null;
  moderation_status: string;
}

interface Lobby {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  status: string;
  participants_count: number;
  court_name?: string | null;
  court_sport?: string | null;
}

const ROME_CENTER = { lat: 41.8919, lng: 12.5113 };

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function HomePage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginNext, setLoginNext] = useState<string | undefined>(undefined);
  const [reportedCourtIds, setReportedCourtIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fieldsAnnouncement, setFieldsAnnouncement] = useState("");
  // Offline (d24): dati in cache + età dell'ultimo salvataggio buono.
  // stale = true quando ciò che si vede viene dalla cache, non dalla rete.
  const [courtsStale, setCourtsStale] = useState(false);
  const [lobbiesStale, setLobbiesStale] = useState(false);
  const stale = courtsStale || lobbiesStale;
  const [courtsSavedAt, setCourtsSavedAt] = useState<number | null>(null);
  const [lobbiesSavedAt, setLobbiesSavedAt] = useState<number | null>(null);
  const announceRef = useRef(true);
  // Regione mappa: il FAB è il punto di ritorno stabile per il focus.
  const fabRef = useRef<HTMLAnchorElement | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { sport, pSport } = useSport();

  // Keep latest sport in a ref for the realtime callback.
  const sportRef = useRef(sport);
  const pSportRef = useRef(pSport);
  useEffect(() => {
    sportRef.current = sport;
    pSportRef.current = pSport;
  }, [sport, pSport]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocalizzazione non supportata");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
      () => {
        setLocationError("Posizione non disponibile");
        setUserLocation([ROME_CENTER.lng, ROME_CENTER.lat]);
      },
      { timeout: 4000 }
    );
  }, []);

  const coveredBBox = useRef<BBox | null>(null);
  const lastBounds = useRef<BBox | null>(null);
  const reqId = useRef(0);

  const fetchCourtsForBBox = useCallback(
    async (bbox: BBox) => {
      const thisReq = ++reqId.current;
      try {
        // Nota: supabase-js non lancia su errore rete, ritorna { error }:
        // va controllato esplicitamente o il fallback cache non scatta mai.
        const { data, error } = await supabase.rpc("courts_in_viewport", {
          min_lng: bbox.w,
          min_lat: bbox.s,
          max_lng: bbox.e,
          max_lat: bbox.n,
          p_sport: pSport ?? undefined,
        });
        if (error) throw error;
        if (thisReq !== reqId.current) return; // stale response dropped
        coveredBBox.current = bbox;
        const list = (data as unknown as Court[] | null) ?? [];
        const now = Date.now();
        writeCache(COURTS_CACHE_KEY, list, undefined, now);
        setCourtsSavedAt(now);
        setCourtsStale(false);
        setCourts(list);
        if (announceRef.current) {
          announceRef.current = false;
          setFieldsAnnouncement(`${list.length} campi visibili per ${sportLabel(sportRef.current)}`);
        }
      } catch (err) {
        if (thisReq !== reqId.current) return;
        coveredBBox.current = null;
        console.error("Error fetching courts in viewport:", err);
        // Offline o fetch fallita: shell leggibile dai dati in cache.
        const cached = readCache<Court[]>(COURTS_CACHE_KEY);
        if (cached) {
          setCourts(cached);
          const age = cacheAge(COURTS_CACHE_KEY);
          setCourtsSavedAt(age == null ? null : Date.now() - age);
          setCourtsStale(true);
        }
      }
    },
    [supabase, pSport]
  );

  const fetchLobbies = useCallback(async () => {
    try {
      const { data: lobbiesData, error } = await supabase.rpc("open_lobbies", {
        p_sport: pSportRef.current ?? undefined,
        p_limit: 20,
      });
      if (error) throw error;
      const formatted: Lobby[] = (
        (lobbiesData as unknown as Array<{
          id: string;
          court_id: string;
          start_time: string;
          max_players: number;
          status: string;
          court_name: string | null;
          court_sport: string | null;
          participants_count: number;
        }> | null) ?? []
      ).map((l) => ({
        id: l.id,
        court_id: l.court_id,
        start_time: l.start_time,
        max_players: l.max_players,
        status: l.status,
        participants_count: l.participants_count ?? 0,
        court_name: l.court_name ?? null,
        court_sport: l.court_sport ?? null,
      }));
      setLobbies(formatted);
      const now = Date.now();
      writeCache(LOBBIES_CACHE_KEY, formatted, undefined, now);
      setLobbiesSavedAt(now);
      setLobbiesStale(false);
    } catch (err) {
      console.error("Error fetching lobbies:", err);
      // Offline o fetch fallita: shell leggibile dai dati in cache.
      const cached = readCache<Lobby[]>(LOBBIES_CACHE_KEY);
      if (cached) {
        setLobbies(cached);
        const age = cacheAge(LOBBIES_CACHE_KEY);
        setLobbiesSavedAt(age == null ? null : Date.now() - age);
        setLobbiesStale(true);
      }
    }
  }, [supabase]);

  // Riprova (d24, stato 04/05): rifà la fetch corrente; se fallisce,
  // i catch sopra ricaricano la cache e mostrano lo stale badge.
  const retry = useCallback(() => {
    const b = lastBounds.current ?? { n: 41.95, s: 41.83, e: 12.62, w: 12.4 };
    coveredBBox.current = null;
    fetchCourtsForBBox(b);
    fetchLobbies();
  }, [fetchCourtsForBBox, fetchLobbies]);

  const handleBoundsChange = useCallback(
    (bounds: BBox, zoom: number) => {
      if (zoom < 10) return;
      lastBounds.current = bounds;
      const prev = coveredBBox.current;
      if (prev && bboxInside(bounds, prev)) return;
      fetchCourtsForBBox(bounds);
    },
    [fetchCourtsForBBox]
  );

  const handleBoundsChangeWrapped = useCallback(
    (bounds: { n: number; s: number; e: number; w: number }, zoom: number) =>
      handleBoundsChange(
        { n: bounds.n, s: bounds.s, e: bounds.e, w: bounds.w },
        zoom
      ),
    [handleBoundsChange]
  );

  // Realtime channel: created once, reads current sport via ref.
  useEffect(() => {
    const channel = supabase
      .channel("lobbies")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lobbies" },
        () => {
          fetchLobbies();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLobbies]);

  const hasMounted = useRef(false);

  // Fetch courts + lobbies when sport changes (skip the very first mount).
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    announceRef.current = true;
    coveredBBox.current = null;
    const b = lastBounds.current ?? { n: 41.95, s: 41.83, e: 12.62, w: 12.4 };
    fetchCourtsForBBox(b);
    fetchLobbies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sport]);

  // Initial load once.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const login = params.get("login");
    if (login === "required" || login === "1") {
      setShowLogin(true);
      // Pass an explicit next only when the login redirect provided one;
      // otherwise the modal stays on the current page after login.
      const rawNext = params.get("next");
      setLoginNext(rawNext === null ? undefined : safeNext(rawNext));
      params.delete("login");
      params.delete("next");
      const next = params.toString();
      history.replaceState(null, "", window.location.pathname + (next ? `?${next}` : ""));
    }
    fetchCourtsForBBox({ n: 41.95, s: 41.83, e: 12.62, w: 12.4 });
    fetchLobbies();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCourts = useMemo(() => {
    const q = normalize(query);
    if (!q) return courts;
    return courts.filter((c) => normalize(c.name).includes(q));
  }, [courts, query]);

  if (loading) {
    return (
      <main id="contenuto" tabIndex={-1} className="flex-1 flex items-center justify-center" role="status" aria-label="Caricamento dati in corso">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-32 bg-[var(--bg-surface)] rounded-lg" />
          <div className="h-4 w-48 bg-[var(--bg-surface)] rounded-lg" />
        </div>
        <span className="sr-only">Caricamento campi e lobby...</span>
      </main>
    );
  }

  const noCourtsForSport = courts.length === 0 && query.trim() === "";

  // Età dei dati in cache per il banner ("dati di N min fa", stato 02).
  const courtsAgeLabel = stale
    ? formatCacheAge(courtsSavedAt == null ? null : Date.now() - courtsSavedAt)
    : null;

  return (
    <main id="contenuto" tabIndex={-1} className="flex-1 flex flex-col relative">
      {user && <BanBanner userId={user.id} />}
      <div className="px-4 pt-3">
        <ConnectionBanner
          ageLabel={courtsAgeLabel}
          onRetry={retry}
          forceStale={stale}
        />
      </div>
      <div className="flex-1 relative min-h-[50dvh]">
        <CourtMap
          ariaLabel={`Mappa dei campi da ${sportLabel(sport)}`}
          courts={filteredCourts}
          reportedCourtIds={reportedCourtIds}
          onCourtSelect={(id) => {
            window.location.href = `/courts/${id}`;
          }}
          userLocation={userLocation}
          locationError={locationError}
          onBoundsChange={handleBoundsChangeWrapped}
        />
        <div className="absolute top-3 left-3 z-20">
          <SportSelector className="" />
        </div>
        <div className="absolute top-3 right-3 z-20">
          <NotificationBell />
        </div>
        {noCourtsForSport && !courtsStale && (
          <div
            className="absolute bottom-4 left-4 right-4 z-20 rounded-card border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4"
            role="status"
            aria-live="polite"
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {sport === null ? "Nessun campo in quest'area" : `Nessun campo da ${sportLabel(sport).toLowerCase()} in quest'area`}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Sposta la mappa o allarga la zona: i campi compaiono quando
              entrano nel raggio.
            </p>
            <Link
              href="/submit-court"
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-control bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)]"
            >
              Aggiungi il primo campo
            </Link>
          </div>
        )}
        <ReportedCourtsIndicator onCourtsUpdate={setReportedCourtIds} />

        <Link
          ref={fabRef}
          href="/submit-court"
          className="absolute bottom-4 right-4 z-30 inline-flex items-center justify-center w-14 h-14 rounded-chip bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg hover:bg-[var(--accent-hover)] active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
          aria-label="Aggiungi un campo"
        >
          <Plus className="w-7 h-7" aria-hidden="true" />
        </Link>
      </div>

      <div className="bg-[var(--bg-base)] border-t border-[var(--cool-muted)]/20 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-[family-name:var(--font-syne)] sr-only">
            Drop-In — Campi
          </h1>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-[family-name:var(--font-syne)]">
              Partite vicine
            </h2>
            {lobbiesStale && <StaleBadge savedAt={lobbiesSavedAt} />}
          </div>
          {!user && (
            <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)}>
              Accedi
            </Button>
          )}
        </div>

        <CourtSearch
          value={query}
          onChange={setQuery}
          resultCount={filteredCourts.length}
          totalCount={courts.length}
        />

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {lobbies.length} lobby attive disponibili
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {fieldsAnnouncement}
        </div>

        {lobbies.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-[var(--text-muted)] text-sm">
              Nessuna lobby qui intorno. Sii il primo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lobbies.map((lobby) => (
              <Link
                key={lobby.id}
                href={`/courts/${lobby.court_id}`}
                className="block bg-[var(--bg-surface)] rounded-xl p-4 active:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {lobby.court_name || courts.find((c) => c.id === lobby.court_id)?.name || "Campo"}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-[var(--text-secondary)]">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {lobby.participants_count}/{lobby.max_players}
                      </span>
                      <span aria-hidden="true">•</span>
                      <span>
                        {new Date(lobby.start_time).toLocaleTimeString("it-IT", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                  <Button size="sm" variant="primary" tabIndex={-1}>
                    Vedi
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <LoginModal open={showLogin} onClose={() => setShowLogin(false)} next={loginNext} />
      {/* Primo avvio: si apre da solo al primo render, non blocca i dati.
          Il login del passo 3 riusa il LoginModal di pagina (nessun secondo
          flusso); alla chiusura il focus torna al FAB "Aggiungi un campo". */}
      <FirstRun
        onLogin={() => setShowLogin(true)}
        returnFocusRef={fabRef}
      />
    </main>
  );
}
