#!/usr/bin/env python3
"""Deux Tabliers, démo v0.2: effet des règles « gestion réaliste » (P0) sur l'économie de la démo.

Reprend la démo v0.1 (`demo_v0_1.py`, mêmes duos, mêmes ordres d'achat, même service client par
client de `cosy_cafe.py`) et remplace le seul calcul du coût des matières:
- v0.1: le coût de chaque recette vendue est débité à la vente, la livraison est gratuite, rien ne
  se périme (sauf le panier du soir, qui rapporte de la réputation);
- v0.2: la marchandise est payée à la livraison, carton par carton; chaque fournisseur a ses jours
  de passage, son port et son franco; chaque carton est un lot daté (DLC), consommé dans l'ordre
  d'arrivée; ce qui passe sa date est perdu; une rupture se rattrape par un dépannage (+30 %).

Les ingrédients, recettes et conditionnements sont lus dans les données du jeu
(`games/deux-tabliers/donnees/clientele/`), puis les valeurs proposées par `realisme-v0-2.md`
(table `V02` ci-dessous) les remplacent. Consigne du client (2026-11-04): simulation courte,
4 parties par duo et par ordre d'achat.

Lancement depuis la racine du dépôt:
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/demo_v0_2.py
"""
from __future__ import annotations

import importlib.util
import json
import math
import statistics
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[4]
JEU = RACINE / "games" / "deux-tabliers" / "donnees" / "clientele"
PARTIES = 4

JOURS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
JOURS_OUVERTS = [2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14]
FETE = (14, 1.6)  # jour, affluence annoncée (economie.json, challenge)

# Valeurs proposées pour la v0.2 (identiques aux tables P0-2 et P0-3 du document).
V02 = {
    "suppliers": {
        "lucas": {"days": ["tue", "wed", "thu", "fri", "sat", "sun"], "franco": 0, "shipping": 0},
        "armelle": {"days": ["tue", "thu", "sat"], "franco": 15, "shipping": 3},
        "joseph": {"days": ["tue", "fri"], "franco": 30, "shipping": 5},
        "mireille": {"days": ["tue", "wed", "thu", "fri", "sat", "sun"], "franco": 0, "shipping": 0},
        "simone_jardin": {"days": ["tue", "wed", "thu", "fri", "sat", "sun"], "franco": 0, "shipping": 0},
    },
    "shelfDays": {
        "lait_avoine": 30, "beurre": 30, "oeufs": 28, "cacao": 180, "the_noir": 365, "the_vert": 365,
        "oranges": 14, "citrons": 21, "pain_campagne": 2, "tarte_boulanger": 2,
    },
    "margin": 1.2,
    "freshMargin": 1.1,
    "freshMaxShelfDays": 2,
    "emergencySurcharge": 0.3,
    "chargesPerOpenDay": 9.0,
    # Simone laisse sa réserve: ce qui se garde plus d'une semaine arrive gratuit le jour 2.
    "giftMinShelfDays": 8,
    "forecast": "mean",
}


def charger_v01():
    spec = importlib.util.spec_from_file_location("demo_v0_1", ICI / "demo_v0_1.py")
    assert spec and spec.loader
    d1 = importlib.util.module_from_spec(spec)
    sys.modules["demo_v0_1"] = d1
    spec.loader.exec_module(d1)
    spec2 = importlib.util.spec_from_file_location("cosy_cafe", d1.SIM)
    assert spec2 and spec2.loader
    cc = importlib.util.module_from_spec(spec2)
    sys.modules["cosy_cafe"] = cc
    spec2.loader.exec_module(cc)
    return d1, cc


