"""Taille d'une sauvegarde de La Petite Ligne: fin de la version 1 et projection à 100 heures.

Document lié: docs/jeux/jeu-1/cahier-des-charges.md (section 4.12).

Construit un monde synthétique avec les quantités attendues (section 6 du cahier),
dans un JSON lisible, aux clés explicites et sans optimisation, puis mesure sa taille
brute et compressée (gzip). C'est une borne haute pour l'architecte: un format plus
compact (tableaux, identifiants courts) ferait moins.

Usage: python3 taille_sauvegarde.py
Bibliothèque standard uniquement, graine fixe.
"""

from __future__ import annotations

import gzip
import json
import random
from typing import Any

SEED = 20261030

CROPS = ["radis", "laitue", "feves", "carotte", "bleuet", "fraisier", "tomate", "haricot-vert",
         "courgette", "melon", "ble", "tournesol", "fines-herbes", "potiron", "betterave", "chou",
         "pomme-de-terre", "lentille", "poireau", "mache"]
FAMILIES = ["racines", "verdures", "fruits", "legumineuses", "fleurs"]


def cell(rng: random.Random, x: int, y: int) -> dict[str, Any]:
    return {"x": x, "y": y, "soil": "tilled", "vigor": rng.randint(20, 100),
            "lastFamily": rng.choice(FAMILIES), "crop": rng.choice(CROPS), "stage": rng.randint(0, 4),
            "growthDays": rng.randint(0, 12), "wateredToday": rng.random() < 0.5,
            "fertilized": rng.random() < 0.3, "careStreak": rng.randint(0, 12)}


def placed(rng: random.Random, i: int, kind: str) -> dict[str, Any]:
    return {"id": f"{kind}-{i:05d}", "kind": kind, "x": rng.randint(0, 120), "y": rng.randint(0, 90),
            "rotation": rng.choice([0, 90, 180, 270]), "variant": rng.choice(["sapin", "chene", "merisier"]),
            "tint": rng.choice(["ocre", "vert-sauge", "bleu-ardoise", "brique", "creme", "noir"]), "placedBy": "p1"}


