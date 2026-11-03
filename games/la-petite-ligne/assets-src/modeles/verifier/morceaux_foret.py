"""Triangles d'arbres par morceau de 12 m de la carte 0.13, avec les vrais comptes des modèles livrés.

Lancer: python3 games/la-petite-ligne/assets-src/modeles/verifier/morceaux_foret.py
Le validateur de la carte (valider_carte.py, règle c) compte les arbres avec `triangles_par_type`, une estimation
écrite par le générateur; ce contrôle prend les triangles réels (stats/*.json, fruits compris) et signale tout
morceau au-delà de 12 arbres ou de 4 500 triangles. Il affiche aussi la table à recopier dans le générateur.
"""
import json
import math
import os

ICI = os.path.dirname(os.path.abspath(__file__))
JEU = os.path.normpath(os.path.join(ICI, "..", "..", ".."))
CARTE = os.path.join(JEU, "donnees", "cartes-0-13", "halte.json")
# type de la carte -> nœuds possibles (variantes du rendu, modeles.ts); on prend le plus lourd
VARIANTES = {"tree_oak": ["tree_oak_large", "tree_oak_small"], "tree_fir": ["tree_fir_large", "tree_fir_small"],
             "tree_birch": ["tree_birch_large", "tree_birch_small"], "tree_apple": ["tree_oak_small"]}


def triangles():
    out = {}
    for f in ("bourg", "foret013"):
        st = json.load(open(os.path.join(ICI, "..", "stats", f + ".json"), encoding="utf-8"))
        for k, v in st["nodes"].items():
            out[k] = v["tris"]
    return out


def main():
    tris = triangles()
    carte = json.load(open(CARTE, encoding="utf-8"))
    types = carte["types"]
    reel = {}
    for t, d in types.items():
        if d["categorie"] == "arbre":
            noeuds = VARIANTES.get(t, [t])
            reel[t] = max(tris.get(n, 0) for n in noeuds)
    morceaux = {}
    for o in carte["objets"]:
        if types[o["type"]]["categorie"] != "arbre":
            continue
        m = morceaux.setdefault((math.floor(o["x"] / 12), math.floor(o["y"] / 12)), [0, 0, []])
        m[0] += 1
        m[1] += reel[o["type"]]
        m[2].append(o["type"])
    pire = sorted(morceaux.items(), key=lambda kv: -kv[1][1])
    erreurs = 0
    for (i, j), (n, t, lst) in pire[:6]:
        ok = n <= 12 and t <= 4500
        erreurs += not ok
        print(f"morceau ({i * 12}, {j * 12}): {n} arbres, {t} triangles {'' if ok else '  AU-DELÀ'}")
    print("triangles réels par type:", json.dumps(reel, ensure_ascii=False))
    print("estimation du générateur:", json.dumps(carte.get("triangles_par_type", {}), ensure_ascii=False))
    print("morceaux au-delà:", erreurs)


if __name__ == "__main__":
    main()
