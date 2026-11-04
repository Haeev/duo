"""La Petite Ligne 0.13: les régions neuves de la carte agrandie (164 x 78 m).

Appelé par `construire_carte_halte.py --0.13`, qui pose d'abord le bourg du tour 10 tel quel. Conception:
docs/jeux/jeu-1/v0-13-carte.md (lot L1) et v0-13-habitants.md (section 1.3, lot H0). Les coordonnées sont
celles de la carte (x vers l'est, y vers le sud), négatives au nord et à l'ouest de l'ancien bourg: la grille
a une origine (`taille.origine`, x -24, y -30). Les rectangles s'écrivent par leurs cases extrêmes, bornes
comprises (`r(code, x0, y0, x1, y1)`).

Le récit, comme un habitant le raconterait: le vieux village est né sur le coteau de la Côte, au soleil et
hors des crues; l'église Saint-Aubin y domine la vallée, son cimetière derrière le chevet, le presbytère et sa
vigne en contrebas. La voie a coupé la rue de l'Église au pied du coteau (d'où le passage à niveau sans
barrière); au carrefour, le café voisine avec la mairie-école, la forge et la menuiserie travaillent sur la
route, loin des maisons; puis viennent le hameau et sa ferme tournée au midi. À l'ouest, les maisons de la
compagnie, la friche du garde-barrière et le moulin de la Vanne sur son bief. Au-dessus, le bois de la Côte.

Bibliothèque standard uniquement; même résultat à chaque exécution.
"""

from __future__ import annotations

import math
from types import ModuleType

b: ModuleType  # le module de construction (terrain T, peindre, objet, TYPES, POINTS...), posé par `installer`


def installer(module: ModuleType) -> None:
    global b
    b = module


# ---------------------------------------------------------------------------
# Outils de dessin


def r(code: str, x0: int, y0: int, x1: int, y1: int, sauf: str = "") -> None:
    """Rectangle de cases, bornes comprises; `sauf`: codes qu'on ne recouvre pas."""
    for y in range(max(y0, b.OY), min(y1, b.Y_FIN - 1) + 1):
        for x in range(max(x0, b.OX), min(x1, b.X_FIN - 1) + 1):
            if b.T[y][x] not in sauf:
                b.T[y][x] = code


def lit(x: int, y: int) -> str:
    return b.T[y][x] if b.T.dans(x, y) else "X"


def ellipse(cx: float, cy: float, a: float, bb: float, code: str, sauf: str = "") -> list[tuple[int, int]]:
    """Ellipse allongée sur la diagonale nord-ouest et sud-est (demi-axe `a`), `bb` en travers: les clairières
    s'ouvrent dans l'axe de la caméra par défaut (carnet, forêt sous la caméra isométrique)."""
    cases = []
    for y in range(int(cy - a - 1), int(cy + a + 2)):
        for x in range(int(cx - a - 1), int(cx + a + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u, v = (dx + dy) / math.sqrt(2), (dx - dy) / math.sqrt(2)
            if (u / a) ** 2 + (v / bb) ** 2 <= 1 and b.T.dans(x, y) and lit(x, y) not in sauf:
                b.T[y][x] = code
                cases.append((x, y))
    return cases


def sentier(points: list[tuple[float, float]], largeur: float, code: str, sauf: str = "") -> None:
    """Sentier de `largeur` m le long d'une ligne brisée (points en mètres)."""
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) * 4) + 1
        for i in range(n + 1):
            t = i / n
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            demi = largeur / 2
            for y in range(int(math.floor(py - demi)), int(math.floor(py + demi)) + 1):
                for x in range(int(math.floor(px - demi)), int(math.floor(px + demi)) + 1):
                    if abs(x + 0.5 - px) <= demi and abs(y + 0.5 - py) <= demi and b.T.dans(x, y) \
                            and lit(x, y) not in sauf:
                        b.T[y][x] = code


def hachage(a: int, c: int, graine: int) -> float:
    """Tirage déterministe dans [0, 1] (semis de la forêt)."""
    h = (a * 73856093) ^ (c * 19349663) ^ (graine * 83492791)
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 0xFFFFFFFF


def rect(x: int, y: int, w: int, h: int) -> dict:
    return {"x": x, "y": y, "w": w, "h": h}


def rect_inclus(x0: int, y0: int, x1: int, y1: int) -> dict:
    return rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1)


# ---------------------------------------------------------------------------
# Légende et types neufs

# `rendu`: aspect pour le rendu seul (la simulation ne lit que `sol`): sous-bois et sentier de forêt distincts de
# l'herbe et du chemin, bief creusé comme un cours d'eau vive (lot L3).
LEGENDE = {
    "h": {"nom": "sous-bois (litière de feuilles, fougères basses semées par le rendu)", "sol": "grass",
          "franchissable": True, "pas": "herbe", "rendu": "sous_bois"},
    ";": {"nom": "sentier de forêt (terre et feuilles)", "sol": "path", "franchissable": True, "pas": "terre",
          "rendu": "sentier_foret"},
    "c": {"nom": "gravier (allées du cimetière, cour de ferme, allée du parvis)", "sol": "gravel",
          "franchissable": True, "pas": "pierre"},
    "l": {"nom": "terre cultivée (jardins, champs, potager collectif): ni la zone `garden` ni le potager de la "
               "démo", "sol": "dirt", "franchissable": True, "pas": "terre"},
    "f": {"nom": "friche (ronces, souches, cailloux: à défricher)", "sol": "grass", "franchissable": True,
          "pas": "herbe"},
    "v": {"nom": "vigne (terre entre les rangs; les rangs sont des objets)", "sol": "dirt", "franchissable": True,
          "pas": "terre"},
    "e": {"nom": "eau dormante (mare du bois, bassin de la source, mare de la pâture): sans poisson à ce tour",
          "sol": "water", "franchissable": False, "pas": None, "peche": False},
    "k": {"nom": "bief du moulin et canal de fuite (eau vive)", "sol": "water", "franchissable": False,
          "pas": None, "rendu": "bief"},
}


def toit(egout: float, faitage: str) -> dict:
    return {"egout": egout, "faitage": faitage}


# Emprise [le long de la façade, profondeur] à la rotation 0, comme les types d'avant. Les hauteurs à l'égout
# et au faîte sont celles de la conception (7.1): le contrôle de la caméra en dépend, l'artiste 3D les tient.
TYPES = {
    "church": {"categorie": "batiment", "nom": "église Saint-Aubin: nef (égout 7 m, faîte 11 m, faîtage est-ouest), "
               "chœur et chevet à l'est, clocher-porche à l'ouest (20 m à la pointe), portail sud",
               "emprise": [21, 12], "hauteur": 11.0, "toit": toit(7.0, "parallele"),
               # Volumes plus hauts que le toit: [décalage x, décalage y depuis la case nord-ouest, largeur,
               # profondeur, hauteur], à la rotation 0 (le clocher-porche, x 85 à 89, y -15 à -9).
               "tours": [[0, 2, 5, 7, 20.0]],
               "portes": {"porte": 10}, "interieur": True},
    "presbytery_house": {"categorie": "batiment", "nom": "presbytère (deux niveaux, faîtage nord-sud)",
                         "emprise": [7, 7], "hauteur": 7.5, "toit": toit(4.0, "parallele"), "portes": {"porte": 3},
                         "interieur": False},
    "village_house_a": {"categorie": "batiment", "nom": "maison de village à un niveau (sacristain, hameau B)",
                        "emprise": [6, 6], "hauteur": 5.5, "toit": toit(3.0, "parallele"), "portes": {"porte": 2},
                        "interieur": False},
    # Variante aux volets clos et sans pots (`village013.glb`): la maison B du hameau, inhabitée.
    "village_house_a_shuttered": {"categorie": "batiment", "nom": "maison de village à un niveau, volets clos "
                                  "(hameau B, inhabitée)", "emprise": [6, 6], "hauteur": 5.5,
                                  "toit": toit(3.0, "parallele"), "portes": {"porte": 2}, "interieur": False},
    "village_house_b": {"categorie": "batiment", "nom": "maison de hameau à un niveau, glycine (hameau A et C)",
                        "emprise": [6, 6], "hauteur": 5.5, "toit": toit(3.0, "parallele"), "portes": {"porte": 2},
                        "interieur": False},
    "cafe_house": {"categorie": "batiment", "nom": "café de la Côte (deux niveaux, salle du bal à l'étage)",
                   "emprise": [7, 6], "hauteur": 8.5, "toit": toit(6.0, "parallele"), "portes": {"porte": 3},
                   "interieur": True},
    # Grande porte de deux vantaux: un seul s'ouvre au passage (`porte`), l'autre reste un mur (`vantail`).
    "forge_shop": {"categorie": "batiment", "nom": "forge (un niveau, cheminée au nord, grande porte sur la route)",
                   "emprise": [6, 6], "hauteur": 5.5, "toit": toit(3.0, "parallele"),
                   "portes": {"porte": 3, "vantail": 2}, "interieur": True},
    "joinery_shop": {"categorie": "batiment", "nom": "menuiserie de Basile, fermée (atelier, logis attenant vide)",
                     "emprise": [6, 7], "hauteur": 6.0, "toit": toit(3.2, "perpendiculaire"), "portes": {"porte": 2},
                     "interieur": True},
    "farm_house": {"categorie": "batiment", "nom": "logis de la ferme Delmas (deux niveaux, façade au midi)",
                   "emprise": [9, 6], "hauteur": 8.0, "toit": toit(5.0, "parallele"), "portes": {"porte": 4},
                   "interieur": True},
    "farm_barn": {"categorie": "batiment", "nom": "grange-étable (le foin au-dessus des bêtes)", "emprise": [7, 7],
                  "hauteur": 8.0, "toit": toit(4.5, "perpendiculaire"), "portes": {"porte": 3}, "interieur": False},
    "washhouse": {"categorie": "batiment", "nom": "lavoir (toit à un pan bas, ouvert au nord, bassin sur la grève)",
                  "emprise": [5, 3], "hauteur": 3.6, "toit": toit(2.4, "parallele"), "portes": {"porte": 2},
                  "interieur": False},
    "watermill": {"categorie": "batiment", "nom": "moulin de la Vanne (logis de la meunière à l'étage, salle des "
                  "meules au rez-de-chaussée, roue au sud sur le bief)", "emprise": [7, 7], "hauteur": 9.0,
                  "toit": toit(5.5, "perpendiculaire"), "portes": {"porte": 3}, "interieur": True},
    # « rail » dans un nom de type fait dessiner des rails au substitut du rendu (`substituts.ts`): d'où
    # `lineman_house` (le cantonnier) pour les maisons de la compagnie.
    "lineman_house": {"categorie": "batiment", "nom": "maison de cheminots de la compagnie (un niveau et demi)",
                      "emprise": [6, 6], "hauteur": 6.0, "toit": toit(3.2, "parallele"), "portes": {"porte": 3},
                      "interieur": False},
    # Variante aux volets clos (`village013.glb`): la maison de cheminots vide, à l'est.
    "lineman_house_shuttered": {"categorie": "batiment", "nom": "maison de cheminots de la compagnie, volets clos "
                                "(vide)", "emprise": [6, 6], "hauteur": 6.0, "toit": toit(3.2, "parallele"),
                                "portes": {"porte": 3}, "interieur": False},
    "forester_house": {"categorie": "batiment", "nom": "maison forestière (logement de la garde, toit rouge)",
                       "emprise": [6, 6], "hauteur": 6.0, "toit": toit(3.0, "parallele"), "portes": {"porte": 3},
                       "interieur": False},
    # Équipement et décor
    "mill_wheel": {"categorie": "equipement", "nom": "roue du moulin (2,5 m, à aubes), dans le bief contre le pignon "
                   "sud", "emprise": [2, 1], "hauteur": 2.6},
    "crossing_sign": {"categorie": "equipement", "nom": "croix de Saint-André d'un passage à niveau sans barrière",
                      "emprise": [1, 1], "hauteur": 2.6, "occultation": [0.3, 0.0, 2.6]},
    "cemetery_wall": {"categorie": "decor", "nom": "mur du cimetière (1,2 m, pierre et chaperon), tronçon d'un mètre",
                      "emprise": [1, 1], "hauteur": 1.2},
    # Pile d'angle et deux demi-tronçons (vers +X et +Z du modèle): rotation 0 angle nord-ouest, 1 sud-ouest,
    # 2 sud-est, 3 nord-est (`foret013.glb`). Un tronçon droit dans l'angle dépassait dehors de 0,3 m.
    "cemetery_wall_corner": {"categorie": "decor", "nom": "angle du mur du cimetière (pile d'angle)",
                             "emprise": [1, 1], "hauteur": 1.2},
    "cemetery_gate": {"categorie": "equipement", "nom": "grille du cimetière, ouverte le jour (vers l'allée)",
                      "emprise": [2, 1], "hauteur": 1.8, "franchissable": True},
    "grave": {"categorie": "decor", "nom": "tombe (dalle et stèle à l'ouest, pieds à l'est), 4 variantes",
              "emprise": [2, 1], "hauteur": 0.9},
    "cemetery_cross": {"categorie": "decor", "nom": "croix du cimetière sur son socle", "emprise": [1, 1],
                       "hauteur": 3.0, "occultation": [0.5, 0.0, 3.0]},
    "cemetery_tap": {"categorie": "equipement", "nom": "fontaine du cimetière et ses arrosoirs", "emprise": [1, 1],
                     "hauteur": 1.2},
    "oratory": {"categorie": "decor", "nom": "oratoire de la source (pierre claire, statue)", "emprise": [1, 1],
                "hauteur": 2.4, "occultation": [0.9, 0.0, 2.4]},
    "vine_row": {"categorie": "decor", "nom": "rang de vigne sur échalas, tronçon de 3 m", "emprise": [3, 1],
                 "hauteur": 1.5},
    "anvil": {"categorie": "equipement", "nom": "enclume sur son billot (cour de la forge)", "emprise": [1, 1],
              "hauteur": 0.8},
    "plank_stack": {"categorie": "decor", "nom": "pile de planches qui sèchent sous l'auvent", "emprise": [2, 1],
                    "hauteur": 1.0},
    "hand_pump": {"categorie": "equipement", "nom": "pompe à bras des jardins de la Rive", "emprise": [1, 1],
                  "hauteur": 1.4, "occultation": [0.3, 0.0, 1.4]},
    "water_trough": {"categorie": "decor", "nom": "abreuvoir de pierre", "emprise": [2, 1], "hauteur": 0.7},
    "manure_heap": {"categorie": "decor", "nom": "tas de fumier de la cour", "emprise": [2, 2], "hauteur": 1.0},
    "cart": {"categorie": "decor", "nom": "charrette à bras", "emprise": [2, 1], "hauteur": 1.4},
    "stump": {"categorie": "decor", "nom": "souche de la coupe", "emprise": [1, 1], "hauteur": 0.5},
    "fallen_trunk": {"categorie": "decor", "nom": "chablis: tronc couché à scier", "emprise": [3, 1], "hauteur": 0.8},
    "snag_tree": {"categorie": "arbre", "nom": "arbre mort debout (le pic y creuse sa loge)", "emprise": [1, 1],
                  "hauteur": 7.0, "occultation_arbre": {"tronc": [0.5, 0.0, 7.0]}},
    "log_bench": {"categorie": "mobilier", "nom": "tronc couché où l'on s'assoit (clairière du Vieux Chêne)",
                  "emprise": [2, 1], "hauteur": 0.5},
    "postcard_rack": {"categorie": "equipement", "nom": "tourniquet de cartes postales d'Odette", "emprise": [1, 1],
                      "hauteur": 1.7, "occultation": [0.6, 0.0, 1.7]},
    "cafe_table": {"categorie": "mobilier", "nom": "table et chaises de la terrasse du café", "emprise": [1, 1],
                   "hauteur": 0.8},
    "skittles_alley": {"categorie": "sol", "nom": "allée de quilles (planche de 8 m, quilles posées par le jeu)",
                       "emprise": [8, 1], "hauteur": 0.1, "franchissable": True, "sols_permis": ["+"]},
    "field_gate": {"categorie": "equipement", "nom": "barrière de la pâture, ouverte (on s'y accoude)",
                   "emprise": [1, 1], "hauteur": 1.1, "franchissable": True},
    "bilberry_bush": {"categorie": "decor", "nom": "myrtilliers sous les sapins", "emprise": [1, 1], "hauteur": 0.5},
    "holly_bush": {"categorie": "decor", "nom": "houx (la coulée du rond des fées passe entre deux)",
                   "emprise": [1, 1], "hauteur": 1.8},
    # Essences neuves: houppier [côté, base, faîte], comme les chênes et les sapins.
    "tree_beech": {"categorie": "arbre", "nom": "hêtre (bois de la Cure)", "emprise": [1, 1], "hauteur": 9.5,
                   "occultation_arbre": {"tronc": [0.5, 0.0, 2.2], "houppier": [4.6, 2.2, 9.5]}},
    "tree_chestnut": {"categorie": "arbre", "nom": "châtaignier (les châtaignes tombent à son pied)",
                      "emprise": [1, 1], "hauteur": 8.0,
                      "occultation_arbre": {"tronc": [0.5, 0.0, 2.0], "houppier": [4.4, 2.0, 8.0]}},
    "tree_birch": {"categorie": "arbre", "nom": "bouleau (bords de clairière, la coupe)", "emprise": [1, 1],
                   "hauteur": 6.0, "occultation_arbre": {"tronc": [0.3, 0.0, 2.0], "houppier": [2.8, 2.0, 6.0]}},
    "tree_old_oak": {"categorie": "arbre", "nom": "le Vieux Chêne (12 m, repère du bois)", "emprise": [1, 1],
                     "hauteur": 12.0, "occultation_arbre": {"tronc": [1.0, 0.0, 2.6], "houppier": [6.8, 2.6, 12.0]}},
    "tree_pear": {"categorie": "arbre", "nom": "poirier du verger communal", "emprise": [1, 1], "hauteur": 5.0,
                  "occultation_arbre": {"tronc": [0.35, 0.0, 1.6], "houppier": [3.0, 1.6, 5.0]}},
    "tree_plum": {"categorie": "arbre", "nom": "prunier du verger communal", "emprise": [1, 1], "hauteur": 4.5,
                  "occultation_arbre": {"tronc": [0.3, 0.0, 1.5], "houppier": [2.8, 1.5, 4.5]}},
    "tree_cherry": {"categorie": "arbre", "nom": "cerisier du verger communal", "emprise": [1, 1], "hauteur": 6.0,
                    "occultation_arbre": {"tronc": [0.35, 0.0, 1.8], "houppier": [3.4, 1.8, 6.0]}},
    "tree_walnut": {"categorie": "arbre", "nom": "noyer du verger communal", "emprise": [1, 1], "hauteur": 8.0,
                    "occultation_arbre": {"tronc": [0.45, 0.0, 2.0], "houppier": [4.0, 2.0, 8.0]}},
    "tree_lime": {"categorie": "arbre", "nom": "tilleul (au coin de la place et de la cour de la halte)",
                  "emprise": [1, 1], "hauteur": 8.0,
                  "occultation_arbre": {"tronc": [0.5, 0.0, 2.6], "houppier": [3.4, 2.6, 8.0]}},
}

