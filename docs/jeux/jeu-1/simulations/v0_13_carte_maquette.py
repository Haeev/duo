#!/usr/bin/env python3
"""Maquette de la carte élargie de la Halte (La Petite Ligne 0.13), pour la conception.

Ce n'est pas le générateur: il lit `halte.json` tel qu'il est, le pose dans la grille élargie
(coordonnées de la carte actuelle inchangées, régions neuves en x et y négatifs ou au-delà de 99),
dessine les régions de `docs/jeux/jeu-1/v0-13-carte.md` en rectangles et sentiers, sème la forêt,
puis contrôle ce que la conception promet:

- grille ASCII à 1 m et vue d'ensemble à 2 m (section 3 du document);
- distances de marche (Dijkstra, huit directions sans couper les angles, 3,5 m/s) depuis la porte
  de la maisonnette et entre lieux (section 7);
- lieux importants vus depuis la caméra par défaut et depuis au moins une autre orientation
  (rayon à 35,264 degrés, toits à deux pans, houppiers en disques), cône de caméra des clairières;
- objets et points de la carte actuelle qui tombent dans une emprise neuve (à déplacer);
- estimation des triangles par vue (sommes des modèles dans le cadre de 36 m, ombre comprise);
- plan SVG et PNG (`rsvg-convert` si présent).

Bibliothèque standard seulement; résultat identique à chaque exécution.

    python3 -I docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py            # résumé
    python3 -I docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py --ascii    # grille complète
    python3 -I docs/jeux/jeu-1/simulations/v0_13_carte_maquette.py --png      # plan PNG
"""

from __future__ import annotations

import heapq
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parents[3]
CARTE = RACINE / "games" / "la-petite-ligne" / "donnees" / "cartes" / "halte.json"
SORTIE_SVG = ICI / "v0_13_carte_plan.svg"
SORTIE_PNG = RACINE / "docs" / "jeux" / "jeu-1" / "captures" / "apercu" / "v0-13-plan.png"

# Grille élargie, dans le repère de la carte actuelle (origine de la grille en OX, OY).
OX, OY = -24, -30
X1, Y1 = 139, 47
LARG, HAUT = X1 - OX + 1, Y1 - OY + 1
BORD = 2
VITESSE = 3.5

# ---------------------------------------------------------------------------
# Grille de terrain (caractères de la maquette).

terrain: list[list[str]] = [["." for _ in range(LARG)] for _ in range(HAUT)]


def dans(x: int, y: int) -> bool:
    return OX <= x <= X1 and OY <= y <= Y1


def lit(x: int, y: int) -> str:
    return terrain[y - OY][x - OX] if dans(x, y) else "X"


def pose(x: int, y: int, c: str) -> None:
    if dans(x, y):
        terrain[y - OY][x - OX] = c


def rect(x0: int, y0: int, x1: int, y1: int, c: str, sauf: str = "") -> None:
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if lit(x, y) not in sauf:
                pose(x, y, c)


