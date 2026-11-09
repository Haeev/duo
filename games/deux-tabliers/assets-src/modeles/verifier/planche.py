"""Planche de contrôle: chaque GLB rendu seul (Cycles, trois quarts avant), à côté du mannequin de 1,80 m quand
l'objet dépasse 0,4 m, sur un sol quadrillé à 25 cm (la grille de pose du jeu). Une image par modèle, puis montage.

Usage: duo-python planche.py -- <sortie.png> <glb>... [--taille 360] [--spp 12] [--angle 35]
"""
import math
import os
import subprocess
import sys
import tempfile

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
opts = {"--taille": "360", "--spp": "12", "--angle": "35", "--azimut": "-35", "--colonnes": "6"}
rest = []
i = 0
while i < len(argv):
    if argv[i] in opts:
        opts[argv[i]] = argv[i + 1]
        i += 2
    else:
        rest.append(argv[i])
        i += 1
OUT, GLBS = rest[0], rest[1:]
T = int(opts["--taille"])
tmp = tempfile.mkdtemp(prefix="planche_")


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = int(opts["--spp"])
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = T
    sc.view_settings.view_transform = "Standard"
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.75, 0.73, 0.7, 1)
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    sun = bpy.data.lights.new("s", "SUN")
    sun.energy = 2.2
    so = bpy.data.objects.new("s", sun)
    so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    sc.collection.objects.link(so)
    # sol quadrillé à 25 cm
    bpy.ops.mesh.primitive_plane_add(size=12)
    fl = bpy.context.active_object
    m = bpy.data.materials.new("sol")
    nt = m.node_tree
    ch = nt.nodes.new("ShaderNodeTexChecker")
    ch.inputs["Scale"].default_value = 24
    ch.inputs["Color1"].default_value = (0.62, 0.6, 0.57, 1)
    ch.inputs["Color2"].default_value = (0.55, 0.53, 0.5, 1)
    nt.links.new(ch.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    nt.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
    fl.data.materials.append(m)
    return sc


def mannequin(x):
    mat = bpy.data.materials.new("mannequin")
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.35, 0.37, 0.42, 1)
    parts = []
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=1.5, location=(x, 0, 0.75))
    parts.append(bpy.context.active_object)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.14, location=(x, 0, 1.66))
    parts.append(bpy.context.active_object)
    for p in parts:
        p.data.materials.append(mat)
    return parts


sc = setup()
images = []
for k, path in enumerate(GLBS):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == "MESH"]
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    # objets au plafond: les remonter pour que leur haut soit à 2,80 m
    lift = 0.0
    if mx.z <= 0.01 and mn.z < -0.05:
        lift = 2.8
        for o in new:
            if o.parent is None:
                o.location.z += lift
        mn.z += lift
        mx.z += lift
    size = mx - mn
    big = max(size.x, size.y, size.z) > 0.4
    extra = []
    if big:
        extra = mannequin(mn.x - 0.35)
        mn.x -= 0.55
        mn.z = min(mn.z, 0)
        mx.z = max(mx.z, 1.8)
    c = (mn + mx) / 2
    r = max((mx - mn).length / 2, 0.08)
    az, el = math.radians(float(opts["--azimut"])), math.radians(float(opts["--angle"]))
    d = r / math.sin(math.radians(20)) * 1.05
    cam_d = bpy.data.cameras.new("c")
    cam_d.lens_unit = "FOV"
    cam_d.angle = math.radians(40)
    cam_d.clip_start = 0.01
    cam = bpy.data.objects.new("c", cam_d)
    sc.collection.objects.link(cam)
    # vue de trois quarts avant: l'avant des modèles est -Y Blender (+Z glTF)
    cam.location = c + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * d
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    out = os.path.join(tmp, f"{k:03d}.png")
    sc.render.filepath = out
    bpy.ops.render.render(write_still=True)
    lab = os.path.join(tmp, f"{k:03d}_l.png")
    subprocess.run(["convert", out, "-gravity", "South", "-background", "#2b2622", "-fill", "#f5f0e6", "-pointsize", "15", "-splice", "0x22",
                    "-annotate", "+0+2", os.path.splitext(os.path.basename(path))[0], lab], check=True)
    images.append(lab)
    for o in new + extra + [cam]:
        bpy.data.objects.remove(o, do_unlink=True)
subprocess.run(["montage", *images, "-tile", f"{opts['--colonnes']}x", "-geometry", "+3+3", "-background", "#1c1a26", OUT], check=True)
print("planche:", OUT)
