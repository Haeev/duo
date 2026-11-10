"""Assembleur: d'une fiche de bâtiment (données) à sa géométrie, sans Blender.

La fiche (`donnees/lieux/<lieu>/batiments/<id>.json`, gabarit commenté dans
`donnees/_gabarits/batiment.jsonc`) décrit un corps principal et, s'il en faut, des annexes:
emprise, niveaux, finition, toit, ouvertures par façade, options. Les façades sont nommées dans
le repère du monde (nord, est, sud, ouest): le modèle se pose en rotation 0, son origine au
centre de l'emprise, au sol.

Une maison de plus = une fiche de plus. Aucune ligne de ce fichier ne nomme un bâtiment.
"""

from __future__ import annotations

import math

import numpy as np

import pieces as P
import toits as R
from atelier import Atelier, at, tirage

COTES = {"sud": 0.0, "est": math.pi / 2, "nord": math.pi, "ouest": -math.pi / 2}
"""Lacet du repère de chaque façade: +z du mur vers le dehors."""
MARGE = 0.3
"""Distance minimale entre une ouverture et l'angle du bâtiment (la chaîne d'angle y est)."""

# Ouvertures: largeur et hauteur du tableau, bas du tableau au rez-de-chaussée, encombrement
# sur la façade (volets rabattus compris).
OUVERTURES = {
    "fenetre": dict(l=0.95, h=1.25, bas=1.0, enc=2.3, volets="ouverts"),
    "fenetre-etroite": dict(l=0.7, h=1.25, bas=1.0, enc=1.8, volets="ouverts"),
    "fenetre-close": dict(l=0.95, h=1.25, bas=1.0, enc=1.5, volets="fermes"),
    "fenetre-nue": dict(l=0.95, h=1.25, bas=1.0, enc=1.5, volets="aucun"),
    "petite-fenetre": dict(l=0.6, h=0.7, bas=1.4, enc=1.1, volets="aucun"),
    "vitrail": dict(l=0.8, h=2.6, bas=1.7, enc=1.5),
    "abat-sons": dict(l=1.1, h=2.2, bas=0.6, enc=1.9),
    "porte": dict(l=P.PORTE_LARGE, enc=1.7),
    "porte-service": dict(l=P.PORTE_LARGE, enc=1.7),
    "vitrine": dict(l=2.4, enc=3.0),
    "grange": dict(l=2.4, h=2.7, enc=3.1),
    "cochere": dict(l=2.4, h=2.9, enc=3.1),
    "baie": dict(l=2.4, h=2.7, enc=3.1),
}
NIVEAUX_CLES = ("rdc", "etage", "etage2", "pignon")
PIECES_OPTIONS = ("cheminee", "lucarne", "enseigne", "auvent", "pendule", "drapeau", "roue", "bassin", "croix", "escalier", "contrefort")


class FicheInvalide(ValueError):
    pass


def hauteur_des_murs(niveaux: int) -> float:
    return 0.4 + 2.3 * niveaux


def _repere(cx, cz, largeur, profondeur, cote):
    """Repère d'une façade d'un corps centré en (cx, cz) et sa longueur."""
    a = COTES[cote]
    demi = profondeur / 2 if cote in ("sud", "nord") else largeur / 2
    return at(cx + math.sin(a) * demi, 0, cz + math.cos(a) * demi, a), (largeur if cote in ("sud", "nord") else profondeur)


def _element(item):
    e = {"type": item} if isinstance(item, str) else dict(item)
    if e.get("type") not in OUVERTURES:
        raise FicheInvalide(f"ouverture inconnue « {e.get('type')} » (connues: {', '.join(OUVERTURES)})")
    base = OUVERTURES[e["type"]]
    if "largeur" in e:
        e["enc"] = base["enc"] + e["largeur"] - base["l"]
    else:
        e["largeur"] = base["l"]
        e["enc"] = base["enc"]
    return e


