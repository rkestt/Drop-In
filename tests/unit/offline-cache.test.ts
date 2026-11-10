import { describe, expect, it } from "vitest";
import {
  CACHE_TTL_MS,
  COURTS_CACHE_KEY,
  courtDetailKey,
  cacheAge,
  formatCacheAge,
  readCache,
  writeCache,
  type StorageLike,
} from "@/lib/offline/cache";

function memoryStore(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe("offline cache", () => {
  it("scrive e rilegge un valore", () => {
    const store = memoryStore();
    const courts = [{ id: "1", name: "Campetto Piazza Vittorio" }];
    expect(writeCache(COURTS_CACHE_KEY, courts, store, 1000)).toBe(true);
    expect(readCache(COURTS_CACHE_KEY, store, 2000)).toEqual(courts);
  });

  it("ritorna null oltre il TTL e rimuove la chiave", () => {
    const store = memoryStore();
    writeCache(COURTS_CACHE_KEY, [1, 2], store, 0);
    expect(readCache(COURTS_CACHE_KEY, store, CACHE_TTL_MS + 1)).toBeNull();
    expect(store.getItem(COURTS_CACHE_KEY)).toBeNull();
  });

  it("quota piena: scrittura fallita, lettura null", () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(writeCache(COURTS_CACHE_KEY, [1], full)).toBe(false);
    expect(readCache(COURTS_CACHE_KEY, full)).toBeNull();
  });

  it("storage assente: mai eccezioni", () => {
    expect(writeCache(COURTS_CACHE_KEY, [1], null)).toBe(false);
    expect(readCache(COURTS_CACHE_KEY, null)).toBeNull();
    expect(cacheAge(COURTS_CACHE_KEY, null)).toBeNull();
  });

  it("dati non-JSON: null e chiave rimossa", () => {
    const store = memoryStore({ [COURTS_CACHE_KEY]: "non-json{{{" });
    expect(readCache(COURTS_CACHE_KEY, store)).toBeNull();
    expect(store.getItem(COURTS_CACHE_KEY)).toBeNull();
  });

  it("forma diversa dall'entry: null e chiave rimossa", () => {
    const store = memoryStore({
      [COURTS_CACHE_KEY]: JSON.stringify({ foo: "bar" }),
    });
    expect(readCache(COURTS_CACHE_KEY, store)).toBeNull();
    expect(store.getItem(COURTS_CACHE_KEY)).toBeNull();
  });

  it("chiavi dettaglio campo derivate dall'id", () => {
    expect(courtDetailKey("abc")).toBe("dropin:cache:court:v1:abc");
    const store = memoryStore();
    writeCache(courtDetailKey("abc"), { name: "X" }, store, 1000);
    expect(readCache(courtDetailKey("abc"), store, 2000)).toEqual({
      name: "X",
    });
    expect(readCache(courtDetailKey("altro"), store, 2000)).toBeNull();
  });

  it("cacheAge e formatCacheAge", () => {
    const store = memoryStore();
    writeCache(COURTS_CACHE_KEY, [1], store, 1000);
    expect(cacheAge(COURTS_CACHE_KEY, store, 1000 + 12 * 60000)).toBe(
      12 * 60000,
    );
    expect(formatCacheAge(null)).toBeNull();
    expect(formatCacheAge(30_000)).toBe("adesso");
    expect(formatCacheAge(12 * 60000)).toBe("12 min fa");
    expect(formatCacheAge(60 * 60000)).toBe("1 ora fa");
    expect(formatCacheAge(3 * 3600_000)).toBe("3 ore fa");
  });
});
