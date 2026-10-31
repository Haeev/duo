"""Planche avant et après du low poly arrondi pour une liste de nœuds d'un GLB du décor.

Lancer: duo-python planche_bourg.py <dossier des GLB d'avant> <dossier de sortie> <fichier.glb> <nom> <nœud,...>
Pose les nœuds sur une rangée (même place avant et après), rend une vue isométrique d'ensemble pour
chaque version, puis un gros plan par nœud. Assemblage: planche_bourg.sh.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

AVANT, SORTIE, FICHIER, NOM, NOEUDS = sys.argv[-5:]
NOEUDS = NOEUDS.split(",")


def load(path, prefix):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    for o in new:
        o.name = prefix + o.name
    roots, keep = {}, set()
    for o in new:
        base = o.name[len(prefix):]
        if base in NOEUDS:
            roots[base] = o
            keep.add(o)
            keep.update(o.children_recursive)
    for o in new:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in roots.values():
        o.rotation_mode = "XYZ"
    return roots


def size_of(o):
    from mathutils import Vector
    pts = []
    for ob in [o] + list(o.children_recursive):
        if ob.type == "MESH":
            pts += [ob.matrix_world @ Vector(c) for c in ob.bound_box]
    if not pts:
        return 1.0, 1.0
    xs = [p.x for p in pts]
    zs = [p.z for p in pts]
    return max(max(xs) - min(xs), 1.0), max(zs) - min(zs)


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
    lpl.setup_render((1600, 700), 16)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(600, lpl.hex_lin("#A7B98A"), z=-0.002)
    sets = {t: load(os.path.join(f, FICHIER), t) for t, f in (("A_", AVANT), ("B_", lpl.OUT))}
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    # rangée le long de la diagonale de l'écran (droite de la caméra isométrique)
    R = (1 / math.sqrt(2), 1 / math.sqrt(2))
    pos, u, hmax = {}, 0.0, 0.0
    for n in NOEUDS:
        w, h = size_of(sets["B_"][n])
        u += w / 2 + 0.8
        pos[n] = (u * R[0], u * R[1])
        u += w / 2 + 0.8
        hmax = max(hmax, h)
    for t in sets:
        for n, o in sets[t].items():
            o.location = (pos[n][0], pos[n][1], 0)
    centre = (u / 2 * R[0], u / 2 * R[1], hmax / 3)
    for t in ("A_", "B_"):
        other = sets["B_" if t == "A_" else "A_"]
        for o in other.values():
            for ob in [o] + list(o.children_recursive):
                ob.hide_render = True
        for o in sets[t].values():
            for ob in [o] + list(o.children_recursive):
                ob.hide_render = False
            # états alternatifs (ruine / réparé): on montre le premier, comme le jeu par défaut
        k = t[0].lower()
        shot(f"{NOM}_ensemble_{k}", centre, u * 0.75, (1600, 700))
        for n, o in sets[t].items():
            w, h = size_of(o)
            shot(f"{NOM}_{n}_{k}", (pos[n][0], pos[n][1], h / 2.5), max(w, h) * 1.25, (700, 560))


main()
