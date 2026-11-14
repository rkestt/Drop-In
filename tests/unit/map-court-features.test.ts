import { describe, expect, it } from "vitest";
import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { StyleSpecification } from "maplibre-gl";
import {
  CLUSTER_TIERS,
  COURT_LAYER_IDS,
  COURT_SOURCE_ID,
  MARKER_VISUALS,
  SELECTED_HALO,
  buildCourtFeatureCollection,
  buildCourtLayers,
  clusterRadius,
  clusterRadiusExpression,
  courtsForList,
  lobbyLabel,
  resolveMarkerState,
  type CourtPalette,
} from "@/lib/map/court-features";

const PALETTE: CourtPalette = {
  accent: "green",
  accentHover: "limegreen",
  accentForeground: "black",
  danger: "red",
  dangerForeground: "black",
  bgElevated: "dimgray",
  textPrimary: "white",
};

const COURT = {
  id: "court-1",
  name: "Campetto Trastevere",
  lat: 41.889,
  lng: 12.469,
  address: "Via della Lungaretta",
};

describe("resolveMarkerState", () => {
  it("default quando non c'e' nulla di speciale", () => {
    expect(
      resolveMarkerState({ favorite: false, reported: false, lobbyCount: 0 })
    ).toBe("default");
  });

  it("preferito senza lobby/segnalazioni", () => {
    expect(
      resolveMarkerState({ favorite: true, reported: false, lobbyCount: 0 })
    ).toBe("favorite");
  });

  it("lobby attiva vince sul preferito", () => {
    expect(
      resolveMarkerState({ favorite: true, reported: false, lobbyCount: 2 })
    ).toBe("lobby");
  });

  it("segnalato vince su tutto", () => {
    expect(
      resolveMarkerState({ favorite: true, reported: true, lobbyCount: 3 })
    ).toBe("reported");
  });
});

describe("MARKER_VISUALS", () => {
  it("ogni stato ha forma/size/colore token distinti", () => {
    const states = Object.keys(MARKER_VISUALS) as Array<
      keyof typeof MARKER_VISUALS
    >;
    expect(states.sort()).toEqual(["default", "favorite", "lobby", "reported"]);
    for (const state of states) {
      const visual = MARKER_VISUALS[state];
      expect(visual.radius).toBeGreaterThan(0);
      expect(visual.fill).toMatch(/^(accent|bgElevated|danger)$/);
      expect(visual.stroke).toMatch(/^(accent|bgElevated)$/);
    }
  });

  it("il preferito si distingue per silhouette (ciambella), non solo colore", () => {
    expect(MARKER_VISUALS.favorite.fill).toBe("bgElevated");
    expect(MARKER_VISUALS.favorite.stroke).toBe("accent");
    expect(MARKER_VISUALS.default.fill).toBe("accent");
  });

  it("lobby e' il marker piu' grande e ha il numero dentro", () => {
    expect(MARKER_VISUALS.lobby.radius).toBeGreaterThan(
      MARKER_VISUALS.default.radius
    );
    expect(MARKER_VISUALS.lobby.label).toBe("lobby");
  });

  it("segnalato ha il glifo e colore danger", () => {
    expect(MARKER_VISUALS.reported.fill).toBe("danger");
    expect(MARKER_VISUALS.reported.label).toBe("alert");
  });

  it("la selezione e' una piastra, non un colore in piu'", () => {
    expect(SELECTED_HALO.extraRadius).toBeGreaterThan(0);
    expect(SELECTED_HALO.stroke).toBe("accentHover");
  });
});

describe("clusterRadius", () => {
  it("cresce a scaglioni con il numero di punti", () => {
    expect(clusterRadius(2)).toBe(CLUSTER_TIERS[0].radius);
    expect(clusterRadius(10)).toBe(CLUSTER_TIERS[1].radius);
    expect(clusterRadius(49)).toBe(CLUSTER_TIERS[1].radius);
    expect(clusterRadius(50)).toBe(CLUSTER_TIERS[2].radius);
    expect(clusterRadius(200)).toBe(CLUSTER_TIERS[3].radius);
    expect(clusterRadius(5000)).toBe(CLUSTER_TIERS[3].radius);
  });

  it("non scende sotto il minimo nemmeno con 0", () => {
    expect(clusterRadius(0)).toBe(CLUSTER_TIERS[0].radius);
  });

  it("l'espressione step segue la tabella", () => {
    expect(clusterRadiusExpression()).toEqual([
      "step",
      ["get", "point_count"],
      17,
      10,
      21,
      50,
      25,
      200,
      29,
    ]);
  });
});

describe("lobbyLabel", () => {
  it("0 lobby = stringa vuota", () => {
    expect(lobbyLabel(0)).toBe("");
    expect(lobbyLabel(-1)).toBe("");
    expect(lobbyLabel(Number.NaN)).toBe("");
  });

  it("1-9 numeri, oltre 9 si ferma a 9+", () => {
    expect(lobbyLabel(1)).toBe("1");
    expect(lobbyLabel(9)).toBe("9");
    expect(lobbyLabel(10)).toBe("9+");
    expect(lobbyLabel(120)).toBe("9+");
  });
});