# Triangles au plus des modèles neufs (conception 11.3) et des essences, pour le contrôle par morceau de 12 m.
TRIANGLES = {"tree_oak": 358, "tree_fir": 174, "tree_birch": 366, "tree_beech": 400, "tree_chestnut": 400,
             "tree_old_oak": 900, "tree_apple": 420, "tree_pear": 420, "tree_plum": 420, "tree_cherry": 420,
             "tree_walnut": 420, "tree_lime": 400, "snag_tree": 120}


# ---------------------------------------------------------------------------
# Terrain


def prolonger_bourg() -> None:
    """Ce qui traversait les anciens bords continue: voie, rivière et rive sud à l'ouest et à l'est; les
    anciens bords (x 0 et 1, x 98 et 99, y 0 et 1) deviennent des cases ordinaires (rien à faire: l'anneau
    `X` n'est plus peint là)."""
    neuves = [x for x in b.T.xs if x < 0 or x >= b.LARGEUR]
    for x in neuves:
        for y in range(0, b.HAUTEUR):
            if 12 <= y <= 14:
                c = "="
            elif y == 36:
                c = "b" if x >= b.LARGEUR else "."
            elif y == 37 or y == 43:
                c = "b"
            elif 38 <= y <= 42:
                c = "~"
            elif y >= 44:
                c = "," if b.bruit(x, y, 4) < 65 else "."
            else:
                c = "," if b.bruit(x, y, 13) < 30 else "."
            b.T[y][x] = c
        # Grèves en longues anses, comme le reste de l'Aubrune.
        if math.sin(x / 4.3 + 0.8) > 0.55:
            b.T[38][x] = "b"
        if math.sin(x / 5.1 + 2.6) > 0.6:
            b.T[42][x] = "b"
    # Le nord: le coteau. Bois à l'ouest de x 84 (le bois de la Côte, puis le bois de la Cure au-delà du ru),
    # prés au-dessus du vieux village à l'est.
    for y in range(b.OY, 0):
        for x in b.T.xs:
            b.T[y][x] = "h" if x <= 83 else ("," if b.bruit(x, y, 14) < 45 else ".")
    # L'ancienne rangée d'arbres du bord nord est maintenant l'orée du bois: sous-bois sous ses arbres.
    for y in (0, 1):
        for x in range(b.OX, 84):
            if lit(x, y) in ".,X":
                b.T[y][x] = "h"
    # Le haut de la carte à l'ouest du bourg (y 0 à 11): la lisière ouest descend jusqu'à la voie vers la ville.
    r("h", -22, -2, -11, 7)
    r("h", -10, -2, -4, 0)


def terrain_ouest() -> None:
    """L'amont: le moulin et son bief, les maisons de cheminots, la friche, le parc à grumes, le chemin
    forestier (section 4.4)."""
    # Le bief prend l'eau au bord ouest (amont), passe sous la roue contre le pignon sud du moulin et rend
    # l'eau à l'Aubrune par le canal de fuite. La passerelle de la vanne le passe en amont de la roue.
    r("k", b.OX, 35, -9, 36)
    r("k", -9, 36, -8, 37)
    r("#", -9, 37, -8, 37)                                         # planches du halage sur le canal de fuite
    r("#", -19, 35, -18, 36)
    # Le chemin de la maisonnette (y 27) s'arrêtait au bord: il mène maintenant au moulin, en longeant la friche,
    # et descend à sa porte (façade est). Le chemin des Cheminots le rejoint.
    r(":", -1, 27, 1, 27)
    r(":", -10, 27, -1, 28)
    r(":", -10, 29, -9, 31)
    r(":", -15, 22, -1, 23)
    r(":", -2, 22, -1, 26)
    # La friche du garde-barrière: quatre parcelles de 4 x 3 et l'allée qui les dessert (y 32).
    r("f", -8, 29, -1, 35)
    r(":", -8, 32, -1, 32)
    # Le parc à grumes de Basile, de l'autre côté du chemin forestier.
    r(":", -10, 1, -4, 8)
    # Le chemin forestier: du chemin de la voie (y 11), le long du pignon ouest de la scierie, jusqu'à la coupe et
    # à la maison forestière. Le chemin de la voie se prolonge jusqu'à lui (le chêne du bord, en x 0, y 10, reste).
    r(":", -3, -16, -1, 11)
    r(":", 0, 11, 1, 11)
    r(":", 1, 10, 1, 10)
    r(":", -7, -18, -7, -17)
    r(":", -7, -17, -1, -16)
    # La coupe de Basile, et la coulée de la charbonnière (herbe foulée, sans sol de chemin).
    r(",", -19, -14, -5, -3)
    ellipse(-16.5, -1, 1.6, 1.6, ",")
    sentier([(-14.0, -3.5), (-15.5, -1.5)], 1, ",")


def terrain_nord() -> None:
    """Le bois de la Côte et le bois de la Cure: sentiers en boucle, clairières, mare, source (section 5)."""
    # Le ru remonte jusqu'à sa source, au pied du bassin de la fontaine.
    r("r", 63, -21, 64, -1)
    ellipse(26, -13, 10, 6, ",", sauf="r")                         # clairière du Vieux Chêne
    ellipse(44, -20, 4.8, 3.8, "b")                                # berge de la mare
    ellipse(44, -20, 3.6, 2.6, "e")                                # la mare de la Côte
    ellipse(57, -18, 7, 5, ",", sauf="r")                          # clairière de la source
    r("e", 62, -23, 65, -22)                                       # bassin de la source (la fontaine)
    ellipse(7, -24, 3.6, 2.8, ",")                                 # le belvédère
    ellipse(48.5, -12, 2.0, 2.0, ",")                              # le rond des fées (secret)
    sentier([(40.5, -3.5), (44.0, -8.0), (47.0, -11.0)], 1, ",")   # coulée vers le rond des fées (herbe foulée)
    # Sentiers de forêt (1 m dans la lisière, 2 m dans le bois).
    sentier([(40.5, 9.5), (40.5, 0.5)], 1, ";")                    # sentier de la Côte, dans la lisière
    sentier([(40.0, 0.5), (40.0, -3.0), (34.0, -6.5)], 2, ";")    # sentier de la Côte
    sentier([(-1.0, -16.5), (5.0, -20.0), (7.0, -22.0)], 2, ";")  # sentier des crêtes, embranchement du belvédère
    sentier([(5.0, -20.0), (12.0, -21.0), (19.5, -21.0), (30.0, -21.5), (37.0, -17.5), (44.0, -14.5),
             (51.0, -16.5), (54.5, -18.0)], 2, ";")                # sentier des crêtes (rive sud de la mare)
    sentier([(62.5, 9.5), (62.5, 0.5)], 1, ";", sauf="r")          # sentier du ru, au pied (entre remise et ru)
    sentier([(62.0, 0.5), (61.5, -8.0), (60.0, -13.0)], 2, ";", sauf="r")
    sentier([(-1.0, -10.0), (8.0, -10.5), (16.5, -11.5), (19.5, -12.0)], 2, ";")  # sentier de la coupe
    r("Y", 63, -16, 64, -15)                                       # planche de la Source
    sentier([(65.5, -15.5), (71.0, -12.0), (77.0, -8.0), (83.5, -3.5)], 2, ":", sauf="r")  # chemin de la Procession


