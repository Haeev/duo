#!/usr/bin/env bash
# Régénère toute la bibliothèque de textures (atlas par famille, reliefs, textures.json), la contrôle,
# puis refait la planche de contrôle. Environ 30 s.
# Usage: bash games/la-petite-ligne-2/assets-src/textures/construire.sh
# Essai d'entrées seules, sans toucher aux livrables (PNG répété 2 x 2 dans .essai/essai/, ignoré
# par git): bash games/la-petite-ligne-2/assets-src/textures/construire.sh <id> [<id> ...]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
PAQUET="$(cd "$ICI/../.." && pwd)"
DEPOT="$(cd "$PAQUET/../.." && pwd)"
SORTIE="$PAQUET/assets/commun/textures"
if [ "$#" -gt 0 ]; then
  duo-python "$ICI/construire_textures.py" "$ICI/gabarits.toml" "$ICI/.essai" "$@"
  exit 0
fi
duo-python "$ICI/construire_textures.py" "$ICI/gabarits.toml" "$SORTIE"
duo-python "$ICI/verifier_textures.py" "$ICI/gabarits.toml" "$SORTIE"
duo-python "$ICI/planche.py" "$SORTIE" "$DEPOT/docs/jeux/jeu-1/refonte/planches/textures.png"
