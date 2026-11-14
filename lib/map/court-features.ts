/**
 * Linguaggio dei marker (#41) e clustering GeoJSON (#42).
 *
 * Modulo puro: niente DOM, niente MapLibre a runtime. Produce la
 * FeatureCollection da dare alla source `courts` e le specifiche dei layer
 * (in forma strutturale) che `court-map.tsx` aggiunge alla mappa.
 *
 * Il basemap e' sempre light (decisione 0002): i marker hanno un anello scuro
 * (`--bg-elevated`) che li stacca dalle tile chiare, mentre la UI attorno e'
 * dark. I colori non sono mai esadecimali: qui vivono solo i *nomi* dei token,
 * risolti a runtime da `readCourtPalette` (vedi `court-map.tsx`).
 */
import type { FeatureCollection, Point } from "geojson";

export const COURT_SOURCE_ID = "courts";

export const COURT_LAYER_IDS = {
  /** Piastra scura dietro il campo selezionato (sotto i punti). */
  selectedHalo: "courts-selected-halo",
  points: "courts-points",
  lobbyCount: "courts-lobby-count",
  reportedGlyph: "courts-reported-glyph",
  clusters: "courts-clusters",
  clusterCount: "courts-cluster-count",
} as const;

/** Raggio di aggregazione in px: 50 tiene separati i campi di uno stesso parco. */
export const CLUSTER_RADIUS = 50;
/** Oltre questo zoom niente cluster: i campi si vedono singolarmente. */
export const CLUSTER_MAX_ZOOM = 14;
/** Minimo di punti per formare un cluster (2 evita il “cluster da 1”). */
export const CLUSTER_MIN_POINTS = 2;

/** Padding del tap attorno a un punto: 2 * 22px = target da 44px (#41/#44). */
export const POINT_HIT_PADDING = 22;

/** Tetto della lista accessibile dei campi visibili (#44). */
export const COURT_LIST_LIMIT = 30;

export type CourtMarkerState = "default" | "favorite" | "lobby" | "reported";

/** Token CSS usati dai marker. Le chiavi sono i nomi semantici, non i valori. */
export type CourtTokenName =
  | "accent"
  | "accentHover"
  | "accentForeground"
  | "danger"
  | "dangerForeground"
  | "bgElevated"
  | "textPrimary";

export interface CourtPalette {
  accent: string;
  accentHover: string;
  accentForeground: string;
  danger: string;
  dangerForeground: string;
  bgElevated: string;
  textPrimary: string;
}

export interface CourtMarkerInput {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address?: string | null;
}

export interface CourtMarkerOptions {
  /** Campo con l'anteprima aperta: piastra + punto ingrandito. */
  selectedId?: string | null;
  favoriteIds?: ReadonlySet<string>;
  reportedIds?: ReadonlySet<string>;
  lobbyCounts?: Readonly<Record<string, number>>;
}

export interface CourtFeatureProperties {
  courtId: string;
  name: string;
  address: string | null;
  markerState: CourtMarkerState;
  favorite: boolean;
  reported: boolean;
  lobbyCount: number;
  /** Etichetta dentro il pallino lobby: "1"…"9", "9+" oltre. */
  lobbyLabel: string;
  selected: boolean;
  /** Raggio in px, calcolato dallo stato: la spec del layer lo legge da qui. */
  radius: number;
}

export interface CourtFeatureState {
  favorite: boolean;
  reported: boolean;
  lobbyCount: number;
}

/**
 * Stato del marker: uno solo per campo, con priorita' esplicita.
 *
 * `reported` > `lobby` > `favorite` > `default`: il marker racconta lo stato
 * piu' urgente, il resto (preferito, tipo di campo, foto) sta nell'anteprima.
 * La priorita' e' dichiarata qui perche' la usano sia il colore sia i test.
 */
export function resolveMarkerState({
  favorite,
  reported,
  lobbyCount,
}: CourtFeatureState): CourtMarkerState {
  if (reported) return "reported";
  if (lobbyCount > 0) return "lobby";
  if (favorite) return "favorite";
  return "default";
}

export interface CourtMarkerVisual {
  radius: number;
  fill: CourtTokenName;
  stroke: CourtTokenName;
  strokeWidth: number;
  label: "none" | "lobby" | "alert";
  labelColor: CourtTokenName;
}

/**
 * Tabella vincolante del linguaggio marker. Forme/size diverse, non solo
 * colore: un daltonico distingue "pallino pieno", "ciambella", "pallino con
 * numero" e "pallino con !".
 */
