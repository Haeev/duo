#!/usr/bin/env bash
# Quatre angles de près (Cycles, GLB exporté) des modèles de foret013.glb, une planche par modèle.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_foret013.sh <dossier de sortie> [nœud ...]
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
shift
tmp="$(mktemp -d)"
cd "$ici"
noeuds=("$@")
if [[ ${#noeuds[@]} -eq 0 ]]; then
  noeuds=(crossing_sign hand_pump cemetery_tap cemetery_cross oratory vine_row anvil cafe_table water_trough
          manure_heap fallen_trunk postcard_rack)
fi
for n in "${noeuds[@]}"; do
  duo-python verifier/quatre_angles.py foret013.glb "$n" "$tmp/$n.png" --marge 1.3 > /dev/null 2>&1
  duo-python verifier/assembler_quatre.py "$tmp/$n" "$sortie/quatre-$n.png" "$n (foret013.glb)" > /dev/null
  echo "$sortie/quatre-$n.png"
done
rm -rf "$tmp"
