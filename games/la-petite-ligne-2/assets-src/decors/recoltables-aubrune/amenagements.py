"""Aménagements encrés d'Aubrune: haies, talus de berge, rangs du labour, meubles, ouvrages.

Mêmes règles que `familles.py` (numpy seul, un ton en aplat par morceau, rien sous le sol, ni
dessous ni UV), pour ce qui était encore affiché en blocs provisoires.

Familles:
- `haie`, `talus`, `rang`: des modules de 1 m posés case par case sur de longues files. Leurs
  bouts (x = -0,5 et x = +0,5, ou z pour le rang) ont tous le même profil, sans tremblé, et les
  normales y ne dépendent que de ce profil: deux modules voisins, de la même forme ou non, se
  raccordent sans couture. Seul l'intérieur du module varie d'une forme à l'autre.
- `meuble`: un meuble d'intérieur ou de cour. Origine au centre de son emprise (la fiche du jeu),
  avant vers +z: le côté d'où l'on s'en sert. Il tient dans ses cases.
- `ouvrage`: un repère du lieu (château d'eau, sémaphore, roue, portail, pigeonnier). Origine au
  pied, au centre; avant vers +z (vers la voie, l'eau ou le chemin qui le justifie).

Raisons d'être tenues ici:
- une haie champêtre fait 1,45 m (on ne voit pas par-dessus à hauteur d'homme, on voit son
  voisin au-dessus); elle pousse sur toute sa case, ses masses ne dépassent jamais du module;
- un talus de berge porte l'herbe en haut et montre sa terre et ses pierres du côté de l'eau (+z),
  là où le courant l'a mangé;
- un comptoir présente au client (+z) ses panneaux et sa marchandise, le marchand est derrière;
- la cuve du château d'eau est en tôle rivetée sur une pile de maçonnerie; son tuyau de vidange
  descend sur la face qui regarde la voie (+z), la grue à eau est un modèle à part posé au bord
  du quai;
- le bras du sémaphore est à l'horizontale (voie fermée): c'est lui qu'on fera bouger.
"""

from __future__ import annotations

import math

import numpy as np

from formes import Atelier, at, choix, entre, penche, tirage, ton


def _modele(ident: str, s: Atelier, **notice) -> dict:
    return {"id": ident, "atelier": s, **notice}


# ====================================================================== outils communs
def boite(s: Atelier, x0, x1, y0, y1, z0, z1, mat, couleur, tremble=0.004, sans="y-", dessus=None, ry=0.0, rx=0.0, rz=0.0):
    """Boîte par ses bornes (avant rotation, autour de son centre)."""
    s.box(x1 - x0, y1 - y0, z1 - z0, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, ry, rx, rz), mat, couleur, tremble=tremble, sans=sans, dessus=dessus)


def colonne(s: Atelier, x, z, y0, y1, r, pans, mat, couleur, r1=None, haut=True, dessus=None, tremble=0.0):
    """Cylindre (ou tronc de cône) vertical, ouvert en bas."""
    s.tube([(x, y0, z, r), (x, y1, z, r if r1 is None else r1)], pans, mat, couleur, bouts=(False, haut), coupe=dessus, tremble=tremble)


def barre(s: Atelier, a, b, r, pans, mat, couleur, bouts=(True, True), coupe=None):
    """Cylindre d'un point à un autre (axe, poignée, tuyau droit)."""
    s.tube([(*a, r), (*b, r)], pans, mat, couleur, bouts=bouts, coupe=coupe)


def nappe(s: Atelier, sommets, faces, normales, mat, couleurs) -> None:
    """Un morceau aux normales données par sommet (raccords sans couture entre modules).

    `faces`: triangles ou quadrilatères; chaque face est tournée du côté de la normale moyenne de
    ses sommets. `couleurs`: une par face."""
    s.morceaux += 1
    v = np.array(sommets, dtype=float)
    n = np.array(normales, dtype=float)
    n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-12)
    for f, c in zip(faces, couleurs):
        idx = list(f)
        for k in range(1, len(idx) - 1):
            tri = [idx[0], idx[k], idx[k + 1]]
            p = v[tri]
            g = np.cross(p[1] - p[0], p[2] - p[0])
            if np.linalg.norm(g) < 1e-10:
                continue
            if np.dot(g, n[tri].sum(0)) < 0:
                tri = [tri[0], tri[2], tri[1]]
            s.tris.append((mat, v[tri].copy(), n[tri].copy(), np.repeat(np.array(c, dtype=float)[None, :], 3, axis=0)))


def orientees(sommets, faces, vers):
    """Faces tournées vers la direction voulue (`vers`: un vecteur par face): à passer avec garde."""
    v = np.array(sommets, dtype=float)
    out = []
    for f, d in zip(faces, vers):
        p = v[list(f)]
        g = np.cross(p[1] - p[0], p[2] - p[0])
        out.append(tuple(f) if np.dot(g, d) >= 0 else tuple(reversed(f)))
    return out


def anneau(s: Atelier, centre, r_in, r_out, epaisseur, n, mat, couleur, axe="x", faces_bord=True, phase=0.0):
    """Anneau plat autour d'un axe (jante de roue, cercle de cuve vu de face): n segments."""
    cx, cy, cz = centre
    v, faces, vers = [], [], []

    def point(r, a, cote):
        ca, sa = math.cos(a) * r, math.sin(a) * r
        if axe == "x":
            return (cx + cote * epaisseur / 2, cy + sa, cz + ca)
        return (cx + ca, cy + sa, cz + cote * epaisseur / 2)

    for i in range(n):
        a = phase + i / n * math.tau
        for r in (r_in, r_out):
            for cote in (-1, 1):
                v.append(point(r, a, cote))
    ax = np.array((1.0, 0, 0)) if axe == "x" else np.array((0, 0, 1.0))
    for i in range(n):
        j = (i + 1) % n
        a = phase + (i + 0.5) / n * math.tau
        radial = np.array((0, math.sin(a), math.cos(a))) if axe == "x" else np.array((math.cos(a), math.sin(a), 0))
        k0, k1 = i * 4, j * 4
        # Sommets: (r_in,-), (r_in,+), (r_out,-), (r_out,+)
        faces += [(k0 + 1, k1 + 1, k1 + 3, k0 + 3), (k0 + 0, k0 + 2, k1 + 2, k1 + 0)]
        vers += [ax, -ax]
        if faces_bord:
            faces += [(k0 + 2, k0 + 3, k1 + 3, k1 + 2), (k0 + 0, k1 + 0, k1 + 1, k0 + 1)]
            vers += [radial, -radial]
    s.morceau(v, orientees(v, faces, vers), mat, couleur, garde=True)


def bosse(s: Atelier, cx, cy, cz, r, h, graine, couleur, mat="feuillage", pans=5, borne=None, rz=None, dessus=None):
    """Masse de feuillage anguleuse: un cône à pans cabossé, enfoncé dans ce qui le porte.
    Normales rayonnant de son coeur: l'ombre dessine une masse, le trait fin la sépare.
    `r`, `rz`: rayons en x et en z. `borne`: demi-largeur en x et z à ne pas dépasser (un module
    de file reste dans sa case). `dessus`: teinte des faces tournées vers le ciel."""
    v = []
    rz = r if rz is None else rz
    if borne is not None:
        r = min(r, (borne - abs(cx)) / 1.15)
        rz = min(rz, (borne - abs(cz)) / 1.15)
    a0 = tirage(graine) * math.tau
    for i in range(pans):
        a = a0 + i / pans * math.tau
        k = 0.85 + 0.3 * tirage(graine * 3.3 + i)
        v.append((cx + math.cos(a) * r * k, cy, cz + math.sin(a) * rz * k))
    for i in range(pans):
        a = a0 + (i + 0.5) / pans * math.tau
        k = 0.74 + 0.18 * tirage(graine * 5.1 + i)
        v.append((cx + math.cos(a) * r * k, cy + h * entre(0.48, 0.62, graine + i), cz + math.sin(a) * rz * k))
    v.append((cx + penche(graine, r * 0.15), cy + h, cz + penche(graine + 1, rz * 0.15)))
    faces = []
    for i in range(pans):
        j = (i + 1) % pans
        faces.append((i, j, pans + i))
        faces.append((j, pans + j, pans + i))
        faces.append((pans + i, pans + j, 2 * pans))
    coeur = np.array((cx, cy + h * 0.15, cz))
    normales = [np.array(p) - coeur for p in v]
    couleurs = []
    for f in faces:
        p = np.array([v[k] for k in f])
        n = np.cross(p[1] - p[0], p[2] - p[0])
        n = n / (np.linalg.norm(n) + 1e-12)
        couleurs.append(dessus if dessus is not None and abs(n[1]) > 0.62 else couleur)
    nappe(s, v, faces, normales, mat, couleurs)


# ====================================================================== haie champêtre
# Profil commun aux deux bouts de tous les modules: (z, y), du pied avant au pied arrière. Le
# corps assure la continuité de la file; ce qu'on voit, ce sont les masses posées devant et dessus.
HAIE_PROFIL = [(0.3, 0.0), (0.36, 0.45), (0.26, 0.92), (0.02, 1.1), (-0.24, 1.04), (-0.36, 0.68), (-0.3, 0.0)]
HAIE_AXE_Y = 0.5
# Masses d'un module droit: (x, bas, z, rayon x, rayon z, hauteur). Le bas de la masse avant
# descend près du sol: la haie touche terre, on ne voit pas dessous.
HAIE_MASSES = ((-0.16, 0.12, 0.17, 0.34, 0.28, 0.78), (0.2, 0.5, 0.14, 0.28, 0.3, 0.8), (-0.1, 0.82, -0.1, 0.36, 0.36, 0.64))


def _haie_normale(p):
    """Normale d'un point du corps de haie: elle rayonne de l'axe (ligne y = HAIE_AXE_Y, z = 0),
    donc ne dépend que du profil aux bouts: deux modules voisins s'ombrent pareil au raccord."""
    return np.array((0.0, p[1] - HAIE_AXE_Y, p[2] * 1.25))


