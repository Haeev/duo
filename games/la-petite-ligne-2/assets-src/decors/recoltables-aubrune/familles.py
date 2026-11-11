"""Familles des récoltables d'Aubrune: de l'entrée de `recoltables.toml` à la géométrie.

Une fonction par famille (arbre, buisson, rocher, fleur, bois, repere, parcelle, culture). Chacune
rend la liste des modèles engendrés par l'entrée: le modèle, ses variantes de forme et ses états
(souche, sans fruits, hiver, entamé, stades de pousse). Sans Blender: numpy et scipy seuls.

Raisons d'être tenues ici:
- un houppier commence à la hauteur du fût: le personnage au pied du tronc reste visible;
- une branche finit dans une touffe (jamais un bout de fût en l'air), une ronce retombe sur son
  fourré (jamais une tige fine qui sort d'une boule);
- un plant pousse sur le dessus d'un billon, à l'endroit où la bêche l'a formé;
- une bûche a la longueur d'un pas (33 à 50 cm), un piquet de tomate dépasse le pied mûr.
"""

from __future__ import annotations

import math

import numpy as np

from formes import Atelier, at, choix, entre, hexa, penche, tirage, ton

# Une case bêchée est une planche de terre relevée (`PLANCHE_H`: plus haute que les bosses de la
# friche, qu'elle recouvre) qui porte trois billons (`BILLON_H` de plus, aux places `BILLONS_Z`).
PLANCHE_H = 0.07
BILLON_H = 0.08
SOL_PLANT = PLANCHE_H + BILLON_H * 0.92
BILLONS_Z = (-0.3, 0.0, 0.3)


class Contexte:
    """Nuancier, essences et fiches de cultures lus une fois."""

    def __init__(self, gabarits: dict, cultures: dict[str, dict]):
        self.teintes = {nom: [hexa(c) for c in liste] for nom, liste in gabarits["teintes"].items()}
        self.essences = gabarits.get("essences", {})
        self.gabarits = gabarits
        self.cultures = cultures

    def tons(self, nom: str):
        if nom not in self.teintes:
            raise SystemExit(f"teinte inconnue: {nom}")
        return self.teintes[nom]

    def un(self, nom: str, graine: float = 0.0):
        return choix(self.tons(nom), graine)


def _modele(ident: str, s: Atelier, **notice) -> dict:
    return {"id": ident, "atelier": s, **notice}


# ====================================================================== arbres
# États qui sont des versions allégées d'un arbre (`[allege.<état>]`), pas des états de jeu.
ALLEGES = ("far", "shade")


