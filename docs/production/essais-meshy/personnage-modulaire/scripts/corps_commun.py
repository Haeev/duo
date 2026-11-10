"""Corps de base et squelette commun à partir d'un rig de Meshy (Blender 5.2, duo-python).

1. importe le personnage riggé et les clips (marche et course offertes par le rig, actions achetées);
2. applique l'échelle 0,01 du nœud Armature;
3. impose les proportions de la fiche par le squelette: une échelle par os (largeur, longueur), le maillage
   suit par sa peau, puis la pose obtenue devient la pose de repos; taille finale de la fiche, semelles au sol;
4. range les faces du corps par zone (une matière par zone) pour que le jeu masque ce qu'un vêtement couvre;
5. exporte corps.glb (peau, clips renommés) et squelette-commun.json (os, parents, têtes et queues au repos).

Usage: duo-python corps_commun.py <fiche.json> <Character_output.glb> <sortie.glb> <squelette.json> <clip>=<fichier.glb>:<index>...
"""
import json
import struct
import sys

import bpy
from mathutils import Vector

import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pm_commun import ZONES, fcurves_of, skinned_meshes, triangles  # noqa: E402

FICHE, CHARACTER, OUT, SKELETON = sys.argv[1:5]
CLIPS = [a.split("=") for a in sys.argv[5:]]
with open(FICHE, encoding="utf-8") as fh:
    conf = json.load(fh)["conformity"]


def gltf_animation_names(path):
    with open(path, "rb") as fh:
        data = fh.read()
    length = struct.unpack_from("<I", data, 12)[0]
    return [a.get("name", "") for a in json.loads(data[20:20 + length]).get("animations", [])]


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CHARACTER)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
body = skinned_meshes()[0]
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)
rig.animation_data_clear()

clips = {}
for name, spec in CLIPS:
    path, index = spec.rsplit(":", 1)
    wanted = gltf_animation_names(path)[int(index)]
    before_o, before_a = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = set(bpy.data.actions) - before_a
    act = next((a for a in new if a.name == wanted), None) or next(a for a in new if a.name.startswith(wanted))
    act.name = name
    act.use_fake_user = True
    clips[name] = act
    for o in set(bpy.data.objects) - before_o:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in new:
        if a is not act:
            bpy.data.actions.remove(a)
for o in list(bpy.context.scene.objects):
    if o not in (rig, body):
        bpy.data.objects.remove(o, do_unlink=True)


def scale_location_keys(k, only=None):
    for act in clips.values():
        for fc in fcurves_of(act):
            if fc.data_path.endswith(".location") and (only is None or f'"{only}"' in fc.data_path):
                for kp in fc.keyframe_points:
                    for pt in (kp.co, kp.handle_left, kp.handle_right):
                        pt.y *= k
                fc.update()


def apply_scale():
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    body.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def height_and_floor():
    zs = [(body.matrix_world @ v.co).z for v in body.data.vertices]
    return max(zs) - min(zs), min(zs)


# 2. échelle du nœud Armature (0,01: héritage du FBX)
s_old = rig.scale[0]
apply_scale()
scale_location_keys(s_old)

# 3. proportions par le squelette
hips_before = rig.data.bones["Hips"].head_local.z - height_and_floor()[1]
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for eb in rig.data.edit_bones:
    eb.inherit_scale = "NONE"
bpy.ops.object.mode_set(mode="POSE")
for name, (width, length) in conf["proportions"].items():
    rig.pose.bones[name].scale = (width, length, width)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()
bpy.context.view_layer.objects.active = body
bpy.ops.object.modifier_apply(modifier=body.modifiers[0].name)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode="EDIT")
for eb in rig.data.edit_bones:
    eb.inherit_scale = "FULL"
bpy.ops.object.mode_set(mode="OBJECT")
body.modifiers.new("Armature", "ARMATURE").object = rig

h, floor = height_and_floor()
k = conf["taille_m"] / h
rig.scale = (k, k, k)
body.scale = body.scale * k if body.parent is None else body.scale
apply_scale()
h, floor = height_and_floor()
rig.location.z -= floor
if body.parent is None:
    body.location.z -= floor
apply_scale()
hips_after = rig.data.bones["Hips"].head_local.z
# les clips déplacent les hanches: leur amplitude suit la longueur des jambes
scale_location_keys(hips_after / hips_before, only="Hips")

# 4. zones
names = [g.name for g in body.vertex_groups]
zone_of_bone = {b: z for z, bones in ZONES.items() for b in bones}
me = body.data
me.materials.clear()
order = list(ZONES)
for z in order:
    m = bpy.data.materials.new("corps_" + z)
    m.use_nodes = True
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*conf["couleur"], 1)
    m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    me.materials.append(m)
counts = dict.fromkeys(order, 0)
for p in me.polygons:
    acc = {}
    for vi in p.vertices:
        for g in me.vertices[vi].groups:
            z = zone_of_bone.get(names[g.group])
            if z:
                acc[z] = acc.get(z, 0.0) + g.weight
    z = max(acc, key=acc.get) if acc else "torse"
    p.material_index = order.index(z)
    p.use_smooth = True
    counts[z] += len(p.vertices) - 2
body.name = "corps"
me.name = "corps"
rig.name = "squelette_commun"

# 5. export
ad = rig.animation_data_create()
for name, act in clips.items():
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    strip.action_slot = act.slots[0]
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_yup=True, export_skins=True, export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_vertex_color="NONE", export_materials="EXPORT")
head = rig.data.bones["Head"]
head_zs = [(body.matrix_world @ v.co).z for v in me.vertices
           if any(names[g.group] in ZONES["tete"] and g.weight > 0.5 for g in v.groups)]
skeleton = {
    "pose_de_repos": "T (bras à l'horizontale), face vers -Y dans Blender et +Z en glTF, 1 unité = 1 m, semelles à 0",
    "taille_m": round(height_and_floor()[0], 4),
    "hauteur_tete_m": round(max(head_zs) - min(head_zs), 4),
    "os": [{"nom": b.name, "parent": b.parent.name if b.parent else None,
            "tete": [round(x, 4) for x in b.head_local], "queue": [round(x, 4) for x in b.tail_local]} for b in rig.data.bones],
    "clips": {n: round((a.frame_range[1] - a.frame_range[0]) / bpy.context.scene.render.fps, 3) for n, a in clips.items()},
    "zones_triangles": counts,
    "triangles": triangles(body),
    "octets": os.path.getsize(OUT),
}
skeleton["tetes_de_haut"] = round(skeleton["taille_m"] / skeleton["hauteur_tete_m"], 2)
with open(SKELETON, "w", encoding="utf-8") as fh:
    json.dump(skeleton, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("CORPS", {k: skeleton[k] for k in ("taille_m", "hauteur_tete_m", "tetes_de_haut", "triangles", "octets", "clips", "zones_triangles")})