def terrain_nord_est() -> None:
    """L'église, le parvis, le presbytère, le cimetière, la vigne, les champs du Haut (sections 4.1 et 4.3)."""
    r("+", 94, -1, 96, 22, sauf="=")                               # rue de l'Église (3 m)
    r("#", 94, 12, 96, 14)                                         # passage à niveau de l'Église (non gardé)
    r("+", 84, -5, 106, 0)                                         # le parvis
    r(":", 83, -3, 83, -1)                                         # du presbytère au parvis
    r("c", 107, -3, 118, -1)                                       # allée du cimetière
    r("c", 108, -20, 124, -4)                                      # le cimetière (allées de gravier)
    r("c", 106, -18, 107, -6)                                      # le tour du chevet, vers la grille ouest
    r("l", 76, 2, 83, 9)                                           # jardin du curé (potager et simples)
    r("l", 87, 9, 92, 10)                                          # jardin de dahlias de Marthe
    r("v", 100, 1, 107, 10)                                        # la vigne du curé
    r("l", 109, 1, 115, 9)                                         # champ du Haut 1
    r("l", 117, 1, 123, 9)                                         # champ du Haut 2
    r(":", 97, 11, 135, 11)                                        # chemin des Champs, le long de la voie
    r(":", 108, 10, 135, 10)
    r(":", 116, 1, 116, 9)                                         # entre les deux champs
    r(":", 108, 0, 128, 0)
    r(":", 127, -20, 128, 9)                                       # chemin de la ferme, aux champs et aux prés
    r(".", 129, -28, 137, -1)                                      # les prés du Haut (réserve)
    r(".", 108, -28, 126, -21)


def terrain_est() -> None:
    """La route des hameaux, les métiers, les jardins, le lavoir, la ferme, le hameau (sections 4.2 et 4.3)."""
    r(":", 87, 21, b.X_FIN - 1, 22)                                # la route des hameaux, jusqu'au bord est
    r("+", 85, 21, 97, 23)                                         # placette du carrefour de l'Église
    r(":", 104, 15, 106, 20)                                       # cour de la forge (à l'est: vue)
    r(":", 115, 15, 117, 20)                                       # cour de la menuiserie
    r(":", 127, 11, 128, 20)                                       # chemin de la ferme vers les champs
    r("#", 127, 12, 128, 14)                                       # passage de la ferme
    r("l", 91, 24, 98, 34)                                         # jardins de la Rive (haie en x 99)
    r(":", 94, 24, 94, 35)                                         # allées en croix
    r(":", 91, 29, 98, 29)
    r(":", 100, 23, 101, 34)                                       # chemin du lavoir
    r("c", 112, 33, 124, 36)                                       # la cour de ferme
    r(":", 123, 23, 124, 32)                                       # chemin de la cour, depuis la route
    r("l", 114, 23, 122, 26)                                       # le courtil
    r(",", 126, 31, 135, 37, sauf="b")                             # la pâture
    ellipse(131, 34, 1.6, 1.4, "e")                                # sa mare


def terrain() -> None:
    prolonger_bourg()
    terrain_ouest()
    terrain_nord()
    terrain_nord_est()
    terrain_est()


# ---------------------------------------------------------------------------
# Objets


def o(type_: str, x0: int, y0: int, rotation: int = 0, ident: str | None = None, **extra: object) -> None:
    """Pose un objet par la case nord-ouest de son emprise (comme `objet` du constructeur)."""
    b.objet(type_, x0, y0, rotation=rotation, ident=ident, **extra)


def file_cloture(cases: list[tuple[int, int]], rotation: int) -> None:
    for x, y in cases:
        o("fence", x, y, rotation=rotation)


def batiments() -> None:
    """Bâtiments neufs (table 7.1), avec leur raison d'être (section 4)."""
    # L'église, orientée: chœur à l'est, clocher-porche à l'ouest (il ne cache que le bois de la Cure, au
    # nord-ouest), portail sud dans l'axe de la rue de l'Église et face à la caméra par défaut.
    o("church", 85, -17, 0, "church")
    # Le presbytère à l'ouest du parvis, porte à l'est: le curé sort de chez lui sur le parvis.
    o("presbytery_house", 76, -5, 1, "presbytery")
    # Le sonneur au pied de l'église, côté ouest de la rue (un volume à l'est d'une rue nord-sud la cache).
    o("village_house_a", 87, 3, 1, "sexton_house")
    # Le carrefour: le café voisin de la mairie-école; la forge et la menuiserie sur la route des charrettes,
    # contre la voie, cour à l'est (au sud-est d'un volume, on est vu).
    o("cafe_house", 87, 15, 0, "cafe")
    # La grande porte de la forge donne sur la route (le cheval qu'on mène au travail ferré, dans la cour à l'est).
    o("forge_shop", 98, 15, 0, "forge")
    o("joinery_shop", 108, 15, 1, "joinery")
    # Le hameau le long de la route, portes au sud sur la route; entre A et B, la cour de soins de Nour et le
    # chemin du passage de la ferme. La maison C en retrait de deux rangées, tournée vers la route.
    o("village_house_b", 118, 15, 0, "hamlet_house_a")
    o("village_house_a_shuttered", 130, 15, 0, "hamlet_house_b")
    o("village_house_b", 128, 25, 2, "hamlet_house_c")
    # La ferme tournée au midi, la cour au sud-est des deux volumes hauts (vue de la caméra par défaut).
    o("farm_barn", 105, 29, 1, "barn")
    o("farm_house", 114, 27, 0, "farmhouse")
    # Le lavoir au bord de l'Aubrune, en aval du bourg; bas, au premier plan, ouvert au nord.
    o("washhouse", 99, 35, 2, "washhouse")
    # L'ouest: le moulin sur son bief (roue au sud), les deux maisons jumelles de la compagnie au bord de la
    # voie, près de la halte; la maison forestière au bout du chemin forestier.
    o("watermill", -17, 28, 1, "mill")
    o("mill_wheel", -14, 35, 1, "mill_wheel")
    o("lineman_house", -15, 16, 0, "rail_cottage_west")
    o("lineman_house_shuttered", -8, 16, 0, "rail_cottage_east")
    o("forester_house", -10, -24, 0, "forester_house")


def eglise_et_cimetiere() -> None:
    # Croix de Saint-André du passage à niveau de l'Église, à droite de qui arrive: au sud, côté est de la rue
    # (on monte); au nord, côté ouest (on descend). Tournées vers qui arrive.
    o("crossing_sign", 97, 15, 0, "crossing_sign_church_south")
    o("crossing_sign", 93, 11, 2, "crossing_sign_church_north")
    # Le passage de la ferme, privé, a les siennes aussi (à droite de qui arrive).
    o("crossing_sign", 129, 15, 0, "crossing_sign_farm_south")
    o("crossing_sign", 126, 11, 2, "crossing_sign_farm_north")
    # Le cimetière derrière le chevet (à l'est: au nord, la nef le cacherait). Mur de 1,2 m sur le pourtour,
    # grille au sud au bout de l'allée de gravier qui vient du parvis.
    x0, y0, x1, y1 = 108, -20, 124, -4
    grille = (117, 118)
    # Les quatre angles: une pile d'angle (rotations du modèle: 0 nord-ouest, 3 nord-est, 1 sud-ouest, 2 sud-est).
    angles = {(x0, y0): 0, (x1, y0): 3, (x0, y1): 1, (x1, y1): 2}
    for x in range(x0, x1 + 1):
        for y in (y0, y1):
            if (x, y) in angles:
                o("cemetery_wall_corner", x, y, angles[(x, y)])
            elif y == y0 or x not in grille:
                o("cemetery_wall", x, y, 0)
    # Une petite grille à l'ouest, face au chevet: on vient du bois et du nord de l'église sans faire le tour
    # du cimetière par l'est (le jeu cherche son chemin case par case: sans elle, il s'y épuise).
    grille_ouest = (-11, -10)
    for y in range(y0 + 1, y1):
        if y not in grille_ouest:
            o("cemetery_wall", x0, y, 1)
        o("cemetery_wall", x1, y, 1)
    # Le côté +Z de la grille (rotation 0) est dehors, vers l'allée où elle s'ouvre (substitut du rendu,
    # `cemetery_gate`): rotation 3 pour celle de l'ouest, tournée vers l'allée du tour du chevet.
    o("cemetery_gate", grille[0], y1, 0, "cemetery_gate")
    o("cemetery_gate", x0, grille_ouest[0], 3, "cemetery_gate_west")
    # Quatre colonnes de tombes (2 m d'ouest en est, pieds à l'est), en groupes de quatre le long des allées
    # nord-sud; allée centrale de 4 m (x 115 à 118) de la grille à la croix.
    nommees = {(110, -18): "grave_cornu", (122, -8): "grave_valade", (119, -17): "grave_ferrand",
               (113, -7): "grave_merigot", (113, -12): "grave_lacombe"}
    for cx in (110, 113, 119, 122):
        for gy in (-19, -14, -9):
            for y in range(gy, gy + 4):
                o("grave", cx, y, 0, nommees.get((cx, y)))
    o("cemetery_cross", 116, -12, 0, "cemetery_cross")
    o("cemetery_tap", 120, -5, 0, "cemetery_tap")
    # Le banc de Marthe et de Martial, au soleil contre le mur sud, tourné vers la croix (au nord).
    o("bench", 115, -5, 2, "cemetery_bench")
    # La vigne du curé: quatre rangs nord-sud sur le coteau au midi, en tronçons de 3 m.
    for x in (100, 102, 104, 106):
        for y in (1, 4, 7):
            o("vine_row", x, y, 1)
    # Le banc du parvis, contre le presbytère, face à l'église (sortie de la messe).
    o("bench", 85, -2, 2, "church_square_bench")
    o("lamp_post", 97, -1, 0, "lamp_church_square")


def carrefour_et_hameau() -> None:
    # La terrasse du café sur la placette, au bord nord de la route; l'allée de quilles devant elle, sans
    # barrer la route (rangée y 23).
    o("cafe_table", 87, 21, 0, "cafe_table_01")
    o("cafe_table", 89, 21, 0, "cafe_table_02")
    o("skittles_alley", 85, 23, 0, "skittles_alley")
    o("lamp_post", 97, 20, 0, "lamp_church_crossroads")
    # La forge: l'enclume du travail courant dans la cour, le travail ferré pour les chevaux.
    o("anvil", 105, 17, 0, "forge_anvil")
    # La menuiserie: les planches sèchent sous l'auvent de la cour.
    o("plank_stack", 116, 15, 1, "joinery_planks")
    # La cour de soins de Nour, à l'est de sa maison: barrière basse côté chemin de la ferme.
    file_cloture([(126, y) for y in range(15, 20)], 1)
    # Le courtil et la cour de ferme: fumier, abreuvoir, charrette; la pâture fermée côté cour, barrière ouverte.
    o("manure_heap", 121, 35, 0, "farm_manure")
    o("water_trough", 112, 36, 0, "farm_trough")
    o("cart", 119, 33, 0, "farm_cart")
    file_cloture([(125, y) for y in (31, 32, 34, 35, 36)], 1)
    # Dans l'axe de la clôture (rotation 1, comme elle): ouverte, elle tourne côté pâture.
    o("field_gate", 125, 33, 1, "pasture_gate")
    for x in (126, 127, 134, 135):
        o("bush", x, 30)
    # Les jardins de la Rive: la pompe au bout ouest de l'allée transversale.
    o("hand_pump", 91, 29, 0, "shared_garden_pump")
    # Le verger communal: trois rangs de trois, à 3 m (pommiers, poiriers, pruniers, un cerisier, un noyer).
    especes = ["tree_apple", "tree_pear", "tree_plum", "tree_pear", "tree_walnut", "tree_apple", "tree_plum",
               "tree_cherry", "tree_apple"]
    n = 0
    for y in (1, 4, 7):
        for x in (130, 133, 136):
            o(especes[n], x, y, 0, f"orchard_tree_{n + 1:02d}")
            n += 1
    # Le tilleul de la place, au coin de la cour de la halte, sur l'herbe (pas sur les pavés).
    o("tree_lime", 50, 24, 0, "square_lime_tree")
    # Le tourniquet de cartes postales d'Odette, devant sa porte, contre la façade.
    o("postcard_rack", 31, 31, 0, "postcard_rack")


