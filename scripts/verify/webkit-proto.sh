#!/usr/bin/env bash
# Verifica un prototipo statico su WebKit (motore Safari, profilo iPhone).
#
# Un comando, tre casi:
#   1. WebKit locale che parte            → lo usa (è il più veloce)
#   2. WebKit locale rotto (host rolling) → usa l'immagine Playwright via Docker
#   3. Docker assente                     → spiega cosa installare ed esce con 1
#
#   npm run verify:webkit
#   npm run verify:webkit -- --url=http://127.0.0.1:4173/onboarding.html
#   WEBKIT_ENGINE=docker npm run verify:webkit     # forza il container
#   BROWSER=chromium npm run verify:webkit         # confronto su Chromium
#
# Avvia il server statico dei prototipi solo se non c'è già, e lo spegne uscendo.
set -euo pipefail
cd "$(dirname "$0")/../.."

PORT="${PORT:-4173}"
URL="${URL:-http://127.0.0.1:$PORT/nav-map-lobby.html}"
IMAGE="mcr.microsoft.com/playwright:v1.65.0-noble"

server_pid=""
cleanup() {
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT

if ! curl -sf -o /dev/null "http://127.0.0.1:$PORT/"; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory docs/design/prototypes >/dev/null 2>&1 &
  server_pid=$!
  for _ in $(seq 1 25); do
    curl -sf -o /dev/null "http://127.0.0.1:$PORT/" && break
    sleep 0.2
  done
fi

run_local() {
  node scripts/verify/webkit-proto.mjs --url="$URL" "$@"
}

run_docker() {
  docker run --rm --network host --user "$(id -u):$(id -g)" \
    -e HOME=/tmp -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright -e URL="$URL" \
    -v "$PWD":"$PWD" -w "$PWD" \
    "$IMAGE" node scripts/verify/webkit-proto.mjs
}

if [[ "${WEBKIT_ENGINE:-auto}" == "docker" ]]; then
  echo "# WebKit nell'immagine Playwright (forzato)"
  run_docker
  exit
fi

# Il WebKit locale parte? Se no (host rolling: ICU/libxml2 troppo vecchi per il
# bundle), si va nel container senza chiedere niente all'utente.
if node -e "require('playwright').webkit.launch().then(b => b.close()).then(() => process.exit(0)).catch(() => process.exit(1))" >/dev/null 2>&1; then
  echo "# WebKit locale"
  run_local "$@"
else
  echo "# WebKit locale non disponibile: uso l'immagine Playwright ($IMAGE)"
  if ! command -v docker >/dev/null; then
    echo "Serve Docker, oppure un WebKit funzionante: vedi docs/design/prototypes/README.md § «Verifica su WebKit»." >&2
    exit 1
  fi
  run_docker
fi
