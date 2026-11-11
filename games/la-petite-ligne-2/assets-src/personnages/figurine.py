"""Outils de fabrication des figurines: volumes balayés, zones de couleur, sections du corps, cibles de morphose.

Conventions d'export (lues par l'assemblage du jeu):
- un seul matériau `figurine` pour toutes les pièces; la couleur par défaut est en couleurs de sommets (COLOR_0);
- TEXCOORD_0.x = (zone + 0,5) / 8: zones 0 à 2 teintables (ordre de `zones` dans le catalogue), 6 couleur fixe
  (on garde COLOR_0), 7 peau (teinte `skin` de l'apparence);
- TEXCOORD_0.y = (section + 0,5) / 16 dans le fichier glTF, lu directement (`floor(v * 16)`): section du corps
  (ordre de REGIONS), pour retirer ce qu'un vêtement couvre. L'export glTF retourne l'axe V de Blender (v' = 1 - v):
  on écrit donc `1 - (section + 0,5) / 16` dans Blender (fonction `section_v`);
- cibles de morphose: corpulences et silhouettes sur les pièces du corps et les vêtements, expressions sur les têtes.
"""
import math

import bpy
import bmesh  # après bpy
from mathutils import Euler, Vector

X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
REGIONS = ["none", "neck", "torso", "pelvis", "upper-arm-a", "upper-arm-b", "forearm", "hand", "thigh-a", "thigh-b", "shin"]
ZONE_FIXED, ZONE_SKIN = 6, 7


def srgb(hexa):
    c = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


def section_v(region):
    """V à écrire dans Blender pour que le fichier glTF porte (section + 0,5) / 16 (export: v' = 1 - v)."""
    return 1.0 - (region + 0.5) / 16


def smooth(a, b, t):
    u = min(max((t - a) / (b - a), 0.0), 1.0)
    return u * u * (3 - 2 * u)


def chain(t, nodes):
    """Poids le long d'une chaîne d'os: nodes = [(os, position)], mélange lisse entre deux nœuds voisins."""
    if t <= nodes[0][1]:
        return {nodes[0][0]: 1.0}
    for (a, pa), (b, pb) in zip(nodes, nodes[1:]):
        if t <= pb:
            k = smooth(pa, pb, t)
            return {a: 1 - k, b: k}
    return {nodes[-1][0]: 1.0}


def tag(zone, color, region="none"):
    return (zone, color, REGIONS.index(region))


