"""La Petite Ligne 0.12.2: les chaînes de production et leur marge (economie-chaines-0-12-2.md).

Lancer: python3 -I docs/jeux/jeu-1/simulations/economie_chaines.py [--donnees DOSSIER] [--chaines]
Bibliothèque standard seule, moins d'une seconde.

Le script lit les données du jeu (objets.json, reglages.json, cultures.json, catalogue.json),
déroule chaque chaîne (graine, récolte, plat; grain, œuf, omelette; chèvre, lait, fromage;
cueillette, confiture; arbre, rondin, planche, cagette...) et imprime pour chaque étape la
valeur des intrants, celle du produit, la marge et la marge par minute de jeu. Il signale:
- toute recette dont le produit vaut moins que la règle (reglages.economy.chains);
- tout produit transformé sans prix de vente (sauf les catégories d'usage, les meubles);
- une culture ou un élevage qui ne couvre pas son coût (graine, grain) avec la marge minimale;
- une bête du catalogue qui se rembourse trop vite ou trop lentement;
- une activité qui rapporte moins, par heure de jeu active, que la valeur du temps (inutile),
  ou qui domine toutes les autres à la fois par heure active et par jour.
Code de sortie 1 s'il y a au moins un signalement (0 sinon): utilisable en contrôle.

Prix: « valeur d'Odette », le prix de base de son comptoir pour une unité ordinaire, en saison
neutre et sans offre déjà vendue (sellPrice x 0,8). Un intrant acheté vaut son prix d'achat.
Temps: en minutes de jeu (0,7 s réelle la minute, reglages.clock), d'un seul joueur.

--donnees DOSSIER: lit un autre jeu de données (par exemple une copie de main avant le patch);
si ce dossier n'a pas de règle (economy.chains), celle du jeu en place s'applique.
"""

from __future__ import annotations

import argparse
import json
import os
import statistics
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, "..", "..", "..", ".."))
DONNEES = os.path.join(RACINE, "games", "la-petite-ligne", "donnees")
SAISONS = ["spring", "summer", "autumn", "winter"]
NOMS_SAISONS = {"spring": "printemps", "summer": "été", "autumn": "automne", "winter": "hiver"}

# Hypothèses de durée des gestes, en secondes réelles (ce ne sont pas des réglages du jeu:
# elles décrivent un joueur ordinaire; les gestes eux-mêmes durent 0,35 à 0,8 s, defauts.ts).
GESTE_POTAGER_S = 2.0  # un geste sur une case, pas jusqu'à la case compris
TOUR_LISIERE_S = 60.0  # le tour des six coins de cueillette depuis la maison
CUEILLIR_S = 1.0  # ramasser un coin garni
PRISE_S = 12.0  # une prise: lancer 1 s, attente moyenne 9 s, touche et prise 2 s (pêche 0.12)
POULES_TOUR_S = 6.0  # aller à la mangeoire et jeter le grain (toute la basse-cour)
OEUF_S = 1.0  # ramasser un œuf
PAILLE_S = 10.0  # prendre une brassée à la remise et pailler (3 s), tous les strawDays jours
CARESSE_S = 1.5  # caresser une poule, par joueur
CHEVRE_PIQUET_S = 12.0  # mener la chèvre et replanter le piquet
CHEVRE_EAU_S = 15.0  # puiser un seau et le verser au baquet
CHEVRE_BROSSE_S = 2.0  # par joueur
ARBRE_S = 40.0  # aller à l'arbre, trois coups, ramasser, porter les rondins à l'établi
PLIS_TOUR_S = 40.0  # prendre la sacoche et faire le tour du bourg
PLI_S = 8.0  # le détour pour un pli


def charger(dossier: str, nom: str) -> dict:
    with open(os.path.join(dossier, nom), encoding="utf-8") as f:
        return json.load(f)


def nombre(x: float, decimales: int = 1) -> str:
    texte = f"{x:.{decimales}f}".replace(".", ",")
    return texte.replace("-", "−") if False else texte


def pct(x: float) -> str:
    return f"{x * 100:+.0f} %".replace("+-", "-")


