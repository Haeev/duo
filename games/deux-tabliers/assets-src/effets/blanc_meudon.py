"""Vitres au blanc de Meudon (A2 de la démo v0.3): atlas `blanc_meudon.png`, 2048 x 1024, RGBA.

Lancer: `duo-python games/deux-tabliers/assets-src/effets/blanc_meudon.py` (numpy, scipy, Pillow; 20 s).

Moitié gauche: la couche vue de la place (blanc de craie éclairé par le jour, plus sombre là où le badigeon
est mince et laisse deviner la salle). Moitié droite: la même couche vue de la salle, à contre-jour (plus
claire là où elle est mince). Même alpha dans les deux moitiés:

- alpha = ordre d'effacement à l'éponge, de 0,03 (lavé en premier) à 0,99 (lavé en dernier): rangées de
  30 cm de haut, de haut en bas, balayées en arcs dans un sens puis dans l'autre, front un peu déchiré;
  le rendu (`src/rendu/cafe-ferme.ts`) découpe ce qui est sous le seuil de la vitre;
- alpha = 0: verre nu, c'est-à-dire l'inscription tracée au doigt sur la vitrine ouest, « À LOUER » et
  « s'adresser au-dessus », lisible de la place (donc à l'envers de la salle, comme en vrai).

Les traits du doigt ont la couleur de ce qu'on voit à travers (salle sombre de la place, place claire de
la salle): de loin, quand les mipmaps mélangent l'alpha, l'inscription se lit encore à la couleur.

Cotes des vitres: `shell_village_glass` de `shell_village.glb` (plan z 12,88), identifiants du plan
`village` (`donnees/adresses/village.json`). Une graine fixe par vitre: le fichier se régénère à l'identique.
"""

import math
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ICI = os.path.dirname(os.path.abspath(__file__))
SORTIE = os.path.normpath(os.path.join(ICI, "..", "..", "assets", "modeles", "textures", "blanc_meudon.png"))

W, H = 2048, 1024
HALF = 1024

# id du plan, rectangle de verre (x0, x1, y0, y1 en mètres) et case de l'atlas (x, y, largeur, hauteur en
# pixels, dans chaque moitié). Les deux battants de la porte sont deux cases d'une même vitre.
VITRES = [
    ("window-2", (4.46, 6.34, 0.51, 2.34), (0, 0, 1024, 640), 11),
    ("window-3", (6.56, 8.44, 0.51, 2.34), (0, 640, 512, 384), 12),
    ("porte-entree", (8.95, 9.32, 0.85, 1.95), (512, 640, 128, 384), 13),
    ("porte-entree", (9.48, 9.85, 0.85, 1.95), (640, 640, 128, 384), 14),
    ("window-4", (10.26, 10.74, 0.96, 2.34), (768, 640, 256, 384), 15),
]

# Couleurs affichées (sRGB, matériau sans lumière): de la place, puis de la salle.
CRAIE_JOUR = np.array([0.90, 0.89, 0.85])
MINCE_JOUR = np.array([0.52, 0.52, 0.50])
SALLE_SOMBRE = np.array([0.16, 0.14, 0.12])
CONTRE_JOUR = np.array([0.97, 0.96, 0.92])
EPAIS_CONTRE_JOUR = np.array([0.80, 0.79, 0.76])
PLACE_CLAIRE = np.array([0.80, 0.80, 0.76])


def bruit(shape, sigma, rng):
    a = ndimage.gaussian_filter(rng.normal(0, 1, shape), sigma, mode="reflect")
    a -= a.mean()
    s = a.std()
    return a / s if s > 0 else a


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# -------------------------------------------------------------------------------------------------
# Badigeon: une première couche irrégulière, puis des coups de brosse en arcs qui se croisent.

