## ADDED Requirements

### Requirement: Design System e Direzione Visiva
Il sistema DEVE adottare una direzione visiva coesa, memorabile e adatta al contesto urbano/sportivo, evitando estetiche generiche da "AI slop".

#### Scenario: Coerenza visiva cross-screen
- **WHEN** l'utente naviga tra mappa, lobby, profilo e check-in
- **THEN** ogni schermata rispetta le stesse regole di colore, tipografia, spaziatura e componentistica

#### Scenario: Riconoscibilità del brand
- **WHEN** un utente vede uno screenshot dell'app
- **THEN** riconosce immediatamente Drop-In per il suo stile distintivo (non confondibile con un'altra PWA generica)

#### Scenario: Leggibilità outdoor
- **WHEN** l'utente usa l'app all'aperto in pieno giorno
- **THEN** contrasti, dimensioni testo e touch target garantiscono leggibilità e usabilità

---

## Design Direction: "Concrete & Courts"

**Filosofia**: L'app deve sentirsi come il campo stesso — superficie grezza, linee nette, segni decisi. Un'atmosfera urbana e autentica, non corporate né infantile.

**Riferimenti stilistici**: Kenya Hara (minimalismo ordinato) + energia street-athletic. Nessuna grafica troppo "pulita da palestra", nè troppo "graffiti da periferia". Il giusto punto di equilibrio tra affidabilità e spontaneità.

**Temperatura visiva**: Calda ma decisa. I neutri tendono al caldo (calcestruzzo al sole), l'accento è unico e vibrante.

**Differenziazione chiave**: Un dettaglio firma — tipografia display geometrica-leggermente-irregolare (Syne) che contrasta con il contesto sportivo, creando un'identità editoriale-urbana inaspettata.

---

## Color System (OKLCH)

**Strategia colore**: Committed — un colore accent saturato porta il 30-50% della superficie su CTA e stati chiave. Il resto è costruito su neutri tinteggiati.

| Token | OKLCH | Uso |
|---|---|---|
| `--bg-base` | oklch(97% 0.005 80) | Sfondo pagina principale |
| `--bg-surface` | oklch(93% 0.01 80) | Card, bottom sheet, modali |
| `--bg-elevated` | oklch(100% 0.005 80) | Elementi in primo piano sopra surface |
| `--text-primary` | oklch(25% 0.02 80) | Titoli, body principale. MAI #000 puro |
| `--text-secondary` | oklch(50% 0.02 80) | Sottotitoli, metadati |
| `--text-muted` | oklch(65% 0.015 80) | Placeholder, timestamp |
| `--accent` | oklch(60% 0.18 45) | CTA primari, stati attivi, marker mappa. Arancio-ruggine da campo in terra/basket |
| `--accent-hover` | oklch(55% 0.2 45) | Hover su accent |
| `--accent-subtle` | oklch(92% 0.05 45) | Sfondo badge, indicatori karma alto |
| `--success` | oklch(65% 0.14 145) | Check-in riuscito, conferme |
| `--danger` | oklch(55% 0.16 25) | Errore, karma basso, ban |
| `--warning` | oklch(75% 0.12 85) | Avviso GPS, lobby quasi piena |
| `--cool-muted` | oklch(60% 0.02 260) | Elementi secondari che vogliono contrasto caldo |

**Regole colore**:
- Nessun gradiente come sfondo principale (anti-slop)
- Nessun testo con gradiente (`background-clip: text` vietato)
- Neutri sempre tinteggiati verso hue 80 (caldo), mai grigi puri
- Accent unico dominante. Verde successo e rosso danger usati solo per stati semantici, mai come elementi decorativi

---

## Typography

**Font Display**: Syne (Google Fonts) — geometrico con leggere irregolarità, urbano e artistico. Usato per titoli pagina, numeri grandi (karma, contatori), label sezioni.

**Font Body**: Source Sans 3 (Google Fonts) — leggibile, rifinito, più carattere di Inter. Usato per body, descrizioni, form.

**Fallback stack**: `font-family: 'Syne', system-ui, sans-serif` per display; `'Source Sans 3', system-ui, sans-serif` per body.

**Scala tipografica** (ratio 1.25 — Major Third):

| Token | Dimensione | Peso | Uso |
|---|---|---|---|
| `text-hero` | 40px | 700 | Titolo schermata (es. "Partite vicine") |
| `text-h1` | 32px | 700 | Titolo sezione |
| `text-h2` | 25px | 600 | Sottotitolo, nome campo |
| `text-h3` | 20px | 600 | Card title, nickname utente |
| `text-body` | 16px | 400 | Body, descrizioni |
| `text-small` | 14px | 400 | Metadati, timestamp |
| `text-xs` | 12px | 500 | Badge, label uppercase |
| `text-counter` | 48px | 700 | Numeri karma, contatore giocatori (Syne) |

**Regole tipografia**:
- Lunghezza riga max 65ch per body text
- Hierachia tramite scala + peso, mai solo colore
- Label uppercase (`text-xs`, `letter-spacing: 0.05em`, `font-weight: 500`) per categorie e stati
- Numeri sempre in tabular-nums per allineamento contatori

---

## Layout & Spacing

**Unità base**: 4px

**Scala spaziatura**: 4, 8, 12, 16, 24, 32, 48, 64, 96

**Principi layout**:
- Mobile-first, PWA su schermi 375px–428px
- Max-width contenuto: 100% su mobile, 720px su tablet
- Variazione ritmo: non tutte le sezioni hanno lo stesso padding. Hero/map → 0 padding (full-bleed). Sezioni lista → 16px laterale. Form → 24px laterale.
- No container superflui: se un elemento non ha bisogno di wrapper, non avvolgerlo
- Full-bleed per mappa e hero image; contenuto strutturato per liste e form

**Touch target**: Minimo 44×44px per tutti gli elementi tappabili. Preferibilmente 48×48px per CTA principali.

**Safe area**: Rispetto per notch e home indicator su iOS/Android (env(safe-area-inset-*))

---

## Component Patterns

### Button
- **Primary**: Sfondo `--accent`, testo bianco, border-radius 10px, padding 14px 24px, font-weight 600. Hover: `--accent-hover`, transizione 150ms ease-out-quart.
- **Secondary**: Sfondo `--bg-surface`, testo `--text-primary`, border 1px solid `--cool-muted`, border-radius 10px.
- **Ghost**: Trasparente, testo `--accent`, padding 12px. Per azioni secondarie su sfondo scuro (es. mappa).
- **Icon button**: 48×48px, border-radius 12px, centrato. Usato per azioni in navbar.

### Input / Form
- **Text input**: Sfondo `--bg-surface`, border-radius 10px, padding 14px 16px, border 1px solid trasparente. Focus: border `--accent`. No ombra.
- **Select/Dropdown**: Stile coerente con input, ma con freccia custom (SVG, non emoji).
- **Search**: Input con icona lente (SVG) a sinistra, padding-left aumentato.

### Card (usare con parsimonia)
- **Court card**: Sfondo `--bg-surface`, border-radius 12px, padding 16px. NO border-left accent colorato (vietato per impeccable). Separazione tramite spacing generoso o sottile linea divisoria `1px solid oklch(90% 0.01 80)`.
- **Lobby card**: Layout row orizzontale (avatar/nome a sinistra, stato a destra). Full-width con padding, non card flottante con ombra.

### Badge / Tag
- **Status badge**: Pillola con padding 4px 10px, `text-xs`, border-radius 999px. Colori: aperta=`--accent-subtle` testo `--accent`; chiusa=`bg-surface` testo `text-muted`.
- **Karma badge**: Cerchio con punteggio. Alto (>80): `--accent`; Medio (50-80): `--warning`; Basso (<50): `--danger`.

### Bottom Sheet
- Preferito rispetto a modali su mobile. Scorrevole dal basso, sfondo `--bg-elevated`, border-radius top 20px, ombra sottile.
- Usato per: dettaglio campo, creazione lobby, segnalazione stato campo.

### Map Marker
- Custom SVG: cerchio con icona sport (canestro/palla) al centro. Non il pin classico di Google Maps.
- Stati: default=`--accent`, selezionato=più grande con anello, con segnalazione=`--danger`.

---

## Motion & Animation

**Principi motion**:
- Non animare proprietà di layout (width, height, top, left). Usare transform e opacity.
- Easing: ease-out-quart (`cubic-bezier(0.25, 1, 0.5, 1)`) per entrate. Expo out per transizioni page.
- NO bounce, NO elastic, NO animazioni che durano più di 400ms per micro-interazioni.

**Pattern animazione**:
- **Page transition**: Fade-in + translateY(16px → 0), durata 250ms, ease-out-quart.
- **List item entrance**: Stagger 50ms per item, translateY(12px → 0) + opacity, durata 200ms.
- **Check-in success**: Pulse sottile sul marker (scale 1 → 1.15 → 1, 300ms) + checkmark draw-in.
- **Button press**: Scale 0.97 on active, 100ms.
- **Bottom sheet**: TranslateY(100% → 0), 300ms, ease-out-quart.
- **Skeleton loading**: Shimmer orizzontale su blocchi grigi `oklch(90% 0.01 80)`, durata 1.5s, infinito.

**Reduced motion**:
- `@media (prefers-reduced-motion: reduce)`: tutte le animazioni diventano instant (durata 0ms) o opacity-only.

---

## Responsive

**Breakpoint**:
- Mobile: < 640px (default)
- Tablet: 640px–1024px
- Desktop: > 1024px (non prioritario per MVP, ma mappa può andare sidebar)

**Adattamenti tablet**:
- Mappa a schermo intero a sinistra, lista/dettaglio a destra (split view 50/50)
- Bottom sheet diventa sidebar o modal centrato
- Touch target rimangono 48px anche su desktop (mouse + possibile touch)

---

## Accessibility (WCAG 2.1 AA)

- Contrasto testo: minimo 4.5:1 per body, 3:1 per large text (18px+ bold).
- Focus indicator: Outline 2px solid `--accent` con offset 2px, visibile su tutti gli elementi interattivi.
- Screen reader: Tutte le icone SVG hanno `aria-label` o `aria-hidden`. Stati live (contatore giocatori, karma) annunciati con `aria-live="polite"`.
- Color alone: Mai usare solo il colore per comunicare stato. Accoppiare con icona, testo o pattern.
- Touch target: Min 44×44px.

---

## Anti-Slop Checklist

Vietato esplicitamente (frontend-design + huashu-design + impeccable):

- [ ] NO gradienti viola o neon come sfondo principale
- [ ] NO emoji usati come icone — solo SVG custom o libreria iconografica coerente
- [ ] NO card con `border-left` colorato > 1px come accent
- [ ] NO testo con gradiente (`background-clip: text`)
- [ ] NO glassmorphism/blur decorativo di default
- [ ] NO "hero metric template" (numero gigante + label piccola + gradiente)
- [ ] NO griglie di card identiche ripetute all'infinito
- [ ] NO modale come prima scelta — preferire bottom sheet su mobile
- [ ] NO font Inter, Roboto, Arial, system-font per display
- [ ] NO layout simmetrico eccessivo — variare composizione tra schermate
- [ ] NO ombre pesanti o diffuse — al massimo ombra sottile definita
- [ ] NO riempimento con contenuto fittizio/stats inventate per decorare

---

## Skill Integration

Le seguenti skill sono attive per il frontend e si applicano come segue:

| Skill | Ruolo nel progetto | Momento di attivazione |
|---|---|---|
| `frontend-design` | Direzione estetica bold, scelta tipografica e cromatica, evitare AI slop | Fase design system (pre-codice) e review visiva post-implementazione |
| `huashu-design` | Prototipi hi-fi, mockup mobile cliccabili, esportazione media per presentazioni | Durante la fase di prototipazione rapida e review con stakeholder |
| `impeccable` | Audit qualità UI/UX, polish, accessibilità, raffinamento interazioni | Code review visiva, iterazione post-MVP, verifica compliance design system |
| `web-design-guidelines` | Validazione contro best practices Vercel | Prima del deploy, verifica tecnica di accessibilità e performance |

---

## Open Questions Design

- [ ] L'utente preferisce un tema scuro opzionale per uso serale sui campi? (ipotesi MVP: solo light)
- [ ] Esiste un logo o wordmark Drop-In da integrare? (se non esiste, progettare logotype in Syne)
- [ ] Le icone sportive (canestro, porta, pallone) devono essere uniformi o differenziate per sport? (ipotesi MVP: solo basket/palla a spicchi)
