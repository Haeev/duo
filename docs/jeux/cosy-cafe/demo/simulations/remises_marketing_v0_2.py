#!/usr/bin/env python3
"""Deux Tabliers, démo v0.2: remises et marketing, simulation courte (moins d'une seconde).

Le script relit les profils, la carte et les règles du jeu (`games/deux-tabliers/donnees/clientele/`)
et les deux tables proposées (`remises.json`, `marketing.json`) directement dans le document
`demo/remises-marketing-v0-2.md`, entre les marqueurs `<!-- donnees:remises -->` et
`<!-- donnees:marketing -->`: le document et la simulation ne peuvent pas diverger.

Modèle (au jour, pas client par client):
- la partie de référence est la partie médiane du duo médian de la démo v0.1 (`demo-v0-1.md`, 6.4),
  avec les coûts de la v0.2 (marchandise payée, charges 9 €): groupes servis, renvoyés, recettes,
  renommée, tasses, caisse. La demande d'un jour est servis / (1 - renvoyés), répartie entre les
  profils selon `groupsPerDay`, `dayFactors` et les événements;
- la salle a une capacité douce: servis = D / (1 + (D / C)^6)^(1/6), C = 42 groupes avant la
  terrasse, 46 après (ajusté sur les jours 10 à 14 de la référence);
- remises et marketing multiplient la demande d'un profil (facteur de prix du jeu, `priceBounds`,
  bonus de fidélité, facteur de marketing plafonné); chaque groupe en plus rapporte le ticket moyen
  du jour moins ses matières; la remise coûte sur tous les groupes concernés, même ceux qui
  seraient venus sans elle;
- la renommée suit les groupes servis (points par groupe du jour de référence) et la satisfaction
  des remises (`satisfactionWeight`); les tasses changent l'attrait des jours suivants
  (`cupFactors`);
- la terrasse s'achète le premier soir, à partir du jour 9, où la caisse dépasse 450 € plus la
  réserve; elle ouvre le lendemain.

Lancement depuis la racine du dépôt:
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/remises_marketing_v0_2.py
"""
from __future__ import annotations

import json
import math
import random
import re
import statistics
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[4]
JEU = RACINE / "games" / "deux-tabliers" / "donnees" / "clientele"
DOC = ICI.parent / "remises-marketing-v0-2.md"
PARTIES = 8
JOURS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

# Partie médiane du duo médian (demo-v0-1.md, 6.4): jour, servis, part renvoyée, recettes, renommée
# au soir, tasses au soir. Caisse au soir en v0.2: celle de la v0.1 moins l'écart médian de la v0.2
# (marchandise payée, port, dépannages, charges à 9 €), soit environ 12 € par jour ouvert.
REF = [
    (2, 23, 0.00, 153, 64, 1.5), (3, 28, 0.03, 181, 148, 1.8), (4, 21, 0.00, 137, 219, 2.0),
    (5, 30, 0.05, 180, 305, 2.0), (6, 30, 0.03, 245, 401, 2.0), (7, 28, 0.04, 242, 510, 2.5),
    (9, 28, 0.00, 201, 628, 2.5), (10, 34, 0.03, 249, 752, 2.5), (11, 34, 0.03, 223, 882, 2.5),
    (12, 35, 0.06, 241, 1025, 3.0), (13, 36, 0.09, 281, 1155, 3.0), (14, 44, 0.38, 295, 1425, 3.0),
]
CAISSE_V01 = {2: 63, 3: 99, 4: 108, 5: 100, 6: 160, 7: 211, 9: 333, 10: 441, 11: 204, 12: 113, 13: 264, 14: 473}
ECART_V02_PAR_JOUR = 12.5  # (2 058 - 2 208) / 12 jours ouverts, realisme-v0-2.md, section 5
TERRASSE, RESERVE, TERRASSE_JOUR_REF = 450, 53, 11
CAP_AVANT, CAP_APRES, K = 42.0, 46.0, 6
FETE = 14
EVT = {6: {"flaneurs": 1.2, "promeneurs": 1.1}, 14: "all:1.6"}
DUOS = {"Duo tranquille": 0.88, "Duo médian": 1.0, "Duo rapide": 1.08}


def lire_json_doc(nom: str) -> dict:
    texte = DOC.read_text(encoding="utf-8")
    m = re.search(rf"<!-- donnees:{nom} -->\s*```json\n(.*?)```", texte, re.S)
    if m is None:
        raise SystemExit(f"bloc {nom} introuvable dans {DOC.name}")
    return json.loads(m.group(1))


