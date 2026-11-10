"""Coiffure encrée en masses: une calotte anguleuse plus de vraies mèches découpées, d'après une fiche TOML.

Usage: duo-python coiffure.py <corps.blend> <corps.npz> <fiche.toml> <sortie.glb> <donnees.npz>

- La calotte est une coque posée par rayons sur le crâne du corps (elle va donc à toutes les têtes), au bord
  en dents.
- Chaque mèche est une lame à section triangulaire (deux pans, une arête, un dessous) qui part de la calotte,
  suit le crâne, tombe, s'écarte ou se dresse selon la fiche, et finit en pointe. Ce sont elles qui découpent
  la silhouette: la coque d'encre cerne chaque pointe.
- Les boules (chignon, couette) sont des polyèdres bas.
Toutes les longueurs de la fiche sont en hauteurs de tête: la même fiche coiffe l'enfant et le costaud.
UV dans la cellule des cheveux de l'atlas (bande A, à droite): calotte en haut, mèches en bandes en bas.
"""
import math
import sys
import tomllib

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
blend, corps_npz, fiche_path, out_glb, out_npz = args[:5]
f = tomllib.load(open(fiche_path, "rb"))
CELL = (0.75, 0.75, 1.0, 1.0)  # cellule des cheveux dans l'atlas (u0, v0, u1, v1)

bpy.ops.wm.open_mainfile(filepath=blend)
body = next(o for o in bpy.context.scene.objects if o.type == "MESH")
mw = body.matrix_world
mesh = body.data
verts, polys = [], []
for p in mesh.polygons:
    if p.material_index == 1:
        polys.append([len(verts), len(verts) + 1, len(verts) + 2])
        verts.extend(mw @ mesh.vertices[i].co for i in p.vertices)
bvh = BVHTree.FromPolygons(verts, polys)
all_v = [mw @ v.co for v in mesh.vertices]
bvh_all = BVHTree.FromPolygons(all_v, [list(p.vertices) for p in mesh.polygons])

face = np.load(corps_npz)["face"]
top, hh = float(face[0]), float(face[2])
hv = np.array([[v.x, v.y, v.z] for v in verts])
crane = hv[hv[:, 2] > top - 0.5 * hh]
centre = Vector((0.0, float((crane[:, 1].min() + crane[:, 1].max()) / 2), top - 0.42 * hh))
rng = np.random.default_rng(int(f.get("graine", 7)))
H = hh  # unité des longueurs de la fiche


def direction(theta, phi):
    """theta autour de Z (0 = avant, -Y; positif vers la gauche du personnage, +X), phi depuis le sommet."""
    return Vector((math.sin(theta) * math.sin(phi), -math.cos(theta) * math.sin(phi), math.cos(phi)))


def skull(theta, phi):
    d = direction(theta, phi)
    hit = bvh.ray_cast(centre + d * 0.6, -d)
    return d, ((hit[0] - centre).length if hit[0] is not None else 0.38 * hh)


def clear_of_body(p, marge):
    """Repousse un point hors du corps (tête, cou, épaules), à l'horizontale depuis l'axe."""
    o = Vector((0.0, centre.y, p.z))
    h = Vector((p.x, p.y - centre.y, 0.0))
    if h.length < 1e-5:
        return p
    d = h.normalized()
    hit = bvh_all.ray_cast(o + d * 0.7, -d)
    need = ((hit[0] - o).length + marge) if hit[0] is not None else 0.0
    return o + d * max(h.length, need)


vs, fs, attrs = [], [], []   # sommets, faces, (genre, a, b) par sommet: 0 calotte, 1 mèche, 2 dessous, 3 boule


PIECE = [0]   # numéro de la pièce en cours (une mèche = une pièce: elle garde sa bande de texture)


def add(p, kind, a, b):
    vs.append(Vector(p))
    attrs.append((kind, a, b, PIECE[0]))
    return len(vs) - 1


