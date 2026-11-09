#!/usr/bin/env python3
"""Deux Tabliers, démo v0.3: le départ dans une cellule vide (conception `depart-cellule-vide-v0-3.md`).

Question posée: avec une épargne de départ et un local vide, les paniers d'ouverture du document
mènent-ils à des premières semaines « amusantes mais exigeantes » ? On compare chaque panier au
départ de la v0.2 (café équipé, 300 € de caisse, réserve de Simone offerte).

Ce que le script reprend sans le changer:
- le service client par client de `simulations/cosy_cafe.py` et les duos simulés;
- la démo v0.1 (`demo_v0_1.py`: calendrier, événements, ordres d'achat, réputation, ambiance);
- le stock réaliste de la v0.2 (`demo_v0_2.py`: livraison payée, jours de passage, port, lots datés,
  dépannage à +30 %).

Ce qu'il change (section 6 du document):
- caisse au soir du jour 1 = épargne - panier d'ouverture; aucune réserve offerte (Simone ne donne
  qu'un sac de grains et une bouteille de lait pour le café d'essai);
- postes, vaisselle, places et décor de départ selon le panier;
- machine révisée: pas de panne au jour 6, fenêtre « Parfait » plus large (gestes parfaits + 0,15),
  deux buses vapeur en état (poste vapeur au niveau 2, le pichet thermomètre ne lui apporte plus rien);
- le robot rachète d'abord des places tant que la salle en a moins de 8 (lot de Simone, puis neuf).

Consigne du client (2026-11-04): simulation courte. 4 parties par duo et par panier, quelques secondes.
Lancement depuis la racine du dépôt:
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/depart_v0_3.py
  python3 -I -B docs/jeux/cosy-cafe/demo/simulations/depart_v0_3.py epargne=1500   (sensibilité)
"""
from __future__ import annotations

import dataclasses
import importlib.util
import random
import statistics
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
PARTIES = 4

EPARGNE = 1800.0

# Pièces du lot de Simone (sous la bâche): prix, charme plein, style, places apportées.
LOT_SIMONE = {"chaise_paillee": (10.0, 8), "gueridon_marbre": (25.0, 3), "table_carree": (25.0, 1)}

# Paniers d'ouverture (section 3 du document). `places` = places assises en salle.
PANIERS = {
    "debrouille": {
        "nom": "Débrouille",
        "achats": [("machine_vieille_dame", 450), ("moulin_simple", 140), ("terminal_caisse", 80), ("vaisselle_simone", 30),
                   ("frigo_occasion", 180), ("bouilloire", 25), ("cloche_viennoiseries", 35),
                   ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10),
                   ("simone:gueridon_marbre", 25), ("simone:gueridon_marbre", 25)],
        "machine": "vieille", "vaisselle": 24, "places": 4,
    },
    "simone": {
        "nom": "Le café de Simone",
        "achats": [("machine_vieille_dame", 450), ("moulin_simple", 140), ("terminal_caisse", 80), ("service_blanc", 110),
                   ("frigo_occasion", 180), ("bouilloire", 25), ("cloche_viennoiseries", 35)]
                  + [("simone:chaise_paillee", 10)] * 8 + [("simone:gueridon_marbre", 25)] * 3 + [("simone:table_carree", 25)]
                  + [("peinture_lin", 40), ("peinture_lin", 40), ("bouquet_champetre", 12)],
        "machine": "vieille", "vaisselle": 36, "places": 8,
    },
    "belle_machine": {
        "nom": "La belle machine",
        "achats": [("machine_revisee", 800), ("moulin_simple", 140), ("terminal_caisse", 80), ("vaisselle_simone", 30),
                   ("frigo_occasion", 180), ("bouilloire", 25), ("cloche_viennoiseries", 35),
                   ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10), ("simone:chaise_paillee", 10),
                   ("simone:gueridon_marbre", 25), ("simone:gueridon_marbre", 25)],
        "machine": "revisee", "vaisselle": 24, "places": 4,
    },
    "coup_de_coeur": {
        "nom": "Coup de cœur",
        "achats": [("machine_vieille_dame", 450), ("moulin_simple", 140), ("terminal_caisse", 80), ("service_blanc", 110),
                   ("frigo_occasion", 180), ("bouilloire", 25), ("cloche_viennoiseries", 35)]
                  + [("chaise_paillee", 45)] * 6 + [("gueridon_marbre", 110)] * 3 + [("suspension_osier", 70)],
        "machine": "vieille", "vaisselle": 36, "places": 6,
    },
}


