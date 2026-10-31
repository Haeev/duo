"""Bourg de la Halte d'Aubrune: bâtiments, voie, quai, décor, nature, rivière.

Lancer: duo-python bourg.py
Produit: assets/modeles/bourg.glb, planches/bourg-*.png

Repères (côté Blender): façade principale vers -Y (devient +Z en glTF), origine au
centre de l'emprise, au sol. Les bâtiments où l'on entre ont leurs murs, sol et
toit en nœuds séparés (pour les couper quand un personnage entre).
"""
import math
import os
import random
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402


# Outils de construction ---------------------------------------------------------

class Face:
    """Repère d'un mur: u le long du mur (vers la droite vu de dehors), d vers l'extérieur."""

    def __init__(self, side, hx, hy):
        self.side, self.hx, self.hy = side, hx, hy
        self.rz = {"front": 0, "back": 180, "left": -90, "right": 90}[side]

    def p(self, u, d, z):
        s, hx, hy = self.side, self.hx, self.hy
        if s == "front":
            return (u, -hy - d, z)
        if s == "back":
            return (-u, hy + d, z)
        if s == "left":
            return (-hx - d, -u, z)
        return (hx + d, u, z)

    def box(self, g, size, u, d, z, color, rot=(0, 0, 0), **kw):
        return g.box(size, loc=self.p(u, d, z), color=color, rot=(rot[0], rot[1], rot[2] + self.rz), **kw)


def window(g, f, u, z0, w=0.8, h=1.0, shutter="paint_green", frame="stone_light", ruin=False, mullion=True,
           box_flowers=False, rb=0.0):
    """rb > 0: low poly arrondi (chanfrein des menuiseries, en mètres)."""
    kb = {"bevel": rb} if rb else {}
    f.box(g, (w + 0.18, 0.06, h + 0.18), u, 0.02, z0 + h / 2, frame, **kb)
    f.box(g, (w, 0.02, h), u, 0.055, z0 + h / 2, "shadow" if ruin else "glass")
    if mullion and not ruin:
        f.box(g, (0.04, 0.02, h), u, 0.07, z0 + h / 2, frame)
        f.box(g, (w, 0.02, 0.04), u, 0.07, z0 + h * 0.62, frame)
    f.box(g, (w + 0.26, 0.16, 0.06), u, 0.08, z0 - 0.04, frame, **kb)
    if shutter:
        for s in (1, -1):
            if ruin and s == 1:
                f.box(g, (w / 2, 0.04, h * 0.95), u + s * (w * 0.75 + 0.12), 0.18, z0 + h / 2 - 0.12, "wood_old",
                      rot=(0, 18, 25))
                continue
            col = "wood_old" if ruin else shutter
            f.box(g, (w / 2, 0.04, h), u + s * (w * 0.75 + 0.1), 0.04, z0 + h / 2, col, **kb)
            f.box(g, (w / 2 + 0.01, 0.05, 0.05), u + s * (w * 0.75 + 0.1), 0.045, z0 + h * 0.25,
                  "wood_old_dark" if ruin else "wood_dark")
            f.box(g, (w / 2 + 0.01, 0.05, 0.05), u + s * (w * 0.75 + 0.1), 0.045, z0 + h * 0.75,
                  "wood_old_dark" if ruin else "wood_dark")
    if box_flowers and not ruin:
        f.box(g, (w + 0.1, 0.2, 0.16), u, 0.16, z0 + 0.02, "wood", **kb)
        for k in range(5):
            c = ["flower_red", "flower_pink", "flower_white", "flower_red", "flower_yellow"][k]
            f.box(g, (0.12, 0.12, 0.1), u - w / 2 + 0.1 + k * (w - 0.2) / 4, 0.16, z0 + 0.14, c, rot=(0, 0, 20 * k))
        f.box(g, (w + 0.05, 0.16, 0.06), u, 0.16, z0 + 0.1, "leaf_bush")


def door(g, f, u, w=0.95, h=2.05, color="paint_red", frame="stone_light", absent=False, step=True, leaf=True,
         glass=False, rb=0.0):
    kb = {"bevel": rb} if rb else {}
    f.box(g, (w + 0.2, 0.06, h + 0.12), u, 0.02, (h + 0.12) / 2, frame, **kb)
    f.box(g, (w, 0.03, h), u, 0.045, h / 2, "shadow")
    if not absent and leaf:
        f.box(g, (w - 0.04, 0.05, h - 0.03), u, 0.06, (h - 0.03) / 2, color, **kb)
        for z in (0.45, 1.5):
            f.box(g, (w - 0.2, 0.06, 0.5 if z > 1 else 0.6), u, 0.065, z, "wood_dark" if color.startswith("wood") else color,
                  bevel=0.01)
        if glass:
            f.box(g, (w - 0.3, 0.07, 0.5), u, 0.068, 1.55, "glass")
        f.box(g, (0.05, 0.05, 0.05), u + w / 2 - 0.12, 0.1, 1.0, "brass")
    if step:
        f.box(g, (w + 0.4, 0.4, 0.12), u, 0.2, 0.06, "stone_dark", bevel=0.02, bseg=2 if rb else 1,
              bedges=_not_ground if rb else None)


def slab(g, top, thick, color):
    """Plaque: quad du dessus (sens trigonométrique vu du dessus) et épaisseur vers le bas."""
    a, b, c, d = [Vector(p) for p in top]
    n = (b - a).cross(d - a).normalized()
    bot = [p - n * thick for p in (a, b, c, d)]
    pts = [tuple(p) for p in (a, b, c, d)] + [tuple(p) for p in bot]
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return g.mesh(pts, faces, color)


def gable_roof(geos, x0, x1, y0, y1, ze, zr, color, edge=None, over=0.35, thick=0.14, strips=1, holes=(),
               ridge=True, ridge_color=None, rafters=False):
    """Toit à deux pans, faîtage selon X, en low poly arrondi (bible section 8.3): rives chanfreinées en
    2 segments, faîtage fléchi et pans bombés, rangs de tuiles qui suivent la surface, faîtage en boudin.
    Le toit est relevé de 3 cm pour que les pignons et le haut des murs ne le percent pas.
    geos: liste de Geo (une par bande) ou un Geo. Renvoie le nombre de bandes posées.
    holes: indices de bandes manquantes (ruine)."""
    import bmesh
    lift = 0.03
    ym = (y0 + y1) / 2
    slope = (zr - ze) / (ym - y0)
    zl = ze - over * slope + lift
    zrr = zr + lift
    xa, xb = x0 - over, x1 + over
    span = x1 - x0
    sag = min(0.08, 0.015 * span + 0.01)
    bulge = min(0.06, 0.012 * span + 0.01)
    rb = min(0.06, thick * 0.42)
    edge = edge or color
    col = by_normal(color, edge, edge, thr=0.3)
    xs = [xa + (xb - xa) * i / strips for i in range(strips + 1)]

    def surf(side, t, x):
        e = y0 - over if side < 0 else y1 + over
        u = (x - xa) / (xb - xa)
        dz = bulge * math.sin(math.pi * t) - sag * t * math.sin(math.pi * u)
        return Vector((x, e + (ym - e) * t, zl + (zrr - zl) * t + dz))

    def key(p):
        return (round(p.x, 4), round(p.y, 4), round(p.z, 4))

    k = 0
    for side in (-1, 1):
        n = Vector((0, side * slope, 1)).normalized()
        for i in range(strips):
            gi = geos[k] if isinstance(geos, list) else geos
            idx = k
            k += 1
            if idx in holes:
                continue
            a, b = xs[i], xs[i + 1]
            cols = [a, (a + b) / 2, b]
            bm = gi.bm
            T = [[bm.verts.new(surf(side, t, x)) for x in cols] for t in (0.0, 0.5, 1.0)]
            B = [[bm.verts.new(surf(side, t, x) - n * thick) for x in cols] for t in (0.0, 0.5, 1.0)]
            faces = []
            for r in range(2):
                for c in range(2):
                    faces.append(bm.faces.new([T[r][c], T[r][c + 1], T[r + 1][c + 1], T[r + 1][c]]))
                    faces.append(bm.faces.new([B[r][c], B[r + 1][c], B[r + 1][c + 1], B[r][c + 1]]))
                faces.append(bm.faces.new([T[0][r], B[0][r], B[0][r + 1], T[0][r + 1]]))
                faces.append(bm.faces.new([T[2][r + 1], B[2][r + 1], B[2][r], T[2][r]]))
                faces.append(bm.faces.new([T[r + 1][0], B[r + 1][0], B[r][0], T[r][0]]))
                faces.append(bm.faces.new([T[r][2], B[r][2], B[r + 1][2], T[r + 1][2]]))
            bmesh.ops.recalc_face_normals(bm, faces=faces)
            rim = set()
            for c in range(2):
                rim.add(frozenset((key(T[0][c].co), key(T[0][c + 1].co))))
            for c in ([0] if i == 0 else []) + ([2] if i == strips - 1 else []):
                for r in range(2):
                    rim.add(frozenset((key(T[r][c].co), key(T[r + 1][c].co))))
            verts = [v for row in T + B for v in row]
            gi._finish(verts, col)
            if rim:
                gi.bevel(verts, rb, 2, col, edges_pred=lambda p, q, rim=rim: frozenset((key(p), key(q))) in rim)
            # rangs de tuiles ou de lauzes: une petite marche simple tous les 42 cm, qui suit la surface
            L = math.hypot(ym - y0 + over, zr - ze + over * slope)
            nr = int(L / (0.42 if strips == 1 else 0.6))  # toits en bandes (chantier): rangs plus espacés
            ang = math.degrees(math.atan(slope)) * (-side)
            pieces = 2 if strips == 1 else 1
            for jr in range(1, nr):
                t = jr / nr
                for m in range(pieces):
                    xc = a + (b - a) * (m + 0.5) / pieces
                    p = surf(side, t, xc)
                    gi.box(((b - a) / pieces - 0.02, 0.05, 0.03), loc=(p.x, p.y, p.z + 0.012), color=edge,
                           rot=(ang, 0, 0), no_round=True)
    if ridge:
        gi = geos[k] if isinstance(geos, list) else geos
        if k not in holes:
            # faîtage en boudin à 8 pans, par morceaux qui suivent la flèche
            nseg = max(2, strips)
            px = [xa + (xb - xa) * i / nseg for i in range(nseg + 1)]
            for i in range(nseg):
                pa, pb = surf(-1, 1.0, px[i]), surf(-1, 1.0, px[i + 1])
                mid = (pa + pb) / 2
                tilt = math.degrees(math.atan2(pb.z - pa.z, pb.x - pa.x))
                gi.cyl(min(0.12, 0.05 * span), (pb - pa).length + 0.03, loc=(mid.x, mid.y, mid.z + 0.01),
                       color=ridge_color or edge,
                       segs=8, rot=(0, 90 - tilt, 0))
        k += 1
    if rafters:
        gi = geos[-1] if isinstance(geos, list) else geos
        ang = math.degrees(math.atan(slope))
        L = math.hypot(ym - y0 + over, zr - ze + over * slope)
        for x in [x0 + 0.2 + i * 0.7 for i in range(int((x1 - x0) / 0.7) + 1)]:
            for side in (-1, 1):
                yc = (y0 - over + ym) / 2 if side < 0 else (y1 + over + ym) / 2
                gi.box((0.1, L, 0.12), loc=(x, yc, (zl + zrr) / 2 - 0.14), color="wood_old", rot=(ang * (-side), 0, 0))
    return k


def rotate_geo(g, deg):
    import bmesh
    from mathutils import Matrix
    bmesh.ops.rotate(g.bm, verts=list(g.bm.verts), cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(deg), 3, "Z"))
    g.bm.normal_update()


def gable_walls(g, x0, x1, y0, y1, ze, zr, color, t=0.3, inner=None):
    ym = (y0 + y1) / 2
    for x, s in ((x0, 1), (x1, -1)):
        col = color if not inner else (lambda f, s=s: inner if f.normal.x * s > 0.7 else color)
        g.prism([(y0, ze), (y1, ze), (ym, zr)], t, loc=(x + s * t / 2, 0, 0), color=col, rot=(0, 0, 90))


def quoins(g, hx, hy, z1, color="stone_light", step=0.32, sxs=(1, -1)):
    if lpl.AUTO_ROUND:
        # version légère (angles verticaux seuls abattus) pour tenir le budget des petits bâtiments
        return round_quoins(g, hx, hy, z1 - 0.1, color, step, sxs=sxs, light=True)
    for sx in sxs:
        for sy in (1, -1):
            z = 0.0
            i = 0
            while z < z1 - 0.05:
                h = min(step, z1 - z)
                big = i % 2 == 0
                g.box((0.42 if big else 0.26, 0.04, h - 0.03), loc=(sx * (hx - (0.21 if big else 0.13)), sy * (hy + 0.02), z + h / 2),
                      color=color)
                g.box((0.04, 0.26 if big else 0.42, h - 0.03), loc=(sx * (hx + 0.02), sy * (hy - (0.13 if big else 0.21)), z + h / 2),
                      color=color)
                z += h
                i += 1


# Low poly arrondi (décision du client du 2026-10-31, bible section 8) --------------------
# Facettes gardées (une normale par face), angles droits cassés: chanfreins en 2 segments au plus,
# largeur selon la taille de l'objet, arêtes au sol vives.

def _not_ground(a, b):
    return not (abs(a.z) < 1e-4 and abs(b.z) < 1e-4)


def _vertical(a, b):
    return abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4


def _along_y(a, b):
    return abs(a.x - b.x) < 1e-4 and abs(a.z - b.z) < 1e-4


def _key(p):
    return (round(p.x, 4), round(p.y, 4), round(p.z, 4))


def round_quoins(g, hx, hy, z1, color="stone_light", step=0.32, seed=7, sxs=(1, -1), light=False):
    """Chaînes d'angle en blocs aux coins abattus irréguliers (1 à 3 cm de décalage), qui enveloppent
    le coin arrondi du mur (saillie de 1,5 à 3 cm)."""
    rnd = random.Random(seed)
    for sx in sxs:
        for sy in (1, -1):
            z, i = 0.0, 0
            while z < z1 - 0.05:
                h = min(step, z1 - z)
                big = i % 2 == 0
                w, d = (0.44, 0.28) if big else (0.28, 0.44)
                w += rnd.uniform(-0.03, 0.03)
                d += rnd.uniform(-0.03, 0.03)
                out = rnd.uniform(0.015, 0.03)
                g.box((w, d, h - 0.03), loc=(sx * (hx + out - w / 2), sy * (hy + out - d / 2), z + 0.015),
                      color=color, base=True, bevel=rnd.uniform(0.02, 0.035), bseg=1,
                      bedges=_vertical if light else (_not_ground if z < 0.01 else None),
                      rot=(0, 0, rnd.uniform(-1.5, 1.5)))
                z += h
                i += 1


def round_stone_texture(g, f, length, height, color="stone_dark", n=10, seed=1, d=0.012):
    """Moellons à coins abattus irréguliers (1 à 3 cm)."""
    rnd = random.Random(seed)
    for _ in range(n):
        u = rnd.uniform(-length / 2 + 0.5, length / 2 - 0.5)
        z = rnd.uniform(0.5, height - 0.25)
        # seuls les coins du moellon sont abattus (arêtes dans l'épaisseur), pas ses bords de 3 cm
        f.box(g, (rnd.uniform(0.22, 0.4), 0.03, rnd.uniform(0.14, 0.22)), u, d, z, color,
              bevel=rnd.uniform(0.01, 0.03), rot=(0, rnd.uniform(-4, 4), 0), bedges=_along_y)


