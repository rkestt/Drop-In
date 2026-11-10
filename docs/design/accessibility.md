# Accessibilità

## Obiettivo

WCAG 2.2 livello AA per contrasto, focus, touch target e riduzione del movimento.

## Contrasto

Rapporti misurati con la formula WCAG 2.x (sRGB, luminanza relativa) sui token del tema dark. Fonte: `tokens.md`, sezione "Contrasti misurati".

| Testo | Sfondo | Rapporto | Requisito |
|---|---|---|---|
| `--text-primary` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 16,17 / 14,46 / 12,42:1 | ≥ 4.5:1 (testo normale) |
| `--text-secondary` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 7,75 / 6,93 / 5,95:1 | ≥ 4.5:1 (testo normale) |
| `--text-muted` | `--bg-base`, `--bg-surface`, `--bg-elevated` | 6,07 / 5,43 / 4,67:1 | passa AA per testo normale |
| `--accent-foreground` | `--accent` | 6,37:1 | passa AA per testo normale |
| `--danger-foreground` | `--danger` | 6,04:1 | passa AA per testo normale |
| `--danger-dark` | `--danger`/10 su elevated | 7,35:1 | passa AA (testo errore su sfondo tinta; `--danger` lì stava a 4,09:1) |
| `--danger` | `--bg-elevated` (testo piano) | 4,64:1 | passa AA, margine sottile: sulle tinte usare `--danger-dark` |
| `--danger-dark` | `--danger`/20 su elevated | 6,41:1 | passa AA per testo normale |

Regole:

- Testo normale (<18px o <14px bold): contrasto minimo 4.5:1.
- Testo grande (≥18px o ≥14px bold): contrasto minimo 3:1.
- `--text-muted` passa AA come testo normale (4,67:1 nel caso peggiore, su `--bg-elevated`): è ammesso per placeholder, metadati e icone. (Il placeholder di `components/ui/input.tsx` sta a 5,43:1 su `--bg-surface`.)
- Testo errore su sfondo tinta danger (`bg-danger/10` o `/15`): usare `--danger-dark` (7,35:1), mai `--danger` (4,09:1, sotto AA). Su sfondo piano `--danger` passa (4,64:1) ma con margine sottile. Precedente: `badge.tsx` usa già `--danger-dark` su `--danger`/20.

## Focus visibile

- Anello: `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2`.
- Applicato a button, input, link interattivi, select.
- Non rimuovere mai `outline` senza sostituirlo con un anello visibile.

## Touch target

- WCAG 2.2 (SC 2.5.8) richiede minimo **24x24 CSS px** per ogni target. Il progetto adotta **44px** come scelta più severa: resta il minimo vincolante.
- Minimo 44x44px per ogni elemento tappabile.
- Controlli mappa (zoom MapLibre): 44x44px, override in `globals.css` sul default 29px del pacchetto.
- Attribuzione mappa: superficie `--bg-elevated`, testo `--text-secondary` (5,95:1), link inclusi.
- Bottom nav link: 48px di altezza.
- FAB: 56px.
- Handle sheet: 44px.
- Marker campo su mappa: 44x44px (`w-11 h-11` in `court-map.tsx`), come ogni altro controllo. Quando due campi condividono le stesse coordinate i marker si sovrappongono e axe `target-size` li segnala: è geometria dei dati seed, non del codice — vedi "Eccezioni" sotto.

## Navigazione tastiera

- Skip link "Vai al contenuto" (`components/a11y/skip-link.tsx`), primo nell'ordine di Tab su tutte le pagine con nav (gruppi `(app)` e `(dashboard)`), punta al `main#contenuto` e ci sposta il focus (`tabIndex={-1}`).
- Marker mappa: `role="button"`, `tabindex="0"`, nome `Campo: <nome>[, <indirizzo>]`, attivazione con Invio/Spazio, anello focus del progetto.
- Drawer (login, primo avvio, sheet): focus trap di Base UI; chiusura con Escape; a chiusura il focus torna al trigger.
- Nessun `tabindex` positivo nel codice (`grep -rn 'tabindex="[1-9]'` pulito); `outline: none` solo con anello `focus-visible` sostitutivo.

