"""Mesures des objets du tour 8 dans les GLB exportés: emprise (x, profondeur, hauteur) et point le plus bas.

Lancer: duo-python verifier/mesures_cueillette.py
Un objet posé au sol doit avoir son point le plus bas entre -1 cm et +1 cm (rien qui flotte, rien d'enfoui).
"""
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import lpl  # noqa: E402

NODES = {"ferme.glb": ("wild_garlic", "chanterelle", "blackberry", "hazelnut", "dandelion"),
         "bourg.glb": ("bramble", "bush_hazel", "oak_sapling", "fir_sapling", "tree_stump")}

lpl.reset()
for f in NODES:
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, f))
bpy.context.view_layer.update()
for f, names in NODES.items():
    for n in names:
        root = bpy.data.objects[n]
        vs = []
        for o in (root, *root.children_recursive):
            if o.type == "MESH":
                vs += [o.matrix_world @ v.co for v in o.data.vertices]
        size = [max(getattr(v, a) for v in vs) - min(getattr(v, a) for v in vs) for a in "xyz"]
        low = min(v.z for v in vs)
        print(f"MESURE {n}: {size[0]:.3f} x {size[1]:.3f} m, hauteur {size[2]:.3f} m, point bas {low * 100:+.1f} cm")
