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
# Modules posés case par case sur une file (aménagements).
MODULES = ("haie", "talus", "rang", "voie")


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
    bornes = {}
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
        mini, maxi = [1e9] * 3, [-1e9] * 3
        for prim in g["meshes"][noeud["mesh"]]["primitives"]:
            acc = g["accessors"][prim["attributes"]["POSITION"]]
            mini = [min(a, b) for a, b in zip(mini, acc["min"])]
            maxi = [max(a, b) for a, b in zip(maxi, acc["max"])]
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
        bornes[ident] = (mini, maxi)
        # Module de file (haie, talus, rang): il court sur exactement 1 m et ne déborde pas de
        # sa case, sinon deux modules voisins se chevauchent ou laissent un jour.
        if m["family"] in MODULES:
            long_axe = 2 if m["family"] in ("rang", "voie") else 0
            travers = 0 if long_axe == 2 else 2
            # Un module de voie est large (ballast, fossés, talus): seule sa longueur est d'un mètre.
            large = m["family"] == "voie"
            if abs(mini[long_axe] + 0.5) > 0.002:
                erreurs.append(f"{ident}: le module commence à {mini[long_axe]:.3f} m (attendu -0,5)")
            if maxi[long_axe] > 0.502 or mini[long_axe] < -0.502 or (not large and (maxi[travers] > 0.502 or mini[travers] < -0.502)):
                erreurs.append(f"{ident}: déborde de sa case de 1 m ({mini} .. {maxi})")
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
        # Meuble de cette chaîne: posé au centre de son emprise, il doit tenir dans ses cases.
        if fiche["model"] in bornes and miens[fiche["model"]]["family"] in ("meuble", "objet", "fete"):
            mini, maxi = bornes[fiche["model"]]
            demi_w, demi_d = fiche["size"]["w"] / 2 + 0.005, fiche["size"]["h"] / 2 + 0.005
            if mini[0] < -demi_w or maxi[0] > demi_w or mini[2] < -demi_d or maxi[2] > demi_d:
                erreurs.append(f"meuble {fiche['id']}: le modèle « {fiche['model']} » sort de ses {fiche['size']['w']} x {fiche['size']['h']} cases ({mini} .. {maxi})")
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
