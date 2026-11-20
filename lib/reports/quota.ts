import { postgrestErrorFields } from "@/lib/errors/postgrest";

const DAILY_QUOTA_RE = /limite giornaliero/i;

/**
 * Quota giornaliera scritture (#84/055): il trigger parla già italiano col
 * nome dell'azione ("Hai raggiunto il limite giornaliero di …"). Se l'errore
 * è quello, restituisce il messaggio del server (mostrabile così com'è);
 * altrimenti `null` e il chiamante usa il suo ramo generico.
 *
 * Modulo puro: nessuna I/O, unit-testabile in isolation.
 */
export function dailyQuotaMessage(err: unknown): string | null {
  const { message } = postgrestErrorFields(err);
  if (message && DAILY_QUOTA_RE.test(message)) return message;
  return null;
}
