"""Outils communs des voies C et D: volumes balayés (Builder), couleurs du nuancier, visage simple posé sur une tête."""
import math

import bpy
from mathutils import Vector

# Repères de l'adulte de la bible (2.1), en mètres.
H, HEAD_H, HEAD_W = 1.70, 0.34, 0.315
CHIN, COLLAR, WAIST, CROTCH, KNEE, ANKLE = 1.36, 1.325, 0.983, 0.80, 0.462, 0.10
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))


def srgb(hexa):
    c = [int(hexa[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


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


class Builder:
    """Accumule des volumes balayés: sommets, poids, faces, zone ou couleur de chaque face."""

    def __init__(self):
        self.verts, self.weights, self.faces, self.tags = [], [], [], []
        self.cut = None  # (point, normale): ne garder que le côté de la normale (coupe nette)

    def sweep(self, stations, n, tag, wfn, cap0=False, cap1=False, keep=None):
        """stations: [(centre, direction, repère u, rayon u, rayon v)]; tag: nom ou fonction du centre de face."""
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
                if keep is None or keep(centre):
                    self.faces.append(f)
                    self.tags.append(tag(centre) if callable(tag) else tag)
        for flag, ring, st, flip in ((cap0, rings[0], stations[0], True), (cap1, rings[-1], stations[-1], False)):
            if flag:
                i = len(self.verts)
                self.verts.append(st[0].copy())
                self.weights.append(wfn(st[0]))
                for j in range(n):
                    k = (j + 1) % n
                    f = (i, ring[k], ring[j]) if flip else (i, ring[j], ring[k])
                    self.faces.append(f)
                    self.tags.append(tag(st[0]) if callable(tag) else tag)

    def ellipsoid(self, centre, radii, tag, wfn, n=20, m=12, keep=None, off=0.0):
        st = []
        for i in range(1, m):
            a = -math.pi / 2 + math.pi * i / m
            st.append((centre + Z * ((radii.z + off) * math.sin(a)), Z, X, (radii.x + off) * math.cos(a), (radii.y + off) * math.cos(a)))
        self.sweep(st, n, tag, wfn, cap0=keep is None, cap1=keep is None, keep=keep)
        if keep is None:
            self.verts[-2] = centre - Z * (radii.z + off)
            self.verts[-1] = centre + Z * (radii.z + off)

    def to_object(self, name, colors, rig, thickness=0.0):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        slots = []
        for t in self.tags:
            if t not in slots:
                slots.append(t)
        for t in slots:
            mat = bpy.data.materials.get(f"{name}__{t}") or bpy.data.materials.new(f"{name}__{t}")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes["Principled BSDF"]
            bsdf.inputs["Base Color"].default_value = (*srgb(colors[t][0]), 1)
            bsdf.inputs["Roughness"].default_value = colors[t][1]
            if not name.startswith("corps"):
                mat.name = f"{name}__{t}"
            else:
                mat.name = f"corps_{t}"
            me.materials.append(mat)
        for p, t in zip(me.polygons, self.tags):
            p.material_index = slots.index(t)
            p.use_smooth = True
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        groups = {}
        for i, w in enumerate(self.weights):
            total = sum(w.values())
            for bone, x in w.items():
                if x > 1e-4:
                    groups.setdefault(bone, o.vertex_groups.new(name=bone) if bone not in groups else groups[bone]).add([i], x / total, "REPLACE")
        bpy.context.view_layer.objects.active = o
        if self.cut:
            import bmesh
            bm = bmesh.new()
            bm.from_mesh(me)
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=self.cut[0], plane_no=self.cut[1], clear_inner=True)
            bm.to_mesh(me)
            bm.free()
        if thickness:
            mod = o.modifiers.new("epaisseur", "SOLIDIFY")
            mod.thickness = thickness
            mod.offset = 1.0
            bpy.ops.object.modifier_apply(modifier=mod.name)
            for p in o.data.polygons:
                p.use_smooth = True
            o.data.set_sharp_from_angle(angle=math.radians(55))
        o.parent = rig
        o.modifiers.new("Armature", "ARMATURE").object = rig
        return o


W_HEAD = lambda p: {"Head": 1.0}  # noqa: E731


def face_features(b, surface, hair_tag="sourcils"):
    """Visage simple posé sur la tête: yeux en perles, sourcils en boudins, bouche en arc (bible 2.3, version courte)."""
    eye_z = H - HEAD_H * 0.56
    for s in (-1, 1):
        ex = s * 0.052
        b.ellipsoid(Vector((ex, surface(ex, eye_z) + 0.004, eye_z)), Vector((0.014, 0.012, 0.017)), "oeil", W_HEAD, n=10, m=8)
        pts = [Vector((s * x, 0, eye_z + 0.044 + dz)) for x, dz in ((0.028, 0.002), (0.052, 0.007), (0.076, 0.003))]
        for p in pts:
            p.y = surface(p.x, p.z) - 0.003
        st = [(pts[0], pts[1] - pts[0], Z, 0.004, 0.004), (pts[0] + (pts[1] - pts[0]) * 0.15, pts[1] - pts[0], Z, 0.0065, 0.0065),
              (pts[1], pts[2] - pts[0], Z, 0.007, 0.007), (pts[2] - (pts[2] - pts[1]) * 0.15, pts[2] - pts[1], Z, 0.0065, 0.0065), (pts[2], pts[2] - pts[1], Z, 0.004, 0.004)]
        b.sweep(st, 8, hair_tag, W_HEAD, cap0=True, cap1=True)
    mouth_z = CHIN + HEAD_H * 0.24
    xs = [-0.034, -0.02, 0.0, 0.02, 0.034]
    pts = [Vector((x, surface(x, mouth_z + 9 * x * x) - 0.002, mouth_z + 9 * x * x)) for x in xs]
    st = []
    for i, p in enumerate(pts):
        d = pts[min(i + 1, 4)] - pts[max(i - 1, 0)]
        st.append((p, d, Z, 0.0035 if i in (0, 4) else 0.006, 0.0035 if i in (0, 4) else 0.006))
    b.sweep(st, 8, "bouche", W_HEAD, cap0=True, cap1=True)