class Donnees:
    def __init__(self, dossier: str) -> None:
        self.objets = charger(dossier, "objets.json")
        self.reglages = charger(dossier, "reglages.json")
        self.cultures = charger(dossier, "cultures.json")
        self.catalogue = charger(dossier, "catalogue.json")
        self.items = {it["id"]: it for it in self.objets["items"]}
        self.recettes = {r["id"]: r for r in self.objets["recipes"]}
        self.qualites = {q["id"]: q["priceMultiplier"] for q in self.cultures["qualities"]}
        eco = self.reglages["economy"]
        regle = eco.get("chains")
        if regle is None and os.path.abspath(dossier) != os.path.abspath(DONNEES):
            regle = charger(DONNEES, "reglages.json")["economy"]["chains"]
        if regle is None:
            raise SystemExit("reglages.economy.chains manquant: la règle des chaînes n'est pas écrite")
        self.regle = regle
        self.taux_odette = eco["grocer"]["buyRate"]
        self.saison_facteur = eco["grocer"]["seasonFactor"]
        self.s_par_minute = self.reglages["clock"]["secondsPerGameMinute"]
        debut = self.minutes(self.reglages["clock"]["dayStart"])
        fin = self.minutes(self.reglages["clock"]["dayEnd"])
        self.minutes_par_jour = fin - debut
        self.duo_recettes = set(self.reglages["building"]["twoPlayersRecipes"])
        self.vitesse_duo = self.reglages["building"]["twoPlayersSpeedMultiplier"]
        # Ce que pond ou donne une bête chaque jour (objets.animals[].produces): œuf de la poule, lait de la chèvre.
        self.produit_par_bete = {a["produces"]["item"]: a["id"] for a in self.objets["animals"] if a["produces"].get("per") == "day"}

    @staticmethod
    def minutes(hhmm: str) -> int:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)

    def odette(self, item: str, qualite: str = "ordinary", saison: str | None = None) -> float | None:
        """Prix de base d'Odette pour une unité (sans offre ni ardoise); None si elle ne l'achète pas."""
        it = self.items[item]
        if it.get("sellPrice") is None:
            return None
        facteur = 1.0
        if saison is not None:
            ligne = self.saison_facteur.get(item)
            facteur = ligne[SAISONS.index(saison)] if ligne else 1.0
        return it["sellPrice"] * self.qualites[qualite] * self.taux_odette * facteur

    def achat(self, item: str) -> float | None:
        it = self.items[item]
        return it["buyPrice"] if it.get("buyPrice") is not None and it.get("shop") is not None else None

    def valeur_intrant(self, item: str, qualite: str = "ordinary", saison: str | None = None) -> float:
        """Acheté: son prix d'achat; récolté ou produit: son prix d'Odette; sans prix: 0 (son temps seul)."""
        prix = self.achat(item)
        if prix is not None:
            return float(prix)
        v = self.odette(item, qualite if self.a_qualites(item) else "ordinary", saison)
        return 0.0 if v is None else v

    def a_qualites(self, item: str) -> bool:
        # Les cultures portent `qualities`; les œufs peuvent être beaux (poule ravie, section 4.2).
        return "qualities" in self.items[item] or self.produit_par_bete.get(item) == "hen"

    def filiere(self, item: str) -> str:
        """D'où vient un intrant: achat, ou la catégorie de ce qui le produit (une bête à part)."""
        if self.achat(item) is not None:
            return "achat"
        if item in self.produit_par_bete:
            return "bête:" + self.produit_par_bete[item]
        return self.items[item]["category"]

    def minutes_recette(self, recette: dict) -> float:
        return (recette["seconds"] + self.regle["handlingSeconds"]) / self.s_par_minute

    def marge_exigee(self, recette: dict) -> float:
        sources = {self.filiere(i["item"]) for i in recette["inputs"]}
        return self.regle["minMargin"] + self.regle["extraSourceMargin"] * (len(sources) - 1)


