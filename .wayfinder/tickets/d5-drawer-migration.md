---
id: d5
type: impl
hitl: false
claimed: false
blocked_by: [d4]
---
## Question

**Obiettivo.** Sostituire `BottomSheet` con un solo `Drawer` costruito su Base UI, mantenendo aspetto e API del progetto. Alla fine nel codice esiste una sola primitiva per dialog/drawer.

**Contesto.** `components/ui/bottom-sheet.tsx` gestisce a mano focus trap, ESC, scroll lock, drag e restore focus (oltre 200 righe). Base UI fornisce gli stessi comportamenti, testati, con `Drawer`. `stack.md` dice: una primitiva per ruolo, niente Radix + Base UI insieme. `d4` ha già verificato su iOS che il Drawer è usabile.

**File coinvolti.**

- `components/ui/drawer.tsx` (nuovo): wrapper del progetto su Base UI.
- `components/ui/bottom-sheet.tsx`: eliminato alla fine.
- Call site da aggiornare (6): `components/auth/login-modal.tsx`, `components/check-in/check-in-sheet.tsx`, `components/lobby/create-lobby-sheet.tsx`, `components/profile/edit-profile-sheet.tsx`, `components/report/report-sheet.tsx`, `app/styleguide/styleguide-client.tsx`.
- Documentazione: `docs/design/components/bottom-sheet.md` → `components/drawer.md`, `docs/design/components/README.md`, `docs/design/COMPONENTS.md`, `docs/design/patterns/sheets.md`, `docs/design/README.md` (indice).

**API del wrapper (compatibile con l'uso attuale).**

```tsx
<Drawer open={open} onClose={() => setOpen(false)} title="Crea lobby">
  …
</Drawer>
```

- Props: `open`, `onClose`, `title?`, `description?`, `children`, `className?`.
- Base UI: `Drawer.Root` con `open`, `onOpenChange`, `modal`, `swipeDirection="down"`; `Drawer.Portal` → `Drawer.Backdrop` (classe `bg-[var(--overlay)]`) → `Drawer.Viewport` (`fixed inset-0 z-50 flex items-end justify-center`) → `Drawer.Popup` (`w-full max-w-[720px] rounded-t-sheet bg-[var(--bg-elevated)] shadow-lg outline-none pb-safe`).
- Titolo con `Drawer.Title` (Syne, `text-xl`), descrizione con `Drawer.Description` se serve.
- Handle visivo 44px dentro il Popup; se il drag sul popup non parte, avvolgere l'handle in `Drawer.SwipeArea`.
- Nessuna animazione custom: usa le transizioni di Base UI; il rispetto di `prefers-reduced-motion` è già globale in `globals.css`.
- `className` viene unito al Popup con `cn()`, come oggi.

**Regole.**

- Non cambiare la struttura dei contenuti nei call site: solo import e nome del componente. Le modifiche di contenuto arrivano con i ticket di schermata (`d17`–`d24`).
- Non tenere `BottomSheet` come alias: si migra e si cancella nello stesso ticket.
- Non aggiungere una seconda libreria headless.
- Lo z-index resta 50; il backdrop usa `--overlay`, non `bg-black/30`.

**Acceptance.**

- `grep -rn "ui/bottom-sheet" app components` non restituisce nulla e il file non esiste più.
- `grep -rn "BottomSheet" app components` non restituisce nulla, tranne eventuali testi storici in `docs/`.
- Drawer: focus trap, `Escape`, tap sul backdrop, drag oltre soglia, blocco scroll del body, restore focus al trigger.
- Il contenuto resta sopra la safe-area su iPhone (verifica visiva con DevTools + `d4` già fatto).
- Con reduced motion non c'è trascinamento animato.
- `app/styleguide` sezione Componenti mostra il Drawer (non più BottomSheet) e la sezione Librerie resta coerente.
- `npm run lint`, `npx tsc --noEmit`, `npm run lint:design`, `npm run test:a11y` verdi.
- Docs aggiornate; nessun link rotto a `bottom-sheet.md`.

**Comandi di verifica.**

```bash
grep -rn "ui/bottom-sheet" app components
grep -rn "BottomSheet" app components
npm run lint && npx tsc --noEmit && npm run lint:design
npm run test:a11y
# manuale: /styleguide → Drawer; /courts/<id> → check-in, crea lobby, report; /profile → modifica
```

**Riferimenti.** `docs/design/stack.md` (regole d'uso), `app/styleguide/library-showcase.tsx` (esempio Drawer già funzionante), `docs/design/1.5.md` (F1).

## Resolution

(TBD — chiudere con: call site migrati, esito focus/ESC/drag/scroll, screenshot 360px, docs aggiornate.)
