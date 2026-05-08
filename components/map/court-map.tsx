"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface CourtMapProps {
  courts?: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address?: string | null;
    sport?: string | null;
  }>;
  onCourtSelect?: (courtId: string) => void;
  reportedCourtIds?: string[];
  /** courtId → number of active lobbies at this court */
  lobbyCounts?: Record<string, number>;
  /** sport key → { label, color } */
  sportConfig?: Record<string, { label: string; color: string }>;
  /** debug: show count overlay */
  debugCount?: boolean;
}

const ROME_CENTER: [number, number] = [12.5113, 41.8919];

const SOURCE_ID = "courts";
const CIRCLE_LAYER_ID = "courts-circle";
const LABEL_LAYER_ID = "courts-label";

export function CourtMap({ courts = [], onCourtSelect, reportedCourtIds = [], lobbyCounts = {}, sportConfig: _sportConfig }: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Build GeoJSON from courts prop — memoize to avoid re-creating on every render
  const geojson = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: courts.map((court) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [court.lng, court.lat] },
      properties: {
        id: court.id,
        name: court.name,
        address: court.address ?? "",
        lobbyCount: lobbyCounts[court.id] ?? 0,
        isReported: reportedCourtIds.includes(court.id),
        sport: court.sport ?? "basketball",
      },
    })),
  }), [courts, lobbyCounts, reportedCourtIds]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
              "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        },
        layers: [
          { id: "osm", type: "raster", source: "osm" },
        ],
      },
      center: ROME_CENTER,
      zoom: 13,
    });

    map.current = mapInstance;

    mapInstance.on("load", () => {
      // Add court source
      mapInstance.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson,
      });

      // Circle layer — sizes reflect lobby count, colors by sport + reported
      mapInstance.addLayer({
        id: CIRCLE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": [
            "case",
            [">=", ["get", "lobbyCount"], 3], 10,
            [">=", ["get", "lobbyCount"], 2], 9,
            [">=", ["get", "lobbyCount"], 1], 8,
            7,
          ],
          "circle-color": [
            "case",
            ["get", "isReported"], "#ef4444",
            ["==", ["get", "sport"], "basketball"], "#f97316",
            ["==", ["get", "sport"], "volleyball"], "#eab308",
            ["==", ["get", "sport"], "soccer"], "#22c55e",
            ["==", ["get", "sport"], "tennis"], "#06b6d4",
            ["==", ["get", "sport"], "skate"], "#ec4899",
            ["==", ["get", "sport"], "calisthenics"], "#a855f7",
            ["==", ["get", "sport"], "football"], "#84cc16",
            ["==", ["get", "sport"], "rugby"], "#14b8a6",
            ["==", ["get", "sport"], "handball"], "#f43f5e",
            ["==", ["get", "sport"], "badminton"], "#8b5cf6",
            ["==", ["get", "sport"], "baseball"], "#fb923c",
            ["==", ["get", "sport"], "hockey"], "#0ea5e9",
            "#6b7280",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
          "circle-opacity": [
            "case",
            [">=", ["get", "lobbyCount"], 1], 1,
            0.7,
          ],
        },
      });

      // Label: lobby count (only if > 0)
      mapInstance.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: [">=", ["get", "lobbyCount"], 1],
        layout: {
          "text-field": ["to-string", ["get", "lobbyCount"]],
          "text-size": 9,
          "text-font": ["Open Sans Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1,
        },
      });

      // Popup on hover
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 15,
        className: "court-popup",
      });

      setMapLoaded(true);
    });

    mapInstance.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    return () => {
      mapInstance.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync GeoJSON data when courts change
  useEffect(() => {
    if (!map.current || !mapLoaded) return;
    const source = map.current.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(geojson);
    }
  }, [geojson, mapLoaded]);

  // Sync circle paint when reported/lobby/sport data changes (no full redraw needed)
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    // Re-color: reported courts red, otherwise sport color
    map.current.setPaintProperty(CIRCLE_LAYER_ID, "circle-color", [
      "case",
      ["get", "isReported"], "#ef4444",
      ["==", ["get", "sport"], "basketball"], "#f97316",
      ["==", ["get", "sport"], "volleyball"], "#eab308",
      ["==", ["get", "sport"], "soccer"], "#22c55e",
      ["==", ["get", "sport"], "tennis"], "#06b6d4",
      ["==", ["get", "sport"], "skate"], "#ec4899",
      ["==", ["get", "sport"], "calisthenics"], "#a855f7",
      ["==", ["get", "sport"], "football"], "#84cc16",
      ["==", ["get", "sport"], "rugby"], "#14b8a6",
      ["==", ["get", "sport"], "handball"], "#f43f5e",
      ["==", ["get", "sport"], "badminton"], "#8b5cf6",
      ["==", ["get", "sport"], "baseball"], "#fb923c",
      ["==", ["get", "sport"], "hockey"], "#0ea5e9",
      "#6b7280",
    ]);
  }, [reportedCourtIds, lobbyCounts, mapLoaded]);

  // Click handler
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const features = map.current!.queryRenderedFeatures(e.point, {
        layers: [CIRCLE_LAYER_ID],
      });
      if (!features.length) return;
      const props = features[0].properties;
      if (!props?.id) return;
      popupRef.current?.remove();
      onCourtSelect?.(props.id);
    };

    const handleMouseEnter = (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = "pointer";

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: [CIRCLE_LAYER_ID],
      });
      if (!features.length) return;
      const props = features[0].properties;
      if (!props) return;

      const lng = (features[0].geometry as GeoJSON.Point).coordinates[0];
      const lat = (features[0].geometry as GeoJSON.Point).coordinates[1];

      const html = `
        <div style="font-family: inherit; padding: 2px 0;">
          <strong style="font-size: 13px;">${props.name}</strong>
          ${props.lobbyCount > 0 ? `<div style="font-size: 11px; color: #22c55e; margin-top: 2px;">● ${props.lobbyCount} lobby attiv${props.lobbyCount === 1 ? "a" : "e"}</div>` : ""}
        </div>
      `;

      popupRef.current
        ?.setLngLat([lng, lat])
        .setHTML(html)
        .addTo(map.current!);
    };

    const handleMouseLeave = () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = "";
      popupRef.current?.remove();
    };

    map.current.on("click", handleClick);
    map.current.on("mouseenter", CIRCLE_LAYER_ID, handleMouseEnter);
    map.current.on("mouseleave", CIRCLE_LAYER_ID, handleMouseLeave);

    return () => {
      if (!map.current) return;
      map.current.off("click", handleClick);
      map.current.off("mouseenter", CIRCLE_LAYER_ID, handleMouseEnter);
      map.current.off("mouseleave", CIRCLE_LAYER_ID, handleMouseLeave);
    };
  }, [mapLoaded, onCourtSelect]);

  // User location marker — separate DOM element, no zoom jank concern
  useEffect(() => {
    if (!map.current) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([longitude, latitude]);
          map.current?.flyTo({
            center: [longitude, latitude],
            zoom: 15,
            duration: 1000,
          });

          userMarkerRef.current?.remove();

          const el = document.createElement("div");
          el.style.width = "16px";
          el.style.height = "16px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = "#3b82f6";
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
          el.style.pointerEvents = "none";
          el.style.position = "relative";

          // Pulsing outer ring
          const ring = document.createElement("div");
          ring.style.position = "absolute";
          ring.style.top = "-4px";
          ring.style.left = "-4px";
          ring.style.width = "24px";
          ring.style.height = "24px";
          ring.style.borderRadius = "50%";
          ring.style.border = "2px solid rgba(59,130,246,0.5)";
          ring.style.animation = "ping 1.5s cubic-bezier(0,0,0.2,1) infinite";
          el.appendChild(ring);

          userMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat([longitude, latitude])
            .addTo(map.current!);
        },
        () => {
          setLocationError("Posizione non disponibile. Centro su Roma.");
        }
      );
    }
  }, []);

  return (
    <div
      className="relative w-full"
      style={{ height: "clamp(280px, 60dvh, 600px)" }}
      role="region"
      aria-label="Mappa dei campi"
    >
      <div ref={mapContainer} className="w-full h-full" />
      {locationError && (
        <div
          className="absolute top-4 left-4 right-4 bg-[var(--bg-elevated)] rounded-xl p-3 shadow-lg z-10"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-[var(--text-secondary)]">{locationError}</p>
        </div>
      )}
      {/* Inject ping animation for user location pulse */}
      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(1.5); opacity: 0; }
          0% { transform: scale(1); opacity: 0.5; }
        }
        .court-popup .maplibregl-popup-content {
          background: var(--bg-elevated, #1e1e2e);
          color: var(--text-primary, #e2e8f0);
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
          font-family: inherit;
          font-size: 13px;
          border: 1px solid rgba(255,255,255,0.1);
        }
        .court-popup .maplibregl-popup-tip {
          border-top-color: var(--bg-elevated, #1e2e1e);
        }
      `}</style>
    </div>
  );
}
