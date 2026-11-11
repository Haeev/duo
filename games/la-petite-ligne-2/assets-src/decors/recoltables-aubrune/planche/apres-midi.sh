#!/usr/bin/env bash
# Planche des modèles de l'après-midi du 2026-11-11 (rendu encré du jeu, trois angles par modèle),
# ou cinq vues de contrôle de près par modèle. Environ 15 s par vue en rendu logiciel.
# Usage: bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/planche/apres-midi.sh <planche|controle> <dossier des vues> [noms de vues, séparés par des virgules] [port]
# Ne rien construire dans le paquet pendant les captures: Vite rechargerait la page.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
MODE="$1"
DOSSIER="$2"
SEULES="${3:-}"
PORT="${4:-5953}"
mkdir -p "$DOSSIER"
cd "$PAQUET"
if ! curl -s -o /dev/null "http://localhost:$PORT/"; then
  npx vite --port "$PORT" --strictPort >"$DOSSIER/vite.log" 2>&1 &
  SERVEUR=$!
  trap 'kill $SERVEUR 2>/dev/null || true' EXIT
  until curl -s -o /dev/null "http://localhost:$PORT/"; do sleep 1; done
fi
if [ "$MODE" = "controle" ]; then
  python3 "$ICI/apres_midi.py" vues "$DOSSIER/vues.json" controle
else
  python3 "$ICI/apres_midi.py" vues "$DOSSIER/vues.json"
fi
NODE_PATH="${NODE_PATH:-/opt/node22/lib/node_modules}" node "$ICI/capturer.cjs" "http://localhost:$PORT" "$DOSSIER" "$DOSSIER/vues.json" $SEULES
if [ "$MODE" = "controle" ]; then
  python3 "$ICI/apres_midi.py" planche "$DOSSIER" "$DOSSIER/controle.png" controle
else
  python3 "$ICI/apres_midi.py" planche "$DOSSIER" "$DEPOT/docs/jeux/jeu-1/refonte/planches/modeles-2026-11-11-apres-midi.png"
fi