def etude_recettes(d: Donnees) -> tuple[list[dict], list[str], list[str]]:
    lignes: list[dict] = []
    signalements: list[str] = []
    avertissements: list[str] = []
    usage = set(d.regle["usageCategories"])
    for r in d.objets["recipes"]:
        sortie = r["output"]["item"]
        cat = d.items[sortie]["category"]
        prix_sortie = d.odette(sortie)
        entree = sum(i["count"] * d.valeur_intrant(i["item"]) for i in r["inputs"])
        t = d.minutes_recette(r)
        m = d.marge_exigee(r)
        exige = entree * (1 + m) + d.regle["minuteValue"] * t
        ligne = {"id": r["id"], "nom": r["name"], "entree": entree, "t": t, "m": m, "exige": exige, "usage": cat in usage, "duo": r["id"] in d.duo_recettes}
        if prix_sortie is None:
            ligne.update({"sortie": None, "marge": None})
            if cat not in usage:
                signalements.append(f"{r['id']}: « {d.items[sortie]['name']} » est transformé mais n'a pas de prix de vente")
            lignes.append(ligne)
            continue
        valeur = prix_sortie * r["output"]["count"]
        ligne.update({"sortie": valeur, "marge": valeur - entree})
        if cat not in usage and valeur + 1e-9 < exige:
            manque = exige - valeur
            signalements.append(
                f"{r['id']}: le produit vaut {nombre(valeur)} pour {nombre(entree)} d'intrants, il faut {nombre(exige)} "
                f"(marge {pct(m)} et {nombre(t, 0)} min de jeu): il manque {nombre(manque)}"
            )
        # Avertissements, sans bloquer: la pire saison, et des intrants beaux (le produit sort ordinaire).
        pire = min(
            (d.odette(sortie, saison=s) or 0) * r["output"]["count"] - sum(i["count"] * d.valeur_intrant(i["item"], saison=s) for i in r["inputs"])
            for s in SAISONS
        )
        beaux = sum(i["count"] * d.valeur_intrant(i["item"], "fine") for i in r["inputs"])
        ligne.update({"pire_saison": pire, "beaux": beaux})
        if cat not in usage and pire < 0:
            avertissements.append(f"{r['id']}: perd {nombre(-pire)} dans la pire saison (prix d'Odette selon la saison)")
        if cat not in usage and beaux > entree and valeur < beaux * (1 + d.regle["minMargin"]):
            avertissements.append(
                f"{r['id']}: avec des intrants beaux ({nombre(beaux)}), le produit (ordinaire, {nombre(valeur)}) rapporte {pct(valeur / beaux - 1)}"
            )
        lignes.append(ligne)
    return lignes, signalements, avertissements


def etude_cultures(d: Donnees) -> tuple[list[dict], list[str]]:
    lignes, signalements = [], []
    for c in d.cultures["crops"]:
        graine = d.valeur_intrant(c["seed"])
        recolte = c["yieldPerCell"] * (d.odette(c["harvest"]) or 0)
        gestes = 2 + c["growthDays"]  # semer, arroser chaque jour de pousse, récolter (la case reste bêchée)
        t = gestes * GESTE_POTAGER_S / d.s_par_minute
        exige = graine * (1 + d.regle["minMargin"]) + d.regle["minuteValue"] * t
        lignes.append({"id": c["id"], "graine": graine, "recolte": recolte, "jours": c["growthDays"], "t": t, "exige": exige})
        if recolte < exige:
            signalements.append(f"culture {c['id']}: la récolte vaut {nombre(recolte)}, il faut {nombre(exige)}")
    return lignes, signalements


