"""Tour 10: bâtiments visitables (ADR 0016) et leur mobilier fixe.

- `ferrand_shop`: l'épicerie-pension d'Odette, reprise avec un intérieur (boutique, salle à manger de la
  pension sous ses draps, escalier vers les chambres).
- `haberdashery`: la mercerie-coiffure de Solange, rue Haute (fauteuil, miroir, banc d'attente, comptoir).

Appelé par bourg.py. Repères Blender du bâtiment: façade (porte) vers -Y (+Z glTF), +X à droite vu de dehors,
origine au centre de l'emprise, au sol. Règle des intérieurs (ADR 0016):
- murs du rez-de-chaussée en enfants directs `<id>_wall_front | back | left | right` (coupés selon la caméra);
- `<id>_roof` (toit), `<id>_upper` (étage) ou `<id>_attic` (plafond et comble): retirés en entier quand on entre;
- `<id>_floor`: le sol, jamais coupé;
- `<id>_interior`: tout le contenu fixe, masqué tant que le joueur local n'est pas dedans;
- `<id>_door`: le vantail, pivot sur le gond (axe Y), dans le plan intérieur du mur.
Les murs sont percés pour de bon (trumeaux, allèges, linteaux): on voit dehors depuis dedans, et les vitres
se voient des deux côtés.
"""
import math
import random

from mathutils import Matrix, Vector

import lpl
from lpl import by_normal


def _B():
    import bourg
    return bourg


# Outils -------------------------------------------------------------------------------------------

class Piece:
    """Construit un meuble autour de l'origine dans un Geo partagé, puis le pose (position, lacet)."""

    def __init__(self, g):
        self.g = g
        self.before = set(g.bm.verts)

    def place(self, loc, rz=0.0):
        new = [v for v in self.g.bm.verts if v not in self.before]
        M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(rz), 4, "Z")
        self.g.transform(new, M)
        return new


def pierced_wall(g, f, L, t, h, openings, col, z0=0.0):
    """Mur de longueur L (centré sur u = 0), du nu extérieur (d = 0) vers l'intérieur (d = -t), de z0 à h,
    percé d'ouvertures [(u, largeur, bas, haut)]: trumeaux, allèges et linteaux en boîtes."""
    us = -L / 2
    for (u, w, zb, zt) in sorted(openings):
        a, b = u - w / 2, u + w / 2
        if a > us + 1e-4:
            f.box(g, (a - us, t, h - z0), (us + a) / 2, -t / 2, (z0 + h) / 2, col)
        if zb > z0 + 1e-4:
            f.box(g, (w, t, zb - z0), u, -t / 2, (z0 + zb) / 2, col)
        if zt < h - 1e-4:
            f.box(g, (w, t, h - zt), u, -t / 2, (zt + h) / 2, col)
        us = b
    if us < L / 2 - 1e-4:
        f.box(g, (L / 2 - us, t, h - z0), (us + L / 2) / 2, -t / 2, (z0 + h) / 2, col)


def glazed(g, f, u, w, zb, zt, t, frame="paint_cream", shutter=None, sill="stone_light", mullion=True,
           box_flowers=False, inner_sill="wood"):
    """Fenêtre dans une ouverture: dormant, vitre au milieu de l'épaisseur, appui dehors, tablette dedans,
    volets ouverts contre le mur (facultatifs)."""
    h = zt - zb
    fd = -t * 0.45
    for s in (1, -1):
        f.box(g, (0.06, 0.08, h), u + s * (w / 2 - 0.03), fd, zb + h / 2, frame)
    f.box(g, (w - 0.12, 0.08, 0.06), u, fd, zt - 0.03, frame)
    f.box(g, (w - 0.12, 0.08, 0.06), u, fd, zb + 0.03, frame)
    f.box(g, (w - 0.12, 0.02, h - 0.12), u, fd, zb + h / 2, "glass")
    if mullion:
        f.box(g, (0.04, 0.05, h - 0.12), u, fd, zb + h / 2, frame)
        f.box(g, (w / 2 - 0.08, 0.05, 0.035), u - w / 4 + 0.01, fd, zb + h * 0.6, frame)
        f.box(g, (w / 2 - 0.08, 0.05, 0.035), u + w / 4 - 0.01, fd, zb + h * 0.6, frame)
    f.box(g, (w + 0.16, 0.12, 0.06), u, 0.04, zb - 0.03, sill)
    f.box(g, (w + 0.04, 0.12, 0.035), u, -t - 0.02, zb - 0.02, inner_sill)
    if shutter:
        for s in (1, -1):
            f.box(g, (w / 2, 0.035, h), u + s * (w * 0.75 + 0.04), 0.02, zb + h / 2, shutter)
            for zz in (0.22, 0.78):
                f.box(g, (w / 2 + 0.01, 0.045, 0.045), u + s * (w * 0.75 + 0.04), 0.025, zb + h * zz, "wood_dark")
    if box_flowers:
        f.box(g, (w + 0.06, 0.2, 0.16), u, 0.13, zb + 0.05, "wood")
        for k in range(5):
            c = ["flower_red", "flower_pink", "flower_white", "flower_red", "flower_yellow"][k]
            f.box(g, (0.12, 0.12, 0.1), u - w / 2 + 0.1 + k * (w - 0.2) / 4, 0.13, zb + 0.17, c, rot=(0, 0, 20 * k))
        f.box(g, (w + 0.02, 0.16, 0.06), u, 0.13, zb + 0.13, "leaf_bush")


def door_frame(g, f, u, w, h, t, frame="paint_cream", step="stone_dark", glass_over=False):
    """Chambranle (jambages et linteau) dans l'ouverture et seuil de pierre dehors (marche de 12 cm)."""
    for s in (1, -1):
        f.box(g, (0.07, t + 0.04, h), u + s * (w / 2 - 0.035), -t / 2, h / 2, frame)
    f.box(g, (w - 0.14, t + 0.04, 0.08), u, -t / 2, h - 0.04, frame)
    if glass_over:
        f.box(g, (w - 0.14, 0.02, 0.28), u, -t / 2, h + 0.18, "glass")
    if step:
        f.box(g, (w + 0.3, 0.38, 0.12), u, 0.19, 0.06, step)


def door_leaf(A, name, parent, f, u, w, h, t, color="paint_green", glass=False, panel=None):
    """Vantail à part, pivot sur le jambage gauche (vu de dehors), dans le plan intérieur du mur.
    Fermé: aligné sur le mur; l'ouvrir = tourner autour de Y (vers l'intérieur)."""
    g = A.geo()
    lw = w - 0.14
    g.box((lw, 0.05, h - 0.1), loc=(lw / 2, 0, (h - 0.1) / 2 + 0.01), color=color)
    pc = panel or ("wood_dark" if color.startswith("wood") else color)
    if glass:
        g.box((lw - 0.22, 0.06, 0.7), loc=(lw / 2, 0, 1.45), color="glass")
        g.box((lw - 0.22, 0.06, 0.6), loc=(lw / 2, 0, 0.5), color=pc)
    else:
        for z, hh in ((0.5, 0.6), (1.45, 0.6)):
            g.box((lw - 0.22, 0.06, hh), loc=(lw / 2, 0, z), color=pc)
    for sy in (1, -1):
        g.box((0.05, 0.03, 0.05), loc=(lw - 0.1, sy * 0.04, 1.0), color="brass")
    # pivot: jambage gauche vu de dehors, dans le plan d'une face posée à d = -t + 0,05
    hinge = f.p(u - w / 2 + 0.07, -t + 0.05, 0.0)
    ob = A.add(name, g, parent=parent, loc=hinge)
    ob.rotation_euler = (0, 0, math.radians(f.rz))
    return ob


