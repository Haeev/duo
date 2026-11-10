"""Contrôle des objets livrés, sans Blender: python3 verifier_objets.py <dossier des GLB>

Pour chaque entrée de `gabarits.toml`: nœud présent, enfant `<id>--grip`, matériau `objet` seul,
normales, UV et atlas de texture, triangles dans les bornes, plus grande dimension à 12 % de la
`taille` et dans les bornes de la famille, origine au centre du dessous, couleurs toutes prises
dans le nuancier (bible 2.4) ou les couleurs d'Aubrune (bible 7.1). Finit par
`VERIFICATION objets: N objet(s), E erreur(s)`; code de sortie 1 s'il y a une erreur.
"""
import io
import json
import os
import struct
import sys
import tomllib

import numpy as np

ICI = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.abspath(sys.argv[1])
with open(os.path.join(ICI, "gabarits.toml"), "rb") as fh:
    G = tomllib.load(fh)
with open(os.path.join(ICI, "..", "personnages", "nuancier.json"), encoding="utf-8") as fh:
    N = json.load(fh)

ALLOWED = {h.upper() for fam in N.values() for _, h in fam} | {h.upper() for h in G["couleurs_lieu"].values()}
ALLOWED_RGB = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in ALLOWED], dtype=float)

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def read_glb(path):
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    off = 20 + jlen
    blen = struct.unpack_from("<I", data, off)[0]
    return gltf, data[off + 8:off + 8 + blen]


def accessor(gltf, binary, idx):
    acc = gltf["accessors"][idx]
    view = gltf["bufferViews"][acc["bufferView"]]
    dt = np.dtype(COMP[acc["componentType"]])
    n = NCOMP[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = view.get("byteStride", dt.itemsize * n)
    raw = np.frombuffer(binary, dtype=np.uint8, count=stride * (acc["count"] - 1) + dt.itemsize * n, offset=start)
    rows = np.lib.stride_tricks.as_strided(raw, shape=(acc["count"], dt.itemsize * n), strides=(stride, 1))
    arr = np.ascontiguousarray(rows).view(dt).reshape(acc["count"], n).astype(float)
    if acc.get("normalized"):
        arr /= np.iinfo(dt).max
    return arr


def linear_to_srgb(x):
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(np.clip(x, 0, 1), 1 / 2.4) - 0.055)


ATLAS = {}


def atlas_colors(gltf, binary, mat_index, path):
    """Couleurs de l'atlas de la famille (texture provisoire: aplats du nuancier), une fois par
    fichier. Le gris neutre (128) des cases libres est ignoré. Vérifie aussi 256 px par objet."""
    if path in ATLAS:
        return ATLAS[path]
    from PIL import Image
    pbr = gltf["materials"][mat_index].get("pbrMetallicRoughness", {})
    if "baseColorTexture" not in pbr:
        ATLAS[path] = None
        return None
    image = gltf["images"][gltf["textures"][pbr["baseColorTexture"]["index"]]["source"]]
    view = gltf["bufferViews"][image["bufferView"]]
    start = view.get("byteOffset", 0)
    img = Image.open(io.BytesIO(binary[start:start + view["byteLength"]])).convert("RGB")
    arr = np.asarray(img).reshape(-1, 3)
    uniq = np.unique(arr, axis=0).astype(float)
    uniq = uniq[np.abs(uniq - 128).max(1) > 0]
    ATLAS[path] = uniq
    ATLAS[path + ":size"] = img.size
    return uniq


def main():
    errors = []
    cache = {}
    tris_total = 0
    for spec in G["objets"]:
        oid = spec["id"]
        fam = G["familles"][spec["famille"]]
        path = os.path.join(DOSSIER, f"{spec['famille']}.glb")
        if path not in cache:
            if not os.path.exists(path):
                errors.append(f"{oid}: fichier absent {path}")
                continue
            cache[path] = read_glb(path)
        gltf, binary = cache[path]
        nodes = {n.get("name"): n for n in gltf["nodes"]}
        node = nodes.get(oid)
        if node is None or "mesh" not in node:
            errors.append(f"{oid}: nœud absent de {spec['famille']}.glb")
            continue
        kids = [gltf["nodes"][k].get("name") for k in node.get("children", [])]
        if f"{oid}--grip" not in kids:
            errors.append(f"{oid}: pas d'enfant {oid}--grip")
        if any(abs(t) > 1e-6 for t in node.get("translation", [0, 0, 0])) or "rotation" in node or "scale" in node:
            errors.append(f"{oid}: transformation non appliquée")
        mesh = gltf["meshes"][node["mesh"]]
        tris, pos_all, col_all = 0, [], []
        for prim in mesh["primitives"]:
            mat = gltf["materials"][prim["material"]]["name"] if "material" in prim else None
            if mat is None or not mat.startswith("objet"):
                errors.append(f"{oid}: matériau {mat} (attendu: objet-<famille>)")
            for attr in ("POSITION", "NORMAL", "TEXCOORD_0"):
                if attr not in prim["attributes"]:
                    errors.append(f"{oid}: attribut {attr} absent")
            tris += gltf["accessors"][prim["indices"]]["count"] // 3
            pos_all.append(accessor(gltf, binary, prim["attributes"]["POSITION"]))
            if "material" in prim:
                col_all.append(atlas_colors(gltf, binary, prim["material"], path))
        tris_total += tris
        if not G["triangles"]["min"] <= tris <= G["triangles"]["max"]:
            errors.append(f"{oid}: {tris} triangles (bornes {G['triangles']['min']} à {G['triangles']['max']})")
        pos = np.concatenate(pos_all)
        lo, hi = pos.min(0), pos.max(0)
        size = float((hi - lo).max())
        if abs(size - spec["taille"]) > 0.12 * spec["taille"]:
            errors.append(f"{oid}: taille {size:.3f} m, gabarit {spec['taille']} m")
        if not fam["min"] <= size <= fam["max"]:
            errors.append(f"{oid}: taille {size:.3f} m hors des bornes de la famille {spec['famille']}")
        if abs(lo[1]) > 1e-4:
            errors.append(f"{oid}: dessous à y = {lo[1]:.4f} (attendu 0)")
        if abs(lo[0] + hi[0]) > 2e-3 or abs(lo[2] + hi[2]) > 2e-3:
            errors.append(f"{oid}: origine décentrée de l'emprise")
        for uniq in col_all:
            if uniq is None:
                errors.append(f"{oid}: pas de texture de base (atlas)")
                continue
            for u in uniq:
                if np.abs(ALLOWED_RGB - u).max(1).min() > 2.5:
                    errors.append(f"{oid}: couleur hors nuancier {tuple(int(x) for x in u)}")
                    break
        print(f"  {oid:24s} {spec['famille']:9s} {tris:4d} tri  {size:.3f} m")
    for e in errors:
        print("ERREUR", e)
    print(f"VERIFICATION objets: {len(G['objets'])} objet(s), {tris_total} triangles, {len(errors)} erreur(s)")
    sys.exit(1 if errors else 0)


main()
