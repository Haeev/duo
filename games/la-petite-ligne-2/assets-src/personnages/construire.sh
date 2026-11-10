#!/usr/bin/env bash
# Régénère tout le catalogue des personnages (GLB par emplacement, catalogue.json, morphologies.json).
# Usage: bash games/la-petite-ligne-2/assets-src/personnages/construire.sh
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../.." && pwd)"
duo-python "$ICI/construire_catalogue.py" "$PAQUET/assets/commun/personnages" "$PAQUET/donnees/commun/personnages" 2>&1 \
  | grep -E "^CATALOGUE|Error|Traceback|^  File|SystemExit|introuvable|inconnue" || true
python3 "$ICI/verifier_catalogue.py" "$PAQUET/assets/commun/personnages" "$PAQUET/donnees/commun/personnages"
