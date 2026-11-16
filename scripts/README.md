# scripts/extract_osm.py

Extracts sports fields and open spaces from OpenStreetMap (Overpass) into JSON + SQL.

## Usage
See `python3 scripts/extract_osm.py --help`.

## Flags
- `--bbox S,W,N,E` (exclusive) or `--country ISO2` / `--city NAME` / `--country ISO2 --city NAME` (`--city` with `--country` restricts via `countrycodes`)
- `--sport S` filter after parsing, token match on `;`-separated values (keeps multi + untagged)
- `--output DIR` (default scripts/generated/)
- `--out-name NAME` (plain basename only: no absolute paths, no `..`; refuses to overwrite unless `--force`)
- `--force` overwrite existing output files
- `--dry-run` fetch+parse only, no writes
- `--upsert-sql` emit ON CONFLICT upsert
- `--endpoint URL` Overpass mirror override

## Etiquette
Overpass: retry once on 429/timeout, then suggest mirror. Nominatim: 1 req/s, real User-Agent.

## Gitignored
`scripts/generated/` is gitignored. Do not commit large global extracts.

## Regenerate committed Rome seed
`python3 scripts/extract_osm.py --bbox 41.75,12.30,41.98,12.65 --output scripts --out-name seed_courts --force`

## Load SQL into local Supabase
`psql ... -f scripts/generated/<name>.sql` or paste in Studio.

## Warning
Global extracts are big — do not commit.

---

# scripts/audit_courts.py

Audit manuale dei campi esistenti (#63), a batch da 50. Non scrive sul DB:
produce un CSV da compilare (`esito`/`note`) e un markdown leggibile con link
Google Maps/OSM e segnali di sospetto (nome generico, doppioni <50 m, fuori
Roma, sport NULL).

## Usage
```bash
python3 scripts/audit_courts.py --from-json /tmp/courts.json --batch 1
python3 scripts/audit_courts.py --supabase-url http://127.0.0.1:54321 \
  --anon-key "$ANON_KEY" --all --out /tmp/dropin-audit
python3 scripts/audit_courts.py --from-json /tmp/courts.json --summary
```

## Flags
- `--from-json FILE` (lista o JSONL) **oppure** `--supabase-url URL` + `--anon-key KEY` (REST, sola lettura)
- `--batch N` (1-based, default 1) oppure `--all` (tutti i batch + `index.md`)
- `--batch-size N` (default 50)
- `--out DIR` (default `docs/audit`)
- `--summary` statistiche senza scrivere file

## Dati
- Input `--from-json`: export del DB (query in `docs/audit-courts.md`).
- Input REST: l'anon key vede solo i campi `approved`; le proposte pending si
  gestiscono nella moderazione.
- Output: `batch-NN.md`, `batch-NN.csv`, `index.md` (con `--all`).

## Test
`python3 -m unittest discover -s tests/python -v` (19 casi, nessun DB).

## Regola
Nessuna cancellazione automatica: le decisioni si applicano a mano. Procedura
completa in `docs/audit-courts.md`.


## audit_courts.py — audit manuale dei campi (#63)

Genera batch da 50 campi con link Google Maps/OSM e segnali di sospetto
(nome generico, doppioni <50 m, coordinate fuori, sport null). **Non scrive
sul database**: produce `batch-NN.csv` (colonne `esito`/`note` da compilare)
e `batch-NN.md`.

```bash
python3 scripts/audit_courts.py --from-json /tmp/courts.json --summary
python3 scripts/audit_courts.py --from-json /tmp/courts.json --batch 1
python3 scripts/audit_courts.py --supabase-url http://127.0.0.1:54321 \
  --anon-key "$ANON_KEY" --all --out /tmp/dropin-audit
```

Procedura, criteri di decisione e applicazione: `docs/audit-courts.md`.
Test: `python3 -m unittest discover -s tests/python -v`.
