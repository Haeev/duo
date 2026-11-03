"""Économie de La Petite Ligne 0.12.0: courbe de la bourse d'un duo, jours 1 à 64.

Lancer: python3 -I docs/jeux/jeu-1/simulations/v0_12_economie.py [--graines N]
Bibliothèque standard seule (moins de 10 s pour 1 000 graines).

Modèle volontairement simple, calé sur les mesures publiées des tours 9 et 10
(commande générée d'environ 1 150 aubrins par samedi pour un duo médian, annonces
d'environ 130 par semaine dès le jour 16, ventes à Odette limitées par la production).
Les valeurs des systèmes nouveaux sont celles des tables de v0-12-conception.md
(section 2 à 4); la partie 0 relit ces tables dans le document et échoue si elles divergent.
Pêche: hypothèse en attendant peche-0-12-conception.md (valeur espérée par jour, sans plus).
"""

from __future__ import annotations

import json
import os
import random
import re
import statistics
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, "..", "..", "..", ".."))
DONNEES = os.path.join(RACINE, "games", "la-petite-ligne", "donnees")
DOC = os.path.join(ICI, "..", "v0-12-conception.md")

# Valeurs des tables du document (contrôlées par la partie 0).
ODETTE = {"buyRate": 0.8, "floor": 0.6, "slope": 0.4, "decay": 0.5, "ardoise": 1.5, "ardoiseMax": 10}
SATURATION = {"radish": 20, "carrot": 15, "lettuce": 6, "egg": 12, "goat_milk": 8, "fresh_cheese": 6}
MARCHE = {"buyers": 6, "unitsMin": 1, "unitsMax": 3, "levels": {"doux": (1.0, 1.0), "juste": (1.25, 0.9), "fort": (1.5, 0.6)}, "rainFactor": 0.7}
PLIS = {"weights": (0.5, 0.35, 0.15), "letter": 6, "parcel": 12, "heavy": 30, "heavyChance": 0.2, "earlyBonus": 3}
POULES = {"drift": -6, "fed": 6, "straw": 4, "pet": 3, "floor": 30, "ceiling": 100, "everyOtherBelow": 40, "fineFrom": 80, "broodFrom": 70, "broodNights": 7, "eggHatch": 0.75, "growNights": 10, "cockerel": 0.25, "grainPrice": 25, "grainRations": 30}
CHEVRE = {"drift": -6, "freshGraze": 6, "water": 4, "brush": 3, "floor": 30, "milkFrom": 40, "twoMilkFrom": 80, "milkPrice": 9, "cheesePrice": 24, "milkPerCheese": 2}
ACHATS = {
    "chevrerie": 600, "chevrette": 250, "chevre_2": 450, "poulailler_agrandi": 800, "mangeoire": 120,
    "halle": 2400, "balance": 180, "fanions_maison": 60, "geraniums": 35, "peinture_poulailler": 80,
    "plaque_chevre": 40, "volets": 150, "banc_jardin": 120, "nichoir_peint": 45, "lanterne_porche": 90,
    "ruche_1": 150, "ruche_2": 150, "ruche_3": 150, "essaims": 360, "enfumoir": 60,
}
# Achats déjà en jeu (tours 9 et 10): catalogue lu dans objets.json, chantiers lus dans chantiers.json.
ANCIENS_FIXES = {"grand_coffre": 250, "cellier": 450, "chambre": 1200, "rideaux_x4": 120}

PROFILS = {
    # completion: part de la commande remplie; stock: part des envies du marché qu'on a sur l'étal;
    # plis: part des plis livrés; soin: probabilités de paille et de caresse par jour; peche: aubrins par jour.
    "tranquille": {"completion": 0.75, "stock": 0.5, "plis": 0.4, "straw": 0.4, "pet": 0.5, "level": "doux", "peche": 15, "odette": 90, "annonces": 0.65},
    "médian": {"completion": 0.88, "stock": 0.7, "plis": 0.6, "straw": 0.7, "pet": 1.0, "level": "juste", "peche": 25, "odette": 150, "annonces": 0.8},
    "assidu": {"completion": 0.97, "stock": 0.85, "plis": 0.85, "straw": 0.95, "pet": 2.0, "level": "juste", "peche": 40, "odette": 220, "annonces": 0.9},
}

