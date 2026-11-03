#!/usr/bin/env bash
# Nettoyage sans perte de foret013.glb (dédoublonnage, soudure, élagage), comme construire.sh, sans reconstruire
# les autres GLB.   bash games/la-petite-ligne/assets-src/modeles/verifier/nettoyer_foret013.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
tmp="$(mktemp -d)"
$gt dedup "$sortie/foret013.glb" "$tmp/f.1.glb" > /dev/null
$gt weld "$tmp/f.1.glb" "$tmp/f.2.glb" > /dev/null
$gt prune --keep-leaves true "$tmp/f.2.glb" "$sortie/foret013.glb" > /dev/null
rm -rf "$tmp"
ls -l "$sortie/foret013.glb"
