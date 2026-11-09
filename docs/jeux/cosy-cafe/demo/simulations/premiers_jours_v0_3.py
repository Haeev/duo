#!/usr/bin/env python3
"""Deux Tabliers: l'économie des premiers jours (`economie-premiers-jours-v0-3.md`).

Question posée par la séance du 2026-11-09: un mardi au calme, tout le monde servi, et le bilan
finit dans le rouge. Le script compare, jour après jour sur deux semaines, la version 0.2.4 et la
proposition du document, pour les deux départs (café équipé de la v0.2, cellule vide de la v0.3).

Ce qu'il reprend du jeu, en lisant les données de `games/deux-tabliers/donnees/clientele/`:
- les arrivées: groupes calmes de la prise en main (`warmup`), puis passants par profil
  (`groupsPerDay` x facteur du jour x affluence de la prise en main x attrait);
- la commande d'un groupe (`groupOrder`: une boisson par personne, de quoi manger selon `eatsShare`,
  familles tirées 3 contre 1), seulement parmi les recettes encore en stock;
- la commande habituelle (`suggestedOrder`: historique de 3 jours ou 14 portions par recette, jusqu'au
  prochain passage, conservation, marge 1,2 ou 1,1 pour le frais, cartons entiers);
- lots datés, périmé jeté le matin (« Perdu »), panier du soir du boulanger, port sous le franco;
- loyer chaque jour, charges chaque jour ouvert; le bilan actuel (recette - marchandise reçue - port
  - loyer - charges) et le bilan proposé (marge - invendus - port - loyer - charges).

Ce qu'il simplifie (hypothèses écrites dans le document): ardoise fixe de huit lignes (celle de la
séance), aucun achat d'équipement, pas de recommande en cours de séjour, pas d'événement, météo
neutre, attrait 0,75 la première semaine et 0,9 la seconde, pourboires à leur espérance.

Consigne du client (2026-11-04): simulation courte. 200 parties par cas, 5 s en tout.
Lancement depuis la racine du dépôt:
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/premiers_jours_v0_3.py
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/premiers_jours_v0_3.py servis=0.85
"""
from __future__ import annotations

import json
import math
import random
import statistics
import sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[5]
DONNEES = RACINE / "games" / "deux-tabliers" / "donnees" / "clientele"
PARTIES = 200
JOURS = 15

ARDOISE = ["espresso", "allonge", "creme", "the_noir", "chocolat", "pain_chocolat", "tartine", "tarte_fruits"]
CALME_PROFILS_EGAUX = True
ATTRAIT = {1: 0.75, 2: 0.9}  # semaine 1, semaine 2 (une demi-tasse à une tasse de plus)


def lire(nom: str) -> dict:
    return json.loads((DONNEES / nom).read_text(encoding="utf-8"))


CARTE = {r["id"]: r for r in lire("carte.json")["recipes"]}
PROFILS = {p["id"]: p for p in (lambda d: d["profiles"] if "profiles" in d else d)(lire("profils.json"))}
REGLES = lire("regles.json")
FOURN = lire("fournisseurs.json")
ECO = lire("economie.json")
JOURNEES = lire("journees.json")
INGR = {i["id"]: i for i in FOURN["ingredients"]}
SUPP = {s["id"]: s for s in FOURN["suppliers"]}
ORD = FOURN["ordering"]
WARMUP = {w["day"]: w for w in REGLES["warmup"]}

LOYER = round(ECO["rentPerMonth"] / ECO["rentDaysPerMonth"], 2)
CHARGES = round(sum(c["perOpenDay"] for c in ECO["charges"]), 2)


def jour_semaine(d: int) -> str:
    return JOURNEES["weekdays"][(d - 1) % 7]


def ouvert(d: int) -> bool:
    for x in JOURNEES["days"]:
        if x["day"] == d:
            return x["open"]
    return jour_semaine(d) != "mon"


def passe(sup: str, d: int) -> bool:
    return ouvert(d) and jour_semaine(d) in SUPP[sup]["days"]


def prochain_passage(sup: str, d: int) -> int:
    for k in range(d + 1, d + 15):
        if passe(sup, k):
            return k
    return d + 7


# ---------------------------------------------------------------------------------------------
# Variantes

ACTUELLE = {
    "nom": "0.2.4",
    "loyer_offert_jusqu_au": 0,
    "charges_prise_en_main": {},
    "annonce": {d: w["announced"] for d, w in WARMUP.items()},
    "historique_normalise": False,
    "frais_seuil_carton": 0.0,  # 0: un carton dès qu'il manque une unité; sinon, seulement les jours de prise en main
    "cartons": {},
    "port_offert_le_jour": 0,
}