def floor_boards(g, x0, x1, y0, y1, z, color_a="wood", color_b="wood_new", along="x", w=0.5):
    """Plancher: sol de 2 cm sous le niveau, lames de largeur w le long de X ou de Y."""
    g.box((x1 - x0, y1 - y0, z - 0.02), loc=((x0 + x1) / 2, (y0 + y1) / 2, 0), color="stone_dark", base=True)
    if along == "x":
        n = max(1, int(round((y1 - y0) / w)))
        for i in range(n):
            ya = y0 + (y1 - y0) * i / n
            g.box((x1 - x0, (y1 - y0) / n - 0.01, 0.02), loc=((x0 + x1) / 2, ya + (y1 - y0) / n / 2, z - 0.02),
                  color=color_a if i % 2 else color_b, base=True)
    else:
        n = max(1, int(round((x1 - x0) / w)))
        for i in range(n):
            xa = x0 + (x1 - x0) * i / n
            g.box(((x1 - x0) / n - 0.01, y1 - y0, 0.02), loc=(xa + (x1 - x0) / n / 2, (y0 + y1) / 2, z - 0.02),
                  color=color_a if i % 2 else color_b, base=True)


def floor_tiles(g, x0, x1, y0, y1, z, a="tile", b="tile_dark", cell=0.5):
    """Tomettes en damier: dalle de la couleur b, carreaux a posés en simples quads 2 mm au-dessus
    (2 triangles par carreau, UV constant par face)."""
    g.box((x1 - x0, y1 - y0, z), loc=((x0 + x1) / 2, (y0 + y1) / 2, 0), color=by_normal(b, "stone_dark"), base=True)
    nx, ny = int(round((x1 - x0) / cell)), int(round((y1 - y0) / cell))
    dx, dy = (x1 - x0) / nx, (y1 - y0) / ny
    for i in range(nx):
        for j in range(ny):
            if (i + j) % 2:
                continue
            xa, ya = x0 + dx * i + 0.004, y0 + dy * j + 0.004
            g.quad([(xa, ya, z + 0.002), (xa + dx - 0.008, ya, z + 0.002), (xa + dx - 0.008, ya + dy - 0.008, z + 0.002),
                    (xa, ya + dy - 0.008, z + 0.002)], a)


# Police des enseignes peintes: 5 rangées, pavés carrés, traits d'un pavé (lisible à la distance de jeu).
SIGN_FONT = {
    "A": ("0110", "1001", "1111", "1001", "1001"),
    "B": ("1110", "1001", "1110", "1001", "1110"),
    "C": ("0111", "1000", "1000", "1000", "0111"),
    "E": ("1111", "1000", "1110", "1000", "1111"),
    "F": ("1111", "1000", "1110", "1000", "1000"),
    "G": ("0111", "1000", "1011", "1001", "0111"),
    "I": ("111", "010", "010", "010", "111"),
    "L": ("1000", "1000", "1000", "1000", "1111"),
    "M": ("10001", "11011", "10101", "10001", "10001"),
    "N": ("1001", "1101", "1011", "1001", "1001"),
    "O": ("0110", "1001", "1001", "1001", "0110"),
    "P": ("1110", "1001", "1110", "1000", "1000"),
    "R": ("1110", "1001", "1110", "1010", "1001"),
    "U": ("1001", "1001", "1001", "1001", "0110"),
}


def sign_word_width(word, px):
    """Largeur (m) d'un mot de la police des enseignes, un pavé d'espace entre les lettres."""
    letters = [SIGN_FONT[ch.replace("É", "E")] for ch in word]
    return (sum(len(rows[0]) for rows in letters) + len(letters) - 1) * px


def painted_word(g, f, u, d, z, word, px, color):
    """Mot peint sur une enseigne (face f, centré en u, milieu des lettres à la hauteur z, à d du mur):
    un quad par trait horizontal de pavés, tourné vers la rue (2 triangles par trait). É porte son accent."""
    x = u - sign_word_width(word, px) / 2
    for ch in word:
        rows = SIGN_FONT[ch.replace("É", "E")]
        w = len(rows[0])
        for r, row in enumerate(rows):
            za = z + (2.5 - r - 1) * px
            c = 0
            while c < w:
                if row[c] != "1":
                    c += 1
                    continue
                c2 = c
                while c2 + 1 < w and row[c2 + 1] == "1":
                    c2 += 1
                ua, ub = x + c * px, x + (c2 + 1) * px
                g.quad([f.p(ua, d, za), f.p(ub, d, za), f.p(ub, d, za + px), f.p(ua, d, za + px)], color)
                c = c2 + 1
        if ch == "É":
            # accent aigu: un pavé penché au-dessus de la lettre, vers la droite
            zb = z + 2.5 * px + 0.25 * px
            ua = x + 1.4 * px
            g.quad([f.p(ua, d, zb), f.p(ua + px, d, zb), f.p(ua + 1.8 * px, d, zb + 0.9 * px),
                    f.p(ua + 0.8 * px, d, zb + 0.9 * px)], color)
        x += (w + 1) * px


# Mobilier (pièces posées dans le Geo du contenu) --------------------------------------------------

def shelving(g, loc, rz, W=1.6, D=0.35, H=1.9, levels=(0.1, 0.55, 1.0, 1.45, 1.85), jars=True, seed=1,
             goods=None):
    """Rayonnage dos au mur (dos vers +Y avant pose): montants, planches, dos, et ce qui est dessus."""
    p = Piece(g)
    rnd = random.Random(seed)
    for x in (-W / 2 + 0.025, W / 2 - 0.025):
        g.box((0.05, D, H), loc=(x, 0, 0), color="wood_dark", base=True)
    g.box((W, 0.02, H), loc=(0, D / 2 - 0.01, 0), color="wood_dark", base=True)
    g.box((W + 0.04, D + 0.03, 0.05), loc=(0, 0, H), color="wood", base=True)
    for z in levels[:-1]:
        g.box((W - 0.05, D, 0.03), loc=(0, 0, z), color="wood", base=True)
    for li, z in enumerate(levels[:-1]):
        top = z + 0.03
        room = (levels[li + 1] - top) - 0.04
        x = -W / 2 + 0.12
        kind = (goods or ["jars", "boxes", "jars", "tins"])[li % len(goods or [1, 2, 3, 4])]
        while x < W / 2 - 0.12:
            if kind == "jars" and jars:
                hh = min(room, rnd.uniform(0.16, 0.24))
                lid = rnd.choice(["fabric_red", "fabric_blue", "fabric_yellow", "fabric_green", "fabric_cream"])
                fill = rnd.choice(["bread", "carrot", "strawberry", "grain", "potato", "egg"])
                g.lathe([(0.055, 0.0), (0.06, hh * 0.75), (0.045, hh * 0.9), (0.05, hh)], loc=(x, 0.0, top),
                        colors=[fill, "glass", lid], segs=6)
                x += 0.15
            elif kind == "tins":
                hh = min(room, 0.16)
                g.cyl(0.06, hh, loc=(x, 0, top), color=rnd.choice(["tin_paint", "tin", "paint_red"]), segs=6, base=True)
                x += 0.15
            elif kind == "sacks":
                hh = min(room, 0.3)
                g.sphere(1.0, loc=(x + 0.06, 0, top + hh * 0.45), color="burlap", segs=6, rings=4,
                         scale=(0.11, 0.13, hh * 0.5))
                x += 0.26
            elif kind == "bolts":
                # rouleaux de tissu couchés, bout vers la pièce
                c = rnd.choice(["fabric_blue", "fabric_red", "fabric_yellow", "fabric_green", "fabric_rose",
                                "fabric_cream"])
                r = min(room / 2 - 0.005, 0.085)
                g.cyl(r, D - 0.04, loc=(x + 0.02, -0.01, top + r), color=c, segs=6, rot=(90, 0, 0))
                x += 2 * r + 0.03
            else:
                hh = min(room, rnd.uniform(0.12, 0.2))
                g.box((0.16, 0.22, hh), loc=(x + 0.04, 0, top), color=rnd.choice(["paper_dark", "burlap", "wood_new",
                                                                                   "paint_cream"]), base=True)
                x += 0.22
    return p.place(loc, rz)


def plain_chair(g, loc, rz, seat=0.47, color="wood_new", leg="wood"):
    """Chaise paillée: devant vers -Y avant pose (dos à +Y)."""
    p = Piece(g)
    g.box((0.44, 0.42, 0.05), loc=(0, 0, seat - 0.05), color="straw", base=True)
    g.box((0.46, 0.44, 0.03), loc=(0, 0, seat - 0.08), color=color, base=True)
    for x in (-0.19, 0.19):
        g.box((0.045, 0.045, seat - 0.05), loc=(x, -0.18, 0), color=leg, base=True)
        g.box((0.045, 0.045, 0.95), loc=(x, 0.18, 0), color=leg, base=True)
    for z in (0.66, 0.84):
        g.box((0.38, 0.03, 0.06), loc=(0, 0.185, z), color=color)
    g.box((0.38, 0.03, 0.03), loc=(0, -0.18, 0.16), color=leg)
    for x in (-0.19, 0.19):
        g.box((0.03, 0.36, 0.03), loc=(x, 0, 0.16), color=leg)
    return p.place(loc, rz)


