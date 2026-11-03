#!/usr/bin/env bash
# Reconstruit bourg.glb seul (sans ses planches de contrôle), puis le nettoie comme construire.sh.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/construire_bourg.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ici"
export LPL_SANS_PLANCHES=1
duo-python bourg.py > /dev/null
bash "$ici/verifier/nettoyer_glb.sh" bourg
