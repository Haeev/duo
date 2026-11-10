"""Contrôle des décors, sans Blender: GLB et manifeste `decors.json`.

Usage: python3 verifier_decors.py <dossier des GLB> <dossier des fiches de meubles>
Vérifie: chaque modèle du manifeste est un nœud racine de son GLB; triangles comptés dans le GLB,
sous le budget de la famille; rien sous le sol (2 mm de tolérance); un seul matériau par fichier,
couleurs de sommets présentes; cotes humaines (assise 0,45 m, plateau de table 0,75 m, couchage 0,45
à 0,55 m, porte de 2 m à 2,2 m); emprise d'un meuble dans les cases de sa fiche; fiches de meubles
qui pointent vers un modèle livré ou annoncé. Sortie: `VERIFICATION decors: N erreur(s)`.
"""
import json
import os
import struct
import sys

COTES = {"assise": (0.43, 0.47), "plateau_table": (0.73, 0.77), "couchage": (0.45, 0.55), "porte": (2.0, 2.2)}


def lire_glb(chemin):
    with open(chemin, "rb") as f:
        data = f.read()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"{chemin}: pas un GLB"
    n, _ = struct.unpack_from("<II", data, 12)
    gltf = json.loads(data[20:20 + n])
    return gltf


def main():
    dossier, fiches = sys.argv[1], sys.argv[2]
    erreurs = []
    with open(os.path.join(dossier, "decors.json"), encoding="utf-8") as f:
        manifeste = json.load(f)
    # Les modèles d'une autre chaîne (`source`) ont leur propre contrôle (recoltables-aubrune/verifier.py).
    autres = {m["file"] for m in manifeste["models"].values() if "source" in m}
    glbs = {}
    for nom in sorted(os.listdir(dossier)):
        if nom.endswith(".glb") and nom not in autres:
            glbs[nom] = lire_glb(os.path.join(dossier, nom))
            g = glbs[nom]
            if len(g.get("materials", [])) != 1:
                erreurs.append(f"{nom}: {len(g.get('materials', []))} matériaux (un seul attendu)")
            for me in g["meshes"]:
                for prim in me["primitives"]:
                    if "COLOR_0" not in prim["attributes"]:
                        erreurs.append(f"{nom}/{me['name']}: pas de couleurs de sommets")
    total = 0
    for ident, m in sorted(manifeste["models"].items()):
        if "source" in m:
            continue
        g = glbs.get(m["file"])
        if g is None:
            erreurs.append(f"{ident}: fichier {m['file']} absent")
            continue
        racines = [g["nodes"][i] for i in g["scenes"][0]["nodes"]]
        noeud = next((n for n in racines if n["name"] == ident), None)
        if noeud is None:
            erreurs.append(f"{ident}: nœud racine absent de {m['file']}")
            continue
        tris = 0
        bas = 1e9
        for ci in noeud.get("children", []):
            enfant = g["nodes"][ci]
            for prim in g["meshes"][enfant["mesh"]]["primitives"]:
                tris += g["accessors"][prim["indices"]]["count"] // 3
                pos = g["accessors"][prim["attributes"]["POSITION"]]
                bas = min(bas, pos["min"][1] + enfant.get("translation", [0, 0, 0])[1])
        total += tris
        if tris != m["triangles"]:
            erreurs.append(f"{ident}: {tris} triangles dans le GLB, {m['triangles']} au manifeste")
        if m.get("budget") is not None and tris > m["budget"]:
            erreurs.append(f"{ident}: {tris} triangles pour un budget de {m['budget']}")
        if bas < -0.002:
            erreurs.append(f"{ident}: descend sous le sol ({bas:.3f} m)")
        if "seat" in m and not COTES["assise"][0] <= m["seat"]["height"] <= COTES["assise"][1]:
            erreurs.append(f"{ident}: assise à {m['seat']['height']} m")
        if m["family"] == "table" and not COTES["plateau_table"][0] <= m.get("top", 0) <= COTES["plateau_table"][1]:
            erreurs.append(f"{ident}: plateau à {m.get('top')} m")
        if "bed" in m and not COTES["couchage"][0] <= m["bed"]["height"] <= COTES["couchage"][1]:
            erreurs.append(f"{ident}: couchage à {m['bed']['height']} m")
        for porte in m.get("doors", []):
            if not COTES["porte"][0] <= porte["height"] <= COTES["porte"][1]:
                erreurs.append(f"{ident}: porte de {porte['height']} m")
        if m["family"] == "maison" and not m.get("doors"):
            erreurs.append(f"{ident}: maison sans porte")
        if m["family"] == "maison" and len(m["nodes"]) != 2:
            erreurs.append(f"{ident}: murs et toit attendus en deux nœuds")
    # Fiches de meubles: le modèle nommé existe; l'objet tient dans ses cases (arbres exceptés: houppier).
    for nom in sorted(os.listdir(fiches)):
        if not nom.endswith(".json"):
            continue
        with open(os.path.join(fiches, nom), encoding="utf-8") as f:
            fiche = json.load(f)
        m = manifeste["models"].get(fiche["model"])
        if m is None:
            erreurs.append(f"meuble {fiche['id']}: modèle {fiche['model']} absent des décors")
            continue
        if m["family"] in ("arbre", "buisson"):
            continue
        if m["size"]["w"] > fiche["size"]["w"] + 0.01 or m["size"]["d"] > fiche["size"]["h"] + 0.01:
            erreurs.append(f"meuble {fiche['id']}: {m['size']['w']} x {m['size']['d']} m déborde de {fiche['size']['w']} x {fiche['size']['h']} cases")
    for e in erreurs:
        print("ERREUR", e)
    print(f"VERIFICATION decors: {len(manifeste['models'])} modèles, {total} triangles, {len(erreurs)} erreur(s)")
    sys.exit(1 if erreurs else 0)


main()
