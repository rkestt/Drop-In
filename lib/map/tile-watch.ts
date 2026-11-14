import type maplibregl from "maplibre-gl";
import { MAP_PROVIDER, MAP_TILE_HOSTS, MAP_TILE_SOURCE_ID } from "./provider";
import {
  classifyTileError,
  createTileErrorState,
  dismissTileError,
  recordTileError,
  recordTileLoad,
  type TileErrorState,
} from "./tile-errors";

/**
 * Cablaggio di #39 sull'istanza MapLibre.
 *
 * - Prima del `load` un errore e' della mappa/dello stile: il chiamante mostra
 *   l'overlay a schermo intero (comportamento invariato).
 * - Dopo il `load` gli errori si aggregano (`lib/map/tile-errors.ts`) e il
 *   chiamante mostra solo un banner non bloccante.
 * - Il recupero e' un tile arrivato davvero (`sourcedata` con
 *   `sourceDataType: "content"`), non `idle`: MapLibre va in idle anche
 *   quando tutti i tile sono in errore.
 *
 * Lo stato vive quanto l'istanza: il retry ricrea la mappa e quindi riparte
 * da una finestra pulita.
 */
export interface TileErrorWatchOptions {
  isLoaded: () => boolean;
  onPreLoadError: () => void;
  onBannerChange: (visible: boolean) => void;
}

export interface TileErrorWatch {
  /** Chiusura manuale del banner: non riappare finche' non tornano tile. */
  dismiss: () => void;
}

export function watchTileErrors(
  map: maplibregl.Map,
  { isLoaded, onPreLoadError, onBannerChange }: TileErrorWatchOptions
): TileErrorWatch {
  let state: TileErrorState = createTileErrorState();

  map.on("error", (event) => {
    if (!isLoaded()) {
      onPreLoadError();
      return;
    }
    const kind = classifyTileError(event.error, MAP_TILE_HOSTS[MAP_PROVIDER]);
    if (kind === "ignore") {
      console.warn("Map error", event.error?.message ?? event.error);
      return;
    }
    const next = recordTileError(state, kind, Date.now());
    if (next === state) return;
    state = next;
    onBannerChange(state.bannerVisible);
  });

  map.on("sourcedata", (event) => {
    if (event.sourceId !== MAP_TILE_SOURCE_ID[MAP_PROVIDER]) return;
    if (event.sourceDataType !== "content" || !event.tile) return;
    const next = recordTileLoad(state, Date.now());
    if (next === state) return;
    state = next;
    onBannerChange(false);
  });

  return {
    dismiss() {
      const next = dismissTileError(state);
      if (next === state) return;
      state = next;
      onBannerChange(false);
    },
  };
}
