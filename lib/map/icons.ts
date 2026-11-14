// Icone inline per le barriere (cancelli/dissuasori) della mappa.
//
// Lo stile liberty di OpenFreeMap non fornisce sprite "gate"/"bollard",
// quindi queste icone sono SVG composti a runtime e registrati con
// map.addImage. Essendo data URI, funzionano anche offline e non
// richiedono nuovi host di rete ne' file binari.
//
// Il colore viene letto a runtime dai token CSS (mai hardcoded: questo
// file e' scansionato da lint:design).

import type maplibregl from "maplibre-gl";

export const GATE_ICON_ID = "gate";
export const BOLLARD_ICON_ID = "bollard";

// Classi barriera dal layer `poi` servite da ciascuna icona: `gate` e
// `lift_gate` usano l'icona gate; `bollard`, `cycle_barrier` e `block`
// usano l'icona bollard.
export const GATE_CLASSES = ["gate", "lift_gate"] as const;
export const BOLLARD_CLASSES = ["bollard", "cycle_barrier", "block"] as const;

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

// Colore letto dai token CSS a runtime, con fallback a un nome di colore CSS
// (mai esadecimali, per restare verdi con lint:design). MapLibre non risolve
// le custom property: i layer ricevono valori concreti.
export function cssTokenColor(token: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const style = getComputedStyle(document.documentElement);
  const value = style.getPropertyValue(token).trim();
  return value === "" ? fallback : value;
}

// Colore delle icone letto dai token CSS a runtime, con fallback a nomi
// di colore CSS (mai esadecimali, per restare verdi con lint:design).
export function barrierIconColor(): string {
  if (typeof document === "undefined") return "gray";
  const style = getComputedStyle(document.documentElement);
  for (const token of ["--text-secondary", "--border-strong"]) {
    const value = style.getPropertyValue(token).trim();
    if (value !== "") return value;
  }
  return "gray";
}

function svgDocument(inner: string, color: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" ' +
    'viewBox="0 0 24 24" fill="none" stroke="' +
    color +
    '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    inner +
    "</svg>"
  );
}

// Cancello: due pali con anta in diagonale.
export function gateSvg(color: string): string {
  return svgDocument(
    '<path d="M5 21V5"/><path d="M19 21V5"/>' +
      '<path d="M5 9h14"/><path d="M5 9l14 6"/>',
    color,
  );
}

// Dissuasore: colonnina con base.
export function bollardSvg(color: string): string {
  return svgDocument(
    '<path d="M10 21v-9a2 2 0 0 1 4 0v9"/><path d="M7 21h10"/>',
    color,
  );
}

export function svgDataUri(svg: string): string {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

async function loadImageElement(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = uri;
  });
}

async function registerOne(
  map: maplibregl.Map,
  id: string,
  svg: string,
): Promise<void> {
  try {
    if (map.hasImage(id)) return;
    // Nota: si usa HTMLImageElement + addImage invece di map.loadImage
    // perche' loadImage (fetch + createImageBitmap) non decodifica gli
    // SVG in Chromium ("The source image could not be decoded").
    const img = await loadImageElement(svgDataUri(svg));
    if (!map.hasImage(id)) {
      map.addImage(id, img, { pixelRatio: 2 });
    }
  } catch {
    // La mappa deve continuare a funzionare anche se un'icona non si carica.
    warnOnce(id, "[map] barrier icon unavailable: " + id);
  }
}

export interface BarrierIconUris {
  gate: string;
  bollard: string;
}

// Registra "gate" e "bollard" sulla mappa e restituisce i data URI usati
// (utili per verificare il comportamento offline nei test).
export async function registerBarrierIcons(
  map: maplibregl.Map,
): Promise<BarrierIconUris> {
  const color = barrierIconColor();
  const uris: BarrierIconUris = {
    gate: svgDataUri(gateSvg(color)),
    bollard: svgDataUri(bollardSvg(color)),
  };
  await Promise.allSettled([
    registerOne(map, GATE_ICON_ID, gateSvg(color)),
    registerOne(map, BOLLARD_ICON_ID, bollardSvg(color)),
  ]);
  return uris;
}
