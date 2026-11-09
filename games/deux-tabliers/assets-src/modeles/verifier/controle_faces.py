"""Contrôle des faces d'un ou plusieurs GLB sans Blender: faces dont l'enroulement contredit les normales des sommets
(vues de dos, donc invisibles avec l'élimination des faces arrière de Three.js), îlots fermés de volume négatif
(retournés), boîte englobante par nœud.

Usage: python3 controle_faces.py <fichier.glb>... (code 1 si une face retournée est trouvée)
"""
import json
import os
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
    return g, data[off + 8:off + 8 + bl]


def accessor(g, binc, i):
    """Accesseur lu en flottants (quantification et normalisation comprises)."""
    a = g["accessors"][i]
    bv = g["bufferViews"][a["bufferView"]]
    dt = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or np.dtype(dt).itemsize * n
    raw = np.frombuffer(binc, dtype=np.uint8, count=stride * (a["count"] - 1) + np.dtype(dt).itemsize * n, offset=start)
    arr = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], np.dtype(dt).itemsize * n), strides=(stride, 1)).copy()
    arr = arr.view(dt).reshape(a["count"], n)
    if a.get("normalized"):
        arr = np.maximum(arr.astype(np.float64) / np.iinfo(dt).max, -1.0)
    return arr


def iles(tri):
    """Composantes connexes des triangles (par sommets partagés, positions soudées à 0,1 mm)."""
    parent = list(range(len(tri)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    owner = {}
    for t, (a, b, c) in enumerate(tri):
        for v in (a, b, c):
            if v in owner:
                ra, rb = find(owner[v]), find(t)
                if ra != rb:
                    parent[ra] = rb
            else:
                owner[v] = t
    groups = {}
    for t in range(len(tri)):
        groups.setdefault(find(t), []).append(t)
    return list(groups.values())


def controler(path):
    g, b = lire(path)
    fautes = 0
    for node in g.get("nodes", []):
        if "mesh" not in node:
            continue
        m = g["meshes"][node["mesh"]]
        for pr in m["primitives"]:
            mat = g["materials"][pr["material"]]
            double = mat.get("doubleSided", False)
            pos = accessor(g, b, pr["attributes"]["POSITION"]).astype(np.float64)
            nor = accessor(g, b, pr["attributes"]["NORMAL"]).astype(np.float64)
            idx = accessor(g, b, pr["indices"]).reshape(-1, 3)
            p0, p1, p2 = pos[idx[:, 0]], pos[idx[:, 1]], pos[idx[:, 2]]
            fn = np.cross(p1 - p0, p2 - p0)
            area = np.linalg.norm(fn, axis=1)
            ok = area > 1e-12
            vn = nor[idx[:, 0]] + nor[idx[:, 1]] + nor[idx[:, 2]]
            dots = np.einsum("ij,ij->i", fn[ok], vn[ok])
            dos = int((dots < 0).sum())
            # îlots fermés: volume signé (soudure des positions)
            key = np.round(pos / 1e-4).astype(np.int64)
            _, weld = np.unique(key, axis=0, return_inverse=True)
            wtri = weld.reshape(-1)[idx]
            neg = 0
            for isl in iles([tuple(t) for t in wtri]):
                t = wtri[isl]
                edges = {}
                for a_, b_, c_ in t:
                    for e in ((a_, b_), (b_, c_), (c_, a_)):
                        k = (min(e), max(e))
                        edges[k] = edges.get(k, 0) + 1
                if any(n != 2 for n in edges.values()):
                    continue
                q0, q1, q2 = p0[isl], p1[isl], p2[isl]
                vol = np.einsum("ij,ij->i", q0, np.cross(q1, q2)).sum() / 6
                if vol < -1e-9:
                    neg += 1
            mn, mx = pos.min(axis=0), pos.max(axis=0)
            etat = "ok"
            if (dos or neg) and not double:
                etat = "FACES RETOURNÉES"
                fautes += 1
            print(f"  {node.get('name')} [{mat.get('name')}{', deux faces' if double else ''}]: {len(idx)} tri, "
                  f"{dos} contre les normales, {neg} îlot(s) fermé(s) retourné(s), "
                  f"boîte x {mn[0]:.3f}..{mx[0]:.3f} y {mn[1]:.3f}..{mx[1]:.3f} z {mn[2]:.3f}..{mx[2]:.3f}: {etat}")
    return fautes


if __name__ == "__main__":
    total = 0
    for p in sys.argv[1:]:
        print(os.path.basename(p))
        total += controler(p)
    sys.exit(1 if total else 0)
