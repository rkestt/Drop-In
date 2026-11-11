---
id: d19
type: impl
hitl: false
claimed: true
blocked_by: [d11, d5, d6]
status: closed
closed_at: 2026-11-10
---
## Question

**Obiettivo.** Implementare il profilo approvato in `d11`: identità, karma leggibile, statistiche reali, scorciatoie a lobby/notifiche/impostazioni. Niente avatar upload e niente storico karma (non esistono).

**Prerequisiti.** Prototipo `docs/design/prototypes/profile.html` approvato (leggi la Resolution di `d11`). `Drawer` (`d5`) e Sonner (`d6`) disponibili.

**File coinvolti.**

- `app/(dashboard)/profile/page.tsx`: fetch profilo + conteggi reali.
- `components/profile/profile-header.tsx` (nuovo): iniziali, nickname, email, CTA "Modifica"/"Imposta nickname".
- `components/profile/karma-panel.tsx` (nuovo): numero Syne, etichetta, regola "+1 check-in, −3 no-show", banner ban con data.
- `components/profile/stats-row.tsx` (nuovo): check-in totali, lobby create, lobby giocate.
- `components/profile/settings-links.tsx` (nuovo): righe verso `/lobbies`, `/notifications`, `/settings`.
- `components/profile/edit-profile-sheet.tsx`: migra a Drawer e a RHF+zod se `d8` è chiuso (altrimenti resta il form attuale).
- `app/(dashboard)/profile/loading.tsx` (nuovo): skeleton coerente.
- `docs/design/specs/profilo.md` (nuovo).

**Dati (query reali, nessun numero inventato).**

- Profilo: `profiles` per `user_id` (nickname, karma_score, banned_until).
- Check-in totali: `check_ins` con `count: "exact", head: true` e `user_id`.
- Lobby create: `lobbies` con `count` e `creator_id`.
- Lobby giocate: `lobby_participants` con `count` e `user_id` (se il conteggio include duplicati, distinct per lobby).
- Se una query fallisce, la statistica mostra "—" e un tooltip "Non disponibile", non 0.

**Comportamento.**

- Ban attivo: banner `--danger` con "Puoi partecipare di nuovo dal <data>" e link a "Cosa succede ora" (testo, non una pagina nuova).
- Nickname assente: stato vuoto con CTA "Imposta nickname" (una sola CTA primaria).
- Drawer modifica: campo, errore inline (vuoto / > 30 caratteri), "Salva" primaria, "Annulla" secondaria; al successo toast Sonner + refresh dei dati.
- Le scorciatoie sono link, non bottoni accent; una sola CTA primaria nella pagina.
- Loading: skeleton con la stessa altezza del contenuto per evitare layout shift.

**Accessibilità.**

- Karma annunciato come testo ("Karma 87 su 100"); la barra è decorativa (`aria-hidden`).
- Iniziali avatar `aria-hidden` perché il nickname è già testo.
- Banner ban `role="status"` (non `alert`: non è un errore nuovo a ogni render).
- Focus visibile, target ≥ 44px, contrasto AA.

**Acceptance.**

- I conteggi corrispondono a query dirette sul DB per lo stesso utente.
- Stato bannato e stato senza nickname verificati con dati reali (o seed locale), non con mock nel componente.
- Il drawer valida e salva; errore inline con `aria-invalid`; toast una volta.
- Nessun upload avatar, nessuno storico karma, nessun grafico.
- `/profile` protetta e raggiungibile dalla bottom nav; link a `/settings` e `/notifications` funzionanti.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi; `@tester` live 360/768 con screenshot.

**Comandi di verifica.**

```bash
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /profile con utente normale, con nickname assente, con banned_until futuro
```

**Riferimenti.** `supabase/migrations/001_initial_schema.sql` (`profiles`, `check_ins`, `lobbies`), `docs/design/prototypes/profile.html`, `docs/design/1.5.md` (F3).

## Resolution

**Stato:** implementato e verificato live il 2026-11-10.

**File.**
- `app/(app)/profile/page.tsx` (nuovo; la pagina lascia il gruppo
  `(dashboard)` per stare sotto la bottom nav — vedi scostamento 1):
  auth guard, `profiles` per `user_id`, 3 conteggi `count exact head`
  in parallelo, banner ban con data reale, fallback `null` → "—".
- `app/(app)/profile/loading.tsx` (nuovo): skeleton con stesse altezze,
  `aria-busy` + status sr-only.
- `components/profile/profile-header.tsx`, `karma-panel.tsx`,
  `stats-row.tsx`, `settings-links.tsx` (nuovi).
- `components/profile/edit-profile-sheet.tsx`: trigger CTA propria
  (niente più `children` annidati in un `<button>`), titolo
  "Modifica nickname", RHF + `editProfileSchema` invariato, hint,
  "Annulla"/"Salva", errore rete inline, successo con
  `toast.success("Nickname salvato.")` + `router.refresh()` (niente reload).
