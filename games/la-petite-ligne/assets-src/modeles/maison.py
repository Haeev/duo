"""Maison du duo: meubles, plats, objets de l'histoire, kit de modules.

Lancer: duo-python maison.py
Produit: assets/modeles/maison.glb, planches/maison.png

Origine au centre de l'emprise (en cases), au sol; l'avant du meuble vers -Y (+Z glTF).
Meubles « muraux » (étagère, rideaux): leur dos est contre le bord arrière de la case (+Y, -Z glTF).
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402
from bourg import Face, door, slab, window  # noqa: E402
import maison_t9 as T9  # noqa: E402
import maison_t10 as T10  # noqa: E402


def straw_mattress(A):
    g = A.geo()
    g.box((0.85, 1.85, 0.14), color=by_normal("straw", "straw_dark"), base=True, bevel=0.05, bseg=2)
    g.box((0.6, 0.35, 0.08), loc=(0, 0.65, 0.12), color="burlap", base=True, bevel=0.03)
    for k in range(14):
        x = -0.4 + (k * 0.37) % 0.8
        y = -0.85 + (k * 0.61) % 1.7
        g.box((0.18, 0.012, 0.012), loc=(x, y, 0.15), color="straw_dark", rot=(0, 0, k * 47))
    return g


def double_bed(A):
    g = A.geo()
    W, L = 1.5, 1.95
    for x in (-W / 2, W / 2):
        g.box((0.09, 0.09, 1.0), loc=(x, L / 2 - 0.05, 0), color="wood", base=True)
        g.box((0.09, 0.09, 0.6), loc=(x, -L / 2 + 0.05, 0), color="wood", base=True)
        g.box((0.06, L, 0.18), loc=(x, 0, 0.22), color="wood", base=True)
    g.box((W, 0.06, 0.55), loc=(0, L / 2 - 0.05, 0.4), color="wood_new", base=True, bevel=0.01)
    g.box((W, 0.05, 0.3), loc=(0, -L / 2 + 0.05, 0.25), color="wood_new", base=True)
    g.box((W - 0.06, L - 0.1, 0.18), loc=(0, 0, 0.32), color="mattress", base=True, bevel=0.04, bseg=2)
    g.box((W - 0.02, 1.25, 0.06), loc=(0, -0.33, 0.47), color="fabric_blue", base=True, bevel=0.03)
    g.box((W + 0.02, 1.0, 0.04), loc=(0, -0.45, 0.5), color="fabric_cream", base=True, bevel=0.02)
    for x in (-0.36, 0.36):
        g.box((0.55, 0.32, 0.12), loc=(x, 0.65, 0.5), color="fabric_cream", base=True, bevel=0.05, bseg=2)
    return g


def mattress_item(A):
    g = A.geo()
    g.cyl(0.32, 1.3, loc=(0, 0, 0.32), color="mattress", segs=10, rot=(0, 90, 0))
    for x in (-0.45, -0.15, 0.15, 0.45):
        g.cyl(0.322, 0.06, loc=(x, 0, 0.32), color="mattress_stripe", segs=10, rot=(0, 90, 0))
    for x in (-0.3, 0.3):
        g.cyl(0.335, 0.03, loc=(x, 0, 0.32), color="rope", segs=10, rot=(0, 90, 0))
    for s in (1, -1):
        g.cyl(0.12, 0.012, loc=(s * 0.651, 0, 0.32), color="mattress_stripe", segs=10, rot=(0, 90, 0))
    return g


def table(A):
    g = A.geo()
    g.box((1.6, 0.85, 0.06), loc=(0, 0, 0.72), color="wood_new", base=True, bevel=0.012)
    g.box((1.45, 0.7, 0.08), loc=(0, 0, 0.64), color="wood", base=True)
    for x in (-0.7, 0.7):
        for y in (-0.33, 0.33):
            g.box((0.07, 0.07, 0.64), loc=(x, y, 0), color="wood", base=True, taper=(1.0, 1.0))
    # entretoise en H qui relie vraiment les pieds: deux traverses de côté et une barre au milieu
    for x in (-0.7, 0.7):
        g.box((0.05, 0.6, 0.05), loc=(x, 0, 0.15), color="wood")
    g.box((1.36, 0.05, 0.05), loc=(0, 0, 0.15), color="wood")
    return g


def chair(A):
    g = A.geo()
    g.box((0.44, 0.42, 0.05), loc=(0, 0, 0.42), color="wood_new", base=True, bevel=0.008)
    for x in (-0.19, 0.19):
        g.box((0.045, 0.045, 0.42), loc=(x, -0.18, 0), color="wood", base=True)
        g.box((0.045, 0.045, 0.95), loc=(x, 0.18, 0), color="wood", base=True)
    for z in (0.62, 0.78, 0.92):
        g.box((0.4, 0.035, 0.05), loc=(0, 0.185, z), color="wood_new")
    g.box((0.38, 0.03, 0.03), loc=(0, -0.18, 0.15), color="wood")
    g.box((0.03, 0.36, 0.03), loc=(0.19, 0, 0.15), color="wood")
    g.box((0.03, 0.36, 0.03), loc=(-0.19, 0, 0.15), color="wood")
    return g


def chest(A):
    g = A.geo()
    g.box((0.85, 0.5, 0.42), color="wood", base=True, bevel=0.015)
    slab(g, [(-0.43, -0.26, 0.42), (0.43, -0.26, 0.42), (0.43, 0.0, 0.52), (-0.43, 0.0, 0.52)], 0.04, "wood_dark")
    slab(g, [(0.43, 0.26, 0.42), (-0.43, 0.26, 0.42), (-0.43, 0.0, 0.52), (0.43, 0.0, 0.52)], 0.04, "wood_dark")
    for x in (-0.3, 0.3):
        g.box((0.05, 0.52, 0.46), loc=(x, 0, 0), color="iron", base=True)
    g.box((0.1, 0.03, 0.12), loc=(0, -0.26, 0.33), color="brass")
    for s in (1, -1):
        g.box((0.03, 0.12, 0.04), loc=(s * 0.44, 0, 0.3), color="iron")
    return g


def shelf(A):
    g = A.geo()
    W, D, H = 1.6, 0.34, 1.65
    y = 0.5 - D / 2 - 0.02
    for x in (-W / 2, W / 2):
        g.box((0.05, D, H), loc=(x, y, 0), color="wood", base=True)
    g.box((W, 0.02, H), loc=(0, 0.48, 0), color="wood_dark", base=True)
    for k, z in enumerate((0.08, 0.55, 1.05, 1.55)):
        g.box((W, D, 0.04), loc=(0, y, z), color="wood_new", base=True)
    # quelques objets sur l'étagère: bocaux, assiettes, livres
    for k, x in enumerate((-0.6, -0.42, -0.24)):
        g.lathe([(0.07, 0.0), (0.08, 0.15), (0.05, 0.19), (0.06, 0.21)], loc=(x, y, 0.59), colors=["glass", "glass", "fabric_red"],
                segs=7)
    for k in range(5):
        g.box((0.05, 0.22, 0.26 - (k % 2) * 0.04), loc=(0.25 + k * 0.07, y, 0.59), color=["fabric_red", "fabric_blue", "fabric_green",
                                                                                           "paper_dark", "fabric_yellow"][k], base=True)
    for k in range(3):
        g.cyl(0.13, 0.02, loc=(-0.4 + k * 0.03, y + 0.05, 1.09 + k * 0.022), color="ceramic", segs=10)
    g.lathe([(0.08, 0.0), (0.12, 0.12), (0.09, 0.22), (0.05, 0.25)], loc=(0.45, y, 1.09), colors="ceramic_blue", segs=8)
    g.box((0.3, 0.2, 0.16), loc=(-0.3, y, 1.59), color="burlap", base=True, bevel=0.02)
    return g


def pipe_up(g, x, y, z0, z1, wall_y=0.5):
    """Tuyau de poêle: vertical de z0 à z1, coude, puis horizontal jusqu'au mur du fond, collerette au mur."""
    g.cyl(0.07, z1 - z0, loc=(x, y, z0), color="black", segs=8, base=True)
    g.sphere(0.072, loc=(x, y, z1), color="black", segs=8, rings=4)
    g.cyl(0.07, wall_y - y, loc=(x, (y + wall_y) / 2, z1), color="black", segs=8, rot=(90, 0, 0))
    g.cyl(0.12, 0.02, loc=(x, wall_y - 0.01, z1), color="iron_light", segs=10, rot=(90, 0, 0))
    g.cyl(0.09, 0.05, loc=(x, y, (z0 + z1) / 2), color="iron_light", segs=8)


