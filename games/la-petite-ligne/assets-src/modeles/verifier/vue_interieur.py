"""Vue de près d'un bâtiment visitable comme le jeu le montre au joueur qui est dedans (ADR 0016): toit, étage
et comble retirés (`cut_nodes` du nœud), murs qui regardent la caméra coupés, contenu `<id>_interior`
visible; ou le bâtiment entier vu du dehors (--entier).

Lancer: duo-python verifier/vue_interieur.py <fichier.glb> <nœud> <image.png> [--azimuts 45,135,225,315]
        [--elevation 35] [--marge 1.15] [--entier 1] [--cacher a,b] [--montrer a,b] [--res 900x700]
        [--cible x,y,z --taille m] (cadrage imposé, repère Blender après import: x, -z glTF, y glTF)
Une image par azimut: <image>-<i>.png.
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402


def _args():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    args = [a for a in args if not a.endswith("vue_interieur.py")]
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


def main():
    lpl.reset()
    w, h = (int(v) for v in OPTS.get("res", "900x700").split("x"))
    lpl.setup_render((w, h), int(OPTS.get("samples", 16)))
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
    whole = OPTS.get("entier") == "1"
    hide = set(filter(None, OPTS.get("cacher", "").split(",")))
    show = set(filter(None, OPTS.get("montrer", "").split(",")))
    cut_nodes = set(root.get("cut_nodes", []))
    dg = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in keep:
        if ob.type == "MESH":
            pts += [ob.matrix_world @ v.co for v in ob.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = (lo + hi) / 2
    size = max(hi.x - lo.x, hi.y - lo.y) * float(OPTS.get("marge", 1.15))
    if "cible" in OPTS:
        c = Vector(tuple(float(v) for v in OPTS["cible"].split(",")))
        size = float(OPTS.get("taille", size))
    centre = root.matrix_world.translation
    shots = []
    for i, az in enumerate(float(a) for a in OPTS.get("azimuts", "45,135,225,315").split(",")):
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        el = float(OPTS.get("elevation", 35.264))
        lpl.iso_camera(target=tuple(c), ortho=size, azimuth=az, elevation=el)
        cam = bpy.context.scene.camera
        to_cam = (cam.location - c)
        to_cam.z = 0
        to_cam.normalize()
        for ob in keep:
            if ob.type != "MESH":
                continue
            visible = True
            if ob.name in hide:
                visible = False
            elif not whole:
                if ob.name in cut_nodes or any(ob.name == n or ob.parent and ob.parent.name == n for n in cut_nodes):
                    visible = False
                elif "_wall_" in ob.name and ob.parent is not None and ob.parent.name in (NOEUD,):
                    bb = [ob.matrix_world @ Vector(v) for v in ob.bound_box]
                    bc = sum(bb, Vector()) / 8 - centre
                    bc.z = 0
                    face = Vector((math.copysign(1, bc.x), 0, 0)) if abs(bc.x) > abs(bc.y) else Vector((0, math.copysign(1, bc.y), 0))
                    if face.dot(to_cam) > 0.25:
                        visible = False
            elif ob.name.endswith("_interior"):
                visible = False
            if ob.name in show:
                visible = True
            ob.hide_render = not visible
        f = f"{IMAGE[:-4]}-{i}.png"
        bpy.context.scene.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    del dg
    print("VUES", " ".join(shots))


main()
