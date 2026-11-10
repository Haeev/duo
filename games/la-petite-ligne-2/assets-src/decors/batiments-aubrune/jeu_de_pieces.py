"""Le jeu de pièces d'Aubrune, une à une, pour les poser à la main ou les ouvrir dans Blender.

Les bâtiments assemblés (`assembleur.py`) emploient les mêmes fonctions: ce fichier ne fait que
sortir chaque pièce seule, à son origine, avec sa fiche (cotes, origine, triangles, matériaux).
Pas de la grille: 1 m. Un pan de mur fait 1, 2 ou 3 m de large et un niveau de haut (2,70 m au
rez-de-chaussée, 2,30 m à l'étage); son origine est au pied du mur, au milieu, +z vers le dehors.

Ajouter une pièce: une ligne dans `PIECES` (nom, description, fonction qui la pose).
"""

from __future__ import annotations

import math

import pieces as P
import toits as R
from assembleur import auvent
from atelier import Atelier, at

NIVEAU = 2.7
ETAGE = 2.3
VARIANTES = {
    "": {},
    "sauge": {"volets": "sauge", "porte": "sauge"},
    "rouge": {"volets": "rouge_cheminot", "porte": "rouge_cheminot"},
}
FINITIONS = {"crepi": {"murs": "enduit"}, "pierre": {"murs": "pierre_claire"}, "bardage": {"murs": "bois_brut"}}


def _mur(s, T, large, haut, trous, bas=True, seuils=()):
    P.peau_de_mur(s, T, large, haut, trous, None, 1)
    if bas:
        P.moellons_bas(s, T, -large / 2 + 0.06, large / 2 - 0.04, 7, seuils)


def mur_plein(s, T):
    _mur(s, T, 1.0, NIVEAU, [])


def mur_fenetre(s, T):
    _mur(s, T, 2.0, NIVEAU, [P.trou_fenetre(T, 0, 1.0, 0.8, 1.25)])
    with s.groupe(at(0, 1.0, 0)):
        P.fenetre(s, T, 0.8, 1.25, "ouverts", "bois" if T.finition != "pierre" else "pierre", 3)


def mur_porte(s, T):
    _mur(s, T, 2.0, NIVEAU, [P.trou_porte(T, 0)], seuils=[(-0.82, 0.82)])
    P.porte(s, T, "pleine", "bois" if T.finition != "pierre" else "pierre", 2)


def mur_devanture(s, T):
    _mur(s, T, 3.0, NIVEAU + 0.4, [P.trou_vitrine(T, 0, 2.4)], seuils=[(-1.4, 1.4)])
    P.vitrine(s, T, 2.4, 4)


def mur_grange(s, T):
    _mur(s, T, 4.0, NIVEAU + 0.7, [P.trou_grange(T, 0, 2.4, 2.7)], seuils=[(-1.52, 1.52)])
    P.porte_de_grange(s, T, 2.4, 2.7, 5)


def mur_etage(s, T):
    _mur(s, T, 2.0, ETAGE, [P.trou_fenetre(T, 0, 0.9, 0.8, 1.0)], bas=False)
    with s.groupe(at(0, 0.9, 0)):
        P.fenetre(s, T, 0.8, 1.0, "ouverts", "bois" if T.finition != "pierre" else "pierre", 6)


def mur_etage_plein(s, T):
    _mur(s, T, 1.0, ETAGE, [], bas=False)


def pignon(s, T):
    P.peau_de_mur(s, T, 6.0, 0.0, [P.trou_fenetre(T, 0, 0.8, 0.6, 0.7)], ("pignon", 3 * math.tan(math.radians(40))), 2)
    with s.groupe(at(0, 0.8, 0)):
        P.fenetre(s, T, 0.6, 0.7, "aucun", "bois", 8)


def angle(s, T):
    P.chaine_angle(s, T, 0.0, 0.58, NIVEAU, 3)


def angle_etage(s, T):
    P.chaine_angle(s, T, 0.0, 0.0, ETAGE, 4)


def _fenetre(volets):
    def pose(s, T):
        P.peau_de_mur(s, T, 1.2, 1.5, [P.trou_fenetre(T, 0, 0.12, 0.95, 1.25)], None, 1)
        with s.groupe(at(0, 0.12, 0)):
            P.fenetre(s, T, 0.95, 1.25, volets, "bois", 3)

    return pose


def _porte(modele):
    def pose(s, T):
        P.porte(s, T, modele, "bois", 2)
        s.peau([([(-0.5, P.SEUIL, -0.1), (0.5, P.SEUIL, -0.1), (0.5, P.SEUIL + P.PORTE_HAUT, -0.1), (-0.5, P.SEUIL + P.PORTE_HAUT, -0.1)], (0, 0, 1))], at(0, 0, 0), "bois", T.fond)

    return pose