def small_table(g, loc, rz, w=0.8, d=0.6, h=0.72, color="wood", cloth=None):
    p = Piece(g)
    g.box((w, d, 0.04), loc=(0, 0, h - 0.04), color=color, base=True)
    for x in (-w / 2 + 0.06, w / 2 - 0.06):
        for y in (-d / 2 + 0.06, d / 2 - 0.06):
            g.box((0.05, 0.05, h - 0.04), loc=(x, y, 0), color="wood_dark", base=True)
    g.box((w - 0.1, 0.03, 0.07), loc=(0, -d / 2 + 0.06, h - 0.11), color="wood_dark")
    g.box((w - 0.1, 0.03, 0.07), loc=(0, d / 2 - 0.06, h - 0.11), color="wood_dark")
    if cloth:
        g.box((w + 0.04, d + 0.04, 0.012), loc=(0, 0, h), color=cloth, base=True)
        for s in (1, -1):
            g.box((w + 0.04, 0.012, 0.16), loc=(0, s * (d / 2 + 0.026), h - 0.15), color=cloth, base=True)
    return p.place(loc, rz)


def draped_table(g, loc, rz, w=1.2, d=0.8, h=0.74):
    """Table de la pension sous son drap: une housse qui tombe presque au sol, plis aux coins."""
    p = Piece(g)
    g.box((w + 0.06, d + 0.06, 0.05), loc=(0, 0, h - 0.05), color="fabric_cream", base=True, bevel=0.02)
    for s in (1, -1):
        g.box((w + 0.1, 0.02, h - 0.02), loc=(0, s * (d / 2 + 0.04), 0.0), color="fabric_cream", base=True,
              taper=(0.95, 1.0))
        g.box((0.02, d + 0.1, h - 0.02), loc=(s * (w / 2 + 0.04), 0, 0.0), color="paper", base=True,
              taper=(1.0, 0.95))
    return p.place(loc, rz)


def draped_chair(g, loc, rz):
    p = Piece(g)
    g.box((0.46, 0.44, 0.5), loc=(0, 0, 0.0), color="paper", base=True, taper=(1.0, 1.0))
    g.box((0.44, 0.08, 0.45), loc=(0, 0.19, 0.5), color="fabric_cream", base=True, bevel=0.02)
    return p.place(loc, rz)


def iron_stove(g, loc, rz, flue_to=2.9):
    """Poêle de fonte sur pieds, plaque du dessus, porte vitrée de mica, tuyau qui monte au plafond."""
    p = Piece(g)
    g.box((0.5, 0.45, 0.55), loc=(0, 0, 0.12), color="black", base=True, bevel=0.03)
    for sx in (1, -1):
        for sy in (1, -1):
            g.box((0.06, 0.06, 0.13), loc=(sx * 0.2, sy * 0.17, 0), color="iron", base=True)
    g.box((0.56, 0.5, 0.04), loc=(0, 0, 0.67), color="iron_light", base=True)
    g.box((0.24, 0.02, 0.18), loc=(0, -0.23, 0.38), color="ember")
    g.box((0.3, 0.025, 0.04), loc=(0, -0.235, 0.49), color="brass")
    g.cyl(0.07, flue_to - 0.71, loc=(0.08, 0.08, 0.71), color="black", segs=8, base=True)
    g.cyl(0.085, 0.04, loc=(0.08, 0.08, flue_to - 0.04), color="iron_light", segs=8, base=True)
    g.cyl(0.12, 0.015, loc=(-0.12, -0.08, 0.71), color="copper", segs=8, base=True)
    g.cyl(0.11, 0.13, loc=(-0.12, -0.08, 0.725), color="copper", segs=8, base=True, r2=0.09)
    return p.place(loc, rz)


def counter(g, x0, x1, y0, y1, h=0.95, top="wood_new", body="paint_green"):
    g.box((x1 - x0, y1 - y0, h - 0.05), loc=((x0 + x1) / 2, (y0 + y1) / 2, 0), color=body, base=True)
    g.box((x1 - x0 + 0.06, y1 - y0 + 0.06, 0.05), loc=((x0 + x1) / 2, (y0 + y1) / 2, h - 0.05), color=top,
          base=True)


def sack(g, loc, h=0.55, color="burlap", fold="burlap_dark", seed=0):
    rnd = random.Random(seed)
    x, y = loc[0], loc[1]
    g.sphere(1.0, loc=(x, y, h * 0.42), color=color, segs=8, rings=5, scale=(0.22, 0.2, h * 0.45),
             rot=(0, 0, rnd.uniform(0, 90)))
    g.cyl(0.13, 0.17, loc=(x, y, h * 0.73), r2=0.16, color=fold, segs=7, base=True)
    g.cyl(0.11, 0.02, loc=(x, y, h * 0.9), color="grain" if seed % 2 else "seed", segs=7, base=True)


def bread_basket(g, loc, rz=0.0):
    """Panière d'Achille posée: osier, quatre miches et deux baguettes."""
    p = Piece(g)
    g.box((0.7, 0.45, 0.22), loc=(0, 0, 0), color="straw_dark", base=True)
    g.box((0.62, 0.37, 0.02), loc=(0, 0, 0.2), color="fabric_cream", base=True)
    for i in range(4):
        g.sphere(1.0, loc=(-0.22 + 0.15 * i, -0.06 + 0.1 * (i % 2), 0.25), color=by_normal("bread_crust", "bread"),
                 segs=7, rings=4, scale=(0.08, 0.08, 0.06))
    for s in (1, -1):
        g.cyl(0.035, 0.6, loc=(0.0, s * 0.13, 0.26), color="bread", segs=6, rot=(0, 90, 6 * s))
    for s in (1, -1):
        g.box((0.04, 0.04, 0.12), loc=(s * 0.33, 0, 0.22), color="straw_dark", base=True)
    return p.place(loc, rz)


# L'épicerie-pension d'Odette (10 x 8, façade à l'est) ---------------------------------------------

SHOP = dict(ix=4.0, iy=3.0, t=0.35, h1=2.9, ze=5.4, zr=7.4, fl=0.12, part=2.0)


