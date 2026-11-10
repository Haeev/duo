"""Toits d'Aubrune: rangs de tuiles épaisses posées une à une, faîtage, arêtiers, rives,
chevrons sous le débord, gouttières, lucarne.

Un pan se décrit dans son repère: origine au milieu du bord de l'égout, sur le dessus de la
volige; x le long de l'égout, y la normale du pan, -z la montée. Chaque rang de tuiles relève
son bord bas (la tuile est un peu plus plate que le pan): c'est ce ressaut qui fait le relief.
"""

from __future__ import annotations

import math

import numpy as np

from atelier import Atelier, at, choix, penche, tirage
from pieces import fenetre, peau_de_mur, trou_fenetre

PAS_RANG = 0.34
VOLIGE = 0.07
RELEVE = 0.12
"""Le dessus du toit passe 12 cm au-dessus de l'arase des murs, au nu du mur."""


def pan(s: Atelier, T, polygone, u_de, s_max, graine, flancs, large=1.0, chevrons=None):
    """Un pan: volige de bois, rangs de tuiles. `polygone`: points (u, s) du pan, s mesuré en
    montant depuis l'égout; `u_de(s)`: l'intervalle de u couvert à la hauteur s; `flancs`:
    côtés du polygone dont le chant se voit (égout, rives)."""
    s.prisme(polygone, VOLIGE, at(0, -VOLIGE / 2, 0, 0, -math.pi / 2, 0), "bois", T.bois[1], tremble=0.0, sans="z-", flancs=flancs)
    rangs = max(1, math.ceil((s_max - 0.12) / PAS_RANG))
    for r in range(rangs):
        sc = min(s_max - 0.2, 0.2 + r * PAS_RANG + penche(graine + r, 0.015))
        u0, u1 = u_de(sc)
        if u1 - u0 < 0.25:
            continue
        u = u0
        k = 0
        while u < u1 - 0.02:
            g = graine + r * 31 + k * 7
            w = min((0.5 + tirage(g) * 0.75) * large, u1 - u)
            if u1 - (u + w) < 0.3 * large:
                w = u1 - u
            sans = "y-z-" + ("" if k == 0 else "x-") + ("" if u + w >= u1 - 1e-6 else "x+")
            s.box(w - 0.012, 0.075, 0.44, at(u + w / 2, 0.06 + tirage(g + 2) * 0.02, -sc, 0, -0.13, 0), "tuile", choix(T.tuile, g + 3), grain="x", tremble=0.012, sans=sans)
            u += w
            k += 1
    if chevrons is not None:
        a, b = chevrons
        n = max(2, round((b - a) / 0.8))
        for i in range(n):
            u = a + (i + 0.5) * (b - a) / n
            s.box(0.1, 0.13, 0.62, at(u + penche(u + graine, 0.04), -VOLIGE - 0.065, -0.31), "bois", choix(T.bois, i + graine), grain="z", tremble=0.008, sans="y-y+z-")


def faitieres(s: Atelier, T, p0, p1, graine, rayon=0.2, bout_bas=False):
    """Tuiles faîtières demi-rondes de p0 (bas) à p1 (haut), chacune couvrant la suivante."""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    long = float(np.linalg.norm(d))
    if long < 0.2:
        return
    y = d / long
    haut = np.array([0.0, 1.0, 0.0])
    x = haut - np.dot(haut, y) * y
    x /= np.linalg.norm(x)
    z = np.cross(x, y)
    n = max(1, round(long / 0.46))
    pas = long / n
    for i in range(n):
        m = np.eye(4)
        m[:3, 0], m[:3, 1], m[:3, 2] = x, y, z
        m[:3, 3] = p0 + y * (i + 0.5) * pas + x * penche(i + graine, 0.012)
        s.cyl(rayon, rayon + 0.03, pas + 0.05, 4, m, "tuile", T.tuile[int(tirage(i * 5 + graine) * 3)], grain="y", tremble=0.008, arc=(-math.pi / 2, math.pi / 2), bouts=(i == 0 and bout_bas) or i == n - 1)


