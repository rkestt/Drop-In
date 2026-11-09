# Wayfinder — Drop-In

## Map design-system [ATTIVA]

### Destination

Ogni schermata core ha un prototipo approvato e un'implementazione reale, con il
design system completo (Drawer, Sonner, Motion, RHF+zod), i debiti chiusi
(auth, mappa, font, Safari iOS), il gate unico verde e visual/a11y in CI.
Nessun codice finto in produzione.

### Notes

- Piano completo, fasi e stato schermate: [docs/design/1.5.md](../docs/design/1.5.md).
- Prototipi statici: `docs/design/prototypes/` (base condivisa `proto.css` /
  `proto.js`, regole e comandi in `prototypes/README.md`). Non sono route e non
  entrano nel bundle.
- Regola d'oro: **prima il prototipo, poi l'implementazione**. La review dei
  prototipi è HITL; un'impl che parte da un proto non approvato si ferma.
- Nessuna route segnaposto, nessun dato demo in produzione. Mock solo dietro
  env esplicita (`NEXT_PUBLIC_ALLOW_MOCK_GPS`) e mai nel build di produzione.
- Librerie ammesse e stato: [docs/design/stack.md](../docs/design/stack.md).
  Una primitiva per ruolo: niente Radix + Base UI insieme.
- Gate: `npm run test:all` + `npm run lint:design`; `npm run test:a11y` in CI;
  visual regression in CI dopo `d3` e completa dopo `d27`.
- Tracker locale: `blocked_by` = blocking, `claimed` = preso in carico,
  frontier = aperto + non bloccato + non claimed.
- Esecuzione: **un ticket = una subsessione**, prompt = contenuto del ticket.
  Se il comando `/implement` è disponibile, lanciarlo con l'id del ticket;
  altrimenti incollare il file `.wayfinder/tickets/<id>-*.md` come prompt.
  Chi prende un ticket non deve rileggere il piano.
- La map `drop-in-core-loop` resta sotto, in corso: i ticket `t*` non si
  toccano da questa map. Se un ticket `d*` incontra un lavoro `t*` (es. trigger
  capacità lobby in t10), si ferma e apre un ticket separato, non duplica.

### Frontier (sbloccati)

- [d9-proto-onboarding](tickets/d9-proto-onboarding.md) — design HITL: prototipo pronto, **in review** (`prototypes/onboarding.html`).
- [d10-proto-settings](tickets/d10-proto-settings.md) — design HITL: prototipo pronto, **in review** (`prototypes/settings.html`).
- [d11-proto-profile](tickets/d11-proto-profile.md) — design HITL: prototipo pronto, **in review** (`prototypes/profile.html`).
- [d12-proto-lobby](tickets/d12-proto-lobby.md) — design HITL: prototipo pronto, **in review** (`prototypes/lobby.html`).
- [d13-proto-checkin](tickets/d13-proto-checkin.md) — design HITL: prototipo pronto, **in review** (`prototypes/checkin.html`).
- [d14-proto-notifications](tickets/d14-proto-notifications.md) — design HITL: prototipo pronto, **in review** (`prototypes/notifications.html`).
- [d15-proto-report](tickets/d15-proto-report.md) — design HITL: prototipo pronto, **in review** (`prototypes/report.html`).
- [d16-proto-offline](tickets/d16-proto-offline.md) — design HITL: prototipo pronto, **in review** (`prototypes/offline.html`).

### Decisions so far (map design-system)

- [d1-fix-auth-middleware](tickets/d1-fix-auth-middleware.md) ✅ 2026-11-09 — middleware fail-open su errore di rete (timeout 3s), `next` preservato fino al callback (password e OAuth), match per primo segmento (`/profiles` non protetto), `LoginModal` senza `next` resta sulla pagina; `/courts/<id>` con Supabase spento resta 404 del dato, shell offline a `d24`.
- [d2-map-sprites](tickets/d2-map-sprites.md) ✅ 2026-11-09 — icone inline `gate`/`bollard` (niente sprite, offline-safe); OpenFreeMap non distribuisce `barrier_line`, quindi `dropin-barriers` è un gap-filler su `poi` da z16 (a Villa Borghese 91 icone nostre vs 0 stock, che rende le barriere solo da z17 per rank). Accoppiato ai rank Liberty: riverificare se lo stile cambia.
- [d4-safari-ios-check](tickets/d4-safari-ios-check.md) ✅ 2026-11-09 — nessun iPhone disponibile: verifica per motore con Playwright WebKit 27.2 (immagine ufficiale) + profilo iPhone 13, confronto Chromium. PASS su apertura/focus iniziale/ESC/backdrop/drag/reduced motion/console/toast; **focus trap che cicla FAIL in entrambi i motori** → requisito di d5; verifica su device reale rimandata alla release (scritta in `stack.md`). Drawer e Sonner adottati con quelle riserve: d5/d6 sbloccati.
- [d3-visual-ci-fonts](tickets/d3-visual-ci-fonts.md) ✅ 2026-11-09 — Syne e Source Sans 3 self-hosted (62 KB, OFL), `next/font/local`, `document.fonts.ready` prima degli screenshot, visual regression nel job CI.

