"""Planche du chat du bourg (0.13): ses quatre clips à la caméra du jeu, de près, et à côté du mannequin de 1,80 m.

Lancer: duo-python verifier/planche_chat.py <dossier de sortie>   (puis convert pour assembler, voir la fin)
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

SORTIE = (sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:])[0]
CLIPS = [("cat_idle", (1, 70, 96)), ("cat_walk", (0, 6, 12, 18)), ("cat_sleep", (1, 45)), ("cat_roll", (1, 16, 28))]


def shot(name, target, ortho, res, azimuth=45.0, elevation=35.264):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=azimuth, elevation=elevation)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)
    return sc.render.filepath


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((420, 340), int(os.environ.get("LPL_SAMPLES", "10")))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#ABA498"), z=-0.002)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "faune.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    cat = bpy.data.objects["cat"]
    keep = {cat} | set(cat.children_recursive)
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    cat.rotation_mode = "XYZ"
    files = []
    for clip, frames in CLIPS:
        act = bpy.data.actions[clip]
        if cat.animation_data is None:
            cat.animation_data_create()
        for tr in list(cat.animation_data.nla_tracks):
            cat.animation_data.nla_tracks.remove(tr)
        cat.animation_data.action = act
        cat.animation_data.action_slot = act.slots[0]
        for f in frames:
            bpy.context.scene.frame_set(f)
            for az, tag in ((45, "iso"), (135, "iso2")):
                cat.rotation_euler = (0, 0, math.radians(az - 45 - 30))
                files.append(shot(f"chat_{clip}_{f:03d}_{tag}", (0, 0, 0.16), 0.75, (300, 260)))
    # de près, assis, face à la caméra
    act = bpy.data.actions["cat_idle"]
    cat.animation_data.action = act
    cat.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(1)
    cat.rotation_euler = (0, 0, 0)
    shot("chat_tete", (0, -0.14, 0.44), 0.36, (420, 340), elevation=20)
    # échelle: mannequin de 1,80 m
    m = bpy.data.materials.new("mannequin")
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.35, 0.33, 0.32, 1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.45, 0.45, 0.9))
    man = bpy.context.active_object
    man.scale = (0.3, 0.05, 1.8)
    man.rotation_euler = (0, 0, math.radians(45))
    man.data.materials.append(m)
    act = bpy.data.actions["cat_walk"]
    cat.animation_data.action = act
    cat.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(0)
    cat.rotation_euler = (0, 0, math.radians(-30))
    shot("chat_echelle", (0.2, 0.2, 0.8), 2.4, (300, 420))


main()