class Builder:
    """Accumule des volumes balayés: sommets, poids, faces, étiquette (zone, couleur, section) de chaque face."""

    def __init__(self):
        self.verts, self.weights, self.faces, self.tags = [], [], [], []
        self.cut = None  # (point, normale): ne garder que le côté de la normale (coupe nette)

    def sweep(self, stations, n, tg, wfn, cap0=False, cap1=False, keep=None):
        """stations: [(centre, direction, repère u, rayon u, rayon v)]; tg: étiquette ou fonction du centre de face."""
        rings = []
        for c, d, hint, ru, rv in stations:
            d = d.normalized()
            u = (hint - d * hint.dot(d)).normalized()
            v = d.cross(u)
            ring = []
            for j in range(n):
                a = 2 * math.pi * j / n
                p = c + u * (ru * math.cos(a)) + v * (rv * math.sin(a))
                ring.append(len(self.verts))
                self.verts.append(p)
                self.weights.append(wfn(p))
            rings.append(ring)
        for r0, r1 in zip(rings, rings[1:]):
            for j in range(n):
                k = (j + 1) % n
                f = (r0[j], r0[k], r1[k], r1[j])
                centre = sum((self.verts[i] for i in f), Vector()) / 4
                if keep is None or keep(centre, j / n):
                    self.faces.append(f)
                    self.tags.append(tg(centre) if callable(tg) else tg)
        for flag, ring, st, flip in ((cap0, rings[0], stations[0], True), (cap1, rings[-1], stations[-1], False)):
            if flag:
                i = len(self.verts)
                self.verts.append(st[0].copy())
                self.weights.append(wfn(st[0]))
                for j in range(n):
                    k = (j + 1) % n
                    self.faces.append((i, ring[k], ring[j]) if flip else (i, ring[j], ring[k]))
                    self.tags.append(tg(st[0]) if callable(tg) else tg)

    def grid(self, rows, tg, wfn, closed=False):
        """Nappe de quadrilatères entre rangées de points de même longueur (bas vers haut, sens des angles croissants)."""
        idx = []
        for row in rows:
            r = []
            for p in row:
                r.append(len(self.verts))
                self.verts.append(p)
                self.weights.append(wfn(p))
            idx.append(r)
        for r0, r1 in zip(idx, idx[1:]):
            n = len(r0)
            for j in range(n if closed else n - 1):
                k = (j + 1) % n
                f = (r0[j], r0[k], r1[k], r1[j])
                centre = sum((self.verts[i] for i in f), Vector()) / 4
                self.faces.append(f)
                self.tags.append(tg(centre) if callable(tg) else tg)
        return idx

    def quad(self, a, b, c, d, tg):
        """Ajoute un quadrilatère sur des sommets existants (indices)."""
        centre = (self.verts[a] + self.verts[b] + self.verts[c] + self.verts[d]) / 4
        self.faces.append((a, b, c, d))
        self.tags.append(tg(centre) if callable(tg) else tg)

    def weld(self, digits=7):
        """Soude les sommets confondus (bords d'arcs qui se rejoignent). Les coïncidences viennent des formules,
        donc valent pour toutes les corpulences: la topologie reste la même pour les cibles de morphose."""
        keep, remap, seen = [], {}, {}
        for i, p in enumerate(self.verts):
            key = (round(p.x, digits), round(p.y, digits), round(p.z, digits))
            if key not in seen:
                seen[key] = len(keep)
                keep.append(i)
            remap[i] = seen[key]
        faces, tags, known = [], [], set()
        for f, t in zip(self.faces, self.tags):
            g = []
            for i in f:
                if remap[i] not in g:
                    g.append(remap[i])
            if len(g) >= 3 and frozenset(g) not in known:
                known.add(frozenset(g))
                faces.append(tuple(g))
                tags.append(t)
        self.verts = [self.verts[i] for i in keep]
        self.weights = [self.weights[i] for i in keep]
        self.faces, self.tags = faces, tags

    def ellipsoid(self, centre, radii, tg, wfn, n=14, m=9, rot=None, off=0.0, keep=None):
        """Ellipsoïde (lobe); rot: angles d'Euler en degrés autour de son centre."""
        start = len(self.verts)
        st = []
        for i in range(1, m):
            a = -math.pi / 2 + math.pi * i / m
            st.append((centre + Z * ((radii.z + off) * math.sin(a)), Z, X, (radii.x + off) * math.cos(a), (radii.y + off) * math.cos(a)))
        self.sweep(st, n, tg, wfn, cap0=keep is None, cap1=keep is None, keep=keep)
        if keep is None:
            self.verts[-2] = centre - Z * (radii.z + off)
            self.verts[-1] = centre + Z * (radii.z + off)
        if rot:
            m3 = Euler([math.radians(a) for a in rot]).to_matrix()
            for i in range(start, len(self.verts)):
                self.verts[i] = centre + m3 @ (self.verts[i] - centre)

    def to_object(self, name, rig, morphs=None, sharp=60.0):
        """Crée l'objet à peau. morphs: {nom: liste de positions} de même topologie (cibles de morphose)."""
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        if self.cut:
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=self.cut[0], plane_no=self.cut[1], clear_inner=True)
            bm.to_mesh(me)
            bm.free()
            tags = [self.tags[0]] * len(me.polygons)
        else:
            tags = self.tags
        uv = me.uv_layers.new(name="UVMap")
        col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
        cache = {}
        for p, (zone, color, region) in zip(me.polygons, tags):
            p.use_smooth = True
            rgb = cache.setdefault(color, srgb(color))
            for li in p.loop_indices:
                uv.data[li].uv = ((zone + 0.5) / 8, section_v(region))
                col.data[li].color = (*rgb, 1.0)
        me.color_attributes.active_color = col
        me.set_sharp_from_angle(angle=math.radians(sharp))
        mat = bpy.data.materials.get("figurine")
        if mat is None:
            mat = bpy.data.materials.new("figurine")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes["Principled BSDF"]
            bsdf.inputs["Roughness"].default_value = 0.85
            attr = mat.node_tree.nodes.new("ShaderNodeVertexColor")
            attr.layer_name = "Color"
            mat.node_tree.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
        me.materials.append(mat)
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        groups = {}
        if not self.cut:
            for i, w in enumerate(self.weights):
                total = sum(w.values())
                for bone, x in w.items():
                    if x > 1e-4:
                        if bone not in groups:
                            groups[bone] = o.vertex_groups.new(name=bone)
                        groups[bone].add([i], x / total, "REPLACE")
        else:  # après une coupe, la pièce est rigide: l'os du premier sommet
            bone = next(iter(self.weights[0]))
            o.vertex_groups.new(name=bone).add(list(range(len(me.vertices))), 1.0, "REPLACE")
        if morphs:
            o.shape_key_add(name="Basis")
            for key, positions in morphs.items():
                if len(positions) != len(me.vertices):
                    raise SystemExit(f"{name}: la cible {key} n'a pas la topologie de la base")
                if max((a - b).length for a, b in zip(positions, self.verts)) < 1e-5:
                    continue
                sk = o.shape_key_add(name=key)
                for i, p in enumerate(positions):
                    sk.data[i].co = p
        o.parent = rig
        o.modifiers.new("Armature", "ARMATURE").object = rig
        return o