def fr(x: float, n: int = 0) -> str:
    return f"{x:,.{n}f}".replace(",", " ").replace(".", ",")


class Modele:
    def __init__(self) -> None:
        self.prof = {p["id"]: p for p in json.loads((JEU / "profils.json").read_text("utf-8"))["profiles"]
                     if p["groupsPerDay"] > 0}
        self.carte = json.loads((JEU / "carte.json").read_text("utf-8"))["recipes"]
        self.regles = json.loads((JEU / "regles.json").read_text("utf-8"))
        self.rem = lire_json_doc("remises")
        self.mkt = lire_json_doc("marketing")
        fam: dict[str, list[tuple[float, float]]] = {}
        for r in self.carte:
            fam.setdefault(r["family"], []).append((r["basePrice"], r["costMaterials"]))
        self.fam = {f: (statistics.mean(a for a, _ in v), statistics.mean(b for _, b in v)) for f, v in fam.items()}
        self.ticket = {p: self._ticket(self.prof[p]) for p in self.prof}

    def _choix(self, p: dict, familles: list[str]) -> dict[str, float]:
        w = {}
        for f in familles:
            if f not in self.fam:
                continue
            if f == p["mainCraving"]:
                w[f] = 3.0
            elif f in p["secondaryCravings"]:
                w[f] = 1.0
        s = sum(w.values())
        return {f: x / s for f, x in w.items()} if s else {}

    def _ticket(self, p: dict) -> dict:
        taille = sum(a * b for a, b in p["groupSizes"])
        boissons = self._choix(p, self.regles["drinks"]) or {"black_coffee": 1.0}
        manger = self._choix(p, self.regles["foods"])
        bp = sum(self.fam[f][0] * w for f, w in boissons.items())
        bm = sum(self.fam[f][1] * w for f, w in boissons.items())
        mp = sum(self.fam[f][0] * w for f, w in manger.items()) * p["eatsShare"] if manger else 0.0
        mm = sum(self.fam[f][1] * w for f, w in manger.items()) * p["eatsShare"] if manger else 0.0
        cafe = sum(w for f, w in boissons.items() if f in ("black_coffee", "milk_coffee"))
        cafe_prix = sum(self.fam[f][0] * w for f, w in boissons.items() if f in ("black_coffee", "milk_coffee"))
        envies = [p["mainCraving"], *p["secondaryCravings"]]
        part_boisson = sum(1 for f in envies if f in self.regles["drinks"] and f in self.fam) / max(
            1, sum(1 for f in envies if f in self.fam))
        return {"prix": taille * (bp + mp), "mat": taille * (bm + mm), "boisson": taille * bp,
                "taille": taille, "cafe": taille * cafe_prix, "part_boisson": part_boisson,
                "cafe_part": cafe}

    def part_heures(self, p: dict, debut: int, duree: int) -> float:
        w = {h: x for h, x in p["hourWeights"]}
        tot = sum(w.get(h, 0) for h in range(8, 18))
        return sum(w.get(h, 0) for h in range(debut, min(18, debut + duree))) / tot if tot else 0.0

    def facteur_prix(self, p: dict, indice: float) -> float:
        lo, hi = self.regles["priceBounds"]
        return max(lo, min(hi, 1 - p["priceSensitivity"] * (indice - 1)))

    def facteur_tasses(self, c: float) -> float:
        t = max(1.0, min(5.0, math.floor(c * 2) / 2))
        return next(f for x, f in self.regles["cupFactors"] if abs(x - t) < 1e-9)

    def bonus_sat(self, p: dict, indice: float) -> float:
        k = self.regles["satisfaction"]
        brut = max(-k["priceBound"], min(k["priceBound"], (1 - indice) * p["priceSensitivity"] * k["priceSlope"]))
        return brut * self.rem["satisfactionWeight"]


def tasses_de(renommee: float) -> float:
    k = 0
    while 150 * (k + 1) * (k + 2) / 2 <= renommee:
        k += 1
    return min(5.0, 1.5 + 0.5 * k)


def servis(d: float, c: float) -> float:
    return d / (1 + (d / c) ** K) ** (1 / K)


