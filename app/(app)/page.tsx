"use client";

import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import { MapSkeleton } from "@/components/map/map-skeleton";
// d26: modali fuori dal chunk iniziale E dal waterfall post-mount.
// LoginModal: modulo caricato solo alla prima apertura (React.lazy + mount
// condizionale, resta montato per conservare l'animazione di chiusura).
const LoginModalLazy = lazy(() => import("@/components/auth/login-modal").then((m) => ({ default: m.LoginModal })));
// FirstRun: apertura automatica al primo avvio -> chunk separato ma caricato
// con la pagina (non blocca il first paint, il drawer si apre da solo).
const FirstRun = dynamic(() => import("@/components/onboarding/first-run").then((m) => ({ default: m.FirstRun })), {
  ssr: false,
});
// d26-nit: la prima apertura scarica il chunk login; il fallback mostra lo
// sheet in caricamento (stessa sagoma del Drawer, token-only) invece di un
// click apparentemente morto su rete lenta. Il tap sul backdrop chiude.
function LoginLoadingFallback({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="status"
      aria-label="Caricamento accesso"
    >
      <div className="absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[720px] rounded-t-sheet bg-[var(--bg-elevated)] shadow-lg pb-safe">
        <div className="flex justify-center pt-3 pb-3 min-h-[44px]" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-[var(--text-muted)]/30" />
        </div>
        <div className="px-5 pt-2 pb-6 space-y-3">
          <p className="text-xl font-semibold font-[family-name:var(--font-syne)] text-[var(--text-primary)]">
            Accedi
          </p>
          <div className="h-11 rounded-control bg-[var(--bg-surface)] animate-pulse" aria-hidden="true" />
          <div className="h-11 rounded-control bg-[var(--bg-surface)] animate-pulse" aria-hidden="true" />
          <Button className="w-full" disabled>
            Caricamento…
          </Button>
          <span className="sr-only">Caricamento del modulo di accesso in corso</span>
        </div>
      </div>
    </div>
  );
}
import { BanBanner } from "@/components/karma/ban-banner";
import { Button } from "@/components/ui/button";
import { ReportedCourtsIndicator } from "@/components/report/reported-courts-indicator";
import { SportSelector } from "@/components/court/sport-selector";
import { CourtPhotoThumb } from "@/components/court/court-photo-thumb";
import { CourtSearch } from "@/components/court/court-search";
import { CourtSearchResults } from "@/components/court/court-search-results";
import { LobbySheet, type LobbySheetSnap } from "@/components/home/lobby-sheet";
import {
  LobbyRailCard,
  occupancyPercent,
  occupancyTone,
} from "@/components/home/lobby-rail-card";
import { RecurringChip } from "@/components/lobby/recurring-chip";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MapPin, Users, ChevronRight, Plus, LocateFixed } from "lucide-react";
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
import { sportEmptyPhrase, sportLabel } from "@/lib/sport/sports";
import { safeNext } from "@/lib/auth/routes";
import { formatAppTime, formatAppDate } from "@/lib/datetime";
import { warmPreviewNotes } from "@/lib/court/notes";
import {
  NEARBY_RADIUS_M,
  ROME_CENTER,
  courtDistanceM,
  selectLobbiesOrigin,
} from "@/lib/lobbies/nearby";
import { fromGeolocationCode } from "@/lib/checkin/errors";
import { isIosDevice } from "@/lib/pwa/install";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_LIMIT,
  SEARCH_RADIUS_M,
  hasFiniteCourtCoords,
  isSearchActive,
  mapNearbyCourtRow,
  normalizeSearchQuery,
  searchQueryText,
  selectSearchOrigin,
  shouldFetchSearch,
  type Court,
  type NearbyCourtRow,
  type SearchPhase,
} from "@/lib/courts/search";

