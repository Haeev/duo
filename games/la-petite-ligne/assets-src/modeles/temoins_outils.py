"""Outils des personnages témoins (qualité visuelle, étape A): volumes lissés, mèches, décalques plaqués, coutures,
occlusion et peinture cuites dans les couleurs de sommets, normales du visage.

Couleurs de sommets (attribut `Col`, exporté en COLOR_0): un multiplicateur de la palette (1 = la case telle
quelle). Three.js le multiplie de lui-même (`vertexColors` posé par GLTFLoader), Blender aussi (palette_material,
`vcol`). La palette donne toujours la teinte: la personnalisation des joueurs continue de marcher.
"""
import math
import random

import bpy  # noqa: F401,I001 (bpy avant bmesh)
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree


# Données attachées à un Geo -------------------------------------------------------------------------------

def init(g):
    """Prépare un Geo (lpl.Geo) aux témoins: lissé par défaut, peinture et normales imposées par sommet."""
    g.smooth_default = True
    g.paint = {}       # BMVert -> (r, g, b) multiplicateur peint (plis, joues, coutures)
    g.vnorm = {}       # BMVert -> Vector (normale imposée: décalques du visage, coutures)
    g.tags = {}        # nom -> ensemble de BMVert (pièces repérées pour la peinture et les contrôles)
    g.no_ao = set()    # sommets sans occlusion (décalques: ils prennent celle de la surface dessous)
    return g


def tag(g, name, verts):
    g.tags.setdefault(name, set()).update(v for v in verts if v.is_valid)
    return verts


def mul(g, v, c):
    a = g.paint.get(v, (1.0, 1.0, 1.0))
    if isinstance(c, (int, float)):
        c = (c, c, c)
    g.paint[v] = (a[0] * c[0], a[1] * c[1], a[2] * c[2])


# Volumes ----------------------------------------------------------------------------------------------------

def section(ax, ayf, ayb, a, p=2.0, cx=0.0, cy=0.0):
    """Point d'une section en super-ellipse (devant -Y): a = 0 devant, pi/2 à gauche du personnage (+X)."""
    s, c = math.sin(a), math.cos(a)
    x = ax * math.copysign(abs(s) ** (2.0 / p), s)
    ay = ayf if c > 0 else ayb
    y = -ay * math.copysign(abs(c) ** (2.0 / p), c)
    return (cx + x, cy + y)


def loft(g, rings, color, n=16, bone=None, weights=None, close_bottom=False, close_top=False, smooth=None,
         phase=0.0, radial=None):
    """Volume par anneaux (z, ax, ay_devant, ay_dos[, p, cx, cy]) de bas en haut, n pans. radial(a, i) -> facteur
    de rayon (plis). Renvoie la liste des anneaux (listes de BMVert)."""
    bm = g.bm
    grid = []
    for i, r in enumerate(rings):
        z, ax, ayf, ayb = r[:4]
        p = r[4] if len(r) > 4 else 2.0
        cx = r[5] if len(r) > 5 else 0.0
        cy = r[6] if len(r) > 6 else 0.0
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n + phase
            f = radial(a, i) if radial else 1.0
            x, y = section(ax * f, ayf * f, ayb * f, a, p)
            ring.append(bm.verts.new((cx + x, cy + y, z)))
        grid.append(ring)
    faces = []
    for i in range(len(grid) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            faces.append(bm.faces.new((grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k])))
    if close_bottom:
        faces.append(bm.faces.new(list(reversed(grid[0]))))
    if close_top:
        faces.append(bm.faces.new(grid[-1]))
    verts = [v for r in grid for v in r]
    g._finish(verts, color, bone, weights, smooth)
    return grid


def tube(g, pts, radii, color, n=8, bone=None, weights=None, cap0=True, cap1=True, smooth=None, flat=1.0,
         up=None):
    """Tube le long d'une polyligne (rayons par point; flat < 1 aplatit la section selon `up`)."""
    pts = [Vector(p) for p in pts]
    bm = g.bm
    rings = []
    up = Vector(up) if up is not None else Vector((0, 0, 1))
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = t.cross(up)
        if side.length < 1e-4:
            side = t.cross(Vector((0, 1, 0)))
        side.normalize()
        nrm = side.cross(t).normalized()
        r = radii[i]
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            ring.append(bm.verts.new(p + side * (r * math.cos(a)) + nrm * (r * flat * math.sin(a))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))
    if cap0:
        bm.faces.new(list(reversed(rings[0])))
    if cap1:
        bm.faces.new(rings[-1])
    verts = [v for r in rings for v in r]
    fix_normals(g, verts)
    g._finish(verts, color, bone, weights, smooth)
    return verts