def epaisseur(X, Y, rng, px):
    """Épaisseur du badigeon de 0 (verre nu) à 1 (couche épaisse). X, Y en mètres; px: pixels par mètre.

    Une couche nuageuse, puis des passes de brosse large en arcs (le geste du poignet), aux bords doux,
    striées par les poils (bruit d'une dimension en travers du trait, pas une sinusoïde régulière) et
    de plus en plus maigres à mesure que la brosse se vide.
    """
    T = 0.66 + 0.09 * bruit(X.shape, 0.15 * px, rng) + 0.04 * bruit(X.shape, 0.04 * px, rng)
    aire = (X.max() - X.min()) * (Y.max() - Y.min())
    n = int(30 * aire) + 5
    for _ in range(n):
        R = rng.uniform(0.3, 0.8)
        cx = rng.uniform(X.min() - 0.3, X.max() + 0.3)
        cy = rng.uniform(Y.min() - 0.3, Y.max() + 0.3)
        a0 = rng.uniform(0, 2 * math.pi)
        span = rng.uniform(0.5, 1.1) / R
        w = rng.uniform(0.09, 0.16)
        charge = rng.uniform(0.6, 1.0)
        dx, dy = X - cx, Y - cy
        r = np.hypot(dx, dy)
        ang = np.mod(np.arctan2(dy, dx) - a0, 2 * math.pi)
        s = ang / span
        dans = (s <= 1) & (np.abs(r - R) < w)
        if not dans.any():
            continue
        across = (r - R) / w
        poils = ndimage.gaussian_filter1d(rng.normal(0, 1, 256), 1.6)
        poils /= poils.std()
        stries = np.interp((across + 1) * 127.5, np.arange(256), poils)
        vide = smooth(0.3, 1.0, s)
        bord = 1 - smooth(0.25, 1.0, np.abs(across))
        debut = smooth(0.0, 0.12, s)
        k = np.where(dans, bord * debut * (1 - 0.6 * vide), 0.0)
        niveau = charge * (0.9 + 0.07 * stries * (0.4 + vide)) - 0.25 * vide
        T = T * (1 - 0.55 * k) + 0.55 * k * np.clip(niveau, 0.2, 1.0)
    return np.clip(T, 0.08, 1.0)


# -------------------------------------------------------------------------------------------------
# Ordre d'effacement: rangées de haut en bas, arcs de l'éponge.

def ordre(X, Y, rect, rng, px):
    x0, x1, y0, y1 = rect
    larg, haut = x1 - x0, y1 - y0
    rangs = max(1, round(haut / 0.30))
    h = haut / rangs
    # Bord des rangées en vague (le bras ne descend pas droit).
    yb = (y1 - Y) + 0.035 * np.sin((X - x0) / 0.45 * 2 * math.pi + rng.uniform(0, 6))
    r = np.clip(np.floor(yb / h), 0, rangs - 1)
    dans_rang = yb / h - r
    xr = np.where(np.mod(r, 2) == 0, X - x0, x1 - X)
    # Front en arc: le centre du rang passe avant ses bords.
    front = 0.18 * min(1.0, larg) * (1 - np.cos((dans_rang - 0.5) * math.pi)) ** 1.2
    q = np.clip((xr + front) / (larg + 0.2 * min(1.0, larg)), 0, 1)
    e = (r + q) / rangs
    # Front un peu déchiré (bruit de 1 à 3 cm): pas de grains isolés, qui scintilleraient en s'effaçant.
    e = e + 0.004 * bruit(X.shape, 0.012 * px, rng) + 0.003 * bruit(X.shape, 0.03 * px, rng)
    return np.clip(0.03 + 0.96 * e, 0.03, 0.99)


# -------------------------------------------------------------------------------------------------
# Inscription au doigt: police à un trait (hauteur 1 = capitale ou hampe, ligne de base à 0).

def arc(cx, cy, rx, ry, a0, a1, n=18):
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n), cy + ry * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


XH = 0.55  # hauteur des minuscules

