"""Forêt et petits objets du village agrandi de la 0.13 (lot L2, seconde moitié; docs/jeux/jeu-1/v0-13-carte.md,
sections 4.1, 5, 6, 11.3 et 17).

Lancer: duo-python foret_013.py
Produit: assets/modeles/foret013.glb, stats/foret013.json, blend/foret013.blend (planches: planche_foret_013.py)

Contenu, un nœud par type de la carte (donnees/cartes-0-13/halte.json), nom identique au type:
- essences: tree_beech, tree_chestnut, tree_lime, tree_walnut, tree_pear, tree_plum, tree_cherry, tree_old_oak,
  snag_tree (le bouleau existe déjà dans bourg.glb: tree_birch_small et tree_birch_large);
- cimetière: grave (et ses variantes grave_a à grave_d), cemetery_wall, cemetery_wall_corner, cemetery_cross,
  cemetery_tap;
- bourg et campagne: crossing_sign, oratory, vine_row, anvil, hand_pump, water_trough, manure_heap,
  fallen_trunk, postcard_rack, cafe_table, skittles_alley (et skittle_pin, skittle_ball);
- sous-bois: fern, fern_small, bilberry_bush, holly_bush, raspberry_bush, mushroom_cluster, deadwood_branch,
  black_trumpet (trompettes de la mort, objet de cueillette).

Repères côté Blender: Z en haut, face avant vers -Y (devient +Z en glTF, le sud à la rotation 0 de la carte),
origine au centre de l'emprise, au sol. Emprise [largeur le long de X, profondeur le long de Y].

Fruits et fleurs des arbres: un enfant `<arbre>_fruit` (ou `_flowers`) par arbre, avec l'extra `seasons` (saisons
du jeu où il se voit). Il fait partie du nœud: le rendu le dessine tant qu'il ne trie pas les saisons (lot L3).

Budgets (section 11.3, relevés de moitié au plus à la demande du client): la forêt compte 154 arbres et le
validateur plafonne 4 500 triangles par morceau de 12 m; le morceau le plus chargé (8 chênes et 3 hêtres) laisse
545 triangles par hêtre. Les arbres restent donc entre 450 et 600 triangles, le Vieux Chêne, unique, à 1 100.
"""
import math
import os
import random
import sys

import bpy  # noqa: I001 (bpy avant bmesh)
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402
from cueillette import ring_lathe, small_leaf, tube  # noqa: E402


# Outils -------------------------------------------------------------------------------------------

def trunk(g, rings, segs=8, colors=("bark",), twist=0.0, phase=0.0, close_top=False, by_ring=False):
    """Tronc tourné à la main: rings = [(rayon, z[, dx, dy])] de bas en haut, ouvert en bas (posé au sol).
    twist: degrés par mètre (écorce en spirale du châtaignier); colors: alternées par pan (ou par anneau)."""
    vrings = []
    for ring in rings:
        r, z = ring[0], ring[1]
        dx, dy = (ring[2], ring[3]) if len(ring) > 2 else (0.0, 0.0)
        vs = []
        for k in range(segs):
            a = 2 * math.pi * k / segs + math.radians(phase + twist * z)
            vs.append(g.bm.verts.new((dx + r * math.cos(a), dy + r * math.sin(a), z)))
        vrings.append(vs)
    fc = {}
    for i in range(len(vrings) - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            f = g.bm.faces.new((vrings[i][k], vrings[i][k2], vrings[i + 1][k2], vrings[i + 1][k]))
            fc[f] = colors[(i if by_ring else k) % len(colors)]
    if close_top:
        f = g.bm.faces.new(vrings[-1])
        fc[f] = colors[0]
    verts = [v for r in vrings for v in r]
    return g._finish(verts, lambda f: fc.get(f, colors[0]))


def roots(g, n, rb, length, rr, color="bark_dark", phase=0.0, z=0.03, drop=100):
    """Contreforts du pied: cônes à 5 pans qui plongent dans le sol, comme ceux des chênes du bourg."""
    for k in range(n):
        a = k * 360.0 / n + phase
        ar = math.radians(a)
        g.cyl(rr, length, loc=(rb * math.cos(ar), rb * math.sin(ar), z), color=color, segs=5, r2=rr * 0.3,
              cap=False, rot=(0, drop, a))


def limb(g, p0, p1, r0, r1, color="bark", p_mid=None, segs=5):
    """Branche maîtresse (droite, ou coudée par p_mid); son bout finit dans le feuillage."""
    pts = [p0, p_mid, p1] if p_mid is not None else [p0, p1]
    return tube(g, pts, r0, r1, color, segs=segs)


def mass(g, x, y, z, r, color, seed, sc=(1.0, 1.0, 1.0), ico=2, jit=0.07):
    """Masse de feuillage: icosphère facettée (80 faces) déformée, tournée au hasard (bible 8.6). color: une case,
    ou (dessus, côtés) pour éclaircir le haut de la masse, là où la lumière accroche."""
    if isinstance(color, tuple):
        color = by_normal(color[0], color[1], thr=0.55)
    return g.sphere(r, loc=(x, y, z), color=color, ico=ico, jitter=jit, seed=seed, scale=sc,
                    rot=(0, 0, (seed * 47) % 360))


def surface_spots(g, center, n, seed, elev=(-15.0, 35.0), reach=12.0, az0=0.0):
    """Points de la surface du feuillage (lancer de rayons de l'extérieur vers le centre du houppier), répartis
    tout autour: les quatre orientations de la caméra voient des fruits. Renvoie [(point, normale)]."""
    bvh = BVHTree.FromBMesh(g.bm)
    rnd = random.Random(seed)
    c = Vector(center)
    out = []
    for i in range(n):
        az = math.radians(az0 + i * 360.0 / n + rnd.uniform(-14, 14))
        el = math.radians(rnd.uniform(*elev))
        d = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
        hit = bvh.ray_cast(c + d * reach, -d)
        if hit[0] is not None:
            out.append((hit[0], hit[1]))
    return out


def octa(g, loc, r, color, sc=(1.0, 1.0, 1.0), rot=0.0):
    """Petit fruit ou baie: octaèdre (8 triangles), lisible en taches de couleur à la distance de jeu."""
    return g.sphere(r, loc=loc, color=color, segs=4, rings=2, scale=sc, rot=(0, 0, rot))


def hollow_box(g, size, wall, depth, loc=(0, 0, 0), colors=("stone_light", "stone", "stone_dark"), bevel=0.0,
               rot=(0, 0, 0)):
    """Bac de pierre d'un seul tenant (auge, abreuvoir, évier): boîte posée au sol, dessus creusé (marge wall,
    profondeur depth), arêtes du haut chanfreinées. colors: (dessus, côtés, intérieur)."""
    sx, sy, sz = size
    bm = g.bm
    before = set(bm.verts)
    # volume fermé fait à la main: anneaux extérieur (bas, haut) et intérieur (haut, fond)
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    ix, iy = sx / 2 - wall, sy / 2 - wall
    ob = [bm.verts.new((cx * sx / 2, cy * sy / 2, 0.0)) for cx, cy in corners]
    ot = [bm.verts.new((cx * sx / 2, cy * sy / 2, sz)) for cx, cy in corners]
    it = [bm.verts.new((cx * ix, cy * iy, sz)) for cx, cy in corners]
    ib = [bm.verts.new((cx * ix, cy * iy, sz - depth)) for cx, cy in corners]
    faces = [bm.faces.new(list(reversed(ob))), bm.faces.new(ib)]
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append(bm.faces.new((ob[k], ob[k2], ot[k2], ot[k])))     # flanc extérieur
        faces.append(bm.faces.new((ot[k], ot[k2], it[k2], it[k])))     # bord
        faces.append(bm.faces.new((it[k], it[k2], ib[k2], ib[k])))     # paroi intérieure
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    if bevel > 0:
        bm.edges.index_update()
        rim = set(ot) | set(it)
        edges = sorted({e for v in rim for e in v.link_edges if e.verts[0] in rim and e.verts[1] in rim
                        and (abs(e.verts[0].co.x - e.verts[1].co.x) < 1e-6 or
                             abs(e.verts[0].co.y - e.verts[1].co.y) < 1e-6)}, key=lambda e: e.index)
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
    verts = [v for v in bm.verts if v not in before]
    bm.normal_update()

    def col(f):
        cz = f.calc_center_median().z
        if f.normal.z > 0.6 and cz > sz - 0.05:
            return colors[0]
        if _inside(f, sx, sy, wall):
            return colors[2]
        return colors[1]
    verts = g._finish(verts, col)
    g.transform(verts, Matrix.Translation(Vector(loc)) @ lpl._rot(rot))
    return verts


def _inside(f, sx, sy, wall):
    c = f.calc_center_median()
    return abs(c.x) < sx / 2 - wall * 0.5 and abs(c.y) < sy / 2 - wall * 0.5


def open_tube(g, pts, r0, r1, color, segs=4):
    """Tige ouverte aux deux bouts (le pied dans le feuillage, le bout dans une feuille): pas de bouchons."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    coords, faces = [], []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        a = t.cross(ref).normalized()
        b = t.cross(a).normalized()
        r = r0 + (r1 - r0) * i / (n - 1)
        for k in range(segs):
            ang = 2 * math.pi * k / segs
            coords.append(p + (a * math.cos(ang) + b * math.sin(ang)) * r)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append([i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k])
    vs = [g.bm.verts.new(c) for c in coords]
    fs = [g.bm.faces.new([vs[i] for i in f]) for f in faces]
    bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    return g.recolor(vs, color)


def frond(g, base, yaw, length, width, pitch0, pitch1, top, under, n=4, lean=0.0):
    """Fronde de fougère: rachis arqué et folioles en dents de scie de part et d'autre (silhouette pennée),
    deux faces (dessus, dessous décalé de 4 mm): 4 n triangles."""
    base = Vector(base)
    yr = math.radians(yaw)
    fwd = Vector((math.cos(yr), math.sin(yr), 0.0))
    side = Vector((-math.sin(yr), math.cos(yr), 0.0))
    spine = [base]
    for i in range(n):
        t = (i + 0.5) / n
        p = math.radians(pitch0 + (pitch1 - pitch0) * t)
        d = fwd * math.cos(p) + Vector((0, 0, math.sin(p)))
        spine.append(spine[-1] + d * (length / n))
    for sgn, col, off in ((1, top, 0.0), (-1, under, -0.004)):
        for i in range(n):
            a, b = spine[i], spine[i + 1]
            m = (a + b) / 2
            w = width / 2 * (1.0 - 0.75 * (i / n)) * (1.0 if i else 0.75)
            droop = Vector((0, 0, -w * 0.35 - lean))
            left = m + side * w + droop + fwd * (length / n) * 0.25
            right = m - side * w + droop + fwd * (length / n) * 0.25
            o = Vector((0, 0, off))
            tris = ((a + o, b + o, left + o), (a + o, right + o, b + o))
            for tri in tris:
                vs = [g.bm.verts.new(p) for p in (tri if sgn > 0 else tuple(reversed(tri)))]
                f = g.bm.faces.new(vs)
                f.normal_update()
                if sgn > 0 and f.normal.z < 0 or sgn < 0 and f.normal.z > 0:
                    f.normal_flip()
                g.recolor(vs, col)


def keep_up(g, verts):
    """Ramène au-dessus du sol les sommets d'une pièce qui s'enfonceraient de plus de 2 cm."""
    for v in verts:
        if v.is_valid and v.co.z < -0.02:
            v.co.z = -0.02


# Essences -----------------------------------------------------------------------------------------

def tree_beech(A):
    """Hêtre du bois de la Cure (9 m, houppier de 4,8 m dès 2,4 m): fût droit et lisse gris argent (`rock`), sans
    branche basse; houppier en trois étages de masses aplaties (les rameaux du hêtre s'étalent à l'horizontale),
    dôme haut. Vert tendre (`leaf_hazel`, `leaf_oak_light`), cuivré à l'automne. 504 triangles."""
    g = A.geo()
    trunk(g, [(0.34, -0.05), (0.25, 0.3), (0.21, 1.2), (0.17, 3.0), (0.14, 4.2)], segs=8,
          colors=("rock", "rock_light"), phase=8)
    roots(g, 3, 0.3, 0.55, 0.11, color="rock", phase=20)
    s = 0
    # grand dôme d'un seul tenant, jupe de trois étages plats tout autour du bas (rameaux à l'horizontale)
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 5.95, 1.95, ("leaf_oak_light", "leaf_hazel"), (1.12, 1.1, 1.1)),
                                (-0.85, 0.6, 7.0, 1.15, ("leaf_oak_light", "leaf_hazel"), (1.05, 1.0, 0.92)),
                                (1.08, 0.62, 3.75, 1.15, ("leaf_oak_light", "leaf_hazel"), (1.18, 1.12, 0.66)),
                                (-1.08, 0.62, 3.9, 1.12, ("leaf_hazel", "leaf_hazel"), (1.18, 1.12, 0.66)),
                                (0.0, -1.25, 3.65, 1.15, ("leaf_oak_light", "leaf_hazel"), (1.12, 1.18, 0.66))):
        s += 1
        mass(g, x, y, z, r, c, 10 + s, sc)
    return g


