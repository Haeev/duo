#!/usr/bin/env python3
"""Construit la carte du bourg de La Halte d'Aubrune (démo de La Petite Ligne).

Sortie: games/la-petite-ligne/donnees/cartes/halte.json

La composition se retouche ici, puis on relance ce script, le validateur et
l'aperçu:

    python3 games/la-petite-ligne/outils/construire_carte_halte.py
    python3 games/la-petite-ligne/outils/valider_carte.py
    python3 games/la-petite-ligne/outils/apercu_carte.py

Document de conception: docs/jeux/jeu-1/carte-halte.md.
Tour 10 (rue Haute, lot L1): la carte passe de 64 à 100 m de large; la région est (x 62 à 99) est
composée par `construire_terrain_est` et `construire_objets_est`, les intérieurs (ADR 0016) par
`INTERIEURS`. Conception: docs/jeux/jeu-1/tour-10-conception.md, sections 1.3 à 1.6 et 4.2.
Bibliothèque standard uniquement; le résultat est identique à chaque exécution.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
SORTIE = ICI.parent / "donnees" / "cartes" / "halte.json"

sys.path.insert(0, str(ICI))
from valider_carte import calculer_infranchissable, emprise_monde, ouvertures, poteaux_de_cloture  # noqa: E402

LARGEUR, HAUTEUR = 100, 48
# Le ru de la Côte (tour 10): deux colonnes d'eau vive qui bornent le bourg ancien et la rue Haute.
RU_X = (63, 64)
BORD = 2  # anneau de décor lointain, jamais franchissable

# ---------------------------------------------------------------------------
# Légende du terrain. `sol` reprend les natures de sol du code (`GroundKind`
# de src/etat/carte.ts); `pas` est le bruit de pas attendu.

LEGENDE = {
    ".": {"nom": "herbe", "sol": "grass", "franchissable": True, "pas": "herbe"},
    ",": {"nom": "herbe haute", "sol": "grass", "franchissable": True, "pas": "herbe"},
    ":": {"nom": "chemin de terre", "sol": "path", "franchissable": True, "pas": "terre"},
    "+": {"nom": "pavés", "sol": "stone", "franchissable": True, "pas": "pierre"},
    "p": {"nom": "terre du potager (herbe à bêcher au départ)", "sol": "dirt", "franchissable": True, "pas": "terre"},
    "~": {"nom": "eau de la rivière (profonde)", "sol": "water", "franchissable": False, "pas": None},
    "g": {"nom": "gué (eau basse sur galets: le rendu peut y poser une lame d'eau)", "sol": "gravel", "franchissable": True, "pas": "eau"},
    "b": {"nom": "berge (sable et galets)", "sol": "gravel", "franchissable": True, "pas": "pierre"},
    "=": {"nom": "ballast et rails", "sol": "rail", "franchissable": True, "pas": "pierre"},
    "#": {"nom": "traversée en planches (passage à niveau, traversée de service)", "sol": "wood", "franchissable": True, "pas": "bois"},
    "q": {"nom": "quai (dalles de pierre, bordure en bois)", "sol": "stone", "franchissable": True, "pas": "pierre"},
    "s": {"nom": "sol de bâtiment", "sol": "floor", "franchissable": True, "pas": "bois"},
    "X": {"nom": "bord infranchissable (décor lointain: forêt, haies, champs)", "sol": "grass", "franchissable": False, "pas": None},
    # Tour 10: le ru de la Côte et ses passages (le ponceau garde les codes de la voie).
    "r": {"nom": "ru de la Côte (eau vive peu profonde, berges raides)", "sol": "water", "franchissable": False,
          "pas": None},
    "P": {"nom": "tablier du pont de la rue (pierre, parapets bas)", "sol": "stone", "franchissable": True,
          "pas": "pierre"},
    "Y": {"nom": "planches de la passerelle de la promenade", "sol": "wood", "franchissable": True, "pas": "bois"},
    "j": {"nom": "gué de pierres plates du ru (on saute de pierre en pierre)", "sol": "gravel", "franchissable": True,
          "pas": "pierre"},
}

# ---------------------------------------------------------------------------
# Catalogue des types d'objets. Noms alignés sur les modèles (artiste-3d).
# emprise: [largeur le long de la façade, profondeur] pour la rotation 0.
# hauteur: au faîte, en mètres (sert au contrôle de la caméra isométrique).
# occultation: boîte qui cache la vue, si elle diffère de l'emprise
#   (troncs et houppiers, poteaux): [côté en m, z bas, z haut].
# portes: décalages des ouvertures le long de la façade (rotation 0: façade
#   sud, décalage compté depuis l'extrémité ouest).
# interieur: la pièce est jouable (murs d'une case, intérieur franchissable).

TYPES = {
    # Bâtiments
    "station": {"categorie": "batiment", "nom": "halte (bâtiment voyageurs)", "emprise": [10, 6], "hauteur": 7.0,
                "portes": {"porte": 4}, "interieur": False},
    "platform": {"categorie": "sol", "nom": "quai", "emprise": [30, 4], "hauteur": 0.4, "franchissable": True},
    "gatekeeper_house": {"categorie": "batiment", "nom": "maisonnette du garde-barrière", "emprise": [7, 6],
                         "hauteur": 5.5, "portes": {"porte": 3}, "interieur": True},
    # Tour 10: la boutique se visite (pièce de 6 x 6 au sud; la salle à manger de la pension, au nord, reste
    # fermée: on la regarde par la porte entrouverte).
    "ferrand_shop": {"categorie": "batiment", "nom": "épicerie-pension Ferrand", "emprise": [10, 8], "hauteur": 8.5,
                     "portes": {"porte": 2, "comptoir": 6}, "interieur": True},
    "firmin_house": {"categorie": "batiment", "nom": "maison de Firmin", "emprise": [7, 6], "hauteur": 6.0,
                     "portes": {"porte": 3}, "interieur": False},
    "sawmill": {"categorie": "batiment", "nom": "scierie de Basile", "emprise": [10, 8], "hauteur": 7.5,
                "portes": {"porte": 5}, "interieur": False},
    "handcar_shed": {"categorie": "batiment", "nom": "remise de la draisine", "emprise": [6, 5], "hauteur": 4.5,
                     "portes": {"porte": 2}, "interieur": False},
    "henhouse": {"categorie": "batiment", "nom": "poulailler (en ruine, puis réparé)", "emprise": [3, 3],
                 "hauteur": 2.4, "portes": {"porte": 1}, "interieur": False},
    "well": {"categorie": "equipement", "nom": "puits de la place (remplace la fontaine)", "emprise": [2, 2],
             "hauteur": 2.6, "occultation": [1.6, 0.0, 1.2]},
    # Quai et place
    "bell_post": {"categorie": "equipement", "nom": "cloche du quai sur son poteau", "emprise": [1, 1],
                  "hauteur": 2.5, "occultation": [0.3, 0.0, 2.5]},
    "bench": {"categorie": "mobilier", "nom": "banc", "emprise": [2, 1], "hauteur": 0.9},
    "coop_crate": {"categorie": "equipement", "nom": "caisse de la coopérative", "emprise": [1, 1], "hauteur": 1.1},
    "notice_board": {"categorie": "equipement", "nom": "tableau de la halte (commande, catalogue, courrier)",
                     "emprise": [1, 1], "hauteur": 2.2, "occultation": [0.9, 0.6, 2.2]},
    "station_sign": {"categorie": "decor", "nom": "panneau « Aubrune » sur deux poteaux (facultatif)",
                     "emprise": [2, 1], "hauteur": 2.6, "occultation": [1.8, 1.6, 2.6]},
    "lamp_post": {"categorie": "decor", "nom": "lampadaire", "emprise": [1, 1], "hauteur": 3.6,
                  "occultation": [0.25, 0.0, 3.6]},
    "level_crossing_gate": {"categorie": "equipement", "nom": "barrière du passage à niveau (poteau et lisse)",
                            "emprise": [1, 1], "hauteur": 1.5, "occultation": [0.3, 0.0, 1.5]},
    "arbor": {"categorie": "mobilier", "nom": "tonnelle d'Odette, sa table et ses bancs", "emprise": [3, 2],
              "hauteur": 2.6, "occultation": [3.0, 0.0, 1.0]},
    "barrel": {"categorie": "decor", "nom": "tonneau", "emprise": [1, 1], "hauteur": 1.0},
    "water_barrel": {"categorie": "equipement", "nom": "tonneau d'eau de la maisonnette", "emprise": [1, 1],
                     "hauteur": 1.1},
    "mailbox": {"categorie": "decor", "nom": "boîte aux lettres", "emprise": [1, 1], "hauteur": 1.3,
                "occultation": [0.4, 0.0, 1.3]},
    "workbench": {"categorie": "equipement", "nom": "établi de Basile sous son auvent", "emprise": [2, 2],
                  "hauteur": 3.0, "occultation": [2.0, 0.0, 1.0]},
    "log_pile": {"categorie": "decor", "nom": "tas de bois", "emprise": [2, 1], "hauteur": 1.2},
    "fence": {"categorie": "decor", "nom": "clôture en bois (1 m)", "emprise": [1, 1], "hauteur": 1.0},
    "pontoon": {"categorie": "sol", "nom": "ponton de pêche", "emprise": [2, 3], "hauteur": 0.5,
                "franchissable": True, "sols_permis": ["b", "~"]},
    # Nature
    "tree_oak": {"categorie": "arbre", "nom": "chêne", "emprise": [1, 1], "hauteur": 8.0,
                 "occultation_arbre": {"tronc": [0.5, 0.0, 2.6], "houppier": [3.4, 2.6, 8.0]}},
    "tree_fir": {"categorie": "arbre", "nom": "sapin", "emprise": [1, 1], "hauteur": 9.0,
                 "occultation_arbre": {"tronc": [0.4, 0.0, 1.2], "houppier": [2.4, 1.2, 9.0]}},
    "bush": {"categorie": "decor", "nom": "massif, arbuste bas", "emprise": [1, 1], "hauteur": 1.2},
    # Tour 8 (section 5.2): le roncier des mûres (1,2 x 0,8 m) et le noisetier des noisettes.
    "bramble": {"categorie": "decor", "nom": "roncier de la lisière (les mûres s'y posent)", "emprise": [1, 1],
                "hauteur": 0.7},
    "bush_hazel": {"categorie": "decor", "nom": "noisetier (les noisettes tombent à son pied)", "emprise": [1, 1],
                   "hauteur": 2.0},
    "rock": {"categorie": "decor", "nom": "rocher", "emprise": [1, 1], "hauteur": 0.8},
    # Tour 10, rue Haute. `toit`: hauteur à l'égout (m) et sens du faîtage par rapport à la façade; le contrôle
    # de la caméra suit alors la pente du toit au lieu d'un volume plein jusqu'au faîte (c'est ce qui permet de
    # vérifier que la mercerie et la maison de Lucie ne cachent pas la rue de la halte en orientation 0).
    "bakehouse": {"categorie": "batiment", "nom": "fournil d'Achille (four et cheminée à l'arrière, côté voie)",
                  "emprise": [7, 6], "hauteur": 5.0, "toit": {"egout": 3.0, "faitage": "parallele"},
                  "portes": {"porte": 3, "guichet": 5}, "interieur": False},
    "salon_shop": {"categorie": "batiment", "nom": "mercerie-coiffure de Solange (un niveau, pignon sur la rue Haute)",
                   "emprise": [7, 7], "hauteur": 4.8, "toit": {"egout": 3.0, "faitage": "perpendiculaire"},
                   "portes": {"porte": 3, "vitrine": 4}, "interieur": True},
    "lucie_house": {"categorie": "batiment", "nom": "maison de Lucie (un niveau, pignon sur la rue Haute)",
                    "emprise": [6, 6], "hauteur": 4.6, "toit": {"egout": 2.8, "faitage": "perpendiculaire"},
                    "portes": {"porte": 2}, "interieur": False},
    "school_house": {"categorie": "batiment", "nom": "école-mairie (classe au rez-de-chaussée, mairie à l'étage)",
                     "emprise": [7, 6], "hauteur": 8.0, "toit": {"egout": 6.0, "faitage": "parallele"},
                     "portes": {"porte": 3}, "interieur": False},
    "school_yard": {"categorie": "enclos", "nom": "cour de l'école, murée (mur de 2,2 m, tilleul, portail de 2 m)",
                    "emprise": [6, 6], "hauteur": 2.2, "portes": {"portail": 3}},
    "tree_apple": {"categorie": "arbre", "nom": "pommier du verger de Lucie", "emprise": [1, 1], "hauteur": 5.0,
                   "occultation_arbre": {"tronc": [0.35, 0.0, 1.6], "houppier": [3.0, 1.6, 5.0]}},
}

OBJETS: list[dict] = []
_COMPTEURS: dict[str, int] = {}

# L'épicerie-pension: case nord-ouest de l'emprise et rotation (façade à l'est). Les places et les cases
# de mobilier de l'artiste (`interior_spots`, `interior_blocked` du nœud `ferrand_shop`, repère glTF) se
# tournent avec elle. Tour 10, reprise de l'artiste: la façade avance de 0,75 m, son nu extérieur est en
# x 30,35 (dans la colonne 30, celle du mur); perron et étal vont jusqu'à x 30,97 et seul le store, au-dessus
# de 2,34 m, déborde sur les pavés de la place (x 31,86). L'emprise reste donc de 8 x 10 cases.
EPICERIE = {"x0": 23, "y0": 23, "rotation": 1}


def glb_vers_carte(gx: float, gz: float, o: dict = EPICERIE, type_: str = "ferrand_shop") -> tuple[float, float]:
    """Point (x, z) du repère glTF d'un bâtiment vers la carte, comme le rendu (rotation.y = rotation x PI/2)."""
    larg, prof = TYPES[type_]["emprise"]
    w, h = (larg, prof) if o["rotation"] % 2 == 0 else (prof, larg)
    cx, cy = o["x0"] + w / 2, o["y0"] + h / 2
    a = o["rotation"] * math.pi / 2
    x = cx + gx * math.cos(a) + gz * math.sin(a)
    y = cy - gx * math.sin(a) + gz * math.cos(a)
    return round(x, 3), round(y, 3)


