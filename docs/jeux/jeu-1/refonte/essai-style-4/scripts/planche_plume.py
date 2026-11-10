"""Planche « avant / après » des traits et des plis dessinés à la plume: `comparaison-plume.png`.

Usage: python3 planche_plume.py <dossier avant> <dossier après>
Chaque dossier contient les captures de `capturer.mjs` (mêmes noms des deux côtés):
  visage-<perso>.png (vue=visage, 400 x 400), jeu-jour.png et jeu-nuit.png (vue=jeu, 900 x 520, 60 px),
  jeu-120.png (vue=jeu, px=120), proche.png (vue=proche), portraits-gaston.png (vue=portraits, 800 x 400);
  le dossier après contient en plus expressions.png (vue=expressions, cinq rangées de huit gros plans).
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

ICI = pathlib.Path(__file__).resolve().parent
AV, AP = (pathlib.Path(a) for a in sys.argv[1:3])
POLICE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 15)
GRANDE = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
L = 2000
FOND = (20, 17, 15)


def titre(d, x, y, texte, f=POLICE):
    w = d.textlength(texte, font=f)
    d.rectangle((x - 4, y - 2, x + w + 4, y + f.size + 5), fill=(20, 17, 15))
    d.text((x, y), texte, font=f, fill=(239, 230, 210))


def paire(nom, h):
    """Avant et après côte à côte, chacun sur une demi-largeur."""
    a, b = Image.open(AV / nom).convert("RGB"), Image.open(AP / nom).convert("RGB")
    w = L // 2 - 3
    a = a.resize((w, int(a.height * w / a.width)), Image.LANCZOS)
    b = b.resize((w, int(b.height * w / b.width)), Image.LANCZOS)
    im = Image.new("RGB", (L, min(h, a.height)), FOND)
    im.paste(a.crop((0, 0, w, im.height)), (0, 0))
    im.paste(b.crop((0, 0, w, im.height)), (L // 2 + 3, 0))
    return im


rangs = []
# 1. Visages de face, expression neutre: avant (rangée du haut), après (dessous).
for serie, nom in ((AV, "avant"), (AP, "après")):
    r = Image.new("RGB", (L, 400), FOND)
    for k, q in enumerate(("maelle", "basile", "gaston", "odette", "lou")):
        r.paste(Image.open(serie / f"visage-{q}.png").convert("RGB"), (k * 400, 0))
    rangs.append((r, f"{nom}: visages de face, neutre (traits {'procéduraux' if nom == 'avant' else 'dessinés à la plume'})"))
# 2. Huit expressions en gros plan, après.
ex = Image.open(AP / "expressions.png").convert("RGB")
rangs.append((ex.resize((L, int(ex.height * L / ex.width)), Image.LANCZOS),
              "après: huit expressions par personnage (neutre, joie, surprise, souci, colère douce, sommeil, parole, clin d'oeil)"))
# 3. Vues du jeu et vue proche, avant | après.
rangs.append((paire("jeu-jour.png", 580), "vue du jeu, 50 degrés, jour (personnage de 60 px): avant | après"))
rangs.append((paire("jeu-nuit.png", 580), "vue du jeu, 50 degrés, nuit: avant | après"))
rangs.append((paire("jeu-120.png", 580), "vue du jeu agrandie (120 px): avant | après"))
rangs.append((paire("proche.png", 580), "vue proche (zoom le plus serré): avant | après"))
rangs.append((paire("portraits-gaston.png", 500), "plis, coutures, poches dessinés (Gaston): avant | après"))

H = 40 + sum(r.height + 30 for r, _ in rangs)
planche = Image.new("RGB", (L, H), FOND)
d = ImageDraw.Draw(planche)
titre(d, 10, 8, "Essai 4, traits du visage et plis des vêtements dessinés à la plume: avant | après", GRANDE)
y = 40
for r, t in rangs:
    titre(d, 8, y + 4, t)
    planche.paste(r, (0, y + 26))
    y += r.height + 30
planche.save(ICI.parent / "comparaison-plume.png", optimize=True)
print("PLANCHE", planche.size)
