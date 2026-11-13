/**
 * Mappa errori del join/leave lobby in testi italiani (issue #77).
 *
 * Modulo puro: nessuna I/O, nessun Supabase. Il DB nega il join su lobby
 * chiusa con un trigger (P0001, "lobby chiusa/scaduta") che `outbox.ts`
 * classifica `permanent`: senza questa mappa il messaggio raw del trigger
 * finiva in UI insieme a un bottone "Riprova" che non potrà mai funzionare.
 *
 * Priorità: chiusa > piena > duplicato > transient > permanent generico.
 * Mai un messaggio Postgres/PostgREST in UI: il permanent generico è una
 * frase fissa con `canRetry: false`.
 */

export type JoinErrorKind =
  | "closed"
  | "full"
  | "duplicate"
  | "transient"
  | "permanent";

export interface JoinErrorInfo {
  kind: JoinErrorKind;
  message: string;
  /** False → la UI nasconde il bottone "Riprova". */
  canRetry: boolean;
}

export interface JoinErrorInput {
  /** `lobby.status` noto alla UI (`open` | `in_progress` | `closed`). */
  status?: string | null;
  /** Codice PostgREST/PG (`23505`, `42501`, `P0001`, …). */
  code?: string | null;
  /** Messaggio DB grezzo (mai mostrato così com'è). */
  message?: string | null;
}

const CLOSED_RE =
  /chius|scadut|non (più|piu) attiv|terminat|no longer|is closed|has closed/i;
const FULL_RE =
  /posti esauriti|al completo|is full|troppi (giocatori|partecipanti)|max.*players|capacit|over capacity|limite (di )?(giocatori|partecipanti)|piena/i;
const DUPLICATE_RE = /duplicate|already|già|gia|unique|23505|sei già dentro/i;
const TRANSIENT_RE =
  /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|(?<!\d)5\d\d(?!\d)|econn|enotfound|socket/i;

const CLOSED_MESSAGE = "Lobby chiusa: le iscrizioni sono terminate.";
const IN_PROGRESS_MESSAGE =
  "Lobby in corso: le iscrizioni sono chiuse, si può solo uscire.";
const FULL_MESSAGE =
  "Posti esauriti: questa lobby è al completo. Crea la tua lobby.";
const DUPLICATE_MESSAGE = "Sei già dentro questa lobby.";
const TRANSIENT_MESSAGE = "Connessione assente: controlla la rete e riprova.";
const GENERIC_MESSAGE = "Non è stato possibile unirti alla lobby.";

function rawOf(input: JoinErrorInput): string {
  return `${input.code ?? ""} ${input.message ?? ""}`.trim();
}

/**
 * Classifica un fallimento di join. La lobby chiusa vince anche sul
 * permanent generico: o lo dice lo `status`, o lo dice il messaggio del
 * trigger anche quando lo status in mano alla UI è ancora `open` (stale).
 */
export function mapJoinError(input: JoinErrorInput): JoinErrorInfo {
  const raw = rawOf(input);
  // `in_progress` non è "chiusa": la lobby sta giocando. Testo distinto, ma
  // resta non ritentabile (le iscrizioni sono chiuse).
  if (input.status === "in_progress") {
    return { kind: "closed", message: IN_PROGRESS_MESSAGE, canRetry: false };
  }
  if (input.status != null && input.status !== "open") {
    return { kind: "closed", message: CLOSED_MESSAGE, canRetry: false };
  }
  if (raw !== "" && CLOSED_RE.test(raw)) {
    return { kind: "closed", message: CLOSED_MESSAGE, canRetry: false };
  }
  if (raw !== "" && FULL_RE.test(raw)) {
    return { kind: "full", message: FULL_MESSAGE, canRetry: false };
  }
  if (raw !== "" && DUPLICATE_RE.test(raw)) {
    return { kind: "duplicate", message: DUPLICATE_MESSAGE, canRetry: false };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return { kind: "transient", message: TRANSIENT_MESSAGE, canRetry: true };
  }
  return { kind: "permanent", message: GENERIC_MESSAGE, canRetry: false };
}

export interface LeaveErrorInfo {
  kind: "closed" | "transient" | "permanent";
  message: string;
  canRetry: boolean;
}

const LEAVE_GENERIC = "Non riusciamo a farti uscire. Riprova più tardi.";

/** Stessa idea per l'uscita: mai raw DB in UI, mai retry su lobby chiusa. */
export function mapLeaveError(input: JoinErrorInput): LeaveErrorInfo {
  const raw = rawOf(input);
  // Solo `closed` blocca l'uscita: da `in_progress` si esce normalmente,
  // quindi un errore in corso non va etichettato "lobby chiusa".
  if (
    input.status === "closed" ||
    (raw !== "" && CLOSED_RE.test(raw))
  ) {
    return { kind: "closed", message: CLOSED_MESSAGE, canRetry: false };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return { kind: "transient", message: TRANSIENT_MESSAGE, canRetry: true };
  }
  return { kind: "permanent", message: LEAVE_GENERIC, canRetry: false };
}
