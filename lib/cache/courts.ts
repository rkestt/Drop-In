import { getItem, setItem } from "./storage";
import type { Court } from "./types";
import {
  CACHE_KEY_COURTS,
  CACHE_TTL_COURTS,
  CACHE_VERSION,
} from "./types";

export function getCachedCourts(): Court[] | null {
  try {
    const raw = getItem(CACHE_KEY_COURTS);
    if (!raw) return null;

    const cache = JSON.parse(raw) as {
      data: unknown;
      timestamp: unknown;
      version: unknown;
    };

    if (!Array.isArray(cache.data)) return null;
    if (typeof cache.timestamp !== "number") return null;
    if (cache.version !== CACHE_VERSION) return null;

    if (Date.now() - cache.timestamp > CACHE_TTL_COURTS) return null;

    return cache.data as Court[];
  } catch {
    return null;
  }
}

export function setCachedCourts(courts: Court[]): boolean {
  const payload = JSON.stringify({
    data: courts,
    timestamp: Date.now(),
    version: CACHE_VERSION,
  });

  return setItem(CACHE_KEY_COURTS, payload);
}

export function isCacheStale(): boolean {
  const raw = getItem(CACHE_KEY_COURTS);
  if (!raw) return true;

  try {
    const cache = JSON.parse(raw) as { timestamp: number };
    return Date.now() - cache.timestamp > CACHE_TTL_COURTS;
  } catch {
    return true;
  }
}

export function clearCourtCache(): void {
  setItem(CACHE_KEY_COURTS, "");
  try {
    localStorage.removeItem(CACHE_KEY_COURTS);
  } catch {
    // fail silently
  }
}