def stove(A):
    """Réchaud de fonte avec son tuyau (déjà dans la maisonnette)."""
    g = A.geo()
    g.box((0.62, 0.5, 0.55), loc=(0, 0.05, 0.18), color="iron", base=True, bevel=0.02)
    for x in (-0.26, 0.26):
        for y in (-0.15, 0.25):
            g.box((0.05, 0.05, 0.2), loc=(x, y, 0), color="iron", base=True)
    g.box((0.66, 0.54, 0.04), loc=(0, 0.05, 0.73), color="iron_light", base=True)
    for x in (-0.15, 0.15):
        g.cyl(0.1, 0.02, loc=(x, 0.0, 0.77), color="black", segs=10)
    g.box((0.3, 0.03, 0.18), loc=(0, -0.21, 0.42), color="black", base=True)
    g.box((0.22, 0.035, 0.08), loc=(0, -0.215, 0.47), color="ember", base=True)
    g.box((0.12, 0.04, 0.03), loc=(0, -0.23, 0.63), color="brass")
    # tuyau: monte, coude vers le mur du fond (+Y, bord arrière de la case) et y entre par une collerette
    pipe_up(g, 0.18, 0.22, 0.77, 1.85)
    g.lathe([(0.11, 0.0), (0.12, 0.13), (0.125, 0.14)], loc=(-0.15, 0.0, 0.78), colors="iron_light", segs=8)
    g.box((0.14, 0.03, 0.02), loc=(-0.31, 0.0, 0.88), color="black")
    return g


