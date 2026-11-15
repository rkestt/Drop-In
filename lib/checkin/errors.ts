/**
 * Mappa errori del check-in in testi italiani con recovery (d21).
 *
 * Modulo puro: nessuna I/O, nessuna geolocalizzazione, nessun Supabase.
 * Le regole (50 m, accuratezza ideale 20 m / bloccante 50 m, timeout 2h) restano nel DB/pg_cron:
 * qui si traducono solo i messaggi in stati UI raggiungibili.
 */

export const CHECK_IN_RADIUS_M = 50;
export const CHECK_IN_IDEAL_ACCURACY_M = 20;
export const CHECK_IN_MAX_ACCURACY_M = 50;
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
  /** Passi di recovery mostrati nel <details> "Come fare" (solo denied). */
  steps?: string[];
}

const RETRY = "Riprova";

export interface GeolocationCodeOpts {
  /** True su iPhone/iPad: messaggi specifici per Safari/iOS. */
  ios?: boolean;
  /** True quando la PWA gira standalone (icona Home), false in Safari. */
  standalone?: boolean;
}

export function fromGeolocationCode(
  code: number,
  opts?: GeolocationCodeOpts
): CheckInErrorInfo {
  const ios = opts?.ios === true;
  const standalone = opts?.standalone;
  if (code === 1) {
    if (ios) {
      if (standalone === false) {
        return {
          kind: "denied",
          title: "Permesso posizione negato",
          body: "Safari non ha il permesso per la posizione. Apri Impostazioni › Privacy e sicurezza › Localizzazione, scegli Safari e attiva «Posizione precisa».",
          hint: "Riapri Drop-In dalla sua icona sulla Home: nella PWA installata i permessi sono separati da quelli di Safari.",
          retryLabel: RETRY,
          steps: [
            "Apri Impostazioni › Privacy e sicurezza › Localizzazione.",
            "Scegli Safari, consenti la posizione e attiva «Posizione precisa».",
            "Riapri Drop-In dalla sua icona sulla Home: in Safari i permessi sono separati dalla PWA installata.",
          ],
        };
      }
      return {
        kind: "denied",
        title: "Permesso posizione negato",
        body: "Safari non ha il permesso per la posizione. Apri Impostazioni › Privacy e sicurezza › Localizzazione, scegli Safari e attiva «Posizione precisa».",
        hint: "Se hai aggiunto Drop-In alla Home, i permessi si gestiscono nella voce Drop-In.",
        retryLabel: RETRY,
        steps: [
          "Apri Impostazioni › Privacy e sicurezza › Localizzazione.",
          "Scegli Safari (o la voce Drop-In, se hai installato la PWA).",
          "Consenti la posizione e attiva «Posizione precisa».",
        ],
      };
    }
    return {
      kind: "denied",
      title: "Permesso posizione negato",
      body: "Il browser ha bloccato l'accesso alla posizione. Consentilo nelle impostazioni del sito e riprova.",
      hint: "Di solito basta toccare l'icona del lucchetto nella barra degli indirizzi e consentire la posizione.",
      retryLabel: RETRY,
      steps: [
        "Apri le impostazioni del sito nel browser.",
        "Consenti l'accesso alla posizione per Drop-In.",
        "Torna qui.",
      ],
    };
  }
  if (code === 2) {
    return {
      kind: "unavailable",
      title: "Posizione non disponibile",
      body: "Non riusciamo a leggere la posizione. Scendi all'aperto e riprova.",
      hint: ios
        ? "Controlla che la Localizzazione sia attiva e che la «Posizione precisa» sia abilitata."
        : "Controlla anche che il GPS del telefono sia attivo.",
      retryLabel: RETRY,
    };
  }
  return {
    kind: "timeout",
    title: "Posizione non disponibile",
    body: "La lettura della posizione ha impiegato troppo tempo. Scendi all'aperto e riprova.",
    hint: ios
      ? "Al chiuso il segnale GPS è più lento: attiva la «Posizione precisa» e riprova all'aperto."
      : "Esci all'aperto: al chiuso il segnale GPS è più lento.",
    retryLabel: RETRY,
  };
}

/**
 * Verdetto sull'accuratezza GPS (soglia adattiva, #82):
 * - ok (<= 20 m): nessun avviso.
 * - warn (20–50 m): non bloccante, si prosegue con l'insert + avviso.
 * - block (> 50 m): bloccante, niente insert.
 * Il kind resta "low-accuracy" in warn e block: la distinzione è `level`.
 */
export type AccuracyVerdict =
  | { level: "ok"; info: null }
  | { level: "warn"; info: CheckInErrorInfo }
  | { level: "block"; info: CheckInErrorInfo };

export function fromAccuracy(accuracyM: number): AccuracyVerdict {
  // Precisione ignota (NaN/Infinity/negativa): non giudicabile, mai
  // banner con "NaN m"/"±Infinity m" — il trigger DB resta l'unico giudice.
  if (!Number.isFinite(accuracyM) || accuracyM < 0)
    return { level: "ok", info: null };
  if (accuracyM <= CHECK_IN_IDEAL_ACCURACY_M)
    return { level: "ok", info: null };
  const meters = Math.round(accuracyM);
  if (accuracyM <= CHECK_IN_MAX_ACCURACY_M) {
    return {
      level: "warn",
      info: {
        kind: "low-accuracy",
        title: "GPS impreciso",
        body: `GPS impreciso (±${meters} m): il check-in potrebbe risultare meno affidabile.`,
        retryLabel: RETRY,
      },
    };
  }
  return {
    level: "block",
    info: {
      kind: "low-accuracy",
      title: "Segnale GPS debole",
      body: `Segnale GPS troppo debole (±${meters} m) per un check-in affidabile. Avvicinati al campo, scendi all'aperto e riprova.`,
      hint: "Il check-in richiede una precisione entro 50 m.",
      retryLabel: RETRY,
    },
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
