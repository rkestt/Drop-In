// Configurazione provider tile per la mappa.
// Default: OpenFreeMap (vector). Imposta NEXT_PUBLIC_MAP_PROVIDER=osm per tornare a OSM raster.

export type MapProvider = "openfreemap" | "osm";

export const MAP_PROVIDER: MapProvider =
  process.env.NEXT_PUBLIC_MAP_PROVIDER === "osm" ? "osm" : "openfreemap";

// Vincoli TOS OpenFreeMap (vedi https://openfreemap.org):
// - offline: max 3.000 tile o 50 MB per utente
// - max 4 richieste parallele
// - User-Agent identificabile, attribuzione "OpenFreeMap © OpenMapTiles, Data from OpenStreetMap"
// maxTileCacheEntries=600 è conservativo rispetto al limite di 3.000.
const OPENFREEMAP_STYLE_LIGHT = "https://tiles.openfreemap.org/styles/liberty";
const OPENFREEMAP_STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const OPENFREEMAP_ATTRIBUTION =
  'OpenFreeMap &copy; OpenMapTiles Data from OpenStreetMap';

export const MAP_STYLE_URL: Record<"light" | "dark", string> = {
  light: OPENFREEMAP_STYLE_LIGHT,
  dark: OPENFREEMAP_STYLE_DARK,
};

// Stile di fallback quando NEXT_PUBLIC_MAP_PROVIDER=osm: raster puro, nessun
// glyph/sprite. L'attribuzione la fornisce la source.
export const OSM_RASTER_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

export const MAP_ATTRIBUTION: Record<MapProvider, string> = {
  openfreemap: OPENFREEMAP_ATTRIBUTION,
  osm: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

export const MAP_TILE_HOSTS: Record<MapProvider, string[]> = {
  openfreemap: ["tiles.openfreemap.org"],
  osm: ["tile.openstreetmap.org"],
};

// Id della source con le tile nella mappa: serve a distinguere un tile
// caricato dai dati della source `courts` (evento `sourcedata`).
export const MAP_TILE_SOURCE_ID: Record<MapProvider, string> = {
  openfreemap: "openmaptiles",
  osm: "osm",
};

export const MAP_ALLOW_TILE_CACHE = true;

export const MAP_MAX_TILE_CACHE_ENTRIES: Record<MapProvider, number> = {
  openfreemap: 600,
  osm: 1200,
};

export const mapConfig = {
  provider: MAP_PROVIDER,
  styleUrl: MAP_STYLE_URL,
  attribution: MAP_ATTRIBUTION[MAP_PROVIDER],
  tileHosts: MAP_TILE_HOSTS[MAP_PROVIDER],
  tileSourceId: MAP_TILE_SOURCE_ID[MAP_PROVIDER],
  allowTileCache: MAP_ALLOW_TILE_CACHE,
  maxTileCacheEntries: MAP_MAX_TILE_CACHE_ENTRIES[MAP_PROVIDER],
};