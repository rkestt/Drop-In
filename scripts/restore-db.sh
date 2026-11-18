#!/usr/bin/env bash
# Restore di un dump prodotto da scripts/backup-db.sh (formato custom).
#
# Uso:
#   scripts/restore-db.sh --file backups/staging-20261116T033000Z.dump \
#     --dsn postgres://postgres:postgres@127.0.0.1:54322/postgres --yes
#   scripts/restore-db.sh --file backups/x.dump --dsn ... --dry-run  (elenca il contenuto, non tocca il DB)
#
# Guardie:
#  - richiede --yes (nessun restore interattivo "a caso");
#  - rifiuta host non locali senza --allow-remote (un restore sopra staging o
#    prod cancella i dati correnti: e' l'operazione piu' pericolosa del repo);
#  - verifica il checksum .sha256 se presente;
#  - `pg_restore --clean --if-exists` sul database indicato.
#
# Dopo un restore su staging: `supabase db push --remote` per riallineare le
# migrazioni, poi smoke test (docs/ci.md).

set -euo pipefail

FILE=""
DSN="${SUPABASE_DB_URL:-}"
CONFIRM=0
ALLOW_REMOTE=0
DRY_RUN=0
DOCKER_IMAGE="postgres:17"
PROD_REF="jeuqmmiebzeqtdctmtzj"

usage() {
  sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) FILE="${2:-}"; shift 2 ;;
    --dsn) DSN="${2:-}"; shift 2 ;;
    --docker-image) DOCKER_IMAGE="${2:-}"; shift 2 ;;
    --yes) CONFIRM=1; shift ;;
    --allow-remote) ALLOW_REMOTE=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage ;;
    *) echo "Argomento sconosciuto: $1" >&2; usage ;;
  esac
done

[[ -n "$FILE" ]] || { echo "Manca --file" >&2; exit 2; }
[[ -f "$FILE" ]] || { echo "File non trovato: $FILE" >&2; exit 2; }
[[ -n "$DSN" ]] || { echo "Manca --dsn o SUPABASE_DB_URL" >&2; exit 2; }
if [[ "$DRY_RUN" -eq 0 ]]; then
  [[ "$CONFIRM" -eq 1 ]] || { echo "Refusing senza --yes (il restore sovrascrive i dati)." >&2; exit 2; }
fi

if [[ "$DSN" == *"$PROD_REF"* ]]; then
  echo "Il DSN punta alla produzione: vietato da questo script (rollback prod = PITR, vedi docs/ci.md)." >&2
  exit 2
fi

HOST_PART="$(printf '%s' "$DSN" | sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#')"
if [[ "$ALLOW_REMOTE" -ne 1 ]] && [[ "$HOST_PART" != "127.0.0.1" && "$HOST_PART" != "localhost" ]]; then
  echo "Host '$HOST_PART' non locale: aggiungi --allow-remote se sei sicuro." >&2
  exit 2
fi

if [[ -f "${FILE}.sha256" ]] && command -v sha256sum >/dev/null 2>&1; then
  echo "Verifico checksum..."
  (cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256")
fi

ABS_FILE="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "Dry-run: il database non viene toccato (target: host $HOST_PART)."
  echo "Contenuto del dump (prime 30 voci TOC):"
  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore --list "$ABS_FILE" 2>/dev/null | head -30
  else
    docker run --rm -v "$(dirname "$ABS_FILE"):/backup:ro" \
      "$DOCKER_IMAGE" \
      pg_restore --list "/backup/$(basename "$ABS_FILE")" 2>/dev/null | head -30
  fi
  exit 0
fi

LOCAL_RESTORE=""
if command -v pg_restore >/dev/null 2>&1; then
  MAJOR="$(pg_restore --version | sed -E 's/.* ([0-9]+)\..*/\1/')"
  if [[ "$MAJOR" =~ ^[0-9]+$ ]] && [[ "$MAJOR" -ge 17 ]]; then
    LOCAL_RESTORE="$(command -v pg_restore)"
  fi
fi

echo "Restore di $FILE su host $HOST_PART"
if [[ -n "$LOCAL_RESTORE" ]]; then
  "$LOCAL_RESTORE" --clean --if-exists --no-owner --no-privileges \
    --dbname="$DSN" "$ABS_FILE"
else
  command -v docker >/dev/null 2>&1 || {
    echo "pg_restore >= 17 non trovato e docker non disponibile." >&2
    exit 1
  }
  docker run --rm --network host \
    -v "$(dirname "$ABS_FILE"):/backup:ro" \
    "$DOCKER_IMAGE" \
    pg_restore --clean --if-exists --no-owner --no-privileges \
      --dbname="$DSN" "/backup/$(basename "$ABS_FILE")"
fi

echo "Restore completato. Prossimi passi:"
echo "  - staging: npx supabase db push --remote   (riallinea migrazioni)"
echo "  - verifiche: npm run test:rls (locale), smoke /api/health e mappa su staging"
echo "  - se il restore era un drill: droppa il database di prova"
