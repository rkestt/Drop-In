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

## Stato (2026-11-13)

Gate eseguito su tutto il blocco: `tsc --noEmit`, `npm run lint`, `lint:design`,
`vitest` (569 test), `test:rls` (§1–43), `npm run build`, `playwright --project=e2e`
(35 passed senza DB, 57 passed con `E2E_WITH_DB=1`; un flake dell'outbox offline,
verde quando rieseguito col suo sibling). Review indipendente `@oracle` sui diff e
verifica live con `@tester` più una controverifica deterministica UI↔DB.

| # | Cosa | Stato |
|---|---|---|
| 40 (epica) | marker + clustering + preview + a11y | ✅ `#41`–`#44` chiusi: source GeoJSON con cluster, stati (default/preferito/lobby/segnalato/selezionato), anteprima senza reload, un solo tab stop + lista campi, live region. `docs/map.md`, `docs/design/patterns/map.md` |
| 39 | errori tile post-load | ✅ classificazione + soglia 5/10s, banner non bloccante con Riprova/Chiudi, auto-dismiss solo su tile reale. Auto-dismiss non osservabile con tile in cache (documentato) |
| 33 | pannello moderazione | ✅ `/admin`: coda pending (dedup mascherato, approva/rifiuta-con-nota/duplicato, refetch senza optimistic), segnalazioni read-only, voce in Impostazioni solo per moderatori |
| 47 | esito proposta + resubmit | ✅ migration `030`: notifiche dentro `approve/reject` (una per transizione reale), `resubmit_submission` con nuova riga di audit e storia conservata, guardie di stato. UI con `Rifiutata` + `Motivo:` + `Riprova` |
| 75 | campo senza GPS | ✅ database `031` (`p_address` validato) + UI: GPS / pin su mappa / coordinate, indirizzo facoltativo, `p_gps_accuracy` omesso quando manuale, bozza migrabile |
| 35 | share + OG | ✅ `generateMetadata` per campo/lobby (mai throw), `metadataBase`, `ShareButton` (Web Share → clipboard → toast) |
| 37 | log in console | ✅ livelli espliciti, `debug` = Verbose documentato, boot log a `info`, `docs/logging.md` |
| — | `032` | correzione collaterale: `mark_duplicate` riscriveva la storia di audit (`WHERE status='pending'`) |

### Resta aperto

- **63** audit dati OSM (progetto separato, batch manuali).
- **45** onboarding sport (bozza incompleta), **34** ratings/reviews.
- **64/28** i18n, **32/9** osservabilità (Sentry/metriche).
- Legal/privacy, security/abuso (rate limit globale, moderazione foto, WAF), CI/CD
  stage→prod con backup/rollback: pre-utenti reali, non affrontati qui.
- Deploy della push delivery (VAPID + secrets + cron, `docs/push.md`): invariato.
