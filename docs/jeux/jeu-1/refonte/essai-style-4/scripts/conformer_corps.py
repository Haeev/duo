"""Mise en conformité d'un corps commun riggé par Meshy (squelette duo-24) pour le style encré (bible 0.2).

Usage: duo-python conformer_corps.py <marche.glb du rig Meshy> <sortie.blend> <donnees.npz> <fiche du corps .toml>

Essai 4: tout ce qui est propre à un corps vient de sa fiche (gabarits/corps/<gabarit>.toml): triangles,
échelle des mains, des pieds et de la tête (environ 7 têtes), et repères du visage (yeux, bouche, écart
des yeux) relevés sur ce corps: le visage dessiné tombe sur le visage modelé.

Étapes (une fois par corps; tout le reste, tenues, visages, coiffures, n'est plus que données et textures):
- soude les sommets (le rig de Meshy rend un sommet par coin), mains et pieds +15 % (bible 2.1);
- réduit à ~2 300 triangles visibles (bible 2.2: environ 3 000 visibles, la coque d'encre double le compte);
- deux matériaux sur le même atlas: `corps` et `tete` (la tête lit en plus l'atlas commun des traits);
- UV rangés dans les bandes de l'atlas de 512 px (bible 2.7): A tête (384 px, cheveux à droite),
  B haut (torse et bras), C bas (bassin, jambes, mains, pieds), D libre (couche 2);
- seconde coordonnée `UVTraits`: projection de face du visage dans une cellule de l'atlas des traits;
- occlusion cuite (ombres peintes et noirs pleins), clips `marche` (Meshy) et `repos` (pose naturelle,
  asymétrique: poids sur une jambe, tête penchée, un coude plié);
- données de peinture: par coin, UV, position et normale de repos (mètres, Z en haut, avant -Y),
  région, os dominant; repères du visage.
"""
import sys

import bpy
import numpy as np
from bpy_extras import mesh_utils
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
src, out_blend, out_npz = args[:3]
import tomllib  # noqa: E402

FICHE = tomllib.load(open(args[3], "rb"))
target_tris = int(FICHE.get("triangles", 2300))
# Échelles autour de l'articulation (1 = tel que généré): mains, pieds, tête.
ECH = {"main": float(FICHE.get("mains", 1.0)), "pied": float(FICHE.get("pieds", 1.0)), "tete": float(FICHE.get("tete", 1.0))}

TETE = {"Head", "head_end", "headfront", "neck"}
BAS = {"Hips", "LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase", "RightUpLeg", "RightLeg", "RightFoot",
       "RightToeBase", "LeftHand", "RightHand"}
# Bandes de l'atlas (u0, v0, u1, v1), v vers le haut comme dans Blender; bible 2.7, de haut en bas A, B, C, D.
BANDES = {0: (0.0, 0.75, 0.75, 1.0), 1: (0.0, 0.4375, 1.0, 0.75), 2: (0.0, 0.1875, 1.0, 0.4375)}
MARGE = 3 / 512

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.context.scene.objects):
    if o.name.startswith("Icosphere"):
        bpy.data.objects.remove(o)
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
me = next(o for o in bpy.context.scene.objects if o.type == "MESH")
walk = arm.animation_data.action if arm.animation_data else None
arm.animation_data_clear()
if walk:
    walk.use_fake_user = True
bpy.context.view_layer.update()

import bmesh  # noqa: E402  (après bpy: sous duo-python, l'ordre compte)

mesh = me.data
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)  # unités locales: centimètres
bm.to_mesh(mesh)
bm.free()

# Mains et pieds agrandis autour de leur articulation (poignet, cheville), selon le poids de l'os.
inv = me.matrix_world.inverted()
gidx = {g.name: g.index for g in me.vertex_groups}
for bones, piv, quoi in ((("LeftHand",), "LeftHand", "main"), (("RightHand",), "RightHand", "main"),
                         (("LeftFoot", "LeftToeBase"), "LeftFoot", "pied"), (("RightFoot", "RightToeBase"), "RightFoot", "pied"),
                         (("Head", "head_end", "headfront"), "Head", "tete")):
    pivot = inv @ (arm.matrix_world @ arm.data.bones[piv].head_local)
    ids = {gidx[b] for b in bones if b in gidx}
    for v in mesh.vertices:
        w = sum(g.weight for g in v.groups if g.group in ids)
        if w > 0:
            v.co = pivot + (v.co - pivot) * (1 + (ECH[quoi] - 1) * min(w, 1.0))

# Réduction: effondrement d'arêtes, qui garde les groupes de sommets (poids de peau).
for o in bpy.context.scene.objects:
    o.select_set(o == me)