def limb_stations(p0, p1, r0, r1, hint, round0, round1, off=0.0, t0=0.0, t1=1.0, cuts=10, k=3):
    """Gélule de p0 à p1 (bouts arrondis au choix), limitée à la portion [t0, t1] de sa longueur."""
    d = (p1 - p0).normalized()
    st = []
    if round0 and t0 <= 0:
        for i in range(k, 0, -1):
            a = math.pi / 2 * i / (k + 0.4)
            st.append((p0 - d * ((r0 + off) * math.sin(a)), d, hint, (r0 + off) * math.cos(a), (r0 + off) * math.cos(a)))
    count = max(1, round(cuts * (t1 - t0)))
    for i in range(count + 1):
        t = t0 + (t1 - t0) * i / count
        r = r0 + (r1 - r0) * t + off
        st.append((p0 + (p1 - p0) * t, d, hint, r, r))
    if round1 and t1 >= 1:
        for i in range(1, k + 1):
            a = math.pi / 2 * i / (k + 0.4)
            st.append((p1 + d * ((r1 + off) * math.sin(a)), d, hint, (r1 + off) * math.cos(a), (r1 + off) * math.cos(a)))
    return st


def rim(stations, depth, start=False, end=False, bulge=0.0):
    """Ferme le bord d'une coque vers le corps: un anneau rentré de `depth` (bord épais), bourrelet au choix."""
    st = list(stations)
    for flag, index in ((end, -1), (start, 0)):
        if not flag:
            continue
        c, d, hint, ru, rv = st[index]
        edge = (c, d, hint, ru + bulge, rv + bulge)
        inner = (c, d, hint, max(ru - depth, 0.004), max(rv - depth, 0.004))
        if index == -1:
            st[-1] = edge
            st.append(inner)
        else:
            st[0] = edge
            st.insert(0, inner)
    return st
