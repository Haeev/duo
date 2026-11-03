"""Planches des habitants de la 0.13 (lot H6): pour chacun, de face, de dos, de profil, en buste et ses expressions;
puis la rangée des 21 habitants à leur échelle avec le mannequin de 1,80 m, et les accessoires en main.

Lancer: duo-python planche_habitants_013.py <dossier de sortie des rendus> [habitants|rangee|accessoires|tout] [id ...]
Assemblage: planche_habitants_013.sh. Caméra du jeu (azimut 45, élévation 35,264), Cycles sur CPU.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import habitants_013 as H13  # noqa: E402
import lpl  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
SORTIE = ARGS[0]
MODE = ARGS[1] if len(ARGS) > 1 else "tout"
ONLY = ARGS[2:]
OLD = {"firmin": 1.0, "odette": 1.0, "basile": 1.0, "jeanne": 0.75, "lucie": 1.0, "achille": 1.0, "solange": 1.0}
EXPRS = ("neutral", "happy", "delighted", "tired", "hungry", "blink")
SAMPLES = int(os.environ.get("LPL_SAMPLES", "8"))


def load(path):
    bpy.ops.import_scene.gltf(filepath=path)
    rig = bpy.data.objects["rig"]
    rig.rotation_mode = "XYZ"
    return rig


def pose(rig, clip, frame):
    act = bpy.data.actions[clip]
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)


def shot(name, target, ortho, res, azimuth=45.0, elevation=35.264):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho, azimuth=azimuth, elevation=elevation)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)


def mannequin(loc):
    m = bpy.data.materials.new("mannequin")
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.35, 0.33, 0.32, 1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], 0.9))
    ob = bpy.context.active_object
    ob.scale = (0.3, 0.05, 1.8)
    ob.data.materials.append(m)
    ob.name = "mannequin_180"
    return ob


def show_only(rig, parts):
    for c in rig.children:
        c.hide_render = c.name not in parts
    for o in bpy.data.objects:
        if o.type == "MESH" and o.name in PROPS:
            o.hide_render = o.name not in parts
            for c in o.children_recursive:
                c.hide_render = o.hide_render


def set_expr(rig, name, expr):
    ob = bpy.data.objects[name]
    for kb in ob.data.shape_keys.key_blocks:
        kb.value = 1.0 if kb.name == expr else 0.0


def place_rig(rig, rz, scale, loc=(0, 0, 0)):
    rig.location = loc
    rig.rotation_euler = (0, 0, math.radians(rz))
    rig.scale = (scale,) * 3


PROPS = ["bicycle_lucie", "bicycle_martial", "bicycle_nour", "school_satchel", "milk_can", "felling_axe", "accordion"]


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((400, 560), SAMPLES)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    rig = load(os.environ.get("LPL_GLB", os.path.join(lpl.OUT, "personnages.glb")))
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF") and not m.name.startswith("mannequin"):
            lpl.set_emission(m, 0.0)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None and o.name.endswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    for p in PROPS:
        o = bpy.data.objects.get(p)
        if o is not None:
            o.rotation_mode = "XYZ"
    man = mannequin((0.0, 0.0))
    man.hide_render = True
    who = ONLY or H13.VILLAGERS
    if MODE in ("habitants", "tout"):
        for n in who:
            node = "villager_" + n
            s = H13.SCALES[n]
            parts = [node] + (["villager_ambroise_loupe_up"] if n == "ambroise" else [])
            show_only(rig, parts)
            pose(rig, "idle", 1)
            # corps: de face, de dos, de profil (à la caméra du jeu), mannequin de 1,80 m à côté
            man.hide_render = False
            man.location = (0.55, 0.55, 0.9)
            man.rotation_euler = (0, 0, math.radians(45))
            rapide = os.environ.get("LPL_RAPIDE")
            for tag, rz in (("face", 45), ("dos", 225), ("profil", -45))[:2 if rapide else 3]:
                place_rig(rig, rz, s)
                shot(f"{n}_{tag}", (0.25, 0.25, 0.92), 2.35, (380, 520))
            man.hide_render = True
            # buste face à la caméra et de trois quarts, puis les expressions
            place_rig(rig, 45, s)
            shot(f"{n}_buste", (0, 0, 1.36 * s), 0.95 * s, (380, 380))
            if rapide:
                continue
            place_rig(rig, 20, s)
            shot(f"{n}_buste34", (0, 0, 1.36 * s), 0.95 * s, (380, 380))
            place_rig(rig, 45, s)
            for e in EXPRS[1:]:
                set_expr(rig, node, e)
                shot(f"{n}_expr_{e}", (0, 0, 1.52 * s), 0.55 * s, (220, 220), elevation=20)
            set_expr(rig, node, "neutral")
            if n == "ambroise":
                show_only(rig, [node, "villager_ambroise_loupe"])
                shot(f"{n}_loupe", (0, 0, 1.52 * s), 0.55 * s, (220, 220), elevation=20)
    if MODE in ("rangee", "tout"):
        # les 21 habitants côte à côte à leur échelle, du plus petit au plus grand, mannequin au bout
        allv = {**OLD, **H13.SCALES}
        order = sorted(allv, key=lambda k: allv[k])
        rigs = []
        for i, n in enumerate(order):
            r2 = rig.copy()
            r2.animation_data_clear()
            bpy.context.scene.collection.objects.link(r2)
            r2.hide_render = False
            x = (i - len(order) / 2) * 0.62
            # pose de repos (les copies ne jouent pas de clip); file le long de l'axe horizontal de l'écran, soit la
            # direction (1, 1) pour la caméra à l'azimut 45
            r2.data.pose_position = "REST"
            place_rig(r2, 45, allv[n], (x * 0.7071, x * 0.7071, 0))
            src = bpy.data.objects["villager_" + n]
            o = src.copy()
            o.data = src.data
            bpy.context.scene.collection.objects.link(o)
            o.parent = r2
            for md in o.modifiers:
                if md.type == "ARMATURE":
                    md.object = r2
            o.hide_render = False
            rigs.append(r2)
        for c in rig.children:
            c.hide_render = True
        rig.hide_render = True
        show_only(rig, [])
        x = (len(order) / 2 + 0.2) * 0.62
        man.hide_render = False
        man.location = (x * 0.7071, x * 0.7071, 0.9)
        man.rotation_euler = (0, 0, math.radians(45))
        shot("rangee", (0.2, 0.2, 0.9), 14.5, (2400, 760))
        for r2 in rigs:
            for c in list(r2.children):
                bpy.data.objects.remove(c, do_unlink=True)
            bpy.data.objects.remove(r2, do_unlink=True)
        man.hide_render = True
        rig.hide_render = False
        rig.data.pose_position = "POSE"
    if MODE in ("accessoires", "tout"):
        sock_r = bpy.data.objects["socket_hand_r"]
        for owner, prop, clip, frame, rz in (("lucie", "bicycle_lucie", "push_bike", 4, 45),
                                              ("martial", "bicycle_martial", "push_bike", 4, 45),
                                              ("nour", "bicycle_nour", "push_bike", 4, 45),
                                              ("lucie", "bicycle_lucie", "push_bike_idle", 1, -45),
                                              ("martial", "bicycle_martial", "push_bike_idle", 1, 135),
                                              ("armand", "school_satchel", "idle", 1, 30),
                                              ("margot", "milk_can", "idle", 1, 30),
                                              ("barnabe", "felling_axe", "idle", 1, 30),
                                              ("colette", "accordion", "carry_one_idle", 1, 45)):
            s = H13.SCALES.get(owner, 1.0)
            show_only(rig, ["villager_" + owner, prop])
            place_rig(rig, rz, s)
            ob = bpy.data.objects[prop]
            if prop.startswith("bicycle"):
                ob.parent = None
                ob.location = (0, 0, 0)
                ob.rotation_euler = (0, 0, math.radians(rz))
                ob.scale = (s,) * 3
            elif prop == "accordion":
                ob.parent = None
                ob.location = (0, -0.3 * s, 1.08 * s)
                ob.rotation_euler = (0, 0, math.radians(rz))
                bpy.context.view_layer.update()
                from mathutils import Matrix
                ob.matrix_world = rig.matrix_world @ Matrix.Translation((0, -0.26, 1.06)) @ Matrix.Rotation(0, 4, "Z")
            else:
                ob.parent = sock_r
                ob.matrix_parent_inverse.identity()
                ob.location = (0, 0, 0)
                ob.rotation_mode = "XYZ"
                ob.rotation_euler = (0, 0, 0)
            pose(rig, clip, frame)
            shot(f"acc_{owner}_{prop}_{clip}", (0.2, 0.0, 0.85), 2.6 if prop.startswith("bicycle") else 2.2,
                 (460, 460))
            ob.hide_render = True


main()