def _grange(cochere):
    def pose(s, T):
        P.porte_de_grange(s, T, 2.4, 2.9 if cochere else 2.7, 5, cochere=cochere)

    return pose


def linteau_bois(s, T):
    s.box(1.5, 0.2, 0.24, at(0, 0.1, 0.06), "bois", T.bois[0], grain="x", tremble=0.016, sans="z-y-")


def linteau_pierre(s, T):
    s.box(1.45, 0.24, 0.22, at(0, 0.12, 0.05), "pierre", T.pierre[0], tremble=0.014, sans="z-y-")


def appui(s, T):
    s.box(1.45, 0.13, 0.3, at(0, 0.065, 0.1), "pierre", T.pierre[2], tremble=0.015, sans="z-y-")


def toit_deux_pans(s, T):
    R.toit(s, T, "deux-pans", 4.0, 6.0, 0.0, 40, 0.45, 3)


def toit_croupe(s, T):
    R.toit(s, T, "croupe", 8.0, 6.0, 0.0, 35, 0.45, 4)


def toit_appentis(s, T):
    R.toit(s, T, "appentis", 4.0, 3.0, 0.0, 20, 0.4, 5)


def faitage(s, T):
    R.faitieres(s, T, (-1, 0, 0), (1, 0, 0), 2, bout_bas=True)


def gouttiere(s, T):
    R.gouttiere(s, T, 2.0)


PIECES = [
    # (nom, description, fonction, finitions ou None, variantes de teinte ou None)
    ("mur-plein", "pan de mur plein de 1 m, un niveau (2,70 m), soubassement de moellons", mur_plein, True, False),
    ("mur-fenetre", "pan de 2 m avec fenêtre à croisillons creusée et volets ouverts", mur_fenetre, True, True),
    ("mur-porte", "pan de 2 m avec porte pleine de 2,06 m sur sa marche", mur_porte, True, True),
    ("mur-devanture", "pan de 3 m avec devanture de commerce et bandeau d'enseigne vierge", mur_devanture, True, False),
    ("mur-grange", "pan de 4 m avec porte de grange à deux vantaux, de plain-pied", mur_grange, True, False),
    ("mur-etage", "pan d'étage de 2 m (2,30 m de haut) avec fenêtre et volets", mur_etage, True, True),
    ("mur-etage-plein", "pan d'étage plein de 1 m", mur_etage_plein, True, False),
    ("pignon", "pignon de 6 m de portée pour un toit à 40 degrés, petite fenêtre de grenier", pignon, True, False),
    ("angle", "chaîne d'angle du rez-de-chaussée: pierres de taille alternées (origine: l'arête du coin, au sol)", angle, False, False),
    ("angle-etage", "chaîne d'angle d'un étage", angle_etage, False, False),
    ("toit-deux-pans", "tronçon de 4 m de toit à deux pans (portée 6 m, 40 degrés): tuiles en rangs, faîtage, rives, chevrons, gouttières (origine: milieu, à l'arase des murs)", toit_deux_pans, False, False),
    ("toit-croupe", "toit à croupes de 8 x 6 m à 35 degrés, arêtiers", toit_croupe, False, False),
    ("toit-appentis", "appentis de 4 x 3 m à 20 degrés, bas vers +z", toit_appentis, False, False),
    ("faitage", "2 m de tuiles faîtières demi-rondes", faitage, False, False),
    ("lucarne", "lucarne à l'aplomb du mur, pour un toit à 40 degrés (origine: au mur, à l'arase)", lambda s, T: R.lucarne(s, T, 0.1, 40, 2), False, False),
    ("cheminee-souche", "souche de cheminée: couronne de pierres, dalle, mitre (origine: 1,90 m sous le sommet)", lambda s, T: P.cheminee_souche(s, T, 1.9, 1), False, False),
    ("cheminee-four", "cheminée de four ou de forge adossée au mur, 6 m", lambda s, T: P.cheminee_de_four(s, T, 6.0, 1), False, False),
    ("fenetre", "fenêtre à croisillons, sans volets", _fenetre("aucun"), False, False),
    ("fenetre-volets-ouverts", "fenêtre, volets de planches rabattus", _fenetre("ouverts"), False, True),
    ("fenetre-volets-fermes", "fenêtre, volets clos", _fenetre("fermes"), False, True),
    ("porte-pleine", "porte en planches à pentures, piédroits, linteau, marche", _porte("pleine"), False, True),
    ("porte-vitree", "porte à carreaux en partie haute", _porte("vitree"), False, True),
    ("porte-cochere", "porte cochère sous un arc de pierre", _grange(True), False, False),
    ("porte-de-grange", "porte de grange à deux vantaux et écharpes, linteau de chêne", _grange(False), False, False),
    ("linteau-bois", "linteau de chêne", linteau_bois, False, False),
    ("linteau-pierre", "linteau de pierre", linteau_pierre, False, False),
    ("appui", "appui de fenêtre débordant", appui, False, False),
    ("marche", "marche de seuil de 17 cm", lambda s, T: P.marche(s, T, 1.6, 0.6, 1, 1), False, False),
    ("marches", "deux marches de seuil (2 x 17 cm, giron de 32 cm)", lambda s, T: P.marche(s, T, 1.6, 0.6, 1, 2), False, False),
    ("gouttiere", "2 m de gouttière de zinc", gouttiere, False, False),
    ("descente", "descente d'eau de 2,70 m: coude, colliers, dauphin et pierre d'éclaboussure", lambda s, T: P.descente(s, T, 2.7, 1), False, False),
    ("enseigne-bandeau", "enseigne vierge en planche encadrée, à plat sur le mur", lambda s, T: P.enseigne_bandeau(s, T, 2.2, 1), False, False),
    ("enseigne-potence", "enseigne vierge pendue à sa potence de fer", lambda s, T: P.enseigne_potence(s, T, 1), False, False),
    ("auvent", "auvent de 3 x 1,6 m sur poteaux et dés de pierre", lambda s, T: auvent(s, T, 3.0, 1.6, 2.8, 2), False, False),
    ("auvent-consoles", "petit auvent de 1,9 x 0,9 m sur consoles", lambda s, T: auvent(s, T, 1.9, 0.9, 2.8, 2), False, False),
    ("pendule", "pendule de façade", lambda s, T: P.pendule(s, T, 0.9, 1), False, False),
    ("drapeau", "hampe et drapeau", lambda s, T: P.drapeau(s, T, 1), False, False),
    ("roue-de-moulin", "roue à aubes de 5 m", lambda s, T: P.roue_de_moulin(s, T, 5.0, 0.9, 1), False, False),
    ("bassin", "bassin de lavoir de 3,2 x 1,8 m", lambda s, T: P.bassin(s, T, 3.2, 1.8, 1), False, False),
    ("contrefort", "contrefort d'église de 5 m", lambda s, T: P.contrefort(s, T, 5.0, 1), False, False),
    ("escalier", "escalier extérieur de pierre, 2,50 m de montée, marches de 17 x 28 cm", lambda s, T: P.escalier(s, T, 2.5, 1.0, 1), False, False),
    ("croix", "croix de fer de clocher", lambda s, T: P.croix(s, T, 1.6), False, False),
    ("abat-sons", "baie de clocher à abat-sons", lambda s, T: P.abat_sons(s, T, 1.1, 2.2, 1), False, False),
    ("vitrail", "baie haute d'église sous son arc", lambda s, T: P.vitrail(s, T, 0.8, 2.6, 1), False, False),
]


