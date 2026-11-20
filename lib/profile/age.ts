/**
 * Eta' minima 14 anni (#97): predicato puro, unica sede della logica testabile.
 * Il form di verifica chiama questo prima dell'INSERT; il DB inchioda comunque
 * con i CHECK di `profile_age` (23514) contro client malevoli.
 *
 * Il confronto e' per data civile nel fuso dell'app (`Europe/Rome`, mai
 * `getFullYear()`/`getDate()` locali: in CI il runner e' in UTC e un utente
 * che compie gli anni oggi a Roma risulterebbe minorenne). Le chiavi
 * `YYYY-MM-DD` si confrontano lessicograficamente.
 */

import { APP_TIME_ZONE, appDateKey } from "@/lib/datetime";

/** Soglie di `profile_age`: sotto i 14 niente account, oltre i 120 data impossibile. */
export const AGE_MIN_YEARS = 14;
export const AGE_MAX_YEARS = 120;

/** "YYYY-MM-DD" con data di calendario reale, o null (vuota, formato, 30/02...). */
export function parseBirthDate(input: string): string | null {
  const raw = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== (m ?? 1) - 1 ||
    dt.getUTCDate() !== d
  )
    return null;
  return raw;
}

/** Sottrae anni civili a una chiave data, clampando il 29/02 al 28/02. */
function shiftYears(dateKey: string, years: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const year = (y ?? 0) + years;
  const month = m ?? 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(Math.min(d ?? 1, lastDay))}`;
}

/**
 * True se la nascita indica almeno 14 anni compiuti oggi (fuso dell'app) e
 * non oltre 120 anni fa. Stringa vuota/non valida, data futura, un giorno
 * prima dei 14, oltre i 120: tutto false (il form non procede, niente INSERT).
 */
export function isAtLeast14(
  birthDate: string,
  now: string | number | Date = new Date(),
  timeZone: string = APP_TIME_ZONE
): boolean {
  const birth = parseBirthDate(birthDate);
  if (birth === null) return false;
  const today = appDateKey(now, timeZone);
  const youngest = shiftYears(today, -AGE_MIN_YEARS);
  const oldest = shiftYears(today, -AGE_MAX_YEARS);
  return birth <= youngest && birth >= oldest;
}
