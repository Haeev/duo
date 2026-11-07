#!/usr/bin/env bash
# Allège les GLB de l'essai après construire.py: carte de lumière (texture d'occlusion) en WebP, maillages en
# Meshopt (quantification comprise). La palette reste en PNG (cases nettes au filtrage au plus proche).
# Usage: bash optimiser.sh [chemin de gltf-transform]   (npm: @gltf-transform/cli 4)
set -euo pipefail
ici="$(cd "$(dirname "$0")" && pwd)"
gt="${1:-gltf-transform}"
tmp="$(mktemp -d)"
for v in A B; do
  src="$ici/../modeles/cafe_$v.glb"
  "$gt" webp "$src" "$tmp/w_$v.glb" --slots "occlusionTexture" --quality 90
  "$gt" meshopt "$tmp/w_$v.glb" "$src"
done
rm -rf "$tmp"