def fix_normals(g, verts):
    fs = list({f for v in verts if v.is_valid for f in v.link_faces})
    if fs:
        bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    return verts


def ellipsoid(g, c, r, color, segs=10, rings=7, bone=None, weights=None, rot=(0, 0, 0), smooth=None, deform=None):
    """Ellipsoïde lissé (deform(Vector unitaire) -> Vector déplacé, avant mise à l'échelle)."""
    vs = bmesh.ops.create_uvsphere(g.bm, u_segments=segs, v_segments=rings, radius=1.0)["verts"]
    for v in vs:
        p = v.co.copy()
        if deform:
            p = deform(p)
        v.co = Vector((p.x * r[0], p.y * r[1], p.z * r[2]))
    from lpl import _rot
    M = Matrix.Translation(Vector(c)) @ _rot(rot)
    return g._finish(vs, color, bone, weights, smooth, M)


# Mèches de cheveux --------------------------------------------------------------------------------------------

def catmull(pts, n):
    """n points sur la courbe de Catmull-Rom passant par pts (extrémités doublées)."""
    P = [Vector(p) for p in pts]
    P = [P[0] + (P[0] - P[1]) * 0.3] + P + [P[-1] + (P[-1] - P[-2]) * 0.3]
    segs = len(P) - 3
    out = []
    for j in range(n):
        t = j / (n - 1) * segs
        i = min(int(t), segs - 1)
        u = t - i
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u +
                          (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u))
    return out


def strand(g, pts, w0, t0, color, center, bone="head", rings=5, tip=0.0, flat_root=True, weights=None,
           twist=0.0, w_profile=None):
    """Mèche effilée: section en amande (largeur w0, épaisseur t0 vers l'extérieur de `center`), le long d'une
    courbe passant par pts, pointe fine. Renvoie les sommets."""
    path = catmull(pts, rings)
    center = Vector(center)
    bm = g.bm
    rs = []
    n = len(path)
    for i, p in enumerate(path):
        u = i / (n - 1)
        t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        out = (p - center)
        out = (out - t * out.dot(t)).normalized()
        side = t.cross(out).normalized()
        if twist:
            side = Matrix.Rotation(twist * u, 3, t) @ side
            out = side.cross(t).normalized() * (1 if out.dot(side.cross(t)) >= 0 else -1)
        wf = w_profile(u) if w_profile else (1.0 - u ** 1.6) * (0.75 + 0.25 * math.sin(math.pi * min(1.0, u * 2.2)))
        w = max(w0 * wf, tip)
        th = max(t0 * (1.0 - 0.75 * u), tip * 0.6)
        if i == n - 1:
            rs.append([bm.verts.new(p)])
            continue
        sec = [(1.0, 0.0), (0.45, 1.0), (-0.45, 1.0), (-1.0, 0.0), (-0.45, -0.55), (0.45, -0.55)]
        rs.append([bm.verts.new(p + side * (w * a) + out * (th * b)) for a, b in sec])
    faces = []
    for i in range(n - 2):
        a, b = rs[i], rs[i + 1]
        for k in range(6):
            k2 = (k + 1) % 6
            faces.append(bm.faces.new((a[k], a[k2], b[k2], b[k])))
    last, tipv = rs[n - 2], rs[n - 1][0]
    for k in range(6):
        faces.append(bm.faces.new((last[k], last[(k + 1) % 6], tipv)))
    faces.append(bm.faces.new(list(reversed(rs[0]))))
    verts = [v for r in rs for v in r]
    fix_normals(g, verts)
    g._finish(verts, color, bone, weights)
    return verts


# Projection sur une surface --------------------------------------------------------------------------------

