#!/usr/bin/env bash
# Planches du tour 10 pour maison.glb et ferme.glb: rangement (quatre angles), rideaux ouverts et fermés
# (une couleur par vue), panne faîtière.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_maison_t10.sh <dossier>
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:?dossier de sortie}"
mkdir -p "$out"
cd "$ici"
for n in oak_chest cellar_rack tool_rack; do
  duo-python verifier/quatre_angles.py maison.glb "$n" "$out/$n.png" --marge 1.4 > /dev/null
  montage "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png" -tile 4x1 -geometry +2+2 "$out/modeles-$n.png"
  rm -f "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png"
done
duo-python verifier/quatre_angles.py ferme.glb ridge_purlin "$out/ridge_purlin.png" > /dev/null
montage "$out/ridge_purlin-0.png" "$out/ridge_purlin-1.png" -tile 2x1 -geometry +2+2 "$out/modeles-ridge_purlin.png"
rm -f "$out"/ridge_purlin-*.png
tous="curtains_rod"
for c in curtains curtains_blue curtains_red curtains_yellow curtains_green curtains_gingham; do
  tous="$tous,${c}_open,${c}_closed"
done
for c in curtains curtains_blue curtains_red curtains_yellow curtains_green curtains_gingham; do
  for e in open closed; do
    cacher="$(echo "$tous" | tr ',' '\n' | grep -v -x "curtains_rod" | grep -v -x "${c}_$e" | paste -sd, -)"
    duo-python verifier/vue_interieur.py maison.glb curtains_window "$out/rideau-$c-$e.png" --entier 1 \
      --cacher "$cacher" --azimuts 160 --elevation 15 --res 420x420 --cible 0,0.3,0 --taille 1.5 > /dev/null
  done
done
montage "$out"/rideau-curtains-open-0.png "$out"/rideau-curtains-closed-0.png \
  "$out"/rideau-curtains_blue-open-0.png "$out"/rideau-curtains_blue-closed-0.png \
  "$out"/rideau-curtains_red-open-0.png "$out"/rideau-curtains_red-closed-0.png \
  "$out"/rideau-curtains_yellow-open-0.png "$out"/rideau-curtains_yellow-closed-0.png \
  "$out"/rideau-curtains_green-open-0.png "$out"/rideau-curtains_green-closed-0.png \
  "$out"/rideau-curtains_gingham-open-0.png "$out"/rideau-curtains_gingham-closed-0.png \
  -tile 6x2 -geometry +2+2 "$out/modeles-rideaux.png"
rm -f "$out"/rideau-*.png
ls "$out"/modeles-*.png
