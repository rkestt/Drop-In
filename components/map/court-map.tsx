"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  MAP_PROVIDER,
  MAP_STYLE_URL,
  OSM_RASTER_STYLE,
} from "@/lib/map/provider";
import { applyStyleFilterGuards, setupBarrierLayer } from "@/lib/map/barriers";
import { cssTokenColor } from "@/lib/map/icons";
import { readCourtPalette } from "@/lib/map/palette";
import { attachCourtInteractions } from "@/lib/map/interactions";
import { handleMapKey } from "@/lib/map/keyboard";
import { trackMapSize } from "@/lib/map/resize";
import { watchTileErrors, type TileErrorWatch } from "@/lib/map/tile-watch";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_MIN_POINTS,
  CLUSTER_RADIUS,
  COURT_SOURCE_ID,
  buildCourtFeatureCollection,
  buildCourtLayers,
  type CourtMarkerInput,
  type CourtPalette,
} from "@/lib/map/court-features";
import { Button } from "@/components/ui/button";
import { List } from "lucide-react";
import { CourtPreviewSheet } from "./court-preview-sheet";
import { MapCourtList } from "./map-court-list";

export interface CourtMapCourt extends CourtMarkerInput {
  sport?: string | null;
  surface_type?: string | null;
  photo_path?: string | null;
}

interface CourtMapProps {
  courts?: CourtMapCourt[];
  /** Chiamato con l'id all'apertura dell'anteprima e con null alla chiusura. */
  onCourtSelect?: (courtId: string | null) => void;
  onBoundsChange?: (bounds: { n: number; s: number; e: number; w: number }, zoom: number) => void;
  reportedCourtIds?: string[];
  favoriteCourtIds?: string[];
  /** Lobby attive per campo (id campo → numero). */
  lobbyCounts?: Record<string, number>;
  userLocation?: [number, number] | null;
  locationError?: string | null;
  ariaLabel?: string;
}

const ROME_CENTER: [number, number] = [12.5113, 41.8919];
const MAP_HINT_ID = "map-keyboard-hint";

const EMPTY_COURTS: CourtMapCourt[] = [];
const EMPTY_IDS: string[] = [];
const EMPTY_LOBBY_COUNTS: Record<string, number> = {};

/**
 * Mappa dei campi.
 *
 * Il componente possiede solo il ciclo di vita dell'istanza e il wiring React
 * (dati → source, overlays, focus). Marker/cluster vivono in
 * `lib/map/court-features.ts`, tastiera in `keyboard.ts`, click/hover in
 * `interactions.ts`, errori tile in `tile-watch.ts`, barriere in
 * `barriers.ts`. La documentazione è in `docs/map.md`.
 */
