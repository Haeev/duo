"""Mise en conformité d'un personnage riggé par Meshy (Blender 5.2 sans interface, duo-python).

Meshy rend le personnage riggé (Character_output.glb), la marche et la course offertes avec le rig
(un GLB par clip), puis un GLB par appel d'animation (jusqu'à 10 clips). Ce script en fait un seul
GLB aux conventions du studio:
Options de la fiche (ajoutées par l'artiste 3D le 2026-11-07, sans effet si absentes): `decimate_to` (triangles visés),
`texture_mode: "meshy"` et `texture_size` (garder la texture de Meshy réduite, rendu semi-réaliste choisi par le client),
`badge` (disque de 3 cm à la couleur du joueur, matériau à part `dt_badge_joueur`).

1. importe le personnage, puis chaque fichier d'animation; prend les clips demandés par la fiche
   (fichier, index du clip dans le fichier), les renomme (`walk`, `idle`, `sit`, `drink`...) et les
   rattache au squelette du personnage (les pistes visent les os par leur nom: on vérifie qu'ils
   existent tous), puis supprime les squelettes et maillages en double;
2. mesure le déplacement de la racine sur chaque clip; pour un clip marqué `in_place`, retire la
   dérive horizontale (le jeu déplace lui-même le personnage);
3. met à la taille de la fiche (échelle appliquée au squelette et aux translations des clips);
4. couleurs de palette comme pour les accessoires (texture de Meshy lue sous chaque face, case la
   plus proche, vote par pièce ou par face avec lissage), matériau commun des personnages;
5. exporte un GLB (peau, un clip par piste NLA) et un rapport JSON.

Usage:
  duo-python conformite_personnage.py <fiche.json> <palette.json> <sortie.glb> <rapport.json> <personnage.glb> <animations.glb>...
"""

import json
import math
import os
import struct
import sys

import bpy
import bmesh
from bpy_extras import anim_utils
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshy_commun import Palette, apply_palette_uv, assign_cells, base_color_images, palette_material, split_parts  # noqa: E402

FICHE, PALETTE, OUT, REPORT, CHARACTER = sys.argv[1:6]
ANIM_FILES = sys.argv[6:]
with open(FICHE, encoding="utf-8") as fh:
    conf = json.load(fh)["conformity"]
palette = Palette(PALETTE, conf.get("palette_allowed"), kl=conf.get("lightness_weight", 2.0))


def gltf_animation_names(path):
    with open(path, "rb") as fh:
        data = fh.read()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length].decode("utf-8"))
    return [a.get("name", f"animation_{i}") for i, a in enumerate(gltf.get("animations", []))]


def fcurves_of(action):
    return list(anim_utils.action_get_channelbag_for_slot(action, action.slots[0]).fcurves)


# --- Personnage et clips ------------------------------------------------------------------------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=CHARACTER)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
# Seuls les maillages à peau comptent: l'import glTF ajoute une sphère qui sert de forme d'os.
body = [o for o in bpy.context.scene.objects if o.type == "MESH" and any(m.type == "ARMATURE" for m in o.modifiers)]
images = base_color_images(body)
for act in list(bpy.data.actions):
    bpy.data.actions.remove(act)
rig.animation_data_clear()

clips = {}
by_file = {}
for spec in conf["clips"]:
    by_file.setdefault(spec["file"], []).append(spec)
for path in ANIM_FILES:
    specs = by_file.get(os.path.basename(path), [])
    if not specs:
        continue
    names = gltf_animation_names(path)
    before_objects, before_actions = set(bpy.data.objects), set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new_actions = set(bpy.data.actions) - before_actions
    for spec in specs:
        wanted = names[spec["index"]]
        act = next((a for a in new_actions if a.name == wanted), None) or next((a for a in new_actions if a.name.startswith(wanted)), None)
        if act is None:
            raise SystemExit(f"{os.path.basename(path)}: clip {spec['index']} ({wanted}) introuvable après import")
        act.name = spec["name"]
        act.use_fake_user = True
        clips[spec["name"]] = (act, spec)
    for o in set(bpy.data.objects) - before_objects:
        bpy.data.objects.remove(o, do_unlink=True)
    for a in new_actions:
        if a.name not in clips:
            bpy.data.actions.remove(a)
