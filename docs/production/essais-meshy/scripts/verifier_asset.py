"""Contrôle automatique d'un asset mis en conformité (Python standard, sans Blender: utilisable en CI).

Lit le GLB final et sa fiche, et vérifie:
- triangles sous le plafond de la fiche (`max_triangles`, catégories de C8 dans technique.md);
- un seul matériau, nommé comme le matériau commun (palette), une seule image, de 64 px au plus
  (ou `max_texture_px` de la fiche, pour un atlas);
- attributs attendus pour le groupement (`BatchedMesh`): POSITION, NORMAL, TEXCOORD_0, et COLOR_0
  si l'occlusion est cuite;
- taille réelle: la cote de la fiche à 2 % près; pivot au centre de la base (bas à 1 mm de y = 0,
  centre à 1 cm de l'axe);
- noms de nœuds en snake_case; clips: exactement ceux de la fiche;
- fiche: chaque tâche a son identifiant et ses crédits, et le total est juste.

Usage: python3 verifier_asset.py <asset.glb> <fiche.json>   (code de sortie 1 si un contrôle échoue)
"""

import json
import re
import struct
import sys

GLB, FICHE = sys.argv[1], sys.argv[2]
with open(FICHE, encoding="utf-8") as fh:
    sheet = json.load(fh)
conf = sheet.get("conformity", {})
with open(GLB, "rb") as fh:
    data = fh.read()
length = struct.unpack_from("<I", data, 12)[0]
gltf = json.loads(data[20:20 + length].decode("utf-8"))

results = []


def check(name, ok, detail):
    results.append((ok, name, detail))


# Triangles et attributs.
triangles = 0
attributes = set()
lo, hi = [float("inf")] * 3, [float("-inf")] * 3
for node in gltf.get("nodes", []):
    if "mesh" not in node:
        continue
    t = node.get("translation", [0, 0, 0])
    s = node.get("scale", [1, 1, 1])
    for prim in gltf["meshes"][node["mesh"]]["primitives"]:
        attributes |= set(prim["attributes"])
        pos = gltf["accessors"][prim["attributes"]["POSITION"]]
        count = gltf["accessors"][prim["indices"]]["count"] if "indices" in prim else pos["count"]
        triangles += count // 3
        # Boîte englobante d'après min/max de l'accesseur (rotation des nœuds non prise en compte).
        for k in range(3):
            lo[k] = min(lo[k], pos["min"][k] * s[k] + t[k])
            hi[k] = max(hi[k], pos["max"][k] * s[k] + t[k])
budget = conf.get("max_triangles")
check("triangles", budget is None or triangles <= budget, f"{triangles} pour un plafond de {budget}")

materials = [m.get("name", "") for m in gltf.get("materials", [])]
expected_material = conf.get("material_name", "cosy_palette" if "clips" not in conf else "cosy_characters")
check("matériau commun", materials == [expected_material], f"matériaux {materials}, attendu [{expected_material}]")

max_px = conf.get("max_texture_px", 64)
sizes = []
for img in gltf.get("images", []):
    view = gltf["bufferViews"][img["bufferView"]]
    blob = data[20 + length + 8 + view.get("byteOffset", 0):][: view["byteLength"]]
    if blob[:8] == b"\x89PNG\r\n\x1a\n":
        sizes.append(struct.unpack(">II", blob[16:24]))
    else:
        sizes.append(None)
check("textures", len(sizes) == 1 and sizes[0] is not None and max(sizes[0]) <= max_px, f"images {sizes}, {max_px} px au plus, PNG")

needed = {"POSITION", "NORMAL", "TEXCOORD_0"}
if conf.get("bake_ao"):
    needed.add("COLOR_0")
if "clips" in conf:
    needed |= {"JOINTS_0", "WEIGHTS_0"}
check("attributs", needed <= attributes, f"présents {sorted(attributes)}, attendus {sorted(needed)}")

# Taille et pivot (glTF: x largeur, y hauteur, z profondeur).
axis = {"width": 0, "height": 1, "depth": 2}
size = [hi[k] - lo[k] for k in range(3)]
if "target_size_m" in conf:
    tgt = conf["target_size_m"]
    got = size[axis[tgt["axis"]]]
    check("cote réelle", abs(got - tgt["value"]) <= 0.02 * tgt["value"], f"{tgt['axis']} {got:.3f} m pour {tgt['value']} m")
if "target_height_m" in conf:
    check("taille du personnage", abs(size[1] - conf["target_height_m"]) <= 0.02 * conf["target_height_m"], f"hauteur au repos {size[1]:.3f} m pour {conf['target_height_m']} m (boîte des sommets sans pose)")
if "clips" not in conf:
    check("pivot", abs(lo[1]) <= 0.001 and abs((lo[0] + hi[0]) / 2) <= 0.01 and abs((lo[2] + hi[2]) / 2) <= 0.01, f"bas y={lo[1]:.4f}, centre x={(lo[0] + hi[0]) / 2:.4f}, z={(lo[2] + hi[2]) / 2:.4f}")

names = [n.get("name", "") for n in gltf.get("nodes", []) if "mesh" in n or "skin" in n]
bad = [n for n in names if not re.fullmatch(r"[a-z0-9_]+", n)]
check("noms", not bad, f"nœuds hors snake_case: {bad}" if bad else f"{names}")

if "clips" in conf:
    clips = sorted(a.get("name", "") for a in gltf.get("animations", []))
    wanted = sorted(c["name"] for c in conf["clips"])
    check("clips", clips == wanted, f"{clips}, attendus {wanted}")

tasks = sheet.get("tasks")
if tasks is not None:
    complete = all(t.get("task_id") and isinstance(t.get("credits"), (int, float)) for t in tasks)
    total = sum(t.get("credits", 0) for t in tasks)
    check("fiche", complete and total == sheet.get("credits_total"), f"{len(tasks)} tâches, {total} crédits, total déclaré {sheet.get('credits_total')}")

for ok, name, detail in results:
    print(f"{'OK    ' if ok else 'ÉCHEC '} {name}: {detail}")
sys.exit(0 if all(ok for ok, _, _ in results) else 1)
