#!/usr/bin/env bash
# Planche des tenues dans le rendu encré de l'aperçu des personnages (environ 2 minutes en rendu logiciel).
# Usage: bash games/la-petite-ligne-2/assets-src/personnages/planche-encre/planche.sh [planche|controle] [sortie.png] [id,id] [port]
# Lance Vite si besoin, capture chaque vue, monte la planche. Ne rien construire pendant les captures (Vite recharge).
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
MODE="${1:-planche}"
SORTIE="${2:-$DEPOT/docs/jeux/jeu-1/refonte/planches/tenues-aubrune.png}"
IDS="${3:-}"
PORT="${4:-5961}"
VUES="$(mktemp -d)"
cd "$PAQUET"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --port "$PORT" --strictPort >"$VUES/vite.log" 2>&1 &
  SERVEUR=$!
  trap 'kill $SERVEUR 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
python3 "$ICI/planche_tenues.py" vues "$MODE" "$VUES/vues.json" $IDS
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$VUES" "$VUES/vues.json"
python3 "$ICI/planche_tenues.py" monter "$MODE" "$VUES" "$SORTIE" $IDS
echo "captures: $VUES"
