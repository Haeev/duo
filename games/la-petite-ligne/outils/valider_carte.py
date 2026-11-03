#!/usr/bin/env python3
"""Valide une carte de La Petite Ligne (par défaut donnees/cartes/halte.json).

Contrôles:
1. format: clés, tailles, légende, types, rotations, emprises entières, identifiants uniques;
2. cohérence: terrain sous les bâtiments et le quai, potager, grille `infranchissable` recalculée;
3. emprises qui ne se chevauchent pas, objets sur un sol permis;
4. atteignabilité à pied depuis l'apparition (parcours en largeur, 8 voisins sans couper
   les angles), avec et sans le train à quai; portes dégagées; aucune poche isolée;
5. trajets clés de 25 s au plus à 3,5 m/s, portage de la poutre dans un couloir assez large;
6. pêche (eau profonde à 6 m au plus), cueillette au bord du bois, arbres à couper accessibles;
7. caméra isométrique: chaque lieu important visible depuis l'orientation par défaut
   (sud-est) et depuis au moins une autre orientation;
8. points et zones demandés par les données du jeu (donnees/*.json, README section 5);
9. tour 10 (ADR 0016): bâtiments visitables (pièces dans l'emprise et hors des murs, porte sur le
   pourtour et devant une case libre, pièce d'un seul tenant malgré le mobilier fixe, au moins une case
   entre deux bâtiments visitables, aucune pièce partagée), pièces à bâtir (emprise libre, porte dans le
   mur commun, carte entière atteignable une fois bâties); le ru de la Côte franchissable aux seuls
   passages prévus, chacun reliant les deux rives; portes des lieux vues dans trois orientations sur
   quatre; rue de la halte jamais cachée par les maisons basses du sud; rien de planté sur un passage.
10. clôtures (retours du 2026-11-02): chaque bout de file et chaque bord d'ouverture finit sur un poteau.

Usage: python3 games/la-petite-ligne/outils/valider_carte.py [carte.json]
Bibliothèque standard uniquement. Code de sortie 1 s'il reste une erreur.
"""

from __future__ import annotations

import heapq
import json
import math
import re
import sys
from pathlib import Path
from typing import Any

ICI = Path(__file__).resolve().parent
DONNEES = ICI.parent / "donnees"
CARTE_PAR_DEFAUT = DONNEES / "cartes" / "halte.json"

# Points et zones que le code et les données attendent (donnees/README.md, section 5).
ATTENDUS = [
    "train_stop", "quay_bell", "quay_bench", "bell_shadow_spot", "coop_crate", "house_door", "house_beam_spot",
    "house_attic", "beam_pickup", "garden", "chicken_coop", "village_square", "grocery_counter", "grocery_door",
    "grocery_terrace", "firmin_house", "sawmill_workbench", "sawmill_yard", "forest_edge", "riverbank",
    "well", "water_barrel", "notice_board", "handcar_shed", "house_interior", "river_ford",
]
HORS_CARTE = {"offstage"}

ELEVATION = math.radians(35.264)
TAN_E = math.tan(ELEVATION)
# Direction horizontale vers la caméra (x vers l'est, y vers le sud).
ORIENTATIONS = {
    "sud-est": (1.0, 1.0),
    "sud-ouest": (-1.0, 1.0),
    "nord-ouest": (-1.0, -1.0),
    "nord-est": (1.0, -1.0),
}
PAR_DEFAUT = "sud-est"
HAUTEUR_PERSONNAGE = 1.0  # on veut voir le buste (personnage de 1,7 m)
HAUTEUR_TRAIN = 3.8
SQRT2 = math.sqrt(2.0)

VOISINS = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
           (-1, -1, SQRT2), (1, -1, SQRT2), (-1, 1, SQRT2), (1, 1, SQRT2)]


class Rapport:
    def __init__(self) -> None:
        self.erreurs: list[str] = []
        self.avertissements: list[str] = []
        self.infos: list[str] = []

    def erreur(self, msg: str) -> None:
        self.erreurs.append(msg)

    def avert(self, msg: str) -> None:
        self.avertissements.append(msg)

    def info(self, msg: str) -> None:
        self.infos.append(msg)


# ---------------------------------------------------------------------------
# Grille en coordonnées de la carte (0.13: origine de la grille, `taille.origine`)


class Rangee:
    """Une rangée de la grille, indexée par x de la carte (négatif à l'ouest de l'origine)."""

    __slots__ = ("_v", "_ox")

    def __init__(self, valeurs: list | str, ox: int) -> None:
        self._v = valeurs
        self._ox = ox

    def _i(self, x: int) -> int:
        i = x - self._ox
        if i < 0 or i >= len(self._v):
            # Une liste Python lirait silencieusement l'autre bout de la rangée pour un indice négatif.
            raise IndexError(f"x {x} hors de la grille")
        return i

    def __getitem__(self, x: int):
        return self._v[self._i(x)]

    def __setitem__(self, x: int, valeur: object) -> None:
        self._v[self._i(x)] = valeur  # type: ignore[index]

    def __len__(self) -> int:
        return len(self._v)


class Grille:
    """Grille de cases indexée `g[y][x]` en coordonnées de la carte, avec ses bornes (`xs`, `ys`, `dans`)."""

    def __init__(self, ox: int, oy: int, rangees: list) -> None:
        self.ox, self.oy = ox, oy
        self.haut = len(rangees)
        self.larg = len(rangees[0]) if rangees else 0
        self._r = [Rangee(r, ox) for r in rangees]
        self.xs = range(ox, ox + self.larg)
        self.ys = range(oy, oy + self.haut)

    @classmethod
    def pleine(cls, ox: int, oy: int, larg: int, haut: int, valeur: object) -> "Grille":
        return cls(ox, oy, [[valeur] * larg for _ in range(haut)])

    def __getitem__(self, y: int) -> Rangee:
        i = y - self.oy
        if i < 0 or i >= self.haut:
            raise IndexError(f"y {y} hors de la grille")
        return self._r[i]

    def __len__(self) -> int:
        return self.haut

    def dans(self, x: int, y: int) -> bool:
        return self.ox <= x < self.ox + self.larg and self.oy <= y < self.oy + self.haut

    def cases(self):
        for y in self.ys:
            for x in self.xs:
                yield x, y

    def copie(self) -> "Grille":
        return Grille(self.ox, self.oy, [list(r._v) for r in self._r])

    def textes(self) -> list[str]:
        return ["".join(r._v) for r in self._r]


def origine(carte: dict) -> tuple[int, int]:
    """Case nord-ouest de la grille (0.13: x -24, y -30); (0, 0) sur les cartes d'avant."""
    o = carte["taille"].get("origine") or {"x": 0, "y": 0}
    return int(o["x"]), int(o["y"])


def grille_terrain(carte: dict) -> Grille:
    ox, oy = origine(carte)
    return Grille(ox, oy, list(carte["terrain"]["lignes"]))


# ---------------------------------------------------------------------------
# Géométrie partagée avec le script de construction


def taille_monde(type_def: dict, rotation: int) -> tuple[int, int]:
    larg, prof = type_def["emprise"]
    return (larg, prof) if rotation % 2 == 0 else (prof, larg)


def poteaux_de_cloture(objets: list[dict]) -> tuple[set, list[tuple[str, tuple[float, float]]]]:
    """Poteaux des segments `fence` et bouts de segment sans poteau.

    Le segment du modèle (`fence_wood`, 1 m le long de son x) ne porte qu'un poteau, à x = -0,5:
    une file de n segments a n poteaux et il lui en faut n + 1. Le constructeur pose un poteau
    (accroche `fence_post`) à chaque bout rendu ici; le contrôle des clôtures s'en sert aussi.
    """
    poteaux: set = set()
    bouts: list[tuple[str, tuple[float, float]]] = []
    for o in objets:
        if o["type"] != "fence":
            continue
        a = o["rotation"] * math.pi / 2
        c, s = round(math.cos(a)), round(math.sin(a))
        # Repère du rendu (rotation.y = rotation x PI/2): le x local -0,5 va en (-0,5 cos ; +0,5 sin).
        poteaux.add((o["x"] - 0.5 * c, o["y"] + 0.5 * s))
        bouts.append((o["id"], (o["x"] + 0.5 * c, o["y"] - 0.5 * s)))
    return poteaux, [(i, b) for i, b in bouts if b not in poteaux]


def controler_clotures(carte: dict, rapport: Rapport) -> None:
    """Toute clôture finit sur un poteau, et chaque bord d'ouverture aussi (retours du 2026-11-02, S08).

    Un bout de lisse est porté par le poteau d'un segment voisin ou par une accroche `fence_post` posée
    exactement là. Un bord d'ouverture est un bout de file: le même contrôle le couvre.
    """
    poteaux, sans = poteaux_de_cloture(carte["objets"])
    accroches = {(a["x"], a["y"]) for a in carte.get("accroches", []) if a.get("modele") == "fence_post"}
    fences = {o["id"] for o in carte["objets"] if o["type"] == "fence"}
    for a in carte.get("accroches", []):
        if a.get("modele") == "fence_post" and a.get("sur") not in fences:
            rapport.erreur(f"poteau {a['id']}: porté par {a.get('sur')!r}, qui n'est pas une clôture")
    for seg, (x, y) in sans:
        if (x, y) not in accroches:
            rapport.erreur(f"clôture {seg}: les lisses finissent dans le vide en ({x}, {y}), sans poteau")
    for x, y in accroches - {b for _, b in sans}:
        if (x, y) not in poteaux:
            rapport.erreur(f"poteau de clôture en ({x}, {y}): aucun bout de lisse à porter")


def emprise_monde(o: dict, types: dict) -> tuple[int, int, int, int]:
    """Rectangle (x0, y0, w, h) en cases d'un objet posé par son centre."""
    w, h = taille_monde(types[o["type"]], o["rotation"])
    x0 = o["x"] - w / 2
    y0 = o["y"] - h / 2
    return int(round(x0)), int(round(y0)), w, h


def locale_vers_monde(i: int, j: int, larg: int, prof: int, r: int) -> tuple[int, int]:
    """Case locale (i le long de la façade, j de l'arrière vers la façade) vers le décalage monde."""
    if r == 0:
        return i, j
    if r == 1:
        return j, larg - 1 - i
    if r == 2:
        return larg - 1 - i, prof - 1 - j
    return prof - 1 - j, i


DEHORS = {0: (0, 1), 1: (1, 0), 2: (0, -1), 3: (-1, 0)}


def ouvertures(o: dict, types: dict) -> dict[str, tuple[tuple[int, int], tuple[int, int]]]:
    """Pour chaque ouverture: (case de l'ouverture, case devant, dehors)."""
    t = types[o["type"]]
    res: dict[str, tuple[tuple[int, int], tuple[int, int]]] = {}
    if "portes" not in t:
        return res
    x0, y0, _, _ = emprise_monde(o, types)
    larg, prof = t["emprise"]
    r = o["rotation"]
    for nom, dec in t["portes"].items():
        u, v = locale_vers_monde(dec, prof - 1, larg, prof, r)
        cx, cy = x0 + u, y0 + v
        dx, dy = DEHORS[r]
        res[nom] = ((cx, cy), (cx + dx, cy + dy))
    return res


def cases_interieures(o: dict, types: dict) -> list[tuple[int, int]]:
    x0, y0, w, h = emprise_monde(o, types)
    return [(x, y) for y in range(y0 + 1, y0 + h - 1) for x in range(x0 + 1, x0 + w - 1)]


def cases_rect(r: dict) -> list[tuple[int, int]]:
    return [(x, y) for y in range(r["y"], r["y"] + r["h"]) for x in range(r["x"], r["x"] + r["w"])]


def est_porte(nom: str) -> bool:
    """Seules les ouvertures `porte` laissent passer; comptoir, guichet, vitrine et portail sont fermés."""
    return nom.startswith("porte")