def disposer(elements, longueur, ou):
    """Place des ouvertures le long d'une façade (x depuis son milieu): celles qui ont une
    `position` (0 à 1 depuis la gauche vue de dehors) y sont; les autres se répartissent, dans
    l'ordre, dans les intervalles libres, de façon à garder les plus grands trumeaux."""
    fixes = [(i, (e["position"] - 0.5) * longueur) for i, e in enumerate(elements) if "position" in e]
    libres = [i for i, e in enumerate(elements) if "position" not in e]
    x = [0.0] * len(elements)
    for i, v in fixes:
        x[i] = v
    # Une ouverture qui donne sa hauteur (`bas`) est hors rang: une baie de clocher au-dessus
    # d'une fenêtre ne lui prend pas sa place sur le mur.
    fixes = [(i, v) for i, v in fixes if "bas" not in elements[i]]
    bornes = sorted((x[i] - elements[i]["enc"] / 2, x[i] + elements[i]["enc"] / 2, i) for i, _ in fixes)
    for k in range(len(bornes) - 1):
        if bornes[k][1] > bornes[k + 1][0] + 1e-6:
            raise FicheInvalide(f"{ou}: deux ouvertures placées se chevauchent")
    for a, b, i in bornes:
        if a < -longueur / 2 + MARGE - 0.06 or b > longueur / 2 - MARGE + 0.06:
            raise FicheInvalide(f"{ou}: « {elements[i]['type']} » trop près de l'angle (il faut {MARGE} m)")
    # Intervalles libres entre les angles et les ouvertures placées. Une ouverture libre écrite
    # avant une ouverture placée reste à sa gauche: l'ordre de la fiche est l'ordre sur le mur.
    travees, debut, avant = [], -longueur / 2 + MARGE, 0
    ordre_fixes = sorted(fixes, key=lambda f: f[1])
    for i, v in ordre_fixes:
        travees.append((debut, v - elements[i]["enc"] / 2, [j for j in libres if avant <= j < i]))
        debut, avant = v + elements[i]["enc"] / 2, i + 1
    travees.append((debut, longueur / 2 - MARGE, [j for j in libres if j >= avant]))
    for a, b, groupe in travees:
        if not groupe:
            continue
        total = sum(elements[j]["enc"] for j in groupe)
        jeu = (b - a - total) / (len(groupe) + 1)
        if jeu < -0.02:
            raise FicheInvalide(f"{ou}: {total:.2f} m d'ouvertures pour {b - a:.2f} m de mur libre; retire une ouverture ou prends une fenêtre étroite")
        jeu = max(jeu, 0.0)
        c = a
        for j in groupe:
            c += jeu
            x[j] = c + elements[j]["enc"] / 2
            c += elements[j]["enc"]
    return x


def _libre(x0, x1, y0, y1, interdits):
    return not any(x0 < b and x1 > a and y0 < d and y1 > c for a, b, c, d in interdits)


