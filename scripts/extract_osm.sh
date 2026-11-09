#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper around scripts/extract_osm.py
python3 "$(dirname "$0")/extract_osm.py" "$@"

# Examples:
# ./scripts/extract_osm.sh --bbox 41.7,12.3,41.9,12.6 --dry-run
# ./scripts/extract_osm.sh --country IT --city Milan
# ./scripts/extract_osm.sh --bbox 41.7,12.3,41.9,12.6 --sport basketball --upsert-sql