def wood_stove(A):
    """Poêle à bois (P1)."""
    g = A.geo()
    g.lathe([(0.24, 0.0), (0.26, 0.1), (0.22, 0.15), (0.24, 0.7), (0.2, 0.78), (0.1, 0.85)], loc=(0, 0.05, 0.1),
            colors="black", segs=10)
    for k in range(3):
        a = math.radians(90 + k * 120)
        g.box((0.04, 0.04, 0.12), loc=(0.18 * math.cos(a), 0.05 + 0.18 * math.sin(a), 0.0), color="iron", base=True)
    g.box((0.2, 0.04, 0.2), loc=(0, -0.2, 0.35), color="ember", base=True)
    g.box((0.24, 0.035, 0.24), loc=(0, -0.21, 0.33), color="iron", base=True)
    pipe_up(g, 0.0, 0.05, 0.95, 1.85)
    g.cyl(0.25, 0.02, loc=(0, 0.05, 0.6), color="brass", segs=10)
    return g


def flower_pot(A):
    g = A.geo()
    g.lathe([(0.13, 0.0), (0.19, 0.3), (0.21, 0.32), (0.21, 0.36)], colors=["tile", "tile_dark", "tile_dark"], segs=10)
    g.cyl(0.19, 0.01, loc=(0, 0, 0.34), color="soil_tilled", segs=10)
    for k in range(7):
        a = math.radians(k * 51)
        g.sphere(0.1, loc=(0.1 * math.cos(a), 0.1 * math.sin(a), 0.45), color="leaf_bush", segs=5, rings=3, scale=(1, 1, 0.6))
    for k in range(5):
        a = math.radians(k * 72 + 20)
        r = 0.12 if k else 0.0
        g.sphere(0.06, loc=(r * math.cos(a), r * math.sin(a), 0.56 + (0.04 if k == 0 else 0)), color="flower_red", segs=5,
                 rings=3)
    return g


