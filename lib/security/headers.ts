/**
 * Security headers applicati dal middleware a ogni risposta dell'app.
 *
 * Perche' qui e non in `next.config.js`: `headers()` sarebbe statico e
 * globale, mentre il middleware vede anche i redirect (login protetto) e
 * puo' applicare gli stessi header a tutte le risposte senza duplicarli in
 * due posti. La CSP completa non c'e' di proposito (vedi `docs/security.md`):
 * MapLibre e gli stili inline richiedono `unsafe-inline`/`blob:`, una policy
 * allentata darebbe falsa sicurezza. Qui solo header che non rompono nulla.
 */

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  // Mai indovinare il Content-Type: un upload interpretato come HTML
  // diventa XSS sull'origine dell'app.
  "X-Content-Type-Options": "nosniff",
  // L'app non deve essere incorniciata (clickjacking su "Accedi").
  "X-Frame-Options": "DENY",
  // Con l'OAuth di Google il referrer pieno di query string non serve a
  // nessuno; l'origine basta per le statistiche esterne.
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Geolocalizzazione solo per la stessa origine (check-in GPS); niente
  // camera/microfono/pagamenti: l'app non li usa.
  "Permissions-Policy": "geolocation=(self), camera=(), microphone=(), payment=()",
};

/**
 * Copia gli header su una risposta. Idempotente: `set` sovrascrive eventuali
 * valori gia' presenti (es. un reverse proxy upstream).
 */
export function withSecurityHeaders<T extends { headers: Headers }>(
  response: T
): T {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}