bpy.context.view_layer.objects.active = me
tris0 = sum(len(p.vertices) - 2 for p in mesh.polygons)
dec = me.modifiers.new("reduire", "DECIMATE")
dec.ratio = min(1.0, target_tris / tris0)
dec.use_symmetry = True
dec.symmetry_axis = "X"
bpy.ops.object.modifier_move_to_index(modifier="reduire", index=0)
bpy.ops.object.modifier_apply(modifier="reduire")
bm = bmesh.new()
bm.from_mesh(mesh)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.to_mesh(mesh)
bm.free()
for p in mesh.polygons:
    p.use_smooth = True
for uv in list(mesh.uv_layers):
    mesh.uv_layers.remove(uv)

# Os dominant par sommet, région par face (A tête, B haut, C bas).
names = [g.name for g in me.vertex_groups]
dom = np.zeros(len(mesh.vertices), dtype=np.int32)
for v in mesh.vertices:
    best, w = 0, -1.0
    for g in v.groups:
        if g.weight > w:
            best, w = g.group, g.weight
    dom[v.index] = best
region = np.zeros(len(mesh.polygons), dtype=np.int32)
for p in mesh.polygons:
    votes = [0, 0, 0]
    for i in p.vertices:
        n = names[dom[i]]
        votes[0 if n in TETE else 2 if n in BAS else 1] += 1
    region[p.index] = int(np.argmax(votes))
mesh.materials.clear()
mats = []
for name in ("corps", "tete"):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    mesh.materials.append(m)
    mats.append(m)
for p in mesh.polygons:
    p.material_index = 1 if region[p.index] == 0 else 0

# Coutures: une pièce par membre (tête, torse, bras, jambes), coupée par un chemin le long d'un côté
# caché (dos de la tête, côtés du torse, dessous des bras, intérieur des jambes puis semelle).
# Chemin le plus court (Dijkstra) dont le coût pénalise l'écart à la direction voulue.
import heapq  # noqa: E402

PIECE = {}
for n in names:
    PIECE[n] = ("tete" if n in TETE else "brasG" if n.startswith("LeftArm") or n.startswith("LeftFore") or n == "LeftHand"
                else "brasD" if n.startswith("RightArm") or n.startswith("RightFore") or n == "RightHand"
                else "jambeG" if n.startswith("LeftUpLeg") or n in ("LeftLeg", "LeftFoot", "LeftToeBase")
                else "jambeD" if n.startswith("RightUpLeg") or n in ("RightLeg", "RightFoot", "RightToeBase")
                else "torse")
mw = me.matrix_world
P = [mw @ v.co for v in mesh.vertices]
piece_f = []
for p in mesh.polygons:
    votes = {}
    for i in p.vertices:
        k = PIECE[names[dom[i]]]
        votes[k] = votes.get(k, 0) + 1
    piece_f.append(max(votes, key=votes.get))
bm = bmesh.new()
bm.from_mesh(mesh)
bm.verts.ensure_lookup_table()
bm.edges.ensure_lookup_table()
bm.faces.ensure_lookup_table()
for e in bm.edges:
    fs = {piece_f[f.index] for f in e.link_faces}
    e.seam = len(fs) > 1 or len(e.link_faces) < 2


def bone_pt(name, tail=False):
    b = arm.data.bones[name]
    return arm.matrix_world @ (b.tail_local if tail else b.head_local)


def cut(piece, a, b, desired, start_hi):
    """Coupe la pièce le long de la direction voulue, d'un bord (début) au bout le plus lointain (fin)."""
    verts = {v.index for f in bm.faces if piece_f[f.index] == piece for v in f.verts}
    ab = b - a
    L2 = ab.length_squared

    def t_of(i):
        return (P[i] - a).dot(ab) / L2

    def align(i):
        t = min(max(t_of(i), 0.0), 1.0)
        r = P[i] - (a + ab * t)
        d = desired(i)
        return r.normalized().dot(d) if r.length > 1e-6 else 0.0

    border = [i for i in verts if any(e.seam for e in bm.verts[i].link_edges)]
    if start_hi is None:
        cand = [i for i in border if t_of(i) < 0.5]
        start = max(cand, key=lambda i: align(i) - 0.3 * t_of(i))
        end = max(verts, key=lambda i: t_of(i) + 0.05 * align(i))
    else:
        start = max([i for i in border if t_of(i) > 0.5], key=lambda i: align(i))
        end = max([i for i in border if t_of(i) < 0.5], key=lambda i: align(i))
    dist = {start: 0.0}
    prev = {}
    heap = [(0.0, start)]
    while heap:
        d, i = heapq.heappop(heap)
        if i == end:
            break
        if d > dist.get(i, 1e9):
            continue
        for e in bm.verts[i].link_edges:
            j = e.other_vert(bm.verts[i]).index
            if j not in verts:
                continue
            w = (P[i] - P[j]).length * (1 + 40 * (1 - 0.5 * (align(i) + align(j))) ** 2)
            if d + w < dist.get(j, 1e9):
                dist[j] = d + w
                prev[j] = (i, e)
                heapq.heappush(heap, (d + w, j))
    i = end
    while i in prev:
        i, e = prev[i]
        e.seam = True