def _masses(h: dict, base: float, graine: float, taille: float):
    """Places des masses du houppier (x, y, z, rayon) selon sa forme; y est le bas de la masse."""
    R, H, n = h["rayon"] * taille, h["hauteur"] * taille, h["masses"]
    forme = h["forme"]
    out = []
    depart = tirage(graine * 1.7) * math.tau
    if forme == "rond":
        out.append((penche(graine, 0.12) * R, base + H * 0.5, penche(graine + 1, 0.12) * R, R * 0.64))
        k = n - 1
        for i in range(k):
            a = depart + i / k * math.tau + penche(graine + i * 3.1, 0.22)
            d = R * entre(0.56, 0.66, graine + i * 5.7)
            out.append((math.cos(a) * d, base + H * entre(0.02, 0.2, graine + i * 2.3), math.sin(a) * d, R * entre(0.46, 0.56, graine + i * 4.1)))
    elif forme == "ovale":
        out.append((penche(graine, 0.08) * R, base + H * 0.62, penche(graine + 1, 0.08) * R, R * 0.6))
        haut = max(2, (n - 1) // 2)
        bas = n - 1 - haut
        for i in range(haut):
            a = depart + i / haut * math.tau
            out.append((math.cos(a) * R * 0.42, base + H * entre(0.36, 0.44, graine + i * 2.9), math.sin(a) * R * 0.42, R * entre(0.52, 0.6, graine + i * 6.1)))
        for i in range(bas):
            a = depart + (i + 0.5) / bas * math.tau
            out.append((math.cos(a) * R * 0.6, base + H * entre(0.04, 0.14, graine + i * 3.7), math.sin(a) * R * 0.6, R * entre(0.46, 0.54, graine + i * 4.9)))
    elif forme == "etage":
        out.append((penche(graine, 0.1) * R, base + H * 0.72, penche(graine + 1, 0.1) * R, R * 0.56))
        k = n - 1
        for i in range(k):
            a = depart + i * 2.4
            d = R * entre(0.5, 0.68, graine + i * 3.3)
            out.append((math.cos(a) * d, base + H * (0.04 + 0.56 * i / max(1, k - 1)), math.sin(a) * d, R * entre(0.46, 0.58, graine + i * 5.1)))
    elif forme == "plat":
        out.append((penche(graine, 0.15) * R, base + H * 0.34, penche(graine + 1, 0.15) * R, R * 0.7))
        k = n - 1
        for i in range(k):
            a = depart + i / k * math.tau + penche(graine + i * 3.1, 0.2)
            d = R * entre(0.58, 0.68, graine + i * 5.7)
            out.append((math.cos(a) * d, base + H * entre(0.0, 0.14, graine + i * 2.3), math.sin(a) * d, R * entre(0.48, 0.58, graine + i * 4.1)))
    else:
        raise SystemExit(f"forme de houppier inconnue: {forme}")
    return out


def _fut(e: dict, graine: float, taille: float):
    """Ligne du tronc: (x, y, z, rayon) du pied à la tête du houppier."""
    f, h = e["fut"], e["houppier"]
    H0, r = f["hauteur"] * taille, f["rayon"] * taille
    sin = f.get("sinuosite", 0.1) * taille
    cap = tirage(graine * 2.3) * math.tau
    pen = f.get("penche", 0.0) * taille
    px, pz = math.cos(cap) * pen, math.sin(cap) * pen
    pts = [(0.0, 0.0, 0.0, r * 1.28), (penche(graine, 0.03), 0.3 * taille, penche(graine + 1, 0.03), r * 1.02)]
    for i, t in enumerate((0.36, 0.7, 1.0)):
        cote = -1 if i % 2 else 1
        a = cap + 1.3 + i * 2.1
        pts.append((px * t + math.cos(a) * sin * cote, H0 * t, pz * t + math.sin(a) * sin * cote, r * (1.0 - 0.3 * t) * (1.12 if i == 1 else 1.0)))
    haut = H0 + h["hauteur"] * taille * (0.5 if h["forme"] != "plat" else 0.3)
    pts.append((px * 1.15 + penche(graine + 5, sin), haut, pz * 1.15 + penche(graine + 6, sin), r * 0.36))
    return pts


def _sur_fut(pts, y: float):
    """Point de l'axe du tronc à la hauteur y, et son rayon."""
    for a, b in zip(pts, pts[1:]):
        if a[1] <= y <= b[1]:
            t = (y - a[1]) / max(1e-6, b[1] - a[1])
            return tuple(a[k] + (b[k] - a[k]) * t for k in range(4))
    return pts[-1]


def _racines(s: Atelier, r: float, graine: float, mat: str, teinte, portee: float = 1.0):
    """Racines à fleur de sol: des contreforts courts et épais, inégaux, qui tiennent le pied."""
    nombre = 5 if r > 0.4 else 4
    for i in range(nombre):
        a = i / nombre * math.tau + graine + penche(graine + i, 0.25)
        d = r * entre(1.75, 2.2, graine + i * 1.9) * portee
        s.tube(
            [(math.cos(a) * r * 0.45, r * 1.25, math.sin(a) * r * 0.45, r * 0.5), (math.cos(a) * d * 0.62, r * 0.5, math.sin(a) * d * 0.62, r * 0.42), (math.cos(a) * d, 0.0, math.sin(a) * d, r * 0.24)],
            4,
            mat,
            teinte,
        )


def _sur_calotte(part: float, dome: float) -> float:
    """Hauteur du dessus d'une touffe (en rayons) à la distance `part` de son axe (0 à 1)."""
    profil = [(0.0, 1.0), (0.5, 0.86), (0.88, 0.42), (1.0, -0.04)]
    for (a, ya), (b, yb) in zip(profil, profil[1:]):
        if part <= b:
            return dome * (ya + (yb - ya) * (part - a) / (b - a))
    return 0.0


def _tronc(s: Atelier, e: dict, ctx: Contexte, graine: float, taille: float, mat: str = "ecorce"):
    tons = ctx.tons(e["ecorce"])
    f = e["fut"]
    pts = _fut(e, graine, taille)
    r = f["rayon"] * taille
    s.tube(pts, f["pans"], mat, tons[0], tremble=r * 0.07, tors=0.1)
    _racines(s, r, graine, mat, tons[1 % len(tons)])
    # Marques sombres du bouleau: bagues courtes et épaisses, à peine en relief.
    for i in range(e.get("marques", 0)):
        y = f["hauteur"] * taille * (0.14 + 0.19 * i) + penche(graine + i, 0.08)
        x, _, z, rr = _sur_fut(pts, y)
        s.box(rr * 2.25, 0.085 * taille, rr * 1.5, at(x, y, z, tirage(graine + i * 3.3) * 6.3, 0, 0.08), mat, ctx.un("marque"), tremble=0.008, sans="y+ y-")
    return pts


def _branches(s: Atelier, e: dict, ctx: Contexte, pts, masses, graine: float, taille: float, hiver: bool):
    tons = ctx.tons(e["ecorce"])
    r = e["fut"]["rayon"] * taille
    for i, (x, y, z, rm) in enumerate(masses):
        if i == 0 and not hiver:
            continue
        # La branche part du tronc un peu plus bas que sa touffe et finit dedans.
        H0 = e["fut"]["hauteur"] * taille
        y0 = max(H0 * entre(0.62, 0.98, graine + i * 2.7), min(y - rm * 0.55, pts[-1][1] - 0.2))
        ax, ay, az, ar = _sur_fut(pts, y0)
        bout = (x * 0.92, y + rm * 0.18, z * 0.92)
        mi = ((ax + bout[0]) * 0.5, (ay + bout[1]) * 0.5 - 0.1 * taille, (az + bout[2]) * 0.5)
        rb = min(ar * 0.62, r * 0.46)
        if i > 0:
            s.tube([(ax, ay, az, rb), (*mi, rb * 0.72), (*bout, rb * 0.42)], 4, "ecorce", tons[i % len(tons)], tremble=rb * 0.12)
        if hiver:
            # Rameaux nus: trois brins qui montent en éventail au bout de chaque branche.
            for k in range(3):
                a = math.atan2(z, x) + (k - 1) * 0.9 + penche(graine + i * 7 + k, 0.3)
                long = rm * entre(0.75, 1.05, graine + i * 3 + k)
                fin = (bout[0] + math.cos(a) * long * 0.7, bout[1] + long * entre(0.45, 0.8, graine + k + i), bout[2] + math.sin(a) * long * 0.7)
                s.tube([(*bout, rb * 0.4), (*fin, rb * 0.1)], 3, "ecorce", tons[(i + k) % len(tons)])


def _souche(s: Atelier, e: dict, ctx: Contexte, graine: float, taille: float):
    """Arbre abattu: la souche (coupe claire, un éclat resté debout), deux bûches et des copeaux."""
    ecorce = ctx.tons(e["ecorce"])
    coupe = ctx.tons("bois_coupe")
    r = e["fut"]["rayon"] * taille
    pans = e["fut"]["pans"]
    h = max(0.32, min(0.5, r * 1.25))
    s.tube([(0, 0, 0, r * 1.28), (0.01, 0.2, 0.0, r * 1.04), (0.0, h, 0.01, r * 0.98)], pans, "bois", ecorce[0], tremble=r * 0.06, bouts=(False, True), coupe=coupe[0], tors=0.1)
    _racines(s, r, graine, "bois", ecorce[1 % len(ecorce)], portee=min(1.0, 0.5 / (r * 2.2)))
    # L'éclat de la charnière: le côté où l'arbre a cédé.
    a = graine * 1.3
    s.morceau(
        [(-0.07, 0, -0.03), (0.07, 0, -0.03), (0.0, 0, 0.035), (0.01, r * 0.5, 0.0)],
        [(0, 1, 3), (1, 2, 3), (2, 0, 3)],
        "bois",
        coupe[1],
        at(math.cos(a) * r * 0.62, h - 0.01, math.sin(a) * r * 0.62, a),
    )
    # Deux bûches débitées, couchées au pied, dans la case.
    rb = 0.105
    for i in range(2):
        # Côté sud de la souche (vers la caméra de jeu au cap 0), l'une contre l'autre.
        a = 1.0 + i * 1.15 + penche(graine + i, 0.2)
        d = r * 1.05 + rb + 0.04
        cx, cz = math.cos(a) * d, math.sin(a) * d
        tang = a + math.pi / 2 + penche(graine + i, 0.4)
        dx, dz = math.cos(tang) * 0.2, math.sin(tang) * 0.2
        s.tube([(cx - dx, rb * 0.92, cz - dz, rb), (cx + dx, rb * 0.92, cz + dz, rb * 0.92)], 6, "bois", ecorce[(i + 1) % len(ecorce)], tremble=0.008, bouts=(True, True), coupe=coupe[(i + 1) % len(coupe)])
    for i in range(3):
        a = graine + i * 2.1 + 1.9
        d = r * 1.2 + 0.1
        s.box(0.09, 0.02, 0.05, at(math.cos(a) * min(d, 0.42), 0.012, math.sin(a) * min(d, 0.42), a * 3), "bois", coupe[i % len(coupe)], tremble=0.006)


def _un_arbre(e: dict, ctx: Contexte, graine: float, taille: float, etat: str) -> Atelier:
    s = Atelier(graine)
    if etat == "stump":
        _souche(s, e, ctx, graine, taille)
        return s
    h = e["houppier"]
    base = e["fut"]["hauteur"] * taille
    masses = _masses(h, base, graine, taille)
    tons = ctx.tons(e["feuillage"])
    if etat in ALLEGES:
        # Versions allégées, réglées par `[allege.<état>]` de recoltables.toml: le même fût et les
        # mêmes masses aux mêmes places, sans racines, ni branches (cachées sous le houppier), ni
        # feuilles détachées, et des touffes à moins de pans. `far`: avec ses festons, la même
        # silhouette vue de haut (bois hors du couloir de jeu, ombre des arbres proches). `shade`:
        # sans festons, masses élargies de `gonfle` pour couvrir leur place (ombre du bois lointain).
        a = ctx.gabarits["allege"][etat]
        s.tube(_fut(e, graine, taille), a["pans"], "ecorce", ctx.tons(e["ecorce"])[0], tors=0.1)
        for i, (x, y, z, r) in enumerate(masses):
            ordre = [tons[(i + k) % len(tons)] for k in range(len(tons))]
            festons = h.get("festons", 3) + (1 if i == 0 else 0) if a.get("festons", True) else 0
            s.touffe(x, y, z, r * a.get("gonfle", 1.0), graine + i * 1.37, ordre, festons=festons, segments=a["segments"] + (1 if i == 0 else 0), dome=h.get("dome", 0.72), dents=h.get("dents", 0.34), laches=0, rangs=a["rangs"], pans_festons=a.get("segments_festons"))
        return s
    pts = _tronc(s, e, ctx, graine, taille)
    hiver = etat == "winter"
    _branches(s, e, ctx, pts, masses, graine, taille, hiver)
    if hiver:
        return s
    for i, (x, y, z, r) in enumerate(masses):
        ordre = [tons[(i + k) % len(tons)] for k in range(len(tons))]
        s.touffe(x, y, z, r, graine + i * 1.37, ordre, festons=h.get("festons", 3) + (1 if i == 0 else 0), segments=h.get("segments", 9) + (1 if i == 0 else 0), dome=h.get("dome", 0.72), dents=h.get("dents", 0.34), laches=1)
    fruits = e.get("fruits")
    if fruits and etat != "bare":
        teintes = ctx.tons(fruits["teinte"])
        for i in range(fruits["nombre"]):
            # Les fruits pendent sous le bord des masses, du côté du dehors: on les voit de haut.
            x, y, z, r = masses[1 + i % (len(masses) - 1)] if i % 3 else masses[0]
            a = tirage(graine + i * 9.7) * math.tau
            part = entre(0.45, 0.95, graine + i * 4.3)
            rf = fruits["rayon"] * taille
            haut = y + r * 0.85 * _sur_calotte(part, h.get("dome", 0.72)) + rf * 0.2
            s.octa(rf, rf * 0.95, rf, at(x + math.cos(a) * r * part, haut, z + math.sin(a) * r * part, a), "fruit", teintes[i % len(teintes)])
    return s


def arbre(entree: dict, ctx: Contexte) -> list[dict]:
    e = ctx.essences.get(entree["essence"])
    if e is None:
        raise SystemExit(f"{entree['id']}: essence inconnue « {entree['essence']} »")
    formes = [{"suffixe": "", "graine": entree["graine"], "taille": entree.get("taille", 1.0)}] + [
        {"suffixe": "-" + v["suffixe"], "graine": v["graine"], "taille": v.get("taille", 1.0)} for v in entree.get("variantes", [])
    ]
    etats = entree.get("etats", [])
    out = []
    r = e["fut"]["rayon"]
    for f in formes:
        ident = entree["id"] + f["suffixe"]
        etats_ids = {}
        for etat in etats:
            # La souche est la même pour toutes les formes d'une essence: on ne la fait qu'une fois.
            if etat == "stump" and f["suffixe"]:
                etats_ids[etat] = f"{entree['id']}-stump"
                continue
            etats_ids[etat] = f"{ident}-{etat}"
            budget = {"famille_budget": f"arbre_{etat}"} if etat in ALLEGES else {}
            out.append(_modele(etats_ids[etat], _un_arbre(e, ctx, f["graine"], f["taille"], etat), etat=etat, de=ident, collision={"shape": "cylinder", "r": round(r * f["taille"], 3)}, **budget))
        out.append(
            _modele(
                ident,
                _un_arbre(e, ctx, f["graine"], f["taille"], "vif"),
                states=etats_ids,
                variants=[entree["id"] + g["suffixe"] for g in formes if g is not f],
                jitter={"yaw": True, "scale": [0.94, 1.06]},
                collision={"shape": "cylinder", "r": round(r * f["taille"], 3)},
                pourquoi=e.get("pourquoi"),
            )
        )
    return out


# ====================================================================== buissons et ronces
def _un_buisson(entree: dict, ctx: Contexte, graine: float, taille: float, fruits: bool) -> Atelier:
    s = Atelier(graine)
    tons = ctx.tons(entree["feuillage"])
    R, H = entree["rayon"] * taille, entree["hauteur"] * taille
    forme = entree["forme"]
    sommets = []
    if forme == "fourre":
        # Ronce: un fourré bas et large, puis des arceaux qui montent et retombent dessus.
        masses = [(penche(graine, 0.05), H * 0.12, penche(graine + 1, 0.05), R * 0.98)]
        for i in range(3):
            a = graine + i / 3 * math.tau
            masses.append((math.cos(a) * R * 0.6, H * entre(0.02, 0.1, graine + i), math.sin(a) * R * 0.6, R * entre(0.5, 0.6, graine + i * 3.3)))
        for i, (x, y, z, r) in enumerate(masses):
            s.calotte(x, y, z, r, graine + i * 2.1, ton(tons[i % len(tons)], 0.8 if i == 0 else 1.0), segments=9 if i == 0 else 6, dome=0.7, dents=0.3, laches=1 if i else 2, rangs=3 if i == 0 else 2)
            sommets.append((x, y, z, r, 0.7))
        tige = ton(ctx.un("mure", 0.0), 1.25, tons[0], 0.35)
        for i in range(3):
            a = graine * 1.9 + i * 2.2
            pied = (math.cos(a) * R * 0.2, H * 0.4, math.sin(a) * R * 0.2)
            haut = (math.cos(a) * R * 0.7, H * 1.08, math.sin(a) * R * 0.7)
            fin = (math.cos(a + 0.5) * R * 1.22, H * 0.22, math.sin(a + 0.5) * R * 1.22)
            s.tube([(*pied, 0.026), (*haut, 0.022), (*fin, 0.012)], 3, "tige", tige)
            for k in range(2):
                t = 0.3 + k * 0.35
                p = np.array(haut) * (1 - t) + np.array(fin) * t if k > 1 else np.array(pied) * (1 - t * 2) + np.array(haut) * t * 2
                cote = 1 if k % 2 else -1
                d = (math.cos(a + cote * 1.4), 0.25, math.sin(a + cote * 1.4))
                s.feuille(p, d, 0.2 * taille, 0.12 * taille, "feuillage", tons[(i + k) % len(tons)], envers=ton(tons[0], 0.7), cambre=0.3)
    elif forme == "boule":
        # Buisson à baies: des rejets droits, une masse ronde et deux épaules.
        bois = ctx.tons("ecorce_pommier")
        for i in range(4):
            a = graine + i * 1.6
            s.tube([(math.cos(a) * 0.05, 0, math.sin(a) * 0.05, 0.028), (math.cos(a) * R * 0.4, H * 0.5, math.sin(a) * R * 0.4, 0.018)], 3, "tige", bois[i % len(bois)])
        masses = [(0.0, H * 0.42, 0.0, R * 0.86)]
        for i in range(3):
            a = graine * 1.3 + i / 3 * math.tau
            masses.append((math.cos(a) * R * 0.5, H * entre(0.2, 0.3, graine + i), math.sin(a) * R * 0.5, R * entre(0.5, 0.58, graine + i * 3.3)))
        for i, (x, y, z, r) in enumerate(masses):
            s.calotte(x, y, z, r, graine + i * 2.1, ton(tons[i % len(tons)], 0.84 if i == 0 else 1.0), segments=9 if i == 0 else 7, dome=0.95, dents=0.24, laches=1, rangs=3 if i == 0 else 2)
            sommets.append((x, y, z, r, 0.95))
    else:
        raise SystemExit(f"{entree['id']}: forme de buisson inconnue « {forme} »")
    f = entree.get("fruits")
    if f and fruits:
        teintes = ctx.tons(f["teinte"])
        for i in range(f["nombre"]):
            x, y, z, r, dome = sommets[i % len(sommets)]
            a = tirage(graine + i * 7.9) * math.tau
            part = entre(0.2, 0.85, graine + i * 3.1)
            rf = f["rayon"] * taille
            # Posées sur le dessus des touffes, à moitié dans les feuilles.
            s.octa(rf, rf, rf, at(x + math.cos(a) * r * part, y + r * 0.85 * _sur_calotte(part, dome) + rf * 0.25, z + math.sin(a) * r * part, a), "fruit", teintes[i % len(teintes)])
    return s


def buisson(entree: dict, ctx: Contexte) -> list[dict]:
    formes = [{"suffixe": "", "graine": entree["graine"], "taille": 1.0}] + [
        {"suffixe": "-" + v["suffixe"], "graine": v["graine"], "taille": v.get("taille", 1.0)} for v in entree.get("variantes", [])
    ]
    out = []
    for f in formes:
        ident = entree["id"] + f["suffixe"]
        etats_ids = {}
        if "bare" in entree.get("etats", []):
            etats_ids["bare"] = f"{ident}-bare"
            out.append(_modele(etats_ids["bare"], _un_buisson(entree, ctx, f["graine"], f["taille"], False), etat="bare", de=ident))
        out.append(
            _modele(
                ident,
                _un_buisson(entree, ctx, f["graine"], f["taille"], True),
                states=etats_ids,
                variants=[entree["id"] + g["suffixe"] for g in formes if g is not f],
                jitter={"yaw": True, "scale": [0.92, 1.08]},
            )
        )
    return out


# ====================================================================== rochers
def _herbes_au_pied(s: Atelier, ctx: Contexte, rayon: float, graine: float, nombre: int):
    tons = ctx.tons("herbe")
    for i in range(nombre):
        a = graine + i * 2.4
        x, z = math.cos(a) * rayon, math.sin(a) * rayon
        for k in range(3):
            b = a + (k - 1) * 0.7
            s.brin((x, 0, z), (x + math.cos(b) * 0.07, entre(0.12, 0.2, graine + i + k), z + math.sin(b) * 0.07), 0.035, "tige", tons[(i + k) % len(tons)])


def _un_rocher(entree: dict, ctx: Contexte, graine: float, entame: bool) -> Atelier:
    s = Atelier(graine)
    tons = ctx.tons("pierre")
    dessus = ctx.un("pierre_dessus")
    frais = ctx.un("pierre_fraiche")
    taille = entree["taille"]
    if taille == "petit":
        # Cailloux à ramasser: une pierre de la taille d'un pain et deux plus petites contre elle.
        r = entre(0.2, 0.24, graine)
        s.galet(r, r * 0.74, r * 0.86, at(0.02, 0, -0.01, graine), "pierre", tons[0], graine, points=11, dessus=dessus, pose=0.2)
        for i in range(4):
            a = graine * 1.7 + i * 1.6
            rr = entre(0.1, 0.16, graine + i * 3.3)
            s.galet(rr, rr * 0.72, rr * 0.9, at(math.cos(a) * (r * 0.8 + rr * 0.6), 0, math.sin(a) * (r * 0.8 + rr * 0.6), a), "pierre", tons[(i + 1) % len(tons)], graine + i + 1, points=8, dessus=dessus, pose=0.25)
        return s
    grand = taille == "grand"
    R = 0.62 if grand else 0.4
    corps = [(0.0, 0.0, R, R * (1.05 if grand else 0.86), R * 0.86, 20 if grand else 16)]
    if grand:
        corps.append((R * 0.62, -R * 0.38, R * 0.62, R * 0.62, R * 0.6, 13))
        corps.append((-R * 0.66, R * 0.3, R * 0.5, R * 0.46, R * 0.52, 11))
    else:
        corps.append((R * 0.7, R * 0.3, R * 0.52, R * 0.44, R * 0.5, 11))
    for i, (x, z, rx, ry, rz, pts) in enumerate(corps):
        coupe = None
        if entame and i == 0:
            # Le pic a fait sauter un pan: une cassure claire, tournée vers le sud-est.
            coupe = ((0.38, 0.3, 0.3), (0.62, 0.42, 0.66))
        s.galet(rx, ry, rz, at(x, 0, z, graine + i * 1.9), "pierre", tons[i % len(tons)], graine + i * 4.7, points=pts, dessus=dessus, coupe=coupe, frais=frais, pose=0.2)
    if entame:
        for i in range(5):
            a = 0.75 + (i - 2) * 0.42
            d = R * entre(1.02, 1.3, graine + i * 2.2)
            rr = entre(0.05, 0.09, graine + i * 5.1)
            s.galet(rr, rr * 0.6, rr * 0.8, at(math.cos(a) * d, 0, math.sin(a) * d, a * 2), "pierre", frais if i % 2 else tons[i % len(tons)], graine + 9 + i, points=7, pose=0.2)
    if entree.get("mousse"):
        vert = ctx.tons("mousse")
        for i in range(4 if grand else 3):
            a = graine * 2.3 + i * 1.9 + 2.2
            d = R * entre(0.15, 0.5, graine + i * 3.9)
            x, z = math.cos(a) * d, math.sin(a) * d
            # La mousse coiffe le dessus, côté nord et ouest (le moins de soleil).
            haut = corps[0][3] * 1.6 * (1 - 0.45 * (d / R) ** 2)
            rr = R * entre(0.3, 0.42, graine + i * 2.7)
            s.calotte(x, haut - rr * 0.34, z, rr, graine + i * 6.1, vert[i % len(vert)], mat="mousse", segments=7, dome=0.42, dents=0.3, laches=0, rangs=2)
    _herbes_au_pied(s, ctx, R * (1.12 if grand else 1.08), graine, 4 if grand else 3)
    return s


def rocher(entree: dict, ctx: Contexte) -> list[dict]:
    formes = [{"suffixe": "", "graine": entree["graine"]}] + [{"suffixe": "-" + v["suffixe"], "graine": v["graine"]} for v in entree.get("variantes", [])]
    out = []
    for f in formes:
        ident = entree["id"] + f["suffixe"]
        etats_ids = {}
        if "chipped" in entree.get("etats", []):
            etats_ids["chipped"] = f"{ident}-chipped"
            out.append(_modele(etats_ids["chipped"], _un_rocher(entree, ctx, f["graine"], True), etat="chipped", de=ident))
        out.append(
            _modele(
                ident,
                _un_rocher(entree, ctx, f["graine"], False),
                states=etats_ids,
                variants=[entree["id"] + g["suffixe"] for g in formes if g is not f],
                jitter={"yaw": True, "scale": [0.88, 1.12]},
            )
        )
    return out


# ====================================================================== fleurs et herbes
def _touffe_d_herbe(s: Atelier, ctx: Contexte, x: float, z: float, graine: float, hauteur: float, brins: int = 5, teinte: str = "herbe"):
    tons = ctx.tons(teinte)
    for k in range(brins):
        a = graine * 3.1 + k / brins * math.tau
        e = entre(0.25, 0.6, graine + k * 1.7)
        s.brin((x + math.cos(a) * 0.015, 0, z + math.sin(a) * 0.015), (x + math.cos(a) * hauteur * e, hauteur * entre(0.6, 1.0, graine + k), z + math.sin(a) * hauteur * e), hauteur * 0.22, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.78))


