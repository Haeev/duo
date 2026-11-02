#!/usr/bin/env bash
# Quatre angles de chaque modèle du tour 9, une planche par modèle (GLB exportés).
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_tour9.sh <dossier de sortie> [nœud ...]
# Sans nœud: tous les modèles du tour 9 (faune à sa pose de repos; voir planche_tour9.py pour les clips).
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
shift
tmp="$(mktemp -d)"
cd "$ici"
fichier_de() {
  case "$1" in
    watering_can|watering_can_copper|axe_forged|fishing_rod_bamboo|lamp_pole|hen_crate|cep|elderberry|blackberry|hazelnut) echo ferme.glb ;;
    straw_hat|pressed_flowers|coop_calendar|wall_clock|autumn_wreath|jeanne_drawing|wicker_armchair|chalk_box|coffee_mill|elder_jelly|leather_apron|wool_scarf) echo maison.glb ;;
    barn_owl|vole) echo faune.glb ;;
    *) echo bourg.glb ;;
  esac
}
noeuds=("$@")
if [[ ${#noeuds[@]} -eq 0 ]]; then
  noeuds=(ford_bench house_bench quay_planter well well_roof door_canopy level_crossing_crank bush_elder henhouse
          watering_can_copper axe_forged fishing_rod_bamboo lamp_pole hen_crate cep elderberry blackberry hazelnut
          straw_hat pressed_flowers coop_calendar wall_clock autumn_wreath jeanne_drawing wicker_armchair chalk_box
          coffee_mill elder_jelly wool_scarf barn_owl vole)
fi
for n in "${noeuds[@]}"; do
  f="$(fichier_de "$n")"
  duo-python verifier/quatre_angles.py "$f" "$n" "$tmp/$n.png" --marge 1.4 > /dev/null 2>&1
  duo-python verifier/assembler_quatre.py "$tmp/$n" "$sortie/modeles-4angles-$n.png" "$n"
done
rm -rf "$tmp"