# ---- calotte
c = f["calotte"]
cols, rows = int(c.get("colonnes", 10)), int(c.get("rangees", 4))
vol = c["volume"] * H


def bord(theta):
    """Bas de la calotte (angle depuis le sommet): front, côtés, nuque, interpolés autour de la tête."""
    a = abs(math.atan2(math.sin(theta), math.cos(theta)))
    pts = [(0.0, c["front_deg"]), (math.radians(c.get("tempes_a_deg", 55)), c["front_deg"]),
           (math.radians(95), c["cotes_deg"]), (math.pi, c["nuque_deg"])]
    for (a0, v0), (a1, v1) in zip(pts, pts[1:]):
        if a <= a1:
            k = (a - a0) / max(a1 - a0, 1e-6)
            k = k * k * (3 - 2 * k)
            return math.radians(v0 + (v1 - v0) * k)
    return math.radians(pts[-1][1])


cap = []
apex = add(centre + Vector((0, 0, skull(0, 0)[1] + vol)), 0, 0.5, 0.0)
for j in range(cols):
    theta = 2 * math.pi * j / cols
    lim = bord(theta) + math.radians(c.get("dents_deg", 6)) * (1 if j % 2 else -1)
    col = []
    for i in range(1, rows + 1):
        phi = lim * i / rows
        d, r = skull(theta, phi)
        # Facettes: une colonne sur deux est en retrait (section en étoile douce).
        k = 1.0 + c.get("aretes", 0.12) * (1 if j % 2 == 0 else -1) * min(phi / 0.6, 1.0)
        col.append(add(centre + d * (r + vol * k * (1.0 if i < rows else 0.55)), 0, j / cols, i / rows))
    cap.append(col)
for j in range(cols):
    a, b = cap[j], cap[(j + 1) % cols]
    fs.append((apex, a[0], b[0]))
    for i in range(rows - 1):
        fs.append((a[i], a[i + 1], b[i + 1]))
        fs.append((a[i], b[i + 1], b[i]))


