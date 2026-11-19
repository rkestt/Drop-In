/**
 * Token dal fragment `#access_token=...&refresh_token=...` (ticket 109).
 *
 * I link email NON-PKCE (inviti via Admin API, `generateLink`) tornano da
 * `/auth/v1/verify` con la sessione nel fragment, non con `?code=`: il
 * fragment non lascia mai il browser, quindi nessuna API route può
 * scambiarlo — lo legge solo una pagina client (`auth/callback`). Questo
 * modulo puro estrae i token; la sessione la imposta `setSession`.
 */

export interface HashTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Parsea `location.hash` (con o senza `#` iniziale). Ritorna `null` se
 * manca un token: la pagina chiamante rimanda alla nuova-password, il cui
 * gate mostra login + avviso link scaduto.
 */
export function parseHashTokens(hash: string | null | undefined): HashTokens | null {
  if (typeof hash !== "string" || hash.length === 0) return null;
  const fragment = hash.startsWith("#") ? hash.slice(1) : hash;
  if (fragment === "") return null;
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}