def calculer_infranchissable(carte: dict, pieces_baties: bool = False) -> dict:
    """Grille de marche: '#' bloqué, '.' libre. Même calcul pour la construction et le contrôle.

    Un bâtiment à intérieur décrit dans `interieurs` n'ouvre que ses pièces (moins le mobilier fixe); sinon,
    toutes ses cases intérieures. `pieces_baties`: ajoute les pièces `a_batir` (cellier, chambre) comme si
    elles étaient bâties (emprise bloquée, pièce et porte du mur commun libres), pour les contrôles.
    """
    bord = carte["taille"]["bord"]
    legende = carte["terrain"]["legende"]
    ox, oy = origine(carte)
    g = Grille(ox, oy, [[bool(legende[c]["franchissable"]) for c in ligne] for ligne in carte["terrain"]["lignes"]])
    types = carte["types"]
    dans = g.dans

    interieurs = {b["objet"]: b for b in carte.get("interieurs", [])}

    # Les sols posés (ponton) rendent leur emprise franchissable.
    for o in carte["objets"]:
        t = types[o["type"]]
        if t["categorie"] == "sol" and t.get("franchissable"):
            x0, y0, w, h = emprise_monde(o, types)
            for y in range(y0, y0 + h):
                for x in range(x0, x0 + w):
                    if dans(x, y):
                        g[y][x] = True
    for o in carte["objets"]:
        t = types[o["type"]]
        if t["categorie"] == "sol" or t.get("franchissable"):
            continue
        x0, y0, w, h = emprise_monde(o, types)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if dans(x, y):
                    g[y][x] = False
        if t["categorie"] == "batiment" and t.get("interieur"):
            decrit = interieurs.get(o["id"])
            if decrit is None:
                ouvert = cases_interieures(o, types)
            else:
                ouvert = [c for pc in decrit["pieces"] if not pc.get("a_batir") for c in cases_rect(pc["rect"])]
            for x, y in ouvert:
                g[y][x] = True
            for nom, ((cx, cy), _) in ouvertures(o, types).items():
                if est_porte(nom):
                    g[cy][cx] = True
    for b in interieurs.values():
        if pieces_baties:
            for pc in b["pieces"]:
                if not pc.get("a_batir"):
                    continue
                for x, y in cases_rect(pc["emprise"]):
                    if dans(x, y):
                        g[y][x] = False
                for x, y in cases_rect(pc["rect"]):
                    g[y][x] = True
                g[pc["porte"]["cy"]][pc["porte"]["cx"]] = True
        for m in b.get("mobilier", []):
            for x, y in m["cases"]:
                if dans(x, y):
                    g[y][x] = False
    for x, y in g.cases():
        if x < ox + bord or y < oy + bord or x >= ox + g.larg - bord or y >= oy + g.haut - bord:
            g[y][x] = False
    return {
        "regles": {
            "terrain": "codes dont `franchissable` vaut false dans la légende (eau profonde, bord)",
            "objets": "toute l'emprise des objets, sauf les sols posés (quai, ponton) et les types marqués "
                      "franchissables; bâtiment à intérieur: murs seulement, portes et pièces (`interieurs`) "
                      "libres, mobilier fixe bloqué; comptoirs, guichets et vitrines fermés",
            "bord": "les cases à moins de `taille.bord` du bord de la carte",
            "train": "en plus, la zone `train_at_platform` quand le train est à quai",
        },
        "legende": {"#": "infranchissable", ".": "franchissable"},
        "grille": ["".join("." if g[y][x] else "#" for x in g.xs) for y in g.ys],
    }


# ---------------------------------------------------------------------------
# Marche


def grille_bool(infr: dict, carte: dict) -> Grille:
    ox, oy = origine(carte)
    return Grille(ox, oy, [[c == "." for c in ligne] for ligne in infr["grille"]])


def cases_libres(libre: Grille) -> set[tuple[int, int]]:
    return {(x, y) for x, y in libre.cases() if libre[y][x]}


def dijkstra(libre: Grille, sources: list[tuple[int, int]],
             ouvert: set[tuple[int, int]] | None = None) -> dict[tuple[int, int], float]:
    """Distances (m) depuis les sources, huit voisins sans couper les angles. `ouvert`: les cases libres de
    `libre`, si on les a déjà (la grille de 164 x 78 m se relit sinon à chaque appel)."""
    if ouvert is None:
        ouvert = cases_libres(libre)
    dist: dict[tuple[int, int], float] = {}
    tas: list[tuple[float, int, int]] = []
    for x, y in sources:
        if (x, y) in ouvert:
            dist[(x, y)] = 0.0
            heapq.heappush(tas, (0.0, x, y))
    while tas:
        d, x, y = heapq.heappop(tas)
        if d > dist.get((x, y), math.inf):
            continue
        for dx, dy, c in VOISINS:
            nx, ny = x + dx, y + dy
            if (nx, ny) not in ouvert:
                continue
            if dx and dy and not ((nx, y) in ouvert and (x, ny) in ouvert):
                continue  # on ne coupe pas les angles
            nd = d + c
            if nd < dist.get((nx, ny), math.inf):
                dist[(nx, ny)] = nd
                heapq.heappush(tas, (nd, nx, ny))
    return dist


class Lieux:
    """Cases depuis lesquelles on « est » à un point, une zone ou un objet."""

    def __init__(self, carte: dict) -> None:
        self.carte = carte
        self.points = {p["id"]: p for p in carte["points"]}
        self.zones = {z["id"]: z for z in carte["zones"]}
        self.objets = {o["id"]: o for o in carte["objets"]}

    def cases(self, ident: str, libre: Grille) -> list[tuple[int, int]]:
        if ident in self.points:
            p = self.points[ident]
            cx, cy = int(math.floor(p["x"])), int(math.floor(p["y"]))
            if libre.dans(cx, cy) and libre[cy][cx] and "portee" not in p:
                return [(cx, cy)]
            portee = p.get("portee", 1.5)
            res = []
            for y in range(cy - 4, cy + 5):
                for x in range(cx - 4, cx + 5):
                    if libre.dans(x, y) and libre[y][x]:
                        if math.hypot(x + 0.5 - p["x"], y + 0.5 - p["y"]) <= portee + 1e-9:
                            res.append((x, y))
            # Petit objet de plusieurs cases (puits, tonnelle): on agit depuis une case qui le touche.
            o = self.objets.get(p.get("objet", ""))
            if o is not None:
                x0, y0, w, h = emprise_monde(o, self.carte["types"])
                if w * h <= 6 and x0 <= p["x"] <= x0 + w and y0 <= p["y"] <= y0 + h:
                    res.extend(c for c in self.autour(o, libre) if c not in res)
            return res
        if ident in self.zones:
            r = self.zones[ident]["rect"]
            return [(x, y) for y in range(r["y"], r["y"] + r["h"]) for x in range(r["x"], r["x"] + r["w"])
                    if libre.dans(x, y) and libre[y][x]]
        if ident in self.objets:
            return self.autour(self.objets[ident], libre)
        return []

    def autour(self, o: dict, libre: Grille) -> list[tuple[int, int]]:
        """Cases libres qui touchent l'emprise d'un objet (8 voisins)."""
        x0, y0, w, h = emprise_monde(o, self.carte["types"])
        res = []
        for y in range(y0 - 1, y0 + h + 1):
            for x in range(x0 - 1, x0 + w + 1):
                if libre.dans(x, y) and libre[y][x]:
                    if not (x0 <= x < x0 + w and y0 <= y < y0 + h):
                        res.append((x, y))
        return res


# ---------------------------------------------------------------------------
# Caméra isométrique


def profil_toit(o: dict, t: dict) -> tuple[str, float] | None:
    """Toit à deux pans d'un type à `toit`: (axe du faîtage dans le monde, hauteur à l'égout)."""
    toit = t.get("toit")
    if not toit:
        return None
    facade_le_long_de_x = o["rotation"] % 2 == 0
    parallele = toit.get("faitage", "parallele") == "parallele"
    axe = "x" if facade_le_long_de_x == parallele else "y"
    return axe, float(toit["egout"])


def hauteur_toit(boite: tuple, x: float, y: float) -> float:
    """Hauteur du volume en (x, y): le faîte au milieu, l'égout sur les deux longs pans."""
    _, x0, y0, x1, y1, _, z1, profil = boite
    if profil is None:
        return z1
    axe, egout = profil
    if axe == "x":  # faîtage est-ouest: la hauteur varie avec y
        milieu, demi, u = (y0 + y1) / 2, (y1 - y0) / 2, y
    else:
        milieu, demi, u = (x0 + x1) / 2, (x1 - x0) / 2, x
    return egout + (z1 - egout) * max(0.0, 1.0 - abs(u - milieu) / demi)


def boites_occultantes(carte: dict, avec_train: bool) -> list[tuple]:
    """(id, x0, y0, x1, y1, z0, z1, profil) des volumes qui peuvent cacher la vue (profil: toit, ou None)."""
    types = carte["types"]
    boites = []
    for o in carte["objets"]:
        t = types[o["type"]]
        if t["hauteur"] <= 0.5:
            continue
        cx, cy = o["x"], o["y"]
        if "occultation_arbre" in t:
            for cote, z0, z1 in t["occultation_arbre"].values():
                boites.append((o["id"], cx - cote / 2, cy - cote / 2, cx + cote / 2, cy + cote / 2, z0, z1, None))
        elif "occultation" in t:
            cote, z0, z1 = t["occultation"]
            boites.append((o["id"], cx - cote / 2, cy - cote / 2, cx + cote / 2, cy + cote / 2, z0, z1, None))
        else:
            x0, y0, w, h = emprise_monde(o, types)
            boites.append((o["id"], x0, y0, x0 + w, y0 + h, 0.0, t["hauteur"], profil_toit(o, t)))
            # 0.13: volumes plus hauts que le toit (le clocher-porche), décalés depuis la case nord-ouest.
            for dx, dy, tw, th, tz in t.get("tours", []):
                if o["rotation"] != 0:
                    raise ValueError(f"{o['id']}: `tours` ne se lit qu'à la rotation 0")
                boites.append((o["id"], x0 + dx, y0 + dy, x0 + dx + tw, y0 + dy + th, 0.0, tz, None))
    # Un poteau, un lampadaire ou un tronc plus fins que 0,6 m ne cachent pas tout un personnage.
    boites = [b for b in boites if b[3] - b[1] >= 0.6 or b[4] - b[2] >= 0.6]
    if avec_train:
        r = next(z for z in carte["zones"] if z["id"] == "train_at_platform")["rect"]
        boites.append(("train", r["x"], r["y"] + 0.15, r["x"] + r["w"], r["y"] + r["h"] - 0.15, 0.0, HAUTEUR_TRAIN,
                       None))
    boites += boites_pourtour(carte)
    return IndexBoites(boites)


def boites_pourtour(carte: dict) -> list[tuple]:
    """0.13: la forêt du pourtour, semée par le rendu au-delà du bord jouable (`camera.foret_pourtour`): elle
    cache ce qui est près des bords nord, ouest et est. Ni sur la voie, ni sur la rivière, et en recul aux
    éclaircies déclarées (le rendu suit la même règle, lot L3)."""
    f = carte.get("camera", {}).get("foret_pourtour")
    if not f:
        return []
    ox, oy = origine(carte)
    x0, y0 = ox, oy
    x1, y1 = ox + carte["taille"]["largeur"], oy + carte["taille"]["hauteur"]
    bord, prof = carte["taille"]["bord"], f.get("profondeur", 10)
    z0, z1 = f["hauteur"]
    sans = [tuple(s) for s in f.get("sans_rangees", [])]

    def segments(ya: int, yb: int) -> list[tuple[int, int]]:
        """Rangées [ya, yb[ sans celles de la voie et de la rivière."""
        res, debut = [], None
        for y in range(ya, yb + 1):
            libre = y < yb and not any(a <= y <= b for a, b in sans)
            if libre and debut is None:
                debut = y
            elif not libre and debut is not None:
                res.append((debut, y))
                debut = None
        return res

    boites = []
    if "nord" in f["cotes"]:
        boites.append(("forêt du pourtour", x0 - prof, y0 - prof, x1 + prof, y0 + bord, z0, z1, None))
    if "ouest" in f["cotes"]:
        for a, b in segments(y0 + bord, y1):
            boites.append(("forêt du pourtour", x0 - prof, a, x0 + bord, b, z0, z1, None))
    if "est" in f["cotes"]:
        ecl = [e for e in f.get("eclaircies", []) if e["cote"] == "est"]
        for a, b in segments(y0 + bord, y1):
            for y in range(a, b):
                recul = max([e["recul"] for e in ecl if e["de_y"] <= y <= e["a_y"]], default=0)
                boites.append(("forêt du pourtour", x1 - bord + recul, y, x1 + prof, y + 1, z0, z1, None))
    return boites


