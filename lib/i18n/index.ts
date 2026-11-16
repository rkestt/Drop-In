/**
 * API pubblica i18n (#64).
 *
 * Uso previsto quando il locale sarà dinamico:
 *   const t = translator(locale);
 *   t("auth.signIn");
 *
 * Finché non c'è il routing, i componenti usano `DEFAULT_LOCALE` e il
 * comportamento resta identico all'italiano di oggi.
 */

import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { messages as catalog, type MessageKey } from "./messages";

export { catalog as messages };
export type { MessageKey } from "./messages";

export { DEFAULT_LOCALE, LOCALES, isLocale, localePath, resolveLocaleFromAcceptLanguage } from "./config";
export type { Locale } from "./config";

/** Sostituisce `{nome}` con `params.nome`; i segnaposto ignoti restano. */
export function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Traduce `key` nella lingua `locale`. Lingua o chiave sconosciute cadono
 * sull'italiano; chiave sconosciuta anche lì restituisce la chiave, così il
 * buco si vede in UI invece di diventare una stringa vuota.
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const active = isLocale(locale) ? locale : DEFAULT_LOCALE;
  const template = catalog[active][key] ?? catalog.it[key] ?? key;
  return interpolate(template, params);
}

/** Traduttore legato a una lingua (per riusare `t` nei componenti). */
export function translator(locale: Locale) {
  return (key: MessageKey, params?: Record<string, string | number>) =>
    translate(locale, key, params);
}
