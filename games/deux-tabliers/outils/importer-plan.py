"""Importe un plan du level designer dans les données du jeu.

    python3 games/deux-tabliers/outils/importer-plan.py [village-arrivee] [village]

- copie le plan tel quel dans donnees/adresses/<adresse>.json;
- écrit donnees/departs/<adresse>.json: les éléments meubles du plan (tables, assises,
  comptoir, postes, étagères) deviennent des meubles posés du catalogue, centrés sur leur
  rectangle; les objets de départ et les deux points d'apparition sont ajoutés ici.
"""

import json
import sys
from pathlib import Path

JEU = Path(__file__).resolve().parent.parent
PLANS = JEU.parent.parent / "docs" / "jeux" / "cosy-cafe" / "plans" / "plans.json"

# Dos de l'assise vers ce côté: l'assise regarde à l'opposé (0° = sud, 90° = est).
ROT_DOS = {"N": 0, "E": 270, "S": 180, "W": 90}

# Postes posés sur le comptoir: leur base est le dessus du comptoir.
SUR_COMPTOIR = {"machine": "machine-espresso", "grinder": "moulin", "register": "caisse"}
# Postes encastrés sous un plan (base au sol): plonge et frigo sous le plan, passe dans le comptoir.
ENCASTRES = {"sink": "plonge", "pass": "passe"}


def type_meuble(el):
    kind, style = el["kind"], el.get("style")
    if kind == "seat":
        return "banc" if style == "bench" else "chaise"
    if kind == "table":
        return "gueridon" if el.get("round") else "table-carree"
    if kind == "counter":
        return "comptoir"
    if kind == "backbar":
        return "arriere-comptoir"
    if kind == "station":
        if style == "fridge":
            return "frigo-armoire" if el.get("height", 0) > 1.2 else "frigo-sous-plan"
        return SUR_COMPTOIR.get(style) or ENCASTRES.get(style)
    if kind == "furniture":
        if style == "shelf":
            r = el["shape"]["rect"]
            return "etagere" if r[2] >= r[3] else "etagere-longue"
        return {"crates": "caisses-patronne", "slate": "ardoise-trottoir"}.get(style)
    return None


def centre(shape):
    if "rect" in shape:
        x, z, w, d = shape["rect"]
        return round(x + w / 2, 3), round(z + d / 2, 3)
    x, z, _ = shape["circle"]
    return x, z


def rotation(el, type_id):
    if el["kind"] == "seat":
        return ROT_DOS[el["back"]]
    if type_id == "etagere-longue":
        return 90
    return 0


def main():
    plan_id = sys.argv[1] if len(sys.argv) > 1 else "village-arrivee"
    adresse = sys.argv[2] if len(sys.argv) > 2 else "village"
    plans = json.loads(PLANS.read_text(encoding="utf-8"))
    plan = next(p for p in plans["plans"] if p["id"] == plan_id)
    (JEU / "donnees" / "adresses").mkdir(parents=True, exist_ok=True)
    (JEU / "donnees" / "departs").mkdir(parents=True, exist_ok=True)
    (JEU / "donnees" / "adresses" / f"{adresse}.json").write_text(
        json.dumps(plan, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    meubles = []
    hauteur_comptoir = 1.1
    for el in plan["levels"][0]["elements"]:
        t = type_meuble(el)
        if t is None:
            continue
        x, z = centre(el["shape"])
        y = hauteur_comptoir if t in SUR_COMPTOIR.values() else 0
        meubles.append({"id": el["id"], "type": t, "x": x, "z": z, "y": y, "rotDeg": rotation(el, t)})

    # Pile de tasses propres sur l'arrière-comptoir, au bout libre (après le frigo, x 8,75 à 9,9).
    meubles.append({"id": "pile-tasses-1", "type": "pile-tasses", "x": 9.7, "z": 7.4, "y": 0.9, "rotDeg": 0})
    staff = plan["levels"][0]["points"]["staff_start"][0]
    depart = {
        "address": adresse,
        "spawns": [[round(staff[0] - 0.4, 3), staff[1]], [round(staff[0] + 0.8, 3), staff[1]]],
        "furniture": meubles,
        "objects": [
            {"type": "plateau", "furniture": "counter-1", "slot": "libre"},
            {"type": "tasse", "furniture": "backbar-1", "slot": "a"},
            {"type": "tasse", "furniture": "backbar-1", "slot": "b"},
            {"type": "tasse-sale", "furniture": "table-1", "slot": "a"},
        ],
    }
    (JEU / "donnees" / "departs" / f"{adresse}.json").write_text(
        json.dumps(depart, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main()