def tree_chestnut(A):
    """Châtaignier (8 m, houppier de 5 m dès 2,4 m): fût court et trapu à l'écorce en spirale (pans alternés
    tournés de 40 degrés par mètre), une grosse fourche, houppier large et bosselé de masses sombres (`leaf_bush`,
    `leaf_oak`). Bogues vertes à l'automne (enfant tree_chestnut_fruit). 600 triangles avec les bogues."""
    g = A.geo()
    trunk(g, [(0.42, -0.05), (0.33, 0.3), (0.29, 1.0), (0.26, 1.8), (0.2, 2.7)], segs=8,
          colors=("bark", "bark_dark"), twist=40.0)
    roots(g, 3, 0.36, 0.6, 0.12, phase=50)
    limb(g, (0.05, 0.05, 2.2), (1.25, 0.35, 3.9), 0.15, 0.08, p_mid=(0.6, 0.2, 2.75))
    s = 0
    # large et bas, bosselé: masse centrale écrasée, trois bosses basses qui débordent, une bosse haute décentrée
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 4.75, 1.85, ("leaf_oak", "leaf_bush"), (1.25, 1.2, 0.82)),
                                (1.7, 0.4, 4.05, 1.1, ("leaf_oak", "leaf_bush"), (1.1, 1.0, 0.8)),
                                (-1.6, -0.5, 4.2, 1.15, ("leaf_bush", "leaf_bush"), (1.05, 1.1, 0.8)),
                                (-0.3, 1.6, 4.0, 1.05, ("leaf_oak", "leaf_bush"), (1.1, 1.0, 0.82)),
                                (0.95, -0.75, 5.5, 1.05, ("leaf_oak", "leaf_bush"), (1.12, 1.05, 0.8))):
        s += 1
        mass(g, x, y, z, r, c, 20 + s, sc)
    spots = surface_spots(g, (0, 0, 4.6), 10, 3, elev=(-25, 30))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        q = p + n * 0.04
        octa(f, q, 0.12, "leaf_crop_light", rot=i * 33)
    return g, f


def tree_lime(A):
    """Tilleul de la place (8 m, houppier de 3,6 m dès 2,6 m): fût droit, houppier en oeuf pointu, dense, plus
    haut que large; vert doux (`leaf_birch`, `leaf_oak_light`), jaune à l'automne. Fleurs jaune pâle en été
    (enfant tree_lime_flowers). 590 triangles avec les fleurs."""
    g = A.geo()
    trunk(g, [(0.3, -0.05), (0.22, 0.3), (0.19, 1.4), (0.16, 3.2)], segs=8, colors=("bark", "wood_old_dark"),
          phase=4)
    roots(g, 3, 0.27, 0.5, 0.1, phase=70)
    s = 0
    # oeuf dressé et pointu (en coeur), deux épaules basses, une pointe molle
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 5.0, 1.5, ("leaf_birch_light", "leaf_birch"), (1.06, 1.06, 1.5)),
                                (0.9, 0.4, 4.0, 0.95, ("leaf_birch", "leaf_oak_light"), (1.0, 1.0, 1.1)),
                                (-0.8, -0.5, 4.25, 0.92, ("leaf_birch_light", "leaf_birch"), (1.0, 1.0, 1.1)),
                                (0.25, -0.85, 5.7, 0.8, ("leaf_birch_light", "leaf_birch"), (1.0, 1.0, 1.15)),
                                (0.0, 0.05, 7.45, 0.58, ("leaf_birch_light", "leaf_birch"), (1.0, 1.0, 1.4))):
        s += 1
        mass(g, x, y, z, r, c, 30 + s, sc)
    spots = surface_spots(g, (0, 0, 5.0), 14, 4, elev=(-20, 40))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        octa(f, p + n * 0.03 - Vector((0, 0, 0.04)), 0.12, "flower_yellow", sc=(1.0, 1.0, 0.6), rot=i * 41)
    return g, f


def tree_walnut(A):
    """Noyer du verger (8 m, houppier de 5 m dès 2,2 m): écorce gris clair (`stone_dark`), trois charpentières
    qui s'écartent en coupe et se voient entre des masses espacées; dôme large et aéré, vert jaune
    (`leaf_birch`, `leaf_oak`), jaune à l'automne. Noix dans leur brou vert (enfant tree_walnut_fruit).
    530 triangles avec les noix."""
    g = A.geo()
    trunk(g, [(0.36, -0.05), (0.27, 0.3), (0.24, 1.2), (0.2, 2.2)], segs=8, colors=("stone_dark", "wood_old"),
          phase=12)
    roots(g, 2, 0.32, 0.55, 0.11, color="wood_old", phase=30)
    for (q, m) in (((1.45, 0.35, 4.3), (0.75, 0.15, 2.85)), ((-1.35, 0.5, 4.5), (-0.7, 0.3, 2.9)),
                   ((0.1, -1.3, 4.2), (0.05, -0.65, 2.8))):
        limb(g, (0.0, 0.0, 2.0), q, 0.13, 0.07, color="stone_dark", p_mid=m)
    s = 0
    for (x, y, z, r, c, sc) in ((1.45, 0.35, 4.75, 1.2, ("leaf_birch_light", "leaf_birch"), (1.12, 1.05, 0.78)),
                                (-1.35, 0.55, 4.95, 1.15, ("leaf_oak_light", "leaf_oak"), (1.1, 1.08, 0.78)),
                                (0.1, -1.3, 4.65, 1.1, ("leaf_oak_light", "leaf_oak"), (1.1, 1.05, 0.78)),
                                (0.05, 0.25, 6.25, 1.42, ("leaf_birch_light", "leaf_birch"), (1.12, 1.12, 0.8))):
        s += 1
        mass(g, x, y, z, r, c, 40 + s, sc)
    spots = surface_spots(g, (0, 0, 5.2), 8, 5, elev=(-25, 25))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        octa(f, p + n * 0.03, 0.08, "leaf_crop_light", rot=i * 29)
    return g, f