GLYPHES = {
    "À": (0.8, [[(0, 0), (0.4, 1), (0.8, 0)], [(0.16, 0.38), (0.64, 0.38)], [(0.26, 1.34), (0.46, 1.14)]]),
    "L": (0.55, [[(0, 1), (0, 0), (0.55, 0)]]),
    "O": (0.82, [arc(0.41, 0.5, 0.41, 0.5, math.pi / 2, math.pi / 2 + 2 * math.pi, 28)]),
    "U": (0.7, [[(0, 1), (0, 0.32)] + arc(0.35, 0.32, 0.35, 0.32, math.pi, 2 * math.pi)[1:] + [(0.7, 1)]]),
    "E": (0.56, [[(0.56, 1), (0, 1), (0, 0), (0.56, 0)], [(0, 0.52), (0.44, 0.52)]]),
    "R": (0.66, [[(0, 0), (0, 1), (0.38, 1)] + arc(0.38, 0.75, 0.25, 0.25, math.pi / 2, -math.pi / 2)[1:] + [(0, 0.5)],
                 [(0.28, 0.5), (0.66, 0)]]),
    "a": (0.5, [arc(0.23, 0.26, 0.23, 0.26, 0.15, 2 * math.pi + 0.15, 20), [(0.47, XH), (0.47, 0)]]),
    "d": (0.5, [arc(0.23, 0.26, 0.23, 0.26, 0.15, 2 * math.pi + 0.15, 20), [(0.47, 1), (0.47, 0)]]),
    "e": (0.5, [[(0.02, 0.28), (0.47, 0.28)] + arc(0.245, 0.28, 0.225, 0.27, 0, 1.72 * math.pi, 20)[1:]]),
    "s": (0.42, [[(0.40, 0.47), (0.30, 0.54), (0.15, 0.54), (0.04, 0.45), (0.06, 0.35), (0.20, 0.29),
                  (0.34, 0.24), (0.41, 0.13), (0.34, 0.02), (0.18, -0.01), (0.02, 0.06)]]),
    "r": (0.34, [[(0, XH), (0, 0)], [(0, 0.32), (0.08, 0.46), (0.2, 0.54), (0.33, 0.54)]]),
    "u": (0.47, [[(0, XH), (0, 0.22)] + arc(0.21, 0.22, 0.21, 0.22, math.pi, 2 * math.pi, 12)[1:] + [(0.44, XH)],
                 [(0.44, XH), (0.44, 0)]]),
    "'": (0.12, [[(0.08, 1.0), (0.03, 0.74)]]),
    "-": (0.34, [[(0.03, 0.3), (0.31, 0.3)]]),
    " ": (0.34, []),
}


def lisse(points, pas):
    """Densifie une polyligne (Catmull-Rom) au pas donné, en unités du glyphe."""
    p = np.array(points, float)
    if len(p) < 3:
        n = max(2, int(np.linalg.norm(p[-1] - p[0]) / pas) + 1)
        return np.linspace(p[0], p[-1], n)
    q = np.vstack([p[0], p, p[-1]])
    out = []
    for i in range(1, len(q) - 2):
        a, b, c, d = q[i - 1], q[i], q[i + 1], q[i + 2]
        n = max(2, int(np.linalg.norm(c - b) / pas) + 1)
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3))
    out.append(p[-1])
    return np.array(out)


def ligne(texte, hauteur, espace):
    """Traits d'une ligne en mètres (origine: début de la ligne de base), et sa largeur."""
    traits, x = [], 0.0
    for ch in texte:
        largeur, polys = GLYPHES[ch]
        for poly in polys:
            pts = lisse(poly, 0.03)
            traits.append(np.c_[x + pts[:, 0] * hauteur, pts[:, 1] * hauteur])
        x += (largeur + espace) * hauteur
    return traits, x - espace * hauteur