Percorsi verificati da tastiera (test in `tests/e2e/a11y.spec.ts`):

- Mappa → ricerca → campo: Tab dallo skip link, ricerca nominata, marker attivabile, check-in annunciato via `aria-live`.
- Lista lobby → dettaglio → join: link con nome accessibile, join con esito `role="alert"`.
- Profilo → modifica; impostazioni → logout: form con label, errori `aria-invalid` + `aria-describedby`, focus sul primo errore.
- Login: compila i campi con Tab/digitazione, invia con Invio; errore annunciato con `role="alert"` + `aria-live="assertive"`.

## Riduzione del movimento

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Già presente in `globals.css`. Verificare che ogni nuova animazione rispetti questa media query.

## Aria e struttura

- `html lang="it"` già impostato.
- `aria-label` su FAB e icone actionable.
- `aria-hidden="true"` sulle icone decorative.
- `aria-live="polite"` per annunci dinamici (campi visibili, lobby disponibili).
- Bottom sheet: `role="dialog"`, `aria-modal="true"`, trappola focus.
- Form: label associate agli input (`htmlFor`/`id`).

## Test da fare

1. Navigazione tastiera su tutti gli elementi interattivi.
2. VoiceOver/TalkBack su FAB, bottom sheet, liste.
3. Verifica contrasto con DevTools o APCA.
4. Attivare `prefers-reduced-motion` e verificare che nulla tremi o lampeggi.

## Esiti — sweep del 2026-11-10 (`tests/e2e/a11y.spec.ts`)

Suite axe (tag wcag2a/wcag2aa/wcag21a/wcag21aa/wcag22aa), 15 test verdi:

| Route | Contesto | Esito |
|---|---|---|
| `/styleguide`, `/~offline`, `/submit-court` | CI, senza DB | 0 violazioni |
| `/`, `/?login=required` (drawer) | locale, con DB | 0 violazioni (marker esclusi, vedi sotto) |
| `/profile`, `/settings`, `/notifications`, `/lobbies`, `/lobbies/<id>`, `/courts/<id>` | locale + utente confermato via Admin API (`E2E_WITH_DB=1`) | 0 violazioni (marker esclusi) |
| `/` con `reducedMotion: reduce` | locale | regione mappa e contenuto restano visibili/leggibili |
| Skip link su `/` e `/settings` | tastiera | primo Tab → link visibile → Invio → focus su `#contenuto` |
| Login da tastiera | tastiera | compila + Invio → errore annunciato (`role="alert"`) |

Violate e corrette nello sweep:

- `color-contrast` 4,09:1 — testo `--danger` su `bg-danger/10` (errore login, poi stessa combinazione in submit-court, create-lobby, edit-profile, account-settings, karma-indicator, ban-banner): passato a `--danger-dark` (7,35:1). Nessun cambio d'identità: è la variante "su tinta" già usata dai badge.
- Marker mappa 40px → 44px (`w-10` → `w-11`), minimo di progetto su tutti i controlli.
- Skip link mancante: aggiunto + `id="contenuto" tabIndex={-1}` sui `main` dei gruppi `(app)` e `(dashboard)`.

## Eccezioni

- Marker `.court-marker` esclusi dall'axe su `/` e pagine con mappa (`.exclude(".court-marker")`): i seed condividono le coordinate, i marker si sovrappongono e `target-size` fallisce per geometria dei dati, non del codice. Copertura sostitutiva: ruolo/tabindex/nome/focus asseriti esplicitamente nel test. Rimozione prevista: clustering/spiderfy dei marker vicini (ticket dedicato, tocca il design della mappa).
