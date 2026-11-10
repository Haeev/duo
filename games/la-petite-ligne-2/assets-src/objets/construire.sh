#!/usr/bin/env bash
# Régénère tous les objets (un GLB par famille et index.json) puis les contrôle.
# Usage: bash games/la-petite-ligne-2/assets-src/objets/construire.sh [--planche]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../.." && pwd)"
duo-python "$ICI/construire_objets.py" "$PAQUET/assets/commun/objets" 2>&1 | grep -E "^OBJETS|Error|Traceback|^  File|SystemExit|nuancier|inconnue|double" || true
python3 "$ICI/verifier_objets.py" "$PAQUET/assets/commun/objets"
if [ "${1:-}" = "--planche" ]; then
  duo-python "$ICI/planche_objets.py" "$PAQUET/assets/commun/objets" "$ICI/planches/planche-objets.png" 2>&1 | grep -E "^PLANCHE|Error" || true
fi