class Surface:
    """Surface hôte (sommets d'un Geo) pour plaquer décalques et coutures: lancer de rayons, normale lissée au
    point touché (interpolée sur le triangle)."""

    def __init__(self, verts):
        hv = [v for v in verts if v.is_valid]
        idx = {v: i for i, v in enumerate(hv)}
        tris = []
        for f in {f for v in hv for f in v.link_faces}:
            ids = [idx.get(v) for v in f.verts]
            if None in ids:
                continue
            for j in range(1, len(ids) - 1):
                tris.append((ids[0], ids[j], ids[j + 1]))
        self.co = [v.co.copy() for v in hv]
        self.no = [v.normal.copy() for v in hv]
        self.tris = tris
        self.tree = BVHTree.FromPolygons(self.co, tris)

    def hit(self, origin, direction):
        loc, nrm, i, _ = self.tree.ray_cast(Vector(origin), Vector(direction).normalized())
        if loc is None:
            return None, None
        a, b, c = (self.co[k] for k in self.tris[i])
        # normale lissée: barycentre du point dans le triangle
        v0, v1, v2 = b - a, c - a, loc - a
        d00, d01, d11 = v0.dot(v0), v0.dot(v1), v1.dot(v1)
        d20, d21 = v2.dot(v0), v2.dot(v1)
        den = d00 * d11 - d01 * d01
        if abs(den) < 1e-14:
            return loc, nrm
        wv = (d11 * d20 - d01 * d21) / den
        ww = (d00 * d21 - d01 * d20) / den
        wu = 1 - wv - ww
        na, nb, nc = (self.no[k] for k in self.tris[i])
        n = (na * wu + nb * wv + nc * ww).normalized()
        if n.dot(nrm) < 0:
            n = -n
        return loc, n

    def plate(self, g, verts, direction=(0, 1, 0), offset=0.0018, extra=None, keep=True):
        """Plaque les sommets (dessinés devant la surface) le long de direction; extra(v) -> décalage en plus."""
        d = Vector(direction).normalized()
        for v in verts:
            if not v.is_valid:
                continue
            loc, n = self.hit(v.co - d * 1.0, d)
            if loc is None:
                continue
            off = offset + (extra(v) if extra else 0.0)
            v.co = loc + n * off
            if keep:
                g.vnorm[v] = n
                g.no_ao.add(v)

    def radial(self, g, verts, z_axis=True, offset=0.0015, center=(0, 0)):
        """Plaque les sommets vers l'axe vertical du personnage (rayons horizontaux depuis l'extérieur)."""
        for v in verts:
            if not v.is_valid:
                continue
            d = Vector((v.co.x - center[0], v.co.y - center[1], 0.0))
            if d.length < 1e-6:
                continue
            d.normalize()
            loc, n = self.hit(Vector((center[0], center[1], v.co.z)) + d * 1.0, -d)
            if loc is None:
                continue
            v.co = loc + n * offset
            g.vnorm[v] = n
            g.no_ao.add(v)


def flat_piece(g, outline, color, bone=None, weights=None):
    """Polygone plan (liste de points 3D, sens trigonométrique vu de devant) en une face; renvoie les sommets."""
    bm = g.bm
    vs = [bm.verts.new(p) for p in outline]
    bm.faces.new(vs)
    g._finish(vs, color, bone, weights)
    return vs


def grid_piece(g, rows, color, bone=None, weights=None):
    """Grille de quads: rows = liste de rangées de points (même longueur), du bas vers le haut, de gauche (−X vu de
    face, donc la droite du personnage) à droite; face vers −Y. Renvoie la grille de BMVert."""
    bm = g.bm
    gv = [[bm.verts.new(p) for p in r] for r in rows]
    for i in range(len(gv) - 1):
        for k in range(len(gv[0]) - 1):
            bm.faces.new((gv[i][k], gv[i][k + 1], gv[i + 1][k + 1], gv[i + 1][k]))
    verts = [v for r in gv for v in r]
    g._finish(verts, color, bone, weights)
    return gv