def tree_pear(A):
    """Poirier du verger (5 m, houppier de 3 m dès 1,6 m): port dressé en pyramide (plus haut que large), deux
    charpentières qui montent, feuillage vert lustré sombre (`leaf_bush`, `leaf_oak_light`). Poires jaunes
    pendantes (enfant tree_pear_fruit). 545 triangles avec les poires."""
    g = A.geo()
    trunk(g, [(0.24, -0.05), (0.17, 0.25), (0.14, 1.9)], segs=8, colors=("bark_dark", "bark"), phase=6)
    roots(g, 2, 0.2, 0.4, 0.08, phase=60)
    limb(g, (0.0, 0.0, 1.5), (0.45, 0.2, 3.2), 0.08, 0.045)
    limb(g, (0.0, 0.0, 1.5), (-0.4, -0.2, 3.1), 0.08, 0.045)
    s = 0
    # fuseau dressé, plus haut que large
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 3.25, 0.95, ("leaf_oak_light", "leaf_bush"), (1.05, 1.05, 1.55)),
                                (0.58, 0.25, 2.55, 0.68, ("leaf_oak_light", "leaf_bush"), (1.0, 1.0, 1.05)),
                                (-0.52, -0.3, 2.65, 0.66, ("leaf_bush", "leaf_bush"), (1.0, 1.0, 1.05)),
                                (0.22, -0.18, 4.3, 0.6, ("leaf_oak_light", "leaf_bush"), (1.0, 1.0, 1.35))):
        s += 1
        mass(g, x, y, z, r, c, 50 + s, sc)
    spots = surface_spots(g, (0, 0, 3.0), 7, 6, elev=(-30, 10))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        top = p + n * 0.03
        vs = f.lathe([(0.0, -0.22), (0.085, -0.16), (0.05, -0.045), (0.0, 0.0)], colors="flower_yellow", segs=5,
                     phase=i * 20)
        f.transform(vs, Matrix.Translation(top))
    return g, f


def tree_plum(A):
    """Prunier du verger (4,5 m, houppier de 3 m dès 1,5 m): petit tronc sombre penché, houppier arrondi et
    irrégulier, un peu retombant (`leaf_oak`, `leaf_bush`). Prunes violettes (enfant tree_plum_fruit).
    500 triangles avec les prunes."""
    g = A.geo()
    trunk(g, [(0.2, -0.05, 0.0, 0.0), (0.14, 0.25, 0.02, 0.0), (0.12, 1.75, 0.18, 0.04)], segs=8,
          colors=("bark_dark",))
    roots(g, 2, 0.17, 0.35, 0.07, phase=100)
    limb(g, (0.15, 0.03, 1.55), (-0.7, 0.3, 2.4), 0.07, 0.04, color="bark_dark")
    limb(g, (0.15, 0.03, 1.55), (0.85, -0.3, 2.45), 0.07, 0.04, color="bark_dark")
    s = 0
    # boule large et trapue, un peu retombante sur les côtés
    for (x, y, z, r, c, sc) in ((0.15, 0.0, 2.75, 1.2, ("leaf_oak_light", "leaf_oak"), (1.2, 1.12, 0.8)),
                                (-0.9, 0.35, 2.35, 0.72, ("leaf_oak", "leaf_bush"), (1.1, 1.0, 0.8)),
                                (1.0, -0.4, 2.4, 0.7, ("leaf_oak", "leaf_bush"), (1.1, 1.0, 0.8)),
                                (-0.45, -0.35, 3.3, 0.8, ("leaf_oak_light", "leaf_oak"), (1.1, 1.0, 0.8))):
        s += 1
        mass(g, x, y, z, r, c, 60 + s, sc)
    spots = surface_spots(g, (0.1, 0, 2.6), 10, 7, elev=(-30, 20))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        octa(f, p + n * 0.03 - Vector((0, 0, 0.03)), 0.1, "flower_violet", sc=(1.0, 1.0, 1.25), rot=i * 37)
    return g, f


def tree_cherry(A):
    """Cerisier du verger (6 m, houppier de 3,4 m dès 1,8 m): écorce brun rouge lustrée cerclée de bandes
    sombres (lenticelles), houppier ovoïde en étages (`leaf_oak_light`, `leaf_oak`). Cerises rouges en été
    (enfant tree_cherry_fruit). 550 triangles avec les cerises."""
    g = A.geo()
    trunk(g, [(0.25, -0.05), (0.18, 0.25), (0.16, 0.7), (0.15, 1.2), (0.14, 2.1)], segs=8,
          colors=("coach_brown", "bark_dark", "coach_brown", "coach_brown"), by_ring=True, phase=10)
    roots(g, 2, 0.21, 0.4, 0.08, color="bark_dark", phase=10)
    limb(g, (0.0, 0.0, 1.8), (0.55, 0.3, 3.6), 0.08, 0.05, color="coach_brown")
    limb(g, (0.0, 0.0, 1.8), (-0.5, -0.3, 3.5), 0.08, 0.05, color="coach_brown")
    s = 0
    # ovale régulier sur deux épaules basses
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 3.65, 1.35, ("leaf_oak_light", "leaf_oak"), (1.1, 1.08, 1.1)),
                                (0.85, 0.4, 3.0, 0.85, ("leaf_oak_light", "leaf_oak"), (1.1, 1.0, 0.8)),
                                (-0.8, -0.45, 3.1, 0.85, ("leaf_oak", "leaf_oak"), (1.1, 1.0, 0.8)),
                                (-0.5, 0.55, 4.55, 0.85, ("leaf_oak_light", "leaf_oak"), (1.05, 1.0, 0.95))):
        s += 1
        mass(g, x, y, z, r, c, 70 + s, sc)
    spots = surface_spots(g, (0, 0, 3.6), 8, 8, elev=(-25, 30))
    f = A.geo()
    for i, (p, n) in enumerate(spots):
        q = p - n * 0.01
        a = math.radians(i * 47)
        for k in (0, 1):
            octa(f, q + Vector((0.05 * (k - 0.5) * math.cos(a), 0.05 * (k - 0.5) * math.sin(a), -0.03)), 0.065,
                 "flower_red", rot=i * 20)
    return g, f


def tree_old_oak(A):
    """Le Vieux Chêne de la clairière (12 m, houppier de 7 m dès 2,8 m), repère du bois: fût énorme et noueux
    (10 pans légèrement tordus), cinq contreforts, quatre charpentières qui partent presque à l'horizontale et se
    voient sous le houppier, dix masses en dôme large et bosselé, une loge sombre sur le flanc sud-est (l'écureuil).
    1 100 triangles (un seul sur la carte)."""
    g = A.geo()
    trunk(g, [(0.72, -0.05), (0.56, 0.3), (0.5, 0.9), (0.47, 1.8), (0.42, 2.7), (0.32, 3.6)], segs=10,
          colors=("bark", "bark_dark"), twist=9.0)
    roots(g, 5, 0.6, 0.95, 0.2, phase=15, drop=102)
    for (q, m, r0) in (((2.6, 0.6, 4.6), (1.4, 0.3, 3.0), 0.24), ((-2.5, 0.3, 4.9), (-1.3, 0.2, 3.1), 0.23),
                       ((0.4, -2.5, 4.5), (0.25, -1.3, 3.0), 0.22), ((-0.3, 2.4, 4.8), (-0.2, 1.2, 3.2), 0.22)):
        limb(g, (0.0, 0.0, 2.4), q, r0, 0.1, p_mid=m, segs=6)
    # loge de l'écureuil (sud-est, vers la caméra par défaut): une plaque sombre à fleur d'écorce
    a = math.radians(-50)
    g.box((0.04, 0.2, 0.28), loc=(0.43 * math.cos(a), 0.43 * math.sin(a), 2.1), color="shadow", rot=(0, 0, -50))
    s = 0
    for (x, y, z, r, c, sc) in ((0.0, 0.0, 6.6, 2.0, ("leaf_oak_light", "leaf_oak"), (1.15, 1.12, 0.78)),
                                (2.55, 0.55, 5.1, 1.42, ("leaf_oak_light", "leaf_oak_light"), (1.1, 1.05, 0.78)),
                                (-2.45, 0.3, 5.35, 1.45, ("leaf_oak_light", "leaf_oak"), (1.1, 1.08, 0.78)),
                                (0.4, -2.45, 5.0, 1.38, ("leaf_oak_light", "leaf_oak_light"), (1.08, 1.1, 0.78)),
                                (-0.3, 2.4, 5.25, 1.4, ("leaf_oak_light", "leaf_oak"), (1.1, 1.05, 0.78)),
                                (1.8, -1.7, 6.3, 1.25, ("leaf_oak_light", "leaf_oak"), (1.05, 1.05, 0.8)),
                                (-1.7, -1.6, 6.5, 1.22, ("leaf_oak_light", "leaf_oak_light"), (1.05, 1.05, 0.8)),
                                (1.7, 1.75, 6.6, 1.2, ("leaf_oak_light", "leaf_oak_light"), (1.05, 1.05, 0.8)),
                                (-1.75, 1.6, 6.85, 1.18, ("leaf_oak_light", "leaf_oak"), (1.05, 1.05, 0.8)),
                                (0.2, -0.1, 8.9, 1.55, ("leaf_oak_light", "leaf_oak_light"), (1.05, 1.05, 0.85))):
        s += 1
        mass(g, x, y, z, r, c, 80 + s, sc)
    return g


