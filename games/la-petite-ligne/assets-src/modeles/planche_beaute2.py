"""Planches avant et après de la passe beauté de la 0.12 (coupes, habitants, clips).

Lancer: duo-python planche_beaute2.py <dossier du personnages.glb d'avant> <dossier de sortie des images>
Variables: LPL_MODE (coupes, habitants, clips ou tout), LPL_ECHELLE (taille des images), LPL_SAMPLES.
Assemblage: planche_beaute2.sh. Même caméra que le jeu (azimut 45, élévation 35,264), Cycles sur CPU.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coiffures  # noqa: E402
import garde_robe as GR  # noqa: E402
import lpl  # noqa: E402
from planche_arrondi import AVANT, APRES, SORTIE, load, mannequin, pose  # noqa: E402
from planche_arrondi import shot as _shot  # noqa: E402
from planche_beaute_outils import LOOKS, look_material, parts_of  # noqa: E402

SCALE = float(os.environ.get("LPL_ECHELLE", "1"))
CUTS = ["short", "bob", "bun"] + coiffures.NEW_CUTS
NPCS = ["firmin", "odette", "basile", "jeanne", "lucie", "achille", "solange"]
# clip, images (contact et poses qui se lisent), accessoire
CLIPS = [("idle", (30, 105), None), ("walk", (2, 6), None), ("hoe", (5, 13, 16), "hoe"), ("chop", (12, 17), "axe"),
         ("harvest", (16, 27), None), ("water", (16,), "watering_can"), ("talk", (24,), None), ("give", (14,), None),
         ("eat", (15,), None), ("sit_down", (6, 12), "chair"), ("pickup", (13, 24), None), ("feed", (12,), None),
         ("cook", (12,), None), ("drink", (24,), None), ("carry_one", (2,), None), ("hammer", (4, 8), "hammer")]


def shot(name, target, ortho, res):
    _shot(name, target, ortho, (int(res[0] * SCALE), int(res[1] * SCALE)))


def show_parts(rig, tag, parts, mat=None):
    rig.hide_render = False
    for c in rig.children:
        on = c.name[len(tag):] in parts
        c.hide_render = not on
        if on and mat is not None and c.type == "MESH":
            c.data.materials[0] = mat


def hide_set(objs):
    for o in objs:
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True


def main():
    mode = os.environ.get("LPL_MODE", "tout")
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((420, 600), int(os.environ.get("LPL_SAMPLES", "6")))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    names = {"socket_hand_r", "player_base", "wear_top_tshirt"} | {"villager_" + n for n in NPCS}
    names |= {"player_hair_" + h for h in CUTS}
    for lk in LOOKS.values():
        names.update(parts_of(lk))
    sets = {"a": load(os.path.join(AVANT, "personnages.glb"), "A_", sorted(names)),
            "b": load(os.path.join(APRES, "personnages.glb"), "B_", sorted(names))}
    props = {}
    for k, tag in (("a", "A_"), ("b", "B_")):
        r = sets[k]
        r["rig"].location = (0, 0, 0)
        r["rig"].rotation_mode = "XYZ"
        t = load(os.path.join(APRES, "ferme.glb"), tag + "t_", ["hoe", "axe", "watering_can", "hammer"])
        t.update(load(os.path.join(APRES, "maison.glb"), tag + "m_", ["chair"]))
        props[k] = t
        hide_set(t.values())
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF") and not m.name.startswith("mannequin"):
            lpl.set_emission(m, 0.0)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None and o.name.endswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    base_mat = [c for c in sets["b"]["rig"].children if c.type == "MESH"][0].data.materials[0]
    mats = {k: look_material(base_mat, k, lk) for k, lk in LOOKS.items()}
    man = mannequin((0.75, 0.0))
    man.hide_render = True
    for k, tag in (("a", "A_"), ("b", "B_")):
        other = sets["b" if k == "a" else "a"]
        hide_set([other["rig"]])
        rig = sets[k]["rig"]
        sock = sets[k]["socket_hand_r"]
        if mode in ("coupes", "tout"):
            for i, h in enumerate(CUTS):
                show_parts(rig, tag, ["player_base", "wear_top_tshirt", "player_hair_" + h], mats["fcebad"[i % 6]])
                for az, side in ((30, "av"),):
                    rig.rotation_euler = (0, 0, math.radians(az))
                    pose(rig, tag, "idle", 1)
                    shot(f"coupe_{h}_{side}_{k}", (0, 0, 1.55), 0.72, (240, 240))
        if mode in ("habitants", "tout"):
            for n in NPCS:
                show_parts(rig, tag, ["villager_" + n])
                s = 0.75 if n == "jeanne" else 1.0
                rig.scale = (s, s, s)
                rig.rotation_euler = (0, 0, math.radians(20))
                pose(rig, tag, "idle", 1)
                shot(f"pnj_{n}_{k}", (0, 0, 0.9 * s), 2.2 * s, (300, 420))
                rig.rotation_euler = (0, 0, math.radians(45))
                shot(f"visage_{n}_{k}", (0, 0, 1.5 * s), 0.7 * s, (260, 260))
            rig.scale = (1, 1, 1)
        if mode in ("clips", "tout"):
            show_parts(rig, tag, parts_of(LOOKS["a"]), mats["a"])
            rig.rotation_euler = (0, 0, math.radians(-60))
            for clip, frames, prop in CLIPS:
                act = bpy.data.actions.get(tag + clip)
                ob = props[k].get(prop) if prop else None
                if ob is not None:
                    if prop == "chair":
                        ob.parent = None
                        ob.rotation_mode = "XYZ"
                        ob.location = (0, 0, 0)
                        ob.rotation_euler = (0, 0, math.radians(-60))
                    else:
                        ob.parent = sock
                        ob.matrix_parent_inverse.identity()
                        ob.location = (0, 0, 0)
                        ob.rotation_mode = "QUATERNION"
                        ob.rotation_quaternion = (1, 0, 0, 0)
                    ob.hide_render = False
                    for c in ob.children_recursive:
                        c.hide_render = False
                for f in frames:
                    name = f"clip_{clip}_{f:03d}_{k}"
                    if act is None:
                        continue
                    pose(rig, tag, clip, f)
                    shot(name, (0, 0, 0.85), 2.3, (240, 320))
                if ob is not None:
                    hide_set([ob])
    _ = GR


main()
