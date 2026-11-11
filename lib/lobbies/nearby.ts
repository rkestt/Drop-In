/**
 * Filtro "Partite vicine" (bug #48, ticket d20): solo lobby entro il raggio,
 * mai tutta Italia. Funzioni pure e testate; il componente
 * `NearbyLobbies` si limita a caricare i dati e a chiamarle.
 *
 * Coordinate assenti o non numeriche → ESCLUSE, mai mostrate con distanza
 * indefinita (`NaN > raggio` è `false` e le farebbe passare: guardia
 * esplicita qui, non nel componente).
 */

/** Raggio "Vicine": stesso default del RPC `nearby_courts`. */
export const NEARBY_RADIUS_M = 15000;

/** Max candidate aperte: le lobby sono effimere (auto-chiusura via cron). */
export const OPEN_LOBBIES_LIMIT = 100;

/** Haversine in metri (nessuna dipendenza). */
export function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function isFiniteCoord(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Distanza utente→campo, o `null` se le coordinate del campo mancano o non
 * sono numeriche. `null` = "non affermabile che sia vicina" → il chiamante
 * esclude la riga (non esiste "distanza sconosciuta" in una tab "Vicine").
 */
export function courtDistanceM(
  userLat: number,
  userLng: number,
  courtLat: number | null | undefined,
  courtLng: number | null | undefined
): number | null {
  if (!isFiniteCoord(courtLat) || !isFiniteCoord(courtLng)) return null;
  return haversineM(userLat, userLng, courtLat, courtLng);
}

/** True solo con distanza reale entro il raggio. */
export function isWithinRadiusM(
  userLat: number,
  userLng: number,
  courtLat: number | null | undefined,
  courtLng: number | null | undefined,
  radiusM: number = NEARBY_RADIUS_M
): boolean {
  const d = courtDistanceM(userLat, userLng, courtLat, courtLng);
  return d !== null && d <= radiusM;
}

/** Centro fallback: Roma, stessa origine storica della home. */
export const ROME_CENTER = { lat: 41.8919, lng: 12.5113 };

export interface LobbiesOrigin {
  lat: number;
  lng: number;
}

/** Centro di una BBox {n,s,e,w} (media aritmetica dei bordi). */
export function bboxCenter(b: {
  n: number;
  s: number;
  e: number;
  w: number;
}): LobbiesOrigin {
  return { lat: (b.n + b.s) / 2, lng: (b.e + b.w) / 2 };
}

/**
 * Origine del filtro raggio lobby (bug #48, Fase B): posizione geolocalizzata
 * dell'utente (tupla MapLibre [lng, lat]) → centro della mappa → fallback.
 * Ordine deciso: userLocation ?? lastBounds center ?? ROME_CENTER. Il cambio
 * sport non tocca l'origine: la legge dai ref al momento della fetch.
 */
export function selectLobbiesOrigin(
  userLngLat: readonly [number, number] | null | undefined,
  bounds: { n: number; s: number; e: number; w: number } | null | undefined,
  fallback: LobbiesOrigin = ROME_CENTER
): LobbiesOrigin {
  if (userLngLat) return { lat: userLngLat[1], lng: userLngLat[0] };
  if (bounds) return bboxCenter(bounds);
  return fallback;
}

/** "400 m" sotto il km, "2,4 km" sopra (it-IT). */
export function formatDistanceM(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km`;
}