down = Vector((0, 0, -1))
cut("tete", bone_pt("neck"), bone_pt("head_end"), lambda i: Vector((0, 1, 0)), None)
for side, sx in (("Left", 1), ("Right", -1)):
    tip = bone_pt(side + "Hand", True)
    cut("brasG" if sx > 0 else "brasD", bone_pt(side + "Arm"), tip,
        lambda i: (down - down.project(tip - bone_pt(side + "Arm"))).normalized(), None)
    cut("jambeG" if sx > 0 else "jambeD", bone_pt(side + "UpLeg"), bone_pt(side + "Foot"),
        lambda i, sx=sx: Vector((-sx, 0, 0)) if P[i].z > bone_pt(side + "Foot").z + 0.04 else down, None)
    cut("torse", bone_pt("Hips"), bone_pt("neck"), lambda i, sx=sx: Vector((sx, 0, 0)), True)
bm.to_mesh(mesh)
bm.free()
# Bandes: tête en A, torse et bras en B, jambes en C (le bassin suit le torse).
BAND_OF = {"tete": 0, "torse": 1, "brasG": 1, "brasD": 1, "jambeG": 2, "jambeD": 2}
region = np.array([BAND_OF[k] for k in piece_f], dtype=np.int32)
for p in mesh.polygons:
    p.material_index = 1 if region[p.index] == 0 else 0

# Constaté: la projection intelligente lancée dans la session de l'import laisse des triangles sans aire
# en UV; après un enregistrement et une réouverture, elle est saine. On passe donc par le disque.
walk_name = walk.name if walk else None
for p in mesh.polygons:
    p.select = False
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
bpy.ops.wm.open_mainfile(filepath=out_blend)
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
me = next(o for o in bpy.context.scene.objects if o.type == "MESH")
mesh = me.data
mats = list(mesh.materials)
walk = bpy.data.actions.get(walk_name) if walk_name else None
for o in bpy.context.scene.objects:
    o.select_set(o == me)
bpy.context.view_layer.objects.active = me
mesh.uv_layers.new(name="UVMap")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.unwrap(method="MINIMUM_STRETCH", fill_holes=True, margin=0.0, iterations=40)
bpy.ops.object.mode_set(mode="OBJECT")

# Rangement des îlots par région dans sa bande: étagères, même densité pour toutes les régions
# (la plus grande échelle qui fait tout tenir), îlot couché si plus haut que large.
uvd = mesh.uv_layers["UVMap"].data
islands = mesh_utils.mesh_linked_uv_islands(mesh)
by_region = {0: [], 1: [], 2: []}
for isl in islands:
    loops = [li for f in isl for li in mesh.polygons[f].loop_indices]
    pts = np.array([uvd[li].uv[:] for li in loops])
    lo, hi = pts.min(0), pts.max(0)
    size = hi - lo
    rot = size[1] > size[0]
    by_region[int(np.bincount([region[f] for f in isl]).argmax())].append((loops, lo, size, rot))


def shelf(items, width, height, s):
    """Rang des îlots sur des étagères à l'échelle s; rend les positions ou None si ça déborde."""
    order = sorted(range(len(items)), key=lambda k: -(items[k][2][0] if items[k][3] else items[k][2][1]))
    x = y = row_h = 0.0
    pos = {}
    for k in order:
        w, h = (items[k][2][::-1] if items[k][3] else items[k][2]) * s
        w, h = w + MARGE, h + MARGE
        if x + w > width:
            x, y, row_h = 0.0, y + row_h, 0.0
        if y + h > height or w > width:
            return None
        pos[k] = (x, y)
        x += w
        row_h = max(row_h, h)
    return pos


def best_scale(items, rect):
    lo, hi = 0.0, 10.0
    for _ in range(40):
        mid = (lo + hi) / 2
        if shelf(items, rect[2] - rect[0], rect[3] - rect[1], mid) is None:
            hi = mid
        else:
            lo = mid
    return lo