class Stock:
    """Lots datés par ingrédient: [quantité, dernier jour utilisable]."""

    def __init__(self, ings: dict, rec: dict, v02: dict) -> None:
        self.ings, self.rec, self.v = ings, rec, v02
        self.lots: dict[str, list[list[float]]] = {i: [] for i in ings}
        self.usage: list[dict[str, float]] = []
        self.k = 0  # rang du jour ouvert
        self.journal: list[dict] = []

    def dispo(self, ing: str, jusqua: int) -> float:
        return sum(q for q, last in self.lots[ing] if last >= jusqua)

    def couverture(self, sup: str, jour: int) -> list[int]:
        """Jours ouverts couverts par une livraison du jour: jusqu'à la prochaine du même fournisseur."""
        days = self.v["suppliers"][sup]["days"]
        out = []
        for j in range(jour, jour + 8):
            if j != jour and JOURS[(j - 1) % 7] in days:
                break
            if j in JOURS_OUVERTS or j > 14:
                out.append(j)
        return out

    def matin(self, jour: int, carte: list[str]) -> dict:
        r = {"jour": jour, "livre": 0.0, "port": 0.0, "perdu": 0.0, "depannage": 0.0, "ruptures": 0, "panier": 0.0}
        for ing, lots in self.lots.items():
            for q, last in lots:
                if last < jour:
                    r["perdu"] += q * self.ings[ing]["unitCost"]
            self.lots[ing] = [l for l in lots if l[1] >= jour]
        # besoin moyen d'un jour ouvert: trois derniers jours, sinon 14 portions par recette de l'ardoise
        if self.usage:
            der = self.usage[-3:]
            if self.v["forecast"] == "max":
                use = {i: max(u.get(i, 0) for u in der) for i in self.ings}
            else:
                use = {i: sum(u.get(i, 0) for u in der) / len(der) for i in self.ings}
        else:
            use = {i: 0.0 for i in self.ings}
        # comme `suggestedOrder`: un ingrédient sans historique prend la base de l'ardoise
        base = {i: 0.0 for i in self.ings}
        for rid in carte:
            for ing, q in self.rec.get(rid, []):
                base[ing] += 14 * q
        use = {i: use[i] if use[i] > 0 else base[i] for i in self.ings}
        par_four: dict[str, float] = {}
        for ing, x in self.ings.items():
            sup = x["supplier"]
            if JOURS[(jour - 1) % 7] not in self.v["suppliers"][sup]["days"] or use[ing] <= 0:
                continue
            cover = self.couverture(sup, jour)
            frais = x["shelfDays"] <= self.v["freshMaxShelfDays"]
            marge = self.v["freshMargin"] if frais else self.v["margin"]
            jours_utiles = [j for j in cover if j <= jour + x["shelfDays"] - 1]
            besoin = sum(use[ing] * (FETE[1] if j == FETE[0] else 1.0) for j in jours_utiles) * marge
            manque = besoin - self.dispo(ing, max(jours_utiles) if jours_utiles else jour)
            n = math.ceil(manque / x["cartonUnits"]) if manque > 0 else 0
            if n:
                self.lots[ing].append([n * x["cartonUnits"], jour + x["shelfDays"] - 1])
                cout = n * x["cartonUnits"] * x["unitCost"]
                if not self.usage and x["shelfDays"] >= self.v["giftMinShelfDays"]:
                    r["offert"] = r.get("offert", 0.0) + cout
                    continue
                r["livre"] += cout
                par_four[sup] = par_four.get(sup, 0.0) + cout
        for sup, total in par_four.items():
            s = self.v["suppliers"][sup]
            if total < s["franco"]:
                r["port"] += s["shipping"]
        return r

    def vendre(self, r: dict, ventes: list[str], jour: int) -> None:
        use: dict[str, float] = {}
        for rid in ventes:
            for ing, q in self.rec.get(rid, []):
                use[ing] = use.get(ing, 0) + q
                reste = q
                for lot in self.lots[ing]:
                    pris = min(lot[0], reste)
                    lot[0] -= pris
                    reste -= pris
                    if reste <= 1e-9:
                        break
                self.lots[ing] = [l for l in self.lots[ing] if l[0] > 1e-9]
                if reste > 1e-9:
                    x = self.ings[ing]
                    r["ruptures"] += 1
                    r["depannage"] += x["cartonUnits"] * x["unitCost"] * (1 + self.v["emergencySurcharge"])
                    self.lots[ing].append([x["cartonUnits"] - reste, jour + x["shelfDays"] - 1])
        self.usage.append(use)
        # soir: le panier reçoit les pièces du boulanger qui finissent ce soir (perdues pour la caisse)
        for ing, lots in self.lots.items():
            x = self.ings[ing]
            if x["supplier"] == "lucas" and x["unit"] == "piece":
                r["panier"] += sum(q * x["unitCost"] for q, last in lots if last == jour)
        self.journal.append(r)


