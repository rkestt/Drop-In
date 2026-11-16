/**
 * Health check (#88): payload e logica separati dalla route, cosi' i casi
 * "ok" e "degraded" sono testabili senza avviare Next.
 *
 * Cosa controlla e cosa no:
 *  - DB: una `HEAD` su `/rest/v1/courts?select=id&limit=1` con la anon key.
 *    Misura raggiungibilita' e latenza del percorso che usa davvero il
 *    browser (PostgREST + RLS), non il ping TCP del database.
 *  - Non controlla: storage, auth, realtime. Aggiungerli allunga il tempo di
 *    risposta e duplica quello che un uptime monitor esterno gia' vede come
 *    "pagina rotta". Se serve, sono check separati con una motivazione.
 */

export type CheckStatus = "ok" | "degraded";

export interface HealthCheck {
  name: "database";
  status: CheckStatus;
  latency_ms: number | null;
  /** Motivo sintetico quando qualcosa non va (mai credenziali). */
  detail?: string;
}

export interface HealthReport {
  status: CheckStatus;
  version: string;
  commit: string | null;
  env: string;
  uptime_s: number;
  timestamp: string;
  checks: HealthCheck[];
}

export interface HealthInput {
  version: string;
  commit?: string | null;
  env?: string | null;
  now?: Date;
  bootedAt: number;
  checks: HealthCheck[];
}

/** `ok` solo se ogni check e' ok: un DB irraggiungibile e' un 503. */
export function buildHealthReport({
  version,
  commit = null,
  env = null,
  now = new Date(),
  bootedAt,
  checks,
}: HealthInput): HealthReport {
  const status: CheckStatus = checks.every((c) => c.status === "ok")
    ? "ok"
    : "degraded";
  return {
    status,
    version,
    commit: commit || null,
    env: env || "unknown",
    uptime_s: Math.max(0, Math.round((now.getTime() - bootedAt) / 1000)),
    timestamp: now.toISOString(),
    checks,
  };
}

/**
 * Esegue il check DB con un timeout stretto: un health che aspetta 30 secondi
 * fa fallire anche l'uptime monitor piu' paziente.
 */
export async function checkDatabase(
  baseUrl: string,
  anonKey: string,
  timeoutMs = 2500
): Promise<HealthCheck> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${baseUrl.replace(/\/+$/, "")}/rest/v1/courts?select=id&limit=1`,
      {
        method: "GET",
        headers: { apikey: anonKey, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      }
    );
    const latency = Date.now() - started;
    if (!res.ok) {
      return {
        name: "database",
        status: "degraded",
        latency_ms: latency,
        detail: `HTTP ${res.status}`,
      };
    }
    return { name: "database", status: "ok", latency_ms: latency };
  } catch (error) {
    return {
      name: "database",
      status: "degraded",
      latency_ms: null,
      // `AbortError` -> timeout; il messaggio di fetch non contiene il DSN,
      // ma lo tagliamo comunque a un testo stabile.
      detail:
        error instanceof Error && error.name === "AbortError"
          ? `timeout dopo ${timeoutMs}ms`
          : "rete non raggiungibile",
    };
  } finally {
    clearTimeout(timer);
  }
}