# Chaque bande prend sa propre échelle (la tête, petite, gagne en densité: c'est elle qu'on regarde).
scales = {r: best_scale(by_region[r], BANDES[r]) for r in BANDES}
scale = min(scales.values())
for r, items in by_region.items():
    rect = BANDES[r]
    scale = scales[r]
    pos = shelf(items, rect[2] - rect[0], rect[3] - rect[1], scale)
    for k, (loops, lo, size, rot) in enumerate(items):
        px, py = pos[k]
        for li in loops:
            u, v = (Vector(uvd[li].uv) - Vector(lo))
            if rot:
                u, v = v, size[0] - u
            uvd[li].uv = (rect[0] + px + MARGE / 2 + u * scale, rect[1] + py + MARGE / 2 + v * scale)

# Repères du visage (bible 2.4: fractions de la hauteur de tête depuis le sommet), en mètres.
mw = me.matrix_world
head_v = [mw @ mesh.vertices[i].co for p in mesh.polygons if region[p.index] == 0 for i in p.vertices]
top = max(v.z for v in head_v)
front = [v for v in head_v if abs(v.x) < 0.015 and v.y < 0]
nose = min((v for v in front if v.z > top - 0.25), key=lambda v: v.y)
# Menton: le point le plus avancé sous le nez (le cou, plus bas, est en retrait).
chin = min((v for v in front if nose.z - 0.11 < v.z < nose.z - 0.035), key=lambda v: v.y).z - 0.008
hh = top - chin
# Yeux et bouche calés sur le nez mesuré (le visage stylisé de Meshy ne suit pas les fractions de la bible).
# Repères du visage: estimés d'après le nez, puis corrigés par la fiche du corps ([visage], en fractions de
# la hauteur de tête depuis le sommet du crâne; écart = demi-distance entre les yeux, en mètres).
V = FICHE.get("visage", {})
if "menton" in V:
    chin = top - V["menton"] * ECH["tete"]
    hh = top - chin
yeux = top - V["yeux"] * hh if "yeux" in V else nose.z + 0.26 * hh
bouche = top - V["bouche"] * hh if "bouche" in V else nose.z - 0.13 * hh
ecart = float(V.get("ecart", 0.145)) * hh
face = {"top": top, "chin": chin, "hauteur": hh, "yeux": yeux, "bouche": bouche,
        "nez": (nose.x, nose.y, nose.z), "centre_y": float(np.mean([v.y for v in head_v]))}
# Cellule des traits: yeux à v 0,80 et bouche à v 0,20, demi-écart des yeux à 0,235 de la largeur.
cell = (yeux - bouche) / 0.6
cell_w = ecart / 0.235
cz = (face["yeux"] + face["bouche"]) / 2
uvt = mesh.uv_layers.new(name="UVTraits").data
for p in mesh.polygons:
    for li, vi in zip(p.loop_indices, p.vertices):
        co = mw @ mesh.vertices[vi].co
        if region[p.index] == 0 and co.y < face["centre_y"]:
            uvt[li].uv = (0.5 + co.x / cell_w, 0.5 + (co.z - cz) / cell)
        else:
            uvt[li].uv = (-4.0, -4.0)
mesh.uv_layers.active = mesh.uv_layers["UVMap"]
mesh.uv_layers["UVMap"].active_render = True

# Occlusion cuite dans l'atlas (Cycles): elle place ombres peintes et noirs pleins.
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
scene.world = bpy.data.worlds.new("w")
scene.world.light_settings.distance = 0.25
ao = bpy.data.images.new("atlas_ao", 512, 512)
atlas = bpy.data.images.new("atlas", 512, 512)
for m in mats:
    nodes = m.node_tree.nodes
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = atlas
    m.node_tree.links.new(tex.outputs["Color"], nodes["Principled BSDF"].inputs["Base Color"])
    nodes["Principled BSDF"].inputs["Roughness"].default_value = 1.0
    bake = nodes.new("ShaderNodeTexImage")
    bake.image = ao
    nodes.active = bake
scene.render.bake.margin = 4
bpy.ops.object.bake(type="AO")
ao.filepath_raw = out_npz.replace(".npz", "-ao.png")
ao.file_format = "PNG"
ao.save()
from PIL import Image as _PIL  # noqa: E402  (niveaux de gris 8 bits: quatre fois moins lourd à versionner)

_PIL.open(ao.filepath_raw).convert("L").save(ao.filepath_raw, optimize=True)
for m in mats:
    for node in [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image == ao]:
        m.node_tree.nodes.remove(node)
bpy.data.images.remove(ao)