def facteur_marketing(m: Modele, campagnes: list[tuple[str, int]], jour: int, profil: str) -> tuple[float, dict[str, float]]:
    actions = {a["id"]: a for a in m.mkt["actions"]}
    contrib: dict[str, float] = {}
    for idx, (aid, lancee) in enumerate(campagnes):
        a = actions[aid]
        debut = date_effet(a, lancee)
        t = jour - debut
        if t < 0 or t >= a["durationDays"]:
            continue
        rep = 1.0
        for aid2, lancee2 in campagnes[:idx]:
            if aid2 == aid:
                fin2 = date_effet(a, lancee2) + a["durationDays"]
                if debut - fin2 < m.mkt["repeatCooldownDays"]:
                    rep = m.mkt["repeatFactor"]
        e = a["peak"] * 0.5 ** (t / a["halfLifeDays"]) * a["profiles"].get(profil, 0.0) * rep
        if e > 0:
            contrib[f"{aid}@{lancee}"] = e
    tot = sum(contrib.values())
    cap = m.mkt["maxBoost"]
    return 1 + cap * (1 - math.exp(-tot / cap)), contrib


def date_effet(a: dict, lancee: int) -> int:
    """Jour du premier effet d'une action lancée le soir du jour `lancee`."""
    if "publishWeekday" in a:
        cible = JOURS.index(a["publishWeekday"])
        bouclage = JOURS.index(a["deadlineWeekday"])
        j = lancee + 1
        while JOURS[(j - 1) % 7] != a["publishWeekday"]:
            j += 1
        # Après le bouclage (mardi soir), l'encart attend le numéro suivant.
        jour_semaine = (lancee - 1) % 7
        if jour_semaine > bouclage and jour_semaine < cible:
            j += 7
        return j
    return lancee + a["delayDays"]


