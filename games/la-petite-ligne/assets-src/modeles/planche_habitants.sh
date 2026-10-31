#!/usr/bin/env bash
# Assemble la planche des personnages arrondis (rendus de planche_habitants.py).
#   bash planche_habitants.sh <dossier des rendus> <planche.png> <stats d'avant (personnages.json)>
# Écrit aussi <planche>-gris.png.
set -euo pipefail
r="$1"
out="$2"
avant="$3"
ici="$(cd "$(dirname "$0")" && pwd)"
apres="$ici/stats/personnages.json"
font="DejaVu-Sans"
t="$(mktemp -d)"
tri() { python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['meshes'][sys.argv[2]])" "$1" "$2"; }
titre() { convert -size 4000x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$1" "$t/$4"; }
who="player firmin odette basile jeanne lucie smock_bob overalls_bun"
noms="joueur (work, short): $(python3 -c "import json; print(json.load(open('$avant'))['player_example_tris'])") > $(python3 -c "import json; print(json.load(open('$apres'))['player_example_tris'])")"
for n in firmin odette basile jeanne lucie; do
  noms="$noms   $n: $(tri "$avant" villager_$n) > $(tri "$apres" villager_$n)"
done
titre "Personnages en low poly arrondi: avant en haut, après en bas (idle). Joueur, Firmin, Odette, Basile, Jeanne, Lucie, tenues smock et overalls" 80 40 h0.png
titre "Triangles $noms" 60 30 h1.png
convert $(for w in $who; do echo "$r/corps_${w}_a.png"; done) +append "$t/a.png"
convert $(for w in $who; do echo "$r/corps_${w}_b.png"; done) +append "$t/b.png"
titre "Visages face à la caméra iso, avant en haut, après en bas. Joueur: neutre, contente, ravie, fatiguée, affamée, clignement. Habitants: neutre, clignement" 60 30 h2.png
faces="player_neutral player_happy player_delighted player_tired player_hungry player_blink firmin_neutral firmin_blink odette_neutral odette_blink basile_neutral basile_blink jeanne_neutral jeanne_blink"
convert $(for f in $faces; do echo "$r/visage_${f}_a.png"; done) -resize 285x285 +append -background '#F4EFE6' -gravity center -extent 4000x285 "$t/va.png"
convert $(for f in $faces; do echo "$r/visage_${f}_b.png"; done) -resize 285x285 +append -background '#F4EFE6' -gravity center -extent 4000x285 "$t/vb.png"
convert "$t/h0.png" "$t/h1.png" "$t/a.png" "$t/b.png" "$t/h2.png" "$t/va.png" "$t/vb.png" -append "$out"
convert "$out" -colorspace Gray "${out%.png}-gris.png"
rm -rf "$t"
echo "$out"