class Corps:
    """Un corps de bâtiment: sa boîte, ses murs, son toit."""

    def __init__(self, donnees, emprise, defaut_couleurs, nuancier, principal):
        self.d = donnees
        place = donnees.get("place") or {"x": 0, "y": 0, "largeur": emprise["largeur"], "profondeur": emprise["profondeur"]}
        self.largeur, self.profondeur = place["largeur"], place["profondeur"]
        if place["x"] < 0 or place["y"] < 0 or place["x"] + self.largeur > emprise["largeur"] + 1e-6 or place["y"] + self.profondeur > emprise["profondeur"] + 1e-6:
            raise FicheInvalide(f"le corps « {donnees.get('nom', 'principal')} » sort de l'emprise")
        self.cx = -emprise["largeur"] / 2 + place["x"] + self.largeur / 2
        self.cz = -emprise["profondeur"] / 2 + place["y"] + self.profondeur / 2
        self.niveaux = donnees.get("niveaux", 1)
        self.haut = donnees.get("hauteurMurs", hauteur_des_murs(self.niveaux))
        self.murs = donnees.get("murs", "pleins")
        self.finition = donnees.get("finition", "crepi")
        self.T = P.teintes(nuancier, self.finition, {**defaut_couleurs, **donnees.get("couleurs", {})})
        toit = donnees.get("toit", {})
        self.forme = toit.get("forme", "deux-pans")
        self.pente = toit.get("pente", 40)
        self.debord = toit.get("debord", 0.45)
        self.gouttieres = toit.get("gouttieres", True)
        if self.forme == "appentis":
            bas = toit.get("basVers", "sud")
            self.lacet = COTES[bas]
        else:
            faitage = toit.get("faitage", "est-ouest" if self.largeur >= self.profondeur else "nord-sud")
            if self.forme == "croupe":
                faitage = "est-ouest" if self.largeur >= self.profondeur else "nord-sud"
            self.lacet = 0.0 if faitage == "est-ouest" else math.pi / 2
        tourne = abs(math.sin(self.lacet)) > 0.5
        self.long = self.profondeur if tourne else self.largeur
        self.portee = self.largeur if tourne else self.profondeur
        self.facades = donnees.get("facades", {})
        self.sans_mur = donnees.get("sansMur", [])
        self.options = donnees.get("options", [])
        self.principal = principal

    def cote_du_toit(self, cote):
        """Côté du repère du toit (+z, +x, -z, -x) auquel correspond une façade du monde."""
        q = round((COTES[cote] - self.lacet) / (math.pi / 2)) % 4
        return ("+z", "+x", "-z", "-x")[q]

    def cote_du_monde(self, cote_toit):
        return next(c for c in COTES if self.cote_du_toit(c) == cote_toit)

    def profil(self, cote):
        return R.profil_du_mur(self.forme, self.cote_du_toit(cote), self.portee, self.pente)

    def haut_a(self, cote, x, longueur):
        """Hauteur du mur d'une façade au point x (depuis son milieu)."""
        pr = self.profil(cote)
        if pr is None:
            return self.haut
        if pr[0] == "pignon":
            return self.haut + pr[1] * (1 - abs(x) / (longueur / 2))
        t = x / longueur + 0.5
        return self.haut + pr[1] * (1 - t) + pr[2] * t


def assembler(fiche: dict, nuancier: dict, economie: int = 0):
    """Rend l'atelier rempli et la notice du bâtiment (cotes, porte, fenêtres éclairées)."""
    for cle in ("id", "emprise"):
        if cle not in fiche:
            raise FicheInvalide(f"champ « {cle} » manquant")
    emprise = fiche["emprise"]
    graine = sum(ord(c) * (i + 1) for i, c in enumerate(fiche["id"])) % 997
    s = Atelier(graine)
    corps = [Corps(fiche, emprise, {}, nuancier, True)]
    for annexe in fiche.get("annexes", []):
        corps.append(Corps(annexe, emprise, fiche.get("couleurs", {}), nuancier, False))
    notice = {"fenetres": [], "porte": None, "hauteur": 0.0}

    # La porte d'entrée se donne sur l'emprise: on cherche le mur qui la porte.
    porte = fiche.get("porte")
    porte_sur = None
    if porte is not None:
        m, longueur = _repere(0, 0, emprise["largeur"], emprise["profondeur"], porte["facade"])
        point = m @ np.array([(porte.get("position", 0.5) - 0.5) * longueur, 0, 0, 1.0])
        # « ouverte »: on entre par un côté sans mur (lavoir, halle sur poteaux).
        for c in corps if porte.get("modele") != "ouverte" else []:
            mc, lc = _repere(c.cx, c.cz, c.largeur, c.profondeur, porte["facade"])
            local = np.linalg.inv(mc) @ point
            if abs(local[2]) < 0.01 and abs(local[0]) <= lc / 2 and c.murs == "pleins" and porte["facade"] not in c.sans_mur:
                porte_sur = (c, local[0] / lc + 0.5)
                break
        if porte_sur is None and porte.get("modele") != "ouverte":
            raise FicheInvalide(f"aucun mur plein sur la façade {porte['facade']} de l'emprise à la position {porte.get('position', 0.5)}: la porte n'a pas de mur")
        notice["porte"] = {"facade": porte["facade"], "position": porte.get("position", 0.5), "x": round(float(point[0]), 3), "z": round(float(point[2]), 3)}

    for k, c in enumerate(corps):
        _corps(s, c, graine + k * 131, economie, porte if porte_sur and porte_sur[0] is c else None, porte_sur[1] if porte_sur and porte_sur[0] is c else None, notice, fiche["id"])
    bas, haut = s.boite()
    notice["hauteur"] = round(float(haut[1]), 3)
    notice["boite"] = [[round(float(v), 3) for v in bas], [round(float(v), 3) for v in haut]]
    return s, notice


