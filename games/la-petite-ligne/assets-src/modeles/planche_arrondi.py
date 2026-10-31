"""Planche avant et après du low poly arrondi (témoins du 2026-10-31).

Lancer: duo-python planche_arrondi.py <dossier des GLB d'avant> <dossier de sortie des images>
Les GLB d'avant se récupèrent dans Git, par exemple:
  git show <commit>:games/la-petite-ligne/assets/modeles/bourg.glb > avant/bourg.glb (idem personnages.glb)
Produit des rendus Cycles (même caméra isométrique que le jeu: azimut 45, élévation 35,264) que
`planche_arrondi.sh` assemble en planche.
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

AVANT, SORTIE = sys.argv[-2], sys.argv[-1]
APRES = lpl.OUT
PLAYER = ["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"]
BOURG = ["firmin_house", "tree_oak_large", "bush_round"]


def load(path, prefix, keep):
    before = set(bpy.data.objects)
    acts = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for a in bpy.data.actions:
        if a not in acts:
            a.name = prefix + a.name
    for o in new:
        o.name = prefix + o.name
    roots = {}
    keep_set = set()
    for o in new:
        base = o.name[len(prefix):]
        if base in keep:
            roots[base] = o
            keep_set.add(o)
            keep_set.update(o.children_recursive)
    for o in new:
        if o.type == "ARMATURE" and any(c in keep_set for c in o.children):
            keep_set.add(o)
            roots["rig"] = o
    for o in new:
        if o not in keep_set:
            bpy.data.objects.remove(o, do_unlink=True)
    return roots


def mannequin(loc):
    m = bpy.data.materials.new("mannequin")
    m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = (0.35, 0.33, 0.32, 1)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], 0.9))
    ob = bpy.context.active_object
    ob.scale = (0.3, 0.05, 1.8)
    ob.data.materials.append(m)
    ob.name = "mannequin_180"
    return ob


def pose(rig, prefix, clip, frame):
    act = bpy.data.actions[prefix + clip]
    if rig.animation_data is None:
        rig.animation_data_create()
    rig.animation_data.action = act
    rig.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(frame)


def show(objs, on):
    for o in objs:
        o.hide_render = not on
        for c in o.children_recursive:
            c.hide_render = not on


def shot(name, target, ortho, res):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.iso_camera(target=target, ortho=ortho)
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.filepath = os.path.join(SORTIE, name + ".png")
    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((1200, 675), 16)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    sets = {}
    for tag, folder in (("A_", AVANT), ("B_", APRES)):
        r = load(os.path.join(folder, "bourg.glb"), tag, BOURG)
        r.update(load(os.path.join(folder, "personnages.glb"), tag, PLAYER))
        sets[tag] = r
        r["firmin_house"].location = (0, 0, 0)
        r["tree_oak_large"].location = (5.6, 1.5, 0)
        r["bush_round"].location = (4.2, -0.9, 0)
        r["rig"].location = (1.6, -3.9, 0)
        r["rig"].rotation_mode = "XYZ"  # l'import glTF pose des quaternions: sans cela la rotation est ignorée
        r["rig"].rotation_euler = (0, 0, math.radians(20))
    mannequin((2.4, -3.9))
    # vue de jour: vitres et lanternes éteintes (le jeu met l'émission à 0 le jour)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF") and m.name.split(".")[0] != "mannequin":
            lpl.set_emission(m, 0.0)
    for o in bpy.data.objects:
        if o.type == "MESH" and o.parent is None and o.name.endswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    for tag in ("A_", "B_"):
        other = "B_" if tag == "A_" else "A_"
        show(sets[other].values(), False)
        show(sets[tag].values(), True)
        rig = sets[tag]["rig"]
        k = tag[0].lower()
        pose(rig, tag, "idle", 1)
        if os.environ.get("LPL_VISAGES_SEULS"):
            clips_shots = False
        else:
            clips_shots = True
        if clips_shots:
            shot(f"jeu24_{k}", (0.8, -0.5, 1.2), 24, (1200, 675))
            shot(f"maison_{k}", (0, 0, 2.2), 9.5, (900, 700))
            shot(f"nature_{k}", (5.0, 0.4, 1.7), 8.0, (900, 700))
        for clip, frame in (() if not clips_shots else (("idle", 1), ("walk", 5), ("hoe", 9), ("water", 15), ("carry_two", 6))):
            pose(rig, tag, clip, frame)
            shot(f"perso_{clip}_{k}", (1.6, -3.9, 0.9), 2.3, (500, 650))
        # gros plans du visage, tourné vers la caméra isométrique, dans chaque expression
        # 45 degrés: le visage (vers -Y) regarde la caméra isométrique placée au sud-est
        rig.rotation_euler = (0, 0, math.radians(45))
        pose(rig, tag, "idle", 1)
        base = bpy.data.objects[tag + "player_base"]
        keys = base.data.shape_keys.key_blocks
        for expr in ("neutral", "happy", "delighted", "tired", "hungry", "blink"):
            for kb in keys:
                kb.value = 1.0 if kb.name == expr else 0.0
            shot(f"visage_{expr}_{k}", (1.6, -3.9, 1.56), 0.62, (400, 400))
        for kb in keys:
            kb.value = 0.0
        rig.rotation_euler = (0, 0, math.radians(20))


main()
