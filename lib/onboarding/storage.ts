/**
 * Persistenza dell'onboarding (pura, nessun rendering).
 *
 * `localStorage` può mancare (SSR) o rifiutare le scritture (Safari in
 * navigazione privata, cookie bloccati): ogni accesso è protetto e non lancia
 * mai. Se lo storage non è disponibile `hasSeen` risponde `false` (il drawer
 * si apre) e `markSeen` è un no-op (la chiusura resta locale alla sessione).
 */

export const ONBOARDED_KEY = "dropin:onboarded:v1";

export function coachKey(feature: string): string {
  return `dropin:coach:${feature}`;
}

export const COACH_CHECKIN_KEY = coachKey("check-in");

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSeen(key: string): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    return storage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function markSeen(key: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, "1");
  } catch {
    // Storage pieno o bloccato: la chiusura resta valida per la sessione.
  }
}