export const MARKER_VISUALS: Record<CourtMarkerState, CourtMarkerVisual> = {
  default: {
    radius: 7,
    fill: "accent",
    stroke: "bgElevated",
    strokeWidth: 2,
    label: "none",
    labelColor: "accentForeground",
  },
  favorite: {
    // Ciambella: centro scuro, anello accent. Silhouette diversa dal pieno.
    radius: 7,
    fill: "bgElevated",
    stroke: "accent",
    strokeWidth: 3,
    label: "none",
    labelColor: "accentForeground",
  },
  lobby: {
    // Piu' grande e con il numero di lobby: la gerarchia si vede a colpo d'occhio.
    radius: 11,
    fill: "accent",
    stroke: "bgElevated",
    strokeWidth: 2.5,
    label: "lobby",
    labelColor: "accentForeground",
  },
  reported: {
    radius: 8,
    fill: "danger",
    stroke: "bgElevated",
    strokeWidth: 2,
    label: "alert",
    labelColor: "dangerForeground",
  },
};

export const SELECTED_HALO = {
  extraRadius: 7,
  fill: "bgElevated" as CourtTokenName,
  stroke: "accentHover" as CourtTokenName,
  strokeWidth: 2,
};

/** Diametro cluster per numero di punti: il cluster cresce con la densita'. */
export const CLUSTER_TIERS = [
  { min: 0, radius: 17 },
  { min: 10, radius: 21 },
  { min: 50, radius: 25 },
  { min: 200, radius: 29 },
] as const;

export const CLUSTER_STROKE_WIDTH = 3;

/** Raggio del cluster per un dato `point_count` (minimo 17px = 34px di target). */
export function clusterRadius(pointCount: number): number {
  let radius: number = CLUSTER_TIERS[0].radius;
  for (const tier of CLUSTER_TIERS) {
    if (pointCount >= tier.min) radius = tier.radius;
  }
  return radius;
}

/** `["step", ["get","point_count"], …]` costruito dalla tabella, non a mano. */
export function clusterRadiusExpression(): unknown[] {
  const [first, ...rest] = CLUSTER_TIERS;
  const expression: unknown[] = ["step", ["get", "point_count"], first.radius];
  for (const tier of rest) {
    expression.push(tier.min, tier.radius);
  }
  return expression;
}

/** "9+" oltre 9: dentro un cerchio da 22px ci stanno due caratteri. */
export function lobbyLabel(lobbyCount: number): string {
  if (!Number.isFinite(lobbyCount) || lobbyCount <= 0) return "";
  return lobbyCount > 9 ? "9+" : String(lobbyCount);
}

function hasFiniteCoords(court: CourtMarkerInput): boolean {
  return (
    Number.isFinite(court.lat) &&
    Number.isFinite(court.lng) &&
    typeof court.id === "string" &&
    court.id !== ""
  );
}

/**
 * FeatureCollection della source `courts`.
 *
 * - coordinate non finite: la feature non entra (mai un punto fantasma);
 * - `courtId` e' la proprieta' promossa a feature id (`promoteId`), usata da
 *   `setFeatureState` per l'hover;
 * - `radius` e' precalcolato: la spec del layer non ripete la tabella.
 */
