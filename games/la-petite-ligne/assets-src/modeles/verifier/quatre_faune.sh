#!/usr/bin/env bash
# Quatre angles de chaque modèle de faune.glb (et de la cloche du quai), assemblés en une planche par modèle.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_faune.sh <dossier de sortie> [tour7]
# Avec « tour7 »: seulement les modèles du tour 7 (chevrette, faon, martin-pêcheur, ablette, pieu).
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
tmp="$(mktemp -d)"
cd "$ici"
rendre() {   # fichier nœud [pose]
  local extra=()
  if [[ -n "${3:-}" ]]; then extra=(--pose "$3"); fi
  duo-python verifier/quatre_angles.py "$1" "$2" "$tmp/$2.png" "${extra[@]}" > /dev/null 2>&1
  duo-python - "$tmp/$2" "$sortie/faune-4angles-$2.png" "$2${3:+ ($3)}" <<'EOF'
import sys
from PIL import Image, ImageDraw
pre, out, title = sys.argv[1:4]
ims = [Image.open(f"{pre}-{i}.png") for i in range(4)]
w, h = ims[0].size
img = Image.new("RGB", (w * 2, h * 2 + 30), (245, 243, 238))
d = ImageDraw.Draw(img)
d.text((8, 8), f"{title}: azimuts 45, 135, 225, 315 (GLB exporté)", fill=(20, 20, 20))
for i, im in enumerate(ims):
    img.paste(im, ((i % 2) * w, 30 + (i // 2) * h))
img.save(out)
print(out)
EOF
}
if [[ "${2:-}" == "tour7" ]]; then
  rendre faune.glb roe_deer deer_graze:0
  rendre faune.glb fawn fawn_trot:0
  rendre faune.glb kingfisher kf_perch:0
  rendre faune.glb small_fish
  rendre faune.glb mooring_post
  rm -rf "$tmp"
  exit 0
fi
rendre faune.glb heron heron_idle:0
rendre faune.glb goose goose_swim:0
rendre faune.glb blue_tit tit_perch:0
rendre faune.glb fox fox_listen:0
rendre faune.glb ladder_wood
rendre faune.glb nest_box
rendre faune.glb oak_branch_stub
rendre faune.glb moss_tuft
rendre faune.glb roe_deer deer_graze:0
rendre faune.glb fawn fawn_trot:0
rendre faune.glb kingfisher kf_perch:0
rendre faune.glb small_fish
rendre faune.glb mooring_post
rendre bourg.glb bell_post
rm -rf "$tmp"
