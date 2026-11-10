"""Planche de contrôle de tous les objets (Workbench, couleurs de sommets), depuis les GLB livrés.

Usage: duo-python planche_objets.py <dossier des GLB> <sortie.png> [--echelle]
Chaque objet est ramené à la taille d'une case (vue de trois quarts, comme les vignettes);
avec --echelle, ils gardent leur taille réelle à côté d'un mannequin de 1,80 m.
"""
import json
import math
import os
import sys

import bpy

DOSSIER, SORTIE = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
ECHELLE = "--echelle" in sys.argv
index = json.load(open(os.path.join(DOSSIER, "index.json"), encoding="utf-8"))["objects"]

bpy.ops.wm.read_factory_settings(use_empty=True)
for f in sorted({v["file"] for v in index.values()}):
    bpy.ops.import_scene.gltf(filepath=os.path.join(DOSSIER, f))
objs = {o.name: o for o in bpy.data.objects if o.type == "MESH"}

ids = list(index)
cols = 10 if not ECHELLE else len(ids)
cell = 1.0
for k, oid in enumerate(ids):
    o = objs[oid]
    o.rotation_mode = "XYZ"
    if ECHELLE:
        x = sum(max(index[i]["size"][0], 0.12) + 0.08 for i in ids[:k])
        o.location = (x, 0, 0)
        continue
    s = 0.8 / max(index[oid]["size"])
    o.scale = (s, s, s)
    o.location = ((k % cols) * cell, -(k // cols) * cell * 1.0, 0)
if ECHELLE:
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.8, location=(-0.3, 0, 0.9))

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 8
scene.cycles.device = "CPU"
scene.world = bpy.data.worlds.new("w")
bg = scene.world.node_tree.nodes["Background"]
bg.inputs[0].default_value = (0.93, 0.9, 0.84, 1)
bg.inputs[1].default_value = 0.9
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(40), math.radians(10), math.radians(-40))
scene.collection.objects.link(sun)
scene.view_settings.view_transform = "Standard"
rows = math.ceil(len(ids) / cols)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
scene.collection.objects.link(cam)
scene.camera = cam
cam.data.type = "ORTHO"
target = bpy.data.objects.new("cible", None)
scene.collection.objects.link(target)
track = cam.constraints.new("TRACK_TO")
track.target = target
if ECHELLE:
    width = sum(max(index[i]["size"][0], 0.12) + 0.08 for i in ids) + 0.6
    cam.data.ortho_scale = width
    target.location = (width / 2 - 0.5, 0, 0.9)
    cam.location = (width / 2 - 0.5, -20, 0.9)
    scene.render.resolution_x, scene.render.resolution_y = 3000, int(3000 * 2.2 / width)
else:
    # trois quarts: azimut 30 degrés, élévation 30 degrés (comme les vignettes)
    cam.data.ortho_scale = cols * cell * 1.05
    cx, cy = (cols - 1) * cell / 2, -(rows - 1) * cell / 2
    target.location = (cx, cy, 0.3)
    el, az = math.radians(30), math.radians(30)
    d = 40
    cam.location = (cx - d * math.cos(el) * math.sin(az), cy - d * math.cos(el) * math.cos(az), 0.3 + d * math.sin(el))
    scene.render.resolution_x = cols * 140
    scene.render.resolution_y = int(rows * 140 * 0.95)
scene.render.filepath = SORTIE
bpy.ops.render.render(write_still=True)
print("PLANCHE", SORTIE)
