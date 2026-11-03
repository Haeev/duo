#!/usr/bin/env bash
# Assemble la planche avant et après des façades de la 0.12 et la planche du petit vase (rendus de
# planche_batiments_012.py), en webp.
#   bash planche_batiments_012.sh <dossier des rendus> <dossier de sortie>
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }
rows=()
for n in gatekeeper_house station ferrand_shop haberdashery bakery; do
  for k in a b; do
    convert "$r/bat_${n}_jeu_$k.png" "$r/bat_${n}_dos_$k.png" "$r/bat_${n}_coin_$k.png" -resize x336 +append "$t/${n}_$k.png"
  done
  convert "$t/${n}_a.png" "$t/${n}_b.png" +append "$t/$n.png"
  rows+=("$t/$n.png")
done
w=$(identify -format '%w' "${rows[0]}")
titre "$w" 60 24 "Façades (maisonnette, halte, épicerie, mercerie, fournil): avant à gauche, après à droite (vue de jeu, vue opposée, coin de près). Gouttières, descentes, pots, jardinières en boules" h.png
convert "$t/h.png" "${rows[@]}" -background '#F4EFE6' -gravity west -append -quality 86 "$out/beaute-batiments-avant-apres.webp"
titre 1200 50 22 "small_vase, small_vase_blue, small_vase_terracotta sur la table (0,78 m)" hv.png
convert "$r/vases_table.png" "$r/vases_proche.png" -resize x420 +append "$t/v.png"
convert "$t/hv.png" "$t/v.png" -background '#F4EFE6' -gravity center -append -quality 88 "$out/vase-fleurs.webp"
rm -rf "$t"
ls -l "$out"