def _corolle(s: Atelier, x, y, z, rayon, pans, teinte, envers, graine, creux=0.022):
    """Corolle en coupe à pans, visible de dessus et de côté."""
    pts = [(0, -0.012, 0)] + [(math.cos(k / pans * math.tau) * rayon, creux + 0.014 * (k % 2), math.sin(k / pans * math.tau) * rayon) for k in range(pans)]
    m = at(x, y, z, tirage(graine) * 6.3, penche(graine, 0.3), penche(graine + 1, 0.3))
    s.morceau(pts, [(0, k + 1, (k + 1) % pans + 1) for k in range(pans)], "fleur", teinte, m, coeur=(0, -1, 0), double=True, envers=envers)


def _une_fleur(entree: dict, ctx: Contexte, graine: float) -> Atelier:
    s = Atelier(graine)
    sorte = entree["sorte"]
    n, H = entree["tiges"], entree["hauteur"]
    tige = ctx.tons("tige")
    corolle = ctx.tons(entree["corolle"])
    if sorte == "herbe":
        # Herbes à cueillir: un coussin de feuilles larges en couronnes, des boutons d'or dessus.
        tons = ctx.tons("feuille_potager")
        for i in range(n):
            a = graine + i / n * math.tau
            d = 0.0 if i == 0 else entre(0.12, 0.2, graine + i * 2.9)
            x, z = math.cos(a) * d, math.sin(a) * d
            for k in range(3):
                b = a + k * 2.1 + i
                s.feuille((x, 0.01, z), (math.cos(b), entre(0.55, 0.9, graine + i + k), math.sin(b)), H * entre(0.7, 0.95, graine + k * 3 + i), H * 0.5, "tige", tons[(i + k) % len(tons)], envers=ton(tons[0], 0.72), cambre=0.35)
        for i in range(4):
            a = graine * 1.9 + i * 1.7
            d = entre(0.04, 0.2, graine + i * 4.1)
            x, z = math.cos(a) * d, math.sin(a) * d
            h = H * entre(0.95, 1.2, graine + i)
            s.tube([(x, 0, z, 0.009), (x + penche(graine + i, 0.03), h, z + penche(graine + i + 2, 0.03), 0.007)], 3, "tige", tige[i % len(tige)], rond=True)
            _corolle(s, x + penche(graine + i, 0.03), h, z + penche(graine + i + 2, 0.03), 0.05, 5, corolle[i % len(corolle)], ton(corolle[0], 0.8), graine + i, creux=0.012)
        return s
    _touffe_d_herbe(s, ctx, 0, 0, graine, 0.2, 6)
    for i in range(n):
        a = graine + i * 2.4
        d = entre(0.08, 0.34, graine + i * 3.7)
        x, z = math.cos(a) * d, math.sin(a) * d
        h = H * entre(0.7, 1.12, graine + i * 1.3)
        tx, tz = x + penche(graine + i, 0.07), z + penche(graine + i + 2, 0.07)
        mi = ((x + tx) / 2 + penche(graine + i * 5, 0.03), h * 0.55, (z + tz) / 2 + penche(graine + i * 7, 0.03))
        s.tube([(x, 0, z, 0.011), (*mi, 0.009), (tx, h, tz, 0.008)], 3, "tige", tige[i % len(tige)], rond=True)
        if i == n - 1:
            # Un bouton encore fermé, penché: le prochain à s'ouvrir.
            s.octa(0.024, 0.04, 0.024, at(tx, h + 0.01, tz, 0, 0.5), "fleur", ton(tige[0], 1.1))
            continue
        # Corolle large (le coquelicot se repère de loin), coeur sombre.
        rc = entre(0.085, 0.105, graine + i * 2.1)
        _corolle(s, tx, h + 0.012, tz, rc, 5, corolle[i % len(corolle)], ton(corolle[0], 0.8), graine + i)
        s.octa(0.022, 0.014, 0.022, at(tx, h + 0.024, tz), "fleur", ctx.un("coeur"))
    return s


