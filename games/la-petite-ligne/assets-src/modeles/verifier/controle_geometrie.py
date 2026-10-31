"""Contrôle automatique de la géométrie des GLB (Blender 5.2): pièces qui flottent, faces inversées,
pièces qui en traversent une autre de part en part.

Lancer: duo-python verifier/controle_geometrie.py [fichier.glb ...]   (défaut: tous les GLB des modèles)
Chaque nœud est découpé en pièces (îlots de faces reliées). Signalé:
- FLOTTE: pièce dont le point le plus bas est au-dessus du sol (plus de 2 cm) et qui ne touche
  aucune autre pièce du même nœud (plus de 6 mm de jeu): elle ne porte sur rien;
- INVERSEE: pièce fermée dont le volume signé est négatif (faces tournées vers l'intérieur);
- TRAVERSE: pièce fine et longue (poutre, planche, poteau) dont les deux bouts dépassent de part
  et d'autre d'une pièce plus grande qu'elle coupe (une poutre qui passe à travers un toit).
Le rapport est indicatif: chaque cas se vérifie à l'œil sur une vue de près.
Les personnages (peau rigide, pièces jointives par construction) et les nœuds d'eau sont ignorés.
"""
import os
import sys

import bpy  # noqa: I001
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ICI = os.path.dirname(os.path.abspath(__file__))
MODELES = os.path.normpath(os.path.join(ICI, "..", "..", "..", "assets", "modeles"))
IGNORE = ("personnages.glb",)


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


def part_info(faces):
    verts = list({v for f in faces for v in f.verts})
    idx = {v: i for i, v in enumerate(verts)}
    co = [v.co.copy() for v in verts]
    polys = [[idx[v] for v in f.verts] for f in faces]
    closed = all(len(e.link_faces) == 2 for f in faces for e in f.edges)
    vol = 0.0
    for f in faces:
        vs = [v.co for v in f.verts]
        for i in range(1, len(vs) - 1):
            vol += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    return {"co": co, "tree": BVHTree.FromPolygons(co, polys), "closed": closed, "vol": vol, "min": mn, "max": mx}


def check_node(ob):
    me = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.transform(ob.matrix_world)
    # l'ombrage en aplats duplique les sommets de chaque face: on les ressoude pour retrouver les pièces
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
    parts = [part_info(fs) for fs in islands(bm)]
    issues = []
    for i, p in enumerate(parts):
        size = p["max"] - p["min"]
        if p["closed"] and p["vol"] < -1e-7:
            issues.append(f"INVERSEE pièce {i} vers {tuple(round(c, 2) for c in p['min'])}")
        if p["min"].z > 0.02 and len(parts) > 1:
            near = False
            for j, q in enumerate(parts):
                if j == i:
                    continue
                if any((p["min"][k] > q["max"][k] + 0.01) or (p["max"][k] < q["min"][k] - 0.01) for k in range(3)):
                    continue
                if p["tree"].overlap(q["tree"]):
                    near = True
                    break
                for c in p["co"]:
                    hit = q["tree"].find_nearest(c)
                    if hit[0] is not None and hit[3] < 0.006:
                        near = True
                        break
                if near:
                    break
            if not near:
                issues.append(f"FLOTTE pièce {i} (bas à {p['min'].z:.2f} m) vers {tuple(round(c, 2) for c in p['min'])}")
        dims = sorted(size)
        if dims[2] > 0.5 and dims[1] < 0.25:
            # pièce longue: ses deux extrémités sont-elles de part et d'autre d'une pièce qu'elle coupe?
            for j, q in enumerate(parts):
                qd = q["max"] - q["min"]
                qs = sorted(qd)
                # la pièce traversée est une plaque (toit, auvent, plancher): deux grandes dimensions
                if j == i or qs[1] < 0.6 or qs[2] < 1.0:
                    continue
                if not p["tree"].overlap(q["tree"]):
                    continue
                axis = max(range(3), key=lambda k: size[k])
                ends = sorted(p["co"], key=lambda c: c[axis])
                a, b = ends[0], ends[-1]
                # le bout sort-il au-delà de la pièce traversée, de plus de 5 cm, dans un sens et dans l'autre?
                out_a = any(a[k] < q["min"][k] - 0.05 or a[k] > q["max"][k] + 0.05 for k in range(3))
                out_b = any(b[k] < q["min"][k] - 0.05 or b[k] > q["max"][k] + 0.05 for k in range(3))
                if out_a and out_b:
                    issues.append(f"TRAVERSE pièce {i} à travers la pièce {j} vers {tuple(round(c, 2) for c in a)}")
    bm.free()
    return issues


def main():
    files = [a for a in sys.argv[1:] if a.endswith(".glb")] or sorted(
        f for f in os.listdir(MODELES) if f.endswith(".glb") and f not in IGNORE)
    total = 0
    for f in files:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        path = f if os.path.isabs(f) else os.path.join(MODELES, f)
        bpy.ops.import_scene.gltf(filepath=path)
        for ob in sorted(bpy.context.scene.objects, key=lambda o: o.name):
            if ob.type != "MESH" or ob.name.endswith("_water") or ob.find_armature():
                continue
            for msg in check_node(ob):
                print(f"CONTROLE {os.path.basename(path)} {ob.name}: {msg}")
                total += 1
    print(f"CONTROLE total {total} cas à examiner")


main()
