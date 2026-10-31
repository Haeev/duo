#!/usr/bin/env bash
# Assemble la planche avant et après du low poly arrondi à partir des rendus de planche_arrondi.py.
#   bash planche_arrondi.sh <dossier des rendus> <planche.png>
# Écrit aussi la version en niveaux de gris (<planche>-gris.png). Triangles lus dans stats/ et avant.json.
set -euo pipefail
r="$1"
out="$2"
ici="$(cd "$(dirname "$0")" && pwd)"
avant="${AVANT_STATS:-$r/avant}"
tris() { # tris <fichier stats> <nœud>
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); n=d.get('nodes') or d['meshes']; v=n[sys.argv[2]]; print(v['tris'] if isinstance(v,dict) else v)" "$1" "$2"
}
joueur() {
  python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['player_example_tris'])" "$1"
}
fa=$(tris "$avant/bourg.json" firmin_house); fb=$(tris "$ici/stats/bourg.json" firmin_house)
oa=$(tris "$avant/bourg.json" tree_oak_large); ob=$(tris "$ici/stats/bourg.json" tree_oak_large)
ba=$(tris "$avant/bourg.json" bush_round); bb=$(tris "$ici/stats/bourg.json" bush_round)
pa=$(joueur "$avant/personnages.json"); pb=$(joueur "$ici/stats/personnages.json")
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size 2400x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$1" "$t/$4"; }
titre "La Petite Ligne: low poly arrondi, témoins (avant à gauche, après à droite, même caméra isométrique que le jeu)" 90 36 h0.png
titre "Plan de jeu, 24 m de champ (zoom moyen)" 60 28 h1.png
convert "$r/jeu24_a.png" "$r/jeu24_b.png" +append "$t/r1.png"
titre "Maison de Firmin (firmin_house): $fa triangles avant, $fb après" 60 28 h2.png
convert "$r/maison_a.png" "$r/maison_b.png" +append -background '#F4EFE6' -gravity center -extent 2400x700 "$t/r2.png"
titre "Chêne (tree_oak_large, alias tree_oak): $oa puis $ob triangles. Buisson (bush_round, alias bush): $ba puis $bb" 60 28 h3.png
convert "$r/nature_a.png" "$r/nature_b.png" +append -background '#F4EFE6' -gravity center -extent 2400x700 "$t/r3.png"
titre "Joueur complet (base, tenue work, coiffure short, foulard orb): $pa puis $pb triangles. Clips idle, walk, hoe" 60 28 h4.png
convert "$r/perso_idle_a.png" "$r/perso_walk_a.png" "$r/perso_hoe_a.png" -resize 400x520 +append "$t/pa.png"
convert "$r/perso_idle_b.png" "$r/perso_walk_b.png" "$r/perso_hoe_b.png" -resize 400x520 +append "$t/pb.png"
convert "$t/pa.png" "$t/pb.png" +append "$t/r4.png"
convert "$t/h0.png" "$t/h1.png" "$t/r1.png" "$t/h2.png" "$t/r2.png" "$t/h3.png" "$t/r3.png" "$t/h4.png" "$t/r4.png" \
  -append "$out"
convert "$out" -colorspace Gray "${out%.png}-gris.png"
rm -rf "$t"
echo "$out"