def round_chimney(g, x, y, z0, z1, color="stone", cap="stone_dark"):
    """Cheminée chanfreinée à 7 cm (2 segments), chapeau chanfreiné débordant de 6 cm."""
    g.box((0.55, 0.55, z1 - z0), loc=(x, y, z0), color=color, base=True, bevel=0.07, bseg=2)
    g.box((0.67, 0.67, 0.12), loc=(x, y, z1), color=cap, base=True, bevel=0.045, bseg=2)
    g.box((0.3, 0.3, 0.12), loc=(x, y, z1 + 0.1), color="shadow", base=True, bevel=0.015)


def round_gable_roof(g, x0, x1, y0, y1, ze, zr, color, edge, ridge_color, over_x=0.36, over_y=0.3,
                     thick=0.14, sag=0.08, bulge=0.06, rb=0.06):
    """Toit à deux pans arrondi: rive épaisse chanfreinée (2 segments), faîtage fléchi au milieu,
    pans un peu bombés (rangée intermédiaire relevée), rangs de tuiles qui suivent la surface."""
    import bmesh
    ym = (y0 + y1) / 2
    slope = (zr - ze) / (ym - y0)
    zl = ze - over_y * slope
    xa, xb = x0 - over_x, x1 + over_x
    xs = [xa, (xa + xb) / 2, xb]
    col = by_normal(color, edge, edge, thr=0.3)

    def surf(side, t, x):
        """Point du dessus du pan: t de l'égout (0) au faîtage (1)."""
        e = y0 - over_y if side < 0 else y1 + over_y
        yy = e + (ym - e) * t
        u = (x - xa) / (xb - xa)
        dz = bulge * math.sin(math.pi * t) - sag * t * math.sin(math.pi * u)
        return Vector((x, yy, zl + (zr - zl) * t + dz))

    bm = g.bm
    for side in (-1, 1):
        n = Vector((0, side * slope, 1)).normalized()
        top = [[surf(side, t, x) for x in xs] for t in (0.0, 0.5, 1.0)]
        T = [[bm.verts.new(p) for p in row] for row in top]
        B = [[bm.verts.new(p - n * thick) for p in row] for row in top]
        faces = []
        for i in range(2):
            for j in range(2):
                faces.append(bm.faces.new([T[i][j], T[i][j + 1], T[i + 1][j + 1], T[i + 1][j]]))
                faces.append(bm.faces.new([B[i][j], B[i + 1][j], B[i + 1][j + 1], B[i][j + 1]]))
            faces.append(bm.faces.new([T[0][i], B[0][i], B[0][i + 1], T[0][i + 1]]))
            faces.append(bm.faces.new([T[2][i + 1], B[2][i + 1], B[2][i], T[2][i]]))
            faces.append(bm.faces.new([T[i + 1][0], B[i + 1][0], B[i][0], T[i][0]]))
            faces.append(bm.faces.new([T[i][2], B[i][2], B[i + 1][2], T[i + 1][2]]))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        # arêtes du dessus à chanfreiner: égout et pignons (pas le faîtage, caché sous le boudin)
        rim = set()
        for j in range(2):
            rim.add(frozenset((_key(T[0][j].co), _key(T[0][j + 1].co))))
        for i in range(2):
            for c in (0, 2):
                rim.add(frozenset((_key(T[i][c].co), _key(T[i + 1][c].co))))
        verts = [v for row in T + B for v in row]
        g._finish(verts, col)
        g.bevel(verts, rb, 2, col, edges_pred=lambda a, b, rim=rim: frozenset((_key(a), _key(b))) in rim)
        # rangs de tuiles: une petite marche tous les 42 cm, en deux morceaux pour suivre la flèche
        L = math.hypot(ym - y0 + over_y, zr - zl)
        nr = int(L / 0.42)
        ang = math.degrees(math.atan(slope)) * (-side)
        for jr in range(1, nr):
            t = jr / nr
            for k in range(2):
                p = surf(side, t, xa + (xb - xa) * (0.25 + 0.5 * k))
                g.box(((xb - xa) / 2 - 0.03, 0.05, 0.035), loc=(p.x, p.y, p.z + 0.012), color=edge, rot=(ang, 0, 0))
    # faîtage: deux demi-boudins à 8 pans qui suivent la flèche
    for k in range(2):
        pa, pb = surf(-1, 1.0, xs[k]), surf(-1, 1.0, xs[k + 1])
        mid = (pa + pb) / 2
        tilt = math.degrees(math.atan2(pb.z - pa.z, pb.x - pa.x))
        g.cyl(0.12, (pb - pa).length + 0.04, loc=(mid.x, mid.y, mid.z + 0.01), color=ridge_color, segs=8,
              rot=(0, 90 - tilt, 0))


def chimney(g, x, y, z0, z1, color="stone", cap="stone_dark"):
    round_chimney(g, x, y, z0, z1, color, cap)


def wall_color(outer, inner, inward):
    iv = Vector(inward)

    def f(face):
        return inner if face.normal.dot(iv) > 0.7 else outer
    return f


def stone_texture(g, f, length, height, color="stone_dark", n=10, seed=1, d=0.012):
    """Quelques moellons en relief sur un mur (rythme, pas de bruit)."""
    rnd = random.Random(seed)
    for _ in range(n):
        u = rnd.uniform(-length / 2 + 0.3, length / 2 - 0.3)
        z = rnd.uniform(0.25, height - 0.25)
        f.box(g, (rnd.uniform(0.22, 0.4), 0.03, rnd.uniform(0.14, 0.22)), u, d, z, color)


# Maisonnette du garde-barrière (7 x 6) -------------------------------------------

GH = dict(hx=2.8, hy=2.3, ze=2.4, zr=3.9, t=0.3, floor=0.12)


def gatekeeper_house(A, ruin, parent):
    name = "gatekeeper_house_" + ("ruin" if ruin else "repaired")
    hx, hy, ze, zr, t, fl = GH["hx"], GH["hy"], GH["ze"], GH["zr"], GH["t"], GH["floor"]
    root = A.subgroup(name, parent, {"state": "ruin" if ruin else "repaired"})
    # sol et seuil
    g = A.geo()
    g.box((2 * hx - 0.02, 2 * hy - 0.02, fl), color="stone_dark", base=True)
    for i in range(10):
        x = -2.5 + 0.25 + i * 0.5
        g.box((0.48, 4.0, 0.02), loc=(x, 0, fl), color="wood_old" if ruin else ("wood" if i % 2 else "wood_new"),
              base=True)
    if ruin:
        for x, y in [(-1.6, 0.8), (1.2, -1.1), (0.4, 1.5), (-0.4, -0.3)]:
            g.box((0.3, 0.12, 0.03), loc=(x, y, fl + 0.02), color="wood_old_dark", rot=(0, 0, 37 * x))
        for x, y in [(0.9, 0.6), (-1.0, 1.2)]:
            g.sphere(0.12, loc=(x, y, fl), color="lauze", segs=5, rings=3, scale=(1.4, 1, 0.3))
    A.add(name + "_floor", g, parent=root)
    walls = {}
    color_out, color_in = "stone", "plaster_shade" if ruin else "plaster_cream"
    for side in ("front", "back", "left", "right"):
        g = A.geo()
        f = Face(side, hx, hy)
        L = 2 * hx if side in ("front", "back") else 2 * hy - 2 * t
        inward = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (1, 0, 0), "right": (-1, 0, 0)}[side]
        col = wall_color(color_out, color_in, inward)
        f.box(g, (L, t, ze), 0, -t / 2, ze / 2, col)
        f.box(g, (L + 0.02, t + 0.06, 0.28), 0, -t / 2, 0.14, by_normal("stone_dark", "stone_dark"))
        stone_texture(g, f, L, ze, n=5, seed={"front": 1, "back": 2, "left": 3, "right": 4}[side])
        if side == "front":
            door(g, f, 0.0, color="wood_new", absent=True, step=True)
            window(g, f, 1.7, 0.95, 0.75, 0.9, shutter="paint_blue", ruin=ruin)
            window(g, f, -1.7, 0.95, 0.75, 0.9, shutter="paint_blue", ruin=ruin, box_flowers=not ruin)
            f.box(g, (1.2, 0.08, 0.16), 0.0, 0.03, 2.25, "stone_light")
            if not ruin:
                f.box(g, (0.06, 0.12, 0.06), 0.62, 0.05, 1.9, "iron")
                f.box(g, (0.2, 0.2, 0.3), 0.62, 0.15, 1.72, "glass_lamp")
                f.box(g, (0.24, 0.24, 0.05), 0.62, 0.15, 1.9, "iron")
        elif side == "back":
            window(g, f, -1.0, 1.0, 0.7, 0.8, shutter="paint_blue", ruin=ruin)
        elif side == "left":
            window(g, f, 0.3, 1.0, 0.7, 0.8, shutter="paint_blue", ruin=ruin)
        elif side == "right":
            # côté voie: le garde-barrière surveille les trains
            window(g, f, 0.0, 1.0, 0.7, 0.8, shutter="paint_blue", ruin=ruin)
        if side in ("left", "right"):
            col_g = wall_color(color_out, color_in, inward)
            x = -hx + t / 2 if side == "left" else hx - t / 2
            g.prism([(-hy, ze), (hy, ze), (0, zr - 0.15)], t, loc=(x, 0, 0), color=col_g, rot=(0, 0, 90))
        if ruin and side in ("front", "left"):
            for k in range(3):
                f.box(g, (0.35, 0.05, 0.3), -0.2 + k * 0.5 - (1.6 if side == "front" else 0), 0.03, 0.5 + k * 0.35, "ivy",
                      rot=(0, 20 * k, 0))
        if side in ("left", "right"):
            # chaînes d'angle: elles suivent les murs de côté
            quoins(g, hx, hy, ze, sxs=(-1,) if side == "left" else (1,))
        walls[side] = A.add(name + "_wall_" + side, g, parent=root)
    # toit: 5 bandes par pan + faîtage = 11 éléments (chantier guidé: 11 + la porte = 12)
    roof = lpl.empty(name + "_roof", parent=root)
    # ruine: un seul maillage pour tout le toit (aucune pièce n'y est construite: moins d'appels de dessin);
    # réparée: 11 pièces, liées une à une au chantier par src/rendu/maison.ts
    if ruin:
        one = A.geo()
        parts = [one] * 11
    else:
        parts = [A.geo() for _ in range(11)]
    holes = (1, 3, 6, 10) if ruin else ()
    gable_roof(parts, -hx, hx, -hy, hy, ze, zr, "lauze", edge="lauze_dark", strips=5, holes=holes,
               rafters=ruin, ridge_color="lauze_dark")
    if not ruin:
        chimney(parts[9], 1.9, 1.0, 2.8, 4.6)
    else:
        chimney(parts[9], 1.9, 1.0, 2.8, 4.3)
        for x in (-1.6, 0.9):
            parts[0].box((0.6, 0.5, 0.05), loc=(x, -2.9, 0.03), color="lauze", rot=(0, 0, 30 * x))
    if ruin:
        A.add(f"{name}_roof_tiles", parts[0], parent=roof)
    for i, gp in enumerate(parts if not ruin else []):
        if gp.tri_count() == 0:
            gp.bm.free()
            continue
        A.add(f"{name}_roof_part_{i + 1:02d}", gp, parent=roof)
    # grenier (mezzanine du fond) et échelle
    g = A.geo()
    g.box((2 * hx - 2 * t, 1.6, 0.1), loc=(0, hy - t - 0.8, ze - 0.05), color="wood_old" if ruin else "wood", base=True)
    for x in (-1.8, -0.6, 0.6, 1.8):
        g.box((0.12, 1.6, 0.14), loc=(x, hy - t - 0.8, ze - 0.12), color="wood_dark")
    for s in (1, -1):
        g.box((0.06, 0.06, 2.5), loc=(1.6 + s * 0.22, 0.45, fl + 1.2), color="wood_dark", rot=(-14, 0, 0))
    for k in range(7):
        g.box((0.44, 0.04, 0.04), loc=(1.6, 0.45 - (k * 0.33 - 1.0) * math.sin(math.radians(14)) * 0.0 + (0.3 - k * 0.05), fl + 0.25 + k * 0.33),
              color="wood_dark")
    A.add(name + "_attic", g, parent=root)
    if not ruin:
        g = A.geo()
        # porte, pivot sur le gond gauche (vu de dehors)
        w, h = 0.95, 2.05
        g.box((w - 0.04, 0.05, h - 0.03), loc=(w / 2, 0, (h - 0.03) / 2), color="wood_new")
        for z, hh in ((0.45, 0.6), (1.5, 0.5)):
            g.box((w - 0.2, 0.06, hh), loc=(w / 2, -0.01, z), color="wood", bevel=0.01)
        g.box((0.05, 0.05, 0.05), loc=(w - 0.12, -0.05, 1.0), color="brass")
        for z in (0.3, 1.7):
            g.box((0.5, 0.06, 0.05), loc=(0.25, -0.01, z), color="iron")
        A.add(name + "_door", g, parent=root, loc=(-w / 2 + 0.02, -hy - 0.06, 0))
    else:
        g = A.geo()
        g.box((1.0, 0.04, 0.2), loc=(0.0, -hy - 0.12, 0.6), color="wood_old", rot=(0, 25, 0))
        for x, y in [(-2.9, -1.0), (2.95, 0.4), (-0.3, -2.55), (2.0, -2.5)]:
            for k in range(3):
                g.cyl(0.03, 0.28, loc=(x + k * 0.06, y, 0), color="grass_dark", segs=4, r2=0.0, base=True,
                      rot=(15 * (k - 1), 10, 0))
        A.add(name + "_debris", g, parent=root)
    return root


# Halte (bâtiment voyageurs, 10 x 6) -------------------------------------------------