def etude_elevage(d: Donnees) -> tuple[dict, list[str]]:
    """Ce que rapporte une bête par jour, nourrie seulement ou bien soignée, et en combien de jours elle se rembourse."""
    signalements: list[str] = []
    hens = d.reglages["hens"]
    grain = hens["care"]["grain"]
    ration = d.valeur_intrant(grain["item"]) / grain["rations"] * grain["perHen"]
    oeuf = d.odette("egg") or 0
    oeuf_beau = d.odette("egg", "fine") or 0
    par_jour = hens["eggsPerHenPerDay"]
    poule = {
        "ration": ration,
        "nourrie": par_jour * oeuf - ration,
        "soignee": par_jour * oeuf_beau - ration,
        "part_grain": ration / (par_jour * oeuf) if oeuf else float("inf"),
    }
    if par_jour * oeuf < ration * (1 + d.regle["minMargin"]):
        signalements.append(f"poule: un œuf ({nombre(oeuf)}) ne couvre pas son grain ({nombre(ration)}) avec la marge minimale")
    lait = d.odette(d.reglages["goats"]["milkItem"]) or 0
    chevre = {"ration": 0.0, "nourrie": lait * 1, "soignee": lait * 2}
    betes = []
    for item, info in d.catalogue.get("hens", {}).items():
        betes.append((item, d.items[item]["name"] + f" ({info['name']})", poule))
    betes.append((d.reglages["goats"]["extraItem"], "deuxième chèvre", chevre))
    rembourse = []
    lo, hi = d.regle["paybackDays"]["min"], d.regle["paybackDays"]["max"]
    for item, nom, bete in betes:
        prix = d.items[item]["buyPrice"]
        jours_s = prix / bete["soignee"] if bete["soignee"] > 0 else float("inf")
        jours_n = prix / bete["nourrie"] if bete["nourrie"] > 0 else float("inf")
        rembourse.append({"item": item, "nom": nom, "prix": prix, "soignee": jours_s, "nourrie": jours_n})
        if not lo <= jours_s <= hi:
            signalements.append(f"{item}: se rembourse en {nombre(jours_s, 0)} jours bien soignée (règle: {lo} à {hi})")
    return {"poule": poule, "chevre": chevre, "rembourse": rembourse}, signalements


def gain_moyen_prise(d: Donnees, saison: str) -> float:
    """Valeur d'Odette moyenne d'une prise: poids des raretés, prix moyen des espèces de la saison."""
    poids = d.reglages["fishing"]["rarity"]["tierWeights"]
    total, somme = 0.0, 0.0
    for tier, w in poids.items():
        prix = [d.odette(it["id"]) for it in d.items.values() if "fish" in it and it["fish"]["rarity"] == tier and saison in it["fish"]["seasons"] and it.get("sellPrice") is not None]
        if prix:
            somme += w * statistics.mean(prix)
            total += w
    return somme / total if total else 0.0


def cueillette_jour(d: Donnees, saison: str) -> tuple[float, float]:
    """Valeur d'Odette espérée d'un tour de lisière, et nombre de coins garnis."""
    f = d.reglages["forage"]
    items = {i["item"]: i for i in f["items"]}
    valeur, coins = 0.0, 0.0
    for p in f["points"]:
        cands = [items[x] for x in p["items"] if x in items and saison in items[x]["seasons"]]
        if not cands:
            continue
        w = sum(c["weight"] for c in cands)
        moyenne = sum(c["weight"] / w * (sum(c["count"]) / 2) * (d.odette(c["item"]) or 0) for c in cands)
        valeur += f["spawnChance"] * moyenne
        coins += f["spawnChance"]
    return valeur, coins


