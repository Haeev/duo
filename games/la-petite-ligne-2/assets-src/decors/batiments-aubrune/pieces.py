"""Pièces de bâtiment d'Aubrune (pierre, crépi, tuiles, bois: rustique).

Chaque pièce est une fonction posée dans le repère d'un mur: origine au pied du mur, au milieu
de la pièce, x vers la droite vu de dehors, y en haut, +z vers le dehors (le nu du mur est le
plan z = 0). Le relief est dans la géométrie: pierres qui dépassent une à une, encadrements en
saillie, fenêtres creusées de 14 cm, planches épaisses. Les faces jamais vues ne sont pas
faites: dessous des pièces (la caméra plonge de 35 à 50 degrés) et faces noyées dans le mur.

Cotes humaines tenues ici: porte de 2,06 m sur une marche de 17 cm, appui de fenêtre à 1 m,
giron de marche de 30 cm au moins.
"""

from __future__ import annotations

import math
from types import SimpleNamespace

from atelier import Atelier, at, choix, hexa, penche, tirage

SEUIL = 0.17
"""Hauteur de la marche de seuil: le plancher est une marche au-dessus du sol."""
CREUX_FENETRE = 0.14
CREUX_PORTE = 0.1
PORTE_HAUT = 2.06
PORTE_LARGE = 1.0


def teintes(nuancier: dict, finition: str, couleurs: dict) -> SimpleNamespace:
    """Les tons d'un bâtiment, d'après le nuancier du lieu et les noms donnés par sa fiche."""
    fixes = nuancier["fixes"]
    peinture = nuancier["peinture"]

    def p(nom, defaut):
        return hexa(peinture[couleurs.get(nom, defaut)])

    famille = nuancier["murs"][finition]
    murs = couleurs.get("murs", next(iter(famille)))
    if murs not in famille:
        raise ValueError(f"teinte de murs « {murs} » inconnue pour la finition « {finition} » (connues: {', '.join(famille)})")
    toit = couleurs.get("toit", "tuile")
    return SimpleNamespace(
        mur=[hexa(c) for c in famille[murs]],
        mur_mat={"crepi": "crepi", "pierre": "moellon", "bardage": "bardage"}[finition],
        finition=finition,
        pierre=[hexa(c) for c in fixes["pierre_de_taille"]],
        tuile=[hexa(c) for c in nuancier["toit"][toit]],
        lauze=toit == "lauze",
        bois=[hexa(c) for c in fixes["bois"]],
        bois_clair=[hexa(c) for c in fixes["bois_clair"]],
        volet=p("volets", "bleu_vert"),
        porte=p("porte", couleurs.get("volets", "bleu_vert")),
        menuis=p("menuiseries", "creme"),
        enseigne=p("enseigne", couleurs.get("menuiseries", "bois_sombre")),
        fer=hexa(fixes["fer"]),
        zinc=hexa(fixes["zinc"]),
        laiton=hexa(fixes["laiton"]),
        vitre=hexa(fixes["vitre"]),
        fond=hexa(fixes["fond"]),
        brique=hexa(fixes["brique"]),
        eau=hexa(fixes["eau"]),
    )


def fonce(c, k=0.82):
    return (c[0] * k, c[1] * k, c[2] * k)


# ---------------------------------------------------------------------------- peau du mur
def peau_de_mur(s: Atelier, T, longueur, hauteur, trous, profil=None, graine=0):
    """La peau d'une façade, percée pour de bon. `trous`: dicts x0, x1, y0, y1, creux et
    `fond`: liste de bandes (y0, y1, matériau, couleur) posées au fond du tableau (vitre, bois).
    `profil`: None, ("pignon", flèche) ou ("trapeze", gauche, droite): le haut du mur sous le toit."""
    x0, x1 = -longueur / 2, longueur / 2
    # Le haut du mur: une ou deux droites y <= a + b x sous lesquelles il reste.
    hautes = []
    sommet = hauteur
    if profil is not None and profil[0] == "pignon":
        hautes = [(hauteur + profil[1], profil[1] / x1), (hauteur + profil[1], -profil[1] / x1)]
        sommet = hauteur + profil[1]
    elif profil is not None:
        pente = (profil[2] - profil[1]) / longueur
        hautes = [(hauteur + (profil[1] + profil[2]) / 2, pente)]
        sommet = hauteur + max(profil[1], profil[2])
    xs = sorted({x0, x1, *[t["x0"] for t in trous], *[t["x1"] for t in trous]})
    ys = sorted({0.0, hauteur, sommet, *[t["y0"] for t in trous], *[t["y1"] for t in trous]})

    def perce(xa, xb, ya, yb):
        cx, cy = (xa + xb) / 2, (ya + yb) / 2
        return any(t["x0"] < cx < t["x1"] and t["y0"] < cy < t["y1"] for t in trous)

    def rogne(poly):
        """Garde la part du polygone sous les droites du haut du mur (Sutherland-Hodgman)."""
        for a, b in hautes:
            sortie = []
            for i, p in enumerate(poly):
                q = poly[(i + 1) % len(poly)]
                dp, dq = a + b * p[0] - p[1], a + b * q[0] - q[1]
                if dp >= -1e-9:
                    sortie.append(p)
                if (dp > 1e-9 and dq < -1e-9) or (dp < -1e-9 and dq > 1e-9):
                    k = dp / (dp - dq)
                    sortie.append((p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k))
            poly = sortie
            if len(poly) < 3:
                return []
        return poly

    devant = (0, 0, 1)
    polys = []
    for j in range(len(ys) - 1):
        ya, yb = ys[j], ys[j + 1]
        debut = None
        for i in range(len(xs) - 1):
            plein = not perce(xs[i], xs[i + 1], ya, yb)
            if plein and debut is None:
                debut = xs[i]
            if debut is not None and (not plein or i == len(xs) - 2):
                fin = xs[i + 1] if plein else xs[i]
                poly = [(debut, ya), (fin, ya), (fin, yb), (debut, yb)]
                if yb > hauteur + 1e-9:
                    poly = rogne(poly)
                if len(poly) >= 3:
                    polys.append(([(px, py, 0) for px, py in poly], devant))
                debut = None
    for t in trous:
        c = -t["creux"]
        a, b, ya, yb = t["x0"], t["x1"], t["y0"], t["y1"]
        polys.append(([(a, ya, 0), (a, yb, 0), (a, yb, c), (a, ya, c)], (1, 0, 0)))
        polys.append(([(b, ya, 0), (b, yb, 0), (b, yb, c), (b, ya, c)], (-1, 0, 0)))
        if ya > 0.01:
            polys.append(([(a, ya, 0), (b, ya, 0), (b, ya, c), (a, ya, c)], (0, 1, 0)))
    grain = "y" if T.mur_mat == "bardage" else None
    s.peau(polys, at(0, 0, 0), T.mur_mat, choix(T.mur, graine), grain=grain)
    for t in trous:
        # 4 mm derrière le tableau: le fond reste un morceau à part (le rendu compte les
        # morceaux par leurs sommets communs, à 1 mm près), cerné d'un trait.
        c = -t["creux"] - 0.004
        for ya, yb, mat, couleur in t["fond"]:
            s.peau([([(t["x0"], ya, c), (t["x1"], ya, c), (t["x1"], yb, c), (t["x0"], yb, c)], devant)], at(0, 0, 0), mat, couleur)