def main() -> int:
    for a in sys.argv[1:]:
        k, _, v = a.partition("=")
        V02[k] = v if k == "forecast" else float(v)
    d1, cc = charger_v01()
    four = json.loads((JEU / "fournisseurs.json").read_text(encoding="utf-8"))
    carte = json.loads((JEU / "carte.json").read_text(encoding="utf-8"))
    ings = {i["id"]: dict(i) for i in four["ingredients"]}
    for k, v in V02["shelfDays"].items():
        ings[k]["shelfDays"] = v
    rec = {r["id"]: [(a, b) for a, b in r["ingredients"]] for r in carte["recipes"]}
    d = d1.charger(cc)
    mode = {"v": "v01", "stock": None}

    orig_enc = cc.Service.encaisser
    orig_bilan = cc.Service.bilan

    def encaisser(self, c):
        orig_enc(self, c)
        self.__dict__.setdefault("ventes", []).extend(a.recette.id for a in c.articles)

    def bilan(self):
        b = orig_bilan(self)
        st: Stock | None = mode["stock"]
        if st is None:
            return b
        jour = JOURS_OUVERTS[st.k]
        st.k += 1
        r = st.matin(jour, list(self.cfg.etat.carte))
        st.vendre(r, self.__dict__.get("ventes", []), jour)
        r["cout_v01"] = b["cout"]
        r["recette"] = b["recette"]
        b = dict(b)
        b["cout"] = r["livre"] + r["port"] + r["depannage"]
        return b

    cc.Service.encaisser = encaisser
    cc.Service.bilan = bilan

    def partie(duo, ordre, g, v02: bool):
        dd = dict(d)
        if v02:
            dd["eco"] = dict(d["eco"], chargesPerOpenDay=V02["chargesPerOpenDay"])
            mode["stock"] = Stock(ings, rec, V02)
        else:
            mode["stock"] = None
        m = d1.jouer(cc, duo, ordre, 1000 + g, dd)
        return m, mode["stock"]

    ordres = ("equilibre", "decor", "coin_du_feu", "machines")
    lignes = ["| Duo | Ordre d'achat | Version | Gagné en 12 jours | Dépensé en achats | Caisse au jour 15 | Terrasse pour la fête | Trois tasses avant la fête | Pièce du fond pour la fête |",
              "|---|---|---|---|---|---|---|---|---|"]
    detail = {}
    fr = d1.fr
    for duo in cc.DUOS:
        for ordre in ordres:
            for v02 in (False, True):
                res = [partie(duo, ordre, g, v02) for g in range(PARTIES)]
                ms = [m for m, _ in res]
                gains = statistics.median(sum(j.get("net", 0) for j in m.journal) for m in ms)
                dep = statistics.median(sum(p for _, _, p in m.achats) for m in ms)
                caisse = statistics.median(m.journal[-1]["caisse"] for m in ms)
                terr = sum(1 for m in ms if any(i == "village_terrasse" and j <= 13 for j, i, _ in m.achats))
                trois = sum(1 for m in ms if m.journal[12]["tasses"] >= 3.0)
                fond = sum(1 for m in ms if any(i == "village_fond" and j <= 12 for j, i, _ in m.achats))
                lignes.append(f"| {duo.nom} | {ordre} | {'v0.2' if v02 else 'v0.1'} | {fr(gains)} € | {fr(dep)} € | {fr(caisse)} € | {terr} sur {PARTIES} | {trois} sur {PARTIES} | {fond} sur {PARTIES} |")
                if v02 and ordre == "equilibre":
                    detail[duo.nom] = [s for _, s in res]
    print("[synthese]")
    print("\n".join(lignes))
    print("\n[stock, ordre équilibre, médianes par partie sur 12 jours ouverts]")
    print("| Duo | Coût des ventes v0.1 | Marchandise livrée | Port | Dépannages | Ruptures rattrapées | Périmé jeté | Panier du soir (valeur) | Pertes / livré |")
    print("|---|---|---|---|---|---|---|---|---|")
    for nom, sts in detail.items():
        def med(k):
            return statistics.median(sum(r[k] for r in s.journal) for s in sts)
        livre = med("livre")
        pertes = statistics.median(sum(r["perdu"] + r["panier"] for r in s.journal) for s in sts)
        print(f"| {nom} | {fr(med('cout_v01'))} € | {fr(livre)} € | {fr(med('port'))} € | {fr(med('depannage'))} € | {fr(med('ruptures'))} | {fr(med('perdu'))} € | {fr(med('panier'))} € | {fr(100 * pertes / livre)} % |")
    print("\n[journal du duo médian, ordre équilibre, graine 1000]")
    print("| Jour | Livré | Port | Dépannage | Ruptures | Périmé (matin) | Panier (soir) | Coût des ventes v0.1 | Recette |")
    print("|---|---|---|---|---|---|---|---|---|")
    for r in detail["Duo médian"][0].journal:
        print(f"| {r['jour']} | {fr(r['livre'], 2)} € | {fr(r['port'])} € | {fr(r['depannage'], 2)} € | {r['ruptures']} | {fr(r['perdu'], 2)} € | {fr(r['panier'], 2)} € | {fr(r['cout_v01'], 2)} € | {fr(r['recette'])} € |")
    return 0


if __name__ == "__main__":
    sys.exit(main())
