"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface LobbyInfo {
  id: string;
  court_id: string;
  start_time: string;
  max_players: number;
  participants_count: number;
  sport?: string;
}

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
  lobbyCounts?: Record<string, number>;
  lobbies?: LobbyInfo[];
  sportConfig?: Record<string, { label: string; color: string }>;
  debugCount?: boolean;
}

const ROME_CENTER: [number, number] = [12.5113, 41.8919];

const SOURCE_ID = "courts";
const CLUSTER_LAYER_ID = "clusters";
const CLUSTER_COUNT_LAYER_ID = "cluster-count";
const CIRCLE_LAYER_ID = "courts-circle";
const LABEL_LAYER_ID = "courts-label";

// Sport colors map
const SPORT_COLORS: Record<string, string> = {
  basketball: "#f97316",
  volleyball: "#eab308",
  soccer: "#22c55e",
  tennis: "#06b6d4",
  skate: "#ec4899",
  calisthenics: "#a855f7",
  football: "#84cc16",
  rugby: "#14b8a6",
  handball: "#f43f5e",
  badminton: "#8b5cf6",
  baseball: "#fb923c",
  hockey: "#0ea5e9",
};

const SPORTS_LIST = Object.keys(SPORT_COLORS);

// Create shadow layer paint for a given sport
const getMarkerShadowPaint = (sport: string) => {
  const color = SPORT_COLORS[sport] || "#6b7280";
  return {
    "circle-color": color,
    "circle-radius": 18,
    "circle-opacity": 0.25,
    "circle-blur": 0.7,
  };
};

// Create main marker paint for a given sport
const getMarkerPaint = (sport: string) => {
  const color = SPORT_COLORS[sport] || "#6b7280";
  return {
    "circle-color": color,
    "circle-radius": 10,
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-opacity": 0.95,
  };
};

// Cluster paint - blue with white border and shadow effect
const CLUSTER_PAINT = {
  "circle-color": "#3b82f6",
  "circle-radius": 24,
  "circle-stroke-width": 3,
  "circle-stroke-color": "#ffffff",
  "circle-opacity": 0.9,
};

const getLabelLayout = () => ({
  "text-field": "{point_count_abbreviated}",
  "text-font": ["Arial Unicode MS Bold", "Open Sans Bold"] as [string, string],
  "text-size": 14,
  "text-anchor": "center" as const,
});

