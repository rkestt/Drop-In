/**
 * Fondazione i18n (#64): locali supportati, detection e path.
 *
 * Scelta attuale: italiano unico servito, senza prefisso di locale. Il modulo
 * esiste perché il dizionario e il traduttore siano già la fonte di verità
 * quando si attiverà `[locale]`; vedi `docs/i18n.md` per il piano.
 */

export const LOCALES = ["it", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "it";

/** Cookie/param usato per ricordare la scelta (previsto, non ancora letto). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Sceglie la lingua da un header `Accept-Language` (formato RFC 9110:
 * `it-IT,it;q=0.9,en;q=0.8`). Regione ignorata (`it-IT` -> `it`), `q=0`
 * escluso, primo match vince; senza match -> default.
 */
export function resolveLocaleFromAcceptLanguage(
  header: string | null | undefined
): Locale {
  if (!header) return DEFAULT_LOCALE;

  const candidates = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
      return {
        locale: (tag ?? "").trim().toLowerCase().split("-")[0] ?? "",
        q: Number.isFinite(q) ? q : 0,
      };
    })
    .filter((c) => c.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const candidate of candidates) {
    if (isLocale(candidate.locale)) return candidate.locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * Percorso per una lingua. L'italiano resta non prefissato (URL storici e
 * link condivisi continuano a funzionare), l'inglese vive sotto `/en`.
 */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`;
}
