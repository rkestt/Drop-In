"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_PROVIDER, MAP_STYLE_URL, MAP_ATTRIBUTION } from "@/lib/map/provider";
import {
  BOLLARD_CLASSES,
  BOLLARD_ICON_ID,
  GATE_CLASSES,
  GATE_ICON_ID,
  registerBarrierIcons,
  type BarrierIconUris,
} from "@/lib/map/icons";

interface CourtMapProps {
  courts?: Array<{ id: string; name: string; lat: number; lng: number; address?: string | null }>;
  onCourtSelect?: (courtId: string) => void;
  onBoundsChange?: (bounds: { n: number; s: number; e: number; w: number }, zoom: number) => void;
  reportedCourtIds?: string[];
  userLocation?: [number, number] | null;
  locationError?: string | null;
  ariaLabel?: string;
}

const ROME_CENTER: [number, number] = [12.5113, 41.8919];

declare global {
  interface Window {
    __dropinMap?: maplibregl.Map | null;
    __dropinBarrierIconUris?: BarrierIconUris | null;
  }
}

let barrierSetupWarned = false;

function warnBarrierSetupOnce(message: string): void {
  if (barrierSetupWarned) return;
  barrierSetupWarned = true;
  console.warn(message);
}

const BARRIER_LAYER_ID = "dropin-barriers";

// Gap-filler sopra i tile OpenFreeMap (maxzoom 14, overzoom oltre): lo
// stile Liberty mostra i POI barriera per rank (poi_r7 a z16 copre solo
// rank 7-19), quindi a z16 quasi tutte le barriere mancherebbero. Questo
// layer le disegna tutte da z16 con le icone inline. A z17+ c'e' doppio
// disegno con poi_r20: stessa immagine e ancora; size 0.8 vs 1.0 stock e
// overlap nostro: a z17 le icone stock crescono e possono cullare, il
// nostro layer resta sotto — salto lieve accettato.
function addBarrierLayer(map: maplibregl.Map): void {
  const spec = {
    id: BARRIER_LAYER_ID,
    type: "symbol",
    source: "openmaptiles",
    "source-layer": "poi",
    minzoom: 16,
    filter: [
      "match",
      ["get", "class"],
      [...GATE_CLASSES, ...BOLLARD_CLASSES],
      true,
      false,
    ],
    layout: {
      "icon-image": [
        "match",
        ["get", "class"],
        [...GATE_CLASSES],
        GATE_ICON_ID,
        BOLLARD_ICON_ID,
      ],
      "icon-size": 0.8,
      "icon-allow-overlap": true,
    },
  } as unknown as maplibregl.LayerSpecification;
  // I marker dei campi sono DOM (sempre sopra il canvas); il layer va
  // comunque sotto le etichette di luogo per non coprirle.
  const beforeId = map
    .getStyle()
    ?.layers.find((layer) => layer.type === "symbol")?.id;
  if (beforeId) map.addLayer(spec, beforeId);
  else map.addLayer(spec);
}

// Registra le icone inline gate/bollard e aggiunge il layer
// dropin-barriers. Idempotente e mai fatale: se le icone o la sorgente
// mancano, la mappa continua a funzionare senza il layer.
function setupBarrierLayer(map: maplibregl.Map): void {
  if (MAP_PROVIDER !== "openfreemap") return;
  window.__dropinMap = map;
  // Prima le icone, poi il layer: aggiungerlo prima causerebbe
  // "Image gate/bollard could not be loaded" in console.
  void registerBarrierIcons(map)
    .then((uris) => {
      window.__dropinBarrierIconUris = uris;
      try {
        if (map.getLayer(BARRIER_LAYER_ID)) return;
        if (!map.hasImage(GATE_ICON_ID) || !map.hasImage(BOLLARD_ICON_ID)) {
          warnBarrierSetupOnce("[map] barrier icons missing, skipping dropin-barriers");
          return;
        }
        if (!map.getSource("openmaptiles")) {
          warnBarrierSetupOnce("[map] openmaptiles source missing, skipping dropin-barriers");
          return;
        }
        addBarrierLayer(map);
      } catch {
        warnBarrierSetupOnce("[map] could not add dropin-barriers layer");
      }
    })
    .catch(() => {
      warnBarrierSetupOnce("[map] barrier icon registration failed");
    });
}