def station(A):
    hx, hy, ze, zr = 4.4, 2.3, 3.0, 4.7
    root = A.group("station", {"footprint": [10, 6], "door_cell": 4})
    g = A.geo()
    g.box((2 * hx, 2 * hy, ze), color="plaster_cream", base=True)
    g.box((2 * hx + 0.06, 2 * hy + 0.06, 0.45), color="stone", base=True)
    quoins(g, hx, hy, ze)
    for x, s in ((-hx, 1), (hx, -1)):
        g.prism([(-hy, ze), (hy, ze), (0, zr)], 0.3, loc=(x + s * 0.15, 0, 0), color="plaster_cream", rot=(0, 0, 90))
    for side in ("front", "back"):
        f = Face(side, hx, hy)
        dx = -0.5 if side == "front" else 0.5
        door(g, f, dx, w=1.1, h=2.3, color="paint_red", glass=True)
        for u in (-2.7, 1.2, 2.9):
            window(g, f, u if side == "front" else -u, 1.0, 0.7, 1.2, shutter="paint_red")
        f.box(g, (2 * hx + 0.1, 0.12, 0.14), 0, 0.03, ze - 0.12, "paint_red")
    f = Face("front", hx, hy)
    # enseigne et horloge
    f.box(g, (2.6, 0.08, 0.38), 1.9, 0.06, 2.62, "paint_cream", bevel=0.02)
    for k in range(14):
        f.box(g, (0.1 if k % 4 else 0.13, 0.09, 0.18), 1.9 - 1.05 + k * 0.162, 0.07, 2.62, "paint_red")
    for side in ("left", "right"):
        ff = Face(side, hx, hy)
        if side == "left":
            # pignon ouest, côté quai: une porte qui donne sur le quai
            door(g, ff, 0.0, w=1.1, h=2.3, color="paint_red", glass=True)
        else:
            window(g, ff, 0.0, 1.0, 0.75, 1.2, shutter="paint_red")
        ff.box(g, (0.62, 0.06, 0.62), 0.0, 0.06, 3.55, "stone_light")
        ff.box(g, (0.44, 0.07, 0.44), 0.0, 0.08, 3.55, "glass", rot=(0, 45, 0))
    A.add("station_body", g, parent=root)
    r = A.geo()
    gable_roof(r, -hx, hx, -hy, hy, ze, zr, "tile", edge="tile_dark", over=0.45, ridge_color="tile_dark")
    chimney(r, -2.8, 0.9, 3.8, 5.4, color="brick", cap="stone_light")
    A.add("station_roof", r, parent=root)
    # horloge de façade: aiguilles à part, pivot au centre (à tourner selon l'heure du jeu)
    c = A.geo()
    c.cyl(0.29, 0.08, loc=(0, 0, 0), color="paint_red", segs=16, rot=(90, 0, 0))
    c.cyl(0.24, 0.09, loc=(0, -0.01, 0), color="white_paint", segs=16, rot=(90, 0, 0))
    c.box((0.06, 0.12, 0.3), loc=(0, 0.06, 0.32), color="iron")
    for k in range(12):
        a = math.radians(k * 30)
        c.box((0.022, 0.02, 0.05 if k % 3 else 0.075), loc=(0.19 * math.sin(a), -0.06, 0.19 * math.cos(a)), color="black",
              rot=(0, k * 30, 0))
    clock = A.add("station_clock", c, parent=root, loc=(-1.53, -hy - 0.1, 2.15))
    hh = A.geo()
    hh.box((0.03, 0.015, 0.13), loc=(0, 0, 0.05), color="black")
    A.add("station_clock_hour", hh, parent=clock, loc=(0, -0.07, 0))
    mm = A.geo()
    mm.box((0.022, 0.015, 0.19), loc=(0, 0, 0.08), color="black")
    A.add("station_clock_minute", mm, parent=clock, loc=(0, -0.085, 0))
    return root


# Quai 30 x 4 avec marquise sur 10 m ----------------------------------------------

def platform(A):
    root = A.group("platform", {"footprint": [30, 4], "walk_height": 0.4, "track_side": "-z",
                                "note": "bord côté voie vers -Z (arrière); marquise centrée sur 10 m"})
    g = A.geo()
    L, D, H = 30.0, 4.0, 0.4
    g.box((L - 2.0, D, H), color=by_normal("path_dark", "stone"), base=True)
    for s in (1, -1):
        # rampes douces aux deux bouts
        g.mesh([(s * (L / 2 - 1.0), -D / 2, 0), (s * (L / 2 - 1.0), D / 2, 0), (s * (L / 2 - 1.0), D / 2, H),
                (s * (L / 2 - 1.0), -D / 2, H), (s * L / 2, -D / 2, 0), (s * L / 2, D / 2, 0)],
               [(0, 1, 2, 3), (3, 2, 5, 4), (0, 3, 4), (1, 5, 2), (0, 4, 5, 1)] if s > 0 else
               [(3, 2, 1, 0), (4, 5, 2, 3), (4, 3, 0), (2, 5, 1), (1, 5, 4, 0)], by_normal("path_dark", "stone", thr=0.2))
    for i in range(28):
        x = -14 + 0.5 + i
        g.box((0.96, 0.42, 0.06), loc=(x, D / 2 - 0.21, H), color="stone_light", base=True, bevel=0.01)
    for i in range(14):
        x = -13 + i * 2
        g.box((0.03, D - 0.5, 0.004), loc=(x, -0.2, H), color="path", base=True)
    A.add("platform_base", g, parent=root)
    c = A.geo()
    zc = 3.3

    def top(y):
        """Dessus de la tôle bombée: monte de -1,8 vers +1,7, renflée de 7 cm au milieu."""
        t = (y + 1.8) / 3.5
        return zc - 0.25 + 0.25 * t + 0.07 * math.sin(math.pi * t)

    def under(y):
        return top(y) - 0.08

    # poutre longitudinale en tête des poteaux, sous la tôle; poteaux arrêtés sous la poutre;
    # consoles (aisseliers) de part et d'autre qui portent la tôle en porte-à-faux
    yp, hbeam = -0.9, 0.16
    zbeam = under(yp) - hbeam / 2 + 0.004
    c.box((10.0, 0.12, hbeam), loc=(0, yp, zbeam), color="iron")
    zpost = zbeam - hbeam / 2
    for x in (-4.5, -1.5, 1.5, 4.5):
        c.cyl(0.07, zpost - H + 0.005, loc=(x, yp, H), color="iron", segs=8, base=True)
        c.cyl(0.13, 0.12, loc=(x, yp, H), color="iron", segs=8, base=True)
        for yt in (-1.7, 1.55):
            za = zpost - 0.55
            zt = under(yt) + 0.004
            d = math.hypot(yt - yp, zt - za)
            a2 = math.degrees(math.atan2(zt - za, yt - yp))
            c.box((0.05, d, 0.06), loc=(x, (yp + yt) / 2, (za + zt) / 2), color="iron", rot=(a2 if yt > yp else a2 - 180, 0, 0),
                  no_round=True)
    # tôle bombée: 6 rangs de sommets dans la pente, 8 cm d'épaisseur
    ys = [-1.8 + 3.5 * i / 6 for i in range(7)]
    pts, faces = [], []
    for y in ys:
        for x in (-5.0, 5.0):
            pts.append((x, y, top(y)))
    n = len(pts)
    pts += [(x, y, z - 0.08) for (x, y, z) in pts]
    for i in range(len(ys) - 1):
        a0, a1, b0, b1 = 2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 3
        faces.append((a0, a1, b1, b0))
        faces.append((n + a0, n + b0, n + b1, n + a1))
        faces.append((a0, b0, n + b0, n + a0))
        faces.append((a1, n + a1, n + b1, b1))
    last = 2 * (len(ys) - 1)
    faces.append((0, n, n + 1, 1))
    faces.append((last, last + 1, n + last + 1, n + last))
    c.mesh(pts, faces, by_normal("lauze_light", "paint_cream", "paint_cream", thr=0.3))
    for k in range(40):
        x = -4.875 + k * 0.25
        c.box((0.2, 0.03, 0.22), loc=(x, -1.82, zc - 0.36), color="paint_cream", rot=(0, 0, 0))
        c.cyl(0.1, 0.03, loc=(x, -1.82, zc - 0.47), color="paint_cream", segs=6, rot=(90, 0, 0))
    c.box((10.1, 0.06, 0.08), loc=(0, -1.82, zc - 0.23), color="paint_red")
    for x in (-3.0, 0.0, 3.0):
        # lanternes pendues sous la poutre
        zr0 = zpost
        c.cyl(0.012, 0.4, loc=(x, yp, zr0 - 0.2), color="iron", segs=5)
        c.cyl(0.09, 0.2, loc=(x, yp, zr0 - 0.5), color="glass_lamp", segs=6)
        c.cyl(0.11, 0.06, loc=(x, yp, zr0 - 0.37), color="iron", segs=6, r2=0.04)
    A.add("platform_canopy", c, parent=root)
    return root


# Épicerie-pension Ferrand (10 x 8) -----------------------------------------------

def ferrand_shop(A):
    hx, y0, y1, ze, zr = 4.4, -2.6, 3.6, 5.4, 7.4
    hy = (y1 - y0) / 2
    yc = (y0 + y1) / 2
    root = A.group("ferrand_shop", {"footprint": [10, 8], "door_cell": 2, "counter_cell": 6})
    g = A.geo()
    g.box((2 * hx, 2 * hy, ze), loc=(0, yc, 0), color="plaster_ochre", base=True)
    g.box((2 * hx + 0.06, 2 * hy + 0.06, 0.5), loc=(0, yc, 0), color="stone", base=True)
    g.box((2 * hx + 0.1, 2 * hy + 0.1, 0.16), loc=(0, yc, 2.85), color="stone_light", base=True)
    for x, s in ((-hx, 1), (hx, -1)):
        g.prism([(y0, ze), (y1, ze), (yc, zr)], 0.3, loc=(x + s * 0.15, 0, 0), color="plaster_ochre", rot=(0, 0, 90))
    f = Face("front", hx, hy)
    f.hy = -y0
    # devanture: grande vitrine, comptoir sur la place, porte
    cu = 1.5
    f.box(g, (4.6, 0.12, 2.3), cu, 0.04, 1.55, "paint_green")
    f.box(g, (4.2, 0.08, 1.5), cu, 0.09, 1.75, "glass")
    for u in (cu - 1.4, cu, cu + 1.4):
        f.box(g, (0.06, 0.1, 1.5), u, 0.11, 1.75, "paint_green")
    f.box(g, (4.4, 0.6, 0.12), cu, 0.35, 0.95, "wood")
    f.box(g, (4.4, 0.5, 0.85), cu, 0.3, 0.45, "paint_green", bevel=0.02)
    for k in range(5):
        f.box(g, (0.6, 0.4, 0.28), cu - 1.7 + k * 0.85, 0.35, 1.15, "wood_new", bevel=0.01)
        col = ["radish", "lettuce", "carrot", "bread", "flower_red"][k]
        f.box(g, (0.5, 0.3, 0.1), cu - 1.7 + k * 0.85, 0.35, 1.32, col)
    door(g, f, -2.5, w=1.0, h=2.3, color="paint_green", glass=True, frame="paint_green")
    # store rayé
    for k in range(12):
        x0 = -hx + 0.1 + k * (2 * hx - 0.2) / 12
        w = (2 * hx - 0.2) / 12
        slab(g, [(x0, y0 - 1.5, 2.55), (x0 + w, y0 - 1.5, 2.55), (x0 + w, y0 - 0.02, 3.1), (x0, y0 - 0.02, 3.1)], 0.03,
             "awning_red" if k % 2 == 0 else "awning_cream")
        # lambrequin festonné: bandes alternées longues et courtes (bord libre ondulé)
        hv = 0.22 if k % 2 == 0 else 0.15
        f.box(g, (w, 0.03, hv), x0 + w / 2, 1.52, 2.56 - hv / 2,
              "awning_red" if k % 2 == 0 else "awning_cream")
    # bras du store fixés au mur, sous la toile
    for xa in (-hx + 0.4, 0.0, hx - 0.4):
        rod(g, (xa, y0 - 0.02, 2.62), (xa, y0 - 1.42, 2.5), 0.02, "iron")
        g.box((0.08, 0.04, 0.12), loc=(xa, y0 - 0.02, 2.62), color="iron")
    # enseigne
    f.box(g, (4.0, 0.08, 0.45), 0, 0.06, 3.45, "paint_cream", bevel=0.02)
    for k in range(9):
        f.box(g, (0.18, 0.09, 0.25), -1.3 + k * 0.33, 0.07, 3.45, "paint_green")
    for u in (-3.0, -1.0, 1.0, 3.0):
        window(g, f, u, 3.75, 0.8, 1.1, shutter="paint_green", box_flowers=(u in (-1.0, 1.0)))
    for side in ("back",):
        fb = Face("back", hx, hy)
        fb.hy = y1
        for u in (-2.5, 0.0, 2.5):
            window(g, fb, u, 1.1, 0.8, 1.1, shutter="paint_green")
            window(g, fb, u, 3.75, 0.8, 1.1, shutter="paint_green")
        door(g, fb, 3.4, w=0.9, h=2.1, color="paint_green")
    for side in ("left", "right"):
        fs = Face(side, hx, hy)
        for u in (-1.2, 1.2):
            window(g, fs, u - yc * (1 if side == "right" else -1), 3.75, 0.7, 1.0, shutter="paint_green")
    A.add("ferrand_shop_body", g, parent=root)
    r = A.geo()
    gable_roof(r, -hx, hx, y0, y1, ze, zr, "lauze", edge="lauze_dark", over=0.4, ridge_color="lauze_dark")
    chimney(r, -3.2, 1.6, 6.5, 8.2)
    chimney(r, 3.0, 0.4, 6.0, 8.0)
    for x in (-1.6, 1.6):
        r.box((1.1, 1.3, 1.0), loc=(x, y0 + 0.9, 5.6), color="plaster_ochre", base=True)
        r.prism([(-0.65, 0), (0.65, 0), (0, 0.6)], 1.5, loc=(x, y0 + 0.95, 6.6), color="lauze_dark")
        r.box((0.6, 0.06, 0.7), loc=(x, y0 + 0.24, 6.0), color="glass")
        r.box((0.72, 0.05, 0.82), loc=(x, y0 + 0.26, 6.0), color="stone_light")
    A.add("ferrand_shop_roof", r, parent=root)
    return root


# Maison de Firmin (7 x 6) -----------------------------------------------------------

def firmin_house(A):
    """Témoin du low poly arrondi: angles des murs adoucis, chaînes d'angle enveloppantes, toit fléchi."""
    hx, hy, ze, zr = 2.8, 2.2, 2.6, 4.4
    root = A.group("firmin_house", {"footprint": [7, 6], "door_cell": 3})
    g = A.geo()
    # murs et pignons d'un seul tenant (pentagone extrudé), angles verticaux chanfreinés à 10 cm;
    # le haut suit le dessous du toit (épaisseur et flèche du faîtage) pour ne pas le traverser
    pts = [(-hy, 0.0), (hy, 0.0), (hy, ze - 0.18), (0.0, zr - 0.3), (-hy, ze - 0.18)]
    body = g.prism(pts, 2 * hx, color="stone", rot=(0, 0, 90))
    g.bevel(body, 0.1, 2, "stone", edges_pred=lambda a, b: _vertical(a, b) and abs(a.z - b.z) > 1.0)
    g.box((2 * hx + 0.05, 2 * hy + 0.05, 0.35), color="stone_dark", base=True, bevel=0.035, bseg=2,
          bedges=_not_ground)
    round_quoins(g, hx, hy, ze - 0.2)
    f = Face("front", hx, hy)
    round_stone_texture(g, f, 2 * hx, ze, n=12, seed=4)
    door(g, f, 0.0, color="paint_blue", rb=0.015)
    window(g, f, -1.65, 1.0, 0.75, 0.95, shutter="paint_blue", box_flowers=True, rb=0.015)
    window(g, f, 1.75, 1.0, 0.6, 0.8, shutter="paint_blue", rb=0.015)
    f.box(g, (0.5, 0.1, 0.06), 0.0, 0.06, 2.3, "stone_light", bevel=0.015)
    fb = Face("back", hx, hy)
    round_stone_texture(g, fb, 2 * hx, ze, n=10, seed=5)
    window(g, fb, 0.8, 1.0, 0.8, 0.95, shutter="paint_blue", rb=0.015)
    for side in ("left", "right"):
        fs = Face(side, hx, hy)
        window(g, fs, 0.0, 2.9, 0.5, 0.6, shutter=None, rb=0.015)
    # pots devant
    for x in (-0.85, 0.85):
        g.lathe([(0.12, 0), (0.17, 0.25), (0.18, 0.28)], loc=(x, -hy - 0.35, 0), colors="tile", segs=8,
                close_bottom=False)
        g.sphere(0.17, loc=(x, -hy - 0.35, 0.33), color="leaf_bush", ico=1, jitter=0.08, seed=3,
                 scale=(1, 1, 0.8))
        g.sphere(0.05, loc=(x + 0.05, -hy - 0.47, 0.42), color="flower_red", segs=6, rings=4)
    A.add("firmin_house_body", g, parent=root)
    r = A.geo()
    round_gable_roof(r, -hx, hx, -hy, hy, ze, zr, "tile", edge="tile_dark", ridge_color="tile_dark")
    round_chimney(r, -1.8, 0.8, 3.2, 5.0)
    A.add("firmin_house_roof", r, parent=root)
    return root