class IndexBoites(list):
    """Les volumes, rangés par carrés de 2 m: un rayon ne teste que ceux qu'il traverse (la carte de 164 x 78 m a
    plus de mille volumes avec la forêt). Les grands volumes (forêt du pourtour, plus de 64 m²) sont toujours testés."""

    PAS = 2.0

    def __init__(self, boites: list[tuple]) -> None:
        super().__init__(boites)
        self.grandes: list[tuple] = []
        self.seaux: dict[tuple[int, int], list[tuple]] = {}
        self.zmax = max((bt[6] for bt in boites), default=0.0)
        for bt in boites:
            _, x0, y0, x1, y1 = bt[:5]
            if (x1 - x0) * (y1 - y0) > 64:
                self.grandes.append(bt)
                continue
            m = 0.5
            for i in range(math.floor((x0 - m) / self.PAS), math.floor((x1 + m) / self.PAS) + 1):
                for j in range(math.floor((y0 - m) / self.PAS), math.floor((y1 + m) / self.PAS) + 1):
                    self.seaux.setdefault((i, j), []).append(bt)

    def candidats(self, px: float, py: float, hp: float, ux: float, uy: float) -> list[tuple]:
        longueur = max(0.0, (self.zmax - hp) / TAN_E)
        vus: dict[int, tuple] = {}
        s = 0.0
        while s <= longueur + 0.5:
            cle = (math.floor((px + ux * s) / self.PAS), math.floor((py + uy * s) / self.PAS))
            for bt in self.seaux.get(cle, ()):
                vus[id(bt)] = bt
            s += 0.5
        return self.grandes + list(vus.values())


def cache_par(px: float, py: float, hp: float, direction: tuple[float, float], boites: list,
              exclus: set[str]) -> str | None:
    ux, uy = direction[0] / SQRT2, direction[1] / SQRT2
    if isinstance(boites, IndexBoites):
        boites = boites.candidats(px, py, hp, ux, uy)
    for boite in boites:
        ident, x0, y0, x1, y1, z0, z1, profil = boite
        if ident in exclus or z1 <= hp:
            continue
        s_bas = max(0.0, (z0 - hp) / TAN_E)
        s_haut = (z1 - hp) / TAN_E
        for p0, u, a, b in ((px, ux, x0, x1), (py, uy, y0, y1)):
            if abs(u) < 1e-12:
                if not a <= p0 < b:
                    s_haut = -1.0
                continue
            t1, t2 = (a - p0) / u, (b - p0) / u
            if t1 > t2:
                t1, t2 = t2, t1
            s_bas, s_haut = max(s_bas, t1), min(s_haut, t2)
        if s_bas < s_haut:
            if profil is None:
                return ident
            # Toit à deux pans: on suit le rayon dans le volume, par pas de 5 cm.
            s = s_bas
            while s < s_haut:
                if hp + s * TAN_E < hauteur_toit(boite, px + ux * s, py + uy * s):
                    return ident
                s += 0.05
    return None


# ---------------------------------------------------------------------------
# Contrôles


