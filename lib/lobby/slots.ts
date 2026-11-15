/**
 * Giorni e slot orari del picker "Orario inizio" della lobby (#81).
 *
 * Modulo puro: nessuna I/O, `now` iniettabile. Tutto passa dal fuso
 * `Europe/Rome` (riusa `lib/datetime.ts`): su un telefono in un altro fuso
 * il picker mostra comunque gli orari dei campi di Roma, e il server non
 * deve reinterpretare nulla.
 *
 * L'ISO di ogni slot è un istante VERO, non "mezzanotte locale + ore":
 * l'offset del fuso viene misurato sull'istante candidato e corretto, quindi
 * il cambio DST non sposta gli orari (07:00 a Roma = 05:00Z il 28/03/2027,
 * 06:00Z il 31/10/2027). Niente `getFullYear()`/`getDate()` locali: il fuso
 * del dispositivo o del runner non deve entrarci.
 */

import { APP_TIME_ZONE, appDateKey } from "@/lib/datetime";

/** Primo slot offerto (07:00): prima dei campi non c'è nessuno. */
export const LOBBY_SLOT_START_MINUTES = 7 * 60;

/** Ultimo slot offerto (23:30): una lobby che inizia a mezzanotte è inutile. */
export const LOBBY_SLOT_END_MINUTES = 23 * 60 + 30;

/** Granularità: 30 minuti bastano e dimezzano i tap da 15'. */
export const LOBBY_SLOT_STEP_MINUTES = 30;

/**
 * Preavviso minimo (0): uno slot vale se l'istante è ancora futuro. Il limite
 * vero resta lo schema zod condiviso con il submit.
 */
export const LOBBY_SLOT_LEAD_MINUTES = 0;

/** Orizzonte massimo (14 giorni ≈ due settimane, il doppio della UI). */
export const LOBBY_SLOT_HORIZON_DAYS = 14;

/** Quanti giorni offre il picker per default. */
export const LOBBY_DAY_WINDOW = 7;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Un istante qualsiasi accettato dalle funzioni pubbliche. */
export type DateInput = string | number | Date;

/** Giorno del picker: chiave civile di Roma + etichette già in italiano. */
export interface LobbyDayOption {
  /** `YYYY-MM-DD` nel fuso dell'app. */
  key: string;
  /** Etichetta visibile: "Oggi", "Domani", "gio 20 nov". */
  label: string;
  /** Etichetta estesa per `aria-label`: "Oggi, sabato 15 novembre". */
  ariaLabel: string;
}

/** Uno slot orario del giorno scelto. */
export interface LobbyTimeSlot {
  /** Ora civile di Roma `HH:MM`. */
  time: string;
  /** Istante ISO (UTC) da passare allo schema/react-hook-form. */
  iso: string;
  /** Passato, nel preavviso minimo o oltre l'orizzonte massimo. */
  disabled: boolean;
}

export interface LobbyTimeSlotOptions {
  /** Primo slot in minuti dalla mezzanotte (default 07:00). */
  startMinutes?: number;
  /** Ultimo slot, incluso (default 23:30). */
  endMinutes?: number;
  /** Passo in minuti (default 30). */
  stepMinutes?: number;
  /** Preavviso minimo in minuti (default 0). */
  leadMinutes?: number;
  /** Orizzonte massimo in giorni da `now` (default 14). */
  horizonDays?: number;
  /** Fuso di riferimento (default `Europe/Rome`, sovrascrivibile nei test). */
  timeZone?: string;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formatter dei componenti civili di un istante in un fuso.
 *
 * `hourCycle: "h23"` evita il caso "24" di mezzanotte; `formatToParts` è
 * l'API stabile fra engine. Non si parsa `timeZoneName: "longOffset"`:
 * Safari per anni ha reso "GMT+2" invece di "GMT+02:00", un parse fragile.
 */
function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = offsetFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts = offsetFormatter(timeZone).formatToParts(new Date(instantMs));
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year ?? 0,
    month: values.month ?? 1,
    day: values.day ?? 1,
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
    second: values.second ?? 0,
  };
}

/** Offset del fuso (ms) a un dato istante: `locale - UTC`. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - instantMs;
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Istante (ms) di un'ora civile (`HH:MM`) di un giorno (`YYYY-MM-DD`) nel fuso.
 *
 * Fail loud, mai `Invalid Date` silenzioso: un `dayKey`/`time` malformato
 * lancia `RangeError` con un messaggio che dice cosa ci si aspettava. Il
 * vecchio codice faceva `split("-").map(Number)` senza controlli e
 * `Date.UTC(NaN…)` o un `Intl` su input assurdi produceva `RangeError`
 * generici dal formatter o, peggio, date normalizzate in silenzio.
 *
 * Due passaggi: si misura l'offset sull'ipotesi "ora civile = UTC", si
 * corregge, e si rimisura sull'istante corretto. Fuori dall'ora che il DST
 * salta/duplica (in Europa 02:00–03:00, mai nella nostra finestra) il
 * risultato è esatto; nella finestra si ottiene comunque un istante
 * plausibile, deterministico.
 */
