#!/usr/bin/env bash
# Nettoyage sans perte (même chaîne que construire.sh) des fichiers touchés au tour 10: bourg, ferme, maison.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/nettoyer_tour10.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
tmp="$(mktemp -d)"
for f in bourg ferme maison; do
  $gt dedup "$sortie/$f.glb" "$tmp/$f.1.glb" > /dev/null
  $gt weld "$tmp/$f.1.glb" "$tmp/$f.2.glb" > /dev/null
  $gt prune --keep-leaves true "$tmp/$f.2.glb" "$sortie/$f.glb" > /dev/null
done
rm -rf "$tmp"
ls -l "$sortie"/*.glb
