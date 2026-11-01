"""Vue de près d'un nœud sous quatre angles (azimuts 45, 135, 225, 315), pour vérifier qu'aucune pièce
ne dépasse, ne flotte ni ne traverse.

Lancer: duo-python verifier/quatre_angles.py <fichier.glb> <nœud> <image.png> [--pose <clip>:<image>] [--elevation <degrés>]
       [--azimuts 90,270] (profil strict: 90 et 270; par défaut 45,135,225,315) [--marge 1.5] (cadre: taille x marge)
--pose: pour un squelette (faune), pose le nœud sur une image d'un de ses clips (sinon la pose de repos,
ailes dépliées pour les oiseaux). Le cadrage suit le maillage déformé.
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402


def _args():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith("quatre_angles.py")]
    opts, pos, i = {}, [], 0
    while i < len(args):
        if args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1]
            i += 2
        else:
            pos.append(args[i])
            i += 1
    return pos[-3:], opts


(FICHIER, NOEUD, IMAGE), OPTS = _args()


def pose(root, spec):
    clip, frame = spec.split(":")
    act = bpy.data.actions[clip]
    ad = root.animation_data or root.animation_data_create()
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    ad.action = act
    ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(frame))


def main():
    lpl.reset()
    lpl.setup_render((700, 600), 16)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(200, lpl.hex_lin("#A7B98A"), z=-0.002)
    path = FICHIER if os.path.isabs(FICHIER) else os.path.join(lpl.OUT, FICHIER)
    bpy.ops.import_scene.gltf(filepath=path)
    root = bpy.data.objects[NOEUD]
    keep = {root, *root.children_recursive}
    for o in list(bpy.data.objects):
        if o.type in ("MESH", "EMPTY", "ARMATURE") and o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    if "pose" in OPTS:
        pose(root, OPTS["pose"])
    from mathutils import Vector
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in keep:
        if ob.type == "MESH":
            ev = ob.evaluated_get(dg)
            me = ev.to_mesh()
            pts += [ev.matrix_world @ v.co for v in me.vertices]
            ev.to_mesh_clear()
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max(hi - lo) * float(OPTS.get("marge", 1.2))
    shots = []
    azimuts = [float(a) for a in OPTS.get("azimuts", "45,135,225,315").split(",")]
    for i, az in enumerate(azimuts):
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.iso_camera(target=tuple(c), ortho=size, azimuth=az, elevation=float(OPTS.get("elevation", 30)))
        f = f"{IMAGE[:-4]}-{i}.png"
        bpy.context.scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    print("ANGLES", " ".join(shots))


main()
