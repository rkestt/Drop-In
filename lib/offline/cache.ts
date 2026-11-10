// lib/offline/cache.ts — cache locale (localStorage) per i soli dati pubblici.
// Solo campi e lobby: mai profilo, karma, notifiche o coordinate utente.
// TTL 24h. Funzioni pure rispetto allo storage iniettato (default: localStorage).

export const COURTS_CACHE_KEY = "dropin:cache:courts:v1";
export const LOBBIES_CACHE_KEY = "dropin:cache:lobbies:v1";
const COURT_DETAIL_PREFIX = "dropin:cache:court:v1:";

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const courtDetailKey = (id: string): string =>
  `${COURT_DETAIL_PREFIX}${id}`;

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function isEntry<T>(v: unknown): v is CacheEntry<T> {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.savedAt === "number" && "value" in e;
}

/** Scrive in cache. Ritorna false se lo storage manca, è pieno o il valore non è serializzabile. */
export function writeCache<T>(
  key: string,
  value: T,
  store: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): boolean {
  if (!store) return false;
  try {
    const entry: CacheEntry<T> = { savedAt: now, value };
    store.setItem(key, JSON.stringify(entry));
    return true;
  } catch {
    return false;
  }
}

/** Legge dalla cache. Ritorna null se manca, è scaduta (TTL), non è JSON o ha forma diversa. */
export function readCache<T>(
  key: string,
  store: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
  ttlMs: number = CACHE_TTL_MS,
): T | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      store.removeItem(key);
    } catch {
      /* best effort */
    }
    return null;
  }
  if (!isEntry<T>(parsed)) {
    try {
      store.removeItem(key);
    } catch {
      /* best effort */
    }
    return null;
  }
  if (now - parsed.savedAt > ttlMs) {
    // Scaduta: null + rimozione (niente entry marce che crescono nel tempo).
    try {
      store.removeItem(key);
    } catch {
      /* best effort */
    }
    return null;
  }
  return parsed.value;
}

/** Età del dato in cache (ms) oppure null se manca/non valida. */
export function cacheAge(
  key: string,
  store: StorageLike | null = defaultStorage(),
  now: number = Date.now(),
): number | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isEntry(parsed)) return null;
    return Math.max(0, now - parsed.savedAt);
  } catch {
    return null;
  }
}

/** "12 min fa" / "3 ore fa" / "adesso". Null se age è null. */
export function formatCacheAge(ageMs: number | null): string | null {
  if (ageMs == null) return null;
  const mins = Math.floor(ageMs / 60000);
  if (mins < 1) return "adesso";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  return `${hours} ${hours === 1 ? "ora" : "ore"} fa`;
}
