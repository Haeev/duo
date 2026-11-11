#!/usr/bin/env bash
# Refait la planche du troisième lot d'Aubrune (cultures, décor des fêtes, reprises), environ
# 3 minutes en rendu logiciel (9 vues).
# Usage: bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/planche/cultures-fetes.sh [port]
# Ne rien construire dans le paquet pendant les captures: Vite rechargerait la page.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
PORT="${1:-5937}"
VUES="${PLANCHE_VUES:-$(mktemp -d)}"
MANIFESTE="$PAQUET/assets/commun/decors/decors.json"
cd "$PAQUET"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --port "$PORT" --strictPort >"$VUES/vite.log" 2>&1 &
  SERVEUR=$!
  trap 'kill $SERVEUR 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
python3 "$ICI/cultures_fetes.py" vues "$MANIFESTE" "$VUES/vues.json"
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$VUES" "$VUES/vues.json" ${PLANCHE_SEULES:-}
python3 "$ICI/cultures_fetes.py" planche "$MANIFESTE" "$VUES" "$DEPOT/docs/jeux/jeu-1/refonte/planches/cultures-fetes-reprises.png"
echo "captures: $VUES"