def cases_glb(*coins: tuple[int, int]) -> list[list[int]]:
    """Cases de la carte des cases glTF de l'artiste (coin [x, z] le plus petit de chaque case)."""
    cases = []
    for gx, gz in coins:
        x, y = glb_vers_carte(gx + 0.5, gz + 0.5)
        cases.append([math.floor(x), math.floor(y)])
    return cases


def objet(type_: str, x0: int, y0: int, rotation: int = 0, ident: str | None = None, **extra: object) -> None:
    """Pose un objet par la case nord-ouest de son emprise; le fichier garde le centre."""
    larg, prof = TYPES[type_]["emprise"]
    w, h = (larg, prof) if rotation % 2 == 0 else (prof, larg)
    if ident is None:
        _COMPTEURS[type_] = _COMPTEURS.get(type_, 0) + 1
        ident = f"{type_}_{_COMPTEURS[type_]:02d}"
    entree = {"id": ident, "type": type_, "x": x0 + w / 2, "y": y0 + h / 2, "rotation": rotation}
    entree.update(extra)
    OBJETS.append(entree)


# ---------------------------------------------------------------------------
# Terrain

T = [["." for _ in range(LARGEUR)] for _ in range(HAUTEUR)]


def peindre(code: str, x0: int, y0: int, w: int, h: int) -> None:
    for y in range(max(0, y0), min(HAUTEUR, y0 + h)):
        for x in range(max(0, x0), min(LARGEUR, x0 + w)):
            T[y][x] = code


def peindre_si(code: str, x0: int, y0: int, w: int, h: int, seulement: str) -> None:
    for y in range(max(0, y0), min(HAUTEUR, y0 + h)):
        for x in range(max(0, x0), min(LARGEUR, x0 + w)):
            if T[y][x] in seulement:
                T[y][x] = code


def bruit(x: int, y: int, graine: int) -> int:
    """Petit hachage déterministe (0 à 99), pour varier l'herbe et les berges."""
    v = (x * 73856093) ^ (y * 19349663) ^ (graine * 83492791)
    v = (v ^ (v >> 13)) * 1274126177
    return (v ^ (v >> 16)) % 100


def construire_terrain() -> None:
    # Herbe haute: lisière du bois, pré de l'est, rive sud.
    for y in range(HAUTEUR):
        for x in range(LARGEUR):
            if y <= 9 and bruit(x, y, 1) < 45:
                T[y][x] = ","
            if 50 <= x <= 62 and 24 <= y <= 33 and bruit(x, y, 2) < 60:
                T[y][x] = ","
            if y in (36,) and bruit(x, y, 3) < 35:
                T[y][x] = ","
            if 44 <= y and bruit(x, y, 4) < 65:
                T[y][x] = ","

    # La voie, du bord ouest au bord est (la ville à l'ouest, les Vergers à l'est).
    peindre("=", 0, 12, LARGEUR, 3)
    peindre("#", 17, 12, 3, 3)   # passage à niveau du garde-barrière
    peindre("#", 50, 12, 1, 3)   # traversée de service de Firmin, au bout du quai
    peindre("=", 56, 9, 1, 3)    # voie de garage de la remise

    # Sentier de la lisière, le long de la voie côté nord.
    peindre(":", 2, 10, 60, 2)
    peindre_si(".", 56, 10, 1, 2, ":")
    peindre("=", 56, 10, 1, 2)

    # Le quai et le terre-plein fleuri qui le borde au sud.
    peindre("q", 21, 15, 30, 4)
    peindre(".", 21, 19, 30, 2)
    peindre("+", 30, 19, 2, 2)   # accès pavés du quai à la rue
    peindre("+", 43, 19, 2, 2)

    # Rue de la Gare, cour de la halte, place du bourg.
    peindre("+", 17, 21, 45, 2)
    peindre("+", 51, 21, 11, 3)
    peindre("+", 31, 23, 18, 11)

    # Route du passage à niveau au gué, chemin devant la maisonnette, sentier vers la voie.
    peindre(":", 17, 15, 3, 23)
    peindre(":", 3, 27, 14, 1)
    peindre(":", 13, 16, 1, 11)
    # Le sentier du jardin rejoint le passage à niveau au lieu de traverser les rails à 4 m de lui.
    peindre(":", 13, 15, 4, 1)
    # Firmin sort de chez lui sur le sentier de la voie.
    peindre(":", 44, 8, 1, 2)

    # Promenade de l'Aubrune.
    peindre(":", 17, 34, 45, 2)

    # La rivière: berge nord, eau profonde, berge sud, rive sud.
    peindre("b", 0, 37, LARGEUR, 1)
    peindre("~", 0, 38, LARGEUR, 5)
    peindre("b", 0, 43, LARGEUR, 1)
    for x in range(LARGEUR):
        # Berges en pente douce: des grèves qui avancent par longues anses, pas case par case.
        if math.sin(x / 4.3 + 0.8) > 0.55 and not 14 <= x <= 22:
            T[38][x] = "b"
        if math.sin(x / 5.1 + 2.6) > 0.6 and not 14 <= x <= 22:
            T[42][x] = "b"
    # Retours du 2026-11-01 (R22): la grève monte jusqu'à la promenade. La rangée d'herbe entre
    # les deux (y 36) faisait une bande étroite qui coupait la berge en long, sans raison: un
    # chemin de halage longe directement la grève. Le jardin du garde-barrière (à l'ouest de la
    # route) garde son herbe et sa clôture.
    # Le bout de la route du gué (x 17 à 19, y 36) avance d'une rangée dans la grève et le rendu en dessine
    # le coin sud-est carré, contre (20, 36). Il reste ainsi (2026-11-02): les pierres du gué s'alignent sur
    # ce bout de chemin, une rangée au-dessus de la berge (`src/rendu/gue.test.ts`); finir la route sur la
    # promenade casse cet alignement, l'élargir déplace seulement le coin. C'est au rendu d'arrondir l'angle
    # d'un chemin contre le sable, comme il le fait contre l'herbe.
    peindre("b", 20, 36, 42, 1)
    peindre("g", 16, 37, 5, 7)       # le gué, sur toute la largeur
    peindre(":", 17, 44, 3, 4)       # la vieille route continue au sud (fermée par le bord)

    # Le potager de la démo: 12 cases devant la porte.
    peindre("p", 7, 28, 4, 3)

    construire_terrain_est()

    # Sols des bâtiments (peints ensuite d'après les objets).


def construire_terrain_est() -> None:
    """Tour 10: la rue Haute, à l'est du ru de la Côte (x 62 à 99; ancien bord est en x 62 et 63).

    Le récit, du nord au sud: le coteau de la Côte descend jusqu'à la voie; le ru en sort et coule vers le
    sud jusqu'à l'Aubrune, qui coule vers l'est. La voie passe le ru sur un ponceau (elle existait avant la
    rue Haute); la rue de la halte le passe sur un pont de pierre et devient la route des hameaux; la
    promenade de la berge le passe sur une passerelle. Entre les deux, un gué de pierres plates.
    """
    rx0 = RU_X[0]
    # Herbe haute: pied du coteau au nord de la voie, prés en pente douce vers la rivière au sud-est.
    for y in range(HAUTEUR):
        for x in range(65, LARGEUR):
            if 85 <= x and 24 <= y <= 35 and bruit(x, y, 11) < 55:
                T[y][x] = ","
            if 79 <= x <= 84 and 32 <= y <= 35 and bruit(x, y, 12) < 40:
                T[y][x] = ","

    # Le ru, du bois (hors carte au nord) à l'Aubrune: deux cases d'eau vive. Sous la voie (y 12 à 14), le
    # ballast reste tel quel: c'est le ponceau.
    for y in range(0, 38):
        if 12 <= y <= 14:
            continue
        peindre("r", rx0, y, 2, 1)

    # La rue de la halte continue vers l'est: cour de la halte jusqu'au ru (x 62, ancien bord), pont de
    # pierre de 3 m (y 21 à 23, la largeur de la cour), puis la petite place pavée du carrefour de la rue
    # Haute (y 21 à 24), et la route des hameaux (y 21 et 22): pavée jusqu'à l'école, dernière maison du
    # bourg, en terre au-delà, jusqu'au bord où partent les habitants et d'où arrivent les élèves.
    peindre("+", 62, 21, 1, 3)
    peindre("P", rx0, 21, 2, 3)
    peindre("+", 65, 21, 14, 4)
    peindre("+", 79, 21, 8, 2)
    peindre(":", 87, 21, LARGEUR - 87, 2)

    # La rue Haute: chaussée x 76 et 77, trottoirs x 75 et 78 (pas de porte de la mercerie et de la maison
    # de Lucie), du carrefour (y 21) jusqu'à la promenade (y 34). Elle monte de la rivière vers le pied du
    # coteau, d'où son nom; son bout nord est le portail de l'école.
    peindre("+", 75, 25, 4, 9)

    # La promenade de la berge continue (elle s'arrêtait au bord de l'ancienne carte): passerelle sur le ru,
    # puis jusqu'au bas de la rue Haute, où elle finit. Pas plus loin vers l'est: elle n'irait nulle part.
    peindre(":", 62, 34, 1, 2)
    peindre("Y", rx0, 34, 2, 2)
    peindre(":", 65, 34, 14, 2)

    # La grève touche la promenade (retour R22: pas de bande d'herbe entre le chemin et la berge).
    peindre("b", 62, 36, 1, 1)
    peindre("b", 65, 36, LARGEUR - 65, 1)

    # Le gué de pierres plates, à mi-chemin du pont et de la passerelle: le raccourci de Jeanne.
    peindre("j", rx0, 30, 2, 1)


def peindre_sols_batiments() -> None:
    for o in OBJETS:
        t = TYPES[o["type"]]
        if t["categorie"] != "batiment":
            continue
        x0, y0, w, h = emprise_monde(o, TYPES)
        peindre("s", x0, y0, w, h)


def peindre_bord() -> None:
    for y in range(HAUTEUR):
        for x in range(LARGEUR):
            dans_bord = x < BORD or y < BORD or x >= LARGEUR - BORD or y >= HAUTEUR - BORD
            if not dans_bord:
                continue
            # La voie, la rivière, ses berges et les routes continuent dans le décor (rendu seulement).
            if T[y][x] in "=~:bgr":
                continue
            T[y][x] = "X"


# ---------------------------------------------------------------------------
# Objets