def ferrand_shop(A):
    """Reprise du tour 10 avec un intérieur. Pièces (repère glTF, x le long de la façade, z vers la façade):
    boutique x -4 à 2, z -3 à 3 (6 x 6); salle à manger x 2 à 4 (2 x 6), derrière une cloison à porte
    entrouverte. Les cases de la conception (boutique y 27 à 31) se décalent d'une rangée vers le nord
    (y 26 à 31): la case 6 de la façade (le guichet, `grocery_counter`) tombe ainsi dans la boutique."""
    B = _B()
    S = SHOP
    ix, iy, t, h1, ze, zr, fl = S["ix"], S["iy"], S["t"], S["h1"], S["ze"], S["zr"], S["fl"]
    hx, hy = ix + t, iy + t
    root = A.group("ferrand_shop", {
        "footprint": [10, 8], "door_cell": 2, "counter_cell": 6, "cut_walls": True,
        "cut_nodes": ["ferrand_shop_roof", "ferrand_shop_upper"],
        "interior": {"floor_y": fl, "rooms": [
            {"id": "shop", "x": [-4.0, 2.0], "z": [-3.0, 3.0]},
            {"id": "dining", "x": [2.0, 4.0], "z": [-3.0, 3.0], "walkable": False,
             "note": "vue par la porte entrouverte de la cloison; pas de case jouable"}]},
        "note": "façade à l'est sur la carte (rotation 1); murs du rez-de-chaussée coupés selon la caméra, "
                "ferrand_shop_upper et ferrand_shop_roof retirés en entier, ferrand_shop_floor jamais coupé"})
    # sol (jamais coupé): tomettes dans la boutique, plancher dans la salle à manger
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    floor_tiles(g, -ix, S["part"], -iy, iy, fl)
    floor_boards(g, S["part"], ix, -iy, iy, fl, along="y")
    A.add("ferrand_shop_floor", g, parent=root)
    color_out, color_in = "plaster_ochre", "plaster_cream"
    # murs du rez-de-chaussée
    walls = {
        "front": dict(L=2 * hx, openings=[(-2.5, 1.0, 0.0, 2.3), (0.3, 3.2, 0.95, 2.45), (3.1, 0.9, 1.0, 2.2)]),
        "back": dict(L=2 * hx, openings=[(3.0, 0.9, 1.1, 2.2), (-3.0, 0.9, 0.0, 2.1)]),
        "left": dict(L=2 * iy, openings=[]),
        "right": dict(L=2 * iy, openings=[(0.0, 0.9, 1.0, 2.2)]),
    }
    for side, w in walls.items():
        g = A.geo()
        f = B.Face(side, hx, hy)
        inward = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (1, 0, 0), "right": (-1, 0, 0)}[side]
        col = B.wall_color(color_out, color_in, inward)
        pierced_wall(g, f, w["L"], t, h1, w["openings"], col)
        # soubassement de pierre dehors et cordon au plancher de l'étage
        segs = [(-w["L"] / 2, w["L"] / 2)]
        for (u, ww, zb, zt) in sorted(w["openings"]):
            if zb < 0.5:
                a, b = segs.pop()
                segs += [(a, u - ww / 2), (u + ww / 2, b)]
        for a, b in segs:
            if b - a > 0.05:
                f.box(g, (b - a + (0.06 if side in ("front", "back") else 0), 0.06, 0.5), (a + b) / 2, 0.03, 0.25, "stone")
        f.box(g, (w["L"] + (0.1 if side in ("front", "back") else 0), 0.08, 0.16), 0, 0.04, h1 - 0.05, "stone_light")
        if side == "front":
            door_frame(g, f, -2.5, 1.0, 2.3, t, frame="paint_green", glass_over=False)
            # vitrine et guichet: la partie nord (case 6) s'ouvre sur le comptoir de la place
            glazed(g, f, 0.3, 3.2, 0.95, 2.45, t, frame="paint_green", sill="paint_green", mullion=False,
                   inner_sill="wood_new")
            for uu in (-0.85, 0.75):
                f.box(g, (0.06, 0.1, 1.5), uu, -t * 0.45, 1.7, "paint_green")
            f.box(g, (3.5, 0.12, 0.3), 0.3, 0.04, 2.6, "paint_green")
            # étal dehors, sous la vitrine: cagettes de légumes du potager du bourg
            f.box(g, (3.4, 0.6, 0.06), 0.3, 0.32, 0.92, "wood")
            f.box(g, (3.4, 0.5, 0.86), 0.3, 0.27, 0.43, "paint_green")
            for k in range(4):
                f.box(g, (0.62, 0.42, 0.24), 0.3 - 1.25 + k * 0.83, 0.33, 1.07, "wood_new")
                f.box(g, (0.52, 0.32, 0.1), 0.3 - 1.25 + k * 0.83, 0.33, 1.22, ["radish", "lettuce", "carrot", "potato"][k])
            glazed(g, f, 3.1, 0.9, 1.0, 2.2, t, frame="paint_green", shutter="paint_green")
            # store rayé au-dessus de la devanture (coupé avec la façade quand on entre)
            for k in range(12):
                x0 = -hx + 0.1 + k * (2 * hx - 0.2) / 12
                ww = (2 * hx - 0.2) / 12
                B.slab(g, [(x0, -hy - 1.5, 2.55), (x0 + ww, -hy - 1.5, 2.55), (x0 + ww, -hy - 0.02, 3.1),
                           (x0, -hy - 0.02, 3.1)], 0.03, "awning_red" if k % 2 == 0 else "awning_cream")
                hv = 0.22 if k % 2 == 0 else 0.15
                f.box(g, (ww, 0.03, hv), x0 + ww / 2, 1.495, 2.56 - hv / 2, "awning_red" if k % 2 == 0 else "awning_cream")
            for xa in (-hx + 0.4, 0.0, hx - 0.4):
                B.rod(g, (xa, -hy - 0.02, 2.62), (xa, -hy - 1.42, 2.5), 0.02, "iron")
                g.box((0.08, 0.04, 0.12), loc=(xa, -hy - 0.02, 2.62), color="iron")
        elif side == "back":
            glazed(g, f, 3.0, 0.9, 1.1, 2.2, t, frame="paint_green", shutter="paint_green")
            door_frame(g, f, -3.0, 0.9, 2.1, t, frame="paint_green")
        elif side == "right":
            glazed(g, f, 0.0, 0.9, 1.0, 2.2, t, frame="paint_green", shutter="paint_green")
        A.add("ferrand_shop_wall_" + side, g, parent=root)
    door_leaf(A, "ferrand_shop_door", root, B.Face("front", hx, hy), -2.5, 1.0, 2.3, t, color="paint_green", glass=True)
    door_leaf(A, "ferrand_shop_back_door", root, B.Face("back", hx, hy), -3.0, 0.9, 2.1, t, color="paint_green")
    # étage: murs, pignons, plancher (plafond du rez-de-chaussée), fenêtres et enseigne
    g = A.geo()
    g.box((2 * ix, 2 * iy, 0.12), loc=(0, 0, h1 - 0.12), color="wood_dark", base=True)
    g.box((2 * hx, 2 * hy, ze - h1), loc=(0, 0, h1), color=by_normal(color_out, color_out), base=True)
    for x, s in ((-hx, 1), (hx, -1)):
        g.prism([(-hy, ze), (hy, ze), (0, zr - 0.25)], 0.3, loc=(x + s * 0.15, 0, 0), color=color_out, rot=(0, 0, 90))
    f = B.Face("front", hx, hy)
    f.box(g, (4.0, 0.08, 0.45), 0, 0.06, 3.45, "paint_cream")
    painted_word(g, f, 0.0, 0.104, 3.43, "ÉPICERIE", 0.06, "paint_green")
    for u in (-3.0, -1.0, 1.0, 3.0):
        B.window(g, f, u, 3.85, 0.8, 1.05, shutter="paint_green", box_flowers=(u in (-1.0, 1.0)), mullion=False)
    fb = B.Face("back", hx, hy)
    for u in (-2.5, 0.0, 2.5):
        B.window(g, fb, u, 3.85, 0.8, 1.05, shutter="paint_green", mullion=False)
    for side in ("left", "right"):
        fs = B.Face(side, hx, hy)
        for u in (-1.2, 1.2):
            B.window(g, fs, u, 3.85, 0.7, 1.0, shutter="paint_green", mullion=False)
    A.add("ferrand_shop_upper", g, parent=root)
    r = A.geo()
    B.gable_roof(r, -hx, hx, -hy, hy, ze, zr, "lauze", edge="lauze_dark", over=0.4, ridge_color="lauze_dark")
    B.chimney(r, -3.2, 1.6, 6.5, 8.2)
    B.chimney(r, 3.0, 0.4, 6.0, 8.0)
    for x in (-1.6, 1.6):
        # lucarnes: joues et toit prolongés jusqu'au pan (sinon leur toit flotte au-dessus du pan)
        r.box((1.1, 1.9, 1.0), loc=(x, -hy + 1.2, 5.6), color="plaster_ochre", base=True)
        r.prism([(-0.65, 0), (0.65, 0), (0, 0.6)], 2.0, loc=(x, -hy + 1.15, 6.6), color="lauze_dark")
        r.box((0.6, 0.06, 0.7), loc=(x, -hy + 0.24, 6.0), color="glass")
        r.box((0.72, 0.05, 0.82), loc=(x, -hy + 0.26, 6.0), color="stone_light")
    A.add("ferrand_shop_roof", r, parent=root)
    ferrand_interior(A, root)
    return root