def controler(carte: dict, rapport: Rapport, chemin_donnees: Path | None, avant: dict | None = None,
              plannings: dict | None = None) -> dict[str, Any]:
    resultats: dict[str, Any] = {}
    for cle in ("taille", "terrain", "types", "objets", "points", "zones", "infranchissable", "maison"):
        if cle not in carte:
            rapport.erreur(f"clé manquante: {cle}")
            return resultats
    larg, haut = carte["taille"]["largeur"], carte["taille"]["hauteur"]
    legende = carte["terrain"]["legende"]
    lignes = carte["terrain"]["lignes"]
    types = carte["types"]

    # 1. Format
    if len(lignes) != haut or any(len(lg) != larg for lg in lignes):
        rapport.erreur(f"terrain: {haut} lignes de {larg} caractères attendues")
        return resultats
    ox, oy = origine(carte)
    for y, lg in enumerate(lignes):
        for x, c in enumerate(lg):
            if c not in legende:
                rapport.erreur(f"terrain ({x + ox}, {y + oy}): code {c!r} absent de la légende")
    for code, d in legende.items():
        for champ in ("nom", "sol", "franchissable"):
            if champ not in d:
                rapport.erreur(f"légende {code!r}: champ {champ} manquant")
    # Deux espaces de noms: les objets d'un côté, les points et zones de l'autre (un point peut
    # porter le nom de l'objet qu'il désigne, comme `coop_crate`).
    for genres in ((("objet", carte["objets"]),), (("point", carte["points"]), ("zone", carte["zones"]))):
        vus: dict[str, str] = {}
        for genre, liste in genres:
            for e in liste:
                i = e.get("id")
                if not isinstance(i, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", i):
                    rapport.erreur(f"{genre}: identifiant invalide {i!r}")
                elif i in vus:
                    rapport.erreur(f"identifiant {i!r} en double ({vus[i]}, {genre})")
                else:
                    vus[i] = genre
    for t_id, t in types.items():
        if not re.fullmatch(r"[a-z][a-z0-9_]*", t_id):
            rapport.erreur(f"type {t_id!r}: nom attendu en snake_case anglais")
        for champ in ("categorie", "emprise", "hauteur"):
            if champ not in t:
                rapport.erreur(f"type {t_id}: champ {champ} manquant")
    for o in carte["objets"]:
        if o.get("type") not in types:
            rapport.erreur(f"objet {o.get('id')}: type inconnu {o.get('type')!r}")
            continue
        if o.get("rotation") not in (0, 1, 2, 3):
            rapport.erreur(f"objet {o['id']}: rotation {o.get('rotation')!r} (0 à 3 attendu)")
            continue
        w, h = taille_monde(types[o["type"]], o["rotation"])
        x0, y0 = o["x"] - w / 2, o["y"] - h / 2
        if abs(x0 - round(x0)) > 1e-9 or abs(y0 - round(y0)) > 1e-9:
            rapport.erreur(f"objet {o['id']}: emprise hors de la grille (centre {o['x']}, {o['y']})")
        rx0, ry0, _, _ = emprise_monde(o, types)
        if not (ox <= rx0 and oy <= ry0 and rx0 + w <= ox + larg and ry0 + h <= oy + haut):
            rapport.erreur(f"objet {o['id']}: sort de la carte")
        rect = o.get("rect")
        if rect != {"x": rx0, "y": ry0, "w": w, "h": h}:
            rapport.erreur(f"objet {o['id']}: `rect` ne correspond pas au centre et à la rotation")
    controler_clotures(carte, rapport)
    for p in carte["points"]:
        if not (ox <= p["x"] < ox + larg and oy <= p["y"] < oy + haut):
            rapport.erreur(f"point {p['id']}: hors de la carte")
        if "rotation" in p and p["rotation"] not in (0, 1, 2, 3):
            rapport.erreur(f"point {p['id']}: rotation invalide")
        if p.get("objet") and p["objet"] not in {o["id"] for o in carte["objets"]}:
            rapport.erreur(f"point {p['id']}: objet {p['objet']!r} inconnu")
    for z in carte["zones"]:
        r = z.get("rect", {})
        if not all(k in r for k in "xywh") or r["x"] < ox or r["y"] < oy or r["x"] + r["w"] > ox + larg \
                or r["y"] + r["h"] > oy + haut or r["w"] <= 0 or r["h"] <= 0:
            rapport.erreur(f"zone {z['id']}: rectangle invalide")
    if rapport.erreurs:
        return resultats

    objets = {o["id"]: o for o in carte["objets"]}
    points = {p["id"]: p for p in carte["points"]}
    zones = {z["id"]: z["rect"] for z in carte["zones"]}
    lignes = grille_terrain(carte)

    # 2. Cohérence du terrain
    sous_batiments: set[tuple[int, int]] = set()
    for o in carte["objets"]:
        if types[o["type"]]["categorie"] == "batiment":
            x0, y0, w, h = emprise_monde(o, types)
            sous_batiments |= {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w)}
    cases_s = {(x, y) for x, y in lignes.cases() if lignes[y][x] == "s"}
    if cases_s != sous_batiments:
        rapport.erreur(f"sol de bâtiment: {len(cases_s ^ sous_batiments)} cases ne correspondent pas aux bâtiments")
    if "platform" in objets:
        x0, y0, w, h = emprise_monde(objets["platform"], types)
        quai = {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w)}
        cases_q = {(x, y) for x, y in lignes.cases() if lignes[y][x] == "q"}
        if quai != cases_q:
            rapport.erreur("quai: le code 'q' ne couvre pas exactement l'emprise du quai")
    recalcul = calculer_infranchissable(carte)
    if recalcul["grille"] != carte["infranchissable"]["grille"]:
        rapport.erreur("infranchissable: la grille du fichier ne correspond pas au terrain et aux objets "
                       "(relancer construire_carte_halte.py)")

    # 3. Chevauchements et sols permis
    occupe: dict[tuple[int, int], str] = {}
    for o in carte["objets"]:
        t = types[o["type"]]
        if t["categorie"] == "sol":
            permis = set(t.get("sols_permis", []))
            if permis:
                x0, y0, w, h = emprise_monde(o, types)
                for y in range(y0, y0 + h):
                    for x in range(x0, x0 + w):
                        if lignes[y][x] not in permis:
                            rapport.erreur(f"{o['id']}: posé sur {lignes[y][x]!r} en ({x}, {y})")
            continue
        x0, y0, w, h = emprise_monde(o, types)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                if (x, y) in occupe:
                    rapport.erreur(f"emprises qui se chevauchent: {occupe[(x, y)]} et {o['id']} en ({x}, {y})")
                occupe[(x, y)] = o["id"]
                c = lignes[y][x]
                if t["categorie"] != "batiment" and c in "~=#gprPYj":
                    if not (c == "~" and "~" in t.get("sols_permis", [])):
                        rapport.erreur(f"{o['id']}: posé sur un sol interdit {c!r} en ({x}, {y})")

    # 4. Marche
    libre = grille_bool(recalcul, carte)
    libre_train = libre.copie()
    if "train_at_platform" in zones:
        r = zones["train_at_platform"]
        for y in range(r["y"], r["y"] + r["h"]):
            for x in range(r["x"], r["x"] + r["w"]):
                libre_train[y][x] = False
    else:
        rapport.erreur("zone train_at_platform manquante")
    lieux = Lieux(carte)
    depart = [pid for pid in ("spawn_1", "spawn_2", "train_stop") if pid in points]
    if not depart:
        rapport.erreur("aucun point d'apparition (spawn_1, spawn_2, train_stop)")
        return resultats
    for pid in depart:
        if not lieux.cases(pid, libre):
            rapport.erreur(f"apparition {pid}: case infranchissable")
    for nom_cas, grille in (("sans train", libre), ("train à quai", libre_train)):
        sources = [c for pid in depart for c in lieux.cases(pid, grille)]
        atteint = dijkstra(grille, sources)
        for p in carte["points"]:
            cases = lieux.cases(p["id"], grille)
            if not cases:
                rapport.erreur(f"[{nom_cas}] point {p['id']}: aucune case franchissable pour s'y tenir")
            elif not any(c in atteint for c in cases):
                rapport.erreur(f"[{nom_cas}] point {p['id']}: inatteignable à pied depuis l'apparition")
        total_libre = cases_libres(grille)
        poches = total_libre - set(atteint)
        if poches:
            rapport.erreur(f"[{nom_cas}] {len(poches)} cases franchissables isolées (poches sans issue), "
                           f"par exemple {sorted(poches)[:5]}")
        resultats[f"atteintes {nom_cas}"] = len(atteint)

    # 4 bis. Chantiers du tour 9: leurs cases sont libres de tout décor (réservées), et une fois tous bâtis,
    # ils ne coupent le chemin d'aucun point.
    chantiers = carte.get("chantiers", [])
    occupees = {}
    for o in carte["objets"]:
        if types[o["type"]]["categorie"] == "sol":
            continue
        x0, y0, w, h = emprise_monde(o, types)
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                occupees[(x, y)] = o["id"]
    bati = libre.copie()
    for ch in chantiers:
        for x, y in ch.get("cases", []):
            if not libre[y][x]:
                rapport.erreur(f"chantier {ch['id']}: case ({x}, {y}) déjà infranchissable")
            if (x, y) in occupees:
                rapport.erreur(f"chantier {ch['id']}: case ({x}, {y}) déjà occupée par {occupees[(x, y)]}")
            bati[y][x] = False
    if chantiers:
        sources = [c for pid in depart for c in lieux.cases(pid, bati)]
        atteint = dijkstra(bati, sources)
        for p in carte["points"]:
            cases = lieux.cases(p["id"], bati)
            if not cases:
                rapport.erreur(f"[chantiers bâtis] point {p['id']}: aucune case franchissable pour s'y tenir")
            elif not any(c in atteint for c in cases):
                rapport.erreur(f"[chantiers bâtis] point {p['id']}: inatteignable à pied depuis l'apparition")
        poches = cases_libres(bati) - set(atteint)
        if poches:
            rapport.erreur(f"[chantiers bâtis] {len(poches)} cases isolées, par exemple {sorted(poches)[:5]}")
        resultats["atteintes chantiers bâtis"] = len(atteint)

    # Portes dégagées
    for o in carte["objets"]:
        t = types[o["type"]]
        for nom, ((cx, cy), (fx, fy)) in ouvertures(o, types).items():
            if not libre.dans(fx, fy) or not libre[fy][fx]:
                rapport.erreur(f"{o['id']}: {nom} bloquée (case devant ({fx}, {fy}) infranchissable)")
            if t.get("interieur") and est_porte(nom) and not libre[cy][cx]:
                rapport.erreur(f"{o['id']}: {nom} ({cx}, {cy}) infranchissable alors que la pièce est jouable")
            if not est_porte(nom) and libre[cy][cx]:
                rapport.erreur(f"{o['id']}: {nom} ({cx}, {cy}) franchissable (seules les portes laissent passer)")

    # Maison
    maison = carte["maison"]
    if maison.get("objet") in objets:
        mo = objets[maison["objet"]]
        porte = ouvertures(mo, types).get("porte")
        if porte is None or {"cx": porte[0][0], "cy": porte[0][1]} != maison.get("porte"):
            rapport.erreur("maison: la case de la porte ne correspond pas à la maisonnette")
        piece = zones.get(maison.get("piece", ""))
        interieur = set(cases_interieures(mo, types))
        if piece is None or {(x, y) for y in range(piece["y"], piece["y"] + piece["h"])
                             for x in range(piece["x"], piece["x"] + piece["w"])} != interieur:
            rapport.erreur("maison: la zone de la pièce ne correspond pas à l'intérieur de la maisonnette")
        if porte is not None:
            entree = (porte[0][0] - DEHORS[mo["rotation"]][0], porte[0][1] - DEHORS[mo["rotation"]][1])
        else:
            entree = None
        empreintes = {}
        objets_json = _charger(chemin_donnees, "objets.json") if chemin_donnees else None
        if objets_json:
            for it in objets_json.get("items", []):
                if "footprint" in it:
                    empreintes[it["id"]] = (it["footprint"]["w"], it["footprint"]["d"])
        pris: set[tuple[int, int]] = set()
        for m in maison.get("mobilier_depart", []):
            fw, fd = empreintes.get(m["item"], (1, 1))
            if m["rotation"] % 2:
                fw, fd = fd, fw
            for y in range(m["cy"], m["cy"] + fd):
                for x in range(m["cx"], m["cx"] + fw):
                    if (x, y) not in interieur:
                        rapport.erreur(f"maison: {m['item']} déborde de la pièce en ({x}, {y})")
                    if (x, y) in pris:
                        rapport.erreur(f"maison: meubles de départ superposés en ({x}, {y})")
                    if (x, y) == entree:
                        rapport.erreur(f"maison: {m['item']} bouche l'entrée ({x}, {y})")
                    pris.add((x, y))
        if objets_json:
            depart_meubles = sorted(f"{e['item']}x{e['count']}" for e in
                                    objets_json.get("startingInventory", {}).get("houseFurniture", []))
            dans_carte: dict[str, int] = {}
            for m in maison.get("mobilier_depart", []):
                dans_carte[m["item"]] = dans_carte.get(m["item"], 0) + 1
            if sorted(f"{k}x{v}" for k, v in dans_carte.items()) != depart_meubles:
                rapport.erreur(f"maison: mobilier de départ {dans_carte} différent de objets.json {depart_meubles}")

    reglages = _charger(chemin_donnees, "reglages.json") if chemin_donnees else None
    controler_interieurs(carte, rapport, libre, lieux, depart, reglages, resultats)
    controler_ru(carte, rapport, libre, lieux, resultats)
    controler_details(carte, rapport)
    controler_bancs(carte, rapport, libre, lieux, depart, reglages)
    controler_hotes_cueillette(carte, rapport, reglages)
    controler_0_13(carte, rapport, libre, lieux, resultats, avant, plannings)

    # Potager
    if "garden" in zones:
        g = zones["garden"]
        cases_g = {(x, y) for y in range(g["y"], g["y"] + g["h"]) for x in range(g["x"], g["x"] + g["w"])}
        cases_p = {(x, y) for x, y in lignes.cases() if lignes[y][x] == "p"}
        if cases_g != cases_p:
            rapport.erreur("potager: le code 'p' doit couvrir exactement la zone garden")
        if any(not libre[y][x] or (x, y) in occupe for x, y in cases_g):
            rapport.erreur("potager: une case est bloquée ou occupée par un objet")
        if reglages and "garden" in reglages:
            attendu = reglages["garden"].get("cells")
            if attendu is not None and len(cases_g) != attendu:
                rapport.erreur(f"potager: {len(cases_g)} cases, reglages.json en veut {attendu}")
        if "house_door" in points:
            hd = points["house_door"]
            d = min(math.hypot(x + 0.5 - hd["x"], y + 0.5 - hd["y"]) for x, y in cases_g)
            if d > 2.0:
                rapport.erreur(f"potager: à {d:.1f} m de la porte (devant la porte attendu)")

    # Lisière: arbres à couper
    if "forest_edge" in zones:
        fe = zones["forest_edge"]
        arbres = [o for o in carte["objets"] if types[o["type"]]["categorie"] == "arbre"]
        dedans = [o for o in arbres if fe["x"] <= o["x"] < fe["x"] + fe["w"] and fe["y"] <= o["y"] < fe["y"] + fe["h"]]
        coupables = [o for o in arbres if o.get("coupable")]
        attendu = (reglages or {}).get("trees", {}).get("count", 12)
        if len(dedans) != attendu or {o["id"] for o in dedans} != {o["id"] for o in coupables}:
            rapport.erreur(f"lisière: {len(dedans)} arbres dans forest_edge et {len(coupables)} coupables, "
                           f"{attendu} attendus (les mêmes)")
        atteint = dijkstra(libre, [c for pid in depart for c in lieux.cases(pid, libre)])
        for o in coupables:
            if not any(c in atteint for c in lieux.cases(o["id"], libre)):
                rapport.erreur(f"arbre {o['id']}: aucune case atteignable autour")
        # Le code ne lit comme arbres (à couper) que les chênes et sapins coupables; les autres arbres (pommiers
        # du verger de Lucie, tour 10) sont du décor comme les autres objets.
        for o in coupables:
            if o["type"] not in ("tree_oak", "tree_fir"):
                rapport.erreur(f"arbre {o['id']}: seuls tree_oak et tree_fir se coupent")

    # 5. Trajets clés et portage
    vitesse = carte.get("trajets_cles", {}).get("vitesse", 3.5)
    max_s = carte.get("trajets_cles", {}).get("max_secondes", 25)
    tableau = []
    for a, b in carte.get("trajets_cles", {}).get("paires", []):
        ligne = [a, b]
        for grille in (libre, libre_train):
            sa, sb = lieux.cases(a, grille), lieux.cases(b, grille)
            if not sa or not sb:
                rapport.erreur(f"trajet {a} -> {b}: lieu inconnu ou sans case libre")
                ligne.append(None)
                continue
            dist = dijkstra(grille, sa)
            d = min((dist[c] for c in sb if c in dist), default=math.inf)
            if d == math.inf:
                rapport.erreur(f"trajet {a} -> {b}: impossible")
            elif d / vitesse > max_s:
                rapport.erreur(f"trajet {a} -> {b}: {d / vitesse:.1f} s (> {max_s} s)")
            ligne.append(d)
        tableau.append(ligne)
    resultats["trajets"] = tableau

    portage = carte.get("portage")
    if portage:
        larg_min = portage.get("largeur_min", 3)
        rayon = (larg_min - 1) // 2
        couloir = Grille(ox, oy, [[all(libre.dans(x + dx, y + dy) and libre[y + dy][x + dx]
                                       for dx in range(-rayon, rayon + 1) for dy in range(-rayon, rayon + 1))
                                   for x in libre.xs] for y in libre.ys])
        sa = [c for c in lieux.cases(portage["de"], libre) if couloir[c[1]][c[0]]]
        sb = [c for c in lieux.cases(portage["a"], libre) if couloir[c[1]][c[0]]]
        dist = dijkstra(couloir, sa) if sa else {}
        d = min((dist[c] for c in sb if c in dist), default=math.inf)
        if d == math.inf:
            rapport.erreur(f"portage {portage['de']} -> {portage['a']}: pas de couloir de {larg_min} m")
        else:
            resultats["portage"] = (d, d / portage.get("vitesse", 1.8))

    # Trajets des habitants
    for tr in carte.get("trajets", []):
        par = tr["par"]
        for nom_bout, pid, pt in (("départ", tr["de"], par[0]), ("arrivée", tr["a"], par[-1])):
            if pid not in points:
                rapport.erreur(f"trajet {tr['id']}: point {pid!r} inconnu")
                continue
            p = points[pid]
            tol = max(p.get("rayon", 0.0), p.get("portee", 0.0), 1.0)
            if math.hypot(pt[0] - p["x"], pt[1] - p["y"]) > tol + 1e-9:
                rapport.erreur(f"trajet {tr['id']}: {nom_bout} à plus de {tol} m de {pid}")
        for (x1, y1), (x2, y2) in zip(par, par[1:]):
            n = max(1, int(math.hypot(x2 - x1, y2 - y1) / 0.2))
            for k in range(n + 1):
                x = x1 + (x2 - x1) * k / n
                y = y1 + (y2 - y1) * k / n
                cx, cy = int(math.floor(x)), int(math.floor(y))
                if libre[cy][cx]:
                    continue
                bout = [points[tr["de"]], points[tr["a"]]]
                if any(int(math.floor(b["x"])) == cx and int(math.floor(b["y"])) == cy for b in bout):
                    continue
                rapport.erreur(f"trajet {tr['id']}: traverse une case bloquée ({cx}, {cy})")
                break

    # 6. Pêche, cueillette
    controler_coins_peche(carte, rapport, libre)
    eau = [(x + 0.5, y + 0.5) for x, y in lignes.cases() if lignes[y][x] == "~"]
    for p in carte["points"]:
        if p.get("peche") or p["id"] == "river_ford":
            if not lieux.cases(p["id"], libre):
                rapport.erreur(f"pêche {p['id']}: case infranchissable")
            d = min(math.hypot(p["x"] - ex, p["y"] - ey) for ex, ey in eau)
            if d > 6.0:
                rapport.erreur(f"pêche {p['id']}: eau profonde à {d:.1f} m (6 m au plus)")
        if p.get("cueillette") == "bois":
            controler_cueillette_bois(carte, rapport, p)
        elif p.get("cueillette") and "forest_edge" in zones:
            fe = zones["forest_edge"]
            dx = max(fe["x"] - p["x"], 0, p["x"] - (fe["x"] + fe["w"]))
            dy = max(fe["y"] - p["y"], 0, p["y"] - (fe["y"] + fe["h"]))
            if math.hypot(dx, dy) > 2.0:
                rapport.erreur(f"cueillette {p['id']}: loin du bord du bois")

    # 7. Caméra
    vis: dict[str, dict[str, str | None]] = {}
    for avec_train in (False, True):
        boites = boites_occultantes(carte, avec_train)
        for p in carte["points"]:
            if p.get("interieur") or not (p.get("important") or p.get("vu_par_defaut")):
                continue
            exclus = {p["objet"]} if p.get("objet") else set()
            hp = p.get("hauteur_vue", HAUTEUR_PERSONNAGE)
            res = {nom: cache_par(p["x"], p["y"], hp, d, boites, exclus) for nom, d in ORIENTATIONS.items()}
            if not avec_train:
                vis[p["id"]] = res
                if res[PAR_DEFAUT] is not None:
                    rapport.erreur(f"caméra: {p['id']} caché par {res[PAR_DEFAUT]} depuis l'orientation "
                                   f"par défaut ({PAR_DEFAUT})")
                elif p.get("important") and sum(v is None for v in res.values()) < 2:
                    rapport.erreur(f"caméra: {p['id']} visible depuis la seule orientation par défaut")
            elif res[PAR_DEFAUT] == "train" and vis.get(p["id"], {}).get(PAR_DEFAUT) is None:
                rapport.avert(f"caméra: {p['id']} caché par le train à quai (samedi) depuis le sud-est")
        if not avec_train and "garden" in zones:
            g = zones["garden"]
            for y in range(g["y"], g["y"] + g["h"]):
                for x in range(g["x"], g["x"] + g["w"]):
                    qui = cache_par(x + 0.5, y + 0.5, 0.3, ORIENTATIONS[PAR_DEFAUT], boites, set())
                    if qui:
                        rapport.erreur(f"caméra: case du potager ({x}, {y}) cachée par {qui}")
    resultats["visibilite"] = vis
    # Tour 10 (T10-03): la porte de chaque lieu nouveau, vue dans au moins trois orientations sur quatre.
    for pid, res in vis.items():
        if points[pid].get("porte_lieu") and sum(v is None for v in res.values()) < 3:
            caches = ", ".join(f"{n} ({v})" for n, v in res.items() if v is not None)
            rapport.erreur(f"caméra: porte {pid} vue dans moins de trois orientations (cachée: {caches})")
    # Tour 10: des rues que certains bâtiments ne doivent pas cacher en orientation par défaut.
    boites = boites_occultantes(carte, False)
    for regle in carte.get("camera", {}).get("rues_degagees", []):
        sous = [b for b in boites if b[0] in set(regle["objets"])]
        caches = []
        for x, y in cases_rect(regle["rect"]):
            qui = cache_par(x + 0.5, y + 0.5, HAUTEUR_PERSONNAGE, ORIENTATIONS[PAR_DEFAUT], sous, set())
            if qui:
                caches.append(((x, y), qui))
        if caches:
            rapport.erreur(f"caméra: {regle['id']}: {len(caches)} cases cachées en orientation par défaut, par "
                           f"exemple {caches[:3]}")
        resultats[f"rue {regle['id']}"] = len(caches)
    parts = {}
    for nom, d in ORIENTATIONS.items():
        ouvert = cases_libres(libre)
        cachees = sum(1 for x, y in ouvert if cache_par(x + 0.5, y + 0.5, HAUTEUR_PERSONNAGE, d, boites, set()))
        parts[nom] = cachees / max(1, len(ouvert))
    resultats["cases_cachees"] = parts

    # 8. Données du jeu
    if chemin_donnees and chemin_donnees.is_dir():
        connus = set(points) | set(zones)
        for ident in ATTENDUS:
            if ident not in connus:
                rapport.erreur(f"données: {ident!r} attendu (README des données, section 5) et absent")
        for fichier in sorted(chemin_donnees.glob("*.json")):
            contenu = _charger(chemin_donnees, fichier.name)
            for cle, valeur in _references(contenu):
                if valeur in HORS_CARTE:
                    continue
                if valeur not in connus:
                    rapport.erreur(f"données: {fichier.name} cite le {cle} {valeur!r}, absent de la carte")
        if reglages:
            for bloc in ("garden", "trees"):
                z = reglages.get(bloc, {}).get("zone")
                if z and z not in zones:
                    rapport.erreur(f"données: reglages.json cite la zone {z!r}, absente")
            sp = reglages.get("spawn", {}).get("point")
            if sp and sp not in points:
                rapport.erreur(f"données: point d'apparition {sp!r} absent")
        habitants = _charger(chemin_donnees, "habitants.json")
        if habitants:
            for v in habitants.get("villagers", []):
                if v.get("id") not in carte.get("habitants", {}):
                    rapport.avert(f"habitant {v.get('id')!r} sans résumé dans la carte")

    # Typographie
    texte = json.dumps(carte, ensure_ascii=False)
    if chr(0x2014) in texte or chr(0x2013) in texte:
        rapport.erreur("typographie: tiret cadratin ou demi-cadratin dans la carte")
    return resultats


