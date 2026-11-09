"""Mise en conformité des aperçus Meshy de l'essai (sorties brutes hors du dépôt).

Les aperçus de texte vers 3D n'ont pas de texture: les couleurs sont choisies par la géométrie (hauteur, normale,
position), toujours parmi les clés de la palette de la bible. Étapes: import, fusion, transformations
appliquées, soudure, échelle à la cote réelle, origine au centre de l'emprise au sol, avant vers le sud (+y du
plan, -Y de Blender: convention glTF +Z), décimation au plafond de la bible (C8), faces du dessous posé retirées,
clé de matière par face. Sortie: JSON léger lu par meshy_import.py (un fichier par variante: A à facettes, B lissé).

Usage:
  duo-python conformer_meshy.py -- <brut.glb> <asset> <dossier de sortie>
"""

import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
RAW, ASSET, OUT = argv[0], argv[1], argv[2]

REGLES = {
    # asset: cote (axe, valeur), plafond de triangles, rotation de l'avant (degrés autour de z)
    "furn_chair_campagne": {"axis": "z", "size": 0.9, "max_tris": 600, "yaw": 0, "fit_xy": 0.45},
    "deco_plant_pot": {"axis": "z", "size": 0.62, "max_tris": 1200, "yaw": 0},
    "food_croissant": {"axis": "x", "size": 0.16 * 1.2, "max_tris": 250, "yaw": 0, "squash_z": 0.55},
}
R = REGLES[ASSET]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=RAW)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
ob.parent = None
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data

bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
bmesh.ops.triangulate(bm, faces=bm.faces)
# taille et repère
co = [v.co for v in bm.verts]
mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
dim = mx - mn
ax = {"x": 0, "y": 1, "z": 2}[R["axis"]]
if R["axis"] == "x":
    s = R["size"] / max(dim.x, dim.y)
else:
    s = R["size"] / dim[ax]
center = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
# emprise ramenée au rectangle de place du plan (chaise: 0,45 m), hauteur gardée; viennoiserie moins haute
fx = fy = 1.0
if R.get("fit_xy"):
    fx = min(1.0, R["fit_xy"] / (dim.x * s))
    fy = min(1.0, R["fit_xy"] / (dim.y * s))
fz = R.get("squash_z", 1.0)
for v in bm.verts:
    p = (v.co - center) * s
    v.co = Vector((p.x * fx, p.y * fy, p.z * fz))
if R["yaw"]:
    from mathutils import Matrix
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(R["yaw"]), 3, "Z"))
bm.to_mesh(me)
bm.free()
tris0 = len(me.polygons)
# décimation au plafond
if tris0 > R["max_tris"]:
    mod = ob.modifiers.new("dec", "DECIMATE")
    mod.ratio = R["max_tris"] / tris0
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="dec")
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.triangulate(bm, faces=bm.faces)
bm.normal_update()
co = [v.co for v in bm.verts]
mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
H = mx.z - mn.z

# faces du dessous posé (invisibles): retirées
kill = [f for f in bm.faces if f.normal.z < -0.95 and f.calc_center_median().z < mn.z + 0.004]
bmesh.ops.delete(bm, geom=kill, context="FACES_ONLY")


def cle(f):
    c = f.calc_center_median()
    n = f.normal
    h = (c.z - mn.z) / H
    if ASSET == "furn_chair_campagne":
        # assise paillée: le panneau entre les traverses, autour de 0,42 à 0,47 m
        inner = abs(c.x) < (mx.x - 0.045) and abs(c.y) < (mx.y - 0.045)
        if 0.38 < c.z < 0.5 and inner:
            return "straw"
        return "oak_honey"
    if ASSET == "deco_plant_pot":
        pot_top = REG["pot_top"]
        if c.z < pot_top - 0.005:
            r = math.hypot(c.x, c.y)
            if c.z > pot_top - 0.04 and n.z > 0.6 and r < REG["pot_r"] * 0.85:
                return "chocolate"
            return "pot"
        if math.hypot(c.x, c.y) < 0.025 and c.z < pot_top + 0.2:
            return "beam"
        return "leaf_light" if n.z > 0.45 else "leaf"
    if ASSET == "food_croissant":
        return "crumb" if n.z < -0.55 else "crust"
    return "pot"


REG = {}
if ASSET == "deco_plant_pot":
    # haut du pot: plus grand saut du rayon de l'enveloppe en montant (le feuillage s'élargit d'un coup)
    # le pot: zone basse dont le rayon décroît vers le bas; on prend le rebord comme z du rayon maximum sous 45 %
    lo = [(v.co.z, math.hypot(v.co.x, v.co.y)) for v in bm.verts if v.co.z < mn.z + H * 0.45]
    zr = max(lo, key=lambda t: t[1])
    REG["pot_top"] = zr[0] + 0.01
    REG["pot_r"] = zr[1]

# sommets uniques et faces
bm.verts.index_update()
verts = []
index = {}
faces, keys = [], []
for f in bm.faces:
    ids = []
    for v in f.verts:
        if v.index not in index:
            index[v.index] = len(verts)
            # Blender (x, y, z) vers le plan (x, -y, z)
            verts.append([round(v.co.x, 5), round(-v.co.y, 5), round(v.co.z, 5)])
        ids.append(index[v.index])
    faces.append(ids)
    keys.append(cle(f))
os.makedirs(OUT, exist_ok=True)
rapport = {"asset": ASSET, "brut": os.path.basename(RAW), "triangles_bruts": tris0, "triangles": len(faces),
           "dimensions_m": [round(mx.x - mn.x, 3), round(mx.y - mn.y, 3), round(H, 3)], "echelle": round(s, 4),
           "cles": {k: keys.count(k) for k in sorted(set(keys))}, **({"pot_top": REG["pot_top"]} if REG else {})}
for var, smooth in (("A", False), ("B", True)):
    with open(os.path.join(OUT, f"{ASSET}_{var}.json"), "w") as fh:
        json.dump({**rapport, "smooth": smooth, "verts": verts, "faces": faces, "keys": keys}, fh, separators=(",", ":"))
print(json.dumps(rapport))