def blocked_cells(boxes, x0, x1, y0, y1, min_cover=0.25):
    """Cases (repère glTF: coin [x, z] le plus petit de la case) couvertes par le mobilier fixe, d'après les
    boîtes englobantes au sol des meubles (Blender x0, x1, y0, y1). Une case est bloquée dès que le meuble en
    couvre au moins min_cover."""
    out = set()
    for (bx0, bx1, by0, by1) in boxes:
        for cx in range(int(math.floor(x0)), int(math.ceil(x1))):
            for cy in range(int(math.floor(y0)), int(math.ceil(y1))):
                ox = max(0.0, min(bx1, cx + 1) - max(bx0, cx))
                oy = max(0.0, min(by1, cy + 1) - max(by0, cy))
                if ox * oy >= min_cover:
                    # glTF z = -y Blender: la case Blender [cy, cy+1] devient [-cy-1, -cy]
                    out.add((cx, -cy - 1))
    return sorted([list(c) for c in out])


class Footprints:
    """Relevé des emprises au sol (Blender) du mobilier posé, pour les cases bloquées de l'intérieur."""

    def __init__(self):
        self.boxes = []

    def add(self, verts, pad=0.0):
        xs = [v.co.x for v in verts if v.is_valid]
        ys = [v.co.y for v in verts if v.is_valid]
        self.boxes.append((min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad))

    def rect(self, x0, x1, y0, y1):
        self.boxes.append((x0, x1, y0, y1))


def _gl(x, y):
    """Point Blender (x, y) vers le plan du sol glTF [x, z]."""
    return [round(x, 3), round(-y, 3)]


def ferrand_interior(A, root):
    """Contenu fixe de l'épicerie (un seul maillage, masqué tant qu'on n'est pas dedans)."""
    S = SHOP
    ix, iy, fl, h1, part = S["ix"], S["iy"], S["fl"], S["h1"], S["part"]
    g = A.geo()
    fp = Footprints()
    z = fl
    # cloison boutique / salle à manger, porte entrouverte (vantail à 35 degrés vers la salle)
    dy0, dy1 = -1.4, -0.6
    for (a, b) in ((-iy, dy0), (dy1, iy)):
        g.box((0.12, b - a, h1 - z), loc=(part, (a + b) / 2, z), color="plaster_cream", base=True)
    g.box((0.12, dy1 - dy0, h1 - z - 2.05), loc=(part, (dy0 + dy1) / 2, z + 2.05), color="plaster_cream", base=True)
    for yy in (dy0, dy1):
        g.box((0.16, 0.06, 2.05), loc=(part, yy, z), color="wood_dark", base=True)
    lw = dy1 - dy0 - 0.06
    leaf = Piece(g)
    g.box((0.04, lw, 2.0), loc=(0, lw / 2, 0), color="paint_cream", base=True)
    g.box((0.05, 0.04, 0.04), loc=(0.03, lw - 0.08, 1.0), color="brass")
    leaf.place((part + 0.06, dy0 + 0.03, z), -35)
    # comptoir en retour, perpendiculaire à la façade: Odette entre lui et la cloison, au guichet
    counter(g, 0.55, 1.05, -iy, -1.6, h=z + 0.83, body="paint_green")
    fp.rect(0.55, 1.05, -iy, -1.6)
    g.box((0.95, 0.5, 0.05), loc=(1.5, -iy + 0.28, z + 0.78), color="wood_new", base=True)
    for yy in (-iy + 0.08, -iy + 0.48):
        g.box((0.04, 0.04, z + 0.78), loc=(1.95, yy, 0), color="wood_dark", base=True)
    # présentoir sous la vitrine, côté boutique: bocaux
    g.box((1.85, 0.4, 0.81), loc=(-0.38, -iy + 0.2, z), color="paint_green", base=True)
    g.box((1.9, 0.44, 0.04), loc=(-0.38, -iy + 0.2, z + 0.81), color="wood_new", base=True)
    fp.rect(-1.33, 0.57, -iy, -iy + 0.42)
    rnd = random.Random(4)
    for k in range(7):
        x = -1.15 + k * 0.26
        hh = rnd.uniform(0.18, 0.26)
        g.lathe([(0.07, 0.0), (0.075, hh * 0.75), (0.05, hh * 0.9), (0.06, hh)], loc=(x, -iy + 0.2, z + 0.85),
                colors=[["strawberry", "carrot", "grain", "egg"][k % 4], "glass",
                        ["fabric_red", "fabric_yellow", "fabric_blue"][k % 3]], segs=6)
    # sur le comptoir: balance de laiton, la panière d'Achille au bout (le pain du matin)
    cz = z + 0.83
    g.box((0.26, 0.2, 0.05), loc=(0.8, -2.75, cz), color="brass", base=True)
    g.cyl(0.015, 0.22, loc=(0.8, -2.75, cz + 0.05), color="brass", segs=6, base=True)
    g.box((0.32, 0.03, 0.03), loc=(0.8, -2.75, cz + 0.27), color="brass", base=True)
    for s in (1, -1):
        g.cyl(0.09, 0.02, loc=(0.8 + s * 0.15, -2.75, cz + 0.16), color="brass", segs=8, base=True)
        # suspentes des plateaux au fléau
        g.box((0.008, 0.008, 0.11), loc=(0.8 + s * 0.15, -2.75, cz + 0.175), color="brass", base=True)
    bread_basket(g, (0.8, -2.05, cz), 90)
    # rayonnages: mur du fond et mur sud; derrière Odette, sur la cloison, les bocaux du comptoir
    fp.add(shelving(g, (-1.25, iy - 0.18, z), 0, W=2.4, D=0.35, H=2.0, seed=5))
    fp.add(shelving(g, (-ix + 0.18, -0.95, z), 90, W=1.4, D=0.35, H=2.0, seed=6,
                    goods=["tins", "jars", "boxes", "jars"]))
    fp.add(shelving(g, (part - 0.2, -2.25, z), -90, W=1.3, D=0.3, H=1.9, seed=7, goods=["boxes", "jars", "jars", "tins"]))
    # sacs de graines près de la porte, hors du battant
    for k, (x, y) in enumerate(((-3.65, -2.55), (-3.65, -2.05), (-3.25, -2.3))):
        sack(g, (x, y, z), h=0.5 + 0.06 * (k % 2), seed=k)
    fp.rect(-3.9, -3.0, -2.8, -1.8)
    # poêle de fonte contre le mur sud, petite table ronde et deux chaises (grocery_table)
    fp.add(iron_stove(g, (-3.55, 0.4, z), 90, flue_to=h1 - z))
    p = Piece(g)
    g.cyl(0.38, 0.04, loc=(0, 0, 0.7), color="wood_new", segs=10, base=True)
    g.cyl(0.4, 0.012, loc=(0, 0, 0.74), color="fabric_red", segs=10, base=True)
    g.cyl(0.04, 0.7, loc=(0, 0, 0), color="wood_dark", segs=6, base=True)
    g.cyl(0.2, 0.04, loc=(0, 0, 0), color="wood_dark", segs=8, base=True)
    g.cyl(0.05, 0.08, loc=(0.1, 0.05, 0.752), color="ceramic", segs=6, base=True)
    fp.add(p.place((-2.35, 1.35, z), 0))
    fp.add(plain_chair(g, (-2.35, 0.75, z), 180))
    fp.add(plain_chair(g, (-2.35, 1.95, z), 0))
    # escalier vers les chambres, le long de la cloison: 15 marches de 18,5 cm sur 23 cm, monte vers le fond
    _shop_stair(g, z, h1)
    fp.rect(1.12, 2.0, -0.55, iy)
    # salle à manger de la pension: deux tables et leurs chaises sous des draps
    draped_table(g, (3.0, -1.7, z), 90, w=1.1, d=0.75)
    draped_table(g, (3.0, 1.15, z), 90, w=1.1, d=0.75)
    for yy in (-2.5, -0.9, 0.35, 1.95):
        draped_chair(g, (3.55, yy, z), -90)
    A.add("ferrand_shop_interior", g, parent=root)
    root["interior_spots"] = {
        "grocery_inside_counter": _gl(1.5, -2.5), "grocery_customer": _gl(0.05, -2.05),
        "grocery_table": _gl(-2.35, 1.35), "grocery_table_seats": [_gl(-2.35, 0.75), _gl(-2.35, 1.95)],
        "grocery_stove": _gl(-3.55, 0.4), "grocery_stairs_foot": _gl(1.55, -0.95),
        "grocery_dining_door": _gl(1.6, -1.0)}
    root["interior_blocked"] = blocked_cells(fp.boxes, -ix, part, -iy, iy)
    root["seat_height"] = 0.47
    root["note_spots"] = ("interior_spots et interior_blocked dans le repère glTF du bâtiment (x, z), à tourner "
                          "avec l'objet de la carte; interior_blocked = coin [x, z] le plus petit de chaque case "
                          "occupée par le mobilier fixe (meubles muraux compris)")


