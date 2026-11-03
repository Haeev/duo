"""Retouches d'un GLB après l'export de Blender (Python pur, sans bpy).

Utilisé par personnages.py (qualité visuelle, étape A):
- `strip_rest_channels`: l'export échantillonne translation et échelle de tous les os dans chaque clip, à leur
  valeur de repos. Ces pistes figeraient les longueurs d'os du squelette commun: un gabarit (os plus courts ou
  épaules plus larges, `gabarits.py`) serait ramené au gabarit moyen par n'importe quel clip. On ne garde que les
  translations de `root` et `hips` (le bassin monte et descend); les autres pistes de translation et toutes les
  pistes d'échelle sont retirées, après avoir vérifié qu'elles valent le repos du nœud (sinon on les garde).
  Three.js remet de lui-même l'état d'origine d'une propriété qu'aucun clip ne pilote: rien ne change pour le
  gabarit moyen.
- `colors_to_bytes`: COLOR_0 passe d'entiers 16 bits à des octets (4 octets par sommet au lieu de 8).
- `compact`: réécrit le tampon sans les accesseurs et les vues devenus inutiles.

Lancer à la main: python3 glb_post.py <fichier.glb>
"""
import json
import struct
import sys

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT2": 4, "MAT3": 9, "MAT4": 16}


def load(path):
    b = open(path, "rb").read()
    assert b[:4] == b"glTF"
    off = 12
    js, binary = None, b""
    while off < len(b):
        ln, kind = struct.unpack("<II", b[off:off + 8])
        chunk = b[off + 8:off + 8 + ln]
        if kind == 0x4E4F534A:
            js = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
        off += 8 + ln
    return js, bytearray(binary)


def save(path, js, binary):
    jb = json.dumps(js, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    jb += b" " * ((4 - len(jb) % 4) % 4)
    bb = bytes(binary) + b"\0" * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(bb)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack("<II", len(bb), 0x004E4942) + bb)


def read_accessor(js, binary, i):
    a = js["accessors"][i]
    fmt, size = COMP[a["componentType"]]
    n = NCOMP[a["type"]]
    bv = js["bufferViews"][a["bufferView"]]
    stride = bv.get("byteStride", size * n)
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    out = []
    for k in range(a["count"]):
        o = base + k * stride
        out.append(struct.unpack_from("<" + fmt * n, binary, o))
    return out


def strip_rest_channels(js, binary, keep_translation=("root", "hips"), tol=1e-4):
    nodes = js["nodes"]
    removed, kept_odd = 0, []
    for anim in js.get("animations", []):
        channels = []
        for ch in anim["channels"]:
            node = nodes[ch["target"]["node"]]
            path = ch["target"]["path"]
            name = node.get("name", "")
            drop = False
            if path == "scale" or (path == "translation" and name not in keep_translation):
                rest = node.get(path, [1, 1, 1] if path == "scale" else [0, 0, 0])
                vals = read_accessor(js, binary, anim["samplers"][ch["sampler"]]["output"])
                if all(abs(v[i] - rest[i]) <= tol for v in vals for i in range(3)):
                    drop = True
                else:
                    kept_odd.append((anim["name"], name, path))
            if drop:
                removed += 1
            else:
                channels.append(ch)
        used = sorted({ch["sampler"] for ch in channels})
        remap = {old: new for new, old in enumerate(used)}
        anim["samplers"] = [anim["samplers"][i] for i in used]
        for ch in channels:
            ch["sampler"] = remap[ch["sampler"]]
        anim["channels"] = channels
    return removed, kept_odd


def colors_to_bytes(js, binary):
    """COLOR_0 en octets normalisés (VEC4): nouvelles vues ajoutées en fin de tampon (compact les range)."""
    done = {}
    for mesh in js["meshes"]:
        for pr in mesh["primitives"]:
            i = pr["attributes"].get("COLOR_0")
            if i is None or i in done:
                continue
            a = js["accessors"][i]
            if a["componentType"] == 5121:
                continue
            vals = read_accessor(js, binary, i)
            n = NCOMP[a["type"]]
            data = bytearray()
            for v in vals:
                if a["componentType"] == 5126:
                    q = [max(0.0, min(1.0, c)) for c in v]
                else:
                    q = [c / 65535.0 for c in v]
                if n == 3:
                    q = list(q) + [1.0]
                data += bytes(int(round(c * 255)) for c in q)
            while len(binary) % 4:
                binary.append(0)
            js["bufferViews"].append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data),
                                      "target": 34962})
            binary += data
            na = {"bufferView": len(js["bufferViews"]) - 1, "componentType": 5121, "normalized": True,
                  "count": a["count"], "type": "VEC4"}
            js["accessors"].append(na)
            done[i] = len(js["accessors"]) - 1
    for mesh in js["meshes"]:
        for pr in mesh["primitives"]:
            i = pr["attributes"].get("COLOR_0")
            if i in done:
                pr["attributes"]["COLOR_0"] = done[i]
    return len(done)


