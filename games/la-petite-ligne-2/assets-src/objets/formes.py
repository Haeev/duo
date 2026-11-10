"""Bibliothèque de formes des objets: géométrie pure (Python seul, sans Blender).

Repère de Blender: Z en haut, l'avant regarde -Y (il devient +Z en glTF). Une forme est une
`Piece`: sommets, faces (quadrilatères ou triangles) et une couleur par face, nommée dans le
nuancier. Toutes les formes sont fermées: le sens des faces est remis par Blender
(`recalc_face_normals`), on n'a donc pas à soigner l'ordre des sommets ici.
"""
import math

TAU = 2 * math.pi


def _spow(x, e):
    """Puissance signée (superellipses)."""
    return math.copysign(abs(x) ** e, x)


def _hash(i, seed):
    """Bruit stable d'une exécution à l'autre (pas de `hash()` Python, qui change)."""
    x = (i * 374761393 + seed * 668265263) & 0xFFFFFFFF
    x = ((x ^ (x >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((x ^ (x >> 16)) & 0xFFFF) / 0xFFFF


class Piece:
    def __init__(self, verts, faces, color):
        self.verts = [tuple(v) for v in verts]
        self.faces = [tuple(f) for f in faces]
        # couleur: un nom, ou une fonction (centre de la face) -> nom
        self.colors = [color(self.center(f)) if callable(color) else color for f in self.faces]

    def center(self, f):
        n = len(f)
        return tuple(sum(self.verts[i][k] for i in f) / n for k in range(3))

    def recolor(self, fn):
        self.colors = [fn(self.center(f), c) for f, c in zip(self.faces, self.colors)]
        return self

    def map(self, fn):
        self.verts = [tuple(fn(v)) for v in self.verts]
        return self

    def move(self, dx=0.0, dy=0.0, dz=0.0):
        return self.map(lambda v: (v[0] + dx, v[1] + dy, v[2] + dz))

    def scale(self, sx=1.0, sy=None, sz=None):
        sy = sx if sy is None else sy
        sz = sx if sz is None else sz
        return self.map(lambda v: (v[0] * sx, v[1] * sy, v[2] * sz))

    def rot(self, rx=0.0, ry=0.0, rz=0.0):
        """Rotations en degrés, appliquées dans l'ordre X, Y, Z autour de l'origine."""
        def f(v):
            x, y, z = v
            a = math.radians(rx)
            y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
            a = math.radians(ry)
            x, z = x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)
            a = math.radians(rz)
            x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
            return (x, y, z)
        return self.map(f)

    def triangles(self):
        return sum(len(f) - 2 for f in self.faces)


def lathe(profile, color, segs=16, sx=1.0, sy=1.0, lobes=0, lobe_amp=0.0, phase=0.0, ribs=None):
    """Volume de révolution autour de Z. `profile`: liste de (rayon, z) de bas en haut; les bouts
    sont fermés (pôle si le rayon y vaut 0, sinon un disque plat). `lobes`: côtes (potiron)."""
    verts, faces, rings = [], [], []
    prof = list(profile)
    if prof[0][0] > 1e-6:
        prof.insert(0, (0.0, prof[0][1]))
    if prof[-1][0] > 1e-6:
        prof.append((0.0, prof[-1][1]))
    for r, z in prof:
        if r < 1e-6:
            rings.append([len(verts)])
            verts.append((0.0, 0.0, z))
            continue
        ring = []
        for i in range(segs):
            a = TAU * i / segs + math.radians(phase)
            rr = r * (1 + lobe_amp * math.cos(lobes * a)) if lobes else r
            if ribs:
                rr *= ribs(a, z)
            ring.append(len(verts))
            verts.append((rr * math.cos(a) * sx, rr * math.sin(a) * sy, z))
        rings.append(ring)
    for ra, rb in zip(rings, rings[1:]):
        if len(ra) == 1 and len(rb) == 1:
            continue
        if len(ra) == 1:
            faces += [(ra[0], rb[i], rb[(i + 1) % segs]) for i in range(segs)]
        elif len(rb) == 1:
            faces += [(ra[i], ra[(i + 1) % segs], rb[0]) for i in range(segs)]
        else:
            faces += [(ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]) for i in range(segs)]
    return Piece(verts, faces, color)


def blob(rx, ry, rz, color, e_lat=1.0, e_lon=1.0, segs=16, rings=8, flat=1.0, bump=0.0, seed=1):
    """Superquadrique centrée en (0, 0, 0): e < 1 donne un pavé arrondi, 1 un ellipsoïde.
    `flat` < 1 aplatit le dessous (pain posé), `bump` bosselle (cailloux, pommes de terre)."""
    verts, faces, ids = [], [], []
    for j in range(rings + 1):
        v = -math.pi / 2 + math.pi * j / rings
        if j in (0, rings):
            ids.append([len(verts)])
            z = rz * _spow(math.sin(v), e_lat)
            verts.append((0.0, 0.0, max(z, -rz * flat)))
            continue
        row = []
        for i in range(segs):
            u = TAU * i / segs
            k = 1 + bump * (_hash(j * 97 + i, seed) - 0.5) * 2
            x = rx * _spow(math.cos(v), e_lat) * _spow(math.cos(u), e_lon) * k
            y = ry * _spow(math.cos(v), e_lat) * _spow(math.sin(u), e_lon) * k
            z = rz * _spow(math.sin(v), e_lat) * (1 + bump * (_hash(j * 31 + i * 7, seed) - 0.5))
            row.append(len(verts))
            verts.append((x, y, max(z, -rz * flat)))
        ids.append(row)
    for ra, rb in zip(ids, ids[1:]):
        if len(ra) == 1:
            faces += [(ra[0], rb[(i + 1) % segs], rb[i]) for i in range(segs)]
        elif len(rb) == 1:
            faces += [(ra[i], ra[(i + 1) % segs], rb[0]) for i in range(segs)]
        else:
            faces += [(ra[i], ra[(i + 1) % segs], rb[(i + 1) % segs], rb[i]) for i in range(segs)]
    return Piece(verts, faces, color)


def _norm(v):
    n = math.sqrt(sum(c * c for c in v)) or 1.0
    return tuple(c / n for c in v)


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def sweep(path, radii, color, segs=8, up=(0.0, 0.0, 1.0), caps=True, closed=False, cap_round=0.6):
    """Tube le long d'une polyligne. `radii`: un rayon, ou par point un rayon ou un couple
    (rayon selon `up`, rayon de côté): section elliptique (corps de poisson, lame, feuille).
    Bouts arrondis par un pôle avancé de `cap_round` x rayon. `closed`: anneau (clé, anse)."""
    n = len(path)
    if not isinstance(radii, list):
        radii = [radii] * n  # un nombre, ou un couple (section elliptique) commun à tous les points
    radii = [(r, r) if not isinstance(r, (list, tuple)) else r for r in radii]
    verts, faces, rings = [], [], []
    for i, p in enumerate(path):
        if closed:
            a, b = path[(i - 1) % n], path[(i + 1) % n]
        else:
            a, b = path[max(i - 1, 0)], path[min(i + 1, n - 1)]
        t = _norm(tuple(b[k] - a[k] for k in range(3)))
        side = _cross(t, up)
        if sum(c * c for c in side) < 1e-8:
            side = _cross(t, (1.0, 0.0, 0.0))
        side = _norm(side)
        nrm = _norm(_cross(side, t))
        ru, rs = radii[i]
        ring = []
        for s in range(segs):
            a2 = TAU * s / segs
            ring.append(len(verts))
            verts.append(tuple(p[k] + nrm[k] * ru * math.cos(a2) + side[k] * rs * math.sin(a2) for k in range(3)))
        rings.append((ring, t))
    pairs = list(zip(rings, rings[1:]))
    if closed:
        pairs.append((rings[-1], rings[0]))
    for (ra, _), (rb, _) in pairs:
        faces += [(ra[s], ra[(s + 1) % segs], rb[(s + 1) % segs], rb[s]) for s in range(segs)]
    if caps and not closed:
        for (ring, t), p, r, sgn in ((rings[0], path[0], radii[0], -1), (rings[-1], path[-1], radii[-1], 1)):
            if max(r) < 1e-6:
                continue
            ext = cap_round * min(r)
            pole = len(verts)
            verts.append(tuple(p[k] + sgn * t[k] * ext for k in range(3)))
            faces += [(ring[s], ring[(s + 1) % segs], pole) for s in range(segs)]
    return Piece(verts, faces, color)


def box(sx, sy, sz, color, e=0.25, segs=12, rings=6):
    """Pavé aux arêtes rondes, posé sur z = 0 (dessous plat)."""
    return blob(sx / 2, sy / 2, sz / 2, color, e_lat=e, e_lon=e, segs=segs, rings=rings).move(dz=sz / 2)


def leaf(length, width, color, thick=0.15, bend=0.25, segs=6, steps=5):
    """Feuille en volume (lentille), de la base à l'origine vers +X, qui retombe un peu."""
    path, radii = [], []
    for i in range(steps + 1):
        t = i / steps
        path.append((length * t, 0.0, -bend * length * t * t))
        w = width * 0.5 * math.sin(math.pi * min(1.0, 0.15 + t * 0.95)) + 1e-4
        radii.append((max(w * thick, 0.0006), w))
    return sweep(path, radii, color, segs=segs, cap_round=0.3)


def spiral(r0, r1, turns, tube0, tube1, color, steps=36, segs=8):
    """Spirale à plat (ammonite): tube qui s'enroule en grossissant."""
    path, radii = [], []
    for i in range(steps + 1):
        t = i / steps
        a = TAU * turns * t
        r = r0 + (r1 - r0) * t
        path.append((r * math.cos(a), r * math.sin(a), 0.0))
        radii.append(tube0 + (tube1 - tube0) * t)
    return sweep(path, radii, color, segs=segs)
