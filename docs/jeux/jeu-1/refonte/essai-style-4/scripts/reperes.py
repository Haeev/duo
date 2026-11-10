"""Planche de réglage d'un corps conformé: silhouette de face et de profil en gris, gros plan de la tête avec
les repères du visage (yeux, bouche, écart) tracés par-dessus. Sert à remplir [visage] de la fiche du corps.

Usage: duo-python reperes.py <corps.blend> <corps.npz> <sortie.png>
"""
import sys

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
blend, npz, out = args[:3]
bpy.ops.wm.open_mainfile(filepath=blend)
f = np.load(npz)["face"]
top, chin, hh, yeux, bouche = (float(x) for x in f[:5])
ecart = float(f[12])
scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "MATCAP"
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = "BOTH"
scene.render.film_transparent = False
cam_d = bpy.data.cameras.new("c")
cam_d.type = "ORTHO"
cam = bpy.data.objects.new("c", cam_d)
scene.collection.objects.link(cam)
scene.camera = cam


def trait(a, b, nom):
    cu = bpy.data.curves.new(nom, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 0.0012
    sp = cu.splines.new("POLY")
    sp.points.add(1)
    sp.points[0].co = (*a, 1)
    sp.points[1].co = (*b, 1)
    scene.collection.objects.link(bpy.data.objects.new(nom, cu))


y = -0.4
for z in (yeux, bouche, top, chin):
    trait((-0.12, y, z), (0.12, y, z), "h")
for x in (-ecart, ecart, 0.0):
    trait((x, y, yeux - 0.03), (x, y, yeux + 0.03), "v")

from PIL import Image  # noqa: E402

tiles = []
for nom, loc, rot, scale, res in (
        ("face", (0, -5, top / 2), (np.pi / 2, 0, 0), top * 1.15, (360, 600)),
        ("profil", (5, 0, top / 2), (np.pi / 2, 0, np.pi / 2), top * 1.15, (360, 600)),
        ("tete", (0, -5, top - hh / 2), (np.pi / 2, 0, 0), hh * 1.5, (600, 600)),
        ("tete34", (2.5, -4.33, top - hh / 2), (np.pi / 2, 0, np.pi / 6), hh * 1.5, (600, 600))):
    cam.location = Vector(loc)
    cam.rotation_euler = rot
    cam_d.ortho_scale = scale * (1 if res[1] >= res[0] else 1)
    cam_d.sensor_fit = "VERTICAL"
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.filepath = out + f".{nom}.png"
    bpy.ops.render.render(write_still=True)
    tiles.append(Image.open(out + f".{nom}.png").convert("RGB"))
W = sum(t.width for t in tiles)
sheet = Image.new("RGB", (W, 600), "white")
x = 0
for t in tiles:
    sheet.paste(t, (x, 0))
    x += t.width
sheet.save(out)
print("REPERES", out, "yeux", round((top - yeux) / hh, 3), "bouche", round((top - bouche) / hh, 3), "ecart", round(ecart, 4))