def strip(g, pts, widths, color, normal_fn, bone=None, weights=None):
    """Bande mince le long de points déjà posés sur une surface (largeur par point, centrée), normale_fn(p) donne
    la normale de la surface: sert aux coutures continues, sourcils, paupières."""
    bm = g.bm
    left, right = [], []
    for i, p in enumerate(pts):
        p = Vector(p)
        t = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        n = normal_fn(p)
        s = n.cross(t).normalized()
        left.append(bm.verts.new(p + s * widths[i] / 2))
        right.append(bm.verts.new(p - s * widths[i] / 2))
    for i in range(len(pts) - 1):
        f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        if f.normal.dot(normal_fn(Vector(pts[i]))) < 0:
            f.normal_flip()
    verts = left + right
    g._finish(verts, color, bone, weights)
    for v in verts:
        g.vnorm[v] = normal_fn(v.co)
        g.no_ao.add(v)
    return left, right


def dashes(g, surf, path, color, dash=0.011, gap=0.007, width=0.0028, offset=0.0016, bone=None, weights=None,
           direction=None, darken=None):
    """Surpiqûre: tirets posés sur la surface le long d'une polyligne (points proches de la surface). Chaque
    tiret est projeté (direction donnée, ou vers l'axe du personnage). Renvoie les sommets."""
    pts = [Vector(p) for p in path]
    # rééchantillonnage à pas constant
    seg = []
    for a, b in zip(pts, pts[1:]):
        seg.append((a, b, (b - a).length))
    total = sum(s[2] for s in seg)

    def at(d):
        for a, b, ln in seg:
            if d <= ln:
                return a.lerp(b, d / ln if ln else 0.0)
            d -= ln
        return pts[-1]
    out = []
    d = gap * 0.5
    bm = g.bm
    while d + dash <= total:
        p0, p1 = at(d), at(d + dash)
        t = (p1 - p0).normalized()
        mid = (p0 + p1) / 2
        if direction is not None:
            dirv = Vector(direction).normalized()
        else:
            dirv = Vector((-mid.x, -mid.y, 0.0)).normalized()
        loc, n = surf.hit(mid - dirv * 1.0, dirv)
        if loc is None:
            d += dash + gap
            continue
        s = n.cross(t).normalized()
        t2 = s.cross(n).normalized()
        quad = [loc - t2 * dash / 2 - s * width / 2, loc + t2 * dash / 2 - s * width / 2,
                loc + t2 * dash / 2 + s * width / 2, loc - t2 * dash / 2 + s * width / 2]
        vs = [bm.verts.new(q + n * offset) for q in quad]
        f = bm.faces.new(vs)
        if f.normal.dot(n) < 0:
            f.normal_flip()
        w0 = weights(loc) if weights else None
        g._finish(vs, color, bone, (lambda co, w0=w0: w0) if w0 else None)
        for v in vs:
            g.vnorm[v] = n
            g.no_ao.add(v)
            if darken:
                mul(g, v, darken)
        out += vs
        d += dash + gap
    return out


# Occlusion et couleurs de sommets -------------------------------------------------------------------------

def _hemisphere(n=40):
    """Directions fixes réparties en cosinus sur l'hémisphère +Z (spirale de Fibonacci): résultat identique à
    chaque construction (pas de bruit)."""
    out = []
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        a = i * ga
        out.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(max(0.0, 1 - u)))))
    return out


HEMI = _hemisphere(40)


def bake_ao(g, context_polys=None, dist=0.16, strength=0.62, floor=0.42):
    """Occlusion ambiante par sommet (lancer de rayons sur le Geo et d'éventuelles pièces voisines). Renvoie
    {BMVert: facteur}. Les décalques prennent l'occlusion du point de la surface où ils sont posés."""
    co, polys = [], []
    idx = {}
    for v in g.bm.verts:
        idx[v] = len(co)
        co.append(v.co.copy())
    for f in g.bm.faces:
        ids = [idx[v] for v in f.verts]
        for j in range(1, len(ids) - 1):
            polys.append((ids[0], ids[j], ids[j + 1]))
    if context_polys:
        base = len(co)
        cco, cpo = context_polys
        co += cco
        polys += [tuple(i + base for i in p) for p in cpo]
    tree = BVHTree.FromPolygons(co, polys)
    out = {}
    for v in g.bm.verts:
        n = g.vnorm.get(v, v.normal)
        if n.length < 0.5:
            out[v] = 1.0
            continue
        q = n.to_track_quat("Z", "Y").to_matrix()
        o = v.co + n * 0.0025
        hit = 0.0
        for d in HEMI:
            dd = q @ d
            r = tree.ray_cast(o, dd, dist)
            if r[0] is not None:
                hit += 1.0 - (r[3] / dist) ** 2
        occ = hit / len(HEMI)
        out[v] = max(floor, 1.0 - strength * occ)
    return out


