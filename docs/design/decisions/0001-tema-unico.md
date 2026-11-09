> **Status: Superseded by [ADR 0004](0004-tema-dark.md).**

# 0001 — Un solo tema chiaro

## Stato

Accepted

## Contesto

Drop-In è un’app mobile-first usata principalmente all’aperto. Il team vuole velocizzare il rilascio della FASE 1 senza dover gestire due palette complete e garantire coerenza con la mappa.

## Decisione

- Attivare un solo tema chiaro.
- Non introdurre `data-theme`, toggle o varianti Tailwind `dark:`.
- Il tema scuro è riconosciuto come primo task del workflow successivo, ma rimane non implementato.

## Motivazione

- Riduce il carico di decisioni e test per la FASE 1.
- Mantiene la leggibilità della mappa OpenFreeMap liberty, già chiara.
- Evita contrasti deboli sui marker arancioni in modalità scura.
- Semplifica il vincolo “no colori hardcoded”: c’è una sola mappatura semantica.

## Conseguenze

- `app/globals.css` ha un unico blocco `:root` senza media query dark.
- I componenti non usano `dark:`.
- AGENTS.md vieta esplicitamente temi multipli fino a nuova decisione.
- Il lavoro sul dark sarà un task a sé: definire sfondo scuro, surface, testo, bordi, overlay, e verificare contrasto AA.

## Collegamenti

- [themes.md](../themes.md)
- [tokens.md](../tokens.md)
