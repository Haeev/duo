#!/usr/bin/env bash
# Reconstruit tous les modèles de La Petite Ligne, du script Blender au GLB livré.
#   bash games/la-petite-ligne/assets-src/modeles/construire.sh [--sans-planches]
# Prérequis: duo-python (bash outils/installer-outils.sh), Node 22 et npm (npx télécharge gltf-transform).
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
cd "$ici"

for script in personnages.py ferme.py bourg.py train.py maison.py; do
  echo "== $script"
  duo-python "$script" > /dev/null
done

# Optimisation sans perte visible: dédoublonnage, soudure, nettoyage (en gardant les nœuds vides
# qui servent de repères: prises des mains, panache, lumière de la lampe), quantification.
# personnages.glb reste tel qu'exporté: la quantification y densifierait les clés de forme (plus lourd).
tmp="$(mktemp -d)"
for f in bourg ferme train maison; do
  $gt dedup "$sortie/$f.glb" "$tmp/$f.1.glb" > /dev/null
  $gt weld "$tmp/$f.1.glb" "$tmp/$f.2.glb" > /dev/null
  $gt prune --keep-leaves true "$tmp/$f.2.glb" "$tmp/$f.3.glb" > /dev/null
  $gt quantize "$tmp/$f.3.glb" "$sortie/$f.glb" > /dev/null
done
rm -rf "$tmp"
ls -l "$sortie"/*.glb

if [[ "${1:-}" != "--sans-planches" ]]; then
  duo-python rendus_personnages.py tout > /dev/null
  duo-python scene_bourg.py > /dev/null
  (cd "$ici/../../../.." && node games/la-petite-ligne/assets-src/modeles/verifier/verifier.cjs)
fi
