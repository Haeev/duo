#!/usr/bin/env bash
# Régénère les bâtiments d'Aubrune (un GLB par fiche, manifeste batiments.json) et le jeu de
# pièces, puis les contrôle. Environ 15 secondes.
# Usage: bash games/la-petite-ligne-2/assets-src/decors/batiments-aubrune/construire.sh [id,id]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../.." && pwd)"
FICHES="$PAQUET/donnees/lieux/aubrune/batiments"
SORTIE="$PAQUET/assets/lieux/aubrune/batiments"
mkdir -p "$SORTIE/pieces"
if [ $# -ge 1 ]; then
  duo-python "$ICI/construire.py" --fiches "$FICHES" --sortie "$SORTIE" --seulement "$1" 2>&1 \
    | grep -E "^BATIMENT|^CONSTRUCTION|^PIECES|Error|Traceback|^  File" || true
else
  duo-python "$ICI/construire.py" --pieces "$SORTIE/pieces/pieces-aubrune.glb" --fiches "$FICHES" --sortie "$SORTIE" 2>&1 \
    | grep -E "^BATIMENT|^CONSTRUCTION|^PIECES|Error|Traceback|^  File" || true
fi
python3 "$ICI/verifier.py" "$SORTIE" "$FICHES" "$PAQUET/donnees/lieux/aubrune/plan.json"
