#!/usr/bin/env bash
# Reconstruit maison.glb (meubles du tour 10), le nettoie, régénère index.json et refait les planches du coffre
# et de l'étagère haute.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/refaire_maison_t10.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
out="$(cd "$ici/../../../.." && pwd)/docs/jeux/jeu-1/gauntlet/captures/tour-10/modeles"
cd "$ici"
LPL_SANS_PLANCHES=1 duo-python maison.py > /dev/null
bash verifier/nettoyer_tour10.sh > /dev/null
python3 fiche.py > "${TMPDIR:-/tmp}/tables.md"
for n in oak_chest cellar_rack; do
  duo-python verifier/quatre_angles.py maison.glb "$n" "$out/$n.png" --marge 1.4 > /dev/null
  montage "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png" -tile 4x1 -geometry +2+2 "$out/modeles-$n.png"
  rm -f "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png"
done
echo fini
