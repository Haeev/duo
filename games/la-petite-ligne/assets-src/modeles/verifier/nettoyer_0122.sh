#!/usr/bin/env bash
# 0.12.2: nettoyage sans perte de bourg.glb après reconstruction (mêmes étapes que construire.sh), sans
# reconstruire les autres GLB. Lancer: bash games/la-petite-ligne/assets-src/modeles/verifier/nettoyer_0122.sh
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
tmp="$(mktemp -d)"
$gt dedup "$sortie/bourg.glb" "$tmp/bourg.1.glb" > /dev/null
$gt weld "$tmp/bourg.1.glb" "$tmp/bourg.2.glb" > /dev/null
$gt prune --keep-leaves true "$tmp/bourg.2.glb" "$sortie/bourg.glb" > /dev/null
rm -rf "$tmp"
ls -l "$sortie/bourg.glb"
