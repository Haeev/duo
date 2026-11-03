"""Contact des fruits et des fleurs avec leur arbre (foret013.glb): chaque îlot d'un enfant `*_fruit`, `*_flowers`
ou `*_grapes` doit toucher le maillage de son parent (recouvrement ou sommet à moins de 1 cm), sinon il pend en
l'air. controle_geometrie.py examine chaque nœud seul et les signale tous comme flottants: ce contrôle-ci les
juge avec leur hôte.

Lancer: duo-python verifier/fruits_contact.py [fichier.glb]
"""
import os
import sys

import bpy  # noqa: I001
import bmesh
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
args = [a for a in sys.argv[1:] if a.endswith(".glb")]
FICHIER = args[0] if args else os.path.join(ICI, "..", "..", "..", "assets", "modeles", "foret013.glb")


def world_bm(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bm.transform(ob.matrix_world)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    return bm


def islands(bm):
    bm.faces.ensure_lookup_table()
    seen, out = set(), []
    for f in bm.faces:
        if f in seen:
            continue
        stack, comp = [f], []
        seen.add(f)
        while stack:
            c = stack.pop()
            comp.append(c)
            for e in c.edges:
                for g in e.link_faces:
                    if g not in seen:
                        seen.add(g)
                        stack.append(g)
        out.append(comp)
    return out


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(FICHIER))
    bpy.context.view_layer.update()
    total = bad = 0
    for ob in bpy.data.objects:
        if ob.type != "MESH" or not ob.name.endswith(("_fruit", "_flowers", "_grapes")) or ob.parent is None:
            continue
        host = world_bm(ob.parent)
        tree = BVHTree.FromBMesh(host)
        bm = world_bm(ob)
        for comp in islands(bm):
            total += 1
            verts = {v for f in comp for v in f.verts}
            d = min(tree.find_nearest(v.co)[3] for v in verts)
            sub = bmesh.new()
            m = {}
            for v in verts:
                m[v] = sub.verts.new(v.co)
            for f in comp:
                sub.faces.new([m[v] for v in f.verts])
            hit = bool(BVHTree.FromBMesh(sub).overlap(tree))
            sub.free()
            if not hit and d > 0.01:
                bad += 1
                pts = [v.co for v in verts]
                c = sum(pts[1:], pts[0].copy()) / len(pts)
                print(f"FRUIT EN L'AIR {ob.name} vers ({c.x:.2f}, {c.y:.2f}, {c.z:.2f}), {d * 100:.1f} cm")
        bm.free()
        host.free()
    print(f"FRUITS {total} îlots, {bad} en l'air")


if __name__ == "__main__":
    main()