def rive(s: Atelier, T, u, s_max, cote, graine):
    """Planche de rive: elle ferme le bord du pan au-dessus du pignon."""
    s.box(0.05, 0.2, s_max, at(u + cote * 0.02, -0.1, -s_max / 2), "bois", choix(T.bois, graine), grain="z", tremble=0.006, sans="y-y+z-" + ("x-" if cote > 0 else "x+"))


def gouttiere(s: Atelier, T, longueur, graine=0):
    """Gouttière de zinc. Origine: milieu, sous le bord de l'égout."""
    s.box(longueur, 0.1, 0.14, at(0, -0.05, 0.07), "metal", T.zinc, tremble=0.006, sans="y-", dessus=T.fer)


def toit(s: Atelier, T, forme, long, portee, haut, pente_deg, debord, graine, large=1.0, gouttieres=True):
    """Toit posé sur des murs arasés à `haut`. Repère du toit: faîtage le long de x (`long`),
    `portee` le long de z; l'appentis descend vers +z. Rend la hauteur du faîte et la liste des
    descentes d'eau à poser: (côté du repère du toit "+z" ou "-z", x le long du mur, hauteur)."""
    p = math.radians(pente_deg)
    y_bord = haut + RELEVE - debord * math.tan(p)
    descentes = []
    if forme == "deux-pans":
        rv = 0.35
        s_max = (portee / 2 + debord) / math.cos(p)
        faite = y_bord + s_max * math.sin(p)
        demi = long / 2 + rv
        for k, cote in enumerate((1, -1)):
            with s.groupe(at(0, y_bord, cote * (portee / 2 + debord), 0 if cote > 0 else math.pi, p)):
                pan(s, T, [(-demi, 0), (demi, 0), (demi, s_max), (-demi, s_max)], lambda sc: (-demi, demi), s_max, graine + k * 500, (0, 1, 3), large, (-long / 2, long / 2))
                for c in (-1, 1):
                    rive(s, T, c * demi, s_max, c, graine + k + c)
            if gouttieres:
                with s.groupe(at(0, y_bord, cote * (portee / 2 + debord), 0 if cote > 0 else math.pi)):
                    gouttiere(s, T, 2 * demi + 0.1, graine)
                descentes.append(("+z" if cote > 0 else "-z", long / 2 - 0.14, y_bord - 0.08))
        faitieres(s, T, (-demi - 0.04, faite + 0.1, 0), (demi + 0.04, faite + 0.1, 0), graine, bout_bas=True)
        return faite, descentes
    if forme == "croupe":
        s_max = (portee / 2 + debord) / math.cos(p)
        faite = y_bord + s_max * math.sin(p)
        dl, dp = long / 2 + debord, portee / 2 + debord
        crete = (long - portee) / 2
        for k, cote in enumerate((1, -1)):
            poly = [(-dl, 0), (dl, 0), (crete, s_max), (-crete, s_max)] if crete > 0.05 else [(-dl, 0), (dl, 0), (0, s_max)]
            with s.groupe(at(0, y_bord, cote * dp, 0 if cote > 0 else math.pi, p)):
                pan(s, T, poly, lambda sc: (-(dl - sc * math.cos(p)), dl - sc * math.cos(p)), s_max, graine + k * 500, (0,), large, (-long / 2, long / 2))
            if gouttieres:
                with s.groupe(at(0, y_bord, cote * dp, 0 if cote > 0 else math.pi)):
                    gouttiere(s, T, 2 * dl + 0.1, graine)
                descentes.append(("+z" if cote > 0 else "-z", long / 2 - 0.14, y_bord - 0.08))
        for k, cote in enumerate((1, -1)):
            with s.groupe(at(cote * dl, y_bord, 0, cote * math.pi / 2, p)):
                pan(s, T, [(-dp, 0), (dp, 0), (0, s_max)], lambda sc: (-(dp - sc * math.cos(p)), dp - sc * math.cos(p)), s_max, graine + 1000 + k * 500, (0,), large, (-portee / 2, portee / 2))
        if crete > 0.05:
            faitieres(s, T, (-crete - 0.1, faite + 0.1, 0), (crete + 0.1, faite + 0.1, 0), graine)
        for cx in (-1, 1):
            for cz in (-1, 1):
                faitieres(s, T, (cx * dl, y_bord + 0.08, cz * dp), (cx * crete, faite + 0.1, 0), graine + cx + 2 * cz, bout_bas=True)
        return faite, descentes
    if forme == "appentis":
        rv = 0.3
        arriere = 0.2
        s_max = (portee + debord + arriere) / math.cos(p)
        faite = y_bord + s_max * math.sin(p)
        demi = long / 2 + rv
        with s.groupe(at(0, y_bord, portee / 2 + debord, 0, p)):
            pan(s, T, [(-demi, 0), (demi, 0), (demi, s_max), (-demi, s_max)], lambda sc: (-demi, demi), s_max, graine, (0, 1, 2, 3), large, (-long / 2, long / 2))
            for c in (-1, 1):
                rive(s, T, c * demi, s_max, c, graine + c)
        if gouttieres:
            with s.groupe(at(0, y_bord, portee / 2 + debord)):
                gouttiere(s, T, 2 * demi + 0.1, graine)
            descentes.append(("+z", long / 2 - 0.14, y_bord - 0.08))
        return faite, descentes
    raise ValueError(f"forme de toit inconnue: {forme}")


