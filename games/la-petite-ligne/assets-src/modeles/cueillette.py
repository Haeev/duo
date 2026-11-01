"""Cueillette et jeunes arbres de la lisière (tour 8): modèles appelés par ferme.py et bourg.py.

- ferme.glb (objets, origine au centre de leur base, grossis pour rester lisibles au zoom 1):
  wild_garlic, chanterelle, blackberry, hazelnut;
- bourg.glb (décor): bramble, bush_hazel, oak_sapling (et son enfant oak_sapling_shoots), fir_sapling.

Repères côté Blender: Z en haut, face avant vers -Y (devient +Z en glTF).

Taille de lecture: au zoom 1 du jeu (24 m sur 1366 px, 57 px/m), un objet de 0,25 m tient en 14 pixels;
plus petit, il se perd dans l'herbe (leçon du martin-pêcheur, tour 7). Les fruits et les champignons sont
donc agrandis deux à trois fois par rapport au réel, comme le pissenlit et les récoltes de la ferme.
"""
import math
import random

import bpy  # noqa: F401,I001  (bmesh demande bpy chargé avant lui)
import bmesh
from mathutils import Matrix, Vector

import lpl
from lpl import by_normal


# Outils de forme -------------------------------------------------------------------------------

def _closed(g, coords, faces, color):
    """Volume fermé fait à la main: normales recalculées vers l'extérieur, puis couleur par face."""
    vs = [g.bm.verts.new(c) for c in coords]
    fs = [g.bm.faces.new([vs[i] for i in f]) for f in faces]
    bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    return g.recolor(vs, color)


def _frame(t):
    """Deux vecteurs perpendiculaires à la tangente t (repère d'un anneau de tube)."""
    ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
    a = t.cross(ref).normalized()
    b = t.cross(a).normalized()
    return a, b