# Scierie de Basile (10 x 8) ----------------------------------------------------

def sawmill(A):
    hx, hy, ze, zr = 3.2, 3.4, 3.4, 6.0
    root = A.group("sawmill", {"footprint": [10, 8], "door_cell": 5})
    g = A.geo()
    # soubassement de pierre et bardage de planches
    g.box((2 * hx, 2 * hy, 0.6), color="stone", base=True)
    for side in ("back", "left", "right"):
        f = Face(side, hx, hy)
        L = 2 * hy if side in ("left", "right") else 2 * hx
        n = int(L / 0.3)
        for k in range(n):
            u = -L / 2 + 0.15 + k * L / n
            f.box(g, (L / n - 0.02, 0.06, ze - 0.6), u, -0.03, 0.6 + (ze - 0.6) / 2, "wood" if k % 3 else "wood_dark")
    f = Face("front", hx, hy)
    for u in (-hx + 0.6, hx - 0.6):
        f.box(g, (1.2, 0.08, ze - 0.6), u, -0.04, 0.6 + (ze - 0.6) / 2, "wood")
    f.box(g, (2 * hx, 0.1, 0.25), 0, 0.0, ze - 0.12, "wood_dark")
    for u in (-2.0, 2.0):
        f.box(g, (0.2, 0.2, ze), u, -0.1, ze / 2, "wood_dark")
    # pignons en planches (faîtage selon Y: pignon sur la façade)
    for y, s in ((-hy, 1), (hy, -1)):
        g.prism([(-hx, ze), (hx, ze), (0, zr)], 0.1, loc=(0, y + s * 0.05, 0), color="wood")
    f.box(g, (0.9, 0.08, 0.7), 0, 0.1, ze + 1.0, "shadow")
    # intérieur: scie à ruban et rondins
    g.box((2 * hx - 0.1, 2 * hy - 0.1, 0.62), color="path_dark", base=True)
    g.box((2.4, 0.9, 0.8), loc=(0, 0.5, 0.6), color="wood_dark", base=True)
    g.cyl(0.55, 0.04, loc=(0, 0.5, 1.45), color="tin", segs=14, rot=(0, 90, 0))
    g.cyl(0.12, 0.06, loc=(0, 0.5, 1.45), color="iron", segs=8, rot=(0, 90, 0))
    g.box((2.6, 0.24, 0.24), loc=(-0.3, 0.5, 1.52), color="bark", rot=(0, 0, 0))
    for k in range(3):
        g.cyl(0.18, 2.2, loc=(-2.0, 2.2 - k * 0.4, 0.8 + (0.3 if k == 1 else 0)), color="bark", segs=8, rot=(0, 90, 90))
    A.add("sawmill_body", g, parent=root)
    r = A.geo()
    # toit à deux pans, faîtage selon Y: construit selon X puis tourné d'un quart de tour
    gable_roof(r, -hy, hy, -hx, hx, ze, zr, "lauze", edge="lauze_dark", over=0.4, ridge_color="lauze_dark")
    rotate_geo(r, 90)
    A.add("sawmill_roof", r, parent=root)
    return root


def workbench(A):
    """Établi de Basile sous son auvent (emprise 2 x 2, l'établi contre le fond).

    Structure lisible: quatre poteaux, deux sablières en tête (devant et au fond), trois chevrons dans
    la pente, la tôle posée dessus; bardage du fond du sol à la sablière; rien ne traverse."""
    g = A.geo()
    yf, yb = -1.15, 1.05            # bords bas et haut de la tôle
    zf, zb_ = 2.5, 3.0              # dessus de la tôle aux deux bords
    th = 0.06                       # épaisseur de la tôle
    ang = math.degrees(math.atan((zb_ - zf) / (yb - yf)))
    cosa = math.cos(math.radians(ang))

    def top(y):
        return zf + (zb_ - zf) * (y - yf) / (yb - yf)

    def under(y):
        return top(y) - th / cosa

    # tôle et couvre-joints posés dessus (coupés 2 cm en retrait des rives)
    slab(g, [(-1.1, yf, zf), (1.1, yf, zf), (1.1, yb, zb_), (-1.1, yb, zb_)], th,
         by_normal("wood_old", "wood_old_dark", "wood_old_dark", thr=0.3))
    for j in range(1, 5):
        y = yf + (yb - yf) * j / 5
        g.box((2.16, 0.04, 0.03), loc=(0, y, top(y) + 0.015 / cosa), color="wood_old_dark", rot=(ang, 0, 0),
              no_round=True)
    # chevrons sous la tôle, dans la pente
    hc = 0.08
    for x in (-0.9, 0.0, 0.9):
        ym = (yf + 0.1 + yb - 0.05) / 2
        L = (yb - 0.05 - (yf + 0.1)) / cosa
        # 5 mm sous la tôle: aucune face au même niveau que son dessous (papillotement en WebGL)
        g.box((0.06, L, hc), loc=(x, ym, under(ym) - hc / 2 / cosa - 0.005), color="wood_dark", rot=(ang, 0, 0))
    # sablières (8 x 10 cm) qui relient les poteaux en tête, sous les chevrons
    hs = 0.10
    tops = {}
    for y in (-0.9, 0.92):
        zt = under(y) - hc / cosa - 0.002          # dessus de la sablière engagé de 3 mm sous les chevrons
        g.box((2.0, 0.08, hs), loc=(0, y, zt - hs / 2), color="wood_dark")
        tops[y] = zt - hs                           # tête des poteaux = dessous de la sablière
    for x in (-0.95, 0.95):
        g.cyl(0.06, tops[-0.9], loc=(x, -0.9, 0), color="wood_dark", segs=6, base=True)
        g.box((0.1, 0.1, tops[0.92]), loc=(x, 0.92, 0), color="wood_dark", base=True)
    # bardage du fond: planches verticales du sol à la sablière, entre les poteaux, derrière l'établi
    hb = tops[0.92]
    for k in range(6):
        x = -0.75 + k * 0.3
        g.box((0.29, 0.03, hb), loc=(x, 0.955, 0), color="wood" if k % 2 else "wood_new", base=True)
    # outils pendus au bardage (contre sa face avant)
    for x, c in ((-0.6, "iron"), (-0.35, "wood_dark"), (0.5, "iron_light")):
        g.box((0.05, 0.03, 0.4), loc=(x, 0.925, 1.6), color=c, base=True)
    g.box((0.25, 0.03, 0.06), loc=(0.2, 0.925, 1.95), color="iron")
    # établi: plateau sur quatre pieds, tablette basse entre les pieds (2 cm devant le bardage)
    g.box((1.9, 0.75, 0.1), loc=(0, 0.45, 0.82), color="wood_new", base=True, bevel=0.01)
    for x in (-0.8, 0.8):
        for y in (0.17, 0.73):
            g.box((0.1, 0.1, 0.82), loc=(x, y, 0), color="wood", base=True)
    g.box((1.5, 0.46, 0.04), loc=(0, 0.45, 0.25), color="wood", base=True)
    g.box((0.25, 0.2, 0.18), loc=(-0.75, 0.18, 0.92), color="wood_dark", base=True)
    g.cyl(0.02, 0.3, loc=(-0.75, 0.06, 1.0), color="iron", segs=5, rot=(90, 0, 0))
    g.box((1.0, 0.2, 0.03), loc=(0.25, 0.55, 0.92), color="wood_new", base=True, rot=(0, 0, 4))
    for k in range(4):
        g.box((0.25, 0.06, 0.06), loc=(0.2 + k * 0.12, 0.2, 0.92), color="wood_new", base=True, rot=(0, 0, 30 * k))
    return g


def _log_color(axis):
    """Bûche: bouts (faces dans l'axe) couleur de bois coupé, le reste en écorce."""
    def f(face):
        return "log_end" if abs(face.normal[axis]) > 0.7 else "bark"
    return f


def woodpile(A):
    """Bûches empilées en pyramide entre deux piquets (bois de la scierie)."""
    g = A.geo()
    for row in range(3):
        n = 5 - row
        for k in range(n):
            g.cyl(0.15, 1.0, loc=(-0.62 + k * 0.31 + row * 0.155, 0, 0.15 + row * 0.26), color=_log_color(1), segs=7,
                  rot=(90, 0, 0))
    for x in (-0.95, 0.95):
        g.box((0.08, 0.08, 0.9), loc=(x, 0, 0), color="wood_dark", base=True)
    return g


def log_pile(A):
    """Pile de rondins croisés par lits (différente du tas de bois de la scierie)."""
    g = A.geo()
    for layer in range(3):
        for k in range(3):
            o = -0.45 + k * 0.45
            z = 0.122 + layer * 0.235  # lits légèrement engagés: chaque rondin porte sur le précédent
            if layer % 2 == 0:
                g.cyl(0.12, 1.5, loc=(0, o * 0.8, z), color=_log_color(0), segs=7, rot=(0, 90, 0))
            else:
                g.cyl(0.12, 0.9, loc=(o * 1.4, 0, z), color=_log_color(1), segs=7, rot=(90, 0, 0))
    return g


def plank_stack(A):
    g = A.geo()
    for k in range(8):
        g.box((1.9, 0.2, 0.03), loc=(0, -0.33 + (k % 4) * 0.22, 0.12 + (k // 4) * 0.04), color="wood_new" if k % 3 else "wood",
              base=True)
    for x in (-0.7, 0.0, 0.7):
        g.box((0.1, 0.9, 0.1), loc=(x, 0, 0), color="wood_dark", base=True)
    return g


# Remise de la draisine (6 x 5) et draisine --------------------------------------------

def handcar_shed(A):
    hx, hy, ze, zr = 2.6, 2.2, 3.0, 4.4
    root = A.group("handcar_shed", {"footprint": [6, 5], "door_cell": 2,
                                    "note": "portes battantes: tourner handcar_shed_door_l de -100 degrés et _r de +100 autour de Y"})
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.3), color="stone", base=True)
    for side in ("back", "left", "right"):
        f = Face(side, hx, hy)
        L = 2 * hy if side in ("left", "right") else 2 * hx
        n = int(L / 0.32)
        for k in range(n):
            u = -L / 2 + L / n * (k + 0.5)
            f.box(g, (L / n - 0.02, 0.06, ze - 0.3), u, -0.03, 0.3 + (ze - 0.3) / 2, "wood_dark" if k % 4 else "wood_old_dark")
    f = Face("front", hx, hy)
    for u in (-2.1, 2.1):
        f.box(g, (0.8, 0.08, ze - 0.3), u, -0.04, 0.3 + (ze - 0.3) / 2, "wood_dark")
    f.box(g, (3.4, 0.06, 2.75), 0, -0.1, 1.38, "shadow")
    for y, s in ((-hy, 1), (hy, -1)):
        g.prism([(-hx, ze), (hx, ze), (0, zr)], 0.1, loc=(0, y + s * 0.05, 0), color="wood_dark")
    f.box(g, (1.2, 0.06, 0.3), 0, 0.06, 3.35, "paint_cream")
    for k in range(5):
        f.box(g, (0.14, 0.07, 0.16), -0.4 + k * 0.2, 0.07, 3.35, "paint_red")
    # rails qui entrent dans la remise
    for x in (-0.5, 0.5):
        g.box((0.07, 2 * hy + 0.6, 0.1), loc=(x, -0.3, 0.3), color="rail_steel", base=True)
    for k in range(6):
        g.box((1.6, 0.18, 0.06), loc=(0, -hy - 0.2 + k * 0.85, 0.27), color="wood_dark", base=True)
    A.add("handcar_shed_body", g, parent=root)
    r = A.geo()
    gable_roof(r, -hy, hy, -hx, hx, ze, zr, "wood_old", edge="wood_old_dark", over=0.35, thick=0.1,
               ridge_color="wood_old_dark")
    rotate_geo(r, 90)
    A.add("handcar_shed_roof", r, parent=root)
    for side, s in (("l", -1), ("r", 1)):
        d = A.geo()
        w, h = 1.68, 2.7
        for k in range(5):
            d.box((w / 5 - 0.02, 0.06, h), loc=(-s * (w / 10 + k * w / 5), 0, h / 2), color="paint_red")
        d.box((w, 0.07, 0.14), loc=(-s * w / 2, -0.01, 0.6), color="wood_dark")
        d.box((w, 0.07, 0.14), loc=(-s * w / 2, -0.01, 2.1), color="wood_dark")
        d.box((w * 1.1, 0.07, 0.12), loc=(-s * w / 2, -0.015, 1.35), color="wood_dark", rot=(0, s * 58, 0))
        d.box((0.05, 0.08, 0.2), loc=(-s * (w - 0.1), -0.05, 1.3), color="iron")
        A.add("handcar_shed_door_" + side, d, parent=root, loc=(s * 1.7, -hy - 0.12, 0.3))
    return root


def handcar(A):
    root = A.group("handcar", {"footprint": [2, 2], "on_rails": True,
                               "note": "balancier handcar_lever: pivot sur l'axe X, +-20 degrés"})
    g = A.geo()
    for x in (-0.5, 0.5):
        for y in (-0.55, 0.55):
            g.cyl(0.2, 0.06, loc=(x, y, 0.52), color="iron", segs=12, rot=(0, 90, 0))
            g.cyl(0.08, 0.08, loc=(x, y, 0.52), color="rust", segs=6, rot=(0, 90, 0))
    for y in (-0.55, 0.55):
        g.cyl(0.03, 1.1, loc=(0, y, 0.52), color="iron", segs=6, rot=(0, 90, 0))
    g.box((1.4, 1.6, 0.08), loc=(0, 0, 0.66), color="wood_old", base=True)
    for k in range(6):
        g.box((1.4, 0.02, 0.085), loc=(0, -0.75 + k * 0.3, 0.66), color="wood_old_dark", base=True)
    g.box((0.16, 0.16, 0.9), loc=(0, 0, 0.74), color="iron", base=True)
    g.box((0.3, 0.3, 0.1), loc=(0, 0, 0.74), color="iron", base=True)
    g.cyl(0.25, 0.04, loc=(0.18, 0.2, 0.9), color="iron", segs=10, rot=(0, 90, 0))
    A.add("handcar_body", g, parent=root)
    lv = A.geo()
    lv.box((0.08, 1.8, 0.08), color="iron")
    for s in (1, -1):
        lv.box((0.9, 0.06, 0.06), loc=(0, s * 0.9, 0), color="wood")
    A.add("handcar_lever", lv, parent=root, loc=(0, 0, 1.68))
    return root


# Puits (2 x 2) et poulailler (3 x 3) ------------------------------------------------

