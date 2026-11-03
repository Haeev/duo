#!/usr/bin/env bash
# Assemble les planches Cycles des témoins (rendus de planche_temoins.py, modes vues et visages), en webp.
#   bash planche_temoins.sh <dossier des rendus> <dossier de sortie>
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }
rangee() {
  local tag="$1" f=""
  for w in colette firmin joueur; do for v in face troisquarts dos; do f="$f $r/${tag}_${w}_${v}.png"; done; done
  convert $f +append "$t/$tag.png"
}
rangee avant
rangee apres
w=$(identify -format "%w" "$t/apres.png")
titre "$w" 64 22 "Témoins de la qualité visuelle (Cycles, caméra du jeu, mannequin de 1,80 m): Colette, Firmin, joueur habillé; de face, de trois quarts, de dos" h.png
titre "$w" 40 18 "Avant (0.12.2)" a.png
titre "$w" 40 18 "Après: tête lisse et visage peint, mèches, tissus et plis peints, gabarits rond et trapu, pose de repos propre à chacun" b.png
convert "$t/h.png" "$t/a.png" "$t/avant.png" "$t/b.png" "$t/apres.png" -append -quality 88 "$out/cycles-avant-apres.webp"
for who in colette firmin joueur; do
  f=""
  for e in neutral happy delighted tired hungry blink; do f="$f $r/apres_visage_${who}_${e}.png"; done
  convert "$r/avant_visage_${who}_neutral.png" $f +append "$t/v_$who.png"
  convert "$r/avant_buste_${who}.png" "$r/apres_buste_${who}.png" +append "$t/b_$who.png"
done
w=$(identify -format "%w" "$t/v_colette.png")
titre "$w" 60 20 "Gros plans (Cycles): avant, puis après en six expressions (neutre, contente, ravie, fatiguée, affamée, yeux fermés)" h.png
convert "$t/h.png" "$t/v_colette.png" "$t/v_firmin.png" "$t/v_joueur.png" -append -quality 90 "$out/cycles-visages.webp"
convert "$t/b_colette.png" "$t/b_firmin.png" "$t/b_joueur.png" +append "$t/bustes.png"
w=$(identify -format "%w" "$t/bustes.png")
titre "$w" 60 20 "Bustes (Cycles, caméra du jeu): pour chacun, avant puis après" h.png
convert "$t/h.png" "$t/bustes.png" -append -quality 90 "$out/cycles-bustes.webp"
rm -rf "$t"
ls "$out"