PROPOSEE = {
    "nom": "proposition",
    "loyer_offert_jusqu_au": 7,
    "charges_prise_en_main": {2: 0.5, 3: 0.75},
    "annonce": {d: w["announced"] for d, w in WARMUP.items()},  # inchangé (0,3; 0,5; 0,7; 0,85)
    "historique_normalise": True,
    "frais_seuil_carton": 0.5,
    "cartons": {"croissant_boulanger": 5, "pain_chocolat_boulanger": 5, "tarte_boulanger": 6},
    "port_offert_le_jour": 2,
}


def unites(v: dict, ing: str) -> int:
    return v["cartons"].get(ing, INGR[ing]["cartonUnits"])


def annonce(v: dict, d: int) -> float:
    return v["annonce"].get(d, 1.0)


# ---------------------------------------------------------------------------------------------
# Départs

DEPARTS = {
    "v0.2 (café équipé)": {"caisse": float(ECO["startCash"]), "stock": [(i, n * INGR[i]["cartonUnits"]) for i, n in ECO["startStock"]]},
    # Panier « Le café de Simone » de `depart-cellule-vide-v0-3.md` (1 292 €), cadeau de Simone.
    "v0.3 (cellule vide)": {"caisse": 1800.0 - 1292.0, "stock": [("grains_maison", 1000), ("lait_entier", 1000)]},
}


# ---------------------------------------------------------------------------------------------
# Service


def familles_dispo(stock: dict) -> dict:
    out: dict = {}
    for rid in ARDOISE:
        r = CARTE[rid]
        if all(stock.get(i, 0) + 1e-9 >= q for i, q in r["ingredients"]):
            out.setdefault(r["family"], []).append(rid)
    return out


def choisir_famille(rng: random.Random, p: dict, dispo: dict, parmi: list) -> str | None:
    w = REGLES["cravingWeights"]
    choix = []
    for f in parmi:
        if not dispo.get(f):
            continue
        if f == p["mainCraving"]:
            choix.append((f, w["main"]))
        elif f in p["secondaryCravings"]:
            choix.append((f, w["secondary"]))
    if not choix:
        return None
    u = rng.random() * sum(x for _, x in choix)
    for f, x in choix:
        u -= x
        if u <= 0:
            return f
    return choix[-1][0]


def commande_groupe(rng: random.Random, p: dict, taille: int, stock: dict) -> list:
    articles = []
    for _ in range(taille):
        dispo = familles_dispo(stock)
        f = choisir_famille(rng, p, dispo, REGLES["drinks"])
        if f is None:
            autres = [x for x in REGLES["drinks"] if dispo.get(x)]
            f = rng.choice(autres) if autres else None
        if f is not None:
            articles.append(rng.choice(dispo[f]))
            consommer(stock, articles[-1])
        dispo = familles_dispo(stock)
        if rng.random() < p["eatsShare"]:
            g = choisir_famille(rng, p, dispo, REGLES["foods"])
            if g is not None:
                articles.append(rng.choice(dispo[g]))
                consommer(stock, articles[-1])
    return articles


def consommer(stock: dict, rid: str) -> None:
    for i, q in CARTE[rid]["ingredients"]:
        stock[i] = stock.get(i, 0) - q


def taille_groupe(rng: random.Random, p: dict) -> int:
    u, acc = rng.random(), 0.0
    for t, part in p["groupSizes"]:
        acc += part
        if u < acc:
            return t
    return p["groupSizes"][-1][0]


def poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    l, k, prod = math.exp(-lam), 0, rng.random()
    while prod > l:
        k += 1
        prod *= rng.random()
    return k


def arrivees(rng: random.Random, d: int) -> list:
    """Groupes du jour: (profil, taille). Prise en main: calmes d'abord, puis l'affluence réduite."""
    w = WARMUP.get(d)
    out = []
    ouverture, fermeture = JOURNEES["open"] / 60, JOURNEES["close"] / 60
    calme_fin = ouverture
    if w is not None and w["calmGroups"] > 0:
        calme_fin = w["calmUntil"] / 60
        for _ in range(w["calmGroups"]):
            p = PROFILS[rng.choice(w["calmProfiles"])]
            out.append((p["id"], min(w["maxGroupSize"], taille_groupe(rng, p))))
    rampe = w["affluence"] if w is not None else 1.0
    attrait = ATTRAIT[1 if d <= 7 else 2]
    wdi = (d - 1) % 7
    for p in PROFILS.values():
        if p["groupsPerDay"] <= 0:
            continue
        poids = dict((h, x) for h, x in p["hourWeights"])
        heures = [h for h in range(int(ouverture), int(fermeture))]
        total = sum(poids.get(h, 0) for h in heures)
        if total <= 0:
            continue
        part = sum(poids.get(h, 0) for h in heures if h >= calme_fin) / total
        lam = p["groupsPerDay"] * p["dayFactors"][wdi - 1] * rampe * attrait * part
        for _ in range(poisson(rng, lam)):
            out.append((p["id"], taille_groupe(rng, p)))
    rng.shuffle(out)
    return out