export function buildCourtFeatureCollection(
  courts: ReadonlyArray<CourtMarkerInput>,
  options: CourtMarkerOptions = {}
): FeatureCollection<Point, CourtFeatureProperties> {
  const features: FeatureCollection<Point, CourtFeatureProperties>["features"] =
    [];
  for (const court of courts) {
    if (!hasFiniteCoords(court)) continue;
    const favorite = options.favoriteIds?.has(court.id) ?? false;
    const reported = options.reportedIds?.has(court.id) ?? false;
    const lobbyCount = Math.max(0, options.lobbyCounts?.[court.id] ?? 0);
    const markerState = resolveMarkerState({ favorite, reported, lobbyCount });
    features.push({
      type: "Feature",
      id: court.id,
      geometry: { type: "Point", coordinates: [court.lng, court.lat] },
      properties: {
        courtId: court.id,
        name: court.name,
        address: court.address ?? null,
        markerState,
        favorite,
        reported,
        lobbyCount,
        lobbyLabel: lobbyLabel(lobbyCount),
        selected: options.selectedId != null && options.selectedId === court.id,
        radius: MARKER_VISUALS[markerState].radius,
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Forma strutturale di un layer: `court-map.tsx` la converte in LayerSpecification. */
export interface CourtLayerSpec {
  id: string;
  type: "circle" | "symbol";
  source: string;
  filter?: unknown;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
}

const POINT_FILTER = ["!", ["has", "point_count"]];
const CLUSTER_FILTER = ["has", "point_count"];

function markerMatch(
  palette: CourtPalette,
  mapping: Record<CourtMarkerState, string>
): unknown[] {
  return [
    "match",
    ["get", "markerState"],
    "reported",
    mapping.reported,
    "favorite",
    mapping.favorite,
    "lobby",
    mapping.lobby,
    mapping.default,
  ];
}

/**
 * Layer dei campi, in ordine di disegno (prima = sotto).
 *
 * I colori arrivano dalla palette gia' risolta: MapLibre non legge le CSS
 * custom property, quindi la risoluzione avviene una volta per istanza.
 */
export function buildCourtLayers(palette: CourtPalette): CourtLayerSpec[] {
  const POINT_RADIUS: unknown[] = [
    "case",
    ["boolean", ["feature-state", "hover"], false],
    ["+", ["get", "radius"], 2],
    ["get", "radius"],
  ];

  return [
    {
      id: COURT_LAYER_IDS.selectedHalo,
      type: "circle",
      source: COURT_SOURCE_ID,
      filter: ["==", ["get", "selected"], true],
      paint: {
        "circle-radius": ["+", ["get", "radius"], SELECTED_HALO.extraRadius],
        "circle-color": palette[SELECTED_HALO.fill],
        "circle-stroke-color": palette[SELECTED_HALO.stroke],
        "circle-stroke-width": SELECTED_HALO.strokeWidth,
        "circle-opacity": 0.92,
      },
    },
    {
      id: COURT_LAYER_IDS.points,
      type: "circle",
      source: COURT_SOURCE_ID,
      filter: POINT_FILTER,
      paint: {
        "circle-radius": POINT_RADIUS,
        "circle-color": markerMatch(palette, {
          reported: palette.danger,
          favorite: palette.bgElevated,
          lobby: palette.accent,
          default: palette.accent,
        }),
        "circle-stroke-color": markerMatch(palette, {
          reported: palette.bgElevated,
          favorite: palette.accent,
          lobby: palette.bgElevated,
          default: palette.bgElevated,
        }),
        "circle-stroke-width": [
          "match",
          ["get", "markerState"],
          "favorite",
          MARKER_VISUALS.favorite.strokeWidth,
          "lobby",
          MARKER_VISUALS.lobby.strokeWidth,
          "reported",
          MARKER_VISUALS.reported.strokeWidth,
          MARKER_VISUALS.default.strokeWidth,
        ],
      },
    },
    {
      id: COURT_LAYER_IDS.lobbyCount,
      type: "symbol",
      source: COURT_SOURCE_ID,
      filter: ["all", POINT_FILTER, ["==", ["get", "markerState"], "lobby"]],
      layout: {
        "text-field": ["get", "lobbyLabel"],
        "text-font": ["Noto Sans Bold"],
        "text-size": 11,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": palette.accentForeground,
      },
    },
    {
      id: COURT_LAYER_IDS.reportedGlyph,
      type: "symbol",
      source: COURT_SOURCE_ID,
      filter: ["all", POINT_FILTER, ["==", ["get", "markerState"], "reported"]],
      layout: {
        "text-field": "!",
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": palette.dangerForeground,
      },
    },
    {
      id: COURT_LAYER_IDS.clusters,
      type: "circle",
      source: COURT_SOURCE_ID,
      filter: CLUSTER_FILTER,
      paint: {
        "circle-radius": clusterRadiusExpression(),
        "circle-color": palette.bgElevated,
        "circle-stroke-color": palette.accent,
        "circle-stroke-width": CLUSTER_STROKE_WIDTH,
      },
    },
    {
      id: COURT_LAYER_IDS.clusterCount,
      type: "symbol",
      source: COURT_SOURCE_ID,
      filter: CLUSTER_FILTER,
      layout: {
        "text-field": ["to-string", ["get", "point_count_abbreviated"]],
        "text-font": ["Noto Sans Bold"],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": palette.textPrimary,
      },
    },
  ];
}

/**
 * Campi della lista accessibile (#44): coordinate valide, ordine alfabetico
 * italiano, tetto di 30. Non dipende dal viewport: la lista e' l'alternativa
 * leggibile ai punti sulla mappa.
 */
export function courtsForList(
  courts: ReadonlyArray<CourtMarkerInput>,
  limit = COURT_LIST_LIMIT
): CourtMarkerInput[] {
  return [...courts]
    .filter(hasFiniteCoords)
    .sort((a, b) => a.name.localeCompare(b.name, "it"))
    .slice(0, Math.max(0, limit));
}
