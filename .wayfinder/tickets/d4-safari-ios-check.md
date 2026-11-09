---
id: d4
type: verify
hitl: true
claimed: true
blocked_by: []
status: closed
closed_at: 2026-11-09
---
## Question

**Obiettivo.** Verificare su iPhone reale che `Drawer` (Base UI) e Sonner siano usabili prima di adottarli. È un test di ingresso, non un'implementazione: nessun codice di prodotto cambia, solo documentazione.

**Serve un device.** HITL: la verifica la esegue Andrea su iPhone con Safari, con il dev server raggiungibile dalla LAN. Se non c'è un device disponibile, il ticket resta aperto e `d5`/`d6` non partono.

**File coinvolti.** `docs/design/stack.md` (esito e decisione) e la Resolution di questo ticket (device, versioni, allegati). Nessun file in `app/` o `components/`.

**Setup.**

```bash
npm run dev:https          # Next in HTTPS, raggiungibile dalla LAN
# sull'iPhone: https://<IP-del-Mac>:3000/styleguide
# sezione 09 "Librerie": Drawer e Toast
```

**Checklist (da `docs/design/stack.md`, "Test di ingresso").**

1. **Drawer da bottone:** focus trap, `Escape`, tap sul backdrop, chiusura con drag oltre la soglia, nessuno scroll della pagina sotto.
2. **Drawer con tastiera aperta:** il campo attivo resta visibile sopra la tastiera (Base UI `Drawer.VirtualKeyboardProvider`); il drawer non salta.
3. **Toast con safe-area:** compare sopra la bottom nav, non sotto la notch; lo swipe lo chiude senza lasciare il contenitore a schermo.
4. **`prefers-reduced-motion: reduce`** (Impostazioni → Accessibilità → Movimento): nessun trascinamento animato, nessun pop; tutto resta leggibile e usabile.
5. **Console:** nessun errore, nessun salto di layout all'apertura.

**Cosa registrare.**

- Modello iPhone, versione iOS, versione Safari.
- Esito punto per punto: PASS / FAIL + cosa succede.
- Screenshot o video brevi per ogni FAIL.
- Se un punto fallisce: la motivazione va scritta in `docs/design/stack.md` e `d5`/`d6` restano bloccati; si resta su `BottomSheet` e sul toast attuale.

**Acceptance.**

- Tutti e 5 i punti hanno un esito esplicito.
- `docs/design/stack.md` passa da "installato, da valutare" a "adottato" oppure documenta il motivo del rifiuto.
- La Resolution contiene device, versioni, esiti e link agli allegati.
- Nessun file in `app/` o `components/` modificato da questo ticket.

**Comandi di verifica.**

```bash
npm run dev:https
# sull'iPhone: aprire https://<IP>:3000/styleguide
# ripetere i 5 punti con e senza reduced motion
```

**Riferimenti.** `docs/design/stack.md` (Test di ingresso), `docs/design/1.5.md` (F0).

## Resolution

**Device fisico: non disponibile.** Andrea non ha un iPhone e non può eseguire la
checklist HITL: il ticket si chiude come "verificato per motore, device reale
pendente", non come test su iPhone.

**Evidenza raccolta.** Playwright **WebKit 27.2** nell'immagine ufficiale
`mcr.microsoft.com/playwright:v1.65.0-noble` (l'host Arch non ha le dipendenze di
sistema per WebKit) con profilo `iPhone 13` — 390×664, `isMobile`, `hasTouch`, UA
Safari iOS — confrontato con Chromium sullo stesso profilo. Script, screenshot e
`results.json` in `/tmp/opencode/d4-webkit/`.

**Esiti per punto.**

1. **Drawer da bottone — PASS (entrambi i motori).** Apre, il focus iniziale è nel
   `[role="dialog"]`, `Escape` chiude, tap sul backdrop chiude (punto scelto fuori
   dal dialog), drag verso il basso oltre soglia chiude, `body` va in
   `overflow: hidden` e `window.scrollY` resta fermo.
   **1b focus trap — FAIL in entrambi i motori**: dopo due Tab il focus esce dal
   dialog (`span`/`body`/nav). Non è una differenza WebKit: il demo della
   styleguide non fa ciclare il focus. Diventa requisito di `d5`.
2. **Drawer con tastiera — N/A**: il demo della styleguide non contiene campi di
   testo. Nessun salto di `visualViewport` (664 → 664, 0 px). `d5` deve aggiungere
   un input al demo per coprire il punto.
3. **Toast — PASS.** Compare a 16 px dal bordo superiore (configurazione
   `top-center` della styleguide: il test su bottom-nav/safe-area va rifatto con
   il Toaster definitivo), lo swipe verso l'alto lo chiude e il nodo è rimosso dal
   DOM (1 → 0) in WebKit e Chromium.
4. **Reduced motion — PASS.** `transition-duration`≈0,00001 s e
   `animation-duration`≈0 s su drawer e toast, contenuto leggibile.
5. **Console — PASS.** 0 voci `console`, 0 `pageerror` in entrambi i motori.

**Decisione.** Drawer (Base UI) e Sonner si adottano: nessun blocco funzionale e
nessuna differenza tra i motori. Riserve scritte in `docs/design/stack.md`:
(a) verifica su iPhone reale prima della release, non prima di `d5`; (b) focus
trap da chiudere in `d5`; (c) il punto 3 va ripetuto con il Toaster definitivo
(safe-area e bottom nav reali).

**Allegati.** `/tmp/opencode/d4-webkit/`: `drawer-open.png`, `diag-drawer-open.png`,
`diag-backdrop.png`, `toast-open.png`, `toast-webkit-after-swipe-up.png`,
`reduced-motion.png`, `results.json`, `diag.mjs`, `toast.mjs`, `run-webkit.mjs`.

**Nessun file in `app/` o `components/` modificato.**