def _corps(s: Atelier, c: Corps, graine, economie, porte, porte_position, notice, ident):
    T = c.T
    # Tuiles à la taille de la référence; plus larges seulement si le budget l'exige.
    large = 1.0 + 0.3 * economie
    with s.groupe(at(c.cx, 0, c.cz, c.lacet)):
        faite, descentes = R.toit(s, T, c.forme, c.long, c.portee, c.haut, c.pente, c.debord, graine, large, c.gouttieres and c.murs == "pleins")
    c.faite = faite

    if c.murs == "poteaux":
        _poteaux(s, c, graine)
    else:
        for n, cote in enumerate(COTES):
            if cote in c.sans_mur:
                continue
            m, longueur = _repere(c.cx, c.cz, c.largeur, c.profondeur, cote)
            with s.groupe(m):
                _facade(s, c, cote, longueur, graine + n * 17, economie, porte if porte and porte["facade"] == cote else None, porte_position, notice, m, ident)
        for cote_toit, x, h in descentes:
            cote = c.cote_du_monde(cote_toit)
            if cote in c.sans_mur:
                continue
            m, longueur = _repere(c.cx, c.cz, c.largeur, c.profondeur, cote)
            with s.groupe(m @ at(x, 0, 0)):
                P.descente(s, T, h, graine)

    for k, option in enumerate(c.options):
        _option(s, c, option, graine + 300 + k * 7, ident)