SAMEDIS = [1 + 7 * k for k in range(10)]  # jour 1 = samedi


def charger_json(nom: str) -> dict:
    with open(os.path.join(DONNEES, nom), encoding="utf-8") as f:
        return json.load(f)


def prix_odette(base: float, vendus: float, saturation: float, facteur_saison: float = 1.0) -> float:
    offre = max(ODETTE["floor"], 1 - ODETTE["slope"] * vendus / saturation)
    return max(1, round(base * ODETTE["buyRate"] * facteur_saison * offre))


def partie0_controle() -> list[str]:
    """Relit dans le document quelques valeurs des tables et les compare au script."""
    ecarts = []
    if not os.path.exists(DOC):
        return ["document absent"]
    texte = open(DOC, encoding="utf-8").read()
    attendus = {
        r"\| Plancher de l'offre \| ([0-9,]+) \|": ODETTE["floor"],
        r"\| Pente de l'offre \| ([0-9,]+) \|": ODETTE["slope"],
        r"\| Oubli de l'offre à l'aube \| ([0-9,]+) \|": ODETTE["decay"],
        r"\| Dérive du bonheur \(poules\) \| (-?[0-9]+) \|": POULES["drift"],
        r"\| Nourries \| \+?([0-9]+) \|": POULES["fed"],
        r"\| Chevrerie \(chantier\) \| ([0-9]+) \|": ACHATS["chevrerie"],
        r"\| Chevrette \(quête\) \| ([0-9]+) \|": ACHATS["chevrette"],
        r"\| Lettre \| ([0-9]+) \|": PLIS["letter"],
        r"\| Gros colis \(à deux\) \| ([0-9]+) \|": PLIS["heavy"],
        r"\| Sac de grain \| ([0-9]+) \|": POULES["grainPrice"],
        r"\| Fromage frais \(`cook_fresh_cheese`\) \| [^|]* \| [^|]* \| [^|]* \| [0-9]+ \| ([0-9]+) \|": CHEVRE["cheesePrice"],
    }
    for motif, valeur in attendus.items():
        m = re.search(motif, texte)
        if not m:
            ecarts.append(f"introuvable: {motif}")
            continue
        lu = float(m.group(1).replace(",", "."))
        if abs(lu - float(valeur)) > 1e-9:
            ecarts.append(f"écart {motif}: document {lu}, script {valeur}")
    return ecarts


def partie_odette() -> list[tuple[int, int, int]]:
    """Recette d'une vente de n radis le même jour (base 7), et le prix du dernier."""
    sortie = []
    for n in (5, 10, 20, 30, 40):
        total, dernier = 0, 0
        for k in range(n):
            dernier = prix_odette(7, k, SATURATION["radish"])
            total += dernier
        sortie.append((n, total, dernier))
    return sortie


def un_marche(rng: random.Random, profil: dict, fanions: bool, balance: bool, pluie: bool, auvent: bool) -> float:
    prix_moyen = rng.uniform(13, 19)  # moyenne pondérée des produits d'un étal de saison (prix de base)
    mult, accepte = MARCHE["levels"][profil["level"]]
    acheteurs = MARCHE["buyers"]
    total = 0.0
    for _ in range(acheteurs):
        if pluie and not auvent and rng.random() > MARCHE["rainFactor"]:
            continue
        unites = rng.randint(MARCHE["unitsMin"], MARCHE["unitsMax"]) + (1 if fanions else 0) + (1 if balance else 0) + (1 if auvent else 0)
        for _ in range(unites):
            if rng.random() < profil["stock"] and rng.random() < accepte:
                total += round(prix_moyen * mult)
    return total