export function CourtMap({
  courts = EMPTY_COURTS,
  onCourtSelect,
  onBoundsChange,
  reportedCourtIds = EMPTY_IDS,
  favoriteCourtIds = EMPTY_IDS,
  lobbyCounts = EMPTY_LOBBY_COUNTS,
  userLocation = null,
  locationError = null,
  ariaLabel = "Mappa dei campi",
}: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);
  // onBoundsChange arriva da page.tsx con una nuova identità a ogni cambio
  // sport: tenerlo fuori dalle deps di createMap evita il teardown/ricreazione
  // della mappa (reset viewport). fireBounds legge sempre l'ultimo via ref.
  const onBoundsChangeRef = useRef(onBoundsChange);
  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);
  const onCourtSelectRef = useRef(onCourtSelect);
  useEffect(() => {
    onCourtSelectRef.current = onCourtSelect;
  }, [onCourtSelect]);

  const [mapError, setMapError] = useState<string | null>(null);
  const [tileBannerVisible, setTileBannerVisible] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [previewCourtId, setPreviewCourtId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const tileWatchRef = useRef<TileErrorWatch | null>(null);
  const paletteRef = useRef<CourtPalette | null>(null);
  const interactionsRef = useRef<{ resetHover: () => void } | null>(null);
  const listButtonRef = useRef<HTMLButtonElement>(null);
  const restoreListFocus = useRef(false);

  const favoriteIds = useMemo(() => new Set(favoriteCourtIds), [favoriteCourtIds]);
  const reportedIds = useMemo(() => new Set(reportedCourtIds), [reportedCourtIds]);

  const features = useMemo(
    () =>
      buildCourtFeatureCollection(courts, {
        selectedId: previewCourtId,
        favoriteIds,
        reportedIds,
        lobbyCounts,
      }),
    [courts, previewCourtId, favoriteIds, reportedIds, lobbyCounts]
  );
  const featuresRef = useRef(features);

  const previewCourt = useMemo(
    () =>
      previewCourtId == null
        ? null
        : courts.find((court) => court.id === previewCourtId) ?? null,
    [courts, previewCourtId]
  );

  const selectCourt = useCallback((courtId: string | null) => {
    setPreviewCourtId(courtId);
    onCourtSelectRef.current?.(courtId);
  }, []);

  const ensureCourtLayers = useCallback((instance: maplibregl.Map) => {
    if (!instance.getStyle()) return;
    if (!instance.getSource(COURT_SOURCE_ID)) {
      try {
        instance.addSource(COURT_SOURCE_ID, {
          type: "geojson",
          data: featuresRef.current,
          cluster: true,
          clusterRadius: CLUSTER_RADIUS,
          clusterMaxZoom: CLUSTER_MAX_ZOOM,
          clusterMinPoints: CLUSTER_MIN_POINTS,
          // `courtId` diventa il feature id: serve a setFeatureState (hover).
          promoteId: "courtId",
        });
      } catch (err) {
        console.warn("[map] court source non aggiunta", err);
        return;
      }
    }
    const palette = paletteRef.current ?? readCourtPalette();
    paletteRef.current = palette;
    // Lo stile raster OSM di fallback non ha i glyphs: i layer con testo
    // (conteggi lobby/cluster, "!") non possono renderizzare. Meglio non
    // aggiungerli che riempire la console di errori di glyph.
    const supportsLabels = Boolean(instance.getStyle()?.glyphs);
    // Ordine di disegno: halo sotto, poi punti ed etichette, cluster sopra.
    for (const spec of buildCourtLayers(palette)) {
      if (!supportsLabels && spec.type === "symbol") continue;
      if (instance.getLayer(spec.id)) continue;
      try {
        instance.addLayer(spec as unknown as maplibregl.LayerSpecification);
      } catch (err) {
        console.warn("[map] court layer non aggiunto", spec.id, err);
      }
    }
  }, []);

  const createMap = useCallback(() => {
    const container = mapContainer.current;
    if (!container) return;
    if (container.clientWidth === 0 || container.clientHeight === 0) return;
    if (map.current) return;
    setMapError(null);
    paletteRef.current = readCourtPalette();

    const style: string | maplibregl.StyleSpecification =
      MAP_PROVIDER === "openfreemap"
        ? MAP_STYLE_URL.light
        : (OSM_RASTER_STYLE as unknown as maplibregl.StyleSpecification);

    const instance = new maplibregl.Map({
      container,
      style,
      center: ROME_CENTER,
      zoom: 14,
      // Attribuzione: la fornisce lo stile (Liberty) o la source raster OSM.
      // Passarla anche come customAttribution la duplicava su due righe (#79).
      attributionControl: { compact: false },
    });

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    // La mappa e' un solo tab stop (il contenitore): il canvas e' decorativo
    // e la tastiera la gestisce il contenitore, non l'handler di MapLibre.
    instance.keyboard.disable();
    const canvas = instance.getCanvas();
    canvas.setAttribute("aria-hidden", "true");
    canvas.setAttribute("tabindex", "-1");

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setMapError("Contesto WebGL perso. Riprova a caricare la mappa.");
    };
    const onContextRestored = () => {
      setRetryKey((k) => k + 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    tileWatchRef.current = watchTileErrors(instance, {
      isLoaded: () => loadedRef.current,
      onPreLoadError: () => setMapError("Impossibile caricare la mappa. Riprova."),
      onBannerChange: setTileBannerVisible,
    });

    const fireBounds = () => {
      const cb = onBoundsChangeRef.current;
      if (!cb) return;
      const b = instance.getBounds();
      cb({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() }, instance.getZoom());
    };
    instance.on("load", () => {
      loadedRef.current = true;
      applyStyleFilterGuards(instance);
      setupBarrierLayer(instance);
      ensureCourtLayers(instance);
      fireBounds();
      requestAnimationFrame(() => instance.resize());
    });
    // Sopravvive a setStyle: la guardia e' idempotente, source e layer dei
    // campi vengono ricreati perche' setStyle li rimuove (e con loro i
    // feature-state: si azzera anche l'hover tracciato in interactions).
    instance.on("style.load", () => {
      applyStyleFilterGuards(instance);
      ensureCourtLayers(instance);
      interactionsRef.current?.resetHover();
    });
    instance.on("moveend", fireBounds);
    instance.on("zoomend", fireBounds);

    interactionsRef.current = attachCourtInteractions(instance, selectCourt);
    const stopSize = trackMapSize(instance, container, lastSizeRef);

    instance.on("remove", () => {
      if (window.__dropinMap === instance) window.__dropinMap = null;
      stopSize();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    });

    map.current = instance;
  }, [ensureCourtLayers, selectCourt]);

  useEffect(() => {
    // La FeatureCollection e' calcolata in render, ma la source esiste solo
    // dopo il load: il ref tiene l'ultima versione per style.load/retry; se la
    // source c'e' gia', setData senza ricreare nulla (selezione, dati, hover).
    featuresRef.current = features;
    const instance = map.current;
    if (!instance) return;
    const source = instance.getSource(COURT_SOURCE_ID);
    if (source && "setData" in source) {
      (source as maplibregl.GeoJSONSource).setData(features);
    }
  }, [features]);

  useEffect(() => {
    // Un refetch (pan, ricerca svuotata) puo' togliere il campo dall'elenco:
    // l'anteprima di un campo che non esiste piu' non deve restare aperta.
    if (previewCourtId != null && previewCourt == null) selectCourt(null);
  }, [previewCourtId, previewCourt, selectCourt]);

  useEffect(() => {
    if (mapContainer.current && (mapContainer.current.clientWidth === 0 || mapContainer.current.clientHeight === 0)) {
      const obs = new ResizeObserver(() => {
        if (mapContainer.current && mapContainer.current.clientWidth > 0 && mapContainer.current.clientHeight > 0) {
          createMap();
          if (map.current) obs.disconnect();
        }
      });
      obs.observe(mapContainer.current);
      return () => {
        obs.disconnect();
        loadedRef.current = false;
        lastSizeRef.current = null;
        if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
        if (map.current) { map.current.remove(); map.current = null; }
      };
    }
    createMap();
    return () => {
      loadedRef.current = false;
      lastSizeRef.current = null;
      if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [createMap, retryKey]);

  useEffect(() => {
    if (!map.current || !userLocation) return;
    if (!Number.isFinite(userLocation[0]) || !Number.isFinite(userLocation[1])) return;
    map.current.flyTo({ center: userLocation, zoom: 15, duration: 1000 });
    if (userMarker.current) userMarker.current.remove();
    userMarker.current = new maplibregl.Marker({
      color: cssTokenColor("--success", "teal"),
    })
      .setLngLat(userLocation)
      .addTo(map.current);
  }, [userLocation, retryKey]);

  const handleRetry = useCallback(() => {
    loadedRef.current = false;
    lastSizeRef.current = null;
    setTileBannerVisible(false);
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    setRetryKey((k) => k + 1);
  }, []);

  const dismissTileBanner = useCallback(() => {
    tileWatchRef.current?.dismiss();
    setTileBannerVisible(false);
  }, []);

  const closeList = useCallback(() => {
    // Il ritorno del focus e' esplicito: il pannello non fa trap. Il bottone
    // non e' montato mentre la lista e' aperta, quindi il focus si sposta
    // dopo il render (effect qui sotto), non subito.
    restoreListFocus.current = true;
    setListOpen(false);
  }, []);

  useEffect(() => {
    if (listOpen || !restoreListFocus.current) return;
    restoreListFocus.current = false;
    listButtonRef.current?.focus();
  }, [listOpen]);

  const handleListSelect = useCallback(
    (courtId: string) => {
      setListOpen(false);
      const instance = map.current;
      const court = courts.find((item) => item.id === courtId);
      if (instance && court) {
        instance.easeTo({
          center: [court.lng, court.lat],
          zoom: Math.max(instance.getZoom(), 15),
          duration: 600,
        });
      }
      selectCourt(courtId);
    },
    [courts, selectCourt]
  );

  const handleMapKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const instance = map.current;
      if (!instance) return;
      const handled = handleMapKey(instance, event.key, {
        userLocation,
        fallbackCenter: ROME_CENTER,
      });
      if (handled) event.preventDefault();
    },
    [userLocation]
  );

  const previewLobbyCount =
    previewCourt == null ? 0 : lobbyCounts[previewCourt.id] ?? 0;
  const previewReported =
    previewCourt == null ? false : reportedIds.has(previewCourt.id);
  const previewFavorite =
    previewCourt == null ? false : favoriteIds.has(previewCourt.id);

  return (
    <div
      className="absolute inset-0"
      role="region"
      aria-label={ariaLabel}
      // Screenshot visual: canvas WebGL, tile di rete, marker e controlli
      // non sono deterministici → il confronto li ignora (grigio uniforme).
      data-visual-mask
    >
      <div
        ref={mapContainer}
        tabIndex={0}
        role="group"
        aria-label="Area mappa interattiva"
        aria-describedby={MAP_HINT_ID}
        onKeyDown={handleMapKeyDown}
        className="h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--focus-ring)]"
      />
      <p id={MAP_HINT_ID} className="sr-only">
        Usa le frecce per spostare la mappa, più e meno per lo zoom, Home per
        tornare al centro. Il pulsante Lista campi apre l&apos;elenco dei campi
        visibili.
      </p>

      {locationError && (
        <div className="absolute top-4 start-4 end-4 bg-[var(--bg-elevated)] rounded-card p-3 shadow-lg z-10" role="alert" aria-live="polite">
          <p className="text-sm text-[var(--text-secondary)]">{locationError}</p>
        </div>
      )}

      {courts.length > 0 && !listOpen && (
        <div className="absolute bottom-4 start-3 z-20">
          <button
            ref={listButtonRef}
            type="button"
            onClick={() => setListOpen(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-chip border border-[var(--border-strong)] bg-[var(--bg-elevated)] px-3 text-sm font-semibold text-[var(--text-primary)] shadow-md hover:bg-[var(--bg-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            <List className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            Lista campi
          </button>
        </div>
      )}

      {listOpen && (
        <MapCourtList
          courts={courts}
          selectedId={previewCourtId}
          onSelect={handleListSelect}
          onClose={closeList}
        />
      )}

      {tileBannerVisible && (
        <div
          className="absolute bottom-20 start-3 end-20 z-20 max-w-[360px] rounded-card border border-[var(--warning)]/40 bg-[var(--bg-elevated)] p-3 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-[var(--text-primary)]">
            La mappa non si sta caricando bene: alcune zone possono mancare.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={handleRetry}>
              Riprova
            </Button>
            <Button size="sm" variant="ghost" onClick={dismissTileBanner}>
              Chiudi
            </Button>
          </div>
        </div>
      )}

      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-elevated)] z-20">
          <div className="text-center space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">{mapError}</p>
            <button type="button" onClick={handleRetry} className="px-4 py-2 rounded-control-sm bg-[var(--accent)] text-[var(--accent-foreground)] text-sm">
              Riprova
            </button>
          </div>
        </div>
      )}

      <CourtPreviewSheet
        open={previewCourt != null}
        court={previewCourt}
        lobbyCount={previewLobbyCount}
        reported={previewReported}
        favorite={previewFavorite}
        onClose={() => selectCourt(null)}
        finalFocus={mapContainer}
      />
    </div>
  );
}
