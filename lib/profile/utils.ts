/**
 * Pure del profilo (unica sede della logica testabile).
 * Il resto del profilo è fetch + markup: coperto live, non qui.
 */

/** Iniziali avatar: prime lettere di nome e cognome ("Luca Bianchi" → "LB"). */
export function getInitials(nickname: string): string {
  const parts = nickname.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0]?.[0] ?? "";
  const second =
    parts.length > 1
      ? (parts[parts.length - 1]?.[0] ?? "")
      : (parts[0]?.[1] ?? "");
  return (first + second).toUpperCase();
}

/** Ban attivo = `banned_until` futura. Stringa non data → non bannato. */
export function isBanActive(
  bannedUntil: string | null,
  now: number = Date.now()
): boolean {
  if (bannedUntil === null) return false;
  const ts = new Date(bannedUntil).getTime();
  return Number.isFinite(ts) && ts > now;
}