def ouest() -> None:
    # Le moulin: sacs de farine près de la porte; le banc de la maison forestière à droite de la porte.
    o("bench", -5, -18, 0, "forester_bench")
    # La coupe de Basile: souches, piles de bois, le chablis à scier.
    for x, y in ((-17, -12), (-14, -10), (-11, -12), (-16, -7), (-8, -9), (-13, -5), (-7, -12)):
        o("stump", x, y)
    o("log_pile", -18, -9, 1, "forest_cut_logs_01")
    o("log_pile", -10, -14, 0, "forest_cut_logs_02")
    o("fallen_trunk", -15, -3, 0, "windfall_trunk")
    o("snag_tree", -19, -4, 0, "woodpecker_snag_tree")
    # Le parc à grumes: les grumes du bois attendent la scie de Basile.
    for x, y in ((-9, 2), (-6, 2), (-9, 5), (-6, 6)):
        o("log_pile", x, y, 0)
    # La charbonnière oubliée, barrée par un tronc couché qu'on porte à deux (la couche dynamique, lot L4,
    # le rend bloquant; posé ici à côté de la coulée, la carte reste atteignable).
    o("fallen_trunk", -13, -2, 0, "charcoal_trunk")
    # Le jardin du garde-barrière: sa haie ouest (x 0) rejoint la clôture du sud (y 36), qui finissait jadis contre
    # le bord de la carte; deux buissons ferment l'angle.
    o("bush", 0, 35, 0, "garden_hedge_corner_01")
    o("bush", 1, 36, 0, "garden_hedge_corner_02")


def foret_lieux() -> None:
    """Lieux du bois (5.2): le Vieux Chêne, l'oratoire, le belvédère, le tronc de la clairière, les houx du rond
    des fées, les hôtes de la cueillette."""
    o("tree_old_oak", 31, -19, 0, "old_oak")
    o("log_bench", 27, -12, 0, "clearing_log")
    o("oratory", 59, -23, 0, "spring_oratory")
    o("bench", 6, -26, 0, "lookout_bench")
    for x, y in ((4, -26), (9, -26), (3, -24)):
        o("rock", x, y)
    o("holly_bush", 44, -10, 0, "fairy_holly_west")
    o("holly_bush", 46, -9, 0, "fairy_holly_east")


# ---------------------------------------------------------------------------
# Points (v0-13-carte.md, 8.1, et v0-13-habitants.md, 1.3)


def occupees() -> dict[tuple[int, int], str]:
    """Cases sous l'emprise d'un objet (sols posés exclus)."""
    occ: dict[tuple[int, int], str] = {}
    for ob in b.OBJETS:
        t = b.TYPES[ob["type"]]
        if t["categorie"] == "sol":
            continue
        x0, y0, w, h = b.emprise_monde(ob, b.TYPES)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                occ[(x, y)] = ob["id"]
    return occ


CHEMINS = ";:+#cqPYj"


def case_proche(x: float, y: float, codes: str, hors_chemin: bool = True, occ: dict | None = None,
                rayon: int = 6) -> tuple[int, int]:
    """La case la plus proche de (x, y) dont le terrain est dans `codes`, libre d'objet et, si demandé, hors des
    chemins (cueillette, champignons: hors des sentiers)."""
    occ = occupees() if occ is None else occ
    meilleure = None
    cx, cy = int(math.floor(x)), int(math.floor(y))
    for yy in range(cy - rayon, cy + rayon + 1):
        for xx in range(cx - rayon, cx + rayon + 1):
            if lit(xx, yy) not in codes or (xx, yy) in occ:
                continue
            if hors_chemin and lit(xx, yy) in CHEMINS:
                continue
            d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
            if meilleure is None or d < meilleure[0]:
                meilleure = (d, xx, yy)
    if meilleure is None:
        raise SystemExit(f"aucune case {codes!r} libre près de ({x}, {y})")
    return meilleure[1], meilleure[2]


def P(ident: str, x: float, y: float, role: str, **extra: object) -> None:
    b.POINTS.append(b.p(ident, x, y, role, **extra))


def points_lieux() -> None:
    imp = {"important": True}
    # L'église (portail sud, nef, corde des cloches), le parvis, le presbytère, le jardin du curé
    P("church_porch", 95.5, -4.5, "devant le portail sud de Saint-Aubin, sur le parvis", objet="church", rotation=2,
      porte_lieu=True, **imp)
    P("church_square", 92.5, -3.0, "le parvis: sortie de la messe, noces, fêtes", rayon=3.0, **imp)
    P("church_inside", 95.5, -7.5, "dans la nef, juste passé le portail (apparition)", objet="church", interieur=True)
    P("church_nave", 95.5, -11.5, "le milieu de la nef, à la croisée de l'allée du portail et de l'allée centrale: le "
      "curé à la messe, la chorale", objet="church", interieur=True, rotation=1)
    P("church_bell_rope", 90.5, -11.5, "la corde des cloches, au fond de la nef, au pied du clocher-porche (la porte "
      "ouest du clocher reste fermée)", objet="church", interieur=True, rotation=3)
    P("church_candles", 100.5, -7.5, "le présentoir de cierges, au bas du chœur côté sud", objet="church",
      interieur=True)
    P("church_harmonium", 100.5, -14.5, "l'harmonium, contre le mur nord (hors messe et chorale)", objet="church",
      interieur=True, rotation=2)
    P("presbytery_door", 83.5, -1.5, "devant la porte du presbytère, au bord du parvis", objet="presbytery",
      rotation=1, **imp)
    P("priest_garden", 79.5, 5.5, "le jardin du curé (potager et simples), sous les fenêtres du presbytère", **imp)
    P("sexton_house_door", 93.5, 6.5, "devant la maison du sacristain, sur la rue de l'Église", objet="sexton_house",
      rotation=1, **imp)
    P("sexton_garden", 89.5, 9.5, "le jardin de dahlias de Marthe, au sud de sa maison, plein sud")
    P("vineyard", 106.5, 10.5, "au bas de la vigne du curé, au bout des rangs (entre eux, on n'y voit plus "
      "qu'une tête)", **imp)
    P("weathervane", 91.5, -3.5, "sur le parvis, d'où l'on voit le coq du clocher (la girouette)", rotation=2)
    # Le cimetière
    P("cemetery_gate", 118.0, -2.5, "devant la grille du cimetière, au bout de l'allée du parvis",
      objet="cemetery_gate", rotation=2, **imp)
    P("cemetery_cross", 116.5, -10.5, "au pied de la croix du cimetière, dans l'allée centrale", **imp)
    P("cemetery_tap", 120.5, -5.5, "la fontaine et les arrosoirs, contre le mur sud, à 2 m à l'est de la grille",
      objet="cemetery_tap", portee=1.5)
    P("cemetery_bench", 116.0, -4.5, "le banc du cimetière, au soleil contre le mur sud, tourné vers la croix",
      objet="cemetery_bench", portee=1.5)
    P("grave_lacombe", 115.5, -11.5, "la tombe des Lacombe, près de la croix (les parents de Firmin et une place "
      "vide sur la plaque)", objet="grave_lacombe", rotation=3)
    P("grave_cornu", 109.5, -17.5, "la tombe d'Hortense Cornu, rang ouest", objet="grave_cornu", rotation=1)
    P("grave_ferrand", 121.5, -16.5, "la tombe des Ferrand, rang est", objet="grave_ferrand", rotation=3)
    P("grave_merigot", 112.5, -6.5, "la tombe d'Eugénie Mérigot, près de la grille", objet="grave_merigot",
      rotation=1)
    P("grave_valade", 121.5, -7.5, "la tombe d'Octave Valade, rang est", objet="grave_valade", rotation=1)
    P("grave_row_east", 121.5, -12.5, "l'allée des rangs est du cimetière", **imp)
    # Le carrefour de l'Église
    P("cafe_door", 90.5, 21.5, "devant le café de la Côte, sur la placette", objet="cafe", rotation=2,
      porte_lieu=True, **imp)
    P("cafe_terrace", 88.5, 21.5, "la terrasse du café, entre ses deux tables", **imp)
    P("cafe_inside", 90.5, 19.5, "dans la salle du café, juste passé la porte (apparition)", objet="cafe",
      interieur=True)
    P("cafe_counter", 90.5, 17.5, "le comptoir du café (contre le mur nord): Colette derrière, on y boit son café",
      objet="cafe", interieur=True, rotation=2)
    P("skittles_alley", 88.5, 23.5, "l'allée de quilles de la placette, devant la terrasse", objet="skittles_alley")
    P("forge_door", 101.5, 21.5, "devant la grande porte de la forge, sur la route (le logis est sous le toit)",
      objet="forge", rotation=2, porte_lieu=True, **imp)
    P("forge_yard", 105.0, 20.0, "la cour de la forge, au bord de la route: l'enclume, le travail ferré", **imp)
    P("forge_entry", 101.5, 19.5, "dans l'atelier de la forge, juste passé la porte (apparition)", objet="forge",
      interieur=True)
    P("forge_inside", 100.5, 17.5, "devant le foyer et le soufflet, sous la cheminée", objet="forge",
      interieur=True, rotation=2)
    P("joinery_door", 115.5, 18.5, "devant la porte de la menuiserie (fermée depuis la mort d'Hortense)",
      objet="joinery", rotation=3, **imp)
    P("joinery_yard", 116.0, 20.0, "la cour de la menuiserie, sous l'auvent des planches", **imp)
    P("joinery_inside", 112.5, 18.5, "dans l'atelier de la menuiserie (apparition)", objet="joinery", interieur=True)
    P("hamlet_house_a_door", 120.5, 21.5, "devant la maison A du hameau (Nour, l'ancienne maison du notaire)",
      objet="hamlet_house_a", rotation=2, **imp)
    P("vet_yard", 124.5, 17.5, "la cour de soins de Nour, à l'est de sa maison, barrière basse côté chemin")
    P("hamlet_house_b_door", 132.5, 21.5, "devant la maison B du hameau (volets clos)", objet="hamlet_house_b",
      rotation=2)
    P("hamlet_house_c_door", 131.5, 24.5, "devant la maison C du hameau (Honorine), tournée vers la route",
      objet="hamlet_house_c", rotation=0, **imp)
    P("honorine_doorstep", 130.4, 24.5, "la chaise d'Honorine sous la glycine, à droite de sa porte vue de la route",
      rotation=0)
    P("honorine_window", 132.5, 25.3, "la fenêtre d'Honorine, sur la route", objet="hamlet_house_c", portee=1.5,
      dans_batiment=True, rotation=0)
    # Jardins, lavoir, ferme, champs, verger
    P("shared_garden_pump", 92.5, 29.5, "à côté de la pompe des jardins de la Rive", objet="shared_garden_pump",
      **imp)
    P("shared_garden_plot", 92.5, 25.5, "dans un carré des jardins de la Rive", **imp)
    P("washhouse", 101.5, 34.5, "devant le lavoir, au bout du chemin", objet="washhouse", rotation=2, **imp)
    P("barn_door", 112.5, 32.5, "devant la porte de l'étable", objet="barn", rotation=3, **imp)
    P("farm_door", 118.5, 33.5, "devant le logis de la ferme, sur la cour", objet="farmhouse", rotation=2,
      porte_lieu=True, **imp)
    P("farm_inside", 118.5, 31.5, "dans la salle commune de la ferme (apparition)", objet="farmhouse",
      interieur=True)
    P("farmyard", 117.0, 35.0, "la cour de ferme", rayon=2.0, **imp)
    P("farm_garden", 118.5, 24.5, "le courtil de la ferme, entre la route et le logis")
    P("threshing_floor", 113.5, 34.5, "l'aire de battage, à l'ouest de la cour, devant la grange")
    P("pasture_gate", 125.5, 33.5, "la barrière de la pâture (on s'y accoude, les vaches approchent)",
      objet="pasture_gate", **imp)
    P("pasture_bank", 133.5, 37.5, "la berge au bout de la pâture: le coin de pêche de Léon", rotation=0)
    P("field_high_01", 111.5, 4.5, "le champ du Haut 1 (celui de Paulin)", **imp)
    P("field_high_02", 120.5, 4.5, "le champ du Haut 2 (à louer)", **imp)
    P("orchard", 131.5, 8.5, "au bas du verger communal", **imp)
    # L'ouest
    P("mill_door", -9.5, 31.5, "devant la porte du moulin (façade est)", objet="mill", rotation=1, porte_lieu=True,
      **imp)
    P("mill_entry", -12.5, 31.5, "dans la salle des meules, juste passé la porte (apparition)", objet="mill",
      interieur=True)
    P("mill_inside", -13.5, 31.5, "la salle des meules: les meules, la trémie, les sacs", objet="mill",
      interieur=True, rotation=3)
    P("mill_yard", -9.5, 33.5, "la cour du moulin, devant la porte")
    P("mill_race_bank", -14.5, 37.5, "la rive du bief, face à la roue (par la passerelle de la vanne)", rotation=2)
    P("mill_sluice", -18.5, 34.5, "la vanne du bief, en amont de la roue (on la lève à deux)", **imp)
    P("rail_cottage_west_door", -11.5, 22.5, "devant la maison de cheminots ouest (Ambroise)",
      objet="rail_cottage_west", rotation=0, **imp)
    P("rail_cottage_west_window", -13.5, 21.2, "l'établi d'Ambroise derrière la fenêtre sud, vu du chemin",
      objet="rail_cottage_west", portee=1.5, dans_batiment=True, rotation=0)
    P("rail_cottage_east_door", -4.5, 22.5, "devant la maison de cheminots est (vide)", objet="rail_cottage_east",
      rotation=0, **imp)
    for n, (x, y) in enumerate(((-6.5, 30.5), (-2.5, 30.5), (-6.5, 34.5), (-2.5, 34.5)), start=1):
        P(f"wild_plot_{n:02d}", x, y, f"friche: parcelle à défricher {n}", **imp)
    P("log_yard", -6.5, 9.5, "au bord du parc à grumes de Basile", **imp)
    P("forest_cut", -12.0, -8.5, "la coupe de Basile: souches, piles, arbres marqués", rayon=2.0, **imp)
    P("charcoal_kiln", -8.5, -4.5, "la meule de Barnabé, au bord sud de la coupe, à plus de 6 m de tout arbre")
    P("forester_house_door", -6.5, -17.5, "devant la maison forestière", objet="forester_house", rotation=0, **imp)
    P("forester_bench", -4.0, -17.5, "le banc devant la maison forestière, à droite de la porte",
      objet="forester_bench", portee=1.5)
    # Le bois de la Côte
    P("lookout", 6.5, -24.5, "le belvédère: la vue sur la vallée, le banc gravé", **imp)
    P("old_oak", 31.5, -16.0, "au pied du Vieux Chêne, au bord nord-est de la clairière", **imp)
    P("clearing_center", 27.5, -12.5, "le tronc couché de la clairière du Vieux Chêne", objet="clearing_log",
      portee=1.5, **imp)
    P("forest_pond", 44.5, -15.5, "la mare de la Côte, depuis sa rive sud (le sentier des crêtes)", **imp)
    P("bird_hide", 40.5, -19.5, "la cabane des oiseaux, rive ouest de la mare (bâtie par la quête de Jeanne)")
    P("spring", 61.5, -21.5, "la source du ru, au bord du bassin de la fontaine", **imp)
    P("spring_oratory", 59.5, -21.5, "devant l'oratoire de la source", objet="spring_oratory", **imp)
    P("forest_edge_path", 40.5, 9.5, "le départ du sentier de la Côte, à la lisière", **imp)
    P("fairy_ring", 48.5, -12.0, "secret: le rond des fées (vers luisants au crépuscule), au bout d'une coulée "
      "entre deux houx", secret=True)
    P("charcoal_pit", -16.5, -1.0, "secret: la charbonnière oubliée (celle du grand-père de Barnabé), derrière un "
      "tronc couché", secret=True)
    # Le bourg ancien: points demandés par les plannings (1.3)
    P("square_lime_tree", 49.6, 24.6, "sous le tilleul, au coin de la place et de la cour de la halte")
    P("lucie_garden", 86.5, 29.5, "le jardinet de Lucie, à l'est de sa maison, devant ses pommiers")
    # La cour murée est un enclos du modèle de l'école (bloqué): on la regarde du portail, d'où l'on voit les élèves.
    P("school_yard", 77.5, 21.4, "devant le portail, d'où l'on voit la cour de l'école", objet="school_yard",
      rotation=2)
    # La mairie-école touche le café à l'est (mitoyens): la porte du logement du maître est sur la route.
    P("school_lodging_door", 85.5, 21.5, "la porte du logement du maître, sur la route, à côté de celle de la "
      "mairie", objet="school_house", rotation=2)
    # L'école-mairie ne se visite pas encore: le secrétaire de mairie se tient à sa porte ouverte.
    P("mairie_desk", 82.9, 21.5, "à la porte ouverte de la mairie (le bureau, quand l'intérieur existera)",
      objet="school_house", rotation=2)
    P("postcard_rack", 31.5, 31.5, "le tourniquet de cartes postales d'Odette, devant sa porte",
      objet="postcard_rack", portee=1.5)