def _shop_stair(g, z, h1):
    """Escalier droit le long de la cloison (x 1,1 à 2), de y -0,55 au mur du fond: 15 marches."""
    n = 15
    x = 1.55
    y_bot, y_top = -0.55, 2.95
    run = (y_top - y_bot) / n
    rise = (h1 - z) / n
    w = 0.86
    for k in range(n):
        ya = y_bot + run * k
        g.box((w - 0.08, run + 0.02, 0.04), loc=(x, ya + run / 2, z + rise * (k + 1) - 0.04), color="wood", base=True)
        g.box((w - 0.08, 0.025, rise - 0.04), loc=(x, ya + 0.0125, z + rise * k), color="wood_dark", base=True)
    L = math.hypot(y_top - y_bot, h1 - z)
    ang = math.degrees(math.atan2(h1 - z, y_top - y_bot))
    for s in (1, -1):
        g.box((0.05, L + 0.1, 0.24), loc=(x + s * (w / 2 - 0.025), (y_bot + y_top) / 2, (z + h1) / 2 + 0.03),
              color="wood_dark", rot=(ang, 0, 0))
    # sous les marches: placard fermé (rien qui flotte, on ne voit pas sous l'escalier)
    g.prism([(y_bot, z), (y_top, z), (y_top, h1 - 0.25)], w - 0.1, loc=(x, 0, 0), color="wood_dark",
            rot=(0, 0, 90))
    # main courante côté boutique, sur deux poteaux posés sur les marches
    for yy in (y_bot + 0.1, y_top - 0.35):
        k = int((yy - y_bot) / run)
        zs = z + rise * (k + 1)
        g.box((0.05, 0.05, 0.92), loc=(x - w / 2 - 0.03, yy, zs - 0.02), color="wood_dark", base=True)
    g.box((0.05, L, 0.05), loc=(x - w / 2 - 0.03, (y_bot + y_top) / 2, (z + h1) / 2 + 0.92), color="wood",
          rot=(ang, 0, 0))


# La mercerie-coiffure de Solange (7 x 7, façade à l'est, rue Haute) --------------------------------

SALON = dict(ix=2.5, iy=2.5, t=0.3, ze=2.75, zr=4.6, fl=0.12)
SALON_MIRROR_Y = 0.2


def haberdashery(A):
    """Un niveau, faîtage à 4,7 m. Intérieur de 5 x 5 m (repère glTF x -2,5 à 2,5, z -2,5 à 2,5).
    Porte au milieu de la façade (case 3, (74, 27) sur la carte); vitrine sur la rue Haute et vitrine au
    nord sur la rue de la halte (celle qu'on voit en arrivant de la halte), enseigne peinte sur le pignon
    nord. Solange loge sous le toit, derrière la boutique: une échelle de meunier monte au comble par une
    trappe (sa chambre a la lucarne du fond)."""
    B = _B()
    S = SALON
    ix, iy, t, ze, zr, fl = S["ix"], S["iy"], S["t"], S["ze"], S["zr"], S["fl"]
    hx, hy = ix + t, iy + t
    root = A.group("haberdashery", {
        "footprint": [7, 7], "door_cell": 3, "cut_walls": True, "cut_nodes": ["haberdashery_roof", "haberdashery_attic"],
        "interior": {"x": [-ix, ix], "z": [-iy, iy], "floor_y": fl},
        "note": "façade à l'est sur la carte (rotation 1): +X glTF = nord. Murs coupés selon la caméra, "
                "haberdashery_roof et haberdashery_attic retirés en entier, haberdashery_floor jamais coupé"})
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    floor_boards(g, -ix, ix, -iy, iy, fl, color_a="wood", color_b="wood_new", along="y", w=0.42)
    A.add("haberdashery_floor", g, parent=root)
    color_out, color_in = "plaster_rose", "plaster_cream"
    # Face("left").u va vers -Y, Face("back").u vers -X, Face("right").u vers +Y
    walls = {
        "front": dict(L=2 * hx, openings=[(0.0, 1.0, 0.0, 2.2), (-1.6, 1.0, 0.95, 2.1), (1.55, 1.3, 0.55, 2.25)]),
        "back": dict(L=2 * hx, openings=[(1.35, 0.8, 1.15, 2.05)]),
        "left": dict(L=2 * iy, openings=[(1.45, 0.7, 1.35, 2.15)]),
        "right": dict(L=2 * iy, openings=[(-1.0, 1.5, 0.55, 2.25)]),
    }
    for side, w in walls.items():
        g = A.geo()
        f = B.Face(side, hx, hy)
        inward = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (1, 0, 0), "right": (-1, 0, 0)}[side]
        col = B.wall_color(color_out, color_in, inward)
        pierced_wall(g, f, w["L"], t, ze, w["openings"], col)
        segs = [(-w["L"] / 2, w["L"] / 2)]
        for (u, ww, zb, zt) in sorted(w["openings"]):
            if zb < 0.3:
                a, b = segs.pop()
                segs += [(a, u - ww / 2), (u + ww / 2, b)]
        for a, b in segs:
            if b - a > 0.05:
                f.box(g, (b - a + (0.04 if side in ("front", "back") else 0), 0.05, 0.4), (a + b) / 2, 0.025, 0.2,
                      "stone")
        if side == "front":
            door_frame(g, f, 0.0, 1.0, 2.2, t, frame="paint_blue", glass_over=False)
            glazed(g, f, -1.6, 1.0, 0.95, 2.1, t, frame="paint_blue", shutter="paint_blue")
            glazed(g, f, 1.55, 1.3, 0.55, 2.25, t, frame="paint_blue", sill="paint_blue", mullion=False,
                   inner_sill="wood_new")
            f.box(g, (1.5, 0.06, 0.5), 1.55, 0.03, 0.27, "paint_blue")
            # enseigne de façade au-dessus de la porte: ciseaux ouverts et deux bobines peints
            f.box(g, (1.2, 0.06, 0.3), 0.0, 0.03, 2.45, "paint_cream")
            for s in (1, -1):
                f.box(g, (0.32, 0.012, 0.04), 0.1 * s, 0.065, 2.45, "iron", rot=(0, 28 * s, 0))
                f.box(g, (0.07, 0.012, 0.07), 0.2 * s, 0.065, 2.37, "iron")
            f.box(g, (0.12, 0.012, 0.16), 0.42, 0.065, 2.45, "fabric_red")
            f.box(g, (0.12, 0.012, 0.16), -0.42, 0.065, 2.45, "fabric_blue")
        elif side == "back":
            glazed(g, f, 1.35, 0.8, 1.15, 2.05, t, frame="paint_blue", shutter="paint_blue")
        elif side == "left":
            glazed(g, f, 1.45, 0.7, 1.35, 2.15, t, frame="paint_blue", shutter="paint_blue")
        elif side == "right":
            glazed(g, f, -1.0, 1.5, 0.55, 2.25, t, frame="paint_blue", sill="paint_blue", mullion=False,
                   inner_sill="wood_new")
            f.box(g, (1.7, 0.06, 0.5), -1.0, 0.03, 0.27, "paint_blue")
        if side == "left":
            salon_mirror(g, SALON_MIRROR_Y, fl)
        if side in ("left", "right"):
            # pignons (dans le mur de côté, coupés avec lui), haut sous le dessous du toit
            x = -hx + t / 2 if side == "left" else hx - t / 2
            g.prism([(-hy, ze), (hy, ze), (0, zr - 0.22)], t, loc=(x, 0, 0), color=col, rot=(0, 0, 90))
        if side == "right":
            # enseigne peinte sur le pignon nord, vue de la rue de la halte: MERCERIE, et COIFFURE dessous
            f.box(g, (2.6, 0.04, 0.42), 0.0, 0.02, 3.3, "paint_cream")
            painted_word(g, f, 0.0, 0.044, 3.3, "MERCERIE", 0.05, "paint_red")
            f.box(g, (1.8, 0.04, 0.3), 0.0, 0.02, 2.93, "paint_cream")
            painted_word(g, f, 0.0, 0.044, 2.93, "COIFFURE", 0.04, "paint_blue")
        A.add("haberdashery_wall_" + side, g, parent=root)
    door_leaf(A, "haberdashery_door", root, B.Face("front", hx, hy), 0.0, 1.0, 2.2, t, color="paint_blue", glass=True)
    # plafond et comble (retirés en entier quand on entre): plancher du comble sur solives, trappe de l'échelle
    g = A.geo()
    tx0, tx1, ty0, ty1 = 0.3, 1.15, 1.8, 2.5
    for (a, b, c, d) in ((-ix, ix, -iy, ty0), (-ix, tx0, ty0, iy), (tx1, ix, ty0, iy)):
        g.box((b - a, d - c, 0.06), loc=((a + b) / 2, (c + d) / 2, ze - 0.06), color="wood", base=True)
    for k in range(6):
        yy = -iy + 0.35 + k * (2 * iy - 0.7) / 5
        g.box((2 * ix, 0.12, 0.14), loc=(0, yy, ze - 0.2), color="wood_dark", base=True)
    A.add("haberdashery_attic", g, parent=root)
    r = A.geo()
    B.round_gable_roof(r, -hx, hx, -hy, hy, ze, zr, "tile", edge="tile_dark", ridge_color="tile_dark")
    B.round_chimney(r, -1.4, 1.2, 3.6, 5.2)
    # lucarne du fond (la chambre de Solange sous le toit): front à 0,25 m en retrait du nu du mur, joues
    # et toit prolongés jusqu'au pan (le faîtage de la lucarne, à 4,0 m, reste sous celui du toit)
    slope = (zr - ze) / hy
    yf, zb, zt, zp = hy - 0.25, 2.85, 3.65, 4.0
    ye = (zr - zt) / slope - 0.05
    yr = (zr - zp) / slope
    r.box((0.9, yf - ye, zt - zb), loc=(0.9, (yf + ye) / 2, zb), color="plaster_rose", base=True)
    r.prism([(-0.6, 0), (0.6, 0), (0, zp - zt)], yf + 0.15 - yr, loc=(0.9, (yf + 0.15 + yr) / 2, zt), color="tile_dark")
    r.box((0.62, 0.04, 0.6), loc=(0.9, yf + 0.01, (zb + zt) / 2 + 0.02), color="paint_blue")
    r.box((0.5, 0.05, 0.48), loc=(0.9, yf + 0.02, (zb + zt) / 2 + 0.02), color="glass")
    A.add("haberdashery_roof", r, parent=root)
    salon_interior(A, root)
    return root