def controler_coins_peche(carte: dict, rapport: Rapport, libre: list[list[bool]]) -> None:
    """Pêche 0.12 (C1): chaque case d'eau dans un seul coin, et chaque coin pêchable depuis une case libre."""
    coins = carte.get("peche", {}).get("coins")
    if coins is None:
        return
    legende = carte["terrain"]["legende"]
    lignes = grille_terrain(carte)
    proprio: dict[tuple[int, int], str] = {}
    for coin in coins:
        cases_eau = []
        for r in coin["rects"]:
            for x, y in cases_rect(r):
                if not lignes.dans(x, y) or legende[lignes[y][x]].get("sol") != "water":
                    continue
                if (x, y) in proprio:
                    rapport.erreur(f"coin de pêche {coin['id']}: case d'eau ({x}, {y}) déjà dans {proprio[(x, y)]}")
                proprio[(x, y)] = coin["id"]
                cases_eau.append((x, y))
        if not cases_eau:
            rapport.erreur(f"coin de pêche {coin['id']}: aucune case d'eau")
            continue
        portee = any(
            libre.dans(ex + dx, ey + dy) and libre[ey + dy][ex + dx]
            for ex, ey in cases_eau
            for dy in range(-6, 7) for dx in range(-6, 7)
            if dx * dx + dy * dy <= 36
        )
        if not portee:
            rapport.erreur(f"coin de pêche {coin['id']}: aucune case libre à moins de 6 m")
    for x, y in lignes.cases():
        # Eau dormante sans poisson à ce tour (mare du bois, bassin de la source): `peche` faux dans la légende.
        d = legende[lignes[y][x]]
        if d.get("sol") == "water" and d.get("peche", True) and (x, y) not in proprio:
            rapport.erreur(f"coins de pêche: case d'eau ({x}, {y}) hors de tout coin")


def _composantes(cases: set[tuple[int, int]]) -> list[set[tuple[int, int]]]:
    """Composantes connexes (8 voisins sans couper les angles) d'un ensemble de cases libres."""
    reste = set(cases)
    res = []
    while reste:
        debut = reste.pop()
        comp = {debut}
        pile = [debut]
        while pile:
            x, y = pile.pop()
            for dx, dy, _ in VOISINS:
                n = (x + dx, y + dy)
                if n not in reste:
                    continue
                if dx and dy and not ((x + dx, y) in cases and (x, y + dy) in cases):
                    continue
                reste.discard(n)
                comp.add(n)
                pile.append(n)
        res.append(comp)
    return res


def _dans_rect(r: dict, x: float, y: float) -> bool:
    return r["x"] <= x < r["x"] + r["w"] and r["y"] <= y < r["y"] + r["h"]


def _ecart(a: dict, b: dict) -> int:
    """Nombre de cases entre deux rectangles (0: ils se touchent ou se chevauchent)."""
    dx = max(b["x"] - (a["x"] + a["w"]), a["x"] - (b["x"] + b["w"]), 0)
    dy = max(b["y"] - (a["y"] + a["h"]), a["y"] - (b["y"] + b["h"]), 0)
    return max(dx, dy)