def etude_activites(d: Donnees, recettes: list[dict]) -> tuple[list[dict], list[str]]:
    """Une journée de jeu consacrée à chaque activité: gain net au plus par jour, temps actif, gain par heure active."""
    acts: list[dict] = []
    m = d.s_par_minute
    cellules = d.reglages["garden"]["cells"]
    for c in d.cultures["crops"]:
        net_case_jour = (c["yieldPerCell"] * (d.odette(c["harvest"]) or 0) - d.valeur_intrant(c["seed"])) / c["growthDays"]
        t_case_jour = (2 + c["growthDays"]) * GESTE_POTAGER_S / c["growthDays"] / m
        acts.append({"nom": f"potager, {c['name']} (12 cases)", "jour": net_case_jour * cellules, "t": t_case_jour * cellules, "plafond": True, "famille": "potager"})
    for s in ("spring", "summer", "autumn"):
        v, coins = cueillette_jour(d, s)
        acts.append({"nom": f"cueillette, {NOMS_SAISONS[s]}", "jour": v, "t": (TOUR_LISIERE_S + coins * CUEILLIR_S) / m, "plafond": True, "libre": True, "famille": "cueillette"})
    for s in ("spring", "autumn"):
        g = gain_moyen_prise(d, s)
        # Une heure de jeu passée à pêcher (42 s réelles): l'activité sans plafond de référence.
        par_heure_active = g * (60 * m) / PRISE_S
        acts.append({"nom": f"pêche, {NOMS_SAISONS[s]} (une heure de jeu)", "jour": par_heure_active, "t": 60.0, "plafond": False, "libre": True, "famille": "pêche"})
    hens = d.reglages["hens"]
    n = hens["max"]
    grain = hens["care"]["grain"]
    ration = d.valeur_intrant(grain["item"]) / grain["rations"] * grain["perHen"]
    t_nourrie = (POULES_TOUR_S + n * OEUF_S) / m
    t_soignee = (POULES_TOUR_S + n * OEUF_S + PAILLE_S / hens["care"]["happiness"]["strawDays"] + 2 * n * CARESSE_S) / m
    acts.append({"nom": f"poules nourries ({n}), œufs ordinaires", "jour": n * ((d.odette("egg") or 0) - ration), "t": t_nourrie, "plafond": True, "famille": "poules"})
    acts.append({"nom": f"poules soignées ({n}), beaux œufs", "jour": n * ((d.odette("egg", "fine") or 0) - ration), "t": t_soignee, "plafond": True, "famille": "poules"})
    lait = d.odette(d.reglages["goats"]["milkItem"]) or 0
    t_chevre = (CHEVRE_PIQUET_S + CHEVRE_EAU_S + 2 * CHEVRE_BROSSE_S + d.reglages["goats"]["milkSeconds"]) / m
    acts.append({"nom": "chèvre soignée (1), 2 bidons", "jour": 2 * lait, "t": t_chevre, "plafond": True, "famille": "chèvre"})
    fromage = next((r for r in recettes if r["id"] == "cook_fresh_cheese"), None)
    if fromage is not None and fromage["sortie"] is not None:
        acts.append({"nom": "chèvre soignée (1), en fromage", "jour": fromage["sortie"], "t": t_chevre + fromage["t"], "plafond": True, "famille": "chèvre"})
    trees = d.reglages["trees"]
    cycle = trees["stumpDays"] + trees["saplingDays"]
    arbres_jour = trees["count"] / cycle
    scie = d.recettes["saw_plank"]
    planches = trees["logsPerTree"] * scie["output"]["count"] * (d.odette("plank") or 0)
    t_arbre = (ARBRE_S + trees["logsPerTree"] * scie["seconds"]) / m
    acts.append({"nom": f"bois, planches ({nombre(arbres_jour)} arbre par jour)", "jour": arbres_jour * planches, "t": arbres_jour * t_arbre, "plafond": True, "famille": "bois"})
    mr = d.reglages["mailRound"]
    plis = sum(c["count"] * c["weight"] for c in mr["counts"]) / sum(c["weight"] for c in mr["counts"])
    paie = (1 - mr["parcelShare"]) * mr["pay"]["letter"] + mr["parcelShare"] * mr["pay"]["parcel"] + mr["earlyBonus"]
    acts.append({"nom": f"plis de Lucie ({nombre(plis)} par jour, avant midi)", "jour": plis * paie, "t": (PLIS_TOUR_S + plis * PLI_S) / m, "plafond": True, "famille": "plis"})
    for a in acts:
        a["heure_active"] = a["jour"] / a["t"] * 60 if a["t"] > 0 else 0.0
    signalements: list[str] = []
    reference = d.regle["minuteValue"] * 60
    for a in acts:
        if a["heure_active"] < 0.5 * reference:
            signalements.append(f"activité « {a['nom']} »: {nombre(a['heure_active'])} par heure de jeu active, moins de la moitié de la valeur du temps ({nombre(reference)}): inutile")
        if a.get("libre") and a["heure_active"] > 2 * reference:
            signalements.append(f"activité « {a['nom']} »: produit gratuit à {nombre(a['heure_active'])} par heure active, plus du double de la valeur du temps")
    # Deux variantes d'une même activité (trois cultures, poules nourries ou soignées) ne se comparent pas entre elles.
    plafonnees = [a for a in acts if a["plafond"]]
    for a in plafonnees:
        autres = [b for b in plafonnees if b["famille"] != a["famille"]]
        if autres and all(a["jour"] > 1.5 * b["jour"] and a["heure_active"] > 1.5 * b["heure_active"] for b in autres):
            signalements.append(f"activité « {a['nom']} »: domine toutes les autres, par jour et par heure active")
    return acts, signalements


