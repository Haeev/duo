#!/usr/bin/env bash
# Toutes les planches du tour 10, rangées dans docs/jeux/jeu-1/gauntlet/captures/tour-10/modeles/.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/planches_tour10.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
out="$(cd "$ici/../../../.." && pwd)/docs/jeux/jeu-1/gauntlet/captures/tour-10/modeles"
mkdir -p "$out"
cd "$ici"
bash verifier/quatre_tour10.sh "$out" bourg > /dev/null
bash verifier/quatre_maison_t10.sh "$out" > /dev/null
for etat in bati chantier site coupe; do
  duo-python verifier/vue_pieces.py bourg.glb "$out/p-$etat.png" --etat "$etat" --res 800x620 > /dev/null
  montage "$out/p-$etat-0.png" "$out/p-$etat-1.png" "$out/p-$etat-2.png" "$out/p-$etat-3.png" -tile 2x2 -geometry +2+2 \
    "$out/modeles-maisonnette-pieces-$etat.png"
  rm -f "$out"/p-"$etat"-*.png
done
tmp="$(mktemp -d)"
duo-python planche_coiffures.py "$tmp" tout > "$tmp/log.txt"
t="${TMPDIR:-/tmp}"
montage "$t"/bustes_0_0.png "$t"/bustes_0_1.png "$t"/bustes_0_2.png "$t"/bustes_1_0.png "$t"/bustes_1_1.png \
  "$t"/bustes_1_2.png -tile 1x6 -geometry +0+2 "$out/modeles-coupes-1.png"
montage "$t"/bustes_2_0.png "$t"/bustes_2_1.png "$t"/bustes_2_2.png "$t"/bustes_3_0.png "$t"/bustes_3_1.png \
  "$t"/bustes_3_2.png -tile 1x6 -geometry +0+2 "$out/modeles-coupes-2-barbes.png"
montage "$t"/poses_0.png "$t"/poses_1.png "$t"/poses_2.png -tile 1x3 -geometry +0+2 "$out/modeles-coupes-poses.png"
montage "$t"/habitants_0.png "$t"/habitants_1.png "$t"/habitants_2.png -tile 1x3 -geometry +0+2 \
  "$out/modeles-achille-solange.png"
duo-python verifier/coiffures_couche.py | grep MESURE > "$out/modeles-coupes-couche.txt"
rm -rf "$tmp"
ls "$out"