# ---- mèches
def meche(theta0, g, k_alea):
    PIECE[0] += 1
    n_st = int(g.get("stations", 3))
    L = g["longueur"] * H * (1 + g.get("alea", 0.15) * k_alea)
    larg = g["largeur"] * H
    ep = g.get("epaisseur", 0.03) * H
    phi = math.radians(g["racine_deg"])
    theta = theta0
    d, r = skull(theta, phi)
    p = centre + d * (r + vol * 0.6)
    pts = []
    steps = 12
    sweep = math.radians(g.get("vrille_deg", 0.0))
    for s_i in range(steps + 1):
        s = s_i / steps
        n = Vector((p.x, p.y - centre.y, p.z - centre.z)).normalized()
        pts.append((p.copy(), n))
        if s_i == steps:
            break
        # Tangente au crâne vers le bas (phi croissant), déviée par la vrille; mélange avec la chute et la levée.
        d1, _ = skull(theta, phi)
        d2, _ = skull(theta + sweep / steps, phi + 0.08)
        tang = (d2 - d1)
        tang = (tang - n * tang.dot(n)).normalized() if tang.length > 1e-6 else Vector((0, 0, -1))
        chute = g.get("chute", 0.0) * s
        leve = g.get("leve", 0.0) * (0.35 + 0.65 * s)
        dirv = (tang * (1 - chute) + Vector((0, 0, -1)) * chute + n * leve).normalized()
        p = p + dirv * (L / steps)
        # Rester hors du crâne et du corps.
        hn = Vector((p.x, p.y - centre.y, p.z - centre.z))
        th, ph = math.atan2(hn.x, -hn.y), math.acos(max(-1, min(1, hn.z / max(hn.length, 1e-6))))
        _, rr = skull(th, ph)
        base = rr + vol * 0.6 + g.get("ecart", 0.0) * H * s * s
        if ph < math.radians(118) and hn.length < base:
            p = centre + hn.normalized() * base
        p = clear_of_body(p, 0.012 + g.get("ecart", 0.0) * H * s)
        theta, phi = th + sweep / steps, ph
    # Stations: racine, milieu(x), pointe.
    idx = []
    for k in range(n_st):
        s = k / n_st
        q, n = pts[round(s * steps)]
        nxt = pts[min(round(s * steps) + 1, steps)][0]
        fwd = (nxt - q).normalized()
        side = fwd.cross(n)
        side = side.normalized() if side.length > 1e-6 else Vector((1, 0, 0))
        w = larg * (1.0 - 0.55 * s ** 1.4) * (0.8 if k == 0 else 1.0)
        e = ep * (1.0 - 0.6 * s)
        dec = g.get("arete_decalee", 0.18)
        lft = add(q - side * w / 2, 1, 0.0, s)
        rgt = add(q + side * w / 2, 1, 1.0, s)
        tp = add(q + n * e + side * w * dec, 1, 0.5, s)
        l2 = add(q - side * w / 2, 2, 0.0, s)
        r2 = add(q + side * w / 2, 2, 1.0, s)
        idx.append((lft, tp, rgt, l2, r2))
    tip_p = pts[steps][0]
    tip = add(tip_p, 1, 0.5, 1.0)
    tip2 = add(tip_p, 2, 0.5, 1.0)
    for a, b in zip(idx, idx[1:]):
        fs.extend([(a[0], b[0], b[1]), (a[0], b[1], a[1]), (a[1], b[1], b[2]), (a[1], b[2], a[2]),
                   (a[3], a[4], b[4]), (a[3], b[4], b[3])])
    a = idx[-1]
    fs.extend([(a[0], tip, a[1]), (a[1], tip, a[2]), (a[3], a[4], tip2)])


n_meches = 0
for g in f.get("meches", []):
    n = int(g["nombre"])
    a0, a1 = math.radians(g["de_deg"]), math.radians(g["a_deg"])
    for k in range(n):
        t = (k + 0.5) / n
        theta = a0 + (a1 - a0) * t + math.radians(g.get("alea_deg", 4.0)) * float(rng.uniform(-1, 1))
        meche(theta, g, float(rng.uniform(-1, 1)))
        n_meches += 1
        if g.get("miroir", False):
            meche(-theta, {**g, "vrille_deg": -g.get("vrille_deg", 0.0), "arete_decalee": -g.get("arete_decalee", 0.18)},
                  float(rng.uniform(-1, 1)))
            n_meches += 1

# ---- boules (chignon, couette): octaèdre étiré, facettes franches
for b in f.get("boules", []):
    d, r = skull(math.radians(b["theta_deg"]), math.radians(b["phi_deg"]))
    o = centre + d * (r + vol + b.get("distance", 0.0) * H)
    rad = b["rayon"] * H
    up = Vector((0, 0, 1))
    t1 = d.cross(up).normalized()
    t2 = d.cross(t1).normalized()
    ring = []
    m = 6
    for k in range(m):
        a = 2 * math.pi * k / m
        ring.append(add(o + (t1 * math.cos(a) + t2 * math.sin(a) * b.get("aplati", 0.85)) * rad * (1.0 if k % 2 else 0.86), 3, k / m, 0.5))
    p_out = add(o + d * rad * b.get("long", 0.9), 3, 0.5, 1.0)
    p_in = add(o - d * rad * 0.9, 3, 0.5, 0.0)
    for k in range(m):
        fs.append((ring[k], ring[(k + 1) % m], p_out))
        fs.append((ring[(k + 1) % m], ring[k], p_in))