# ---------------------------------------------------------------------------- pierres
def moellons_bas(s: Atelier, T, x0, x1, graine, trous=(), rangs=2):
    """Soubassement: deux (ou trois) assises de moellons qui dépassent du mur de 5 à 11 cm, un
    à un. `trous`: intervalles (a, b) laissés libres (portes, baies)."""
    for rang in range(rangs):
        x = x0 - 0.06 - (0.24 if rang % 2 == 1 else 0)
        k = 0
        while x < x1 + 0.04:
            g = rang * 97 + k * 13 + graine
            dans = next((t for t in trous if t[0] - 0.01 <= x < t[1]), None)
            if dans is not None:
                x = dans[1]
                continue
            long = min(0.45 + tirage(g) * 0.5, x1 + 0.07 - x)
            suivant = min((t[0] for t in trous if t[0] > x), default=None)
            if suivant is not None:
                long = min(long, suivant - x)
            sort = 0.05 + tirage(g + 1) * 0.06 - 0.02 * max(0, rang - 1)
            if long > 0.1:
                s.box(long - 0.02, 0.27, 0.2, at(x + long / 2, 0.14 + rang * 0.28, sort - 0.1), "pierre", choix(T.pierre, g + 2), tremble=0.016, sans="z-y-")
            x += max(long, 0.05)
            k += 1


def chaine_angle(s: Atelier, T, demi, y0, y1, graine):
    """Chaîne d'angle au coin droit du mur: pierres de taille alternées, longues puis courtes,
    qui dépassent de 7 cm sur les deux façades."""
    pas = 0.43
    i = 0
    while y0 + i * pas + 0.4 <= y1:
        long = i % 2 == 0
        s.box(
            0.56 if long else 0.34,
            0.4,
            0.4 if long else 0.62,
            at(demi - (0.21 if long else 0.1), y0 + 0.2 + i * pas, -0.13 if long else -0.24, 0, 0, penche(i + demi + graine, 0.012)),
            "pierre",
            T.pierre[(i + int(graine)) % len(T.pierre)],
            tremble=0.014,
            sans="y-",
        )
        i += 1


def moellon(s: Atelier, T, x, y, long, haut, graine):
    """Une pierre du mur mise à nu ou laissée en saillie (2 à 5 cm)."""
    s.box(long, haut, 0.1, at(x, y, tirage(graine + 9) * 0.03 - 0.01), "pierre", choix(T.pierre, graine), tremble=0.016, sans="z-y-")


def pierres_nues(s: Atelier, T, x, y, graine):
    """Là où l'enduit est tombé: quatre pierres en deux rangs."""
    for i in range(4):
        rang = i >> 1
        moellon(s, T, x + (i % 2) * 0.44 + rang * 0.18, y + rang * 0.23, 0.3 + tirage(graine + i) * 0.14, 0.2, graine + i * 3)


def reprise_d_enduit(s: Atelier, T, x, y, largeur, hauteur, graine):
    """Une reprise d'enduit: un pan refait plus tard, d'un ton voisin, en léger relief (8 mm),
    aux bords irréguliers (deux ou trois plaques qui se chevauchent)."""
    for k in range(3):
        g = graine + k * 5
        w = largeur * (0.55 + tirage(g) * 0.45)
        h = hauteur * (0.5 + tirage(g + 1) * 0.5)
        dx = (tirage(g + 2) - 0.5) * (largeur - w)
        dy = (tirage(g + 3) - 0.5) * (hauteur - h)
        s.box(w, h, 0.016, at(x + dx, y + dy, 0.004 + k * 0.003, 0, 0, penche(g + 4, 0.03)), T.mur_mat, choix(T.mur, g + 1 + k), tremble=0.004, sans="z-")


def lezarde(s: Atelier, T, x, y, graine, long=0.9, sens=1):
    """Une lézarde: un trait sombre en zigzag qui part d'un angle d'ouverture (là où le mur
    travaille) et monte en biais. Origine: son départ, sur le nu du mur."""
    n = 4
    pas = long / n
    for k in range(n):
        a = math.radians(62 + (22 if k % 2 else -14) + penche(graine + k, 6))
        dx, dy = sens * math.cos(a) * pas, math.sin(a) * pas
        s.box(pas + 0.015, 0.024 - k * 0.004, 0.01, at(x + dx / 2, y + dy / 2, 0.006, 0, 0, math.atan2(dy, dx)), T.mur_mat, fonce(T.mur[0], 0.5), tremble=0.0, sans="z-")
        x += dx
        y += dy


# ---------------------------------------------------------------------------- fenêtres
def volet(s: Atelier, T, largeur, hauteur, cx, cote, graine, z=0.05):
    """Un vantail de volet: trois planches épaisses et deux pentures de fer."""
    lp = largeur / 3
    for i in range(3):
        bord = "x-" if i == 0 else ("x+" if i == 2 else "")
        sans = "".join(f for f in ("z-", "y-", "x-", "x+") if f != bord)
        s.box(lp - 0.012, hauteur + 0.06, 0.07, at(cx + (i - 1) * lp, hauteur / 2, z + tirage(i + cote * 5 + graine) * 0.012, 0, 0, cote * 0.01), "volet", T.volet if i != 1 else fonce(T.volet, 0.94), grain="y", tremble=0.005, sans=sans)
    for y in (0.22, 0.8):
        s.box(largeur - 0.04, 0.09, 0.035, at(cx, hauteur * y, z + 0.055), "metal", T.fer, tremble=0.004, sans="z-y-")


