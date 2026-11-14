"use client";

// Picker compatto per scegliere la posizione di un campo sulla mappa (#75).
//
// Caricato con `next/dynamic` + `ssr: false`: MapLibre (e il suo CSS) resta
// fuori dal chunk del form finché l'utente non apre la modalità manuale.
//
// Accessibilità: la mappa è decorativa e ha un'alternativa completa nei due
// input numerici di latitudine/longitudine nel form. Canvas, controlli e link
// di attribuzione non sono tab stop e il wrapper è `aria-hidden`, così la
// mappa non diventa una trappola da tastiera.

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_PROVIDER, MAP_STYLE_URL } from "@/lib/map/provider";
import { cn } from "@/lib/utils";

export interface PickerCoords {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  /** Centro iniziale, letto una sola volta al mount. */
  center: PickerCoords;
  /** Pin controllato: null = nessun punto ancora scelto. */
  value: PickerCoords | null;
  onChange: (coords: PickerCoords) => void;
  className?: string;
}

const INITIAL_ZOOM = 15;
const MAX_ZOOM = 19;

/** Mappa raster di riserva, stesso fallback del componente mappa principale. */
function fallbackStyle(): maplibregl.StyleSpecification {
  return {
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
    layers: [{ id: "osm", type: "raster", source: "osm" }],
  };
}

/**
 * Elemento del pin: 44x44 (target di progetto) con l'icona ancorata in basso,
 * così la punta cade sulle coordinate. Colori da token, mai esadecimali.
 */
function createPinElement(): HTMLDivElement {
  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.tabIndex = -1;
  element.style.cssText = [
    "width:44px",
    "height:44px",
    "display:flex",
    "align-items:flex-end",
    "justify-content:center",
    "cursor:grab",
    "touch-action:none",
    "filter:drop-shadow(0 2px 2px var(--overlay))",
  ].join(";");
  element.innerHTML =
    '<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true" focusable="false">' +
    '<path d="M15 1C7.8 1 2 6.8 2 14c0 9.5 11.2 21.5 12.2 22.6.4.4 1.2.4 1.6 0C16.8 35.5 28 23.5 28 14 28 6.8 22.2 1 15 1Z" ' +
    'style="fill:var(--accent);stroke:var(--bg-elevated)" stroke-width="2"/>' +
    '<circle cx="15" cy="14" r="5" style="fill:var(--bg-elevated)"/>' +
    "</svg>";
  return element;
}

/**
 * Niente tab stop dentro la mappa: MapLibre mette `tabindex=0` su canvas e
 * marker draggable, e i controlli di attribuzione sono link/bottoni nativi.
 */
function neutralizeTabStops(container: HTMLElement | null): void {
  if (!container) return;
  container
    .querySelectorAll<HTMLElement>("a, button, canvas, [tabindex]")
    .forEach((node) => node.setAttribute("tabindex", "-1"));
}

function addPin(
  map: maplibregl.Map,
  coords: PickerCoords,
  onChange: (coords: PickerCoords) => void
): maplibregl.Marker {
  const marker = new maplibregl.Marker({
    element: createPinElement(),
    anchor: "bottom",
    draggable: true,
    clickTolerance: 4,
  });

  marker.setLngLat([coords.lng, coords.lat]).addTo(map);

  // Il click sul pin non deve arrivare alla mappa sottostante (sposterebbe il
  // pin di qualche pixel). Il drag resta gestito da MapLibre.
  marker.getElement().addEventListener("click", (event) => {
    event.stopPropagation();
  });

  marker.on("dragstart", () => {
    marker.getElement().style.cursor = "grabbing";
  });
  marker.on("dragend", () => {
    marker.getElement().style.cursor = "grab";
    const point = marker.getLngLat();
    onChange({ lat: point.lat, lng: point.lng });
  });

  return marker;
}

export function LocationPicker({
  center,
  value,
  onChange,
  className,
}: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapNodeRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const initialCenterRef = useRef(center);

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = mapNodeRef.current;
    if (!container) return;

    const instance = new maplibregl.Map({
      container,
      style: MAP_PROVIDER === "openfreemap" ? MAP_STYLE_URL.light : fallbackStyle(),
      center: [initialCenterRef.current.lng, initialCenterRef.current.lat],
      zoom: INITIAL_ZOOM,
      maxZoom: MAX_ZOOM,
      attributionControl: { compact: true },
    });

    mapRef.current = instance;

    // La mappa è un'alternativa visiva, non un controllo da tastiera: il
    // percorso accessibile sono gli input delle coordinate.
    instance.keyboard.disable();
    instance.dragRotate.disable();
    instance.touchZoomRotate.disableRotation();
    instance.getCanvas().setAttribute("aria-hidden", "true");
    instance.getCanvas().setAttribute("tabindex", "-1");
    instance.getCanvas().style.cursor = "crosshair";
    neutralizeTabStops(containerRef.current);

    // L'attribuzione compatta crea i suoi link solo quando si apre: il
    // observer li tiene fuori dal tab order anche dopo quell'interazione.
    const tabStopObserver = new MutationObserver(() => {
      neutralizeTabStops(containerRef.current);
    });
    tabStopObserver.observe(container, { childList: true, subtree: true });

    instance.on("click", (event) => {
      onChangeRef.current({ lat: event.lngLat.lat, lng: event.lngLat.lng });
    });

    instance.on("error", () => {
      // Prima del primo load l'errore è dello stile: si mostra il fallback
      // leggibile. Dopo sono tile: la mappa ha già dipinto, si ignora.
      if (!loadedRef.current) setFailed(true);
    });

    instance.once("load", () => {
      loadedRef.current = true;
      setFailed(false);
      neutralizeTabStops(containerRef.current);
    });

    return () => {
      tabStopObserver.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current = null;
      loadedRef.current = false;
      instance.remove();
    };
    // `center` è solo il centro iniziale; `value` è sincronizzato nell'effetto
    // sotto, che gira dopo questo al mount.
  }, []);

  // Pin controllato: nasce, si sposta e sparisce con `value`. Se le
  // coordinate cambiano dagli input e il pin esce dalla vista, la mappa lo
  // segue con un ease breve.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      markerRef.current = addPin(map, value, (coords) => onChangeRef.current(coords));
      neutralizeTabStops(containerRef.current);
      return;
    }

    markerRef.current.setLngLat([value.lng, value.lat]);

    const node = map.getContainer();
    if (!node) return;
    const point = map.project([value.lng, value.lat]);
    const margin = 24;
    if (
      point.x < margin ||
      point.y < margin ||
      point.x > node.clientWidth - margin ||
      point.y > node.clientHeight - margin
    ) {
      const reduceMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.easeTo({ center: [value.lng, value.lat], duration: reduceMotion ? 0 : 300 });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "relative w-full overflow-hidden rounded-control border border-[var(--border)] bg-[var(--bg-surface)]",
        className
      )}
    >
      <div ref={mapNodeRef} className="h-[220px] w-full" />

      {failed && (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-surface)]/95 px-4 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Mappa non disponibile. Inserisci latitudine e longitudine qui sotto.
          </p>
        </div>
      )}
    </div>
  );
}