export function CourtMap({ courts = [], onCourtSelect, onBoundsChange, reportedCourtIds = [], userLocation = null, locationError = null, ariaLabel = "Mappa dei campi" }: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const courtMarkers = useRef<maplibregl.Marker[]>([]);
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
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const removeCourtMarkers = useCallback(() => {
    courtMarkers.current.forEach((m) => m.remove());
    courtMarkers.current = [];
  }, []);

  const createMap = useCallback(() => {
    if (!mapContainer.current) return;
    if (mapContainer.current.clientWidth === 0 || mapContainer.current.clientHeight === 0) return;
    if (map.current) return;
    setMapError(null);

    const style =
      MAP_PROVIDER === "openfreemap"
        ? MAP_STYLE_URL.light
        : {
            version: 8 as const,
            sources: {
              osm: {
                type: "raster",
                tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              },
            },
            layers: [{ id: "osm", type: "raster", source: "osm" }],
          };

    const instance = new maplibregl.Map({
      container: mapContainer.current,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      style: style as any,
      center: ROME_CENTER,
      zoom: 14,
      attributionControl: { compact: false, customAttribution: MAP_ATTRIBUTION as unknown as string },
    });

    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    const canvas = instance.getCanvas();
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setMapError("Contesto WebGL perso. Riprova a caricare la mappa.");
    };
    const onContextRestored = () => {
      setRetryKey((k) => k + 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    canvas.addEventListener("webglcontextrestored", onContextRestored, false);

    instance.on("error", () => {
      if (!loadedRef.current) setMapError("Impossibile caricare la mappa. Riprova.");
      else console.warn("Map tile error");
    });

    const fireBounds = () => {
      const cb = onBoundsChangeRef.current;
      if (!cb) return;
      const b = instance.getBounds();
      cb({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() }, instance.getZoom());
    };
    instance.on("load", () => {
      loadedRef.current = true;
      setupBarrierLayer(instance);
      fireBounds();
      requestAnimationFrame(() => instance.resize());
    });
    instance.on("moveend", fireBounds);
    instance.on("zoomend", fireBounds);

    const resizeHandler = () => instance.resize();
    window.addEventListener("resize", resizeHandler);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) return;
      const last = lastSizeRef.current;
      if (last && last.w === width && last.h === height) return;
      lastSizeRef.current = { w: width, h: height };
      instance.resize();
    });
    if (mapContainer.current) resizeObserver.observe(mapContainer.current);

    instance.on("remove", () => {
      if (window.__dropinMap === instance) window.__dropinMap = null;
      window.removeEventListener("resize", resizeHandler);
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    });

    map.current = instance;
  }, []);

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
        removeCourtMarkers();
        if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
        if (map.current) { map.current.remove(); map.current = null; }
      };
    }
    createMap();
    return () => {
      loadedRef.current = false;
      lastSizeRef.current = null;
      removeCourtMarkers();
      if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [createMap, retryKey, removeCourtMarkers]);

  useEffect(() => {
    if (!map.current || !userLocation) return;
    map.current.flyTo({ center: userLocation, zoom: 15, duration: 1000 });
    if (userMarker.current) userMarker.current.remove();
    userMarker.current = new maplibregl.Marker({ color: "#3b82f6" })
      .setLngLat(userLocation)
      .addTo(map.current);
  }, [userLocation, retryKey]);

  useEffect(() => {
    if (!map.current) return;
    // Lista vuota = niente marker: con la ricerca attiva i risultati possono
    // essere zero e i marker del browse non devono restare sulla mappa.
    removeCourtMarkers();
    if (courts.length === 0) return;

    const reportedSet = new Set(reportedCourtIds || []);

    courts.forEach((court) => {
      if (!map.current) return;
      const isReported = reportedSet.has(court.id);
      const bgColor = isReported ? "var(--danger)" : "var(--accent)";
      const iconColor = isReported ? "#ffffff" : "white";

      const el = document.createElement("div");
      el.className = "court-marker w-11 h-11 rounded-full flex items-center justify-center cursor-pointer shadow-md border-2 border-white transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";
      el.style.backgroundColor = bgColor;
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Campo: ${court.name}${court.address ? `, ${court.address}` : ""}`);

      if (isReported) {
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>`;
      }

      const activateCourt = () => onCourtSelect?.(court.id);
      el.addEventListener("click", activateCourt);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateCourt();
        }
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([court.lng, court.lat])
        .addTo(map.current);
      courtMarkers.current.push(marker);
    });
  }, [courts, onCourtSelect, reportedCourtIds, removeCourtMarkers, retryKey]);

  const handleRetry = useCallback(() => {
    loadedRef.current = false;
    lastSizeRef.current = null;
    removeCourtMarkers();
    if (userMarker.current) { userMarker.current.remove(); userMarker.current = null; }
    if (map.current) {
      map.current.remove();
      map.current = null;
    }
    setRetryKey((k) => k + 1);
  }, [removeCourtMarkers]);

  return (
    <div
      className="absolute inset-0"
      role="region"
      aria-label={ariaLabel}
      // Screenshot visual: canvas WebGL, tile di rete, marker e controlli
      // non sono deterministici → il confronto li ignora (grigio uniforme).
      data-visual-mask
    >
      <div ref={mapContainer} className="w-full h-full" />
      {locationError && (
        <div className="absolute top-4 start-4 end-4 bg-[var(--bg-elevated)] rounded-card p-3 shadow-lg z-10" role="alert" aria-live="polite">
          <p className="text-sm text-[var(--text-secondary)]">{locationError}</p>
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
    </div>
  );
}