def fenetre(s: Atelier, T, largeur=0.95, hauteur=1.25, volets="ouverts", linteau="bois", graine=0):
    """Fenêtre à croisillons: appui débordant, jambages de pierre, linteau, petits bois devant
    la vitre (qui est au fond du tableau, 14 cm derrière le nu du mur), volets de planches.
    Origine: milieu du bas du tableau."""
    s.box(largeur + 0.5, 0.13, 0.3, at(0, -0.065, 0.1), "pierre", T.pierre[2], tremble=0.015, sans="z-y-")
    if linteau == "bois":
        s.box(largeur + 0.56, 0.2, 0.24, at(0, hauteur + 0.1, 0.06, 0, 0, penche(graine, 0.012)), "bois", choix(T.bois, graine), grain="x", tremble=0.016, sans="z-y-")
    else:
        s.box(largeur + 0.5, 0.24, 0.22, at(0, hauteur + 0.12, 0.05), "pierre", T.pierre[0], tremble=0.014, sans="z-y-")
    for cote in (-1, 1):
        s.box(0.12, hauteur, 0.2, at(cote * (largeur / 2 + 0.06), hauteur / 2, 0.05), "pierre", T.pierre[(graine + cote) % 2], tremble=0.01, sans="z-y-y+")
    if volets != "fermes":
        zc = -CREUX_FENETRE + 0.03
        s.box(0.07, hauteur, 0.05, at(0, hauteur / 2, zc), "bois", T.menuis, tremble=0.004, sans="z-y-y+")
        for fy in (0.36, 0.68):
            s.box(largeur, 0.055, 0.05, at(0, hauteur * fy, zc - 0.004), "bois", T.menuis, tremble=0.004, sans="z-y-x-x+")
    lv = largeur / 2
    if volets == "ouverts":
        for cote in (-1, 1):
            volet(s, T, lv, hauteur, cote * (largeur / 2 + 0.17 + lv / 2), cote, graine)
    elif volets == "fermes":
        for cote in (-1, 1):
            volet(s, T, lv, hauteur - 0.06, cote * lv / 2, cote, graine, z=-0.04)


def trou_fenetre(T, x, y, largeur=0.95, hauteur=1.25):
    return dict(x0=x - largeur / 2, x1=x + largeur / 2, y0=y, y1=y + hauteur, creux=CREUX_FENETRE, fond=[(y, y + hauteur, "vitre", T.vitre)])


def vitrail(s: Atelier, T, largeur=0.8, hauteur=2.6, graine=0):
    """Baie haute et étroite d'église: appui, jambages et arc de pierres taillées."""
    s.box(largeur + 0.4, 0.14, 0.26, at(0, -0.07, 0.08), "pierre", T.pierre[2], tremble=0.012, sans="z-y-")
    n = max(3, round(hauteur / 0.55))
    for cote in (-1, 1):
        for i in range(n):
            h = hauteur / n
            s.box(0.2 + (i % 2) * 0.08, h - 0.02, 0.2, at(cote * (largeur / 2 + 0.1 + (i % 2) * 0.04), h / 2 + i * h, 0.05), "pierre", T.pierre[(i + graine) % 4], tremble=0.01, sans="z-y-")
    arc(s, T, largeur + 0.2, hauteur, 0.34, 5, graine)
    zc = -CREUX_FENETRE + 0.03
    s.box(0.06, hauteur, 0.05, at(0, hauteur / 2, zc), "metal", T.fer, tremble=0.003, sans="z-y-y+")
    for k in range(1, 4):
        s.box(largeur, 0.045, 0.05, at(0, hauteur * k / 4, zc), "metal", T.fer, tremble=0.003, sans="z-y-x-x+")


def arc(s: Atelier, T, portee, naissance, fleche, n, graine, epais=0.3, sortie=0.07):
    """Arc surbaissé en claveaux de pierre, posé devant le mur: `portee` entre naissances."""
    rayon = (portee * portee / 4 + fleche * fleche) / (2 * fleche)
    cy = naissance + fleche - rayon
    demi = math.asin(portee / 2 / rayon)
    for i in range(n):
        a = -demi + (i + 0.5) * 2 * demi / n
        long = 2 * demi * (rayon + epais / 2) / n
        cle = i == n // 2
        s.box(long - 0.015, epais + (0.07 if cle else 0), 0.24, at(math.sin(a) * (rayon + epais / 2), cy + math.cos(a) * (rayon + epais / 2), sortie - 0.07, 0, 0, -a), "pierre", T.pierre[(i + graine) % 4], tremble=0.012, sans="z-")


# ---------------------------------------------------------------------------- portes
def marche(s: Atelier, T, largeur=1.6, giron=0.6, graine=0, rangs=1):
    """Marche de seuil en pierre: 17 cm de haut, giron de 30 cm au moins par marche."""
    for r in range(rangs):
        h = SEUIL * (rangs - r)
        s.box(largeur + r * 0.3, h, giron, at(0, h / 2, giron / 2 + 0.02 + r * 0.32, 0, 0.012, 0), "pierre", T.pierre[(r + graine) % 4], tremble=0.02, sans="z-y-")


def piedroits(s: Atelier, T, demi, bas, haut, graine, n=None):
    """Jambages d'une porte: pierres de taille alternées, larges puis étroites."""
    n = n or max(3, round((haut - bas) / 0.5))
    h = (haut - bas) / n
    for cote in (-1, 1):
        for i in range(n):
            large = 0.3 if i % 2 == 0 else 0.2
            s.box(large, h - 0.01, 0.26, at(cote * (demi + large / 2), bas + h / 2 + i * h, 0.02 + tirage(i + cote + graine) * 0.03), "pierre", T.pierre[(i + (1 if cote > 0 else 0) + graine) % 4], tremble=0.014, sans="z-y-")


def vantail(s: Atelier, T, x0, x1, y0, y1, z, couleur, graine, pentures=True, cote_gonds=-1):
    """Vantail en planches verticales, avec ses pentures de fer du côté des gonds."""
    n = max(2, round((x1 - x0) / 0.21))
    lp = (x1 - x0) / n
    for i in range(n):
        s.box(lp - 0.012, y1 - y0, 0.06, at(x0 + (i + 0.5) * lp, (y0 + y1) / 2, z + tirage(i * 3 + graine) * 0.014), "volet", couleur if i % 2 == 0 else fonce(couleur, 0.93), grain="y", tremble=0.006, sans="z-y-y+x-x+")
    if pentures:
        long = (x1 - x0) * 0.86
        cx = (x0 + x1) / 2 + cote_gonds * ((x1 - x0) - long) / 2
        for fy in (0.16, 0.84):
            s.box(long, 0.12, 0.035, at(cx, y0 + (y1 - y0) * fy, z + 0.05, 0, 0, penche(fy + graine, 0.01)), "metal", T.fer, tremble=0.006, sans="z-y-")


