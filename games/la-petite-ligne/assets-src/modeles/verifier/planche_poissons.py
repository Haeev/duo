"""Assemble les rendus de poissons.py en planches WebP pour la revue (docs/jeux/jeu-1/gauntlet/captures/v0-12/).

Lancer: duo-python verifier/planche_poissons.py   (après duo-python poissons.py)
- poissons.webp: de près, profil gauche puis dos (chaque poisson ramené à la même longueur);
- poissons-echelle.webp: taille réelle à côté du mannequin de 1,80 m, avec l'épuisette.
"""
import os
import tempfile

from PIL import Image, ImageDraw, ImageFont

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(tempfile.gettempdir(), "lpl-poissons")  # rendus bruts de poissons.py, hors du dépôt
OUT = os.path.normpath(os.path.join(ICI, "..", "..", "..", "..", "..", "docs", "jeux", "jeu-1", "gauntlet",
                                    "captures", "v0-12"))
TTF = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
police = ImageFont.truetype(TTF, 26) if os.path.exists(TTF) else ImageFont.load_default(26)


def titled(im, title):
    out = Image.new("RGB", (im.width, im.height + 44), (245, 243, 238))
    ImageDraw.Draw(out).text((14, 8), title, fill=(20, 20, 20), font=police)
    out.paste(im, (0, 44))
    return out


os.makedirs(OUT, exist_ok=True)
a = Image.open(os.path.join(SRC, "profil.png")).convert("RGB")
b = Image.open(os.path.join(SRC, "dessus.png")).convert("RGB")
a = titled(a, "Poissons 0.12, de près: profil gauche (chacun ramené à la même longueur)")
b = titled(b, "Même ordre, roulés de 60 degrés: le dos")
sheet = Image.new("RGB", (a.width, a.height + b.height), (245, 243, 238))
sheet.paste(a, (0, 0))
sheet.paste(b, (0, a.height))
sheet.save(os.path.join(OUT, "poissons.webp"), quality=88, method=6)
e = Image.open(os.path.join(SRC, "echelle.png")).convert("RGB")
e = titled(e, "Taille réelle (longueur médiane), mannequin de 1,80 m, épuisette")
e.save(os.path.join(OUT, "poissons-echelle.webp"), quality=88, method=6)
print(OUT)