def context_of(g):
    """Triangles d'un Geo (pour l'occlusion d'une autre pièce posée dessus)."""
    co, polys = [], []
    idx = {}
    for v in g.bm.verts:
        idx[v] = len(co)
        co.append(v.co.copy())
    for f in g.bm.faces:
        ids = [idx[v] for v in f.verts]
        for j in range(1, len(ids) - 1):
            polys.append((ids[0], ids[j], ids[j + 1]))
    return co, polys


def merge_context(*ctx):
    co, polys = [], []
    for c, p in ctx:
        base = len(co)
        co += c
        polys += [tuple(i + base for i in t) for t in p]
    return co, polys


def finish_colors(g, context_polys=None, height=(0.0, 1.7, 0.94), ao=True):
    """Calcule les couleurs de sommets: occlusion x peinture x dégradé de hauteur (plus sombre vers les pieds,
    plan L4). Les décalques reprennent l'occlusion de la surface voisine la plus proche."""
    aof = bake_ao(g, context_polys) if ao else {}
    if ao and g.no_ao:
        from mathutils.kdtree import KDTree
        others = [v for v in g.bm.verts if v not in g.no_ao]
        kd = KDTree(len(others))
        for i, v in enumerate(others):
            kd.insert(v.co, i)
        kd.balance()
        for v in g.no_ao:
            if v.is_valid:
                _, i, _ = kd.find(v.co)
                aof[v] = aof.get(others[i], 1.0)
    z0, z1, lo = height
    cols = {}
    for v in g.bm.verts:
        a = aof.get(v, 1.0)
        h = lo + (1 - lo) * max(0.0, min(1.0, (v.co.z - z0) / (z1 - z0)))
        p = g.paint.get(v, (1.0, 1.0, 1.0))
        cols[v] = (p[0] * a * h, p[1] * a * h, p[2] * a * h)
    g.vcols = cols
    return cols


def to_object(g, name, mat, sharp_angle=50.0):
    """Comme lpl.Geo.to_object, plus l'attribut `Col`, les arêtes vives au-delà de sharp_angle et les normales
    imposées (décalques)."""
    bm = g.bm
    bm.verts.index_update()
    cols = getattr(g, "vcols", None) or {}
    col_idx = {v.index: c for v, c in cols.items() if v.is_valid}
    vn_idx = {v.index: n for v, n in getattr(g, "vnorm", {}).items() if v.is_valid}
    ob = g.to_object(name, mat)
    me = ob.data
    at = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    flat = []
    for i in range(len(me.vertices)):
        c = col_idx.get(i, (1.0, 1.0, 1.0))
        flat += [c[0], c[1], c[2], 1.0]
    at.data.foreach_set("color", flat)
    me.color_attributes.active_color = at
    me.set_sharp_from_angle(angle=math.radians(sharp_angle))
    if vn_idx:
        cn = [Vector(n.vector) for n in me.corner_normals]
        for li, lp in enumerate(me.loops):
            n = vn_idx.get(lp.vertex_index)
            if n is not None:
                cn[li] = n.normalized()
        me.normals_split_custom_set([tuple(n) for n in cn])
    return ob


def add_white_colors(ob):
    """Attribut `Col` blanc pour un maillage qui n'en a pas: tous les maillages du matériau des personnages doivent
    porter COLOR_0, sinon Three.js les dessinerait en noir (attribut absent lu à 0)."""
    me = ob.data
    if me.color_attributes.get("Col") is not None:
        return
    at = me.color_attributes.new("Col", "BYTE_COLOR", "POINT")
    at.data.foreach_set("color", [1.0] * (4 * len(me.vertices)))
    me.color_attributes.active_color = at


def rng(seed):
    return random.Random(seed)
