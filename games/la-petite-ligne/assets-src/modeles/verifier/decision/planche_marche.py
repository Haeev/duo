"""Planche contact de la marche: images successives recadrées. planche_marche.py <préfixe> <x0,y0,x1,y1> <échelle> <colonnes> <sortie>"""
import glob
import sys
from PIL import Image

prefix, box, scale, cols, out = sys.argv[1], tuple(map(int, sys.argv[2].split(','))), float(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
files = sorted(glob.glob(f'{prefix}-*.png'))
tiles = []
for f in files:
    im = Image.open(f).convert('RGB').crop(box)
    tiles.append(im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS if scale < 1 else Image.NEAREST))
w, h = tiles[0].size
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols - 1) * 4, rows * h + (rows - 1) * 4), (243, 235, 212))
for i, t in enumerate(tiles):
    sheet.paste(t, ((i % cols) * (w + 4), (i // cols) * (h + 4)))
sheet.save(out, quality=90)
print(out, sheet.size, len(tiles))
