// Logger applicativo: soglie e mapping espliciti sui metodi console.
//
// MAPPING LIVELLI (voluto, non cambiarlo senza aggiornare docs/logging.md):
// - debug -> console.debug (in Chrome/Firefox DevTools si vede SOLO con il
//   livello "Verbose" attivo; di default e' nascosto anche se emesso)
// - info  -> console.info  (visibile con il livello "Info" di default)
// - warn  -> console.warn  (sempre visibile)
// - error -> console.error (sempre visibile)
//
// REGOLA: un log utile all'utente va emesso almeno a info, mai solo a debug.
// Il livello debug serve per dettagli verbosi da attivare su richiesta.
//
// SOGLIA DI DEFAULT: info in development, warn in production.
// Override (in ordine): NEXT_PUBLIC_LOG_LEVEL e poi LOG_LEVEL.

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const VALID_LEVELS: readonly string[] = ["debug", "info", "warn", "error"];

export interface LogEnv {
  NEXT_PUBLIC_LOG_LEVEL?: string | undefined;
  LOG_LEVEL?: string | undefined;
  NODE_ENV?: string | undefined;
}

// Legge l'env senza mai esplodere quando `process` non esiste (bundle browser).
function readEnv(): LogEnv {
  if (typeof process === "undefined" || !process?.env) return {};
  return {
    NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

// Risolve la soglia di log; accetta un env iniettabile per i test.
export function resolveLogLevel(env: LogEnv = readEnv()): LogLevel {
  const raw = env.NEXT_PUBLIC_LOG_LEVEL || env.LOG_LEVEL;
  if (raw && (VALID_LEVELS as readonly string[]).includes(raw)) {
    return raw as LogLevel;
  }
  return env.NODE_ENV === "production" ? "warn" : "info";
}

// Pura e testabile: dice se `level` passa la soglia `threshold`.
export function logLevelEnabled(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}

function emit(level: LogLevel, scope: string, ...args: unknown[]) {
  if (!logLevelEnabled(level, resolveLogLevel())) return;
  const tag = `[${scope}]`;
  // Mapping esplicito: debug e' Verbose-only in DevTools (vedi docs/logging.md).
  if (level === "debug") console.debug(tag, ...args);
  else if (level === "info") console.info(tag, ...args);
  else if (level === "warn") console.warn(tag, ...args);
  else console.error(tag, ...args);
}

export function createLogger(scope: string) {
  return {
    debug: (...a: unknown[]) => emit("debug", scope, ...a),
    info: (...a: unknown[]) => emit("info", scope, ...a),
    warn: (...a: unknown[]) => emit("warn", scope, ...a),
    error: (...a: unknown[]) => emit("error", scope, ...a),
  };
}

export const log = createLogger("app");

// Estrae il solo host da un URL Supabase, per log sicuri:
// mai la chiave, mai le credenziali, mai path o query string.
// Valori relativi (es. "/supabase" del dev proxy) tornano invariati.
export function supabaseUrlHost(raw: string | undefined): string {
  if (!raw) return "unset";
  const value = raw.trim();
  if (!value) return "unset";
  try {
    return new URL(value).host;
  } catch {
    // Non e' un URL assoluto: path relativi (es. "/supabase" del dev proxy)
    // tornano invariati perche' non contengono nulla di sensibile.
    if (value.startsWith("/")) return value;
    // Non e' un URL assoluto: togli schema, credenziali, path e query.
    const noScheme = value.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "");
    const noCreds = noScheme.includes("@")
      ? noScheme.slice(noScheme.lastIndexOf("@") + 1)
      : noScheme;
    const host = noCreds.split(/[/?#]/, 1)[0]?.trim();
    return host || "unset";
  }
}