def construire_objets() -> None:
    # La voie et la halte
    objet("platform", 21, 15, ident="platform")
    objet("station", 51, 15, ident="station")
    # Tableau et caisse sous la marquise, à l'est du banc: leurs ombres du soir partent vers l'est, loin de lui.
    # Au moins 3 m entre eux: à portée de l'un et de l'autre, on ouvrirait l'un pour l'autre.
    objet("notice_board", 41, 18, ident="notice_board")
    objet("coop_crate", 35, 18, ident="coop_crate")
    # Cloche et banc sur le quai, le banc face à la voie (audit de cohérence; ombre mesurée par le game designer).
    # Gauntlet, tour 5: le soir, le soleil vient de l'ouest, bas, et l'ombre de la marquise part vers l'est
    # (de 3,5 à 9 m entre 17 h et 17 h 45). La cloche quitte la marquise: au bord arrière du quai, juste à
    # l'ouest d'elle (à l'est de x 26,5, sinon l'épicerie la cache de la vue par défaut). Le banc reste
    # 3,5 m à l'est de la cloche, sur la même rangée, sous le bout ouest de la marquise que le soleil bas
    # éclaire encore: l'ombre de la cloche file droit sur lui de 17 h à 17 h 45. Il tient entre deux
    # poteaux de la marquise (x 31,5 et 34,5), à 0,4 m du pied de chacun.
    objet("bell_post", 29, 18, ident="quay_bell_post")
    objet("bench", 32, 18, rotation=2, ident="quay_bench")
    objet("station_sign", 45, 18, ident="station_sign")
    # Lampadaire au bout ouest du quai: assez loin pour que son ombre de 17 h 45 n'atteigne pas le banc.
    objet("lamp_post", 22, 18, ident="lamp_quay_west")
    objet("lamp_post", 47, 18, ident="lamp_quay_east")
    objet("bush", 22, 20)
    objet("bush", 23, 20)
    # Massifs décalés vers l'est: ils cachaient le coin à bêcher derrière le banc (vue par défaut).
    objet("bush", 37, 20)
    objet("bush", 38, 20)
    objet("bush", 46, 20)
    objet("bush", 47, 20)
    objet("bush", 49, 19)
    # Les lisses barrent la route (nord-sud), pas le bas-côté: poteau à droite de qui arrive, lisse en travers.
    objet("level_crossing_gate", 16, 11, rotation=0, ident="level_crossing_gate_north")
    objet("level_crossing_gate", 20, 15, rotation=2, ident="level_crossing_gate_south")
    objet("lamp_post", 20, 20, ident="lamp_level_crossing")

    # La maisonnette du garde-barrière et son terrain
    objet("gatekeeper_house", 5, 21, ident="gatekeeper_house")
    objet("water_barrel", 12, 26, ident="water_barrel")
    objet("henhouse", 14, 28, ident="henhouse")
    objet("mailbox", 16, 26, ident="mailbox")
    for x in range(2, 16):
        objet("fence", x, 36, rotation=0)
    for y in range(32, 36):
        objet("fence", 16, y, rotation=1)
    objet("bush", 2, 27)
    # Tour 10: hors de l'emprise du futur cellier (x 2 à 4, y 21 à 26), où il était en (4, 21).
    objet("bush", 2, 20)
    objet("bush", 12, 21)
    objet("rock", 3, 33)

    # La place du bourg
    objet("ferrand_shop", EPICERIE["x0"], EPICERIE["y0"], rotation=EPICERIE["rotation"], ident="ferrand_shop")
    objet("arbor", 32, 28, ident="grocery_arbor")
    objet("barrel", 31, 23)
    objet("barrel", 31, 32)
    objet("barrel", 22, 33)
    objet("well", 39, 27, ident="well")
    objet("bench", 35, 31, ident="square_bench")
    objet("lamp_post", 34, 24, ident="lamp_square_north")
    objet("lamp_post", 47, 24, ident="lamp_square_east")
    objet("lamp_post", 47, 32, ident="lamp_square_south")
    # Massifs fleuris aux angles; l'est de la place reste libre pour les fêtes (arbre de mai, foire).
    # Retours du 2026-11-01 (R22): aucun massif sur les pavés. L'angle sud-ouest est pavé devant
    # l'épicerie depuis le tour 8 (on y décharge les caisses): ses deux massifs sont retirés. Les
    # deux qui encadrent l'allée pavée du nord (rue de la Gare vers le puits) mordaient sur le
    # raccord arrondi de l'allée et de l'anneau: deux pas plus loin, sur la terre battue et hors
    # du trajet de Jeanne (x 37,5), ils bordent encore l'allée (contrôle automatique:
    # `src/rendu/coherence-carte.test.ts`).
    # Retouche du 2026-11-02: la grille dit pavés ('+') sur toute la place, terre battue comprise;
    # un massif n'y a pas sa place (le validateur en fait une erreur). Les sept quittent la place,
    # dans le même ordre (mêmes identifiants, donc mêmes variantes au rendu):
    # - bush_11 (noisetier), bush_12 et bush_16 (ronciers): ce sont des plantes de sous-bois, pas des
    #   massifs de place. Ils rejoignent le bord du bois clair au nord de la voie, entre la maison de
    #   Firmin et la remise (48, 8), (47, 9), (46, 9), hors de son chemin (x 44 et 45) et loin du
    #   chêne au nichoir. Posés d'abord au bord ouest du pré (x 50), ils changeaient la marche des
    #   robots du test de la chevrette (`moments-tour7.test.ts`), qui ne voyaient plus « elle regarde ».
    # - bush_13 et bush_17 (massifs ronds): de part et d'autre de l'accès pavé est du quai (x 43 et
    #   44), sur le terre-plein fleuri, comme les massifs qui l'entourent déjà (37 et 38, 46 et 47).
    # - bush_14 (massif rond) et bush_15 (noisetier): angle sud-est, sur l'herbe entre la place et
    #   le pré (x 49 et 50), hors de tout trajet (Jeanne tourne en y 30,5).
    for x, y in ((48, 8), (47, 9), (42, 20), (49, 33), (50, 32), (46, 9), (45, 20)):
        objet("bush", x, y)
    objet("bench", 42, 28, rotation=3, ident="square_bench_east")

    # La halte côté est: cour et pré
    objet("bush", 61, 24)
    objet("bush", 53, 26)
    objet("bush", 58, 29)
    objet("bush", 52, 32)
    # Le rocher du pré (56, 27) est le perchoir de la dame blanche (tour 9: `owl_land`, `owl_look` en
    # 56,6 ; 27,5); le rendu la pose sur son dessus. Le rendu tire la variante d'un `rock` de son
    # identifiant (`MODEL_VARIANTS`): `rock_02` est un `rock_small` (0,31 m, la chouette au ras de
    # l'herbe haute), `rock_03` un `rock_medium` (0,50 m, 1,3 x 0,9 m, il tient dans sa case). Les
    # deux rochers du pré échangent donc leur place (retouche du 2026-11-02): le perchoir est
    # `rock_03`. `rock_large` (1,08 m) aurait été aussi loin des 0,8 m de la chorégraphie, mais déborde
    # de 0,7 m de sa case (2,4 x 1,5 m) sur l'herbe où l'on marche.
    objet("rock", 60, 32)
    objet("rock", 56, 27)
    objet("barrel", 52, 23)

    # La berge
    objet("bench", 27, 36, ident="riverbank_bench")
    objet("pontoon", 44, 37, ident="pontoon")
    objet("rock", 22, 36)
    objet("rock", 15, 44)
    objet("rock", 38, 36)
    objet("rock", 58, 36)
    # Rive sud: rien de haut au premier plan de la caméra, seulement des buissons et des roseaux.
    for x, y in ((5, 44), (6, 45), (23, 44), (33, 44), (40, 45), (49, 44), (55, 44), (56, 45), (60, 44)):
        objet("bush", x, y)
    objet("rock", 10, 44)
    objet("rock", 44, 44)

    # Au nord de la voie: la scierie, la lisière, Firmin, la remise
    objet("sawmill", 2, 2, ident="sawmill")
    objet("workbench", 12, 7, ident="sawmill_workbench")
    objet("log_pile", 12, 3, ident="sawmill_log_pile")
    objet("barrel", 14, 4)
    objet("firmin_house", 41, 2, ident="firmin_house")
    objet("handcar_shed", 54, 4, ident="handcar_shed")
    objet("bush", 40, 9)
    objet("bush", 51, 8)
    objet("rock", 60, 9)

    # Sous-bois de la lisière: sureaux, ronces, quelques rochers (ni arbres ni obstacles en ligne).
    # Tour 8: le sureau de (35, 8) passe en (33, 8) pour laisser la place au roncier du coin 04.
    # Retouche du 2026-11-02: le rendu dessine en sureau le buisson `bush_41` (`MODEL_BY_PROP` de
    # src/rendu/modeles.ts), qui porte les grappes du coin 06. Depuis le retrait des deux massifs de
    # l'angle sud-ouest de la place (R22), la numérotation a glissé de deux: le buisson de (33, 8) était
    # `bush_39` et `bush_41` celui de (39, 7), à 6,3 m du coin (grappes posées par terre). Les deux
    # dernières places de la liste sont donc échangées: `bush_41` revient en (33, 8), au pied du coin 06
    # (contrôle: `controler_hotes_cueillette` du validateur).
    for x, y in ((17, 3), (19, 7), (23, 5), (27, 8), (29, 7), (33, 3), (39, 7), (37, 4), (33, 8)):
        objet("bush", x, y)
    # Tour 8 (section 5.2): un roncier contre la lisière, au nord de chaque coin au soleil
    # (forage_edge_03 à _05, y 9,5), face avant (+Z, rotation 0) tournée vers le coin, d'où l'on
    # cueille les mûres posées dessus. La rangée des coins (y 9) et le chemin de la lisière (y 10 et
    # 11), qui mène au passage à niveau, restent libres.
    for n, x in ((3, 30), (4, 35), (5, 38)):
        objet("bramble", x, 8, ident=f"bramble_edge_{n:02d}")
    # Un noisetier juste au nord de chacun des deux coins de sous-bois (forage_edge_01 et _02), à
    # l'ombre des chênes: les noisettes de l'automne tombent à son pied, là où on les ramasse.
    for n, x in ((1, 19), (2, 25)):
        objet("bush_hazel", x, 8, ident=f"hazel_edge_{n:02d}")
    for x, y in ((21, 3), (31, 3)):
        objet("rock", x, y)

    # Les 12 arbres à couper de la lisière (zone forest_edge), chênes et sapins.
    lisiere = [
        ("tree_oak", 16, 6), ("tree_fir", 18, 3), ("tree_oak", 20, 5), ("tree_fir", 22, 7),
        ("tree_oak", 24, 4), ("tree_fir", 26, 6), ("tree_oak", 28, 3), ("tree_fir", 30, 5),
        ("tree_oak", 32, 7), ("tree_fir", 34, 4), ("tree_oak", 36, 6), ("tree_fir", 38, 3),
    ]
    for n, (t, x, y) in enumerate(lisiere, start=1):
        objet(t, x, y, ident=f"tree_edge_{n:02d}", coupable=True)

    # Arbres du bois de la Côte hors lisière (décor, non coupables).
    # Le grand chêne `tree_oak_01` (nichoir de Basile, revue du DA au tour 6): en (50,5 ; 5,5) pour que la
    # face sud-est du tronc, celle que voit la caméra par défaut, soit dégagée de la remise (à 2 m de plus vers
    # l'est, tout ce qui est au pied du tronc tombait derrière son toit). Tourné, son houppier va jusqu'à
    # 2,34 m à l'ouest du tronc (x 48,2) et s'arrête à 0,5 m du débord de toit de Firmin (x 47,7), mesuré
    # sur les GLB. Tourné d'un quart: sa grosse branche basse part
    # au nord au lieu de l'est, où elle traverserait le nichoir.
    decor = [("tree_fir", 51, 2, 0), ("tree_oak", 50, 5, 1), ("tree_fir", 60, 3, 0), ("tree_oak", 61, 6, 0)]
    for t, x, y, quart in decor:
        objet(t, x, y, rotation=quart)

    # Décor lointain dans l'anneau du bord: forêt au nord, haies et bosquets ailleurs.
    # Tour 10: les identifiants numérotés (`bush_41`, `tree_oak_01`...) sont cités ailleurs; on garde donc
    # l'ordre de création d'avant pour l'ancienne carte, et la région est ajoute les siens après.
    for x in range(0, 64, 2):
        t = "tree_fir" if bruit(x, 0, 7) < 50 else "tree_oak"
        objet(t, x, 0 if bruit(x, 1, 8) < 50 else 1)
    for y in range(4, 44, 3):
        if 11 <= y <= 15 or 36 <= y <= 43:
            continue
        # A l'ouest, des arbres le long du bois, puis la haie du jardin du garde-barrière; à l'est, une
        # haie basse: des arbres y cacheraient les prés de la rue Haute. La route des hameaux la traverse.
        if y <= 10:
            objet("tree_oak" if bruit(0, y, 9) < 50 else "tree_fir", 0, y)
        else:
            objet("bush", 0, y)
        # La route des hameaux passe le bord en y 21 et 22: le buisson de y 22 se pousse en y 24.
        objet("bush", LARGEUR - 1, 24 if y == 22 else y)
    for x in range(1, 64, 3):
        if 15 <= x <= 21:
            continue
        objet("bush", x, 47)

    construire_objets_est()


def construire_objets_est() -> None:
    """Tour 10: bâtiments et décor de la rue Haute (table 1.3 de la conception, places calées ici).

    Règle de la caméra (orientation 0 au sud-est): ce qui est haut au nord, contre la voie (fournil, école);
    au sud de la rue de la halte, seulement des maisons basses à un niveau (mercerie, maison de Lucie),
    en retrait de deux rangées pour que leur toit ne cache pas la chaussée.
    """
    # Le fournil, entre la rue et la voie, au plus près du quai: les sacs de farine du train du samedi se
    # portent le long du ballast et passent le ponceau jusqu'à la trappe de l'arrière, sans traverser le
    # bourg; le four et sa fumée sont à l'arrière, côté voie, loin des maisons. Porte et guichet sur la rue.
    objet("bakehouse", 65, 15, ident="bakehouse")
    # La ruelle de 2 m (x 72 et 73) entre le fournil et la cour de l'école mène à l'arrière du fournil.
    # L'école-mairie au bout nord de la rue Haute: la cour murée (avec son tilleul) dans l'axe de la rue,
    # portail en x 77; le bâtiment à l'est de la cour, porte de la mairie sur la route des hameaux.
    objet("school_yard", 74, 15, ident="school_yard")
    objet("school_house", 80, 15, ident="school_house")
    # La mercerie-coiffure à l'angle des deux rues, première boutique qu'on voit en passant le pont; pignon,
    # vitrine et porte sur la rue Haute (à l'est), là où l'on passe.
    objet("salon_shop", 68, 25, rotation=1, ident="salon_shop")
    # La maison de Lucie en face: les deux portes se regardent (y 28), Jeanne traverse seule les 4 m de rue.
    objet("lucie_house", 79, 26, rotation=3, ident="lucie_house")
    # Le verger de trois pommiers derrière la maison (jardinet à l'est).
    for n, (x, y) in enumerate(((87, 27), (89, 29), (87, 31)), start=1):
        objet("tree_apple", x, y, ident=f"tree_apple_{n:02d}")

    # Le banc de la rue Haute, dos au mur de la mercerie au sud de sa porte, face à la maison de Lucie: on y
    # déjeune à midi, Achille aussi; on y attend que le salon rouvre.
    objet("bench", 75, 30, rotation=1, ident="upper_street_bench")
    # Le banc de la berge à l'est de la passerelle, tourné vers l'Aubrune.
    objet("bench", 66, 36, ident="east_riverbank_bench")
    # Un lampadaire au carrefour, à l'angle de la maison de Lucie: il éclaire le pont, la rue Haute et la
    # porte de la mercerie (le bourg s'allume jusqu'à sa dernière boutique).
    objet("lamp_post", 78, 24, ident="lamp_upper_street")

    # La haie du ru (aulnes, saules) le long de sa rive ouest, au bord du pré de l'est: la chevrette en sort
    # (`roe_deer_edge`, case 62, 27). Ouverte au droit du gué de pierres (y 29 à 31).
    for y in (24, 25, 26, 27, 28, 32, 33):
        objet("bush", 62, y)
    # Pied du coteau, au nord de la voie: bois clair du haut de la Côte (décor, non coupable).
    for t, x, y in (("tree_oak", 68, 5), ("tree_fir", 72, 3), ("tree_oak", 77, 7), ("tree_fir", 81, 4),
                    ("tree_oak", 86, 6), ("tree_fir", 90, 3), ("tree_oak", 94, 7)):
        objet(t, x, y)
    for x, y in ((66, 8), (75, 9), (83, 9), (91, 9), (96, 5)):
        objet("bush", x, y)
    # Prés du sud-est: quelques buissons et rochers, rien de haut (premier plan de la caméra).
    for x, y in ((92, 25), (95, 30), (90, 34), (82, 33)):
        objet("bush", x, y)
    for x, y in ((70, 33), (93, 27)):
        objet("rock", x, y)
    # L'anneau du décor lointain, prolongé vers l'est: forêt au nord (le ru en sort, x 63 et 64), haie au sud.
    for x in range(66, LARGEUR, 2):
        t = "tree_fir" if bruit(x, 0, 7) < 50 else "tree_oak"
        objet(t, x, 0 if bruit(x, 1, 8) < 50 else 1)
    for x in range(64, LARGEUR, 3):
        objet("bush", x, 47)
    # Retours du 2026-11-02 (S08): le coin sud-est du jardin du garde-barrière. Les lignes des deux
    # clôtures passent au milieu des cases (y 36,5 et x 16,5): elles ne se rejoignent jamais en un angle.
    # Chacune finit sur son poteau (16 ; 36,5) et (16,5 ; 36), et un buisson ferme l'angle entre les
    # deux, au lieu d'un faux passage qui ne menait nulle part. Posé ici, en dernier, pour ne décaler
    # aucun identifiant `bush_NN` cité ailleurs (`bush_106`, buisson rond).
    objet("bush", 16, 36)