def snag_tree(A):
    """Arbre mort debout au bord de la coupe (7 m): fût sans écorce par plaques (gris `wood_old` et brun
    `wood_old_dark`), cassé net en haut (couronne déchiquetée), trois moignons de branches, la loge ronde du pic
    à 4,3 m sur la face sud et deux amadouviers en consoles. 160 triangles."""
    g = A.geo()
    rnd = random.Random(5)
    segs = 7
    rings = [(0.3, -0.05), (0.23, 0.3), (0.2, 2.0), (0.16, 4.4), (0.12, 6.4)]
    vs = trunk(g, rings, segs=segs, colors=("wood_old", "wood_old", "wood_old_dark"), phase=5)
    # couronne cassée: les sommets du dernier anneau à des hauteurs inégales (échardes), dessus fermé plus bas
    top = sorted([v for v in vs if abs(v.co.z - 6.4) < 1e-4], key=lambda v: math.atan2(v.co.y, v.co.x))
    for i, v in enumerate(top):
        v.co.z = 6.4 + (0.55 if i % 3 == 0 else 0.15 + rnd.uniform(0, 0.2))
    c = g.bm.verts.new((0.0, 0.0, 6.35))
    for i in range(segs):
        f = g.bm.faces.new((top[i], top[(i + 1) % segs], c))
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    g.recolor(top + [c], lambda f: "log_end" if f.normal.z > 0.3 else "wood_old")
    roots(g, 3, 0.26, 0.45, 0.1, color="wood_old_dark", phase=40)
    for (h, a, ln) in ((2.6, 30, 0.7), (3.9, 160, 0.55), (5.3, 280, 0.6)):
        ar = math.radians(a)
        r = 0.2 - 0.012 * h
        g.cyl(0.065, ln, loc=((r + ln * 0.4) * math.cos(ar), (r + ln * 0.4) * math.sin(ar), h + ln * 0.25),
              color="wood_old", segs=5, r2=0.025, rot=(0, 62, a))
    # loge du pic: disque sombre au ras de la face sud (-Y), 4,3 m
    g.cyl(0.075, 0.02, loc=(0.0, -0.152, 4.3), color="shadow", segs=6, rot=(90, 0, 0))
    for (h, a, w) in ((1.4, -60, 0.26), (1.75, -35, 0.18)):
        ar = math.radians(a)
        r = 0.15
        pts = [(-w / 2, 0.0), (w / 2, 0.0), (w * 0.35, 0.07), (0.0, 0.09), (-w * 0.35, 0.07)]
        g.prism(pts, 0.05, loc=((r + 0.045) * math.cos(ar), (r + 0.045) * math.sin(ar), h), color="paper_dark",
                rot=(90, 0, a + 90))
    return g


# Cimetière ----------------------------------------------------------------------------------------

WALL_T = 0.42      # épaisseur du mur du cimetière (corps)
WALL_H = 1.2       # hauteur au faîte du chaperon
PLINTH = (0.48, 0.22)


def _not_ground(a, b):
    return not (abs(a.z) < 1e-4 and abs(b.z) < 1e-4)


def _wall_run(g, x0, x1, stones=True):
    """Tronçon de mur de x0 à x1 le long de X, centré sur Y: soubassement, corps de moellons, chaperon en dos
    d'âne. Bouts coupés net (le tronçon voisin s'y raccorde bord à bord)."""
    ln, cx = x1 - x0, (x0 + x1) / 2
    g.box((ln, PLINTH[0], PLINTH[1]), loc=(cx, 0, 0), color="stone_dark", base=True)
    g.box((ln, WALL_T, 1.05 - PLINTH[1]), loc=(cx, 0, PLINTH[1]), color="stone", base=True)
    half = 0.25
    pts = [(-half, 0.0), (half, 0.0), (half, 0.05), (0.15, 0.12), (0.0, 0.15), (-0.15, 0.12), (-half, 0.05)]
    g.prism(pts, ln, loc=(cx, 0, 1.045), color=by_normal("stone_light", "stone_light", thr=0.3), rot=(0, 0, 90))
    if stones:
        # deux moellons saillants par face, à des places différentes devant et derrière (le motif se répète au
        # mètre, mais pas en face l'un de l'autre)
        # (même teinte que le mur: seul le relief les montre, sinon le motif se lit comme des soupiraux au mètre)
        for (u, z, w, h, side) in ((-0.2, 0.5, 0.34, 0.15, -1), (0.25, 0.8, 0.26, 0.13, 1)):
            g.box((w, 0.02, h), loc=(cx + u * ln, side * (WALL_T / 2 + 0.008), z), color="stone")


def cemetery_wall(A):
    """Tronçon d'un mètre du mur du cimetière (1,2 m au faîte du chaperon, corps de 0,42 m sur un soubassement de
    0,48 m), le long de X, centré dans sa case: deux tronçons voisins se touchent bord à bord, sans jour ni
    recouvrement. 72 triangles."""
    g = A.geo()
    _wall_run(g, -0.5, 0.5)
    return g


def cemetery_wall_corner(A):
    """Angle du mur: pile carrée de 0,6 m à chapeau en pointe de diamant, et deux demi-tronçons qui partent vers
    +X (l'est à la rotation 0) et vers l'avant (+Z glTF, le sud à la rotation 0) jusqu'au bord de la case, où le
    tronçon voisin se raccorde. Rotation 0: angle nord-ouest; 1: sud-ouest; 2: sud-est; 3: nord-est."""
    g = A.geo()
    _wall_run(g, 0.0, 0.5, stones=False)
    before = set(g.bm.verts)
    _wall_run(g, 0.0, 0.5, stones=False)
    vs = [v for v in g.bm.verts if v not in before]
    g.transform(vs, Matrix.Rotation(math.radians(-90), 4, "Z"))
    g.box((0.6, 0.6, 1.28), color="stone", base=True, bevel=0.03, bseg=1,
          bedges=lambda a, b: abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4)
    g.box((0.68, 0.68, 0.07), loc=(0, 0, 1.28), color="stone_light", base=True)
    g.cyl(0.47, 0.17, loc=(0, 0, 1.35), color="stone_light", segs=4, r2=0.02, base=True, rot=(0, 0, 45))
    return g


def grave_a(A):
    """Tombe à dalle chanfreinée et stèle cintrée claire (`stone_light`) à l'ouest, un pot de fleurs au pied
    de la stèle. Emprise 2 x 1 m le long de X, pieds à l'est (+X)."""
    g = A.geo()
    g.box((1.72, 0.74, 0.16), loc=(0.1, 0, 0), color="stone", base=True)
    pts = [(-0.34, 0.0), (0.34, 0.0), (0.34, 0.5), (0.25, 0.62), (0.0, 0.69), (-0.25, 0.62), (-0.34, 0.5)]
    g.prism(pts, 0.1, loc=(-0.8, 0, 0.0), color="stone_light", rot=(0, 0, 90))
    g.cyl(0.07, 0.12, loc=(-0.6, 0.18, 0.16), color="tile", segs=6, r2=0.085, base=True)
    for (dx, dy, c) in ((0.0, 0.0, "flower_red"), (0.04, -0.04, "flower_white"), (-0.04, 0.03, "flower_red")):
        octa(g, (-0.6 + dx, 0.18 + dy, 0.33), 0.05, c, rot=dx * 900)
    return g


def grave_b(A):
    """Tombe en pleine terre à bordure de pierre, tertre de gravier et croix de fer forgé à l'ouest."""
    g = A.geo()
    g.box((1.78, 0.78, 0.12), loc=(0.08, 0, 0), color="stone", base=True)
    g.box((1.62, 0.62, 0.13), loc=(0.08, 0, 0), color="path_dark", base=True)
    g.box((0.16, 0.16, 0.14), loc=(-0.72, 0, 0.13), color="stone_dark", base=True)
    g.box((0.045, 0.045, 0.82), loc=(-0.72, 0, 0.27), color="iron", base=True)
    g.box((0.045, 0.4, 0.045), loc=(-0.72, 0, 0.88), color="iron")
    return g


def grave_c(A):
    """Tombe de granit gris: dalle épaisse chanfreinée, stèle droite surmontée d'une croix de pierre, plaque."""
    g = A.geo()
    g.box((1.8, 0.8, 0.22), loc=(0.07, 0, 0), color="rock", base=True, bevel=0.03, bseg=1, bedges=_not_ground)
    g.box((0.13, 0.7, 0.58), loc=(-0.78, 0, 0.0), color="rock_light", base=True)
    g.box((0.08, 0.08, 0.34), loc=(-0.78, 0, 0.58), color="rock_light", base=True)
    g.box((0.08, 0.26, 0.07), loc=(-0.78, 0, 0.82), color="rock_light")
    g.box((0.3, 0.22, 0.02), loc=(0.1, 0, 0.22), color="paper_dark", base=True, rot=(0, -8, 0))
    return g


def grave_d(A):
    """Vieille tombe: stèle cintrée penchée de 7 degrés vers les pieds, dalle mangée de mousse, violettes."""
    g = A.geo()
    g.box((1.7, 0.72, 0.12), loc=(0.12, 0, 0), color="stone_dark", base=True)
    g.box((0.9, 0.5, 0.02), loc=(0.35, 0.05, 0.12), color="moss", base=True, rot=(0, 0, 4))
    pts = [(-0.3, -0.04), (0.3, -0.04), (0.3, 0.46), (0.21, 0.58), (0.0, 0.64), (-0.21, 0.58), (-0.3, 0.46)]
    g.prism(pts, 0.11, loc=(-0.8, 0, 0.0), color="stone", rot=(7, 0, 90))
    for (x, y) in ((-0.62, -0.22), (-0.55, 0.2), (0.9, -0.2)):
        octa(g, (x, y, 0.16), 0.045, "flower_violet", rot=x * 300)
    return g


