#!/usr/bin/env bash
# Prova di consegna email (#86): manda un invito (default) o una recovery
# via Auth Admin API al progetto indicato e dice dove guardare.
#
# Uso:
#   scripts/smoke-email.sh --url URL --to ADDR [--kind invite|recover]
#   scripts/smoke-email.sh --url http://localhost:54321 --to test@example.com
#   SUPABASE_SERVICE_ROLE_KEY=... scripts/smoke-email.sh --url https://<ref>.supabase.co --to <tua-casella>
#
# Env richieste: SUPABASE_SERVICE_ROLE_KEY (mai in chiaro nel comando).
# La recovery usa invece SUPABASE_ANON_KEY (endpoint pubblico /recover).
# Nessun default punta alla produzione: --url e' obbligatorio, e il ref prod
# noto richiede --i-know-this-is-prod (stesso modello di backup-db.sh).
#
# In locale l'invito finisce in Mailpit: lo script lo cerca via API e lo dice.
# Esito reale comunque da controllare a mano in tre posti: inbox, spam,
# scheda "Promozioni" (Gmail).
#
# Exit: 0 ok, 1 errore invio/verifica, 2 uso/guardia.

set -euo pipefail

PROD_REF="jeuqmmiebzeqtdctmtzj"
URL="${SUPABASE_URL:-}"
TO=""
KIND="invite"
ALLOW_PROD=0

usage() {
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) URL="${2:-}"; shift 2 ;;
    --to) TO="${2:-}"; shift 2 ;;
    --kind) KIND="${2:-}"; shift 2 ;;
    --i-know-this-is-prod) ALLOW_PROD=1; shift ;;
    -h|--help) usage ;;
    *) echo "Argomento sconosciuto: $1" >&2; usage ;;
  esac
done

[[ -n "$URL" ]] || { echo "Manca --url (o SUPABASE_URL). Nessun default: indica il progetto." >&2; exit 2; }
[[ -n "$TO" ]] || { echo "Manca --to ADDR." >&2; exit 2; }
[[ "$KIND" == "invite" || "$KIND" == "recover" ]] || { echo "--kind deve essere invite o recover." >&2; exit 2; }

if [[ "$URL" == *"$PROD_REF"* && "$ALLOW_PROD" -ne 1 ]]; then
  echo "L'URL punta alla produzione ($PROD_REF). Rilancia con --i-know-this-is-prod." >&2
  exit 2
fi

if [[ "$KIND" == "invite" ]]; then
  KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
  [[ -n "$KEY" ]] || { echo "Manca SUPABASE_SERVICE_ROLE_KEY in env (serve per l'Admin API)." >&2; exit 2; }
  ENDPOINT="$URL/auth/v1/admin/invite"
  BODY="{\"email\":\"$TO\"}"
  AUTH_HEADER="Authorization: Bearer $KEY"
else
  KEY="${SUPABASE_ANON_KEY:-}"
  [[ -n "$KEY" ]] || { echo "Manca SUPABASE_ANON_KEY in env (serve per /recover)." >&2; exit 2; }
  ENDPOINT="$URL/auth/v1/recover"
  BODY="{\"email\":\"$TO\"}"
  AUTH_HEADER="Authorization: Bearer $KEY"
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

HTTP="$(curl -s -o "$TMP" -w '%{http_code}' -m 30 -X POST "$ENDPOINT" \
  -H "apikey: $KEY" \
  -H "$AUTH_HEADER" \
  -H 'Content-Type: application/json' \
  -d "$BODY")"

echo "POST $ENDPOINT -> HTTP $HTTP"
head -c 500 "$TMP"; echo

if [[ "$HTTP" != "200" && "$HTTP" != "201" ]]; then
  echo "Invio fallito (HTTP $HTTP)."
  echo "Se l'indirizzo esiste gia', l'invito fallisce: usa un indirizzo fresco o --kind recover." >&2
  echo "Se HTTP 429, hai colpito il rate limit (built-in: 2/ora): aspetta o usa lo SMTP dedicato." >&2
  exit 1
fi

# Locale: conferma che il messaggio e' arrivato in Mailpit.
if [[ "$URL" == *"localhost"* || "$URL" == *"127.0.0.1"* ]]; then
  FOUND="$(curl -s -m 10 'http://localhost:54334/api/v1/messages?limit=50' | grep -c "$TO" || true)"
  if [[ "$FOUND" -ge 1 ]]; then
    echo "Mailpit (:54334): messaggio per $TO trovato. Aprilo in http://localhost:54334."
  else
    echo "Mailpit (:54334): nessun messaggio per $TO tra gli ultimi 50. Controlla che [local_smtp] sia attivo." >&2
    exit 1
  fi
else
  echo "Invio reale: controlla inbox, cartella SPAM e scheda PROMOZIONI (Gmail) di $TO."
fi
