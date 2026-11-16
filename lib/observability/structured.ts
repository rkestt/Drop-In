/**
 * Log strutturati per il server (#32/#88).
 *
 * Perche' non sostituiscono `lib/logger.ts`: quello e' il logger del browser
 * e dei componenti, con il mapping esplicito sui metodi console documentato
 * in `docs/logging.md`. Qui si scrive **una riga JSON per evento** su stdout,
 * che e' quello che Vercel raccoglie e indicizza: gli eventi hanno un nome
 * stabile (`health.degraded`, `boot`) e campi macchina, cosi' si possono
 * contare i log per cercare un error rate senza un provider esterno.
 *
 * Regola: nessun segreto e nessun dato personale nei campi. `redact()` copre
 * le chiavi che tipicamente li contengono (token, key, secret, password, dsn)
 * e taglia i valori troppo lunghi.
 */

export type StructuredLevel = "info" | "warn" | "error";

// `key` generico (quindi anche `supabaseKey`, `apikey`, `api_key`): meglio
// redigere un campo innocuo che stamparne uno con una chiave.
const SENSITIVE_KEY = /(token|secret|password|passwd|key|dsn|authorization|service_role)/i;
const MAX_VALUE_LENGTH = 200;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Toglie i campi sensibili (sostituendoli con `[redacted]`) e limita la
 * lunghezza delle stringhe. Pura: usata sia dal server sia dai test.
 */
export function redactFields(
  fields: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string" && value.length > MAX_VALUE_LENGTH) {
      out[key] = `${value.slice(0, MAX_VALUE_LENGTH)}…`;
      continue;
    }
    if (isPlainObject(value)) {
      out[key] = redactFields(value);
      continue;
    }
    out[key] = value;
  }
  return out;
}

export interface StructuredEvent {
  level: StructuredLevel;
  event: string;
  fields?: Record<string, unknown>;
  now?: Date;
}

/** Costruisce la riga JSON (senza scriverla): testabile. */
export function formatEvent({
  level,
  event,
  fields = {},
  now = new Date(),
}: StructuredEvent): string {
  return JSON.stringify({
    ts: now.toISOString(),
    level,
    event,
    ...redactFields(fields),
  });
}

/**
 * Scrive l'evento su stdout (Vercel li raccoglie). Fuori dal server
 * (build statico, test) resta silenzioso se `OBSERVABILITY_SILENT=1`.
 */
export function logEvent(input: StructuredEvent): void {
  if (process.env.OBSERVABILITY_SILENT === "1") return;
  const line = formatEvent(input);
  if (input.level === "error") console.error(line);
  else if (input.level === "warn") console.warn(line);
  else console.info(line);
}