export function zonedTimeToInstant(
  dayKey: string,
  time: string,
  timeZone: string = APP_TIME_ZONE,
): number {
  if (!DAY_KEY_RE.test(dayKey)) {
    throw new RangeError(
      `dayKey non valido "${dayKey}": atteso il formato YYYY-MM-DD`,
    );
  }
  if (!TIME_RE.test(time)) {
    throw new RangeError(
      `time non valido "${time}": atteso il formato HH:MM`,
    );
  }
  const [year, month, day] = dayKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (
    month == null ||
    day == null ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new RangeError(
      `dayKey non valido "${dayKey}": mese 01–12 e giorno 01–31`,
    );
  }
  if (hour == null || minute == null || hour > 23 || minute > 59) {
    throw new RangeError(
      `time non valido "${time}": ora 00–23 e minuti 00–59`,
    );
  }
  const guess = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const firstOffset = zoneOffsetMs(guess, timeZone);
  let instant = guess - firstOffset;
  const secondOffset = zoneOffsetMs(instant, timeZone);
  if (secondOffset !== firstOffset) instant = guess - secondOffset;
  return instant;
}

const dayLabelFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const dayAriaFormatter = new Intl.DateTimeFormat("it-IT", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/**
 * Giorni del picker, a partire da "oggi" nel fuso dell'app.
 *
 * Le chiavi si costruiscono con aritmetica UTC sulla chiave civile (mai su
 * ore locali): il giorno dopo la mezzanotte di Roma resta il giorno dopo
 * anche se il runner è in UTC, e il DST non salta né duplica giorni.
 *
 * `days` è reso sicuro: `Math.floor` + clamp 0..31, così `2.5` vale 2 (mai
 * 3 a sorpresa) e `Infinity`/`NaN` non possono causare un loop infinito
 * (`Infinity` → 31, `NaN`/`-Infinity` → 0 giorni).
 */
export function lobbyDayOptions(
  now: DateInput = new Date(),
  days: number = LOBBY_DAY_WINDOW,
): LobbyDayOption[] {
  const count = Number.isFinite(days)
    ? Math.min(Math.max(Math.floor(days), 0), 31)
    : days === Infinity
      ? 31
      : 0;
  if (count <= 0) return [];
  const todayKey = appDateKey(now, APP_TIME_ZONE);
  const [year, month, day] = todayKey.split("-").map(Number);
  const options: LobbyDayOption[] = [];

  for (let index = 0; index < count; index += 1) {
    // Mezzogiorno UTC: dentro il giorno in qualunque fuso, nessun bordo.
    const date = new Date(
      Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + index, 12),
    );
    const key = appDateKey(date, "UTC");
    const dateLabel = dayLabelFormatter.format(date);
    const ariaDate = dayAriaFormatter.format(date);
    const relative = index === 0 ? "Oggi" : index === 1 ? "Domani" : null;
    options.push({
      key,
      label: relative ?? dateLabel,
      ariaLabel: relative
        ? `${relative}, ${dateLabel}, ${ariaDate}`
        : `${dateLabel}, ${ariaDate}`,
    });
  }

  return options;
}

/**
 * Slot del giorno scelto, in ordine cronologico.
 *
 * `disabled` = istante già passato (o dentro il preavviso), oppure oltre
 * l'orizzonte massimo. Gli slot passati restano nella lista (la UI può
 * mostrarne il confine), non vengono filtrati qui: la generazione è pura e
 * il filtro è una decisione di presentazione.
 *
 * Input resi sicuri (fail loud): `stepMinutes` deve essere un intero
 * positivo, `startMinutes`/`endMinutes` interi non negativi, `horizonDays`
 * un intero finito — poi cappato a 31 giorni (oltre non ha senso per una
 * lobby: il picker ne mostra 7, il default ne copre 14).
 */
export function lobbyTimeSlots(
  dayKey: string,
  now: DateInput = new Date(),
  options: LobbyTimeSlotOptions = {},
): LobbyTimeSlot[] {
  const {
    startMinutes = LOBBY_SLOT_START_MINUTES,
    endMinutes = LOBBY_SLOT_END_MINUTES,
    stepMinutes = LOBBY_SLOT_STEP_MINUTES,
    leadMinutes = LOBBY_SLOT_LEAD_MINUTES,
    horizonDays = LOBBY_SLOT_HORIZON_DAYS,
    timeZone = APP_TIME_ZONE,
  } = options;

  if (!Number.isInteger(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError(
      `stepMinutes non valido "${stepMinutes}": atteso un intero positivo`,
    );
  }
  if (!Number.isInteger(startMinutes) || startMinutes < 0) {
    throw new RangeError(
      `startMinutes non valido "${startMinutes}": atteso un intero non negativo`,
    );
  }
  if (!Number.isInteger(endMinutes) || endMinutes < 0) {
    throw new RangeError(
      `endMinutes non valido "${endMinutes}": atteso un intero non negativo`,
    );
  }
  if (!Number.isInteger(horizonDays) || !Number.isFinite(horizonDays)) {
    throw new RangeError(
      `horizonDays non valido "${horizonDays}": atteso un intero finito`,
    );
  }
  const cappedHorizon = Math.min(horizonDays, 31);

  const nowMs = new Date(now).getTime();
  const earliest = nowMs + leadMinutes * MINUTE_MS;
  const latest = nowMs + cappedHorizon * DAY_MS;
  const slots: LobbyTimeSlot[] = [];

  for (let minutes = startMinutes; minutes <= endMinutes; minutes += stepMinutes) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const instant = zonedTimeToInstant(dayKey, time, timeZone);
    slots.push({
      time,
      iso: new Date(instant).toISOString(),
      disabled: instant <= earliest || instant > latest,
    });
  }

  return slots;
}

/** Primo slot ancora selezionabile, o `undefined` se il giorno è chiuso. */
export function firstSelectableSlot(
  slots: readonly LobbyTimeSlot[],
): LobbyTimeSlot | undefined {
  return slots.find((slot) => !slot.disabled);
}
