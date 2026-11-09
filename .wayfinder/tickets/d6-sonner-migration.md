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

(TBD — chiudere con: file rimossi, configurazione Sonner, esito safe-area/swipe, screenshot, docs.)
