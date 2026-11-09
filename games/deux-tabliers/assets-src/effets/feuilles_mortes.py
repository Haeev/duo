"""Feuilles mortes entrées sous la porte (A6 de la démo v0.3): `feuilles_mortes.png`, 512 x 256, RGBA.

Lancer: `duo-python games/deux-tabliers/assets-src/effets/feuilles_mortes.py` (Pillow, numpy; 2 s).

Huit feuilles de tilleul (l'arbre de la place du Tilleul, juste devant la porte), une par case de 128 px,
pointe vers le haut de la case, pétiole vers le bas: limbe en cœur large un peu dissymétrique, bord finement denté, nervure médiane
et nervures secondaires, tons d'automne du jaune paille au brun, bords plus sombres là où la feuille
sèche. Alpha en découpe (seuil 0,5 dans le jeu). Une graine fixe: le fichier se régénère à l'identique.
"""

import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.normpath(os.path.join(ICI, "..", "..", "assets", "modeles", "textures", "feuilles_mortes.png"))

CASE = 128
SUR = 4  # suréchantillonnage du tracé
TEINTES = ["#C99A3A", "#B7822F", "#9C6A2E", "#C2A452", "#8E5B2F", "#B48A3E", "#A7743A", "#D0AE5A"]


def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def contour(rng):
    """Limbe de tilleul, pointe en haut, échancrure en bas: points en unités de case et échancrure."""
    pts = []
    asym = rng.uniform(0.86, 0.95)
    dents = rng.integers(34, 44)
    for k in range(240):
        t = 2 * math.pi * k / 240
        # Cœur adouci vers l'ovale (lobes de la base peu marqués), pointe effilée (acuminée).
        x = 0.45 * 16 * math.sin(t) ** 3 + 0.55 * 14 * math.sin(t)
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        y -= 5.0 * max(0.0, -math.cos(t)) ** 10
        # Échancrure peu profonde à la base.
        y += 4.5 * max(0.0, math.cos(t)) ** 6
        r = 1 + 0.025 * ((k * dents / 240) % 1.0 - 0.5)
        x *= r * (asym if x < 0 else 1.0)
        y *= r
        pts.append((x, y))
    p = np.array(pts)
    centre = (p.max(0) + p.min(0)) / 2
    taille = (p.max(0) - p.min(0)).max()
    p = (p - centre) / taille * 0.80
    return p, p[0]


def feuille(rng, teinte):
    n = CASE * SUR
    p, creux = contour(rng)
    poly = [((x + 0.5) * n, (y + 0.45) * n) for x, y in p]
    masque = Image.new("L", (n, n), 0)
    ImageDraw.Draw(masque).polygon(poly, fill=255)
    m = np.asarray(masque, float) / 255
    # Couleur: teinte, taches de sèche, bords bruns.
    base = rgb(teinte)
    yy, xx = np.mgrid[0:n, 0:n] / n
    tache = np.zeros((n, n))
    for _ in range(rng.integers(2, 6)):
        cx, cy, rr = rng.uniform(0.25, 0.75), rng.uniform(0.2, 0.8), rng.uniform(0.04, 0.12)
        tache = np.maximum(tache, np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * rr * rr)))
    bord = 1 - np.asarray(masque.filter(ImageFilter.GaussianBlur(SUR * 4)), float) / 255
    sombre = np.clip(0.3 * tache + 1.4 * bord * m, 0, 1)
    col = base[None, None, :] * (1 - 0.45 * sombre[..., None])
    # Nervures: médiane et six secondaires, un peu plus claires que le limbe.
    nerv = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(nerv)
    base_y, pointe_y = 0.45 + creux[1], 0.45 + p[:, 1].min()
    d.line([(0.5 * n, base_y * n), (0.5 * n, pointe_y * n)], fill=255, width=3 * SUR // 2)
    for i in range(6):
        cote = -1 if i % 2 == 0 else 1
        y0 = base_y - (base_y - pointe_y) * (0.05 + 0.16 * (i // 2))
        d.line([(0.5 * n, y0 * n), ((0.5 + cote * 0.26) * n, (y0 - 0.2) * n)], fill=150, width=SUR)
    v = np.asarray(nerv.filter(ImageFilter.GaussianBlur(SUR / 2)), float) / 255
    col = col * (1 - 0.25 * v[..., None]) + 0.25 * v[..., None] * np.clip(base * 1.25, 0, 1)
    # Pétiole qui dépasse sous l'échancrure.
    tige = Image.new("L", (n, n), 0)
    ImageDraw.Draw(tige).line([(0.5 * n, (base_y - 0.02) * n), ((0.5 + rng.uniform(-0.04, 0.04)) * n, (base_y + 0.13) * n)], fill=255, width=2 * SUR)
    t = np.asarray(tige, float) / 255
    col = col * (1 - t[..., None]) + t[..., None] * base * 0.55
    a = np.clip(m + t, 0, 1)
    img = np.dstack([np.clip(col, 0, 1), a])
    out = Image.fromarray(np.round(img * 255).astype(np.uint8), "RGBA")
    return out.resize((CASE, CASE), Image.LANCZOS)


def main():
    rng = np.random.default_rng(23)
    atlas = Image.new("RGBA", (CASE * 4, CASE * 2), (0, 0, 0, 0))
    for i, teinte in enumerate(TEINTES):
        atlas.paste(feuille(rng, teinte), ((i % 4) * CASE, (i // 4) * CASE))
    # Couleur des pixels transparents: celle de la feuille voisine (pas de liseré sombre aux mipmaps).
    arr = np.asarray(atlas, float) / 255
    a = arr[..., 3:4]
    flou = np.asarray(atlas.filter(ImageFilter.GaussianBlur(3)), float) / 255
    fa = np.maximum(flou[..., 3:4], 1e-4)
    arr[..., :3] = np.where(a > 0.02, arr[..., :3], flou[..., :3] / fa)
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    Image.fromarray(np.round(np.clip(arr, 0, 1) * 255).astype(np.uint8), "RGBA").save(SORTIE, optimize=True)
    print(SORTIE, os.path.getsize(SORTIE) // 1024, "Kio")


if __name__ == "__main__":
    main()
