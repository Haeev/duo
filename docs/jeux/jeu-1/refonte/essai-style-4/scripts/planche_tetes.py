"""Planche « avant / après » de la refonte des têtes et des mains: `comparaison-tetes.png`.

Usage: python3 planche_tetes.py <dossier avant> <dossier après>
Captures de `capturer.mjs` (mêmes noms des deux côtés), faites par:
  vue=tetes (2000 x 840), vue=expressions&qui=maelle|gaston&liste=neutre,joie,surprise,souci,colere,sommeil,
  parole,clin (2000 x 300), vue=proche (1200 x 700), vue=jeu&px=60 et &amb=nuit (900 x 520), vue=poses (1500 x 1500).
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ICI = pathlib.Path(__file__).resolve().parent
AV, AP = (pathlib.Path(a) for a in sys.argv[1:3])
POLICE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
GRANDE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
L = 1400
FOND = (20, 17, 15)


def titre(d, x, y, texte, f=POLICE):
    w = d.textlength(texte, font=f)
    d.rectangle((x - 4, y - 2, x + w + 4, y + f.size + 5), fill=FOND)
    d.text((x, y), texte, font=f, fill=(239, 230, 210))


def large(im):
    return im.convert("RGB").resize((L, round(im.height * L / im.width)), Image.LANCZOS)


def paire(nom):
    a, b = Image.open(AV / nom).convert("RGB"), Image.open(AP / nom).convert("RGB")
    w = L // 2 - 3
    a = a.resize((w, round(a.height * w / a.width)), Image.LANCZOS)
    b = b.resize((w, round(b.height * w / b.width)), Image.LANCZOS)
    im = Image.new("RGB", (L, max(a.height, b.height)), FOND)
    im.paste(a, (0, 0))
    im.paste(b, (L // 2 + 3, 0))
    return im


rangs = [
    (large(Image.open(AV / "tetes.png")), "AVANT: visages neutres, de face et de trois quarts (modelé Meshy réduit, coque sur tout le visage)"),
    (large(Image.open(AP / "tetes.png")), "APRÈS: masque du visage lissé, nez simple, sans lèvres; normales imposées; aucune coque dans le visage"),
]
for qui in ("maelle", "gaston"):
    rangs.append((large(Image.open(AV / f"expr-{qui}.png")), f"avant: huit expressions ({qui})"))
    rangs.append((large(Image.open(AP / f"expr-{qui}.png")), f"après: huit expressions ({qui})"))
rangs += [
    (paire("proche.png"), "vue proche du jeu (zoom le plus serré): avant | après"),
    (paire("jeu-jour.png"), "vue du jeu, 50 degrés, jour (personnage de 60 px): avant | après"),
    (paire("jeu-nuit.png"), "vue du jeu, 50 degrés, nuit: avant | après"),
    (paire("poses.png"), "repos (0, 1,2 et 2,4 s du clip de 3,5 s) et marche (0, 0,17 et 0,34 s): avant (repos figé) | après (repos animé, moufles)"),
]
H = 40 + sum(r.height + 30 for r, _ in rangs)
planche = Image.new("RGB", (L, H), FOND)
d = ImageDraw.Draw(planche)
titre(d, 10, 8, "Essai 4, têtes refaites pour le visage dessiné à la plume: avant | après", GRANDE)
y = 40
for r, t in rangs:
    titre(d, 8, y + 4, t)
    planche.paste(r, (0, y + 26))
    y += r.height + 30
# RGB plein: une palette de 256 couleurs fait des bandes sur les dégradés de la vignette.
planche.save(ICI.parent / "comparaison-tetes.png", optimize=True)
print("PLANCHE", planche.size)