def well(A):
    g = A.geo()
    g.lathe([(0.85, 0.0), (0.85, 0.75), (0.68, 0.75), (0.68, 0.2)], colors=["stone", "stone_light", "stone"], segs=12,
            close_top=False, close_bottom=True)
    g.cyl(0.68, 0.02, loc=(0, 0, 0.35), color="water_deep", segs=12)
    for k in range(10):
        a = math.radians(k * 36 + 10)
        g.box((0.4, 0.06, 0.18), loc=(0.86 * math.cos(a), 0.86 * math.sin(a), 0.2 + (k % 2) * 0.3), color="stone_dark",
              rot=(0, 0, k * 36 + 100))
    for s in (1, -1):
        g.box((0.12, 0.12, 2.07), loc=(s * 0.78, 0, 0.6), color="wood_dark", base=True)
    g.box((1.9, 0.1, 0.1), loc=(0, 0, 2.67), color="wood_dark", base=True)  # panne faîtière sous le toit
    g.cyl(0.07, 1.7, loc=(0, 0, 2.05), color="wood", segs=8, rot=(0, 90, 0))
    g.cyl(0.1, 0.5, loc=(0, 0, 2.05), color="rope", segs=8, rot=(0, 90, 0))
    g.box((0.04, 0.3, 0.04), loc=(-0.88, -0.15, 2.05), color="iron")
    g.box((0.04, 0.04, 0.2), loc=(-0.88, -0.3, 1.95), color="wood")
    g.box((0.01, 0.01, 0.75), loc=(0.0, -0.1, 1.68), color="rope")
    g.lathe([(0.11, 0.0), (0.14, 0.24)], loc=(0.0, -0.1, 1.05), colors="wood", segs=8)
    g.cyl(0.145, 0.03, loc=(0, -0.1, 1.08), color="iron", segs=8)
    gable_roof(g, -0.85, 0.85, -0.8, 0.8, 2.85 - 0.8 * 0.5 / 0.95, 2.85, "tile", edge="tile_dark", over=0.15,
               thick=0.06, ridge_color="tile_dark")
    return g


def henhouse(A, ruin, parent):
    name = "henhouse_" + ("ruin" if ruin else "repaired")
    root = A.subgroup(name, parent, {"state": "ruin" if ruin else "repaired"})
    wood, dark = ("wood_old", "wood_old_dark") if ruin else ("wood_new", "wood")
    parts = {k: A.geo() for k in ("walls", "roof", "door", "ramp", "fence")}
    g = parts["walls"]
    for x in (-0.75, 0.75):
        for y in (-0.15, 1.15):
            g.box((0.1, 0.1, 0.5), loc=(x, y, 0), color=dark, base=True)
    g.box((1.6, 1.4, 0.08), loc=(0, 0.5, 0.45), color=dark, base=True)
    for side, (L, cx, cy, rz) in {"front": (1.6, 0, -0.2, 0), "back": (1.6, 0, 1.2, 0), "left": (1.4, -0.8, 0.5, 90),
                                   "right": (1.4, 0.8, 0.5, 90)}.items():
        n = 7 if L > 1.5 else 6
        for k in range(n):
            if ruin and (side, k) in (("front", 4), ("left", 2), ("left", 3), ("back", 1)):
                continue
            if side == "front" and k == 3:
                continue
            u = -L / 2 + L / n * (k + 0.5)
            loc = (cx + u, cy, 0.53) if rz == 0 else (cx, cy + u, 0.53)
            g.box((L / n - 0.02, 0.05, 0.85) if rz == 0 else (0.05, L / n - 0.02, 0.85), loc=loc, color=wood if k % 2 else dark,
                  base=True)
    for x, s in ((-0.8, 1), (0.8, -1)):
        g.prism([(-0.22, 1.38), (1.22, 1.38), (0.5, 1.75)], 0.05, loc=(x, 0, 0), color=wood, rot=(0, 0, 90))
    if ruin:
        g.box((0.5, 0.05, 0.12), loc=(0.3, -0.5, 0.03), color=wood, rot=(0, 0, 30))
    r = parts["roof"]
    holes = (1,) if ruin else ()
    gable_roof([r, r, r, r, r] if not ruin else [r, A.geo(), r, r, r], -0.85, 0.85, -0.25, 1.25, 1.38, 1.78, wood,
               edge=dark, over=0.15, thick=0.06, strips=2, holes=holes, ridge_color=dark)
    d = parts["door"]
    if ruin:
        d.box((0.25, 0.04, 0.6), loc=(0.1, -0.4, 0.35), color=wood, rot=(0, 30, 70))
    else:
        d.box((0.24, 0.04, 0.55), loc=(0.0, -0.24, 0.81), color=dark)
        d.box((0.24, 0.045, 0.05), loc=(0.0, -0.245, 0.95), color=wood)
    rp = parts["ramp"]
    rp.box((0.3, 0.9, 0.04), loc=(0.0, -0.6, 0.27), color=wood, rot=(-32, 0, 0))
    for k in range(4):
        rp.box((0.28, 0.03, 0.03), loc=(0.0, -0.95 + k * 0.22, 0.08 + k * 0.14), color=dark)
    fe = parts["fence"]
    for i in range(13):
        a = -1.45 + i * 0.242
        for (x, y) in ((a, -1.45), (a, 1.45), (-1.45, a), (1.45, a)):
            if ruin and i % 3 == 0:
                continue
            if y == -1.45 and -0.4 < x < 0.4:
                continue
            fe.box((0.05, 0.05, 0.6 if i % 2 else 0.7), loc=(x, y, 0), color=dark, base=True)
    for (x, y, L, rz) in ((0, 1.45, 2.9, 0), (-1.45, 0, 2.9, 90), (1.45, 0, 2.9, 90)):
        if ruin and rz == 90 and x > 0:
            continue
        fe.box((L, 0.04, 0.05), loc=(x, y, 0.5), color=wood, rot=(0, 0, rz))
    if not ruin:
        fe.box((1.05, 0.04, 0.05), loc=(-0.925, -1.45, 0.5), color=wood)
    fe.box((1.05, 0.04, 0.05), loc=(0.925, -1.45, 0.5), color=wood)
    for k, gp in parts.items():
        A.add(f"{name}_{k}", gp, parent=root)
    return root


# Voie ---------------------------------------------------------------------------

RAIL_GAUGE = 1.0     # voie métrique, files de rails à +-0,5 m
RAIL_TOP = 0.32


def rail_straight(A):
    g = A.geo()
    g.mesh([(-2, -1.0, 0), (2, -1.0, 0), (2, -0.78, 0.12), (-2, -0.78, 0.12),
            (-2, 0.78, 0.12), (2, 0.78, 0.12), (2, 1.0, 0), (-2, 1.0, 0)],
           [(0, 1, 2, 3), (3, 2, 5, 4), (4, 5, 6, 7)], by_normal("ballast", "ballast_dark", thr=0.9))
    for k in range(5):
        x = -2 + 0.4 + k * 0.8
        g.box((0.2, 1.75, 0.1), loc=(x, 0, 0.12), color="wood_dark", base=True)
        for s in (1, -1):
            g.box((0.16, 0.12, 0.02), loc=(x, s * 0.5, 0.22), color="iron", base=True)
    for s in (1, -1):
        g.box((4.0, 0.1, 0.03), loc=(0, s * 0.5, 0.22), color="rust", base=True)
        g.box((4.0, 0.035, 0.06), loc=(0, s * 0.5, 0.25), color="rust", base=True)
        g.box((4.0, 0.06, 0.012), loc=(0, s * 0.5, 0.308), color="rail_steel", base=True)
    for i, (x, y) in enumerate([(-1.3, 0.18), (0.5, -0.2), (1.5, 0.15)]):
        g.box((0.12, 0.08, 0.04), loc=(x, y, 0.13), color="ballast_dark", rot=(0, 0, 30 * i))
    return g


def rail_curve(A, R=12.0, n=16):
    """Quart de cercle de rayon 12 m (axe de la voie), centre de courbure en (6.5, 6.5) dans l'emprise 13 x 13."""
    g = A.geo()
    c = Vector((6.5, 6.5, 0))
    for i in range(n):
        a0 = math.radians(180 + 90 * i / n)
        a1 = math.radians(180 + 90 * (i + 1) / n)
        pts = []
        for r_, z in ((R + 1.0, 0), (R + 0.78, 0.12), (R - 0.78, 0.12), (R - 1.0, 0)):
            pts.append((r_, z))
        verts = []
        for a in (a0, a1):
            for r_, z in pts:
                verts.append((c.x + r_ * math.cos(a), c.y + r_ * math.sin(a), z))
        g.mesh(verts, [(0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3)], by_normal("ballast", "ballast_dark", thr=0.9))
    L = R * math.pi / 2
    ns = int(L / 0.8)
    for k in range(ns):
        a = math.radians(180 + 90 * (k + 0.5) / ns)
        p = (c.x + R * math.cos(a), c.y + R * math.sin(a), 0.12)
        g.box((1.75, 0.2, 0.1), loc=p, color="wood_dark", base=True, rot=(0, 0, math.degrees(a)))
    for s in (1, -1):
        rr = R + s * 0.5
        for i in range(n * 2):
            a0 = math.radians(180 + 90 * i / (2 * n))
            a1 = math.radians(180 + 90 * (i + 1) / (2 * n))
            am = (a0 + a1) / 2
            seg = rr * (a1 - a0) + 0.01
            p = (c.x + rr * math.cos(am), c.y + rr * math.sin(am), 0.22)
            g.box((0.1, seg, 0.03), loc=p, color="rust", base=True, rot=(0, 0, math.degrees(am)))
            g.box((0.035, seg, 0.06), loc=(p[0], p[1], 0.25), color="rust", base=True, rot=(0, 0, math.degrees(am)))
            g.box((0.06, seg, 0.012), loc=(p[0], p[1], 0.308), color="rail_steel", base=True, rot=(0, 0, math.degrees(am)))
    return g


def buffer_stop(A):
    g = A.geo()
    # jambes verticales de la semelle à la poutre, contrefiches de la semelle au dos de la poutre,
    # platines au pied: chaque pièce s'arrête sur ce qui la porte
    for s in (1, -1):
        g.box((0.12, 0.12, 0.63), loc=(0.15, s * 0.5, 0.12), color="rail_steel", base=True)
        rod(g, (0.55, s * 0.5, 0.12), (0.31, s * 0.5, 0.8), 0.04, "rail_steel", segs=6)
        for x in (0.15, 0.55):
            g.box((0.2, 0.2, 0.02), loc=(x, s * 0.5, 0.12), color="iron", base=True)
    g.box((0.3, 1.9, 0.35), loc=(0.15, 0, 0.75), color="paint_red", base=True)
    for k in range(4):
        g.box((0.31, 0.22, 0.36), loc=(0.15, -0.66 + k * 0.44, 0.75), color="white_paint" if k % 2 else "paint_red", base=True)
    for s in (1, -1):
        g.cyl(0.12, 0.25, loc=(-0.05, s * 0.6, 0.92), color="iron", segs=8, rot=(0, 90, 0))
    g.box((0.8, 2.0, 0.12), loc=(0.2, 0, 0.0), color="ballast", base=True)
    return g


def level_crossing(A):
    root = A.group("level_crossing_gate", {"footprint": [1, 1], "note": "lisse level_crossing_gate_arm: pivot sur l'axe Z glTF, 0 baissée, +80 degrés levée"})
    g = A.geo()
    g.cyl(0.08, 1.1, loc=(0, 0, 0), color="white_paint", segs=8, base=True)
    g.box((0.3, 0.3, 0.12), loc=(0, 0, 0), color="stone", base=True)
    g.box((0.18, 0.14, 0.25), loc=(0, 0.1, 0.9), color="iron", base=True)
    g.cyl(0.14, 0.06, loc=(0.0, -0.06, 1.45), color="paint_red", segs=3, rot=(90, 0, 0))  # contre la tige
    g.cyl(0.03, 0.4, loc=(0, 0, 1.1), color="iron", segs=6, base=True)
    A.add("level_crossing_gate_post", g, parent=root)
    a = A.geo()
    a.box((0.25, 0.25, 0.25), loc=(-0.3, 0, 0), color="iron")
    a.box((0.3, 0.06, 0.06), loc=(-0.1, 0, 0), color="iron")  # bras qui relie le contrepoids à la lisse
    for k in range(10):
        a.box((0.4, 0.07, 0.07), loc=(0.2 + k * 0.4, 0, 0), color="paint_red" if k % 2 else "white_paint")
    # tige pendante courte, clairement suspendue au bout de la lisse
    a.cyl(0.025, 0.35, loc=(3.95, 0, -0.2), color="iron", segs=5)  # sous le bout de la lisse
    A.add("level_crossing_gate_arm", a, parent=root, loc=(0, 0, 1.0))
    return root


# Mobilier du bourg --------------------------------------------------------------------

def bell_post(A):
    g = A.geo()
    g.box((0.4, 0.4, 0.15), color="stone", base=True)
    g.box((0.16, 0.16, 2.6), loc=(0, 0, 0.15), color="paint_red", base=True)
    g.box((0.7, 0.12, 0.12), loc=(0.25, 0, 2.55), color="paint_red")
    g.box((0.1, 0.1, 0.4), loc=(0.48, 0, 2.38), color="iron")
    g.lathe([(0.2, 0.0), (0.18, 0.05), (0.12, 0.2), (0.09, 0.3), (0.0, 0.33)], loc=(0.55, 0, 1.95), colors="brass", segs=10)
    g.sphere(0.035, loc=(0.55, 0, 1.94), color="iron", segs=6, rings=4)
    g.box((0.01, 0.01, 0.6), loc=(0.55, 0.0, 1.62), color="rope")
    slab(g, [(-0.2, -0.35, 2.75), (0.9, -0.35, 2.75), (0.9, 0.0, 2.95), (-0.2, 0.0, 2.95)], 0.04, "paint_red")
    slab(g, [(0.9, 0.35, 2.75), (-0.2, 0.35, 2.75), (-0.2, 0.0, 2.95), (0.9, 0.0, 2.95)], 0.04, "paint_red")
    return g


def bench(A):
    g = A.geo()
    for x in (-0.8, 0.8):
        g.box((0.08, 0.42, 0.06), loc=(x, 0, 0.0), color="iron", base=True)
        g.box((0.06, 0.06, 0.42), loc=(x, -0.15, 0.0), color="iron", base=True)
        g.box((0.06, 0.06, 0.85), loc=(x, 0.18, 0.0), color="iron", base=True, rot=(-8, 0, 0))
        g.box((0.06, 0.4, 0.05), loc=(x, 0.0, 0.62), color="iron", base=True)
    for k in range(3):
        g.box((1.9, 0.12, 0.035), loc=(0, -0.17 + k * 0.13, 0.42), color="wood", base=True, bevel=0.008)
    for k in range(2):
        g.box((1.9, 0.1, 0.035), loc=(0, 0.21 + k * 0.012, 0.6 + k * 0.17), color="wood", rot=(80, 0, 0), bevel=0.008)
    return g


def lamp_post(A):
    g = A.geo()
    g.cyl(0.14, 0.3, loc=(0, 0, 0), color="iron", segs=8, base=True, r2=0.08)
    g.cyl(0.05, 2.4, loc=(0, 0, 0.3), color="iron", segs=8, base=True, r2=0.04)
    g.cyl(0.07, 0.08, loc=(0, 0, 2.6), color="iron", segs=8, base=True)
    g.cyl(0.13, 0.32, loc=(0, 0, 2.68), color="glass_lamp", segs=6, base=True, r2=0.17)
    g.cyl(0.04, 0.12, loc=(0, 0, 2.75), color="flame", segs=5, base=True, r2=0.01)
    g.cyl(0.21, 0.12, loc=(0, 0, 3.0), color="iron", segs=6, base=True, r2=0.05)
    g.sphere(0.04, loc=(0, 0, 3.15), color="iron", segs=6, rings=4)
    for k in range(6):
        a = math.radians(k * 60)
        g.box((0.02, 0.02, 0.33), loc=(0.15 * math.cos(a), 0.15 * math.sin(a), 2.84), color="iron", rot=(0, 0, k * 60))
    return g