def porte(s: Atelier, T, modele="pleine", linteau="bois", graine=0, marches=1):
    """Porte de 2,06 m sur sa marche: piédroits de pierre, linteau, vantail en planches à
    pentures (`pleine`) ou à carreaux en partie haute (`vitree`), poignée de laiton."""
    demi = PORTE_LARGE / 2
    piedroits(s, T, demi + 0.01, 0, SEUIL + PORTE_HAUT, graine, n=4)
    if linteau == "bois":
        s.box(PORTE_LARGE + 0.9, 0.26, 0.3, at(0, SEUIL + PORTE_HAUT + 0.13, 0.05, 0, 0, 0.012), "bois", choix(T.bois, graine), grain="x", tremble=0.02, sans="z-y-")
    else:
        s.box(PORTE_LARGE + 0.8, 0.3, 0.26, at(0, SEUIL + PORTE_HAUT + 0.15, 0.04), "pierre", T.pierre[0], tremble=0.016, sans="z-y-")
    marche(s, T, PORTE_LARGE + 0.6, 0.6, graine, marches)
    z = -CREUX_PORTE + 0.035
    if modele == "vitree":
        bas = SEUIL + 0.95
        vantail(s, T, -demi, demi, SEUIL, bas, z, T.porte, graine, pentures=False)
        for cote in (-1, 1):
            s.box(0.13, PORTE_HAUT - 0.95, 0.06, at(cote * (demi - 0.065), bas + (PORTE_HAUT - 0.95) / 2, z), "volet", T.porte, grain="y", tremble=0.005, sans="z-y-y+")
        s.box(PORTE_LARGE - 0.26, 0.12, 0.06, at(0, SEUIL + PORTE_HAUT - 0.06, z), "volet", T.porte, tremble=0.005, sans="z-y-x-x+")
        s.box(0.05, PORTE_HAUT - 1.07, 0.04, at(0, bas + (PORTE_HAUT - 1.07) / 2, z - 0.01), "volet", T.porte, tremble=0.004, sans="z-y-y+")
        s.box(PORTE_LARGE - 0.26, 0.05, 0.04, at(0, bas + (PORTE_HAUT - 1.07) * 0.5, z - 0.01), "volet", T.porte, tremble=0.004, sans="z-y-x-x+")
    else:
        vantail(s, T, -demi, demi, SEUIL, SEUIL + PORTE_HAUT, z, T.porte, graine)
    s.box(0.09, 0.22, 0.07, at(demi - 0.14, SEUIL + 1.0, z + 0.06), "metal", T.laiton, tremble=0.004, sans="z-y-")


def trou_porte(T, x, modele="pleine", niveau=0.0):
    y0, y1 = niveau + SEUIL, niveau + SEUIL + PORTE_HAUT
    fond = [(y0, y1, "bois", T.fond)]
    if modele == "vitree":
        fond = [(y0, y0 + 0.95, "bois", T.fond), (y0 + 0.95, y1, "vitre", T.vitre)]
    return dict(x0=x - PORTE_LARGE / 2, x1=x + PORTE_LARGE / 2, y0=y0, y1=y1, creux=CREUX_PORTE, fond=fond)


def porte_de_grange(s: Atelier, T, largeur=2.4, hauteur=2.7, graine=0, cochere=False, ouverte=False):
    """Porte charretière à deux vantaux de planches, de plain-pied (les charrettes passent):
    linteau de chêne, ou arc de pierre pour la porte cochère. `ouverte`: baie sans vantaux."""
    demi = largeur / 2
    piedroits(s, T, demi + 0.01, 0, hauteur if not cochere else hauteur - 0.45, graine)
    if cochere:
        arc(s, T, largeur + 0.5, hauteur - 0.45, 0.5, 7, graine, epais=0.34)
    else:
        s.box(largeur + 1.0, 0.32, 0.34, at(0, hauteur + 0.16, 0.06, 0, 0, penche(graine, 0.01)), "bois", choix(T.bois, graine), grain="x", tremble=0.022, sans="z-y-")
    s.box(largeur + 0.5, 0.06, 0.5, at(0, 0.03, 0.2), "pierre", T.pierre[2], tremble=0.012, sans="z-y-")
    if ouverte:
        return
    z = -CREUX_PORTE + 0.035
    for cote in (-1, 1):
        a, b = (-demi, -0.01) if cote < 0 else (0.01, demi)
        vantail(s, T, a, b, 0.06, hauteur, z, T.porte, graine + cote, cote_gonds=cote)
        # Écharpe: la planche en biais qui empêche le vantail de s'affaisser, du gond bas au haut.
        cx = (a + b) / 2
        long = math.hypot(b - a, hauteur * 0.62)
        s.box(long, 0.13, 0.035, at(cx, 0.06 + hauteur * 0.5, z + 0.048, 0, 0, -cote * math.atan2(hauteur * 0.62, b - a)), "volet", fonce(T.porte, 0.86), grain="x", tremble=0.006, sans="z-")
    s.box(0.5, 0.1, 0.06, at(0, hauteur * 0.45, z + 0.08), "metal", T.fer, tremble=0.005, sans="z-y-")


def trou_grange(T, x, largeur=2.4, hauteur=2.7):
    return dict(x0=x - largeur / 2, x1=x + largeur / 2, y0=0.0, y1=hauteur, creux=CREUX_PORTE, fond=[(0.0, hauteur, "bois", T.fond)])


# ---------------------------------------------------------------------------- devanture
def vitrine(s: Atelier, T, largeur=2.4, graine=0):
    """Devanture de commerce en bois peint: allège à panneaux, grande vitre à petits bois,
    pilastres, et bandeau d'enseigne vierge sous sa corniche."""
    demi = largeur / 2
    bas, haut = 0.78, 2.3
    c = T.menuis
    s.box(largeur + 0.1, bas, 0.16, at(0, bas / 2, 0.02), "volet", c, tremble=0.008, sans="z-y-")
    n = max(2, round(largeur / 1.1))
    for i in range(n):
        lw = (largeur - 0.1) / n
        s.box(lw - 0.16, bas - 0.3, 0.03, at(-demi + 0.05 + (i + 0.5) * lw, bas / 2 - 0.02, 0.11), "volet", fonce(c, 0.9), tremble=0.004, sans="z-y-")
    s.box(largeur + 0.3, 0.07, 0.26, at(0, bas + 0.035, 0.04), "volet", fonce(c, 0.95), tremble=0.006, sans="z-y-")
    for cote in (-1, 1):
        s.box(0.18, haut + 0.02, 0.14, at(cote * (demi + 0.09), (haut + 0.02) / 2, 0.03), "volet", c, grain="y", tremble=0.008, sans="z-y-y+")
    zc = -CREUX_PORTE + 0.03
    for i in range(1, n):
        s.box(0.06, haut - bas - 0.07, 0.05, at(-demi + i * largeur / n, (haut + bas + 0.07) / 2, zc), "volet", c, tremble=0.004, sans="z-y-y+")
    s.box(largeur, 0.06, 0.05, at(0, haut - 0.42, zc), "volet", c, tremble=0.004, sans="z-y-x-x+")
    # Bandeau: la planche où l'on peindra le nom du commerce, sous une corniche qui l'abrite.
    s.box(largeur + 0.5, 0.46, 0.12, at(0, haut + 0.23, 0.04), "volet", T.enseigne, grain="x", tremble=0.01, sans="z-y-")
    s.box(largeur + 0.44, 0.34, 0.02, at(0, haut + 0.23, 0.11), "volet", fonce(T.enseigne, 1.12), tremble=0.004, sans="z-y-")
    s.box(largeur + 0.7, 0.08, 0.3, at(0, haut + 0.5, 0.1, 0, 0.05, 0), "volet", fonce(c, 0.9), tremble=0.01, sans="z-y-")


def trou_vitrine(T, x, largeur=2.4):
    return dict(x0=x - largeur / 2, x1=x + largeur / 2, y0=0.78, y1=2.3, creux=CREUX_PORTE, fond=[(0.78, 2.3, "vitre", T.vitre)])


