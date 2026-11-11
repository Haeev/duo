"""Planche de contrôle des décors (Cycles): tous les modèles en grille, mannequin de 1,80 m.

Usage: duo-python planche.py <dossier des GLB> <sortie.png> [famille de fichiers: furniture,street,houses] [azimut]
Les modèles sont rangés par fichier, l'avant (sud) vers la caméra de trois quarts.
"""
import math
import os
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
dossier, sortie = args[0], args[1]
fichiers = args[2].split(",") if len(args) > 2 else ["furniture", "street", "houses"]
azimut = float(args[3]) if len(args) > 3 else -25.0

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

rang_y = 0.0
LIGNE = float(os.environ.get("LIGNE", "9"))
racines_tout = []
for nom in fichiers:
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(dossier, f"{nom}.glb"))
    racines = sorted([o for o in set(bpy.data.objects) - avant if o.parent is None], key=lambda o: o.name)
    x = 0.0
    profondeur = 0.0
    for r in racines:
        enfants = [c for c in r.children_recursive if c.type == "MESH"]
        lo = min((c.matrix_world @ Vector(b)).x for c in enfants for b in c.bound_box)
        hi = max((c.matrix_world @ Vector(b)).x for c in enfants for b in c.bound_box)
        dy = max((c.matrix_world @ Vector(b)).y for c in enfants for b in c.bound_box) - min(
            (c.matrix_world @ Vector(b)).y for c in enfants for b in c.bound_box)
        if x > LIGNE:
            x = 0.0
            rang_y += profondeur + 1.2
            profondeur = 0.0
        r.location.x = x - lo
        r.location.y = rang_y
        x += hi - lo + 0.5
        profondeur = max(profondeur, dy)
        racines_tout.append(r)
    # Mannequin de 1,80 m en tête de rangée.
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.45, location=(-0.8, rang_y, 0.725))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.175, location=(-0.8, rang_y, 1.625))
    rang_y += profondeur + 1.5

for o in bpy.data.objects:
    if o.type == "MESH" and o.data.materials and o.data.materials[0] is None:
        pass
mann = bpy.data.materials.new("mannequin")
mann.diffuse_color = (0.85, 0.85, 0.85, 1)
for o in bpy.data.objects:
    if o.type == "MESH" and not o.data.materials:
        o.data.materials.append(mann)

bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0))
sol = bpy.context.active_object
ms = bpy.data.materials.new("sol")
ms.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.42, 0.52, 0.30, 1)
sol.data.materials.append(ms)

coins = [Vector(c) for o in bpy.data.objects if o.type == "MESH" and o != sol for c in
         [o.matrix_world @ Vector(b) for b in o.bound_box]]
lo = Vector((min(c.x for c in coins), min(c.y for c in coins), 0))
hi = Vector((max(c.x for c in coins), max(c.y for c in coins), max(c.z for c in coins)))
centre = (lo + hi) / 2
cam_d = bpy.data.cameras.new("cam")
cam_d.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_d)
sc.collection.objects.link(cam)
az = math.radians(azimut)
el = math.radians(32)
direction = Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el)))
cam.location = centre + direction * 60
cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
cam_d.ortho_scale = max(hi.x - lo.x, (hi.y - lo.y + hi.z) * 1.1) * 1.08
cam_d.clip_end = 300

soleil = bpy.data.lights.new("soleil", "SUN")
soleil.energy = 3.2
soleil.angle = math.radians(8)
so = bpy.data.objects.new("soleil", soleil)
sc.collection.objects.link(so)
so.rotation_euler = (math.radians(45), math.radians(10), math.radians(-30))
sc.world = bpy.data.worlds.new("ciel")
sc.world.color = (0.75, 0.82, 0.9)
sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.82, 0.9, 1)
sc.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
sc.camera = cam
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = int(os.environ.get("ECHANTILLONS", "10"))
sc.cycles.use_denoising = True
sc.view_settings.view_transform = "Standard"
sc.render.resolution_x = int(os.environ.get("LARGEUR", "1800"))
sc.render.resolution_y = int(sc.render.resolution_x * min(1.0, max(0.5, ((hi.y - lo.y) * 0.55 + hi.z * 0.85) / (hi.x - lo.x))))
sc.render.filepath = sortie
bpy.ops.render.render(write_still=True)
print("PLANCHE", sortie)
