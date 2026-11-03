#!/usr/bin/env bash
# Captures Three.js des témoins (vues avant et après, visages, zoom 1) depuis le GLB livré.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/captures_temoins.sh <avant.glb> <dossier de sortie>
# avant.glb: personnages.glb d'avant les témoins (git show <commit>:games/la-petite-ligne/assets/modeles/personnages.glb).
# Three.js: games/la-petite-ligne/node_modules/three, ou LPL_THREE (worktree sans node_modules).
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
glb="$ici/../../../assets/modeles/personnages.glb"
avant="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
t="$(mktemp -d)"
node "$ici/temoins.cjs" "$t/vues.png" vues "$glb" "$avant" 1800x1000
node "$ici/temoins.cjs" "$t/visages.png" visages "$glb" "" 1800x900
node "$ici/temoins.cjs" "$t/zoom1.png" zoom1 "$glb" "$avant" 1366x768
font="DejaVu-Sans"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }
titre 1800 60 20 "Témoins dans Three.js (Chromium): en haut avant, en bas après; Colette, Firmin, joueur; de face, de trois quarts, de dos" h.png
convert "$t/h.png" "$t/vues.png" -append -quality 90 "$out/threejs-avant-apres.webp"
titre 1800 60 20 "Visages dans Three.js: neutre, contente, ravie, fatiguée, affamée, yeux fermés" h.png
convert "$t/h.png" "$t/visages.png" -append -quality 90 "$out/threejs-visages.webp"
titre 1366 50 16 "Zoom 1 (vue de 24 m à 1366 x 768): au fond avant, devant après" h.png
convert "$t/h.png" "$t/zoom1.png" -append -quality 92 "$out/threejs-zoom1.webp"
convert "$t/zoom1.png" -crop 300x170+533+275 +repage -filter point -resize 400% "$t/z4.png"
titre 1200 50 16 "Zoom 1 agrandi 4 fois (pixels du jeu): au fond avant, devant après" h.png
convert "$t/h.png" "$t/z4.png" -append -quality 92 "$out/threejs-zoom1-x4.webp"
rm -rf "$t"
ls "$out"