def charger():
    spec = importlib.util.spec_from_file_location("demo_v0_2", ICI / "demo_v0_2.py")
    assert spec and spec.loader
    d2 = importlib.util.module_from_spec(spec)
    sys.modules["demo_v0_2"] = d2
    spec.loader.exec_module(d2)
    d1, cc = d2.charger_v01()
    return d2, d1, cc


def decor_du_panier(panier: dict, items: dict, worn: float) -> tuple[list, int]:
    """Décor de départ: l'applique scellée (usée, elle reste avec le local) et les pièces du panier."""
    deco = [("applique_laiton", items["applique_laiton"]["charm"] * worn, items["applique_laiton"]["style"], "salle")]
    lumieres = 1
    for iid, _ in panier["achats"]:
        usee = iid.startswith("simone:")
        base = iid.split(":", 1)[1] if usee else iid
        if base == "table_carree":
            base = "table_ferme"  # même charme et même style dans les données de la démo
        if base not in items:
            continue  # équipement, pas du décor
        it = items[base]
        ch = it["charm"] * (3 if it["category"] in ("paint", "wallpaper") else 1) * (worn if usee else 1)
        deco.append((base, ch, it["style"], "salle"))
        if it["category"] == "light":
            lumieres += 1
    return deco, lumieres


def jouer(cc, d1, d2, duo, panier_id: str | None, graine: int, d: dict, ings: dict, rec: dict, mode: dict):
    """Démo v0.1 jouée jour par jour, départ remplacé par le panier (None: départ de la v0.2)."""
    eco, cat, eqp = d["eco"], d["cat"], d["eqp"]
    rng = random.Random(graine)
    items = {x["id"]: x for x in cat["items"]}
    achats = {x["id"]: x for x in eqp["purchases"]}
    exts = {x["id"]: x for x in eqp["extensions"]}
    paliers = {p["id"]: p for p in eqp["tiers"]}
    worn = eco["ambiance"]["wornCharmFactor"]
    v02 = dict(d2.V02)
    st = d2.Stock(ings, rec, v02)
    mode["stock"] = st
    if panier_id is None:
        m = d1.Maison(caisse=eco["startCash"])
        m.niveaux = {k: v for k, v in eqp["stationsAtStart"].items() if k in cc.POSTES_BAR | cc.POSTES_CUISINE}
        for f in cat["startFurniture"]:
            it = items[f["id"]]
            for _ in range(f["count"]):
                m.deco.append((f["id"], it["charm"] * (worn if f["worn"] else 1), it["style"], "salle"))
        lot_restant = {}
        machine = "vieille"
    else:
        p = PANIERS[panier_id]
        cout = sum(prix for _, prix in p["achats"])
        m = d1.Maison(caisse=EPARGNE - cout)
        m.niveaux = {"espresso": 1, "vapeur": 1, "bouilloire": 1, "vitrine": 1, "plan": 1, "frigo": 1}
        m.places = [0, p["places"], 0, 2]
        m.vaisselle = p["vaisselle"]
        m.deco, m.lumieres = decor_du_panier(p, items, worn)
        pris = {k: sum(1 for i, _ in p["achats"] if i == f"simone:{k}") for k in LOT_SIMONE}
        lot_restant = {k: n - pris[k] for k, (_, n) in LOT_SIMONE.items()}
        machine = p["machine"]
        if machine == "revisee":
            duo = dataclasses.replace(duo, parfait=min(0.9, duo.parfait + 0.15))
            m.niveaux["vapeur"] = 2
        # le sac de grains de Simone, entamé par le café d'essai, sert dès le mardi (le lait d'essai est bu)
        st.lots["grains_maison"].append([1000 - 7, 1 + ings["grains_maison"]["shelfDays"] - 1])
    v02["giftMinShelfDays"] = 10 ** 6 if panier_id is not None else d2.V02["giftMinShelfDays"]
    st.v = v02
    m.connues = {r["id"] for r in d["rec"]["recipes"] if r["unlock"]["kind"] == "start"}
    adr = cc.ADR["village"]
    loyer = eco["rentPerMonth"] / eco["rentDaysPerMonth"]
    charges = d2.V02["chargesPerOpenDay"]
    envies = list(d1.ENVIES["equilibre"])
    chaises_usees = sum(1 for i, _, _, _ in m.deco if i == "chaise_paillee")
    defi = eco["challenge"]
    jours_ouverts = 0
    a_regler_jours = 0
    plus_bas = m.caisse
    for jour in range(1, eco["demoEndDay"] + 1):
        js = (jour - 1) % 7
        m.caisse -= loyer
        prets = [x for x, jp in m.travaux if jp <= jour]
        m.travaux = [(x, jp) for x, jp in m.travaux if jp > jour]
        for ext in prets:
            e = exts[ext]
            m.places = [a + b for a, b in zip(m.places, (e["seats"]["counter"], e["seats"]["table"], e["seats"]["comfort"], e["seats"]["terrace"]))]
            m.zones.add(ext)
            if ext == "village_fond":
                m.deco.append(("cheminee", 4, "campagne", ext))
                m.lumieres += 1
            if ext == "village_terrasse":
                m.deco.append(("store", 2, "neutre", ext))
        if js == 0:
            m.journal.append({"jour": jour, "lundi": True, "caisse": m.caisse, "tasses": m.tasses, "renommee": m.renommee})
            plus_bas = min(plus_bas, m.caisse)
            continue
        for rid, n in d1.RECETTE_HABITUE_JOUR.items():
            if jours_ouverts >= n - 1:
                m.connues.add(rid)
        amb, dom, coh = d1.ambiance(m, eco)
        fac = 1.0
        for fin, f in m.affluence_bonus:
            if jour <= fin:
                fac *= f
        ev_fixe = dict(d1.EVENEMENTS_SIM.get(jour, {}))
        if jour == 6 and machine == "revisee":
            ev_fixe = {}  # la machine révisée ne tousse pas: pas de panne, pas de récompense de réparation
        fac *= ev_fixe.get("affluence", 1.0)
        if jour == defi["day"]:
            fac *= defi["affluence"]
        cafe = cc.Cafe("village", dict(m.niveaux), 1, 1, list(m.places), m.vaisselle, set(m.equip), amb, m.tasses)
        carte = cc.choisir_carte(cafe, m.connues, 0)
        meteo = cc.tirer_meteo(rng, 0)
        etat = cc.Etat(carte, 1.0, amb, dom, coh, set(m.equip), m.tasses, m.sat_hier, duo.affluence * fac)
        cfg = cc.Config("village", dict(m.niveaux), 1, False, tuple(m.places), m.vaisselle, [], etat, 1)
        s = cc.Service(cfg, duo, rng, js, 0, meteo)
        s.run(cc.demande(adr, etat, js, 0, meteo))
        b = s.bilan()
        net = b["recette"] + b["pourboires"] - b["cout"] - charges
        pts = sum(max(0.0, (x - eco["reputation"]["pivotSatisfaction"]) / eco["reputation"]["divisor"]) for x in s.satisfactions)
        cu = eco["reputation"]["catchUp"]
        au_dela = jours_ouverts + 1 - cu["afterOpenDays"]
        if au_dela > 0:
            pts *= min(cu["max"], 1 + cu["perDay"] * au_dela)
        grade = {"lent": 0.8, "median": 1.0, "rapide": 1.3}[duo.id]
        if ev_fixe:
            net += ev_fixe.get("euros", 0) * grade
            pts += ev_fixe.get("points", 0) * grade
            if "bonus" in ev_fixe:
                m.affluence_bonus.append((jour + ev_fixe["bonus"][0], ev_fixe["bonus"][1]))
        if jour == defi["day"]:
            m.renommee += defi["renown"]
        m.points += pts
        m.renommee += pts
        m.tasses = d1.tasses(m.points, eco)
        m.sat_hier = b["satisfaction"] if s.satisfactions else m.sat_hier
        m.caisse += net
        plus_bas = min(plus_bas, m.caisse)
        if m.caisse < 0:
            a_regler_jours += 1
        jours_ouverts += 1
        if not m.offre and m.renommee >= eco["offer"]["renown"]:
            m.offre = jour
        if jour == defi["day"] and not m.offre:
            m.offre = jour
        reserve = eco["reserveDaysOfCharges"] * (loyer + charges)
        if jour >= 9 and ("eq", "village_terrasse") in envies:
            envies.remove(("eq", "village_terrasse"))
            envies.insert(0, ("eq", "village_terrasse"))
        # le duo rachète d'abord des places jusqu'à 8 en salle: deux chaises et un guéridon de Simone, sinon neufs
        while m.places[1] < 8:
            if lot_restant.get("chaise_paillee", 0) >= 2 and lot_restant.get("gueridon_marbre", 0) + lot_restant.get("table_carree", 0) >= 1:
                prix, usee = 2 * LOT_SIMONE["chaise_paillee"][0] + LOT_SIMONE["gueridon_marbre"][0], True
            else:
                prix, usee = 2 * items["chaise_paillee"]["price"] + items["gueridon_marbre"]["price"], False
            if m.caisse - reserve < prix:
                break
            m.caisse -= prix
            m.places[1] += 2
            m.achats.append((jour, "places_simone" if usee else "places_neuves", prix))
            f = worn if usee else 1.0
            m.deco += [("chaise_paillee", items["chaise_paillee"]["charm"] * f, "campagne", "salle")] * 2
            m.deco.append(("gueridon_marbre", items["gueridon_marbre"]["charm"] * f, "bistrot", "salle"))
            if usee:
                lot_restant["chaise_paillee"] -= 2
                k = "gueridon_marbre" if lot_restant.get("gueridon_marbre", 0) > 0 else "table_carree"
                lot_restant[k] -= 1
                chaises_usees += 2
        while envies and m.places[1] >= 8 or (envies and m.caisse - reserve > 300):
            src, iid = envies[0]
            if iid == "renover_chaises":
                if chaises_usees == 0:
                    envies.pop(0)
                    continue
                prix, palier = chaises_usees * d1.RENOVATION["chaise_paillee"], "t0"
            elif src == "eq":
                x = achats.get(iid) or exts[iid]
                prix, palier = x["price"], x["tier"]
                if iid == "pichet_thermometre" and m.niveaux.get("vapeur", 0) >= 2:
                    envies.pop(0)
                    continue
            else:
                x = items[iid]
                prix, palier = x["price"] * (3 if x["category"] in ("paint", "wallpaper") else 1), x["unlock"]["tier"]
                if x["category"] == "plant" and eco["flowerMarket"]["day"] <= jour <= eco["flowerMarket"]["untilDay"]:
                    prix *= 1 - eco["flowerMarket"]["plantDiscount"]
            if not d1.palier_ouvert(m, palier, jour, paliers):
                suiv = next((e for e in envies[1:] if d1._palier(e, achats, exts, items) and d1.palier_ouvert(m, d1._palier(e, achats, exts, items), jour, paliers)), None)
                if suiv is None:
                    break
                envies.remove(suiv)
                envies.insert(0, suiv)
                continue
            if m.caisse - reserve < prix:
                break
            m.caisse -= prix
            envies.pop(0)
            m.achats.append((jour, iid, prix))
            if iid == "renover_chaises":
                m.deco = [(i, items[i]["charm"] if i == "chaise_paillee" else ch, sty, z) for i, ch, sty, z in m.deco]
                chaises_usees = 0
            elif src == "eq" and iid in exts:
                m.travaux.append((iid, jour + exts[iid]["nightsOfWork"]))
            elif src == "eq":
                d1.appliquer(m, achats[iid]["effect"])
            else:
                x = items[iid]
                ch = x["charm"] * (3 if x["category"] in ("paint", "wallpaper") else 1)
                m.deco.append((iid, ch, x["style"], "salle"))
                if x["category"] == "light":
                    m.lumieres += 1
                if iid == "fauteuil_crapaud":
                    m.places[1] -= 1
                    m.places[2] += 1
                    if m.places[2] >= 2:
                        m.equip.add("fauteuils")
        m.journal.append({"jour": jour, "lundi": False, "net": net, "recette": b["recette"], "cout": b["cout"],
                          "servis": b["servis"], "repartis": b["repartis"], "satisfaction": b["satisfaction"], "caisse": m.caisse,
                          "tasses": m.tasses, "renommee": m.renommee, "ambiance": amb, "places": m.places[1]})
    premiere = st.journal[0]
    m.livraison_mardi = premiere["livre"] + premiere["port"]
    m.matin_mardi = m.journal[0]["caisse"] - m.livraison_mardi
    m.plus_bas = plus_bas
    m.a_regler_jours = a_regler_jours
    return m


