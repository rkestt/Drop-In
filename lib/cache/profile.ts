import { getItem, setItem } from "./storage";

export interface ProfileCache {
  id: string;
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  karma_score: number;
  banned_until: string | null;
  created_at: string;
  updated_at: string;
  timestamp: number;
  version: 1;
}

export const CACHE_KEY_PROFILE = "dropin_profile_v1";
export const CACHE_TTL_PROFILE = 60 * 60 * 1000; // 1 hour

export function getCachedProfile(): ProfileCache | null {
  try {
    const raw = getItem(CACHE_KEY_PROFILE);
    if (!raw) return null;

    const cache = JSON.parse(raw) as ProfileCache;

    if (!cache.user_id) return null;
    if (typeof cache.timestamp !== "number") return null;
    if (cache.version !== 1) return null;

    if (Date.now() - cache.timestamp > CACHE_TTL_PROFILE) {
      clearProfileCache();
      return null;
    }

    return cache;
  } catch {
    clearProfileCache();
    return null;
  }
}

export function setCachedProfile(profile: Omit<ProfileCache, "timestamp" | "version">): boolean {
  const payload: ProfileCache = {
    ...profile,
    timestamp: Date.now(),
    version: 1,
  };

  return setItem(CACHE_KEY_PROFILE, JSON.stringify(payload));
}

export function clearProfileCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY_PROFILE);
  } catch {
    // fail silently
  }
}

export function isProfileCacheStale(): boolean {
  return getCachedProfile() === null;
}