def jouer(m: Modele, strat: dict, cap_echelle: float, graine: int) -> dict:
    rng = random.Random(graine)
    rem = m.rem
    renommee, tasses = 0.0, 1.5
    delta_caisse = 0.0
    terrasse_jour = None
    sortie = {"gain": 0.0, "cout_mkt": 0.0, "cout_remise": 0.0, "en_plus": 0.0, "par_action": {},
              "servis": 0.0, "fete_renvoyes": 0.0, "trois_tasses_j13": False, "terrasse": None,
              "renommee": 0.0, "minimum": 0.0}
    for aid, jour in strat.get("marketing", []):
        cout = next(a for a in m.mkt["actions"] if a["id"] == aid)["cost"]
        sortie["cout_mkt"] += cout
    if strat.get("fidelite"):
        sortie["cout_mkt"] += rem["loyaltyCard"]["price"]
    jours_fid = 0
    for (jour, s_ref, r_ref, rec_ref, ren_ref, tas_ref) in REF:
        wd = JOURS[(jour - 1) % 7]
        wdi = (jour - 1) % 7
        d_ref = s_ref / (1 - r_ref)
        poids = {}
        for pid, p in m.prof.items():
            f = p["groupsPerDay"] * p["dayFactors"][wdi - 1]
            evt = EVT.get(jour)
            if isinstance(evt, dict):
                f *= evt.get(pid, 1.0)
            poids[pid] = f
        tot = sum(poids.values())
        ticket_ref = rec_ref / s_ref
        moy = sum(poids[p] / tot * m.ticket[p]["prix"] for p in poids)
        echelle = ticket_ref / moy
        tasses_ref_matin = REF[REF.index((jour, s_ref, r_ref, rec_ref, ren_ref, tas_ref)) - 1][5] if jour > 2 else 1.5
        att_tasses = m.facteur_tasses(tasses) / m.facteur_tasses(tasses_ref_matin)
        cap = (CAP_APRES if terrasse_jour is not None and jour > terrasse_jour else CAP_AVANT) * cap_echelle
        cap_ref = (CAP_APRES if jour > TERRASSE_JOUR_REF else CAP_AVANT) * cap_echelle
        demande_base, demande = {}, {}
        cout_remise, bonus_ren, part_mkt = {}, 0.0, {}
        if strat.get("fidelite"):
            jours_fid += 1
        for pid, p in m.prof.items():
            db = d_ref * poids[pid] / tot
            t = m.ticket[pid]
            mult, cr, sat = 1.0, 0.0, 0.0
            hh = strat.get("happy")
            if hh and wd in hh["days"]:
                part = m.part_heures(p, hh["start"], hh["length"])
                # Pendant le créneau, l'indice se lit sur les lignes remisées (ce qu'annonce l'ardoise).
                indice = 1 - hh["rate"]
                fm = m.facteur_prix(p, indice)
                mult *= 1 + part * (fm - 1)
                cr += part * hh["rate"] * t["boisson"]
                sat += part * m.bonus_sat(p, indice)
            for pr in rem["profileRates"]:
                taux = strat.get("tarifs", {}).get(pr["id"])
                jours_tarif = strat.get("jours_tarif", pr["defaultDays"])
                if taux and pr["profile"] == pid and wd in jours_tarif:
                    mult *= m.facteur_prix(p, 1 - taux)
                    cr += taux * t["prix"]
                    sat += m.bonus_sat(p, 1 - taux)
            if strat.get("fidelite") and pid in rem["loyaltyCard"]["profiles"]:
                lc = rem["loyaltyCard"]
                porteurs = min(lc["holderShareMax"], lc["holderShareStart"] + lc["holderSharePerDay"] * (jours_fid - 1))
                mult *= 1 + lc["attractionBonusMax"] * porteurs / lc["holderShareMax"]
                cafe_moyen = t["cafe"] / max(1e-9, t["cafe_part"] * t["taille"]) if t["cafe_part"] else 0.0
                cr += porteurs * t["taille"] * t["cafe_part"] / (lc["stamps"] + 1) * cafe_moyen
                sat += porteurs / (lc["stamps"] + 1) * lc["freeSatisfaction"]
            fmk, contrib = facteur_marketing(m, strat.get("marketing", []), jour, pid)
            mult *= fmk
            demande_base[pid] = db
            demande[pid] = db * mult * att_tasses
            cout_remise[pid] = cr * echelle
            part_mkt[pid] = (fmk, contrib)
            sat_bonus = sat
            bonus_ren += demande[pid] * max(0.0, sat_bonus) / 10
        bruit = rng.gauss(1.0, 0.06)
        d_tot_base = sum(demande_base.values())
        d_tot = sum(demande.values()) * bruit
        s_base = servis(d_tot_base * bruit, cap_ref) * (s_ref / servis(d_tot_base, cap_ref))
        s = servis(d_tot, cap) * (s_ref / servis(d_tot_base, cap_ref))
        ratio = s / max(1e-9, sum(demande.values()) * bruit)
        ratio_base = s_base / max(1e-9, d_tot_base * bruit)
        # Chaque groupe en plus vaut le ticket de son profil (mis à l'échelle du jour), moins ses matières.
        marge = {p: m.ticket[p]["prix"] * echelle * (1 - m.ticket[p]["mat"] / m.ticket[p]["prix"]) for p in m.prof}
        remise = sum(cout_remise[p] * demande[p] * bruit * ratio for p in m.prof)
        gain = sum((demande[p] * ratio - demande_base[p] * ratio_base) * bruit * marge[p] for p in m.prof) - remise
        for pid in m.prof:
            fmk, contrib = part_mkt[pid]
            if fmk > 1:
                venus = demande[pid] * bruit * ratio * (fmk - 1) / fmk
                st = sum(contrib.values())
                for k, v in contrib.items():
                    sortie["par_action"][k] = sortie["par_action"].get(k, 0.0) + venus * v / st
        pts_groupe = (ren_ref - (REF[REF.index((jour, s_ref, r_ref, rec_ref, ren_ref, tas_ref)) - 1][4] if jour > 2 else 0)) / s_ref
        renommee += pts_groupe * s + bonus_ren * ratio
        tasses = tasses_de(renommee)
        delta_caisse += gain
        sortie["gain"] += gain
        sortie["cout_remise"] += remise
        sortie["en_plus"] += s - s_base
        sortie["servis"] += s
        if jour == FETE:
            sortie["fete_renvoyes"] = 1 - s / (sum(demande.values()) * bruit)
        if jour == 13:
            sortie["trois_tasses_j13"] = tasses >= 3.0
        # Caisse du soir: référence v0.2, sans le paiement de la terrasse de la référence, plus l'écart.
        ref = CAISSE_V01[jour] - ECART_V02_PAR_JOUR * (REF.index((jour, s_ref, r_ref, rec_ref, ren_ref, tas_ref)) + 1)
        if jour >= TERRASSE_JOUR_REF:
            ref += TERRASSE
        cout_mkt_a_date = sum(next(a for a in m.mkt["actions"] if a["id"] == aid)["cost"]
                              for aid, j in strat.get("marketing", []) if j <= jour)
        if strat.get("fidelite"):
            cout_mkt_a_date += rem["loyaltyCard"]["price"]
        caisse = ref + delta_caisse - cout_mkt_a_date - (TERRASSE if terrasse_jour is not None else 0)
        sortie["minimum"] = min(sortie["minimum"], delta_caisse - cout_mkt_a_date)
        if terrasse_jour is None and jour >= 9 and caisse >= TERRASSE + RESERVE:
            terrasse_jour = jour
    sortie["terrasse"] = terrasse_jour
    sortie["renommee"] = renommee - REF[-1][4]
    sortie["net"] = sortie["gain"] - sortie["cout_mkt"]
    return sortie


