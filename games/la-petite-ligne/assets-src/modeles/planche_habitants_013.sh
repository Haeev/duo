#!/usr/bin/env bash
# Assemble les planches des habitants de la 0.13 (rendus de planche_habitants_013.py), en webp.
#   bash planche_habitants_013.sh <dossier des rendus> <dossier de sortie>
# Une planche par habitant (de face, de dos, de profil, en buste, expressions), la rangée des 21 habitants avec le
# mannequin de 1,80 m, les accessoires en main et le chat (rendus de verifier/planche_chat.py).
set -euo pipefail
r="$1"
out="$(mkdir -p "$2" && cd "$2" && pwd)"
ici="$(cd "$(dirname "$0")" && pwd)"
font="DejaVu-Sans"
t="$(mktemp -d)"
titre() { convert -size "$1"x"$2" xc:'#F4EFE6' -font "$font" -pointsize "$3" -fill '#2B2A33' -gravity center -annotate +0+0 "$4" "$t/$5"; }
tri() { python3 -c "import json,sys; print(json.load(open(sys.argv[1]))['meshes'][sys.argv[2]])" "$ici/stats/personnages.json" "$1"; }
echelle() { python3 -c "import sys; sys.path.insert(0, sys.argv[1]); import ast; src=open(sys.argv[1]+'/habitants_013.py').read(); i=src.index('SCALES = '); d=ast.literal_eval(src[i+9:src.index('}', i)+1]); print(str(d[sys.argv[2]]).replace('.', ','))" "$ici" "$1"; }
declare -A NOM=(
  [armand]="Armand Castagné, instituteur" [berthe]="Berthe Lavergne, meunière" [martial]="Martial Roques, curé"
  [marthe]="Marthe Bousquet, sacristine et sonneuse" [honorine]="Honorine Valade, la doyenne"
  [ines]="Inès Garrigue, garde forestière" [barnabe]="Barnabé Tixier, bûcheron et charbonnier"
  [mado]="Madeleine « Mado » Cazals, forgeronne" [paulin]="Paulin Delmas, cultivateur"
  [margot]="Margot Delmas, cultivatrice" [leon]="Léon Delmas, écolier"
  [ambroise]="Ambroise Pélissier, horloger et cordonnier" [nour]="Nour Belkacem, vétérinaire"
  [colette]="Colette Lafon, cafetière"
)
for n in armand berthe martial marthe honorine ines barnabe mado paulin margot leon ambroise nour colette; do
  [[ -f "$r/${n}_face.png" ]] || continue
  extra=""
  [[ "$n" == "ambroise" ]] && extra=", loupe relevée (à l'oeil: dernière vignette)"
  titre 1140 64 18 "${NOM[$n]}: villager_$n, $(tri villager_$n) triangles, échelle $(echelle $n)$extra" h.png
  titre 1140 34 13 "De face, de dos, de profil (caméra du jeu, mannequin de 1,80 m); buste de face et de trois quarts; contente, ravie, fatiguée, affamée, yeux fermés" h2.png
  convert "$r/${n}_face.png" "$r/${n}_dos.png" "$r/${n}_profil.png" +append "$t/a.png"
  convert "$r/${n}_buste.png" "$r/${n}_buste34.png" -resize 570x570 +append "$t/b.png"
  ex=""
  for e in happy delighted tired hungry blink; do ex="$ex $r/${n}_expr_$e.png"; done
  [[ -f "$r/${n}_loupe.png" ]] && ex="$ex $r/${n}_loupe.png"
  convert $ex +append -resize 1140x "$t/c.png"
  convert "$t/h.png" "$t/h2.png" "$t/a.png" "$t/b.png" "$t/c.png" -append -quality 88 "$out/habitant-$n.webp"
done
if [[ -f "$r/rangee.png" ]]; then
  titre 2400 60 24 "Les 21 habitants à leur échelle (du plus petit au plus grand), mannequin de 1,80 m à droite" h.png
  convert "$t/h.png" "$r/rangee.png" -append -quality 88 "$out/rangee-21-habitants.webp"
fi
acc=( "$r"/acc_*.png )
if [[ -f "${acc[0]}" ]]; then
  titre 2300 60 22 "Accessoires: vélos de Lucie, de l'abbé et de Nour poussés (push_bike, push_bike_idle), cartable, pot à lait, hache, accordéon" h.png
  convert "${acc[@]:0:5}" +append "$t/a.png"
  convert "${acc[@]:5}" +append -background '#A7B98A' -gravity west -extent 2300x460 "$t/b.png"
  convert "$t/h.png" "$t/a.png" "$t/b.png" -append -quality 88 "$out/accessoires.webp"
fi
if [[ -f "$r/chat_tete.png" ]]; then
  w=2400
  rows=""
  for c in idle walk sleep roll; do
    convert "$r"/chat_cat_${c}_*.png +append -background '#ABA498' -gravity west -extent "${w}x260" "$t/row_$c.png"
    rows="$rows $t/row_$c.png"
  done
  titre "$w" 60 22 "Le chat du bourg (faune.glb, cat), une rangée par clip: cat_idle, cat_walk, cat_sleep, cat_roll (deux angles par image); de près et à côté du mannequin de 1,80 m" h.png
  convert "$r/chat_tete.png" "$r/chat_echelle.png" -resize x340 +append -background '#ABA498' -gravity west -extent "${w}x340" "$t/c.png"
  convert "$t/h.png" $rows "$t/c.png" -append -quality 88 "$out/chat.webp"
fi
rm -rf "$t"
ls "$out"
