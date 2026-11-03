#!/usr/bin/env bash
# Reconstruit les GLB touchés par le lot L-rendu-modèles de la 0.12 (ferme: robes des poules, coq, poussin;
# elevage: chèvre, chevrerie, poulailler agrandi...; marche: étal, halle...), avec le même nettoyage que
# construire.sh (dédoublonnage, soudure, élagage en gardant les repères).
#   bash games/la-petite-ligne/assets-src/modeles/verifier/construire_v012.sh [ferme elevage marche]
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$ici/../../assets/modeles"
gt="npx --yes @gltf-transform/cli@4.5.1"
cd "$ici"
export LPL_SANS_PLANCHES=1
noms=("$@")
if [[ ${#noms[@]} -eq 0 ]]; then noms=(ferme elevage marche); fi
tmp="$(mktemp -d)"
for f in "${noms[@]}"; do
  echo "== $f.py"
  duo-python "$f.py" > "$tmp/$f.log" 2>&1 || { tail -30 "$tmp/$f.log"; exit 1; }
  grep -E "^(FERME|ELEVAGE|MARCHE)" "$tmp/$f.log" || true
  $gt dedup "$sortie/$f.glb" "$tmp/$f.1.glb" > /dev/null
  $gt weld "$tmp/$f.1.glb" "$tmp/$f.2.glb" > /dev/null
  $gt prune --keep-leaves true "$tmp/$f.2.glb" "$sortie/$f.glb" > /dev/null
  ls -l "$sortie/$f.glb"
done
rm -rf "$tmp"