def ellipse(cx: float, cy: float, a: float, b: float, c: str, sauf: str = "") -> list[tuple[int, int]]:
    """Ellipse allongée selon la diagonale nord-ouest / sud-est (a), b en travers."""
    cases = []
    for y in range(int(cy - a - 1), int(cy + a + 2)):
        for x in range(int(cx - a - 1), int(cx + a + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u, v = (dx + dy) / math.sqrt(2), (dx - dy) / math.sqrt(2)
            if (u / a) ** 2 + (v / b) ** 2 <= 1 and lit(x, y) not in sauf:
                pose(x, y, c)
                cases.append((x, y))
    return cases


def sentier(points: list[tuple[float, float]], largeur: float, c: str, sauf: str = "") -> None:
    for (ax, ay), (bx, by) in zip(points, points[1:]):
        n = int(max(abs(bx - ax), abs(by - ay)) * 4) + 1
        for i in range(n + 1):
            t = i / n
            px, py = ax + (bx - ax) * t, ay + (by - ay) * t
            r = largeur / 2
            for y in range(int(math.floor(py - r)), int(math.floor(py + r)) + 1):
                for x in range(int(math.floor(px - r)), int(math.floor(px + r)) + 1):
                    if abs(x + 0.5 - px) <= r and abs(y + 0.5 - py) <= r and lit(x, y) not in sauf:
                        pose(x, y, c)


carte = json.loads(CARTE.read_text(encoding="utf-8"))
ANCIENNES = carte["terrain"]["lignes"]
ANC_L, ANC_H = carte["taille"]["largeur"], carte["taille"]["hauteur"]

# 1. La carte actuelle, à sa place.
for y in range(ANC_H):
    for x in range(ANC_L):
        pose(x, y, ANCIENNES[y][x])

# 2. Prolonger vers l'ouest et l'est ce qui traverse les bords: voie, rivière, rive sud.
for y in range(ANC_H):
    for x in list(range(OX, 0)) + list(range(ANC_L, X1 + 1)):
        ref = ANCIENNES[y][0] if x < 0 else ANCIENNES[y][ANC_L - 1]
        if y in (12, 13, 14):
            pose(x, y, "=")
        elif y >= 36:
            if y in (44, 45):
                pose(x, y, ",")
            elif ref == "X":
                pose(x, y, "X")
            else:
                pose(x, y, ref)
        else:
            pose(x, y, ".")

# 3. Anciens bords (x 0 et 1, x 98 et 99, y 0 et 1) devenus intérieurs.
for y in range(0, 46):
    for x in (0, 1, 98, 99):
        if lit(x, y) == "X":
            pose(x, y, ".")
for x in range(0, ANC_L):
    for y in (0, 1):
        if lit(x, y) == "X":
            pose(x, y, "h" if x < 63 else ",")
for x in range(-24, 0):
    for y in (44, 45):
        pose(x, y, ",")
for x in (0, 1):
    for y in (44, 45):
        pose(x, y, ",")

# 4. Le nord: tout ce qui est au-dessus de y 0 est le coteau.
for y in range(OY, 0):
    for x in range(OX, X1 + 1):
        pose(x, y, "h" if x <= 83 else ",")

# ---------------------------------------------------------------------------
# Régions neuves. Bâtiments: (id, nom, x0, y0, x1, y1, lettre, égout, faîte, faîtage, portes).
# faîtage "x": faîte est-ouest; "y": faîte nord-sud; None: volume plein.

BATIMENTS: list[dict] = []


def batiment(id_: str, nom: str, x0: int, y0: int, x1: int, y1: int, lettre: str, egout: float,
             faite: float, faitage: str | None, portes: list[tuple[int, int]], visite: bool = False,
             tours: list[tuple[int, int, int, int, float]] | None = None) -> None:
    BATIMENTS.append({"id": id_, "nom": nom, "r": (x0, y0, x1, y1), "lettre": lettre, "egout": egout,
                      "faite": faite, "faitage": faitage, "portes": portes, "visite": visite,
                      "tours": tours or []})


# --- Ouest: l'amont, le moulin, les maisons de cheminots, la friche, le parc à grumes.
rect(-22, 35, -9, 36, "k")                       # bief du moulin (eau vive)
rect(-9, 36, -8, 37, "k")                        # canal de fuite vers l'Aubrune
rect(-19, 35, -18, 36, "#")                      # passerelle de la vanne
rect(-1, 27, 2, 27, ":")                         # chemin du moulin (prolonge le chemin de y 27)
rect(-10, 27, -1, 28, ":")
rect(-10, 29, -9, 31, ":")                       # vers la porte du moulin (façade est)
rect(-15, 22, -1, 23, ":")                       # chemin des Cheminots
rect(-2, 22, -1, 26, ":")                        # jonction avec le chemin du moulin
rect(-8, 30, 1, 35, "f")                         # la friche (parcelles à défricher)
rect(-7, 29, 1, 29, ",")
rect(-10, 1, -4, 8, ":")                         # parc à grumes de Basile
rect(-3, -16, -1, 11, ":")                       # chemin forestier (3 m)
rect(-19, -14, -5, -3, ",")                      # la coupe de Basile
batiment("mill", "Moulin de la Vanne (logis de la meunière)", -17, 28, -11, 34, "x", 5.5, 9.0, "x",
         [(-11, 31)], visite=True)
batiment("rail_cottage_west", "Maison de cheminots (ouest)", -15, 16, -10, 21, "6", 3.2, 6.0, "x",
         [(-12, 21)])
batiment("rail_cottage_east", "Maison de cheminots (est)", -8, 16, -3, 21, "7", 3.2, 6.0, "x", [(-5, 21)])
batiment("forester_house", "Maison forestière", -10, -24, -5, -19, "z", 3.0, 6.0, "x", [(-7, -19)])
rect(-7, -18, -7, -17, ":")
rect(-7, -17, -1, -16, ":")

# --- Nord: le bois de la Côte (ouest du ru), ses sentiers et clairières.
rect(63, -21, 64, 1, "r")                        # le ru remonte jusqu'à sa source
CLAIRIERE = ellipse(26, -13, 10, 6, ",", sauf="r")
MARE = ellipse(44, -20, 3.6, 2.6, "e")
ellipse(44, -20, 4.8, 3.8, "b", sauf="e")        # berge de la mare
SOURCE = ellipse(57, -18, 7, 5, ",", sauf="r")
rect(62, -23, 65, -22, "e")                      # bassin de la source (la fontaine)
BELVEDERE = ellipse(7, -24, 3.6, 2.8, ",")
COUPE_SECRETE = ellipse(48.5, -12, 2.0, 2.0, ",")  # le rond des fées (secret)
ellipse(-16.5, -1, 1.6, 1.6, ",")                # la charbonnière (secret)
sentier([(40.5, 9.5), (40.5, 0.5)], 1, ";")                                      # sentier de la Côte, dans la lisière
sentier([(40.0, 0.5), (40.0, -3.0), (34.0, -6.5)], 2, ";")                      # sentier de la Côte
sentier([(-1.0, -16.5), (5.0, -20.0), (7.0, -22.0)], 2, ";")                    # sentier des crêtes, ouest
sentier([(5.0, -20.0), (12.0, -21.0), (19.5, -21.0), (30.0, -21.5), (37.0, -17.5), (44.0, -14.5),
         (51.0, -16.5), (54.5, -18.0)], 2, ";")                                  # sentier des crêtes
sentier([(62.5, 9.5), (62.5, 0.5)], 1, ";", sauf="r")                           # sentier du ru, au pied
sentier([(62.0, 0.5), (61.5, -8.0), (60.0, -13.0)], 2, ";", sauf="r")            # sentier du ru
sentier([(-1.0, -10.0), (8.0, -10.5), (16.5, -11.5)], 2, ";")                   # de la coupe à la clairière
sentier([(40.5, -3.5), (44.0, -8.0), (47.0, -11.0)], 1, ";")                    # coulée vers le rond des fées
sentier([(-14.0, -3.5), (-15.5, -1.5)], 1, ";")                                # coulée vers la charbonnière
rect(63, -16, 64, -15, "Y")                      # planche de la Source
sentier([(65.5, -15.5), (71.0, -12.0), (77.0, -8.0), (83.5, -3.5)], 2, ":", sauf="r")  # chemin de la Procession
rect(-22, -2, -11, 7, "h")                       # le bois descend jusqu'à la voie vers la ville
rect(-10, -2, -4, 0, "h")

# --- Nord-est: l'église, le parvis, le presbytère, le cimetière, la vigne, les champs du Haut.
rect(94, -1, 96, 22, "+", sauf="=")              # rue de l'Église (3 m)
rect(94, 12, 96, 14, "#")                        # passage à niveau de l'Église (non gardé)
rect(84, -5, 106, 0, "+")                        # le parvis (place de l'Église)
rect(107, -3, 113, -1, "c")                      # allée vers le cimetière
rect(108, -20, 124, -4, "c")                     # cimetière (allées de gravier, tombes en objets)
rect(76, 2, 83, 9, "p")                          # jardin du curé
rect(100, 1, 107, 10, "v")                       # la vigne du curé (haie du bord en x 99)
rect(109, 1, 115, 9, "p")                        # champ du Haut 1 (à louer)
rect(117, 1, 123, 9, "p")                        # champ du Haut 2 (à louer)
rect(108, 10, 135, 11, ":")                      # chemin des Champs (le long de la voie)
rect(116, 1, 116, 9, ":")
rect(124, 0, 126, 9, ":")                        # chemin de la ferme, du passage aux champs
rect(108, 0, 126, 0, ":")
rect(125, -20, 126, -1, ":")                     # le chemin monte aux prés du Haut (pâture d'été)
rect(127, -28, 137, -1, ".")                     # les prés du Haut
rect(108, -28, 126, -21, ".")
batiment("church", "Église Saint-Aubin", 85, -17, 105, -6, "G", 7.0, 11.0, "x", [(95, -6)], visite=True,
         tours=[(85, -15, 89, -9, 20.0)])
batiment("presbytery", "Presbytère", 76, -5, 82, 1, "N", 4.0, 7.5, "y", [(82, -2)])
batiment("sexton_house", "Maison du sacristain", 87, 3, 92, 8, "1", 3.0, 5.5, "y", [(92, 5)])

# --- Est: la route des hameaux, les métiers, les jardins, le lavoir, la ferme, le hameau.
rect(87, 21, 139, 22, ":", sauf="")
rect(85, 21, 97, 23, "+")                        # placette du carrefour de l'Église (terrasse du café)
rect(104, 15, 106, 20, ":")                      # cour de la forge (à l'est)
rect(114, 15, 116, 20, ":")                      # cour de la menuiserie (à l'est)
rect(125, 11, 126, 20, ":")                      # chemin de la ferme vers les champs
rect(125, 12, 126, 14, "#")                      # passage de la ferme
batiment("cafe", "Café-auberge de la Côte", 87, 15, 93, 20, "V", 6.0, 8.5, "x", [(91, 20)], visite=True)
batiment("forge", "Forge", 98, 15, 103, 20, "Q", 3.0, 5.5, "x", [(103, 18)], visite=True)
batiment("joinery", "Menuiserie", 107, 15, 113, 20, "J", 3.2, 6.0, "x", [(113, 18)], visite=True)
batiment("hamlet_house_a", "Maison du hameau (A)", 118, 15, 123, 20, "2", 3.0, 5.5, "x", [(120, 20)])
batiment("hamlet_house_b", "Maison du hameau (B)", 128, 15, 133, 20, "3", 3.0, 5.5, "x", [(130, 20)])
rect(91, 24, 98, 34, "p")                        # les jardins de la Rive (haie existante en x 99)
rect(94, 24, 94, 34, ":")                        # allées en croix, la pompe au croisement
rect(91, 29, 98, 29, ":")
rect(100, 23, 101, 34, ":")                      # chemin du lavoir
batiment("washhouse", "Lavoir", 99, 35, 103, 37, "I", 2.4, 3.6, "x", [(101, 35)])
batiment("barn", "Grange-étable", 105, 29, 111, 35, "y", 4.5, 8.0, "x", [(111, 32)])
batiment("farmhouse", "Logis de la ferme", 114, 27, 122, 32, "4", 5.0, 8.0, "x", [(118, 32)], visite=True)
rect(112, 33, 124, 36, "c")                      # la cour de ferme
rect(123, 23, 124, 32, ":")                      # chemin de la cour
rect(114, 23, 122, 26, ",")                      # le courtil
batiment("hamlet_house_c", "Maison du hameau (C)", 128, 25, 133, 30, "5", 3.0, 5.0, "x", [(130, 25)])
rect(126, 31, 135, 37, ",")                      # la pâture et sa mare
ellipse(131, 34, 1.6, 1.4, "e")

# 5. Nouveaux bords.
for y in range(OY, Y1 + 1):
    for x in range(OX, X1 + 1):
        bord = x < OX + BORD or x > X1 - BORD or y < OY + BORD or y > Y1 - BORD
        if bord and lit(x, y) not in "=~bk":
            pose(x, y, "X")

# ---------------------------------------------------------------------------
# Objets et arbres. Arbres: (x, y, essence, hauteur, base du houppier, rayon du houppier).

ESSENCES = {
    "chene": (8.0, 1.8, 2.2, 358), "sapin": (9.0, 1.2, 1.6, 174), "bouleau": (6.0, 2.0, 1.4, 366),
    "hetre": (9.5, 2.2, 2.3, 380), "chataignier": (8.0, 2.0, 2.2, 380), "fruitier": (5.0, 1.6, 1.5, 420),
    "vieux_chene": (12.0, 2.6, 3.4, 900),
}
ARBRES: list[tuple[float, float, str]] = []
POINTS: dict[str, tuple[float, float, bool, str]] = {}


def point(id_: str, x: float, y: float, important: bool, role: str) -> None:
    POINTS[id_] = (x, y, important, role)


# Points des lieux neufs (cf. document, section 6). important: vu depuis l'orientation par défaut et
# au moins une autre.
point("mill_door", -9.5, 31.5, True, "devant la porte du moulin (façade est)")
point("mill_sluice", -18.5, 34.5, True, "la vanne du bief, à deux")
point("rail_cottage_west_door", -11.5, 22.5, True, "porte de la maison de cheminots ouest")
point("rail_cottage_east_door", -4.5, 22.5, True, "porte de la maison de cheminots est")
point("wild_plot_01", -6.5, 31.5, True, "friche: parcelle à défricher 1")
point("wild_plot_04", -1.5, 34.5, True, "friche: parcelle à défricher 4")
point("log_yard", -6.5, 9.5, True, "parc à grumes de Basile")
point("forest_cut", -12.0, -8.5, True, "la coupe: Basile marque les arbres")
point("forester_house_door", -6.5, -17.5, True, "devant la maison forestière")
point("lookout", 6.5, -24.5, True, "le belvédère")
point("old_oak", 31.5, -16.0, True, "au pied du Vieux Chêne (bord nord-est de la clairière)")
point("clearing_center", 27.5, -12.5, True, "la clairière du Vieux Chêne, le tronc couché")
point("forest_pond", 44.5, -15.5, True, "la mare de la Côte (rive sud, sur le sentier)")
point("spring", 61.5, -19.5, True, "la source du ru, la fontaine")
point("spring_oratory", 59.5, -21.5, True, "l'oratoire de la source")
point("fairy_ring", 48.5, -12.0, False, "secret: le rond des fées")
point("charcoal_pit", -16.5, -1.0, False, "secret: la charbonnière oubliée")
point("church_porch", 95.5, -4.5, True, "devant le portail sud de l'église")
point("church_square", 92.5, -3.0, True, "le parvis")
point("presbytery_door", 83.5, -1.5, True, "devant la porte du presbytère")
point("priest_garden", 79.5, 5.5, True, "le jardin du curé")
point("cemetery_gate", 112.5, -2.0, True, "devant la grille du cimetière")
point("cemetery_cross", 116.5, -12.5, True, "la croix du cimetière")
point("grave_row_east", 120.5, -8.5, True, "les tombes du rang est")
point("sexton_house_door", 93.5, 5.5, True, "devant la maison du sacristain")
point("vineyard", 102.5, 5.5, True, "la vigne du curé")
point("field_high_01", 111.5, 4.5, True, "champ du Haut 1")
point("field_high_02", 120.5, 4.5, True, "champ du Haut 2")
point("cafe_door", 90.5, 21.5, True, "devant la porte du café")
point("cafe_terrace", 88.5, 21.5, True, "la terrasse du café, sur la placette du carrefour")
point("forge_yard", 105.0, 20.0, True, "cour de la forge, l'enclume")
point("joinery_yard", 115.0, 20.0, True, "cour de la menuiserie")
point("hamlet_house_a_door", 120.5, 21.5, True, "porte de la maison du hameau A")
point("hamlet_house_b_door", 130.5, 21.5, True, "porte de la maison du hameau B")
point("hamlet_house_c_door", 130.5, 24.5, True, "porte de la maison du hameau C")
point("shared_garden_pump", 94.5, 29.5, True, "la pompe des jardins de la Rive")
point("shared_garden_plot", 93.0, 25.5, True, "un carré des jardins")
point("washhouse", 101.5, 34.5, True, "le lavoir")
point("barn_door", 112.5, 32.5, True, "porte de l'étable")
point("farm_door", 118.5, 33.5, True, "porte du logis de la ferme")
point("farmyard", 117.0, 35.0, True, "la cour de ferme")
point("pasture_gate", 125.5, 33.5, True, "barrière de la pâture")

# Arbres du verger communal (sur le coteau, à l'est des champs du Haut).
for i, (x, y) in enumerate([(127.5, 0.5), (130.5, 0.5), (133.5, 0.5), (127.5, 3.5), (130.5, 3.5),
                            (133.5, 3.5), (127.5, 6.5), (130.5, 6.5), (133.5, 6.5)]):
    ARBRES.append((x, y, "fruitier"))
ARBRES.append((31.5, -18.5, "vieux_chene"))
point("orchard", 129.0, 8.5, True, "le verger communal (au bas des arbres)")


def hachage(a: int, b: int, graine: int) -> float:
    h = (a * 73856093) ^ (b * 19349663) ^ (graine * 83492791)
    h = (h ^ (h >> 13)) * 1274126177 & 0xFFFFFFFF
    return (h ^ (h >> 16)) / 0xFFFFFFFF


def cone_libre(px: float, py: float) -> set[tuple[int, int]]:
    """Cases du cône de la caméra par défaut (sud-est) d'un lieu: aucun houppier ne doit y pousser."""
    cases = set()
    for k10 in range(5, 105, 5):
        k = k10 / 10
        for d in (-1.6, -0.8, 0.0, 0.8, 1.6):
            cases.add((int(math.floor(px + k + d / math.sqrt(2))), int(math.floor(py + k - d / math.sqrt(2)))))
    return cases


def cone_nord_ouest(px: float, py: float) -> set[tuple[int, int]]:
    """Cône de l'orientation opposée (nord-ouest): la clairière s'ouvre dans les deux sens de sa diagonale."""
    return {(2 * int(math.floor(px)) - cx, 2 * int(math.floor(py)) - cy) for (cx, cy) in cone_libre(px, py)}


INTERDITS: set[tuple[int, int]] = set()
for (pid, (px, py, imp, _)) in POINTS.items():
    if imp and py < 2 and px < 84:
        INTERDITS |= cone_libre(px, py)
        if pid not in ("old_oak", "lookout"):
            INTERDITS |= cone_nord_ouest(px, py)

# Semis de la forêt: une case sur deux dans chaque axe, tirage par hachage, distance minimale.
for y in range(OY + BORD, 8):
    for x in range(OX + BORD, 84):
        if lit(x, y) != "h":
            continue
        voisins_chemin = any(lit(x + dx, y + dy) in ";:+rY" for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if voisins_chemin or (x, y) in INTERDITS:
            continue
        if hachage(x, y, 7) > 0.16:
            continue
        if any(abs(ax - (x + 0.5)) < 2.6 and abs(ay - (y + 0.5)) < 2.6 for ax, ay, _ in ARBRES[-40:]):
            continue
        if x < 12:
            essence = ["sapin", "sapin", "bouleau", "chataignier"][int(hachage(x, y, 11) * 4)]
        elif x < 63:
            essence = ["chene", "chene", "chene", "bouleau", "sapin"][int(hachage(x, y, 11) * 5)]
        else:
            essence = ["hetre", "hetre", "hetre", "chene"][int(hachage(x, y, 11) * 4)]
        ARBRES.append((x + 0.5, y + 0.5, essence))

# Arbres de la carte actuelle (décor et lisière), avec leurs hauteurs.
ANCIENS_OBJETS = carte["objets"]
TYPES = carte["types"]
for o in ANCIENS_OBJETS:
    if o["type"] in ("tree_oak", "tree_fir", "tree_apple"):
        ess = {"tree_oak": "chene", "tree_fir": "sapin", "tree_apple": "fruitier"}[o["type"]]
        ARBRES.append((o["x"], o["y"], ess))

# ---------------------------------------------------------------------------
# Conflits: objets et points actuels pris dans une emprise ou un chemin neufs.


def emprise_neuve(x: int, y: int) -> str | None:
    for b in BATIMENTS:
        x0, y0, x1, y1 = b["r"]
        if x0 <= x <= x1 and y0 <= y <= y1:
            return b["id"]
    c = lit(x, y)
    if c in "+#:;cvpk" and not (0 <= x < ANC_L and 0 <= y < ANC_H and ANCIENNES[y][x] == c):
        return {"+": "pavés neufs", "#": "passage neuf", ":": "chemin neuf", ";": "sentier neuf",
                "c": "gravier", "v": "vigne", "p": "terre cultivée", "k": "bief"}[c]
    return None


def conflits() -> list[str]:
    sortie = []
    for o in ANCIENS_OBJETS:
        r = o.get("rect") or {"x": int(o["x"]), "y": int(o["y"]), "w": 1, "h": 1}
        for y in range(r["y"], r["y"] + r["h"]):
            for x in range(r["x"], r["x"] + r["w"]):
                quoi = emprise_neuve(x, y)
                if quoi:
                    sortie.append(f"objet {o['id']} ({o['type']}, {o['x']}, {o['y']}): dans {quoi}")
                    break
            else:
                continue
            break
    for p in carte["points"]:
        quoi = emprise_neuve(int(math.floor(p["x"])), int(math.floor(p["y"])))
        if quoi:
            sortie.append(f"point {p['id']} ({p['x']}, {p['y']}): dans {quoi}")
    return sortie


# Arbres anciens à déplacer: retirés de la maquette pour les calculs suivants. Trois arbres de
# l'ancienne rangée du bord nord, hors des emprises mais dans le cône de la caméra du parvis (sud-est
# et sud-ouest du portail), s'y ajoutent.
DEGAGER = {"tree_oak_36", "tree_oak_37", "tree_oak_40"}
A_DEPLACER = {(o["x"], o["y"]) for o in ANCIENS_OBJETS
              if o["type"].startswith("tree")
              and (emprise_neuve(int(o["x"]), int(o["y"])) or o["id"] in DEGAGER)}
ARBRES = [a for a in ARBRES if (a[0], a[1]) not in A_DEPLACER]

# ---------------------------------------------------------------------------
# Cases bloquées.

BLOQUANT = set("X~rek")
grille_anc = carte["infranchissable"]["grille"]
bloque = [[False] * LARG for _ in range(HAUT)]
for y in range(OY, Y1 + 1):
    for x in range(OX, X1 + 1):
        c = lit(x, y)
        b = c in BLOQUANT
        if 0 <= x < ANC_L and 0 <= y < ANC_H and grille_anc[y][x] == "#" and ANCIENNES[y][x] != "X":
            b = True
            if emprise_neuve(x, y) and not any(int(a) == x and int(bb) == y for a, bb in A_DEPLACER):
                b = c in BLOQUANT
            if any(int(a) == x and int(bb) == y for a, bb in A_DEPLACER):
                b = c in BLOQUANT
        bloque[y - OY][x - OX] = b
for b in BATIMENTS:
    x0, y0, x1, y1 = b["r"]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            bloque[y - OY][x - OX] = True
    for (px, py) in b["portes"]:
        bloque[py - OY][px - OX] = False
for (ax, ay, ess) in ARBRES:
    if dans(int(ax), int(ay)) and not (0 <= ax < ANC_L and 0 <= ay < ANC_H):
        bloque[int(ay) - OY][int(ax) - OX] = True
for (ax, ay, ess) in ARBRES:
    if ess in ("vieux_chene", "fruitier") or ay < 0 or ax >= ANC_L or ax < 0:
        bloque[int(ay) - OY][int(ax) - OX] = True


def libre(x: int, y: int) -> bool:
    return dans(x, y) and not bloque[y - OY][x - OX]


def dijkstra(depart: tuple[int, int]) -> dict[tuple[int, int], float]:
    dist = {depart: 0.0}
    tas = [(0.0, depart)]
    while tas:
        d, (x, y) = heapq.heappop(tas)
        if d > dist.get((x, y), 1e18):
            continue
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if not libre(nx, ny):
                    continue
                if dx and dy and not (libre(x + dx, y) and libre(x, y + dy)):
                    continue
                nd = d + (math.sqrt(2) if dx and dy else 1.0)
                if nd < dist.get((nx, ny), 1e18):
                    dist[(nx, ny)] = nd
                    heapq.heappush(tas, (nd, (nx, ny)))
    return dist


def case(p: tuple[float, float]) -> tuple[int, int]:
    return int(math.floor(p[0])), int(math.floor(p[1]))


def proche_libre(c: tuple[int, int], dist: dict) -> float | None:
    if c in dist:
        return dist[c]
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            v = dist.get((c[0] + dx, c[1] + dy))
            if v is not None and (best is None or v < best):
                best = v + 1
    return best


def astar_noeuds(a: tuple[int, int], b: tuple[int, int]) -> tuple[int, float]:
    def h(c: tuple[int, int]) -> float:
        dx, dy = abs(c[0] - b[0]), abs(c[1] - b[1])
        return max(dx, dy) + (math.sqrt(2) - 1) * min(dx, dy)
    g = {a: 0.0}
    tas = [(h(a), 0.0, a)]
    fermes = set()
    while tas:
        _, d, c = heapq.heappop(tas)
        if c in fermes:
            continue
        fermes.add(c)
        if c == b:
            return len(fermes), d
        x, y = c
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if not libre(nx, ny) or (dx and dy and not (libre(x + dx, y) and libre(x, y + dy))):
                    continue
                nd = d + (math.sqrt(2) if dx and dy else 1.0)
                if nd < g.get((nx, ny), 1e18):
                    g[(nx, ny)] = nd
                    heapq.heappush(tas, (nd + h((nx, ny)), nd, (nx, ny)))
    return len(fermes), float("nan")


# ---------------------------------------------------------------------------
# Caméra: hauteur des volumes sous un point (toits à deux pans, tours, houppiers).

DIRS = {0: (1, 1), 1: (-1, 1), 2: (-1, -1), 3: (1, -1)}
NOMS_ORIENT = {0: "sud-est", 1: "sud-ouest", 2: "nord-ouest", 3: "nord-est"}

VOLUMES_ANC = []
for o in ANCIENS_OBJETS:
    t = TYPES.get(o["type"], {})
    if t.get("categorie") in ("batiment", "enclos") and o.get("rect"):
        r = o["rect"]
        toit = t.get("toit")
        VOLUMES_ANC.append({"id": o["id"], "r": (r["x"], r["y"], r["x"] + r["w"] - 1, r["y"] + r["h"] - 1),
                            "egout": toit["egout"] if toit else t["hauteur"], "faite": t["hauteur"],
                            "faitage": ("x" if (toit["faitage"] == "parallele") == (o["rotation"] % 2 == 0)
                                        else "y") if toit else None, "tours": []})


def hauteur_volume(v: dict, x: float, y: float) -> float:
    x0, y0, x1, y1 = v["r"]
    if not (x0 <= x < x1 + 1 and y0 <= y < y1 + 1):
        return 0.0
    h = v["faite"]
    if v["faitage"] == "x":
        demi = (y1 + 1 - y0) / 2
        h = v["egout"] + (v["faite"] - v["egout"]) * (1 - abs(y - (y0 + demi)) / demi)
    elif v["faitage"] == "y":
        demi = (x1 + 1 - x0) / 2
        h = v["egout"] + (v["faite"] - v["egout"]) * (1 - abs(x - (x0 + demi)) / demi)
    for (tx0, ty0, tx1, ty1, th) in v["tours"]:
        if tx0 <= x < tx1 + 1 and ty0 <= y < ty1 + 1:
            h = max(h, th)
    return h


VOLUMES = VOLUMES_ANC + BATIMENTS
INDEX_ARBRES: dict[tuple[int, int], list] = {}
for a in ARBRES:
    INDEX_ARBRES.setdefault((int(a[0] // 4), int(a[1] // 4)), []).append(a)


# Forêt du pourtour, semée par le rendu hors du bord jouable (arbres de 3 à 9,5 m): elle ne pousse ni
# sur la voie ni sur la rivière, et recule de 6 m à l'est au droit du hameau (éclaircie à demander au
# rendu, `forestClearings`, côté est, y 15 à 45).
def pourtour(x: float, y: float) -> bool:
    dehors = x < OX + BORD or x >= X1 + 1 - BORD or y < OY + BORD or y >= Y1 + 1 - BORD
    if not dehors:
        return False
    if 12 <= y < 15 or 36 <= y < 44:
        return False
    if x >= X1 + 1 - BORD and 15 <= y < 46 and x < X1 + 1 - BORD + 6:
        return False
    return True


def cache(px: float, py: float, o: int, sauf: str | None = None, h0: float = 1.0) -> str | None:
    dx, dy = DIRS[o]
    k = 0.05
    while k < 14:
        x, y = px + dx * k, py + dy * k
        ray = h0 + k
        if pourtour(x, y) and 2.0 <= ray <= 9.0:
            return "forêt du pourtour"
        for v in VOLUMES:
            if v["id"] == sauf:
                continue
            if hauteur_volume(v, x, y) > ray:
                return v["id"]
        for a in INDEX_ARBRES.get((int(x // 4), int(y // 4)), []) + \
                INDEX_ARBRES.get((int(x // 4) + 1, int(y // 4)), []) + \
                INDEX_ARBRES.get((int(x // 4), int(y // 4) + 1), []) + \
                INDEX_ARBRES.get((int(x // 4) - 1, int(y // 4)), []) + \
                INDEX_ARBRES.get((int(x // 4), int(y // 4) - 1), []):
            haut, base, rayon, _ = ESSENCES[a[2]]
            if base <= ray <= haut and (x - a[0]) ** 2 + (y - a[1]) ** 2 <= rayon ** 2:
                return "arbre " + a[2]
        k += 0.1
    return None


def batiment_du_point(pid: str) -> str | None:
    px, py = POINTS[pid][0], POINTS[pid][1]
    for b in BATIMENTS:
        for (dx_, dy_) in b["portes"]:
            if abs(dx_ + 0.5 - px) <= 1.6 and abs(dy_ + 0.5 - py) <= 1.6:
                return b["id"]
    return None


# ---------------------------------------------------------------------------
# Estimation des triangles par vue (cadre de 36 m, rapport 1366 x 768).

# Plafonds proposés à l'artiste 3D (document, section 11.3); `--large` reprend les modèles actuels
# de même taille (épicerie 11 536, mercerie 6 252, maison de Lucie 3 480) pour comparer.
TRI_MODELES = {
    "church": 8000, "presbytery": 3500, "sexton_house": 2800, "cafe": 5000, "forge": 3200, "joinery": 3200,
    "hamlet_house_a": 2800, "hamlet_house_b": 2800, "hamlet_house_c": 2800, "washhouse": 1200,
    "barn": 3200, "farmhouse": 4000, "mill": 6000, "rail_cottage_west": 2800, "rail_cottage_east": 2800,
    "forester_house": 2500,
}
if "--large" in sys.argv:
    TRI_MODELES = {k: int(v * 1.3) for k, v in TRI_MODELES.items()}
TRI_ANCIENS = {"station": 4016, "platform": 3328, "gatekeeper_house": 8256, "ferrand_shop": 11536,
               "firmin_house": 4524, "sawmill": 1944, "handcar_shed": 1480, "henhouse": 2468, "well": 658,
               "bakehouse": 4348, "salon_shop": 6252, "lucie_house": 3480, "school_house": 5044,
               "school_yard": 1500, "bush": 100, "rock": 40, "fence": 36, "lamp_post": 248, "bench": 316,
               "bramble": 860, "bush_hazel": 160, "barrel": 276, "log_pile": 312, "arbor": 876}
SOUS_BOIS_PAR_M2 = 1 / 7.0       # fougères, houx, ronces: un pied pour 7 m² de sous-bois
TRI_SOUS_BOIS = 150
TRI_TOMBES = 60 * 48 + 1500       # 48 tombes, murs et croix
TRI_VIGNE = 150 * 24              # 8 rangs de 9 m en tronçons de 3 m
# Mesure de l'ADR 0016 (place, zoom 2, orientation 2, 19 h, carte de 64 m): 201 830 triangles. La part
# hors objets (sol, eau, voie, quai, semis, forêt du pourtour) s'en déduit; elle sert de base, prudente
# pour les vues sans rivière ni voie.
MESURE_PLACE = 201830


def dans_cadre(x: float, y: float, cx: float, cy: float, o: int, largeur: float = 36.0) -> bool:
    dx, dy = DIRS[o]
    rx, ry = x - cx, y - cy
    u = (rx * dy - ry * dx) / math.sqrt(2)        # horizontale de l'écran
    v = (rx * dx + ry * dy) / math.sqrt(2)        # profondeur (vers la caméra)
    demi_h = largeur * 768 / 1366 / 2 / math.sin(math.radians(35.264))
    return abs(u) <= largeur / 2 + 2 and -demi_h - 6 <= v <= demi_h + 2


def triangles_vue(cx: float, cy: float, o: int) -> dict:
    total = 0
    detail = {"batiments": 0, "arbres": 0, "sous-bois": 0, "decor": 0}
    for b in BATIMENTS:
        x0, y0, x1, y1 = b["r"]
        if dans_cadre((x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, cx, cy, o):
            detail["batiments"] += TRI_MODELES.get(b["id"], 3000)
    for ob in ANCIENS_OBJETS:
        if ob["type"].startswith("tree"):
            continue
        if dans_cadre(ob["x"], ob["y"], cx, cy, o):
            detail["decor" if TRI_ANCIENS.get(ob["type"], 200) < 1000 else "batiments"] += \
                TRI_ANCIENS.get(ob["type"], 200)
    for a in ARBRES:
        if dans_cadre(a[0], a[1], cx, cy, o):
            detail["arbres"] += ESSENCES[a[2]][3]
    sb = 0
    for y in range(OY, Y1 + 1):
        for x in range(OX, X1 + 1):
            if lit(x, y) == "h" and dans_cadre(x + 0.5, y + 0.5, cx, cy, o):
                sb += 1
    detail["sous-bois"] = int(sb * SOUS_BOIS_PAR_M2 * TRI_SOUS_BOIS)
    if dans_cadre(116, -12, cx, cy, o):
        detail["decor"] += TRI_TOMBES
    if dans_cadre(102, 5, cx, cy, o):
        detail["decor"] += TRI_VIGNE
    # Passe d'ombre: bâtiments, arbres et décor une seconde fois; le sous-bois ne porte pas d'ombre.
    total = 2 * (detail["batiments"] + detail["arbres"] + detail["decor"]) + detail["sous-bois"]
    detail["total_objets_ombre_comprise"] = total
    return detail


# ---------------------------------------------------------------------------
# Sorties.


def grille_ascii(pas: int = 1) -> list[str]:
    calque = [row[:] for row in terrain]
    for b in BATIMENTS:
        x0, y0, x1, y1 = b["r"]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                calque[y - OY][x - OX] = b["lettre"]
        for (px, py) in b["portes"]:
            calque[py - OY][px - OX] = "D"
    lettres_anc = {"station": "H", "gatekeeper_house": "M", "ferrand_shop": "E", "firmin_house": "F",
                   "sawmill": "S", "handcar_shed": "R", "henhouse": "U", "bakehouse": "B", "salon_shop": "W",
                   "lucie_house": "L", "school_house": "K", "school_yard": "Z", "well": "O"}
    for o in ANCIENS_OBJETS:
        if o["type"] in lettres_anc and o.get("rect"):
            r = o["rect"]
            for y in range(r["y"], r["y"] + r["h"]):
                for x in range(r["x"], r["x"] + r["w"]):
                    calque[y - OY][x - OX] = lettres_anc[o["type"]]
    for a in ARBRES:
        x, y = int(a[0]), int(a[1])
        if dans(x, y):
            calque[y - OY][x - OX] = {"fruitier": "t", "vieux_chene": "@"}.get(a[2], "T")
    lignes = []
    if pas == 1:
        cases_ent = [" "] * LARG
        for x in range(OX, X1 + 1):
            if x % 10 == 0:
                for i, ch in enumerate(str(x)):
                    if x - OX + i < LARG:
                        cases_ent[x - OX + i] = ch
        ent1 = "      " + "".join(cases_ent)
        ent2 = "      " + "".join(str(abs(x) % 10) for x in range(OX, X1 + 1))
        lignes += [ent1, ent2]
        for y in range(OY, Y1 + 1):
            lignes.append(f"{y:4d}  " + "".join(calque[y - OY]))
        return lignes
    priorite = "GNVQJIyx4z1234567HMEFSRUBWLKZDO@t~rekT=#+:;cvpfbgqYPj,.hX"
    ent = "      " + "".join(str(((x // 10) % 10)) if x % 10 == 0 else (" " if x % 2 == 0 else "")
                            for x in range(OX, X1 + 1, 1) if x % pas == 0)
    lignes.append("      " + "".join(f"{x:<10d}"[:5] if (x - OX) % 10 == 0 else "" for x in range(OX, X1 + 1, 2)))
    for y in range(OY, Y1 + 1, pas):
        s = ""
        for x in range(OX, X1 + 1, pas):
            bloc = [calque[yy - OY][xx - OX] for yy in range(y, min(y + pas, Y1 + 1))
                    for xx in range(x, min(x + pas, X1 + 1))]
            s += min(bloc, key=lambda c: priorite.index(c) if c in priorite else 99)
        lignes.append(f"{y:4d}  " + s)
    del ent
    return lignes


COULEURS = {".": "#b9d48f", ",": "#9fc276", ":": "#d8c08f", "+": "#c7c2b8", "p": "#8a6a45", "~": "#5a8fc4",
            "g": "#8fb3d1", "b": "#e2d6a8", "=": "#7a6f66", "#": "#a77e4f", "q": "#d9d2c3", "X": "#3f5b39",
            "r": "#4f86c2", "P": "#b8b2a6", "Y": "#a77e4f", "j": "#a9a9a9", "h": "#5f7f4a", ";": "#b49a6a",
            "e": "#4d7fb3", "k": "#4f86c2", "c": "#cfc6b0", "v": "#7d9a4a", "f": "#7f8f52", "s": "#ccb38a"}


def plan_svg() -> str:
    t = 9
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{LARG * t}" height="{HAUT * t + 40}" '
           f'font-family="DejaVu Sans" font-size="13">',
           f'<rect width="100%" height="100%" fill="#ffffff"/>']
    for y in range(OY, Y1 + 1):
        for x in range(OX, X1 + 1):
            c = COULEURS.get(lit(x, y), "#dddddd")
            out.append(f'<rect x="{(x - OX) * t}" y="{(y - OY) * t}" width="{t}" height="{t}" fill="{c}"/>')
    out.append(f'<rect x="{(0 - OX) * t}" y="{(0 - OY) * t}" width="{ANC_L * t}" height="{ANC_H * t}" '
               f'fill="none" stroke="#c03030" stroke-width="2" stroke-dasharray="6 4"/>')
    for o in ANCIENS_OBJETS:
        tt = TYPES.get(o["type"], {})
        if tt.get("categorie") in ("batiment", "enclos") and o.get("rect"):
            r = o["rect"]
            out.append(f'<rect x="{(r["x"] - OX) * t}" y="{(r["y"] - OY) * t}" width="{r["w"] * t}" '
                       f'height="{r["h"] * t}" fill="#8c7b6b" stroke="#3b2f25"/>')
    for b in BATIMENTS:
        x0, y0, x1, y1 = b["r"]
        out.append(f'<rect x="{(x0 - OX) * t}" y="{(y0 - OY) * t}" width="{(x1 - x0 + 1) * t}" '
                   f'height="{(y1 - y0 + 1) * t}" fill="#b5654a" stroke="#3b2f25"/>')
        for (tx0, ty0, tx1, ty1, _) in b["tours"]:
            out.append(f'<rect x="{(tx0 - OX) * t}" y="{(ty0 - OY) * t}" width="{(tx1 - tx0 + 1) * t}" '
                       f'height="{(ty1 - ty0 + 1) * t}" fill="#7d3b2a"/>')
        for (px, py) in b["portes"]:
            out.append(f'<rect x="{(px - OX) * t + 1}" y="{(py - OY) * t + 1}" width="{t - 2}" height="{t - 2}" '
                       f'fill="#ffe36a"/>')
    for a in ARBRES:
        r = ESSENCES[a[2]][2]
        coul = {"fruitier": "#c9a227", "vieux_chene": "#1f3d17"}.get(a[2], "#2f5a26")
        out.append(f'<circle cx="{(a[0] - OX) * t}" cy="{(a[1] - OY) * t}" r="{r * t * 0.6:.1f}" '
                   f'fill="{coul}" fill-opacity="0.75"/>')
    for i, (pid, (px, py, imp, _)) in enumerate(sorted(POINTS.items())):
        out.append(f'<circle cx="{(px - OX) * t}" cy="{(py - OY) * t}" r="3.2" '
                   f'fill="{"#ffffff" if imp else "#ff4fd8"}" stroke="#000000"/>')
    courts = {"church": "Église", "presbytery": "Presb.", "sexton_house": "1", "cafe": "Café", "forge": "Forge",
              "joinery": "Menuis.", "hamlet_house_a": "2", "hamlet_house_b": "3", "hamlet_house_c": "5",
              "washhouse": "Lav.", "barn": "Grange", "farmhouse": "4 Ferme", "mill": "Moulin",
              "rail_cottage_west": "6", "rail_cottage_east": "7", "forester_house": "Forest."}
    for b in BATIMENTS:
        x0, y0, x1, y1 = b["r"]
        out.append(f'<text x="{(x0 - OX) * t + 2}" y="{((y0 + y1 + 1) / 2 - OY) * t + 4}" fill="#ffffff" '
                   f'font-weight="bold">{courts.get(b["id"], b["id"])}</text>')
    etiquettes = [("Bois de la Côte", 6, -4), ("Bois de la Cure", 66, -25), ("Clairière", 20, -11),
                  ("Mare", 40, -24), ("Source", 52, -24), ("Belvédère", 1, -27), ("La coupe", -19, -9),
                  ("Friche", -8, 38), ("Jardins", 90, 37), ("Champs du Haut", 108, -1),
                  ("Verger", 127, -1), ("Cimetière", 110, -12), ("Vigne", 100, 6), ("Pâture", 127, 39),
                  ("Prés du Haut", 120, -24), ("Parc à grumes", -21, 10), ("carte actuelle (100 x 48)", 1, 45)]
    for (txt, x, y) in etiquettes:
        out.append(f'<text x="{(x - OX) * t}" y="{(y - OY) * t}" fill="#000000" font-weight="bold" '
                   f'stroke="#ffffff" stroke-width="3" paint-order="stroke">{txt}</text>')
    for x in range(-20, X1, 10):
        out.append(f'<text x="{(x - OX) * t + 1}" y="{HAUT * t + 12}" fill="#444444" font-size="10">x {x}</text>')
    for y in range(-30, Y1, 10):
        out.append(f'<text x="2" y="{(y - OY) * t + 10}" fill="#ffffff" font-size="10">y {y}</text>')
    out.append(f'<text x="8" y="{HAUT * t + 24}" fill="#000000">Maquette de la Halte 0.13: {LARG} x {HAUT} m, '
               f'origine de la grille en ({OX} ; {OY}); points blancs: lieux importants, roses: secrets; '
               f'tirets rouges: carte actuelle.</text>')
    out.append("</svg>")
    return "\n".join(out)


def main() -> int:
    args = set(sys.argv[1:])
    if "--ascii" in args:
        print("\n".join(grille_ascii(1)))
        return 0
    if "--apercu" in args:
        print("\n".join(grille_ascii(2)))
        return 0
    print(f"Grille: {LARG} x {HAUT} m (x {OX} à {X1}, y {OY} à {Y1}), {LARG * HAUT} cases, "
          f"{LARG * HAUT / (ANC_L * ANC_H):.2f} fois la carte actuelle")
    franch = sum(1 for y in range(HAUT) for x in range(LARG) if not bloque[y][x])
    print(f"Cases franchissables: {franch}")
    foret = [a for a in ARBRES if a[1] < 2 and a[0] < 84]
    sb = sum(1 for y in range(OY, 2) for x in range(OX, 84) if lit(x, y) == "h")
    print(f"Arbres semés et anciens: {len(ARBRES)} (dont {len(foret)} au nord de y 2 et à l'ouest de x 84); "
          f"sous-bois {sb} m², soit un arbre pour {sb / max(1, len(foret)):.1f} m²")

    porte = (8, 27)
    dist = dijkstra(porte)
    atteint = len(dist)
    print(f"Cases atteintes depuis la porte de la maisonnette: {atteint} sur {franch}")
    poches = franch - atteint
    if poches:
        isoles = [(x + OX, y + OY) for y in range(HAUT) for x in range(LARG)
                  if not bloque[y][x] and (x + OX, y + OY) not in dist]
        print(f"  cases isolées: {poches}, par exemple {isoles[:12]}")
    print("\nDistances depuis la porte de la maisonnette (3,5 m/s):")
    for pid, (px, py, imp, role) in POINTS.items():
        d = proche_libre(case((px, py)), dist)
        txt = "injoignable" if d is None else f"{d:5.1f} m  {d / VITESSE:4.1f} s"
        print(f"  {pid:24s} {txt}   {role}")

    print("\nDepuis la place (village_square, 38,5 ; 30,5):")
    dist_place = dijkstra((38, 30))
    for pid in ("mill_door", "clearing_center", "spring", "church_porch", "cemetery_gate", "cafe_door",
                "forge_yard", "shared_garden_pump", "washhouse", "farm_door", "field_high_01", "orchard"):
        d = proche_libre(case(POINTS[pid][:2]), dist_place)
        print(f"  {pid:24s} {d:5.1f} m  {d / VITESSE:4.1f} s")
    print("\nEntre lieux neufs (trajets probables des habitants):")
    paires = [("mill_door", "cafe_door"), ("forester_house_door", "forest_cut"), ("presbytery_door", "church_porch"),
              ("sexton_house_door", "church_porch"), ("forge_yard", "farm_door"), ("joinery_yard", "log_yard"),
              ("farm_door", "field_high_01"), ("rail_cottage_east_door", "church_porch"),
              ("cafe_door", "church_porch"), ("hamlet_house_c_door", "washhouse"), ("clearing_center", "spring")]
    for a, b in paires:
        da = dijkstra(case(POINTS[a][:2]))
        d = proche_libre(case(POINTS[b][:2]), da)
        print(f"  {a:24s} vers {b:22s} {d:5.1f} m  {d / VITESSE:4.1f} s")
    n_foret = sum(1 for a in ARBRES if lit(int(a[0]), int(a[1])) in "h,;" and (a[1] < 2 or a[0] < 0))
    print(f"\nArbres de la forêt (bois de la Côte, de la Cure, ouest): {n_foret}")

    print("\nLignes de vue des lieux importants (orientations où le lieu est caché, et par quoi):")
    defaut_cache = []
    une_seule = []
    for pid, (px, py, imp, role) in POINTS.items():
        if not imp:
            continue
        sauf = batiment_du_point(pid)
        caches = {o: cache(px, py, o, sauf) for o in range(4)}
        vus = [o for o in range(4) if caches[o] is None]
        if caches[0] is not None:
            defaut_cache.append(pid)
        elif len(vus) < 2:
            une_seule.append(pid)
        if any(caches.values()):
            print(f"  {pid:24s} vu {','.join(NOMS_ORIENT[o] for o in vus) or 'nulle part'}; caché: " +
                  "; ".join(f"{NOMS_ORIENT[o]} par {c}" for o, c in caches.items() if c))
    print(f"  cachés depuis la caméra par défaut: {defaut_cache or 'aucun'}")
    print(f"  vus depuis une seule orientation: {une_seule or 'aucun'}")

    print("\nObjets et points actuels pris dans une emprise ou un chemin neufs:")
    for ligne in conflits():
        print("  " + ligne)

    print("\nTriangles des objets par vue (zoom 2, 36 m, ombre comprise; sans sol, semis ni personnages):")
    vues = [("place (référence)", 40, 28, 2), ("rue Haute (référence)", 77, 24, 0), ("lisière (référence)", 27, 6, 0),
            ("clairière du Vieux Chêne", 26, -13, 0), ("clairière, orientation 2", 26, -13, 2),
            ("source et procession", 60, -20, 0), ("mare", 44, -19, 1), ("coupe et maison forestière", -8, -12, 0),
            ("parvis et église", 95, -4, 0), ("cimetière", 115, -10, 0), ("rue de l'Église au PN", 95, 12, 0),
            ("carrefour du café", 92, 20, 2), ("forge et menuiserie", 105, 19, 0), ("jardins de la Rive", 97, 29, 0),
            ("ferme", 120, 31, 0), ("moulin", -12, 30, 0), ("cheminots et friche", -5, 24, 1)]
    base = MESURE_PLACE - triangles_vue(40, 28, 2)["total_objets_ombre_comprise"]
    print(f"  base déduite de la mesure de la place: {base} triangles (sol, eau, voie, semis, pourtour)")
    for nom, cx, cy, o in vues:
        d = triangles_vue(cx, cy, o)
        tot = d["total_objets_ombre_comprise"]
        print(f"  {nom:30s} ({cx:4d};{cy:4d}) o{o}: objets {tot:7d}, estimation {base + tot:7d}  "
              f"(bâtiments {d['batiments']}, arbres {d['arbres']}, sous-bois {d['sous-bois']}, décor {d['decor']})")

    print("\nA* (grille.ts: huit directions, heuristique octile, plafond maxNodes 4 000), noeuds développés:")
    trajets = [("maisonnette", (8, 27), "église", case(POINTS["church_porch"][:2])),
               ("maisonnette", (8, 27), "ferme", case(POINTS["farm_door"][:2])),
               ("maisonnette", (8, 27), "source", case(POINTS["spring"][:2])),
               ("moulin", case(POINTS["mill_door"][:2]), "fournil", (68, 21)),
               ("maison forestière", case(POINTS["forester_house_door"][:2]), "café", case(POINTS["cafe_door"][:2])),
               ("hameau C", case(POINTS["hamlet_house_c_door"][:2]), "place", (38, 30)),
               ("cheminots ouest", case(POINTS["rail_cottage_west_door"][:2]), "cimetière",
                case(POINTS["cemetery_gate"][:2]))]
    for (na, a, nb, b) in trajets:
        n, longueur = astar_noeuds(a, b)
        print(f"  {na:18s} vers {nb:10s}: {n:6d} noeuds, {longueur:6.1f} m ({longueur / VITESSE:4.1f} s)")

    if "--png" in args:
        SORTIE_SVG.write_text(plan_svg(), encoding="utf-8")
        if shutil.which("rsvg-convert"):
            SORTIE_PNG.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["rsvg-convert", "-o", str(SORTIE_PNG), str(SORTIE_SVG)], check=True)
            SORTIE_SVG.unlink()
            print(f"\nPlan: {SORTIE_PNG.relative_to(RACINE)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
