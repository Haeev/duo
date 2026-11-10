"""Monte une planche de comparaison 1366x768 à partir de captures de la page d'essai.
Usage: duo-python monter.py sortie.png colonnes "titre=fichier.png[@cx,cy]" ...
Chaque capture est recadrée, sans retouche ni mise à l'échelle, autour de son centre ou du point
donné (en pixels de la capture)."""
import sys
from PIL import Image, ImageDraw, ImageFont

out, cols = sys.argv[1], int(sys.argv[2])
items = [a.split('=', 1) for a in sys.argv[3:]]
rows = (len(items) + cols - 1) // cols
W, H = 1366, 768
cw, ch = W // cols, H // rows
sheet = Image.new('RGB', (W, H), (35, 26, 23))
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
except OSError:
    font = ImageFont.load_default()
for i, (title, path) in enumerate(items):
    centre = None
    if '@' in path:
        path, at = path.split('@')
        centre = tuple(int(v) for v in at.split(','))
    im = Image.open(path).convert('RGB')
    cx, cy = centre or (im.width // 2, im.height // 2)
    left = min(max(cx - cw // 2, 0), im.width - cw)
    top = min(max(cy - ch // 2, 0), im.height - ch)
    crop = im.crop((left, top, left + cw, top + ch))
    x, y = (i % cols) * cw, (i // cols) * ch
    sheet.paste(crop, (x, y))
    d = ImageDraw.Draw(sheet)
    box = d.textbbox((0, 0), title, font=font)
    d.rectangle((x, y, x + box[2] + 16, y + box[3] + 12), fill=(35, 26, 23))
    d.text((x + 8, y + 5), title, fill=(243, 234, 216), font=font)
    d.rectangle((x, y, x + cw - 1, y + ch - 1), outline=(35, 26, 23), width=2)
sheet.save(out)
print(out)