def _haie_corps(s: Atelier, stations, couleur_flanc, couleur_dessus, axe="x"):
    """Corps de haie: le profil (déformé par station) tiré le long de l'axe. `stations`:
    [(position sur l'axe, échelle en z, échelle en y, décalage z)]."""
    P = len(HAIE_PROFIL)
    v, n = [], []
    for pos, kz, ky, dz in stations:
        for z, y in HAIE_PROFIL:
            p = (pos, y * ky, z * kz + dz) if axe == "x" else (z * kz + dz, y * ky, pos)
            v.append(p)
            q = (pos, y * ky, z * kz + dz)
            nn = _haie_normale(q)
            n.append(nn if axe == "x" else np.array((nn[2], nn[1], nn[0])))
    faces, couleurs = [], []
    for i in range(len(stations) - 1):
        for k in range(P - 1):
            faces.append((i * P + k, i * P + k + 1, (i + 1) * P + k + 1, (i + 1) * P + k))
            haut = min(HAIE_PROFIL[k][1], HAIE_PROFIL[k + 1][1]) > 1.0
            couleurs.append(couleur_dessus if haut else couleur_flanc)
    nappe(s, v, faces, n, "feuillage", couleurs)
    return v


def _haie_bout(s: Atelier, x, kz, ky, couleur, vers=1.0):
    """Bout de haie: le profil fermé (éventail), tourné vers l'extérieur de la file."""
    v = [(x, y * ky, z * kz) for z, y in HAIE_PROFIL]
    centre = (x + 0.06 * vers, HAIE_AXE_Y, 0.0)
    v.append(centre)
    c = len(v) - 1
    faces = [(c, k, k + 1) for k in range(len(HAIE_PROFIL) - 1)]
    normales = [np.array((vers * 0.9, p[1] - HAIE_AXE_Y, p[2])) for p in v]
    nappe(s, v, faces, normales, "feuillage", [couleur] * len(faces))


def haie(entree: dict, ctx: Contexte) -> list[dict]:
    tons = ctx.tons(entree["teinte"])
    sourd = ton(tons[0], 0.84)
    clair = ton(tons[2 % len(tons)], 1.08)
    out = []
    formes = [{"suffixe": "", "graine": entree["graine"]}] + [{"suffixe": "-" + v["suffixe"], "graine": v["graine"]} for v in entree.get("variantes", [])]
    ids = [entree["id"] + f["suffixe"] for f in formes]

    def masse(x, y, z, rx, rz, h, g, k, pans=5):
        bosse(s, x, y, z, rx, h, g * 7 + k, tons[(k + 1) % len(tons)], pans=pans, borne=0.49, rz=rz, dessus=clair)

    for n, f in enumerate(formes):
        g = f["graine"]
        s = Atelier(g)
        _haie_corps(s, [(-0.5, 1, 1, 0), (0.5, 1, 1, 0)], sourd, ton(sourd, 1.1))
        # Trois masses anguleuses (devant, dessus, épaule): elles font la silhouette et changent
        # d'une forme à l'autre (une forme sur deux en miroir), jamais à cheval sur le raccord.
        miroir = -1 if n % 2 else 1
        for k, (x, y, z, rx, rz, h) in enumerate(HAIE_MASSES):
            masse(miroir * x + penche(g + k, 0.05), y + penche(g + k * 3, 0.06), z + penche(g + k * 5, 0.03), rx, rz, h + penche(g + k * 7, 0.08), g, k)
        out.append(_modele(entree["id"] + f["suffixe"], s, states={}, variants=[i for i in ids if i != entree["id"] + f["suffixe"]] if f["suffixe"] == "" else [], pourquoi=entree.get("pourquoi")))
    if entree.get("bout"):
        g = entree["graine"] + 11
        s = Atelier(g)
        # La file s'arrête à l'est: le corps se resserre et se ferme avant le bord de la case.
        _haie_corps(s, [(-0.5, 1, 1, 0), (0.3, 0.85, 0.86, 0.0)], sourd, ton(sourd, 1.1))
        _haie_bout(s, 0.3, 0.85, 0.86, ton(sourd, 0.94))
        masse(-0.2, 0.14, 0.17, 0.32, 0.27, 0.8, g, 0)
        masse(0.04, 0.78, -0.03, 0.34, 0.38, 0.62, g, 1)
        masse(0.26, 0.3, 0.12, 0.2, 0.24, 0.68, g, 2, pans=4)
        out.append(_modele(entree["bout"], s, states={}, variants=[], pourquoi="bout de la file de haie, fermé vers l'est (tourné par le rendu pour les autres côtés)"))
    if entree.get("angle"):
        g = entree["graine"] + 23
        s = Atelier(g)
        # Angle: la file vient de l'ouest et repart vers le nord. Chaque bras dépasse un peu dans
        # l'autre, ses bouts ouverts restent cachés dedans; une grosse masse couvre la jonction.
        _haie_corps(s, [(-0.5, 1, 1, 0), (0.3, 1.0, 0.98, 0.0)], sourd, ton(sourd, 1.1))
        _haie_corps(s, [(-0.5, 1, 1, 0), (0.3, 1.0, 0.98, 0.0)], sourd, ton(sourd, 1.1), axe="z")
        masse(0.02, 0.76, 0.02, 0.4, 0.4, 0.7, g, 1)
        masse(-0.26, 0.14, 0.2, 0.24, 0.26, 0.86, g, 0, pans=4)
        masse(0.2, 0.18, -0.26, 0.26, 0.24, 0.8, g, 2, pans=3)
        out.append(_modele(entree["angle"], s, states={}, variants=[], pourquoi="angle de haie: de l'ouest vers le nord (tourné par le rendu pour les trois autres)"))
    return out


# ====================================================================== talus de berge
# Profil (t, y): t va de l'arrière (-0,5, côté terre) vers l'eau (+0,5). L'herbe s'arrête à la
# lèvre (t = 0,12); dessous, la pente de terre que le courant a mise à nu.
TALUS_T = (-0.5, -0.3, -0.08, 0.12, 0.5)
TALUS_Y = (0.0, 0.48, 0.7, 0.66, 0.0)
TALUS_LEVRE = 0.12


def _talus_h(t: float) -> float:
    return float(np.interp(t, TALUS_T, TALUS_Y))


def _talus_pente(t: float) -> float:
    e = 1e-3
    return (_talus_h(t + e) - _talus_h(t - e)) / (2 * e)


def _talus_surface(s: Atelier, ctx: Contexte, sorte: str, graine: float, herbe, terre):
    """Surface du talus en grille, hauteur tirée de t (selon la sorte). Normales calculées sur le
    profil seul (sans les bosses intérieures): les bords raccordent leurs voisins."""
    if sorte in ("droit", "bout"):
        xs = (-0.5, -0.15, 0.2, 0.5)
        zs = TALUS_T
    else:
        xs = zs = TALUS_T

    def t_de(x, z):
        if sorte == "angle":  # eau au sud et à l'est
            return max(x, z)
        if sorte == "angle-rentrant":  # eau au sud-est seulement (deux talus qui se rejoignent)
            return min(x, z)
        return z

    def fondu(x):
        # Bout: la crête redescend au niveau du pré avant le bord est.
        if sorte != "bout":
            return 1.0
        return float(np.interp(x, (-0.5, -0.1, 0.5), (1.0, 1.0, 0.0)))

    def hauteur(x, z):
        return _talus_h(t_de(x, z)) * fondu(x)

    def normale(x, z):
        e = 1e-3
        hx = (hauteur(x + e, z) - hauteur(x - e, z)) / (2 * e)
        hz = (hauteur(x, z + e) - hauteur(x, z - e)) / (2 * e)
        return np.array((-hx, 1.0, -hz))

    v, n = [], []
    for z in zs:
        for x in xs:
            bord = abs(abs(x) - 0.5) < 1e-6 or abs(abs(z) - 0.5) < 1e-6
            y = hauteur(x, z)
            zz = z
            if not bord and y > 0.05:
                y += penche(graine + x * 13 + z * 7, 0.03)
                # La lèvre d'herbe n'est pas tirée au cordeau: le courant l'a mangée par endroits.
                if sorte in ("droit", "bout") and abs(z - TALUS_LEVRE) < 1e-6:
                    zz = z + penche(graine * 3 + x * 11, 0.07)
                    y = hauteur(x, zz) + penche(graine + x * 5, 0.02)
            v.append((x, max(0.0, y), zz))
            n.append(normale(x, z))
    nx = len(xs)
    herbe_f, herbe_c, terre_f, terre_c = [], [], [], []
    for j in range(len(zs) - 1):
        for i in range(nx - 1):
            a, b, c, d = j * nx + i, j * nx + i + 1, (j + 1) * nx + i + 1, (j + 1) * nx + i
            # Diagonale choisie le long du pli de l'angle (x = z), sinon quelconque.
            tris = [(a, b, c), (a, c, d)]
            for tri in tris:
                cx = sum(v[k][0] for k in tri) / 3
                cz = sum(v[k][2] for k in tri) / 3
                if t_de(cx, cz) < TALUS_LEVRE - 1e-6:
                    herbe_f.append(tri)
                    herbe_c.append(choix(herbe, graine + i + j * 3))
                else:
                    terre_f.append(tri)
                    terre_c.append(choix(terre, graine + i * 2 + j))
    nappe(s, v, herbe_f, n, "gazon", herbe_c)
    nappe(s, v, terre_f, n, "terre", terre_c)
    return hauteur, t_de