def barber_chair(g, loc, rz):
    """Fauteuil de coiffure à pied: socle rond, colonne, assise de cuir, accoudoirs, dossier, appui-tête,
    repose-pieds. Devant vers -Y avant pose (dos à +Y). Assise à 0,5 m."""
    p = Piece(g)
    g.cyl(0.26, 0.05, loc=(0, 0, 0), color="iron", segs=10, base=True)
    g.cyl(0.07, 0.32, loc=(0, 0, 0.05), color="iron_light", segs=8, base=True)
    g.box((0.5, 0.5, 0.14), loc=(0, 0, 0.36), color="leather", base=True, bevel=0.04, bseg=2)
    g.box((0.5, 0.12, 0.62), loc=(0, 0.22, 0.47), color="leather", base=True, bevel=0.04, bseg=2, rot=(-8, 0, 0))
    g.box((0.3, 0.1, 0.12), loc=(0, 0.33, 1.1), color="leather", base=True, bevel=0.03)
    g.box((0.05, 0.05, 0.1), loc=(0, 0.32, 1.02), color="iron_light", base=True)
    for s in (1, -1):
        g.box((0.07, 0.42, 0.06), loc=(s * 0.28, 0.02, 0.62), color="wood_dark", base=True, bevel=0.015)
        g.box((0.05, 0.05, 0.14), loc=(s * 0.28, -0.15, 0.49), color="iron_light", base=True)
    g.box((0.36, 0.14, 0.03), loc=(0, -0.42, 0.12), color="iron", base=True)
    g.box((0.04, 0.24, 0.04), loc=(0, -0.3, 0.12), color="iron", base=True, rot=(-28, 0, 0))
    return p.place(loc, rz)


def waiting_bench(g, loc, rz, W=1.5):
    """Banc d'attente à deux places, dossier, journaux posés: devant vers -Y avant pose. Assise à 0,45 m."""
    p = Piece(g)
    g.box((W, 0.42, 0.05), loc=(0, 0, 0.4), color="wood_new", base=True)
    for x in (-W / 2 + 0.06, W / 2 - 0.06):
        g.box((0.06, 0.4, 0.4), loc=(x, 0, 0), color="wood_dark", base=True)
        g.box((0.06, 0.06, 0.95), loc=(x, 0.18, 0), color="wood_dark", base=True)
        g.box((0.06, 0.38, 0.05), loc=(x, 0.0, 0.62), color="wood_dark", base=True)
        g.box((0.05, 0.05, 0.17), loc=(x, -0.17, 0.45), color="wood_dark", base=True)
    for zz in (0.6, 0.8):
        g.box((W - 0.12, 0.03, 0.09), loc=(0, 0.19, zz), color="wood_new", base=True)
    g.box((W - 0.12, 0.04, 0.04), loc=(0, 0.15, 0.12), color="wood_dark", base=True)
    g.box((0.3, 0.22, 0.03), loc=(0.0, 0.02, 0.45), color="paper", base=True, rot=(0, 0, 8))
    g.box((0.28, 0.2, 0.012), loc=(0.02, 0.03, 0.48), color="paper_dark", base=True, rot=(0, 0, -6))
    return p.place(loc, rz)


def salon_mirror(g, my, z):
    """Coin coiffure, au mur sud (dans le nœud du mur: coupé avec lui, rien ne reste en l'air): grand miroir,
    tablette (peigne, ciseaux, flacons) sur deux consoles."""
    gx = -SALON["ix"]
    g.box((0.06, 1.1, 1.45), loc=(gx + 0.03, my, z + 0.85), color="wood_dark", base=True)
    g.box((0.03, 0.96, 1.3), loc=(gx + 0.07, my, z + 0.92), color="glass_lamp")
    g.box((0.032, 0.9, 1.22), loc=(gx + 0.075, my, z + 0.96), color="glass")
    g.box((0.32, 1.25, 0.04), loc=(gx + 0.16, my, z + 0.82), color="wood_new", base=True)
    for s in (1, -1):
        g.box((0.04, 0.04, 0.3), loc=(gx + 0.1, my + s * 0.55, z + 0.55), color="wood_dark", base=True,
              rot=(0, -28, 0))
    for k, (yy, c) in enumerate(((0.1, "glass"), (0.22, "fabric_rose"), (0.34, "ceramic_blue"), (0.46, "glass_lamp"))):
        g.lathe([(0.03, 0.0), (0.035, 0.1), (0.015, 0.13), (0.015, 0.15)], loc=(gx + 0.16, my + yy, z + 0.86),
                colors=[c, c, "brass"], segs=6)
    for s in (1, -1):
        g.box((0.14, 0.012, 0.012), loc=(gx + 0.2, my - 0.2, z + 0.866), color="steel_forged", base=True,
              rot=(0, 0, 18 * s))


