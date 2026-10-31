"""Vue de près d'un nœud sous quatre angles (azimuts 45, 135, 225, 315), pour vérifier qu'aucune pièce
ne dépasse, ne flotte ni ne traverse.

Lancer: duo-python verifier/quatre_angles.py <fichier.glb> <nœud> <image.png>
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

FICHIER, NOEUD, IMAGE = sys.argv[-3:]


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
        if o.type in ("MESH", "EMPTY") and o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    from mathutils import Vector
    pts = [ob.matrix_world @ Vector(c) for ob in keep if ob.type == "MESH" for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max(hi - lo) * 1.2
    shots = []
    for i, az in enumerate((45, 135, 225, 315)):
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.iso_camera(target=tuple(c), ortho=size, azimuth=az, elevation=30)
        f = f"{IMAGE[:-4]}-{i}.png"
        bpy.context.scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    print("ANGLES", " ".join(shots))


main()
