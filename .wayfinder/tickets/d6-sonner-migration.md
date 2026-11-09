---
id: d6
type: impl
hitl: false
claimed: false
blocked_by: [d4]
---
## Question

**Obiettivo.** Sostituire il toast fatto in casa con Sonner, lasciando un solo punto per gli esiti non bloccanti. Il listener realtime di karma/ban resta, ma non gestisce più lo stato dei toast.

**Contesto.** `components/notifications/notification-toast.tsx` mantiene un array di toast, timer, dismiss e markup; `components/notifications/toast-provider.tsx` lo monta. Sonner è già installato e provato nella styleguide. `stack.md`: successo e azioni non bloccanti → toast; errore di campo → inline.

**File coinvolti.**

- `components/notifications/toaster.tsx` (nuovo): `<Toaster />` del progetto, montato una volta in `app/layout.tsx`.
- `components/notifications/karma-listener.tsx` (nuovo, da `notification-toast.tsx`): stessa subscription Realtime su `profiles`, ma su evento chiama `toast.warning` / `toast.error` / `toast.success`; non renderizza nulla.
- `components/notifications/toast-provider.tsx`: eliminato.
- `app/layout.tsx`: `<ToastProvider />` → `<Toaster />` + `<KarmaListener />`.
- `docs/design/stack.md` (stato: adottato), `docs/design/components/toast.md` (nuovo), `docs/design/COMPONENTS.md`, `docs/design/README.md` (indice).

**Configurazione Sonner.**

- `position="top-center"`, `closeButton`, `richColors={false}`, `expand={false}`, `visibleToasts={1}`.
- Stile dai token: `toastOptions.classNames` con `bg-[var(--bg-elevated)]`, `text-[var(--text-primary)]`, `border border-[var(--border)]`, `rounded-card`, `font-[family-name:var(--font-source-sans)]`; oppure le CSS variable di Sonner (`--normal-bg`, `--normal-text`, `--normal-border`, `--border-radius`) impostate in `globals.css`.
- `offset` / `mobileOffset` devono tenere il toast sopra la bottom nav e fuori dalla notch (`env(safe-area-inset-top)`).
- Un solo toast per evento: niente duplicati se il payload arriva due volte (usa `id` stabile, es. `karma-${newKarma}`).
- Messaggi invariati nella sostanza: spiega cosa è cambiato ("Karma -3: hai saltato una lobby") e cosa fare.

**Regole.**

- Nessun `alert()`, nessun toast per errori di campo (restano inline).
- Il listener non renderizza markup: chiama solo `toast`.
- Se l'utente non è loggato, il listener non apre canali.
- Non toccare `components/notifications/push-provider.tsx` (permessi push) in questo ticket.

**Acceptance.**

- `<Toaster />` compare una sola volta nell'albero (root layout).
- `grep -rn "toast-provider" app components` non restituisce nulla; il file non esiste.
- Un evento di calo karma produce un solo toast, con testo corretto; swipe lo chiude e il contenitore sparisce.
- Il toast non copre la bottom nav né finisce sotto la notch (360px e iPhone).
- Con reduced motion non c'è animazione di ingresso; il testo resta leggibile.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi.
- Docs aggiornate.

**Comandi di verifica.**

```bash
grep -rn "toast-provider" app components
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /styleguide → Toast; poi simulare un update di karma su Supabase e verificare un solo toast
```

**Riferimenti.** `app/styleguide/library-showcase.tsx` (sezione Toast), `docs/design/stack.md`, `docs/design/patterns/onboarding.md` (feedback immediato).

## Resolution

Implementato (branch `fix/d6-f1`):

- **Rimossi**: `components/notifications/toast-provider.tsx`, `components/notifications/notification-toast.tsx` (array/timer/markup fatti in casa).
- **Nuovi**:
  - `components/notifications/toaster.tsx` — unico `<Toaster />`: `theme="dark"`, `position="top-center"`, `closeButton`, `richColors={false}`, `expand={false}`, `visibleToasts={1}`, `offset`/`mobileOffset = calc(env(safe-area-inset-top, 0px) + 16px)`, `classNames` dai token.
  - `components/notifications/karma-events.ts` — funzione pura `profileChangeEvents(old, new)`: calo → `karma_drop` (id `karma-${newKarma}`), recupero → `karma_recovery`, ban → `ban_applied` (id `ban-${banned_until}`). Stesso evento → stesso id: Sonner sostituisce, non accoda.
  - `components/notifications/karma-listener.tsx` — stessa subscription Realtime su `profiles`, chiama `toast.warning/error/success`; ritorna `null` (nessun markup); nessun canale se non loggato.
- **Aggiornati**: `app/layout.tsx` (`<Toaster />` + `<KarmaListener />`), `app/styleguide/library-showcase.tsx` (rimosso il `<Toaster />` locale, resta solo `toast`), `app/globals.css` (override `--normal-bg/text/border` → token, specificità sopra il CSS runtime di Sonner), `docs/design/components/toast.md` (nuovo).
- **Non toccati**: `docs/design/COMPONENTS.md`, `README.md`, `stack.md`, `.wayfinder/MAP.md`, `docs/design/1.5.md`, `push-provider.tsx`, `bottom-sheet.tsx`.

Esiti verifiche (dal worktree):

- `grep -rn "toast-provider" app components` → vuoto (exit 1).
- `npm run lint` → 0 errori (1 warning pre-esistente in `scripts/check-design.mjs`).
- `npx tsc --noEmit` → pulito. `npm run lint:design` → OK (63 file).
- `npx vitest run` → 8 file, 73 test passati (nuovo `tests/unit/karma-events.test.ts`: 5 casi, incl. id stabile su payload duplicato).
- `tests/e2e/toast.spec.ts` (nuovo, 2 test passati su porta 3101 — la 3100 era occupata dal dev server della lane d5, non toccato): dalla styleguide un click produce **1 solo** `[data-sonner-toast]`; a riposo y=16px dal top, centrato orizzontalmente; drag verso l'alto → toast rimosso (`toHaveCount(0)`); zero errori console. Nota: la misura y va presa ad animazione finita (il toast monta da translateY(±100%)).
- `test:a11y` (3 pagine axe) → passato.
- Safe-area: offset con `env(safe-area-inset-top)` + 16px; sopra la bottom nav (toast in alto); reduced motion: animazione ~0 (regola globale + media query Sonner), testo leggibile — coperto dal secondo test e2e.
- Screenshot: non salvati (toast effimero); evidenza = test e2e + DOM ispezionato (`[data-sonner-toaster]` singolo, top computato 16px).

Scostamenti dal ticket:

- Aggiunto `theme="dark"` (non elencato ma necessario: Sonner v2 ha default `light`, l'app è dark-only; la styleguide usava già `theme="dark"`).
- Logica di mapping estratta in `karma-events.ts` puro per renderla unit-testabile in ambiente node (vitest non include `.tsx`/jsdom); in più coperto il caso recupero karma → `toast.success` (il ticket elenca le tre chiamate `warning/error/success`).
- Karma reale via Supabase non simulato e2e (richiede auth + realtime): dedup verificato a livello unit (id stabile) + singolo nodo DOM.
