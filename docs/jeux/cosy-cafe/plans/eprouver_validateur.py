#!/usr/bin/env python3
"""Éprouve valider_plans.py sur des plans du village cassés exprès.

Chaque cas abîme une copie du plan « village-maximum » (en mémoire, plans.json n'est pas
modifié) et vérifie que le validateur lève l'erreur attendue. À relancer après toute retouche
du validateur: un contrôle qui ne peut jamais échouer ne protège rien.

Usage: python3 -I eprouver_validateur.py
Code de sortie 0 si chaque cas est détecté. Bibliothèque standard seulement.
"""

import copy
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import valider_plans as V  # noqa: E402  (module voisin, chargé après l'ajout du dossier au chemin)


def element(plan, pred):
    return next(e for e in plan["levels"][0]["elements"] if pred(e))


def table_in_queue(plan):
    plan["levels"][0]["elements"].append({"id": "t-x", "kind": "table", "shape": {"circle": [10.5, 11.0, 0.3]},
                                          "blocks": True, "opaque": False, "height": 0.75})


def open_flap(plan):
    element(plan, lambda e: e["kind"] == "door" and e.get("label") == "portillon")["access"] = "public"


def narrow_wc(plan):
    element(plan, lambda e: e["kind"] == "door" and e.get("label") == "WC")["width"] = 0.8


def shelf_hides_door(plan):
    plan["levels"][0]["elements"].append({"id": "s-x", "kind": "furniture", "shape": {"rect": [9.9, 10.6, 0.1, 1.6]},
                                          "blocks": True, "opaque": True, "height": 2.0})


def wrong_capacity(plan):
    plan["capacity"]["inside"] = 13


def boxed_seat(plan):
    plan["levels"][0]["elements"].append({"id": "c-x", "kind": "furniture", "shape": {"rect": [4.7, 9.2, 1.1, 1.8]},
                                          "blocks": True, "opaque": False, "height": 1.0})


def queue_through_work(plan):
    plan["levels"][0]["queues"][0]["points"] = [[10.5, 12.05], [10.5, 9.95], [10.5, 9.0]]


def crowd_wall(plan):
    # Trente figurants de plus dans la salle, vue en entier depuis la caisse: le plafond de 40 doit sauter.
    for z in plan["levels"][0]["zones"]:
        if z["kind"] == "space" and z["label"] == "salle et comptoir":
            z["extras"] = 30


CASES = [
    ("table posée dans la file", table_in_queue, "posé dans le passage « file »"),
    ("portillon ouvert aux clients", open_flap, "un client peut entrer dans « zone de travail »"),
    ("porte des toilettes de 0,80 m", narrow_wc, "de 0,80 m"),
    ("étagère haute entre la caisse et la porte", shelf_hides_door, "cachés"),
    ("capacité annoncée fausse", wrong_capacity, "capacité dessinée"),
    ("place enfermée par une caisse", boxed_seat, "sans passage de 0,90 m"),
    ("file qui passe derrière le comptoir", queue_through_work, "traverse une zone de travail"),
    ("foule au-dessus du plafond", crowd_wall, "personnages au pire dans le champ"),
]


def main():
    with open(os.path.join(HERE, "plans.json"), encoding="utf-8") as f:
        data = json.load(f)
    base = next(p for p in data["plans"] if p["id"] == "village-maximum")
    results = []
    for name, mutate, expected in CASES:
        plan = copy.deepcopy(base)
        mutate(plan)
        rep = V.check_plan(plan, data["norms"], with_grid=False)
        hit = [e for e in rep.errors if expected in e]
        results.append(bool(hit))
        print(f"{'détecté ' if hit else 'MANQUÉ  '} {name}: {hit[0] if hit else rep.errors}")
    print(f"{sum(results)}/{len(results)} cas cassés détectés")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