# ---------------------------------------------------------------------------------------------
# Stock


def ajouter_lot(lots: dict, ing: str, qte: float, dernier: int) -> None:
    if qte <= 0:
        return
    lots.setdefault(ing, []).append([qte, dernier])
    lots[ing].sort(key=lambda l: l[1])


def total(lots: dict, ing: str) -> float:
    return sum(l[0] for l in lots.get(ing, []))


def prendre(lots: dict, ing: str, qte: float) -> None:
    reste = qte
    for l in lots.get(ing, []):
        k = min(l[0], reste)
        l[0] -= k
        reste -= k
        if reste <= 1e-9:
            break
    lots[ing] = [l for l in lots.get(ing, []) if l[0] > 1e-9]


def bon_le(lots: dict, ing: str, d: int) -> float:
    return sum(l[0] for l in lots.get(ing, []) if l[1] >= d)


def dernier_jour(ing: str, d: int) -> int:
    return d + max(1, INGR[ing]["shelfDays"]) - 1


def commande_habituelle(v: dict, lots: dict, usage: list, d: int) -> dict:
    besoin_base: dict = {}
    for rid in ARDOISE:
        for i, q in CARTE[rid]["ingredients"]:
            besoin_base[i] = besoin_base.get(i, 0) + q * ORD["baselineServingsPerRecipe"]
    out = {}
    for ing, info in INGR.items():
        if not passe(info["supplier"], d):
            continue
        jours = usage[-ORD["historyDays"]:]
        if v["historique_normalise"]:
            use = sum(u.get(ing, 0) / max(0.05, k) for k, u in jours) / len(jours) if jours else 0
        else:
            use = sum(u.get(ing, 0) for _, u in jours) / len(jours) if jours else 0
        if use == 0:
            use = besoin_base.get(ing, 0)
        if use <= 0:
            continue
        nxt = prochain_passage(info["supplier"], d)
        jusqu = min(nxt - 1, dernier_jour(ing, d))
        besoin, dernier = 0.0, d
        for k in range(d, jusqu + 1):
            if ouvert(k):
                besoin += use * annonce(v, k)
                dernier = k
        frais = info["shelfDays"] <= 2
        besoin *= ORD["freshMargin"] if frais else ORD["margin"]
        voulu = besoin - bon_le(lots, ing, dernier)
        if voulu <= 1e-9:
            continue
        u = unites(v, ing)
        n = voulu / u
        if frais and v["frais_seuil_carton"] > 0 and annonce(v, d) < 1:
            n = math.floor(n) + (1 if n - math.floor(n) >= v["frais_seuil_carton"] else 0)
            # Une ligne de l'ardoise sans rien de bon en réserve reçoit au moins un carton.
            if n == 0 and bon_le(lots, ing, d) <= 1e-9:
                n = 1
        else:
            n = math.ceil(n)
        if n > 0:
            out[ing] = n
    return out


# ---------------------------------------------------------------------------------------------
# Une partie


