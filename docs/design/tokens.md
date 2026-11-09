# Token

Tutti i token vivono in `app/globals.css` come custom property (`--bg-base`, `--text-primary`, …).
**Tema unico dark attivo.** Non esiste un tema chiaro, né un toggle.

Librerie ammesse per l'interfaccia e loro stato: [stack.md](stack.md).

## Convenzione reale nel codice

Il codice usa la forma arbitrary-value di Tailwind, NON le utility generate da `@theme inline`:

```tsx
// SÌ (convenzione reale, quella da usare)
className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
// NO (non usare, anche se `@theme inline` le renderebbe disponibili)
className="bg-bg-surface text-text-primary"
```

Motivo: tutto il codice esistente (`components/`, `app/`) usa `bg-[var(--…)]`. Restare su questa forma mantiene il codebase uniforme e ricercabile con grep.

Eccezione: le opacità si scrivono appendendo `/xx` alla forma reale (`bg-[var(--danger)]/10`, `border-[var(--accent)]/20`).

Eccezione 2: radius, type scale display e label usano le utility generate da `@theme` (`rounded-control`, `text-display`, `text-label`), perché sono scale chiuse e tokenizzate. Vedi sotto.

## Livelli dei token

| Livello | Cosa contiene | Stato nel progetto |
|---|---|---|
| **Primitiva** | Scale grezze non semantiche | Non esistono: i valori vivono direttamente nei semantici |
| **Semantico** | Nomi per ruolo (`--bg-base`, `--text-muted`, `--accent`, `--danger-dark`, `--border`, …) definiti in `:root` | Esistono, sono l'unico livello colore in uso |
| **Componente** | Token per singolo componente (es. `--button-primary-bg`) | Non esistono e non servono: i componenti usano solo i semantici |

Regola: **i componenti usano solo i token semantici**. Se un componente sembra aver bisogno di un colore che non mappa a nessun semantico, è un buco: si apre un ADR o si registra in `gaps.md`, non si crea un token ad hoc nel componente.

## Colori semantici (dark)

| Token | Valore | Uso |
|---|---|---|
| `--bg-base` | `#141414` | Sfondo pagina |
| `--bg-surface` | `#1f1f1f` | Card, input, liste |
| `--bg-elevated` | `#2b2b2b` | Sheet, nav, elementi sopra la surface |
| `--text-primary` | `#f0f0f0` | Titoli, body principale |
| `--text-secondary` | `#a8a8a8` | Sottotitoli, meta |
| `--text-muted` | `#949494` | Testo attenuato, metadati, placeholder. Passa AA su tutti e tre gli sfondi (vedi contrasti) |
| `--accent` | `#24ae56` | CTA primaria, nav active, focus, testo su fondo scuro |
| `--accent-hover` | `#2fc463` | Hover CTA |
| `--accent-subtle` | `rgba(36, 174, 86, 0.16)` | Sfondo badge accent, chip partecipanti |
| `--accent-foreground` | `#141414` | Testo e icone **sopra** `--accent` |
| `--success` | `#2dd4bf` | Stati positivi, check-in (teal) |
| `--success-dark` | `#99f6e4` | Testo su sfondo success |
| `--danger` | `#ff5a5f` | Errori, azioni distruttive |
| `--danger-dark` | `#ffb3b5` | Testo su sfondo danger |
| `--danger-foreground` | `#141414` | Testo e icone **sopra** `--danger` |
| `--warning` | `#ffb020` | Avvisi |
| `--warning-dark` | `#ffd98a` | Testo warning |
| `--cool-muted` | `#6e7681` | Bordi sottili, scrollbar, elementi freddi |
| `--border` | `#333333` | Bordi neutri di card e input |
| `--border-strong` | `#4a4a4a` | Bordi più visibili, separatori |
| `--overlay` | `rgba(0, 0, 0, 0.6)` | Backdrop di sheet e modal |
| `--focus-ring` | `var(--accent)` | Anello focus: unico punto di modifica |

### Note

- **Mai testo bianco su `--accent` o `--danger`**: usare `--accent-foreground` / `--danger-foreground`. Il bianco su accent sta a 2,89:1, il bianco su danger a 3,05:1: sotto AA.
- `--overlay` è il backdrop dei bottom sheet (`bg-[var(--overlay)]`), non `bg-black/30`.
- `--focus-ring` punta a `--accent`: unico punto di modifica se il focus cambia.
- Il gap del focus ring (`ring-offset`) usa `--bg-base`, non il bianco di default di Tailwind: su fondo scuro un alone bianco sarebbe un errore visivo.
- `--text-muted` passa AA come testo normale su tutti e tre gli sfondi (4,67:1 nel caso peggiore, elevated): si può usare per placeholder, metadati e icone. Resta il gradino più basso della scala: non è il colore del body.

### Contrasti misurati (WCAG 2.x)

Valori calcolati sulla formula ufficiale (sRGB, luminanza relativa), non stimati.