def points_ecriteaux() -> None:
    """Écriteaux qui révèlent des habitudes quand on les lit (habitants, 4.4): devant le mur qui les porte."""
    for ident, x, y, objet_, role in (
        ("grocery_sign", 31.5, 29.5, "ferrand_shop", "l'écriteau des heures, à côté de la porte de l'épicerie"),
        ("bakery_sign", 71.5, 21.5, "bakehouse", "l'ardoise du guichet du fournil"),
        ("salon_sign", 75.5, 27.5, "salon_shop", "l'écriteau de la porte de la mercerie"),
        ("school_sign", 76.5, 21.5, "school_yard", "la plaque des heures de classe, au portail de l'école"),
        ("mairie_sign", 82.5, 21.5, "school_house", "la plaque des heures de la mairie, à côté de sa porte"),
        ("mairie_poster", 81.5, 21.5, "school_house", "le panneau d'affichage de la mairie (une affiche par "
         "semaine)"),
        ("church_sign", 94.5, -4.5, "church", "le tableau des offices, à côté du portail"),
        ("cafe_sign", 91.5, 21.5, "cafe", "l'ardoise du café (heures, manille du mercredi, quilles du dimanche)"),
        ("forge_sign", 102.5, 21.5, "forge", "l'écriteau de la forge, à côté de la grande porte"),
        ("vet_sign", 121.5, 21.5, "hamlet_house_a", "la plaque de la vétérinaire (l'ancienne plaque du notaire "
         "dessous)"),
        ("clockmaker_sign", -14.5, 22.5, "rail_cottage_west", "l'écriteau d'Ambroise sous sa fenêtre: horloger, "
         "cordonnier"),
    ):
        P(ident, x, y, role, objet=objet_, ecriteau=True)
    P("church_sign_bells", 90.5, -10.5, "l'écriteau des sonneries, au pied du clocher dans la nef", objet="church",
      interieur=True, ecriteau=True)


def points_vie() -> None:
    """Gestes avec le décor (habitants, 7.1): tas de feuilles, flaques; la faune du bois (5.4)."""
    P("leaf_pile_square", 50.5, 25.5, "tas de feuilles sous le tilleul (automne): on saute dedans",
      geste="leaf_pile")
    P("leaf_pile_edge", 41.5, 8.5, "tas de feuilles à la lisière, au départ du sentier de la Côte (automne)",
      geste="leaf_pile")
    for n, (x, y, ou) in enumerate(((18.5, 31.5, "la route du gué"), (40.5, 34.5, "la promenade de l'Aubrune"),
                                    (110.5, 21.5, "la route des hameaux"), (-2.0, 4.5, "le chemin forestier"),
                                    (127.5, 5.5, "le chemin de la ferme")), start=1):
        P(f"puddle_{n:02d}", x, y, f"flaque de {ou} (par temps de pluie)", geste="puddle_jump")
    faune = (
        ("roe_deer_clearing", 21.5, -8.5, "les chevreuils de la clairière, à l'aube"),
        ("squirrel_old_oak", 30.5, -17.5, "l'écureuil du Vieux Chêne"),
        ("woodpecker_snag", -18.5, -2.5, "le pic de l'arbre mort, au bord de la coupe"),
        ("boar_wallow", 39.5, -20.5, "la souille des sangliers, rive ouest de la mare (traces le matin)"),
        ("salamander_spring", 60.5, -19.5, "les salamandres de la source, après la pluie"),
        ("frogs_pond", 47.5, -17.5, "les grenouilles de la mare, les soirs de printemps"),
        ("fox_den_lookout", 3.5, -22.5, "le terrier du renard, sous les rochers du belvédère"),
        ("bats_church", 93.5, -2.5, "les chauves-souris autour du clocher, au crépuscule (vues du parvis)"),
        ("hedgehog_priest_garden", 84.5, 6.5, "le hérisson du muret du jardin du curé"),
    )
    for ident, x, y, role in faune:
        P(ident, x, y, role, faune=True)
    P("owl_belfry", 85.5, -12.0, "l'effraie du clocher, à la nuit (on la voit depuis le pied du clocher)",
      faune=True, objet="church", portee=1.5, z=17.0)


# Cueillette du bois (5.3): famille, cible approchée, hôte (type posé juste au nord du coin, d'où l'on cueille).
CUEILLETTE = [
    ("forage_wood_01", "mûres, bord sud de la coupe", (-9.5, -1.5), "bramble"),
    ("forage_wood_02", "framboises, bord nord de la coupe", (-6.5, -13.5), "bramble"),
    ("forage_wood_03", "mûres, bord ouest de la clairière", (17.5, -13.5), "bramble"),
    ("forage_wood_04", "framboises, bord ouest de la clairière", (20.5, -18.5), "bramble"),
    ("forage_wood_05", "noisettes, le long du sentier des crêtes", (11.5, -17.5), "bush_hazel"),
    ("forage_wood_06", "noisettes, le long du sentier des crêtes", (17.5, -17.5), "bush_hazel"),
    ("forage_wood_07", "châtaignes, au-dessus du sentier des crêtes", (14.5, -25.5), "tree_chestnut"),
    ("forage_wood_08", "châtaignes, au-dessus du sentier de la coupe", (3.5, -13.5), "tree_chestnut"),
    ("forage_wood_09", "myrtilles, sous les sapins de l'ouest", (-11.5, -15.5), "bilberry_bush"),
    ("forage_wood_10", "myrtilles, sous les sapins de l'ouest", (4.5, -12.5), "bilberry_bush"),
    ("forage_wood_11", "fraises des bois, dans la clairière", (24.5, -15.5), None),
    ("forage_wood_12", "fraises des bois, dans la clairière", (29.5, -10.5), None),
    ("forage_wood_13", "ail des ours, au bord de la source", (55.5, -19.5), None),
    ("forage_wood_14", "cresson, au bord du bassin de la source", (61.5, -20.5), None),
]
CHAMPIGNONS = [
    ("mushroom_01", "cèpes, sous les chênes du bord ouest de la clairière", (17.5, -17.5)),
    ("mushroom_02", "cèpes, sous les chênes du bord est de la clairière", (35.5, -10.5)),
    ("mushroom_03", "cèpes, sous les hêtres du bois de la Cure", (70.5, -21.5)),
    ("mushroom_04", "cèpes, sous les hêtres du bois de la Cure", (79.5, -15.5)),
    ("mushroom_05", "girolles, sous les bouleaux de la coupe", (-18.5, -12.5)),
    ("mushroom_06", "girolles, sous les bouleaux de la coupe", (-8.5, -13.5)),
    ("mushroom_07", "trompettes, dans la mousse de la source", (53.5, -15.5)),
    ("mushroom_08", "trompettes, dans la mousse de la source", (58.5, -14.5)),
]
BOIS_MORT = [
    ("deadwood_01", "branches tombées le long du chemin forestier", (-4.5, -5.5)),
    ("deadwood_02", "branches tombées le long du sentier de la coupe", (10.5, -12.5)),
    ("deadwood_03", "branches tombées le long du sentier des crêtes", (33.5, -22.5)),
    ("deadwood_04", "branches tombées le long du sentier de la Côte", (41.5, -4.5)),
    ("deadwood_05", "branches tombées le long du sentier du ru", (59.5, -5.5)),
    ("deadwood_06", "branches tombées le long du chemin de la Procession", (71.5, -14.5)),
    ("deadwood_07", "branches tombées le long du sentier des crêtes", (49.5, -18.5)),
    ("deadwood_08", "le chablis de la coupe, à scier", (-14.5, -4.5)),
]


