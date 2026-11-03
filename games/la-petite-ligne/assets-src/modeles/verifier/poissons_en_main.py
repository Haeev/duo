"""Contrôle de l'échelle et de la prise: un joueur au repos tient un poisson sous socket_hand_r, sans transformation.

Lancer: duo-python verifier/poissons_en_main.py <sortie.png> [fish_trout fish_pike ...]
Le poisson est mis à l'échelle de sa longueur médiane (échelle 1); un second rendu le montre au bout de sa
fourchette (échelle longueur max / length_m) pour vérifier que la main reste à la prise.
"""
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import lpl  # noqa: E402

out = sys.argv[1]
names = sys.argv[2:] or ["fish_trout", "fish_pike", "fish_moon_pike"]
lpl.reset()
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "personnages.glb"))
chars = set(bpy.data.objects) - before
keep = {"player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"}
rig = None
for o in chars:
    if o.type == "ARMATURE":
        rig = o
    elif o.type == "MESH" and o.name not in keep:
        o.hide_render = True
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "poissons.glb"))
fish = set(bpy.data.objects) - before
for o in fish:
    o.hide_render = True
socket = next(o for o in chars if o.name.startswith("socket_hand_r"))
for o in bpy.data.objects:
    if o.animation_data:
        o.animation_data.action = None
rig.data.pose_position = "REST"
bpy.context.view_layer.update()

lpl.setup_render((900, 700), 8)
lpl.world(lpl.hex_lin("#E4EAEE"), 1.0)
lpl.sun((50, 0, 30), 3.0)
lpl.ground_plane(20, lpl.hex_lin("#A7B98A"))
renders = []
for i, n in enumerate(names):
    src = bpy.data.objects[n]
    for big in (False, True):
        c = src.copy()
        bpy.context.scene.collection.objects.link(c)
        c.hide_render = False
        c.parent = socket
        c.matrix_parent_inverse.identity()
        c.location = (0, 0, 0)
        c.rotation_mode = "XYZ"
        c.rotation_euler = (0, 0, 0)
        k = (src["length_cm"][1] / 100 / src["length_m"]) if big else 1.0
        c.scale = (k, k, k)
        bpy.context.view_layer.update()
        cam = lpl.persp_camera(Vector((-2.3, -1.7, 1.45)), Vector((-0.25, 0.0, 0.85)), lens=45)
        path = out.replace(".png", f"-{n}-{'max' if big else 'median'}.png")
        lpl.render(path)
        renders.append(path)
        bpy.data.objects.remove(c, do_unlink=True)
        bpy.data.objects.remove(cam, do_unlink=True)
print("\n".join(renders))
