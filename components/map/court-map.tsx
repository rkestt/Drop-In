"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_PROVIDER, MAP_STYLE_URL, MAP_ATTRIBUTION } from "@/lib/map/provider";
import { getTheme } from "@/lib/theme";

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

export function CourtMap({ courts = [], onCourtSelect, onBoundsChange, reportedCourtIds = [], userLocation = null, locationError = null, ariaLabel = "Mappa dei campi" }: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const courtMarkers = useRef<maplibregl.Marker[]>([]);
  const userMarker = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const lastSizeRef = useRef<{ w: number; h: number } | null>(null);
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

    const initialTheme = getTheme();
    const style =
      MAP_PROVIDER === "openfreemap"
        ? MAP_STYLE_URL[initialTheme]
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
      if (!onBoundsChange) return;
      const b = instance.getBounds();
      onBoundsChange({ n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest() }, instance.getZoom());
    };
    instance.on("load", () => {
      loadedRef.current = true;
      fireBounds();
      requestAnimationFrame(() => instance.resize());
    });
    instance.on("moveend", fireBounds);
    instance.on("zoomend", fireBounds);

    // Segue il tema: cambia stile senza ricreare la mappa.
    const themeObserver = new MutationObserver(() => {
      if (MAP_PROVIDER !== "openfreemap") return;
      const t = getTheme();
      loadedRef.current = true;
      instance.setStyle(MAP_STYLE_URL[t]);
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

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
      window.removeEventListener("resize", resizeHandler);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
    });

    map.current = instance;
  }, [onBoundsChange]);

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
    if (!map.current || courts.length === 0) return;
    removeCourtMarkers();

    const reportedSet = new Set(reportedCourtIds || []);

    courts.forEach((court) => {
      if (!map.current) return;
      const isReported = reportedSet.has(court.id);
      const bgColor = isReported ? "var(--danger)" : "var(--accent)";
      const iconColor = isReported ? "#ffffff" : "white";

      const el = document.createElement("div");
      el.className = "court-marker w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shadow-md border-2 border-white transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2";
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
    <div className="absolute inset-0" role="region" aria-label={ariaLabel}>
      <div ref={mapContainer} className="w-full h-full" />
      {locationError && (
        <div className="absolute top-4 left-4 right-4 bg-[var(--bg-elevated)] rounded-xl p-3 shadow-lg z-10" role="alert" aria-live="polite">
          <p className="text-sm text-[var(--text-secondary)]">{locationError}</p>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-elevated)] z-20">
          <div className="text-center space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">{mapError}</p>
            <button type="button" onClick={handleRetry} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm">
              Riprova
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