| Coppia | Rapporto | Esito |
|---|---|---|
| `--accent-foreground` su `--accent` | 6,37:1 | AA testo |
| `--accent-foreground` su `--accent-hover` | 8,07:1 | AA testo |
| bianco su `--accent` (vecchio) | 2,89:1 | **no** |
| `--danger-foreground` su `--danger` | 6,04:1 | AA testo |
| bianco su `--danger` (vecchio) | 3,05:1 | no per testo normale |
| `--text-primary` su `--bg-base` / `--bg-surface` / `--bg-elevated` | 16,17 / 14,46 / 12,42:1 | AA |
| `--text-secondary` su base / surface / elevated | 7,75 / 6,93 / 5,95:1 | AA |
| `--text-muted` su base / surface / elevated | 6,07 / 5,43 / 4,67:1 | AA testo |
| `--text-muted` come placeholder su `--bg-surface` (input) | 5,43:1 | AA testo |
| `--accent` come testo su base / surface / elevated | 6,37 / 5,70 / 4,90:1 | AA |
| `--text-primary` su `--accent-subtle` (base / surface / elevated) | 12,87 / 11,38 / 9,81:1 | AA testo |
| `--accent` come testo su `--accent-subtle` (base / surface / elevated) | 5,07 / 4,48 / 3,87:1 | **no** su surface ed elevated: il badge accent usa `--text-primary` |
| `--success-dark` su `--success`/20 + elevated | 7,37:1 | AA |
| `--danger-dark` su `--danger`/20 + elevated | 6,41:1 | AA |
| `--warning-dark` su `--warning`/20 + elevated | 6,77:1 | AA |

## Tipografia

| Elemento | Font | Pesi | Uso |
|---|---|---|---|
| Display | Syne (`--font-syne`) | 400–800 | Titoli, numeri grandi, brand |
| Body | Source Sans 3 (`--font-source-sans`) | 400–700 | Body, label, input, button |

### Scala tokenizzata (in `@theme`, `app/globals.css`)

| Token | Valore | Line-height | Uso |
|---|---|---|---|
| `--text-label` | 11px | 1.2 | Label bottom nav, microcopy |
| `--text-display-sm` | 28px | 1.15 | Titolo di sezione |
| `--text-display` | 32px | 1.1 | Titolo di pagina |
| `--text-display-lg` | 40px | 1.05 | Hero, numeri grandi |

> **Stato:** i display (28/32/40) sono token disponibili ma **non applicati** alle schermate esistenti: i titoli usano ancora `text-xl`/`text-2xl`. Si adottano quando una schermata viene ridisegnata; fino ad allora restano la scala per il lavoro nuovo.

### Scala Tailwind (in uso sotto i display)

| Classe | px | Uso tipico |
|---|---|---|
| `text-xs` | 12 | Badge, meta piccola |
| `text-sm` | 14 | Sottotitoli, orari, contatori |
| `text-base` | 16 | Input, button default, body |
| `text-lg` | 18 | Titoli secondari |
| `text-xl` | 20 | Titoli di card |
| `text-2xl` | 24 | Titoli secondari grandi |

- Line-height: display 1.05–1.15, titoli 1.25, body 1.5.
- Badge: maiuscolo con `tracking-wider`.
- `h1`, `h2`, `h3` hanno `text-wrap: balance`; `p` ha `text-wrap: pretty` (in `globals.css`).

## Spacing

Scala Tailwind default (1 = 4px), raggruppata in tre livelli.

| Livello | Valori | Uso |
|---|---|---|
| Micro | 4, 8px (`gap-1`, `gap-2`) | Icona e testo, spazi interni stretti, distanza tra chip |
| Medio | 12, 16, 20px (`gap-3`, `gap-4`, `p-5`) | Padding di card, liste e sheet, ritmo dei form |
| Macro | 24, 32px (`gap-6`, `gap-8`) | Distanza tra sezioni e blocchi |

## Radius

Valori vincolanti, tokenizzati in `@theme`. Non usare raggi fuori da questa tabella.

| Token | Valore | Utility | Uso |
|---|---|---|---|
| `--radius-control-sm` | 8px | `rounded-control-sm` | Button `sm`, input compatti |
| `--radius-control` | 10px | `rounded-control` | Button default, input, textarea |
| `--radius-card` | 12px | `rounded-card` | Card, button icon, pannelli |
| `--radius-sheet` | 20px | `rounded-t-sheet` | Bottom sheet (solo alto) |
| `--radius-chip` | 9999px | `rounded-chip` | Badge, chip, FAB |

> **Stato:** `rounded-lg` (8px), `rounded-xl` (12px) e `rounded-full` restano nei componenti non ancora migrati: sono equivalenti ai token, quindi la migrazione è cosmetica e rinviata al prossimo tocco di quei file.

## Shadow

Usare i livelli Tailwind esistenti:

| Classe | Uso |
|---|---|
| `shadow-md` | Sport selector, elementi flottanti leggeri |
| `shadow-lg` | FAB, bottom sheet, toast |
| `shadow` | Card in rilievo (raro) |

## Motion

Durate e curve sono token in `app/globals.css`: le durate in `:root`, le curve
in `@theme`. Le animazioni esistenti non le usano ancora e non vengono riscritte:
i token sono la scala per il motion nuovo.