def cemetery_cross(A):
    """Croix du cimetière (3 m): deux marches de 20 cm, socle mouluré, fût et croix latine de pierre claire,
    droite (aucune inclinaison), bras de 0,9 m à 2,42 m. Face vers l'avant (la grille)."""
    g = A.geo()
    g.box((0.96, 0.96, 0.2), color="stone", base=True, bevel=0.025, bseg=1, bedges=_not_ground)
    g.box((0.72, 0.72, 0.2), loc=(0, 0, 0.2), color="stone", base=True, bevel=0.025, bseg=1, bedges=_not_ground)
    g.box((0.42, 0.42, 0.66), loc=(0, 0, 0.4), color="stone_light", base=True, bevel=0.02, bseg=1,
          bedges=lambda a, b: abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4)
    g.box((0.52, 0.52, 0.08), loc=(0, 0, 1.06), color="stone_light", base=True, bevel=0.02, bseg=1,
          bedges=_not_ground)
    g.box((0.16, 0.16, 1.86), loc=(0, 0, 1.14), color="stone_light", base=True, bevel=0.02, bseg=1,
          bedges=_not_ground)
    g.box((0.9, 0.15, 0.15), loc=(0, 0, 2.42), color="stone_light", bevel=0.02, bseg=1)
    return g


def watering_can(g, loc, yaw):
    """Arrosoir de zinc (0,32 m): corps, anse en arc, bec incliné avec sa pomme."""
    M = Matrix.Translation(Vector(loc)) @ Matrix.Rotation(math.radians(yaw), 4, "Z")
    before = set(g.bm.verts)
    g.cyl(0.1, 0.24, color="tin", segs=8, base=True)
    tube(g, [(-0.07, 0.0, 0.22), (0.0, 0.0, 0.34), (0.07, 0.0, 0.22)], 0.012, 0.012, "tin", segs=4)
    tube(g, [(0.08, 0.0, 0.06), (0.24, 0.0, 0.26)], 0.018, 0.012, "tin", segs=4)
    g.cyl(0.03, 0.03, loc=(0.25, 0.0, 0.27), color="tin", segs=6, rot=(0, 50, 0))
    g.transform([v for v in g.bm.verts if v not in before], M)


def cemetery_tap(A):
    """Fontaine du cimetière (1,2 m): borne de fonte verte au fond de la case, robinet à bec courbe au-dessus de
    l'évier de pierre creusé (le bec tombe au milieu du bac), deux arrosoirs de zinc posés à côté."""
    g = A.geo()
    hollow_box(g, (0.62, 0.42, 0.42), 0.06, 0.24, loc=(0.0, -0.08, 0.0), bevel=0.02)
    g.box((0.504, 0.304, 0.005), loc=(0.0, -0.08, 0.32), color="water", base=True)
    g.lathe([(0.1, 0.0), (0.085, 0.12), (0.065, 0.2), (0.06, 1.0), (0.085, 1.04), (0.08, 1.1), (0.0, 1.18)],
            loc=(0.0, 0.24, 0.0), colors="loco_green", segs=8, close_bottom=False)
    tube(g, [(0.0, 0.2, 0.74), (0.0, 0.02, 0.76), (0.0, -0.08, 0.62)], 0.022, 0.016, "brass", segs=5)
    g.cyl(0.025, 0.07, loc=(0.075, 0.24, 0.86), color="brass", segs=6, rot=(0, 90, 0))
    watering_can(g, (0.3, 0.26, 0.0), 200)
    watering_can(g, (-0.33, 0.24, 0.0), -20)
    return g


# Bourg et campagne ---------------------------------------------------------------------------------

def crossing_sign(A):
    """Croix de Saint-André d'un passage à niveau sans barrière (modèle français: deux planches blanches bordées
    de rouge, 1,2 m, croisées sous 75 degrés, centre à 2,15 m) sur un poteau gris. Face peinte vers l'avant (vers
    qui arrive sur la route); dos gris. La carte la pose sur le bas-côté, à droite de qui arrive."""
    g = A.geo()
    g.cyl(0.045, 2.3, color="iron_light", segs=6, base=True, r2=0.04)
    g.cyl(0.05, 0.03, loc=(0, 0, 2.3), color="iron_light", segs=6, base=True)
    g.box((0.07, 0.07, 0.24), loc=(0, -0.055, 2.15), color="iron")
    for i, a in enumerate((37.5, -37.5)):
        # la seconde planche s'appuie sur la face peinte de la première (boulonnées au croisement)
        y = -0.1 - 0.036 * i
        g.box((1.2, 0.025, 0.17), loc=(0, y, 2.15), color=by_normal("rail_steel", "rail_steel", thr=0.9),
              rot=(0, a, 0))
        g.box((1.2, 0.006, 0.17), loc=(0, y - 0.0155, 2.15), color="comb_red", rot=(0, a, 0))
        g.box((1.1, 0.006, 0.09), loc=(0, y - 0.0215, 2.15), color="white_paint", rot=(0, a, 0))
    return g


def oratory(A):
    """Oratoire de la source (2,4 m), pierre claire: marche, pilier chanfreiné, niche cintrée ouverte vers l'avant
    où se tient la statue (manteau bleu, voile blanc), toit de lauzes à deux pans et croix de fer; un pot de fleurs
    sur la marche."""
    g = A.geo()
    g.box((0.82, 0.82, 0.14), color="stone", base=True, bevel=0.025, bseg=1, bedges=_not_ground)
    g.box((0.46, 0.46, 1.0), loc=(0, 0, 0.14), color="stone_light", base=True, bevel=0.03, bseg=1,
          bedges=lambda a, b: abs(a.x - b.x) < 1e-4 and abs(a.y - b.y) < 1e-4)
    z0 = 1.14
    g.box((0.64, 0.56, 0.08), loc=(0, 0, z0), color="stone_light", base=True)
    zn = z0 + 0.08
    hj = 0.47
    # jambages jusqu'au linteau, fond de niche derrière le linteau (aucune face commune qui se recouvre)
    g.box((0.13, 0.56, hj), loc=(-0.255, 0, zn), color="stone_light", base=True)
    g.box((0.13, 0.56, hj), loc=(0.255, 0, zn), color="stone_light", base=True)
    g.box((0.38, 0.1, hj + 0.2), loc=(0, 0.23, zn), color="stone", base=True)
    # linteau cintré (polygone concave extrudé): l'arc de la niche se lit de face
    pts = [(-0.32, 0.0), (-0.19, 0.0), (-0.165, 0.07), (-0.095, 0.115), (0.0, 0.13), (0.095, 0.115),
           (0.165, 0.07), (0.19, 0.0), (0.32, 0.0), (0.32, 0.2), (-0.32, 0.2)]
    g.prism(pts, 0.46, loc=(0, -0.05, zn + hj), color="stone_light")
    zt = zn + hj + 0.2
    g.prism([(-0.44, 0.0), (0.44, 0.0), (0.0, 0.26)], 0.72, loc=(0, 0, zt), color=by_normal("lauze", "lauze_dark",
            thr=0.3))
    g.box((0.08, 0.74, 0.04), loc=(0, 0, zt + 0.235), color="lauze_dark", base=True)
    g.box((0.035, 0.035, 0.24), loc=(0, 0, zt + 0.25), color="black", base=True)
    g.box((0.15, 0.035, 0.035), loc=(0, 0, zt + 0.42), color="black")
    # statue (Vierge): robe et manteau en tour à 6 pans, tête claire, posée sur le sol de la niche
    g.lathe([(0.075, 0.0), (0.07, 0.12), (0.05, 0.3), (0.035, 0.34)], loc=(0, -0.17, zn),
            colors=["paint_blue", "paint_blue", "white_paint"], segs=6)
    g.sphere(0.04, loc=(0, -0.17, zn + 0.37), color="ceramic", ico=1)
    g.cyl(0.055, 0.12, loc=(0.27, -0.31, 0.14), color="tile", segs=6, r2=0.07, base=True)
    for (dx, dy, c) in ((0.0, 0.0, "flower_white"), (0.035, -0.03, "flower_yellow"), (-0.03, 0.03, "flower_white")):
        octa(g, (0.27 + dx, -0.31 + dy, 0.3), 0.04, c)
    return g


def vine_row(A):
    """Tronçon de 3 m d'un rang de vigne sur échalas (un piquet par cep, à la manière des coteaux): trois ceps au
    pas d'un mètre, à 0,5 m des bouts, donc le pas reste d'un mètre d'un tronçon à l'autre, sans fil qui pende au
    bout du rang. Cep tors, échalas de 1,45 m un peu penchés, feuillage en deux masses allongées le long du rang
    (`vine_leaf`, or et rouge à l'automne); grappes noires (enfant vine_row_grapes, automne)."""
    g = A.geo()
    f = A.geo()
    rnd = random.Random(12)
    for i, x in enumerate((-1.0, 0.0, 1.0)):
        lean = rnd.uniform(-4, 4)
        g.cyl(0.022, 1.45, loc=(x - 0.06, 0.02, 0.0), color="wood_old", segs=5, base=True, cap=False,
              rot=(lean, rnd.uniform(-3, 3), 0))
        open_tube(g, [(x + 0.04, -0.01, -0.03), (x + 0.07, 0.03, 0.25), (x + 0.0, 0.0, 0.5)], 0.045, 0.035,
                  "bark_dark", segs=4)
        # feuillage en haie basse le long du rang: chaque cep touche presque ses voisins (même pas d'un tronçon à
        # l'autre), l'échalas dépasse au-dessus
        mass(g, x, 0.0, 0.72, 0.3, "vine_leaf", 100 + i, sc=(1.62, 0.8, 0.9), ico=1, jit=0.1)
        mass(g, x + 0.2 * (1 if i % 2 else -1), 0.03, 0.98, 0.23, "vine_leaf_dark", 110 + i, sc=(1.5, 0.8, 0.85),
             ico=1, jit=0.1)
        s = 1 if i % 2 else -1
        octa(f, (x + 0.12 * s, -0.24 * s, 0.6), 0.07, "blackberry", sc=(1.0, 1.0, 1.4), rot=i * 30)
    return g, f