def partie(v: dict, depart: dict, servis: float, graine: int) -> list:
    rng = random.Random(graine)
    lots: dict = {}
    for ing, q in depart["stock"]:
        ajouter_lot(lots, ing, q, dernier_jour(ing, 2) if INGR[ing]["shelfDays"] > 2 else 2)
    caisse = depart["caisse"]
    usage: list = []
    jours = []
    for d in range(1, JOURS + 1):
        loyer = 0.0 if d <= v["loyer_offert_jusqu_au"] else LOYER
        caisse -= loyer
        perdu = 0.0
        for ing in list(lots):
            partis = [l for l in lots[ing] if l[1] < d]
            perdu += sum(l[0] for l in partis) * INGR[ing]["unitCost"]
            lots[ing] = [l for l in lots[ing] if l[1] >= d]
        r = {"jour": d, "ouvert": ouvert(d), "loyer": loyer, "perdu": perdu, "recette": 0.0, "pourboires": 0.0,
             "matieres": 0.0, "marchandise": 0.0, "port": 0.0, "charges": 0.0, "panier": 0.0, "groupes": 0, "servis": 0}
        if ouvert(d):
            cmd = commande_habituelle(v, lots, usage, d)
            par_fourn: dict = {}
            for ing, n in cmd.items():
                valeur = n * unites(v, ing) * INGR[ing]["unitCost"]
                par_fourn[INGR[ing]["supplier"]] = par_fourn.get(INGR[ing]["supplier"], 0) + valeur
                ajouter_lot(lots, ing, n * unites(v, ing), dernier_jour(ing, d))
            for sup, g in par_fourn.items():
                r["marchandise"] += g
                if g < SUPP[sup]["franco"] and d != v["port_offert_le_jour"]:
                    r["port"] += SUPP[sup]["shipping"]
            caisse -= r["marchandise"] + r["port"]
            stock = {ing: total(lots, ing) for ing in INGR}
            utilise: dict = {}
            for pid, taille in arrivees(rng, d):
                r["groupes"] += 1
                if rng.random() > servis:
                    continue
                avant = dict(stock)
                arts = commande_groupe(rng, PROFILS[pid], taille, stock)
                if not arts:
                    stock = avant
                    continue
                r["servis"] += 1
                ticket = sum(CARTE[a]["basePrice"] for a in arts)
                r["recette"] += ticket
                r["matieres"] += sum(CARTE[a]["costMaterials"] for a in arts)
                t = REGLES["tips"]
                r["pourboires"] += ticket * t["rate"] * t["probability"] * PROFILS[pid]["tipFactor"]
                for a in arts:
                    for i, q in CARTE[a]["ingredients"]:
                        utilise[i] = utilise.get(i, 0) + q
            for i, q in utilise.items():
                prendre(lots, i, q)
            usage.append((annonce(v, d) if v["historique_normalise"] else 1.0, utilise))
            for ing, info in INGR.items():
                if info["supplier"] == ORD["basketSupplier"] and info["unit"] == "piece":
                    fin = [l for l in lots.get(ing, []) if l[1] <= d]
                    r["panier"] += sum(l[0] for l in fin) * info["unitCost"]
                    lots[ing] = [l for l in lots.get(ing, []) if l[1] > d]
            k = v["charges_prise_en_main"].get(d, 1.0)
            r["charges"] = round(CHARGES * k, 2)
            caisse += r["recette"] + r["pourboires"] - r["charges"]
        r["caisse"] = caisse
        r["reserve"] = sum(total(lots, i) * INGR[i]["unitCost"] for i in INGR)
        r["bilan_actuel"] = r["recette"] + r["pourboires"] - r["marchandise"] - r["port"] - r["loyer"] - r["charges"]
        r["marge"] = r["recette"] + r["pourboires"] - r["matieres"]
        r["bilan_propose"] = r["marge"] - r["perdu"] - r["panier"] - r["port"] - r["loyer"] - r["charges"]
        jours.append(r)
    return jours


def med(xs: list) -> float:
    return statistics.median(xs)


def p10(xs: list) -> float:
    return sorted(xs)[len(xs) // 10]


def main() -> None:
    servis = 1.0
    for a in sys.argv[1:]:
        if a.startswith("servis="):
            servis = float(a.split("=")[1])
    print(f"Loyer {LOYER:.2f} €/jour, charges {CHARGES:.2f} €/jour ouvert, part servie {servis:.0%}, {PARTIES} parties par cas")
    for nom_dep, dep in DEPARTS.items():
        for v in (ACTUELLE, PROPOSEE):
            runs = [partie(v, dep, servis, 1000 + g) for g in range(PARTIES)]
            print(f"\n## {nom_dep}, {v['nom']}")
            print("jour | groupes | recette | marge | marchandise+port | perdu+panier | loyer | charges | bilan actuel | bilan proposé (p10) | réserve | caisse")
            for d in range(JOURS):
                col = lambda k: med([r[d][k] for r in runs])
                if not runs[0][d]["ouvert"]:
                    print(f"{d + 1:>2} fermé | loyer {col('loyer'):.2f} | perdu {col('perdu'):.2f} | caisse {col('caisse'):.0f}")
                    continue
                print(f"{d + 1:>2} | {col('servis'):.0f} | {col('recette'):.2f} | {col('marge'):.2f} | {col('marchandise') + col('port'):.2f} | "
                      f"{col('perdu') + col('panier'):.2f} | {col('loyer'):.2f} | {col('charges'):.2f} | {col('bilan_actuel'):.2f} | "
                      f"{col('bilan_propose'):.2f} ({p10([r[d]['bilan_propose'] for r in runs]):.2f}) | {col('reserve'):.0f} | {col('caisse'):.0f}")
            for (a, b, lib) in ((2, 5, "jours 2 à 5"), (1, 15, "jours 1 à 15")):
                somme = [sum(r[d]["bilan_propose"] for d in range(a - 1, b)) for r in runs]
                somme_act = [sum(r[d]["bilan_actuel"] for d in range(a - 1, b)) for r in runs]
                pertes = [sum(r[d]["perdu"] + r[d]["panier"] for d in range(a - 1, b)) for r in runs]
                print(f"{lib}: somme des bilans actuels {med(somme_act):.2f}, proposés {med(somme):.2f} (p10 {p10(somme):.2f}), invendus {med(pertes):.2f}")
            print(f"caisse au jour 15: {med([r[-1]['caisse'] for r in runs]):.0f} € (p10 {p10([r[-1]['caisse'] for r in runs]):.0f})")


if __name__ == "__main__":
    main()
