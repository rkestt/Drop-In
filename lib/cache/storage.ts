const CACHE_PREFIX = "dropin_";

export function getItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (e && typeof e === "object" && "name" in e && e.name === "QuotaExceededError") {
      clearAllCaches();
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // fail silently
  }
}

export function clearAllCaches(): void {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(CACHE_PREFIX))
      .forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {
          // fail silently
        }
      });
  } catch {
    // fail silently
  }
}