def anvil(A):
    """Enclume sur son billot (0,8 m: hauteur du poing): billot de chêne cerclé, enclume à bigorne (vers +X) et
    talon, table claire polie; un marteau posé en travers."""
    g = A.geo()
    g.cyl(0.25, 0.5, color="bark", segs=8, base=True, r2=0.23)
    g.cyl(0.235, 0.012, loc=(0, 0, 0.5), color="log_end", segs=8, base=True)
    g.cyl(0.255, 0.04, loc=(0, 0, 0.12), color="iron", segs=8, base=True)
    z = 0.512
    g.box((0.3, 0.2, 0.06), loc=(0, 0, z), color="steel_forged", base=True, taper=(0.75, 0.7))
    g.box((0.14, 0.11, 0.1), loc=(0, 0, z + 0.06), color="steel_forged", base=True)
    g.box((0.36, 0.13, 0.08), loc=(-0.02, 0, z + 0.16), color=by_normal("iron_light", "steel_forged", thr=0.8),
          base=True)
    g.cyl(0.06, 0.2, loc=(0.25, 0, z + 0.205), color="steel_forged", segs=6, r2=0.008, rot=(0, 90, 0))
    g.box((0.08, 0.08, 0.05), loc=(-0.23, 0, z + 0.19), color="steel_forged", taper=(1.0, 0.7))
    # marteau couché sur la table: la tête repose sur la table, le manche sort en biais, loin de la bigorne
    ha = math.radians(25)
    g.box((0.05, 0.11, 0.05), loc=(-0.12, 0.0, z + 0.24), color="iron", base=True, rot=(0, 0, 25))
    g.cyl(0.014, 0.3, loc=(-0.12 + 0.16 * math.cos(ha), 0.16 * math.sin(ha), z + 0.255), color="wood", segs=5,
          rot=(0, 90, 25))
    return g


def hand_pump(A):
    """Pompe à bras des jardins (1,4 m): colonne de fonte verte au fond de la case, levier sur le côté (+X) en
    haut, bec qui sort vers l'avant et tombe au-dessus du milieu de l'auge de pierre (ouverture de 0,6 x 0,3 m,
    bec 0,3 m au-dessus du bord), le tout sur une dalle."""
    g = A.geo()
    g.box((0.9, 0.9, 0.05), color="stone_dark", base=True, bevel=0.02, bseg=1, bedges=_not_ground)
    hollow_box(g, (0.72, 0.42, 0.4), 0.06, 0.26, loc=(0.0, -0.2, 0.05), bevel=0.02,
               colors=("stone_light", "stone", "stone_dark"))
    g.box((0.604, 0.304, 0.005), loc=(0.0, -0.2, 0.34), color="water", base=True)
    py = 0.24
    g.lathe([(0.12, 0.0), (0.1, 0.06), (0.075, 0.2), (0.07, 1.06), (0.095, 1.1), (0.09, 1.16), (0.04, 1.24),
             (0.0, 1.27)], loc=(0.0, py, 0.05), colors="loco_green", segs=8, close_bottom=False)
    # bec: sort de la colonne vers l'avant et plonge au-dessus du milieu de l'auge
    tube(g, [(0.0, py - 0.05, 0.86), (0.0, -0.1, 0.88), (0.0, -0.2, 0.74)], 0.035, 0.028, "loco_green", segs=6)
    # levier: axe sur la tête, bras courbé vers +X qui finit par une poignée
    g.box((0.06, 0.05, 0.08), loc=(0.07, py, 1.2), color="iron", base=True)
    tube(g, [(0.08, py, 1.25), (0.3, py, 1.32), (0.44, py - 0.02, 1.26)], 0.018, 0.016, "iron", segs=5)
    g.cyl(0.028, 0.1, loc=(0.46, py - 0.02, 1.22), color="wood", segs=6, base=True)
    return g


def water_trough(A):
    """Abreuvoir de pierre (1,8 x 0,7 m, 0,62 m): bac d'un seul bloc creusé, bords chanfreinés, eau à 10 cm sous
    le bord, deux cales de pierre."""
    g = A.geo()
    g.box((0.2, 0.75, 0.06), loc=(-0.7, 0, 0), color="stone_dark", base=True)
    g.box((0.2, 0.75, 0.06), loc=(0.7, 0, 0), color="stone_dark", base=True)
    hollow_box(g, (1.8, 0.68, 0.56), 0.1, 0.4, loc=(0, 0, 0.06), bevel=0.03,
               colors=("stone_light", "stone", "stone_dark"))
    g.box((1.604, 0.484, 0.005), loc=(0, 0, 0.5), color="water", base=True)
    return g


def manure_heap(A):
    """Tas de fumier de la cour (2 x 2 m, 0,9 m): deux buttes molles brun sombre (dessus plus clair),
    brins de paille posés en surface, fourche plantée dans le flanc."""
    g = A.geo()
    rnd = random.Random(8)
    mass(g, -0.1, 0.05, 0.0, 0.8, ("soil_tilled", "bark_dark"), 81, sc=(1.05, 1.0, 1.1), jit=0.1)
    mass(g, 0.45, -0.3, 0.0, 0.5, ("soil_tilled", "bark_dark"), 82, sc=(1.0, 1.0, 1.2), jit=0.1)
    for i, (p, n) in enumerate(surface_spots(g, (0.0, 0.0, 0.3), 11, 8, elev=(15, 70), reach=5.0)):
        g.box((0.24, 0.03, 0.02), loc=p - n * 0.005, color="straw" if i % 3 else "straw_dark",
              rot=(rnd.uniform(-15, 15), rnd.uniform(-20, 20), rnd.uniform(0, 180)))
    # fourche plantée dans le flanc, dents dans le tas, manche vers le haut
    M = Matrix.Translation((0.25, 0.35, 0.55)) @ lpl._rot((-18, 12, 0))
    before = set(g.bm.verts)
    g.cyl(0.018, 0.85, loc=(0, 0, 0.4), color="wood", segs=5, base=True)
    g.box((0.2, 0.025, 0.025), loc=(0, 0, 0.38), color="iron")
    for dx in (-0.08, 0.0, 0.08):
        g.box((0.012, 0.012, 0.3), loc=(dx, 0, 0.1), color="iron", base=True)
    g.transform([v for v in g.bm.verts if v not in before], M)
    return g


def fallen_trunk(A):
    """Chablis à scier (3 x 1 m, 0,8 m): tronc couché le long de X (0,5 m de diamètre), galette de racines dressée
    à l'ouest avec sa terre, bout est coupé net (cerne clair), deux moignons de branches, mousse sur le dessus."""
    g = A.geo()
    r = 0.25
    g.cyl(r, 2.45, loc=(0.18, 0, r - 0.02), color=by_normal("bark", "bark", "bark_dark", thr=0.85), segs=8,
          rot=(0, 90, 0), r2=r * 0.86, cap=False)
    # plaques de mousse sur le dessus, pas une bande continue
    for (x, w, sd) in ((-0.65, 0.2, 1), (0.25, 0.16, 2), (0.85, 0.13, 3)):
        rx = r * (1 - 0.14 * (x + 1.045) / 2.45)
        mass(g, x, 0.03, r - 0.02 + rx * 0.93, w, "moss", 90 + sd, sc=(1.5, 1.1, 0.35), ico=1, jit=0.1)
    g.cyl(r * 0.86, 0.02, loc=(1.41, 0, r - 0.02), color="log_end", segs=8, rot=(0, 90, 0))
    g.cyl(r * 0.4, 0.024, loc=(1.411, 0, r - 0.02), color="log_ring", segs=8, rot=(0, 90, 0))
    # galette de racines: disque de terre dressé, plus large que le tronc, enfoncé de 3 cm
    g.cyl(0.4, 0.2, loc=(-1.15, 0, 0.37), color=by_normal("soil", "soil_tilled", thr=0.5), segs=9, rot=(0, 90, 0),
          scale=(1.0, 1.15, 1.0))
    for (a, ln) in ((40, 0.45), (150, 0.4), (260, 0.38)):
        ar = math.radians(a)
        g.cyl(0.05, ln, loc=(-1.27, 0.32 * math.cos(ar), 0.37 + 0.3 * math.sin(ar)), color="bark_dark", segs=5,
              r2=0.012, cap=False, rot=(a - 90, 0, 0))
    for (x, a, ln) in ((0.2, 50, 0.4), (0.8, -60, 0.32)):
        ar = math.radians(a)
        g.cyl(0.055, ln, loc=(x, 0.2 * math.sin(ar), r + 0.15 * math.cos(ar)), color="bark", segs=5, r2=0.03,
              rot=(-a, 0, 0))
    return g


