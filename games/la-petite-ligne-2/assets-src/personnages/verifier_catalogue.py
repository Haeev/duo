"""Contrôle rapide du catalogue: chaque pièce a son nœud dans son fichier, ses zones, son budget; identifiants valides.

Usage: python3 verifier_catalogue.py <dossier des GLB> <dossier des données>
"""
import json
import os
import re
import struct
import sys

GLB, DATA = sys.argv[1:3]
with open(os.path.join(DATA, "catalogue.json"), encoding="utf-8") as fh:
    cat = json.load(fh)
ID = re.compile(r"^[a-z][a-z0-9-]{0,39}$")
errors = []
nodes = {}
for name in sorted({p["file"] for p in cat["pieces"]}):
    with open(os.path.join(GLB, name), "rb") as fh:
        data = fh.read()
    length = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + length])
    nodes[name] = {}
    for n in gltf["nodes"]:
        if "mesh" in n:
            prims = gltf["meshes"][n["mesh"]]["primitives"]
            attrs = set(prims[0]["attributes"])
            nodes[name][n["name"]] = (len(prims), attrs, sum(gltf["accessors"][p["indices"]]["count"] // 3 for p in prims))
total = 0
for p in cat["pieces"]:
    if not ID.match(p["id"]) or any(not ID.match(t) for t in p["tags"] + p["covers"] + [z["id"] for z in p["zones"]]):
        errors.append(f"{p['id']}: identifiant invalide")
    found = nodes[p["file"]].get(p["node"])
    if not found:
        errors.append(f"{p['id']}: nœud {p['node']} absent de {p['file']}")
        continue
    prims, attrs, tris = found
    for need in ("POSITION", "NORMAL", "TEXCOORD_0", "COLOR_0", "JOINTS_0", "WEIGHTS_0"):
        if need not in attrs:
            errors.append(f"{p['id']}: attribut {need} manquant")
    if prims != 1:
        errors.append(f"{p['id']}: {prims} primitives (une seule attendue: un matériau)")
    if tris != p["triangles"]:
        errors.append(f"{p['id']}: {tris} triangles dans le fichier, {p['triangles']} au catalogue")
    if len(p["zones"]) > 3:
        errors.append(f"{p['id']}: plus de 3 zones")
    total += tris
if cat["skeleton"] != "duo-24":
    errors.append("squelette inattendu")
print(f"VERIFICATION {len(cat['pieces'])} pièces, {len(cat['shapes'])} morphologies, {total} triangles au total, {len(errors)} erreur(s)")
for e in errors:
    print("  -", e)
sys.exit(1 if errors else 0)
