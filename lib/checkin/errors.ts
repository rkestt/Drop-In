/**
 * Mappa errori del check-in in testi italiani con recovery (d21).
 *
 * Modulo puro: nessuna I/O, nessuna geolocalizzazione, nessun Supabase.
 * Le regole (50 m, accuratezza 20 m, timeout 2h) restano nel DB/pg_cron:
 * qui si traducono solo i messaggi in stati UI raggiungibili.
 */

export const CHECK_IN_RADIUS_M = 50;
export const CHECK_IN_MAX_ACCURACY_M = 20;
export const CHECK_IN_DURATION_MS = 2 * 60 * 60 * 1000;

export type CheckInErrorKind =
  | "denied"
  | "unavailable"
  | "timeout"
  | "low-accuracy"
  | "out-of-range"
  | "already-inside"
  | "cooldown"
  | "court-not-approved"
  | "auth"
  | "server";

export interface CheckInErrorInfo {
  kind: CheckInErrorKind;
  title: string;
  body: string;
  hint?: string;
  retryLabel: string;
}

const RETRY = "Riprova";

export function fromGeolocationCode(code: number): CheckInErrorInfo {
  if (code === 1) {
    return {
      kind: "denied",
      title: "Permesso posizione negato",
      body: "Abilitalo nelle impostazioni e riprova.",
      retryLabel: RETRY,
    };
  }
  if (code === 2) {
    return {
      kind: "unavailable",
      title: "Posizione non disponibile",
      body: "Non riusciamo a leggere la posizione. Esci all'aperto e riprova.",
      hint: "Controlla anche che il GPS del telefono sia attivo.",
      retryLabel: RETRY,
    };
  }
  return {
    kind: "timeout",
    title: "Posizione non disponibile",
    body: "La lettura della posizione ha impiegato troppo tempo. Riprova.",
    hint: "Esci all'aperto: al chiuso il segnale GPS è più lento.",
    retryLabel: RETRY,
  };
}

/** Null quando l'accuratezza va bene: nessuno stato d'errore da mostrare. */
export function fromAccuracy(accuracyM: number): CheckInErrorInfo | null {
  if (accuracyM <= CHECK_IN_MAX_ACCURACY_M) return null;
  return {
    kind: "low-accuracy",
    title: "Segnale GPS debole",
    body: `Segnale GPS debole (±${Math.round(accuracyM)} m). Esci all'aperto e riprova.`,
    retryLabel: RETRY,
  };
}

export interface OutOfRangeInfo {
  meters: number | null;
}

/** Estrae i metri dal messaggio del trigger `enforce_check_in_distance`. */
export function parseDistanceMeters(message: string): OutOfRangeInfo {
  // Tollerante: "(120 m)" dal formato corretto, ma anche relitti come
  // "(1003.40670779.0f m)" dal vecchio `%.0f` (migration 017 lo sistema).
  const match = message.match(/\(\s*(\d+(?:\.\d+)?)[^)]*?m\s*\)/);
  if (!match) return { meters: null };
  const meters = Math.round(Number(match[1]));
  return { meters: Number.isFinite(meters) ? meters : null };
}

export function outOfRangeError(meters: number | null): CheckInErrorInfo {
  return {
    kind: "out-of-range",
    title: "Fuori raggio",
    body:
      meters !== null
        ? `Sei a ${meters} m dal campo. Avvicinati e riprova.`
        : "Sei troppo lontano dal campo. Avvicinati e riprova.",
    hint: "Il check-in parte entro 50 m dal campo.",
    retryLabel: "Aggiorna posizione",
  };
}

/**
 * Classifica l'errore di insert su `check_ins` usando il messaggio del DB
 * (nessun calcolo duplicato client per la distanza).
 */
export function fromInsertError(message: string): CheckInErrorInfo {
  // P0001 dei guard di moderazione (012): "Operazione consentita solo su
  // campi approvati." — niente retry, si sblocca con l'approvazione.
  if (/campi approvati|approvat[oi]|in revisione|pending/i.test(message)) {
    return {
      kind: "court-not-approved",
      title: "Campo non approvato",
      body: "Questo campo è ancora in revisione. Il check-in si sblocca quando viene approvato.",
      retryLabel: "Chiudi",
    };
  }
  if (/troppo lontano/i.test(message)) {
    return outOfRangeError(parseDistanceMeters(message).meters);
  }
  if (/5 minuti|cooldown|attendere/i.test(message)) {
    return {
      kind: "cooldown",
      title: "Riprova tra poco",
      body: "Devi attendere 5 minuti prima di fare di nuovo check-in su questo campo.",
      retryLabel: RETRY,
    };
  }
  if (/accesso|login|sessione/i.test(message)) {
    return {
      kind: "auth",
      title: "Accesso richiesto",
      body: "Accedi di nuovo per fare il check-in.",
      retryLabel: "Accedi",
    };
  }
  if (/già|gia|attivo|duplicate|unique/i.test(message)) {
    return {
      kind: "already-inside",
      title: "Check-in già attivo",
      body: "Hai già un check-in attivo su questo campo.",
      retryLabel: RETRY,
    };
  }
  return {
    kind: "server",
    title: "Check-in non salvato",
    body: "Non siamo riusciti a salvare il check-in. Riprova.",
    hint: "La posizione letta resta valida: riprova senza rifare tutto.",
    retryLabel: RETRY,
  };
}

/** Scadenza = check-in + 2h (auto-checkout), formattata it-IT HH:MM. */
export function expiryFromCheckin(checkedInAt: string | number | Date): Date {
  const base =
    checkedInAt instanceof Date ? checkedInAt.getTime() : new Date(checkedInAt).getTime();
  return new Date(base + CHECK_IN_DURATION_MS);
}

/** True se il check-in è ancora valido (scadenza futura). */
export function isCheckinActive(
  checkedInAt: string | number | Date,
  now: Date = new Date()
): boolean {
  return expiryFromCheckin(checkedInAt).getTime() > now.getTime();
}

/**
 * Orologio di riferimento dell'app: i campi sono a Roma, quindi gli orari
 * mostrati sono sempre quelli di Roma, non del fuso del dispositivo/runner.
 * Default esplicito = formattazione deterministica (niente sorprese in CI,
 * che gira in UTC, o per un utente in viaggio).
 * Definizione unica in `lib/datetime.ts` (issue #78): qui solo re-export,
 * le import esistenti (`APP_TIME_ZONE`, `formatExpiry`) non cambiano.
 */
export { APP_TIME_ZONE, formatExpiry } from "@/lib/datetime";
