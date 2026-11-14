import type maplibregl from "maplibre-gl";

/**
 * Tastiera della mappa (#44): frecce = pan, `+`/`-` = zoom, `Home` =
 * posizione utente o centro di Roma. Ritorna `true` se il tasto e' stato
 * gestito, cosi' il chiamante fa `preventDefault` solo sui tasti suoi.
 *
 * Le direzioni seguono l'handler nativo di MapLibre: `panBy` inverte
 * l'offset, quindi ArrowLeft passa `-step` per spostare la vista a ovest.
 */

export interface MapKeyboardOptions {
  userLocation: readonly [number, number] | null;
  fallbackCenter: readonly [number, number];
  stepPx?: number;
}

export function handleMapKey(
  map: maplibregl.Map,
  key: string,
  { userLocation, fallbackCenter, stepPx = 100 }: MapKeyboardOptions
): boolean {
  const hasUserLocation =
    userLocation != null &&
    Number.isFinite(userLocation[0]) &&
    Number.isFinite(userLocation[1]);

  switch (key) {
    case "ArrowLeft":
      map.panBy([-stepPx, 0], { duration: 120 });
      return true;
    case "ArrowRight":
      map.panBy([stepPx, 0], { duration: 120 });
      return true;
    case "ArrowUp":
      map.panBy([0, -stepPx], { duration: 120 });
      return true;
    case "ArrowDown":
      map.panBy([0, stepPx], { duration: 120 });
      return true;
    case "+":
    case "=":
      map.zoomIn({ duration: 150 });
      return true;
    case "-":
    case "_":
      map.zoomOut({ duration: 150 });
      return true;
    case "Home": {
      // Copia mutabile: LngLatLike non accetta una tupla readonly.
      const center: [number, number] = hasUserLocation
        ? [userLocation[0], userLocation[1]]
        : [fallbackCenter[0], fallbackCenter[1]];
      map.easeTo({
        center,
        zoom: hasUserLocation ? 15 : 14,
        duration: 600,
      });
      return true;
    }
    default:
      return false;
  }
}
