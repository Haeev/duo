"""Contrôle des récoltables d'Aubrune, sans Blender: GLB, manifeste et fiches du jeu.

    python3 verifier.py <dossier des GLB (decors.json)> <donnees/commun>

Vérifie, pour chaque modèle de la chaîne (`source: "recoltables-aubrune"`): nœud racine à son
nom dans son fichier; primitives aux matériaux nommés dans la table `materials`, avec normales
et `COLOR_0`, sans UV; triangles comptés dans le GLB, égaux au manifeste et sous le budget de la
famille (par plant pour une culture); rien sous le sol; une case de potager tient dans sa case;
variantes et états qui pointent vers des modèles livrés. Puis les fiches: tout meuble à brique
`harvest` ou `field` a son modèle et l'état que sa ressource laisse (`stump`, `bare`), toute
culture a un modèle par stade. Sortie: `VERIFICATION recoltables: N erreur(s)`.
"""

import json
import os
import struct
import sys

SOURCE = "recoltables-aubrune"
POIDS_MAX = 2_500_000
# Une case de potager fait 1 m; le feuillage d'un plant mûr peut déborder un peu sur l'allée.
CASE_MAX = {"parcelle": 1.0, "culture": 1.12}


def lire_glb(chemin):
    with open(chemin, "rb") as f:
        data = f.read()
    magic, _, _ = struct.unpack_from("<III", data, 0)
    assert magic == 0x46546C67, f"{chemin}: pas un GLB"
    n, _ = struct.unpack_from("<II", data, 12)
    return json.loads(data[20:20 + n]), len(data)


def lire_json(chemin):
    with open(chemin, encoding="utf8") as f:
        return json.load(f)