missing = [s["name"] for s in conf["clips"] if s["name"] not in clips]
if missing:
    raise SystemExit(f"clips introuvables (fichier absent?): {missing}")

bone_names = {b.name for b in rig.data.bones}
unknown_bones = {}
for name, (act, _) in clips.items():
    used = set()
    for fc in fcurves_of(act):
        if fc.data_path.startswith('pose.bones["'):
            used.add(fc.data_path.split('"')[1])
    if used - bone_names:
        unknown_bones[name] = sorted(used - bone_names)

# --- Racine et déplacement ----------------------------------------------------------------------

root_name = conf.get("root_bone") or next((n for n in ("Hips", "hips", "mixamorig:Hips", "pelvis", "root") if n in bone_names), None)
if root_name is None:
    root_name = next(b.name for b in rig.data.bones if b.parent is None)
ad = rig.animation_data_create()
scene = bpy.context.scene


def root_world(frame):
    scene.frame_set(int(round(frame)))
    bpy.context.view_layer.update()
    return rig.matrix_world @ rig.pose.bones[root_name].head


drift = {}
for name, (act, spec) in clips.items():
    ad.action = act
    ad.action_slot = act.slots[0]
    f0, f1 = act.frame_range
    start, end = root_world(f0), root_world(f1)
    move = end - start
    horizontal = Vector((move.x, move.y, 0.0))
    entry = {"frames": [f0, f1], "root_move_m": [round(x, 3) for x in move]}
    if spec.get("in_place") and horizontal.length > 0.01:
        bone = rig.data.bones[root_name]
        # Déplacement dans l'espace de l'os (os sans parent animé): rotation de repos inverse.
        rest = bone.matrix_local.to_3x3()
        if bone.parent is not None:
            rest = bone.parent.matrix_local.to_3x3() @ (bone.parent.matrix_local.inverted() @ bone.matrix_local).to_3x3()
        local = rest.inverted() @ (rig.matrix_world.inverted().to_3x3() @ horizontal)
        for fc in fcurves_of(act):
            if fc.data_path == f'pose.bones["{root_name}"].location':
                k = local[fc.array_index]
                for kp in fc.keyframe_points:
                    t = (kp.co.x - f0) / max(1e-6, f1 - f0)
                    for pt in (kp.co, kp.handle_left, kp.handle_right):
                        pt.y -= k * t
                fc.update()
        after = root_world(f1) - root_world(f0)
        entry["root_move_after_m"] = [round(x, 3) for x in after]
    drift[name] = entry
ad.action = None

# --- Taille ---------------------------------------------------------------------------------------

rig.data.pose_position = "REST"
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()
zs = [(o.matrix_world @ v.co).z for o in body for v in o.evaluated_get(deps).to_mesh().vertices]
height = max(zs) - min(zs)
factor = conf.get("target_height_m", height) / height
if abs(factor - 1.0) > 0.01:
    for o in bpy.context.scene.objects:
        o.select_set(o == rig or o in body)
    bpy.context.view_layer.objects.active = rig
    # l'échelle d'objet du squelette (0,01 chez Meshy, héritée du FBX) est appliquée avec le facteur: les translations des
    # clips, exprimées dans l'ancienne unité du squelette, prennent les deux (corrigé le 2026-11-07: avec le seul facteur,
    # un personnage mis à une autre taille que celle du rig s'envolait, hanches à 100 fois leur hauteur)
    s_old = rig.scale[0]
    rig.scale = rig.scale * factor
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    k_loc = factor * s_old
    for act, _ in clips.values():
        for fc in fcurves_of(act):
            if fc.data_path.endswith(".location"):
                for kp in fc.keyframe_points:
                    for pt in (kp.co, kp.handle_left, kp.handle_right):
                        pt.y *= k_loc
                fc.update()
