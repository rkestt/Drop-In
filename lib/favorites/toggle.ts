/**
 * Seam puro dei preferiti (#22): tutto cio' che il toggle del cuore decide
 * senza DOM ne' Supabase, cosi' e' testabile con vitest senza browser.
 */

/** Il toggle e' un flip: nessun altro stato intermedio esiste. */
export function nextFavoriteState(current: boolean): boolean {
  return !current;
}

/** Senza user id non c'e' riga da scrivere: si apre il login. */
export function shouldRedirectToLogin(
  userId: string | null | undefined
): boolean {
  return userId == null;
}

export type FavoritesResult = { ok: true } | { ok: false; message: string };

/** Errore Supabase ({ message }) -> esito maneggiabile dalla UI. */
export function toFavoritesResult(
  error: { message: string } | null | undefined
): FavoritesResult {
  if (!error) return { ok: true };
  return { ok: false, message: error.message || "Operazione non riuscita." };
}