def coop_crate(A):
    g = A.geo()
    g.box((1.1, 0.75, 0.62), color="wood", base=True, bevel=0.02)
    for x in (-0.52, 0.52):
        g.box((0.08, 0.78, 0.64), loc=(x, 0, 0), color="wood_dark", base=True)
    g.box((1.14, 0.8, 0.08), loc=(0, 0.02, 0.62), color="paint_green", base=True, rot=(-6, 0, 0))
    g.box((0.5, 0.02, 0.28), loc=(0, -0.385, 0.3), color="paint_cream")
    g.cyl(0.08, 0.01, loc=(-0.12, -0.396, 0.33), color="paint_red", segs=8, rot=(90, 0, 0))
    for k in range(3):
        g.box((0.18 if k else 0.1, 0.012, 0.03), loc=(0.08, -0.396, 0.37 - k * 0.06), color="shadow")
    g.box((0.1, 0.05, 0.06), loc=(0, -0.41, 0.55), color="brass")
    return g


def notice_board(A):
    g = A.geo()
    for x in (-0.45, 0.45):
        g.box((0.09, 0.09, 2.1), loc=(x, 0, 0), color="wood_dark", base=True)
    g.box((0.85, 0.06, 0.95), loc=(0, 0, 1.0), color="wood", base=True, bevel=0.01)
    g.box((0.92, 0.1, 0.06), loc=(0, 0, 0.98), color="wood_dark", base=True)
    slab(g, [(-0.55, -0.3, 2.05), (0.55, -0.3, 2.05), (0.55, 0.1, 2.2), (-0.55, 0.1, 2.2)], 0.04, "lauze")
    papers = [(-0.2, 1.55, 0.3, 0.42, "paper"), (0.2, 1.62, 0.28, 0.3, "paper_dark"), (0.18, 1.2, 0.3, 0.32, "paper"),
              (-0.2, 1.15, 0.26, 0.28, "paper")]
    for x, z, w, h, c in papers:
        g.box((w, 0.01, h), loc=(x, -0.035, z), color=c, rot=(0, (x * 10) % 6 - 3, 0))
        g.box((0.03, 0.012, 0.03), loc=(x, -0.04, z + h / 2 - 0.04), color="flower_red")
        for k in range(3):
            g.box((w * 0.7, 0.012, 0.02), loc=(x, -0.042, z + h / 4 - k * 0.07), color="sepia_dark")
    return g


def station_sign(A):
    """Panneau « Aubrune » sur deux poteaux (lettres stylisées: aplats, pas de texte)."""
    g = A.geo()
    for x in (-0.85, 0.85):
        g.box((0.1, 0.1, 2.3), loc=(x, 0, 0), color="iron", base=True)
        g.box((0.2, 0.2, 0.1), loc=(x, 0, 0), color="stone", base=True)
    g.box((1.9, 0.08, 0.5), loc=(0, 0, 1.95), color="white_paint", base=True, bevel=0.02)
    g.box((1.96, 0.06, 0.56), loc=(0, 0.02, 1.92), color="paint_blue", base=True)
    # lettres AUBRUNE en relief (police de 3 x 5 pavés), sur les deux faces (lisibles de chaque côté)
    # police grasse de 4 x 5 pavés: B à deux panses, N à diagonale épaisse, lignes jointives
    glyphs = {"A": ("0110", "1101", "1111", "1101", "1101"), "U": ("1101", "1101", "1101", "1101", "0110"),
              "B": ("1110", "1101", "1110", "1101", "1110"), "R": ("1110", "1101", "1110", "1110", "1101"),
              "N": ("1001", "1101", "1111", "1011", "1001"), "E": ("1111", "1100", "1110", "1100", "1111")}
    px, word, gw = 0.052, "AUBRUNE", 4
    x0 = -(len(word) * (gw + 1) - 1) * px / 2
    for face, yy in ((1, -0.0415), (-1, 0.0515)):
        for i, ch in enumerate(word):
            for r, row in enumerate(glyphs[ch]):
                c = 0
                while c < gw:
                    if row[c] == "1":
                        c2 = c
                        while c2 + 1 < gw and row[c2 + 1] == "1":
                            c2 += 1
                        xa = x0 + (i * (gw + 1) + c) * px
                        xb = x0 + (i * (gw + 1) + c2 + 1) * px
                        xc = (xa + xb) / 2 * face  # au dos, le mot se lit dans l'autre sens: miroir
                        # lettres en aplat (2 triangles par pavé): face avant bleue sur blanc, dos blanc sur bleu
                        hw, z = (xb - xa) / 2, 2.07 + (2 - r) * px
                        za, zb = z - px / 2, z + px / 2
                        quad = [(xc - hw, yy, za), (xc + hw, yy, za), (xc + hw, yy, zb), (xc - hw, yy, zb)]
                        g.quad(quad if face > 0 else list(reversed(quad)), "paint_blue" if face > 0 else "white_paint")
                        c = c2 + 1
                    else:
                        c += 1
    for x in (-0.85, 0.85):
        g.sphere(0.06, loc=(x, 0, 2.33), color="iron", segs=6, rings=4)
    return g


def arbor(A):
    """Tonnelle d'Odette: pergola, vigne, table et deux bancs (emprise 3 x 2).

    La vigne tient à la tonnelle: tiges qui s'enroulent autour de trois poteaux et portent leurs
    feuilles; feuillage du dessus posé sur les lattes, qui retombe un peu sur les bords. Moins de 900
    triangles (bible 8.8)."""
    g = A.geo()
    for x in (-1.35, 1.35):
        for y in (-0.85, 0.85):
            g.box((0.12, 0.12, 2.35), loc=(x, y, 0), color="wood", base=True)
    for y in (-0.85, 0.85):
        g.box((3.0, 0.1, 0.12), loc=(0, y, 2.35), color="wood", base=True)
    for k in range(7):
        g.box((0.08, 2.0, 0.08), loc=(-1.4 + k * 0.467, 0, 2.47), color="wood_dark", base=True)
    rnd = random.Random(9)
    # vigne des poteaux: une tige en spirale (4 segments autour du poteau), trois touffes accrochées
    for px, py in ((-1.35, -0.85), (1.35, 0.85), (1.35, -0.85)):
        pts = []
        # tige brune de 4 cm qui spirale à l'extérieur du poteau (bien visible), feuilles collées à la tige
        for k in range(6):
            a = math.radians(k * 100 + 30)
            pts.append((px + 0.088 * math.cos(a), py + 0.088 * math.sin(a), 0.03 + k * 0.45))
        for p, q in zip(pts, pts[1:]):
            rod(g, p, q, 0.02, "bark")
        for k in (2, 4):
            p = pts[k]
            a = math.radians(k * 100 + 30)
            g.sphere(0.12, loc=(p[0] + 0.1 * math.cos(a), p[1] + 0.1 * math.sin(a), p[2]), color="ivy", ico=1,
                     jitter=0.15, seed=20 + k, scale=(0.9, 0.9, 1.2))
    # feuillage du dessus: posé sur les lattes (2 cm engagés), deux touffes qui retombent sur les bords
    for k, (x, y, r) in enumerate(((-0.9, -0.3, 0.42), (0.0, 0.25, 0.46), (0.85, -0.2, 0.42), (-0.35, 0.5, 0.36),
                                   (0.5, 0.6, 0.34))):
        g.sphere(r, loc=(x, y, 2.55 + r * 0.45 * 0.6 - 0.02), color="ivy" if k % 3 else "leaf_oak", ico=1,
                 jitter=0.12, seed=k, scale=(1.25, 1.0, 0.45), rot=(0, 0, rnd.uniform(0, 360)))
    g.sphere(0.3, loc=(-1.2, 0.9, 2.42), color="ivy", ico=1, jitter=0.12, seed=31, scale=(1.0, 0.6, 0.9))  # retombe
    # table et bancs
    g.box((1.6, 0.8, 0.05), loc=(0, 0, 0.72), color="wood_new", base=True, bevel=0.01)
    g.box((1.62, 0.82, 0.02), loc=(0, 0, 0.77), color="fabric_red", base=True)
    for k in range(2):
        g.box((0.3, 0.84, 0.021), loc=(-0.4 + k * 0.8, 0, 0.771), color="fabric_cream", base=True)
    for x in (-0.65, 0.65):
        g.box((0.08, 0.6, 0.72), loc=(x, 0, 0), color="wood", base=True)
    for s in (1, -1):
        g.box((1.6, 0.3, 0.05), loc=(0, s * 0.65, 0.42), color="wood_new", base=True, bevel=0.01)
        for x in (-0.65, 0.65):
            g.box((0.06, 0.26, 0.42), loc=(x, s * 0.65, 0), color="wood", base=True)
    return g


def mailbox(A):
    g = A.geo()
    g.box((0.1, 0.1, 1.05), color="wood_dark", base=True)
    g.box((0.4, 0.28, 0.32), loc=(0, -0.02, 1.0), color="paint_yellow", base=True, bevel=0.02)
    g.box((0.42, 0.3, 0.06), loc=(0, -0.02, 1.32), color="paint_yellow", base=True, rot=(0, 0, 0))
    g.box((0.28, 0.025, 0.07), loc=(0, -0.165, 1.22), color="iron")
    g.box((0.24, 0.03, 0.035), loc=(0, -0.168, 1.22), color="shadow")  # fente, encadrée de fer
    g.box((0.12, 0.02, 0.06), loc=(0, -0.168, 1.08), color="paint_blue")
    return g


def barrel(A):
    g = A.geo()
    g.lathe([(0.26, 0.0), (0.3, 0.2), (0.31, 0.38), (0.3, 0.56), (0.26, 0.76)], colors="wood", segs=10)
    for z in (0.07, 0.3, 0.46, 0.69):
        g.cyl(0.29 + 0.025 * math.sin(math.pi * z / 0.76), 0.035, loc=(0, 0, z), color="iron", segs=10)
    g.cyl(0.23, 0.01, loc=(0, 0, 0.76), color="wood_dark", segs=10)
    return g


def crate(A, size=0.6):
    g = A.geo()
    g.box((size, size, size), color="wood_new", base=True, bevel=0.01)
    for s in (1, -1):
        for axis in range(2):
            loc = (s * size / 2, 0, size / 2) if axis == 0 else (0, s * size / 2, size / 2)
            sz = (0.02, size + 0.02, 0.08) if axis == 0 else (size + 0.02, 0.02, 0.08)
            g.box(sz, loc=loc, color="wood", rot=(45 if axis == 0 else 0, 45 if axis else 0, 0))
    return g


def crate_stack(A):
    g = A.geo()
    for (x, y, z, r) in ((-0.32, 0, 0, 5), (0.33, 0.05, 0, -8), (0.0, 0.02, 0.6, 12)):
        g.box((0.6, 0.6, 0.6), loc=(x, y, z), color="wood_new", base=True, bevel=0.01, rot=(0, 0, r))
        g.box((0.62, 0.08, 0.62), loc=(x, y - 0.0, z + 0.01), color="wood", base=True, rot=(0, 0, r))
    g.box((0.4, 0.4, 0.12), loc=(0.33, 0.05, 0.6), color="carrot", base=True, rot=(0, 0, -8))
    return g


def sacks(A):
    g = A.geo()
    for (x, y, r) in ((-0.25, 0, 10), (0.25, 0.05, -15), (0.0, -0.05, 0)):
        z = 0.32 if (x, y) == (0.0, -0.05) else 0.0
        g.lathe([(0.2, 0.0), (0.24, 0.12), (0.22, 0.38), (0.12, 0.48), (0.08, 0.52)], loc=(x, y, z),
                colors="burlap", segs=8, scale=(1, 0.8, 0.9), rot=(0, 0, r))
    return g


def cart(A):
    g = A.geo()
    g.box((1.4, 1.0, 0.08), loc=(0, 0, 0.55), color="wood", base=True)
    for s in (1, -1):
        g.box((1.4, 0.06, 0.3), loc=(0, s * 0.5, 0.63), color="wood", base=True)
    g.box((0.06, 1.0, 0.3), loc=(-0.7, 0, 0.63), color="wood", base=True)
    for s in (1, -1):
        g.cyl(0.42, 0.07, loc=(0.1, s * 0.6, 0.42), color="wood_dark", segs=12, rot=(90, 0, 0))
        g.cyl(0.08, 0.1, loc=(0.1, s * 0.6, 0.42), color="iron", segs=6, rot=(90, 0, 0))
        for k in range(6):
            g.box((0.04, 0.03, 0.78), loc=(0.1, s * 0.6, 0.42), color="wood", rot=(0, k * 30, 0))
        g.box((1.2, 0.06, 0.06), loc=(1.2, s * 0.3, 0.55), color="wood_dark", rot=(0, 10, 0))
    g.box((0.04, 0.6, 0.04), loc=(1.75, 0, 0.45), color="wood_dark")
    # béquille sous l'avant: la charrette tient à l'horizontale sans basculer
    for s in (1, -1):
        g.box((0.05, 0.05, 0.55), loc=(0.62, s * 0.3, 0.0), color="wood_dark", base=True)
    for k in range(4):
        g.box((0.6, 0.15, 0.03), loc=(-0.2 + (k % 2) * 0.1, -0.2 + k * 0.13, 0.64 + k * 0.03), color="wood_new", rot=(0, 0, 8 * k))
    return g


def bicycle(A):
    g = A.geo()
    for x in (-0.55, 0.55):
        ring = [(0.3, -0.018), (0.345, -0.018), (0.345, 0.018), (0.3, 0.018), (0.3, -0.018)]
        g.lathe(ring, loc=(x, 0, 0.35), colors="black", segs=14, rot=(90, 0, 0), close_top=False, close_bottom=False)
        for a in (0, 60, 120):
            g.box((0.6, 0.012, 0.012), loc=(x, 0, 0.35), color="iron_light", rot=(0, a, 0))
        g.cyl(0.04, 0.05, loc=(x, 0, 0.35), color="iron", segs=6, rot=(90, 0, 0))
    for (p, q) in (((-0.55, 0.35), (0.0, 0.38)), ((0.0, 0.38), (0.45, 0.8)), ((0.0, 0.38), (-0.1, 0.85)),
                   ((-0.1, 0.85), (0.45, 0.8)), ((-0.55, 0.35), (-0.1, 0.85)), ((0.55, 0.35), (0.45, 0.8))):
        mx, mz = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        L = math.hypot(q[0] - p[0], q[1] - p[1])
        a = math.degrees(math.atan2(q[1] - p[1], q[0] - p[0]))
        g.box((L, 0.03, 0.03), loc=(mx, 0, mz), color="paint_blue", rot=(0, -a, 0))
    g.box((0.22, 0.09, 0.04), loc=(-0.12, 0, 0.9), color="leather")
    g.box((0.05, 0.5, 0.03), loc=(0.48, 0, 0.95), color="iron")
    # tige de selle, potence, porte-bagages sous chaque caisse, pédalier, chaîne et béquille:
    # chaque pièce porte ou est portée
    rod(g, (-0.1, 0, 0.84), (-0.12, 0, 0.885), 0.012, "iron")
    rod(g, (0.45, 0, 0.79), (0.48, 0, 0.94), 0.014, "iron")
    g.box((0.3, 0.3, 0.02), loc=(0.7, 0, 0.71), color="iron")
    for yy in (-0.12, 0.12):
        rod(g, (0.62, yy, 0.71), (0.55, yy * 0.4, 0.35), 0.008, "iron")
    rod(g, (0.56, 0, 0.71), (0.46, 0, 0.76), 0.008, "iron")
    g.box((0.32, 0.36, 0.2), loc=(0.7, 0, 0.82), color="leather", bevel=0.02)
    g.box((0.3, 0.3, 0.02), loc=(-0.55, 0, 0.69), color="iron")
    for yy in (-0.12, 0.12):
        rod(g, (-0.6, yy, 0.69), (-0.55, yy * 0.4, 0.35), 0.008, "iron")
    rod(g, (-0.41, 0, 0.69), (-0.1, 0, 0.8), 0.008, "iron")
    g.box((0.3, 0.3, 0.16), loc=(-0.55, 0.0, 0.78), color="leather", bevel=0.02)
    g.cyl(0.09, 0.012, loc=(0, 0.04, 0.38), color="iron", segs=12, rot=(90, 0, 0))
    for sg in (1, -1):
        cx, cz = 0.16 * sg * math.cos(math.radians(60)), -0.16 * sg * math.sin(math.radians(60))
        yy = 0.06 * sg
        rod(g, (0, yy, 0.38), (cx, yy, 0.38 + cz), 0.012, "iron")
        g.box((0.08, 0.05, 0.02), loc=(cx, yy + 0.04 * sg, 0.38 + cz), color="black")
    for dz in (0.085, -0.085):
        rod(g, (0.0, 0.045, 0.38 + dz), (-0.55, 0.045, 0.35 + dz * 0.45), 0.005, "black")
    rod(g, (-0.06, 0.03, 0.37), (-0.16, 0.18, 0.0), 0.01, "iron")
    return g