def imprimer(d: Donnees, montrer_chaines: bool) -> int:
    recettes, sig_r, avert = etude_recettes(d)
    cultures, sig_c = etude_cultures(d)
    elevage, sig_e = etude_elevage(d)
    acts, sig_a = etude_activites(d, recettes)
    regle = d.regle
    print("La Petite Ligne, chaînes de production (valeur d'Odette: sellPrice x {0}, unité ordinaire)".format(nombre(d.taux_odette)))
    print(
        f"Règle: marge d'au moins {pct(regle['minMargin'])} sur les intrants, {pct(regle['extraSourceMargin'])} par filière d'intrants en plus, "
        f"plus {nombre(regle['minuteValue'], 2)} aubrin par minute de jeu (recette + {regle['handlingSeconds']} s de manutention, "
        f"{nombre(d.s_par_minute)} s la minute)."
    )
    print()
    print("1. Recettes (réchaud et établi)")
    print("| Recette | Intrants | Produit | Marge | Exigé | Marge par minute de jeu (seul; à deux) | État |")
    print("|---|---|---|---|---|---|---|")
    for r in recettes:
        if r["sortie"] is None:
            etat = "usage (meuble, non vendu)" if r["usage"] else "SANS PRIX DE VENTE"
            print(f"| {r['nom']} | {nombre(r['entree'])} | | | | | {etat} |")
            continue
        marge = r["marge"]
        mpm = marge / r["t"]
        duo = f"; {nombre(mpm * d.vitesse_duo, 2)}" if r["duo"] else ""
        if r["usage"]:
            etat = "usage"
        elif r["sortie"] + 1e-9 >= r["exige"]:
            etat = "ok"
        else:
            etat = "SOUS LA RÈGLE"
        taux = pct(marge / r["entree"]) if r["entree"] > 0 else "intrant sans prix"
        print(f"| {r['nom']} | {nombre(r['entree'])} | {nombre(r['sortie'])} | {nombre(marge)} ({taux}) | {nombre(r['exige'])} (+{pct(r['m'])[1:]}) | {nombre(mpm, 2)}{duo} | {etat} |")
    print()
    print("2. Potager (une case, de la graine à la récolte)")
    print("| Culture | Graine | Récolte | Jours | Marge | Exigé |")
    print("|---|---|---|---|---|---|")
    for c in cultures:
        print(f"| {c['id']} | {nombre(c['graine'])} | {nombre(c['recolte'])} | {c['jours']} | {nombre(c['recolte'] - c['graine'])} ({pct((c['recolte'] - c['graine']) / c['graine'])}) | {nombre(c['exige'])} |")
    print()
    p = elevage["poule"]
    print("3. Élevage")
    print(
        f"Poule: une ration de grain coûte {nombre(p['ration'], 2)} ({nombre(p['part_grain'] * 100, 0)} % d'un œuf ordinaire); "
        f"gain net par poule et par jour: {nombre(p['nourrie'], 2)} nourrie seulement, {nombre(p['soignee'], 2)} bien soignée (beaux œufs)."
    )
    c = elevage["chevre"]
    print(f"Chèvre: pâture gratuite; gain par jour {nombre(c['nourrie'], 1)} (1 bidon) ou {nombre(c['soignee'], 1)} bien soignée (2 bidons).")
    print("| Bête du catalogue | Prix | Remboursée en (bien soignée) | (nourrie seulement) |")
    print("|---|---|---|---|")
    for b in elevage["rembourse"]:
        print(f"| {b['nom']} | {b['prix']} | {nombre(b['soignee'], 0)} jours | {nombre(b['nourrie'], 0)} jours |")
    print()
    print("4. Activités: une journée de jeu (18 h, 12,6 min réelles) où l'on fait cette activité au plus")
    print("| Activité | Gain net par jour (plafond) | Temps actif (min de jeu) | Par heure de jeu active | Par heure réelle, si chaque jour |")
    print("|---|---|---|---|---|")
    jours_par_heure = 3600.0 / (d.minutes_par_jour * d.s_par_minute)
    for a in acts:
        reel = a["jour"] * jours_par_heure if a["plafond"] else a["heure_active"] * 3600.0 / (60 * d.s_par_minute)
        plafond = nombre(a["jour"]) if a["plafond"] else "sans plafond"
        print(f"| {a['nom']} | {plafond} | {nombre(a['t'], 0)} | {nombre(a['heure_active'])} | {nombre(reel, 0)} |")
    if montrer_chaines:
        print()
        print("5. Chaînes complètes (valeur d'Odette d'une unité à chaque étape)")
        for ligne in chaines(d):
            print("- " + ligne)
    sig = sig_r + sig_c + sig_e + sig_a
    print()
    if avert:
        print("Avertissements (sans bloquer):")
        for a in avert:
            print("  - " + a)
    if sig:
        print(f"Signalements ({len(sig)}):")
        for s in sig:
            print("  - " + s)
        return 1
    print("Aucun signalement: chaque étape respecte la règle.")
    return 0


