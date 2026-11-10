#!/usr/bin/env bash
# Régénère tous les décors (GLB par famille et manifeste decors.json), puis les contrôle.
# Usage: bash games/la-petite-ligne-2/assets-src/decors/construire.sh
# DECORS_BLEND=<chemin.blend> pour garder une scène à ouvrir dans Blender.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../.." && pwd)"
duo-python "$ICI/construire_decors.py" "$PAQUET/assets/commun/decors" 2>&1 \
  | grep -E "^DECOR|Error|Traceback|^  File|SystemExit|inconnue|vide|double" || true
python3 "$ICI/verifier_decors.py" "$PAQUET/assets/commun/decors" "$PAQUET/donnees/commun/meubles"
