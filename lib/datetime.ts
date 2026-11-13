/**
 * Orologio unico dell'app (issue #78).
 *
 * I campi sono a Roma: tutti gli orari mostrati sono sempre quelli di Roma,
 * mai del fuso del dispositivo o del runner. Senza `timeZone` esplicito il
 * server (UTC su Vercel/CI) e il browser (Europe/Rome) producono testi
 * diversi per lo stesso ISO → mismatch di idratazione React.
 *
 * Modulo puro: nessuna I/O, `now` iniettabile dove serve (test + SSR
 * deterministico). Mai `getFullYear()`/`getDate()` su un Date locale: le
 * chiavi giorno passano da `Intl.DateTimeFormat` con `timeZone` +
 * `formatToParts` (niente sorprese al confine DST/UTC).
 */

/** Fuso di riferimento di tutti gli orari mostrati. */
export const APP_TIME_ZONE = "Europe/Rome";

/** Chiave giorno `YYYY-MM-DD` di un istante nel fuso dato. */
export function appDateKey(
  date: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Chiave giorno di "oggi" nel fuso dell'app. */
export function todayInAppZone(
  now: string | number | Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): string {
  return appDateKey(now, timeZone);
}

/** Ora `HH:MM` it-IT nel fuso dell'app ("19:40"). */
export function formatAppTime(
  iso: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Date(iso).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** Data estesa it-IT nel fuso dell'app ("giovedì 16 novembre"). */
export function formatAppDate(
  iso: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  });
}

/** Data estesa con anno it-IT nel fuso dell'app ("15 gennaio 2026"). */
export function formatAppDateFull(
  iso: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  });
}

/**
 * Giorno con etichetta relativa ("Oggi, …" / "Ieri, …") calcolata nel fuso
 * dell'app da un `now` iniettabile. Un ISO che in UTC cade "ieri" ma a Roma
 * è già oggi (es. `23:30Z` = `00:30` Roma) rende "Oggi".
 */
export function formatAppDay(
  iso: string | number | Date,
  now: string | number | Date = new Date(),
  timeZone: string = APP_TIME_ZONE,
): string {
  const label = formatAppDate(iso, timeZone);
  const key = appDateKey(iso, timeZone);
  const todayKey = appDateKey(now, timeZone);
  if (key === todayKey) return `Oggi, ${label}`;
  // Ieri = giorno civile precedente nel fuso dell'app (aritmetica su chiave,
  // mai su ore locali: immune al DST).
  const [y, m, d] = todayKey.split("-").map(Number);
  const yesterdayKey = appDateKey(
    Date.UTC(y, (m ?? 1) - 1, d ?? 1) - 24 * 60 * 60 * 1000,
    "UTC",
  );
  if (key === yesterdayKey) return `Ieri, ${label}`;
  return label;
}

/** "16 nov, 19:40" it-IT nel fuso dell'app (card lobby, scadenze report). */
export function formatAppDateTime(
  iso: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/** Scadenza iscrizioni = inizio + 30 min, già formattata `HH:MM`. */
export function formatAppCloseTime(
  iso: string | number | Date,
  timeZone: string = APP_TIME_ZONE,
): string {
  return formatAppTime(new Date(new Date(iso).getTime() + 30 * 60_000), timeZone);
}

/**
 * Scadenza check-in formattata `HH:MM` (check-in + 2h altrove, qui solo
 * formato). Stessa firma di prima: le import esistenti non cambiano.
 */
export function formatExpiry(date: Date, timeZone: string = APP_TIME_ZONE): string {
  return formatAppTime(date, timeZone);
}
