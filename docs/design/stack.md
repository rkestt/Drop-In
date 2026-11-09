# Stack UI

Librerie ammesse per l'interfaccia. Il design system resta la fonte di verità per
colori, tipografia, spazi e motion: una libreria può cambiare *come* si costruisce
un controllo, non *come appare*.

**Installate come candidate nel branch `design-architecture`.** La scelta finale si fa
provandole nella styleguide (`/styleguide`, sezione 09 Librerie). Fino alla scelta,
i componenti scritti a mano in `components/ui/` restano quelli usati dall'app.

## Pacchetti

| Pacchetto | Ruolo | Licenza | Stato |
|---|---|---|---|
| `@base-ui/react` | Headless per dialog, drawer, popover, menu, select, tabs, accordion, tooltip | MIT | adottato (verifica iPhone reale pendente) |
| `sonner` | Toast: 9 kB, zero dipendenze | MIT | adottato (verifica iPhone reale pendente) |
| `react-hook-form` | Form non controllati | MIT | installato, da valutare |
| `zod` | Validazione e schema condiviso client/server | MIT | installato, da valutare |
| `@hookform/resolvers` | Ponte zod ↔ react-hook-form | MIT | installato, da valutare |
| `motion` | Animazioni dove CSS non basta: drag del sheet, exit, layout | MIT | installato, da valutare |
| `@tanstack/react-virtual` | Liste lunghe | MIT | opzionale |
| `cmdk` | Command palette | MIT | opzionale |
| `lucide-react` | Icone | ISC | già presente |
| `clsx` | Composizione di `className` | MIT | già presente |
| `tailwind-merge` | Merge delle classi Tailwind in `cn()` | MIT | già presente |

La styleguide (`/styleguide`, sezione 09 Librerie) mostra un esempio reale e
interattivo di ogni componente candidato: dialog, drawer, popover, menu, select,
combobox, tabs, accordion, tooltip, switch, slider, toast, motion e form.

## Perché queste
- **`@base-ui/react`** è headless: comportamento e accessibilità (focus trap, ESC,
  scroll lock, `aria-*`) senza stile imposto. È la scelta di default nel 2026 e
  sostituisce l'uso diretto di Radix. Copre già drawer e tooltip, i due controlli
  che prima gestivamo a mano dentro `BottomSheet` (ora `components/ui/drawer.tsx`).
- **`sonner`** è l'unico toast che non porta dietro un design system: 9 kB, zero
  dipendenze, code con swipe su mobile. Un solo punto per gli esiti non bloccanti;
  l'errore di campo resta inline.
- **`react-hook-form`** evita un re-render per tasto sui form lunghi (submit-court
  ha cinque campi e una foto). Non controllato = il DOM resta la fonte del valore.
- **`zod`** fa vivere la stessa regola nel client e nella Server Action: la
  validazione non è più scritta due volte e non può divergere.
- **`motion`** (ex Framer Motion) serve solo dove il CSS non arriva: drag dello
  sheet con velocity, exit animation prima dell'unmount, `layout` quando un
  elemento cambia posizione. Non è il default: la maggior parte delle transizioni
  resta CSS con i token `--motion-*` e `--ease-*`.
- **`@tanstack/react-virtual`** e **`cmdk`** entrano solo se nasce il caso d'uso
  (lista oltre ~50 righe, command palette). Non si installano "per dopo".

## Da evitare

| Scelta | Motivo |
|---|---|
| Vaul | Non serve: Base UI `Drawer` copre il ruolo (d5). |
| Tremor | Fermo al 2025, trascina il suo stile sui grafici. |
| Park UI | Fermo al 2024. |
| Heroicons | Fermo al 2024; le icone sono già lucide. |
| MUI, antd, Chakra, Mantine | Sono un secondo design system: portano token, temi e reset propri. |
| Recharts | ~146 kB per grafici che qui non servono. |
| `@dnd-kit/react` | Versione 0.x: API non stabile. |
| Radix + Base UI insieme | Due primitive per lo stesso ruolo, due gestori di focus. |