def talus(entree: dict, ctx: Contexte) -> list[dict]:
    herbe = ctx.tons("gazon_berge")
    terre = ctx.tons("terre_berge")
    pierres = ctx.tons("pierre")
    brins = ctx.tons("herbe")
    out = []
    formes = [(entree["id"], "droit", entree["graine"])] + [(entree["id"] + "-" + v["suffixe"], "droit", v["graine"]) for v in entree.get("variantes", [])]
    for cle, sorte in (("bout", "bout"), ("angle", "angle"), ("angle_rentrant", "angle-rentrant")):
        if entree.get(cle):
            formes.append((entree[cle], sorte, entree["graine"] + len(formes) * 17))
    droits = [f[0] for f in formes if f[1] == "droit"]
    for ident, sorte, g in formes:
        s = Atelier(g)
        hauteur, t_de = _talus_surface(s, ctx, sorte, g, herbe, terre)
        # Pierres déchaussées sur la pente de terre: deux ou trois, à mi-pente et au pied.
        nombre = 2
        for k in range(nombre):
            # La pierre reste dans sa case (bord à 0,5 m): une file de modules ne déborde pas.
            r = entre(0.12, 0.16, g + k * 2.7)
            marge = 0.5 - r * 1.25
            for essai in range(12):
                x = entre(-marge, marge, g * 3 + k * 5 + essai)
                z = entre(0.2, marge, g * 7 + k * 3 + essai)
                if t_de(x, z) > 0.18 and (sorte != "bout" or x < 0.1):
                    break
            y = hauteur(x, z)
            s.galet(r * 1.2, r * 0.8, r, at(x, max(0.0, y - r * 0.5), z, g + k), "pierre", choix(pierres, g + k), g * 11 + k, points=7, pose=0.3)
        # Quelques brins qui retombent de la lèvre d'herbe sur la terre.
        for k in range(2):
            x = entre(-0.35, 0.35, g * 5 + k * 9)
            z0 = TALUS_LEVRE - 0.02
            if sorte == "angle":
                z0 = max(z0, x) if x > TALUS_LEVRE else z0
            y0 = hauteur(x, z0)
            if y0 < 0.2:
                continue
            s.brin((x, y0 - 0.01, z0), (x + penche(g + k, 0.05), y0 - 0.08, z0 + 0.14), 0.07, "tige", choix(brins, g + k), envers=ton(brins[0], 0.8))
        notice = {"states": {}, "variants": [i for i in droits if i != ident] if ident == entree["id"] else []}
        raison = {
            "droit": "talus de berge: l'herbe en haut, la terre et les pierres mises à nu côté eau (+z)",
            "bout": "fin de berge: la crête redescend au niveau du pré à l'est",
            "angle": "berge qui tourne: l'eau au sud et à l'est",
            "angle-rentrant": "deux berges qui se rejoignent: l'eau au sud-est seulement",
        }[sorte]
        out.append(_modele(ident, s, pourquoi=raison, **notice))
    return out


# ====================================================================== rang du labour
def rang(entree: dict, ctx: Contexte) -> list[dict]:
    """Un mètre de rang de culture, le long de z: une butte de terre et trois pieds feuillus."""
    terre = ctx.tons("terre_billon")
    feuilles = ctx.tons(entree.get("teinte", "feuille_potager"))
    out = []
    formes = [{"suffixe": "", "graine": entree["graine"]}] + [{"suffixe": "-" + v["suffixe"], "graine": v["graine"]} for v in entree.get("variantes", [])]
    ids = [entree["id"] + f["suffixe"] for f in formes]
    profil = ((-0.24, 0.0), (-0.1, 0.075), (0.1, 0.075), (0.24, 0.0))
    for f in formes:
        g = f["graine"]
        s = Atelier(g)
        v, n = [], []
        for z in (-0.5, 0.0, 0.5):
            for x, y in profil:
                v.append((x, y + (penche(g + x, 0.01) if abs(z) < 0.4 and 0 < y else 0.0), z))
                n.append((x * 1.6 if abs(x) > 0.12 else 0.0, 1.0, 0.0))
        faces = [(j * 4 + i, j * 4 + i + 1, (j + 1) * 4 + i + 1, (j + 1) * 4 + i) for j in range(2) for i in range(3)]
        nappe(s, v, faces, n, "terre", [choix(terre, g + k) for k in range(len(faces))])
        for k in range(3):
            z = -0.33 + k * 0.33 + penche(g + k, 0.04)
            h = entre(0.2, 0.3, g + k * 1.7)
            bosse(s, penche(g + k * 3, 0.03), 0.05, z, entre(0.13, 0.16, g + k), h, g * 13 + k, choix(feuilles, g + k), mat="tige", borne=0.5)
        out.append(_modele(entree["id"] + f["suffixe"], s, states={}, variants=[i for i in ids if i != entree["id"]] if f["suffixe"] == "" else [], pourquoi="un mètre de rang du labour, le long de z: posé bout à bout, les rangs se suivent"))
    return out


# ====================================================================== meubles
def _table(s, ctx, w, d, h, z0=0.0, epaisseur=0.06, pieds=0.065, tablette=None, bois="bois_meuble", plateau=None, ceinture=True):
    """Plateau sur quatre pieds, ceinture et tablette basse facultatives. Centrée en (0, z0)."""
    tons = ctx.tons(bois)
    dessus = ctx.un(plateau or bois, 2)
    boite(s, -w / 2, w / 2, h - epaisseur, h, z0 - d / 2, z0 + d / 2, "bois", tons[0], dessus=dessus)
    for sx in (-1, 1):
        for sz in (-1, 1):
            x = sx * (w / 2 - pieds * 0.9)
            z = z0 + sz * (d / 2 - pieds * 0.9)
            boite(s, x - pieds / 2, x + pieds / 2, 0, h - epaisseur, z - pieds / 2, z + pieds / 2, "bois", tons[1 % len(tons)], sans="y- y+")
    if ceinture:
        boite(s, -w / 2 + pieds, w / 2 - pieds, h - epaisseur - 0.09, h - epaisseur, z0 + d / 2 - pieds * 1.2, z0 + d / 2 - pieds * 0.6, "bois", tons[2 % len(tons)], sans="y- y+")
    if tablette is not None:
        boite(s, -w / 2 + pieds * 0.4, w / 2 - pieds * 0.4, tablette, tablette + 0.035, z0 - d / 2 + pieds * 0.4, z0 + d / 2 - pieds * 0.4, "bois", tons[0], dessus=ctx.un(bois, 1))


def _pot(s, x, y, z, r, h, couleur, pans=7, contenu=None, mat="vitre"):
    """Pot, bocal, bol, cafetière: un fût évasé fermé en haut (le contenu en couleur du dessus).
    Grès et faïence vernissés: couche unie (`vitre`), comme le verre."""
    s.tube([(x, y, z, r * 0.86), (x, y + h * 0.75, z, r), (x, y + h, z, r * 0.9)], pans, mat, couleur, bouts=(False, True), coupe=contenu if contenu is not None else couleur)


def _comptoir_corps(s, ctx, w, d, h, z0, peinture, dessus_mat="bois", dessus_teinte="bois_clair"):
    """Corps de comptoir: caisson peint à panneaux (côté client, +z), plateau qui déborde."""
    corps = ctx.un(peinture)
    boite(s, -w / 2 + 0.04, w / 2 - 0.04, 0, h - 0.05, z0 - d / 2 + 0.03, z0 + d / 2 - 0.04, "bois", corps, sans="y- y+")
    # Plinthe sombre et panneaux en relief sur la face avant.
    boite(s, -w / 2 + 0.03, w / 2 - 0.03, 0, 0.1, z0 + d / 2 - 0.05, z0 + d / 2 - 0.02, "bois", ton(corps, 0.7), sans="y-")
    panneaux = max(1, round((w - 0.1) / 0.6))
    larg = (w - 0.1) / panneaux
    for k in range(panneaux):
        x0 = -w / 2 + 0.05 + k * larg
        boite(s, x0 + 0.06, x0 + larg - 0.06, 0.2, h - 0.17, z0 + d / 2 - 0.045, z0 + d / 2 - 0.02, "bois", ton(corps, 1.1), sans="y- z-")
    s.box(w, 0.05, d + 0.06, at(0, h - 0.025, z0 + 0.01), dessus_mat, ctx.un(dessus_teinte), tremble=0.003, dessus=ctx.un(dessus_teinte, 1))


