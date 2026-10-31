#!/usr/bin/env bash
# Assemble une planche avant et après (rendus de planche_bourg.py): une vignette par nœud,
# avant à gauche et après à droite, triangles dans la légende. Écrit aussi <planche>-gris.png.
#   bash planche_bourg.sh <rendus> <nom> <planche.png> <stats avant.json> <stats après.json> <titre> <nœud,...>
set -euo pipefail
r="$1"; nom="$2"; out="$3"; sa="$4"; sb="$5"; titre="$6"; noeuds="${7//,/ }"
t="$(mktemp -d)"
font="DejaVu-Sans"
tri() { python3 -c "import json,sys; n=json.load(open(sys.argv[1]))['nodes']; v=n.get(sys.argv[2], {}); print(v.get('tris', '?'))" "$1" "$2"; }
i=0
for n in $noeuds; do
  a=$(tri "$sa" "$n"); b=$(tri "$sb" "$n"); suffixe=""
  if [[ "$a" == "?" ]]; then
    # les états (ruine, réparé) n'ont pas de compte à part: celui du bâtiment entier (deux états)
    p="${n%_ruin}"; p="${p%_repaired}"
    a=$(tri "$sa" "$p"); b=$(tri "$sb" "$p"); suffixe=" (les deux états)"
  fi
  convert "$r/${nom}_${n}_a.png" "$r/${nom}_${n}_b.png" -resize 600x480 +append \
    -background '#F4EFE6' -font "$font" -pointsize 24 -fill '#2B2A33' -gravity north -splice 0x44 \
    -annotate +0+8 "$n: $a puis $b triangles$suffixe" "$t/$(printf %03d $i).png"
  i=$((i + 1))
done
montage "$t"/*.png -tile 2x -geometry +6+6 -background '#F4EFE6' "$t/grille.png"
w=$(identify -format %w "$t/grille.png")
convert -size "${w}x70" xc:'#F4EFE6' -font "$font" -pointsize 34 -fill '#2B2A33' -gravity center \
  -annotate +0+0 "$titre" "$t/titre.png"
convert "$t/titre.png" "$t/grille.png" -append "$out"
convert "$out" -colorspace Gray "${out%.png}-gris.png"
rm -rf "$t"
echo "$out"