def accroches_poteaux_finaux() -> list[dict]:
    """Un poteau (`fence_post`, accroche sans emprise) au bout de chaque file de clôture qui n'en a pas."""
    _, sans = poteaux_de_cloture(OBJETS)
    return [{"id": f"fence_end_post_{n:02d}", "modele": "fence_post", "sur": seg, "x": x, "y": y, "z": 0.0,
             "role": f"poteau qui porte le bout des lisses de `{seg}` (une barrière finit sur un poteau)"}
            for n, (seg, (x, y)) in enumerate(sorted(sans, key=lambda e: e[0]), start=1)]


# ---------------------------------------------------------------------------
# Points, zones, trajets


def p(ident: str, x: float, y: float, role: str, **extra: object) -> dict:
    d = {"id": ident, "x": x, "y": y, "role": role}
    d.update(extra)
    return d


POINTS = [
    # Arrivée et quai
    p("train_stop", 38.5, 17.5, "porte de la voiture: Firmin y attend le train, les joueurs y apparaissent",
      rotation=2, rayon=2.5, important=True),
    p("spawn_1", 37.5, 15.5, "apparition du premier joueur, en descendant du train", rotation=0, vu_par_defaut=True),
    p("spawn_2", 39.5, 15.5, "apparition du second joueur, en descendant du train", rotation=0, vu_par_defaut=True),
    # Firmin se tient à l'ouest de la cloche, au bord sud du quai, à 1,5 m du poteau: le soleil du
    # soir (à l'ouest) porte son ombre sous la cloche, loin du banc avant 17 h 45 (fin de l'énigme);
    # au nord, son ombre longeait celle de la cloche et s'y mêlait vue de l'orientation 0.
    p("quay_bell", 27.5, 18.5, "Firmin, à côté de la cloche du quai; rassemblement de la fin", rotation=0,
      rayon=2.5, important=True),
    p("quay_bench", 33.0, 18.5, "le banc du quai (Jeanne le matin), 3,5 m à l'est de la cloche",
      objet="quay_bench", portee=1.5, important=True),
    # Derrière le bout est du banc, à un mètre de lui: plus près ou plus à l'ouest, le banc (vues du nord) le cache.
    p("bell_shadow_spot", 34.7, 19.8, "derrière le bout est du banc, dans l'herbe: on y bêche quand l'ombre de la cloche "
      "touche le banc (17 h à 17 h 45, par soleil)", rayon=1.5, hauteur_vue=0.2, important=True),
    p("coop_crate", 35.5, 18.5, "la caisse de la coopérative", objet="coop_crate", portee=1.5, important=True),
    p("notice_board", 41.5, 18.5, "le tableau: commande, catalogue, courrier", objet="notice_board",
      portee=1.5, important=True),
    p("station_door", 55.5, 21.5, "devant la porte de la halte (fermée dans la démo)", objet="station"),
    p("level_crossing", 18.5, 13.5, "le passage à niveau du garde-barrière"),
    # La maisonnette
    p("house_door", 8.5, 27.5, "devant la porte de la maisonnette: toit et porte à construire",
      objet="gatekeeper_house", important=True),
    p("house_spawn", 8.5, 24.5, "dans la pièce, retour de minuit", objet="gatekeeper_house", interieur=True),
    p("house_attic", 8.5, 23.0, "le grenier (au-dessus de la pièce): la boîte en fer", objet="gatekeeper_house",
      interieur=True, etage="grenier"),
    p("house_beam_spot", 13.5, 24.5, "où poser la poutre, contre le pignon est", objet="gatekeeper_house",
      rayon=2.0, important=True),
    p("beam_pickup", 14.5, 18.5, "la poutre, posée là par Basile au jour 1 (et Basile à côté)", rayon=2.0,
      important=True),
    # R06 (soirée du 2026-11-01): Basile se tenait au milieu de la poutre et volait la touche aux
    # porteurs. Il attend au nord, côté voie d'où il l'a apportée, dans l'herbe entre les deux
    # chemins (x 13 et x 17 à 19): ni sur la poutre (couchée d'est en ouest), ni sur le passage.
    p("basile_by_beam", 15.5, 16.8, "Basile au jour 1, à côté de la poutre, tourné vers elle", rotation=0),
    p("water_barrel", 12.5, 26.5, "le tonneau d'eau: remplir l'arrosoir", objet="water_barrel", portee=1.5,
      important=True),
    p("mailbox", 16.5, 26.5, "la boîte aux lettres du garde-barrière (décor dans la démo)", objet="mailbox",
      portee=1.5),
    p("chicken_coop", 15.5, 31.5, "devant le poulailler: chantier, poules", objet="henhouse", rayon=2.0,
      important=True),
    p("hen_feeder", 13.5, 31.5, "la mangeoire des poules", important=True),
    # La place
    p("village_square", 38.5, 30.5, "la place, près du puits (Jeanne le soir)", rayon=3.0, important=True),
    p("well", 40.0, 28.0, "le puits: remplir l'arrosoir", objet="well", portee=1.5, important=True),
    p("grocery_counter", 30.5, 26.5, "Odette derrière son comptoir, ouvert sur la place", objet="ferrand_shop",
      portee=2.5, rotation=1, dans_batiment=True, important=True),
    p("grocery_door", 31.5, 30.5, "devant la porte d'Odette (côté pension)", objet="ferrand_shop", rotation=1,
      important=True),
    p("grocery_terrace", 33.5, 29.0, "la tonnelle du souper de bienvenue", objet="grocery_arbor", portee=2.5,
      important=True),
    # Au nord de la voie
    p("firmin_house", 44.5, 8.5, "devant la porte de Firmin", objet="firmin_house", rotation=0, important=True),
    p("sawmill_door", 7.5, 10.5, "devant la porte de la scierie", objet="sawmill"),
    p("sawmill_yard", 9.5, 10.5, "la cour de la scierie: Basile chez lui", rotation=0, important=True),
    p("sawmill_workbench", 13.0, 9.5, "devant l'établi de Basile: scier les rondins, fabriquer les meubles",
      objet="sawmill_workbench", rotation=2, important=True),
    # R06: Basile travaillait à la place des joueurs, devant l'établi. Il se tient au bout est de
    # son établi (cases 12-13, 7-8), tourné vers lui: la face sud reste aux joueurs.
    p("basile_at_workbench", 14.6, 8.0, "Basile au travail, au bout est de son établi", objet="sawmill_workbench",
      rotation=3),
    p("handcar_shed", 56.5, 9.5, "devant la remise de la draisine (fermée, s'ouvre à la fin)",
      objet="handcar_shed", important=True),
    # La rivière
    p("riverbank", 28.0, 37.5, "la berge, devant le banc: Jeanne l'après-midi, regarder la rivière",
      rayon=2.5, rotation=0, important=True),
    p("river_ford", 18.5, 40.5, "le gué (pêche en P1)", rayon=2.0, important=True),
    p("fishing_ford_north", 21.5, 37.5, "pêche: berge nord, à l'est du gué", peche=True, important=True),
    p("fishing_ford_south", 15.5, 43.5, "pêche: rive sud, à l'ouest du gué", peche=True, important=True),
    p("fishing_pontoon", 45.0, 39.5, "pêche: au bout du ponton", peche=True, important=True),
    # Moments rares (gauntlet, tour 6, docs/jeux/jeu-1/tour-06-conception.md, section 1.6). Chaque case
    # citée a été vérifiée sur le terrain; aucun de ces points n'est sur un trajet d'habitant, sauf le banc
    # de la berge (le carnet perdu, P1), où passe Jeanne: c'est voulu.
    p("heron_stand", 20.6, 39.6, "moment du héron: il pêche au bord aval du gué, dans la lame d'eau (case `g`), "
      "là où l'eau basse plonge vers l'eau profonde", moment="heron"),
    # Rive nord (revue du DA, tour 6): sur la grève d'en face, les arbres de la rive sud le cachaient à la
    # caméra (qui regarde vers le nord-ouest); ici, seule l'eau est entre elle et lui.
    p("heron_rest_far", 31.5, 38.5, "moment du héron: il se pose en aval, sur la langue de sable de la rive nord "
      "(case `b`), à 3,9 m du banc de la berge: un héron habitué aux gens", moment="heron"),
    p("geese_rest", 25.5, 40.0, "moment des oies: eau profonde et calme devant le banc de la berge, à 4,3 m de "
      "lui; on la regarde depuis la berge", moment="geese", portee=4.5),
    # L'échelle et le nichoir (revue du DA, tour 6). La caméra par défaut regarde vers le nord-ouest: deux
    # points sont sur la même colonne de l'écran quand x - y est égal. L'échelle est donc contre la face
    # sud-est du tronc, vue de face, penchée vers le nord-ouest; les deux places sont de part et d'autre de son
    # pied (x - y de 45,8 et 44,2), Basile derrière lui (45,0): trois silhouettes séparées. Le nichoir est sur
    # la face est, à la droite de Basile (main droite, `reach_up`), vu de trois quarts; son centre à 2,25 m
    # (Basile atteint 2,15 m bras levé: sans échelle il ne l'atteindrait pas). Le pied est à 1 m du tronc, la
    # tête (3 m d'échelle à 75°) appuie par son dernier barreau sur l'écorce (écart de 6 mm mesuré sur les GLB).
    p("nest_box", 50.822, 5.40, "le nichoir de Basile, face est du seul vieux chêne qu'on ne coupe pas "
      "(`tree_oak_01`): centre de la caisse à 2,25 m, trou à 2,30 m; un peu au nord de l'est pour laisser "
      "4,7 cm au montant de l'échelle", moment="tits", z=2.25),
    p("ladder_foot", 51.19, 6.19, "pied de l'échelle de Basile, au sud-est du chêne, tête contre le tronc "
      "en (50,64 ; 5,64) vers 2,8 m", moment="ladder", cap_degres=315),
    # Place est reculée de 0,13 m en x et en y le long de l'échelle (revue du DA, tour 6): même colonne de
    # l'écran en vue par défaut, mais ses pieds ne passent plus derrière le bord du toit de la remise.
    p("ladder_hold_east", 51.36, 5.54, "tenir l'échelle, côté est (au nord-est du pied), mains au montant "
      "(tourné vers le sud-ouest)", moment="ladder", cap_degres=225),
    p("ladder_hold_west", 50.79, 6.61, "tenir l'échelle, côté ouest (au sud-ouest du pied), mains au montant "
      "(tourné vers le nord-est)", moment="ladder", cap_degres=45),
    p("nest_oak_basile", 51.58, 6.58, "Basile derrière le pied de son échelle, pendant « Où est passé Basile ? »; "
      "il en part et y revient", cap_degres=315),
    p("fox_track_west", 0.2, 13.5, "moment du renard: bout ouest de la voie, d'où il vient en suivant le ballast",
      moment="fox", portee=4.0),
    # Retouche du 2026-11-02: en (7,5 ; 17,0), il tombait dans la chambre une fois bâtie (emprise x 5 à 11,
    # y 16 à 20). Il mulote maintenant dans la bande d'herbe à l'ouest de la réserve (x 2 à 4), entre la
    # voie et le futur cellier: à 2 m du site du cellier, 1,5 m du ballast, 2 m de l'aile de la chambre;
    # au sud-est, rien de plus haut que l'égout de la chambre (2 m) ne le cache en orientation 0.
    p("fox_mousing", 3.0, 16.5, "moment du renard: il mulote dans l'herbe non fauchée entre la voie et le "
      "pignon ouest de la maisonnette, à l'ouest de la chambre et au nord du cellier", moment="fox"),
    p("meadow_glow", 56.5, 29.5, "moment des vers luisants: herbes hautes du pré, à plus de 9 m des lampadaires",
      moment="glowworms"),
    # Tour 7 (docs/jeux/jeu-1/tour-07-conception.md, section 1.5). La chevrette quitte la lisière nord (cachée
    # en orientation 0 par la remise et le houppier du chêne) pour le pré de l'est, le seul pré non fauché, où
    # rien de haut n'est au sud-est (la caméra par défaut): la rivière et la promenade.
    p("roe_deer_edge", 62.2, 27.0, "moment de la chevrette: elle sort de la haie du bord est, au droit du pré "
      "(case `X`, hors d'atteinte)", moment="roe_deer"),
    p("roe_deer_graze", 58.0, 27.0, "moment de la chevrette: herbe rase du pré, entre le rocher (56,5 ; 27,5) et "
      "la haie", moment="roe_deer"),
    p("fawn_bed", 59.4, 25.9, "moment de la chevrette: le lit du faon dans l'herbe haute, à 1,8 m d'elle au "
      "nord-est (l'axe horizontal de l'écran en orientation 0: il reste dans le cadre)", moment="roe_deer"),
    p("kingfisher_post", 46.1, 39.9, "moment du martin-pêcheur: pieu d'amarrage au coin est du bout du "
      "ponton", moment="kingfisher"),
    # La brume: entre la langue de sable de la rive nord (x 27 à 34, y 38) et l'anse de la rive sud (x 23 à 31,
    # y 42), l'Aubrune n'a que trois mètres d'eau: le seul endroit où l'on se tient face à face, chacun sur sa
    # rive, à quatre mètres l'un de l'autre.
    p("mist_narrows", 29.5, 40.5, "moment de la brume: milieu des trois mètres d'eau entre les deux bancs de "
      "sable; on la regarde depuis les deux rives, à 2 m", moment="mist", portee=2.5),
    p("mist_bank_north", 29.5, 38.5, "moment de la brume: place de vue sur le banc de sable nord (indicative)",
      moment="mist"),
    p("mist_bank_south", 29.5, 42.5, "moment de la brume: place de vue sur l'anse de sable sud, par le gué "
      "(indicative)", moment="mist"),
    p("notebook_spot_pontoon", 43.8, 37.6, "carnet perdu de Jeanne (P1): sous les planches du ponton, côté "
      "amont"),
    p("notebook_spot_bench", 28.0, 36.5, "carnet perdu de Jeanne (P1): sous le banc de la berge",
      objet="riverbank_bench"),
    p("notebook_spot_rock", 38.5, 37.2, "carnet perdu de Jeanne (P1): derrière le gros rocher de la berge, côté "
      "rivière"),
    # Cueillette au bord du bois
    p("forage_edge_01", 19.5, 9.5, "cueillette (pissenlits) au bord du bois", cueillette=True, important=True),
    p("forage_edge_02", 25.5, 9.5, "cueillette au bord du bois", cueillette=True, important=True),
    p("forage_edge_03", 30.5, 9.5, "cueillette au bord du bois", cueillette=True, important=True),
    p("forage_edge_04", 35.5, 9.5, "cueillette au bord du bois", cueillette=True, important=True),
    p("forage_edge_05", 38.5, 9.5, "cueillette au bord du bois", cueillette=True, important=True),
    # Tour 9: le sureau (`bush_41`, en 33, 8) donne ses grappes au début de l'automne; le coin est à son pied,
    # côté chemin (au sud), comme les ronciers aux coins 03 à 05.
    p("forage_edge_06", 33.5, 9.5, "cueillette: les grappes du sureau, au pied du buisson, côté chemin",
      cueillette=True, important=True),
    # Tour 9: les lanternes du quai (moment `quay_lanterns`). Une place à l'est de chaque lanterne (les
    # lanternes de l'ouest du quai sont cachées par la pension en orientation 0), tournée vers elle.
    p("lantern_quay", 48.5, 18.5, "place de l'allumeur, à l'est de la lanterne du bout du quai", cap_degres=270),
    p("lantern_square", 35.5, 24.5, "place de l'allumeur, à l'est du lampadaire nord de la place, près de "
      "l'épicerie", cap_degres=270),
    # Tour 9: la marelle à la craie de Jeanne (cadeau des craies): pavés de l'est de la place, hors du passage
    # du quai (x 43 et 44), à 6 m du puits et à plus de 3 m des places des moments.
    # Tour 9: sous le toit du puits (chantier `well_roof`), Jeanne joue les jours de pluie, contre la margelle ouest.
    p("well_shelter", 38.5, 28.0, "contre la margelle ouest du puits, sous son toit une fois bâti (Jeanne les jours de pluie)"),
    p("hopscotch", 45.5, 29.5, "la marelle de Jeanne (1 x 3 m, cases 45 de y 28 à 30), où elle joue le soir"),
    # Tour 9: chantiers (points des envies et des répliques).
    p("ford_bench", 24.0, 36.5, "le banc du gué (chantier `ford_bench`), rive nord, tourné vers l'eau",
      portee=1.5),
    p("house_bench", 11.72, 23.0, "le banc contre le pignon est de la maisonnette (chantier `house_bench`), "
      "tourné vers l'est", portee=1.5),
    p("path_lamp", 14.5, 27.5, "sur le chemin, au pied du réverbère (chantier `path_lamp`, case 14, 26)"),
    # Tour 9: les étoiles de l'Aubrune (fiche 1.4.10 du tour 7): l'eau calme au pied du ponton et ses deux
    # places au bord du plancher (siège sans modèle `pontoon_edge`, ci-dessous).
    p("stars_water", 45.0, 40.6, "l'eau au pied du ponton, où se reflètent les étoiles"),
    p("pontoon_seat_west", 44.55, 39.8, "place ouest au bord du ponton, jambes au-dessus de l'eau",
      cap_degres=180),
    p("pontoon_seat_east", 45.45, 39.8, "place est au bord du ponton, jambes au-dessus de l'eau",
      cap_degres=180),
    # Tour 9: le salut du mécanicien (fiche 1.4.12 du tour 7): une place à chaque manivelle, hors de la route.
    p("gate_north_crank", 15.6, 11.5, "manivelle de la barrière nord, sur le chemin à l'ouest du poteau",
      cap_degres=90),
    p("gate_south_crank", 21.4, 15.5, "manivelle de la barrière sud, au bout du quai à l'est du poteau",
      cap_degres=270),
    # Sortie des habitants (tour 10: la promenade ne sort plus de la carte, elle passe le ru et finit au bas de
    # la rue Haute; la seule route qui sort est celle des hameaux, à l'est).
    p("village_exit", 97.5, 21.5, "bout de la route des hameaux, au bord est: les habitants qui rentrent chez eux "
      "hors carte (`offstage`) y disparaissent, les élèves des hameaux en arrivent", rotation=1),
]