def rod(g, p, q, r, color, segs=5):
    """Tige cylindrique de p à q (repère du modèle)."""
    p, q = Vector(p), Vector(q)
    d = q - p
    rot = d.to_track_quat("Z", "Y").to_euler()
    g.cyl(r, d.length, loc=tuple((p + q) / 2), color=color, segs=segs,
          rot=tuple(math.degrees(a) for a in rot))


# Sols, chemins, clôtures ------------------------------------------------------------

def ground_tile(A, kind):
    g = A.geo()
    col = {"grass": "grass", "dirt": "path", "cobble": "cobble"}[kind]
    g.box((1.0, 1.0, 0.02), color=col, base=True)
    if kind == "cobble":
        for i in range(4):
            for j in range(4):
                g.box((0.22, 0.22, 0.012), loc=(-0.375 + i * 0.25 + (0.06 if j % 2 else 0), -0.375 + j * 0.25, 0.02),
                      color="cobble_dark" if (i + j) % 3 == 0 else "cobble", base=True, bevel=0.02)
    elif kind == "dirt":
        for (x, y) in ((-0.3, 0.2), (0.25, -0.3), (0.2, 0.35)):
            g.box((0.08, 0.06, 0.01), loc=(x, y, 0.02), color="path_dark", base=True, rot=(0, 0, 30 * x))
    else:
        for (x, y) in ((-0.3, 0.2), (0.25, -0.3)):
            g.cyl(0.03, 0.08, loc=(x, y, 0.02), color="grass_dark", segs=4, r2=0.0, base=True)
    return g


def path_border(A):
    g = A.geo()
    for k in range(4):
        g.box((0.22, 0.14, 0.1), loc=(-0.375 + k * 0.25, 0, 0), color="stone_light" if k % 2 else "stone", base=True,
              bevel=0.025, rot=(0, 0, (k * 7) % 9 - 4))
    return g


def fence(A, kind):
    g = A.geo()
    if kind == "wood":
        g.box((0.1, 0.1, 0.95), loc=(-0.5, 0, 0), color="wood_dark", base=True)
        g.box((1.02, 0.05, 0.1), loc=(0, 0, 0.4), color="wood", rot=(0, 2, 0))
        g.box((1.02, 0.05, 0.1), loc=(0, 0, 0.75), color="wood", rot=(0, -1.5, 0))
    elif kind == "picket":
        g.box((1.0, 0.04, 0.07), loc=(0, 0.03, 0.3), color="paint_cream")
        g.box((1.0, 0.04, 0.07), loc=(0, 0.03, 0.65), color="paint_cream")
        for k in range(6):
            x = -0.5 + 0.0833 + k * 0.1667
            g.box((0.09, 0.025, 0.85), loc=(x, 0, 0), color="paint_cream", base=True)
            g.prism([(-0.045, 0), (0.045, 0), (0, 0.06)], 0.025, loc=(x, 0, 0.85), color="paint_cream")
        g.box((0.09, 0.09, 0.95), loc=(-0.5, 0.02, 0), color="paint_cream", base=True)
    elif kind == "broken":
        g.box((0.1, 0.1, 0.8), loc=(-0.5, 0, 0), color="wood_old_dark", base=True, rot=(0, 8, 0))
        g.box((0.7, 0.05, 0.1), loc=(-0.15, 0, 0.62), color="wood_old", rot=(0, 12, 0))
        g.box((0.6, 0.05, 0.1), loc=(0.15, 0.05, 0.05), color="wood_old", rot=(0, 0, 15))  # posée au sol
    elif kind == "gate":
        g.box((0.1, 0.1, 1.05), loc=(-0.5, 0, 0), color="wood_dark", base=True)
        g.box((0.1, 0.1, 1.05), loc=(0.5, 0, 0), color="wood_dark", base=True)
        for z in (0.25, 0.8):
            g.box((0.86, 0.05, 0.08), loc=(0, 0, z), color="wood")
        g.box((1.0, 0.05, 0.08), loc=(0, 0, 0.52), color="wood", rot=(0, -33, 0))
        for k in range(4):
            g.box((0.06, 0.04, 0.6), loc=(-0.3 + k * 0.2, 0, 0.22), color="wood_new", base=True)
    elif kind == "post":
        g.box((0.1, 0.1, 0.95), color="wood_dark", base=True)
    return g


# Nature -------------------------------------------------------------------------

def tree_oak(A, large, seed):
    """Low poly arrondi: tronc à 8 pans évasé au pied, 3 racines, 3 boules facettées (80 faces) qui se chevauchent."""
    g = A.geo()
    rnd = random.Random(seed)
    s = 1.45 if large else 1.0
    g.lathe([(0.30 * s, 0.0), (0.2 * s, 0.28 * s), (0.17 * s, 1.2 * s), (0.14 * s, 2.1 * s)], colors="bark",
            segs=8, close_bottom=False, close_top=False, phase=10)
    g.cyl(0.075 * s, 0.95 * s, loc=(0.27 * s, 0, 1.65 * s), color="bark", segs=6, rot=(0, 40, 0), r2=0.05 * s)
    g.cyl(0.07 * s, 0.85 * s, loc=(-0.24 * s, 0.1, 1.75 * s), color="bark", segs=6, rot=(10, -38, 0), r2=0.05 * s)
    for k in range(3):
        a = k * 120 + 25
        ar = math.radians(a)
        g.cyl(0.09 * s, 0.5 * s, loc=(0.36 * s * math.cos(ar), 0.36 * s * math.sin(ar), 0.03 * s), color="bark_dark",
              segs=5, r2=0.03 * s, cap=False, rot=(0, 100, a))
    # trois boules (budget de la scène: 30 chênes, ombres comprises)
    for (x, y, z, r, c, sc) in ((-0.15, 0, 2.95, 1.38, "leaf_oak", (1.12, 1.0, 0.85)),
                                (0.95, 0.25, 2.55, 0.9, "leaf_oak", (1.0, 1.1, 0.88)),
                                (0.32, -0.3, 3.55, 0.88, "leaf_oak_light", (1.0, 1.0, 0.85))):
        g.sphere(r * s, loc=(x * s, y * s, z * s), color=c, ico=2, jitter=0.07, seed=rnd.randint(0, 999),
                 scale=sc, rot=(0, 0, rnd.uniform(0, 360)))
    return g


def tree_fir(A, large, seed):
    g = A.geo()
    s = 1.5 if large else 1.0
    g.cyl(0.14 * s, 1.0 * s, color="bark_dark", segs=7, base=True, r2=0.12 * s, cap=False)
    tiers = [(0.6, 1.55, 1.6), (1.4, 1.25, 1.4), (2.15, 0.95, 1.25), (2.85, 0.65, 1.1)]
    for i, (z, r, h) in enumerate(tiers):
        # bord inférieur arrondi (un segment), pointe molle
        g.lathe([(r * s * 0.9, 0.0), (r * s, 0.08 * s), (r * s * 0.12, h * s * 0.9), (0.0, h * s)],
                loc=(0, 0, z * s), colors=by_normal("leaf_fir_light", "leaf_fir", "leaf_fir", thr=0.3), segs=7,
                rot=(0, 0, i * 25 + 7 * (i % 2)))
    return g


def tree_birch(A, large, seed):
    g = A.geo()
    rnd = random.Random(seed)
    s = 1.4 if large else 1.0
    g.lathe([(0.16 * s, 0.0), (0.11 * s, 0.25 * s), (0.08 * s, 3.2 * s)], colors="birch_bark", segs=8,
            close_bottom=False, rot=(0, 3, 0))
    for k in range(6):
        g.box((0.12 * s, 0.03, 0.05), loc=(0.07 * s * (1 if k % 2 else -1), -0.08 * s, (0.4 + k * 0.45) * s),
              color="birch_mark", rot=(0, 0, 40 * k))
    g.cyl(0.04 * s, 0.9 * s, loc=(0.25 * s, 0, 2.2 * s), color="birch_bark", segs=5, rot=(0, 35, 0))
    for (x, y, z, r, c) in ((0.05, 0, 3.45, 0.88, "leaf_birch"), (0.45, 0.15, 2.8, 0.62, "leaf_birch_light"),
                            (-0.38, -0.12, 2.95, 0.64, "leaf_birch")):
        g.sphere(r * s, loc=(x * s, y * s, z * s), color=c, ico=2, jitter=0.07, seed=rnd.randint(0, 999),
                 scale=(0.9, 0.9, 1.22), rot=(0, 0, rnd.uniform(0, 360)))
    return g


def tree_stump(A):
    g = A.geo()
    g.cyl(0.24, 0.42, color="bark", segs=8, base=True, r2=0.21)
    g.cyl(0.19, 0.02, loc=(0, 0, 0.42), color="log_end", segs=8)
    g.cyl(0.09, 0.022, loc=(0, 0, 0.42), color="log_ring", segs=8)
    for k in range(4):
        a = math.radians(k * 90 + 30)
        g.box((0.4, 0.12, 0.1), loc=(0.26 * math.cos(a), 0.26 * math.sin(a), 0.03), color="bark_dark", rot=(0, 0, k * 90 + 30))
    g.box((0.12, 0.05, 0.05), loc=(0.05, 0.1, 0.44), color="log_end", rot=(0, 0, 30))
    return g


def bush(A, kind, seed):
    g = A.geo()
    rnd = random.Random(seed)
    if kind == "round":
        # low poly arrondi: une boule facettée de 80 faces et une petite de 20, aplaties, sans pied
        # (79 buissons sur la carte: le budget de la scène compte)
        for (x, y, z, r, c, ico) in ((-0.08, 0.02, 0.36, 0.53, "leaf_bush", 2), (0.32, -0.06, 0.25, 0.32, "leaf_oak", 1)):
            g.sphere(r, loc=(x, y, z), color=c, ico=ico, jitter=0.06, seed=rnd.randint(0, 99), scale=(1.1, 1.0, 0.78),
                     rot=(0, 0, rnd.uniform(0, 360)))
    elif kind == "bramble":
        for (x, y, z, r) in ((-0.05, 0, 0.3, 0.48), (0.38, 0.05, 0.24, 0.33)):
            g.sphere(r, loc=(x, y, z), color="leaf_bush", ico=2, jitter=0.07, seed=rnd.randint(0, 99), scale=(1.1, 1, 0.78))
        for k in range(10):
            a = rnd.uniform(0, 6.28)
            rr = rnd.uniform(0.25, 0.5)
            g.box((0.05, 0.05, 0.05), loc=(rr * math.cos(a), rr * math.sin(a) - 0.05, rnd.uniform(0.25, 0.6)),
                  color="flower_white", rot=(0, 0, 45))
    else:  # hazel
        for k in range(3):
            a = math.radians(k * 120)
            g.cyl(0.035, 1.3, loc=(0.1 * math.cos(a), 0.1 * math.sin(a), 0), color="bark", segs=5, base=True,
                  rot=(12 * math.sin(a), -12 * math.cos(a), 0))
        g.sphere(0.72, loc=(0.0, 0.05, 1.25), color="leaf_hazel", ico=2, jitter=0.08, seed=rnd.randint(0, 99),
                 scale=(1.1, 1.0, 0.85))
    return g


def rock(A, size, seed):
    g = A.geo()
    rnd = random.Random(seed)
    s = {"small": 0.25, "medium": 0.5, "large": 0.9}[size]
    g.sphere(s, loc=(0, 0, s * 0.35), color=by_normal("rock_light", "rock", "rock_dark", thr=0.5), ico=1, jitter=0.18,
             seed=seed, scale=(1.2, 1.0, 0.75))
    if size != "small":
        g.sphere(s * 0.5, loc=(s * 0.9, s * 0.3, s * 0.15), color=by_normal("rock_light", "rock", thr=0.5), ico=1, jitter=0.2,
                 seed=seed + 1, scale=(1.1, 1.0, 0.7))
    if size == "large":
        g.box((0.4, 0.3, 0.05), loc=(-0.2, 0.1, s * 0.85), color="moss", rot=(0, 5, 20))
    return g


def grass_tall(A, seed):
    g = A.geo()
    rnd = random.Random(seed)
    for k in range(9):
        a = rnd.uniform(0, 6.28)
        r = rnd.uniform(0.0, 0.25)
        h = rnd.uniform(0.35, 0.6)
        g.cyl(0.035, h, loc=(r * math.cos(a), r * math.sin(a), 0), color=["grass_dark", "grass", "grass_dry"][k % 3], segs=3,
              r2=0.0, base=True, rot=(rnd.uniform(-15, 15), rnd.uniform(-15, 15), 0))
    return g


def flowers(A, color, seed):
    g = A.geo()
    rnd = random.Random(seed)
    for k in range(7):
        a = rnd.uniform(0, 6.28)
        r = rnd.uniform(0.05, 0.3)
        h = rnd.uniform(0.15, 0.35)
        x, y = r * math.cos(a), r * math.sin(a)
        g.cyl(0.008, h, loc=(x, y, 0), color="leaf_crop", segs=3, base=True)
        g.cyl(0.045, 0.02, loc=(x, y, h), color=color, segs=6)
        g.cyl(0.015, 0.025, loc=(x, y, h), color="flower_center", segs=4)
    for k in range(3):
        leaf_a = rnd.uniform(0, 360)
        g.prism([(0, 0), (0.06, 0.03), (0.14, 0), (0.06, -0.03)], 0.006, loc=(0, 0, 0.01), color="leaf_bush",
                rot=(90, -10, leaf_a))
    return g


def flower_bed(A):
    """Massif de fleurs bordé de pierres (2 x 1), moins de 900 triangles (bible 8.8)."""
    g = A.geo()
    g.box((2.0, 1.0, 0.12), color="soil_tilled", base=True)
    # bordure: pierres de 40 cm, couleurs alternées
    for k in range(5):
        for s in (1, -1):
            g.box((0.39, 0.1, 0.16), loc=(-0.8 + k * 0.4, s * 0.5, 0), color="stone_light" if k % 2 else "stone", base=True)
    for s in (1, -1):
        g.box((0.1, 0.9, 0.16), loc=(s * 1.0, 0, 0), color="stone", base=True)
    rnd = random.Random(7)
    cols = ["flower_red", "flower_yellow", "flower_white", "flower_pink", "flower_violet", "flower_blue"]
    for k in range(14):
        x, y = rnd.uniform(-0.85, 0.85), rnd.uniform(-0.36, 0.36)
        h = rnd.uniform(0.15, 0.35)
        g.cyl(0.01, h, loc=(x, y, 0.12), color="leaf_crop", segs=3, base=True, cap=False)
        g.sphere(0.065, loc=(x, y, 0.12 + h), color=cols[k % 6], segs=5, rings=3, scale=(1, 1, 0.6))
    for k in range(5):
        g.sphere(0.14, loc=(rnd.uniform(-0.8, 0.8), rnd.uniform(-0.3, 0.3), 0.15), color="leaf_bush", segs=5, rings=3,
                 scale=(1, 1, 0.6))
    return g


