"""Planche avant et après des personnages arrondis: habitants et joueur (corps entier et visages).

Lancer: duo-python planche_habitants.py <dossier des GLB d'avant> <dossier de sortie des images>
Assemblage: planche_habitants.sh.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from planche_arrondi import AVANT, APRES, SORTIE, load, mannequin, pose, shot  # noqa: E402

PEOPLE = {
    "player": ["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"],
    "firmin": ["villager_firmin"], "odette": ["villager_odette"], "basile": ["villager_basile"],
    "jeanne": ["villager_jeanne"], "lucie": ["villager_lucie"],
    "smock_bob": ["player_base", "player_outfit_smock", "player_hair_bob", "player_scarf_star"],
    "overalls_bun": ["player_base", "player_outfit_overalls", "player_hair_bun", "player_scarf_comet"],
}
EXPRS = ("neutral", "happy", "delighted", "tired", "hungry", "blink")


def main():
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((500, 650), 16)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    keep = sorted({n for v in PEOPLE.values() for n in v})
    sets = {}
    for tag, folder in (("A_", AVANT), ("B_", APRES)):
        r = load(os.path.join(folder, "personnages.glb"), tag, keep)
        r["rig"].location = (0, 0, 0)
        r["rig"].rotation_mode = "XYZ"
        sets[tag] = r
    mannequin((0.75, 0.0))
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None and o.name.endswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    for tag in ("A_", "B_"):
        k = tag[0].lower()
        other = sets["B_" if tag == "A_" else "A_"]
        for o in other.values():
            o.hide_render = True
            for c in o.children_recursive:
                c.hide_render = True
        rig = sets[tag]["rig"]
        rig.hide_render = False
        for who, parts in PEOPLE.items():
            for c in rig.children:
                c.hide_render = c.name[len(tag):] not in parts
            scale = 0.75 if who == "jeanne" else 1.0
            rig.scale = (scale, scale, scale)
            rig.rotation_euler = (0, 0, math.radians(20))
            pose(rig, tag, "idle", 1)
            shot(f"corps_{who}_{k}", (0, 0, 0.9), 2.3, (500, 650))
            if who in ("player", "firmin", "odette", "basile", "jeanne"):
                rig.rotation_euler = (0, 0, math.radians(45))
                face = [c for c in rig.children if c.name[len(tag):] in parts and c.data.shape_keys][0]
                keys = face.data.shape_keys.key_blocks
                for expr in EXPRS if who == "player" else ("neutral", "blink"):
                    for kb in keys:
                        kb.value = 1.0 if kb.name == expr else 0.0
                    shot(f"visage_{who}_{expr}_{k}", (0, 0, 1.56 * scale), 0.62 * scale, (400, 400))
                for kb in keys:
                    kb.value = 0.0
        rig.scale = (1, 1, 1)


main()