### Blocked

- [d5-drawer-migration](tickets/d5-drawer-migration.md) — sbloccato da d4: pronto per il prossimo giro.
- [d6-sonner-migration](tickets/d6-sonner-migration.md) — sbloccato da d4: pronto per il prossimo giro.
- [d7-motion-pipelines](tickets/d7-motion-pipelines.md) — blocked_by d5, d6.
- [d8-form-rhf-zod](tickets/d8-form-rhf-zod.md) — blocked_by d5.
- [d17-impl-onboarding](tickets/d17-impl-onboarding.md) — blocked_by d9, d5, d6.
- [d18-impl-settings](tickets/d18-impl-settings.md) — blocked_by d10, d5, d6.
- [d19-impl-profile](tickets/d19-impl-profile.md) — blocked_by d11, d5, d6.
- [d20-impl-lobby](tickets/d20-impl-lobby.md) — blocked_by d12, d5, d6.
- [d21-impl-checkin](tickets/d21-impl-checkin.md) — blocked_by d13, d5, d6.
- [d22-impl-notifications](tickets/d22-impl-notifications.md) — blocked_by d14, d5, d6.
- [d23-impl-report](tickets/d23-impl-report.md) — blocked_by d15, d5, d6.
- [d24-impl-offline](tickets/d24-impl-offline.md) — blocked_by d16, d5, d6.
- [d25-a11y-sweep](tickets/d25-a11y-sweep.md) — blocked_by d17–d24.
- [d26-pwa-performance](tickets/d26-pwa-performance.md) — blocked_by d24.
- [d27-visual-full](tickets/d27-visual-full.md) — blocked_by d25, d26.

### Tickets (elenco completo)

| Ticket | Tipo | HITL | Blocked by | Stato |
|---|---|---|---|---|
| [d1-fix-auth-middleware](tickets/d1-fix-auth-middleware.md) | bug | no | — | chiuso 2026-11-09 |
| [d2-map-sprites](tickets/d2-map-sprites.md) | bug | no | — | chiuso 2026-11-09 |
| [d3-visual-ci-fonts](tickets/d3-visual-ci-fonts.md) | infra | no | — | chiuso 2026-11-09 |
| [d4-safari-ios-check](tickets/d4-safari-ios-check.md) | verify | sì | — | chiuso 2026-11-09 (WebKit, device pendente) |
| [d5-drawer-migration](tickets/d5-drawer-migration.md) | impl | no | d4 | chiuso 2026-11-09 |
| [d6-sonner-migration](tickets/d6-sonner-migration.md) | impl | no | d4 | chiuso 2026-11-09 |
| [d7-motion-pipelines](tickets/d7-motion-pipelines.md) | impl | no | d5, d6 | aperto |
| [d8-form-rhf-zod](tickets/d8-form-rhf-zod.md) | impl | no | d5 | aperto |
| [d9-proto-onboarding](tickets/d9-proto-onboarding.md) | design | sì | — | in review HITL |
| [d10-proto-settings](tickets/d10-proto-settings.md) | design | sì | — | in review HITL |
| [d11-proto-profile](tickets/d11-proto-profile.md) | design | sì | — | in review HITL |
| [d12-proto-lobby](tickets/d12-proto-lobby.md) | design | sì | — | in review HITL |
| [d13-proto-checkin](tickets/d13-proto-checkin.md) | design | sì | — | in review HITL |
| [d14-proto-notifications](tickets/d14-proto-notifications.md) | design | sì | — | in review HITL |
| [d15-proto-report](tickets/d15-proto-report.md) | design | sì | — | in review HITL |
| [d16-proto-offline](tickets/d16-proto-offline.md) | design | sì | — | in review HITL |
| [d17-impl-onboarding](tickets/d17-impl-onboarding.md) | impl | no | d9, d5, d6 | aperto |
| [d18-impl-settings](tickets/d18-impl-settings.md) | impl | no | d10, d5, d6 | aperto |
| [d19-impl-profile](tickets/d19-impl-profile.md) | impl | no | d11, d5, d6 | aperto |
| [d20-impl-lobby](tickets/d20-impl-lobby.md) | impl | no | d12, d5, d6 | aperto |
| [d21-impl-checkin](tickets/d21-impl-checkin.md) | impl | no | d13, d5, d6 | aperto |
| [d22-impl-notifications](tickets/d22-impl-notifications.md) | impl | no | d14, d5, d6 | aperto |
| [d23-impl-report](tickets/d23-impl-report.md) | impl | no | d15, d5, d6 | aperto |
| [d24-impl-offline](tickets/d24-impl-offline.md) | impl | no | d16, d5, d6 | aperto |
| [d25-a11y-sweep](tickets/d25-a11y-sweep.md) | task | no | d17–d24 | aperto |
| [d26-pwa-performance](tickets/d26-pwa-performance.md) | task | no | d24 | aperto |
| [d27-visual-full](tickets/d27-visual-full.md) | infra | no | d25, d26 | aperto |

