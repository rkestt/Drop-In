// Logica pura dello sweep di recapito: decidere se una riga e'
// recapitabile, quale patch applicare dopo un tentativo, e quando una
// subscription va rimossa. Nessun I/O qui: `index.ts` fa le chiamate, qui
// solo decisioni (testate con `deno test`).

/** Tentativi falliti dopo i quali la riga non viene piu' ritentata. */
export const MAX_PUSH_ATTEMPTS = 5;

/** Sottoinsieme di `push_notifications` che serve allo sweep. */
export interface PushRow {
  id: string;
  push_sent_at: string | null;
  push_failed_at: string | null;
  push_attempts: number | null;
}

/** Esito del tentativo di recapito di una riga su tutte le subscription. */
export type DeliveryOutcome =
  | { kind: "delivered" }
  | { kind: "no_subscription" }
  | { kind: "failed" };

/**
 * Una riga e' recapitabile se non e' mai stata recapitata, non e'
 * marcata come fallita e non ha esaurito i tentativi. La decisione non
 * dipende dall'orologio: conta solo lo stato dei marcatori.
 */
export function isDeliverable(row: PushRow): boolean {
  if (row.push_sent_at !== null) return false;
  if (row.push_failed_at !== null) return false;
  const attempts = row.push_attempts ?? 0;
  return attempts < MAX_PUSH_ATTEMPTS;
}

/** Patch da applicare alla riga dopo il tentativo. */
export type AttemptPatch =
  | { push_sent_at: string }
  | { push_attempts: number; push_failed_at?: string };

/**
 * Traduce l'esito in patch: recapito (o nessuna subscription rimasta, che
 * non ha senso ritentare) => `push_sent_at`; fallimento => `push_attempts
 * + 1`, e all'ultimo tentativo anche `push_failed_at`.
 */
export function attemptPatch(
  outcome: DeliveryOutcome,
  row: PushRow,
  now: Date,
): AttemptPatch {
  if (outcome.kind === "delivered" || outcome.kind === "no_subscription") {
    return { push_sent_at: now.toISOString() };
  }
  const attempts = (row.push_attempts ?? 0) + 1;
  if (attempts >= MAX_PUSH_ATTEMPTS) {
    return { push_attempts: attempts, push_failed_at: now.toISOString() };
  }
  return { push_attempts: attempts };
}

/**
 * Una subscription va rimossa quando l'endpoint non esiste piu' (404) o
 * la sottoscrizione e' scaduta/revocata (410). Qualunque altro errore
 * (429, 5xx, rete) e' transitorio: la subscription resta.
 */
export function shouldDropSubscription(statusCode: number | null): boolean {
  return statusCode === 404 || statusCode === 410;
}