def main() -> int:
    import json
    global EPARGNE
    for a in sys.argv[1:]:
        k, _, v = a.partition("=")
        if k == "epargne":
            EPARGNE = float(v)
    d2, d1, cc = charger()
    four = json.loads((d2.JEU / "fournisseurs.json").read_text(encoding="utf-8"))
    carte = json.loads((d2.JEU / "carte.json").read_text(encoding="utf-8"))
    ings = {i["id"]: dict(i) for i in four["ingredients"]}
    rec = {r["id"]: [(a, b) for a, b in r["ingredients"]] for r in carte["recipes"]}
    d = d1.charger(cc)
    mode = {"stock": None}
    orig_enc = cc.Service.encaisser
    orig_bilan = cc.Service.bilan

    def encaisser(self, c):
        orig_enc(self, c)
        self.__dict__.setdefault("ventes", []).extend(a.recette.id for a in c.articles)

    def bilan(self):
        b = orig_bilan(self)
        st = mode["stock"]
        jour = d2.JOURS_OUVERTS[st.k]
        st.k += 1
        r = st.matin(jour, list(self.cfg.etat.carte))
        st.vendre(r, self.__dict__.get("ventes", []), jour)
        b = dict(b)
        b["cout"] = r["livre"] + r["port"] + r["depannage"]
        return b

    cc.Service.encaisser = encaisser
    cc.Service.bilan = bilan
    fr = d1.fr

    trop_chers = [p["nom"] for p in PANIERS.values() if sum(prix for _, prix in p["achats"]) > EPARGNE]
    for nom in trop_chers:
        print(f"(panier « {nom} » plus cher que l'épargne: joué quand même, la différence passe « à régler »)")

    print(f"Épargne de départ: {fr(EPARGNE)} €\n")
    print("[paniers]")
    print("| Panier | Coût du panier | Reste au soir du jour 1 (avant loyer) | Places en salle | Vaisselle | Machine |")
    print("|---|---|---|---|---|---|")
    for p in PANIERS.values():
        c = sum(prix for _, prix in p["achats"])
        print(f"| {p['nom']} | {fr(c)} € | {fr(EPARGNE - c)} € | {p['places']} | {p['vaisselle']} | {p['machine']} |")

    print("\n[synthèse, médianes de 4 parties, ordre d'achat « équilibre »]")
    print("| Duo | Départ | Première livraison (mardi 7 h) | Caisse le mardi après la livraison | Caisse au soir du jour 2 | Plus bas de la caisse | Parties avec une somme « à régler » | Places en salle au jour 7 | Repartis le dimanche 7 | Gagné en 12 jours | Ambiance au jour 14 | Terrasse pour la fête | Trois tasses avant la fête | Caisse au jour 15 |")
    print("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    detail = {}
    for duo in cc.DUOS:
        for pid in [None, *PANIERS]:
            ms = [jouer(cc, d1, d2, duo, pid, 1000 + g, d, ings, rec, mode) for g in range(PARTIES)]
            nom = "v0.2 (café équipé)" if pid is None else PANIERS[pid]["nom"]
            med = statistics.median
            j2 = med(m.journal[1]["caisse"] for m in ms)
            bas = med(m.plus_bas for m in ms)
            areg = sum(1 for m in ms if m.a_regler_jours > 0)
            pl7 = med(m.journal[6]["places"] for m in ms)
            rep7 = med(m.journal[6]["repartis"] for m in ms)
            gains = med(sum(j.get("net", 0) for j in m.journal) for m in ms)
            amb = med(m.journal[13]["ambiance"] for m in ms)
            terr = sum(1 for m in ms if any(i == "village_terrasse" and j <= 13 for j, i, _ in m.achats))
            trois = sum(1 for m in ms if m.journal[12]["tasses"] >= 3.0)
            fin = med(m.journal[-1]["caisse"] for m in ms)
            liv = med(m.livraison_mardi for m in ms)
            mat = med(m.matin_mardi for m in ms)
            print(f"| {duo.nom} | {nom} | {fr(liv)} € | {fr(mat)} € | {fr(j2)} € | {fr(bas)} € | {areg} sur {PARTIES} | {fr(pl7)} | {fr(100 * rep7)} % | {fr(gains)} € | {fr(amb)} | {terr} sur {PARTIES} | {trois} sur {PARTIES} | {fr(fin)} € |")
            if duo.id == "median":
                detail[nom] = ms

    print("\n[duo médian, caisse le soir (médiane), jours 1 à 15]")
    noms = list(detail)
    print("| Jour | " + " | ".join(noms) + " |")
    print("|---|" + "---|" * len(noms))
    for jour in range(1, 16):
        cells = [fr(statistics.median(m.journal[jour - 1]["caisse"] for m in detail[n])) + " €" for n in noms]
        print(f"| {jour} | " + " | ".join(cells) + " |")
    print("\n[duo médian, groupes servis et repartis par jour (médianes)]")
    print("| Jour | " + " | ".join(noms) + " |")
    print("|---|" + "---|" * len(noms))
    for jour in range(2, 15):
        if (jour - 1) % 7 == 0:
            continue
        cells = []
        for n in noms:
            js = [m.journal[jour - 1] for m in detail[n]]
            cells.append(f"{fr(statistics.median(j['servis'] for j in js))} / {fr(100 * statistics.median(j['repartis'] for j in js))} %")
        print(f"| {jour} | " + " | ".join(cells) + " |")
    print("\n[duo médian, premiers achats après l'ouverture (première partie)]")
    for n in noms:
        m = detail[n][0]
        print(f"- {n}: " + ", ".join(f"j{j} {i} ({fr(p)} €)" for j, i, p in m.achats[:8]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
