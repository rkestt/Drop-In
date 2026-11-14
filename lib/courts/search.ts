/**
 * Ricerca campi server-side (#68).
 *
 * La ricerca è **per raggio dal centro mappa**, non dentro il viewport: il
 * filtro in memoria non può trovare campi fuori dal set già caricato, mentre
 * `nearby_courts` con `p_query` sì. Qui vive tutto ciò che è puro e testabile
 * senza DOM: normalizzazione, decisione "serve una fetch?", limiti della RPC,
 * origine del raggio e mapper tipizzato della risposta.
 */

/** Raggio della ricerca: più ampio del browse (15 km) per trovare per nome. */
export const SEARCH_RADIUS_M = 25_000;

/** Tetto risultati: la lista è una risposta, non un secondo archivio. */
export const SEARCH_LIMIT = 50;

/** Attesa dopo l'ultimo tasto prima di interrogare il server. */
export const SEARCH_DEBOUNCE_MS = 300;

export type SearchPhase = "idle" | "waiting" | "loading" | "ready" | "error";

/**
 * Forma campo usata dalla home (viewport e ricerca).
 *
 * `source` e `moderation_status` sono opzionali perché `nearby_courts` non li
 * ritorna: dichiararli obbligatori costringerebbe a un cast che mente. La UI
 * della home non li usa; restano popolati solo quando arrivano da
 * `courts_in_viewport`.
 */
export interface Court {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
  status: string | null;
  sport: string | null;
  venue_type: string | null;
  photo_path: string | null;
  source?: string | null;
  moderation_status?: string | null;
  /** Solo ricerca per raggio: metri dal centro della ricerca. */
  distance_m?: number | null;
}

/**
 * Riga grezza di `nearby_courts` (migrazione 022). I campi che nel database
 * sono nullable restano nullable anche qui, anche dove i tipi generati sono
 * più ottimisti: il mapper non deve mai inventare valori.
 */
export interface NearbyCourtRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  surface_type: string | null;
  hoop_count: number | null;
  venue_type: string | null;
  sport: string | null;
  status: string | null;
  distance_m: number | null;
  photo_path: string | null;
}

export interface SearchOrigin {
  lat: number;
  lng: number;
}

/**
 * Testo da mandare a `p_query`: trim + spazi interni compattati, ma accenti e
 * maiuscole restano. `ILIKE` nel database è case-insensitive, ma NON ignora
 * gli accenti: mandare "citta" non troverebbe "Città". La normalizzazione
 * senza accenti serve solo a capire se la query è cambiata.
 */
export function searchQueryText(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Identità della query: minuscolo, senza diacritici, spazi compattati. */
export function normalizeSearchQuery(raw: string): string {
  return searchQueryText(raw)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** True quando c'è qualcosa da cercare (solo spazi = nessuna ricerca). */
export function isSearchActive(raw: string): boolean {
  return normalizeSearchQuery(raw).length > 0;
}

/**
 * Serve una nuova fetch? Solo con query non vuota e diversa dall'ultima
 * richiesta (confronto normalizzato: "Roma " e "roma" sono la stessa).
 */
export function shouldFetchSearch(
  next: string,
  last: string | null | undefined
): boolean {
  const normalized = normalizeSearchQuery(next);
  if (!normalized) return false;
  return normalized !== normalizeSearchQuery(last ?? "");
}

/**
 * Origine del raggio di ricerca: centro mappa corrente → posizione utente →
 * fallback. Ordine deliberatamente diverso da `selectLobbiesOrigin` (che
 * preferisce la posizione): la ricerca è "intorno a ciò che sto guardando".
 */
export function selectSearchOrigin(
  bounds: { n: number; s: number; e: number; w: number } | null | undefined,
  userLngLat: readonly [number, number] | null | undefined,
  fallback: SearchOrigin
): SearchOrigin {
  if (bounds) {
    return { lat: (bounds.n + bounds.s) / 2, lng: (bounds.e + bounds.w) / 2 };
  }
  if (userLngLat) return { lat: userLngLat[1], lng: userLngLat[0] };
  return fallback;
}

/** Riga RPC → campo della home. Null espliciti, mai campi inventati. */
export function mapNearbyCourtRow(row: NearbyCourtRow): Court {
  const distance =
    typeof row.distance_m === "number" && Number.isFinite(row.distance_m)
      ? row.distance_m
      : null;
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    address: row.address ?? null,
    surface_type: row.surface_type ?? null,
    hoop_count: row.hoop_count ?? null,
    status: row.status ?? null,
    sport: row.sport ?? null,
    venue_type: row.venue_type ?? null,
    photo_path: row.photo_path ?? null,
    distance_m: distance,
  };
}

/**
 * Coordinate mappabili: `setLngLat` con NaN/null/undefined esplode o
 * piazza marker fantasma. Le righe RPC e la cache offline passano di qui
 * prima di finire in `courts` (browse, ricerca, fallback cache).
 */
export function hasFiniteCourtCoords<C extends Pick<Court, "lat" | "lng">>(
  court: C | null | undefined
): court is C {
  if (court == null) return false;
  return (
    typeof court.lat === "number" &&
    typeof court.lng === "number" &&
    Number.isFinite(court.lat) &&
    Number.isFinite(court.lng)
  );
}

const SPORT_LABELS: Record<string, string> = {
  basketball: "Basket",
  soccer: "Calcio",
  tennis: "Tennis",
  padel: "Padel",
  futsal: "Calcio a 5",
  volleyball: "Pallavolo",
  multi: "Polivalente",
};

/** `basketball;soccer` → "Basket · Calcio"; sconosciuti restano leggibili. */
export function courtSportsLabel(
  sport: string | null | undefined
): string | null {
  if (!sport) return null;
  const labels = sport
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => SPORT_LABELS[s] ?? s);
  if (labels.length === 0) return null;
  return [...new Set(labels)].join(" · ");
}

/**
 * Etichetta sport sempre pronta per la UI (#71/#72): mai null, cosi' la riga
 * di ricerca e la card lobby non devono gestire il caso vuoto. `NULL`
 * (sport non specificato) resta visibile con qualunque filtro e lo dichiara:
 * "Sport non specificato". Stringhe vuote o sole `;` valgono come NULL.
 */
export function sportDisplayLabel(sport: string | null | undefined): string {
  return courtSportsLabel(sport) ?? "Sport non specificato";
}

const VENUE_LABELS: Record<string, string> = {
  park: "Parco",
  playground: "Parco giochi",
  recreation_ground: "Area ricreativa",
  green_space: "Spazio verde",
  open_space: "Spazio aperto",
};

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "Asfalto",
  concrete: "Cemento",
  wood: "Legno",
  grass: "Erba",
  rubber: "Gomma",
  tartan: "Tartan",
  paving_stones: "Pavimentazione",
  ground: "Terra",
  clay: "Terra battuta",
};

/**
 * Fondo campo leggibile. I valori noti del form/dataset hanno un'etichetta
 * italiana; gli altri restano come sono (mai inventare un vocabolo).
 */
export function surfaceTypeLabel(
  surfaceType: string | null | undefined
): string | null {
  if (!surfaceType) return null;
  return SURFACE_LABELS[surfaceType] ?? surfaceType;
}

/**
 * Tipo di luogo leggibile. I valori `field_*` del seed sono tutti "Campo";
 * gli altri vocabolari non mappati restano fuori (niente gergo tecnico).
 */
export function venueTypeLabel(
  venueType: string | null | undefined
): string | null {
  if (!venueType) return null;
  if (venueType.startsWith("field_")) return "Campo";
  return VENUE_LABELS[venueType] ?? null;
}
