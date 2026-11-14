import type maplibregl from "maplibre-gl";
import {
  COURT_LAYER_IDS,
  COURT_SOURCE_ID,
  POINT_HIT_PADDING,
} from "./court-features";

/**
 * Interazione con i punti della mappa (#42/#43): click su cluster e punti,
 * hover. Estratto da `court-map.tsx` per tenere il componente sul ciclo di
 * vita dell'istanza. I listener muoiono con `map.remove()`.
 */

/** Mai oltre: a z17+ il cluster non esiste piu' e si vedono i punti. */
const MAX_CLUSTER_ZOOM = 17;

export function attachCourtInteractions(
  map: maplibregl.Map,
  onSelectCourt: (courtId: string) => void
): { resetHover: () => void } {
  map.on("click", (event) => {
    // Source/layer possono non esserci (prima del load o tra setStyle e
    // style.load): senza guardia queryRenderedFeatures emette un errore.
    const hasClusters = map.getLayer(COURT_LAYER_IDS.clusters);
    const hasPoints = map.getLayer(COURT_LAYER_IDS.points);
    if (!hasClusters && !hasPoints) return;

    // Cluster prima: il suo cerchio e' gia' il target. Poi i punti, con un
    // padding di 22px per lato: il target effettivo e' 44x44 (#44).
    const cluster = hasClusters
      ? map.queryRenderedFeatures(event.point, {
          layers: [COURT_LAYER_IDS.clusters],
        })[0]
      : undefined;
    if (cluster) {
      const source = map.getSource(COURT_SOURCE_ID) as
        | maplibregl.GeoJSONSource
        | undefined;
      const clusterId = Number(cluster.properties?.cluster_id);
      if (
        source &&
        "getClusterExpansionZoom" in source &&
        Number.isFinite(clusterId)
      ) {
        void source
          .getClusterExpansionZoom(clusterId)
          .then((zoom) => {
            map.easeTo({
              center: [event.lngLat.lng, event.lngLat.lat],
              zoom: Math.min(zoom, MAX_CLUSTER_ZOOM),
              duration: 500,
            });
          })
          .catch(() => {
            // Cluster sparito tra query ed espansione: nessun errore utente.
          });
        return;
      }
    }

    if (!hasPoints) return;
    const pointHits = map.queryRenderedFeatures(
      [
        [event.point.x - POINT_HIT_PADDING, event.point.y - POINT_HIT_PADDING],
        [event.point.x + POINT_HIT_PADDING, event.point.y + POINT_HIT_PADDING],
      ],
      { layers: [COURT_LAYER_IDS.points] }
    );
    const courtId = pointHits[0]?.properties?.courtId;
    if (typeof courtId === "string") onSelectCourt(courtId);
  });

  // Hover: feature-state (promoteId) → raggio +2. Solo feedback visivo.
  let hoveredId: string | number | null = null;
  const setHover = (id: string | number | null) => {
    if (id === hoveredId) return;
    if (hoveredId != null) {
      try {
        if (map.getSource(COURT_SOURCE_ID)) {
          map.setFeatureState(
            { source: COURT_SOURCE_ID, id: hoveredId },
            { hover: false }
          );
        }
      } catch {
        // source ricreata da setStyle: nessuno stato da pulire
      }
    }
    hoveredId = id;
    if (id != null) {
      try {
        if (map.getSource(COURT_SOURCE_ID)) {
          map.setFeatureState({ source: COURT_SOURCE_ID, id }, { hover: true });
        }
      } catch {
        // feature-state non disponibile: resta il cursore pointer
      }
    }
  };

  map.on("mousemove", (event) => {
    const layers = [COURT_LAYER_IDS.points, COURT_LAYER_IDS.clusters].filter(
      (id) => map.getLayer(id)
    );
    if (layers.length === 0) return;
    const hits = map.queryRenderedFeatures(event.point, { layers });
    map.getCanvas().style.cursor = hits.length > 0 ? "pointer" : "";
    const point = hits.find((hit) => hit.layer.id === COURT_LAYER_IDS.points);
    setHover(point?.id ?? null);
  });
  map.on("mouseout", () => {
    map.getCanvas().style.cursor = "";
    setHover(null);
  });

  // Lo style.load ricrea source e layer e azzera i feature-state: l'id
  // tracciato qui sopra non esiste piu' e l'early-return di setHover
  // congelerebbe un hover fantasma. Si dimentica l'id senza toccare lo
  // stato (non c'e' piu' niente da pulire); no-op se niente e' in hover.
  const resetHover = (): void => {
    hoveredId = null;
  };

  return { resetHover };
}