---

## Map drop-in-core-loop [IN CORSO]

### Destination

Loop chiuso verificato: utente crea lobby → join → check-in (anche mock in dev) → karma +1 / -3 e ban <50 funzionano, lobby non bucabile se piena/bannato, gate `test:all` verde con TDD (unit prima, poi codice, poi E2E). Pronto per prod.

### Notes

- Dominio: basket Roma — courts, lobby, check-in 50m, karma 90, ban 7d se <50, pg_cron auto-close.
- Skill: `wayfinder`, `tdd` (red→green, test a seam), `diagnosing-bugs`, `research` per trigger, `impeccable` se tocchi UI.
- Regola TDD di questa map: **test prima, poi codice** — i file `tests/unit/*.test.ts` scritti in t8/t9 non si toccano più in t10/t11.
- Tracker: `.wayfinder/tickets/` locale, `blocked_by` blocking, `claimed` claim, frontier = open+unblocked+unclaimed.
- Stato: `drop-in-next` chiusa 2026-09-02 (t6/t7). Questa è nuova map.

### Decisions so far (map precedenti)

- [t3-map-query](tickets/t3-map-query.md): viewport PostGIS RPC `courts_in_viewport`, bboxInside cache, zoom<10 skip.
- [t4-lobbies-scope](tickets/t4-lobbies-scope.md): `LobbyTabs` mine (creator/participant) vs nearby (open).
- [t5-push-scope](tickets/t5-push-scope.md): push deferito, trigger dormienti.
- [t6-e2e-critical-paths](tickets/t6-e2e-critical-paths.md) ✅ 2026-09-02 — lint0 tsc0 vitest13/13 playwright5/5, fix 404 ignore.
- [t7-full-app-sweep-fixes](tickets/t7-full-app-sweep-fixes.md) ✅ 2026-09-02 — middleware /lobbies+/profile, PWA icons 192/512, sw 43K.

### Tickets aperti (frontier)

- [t8-karma-lobby-unit](tickets/t8-karma-lobby-unit.md) — Unit test karma e lobby (pure domain, tdd red)
- [t9-checkin-geo-validation-unit](tickets/t9-checkin-geo-validation-unit.md) — Unit test check-in, geo distance, validation (tdd red)

### Tickets bloccati

- [t10-core-loop-impl](tickets/t10-core-loop-impl.md) — Implementa loop per far diventare verdi t8/t9 (blocked_by t8,t9)
- [t11-e2e-loop](tickets/t11-e2e-loop.md) — E2E Playwright loop vero con mock GPS (blocked_by t10)

### Not yet specified

- Dettaglio UI karma toast dopo -3/+1 (già in notification-toast, verificare)
- Balancing karma: +1 è poco? -3 giusto? → per map successiva

### Out of scope

- Deploy prod, OSM 10k full, push delivery, pagamenti — non in questo loop
