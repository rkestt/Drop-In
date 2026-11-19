import { postgrestErrorFields } from "@/lib/lobbies/join-errors";

/**
 * Costanti e mapper puri della schermata nuova password (ticket 109).
 *
 * Modulo puro: nessuna I/O, nessun Supabase, nessuna direttiva
 * `"use client"` — lo importano sia la pagina server (solo la costante
 * del path) sia il form client (mapper + builder). Mai loggare password
 * qui: passano solo gli oggetti errore.
 */

/** Route pubblica che serve recupero e invito con lo stesso form. */
export const NEW_PASSWORD_PATH = "/auth/nuova-password";

/**
 * `redirectTo` per `resetPasswordForEmail` / `inviteUserByEmail`: passa dal
 * callback, che scambia il `code` e rimbalza al `next` (stessa forma del
 * redirect OAuth nel login-modal). Same-origin per costruzione.
 */
export function newPasswordResetRedirect(origin: string): string {
  return `${origin}/api/auth/callback?next=${encodeURIComponent(NEW_PASSWORD_PATH)}`;
}

export interface NewPasswordErrorInfo {
  message: string;
  /** False → la UI non suggerisce di riprovare (es. sessione scaduta). */
  canRetry: boolean;
}

const SESSION_RE = /session|expired|scadut|jwt|revoked|refresh|not authenticated|user not found/i;
const TRANSIENT_RE =
  /failed to fetch|network|timeout|temporar|offline|connection|reset|aborted|(?<!\d)5\d\d(?!\d)|econn|enotfound|socket/i;
const RATE_RE = /rate.?limit|too many|troppe|429|after \d+ seconds?/i;
/** La parola "password" deve esserci: senza, è un errore generico. */
const PASSWORD_RE = /password/i;
const WEAK_WORD_RE =
  /weak|short|debole|corta|breach|pwned|compromess|leak|characters|length|prevedibile|common|diversa|different|same/i;

const SESSION_MESSAGE =
  "La sessione è scaduta: accedi di nuovo o chiedi un altro link prima di impostare la password.";
const TRANSIENT_MESSAGE = "Controlla la connessione e riprova.";
const RATE_MESSAGE = "Troppi tentativi: attendi un minuto e riprova.";
const WEAK_MESSAGE =
  "La password non è abbastanza sicura: usane una più lunga e meno prevedibile.";
const GENERIC_MESSAGE =
  "Non è stato possibile aggiornare la password. Riprova.";

/**
 * Classifica un fallimento di `updateUser({ password })` /
 * `resetPasswordForEmail` in testo italiano. Mai il messaggio raw di
 * Supabase in UI: il permanent generico è una frase fissa.
 */export function mapNewPasswordError(err: unknown): NewPasswordErrorInfo {
  const { message } = postgrestErrorFields(err);
  const raw = message.trim();
  if (raw !== "" && SESSION_RE.test(raw)) {
    return { message: SESSION_MESSAGE, canRetry: false };
  }
  if (raw !== "" && TRANSIENT_RE.test(raw)) {
    return { message: TRANSIENT_MESSAGE, canRetry: true };
  }
  if (raw !== "" && RATE_RE.test(raw)) {
    return { message: RATE_MESSAGE, canRetry: true };
  }
  if (raw !== "" && PASSWORD_RE.test(raw) && WEAK_WORD_RE.test(raw)) {
    return { message: WEAK_MESSAGE, canRetry: false };
  }
  return { message: GENERIC_MESSAGE, canRetry: true };
}

/**
 * Vero quando GoTrue ha rifiutato per rate limit (es. recover troppo
 * ravvicinati): il chiamante mostra un messaggio dedicato invece del
 * generico. Stessa regola usata dentro `mapNewPasswordError`.
 */
export function isRateLimitError(err: unknown): boolean {
  const { message } = postgrestErrorFields(err);
  const raw = message.trim();
  return raw !== "" && RATE_RE.test(raw);
}