# ---------------------------------------------------------------------------- enseignes, auvent
def enseigne_bandeau(s: Atelier, T, largeur=2.2, graine=0):
    """Enseigne vierge en planche encadrée, posée à plat sur le mur. Origine: milieu du bas."""
    s.box(largeur, 0.5, 0.06, at(0, 0.25, 0.03, 0, 0, penche(graine, 0.012)), "volet", T.enseigne, grain="x", tremble=0.008, sans="z-y-")
    s.box(largeur - 0.14, 0.36, 0.02, at(0, 0.25, 0.07), "volet", fonce(T.enseigne, 1.14), tremble=0.004, sans="z-y-")
    for cote in (-1, 1):
        s.box(0.07, 0.07, 0.05, at(cote * (largeur / 2 - 0.18), 0.52, 0.03), "metal", T.fer, tremble=0.003, sans="z-y-")


def enseigne_potence(s: Atelier, T, graine=0):
    """Enseigne vierge pendue à sa potence de fer, en drapeau sur la rue. Origine: scellement haut."""
    s.box(0.05, 0.05, 0.95, at(0, 0, 0.475), "metal", T.fer, tremble=0.004, sans="z-y-")
    s.box(0.04, 0.04, 0.6, at(0, -0.2, 0.28, 0, -0.75, 0), "metal", T.fer, tremble=0.004, sans="z-")
    for z in (0.3, 0.8):
        s.box(0.03, 0.14, 0.03, at(0, -0.09, z), "metal", T.fer, tremble=0.002, sans="y-y+")
    s.box(0.06, 0.52, 0.72, at(0, -0.42, 0.55, 0, 0, penche(graine, 0.02)), "volet", T.enseigne, grain="z", tremble=0.008)
    for cote in (-1, 1):
        s.box(0.02, 0.38, 0.56, at(cote * 0.036, -0.42, 0.55), "volet", fonce(T.enseigne, 1.14), tremble=0.004, sans="x-" if cote > 0 else "x+")


def poteau(s: Atelier, T, hauteur, x, z, graine=0, section=0.16, de=True):
    """Poteau de chêne sur son dé de pierre (le bois ne touche pas la terre: il pourrirait)."""
    bas = 0.22 if de else 0.0
    if de:
        s.box(section + 0.14, bas, section + 0.14, at(x, bas / 2, z), "pierre", T.pierre[graine % 4], tremble=0.012, sans="y-")
    s.box(section, hauteur - bas, section, at(x, bas + (hauteur - bas) / 2, z, penche(graine, 0.03)), "bois", choix(T.bois, graine), grain="y", tremble=0.012, sans="y-y+")


def lien(s: Atelier, T, x, y, z, vers_x=0.0, vers_z=0.0, long=0.75, graine=0):
    """Jambe de force: la pièce en biais qui raidit l'angle entre un poteau et sa poutre."""
    if vers_x:
        s.box(long, 0.1, 0.1, at(x + vers_x * 0.26, y - 0.26, z, 0, 0, vers_x * math.pi / 4), "bois", choix(T.bois, graine), grain="x", tremble=0.008)
    else:
        s.box(0.1, 0.1, long, at(x, y - 0.26, z + vers_z * 0.26, 0, vers_z * -math.pi / 4, 0), "bois", choix(T.bois, graine), grain="z", tremble=0.008)


# ---------------------------------------------------------------------------- zinguerie
def descente(s: Atelier, T, haut, graine=0):
    """Descente d'eau de zinc: du coude sous la gouttière jusqu'au dauphin, qui rejette l'eau
    sur une pierre plate au pied du mur. Origine: pied, sur le nu du mur."""
    s.cyl(0.05, 0.05, haut - 0.34, 6, at(0, 0.3 + (haut - 0.34) / 2, 0.09), "metal", T.zinc, tremble=0.005, bouts=False)
    s.box(0.12, 0.08, 0.36, at(0, haut - 0.03, 0.24), "metal", T.zinc, tremble=0.004, sans="y-")
    s.box(0.12, 0.12, 0.3, at(0, 0.24, 0.2, 0, 0.6, 0), "metal", T.zinc, tremble=0.004)
    for y in (haut * 0.35, haut * 0.72):
        s.box(0.16, 0.05, 0.14, at(0, y, 0.08), "metal", T.fer, tremble=0.003, sans="z-y-")
    s.box(0.5, 0.07, 0.42, at(0, 0.035, 0.46, penche(graine, 0.2)), "pierre", T.pierre[2], tremble=0.02, sans="y-")


# ---------------------------------------------------------------------------- cheminées
CHAPEAU_PIEDS = 0.24
"""Hauteur des pieds du chapeau: le jour entre le conduit et la tôle, par où sort la fumée."""
CHAPEAU_PENTE = math.radians(32)


def chapeau_de_cheminee(s: Atelier, T, largeur, profondeur, graine=0, debord=0.13):
    """Chapeau de tôle à deux pans posé sur quatre pieds de fer au-dessus du conduit: le petit
    toit qui arrête la pluie sans gêner le tirage. Faîtage le long de x; pans de zinc qui
    débordent du conduit de `debord`, ourlet sombre à l'égout et couvre-joint au faîte, pour que
    les deux pans se lisent de haut. Origine: milieu du dessus du conduit; `largeur` x
    `profondeur`: l'écartement des pieds."""
    pied = CHAPEAU_PIEDS + debord * math.tan(CHAPEAU_PENTE) + 0.01
    for sx in (-1, 1):
        for sz in (-1, 1):
            s.box(0.05, pied, 0.05, at(sx * largeur / 2, pied / 2, sz * profondeur / 2), "metal", T.fer, tremble=0.002, sans="y-y+")
    demi = profondeur / 2 + debord
    long = largeur + 2 * debord
    rampant = demi / math.cos(CHAPEAU_PENTE)
    fleche = demi * math.tan(CHAPEAU_PENTE)
    base = CHAPEAU_PIEDS
    for cote in (-1, 1):
        # Le pan: une tôle de 3 cm, du faîte (z = 0) à l'égout (z = cote * demi).
        s.box(long, 0.03, rampant, at(0, base + fleche / 2 + 0.015, cote * demi / 2, 0, cote * CHAPEAU_PENTE), "metal", T.zinc if cote > 0 else fonce(T.zinc, 0.9), tremble=0.003)
        s.box(long + 0.01, 0.04, 0.04, at(0, base + 0.01, cote * (demi - 0.01)), "metal", T.fer, tremble=0.002, sans="y-")
    s.box(long + 0.03, 0.05, 0.07, at(0, base + fleche + 0.035, 0), "metal", fonce(T.zinc, 0.8), tremble=0.002, sans="y-")


