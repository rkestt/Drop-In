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

/**
 * Etichetta unica per chi ha cancellato l'account (#94). `profiles` sparisce
 * con la cascata, quindi i riferimenti altrui (partecipanti, autori di
 * recensioni) non hanno più una riga da cui leggere il nickname.
 */
export const DELETED_PLAYER_LABEL = "Giocatore eliminato";

/**
 * Nickname di un'altra persona, risolto dalla mappa `profiles`.
 *
 * Riga assente = profilo eliminato (o mai creato): il fallback è un testo
 * unico, mai `undefined`/vuoto. Riga presente con `nickname` nullo resta
 * `null`: l'utente esiste ma non ha ancora scelto un nickname, e ogni
 * schermata tiene il proprio fallback per quel caso ("Anonimo", "Utente
 * Drop-In"). Le policy leggono i profili di tutti, quindi non c'è un caso
 * "riga nascosta" che possa sembrare assente.
 */
export function resolveNickname(
  nicknames: ReadonlyMap<string, string | null>,
  userId: string
): string | null {
  if (!nicknames.has(userId)) return DELETED_PLAYER_LABEL;
  return nicknames.get(userId) ?? null;
}