def tube(g, pts, r0, r1, color, segs=5):
    """Tige ou ronce le long d'une polyligne, rayon de r0 à r1, bouchée aux deux bouts."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    coords, faces = [], []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        a, b = _frame(t.normalized())
        r = r0 + (r1 - r0) * i / (n - 1)
        for k in range(segs):
            ang = 2 * math.pi * k / segs
            coords.append(p + (a * math.cos(ang) + b * math.sin(ang)) * r)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append([i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k])
    faces.append(list(range(segs)))
    faces.append([(n - 1) * segs + k for k in range(segs)])
    return _closed(g, coords, faces, color)


def bezier(p0, p1, p2, n):
    """n points d'une courbe de Bézier quadratique (arc d'une ronce, d'une tige)."""
    p0, p1, p2 = Vector(p0), Vector(p1), Vector(p2)
    out = []
    for i in range(n):
        t = i / (n - 1)
        out.append((1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2)
    return out


def blade(g, base, yaw, pitch0, pitch1, length, width, top, under, fold=0.35, thick=0.006,
          widths=(1.0, 0.8), roll=0.0, ts=(0.0, 0.32, 0.68, 1.0)):
    """Feuille en volume (section en chevron: nervure en haut, bords un peu tombants), arquée de pitch0 au
    pied à pitch1 au bout. Jamais une plaque: vue par la tranche, elle garde une épaisseur et deux facettes.
    yaw: direction (degrés, 0 = +X); roll: dévers de la feuille autour de son axe."""
    base = Vector(base)
    yr = math.radians(yaw)
    fwd_h = Vector((math.cos(yr), math.sin(yr), 0.0))
    side0 = Vector((-math.sin(yr), math.cos(yr), 0.0))
    # centres le long de l'arc (inclinaison interpolée)
    centers, dirs = [base], []
    for i in range(1, len(ts)):
        tm = (ts[i] + ts[i - 1]) / 2
        p = math.radians(pitch0 + (pitch1 - pitch0) * tm)
        d = fwd_h * math.cos(p) + Vector((0, 0, math.sin(p)))
        dirs.append(d)
        centers.append(centers[-1] + d * (length * (ts[i] - ts[i - 1])))
    coords, faces = [centers[0]], []
    rr = math.radians(roll)
    for i in (1, 2):
        d = (dirs[i - 1] + dirs[i]).normalized()
        side = side0
        up = d.cross(side).normalized() * -1.0
        if up.z < 0:
            up = -up
        side, up = side * math.cos(rr) + up * math.sin(rr), up * math.cos(rr) - side * math.sin(rr)
        w = width / 2 * widths[i - 1]
        c = centers[i]
        coords += [c + side * w - up * fold * w, c + up * thick, c - side * w - up * fold * w, c - up * thick * 0.6]
    coords.append(centers[3])
    # 0 pied, 1..4 première section, 5..8 seconde, 9 pointe
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append([0, 1 + k2, 1 + k])
        faces.append([1 + k, 1 + k2, 5 + k2, 5 + k])
        faces.append([5 + k, 5 + k2, 9])
    return _closed(g, coords, faces, by_normal(top, under, thr=-0.05))


def flat_leaf(g, loc, yaw, length, width, color, thick=0.005, tilt=(0.0, 0.0)):
    """Feuille tombée, couchée au sol (contour arrondi et pointe): épaisseur réelle, pas de face seule."""
    half = [(0.12, 0.38), (0.4, 0.5), (0.7, 0.36), (0.88, 0.14)]
    pts = [(0.0, 0.0)] + [(length * u, width * v) for u, v in half] + [(length, 0.0)]
    pts += [(length * u, -width * v) for u, v in reversed(half)]
    # prism: polygone (x, z) extrudé selon Y; rotation de 90 autour de X pour le coucher à plat
    return g.prism(pts, thick, loc=(loc[0], loc[1], loc[2] + thick / 2), color=color,
                   rot=(90 + tilt[0], tilt[1], yaw))


def ring_lathe(g, rings, color, close_bottom=True):
    """Tour à la main: rings = [[(x, y, z), ...] de même longueur, de bas en haut]; dernier anneau réduit à un
    point si un seul sommet. Sert aux formes ondulées (chapeau de girolle)."""
    segs = len(rings[0])
    coords, faces, idx = [], [], []
    for ring in rings:
        idx.append(list(range(len(coords), len(coords) + len(ring))))
        coords += ring
    for i in range(len(rings) - 1):
        a, b = idx[i], idx[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            if len(b) == 1:
                faces.append([a[k], a[k2], b[0]])
            else:
                faces.append([a[k], a[k2], b[k2], b[k]])
    if close_bottom:
        faces.append(list(reversed(idx[0])))
    return _closed(g, coords, faces, color)


# Objets de cueillette (ferme.glb) ---------------------------------------------------------------

def wild_garlic(A):
    """Ail des ours: touffe de huit larges feuilles luisantes (0,22 à 0,26 m) et deux ombelles blanches en
    étoile à 0,27 et 0,31 m. Le blanc des fleurs fait la lecture au zoom 1 (sur l'herbe, le vert seul se perd)."""
    g = A.geo()
    rnd = random.Random(81)
    for k in range(8):
        yaw = k * 45 + rnd.uniform(-12, 12)
        ln = rnd.uniform(0.2, 0.24)
        p0 = rnd.uniform(48, 62)
        p1 = rnd.uniform(-2, 12)
        off = Vector((math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), 0)) * 0.012
        # feuille elliptique (large jusqu'aux trois quarts, pointe courte), pas une lame
        blade(g, (off.x, off.y, 0.0), yaw, p0, p1, ln, rnd.uniform(0.095, 0.11), "leaf_crop", "leaf_carrot",
              fold=0.22, thick=0.007, widths=(1.0, 0.85), roll=rnd.uniform(-10, 10), ts=(0.0, 0.3, 0.74, 1.0))
    for (x, y, h, lean) in ((0.015, -0.01, 0.27, (6, -4)), (-0.025, 0.02, 0.31, (-5, 7))):
        top = Vector((x + math.sin(math.radians(lean[1])) * h * 0.2, y + math.sin(math.radians(lean[0])) * h * 0.2, h))
        tube(g, bezier((x, y, 0.0), (x, y, h * 0.5), top, 3), 0.0065, 0.005, "leaf_crop_light", segs=5)
        # ombelle: boule de fleurs aplatie, posée sur la tige (la tige y entre de 1 cm)
        g.sphere(0.04, loc=(top.x, top.y, top.z + 0.018), color="flower_white", ico=1, jitter=0.1, seed=int(h * 100),
                 scale=(1.0, 1.0, 0.62))
    return g


def _chanterelle_one(g, loc, s, seed, tilt):
    """Une girolle: pied qui s'évase en entonnoir, chapeau creusé au centre, bord ondulé et un peu enroulé."""
    rnd = random.Random(seed)
    segs = 8
    ph1, ph2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
    # pied qui s'évase sans rupture jusqu'au bord (pas de chapeau posé sur un pied), entonnoir creux
    prof = [(0.015, 0.0, 0.0), (0.024, 0.045, 0.2), (0.046, 0.07, 0.7),
            (0.068, 0.088, 1.0), (0.06, 0.097, 1.0), (0.026, 0.084, 0.4)]
    rings = []
    for (r, z, wave) in prof:
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs + 0.2
            rr = r * (1 + 0.14 * wave * math.sin(2 * a + ph1))
            zz = z + 0.013 * wave * math.sin(3 * a + ph2)
            ring.append(Vector((rr * math.cos(a), rr * math.sin(a), zz)) * s)
        rings.append(ring)
    rings.append([Vector((0, 0, 0.074 * s))])
    M = Matrix.Translation(Vector(loc)) @ lpl._rot(tilt)
    rings = [[M @ v for v in ring] for ring in rings]
    return ring_lathe(g, rings, by_normal("flower_center", "fabric_yellow", thr=0.35))


def chanterelle(A):
    """Girolles: bouquet de quatre (chapeaux de 0,09 à 0,18 m, soit deux fois le réel), sortis de terre au pied
    d'un chêne. Emprise 0,30 x 0,26 m, hauteur 0,15 m."""
    g = A.geo()
    for (x, y, s, seed, tilt) in ((0.02, 0.012, 1.3, 1, (4, -6, 0)), (-0.075, 0.045, 1.0, 2, (-14, -10, 40)),
                                  (0.07, -0.06, 0.95, 3, (12, 10, 80)), (-0.045, -0.07, 0.7, 4, (16, -12, 10))):
        _chanterelle_one(g, (x, y, 0.0), s, seed, tilt)
    return g


def _berry(g, loc, r, color, seed):
    g.sphere(r, loc=loc, color=color, ico=1, jitter=0.12, seed=seed, scale=(1.0, 1.0, 1.12),
             rot=(0, 0, seed * 37))


def blackberry(A):
    """Mûres: un brin de ronce cueilli, sept fruits (cinq noirs, deux encore rouges) de 5 cm (deux fois et demie le
    réel) sur trois folioles. Posé à plat: point le plus bas à 0, sur le dessus du roncier (extra berry_spots de
    bramble) ou au sol. Emprise 0,30 x 0,16 m."""
    g = A.geo()
    # tige du brin, couchée, de l'arrière (+Y Blender) vers les fruits
    tube(g, bezier((0.0, 0.11, 0.012), (0.01, 0.04, 0.02), (0.0, -0.02, 0.03), 4), 0.008, 0.006, "coach_brown")
    for (yaw, ln, w) in ((90, 0.12, 0.07), (35, 0.10, 0.06), (145, 0.10, 0.06)):
        blade(g, (0.0, 0.075, 0.012), yaw, 10, -4, ln, w, "leaf_bush", "ivy", fold=0.25, thick=0.006,
              widths=(1.0, 0.7))
    berries = [((0.0, -0.035, 0.026), "blackberry"), ((0.048, -0.02, 0.026), "blackberry"),
               ((-0.048, -0.025, 0.026), "blackberry"), ((0.025, -0.075, 0.026), "blackberry"),
               ((-0.028, -0.078, 0.026), "comb_red"), ((0.012, -0.045, 0.068), "blackberry"),
               ((-0.022, -0.02, 0.062), "comb_red")]
    for i, (p, c) in enumerate(berries):
        _berry(g, p, 0.027, c, 11 + i)
    return g


def _nut(g, M, seed):
    """Une noisette de 5 cm (deux fois et demie le réel): coque brune, cicatrice pâle à la base, pointe."""
    vs = g.lathe([(0.017, 0.0), (0.026, 0.016), (0.02, 0.038), (0.0, 0.053)],
                 colors=by_normal("leather", "leather", "log_end", thr=0.9), segs=6, phase=seed * 13)
    g.transform(vs, M)
    return vs


def hazelnut(A):
    """Noisettes: petit tas de huit, dont une encore dans son involucre frangé, sur deux feuilles de noisetier
    tombées (jaunes à l'automne, comme le noisetier). Emprise 0,33 x 0,23 m, hauteur 0,13 m (agrandi x 1,3)."""
    g = A.geo()
    flat_leaf(g, (-0.12, -0.03, 0.0), 10, 0.15, 0.11, "leaf_hazel")
    flat_leaf(g, (0.13, 0.05, 0.0), 200, 0.14, 0.10, "leaf_hazel", tilt=(0, 2))
    rnd = random.Random(5)
    r = 0.025
    low = [(-0.045, -0.02), (0.01, -0.045), (0.05, 0.0), (0.0, 0.03), (-0.06, 0.04)]
    centers = []
    for (x, y) in low:
        # couchée sur le flanc: axe horizontal, cicatrice tournée au hasard
        yaw = rnd.uniform(0, 360)
        M = (Matrix.Translation((x, y, r + 0.004)) @ lpl._rot((0, 0, yaw)) @ lpl._rot((0, 90, 0))
             @ Matrix.Translation((0, 0, -0.026)))
        _nut(g, M, len(centers))
        centers.append(Vector((x, y, r + 0.004)))
    for (x, y) in ((-0.015, -0.005), (0.028, 0.012)):
        # posées sur celles du dessous, enfoncées de 8 % (elles se calent, sans flotter)
        z = r + 0.004
        for c in centers:
            d = math.hypot(c.x - x, c.y - y)
            reach = 2 * r * 0.92
            if d < reach:
                z = max(z, c.z + math.sqrt(reach ** 2 - d ** 2))
        yaw = rnd.uniform(0, 360)
        M = (Matrix.Translation((x, y, z)) @ lpl._rot((0, 0, yaw)) @ lpl._rot((20, 90, 0))
             @ Matrix.Translation((0, 0, -0.026)))
        _nut(g, M, len(centers))
        centers.append(Vector((x, y, z)))
    # une noisette encore dans son involucre: trois bractées frangées qui l'enveloppent à moitié, debout
    cx, cy = 0.088, -0.062
    _nut(g, Matrix.Translation((cx, cy, 0.004)), 9)
    for k in range(3):
        yaw = k * 120 + 15
        a = math.radians(yaw)
        blade(g, (cx + 0.008 * math.cos(a), cy + 0.008 * math.sin(a), 0.002), yaw, 72, 52, 0.06, 0.05,
              "leaf_hazel", "leaf_hazel", fold=-0.45, thick=0.004, widths=(1.0, 0.8), roll=0.0)
    # tas agrandi d'un tiers (0,33 m): à 0,26 m, il tenait en 12 pixels bruns sur l'herbe d'automne au zoom 1
    g.transform(list(g.bm.verts), Matrix.Scale(1.3, 4))
    return g


# Décor de la lisière (bourg.glb) ----------------------------------------------------------------

BRAMBLE_SIZE = (1.2, 0.8, 0.7)
# fruits: points du dessus du roncier, calculés par lancer de rayons (voir berry_spots)
BERRY_XY = ((-0.3, -0.05), (0.08, -0.1), (-0.12, -0.18))


def bramble(A):
    """Roncier de 1,2 x 0,8 m et 0,7 m de haut, sans fruits: trois masses de feuillage basses et irrégulières
    (deux verts) et quatre jeunes ronces arquées qui en sortent en biais et retombent vers le bord, feuillues au
    bout: c'est ce qui distingue un roncier d'un buisson. Tout tient dans l'emprise."""
    g = A.geo()
    rnd = random.Random(7)
    # massif un peu en retrait du bord de l'emprise: la place des arcs de ronces
    g.sphere(0.37, loc=(-0.07, 0.0, 0.33), color="leaf_bush", ico=2, jitter=0.08, seed=71, scale=(1.15, 0.85, 0.92),
             rot=(0, 0, 8))
    g.sphere(0.27, loc=(0.22, 0.05, 0.24), color="ivy", ico=2, jitter=0.08, seed=72, scale=(1.05, 1.0, 0.9))
    g.sphere(0.2, loc=(-0.33, -0.1, 0.15), color="ivy", ico=1, jitter=0.1, seed=73, scale=(1.1, 1.0, 0.8))
    # chaque ronce sort du flanc du massif (départ caché dans le feuillage), passe en arc juste au-dessus et
    # replonge au sol au bord de l'emprise; une touffe de feuilles au sommet de l'arc
    # jeunes ronces de l'année, aux quatre coins: elles sortent du massif en biais, s'arquent et retombent vers
    # le bord de l'emprise, la pointe encore en l'air (elle touchera le sol plus tard et s'y enracinera); aucune
    # ne passe sur le dessus, où se posent les mûres
    canes = (((-0.25, -0.05, 0.42), (-0.52, -0.28, 0.74), (-0.58, -0.36, 0.3)),
             ((0.1, -0.12, 0.4), (0.4, -0.38, 0.66), (0.56, -0.37, 0.26)),
             ((0.24, 0.1, 0.34), (0.52, 0.32, 0.6), (0.58, 0.36, 0.22)),
             ((-0.22, 0.1, 0.46), (-0.5, 0.36, 0.76), (-0.57, 0.37, 0.34)))
    for i, (p0, p1, p2) in enumerate(canes):
        pts = bezier(p0, p1, p2, 6)
        tube(g, pts, 0.016, 0.009, "coach_brown")
        # une touffe de feuilles sur l'arc et une au bout (la pointe d'une ronce est feuillue)
        for j, t in enumerate((3, 5)):
            p = pts[t]
            g.sphere(0.075 - 0.01 * j, loc=(p.x, p.y, p.z + 0.02 - 0.03 * j), color="leaf_bush" if (i + j) % 2 else "ivy",
                     ico=1, jitter=0.12, seed=74 + 2 * i + j, scale=(1.2, 1.0, 0.75), rot=(0, 0, rnd.uniform(0, 360)))
    # les touffes et le jitter débordaient de 4 à 5 cm: ramené à l'emprise exacte de 1,2 x 0,8 m
    g.transform(list(g.bm.verts), Matrix.Diagonal((0.934, 0.935, 1.0, 1.0)))
    return g


def berry_spots(ob, sink=0.015):
    """Points de pose des mûres sur le dessus du roncier, en coordonnées glTF (x, y, z) du nœud: lancer de
    rayons vers le bas, puis enfoncés de sink pour que le brin, posé à plat sur un dessus bombé, s'y cale."""
    from mathutils.bvhtree import BVHTree
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    tree = BVHTree.FromBMesh(bm)
    out = []
    for (x, y) in BERRY_XY:
        hit = tree.ray_cast(Vector((x, y, 3.0)), Vector((0, 0, -1)))
        z = hit[0].z - sink
        out.append([round(x, 3), round(z, 3), round(-y, 3)])
    bm.free()
    return out


def bush_hazel(A):
    """Noisetier (coudrier): quatre brins qui partent d'une même souche et s'ouvrent en vase (16 à 22 degrés),
    feuillage de trois boules de 0,55 à 2,0 m, plus large en haut. Les brins se voient au pied: on reconnaît le
    noisetier, et le tas de noisettes posé à côté reste visible. 160 triangles (plafond d'un buisson, 79 sur la
    carte)."""
    g = A.geo()
    # deux brins vers les boules basses, deux vers la grande: chaque bout finit dans le feuillage
    for (deg, lean, ln) in ((-32, 22, 1.0), (149, 22, 1.0), (60, 12, 1.25), (240, 12, 1.25)):
        a = math.radians(deg)
        g.cyl(0.034, ln, loc=(0.06 * math.cos(a), 0.06 * math.sin(a), 0.0), color="bark", segs=5, cap=False,
              base=True, r2=0.022, rot=(-lean * math.sin(a), lean * math.cos(a), 0))
    g.sphere(0.6, loc=(0.0, 0.03, 1.48), color="leaf_hazel", ico=2, jitter=0.08, seed=23, scale=(1.2, 1.1, 0.8),
             rot=(0, 0, 30))
    g.sphere(0.36, loc=(0.38, -0.24, 0.92), color="leaf_bush", ico=1, jitter=0.08, seed=24, scale=(1.0, 1.0, 0.95))
    g.sphere(0.34, loc=(-0.36, 0.22, 0.95), color="leaf_hazel", ico=1, jitter=0.08, seed=25, scale=(1.0, 1.0, 0.95))
    return g


def oak_shoots(A):
    """Rejets de souche du chêne (taillis): quatre brins qui partent du bord de la coupe, s'écartent puis montent,
    0,7 à 1,0 m au-dessus de la souche, chacun avec son feuillage (deux tons du chêne). Origine au centre du
    dessus de la souche: le jeu peut mettre ce nœud seul à l'échelle (0,4 à 1) pour la pousse."""
    g = A.geo()
    rnd = random.Random(31)
    shoots = ((20, 0.95), (115, 0.75), (200, 1.0), (290, 0.7))
    for i, (deg, h) in enumerate(shoots):
        a = math.radians(deg + rnd.uniform(-10, 10))
        c, s = math.cos(a), math.sin(a)
        # le brin naît dans l'écorce, 3 cm sous la coupe, et sort du bord de la souche
        p0 = (0.18 * c, 0.18 * s, -0.03)
        p1 = (0.3 * c, 0.3 * s, h * 0.35)
        p2 = (0.3 * c, 0.3 * s, h)
        pts = bezier(p0, p1, p2, 4)
        tube(g, pts, 0.022, 0.012, "bark", segs=5)
        # feuillé sur toute sa moitié haute (un rejet est une verge feuillue, pas une sucette): deux touffes
        # allongées qui se chevauchent le long du brin
        top = pts[-1]
        g.sphere(0.17, loc=(top.x, top.y, top.z - 0.02), color="leaf_oak" if i % 2 else "leaf_oak_light",
                 ico=1, jitter=0.1, seed=40 + i, scale=(1.0, 1.0, 1.35), rot=(0, 0, rnd.uniform(0, 360)))
        mid = top * 0.55 + pts[1] * 0.45
        g.sphere(0.14, loc=(mid.x + 0.04 * c, mid.y + 0.04 * s, mid.z), color="leaf_oak", ico=1, jitter=0.1,
                 seed=50 + i, scale=(1.0, 1.0, 1.3))
    return g


def fir_sapling(A):
    """Jeune sapin replanté par Basile: 1,2 m, trois étages de cônes à 7 pans (bords arrondis, pointe molle, comme
    les grands), tige de 7 cm visible au pied, butte de terre fraîchement retournée de 0,85 m. À l'échelle 1 le jour du rejet;
    le jeu peut l'agrandir (jusqu'à 1,3) jour après jour."""
    g = A.geo()
    g.lathe([(0.42, 0.0), (0.34, 0.03), (0.14, 0.055), (0.0, 0.06)], colors="soil_tilled_light", segs=9,
            close_bottom=False, phase=11)
    g.cyl(0.035, 0.45, color="bark_dark", segs=5, base=True, r2=0.03, cap=False)
    tiers = [(0.26, 0.4, 0.5), (0.58, 0.31, 0.42), (0.86, 0.2, 0.38)]
    for i, (z, r, h) in enumerate(tiers):
        g.lathe([(r * 0.88, 0.0), (r, 0.05), (r * 0.12, h * 0.9), (0.0, h)], loc=(0, 0, z),
                colors=by_normal("leaf_fir_light", "leaf_fir", "leaf_fir", thr=0.3), segs=7, rot=(0, 0, i * 25 + 7))
    return g