const CourtMap = dynamic(() => import("@/components/map/court-map").then((m) => ({ default: m.CourtMap })), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

interface Lobby {
  id: string;
  court_id: string;
  start_time: string;
  sport: string | null;
  duration_minutes: number;
  ends_at: string;
  max_players: number;
  status: string;
  participants_count: number;
  court_name?: string | null;
  court_sport?: string | null;
  /** Serie di provenienza (054): chip "Ricorrente" ridotto, senza dettaglio. */
  series_id?: string | null;
}

interface SearchState {
  phase: SearchPhase;
  /** Query normalizzata a cui si riferisce lo stato. */
  query: string;
  results: Court[];
}

export default function HomePage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  // d26: monta il modulo login solo dalla prima apertura in poi.
  const [loginMounted, setLoginMounted] = useState(false);
  useEffect(() => {
    if (showLogin) setLoginMounted(true);
  }, [showLogin]);
  const [loginNext, setLoginNext] = useState<string | undefined>(undefined);
  const [reportedCourtIds, setReportedCourtIds] = useState<string[]>([]);
  // Preferiti dell'utente (#41): solo gli id, al marker serve sapere se il
  // campo e' salvato. Fetch separata da courts/lobbies, dipende da user.id.
  const [favoriteCourtIds, setFavoriteCourtIds] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Foglio "Partite vicine" (#89, Lane B): snap locale (vista, non risorsa:
  // niente URL, niente contesto), focus del campo ricerca e live region.
  const [snap, setSnap] = useState<LobbySheetSnap>("rail");
  const [announcement, setAnnouncement] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sheetMetrics, setSheetMetrics] = useState({
    railHeight: 144,
    dragging: false,
    keyboardOpen: false,
  });
  // Snap e scroll di prima della ricerca: chiudere riporta lì.
  const snapBeforeRef = useRef<LobbySheetSnap>("rail");
  const savedScrollRef = useRef(0);
  const sheetListRef = useRef<HTMLDivElement | null>(null);
  const sheetHandleRef = useRef<HTMLButtonElement | null>(null);
  const chromeRef = useRef<HTMLDivElement | null>(null);
  // Ricerca server-side (#68): stato esplicito, ref per debounce e anti-stale.
  const [search, setSearch] = useState<SearchState>({
    phase: "idle",
    query: "",
    results: [],
  });
  const searchReqId = useRef(0);
  const lastSearchedQuery = useRef("");
  const searchStateRef = useRef(search);
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

  // Ultima posizione nota in un ref: fetchLobbies resta stabile (nessuna
  // ri-sottoscrizione realtime) e legge l'origine al momento della chiamata.
  const userLocationRef = useRef<[number, number] | null>(null);
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  // Geolocalizzazione solo dietro gesto esplicito (#80): su iOS Safari la
  // richiesta fuori gesto non mostra il prompt (o viene negata in silenzio),
  // quindi al mount non si chiede niente — l'origine resta il centro mappa
  // (fallback già dentro selectLobbiesOrigin/selectSearchOrigin). L'unica
  // eccezione è il permesso già concesso, che non mostra alcun prompt.
  useEffect(() => {
    let cancelled = false;
    try {
      const perms = navigator.permissions;
      if (!perms?.query) return;
      perms
        .query({ name: "geolocation" })
        .then((status) => {
          if (cancelled || status.state !== "granted") return;
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (cancelled) return;
              const next: [number, number] = [pos.coords.longitude, pos.coords.latitude];
              userLocationRef.current = next;
              setUserLocation(next);
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        })
        .catch(() => {});
    } catch {
      // Permessi non interrogabili: si aspetta il tap sulla CTA.
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Preferiti del campo (#41): il marker distingue "salvato" senza aprire
  // nulla. Una fetch per utente, non per pan; errori = lista vuota (il marker
  // torna default, nessun blocco).
  useEffect(() => {
    if (!user) {
      setFavoriteCourtIds([]);
      return;
    }
    let cancelled = false;
    void supabase
      .from("user_favorites")
      .select("court_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const ids = (data ?? [])
          .map((row) => row.court_id)
          .filter((id): id is string => typeof id === "string");
        setFavoriteCourtIds([...new Set(ids)]);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, user]);

  const coveredBBox = useRef<BBox | null>(null);
  const lastBounds = useRef<BBox | null>(null);
  // Contatori anti-stale separati: courts e lobbies sono fetch indipendenti
  // (retry() le lancia insieme) e un guard condiviso scarterebbe sempre la
  // risposta delle courts. La ricerca ha già il suo (searchReqId).
  const courtsReqId = useRef(0);
  const lobbiesReqId = useRef(0);

  // Query letta dai callback (pan, sport, retry) senza ricreare le callback.
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);
  // Stato ricerca per decidere se il debounce deve forzare una fetch.
  useEffect(() => {
    searchStateRef.current = search;
  }, [search]);

  const fetchCourtsForBBox = useCallback(
    async (bbox: BBox) => {
      const thisReq = ++courtsReqId.current;
      try {
        // Browse = bbox, non raggio: `courts_in_viewport` (14 colonne con
        // `is_auto_name` dalla 050, no p_query). La ricerca usa un'altra RPC
        // — vedi docs/rpc.md.
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
        if (thisReq !== courtsReqId.current) return; // stale response dropped
        coveredBBox.current = bbox;
        // Coordinate non finite (riga RPC corrotta): fuori dalla lista e
        // dalla cache, mai un marker con NaN.
        const list = ((data as unknown as Court[] | null) ?? []).filter(hasFiniteCourtCoords);
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
        if (thisReq !== courtsReqId.current) return;
        coveredBBox.current = null;
        console.error("Error fetching courts in viewport:", err);
        // Offline o fetch fallita: shell leggibile dai dati in cache.
        const cached = readCache<Court[]>(COURTS_CACHE_KEY);
        if (cached) {
          // La cache puo' contenere righe scritte prima della validazione:
          // rifiltra in lettura, costo O(n).
          setCourts(cached.filter(hasFiniteCourtCoords));
          const age = cacheAge(COURTS_CACHE_KEY);
          setCourtsSavedAt(age == null ? null : Date.now() - age);
          setCourtsStale(true);
        }
      }
    },
    [supabase, pSport]
  );

  /**
   * Ricerca per nome con `nearby_courts` (#68): raggio dal centro mappa,
   * non viewport — è l'altra RPC rispetto al browse, firma e colonne
   * diverse, vedi docs/rpc.md. Niente cache offline: `COURTS_CACHE_KEY` è
   * unica e senza dimensione query, scriverci i risultati distruggerebbe
   * il browse.
   */
  const runSearch = useCallback(
    async (rawQuery: string, force = false) => {
      const normalized = normalizeSearchQuery(rawQuery);
      if (!normalized) return;
      if (!force && !shouldFetchSearch(normalized, lastSearchedQuery.current)) {
        return;
      }
      lastSearchedQuery.current = normalized;
      const thisReq = ++searchReqId.current;
      setSearch((prev) => ({
        phase: "loading",
        query: normalized,
        results: prev.query === normalized ? prev.results : [],
      }));
      try {
        const origin = selectSearchOrigin(
          lastBounds.current,
          userLocationRef.current,
          { lat: ROME_CENTER.lat, lng: ROME_CENTER.lng }
        );
        // `p_query` va senza normalizzazione: la RPC fa ILIKE e gli accenti
        // contano. L'escape di %, _ e \ è già dentro la 020.
        const { data, error } = await supabase.rpc("nearby_courts", {
          p_lat: origin.lat,
          p_lng: origin.lng,
          p_radius_m: SEARCH_RADIUS_M,
          p_limit: SEARCH_LIMIT,
          p_sport: pSportRef.current ?? undefined,
          p_query: searchQueryText(rawQuery),
        });
        if (error) throw error;
        if (thisReq !== searchReqId.current) return; // stale response dropped
        const rows = (data as unknown as NearbyCourtRow[] | null) ?? [];
        setSearch({
          phase: "ready",
          query: normalized,
          results: rows.map(mapNearbyCourtRow).filter(hasFiniteCourtCoords),
        });
      } catch (err) {
        if (thisReq !== searchReqId.current) return; // stale response dropped
        console.error("Error searching courts:", err);
        setSearch({ phase: "error", query: normalized, results: [] });
      }
    },
    [supabase]
  );

  // Causa dell'empty state lobby: "radius" = niente nel raggio, "sport" =
  // lobby nel raggio ma non per questo sport, null = non vuote o ignoto.
  const [lobbiesEmptyCause, setLobbiesEmptyCause] = useState<
    "radius" | "sport" | null
  >(null);

  const fetchLobbies = useCallback(async () => {
    const thisReq = ++lobbiesReqId.current;
    try {
      // Origine del raggio: posizione utente → centro mappa → Roma. Letta
      // dai ref al momento della chiamata: il cambio sport non la resetta.
      const origin = selectLobbiesOrigin(
        userLocationRef.current,
        lastBounds.current,
        ROME_CENTER
      );
      const rpcSport = pSportRef.current ?? undefined;
      const { data: lobbiesData, error } = await supabase.rpc("open_lobbies", {
        p_sport: rpcSport,
        p_limit: 20,
        p_lat: origin.lat,
        p_lng: origin.lng,
        p_radius_m: NEARBY_RADIUS_M,
      });
      if (error) throw error;
      if (thisReq !== lobbiesReqId.current) return; // stale response dropped
      const formatted: Lobby[] = (
        (lobbiesData as unknown as Array<{
          id: string;
          court_id: string;
          start_time: string;
          sport: string | null;
          duration_minutes: number;
          ends_at: string;
          max_players: number;
          status: string;
          court_name: string | null;
          court_sport: string | null;
          participants_count: number;
          series_id: string | null;
        }> | null) ?? []
      ).map((l) => ({
        id: l.id,
        court_id: l.court_id,
        start_time: l.start_time,
        sport: l.sport,
        duration_minutes: l.duration_minutes,
        ends_at: l.ends_at,
        max_players: l.max_players,
        status: l.status,
        participants_count: l.participants_count ?? 0,
        court_name: l.court_name ?? null,
        court_sport: l.court_sport ?? null,
        series_id: l.series_id ?? null,
      }));
      setLobbies(formatted);
      if (formatted.length > 0) {
        setLobbiesEmptyCause(null);
      } else if (rpcSport == null) {
        // Senza filtro sport, vuoto = niente nel raggio.
        setLobbiesEmptyCause("radius");
      } else {
        // Con filtro sport, vuoto = ambiguo: seconda chiamata senza sport
        // (stessa origine, limite 1) per distinguere "niente nel raggio" da
        // "niente per questo sport".
        try {
          const { data: anyData } = await supabase.rpc("open_lobbies", {
            p_limit: 1,
            p_lat: origin.lat,
            p_lng: origin.lng,
            p_radius_m: NEARBY_RADIUS_M,
          });
          const anyRows = (anyData as unknown[] | null) ?? [];
          if (thisReq !== lobbiesReqId.current) return; // stale response dropped
          setLobbiesEmptyCause(anyRows.length > 0 ? "sport" : "radius");
        } catch {
          if (thisReq !== lobbiesReqId.current) return; // stale response dropped
          setLobbiesEmptyCause(null);
        }
      }
      if (thisReq !== lobbiesReqId.current) return; // stale response dropped
      const now = Date.now();
      writeCache(LOBBIES_CACHE_KEY, formatted, undefined, now);
      setLobbiesSavedAt(now);
      setLobbiesStale(false);
    } catch (err) {
      if (thisReq !== lobbiesReqId.current) return; // stale response dropped
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

  // CTA "Usa la mia posizione" (#80): unico getCurrentPosition su tap (più
  // il fast path sopra per il permesso già concesso). Definita dopo
  // fetchLobbies/runSearch: li richiama per riordinare le Vicine (e la
  // ricerca attiva) dal GPS invece che dal centro mappa. Gli errori riusano
  // i testi di fromGeolocationCode, niente copy nuovo.
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Geolocalizzazione non supportata");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        userLocationRef.current = next;
        setUserLocation(next);
        setLocationError(null);
        fetchLobbies();
        if (isSearchActive(queryRef.current)) {
          lastSearchedQuery.current = "";
          void runSearch(queryRef.current, true);
        }
      },
      (err) => {
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as { standalone?: boolean }).standalone === true;
        const info = fromGeolocationCode(err.code, {
          ios: isIosDevice(navigator.userAgent),
          standalone,
        });
        setLocationError(`${info.title}. ${info.body}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [fetchLobbies, runSearch]);

  // Debounce della query (#68): 300 ms dopo l'ultimo tasto. La decisione
  // "serve una fetch?" è nel seam puro; qui restano timer e stato.
  useEffect(() => {
    const normalized = normalizeSearchQuery(query);
    if (!normalized) {
      if (searchStateRef.current.phase !== "idle") {
        searchReqId.current += 1; // scarta l'eventuale risposta in volo
        lastSearchedQuery.current = "";
        setSearch({ phase: "idle", query: "", results: [] });
      }
      return;
    }
    // Cambiato solo il testo non significativo (spazi): stato già allineato,
    // ma non in fase error — aggiungere uno spazio deve riprovare la fetch.
    const cur = searchStateRef.current;
    if (cur.query === normalized && cur.phase !== "idle" && cur.phase !== "error") {
      return;
    }
    // Niente flash di skeleton a ogni tasto: i risultati già mostrati restano
    // finché la nuova risposta non arriva; si azzera solo al cambio di query
    // "vera" (normalizzata diversa) o a query vuota (ramo sopra).
    setSearch((prev) => ({
      phase: "waiting",
      query: normalized,
      results: prev.query === normalized ? prev.results : [],
    }));
    const timer = window.setTimeout(() => {
      // Se non c'è né una richiesta in volo né un risultato pronto per questa
      // query (es. si torna a una query precedente), la fetch va forzata.
      const aligned =
        searchStateRef.current.query === normalized &&
        searchStateRef.current.phase === "ready";
      void runSearch(query, !aligned);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const retrySearch = useCallback(() => {
    const q = queryRef.current;
    if (!isSearchActive(q)) return;
    lastSearchedQuery.current = "";
    void runSearch(q, true);
  }, [runSearch]);

  // Riprova (d24, stato 04/05): rifà la fetch corrente; se fallisce,
  // i catch sopra ricaricano la cache e mostrano lo stale badge.
  const retry = useCallback(() => {
    const b = lastBounds.current ?? { n: 41.95, s: 41.83, e: 12.62, w: 12.4 };
    coveredBBox.current = null;
    fetchCourtsForBBox(b);
    fetchLobbies();
    if (isSearchActive(queryRef.current)) {
      lastSearchedQuery.current = "";
      void runSearch(queryRef.current, true);
    }
  }, [fetchCourtsForBBox, fetchLobbies, runSearch]);

  const handleBoundsChange = useCallback(
    (bounds: BBox, zoom: number) => {
      if (zoom < 10) return;
      lastBounds.current = bounds;
      const prev = coveredBBox.current;
      if (prev && bboxInside(bounds, prev)) return;
      fetchCourtsForBBox(bounds);
      // Senza geolocalizzazione l'origine è il centro mappa: al pan la lista
      // lobby va rifiltrata (con geo l'origine è fissa, niente refetch).
      // L'handler scatta già su bounds stabili (moveend/zoomend), niente debounce.
      if (userLocationRef.current == null) {
        fetchLobbies();
      }
      // Ricerca attiva: i risultati sono per raggio dal centro mappa, quindi
      // un pan accettato (fuori bboxInside) li rende stantii. Si rilancia con
      // il nuovo centro — lastBounds è già aggiornato e runSearch lo legge lì;
      // force perché la query normalizzata è invariata. La search non richiama
      // questo handler: nessun loop. I risultati vecchi restano visibili finché
      // non arriva la nuova risposta (runSearch non azzera a query invariata).
      if (isSearchActive(queryRef.current)) {
        void runSearch(queryRef.current, true);
      }
    },
    [fetchCourtsForBBox, fetchLobbies, runSearch]
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
    // La ricerca attiva deve riflettere il nuovo p_sport.
    if (isSearchActive(queryRef.current)) {
      lastSearchedQuery.current = "";
      void runSearch(queryRef.current, true);
    }
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

  const activeQuery = normalizeSearchQuery(query);
  const searchAligned = activeQuery !== "" && search.query === activeQuery;
  const searchPhase: SearchPhase =
    activeQuery === "" ? "idle" : searchAligned ? search.phase : "waiting";
  const searchResults = searchAligned ? search.results : [];
  // Con la ricerca attiva i marker sono i risultati server, anche fuori
  // viewport; senza query restano i campi del browse.
  const mapCourts = activeQuery === "" ? courts : searchResults;
  // Lobby attive per campo: il marker la mostra come numero, l'anteprima come
  // testo. Derivato dalla lista gia' in pagina, nessuna fetch in piu'.
  const lobbyCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lobby of lobbies) {
      counts[lobby.court_id] = (counts[lobby.court_id] ?? 0) + 1;
    }
    return counts;
  }, [lobbies]);

  // --- Foglio "Partite vicine" (#89, Lane B) --------------------------------
  // Un solo elenco alla volta: ricerca attiva → solo i campi trovati (la
  // striscia, le partite, il piede e la CTA spariscono); chiudere torna allo
  // snap e allo scroll di prima, con il focus sull'handle.
  const searchMode = activeQuery !== "";
  const inSearch = searchFocused || searchMode;
  const trimmedQuery = query.trim();

  const lobbyCountPhrase = (n: number) =>
    n === 1 ? "1 partita vicina." : `${n} partite vicine.`;

  const requestSnap = (next: LobbySheetSnap) => {
    setSnap(next);
    setAnnouncement(
      next === "full"
        ? `Lista a tutta altezza. ${lobbyCountPhrase(lobbies.length)}`
        : `Lista ridotta a striscia. ${lobbyCountPhrase(lobbies.length)}`
    );
  };

  // Focus sull'handle alla chiusura della ricerca. L'handle è smontato in
  // ricerca: il focus va messo solo dopo aver verificato che il nodo esista
  // nel DOM (spec home-ricerca §3), con un secondo rAF di margine per il
  // remount. Se il nodo manca ancora, non si ruba il focus a niente.
  const focusSheetHandle = useCallback(() => {
    const attempt = (retries: number) => {
      const node = sheetHandleRef.current;
      if (node && node.isConnected) {
        node.focus({ preventScroll: true });
        return;
      }
      if (retries > 0) {
        requestAnimationFrame(() => attempt(retries - 1));
      }
    };
    requestAnimationFrame(() => attempt(1));
  }, []);

  const closeSearchFlow = useCallback(() => {
    setQuery("");
    setSearchFocused(false);
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    const target = snapBeforeRef.current;
    setSnap(target);
    setAnnouncement(`Ricerca chiusa. Partite vicine. ${lobbyCountPhrase(lobbies.length)}`);
    requestAnimationFrame(() => {
      if (sheetListRef.current) sheetListRef.current.scrollTop = savedScrollRef.current;
      focusSheetHandle();
    });
  }, [focusSheetHandle, lobbies.length]);

  const handleCollapseRequest = () => {
    if (inSearch) closeSearchFlow();
    else requestSnap("rail");
  };

  const handleSearchFocus = () => {
    if (searchFocused) return;
    setSearchFocused(true);
    snapBeforeRef.current = snap;
    savedScrollRef.current = sheetListRef.current?.scrollTop ?? 0;
    // Il foglio va a piena da solo appena il campo prende il focus.
    if (snap !== "full") {
      setSnap("full");
      setAnnouncement(`Lista a tutta altezza. ${lobbyCountPhrase(lobbies.length)}`);
    }
  };

  const handleSearchBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setSearchFocused(false);
    // Svuotare col backspace non riporta giù (resta a piena con le partite):
    // è il blur a tornare allo snap di prima.
    if (isSearchActive(queryRef.current)) return;
    const target = snapBeforeRef.current;
    setSnap(target);
    setAnnouncement(`Ricerca chiusa. Partite vicine. ${lobbyCountPhrase(lobbies.length)}`);
    requestAnimationFrame(() => {
      if (sheetListRef.current) sheetListRef.current.scrollTop = savedScrollRef.current;
      focusSheetHandle();
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      // La ricerca parte già col debounce: Invio chiude solo la tastiera.
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (isSearchActive(queryRef.current)) closeSearchFlow();
      else {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }
    }
  };

  // Annunci di ricerca (testa del foglio mai live: un solo annuncio). Il testo
  // non ricalca mai "N campi per «q»" della riga di stato di CourtSearch
  // (componente congelato): due nodi con lo stesso testo romperebbero gli
  // e2e in strict mode. Stesse informazioni, ordine diverso.
  useEffect(() => {
    if (!searchMode) {
      // Query svuotata col campo ancora focalizzato: il foglio resta a piena
      // con le partite — l'annuncio torna alla lista (e non trattiene la
      // query vecchia nella live region).
      if (searchFocused && searchPhase === "idle") {
        setAnnouncement(
          `Lista a tutta altezza. ${lobbies.length === 1 ? "1 partita vicina." : `${lobbies.length} partite vicine.`}`,
        );
      }
      return;
    }
    const radiusKm = SEARCH_RADIUS_M / 1000;
    if (searchPhase === "waiting" || searchPhase === "loading") {
      setAnnouncement(`Cerco «${trimmedQuery}» entro ${radiusKm} km.`);
    } else if (searchPhase === "ready") {
      if (searchResults.length === 0) {
        setAnnouncement(
          `Per «${trimmedQuery}»: nessun campo entro ${radiusKm} km. La ricerca guarda il nome del campo, non l'indirizzo.`
        );
      } else {
        const n = searchResults.length;
        setAnnouncement(`Per «${trimmedQuery}»: ${n} ${n === 1 ? "campo trovato" : "campi trovati"} entro ${radiusKm} km.`);
      }
    } else if (searchPhase === "error") {
      setAnnouncement(`Ricerca non riuscita per «${trimmedQuery}». Controlla la connessione e riprova.`);
    }
  }, [searchMode, searchFocused, searchPhase, searchResults.length, trimmedQuery, lobbies.length]);

  // Anteprima mappa: scalda la cache delle note per i campi con partite e
  // per i risultati di ricerca (pin, striscia, lista). Fire-and-forget: al
  // tap l'anteprima trova la riga senza rete e vince sempre il tetto di
  // 400ms — la riga c'è al primo frame anche con rete lenta. Dettagli e TTL
  // in `lib/court/notes.ts` e `docs/design/specs/nota-campo.md` §Superficie 3.
  useEffect(() => {
    if (lobbies.length === 0) return;
    void warmPreviewNotes(
      supabase,
      lobbies.map((lobby) => lobby.court_id)
    );
  }, [lobbies, supabase]);
  useEffect(() => {
    if (!searchMode || searchPhase !== "ready" || search.query !== activeQuery) return;
    if (search.results.length === 0) return;
    void warmPreviewNotes(
      supabase,
      search.results.map((court) => court.id)
    );
  }, [searchMode, searchPhase, search, activeQuery, supabase]);

  // All'ingresso in ricerca i risultati partono dall'inizio (stesso scroller
  // delle partite: senza reset resterebbe a metà lista).
  const prevSearchModeRef = useRef(false);
  useEffect(() => {
    if (searchMode && !prevSearchModeRef.current && sheetListRef.current) {
      sheetListRef.current.scrollTop = 0;
    }
    prevSearchModeRef.current = searchMode;
  }, [searchMode]);

  const sheetTitle = searchMode ? "Campi trovati" : "Partite vicine";
  const sheetCount =
    searchMode && searchPhase !== "ready" ? null : searchMode ? searchResults.length : lobbies.length;
  const sheetMeta = searchMode
    ? searchPhase === "waiting" || searchPhase === "loading"
      ? `Cerco «${trimmedQuery}»…`
      : searchPhase === "error"
        ? null
        : `entro ${SEARCH_RADIUS_M / 1000} km`
    : `Oggi, ${formatAppDate(new Date())} · entro ${NEARBY_RADIUS_M / 1000} km`;

  // "Campi liberi qui intorno": i 2 più vicini all'origine del raggio lobby.
  const nearestCourts: Court[] = (() => {
    const origin = selectLobbiesOrigin(userLocation, lastBounds.current, ROME_CENTER);
    return courts
      .map((court) => ({
        court,
        d: courtDistanceM(origin.lat, origin.lng, court.lat, court.lng),
      }))
      .filter((entry): entry is { court: Court; d: number } => entry.d !== null)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((entry) => ({ ...entry.court, distance_m: entry.d }));
  })();
  const declareHref =
    nearestCourts.length > 0 ? `/courts/${nearestCourts[0].id}` : "/submit-court";

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

  const noCourtsForSport = courts.length === 0 && activeQuery === "";

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
          courts={mapCourts}
          reportedCourtIds={reportedCourtIds}
          favoriteCourtIds={favoriteCourtIds}
          lobbyCounts={lobbyCounts}
          onCourtSelect={(id) => {
            // Unica live region della home (sotto): selezione e conteggio
            // viaggiano insieme, niente secondo annuncio duplicato.
            if (id == null) {
              setFieldsAnnouncement("Anteprima chiusa");
              return;
            }
            const court = mapCourts.find((c) => c.id === id);
            setFieldsAnnouncement(
              `${court?.name ?? "Campo"} selezionato. ${mapCourts.length} ${
                mapCourts.length === 1 ? "campo visibile" : "campi visibili"
              }.`
            );
          }}
          userLocation={userLocation}
          locationError={locationError}
          onBoundsChange={handleBoundsChangeWrapped}
        />
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {fieldsAnnouncement}
        </div>
        {/* Chrome a due righe sopra la mappa (spec home-ricerca): filtri +
            ricerca, sempre visibili. La piena si ferma 8px sotto (misurato). */}
        <div ref={chromeRef} className="absolute inset-x-3 top-3 z-20 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <SportSelector className="" />
            <div className="flex items-start gap-2">
              {/* #80: il GPS si chiede solo da qui (tap), mai al mount —
                  su iOS Safari la richiesta fuori gesto non mostra il prompt. */}
              <button
                type="button"
                onClick={requestLocation}
                aria-label={
                  userLocation == null
                    ? "Usa la mia posizione"
                    : "Aggiorna la mia posizione"
                }
                title="Usa la mia posizione"
                className="grid place-items-center w-11 h-11 rounded-control bg-[var(--bg-surface)] border border-[var(--cool-muted)]/20 text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                <LocateFixed aria-hidden="true" className="w-5 h-5" />
              </button>
              <NotificationBell />
            </div>
          </div>
          <div
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            onKeyDown={handleSearchKeyDown}
          >
            <CourtSearch
              value={query}
              onChange={setQuery}
              searching={searchPhase === "waiting" || searchPhase === "loading"}
              error={searchPhase === "error"}
              resultCount={searchResults.length}
              totalCount={courts.length}
            />
          </div>
        </div>
        {/* Banner "nessun campo": sopra il bordo del foglio come FAB e
            "Lista campi" (stesso criterio: a piena il foglio ha già le sue
            azioni e coprirebbe tutto). Solo a striscia e mai in ricerca
            (come il FAB: `inSearch` porta sempre a piena). `bottom` fisso a
            railHeight: a striscia la tastiera è chiusa, `--sheet-lift`
            include invece il bottom tastiera e serve ai controlli mappa che
            restano visibili con la tastiera aperta (zoom). */}
        {noCourtsForSport && !courtsStale && snap === "rail" && !inSearch && (
          <div
            className="absolute start-4 end-4 z-20 rounded-card border border-[var(--border-strong)] bg-[var(--bg-elevated)] p-4"
            style={{ bottom: sheetMetrics.railHeight + 12 }}
            role="status"
            aria-live="polite"
          >
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {sport === null ? "Nessun campo in quest'area" : `Nessun campo ${sportEmptyPhrase(sport, "da")} in quest'area`}
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

        {/* FAB solo a striscia (approvato 17 nov), sopra il bordo del foglio;
            a piena e in ricerca il foglio ha già le sue azioni. */}
        {snap === "rail" && !inSearch && (
          <Link
            ref={fabRef}
            href="/submit-court"
            style={{ bottom: sheetMetrics.railHeight + 12 }}
            className="absolute end-4 z-30 inline-flex items-center justify-center w-14 h-14 rounded-chip bg-[var(--accent)] text-[var(--accent-foreground)] shadow-lg hover:bg-[var(--accent-hover)] active:scale-[0.97] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
            aria-label="Aggiungi un campo"
          >
            <Plus className="w-7 h-7" aria-hidden="true" />
          </Link>
        )}

        <LobbySheet
          snap={snap}
          onSnapChange={requestSnap}
          title={sheetTitle}
          titleId="lobby-sheet-title"
          count={sheetCount}
          meta={sheetMeta}
          inSearch={inSearch}
          announcement={announcement}
          listRef={sheetListRef}
          handleRef={sheetHandleRef}
          chromeRef={chromeRef}
          onCollapseRequest={handleCollapseRequest}
          onMetrics={setSheetMetrics}
          actions={
            <>
              {lobbiesStale && !searchMode && <StaleBadge savedAt={lobbiesSavedAt} />}
              {!user && (
                <Button variant="ghost" size="sm" onClick={() => setShowLogin(true)}>
                  Accedi
                </Button>
              )}
            </>
          }
          rail={
            searchMode ? null : lobbies.length === 0 ? (
              <div className="flex min-h-[52px] flex-1 items-center gap-3">
                <p className="text-sm text-[var(--text-secondary)]">Nessuna partita, per ora</p>
                <Link
                  href={declareHref}
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-control bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
                >
                  Dichiara la serata
                </Link>
              </div>
            ) : (
              lobbies.map((lobby) => {
                const court = courts.find((c) => c.id === lobby.court_id);
                return (
                  <LobbyRailCard
                    key={lobby.id}
                    lobbyId={lobby.id}
                    courtId={lobby.court_id}
                    courtName={lobby.court_name || court?.name || "Campo"}
                    time={formatAppTime(lobby.start_time)}
                    participants={lobby.participants_count}
                    maxPlayers={lobby.max_players}
                    recurring={lobby.series_id != null}
                  />
                );
              })
            )
          }
        >
          {searchMode ? (
            <CourtSearchResults
              query={query.trim()}
              phase={searchPhase}
              results={searchResults}
              onRetry={retrySearch}
              onClear={closeSearchFlow}
            />
          ) : lobbies.length === 0 ? (
            <div className="py-8 text-center">
              <MapPin className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-[var(--text-muted)]">
                {lobbiesEmptyCause === "sport" && sport !== null
                  ? `Nessuna partita ${sportEmptyPhrase(sport)}, per ora`
                  : "Nessuna partita, per ora"}
              </p>
              <p className="mt-2 font-[family-name:var(--font-syne)] text-xl font-bold text-[var(--text-primary)]">
                Apri tu la serata
              </p>
              {lobbiesEmptyCause === "sport" && (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Ci sono partite di altri sport.
                </p>
              )}
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Scrivi campo e ora: chi è in zona lo vede e si aggiunge.
              </p>
              <Link
                href={declareHref}
                className="mx-auto mt-4 inline-flex min-h-[44px] items-center justify-center rounded-control bg-[var(--accent)] px-6 text-base font-semibold text-[var(--accent-foreground)]"
              >
                Dichiara la serata
              </Link>
              {nearestCourts.length > 0 && (
                <>
                  <p className="mt-6 text-sm font-semibold text-[var(--text-secondary)]">
                    Campi liberi qui intorno
                  </p>
                  <div className="mt-2 space-y-2 text-left">
                    {nearestCourts.map((court) => {
                      const km =
                        court.distance_m != null
                          ? (court.distance_m / 1000).toLocaleString("it-IT", {
                              maximumFractionDigits: 1,
                            })
                          : null;
                      return (
                        <Link
                          key={court.id}
                          href={`/courts/${court.id}`}
                          aria-label={km != null ? `${court.name}, a ${km} chilometri` : court.name}
                          className="flex min-h-[44px] items-center gap-3 rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        >
                          <CourtPhotoThumb photoPath={court.photo_path} className="h-14 w-14" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-[var(--text-primary)]">
                              {court.name}
                            </span>
                            {km != null && (
                              <span className="mt-1 block text-sm text-[var(--text-secondary)]">
                                a {km} km
                              </span>
                            )}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {lobbies.map((lobby) => {
                const court = courts.find((c) => c.id === lobby.court_id);
                const name = lobby.court_name || court?.name || "Campo";
                const tone = occupancyTone(lobby.participants_count, lobby.max_players);
                const percent = occupancyPercent(lobby.participants_count, lobby.max_players);
                return (
                  <li key={lobby.id}>
                    <Link
                      href={`/courts/${lobby.court_id}`}
                      aria-label={`${name}, ${lobby.participants_count} su ${lobby.max_players} posti, ore ${formatAppTime(lobby.start_time)}${lobby.series_id ? ", ricorrente" : ""}`}
                      className="relative block overflow-hidden rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-4 pb-5 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                    >
                      <span className="flex items-center gap-3">
                        <CourtPhotoThumb photoPath={court?.photo_path} className="h-14 w-14" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-[var(--text-primary)]">
                            {name}
                          </span>
                          {lobby.series_id ? (
                            <span className="mt-1 flex">
                              <RecurringChip weekday={null} timeOfDay={null} />
                            </span>
                          ) : null}
                          <span className="mt-1 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                            <Users className="w-3.5 h-3.5" aria-hidden="true" />
                            <span style={{ color: tone }}>
                              {lobby.participants_count}/{lobby.max_players}
                            </span>
                            <span aria-hidden="true">•</span>
                            <span>{formatAppTime(lobby.start_time)}</span>
                          </span>
                        </span>
                        <ChevronRight
                          className="w-5 h-5 shrink-0 text-[var(--text-muted)]"
                          aria-hidden="true"
                        />
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-[3px] bg-[var(--border)]"
                      >
                        <span
                          className="block h-full"
                          style={{ width: `${percent}%`, background: tone }}
                        />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </LobbySheet>
      </div>

      {loginMounted && (
        <Suspense fallback={<LoginLoadingFallback onClose={() => setShowLogin(false)} />}>
          <LoginModalLazy open={showLogin} onClose={() => setShowLogin(false)} next={loginNext} />
        </Suspense>
      )}
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