describe("buildCourtFeatureCollection", () => {
  it("produce una FeatureCollection GeoJSON con point e proprieta' utili", () => {
    const collection = buildCourtFeatureCollection([COURT], {
      favoriteIds: new Set([COURT.id]),
      reportedIds: new Set(),
      lobbyCounts: { [COURT.id]: 2 },
      selectedId: COURT.id,
    });
    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features).toHaveLength(1);
    const feature = collection.features[0];
    expect(feature.type).toBe("Feature");
    expect(feature.id).toBe(COURT.id);
    expect(feature.geometry).toEqual({
      type: "Point",
      coordinates: [COURT.lng, COURT.lat],
    });
    expect(feature.properties).toMatchObject({
      courtId: COURT.id,
      name: COURT.name,
      address: COURT.address,
      markerState: "lobby",
      favorite: true,
      reported: false,
      lobbyCount: 2,
      lobbyLabel: "2",
      selected: true,
      radius: MARKER_VISUALS.lobby.radius,
    });
  });

  it("scarta le coordinate non finite (mai punti fantasma)", () => {
    const collection = buildCourtFeatureCollection([
      COURT,
      { id: "bad-1", name: "NaN", lat: Number.NaN, lng: 12.5 },
      { id: "bad-2", name: "Infinity", lat: 41.9, lng: Number.POSITIVE_INFINITY },
      { id: "", name: "Senza id", lat: 41.9, lng: 12.5 },
    ]);
    expect(collection.features.map((f) => f.properties.courtId)).toEqual([
      COURT.id,
    ]);
  });

  it("ordinamento indipendente: lo stato e' letto dagli id, non dalla posizione", () => {
    const collection = buildCourtFeatureCollection(
      [COURT, { ...COURT, id: "court-2", name: "Altro" }],
      { reportedIds: new Set(["court-2"]) }
    );
    expect(collection.features[0].properties.markerState).toBe("default");
    expect(collection.features[1].properties.markerState).toBe("reported");
  });

  it("nessuna opzione = tutto default, nessuna selezione", () => {
    const collection = buildCourtFeatureCollection([COURT]);
    expect(collection.features[0].properties).toMatchObject({
      markerState: "default",
      favorite: false,
      reported: false,
      lobbyCount: 0,
      lobbyLabel: "",
      selected: false,
    });
  });
});

describe("buildCourtLayers", () => {
  const layers = buildCourtLayers(PALETTE);
  const byId = (id: string) => layers.find((layer) => layer.id === id);

  it("una source sola, tutti i layer puntano a quella", () => {
    expect(layers).toHaveLength(6);
    for (const layer of layers) {
      expect(layer.source).toBe(COURT_SOURCE_ID);
    }
  });

  it("l'ordine di disegno mette l'halo sotto e i cluster sopra", () => {
    const ids = layers.map((layer) => layer.id);
    expect(ids.indexOf(COURT_LAYER_IDS.selectedHalo)).toBeLessThan(
      ids.indexOf(COURT_LAYER_IDS.points)
    );
    expect(ids.indexOf(COURT_LAYER_IDS.points)).toBeLessThan(
      ids.indexOf(COURT_LAYER_IDS.reportedGlyph)
    );
    expect(ids.indexOf(COURT_LAYER_IDS.clusters)).toBeGreaterThan(
      ids.indexOf(COURT_LAYER_IDS.points)
    );
  });

  it("i punti escludono i cluster e i cluster hanno il conteggio", () => {
    expect(byId(COURT_LAYER_IDS.points)?.filter).toEqual([
      "!",
      ["has", "point_count"],
    ]);
    expect(byId(COURT_LAYER_IDS.clusters)?.filter).toEqual([
      "has",
      "point_count",
    ]);
    expect(byId(COURT_LAYER_IDS.clusterCount)?.layout).toMatchObject({
      "text-field": ["to-string", ["get", "point_count_abbreviated"]],
    });
  });

  it("i colori vengono dalla palette risolta, mai da un letterale", () => {
    const json = JSON.stringify(layers);
    expect(json).toContain("green");
    expect(json).toContain("dimgray");
    expect(json).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(json).not.toMatch(/rgb\(|hsl\(|oklch\(/);
  });

  it("hover e selezione sono espressioni, non dati duplicati", () => {
    const points = byId(COURT_LAYER_IDS.points);
    expect(JSON.stringify(points?.paint)).toContain("feature-state");
    expect(byId(COURT_LAYER_IDS.selectedHalo)?.filter).toEqual([
      "==",
      ["get", "selected"],
      true,
    ]);
  });

  it("le etichette non vengono mai nascoste dal collision detection", () => {
    for (const id of [COURT_LAYER_IDS.lobbyCount, COURT_LAYER_IDS.clusterCount]) {
      expect(byId(id)?.layout).toMatchObject({
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      });
    }
  });

  it("source e layer passano il validatore dello style spec MapLibre", () => {
    const style = {
      version: 8,
      sources: {
        [COURT_SOURCE_ID]: {
          type: "geojson",
          data: buildCourtFeatureCollection([COURT]),
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 14,
          clusterMinPoints: 2,
          promoteId: "courtId",
        },
      },
      layers,
    } as unknown as StyleSpecification;
    // Validazione reale: un filtro o un'espressione sbagliata farebbe
    // fallire addLayer a runtime, non qui.
    expect(validateStyleMin(style)).toEqual([]);
  });
});

describe("courtsForList", () => {
  const courts = [
    { id: "3", name: "zeta", lat: 41.9, lng: 12.5 },
    { id: "1", name: "Alfa", lat: 41.9, lng: 12.5 },
    { id: "2", name: "beta", lat: 41.9, lng: 12.5 },
    { id: "bad", name: "rotto", lat: Number.NaN, lng: 12.5 },
  ];

  it("ordina per nome in italiano e scarta le coordinate rotte", () => {
    expect(courtsForList(courts).map((court) => court.name)).toEqual([
      "Alfa",
      "beta",
      "zeta",
    ]);
  });

  it("rispetta il tetto richiesto senza mutare l'input", () => {
    const before = courts.map((court) => court.name);
    expect(courtsForList(courts, 2)).toHaveLength(2);
    expect(courts.map((court) => court.name)).toEqual(before);
  });
});
