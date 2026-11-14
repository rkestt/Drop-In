import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createLogger,
  logLevelEnabled,
  resolveLogLevel,
  supabaseUrlHost,
} from "@/lib/logger";

const ENV_KEYS = ["NEXT_PUBLIC_LOG_LEVEL", "LOG_LEVEL"] as const;

function saveEnv() {
  return {
    NEXT_PUBLIC_LOG_LEVEL: process.env.NEXT_PUBLIC_LOG_LEVEL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NODE_ENV: process.env.NODE_ENV,
  };
}

function restoreEnv(saved: Record<string, string | undefined>) {
  const env = process.env as Record<string, string | undefined>;
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete env[key];
    else env[key] = saved[key];
  }
  if (saved.NODE_ENV !== undefined) env.NODE_ENV = saved.NODE_ENV;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLogLevel", () => {
  it("dev senza env -> info", () => {
    expect(resolveLogLevel({ NODE_ENV: "development" })).toBe("info");
  });

  it("prod senza env -> warn", () => {
    expect(resolveLogLevel({ NODE_ENV: "production" })).toBe("warn");
  });

  it("NEXT_PUBLIC_LOG_LEVEL vince su LOG_LEVEL", () => {
    expect(
      resolveLogLevel({
        NEXT_PUBLIC_LOG_LEVEL: "error",
        LOG_LEVEL: "debug",
        NODE_ENV: "development",
      }),
    ).toBe("error");
  });

  it("LOG_LEVEL usato quando NEXT_PUBLIC_LOG_LEVEL manca", () => {
    expect(
      resolveLogLevel({ LOG_LEVEL: "debug", NODE_ENV: "production" }),
    ).toBe("debug");
  });

  it("valore non valido -> fallback dev/prod", () => {
    expect(
      resolveLogLevel({ NEXT_PUBLIC_LOG_LEVEL: "verbose", NODE_ENV: "development" }),
    ).toBe("info");
    expect(
      resolveLogLevel({ LOG_LEVEL: "tutto", NODE_ENV: "production" }),
    ).toBe("warn");
  });
});

describe("logLevelEnabled", () => {
  it("blocca sotto soglia, passa da soglia in su", () => {
    expect(logLevelEnabled("debug", "info")).toBe(false);
    expect(logLevelEnabled("info", "info")).toBe(true);
    expect(logLevelEnabled("warn", "info")).toBe(true);
    expect(logLevelEnabled("error", "warn")).toBe(true);
    expect(logLevelEnabled("info", "warn")).toBe(false);
  });
});

describe("createLogger gating", () => {
  it("info passa con soglia info ma non con soglia warn", () => {
    const saved = saveEnv();
    try {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      process.env.NEXT_PUBLIC_LOG_LEVEL = "info";
      delete process.env.LOG_LEVEL;
      createLogger("test").info("visibile");
      expect(infoSpy).toHaveBeenCalledTimes(1);

      infoSpy.mockClear();
      process.env.NEXT_PUBLIC_LOG_LEVEL = "warn";
      createLogger("test").info("nascosta");
      expect(infoSpy).not.toHaveBeenCalled();
    } finally {
      restoreEnv(saved);
    }
  });

  it("debug usa console.debug (Verbose-only in DevTools)", () => {
    const saved = saveEnv();
    try {
      const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      process.env.NEXT_PUBLIC_LOG_LEVEL = "debug";
      createLogger("test").debug("dettaglio");
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy.mock.calls[0]?.[0]).toBe("[test]");
    } finally {
      restoreEnv(saved);
    }
  });
});

describe("supabaseUrlHost", () => {
  it("estrae solo l'host, senza credenziali/path/query", () => {
    expect(
      supabaseUrlHost("https://user:secret@abc.supabase.co/rest/v1?apikey=XYZ"),
    ).toBe("abc.supabase.co");
  });

  it("tiene la porta ma toglie path e query", () => {
    expect(supabaseUrlHost("http://127.0.0.1:54321/rest/v1?x=1")).toBe(
      "127.0.0.1:54321",
    );
  });

  it("lascia invariato il proxy relativo di dev", () => {
    expect(supabaseUrlHost("/supabase")).toBe("/supabase");
  });

  it("unset per valori mancanti o vuoti", () => {
    expect(supabaseUrlHost(undefined)).toBe("unset");
    expect(supabaseUrlHost("")).toBe("unset");
    expect(supabaseUrlHost("   ")).toBe("unset");
  });
});