- `components/ui/drawer.tsx`: prop opzionale `initialFocus` (passata a
  `DrawerPopup`, default invariato) per il focus sul campo all'apertura.
- `app/(app)/layout.tsx`: `aria-current="page"` + accento sulla voce attiva.
- `app/globals.css`: `h1-h3`/`p` `text-wrap` spostati in `@layer base`
  (scostamento 3).
- `docs/design/specs/profilo.md` (nuovo).

**Query usate (nessun numero inventato).**
- `profiles.select("nickname,karma_score,banned_until").eq("user_id")`.
- `check_ins` count per `user_id`; `lobbies` count per `creator_id`;
  `lobby_participants` count per `user_id` (UNIQUE su `(lobby_id,user_id)`
  → già distinct per lobby).
- Verifica diretta DB (utente `d19-normal-…`): nickname `LucaB2` (dopo il
  save via drawer), karma 90, ban null, 0/0/0 — la pagina mostra gli stessi
  valori. Utente `d19-banned-…`: karma 43, `banned_until` 2026-11-16
  (banner "16 novembre 2026"). Utente `d19-nonick-…`: nickname null.

**Stati verificati live (dati reali, niente mock):** default, banned,
nickname-mancante, edit-drawer (focus sul campo, Esc/backdrop chiudono),
edit-error (>30 caratteri, `aria-invalid`, focus), stats-vuote (0 reali +
messaggio), toast-salvato (Sonner una volta + refresh). Screenshot 360/768:
`/tmp/opencode/d19-default-360.png`, `d19-default-768.png`,
`d19-nonick-360.png`, `d19-banned-360.png`, `d19-drawer-360/768.png`,
`d19-drawer-error-360/768.png`. Axe su `/profile` loggato: 0 violazioni;
suite `a11y`/`drawer`/`toast` esistenti: verdi.

**Tagli.** Niente avatar upload (nessuno storage), niente storico karma
(tabelle inesistenti), niente grafici. `/notifications` e `/settings`
non esistono ancora: le scorciatoie puntano ai path previsti da d22/d18
(oggi 404, funzionanti all'atterraggio di quei ticket).

**Scostamenti dal ticket.**
1. Pagina in `app/(app)/profile` invece di `app/(dashboard)/profile` (stesso
   URL `/profile`): l'acceptance chiede la bottom nav sulla pagina, che vive
   nel layout `(app)`. Il vecchio file è cancellato.
2. Stringa vuota ammessa dallo schema = azzera il nickname (`editProfileSchema`
   invariato per regola "non duplicare regole"): lo stato `edit-error` del
   prototipo è coperto dal caso >30 caratteri; il caso vuoto salva `null`.
   Il trigger del drawer nel vecchio sheet annidava un Button in un
   `<button>` (HTML invalido): ora il trigger è interno allo sheet.
3. `text-wrap: pretty/balance` su `p`/`h1-h3` in `globals.css` era fuori da
   ogni layer e batteva `truncate`/`whitespace-nowrap` ovunque (trovato
   perché l'email andava a capo a 360px): spostato in `@layer base`.
   Sistema anche `lobby-card` e `submit-court-form`.
4. Config Playwright per la 3112 tenuta fuori dal repo
   (`/tmp/opencode/pw-d19.config.ts` + variante in-worktree cancellata a fine
   lavoro); spec di verifica temporanei cancellati dopo il verde.
5. `test:rls` non eseguibile qui (container `supabase_db` non visibile al
   docker client di questo ambiente); nessuna migration toccata, le query
   usano policy SELECT esistenti già coperte da `assertions.sql`.

**Follow-up oracle (APPROVE WITH NITS, chiusi il 2026-11-10).**
1. `stats-row.tsx`: zeri reali attenuati con `text-[var(--text-secondary)]`
   (come nel prototipo), solo quando `value === 0`; `null` resta "—".
2. `karma-panel.tsx`: bordo superiore 3px accent/danger
   (`border-t-[3px] border-t-[var(--…)]`) — scelto il bordo reale invece
   dello scostamento, token-only.
3. `lib/supabase/middleware.ts`: commento aggiornato (protezione per path,
   gruppi di route irrilevanti).
4. `profile-header.tsx`: `cn()` su stringa singola rimosso; `initials`
   estratto in `lib/profile/utils.ts` come `getInitials`.
5. `app/(app)/layout.tsx`: link bottom nav con `focus-visible` esplicito
   (outline 2px `--focus-ring`, `rounded-control-sm`); verificato live con
   tastiera: outline computato `2px solid rgb(36, 174, 86)`.
6. Unit test nuovo `tests/unit/profile-utils.test.ts`: `getInitials`
   (4 casi) + `isBanActive` (4 casi, soglia, stringa invalida); la pagina
   usa `isBanActive`. Vitest: 12 file, 117 test verdi.