def inscription(X, Y, rng):
    """Distance au trait le plus proche (m) et largeur locale du trait du doigt."""
    cx = (4.46 + 6.34) / 2
    lignes = []
    t1, l1 = ligne("À LOUER", 0.24, 0.16)
    lignes.append((t1, cx - l1 / 2, 1.36))
    t2, l2 = ligne("s'adresser au-dessus", 0.115, 0.12)
    lignes.append((t2, cx - l2 / 2 - 0.02, 1.17))
    d = np.full(X.shape, 9.0)
    largeur = np.full(X.shape, 0.016)
    for traits, x0, yb in lignes:
        for tr in traits:
            # Doigt qui tremble un peu: déport lent de 2 mm, largeur de 1,4 à 1,9 cm.
            n = len(tr)
            tremble = np.cumsum(rng.normal(0, 0.0007, (n, 2)), axis=0)
            tremble -= np.linspace(tremble[0], tremble[-1], n)
            pts = tr + [x0, yb] + tremble
            w = 0.0165 + 0.0025 * np.sin(np.linspace(0, rng.uniform(2, 5), n) + rng.uniform(0, 6))
            for (ax, ay), (bx, by), wa in zip(pts[:-1], pts[1:], w[:-1]):
                m = (X > min(ax, bx) - 0.03) & (X < max(ax, bx) + 0.03) & (Y > min(ay, by) - 0.03) & (Y < max(ay, by) + 0.03)
                if not m.any():
                    continue
                px, py = X[m] - ax, Y[m] - ay
                vx, vy = bx - ax, by - ay
                L2 = vx * vx + vy * vy
                t = np.clip((px * vx + py * vy) / L2, 0, 1) if L2 > 0 else np.zeros_like(px)
                dd = np.hypot(px - t * vx, py - t * vy)
                plus = dd < d[m]
                sub_d = d[m]
                sub_w = largeur[m]
                sub_d[plus] = dd[plus]
                sub_w[plus] = wa
                d[m] = sub_d
                largeur[m] = sub_w
    return d, largeur


# -------------------------------------------------------------------------------------------------

def vitre(rect, case, graine, texte):
    x0, x1, y0, y1 = rect
    _, _, rw, rh = case
    rng = np.random.default_rng(graine)
    px = (rw / (x1 - x0) + rh / (y1 - y0)) / 2
    i = (np.arange(rw) + 0.5) / rw
    j = (np.arange(rh) + 0.5) / rh
    X, Y = np.meshgrid(x0 + i * (x1 - x0), y1 - j * (y1 - y0))
    T = epaisseur(X, Y, rng, px)
    E = ordre(X, Y, rect, rng, px)
    nu = np.zeros(X.shape)
    if texte:
        d, w = inscription(X, Y, rng)
        demi = w / 2
        # Le doigt repousse le badigeon: bourrelet plus épais au bord du trait.
        T = np.clip(T + 0.35 * np.exp(-(((d - demi - 0.003) / 0.0035) ** 2)), 0, 1)
        nu = 1 - smooth(demi - 0.002, demi + 0.001, d)
    jour = MINCE_JOUR + (CRAIE_JOUR - MINCE_JOUR) * smooth(0.15, 0.85, T)[..., None]
    contre = CONTRE_JOUR + (EPAIS_CONTRE_JOUR - CONTRE_JOUR) * smooth(0.3, 1.0, T)[..., None]
    jour = jour * (1 - nu[..., None]) + SALLE_SOMBRE * nu[..., None]
    contre = contre * (1 - nu[..., None]) + PLACE_CLAIRE * nu[..., None]
    alpha = np.where(nu > 0.5, 0.0, E)
    return jour, contre, alpha


def main():
    atlas = np.zeros((H, W, 4))
    for _, rect, case, graine in VITRES:
        jour, contre, alpha = vitre(rect, case, graine, texte=(graine == 11))
        x, y, rw, rh = case
        atlas[y:y + rh, x:x + rw, :3] = jour
        atlas[y:y + rh, x:x + rw, 3] = alpha
        atlas[y:y + rh, HALF + x:HALF + x + rw, :3] = contre
        atlas[y:y + rh, HALF + x:HALF + x + rw, 3] = alpha
    img = Image.fromarray(np.round(np.clip(atlas, 0, 1) * 255).astype(np.uint8), "RGBA")
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    img.save(SORTIE, optimize=True)
    print(SORTIE, os.path.getsize(SORTIE) // 1024, "Kio")


if __name__ == "__main__":
    main()