rig.data.pose_position = "POSE"

# --- Réduction (option `decimate_to`: nombre de triangles visé, décimation par fusion d'arêtes) ------

decimated = {}
if conf.get("decimate_to"):
    total = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in body)
    ratio = conf["decimate_to"] / max(1, total)
    if ratio < 1.0:
        for o in body:
            before_t = sum(len(p.vertices) - 2 for p in o.data.polygons)
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new("reduction", "DECIMATE")
            mod.ratio = ratio
            mod.use_collapse_triangulate = True
            # la décimation passe avant l'armature dans la pile (sinon on décimerait le maillage posé)
            while o.modifiers[0] != mod:
                bpy.ops.object.modifier_move_up(modifier=mod.name)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            decimated[o.name] = [before_t, sum(len(p.vertices) - 2 for p in o.data.polygons)]

# --- Couleurs: palette du studio, ou texture de Meshy gardée et réduite (option `texture_mode: "meshy"`) ---

if conf.get("texture_mode") == "meshy":
    size = int(conf.get("texture_size", 512))
    kept = []
    for o in body:
        for slot in o.material_slots:
            m = slot.material
            if m is None or m.name in kept:
                continue
            for node in m.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image and node.image.size[0] > size:
                    node.image.scale(size, size)
            # une seule texture de couleur: on retire normales, rugosité et métal éventuels de Meshy (bible 6)
            bsdf_n = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
            for inp in ("Normal", "Roughness", "Metallic"):
                for link in list(bsdf_n.inputs[inp].links):
                    m.node_tree.links.remove(link)
            bsdf_n.inputs["Roughness"].default_value = 0.8
            bsdf_n.inputs["Metallic"].default_value = 0.0
            m.name = conf["node_name"] + "_mat"
            kept.append(m.name)
    palette_report = [{"mode": "texture de Meshy gardée", "taille_px": size}]
else:
    palette_report = None

# --- Badge du joueur (option `badge`): disque de 3 cm sur la bavette, lié à un os, matériau à part à teinter par le jeu ---

badge_info = None
if conf.get("badge"):
    from mathutils.bvhtree import BVHTree
    b = conf["badge"]
    deps = bpy.context.evaluated_depsgraph_get()
    o = body[0]
    rig.data.pose_position = "REST"
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(deps)
    me_ev = ev.to_mesh()
    bvh = BVHTree.FromPolygons([o.matrix_world @ v.co for v in me_ev.vertices], [tuple(p.vertices) for p in me_ev.polygons])
    ev.to_mesh_clear()
    # rayon depuis l'avant du personnage (avant glTF +Z = -Y Blender), à la hauteur donnée en part de la taille
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    zb = min(zs) + (max(zs) - min(zs)) * b.get("height_ratio", 0.73)
    hit, normal, _, _ = bvh.ray_cast(Vector((b.get("x", 0.06), -2.0, zb)), Vector((0, 1, 0)))
    if hit is not None:
        bm = bmesh.new()
        r = b.get("radius", 0.015)
        n = 12
        up = Vector((0, 0, 1))
        tx = normal.cross(up).normalized()
        ty = normal.cross(tx).normalized()
        c = hit + normal * 0.004
        ring = [bm.verts.new(c + (tx * math.cos(2 * math.pi * i / n) + ty * math.sin(2 * math.pi * i / n)) * r) for i in range(n)]
        back = [bm.verts.new(v.co - normal * 0.003) for v in ring]
        faces = [bm.faces.new(ring)]
        for i in range(n):
            j = (i + 1) % n
            faces.append(bm.faces.new([ring[i], back[i], back[j], ring[j]]))
        bmesh.ops.recalc_face_normals(bm, faces=faces)
        if faces[0].normal.dot(normal) < 0:
            for f in faces:
                f.normal_flip()
        me_b = bpy.data.meshes.new("badge")
        bm.to_mesh(me_b)
        bm.free()
        bmat = bpy.data.materials.new(b.get("material", "dt_badge_joueur"))
        bmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1, 1, 1, 1)
        bmat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
        me_b.materials.append(bmat)
        # dans le maillage du personnage: même peau, un primitif de plus (le jeu teinte ce matériau à la couleur du joueur)
        before_n = len(o.data.vertices)
        ob_b = bpy.data.objects.new("badge", me_b)
        bpy.context.scene.collection.objects.link(ob_b)
        bone = b.get("bone", "Spine02")
        vg = ob_b.vertex_groups.new(name=bone)
        vg.add(list(range(len(me_b.vertices))), 1.0, "REPLACE")
        mw = o.matrix_world.copy()
        for v in me_b.vertices:
            v.co = mw.inverted() @ v.co
        ob_b.matrix_world = mw
        bpy.ops.object.select_all(action="DESELECT")
        ob_b.select_set(True)
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.join()
        badge_info = {"centre_m": [round(c.x, 3), round(c.z, 3), round(-c.y, 3)], "rayon_m": r, "os": bone, "materiau": bmat.name}
    rig.data.pose_position = "POSE"

