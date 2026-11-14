/**
 * Deep link di condivisione per campi e lobby (issue #35).
 *
 * Modulo puro, senza I/O: stesso codice sul server (metadata/SSR) e sul
 * client (`ShareButton`). Le URL assolute nascono da `NEXT_PUBLIC_SITE_URL`
 * con fallback `http://localhost:3000`; sul client vince
 * `window.location.origin`, passato come `base` esplicita.
 */

/** Fallback quando `NEXT_PUBLIC_SITE_URL` non è configurata. */
export const DEFAULT_SITE_URL = "http://localhost:3000";

/**
 * Base assoluta per i deep link: esplicita (client) → env → fallback.
 * Mai stringa vuota, mai slash finale.
 */
export function siteBaseUrl(explicit?: string | null): string {
  const raw = (explicit ?? process.env.NEXT_PUBLIC_SITE_URL ?? "")
    .trim()
    .replace(/\/+$/, "");
  return raw || DEFAULT_SITE_URL;
}

/** Path relativo del dettaglio campo. */
export function courtPath(id: string): string {
  return `/courts/${id}`;
}

/** Path relativo del dettaglio lobby. */
export function lobbyPath(id: string): string {
  return `/lobbies/${id}`;
}

/** URL assoluta di condivisione da un path relativo. */
export function shareUrl(path: string, base?: string | null): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${siteBaseUrl(base)}${clean}`;
}

export interface ShareContent {
  title: string;
  text: string;
}

/** Titolo + testo di condivisione di un campo. */
export function courtShareContent(courtName: string): ShareContent {
  return {
    title: `${courtName} · Drop-In`,
    text: `Vieni a giocare a ${courtName}? Trova il campo e unisciti alla lobby su Drop-In.`,
  };
}

/** Titolo + testo di condivisione di una lobby (`whenLabel` già in ora di Roma). */
export function lobbyShareContent(
  courtName: string,
  whenLabel: string,
): ShareContent {
  return {
    title: `Lobby · ${courtName}`,
    text: `Lobby a ${courtName}, ${whenLabel}: unisciti su Drop-In.`,
  };
}

/**
 * Testo per la clipboard quando `navigator.share` manca: testo + URL su due
 * righe, così l'incollato resta un invito leggibile e cliccabile.
 */
export function clipboardText(content: { text: string; url: string }): string {
  return `${content.text}\n${content.url}`;
}