def oil_lamp(A):
    root = A.group("oil_lamp", {"footprint": [1, 1], "light_anchor": "oil_lamp_light"})
    g = A.geo()
    g.lathe([(0.1, 0.0), (0.11, 0.03), (0.04, 0.06), (0.03, 0.1), (0.09, 0.14), (0.1, 0.2), (0.05, 0.24), (0.04, 0.26)],
            colors=["brass", "brass", "brass", "glass", "glass", "brass", "brass"], segs=10)
    g.lathe([(0.04, 0.26), (0.065, 0.32), (0.06, 0.42), (0.035, 0.48)], colors="glass_lamp", segs=8, close_bottom=False,
            close_top=False)
    g.cyl(0.012, 0.05, loc=(0, 0, 0.28), color="flame", segs=5, base=True, r2=0.004)
    g.box((0.06, 0.02, 0.02), loc=(0.07, 0, 0.25), color="brass")
    A.add("oil_lamp_body", g, parent=root)
    lpl.empty("oil_lamp_light", parent=root, loc=(0, 0, 0.33))
    return root


def rug(A):
    g = A.geo()
    g.box((1.8, 1.8, 0.012), color="fabric_red", base=True, bevel=0.005)
    g.box((1.55, 1.55, 0.004), loc=(0, 0, 0.012), color="fabric_cream", base=True)
    g.box((1.4, 1.4, 0.004), loc=(0, 0, 0.016), color="fabric_red", base=True)
    g.box((0.5, 0.5, 0.004), loc=(0, 0, 0.02), color="fabric_yellow", base=True, rot=(0, 0, 45))
    for s in (1, -1):
        for k in range(9):
            g.box((0.03, 0.08, 0.006), loc=(-0.8 + k * 0.2, s * 0.94, 0.0), color="fabric_cream", base=True)
    return g


def curtains(A):
    g = A.geo()
    y = 0.42
    g.cyl(0.015, 1.25, loc=(0, y, 2.05), color="brass", segs=6, rot=(0, 90, 0))
    for s in (1, -1):
        g.sphere(0.03, loc=(s * 0.64, y, 2.05), color="brass", segs=6, rings=4)
        for k in range(4):
            # rideaux qui pendent sous la tringle (et non plus coupés par elle)
            g.box((0.11, 0.05, 1.1), loc=(s * (0.3 + k * 0.1), y - 0.02 * (k % 2), 2.03 - 1.1), color="fabric_rose" if k % 2 else "fabric_cream",
                  base=True)
        g.box((0.45, 0.07, 0.04), loc=(s * 0.45, y - 0.02, 1.3), color="fabric_red")
    g.box((1.2, 0.04, 0.14), loc=(0, y - 0.03, 1.92), color="fabric_rose", base=True)
    return g


def crystal_radio(A):
    g = A.geo()
    g.box((0.42, 0.28, 0.2), color="wood_dark", base=True, bevel=0.01)
    g.box((0.38, 0.24, 0.02), loc=(0, 0, 0.2), color="wood_new", base=True)
    g.cyl(0.05, 0.12, loc=(-0.1, 0.03, 0.22), color="brass", segs=8, base=True)
    for k in range(5):
        g.cyl(0.052, 0.008, loc=(-0.1, 0.03, 0.235 + k * 0.02), color="leather", segs=8)
    g.cyl(0.045, 0.02, loc=(0.1, -0.142, 0.1), color="radio_dial", segs=10, rot=(90, 0, 0))
    g.box((0.008, 0.01, 0.03), loc=(0.1, -0.155, 0.11), color="black", rot=(0, 30, 0))
    g.box((0.03, 0.03, 0.04), loc=(0.12, 0.05, 0.22), color="black", base=True)
    g.cyl(0.004, 0.08, loc=(0.12, 0.05, 0.26), color="brass", segs=4, base=True, rot=(0, 25, 0))
    for s in (1, -1):
        g.cyl(0.04, 0.02, loc=(0.16 + s * 0.06, 0.06, 0.24), color="black", segs=8, rot=(0, 90 * s, 0))
    g.box((0.13, 0.008, 0.008), loc=(0.16, 0.06, 0.28), color="iron")
    return g


