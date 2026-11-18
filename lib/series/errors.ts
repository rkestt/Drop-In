/**
 * Mappa errori delle Serie in testi italiani (#92).
 *
 * Modulo puro: nessuna I/O, nessun Supabase — stessa forma di
 * `lib/lobbies/join-errors.ts`. Mai raw Postgres/PostgREST in UI.
 */

export type SeriesErrorKind =
  | "full"
  | "duplicate"
  | "forbidden"
  | "not-owner"
  | "transient"
  | "permanent";

export interface SeriesErrorInfo {
  kind: SeriesErrorKind;
  message: string;
  /** False → la UI nasconde il bottone "Riprova". */
  canRetry: boolean;
}

export interface SeriesErrorInput {
  /** Codice PostgREST/PG (`23505`, `42501`, `P0001`, …). */
  code?: string | null;
  /** Messaggio DB grezzo (mai mostrato così com'è). */
  message?: string | null;
}

/** RLS negata su update/delete: PostgREST torna 0 righe, non un errore. */
export const SERIES_FORBIDDEN_MESSAGE =
  "Non hai i permessi per modificare questa serie.";
/** Solo il creatore può cancellare (policy 044); 0 righe = non creatore. */
export const SERIES_DELETE_FORBIDDEN_MESSAGE =
  "Solo il creatore può cancellare questa serie.";

const FULL_RE =
  /posti esauriti|al completo|is full|troppi (giocatori|partecipanti)|max.*players|capacit|over capacity|limite (di )?(giocatori|partecipanti)|piena|pieno/i;
const DUPLICATE_RE =
  /duplicate|already|unique|23505|esiste già|esiste gia/i;
const NOT_OWNER_RE = /solo il creatore/i;
const TRANSIENT_RE =
  /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|(?<!\d)5\d\d(?!\d)|econn|enotfound|socket/i;

const FULL_MESSAGE =
  "Posti esauriti: questa lobby è al completo. Crea la tua lobby.";
const DUPLICATE_MESSAGE = "Questa occorrenza esiste già.";
const NOT_OWNER_MESSAGE = "Solo il creatore può modificare questa serie.";
const TRANSIENT_MESSAGE = "Connessione assente: controlla la rete e riprova.";
const GENERIC_MESSAGE = "Salvataggio non riuscito. Riprova.";

function rawOf(input: SeriesErrorInput): string {
  return `${input.code ?? ""} ${input.message ?? ""}`.trim();
}

/**
 * Classifica un fallimento su `lobby_series` (o sul join a un'Occorrenza,
 * rifiutato dal trigger capienza 045 con P0001). Ordine: piena > duplicato >
 * permessi > transient > generico.
 */
export function mapSeriesError(input: SeriesErrorInput): SeriesErrorInfo {
  const raw = rawOf(input);
  if (raw !== "" && FULL_RE.test(raw)) {
    return { kind: "full", message: FULL_MESSAGE, canRetry: false };
  }
  if (
    (input.code != null && String(input.code) === "23505") ||
    (raw !== "" && DUPLICATE_RE.test(raw))
  ) {
    return { kind: "duplicate", message: DUPLICATE_MESSAGE, canRetry: false };
  }
  if (raw !== "" && NOT_OWNER_RE.test(raw)) {
    return { kind: "not-owner", message: NOT_OWNER_MESSAGE, canRetry: false };
  }
  if (
    (input.code != null && String(input.code) === "42501") ||
    raw === SERIES_FORBIDDEN_MESSAGE
  ) {
    return { kind: "forbidden", message: SERIES_FORBIDDEN_MESSAGE, canRetry: false };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return { kind: "transient", message: TRANSIENT_MESSAGE, canRetry: true };
  }
  return { kind: "permanent", message: GENERIC_MESSAGE, canRetry: false };
}