STRATEGIES = {
    "Rien (référence)": {},
    "Heure douce 15 h à 17 h, -20 %, mardi à vendredi": {"happy": {"start": 15, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri"]}},
    "Heure douce 15 h à 17 h, -20 %, tous les jours": {"happy": {"start": 15, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri", "sat", "sun"]}},
    "Heure douce 8 h à 10 h, -20 %, mardi à vendredi (heure de pointe)": {"happy": {"start": 8, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri"]}},
    "Heure douce 15 h à 17 h, -30 %, mardi à vendredi": {"happy": {"start": 15, "length": 2, "rate": 0.3, "days": ["tue", "wed", "thu", "fri"]}},
    "Carte de fidélité dès le jour 2": {"fidelite": True},
    "Tarif randonneur -10 %, mardi à vendredi": {"tarifs": {"randonneurs": 0.10}},
    "Tarif randonneur -20 %, mardi à vendredi": {"tarifs": {"randonneurs": 0.20}},
    "Tarif randonneur -10 %, tous les jours": {"tarifs": {"randonneurs": 0.10}, "jours_tarif": ["tue", "wed", "thu", "fri", "sat", "sun"]},
    "Affiche chez Lucas, soirs 2 et 9": {"marketing": [("affiche_boulangerie", 2), ("affiche_boulangerie", 9)]},
    "Affiche à la mairie-école, soir 2": {"marketing": [("affiche_mairie", 2)]},
    "Prospectus au marché, soir 5 (samedi 6)": {"marketing": [("prospectus_marche", 5)]},
    "Prospectus au marché, soir 12 (samedi 13)": {"marketing": [("prospectus_marche", 12)]},
    "Encart dans L'Écho, soir 2 (paraît jeudi 4)": {"marketing": [("encart_echo", 2)]},
    "Encart dans L'Écho, soir 9 (paraît jeudi 11)": {"marketing": [("encart_echo", 9)]},
    "Tout, tout le temps": {"happy": {"start": 15, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri", "sat", "sun"]},
                             "fidelite": True, "tarifs": {"randonneurs": 0.15},
                             "marketing": [("affiche_boulangerie", 2), ("affiche_mairie", 2), ("encart_echo", 2),
                                           ("prospectus_marche", 5), ("affiche_boulangerie", 9), ("encart_echo", 9),
                                           ("prospectus_marche", 12)]},
    "Panachage réfléchi": {"happy": {"start": 15, "length": 2, "rate": 0.2, "days": ["tue", "wed", "thu", "fri"]},
                           "fidelite": True,
                           "marketing": [("affiche_mairie", 2), ("encart_echo", 2), ("prospectus_marche", 5)]},
}


def offre_du_jour(m: Modele) -> list[str]:
    """Une tarte de 8 parts à finir demain: vendre en offre du jour, ou laisser filer ?"""
    rng = random.Random(7)
    od = m.rem["dailyOffer"]
    prix, revient = next((r["basePrice"], r["costMaterials"]) for r in m.carte if r["id"] == "tarte_fruits")
    lignes = ["| Parts à finir demain | Ventes habituelles de tarte ce jour-là | Sans offre: recette des vieilles parts, perte | Offre -30 %: recette, perte | Écart de caisse avec l'offre |",
              "|---|---|---|---|---|"]
    for reste, mu in ((2, 3.0), (4, 3.0), (6, 3.0), (6, 1.5), (8, 1.5)):
        sans, avec, ps, pa = [], [], [], []
        for _ in range(4000):
            # Vente sans offre: ventes habituelles, le plus ancien lot part d'abord (premier entré, premier sorti).
            v = poisson(rng, mu)
            vs = min(reste, v)
            sans.append(vs * prix)
            ps.append((reste - vs) * revient)
            # Avec l'offre: poids de la famille +1 (secondaire 1 -> 2) et tirage x2 dans la famille,
            # facteur de prix d'un gourmand (sensibilité 0,7) sur la recette: environ x1,9 de ventes.
            mult = (1 + od["familyWeightBonus"] / 2) * (od["pickWeight"] / 1.5) * min(1.25, 1 + 0.7 * od["default"])
            va = min(reste, poisson(rng, mu * mult))
            # Toutes les parts vendues ce jour-là sont des vieilles parts (premier entré, premier sorti),
            # payées au prix de l'offre, y compris celles qui se seraient vendues de toute façon.
            avec.append(va * prix * (1 - od["default"]))
            pa.append((reste - va) * revient)
        s, a = statistics.mean(sans), statistics.mean(avec)
        lignes.append(f"| {reste} | {fr(mu, 1)} | {fr(s, 2)} €, {fr(statistics.mean(ps), 2)} € | {fr(a, 2)} €, {fr(statistics.mean(pa), 2)} € | {'+' if a - s >= 0 else ''}{fr(a - s, 2)} € |")
    return lignes


def poisson(rng: random.Random, lam: float) -> int:
    lim, k, prod = math.exp(-lam), 0, 1.0
    while True:
        prod *= rng.random()
        if prod <= lim:
            return k
        k += 1


def main() -> int:
    m = Modele()
    print("[tickets moyens par groupe, prix conseillés, avant mise à l'échelle du jour]")
    for p, t in m.ticket.items():
        print(f"  {p}: {fr(t['prix'], 2)} €, matières {fr(t['mat'], 2)} €, part des boissons dans les envies {fr(t['part_boisson'], 2)}")
    for duo, ech in DUOS.items():
        print(f"\n[{duo}, {PARTIES} parties, médianes sur les 12 jours ouverts]")
        print("| Stratégie | Coût des actions | Remises consenties | Groupes en plus | Gain net sur la démo | Renommée en plus | Terrasse achetée le soir | Trois tasses au soir 13 | Renvoyés à la fête |")
        print("|---|---|---|---|---|---|---|---|---|")
        for nom, st in STRATEGIES.items():
            res = [jouer(m, st, ech, 2000 + g) for g in range(PARTIES)]
            # Renommée comparée à la partie sans rien, même graine (le modèle au jour n'est pas exact au point près).
            for g, r in enumerate(res):
                r["renommee"] -= jouer(m, {}, ech, 2000 + g)["renommee"]
            med = lambda k: statistics.median(r[k] for r in res)  # noqa: E731
            terr = statistics.median(r["terrasse"] if r["terrasse"] is not None else 99 for r in res)
            trois = sum(1 for r in res if r["trois_tasses_j13"])
            print(f"| {nom} | {fr(med('cout_mkt'))} € | {fr(med('cout_remise'))} € | {'+' if med('en_plus') >= 0 else ''}{fr(med('en_plus'), 1)} | {'+' if med('net') >= 0 else ''}{fr(med('net'))} € | {'+' if med('renommee') >= 0 else ''}{fr(med('renommee'))} | {'jamais' if terr == 99 else fr(terr)} | {trois} sur {PARTIES} | {fr(100 * med('fete_renvoyes'))} % |")
    print("\n[clients venus grâce à chaque action, duo médian, graine 2000]")
    print("| Action (soir de lancement) | Coût | Clients venus (compteur du bilan) | Coût par client venu | Marge rapportée |")
    print("|---|---|---|---|---|")
    vus = set()
    for nom, st in STRATEGIES.items():
        for aid, j in st.get("marketing", []):
            if (aid, j) in vus or nom == "Tout, tout le temps" or nom == "Panachage réfléchi":
                continue
            vus.add((aid, j))
            r = jouer(m, {"marketing": [(aid, j)]}, 1.0, 2000)
            venus = r["par_action"].get(f"{aid}@{j}", 0.0)
            cout = next(a for a in m.mkt["actions"] if a["id"] == aid)["cost"]
            print(f"| {aid} (soir {j}) | {fr(cout)} € | {fr(venus, 1)} | {fr(cout / venus, 2) if venus else '-'} € | {fr(r['gain'])} € |")
    print("\n[offre du jour sur une tarte de 8 parts, 4 000 tirages par ligne]")
    print("\n".join(offre_du_jour(m)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
