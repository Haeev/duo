"""Lecture et réécriture d'un GLB sans passer par l'import de Blender (numpy seul).

Sert à `doigts.py`: on ajoute des nœuds, des articulations et des animations à un personnage déjà conforme sans
réimporter ni réexporter le reste (texture, clips et orientation des os restent identiques à l'octet près).
"""
import json
import struct

import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
COMP_ID = {np.dtype(v): k for k, v in COMP.items()}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
TYPE_OF = {1: "SCALAR", 2: "VEC2", 3: "VEC3", 4: "VEC4", 16: "MAT4"}


class Glb:
    def __init__(self, path):
        data = open(path, "rb").read()
        jl = struct.unpack_from("<I", data, 12)[0]
        self.g = json.loads(data[20:20 + jl])
        off = 20 + jl
        bl = struct.unpack_from("<I", data, off)[0]
        self.bin = bytearray(data[off + 8:off + 8 + bl])

    # --- accesseurs -----------------------------------------------------------------------------
    def read(self, i):
        a = self.g["accessors"][i]
        dt = COMP[a["componentType"]]
        n = NCOMP[a["type"]]
        out = np.zeros((a["count"], n), dtype=dt)
        if "bufferView" in a:
            bv = self.g["bufferViews"][a["bufferView"]]
            start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
            item = np.dtype(dt).itemsize * n
            stride = bv.get("byteStride", 0) or item
            raw = np.frombuffer(bytes(self.bin), dtype=np.uint8, count=stride * (a["count"] - 1) + item, offset=start)
            raw = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], item), strides=(stride, 1))
            out = raw.copy().view(dt).reshape(a["count"], n)
        if "sparse" in a:
            sp = a["sparse"]
            ib = self.g["bufferViews"][sp["indices"]["bufferView"]]
            idx = np.frombuffer(bytes(self.bin), dtype=COMP[sp["indices"]["componentType"]], count=sp["count"],
                                offset=ib.get("byteOffset", 0) + sp["indices"].get("byteOffset", 0))
            vb = self.g["bufferViews"][sp["values"]["bufferView"]]
            val = np.frombuffer(bytes(self.bin), dtype=dt, count=sp["count"] * n,
                                offset=vb.get("byteOffset", 0) + sp["values"].get("byteOffset", 0)).reshape(-1, n)
            out = out.copy()
            out[idx] = val
        return out

    def _view(self, raw, target=None):
        while len(self.bin) % 4:
            self.bin.append(0)
        bv = {"buffer": 0, "byteOffset": len(self.bin), "byteLength": len(raw)}
        if target:
            bv["target"] = target
        self.bin.extend(raw)
        self.g["bufferViews"].append(bv)
        return len(self.g["bufferViews"]) - 1

    def add(self, arr, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        if arr.ndim == 1:
            arr = arr.reshape(-1, 1)
        acc = {"bufferView": self._view(arr.tobytes(), target), "componentType": COMP_ID[arr.dtype],
               "count": int(arr.shape[0]), "type": TYPE_OF[arr.shape[1]]}
        if minmax:
            acc["min"] = [float(x) for x in arr.min(axis=0)]
            acc["max"] = [float(x) for x in arr.max(axis=0)]
        self.g["accessors"].append(acc)
        return len(self.g["accessors"]) - 1

    # --- nœuds ------------------------------------------------------------------------------------
    def node(self, name):
        return next(i for i, n in enumerate(self.g["nodes"]) if n.get("name") == name)

    def parent_of(self):
        par = {}
        for i, n in enumerate(self.g["nodes"]):
            for c in n.get("children", []):
                par[c] = i
        return par

    # --- écriture: les vues non référencées sont retirées, le tampon est recompacté ---------------
    def compact(self):
        g = self.g
        used = set()
        for a in g["accessors"]:
            if "bufferView" in a:
                used.add(a["bufferView"])
            if "sparse" in a:
                used.add(a["sparse"]["indices"]["bufferView"])
                used.add(a["sparse"]["values"]["bufferView"])
        for im in g.get("images", []):
            if "bufferView" in im:
                used.add(im["bufferView"])
        # accesseurs non référencés: retirés aussi (réindexation)
        ref = set()
        for m in g["meshes"]:
            for p in m["primitives"]:
                ref.update(p["attributes"].values())
                if "indices" in p:
                    ref.add(p["indices"])
                for t in p.get("targets", []):
                    ref.update(t.values())
        for s in g.get("skins", []):
            if "inverseBindMatrices" in s:
                ref.add(s["inverseBindMatrices"])
        for an in g.get("animations", []):
            for sm in an["samplers"]:
                ref.update((sm["input"], sm["output"]))
        amap = {}
        accs = []
        for i, a in enumerate(g["accessors"]):
            if i in ref:
                amap[i] = len(accs)
                accs.append(a)
        g["accessors"] = accs
        for m in g["meshes"]:
            for p in m["primitives"]:
                p["attributes"] = {k: amap[v] for k, v in p["attributes"].items()}
                if "indices" in p:
                    p["indices"] = amap[p["indices"]]
                if "targets" in p:
                    p["targets"] = [{k: amap[v] for k, v in t.items()} for t in p["targets"]]
        for s in g.get("skins", []):
            if "inverseBindMatrices" in s:
                s["inverseBindMatrices"] = amap[s["inverseBindMatrices"]]
        for an in g.get("animations", []):
            for sm in an["samplers"]:
                sm["input"], sm["output"] = amap[sm["input"]], amap[sm["output"]]
        used = set()
        for a in accs:
            if "bufferView" in a:
                used.add(a["bufferView"])
            if "sparse" in a:
                used.update((a["sparse"]["indices"]["bufferView"], a["sparse"]["values"]["bufferView"]))
        for im in g.get("images", []):
            if "bufferView" in im:
                used.add(im["bufferView"])
        new_bin = bytearray()
        vmap = {}
        views = []
        for i, bv in enumerate(g["bufferViews"]):
            if i not in used:
                continue
            while len(new_bin) % 4:
                new_bin.append(0)
            o = bv.get("byteOffset", 0)
            chunk = self.bin[o:o + bv["byteLength"]]
            nb = dict(bv, byteOffset=len(new_bin))
            new_bin.extend(chunk)
            vmap[i] = len(views)
            views.append(nb)
        for a in accs:
            if "bufferView" in a:
                a["bufferView"] = vmap[a["bufferView"]]
            if "sparse" in a:
                a["sparse"]["indices"]["bufferView"] = vmap[a["sparse"]["indices"]["bufferView"]]
                a["sparse"]["values"]["bufferView"] = vmap[a["sparse"]["values"]["bufferView"]]
        for im in g.get("images", []):
            if "bufferView" in im:
                im["bufferView"] = vmap[im["bufferView"]]
        g["bufferViews"] = views
        self.bin = new_bin

    def save(self, path):
        self.compact()
        while len(self.bin) % 4:
            self.bin.append(0)
        self.g["buffers"] = [{"byteLength": len(self.bin)}]
        js = json.dumps(self.g, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        js += b" " * ((4 - len(js) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, "wb") as fh:
            fh.write(struct.pack("<III", 0x46546C67, 2, total))
            fh.write(struct.pack("<II", len(js), 0x4E4F534A))
            fh.write(js)
            fh.write(struct.pack("<II", len(self.bin), 0x004E4942))
            fh.write(bytes(self.bin))


def mat4(col_major16):
    return np.array(col_major16, dtype=np.float64).reshape(4, 4).T


def trs(node):
    t = np.array(node.get("translation", [0, 0, 0]), dtype=np.float64)
    q = node.get("rotation", [0, 0, 0, 1])
    s = np.array(node.get("scale", [1, 1, 1]), dtype=np.float64)
    m = np.eye(4)
    m[:3, :3] = quat_to_mat(q) * s
    m[:3, 3] = t
    return m


def quat_to_mat(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