me = bpy.data.meshes.new("cheveux")
me.from_pydata([tuple(v) for v in vs], [], fs)
import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
# Chaque pièce (calotte, mèche, boule) est un îlot: on l'oriente vers l'extérieur de la tête d'un bloc.
bm.faces.ensure_lookup_table()
seen = set()
for start in bm.faces:
    if start.index in seen:
        continue
    isl, stack = [], [start]
    seen.add(start.index)
    while stack:
        fc = stack.pop()
        isl.append(fc)
        for e in fc.edges:
            for o2 in e.link_faces:
                if o2.index not in seen:
                    seen.add(o2.index)
                    stack.append(o2)
    ctr = sum((fc.calc_center_median() for fc in isl), Vector()) / len(isl)
    vol_s = sum(fc.normal.dot(fc.calc_center_median() - ctr) * fc.calc_area() for fc in isl)
    if len(isl) > 60:   # calotte: ouverte, on juge par rapport au centre du crâne
        vol_s = sum(fc.normal.dot(fc.calc_center_median() - centre) for fc in isl)
    if vol_s < 0:
        for fc in isl:
            fc.normal_flip()
bm.to_mesh(me)
bm.free()

# ---- UV: calotte dans la moitié haute de la cellule (u autour, v du sommet au bord), mèches en bandes
# dans la moitié basse (v le long de la mèche, 3 bandes de dessus et une de dessous), boules avec la calotte.
uvl = me.uv_layers.new(name="UVMap").data
cw, chh = CELL[2] - CELL[0], CELL[3] - CELL[1]
fi = 0
for p in me.polygons:
    kinds = [attrs[vi][0] for vi in p.vertices]
    kind = max(kinds)
    for li, vi in zip(p.loop_indices, p.vertices):
        k, a, b, piece = attrs[vi]
        if kind == 0 or kind == 3:
            if vi == apex:
                a = float(np.mean([attrs[v][1] for v in p.vertices if v != apex]))
                if max(attrs[v][1] for v in p.vertices if v != apex) - min(attrs[v][1] for v in p.vertices if v != apex) > 0.5:
                    a = 1.0 - 0.5 / cols
            elif kind == 0 and a == 0.0 and any(attrs[v][1] > 0.5 for v in p.vertices):
                a = 1.0
            uvl[li].uv = (CELL[0] + cw * (0.02 + 0.96 * a), CELL[3] - chh * (0.02 + 0.46 * b))
        elif kind == 1:
            band = piece % 3
            uvl[li].uv = (CELL[0] + cw * (0.02 + 0.96 * b), CELL[1] + chh * (0.14 + (band + 0.08 + 0.84 * a) * 0.12))
        else:
            uvl[li].uv = (CELL[0] + cw * (0.02 + 0.96 * b), CELL[1] + chh * (0.02 + 0.10 * a))
me.update()
for p in me.polygons:
    p.use_smooth = True
obj = bpy.data.objects.new("cheveux", me)
bpy.context.scene.collection.objects.link(obj)
mat = bpy.data.materials.new("cheveux")
me.materials.append(mat)
for o in bpy.context.scene.objects:
    o.select_set(o == obj)
bpy.context.view_layer.objects.active = obj
bpy.ops.export_scene.gltf(filepath=out_glb, use_selection=True, export_format="GLB", export_animations=False,
                          export_skins=False, export_materials="PLACEHOLDER", export_vertex_color="NONE")
rows_data = []
for p in me.polygons:
    kind = max(attrs[vi][0] for vi in p.vertices)
    for li, vi in zip(p.loop_indices, p.vertices):
        co = me.vertices[vi].co
        n = me.corner_normals[li].vector
        k, a, b, piece = attrs[vi]
        rows_data.append((*uvl[li].uv, co.x, co.y, co.z, n.x, n.y, n.z, a, b, kind))
np.savez_compressed(out_npz, corners=np.array(rows_data, dtype=np.float32), centre=np.array(centre), top=top)
print("COIFFURE", f["id"], "triangles", len(fs), "sommets", len(vs), "meches", n_meches)