def _meuble(sorte: str, entree: dict, ctx: Contexte, graine: float, vide: bool) -> tuple[Atelier, dict]:
    s = Atelier(graine)
    notice: dict = {}
    fer = ctx.tons("fer")
    laiton = ctx.un("laiton")
    bois = ctx.tons("bois_meuble")
    if sorte == "plan-de-travail":
        # Plan de travail contre le mur (arrière à -0,45): plateau épais, tablette basse garnie.
        _table(s, ctx, 1.86, 0.62, 0.88, z0=-0.13, epaisseur=0.07, tablette=0.16, plateau="bois_clair")
        for k, x in enumerate((-0.62, -0.3)):
            _pot(s, x, 0.195, -0.16, 0.11, 0.24, ctx.un("gres", k), contenu=ton(ctx.un("gres", k), 0.8))
        s.box(0.42, 0.03, 0.28, at(0.35, 0.895, -0.12, 0.08), "bois", ctx.un("bois_clair", 3), tremble=0.002)
        _pot(s, -0.4, 0.88, -0.2, 0.15, 0.1, ctx.un("gres", 1), contenu=ctx.un("farine"))
        s.galet(0.1, 0.06, 0.08, at(0.32, 0.92, -0.1, 0.4), "fruit", ctx.un("pain"), graine, points=9, pose=0.2)
        barre(s, (0.62, 0.895, -0.05), (0.84, 0.895, -0.02), 0.012, 4, "metal", fer[0])
        notice["top"] = 0.88
    elif sorte == "rechaud":
        # Petit fourneau de fonte sur pieds, contre le mur: deux feux, une casserole, porte du foyer devant.
        boite(s, -0.3, 0.3, 0.2, 0.74, -0.38, 0.12, "metal", fer[0])
        s.box(0.66, 0.04, 0.56, at(0, 0.76, -0.13), "metal", fer[1], tremble=0.002)
        for sx in (-1, 1):
            for sz in (-1, 1):
                boite(s, sx * 0.26 - 0.03, sx * 0.26 + 0.03, 0, 0.2, -0.13 + sz * 0.21 - 0.03, -0.13 + sz * 0.21 + 0.03, "metal", fer[1], sans="y- y+")
        for x in (-0.14, 0.15):
            colonne(s, x, -0.13, 0.78, 0.795, 0.11, 8, "metal", ctx.un("fer_clair"))
        s.tube([(-0.14, 0.795, -0.13, 0.1), (-0.14, 0.9, -0.13, 0.1)], 8, "metal", ctx.un("cuivre"), bouts=(False, True), coupe=ton(ctx.un("cuivre"), 0.7))
        barre(s, (-0.04, 0.88, -0.13), (0.12, 0.88, -0.05), 0.014, 4, "metal", fer[1])
        boite(s, -0.2, 0.1, 0.32, 0.6, 0.12, 0.14, "metal", fer[1], sans="y- z-")
        s.octa(0.025, 0.025, 0.02, at(0.06, 0.46, 0.15), "metal", laiton)
        boite(s, -0.2, 0.2, 0.22, 0.28, 0.12, 0.135, "metal", ton(fer[0], 1.2), sans="y- z-")
        notice["top"] = 0.78
    elif sorte == "four":
        # Four de maçonnerie (fournil, foyer de la forge): socle de pierre, voûte enduite, gueule
        # en arc devant (+z) où rougeoient les braises, conduit qui monte à l'arrière.
        pierre = ctx.tons("pierre")
        for k in range(3):
            y0 = k * 0.25
            for i in range(2):
                x0 = -0.46 + i * 0.46 + (0.12 if k % 2 else 0) * (1 if i == 0 else -1) * 0
                boite(s, -0.46 + i * 0.46 + (0.004 if i else 0), -0.004 + (i + 1) * 0.46 - 0.46 + (0.004 if not i else 0.0), y0, y0 + 0.245, -0.44, 0.44, "pierre", pierre[(k + i) % len(pierre)], tremble=0.006, sans="y-" if k == 2 else "y- y+")
        crepi = ctx.tons("crepi")
        rings = [(0.0, 0.42), (0.18, 0.4), (0.32, 0.31), (0.42, 0.16), (0.46, 0.02)]
        s.tube([(0, 0.75 + y, -0.04, r) for y, r in rings], 9, "crepi", crepi[0], bouts=(False, False))
        # Gueule: arc de pierres claires, fond noir, braises.
        fond = ctx.un("fond")
        boite(s, -0.2, 0.2, 0.3, 0.6, 0.36, 0.445, "pierre", fond, sans="y- z+ x+ x-")
        s.morceau([(-0.2, 0.3, 0.445), (0.2, 0.3, 0.445), (0.2, 0.55, 0.445), (0.0, 0.66, 0.445), (-0.2, 0.55, 0.445)], [(0, 1, 2, 3, 4)], "pierre", fond, garde=False, coeur=(0, 0.45, 0))
        for k in range(5):
            a = math.pi * k / 4
            r = 0.27
            x, y = -math.cos(a) * r, 0.3 + math.sin(a) * r * 1.05 + (0.0 if k in (0, 4) else 0.03)
            s.box(0.1, 0.1, 0.06, at(x, max(0.34, y), 0.455, 0, 0, a - math.pi / 2), "pierre", ctx.un("pierre_claire", k), tremble=0.004)
        for k in range(3):
            s.octa(0.06, 0.035, 0.05, at(-0.08 + k * 0.08, 0.34, 0.41), "fruit", ctx.un("braise", k))
        boite(s, -0.23, 0.23, 0.29, 0.32, 0.38, 0.49, "pierre", ctx.un("pierre_claire"))
        # Conduit de fumée à l'arrière, au-dessus de la voûte.
        boite(s, -0.13, 0.13, 1.1, 1.95, -0.4, -0.16, "crepi", crepi[1], dessus=ctx.un("fond"))
        notice["top"] = 0.75
    elif sorte.startswith("comptoir"):
        garniture = entree.get("garniture", "buvette")
        if garniture == "cafe":
            # Petit comptoir de café, une case: dessus de zinc, cafetière et tasses.
            _comptoir_corps(s, ctx, 0.92, 0.56, 1.0, -0.12, "peint_vert", "metal", "zinc")
            _pot(s, -0.2, 1.0, -0.16, 0.08, 0.2, ctx.un("zinc"), contenu=ctx.un("fer"), mat="metal")
            barre(s, (-0.12, 1.12, -0.16), (-0.06, 1.17, -0.16), 0.014, 4, "metal", ctx.un("zinc"))
            for k, x in enumerate((0.08, 0.26)):
                colonne(s, x, -0.05, 1.0, 1.008, 0.065, 7, "vitre", ctx.un("creme"))
                colonne(s, x, -0.05, 1.008, 1.06, 0.038, 6, "vitre", ctx.un("creme"), dessus=ctx.un("cafe"))
            colonne(s, 0.3, -0.28, 1.0, 1.25, 0.04, 6, "vitre", ctx.un("verre_bouteille"))
            notice["top"] = 1.0
        else:
            peinture = {"epicerie": "peint_bleu", "fournil": "peint_creme", "mercerie": "peint_rose", "buvette": "bois_meuble"}[garniture]
            dessus = "zinc" if garniture == "buvette" else "bois_clair"
            _comptoir_corps(s, ctx, 1.9, 0.62, 0.98, -0.1, peinture, "metal" if dessus == "zinc" else "bois", dessus)
            y = 0.98
            if garniture == "epicerie":
                # Balance de laiton, bocaux de bonbons, un cornet de papier.
                boite(s, -0.62, -0.32, y, y + 0.06, -0.2, 0.02, "metal", laiton)
                barre(s, (-0.47, y + 0.06, -0.09), (-0.47, y + 0.24, -0.09), 0.012, 4, "metal", laiton)
                barre(s, (-0.66, y + 0.24, -0.09), (-0.28, y + 0.24, -0.09), 0.01, 4, "metal", laiton)
                for x in (-0.64, -0.3):
                    colonne(s, x, -0.09, y + 0.13, y + 0.15, 0.08, 7, "metal", laiton)
                for k, x in enumerate((0.1, 0.3, 0.5)):
                    colonne(s, x, -0.22, y, y + 0.22, 0.075, 7, "vitre", ctx.un("bonbons", k), dessus=ctx.un("fer_clair"))
                s.tube([(0.72, y + 0.01, -0.02, 0.01), (0.72, y + 0.2, -0.02, 0.07)], 5, "etoffe", ctx.un("papier"), bouts=(False, True))
            elif garniture == "fournil":
                # Corbeille de miches et baguettes posées en travers.
                s.tube([(-0.45, y, -0.14, 0.2), (-0.45, y + 0.1, -0.14, 0.24)], 9, "bois", ctx.un("osier"), bouts=(False, False))
                for k in range(3):
                    a = k * 2.1 + graine
                    s.galet(0.12, 0.08, 0.1, at(-0.45 + math.cos(a) * 0.09, y + 0.05, -0.14 + math.sin(a) * 0.08, a), "fruit", ctx.un("pain", k), graine + k, points=9, pose=0.15)
                for k in range(3):
                    barre(s, (0.05 + k * 0.05, y + 0.03 + 0.0, -0.3 + k * 0.02), (0.62 + k * 0.05, y + 0.03, -0.12 + k * 0.03), 0.03, 5, "fruit", ctx.un("pain", k + 1), coupe=ctx.un("pain", 2))
                s.galet(0.13, 0.08, 0.12, at(0.75, y, -0.25, 0.3), "fruit", ctx.un("pain"), graine + 9, points=9, pose=0.15)
            elif garniture == "mercerie":
                # Coupons de tissu roulés, mètre de bois, bobines.
                for k in range(3):
                    z = -0.3 + k * 0.13
                    barre(s, (-0.78, y + 0.05, z), (-0.2, y + 0.05, z), 0.05, 6, "etoffe", ctx.un("etoffes", k), coupe=ton(ctx.un("etoffes", k), 0.8))
                boite(s, -0.05, 0.85, y, y + 0.012, 0.12, 0.16, "bois", ctx.un("bois_clair"))
                for k in range(4):
                    colonne(s, 0.2 + k * 0.1, -0.2, y, y + 0.07, 0.03, 6, "etoffe", ctx.un("etoffes", k + 1), dessus=ctx.un("bois_clair"))
            else:
                # Buvette: bouteilles, deux verres, ardoise des prix.
                for k in range(3):
                    x = -0.7 + k * 0.12
                    colonne(s, x, -0.22, y, y + 0.22, 0.04, 6, "vitre", ctx.un("verre_bouteille", k))
                    colonne(s, x, -0.22, y + 0.22, y + 0.3, 0.015, 4, "vitre", ctx.un("verre_bouteille", k), dessus=ctx.un("liege"))
                for x in (-0.2, -0.05):
                    colonne(s, x, -0.05, y, y + 0.1, 0.035, 6, "vitre", ctx.un("vitre"), dessus=ctx.un("cidre"))
                s.box(0.34, 0.28, 0.03, at(0.55, y + 0.14, -0.28, 0, -0.25), "bois", ctx.un("ardoise"), tremble=0.002)
                _pot(s, 0.2, y, -0.2, 0.1, 0.16, ctx.un("gres"), contenu=ctx.un("cidre"))
            notice["top"] = 0.98
    elif sorte == "ratelier":
        # Râtelier contre le mur: deux montants sur patins, deux traverses; les outils pendent
        # devant (+z), tête en bas, manche dans l'encoche de la traverse haute.
        for x in (-0.4, 0.4):
            boite(s, x - 0.04, x + 0.04, 0, 1.45, -0.32, -0.24, "bois", bois[0], dessus=ctx.un("bois_clair"))
            boite(s, x - 0.05, x + 0.05, 0, 0.08, -0.42, 0.0, "bois", bois[1])
        for y in (0.42, 1.25):
            boite(s, -0.46, 0.46, y, y + 0.08, -0.24, -0.18, "bois", bois[2 % len(bois)])
        if not vide:
            forge = entree.get("garniture") == "forge"
            for k in range(3):
                x = -0.26 + k * 0.26
                if forge and k == 1:
                    # Tenailles: deux branches croisées.
                    for sgn in (-1, 1):
                        barre(s, (x - 0.05 * sgn, 0.55, -0.14), (x + 0.04 * sgn, 1.3, -0.15), 0.014, 4, "metal", fer[0])
                    continue
                barre(s, (x, 0.5, -0.14), (x + penche(graine + k, 0.03), 1.33, -0.15), 0.022, 5, "bois", ctx.un("bois_clair", k))
                if forge:
                    boite(s, x - 0.08, x + 0.08, 0.42, 0.52, -0.18, -0.1, "metal", fer[k % 2])
                else:
                    # Fer de hache: lame claire du côté de l'avant.
                    s.morceau([(x - 0.03, 0.44, -0.18), (x + 0.03, 0.44, -0.18), (x + 0.12, 0.36, -0.15), (x + 0.12, 0.6, -0.15), (x - 0.03, 0.58, -0.18), (x + 0.03, 0.58, -0.18),
                               (x - 0.03, 0.44, -0.11), (x + 0.03, 0.44, -0.11), (x + 0.12, 0.36, -0.13), (x + 0.12, 0.6, -0.13), (x - 0.03, 0.58, -0.11), (x + 0.03, 0.58, -0.11)],
                              [(0, 1, 2, 3, 5, 4), (6, 7, 8, 9, 11, 10), (2, 3, 9, 8), (0, 1, 7, 6), (4, 5, 11, 10), (1, 2, 8, 7), (5, 3, 9, 11), (0, 4, 10, 6)],
                              "metal", fer[1], dessus=ctx.un("fer_clair"))
    elif sorte == "enclume":
        # Enclume sur son billot; la bigorne pointe vers l'est, le forgeron se tient devant (+z).
        colonne(s, 0, 0, 0, 0.5, 0.24, 8, "bois", bois[1], dessus=ctx.un("bois_coupe"), tremble=0.008)
        boite(s, -0.15, 0.15, 0.5, 0.58, -0.12, 0.12, "metal", fer[0])
        boite(s, -0.09, 0.09, 0.58, 0.68, -0.07, 0.07, "metal", fer[0], sans="y- y+")
        boite(s, -0.22, 0.2, 0.68, 0.8, -0.09, 0.09, "metal", fer[1], dessus=ctx.un("fer_clair"))
        s.tube([(0.2, 0.75, 0, 0.07), (0.31, 0.75, 0, 0.045), (0.4, 0.77, 0, 0.004)], 6, "metal", fer[1], bouts=(True, False))
        barre(s, (-0.16, 0.82, 0.02), (0.06, 0.82, 0.07), 0.016, 4, "bois", ctx.un("bois_clair"))
        boite(s, -0.2, -0.13, 0.8, 0.86, -0.0, 0.07, "metal", fer[0], ry=0.2)
        # Seau d'eau de trempe au pied.
        colonne(s, 0.3, 0.3, 0, 0.3, 0.13, 8, "bois", bois[0], dessus=ctx.un("eau_sombre"))
    elif sorte == "etabli":
        # Établi de menuisier: plateau épais, presse à l'avant gauche, outils, planches dessous.
        _table(s, ctx, 1.9, 0.64, 0.86, z0=-0.1, epaisseur=0.09, tablette=0.14, plateau="bois_clair", ceinture=False)
        boite(s, -0.95, -0.7, 0.62, 0.86, 0.22, 0.27, "bois", bois[0])
        barre(s, (-0.83, 0.74, 0.27), (-0.83, 0.74, 0.38), 0.02, 5, "metal", fer[0])
        barre(s, (-0.9, 0.74, 0.38), (-0.76, 0.74, 0.38), 0.012, 4, "bois", ctx.un("bois_clair"))
        boite(s, 0.1, 0.36, 0.86, 0.94, -0.2, -0.13, "bois", ctx.un("bois_clair", 1), ry=0.1)
        boite(s, 0.13, 0.33, 0.94, 0.97, -0.18, -0.15, "metal", fer[1], ry=0.1)
        barre(s, (0.5, 0.88, 0.0), (0.72, 0.88, 0.06), 0.03, 6, "bois", bois[1])
        barre(s, (0.42, 0.88, 0.01), (0.5, 0.88, 0.0), 0.012, 4, "bois", ctx.un("bois_clair"))
        for k in range(3):
            boite(s, -0.8, 0.8, 0.175 + k * 0.03, 0.2 + k * 0.03, -0.3 + k * 0.1, -0.16 + k * 0.1, "bois", ctx.un("bois_clair", k), tremble=0.003)
        notice["top"] = 0.86
    elif sorte == "meule":
        # Meule à aiguiser: roue de grès sur un bâti de bois, auge d'eau dessous. Construite axe
        # est-ouest puis tournée: la manivelle vient devant (+z), où se tient celui qui la tourne,
        # et la caméra voit la face de la pierre.
        with s.groupe(at(ry=-math.pi / 2)):
            for x in (-0.22, 0.22):
                for sz in (-1, 1):
                    barre(s, (x, 0.0, sz * 0.26), (x, 0.66, sz * 0.04), 0.035, 4, "bois", bois[0], bouts=(False, True))
            boite(s, -0.26, 0.26, 0.3, 0.36, -0.2, 0.2, "bois", bois[1], sans="y-")
            boite(s, -0.16, 0.16, 0.36, 0.48, -0.14, 0.14, "bois", bois[2 % len(bois)], dessus=ctx.un("eau_sombre"))
            s.tube([(-0.065, 0.74, 0, 0.3), (0.065, 0.74, 0, 0.3)], 12, "pierre", ctx.un("gres_meule"), bouts=(True, True), coupe=ctx.un("gres_meule", 1))
            barre(s, (-0.3, 0.74, 0), (0.36, 0.74, 0), 0.025, 5, "metal", fer[0])
            barre(s, (0.36, 0.74, 0), (0.36, 0.56, 0.06), 0.02, 4, "metal", fer[0])
            barre(s, (0.36, 0.56, 0.06), (0.45, 0.56, 0.06), 0.025, 5, "bois", ctx.un("bois_clair"))
    elif sorte == "poulailler":
        # Poulailler sur pilotis (3 x 2 cases): cabane de planches, toit de tuiles à un pan qui
        # descend vers l'arrière, pondoir à l'est, rampe vers le parc au sud (+z).
        bard = ctx.tons("bois_grise")
        x0, x1, z0, z1, sol = -1.0, 0.8, -0.88, 0.22, 0.5
        for x in (x0 + 0.06, x1 - 0.06):
            for z in (z0 + 0.06, z1 - 0.06):
                boite(s, x - 0.05, x + 0.05, 0, sol, z - 0.05, z + 0.05, "bois", bois[0], sans="y- y+")
        boite(s, x0, x1, sol, sol + 0.95, z0, z1, "bardage", bard[0], sans="y- y+")
        # Pignons qui suivent la pente du toit (avant plus haut).
        haut_av, haut_ar = sol + 1.45, sol + 1.05
        for x in (x0, x1):
            s.morceau([(x, sol + 0.95, z0), (x, sol + 0.95, z1), (x, haut_av - 0.02, z1), (x, haut_ar - 0.02, z0)], [(0, 1, 2, 3)], "bardage", bard[1], coeur=(-0.1, sol + 1.0, (z0 + z1) / 2))
        boite(s, x0, x1, sol + 0.95, haut_av - 0.02, z1 - 0.02, z1, "bardage", bard[1], sans="y- y+ z-")
        pente = math.atan2(haut_av - haut_ar, z1 - z0)
        longueur = math.hypot(haut_av - haut_ar, z1 - z0) + 0.2
        s.box(x1 - x0 + 0.3, 0.06, longueur, at((x0 + x1) / 2, (haut_av + haut_ar) / 2 + 0.02, (z0 + z1) / 2, 0, pente), "tuile", ctx.un("tuile"), tremble=0.004, sans="y-")
        # Porte et trappe des poules, rampe à tasseaux.
        boite(s, -0.55, -0.05, sol + 0.1, sol + 0.85, z1, z1 + 0.025, "bois", ctx.un("peint_rouge"), sans="y- z-")
        boite(s, 0.2, 0.46, sol + 0.02, sol + 0.32, z1, z1 + 0.02, "bois", ctx.un("fond"), sans="y- z-")
        a = math.atan2(sol, 0.62)
        s.box(0.26, 0.03, math.hypot(sol, 0.62), at(0.33, sol / 2 + 0.01, z1 + 0.31, 0, a), "bois", bois[1], tremble=0.003)
        for k in range(4):
            t = (k + 0.5) / 4
            s.box(0.26, 0.025, 0.025, at(0.33, sol * (1 - t) + 0.035, z1 + 0.62 * t, 0, a), "bois", bois[2 % len(bois)], tremble=0.002)
        # Pondoir à l'est: caisson bas à couvercle incliné.
        boite(s, x1, x1 + 0.4, sol + 0.1, sol + 0.55, z0 + 0.15, z1 - 0.15, "bardage", bard[1], sans="y- y+ x-")
        s.box(0.48, 0.04, z1 - z0 - 0.22, at(x1 + 0.2, sol + 0.6, (z0 + z1) / 2, 0, 0, -0.35), "tuile", ctx.un("tuile", 1), tremble=0.003, sans="y-")
        # Petite fenêtre grillagée sur l'avant.
        boite(s, 0.25, 0.6, sol + 0.55, sol + 0.85, z1, z1 + 0.02, "metal", ctx.un("fond"), sans="y- z-")
        # Paille qui dépasse sous la trappe.
        for k in range(3):
            s.brin((0.25 + k * 0.08, sol + 0.02, z1 + 0.02), (0.22 + k * 0.1, sol - 0.06, z1 + 0.12), 0.05, "tige", ctx.un("paille", k))
    elif sorte == "etal":
        # Étal de la tourte: petite table nappée, la tourte sur sa planche, l'ardoise du prix.
        _table(s, ctx, 0.8, 0.6, 0.8, z0=-0.05, epaisseur=0.05)
        nappe_c = [ctx.tons("etoffes")[0], ctx.un("creme")]
        for i in range(4):
            for j in range(3):
                boite(s, -0.42 + i * 0.21, -0.42 + (i + 1) * 0.21, 0.8, 0.808, -0.37 + j * 0.213, -0.37 + (j + 1) * 0.213, "etoffe", nappe_c[(i + j) % 2], tremble=0.0, sans="y-")
        boite(s, -0.42, 0.42, 0.62, 0.808, 0.27, 0.275, "etoffe", nappe_c[0], tremble=0.0, sans="y- y+ z-")
        s.box(0.42, 0.03, 0.42, at(-0.05, 0.823, -0.05, 0.3), "bois", ctx.un("bois_clair"), tremble=0.002)
        if not vide:
            s.tube([(-0.05, 0.838, -0.05, 0.17), (-0.05, 0.89, -0.05, 0.18), (-0.05, 0.915, -0.05, 0.14)], 10, "fruit", ctx.un("tourte"), bouts=(False, True), coupe=ctx.un("tourte", 1))
        s.box(0.22, 0.17, 0.02, at(0.26, 0.9, -0.22, -0.3, -0.25), "bois", ctx.un("ardoise"), tremble=0.002)
        notice["top"] = 0.8
    elif sorte == "miroir":
        # Psyché: cadre sur deux montants à patins, glace inclinée vers l'arrière, face à +z.
        for x in (-0.36, 0.36):
            boite(s, x - 0.035, x + 0.035, 0, 1.55, -0.04, 0.03, "bois", bois[0], dessus=ctx.un("bois_clair"))
            boite(s, x - 0.04, x + 0.04, 0, 0.06, -0.24, 0.22, "bois", bois[1])
        inc = -0.08
        with s.groupe(at(0, 0.98, 0, 0, inc)):
            for x0, x1, y0, y1 in ((-0.32, -0.27, -0.55, 0.55), (0.27, 0.32, -0.55, 0.55), (-0.32, 0.32, -0.6, -0.55), (-0.32, 0.32, 0.55, 0.6)):
                boite(s, x0, x1, y0, y1, -0.03, 0.03, "bois", ctx.un("bois_sombre"), sans="z-")
            boite(s, -0.27, 0.27, -0.55, 0.55, -0.01, 0.012, "vitre", ctx.un("glace"), sans="z- y- y+ x+ x-", tremble=0.0)
            boite(s, -0.12, 0.12, 0.6, 0.66, -0.025, 0.025, "bois", ctx.un("bois_sombre"), sans="z-")
        barre(s, (-0.36, 0.98, 0), (0.36, 0.98, 0), 0.015, 4, "metal", laiton)
    elif sorte == "marmite":
        # Marmite de soupe sur son trépied, les braises dessous; la louche dedans.
        for k in range(3):
            a = k / 3 * math.tau + 0.4
            barre(s, (math.cos(a) * 0.36, 0, math.sin(a) * 0.36), (math.cos(a) * 0.2, 0.42, math.sin(a) * 0.2), 0.02, 4, "metal", fer[0], bouts=(False, True))
        for k in range(4):
            s.octa(0.07, 0.04, 0.06, at(penche(graine + k, 0.12), 0.03, penche(graine + k + 2, 0.12), k), "fruit", ctx.un("braise", k))
        s.tube([(0, 0.3, 0, 0.18), (0, 0.4, 0, 0.27), (0, 0.62, 0, 0.26), (0, 0.66, 0, 0.27)], 10, "metal", fer[0], bouts=(False, True), coupe=ctx.un("soupe") if not vide else ctx.un("fond"))
        barre(s, (0.05, 0.6, 0.02), (0.28, 0.86, 0.1), 0.015, 4, "bois", ctx.un("bois_clair"))
    elif sorte == "cuisiniere":
        # Cuisinière de fonte émaillée: four à droite, foyer à gauche, barre de laiton, tuyau.
        email = ctx.un("email")
        boite(s, -0.4, 0.4, 0.12, 0.82, -0.4, 0.12, "metal", email, sans="y-")
        s.box(0.86, 0.04, 0.58, at(0, 0.84, -0.14), "metal", fer[0], tremble=0.002)
        for sx in (-1, 1):
            boite(s, sx * 0.36 - 0.04, sx * 0.36 + 0.04, 0, 0.12, -0.08 - 0.04, -0.08 + 0.04, "metal", fer[1], sans="y- y+")
            boite(s, sx * 0.36 - 0.04, sx * 0.36 + 0.04, 0, 0.12, -0.32, -0.24, "metal", fer[1], sans="y- y+")
        boite(s, -0.34, -0.04, 0.42, 0.74, 0.12, 0.14, "metal", fer[0], sans="y- z-")
        boite(s, 0.02, 0.34, 0.2, 0.74, 0.12, 0.14, "metal", fer[0], sans="y- z-")
        barre(s, (-0.38, 0.78, 0.18), (0.38, 0.78, 0.18), 0.012, 4, "metal", laiton)
        for x in (-0.18, 0.18):
            colonne(s, x, -0.14, 0.86, 0.875, 0.12, 8, "metal", ctx.un("fer_clair"))
        s.tube([(-0.18, 0.875, -0.14, 0.11), (-0.18, 1.0, -0.14, 0.12)], 8, "metal", ctx.un("email", 1), bouts=(False, True), coupe=ctx.un("fer"))
        colonne(s, 0.26, -0.33, 0.86, 1.9, 0.07, 7, "metal", fer[0])
        notice["top"] = 0.84
    else:
        raise SystemExit(f"{entree['id']}: sorte de meuble inconnue « {sorte} »")
    return s, notice


