#!/usr/bin/env bash
# Refait la planche de contrôle des bâtiments d'Aubrune (environ 5 minutes en rendu logiciel).
# Usage: bash games/la-petite-ligne-2/assets-src/decors/batiments-aubrune/planche/planche.sh [port]
# Lance Vite sur le port donné (5913 par défaut), capture chaque vue, monte la planche.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
PORT="${1:-5913}"
VUES="${PLANCHE_VUES:-$(mktemp -d)}"
MANIFESTE="$PAQUET/assets/lieux/aubrune/batiments/batiments.json"
cd "$PAQUET"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --port "$PORT" --strictPort >"$VUES/vite.log" 2>&1 &
  SERVEUR=$!
  trap 'kill $SERVEUR 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
duo-python "$ICI/monter.py" vues "$MANIFESTE" "$VUES/vues.json"
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$VUES" "$VUES/vues.json"
duo-python "$ICI/monter.py" planche "$MANIFESTE" "$VUES" "$DEPOT/docs/jeux/jeu-1/refonte/planches/batiments-aubrune.png"
echo "captures: $VUES"
