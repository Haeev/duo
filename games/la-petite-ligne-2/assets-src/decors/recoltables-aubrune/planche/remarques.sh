#!/usr/bin/env bash
# Planche des remarques du client sur les modèles (avant, après), environ 8 minutes en rendu
# logiciel.
# Usage: bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/planche/remarques.sh <avant|apres|planche> <dossier avant> <dossier après> [port]
#   avant: capture les vues qui ont un avant (à faire AVANT de reconstruire les modèles);
#   apres: capture toutes les vues sur les modèles actuels; planche: monte les deux colonnes.
# Ne rien construire dans le paquet pendant les captures: Vite rechargerait la page.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
ETAPE="$1"
AVANT="$2"
APRES="$3"
PORT="${4:-5951}"
SORTIE="$DEPOT/docs/jeux/jeu-1/refonte/planches/remarques-modeles-2026-11-11.png"
if [ "$ETAPE" = "planche" ]; then
  python3 "$ICI/remarques.py" planche "$AVANT" "$APRES" "$SORTIE"
  exit 0
fi
DOSSIER="$APRES"
[ "$ETAPE" = "avant" ] && DOSSIER="$AVANT"
mkdir -p "$DOSSIER"
cd "$PAQUET"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --port "$PORT" --strictPort >"$DOSSIER/vite.log" 2>&1 &
  SERVEUR=$!
  trap 'kill $SERVEUR 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
python3 "$ICI/remarques.py" vues "$DOSSIER/vues.json"
SEULES="${PLANCHE_SEULES:-}"
if [ "$ETAPE" = "avant" ] && [ -z "$SEULES" ]; then
  SEULES="$(python3 -c "import json,sys; print(','.join(v['nom'] for v in json.load(open(sys.argv[1])) if v['avant']))" "$DOSSIER/vues.json")"
fi
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$DOSSIER" "$DOSSIER/vues.json" $SEULES
