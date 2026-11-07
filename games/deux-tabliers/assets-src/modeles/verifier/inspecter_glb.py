"""Inspecte un ou plusieurs GLB sans Blender: nœuds, matériaux, images (externes ou non), attributs, plage de COLOR_0.

Usage: python3 inspecter_glb.py <fichier.glb>...
"""
import json
import struct
import sys

import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def lire(path):
    data = open(path, "rb").read()
    jl = struct.unpack_from("<I", data, 12)[0]
    g = json.loads(data[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack_from("<I", data, off)[0] if off < len(data) else 0
    binc = data[off + 8:off + 8 + bl]
    return g, binc


def accessor(g, binc, i):
    a = g["accessors"][i]
    bv = g["bufferViews"][a["bufferView"]]
    dt = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or np.dtype(dt).itemsize * n
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * a["count"], offset=start).reshape(a["count"], stride)
    arr = raw[:, :np.dtype(dt).itemsize * n].copy().view(dt).reshape(a["count"], n)
    if a.get("normalized"):
        arr = arr.astype(np.float32) / np.iinfo(dt).max
    return arr


for p in sys.argv[1:]:
    g, b = lire(p)
    print(p)
    print("  noeuds:", [n.get("name") for n in g.get("nodes", [])])
    print("  matériaux:", [m.get("name") for m in g.get("materials", [])])
    print("  images:", [im.get("uri", f"intégrée {im.get('mimeType')}") for im in g.get("images", [])])
    for m in g.get("meshes", []):
        for pr in m["primitives"]:
            at = pr["attributes"]
            line = f"  {m.get('name')}: {sorted(at)}"
            if "COLOR_0" in at:
                c = accessor(g, b, at["COLOR_0"])
                line += f" COLOR_0 min {c[:, 0].min():.2f} moy {c[:, 0].mean():.2f}"
            print(line)
    print("  animations:", [a.get("name") for a in g.get("animations", [])])