# Tour 10 (conception, sections 1.4 et 1.6; `porte_lieu`: porte d'un lieu, vue dans 3 orientations sur 4).
POINTS += [
    # Le fournil d'Achille
    p("bakery_door", 68.5, 21.5, "devant la porte du fournil, sur la rue", objet="bakehouse", rotation=2,
      important=True, porte_lieu=True),
    p("bakery_window", 70.5, 20.5, "Achille au guichet du fournil (dans l'embrasure), qui donne sur la rue; on "
      "achète depuis la rue, sous l'auvent", objet="bakehouse", portee=2.0, rotation=0, dans_batiment=True,
      important=True),
    p("bakery_back", 68.5, 14.5, "l'arrière du fournil, sur le ballast: la trappe où l'on rentre les sacs de farine "
      "du train du samedi", objet="bakehouse", rotation=0),
    # La rue Haute
    p("upper_street_bench", 75.5, 31.0, "le banc de la rue Haute, contre la mercerie, face à la maison de Lucie",
      objet="upper_street_bench", portee=1.5, important=True),
    p("salon_door", 75.5, 28.5, "devant la porte de la mercerie-coiffure, sur la rue Haute", objet="salon_shop",
      rotation=3, important=True, porte_lieu=True),
    p("lucie_house_door", 78.5, 28.5, "devant la porte de la maison de Lucie (Jeanne y loge), en face de la mercerie",
      objet="lucie_house", rotation=1, important=True, porte_lieu=True),
    p("school_gate", 77.0, 21.5, "devant le portail de la cour de l'école, au bout nord de la rue Haute",
      objet="school_yard", rotation=2, important=True, porte_lieu=True),
    p("school_door", 83.5, 21.5, "devant la porte de l'école-mairie, sur la route des hameaux", objet="school_house",
      rotation=2),
    p("ru_stepping_stones", 64.0, 30.5, "le gué de pierres plates du ru, que Jeanne passe en sautant"),
    # Dans la mercerie-coiffure (pièce de 5 x 5, x 69 à 73, y 26 à 30; porte en 74, 28)
    p("salon_inside", 72.5, 28.5, "dans la mercerie, juste passé la porte (apparition)", objet="salon_shop",
      interieur=True),
    p("salon_counter", 71.0, 26.5, "Solange derrière le comptoir de mercerie (rouleaux de tissu au mur nord)",
      objet="salon_shop", rotation=0, interieur=True),
    p("salon_chair", 69.5, 29.5, "le fauteuil de coiffure, face au miroir du mur ouest (un joueur à la fois)",
      objet="salon_shop", portee=1.5, interieur=True),
    p("salon_stylist", 70.5, 29.5, "Solange derrière le fauteuil quand elle coupe", objet="salon_shop",
      cap_degres=270, interieur=True),
    p("salon_bench", 72.0, 30.5, "le banc d'attente à deux places, tourné vers le comptoir et le fauteuil",
      objet="salon_shop", portee=1.5, interieur=True),
    p("salon_window", 73.5, 26.5, "Solange coud derrière la vitrine (lundi), vue de la rue Haute",
      objet="salon_shop", interieur=True),
    # Dans l'épicerie-pension (boutique de 6 x 6, x 24 à 29, y 26 à 31; porte en 30, 30). Retouche du
    # 2026-11-02: les places de l'artiste (`interior_spots` de `ferrand_shop`, repère glTF x, z), tournées
    # avec l'objet (rotation 1, centre 27 ; 28): x = 27 + z, y = 28 - x (`glb_vers_carte`).
    p("grocery_inside", 27.5, 28.5, "dans la boutique d'Odette (apparition)", objet="ferrand_shop", interieur=True),
    p("grocery_inside_counter", *glb_vers_carte(1.5, 2.5), "le comptoir intérieur, la place d'Odette au guichet "
      "(entre le retour du comptoir et la cloison; le même comptoir sert la place): on y achète et vend depuis la "
      "boutique", objet="ferrand_shop", portee=1.5, interieur=True),
    p("grocery_customer", *glb_vers_carte(0.05, 2.05), "la place du client au comptoir intérieur, au bout du "
      "retour, face à Odette", objet="ferrand_shop", portee=1.0, interieur=True),
    p("grocery_table", *glb_vers_carte(-2.35, -1.35), "la petite table ronde et ses deux chaises: chocolat chaud, "
      "repas", objet="ferrand_shop", portee=1.5, interieur=True),
    p("grocery_table_seat_east", *glb_vers_carte(-2.35, -0.75), "la chaise est de la petite table (vers la porte)",
      objet="ferrand_shop", portee=1.0, interieur=True),
    p("grocery_table_seat_west", *glb_vers_carte(-2.35, -1.95), "la chaise ouest de la petite table (vers les "
      "rayonnages du fond)", objet="ferrand_shop", portee=1.0, interieur=True),
    p("grocery_stove", *glb_vers_carte(-3.55, -0.4), "le poêle de fonte, contre le mur sud (se chauffer)",
      objet="ferrand_shop", portee=1.5, interieur=True),
    p("grocery_dining_door", *glb_vers_carte(1.6, 1.0), "la porte entrouverte de la salle à manger de la pension "
      "(examiner)", objet="ferrand_shop", cap_degres=0, interieur=True),
    p("grocery_stairs", *glb_vers_carte(1.55, 0.95), "le pied de l'escalier des chambres de la pension, devant la "
      "porte de la salle à manger (examiner)", objet="ferrand_shop", portee=1.5, interieur=True),
    # Sites des pièces à bâtir de la maisonnette (section 4.3: panneau et caisse du chantier)
    p("room_cellar_site", 3.5, 18.5, "chantier du cellier: panneau et caisse, au nord du pignon ouest, hors de "
      "l'emprise de l'appentis (x 2 à 4, y 21 à 26) et hors du chemin"),
    p("room_bedroom_site", 12.5, 17.5, "chantier de la chambre: panneau et caisse, à l'est de l'aile nord, entre son "
      "pignon et le sentier du jardin (la panne attend à `beam_pickup`)"),
]

# 0.12 (lot L-quêtes, conception `v0-12-conception.md`, section 5): les points de la trame « Le marché d'Aubrune ».
POINTS += [
    # L'étal du dimanche: sur les pavés de la place, côté soleil du matin, dos à l'épicerie (façade en x 31, à 3 m),
    # hors des deux passages du quai (x 30-31 et 43-44); planche de 2 m nord-sud, vendeurs à l'ouest, clients à l'est.
    p("market_stall", 34.0, 26.5, "l'étal du dimanche, sur la place, dos à l'épicerie (vendeurs côté épicerie)",
      portee=1.5),
    # Les fanions: une guirlande tendue entre les lampadaires nord et est de la place (13 m, deux appuis réels),
    # au-dessus de l'étal; une échelle au pied de chaque lampadaire, côté place. Plus de 8 m entre les deux
    # places: un seul joueur ne peut pas tenir les deux (`ranges.stayAt` 4 m).
    p("garland_west", 34.5, 25.5, "au pied du lampadaire nord de la place: un bout de la guirlande de fanions"),
    p("garland_east", 47.5, 25.5, "au pied du lampadaire est de la place: l'autre bout de la guirlande de fanions"),
    # La chevrerie: à l'est de la maisonnette, dans l'herbe entre le sentier (x 13) et le chemin (x 17 à 19),
    # au pied du talus de la voie; devant sa porte, côté maison (sud).
    p("goat_shed", 15.0, 20.0, "devant la porte de la chevrerie, à l'est de la maisonnette, au pied du talus"),
]

