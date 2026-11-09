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

Call site migrati (6/6, solo import + nome componente, contenuti invariati):
`components/auth/login-modal.tsx`, `components/check-in/check-in-sheet.tsx`,
`components/lobby/create-lobby-sheet.tsx`, `components/profile/edit-profile-sheet.tsx`,
`components/report/report-sheet.tsx`, `app/styleguide/styleguide-client.tsx`.
`components/ui/bottom-sheet.tsx` eliminato; nuovo wrapper `components/ui/drawer.tsx`
(`Drawer.Root` controllato con `open`/`onOpenChange`, `modal`, `swipeDirection="down"`,
stesse classi/z-index del vecchio sheet, handle 44px visivo `aria-hidden`).

Esito verifiche (Playwright Chromium, dev su :3100, `tests/e2e/drawer.spec.ts` 5/5 PASS):
- Focus trap che cicla: Tab da Conferma torna all'input, 3 Shift+Tab percorrono
  Annulla → input → Conferma; focus mai uscito dal dialog in 9+ pressioni.
- Focus iniziale dentro al dialog all'apertura.
- Restore focus al trigger ("Apri drawer") sia con Escape che con tap sul backdrop.
- `body.style.overflow = "hidden"` da aperto, ripristinato (`""`) da chiuso.
- Drag oltre soglia chiude: swipe touch sintetico (CDP, 450px dalla handle);
  mid-drag lo spec asserisce che il popup segue il dito
  (`getComputedStyle(dialog).transform !== "none"`) e al rilascio il drawer si chiude.
- Nessuna prop extra servita: `modal` di default + `initialFocus`/`finalFocus` di
  default di Base UI bastano; nessun codice di trap/scroll/restore scritto a mano.

Styleguide: sezione Componenti mostra "Drawer" (con campo di testo `#sg-drawer-nome`
nel demo) e sezione Librerie con campo `lib-drawer-nome` nel `DrawerExample`.

Docs: `components/bottom-sheet.md` → `components/drawer.md` (riscritta su Base UI),
aggiornati `components/README.md`, `patterns/sheets.md`, link in `patterns/onboarding.md`.
NON toccati: `stack.md`, `COMPONENTS.md`, `README.md`, `MAP.md`, `1.5.md`.

Comandi: `grep ui/bottom-sheet` e `grep BottomSheet` su app/components vuoti;
`lint` 0 errori (1 warning pre-esistente in scripts/check-design.mjs),
`tsc --noEmit` OK, `lint:design` OK (62 file), `vitest` 68/68, `test:a11y` 3/3,
`drawer.spec.ts` 6/6.

Follow-up review @oracle (APPROVE WITH NITS):
- N1 (drift Resolution/spec): aggiunto allo spec l'assert mid-drag
  (`getComputedStyle(dialog).transform !== "none"` prima del touchEnd) e
  ammorbidita la frase in Resolution (niente più valore px hardcoded).
- N3 (reduced motion): nuovo test `emulateMedia({ reducedMotion: "reduce" })`
  — transition/animation sul popup ≤ 20ms (globals.css forza 0.01ms), dialog e
  campo `#sg-drawer-nome` visibili. Senza dipendenze dal drag CDP.
- N5: `drawer.md` → sezione "Anatomia" mostra l'API pubblica `<Drawer>`; gli
  internals Base UI solo citati con rimando al sorgente.
- N4: nota in `drawer.md` su `outline-none` (caso drawer senza focusabili,
  focus visibile garantito dai controlli interni, nessun hack).
