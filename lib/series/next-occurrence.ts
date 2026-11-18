/**
 * Prossima Occorrenza di una Serie (#92), calcolata in `Europe/Rome`.
 *
 * Modulo puro: nessuna I/O, `now` iniettabile così i test non dipendono
 * dall'ora reale. Stessa regola del generatore SQL (046): l'ora è quella
 * locale del campo, mai aritmetica UTC ingenua su `time_of_day` (DST).
 *
 * Uso: solo anteprima pre-creazione (il drawer mostra "prima occorrenza:
 * giovedì 20:00" prima che esistano righe). La verità post-creazione sono
 * le righe `lobbies` reali, lette da `lib/series/client.ts` (addendum #92).
 */

import { APP_TIME_ZONE } from "@/lib/datetime";

/** Etichette italiane dei giorni ISO (1 = lunedì) per il badge "giovedì 20:00". */
export const SERIES_WEEKDAY_LABELS = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
] as const;

/** Etichetta italiana del giorno ISO, `null` fuori 1..7. */
export function seriesWeekdayLabel(weekday: number): string | null {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  return SERIES_WEEKDAY_LABELS[weekday - 1];
}

/**
 * `HH:MM` → `HH:MM:SS` per la colonna `TIME` (044). `HH:MM:SS` passa
 * invariato; il resto torna `null` (lo schema zod lo rifiuta prima).
 */
export function normalizeTimeOfDay(raw: string): string | null {
  const t = raw.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return `${t}:00`;
  if (/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(t)) return t;
  return null;
}

const DAY_MS = 86_400_000;

const romeDateFmt = (date: Date): { y: number; m: number; d: number } => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
  return { y: get("year"), m: get("month"), d: get("day") };
};

/**
 * Parete di Roma (`YYYY-MM-DD`, `HH:MM`) → istante UTC. Il fuso si ricava
 * dall'istante stesso (iterazione punto fisso, converge in 2 passi anche a
 * cavallo del cambio ora): niente offset hardcoded, niente `getTimezoneOffset`
 * dell'host (in CI è UTC, sul telefono è Roma).
 */
function romeWallToUtcMs(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): number {
  const target = Date.UTC(y, m - 1, d, hour, minute, 0);
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));
    const get = (type: string): number =>
      Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
    const asUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );
    guess += target - asUtc;
  }
  return guess;
}

/** ISO 1..7 del giorno UTC (stessa formula usata nei test). */
function isoDowUtc(ms: number): number {
  return ((new Date(ms).getUTCDay() + 6) % 7) + 1;
}

/**
 * Prossima Occorrenza dopo `now` (ISO UTC). Scorre gli 8 giorni da oggi
 * (oggi incluso, domani alla stessa ora incluso): il primo `weekday`
 * con ora futura vince. `null` con `weekday`/`timeOfDay` malformati.
 */
export function nextSeriesOccurrence(
  weekday: number,
  timeOfDay: string,
  now: Date | number | string = Date.now(),
): string | null {
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return null;
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(
    timeOfDay.trim(),
  );
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);

  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(nowMs)) return null;

  const { y, m, d } = romeDateFmt(new Date(nowMs));
  const baseUtc = Date.UTC(y, m - 1, d);

  for (let i = 0; i < 8; i++) {
    const dayMs = baseUtc + i * DAY_MS;
    if (isoDowUtc(dayMs) !== weekday) continue;
    const day = new Date(dayMs);
    const candidate = romeWallToUtcMs(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hour,
      minute,
    );
    if (candidate > nowMs) return new Date(candidate).toISOString();
  }
  return null;
}