def fleur(entree: dict, ctx: Contexte) -> list[dict]:
    formes = [{"suffixe": "", "graine": entree["graine"]}] + [{"suffixe": "-" + v["suffixe"], "graine": v["graine"]} for v in entree.get("variantes", [])]
    return [
        _modele(entree["id"] + f["suffixe"], _une_fleur(entree, ctx, f["graine"]), states={}, variants=[entree["id"] + g["suffixe"] for g in formes if g is not f], jitter={"yaw": True, "scale": [0.9, 1.1]})
        for f in formes
    ]


# ====================================================================== bois à ramasser
def _buche(s: Atelier, ctx: Contexte, x, y, z, cap, longueur, rayon, graine, incline=0.0):
    ecorce = ctx.tons("ecorce_chene")
    coupe = ctx.tons("bois_coupe")
    dx, dz = math.cos(cap) * longueur / 2, math.sin(cap) * longueur / 2
    dy = math.sin(incline) * longueur / 2
    s.tube([(x - dx, y - dy, z - dz, rayon), (x + dx, y + dy, z + dz, rayon * 0.94)], 6, "bois", choix(ecorce, graine), tremble=0.008, bouts=(True, True), coupe=choix(coupe, graine + 1), tors=graine)


def _un_bois(entree: dict, ctx: Contexte, graine: float, vide: bool) -> Atelier:
    s = Atelier(graine)
    if entree["sorte"] == "branches":
        # Branches mortes tombées: trois bois gris croisés, des moignons de rameaux.
        tons = ctx.tons("bois_mort")
        for i in range(3):
            a = graine + i * 1.1 + 0.2
            long = entre(0.78, 0.96, graine + i * 2.3)
            cx, cz = penche(graine + i, 0.08), penche(graine + i + 4, 0.08)
            r = entre(0.04, 0.052, graine + i)
            y = r + i * 0.055
            p0 = (cx - math.cos(a) * long / 2, y - 0.02 * i, cz - math.sin(a) * long / 2)
            p1 = (cx + math.cos(a) * long * 0.1, y + 0.012, cz + math.sin(a) * long * 0.1)
            p2 = (cx + math.cos(a + 0.2) * long / 2, y, cz + math.sin(a + 0.2) * long / 2)
            s.tube([(*p0, r), (*p1, r * 0.85), (*p2, r * 0.5)], 5, "bois", tons[i % len(tons)], tremble=0.006, bouts=(True, True), coupe=ton(tons[0], 1.25))
            b = a + (1.0 if i % 2 else -1.0)
            s.tube([(*p1, r * 0.6), (p1[0] + math.cos(b) * 0.22, p1[1] + 0.08, p1[2] + math.sin(b) * 0.22, r * 0.3)], 4, "bois", tons[(i + 1) % len(tons)], bouts=(False, True))
        return s
    # Tas de bois: deux piquets de chaque côté, les bûches rangées en travers, en trois rangs.
    piquet = ctx.tons("piquet")
    for cx in (-0.4, 0.4):
        for cz in (-0.17, 0.17):
            s.box(0.06, 0.78, 0.06, at(cx, 0.39, cz, 0.1, penche(graine + cx + cz, 0.03), penche(graine + cx, 0.03)), "bois", piquet[int(cx > 0)], tremble=0.008)
    rangs = [(0.085, 4), (0.24, 4), (0.39, 3), (0.53, 2)] if not vide else [(0.085, 2)]
    k = 0
    for y, nombre in rangs:
        for i in range(nombre):
            pas = 0.72 / max(4, nombre)
            x = (i - (nombre - 1) / 2) * pas + penche(graine + k, 0.012)
            if vide:
                x = -0.2 + i * 0.19
            r = entre(0.07, 0.086, graine + k * 1.9)
            _buche(s, ctx, x, y, penche(graine + k * 3, 0.03), math.pi / 2 + penche(graine + k, 0.08), 0.44, r, graine + k)
            k += 1
    if vide:
        for i in range(3):
            s.box(0.1, 0.02, 0.05, at(0.1 + i * 0.09, 0.012, penche(graine + i, 0.15), i * 1.3), "bois", ctx.un("bois_coupe", i), tremble=0.006)
    return s