## Regole d'uso

- **Una primitiva per ruolo.** Dialog, drawer, popover, menu, tooltip vengono da
  Base UI e basta: niente secondo pacchetto headless.
- **Lo stile resta nostro.** I componenti Base UI si avvolgono in
  `components/ui/`, con i token di `globals.css`. Nessun `className` con colori
  fuori dai token.
- **Il toast non sostituisce l'errore.** Successo e azioni non bloccanti → toast.
  Errore di campo → inline, accanto al campo.
- **Il motion delle pipeline guidate è funzionale.** Vale [patterns/onboarding.md](patterns/onboarding.md):
  dice dove sei, qual è il prossimo controllo, com'è andata.

## Test di ingresso (prima di installare)

Base UI e Sonner si provano su **Safari iOS**, non su desktop:

1. Drawer aperto da un bottone: focus trap, ESC, tap sul backdrop, chiusura con
   drag oltre la soglia, nessuno scroll della pagina sotto.
2. Drawer con tastiera aperta: il campo attivo resta visibile sopra la tastiera.
3. Toast con safe-area: compare sopra la bottom nav, non sotto la notch, e lo
   swipe lo chiude senza lasciare il contenitore a schermo.
4. `prefers-reduced-motion: reduce` attivo: nessun trascinamento animato, nessun
   pop; tutto resta leggibile e usabile.
5. Nessun errore in console, nessun salto di layout all'apertura.

Se il test passa, si installa il pacchetto e si migra un componente per volta.
Se non passa, si documenta qui il motivo e si resta sul componente scritto a mano.

### Esito d4 (2026-11-09) — device fisico non disponibile

Non c'è un iPhone: il test HITL su device **non è stato eseguito**. Al suo posto,
evidenza equivalente per motore con Playwright **WebKit 27.2** (immagine ufficiale
`mcr.microsoft.com/playwright:v1.65.0-noble`) e profilo `iPhone 13`
(390×664, `isMobile`, `hasTouch`, UA Safari iOS), confrontata con Chromium.
Script e screenshot: `/tmp/opencode/d4-webkit/` (fuori repo).

| Punto | WebKit | Chromium |
|---|---|---|
| 1. apertura, focus iniziale nel dialog, ESC, tap sul backdrop, drag oltre soglia | PASS | PASS |
| 1b. **focus trap che cicla dentro** | **FAIL** (Tab esce su `body`/nav dopo 2 tab) | **FAIL** (identico) |
| 2. drawer con tastiera | N/A (il demo non ha campi di testo); nessun salto di `visualViewport` (0 px) | N/A |
| 3. toast: 16 px dal bordo superiore, swipe verso l'alto chiude, nodo rimosso | PASS | PASS |
| 4. `prefers-reduced-motion: reduce`: transizioni ~0 s, testo leggibile | PASS | PASS |
| 5. console: 0 errori, 0 `pageerror` | PASS | PASS |

Il focus trap non è un difetto di WebKit: il demo della styleguide apre
`Drawer.Root` senza gestione del focus che cicla, e si comporta uguale nei due
motori. **Requisito per `d5`**: il Drawer migrato deve ciclare il focus dentro il
dialog (verifica con Tab in avanti e indietro) e il demo deve avere un campo di
testo per coprire il punto 2.

Decisione: Drawer e Sonner si adottano (nessun blocco funzionale osservato, nessuna
differenza tra motori), con due riserve scritte: (a) il test su iPhone reale va
fatto prima della release, non prima di `d5`; (b) il punto 1b va chiuso in `d5` (chiuso: `tests/e2e/drawer.spec.ts` verifica il ciclo del focus).

## Collegamenti

- [Token](tokens.md) — colori, tipografia, radius, motion token
- [Pattern: onboarding](patterns/onboarding.md) — il motion come guida
- [Decisioni](decisions/) — ADR