def reeds(A, seed):
    g = A.geo()
    rnd = random.Random(seed)
    for k in range(10):
        a, r = rnd.uniform(0, 6.28), rnd.uniform(0, 0.3)
        h = rnd.uniform(0.7, 1.2)
        x, y = r * math.cos(a), r * math.sin(a)
        g.cyl(0.02, h, loc=(x, y, 0), color="leaf_hazel" if k % 2 else "grass_dark", segs=3, base=True,
              rot=(rnd.uniform(-8, 8), rnd.uniform(-8, 8), 0))
        if k % 3 == 0:
            g.cyl(0.035, 0.18, loc=(x, y, h - 0.05), color="bark", segs=5, base=True)
    return g


# Rivière ----------------------------------------------------------------------

RIVER = dict(width=8.0, water=4.8, z_water=-0.3, z_bed=-0.75)


def river_profile():
    """Profil en travers (y, z) de berge à berge."""
    w, ww = RIVER["width"] / 2, RIVER["water"] / 2
    return [(-w, 0.0), (-ww - 0.6, -0.05), (-ww, -0.42), (-ww + 0.8, RIVER["z_bed"]), (ww - 0.8, RIVER["z_bed"]),
            (ww, -0.42), (ww + 0.6, -0.05), (w, 0.0)]


def _river_band(g, path_pts, colors):
    """path_pts: liste de (position, normale latérale) le long de l'axe; profil extrudé."""
    prof = river_profile()
    rows = []
    for p, n in path_pts:
        rows.append([(p.x + n.x * y, p.y + n.y * y, z) for (y, z) in prof])
    for i in range(len(rows) - 1):
        for j in range(len(prof) - 1):
            a, b, c, d = rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]
            col = colors[j]
            g.mesh([a, b, c, d], [(0, 3, 2, 1)], col)


BANK_COLORS = ["grass", "bank", "sand", "sand", "sand", "bank", "grass"]


def river_straight(A, ford=False):
    name = "river_ford" if ford else "river_straight"
    root = A.group(name, {"footprint": [4, 8], "flow_axis": "x", "water_y": RIVER["z_water"],
                          "note": "module de 4 m le long de X; l'eau est le nœud *_water (animable à part)"})
    g = A.geo()
    pts = [(Vector((x, 0, 0)), Vector((0, 1, 0))) for x in (-2.0, -0.67, 0.67, 2.0)]
    _river_band(g, pts, BANK_COLORS)
    rnd = random.Random(3 if ford else 5)
    for k in range(7):
        y = rnd.choice([-1, 1]) * rnd.uniform(2.3, 3.3)
        g.sphere(rnd.uniform(0.12, 0.25), loc=(rnd.uniform(-1.8, 1.8), y, -0.2), color="rock", ico=1, jitter=0.2,
                 seed=k, scale=(1.2, 1, 0.6))
    if ford:
        for k, y in enumerate((-2.0, -1.2, -0.4, 0.4, 1.2, 2.0)):
            g.sphere(0.36, loc=(0.1 * (k % 2) - 0.05, y, -0.38), color=by_normal("rock_light", "rock", thr=0.5), ico=1,
                     jitter=0.1, seed=10 + k, scale=(1.15, 1.0, 0.75))
    A.add(name + "_banks", g, parent=root)
    w = A.geo()
    ww = RIVER["water"] / 2 + 0.25
    w.quad([(-2.0, -ww, RIVER["z_water"]), (2.0, -ww, RIVER["z_water"]), (2.0, ww, RIVER["z_water"]),
            (-2.0, ww, RIVER["z_water"])], "water")
    for (x, y, l) in ((-1.2, -1.6, 0.8), (0.6, 0.9, 1.1), (1.4, -0.4, 0.6)):
        w.box((l, 0.05, 0.005), loc=(x, y, RIVER["z_water"] + 0.004), color="water_foam")
    A.add(name + "_water", w, parent=root)
    return root


def river_curve(A, R=6.0):
    """Coude à 90 degrés: axe de rayon 6 m, centre de courbure au coin (+5, +5) de l'emprise 10 x 10."""
    root = A.group("river_curve", {"footprint": [10, 10], "water_y": RIVER["z_water"], "radius": R})
    g = A.geo()
    c = Vector((5.0, 5.0, 0))
    pts = []
    n = 10
    for i in range(n + 1):
        a = math.radians(180 + 90 * i / n)
        p = c + Vector((R * math.cos(a), R * math.sin(a), 0))
        nrm = Vector((math.cos(a), math.sin(a), 0))
        pts.append((p, -nrm))
    _river_band(g, pts, BANK_COLORS)
    A.add("river_curve_banks", g, parent=root)
    w = A.geo()
    ww = RIVER["water"] / 2 + 0.25
    for i in range(n):
        p0, n0 = pts[i]
        p1, n1 = pts[i + 1]
        quad = [p0 - n0 * ww, p0 + n0 * ww, p1 + n1 * ww, p1 - n1 * ww]
        w.mesh([(q.x, q.y, RIVER["z_water"]) for q in quad], [(0, 3, 2, 1)], "water")
    A.add("river_curve_water", w, parent=root)
    return root


def pontoon(A):
    """Ponton de 2 x 3, platelage à 0,5 m (posé sur la berge, il avance au-dessus de l'eau)."""
    g = A.geo()
    for k in range(9):
        g.box((1.8, 0.31, 0.06), loc=(0, -1.33 + k * 0.333, 0.44), color="wood" if k % 3 else "wood_old", base=True,
              bevel=0.005)
    for x in (-0.85, 0.85):
        for y in (-1.3, 0.0, 1.3):
            # pieux arrêtés sous le platelage, sur les longerons (ils ne le percent plus)
            g.cyl(0.08, 1.62, loc=(x, y, -1.3), color="wood_dark", segs=6, base=True)
        g.box((0.1, 3.0, 0.12), loc=(x, 0, 0.32), color="wood_dark", base=True)
    for y in (-1.3, 1.3):
        g.box((1.8, 0.1, 0.1), loc=(0, y, 0.33), color="wood_dark", base=True)
    g.cyl(0.06, 0.35, loc=(0.85, -1.3, 0.5), color="wood_dark", segs=6, base=True)
    g.cyl(0.08, 0.05, loc=(0.85, -1.3, 0.7), color="rope", segs=6)
    # escalier côté sud, vers l'eau (-Y ici, +Z glTF): deux limons posés sur le pont et en bas, deux
    # marches de 30 cm
    # logées entre eux, contremarches de 17 cm (0,5 m en trois hauteurs)
    y0, y1, ztop = -1.5, -2.15, 0.44
    ang = math.degrees(math.atan2(ztop, y0 - y1))
    Ls = math.hypot(y1 - y0, ztop) + 0.06
    for x in (-0.45, 0.45):
        g.box((0.06, Ls, 0.14), loc=(x, (y0 + y1) / 2, ztop / 2), color="wood_dark", rot=(ang, 0, 0))
    for k, zt in enumerate((0.333, 0.167)):
        g.box((0.84, 0.3, 0.05), loc=(0, y0 - 0.15 - k * 0.3, zt - 0.05), color="wood_old", base=True)
    return g


# Programme ------------------------------------------------------------------------

def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    lpl.AUTO_ROUND = True
    # budget de la scène (bible 8.8): pas de chanfrein automatique sur les pièces de moins de 2 m
    lpl.AUTO_MIN = (2.0, 0.08)
    buildings = []
    buildings.append(station(A))
    buildings.append(platform(A))
    gk = A.group("gatekeeper_house", {"footprint": [7, 6], "door_cell": 3, "cut_walls": True,
                                      "interior": {"x": [-2.5, 2.5], "z": [-2.0, 2.0], "floor_y": GH["floor"]},
                                      "states": ["gatekeeper_house_ruin", "gatekeeper_house_repaired"]})
    lpl.AUTO_ROUND = False  # budget (bible 8.8): seuls toit, cheminée et chaînes d'angle s'arrondissent
    gatekeeper_house(A, True, gk)
    gatekeeper_house(A, False, gk)
    lpl.AUTO_ROUND = True
    buildings.append(gk)
    buildings.append(ferrand_shop(A))
    lpl.AUTO_ROUND = False  # témoin réglé à la main
    buildings.append(firmin_house(A))
    lpl.AUTO_ROUND = True
    buildings.append(sawmill(A))
    buildings.append(handcar_shed(A))
    buildings.append(handcar(A))
    buildings.append(A.add("well", well(A), {"footprint": [2, 2], "water_point": True}))
    hh = A.group("henhouse", {"footprint": [3, 3], "door_cell": 1, "states": ["henhouse_ruin", "henhouse_repaired"]})
    henhouse(A, True, hh)
    henhouse(A, False, hh)
    buildings.append(hh)
    lpl.AUTO_ROUND = False  # établi et tas de bois: pièces nombreuses, plafonds (bible 8.8)
    extra = [A.add("workbench", workbench(A), {"footprint": [2, 2]}),
             A.add("woodpile", woodpile(A), {"footprint": [2, 1]}),
             A.add("plank_stack", plank_stack(A), {"footprint": [2, 1]})]
    lpl.AUTO_ROUND = False  # voie: profils de rail exacts (raccords entre modules)
    track = [A.add("rail_straight", rail_straight(A), {"footprint": [4, 2], "rail_top": RAIL_TOP, "gauge": RAIL_GAUGE}),
             A.add("rail_curve_90", rail_curve(A), {"footprint": [13, 13], "radius": 12.0, "rail_top": RAIL_TOP}),
             A.add("buffer_stop", buffer_stop(A), {"footprint": [1, 2]})]
    lpl.AUTO_ROUND = True
    track.append(level_crossing(A))
    props = []
    for name, fn, fp in (("bell_post", bell_post, [1, 1]), ("bench", bench, [2, 1]), ("lamp_post", lamp_post, [1, 1]),
                         ("coop_crate", coop_crate, [1, 1]), ("notice_board", notice_board, [1, 1]),
                         ("station_sign", station_sign, [2, 1]), ("arbor", arbor, [3, 2]),
                         ("mailbox", mailbox, [1, 1]), ("barrel", barrel, [1, 1]), ("crate", crate, [1, 1]),
                         ("crate_stack", crate_stack, [2, 1]), ("sacks", sacks, [1, 1]), ("cart", cart, [3, 2]),
                         ("bicycle", bicycle, [2, 1])):
        # charrette et tonnelle: beaucoup de pièces, gardées au seuil des bâtiments (plafond de 900)
        lpl.AUTO_MIN = (2.0, 0.08)
        lpl.AUTO_ROUND = name not in ("arbor",)  # tonnelle: plafond de 900, gardée vive
        props.append(A.add(name, fn(A), {"footprint": fp}))
    lpl.AUTO_MIN = (2.0, 0.08)
    lpl.AUTO_ROUND = False  # sols et bordures: dalles qui se raccordent
    grounds = []
    for k in ("grass", "dirt", "cobble"):
        grounds.append(A.add("ground_" + k, ground_tile(A, k), {"footprint": [1, 1]}))
    grounds.append(A.add("path_border", path_border(A), {"footprint": [1, 1], "note": "bordure de 1 m le long de X"}))
    lpl.AUTO_ROUND = True
    for k in ("wood", "picket", "broken", "gate", "post"):
        grounds.append(A.add("fence_" + k, fence(A, k), {"footprint": [1, 1], "note": "segment de 1 m le long de X, poteau à x=-0,5"}))
    lpl.AUTO_MIN = (2.0, 0.08)
    nature = []
    for ess, fn in (("oak", tree_oak), ("fir", tree_fir), ("birch", tree_birch)):
        for i, size in enumerate(("small", "large")):
            nature.append(A.add(f"tree_{ess}_{size}", fn(A, size == "large", 11 + i), {"footprint": [1, 1] if size == "small" else [2, 2],
                                                                                       "choppable": ess in ("oak", "fir")}))
    nature.append(A.add("tree_stump", tree_stump(A), {"footprint": [1, 1]}))
    for i, k in enumerate(("round", "bramble", "hazel")):
        nature.append(A.add("bush_" + k, bush(A, k, 20 + i), {"footprint": [1, 1]}))
    for i, k in enumerate(("small", "medium", "large")):
        nature.append(A.add("rock_" + k, rock(A, k, 30 + i), {"footprint": [1, 1] if k != "large" else [2, 2]}))
    nature.append(A.add("grass_tall", grass_tall(A, 40), {"footprint": [1, 1]}))
    for c in ("red", "yellow", "white", "blue"):
        nature.append(A.add("flowers_" + c, flowers(A, "flower_" + c, 50 + len(c)), {"footprint": [1, 1]}))
    lpl.AUTO_ROUND = False  # massif de fleurs: plafond de 900, gardé vif
    nature.append(A.add("flower_bed", flower_bed(A), {"footprint": [2, 1]}))
    lpl.AUTO_ROUND = True
    nature.append(A.add("reeds", reeds(A, 60), {"footprint": [1, 1]}))
    lpl.AUTO_ROUND = False
    water = [river_straight(A), river_straight(A, ford=True), river_curve(A),
             A.add("pontoon", pontoon(A), {"footprint": [2, 3], "walk_height": 0.5})]
    lpl.AUTO_ROUND = False
    # noms génériques de la carte (donnees/cartes/halte.json): nœuds qui partagent le maillage d'une variante
    O = bpy.data.objects
    aliases = [A.alias("tree_oak", O["tree_oak_large"]), A.alias("tree_fir", O["tree_fir_large"]),
               A.alias("bush", O["bush_round"]), A.alias("rock", O["rock_medium"]), A.alias("fence", O["fence_wood"]),
               A.add("log_pile", log_pile(A), {"footprint": [2, 1]})]
    for a in aliases:
        a.hide_render = True

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "bourg.glb")
    size = lpl.export_glb(path, objs, animations=False)
    st = A.stats()
    lpl.write_stats("bourg", {"nodes": st, "file_bytes": size})
    print("BOURG", size, sum(v["tris"] for v in st.values()))
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "bourg.blend"), compress=True)

    def sp(r):
        fp = r.get("footprint", [1, 1])
        return max(fp) + 0.6
    O = bpy.data.objects
    shown = []
    for b in buildings:
        if b.name in ("gatekeeper_house", "henhouse"):
            shown += [O[b.name + "_ruin"], O[b.name + "_repaired"]]
        else:
            shown.append(b)
    for b in shown:
        if "footprint" not in b and b.parent is not None:
            b["footprint"] = list(b.parent["footprint"])
    lpl.board(shown, os.path.join(lpl.BOARDS, "bourg-batiments.png"), cols=4, spacing=sp, label_size=0.45,
              res=(2000, 1300))
    lpl.board(track + extra + props + grounds, os.path.join(lpl.BOARDS, "bourg-voie-mobilier.png"), cols=8,
              spacing=lambda r: max(r.get("footprint", [1, 1])) + 0.8, label_size=0.2, res=(2000, 1300))
    lpl.board(nature + water, os.path.join(lpl.BOARDS, "bourg-nature.png"), cols=9,
              spacing=lambda r: max(r.get("footprint", [1, 1])) + 0.8, label_size=0.22, res=(2000, 1300))


if __name__ == "__main__":
    main()
