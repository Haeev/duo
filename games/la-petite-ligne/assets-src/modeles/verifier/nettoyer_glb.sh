#!/usr/bin/env bash
# Nettoyage sans perte d'un ou plusieurs GLB du dossier livré (même chaîne que construire.sh: dédoublonnage,
# soudure, élagage en gardant les nœuds vides de repère), après leur script Blender.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/nettoyer_glb.sh bourg maison
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
tmp="$(mktemp -d)"
for f in "$@"; do
  $gt dedup "$sortie/$f.glb" "$tmp/$f.1.glb" > /dev/null
  $gt weld "$tmp/$f.1.glb" "$tmp/$f.2.glb" > /dev/null
  $gt prune --keep-leaves true "$tmp/$f.2.glb" "$sortie/$f.glb" > /dev/null
  ls -l "$sortie/$f.glb"
done
rm -rf "$tmp"
