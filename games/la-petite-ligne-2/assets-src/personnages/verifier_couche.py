"""Coiffes en posture couchée: de combien chaque coiffe passe sous le plan du couchage.
Couché sur le dos, l'axe du corps est 0,12 m au-dessus du couchage (reglages.ts: lie.back): tout ce qui est à
plus de 0,12 m derrière l'axe (glTF: z < -0,12) est dans le matelas ou l'oreiller. python3 verifier_couche.py <hat.glb> [autres]"""
import json
import struct
import sys

for path in sys.argv[1:]:
    data = open(path, "rb").read()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    for node in gltf["nodes"]:
        if "mesh" not in node:
            continue
        acc = gltf["accessors"][gltf["meshes"][node["mesh"]]["primitives"][0]["attributes"]["POSITION"]]
        back, top, wide = -acc["min"][2], acc["max"][1], max(acc["max"][0], -acc["min"][0])
        print(f"{node['name']:24s} arrière {back:.3f} m (sous le couchage: {max(0.0, back - 0.12) * 100:4.1f} cm)  sommet {top:.3f} m  demi-largeur {wide:.3f} m")