def bois(entree: dict, ctx: Contexte) -> list[dict]:
    formes = [{"suffixe": "", "graine": entree["graine"]}] + [{"suffixe": "-" + v["suffixe"], "graine": v["graine"]} for v in entree.get("variantes", [])]
    out = []
    tas = entree["sorte"] == "tas"
    for f in formes:
        ident = entree["id"] + f["suffixe"]
        etats_ids = {}
        if "bare" in entree.get("etats", []):
            etats_ids["bare"] = f"{ident}-bare"
            out.append(_modele(etats_ids["bare"], _un_bois(entree, ctx, f["graine"], True), etat="bare", de=ident))
        notice = {} if tas else {"jitter": {"yaw": True, "scale": [0.9, 1.1]}}
        out.append(_modele(ident, _un_bois(entree, ctx, f["graine"], False), states=etats_ids, variants=[entree["id"] + g["suffixe"] for g in formes if g is not f], **notice))
    return out


# ====================================================================== repères discrets
def repere(entree: dict, ctx: Contexte) -> list[dict]:
    graine = entree["graine"]
    s = Atelier(graine)
    sorte = entree["sorte"]
    if sorte == "fouille":
        # Terre remuée: une motte basse, des mottes rejetées autour, et des éclats clairs qui
        # affleurent: c'est eux qu'on repère (« le sol scintille »).
        terre = ctx.tons("terre_billon")
        s.galet(0.3, 0.1, 0.26, at(0, 0, 0, graine), "terre", terre[0], graine, points=13, dessus=ctx.un("terre_billon_dessus"), pose=0.3)
        for i in range(4):
            a = graine + i * 1.7
            rr = entre(0.05, 0.08, graine + i)
            s.galet(rr, rr * 0.6, rr, at(math.cos(a) * 0.32, 0, math.sin(a) * 0.32, a), "terre", terre[(i + 1) % len(terre)], graine + i + 3, points=7, pose=0.25)
        quartz = ctx.tons("quartz")
        for i in range(4):
            a = graine * 1.3 + i * 1.7
            d = 0.0 if i == 0 else entre(0.1, 0.2, graine + i * 3.1)
            h = entre(0.13, 0.18, graine + i * 1.9) * (1.15 if i == 0 else 0.8)
            # Éclat dressé: un cristal à quatre pans, penché.
            s.morceau(
                [(-0.045, 0, -0.035), (0.045, 0, -0.035), (0.035, 0, 0.042), (-0.038, 0, 0.038), (0.006, h, 0.0)],
                [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)],
                "pierre",
                quartz[i % len(quartz)],
                at(math.cos(a) * d, 0.05, math.sin(a) * d, a, penche(graine + i, 0.4), penche(graine + i + 1, 0.4)),
            )
        return [_modele(entree["id"], s, states={}, variants=[], jitter={"yaw": True, "scale": [0.95, 1.05]})]
    if sorte == "peche":
        # Coin de pêche: une touffe de roseaux larges et de massettes, un piquet d'amarre usé.
        roseau = ctx.tons("roseau")
        for i in range(7):
            a = graine + i * 2.4
            d = entre(0.03, 0.16, graine + i * 1.7)
            x, z = math.cos(a) * d - 0.14, math.sin(a) * d
            h = entre(0.42, 0.7, graine + i * 2.9)
            # En gerbe: chaque feuille monte puis retombe vers le dehors, on la voit de dessus.
            s.feuille((x, 0, z), (math.cos(a) * 0.4, 1.0, math.sin(a) * 0.4), h, 0.17, "tige", roseau[i % len(roseau)], envers=ton(roseau[0], 0.86), cambre=0.45, pli=0.012)
        for i in range(3):
            x, z = -0.14 + penche(graine + i * 2, 0.12), penche(graine + i * 3, 0.12)
            h = entre(0.85, 1.1, graine + i)
            s.tube([(x, 0, z, 0.013), (x + penche(graine + i, 0.05), h, z, 0.01)], 3, "tige", roseau[i % len(roseau)], rond=True)
            s.tube([(x + penche(graine + i, 0.05), h - 0.02, z, 0.036), (x + penche(graine + i, 0.05), h + 0.16, z, 0.03)], 5, "fleur", ctx.un("massette"), bouts=(True, True))
        s.box(0.1, 0.66, 0.1, at(0.24, 0.33, 0.05, 0.3, 0.05, -0.06), "bois", ctx.un("bois_mort"), tremble=0.01, dessus=ctx.un("bois_coupe"))
        # Le bouchon oublié, pendu au piquet: rouge et blanc, c'est lui qui dit « on pêche ici ».
        s.octa(0.09, 0.06, 0.09, at(0.26, 0.74, 0.07), "fleur", ctx.un("ombelle"))
        s.octa(0.08, 0.085, 0.08, at(0.26, 0.82, 0.07), "fleur", ctx.un("coquelicot"))
        return [_modele(entree["id"], s, states={}, variants=[])]
    if sorte == "insectes":
        # Coin à insectes: de grandes ombelles blanches, là où butinent les papillons.
        tige = ctx.tons("tige")
        blanc = ctx.tons("ombelle")
        _touffe_d_herbe(s, ctx, 0, 0, graine, 0.3, 7)
        for i in range(4):
            a = graine + i * 1.9
            d = entre(0.08, 0.26, graine + i * 3.3)
            x, z = math.cos(a) * d, math.sin(a) * d
            h = entre(0.5, 0.82, graine + i * 1.3)
            tx, tz = x + penche(graine + i, 0.08), z + penche(graine + i + 1, 0.08)
            s.tube([(x, 0, z, 0.012), (tx, h, tz, 0.009)], 3, "tige", tige[i % len(tige)], rond=True)
            ro = entre(0.12, 0.16, graine + i * 2.2)
            pts = [(0, 0.03, 0)] + [(math.cos(k / 6 * math.tau) * ro, -0.012 if k % 2 else 0.0, math.sin(k / 6 * math.tau) * ro) for k in range(6)]
            s.morceau(pts, [(0, k + 1, (k + 1) % 6 + 1) for k in range(6)], "fleur", blanc[i % len(blanc)], at(tx, h, tz, a, penche(graine + i, 0.25), penche(graine + i + 5, 0.25)), coeur=(0, -1, 0), double=True, envers=ton(blanc[1], 0.85))
        return [_modele(entree["id"], s, states={}, variants=[], jitter={"yaw": True, "scale": [0.92, 1.08]})]
    raise SystemExit(f"{entree['id']}: sorte de repère inconnue « {sorte} »")


