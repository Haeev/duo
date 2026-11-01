"""Assemble les quatre vues d'un nœud (sorties de quatre_angles.py: <préfixe>-0.png à -3.png) en une planche titrée.

Lancer: duo-python verifier/assembler_quatre.py <préfixe> <sortie.png> <titre> [légende]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

pre, out, title = sys.argv[1:4]
note = sys.argv[4] if len(sys.argv) > 4 else "azimuts 45, 135, 225, 315, élévation 30 (GLB exporté)"
ttf = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
police = ImageFont.truetype(ttf, 16) if os.path.exists(ttf) else ImageFont.load_default(16)
ims = [Image.open(f"{pre}-{i}.png").convert("RGB") for i in range(4)]
w, h = ims[0].size
img = Image.new("RGB", (w * 2, h * 2 + 30), (245, 243, 238))
d = ImageDraw.Draw(img)
d.text((8, 8), f"{title}: {note}", fill=(20, 20, 20), font=police)
for i, im in enumerate(ims):
    img.paste(im, ((i % 2) * w, 30 + (i // 2) * h))
img.save(out)
for i in range(4):
    os.remove(f"{pre}-{i}.png")
print(out)