def cheminee_souche(s: Atelier, T, hauteur=1.9, graine=0):
    """Souche de cheminée maçonnée: couronne de pierres, dalle de couverture, chapeau de tôle
    sur ses quatre pieds. Origine: axe de la souche, `hauteur` sous son sommet (elle part de
    sous le toit)."""
    s.box(0.66, hauteur, 0.66, at(0, hauteur / 2, 0), T.mur_mat if T.mur_mat != "bardage" else "moellon", T.mur[0] if T.mur_mat != "bardage" else T.pierre[1], tremble=0.03, sans="y-y+")
    for i in range(4):
        a = i * math.pi / 2
        s.box(0.5, 0.2, 0.2, at(math.sin(a) * 0.27, hauteur - 0.05, math.cos(a) * 0.27, a), "pierre", T.pierre[i], tremble=0.015, sans="y-")
    s.box(0.86, 0.1, 0.86, at(0, hauteur + 0.1, 0, 0.05), "pierre", T.pierre[2], tremble=0.02, sans="y-")
    with s.groupe(at(0, hauteur + 0.15, 0)):
        chapeau_de_cheminee(s, T, 0.6, 0.6, graine)


def cheminee_de_four(s: Atelier, T, hauteur=6.0, graine=0, epaule=2.3):
    """Cheminée de four ou de forge, adossée au mur depuis le sol: massif du foyer, épaule en
    glacis, conduit de pierre, couronne de briques et chapeau de tôle sur quatre pieds.
    Origine: pied, sur le nu du mur."""
    s.box(1.5, epaule, 0.62, at(0, epaule / 2, 0.29), "moellon", T.pierre[1], tremble=0.03, sans="z-y-y+")
    for rang in range(2):
        x = -0.78
        k = 0
        while x < 0.74:
            long = min(0.4 + tirage(graine + rang * 7 + k) * 0.3, 0.78 - x)
            s.box(long - 0.02, 0.27, 0.12, at(x + long / 2, 0.14 + rang * 0.28, 0.6 + tirage(k + rang) * 0.04), "pierre", choix(T.pierre, graine + k + rang * 3), tremble=0.014, sans="z-y-")
            x += long
            k += 1
    s.prisme([(-0.75, 0), (0.75, 0), (0.45, 0.6), (-0.45, 0.6)], 0.62, at(0, epaule, 0.29), "pierre", T.pierre[2], tremble=0.02, sans="z-", flancs=(1, 3))
    conduit = hauteur - epaule - 0.5
    s.box(0.9, conduit, 0.6, at(0, epaule + 0.55 + conduit / 2, 0.28), "moellon", T.pierre[1], tremble=0.025, sans="y-y+")
    for i in range(int(conduit / 0.9)):
        cote = -1 if i % 2 else 1
        s.box(0.34, 0.3, 0.64, at(cote * 0.3, epaule + 1.0 + i * 0.9, 0.28), "pierre", T.pierre[(i + graine) % 4], tremble=0.014, sans="y-")
    haut = epaule + 0.55 + conduit
    s.box(1.02, 0.24, 0.72, at(0, haut + 0.02, 0.28), "tuile", T.brique, tremble=0.016, sans="y-")
    with s.groupe(at(0, haut + 0.14, 0.28)):
        chapeau_de_cheminee(s, T, 0.84, 0.56, graine)


# ---------------------------------------------------------------------------- détails propres
CADRAN = "#F3EDE0"


def heure_de(graine) -> tuple[int, int]:
    """Une heure de jour plausible (8 h à 17 h 55), propre à chaque horloge."""
    return 8 + int(tirage(graine + 0.3) * 10), 5 * int(tirage(graine + 0.7) * 12)


def horloge(s: Atelier, T, diametre=0.8, graine=0, heure=None):
    """Horloge de façade: cadran rond de tôle émaillée dans un œil-de-bœuf de claveaux de
    pierre (clé en haut, appui mouluré en bas), lunette de laiton en saillie, douze repères
    d'heures (ceux de 12, 3, 6 et 9 plus forts), aiguille des heures courte et large, aiguille
    des minutes longue et fine, sur une heure plausible. Trois plans de relief: la pierre
    avance de 16 cm, le cadran est 6 cm en retrait d'elle, la lunette et les aiguilles en
    ressortent. Origine: centre du cadran, au nu du mur."""
    r = diametre / 2
    z_cadran = 0.1
    # L'œil-de-bœuf: douze claveaux rayonnants, la clé plus haute; ils portent le cadran.
    n = 12
    epais = max(0.14, r * 0.38)
    for i in range(n):
        a = i * 2 * math.pi / n
        cle = i == 0
        rayon = r + 0.04 + epais / 2
        long = 2 * math.pi * (r + 0.04 + epais) / n - 0.02
        s.box(long, epais + (0.05 if cle else 0.0), 0.16, at(math.sin(a) * (rayon + (0.025 if cle else 0)), math.cos(a) * (rayon + (0.025 if cle else 0)), 0.08, 0, 0, -a), "pierre", T.pierre[(i + graine) % len(T.pierre)], tremble=0.008, sans="z-")
    s.box(r * 2 + 0.3, 0.1, 0.24, at(0, -(r + 0.04 + epais) - 0.04, 0.1), "pierre", T.pierre[2], tremble=0.008, sans="z-y-")
    # Le fond du cadran et la lunette.
    s.cyl(r + 0.05, r + 0.05, 0.04, 24, at(0, 0, z_cadran - 0.02, 0, math.pi / 2, 0), "metal", hexa(CADRAN), grain=None, tremble=0.0)
    m = 24
    for i in range(m):
        a = i * 2 * math.pi / m
        s.box(2 * math.pi * (r + 0.03) / m + 0.006, 0.05, 0.05, at(math.sin(a) * (r + 0.03), math.cos(a) * (r + 0.03), z_cadran + 0.025, 0, 0, -a), "metal", T.laiton, tremble=0.0, sans="z-")
    # Les douze repères: des bâtons sombres, plus longs et plus larges aux quarts.
    for h in range(12):
        a = h * math.pi / 6
        fort = h % 3 == 0
        long = r * (0.24 if fort else 0.15)
        rayon = r * 0.86 - long / 2
        s.box(r * (0.075 if fort else 0.045), long, 0.012, at(math.sin(a) * rayon, math.cos(a) * rayon, z_cadran + 0.006, 0, 0, -a), "metal", T.fer, tremble=0.0, sans="z-")
    # Les aiguilles: chaque boîte part du centre (avec une courte queue) vers son angle.
    hh, mm = heure if heure is not None else heure_de(graine)
    for angle, long, large, dz in (((hh % 12 + mm / 60) * math.pi / 6, r * 0.52, r * 0.1, 0.02), (mm * math.pi / 30, r * 0.8, r * 0.055, 0.034)):
        queue = r * 0.14
        milieu = (long - queue) / 2
        s.box(large, long + queue, 0.012, at(math.sin(angle) * milieu, math.cos(angle) * milieu, z_cadran + dz, 0, 0, -angle), "metal", T.fer, tremble=0.0, sans="z-")
    s.cyl(r * 0.07, r * 0.07, 0.03, 8, at(0, 0, z_cadran + 0.045, 0, math.pi / 2, 0), "metal", T.laiton, grain=None, tremble=0.0)


