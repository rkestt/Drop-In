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
