import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALES,
  interpolate,
  isLocale,
  localePath,
  messages,
  resolveLocaleFromAcceptLanguage,
  translate,
  translator,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

describe("i18n — dizionario (#64)", () => {
  it("italiano e inglese hanno esattamente le stesse chiavi", () => {
    const itKeys = Object.keys(messages.it).sort();
    const enKeys = Object.keys(messages.en).sort();
    expect(enKeys).toEqual(itKeys);
  });

  it("nessuna traduzione vuota o placeholder sospetto", () => {
    for (const locale of LOCALES) {
      for (const [key, value] of Object.entries(messages[locale]) as [string, string][]) {
        expect(value.trim().length, `${locale}.${key}`).toBeGreaterThan(0);
        expect(value, `${locale}.${key}`).not.toContain("TODO");
      }
    }
  });

  it("le chiavi italiane contengono le stringhe core attese", () => {
    const keys = Object.keys(messages.it);
    for (const expected of [
      "nav.map",
      "nav.profile",
      "auth.signIn",
      "auth.email",
      "auth.password",
      "action.retry",
      "error.network",
      "a11y.skipToContent",
      "checkin.action",
      "lobby.join",
    ]) {
      expect(keys).toContain(expected);
    }
  });
});

describe("i18n — translate", () => {
  it("traduce nella lingua richiesta", () => {
    expect(translate("it", "nav.map")).toBe("Mappa");
    expect(translate("en", "nav.map")).toBe("Map");
  });

  it("interpola i segnaposto e ignora quelli senza valore", () => {
    expect(interpolate("Ciao {name}, {n} campi", { name: "Andrea", n: 3 })).toBe(
      "Ciao Andrea, 3 campi"
    );
    expect(interpolate("Ciao {name}")).toBe("Ciao {name}");
  });

  it("lingua sconosciuta -> default, chiave sconosciuta -> la chiave", () => {
    expect(translate("fr" as Locale, "nav.map")).toBe("Mappa");
    expect(translate("it", "non.esiste" as MessageKey)).toBe("non.esiste");
  });

  it("translator lega la lingua", () => {
    const t = translator("en");
    expect(t("action.save")).toBe("Save");
    expect(t("action.retry")).toBe("Retry");
  });
});

describe("i18n — config", () => {
  it("riconosce solo le lingue supportate", () => {
    expect(isLocale("it")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it("Accept-Language: regione, q e lingue non supportate", () => {
    expect(resolveLocaleFromAcceptLanguage("it-IT,it;q=0.9,en;q=0.8")).toBe("it");
    expect(resolveLocaleFromAcceptLanguage("en-US,en;q=0.9,it;q=0.8")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromAcceptLanguage("fr;q=0.9,en;q=0.8")).toBe("en");
    expect(resolveLocaleFromAcceptLanguage("en;q=0,it;q=0.1")).toBe("it");
    expect(resolveLocaleFromAcceptLanguage("")).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromAcceptLanguage(null)).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromAcceptLanguage("*")).toBe(DEFAULT_LOCALE);
  });

  it("path: italiano non prefissato, inglese sotto /en", () => {
    expect(localePath("it", "/")).toBe("/");
    expect(localePath("it", "/lobbies?tab=nearby")).toBe("/lobbies?tab=nearby");
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/lobbies?tab=nearby")).toBe("/en/lobbies?tab=nearby");
    expect(localePath("en", "courts/abc")).toBe("/en/courts/abc");
  });
});