def drapeau(s: Atelier, T, graine=0):
    """Hampe scellée en biais dans la façade et son drapeau. Origine: scellement."""
    s.box(0.045, 1.5, 0.045, at(0, 0.6, 0.42, 0, 0.6, 0), "bois", T.bois_clair[0], grain="y", tremble=0.004)
    for i, c in enumerate(("#44618A", "#F3EDE0", "#B0604C")):
        s.box(0.28, 0.6, 0.03, at(0.16 + i * 0.28, 0.82, 0.86 + i * 0.012), "volet", hexa(c), tremble=0.012, sans="")


def roue_de_moulin(s: Atelier, T, diametre=5.0, largeur=0.9, graine=0):
    """Roue à aubes: deux jantes de bois, huit bras, seize aubes, arbre de chêne qui entre dans
    le mur. Origine: axe de la roue, sur le nu du mur; la roue tourne dans un plan parallèle au mur."""
    r = diametre / 2
    z0 = 0.35
    s.cyl(0.2, 0.2, largeur + z0 + 0.3, 8, at(0, 0, (largeur + z0 + 0.3) / 2 - 0.1, 0, math.pi / 2, 0), "bois", T.bois[1], tremble=0.01)
    for z in (z0, z0 + largeur):
        for i in range(16):
            a = (i + 0.5) * math.pi / 8
            long = 2 * (r - 0.12) * math.sin(math.pi / 16) + 0.06
            s.box(long, 0.24, 0.09, at(math.cos(a) * (r - 0.14), math.sin(a) * (r - 0.14), z, 0, 0, a + math.pi / 2), "bois", choix(T.bois, i + graine), grain="x", tremble=0.012)
        for i in range(4):
            a = i * math.pi / 4 + 0.1
            s.box(2 * r - 0.3, 0.14, 0.07, at(0, 0, z, 0, 0, a), "bois", T.bois[(i + 1) % 3], grain="x", tremble=0.012)
    for i in range(16):
        a = i * math.pi / 8
        s.box(0.5, 0.05, largeur + 0.1, at(math.cos(a) * (r - 0.02), math.sin(a) * (r - 0.02), z0 + largeur / 2, 0, 0, a + 0.25), "bois", choix(T.bois_clair, i + graine), grain="z", tremble=0.014)


def bassin(s: Atelier, T, longueur=3.2, largeur=1.8, graine=0):
    """Bassin de lavoir: margelle de pierres inclinée vers l'eau (on y bat le linge à genoux),
    eau au fond. Origine: centre, au sol."""
    h = 0.5
    for cote in (-1, 1):
        n = max(2, round(longueur / 0.9))
        for i in range(n):
            lw = longueur / n
            # Inclinée vers l'eau, la margelle est relevée de 3 cm: son arête basse ne s'enfonce pas.
            s.box(lw - 0.02, h, 0.4, at(-longueur / 2 + (i + 0.5) * lw, h / 2 + 0.03, cote * (largeur / 2 - 0.2), 0, cote * -0.12, 0), "pierre", T.pierre[(i + cote + graine) % 4], tremble=0.012, sans="y-")
    for cote in (-1, 1):
        s.box(0.36, h, largeur - 0.8, at(cote * (longueur / 2 - 0.18), h / 2, 0), "pierre", T.pierre[(cote + 2 + graine) % 4], tremble=0.018, sans="y-")
    s.box(longueur - 0.7, 0.04, largeur - 0.78, at(0, h - 0.16, 0), "vitre", T.eau, tremble=0.0, sans="y-x-x+z-z+")


def croix(s: Atelier, T, hauteur=1.6):
    """Croix de fer du clocher. Origine: pied."""
    s.box(0.07, hauteur, 0.07, at(0, hauteur / 2, 0), "metal", T.fer, tremble=0.004, sans="y-")
    s.box(0.7, 0.07, 0.07, at(0, hauteur * 0.68, 0), "metal", T.fer, tremble=0.004)
    s.cyl(0.14, 0.2, 0.2, 6, at(0, 0.05, 0), "metal", T.zinc, tremble=0.004)


def abat_sons(s: Atelier, T, largeur=1.1, hauteur=2.2, graine=0):
    """Baie de clocher: jambages et arc de pierre, lames de bois inclinées qui rabattent le son
    des cloches vers le bourg. Origine: milieu du bas du tableau."""
    s.box(largeur + 0.4, 0.14, 0.26, at(0, -0.07, 0.08), "pierre", T.pierre[2], tremble=0.012, sans="z-y-")
    piedroits(s, T, largeur / 2, 0, hauteur, graine, n=4)
    arc(s, T, largeur + 0.3, hauteur, 0.36, 5, graine)
    n = max(3, round(hauteur / 0.36))
    for i in range(n):
        s.box(largeur, 0.04, 0.3, at(0, (i + 0.5) * hauteur / n, -0.03, 0, 0.7, 0), "bois", choix(T.bois, i + graine), grain="x", tremble=0.008, sans="x-x+")


def bucher(s: Atelier, T, longueur=2.2, profondeur=0.7, hauteur=1.5, graine=0):
    """Bûcher adossé au mur: bûches empilées sur deux traverses (le bois ne touche pas la
    terre), tenues par deux poteaux, sous un appentis de planches qui les garde au sec; de haut,
    un petit toit de plus contre la maison. Origine: pied du mur, au milieu du bûcher."""
    demi = longueur / 2
    for z in (0.12, profondeur - 0.1):
        s.box(longueur, 0.09, 0.09, at(0, 0.045, z), "bois", T.bois[1], grain="x", tremble=0.008, sans="y-")
    # La pile: un massif de bois sombre, puis les bouts des bûches en quinconce sur le devant.
    s.box(longueur - 0.08, hauteur - 0.1, profondeur - 0.12, at(0, 0.09 + (hauteur - 0.1) / 2, (profondeur - 0.12) / 2), "bois", fonce(T.bois[0], 0.7), grain="x", tremble=0.01, sans="y-z-")
    r = 0.095
    pas_y = 2 * r * 0.9
    rangs = int((hauteur - 0.12) / pas_y)
    for rg in range(rangs):
        decale = r if rg % 2 else 0.0
        n = int((longueur - 0.12 - decale) / (2 * r))
        for k in range(n):
            g = graine + rg * 17 + k
            rr = r * (0.78 + 0.22 * tirage(g))
            x = -demi + 0.06 + r + decale + k * 2 * r
            y = 0.09 + r + rg * pas_y
            s.cyl(rr, rr, 0.05, 5, at(x, y, profondeur - 0.1 + tirage(g + 1) * 0.04, tirage(g + 2) * 1.2, math.pi / 2, 0), "bois", choix(T.bois_clair, g + 3), grain=None, tremble=0.006)
    haut_mur, haut_bord = hauteur + 0.45, hauteur + 0.18
    for c in (-1, 1):
        poteau(s, T, haut_bord, c * (demi + 0.04), profondeur + 0.04, graine + c, section=0.1)
    pente = math.atan2(haut_mur - haut_bord, profondeur + 0.25)
    long = (profondeur + 0.25) / math.cos(pente)
    n = max(3, round((longueur + 0.4) / 0.24))
    for k in range(n):
        x = -demi - 0.2 + (k + 0.5) * (longueur + 0.4) / n
        s.box((longueur + 0.4) / n - 0.015, 0.035, long, at(x, (haut_mur + haut_bord) / 2 + 0.03, (profondeur + 0.25) / 2, 0, pente, penche(graine + k, 0.02)), "bardage", choix(T.bois, graine + k), grain="z", tremble=0.006)