def chaines(d: Donnees) -> list[str]:
    v = lambda item: d.odette(item)  # noqa: E731
    a = d.valeur_intrant
    lignes = []
    lignes.append(f"radis: sachet {nombre(a('radish_seed'))} -> 3 radis {nombre(3 * (v('radish') or 0))} -> (3 radis) 2 croque-au-sel {nombre(2 * (v('crunchy_radishes') or 0))}")
    soupe = 2 * (v("carrot") or 0) + 2 * (v("radish") or 0) + (v("lettuce") or 0)
    lignes.append(f"soupe: 2 carottes, 2 radis, 1 laitue {nombre(soupe)} -> 2 soupes {nombre(2 * (v('vegetable_soup') or 0))}")
    g = d.reglages["hens"]["care"]["grain"]
    ration = a(g["item"]) / g["rations"]
    lignes.append(f"basse-cour: sac de grain {nombre(a(g['item']))} = {g['rations']} rations ({nombre(ration, 2)}) -> 1 œuf {nombre(v('egg') or 0)} (beau {nombre(d.odette('egg', 'fine') or 0)}) -> 3 œufs {nombre(3 * (v('egg') or 0))} -> 2 omelettes {nombre(2 * (v('omelette') or 0))}")
    lignes.append(f"poêlée: 3 girolles et 1 œuf {nombre(3 * (v('chanterelle') or 0) + (v('egg') or 0))} -> 2 poêlées {nombre(2 * (v('chanterelle_pan') or 0))}")
    lignes.append(f"chèvre: pâture -> 2 bidons {nombre(2 * (v('milk_can') or 0))} -> 1 fromage frais {nombre(v('fresh_cheese') or 0)}")
    conf = 8 * (v("blackberry") or 0) + a("sugar") + 2 * a("jar")
    lignes.append(f"confiture: 8 mûres, 1 sucre, 2 bocaux {nombre(conf)} -> 2 pots {nombre(2 * (v('blackberry_jam') or 0))}")
    gel = 6 * (v("elderberry") or 0) + a("sugar") + 2 * a("jar")
    lignes.append(f"gelée: 6 grappes, 1 sucre, 2 bocaux {nombre(gel)} -> 2 pots {nombre(2 * (v('elder_jelly') or 0))}")
    lignes.append(f"noisettes: 8 noisettes {nombre(8 * (v('hazelnut') or 0))} -> 1 cornet {nombre(v('roasted_hazelnuts') or 0)}")
    pl = v("plank") or 0
    lignes.append(f"bois: arbre -> 2 rondins (sans prix) -> 8 planches {nombre(8 * pl)} -> (2 planches, 1 clou {nombre(2 * pl + a('nail'))}) 1 cagette {nombre(v('crate') or 0)}; (3 planches, 2 clous {nombre(3 * pl + 2 * a('nail'))}) 1 nichoir {nombre(v('nest_box') or 0)}")
    return lignes


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--donnees", default=DONNEES, help="dossier des données du jeu (par défaut celui du dépôt)")
    ap.add_argument("--chaines", action="store_true", help="imprime aussi les chaînes complètes, étape par étape")
    args = ap.parse_args()
    return imprimer(Donnees(args.donnees), args.chaines)


if __name__ == "__main__":
    sys.exit(main())
