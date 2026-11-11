# Prototipi statici

Schermate non ancora implementate, disegnate in HTML statico con i token veri.
**Non sono route dell'app e non entrano nel bundle**: servono a decidere prima di
scrivere codice di produzione, e restano come riferimento visivo dopo.

## Come aprirli

```bash
python3 -m http.server 4173 --directory docs/design/prototypes
# poi: http://localhost:4173/            (indice di review)
#      http://localhost:4173/onboarding.html
```

In alternativa apri il file direttamente nel browser (`file://`): tutto è
relativo e non c'è build.

Screenshot veloce a 360px:

```bash
npx playwright screenshot --viewport-size="360,780" \
  http://localhost:4173/onboarding.html /tmp/opencode/onboarding-360.png
```

## File

| File | Schermata | Ticket proto | Stato |
|---|---|---|---|
| `index.html` | Indice di review: le 8 schermate, cosa guardare | — | — |
| `onboarding.html` | Primo avvio (3 passi sopra la mappa) | d9 | approvato 2026-11-10 |
| `settings.html` | Impostazioni | d10 | approvato 2026-11-10 |
| `profile.html` | Profilo e modifica nickname | d11 | approvato 2026-11-10 |
| `lobby.html` | Lobby: lista, crea, dettaglio, join | d12 | approvato 2026-11-10 |
| `checkin.html` | Check-in: permessi, fuori raggio, successo | d13 | approvato 2026-11-10 |
| `notifications.html` | Centro notifiche e permesso push | d14 | approvato 2026-11-10 |
| `report.html` | Segnala un campo | d15 | approvato 2026-11-10 |
| `offline.html` | Offline, errore, stati vuoti | d16 | approvato 2026-11-10 |

`proto.css` e `proto.js` sono la base condivisa: **non si duplicano** dentro i
singoli file. I due `.woff2` self-hosted di `app/fonts/` sono incorporati una volta
sola in `proto.css` (data URI): i prototipi caricano Syne e Source Sans 3 anche da
`file://`, senza `@font-face` duplicati. Ogni prototipo aggiunge solo il proprio `<style>` per ciò che è
specifico della schermata.

## Regole

1. **Un file HTML per schermata**, con dentro tutti gli stati della schermata
   (default, loading, vuoto, errore, successo). Gli stati si cambiano dalla
   toolbar in cima, non con pagine separate.
2. **Token veri**: colori, radius, tipografia e motion vengono da `proto.css`,
   copiato da `app/globals.css`. Se un token cambia nell'app, si aggiorna qui
   nello stesso commit. Mai colori inventati nel prototipo.
3. **360px prima di tutto**: il contenuto vive dentro `.phone` (360px). Il
   desktop è la stessa schermata centrata, non un secondo layout.
4. **Niente dati finti "belli"**: nomi di campi, orari e karma devono essere
   plausibili e coerenti con il dominio (Roma, basket, lobby, check-in). I testi
   sono definitivi: il prototipo approvato è la spec di copy.
5. **Stati reali, non decorazione**: ogni bottone ha hover, focus, disabled;
   ogni form ha errore inline; ogni schermata ha il suo stato vuoto con CTA.
6. **Accessibilità già nel prototipo**: `aria-label` sulle icone, `aria-live`
   sugli esiti, focus visibile, target ≥ 44px. Un prototipo inaccessibile non
   si approva.
7. **Una sola CTA primaria per schermata**: le altre sono secondarie o ghost.
   La pipeline dichiarata in cima al file (commento HTML) dice dove siamo e
   qual è l'unico prossimo passo.
8. **Niente codice di produzione**: nessun import da `app/` o `components/`,
   nessuna fetch, nessun dato reale. Il prototipo non viene mai linkato
   dall'app.

## Checklist di review (HITL)

- [ ] La schermata dichiara pipeline, passo e prossimo passo.
- [ ] Tutti gli stati dell'elenco del ticket sono presenti e raggiungibili.
- [ ] Copy in italiano, concreto, senza gergo tecnico.
- [ ] Un solo controllo accent; touch target ≥ 44px; focus visibile.
- [ ] Contrasto AA sui token usati (vedi `../tokens.md`).
- [ ] `prefers-reduced-motion`: nessuna informazione affidata al movimento.
- [ ] Screenshot 360px e 768px allegati alla review.
- [ ] Nessun colore fuori da `proto.css`; nessun font diverso da Syne/Source Sans 3.

## Verifica automatica minima

```bash
# ogni prototipo usa la base condivisa
grep -L 'proto.css' docs/design/prototypes/*.html

# nessun colore hardcoded fuori da proto.css
grep -nE '#[0-9a-fA-F]{3,8}' docs/design/prototypes/*.html

# i prototipi non sono importati dall'app
grep -rn 'docs/design/prototypes' app components lib
```

I primi due comandi devono restituire output vuoto (il terzo: nessun match).