ZONES = [
    {"id": "garden", "rect": {"x": 7, "y": 28, "w": 4, "h": 3},
     "role": "les 12 cases du potager de la démo, devant la porte; ordre des cases: ligne par ligne, "
             "d'ouest en est, du nord au sud"},
    {"id": "house_interior", "rect": {"x": 6, "y": 22, "w": 5, "h": 4},
     "role": "la pièce de la maisonnette (5x4), veillée et aménagement"},
    {"id": "forest_edge", "rect": {"x": 15, "y": 3, "w": 25, "h": 8},
     "role": "la lisière du bois de la Côte et ses 12 arbres à couper"},
    {"id": "quay", "rect": {"x": 21, "y": 15, "w": 30, "h": 4}, "role": "le quai"},
    {"id": "square", "rect": {"x": 31, "y": 23, "w": 18, "h": 11}, "role": "la place du bourg"},
    {"id": "river", "rect": {"x": 0, "y": 37, "w": 64, "h": 7}, "role": "l'Aubrune, berges comprises"},
    {"id": "river_ford_area", "rect": {"x": 16, "y": 37, "w": 5, "h": 7}, "role": "le gué"},
    {"id": "hen_pen", "rect": {"x": 13, "y": 31, "w": 4, "h": 4},
     "role": "où les poules picorent, devant le poulailler"},
    {"id": "train_at_platform", "rect": {"x": 23, "y": 12, "w": 27, "h": 3},
     "role": "cases occupées par le train à quai (samedi de 10 h à 16 h): infranchissables pendant ce temps; "
             "train de 27 m au plus"},
    {"id": "level_crossing_area", "rect": {"x": 17, "y": 12, "w": 3, "h": 3}, "role": "le passage à niveau"},
    {"id": "meadow", "rect": {"x": 50, "y": 24, "w": 12, "h": 10}, "role": "le pré de l'est, herbes hautes"},
    {"id": "house_plan_reserved", "rect": {"x": 2, "y": 15, "w": 14, "h": 12},
     "role": "réserve pour le plan de la maison du jeu complet (14x12, MA-01): rien de fixe n'y sera posé; "
             "pas utilisée par la démo"},
    {"id": "garden_extension_reserved", "rect": {"x": 2, "y": 28, "w": 12, "h": 8},
     "role": "réserve pour le potager du jeu complet (96 cases, FE-01), qui contient celui de la démo; "
             "pas utilisée par la démo"},
]

# Petits objets accrochés à un objet de la carte (moments rares, tour 6): ils n'ont pas d'emprise au sol, ne
# bloquent rien et ne se dessinent pas en substitut; le rendu les pose sur leur support, à la hauteur z.
# x, y, z: point d'attache en mètres (le clou du nichoir, le bout du chicot, le haut du pieu).
ACCROCHES = [
    {"id": "nest_box", "modele": "nest_box", "sur": "tree_oak_01", "x": 50.732, "y": 5.40, "z": 2.425,
     "regarde": "est", "penche_degres": 25,
     "role": "nichoir de Basile pendu de travers à un seul clou dès le jour 1 (axe est-ouest); redressé par "
             "le moment de l'échelle (drapeau `nest_box_straight`). x, y, z: le clou, sur l'écorce (rayon du "
             "tronc 0,21 à 0,23 m à cette hauteur); le centre de la caisse est 0,09 m devant (x 50,822) et "
             "0,175 m dessous (2,25 m)"},
    # Le chicot sort de la face nord-est: au sud, à cette hauteur, part une branche vivante du chêne (tourné),
    # et l'échelle occupe le sud-est. Vu de la caméra par défaut, il dépasse à droite du tronc, au-dessus du
    # nichoir, sous le houppier.
    {"id": "oak_branch_stub", "modele": "oak_branch_stub", "sur": "tree_oak_01", "x": 50.915, "y": 4.996, "z": 2.67,
     "regarde": "est",
     "role": "chicot de 0,6 m sur la face nord-est du chêne, sous le houppier, au-dessus du nichoir (il "
             "entre dans l'écorce vers 2,3 m, 7 cm au nord du nichoir penché): perchoir des mésanges"},
    # Le pieu (tour 7): dans le moteur, l'eau est à -0,16 m et le plancher du ponton à 0,5 m; à 0,95 m au-dessus
    # de l'eau, le sommet ne dépassait le plancher que de 0,29 m, un moignon où l'on se prend les pieds. Un pieu
    # d'amarrage se plante plus long et plus profond: le modèle est agrandi de 1,168 (0,95 à 1,11 m au-dessus de
    # l'eau, 0,45 m au-dessus du plancher comme la fiche), ce qui garde sa bande de mousse à la ligne d'eau,
    # l'anneau à 0,70 m (sous le plancher plus 0,2: la barque s'y attache même en crue) et un fût de 16 cm.
    {"id": "kingfisher_post", "modele": "mooring_post", "sur": "pontoon", "x": 46.1, "y": 39.9, "z": 1.11,
     "echelle": 1.168,
     "role": "pieu d'amarrage dans l'eau au coin est du bout du ponton, sommet 0,45 m au-dessus du plancher "
             "(1,11 m au-dessus de l'eau)"},
]

# Tour 9: manivelles des barrières (salut du mécanicien), sur chaque poteau, à 1,0 m, côté de la place.
ACCROCHES += [
    {"id": "level_crossing_crank_n", "modele": "level_crossing_crank", "sur": "level_crossing_gate_north",
     "x": 16.3, "y": 11.5, "z": 1.0, "regarde": "ouest",
     "role": "manivelle de la barrière nord, face ouest du poteau (16,5 ; 11,5), vers la place `gate_north_crank`"},
    {"id": "level_crossing_crank_s", "modele": "level_crossing_crank", "sur": "level_crossing_gate_south",
     "x": 20.7, "y": 15.5, "z": 1.0, "regarde": "est",
     "role": "manivelle de la barrière sud, face est du poteau (20,5 ; 15,5), vers la place `gate_south_crank`"},
]

# Tour 9: sièges sans modèle (des places où s'asseoir comme sur un banc, sans objet posé ni emprise).
SIEGES = [
    {"id": "pontoon_edge", "x": 45.0, "y": 39.8, "rotation": 0,
     "places": ["pontoon_seat_west", "pontoon_seat_east"],
     "role": "le bord du ponton (étoiles de l'Aubrune): deux places tournées vers le sud, assis à 0,5 m, jambes "
             "au-dessus de l'eau; on se relève vers le nord, sur le plancher"},
]

# Tour 9: chantiers (chantiers.json). Rien n'est posé ni bloqué tant que le chantier n'est pas bâti; ses cases
# restent libres de tout décor (réservées). `type`: le modèle; `cases`: les cases occupées une fois bâti;
# `rect`: l'emprise d'un banc (ses places), sinon `None`.
CHANTIERS = [
    {"id": "ford_bench", "type": "bench", "x": 24.0, "y": 36.5, "rotation": 0,
     "rect": {"x": 23, "y": 36, "w": 2, "h": 1}, "cases": [[23, 36], [24, 36]],
     "role": "banc à deux places sur la rive nord du gué, tourné vers l'eau (au sud): 2 m à l'est du point de "
             "pêche nord (21,5 ; 37,5), hors du chemin du gué (x 17 à 19); la clôture de la rive occupe l'ouest"},
    {"id": "quay_planters", "type": "quay_planter", "x": 25.5, "y": 18.5, "rotation": 0, "rect": None,
     "cases": [[25, 18], [34, 18], [49, 18]],
     "role": "trois jardinières au bord sud du quai, côté place, en (25, 18), (34, 18) et (49, 18): jamais devant "
             "la porte de la voiture (38,5 ; 17,5), ni sur les passages vers la place (x 30 et 31, x 43 et 44), "
             "ni contre le panneau de la gare (x 45 et 46)"},
    {"id": "well_roof", "type": "well_roof", "x": 40.0, "y": 28.0, "rotation": 0,
     "rect": {"x": 39, "y": 27, "w": 2, "h": 2}, "cases": [],
     "role": "toit de tuiles à deux pans sur quatre poteaux, au-dessus de la margelle du puits (déjà "
             "infranchissable): faîte à 2,4 m, treuil; il ne déborde pas de la margelle"},
    {"id": "path_lamp", "type": "lamp_post", "x": 14.5, "y": 26.5, "rotation": 0,
     "rect": {"x": 14, "y": 26, "w": 1, "h": 1}, "cases": [[14, 26]],
     "role": "réverbère au bord nord du chemin de la maisonnette: le tronçon le plus sombre du retour de la "
             "place (le lampadaire du passage à niveau est à 9 m); à 31 m du ponton, qui reste sombre"},
    # Retouche du 2026-11-02: origine en x 11,72, fixée par l'artiste (`house_bench`, `wall_back` 0,386 m):
    # le haut du dossier touche le soubassement du pignon (nu en x 11,33). Le banc tient alors tout entier
    # dans la colonne du mur (x 11,34 à 11,97), déjà infranchissable: il ne bloque aucune case de plus. Les
    # cases (12, 22) et (12, 23), devant les deux places, restent libres: on s'y relève (`standForward`
    # 0,85 m de `reglages.json`, soit x 12,57), à un pas du chemin (x 13).
    {"id": "house_bench", "type": "bench", "x": 11.72, "y": 23.0, "rotation": 1,
     "rect": {"x": 11, "y": 22, "w": 1, "h": 2}, "cases": [],
     "role": "banc à dossier contre le pignon est de la maisonnette, tourné vers l'est, le dossier contre le "
             "soubassement; on s'assoit et on se relève depuis les cases (12, 22) et (12, 23); soleil du "
             "matin, chemin du quai, passage des trains"},
    {"id": "door_canopy", "type": "door_canopy", "x": 8.5, "y": 26.5, "rotation": 0, "rect": None, "cases": [],
     "role": "auvent au-dessus de la porte (case 8, 26), qui donne au sud sur le chemin: sans emprise au sol"},
]

# Meubles déjà posés dans la maisonnette (objets.json, startingInventory.houseFurniture).
MOBILIER_DEPART = [
    {"item": "straw_mattress", "cx": 6, "cy": 22, "rotation": 0},
    {"item": "straw_mattress", "cx": 7, "cy": 22, "rotation": 0},
    {"item": "stove", "cx": 10, "cy": 22, "rotation": 0},
    {"item": "chest", "cx": 6, "cy": 25, "rotation": 0},
]


def rect(x: int, y: int, w: int, h: int) -> dict:
    return {"x": x, "y": y, "w": w, "h": h}