def zone(rng: random.Random, name: str, tilled: int, trees: int, objects: int, building_parts: int) -> dict[str, Any]:
    return {
        "id": name,
        "cells": [cell(rng, i % 40, i // 40) for i in range(tilled)],
        "trees": [{"id": f"{name}-arbre-{i:04d}", "species": rng.choice(["chene", "hetre", "frene", "pommier"]),
                   "x": rng.randint(0, 120), "y": rng.randint(0, 90), "stage": rng.randint(0, 5),
                   "chopsLeft": rng.randint(0, 4), "regrowDays": rng.randint(0, 10)} for i in range(trees)],
        "objects": [placed(rng, i, rng.choice(["cloture", "chemin", "pot", "banc", "lanterne"])) for i in range(objects)],
        "buildings": [{"id": f"{name}-batiment-{b}", "parts": [
            {"id": f"{name}-b{b}-e{i:04d}", "kind": rng.choice(["mur", "sol", "porte", "fenetre", "toit", "meuble"]),
             "x": rng.randint(0, 14), "y": rng.randint(0, 12), "level": 0, "rotation": rng.choice([0, 90, 180, 270]),
             "built": rng.random() < 0.9, "progress": rng.random(), "material": rng.choice(["pierre", "sapin", "chene"])}
            for i in range(building_parts // 4)]} for b in range(4)],
        "animals": [{"id": f"{name}-bete-{i}", "species": rng.choice(["poule", "chevre"]), "name": f"Bête {i}",
                     "friendship": rng.randint(0, 1000), "fedToday": True, "producedToday": False,
                     "x": rng.randint(0, 120), "y": rng.randint(0, 90)} for i in range(10)],
    }


def world(rng: random.Random, gares: int, days: int, villager_count: int, pages: int) -> dict[str, Any]:
    zones = [zone(rng, f"gare-{g}", tilled=150, trees=350, objects=500, building_parts=600) for g in range(gares)]
    characters = [{
        "id": f"p{p}", "playerId": f"machine-{p}", "name": "Prénom", "appearance": {k: rng.randint(0, 11) for k in (
            "body", "face", "hair", "hairColor", "skin", "outfit", "outfitColor", "hat", "scarf", "shoes")},
        "traits": ["bonne-fourchette", "nez-au-vent"], "needs": {"belly": 70, "sleep": 80, "heart": 65},
        "zone": "gare-0", "x": 40.5, "y": 22.25, "facing": 90, "endurance": 83.5, "mainJob": "maraichage",
        "jobs": {j: {"xp": rng.randint(0, 9000), "rank": rng.randint(1, 3), "specialty": None}
                 for j in ("maraichage", "elevage", "bois", "cuisine", "peche")},
        "bag": [{"item": rng.choice(CROPS), "quality": rng.randint(0, 2), "qty": rng.randint(1, 99)} for _ in range(24)],
        "toolbar": ["main", "houe", "arrosoir", "hache", "pioche", "canne", "jumelles", "marteau", None, None],
        "tools": {"houe": 2, "arrosoir": 2, "hache": 1, "pioche": 1, "canne": 2},
        "assists": {"endurance": "normale", "wateringAid": False, "readyPlans": True, "guide": True, "biteWindow": "normale"},
        "envy": {"id": "pique-niquer-etang", "shared": True, "done": False},
        "recentEnvies": [f"envie-{i}" for i in range(7)],
    } for p in range(2)]
    villagers = [{"id": f"habitant-{v}", "bond": rng.randint(0, 1000), "storyStep": rng.randint(0, 5),
                  "flags": {f"f{i}": rng.random() < 0.5 for i in range(20)},
                  "giftsThisWeek": {"p0": rng.randint(0, 3), "p1": rng.randint(0, 3)},
                  "memories": [{"day": rng.randint(1, days), "event": "cadeau-adore", "by": "p0", "item": "tarte"}
                               for _ in range(40)], "errand": "epicerie"} for v in range(villager_count)]
    return {
        "dataSchema": 1, "contentVersion": "1.0.0", "episodes": ["v1"], "seed": 123456789,
        "rng": [rng.getrandbits(32) for _ in range(4)],
        "clock": {"year": 1 + days // 84, "season": 3, "day": 21, "minute": 845, "weather": "neige", "tomorrow": "soleil"},
        "settings": {"dayLength": "normale", "orderSize": "normale", "bigPurchase": 500, "afkMinutes": 3},
        "purse": 4321, "cellar": [{"item": f"objet-{i}", "quality": rng.randint(0, 2), "qty": rng.randint(1, 300)}
                                  for i in range(60 * gares)],
        "characters": characters, "zones": zones, "villagers": villagers,
        "trust": 41, "order": {"lines": [{"item": rng.choice(CROPS), "qty": 12, "minQuality": 1, "delivered": 5} for _ in range(7)]},
        "orderHistory": [[rng.choice(CROPS) for _ in range(7)] for _ in range(days // 7)],
        "visitors": [{"id": f"visiteur-{i}", "template": "randonneuse", "request": "voir-martin-pecheur", "leavesDay": 3}
                     for i in range(3)],
        "notebook": [{"id": f"page-{i:03d}", "day": rng.randint(1, days), "zone": "gare-0", "together": rng.random() < 0.4}
                     for i in range(pages)],
        "story": {f"etape-{i}": rng.random() < 0.7 for i in range(150 * gares)},
        "journal": [{"day": d, "events": [{"id": "recolte", "params": {"item": "radis", "qty": 12}} for _ in range(4)]}
                    for d in range(1, days + 1)],
        "pendingProposals": [], "gifts": [{"from": "p0", "to": "p1", "item": "bouquet-bleuets", "note": "Pour ton coin"}],
    }


def measure(label: str, data: dict[str, Any]) -> None:
    raw = json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    packed = gzip.compress(raw, compresslevel=6)
    print(f"{label:<44}{len(raw) / 1024:>10.0f} Ko brut{len(packed) / 1024:>10.0f} Ko gzip")


def main() -> None:
    rng = random.Random(SEED)
    print("Taille d'une sauvegarde (JSON lisible, borne haute)")
    # Zones: chaque gare, plus la voie des Vergers (comptée comme une zone pleine: borne haute).
    measure("Fin de la version 1 (3 zones, 10 habitants, 84 j)", world(rng, gares=3, days=84, villager_count=10, pages=165))
    measure("Jeu complet à 100 h (7 zones, 30 habitants, 361 j)", world(rng, gares=7, days=361, villager_count=30, pages=485))


if __name__ == "__main__":
    main()