def compact(js, binary):
    """Ne garde que les accesseurs et les vues utilisés; réécrit le tampon (alignement de 4 octets)."""
    used_acc = set()
    for mesh in js.get("meshes", []):
        for pr in mesh["primitives"]:
            used_acc.update(pr["attributes"].values())
            if "indices" in pr:
                used_acc.add(pr["indices"])
            for t in pr.get("targets", []):
                used_acc.update(t.values())
    for skin in js.get("skins", []):
        if "inverseBindMatrices" in skin:
            used_acc.add(skin["inverseBindMatrices"])
    for anim in js.get("animations", []):
        for s in anim["samplers"]:
            used_acc.add(s["input"])
            used_acc.add(s["output"])
    acc_order = sorted(used_acc)
    acc_map = {old: new for new, old in enumerate(acc_order)}
    accessors = [js["accessors"][i] for i in acc_order]
    used_bv = set()
    for a in accessors:
        if "bufferView" in a:
            used_bv.add(a["bufferView"])
        sp = a.get("sparse")
        if sp:
            used_bv.add(sp["indices"]["bufferView"])
            used_bv.add(sp["values"]["bufferView"])
    for img in js.get("images", []):
        if "bufferView" in img:
            used_bv.add(img["bufferView"])
    bv_order = sorted(used_bv)
    bv_map = {old: new for new, old in enumerate(bv_order)}
    out = bytearray()
    views = []
    for old in bv_order:
        bv = dict(js["bufferViews"][old])
        start = bv.get("byteOffset", 0)
        chunk = binary[start:start + bv["byteLength"]]
        while len(out) % 4:
            out.append(0)
        bv["byteOffset"] = len(out)
        out += chunk
        views.append(bv)
    for a in accessors:
        if "bufferView" in a:
            a["bufferView"] = bv_map[a["bufferView"]]
        sp = a.get("sparse")
        if sp:
            sp["indices"]["bufferView"] = bv_map[sp["indices"]["bufferView"]]
            sp["values"]["bufferView"] = bv_map[sp["values"]["bufferView"]]
    for img in js.get("images", []):
        if "bufferView" in img:
            img["bufferView"] = bv_map[img["bufferView"]]
    for mesh in js.get("meshes", []):
        for pr in mesh["primitives"]:
            pr["attributes"] = {k: acc_map[v] for k, v in pr["attributes"].items()}
            if "indices" in pr:
                pr["indices"] = acc_map[pr["indices"]]
            if "targets" in pr:
                pr["targets"] = [{k: acc_map[v] for k, v in t.items()} for t in pr["targets"]]
    for skin in js.get("skins", []):
        if "inverseBindMatrices" in skin:
            skin["inverseBindMatrices"] = acc_map[skin["inverseBindMatrices"]]
    for anim in js.get("animations", []):
        for s in anim["samplers"]:
            s["input"] = acc_map[s["input"]]
            s["output"] = acc_map[s["output"]]
    js["accessors"] = accessors
    js["bufferViews"] = views
    js["buffers"] = [{"byteLength": len(out)}]
    return out


def node_translations(path):
    """{nom: translation} des nœuds d'un GLB (repos des os)."""
    js, _ = load(path)
    return {n.get("name"): n.get("translation", [0.0, 0.0, 0.0]) for n in js["nodes"]}


def post_characters(path):
    js, binary = load(path)
    removed, odd = strip_rest_channels(js, binary)
    ncol = colors_to_bytes(js, binary)
    binary = compact(js, binary)
    save(path, js, binary)
    return {"channels_removed": removed, "channels_kept_not_rest": len(odd), "kept_examples": odd[:6],
            "colors_converted": ncol}


if __name__ == "__main__":
    print(post_characters(sys.argv[1]))