def contrefort(s: Atelier, T, hauteur=5.0, graine=0):
    """Contrefort d'église: un massif de pierres qui épaule le mur là où pousse la charpente,
    en deux ressauts coiffés d'un glacis qui rejette la pluie. Origine: pied, sur le nu du mur."""
    bas = hauteur * 0.55
    n = max(2, round(bas / 0.6))
    for i in range(n):
        h = bas / n
        s.box(0.8, h - 0.012, 0.75, at(0, h / 2 + i * h, 0.36 + tirage(i + graine) * 0.02), "pierre", T.pierre[(i + graine) % 4], tremble=0.016, sans="z-y-")
    s.prisme([(0, 0), (0.78, 0), (0.5, 0.42), (0, 0.42)], 0.8, at(0, bas, 0, -math.pi / 2), "pierre", T.pierre[2], tremble=0.012, flancs=(1, 2))
    n = max(2, round((hauteur - bas - 0.42) / 0.6))
    for i in range(n):
        h = (hauteur - bas - 0.42) / n
        s.box(0.7, h - 0.012, 0.48, at(0, bas + 0.42 + h / 2 + i * h, 0.23 + tirage(i + 9 + graine) * 0.02), "pierre", T.pierre[(i + 1 + graine) % 4], tremble=0.016, sans="z-y-")
    s.prisme([(0, 0), (0.5, 0), (0, 0.6)], 0.7, at(0, hauteur, 0, -math.pi / 2), "pierre", T.pierre[2], tremble=0.012, flancs=(1,))


def trou_haut(T, x, y, largeur, hauteur):
    return dict(x0=x - largeur / 2, x1=x + largeur / 2, y0=y, y1=y + hauteur, creux=CREUX_FENETRE + 0.06, fond=[(y, y + hauteur, "bois", T.fond)])


ESCALIER_CONTREMARCHE = 0.19
"""Contremarche la plus haute admise: un escalier de service, raide mais à taille humaine."""
ESCALIER_GIRON = 0.25
"""Giron: 2 x 19 + 25 = 63 cm, dans la règle du pas (60 à 64 cm)."""
PALIER = (-0.6, 0.75)
"""Le palier, depuis l'axe de la porte servie: il passe devant toute la baie et son jambage droit."""


def marches_d_escalier(hauteur: float) -> tuple[int, float]:
    """Nombre de contremarches et leur hauteur pour monter à `hauteur`."""
    n = max(2, math.ceil(hauteur / ESCALIER_CONTREMARCHE - 1e-6))
    return n, hauteur / n


def volee(hauteur: float) -> float:
    """Longueur de la volée, du nez de la première marche au palier."""
    n, _h = marches_d_escalier(hauteur)
    return (n - 1) * ESCALIER_GIRON


def escalier(s: Atelier, T, hauteur=2.47, largeur=1.0, graine=0):
    """Escalier extérieur de pierre le long d'un mur, qui dessert une porte d'étage: palier
    devant la porte, volée qui descend vers la gauche (vu de dehors), massif de moellons
    dessous, marches de pierre une à une (19 cm au plus, giron de 25 cm), garde-corps de fer
    (main courante, lisse basse, poteaux) le long du vide et au bout du palier.
    Origine: axe de la porte servie, au pied du mur; `hauteur`: dessus du palier (seuil)."""
    n, h = marches_d_escalier(hauteur)
    x_pal, x_fin = PALIER
    x_pied = x_pal - (n - 1) * ESCALIER_GIRON
    # Massifs: le palier sur son mur de moellons, la volée sur son triangle de maçonnerie.
    s.box(x_fin - x_pal, hauteur - 0.12, largeur, at((x_pal + x_fin) / 2, (hauteur - 0.12) / 2, largeur / 2), "moellon", T.pierre[1], tremble=0.01, sans="z-y-x-")
    s.box(x_fin - x_pal + 0.04, 0.12, largeur + 0.05, at((x_pal + x_fin) / 2 + 0.02, hauteur - 0.06, largeur / 2 + 0.025), "pierre", T.pierre[2], tremble=0.008, sans="z-y-")
    s.prisme([(x_pied, 0), (x_pal, 0), (x_pal, hauteur - h - 0.04)], largeur, at(0, 0, largeur / 2), "moellon", T.pierre[3], tremble=0.0, sans="z-", flancs=())
    for i in range(n - 1):
        haut = (i + 1) * h
        epais = min(h + 0.1, haut)
        s.box(ESCALIER_GIRON + 0.03, epais, largeur + 0.04, at(x_pied + (i + 0.5) * ESCALIER_GIRON - 0.015, haut - epais / 2, largeur / 2 + 0.02), "pierre", T.pierre[(i + graine) % len(T.pierre)], tremble=0.008, sans="z-y-x+")
    # Garde-corps: le long du vide (bord extérieur), puis au bout du palier, jusqu'au mur.
    zr = largeur - 0.03
    pente = math.atan2(hauteur - h, x_pal - x_pied)
    long = math.hypot(x_pal - x_pied, hauteur - h)
    for dessus, epais in ((0.92, 0.055), (0.45, 0.04)):
        s.box(long, epais, epais, at((x_pied + x_pal) / 2, (h + hauteur) / 2 + dessus, zr, 0, 0, pente), "metal", T.fer, tremble=0.003)
        s.box(x_fin - x_pal + 0.05, epais, epais, at((x_pal + x_fin) / 2, hauteur + dessus, zr), "metal", T.fer, tremble=0.003)
        s.box(epais, epais, zr - 0.03, at(x_fin - 0.03, hauteur + dessus, (zr + 0.03) / 2), "metal", T.fer, tremble=0.003)
    poteaux = [x_pied + 0.06 + k * (x_pal - x_pied - 0.06) / 3 for k in range(4)] + [x_fin - 0.03]
    for x in poteaux:
        sol = h + (x - x_pied) * math.tan(pente) if x < x_pal - 1e-6 else hauteur
        s.box(0.045, 0.95, 0.045, at(x, sol + 0.475, zr), "metal", T.fer, tremble=0.002, sans="y-y+")
