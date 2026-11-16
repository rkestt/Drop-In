#!/usr/bin/env bash
# Backup logico (pg_dump custom format) di un database Supabase.
#
# Perche' pg_dump 17: prod/staging girano Postgres 15 oggi, ma il client 17
# legge anche le versioni precedenti e non richiede installare il client
# esatto sul server di turno. Se il binario locale manca o e' piu' vecchio,
# lo script usa l'immagine Docker `postgres:17` (default).
#
# Uso:
#   scripts/backup-db.sh --dsn "$SUPABASE_DB_URL" --label staging
#   scripts/backup-db.sh --dsn ... --out /var/backups/dropin --keep 30
#   scripts/backup-db.sh --dsn postgres://...:54322/postgres --label local
#
# Sicurezza: il DB di produzione ha un ref noto; senza --i-know-this-is-prod
# lo script si ferma. Nessun secret viene scritto su disco o nei log (il DSN
# non viene mai stampato).
#
# Exit: 0 ok, 1 errore, 2 uso/guardia.

set -euo pipefail

PROD_REF="jeuqmmiebzeqtdctmtzj"
KEEP=14
OUT_DIR="backups"
LABEL="db"
DSN="${SUPABASE_DB_URL:-}"
DOCKER_IMAGE="postgres:17"
ALLOW_PROD=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dsn) DSN="${2:-}"; shift 2 ;;
    --out) OUT_DIR="${2:-}"; shift 2 ;;
    --keep) KEEP="${2:-}"; shift 2 ;;
    --label) LABEL="${2:-}"; shift 2 ;;
    --docker-image) DOCKER_IMAGE="${2:-}"; shift 2 ;;
    --i-know-this-is-prod) ALLOW_PROD=1; shift ;;
    -h|--help) usage ;;
    *) echo "Argomento sconosciuto: $1" >&2; usage ;;
  esac
done

[[ -n "$DSN" ]] || { echo "Manca --dsn o SUPABASE_DB_URL" >&2; exit 2; }
[[ "$KEEP" =~ ^[0-9]+$ ]] && [[ "$KEEP" -ge 1 ]] || { echo "--keep deve essere >= 1" >&2; exit 2; }

if [[ "$DSN" == *"$PROD_REF"* && "$ALLOW_PROD" -ne 1 ]]; then
  echo "Il DSN punta alla produzione ($PROD_REF). Rilancia con --i-know-this-is-prod." >&2
  exit 2
fi

mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASENAME="${LABEL}-${STAMP}.dump"
TARGET="${OUT_DIR}/${BASENAME}"

# pg_dump locale abbastanza recente? (>= 17)
LOCAL_DUMP=""
if command -v pg_dump >/dev/null 2>&1; then
  MAJOR="$(pg_dump --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
  if [[ "$MAJOR" =~ ^[0-9]+$ ]] && [[ "$MAJOR" -ge 17 ]]; then
    LOCAL_DUMP="$(command -v pg_dump)"
  fi
fi

echo "Backup di $LABEL in $TARGET"
START="$(date +%s)"

if [[ -n "$LOCAL_DUMP" ]]; then
  "$LOCAL_DUMP" --format=custom --no-owner --no-privileges --dbname="$DSN" --file="$TARGET"
else
  command -v docker >/dev/null 2>&1 || {
    echo "pg_dump >= 17 non trovato e docker non disponibile." >&2
    exit 1
  }
  ABS_OUT="$(cd "$OUT_DIR" && pwd)"
  # --network host: il container raggiunge 127.0.0.1 del host (Linux).
  docker run --rm --network host \
    -v "${ABS_OUT}:/backup" \
    "$DOCKER_IMAGE" \
    pg_dump --format=custom --no-owner --no-privileges \
      --dbname="$DSN" --file="/backup/${BASENAME}"
fi

# Checksum: un dump troncato non deve sembrare valido.
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$TARGET" > "${TARGET}.sha256"
fi

SIZE="$(du -h "$TARGET" | cut -f1)"
ELAPSED=$(( $(date +%s) - START ))
echo "Fatto: $TARGET ($SIZE, ${ELAPSED}s)"

# Retention: tiene i $KEEP dump piu' recenti per label, cancella i piu' vecchi
# (e i loro .sha256).
mapfile -t OLD < <(ls -1t "${OUT_DIR}/${LABEL}-"*.dump 2>/dev/null | tail -n +$((KEEP + 1)))
if [[ ${#OLD[@]} -gt 0 ]]; then
  echo "Retention: rimuovo ${#OLD[@]} dump oltre i $KEEP piu' recenti"
  for f in "${OLD[@]}"; do
    rm -f "$f" "$f.sha256"
    echo "  - $f"
  done
fi
