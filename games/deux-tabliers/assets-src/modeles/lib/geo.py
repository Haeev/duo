"""Outils de géométrie de l'essai de style (Blender 5.2, bmesh).

Repère de travail: celui du plan (`plans.json`): x vers l'est, y vers le sud (vers la place), z en haut,
en mètres. Blender reçoit (x, -y, z): l'export glTF donne alors x = x du plan, Y en haut, z = y du plan,
c'est-à-dire que les coordonnées de Three.js se lisent directement sur le plan.

Chaque `Geo` devient un objet Blender; ses faces portent une clé de matière (`key`), traduite en
matériau selon la variante (voir materiaux.py).
"""

import math

import bpy  # noqa: F401  (bpy avant bmesh, sinon bmesh est introuvable)
import bmesh
from mathutils import Matrix, Vector


class Style:
    """Paramètres de forme d'une variante."""

    def __init__(self, name, bevel_scale, bevel_min, segs_small, segs_big, round_mult, smooth_all, sharp_deg):
        self.name = name
        self.bevel_scale = bevel_scale  # multiplie le chanfrein de la bible
        self.bevel_min = bevel_min
        self.segs_small = segs_small
        self.segs_big = segs_big
        self.round_mult = round_mult  # multiplie le nombre de pans des pièces rondes
        self.smooth_all = smooth_all  # normales lissées partout (arêtes vives au-delà de sharp_deg)
        self.sharp_deg = sharp_deg


STYLE = None


def set_style(style):
    global STYLE
    STYLE = style


def bible_bevel(size):
    """Chanfrein et segments de la bible (4.1) selon la plus grande dimension, mis à l'échelle de la variante."""
    if size < 0.5:
        w, s = 0.01, STYLE.segs_small
    elif size < 2.0:
        w, s = 0.025, STYLE.segs_big
    else:
        w, s = 0.05, STYLE.segs_big
    w *= STYLE.bevel_scale
    if w <= 0:
        return 0.0, 0
    return max(w, STYLE.bevel_min), s


def pans(n):
    return max(6, int(round(n * STYLE.round_mult)))


def P(x, y, z):
    """Point du plan vers Blender."""
    return Vector((x, -y, z))