# ====================================================================== potager: sol travaillé
def _billons(s: Atelier, ctx: Contexte, graine: float, mouille: bool):
    """Une case bêchée: une planche de terre relevée, d'un seul tenant, qui porte trois billons
    (une terre retournée, pas des planches de bois): crêtes bosselées qui serpentent, flancs plus
    sombres, sillons creux, bords en talus."""
    tons = ctx.tons("terre_mouillee" if mouille else "terre_billon")
    crete = ctx.un("terre_mouillee_dessus" if mouille else "terre_billon_dessus")
    demi = 0.455
    xs = (-demi - 0.03, -demi, -0.23, 0.0, 0.23, demi, demi + 0.03)
    # Profil d'un billon (écart à son axe, part de sa hauteur): sillon, flanc, crête, flanc.
    profil = ((-0.15, 0.0), (-0.075, 0.6), (0.0, 1.0), (0.075, 0.6))
    v, rang = [], 0
    for xi, x in enumerate(xs):
        talus = xi in (0, len(xs) - 1)
        bout = xi in (1, len(xs) - 2)
        colonne = [(x + penche(graine + xi * 3.7, 0.012), 0.0, -demi - 0.03)]
        for bi, zc in enumerate(BILLONS_Z):
            h = BILLON_H * entre(0.75, 1.3, graine + bi * 3.1 + xi * 1.7) * (0.0 if bout or talus else 1.0)
            dz = penche(graine + bi * 5.3 + xi * 2.9, 0.03)
            for dzp, part in profil:
                z = zc + dzp + (dz if part else dz * 0.4)
                if bi == 0 and part == 0.0:
                    z = -demi
                colonne.append((x + penche(graine + xi + bi + part, 0.012), 0.0 if talus else PLANCHE_H + h * part, z))
        colonne.append((x, 0.0 if talus else PLANCHE_H, demi))
        colonne.append((x + penche(graine + xi * 2.3, 0.012), 0.0, demi + 0.03))
        rang = len(colonne)
        v += colonne
    faces, teintes = [], []
    for xi in range(len(xs) - 1):
        for k in range(rang - 1):
            a, b = xi * rang + k, (xi + 1) * rang + k
            faces.append((a, a + 1, b + 1, b))
            pos = (k - 1) % 4
            bord = xi in (0, len(xs) - 2) or k in (0, rang - 2)
            # Les deux pans de la crête: clairs; flancs et talus: plus sombres.
            teintes.append(crete if pos in (1, 2) and not bord else tons[(xi + k) % len(tons)])
    s.morceau(v, faces, "terre", teintes, coeur=(0, -5, 0), lisse=True)
    for i in range(3):
        zc = (-0.15, 0.15)[i % 2] + penche(graine + i, 0.02)
        x = -0.3 + i * 0.3 + penche(graine + i * 3, 0.05)
        rr = entre(0.035, 0.05, graine + i * 2.7)
        s.galet(rr, rr * 0.7, rr, at(x, PLANCHE_H - 0.008, zc, i), "terre", tons[(i + 1) % len(tons)], graine + i, points=7, pose=0.25)
    if mouille:
        # L'eau brille encore au fond des sillons.
        eau = ctx.un("flaque")
        for i, zc in enumerate((-0.15, 0.15)):
            x = (-0.2, 0.18)[i] + penche(graine + i, 0.08)
            y = PLANCHE_H + 0.012
            s.morceau([(x - 0.13, y, zc - 0.022), (x + 0.12, y, zc - 0.028), (x + 0.15, y, zc + 0.02), (x - 0.1, y, zc + 0.03)], [(0, 1, 2, 3)], "terre", eau, coeur=(x, -1, zc))