def meuble(entree: dict, ctx: Contexte) -> list[dict]:
    sorte = entree["sorte"]
    out = []
    etats = {}
    if "bare" in entree.get("etats", []):
        ident_vide = f"{entree['id']}-bare"
        s, notice = _meuble(sorte, entree, ctx, entree["graine"], True)
        out.append(_modele(ident_vide, s, etat="bare", de=entree["id"], **notice))
        etats["bare"] = ident_vide
    s, notice = _meuble(sorte, entree, ctx, entree["graine"], False)
    out.append(_modele(entree["id"], s, states=etats, variants=[], pourquoi=entree.get("pourquoi"), **notice))
    return out


# ====================================================================== ouvrages (repères du lieu)
def _echelle(s, x, z, y0, y1, largeur, ctx, mat="metal", couleur=None, axe="x", ecart=0.3):
    """Échelle droite: deux montants et des barreaux tous les 30 cm."""
    c = couleur or ctx.un("fer")
    for sgn in (-1, 1):
        a = (x + sgn * largeur / 2, y0, z) if axe == "x" else (x, y0, z + sgn * largeur / 2)
        b = (a[0], y1, a[2])
        boite(s, a[0] - 0.025, a[0] + 0.025, y0, y1, a[2] - 0.025, a[2] + 0.025, mat, c, sans="y-", tremble=0.0)
    n = int((y1 - y0 - 0.2) / ecart)
    for k in range(n):
        y = y0 + 0.25 + k * ecart
        if axe == "x":
            boite(s, x - largeur / 2, x + largeur / 2, y, y + 0.03, z - 0.015, z + 0.015, mat, c, sans="y- x+ x-", tremble=0.0)
        else:
            boite(s, x - 0.015, x + 0.015, y, y + 0.03, z - largeur / 2, z + largeur / 2, mat, c, sans="y- z+ z-", tremble=0.0)


