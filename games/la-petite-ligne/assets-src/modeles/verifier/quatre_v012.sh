#!/usr/bin/env bash
# Quatre angles (Cycles, GLB exporté) des modèles du lot L-rendu-modèles de la 0.12, une planche WebP par modèle.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_v012.sh <dossier de sortie> [nœud ...]
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
shift
tmp="$(mktemp -d)"
cd "$ici"
fichier_de() {
  case "$1" in
    hen) echo ferme.glb ;;
    market_*|blackberry_jam|jar|mail_bag) echo marche.glb ;;
    *) echo elevage.glb ;;
  esac
}
noeuds=("$@")
if [[ ${#noeuds[@]} -eq 0 ]]; then
  noeuds=(goat_shed henhouse_extended hen_feeder_hopper goat_stake market_stall market_stall_stored market_hall
          market_scale market_crate mail_bag egg_basket milk_can fresh_cheese blackberry_jam)
fi
for n in "${noeuds[@]}"; do
  f="$(fichier_de "$n")"
  extra=()
  if [[ "$n" == "goat" ]]; then extra=(--pose goat_milk_stand:0); fi
  duo-python verifier/quatre_angles.py "$f" "$n" "$tmp/$n.png" "${extra[@]}" > /dev/null 2>&1
  duo-python verifier/assembler_quatre.py "$tmp/$n" "$tmp/$n-4.png" "$n ($f)" > /dev/null
  duo-python -c "from PIL import Image; import sys; Image.open(sys.argv[1]).save(sys.argv[2], quality=82)" \
    "$tmp/$n-4.png" "$sortie/quatre-$n.webp"
  echo "$sortie/quatre-$n.webp"
done
rm -rf "$tmp"
