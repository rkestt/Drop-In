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
  const [, setUserLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

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

    // Try to get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([longitude, latitude]);
          if (map.current) {
            map.current.flyTo({
              center: [longitude, latitude],
              zoom: 15,
              duration: 1000,
            });

            new maplibregl.Marker({ color: "#3b82f6" })
              .setLngLat([longitude, latitude])
              .addTo(map.current);
          }
        },
        () => {
          setLocationError("Posizione non disponibile. Centro su Roma.");
        }
      );
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  // Add court markers
  useEffect(() => {
    if (!map.current || courts.length === 0) return;

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

      // Use danger icon (triangle) for reported courts, basketball icon for normal
      if (isReported) {
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
      } else {
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></svg>`;
      }

      const activateCourt = () => {
        onCourtSelect?.(court.id);
      };

      el.addEventListener("click", activateCourt);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activateCourt();
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([court.lng, court.lat])
        .addTo(map.current);
    });
  }, [courts, onCourtSelect, reportedCourtIds]);

  return (
    <div className="relative w-full h-full" role="region" aria-label="Mappa dei campi da basket">
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
    </div>
  );
}
