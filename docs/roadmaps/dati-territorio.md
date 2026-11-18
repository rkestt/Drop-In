# Dati e territorio

**Orizzonte**: primavera, poi attività ricorrente.
**Obiettivo**: la mappa deve essere **vera e riconoscibile** nel polo di partenza. Un campo che non puoi nominare non è un campo, è una coordinata.
**Piano**: `docs/plans/spring.md`, voci 1, 1b, 2.

## Stato

Il database ha 10.130 campi su Roma, ma: **6.364 non hanno sport** (63%) e solo 51 hanno un indirizzo. `beachvolleyball` era nei dati e non nell'app (sbloccato 2026-11-18, `be1437a` + `049`). Ostia è fuori dal bbox. I 9.572 nomi generici "Spazio aperto" sono stati rinominati dal backfill #106 (2026-11-18, etichetta da tipo di impianto + flag `is_auto_name`). Non è un difetto dello script: in OpenStreetMap quei campi non hanno nome.

## Voci

| Voce | Ticket | Stato |
| --- | --- | --- |
| Sbloccare gli slug di sport che i dati già contengono | — | fatto 2026-11-18 (`be1437a`, `049_normalize_beach_volleyball.sql`: 17 campi normalizzati; slug canonico in `lib/sport/sports.ts`, `lib/validation/schemas.ts`, `SPORT_LABELS`; estrattore canonifica nel prossimo import; filtro autonomo "Beach volley", 8 chip) |
| Audit `sport` limitato al bbox del polo | #63 | aperto, scope ridotto |
| Note di campo (agibilità leggera) | #90 | aperto |
| Nominare i campi del polo | #106 | fatto 2026-11-18 (`050`/`051`, estrattore, badge + proposta + tab moderazione) |
| Estrazione OSM del secondo polo (Ostia) | — | rinviato |
| Curatela ricorrente delle aggiunte future | — | attività, non ticket |

## Decisioni chiuse

- Il polo di partenza è **Roma70 a EUR**, già dentro il bbox: nessuna estrazione nuova per partire.
- L'agibilità si esprime con **Note datate**, mai con uno stato binario, e il campo non viene mai nascosto né bloccato.
- L'audit dei campi si fa sul polo, non su Roma intera.
- **Nomi dei campi (implementata 2026-11-18, #106 chiuso)**: nome generico con flag di generazione automatica (`courts.is_auto_name` in `050`, backfill dei 9.572 nomi generici con l'etichetta del tipo di impianto, flag esposto da `nearby_courts`/`courts_in_viewport`); l'utente interessato propone un nome che passa da coda di moderazione (tabella + quattro RPC proposta/ritiro/approvazione con override/rifiuto con nota obbligatoria in `051`, chiusura d'ufficio delle pending a campo chiuso); UI per proporre e rivedere (badge "Nome automatico" + "Proponi il nome vero" su scheda e preview sheet, mai nelle righe di ricerca; sezione "Nomi che hai proposti"; terza tab "Nomi" nel pannello di moderazione); l'estrattore genera i nomi dal `venue_type` e gestisce il flag nell'upsert. Spec e prototipo: `docs/design/specs/nomi-campo.md`, `docs/design/prototypes/nomi-campo.html`. Backfill verificato: 9.572 automatici, 558 nomi veri, zero "Spazio aperto".
- **Limite noto**: correggere un campo che ha già un nome vero non ha una CTA — non è la stessa cosa di un nome generato, decisione a sé.

## Decisioni aperte

Nessuna.

## Dipendenze

Nessuna tecnica. Per Ostia serve la decisione di aprire il secondo polo, e a quel punto l'estrazione è un pomeriggio.

## Perché conta

Un database di campi **verificati, nominati e giocabili** è l'unica cosa che i concorrenti romani non hanno e non copiano in un trimestre. È anche l'unica voce che rende l'azienda vendibile. Costa noia, non ingegno.
