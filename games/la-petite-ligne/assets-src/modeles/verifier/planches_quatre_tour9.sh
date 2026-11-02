#!/usr/bin/env bash
# Assemble les planches de quatre vues du tour 9 (sorties de quatre_tour9.sh) en trois planches réduites.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/planches_quatre_tour9.sh <dossier des vues> <dossier de sortie>
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
vues="$(cd "$1" && pwd)"
sortie="$(mkdir -p "$2" && cd "$2" && pwd)"
cd "$ici"
v="$vues/modeles-4angles"
duo-python verifier/assembler_planche.py "$sortie/modeles-4angles-chantiers.png" 700 3 \
  "Chantiers, puits, manivelle, sureau, poulailler: quatre angles (GLB exporté)" \
  "$v-ford_bench.png" "$v-house_bench.png" "$v-quay_planter.png" "$v-well.png" "$v-well_roof.png" \
  "$v-door_canopy.png" "$v-level_crossing_crank.png" "$v-bush_elder.png" "$v-henhouse_repaired.png"
duo-python verifier/assembler_planche.py "$sortie/modeles-4angles-objets.png" 560 4 \
  "Outils, cage, cueillettes: quatre angles (GLB exporté)" \
  "$v-watering_can_copper.png" "$v-watering_can.png" "$v-axe_forged.png" "$v-fishing_rod_bamboo.png" \
  "$v-lamp_pole.png" "$v-hen_crate.png" "$v-cep.png" "$v-elderberry.png" "$v-blackberry.png" "$v-hazelnut.png"
duo-python verifier/assembler_planche.py "$sortie/modeles-4angles-maison.png" 560 4 \
  "Maison et cadeaux: quatre angles (GLB exporté)" \
  "$v-straw_hat.png" "$v-pressed_flowers.png" "$v-coop_calendar.png" "$v-wall_clock.png" "$v-autumn_wreath.png" \
  "$v-jeanne_drawing.png" "$v-wicker_armchair.png" "$v-chalk_box.png" "$v-coffee_mill.png" "$v-elder_jelly.png" \
  "$v-wool_scarf.png" "$v-leather_apron.png"