def une_partie(graine: int, profil: dict, ordre: str) -> dict:
    rng = random.Random(graine)
    chantiers = charger_json("chantiers.json")["improvements"]
    objets = {i["id"]: i for i in charger_json("objets.json")["items"]}
    catalogue = sorted((i["buyPrice"], i["id"]) for i in objets.values() if i.get("shop") == "catalogue")

    elevage = [("chevrerie", ACHATS["chevrerie"]), ("chevrette", ACHATS["chevrette"]), ("mangeoire", ACHATS["mangeoire"]),
               ("poulailler_agrandi", ACHATS["poulailler_agrandi"]), ("chevre_2", ACHATS["chevre_2"])]
    etal = [("balance", ACHATS["balance"]), ("halle", ACHATS["halle"])]
    deco = [(k, ACHATS[k]) for k in ("fanions_maison", "geraniums", "peinture_poulailler", "plaque_chevre", "volets", "banc_jardin", "nichoir_peint", "lanterne_porche")]
    ruches = [(k, ACHATS[k]) for k in ("enfumoir", "ruche_1", "essaims", "ruche_2", "ruche_3")]
    maison = [("grand_coffre", 250), ("cellier", 450), ("chambre", 1200), ("rideaux_x4", 120)] + [(c["id"], c["price"]) for c in chantiers if c["queue"] == "maisonnette"]
    bourg = [(c["id"], c["price"]) for c in chantiers if c["queue"] == "bourg"]
    cat = [(i, p) for p, i in catalogue]
    if ordre == "élevage d'abord":
        envies = elevage + etal[:1] + cat + maison + ruches + bourg + etal[1:] + deco
    else:
        envies = cat + maison + elevage + etal[:1] + bourg + etal[1:] + ruches + deco
    tout = sum(p for _, p in envies)

    bourse = 200.0
    courbe = []
    sources = {k: 0.0 for k in ("commande", "annonces", "odette", "quêtes", "marché", "plis", "œufs", "chèvre", "pêche", "conserves")}
    depenses = {"courant": 0.0, "grain": 0.0, "achats": 0.0}
    achete: set[str] = set()
    jour_achat: dict[str, int] = {}
    budget = 1.9
    poules = [60.0, 60.0, 60.0]
    poussins: list[int] = []  # nuits restantes avant de pondre
    couveuse = 0
    coq = False
    chevres: list[float] = []
    lait = 0
    nourries = True
    for jour in range(1, 65):
        semaine_jour = (jour - 1) % 7  # 0 samedi, 1 dimanche
        pluie = rng.random() < 0.3
        # Commande du samedi
        if jour == 8:
            gain = 540 * profil["completion"]
        elif jour == 15:
            gain = 990 * profil["completion"]
        elif jour in SAMEDIS and jour >= 22:
            complete = rng.random() < profil["completion"]
            gain = 380 * budget * 1.35 * (1 if complete else profil["completion"] * 0.8) * rng.uniform(0.9, 1.1)
            budget = min(3.1, budget + 0.15) if complete else max(1.52, budget - 0.1)
        else:
            gain = 0
        sources["commande"] += gain
        bourse += gain
        # Annonces (dimanche et mercredi dès le jour 16)
        if jour >= 16 and semaine_jour in (1, 4) and rng.random() < profil["annonces"]:
            g = rng.uniform(60, 110) if semaine_jour == 1 else rng.uniform(80, 140)
            sources["annonces"] += g
            bourse += g
        # Ventes ordinaires à Odette (surplus), avec l'ardoise du jour
        g = profil["odette"] / 7 * rng.uniform(0.6, 1.4) * 1.08
        sources["odette"] += g
        bourse += g
        # Quêtes: anciennes (350 en tout, étalées jours 2 à 15) et nouvelles (table 5)
        if 2 <= jour <= 15:
            sources["quêtes"] += 25
            bourse += 25
        nouvelles = {4: 50, 9: 80, 11: 40, 13: 120, 14: 60, 16: 100, 18: 50, 20: 60, 23: 70, 26: 60, 30: 40, 33: 60}
        if jour in nouvelles:
            sources["quêtes"] += nouvelles[jour]
            bourse += nouvelles[jour]
        # Marché du dimanche dès le jour 9 (étal posé au jour 6, premier dimanche)
        if semaine_jour == 1 and jour >= 9:
            g = un_marche(rng, profil, fanions=jour >= 16, balance="balance" in achete, pluie=pluie, auvent="halle" in achete)
            sources["marché"] += g
            bourse += g
        # Plis du matin dès le jour 5, sauf le dimanche
        if jour >= 5 and semaine_jour != 1:
            n = rng.choices((2, 3, 4), weights=PLIS["weights"])[0]
            for k in range(n):
                if rng.random() < profil["plis"]:
                    valeur = PLIS["heavy"] if (k == 0 and rng.random() < PLIS["heavyChance"]) else rng.choice((PLIS["letter"], PLIS["parcel"]))
                    valeur += PLIS["earlyBonus"] if rng.random() < 0.5 else 0
                    sources["plis"] += valeur
                    bourse += valeur
        # Poules: bonheur, œufs (seule la part nouvelle compte: belle qualité et poules nées ici)
        if jour >= 6:
            coq = coq or jour >= 12
            achete_grain = bourse > 40
            if achete_grain:
                cout = len(poules) * POULES["grainPrice"] / POULES["grainRations"]
                depenses["grain"] += cout
                bourse -= cout
            nourries = achete_grain
            cap = 9 if "poulailler_agrandi" in achete else 5
            for i in range(len(poules)):
                b = poules[i] + POULES["drift"] + (POULES["fed"] if nourries else 0)
                b += POULES["straw"] if rng.random() < profil["straw"] else 0
                b += POULES["pet"] * min(2, rng.random() * profil["pet"] * 2)
                poules[i] = max(POULES["floor"], min(POULES["ceiling"], b))
            for i, b in enumerate(poules):
                if i == 0 and couveuse > 0:
                    continue
                if i >= 3 or b >= POULES["fineFrom"]:
                    # œuf d'une poule née ici: 8 x 0,8; bel œuf d'une ancienne: le supplément seulement
                    g = 8 * 0.8 if i >= 3 else 8 * 0.8 * 0.5
                    if b < POULES["everyOtherBelow"] and jour % 2:
                        g = 0
                    sources["œufs"] += g
                    bourse += g
            if couveuse > 0:
                couveuse -= 1
                if couveuse == 0:
                    for _ in range(3):
                        if rng.random() < POULES["eggHatch"] and rng.random() > POULES["cockerel"]:
                            poussins.append(POULES["growNights"])
            elif coq and jour % 7 == 3 and poules[0] >= POULES["broodFrom"] and len(poules) + len(poussins) + 2 <= cap and jour <= 50:
                couveuse = POULES["broodNights"]
            poussins = [p - 1 for p in poussins]
            while poussins and poussins[0] <= 0 and len(poules) < cap:
                poussins.pop(0)
                poules.append(55.0)
            poussins = [p for p in poussins if p > 0]
        # Chèvres
        if "chevrette" in achete and "chevrerie" in achete:
            n = 2 if "chevre_2" in achete else 1
            while len(chevres) < n:
                chevres.append(55.0)
            for i in range(n):
                b = chevres[i] + CHEVRE["drift"] + CHEVRE["freshGraze"] * (rng.random() < profil["straw"]) + CHEVRE["water"] * (rng.random() < profil["straw"]) + CHEVRE["brush"] * min(2, profil["pet"])
                chevres[i] = max(CHEVRE["floor"], min(100, b))
                if rng.random() < profil["straw"] + 0.1:
                    lait += 2 if chevres[i] >= CHEVRE["twoMilkFrom"] else (1 if chevres[i] >= CHEVRE["milkFrom"] else 0)
            fromages = lait // CHEVRE["milkPerCheese"]
            lait -= fromages * CHEVRE["milkPerCheese"]
            g = fromages * CHEVRE["cheesePrice"] * (1.0 if rng.random() < 0.5 else 0.8)
            sources["chèvre"] += g
            bourse += g
        # Pêche (hypothèse), conserves (été et automne, cueillette transformée)
        g = profil["peche"] * rng.uniform(0.5, 1.5) + (150 if rng.random() < 1 / 25 else 0)
        sources["pêche"] += g
        bourse += g
        if jour >= 22 and semaine_jour == 5:
            g = 45 * profil["stock"]
            sources["conserves"] += g
            bourse += g
        # Dépenses courantes: graines, pain, chocolat, coupes, sucre et bocaux
        c = 10 + (3 if jour >= 22 else 0)
        depenses["courant"] += c
        bourse -= c
        # Achats: dans l'ordre des envies, en gardant 150 de réserve (tour 9)
        for nom, prix in envies:
            if nom in achete:
                continue
            if nom == "chevrette" and "chevrerie" not in achete:
                continue
            if nom == "chevrerie" and jour < 10:
                continue
            if nom.startswith("ruche") or nom == "essaims":
                if "enfumoir" not in achete or jour < 22:
                    continue
            if nom == "halle" and jour < 16:
                continue
            if nom in ("cellier", "chambre") and jour < 23:
                continue
            if nom in [c["id"] for c in chantiers if c["queue"] == "bourg"] and jour < 16:
                continue
            if bourse - prix >= 150:
                bourse -= prix
                depenses["achats"] += prix
                achete.add(nom)
                jour_achat[nom] = jour
                continue
            break
        courbe.append(bourse)
    part = sum(p for n, p in envies if n in achete) / tout
    return {"courbe": courbe, "sources": sources, "depenses": depenses, "part": part, "jours": jour_achat, "poules": len(poules), "tout": tout}