# Tour 10: bâtiments visitables (ADR 0016, section 1). Une entrée par bâtiment: l'objet qui le porte, ses
# pièces (rectangles de cases franchissables, dans l'emprise et à l'intérieur des murs), ses portes (case
# franchissable sur le pourtour, côté façade, et la case du dehors devant elle), le point d'apparition, la clé
# de `reglages.json` qui porte ses heures (aucune pour la maisonnette), son ambiance sonore. `mobilier`: le
# mobilier fixe qui occupe des cases (bloquées dans `infranchissable`; l'artiste 3D le pose là). Une pièce
# `a_batir` (cellier, chambre) n'existe qu'une fois bâtie: son `emprise` (sans le mur commun, qui est celui de
# la maisonnette) reste libre jusque-là; sa `porte` est percée dans le mur commun, à la place d'une fenêtre.
INTERIEURS = [
    {
        "id": "house", "objet": "gatekeeper_house", "nom": "la maisonnette",
        "pieces": [
            {"id": "house_main", "nom": "la pièce (puis la salle commune)", "rect": rect(6, 22, 5, 4),
             "zone": "house_interior"},
            {"id": "house_cellar", "nom": "le cellier", "a_batir": "room_cellar", "rect": rect(3, 22, 2, 4),
             "emprise": rect(2, 21, 3, 6), "mur_commun": "est", "site": "room_cellar_site",
             "porte": {"cx": 5, "cy": 24, "vers": "house_main",
                       "role": "la fenêtre ouest de la pièce (modèle: mur gauche, u 0,3) devient la porte"},
             "fenestron": "nord",
             "etageres": [rect(3, 22, 1, 2), rect(3, 24, 1, 2)],
             "role": "appentis contre le pignon ouest (toit à un pan, faîtage à 2,6 m); deux places d'étagère "
                     "haute contre le mur ouest, le passage x 4 reste libre devant la porte"},
            {"id": "house_bedroom", "nom": "la chambre", "a_batir": "room_bedroom", "rect": rect(6, 17, 5, 4),
             "emprise": rect(5, 16, 7, 5), "mur_commun": "sud", "site": "room_bedroom_site",
             "porte": {"cx": 9, "cy": 21, "vers": "house_main",
                       "role": "la fenêtre nord de la pièce (modèle: mur arrière, u -1) devient la porte"},
             "fenetres": ["nord", "est"],
             "role": "aile nord, côté voie: la rangée y 15 reste libre (1 m avant le ballast), le banc du pignon "
                     "(x 12) et le sentier du jardin (x 13) restent dehors"},
        ],
        "apparition": "house_spawn", "heures": None, "ambiance": None, "mobilier": [],
    },
    {
        "id": "grocery", "objet": "ferrand_shop", "nom": "l'épicerie-pension d'Odette",
        "pieces": [
            {"id": "grocery_shop", "nom": "la boutique", "rect": rect(24, 26, 6, 6)},
        ],
        "fermees": [
            {"id": "grocery_dining_room", "rect": rect(24, 24, 6, 2),
             "role": "la salle à manger de la pension, tables sous des draps: on la regarde par la porte "
                     "entrouverte (`grocery_dining_door`), on n'y entre pas (étape 3 de l'histoire d'Odette)"},
        ],
        "apparition": "grocery_inside", "heures": "grocer", "ambiance": "room-tone-shop",
        # Retouche du 2026-11-02: les cases de `interior_blocked` de l'artiste, tournées avec l'objet, sauf
        # une. Le rayonnage du mur ouest (x 24 à 24,35) couvre y 28,07 à 30,42; l'artiste bloque (24, 28) et
        # (24, 29) et laisse (24, 30), où il entre aussi de 0,35 m. Avec (24, 29) bloquée, la table (25, 30) et
        # le poêle (26, 31) enferment le coin (24, 30), (24, 31), (25, 31) et la chaise ouest: on ne passe
        # pas en biais entre deux cases pleines. (24, 29) reste donc libre, comme (24, 30) (à reporter dans
        # le GLB par l'artiste).
        "mobilier": [
            {"id": "grocery_inner_counter", "cases": cases_glb((1, 2), (0, 2), (-1, 2)), "rotation": 3,
             "role": "le comptoir: le présentoir de bocaux sous la vitrine (29, 27 et 28), son retour "
                     "perpendiculaire à la façade (y 26,9 à 27,5, de x 28,6 à la vitrine) avec la balance et la panière d'Achille, et la "
                     "place d'Odette au guichet (29, 26), entre le retour et la cloison, où l'on n'entre pas; "
                     "elle y passe par le palier (28, 26)"},
            {"id": "grocery_stairs", "cases": cases_glb((1, -3), (1, -2), (1, -1), (1, 0)), "rotation": 1,
             "role": "l'escalier des chambres (15 marches) le long de la cloison, pied à l'est sur le palier "
                     "(28, 26), devant la porte de la salle à manger"},
            {"id": "grocery_shelves", "cases": cases_glb((-1, -3)), "rotation": 1,
             "role": "le rayonnage de bocaux du mur ouest (qui reste debout pour la caméra), x 24 à 24,35, "
                     "y 28,07 à 30,42; les cases (24, 29) et (24, 30) restent libres (voir plus haut)"},
            {"id": "grocery_small_table", "cases": cases_glb((-3, -2)), "rotation": 0,
             "role": "la petite table ronde (25,65 ; 30,35); ses deux chaises de part et d'autre, à l'est "
                     "(26,25) et à l'ouest (25,05)"},
            {"id": "grocery_stove", "cases": cases_glb((-4, -1)), "rotation": 2,
             "role": "le poêle de fonte et son tuyau contre le mur sud (placé là par l'artiste; ce mur est coupé "
                     "pour la caméra par défaut, le poêle reste debout devant)"},
            {"id": "grocery_south_shelves", "cases": cases_glb((-4, 0), (-4, 2)), "rotation": 2,
             "role": "le rayonnage du mur sud (27, 31) et les sacs de graines près de la porte, hors du "
                     "battant (29, 31); (28, 31), où le rayonnage n'a que 0,35 m de fond, reste libre comme "
                     "chez l'artiste"},
        ],
        # Petits objets posés sur le mobilier, dessinés avec l'intérieur (masqués tant que le joueur local
        # n'est pas dans le bâtiment, comme `ferrand_shop_interior`), et seulement quand `visible_si` est
        # vrai (mêmes conditions que les répliques de `habitants.json`). Le jeu ne les lit pas encore.
        "accroches": [
            {"id": "grocery_coffee_mill", "modele": "coffee_mill", "sur": "grocery_inner_counter",
             "x": glb_vers_carte(1.3, 2.75)[0], "y": glb_vers_carte(1.3, 2.75)[1], "z": 0.95, "regarde": "est",
             "visible_si": [{"type": "given", "villager": "odette", "item": "coffee_mill"}],
             "role": "le moulin neuf d'Odette (cadeau du tour 9), sur la tablette du guichet (dessus à 0,94 m), "
                     "entre le retour du comptoir et la cloison, à portée de main d'Odette; on le voit de la "
                     "place par le guichet. Origine du modèle sous la caisse"},
        ],
    },
    {
        "id": "salon", "objet": "salon_shop", "nom": "la mercerie-coiffure de Solange",
        "pieces": [
            {"id": "salon_room", "nom": "le salon et la mercerie", "rect": rect(69, 26, 5, 5)},
        ],
        "apparition": "salon_inside", "heures": "salon", "ambiance": "room-tone-salon",
        "mobilier": [
            {"id": "salon_counter_desk", "cases": [[70, 27], [71, 27], [72, 27]], "rotation": 0,
             "role": "le comptoir de mercerie, Solange derrière (y 26), rouleaux de tissu et rubans au mur nord"},
            {"id": "salon_chair_seat", "cases": [[69, 29]], "rotation": 3,
             "role": "le fauteuil de coiffure à pied, tourné vers le grand miroir et la tablette du mur ouest (un "
                     "mur qui reste debout pour la caméra, au contraire des murs sud et est)"},
            {"id": "salon_waiting_bench", "cases": [[71, 30], [72, 30]], "rotation": 2,
             "role": "le banc d'attente à deux places et ses journaux, dos au mur sud, tourné vers le fauteuil"},
        ],
    },
]

# Tour 10: les passages du ru de la Côte. Le ru ne se franchit que là (contrôlé par `valider_carte.py`).
RU = {"colonnes": list(RU_X), "de_y": 0, "a_y": 37,
      "role": "le ru de la Côte descend du coteau (au nord, hors carte) et se jette dans l'Aubrune en y 37"}
OUVRAGES = [
    {"id": "ru_culvert", "nature": "ponceau", "franchit": "ru", "rect": rect(63, 12, 2, 3), "modele": "ru_culvert",
     "role": "voûte de pierre sous le remblai de la voie (la voie existait avant la rue Haute); les cases de la "
             "voie ne changent pas, on y passe sur le ballast comme partout ailleurs"},
    {"id": "ru_road_bridge", "nature": "pont", "franchit": "ru", "rect": rect(63, 21, 2, 3),
     "modele": "ru_road_bridge", "largeur_m": 3.0,
     "role": "pont de pierre de la rue de la halte, 3 m entre parapets bas (deux personnes et une charrette), "
             "parapets sur les bords nord et sud du tablier"},
    {"id": "ru_footbridge", "nature": "passerelle", "franchit": "ru", "rect": rect(63, 34, 2, 2),
     "modele": "ru_footbridge", "largeur_m": 1.6,
     "role": "planches sur deux poutres, 1,6 m (on y croise un habitant), centrée en y 35; garde-corps côté "
             "amont (nord) seulement, pour ne rien masquer à la caméra par défaut"},
    {"id": "ru_stepping_stones", "nature": "gue", "franchit": "ru", "rect": rect(63, 30, 2, 1),
     "modele": "ru_stepping_stones",
     "role": "trois pierres plates dans l'eau vive, que Jeanne passe en sautant: le raccourci du pré de l'est "
             "vers l'arrière de la mercerie"},
]

TRAJETS = [
    {"id": "firmin_home_to_bell", "habitant": "firmin", "de": "firmin_house", "a": "quay_bell",
     "par": [[44.5, 8.5], [45.5, 10.5], [50.5, 10.5], [50.5, 17.5], [37.5, 17.5], [28.5, 17.5], [27.5, 18.5]],
     "note": "par la traversée de service, libre même quand le train est à quai; contourne la cloche par le nord"},
    {"id": "firmin_bell_to_home", "habitant": "firmin", "de": "quay_bell", "a": "firmin_house",
     "par": [[27.5, 18.5], [28.5, 17.5], [37.5, 17.5], [50.5, 17.5], [50.5, 10.5], [45.5, 10.5], [44.5, 8.5]]},
    {"id": "firmin_home_to_train", "habitant": "firmin", "de": "firmin_house", "a": "train_stop",
     "par": [[44.5, 8.5], [45.5, 10.5], [50.5, 10.5], [50.5, 17.5], [38.5, 17.5]]},
    {"id": "odette_door_to_counter", "habitant": "odette", "de": "grocery_door", "a": "grocery_counter",
     "par": [[31.5, 30.5], [31.5, 26.5], [30.5, 26.5]]},
    {"id": "odette_counter_to_door", "habitant": "odette", "de": "grocery_counter", "a": "grocery_door",
     "par": [[30.5, 26.5], [31.5, 26.5], [31.5, 30.5]]},
    {"id": "odette_counter_to_terrace", "habitant": "odette", "de": "grocery_counter", "a": "grocery_terrace",
     "par": [[30.5, 26.5], [31.5, 26.5], [31.5, 30.5], [33.5, 30.5]]},
    {"id": "basile_yard_to_workbench", "habitant": "basile", "de": "sawmill_yard", "a": "basile_at_workbench",
     "par": [[9.5, 10.5], [14.5, 10.5], [14.6, 8.0]]},
    {"id": "basile_workbench_to_yard", "habitant": "basile", "de": "basile_at_workbench", "a": "sawmill_yard",
     "par": [[14.6, 8.0], [14.5, 10.5], [9.5, 10.5]]},
    {"id": "basile_yard_to_beam", "habitant": "basile", "de": "sawmill_yard", "a": "basile_by_beam",
     "par": [[9.5, 10.5], [14.5, 11.5], [15.5, 16.8]], "note": "jour 1, par-dessus la voie"},
    {"id": "basile_yard_to_train", "habitant": "basile", "de": "sawmill_yard", "a": "train_stop",
     "par": [[9.5, 10.5], [18.5, 10.5], [18.5, 16.5], [21.5, 16.5], [38.5, 17.5]],
     "note": "jour 8, par le passage à niveau puis le quai"},
    # Tour 10: Jeanne loge chez Lucie, rue Haute; elle prend le gué de pierres en sautant.
    {"id": "jeanne_home_to_bench", "habitant": "jeanne", "de": "lucie_house_door", "a": "quay_bench",
     "par": [[78.5, 28.5], [76.5, 32.5], [67.5, 32.5], [65.5, 30.5], [62.5, 30.5], [49.5, 30.5], [49.5, 21.5],
             [32.5, 21.5], [32.5, 19.5]],
     "note": "par le gué de pierres du ru et le pré de l'est"},
    {"id": "jeanne_bench_to_riverbank", "habitant": "jeanne", "de": "quay_bench", "a": "riverbank",
     "par": [[32.5, 19.5], [32.5, 21.5], [37.5, 21.5], [37.5, 34.5], [29.5, 34.5], [29.0, 37.5], [28.0, 37.5]]},
    {"id": "jeanne_riverbank_to_square", "habitant": "jeanne", "de": "riverbank", "a": "village_square",
     "par": [[28.0, 37.5], [29.0, 37.5], [29.5, 34.5], [37.5, 34.5], [38.5, 30.5]]},
    {"id": "jeanne_home_to_school", "habitant": "jeanne", "de": "lucie_house_door", "a": "school_gate",
     "par": [[78.5, 28.5], [77.5, 24.5], [77.5, 21.5]], "note": "jours d'école d'automne, 8 h 15"},
    # Tour 10: Achille (conception 1.4).
    {"id": "achille_basket_to_grocery", "habitant": "achille", "de": "bakery_window", "a": "grocery_door",
     "par": [[70.5, 21.5], [62.0, 22.0], [49.5, 22.5], [33.5, 22.5], [31.5, 24.5], [31.5, 30.5]],
     "note": "la panière, 9 h: par le pont, la rue de la halte et la place (`achille_basket` se porte à deux)"},
    {"id": "achille_grocery_to_bakery", "habitant": "achille", "de": "grocery_door", "a": "bakery_door",
     "par": [[31.5, 30.5], [31.5, 24.5], [33.5, 22.5], [49.5, 22.5], [62.0, 22.0], [68.5, 21.5]]},
    {"id": "achille_bakery_to_bench", "habitant": "achille", "de": "bakery_window", "a": "upper_street_bench",
     "par": [[70.5, 21.5], [76.5, 23.5], [76.5, 30.5]], "note": "midi, il déjeune sur le banc de la rue Haute"},
    {"id": "achille_bakery_to_ford", "habitant": "achille", "de": "bakery_door", "a": "fishing_ford_north",
     "par": [[68.5, 21.5], [76.5, 23.5], [76.5, 34.5], [21.5, 34.5], [21.5, 37.5]],
     "note": "17 h 30, la pêche au gué: la rue Haute, la promenade et la passerelle"},
    {"id": "achille_bakery_to_train", "habitant": "achille", "de": "bakery_door", "a": "train_stop",
     "par": [[68.5, 21.5], [72.5, 21.5], [72.5, 14.5], [50.5, 14.5], [50.5, 16.5], [38.5, 17.5]],
     "note": "samedi, 10 h: par la ruelle, le ballast et le ponceau, la traversée de service au bout du quai "
             "(libre quand le train est là)"},
    {"id": "achille_train_to_hatch", "habitant": "achille", "de": "train_stop", "a": "bakery_back",
     "par": [[38.5, 17.5], [50.5, 16.5], [50.5, 14.5], [68.5, 14.5]],
     "note": "les sacs de farine jusqu'à la trappe de l'arrière du fournil, sans traverser le bourg"},
    # Tour 10: Solange (conception 1.4).
    {"id": "solange_salon_to_square", "habitant": "solange", "de": "salon_counter", "a": "village_square",
     "par": [[71.0, 26.5], [73.5, 26.5], [73.5, 28.5], [75.5, 28.5], [75.5, 23.5], [62.0, 22.5], [49.5, 22.5],
             [49.5, 30.5], [38.5, 30.5]],
     "note": "18 h, elle descend chercher Jeanne sur la place, par le pont"},
    {"id": "solange_square_to_lucie", "habitant": "solange", "de": "village_square", "a": "lucie_house_door",
     "par": [[38.5, 30.5], [49.5, 30.5], [49.5, 22.5], [62.0, 22.5], [76.5, 23.5], [77.5, 27.5], [78.5, 28.5]],
     "note": "18 h 30, elle remonte avec Jeanne jusqu'à la porte de Lucie"},
    {"id": "solange_salon_to_riverbank", "habitant": "solange", "de": "salon_counter", "a": "riverbank",
     "par": [[71.0, 26.5], [73.5, 26.5], [73.5, 28.5], [76.5, 29.5], [76.5, 34.5], [29.5, 34.5], [29.0, 37.5],
             [28.0, 37.5]],
     "note": "dimanche, la promenade de la berge avec Jeanne"},
    {"id": "solange_salon_to_grocery_table", "habitant": "solange", "de": "salon_counter", "a": "grocery_table",
     "par": [[71.0, 26.5], [73.5, 26.5], [73.5, 28.5], [75.5, 28.5], [75.5, 23.5], [62.0, 22.5], [49.5, 22.5],
             [33.5, 22.5], [31.5, 24.5], [31.5, 30.5], [29.5, 30.5], [26.25, 30.35]],
     "note": "dimanche, 14 h: sa mise en plis chez Odette, par la porte de l'épicerie, jusqu'à la chaise est de "
             "la petite table"},
]