def postcard_rack(A):
    """Tourniquet de cartes postales d'Odette (1,7 m): pied rond lesté, mât, trois étages de pochettes sur quatre
    faces (vues anciennes sépia et quelques cartes en couleur), chapeau rouge."""
    g = A.geo()
    g.cyl(0.24, 0.05, color="iron", segs=10, base=True)
    g.cyl(0.02, 1.62, loc=(0, 0, 0.05), color="iron", segs=6, base=True)
    g.box((0.32, 0.32, 0.9), loc=(0, 0, 0.62), color="iron_light", base=True)
    cols = ["paper", "sepia", "fabric_blue", "paper", "paint_yellow", "sepia", "flower_pink", "paper",
            "paint_green", "sepia", "paper", "fabric_blue"]
    n = 0
    for face in range(4):
        rz = face * 90
        for row in range(3):
            for col in (-1, 1):
                z = 0.7 + row * 0.28
                c = cols[n % len(cols)]
                n += 1
                M = Matrix.Rotation(math.radians(rz), 4, "Z")
                p = M @ Vector((col * 0.075, -0.17, z))
                g.box((0.13, 0.012, 0.19), loc=p, color=c, base=True, rot=(10, 0, rz))
    g.cyl(0.2, 0.06, loc=(0, 0, 1.6), color="paint_red", segs=8, base=True)
    g.cyl(0.2, 0.06, loc=(0, 0, 1.66), color="paint_red", segs=8, base=True, r2=0.02)
    return g


def bistro_chair(g, x, face):
    """Chaise de bistrot en bois courbé (assise à 0,46 m), tournée vers face (degrés)."""
    M = Matrix.Translation((x, 0, 0)) @ Matrix.Rotation(math.radians(face), 4, "Z")
    # pieds écartés en bas: le haut de chaque pied penche vers le centre de l'assise
    before = set(g.bm.verts)
    g.cyl(0.18, 0.03, loc=(0, 0, 0.44), color="wood_dark", segs=8, base=True)
    for k in range(4):
        a = math.radians(45 + k * 90)
        g.cyl(0.014, 0.45, loc=(0.13 * math.cos(a), 0.13 * math.sin(a), 0.0), color="wood_dark", segs=5,
              base=True, cap=False, rot=(6 * math.sin(a), -6 * math.cos(a), 0))
    # dossier en arc de bois courbé: deux montants qui se rejoignent en plein cintre
    pts = [(-0.15, 0.12, 0.46), (-0.16, 0.13, 0.66)]
    for k in range(1, 6):
        a = math.pi * k / 6
        pts.append((-0.165, 0.13 * math.cos(a), 0.66 + 0.16 * math.sin(a)))
    pts += [(-0.16, -0.13, 0.66), (-0.15, -0.12, 0.46)]
    tube(g, pts, 0.016, 0.016, "wood_dark", segs=5)
    g.transform([v for v in g.bm.verts if v not in before], M)


def cafe_table(A):
    """Table de la terrasse du café: guéridon à plateau de marbre clair cerclé de laiton (0,74 m), pied de fonte
    et deux chaises de bistrot face à face (côtés est et ouest), qui ne dépassent pas de la case de plus de 3 cm."""
    g = A.geo()
    g.cyl(0.2, 0.03, color="iron", segs=8, base=True, r2=0.16)
    g.cyl(0.025, 0.68, loc=(0, 0, 0.03), color="iron", segs=6, base=True)
    g.cyl(0.3, 0.035, loc=(0, 0, 0.705), color=by_normal("ceramic", "brass", thr=0.5), segs=12, base=True)
    bistro_chair(g, 0.33, 180)
    bistro_chair(g, -0.33, 0)
    return g


SKITTLE_LANE = (7.6, 0.66)
SKITTLE_SPOTS = [[3.25 + dx, 0.045, dz] for dx in (-0.22, 0.0, 0.22) for dz in (-0.22, 0.0, 0.22)]


def skittles_alley(A):
    """Allée de quilles de la placette (8 x 1 m, 6 cm: on marche dessus): trois planches grisées de 7,6 m entre
    deux liteaux, carré de quilles clair au bout est (+X), raie de lancer blanche au bout ouest. Les neuf quilles
    se posent sur pin_spots (repère glTF), la boule sur ball_spot."""
    g = A.geo()
    ln, w = SKITTLE_LANE
    for i, y in enumerate((-0.22, 0.0, 0.22)):
        g.box((ln, 0.22, 0.04), loc=(0, y, 0.0), color="wood_old" if i != 1 else "wood_old_dark", base=True)
    for y in (-0.355, 0.355):
        g.box((ln, 0.045, 0.06), loc=(0, y, 0.0), color="wood_dark", base=True, bevel=0.012, bseg=1,
              bedges=_not_ground)
    g.box((0.68, 0.56, 0.005), loc=(3.25, 0, 0.04), color="wood_new", base=True)
    g.box((0.05, 0.56, 0.005), loc=(-3.4, 0, 0.04), color="white_paint", base=True)
    return g


def skittle_pin(A):
    """Quille de bois tourné (0,3 m), bague rouge."""
    g = A.geo()
    g.lathe([(0.03, 0.0), (0.045, 0.06), (0.042, 0.13), (0.022, 0.2), (0.03, 0.25), (0.022, 0.29), (0.0, 0.3)],
            colors=["wood_new", "wood_new", "wood_new", "paint_red", "wood_new", "wood_new"], segs=8)
    return g


def skittle_ball(A):
    """Boule de bois (0,16 m)."""
    g = A.geo()
    g.sphere(0.08, loc=(0, 0, 0.08), color="wood_dark", ico=2)
    return g


# Sous-bois -------------------------------------------------------------------------------------------

def fern(A, small=False):
    """Fougère en touffe (0,6 m; petite: 0,4 m): six frondes pennées larges qui montent du centre et retombent en
    arc (dessus `leaf_oak`, rousse à l'automne comme la fougère aigle; dessous `leaf_bush`). 120 triangles
    (petite: cinq frondes, 80)."""
    g = A.geo()
    rnd = random.Random(3 if small else 2)
    n = 5 if small else 6
    k = 0.68 if small else 1.0
    seg = 4 if small else 5
    for i in range(n):
        yaw = i * 360.0 / n + rnd.uniform(-15, 15)
        frond(g, (0.02 * math.cos(math.radians(yaw)), 0.02 * math.sin(math.radians(yaw)), 0.0), yaw,
              0.78 * k * rnd.uniform(0.88, 1.08), 0.38 * k, rnd.uniform(55, 66), rnd.uniform(-38, -22), "leaf_oak",
              "leaf_bush", n=seg)
    return g


def bilberry_bush(A):
    """Myrtilliers sous les sapins (0,4 m, 1 x 0,8 m): coussin bas et bosselé (une icosphère écrasée, dessus plus
    clair) au bord duquel quatre rameaux feuillus s'étalent; vert frais, rouge orangé à l'automne. Sans baies: les myrtilles
    se cueillent sur le point voisin. 112 triangles."""
    g = A.geo()
    mass(g, 0.0, 0.0, 0.06, 0.42, ("leaf_oak", "leaf_bush"), 7, sc=(1.18, 0.95, 0.6), jit=0.14)
    rnd = random.Random(4)
    for i in range(4):
        a = i * 90 + 30 + rnd.uniform(-15, 15)
        ar = math.radians(a)
        small_leaf(g, (0.36 * math.cos(ar), 0.29 * math.sin(ar), 0.1), a, rnd.uniform(-5, 10), 0.17, 0.1,
                   "leaf_oak", "leaf_bush")
    return g


def holly_bush(A):
    """Houx (1,8 m): un seul buisson dense en pain de sucre (masse étirée et rétrécie vers le haut, très déformée:
    feuilles piquantes), vert sombre lustré toujours vert (`ivy` dessus, `leaf_fir` sur les flancs), huit bouquets
    de baies rouges toute l'année. 144 triangles."""
    g = A.geo()
    vs = mass(g, 0.0, 0.0, 0.9, 0.62, ("ivy", "leaf_fir"), 3, sc=(1.0, 0.95, 1.45), jit=0.15)
    for v in vs:
        if v.co.z > 0.9:
            t = (v.co.z - 0.9) / 0.9
            v.co.x *= 1 - 0.55 * t
            v.co.y *= 1 - 0.55 * t
    spots = surface_spots(g, (0, 0, 0.9), 8, 9, elev=(-10, 40))
    for i, (p, n) in enumerate(spots):
        octa(g, p + n * 0.012, 0.055, "flower_red", rot=i * 30)
    return g


def raspberry_bush(A):
    """Framboisier (1,3 m): touffe feuillue au pied d'où montent trois cannes rougeâtres arquées, chacune feuillée
    à mi-hauteur et au bout (aucune canne nue en l'air), sans fruits: les framboises se cueillent sur le point
    voisin. 176 triangles."""
    g = A.geo()
    mass(g, 0.0, 0.0, 0.14, 0.34, ("leaf_hazel", "leaf_bush"), 6, sc=(1.3, 1.15, 0.78), jit=0.12)
    for i, (a, h, out) in enumerate(((30, 1.25, 0.36), (150, 1.1, 0.32), (265, 1.3, 0.38))):
        ar = math.radians(a)
        c, s = math.cos(ar), math.sin(ar)
        pts = [(0.05 * c, 0.05 * s, 0.15), (0.12 * c, 0.12 * s, h * 0.62), (out * c, out * s, h)]
        open_tube(g, pts, 0.017, 0.011, "coach_brown", segs=4)
        small_leaf(g, Vector(pts[1]), a + 55, -10, 0.22, 0.15, "leaf_hazel", "leaf_bush")
        small_leaf(g, Vector(pts[2]), a, -30, 0.22, 0.15, "leaf_hazel", "leaf_bush")
    return g