def centile(valeurs: list[float], q: float) -> float:
    s = sorted(valeurs)
    return s[min(len(s) - 1, int(q * len(s)))]


def main() -> int:
    graines = 1000
    if "--graines" in sys.argv:
        graines = int(sys.argv[sys.argv.index("--graines") + 1])
    print("Partie 0: contrôle croisé des tables du document")
    ecarts = partie0_controle()
    print("  aucun écart" if not ecarts else "\n".join("  " + e for e in ecarts))

    print("\nPartie 1: vendre n radis (base 7) à Odette le même jour")
    for n, total, dernier in partie_odette():
        print(f"  {n:>2} radis: {total:>3} aubrins, dernier à {dernier} (sans l'offre: {n * round(7 * 0.8)})")

    for ordre in ("élevage d'abord", "maison d'abord"):
        print(f"\nPartie 2: {ordre}, {graines} graines")
        for nom, profil in PROFILS.items():
            res = [une_partie(g, profil, ordre) for g in range(graines)]
            jalons = [1, 8, 15, 22, 29, 36, 43, 50, 57, 64]
            ligne = "  ".join(f"j{j}:{centile([r['courbe'][j - 1] for r in res], 0.5):>5.0f}" for j in jalons)
            print(f"  {nom:<10} bourse médiane  {ligne}")
            print(f"  {'':<10} P10 au plus bas: {min(centile([r['courbe'][j] for r in res], 0.1) for j in range(64)):.0f}; part de tout ce qui s'achète au jour 64: médiane {statistics.median(r['part'] for r in res):.0%}, P10 {centile([r['part'] for r in res], 0.1):.0%}")
            tot = {k: statistics.mean(r["sources"][k] for r in res) for k in res[0]["sources"]}
            somme = sum(tot.values())
            print(f"  {'':<10} revenus j1 à j64: {somme:.0f}; " + ", ".join(f"{k} {v / somme:.0%}" for k, v in tot.items()))
            dep = {k: statistics.mean(r["depenses"][k] for r in res) for k in res[0]["depenses"]}
            print(f"  {'':<10} dépenses: " + ", ".join(f"{k} {v:.0f}" for k, v in dep.items()) + f"; poules au jour 64: {statistics.median(r['poules'] for r in res):.0f}")
            for cle in ("chevrerie", "chevrette", "halle", "chambre", "poulailler_agrandi", "path_lamp", "ruche_3"):
                js = [r["jours"].get(cle, 99) for r in res]
                med = centile(js, 0.5)
                print(f"  {'':<10} {cle}: jour médian {'après 64' if med == 99 else med}, avant 64 dans {sum(j < 99 for j in js) / len(js):.0%}")
    return 1 if ecarts else 0


if __name__ == "__main__":
    sys.exit(main())