def salon_interior(A, root):
    """Plan (Blender: +X nord, -Y la façade sur la rue Haute, +Y le fond):
    coin coiffure au sud (miroir au mur, fauteuil tourné vers lui), banc d'attente au fond qui voit le
    fauteuil de biais, échelle de meunier au fond vers la trappe, comptoir au nord avec Solange côté fond et
    le rayonnage de tissus sur le mur nord, vitrines sur la rue Haute et la rue de la halte."""
    S = SALON
    ix, iy, fl, ze = S["ix"], S["iy"], S["fl"], S["ze"]
    g = A.geo()
    fp = Footprints()
    z = fl
    my = SALON_MIRROR_Y
    gx = -ix
    fp.rect(gx, gx + 0.32, my - 0.62, my + 0.62)
    fp.add(barber_chair(g, (-1.95, my, z), 90))
    # banc d'attente au fond (ouest), face à la porte et de biais sur le fauteuil
    fp.add(waiting_bench(g, (-1.35, iy - 0.25, z), 0))
    # échelle de meunier contre le mur du fond, du nord vers le sud, jusqu'à la trappe du comble
    fp.add(_miller_stair(g, z, ze))
    # comptoir de mercerie au nord, parallèle à la façade: Solange derrière (côté fond), client devant
    counter(g, 0.65, 2.0, -0.3, 0.25, h=z + 0.83, top="wood_new", body="paint_blue")
    fp.rect(0.65, 2.0, -0.3, 0.25)
    cz = z + 0.83
    for k in range(3):
        g.cyl(0.07, 0.42, loc=(0.9 + k * 0.42, 0.0, cz + 0.07), color=["fabric_red", "fabric_green", "fabric_yellow"][k],
              segs=6, rot=(90, 0, 0))
    for k in range(3):
        g.cyl(0.04, 0.06, loc=(1.05 + k * 0.12, 0.17, cz), color=["fabric_blue", "fabric_red", "fabric_cream"][k],
              segs=6, base=True)
    g.box((0.5, 0.12, 0.012), loc=(1.65, -0.18, cz), color="wood_new", base=True)
    g.box((0.06, 0.012, 0.02), loc=(1.52, -0.18, cz + 0.012), color="steel_forged", base=True)
    # rayonnage de tissus sur le mur nord, derrière Solange
    fp.add(shelving(g, (ix - 0.17, 1.3, z), -90, W=1.9, D=0.32, H=2.15, levels=(0.1, 0.5, 0.9, 1.3, 1.7, 2.1), seed=33,
                    goods=["bolts", "bolts", "boxes", "bolts", "jars"]))
    # vitrine nord: mannequin de couture habillé et rouleaux dressés; chaise de couture de Solange (le lundi)
    p = Piece(g)
    g.cyl(0.14, 0.03, loc=(0, 0, 0), color="wood_dark", segs=8, base=True)
    g.cyl(0.02, 0.9, loc=(0, 0, 0.03), color="wood_dark", segs=6, base=True)
    g.lathe([(0.0, 0.0), (0.16, 0.02), (0.15, 0.25), (0.12, 0.38), (0.15, 0.55), (0.06, 0.62), (0.0, 0.64)],
            loc=(0, 0, 0.82), colors=["fabric_blue", "fabric_blue", "fabric_blue", "fabric_cream", "fabric_cream",
                                      "fabric_cream"], segs=8)
    fp.add(p.place((ix - 0.3, -0.5, z), 0))
    for k in range(2):
        g.cyl(0.07, 1.1 - k * 0.15, loc=(ix - 0.22, -0.95 - k * 0.17, z), color=["fabric_green", "fabric_red"][k],
              segs=6, base=True)
    fp.add(plain_chair(g, (1.85, -1.55, z), 90))
    # vitrine de la rue Haute: chapeaux sur un présentoir
    g.box((1.2, 0.35, 0.42), loc=(1.55, -iy + 0.2, z), color="paint_blue", base=True)
    fp.rect(0.95, 2.15, -iy, -iy + 0.38)
    for k in range(3):
        x = 1.15 + k * 0.4
        c = ["straw", "fabric_rose", "straw_dark"][k]
        g.cyl(0.015, 0.25, loc=(x, -iy + 0.2, z + 0.42), color="wood_dark", segs=5, base=True)
        g.cyl(0.13, 0.02, loc=(x, -iy + 0.2, z + 0.67), color=c, segs=8, base=True)
        g.cyl(0.08, 0.08, loc=(x, -iy + 0.2, z + 0.69), color=c, segs=8, base=True, r2=0.07)
    # près de la porte, côté sud: porte-manteau; dans le coin, une plante
    g.cyl(0.02, 1.7, loc=(-0.95, -2.2, z), color="wood_dark", segs=6, base=True)
    g.cyl(0.18, 0.03, loc=(-0.95, -2.2, z), color="wood_dark", segs=8, base=True)
    for k in range(3):
        g.box((0.22, 0.03, 0.03), loc=(-0.95, -2.2, z + 1.6), color="wood_dark", rot=(0, 0, 60 * k))
    g.lathe([(0.12, 0.0), (0.15, 0.24), (0.16, 0.27)], loc=(-2.15, -2.15, z), colors="tile", segs=8)
    g.sphere(0.22, loc=(-2.15, -2.15, z + 0.48), color="leaf_bush", ico=1, jitter=0.1, seed=4, scale=(1, 1, 0.9))
    A.add("haberdashery_interior", g, parent=root)
    root["interior_spots"] = {
        "salon_chair": _gl(-1.95, my), "salon_hairdresser": _gl(-1.2, my), "salon_bench": _gl(-1.35, iy - 0.25),
        "salon_bench_seats": [_gl(-1.75, iy - 0.25), _gl(-0.95, iy - 0.25)], "salon_counter": _gl(1.35, 0.8),
        "salon_counter_customer": _gl(1.35, -0.85), "salon_window": _gl(1.85, -1.55),
        "spot_horn_comb": _gl(gx + 0.17, my - 0.42), "stairs_foot": _gl(0.6, iy - 0.35)}
    root["seat_height"] = 0.5
    root["bench_seat_height"] = 0.45
    root["interior_blocked"] = blocked_cells(fp.boxes, -ix, ix, -iy, iy)
    root["note_spots"] = ("interior_spots (repère glTF x, z du bâtiment): salon_chair regarde le miroir (vers -X "
                          "glTF, le sud); le banc regarde la porte (+Z glTF); salon_window: chaise de couture "
                          "tournée vers la vitrine nord. interior_blocked: coin [x, z] le plus petit de chaque case "
                          "occupée")


def _miller_stair(g, z, ze):
    """Échelle de meunier (62 degrés) contre le mur du fond, du sud (bas, à côté du banc) vers le nord (haut),
    sous la trappe du comble: 12 marches de 22 cm de haut et 12 cm de giron, limons pleins, main courante de
    bois côté pièce sur trois potelets."""
    n = 12
    x0, x1 = -0.35, 1.05
    y = SALON["iy"] - 0.33
    w = 0.6
    rise = (ze - z) / n
    run = (x1 - x0) / n
    verts = []
    for k in range(n):
        verts += g.box((abs(run) + 0.08, w - 0.08, 0.04), loc=(x0 + run * (k + 0.5), y, z + rise * (k + 1) - 0.04),
                       color="wood", base=True)
    L = math.hypot(x1 - x0, ze - z)
    ang = math.degrees(math.atan2(ze - z, x1 - x0))
    for s in (1, -1):
        verts += g.box((L + 0.05, 0.05, 0.2), loc=((x0 + x1) / 2, y + s * (w / 2 - 0.025), (z + ze) / 2 - 0.02),
                       color="wood_dark", rot=(0, -ang, 0))
    # main courante de bois côté pièce, portée par trois potelets plantés dans le limon (retour du
    # 2026-11-02: la corde au mur, à 0,9 m au-dessus des marches, se lisait comme un fil tendu dans
    # le vide); elle s'arrête sous la trémie du comble
    ys = y - (w / 2 - 0.025)
    over = 0.1 / math.cos(math.radians(ang))
    hand = 0.85
    ta, tb = 0.06, (ze - z - hand - 0.1) / (ze - z)

    def on_stair(t, dz):
        return Vector((x0 + (x1 - x0) * t, ys, z + (ze - z) * t - 0.02 + dz))

    pa, pb = on_stair(ta, hand), on_stair(tb, hand)
    g.box(((pb - pa).length + 0.04, 0.045, 0.045), loc=tuple((pa + pb) / 2), color="wood_dark", rot=(0, -ang, 0))
    for t in (ta, (ta + tb) / 2, tb):
        lo, hi = on_stair(t, over), on_stair(t, hand)
        g.box((0.035, 0.035, hi.z - lo.z), loc=(lo.x, ys, lo.z), color="wood_dark", base=True)
    return verts
