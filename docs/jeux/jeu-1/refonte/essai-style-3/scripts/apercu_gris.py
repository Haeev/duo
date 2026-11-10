"""Aperçu rapide d'un GLB (Blender, moteur Workbench): face, profil, dos, en gris ou en couleur de texture.

Usage: duo-python apercu_gris.py <modele.glb> <sortie.png> [texture]
"""
import sys

import bpy
from mathutils import Vector

src, out = sys.argv[1], sys.argv[2]
textured = len(sys.argv) > 3
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH" and o.name != "Icosphere"]
for o in bpy.context.scene.objects:
    if o.name.startswith("Icosphere"):
        o.hide_render = True
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre = (lo + hi) / 2
size = max(hi - lo)
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE" if textured else "SINGLE"
scene.display.shading.single_color = (0.7, 0.7, 0.7)
scene.render.resolution_x, scene.render.resolution_y = 480, 640
scene.render.film_transparent = False
world = bpy.data.worlds.new("w")
scene.world = world
cam_data = bpy.data.cameras.new("c")
cam_data.type = "ORTHO"
cam_data.ortho_scale = size * 1.05
cam = bpy.data.objects.new("c", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
import os

base, ext = os.path.splitext(out)
# glTF: +Y glTF devient +Z Blender, l'avant (+Z glTF) devient -Y Blender.
for name, d in (("face", Vector((0, -1, 0))), ("profil", Vector((1, 0, 0))), ("dos", Vector((0, 1, 0)))):
    cam.location = centre + d * size * 3
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{base}-{name}{ext}"
    bpy.ops.render.render(write_still=True)
print("emprise", tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi))
print("triangles", sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes))