HABITANTS = {
    "source": "games/la-petite-ligne/donnees/habitants.json fait foi pour les heures; ce résumé dit où",
    "firmin": {"matin": "quay_bell", "midi": "quay_bell", "soir": "firmin_house",
               "samedi": "train_stop", "trajets": ["firmin_home_to_bell", "firmin_bell_to_home",
                                                   "firmin_home_to_train"]},
    "odette": {"matin": "grocery_counter", "midi": "grocery_counter", "soir": "grocery_door",
               "souper_jour_5": "grocery_terrace",
               "trajets": ["odette_door_to_counter", "odette_counter_to_door", "odette_counter_to_terrace"]},
    "basile": {"matin": "basile_at_workbench", "midi": "basile_at_workbench", "soir": "sawmill_yard",
               "jour_1": "basile_by_beam", "jour_8": "train_stop",
               "trajets": ["basile_yard_to_workbench", "basile_workbench_to_yard", "basile_yard_to_beam",
                           "basile_yard_to_train"]},
    # Tour 10 (conception 1.4): Jeanne ne sort plus par `village_exit`, elle rentre avec Solange chez Lucie à
    # 18 h 30 (à reporter dans habitants.json par le lot L3).
    "jeanne": {"matin": "quay_bench", "midi": "riverbank", "soir": "village_square", "nuit": "lucie_house_door",
               "ecole": "school_gate",
               "trajets": ["jeanne_home_to_bench", "jeanne_bench_to_riverbank", "jeanne_riverbank_to_square",
                           "solange_square_to_lucie", "jeanne_home_to_school"]},
    "achille": {"matin": "bakery_window", "midi": "upper_street_bench", "apres_midi": "bakery_window (absent, il dort)",
                "soir": "fishing_ford_north", "lundi": "fishing_pontoon", "samedi": "train_stop",
                "paniere": "grocery_door",
                "trajets": ["achille_basket_to_grocery", "achille_grocery_to_bakery", "achille_bakery_to_bench",
                            "achille_bakery_to_ford", "achille_bakery_to_train", "achille_train_to_hatch"]},
    "solange": {"matin": "salon_counter", "midi": "salon_counter (absente, chez elle)", "soir": "village_square",
                "nuit": "salon_counter (absente)", "dimanche": "riverbank, grocery_table", "lundi": "salon_window",
                "samedi": "train_stop",
                "trajets": ["solange_salon_to_square", "solange_square_to_lucie", "solange_salon_to_riverbank",
                            "solange_salon_to_grocery_table"]},
}

# Trajets clés contrôlés par le validateur (25 s au plus à 3,5 m/s).
TRAJETS_CLES = [
    ["house_door", "train_stop"], ["house_door", "coop_crate"], ["house_door", "notice_board"],
    ["house_door", "grocery_counter"], ["house_door", "well"], ["house_door", "sawmill_workbench"],
    ["house_door", "tree_edge_06"], ["house_door", "riverbank"], ["house_door", "river_ford"],
    ["house_door", "chicken_coop"], ["house_door", "firmin_house"], ["house_door", "handcar_shed"],
    ["house_door", "village_square"], ["house_door", "quay_bell"],
    ["garden", "water_barrel"], ["garden", "well"],
    ["coop_crate", "grocery_counter"], ["coop_crate", "chicken_coop"], ["coop_crate", "sawmill_workbench"],
    ["sawmill_workbench", "tree_edge_12"], ["sawmill_workbench", "tree_edge_01"],
    ["sawmill_workbench", "grocery_counter"], ["grocery_counter", "village_square"],
    ["train_stop", "grocery_counter"], ["train_stop", "riverbank"], ["train_stop", "handcar_shed"],
    ["quay_bell", "bell_shadow_spot"], ["riverbank", "river_ford"], ["fishing_pontoon", "house_door"],
    ["sawmill_yard", "riverbank"], ["firmin_house", "grocery_counter"], ["forage_edge_05", "house_door"],
    # Tour 10: la rue Haute (conception, annexe A, partie 5: 24 à 27 s prévus par le modèle du game designer).
    ["house_door", "bakery_window"], ["house_door", "salon_door"], ["house_door", "lucie_house_door"],
    ["house_door", "school_gate"], ["grocery_door", "bakery_door"], ["village_square", "salon_door"],
    ["train_stop", "bakery_back"], ["house_door", "grocery_inside_counter"], ["upper_street_bench", "riverbank"],
]


def formater(valeur: object, niveau: int = 0, dans_liste: bool = False) -> str:
    """JSON lisible et facile à comparer: une ligne par objet, point, zone ou rangée de terrain."""
    plat = json.dumps(valeur, ensure_ascii=False, separators=(", ", ": "))
    retrait = "  " * (niveau + 1)
    fin = "  " * niveau
    if isinstance(valeur, dict) and not dans_liste and niveau < 3 and len(plat) > 100:
        lignes = [f"{retrait}{json.dumps(k, ensure_ascii=False)}: {formater(v, niveau + 1)}" for k, v in valeur.items()]
        return "{\n" + ",\n".join(lignes) + "\n" + fin + "}"
    if isinstance(valeur, list) and not dans_liste and len(plat) > 100:
        lignes = [retrait + formater(v, niveau + 1, dans_liste=True) for v in valeur]
        return "[\n" + ",\n".join(lignes) + "\n" + fin + "]"
    return plat


def main() -> int:
    construire_terrain()
    construire_objets()
    peindre_sols_batiments()
    peindre_bord()

    carte = {
        "format": "duo.carte",
        "version": 1,
        "id": "halte",
        "nom": "La Halte d'Aubrune, le bourg (démo)",
        "jeu": "la-petite-ligne",
        "document": "docs/jeux/jeu-1/carte-halte.md",
        "source": "games/la-petite-ligne/outils/construire_carte_halte.py (ne pas retoucher ce fichier à la main: "
                  "modifier le script et le relancer)",
        "taille": {"largeur": LARGEUR, "hauteur": HAUTEUR, "bord": BORD},
        "conventions": {
            "unite": "1 case = 1 m",
            "axes": "x vers l'est, y vers le sud; dans Three.js: x du monde vers +X, y du monde vers +Z",
            "case": "la case (cx, cy) couvre [cx, cx + 1[ x [cy, cy + 1[; son centre est (cx + 0,5 ; cy + 0,5)",
            "position": "x, y d'un objet: centre de son emprise, en mètres",
            "rotation": "quarts de tour: 0 façade (porte) au sud, 1 à l'est, 2 au nord, 3 à l'ouest. "
                        "Three.js, modèle dont la porte regarde +Z au repos: rotation.y = rotation x PI/2. "
                        "Pour un point: facing (radians, 0 vers l'est) = PI/2 - rotation x PI/2",
            "emprise": "[largeur le long de la façade, profondeur] à la rotation 0; largeur et profondeur "
                       "s'échangent aux rotations 1 et 3; chaque objet porte aussi son rectangle `rect`",
            "portes": "décalage le long de la façade, compté depuis l'extrémité gauche vue de dehors "
                      "(l'ouest pour une rotation 0)",
            "interieur": "bâtiment à pièce jouable: murs sur le pourtour (une case), intérieur et porte "
                         "franchissables; sinon toute l'emprise est infranchissable",
            "points": "x, y en mètres; `objet`: l'objet auquel le point appartient; `portee`: le point est dans "
                      "une case pleine et se joue depuis une case libre à cette distance; `rayon`: tolérance "
                      "d'arrivée; `rotation`: où regarde un habitant posté là; `cap_degres`: où regarde celui "
                      "qui s'y tient, en degrés de boussole (0 nord, 90 est), pour les directions en biais "
                      "(places de l'échelle)",
            "interieurs": "bâtiments visitables (ADR 0016): `pieces` (rectangles `rect` de cases franchissables, "
                          "dans l'emprise et à l'intérieur des murs), `portes` (case sur le pourtour et case "
                          "`dehors` devant elle), `apparition` (point), `heures` (clé de premier niveau de "
                          "reglages.json, null: toujours ouvert), `ambiance` (son), `mobilier` (mobilier fixe: "
                          "`cases` bloquées), `fermees` (parties du bâtiment où l'on n'entre pas). Une pièce "
                          "`a_batir` n'existe qu'une fois bâtie: `emprise` (sans le mur commun, `mur_commun`), "
                          "`porte` percée dans le mur commun; jusque-là ses cases restent dehors",
            "ouvertures": "seules les ouvertures `porte` d'un bâtiment à intérieur sont franchissables; comptoir, "
                          "guichet et vitrine restent des murs",
            "toit": "type à `toit`: hauteur à l'égout et faîtage parallèle ou perpendiculaire à la façade; "
                    "`hauteur` est celle du faîtage",
            "ouvrages": "ponts, passerelle, ponceau et gué du ru: `rect` des cases qu'ils occupent, `modele` à "
                        "poser par le rendu (aucun objet posé tant que le modèle n'existe pas)",
        },
        "camera": {
            "orientation_par_defaut": "sud-est (regard vers le nord-ouest), comme le rendu (yaw = -3 PI/4)",
            "elevation_degres": 35.264,
            "regle": "éléments hauts au nord et à l'ouest, lieux importants au sud-est de ce qui est haut; "
                     "transparence ou découpe obligatoire pour un personnage caché derrière un bâtiment, "
                     "un arbre ou le train",
            # Tour 10 (conception 1.3): la mercerie et la maison de Lucie restent basses et en retrait pour ne
            # pas cacher la chaussée de la rue de la halte et de la route des hameaux en orientation 0.
            "rues_degagees": [
                {"id": "rue_de_la_halte_est", "rect": rect(62, 21, 25, 2), "objets": ["salon_shop", "lucie_house"]},
            ],
        },
        "terrain": {
            "legende": LEGENDE,
            "lignes": ["".join(row) for row in T],
        },
        "types": TYPES,
        "objets": OBJETS,
        "points": POINTS,
        "zones": ZONES,
        "maison": {
            "objet": "gatekeeper_house",
            "piece": "house_interior",
            "porte": {"cx": 8, "cy": 26},
            "retour_de_minuit": "house_spawn",
            "mobilier_depart": MOBILIER_DEPART,
            "note": "cx, cy d'un meuble: case nord-ouest de son emprise (objets.json, footprint w x d)",
        },
        "interieurs": INTERIEURS,
        "ru": RU,
        "ouvrages": OUVRAGES,
        "accroches": ACCROCHES + accroches_poteaux_finaux(),
        "sieges": SIEGES,
        "chantiers": CHANTIERS,
        "habitants": HABITANTS,
        "trajets": TRAJETS,
        "trajets_cles": {"vitesse": 3.5, "max_secondes": 25, "paires": TRAJETS_CLES},
        "portage": {"de": "beam_pickup", "a": "house_beam_spot", "vitesse": 1.8, "largeur_min": 3},
        "sorties": [
            {"id": "exit_line_west", "nature": "voie vers la ville (le train arrive et repart par là)",
             "ouverte": False},
            {"id": "exit_line_east", "nature": "voie des Vergers (chapitre 2)", "ouverte": False},
            {"id": "exit_old_road_south", "nature": "vieille route au sud du gué", "ouverte": False},
            {"id": "exit_hamlets_road", "nature": "route des hameaux, au bout est (habitants seulement; tour 10: "
             "elle remplace la sortie par la promenade)", "ouverte": False, "point": "village_exit"},
        ],
    }
    for o in OBJETS:
        x0, y0, w, h = emprise_monde(o, TYPES)
        o["rect"] = {"x": x0, "y": y0, "w": w, "h": h}
    # Portes des bâtiments visitables: les ouvertures `porte` de leur objet (une seule source de vérité).
    par_id = {o["id"]: o for o in OBJETS}
    points_porte = {"house": "house_door", "grocery": "grocery_door", "salon": "salon_door"}
    for b in INTERIEURS:
        portes = []
        for nom, ((cx, cy), (fx, fy)) in ouvertures(par_id[b["objet"]], TYPES).items():
            if nom.startswith("porte"):
                portes.append({"id": f"{b['id']}_{nom}", "cx": cx, "cy": cy, "dehors": {"cx": fx, "cy": fy},
                               "point": points_porte[b["id"]]})
        b["portes"] = portes
    carte["infranchissable"] = calculer_infranchissable(carte)

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(formater(carte) + "\n", encoding="utf-8")
    print(f"carte écrite: {SORTIE} ({len(OBJETS)} objets, {len(POINTS)} points, {len(ZONES)} zones)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
