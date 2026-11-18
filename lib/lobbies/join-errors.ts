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
  /**
   * `lobby.status`: solo `open` | `closed` (#91). "In corso" non è uno
   * stato del DB, è derivato dal tempo (`lib/lobby/phase.ts`): un join su
   * una partita già iniziata non arriva qui, la CTA non esiste.
   */
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
  // #91: `status` conosce solo `open` e `closed`; "in corso" si deriva dal
  // tempo e la UI non offre il join, quindi qui non c'è un caso dedicato.
  // Qualunque altro valore (riga vecchia scritta a mano) equivale a chiusa:
  // le iscrizioni non sono più aperte.
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
  // Solo `closed` blocca l'uscita: una partita iniziata è ancora `open`,
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

/**
 * Campi `code`/`message` da un errore PostgREST, in qualunque forma arrivi
 * (issue 103): con `shouldThrowOnError: false` (default del client browser)
 * `supabase.from(...).insert()` non lancia — restituisce `{ error }` come
 * oggetto semplice `{ code, message, details, hint }`, non un'istanza di
 * `Error`. Chi faceva `err instanceof Error ? err.message : ""` scartava
 * quindi sempre codice e messaggio. Legge entrambi da `Error` (con `.code`
 * extra di PostgREST) e da oggetto semplice, senza perdere la `string`.
 */
export function postgrestErrorFields(err: unknown): {
  code: string | null;
  message: string;
} {
  if (err === null || err === undefined) return { code: null, message: "" };
  if (typeof err === "string") return { code: null, message: err };
  if (typeof err !== "object") return { code: null, message: String(err) };
  const rec = err as Record<string, unknown>;
  const message = typeof rec.message === "string" ? rec.message : "";
  const code = typeof rec.code === "string" ? rec.code : null;
  return { code, message };
}

/**
 * Mappa errori della CREATE lobby in testi italiani (issue #77).
 *
 * Solo bannato/karma passano così come sono: il trigger parla già italiano
 * e il raw è ammesso solo lì. Tutto il resto ha un testo dedicato o il
 * fallback generico — mai un messaggio Postgres/PostgREST in UI. Gli
 * `Error` lanciati dal client (login, validazioni) sono già italiano e non
 * passano di qui: il chiamante li mostra diretti (`instanceof Error`).
 */

export type CreateLobbyErrorKind =
  | "banned"
  | "duplicate"
  | "rateLimited"
  | "transient"
  | "permanent";

export interface CreateLobbyErrorInfo {
  kind: CreateLobbyErrorKind;
  message: string;
}

const CREATE_DUPLICATE_MESSAGE =
  "Hai già una lobby su questo campo a quest'ora.";
const CREATE_GENERIC_MESSAGE =
  "Non è stato possibile creare la lobby. Riprova più tardi.";
const CREATE_RATE_LIMIT_MESSAGE =
  "Hai creato troppe lobby nell'ultima ora. Riprova più tardi.";
const CREATE_APPROVED_MESSAGE =
  "Operazione consentita solo su campi approvati.";

const BANNED_RE = /bannato|banned/i;
const KARMA_RE = /karma/i;
const CREATE_DUPLICATE_RE =
  /23505|duplicate|already exist|esiste gi|stessa lobby/i;
const CREATE_RATE_LIMIT_RE = /troppe lobby|too many|rate.?limit/i;
const CREATE_APPROVED_RE = /approvati/i;

/**
 * Classifica un fallimento di creazione lobby. Bannato/karma vincono su
 * tutto e restituiscono il messaggio del trigger (già italiano); il resto
 * non mostra mai il raw.
 */
export function mapCreateLobbyError(input: JoinErrorInput): CreateLobbyErrorInfo {
  const raw = rawOf(input);
  if (raw !== "" && BANNED_RE.test(raw)) {
    return { kind: "banned", message: input.message ?? "" };
  }
  if (raw !== "" && KARMA_RE.test(raw)) {
    return { kind: "banned", message: input.message ?? "" };
  }
  if (raw !== "" && CREATE_DUPLICATE_RE.test(raw)) {
    return { kind: "duplicate", message: CREATE_DUPLICATE_MESSAGE };
  }
  if (raw !== "" && CREATE_RATE_LIMIT_RE.test(raw)) {
    return { kind: "rateLimited", message: CREATE_RATE_LIMIT_MESSAGE };
  }
  if (raw !== "" && CREATE_APPROVED_RE.test(raw)) {
    return { kind: "permanent", message: CREATE_APPROVED_MESSAGE };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return { kind: "transient", message: TRANSIENT_MESSAGE };
  }
  return { kind: "permanent", message: CREATE_GENERIC_MESSAGE };
}
