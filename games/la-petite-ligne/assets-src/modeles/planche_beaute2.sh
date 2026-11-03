#!/usr/bin/env bash
# Assemble les planches avant et après de planche_beaute2.py (coupes, habitants, clips), en webp.
#   bash planche_beaute2.sh <dossier des rendus> <dossier de sortie>
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }
cuts="short bob bun crop curls ponytail braid pigtails wavy long fringe quiff cloud crown bob_long"
npcs="firmin odette basile jeanne lucie achille solange"

for k in a b; do
  convert $(for c in $cuts; do echo "$r/coupe_${c}_av_$k.png"; done) +append "$t/c_$k.png"
  convert $(for n in $npcs; do echo "$r/pnj_${n}_$k.png"; done) +append "$t/p_$k.png"
  convert $(for n in $npcs; do echo "$r/visage_${n}_$k.png"; done) +append "$t/v_$k.png"
  ls "$r"/clip_*_"$k".png | sort > "$t/l_$k.txt"
done
w=$(identify -format '%w' "$t/c_a.png")
titre "$w" 56 24 "Coupes (dans l'ordre: short, bob, bun, crop, curls, ponytail, braid, pigtails, wavy, long, fringe, quiff, cloud, crown, bob_long): avant en haut, après en bas (mèches)" h.png
convert "$t/h.png" "$t/c_a.png" "$t/c_b.png" -append -quality 88 "$out/beaute-coupes-avant-apres.webp"

w=$(identify -format '%w' "$t/p_a.png")
titre "$w" 56 22 "Habitants (Firmin, Odette, Basile, Jeanne, Lucie, Achille, Solange): avant en haut, après en bas" h.png
convert "$t/v_a.png" -resize "${w}x" "$t/v_a2.png"
convert "$t/v_b.png" -resize "${w}x" "$t/v_b2.png"
convert "$t/h.png" "$t/p_a.png" "$t/p_b.png" "$t/v_a2.png" "$t/v_b2.png" -append -quality 88 "$out/beaute-habitants-avant-apres.webp"

# clips: une colonne par image de clip, avant au-dessus de après (les clips nouveaux n'ont pas d'avant)
cols=()
i=0
while read -r fb; do
  fa="${fb%_b.png}_a.png"
  if [ -f "$fa" ]; then a="$fa"; else convert -size "$(identify -format '%wx%h' "$fb")" xc:'#E6E0D4' -font "$font" -pointsize 18 -fill '#2B2A33' -gravity center -annotate +0+0 "nouveau" "$t/n$i.png"; a="$t/n$i.png"; fi
  convert "$a" "$fb" -append "$t/col$i.png"
  cols+=("$t/col$i.png"); i=$((i + 1))
done < "$t/l_b.txt"
half=$(( (${#cols[@]} + 1) / 2 ))
convert "${cols[@]:0:$half}" +append "$t/r1.png"
convert "${cols[@]:$half}" +append "$t/r2.png"
w=$(identify -format '%w' "$t/r1.png")
titre "$w" 56 20 "Clips (avant en haut, après en bas de chaque colonne; ordre alphabétique des clips; nouveaux: carry_one, cook, drink, feed, pickup, sit_down)" h.png
convert "$t/h.png" "$t/r1.png" "$t/r2.png" -background '#F4EFE6' -gravity west -append -quality 85 "$out/beaute-clips-avant-apres.webp"
rm -rf "$t"
ls -l "$out"
