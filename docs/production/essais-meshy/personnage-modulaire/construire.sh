#!/usr/bin/env bash
# Reconstruit le corps et les pièces de l'essai à partir des sorties brutes (hors dépôt).
# Usage: bash construire.sh <dossier des sorties brutes> [pièce ...]
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
BRUTS="$1"; shift
if [ "$#" -eq 0 ] || [ "$1" = "corps" ]; then
  duo-python "$ICI/scripts/corps_commun.py" "$ICI/fiches/corps_adulte.meshy.json" "$BRUTS/rig/corps_rig.glb" "$ICI/pieces/corps.glb" "$ICI/squelette-commun.json" \
    walk="$BRUTS/rig/corps_marche.glb:0" run="$BRUTS/rig/corps_course.glb:0" idle="$BRUTS/rig/corps_animation_glb.glb:0" wave="$BRUTS/rig/corps_animation_glb.glb:1" 2>&1 | grep -E "^CORPS|Error|Traceback" || true
  [ "$#" -gt 0 ] && shift
fi
mkdir -p "$ICI/rapports"
for fiche in "$ICI"/fiches/*.meshy.json; do
  nom="$(basename "$fiche" .meshy.json)"
  brut="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1])).get('brut',''))" "$fiche")"
  [ -z "$brut" ] && continue
  if [ "$#" -gt 0 ] && [[ ! " $* " == *" $nom "* ]]; then continue; fi
  duo-python "$ICI/scripts/conformer_piece.py" "$fiche" "$ICI/pieces/corps.glb" "$BRUTS/$brut" "$ICI/pieces/$nom.glb" "$ICI/rapports/$nom.json" 2>&1 | grep -E "^RAPPORT|Error|Traceback|line " || true
done