export function CourtMap({ courts = [], onCourtSelect, reportedCourtIds = [], lobbyCounts = {}, lobbies = [], sportConfig: _sportConfig }: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{
    show: boolean;
    clusterId?: number;
    pointCount?: number;
    expansionZoom?: number;
    currentZoom?: number;
    points?: Array<{ lng: number; lat: number; sport: string; name: string }>;
  } | null>(null);

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
      // Add court source with clustering
      mapInstance.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Cluster outer ring (shadow/glow effect)
      mapInstance.addLayer({
        id: CLUSTER_LAYER_ID + "-outer",
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#1e3a5f",
          "circle-radius": 36,
          "circle-opacity": 0.3,
          "circle-blur": 0.8,
        },
      });

      // Cluster main circle
      mapInstance.addLayer({
        id: CLUSTER_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        paint: CLUSTER_PAINT,
      });

      // Cluster count labels
      mapInstance.addLayer({
        id: CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["has", "point_count"],
        layout: getLabelLayout(),
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#1e3a5f",
          "text-halo-width": 3,
        },
      });

      // Add marker layers for each sport type (inside mapInstance.on callback)
      SPORTS_LIST.forEach((sport) => {
        // Shadow layer
        mapInstance.addLayer({
          id: `${CIRCLE_LAYER_ID}-${sport}-shadow`,
          type: "circle",
          source: SOURCE_ID,
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "sport"], sport]],
          paint: getMarkerShadowPaint(sport),
        });

        // Main circle layer
        mapInstance.addLayer({
          id: `${CIRCLE_LAYER_ID}-${sport}`,
          type: "circle",
          source: SOURCE_ID,
          filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "sport"], sport]],
          paint: getMarkerPaint(sport),
        });
      });

      // Label: lobby count (only if > 0, unclustered points only)
      mapInstance.addLayer({
        id: LABEL_LAYER_ID,
        type: "symbol",
        source: SOURCE_ID,
        filter: ["all", ["!", ["has", "point_count"]], [">=", ["get", "lobbyCount"], 1]],
        layout: {
          "text-field": ["to-string", ["get", "lobbyCount"]],
          "text-size": 9,
          "text-font": ["Open Sans Bold"] as [string],
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

  // Click handler - handles both clusters and individual markers
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;

      console.log("[DEBUG] Map clicked at:", e.lngLat);

      // Check for cluster click first (check both outer and inner layers)
      const clusterLayerIds = [CLUSTER_LAYER_ID, CLUSTER_LAYER_ID + "-outer"].filter(layerId => {
        if (!map.current) return false;
        const layer = map.current.getLayer(layerId);
        return !!layer;
      });

      const clusterFeatures = clusterLayerIds.length > 0
        ? map.current.queryRenderedFeatures(e.point, {
            layers: clusterLayerIds,
          })
        : [];

      console.log("[DEBUG] Cluster features found:", clusterFeatures.length);
      
      if (clusterFeatures.length) {
        const coords = clusterFeatures[0].geometry;
        if (coords && coords.type === "Point") {
          const coordinates = coords.coordinates as [number, number];
          const currentZoom = map.current.getZoom();
          const clusterId = clusterFeatures[0].properties?.cluster_id;
          const pointCount = clusterFeatures[0].properties?.point_count ?? 0;

          console.log("[DEBUG] Cluster clicked:", { clusterId, pointCount, coordinates });

          // Get source to get cluster expansion zoom and leaves
          const source = map.current.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;

          if (source && clusterId !== undefined) {
            // Get all points in cluster first
            source.getClusterLeaves(clusterId, 1000, 0).then(leaves => {
              console.log("[DEBUG] Cluster leaves:", leaves);
              const pointsArray = leaves?.map(leaf => ({
                lng: (leaf.geometry as GeoJSON.Point).coordinates[0],
                lat: (leaf.geometry as GeoJSON.Point).coordinates[1],
                sport: leaf.properties?.sport ?? "unknown",
                name: leaf.properties?.name ?? "unknown",
              })) ?? [];

              // Get expansion zoom
              return source.getClusterExpansionZoom(clusterId).then(zoom => {
                console.log("[DEBUG] Expansion zoom:", zoom);
                setDebugInfo({
                  show: true,
                  clusterId,
                  pointCount,
                  expansionZoom: zoom,
                  currentZoom: currentZoom + 2,
                  points: pointsArray,
                });

                setTimeout(() => setDebugInfo(null), 8000);
              });
            }).catch(err => {
              console.error("[DEBUG] Cluster error:", err);
              setDebugInfo({
                show: true,
                clusterId,
                pointCount,
                expansionZoom: currentZoom + 2,
                currentZoom: currentZoom + 2,
                points: [],
              });
              setTimeout(() => setDebugInfo(null), 8000);
            });
          } else {
            console.log("[DEBUG] No source or clusterId:", { source: !!source, clusterId });
            setDebugInfo({
              show: true,
              clusterId,
              pointCount,
              expansionZoom: currentZoom + 2,
              currentZoom: currentZoom + 2,
              points: [],
            });
            setTimeout(() => setDebugInfo(null), 8000);
          }

          map.current.easeTo({
            center: coordinates,
            zoom: Math.min(currentZoom + 2, 18),
          });
        }
        return;
      }

      // Check for individual marker click (query all sport layers)
      const sportLayers = SPORTS_LIST.flatMap(s => [
        `${CIRCLE_LAYER_ID}-${s}`,
        `${CIRCLE_LAYER_ID}-${s}-shadow`
      ]).filter(layerId => {
        // Only query layers that exist
        if (!map.current) return false;
        const layer = map.current.getLayer(layerId);
        return !!layer;
      });

      if (sportLayers.length === 0) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: sportLayers,
      });
      if (!features.length) return;
      const feature = features[0];
      const props = feature.properties;
      if (!props?.id) return;
      
      const courtId = props.id;
      const courtName = props.name ?? "Campo";
      const courtAddress = props.address ?? "";
      const courtLobbies = lobbies?.filter ? lobbies.filter(l => l.court_id === courtId) : [];
      
      popupRef.current?.remove();
      
      if (courtLobbies.length > 0) {
        const lobbiesHtml = courtLobbies.map(l => {
          const startDate = new Date(l.start_time);
          const time = startDate.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
          const date = startDate.toLocaleDateString("it-IT", { weekday: "short", month: "short", day: "numeric" });
          const freeSpots = l.max_players - l.participants_count;
          const sportEmoji = l.sport === "basketball" ? "🏀" : l.sport === "volleyball" ? "🏐" : l.sport === "tennis" ? "🎾" : l.sport === "soccer" ? "⚽" : "🏟️";
          
          return `
            <div style="border-bottom: 1px solid #e5e7eb; padding: 8px 0;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px;">${sportEmoji} ${date} ${time}</span>
                <span style="font-size: 11px; color: ${freeSpots > 2 ? "#22c55e" : freeSpots > 0 ? "#eab308" : "#ef4444"};">${freeSpots}/${l.max_players} posti</span>
              </div>
              <a href="/courts/${courtId}" style="display: block; margin-top: 4px; font-size: 11px; color: #2563eb; text-decoration: underline;">Unisciti →</a>
            </div>
          `;
        }).join("");
        
        const html = `
          <div style="font-family: inherit; min-width: 180px;">
            <strong style="font-size: 14px;">${courtName}</strong>
            <div style="font-size: 11px; color: #6b7280; margin: 4px 0 8px 0;">${courtAddress}</div>
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">${courtLobbies.length} lobby attive:</div>
            ${lobbiesHtml}
            <a href="/courts/${courtId}" style="display: block; text-align: center; margin-top: 8px; padding: 6px 12px; background: #2563eb; color: white; border-radius: 6px; font-size: 12px; text-decoration: none;">Vedi dettagli</a>
          </div>
        `;
        
        const geomCoords = feature.geometry;
        if (geomCoords && geomCoords.type === "Point") {
          const coords = geomCoords.coordinates as [number, number];
          popupRef.current
            ?.setLngLat(coords)
            .setHTML(html)
            .addTo(map.current);
        }
      } else {
        onCourtSelect?.(courtId);
      }
    };

    const handleMouseEnter = (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = "pointer";

      // Check for cluster first
      const clusterLayers = [CLUSTER_LAYER_ID].filter(layerId => {
        const layer = map.current?.getLayer(layerId);
        return !!layer;
      });

      const clusterFeatures = clusterLayers.length > 0
        ? map.current.queryRenderedFeatures(e.point, { layers: clusterLayers })
        : [];

      if (clusterFeatures.length) {
        const props = clusterFeatures[0].properties;
        const pointCount = props?.point_count ?? 0;
        const lng = (clusterFeatures[0].geometry as GeoJSON.Point).coordinates[0];
        const lat = (clusterFeatures[0].geometry as GeoJSON.Point).coordinates[1];

        popupRef.current
          ?.setLngLat([lng, lat])
          .setHTML(`<div style="font-family: inherit; padding: 4px 0;"><strong style="font-size: 13px;">${pointCount} campi</strong><div style="font-size: 11px; color: #6b7280; margin-top: 2px;">Clicca per espandere</div></div>`)
          .addTo(map.current!);
        return;
      }

      // Individual marker - check all sport layers that exist
      const allCircleLayers = SPORTS_LIST.flatMap((sport) => [
        `${CIRCLE_LAYER_ID}-${sport}`,
        `${CIRCLE_LAYER_ID}-${sport}-shadow`,
      ]).filter(layerId => {
        const layer = map.current?.getLayer(layerId);
        return !!layer;
      });

      if (allCircleLayers.length === 0) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: allCircleLayers,
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

    const mapInstance = map.current;
    mapInstance.on("click", handleClick);
    mapInstance.on("mouseenter", CLUSTER_LAYER_ID, handleMouseEnter);
    mapInstance.on("mouseleave", CLUSTER_LAYER_ID, handleMouseLeave);
    SPORTS_LIST.forEach((sport) => {
      mapInstance.on("mouseenter", `${CIRCLE_LAYER_ID}-${sport}`, handleMouseEnter);
      mapInstance.on("mouseleave", `${CIRCLE_LAYER_ID}-${sport}`, handleMouseLeave);
      mapInstance.on("mouseenter", `${CIRCLE_LAYER_ID}-${sport}-shadow`, handleMouseEnter);
      mapInstance.on("mouseleave", `${CIRCLE_LAYER_ID}-${sport}-shadow`, handleMouseLeave);
    });

    return () => {
      if (!map.current) return;
      const cleanupMap = map.current;
      cleanupMap.off("click", handleClick);
      cleanupMap.off("mouseenter", CLUSTER_LAYER_ID, handleMouseEnter);
      cleanupMap.off("mouseleave", CLUSTER_LAYER_ID, handleMouseLeave);
      cleanupMap.off("mouseenter", CLUSTER_LAYER_ID + "-outer", handleMouseEnter);
      cleanupMap.off("mouseleave", CLUSTER_LAYER_ID + "-outer", handleMouseLeave);
      SPORTS_LIST.forEach((sport) => {
        cleanupMap.off("mouseenter", `${CIRCLE_LAYER_ID}-${sport}`, handleMouseEnter);
        cleanupMap.off("mouseleave", `${CIRCLE_LAYER_ID}-${sport}`, handleMouseLeave);
        cleanupMap.off("mouseenter", `${CIRCLE_LAYER_ID}-${sport}-shadow`, handleMouseEnter);
        cleanupMap.off("mouseleave", `${CIRCLE_LAYER_ID}-${sport}-shadow`, handleMouseLeave);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        @keyframes debug-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>

      {/* Cluster Debug Panel */}
      {debugInfo?.show && (
        <div
          className="absolute top-4 left-4 right-4 bg-[var(--bg-elevated)] rounded-xl p-4 shadow-xl z-20 border border-[var(--accent)]"
          style={{ maxHeight: "80%", overflow: "auto", animation: "debug-pulse 2s infinite" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold font-[family-name:var(--font-syne)] text-sm text-[var(--accent)]">
              🔍 Cluster Debug
            </h3>
            <button
              onClick={() => setDebugInfo(null)}
              className="text-xs text-[var(--text-muted)] hover:text-white"
            >
              ✕ Chiudi
            </button>
          </div>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Cluster ID:</span>
              <span className="text-white">{debugInfo.clusterId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Punti nel cluster:</span>
              <span className="text-[var(--accent)] font-bold">{debugInfo.pointCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Zoom attuale:</span>
              <span className="text-white">{debugInfo.currentZoom?.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Expansion zoom:</span>
              <span className="text-white">{debugInfo.expansionZoom?.toFixed(1)}</span>
            </div>

            <div className="border-t border-[var(--cool-muted)]/30 pt-2 mt-2">
              <span className="text-[var(--text-muted)] block mb-2">Punti nel cluster:</span>
              {debugInfo.points?.map((point, i) => (
                <div key={i} className="bg-[var(--bg-surface)] rounded p-2 mb-1">
                  <div className="flex justify-between">
                    <span className="text-white">{point.name}</span>
                    <span className="text-[var(--accent)]">{point.sport}</span>
                  </div>
                  <div className="text-[var(--text-muted)]">
                    📍 {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                  </div>
                  {i > 0 && debugInfo.points?.[0] && (
                    <div className={`text-xs mt-1 ${Math.abs(point.lat - debugInfo.points[0].lat) < 0.00001 && Math.abs(point.lng - debugInfo.points[0].lng) < 0.00001 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>
                      {Math.abs(point.lat - debugInfo.points[0].lat) < 0.00001 && Math.abs(point.lng - debugInfo.points[0].lng) < 0.00001
                        ? "⚠️ STESSE COORDINATE!"
                        : "✓ Coordinate diverse"}
                    </div>
                  )}
                </div>
              ))}
              {(!debugInfo.points || debugInfo.points.length === 0) && (
                <div className="text-[var(--warning)]">⏳ Caricamento punti...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
