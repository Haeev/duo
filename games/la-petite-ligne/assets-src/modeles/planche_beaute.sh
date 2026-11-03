#!/usr/bin/env bash
# Assemble les planches de la garde-robe de la 0.12 (rendus de planche_beaute.py), en webp.
#   bash planche_beaute.sh <dossier des rendus> <dossier de sortie>
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }

# 1. Avant (foulards, trois tenues fixes) et après (vêtements modulaires, écusson du profil), de face et de dos
convert "$r"/tenue_{a,b,c,d,e}_a.png -resize x420 +append "$t/a.png"
convert "$r"/tenue_{a,b,c,d,e,f}_b.png -resize x420 +append "$t/b.png"
convert "$r"/tenue_{a,b,c,d,e,f}_dos.png -resize x420 +append "$t/d.png"
convert "$r"/buste_{a,b,c,d,e,f}.png -resize x252 +append "$t/u.png"
w=1764
titre $w 60 26 "Avant (0.11): tenues fixes et foulard du profil" h0.png
titre $w 60 26 "Après (0.12): vêtements modulaires, écusson du profil sur la poitrine (de face, de dos, bustes)" h1.png
convert "$t/a.png" -background '#F4EFE6' -gravity west -extent ${w}x420 "$t/a2.png"
convert "$t/u.png" -background '#F4EFE6' -gravity center -extent ${w}x252 "$t/u2.png"
convert "$t/h0.png" "$t/a2.png" "$t/h1.png" "$t/b.png" "$t/d.png" "$t/u2.png" -append -quality 88 "$out/garde-robe-avant-apres.webp"

# 2. Toutes les pièces sur le corps nu-neutre
for s in top bottom shoes outer hat; do
  convert "$r"/piece_${s}_*.png +append "$t/p_$s.png"
done
titre 1100 60 22 "Pièces wear_<slot>_<style> sur le corps nu-neutre (haut, bas, chaussures, par-dessus, chapeaux)" hp.png
convert "$t/p_top.png" "$t/p_bottom.png" "$t/p_shoes.png" -append "$t/p1.png"
convert "$t/p_outer.png" "$t/p_hat.png" "$r/piece_corps_base.png" +append "$t/p2.png"
convert "$t/hp.png" "$t/p1.png" "$t/p2.png" -background '#F4EFE6' -gravity west -append -quality 88 "$out/garde-robe-pieces.webp"

# 3. Les 15 coupes, sans et avec chapeau (variante _hat)
ls "$r"/coupe_*_nu_av.png | sort > "$t/nu.txt"
ls "$r"/coupe_*_chapeau_av.png | sort > "$t/ch.txt"
convert $(cat "$t/nu.txt") +append "$t/c1.png"
convert $(cat "$t/ch.txt") +append "$t/c2.png"
titre 2730 60 26 "Coupes: en haut nues, en bas sous casquette, chapeau de paille ou bonnet (player_hair_<coupe>_hat)" hc.png
convert "$t/hc.png" "$t/c1.png" "$t/c2.png" -background '#F4EFE6' -gravity west -append -quality 88 "$out/garde-robe-coupes.webp"

# 4. Clips existants avec la tenue la plus volumineuse (ciré, bonnet, bottes)
ls "$r"/clip_*.png | sort > "$t/cl.txt"
n=0; row=0; : > "$t/rows.txt"
files=()
while read -r f; do
  files+=("$f"); n=$((n + 1))
  if [ "$n" -eq 10 ]; then convert "${files[@]}" +append "$t/row$row.png"; echo "$t/row$row.png" >> "$t/rows.txt"; files=(); n=0; row=$((row + 1)); fi
done < "$t/cl.txt"
if [ "$n" -gt 0 ]; then convert "${files[@]}" +append "$t/row$row.png"; echo "$t/row$row.png" >> "$t/rows.txt"; fi
titre 1820 60 22 "Clips existants avec ciré, short, bottes et bonnet: rien ne traverse (idle, walk, hoe, chop, harvest, sit, carry_two...)" hk.png
convert "$t/hk.png" $(cat "$t/rows.txt") -background '#F4EFE6' -gravity west -append -quality 85 "$out/garde-robe-clips.webp"
rm -rf "$t"
ls -l "$out"
