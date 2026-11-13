# Phase 3 — Polish & platform (dopo 2.5)

Scritto 2026-11-13. Phase 2 e 2.5 chiuse; staging allineato a `029`. Obiettivo: chiudere i debiti visibili e preparare l'app a utenti reali, senza prod.

## 3A — Prodotto / mappa

| # | Cosa | Note |
|---|---|---|
| 40 | Epica mappa: #41 marker, #42 clustering GeoJSON, #43 preview su click, #44 a11y mappa | Il blocco più visibile; clustering necessario con 10k corti |
| 39 | Errori tile dopo il load: stato UI | Piccolo, ma evita mappa “vuota” silenziosa |
| 75 | Aggiungere campo senza GPS (pin/indirizzo/coordinate) | Decisione di prodotto già aperta |
| 35 | Share court/lobby + OG metadata | Utile per community |
| 34 | Ratings/reviews campi | Dopo moderazione |

## 3B — Moderazione / community

| # | Cosa | Note |
|---|---|---|
| 33 | Admin/moderation panel (campi + report) | Oggi solo Studio/SQL; serve UI minima |
| 47 | Esito proposta + resubmit dopo rifiuto | Chiude il loop submit |
| 45 | Onboarding scelta sport | Bozza incompleta |
| 63 | Audit dati OSM (10k) | Progetto separato, batch manuali |

## 3C — Platform / ops

| # | Cosa | Note |
|---|---|---|
| 32 / 9 | Observability: Sentry, log strutturati, metriche | Prima di utenti reali |
| 37 | Log dev visibili in console | Piccolo |
| 64 / 28 | i18n IT/EN (decisione + routing) | Non bloccante ora |
| — | Legal/privacy: policy, ToS, cookie, export/cancellazione | Pre-utenti reali |
| — | Security/abuso: rate limit, moderazione foto, WAF | Pre-utenti reali |
| — | CI/CD: deploy stage→prod, backup/DR, rollback | Pre-prod |

## Ordine consigliato
1. **40–44** mappa (visibilità + scalabilità).
2. **33** admin moderazione (sblocca community).
3. **75** submit senza GPS.
4. **35/34** share + ratings.
5. **63** audit dati in parallelo (non blocca).
6. **3C** platform/legal prima di prod.

## Fuori scope
- Prod deploy.
- Stage beta formale (deciso: niente).
- Feature nuove non listate.

## Gate
`npm run test:all` + `@oracle` + `@tester` stage per ogni item UI.