def controler_interieurs(carte: dict, rapport: Rapport, libre: list[list[bool]], lieux: Lieux, depart: list[str],
                         reglages: Any, resultats: dict[str, Any]) -> None:
    """Tour 10, ADR 0016: bâtiments visitables, pièces, portes, mobilier fixe, pièces à bâtir."""
    interieurs = carte.get("interieurs")
    if interieurs is None:
        return
    types = carte["types"]
    objets = {o["id"]: o for o in carte["objets"]}
    points = {p["id"]: p for p in carte["points"]}
    vus_pieces: dict[tuple[int, int], str] = {}
    emprises: dict[str, dict] = {}
    ids: set[str] = set()
    for b in interieurs:
        bid = b.get("id", "?")
        if bid in ids:
            rapport.erreur(f"intérieur {bid}: identifiant en double")
        ids.add(bid)
        o = objets.get(b.get("objet", ""))
        if o is None:
            rapport.erreur(f"intérieur {bid}: objet {b.get('objet')!r} inconnu")
            continue
        t = types[o["type"]]
        if t["categorie"] != "batiment" or not t.get("interieur"):
            rapport.erreur(f"intérieur {bid}: {o['id']} n'est pas un bâtiment à intérieur")
            continue
        x0, y0, w, h = emprise_monde(o, types)
        emprises[bid] = {"x": x0, "y": y0, "w": w, "h": h}
        dedans = set(cases_interieures(o, types))
        pieces_actives: set[tuple[int, int]] = set()
        mobilier = {(x, y): m["id"] for m in b.get("mobilier", []) for x, y in m["cases"]}
        for pc in b.get("pieces", []):
            cases = set(cases_rect(pc["rect"]))
            for c in cases:
                if c in vus_pieces:
                    rapport.erreur(f"intérieur {bid}: pièce {pc['id']} partage la case {c} avec {vus_pieces[c]}")
                vus_pieces[c] = pc["id"]
            if not pc.get("a_batir"):
                if not cases <= dedans:
                    rapport.erreur(f"intérieur {bid}: pièce {pc['id']} hors de l'emprise ou dans les murs de "
                                   f"{o['id']} ({sorted(cases - dedans)[:3]})")
                pieces_actives |= cases
                continue
            # Pièce à bâtir: dans sa propre emprise, murs sur les côtés sauf le mur commun.
            e = pc.get("emprise")
            if e is None or pc.get("porte") is None:
                rapport.erreur(f"intérieur {bid}: pièce à bâtir {pc['id']} sans emprise ou sans porte")
                continue
            emprises[f"{bid}/{pc['id']}"] = e
            commun = pc.get("mur_commun")
            g = e["x"] + (0 if commun == "ouest" else 1)
            d = e["x"] + e["w"] - (0 if commun == "est" else 1)
            hh = e["y"] + (0 if commun == "nord" else 1)
            bb = e["y"] + e["h"] - (0 if commun == "sud" else 1)
            utiles = {(x, y) for y in range(hh, bb) for x in range(g, d)}
            if not cases <= utiles:
                rapport.erreur(f"intérieur {bid}: pièce {pc['id']} hors de son emprise ou dans ses murs")
            voisin = {"est": (1, 0), "ouest": (-1, 0), "nord": (0, -1), "sud": (0, 1)}.get(commun or "")
            if voisin is None:
                rapport.erreur(f"intérieur {bid}: pièce {pc['id']}: mur commun {commun!r} inconnu")
                continue
            # L'emprise touche le bâtiment par le mur commun, sans le chevaucher.
            ext = set(cases_rect(e))
            if ext & set(cases_rect(emprises[bid])):
                rapport.erreur(f"intérieur {bid}: emprise de {pc['id']} chevauche le bâtiment")
            for x, y in ext:
                if not libre.dans(x, y) or not libre[y][x]:
                    rapport.erreur(f"intérieur {bid}: emprise de {pc['id']} sur une case déjà bloquée ({x}, {y})")
                    break
            for oo in carte["objets"]:
                if types[oo["type"]]["categorie"] == "sol":
                    continue
                if set(cases_rect(oo["rect"])) & ext:
                    rapport.erreur(f"intérieur {bid}: emprise de {pc['id']} occupée par {oo['id']}")
            for ch in carte.get("chantiers", []):
                if {tuple(c) for c in ch.get("cases", [])} & ext:
                    rapport.erreur(f"intérieur {bid}: emprise de {pc['id']} sur le chantier {ch['id']}")
            # La porte du mur commun: dans le mur du bâtiment, entre la pièce et une pièce active.
            px, py = pc["porte"]["cx"], pc["porte"]["cy"]
            mur = set(cases_rect(emprises[bid])) - dedans
            cote_piece = (px - voisin[0], py - voisin[1])
            cote_maison = (px + voisin[0], py + voisin[1])
            if (px, py) not in mur or cote_piece not in cases or cote_maison not in dedans:
                rapport.erreur(f"intérieur {bid}: porte de {pc['id']} ({px}, {py}) pas dans le mur commun, entre "
                               f"la pièce et la maison")
            if pc.get("site") and pc["site"] not in points:
                rapport.erreur(f"intérieur {bid}: site {pc['site']!r} de {pc['id']} absent des points")
            elif pc.get("site"):
                sp = points[pc["site"]]
                if _dans_rect(e, sp["x"], sp["y"]):
                    rapport.erreur(f"intérieur {bid}: le site {pc['site']} est dans l'emprise de {pc['id']}")
            for et in pc.get("etageres", []):
                if not set(cases_rect(et)) <= cases or cote_piece in cases_rect(et):
                    rapport.erreur(f"intérieur {bid}: place d'étagère {et} hors de {pc['id']} ou devant la porte")
            # Les points de la carte (hors sites) ne doivent pas tomber dans l'emprise d'une pièce à bâtir.
            for p in carte["points"]:
                if p["id"] != pc.get("site") and _dans_rect(e, p["x"], p["y"]):
                    msg = f"le point {p['id']} sera dans {pc['id']} une fois bâtie"
                    if p.get("important"):
                        rapport.erreur(f"intérieur {bid}: {msg}")
                    else:
                        rapport.avert(f"intérieur {bid}: {msg} (à déplacer à ce moment-là)")
        # Mobilier fixe: dans une pièce active.
        for (x, y), mid in mobilier.items():
            if (x, y) not in pieces_actives:
                rapport.erreur(f"intérieur {bid}: mobilier {mid} hors des pièces en ({x}, {y})")
        # Petits objets posés sur le mobilier (moulin d'Odette): sur une case du meuble qui les porte, à une
        # hauteur de meuble, avec un modèle et une condition d'apparition bien formée.
        meubles = {m["id"]: {tuple(c) for c in m["cases"]} for m in b.get("mobilier", [])}
        for a in b.get("accroches", []):
            case = (math.floor(a["x"]), math.floor(a["y"]))
            if case not in meubles.get(a.get("sur", ""), set()):
                rapport.erreur(f"intérieur {bid}: accroche {a['id']} pas sur le meuble {a.get('sur')!r} ({case})")
            if not a.get("modele") or not 0.0 < a.get("z", -1) < 2.5:
                rapport.erreur(f"intérieur {bid}: accroche {a['id']}: modèle manquant ou hauteur hors du mobilier")
            cond = a.get("visible_si", [])
            if not isinstance(cond, list) or not all(isinstance(c, dict) and "type" in c for c in cond):
                rapport.erreur(f"intérieur {bid}: accroche {a['id']}: `visible_si` doit être une liste de conditions")
        # Parties fermées: dans l'emprise, hors des pièces, bloquées.
        for f in b.get("fermees", []):
            for x, y in cases_rect(f["rect"]):
                if (x, y) not in dedans or (x, y) in pieces_actives or libre[y][x]:
                    rapport.erreur(f"intérieur {bid}: partie fermée {f['id']}: case ({x}, {y}) hors de l'emprise, "
                                   f"dans une pièce ou franchissable")
                    break
        # Portes: sur le pourtour (pas un coin), une ouverture `porte` de l'objet, devant une case libre du
        # dehors, et derrière elle une case libre d'une pièce.
        ouv = {c: nom for nom, (c, _) in ouvertures(o, types).items() if est_porte(nom)}
        if not b.get("portes"):
            rapport.erreur(f"intérieur {bid}: aucune porte")
        coins = {(x0, y0), (x0 + w - 1, y0), (x0, y0 + h - 1), (x0 + w - 1, y0 + h - 1)}
        libres_piece = {c for c in pieces_actives if libre[c[1]][c[0]]}
        for pt in b.get("portes", []):
            c = (pt["cx"], pt["cy"])
            f = (pt["dehors"]["cx"], pt["dehors"]["cy"])
            sur_pourtour = (c in set(cases_rect(emprises[bid]))) and c not in dedans and c not in coins
            if not sur_pourtour or c not in ouv:
                rapport.erreur(f"intérieur {bid}: porte {pt['id']} {c} pas sur le pourtour ou pas une porte de "
                               f"{o['id']}")
                continue
            if abs(f[0] - c[0]) + abs(f[1] - c[1]) != 1 or _dans_rect(emprises[bid], f[0] + 0.5, f[1] + 0.5) \
                    or not libre[f[1]][f[0]]:
                rapport.erreur(f"intérieur {bid}: porte {pt['id']}: la case du dehors {f} n'est pas libre devant "
                               f"elle")
            derriere = (2 * c[0] - f[0], 2 * c[1] - f[1])
            if derriere not in libres_piece:
                rapport.erreur(f"intérieur {bid}: porte {pt['id']}: la case derrière {derriere} n'est pas une case "
                               f"libre d'une pièce")
            if pt.get("point") and pt["point"] in points:
                q = points[pt["point"]]
                if (int(math.floor(q["x"])), int(math.floor(q["y"]))) != f:
                    rapport.erreur(f"intérieur {bid}: le point {pt['point']} n'est pas sur la case devant la porte")
        # Les cases libres des pièces forment un seul espace relié à la porte.
        comps = _composantes(libres_piece | {(pt["cx"], pt["cy"]) for pt in b.get("portes", [])})
        if len(comps) > 1:
            rapport.erreur(f"intérieur {bid}: {len(comps)} morceaux de pièce séparés (mobilier qui coupe la pièce)")
        # Apparition et points d'intérieur.
        app = b.get("apparition")
        if app not in points:
            rapport.erreur(f"intérieur {bid}: point d'apparition {app!r} absent")
        else:
            a = points[app]
            if (int(math.floor(a["x"])), int(math.floor(a["y"]))) not in libres_piece:
                rapport.erreur(f"intérieur {bid}: apparition {app} hors d'une case libre de pièce")
        for p in carte["points"]:
            if p.get("interieur") and p.get("objet") == o["id"] and not p.get("etage"):
                cases = lieux.cases(p["id"], libre)
                if not any(c in libres_piece for c in cases):
                    rapport.erreur(f"intérieur {bid}: point {p['id']} ne se joue depuis aucune case de pièce")
        # Heures et ambiance.
        heures = b.get("heures")
        if heures is not None and reglages is not None and heures not in reglages:
            rapport.avert(f"intérieur {bid}: heures {heures!r} pas encore dans reglages.json (lot L4)")
        # Mobilier de départ de la maisonnette: rien devant une porte de pièce à bâtir.
        if b.get("objet") == carte.get("maison", {}).get("objet"):
            for pc in b.get("pieces", []):
                if not pc.get("a_batir"):
                    continue
                px, py = pc["porte"]["cx"], pc["porte"]["cy"]
                for m in carte["maison"].get("mobilier_depart", []):
                    if (m["cx"], m["cy"]) in {(px + 1, py), (px - 1, py), (px, py + 1), (px, py - 1)} & dedans:
                        rapport.erreur(f"maison: {m['item']} devant la future porte de {pc['id']}")
    # Au moins une case entre deux bâtiments visitables (pièces à bâtir comprises, sauf avec leur maison).
    cles = sorted(emprises)
    for i, a in enumerate(cles):
        for bk in cles[i + 1:]:
            if a.split("/")[0] == bk.split("/")[0]:
                continue
            if _ecart(emprises[a], emprises[bk]) < 1:
                rapport.erreur(f"intérieurs {a} et {bk}: moins d'une case entre eux")

    # Toutes les pièces bâties: rien d'inatteignable, aucune poche, les pièces reliées (T10-21).
    bati = grille_bool(calculer_infranchissable(carte, pieces_baties=True), carte)
    for ch in carte.get("chantiers", []):
        for x, y in ch.get("cases", []):
            bati[y][x] = False
    sources = [c for pid in depart for c in lieux.cases(pid, bati)]
    atteint = dijkstra(bati, sources)
    for p in carte["points"]:
        cases = lieux.cases(p["id"], bati)
        if cases and not any(c in atteint for c in cases):
            rapport.erreur(f"[pièces bâties] point {p['id']}: inatteignable")
    poches = cases_libres(bati) - set(atteint)
    if poches:
        rapport.erreur(f"[pièces bâties] {len(poches)} cases isolées, par exemple {sorted(poches)[:5]}")
    for b in interieurs:
        for pc in b.get("pieces", []):
            if pc.get("a_batir") and not any(c in atteint for c in cases_rect(pc["rect"])):
                rapport.erreur(f"[pièces bâties] {pc['id']}: inatteignable depuis la maison")
    resultats["atteintes pièces bâties"] = len(atteint)


def controler_ru(carte: dict, rapport: Rapport, libre: list[list[bool]], lieux: Lieux,
                 resultats: dict[str, Any]) -> None:
    """Tour 10: le ru de la Côte ne se franchit qu'aux passages prévus (ponceau, pont, passerelle, gué)."""
    ru = carte.get("ru")
    if ru is None:
        return
    lignes = grille_terrain(carte)
    passages = [o for o in carte.get("ouvrages", []) if o.get("franchit") == "ru"]
    cases_passage: dict[tuple[int, int], str] = {}
    for o in passages:
        for c in cases_rect(o["rect"]):
            cases_passage[c] = o["id"]
    # Dans le lit du ru, chaque case est de l'eau ou un passage déclaré; l'eau bloque, un passage laisse passer.
    for y in range(ru["de_y"], ru["a_y"] + 1):
        for x in ru["colonnes"]:
            if (x, y) in cases_passage:
                if not libre[y][x] and y >= origine(carte)[1] + carte["taille"]["bord"]:
                    rapport.erreur(f"ru: passage {cases_passage[(x, y)]} bloqué en ({x}, {y})")
            elif lignes[y][x] != "r" or libre[y][x]:
                rapport.erreur(f"ru: case ({x}, {y}) ni eau du ru ni passage déclaré")
    # Le ru sépare deux rives: sans aucun passage, la rue Haute est hors d'atteinte depuis la maisonnette;
    # avec un seul passage ouvert, elle est atteinte, quel que soit ce passage.
    ouest = lieux.cases("house_door", libre)
    est = [c for pid in ("bakery_door", "salon_door", "lucie_house_door", "school_gate")
           for c in lieux.cases(pid, libre)]
    if not ouest or not est:
        return

    def grille_sans(garder: str | None) -> list[list[bool]]:
        g = libre.copie()
        for (x, y), oid in cases_passage.items():
            if oid != garder:
                g[y][x] = False
        return g

    atteint = dijkstra(grille_sans(None), ouest)
    # 0.13: le ru naît dans la carte (sa source, au nord du bois): on en fait le tour par là, c'est voulu.
    source_dedans = ru["de_y"] > origine(carte)[1] + carte["taille"]["bord"]
    if any(c in atteint for c in est):
        if source_dedans:
            d = min((atteint[c] for c in est if c in atteint), default=math.inf)
            resultats["ru contourné par la source"] = d
        else:
            rapport.erreur("ru: la rue Haute est atteinte sans passer par un passage du ru (il fuit ailleurs)")
    longueurs = {}
    for o in passages:
        atteint = dijkstra(grille_sans(o["id"]), ouest)
        d = min((atteint[c] for c in est if c in atteint), default=math.inf)
        if d == math.inf:
            rapport.erreur(f"ru: le passage {o['id']} ne relie pas les deux rives")
        longueurs[o["id"]] = d
    resultats["passages du ru"] = longueurs


def controler_details(carte: dict, rapport: Rapport) -> None:
    """Cohérence du monde (retour R22): ni buisson, ni rocher, ni arbre planté sur un sol de passage.

    Erreur depuis le 2026-11-02 (c'était un avertissement): la place est pavée dans la grille, terre battue
    comprise; un massif y est toujours mal placé, quel que soit le dessin du rendu.
    """
    types = carte["types"]
    lignes = grille_terrain(carte)
    for o in carte["objets"]:
        t = types[o["type"]]
        if o["type"] in ("bush", "rock", "bramble", "bush_hazel") or t["categorie"] in ("arbre", "vegetation"):
            x0, y0, w, h = emprise_monde(o, types)
            for x, y in cases_rect({"x": x0, "y": y0, "w": w, "h": h}):
                if lignes[y][x] in "+:qPYj;c":
                    rapport.erreur(f"{o['id']} ({o['type']}) planté sur un sol de passage {lignes[y][x]!r} en "
                                   f"({x}, {y})")


# Bancs (`reglages.json`, `benches`; calcul de `src/etat/bancs.ts`): valeurs par défaut si le fichier manque.
BANCS_DEFAUT = {"slots": [-0.5, 0.5], "seatForward": 0.0, "standForward": 0.85}


def places_banc(x: float, y: float, rotation: int, reglage: dict) -> list[list[tuple[float, float]]]:
    """Pour chaque place d'un banc: où l'on se relève, devant (à `standForward`), puis derrière."""
    a = rotation * math.pi / 2
    res = []
    for offset in reglage["slots"]:
        sx = x + math.cos(a) * offset + math.sin(a) * reglage["seatForward"]
        sy = y - math.sin(a) * offset + math.cos(a) * reglage["seatForward"]
        pas = reglage["standForward"]
        res.append([(sx + math.sin(a) * sens * pas, sy + math.cos(a) * sens * pas) for sens in (1, -1)])
    return res


