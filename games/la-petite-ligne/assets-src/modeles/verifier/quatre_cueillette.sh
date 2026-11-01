#!/usr/bin/env bash
# Quatre angles de chaque modèle de cueillette et de lisière du tour 8, assemblés en une planche par modèle.
#   bash games/la-petite-ligne/assets-src/modeles/verifier/quatre_cueillette.sh <dossier de sortie> [nœud ...]
# Sans nœud: les huit modèles du tour 8 (objets de ferme.glb, décor de bourg.glb).
set -euo pipefail
ici="$(cd "$(dirname "$0")/.." && pwd)"
sortie="$(mkdir -p "$1" && cd "$1" && pwd)"
shift
tmp="$(mktemp -d)"
cd "$ici"
rendre() {   # fichier nœud
  duo-python verifier/quatre_angles.py "$1" "$2" "$tmp/$2.png" --marge 1.5 > /dev/null 2>&1
  duo-python - "$tmp/$2" "$sortie/objets-4angles-$2.png" "$2" <<'EOF'
import os
import sys
from PIL import Image, ImageDraw, ImageFont
pre, out, title = sys.argv[1:4]
ttf = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
police = ImageFont.truetype(ttf, 16) if os.path.exists(ttf) else ImageFont.load_default(16)
ims = [Image.open(f"{pre}-{i}.png") for i in range(4)]
w, h = ims[0].size
img = Image.new("RGB", (w * 2, h * 2 + 30), (245, 243, 238))
d = ImageDraw.Draw(img)
d.text((8, 8), f"{title}: azimuts 45, 135, 225, 315, élévation 30 (GLB exporté)", fill=(20, 20, 20), font=police)
for i, im in enumerate(ims):
    img.paste(im, ((i % 2) * w, 30 + (i // 2) * h))
img.save(out)
print(out)
EOF
}
fichier_de() {
  case "$1" in
    wild_garlic|chanterelle|blackberry|hazelnut) echo ferme.glb ;;
    *) echo bourg.glb ;;
  esac
}
noeuds=("$@")
if [[ ${#noeuds[@]} -eq 0 ]]; then
  noeuds=(wild_garlic chanterelle blackberry hazelnut bramble bush_hazel oak_sapling fir_sapling)
fi
for n in "${noeuds[@]}"; do
  rendre "$(fichier_de "$n")" "$n"
done
rm -rf "$tmp"
