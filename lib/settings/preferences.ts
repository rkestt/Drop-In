/**
 * Settings preferences persisted in localStorage.
 *
 * `readBool` / `writeBool` are pure and take an injected storage so unit
 * tests never touch `window`. The `*BadgePreference` wrappers bind the
 * badge key to the real localStorage with a Safari-private-mode-safe
 * fallback (any throw — SecurityError, quota — means "keep the default",
 * never a crash). Toggling also emits `BADGE_PREFERENCE_EVENT` so a bell
 * badge, when present, can update without a reload.
 */

export const BADGE_PREFERENCE_KEY = "dropin:pref:badge:v1";

/** Emitted on `window` after a successful badge-preference write. */
export const BADGE_PREFERENCE_EVENT = "dropin:badge-pref";

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function safeLocalStorage(): PreferenceStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** "1" -> true, "0" -> false, anything else (missing, corrupt) -> fallback. */
export function readBool(
  storage: PreferenceStorage | null | undefined,
  key: string,
  fallback: boolean
): boolean {
  try {
    const raw = storage?.getItem(key);
    if (raw === "1") return true;
    if (raw === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when there is no usable storage (or the write throws). */
export function writeBool(
  storage: PreferenceStorage | null | undefined,
  key: string,
  value: boolean
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, value ? "1" : "0");
    return true;
  } catch {
    return false;
  }
}

export function readBadgePreference(fallback = true): boolean {
  return readBool(safeLocalStorage(), BADGE_PREFERENCE_KEY, fallback);
}

/** Persists the badge preference and notifies listeners. Never throws. */
export function writeBadgePreference(value: boolean): boolean {
  const ok = writeBool(safeLocalStorage(), BADGE_PREFERENCE_KEY, value);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent<boolean>(BADGE_PREFERENCE_EVENT, {
          detail: value,
        })
      );
    }
  } catch {
    // Event dispatch is best-effort; the persisted value is what matters.
  }
  return ok;
}
