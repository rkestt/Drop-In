/**
 * Logica pura del prompt di installazione PWA (nessun DOM, unit-testabile).
 *
 * Il componente client (`components/pwa/install-prompt.tsx`) usa queste
 * funzioni e persiste il timestamp di dismissal in `localStorage` sotto
 * `INSTALL_DISMISS_KEY`. `localStorage` può mancare (SSR) o rifiutare le
 * scritture (Safari in navigazione privata): ogni accesso nel componente è
 * protetto, qui invece si lavora solo su valori già letti.
 */

export const INSTALL_DISMISS_KEY = "pwa-install-dismissed-at";

/** 30 giorni in ms: durata del dismissal di "Non ora". */
export const INSTALL_DISMISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function readDismissedAt(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function dismissalExpired(
  dismissedAt: number | null,
  now: number,
): boolean {
  if (dismissedAt === null) return true;
  return now - dismissedAt >= INSTALL_DISMISS_TTL_MS;
}

export function shouldShowInstallPrompt(input: {
  hasDeferredPrompt: boolean;
  dismissedAt: number | null;
  now: number;
  isStandalone: boolean;
}): boolean {
  if (input.isStandalone) return false;
  if (!input.hasDeferredPrompt) return false;
  if (!dismissalExpired(input.dismissedAt, input.now)) return false;
  return true;
}

export function isIosDevice(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua);
}

export function isStandaloneDisplayMode(
  displayModeMatches: boolean,
): boolean {
  return displayModeMatches;
}
