#!/usr/bin/env python3
"""Données du chantier clientèle (Deux Tabliers) depuis celles du game designer.

Sources: `docs/jeux/cosy-cafe/demo/donnees/*.json` (démo v0.1) et les constantes de la
simulation du cahier (`docs/jeux/cosy-cafe/simulations/cosy_cafe.py`, que relit aussi
`demo_v0_1.py`): flux, courbes, multiplicateurs, attrait, satisfaction, pourboires, livre d'or.
Sortie: `games/deux-tabliers/donnees/clientele/*.json` (format décrit dans `donnees/SCHEMA.md`).

Relancer après un changement des données de la démo:
    python3 games/deux-tabliers/outils/importer-clientele.py
    npx prettier --write games/deux-tabliers/donnees/clientele
"""
from __future__ import annotations

import importlib.util
import math
import re
import json
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
JEU = ICI.parent
DEPOT = JEU.parent.parent
DEMO = DEPOT / "docs" / "jeux" / "cosy-cafe" / "demo" / "donnees"
SIM = DEPOT / "docs" / "jeux" / "cosy-cafe" / "simulations" / "cosy_cafe.py"
SORTIE = JEU / "donnees" / "clientele"

SAISON = 0  # printemps: la démo ne connaît que lui
JOURS_SEMAINE = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
# Familles de la simulation du cahier (français) vers celles de la démo (anglais).
FAMILLES = {
    "noir": "black_coffee", "lait": "milk_coffee", "the": "tea", "chocolat": "chocolate",
    "frais": "cold_drink", "specialite": "specialty", "viennoiserie": "pastry_bread",
    "patisserie": "cake", "sale": "savory", "brunch": "brunch",
}
PLACES = {"comptoir": "counter", "table": "table", "confort": "comfort", "terrasse": "terrace"}
# Substituts des clients (choix du studio, en attendant les modèles de l'artiste 3D).
COULEURS = {
    "presses": "#5b6c8f", "voisins": "#8f6b4a", "flaneurs": "#6f8f5b", "familles": "#c98b3b",
    "gourmands": "#b8607a", "promeneurs": "#4f8f8a", "etudiants": "#7a6fb0", "teletravail": "#6b6b6b",
    "brunch": "#b0904f", "connaisseurs": "#3f3f5f",
}


def lire(nom: str) -> dict:
    return json.loads((DEMO / nom).read_text(encoding="utf-8"))


