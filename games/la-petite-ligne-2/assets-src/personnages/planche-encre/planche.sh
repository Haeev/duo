#!/usr/bin/env bash
# Planches des tenues dans le rendu encré de l'aperçu des personnages (1 à 2 s par vue en rendu logiciel).
# Usage: bash games/la-petite-ligne-2/assets-src/personnages/planche-encre/planche.sh [mode] [sortie] [id,id] [port]
#   planche  -> sortie.png (défaut: la planche de la bible); controle -> sortie.png;
#   etude    -> dossier de feuilles (trois silhouettes, six poses, cinq angles par pièce);
#   avant    -> dossier des vues « avant » d'une pièce à reprendre (à lancer avant de la modifier, vers avant/).
# Lance son propre Vite sur un port libre, sans rechargement à chaud (vite.planche.config.mjs): la page charge
# tout au départ, on peut reconstruire pendant une capture. Un port donné en 4e argument est repris s'il
# répond: ne le faire que pour un serveur lancé depuis CET arbre. VUES_DIR=<dossier> garde les captures.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
MODE="${1:-planche}"
SORTIE="${2:-$DEPOT/docs/jeux/jeu-1/refonte/planches/tenues-aubrune.png}"
IDS="${3:-}"
PORT="${4:-}"
VUES="${VUES_DIR:-$(mktemp -d)}"
mkdir -p "$VUES"
cd "$PAQUET"
if [ -z "$PORT" ]; then
  PORT="$(python3 -c 'import socket; s = socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1])')"
fi
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --config "$ICI/vite.planche.config.mjs" --port "$PORT" --strictPort >"$VUES/vite.log" 2>&1 &
  SERVEUR=$!
  # npx lance Vite dans un processus fils: on arrête aussi celui-ci (reconnu à son port), sinon il reste
  trap 'kill $SERVEUR 2>/dev/null || true; pkill -f "vite.planche.config.mjs --port $PORT --strictPort" 2>/dev/null || true' EXIT
  trap 'exit 143' TERM INT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
python3 "$ICI/planche_tenues.py" vues "$MODE" "$VUES/vues.json" $IDS
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$VUES" "$VUES/vues.json"
python3 "$ICI/planche_tenues.py" monter "$MODE" "$VUES" "$SORTIE" $IDS
echo "captures: $VUES"
