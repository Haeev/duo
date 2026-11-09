"""Contrôle: un drap cache-t-il entièrement ce qu'il couvre ? Pour chaque sommet des objets dessous, un rayon vers le
haut doit rencontrer le drap (aucun pied ni dossier ne perce ni ne dépasse), et aucun triangle du drap ne traverse
un objet.

Usage: duo-python drap_couvre.py -- <drap.glb[@x,y,z,rot]> <objet.glb[@x,y,z,rot]>...
"""
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = [a for a in sys.argv[sys.argv.index("--") + 1:] if a != "--bornes"]
bpy.ops.wm.read_factory_settings(use_empty=True)


def charger(p):
    """`fichier.glb` ou `fichier.glb@x,y,z,rotation` (pose glTF du jeu, rotation autour de +Y en degrés)."""
    pose = None
    if "@" in p:
        p, s = p.split("@")
        pose = [float(v) for v in s.split(",")]
    avant = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    new = [o for o in bpy.data.objects if o not in avant]
    if pose:
        for o in new:
            if o.parent is None:
                o.location = Vector((pose[0], -pose[2], pose[1])) + o.location
                o.rotation_mode = "XYZ"
                o.rotation_euler.z += math.radians(pose[3])
        bpy.context.view_layer.update()
    obs = [o for o in new if o.type == "MESH"]
    bm = bmesh.new()
    for o in obs:
        me = o.data.copy()
        me.transform(o.matrix_world)
        bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    if "--bornes" in sys.argv:
        co = [v.co for v in bm.verts]
        print("   bornes", os.path.basename(p), [round(min(c[i] for c in co), 3) for i in range(3)], [round(max(c[i] for c in co), 3) for i in range(3)])
    return bm


drap = charger(argv[0])
bd = BVHTree.FromBMesh(drap)
total = 0
for p in argv[1:]:
    bm = charger(p)
    bo = BVHTree.FromBMesh(bm)
    sans = [v.co.copy() for v in bm.verts if bd.ray_cast(v.co + Vector((0, 0, 0.0005)), Vector((0, 0, 1)))[0] is None]
    paires = bd.overlap(bo)
    trav = len(paires)
    if paires:
        bm.faces.ensure_lookup_table()
        cs = [bm.faces[j].calc_center_median() for _, j in paires]
        print("    objet traversé autour de:", [round(min(c[i] for c in cs), 3) for i in range(3)], [round(max(c[i] for c in cs), 3) for i in range(3)])
    total += len(sans) + trav
    print(f"{os.path.basename(p)}: {len(bm.verts)} sommets, {len(sans)} sans drap au-dessus, {trav} triangles qui se traversent")
    if sans:
        print("    bornes des sommets découverts:", [round(min(c[i] for c in sans), 3) for i in range(3)], [round(max(c[i] for c in sans), 3) for i in range(3)])
    for c in sans[:3]:
        print("   ", tuple(round(x, 3) for x in c))
print("DRAP OK" if total == 0 else "DRAP EN DEFAUT")