def _facade(s: Atelier, c: Corps, cote, longueur, graine, economie, porte, porte_position, notice, matrice, ident):
    T = c.T
    ou = f"{ident}, façade {cote}"
    niveaux = c.facades.get(cote, {})
    for cle in niveaux:
        if cle not in NIVEAUX_CLES:
            raise FicheInvalide(f"{ou}: niveau inconnu « {cle} » (connus: {', '.join(NIVEAUX_CLES)})")
    places = []  # (élément, x, bas)
    rdc = [_element(i) for i in niveaux.get("rdc", [])]
    entrees = [e for e in rdc if e["type"] == "porte"]
    if porte is None and entrees:
        raise FicheInvalide(f"{ou}: « porte » désigne la porte d'entrée, qui est sur une autre façade; pour une seconde porte, écris « porte-service »")
    if porte is not None:
        if len(entrees) > 1:
            raise FicheInvalide(f"{ou}: une seule « porte » (les autres sont des « porte-service »)")
        if not entrees:
            # La fiche ne dit pas où est la porte dans l'ordre des ouvertures: au milieu.
            rdc.insert(len(rdc) // 2, _element("porte"))
            entrees = [rdc[len(rdc) // 2]]
        entrees[0].update(position=porte_position, modele=porte.get("modele", "pleine"))
        if porte.get("modele") in ("grange", "cochere", "baie"):
            # L'entrée est une porte charretière ou une baie ouverte: on y passe de plain-pied.
            large = porte.get("largeur", OUVERTURES[porte["modele"]]["l"])
            entrees[0].update(type=porte["modele"], largeur=large, enc=OUVERTURES[porte["modele"]]["enc"] + large - OUVERTURES[porte["modele"]]["l"])
            if "hauteur" in porte:
                entrees[0]["hauteur"] = porte["hauteur"]
    xs = disposer(rdc, longueur, ou + " (rdc)")
    centres_rdc = sorted(xs)
    for e, x in zip(rdc, xs):
        places.append((e, x, 0.0))
    for k, cle in enumerate(("etage", "etage2")):
        etage = [_element(i) for i in niveaux.get(cle, [])]
        if not etage:
            continue
        if k + 2 > c.niveaux:
            raise FicheInvalide(f"{ou}: des ouvertures à « {cle} » mais {c.niveaux} niveau(x)")
        if len(etage) == len(centres_rdc) and all("position" not in e for e in etage):
            xe = centres_rdc
        else:
            xe = disposer(etage, longueur, ou + f" ({cle})")
        for e, x in zip(etage, xe):
            places.append((e, x, 2.3 * (k + 1)))
    pignon = [_element(i) for i in niveaux.get("pignon", [])]
    if pignon:
        if c.profil(cote) is None:
            raise FicheInvalide(f"{ou}: des ouvertures au pignon, mais cette façade n'a pas de pignon")
        xp = disposer(pignon, min(longueur, 3.0 + len(pignon)), ou + " (pignon)")
        for e, x in zip(pignon, xp):
            places.append((e, x, c.haut - 1.1))

    trous, interdits, seuils = [], [], []
    for e, x, niveau in places:
        t = e["type"]
        o = OUVERTURES[t]
        if t in ("porte", "porte-service"):
            trous.append(P.trou_porte(T, x, e.get("modele", "pleine")))
            interdits.append((x - 0.95, x + 0.95, 0, 2.75))
            seuils.append((x - 0.82, x + 0.82))
        elif t == "vitrine":
            trous.append(P.trou_vitrine(T, x, e["largeur"]))
            interdits.append((x - e["largeur"] / 2 - 0.4, x + e["largeur"] / 2 + 0.4, 0, 3.0))
            seuils.append((x - e["largeur"] / 2 - 0.2, x + e["largeur"] / 2 + 0.2))
        elif t in ("grange", "cochere", "baie"):
            e["_h"] = e.get("hauteur", o["h"])
            if e["_h"] + 0.45 > c.haut_a(cote, x, longueur):
                raise FicheInvalide(f"{ou}: « {t} » de {e['_h']} m plus son linteau dépasse le haut du mur ({c.haut_a(cote, x, longueur):.2f} m)")
            trous.append(P.trou_grange(T, x, e["largeur"], e["_h"]))
            interdits.append((x - e["largeur"] / 2 - 0.55, x + e["largeur"] / 2 + 0.55, 0, e["_h"] + 0.6))
            seuils.append((x - e["largeur"] / 2 - 0.32, x + e["largeur"] / 2 + 0.32))
        else:
            etage = niveau > 0
            l = e["largeur"] if "largeur" in e and e["largeur"] != o["l"] else (0.8 if etage and t == "fenetre" else o["l"])
            h = e.get("hauteur", 1.0 if etage and t.startswith("fenetre") else o["h"])
            bas = e.get("bas", o["bas"]) + niveau
            e["_l"], e["_h"], e["_bas"] = l, h, bas
            if bas + h + 0.3 > c.haut_a(cote, x, longueur) + 0.02:
                raise FicheInvalide(f"{ou}: « {t} » dépasse le haut du mur ({bas + h + 0.3:.2f} m pour {c.haut_a(cote, x, longueur):.2f} m)")
            if t == "abat-sons":
                trous.append(P.trou_haut(T, x, bas, l, h))
            else:
                trous.append(P.trou_fenetre(T, x, bas, l, h))
            demi = (l + 0.2 + (l if o.get("volets") == "ouverts" else 0.0)) / 2 + 0.25
            interdits.append((x - demi, x + demi, bas - 0.3, bas + h + 0.45))

    P.peau_de_mur(s, T, longueur, c.haut, trous, c.profil(cote), graine)
    P.moellons_bas(s, T, -longueur / 2, longueur / 2, graine, seuils)
    droite = c.haut_a(cote, longueur / 2, longueur)
    P.chaine_angle(s, T, longueur / 2, 0.58, droite - 0.12, graine)
    ouvertures_interdites = list(interdits)
    interdits.append((-longueur / 2 - 1, -longueur / 2 + 0.62, 0, 99))
    interdits.append((longueur / 2 - 0.62, longueur / 2 + 1, 0, 99))

    # Le relief propre à la finition.
    if c.finition == "pierre":
        densite = (0.42, 0.3, 0.2, 0.12)[min(economie, 3)]
        rang = 0
        y = 0.78
        sommet = max(c.haut_a(cote, x, longueur) for x in (-longueur / 2, 0, longueur / 2))
        while y + 0.35 < sommet:
            n = int(longueur * densite + tirage(graine + rang) * 1.5)
            for k in range(n):
                g = graine + rang * 37 + k * 11
                long = 0.32 + tirage(g) * 0.26
                x = -longueur / 2 + 0.7 + tirage(g + 1) * (longueur - 1.4)
                if y + 0.45 < c.haut_a(cote, x, longueur) and _libre(x - long / 2 - 0.05, x + long / 2 + 0.05, y - 0.13, y + 0.13, interdits):
                    P.moellon(s, T, x, y, long, 0.22, g)
                    interdits.append((x - long / 2, x + long / 2, y - 0.1, y + 0.1))
            y += 0.52
            rang += 1
    elif c.finition == "crepi":
        for k in range(3 if economie == 0 else 2):
            g = graine + k * 41
            x = -longueur / 2 + 0.8 + tirage(g) * (longueur - 2.2)
            y = 0.8 + tirage(g + 1) * 0.5 + (c.haut - 2.0 if k == 2 else 0)
            if _libre(x - 0.25, x + 0.95, y - 0.15, y + 0.5, interdits):
                P.pierres_nues(s, T, x, y, g)
    else:
        # Bardage: des couvre-joints en saillie sur les planches, du soubassement au toit.
        pas = 0.5 * (1 + 0.5 * economie)
        n = int(longueur / pas)
        for k in range(1, n):
            x = -longueur / 2 + k * longueur / n
            haut = c.haut_a(cote, x, longueur) - 0.05
            coupes = sorted((a_y, b_y) for a_x, b_x, a_y, b_y in ouvertures_interdites if a_x + 0.2 < x < b_x - 0.2)
            y = 0.6
            for a_y, b_y in coupes + [(haut, haut)]:
                if a_y - y > 0.3:
                    s.box(0.08, a_y - y, 0.04, at(x, (y + a_y) / 2, 0.02), "bardage", T.mur[(k % 2) + 1], grain="y", tremble=0.004, sans="z-y-y+")
                y = max(y, b_y)

    for e, x, niveau in places:
        t = e["type"]
        g = int(graine + x * 10 + niveau * 3) % 1000
        if t in ("porte", "porte-service"):
            with s.groupe(at(x, 0, 0)):
                P.porte(s, T, e.get("modele", "pleine"), e.get("linteau", "bois" if c.finition != "pierre" else "pierre"), g)
        elif t == "vitrine":
            with s.groupe(at(x, 0, 0)):
                P.vitrine(s, T, e["largeur"], g)
        elif t in ("grange", "cochere", "baie"):
            with s.groupe(at(x, 0, 0)):
                P.porte_de_grange(s, T, e["largeur"], e["_h"], g, cochere=t == "cochere", ouverte=t == "baie")
        elif t == "vitrail":
            with s.groupe(at(x, e["_bas"], 0)):
                P.vitrail(s, T, e["_l"], e["_h"], g)
        elif t == "abat-sons":
            with s.groupe(at(x, e["_bas"], 0)):
                P.abat_sons(s, T, e["_l"], e["_h"], g)
        else:
            with s.groupe(at(x, e["_bas"], 0)):
                P.fenetre(s, T, e["_l"], e["_h"], OUVERTURES[t]["volets"], e.get("linteau", "bois" if c.finition != "pierre" else "pierre"), g)
            if niveau == 0 and OUVERTURES[t]["volets"] != "fermes":
                p = matrice @ np.array([x, e["_bas"], 0, 1.0])
                n = matrice @ np.array([0, 0, 1, 0.0])
                notice["fenetres"].append({"x": round(float(p[0]), 3), "appui": round(float(p[1]), 3), "z": round(float(p[2]), 3), "largeur": e["_l"], "hauteur": e["_h"], "nx": round(float(n[0]), 3), "nz": round(float(n[2]), 3)})


def _poteaux(s: Atelier, c: Corps, graine):
    """Corps ouvert: des poteaux de chêne sur dés de pierre, des sablières, des liens."""
    T = c.T
    retrait = 0.2
    for cote in ("sud", "nord"):
        m, longueur = _repere(c.cx, c.cz, c.largeur, c.profondeur, cote)
        n = max(2, round(longueur / 3.2) + 1)
        with s.groupe(m):
            h = c.haut_a(cote, 0, longueur) if c.profil(cote) is None or c.profil(cote)[0] == "trapeze" and c.profil(cote)[1] == c.profil(cote)[2] else c.haut
            pr = c.profil(cote)
            for i in range(n):
                x = -longueur / 2 + retrait + i * (longueur - 2 * retrait) / (n - 1)
                hx = c.haut_a(cote, x, longueur) if pr is not None and pr[0] == "trapeze" else h
                P.poteau(s, T, hx - 0.14, x, -retrait, graine + i)
                if i > 0:
                    P.lien(s, T, x, hx - 0.14, -retrait, vers_x=-1, graine=graine + i)
                if i < n - 1:
                    P.lien(s, T, x, hx - 0.14, -retrait, vers_x=1, graine=graine + i + 5)
            if pr is None or pr[1] == pr[2]:
                s.box(longueur + 0.3, 0.16, 0.16, at(0, h - 0.06, -retrait), "bois", T.bois[0], grain="x", tremble=0.012, sans="y-")
            else:
                pente = math.atan2(pr[2] - pr[1], longueur)
                s.box(longueur / math.cos(pente) + 0.3, 0.16, 0.16, at(0, c.haut + (pr[1] + pr[2]) / 2 - 0.06, -retrait, 0, 0, pente), "bois", T.bois[0], grain="x", tremble=0.012, sans="y-")
    for cote in ("est", "ouest"):
        m, longueur = _repere(c.cx, c.cz, c.largeur, c.profondeur, cote)
        pr = c.profil(cote)
        with s.groupe(m):
            if pr is None or pr[1] == pr[2]:
                h = c.haut_a(cote, 0, longueur)
                s.box(longueur + 0.3, 0.16, 0.16, at(0, h - 0.06, -retrait), "bois", T.bois[2], grain="x", tremble=0.012, sans="y-")
            else:
                pente = math.atan2(pr[2] - pr[1], longueur)
                s.box(longueur / math.cos(pente) + 0.3, 0.16, 0.16, at(0, c.haut + (pr[1] + pr[2]) / 2 - 0.06, -retrait, 0, 0, pente), "bois", T.bois[2], grain="x", tremble=0.012, sans="y-")


def _option(s: Atelier, c: Corps, o: dict, graine, ident):
    T = c.T
    piece = o.get("piece")
    if piece not in PIECES_OPTIONS:
        raise FicheInvalide(f"{ident}: option inconnue « {piece} » (connues: {', '.join(PIECES_OPTIONS)})")

    def mur(defaut_hauteur=0.0):
        cote = o.get("facade", "sud")
        m, longueur = _repere(c.cx, c.cz, c.largeur, c.profondeur, cote)
        return m @ at((o.get("position", 0.5) - 0.5) * longueur, o.get("hauteur", defaut_hauteur), 0), cote, longueur

    if piece == "cheminee":
        if o.get("forme", "souche") == "four":
            m, cote, _l = mur()
            with s.groupe(m):
                P.cheminee_de_four(s, T, o.get("sommet", c.faite + 0.9), graine)
        else:
            if c.forme == "appentis":
                raise FicheInvalide(f"{ident}: la souche se pose sur un faîtage; pour un appentis, prends la cheminée « four » adossée à un mur")
            crete = c.long if c.forme == "deux-pans" else max(0.0, c.long - c.portee)
            x = (o.get("position", 0.2) - 0.5) * crete
            dz = o.get("ecart", 0.55)
            with s.groupe(at(c.cx, 0, c.cz, c.lacet) @ at(x, c.faite + 0.9 - 1.9, -dz)):
                P.cheminee_souche(s, T, 1.9, graine)
    elif piece == "lucarne":
        m, cote, _l = mur()
        if c.profil(cote) is not None or (c.forme == "appentis" and c.cote_du_toit(cote) != "+z"):
            raise FicheInvalide(f"{ident}: une lucarne se pose côté égout, pas sur le pignon {cote}")
        with s.groupe(m):
            R.lucarne(s, T, c.haut, c.pente, graine)
    elif piece == "enseigne":
        if o.get("forme", "potence") == "bandeau":
            m, _c, _l = mur(2.75)
            with s.groupe(m):
                P.enseigne_bandeau(s, T, o.get("largeur", 2.2), graine)
        else:
            m, _c, _l = mur(3.2)
            with s.groupe(m):
                P.enseigne_potence(s, T, graine)
    elif piece == "auvent":
        m, _c, _l = mur()
        with s.groupe(m):
            auvent(s, T, o.get("largeur", 3.0), o.get("profondeur", 1.6), o.get("accroche", min(3.1, c.haut - 0.25)), graine)
    elif piece == "pendule":
        m, _c, _l = mur(3.0)
        with s.groupe(m):
            P.pendule(s, T, o.get("diametre", 0.9), graine)
    elif piece == "drapeau":
        m, _c, _l = mur(2.9)
        with s.groupe(m):
            P.drapeau(s, T, graine)
    elif piece == "roue":
        m, _c, _l = mur(o.get("diametre", 5.0) / 2 - o.get("enfonce", 0.6))
        with s.groupe(m):
            P.roue_de_moulin(s, T, o.get("diametre", 5.0), o.get("largeur", 0.9), graine)
    elif piece == "bassin":
        with s.groupe(at(c.cx + o.get("x", 0.0), 0, c.cz + o.get("y", 0.0), math.radians(o.get("rotation", 0)))):
            P.bassin(s, T, o.get("longueur", 3.2), o.get("largeur", 1.8), graine)
    elif piece == "croix":
        with s.groupe(at(c.cx, c.faite + 0.05, c.cz)):
            P.croix(s, T, o.get("hauteur", 1.6))
    elif piece == "escalier":
        m, _c, _l = mur()
        with s.groupe(m):
            P.escalier(s, T, o.get("monte", 2.5), o.get("largeur", 1.0), graine)
    elif piece == "contrefort":
        m, _c, _l = mur()
        with s.groupe(m):
            P.contrefort(s, T, o.get("monte", c.haut * 0.8), graine)


def auvent(s: Atelier, T, largeur, profondeur, accroche, graine):
    """Auvent en appentis adossé au mur (repère du mur): pan de tuiles sur chevrons, sablière
    portée par deux poteaux sur dés, ou par des consoles quand il avance de moins de 1,2 m."""
    p = math.radians(18)
    avance = profondeur + 0.12
    s_max = avance / math.cos(p)
    bord = accroche - avance * math.tan(p)
    demi = largeur / 2
    with s.groupe(at(0, bord, avance, 0, p)):
        R.pan(s, T, [(-demi, 0), (demi, 0), (demi, s_max), (-demi, s_max)], lambda sc: (-demi, demi), s_max, graine, (0, 1, 3), 1.0, None)
        n = max(2, round(largeur / 0.9))
        for i in range(n):
            u = -demi + 0.12 + i * (largeur - 0.24) / (n - 1)
            s.box(0.09, 0.11, s_max - 0.04, at(u, -R.VOLIGE - 0.055, -s_max / 2), "bois", T.bois[i % 3], grain="z", tremble=0.008, sans="y+z-")
    zp = profondeur - 0.22
    dessous = bord + (avance - zp) * math.tan(p) - R.VOLIGE - 0.11
    s.box(largeur - 0.04, 0.15, 0.15, at(0, dessous - 0.075, zp), "bois", T.bois[0], grain="x", tremble=0.012, sans="y-")
    if profondeur >= 1.2:
        for cote in (-1, 1):
            P.poteau(s, T, dessous - 0.15, cote * (demi - 0.2), zp, graine + cote)
            P.lien(s, T, cote * (demi - 0.2), dessous - 0.15, zp, vers_x=-cote, graine=graine + cote)
    else:
        for cote in (-1, 1):
            long = math.hypot(zp, zp)
            s.box(0.1, 0.1, long, at(cote * (demi - 0.25), dessous - 0.15 - zp / 2, zp / 2, 0, -math.pi / 4, 0), "bois", T.bois[1], grain="z", tremble=0.008)
