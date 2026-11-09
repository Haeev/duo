"""Compare les squelettes de deux GLB (ou de deux peaux d'un même GLB), sans Blender.

Sert à savoir si deux personnages riggés par Meshy partagent le même squelette, donc si les clips
achetés pour l'un se rejouent sur l'autre (Three.js lie les pistes aux os par leur nom):
- mêmes noms d'os, même hiérarchie (parent de chaque os);
- pose de repos: longueur de chaque os (distance au parent, en mètres, monde) et écart relatif;
- clips de A rejouables sur B: chaque piste vise un nœud dont le nom existe dans B.

Usage: python3 comparer_squelettes.py <A.glb>[#peau] <B.glb>[#peau] [rapport.json]
(#peau: index de la peau dans le fichier, 0 par défaut)
"""

import json
import math
import os
import struct
import sys


def read_glb(path):
    with open(path, "rb") as fh:
        data = fh.read()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2:
        raise SystemExit(f"{path}: pas un GLB 2.0")
    chunk_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise SystemExit(f"{path}: premier bloc non JSON")
    return json.loads(data[20:20 + chunk_len].decode("utf-8"))


def quat_mul(a, b):
    ax, ay, az, aw = a
    bx, by, bz, bw = b
    return (aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
            aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz)


def quat_rot(q, v):
    x, y, z, w = q
    p = quat_mul(quat_mul(q, (v[0], v[1], v[2], 0.0)), (-x, -y, -z, w))
    return p[:3]


def skeleton(spec):
    path, _, skin_index = spec.partition("#")
    gltf = read_glb(path)
    skins = gltf.get("skins", [])
    if not skins:
        raise SystemExit(f"{path}: aucune peau (personnage non riggé)")
    if int(skin_index or 0) >= len(skins):
        raise SystemExit(f"{path}: peau {skin_index} absente ({len(skins)} peau(x) dans le fichier)")
    skin = skins[int(skin_index or 0)]
    nodes = gltf["nodes"]
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get("children", []):
            parent[c] = i
    # Transformations monde de la pose de repos (TRS des nœuds; une matrice explicite n'est pas gérée).
    world = {}

    def world_of(i):
        if i in world:
            return world[i]
        n = nodes[i]
        t = n.get("translation", [0, 0, 0])
        r = n.get("rotation", [0, 0, 0, 1])
        s = n.get("scale", [1, 1, 1])
        if "matrix" in n:
            raise SystemExit(f"{path}: nœud {n.get('name')} décrit par une matrice, cas non géré")
        if i in parent:
            pt, pr, ps = world_of(parent[i])
            scaled = [t[k] * ps[k] for k in range(3)]
            rt = quat_rot(pr, scaled)
            res = ([pt[k] + rt[k] for k in range(3)], quat_mul(pr, r), [ps[k] * s[k] for k in range(3)])
        else:
            res = (list(t), tuple(r), list(s))
        world[i] = res
        return res

    joints = skin["joints"]
    joint_set = set(joints)
    bones = {}
    for j in joints:
        name = nodes[j].get("name", f"node_{j}")
        p = parent.get(j)
        pname = nodes[p].get("name", f"node_{p}") if p in joint_set else None
        pos = world_of(j)[0]
        length = None
        if p in joint_set:
            pp = world_of(p)[0]
            length = math.dist(pos, pp)
        bones[name] = {"parent": pname, "length": length, "rest_position": [round(x, 4) for x in pos]}
    names = set(n.get("name") for n in nodes)
    clips = []
    for a in gltf.get("animations", []):
        targets = sorted({nodes[ch["target"]["node"]].get("name") for ch in a["channels"] if "node" in ch["target"]})
        clips.append({"name": a.get("name"), "targets": targets})
    return {"file": os.path.basename(path), "skin": int(skin_index or 0), "joint_count": len(joints), "bones": bones, "node_names": names, "clips": clips}


def compare(a, b):
    names_a, names_b = set(a["bones"]), set(b["bones"])
    same_names = names_a == names_b
    hierarchy_diff = sorted(n for n in names_a & names_b if a["bones"][n]["parent"] != b["bones"][n]["parent"])
    length_diffs = []
    for n in sorted(names_a & names_b):
        la, lb = a["bones"][n]["length"], b["bones"][n]["length"]
        if la and lb:
            length_diffs.append((n, round(la, 4), round(lb, 4), round((lb - la) / la, 3)))
    worst = sorted(length_diffs, key=lambda x: -abs(x[3]))[:8]
    replay = []
    for clip in a["clips"]:
        missing = [t for t in clip["targets"] if t not in b["node_names"]]
        replay.append({"clip": clip["name"], "tracks_targets": len(clip["targets"]), "missing_in_b": missing})
    return {
        "a": {"file": a["file"], "skin": a["skin"], "joints": a["joint_count"]},
        "b": {"file": b["file"], "skin": b["skin"], "joints": b["joint_count"]},
        "same_bone_names": same_names,
        "only_in_a": sorted(names_a - names_b),
        "only_in_b": sorted(names_b - names_a),
        "hierarchy_differences": hierarchy_diff,
        "same_skeleton": same_names and not hierarchy_diff,
        "largest_bone_length_differences": [{"bone": n, "a_m": x, "b_m": y, "relative": r} for n, x, y, r in worst],
        "clips_of_a_on_b": replay,
        "bone_names_a": sorted(names_a),
    }


if __name__ == "__main__":
    result = compare(skeleton(sys.argv[1]), skeleton(sys.argv[2]))
    text = json.dumps(result, ensure_ascii=False, indent=2)
    if len(sys.argv) > 3:
        with open(sys.argv[3], "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
    summary = {k: result[k] for k in ("same_skeleton", "same_bone_names", "hierarchy_differences", "only_in_a", "only_in_b")}
    print(json.dumps(summary, ensure_ascii=False))
    print(json.dumps(result["largest_bone_length_differences"][:4], ensure_ascii=False))
    print(json.dumps(result["clips_of_a_on_b"][:4], ensure_ascii=False))
