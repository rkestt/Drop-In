# scripts/extract_osm.py

Extracts sports fields and open spaces from OpenStreetMap (Overpass) into JSON + SQL.

## Usage
See `python3 scripts/extract_osm.py --help`.

## Flags
- `--bbox S,W,N,E` or `--country ISO2 [--city NAME]` (mutually exclusive area)
- `--sport S` filter after parsing (keeps multi + untagged)
- `--output DIR` (default scripts/generated/)
- `--out-name NAME`
- `--dry-run` fetch+parse only, no writes
- `--upsert-sql` emit ON CONFLICT upsert
- `--endpoint URL` Overpass mirror override

## Etiquette
Overpass: retry once on 429/timeout, then suggest mirror. Nominatim: 1 req/s, real User-Agent.

## Gitignored
`scripts/generated/` is gitignored. Do not commit large global extracts.

## Regenerate committed Rome seed
`python3 scripts/extract_osm.py --bbox 41.75,12.30,41.98,12.65 --output scripts --out-name seed_courts`

## Load SQL into local Supabase
`psql ... -f scripts/generated/<name>.sql` or paste in Studio.

## Warning
Global extracts are big — do not commit.
