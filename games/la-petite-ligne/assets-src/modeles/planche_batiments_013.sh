#!/usr/bin/env bash
# Assemble les planches des bâtiments neufs de la 0.13 (rendus de planche_batiments_013.py), en webp:
# extérieurs (vue de jeu avec un habitant à la porte, vue opposée, porte de près, toit de près), intérieurs coupés
# comme en jeu (et beffroi, rouet), scènes posées comme sur la carte.
#   bash planche_batiments_013.sh <dossier des rendus> <dossier de sortie>
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
bg='#F4EFE6'
titre() { convert -size "$1"x"$2" xc:"$bg" -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity west -annotate +14+0 "$4" "$t/$5"; }

ext=(church presbytery_house village_house_a village_house_a_shuttered village_house_b lineman_house
     lineman_house_shuttered forester_house cafe_house forge_shop joinery_shop farm_house farm_barn washhouse watermill
     mill_wheel sluice_footbridge tailrace_planks)
rows=()
for n in "${ext[@]}"; do
  convert "$r/${n}_jeu.png" "$r/${n}_dos.png" "$r/${n}_porte.png" "$r/${n}_toit.png" -resize x300 -background "$bg" \
    -splice 6x0 +append "$t/${n}_img.png"
  w=$(identify -format '%w' "$t/${n}_img.png")
  titre "$w" 34 20 "$n" "${n}_t.png"
  convert "$t/${n}_t.png" "$t/${n}_img.png" -append "$t/$n.png"
  rows+=("$t/$n.png")
done
half=$(( ${#rows[@]} / 2 ))
convert "${rows[@]:0:$half}" -background "$bg" -gravity west -append -quality 84 "$out/batiments-013-exterieurs-1.webp"
convert "${rows[@]:$half}" -background "$bg" -gravity west -append -quality 84 "$out/batiments-013-exterieurs-2.webp"

int=()
for n in church cafe_house forge_shop joinery_shop farm_house watermill; do int+=("$r/${n}_interieur.png"); done
convert "${int[@]:0:3}" -resize x420 -background "$bg" -splice 6x0 +append "$t/i1.png"
convert "${int[@]:3:3}" -resize x420 -background "$bg" -splice 6x0 +append "$t/i2.png"
convert "$r/church_beffroi.png" "$r/watermill_rouet.png" -resize x420 -background "$bg" -splice 6x0 +append "$t/i3.png"
w=$(identify -format '%w' "$t/i1.png")
titre "$w" 40 20 "Intérieurs coupés comme en jeu (église, café, forge / menuiserie, ferme, moulin), beffroi et rouet" hi.png
convert "$t/hi.png" "$t/i1.png" "$t/i2.png" "$t/i3.png" -background "$bg" -gravity west -append -quality 84 \
  "$out/batiments-013-interieurs.webp"

sc=()
for n in scene_eglise scene_carrefour scene_ferme scene_moulin; do
  convert "$r/${n}_jeu.png" "$r/${n}_nord.png" -resize x400 -background "$bg" -splice 6x0 +append "$t/$n.png"
  sc+=("$t/$n.png")
done
w=$(identify -format '%w' "${sc[0]}")
titre "$w" 40 20 "Posés comme sur la carte: église, carrefour, ferme, moulin (vue de jeu, vue du nord-ouest)" hs.png
convert "$t/hs.png" "${sc[@]}" -background "$bg" -gravity west -append -quality 84 "$out/batiments-013-scenes.webp"
rm -rf "$t"
ls -l "$out"/batiments-013-*.webp
