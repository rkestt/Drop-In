# Piano post-1.5 — dal branch completo al primo deploy reale

Scritto il 2026-11-12 alla chiusura della sessione "design 1.5".
Prossima sessione: partire da qui, non dalla chat precedente.

## Stato di partenza

- `design/1.5`: piano 1.5 completo (`d1`–`d27`), 87 commit, `master` fermo, nessuna PR.
- Gate verdi in locale: `test:all`, `visual-static` (×2), `visual-full`, `build`; 220 unit, 33 baseline visive.
- Remoto Supabase `jeuqmmiebzeqtdctmtzj` (free): schema `001`→`017` applicato, **DB vuoto di dati**. Vercel: env `@next_public_*` non configurate. Auth URLs non configurate. iPhone reale mai provato.
- **Tracker da correggere**: le issue #54–#61 erano state "assorbite" nei ticket `d*` senza codice. #57 è dichiarata chiusa e **non esiste**. #48 è solo parziale (la home non filtra per raggio).

## Fasi

| Fase | Cosa | Uscita verificabile | Stima |
|---|---|---|---|
| **A** | Tracker veritiero: togliere i falsi "assorbito" dalle issue, correggere `docs/moderation.md` (la 012 è applicata), commentare #48/#53/#59 con lo stato reale | `grep -R "assorbita\|non applicata" docs/ .wayfinder/` senza incoerenze; issue aggiornate | 0,5 g |
| **B** | Bug veri, uno per issue | ogni issue chiusa con test RLS/e2e; migration `018`–`021` in locale | 5 g |
| **C** | PR `design/1.5`→`master` (merge commit, no squash), env Vercel, Auth URLs Supabase | preview deployata, login funzionante | 1 g |
| **D** | Dati reali OSM sul remoto (`scripts/extract_osm.py`, non `seed.sql`), push migration `018`+, riverifica RLS/realtime sul remoto | ≥1 corte `approved`, `db:check` verde, artefatto di verifica in repo | 2 g |
| **E** | iPhone reale: checklist `d4` (drawer, toast, safe-area, mappa touch, install PWA) | checklist firmata o bug tracciati | 1 g |
| **F** | CI con Supabase nel runner | PR verde con test autenticati, <12 min | 2 g |

Fuori scope: i18n (#64), layout desktop (`docs/design/ideas/desktop-layout.md`), admin UI, push delivery.

## Fase B — dettaglio (audit già fatto, prove nel codice)

1. **#48 (M)** — La home `/` chiama `open_lobbies(p_sport, 20)` senza coordinate e mostra lobby di tutta Italia; il filtro raggio esiste solo in `/lobbies` (`components/lobby/nearby-lobbies.tsx` + `lib/lobbies/nearby.ts`). Inoltre "Vicine" non filtra per sport. **Decisione aperta**: raggio dalla posizione utente/centro mappa, oppure "lobby dei campi visibili in mappa".
2. **#54 (S)** — `supabase/migrations/012_moderation_hardening.sql:182-195` maschera solo `id`/`name`: `lat`, `lng`, `distance_m`, `moderation_status` restano esposti. Stessa classe di problema di #55 (il form riceve `id` null proprio perché mascherato).
3. **#55 (S)** — `components/court/submit-court-form.tsx:550-570`: `key={candidate.id}` e `router.push(/courts/${candidate.id})` con `id` null.
4. **#56 (S)** — il cambio sport ricrea la mappa e resetta il viewport: catena `page.tsx` (`pSport` nelle deps) → `onBoundsChange` → `court-map.tsx` effect con `map.remove()`. Serve una ref o svincolare l'effect dal cambio sport.
5. **#57 (S)** — nessun trigger/policy `BEFORE UPDATE` su `lobbies`/`check_ins`: si può spostare una lobby/check-in su un campo `pending`. La 012 ha solo `BEFORE INSERT`.
6. **#59 (S)** — `docs/moderation.md:116` dice ancora "migration 012 non applicata"; tre RPC di moderazione usano `auth.role() <> 'service_role'` (NULL-opaco).
7. **#61 (S)** — `courts_in_viewport` fa `RETURNS SETOF public.courts` (tutte le colonne) mentre `nearby_courts` ha 11 colonne esplicite.

Fuori da questa lista ma reale: **#58** (retract/edit submission, L) e **#60** (`p_query` senz escape, S/M) — valutare se entrano in B o restano a dopo.

## Vincoli di sequenza

- **B prima di C**: #54/#57/#59 sono sicurezza/RLS, non estetica.
- **C prima di D**: senza env e Auth URLs la preview non autentica e i dati non sono verificabili.
- **Dump del remoto prima di ogni `db push`**: il free non ha PITR (`docs/database-workflow.md`).
- **Piano free**: un solo DB, nessun branch, pausa dopo 7 giorni di inattività. Primo deploy e smoke entro quella finestra.
- **Free plan, realtime**: 8 channel aperti dai componenti; verificare i limiti con due browser reali, non solo in locale.

## Checklist pre-release

1. `npm run test:all` + `visual-static` + `visual-full` + `build` verdi sul commit di release.
2. PR `design/1.5`→`master` senza conflitti, merge commit (la storia `d*` è documentazione).
3. Env Vercel + Auth URLs (Site URL, redirect `/api/auth/callback`) configurati.
4. Migration `018`+ pushate sul remoto, `npm run db:check` verde (serve token nuovo).
5. ≥1 corte `approved` nel DB remoto, caricata con lo script OSM.
6. RLS anon verificata sul remoto: `pending` invisibili.
7. Smoke su preview: browse, signup/login/logout, submit, offline, mappa.
8. Realtime con due browser: join in uno, update nell'altro entro ~2 s.
9. Service worker: deploy N → visita → deploy N+1 → rivisita, versione nuova senza svuotare la cache.
10. Backup `pg_dump` del remoto salvato prima del push.

## Cosa NON fare ora

- i18n (#64): decisione "non ora" già presa; riprenderla con uno spike su `/settings`.
- layout desktop: idea salvata, non pianificata.
- CI completa con DB **prima** del deploy: utile ma non bloccante.
- staging su secondo progetto free: solo al primo utente esterno.
- hardening oltre #54/#57/#59: rate limit, WAF, SMTP dedicato → con utenti reali.

## Note tecniche per la prossima sessione

- DB locale: `sudo systemctl start docker` (docker non è abilitato al boot) + `npx supabase start`; `/tmp` è tmpfs e si svuota al riavvio.
- Worktree per questa fase: **stesso filesystem del repo** (`/mnt/HDDL/Projects/...`), `node_modules` con `cp -al`. Con symlink o su `/tmp`, `next/font/local` non applica i font e le baseline visive diventano un falso verde.
- Playwright: progetti `e2e` (gate `test:all`), `visual-static` (CI), `visual-full` (`E2E_WITH_DB=1`). Il nome del progetto entra nel nome delle baseline.
- L'agente deve passare `--yes` a `db push`; senza token/password le operazioni remote non funzionano (furono ruotati l'11/11).
- Utente di test locale: creato via Admin API con `email_confirm: true` (nessuna mail parte: `enable_confirmations` è off in `config.toml`).
