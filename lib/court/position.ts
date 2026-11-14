// Modello della posizione per il form di invio campo (#75).
//
// Due fonti, una sola verità: GPS e posizione scelta a mano. La seconda non
// ha accuratezza e non deve mai inventarne una (niente 0, niente numeri
// finti): chi legge la submission deve poter distinguere le due cose.

export type PositionSource = "gps" | "manual";

export interface GpsPosition {
  source: "gps";
  lat: number;
  lng: number;
  /** Metri, dalla Geolocation API. */
  accuracy: number;
}

export interface ManualPosition {
  source: "manual";
  lat: number;
  lng: number;
}

export type CourtPosition = GpsPosition | ManualPosition;

export type CoordinateAxis = "lat" | "lng";

export const ADDRESS_MAX = 200;
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

export interface ParsedCoordinate {
  /** true solo con numero finito dentro il range dell'asse. */
  valid: boolean;
  /** Numero quando `valid`, altrimenti null. */
  value: number | null;
  /** Messaggio italiano quando il testo è presente ma non valido; null se vuoto. */
  error: string | null;
}

// Solo decimali: niente esadecimali, notazione scientifica o Infinity.
// La virgola è accettata come separatore decimale (tastiera italiana).
const DECIMAL_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

export function coordinateError(axis: CoordinateAxis): string {
  return axis === "lat"
    ? `Inserisci una latitudine tra ${LATITUDE_MIN} e ${LATITUDE_MAX}.`
    : `Inserisci una longitudine tra ${LONGITUDE_MIN} e ${LONGITUDE_MAX}.`;
}

export function isValidLatitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= LATITUDE_MIN &&
    value <= LATITUDE_MAX
  );
}

export function isValidLongitude(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= LONGITUDE_MIN &&
    value <= LONGITUDE_MAX
  );
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Converte il testo di un input coordinata.
 *
 * Vuoto non è un errore: significa "non ancora inserita", e il messaggio
 * resta a `null` (l'errore di obbligatorietà lo decide il form al submit).
 */
export function parseCoordinate(raw: string, axis: CoordinateAxis): ParsedCoordinate {
  const compact = raw.trim().replace(",", ".");
  if (compact === "") {
    return { valid: false, value: null, error: null };
  }
  if (!DECIMAL_RE.test(compact)) {
    return { valid: false, value: null, error: coordinateError(axis) };
  }
  const value = Number(compact);
  const inRange =
    axis === "lat"
      ? isValidLatitude(value)
      : isValidLongitude(value);
  if (!inRange) {
    return { valid: false, value: null, error: coordinateError(axis) };
  }
  return { valid: true, value, error: null };
}

/** Valore compatto per riempire un input: al massimo 5 decimali, zeri finali via. */
export function formatCoordinateValue(value: number): string {
  return String(Number(value.toFixed(5)));
}

/** Testo leggibile della coppia scelta (5 decimali, notazione con punto). */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/**
 * Testo digitabile in un input a riga singola: niente a capo, tetto 200.
 * Non trimma: trimmerebbe anche lo spazio che l'utente sta digitando tra due
 * parole (l'input è controllato).
 */
export function clampAddressInput(raw: string): string {
  return raw.replace(/[\r\n\t]+/g, " ").slice(0, ADDRESS_MAX);
}

/** Forma da inviare al DB: una riga sola, spazi normalizzati, tetto 200. */
export function sanitizeAddress(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, ADDRESS_MAX);
}
