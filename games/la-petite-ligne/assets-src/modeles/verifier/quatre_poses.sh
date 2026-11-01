#!/usr/bin/env bash
# Quatre angles d'une bête de faune.glb sur une image de plusieurs clips, une planche par pose.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_poses.sh <dossier> <nœud> <clip:image> [...]
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
noeud="$2"
shift 2
tmp="$(mktemp -d)"
cd "$ici"
for pose in "$@"; do
  nom="${pose/:/-}"
  duo-python verifier/quatre_angles.py faune.glb "$noeud" "$tmp/$nom.png" --pose "$pose" --marge 1.4 > /dev/null 2>&1
  duo-python verifier/assembler_quatre.py "$tmp/$nom" "$sortie/modeles-4angles-$noeud-$nom.png" "$noeud ($pose)"
done
rm -rf "$tmp"
