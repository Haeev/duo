"""Assemble plusieurs planches de quatre vues en une seule, réduite (les captures brutes restent hors du dépôt).

Lancer: duo-python verifier/assembler_planche.py <sortie.png> <largeur d'une vignette> <colonnes> <titre> <planche.png> [...]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

out, tw, cols, title = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
files = sys.argv[5:]
ttf = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
police = ImageFont.truetype(ttf, 18) if os.path.exists(ttf) else ImageFont.load_default(18)
ims = []
for f in files:
    im = Image.open(f).convert("RGB")
    ims.append(im.resize((tw, round(im.height * tw / im.width)), Image.LANCZOS))
th = max(i.height for i in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th + 36), (245, 243, 238))
ImageDraw.Draw(sheet).text((8, 8), title, fill=(20, 20, 20), font=police)
for k, im in enumerate(ims):
    sheet.paste(im, ((k % cols) * tw, 36 + (k // cols) * th))
sheet.save(out)
print(out)