def picture_frame(A):
    g = A.geo()
    y = 0.47
    g.box((0.6, 0.04, 0.45), loc=(0, y, 1.45), color="wood_dark", bevel=0.01)
    g.box((0.5, 0.045, 0.35), loc=(0, y - 0.003, 1.45), color="paper")
    for k, (x, z, c) in enumerate(((-0.12, 1.5, "sepia"), (0.12, 1.43, "fabric_blue"), (-0.05, 1.38, "paper_dark"))):
        g.box((0.16, 0.05, 0.12), loc=(x, y - 0.006, z), color=c, rot=(0, 8 * (k - 1), 0))
    return g


# Plats et objets ---------------------------------------------------------------

def bread(A):
    g = A.geo()
    crust = g.sphere(0.13, loc=(0, 0, 0.06), color="bread", segs=10, rings=6, scale=(1, 1, 0.55))
    # grignes à fleur: trois bandes fines plaquées sur les facettes du dessus (lancer de rayons sur la
    # miche, 1,5 mm au-dessus), découpées en 6 tronçons pour suivre les arêtes sans y plonger
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    vs = [v for v in crust if v.is_valid]
    idx = {v: i for i, v in enumerate(vs)}
    polys = [[idx[v] for v in f.verts] for f in {f for v in vs for f in v.link_faces}]
    tree = BVHTree.FromPolygons([v.co.copy() for v in vs], polys)

    def on_crust(x, y):
        hit = tree.ray_cast(Vector((x, y, 1.0)), Vector((0, 0, -1)))
        return (x, y, (hit[0].z if hit[0] is not None else 0.13) + 0.0015)
    ca, sa = math.cos(math.radians(30)), math.sin(math.radians(30))
    n = 6
    for k in range(3):
        cy = -0.04 + k * 0.04
        pts, faces = [], []
        for i in range(n + 1):
            u = -0.035 + 0.07 * i / n
            for v in (-0.006, 0.006):
                pts.append(on_crust(u * ca - v * sa, u * sa + v * ca + cy))
        for i in range(n):
            faces.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
        g.mesh(pts, faces, "bread_crust")
    return g


def plate(g, r=0.14):
    g.lathe([(0.07, 0.0), (r * 0.7, 0.012), (r, 0.03), (r * 0.92, 0.03), (r * 0.65, 0.016)], colors="ceramic", segs=12,
            close_top=True)
    g.cyl(r * 0.95, 0.004, loc=(0, 0, 0.028), color="ceramic_blue", segs=12)
    g.cyl(r * 0.88, 0.004, loc=(0, 0, 0.03), color="ceramic", segs=12)


def dish_radishes(A):
    g = A.geo()
    plate(g)
    for k in range(5):
        a = math.radians(k * 72)
        g.sphere(0.028, loc=(0.065 * math.cos(a), 0.065 * math.sin(a), 0.055), color="radish", segs=6, rings=4)
        g.box((0.03, 0.01, 0.01), loc=(0.09 * math.cos(a), 0.09 * math.sin(a), 0.06), color="leaf_crop", rot=(0, 0, k * 72))
    g.sphere(0.02, loc=(0, 0, 0.045), color="white_paint", segs=5, rings=3, scale=(1, 1, 0.5))
    return g


def dish_omelette(A):
    g = A.geo()
    plate(g)
    g.cyl(0.1, 0.03, loc=(0, 0, 0.03), color="flower_yellow", segs=10, scale=(1, 0.6, 1), r2=0.08)
    for k in range(3):
        g.box((0.015, 0.015, 0.01), loc=(-0.04 + k * 0.04, 0.0, 0.048), color="leaf_crop")  # herbes posées sur l'omelette
    return g