| Token | Valore | Uso |
|---|---|---|
| `--motion-fast` | `150ms` | Press, hover, cambio di colore |
| `--motion-base` | `200ms` | Cambio di stato, comparsa breve |
| `--motion-slow` | `250ms` | Ingresso di uno step, apertura sheet |
| `--motion-success` | `400ms` | Pop di conferma |
| `--ease-standard` | `cubic-bezier(0.25, 1, 0.5, 1)` | Fade, slide, press: la curva normale |
| `--ease-elastic` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Solo pop e scale |

Tailwind v4 ha un namespace `--ease-*`, quindi le curve generano anche le utility
`ease-standard` / `ease-elastic`. Non ha un namespace `--duration-*`: `duration-fast`
non esiste e le durate si passano da `var(--motion-*)` o con `duration-<ms>`.

```css
/* durata e curva: da token, anche dentro una keyframe */
.step-enter { animation: fadeInUp var(--motion-slow) var(--ease-standard) both; }
```

```tsx
// le curve hanno anche l'utility, generata dal namespace --ease-*
<div className="transition-transform duration-200 ease-standard" />
```

Valori in uso oggi, non ancora migrati: `transition-all duration-150` su button e
link, `fadeInUp` 400ms, `scaleIn` 300ms, `successPop` 500ms.

- **Reduced motion**: `prefers-reduced-motion: reduce` forza durata `0.01ms` e
  `iteration-count: 1` su tutto (`globals.css`).

Keyframes disponibili: `fadeInUp`, `scaleIn`, `shimmer`, `successPop`, `checkmarkDraw`, `slideDown`, `slideUp`.

### Motion per onboarding

Il motion delle pipeline guidate non è decorativo: dice **dove sei**, **qual è il prossimo controllo**, **com’è andata**. Fuori da una pipeline resta `--motion-fast`. Pattern completo in [patterns/onboarding.md](patterns/onboarding.md).

| Momento | Durata | Token | Implementazione |
|---|---|---|---|
| Entrata del nuovo step | 250ms | `--motion-slow` | `fadeInUp` sul contenitore dello step |
| Uscita dello step precedente | 200ms | `--motion-base` | fade breve, poi smonta |
| Highlight del prossimo controllo | 200ms | `--motion-base` | ring persistente che sfuma all’interazione |
| Success pop | 350–500ms | `--motion-success` (400ms) | `successPop` / `checkmarkDraw` (classe esistente 500ms) |
| Apertura sheet di pipeline | 300ms | classe `slideUp` esistente | uscita `slideDown`, 250ms |
| Press / hover | 150ms | `--motion-fast` | invariato |

```css
/* sul contenitore dello step: il keyframe esiste già in globals.css,
   la durata è quella vincolante. Entra il nuovo, il resto è fermo. */
.step-enter {
  animation: fadeInUp var(--motion-slow) var(--ease-standard) both;
}
```

Regole:

- **Una sola animazione per cambio di stato.** Lo step entra e basta: niente stagger sui campi a ogni passo.
- Lo `stagger-1`…`stagger-8` si usa solo al primo render di una schermata, mai a ogni cambio step: rallenta chi ha fretta.
- La transizione **non blocca l’input**: se l’utente tappa di nuovo, vince l’azione e l’animazione si interrompe.
- Niente loop e niente pulse infinito. Un’animazione che continua dopo che l’utente ha capito è rumore.
- **Highlight del prossimo controllo**: `ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-base)]`, visibile finché il controllo non riceve tap o focus, in uscita sfuma in 200ms (`--motion-base`). Non è un errore né un successo, quindi non usa `--danger` o `--success`.
- Il successo usa `--success`; l’accent resta riservato alla CTA.

**`prefers-reduced-motion`**

- `globals.css` forza già durata `0.01ms` e `iteration-count: 1` su tutto.
- Con reduced motion: cambio step istantaneo, nessun success pop, nessuno slide. L’informazione resta perché è anche in testo, stato e outline: **mai affidare “è andata” al solo movimento**.
- Verifica: attivare reduced motion e percorrere la pipeline; niente deve tremare, lampeggiare o sparire.

I token di motion sono stati decisi in [decisions/0003-motion-token.md](decisions/0003-motion-token.md); le librerie ammesse sono in [stack.md](stack.md).

## z-index

| Livello | Valore | Uso |
|---|---|---|
| Mappa UI sovrapposta | `z-20` | Sport selector, banner “nessun campo” |
| FAB | `z-30` | Pulsante “Aggiungi campo” |
| Sheet / Modal | `z-50` | Bottom sheet, dialog, modal |

## Touch target

- Minimo **44px** in altezza e larghezza per ogni elemento tappabile.
- Bottom nav link: 48px di altezza.
- Button `sm`: `min-h-[44px]`.
- Handle del bottom sheet: `min-h-[44px]`.
- Select sport: `min-h-[44px]`.
- Controlli MapLibre (zoom): 44x44px, override in `globals.css` (default pacchetto 29px).
