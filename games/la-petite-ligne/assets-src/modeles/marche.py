"""Marché du dimanche et petits produits de la 0.12 (docs/jeux/jeu-1/v0-12-conception.md, sections 2.3, 2.4,
2.5, 2.7 et 6, lot L-rendu-modèles): étal déplié et replié, cagette, balance de marché, halle du marché, pots
de confiture et bocal, sacoche des plis de Lucie.

Lancer: duo-python marche.py
Produit: assets/modeles/marche.glb, stats/marche.json, blend/marche.blend (planches: planche_v012.py)

L'étal regarde vers les clients (+Z glTF, -Y ici); le marchand se tient derrière. La halle a la même origine
que l'étal (centre de la planche, au sol): poser l'une sur l'autre sans décalage.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from faune import seg  # noqa: E402

TOP = 0.85            # dessus de la planche (hauteur d'un plan de travail)
PLANK = (2.0, 0.7, 0.04)
TRESTLE_X = 0.72
CRATE = (0.42, 0.3, 0.16)
# places des cagettes sur la planche (repère glTF: x, hauteur, z vers les clients): 4, puis 6 avec market_crates
CRATE_SPOTS = [[-0.69, TOP, 0.17], [-0.23, TOP, 0.17], [0.23, TOP, 0.17], [0.69, TOP, 0.17],
               [-0.46, TOP, -0.17], [0.46, TOP, -0.17]]
SCALE_SPOT = [0.0, TOP, -0.2]


def trestle(g, x, folded=False, lean=0.0, y=0.0):
    """Tréteau: traverse de 0,7 m sous la planche, deux paires de pieds écartés en A (vus de face) et une
    entretoise. Replié: pieds rabattus l'un contre l'autre (posé à plat contre le mur par l'appelant)."""
    top = TOP - PLANK[2]
    g.box((0.08, 0.66, 0.07), loc=(x, y, top - 0.07), color="wood_dark", base=True)
    spread = 0.0 if folded else 0.13
    for sy in (-0.27, 0.27):
        for sx in (-1, 1):
            if folded:
                g.box((0.045, 0.045, top - 0.07), loc=(x + sx * 0.025, y + sy, 0), color="wood", base=True)
            else:
                seg(g, (x + sx * 0.02, y + sy, top - 0.07), (x + sx * (0.02 + spread), y + sy * 1.08, 0.0), 0.022,
                    0.02, "wood", segs=5)
    g.box((0.04, 0.52, 0.04), loc=(x + (0.075 if not folded else 0.05), y, 0.3), color="wood_dark")
    g.box((0.04, 0.52, 0.04), loc=(x - (0.075 if not folded else 0.05), y, 0.3), color="wood_dark")


def slate(g, loc, w=0.36, h=0.26, rot=(0, 0, 0)):
    """Ardoise de prix encadrée de bois, trois lignes de craie."""
    from lpl import _rot
    from mathutils import Matrix, Vector
    M = Matrix.Translation(Vector(loc)) @ _rot(rot)
    vs = g.box((w, 0.02, h), color="wood_new")
    g.transform(vs, M)
    vs = g.box((w - 0.05, 0.022, h - 0.05), color="black")
    g.transform(vs, M)
    for k, L in enumerate((0.2, 0.14, 0.17)):
        vs = g.box((L, 0.024, 0.014), loc=(-0.02 + (0.2 - L) / -2, 0, h / 2 - 0.06 - k * 0.055), color="white_paint")
        g.transform(vs, M)


def market_stall(A):
    """Étal déplié: planche de 2 m sur deux tréteaux, dessus à 0,85 m, bandeau de toile rayée devant et sur les
    côtés, ardoise de prix pendue au milieu du bandeau. Cagettes et balance: nœuds à part, posés aux places."""
    g = A.geo()
    W, D, T = PLANK
    g.box((W, D, T), loc=(0, 0, TOP - T), color="wood_new", base=True, bevel=0.01)
    for x in (-TRESTLE_X, TRESTLE_X):
        trestle(g, x)
    # bandeau de toile (drap rayé épinglé au chant de la planche), 0,22 m, devant et sur les côtés
    n = 10
    for k in range(n):
        x = -W / 2 + W / n * (k + 0.5)
        g.box((W / n, 0.012, 0.22), loc=(x, -D / 2 - 0.008, TOP - 0.22), color="awning_red" if k % 2 else "awning_cream",
              base=True)
    for sx in (-1, 1):
        for k in range(3):
            y = -D / 2 + D / 3 * (k + 0.5)
            g.box((0.012, D / 3, 0.22), loc=(sx * (W / 2 + 0.008), y, TOP - 0.22),
                  color="awning_cream" if k % 2 else "awning_red", base=True)
    slate(g, (0.0, -D / 2 - 0.03, TOP - 0.13))
    for x in (-0.12, 0.12):
        g.box((0.006, 0.006, 0.06), loc=(x, -D / 2 - 0.025, TOP - 0.02), color="rope", base=False)
    # caisse à monnaie (boîte en fer) côté marchand
    g.box((0.22, 0.14, 0.08), loc=(-0.15, 0.25, TOP), color="tin_paint", base=True)
    g.box((0.23, 0.15, 0.015), loc=(-0.15, 0.25, TOP + 0.08), color="tin", base=True)
    return g


def market_stall_stored(A):
    """Étal replié contre le mur de l'épicerie (dos contre le mur, -Z glTF): planche dressée sur son chant,
    tréteaux pieds rabattus, quatre cagettes empilées au bout; 0,45 m de profondeur, il ne barre rien."""
    g = A.geo()
    W, D, T = PLANK
    import mathutils
    from lpl import _rot
    # planche debout, penchée de 12 degrés vers le mur (dos du modèle à +Y Blender), haut contre le mur
    vs = g.box((W, T, D), loc=(0, 0, 0), color="wood_new", base=True, bevel=0.01)
    g.transform(vs, mathutils.Matrix.Translation((0, 0.06, 0)) @ _rot((-12, 0, 0)))
    # tréteaux rabattus (pieds refermés deux à deux sous la traverse), debout, penchés contre la planche
    for x in (-0.5, 0.25):
        vs = g.box((0.66, 0.07, 0.08), loc=(0, 0, 0.74), color="wood_dark", base=True)
        for sx in (-0.27, 0.27):
            for dy in (-0.024, 0.024):
                vs += g.box((0.045, 0.045, 0.74), loc=(sx, dy, 0.0), color="wood", base=True)
        vs += g.box((0.5, 0.03, 0.04), loc=(0, 0.0, 0.3), color="wood_dark")
        g.transform(vs, mathutils.Matrix.Translation((x, -0.1, 0)) @ _rot((-10, 0, 0)))
    # cagettes empilées au bout droit
    for x, z in ((0.78, 0.0), (0.78, CRATE[2])):
        crate_geo(g, (x, -0.18, z), rot=90)
    return g


def crate_geo(g, loc=(0, 0, 0), rot=0, color="wood_new"):
    """Cagette: fond, quatre coins, deux lattes par côté (0,42 x 0,30 x 0,16 m)."""
    from lpl import _rot
    from mathutils import Matrix, Vector
    M = Matrix.Translation(Vector(loc)) @ _rot((0, 0, rot))
    L, Wd, H = CRATE
    parts = []
    parts += g.box((L - 0.02, Wd - 0.02, 0.012), loc=(0, 0, 0.0), color="wood", base=True)
    for sx in (-1, 1):
        for sy in (-1, 1):
            parts += g.box((0.025, 0.025, H), loc=(sx * (L / 2 - 0.0125), sy * (Wd / 2 - 0.0125), 0), color="wood_dark",
                           base=True)
    for z in (0.025, 0.105):
        for sy in (-1, 1):
            parts += g.box((L, 0.01, 0.045), loc=(0, sy * (Wd / 2 - 0.005), z), color=color, base=True)
        for sx in (-1, 1):
            parts += g.box((0.01, Wd - 0.02, 0.045), loc=(sx * (L / 2 - 0.005), 0, z), color=color, base=True)
    g.transform(parts, M)


def market_crate(A):
    g = A.geo()
    crate_geo(g)
    return g


def _scale_pans(g):
    for x in (-0.1, 0.1):
        g.lathe([(0.02, 0.0), (0.075, 0.012), (0.08, 0.026)], loc=(x, 0, 0.16), colors="brass", segs=10,
                close_top=False)
        g.cyl(0.074, 0.006, loc=(x, 0, 0.165), color="brass", segs=10, base=True)


def market_scale_geo(A):
    """Balance de Roberval (achat du catalogue): socle de bois, fléau de fonte, deux plateaux de laiton,
    aiguille au milieu, deux poids; 0,32 x 0,14 m, 0,19 m de haut. Posée à SCALE_SPOT sur l'étal."""
    g = A.geo()
    g.box((0.32, 0.14, 0.05), color="wood_dark", base=True, bevel=0.008)
    g.box((0.24, 0.06, 0.05), loc=(0, 0, 0.05), color="iron", base=True)
    g.box((0.012, 0.02, 0.09), loc=(0, -0.031, 0.08), color="iron_light", base=True)
    for x in (-0.1, 0.1):
        g.cyl(0.015, 0.06, loc=(x, 0, 0.1), color="iron", segs=6, base=True)
    _scale_pans(g)
    # poids de laiton à côté
    for x, r in ((0.13, 0.016), (0.155, 0.012)):
        g.cyl(r, r * 2.2, loc=(x, -0.045, 0.05), color="brass", segs=6, base=True)
    return g


# Halle: 4 x 3 m, quatre poteaux de chêne sur dés de pierre, sablières et entraits à 2,4 m, aisseliers,
# toit de tuiles à deux pans (faîtage selon la longueur), au-dessus de l'étal et de ses clients.
HALL = {"x": 1.85, "y": 1.3, "plate": 2.4, "ridge": 3.35}


def market_hall(A):
    import bourg
    H = HALL
    root = A.group("market_hall", {"footprint": [4, 3], "same_origin_as": "market_stall",
                                   "clear_height": 2.2,
                                   "note": "poteaux aux quatre coins, hors des pieds de l'étal et du passage devant; "
                                           "sablières de 2,2 à 2,4 m (au-dessus des têtes)"})
    g = A.geo()
    px, py = H["x"], H["y"]
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.box((0.3, 0.3, 0.18), loc=(sx * px, sy * py, 0), color="stone", base=True, bevel=0.03, bseg=1)
            # poteau arrêté sous la sablière (elle pose dessus, elle ne le traverse pas)
            g.box((0.18, 0.18, H["plate"] - 0.2 - 0.18), loc=(sx * px, sy * py, 0.18), color="wood_dark", base=True,
                  bevel=0.02, bseg=1)
            # aisseliers: du poteau à la sablière (long) et à l'entrait (court)
            for d in ("x", "y"):
                a = 0.45
                if d == "x":
                    p0 = (sx * px - sx * 0.05, sy * py, H["plate"] - a - 0.1)
                    p1 = (sx * px - sx * (a + 0.05), sy * py, H["plate"] - 0.1)
                else:
                    p0 = (sx * px, sy * py - sy * 0.05, H["plate"] - a + 0.05)
                    p1 = (sx * px, sy * py - sy * (a + 0.05), H["plate"] + 0.05)
                seg(g, p0, p1, 0.05, 0.05, "wood_dark", segs=6)
    # sablières (selon X) et entraits (selon Y)
    for sy in (-1, 1):
        g.box((2 * px + 0.4, 0.18, 0.2), loc=(0, sy * py, H["plate"] - 0.1), color="wood", bevel=0.02, bseg=1)
    for sx in (-1, 1):
        g.box((0.18, 2 * py + 0.18, 0.2), loc=(sx * px, 0, H["plate"] + 0.1), color="wood", bevel=0.02, bseg=1)
        # poinçon et arbalétriers du pignon
        g.box((0.14, 0.14, H["ridge"] - H["plate"] - 0.2), loc=(sx * px, 0, H["plate"] + 0.2), color="wood_dark",
              base=True)
        for sy in (-1, 1):
            seg(g, (sx * px, sy * (py + 0.02), H["plate"] + 0.22), (sx * px, 0, H["ridge"] - 0.06), 0.06, 0.06, "wood",
                segs=6)
    A.add("market_hall_frame", g, parent=root)
    r = A.geo()
    bourg.gable_roof(r, -px - 0.1, px + 0.1, -py - 0.1, py + 0.1, H["plate"] + 0.2, H["ridge"], "tile", edge="tile_dark",
                     over=0.3, thick=0.08, strips=3, ridge_color="tile_dark")
    A.add("market_hall_roof", r, parent=root)
    return root


def blackberry_jam(A):
    """Pot de confiture de mûres: même bocal que la gelée de sureau (maison_t9.elder_jelly), confiture violet
    noir, coiffe de vichy bleu (la gelée a la coiffe rouge: on les distingue sur l'étal)."""
    g = A.geo()
    g.lathe([(0.035, 0.0), (0.04, 0.008), (0.04, 0.07), (0.034, 0.078)], colors="glass", segs=10)
    g.cyl(0.0405, 0.055, loc=(0, 0, 0.008), color="blackberry", segs=10, base=True)
    g.lathe([(0.046, 0.068), (0.04, 0.085), (0.0, 0.09)], colors="fabric_blue", segs=10, close_bottom=False)
    g.cyl(0.036, 0.006, loc=(0, 0, 0.076), color="rope", segs=10)
    g.box((0.04, 0.004, 0.025), loc=(0, -0.041, 0.035), color="paper")
    return g


def jar(A):
    """Bocal vide (ingrédient acheté chez Odette): verre, couvercle de fer-blanc."""
    g = A.geo()
    g.lathe([(0.035, 0.0), (0.04, 0.008), (0.04, 0.07), (0.034, 0.078)], colors="glass", segs=10)
    g.cyl(0.036, 0.012, loc=(0, 0, 0.078), color="tin", segs=10, base=True)
    return g


def mail_bag(A):
    """Sacoche de cuir de Lucie (0,40 x 0,14 m, 0,30 m de haut), rabat bouclé, plis qui dépassent, bandoulière
    lovée à côté. Origine au fond: la poser sur l'assise du banc du quai (0,455 m)."""
    g = A.geo()
    g.box((0.4, 0.14, 0.28), color="leather", base=True, bevel=0.02, bseg=1)
    # plis qui dépassent du haut
    for k, (x, c) in enumerate(((-0.1, "paper"), (-0.03, "paper_dark"), (0.06, "paper"))):
        g.box((0.12, 0.012, 0.06), loc=(x, 0.02 - k * 0.02, 0.27), color=c, base=True, rot=(0, 4 * (k - 1), 0))
    # rabat sur le devant (-Y), deux sangles et leurs boucles
    g.box((0.41, 0.15, 0.025), loc=(0, 0.0, 0.28), color="leather", base=True)
    g.box((0.41, 0.02, 0.15), loc=(0, -0.08, 0.14), color="leather", base=True)
    for x in (-0.11, 0.11):
        g.box((0.03, 0.025, 0.12), loc=(x, -0.083, 0.06), color="wood_dark", base=True)
        g.box((0.04, 0.03, 0.03), loc=(x, -0.085, 0.13), color="brass", base=True)
    # bandoulière lovée sur le banc
    pts = [(0.2 + 0.08 * math.cos(math.radians(a)), 0.02 + 0.06 * math.sin(math.radians(a)), 0.012)
           for a in range(-90, 271, 45)]
    for a, b in zip(pts, pts[1:]):
        seg(g, a, b, 0.012, 0.012, "wood_dark", segs=5)
    return g


def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    A.add("market_stall", market_stall(A), {"footprint": [2, 1], "top": TOP, "crate_spots": CRATE_SPOTS,
                                            "scale_spot": SCALE_SPOT, "crate_model": "market_crate",
                                            "seller_side": "-z",
                                            "note": "clients devant (+Z), marchand derrière (-Z); 4 cagettes aux "
                                                    "quatre premières places, 6 avec market_crates; balance à "
                                                    "scale_spot"})
    A.add("market_stall_stored", market_stall_stored(A), {"footprint": [2, 1], "against_wall": "-z",
                                                          "note": "dos (-Z) contre le mur de l'épicerie"})
    A.add("market_crate", market_crate(A), {"kind": "item", "goods_height": 0.012, "size": list(CRATE),
                                            "note": "cagette (objet de l'établi et place de l'étal)"})
    A.add("market_scale", market_scale_geo(A), {"kind": "prop", "on": "market_stall.scale_spot"})
    lpl.AUTO_ROUND = True
    # plafonds relevés (bible, 350 000 triangles): halle arrondie jusqu'aux dés et aux poteaux
    lpl.AUTO_MIN = (0.6, 0.08)
    market_hall(A)
    lpl.AUTO_ROUND = False
    A.add("blackberry_jam", blackberry_jam(A), {"kind": "item", "size_m": 0.09})
    A.add("jar", jar(A), {"kind": "item", "size_m": 0.09})
    A.add("mail_bag", mail_bag(A), {"kind": "prop", "rest_height": 0.455,
                                    "note": "sur l'assise du banc du quai (quay_bench), à plat"})

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "marche.glb")
    size = lpl.export_glb(path, objs, animations=False)
    st = A.stats()
    lpl.write_stats("marche", {"nodes": st, "file_bytes": size})
    os.makedirs(os.path.join(lpl.HERE, "blend"), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "marche.blend"), compress=True)
    print("MARCHE", size, {k: v["tris"] for k, v in st.items()})


if __name__ == "__main__":
    main()
