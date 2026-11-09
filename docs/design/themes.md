# Temi

## Tema attuale: dark (unico)

Un solo tema è attivo: **dark**. Tutti i token sono in `app/globals.css`, blocco `:root`.
Non esiste un tema chiaro, né un toggle, né una variante `dark:`.

- **Background**: tre grigi neutri — `--bg-base` `#141414`, `--bg-surface` `#1f1f1f`, `--bg-elevated` `#2b2b2b`.
- **Testo**: `--text-primary` `#f0f0f0`, `--text-secondary` `#a8a8a8`, `--text-muted` `#949494` (testo attenuato, placeholder; AA anche su elevated).
- **Accent**: verde `#24ae56`, hover `#2fc463`. Sopra l'accent il testo è scuro (`--accent-foreground` `#141414`), mai bianco.
- **Feedback**: `--success` è teal `#2dd4bf`; `--danger` rosso corallo `#ff5a5f` con `--danger-foreground` scuro; `--warning` ambra `#ffb020`. I testi su tinta usano le varianti `-dark` chiare.
- **Superfici**: `--border` `#333333`, `--border-strong` `#4a4a4a`, `--overlay` `rgba(0, 0, 0, 0.6)`. `--cool-muted` resta per bordi sottili e scrollbar.
- **Focus**: `--focus-ring` = `--accent`.

### Regole assolute

- Nessun attributo `data-theme`.
- Nessun toggle tema.
- Nessuna classe Tailwind `dark:`.
- Nessun `text-white` su `--accent` o `--danger`: usare i foreground dedicati.
- La mappa è sempre nello stile chiaro **OpenFreeMap liberty**, anche con l'interfaccia scura.

## Perché la mappa resta chiara

- Leggibilità outdoor: la mappa serve a orientarsi in strada, con luce diretta.
- I marker (accent, bordi bianchi) sono progettati per il fondo chiaro della mappa.
- Il contrasto tra chrome scuro e mappa chiara separa nettamente i controlli dal contenuto geografico.

## Contrasto

I rapporti misurati sono in `tokens.md` (sezione “Contrasti misurati”). In sintesi:

- `--accent-foreground` su `--accent`: 6,37:1 (AA).
- `--danger-foreground` su `--danger`: 6,04:1 (AA).
- `--text-primary` e `--text-secondary` passano AA su tutti e tre gli sfondi.
- `--text-muted` **passa** AA come testo normale (6,07 / 5,43 / 4,67:1): ammesso per placeholder, metadati e icone. Vedi `gaps.md`.
- Badge accent: testo `--text-primary` su `--accent-subtle` (9,81–12,87:1). `--accent` come testo sul subtle si ferma a 3,87–4,48:1.

## Storia

Il tema chiaro (surface calde, accent arancione) è stato sostituito dal dark nel task di design architecture del 2026-11-09. La documentazione precedente che parlava di “tema chiaro” è superata da questa pagina.