def mushroom_cluster(A):
    """Deux amanites tue-mouches (décor, qu'on ne cueille pas: le rouge à points blancs se reconnaît de loin):
    pied blanc, chapeau rouge en dôme bordé de blanc. 0,25 m."""
    g = A.geo()
    for (x, y, h, r, tilt) in ((0.0, 0.0, 0.2, 0.09, (4, -5, 0)), (0.13, 0.07, 0.13, 0.065, (-10, 8, 0))):
        M = Matrix.Translation((x, y, 0)) @ lpl._rot(tilt)
        vs = g.cyl(0.018, h, color="flower_white", segs=5, base=True, cap=False, r2=0.014)
        g.transform(vs, M)
        vs = g.lathe([(r, h - 0.01), (r * 0.78, h + r * 0.5), (0.0, h + r * 0.72)],
                     colors=["flower_red", "flower_red"], segs=5)
        g.recolor(vs, lambda f: "flower_white" if f.normal.z < -0.5 else "flower_red")
        g.transform(vs, M)
    return g


def deadwood_branch(A):
    """Branches mortes tombées le long des sentiers (1,1 m): branche grise fourchue couchée au sol, un rameau."""
    g = A.geo()
    tube(g, [(-0.55, 0.0, 0.045), (0.0, 0.03, 0.04), (0.55, -0.02, 0.03)], 0.045, 0.022, "wood_old", segs=5)
    open_tube(g, [(0.05, 0.03, 0.04), (0.42, 0.28, 0.025)], 0.024, 0.012, "wood_old", segs=4)
    open_tube(g, [(-0.2, 0.01, 0.045), (-0.38, -0.2, 0.02)], 0.018, 0.01, "wood_old_dark", segs=4)
    return g


def black_trumpet(A):
    """Trompettes de la mort (objet de cueillette, mousse de la source): trois cornets gris noir évasés en
    entonnoir creux, bord ondulé roulé, dessous gris cendré; grossis deux fois comme les girolles. 0,22 m."""
    g = A.geo()
    for (x, y, s, seed, tilt) in ((0.0, 0.0, 1.25, 1, (4, -6, 0)), (-0.07, 0.05, 1.0, 2, (-14, -8, 30)),
                                  (0.065, 0.055, 0.85, 3, (12, 10, 70))):
        rnd = random.Random(seed)
        ph1, ph2 = rnd.uniform(0, 6.28), rnd.uniform(0, 6.28)
        prof = [(0.012, 0.0, 0.0), (0.018, 0.05, 0.2), (0.04, 0.095, 0.7), (0.06, 0.12, 1.0), (0.052, 0.128, 1.0),
                (0.02, 0.1, 0.4)]
        rings = []
        for (r, z, wave) in prof:
            ring = []
            for k in range(7):
                a = 2 * math.pi * k / 7
                rr = r * (1 + 0.16 * wave * math.sin(2 * a + ph1))
                zz = z + 0.012 * wave * math.sin(3 * a + ph2)
                ring.append(Vector((rr * math.cos(a), rr * math.sin(a), zz)) * s)
            rings.append(ring)
        rings.append([Vector((0, 0, 0.06 * s))])
        M = Matrix.Translation((x, y, 0.0)) @ lpl._rot(tilt)
        rings = [[M @ v for v in ring] for ring in rings]
        ring_lathe(g, rings, by_normal("tar", "rock_dark", thr=0.35))
    return g


# Construction ----------------------------------------------------------------------------------------

def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    lpl.AUTO_ROUND = False

    def tree(name, built, child=None, seasons=None, note=None):
        g, f = built if isinstance(built, tuple) else (built, None)
        # houppier mesuré sur le maillage: [largeur, dessous, dessus] en mètres (pour l'occultation de la carte)
        leaf = [v.co for v in g.bm.verts if math.hypot(v.co.x, v.co.y) > 0.75 and v.co.z > 1.2]
        width = max(max(c.x for c in leaf) - min(c.x for c in leaf), max(c.y for c in leaf) - min(c.y for c in leaf))
        crown = [round(width, 1), round(min(c.z for c in leaf), 1), round(max(v.co.z for v in g.bm.verts), 1)]
        ex = {"footprint": [1, 1], "crown": crown}
        if note:
            ex["note"] = note
        root = A.add(name, g, ex)
        if f is not None:
            A.add(child, f, {"seasons": seasons}, parent=root)
        return root

    tree("tree_beech", tree_beech(A))
    tree("tree_chestnut", tree_chestnut(A), "tree_chestnut_fruit", ["autumn"])
    tree("tree_lime", tree_lime(A), "tree_lime_flowers", ["summer"])
    tree("tree_walnut", tree_walnut(A), "tree_walnut_fruit", ["autumn"])
    tree("tree_pear", tree_pear(A), "tree_pear_fruit", ["summer", "autumn"])
    tree("tree_plum", tree_plum(A), "tree_plum_fruit", ["summer"])
    tree("tree_cherry", tree_cherry(A), "tree_cherry_fruit", ["summer"])
    tree("tree_old_oak", tree_old_oak(A))
    A.add("snag_tree", snag_tree(A), {"footprint": [1, 1], "nest_hole": [0.0, 4.3, 0.17],
                                      "note": "loge du pic: nest_hole (repère glTF), face sud"})

    for k, fn in (("a", grave_a), ("b", grave_b), ("c", grave_c), ("d", grave_d)):
        A.add("grave_" + k, fn(A), {"footprint": [2, 1], "note": "stèle à l'ouest (-X), pieds à l'est"})
    A.alias("grave", bpy.data.objects["grave_a"], {"footprint": [2, 1], "variants": ["grave_a", "grave_b",
                                                                                     "grave_c", "grave_d"]})
    A.add("cemetery_wall", cemetery_wall(A), {"footprint": [1, 1], "note": "tronçon de 1 m le long de X, bouts "
                                                                            "au bord de la case"})
    A.add("cemetery_wall_corner", cemetery_wall_corner(A), {
        "footprint": [1, 1], "note": "bras vers +X et +Z (glTF); rotation 0 nord-ouest, 1 sud-ouest, 2 sud-est, "
                                     "3 nord-est"})
    A.add("cemetery_cross", cemetery_cross(A), {"footprint": [1, 1]})
    A.add("cemetery_tap", cemetery_tap(A), {"footprint": [1, 1], "water_point": True})
    A.add("crossing_sign", crossing_sign(A), {"footprint": [1, 1], "note": "face peinte vers +Z (qui arrive)"})
    A.add("oratory", oratory(A), {"footprint": [1, 1], "note": "niche et statue vers +Z"})
    vg, vf = vine_row(A)
    vr = A.add("vine_row", vg, {"footprint": [3, 1], "note": "tronçon de 3 m le long de X, ceps à -1, 0, 1 m"})
    A.add("vine_row_grapes", vf, {"seasons": ["autumn"]}, parent=vr)
    A.add("anvil", anvil(A), {"footprint": [1, 1], "work_height": 0.75})
    A.add("hand_pump", hand_pump(A), {"footprint": [1, 1], "water_point": True,
                                      "spout": [0.0, 0.74, 0.2], "note": "bec au-dessus de l'auge (repère glTF)"})
    A.add("water_trough", water_trough(A), {"footprint": [2, 1], "water_height": 0.5})
    A.add("manure_heap", manure_heap(A), {"footprint": [2, 2]})
    A.add("fallen_trunk", fallen_trunk(A), {"footprint": [3, 1], "note": "racines à l'ouest (-X), coupe à l'est"})
    A.add("postcard_rack", postcard_rack(A), {"footprint": [1, 1]})
    A.add("cafe_table", cafe_table(A), {"footprint": [1, 1], "seat_height": 0.47, "table_height": 0.74})
    A.add("skittles_alley", skittles_alley(A), {"footprint": [8, 1], "walk_height": 0.04,
                                                "pin_spots": SKITTLE_SPOTS, "ball_spot": [-3.3, 0.04, 0.0],
                                                "pin_model": "skittle_pin", "ball_model": "skittle_ball"})
    A.add("skittle_pin", skittle_pin(A), {"kind": "prop", "on": "skittles_alley.pin_spots"})
    A.add("skittle_ball", skittle_ball(A), {"kind": "prop", "on": "skittles_alley.ball_spot"})

    A.add("fern", fern(A), {"footprint": [1, 1]})
    A.add("fern_small", fern(A, small=True), {"footprint": [1, 1]})
    A.add("bilberry_bush", bilberry_bush(A), {"footprint": [1, 1]})
    A.add("holly_bush", holly_bush(A), {"footprint": [1, 1]})
    A.add("raspberry_bush", raspberry_bush(A), {"footprint": [1, 1]})
    A.add("mushroom_cluster", mushroom_cluster(A), {"footprint": [1, 1], "note": "décor, ne se cueille pas"})
    A.add("deadwood_branch", deadwood_branch(A), {"footprint": [1, 1]})
    A.add("black_trumpet", black_trumpet(A), {"kind": "item", "size_m": 0.22})

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "foret013.glb")
    size = lpl.export_glb(path, objs, animations=False)
    st = A.stats()
    lpl.write_stats("foret013", {"nodes": st, "file_bytes": size})
    os.makedirs(os.path.join(lpl.HERE, "blend"), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "foret013.blend"), compress=True)
    print("FORET013", size)
    for k, v in st.items():
        print(f"  {k}: {v['tris']}")


if __name__ == "__main__":
    main()
