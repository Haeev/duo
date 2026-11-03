"""Détails de façade de la 0.12 (passe beauté des bâtiments les plus vus: maisonnette, halte, épicerie, mercerie,
fournil): gouttières pendues sous la rive, descentes d'eau avec leur col de cygne et leur dauphin, pots de fleurs
au pied des portes, jardinières en boules.

Appelé par bourg.py, interieurs.py et rue_haute.py. Les gouttières vont dans le nœud du toit (elles tombent avec
lui quand on coupe le toit, et elles se posent avec leur bande de toit au chantier de la maisonnette), les
descentes dans le nœud du mur qui les porte. L'égout est mesuré sur le maillage du toit déjà construit (bord le
plus bas du pan): la gouttière suit la vraie rive, quel que soit le modèle de toit.
"""
import math

from mathutils import Vector

GUTTER = "iron_light"


def eave(verts, side):
    """Égout d'un pan (side -1: devant, -Y; +1: derrière): y du bord, z du dessous de la rive, x min et max."""
    vs = [v.co for v in verts if v.is_valid]
    if side < 0:
        y_edge = min(c.y for c in vs)
        edge = [c for c in vs if c.y < y_edge + 0.03]
    else:
        y_edge = max(c.y for c in vs)
        edge = [c for c in vs if c.y > y_edge - 0.03]
    return y_edge, min(c.z for c in edge), min(c.x for c in edge), max(c.x for c in edge)


def rod(g, p, q, r, color, segs=8):
    p, q = Vector(p), Vector(q)
    d = q - p
    rot = d.to_track_quat("Z", "Y").to_euler()
    return g.cyl(r, d.length, loc=tuple((p + q) / 2), color=color, segs=segs,
                 rot=tuple(math.degrees(a) for a in rot))


def gutter_line(y_edge, z_under, side, r=0.05):
    """Axe de la gouttière (y, z) sous la rive d'un pan."""
    return y_edge - side * 0.045, z_under - r + 0.004


def gutter(g, side, y_edge, z_under, x0, x1, r=0.05, trim=(0.04, 0.04), hooks=True):
    """Gouttière (tube de 10 cm) juste sous la rive, de x0 à x1, avec ses crochets."""
    yc, zc = gutter_line(y_edge, z_under, side, r)
    rod(g, (x0 + trim[0], yc, zc), (x1 - trim[1], yc, zc), r, GUTTER, segs=8)
    if hooks:
        n = max(1, int((x1 - x0) / 0.9))
        for k in range(n + 1):
            x = x0 + 0.1 + (x1 - x0 - 0.2) * k / n
            g.box((0.025, 0.06, 0.02), loc=(x, yc + side * 0.02, zc + r + 0.006), color="iron")
    return yc, zc


def pipe_neck(g, side, x, y_face, yc, zc, d=0.075, r=0.034):
    """Col de cygne: du dessous de la gouttière au mur (nœud du toit)."""
    yp = y_face + side * d  # side -1: devant (-Y), la descente est dehors
    z_knee = zc - 0.06 - abs(yc - yp) * 0.8
    rod(g, (x, yc, zc), (x, yc, zc - 0.07), r, GUTTER)
    rod(g, (x, yc, zc - 0.07), (x, yp, z_knee), r, GUTTER)
    return z_knee


def pipe_upper(g, side, x, y_face, yc, zc, z_split, d=0.075, r=0.034):
    """Haut du tuyau, du col de cygne à z_split (étage d'un bâtiment coupé en deux nœuds), avec un collier."""
    yp = y_face + side * d  # side -1: devant (-Y), la descente est dehors
    z_knee = zc - 0.06 - abs(yc - yp) * 0.8
    rod(g, (x, yp, z_knee + 0.02), (x, yp, z_split), r, GUTTER)
    z = (z_knee + z_split) / 2
    g.box((0.02, d + 0.01, 0.03), loc=(x, y_face + side * (d / 2), z), color="iron")
    rod(g, (x, yp, z - 0.018), (x, yp, z + 0.018), r + 0.007, "iron")


def pipe_wall(g, side, x, y_face, yc, zc, d=0.075, r=0.034, z_bottom=0.16, z_split=None):
    """Tuyau de descente le long du mur, colliers et dauphin coudé au pied (nœud du mur). z_split: le haut du
    tuyau est dans le nœud de l'étage (pipe_upper)."""
    yp = y_face + side * d  # side -1: devant (-Y), la descente est dehors
    z_knee = zc - 0.06 - abs(yc - yp) * 0.8
    rod(g, (x, yp, (z_knee + 0.02) if z_split is None else z_split), (x, yp, z_bottom), r, GUTTER)
    rod(g, (x, yp, z_bottom + 0.01), (x, yp + side * 0.12, 0.05), r, GUTTER)
    zs = [0.75, 1.75] if (z_split is None or z_split > 1.9) else [0.75]
    for z in zs:
        if z < z_knee - 0.1:
            g.box((0.02, d + 0.01, 0.03), loc=(x, y_face + side * (d / 2), z), color="iron")
            rod(g, (x, yp, z - 0.018), (x, yp, z + 0.018), r + 0.007, "iron")


def flower_pot(g, x, y, scale=1.0, flowers=("flower_red", "flower_white", "flower_pink"), seed=0, rot=0.0):
    """Pot de terre cuite posé au sol (bord roulé), motte de feuillage et fleurs en boules."""
    s = scale
    g.lathe([(0.11 * s, 0.0), (0.15 * s, 0.24 * s), (0.17 * s, 0.25 * s), (0.17 * s, 0.29 * s), (0.155 * s, 0.29 * s)],
            loc=(x, y, 0), colors=["tile", "tile_dark", "tile_dark", "tile_dark"], segs=10, close_top=False)
    g.cyl(0.152 * s, 0.01, loc=(x, y, 0.265 * s), color="soil_tilled", segs=10)
    for k in range(6):
        a = math.radians(k * 60 + 17 * seed + rot)
        rr = 0.07 * s if k else 0.0
        g.sphere(0.085 * s, loc=(x + rr * math.cos(a), y + rr * math.sin(a), 0.33 * s + (0.05 * s if k == 0 else 0)),
                 color="leaf_bush", segs=6, rings=4, scale=(1, 1, 0.75))
    for k in range(5):
        a = math.radians(k * 72 + 31 * seed + rot)
        rr = 0.09 * s
        g.sphere(0.04 * s, loc=(x + rr * math.cos(a), y + rr * math.sin(a), 0.40 * s + 0.02 * s * (k % 2)),
                 color=flowers[k % len(flowers)], segs=6, rings=3)


def box_flowers(f, g, u, d, z, w):
    """Jardinière d'appui en boules (remplace les cubes): feuillage continu et fleurs qui dépassent."""
    n = max(4, int(w / 0.16))
    cols = ["flower_red", "flower_pink", "flower_white", "flower_red", "flower_yellow"]
    for k in range(n):
        uu = u - w / 2 + 0.06 + k * (w - 0.12) / (n - 1)
        p = f.p(uu, d, z + 0.07)
        g.sphere(0.075, loc=p, color="leaf_bush", segs=6, rings=4, scale=(1.1, 1.0, 0.75))
    for k in range(n - 1):
        uu = u - w / 2 + 0.12 + k * (w - 0.24) / max(1, n - 2)
        p = f.p(uu, d + (0.03 if k % 2 else -0.02), z + 0.13 + 0.02 * (k % 2))
        g.sphere(0.04, loc=p, color=cols[k % len(cols)], segs=6, rings=3)