def controler_bancs(carte: dict, rapport: Rapport, libre: list[list[bool]], lieux: Lieux, depart: list[str],
                    reglages: Any) -> None:
    """Chaque place de banc (carte, chantiers bâtis) a devant elle une case libre et atteignable où se relever,
    tous les chantiers bâtis. Le jeu (`standingSpot`) essaie ensuite derrière, puis la case libre la plus
    proche: derrière un banc adossé, c'est de l'autre côté du mur (dans la maisonnette pour le banc du
    pignon). Seuls les sièges sans modèle (le bord du ponton) se quittent par derrière, comme prévu."""
    reglage = dict(BANCS_DEFAUT)
    if isinstance(reglages, dict) and isinstance(reglages.get("benches"), dict):
        reglage.update({k: v for k, v in reglages["benches"].items() if k in BANCS_DEFAUT})
    bati = libre.copie()
    for ch in carte.get("chantiers", []):
        for x, y in ch.get("cases", []):
            bati[y][x] = False
    atteint = dijkstra(bati, [c for pid in depart for c in lieux.cases(pid, bati)])
    # Dernier champ: combien d'endroits essayer (1: devant seulement; 2: devant puis derrière).
    bancs = [(o["id"], o["x"], o["y"], o["rotation"], 1) for o in carte["objets"] if o["type"] == "bench"]
    bancs += [(s["id"], s["x"], s["y"], s["rotation"], 2) for s in carte.get("sieges", [])]
    bancs += [(c["id"], c["x"], c["y"], c["rotation"], 1) for c in carte.get("chantiers", []) if c["type"] == "bench"]
    for ident, x, y, rotation, essais in bancs:
        for n, endroits in enumerate(places_banc(x, y, rotation, reglage)):
            cases = [(math.floor(fx), math.floor(fy)) for fx, fy in endroits[:essais]]
            if not any(bati.dans(cx, cy) and bati[cy][cx] and (cx, cy) in atteint for cx, cy in cases):
                rapport.erreur(f"banc {ident}: place {n}, pas de case libre et atteignable où se relever "
                               f"({' ni '.join(str(c) for c in cases)})")


# Cueillettes posées sur un hôte par le rendu (`POSED_ON` et `HOST_REACH` de `src/rendu/vie.ts`): l'hôte le plus
# proche à moins de 1,6 m du coin. Hôte désigné par son type, ou par l'identifiant d'un objet dont le rendu
# change le modèle (`MODEL_BY_PROP` de `src/rendu/modeles.ts`: `bush_41` est le sureau).
HOTES_CUEILLETTE = {"hazelnut": ("type", "bush_hazel"), "blackberry": ("type", "bramble"),
                    "elderberry": ("id", "bush_41")}
PORTEE_HOTE = 1.6


def controler_hotes_cueillette(carte: dict, rapport: Rapport, reglages: Any) -> None:
    """Chaque coin de cueillette qui donne une noisette, une mûre ou des grappes de sureau a son hôte à portée."""
    if not isinstance(reglages, dict) or not isinstance(reglages.get("forage"), dict):
        return
    points = {p["id"]: p for p in carte["points"]}
    for coin in reglages["forage"].get("points", []):
        p = points.get(coin.get("point"))
        if p is None:
            continue
        for item in coin.get("items", []):
            if item not in HOTES_CUEILLETTE:
                continue
            cle, valeur = HOTES_CUEILLETTE[item]
            hotes = [o for o in carte["objets"] if o.get(cle) == valeur]
            d = min((math.hypot(o["x"] - p["x"], o["y"] - p["y"]) for o in hotes), default=math.inf)
            if d > PORTEE_HOTE + 1e-9:
                rapport.erreur(f"cueillette {p['id']}: {item} sans hôte ({valeur}) à moins de {PORTEE_HOTE} m "
                               f"(le plus proche à {d:.1f} m): le rendu la laisse par terre")


# ---------------------------------------------------------------------------
# 0.13: la carte agrandie (docs/jeux/jeu-1/v0-13-carte.md, section 13: règles neuves du validateur)

ZONES_DU_BOIS = ("forest_cote", "forest_cure", "forest_west")
# Un buisson hôte porte ce qu'on cueille (à portée de main, `HOST_REACH` du rendu); un arbre hôte le laisse tomber
# sous son houppier: le coin est alors à quelques mètres du tronc, hors du houppier pour la caméra.
PORTEE_HOTE_ARBRE = 3.6


def controler_cueillette_bois(carte: dict, rapport: Rapport, p: dict) -> None:
    """Coins de cueillette du bois (5.3): dans le bois, hors des sentiers, l'hôte éventuel à portée."""
    zones = {z["id"]: z["rect"] for z in carte["zones"]}
    if not any(i in zones and _dans_rect(zones[i], p["x"], p["y"]) for i in ZONES_DU_BOIS):
        rapport.erreur(f"cueillette {p['id']}: hors des zones du bois ({', '.join(ZONES_DU_BOIS)})")
    lignes = grille_terrain(carte)
    if lignes[math.floor(p["y"])][math.floor(p["x"])] in "+:;#cqPYj":
        rapport.erreur(f"cueillette {p['id']}: sur un sentier (les coins sont hors des sentiers)")
    hote = p.get("hote")
    if hote:
        o = next((ob for ob in carte["objets"] if ob["id"] == hote), None)
        if o is None:
            rapport.erreur(f"cueillette {p['id']}: hôte {hote!r} absent")
            return
        arbre = carte["types"][o["type"]]["categorie"] == "arbre"
        portee = PORTEE_HOTE_ARBRE if arbre else PORTEE_HOTE
        d = math.hypot(o["x"] - p["x"], o["y"] - p["y"])
        if d > portee + 1e-9:
            rapport.erreur(f"cueillette {p['id']}: hôte {hote} à {d:.1f} m (au plus {portee} m)")


def astar_noeuds(ouvert: set[tuple[int, int]], a: tuple[float, float], c: tuple[float, float],
                 max_noeuds: int = 4000) -> tuple[int, bool]:
    """Nœuds développés par l'A* du jeu (`findPath` de src/simulation/grille.ts: huit voisins sans couper les
    angles, heuristique euclidienne, plafond `maxNodes`): (nœuds, trouvé). Si l'arrivée est bloquée, il vise la
    case libre la plus proche, comme le jeu."""
    sx, sy = math.floor(a[0]), math.floor(a[1])
    gx, gy = math.floor(c[0]), math.floor(c[1])
    if (gx, gy) not in ouvert:
        proches = sorted(((math.hypot(x + 0.5 - c[0], y + 0.5 - c[1]), x, y)
                          for x in range(gx - 4, gx + 5) for y in range(gy - 4, gy + 5) if (x, y) in ouvert))
        if not proches:
            return 0, False
        gx, gy = proches[0][1], proches[0][2]
    if (sx, sy) == (gx, gy):
        return 0, True
    g = {(sx, sy): 0.0}
    tas = [(math.hypot(gx - sx, gy - sy), sx, sy)]
    fermes: set[tuple[int, int]] = set()
    developpes = 0
    while tas and developpes < max_noeuds:
        _, x, y = heapq.heappop(tas)
        if (x, y) == (gx, gy):
            return developpes, True
        if (x, y) in fermes:
            continue
        fermes.add((x, y))
        developpes += 1
        d = g[(x, y)]
        for dx, dy, cout in VOISINS:
            n = (x + dx, y + dy)
            if n not in ouvert or n in fermes:
                continue
            if dx and dy and ((x + dx, y) not in ouvert or (x, y + dy) not in ouvert):
                continue
            nd = d + cout
            if nd < g.get(n, math.inf):
                g[n] = nd
                heapq.heappush(tas, (nd + math.hypot(gx - n[0], gy - n[1]), n[0], n[1]))
    return developpes, False