def dish_soup(A):
    g = A.geo()
    g.lathe([(0.05, 0.0), (0.08, 0.02), (0.11, 0.07), (0.115, 0.08), (0.105, 0.08), (0.09, 0.05)], colors=["ceramic_blue",
            "ceramic", "ceramic", "ceramic_blue", "ceramic"], segs=12)
    g.cyl(0.1, 0.004, loc=(0, 0, 0.07), color="soup", segs=12)
    for k in range(4):
        a = math.radians(k * 90 + 20)
        g.box((0.02, 0.02, 0.006), loc=(0.05 * math.cos(a), 0.05 * math.sin(a), 0.073), color="carrot" if k % 2 else "leaf_crop")
    # cuillère posée dans le bol, le manche appuyé sur le bord (il ne le traverse plus)
    g.box((0.012, 0.15, 0.008), loc=(0.04, 0.03, 0.088), color="tin", rot=(14, 0, 30))
    return g


def parcel(A):
    g = A.geo()
    g.box((0.5, 0.36, 0.3), color="paper_dark", base=True, bevel=0.01)
    g.box((0.51, 0.04, 0.31), loc=(0, 0, 0), color="rope", base=True)
    g.box((0.04, 0.37, 0.31), loc=(0, 0, 0), color="rope", base=True)
    g.box((0.14, 0.1, 0.004), loc=(0.14, -0.1, 0.3), color="paper", base=True)
    g.box((0.04, 0.04, 0.004), loc=(-0.16, 0.1, 0.302), color="flower_red", base=True)
    return g


def iron_box(A):
    g = A.geo()
    g.box((0.3, 0.2, 0.12), color="tin_paint", base=True, bevel=0.01)
    g.box((0.31, 0.21, 0.035), loc=(0, 0, 0.11), color="tin_paint", base=True, bevel=0.008)
    g.box((0.2, 0.004, 0.06), loc=(0, -0.102, 0.05), color="paint_cream")
    g.box((0.1, 0.004, 0.03), loc=(0, -0.104, 0.05), color="paint_red")
    for (x, y) in ((-0.12, 0.08), (0.1, -0.06)):
        g.box((0.05, 0.04, 0.004), loc=(x, y, 0.145), color="rust", base=True)
    return g


def riddle_card(A):
    g = A.geo()
    g.box((0.16, 0.11, 0.004), color="paper", base=True, rot=(0, 0, 6))
    for k in range(4):
        g.box((0.12 - (k % 2) * 0.03, 0.006, 0.002), loc=(-0.005, 0.03 - k * 0.018, 0.004), color="sepia_dark", base=True, rot=(0, 0, 6))
    g.box((0.03, 0.02, 0.002), loc=(0.05, -0.04, 0.004), color="sepia_dark", base=True)
    return g


def shed_key(A):
    g = A.geo()
    g.lathe([(0.035, -0.005), (0.035, 0.005)], colors="iron", segs=10, rot=(0, 0, 0))
    g.cyl(0.02, 0.012, loc=(0, 0, 0.006), color="shadow", segs=8)
    g.box((0.16, 0.014, 0.01), loc=(0.11, 0, 0.005), color="iron")
    g.box((0.02, 0.03, 0.01), loc=(0.17, 0.02, 0.005), color="iron")
    g.box((0.02, 0.022, 0.01), loc=(0.14, 0.016, 0.005), color="iron")
    g.box((0.03, 0.03, 0.004), loc=(-0.05, 0.04, 0.002), color="paper_dark", rot=(0, 0, 30))
    return g


def old_photo(A):
    g = A.geo()
    g.box((0.2, 0.15, 0.004), color="paper", base=True)
    g.box((0.17, 0.12, 0.002), loc=(0, 0.005, 0.004), color="sepia", base=True)
    g.box((0.1, 0.03, 0.002), loc=(0, -0.01, 0.006), color="sepia_dark", base=True)
    g.box((0.04, 0.03, 0.002), loc=(0.03, 0.02, 0.006), color="sepia_dark", base=True)
    g.box((0.015, 0.04, 0.002), loc=(-0.05, 0.025, 0.006), color="sepia_dark", base=True)
    return g


