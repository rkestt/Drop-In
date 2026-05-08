"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface CourtMiniMapProps {
  lat: number;
  lng: number;
  courtName: string;
  zone?: string;
}

export function CourtMiniMap({ lat, lng, courtName: _courtName, zone }: CourtMiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dinamico: carica Leaflet solo lato client
    import("leaflet").then((L) => {
      if (!mapRef.current || mapInstanceRef.current) return;

      const { map: LMap, tileLayer, marker, divIcon, control } = L;

      const map = LMap(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });

      tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "",
      }).addTo(map);

      const markerIcon = divIcon({
        html: `<div style="
          width: 20px;
          height: 20px;
          background: var(--accent, #6366f1);
          border: 2.5px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
        "></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: "",
      });

      marker([lat, lng], { icon: markerIcon }).addTo(map);

      control
        .attribution({ position: "bottomright", prefix: false })
        .addAttribution(`© <a href="https://www.openstreetmap.org/copyright">OSM</a>`)
        .addTo(map);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
      }
      mapInstanceRef.current = null;
    };
  }, [lat, lng]);

  return (
    <div className="relative rounded-xl overflow-hidden h-40 border border-[var(--border)]">
      <div ref={mapRef} className="w-full h-full" />

      {/* Controls overlay — top right */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 z-[1000]">
        <a
          target="_blank"
          rel="noopener noreferrer"
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=16`}
          className="flex items-center gap-1 text-xs bg-white/95 text-gray-700 px-2 py-1 rounded-md hover:bg-white transition-colors shadow-sm"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Apri
        </a>
      </div>

      {/* Zone label — bottom left */}
      {zone && (
        <div className="absolute bottom-2 left-2 text-xs bg-white/90 text-gray-700 px-2 py-1 rounded-md shadow-sm z-[1000]">
          {zone}
        </div>
      )}
    </div>
  );
}
