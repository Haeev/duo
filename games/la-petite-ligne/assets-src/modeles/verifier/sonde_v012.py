"""Sonde des clips de la chèvre et des poules de la 0.12, dans les GLB livrés: point le plus bas du maillage
déformé image par image (un sabot ou une patte qui s'enfonce, un corps qui flotte), hauteur du mufle pendant
goat_graze (il doit toucher l'herbe), hauteur du collier (socket_goat_neck).

Lancer: duo-python verifier/sonde_v012.py
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402


def load(name):
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, name + ".glb"))


def frames(act):
    a, b = act.frame_range
    return range(int(a), int(b) + 1, 2)


def probe(arm, mesh, clip, extra=None):
    ad = arm.animation_data or arm.animation_data_create()
    for t in list(ad.nla_tracks):
        ad.nla_tracks.remove(t)
    act = bpy.data.actions[clip]
    ad.action = act
    ad.action_slot = act.slots[0]
    lo, hi_lo = 9.0, -9.0
    ext = []
    for f in frames(act):
        bpy.context.scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = mesh.evaluated_get(dg)
        me = ev.to_mesh()
        z = min((ev.matrix_world @ v.co).z for v in me.vertices)
        if extra:
            ext.append(extra(ev, me))
        ev.to_mesh_clear()
        lo = min(lo, z)
        hi_lo = max(hi_lo, z)
    out = f"{mesh.name:14s} {clip:16s} point bas: de {lo:+.3f} à {hi_lo:+.3f} m"
    if ext:
        out += f"   mesure: de {min(ext):+.3f} à {max(ext):+.3f}"
    print(out)


def main():
    lpl.reset()
    load("elevage")
    load("ferme")
    goat = bpy.data.objects["goat"]

    def muzzle(ev, me):
        # tête = sommets de l'os goat_head (peau rigide): leur point le plus bas est le bout du mufle ou la barbiche
        gi = ev.vertex_groups["goat_head"].index
        return min((ev.matrix_world @ v.co).z for v in me.vertices if any(g.group == gi for g in v.groups))
    for robe in ("goat_chamois", "goat_white"):
        m = bpy.data.objects[robe]
        for clip in ("goat_idle", "goat_walk", "goat_trot", "goat_milk_stand", "goat_lie", "goat_bell"):
            probe(goat, m, clip)
        probe(goat, m, "goat_graze", muzzle)
    hen = bpy.data.objects["hen"]
    for v in ("hen_golden", "hen_ash", "hen_cuckoo", "hen_rooster", "hen_chick"):
        for clip in ("hen_idle", "hen_walk", "hen_peck"):
            probe(hen, bpy.data.objects[v], clip)
    sock = bpy.data.objects["socket_goat_neck"]
    goat.animation_data.action = None
    for pb in goat.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    bpy.context.view_layer.update()
    print("socket_goat_neck au repos:", tuple(round(c, 3) for c in sock.matrix_world.translation))


if __name__ == "__main__":
    main()
