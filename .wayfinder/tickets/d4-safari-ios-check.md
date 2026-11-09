---
id: d4
type: verify
hitl: true
claimed: false
blocked_by: []
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

(TBD — device, iOS, Safari, esito 1–5, decisione su d5/d6, allegati.)
