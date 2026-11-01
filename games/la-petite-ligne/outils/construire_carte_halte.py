#!/usr/bin/env python3
"""Construit la carte du bourg de La Halte d'Aubrune (démo de La Petite Ligne).

Sortie: games/la-petite-ligne/donnees/cartes/halte.json

La composition se retouche ici, puis on relance ce script, le validateur et
l'aperçu:

    python3 games/la-petite-ligne/outils/construire_carte_halte.py
    python3 games/la-petite-ligne/outils/valider_carte.py
    python3 games/la-petite-ligne/outils/apercu_carte.py

Document de conception: docs/jeux/jeu-1/carte-halte.md.
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
from valider_carte import calculer_infranchissable, emprise_monde  # noqa: E402

LARGEUR, HAUTEUR = 64, 48
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
    "ferrand_shop": {"categorie": "batiment", "nom": "épicerie-pension Ferrand", "emprise": [10, 8], "hauteur": 8.5,
                     "portes": {"porte": 2, "comptoir": 6}, "interieur": False},
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
}

OBJETS: list[dict] = []
_COMPTEURS: dict[str, int] = {}


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
            if 50 <= x and 24 <= y <= 33 and bruit(x, y, 2) < 60:
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
    peindre("g", 16, 37, 5, 7)       # le gué, sur toute la largeur
    peindre(":", 17, 44, 3, 4)       # la vieille route continue au sud (fermée par le bord)

    # Le potager de la démo: 12 cases devant la porte.
    peindre("p", 7, 28, 4, 3)

    # Sols des bâtiments (peints ensuite d'après les objets).


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
            if T[y][x] in "=~:bg":
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
    objet("bush", 4, 21)
    objet("bush", 12, 21)
    objet("rock", 3, 33)

    # La place du bourg
    objet("ferrand_shop", 23, 23, rotation=1, ident="ferrand_shop")
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
    for x, y in ((48, 23), (48, 24), (47, 23), (48, 33), (48, 32), (33, 33), (34, 33), (41, 25), (38, 25)):
        objet("bush", x, y)
    objet("bench", 42, 28, rotation=3, ident="square_bench_east")

    # La halte côté est: cour et pré
    objet("bush", 61, 24)
    objet("bush", 53, 26)
    objet("bush", 58, 29)
    objet("bush", 52, 32)
    objet("rock", 56, 27)
    objet("rock", 60, 32)
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
    for x, y in ((17, 3), (19, 7), (23, 5), (27, 8), (29, 7), (33, 3), (33, 8), (37, 4), (39, 7)):
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
    for x in range(0, LARGEUR, 2):
        t = "tree_fir" if bruit(x, 0, 7) < 50 else "tree_oak"
        objet(t, x, 0 if bruit(x, 1, 8) < 50 else 1)
    for y in range(4, 44, 3):
        if 11 <= y <= 15 or 36 <= y <= 43:
            continue
        # A l'ouest, des arbres le long du bois, puis la haie du jardin du garde-barrière; à l'est, une
        # haie basse: des arbres y cacheraient la remise, la cour de la halte et le pré.
        if y <= 10:
            objet("tree_oak" if bruit(0, y, 9) < 50 else "tree_fir", 0, y)
        else:
            objet("bush", 0, y)
        objet("bush", 63, y)
    for x in range(1, LARGEUR, 3):
        if 15 <= x <= 21:
            continue
        objet("bush", x, 47)


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
    p("fox_mousing", 7.5, 17.0, "moment du renard: il mulote dans l'herbe non fauchée entre la voie et la "
      "maisonnette, à 4 m de son mur nord", moment="fox"),
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
    p("house_bench", 12.5, 23.0, "le banc contre le pignon est de la maisonnette (chantier `house_bench`), "
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
    # Sortie des habitants
    p("village_exit", 61.5, 34.5, "bout de la promenade: les habitants qui rentrent chez eux hors carte "
      "(`offstage`) y disparaissent", rotation=1),
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
    {"id": "house_bench", "type": "bench", "x": 12.5, "y": 23.0, "rotation": 1,
     "rect": {"x": 12, "y": 22, "w": 1, "h": 2}, "cases": [[12, 22], [12, 23]],
     "role": "banc contre le pignon est de la maisonnette, tourné vers l'est: entre le mur (x 11) et le chemin "
             "(x 13), sans le toucher; soleil du matin, chemin du quai, passage des trains"},
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
    {"id": "jeanne_exit_to_bench", "habitant": "jeanne", "de": "village_exit", "a": "quay_bench",
     "par": [[61.5, 34.5], [49.5, 34.5], [49.5, 21.5], [32.5, 21.5], [32.5, 19.5]]},
    {"id": "jeanne_bench_to_riverbank", "habitant": "jeanne", "de": "quay_bench", "a": "riverbank",
     "par": [[32.5, 19.5], [32.5, 21.5], [37.5, 21.5], [37.5, 34.5], [29.5, 34.5], [29.0, 37.5], [28.0, 37.5]]},
    {"id": "jeanne_riverbank_to_square", "habitant": "jeanne", "de": "riverbank", "a": "village_square",
     "par": [[28.0, 37.5], [29.0, 37.5], [29.5, 34.5], [37.5, 34.5], [38.5, 30.5]]},
    {"id": "jeanne_square_to_exit", "habitant": "jeanne", "de": "village_square", "a": "village_exit",
     "par": [[38.5, 30.5], [42.5, 34.5], [61.5, 34.5]]},
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
    "jeanne": {"matin": "quay_bench", "midi": "riverbank", "soir": "village_square", "absente": "village_exit",
               "trajets": ["jeanne_exit_to_bench", "jeanne_bench_to_riverbank", "jeanne_riverbank_to_square",
                           "jeanne_square_to_exit"]},
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
        },
        "camera": {
            "orientation_par_defaut": "sud-est (regard vers le nord-ouest), comme le rendu (yaw = -3 PI/4)",
            "elevation_degres": 35.264,
            "regle": "éléments hauts au nord et à l'ouest, lieux importants au sud-est de ce qui est haut; "
                     "transparence ou découpe obligatoire pour un personnage caché derrière un bâtiment, "
                     "un arbre ou le train",
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
        "accroches": ACCROCHES,
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
            {"id": "exit_east_promenade", "nature": "haut du bourg, par la promenade (habitants seulement)",
             "ouverte": False, "point": "village_exit"},
        ],
    }
    for o in OBJETS:
        x0, y0, w, h = emprise_monde(o, TYPES)
        o["rect"] = {"x": x0, "y": y0, "w": w, "h": h}
    carte["infranchissable"] = calculer_infranchissable(carte)

    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    SORTIE.write_text(formater(carte) + "\n", encoding="utf-8")
    print(f"carte écrite: {SORTIE} ({len(OBJETS)} objets, {len(POINTS)} points, {len(ZONES)} zones)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
