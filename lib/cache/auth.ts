import { getItem, setItem } from "./storage";
import type { User } from "@supabase/supabase-js";

export interface AuthCache {
  user: User | null;
  timestamp: number;
  version: 1;
}

export const CACHE_KEY_AUTH = "dropin_auth_v1";
export const CACHE_TTL_AUTH = 30 * 60 * 1000; // 30 minutes

export function getCachedAuth(): AuthCache | null {
  try {
    const raw = getItem(CACHE_KEY_AUTH);
    if (!raw) return null;

    const cache = JSON.parse(raw) as { user: unknown; timestamp: number; version: number };

    if (typeof cache.timestamp !== "number") return null;
    if (cache.version !== 1) return null;

    if (Date.now() - cache.timestamp > CACHE_TTL_AUTH) {
      clearAuthCache();
      return null;
    }

    return cache as AuthCache;
  } catch {
    clearAuthCache();
    return null;
  }
}

export function setCachedAuth(user: User | null): boolean {
  const payload: AuthCache = {
    user,
    timestamp: Date.now(),
    version: 1,
  };

  return setItem(CACHE_KEY_AUTH, JSON.stringify(payload));
}

export function clearAuthCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY_AUTH);
  } catch {
    // fail silently
  }
}

export function isAuthCacheStale(): boolean {
  const cached = getCachedAuth();
  return cached === null;
}