class Geo:
    """Un maillage en construction, avec des clés de matière par face."""

    registry = []

    def __init__(self, name, kind="static", smooth=False):
        self.name = name
        self.kind = kind  # static (cuit), glass, char, emit
        self.bm = bmesh.new()
        self.keys = []
        self.smooth = smooth  # lissé même en variante A (vaisselle, nourriture, personnages)
        self.gl = self.bm.faces.layers.int.new("grain")
        Geo.registry.append(self)

    def set_grain(self, verts, axis):
        """Fil du bois (axe du plan: 'x', 'y' ou 'z') des faces touchant ces sommets, pour l'UV de la variante B."""
        g = {"x": 1, "y": 2, "z": 3}[axis]
        for f in {f for v in verts for f in v.link_faces}:
            f[self.gl] = g

    # --- matières
    def mi(self, key):
        if key not in self.keys:
            self.keys.append(key)
        return self.keys.index(key)

    def _new_verts(self, before):
        return [v for v in self.bm.verts if v not in before]

    # --- primitives
    def box(self, x0, x1, y0, y1, z0, z1, key, bevel=None, segs=None, edges="all", faces_keys=None, drop=(), grain=None):
        """Boîte alignée sur les axes du plan. bevel: largeur du chanfrein (None: règle de la bible).
        edges: 'all', 'top' (arêtes du dessus seules), 'vertical', 'nobottom' (arêtes au sol vives).
        drop: faces à supprimer ('bottom', 'top', 'n', 's', 'e', 'w'), pour les faces cachées."""
        bm = self.bm
        before = set(bm.verts)
        xs, ys, zs = (x0, x1), (y0, y1), (z0, z1)
        v = {}
        for i in (0, 1):
            for j in (0, 1):
                for k in (0, 1):
                    v[i, j, k] = bm.verts.new(P(xs[i], ys[j], zs[k]))
        # faces orientées vers l'extérieur (repère Blender: y du plan inversé)
        quads = {
            "bottom": [(0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)],
            "top": [(0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)],
            "w": [(0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)],
            "e": [(1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)],
            "n": [(0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)],
            "s": [(0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)],
        }
        new_faces = []
        for side, q in quads.items():
            f = bm.faces.new([v[c] for c in q])
            k = (faces_keys or {}).get(side, key)
            f.material_index = self.mi(k)
            f.smooth = False
            new_faces.append((side, f))
        bmesh.ops.recalc_face_normals(bm, faces=[f for _, f in new_faces])
        size = max(x1 - x0, y1 - y0, z1 - z0)
        if bevel is None:
            bevel, segs_b = bible_bevel(size)
        else:
            bevel = bevel * STYLE.bevel_scale if bevel > 0 else 0
            bevel = max(bevel, STYLE.bevel_min) if bevel > 0 else 0
            segs_b = STYLE.segs_small if size < 0.5 else STYLE.segs_big
        if segs is not None:
            segs_b = segs
        thin = min(x1 - x0, y1 - y0, z1 - z0)
        bevel = min(bevel, thin * 0.45)
        if bevel > 0.0005 and segs_b > 0 and edges != "none":
            vs = set(v.values())
            es = sorted({e for vv in vs for e in vv.link_edges if all(w in vs for w in e.verts)}, key=lambda e: e.index)

            def keep(e):
                a, b = e.verts
                if edges == "top":
                    return abs(a.co.z - z1) < 1e-6 and abs(b.co.z - z1) < 1e-6
                if edges == "vertical":
                    return abs(a.co.z - b.co.z) > 1e-6
                if edges == "nobottom":
                    return not (abs(a.co.z - z0) < 1e-6 and abs(b.co.z - z0) < 1e-6)
                if edges == "notop":
                    return not (abs(a.co.z - z1) < 1e-6 and abs(b.co.z - z1) < 1e-6)
                return True

            bm.edges.index_update()
            es = sorted([e for e in es if keep(e)], key=lambda e: e.index)
            if es:
                bmesh.ops.bevel(bm, geom=es, offset=bevel, offset_type="OFFSET", segments=segs_b, profile=0.5,
                                affect="EDGES", clamp_overlap=True)
        if drop:
            nv = self._new_verts(before)
            kill = []
            for f in {f for vv in nv for f in vv.link_faces}:
                n = f.normal
                c = f.calc_center_median()
                if "bottom" in drop and n.z < -0.99 and abs(c.z - z0) < 1e-4:
                    kill.append(f)
                if "top" in drop and n.z > 0.99 and abs(c.z - z1) < 1e-4:
                    kill.append(f)
                if "n" in drop and n.y > 0.99:
                    kill.append(f)
                if "s" in drop and n.y < -0.99:
                    kill.append(f)
                if "w" in drop and n.x < -0.99:
                    kill.append(f)
                if "e" in drop and n.x > 0.99:
                    kill.append(f)
            bmesh.ops.delete(bm, geom=list(set(kill)), context="FACES_ONLY")
        nv = self._new_verts(before)
        dims = {"x": x1 - x0, "y": y1 - y0, "z": z1 - z0}
        self.set_grain(nv, grain or max(dims, key=dims.get))
        return nv

    def lathe(self, cx, cy, z0, profile, segs, key, cap_bottom=True, cap_top=True, keys=None, phase=0.0, smooth=None, sy=1.0):
        """Volume de révolution autour de l'axe vertical (cx, cy). profile: [(r, dz), ...] de bas en haut.
        keys: clé par bande (len(profile) - 1), sinon `key`. sy: écrasement selon y du plan (ovales)."""
        bm = self.bm
        before = set(bm.verts)
        rings = []
        for r, dz in profile:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * i / segs + math.radians(phase)
                if r <= 1e-6:
                    ring.append(bm.verts.new(P(cx, cy, z0 + dz)))
                    break
                ring.append(bm.verts.new(P(cx + r * math.cos(a), cy + r * math.sin(a) * sy, z0 + dz)))
            rings.append(ring)
        faces = []
        for b in range(len(rings) - 1):
            ra, rb = rings[b], rings[b + 1]
            k = keys[b] if keys else key
            for i in range(segs):
                j = (i + 1) % segs
                if len(ra) == 1 and len(rb) == 1:
                    continue
                if len(ra) == 1:
                    f = bm.faces.new([ra[0], rb[j], rb[i]])
                elif len(rb) == 1:
                    f = bm.faces.new([ra[i], ra[j], rb[0]])
                else:
                    f = bm.faces.new([ra[i], ra[j], rb[j], rb[i]])
                f.material_index = self.mi(k)
                faces.append(f)
        if cap_bottom and len(rings[0]) > 1:
            f = bm.faces.new(list(reversed(rings[0])))
            f.material_index = self.mi(keys[0] if keys else key)
            faces.append(f)
        if cap_top and len(rings[-1]) > 1:
            f = bm.faces.new(rings[-1])
            f.material_index = self.mi(keys[-1] if keys else key)
            faces.append(f)
        # sens des faces: le profil tourne dans le sens trigonométrique vu de dessus dans le plan,
        # donc horaire dans Blender (y inversé): on corrige par le volume orienté.
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        sm = self.smooth if smooth is None else smooth
        for f in faces:
            f.smooth = sm
        return self._new_verts(before)

    def cyl(self, cx, cy, z0, z1, r, segs, key, bevel=0.0, r_top=None, phase=0.0, cap_bottom=True, cap_top=True, smooth=None):
        rt = r if r_top is None else r_top
        if bevel > 0:
            b = min(bevel, (z1 - z0) * 0.45, r * 0.45)
            prof = [(r - b, 0), (r, b), (rt, z1 - z0 - b), (rt - b, z1 - z0)]
        else:
            prof = [(r, 0), (rt, z1 - z0)]
        return self.lathe(cx, cy, z0, prof, segs, key, cap_bottom, cap_top, phase=phase, smooth=smooth)

    def rod(self, a, b, r, segs, key, cap=True, smooth=None):
        """Cylindre entre deux points du plan (x, y, z)."""
        bm = self.bm
        before = set(bm.verts)
        A, B = P(*a), P(*b)
        d = (B - A)
        ln = d.length
        q = d.to_track_quat("Z", "Y")
        M = Matrix.Translation(A) @ q.to_matrix().to_4x4()
        rings = []
        for z in (0, ln):
            ring = [bm.verts.new(M @ Vector((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z))) for i in range(segs)]
            rings.append(ring)
        faces = []
        for i in range(segs):
            j = (i + 1) % segs
            f = bm.faces.new([rings[0][i], rings[0][j], rings[1][j], rings[1][i]])
            f.material_index = self.mi(key)
            faces.append(f)
        if cap:
            for ring in (list(reversed(rings[0])), rings[1]):
                f = bm.faces.new(ring)
                f.material_index = self.mi(key)
                faces.append(f)
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        sm = self.smooth if smooth is None else smooth
        for f in faces:
            f.smooth = sm
        return self._new_verts(before)

    def sphere(self, cx, cy, cz, rx, ry, rz, key, segs=12, rings=8, smooth=True, zcut=None):
        """Ellipsoïde (rx est-ouest, ry nord-sud, rz vertical). zcut: coupe sous cz + zcut (dôme)."""
        prof = []
        for i in range(rings + 1):
            t = math.pi * i / rings - math.pi / 2
            z = math.sin(t)
            if zcut is not None and z * rz < zcut:
                continue
            prof.append((math.cos(t), z))
        if zcut is not None:
            z0 = zcut / rz
            prof.insert(0, (math.cos(math.asin(max(-1, min(1, z0)))), z0))
        bm = self.bm
        before = set(bm.verts)
        vs = self.lathe(0, 0, 0, prof, segs, key, cap_bottom=zcut is not None, cap_top=False, smooth=smooth)
        for v in vs:
            v.co = Vector((cx + v.co.x * rx, -cy + v.co.y * ry, cz + v.co.z * rz))
        return self._new_verts(before)

    def poly(self, pts, z, key, up=True):
        """Polygone plat horizontal (points du plan)."""
        f = self.bm.faces.new([self.bm.verts.new(P(x, y, z)) for x, y in pts])
        f.normal_update()
        if (f.normal.z > 0) != up:
            f.normal_flip()
        f.material_index = self.mi(key)
        return list(f.verts)

    def quad(self, pts, key, normal_hint=None):
        """Face quelconque (points du plan en 3D)."""
        f = self.bm.faces.new([self.bm.verts.new(P(*p)) for p in pts])
        f.normal_update()
        if normal_hint is not None:
            nh = P(*normal_hint)
            if f.normal.dot(nh) < 0:
                f.normal_flip()
        f.material_index = self.mi(key)
        f.smooth = self.smooth
        return list(f.verts)

    def prism(self, pts, z0, z1, key, bevel=0.0):
        """Prisme vertical sur un contour du plan."""
        bm = self.bm
        before = set(bm.verts)
        bot = [bm.verts.new(P(x, y, z0)) for x, y in pts]
        top = [bm.verts.new(P(x, y, z1)) for x, y in pts]
        n = len(pts)
        faces = [bm.faces.new(bot), bm.faces.new(top)]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new([bot[i], bot[j], top[j], top[i]]))
        for f in faces:
            f.material_index = self.mi(key)
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        if bevel > 0:
            es = sorted({e for f in faces for e in f.edges}, key=lambda e: e.index)
            bmesh.ops.bevel(bm, geom=es, offset=bevel, offset_type="OFFSET", segments=1, profile=0.5, affect="EDGES", clamp_overlap=True)
        return self._new_verts(before)

    # --- transformations d'un groupe de sommets
    @staticmethod
    def rotate_z(verts, cx, cy, deg):
        """Rotation autour d'un axe vertical passant par (cx, cy) du plan; deg positif = sens horaire vu de dessus
        sur le plan (de l'est vers le sud)."""
        c = P(cx, cy, 0)
        R = Matrix.Rotation(-math.radians(deg), 4, "Z")
        for v in verts:
            p = v.co - Vector((c.x, c.y, 0))
            v.co = R @ p + Vector((c.x, c.y, 0))

    @staticmethod
    def transform(verts, M):
        for v in verts:
            v.co = M @ v.co

    @staticmethod
    def move(verts, dx, dy, dz):
        for v in verts:
            v.co += Vector((dx, -dy, dz))


