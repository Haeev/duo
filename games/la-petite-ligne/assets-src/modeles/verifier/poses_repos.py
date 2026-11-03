"""Calcule les angles des bras des poses de repos des témoins (temoins.idle_clips) par descente sur le squelette du
gabarit: poignet et coude visés (repère Blender), le reste de la pose fixé. Imprime les angles à reporter.

Lancer: duo-python verifier/poses_repos.py
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import gabarits as G  # noqa: E402

WE = 2.0
CASES = {
    # Colette, poing gauche sur la hanche: poignet contre la taille, coude écarté et un peu en arrière
    "colette": ("rond", {"hips": (0, -4, 3), "spine": (0, 3, -2), "chest": (-2, 2, -2)},
                [("l", Vector((0.228, 0.005, 1.0)), Vector((0.33, 0.06, 1.13)), Vector((0.218, 0.03, 0.915)))]),
    # Firmin, mains dans le dos: poignets derrière les reins, coudes en arrière
    "firmin": ("trapu", {"spine": (-3, 0, 0), "chest": (-3, 0, 0)},
               [("l", Vector((0.06, 0.2, 0.97)), Vector((0.235, 0.1, 1.07)), Vector((0.0, 0.215, 0.93))),
                ("r", Vector((-0.06, 0.2, 0.97)), Vector((-0.235, 0.1, 1.07)), Vector((0.0, 0.215, 0.93)))]),
}


def rig(gab):
    ad = bpy.data.armatures.new("r_" + gab)
    ob = bpy.data.objects.new("r_" + gab, ad)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, par in G.bones(gab):
        eb = ad.edit_bones.new(name)
        eb.head, eb.tail = h, t
        if par:
            eb.parent = ad.edit_bones[par]
        eb.align_roll(Vector((0, 0, 1)) if name.startswith("foot") else Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in ob.pose.bones:
        pb.rotation_mode = "XYZ"
    return ob


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for who, (gab, fixed, arms) in CASES.items():
        ob = rig(gab)
        for b, r in fixed.items():
            ob.pose.bones[b].rotation_euler = tuple(math.radians(a) for a in r)
        for side, wrist, elbow, tip in arms:
            up, fo = ob.pose.bones["upper_arm_" + side], ob.pose.bones["forearm_" + side]
            def cost(q):
                up.rotation_euler = tuple(math.radians(a) for a in q[:3])
                fo.rotation_euler = (math.radians(q[3]), 0, 0)
                bpy.context.view_layer.update()
                w = ob.matrix_world @ fo.tail
                e = ob.matrix_world @ fo.head
                return (w - wrist).length ** 2 + WE * (e - elbow).length ** 2

            def descend(p):
                best = cost(p)
                step = 32.0
                while step > 0.25:
                    moved = False
                    for i in range(4):
                        for d in (step, -step):
                            q = list(p)
                            q[i] += d
                            if not (0 <= q[3] <= 140 and -180 <= q[1] <= 180):
                                continue
                            c = cost(q)
                            if c < best:
                                best, p, moved = c, q, True
                    if not moved:
                        step /= 2
                return best, p
            # plusieurs départs (la descente reste sinon dans un creux local)
            starts = [[0.0, 0.0, 0.0, 30.0]] + [[-25.0, y, z, 90.0] for y in (90.0, -90.0) for z in (15.0, -15.0)]
            best, p = min((descend(s) for s in starts), key=lambda r: r[0])
            cost(p)
            hb = ob.pose.bones["hand_" + side]
            h = [0.0, 0.0, 0.0]

            def hcost(q):
                hb.rotation_euler = tuple(math.radians(a) for a in q)
                bpy.context.view_layer.update()
                return ((ob.matrix_world @ hb.tail) - tip).length

            hb_best = hcost(h)
            step = 32.0
            while step > 0.5:
                moved = False
                for i in range(3):
                    for d in (step, -step):
                        q = list(h)
                        q[i] += d
                        if abs(q[i]) > 90:
                            continue
                        c = hcost(q)
                        if c < hb_best:
                            hb_best, h, moved = c, q, True
                if not moved:
                    step /= 2
            print(f"{who} {side}: hand ({h[0]:.0f}, {h[1]:.0f}, {h[2]:.0f}) écart {hb_best:.3f}")
            w = ob.matrix_world @ fo.tail
            print(f"{who} {side}: upper_arm ({p[0]:.0f}, {p[1]:.0f}, {p[2]:.0f}) forearm ({p[3]:.0f}, 0, 0) "
                  f"poignet {tuple(round(c, 3) for c in w)} écart {math.sqrt(best):.3f}")


main()
