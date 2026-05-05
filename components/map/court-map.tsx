"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface CourtMapProps {
  courts?: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address?: string | null;
  }>;
  onCourtSelect?: (courtId: string) => void;
  reportedCourtIds?: string[];
}

const ROME_CENTER: [number, number] = [12.5113, 41.8919];

export function CourtMap({ courts = [], onCourtSelect, reportedCourtIds = [] }: CourtMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const courtMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          },
        },
        layers: [
          {
            id: "osm",
            type: "raster",
            source: "osm",
          },
        ],
      },
      center: ROME_CENTER,
      zoom: 14,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right"
    );

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // User location marker
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

  // Court markers — rebuild when courts or reportedCourtIds change
  useEffect(() => {
    if (!map.current) return;

    // Remove old court markers
    courtMarkersRef.current.forEach((m) => m.remove());
    courtMarkersRef.current = [];

    if (courts.length === 0) return;

    const reportedSet = new Set(reportedCourtIds || []);

    courts.forEach((court) => {
      if (!map.current) return;

      const isReported = reportedSet.has(court.id);
      const bgColor = isReported ? "var(--danger)" : "var(--accent)";
      const iconColor = isReported ? "#ffffff" : "white";

      // Create a clickable inner element (the visible dot)
      const inner = document.createElement("div");
      inner.style.width = "40px";
      inner.style.height = "40px";
      inner.style.borderRadius = "50%";
      inner.style.backgroundColor = bgColor;
      inner.style.border = "2px solid white";
      inner.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
      inner.style.cursor = "pointer";
      inner.style.display = "flex";
      inner.style.alignItems = "center";
      inner.style.justifyContent = "center";
      inner.style.transition = "transform 0.15s ease";
      inner.setAttribute("role", "button");
      inner.setAttribute("tabindex", "0");
      inner.setAttribute(
        "aria-label",
        `Campo: ${court.name}${court.address ? `, ${court.address}` : ""}`
      );

      if (isReported) {
        inner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
        inner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>`;
      }

      inner.addEventListener("mouseenter", () => {
        inner.style.opacity = "0.85";
      });
      inner.addEventListener("mouseleave", () => {
        inner.style.opacity = "";
      });

      const activateCourt = (e: MouseEvent | KeyboardEvent) => {
        e.stopPropagation();
        onCourtSelect?.(court.id);
      };

      inner.addEventListener("click", activateCourt);
      inner.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateCourt(e);
        }
      });

      const marker = new maplibregl.Marker({ element: inner })
        .setLngLat([court.lng, court.lat])
        .addTo(map.current);
      courtMarkersRef.current.push(marker);
    });
  }, [courts, onCourtSelect, reportedCourtIds]);

  return (
    <div
      className="relative w-full h-full min-h-[50vh]"
      role="region"
      aria-label="Mappa dei campi da basket"
    >
      <div ref={mapContainer} className="w-full h-full" />
      {locationError && (
        <div
          className="absolute top-4 left-4 right-4 bg-[var(--bg-elevated)] rounded-xl p-3 shadow-lg z-10"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {locationError}
          </p>
        </div>
      )}
    </div>
  );
}