def finish(geo, collection, uv_scale=lambda key: 1.0):
    """Crée l'objet Blender d'un Geo: UV de projection (UV0, en mètres fois l'échelle de la matière, fil du bois
    selon l'axe demandé), lissage selon la variante."""
    bm = geo.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    for lay in [l for l in bm.loops.layers.uv.values() if l.name not in ("orig",)]:
        bm.loops.layers.uv.remove(lay)
    uv = bm.loops.layers.uv.new("UVMap")
    gl = geo.gl
    orig = bm.loops.layers.uv.get("orig")
    for f in bm.faces:
        if orig is not None and geo.keys[f.material_index].startswith("tex:"):
            for lp in f.loops:
                lp[uv].uv = lp[orig].uv
            continue
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = {2: (0, 1), 1: (0, 2), 0: (1, 2)}[ax]
        g = f[gl] - 1
        if g == b:
            a, b = b, a
        sc = uv_scale(geo.keys[f.material_index])
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co[a] * sc, co[b] * sc)
    if orig is not None:
        bm.loops.layers.uv.remove(orig)
    smooth_all = STYLE.smooth_all or geo.smooth
    if smooth_all:
        lim = math.radians(STYLE.sharp_deg if not geo.smooth else 60)
        for f in bm.faces:
            f.smooth = True
        for e in bm.edges:
            if len(e.link_faces) == 2:
                a, b = e.link_faces
                if a.normal.angle(b.normal, 0) > lim or a.material_index != b.material_index:
                    e.smooth = False
            else:
                e.smooth = False
    me = bpy.data.meshes.new(geo.name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(geo.name, me)
    collection.objects.link(ob)
    ob["kind"] = geo.kind
    ob["keys"] = list(geo.keys)
    return ob
