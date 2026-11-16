# Audit dei campi OSM (#63)

10.130 campi importati da OpenStreetMap, mai verificati a mano. Questo audit
serve a rimuovere i punti inesistenti, correggere i nomi generici e fondere i
doppioni prima che il catalogo cresca. **Nessuna cancellazione automatica**:
ogni decisione la prende una persona, batch da 50.

Stato al 2026-11-16: script e primo batch pronti (`docs/audit/batch-01.*`).
Il ticket resta aperto finché i 203 batch non sono completati.

## Come si genera un batch

Sorgente consigliata: la REST API con la **anon key** (sola lettura, nessun
secret di servizio sul portatile; legge solo i campi approvati, che è ciò che
si audita).

```bash
# locale
python3 scripts/audit_courts.py \
  --supabase-url http://127.0.0.1:54321 \
  --anon-key "$(grep -o 'sb_publishable_[A-Za-z0-9_-]*' .env.local | head -1)" \
  --summary

# un batch (1-based) in docs/audit/
python3 scripts/audit_courts.py --supabase-url ... --anon-key ... \
  --batch 1 --batch-size 50 --out docs/audit

# tutti i batch + indice, in una cartella fuori dal repo (203 file × 2)
python3 scripts/audit_courts.py --supabase-url ... --anon-key ... \
  --all --out /tmp/dropin-audit
```

Alternativa senza rete: export JSON e `--from-json`.

```bash
docker exec -i supabase_db_drop-in psql -U postgres -d postgres -Atc \
  "select json_agg(row_to_json(t)) from (
     select id, name, address, lat, lng, sport, surface_type, source,
            osm_id, hoop_count, moderation_status
     from public.courts) t" > /tmp/courts.json
python3 scripts/audit_courts.py --from-json /tmp/courts.json --batch 1
```

Su staging l'anon key è quella del progetto `drop-in-staging`; **non** usare
la service-role: l'audit è in lettura e non deve poter scrivere.

Output per batch:

- `batch-NN.csv` — la lista da compilare (una riga per campo);
- `batch-NN.md` — la stessa lista leggibile, con link Google Maps/OSM.

## Cosa significano i segnali

Lo script non decide, ordina: i campi con più segnali gravi stanno in cima,
così i batch iniziali sono i più produttivi.

| Segnale | Priorità | Perché |
|---|---|---|
| `nome vuoto` | alta | non identificabile |
| `nome generico` (`Spazio aperto`, `Campo senza nome`, …) | alta | l'estrazione usa un fallback quando OSM non ha il nome |
| `coordinate mancanti` / `coordinate 0,0` | alta | errore di import, il punto non esiste |
| `duplicato? NNm` | alta | un altro campo entro 50 m: quasi sempre lo stesso posto mappato due volte (OSM node+way) |
| `fuori Italia` | alta | import sbagliato o corte estera |
| `fuori Roma` | media | oggi il seed è Roma; può essere legittimo se si espande |
| `sport non specificato` | media | 6.364 campi su 10.130: è la voce del backfill (#71), non sempre un errore |
| `indirizzo assente` | bassa | si può aggiungere dopo |
| `proposta community` | bassa | non viene da OSM, la moderazione l'ha già vista |
| `duplicato?` | alta | distanza in metri dal vicino più prossimo |

Distribuzione sul DB locale (10.130 campi, 2026-11-16): **6.329 alta**,
3.405 media, 340 bassa, 56 senza segnali. I numeri alti sono attesi: la
maggioranza sono "Spazio aperto" + sport null + doppioni OSM.

## Come compilare

Nel CSV, per ogni riga:

| `esito` | Quando |
|---|---|
| `keep` | il campo esiste, nome e posizione vanno bene |
| `update` | esiste ma il nome/indirizzo/sport va corretto → scrivi in `note` il valore giusto |
| `duplicate` | è un doppione: in `note` l'id del campo da tenere (spesso già in `duplicate_of`) |
| `remove` | non esiste / non è un campo da gioco / è un doppione senza valore |
| `unsure` | serve un controllo sul posto o una decisione di prodotto → spiega in `note` |

Regole pratiche:

- **Non decidere dal nome**: apri il link Google/OSM e guarda l'immagine
  satellitare. Un "Spazio aperto" può essere un campetto vero o un'aiuola.
- **Doppioni**: tieni la riga con più informazioni (nome, sport, foto,
  osm_id di tipo `way`/`relation` di solito è più preciso del `node`).
- **Foto**: i campi con `photo_path` sono già stati visti da un moderatore,
  quindi `keep` è più probabile (ma la foto può essere sbagliata).
- `unsure` è un esito valido: meglio 10 incerti che 1 cancellazione sbagliata.
- Non toccare l'ordine, il `batch` o le colonne: lo script rigenera solo i
  file mancanti, e le righe già compilate restano.

## Come si applicano le decisioni

Non c'è (di proposito) un comando che applica il CSV al database. Le decisioni
si applicano **dopo revisione**, con SQL espliciti e per gruppi piccoli:

```sql
-- keep: niente da fare (eventualmente backfill sport/indirizzo dalla nota)
-- update: una riga per campo, con i valori scritti nel CSV
UPDATE public.courts SET name = '...', address = '...', sport = 'basketball'
WHERE id = '...';

-- duplicate: tieni `keep_id`, sposta foto e riferimenti, poi elimina il doppione
UPDATE public.courts SET photo_path = COALESCE(photo_path, (SELECT photo_path FROM public.courts WHERE id = 'dup_id'))
WHERE id = 'keep_id';
DELETE FROM public.courts WHERE id = 'dup_id';  -- cascade su lobby/check-in/recensioni

-- remove: verifica che non ci siano check-in/lobby/review attive prima
SELECT count(*) FROM public.check_ins WHERE court_id = '...';
DELETE FROM public.courts WHERE id = '...';
```

Sicurezza:

- eseguire prima su staging, poi su prod, con backup fresco (`docs/ci.md`);
- `DELETE` in transazione (`BEGIN; ... ROLLBACK;` per provare, poi `COMMIT`);
- i campi con `moderation_status <> 'approved'` non passano da qui: sono
  proposte community e si gestiscono dalla coda di moderazione;
- dopo ogni giro: `npm run test:rls` in locale e smoke su staging.

## Come tracciare il lavoro

- Un batch = un commento su #63 con link al CSV compilato e un riassunto
  (`keep/update/duplicate/remove/unsure`).
- I file compilati si committano in `docs/audit/` (il batch 01 è già lì come
  esempio); i batch generati e non ancora compilati restano fuori dal repo.
- Non chiudere #63 finché i 203 batch non sono stati passati almeno una volta
  (o finché il catalogo non è stato rifatto da zero con dati migliori).

## Test dello script

```bash
python3 -m unittest discover -s tests/python -v
```

19 casi: normalizzazione, nomi generici, doppioni a <50 m, priorità, ordine
stabile (stesso output su input invertito), batching, CSV/Markdown, CLI e
`--summary`. Nessun test tocca il database.

## Limiti noti

- L'anon key vede solo i campi `approved`: le proposte `pending` non passano
  dall'audit (e non devono: hanno già un moderatore).
- Il rilevamento doppioni è a 50 m in linea d'aria: due campi nello stesso
  parco possono essere legittimamente vicini; il segnale è un indizio, non una
  sentenza.
- `osm_id` non è sempre presente (proposte community): i link OSM per quei
  campi puntano alla coordinata, non all'oggetto.
- Lo script non scrive: l'applicazione delle decisioni è un passaggio manuale
  e questo è voluto.
