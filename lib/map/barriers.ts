import type maplibregl from "maplibre-gl";
import { MAP_PROVIDER } from "./provider";
import { guardStyleLayersFilter } from "./style-guards";
import {
  BOLLARD_CLASSES,
  BOLLARD_ICON_ID,
  GATE_CLASSES,
  GATE_ICON_ID,
  registerBarrierIcons,
  type BarrierIconUris,
} from "./icons";

/**
 * Layer `dropin-barriers` e guardie dei filtri dello stile Liberty.
 *
 * Estratto da `court-map.tsx` per tenere il componente sul wiring. Entrambe
 * le funzioni sono best-effort: la mappa deve continuare a funzionare anche
 * se icone, sorgente o stile non sono disponibili.
 */

export const BARRIER_LAYER_ID = "dropin-barriers";

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
  // I layer dei campi (`courts-*`) stanno sopra: qui basta non coprire le
  // etichette di luogo, quindi il layer va prima del primo symbol.
  const beforeId = map
    .getStyle()
    ?.layers.find((layer) => layer.type === "symbol")?.id;
  if (beforeId) map.addLayer(spec, beforeId);
  else map.addLayer(spec);
}

// Attenua il warning MapLibre "Expected value to be of type number, but
// found null instead" (#79): i filtri dello stile upstream Liberty
// confrontano `rank`/`ref_length` senza guardia typeof e le feature senza la
// proprieta' valutano a null. La guardia e' idempotente (secondo passaggio
// no-op) e tocca solo i layer il cui filtro cambia davvero. Mai fatale: se
// lo stile non c'e' o setFilter lancia, la mappa continua a funzionare.
export function applyStyleFilterGuards(map: maplibregl.Map): void {
  try {
    const layers = map.getStyle()?.layers;
    for (const { id, filter } of guardStyleLayersFilter(layers)) {
      map.setFilter(id, filter as never);
    }
  } catch {
    // best effort: warning in console, niente schermo rotto
  }
}

// Registra le icone inline gate/bollard e aggiunge il layer
// dropin-barriers. Idempotente e mai fatale: se le icone o la sorgente
// mancano, la mappa continua a funzionare senza il layer.
export function setupBarrierLayer(map: maplibregl.Map): void {
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
