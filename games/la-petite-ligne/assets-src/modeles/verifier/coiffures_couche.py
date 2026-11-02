"""Mesure, pose `sleep` (couché sur le dos, dos à 0,5 m sur le lit double), du point le plus bas de chaque coupe,
barbe et de la tête, comparé au dessus de l'oreiller du lit double (0,62 m) et du matelas (0,5 m): une coupe ne
doit pas descendre sous le dessus de l'oreiller plus bas que la tête elle-même (elle s'enfoncerait dedans).

Lancer après personnages.py: duo-python verifier/coiffures_couche.py
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

bpy.ops.wm.open_mainfile(filepath=os.path.join(lpl.HERE, "blend", "personnages.blend"))
rig = bpy.data.objects["rig"]
act = bpy.data.actions["sleep"]
ad = rig.animation_data_create()
ad.action = act
ad.action_slot = act.slots[0]
rig.location = (0, 0, 0.5)
PILLOW_TOP = 0.5 + 0.12
res = []
for frame in (0, 50):
    bpy.context.scene.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.startswith(("player_hair_", "player_beard", "player_mustache", "player_base")):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        zs = [(ev.matrix_world @ v.co).z for v in me.vertices]
        res.append((frame, o.name, min(zs)))
        ev.to_mesh_clear()
head = {f: z for f, n, z in res if n == "player_base"}
print("MESURE dessus de l'oreiller", PILLOW_TOP)
for f, n, z in sorted(res, key=lambda r: (r[0], r[2])):
    print(f"MESURE image {f} {n}: point bas {z:.3f} m, {z - head[f]:+.3f} m par rapport à la tête")
