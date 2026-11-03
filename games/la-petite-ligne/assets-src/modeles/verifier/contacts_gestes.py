"""Instant du contact des gestes d'outil (main droite au plus bas), à comparer à `gestureImpact` de
`src/rendu/reglages.ts` (houe 0,53 s, récolte 0,34 s, marteau 0,27 s, semis 0,4 s; hache 0,62 s à mi-descente).

Lancer: duo-python verifier/contacts_gestes.py <personnages.glb> [<autre personnages.glb> ...]
Échantillonne chaque clip toutes les demi-images (60 par seconde) (la prise `socket_hand_r` en repère du monde).
"""
import os
import sys

import bpy  # noqa: I001

CLIPS = {"hoe": 0.53, "harvest": 0.34, "hammer": 0.27, "sow": 0.4, "chop": 0.62, "pickup": 0.43, "feed": 0.4}


def measure(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # l'import convertit les secondes en images à la cadence de la scène: 30 i/s comme l'export
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=path)
    rig = [o for o in bpy.data.objects if o.type == "ARMATURE"][0]
    sock = [o for o in bpy.data.objects if o.name.startswith("socket_hand_r")][0]
    sc = bpy.context.scene
    out = {}
    for clip in CLIPS:
        act = bpy.data.actions.get(clip)
        if act is None:
            continue
        rig.animation_data.action = act
        rig.animation_data.action_slot = act.slots[0]
        f0, f1 = act.frame_range
        best = None
        n = int((f1 - f0) * 2)
        for i in range(n + 1):
            f = f0 + i / 2
            sc.frame_set(int(f), subframe=f - int(f))
            z = sock.matrix_world.translation.z
            if best is None or z < best[1]:
                best = (f / 30.0, z)
        out[clip] = best
    return out


for p in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]:
    if not p.endswith(".glb"):
        continue
    r = measure(p)
    print("CONTACTS", os.path.basename(os.path.dirname(p)) or p,
          {k: (round(t, 3), round(z, 3), CLIPS[k]) for k, (t, z) in r.items()})