def profil_du_mur(forme, cote_toit, portee, pente_deg):
    """Haut d'un mur sous le toit, selon son côté dans le repère du toit (+z, -z, +x, -x)."""
    t = math.tan(math.radians(pente_deg))
    if forme == "deux-pans" and cote_toit in ("+x", "-x"):
        return ("pignon", portee / 2 * t)
    if forme == "appentis":
        if cote_toit == "-z":
            return ("trapeze", portee * t, portee * t)
        if cote_toit == "+x":
            return ("trapeze", 0.0, portee * t)
        if cote_toit == "-x":
            return ("trapeze", portee * t, 0.0)
    return None


def lucarne(s: Atelier, T, haut, pente_deg, graine=0, largeur=1.3, hauteur=1.3):
    """Lucarne à l'aplomb du mur (repère du mur, x au milieu de la lucarne): jouées, façade
    percée d'une petite fenêtre, fronton, toit à deux pans de tuiles et son faîtage."""
    p = math.radians(pente_deg)
    base = haut - 0.1
    prof = (hauteur + 0.5) / math.tan(p) + 0.2
    mat = T.mur_mat if T.mur_mat != "bardage" else "crepi"
    with s.groupe(at(0, base, 0)):
        peau_de_mur(s, T, largeur, hauteur, [trou_fenetre(T, 0, 0.32, 0.6, 0.75)], None, graine)
        with s.groupe(at(0, 0.32, 0)):
            fenetre(s, T, 0.6, 0.75, volets="aucun", graine=graine)
        for c in (-1, 1):
            s.box(0.12, hauteur, prof, at(c * (largeur / 2 - 0.06), hauteur / 2, -prof / 2), mat, T.mur[0], tremble=0.0, sans="y-y+z-z+" + ("x-" if c > 0 else "x+"))
        q = math.radians(38)
        a = largeur / 2 + 0.16
        fleche = a * math.tan(q)
        s.prisme([(-a + 0.1, 0), (a - 0.1, 0), (0, (a - 0.1) * math.tan(q))], 0.1, at(0, hauteur, -0.05), mat, T.mur[0], tremble=0.0, sans="z-", flancs=())
        bande = a / math.cos(q) / 2
        for c in (-1, 1):
            for r in range(2):
                # Milieu de la bande r (0: en bas) le long de la pente, puis 6 cm au-dessus du pan.
                d = (r + 0.5) * bande
                x = c * (a - d * math.cos(q))
                y = hauteur + d * math.sin(q) + 0.06 + r * 0.015
                s.box(bande + 0.06, 0.07, prof + 0.3, at(x, y, -prof / 2 + 0.15, 0, 0, -c * (q - 0.1)), "tuile", choix(T.tuile, graine + r + c), grain="z", tremble=0.01, sans="y-")
        faitieres(s, T, (0, hauteur + fleche + 0.08, 0.32), (0, hauteur + fleche + 0.08, -prof + 0.1), graine, rayon=0.13, bout_bas=True)
