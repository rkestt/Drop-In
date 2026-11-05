type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function threshold(): number {
  const raw =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_LOG_LEVEL) ||
    (typeof process !== "undefined" && process.env?.LOG_LEVEL) ||
    (process.env?.NODE_ENV === "production" ? "warn" : "debug");
  return LEVELS[raw as Level] ?? LEVELS.debug;
}

function emit(level: Level, scope: string, ...args: unknown[]) {
  if (LEVELS[level] < threshold()) return;
  const tag = `[${scope}]`;
  const fn = level === "debug" ? console.debug : level === "info" ? console.info : level === "warn" ? console.warn : console.error;
  fn(tag, ...args);
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