def jay_feather(A):
    g = A.geo()
    g.lathe([(0.05, 0.0), (0.06, 0.06), (0.03, 0.14), (0.025, 0.18), (0.03, 0.2)], colors="glass", segs=8)
    g.cyl(0.004, 0.32, loc=(0.0, 0.0, 0.08), color="paper", segs=4, base=True, rot=(0, 10, 0))
    for k in range(6):
        z = 0.24 + k * 0.03
        g.box((0.05, 0.004, 0.028), loc=(0.02 + 0.005 * k, 0.0, z), color="jay_blue" if k % 2 == 0 else "jay_stripe", rot=(0, 10, 0))
    g.box((0.04, 0.004, 0.08), loc=(0.055, 0.0, 0.43), color="feather_brown", rot=(0, 18, 0))
    return g


# Kit de modules (P1) ---------------------------------------------------------------

def kit_wall(A, kind, opening=None):
    g = A.geo()
    t = 0.3
    col = {"stone": "stone", "wood": "wood"}[kind]
    inner = "plaster_cream" if kind == "stone" else "wood_new"
    g.box((1.0, t, 2.4), loc=(0, 0.5 - t / 2, 0), color=lambda f: inner if f.normal.y < -0.7 else col, base=True)
    if kind == "wood":
        for k in range(8):
            g.box((1.0, 0.02, 0.02), loc=(0, 0.5 - t - 0.005, 0.15 + k * 0.3), color="wood_dark")
    f = Face("front", 0.5, 0.5 - t)
    if opening == "door":
        door(g, f, 0.0, w=0.85, h=2.05, color="wood_new", step=False)
    elif opening == "window":
        window(g, f, 0.0, 0.9, 0.6, 0.9, shutter=None)
    return g


def kit_floor(A):
    g = A.geo()
    for k in range(2):
        g.box((1.0, 0.49, 0.06), loc=(0, -0.25 + k * 0.5, 0), color="wood" if k else "wood_new", base=True)
    return g


