#!/usr/bin/env bash
# Planches de contrôle du tour 10: quatre angles de chaque nouveau nœud (dehors), vue d'intérieur des bâtiments
# visitables (toit et murs côté caméra coupés, comme en jeu), assemblées deux par deux.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_tour10.sh <dossier> [bourg|maison|tout]
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:?dossier de sortie}"
quoi="${2:-tout}"
mkdir -p "$out"
cd "$ici"

quatre() {  # fichier nœud [options de vue_interieur.py]
  local f="$1" n="$2"
  shift 2
  duo-python verifier/vue_interieur.py "$f" "$n" "$out/$n.png" --entier 1 --elevation 30 --res 700x560 "$@" > /dev/null
  montage "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png" -tile 4x1 -geometry +2+2 "$out/modeles-$n.png"
  rm -f "$out/$n-0.png" "$out/$n-1.png" "$out/$n-2.png" "$out/$n-3.png"
}

dedans() {  # fichier nœud
  local f="$1" n="$2"
  shift 2
  duo-python verifier/vue_interieur.py "$f" "$n" "$out/$n-in.png" --res 800x640 "$@" > /dev/null
  montage "$out/$n-in-0.png" "$out/$n-in-1.png" "$out/$n-in-2.png" "$out/$n-in-3.png" -tile 2x2 -geometry +2+2 \
    "$out/modeles-$n-interieur.png"
  rm -f "$out/$n-in-0.png" "$out/$n-in-1.png" "$out/$n-in-2.png" "$out/$n-in-3.png"
}

if [[ "$quoi" == "bourg" || "$quoi" == "tout" ]]; then
  for n in ferrand_shop haberdashery bakery lucie_house school; do quatre bourg.glb "$n"; done
  for n in culvert street_bridge footbridge ford_stones; do quatre bourg.glb "$n" --marge 1.3; done
  dedans bourg.glb ferrand_shop
  dedans bourg.glb haberdashery
fi
ls "$out"/modeles-*.png
