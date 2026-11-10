#!/usr/bin/env bash
# Régénère les récoltables d'Aubrune (GLB par famille, entrées du manifeste decors.json), puis les
# contrôle. Environ 10 secondes.
# Usage: bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/construire.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../../.." && pwd)"
SORTIE="$PAQUET/assets/commun/decors"
duo-python "$ICI/construire.py" --sortie "$SORTIE" --cultures "$PAQUET/donnees/commun/cultures" 2>&1 \
  | grep -E "^RECOLTABLE|^FICHIER|^CONSTRUCTION|Error|Traceback|^  File" || true
python3 "$ICI/verifier.py" "$SORTIE" "$PAQUET/donnees/commun"