def ecrire(nom: str, contenu: object) -> None:
    SORTIE.mkdir(parents=True, exist_ok=True)
    (SORTIE / nom).write_text(json.dumps(contenu, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def minutes(h: str) -> int:
    hh, mm = h.split(":")
    return int(hh) * 60 + int(mm)


def charger_sim() -> object:
    spec = importlib.util.spec_from_file_location("cosy_cafe", SIM)
    if spec is None or spec.loader is None:
        raise SystemExit("simulation du cahier introuvable")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["cosy_cafe"] = mod
    spec.loader.exec_module(mod)
    return mod


def profils(cc: object) -> dict:
    src = lire("profils.json")
    out = []
    for p in src["profiles"]:
        pid = p["id"]
        out.append({
            "id": pid,
            "name": p["name"],
            "seeks": p["seeks"],
            "mainCraving": p["mainCraving"],
            "secondaryCravings": p["secondaryCravings"],
            "seat": PLACES[p["seat"]],
            "priceSensitivity": p["priceSensitivity"],
            "patienceSeconds": p["patienceSeconds"],
            "waitWithoutPenaltySeconds": p["waitWithoutPenaltySeconds"],
            "stayGameMinutes": p["stayGameMinutes"],
            "groupSizes": [[g["size"], g["share"]] for g in p["groupSizes"]],
            "eatsShare": p["eatsShare"],
            "takeAwayShare": p["takeAwayShare"],
            "reorder": None if p["reorder"] is None else [p["reorder"]["everyGameMinutes"], p["reorder"]["probability"]],
            "styles": p["styles"],
            "wantedEquipment": p["wantedEquipment"],
            "tipFactor": p["tipFactor"],
            "groupsPerDay": cc.FLUX_BASE["village"][pid],
            "hourWeights": [[h, w] for h, w in sorted(cc.COURBES[pid].items())],
            "dayFactors": list(cc.JOUR_MULT[pid][:6]),
            "weatherFactors": {m: cc.METEO_MULT[pid][i] for i, m in enumerate(cc.METEOS)},
            "seasonFactor": cc.SAISON_MULT[pid][SAISON],
            "color": COULEURS[pid],
            "models": [f"client-{pid}"],
        })
    return {"profiles": out}


def regles(cc: object) -> dict:
    adr = cc.ADR["village"]
    sat = cc.SATISFACTION
    return {
        "slateLines": adr.lignes_ardoise,
        "presentMax": adr.presents_max,
        "standingAtCounter": adr.debout,
        "queuePlaces": cc.CLIENTS["file"],
        "estimatedSecondsPerGroup": cc.CLIENTS["secondesParGroupe"],
        "softClosingGameMinutes": cc.REG["fermetureDouce"],
        "servedAfterSoftCloseGameMinutes": 5,
        "standingStayFactor": 0.5,
        "drinks": [FAMILLES[f] for f in cc.BOISSONS],
        "foods": [FAMILLES[f] for f in cc.NOURRITURES],
        "cravingWeights": {"main": 3, "secondary": 1},
        "slatePoints": {"main": cc.POINTS_CARTE["principal"], "secondary": cc.POINTS_CARTE["secondaire"],
                        "variety": cc.POINTS_CARTE["variete"], "varietyCount": 3},
        "slateFactors": cc.FACTEUR_CARTE,
        "priceBounds": list(cc.PRIX_BORNES),
        "place": {"base": cc.LIEU["base"], "ambiance": cc.LIEU["ambiance"], "style50": cc.LIEU["style50"],
                  "style75": cc.LIEU["style75"], "equipment": cc.LIEU["equipement"],
                  "equipmentMax": int(cc.LIEU["equipementsMax"])},
        "cupFactors": [[k, v] for k, v in sorted(cc.FACTEUR_TASSES.items())],
        "mood": {"pivot": cc.HUMEUR["pivot"], "slope": cc.HUMEUR["pente"], "bound": cc.HUMEUR["borne"]},
        "satisfaction": {
            "base": sat["base"], "perSecond": sat["parSeconde"], "waitMax": sat["attenteMax"],
            "perfect": sat["parfait"], "good": sat["bien"], "fine": sat["correct"],
            "connoisseurQualityWeight": 2.0, "latteArt": sat["dessin"], "homemade": sat["faitMaison"],
            "priceSlope": sat["prixPente"], "priceBound": sat["prixBorne"], "wantedSeat": sat["placeVoulue"],
            "standing": sat["debout"], "dirtyTable": sat["tableSale"], "ambianceDivisor": sat["ambianceDiviseur"],
            "chat": sat["conversation"], "asUsual": sat["commeDHabitude"], "forgottenOption": -8,
        },
        "tips": {"threshold": cc.POURBOIRE["seuil"], "rate": cc.POURBOIRE["taux"], "delightedRate": cc.POURBOIRE["tauxRavi"],
                 "delightedThreshold": cc.POURBOIRE["seuilRavi"], "probability": cc.POURBOIRE["probabilite"]},
        "guestbook": {"delighted": cc.LIVRE_DOR["ravi"], "delightedChance": cc.LIVRE_DOR["pRavi"],
                      "disappointed": cc.LIVRE_DOR["decu"], "disappointedChance": cc.LIVRE_DOR["pDecu"],
                      "regularChance": cc.LIVRE_DOR["habitue"], "regularGapDays": 3, "kept": 24},
        "seatFallbacks": {PLACES[k]: [PLACES[x] for x in v] for k, v in cc.REPLIS.items()},
        "counterSeatMaxGroup": 2,
        "weather": {
            "kinds": cc.METEOS,
            "chances": {m: cc.METEO_PROBA[m][SAISON] for m in cc.METEOS},
            "terraceOpen": cc.TERRASSE_OUVERTE,
            "names": {"soleil": "soleil", "couvert": "temps couvert", "pluie": "pluie", "chaleur": "chaleur",
                      "froid": "froid", "neige": "neige"},
            "forced": [[2, "soleil"], [4, "couvert"], [14, "soleil"]],
        },
        "talkReach": 2.5,
        "maxRegularsPerDay": 8,
        # Cheminement (choix du studio, technique 5.8): grille de 25 cm, marche d'un client.
        "walk": {"cell": 0.25, "speed": 1.1, "radius": 0.2, "searchNodes": 4000,
                 "blockedZones": ["work", "private", "extension"], "terraceZoneLabel": "E1"},
        # Places debout au zinc, devant le comptoir côté salle (adresses.md: trois personnes).
        "standingSpots": [[8.75, 10.0], [9.25, 10.0], [9.75, 10.0]],
        "seatKinds": {"banc": "terrace", "chaise": "table", "fauteuil": "comfort", "tabouret": "counter"},
        # Attente de la commande: en arc devant le passe, côté salle, hors de la file.
        "waitingSpots": [[8.3, 10.55], [8.85, 10.65], [7.75, 10.75], [8.4, 11.15], [9.0, 11.25], [7.8, 11.35]],
        # Pique-nique sur les marches de la fontaine (Godillots, noce, tables à tréteaux de la fête).
        "picnicSpots": [[round(13.6 + 1.25 * math.cos(a), 2), round(17.6 + 1.25 * math.sin(a), 2)]
                        for a in [math.pi * (0.55 + 0.1 * k) for k in range(14)]],
        # Les passants de la place (scène de Jules) longent la vitrine, d'ouest en est.
        "placeWalk": [[2.0, 14.6], [15.0, 14.6]],
        "windowWatch": {"z": 12.5, "reach": 2.5},
        # Si aucun service n'est branché (chantier a), une commande est prête après ce délai (null: jamais).
        "fallbackPrepSeconds": None,
        # Fermeture: au-delà de la fermeture douce et de ce délai, une commande encore en route est servie d'office.
        "closingGraceGameMinutes": 30,
        "extensionZones": {"E2": "village_fond"},
    }


def carte() -> dict:
    src = lire("recettes.json")
    ing = {i["id"]: i for i in lire("ingredients-fournisseurs.json")["ingredients"]}
    out = []
    for r in src["recipes"]:
        cost = round(sum(ing[x["id"]]["unitCost"] * x["qty"] for x in r["ingredients"]), 4)
        u = r["unlock"]
        unlock = {"kind": u["kind"]}
        if u["kind"] == "purchase":
            unlock["item"] = u["item"]
        if u["kind"] == "regular":
            unlock["regular"] = u["regular"]
            unlock["level"] = u["level"]
        out.append({
            "id": r["id"], "name": r["name"], "family": r["family"], "basePrice": r["basePrice"],
            "costMaterials": r["costMaterials"], "ingredientCost": cost,
            "ingredients": [[x["id"], x["qty"]] for x in r["ingredients"]],
            "stations": sorted({s["station"] for s in r["steps"]}), "dishes": r["dishes"], "unlock": unlock,
        })
    return {"recipes": out}


def fournisseurs() -> dict:
    src = lire("ingredients-fournisseurs.json")
    o = src["ordering"]
    return {
        "suppliers": [{"id": s["id"], "name": s["name"], "deliveryTime": minutes(s["deliveryTime"]),
                       "line": s["line"], "emergency": bool(s.get("emergency", False))} for s in src["suppliers"]],
        "ingredients": [{"id": i["id"], "name": i["name"], "unit": i["unit"], "unitCost": i["unitCost"],
                         "supplier": i["supplier"], "storage": i["storage"], "shelfDays": i["shelfDays"],
                         "cartonUnits": i["cartonUnits"], "cartonHeavy": i["cartonHeavy"]} for i in src["ingredients"]],
        "ordering": {
            "emergencyGameMinutes": o["emergencyDeliveryGameMinutes"], "emergencySurcharge": o["emergencySurcharge"],
            "basketReputationPerItem": o["eveningBasketReputationPerItem"], "basketMaxPerDay": o["eveningBasketMaxPerDay"],
            # Premier jour sans historique (choix du studio): portions supposées par recette de l'ardoise.
            "baselineServingsPerRecipe": 14, "historyDays": 3, "margin": 1.2,
        },
    }


def economie() -> dict:
    eco = lire("reglages-economie.json")
    eqp = lire("postes-equipements.json")
    cat = lire("catalogue.json")
    items = {x["id"]: x for x in cat["items"]}
    renov = [{"id": f"renover_{f['id']}", "name": f"Rénover: {items[f['id']]['name']} ({f['count']})",
              "price": f["count"] * items[f["id"]]["renovationPrice"], "tier": "t0", "effects": [f"renovate:{f['id']}"]}
             for f in cat["startFurniture"] if f["worn"] and items[f["id"]].get("renovationPrice")]
    a = eco["ambiance"]
    return {
        "startCash": eco["startCash"], "rentPerMonth": eco["rentPerMonth"], "rentDaysPerMonth": eco["rentDaysPerMonth"],
        "chargesPerOpenDay": eco["chargesPerOpenDay"], "reserveDaysOfCharges": eco["reserveDaysOfCharges"],
        "priceSteps": {"min": -3, "max": 5, "step": eco["priceAdjust"]["step"]},
        "bigPurchase": {"minimum": eco["bigPurchaseThreshold"]["minimum"], "shareOfDailyRevenue": eco["bigPurchaseThreshold"]["shareOfDailyRevenue"]},
        "reputation": {"startCups": eco["reputation"]["startCups"], "stepPoints": eco["reputation"]["stepPoints"],
                       "pivot": eco["reputation"]["pivotSatisfaction"], "divisor": eco["reputation"]["divisor"],
                       "catchUp": [eco["reputation"]["catchUp"]["afterOpenDays"], eco["reputation"]["catchUp"]["perDay"], eco["reputation"]["catchUp"]["max"]],
                       "maxCups": 5.0},
        "offer": {"renown": eco["offer"]["renown"], "fallbackEvent": eco["offer"]["fallback"]},
        "challenge": {"event": eco["challenge"]["id"], "day": eco["challenge"]["day"], "affluence": eco["challenge"]["affluence"],
                      "renown": eco["challenge"]["renown"], "groups": eco["challenge"]["goals"]["groups"],
                      "cups": eco["challenge"]["goals"]["cups"], "trestleSeats": 4},
        "ambiance": {
            "surfaces": a["publicSurfaceM2"], "decorMax": a["decorMax"], "charmPerM2ForMax": a["charmPerM2ForMax"],
            "coherenceMax": a["coherenceMax"], "comfortFactor": a["comfortFactor"], "comfortMax": a["comfortMax"],
            "lightPerM2": a["lightPerM2"], "lightMax": a["lightMax"], "musicMatching": a["music"]["matching"],
            "musicOther": a["music"]["other"], "radioStyle": "campagne", "cleanliness": a["cleanlinessAssumedInSim"],
            "wornCharmFactor": a["wornCharmFactor"], "max": 95, "wheel": ["campagne", "jardin", "nordique", "retro", "bistrot", "atelier"],
            "extensionDecor": {"village_fond": [["cheminee", 4, "campagne", 1]], "village_terrasse": [["store", 2, "neutre", 0]]},
            "coatMultiplier": {"paint": 3, "wallpaper": 3},
        },
        "brocante": {"pieces": eco["brocante"]["piecesPerMonday"], "discount": eco["brocante"]["discount"], "charmFactor": eco["brocante"]["charmFactor"]},
        "flowerMarket": {"day": eco["flowerMarket"]["day"], "discount": eco["flowerMarket"]["plantDiscount"], "untilDay": eco["flowerMarket"]["untilDay"]},
        "demoEndDay": eco["demoEndDay"], "demoMaxDay": eco["demoMaxDay"],
        "tiers": eqp["tiers"],
        "stationsAtStart": {k: v for k, v in eqp["stationsAtStart"].items() if k not in ("sink", "registers", "dishes")},
        "dishesAtStart": eqp["stationsAtStart"]["dishes"],
        "purchases": [{"id": p["id"], "name": p["name"], "price": p["price"], "tier": p["tier"], "effects": p["effect"].split(";")} for p in eqp["purchases"]]
        + renov,
        "extensions": [{"id": e["id"], "name": e["name"], "price": e["price"], "tier": e["tier"], "nights": e["nightsOfWork"],
                        "seats": [e["seats"]["counter"], e["seats"]["table"], e["seats"]["comfort"], e["seats"]["terrace"]], "text": e["text"]} for e in eqp["extensions"]],
        "catalogue": [{"id": x["id"], "name": x["name"], "category": x["category"], "style": x["style"], "price": x["price"], "charm": x["charm"],
                       "tier": x["unlock"].get("tier"), "source": x["unlock"].get("source"), "ref": x["unlock"].get("ref"),
                       "comfort": x.get("seats", {}).get("type") == "comfort"} for x in cat["items"]],
        "startDecor": [{"id": f["id"], "count": f["count"], "worn": f["worn"]} for f in cat["startFurniture"]],
    }


def journees() -> dict:
    src = lire("journees.json")
    h = src["hours"]
    return {
        "open": minutes(h["open"]), "close": minutes(h["close"]), "secondsPerGameMinute": h["secondsPerGameMinute"],
        "peacefulSecondsPerGameMinute": h["peacefulPaceSecondsPerGameMinute"],
        "weekdays": JOURS_SEMAINE,
        "days": [{"day": d["day"], "weekday": d["weekday"], "open": d["open"], "title": d["title"], "new": d["new"],
                  "regulars": d["regulars"], "event": d["event"], "dayEvent": d.get("dayEvent"), "projects": d["projects"],
                  "simone": d.get("simone", []), "endOfDemo": bool(d.get("endOfDemo", False))} for d in src["days"]],
        "projects": src["projects"],
    }


def habitues() -> dict:
    src = lire("habitues.json")
    tailles = {"farida_noe": 2, "odile_jules": 2}
    out = []
    for r in src["regulars"]:
        first = r["firstDay"]
        out.append({
            "id": r["id"], "name": r["name"], "profile": r["profile"], "size": tailles.get(r["id"], 1),
            "favorite": r["favorite"], "fallbackFavorite": r.get("fallbackFavorite", []),
            "schedule": [[s["days"], [minutes(t) for t in s["times"]]] for s in r["schedule"]],
            "firstDay": first if isinstance(first, int) else 0,
            "unlockedBy": None if isinstance(first, int) else "jules_a_perdu_sa_mamie",
            "lines": {k: v for k, v in r["lines"].items() if k != "tips"}, "tips": r["lines"].get("tips", {}),
            "story": [{"level": s["level"], "id": s["id"], "scene": s["scene"], "reward": s.get("reward", {}),
                       "minCups": 2.5 if s.get("condition") == "réputation de 2,5 tasses" else 0} for s in r["story"] if not s.get("outOfDemo")],
            "model": f"habitue-{r['id']}",
        })
    return {"bondLevels": src["bondLevels"], "bondGains": src["bondGains"], "regulars": out}


# Mise en scène chiffrée des événements (choix du studio, d'après les textes `goal` du game designer):
# qui entre, ce qu'il commande, les fenêtres de temps et les aides.
SCENES = {
    "le_car_de_8h12": {"lines": {"clue": ["", "Le chauffeur du car attend devant la vitrine: tu peux lui demander trente secondes de plus."], "choice": ["", "Demander au chauffeur"], "driver": ["Le chauffeur du car", "Bon, trente secondes. Pas une de plus !"]}, "profile": "presses", "groups": [1], "orders": [["creme", "croissant"]], "extension": 30,
                       "helpAfter": 135, "itemDelayDays": 4, "seat": "takeaway"},
    "la_vieille_dame_tousse": {"lines": {"help": ["Gaby", "Montre-moi ça. Un joint neuf, et elle repart comme en 87."], "hold": ["", "Tu tiens le levier: il faut que l'autre change le joint en même temps."]}, "pairWindow": 3, "reach": 1.8, "formidableBefore": 540, "station": "machine-espresso"},
    "les_godillots": {"lines": {"list": ["", "Colette te lit la liste: {list}. Dicte-la à l'autre !"]}, "profile": "promeneurs", "groups": [9], "seat": "outside", "helpAfter": 420,
                      "families": [["cold_drink", 4, "tea"], ["milk_coffee", 3, "black_coffee"], ["chocolate", 2, "tea"], ["pastry_bread", 9, None]]},
    "le_carnet_vert": {"writeGameMinutes": 20, "profile": "flaneurs", "groups": [1], "orders": [["cappuccino"]], "fallbackOrders": [["creme"]],
                       "minCups": 2.0, "formidableCriteria": 4, "itemDelayDays": 1,
                       "advice": ["Une part de tarte de l'ardoise", "La tartine de la maison", "Rien, le café se suffit"],
                       "clueCounter": "Elle demande: « Que me conseillez-vous avec ? »",
                       "clueBar": "Elle ouvre un carnet vert à élastique et note en regardant la machine."},
    "jules_a_perdu_sa_mamie": {"lines": {"help": ["Lucas", "Elle cherche un petit lapin en ciré jaune !"], "wrong": ["Une dame", "Bonjour ! Non, je ne cherche personne, merci."], "found": ["Mamie Odile", "Mon lapin !"], "window": ["", "Trois dames passent sur la place: fais signe à la bonne depuis la vitrine."]}, "profile": "familles", "groups": [1], "orders": [["chocolat"]], "formidableWithin": 90,
                               "clues": ["Le parapluie de Mamie est lilas, comme les fleurs de la maîtresse.", "Elle a un cabas à carreaux pour le pain."],
                               "passersby": ["Une dame au parapluie lilas", "Une dame au parapluie vert et au cabas à carreaux", "Une dame au parapluie lilas et au cabas à carreaux"],
                               "correct": 2, "returnGroup": 2},
    "l_inspection": {"lines": {"advice": ["Madame Ferrand", "Un conseil: {text}."]}, "window": [540, 960], "duration": 360, "dirtyLimit": 30, "profile": "voisins"},
    "le_cafe_d_honneur": {"lines": {"surprise": ["Paul", "La surprise de la maison ! Merci, vous deux."], "ask": ["", "Les mariés attendent la surprise de la maison: choisissez-la à deux."]}, "profile": "familles", "groups": [7, 7], "seat": "outside", "formidableWithin": 300},
    "le_coeur_de_lait": {"lines": {"perfect": ["Noé", "Oh, c'est trop beau !"], "good": ["Noé", "C'est pas un chat, mais c'est joli."]}, "from": 600, "to": 720, "goal": 20, "milkFamilies": ["milk_coffee"]},
    "l_averse_de_trois_heures": {"durationGameMinutes": 60, "standLimit": 20, "lastDay": 13},
    "la_fete_du_tilleul": {},
    "le_marche_aux_fleurs": {},
}


def evenements() -> dict:
    src = lire("evenements.json")
    out = []
    for e in src["events"]:
        t = e["trigger"]
        g = e.get("goal", {})
        r = e.get("rewards", {})
        time = t.get("time")
        tmin = None
        if isinstance(time, str) and ":" in time and time[0].isdigit():
            tmin = minutes(time.split(" ")[0])
        out.append({
            "id": e["id"], "name": e["name"], "kind": e["kind"],
            "day": t.get("day"), "fromDay": t.get("fromDay"), "fallbackDay": t.get("fallbackDay"),
            "time": tmin, "announce": e.get("announce"), "cast": [{"id": c["id"], "name": c["name"]} for c in e.get("cast", [])],
            "scene": e.get("scene", []), "goal": g.get("text"), "timeLimit": g.get("timeLimitRealSeconds"),
            "helpAfter": g.get("helpAfterRealSeconds"), "help": g.get("help"), "criteria": g.get("criteria", []),
            # Les notes du game designer entre parenthèses, en fin de texte, ne se lisent pas en jeu.
            "outcomes": {k: re.sub(r"\s*\([^()]*\)$", "", v["text"]) for k, v in e.get("outcomes", {}).items()},
            "rewards": {k: {"euros": r[k].get("euros", 0), "points": r[k].get("reputationPoints", 0), "renown": r[k].get("renown", 0),
                            "affluence": [r[k]["affluenceBonus"]["factor"], r[k]["affluenceBonus"]["days"]] if "affluenceBonus" in r[k] else None}
                        for k in ("reussi", "formidable") if k in r},
            "items": r.get("items", []), "guestbook": e.get("guestbook"),
            "effects": e.get("effects"),
            "staging": SCENES[e["id"]],
        })
    return {"events": out}


def textes() -> dict:
    src = lire("textes.json")
    gb = src["guestbook"]
    return {"dialogues": src["dialogues"], "guestbook": {"positive": gb["positive"], "negative": gb["negative"], "regulars": gb["regulars"], "requires": gb.get("requires", {})},
            "ui": {"evening": src["ui"]["evening"], "demoEnd": src["ui"]["demoEnd"], "events": src["ui"]["events"], "sign": src["ui"]["sign"]}}


def main() -> int:
    cc = charger_sim()
    ecrire("profils.json", profils(cc))
    ecrire("regles.json", regles(cc))
    ecrire("carte.json", carte())
    ecrire("fournisseurs.json", fournisseurs())
    ecrire("economie.json", economie())
    ecrire("journees.json", journees())
    ecrire("habitues.json", habitues())
    ecrire("evenements.json", evenements())
    ecrire("textes.json", textes())
    return 0


if __name__ == "__main__":
    sys.exit(main())