def construire(nuancier: dict, objet):
    """Rend les objets Blender (rangés en lignes de 30 m) et les fiches des pièces."""
    objets, fiches = [], {}
    x, z, rang = 0.0, 0.0, 0.0
    for nom, description, pose, par_finition, par_teinte in PIECES:
        for finition in (FINITIONS if par_finition else ["crepi"]):
            for variante, couleurs in (VARIANTES.items() if par_teinte else [("", {})]):
                ident = nom + (f"-{finition}" if par_finition else "") + (f"--{variante}" if variante else "")
                T = P.teintes(nuancier, finition, {**FINITIONS[finition], **couleurs})
                s = Atelier(len(fiches))
                pose(s, T)
                bas, haut = s.boite()
                ob = objet(s, ident)
                large = float(haut[0] - bas[0])
                if x + large > 30:
                    x, z, rang = 0.0, z + rang + 1.5, 0.0
                # Blender (x, y, z) = jeu (x, -z, y): on range les pièces sans toucher à leur maillage.
                ob.location = (x - float(bas[0]), -(z - float(bas[2])), 0)
                x += large + 1.0
                rang = max(rang, float(haut[2] - bas[2]))
                objets.append(ob)
                fiches[ident] = {
                    "description": description,
                    "finition": finition if par_finition else None,
                    "teinte": variante or None,
                    "boite": [[round(float(v), 3) for v in bas], [round(float(v), 3) for v in haut]],
                    "triangles": s.triangles,
                    "materiaux": sorted(s.triangles_par_materiau()),
                }
    return objets, fiches
