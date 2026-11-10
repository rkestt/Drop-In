import { afterEach, describe, expect, it } from "vitest";
import {
  COACH_CHECKIN_KEY,
  ONBOARDED_KEY,
  coachKey,
  hasSeen,
  markSeen,
} from "@/lib/onboarding/storage";

function stubWindow(localStorage: unknown) {
  (globalThis as Record<string, unknown>).window = { localStorage };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    store,
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
});

describe("chiavi onboarding", () => {
  it("chiave primo avvio versionata", () => {
    expect(ONBOARDED_KEY).toBe("dropin:onboarded:v1");
  });

  it("chiave coach per feature", () => {
    expect(coachKey("check-in")).toBe("dropin:coach:check-in");
    expect(COACH_CHECKIN_KEY).toBe("dropin:coach:check-in");
  });
});

describe("storage non disponibile (SSR, Safari privato)", () => {
  it("hasSeen risponde false senza window e non lancia", () => {
    expect(hasSeen(ONBOARDED_KEY)).toBe(false);
  });

  it("markSeen senza window non lancia", () => {
    expect(() => markSeen(ONBOARDED_KEY)).not.toThrow();
  });

  it("getItem che lancia -> hasSeen false, nessun crash", () => {
    stubWindow({
      getItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => hasSeen(ONBOARDED_KEY)).not.toThrow();
    expect(hasSeen(ONBOARDED_KEY)).toBe(false);
  });

  it("setItem che lancia (quota Safari privato) -> markSeen non lancia", () => {
    stubWindow({
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() => markSeen(ONBOARDED_KEY)).not.toThrow();
  });

  it("window senza localStorage -> nessun crash", () => {
    stubWindow(undefined);
    expect(hasSeen(ONBOARDED_KEY)).toBe(false);
    expect(() => markSeen(ONBOARDED_KEY)).not.toThrow();
  });
});

describe("storage disponibile", () => {
  it("roundtrip: non visto -> markSeen -> visto", () => {
    const mem = memoryStorage();
    stubWindow(mem);
    expect(hasSeen(ONBOARDED_KEY)).toBe(false);
    markSeen(ONBOARDED_KEY);
    expect(mem.store[ONBOARDED_KEY]).toBe("1");
    expect(hasSeen(ONBOARDED_KEY)).toBe(true);
  });

  it("chiavi indipendenti tra loro", () => {
    const mem = memoryStorage();
    stubWindow(mem);
    markSeen(COACH_CHECKIN_KEY);
    expect(hasSeen(COACH_CHECKIN_KEY)).toBe(true);
    expect(hasSeen(ONBOARDED_KEY)).toBe(false);
  });
});