def _assises(s, ctx, r, y0, y1, pans, hauteur_assise, teintes, mat="moellon", z_porte=None):
    """Pile de maçonnerie ronde par assises (un morceau par assise: le trait marque les lits)."""
    n = max(1, round((y1 - y0) / hauteur_assise))
    h = (y1 - y0) / n
    for k in range(n):
        s.tube([(0, y0 + k * h, 0, r * (1 + 0.004 * (k % 2))), (0, y0 + (k + 1) * h - 0.005, 0, r * (1 + 0.004 * (k % 2)))], pans, mat, choix(teintes, k * 1.7), bouts=(False, False), tors=0.0)
    return n


def ouvrage(entree: dict, ctx: Contexte) -> list[dict]:
    sorte = entree["sorte"]
    g = entree["graine"]
    s = Atelier(g)
    fer = ctx.tons("fer")
    pierre = ctx.tons("pierre")
    if sorte == "chateau-eau":
        # Pile ronde de moellons (8 m), corniche, cuve de tôle rivetée de 4,4 m, toit conique de
        # zinc. Porte du local de pompe et tuyau de vidange sur la face de la voie (+z); échelle à l'est.
        r = 1.55
        _assises(s, ctx, r, 0, 7.6, 12, 0.95, pierre)
        colonne(s, 0, 0, 0, 0.35, r + 0.12, 12, "pierre", ctx.un("pierre_claire"), haut=False)
        s.tube([(0, 7.55, 0, r + 0.05), (0, 7.75, 0, r + 0.3), (0, 7.9, 0, r + 0.3)], 12, "pierre", ctx.un("pierre_claire"), bouts=(False, True), coupe=ctx.un("pierre_claire", 1))
        # Porte en arc et petite fenêtre sur la face +z.
        boite(s, -0.5, 0.5, 0.0, 2.1, r - 0.08, r + 0.06, "pierre", ctx.un("pierre_claire"), sans="y-")
        boite(s, -0.38, 0.38, 0.0, 1.95, r + 0.06, r + 0.09, "bois", ctx.un("peint_vert"), sans="y- z-")
        boite(s, -0.25, 0.25, 4.6, 5.3, r - 0.06, r + 0.05, "pierre", ctx.un("fond"), sans="y-")
        boite(s, -0.33, 0.33, 4.5, 4.6, r - 0.04, r + 0.12, "pierre", ctx.un("pierre_claire"))
        cuve_r, y0, y1 = 2.2, 7.9, 10.3
        s.tube([(0, y0, 0, cuve_r), (0, y1, 0, cuve_r)], 16, "metal", ctx.un("tole"), bouts=(False, False))
        for y in (y0 + 0.08, (y0 + y1) / 2, y1 - 0.1):
            s.tube([(0, y - 0.06, 0, cuve_r + 0.035), (0, y + 0.06, 0, cuve_r + 0.035)], 16, "metal", ctx.un("tole", 1), bouts=(False, False))
        # Montants verticaux de la tôle (couvre-joints).
        for k in range(8):
            a = k / 8 * math.tau + 0.2
            x, z = math.cos(a) * (cuve_r + 0.02), math.sin(a) * (cuve_r + 0.02)
            s.box(0.08, y1 - y0, 0.04, at(x, (y0 + y1) / 2, z, -a + math.pi / 2), "metal", ctx.un("tole", 1), tremble=0.0, sans="y- y+")
        s.tube([(0, y1, 0, cuve_r + 0.2), (0, y1 + 0.12, 0, cuve_r + 0.2), (0, 11.75, 0, 0.18)], 16, "metal", ctx.un("zinc"), bouts=(False, False))
        colonne(s, 0, 0, 11.7, 12.0, 0.1, 6, "metal", fer[0])
        s.octa(0.12, 0.12, 0.12, at(0, 12.0, 0), "metal", fer[0])
        # Indicateur de niveau: une règle et son flotteur sur la face de la voie.
        boite(s, 0.6, 0.66, y0 + 0.2, y1 - 0.2, cuve_r - 0.02, cuve_r + 0.07, "metal", ctx.un("creme"), sans="y-")
        boite(s, 0.57, 0.69, 9.3, 9.42, cuve_r + 0.05, cuve_r + 0.1, "metal", ctx.un("peint_rouge"))
        # Échelle: du sol au toit de la cuve, à l'est, avec sa crinoline sous la corniche.
        _echelle(s, r + 0.18, 0.0, 0.0, 7.75, 0.45, ctx, axe="z")
        _echelle(s, cuve_r + 0.2, 0.0, 7.9, 10.6, 0.45, ctx, axe="z")
        boite(s, r + 0.12, cuve_r + 0.3, 7.82, 7.9, -0.35, 0.35, "metal", fer[1], tremble=0.0)
        # Tuyau de vidange: sort sous la cuve, descend le long de la pile côté voie, file au sol vers +z.
        t = ctx.un("fer", 1)
        s.tube([(-0.9, 7.9, 1.5, 0.11), (-0.9, 7.6, 1.85, 0.11), (-0.9, 0.5, 1.85, 0.11), (-0.9, 0.18, 2.1, 0.11), (-0.9, 0.18, 2.45, 0.11)], 8, "metal", t, bouts=(False, True), coupe=ctx.un("fond"))
        for y in (1.5, 3.5, 5.5):
            boite(s, -1.02, -0.78, y, y + 0.08, 1.5, 1.98, "metal", fer[0], tremble=0.0)
        boite(s, -1.05, -0.75, 0.0, 0.3, 2.3, 2.5, "pierre", ctx.un("pierre_claire"))
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    if sorte == "grue-eau":
        # Grue à eau au bord du quai: fût de fonte sur son socle, bras pivotant au-dessus de la voie
        # (+z), manche de cuir qui pend, volant de la vanne.
        colonne(s, 0, 0, 0, 0.4, 0.42, 8, "pierre", ctx.un("pierre_claire"), dessus=ctx.un("pierre_claire", 1))
        s.tube([(0, 0.4, 0, 0.2), (0, 0.6, 0, 0.16), (0, 3.0, 0, 0.13), (0, 3.2, 0, 0.17)], 8, "metal", fer[0], bouts=(False, True))
        s.tube([(0, 3.05, -0.3, 0.1), (0, 3.05, 0.0, 0.11), (0, 3.08, 1.9, 0.1), (0, 2.88, 2.12, 0.1)], 8, "metal", fer[0], bouts=(True, True), coupe=ctx.un("fond"))
        barre(s, (0, 3.2, 0), (0, 3.4, 1.3), 0.025, 4, "metal", fer[1], bouts=(False, False))
        s.tube([(0, 2.86, 2.12, 0.09), (0.02, 2.3, 2.16, 0.08), (0.06, 1.75, 2.06, 0.075)], 7, "etoffe", ctx.un("cuir"), bouts=(False, True))
        anneau(s, (0.0, 1.1, 0.24), 0.2, 0.26, 0.04, 10, "metal", ctx.un("peint_rouge"), axe="z")
        barre(s, (0, 1.1, 0.1), (0, 1.1, 0.26), 0.03, 5, "metal", fer[1])
        s.box(0.22, 0.3, 0.22, at(0, 3.42, -0.26), "metal", fer[1], tremble=0.0)
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    if sorte == "semaphore":
        # Sémaphore: mât de treillis de bois sur socle de pierre, échelle derrière, plate-forme,
        # bras rouge à bande blanche à l'horizontale (voie fermée), lanterne à verres de couleur.
        boite(s, -0.5, 0.5, 0, 0.45, -0.5, 0.5, "pierre", ctx.un("pierre_claire"), dessus=ctx.un("pierre_claire", 1))
        bois = ctx.tons("bois_grise")
        H = 9.0
        s.tube([(0, 0.45, 0, 0.2), (0, H, 0, 0.11)], 4, "bois", bois[0], bouts=(False, True), coupe=bois[1])
        for k in range(1, 6):
            y = 0.45 + k * 1.4
            boite(s, -0.24 + k * 0.015, 0.24 - k * 0.015, y, y + 0.06, -0.24 + k * 0.015, 0.24 - k * 0.015, "bois", bois[1], tremble=0.0)
        _echelle(s, 0.0, -0.32, 0.45, H - 0.6, 0.4, ctx, mat="bois", couleur=bois[1])
        # Plate-forme et garde-corps sous le bras.
        boite(s, -0.5, 0.5, 7.6, 7.68, -0.62, 0.3, "bois", bois[1])
        for x in (-0.48, 0.48):
            boite(s, x - 0.025, x + 0.025, 7.68, 8.6, -0.6, -0.55, "metal", fer[0], tremble=0.0)
        boite(s, -0.5, 0.5, 8.55, 8.6, -0.6, -0.55, "metal", fer[0], tremble=0.0)
        # Bras: pivot en haut du mât, côté voie (+z), il pointe vers l'ouest.
        y = 8.4
        boite(s, -2.2, -0.12, y - 0.15, y + 0.15, 0.16, 0.22, "bois", ctx.un("peint_rouge"), tremble=0.0)
        boite(s, -1.95, -1.75, y - 0.151, y + 0.151, 0.221, 0.226, "bois", ctx.un("creme"), tremble=0.0, sans="z-")
        boite(s, -0.12, 0.42, y - 0.2, y + 0.2, 0.16, 0.2, "metal", fer[0], tremble=0.0)
        barre(s, (0.0, y, 0.1), (0.0, y, 0.26), 0.06, 6, "metal", fer[1])
        for k, c in enumerate(("feu_rouge", "feu_vert")):
            anneau(s, (0.18 + k * 0.17, y, 0.21), 0.0, 0.07, 0.02, 7, "vitre", ctx.un(c), axe="z", faces_bord=False)
        # Lanterne au sommet et chapeau.
        boite(s, -0.14, 0.14, H, H + 0.32, -0.14, 0.14, "metal", fer[0], tremble=0.0)
        boite(s, -0.1, 0.1, H + 0.06, H + 0.24, 0.14, 0.15, "vitre", ctx.un("feu_rouge"), tremble=0.0, sans="y- z-")
        s.tube([(0, H + 0.32, 0, 0.22), (0, H + 0.5, 0, 0.04)], 4, "metal", fer[1], bouts=(False, False))
        # Levier de manœuvre au pied et son fil vers le haut.
        barre(s, (0.42, 0.45, 0.42), (0.6, 1.25, 0.6), 0.03, 4, "metal", ctx.un("peint_rouge"), bouts=(False, True))
        barre(s, (0.1, 1.0, 0.12), (0.1, y - 0.2, 0.2), 0.008, 3, "metal", fer[1], bouts=(False, False))
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    if sorte == "roue":
        # Roue à aubes de 6,6 m: deux jantes, rayons, aubes, moyeu sur deux piles de pierre. Le bas
        # plonge dans le bief (le sol du lieu y est creusé). Construite axe est-ouest puis tournée:
        # l'axe court nord-sud, la roue montre sa face au sud (la caméra), le bief coule le long de x.
        with s.groupe(at(ry=math.pi / 2)):
            bois = ctx.tons("bois_grise")
            R, cy = 3.25, 3.75
            for x in (-0.55, 0.55):
                anneau(s, (x, cy, 0), R - 0.25, R, 0.12, 16, "bois", bois[0], axe="x", phase=0.1)
            for k in range(16):
                a = 0.1 + (k + 0.5) / 16 * math.tau
                ca, sa = math.cos(a), math.sin(a)
                # Aube: une planche entre les deux jantes, dans le plan de l'axe.
                p_in, p_out = R - 0.55, R + 0.05
                m = at(0, cy + sa * (p_in + p_out) / 2, ca * (p_in + p_out) / 2, 0, -a + math.pi / 2)
                s.box(1.06, 0.05, p_out - p_in, m, "bois", bois[(k % 2) + 1 if len(bois) > 2 else 0], tremble=0.004, sans="")
            for x in (-0.55, 0.55):
                for k in range(8):
                    a = k / 8 * math.tau + 0.3
                    b = (x, cy + math.sin(a) * (R - 0.2), math.cos(a) * (R - 0.2))
                    barre(s, (x, cy, 0), b, 0.06, 4, "bois", bois[1], bouts=(False, False))
            barre(s, (-1.5, cy, 0), (1.5, cy, 0), 0.16, 8, "bois", bois[0], coupe=ctx.un("bois_coupe"))
            for x in (-0.55, 0.55):
                barre(s, (x - 0.12, cy, 0), (x + 0.12, cy, 0), 0.32, 8, "metal", fer[0])
            for x in (-1.35, 1.35):
                boite(s, x - 0.3, x + 0.3, 0, cy - 0.12, -0.55, 0.55, "moellon", choix(pierre, x), dessus=ctx.un("pierre_claire"))
                boite(s, x - 0.2, x + 0.2, cy - 0.12, cy + 0.05, -0.3, 0.3, "bois", bois[1])
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    if sorte == "portail":
        # Portail du tunnel: tête de maçonnerie de 10 m, arc de 4,6 m bordé de claveaux, bandeau
        # et parapet; murs en aile qui retiennent le talus. La voie passe dans l'axe z.
        W, H, prof = 10.0, 7.3, 0.9
        ouv, haut_pied = 2.3, 3.0
        clair = ctx.tons("pierre_claire")
        mo = ctx.un("moellon_portail")
        # Piédroits.
        for sgn in (-1, 1):
            boite(s, sgn * ouv if sgn > 0 else -W / 2, W / 2 if sgn > 0 else -ouv, 0, H, -prof / 2, prof / 2, "moellon", mo, sans="y- " + ("x-" if sgn > 0 else "x+"))
        # Tympan au-dessus de l'arc: bandes verticales de l'arc au bandeau.
        n = 12
        v, faces, vers = [], [], []
        for i in range(n + 1):
            a = math.pi - i / n * math.pi
            x, y = math.cos(a) * ouv, haut_pied + math.sin(a) * ouv
            for z in (prof / 2, -prof / 2):
                v.append((x, y, z))
                v.append((x, H, z))
        for i in range(n):
            k0, k1 = i * 4, (i + 1) * 4
            faces += [(k0, k1, k1 + 1, k0 + 1), (k0 + 2, k0 + 3, k1 + 3, k1 + 2)]
            vers += [(0, 0, 1), (0, 0, -1)]
            # Intrados: la voûte vue de dessous.
            a = math.pi - (i + 0.5) / n * math.pi
            faces.append((k0, k0 + 2, k1 + 2, k1))
            vers.append((-math.cos(a), -math.sin(a), 0))
        faces.append((1, 3, (n) * 4 + 3, n * 4 + 1))
        vers.append((0, 1, 0))
        s.morceau(v, orientees(v, faces, vers), "moellon", mo, garde=True)
        # Fond noir du tunnel, en retrait.
        fond = ctx.un("noir")
        poly = [(-ouv, 0.0)] + [(ouv, 0.0)] + [(math.cos(i / n * math.pi) * ouv, haut_pied + math.sin(i / n * math.pi) * ouv) for i in range(n + 1)]
        v2 = [(x, y, -0.6) for x, y in poly]
        f2 = [(0, 1, 2)] + [(0, 2 + i, 3 + i) for i in range(n)]
        s.morceau(v2, orientees(v2, f2, [(0, 0, 1)] * len(f2)), "pierre", fond, garde=True)
        # Claveaux: un anneau de pierres claires qui dépasse de 6 cm.
        for i in range(13):
            a0 = math.pi - i / 13 * math.pi
            a1 = math.pi - (i + 1) / 13 * math.pi
            r0, r1 = ouv, ouv + (0.62 if i == 6 else 0.5)
            pts = []
            for a in (a0, a1):
                for r in (r0, r1):
                    for z in (prof / 2 + 0.06, prof / 2 - 0.1):
                        pts.append((math.cos(a) * r, haut_pied + math.sin(a) * r, z))
            fs = [(0, 2, 6, 4), (1, 5, 7, 3), (2, 3, 7, 6), (0, 4, 5, 1), (0, 1, 3, 2), (4, 6, 7, 5)]
            s.morceau(pts, fs, "pierre", clair[i % len(clair)], tremble=0.006)
        # Bandeau, parapet, chaînes d'angle.
        boite(s, -W / 2 - 0.1, W / 2 + 0.1, H, H + 0.22, -prof / 2 - 0.05, prof / 2 + 0.12, "pierre", clair[0])
        boite(s, -W / 2, W / 2, H + 0.22, H + 0.75, -prof / 2 + 0.1, prof / 2 - 0.1, "moellon", mo)
        boite(s, -W / 2 - 0.04, W / 2 + 0.04, H + 0.75, H + 0.85, -prof / 2 + 0.05, prof / 2 - 0.05, "pierre", clair[1 % len(clair)])
        for sgn in (-1, 1):
            for k in range(5):
                y0 = k * H / 5
                large = 0.55 if k % 2 else 0.8
                x0 = sgn * W / 2
                boite(s, min(x0, x0 - sgn * large), max(x0, x0 - sgn * large) + (0.03 if sgn > 0 else 0), y0, y0 + H / 5 - 0.02, prof / 2 - 0.02, prof / 2 + 0.04, "pierre", clair[k % len(clair)], sans="y- z-")
        # Murs en aile qui s'abaissent vers l'avant et retiennent la terre.
        for sgn in (-1, 1):
            x = sgn * (W / 2 + 0.25)
            pts = [(x - 0.3, 0, prof / 2), (x + 0.3, 0, prof / 2), (x + 0.3, 0, prof / 2 + 3.0), (x - 0.3, 0, prof / 2 + 3.0),
                   (x - 0.3, H * 0.85, prof / 2), (x + 0.3, H * 0.85, prof / 2), (x + 0.3, 0.9, prof / 2 + 3.0), (x - 0.3, 0.9, prof / 2 + 3.0)]
            fs = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (4, 5, 6, 7)]
            with s.groupe(at(x, 0, prof / 2, sgn * 0.5) @ at(-x, 0, -prof / 2)):
                s.morceau(pts, fs, "moellon", mo)
        # Talus de terre et d'herbe au-dessus du portail: le coteau que le tunnel traverse.
        herbe = ctx.tons("gazon_berge")
        v3 = [(-W / 2 - 1.2, 0.0, -prof / 2), (W / 2 + 1.2, 0.0, -prof / 2), (-W / 2 - 1.2, H + 0.7, -prof / 2), (W / 2 + 1.2, H + 0.7, -prof / 2),
              (-W / 2 - 1.2, H + 1.3, -3.4), (W / 2 + 1.2, H + 1.3, -3.4)]
        s.morceau(v3, [(2, 3, 5, 4)], "gazon", herbe[0], coeur=(0, 0, 0))
        # Le coteau redescend de chaque côté jusqu'au haut des murs en aile, puis au pré: la tête
        # du tunnel est enfoncée dans la colline, pas posée seule dans l'herbe.
        for sgn in (-1, 1):
            a = (sgn * (W / 2 + 1.2), H + 0.7, -prof / 2)
            b = (sgn * (W / 2 + 1.2), H + 1.3, -3.4)
            e = (sgn * (W / 2 + 0.35), H * 0.85 + 0.05, prof / 2 - 0.1)
            f = (sgn * (W / 2 + 1.75), 0.95, prof / 2 + 2.6)
            g2 = (sgn * (W / 2 + 2.6), 0.0, prof / 2 + 3.2)
            h2 = (sgn * (W / 2 + 7.0), 0.0, -3.4)
            pts = [a, b, e, f, g2, h2]
            s.morceau(pts, [(0, 1, 5), (0, 5, 2), (2, 5, 3), (3, 5, 4)], "gazon", herbe[1 % len(herbe)], coeur=(sgn * 3.0, -4.0, -1.5))
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    if sorte == "pigeonnier":
        # Pigeonnier carré de 3,4 m: rez de moellons, étage enduit, bandeau de pierre qui arrête les
        # rats, lucarne d'envol au sud, toit à quatre pans de tuiles et épi de faîtage.
        c = 1.7
        mo = ctx.tons("pierre")
        boite(s, -c, c, 0, 3.6, -c, c, "moellon", ctx.un("moellon_portail"), sans="y- y+")
        boite(s, -c - 0.08, c + 0.08, 3.6, 3.8, -c - 0.08, c + 0.08, "pierre", ctx.un("pierre_claire"))
        boite(s, -c, c, 3.8, 7.2, -c, c, "crepi", ctx.un("crepi"), sans="y- y+")
        for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            for k in range(7):
                y0 = k * 1.0 + (0.0 if k < 4 else 0.2)
                if y0 > 6.6:
                    break
                large = 0.42 if k % 2 else 0.6
                boite(s, sx * c - (large if sx > 0 else -0.02) if sx > 0 else -c - 0.02, sx * c + 0.02 if sx > 0 else -c + large, y0, y0 + 0.5, sz * c - 0.12 if sz > 0 else -c - 0.02, sz * c + 0.02 if sz > 0 else -c + 0.12, "pierre", mo[k % len(mo)], sans="y-")
        # Porte basse au sud, lucarne et trous d'envol.
        boite(s, -0.45, 0.45, 0, 1.9, c, c + 0.04, "bois", ctx.un("peint_vert"), sans="y- z-")
        boite(s, -0.55, 0.55, 1.9, 2.05, c - 0.02, c + 0.08, "pierre", ctx.un("pierre_claire"))
        for k in range(4):
            boite(s, -0.9 + k * 0.6, -0.72 + k * 0.6, 5.2, 5.42, c - 0.02, c + 0.012, "pierre", ctx.un("fond"), sans="y- z-")
        boite(s, -1.0, 1.0, 5.0, 5.08, c, c + 0.18, "pierre", ctx.un("pierre_claire"))
        for x in (-c, c):
            for k in range(3):
                boite(s, x - 0.012 if x > 0 else x - 0.012, x + 0.012, 5.2, 5.42, -0.9 + k * 0.6, -0.72 + k * 0.6, "pierre", ctx.un("fond"), sans="y-")
        # Toit à quatre pans (pyramide), débord de 35 cm.
        d = c + 0.35
        base, sommet = 7.15, 9.55
        pts = [(-d, base, -d), (d, base, -d), (d, base, d), (-d, base, d), (0, sommet, 0)]
        s.morceau(pts, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], "tuile", ctx.un("tuile"), coeur=(0, base - 1, 0))
        for k, (a, b) in enumerate(((0, 1), (1, 2), (2, 3), (3, 0))):
            barre(s, pts[a], pts[4], 0.07, 4, "tuile", ctx.un("tuile", 3), bouts=(False, False))
        s.tube([(0, sommet - 0.05, 0, 0.09), (0, sommet + 0.25, 0, 0.06), (0, sommet + 0.45, 0, 0.0)], 6, "metal", ctx.un("zinc"), bouts=(False, False))
        # Lucarne d'envol: petit toit à deux pans sur le pan sud.
        lx, ly, lz = 0.0, 7.5, d - 0.6
        boite(s, -0.45, 0.45, ly - 0.25, ly + 0.55, lz - 0.3, lz + 0.25, "crepi", ctx.un("crepi", 1), sans="y-")
        boite(s, -0.3, 0.3, ly - 0.1, ly + 0.35, lz + 0.25, lz + 0.27, "pierre", ctx.un("fond"), sans="y- z-")
        boite(s, -0.45, 0.45, ly - 0.25, ly - 0.17, lz + 0.25, lz + 0.42, "bois", ctx.un("bois_clair"))
        lp = [(-0.55, ly + 0.55, lz - 0.35), (0.55, ly + 0.55, lz - 0.35), (0.55, ly + 0.55, lz + 0.35), (-0.55, ly + 0.55, lz + 0.35), (0, ly + 0.95, lz - 0.35), (0, ly + 0.95, lz + 0.35)]
        s.morceau(lp, [(0, 3, 5, 4), (1, 4, 5, 2), (3, 2, 5), (0, 4, 1)], "tuile", ctx.un("tuile", 1), coeur=(0, ly, lz))
        return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"))]
    raise SystemExit(f"{entree['id']}: sorte d'ouvrage inconnue « {sorte} »")


FAMILLES_AMENAGEMENTS = {"haie": haie, "talus": talus, "rang": rang, "meuble": meuble, "ouvrage": ouvrage}