def squelette(cases: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Amincissement de Zhang et Suen: la ligne médiane d'un réseau de chemins de 1 à 3 m de large."""
    s = set(cases)

    def voisins(x: int, y: int) -> list[bool]:
        # P2 à P9, dans le sens horaire depuis le nord.
        return [(x, y - 1) in s, (x + 1, y - 1) in s, (x + 1, y) in s, (x + 1, y + 1) in s,
                (x, y + 1) in s, (x - 1, y + 1) in s, (x - 1, y) in s, (x - 1, y - 1) in s]

    change = True
    while change:
        change = False
        for passe in (0, 1):
            retirer = []
            for x, y in s:
                v = voisins(x, y)
                n = sum(v)
                if not 2 <= n <= 6:
                    continue
                transitions = sum(1 for i in range(8) if not v[i] and v[(i + 1) % 8])
                if transitions != 1:
                    continue
                p2, p4, p6, p8 = v[0], v[2], v[4], v[6]
                if passe == 0 and (p2 and p4 and p6 or p4 and p6 and p8):
                    continue
                if passe == 1 and (p2 and p4 and p8 or p2 and p6 and p8):
                    continue
                retirer.append((x, y))
            if retirer:
                change = True
                s.difference_update(retirer)
    return s


def controler_0_13(carte: dict, rapport: Rapport, libre: Grille, lieux: Lieux, resultats: dict[str, Any],
                   avant: dict | None, plannings: dict | None) -> None:
    types = carte["types"]
    lignes = grille_terrain(carte)
    points = {p["id"]: p for p in carte["points"]}
    objets = {o["id"]: o for o in carte["objets"]}
    ouvert = cases_libres(libre)
    ag = carte.get("agrandissement")

    # a. L'aire du bourg d'avant ne change pas, hors des retouches et des déplacements déclarés (CA-C3).
    if ag and avant:
        aire = ag["ancienne_aire"]
        retouches = [r["rect"] for r in ag.get("retouches", [])]
        av = avant["terrain"]["lignes"]
        changees = []
        for x, y in cases_rect(aire):
            if av[y][x] != lignes[y][x] and not any(_dans_rect(r, x + 0.5, y + 0.5) for r in retouches):
                changees.append((x, y, av[y][x], lignes[y][x]))
        if changees:
            rapport.erreur(f"agrandissement: {len(changees)} cases du bourg d'avant changent hors des retouches "
                           f"déclarées, par exemple {changees[:4]}")
        deplaces = {d["id"]: d for d in ag.get("deplaces", [])}
        for o in avant["objets"]:
            n = objets.get(o["id"])
            if n is None or n["type"] != o["type"]:
                rapport.erreur(f"agrandissement: objet {o['id']} disparu ou changé de type")
                continue
            if (n["x"], n["y"], n["rotation"]) != (o["x"], o["y"], o["rotation"]):
                d = deplaces.get(o["id"])
                if d is None or [n["x"], n["y"]] != d["a"] or [o["x"], o["y"]] != d["de"]:
                    rapport.erreur(f"agrandissement: objet {o['id']} déplacé sans être déclaré")
        for d in deplaces:
            if d not in {o["id"] for o in avant["objets"]}:
                rapport.erreur(f"agrandissement: {d} déclaré déplacé mais absent du bourg d'avant")
        pts_dep = {d["id"]: d for d in ag.get("points_deplaces", [])}
        for p in avant["points"]:
            n = points.get(p["id"])
            if n is None:
                rapport.erreur(f"agrandissement: point {p['id']} disparu")
            elif (n["x"], n["y"]) != (p["x"], p["y"]) and (p["id"] not in pts_dep or [n["x"], n["y"]]
                                                            != pts_dep[p["id"]]["a"]):
                rapport.erreur(f"agrandissement: point {p['id']} déplacé sans être déclaré")
        zones_avant = {z["id"]: z["rect"] for z in avant["zones"]}
        for z in carte["zones"]:
            if z["id"] in zones_avant and z["rect"] != zones_avant[z["id"]]:
                rapport.erreur(f"agrandissement: zone {z['id']} changée")
        resultats["agrandissement"] = (len(deplaces), len(changees))

    # b. Sentiers de forêt sans impasse, hors des bouts déclarés (CA-C6): bouts de la ligne médiane du réseau des
    # chemins qui tombent sur un sentier de forêt (`;`).
    if ag:
        reseau = {(x, y) for x, y in lignes.cases() if lignes[y][x] in ";:+#cqPYj"}
        zs = {z["id"]: z["rect"] for z in carte["zones"]}
        for zid in ag.get("clairieres", []):
            reseau |= {(x, y) for x, y in cases_rect(zs[zid]) if lignes.dans(x, y) and lignes[y][x] in ",.b"}
        sq = squelette(reseau)
        bouts = []
        for x, y in sq:
            n = sum((x + dx, y + dy) in sq for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy)
            if n == 1 and lignes[y][x] == ";":
                bouts.append((x, y))
        permis = [points[i] for i in ag.get("impasses", []) if i in points]
        for x, y in bouts:
            if not any(math.hypot(x + 0.5 - p["x"], y + 0.5 - p["y"]) <= 4.0 for p in permis):
                rapport.erreur(f"sentiers: impasse en ({x}, {y}) (hors des bouts déclarés: "
                               f"{', '.join(ag.get('impasses', []))})")
        resultats["bouts de sentier"] = len(bouts)

    # c. Au plus 12 arbres et 4 500 triangles d'arbres par morceau de 12 m du rendu (ADR 0016).
    tris = carte.get("triangles_par_type")
    if tris is not None:
        morceaux: dict[tuple[int, int], list[int]] = {}
        for o in carte["objets"]:
            if types[o["type"]]["categorie"] != "arbre":
                continue
            m = morceaux.setdefault((math.floor(o["x"] / 12), math.floor(o["y"] / 12)), [0, 0])
            m[0] += 1
            m[1] += tris.get(o["type"], 400)
        for (i, j), (n, t) in sorted(morceaux.items()):
            if n > 12 or t > 4500:
                rapport.erreur(f"forêt: morceau ({i * 12}, {j * 12}): {n} arbres, {t} triangles (12 et 4 500 au "
                               f"plus)")
        resultats["arbres par morceau (max)"] = max((n for n, _ in morceaux.values()), default=0)

    # d. Parcelles: sol cultivable, sans objet, bord atteignable, de l'eau à 25 m (sauf plein champ).
    occupe = {}
    for o in carte["objets"]:
        if types[o["type"]]["categorie"] == "sol":
            continue
        x0, y0, w, h = emprise_monde(o, types)
        for c in cases_rect({"x": x0, "y": y0, "w": w, "h": h}):
            occupe[c] = o["id"]
    eaux = [(x + 0.5, y + 0.5) for x, y in lignes.cases() if lignes[y][x] in "~rke"]
    eaux += [(o["x"], o["y"]) for o in carte["objets"] if o["type"] in ("water_barrel", "well", "hand_pump")]
    atteint = dijkstra(libre, [c for pid in ("spawn_1", "spawn_2") for c in lieux.cases(pid, libre)], ouvert)
    ids_parcelles = set()
    for pc in carte.get("parcelles", []):
        if pc["id"] in ids_parcelles:
            rapport.erreur(f"parcelle {pc['id']}: en double")
        ids_parcelles.add(pc["id"])
        attendu = [[x, y] for y in range(pc["rect"]["y"], pc["rect"]["y"] + pc["rect"]["h"])
                   for x in range(pc["rect"]["x"], pc["rect"]["x"] + pc["rect"]["w"])]
        if pc["cases"] != attendu:
            rapport.erreur(f"parcelle {pc['id']}: `cases` différentes du rectangle, ou dans un autre ordre")
        for x, y in attendu:
            if lignes[y][x] not in "lf" or (x, y) in occupe or (x, y) not in ouvert:
                rapport.erreur(f"parcelle {pc['id']}: case ({x}, {y}) pas cultivable, occupée ou bloquée")
                break
        if not any(c in atteint for x, y in attendu for c in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
            rapport.erreur(f"parcelle {pc['id']}: aucun bord atteignable")
        if pc.get("arrosage", True):
            cx = pc["rect"]["x"] + pc["rect"]["w"] / 2
            cy = pc["rect"]["y"] + pc["rect"]["h"] / 2
            d = min((math.hypot(ex - cx, ey - cy) for ex, ey in eaux), default=math.inf)
            if d > 25:
                rapport.erreur(f"parcelle {pc['id']}: eau à {d:.0f} m (25 m au plus, sauf plein champ)")

    # e. Passages à niveau: des planches sur toute la voie, un panneau (ou une barrière) de chaque côté.
    rangees_voie = [y for y in lignes.ys if sum(lignes[y][x] in "=#" for x in lignes.xs) > lignes.larg / 2]
    for pn in carte.get("passages_a_niveau", []):
        r = pn["rect"]
        if list(range(r["y"], r["y"] + r["h"])) != rangees_voie:
            rapport.erreur(f"passage à niveau {pn['id']}: ne couvre pas toutes les rangées de la voie {rangees_voie}")
        if any(lignes[y][x] != "#" for x, y in cases_rect(r)):
            rapport.erreur(f"passage à niveau {pn['id']}: des cases ne sont pas des planches")
        cotes = set()
        for pid in pn.get("panneaux", []):
            o = objets.get(pid)
            if o is None:
                rapport.erreur(f"passage à niveau {pn['id']}: panneau {pid} absent")
                continue
            cotes.add("nord" if o["y"] < r["y"] else "sud" if o["y"] >= r["y"] + r["h"] else "voie")
            if abs(o["x"] - (r["x"] + r["w"] / 2)) > r["w"] / 2 + 2:
                rapport.erreur(f"passage à niveau {pn['id']}: panneau {pid} loin de la traversée")
        if cotes != {"nord", "sud"}:
            rapport.erreur(f"passage à niveau {pn['id']}: un panneau de chaque côté de la voie attendu ({cotes})")

    # f. Distances plafonds depuis la maisonnette (CA-C5).
    dp = carte.get("distances_plafonds")
    if dp:
        tableau = []
        for de, a, max_s in dp["paires"]:
            dist = dijkstra(libre, lieux.cases(de, libre), ouvert)
            d = min((dist[c] for c in lieux.cases(a, libre) if c in dist), default=math.inf)
            t = d / dp["vitesse"]
            if t > max_s:
                rapport.erreur(f"distance {de} -> {a}: {t:.1f} s (au plus {max_s} s)")
            tableau.append((de, a, d, t, max_s))
        resultats["distances plafonds"] = tableau

    # g. A* du jeu: chaque trajet d'habitant de la carte, et toutes les paires de points de chaque planning. Le jeu
    # abandonne à 4 000 nœuds (`maxNodes`): au-delà, l'habitant ne trouve pas son chemin (erreur); la conception
    # visait 3 000 pour garder de la marge (CA-C10: avertissement entre les deux).

    def juger(quoi: str, n: int, ok: bool) -> None:
        if not ok:
            rapport.erreur(f"A*: {quoi}: chemin introuvable par le jeu (plus de 4 000 nœuds)")
        elif n > 3000:
            rapport.avert(f"A*: {quoi}: {n} nœuds (3 000 visés, le jeu abandonne à 4 000)")

    pires = []
    for tr in carte.get("trajets", []):
        a, c = points[tr["de"]], points[tr["a"]]
        n, ok = astar_noeuds(ouvert, (a["x"], a["y"]), (c["x"], c["y"]))
        pires.append((n, f"trajet {tr['id']}"))
        juger(f"trajet {tr['id']}", n, ok)
    if plannings:
        manquants = set()
        for v in plannings.get("villagers", []):
            pts = sorted({e["point"] for e in v.get("schedule", []) if e["point"] not in HORS_CARTE})
            for pid in pts:
                if pid not in points:
                    manquants.add(pid)
            pts = [pid for pid in pts if pid in points]
            for i, pa in enumerate(pts):
                for pb in pts[i + 1:]:
                    a, c = points[pa], points[pb]
                    n, ok = astar_noeuds(ouvert, (a["x"], a["y"]), (c["x"], c["y"]))
                    pires.append((n, f"{v['id']}: {pa} -> {pb}"))
                    juger(f"{v['id']} {pa} -> {pb}", n, ok)
        for pid in sorted(manquants):
            rapport.erreur(f"plannings: le point {pid!r} n'est pas sur la carte")
    resultats["A* (pires)"] = sorted(pires, reverse=True)[:5]
    resultats["A* (trajets)"] = len(pires)


def _charger(dossier: Path | None, nom: str) -> Any:
    if dossier is None:
        return None
    chemin = dossier / nom
    if not chemin.exists():
        return None
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _references(noeud: Any) -> list[tuple[str, str]]:
    """Valeurs des clés `point` et `zone` dans un fichier de données."""
    res: list[tuple[str, str]] = []
    if isinstance(noeud, dict):
        for k, v in noeud.items():
            if k in ("point", "zone") and isinstance(v, str):
                res.append((k, v))
            elif k == "carry" and isinstance(v, dict) and isinstance(v.get("from"), str):
                res.append(("point", v["from"]))
            res.extend(_references(v))
    elif isinstance(noeud, list):
        for v in noeud:
            res.extend(_references(v))
    return res


def main(argv: list[str]) -> int:
    """Usage: valider_carte.py [carte.json] [--avant carte_d_avant.json] [--plannings habitants.json]

    `--avant`: la carte d'avant un agrandissement (par défaut donnees/cartes/halte.json, si la carte contrôlée a
    une clé `agrandissement` et n'est pas celle-là); `--plannings`: des plannings au format de habitants.json
    (par exemple la sortie `--json` de docs/jeux/jeu-1/simulations/v0_13_habitants.py), dont on vérifie que chaque
    paire de points se rejoint sous 3 000 nœuds d'A*."""
    args = list(argv[1:])
    options: dict[str, Path] = {}
    for opt in ("--avant", "--plannings"):
        if opt in args:
            i = args.index(opt)
            options[opt] = Path(args[i + 1])
            del args[i:i + 2]
    chemin = Path(args[0]) if args else CARTE_PAR_DEFAUT
    try:
        carte = json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"erreur: lecture de {chemin} impossible ({exc})")
        return 1
    avant = plannings = None
    if "--avant" in options:
        avant = json.loads(options["--avant"].read_text(encoding="utf-8"))
    elif "agrandissement" in carte and chemin.resolve() != CARTE_PAR_DEFAUT.resolve() and CARTE_PAR_DEFAUT.exists():
        avant = json.loads(CARTE_PAR_DEFAUT.read_text(encoding="utf-8"))
    if "--plannings" in options:
        plannings = json.loads(options["--plannings"].read_text(encoding="utf-8"))
    rapport = Rapport()
    # Les données du jeu sont deux dossiers au-dessus (`donnees/cartes/`, ou `donnees/cartes-0-13/` en attendant le
    # lot L0 de la 0.13).
    dossier = chemin.resolve().parent
    donnees = dossier.parent if dossier.name.startswith("cartes") else None
    res = controler(carte, rapport, donnees, avant, plannings)

    print(f"Carte {carte.get('id')} ({chemin})")
    if "trajets" in res:
        vitesse = carte["trajets_cles"]["vitesse"]
        print(f"\nTrajets clés à {vitesse} m/s (sans train / train à quai):")
        for a, b, d1, d2 in res["trajets"]:
            if d1 is None or d2 is None or math.isinf(d1) or math.isinf(d2):
                continue
            t2 = f"{d2 / vitesse:5.1f} s" if abs(d2 - d1) > 0.05 else "  idem"
            print(f"  {a:>20} -> {b:<20} {d1:5.1f} m {d1 / vitesse:5.1f} s   {t2}")
    if "portage" in res:
        d, t = res["portage"]
        print(f"\nPortage de la poutre (couloir de {carte['portage']['largeur_min']} m): {d:.1f} m, {t:.1f} s "
              f"à {carte['portage']['vitesse']} m/s")
    if "visibilite" in res:
        print("\nLieux importants vus par orientation de caméra (o: vu, x: caché):")
        noms = list(ORIENTATIONS)
        print("  " + " " * 22 + "  ".join(f"{n:>10}" for n in noms))
        for pid, r in res["visibilite"].items():
            print(f"  {pid:>22}" + "  ".join(f"{('o' if r[n] is None else 'x ' + r[n][:8]):>10}" for n in noms))
    if "passages du ru" in res:
        print("\nLe ru de la Côte, un seul passage ouvert à la fois (porte de la maisonnette -> rue Haute):")
        for pid, d in res["passages du ru"].items():
            print(f"  {pid:>20}: {d:5.1f} m")
    for cle in ("atteintes pièces bâties", "rue rue_de_la_halte_est", "rue route_des_hameaux", "rue placette_eglise",
                "ru contourné par la source", "agrandissement", "bouts de sentier", "arbres par morceau (max)",
                "A* (trajets)", "A* (pires)"):
        if cle in res:
            print(f"\n{cle}: {res[cle]}")
    if "distances plafonds" in res:
        print("\nDistances plafonds (sans train):")
        for de, a, d, t, m in res["distances plafonds"]:
            print(f"  {de:>12} -> {a:<18} {d:6.1f} m {t:5.1f} s (au plus {m} s)")
    if "cases_cachees" in res:
        print("\nPart des cases franchissables où un personnage est caché (transparence nécessaire):")
        for n, v in res["cases_cachees"].items():
            print(f"  {n:>10}: {v * 100:4.1f} %")
    for a in rapport.avertissements:
        print(f"avertissement: {a}")
    for e in rapport.erreurs:
        print(f"erreur: {e}")
    print(f"\n{len(rapport.erreurs)} erreur(s), {len(rapport.avertissements)} avertissement(s)")
    return 1 if rapport.erreurs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
