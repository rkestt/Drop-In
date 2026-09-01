# Context — drop-in-full-test-loop

## Intent
L'app ha molti problemi runtime non catalogati. Utente vuole loop goal-driven di testing completo ("tutta l'app"), con fix inclusi nel loop.

## Decisioni utente
- Scope: TUTTA l'app (non solo percorsi critici).
- Stack: Playwright (E2E) + Vitest (unit). Nessun altro tool.
- Test + fix insieme: ogni errore trovato viene fixato nel piano stesso.

## Stato verificato (2026-08-23 sessione)
- Zero framework di test in repo. Solo lint. `node_modules` presente, tsc+eslint binari ok.
- `npm run build` output standalone; Supabase locale via Docker (`npx supabase start`, reset con seed ~10k courts Roma in `scripts/seed_courts.sql`). NESSUN `supabase/seed.sql`.
- Bug del vecchio recon GIA' FIXATI: next.config.js doppio module.exports (ora ternario corretto), mappa limit(100) (ora viewport-fetch cap 2000), lobbies senza filtro user_id (ora `.eq("user_id", ...)`).
- Bug noto RESIDUO: `components/notifications/push-provider.tsx:19` registerPush è no-op placeholder (serve VAPID + Edge Function — probabilmente fuori scope fix, documentare/testare comportamento degradato).
- eslint-config-next@16 vs next@15 mismatch potenziale su lint — da verificare in infra setup.
- Check-in richiede GPS entro 50m + cooldown 5min → E2E deve mockare geolocation.
- Karma start 90, ban <50 per 7 giorni, auto-checkout cron 2h.
- PWA: sw.ts Serwist, cache map-tiles 500 entries / 30gg.

## Architettura test scelta
- Vitest: solo logica pura (lib/utils.ts, bbox helpers, formattazioni). NO component testing (React 19 + jsdom = rumore, YAGNI).
- Playwright: E2E contro `next dev` (o `next build && next start`) + Supabase locale seedato. Fixture: auth (login reale via Supabase), geolocation mock, storageState per sessioni.
- Gate finale: zero errori console su tutte le route + suite verdi + `tsc --noEmit` pulito.

## Opzioni scartate
- Coverage % come metrica → non misurabile/utili qui; goal = route coperte e verdi.
- Testing Library/jsdom per componenti → costo > valore per questa app.
- Fix push VAPID end-to-end → serve Edge Function deploy, fuori dal loop testing; si testa il graceful degradation.