def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    # low poly arrondi (bible section 8.2): meubles et objets vus de près, dans la pièce
    lpl.AUTO_ROUND = True
    lpl.AUTO_MIN = (0.3, 0.03)
    furn = []
    furn.append(A.add("straw_mattress", straw_mattress(A), {"footprint": [1, 2], "sleep_height": 0.15}))
    furn.append(A.add("double_bed", double_bed(A), {"footprint": [2, 2], "sleep_height": 0.5,
                                                     "sleep_spots": [[-0.36, 0.0], [0.36, 0.0]]}))
    furn.append(A.add("mattress", mattress_item(A), {"kind": "item"}))
    furn.append(A.add("table", table(A), {"footprint": [2, 1], "top_height": 0.78}))
    furn.append(A.add("chair", chair(A), {"footprint": [1, 1], "seat_height": 0.47}))
    furn.append(A.add("chest", chest(A), {"footprint": [1, 1]}))
    furn.append(A.add("shelf", shelf(A), {"footprint": [2, 1], "wall": True}))
    furn.append(A.add("stove", stove(A), {"footprint": [1, 1], "station": "stove"}))
    furn.append(A.add("flower_pot", flower_pot(A), {"footprint": [1, 1]}))
    furn.append(oil_lamp(A))
    furn.append(A.add("rug", rug(A), {"footprint": [2, 2], "floor": True}))
    furn.append(A.add("curtains", curtains(A), {"footprint": [1, 1], "wall": True}))
    furn.append(A.add("crystal_radio", crystal_radio(A), {"footprint": [1, 1]}))
    furn.append(A.add("wood_stove", wood_stove(A), {"footprint": [1, 1], "tier": "P1"}))
    furn.append(A.add("picture_frame", picture_frame(A), {"footprint": [1, 1], "wall": True, "tier": "P1"}))
    # tour 9 (maison_t9.py): objets muraux du catalogue, fauteuil, cadeaux, gelée de sureau
    wall = {"footprint": [1, 1], "wall": True}
    for name, fn in (("straw_hat", T9.straw_hat), ("pressed_flowers", T9.pressed_flowers),
                     ("autumn_wreath", T9.autumn_wreath), ("jeanne_drawing", T9.jeanne_drawing)):
        furn.append(A.add(name, fn(A), dict(wall)))
    cal = A.add("coop_calendar", T9.coop_calendar(A), dict(wall, seasons={
        s: "coop_calendar_" + s for s in ("spring", "summer", "autumn", "winter")},
        note="n'afficher que la gravure de la saison (enfant coop_calendar_<saison>)"))
    for s in ("spring", "summer", "autumn", "winter"):
        A.add("coop_calendar_" + s, T9.calendar_engraving(A, s), parent=cal)
    furn.append(cal)
    clock = A.add("wall_clock", T9.wall_clock(A), dict(wall, note=(
        "wall_clock_hour et wall_clock_minute: tourner autour de leur axe Z local (vers la pièce) selon l'heure du "
        "jeu, sens horaire vu de face; wall_clock_pendulum: pivot en haut, osciller de +-8 degrés autour de Z, "
        "une seconde par battement (tic-tac)")))
    yc, zc = 0.46, 1.75
    A.add("wall_clock_hour", T9.clock_hand(A, 0.07, 0.014), parent=clock, loc=(0, yc - 0.048, zc))
    A.add("wall_clock_minute", T9.clock_hand(A, 0.1, 0.009), parent=clock, loc=(0, yc - 0.052, zc))
    A.add("wall_clock_pendulum", T9.clock_pendulum(A), parent=clock, loc=(0, 0.47, zc - 0.16))
    furn.append(clock)
    furn.append(A.add("wicker_armchair", T9.wicker_armchair(A), {"footprint": [1, 1], "seat_height": 0.42}))
    # tour 10 (maison_t10.py): rangement à cases, râtelier, rideaux aux fenêtres
    t10_furn, _ = T10.build(A)
    furn += t10_furn
    items = []
    for name, fn in (("chalk_box", T9.chalk_box), ("coffee_mill", T9.coffee_mill), ("elder_jelly", T9.elder_jelly),
                     ("leather_apron", T9.leather_apron), ("wool_scarf", T9.wool_scarf)):
        items.append(A.add(name, fn(A), {"kind": "item"}))
    for name, fn in (("bread", bread), ("dish_radishes", dish_radishes), ("dish_omelette", dish_omelette),
                     ("dish_soup", dish_soup), ("parcel", parcel), ("iron_box", iron_box), ("riddle_card", riddle_card),
                     ("shed_key", shed_key), ("old_photo", old_photo), ("jay_feather", jay_feather)):
        items.append(A.add(name, fn(A), {"kind": "item"}))
    lpl.AUTO_ROUND = False  # modules de murs et de sol: ils se raccordent bord à bord
    kit = []
    for name, args in (("kit_wall_stone", ("stone", None)), ("kit_wall_wood", ("wood", None)),
                       ("kit_door", ("stone", "door")), ("kit_window", ("stone", "window"))):
        kit.append(A.add(name, kit_wall(A, *args), {"footprint": [1, 1], "tier": "P1",
                                                    "note": "mur sur le bord arrière de la case (-Z glTF), 2,4 m"}))
    kit.append(A.add("kit_floor_wood", kit_floor(A), {"footprint": [1, 1], "tier": "P1"}))
    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "maison.glb")
    size = lpl.export_glb(path, objs, animations=False)
    st = A.stats()
    lpl.write_stats("maison", {"nodes": st, "file_bytes": size})
    print("MAISON", size, {k: v["tris"] for k, v in st.items()})

    def sp(r):
        fp = r.get("footprint", [0.6, 0.6])
        return max(fp) + 0.4
    lpl.board(furn + items + kit, os.path.join(lpl.BOARDS, "maison.png"), cols=10, spacing=sp, label_size=0.1,
              res=(2000, 1200))


if __name__ == "__main__":
    main()