# Données de peinture.
nm = mw.to_3x3().inverted().transposed()
rows = []
for p in mesh.polygons:
    for li, vi in zip(p.loop_indices, p.vertices):
        co = mw @ mesh.vertices[vi].co
        n = (nm @ mesh.corner_normals[li].vector).normalized()
        rows.append((*uvd[li].uv, *co, *n, region[p.index], dom[vi]))
data = np.array(rows, dtype=np.float32)
data16 = data.astype(np.float16)   # versionné en demi-précision (0,1 mm près): deux fois moins lourd
tri = data[:, :2].reshape(-1, 3, 2)
e1, e2 = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
uv_nuls = int((np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) < 1e-9).sum())
bones = {b.name: tuple(arm.matrix_world @ b.head_local) for b in arm.data.bones}
tails = {b.name: tuple(arm.matrix_world @ b.tail_local) for b in arm.data.bones}

# Clip de repos, en repère de l'armature (avant -Y, gauche +X).
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")


# Directions et axes donnés dans le repère du monde (Z en haut, avant -Y), convertis dans celui de
# l'armature (l'import glTF peut la tourner; elle est à l'échelle 0,01).
TO_ARM = arm.matrix_world.to_3x3().normalized().inverted()


def aim(pb, direction):
    m = pb.matrix.copy()
    d = (TO_ARM @ direction).normalized()
    rot = m.col[1].xyz.normalized().rotation_difference(d).to_matrix().to_4x4()
    head = m.translation.copy()
    pb.matrix = Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()


def turn(pb, axis, degrees):
    m = pb.matrix.copy()
    head = m.translation.copy()
    ax = TO_ARM @ Vector({"X": (1, 0, 0), "Y": (0, 1, 0), "Z": (0, 0, 1)}[axis])
    rot = Matrix.Rotation(np.radians(degrees), 4, ax.normalized())
    pb.matrix = Matrix.Translation(head) @ rot @ Matrix.Translation(-head) @ m
    bpy.context.view_layer.update()


rest = bpy.data.actions.new("repos")
arm.animation_data_create()
arm.animation_data.action = rest
pb = arm.pose.bones
turn(pb["Hips"], "Y", -3)          # bassin basculé: poids sur la jambe droite
turn(pb["Spine01"], "Y", 5)
turn(pb["neck"], "Y", -4)
turn(pb["Head"], "Y", -6)          # tête penchée
turn(pb["Head"], "Z", 8)
aim(pb["LeftArm"], Vector((0.20, 0.05, -1)))
aim(pb["LeftForeArm"], Vector((0.10, -0.25, -1)))
aim(pb["LeftHand"], Vector((0.06, -0.2, -1)))
aim(pb["RightArm"], Vector((-0.22, 0.12, -1)))
aim(pb["RightForeArm"], Vector((-0.05, -0.55, -0.85)))   # coude plié d'un tiers, main vers l'avant
aim(pb["RightHand"], Vector((-0.02, -0.45, -0.9)))
aim(pb["LeftUpLeg"], Vector((0.10, -0.06, -1)))          # jambe libre, genou un peu avancé
aim(pb["LeftLeg"], Vector((0.04, 0.10, -1)))
for b in pb:
    b.keyframe_insert("rotation_quaternion", frame=0)
    b.keyframe_insert("location", frame=0)
bpy.ops.object.mode_set(mode="OBJECT")
arm.animation_data.action = None
for b in pb:
    b.matrix_basis = Matrix.Identity(4)
for action, name in ((walk, "marche"), (rest, "repos")):
    if action is None:
        continue
    action.name = name
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, int(action.frame_range[0]), action)

np.savez_compressed(out_npz, corners=data16, bone_names=np.array(list(bones)), bone_heads=np.array(list(bones.values())),
         bone_tails=np.array(list(tails.values())), vgroups=np.array(names),
         face=np.array([face["top"], face["chin"], face["hauteur"], face["yeux"], face["bouche"], *face["nez"],
                        face["centre_y"], cell, cz, cell_w, ecart]))
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
tris = sum(len(p.vertices) - 2 for p in mesh.polygons)
print("CONFORME", src, "ilots", len(islands), "uv_nuls", uv_nuls, "triangles", tris, "par region", np.bincount(region).tolist(), "echelles UV", {k: round(v, 3) for k, v in scales.items()},
      "texels par metre", round(scale * 512, 1), "tete", round(hh, 3), "tetes", round(top / hh, 2),
      "hauteur", round(top, 3), "yeux", round((top - yeux) / hh, 3), "bouche", round((top - bouche) / hh, 3),
      "nez", round((top - nose.z) / hh, 3), "ecart", round(ecart, 4))