def main():
    dossier, donnees = sys.argv[1], sys.argv[2]
    erreurs = []
    manifeste = lire_json(os.path.join(dossier, "decors.json"))
    modeles = manifeste["models"]
    miens = {i: m for i, m in modeles.items() if m.get("source") == SOURCE}
    materiaux = manifeste.get("materials", {})
    glbs = {}
    for fichier in sorted({m["file"] for m in miens.values()}):
        chemin = os.path.join(dossier, fichier)
        if not os.path.exists(chemin):
            erreurs.append(f"{fichier}: fichier absent")
            continue
        glbs[fichier], poids = lire_glb(chemin)
        if poids > POIDS_MAX:
            erreurs.append(f"{fichier}: {poids} octets (plafond {POIDS_MAX})")
        for mat in glbs[fichier].get("materials", []):
            if mat["name"] not in materiaux:
                erreurs.append(f"{fichier}: matériau « {mat['name']} » absent de la table materials")
    total = 0
    for ident, m in sorted(miens.items()):
        g = glbs.get(m["file"])
        if g is None:
            continue
        racines = [g["nodes"][i] for i in g["scenes"][0]["nodes"]]
        noeud = next((n for n in racines if n["name"] == ident), None)
        if noeud is None or "mesh" not in noeud:
            erreurs.append(f"{ident}: nœud racine absent de {m['file']}")
            continue
        if any(k in noeud for k in ("translation", "rotation", "scale", "children")):
            erreurs.append(f"{ident}: transformation ou enfants sur le nœud (tout doit être appliqué)")
        tris, bas = 0, 1e9
        for prim in g["meshes"][noeud["mesh"]]["primitives"]:
            attributs = prim["attributes"]
            for voulu in ("POSITION", "NORMAL", "COLOR_0"):
                if voulu not in attributs:
                    erreurs.append(f"{ident}: attribut {voulu} absent")
            if "TEXCOORD_0" in attributs:
                erreurs.append(f"{ident}: UV inutiles (la matière encrée n'en lit pas)")
            tris += g["accessors"][prim["indices"]]["count"] // 3
            bas = min(bas, g["accessors"][attributs["POSITION"]]["min"][1])
        total += tris
        if tris != m["triangles"]:
            erreurs.append(f"{ident}: {tris} triangles dans le GLB, {m['triangles']} au manifeste")
        if tris / m.get("plants", 1) > m["budget"]:
            erreurs.append(f"{ident}: {tris} triangles pour un budget de {m['budget']}" + (" par plant" if "plants" in m else ""))
        if bas < -0.002:
            erreurs.append(f"{ident}: descend sous le sol ({bas:.3f} m)")
        if m.get("cell") and max(m["size"]["w"], m["size"]["d"]) > CASE_MAX[m["family"]] + 0.001:
            erreurs.append(f"{ident}: {m['size']['w']} x {m['size']['d']} m déborde de sa case")
        for autre in m.get("variants", []) + list(m.get("states", {}).values()):
            if autre not in miens:
                erreurs.append(f"{ident}: variante ou état « {autre} » sans modèle")
    # Cultures: un modèle par stade (le dernier est mûr), et les mêmes à arroser.
    cultures = {}
    for nom in sorted(os.listdir(os.path.join(donnees, "cultures"))):
        if nom.endswith(".json"):
            fiche = lire_json(os.path.join(donnees, "cultures", nom))
            cultures[fiche["id"]] = fiche
    for ident, fiche in cultures.items():
        entree = manifeste.get("crops", {}).get(fiche.get("model", ""))
        if entree is None:
            erreurs.append(f"culture {ident}: pas de modèle (champ « model » de la fiche, entrée de recoltables.toml)")
            continue
        stades = len(fiche["stages"])
        if len(entree["stages"]) != stades + 1 or len(entree["thirsty"]) != stades:
            erreurs.append(f"culture {ident}: {len(entree['stages'])} modèles pour {stades} stades et la maturité (relancer construire.sh)")
        for modele in entree["stages"] + entree["thirsty"]:
            if modele not in miens:
                erreurs.append(f"culture {ident}: modèle « {modele} » absent")
    # Meubles récoltables: le modèle, et ce que la ressource laisse une fois récoltée.
    ressources = {}
    for nom in sorted(os.listdir(os.path.join(donnees, "ressources"))):
        if nom.endswith(".json"):
            fiche = lire_json(os.path.join(donnees, "ressources", nom))
            ressources[fiche["id"]] = fiche
    recoltables = 0
    for nom in sorted(os.listdir(os.path.join(donnees, "meubles"))):
        if not nom.endswith(".json"):
            continue
        fiche = lire_json(os.path.join(donnees, "meubles", nom))
        briques = {b["brick"]: b for b in fiche["bricks"]}
        if "harvest" not in briques and "field" not in briques:
            continue
        recoltables += 1
        m = modeles.get(fiche["model"])
        if m is None:
            erreurs.append(f"meuble {fiche['id']}: modèle « {fiche['model']} » absent des décors")
            continue
        if "harvest" in briques:
            apres = ressources.get(briques["harvest"]["resource"], {}).get("after", "gone")
            if apres != "gone" and apres not in m.get("states", {}):
                erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » n'a pas l'état « {apres} » que laisse sa ressource")
        if "field" in briques:
            for etat in ("tilled", "watered"):
                if etat not in m.get("states", {}):
                    erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » n'a pas l'état « {etat} »")
            if m["size"]["w"] > fiche["size"]["w"] + 0.01 or m["size"]["d"] > fiche["size"]["h"] + 0.01:
                erreurs.append(f"meuble {fiche['id']}: {m['size']['w']} x {m['size']['d']} m déborde de {fiche['size']['w']} x {fiche['size']['h']} cases")
    for e in erreurs:
        print("ERREUR", e)
    print(f"VERIFICATION recoltables: {len(miens)} modèles, {total} triangles, {len(cultures)} cultures, {recoltables} meubles récoltables, {len(erreurs)} erreur(s)")
    sys.exit(1 if erreurs else 0)


main()