def _friche(s: Atelier, ctx: Contexte, entree: dict, graine: float):
    """Le potager en friche: un carré de terre tassée et bosselée au bord sinueux, des pierres
    plates en bordure, des herbes folles dans les angles et le long des bords (le milieu reste
    bas: les billons le recouvrent)."""
    W, D = entree["largeur"], entree["profondeur"]
    tons = ctx.tons("terre_friche")
    nx, nz = W * 2, D * 2
    v, faces, teintes = [], [], []
    for j in range(nz + 1):
        for i in range(nx + 1):
            bx, bz = i in (0, nx), j in (0, nz)
            x = -W / 2 + i * 0.5 + (0 if bx else penche(graine + i * 3.1 + j * 7.7, 0.14))
            z = -D / 2 + j * 0.5 + (0 if bz else penche(graine + i * 5.3 + j * 2.9, 0.14))
            # Le bord rentre plus ou moins: une terre gagnée sur l'herbe, pas un tapis.
            if bx:
                x -= math.copysign(entre(0.0, 0.11, graine + j * 3.3 + i), x)
            if bz:
                z -= math.copysign(entre(0.0, 0.11, graine + i * 4.7 + j), z)
            if bx and bz:
                x -= math.copysign(0.1, x)
                z -= math.copysign(0.1, z)
            v.append((x, 0.004 if bx or bz else entre(0.018, 0.058, graine + i * 1.3 + j * 4.1), z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + nx + 1, a + nx + 2, a + 1))
            teintes.append(tons[int(tirage(graine + i * 2.3 + j * 5.9) * len(tons)) % len(tons)])
    s.morceau(v, faces, "terre", teintes, coeur=(0, -50, 0), lisse=True)
    pierres = ctx.tons("pierre")
    dessus = ctx.un("pierre_dessus")
    k = 0
    for cote in range(4):
        long = W if cote % 2 == 0 else D
        for i in range(long + 1):
            # Une pierre à chaque limite de case (les billons s'arrêtent avant): il en manque,
            # la bordure est vieille.
            k += 1
            if tirage(graine + k * 3.7) < 0.3:
                continue
            t = min(long / 2 - 0.1, max(-long / 2 + 0.1, -long / 2 + i + penche(graine + k, 0.03)))
            e = 0.085
            if cote == 0:
                x, z = t, -D / 2 + e
            elif cote == 1:
                x, z = W / 2 - e, t
            elif cote == 2:
                x, z = t, D / 2 - e
            else:
                x, z = -W / 2 + e, t
            lo = entre(0.07, 0.1, graine + k * 1.9)
            s.galet(lo, entre(0.1, 0.14, graine + k), lo * 0.9, at(x, 0, z, tirage(graine + k) * 3.0), "pierre", pierres[k % len(pierres)], graine + k, points=9, dessus=dessus, pose=0.3)
    # Herbes folles aux quatre angles et contre la bordure.
    for i, (cx, cz) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1), (-0.33, -1), (0.4, 1), (-1, 0.1), (1, -0.2), (0.1, -1), (-0.6, 1))):
        x = cx * (W / 2 - 0.24) + penche(graine + i, 0.05)
        z = cz * (D / 2 - 0.24) + penche(graine + i + 9, 0.05)
        _touffe_d_herbe(s, ctx, x, z, graine + i * 3.3, entre(0.2, 0.32, graine + i), 5)
    # Petites rosettes plates et cailloux au milieu: la terre n'est pas nue.
    vert = ctx.tons("herbe")
    for i in range(W * D // 2):
        x = entre(-W / 2 + 0.5, W / 2 - 0.5, graine + i * 7.1)
        z = entre(-D / 2 + 0.5, D / 2 - 0.5, graine + i * 3.9)
        if i % 3 == 0:
            rr = entre(0.03, 0.045, graine + i)
            s.galet(rr, rr * 0.6, rr, at(x, 0.02, z, i), "pierre", pierres[i % len(pierres)], graine + i, points=7, pose=0.3)
            continue
        for k in range(3):
            a = graine + i + k * 2.1
            s.feuille((x, 0.045, z), (math.cos(a), 0.12, math.sin(a)), 0.07, 0.04, "tige", vert[(i + k) % len(vert)], envers=ton(vert[0], 0.75), cambre=0.1)


def parcelle(entree: dict, ctx: Contexte) -> list[dict]:
    graine = entree["graine"]
    s = Atelier(graine)
    _friche(s, ctx, entree, graine)
    etats_ids = {}
    out = []
    for etat in entree.get("etats", []):
        t = Atelier(graine + len(out) + 1)
        _billons(t, ctx, graine + len(out) * 7, etat == "watered")
        etats_ids[etat] = f"{entree['id']}-{etat}"
        out.append(_modele(etats_ids[etat], t, etat=etat, de=entree["id"], case=True))
    out.append(_modele(entree["id"], s, states=etats_ids, variants=[], famille_budget="potager"))
    return out


# ====================================================================== cultures
def _places(plants: int, graine: float):
    """Places des plants d'une case, sur le dessus des billons."""
    if plants <= 2:
        return [((-0.2, 0.2)[i] if plants == 2 else 0.0, BILLONS_Z[1] if plants == 1 else (BILLONS_Z[0], BILLONS_Z[2])[i]) for i in range(plants)]
    par_billon = max(1, plants // 3)
    out = []
    for bi, zc in enumerate(BILLONS_Z):
        for i in range(par_billon):
            x = (i + 0.5) / par_billon * 0.8 - 0.4 + (0.07 if bi % 2 else -0.07)
            out.append((x + penche(graine + bi * 3 + i, 0.03), zc + penche(graine + bi + i * 5, 0.012)))
    return out


def _rosette(s: Atelier, ctx: Contexte, entree: dict, x, z, graine, part: float, mur: bool, soif: bool):
    """Plant à racine: couronne de feuilles, collet coloré qui sort de terre à maturité."""
    tons = ctx.tons("feuille_soif" if soif else "feuille_potager")
    H = entree["hauteur"]
    y = SOL_PLANT
    if part <= 0.0:
        # Levée: deux cotylédons ronds, à plat.
        for k in range(2):
            a = graine + k * math.pi
            s.feuille((x, y + 0.012, z), (math.cos(a), 0.25, math.sin(a)), 0.055, 0.05, "tige", tons[2], envers=ton(tons[0], 0.75), cambre=0.2)
        return
    feuilles = 4 if part < 1 else 6
    long = H * (0.62 if part < 1 else 1.0)
    for k in range(feuilles):
        a = graine + k / feuilles * math.tau + penche(graine + k, 0.2)
        leve = (0.22 if soif else (1.0 if mur else 0.75)) * entre(0.8, 1.2, graine + k * 2.1)
        s.feuille((x, y, z), (math.cos(a), leve, math.sin(a)), long * entre(0.85, 1.1, graine + k), long * 0.42, "tige", tons[k % len(tons)], envers=ton(tons[0], 0.72), cambre=0.5 if soif else 0.3)
    if mur:
        # Le collet sort de terre, plus haut que le départ des feuilles: on le voit de dessus.
        rouge = ctx.tons(entree["fruit"])
        s.octa(0.062, 0.06, 0.062, at(x, y + 0.045, z, graine), "fruit", rouge[int(graine * 7) % len(rouge)])


def _tuteur(s: Atelier, ctx: Contexte, entree: dict, x, z, graine, stade: int, stades: int, soif: bool):
    """Pied attaché à un piquet: il monte de stade en stade, fleurit, puis porte ses fruits."""
    tons = ctx.tons("feuille_soif" if soif else "feuille_potager")
    H = entree["hauteur"]
    y = SOL_PLANT
    part = stade / stades
    if stade == 0:
        for k in range(2):
            a = graine + k * math.pi
            s.feuille((x, y + 0.03, z), (math.cos(a), 0.3, math.sin(a)), 0.07, 0.055, "tige", tons[2], envers=ton(tons[0], 0.75), cambre=0.2)
        s.tube([(x, y, z, 0.007), (x, y + 0.035, z, 0.006)], 3, "tige", tons[0], rond=True)
        return
    # Le piquet est planté au semis des vrais pieds: il dépasse toujours la plante.
    piquet = ctx.tons("piquet")
    s.box(0.035, H * 1.18, 0.035, at(x + 0.05, H * 0.59, z - 0.03, 0.4, penche(graine, 0.03), penche(graine + 1, 0.03)), "bois", piquet[int(graine) % len(piquet)], tremble=0.004)
    h = H * (0.36 + 0.64 * part)
    s.tube([(x, y, z, 0.014), (x + 0.015, y + h * 0.5, z, 0.012), (x + 0.03, y + h * 0.92, z - 0.015, 0.008)], 3, "tige", ton(tons[0], 0.85), rond=True)
    etages = 1 + round(part * 2)
    hauts = []
    for i in range(etages):
        t = (i + 1) / etages
        yy = y + h * (0.2 + 0.62 * t)
        r = (0.17 - 0.035 * i) * (0.72 + 0.28 * part) * (0.98 if not soif else 1.06)
        a = graine + i * 2.2
        ox, oz = math.cos(a) * 0.05, math.sin(a) * 0.05
        s.calotte(x + ox, yy - r * (0.5 if not soif else 0.62), z + oz, r, graine + i * 3.7, tons[i % len(tons)], segments=7, dome=0.85 if not soif else 0.45, dents=0.28 if not soif else 0.5, laches=0, rangs=2)
        hauts.append((x + ox, yy - r * 0.3, z + oz, r))
    if stade == stades - 1 and stades > 2 and "fleur" in entree:
        # Avant la maturité: des fleurs jaunes, la promesse des fruits.
        for i in range(4):
            cx, cy, cz, r = hauts[i % len(hauts)]
            a = graine + i * 1.7
            s.octa(0.022, 0.016, 0.022, at(cx + math.cos(a) * r * 0.8, cy + r * 0.25, cz + math.sin(a) * r * 0.8), "fleur", ctx.un(entree["fleur"]))
    if stade == stades:
        rouge = ctx.tons(entree["fruit"])
        vert = ctx.un(entree.get("fruit_vert", entree["fruit"]))
        for i in range(6):
            cx, cy, cz, r = hauts[i % len(hauts)]
            a = graine * 1.3 + i * 1.1
            s.octa(0.058, 0.052, 0.058, at(cx + math.cos(a) * r * 0.8, cy + r * 0.2 + 0.02 * (i % 2), cz + math.sin(a) * r * 0.8, a), "fruit", vert if i == 5 else rouge[i % len(rouge)])


def culture(entree: dict, ctx: Contexte) -> list[dict]:
    fiche = ctx.cultures.get(entree["culture"])
    if fiche is not None:
        stades = len(fiche["stages"])
    elif "stades" in entree:
        # Fiche de culture pas encore écrite: le nombre de stades de l'entrée en tient lieu; la
        # fiche le remplace dès qu'elle existe (relancer construire.sh).
        stades = entree["stades"]
    else:
        raise SystemExit(f"{entree['id']}: culture inconnue « {entree['culture']} » (donnees/commun/cultures), ou `stades` à donner")
    graine = entree["graine"]
    plants = entree["plants"]
    out = []
    ids, soifs = [], []
    for stade in range(stades + 1):
        for soif in (False, True):
            if soif and stade == stades:
                continue
            s = Atelier(graine + stade)
            for i, (x, z) in enumerate(_places(plants, graine)):
                g = graine + i * 3.3
                if entree["port"] == "rosette":
                    _rosette(s, ctx, entree, x, z, g, stade / stades if stade < stades else 1.0, stade == stades, soif)
                elif entree["port"] == "tuteur":
                    _tuteur(s, ctx, entree, x, z, g, stade, stades, soif)
                elif entree["port"] in PORTS:
                    PORTS[entree["port"]](s, ctx, entree, x, z, g, stade, stades, soif)
                else:
                    raise SystemExit(f"{entree['id']}: port inconnu « {entree['port']} »")
            ident = f"{entree['id']}-{stade}" + ("-thirsty" if soif else "")
            (soifs if soif else ids).append(ident)
            out.append(_modele(ident, s, stade=stade, plants=plants, case=True, etat="thirsty" if soif else ("ripe" if stade == stades else "growing"), de=entree["id"]))
    out.append({"culture": entree["id"], "fiche": entree["culture"], "stages": ids, "thirsty": soifs})
    return out


FAMILLES = {"arbre": arbre, "buisson": buisson, "rocher": rocher, "fleur": fleur, "bois": bois, "repere": repere, "parcelle": parcelle, "culture": culture}

# Haies, talus de berge, rangs du labour, meubles et ouvrages: `amenagements.py`.
from amenagements import FAMILLES_AMENAGEMENTS  # noqa: E402
# Objets d'intérieur: `interieurs.py`; trains vus du dehors: `vehicules.py`.
from interieurs import FAMILLES_INTERIEURS  # noqa: E402
from vehicules import FAMILLES_VEHICULES  # noqa: E402
# Ports des cultures (carotte, poireau, pomme de terre, fleurs): `plantes.py`; décor des fêtes:
# `fetes.py`.
from plantes import PORTS  # noqa: E402
from fetes import FAMILLES_FETES  # noqa: E402

FAMILLES.update(FAMILLES_AMENAGEMENTS)
FAMILLES.update(FAMILLES_INTERIEURS)
FAMILLES.update(FAMILLES_VEHICULES)
FAMILLES.update(FAMILLES_FETES)