mat, tex, bsdf = palette_material(palette, "cosy_characters") if palette_report is None else (None, None, None)
if palette_report is None:
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
palette_report = [] if palette_report is None else palette_report
for o in (body if mat is not None else []):
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.index_update()
    bm.faces.ensure_lookup_table()
    parts, part_of = split_parts(bm)
    final, details, color_stats = assign_cells(bm, parts, part_of, images, [m.name if m else "" for m in me.materials], palette, conf)
    apply_palette_uv(bm, final, palette)
    bm.to_mesh(me)
    bm.free()
    me.materials.clear()
    me.materials.append(mat)
    palette_report.append({"mesh": o.name, "parts": len(parts), "cells": sorted(set(final.values())), "mixed_parts": [p["part"] for p in details if p.get("mixed")], **color_stats})

# --- Clips en pistes NLA, export et rapport ---------------------------------------------------------

for name, (act, _) in clips.items():
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    strip.action_slot = act.slots[0]
node = conf["node_name"]
rig.name = f"{node}_rig"
for i, o in enumerate(body):
    o.name = node if len(body) == 1 else f"{node}_{i}"
    # Maillage à peau à la racine de la scène (le modificateur Armature suffit): sinon le validateur
    # signale NODE_SKINNED_MESH_NON_ROOT.
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
for o in list(bpy.context.scene.objects):
    if o.type == "MESH" and o not in body:
        bpy.data.objects.remove(o, do_unlink=True)
triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in body)
budget = conf.get("max_triangles")
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    export_yup=True,
    export_skins=True,
    export_animations=True,
    export_animation_mode="NLA_TRACKS",
    export_vertex_color="NONE",
    export_materials="EXPORT",
    export_image_format="JPEG" if conf.get("texture_mode") == "meshy" else "AUTO",
)
fps = scene.render.fps / scene.render.fps_base
report = {
    "asset": node,
    "triangles": triangles,
    "triangle_budget": budget,
    "within_budget": budget is None or triangles <= budget,
    "bones": len(rig.data.bones),
    "bone_names": [b.name for b in rig.data.bones],
    "root_bone": root_name,
    "height_before_m": round(height, 3),
    "scale_applied": round(factor, 4),
    "clips": {n: {"seconds": round((a.frame_range[1] - a.frame_range[0]) / fps, 3), **drift[n]} for n, (a, _) in clips.items()},
    "clip_bones_missing_on_character": unknown_bones,
    "palette": palette_report,
    "decimation": decimated,
    "badge": badge_info,
    "file_bytes": os.path.getsize(OUT),
}
with open(REPORT, "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=2)
    fh.write("\n")
print(f"{node}: {triangles} triangles, {len(rig.data.bones)} os, clips {sorted(clips)}, {report['file_bytes']} octets")
