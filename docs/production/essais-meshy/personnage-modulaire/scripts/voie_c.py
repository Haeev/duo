"""Voie C: personnage généré d'après un gabarit de la bible (image vers 3D, texture meshy-n1), riggé par Meshy,
ramené sur le squelette commun, puis découpé en pièces d'après les couleurs de sa texture.

1. chaque os du donneur est posé sur l'os commun de même nom (position, orientation, longueur), le maillage est figé;
2. la tête est mise à la hauteur de la bible (34 cm);
3. chaque face lit sa couleur dans la texture de Meshy et prend l'emplacement le plus proche de la fiche (peau,
   cheveux, haut, bas, chaussures); le dos, laissé noir par meshy-n1, et les traits d'encre suivent leurs voisines;
   la texture est jetée;
4. une pièce par emplacement (tête, mains, cheveux, haut, bas, chaussures), matière lisse du nuancier;
5. visage simple posé sur la tête (même fonction que la voie D), par lancer de rayon.

Usage: duo-python voie_c.py <fiche.json> <corps commun .glb> <Character_output.glb> <dossier de sortie> <préfixe>
"""
import json
import os
import sys

import bpy
import bmesh  # après bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figurine import CHIN, COLLAR, HEAD_H, Builder, face_features, srgb  # noqa: E402

FICHE, BODY, DONOR, OUT, PREFIX = sys.argv[1:6]
with open(FICHE, encoding="utf-8") as fh:
    conf = json.load(fh)["conformity"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BODY)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
for o in list(bpy.context.scene.objects):
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
rig.animation_data_clear()
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)
target = {b.name: (b.matrix_local.copy(), b.length) for b in rig.data.bones}

before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=DONOR)
new = set(bpy.data.objects) - before
donor_rig = next(o for o in new if o.type == "ARMATURE")
donor = next(o for o in new if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers))
for o in new - {donor_rig, donor}:
    bpy.data.objects.remove(o, do_unlink=True)
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)
donor_rig.animation_data_clear()
bpy.ops.object.select_all(action="DESELECT")
donor_rig.select_set(True)
donor.select_set(True)
bpy.context.view_layer.objects.active = donor_rig
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

names = [g.name for g in donor.vertex_groups]
head_group = names.index("Head")
head_zs = [v.co.z for v in donor.data.vertices if any(g.group == head_group and g.weight > 0.6 for g in v.groups)]
bpy.ops.object.mode_set(mode="EDIT")
for eb in donor_rig.data.edit_bones:
    eb.inherit_scale = "NONE"
bpy.ops.object.mode_set(mode="OBJECT")
girth = conf.get("largeur", 1.0) * target["Head"][0].translation.z / donor_rig.data.bones["Head"].head_local.z
head_scale = conf.get("tete", 1.0) * HEAD_H / (max(head_zs) - min(head_zs))
for pb in sorted(donor_rig.pose.bones, key=lambda pb: len(pb.bone.parent_recursive)):
    mat, length = target[pb.name]
    is_head = pb.name in ("Head", "head_end", "headfront")
    along = head_scale if is_head else length / pb.bone.length
    side = head_scale if is_head else girth
    pb.matrix = mat @ Matrix.Diagonal((side, along, side, 1.0))
    bpy.context.view_layer.update()
bpy.context.view_layer.objects.active = donor
bpy.ops.object.modifier_apply(modifier=donor.modifiers[0].name)
bpy.data.objects.remove(donor_rig, do_unlink=True)

