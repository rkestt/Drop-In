---
type: source
title: "E2E di idratazione: server in UTC e browser a Roma"
slug: e2e-hydration-server-utc-browser-roma
status: insight
category: "sources"
created: 2026-11-13
updated: 2026-11-13
---

# E2E di idratazione: server in UTC e browser a Roma

# E2E di idratazione: server in UTC e browser a Roma

Contesto: la pagina dettaglio lobby lanciava React #418 su stage ma non in locale.

## Perché non si vedeva in locale

Bug: `toLocaleDateString`/`toLocaleTimeString` senza `timeZone` ("Oggi"/"Ieri" ricalcolato con `new Date()` durante il render). Il testo cambia se il fuso del processo Node è diverso da quello del browser. Su Vercel il server è UTC, in locale è Europe/Rome: stesso fuso, nessun mismatch.

## Decisione

- Unico modulo puro `lib/datetime.ts` con `APP_TIME_ZONE = "Europe/Rome"`, chiavi giorno via `Intl.DateTimeFormat` + `formatToParts` (mai `getFullYear()` su Date locale), `now` iniettabile.
- `playwright.config.ts`: `webServer.env.TZ = "UTC"` e browser con `timezoneId: "Europe/Rome"` nel test di idratazione. Senza il primo, l'e2e passa sempre per caso e non protegge nulla.
- Trappola: `reuseExistingServer: true` riusa un dev server già acceso con il suo fuso → per la garanzia UTC va ucciso prima.
- Non si mount-guarda il testo: si vedrebbe l'ora sbagliata con un flash.

## Prova

Ripristinando il file pre-fix il test fallisce su `/lobbies/[id]`; con il fix passa su `/`, `/lobbies`, `/lobbies/[id]`, `/courts/[id]`, `/profile`.

## Related

- `sources/sport-null-visibile-con-qualsiasi-filtro` (stessa lezione: la documentazione di semantica si aggiorna nello stesso commit)