def cueillette() -> None:
    """Coins de cueillette, champignons et bois mort, posés par règle: une case franchissable hors des sentiers;
    l'hôte (ronce, noisetier, châtaignier, myrtillier) sur la case au nord du coin, à 1 m (portée de 1,6 m)."""
    # Les arbres hôtes en dernier: ils évitent les cônes de caméra des coins déjà posés.
    for ident, role, (x, y), hote in sorted(CUEILLETTE, key=lambda e: e[3] == "tree_chestnut"):
        if hote is None:
            cx, cy = case_proche(x, y, ",h")
            P(ident, cx + 0.5, cy + 0.5, f"cueillette: {role}", cueillette="bois", important=True)
            continue
        occ = occupees()
        # L'hôte ne pousse pas dans le cône de caméra d'un autre lieu (le sien est derrière lui).
        cones = interdits_foret(sauf=ident) if b.TYPES[hote]["categorie"] == "arbre" else set()
        meilleur = None
        # Un arbre hôte (châtaignier): le coin à 3 m au sud du tronc, hors du houppier (vu de la caméra par
        # défaut); un buisson hôte: juste au nord du coin, à portée de la main.
        dh = 3 if b.TYPES[hote]["categorie"] == "arbre" else 1
        for yy in range(int(y) - 5, int(y) + 6):
            for xx in range(int(x) - 5, int(x) + 6):
                if lit(xx, yy) not in ",h" or lit(xx, yy - dh) not in "h," or (xx, yy) in occ or (xx, yy - dh) in occ:
                    continue
                if yy - dh < b.OY + b.BORD + 1 or xx < b.OX + b.BORD + 1 or (xx, yy - dh) in cones:
                    continue  # pas d'hôte dans l'anneau du décor lointain, ni devant un autre lieu
                if any(lit(xx + dx, yy - dh + dy) in CHEMINS for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                    continue
                d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
                if meilleur is None or d < meilleur[0]:
                    meilleur = (d, xx, yy)
        if meilleur is None:
            raise SystemExit(f"{ident}: aucune place pour le coin et son hôte près de ({x}, {y})")
        _, cx, cy = meilleur
        hid = f"{ident}_host"
        o(hote, cx, cy - dh, 0, hid)
        P(ident, cx + 0.5, cy + 0.5, f"cueillette: {role}", cueillette="bois", hote=hid, important=True)
    for liste, cle in ((CHAMPIGNONS, "champignon"), (BOIS_MORT, "bois_mort")):
        for ident, role, (x, y) in liste:
            cx, cy = case_proche(x, y, ",hf")
            P(ident, cx + 0.5, cy + 0.5, role, **{cle: True})


# ---------------------------------------------------------------------------
# La forêt: cônes de la caméra, objets déplacés, semis


def cone(px: float, py: float, sens: tuple[int, int], longueur: float = 10.0, demi: float = 3.2) -> set:
    """Cases d'un cône de caméra (sud-est par défaut) devant un lieu: aucun tronc n'y pousse, ce qui garde le
    houppier hors du rayon du buste (carnet: clairières sur la diagonale)."""
    cases = set()
    for k10 in range(5, int(longueur * 10) + 5, 5):
        k = k10 / 10
        n = int(demi / 0.4)
        for i in range(-n, n + 1):
            d = i * 0.4
            x = px + sens[0] * k + d * sens[1] / math.sqrt(2)
            y = py + sens[1] * k - d * sens[0] / math.sqrt(2)
            cases.add((int(math.floor(x)), int(math.floor(y))))
    return cases


def interdits_foret(sauf: str | None = None) -> set:
    """Cases où aucun arbre ne pousse: cônes sud-est et nord-ouest des lieux importants du bois (le belvédère, trop
    près du bord nord, n'a que celui du sud-est), abords des points, meule de Barnabé (6 m)."""
    res: set = set()
    for pt in b.POINTS:
        if pt["id"] == sauf:
            continue
        x, y = pt["x"], pt["y"]
        cx, cy = int(math.floor(x)), int(math.floor(y))
        res |= {(cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
        if pt.get("important") and y < 9 and x < 84:
            res |= cone(x, y, (1, 1))
            # Les coins de cueillette (petits lieux, nombreux) n'ont que le sud-est et le sud-ouest: avec le
            # nord-ouest aussi, leurs cônes videraient le bois.
            # Près des bords nord et ouest, la forêt du pourtour cache déjà le nord-ouest: pas de cône inutile.
            loin_des_bords = y >= b.OY + b.BORD + 12 and x >= b.OX + b.BORD + 12
            if loin_des_bords and pt.get("cueillette") != "bois":
                res |= cone(x, y, (-1, -1))
            # Une seconde orientation dégagée au moins: le sud-ouest, quand le nord-ouest bute sur le bord.
            res |= cone(x, y, (-1, 1), longueur=8.0, demi=1.6)
    kx, ky = -8.5, -4.5
    res |= {(x, y) for x in range(-15, -1) for y in range(-11, 2) if math.hypot(x + 0.5 - kx, y + 0.5 - ky) < 6.5}
    return res


def arbres_poses() -> list[tuple[float, float, str]]:
    return [(ob["x"], ob["y"], ob["type"]) for ob in b.OBJETS if b.TYPES[ob["type"]]["categorie"] == "arbre"]


def morceau(x: float, y: float) -> tuple[int, int]:
    """Morceau de 12 m du rendu (ADR 0016), aligné sur l'origine du monde."""
    return int(math.floor(x / 12)), int(math.floor(y / 12))


MAX_ARBRES_MORCEAU = 12
MAX_TRIANGLES_MORCEAU = 4500
ESPACEMENT = 2.6


class Semis:
    def __init__(self) -> None:
        self.occ = occupees()
        self.interdits = interdits_foret()
        self.arbres = arbres_poses()
        self.par_morceau: dict[tuple[int, int], list[int]] = {}
        for x, y, t in self.arbres:
            m = self.par_morceau.setdefault(morceau(x, y), [0, 0])
            m[0] += 1
            m[1] += TRIANGLES.get(t, 400)
        bats = [ob for ob in b.OBJETS if b.TYPES[ob["type"]]["categorie"] == "batiment"]
        self.pres_bati = set()
        for ob in bats:
            x0, y0, w, h = b.emprise_monde(ob, b.TYPES)
            self.pres_bati |= {(x, y) for x in range(x0 - 2, x0 + w + 2) for y in range(y0 - 2, y0 + h + 2)}

    def possible(self, x: int, y: int, t: str, ignorer: tuple[float, float] | None = None,
                 codes: str = "h") -> bool:
        if lit(x, y) not in codes or (x, y) in self.occ or (x, y) in self.interdits or (x, y) in self.pres_bati:
            return False
        if any(lit(x + dx, y + dy) in CHEMINS + "rekbX=" for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            return False
        cx, cy = x + 0.5, y + 0.5
        if any(abs(ax - cx) < ESPACEMENT and abs(ay - cy) < ESPACEMENT and (ax, ay) != ignorer
               for ax, ay, _ in self.arbres):
            return False
        m = self.par_morceau.get(morceau(cx, cy), [0, 0])
        return m[0] < MAX_ARBRES_MORCEAU and m[1] + TRIANGLES.get(t, 400) <= MAX_TRIANGLES_MORCEAU

    def compter(self, x: float, y: float, t: str, signe: int = 1) -> None:
        m = self.par_morceau.setdefault(morceau(x, y), [0, 0])
        m[0] += signe
        m[1] += signe * TRIANGLES.get(t, 400)

    def poser(self, x: int, y: int, t: str) -> None:
        self.arbres.append((x + 0.5, y + 0.5, t))
        self.occ[(x, y)] = t
        self.compter(x + 0.5, y + 0.5, t)


# Objets du bourg du tour 10 pris dans une emprise, un chemin ou un cône neufs (conception, section 12): mêmes
# identifiants, autre place. Une case précise quand la conception la donne, sinon une région où les poser.
DEPLACES_A = {
    "bush_08": ((0, 29), "sur le chemin du moulin (x 2, y 27): rejoint la haie ouest du jardin (x 0)"),
    "bush_31": ((41, 9), "sur le départ du sentier de la Côte (x 40)"),
    "bush_46": ((97, 16), "dans l'emprise de la forge: entre la rue de l'Église et la forge"),
    "bush_48": ((97, 19), "dans l'emprise de la forge: entre la rue de l'Église et la forge"),
    "bush_87": ((73, 9), "dans le jardin du curé: au pied du coteau, à l'ouest du jardin"),
    "bush_88": ((86, 10), "dans le jardin de dahlias du sacristain: à l'ouest du jardin"),
    "bush_89": ((86, 2), "sur la rue de l'Église: au pied du coteau, à l'ouest de la maison du sacristain"),
    "bush_90": ((103, 25), "dans les jardins de la Rive: dans le pré à l'est du chemin du lavoir"),
    "bush_91": ((104, 28), "dans les jardins de la Rive: dans le pré à l'est du chemin du lavoir"),
    "rock_14": ((102, 30), "dans les jardins de la Rive: dans le pré à l'est du chemin du lavoir"),
}
DEPLACES_DANS = {
    # L'ancienne rangée d'arbres du bord nord, prise par le presbytère, le parvis, la rue de l'Église ou le cône
    # de la caméra du portail: à la lisière du bois de la Cure.
    **{i: ((65, -26, 83, -2), "pris par le presbytère, le parvis ou la rue de l'Église: lisière du bois de la Cure")
       for i in ("tree_oak_32", "tree_oak_33", "tree_oak_34", "tree_fir_21", "tree_oak_35", "tree_fir_22",
                 "tree_fir_23", "tree_oak_38", "tree_oak_39")},
    **{i: ((65, -26, 83, -2), "dans le cône de la caméra du portail de l'église: lisière du bois de la Cure")
       for i in ("tree_oak_36", "tree_oak_37", "tree_oak_40")},
    "tree_oak_26": ((66, 2, 74, 9), "dans le jardin du curé: au pied du coteau, à l'ouest"),
    "tree_fir_17": ((66, 2, 74, 9), "dans le jardin du curé: au pied du coteau, à l'ouest"),
    "tree_fir_18": ((64, 2, 75, 10), "dans la maison du sacristain: au pied du coteau, à l'ouest du jardin du "
                    "curé"),
    "tree_oak_27": ((64, 2, 75, 10), "son houppier passait dans le toit de la maison du sacristain: au pied du "
                    "coteau, à l'ouest du jardin du curé"),
    "tree_oak_28": ((64, 2, 75, 10), "sur la rue de l'Église: au pied du coteau, à l'ouest du jardin du curé"),
    "tree_fir_08": ((36, -6, 46, -1), "sur le sentier de la Côte: dans le bois, au nord"),
    "tree_fir_13": ((56, -6, 60, -1), "sur le sentier du ru: dans le bois, à l'ouest du sentier"),
}


def deplacer() -> list[dict]:
    """Déplace les objets listés (identifiants gardés) et rend la liste pour `agrandissement.deplaces`."""
    par_id = {ob["id"]: ob for ob in b.OBJETS}
    journal = []
    for ident, ((x0, y0), raison) in DEPLACES_A.items():
        ob = par_id[ident]
        avant = (ob["x"], ob["y"])
        w, h = b.taille_monde(b.TYPES[ob["type"]], ob["rotation"])
        ob["x"], ob["y"] = x0 + w / 2, y0 + h / 2
        journal.append({"id": ident, "de": list(avant), "a": [ob["x"], ob["y"]], "raison": raison})
    semis = Semis()
    for ident, ((x0, y0, x1, y1), raison) in DEPLACES_DANS.items():
        ob = par_id[ident]
        avant = (ob["x"], ob["y"])
        semis.compter(avant[0], avant[1], ob["type"], -1)
        semis.arbres = [a for a in semis.arbres if (a[0], a[1]) != avant]
        place = None
        # La région prévue, sinon la lisière du bois de la Cure (la place y est large).
        for (rx0, ry0, rx1, ry1) in ((x0, y0, x1, y1), (65, -26, 83, -2)):
            for y in range(ry1, ry0 - 1, -1):
                for x in range(rx0, rx1 + 1):
                    if semis.possible(x, y, ob["type"], codes=".,h"):
                        place = (x, y)
                        break
                if place:
                    break
            if place:
                break
        if place is None:
            raise SystemExit(f"{ident}: aucune place dans {(x0, y0, x1, y1)}")
        ob["x"], ob["y"] = place[0] + 0.5, place[1] + 0.5
        semis.poser(place[0], place[1], ob["type"])
        journal.append({"id": ident, "de": list(avant), "a": [ob["x"], ob["y"]], "raison": raison})
    return journal


def essence(x: int, y: int) -> str:
    """Hautes essences au nord et à l'ouest des clairières, bouleaux sur les bords: sapins, bouleaux et châtaigniers
    à l'ouest; chênes, bouleaux et sapins dans le bois de la Côte; hêtres au bois de la Cure (est du ru)."""
    if x < 12:
        return ["tree_fir", "tree_fir", "tree_birch", "tree_chestnut"][int(hachage(x, y, 11) * 4) % 4]
    if x < 63:
        return ["tree_oak", "tree_oak", "tree_oak", "tree_birch", "tree_fir"][int(hachage(x, y, 11) * 5) % 5]
    return ["tree_beech", "tree_beech", "tree_beech", "tree_oak"][int(hachage(x, y, 11) * 4) % 4]


def semer_foret() -> int:
    """Le bois de la Côte, le bois de la Cure et la lisière ouest: un arbre tiré par hachage, à 2,6 m au moins des
    autres, jamais à moins d'une case d'un sentier, hors des cônes de la caméra et de la lisière à couper (ses 12
    arbres restent ceux de la démo); au plus 12 arbres et 4 500 triangles par morceau de 12 m."""
    semis = Semis()
    fe = (15, 3, 39, 10)
    n = 0
    for y in range(b.OY + b.BORD, 9):
        for x in range(b.OX + b.BORD, 84):
            if fe[0] <= x <= fe[2] and fe[1] <= y <= fe[3]:
                continue
            if hachage(x, y, 7) > 0.5:
                continue
            t = essence(x, y)
            if not semis.possible(x, y, t):
                continue
            o(t, x, y, 0, f"forest_tree_{n + 1:03d}")
            semis.poser(x, y, t)
            n += 1
    return n


# ---------------------------------------------------------------------------
# Intérieurs (ADR 0016), zones, parcelles, ouvrages


def cases(*coins: tuple[int, int]) -> list[list[int]]:
    return [[x, y] for x, y in coins]


def bloc(xs: tuple[int, ...], ys: tuple[int, ...]) -> list[list[int]]:
    return [[x, y] for x in xs for y in ys]


INTERIEURS = [
    {
        "id": "church", "objet": "church", "nom": "l'église Saint-Aubin",
        "pieces": [
            {"id": "church_nave", "nom": "la nef", "rect": rect_inclus(90, -16, 101, -7)},
            {"id": "church_choir", "nom": "le chœur", "rect": rect_inclus(102, -13, 104, -10)},
        ],
        "fermees": [
            {"id": "church_bell_tower", "rect": rect_inclus(86, -15, 89, -9),
             "role": "le clocher-porche: on y entre par sa porte ouest, fermée (le clocher se visite plus tard)"},
        ],
        "apparition": "church_inside", "heures": "church", "ambiance": "room-tone-church",
        # Bancs tournés vers le chœur (à l'est), en deux blocs de part et d'autre de l'allée centrale (y -12 et
        # -11), l'allée du portail (x 95) et les bas-côtés (x 90, x 101) libres; chaire, statue et harmonium contre
        # le mur nord, qui reste debout pour la caméra; l'autel isolé dans le chœur.
        "mobilier": [
            *[{"id": f"church_pew_{n + 1:02d}", "cases": bloc((x,), ys), "rotation": 1,
               "role": "banc de trois places, tourné vers le chœur"}
              for n, (x, ys) in enumerate([(x, ys) for ys in ((-15, -14, -13), (-10, -9, -8))
                                           for x in (91, 93, 97, 99)])],
            {"id": "church_pulpit", "cases": cases((96, -16)), "rotation": 2,
             "role": "la chaire, contre le mur nord, en face du portail"},
            {"id": "church_statue", "cases": cases((92, -16)), "rotation": 2,
             "role": "la statue de saint Aubin, contre le mur nord"},
            {"id": "church_harmonium", "cases": cases((100, -16)), "rotation": 2,
             "role": "l'harmonium d'Armand, contre le mur nord"},
            {"id": "church_candle_stand", "cases": cases((101, -8)), "rotation": 0,
             "role": "le présentoir de cierges, au bas du chœur côté sud"},
            {"id": "church_altar", "cases": cases((103, -12), (103, -11)), "rotation": 3,
             "role": "l'autel, isolé dans le chœur (on en fait le tour)"},
        ],
    },
    {
        "id": "cafe", "objet": "cafe", "nom": "le café de la Côte",
        "pieces": [{"id": "cafe_room", "nom": "la salle", "rect": rect_inclus(88, 16, 92, 19)}],
        "apparition": "cafe_inside", "heures": "cafe", "ambiance": "room-tone-cafe",
        "mobilier": [
            {"id": "cafe_bar", "cases": cases((89, 16), (90, 16), (91, 16)), "rotation": 0,
             "role": "le comptoir contre le mur nord (le mur qui reste debout), Colette derrière"},
            {"id": "cafe_stove", "cases": cases((88, 18)), "rotation": 1, "role": "le poêle, contre le mur ouest"},
            {"id": "cafe_table_west", "cases": cases((89, 18)), "rotation": 0, "role": "table de la manille"},
            {"id": "cafe_table_east", "cases": cases((91, 18)), "rotation": 0, "role": "table près de la fenêtre"},
        ],
    },
    {
        "id": "forge", "objet": "forge", "nom": "la forge",
        "pieces": [{"id": "forge_workshop", "nom": "l'atelier", "rect": rect_inclus(99, 16, 102, 19)}],
        "apparition": "forge_entry", "heures": "forge", "ambiance": "room-tone-forge",
        "mobilier": [
            {"id": "forge_hearth", "cases": cases((100, 16), (101, 16)), "rotation": 0,
             "role": "le foyer et le soufflet contre le mur nord, sous la cheminée"},
            {"id": "forge_tool_rack", "cases": cases((99, 19)), "rotation": 1,
             "role": "le râtelier des pinces et des marteaux, contre le mur ouest"},
        ],
    },
    {
        "id": "joinery", "objet": "joinery", "nom": "la menuiserie de Basile (fermée)",
        "pieces": [{"id": "joinery_workshop", "nom": "l'atelier", "rect": rect_inclus(109, 16, 113, 19)}],
        "apparition": "joinery_inside", "heures": "joinery", "ambiance": "room-tone-workshop",
        "mobilier": [
            {"id": "joinery_bench", "cases": cases((110, 16), (111, 16), (112, 16)), "rotation": 0,
             "role": "l'établi contre le mur nord, sous la poussière"},
            {"id": "joinery_tool_rack", "cases": cases((109, 18), (109, 19)), "rotation": 1,
             "role": "le râtelier d'outils au mur ouest, les outils d'Hortense encore pendus"},
        ],
    },
    {
        "id": "farmhouse", "objet": "farmhouse", "nom": "la salle commune de la ferme Delmas",
        "pieces": [{"id": "farmhouse_hall", "nom": "la salle commune", "rect": rect_inclus(115, 28, 121, 31)}],
        "apparition": "farm_inside", "heures": "farmhouse", "ambiance": "room-tone-farm",
        "mobilier": [
            {"id": "farmhouse_fireplace", "cases": cases((115, 28), (115, 29)), "rotation": 1,
             "role": "la cheminée au mur ouest"},
            {"id": "farmhouse_table", "cases": cases((117, 29), (118, 29), (119, 29)), "rotation": 0,
             "role": "la grande table et ses bancs"},
        ],
    },
    {
        "id": "mill", "objet": "mill", "nom": "la salle des meules du moulin de la Vanne",
        "pieces": [{"id": "mill_millstones", "nom": "la salle des meules", "rect": rect_inclus(-16, 29, -12, 33)}],
        "apparition": "mill_entry", "heures": "mill", "ambiance": "room-tone-mill",
        "mobilier": [
            {"id": "mill_stones", "cases": cases((-16, 30), (-16, 31), (-15, 30), (-15, 31)), "rotation": 3,
             "role": "les meules et la trémie contre le mur ouest"},
            {"id": "mill_sacks", "cases": cases((-14, 33), (-13, 33)), "rotation": 0,
             "role": "les sacs de farine, contre le mur sud (coupé pour la caméra: on voit le rouet derrière)"},
        ],
    },
]
PORTES_POINTS = {"church": "church_porch", "cafe": "cafe_door", "forge": "forge_door", "joinery": "joinery_door",
                 "farmhouse": "farm_door", "mill": "mill_door"}

ZONES = [
    ("forest_cote", (2, -28, 62, 1), "le bois de la Côte (ouest du ru), lisière comprise"),
    ("forest_cure", (65, -28, 83, -1), "le bois de la Cure (hêtres, est du ru)"),
    ("forest_west", (-22, -28, -4, 7), "la lisière ouest et le haut du chemin forestier"),
    ("forest_cut_area", (-19, -14, -5, -3), "la coupe de Basile"),
    ("old_oak_clearing", (17, -22, 35, -5), "la clairière du Vieux Chêne"),
    ("forest_pond_area", (39, -24, 49, -16), "la mare de la Côte et sa berge"),
    ("spring_clearing", (50, -23, 65, -13), "la clairière de la source et le bassin"),
    ("lookout_area", (3, -27, 11, -22), "le belvédère"),
    ("church_square_area", (84, -5, 106, 0), "le parvis de Saint-Aubin"),
    ("cemetery", (108, -20, 124, -4), "le cimetière, murs compris"),
    ("priest_garden_area", (76, 2, 83, 9), "le jardin du curé"),
    ("vineyard_area", (100, 1, 107, 10), "la vigne du curé"),
    ("church_crossroads", (85, 21, 97, 23), "la placette du carrefour de l'Église"),
    ("shared_gardens", (91, 24, 98, 34), "les jardins de la Rive"),
    ("wild_plots", (-8, 29, -1, 35), "la friche du garde-barrière"),
    ("field_high_01_area", (109, 1, 115, 9), "le champ du Haut 1"),
    ("field_high_02_area", (117, 1, 123, 9), "le champ du Haut 2"),
    ("orchard_common", (129, 0, 137, 8), "le verger communal"),
    ("meadow_high", (108, -28, 137, -21), "les prés du Haut (réserve: foin pour l'hiver)"),
    ("meadow_high_east", (129, -20, 137, -1), "les prés du Haut, côté est (réserve)"),
    ("farmyard_area", (112, 33, 124, 36), "la cour de ferme"),
    ("pasture", (126, 31, 135, 37), "la pâture et sa mare"),
    ("mill_race", (-24, 35, -8, 37), "le bief du moulin et son canal de fuite"),
    ("log_yard_area", (-10, 1, -4, 8), "le parc à grumes"),
    ("church_level_crossing", (94, 12, 96, 14), "le passage à niveau de l'Église (sans barrière)"),
    ("farm_level_crossing", (127, 12, 128, 14), "le passage de la ferme (privé)"),
]


def parcelle(ident: str, nom: str, x0: int, y0: int, x1: int, y1: int, nature: str, eau: bool = True) -> dict:
    return {"id": ident, "nom": nom, "rect": rect_inclus(x0, y0, x1, y1), "nature": nature, "arrosage": eau,
            "cases": [[x, y] for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]}


PARCELLES = [
    parcelle("wild_plot_01", "friche, parcelle 1", -8, 29, -5, 31, "defricher"),
    parcelle("wild_plot_02", "friche, parcelle 2", -4, 29, -1, 31, "defricher"),
    parcelle("wild_plot_03", "friche, parcelle 3", -8, 33, -5, 35, "defricher"),
    parcelle("wild_plot_04", "friche, parcelle 4", -4, 33, -1, 35, "defricher"),
    parcelle("shared_plot_01", "jardins de la Rive, carré nord-ouest (habitants)", 91, 24, 93, 28, "partage"),
    parcelle("shared_plot_02", "jardins de la Rive, carré nord-est (à louer)", 95, 24, 98, 28, "louer"),
    parcelle("shared_plot_03", "jardins de la Rive, carré sud-ouest (habitants)", 91, 30, 93, 34, "partage"),
    parcelle("shared_plot_04", "jardins de la Rive, carré sud-est (à louer)", 95, 30, 98, 34, "louer"),
    parcelle("field_high_01", "champ du Haut 1 (Paulin)", 109, 1, 115, 9, "louer", eau=False),
    parcelle("field_high_02", "champ du Haut 2 (à louer)", 117, 1, 123, 9, "louer", eau=False),
]

OUVRAGES = [
    {"id": "ru_spring_plank", "nature": "passerelle", "franchit": "ru", "rect": rect(63, -16, 2, 2),
     "modele": "ru_footbridge", "largeur_m": 1.2,
     "role": "la planche de la Source: deux madriers sur le ru, que prend le chemin de la Procession"},
    {"id": "mill_sluice_footbridge", "nature": "passerelle", "franchit": "bief", "rect": rect(-19, 35, 2, 2),
     "modele": "sluice_footbridge", "largeur_m": 1.4,
     "role": "la passerelle de la vanne, en amont de la roue: on y lève la vanne à deux, elle mène à la rive sud "
             "du bief (la rive où l'on regarde tourner la roue)"},
    {"id": "mill_tailrace_planks", "nature": "passerelle", "franchit": "bief", "rect": rect(-9, 37, 2, 1),
     "modele": "tailrace_planks", "largeur_m": 1.0,
     "role": "les planches du chemin de halage sur le canal de fuite, au bord de l'Aubrune: la rive sud du bief "
             "se rejoint aussi par l'est"},
]

PASSAGES_A_NIVEAU = [
    {"id": "level_crossing_gatekeeper", "rect": rect(17, 12, 3, 3), "garde": True,
     "panneaux": ["level_crossing_gate_north", "level_crossing_gate_south"],
     "role": "le passage à niveau du garde-barrière (barrières), le seul gardé"},
    {"id": "level_crossing_church", "rect": rect(94, 12, 3, 3), "garde": False,
     "panneaux": ["crossing_sign_church_north", "crossing_sign_church_south"],
     "role": "la rue de l'Église passe la voie: sans barrière, deux croix de Saint-André; le train siffle"},
    {"id": "level_crossing_farm", "rect": rect(127, 12, 2, 3), "garde": False,
     "panneaux": ["crossing_sign_farm_north", "crossing_sign_farm_south"],
     "role": "le passage privé de la ferme, vers les champs du Haut"},
]

# Conception, CA-C5: plafonds de temps depuis la porte de la maisonnette (3,5 m/s, sans train).
DISTANCES_PLAFONDS = [
    *[["house_door", f"wild_plot_{n:02d}", 6] for n in range(1, 5)],
    ["house_door", "mill_door", 8], ["house_door", "clearing_center", 16], ["house_door", "spring", 24],
    ["house_door", "cafe_door", 26], ["house_door", "church_porch", 30], ["house_door", "farm_door", 35],
    ["house_door", "orchard", 38],
]

# Les anciens bords et ce qui passe dans le bourg du tour 10: le reste de son terrain est inchangé (CA-C3).
RETOUCHES = [
    (rect(0, 0, 2, 46), "ancien bord ouest: cases ordinaires (haie du jardin, chemin du moulin)"),
    (rect(98, 0, 2, 46), "ancien bord est: cases ordinaires (haie de la vigne et des jardins, forge)"),
    (rect(0, 0, 100, 2), "ancien bord nord: l'orée du bois, le parvis, le presbytère"),
    (rect(40, 0, 1, 10), "sentier de la Côte, dans la lisière"),
    (rect(62, 0, 1, 10), "sentier du ru, entre la remise et le ru"),
    (rect(76, 2, 8, 8), "jardin du curé"),
    (rect(87, 3, 6, 8), "maison du sacristain et son jardin de dahlias"),
    (rect(94, 0, 3, 23), "rue de l'Église et son passage à niveau"),
    (rect(94, 35, 1, 1), "bout de l'allée des jardins de la Rive, jusqu'à la grève (berge continue, R22)"),
    (rect(97, 11, 3, 1), "chemin des Champs, le long de la voie"),
    (rect(87, 15, 7, 6), "le café de la Côte"),
    (rect(85, 21, 13, 3), "placette du carrefour de l'Église (la route y reste pavée)"),
    (rect(91, 24, 8, 11), "jardins de la Rive"),
]


def trajet_auto(libre: set, a: tuple[float, float], c: tuple[float, float]) -> list[list[float]]:
    """Plus court chemin de case en case (huit voisins sans couper les angles), puis lissé: on garde un point de
    passage seulement là où la ligne droite toucherait une case bloquée (échantillons de 0,2 m)."""
    import heapq
    depart = (int(math.floor(a[0])), int(math.floor(a[1])))
    arrivee = (int(math.floor(c[0])), int(math.floor(c[1])))
    ouvert = set(libre) | {depart, arrivee}
    dist = {depart: 0.0}
    parent: dict = {}
    tas = [(0.0, depart)]
    while tas:
        d, (x, y) = heapq.heappop(tas)
        if (x, y) == arrivee:
            break
        if d > dist[(x, y)]:
            continue
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
            n = (x + dx, y + dy)
            if n not in ouvert or (dx and dy and ((x + dx, y) not in ouvert or (x, y + dy) not in ouvert)):
                continue
            nd = d + (math.sqrt(2) if dx and dy else 1.0)
            if nd < dist.get(n, math.inf):
                dist[n] = nd
                parent[n] = (x, y)
                heapq.heappush(tas, (nd, n))
    if arrivee not in dist:
        raise SystemExit(f"trajet impossible de {a} à {c}")
    chemin = [arrivee]
    while chemin[-1] != depart:
        chemin.append(parent[chemin[-1]])
    chemin.reverse()
    pts = [a] + [(x + 0.5, y + 0.5) for x, y in chemin[1:-1]] + [c]

    def droite(p: tuple[float, float], q: tuple[float, float]) -> bool:
        n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / 0.2))
        for k in range(n + 1):
            x = p[0] + (q[0] - p[0]) * k / n
            y = p[1] + (q[1] - p[1]) * k / n
            if (int(math.floor(x)), int(math.floor(y))) not in ouvert:
                return False
        return True

    garde = [pts[0]]
    i = 0
    while i < len(pts) - 1:
        j = len(pts) - 1
        while j > i + 1 and not droite(pts[i], pts[j]):
            j -= 1
        garde.append(pts[j])
        i = j
    return [[round(x, 2), round(y, 2)] for x, y in garde]


# Trajets des habitants (habitants, 1.3): les plus empruntés, et le chemin de la messe du dimanche pour chaque foyer.
TRAJETS = [
    ("nour_home_to_exit", "nour", "hamlet_house_a_door", "village_exit", "8 h: elle part en tournée par la route"),
    ("lucie_home_to_exit", "lucie", "lucie_house_door", "village_exit", "8 h: la tournée à vélo, par la route"),
    ("marthe_home_to_bells", "marthe", "sexton_house_door", "church_bell_rope", "l'angélus, trois fois par jour"),
    ("leon_farm_to_school", "leon", "farm_door", "school_gate", "7 h 40, par la route des hameaux"),
    ("barnabe_forge_to_cut", "barnabe", "forge_door", "forest_cut", "le matin, à la coupe"),
    ("berthe_mill_to_cafe", "berthe", "mill_door", "cafe_door", "midi, elle déjeune au café"),
    ("ambroise_home_to_quay", "ambroise", "rail_cottage_west_door", "quay_bench", "8 h, à la halte"),
    ("ines_home_to_clearing", "ines", "forester_house_door", "clearing_center", "sa tournée du bois"),
    ("colette_cafe_to_gardens", "colette", "cafe_door", "shared_garden_plot", "le mardi, son carré"),
    ("margot_farm_to_washhouse", "margot", "farm_door", "washhouse", "le lundi, 9 h, la lessive"),
    ("paulin_farm_to_field", "paulin", "farm_door", "field_high_01", "son champ, par le passage de la ferme"),
    ("honorine_home_to_cemetery", "honorine", "hamlet_house_c_door", "grave_valade", "le vendredi, 9 h"),
]
FOYERS = [("martial", "presbytery_door"), ("marthe", "sexton_house_door"), ("colette", "cafe_door"),
          ("mado", "forge_door"), ("paulin", "farm_door"), ("honorine", "hamlet_house_c_door"),
          ("nour", "hamlet_house_a_door"), ("ambroise", "rail_cottage_west_door"), ("berthe", "mill_door"),
          ("ines", "forester_house_door"), ("firmin", "firmin_house"), ("odette", "grocery_door"),
          ("basile", "sawmill_yard"), ("lucie", "lucie_house_door"), ("achille", "bakery_door"),
          ("solange", "salon_door"), ("armand", "school_lodging_door")]

HABITANTS = {
    "lucie": {"logis": "lucie_house_door", "travail": "village_exit (tournée)", "trajets": ["lucie_home_to_exit"]},
    "armand": {"logis": "school_lodging_door", "travail": "school_gate, mairie_desk, church_harmonium"},
    "berthe": {"logis": "mill_door", "travail": "mill_inside, mill_sluice", "trajets": ["berthe_mill_to_cafe"]},
    "martial": {"logis": "presbytery_door", "travail": "church_nave, priest_garden, vineyard"},
    "marthe": {"logis": "sexton_house_door", "travail": "church_bell_rope, cemetery_tap, sexton_garden",
               "trajets": ["marthe_home_to_bells"]},
    "honorine": {"logis": "hamlet_house_c_door", "travail": "honorine_doorstep, honorine_window",
                 "trajets": ["honorine_home_to_cemetery"]},
    "ines": {"logis": "forester_house_door", "travail": "forest_cut, clearing_center, lookout",
             "trajets": ["ines_home_to_clearing"]},
    "barnabe": {"logis": "forge_door", "travail": "forest_cut, charcoal_kiln", "trajets": ["barnabe_forge_to_cut"]},
    "mado": {"logis": "forge_door", "travail": "forge_inside, forge_yard"},
    "paulin": {"logis": "farm_door", "travail": "field_high_01, farmyard, barn_door",
               "trajets": ["paulin_farm_to_field"]},
    "margot": {"logis": "farm_door", "travail": "farm_garden, washhouse", "trajets": ["margot_farm_to_washhouse"]},
    "leon": {"logis": "farm_door", "travail": "school_gate, pasture_bank", "trajets": ["leon_farm_to_school"]},
    "ambroise": {"logis": "rail_cottage_west_door", "travail": "rail_cottage_west_window, quay_bench",
                 "trajets": ["ambroise_home_to_quay"]},
    "nour": {"logis": "hamlet_house_a_door", "travail": "vet_yard, barn_door", "trajets": ["nour_home_to_exit"]},
    "colette": {"logis": "cafe_door", "travail": "cafe_counter, cafe_terrace, shared_garden_plot",
                "trajets": ["colette_cafe_to_gardens"]},
}


def trajets(carte: dict) -> list[dict]:
    ox, oy = carte["taille"]["origine"]["x"], carte["taille"]["origine"]["y"]
    grille = carte["infranchissable"]["grille"]
    libre = {(x + ox, y + oy) for y, ligne in enumerate(grille) for x, c in enumerate(ligne) if c == "."}
    pts = {p_["id"]: (p_["x"], p_["y"]) for p_ in carte["points"]}
    res = []
    liste = list(TRAJETS) + [(f"{h}_home_to_church", h, d, "church_nave", "le dimanche, 10 h 15: la messe")
                             for h, d in FOYERS]
    for ident, hab, de, a, note in liste:
        res.append({"id": ident, "habitant": hab, "de": de, "a": a, "par": trajet_auto(libre, pts[de], pts[a]),
                    "note": note})
        if hab in HABITANTS:
            HABITANTS[hab].setdefault("trajets", [])
            if ident not in HABITANTS[hab]["trajets"]:
                HABITANTS[hab]["trajets"].append(ident)
    return res


# ---------------------------------------------------------------------------
# Assemblage


def preparer() -> None:
    """Avant tout dessin: légende et types neufs."""
    b.LEGENDE.update(LEGENDE)
    b.TYPES.update(TYPES)


def objets() -> list[dict]:
    """Objets, points, cueillette, déplacements, semis; rend le journal des objets déplacés."""
    batiments()
    eglise_et_cimetiere()
    carrefour_et_hameau()
    ouest()
    foret_lieux()
    points_lieux()
    points_ecriteaux()
    points_vie()
    cueillette()
    for pt in b.POINTS:
        if pt["id"] == "village_exit":
            pt["x"], pt["y"] = 137.5, 21.5
    journal = deplacer()
    semer_foret()
    return journal


def donnees() -> None:
    """Zones, intérieurs, ouvrages, coins de pêche, ru: ajoutés aux listes du constructeur."""
    for ident, (x0, y0, x1, y1), role in ZONES:
        b.ZONES.append({"id": ident, "rect": rect_inclus(x0, y0, x1, y1), "role": role})
    b.INTERIEURS.extend(INTERIEURS)
    b.OUVRAGES.extend(OUVRAGES)
    b.RU["de_y"] = -21
    b.RU["role"] = ("le ru de la Côte naît à la source, au pied du bassin de la fontaine (y -22), descend le bois et "
                    "se jette dans l'Aubrune en y 37; on en fait le tour par la source")
    coins = {c_["id"]: c_ for c_ in b.COINS_PECHE}
    coins["upstream"]["rects"] = [rect(b.OX, 38, 11 - b.OX, 5), rect(b.OX, 35, -7 - b.OX, 3)]
    coins["upstream"]["pourquoi"] += "; avec l'amont neuf et le bief du moulin (eau prise à l'Aubrune)"
    coins["downstream"]["rects"] = [rect(71, 38, b.X_FIN - 71, 5)]
    coins["ru"]["rects"] = [rect(63, -21, 2, 57)]
    b.HABITANTS.update(HABITANTS)


def completer(carte: dict, journal: list[dict]) -> None:
    """Clés neuves de la carte 0.13, une fois la grille calculée."""
    carte["nom"] = "La Halte d'Aubrune, le bourg agrandi (0.13)"
    carte["document"] = "docs/jeux/jeu-1/v0-13-carte.md"
    carte["conventions"]["origine"] = ("la grille commence en `taille.origine` (x -24, y -30): la ligne 0 de "
                                       "`terrain.lignes` est la rangée y -30, le caractère 0 la colonne x -24; "
                                       "rien de ce qui existait ne change de coordonnées")
    carte["conventions"]["parcelles"] = ("parcelles à cultiver (`nature`: defricher, louer, partage), `cases` dans "
                                         "l'ordre du potager (ligne par ligne, d'ouest en est, du nord au sud); "
                                         "`arrosage` faux: plein champ, sans arrosage quotidien (à confirmer)")
    carte["camera"]["rues_degagees"] += [
        {"id": "route_des_hameaux", "rect": rect(97, 21, b.X_FIN - b.BORD - 97, 2),
         "objets": ["hamlet_house_c", "farmhouse", "barn"]},
        {"id": "placette_eglise", "rect": rect(85, 21, 13, 3), "objets": ["cafe", "school_house", "sexton_house"]},
    ]
    # La forêt du pourtour, semée par le rendu hors du bord jouable: ce que le contrôle de la caméra en suppose
    # (le rendu doit la suivre, lot L3): 2 à 9 m de haut, ni sur la voie ni sur la rivière, éclaircie de 6 m à
    # l'est au droit du hameau; la rive sud garde son éclaircie actuelle.
    carte["camera"]["foret_pourtour"] = {
        "cotes": ["nord", "ouest", "est"], "hauteur": [2.0, 9.0], "profondeur": 10,
        "sans_rangees": [[12, 14], [36, 43]],
        "eclaircies": [{"cote": "est", "de_y": 15, "a_y": 45, "recul": 6}],
    }
    carte["parcelles"] = PARCELLES
    carte["passages_a_niveau"] = PASSAGES_A_NIVEAU
    carte["distances_plafonds"] = {"vitesse": 3.5, "paires": DISTANCES_PLAFONDS}
    carte["agrandissement"] = {
        "ancienne_aire": rect(0, 0, b.LARGEUR, b.HAUTEUR),
        "retouches": [{"rect": rr, "raison": raison} for rr, raison in RETOUCHES],
        "deplaces": journal,
        "points_deplaces": [{"id": "village_exit", "de": [97.5, 21.5], "a": [137.5, 21.5],
                             "raison": "la route des hameaux sort maintenant au nouveau bord est"}],
        "impasses": ["lookout", "forester_house_door", "fairy_ring", "charcoal_pit"],
        # Les sentiers qui débouchent dans une clairière continuent à travers elle (elle compte dans le réseau).
        "clairieres": ["old_oak_clearing", "spring_clearing"],
    }
    carte["triangles_par_type"] = TRIANGLES

