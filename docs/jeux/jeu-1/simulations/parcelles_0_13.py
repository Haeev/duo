"""La Petite Ligne 0.13: parcelles libres (parcelles-libres-0-13.md, retour R09 du 3 novembre).

Lancer: python3 -I docs/jeux/jeu-1/simulations/parcelles_0_13.py [--croise DOC.md]
Bibliothèque standard seule, quelques secondes.

Ce que le script calcule, en lisant les données du jeu (objets.json, cultures.json, reglages.json,
cartes/halte.json) et la règle des chaînes (economie_chaines.py, chargé tel quel):
1. La terre où l'on pose: cases du pré du jardin (zone `yard` proposée) et de la friche, moins les
   cases interdites; cases que couvrent les cercles de corde de la chèvre.
2. Ce que rapporte le potager par jour et par heure de jeu active avec 6, 12, 20, 30, 40 et 60
   parcelles, en tenant compte de l'offre d'Odette (le prix baisse quand on vend beaucoup du même
   légume, `economy.grocer.supply`) et de son budget du jour (`dailyCap`). Deux débouchés: tout
   vendu brut chez Odette (cas strict), ou une partie cuisinée en soupe et en croque-au-sel.
   Le meilleur partage des parcelles entre radis, laitues et carottes est cherché exhaustivement.
3. Le prix d'une parcelle: en combien de jours la parcelle de plus se rembourse.
4. La courbe de croissance: nombre de parcelles selon le jour pour trois duos (prudent, médian,
   pressé), avec le rayon d'Odette (2 de plus chaque matin, 10 au plus) et le prix retenu.
5. La taille de l'état du potager transmis à l'invité, selon le nombre de parcelles.

--croise DOC.md: relit les tableaux du document (réglages, rendement) et signale tout écart avec
les valeurs du script (code de sortie 1).

Unités: une heure de jeu = 60 minutes de l'horloge du jeu = 42 s réelles (0,7 s la minute).
Valeurs d'Odette: prix de vente x 0,8, unité ordinaire, saison neutre.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import os
import random
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, "..", "..", "..", ".."))
DONNEES = os.path.join(RACINE, "games", "la-petite-ligne", "donnees")


def charger_module(nom: str, chemin: str):
    spec = importlib.util.spec_from_file_location(nom, chemin)
    if spec is None or spec.loader is None:
        raise SystemExit(f"impossible de charger {chemin}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[nom] = module
    spec.loader.exec_module(module)
    return module


EC = charger_module("economie_chaines", os.path.join(ICI, "economie_chaines.py"))

# ---------------------------------------------------------------------------
# Réglages proposés (reglages.garden.plots). Le document reprend ce tableau à l'identique
# (contrôle: --croise).
REGLAGES = {
    "start": 6,
    "max": 40,
    "price": 30,
    "restockPerDay": 2,
    "stockMax": 10,
    "stockAtStart": 2,
    "stockAtMigration": 10,
    "removeHoldSeconds": 0.6,
    "clearSeconds": 1.2,
    "clearEndurance": 3,
    "clearCellsPerPlot": 4,
    "orderGardenPerPlot": 4.5,
    "orderGardenPlotsCap": 24,
    "rentPerCellPerWeek": 3,
    "rentFromDay": 22,
}
# Garde-fou proposé chez Odette (economy.grocer.categoryCap.crop): au plus tant d'aubrins de légumes par jour.
CATEGORIE_CAP_LEGUMES = 250
GARDE_FOU = {"actif": True}

# Terre du garde-barrière (proposition, coordonnées de la carte 0.13).
YARD = {"x": 1, "y": 28, "w": 15, "h": 8}  # pré du jardin, entre la haie (x 0), le chemin (y 27), la clôture (y 36) et la route
FORBIDDEN_ZONES = ["hen_pen", "house_plan_reserved"]
GOAT_SPOTS_IN_YARD = ["goat_graze_03", "goat_graze_04", "goat_graze_05"]
SOLS_POSABLES = {".", ",", "p"}  # herbe, herbe haute, terre de l'ancien potager
FRICHE = "f"

# Hypothèses de durée (secondes réelles), dans la ligne de economie_chaines.py.
GESTE_S = EC.GESTE_POTAGER_S  # un geste sur une parcelle, pas jusqu'à elle compris
REMPLIR_S = 8.0  # aller au tonneau, remplir, revenir (arrosoir de 10)
CONTENANCE = 10
VENTE_S = 30.0  # le détour par le comptoir d'Odette et le menu, une fois par jour
CUISINE_TRAJET_S = 10.0  # aller au réchaud, une fois par jour s'il y a des plats
PLUIE = 0.28  # part des jours de pluie (moyenne des cibles de printemps, été, automne)
JOURS_WARMUP = 24
JOURS_MESURE = 48


def ronde(x: float, d: int = 1) -> str:
    return EC.nombre(x, d)


# ---------------------------------------------------------------------------
# 1. La terre


def terre(carte: dict) -> dict:
    ox, oy = carte["taille"]["origine"]["x"], carte["taille"]["origine"]["y"]
    lignes = carte["terrain"]["lignes"]

    def sol(x: int, y: int) -> str:
        return lignes[y - oy][x - ox]

    zones = {z["id"]: z["rect"] for z in carte["zones"]}
    occupe = set()
    for ob in carte["objets"] + [c for c in carte["chantiers"] if c.get("rect")]:
        r = ob["rect"]
        for y in range(r["y"], r["y"] + r["h"]):
            for x in range(r["x"], r["x"] + r["w"]):
                occupe.add((x, y))

    def interdite(x: int, y: int) -> str | None:
        if (x, y) in occupe:
            return "objet"
        for z in FORBIDDEN_ZONES:
            r = zones[z]
            if r["x"] <= x < r["x"] + r["w"] and r["y"] <= y < r["y"] + r["h"]:
                return z
        return None

    pre, raisons = [], {}
    for y in range(YARD["y"], YARD["y"] + YARD["h"]):
        for x in range(YARD["x"], YARD["x"] + YARD["w"]):
            r = interdite(x, y)
            if r is None and sol(x, y) not in SOLS_POSABLES:
                r = "sol"
            if r is None:
                pre.append((x, y))
            else:
                raisons[r] = raisons.get(r, 0) + 1
    friche = []
    for p in carte["parcelles"]:
        if p["nature"] != "defricher":
            continue
        for x, y in p["cases"]:
            if sol(x, y) == FRICHE and interdite(x, y) is None:
                friche.append((x, y))
    points = {p["id"]: p for p in carte["points"]}
    corde = 2.5
    cercles = {}
    for s in GOAT_SPOTS_IN_YARD:
        p = points[s]
        cercles[s] = [c for c in pre if math.hypot(c[0] + 0.5 - p["x"], c[1] + 0.5 - p["y"]) <= corde + 0.5]
    union = set()
    for v in cercles.values():
        union.update(v)
    return {"pre": pre, "raisons": raisons, "friche": friche, "cercles": cercles, "union_chevre": union}


# ---------------------------------------------------------------------------
# 2. Rendement


class Marche:
    """Offre d'Odette: le facteur d'un article baisse avec ce qu'on lui en a vendu; la moitié s'oublie chaque matin."""

    def __init__(self, d) -> None:
        g = d.reglages["economy"]["grocer"]
        self.s = g["supply"]
        self.cap = g["dailyCap"]
        self.d = d
        self.vendus: dict[str, int] = {}
        self.legumes = 0.0  # aubrins de légumes déjà payés aujourd'hui
        self.cap_legumes = CATEGORIE_CAP_LEGUMES if GARDE_FOU["actif"] else float("inf")

    def saturation(self, item: str) -> float:
        cat = self.d.items[item]["category"]
        return self.s["saturation"].get(item) or self.s["categorySaturation"].get(cat) or self.s["defaultSaturation"]

    def facteur(self, item: str, k: int = 0) -> float:
        return max(self.s["floor"], 1 - self.s["slope"] * (self.vendus.get(item, 0) + k) / self.saturation(item))

    def prix(self, item: str, k: int = 0) -> float:
        return (self.d.odette(item) or 0) * self.facteur(item, k)

    def aube(self) -> None:
        self.legumes = 0.0
        for k in list(self.vendus):
            self.vendus[k] = math.floor(self.vendus[k] * self.s["dawnDecay"])

    def vendre(self, item: str, n: int, budget: float) -> tuple[float, float]:
        total = 0.0
        legume = self.d.items[item]["category"] == "crop"
        for _ in range(n):
            p = self.prix(item)
            if total + p > budget or (legume and self.legumes + p > self.cap_legumes):
                break
            total += p
            if legume:
                self.legumes += p
            self.vendus[item] = self.vendus.get(item, 0) + 1
        return total, budget - total


def vente_du_jour(marche: Marche, recolte: dict[str, int], d) -> float:
    """Recette d'une vente complète, sans toucher à l'offre réelle (copie)."""
    copie = Marche(d)
    copie.vendus = dict(marche.vendus)
    copie.legumes = marche.legumes
    budget = float(copie.cap)
    total = 0.0
    for item in sorted(recolte, key=lambda it: -(d.odette(it) or 0)):
        v, budget = copie.vendre(item, recolte[item], budget)
        total += v
    return total


def journee(d, alloc: dict[str, int], cuisine: bool, jours: int, graine: int = 7) -> dict:
    """Simule `jours` journées, parcelles semées en décalé; rend les moyennes des JOURS_MESURE derniers jours."""
    crops = {c["id"]: c for c in d.cultures["crops"]}
    rng = random.Random(graine)
    marche = Marche(d)
    soupe = d.recettes["cook_vegetable_soup"]
    croque = d.recettes["cook_crunchy_radishes"]
    # Chaque parcelle: (culture, jour de semis décalé)
    parcelles = []
    for cid, n in alloc.items():
        g = crops[cid]["growthDays"]
        for j in range(n):
            parcelles.append([cid, -(j % g)])
    totaux = {"net": 0.0, "s": 0.0, "graines": 0.0, "plats": 0, "recette": 0.0}
    for jour in range(jours):
        marche.aube()
        pluie = rng.random() < PLUIE
        recolte: dict[str, int] = {}
        gestes = 0
        for p in parcelles:
            cid, debut = p
            c = crops[cid]
            if jour - debut >= c["growthDays"]:
                recolte[c["harvest"]] = recolte.get(c["harvest"], 0) + c["yieldPerCell"]
                p[1] = jour
                gestes += 2  # récolter, resemer
        graines = sum(d.valeur_intrant(crops[p[0]]["seed"]) for p in parcelles if p[1] == jour)
        n = len(parcelles)
        arrosage = 0 if pluie else n
        secondes = (gestes + arrosage) * GESTE_S + math.ceil(arrosage / CONTENANCE) * REMPLIR_S + VENTE_S
        plats = 0
        if cuisine:
            # Glouton, évalué sur la vente complète du jour: une fournée de plus (soupe ou croque-au-sel)
            # tant qu'elle augmente la recette du jour de plus que la valeur de son temps.
            base = vente_du_jour(marche, recolte, d)
            while True:
                choix = None
                for r in (soupe, croque):
                    if any(recolte.get(i["item"], 0) < i["count"] for i in r["inputs"]):
                        continue
                    essai = dict(recolte)
                    for i in r["inputs"]:
                        essai[i["item"]] -= i["count"]
                    sortie = r["output"]["item"]
                    essai[sortie] = essai.get(sortie, 0) + r["output"]["count"]
                    temps = (r["seconds"] + d.regle["handlingSeconds"]) * d.regle["minuteValue"] / d.s_par_minute
                    v = vente_du_jour(marche, essai, d)
                    gain = v - base - temps
                    if gain > 0 and (choix is None or gain > choix[0]):
                        choix = (gain, r, essai, v)
                if choix is None:
                    break
                _, r, recolte, base = choix
                plats += 1
                secondes += r["seconds"] + d.regle["handlingSeconds"]
            if plats:
                secondes += CUISINE_TRAJET_S
        budget = float(marche.cap)
        recette = 0.0
        # Vendre d'abord ce qui rapporte le plus à l'unité (le budget d'Odette est commun).
        for item in sorted(recolte, key=lambda it: -(d.odette(it) or 0)):
            v, budget = marche.vendre(item, recolte[item], budget)
            recette += v
        if jour >= jours - JOURS_MESURE:
            totaux["net"] += recette - graines
            totaux["s"] += secondes
            totaux["graines"] += graines
            totaux["plats"] += plats
            totaux["recette"] += recette
    m = JOURS_MESURE
    net, s = totaux["net"] / m, totaux["s"] / m
    minutes_jeu = s / d.s_par_minute
    return {"net": net, "s": s, "min": minutes_jeu, "heure": net / minutes_jeu * 60 if minutes_jeu else 0.0, "plats": totaux["plats"] / m, "recette": totaux["recette"] / m}


def meilleur(d, n: int, cuisine: bool) -> tuple[dict, dict]:
    """Meilleur partage: exhaustif pour la vente brute (pas de 2 au-delà de 30 parcelles); avec la cuisine,
    une grille plus large plus les dix meilleurs partages de la vente brute (et la vente brute elle-même)."""
    jours = JOURS_WARMUP + JOURS_MESURE
    pas = 1 if n <= 30 else 2
    bruts = []
    for r in range(0, n + 1, pas):
        for l in range(0, n - r + 1, pas):
            alloc = {"radish": r, "lettuce": l, "carrot": n - r - l}
            bruts.append((journee(d, alloc, False, jours)["net"], alloc))
    bruts.sort(key=lambda x: -x[0])
    if not cuisine:
        alloc = bruts[0][1]
        return alloc, journee(d, alloc, False, jours)
    candidats = [a for _, a in bruts[:10]]
    grille = max(1, n // 8)
    for r in range(0, n + 1, grille):
        for l in range(0, n - r + 1, grille):
            candidats.append({"radish": r, "lettuce": l, "carrot": n - r - l})
    best = None
    for alloc in candidats:
        res = journee(d, alloc, True, jours)
        if best is None or res["net"] > best[1]["net"]:
            best = (alloc, res)
    assert best is not None
    return best


def sans_offre(d, n: int) -> dict:
    """Le même potager au prix de base (sans baisse de l'offre): la ligne du tableau de l'économie 0.12.2."""
    out = {}
    for c in d.cultures["crops"]:
        net = (c["yieldPerCell"] * (d.odette(c["harvest"]) or 0) - d.valeur_intrant(c["seed"])) / c["growthDays"] * n
        out[c["id"]] = net
    return out


# ---------------------------------------------------------------------------
# 4. Croissance


PROFILS = {
    # revenus hors potager par jour (jours 1-7, 8-21, ensuite), part de ces revenus dépensée ailleurs,
    # réserve gardée avant d'acheter une parcelle, délai de remboursement accepté (jours),
    # débouché (vente brute seulement, ou cuisine en plus)
    # et cases de friche défrichées par jour à partir du jour 2 (une parcelle offerte toutes les 4 cases)
    "prudent": {"autres": (30, 110, 200), "ailleurs": 0.8, "reserve": 150, "rembourse": 10, "cuisine": False, "friche": 0},
    "médian": {"autres": (40, 150, 260), "ailleurs": 0.7, "reserve": 80, "rembourse": 20, "cuisine": True, "friche": 4},
    "pressé": {"autres": (40, 150, 260), "ailleurs": 0.5, "reserve": 30, "rembourse": 60, "cuisine": True, "friche": 12},
}


def croissance(d, rendement: dict[int, dict], profil: dict, friche_cases: int, jours: int = 64) -> list[int]:
    ns = sorted(rendement)

    def net(n: int) -> float:
        if n <= ns[0]:
            return rendement[ns[0]]["net"] * n / ns[0]
        for a, b in zip(ns, ns[1:]):
            if a <= n <= b:
                t = (n - a) / (b - a)
                return rendement[a]["net"] * (1 - t) + rendement[b]["net"] * t
        return rendement[ns[-1]]["net"]

    purse = d.reglages["economy"]["startPurse"]
    n = REGLAGES["start"]
    stock = REGLAGES["stockAtStart"]
    courbe = []
    defriche = 0
    for jour in range(1, jours + 1):
        if jour > 1:
            stock = min(REGLAGES["stockMax"], stock + REGLAGES["restockPerDay"])
            avant = defriche // REGLAGES["clearCellsPerPlot"]
            defriche = min(friche_cases, defriche + profil["friche"])
            n = min(REGLAGES["max"], n + defriche // REGLAGES["clearCellsPerPlot"] - avant)
        a = profil["autres"]
        autres = a[0] if jour <= 7 else a[1] if jour <= 21 else a[2]
        # Le potager ne rapporte qu'à partir du jour 3 (premiers radis).
        purse += (net(n) if jour >= 3 else 0) + autres * (1 - profil["ailleurs"])
        while stock > 0 and n < REGLAGES["max"]:
            marginal = net(n + 1) - net(n)
            if marginal <= 0 or REGLAGES["price"] / marginal > profil["rembourse"]:
                break
            if purse - REGLAGES["price"] < profil["reserve"]:
                break
            purse -= REGLAGES["price"]
            stock -= 1
            n += 1
        courbe.append(n)
    return courbe


# ---------------------------------------------------------------------------
# 5. Taille de l'état


def taille_etat(n: int) -> tuple[int, int]:
    """Octets JSON du potager: objet complet d'aujourd'hui, puis forme compacte proposée."""
    complet = {
        "index": 41,
        "cell": {"cx": -6, "cy": 31},
        "soil": "tilled",
        "wet": True,
        "crop": {"crop": "carrot", "days": 2, "stage": "young", "ripe": False, "wateredEveryDay": True, "sownDay": 37, "sownBy": "p1"},
        "lastHarvest": {"by": "p2", "tick": 1234567},
    }
    # Compact: [cx, cy, sol+mouillé en un chiffre, culture, jours, belle, semé par] et `kind` omis s'il vaut `own`.
    compact = [-6, 31, 3, "carrot", 2, 1, "p1"]
    a = len(json.dumps([complet] * n, separators=(",", ":")).encode())
    b = len(json.dumps([compact] * n, separators=(",", ":")).encode())
    return a, b


# ---------------------------------------------------------------------------


def croise(doc: str, valeurs: dict[str, float]) -> list[str]:
    ecarts = []
    with open(doc, encoding="utf-8") as f:
        texte = f.read()
    for cle, v in REGLAGES.items():
        m = re.search(r"\|\s*`" + re.escape(cle) + r"`\s*\|\s*([0-9]+(?:,[0-9]+)?)\s*\|", texte)
        if m is None:
            ecarts.append(f"réglage `{cle}` absent du tableau du document")
            continue
        lu = float(m.group(1).replace(",", "."))
        if abs(lu - v) > 1e-9:
            ecarts.append(f"réglage `{cle}`: document {m.group(1)}, script {v}")
    for cle, v in valeurs.items():
        m = re.search(r"<!--\s*" + re.escape(cle) + r"\s*-->\s*(-?[0-9]+(?:,([0-9]+))?)", texte)
        if m is None:
            ecarts.append(f"valeur `{cle}` non marquée dans le document")
            continue
        decimales = len(m.group(2) or "")
        lu = float(m.group(1).replace(",", "."))
        if abs(lu - round(v, decimales)) > 0.5 * 10 ** (-decimales) + 1e-9:
            ecarts.append(f"valeur `{cle}`: document {m.group(1)}, script {ronde(v, decimales)}")
    return ecarts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--croise", metavar="DOC")
    args = ap.parse_args()
    d = EC.Donnees(DONNEES)
    with open(os.path.join(DONNEES, "cartes", "halte.json"), encoding="utf-8") as f:
        carte = json.load(f)
    valeurs: dict[str, float] = {}

    t = terre(carte)
    print("1. Terre du garde-barrière")
    print(f"Pré du jardin (x {YARD['x']} à {YARD['x'] + YARD['w'] - 1}, y {YARD['y']} à {YARD['y'] + YARD['h'] - 1}): {len(t['pre'])} cases posables; écartées: {t['raisons']}")
    print(f"Friche à défricher: {len(t['friche'])} cases. Total une fois défrichée: {len(t['pre']) + len(t['friche'])}.")
    for s, cases in t["cercles"].items():
        print(f"  cercle de corde de {s}: {len(cases)} cases du pré")
    print(f"  union des trois cercles: {len(t['union_chevre'])} cases; hors cercles: {len(t['pre']) - len(t['union_chevre'])}")
    valeurs["terre_pre"] = len(t["pre"])
    valeurs["terre_friche"] = len(t["friche"])
    valeurs["terre_hors_chevre"] = len(t["pre"]) - len(t["union_chevre"])
    print()

    print("2. Rendement du potager (valeurs d'Odette, offre et budget du jour compris; pluie 28 % des jours)")
    print("| Parcelles | Partage (radis, laitue, carotte) | Net par jour, brut chez Odette | Temps actif (min de jeu) | Par heure de jeu active | Net par jour avec soupe et croque-au-sel | Par heure active | Sans baisse de l'offre (carottes) |")
    print("|---|---|---|---|---|---|---|---|")
    rendement: dict[int, dict] = {}
    rendement_cuisine: dict[int, dict] = {}
    for n in (6, 12, 20, 30, 40, 50):
        alloc, r = meilleur(d, n, False)
        alloc2, r2 = meilleur(d, n, True)
        rendement[n] = r
        rendement_cuisine[n] = r2
        sb = sans_offre(d, n)["carrot"]
        print(
            f"| {n} | {alloc['radish']}, {alloc['lettuce']}, {alloc['carrot']} | {ronde(r['net'])} | {ronde(r['min'], 0)} | {ronde(r['heure'])} "
            f"| {ronde(r2['net'])} ({alloc2['radish']}, {alloc2['lettuce']}, {alloc2['carrot']}; {ronde(r2['plats'])} fournées) | {ronde(r2['heure'])} | {ronde(sb)} |"
        )
        print(f"|   | budget d'Odette pris (recette du jour sur {d.reglages['economy']['grocer']['dailyCap']}) | {ronde(r['recette'], 0)} | | | {ronde(r2['recette'], 0)} | | |")
        valeurs[f"recette_{n}"] = r["recette"]
        valeurs[f"recettec_{n}"] = r2["recette"]
        valeurs[f"net_{n}"] = r["net"]
        valeurs[f"heure_{n}"] = r["heure"]
        valeurs[f"netc_{n}"] = r2["net"]
        valeurs[f"heurec_{n}"] = r2["heure"]
        valeurs[f"min_{n}"] = r["min"]
    GARDE_FOU["actif"] = False
    for n in (40, 50):
        _, r = meilleur(d, n, False)
        _, r2 = meilleur(d, n, True)
        print(f"Sans le garde-fou des légumes, {n} parcelles: {ronde(r['net'])} brut ({ronde(r['recette'], 0)} payés), {ronde(r2['net'])} avec la cuisine ({ronde(r2['recette'], 0)} payés)")
        valeurs[f"sansgf_net_{n}"] = r["net"]
        valeurs[f"sansgf_netc_{n}"] = r2["net"]
    GARDE_FOU["actif"] = True
    print()

    print("3. La parcelle de plus: gain net par jour et remboursement au prix de", REGLAGES["price"])
    print("| Tranche | Gain de la parcelle de plus, brut (par jour) | Remboursée en (jours) | Avec la cuisine (par jour) | Remboursée en (jours) |")
    print("|---|---|---|---|---|")
    ns = sorted(rendement)
    for a, b in zip(ns, ns[1:]):
        m1 = (rendement[b]["net"] - rendement[a]["net"]) / (b - a)
        m2 = (rendement_cuisine[b]["net"] - rendement_cuisine[a]["net"]) / (b - a)
        r1 = REGLAGES["price"] / m1 if m1 > 0 else float("inf")
        r2 = REGLAGES["price"] / m2 if m2 > 0 else float("inf")
        print(f"| {a} à {b} | {ronde(m1, 2)} | {ronde(r1, 0) if r1 != float('inf') else 'jamais'} | {ronde(m2, 2)} | {ronde(r2, 0) if r2 != float('inf') else 'jamais'} |")
        valeurs[f"marg_{a}_{b}"] = m1
        valeurs[f"margc_{a}_{b}"] = m2
    print()
    print("Autres prix essayés (remboursement de la parcelle de plus, brut, en jours):")
    for prix in (15, 20, 25, 30, 40):
        ligne = []
        for a, b in zip(ns, ns[1:]):
            m1 = (rendement[b]["net"] - rendement[a]["net"]) / (b - a)
            ligne.append(f"{a}-{b}: {ronde(prix / m1, 0) if m1 > 0 else 'jamais'}")
        print(f"  {prix} aubrins: " + "; ".join(ligne))
    print()

    print("4. Croissance (parcelles possédées), rayon d'Odette:", REGLAGES["restockPerDay"], "par matin,", REGLAGES["stockMax"], "au plus, prix", REGLAGES["price"])
    print("| Duo | Jour 1 | Jour 8 | Jour 15 | Jour 22 | Jour 43 | Jour 64 | 12 atteintes | 20 atteintes | 30 atteintes |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for nom, profil in PROFILS.items():
        c = croissance(d, rendement_cuisine if profil["cuisine"] else rendement, profil, len(t["friche"]))

        def jour_de(k: int) -> str:
            return next((str(i + 1) for i, v in enumerate(c) if v >= k), "jamais")

        print(f"| {nom} | {c[0]} | {c[7]} | {c[14]} | {c[21]} | {c[42]} | {c[63]} | {jour_de(12)} | {jour_de(20)} | {jour_de(30)} |")
        valeurs[f"crois_{nom}_64"] = c[63]
        valeurs[f"crois_{nom}_22"] = c[21]
    def borne(k: int) -> int:
        n, stock, jour = REGLAGES["start"], REGLAGES["stockAtStart"], 1
        while True:
            n += stock
            stock = 0
            if n >= k:
                return jour
            jour += 1
            stock = min(REGLAGES["stockMax"], REGLAGES["restockPerDay"])

    print(f"Borne du rayon seul (tout acheté chaque matin, sans friche): 12 au jour {borne(12)}, 20 au jour {borne(20)}, 30 au jour {borne(30)}, {REGLAGES['max']} au jour {borne(REGLAGES['max'])}.")
    valeurs["borne_20"] = borne(20)
    valeurs["borne_30"] = borne(30)
    valeurs["borne_max"] = borne(REGLAGES["max"])
    print()

    print("5. Activités de comparaison (economie_chaines.py, prix de base, sans baisse de l'offre)")
    recettes, _, _ = EC.etude_recettes(d)
    acts, _ = EC.etude_activites(d, recettes)
    for a in acts:
        if a["famille"] == "potager":
            continue
        print(f"  {a['nom']}: {ronde(a['jour'])} par jour, {ronde(a['heure_active'])} par heure de jeu active")
    print()

    print("6. Taille de l'état du potager transmis à l'invité (JSON, octets)")
    for n in (12, 30, 60, 100):
        a, b = taille_etat(n)
        print(f"  {n} parcelles: {a} aujourd'hui, {b} en forme compacte")
        valeurs[f"etat_{n}"] = a
        valeurs[f"etatc_{n}"] = b

    if args.croise:
        ecarts = croise(args.croise, valeurs)
        print()
        if ecarts:
            print("Écarts avec le document:")
            for e in ecarts:
                print("  - " + e)
            return 1
        print("Document conforme au script.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
