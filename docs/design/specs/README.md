# Specs — Schede schermata

Una spec per schermata o flusso. Nome file: `specs/<schermata>.md` (es. `specs/home-mappa.md`).

## Cosa contiene (obbligatorio)

1. **Obiettivo** — task utente in una frase ("trovare un campo libero entro 2 km").
2. **Stati** — default, loading, vuoto, errore, successo; per ognuno: cosa vede l'utente.
3. **Copy** — testi reali in italiano (titoli, CTA, errori, empty state). Niente lorem ipsum.
4. **A11y** — focus order, nomi accessibili, `aria-live` dove serve, contrasto dei token usati, target ≥ 44px.
5. **Screenshot** — 360px + desktop della schermata implementata (verifica @tester).

## Regole

- Token solo da `tokens.md`; componenti solo da `COMPONENTS.md`.
- Deviazioni solo se registrate in `gaps.md`.
- Una spec desueta si cancella, non si lascia marcire.