# couleur de chaque face, lue dans la texture de Meshy
me = donor.data
image = next(n.image for m in me.materials if m for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
w, h = image.size
pixels = list(image.pixels)
slots = conf["emplacements"]  # nom -> couleur de la référence
ref = {k: [int(v[i:i + 2], 16) / 255 for i in (1, 3, 5)] for k, v in slots.items()}
ref["encre"] = [0.17, 0.16, 0.2]
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
bm.faces.ensure_lookup_table()
bm.faces.index_update()
uv = bm.loops.layers.uv.active
label = {}
for f in bm.faces:
    u = sum(l[uv].uv.x for l in f.loops) / len(f.loops)
    v = sum(l[uv].uv.y for l in f.loops) / len(f.loops)
    i = (int(v % 1 * h) * w + int(u % 1 * w)) * 4
    c = pixels[i:i + 3]
    label[f.index] = min(ref, key=lambda k: sum((a - b) ** 2 for a, b in zip(ref[k], c)))
# meshy-n1 ne peint que la face vue: le dos sort noir. Les faces sombres prennent, de proche en proche, la couleur de
# leurs voisines déjà classées (remplissage par vagues), puis les faces isolées suivent la majorité.
for _ in range(120):
    todo = [f for f in bm.faces if label[f.index] == "encre"]
    if not todo:
        break
    new_label = dict(label)
    for f in todo:
        votes = [label[g.index] for e in f.edges for g in e.link_faces if g is not f and label[g.index] != "encre"]
        if votes:
            new_label[f.index] = max(set(votes), key=votes.count)
    if new_label == label:
        break
    label = new_label
for _ in range(2):
    new_label = {}
    for f in bm.faces:
        votes = [label[g.index] for e in f.edges for g in e.link_faces if g is not f]
        mine = label[f.index]
        if votes and votes.count(mine) == 0:
            mine = max(set(votes), key=votes.count)
        new_label[f.index] = mine
    label = new_label
deform = bm.verts.layers.deform.verify()
neck_z = target["neck"][0].translation.z


def piece_of(f):
    k = label[f.index]
    if k in ("peau", "encre"):
        return "tete" if f.calc_center_median().z > neck_z - 0.03 else "mains"
    return k


parts = {}
for f in bm.faces:
    parts.setdefault(piece_of(f), []).append(f.index)
stats = {k: len(v) for k, v in parts.items()}
bm.to_mesh(me)
bm.free()

CATEGORY = {"tete": "tete", "mains": "mains", "cheveux": "cheveux", "haut": "haut", "bas": "bas", "chaussures": "chaussures"}
COLOR = {"tete": "peau", "mains": "peau"}
os.makedirs(OUT, exist_ok=True)
report = {"donneur": PREFIX, "faces_par_piece": stats, "pieces": {}}
for part, face_ids in parts.items():
    o = donor.copy()
    o.data = me.copy()
    bpy.context.scene.collection.objects.link(o)
    b2 = bmesh.new()
    b2.from_mesh(o.data)
    b2.faces.ensure_lookup_table()
    keep = set(face_ids)
    bmesh.ops.delete(b2, geom=[f for f in b2.faces if f.index not in keep], context="FACES")
    if conf.get("lissage"):
        bmesh.ops.smooth_vert(b2, verts=[v for v in b2.verts if not v.is_boundary], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    b2.to_mesh(o.data)
    b2.free()
    mat = bpy.data.materials.new(f"{part}__{COLOR.get(part, part)}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*srgb(slots[COLOR.get(part, part)]), 1)
    bsdf.inputs["Roughness"].default_value = 0.85
    o.data.materials.clear()
    o.data.materials.append(mat)
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = rig
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_world = rig.matrix_world.copy()
    for m in list(o.modifiers):
        o.modifiers.remove(m)
    o.modifiers.new("Armature", "ARMATURE").object = rig
    o.name = part
    objs = [o]
    if part == "tete":
        verts = [v.co.copy() for v in o.data.vertices]
        bvh = BVHTree.FromPolygons(verts, [tuple(p.vertices) for p in o.data.polygons])

        def surface(x, z):
            hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))[0]
            return hit.y if hit else -0.15
        fb = Builder()
        face_features(fb, surface)
        objs.append(fb.to_object("visage", {"oeil": ("#2B2A33", 0.25), "sourcils": (slots["cheveux"], 0.85), "bouche": ("#A2473F", 0.55)}, rig))
    o["categorie"] = CATEGORY[part]
    o["masque"] = []
    bpy.ops.object.select_all(action="DESELECT")
    for x in objs:
        x.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT, f"{PREFIX}_{part}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_skins=True, export_extras=True,
                              export_animations=False, export_vertex_color="NONE", export_materials="EXPORT", export_texcoords=False)
    report["pieces"][part] = {"triangles": sum(len(p.vertices) - 2 for x in objs for p in x.data.polygons), "octets": os.path.getsize(path)}
with open(os.path.join(OUT, f"{PREFIX}_rapport.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("VOIE_C", json.dumps(report, ensure_ascii=False))
