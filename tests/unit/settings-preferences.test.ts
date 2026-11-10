import { describe, expect, it, vi } from "vitest";
import {
  BADGE_PREFERENCE_KEY,
  readBool,
  readBadgePreference,
  writeBadgePreference,
  writeBool,
  type PreferenceStorage,
} from "@/lib/settings/preferences";

function memoryStorage(initial: Record<string, string> = {}): PreferenceStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("settings preferences", () => {
  it("exposes the stable badge key", () => {
    expect(BADGE_PREFERENCE_KEY).toBe("dropin:pref:badge:v1");
  });

  it("readBool returns the stored value", () => {
    const storage = memoryStorage({ k: "1" });
    expect(readBool(storage, "k", false)).toBe(true);
    storage.setItem("k", "0");
    expect(readBool(storage, "k", true)).toBe(false);
  });

  it("readBool falls back on missing, corrupt or absent storage", () => {
    const storage = memoryStorage();
    expect(readBool(storage, "missing", true)).toBe(true);
    expect(readBool(storage, "missing", false)).toBe(false);
    storage.setItem("k", "yes");
    expect(readBool(storage, "k", true)).toBe(true);
    expect(readBool(null, "k", false)).toBe(false);
    expect(readBool(undefined, "k", true)).toBe(true);
  });

  it("readBool falls back when getItem throws (Safari private mode)", () => {
    const throwing: PreferenceStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    expect(readBool(throwing, "k", true)).toBe(true);
  });

  it("writeBool round-trips and reports failure without throwing", () => {
    const storage = memoryStorage();
    expect(writeBool(storage, "k", true)).toBe(true);
    expect(readBool(storage, "k", false)).toBe(true);
    expect(writeBool(storage, "k", false)).toBe(true);
    expect(readBool(storage, "k", true)).toBe(false);
    expect(writeBool(null, "k", true)).toBe(false);
    const throwing: PreferenceStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(writeBool(throwing, "k", true)).toBe(false);
  });

  it("badge wrappers persist under the badge key (stubbed window)", () => {
    const storage = memoryStorage();
    const dispatchEvent = vi.fn();
    const g = globalThis as Record<string, unknown>;
    const prevWindow = g["window"];
    const prevCustomEvent = g["CustomEvent"];
    g["window"] = { localStorage: storage, dispatchEvent };
    g["CustomEvent"] = class {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    try {
      expect(readBadgePreference(true)).toBe(true);
      expect(writeBadgePreference(false)).toBe(true);
      expect(readBadgePreference(true)).toBe(false);
      expect(dispatchEvent).toHaveBeenCalledOnce();
      expect(writeBadgePreference(true)).toBe(true);
      expect(readBadgePreference(false)).toBe(true);
      storage.setItem(BADGE_PREFERENCE_KEY, "corrupt");
      expect(readBadgePreference(false)).toBe(false);
    } finally {
      if (prevWindow === undefined) delete g["window"];
      else g["window"] = prevWindow;
      if (prevCustomEvent === undefined) delete g["CustomEvent"];
      else g["CustomEvent"] = prevCustomEvent;
    }
  });

  it("badge wrappers survive without any window (SSR)", () => {
    expect(readBadgePreference(true)).toBe(true);
    expect(writeBadgePreference(false)).toBe(false);
  });
});
