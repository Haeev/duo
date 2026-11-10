"""Essai texturé Meshy (2026-11-10): mise en conformité et planche côte à côte avec les aplats.

Usage: duo-python conformer_essai.py <dossier des sorties brutes Meshy> <dossier des GLB d'objets> <planche.png>
Pour chaque sortie (`refined.glb`): fusion des maillages, réduction à 800 triangles au plus,
taille réelle du gabarit (plus grande dimension), origine au centre du dessous, texture ramenée
à 256 px. Sortie: `<dossier des GLB>/essai-meshy.glb` (nœuds `<id>-meshy`), puis une planche
Cycles: en haut les versions en aplats (gabarits), en bas les versions texturées de Meshy.
"""
import glob
import json
import math
import os
import sys

import bpy

RAW, OBJ, PLANCHE = (os.path.abspath(a) for a in sys.argv[1:4])
# sortie brute (début du nom du dossier de Meshy) -> objet du gabarit
ESSAI = {
    "a-round-french-country-bread": "pain",
    "a-small-river-trout-fish": "truite",
    "a-glass-jar-of-strawberry-jam": "confiture",
    "a-wood-chopping-axe": "hache",
}
index = json.load(open(os.path.join(OBJ, "index.json"), encoding="utf-8"))["objects"]

bpy.ops.wm.read_factory_settings(use_empty=True)
made = []
for prefix, oid in ESSAI.items():
    found = sorted(glob.glob(os.path.join(RAW, f"*_{prefix}*", "refined.glb")))
    if not found:
        print("ABSENT", prefix)
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=found[-1])
    meshes = [o for o in set(bpy.data.objects) - before if o.type == "MESH"]
    for o in set(bpy.data.objects) - before:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.parent = None
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    if tris > 800:
        mod = o.modifiers.new("reduire", "DECIMATE")
        mod.ratio = 780 / tris
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.modifier_add(type="TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=o.modifiers[-1].name)
    vs = [v.co for v in o.data.vertices]
    lo = [min(v[k] for v in vs) for k in range(3)]
    hi = [max(v[k] for v in vs) for k in range(3)]
    s = max(index[oid]["size"]) / max(hi[k] - lo[k] for k in range(3))
    for v in o.data.vertices:
        v.co = ((v.co.x - (lo[0] + hi[0]) / 2) * s, (v.co.y - (lo[1] + hi[1]) / 2) * s, (v.co.z - lo[2]) * s)
    for slot in o.material_slots:
        for node in slot.material.node_tree.nodes if slot.material else []:
            if node.type == "TEX_IMAGE" and node.image and node.image.size[0] > 256:
                node.image.scale(256, 256)
                node.image.pack()
    o.name = f"{oid}-meshy"
    made.append((oid, o, len(o.data.polygons)))
    print("CONFORME", oid, len(o.data.polygons), "triangles")

bpy.ops.object.select_all(action="DESELECT")
for _, o, _ in made:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OBJ, "essai-meshy.glb"), export_format="GLB", use_selection=True, export_yup=True,
                          export_image_format="JPEG", export_jpeg_quality=85, export_animations=False)

# Planche: aplats en haut (gabarits), Meshy texturé en bas, chaque paire à la même échelle d'affichage.
for f in sorted({index[oid]["file"] for oid, _, _ in made}):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(OBJ, f))
    for o in set(bpy.data.objects) - before:
        if o.type == "MESH" and o.name not in ESSAI.values():
            bpy.data.objects.remove(o)
        elif o.type == "EMPTY":
            o.hide_render = True
for k, (oid, meshy, _) in enumerate(made):
    flat = bpy.data.objects[oid]
    s = 0.8 / max(index[oid]["size"])
    for o, row in ((flat, 0), (meshy, 1)):
        o.rotation_mode = "XYZ"
        o.scale = (s, s, s)
        o.location = (k * 1.0, 0, -row * 1.0)
        o.rotation_euler = (0, 0, math.radians(-30))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.world = bpy.data.worlds.new("w")
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.9, 0.84, 1)
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(40), math.radians(10), math.radians(-40))
scene.collection.objects.link(sun)
scene.view_settings.view_transform = "Standard"
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
cam.data.ortho_scale = max(len(made), 2) * 1.0
cx = (len(made) - 1) / 2
cam.location = (cx, -20, -0.1)
cam.rotation_euler = (math.radians(90), 0, 0)
scene.render.resolution_x = len(made) * 400
scene.render.resolution_y = 800
scene.render.filepath = PLANCHE
bpy.ops.render.render(write_still=True)
print("PLANCHE", PLANCHE, json.dumps({oid: t for oid, _, t in made}))
