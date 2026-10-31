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
8. points et zones demandés par les données du jeu (donnees/*.json, README section 5).

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
# Géométrie partagée avec le script de construction


def taille_monde(type_def: dict, rotation: int) -> tuple[int, int]:
    larg, prof = type_def["emprise"]
    return (larg, prof) if rotation % 2 == 0 else (prof, larg)


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


def calculer_infranchissable(carte: dict) -> dict:
    """Grille de marche: '#' bloqué, '.' libre. Même calcul pour la construction et le contrôle."""
    larg = carte["taille"]["largeur"]
    haut = carte["taille"]["hauteur"]
    bord = carte["taille"]["bord"]
    legende = carte["terrain"]["legende"]
    lignes = carte["terrain"]["lignes"]
    types = carte["types"]
    g = [[bool(legende[lignes[y][x]]["franchissable"]) for x in range(larg)] for y in range(haut)]

    def dans(x: int, y: int) -> bool:
        return 0 <= x < larg and 0 <= y < haut

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
            for x, y in cases_interieures(o, types):
                g[y][x] = True
            for (cx, cy), _ in ouvertures(o, types).values():
                g[cy][cx] = True
    for y in range(haut):
        for x in range(larg):
            if x < bord or y < bord or x >= larg - bord or y >= haut - bord:
                g[y][x] = False
    return {
        "regles": {
            "terrain": "codes dont `franchissable` vaut false dans la légende (eau profonde, bord)",
            "objets": "toute l'emprise des objets, sauf les sols posés (quai, ponton) et les types marqués "
                      "franchissables; bâtiment à intérieur: murs seulement, porte et pièce libres",
            "bord": "les cases à moins de `taille.bord` du bord de la carte",
            "train": "en plus, la zone `train_at_platform` quand le train est à quai",
        },
        "legende": {"#": "infranchissable", ".": "franchissable"},
        "grille": ["".join("." if g[y][x] else "#" for x in range(larg)) for y in range(haut)],
    }


# ---------------------------------------------------------------------------
# Marche


def grille_bool(infr: dict) -> list[list[bool]]:
    return [[c == "." for c in ligne] for ligne in infr["grille"]]


def dijkstra(libre: list[list[bool]], sources: list[tuple[int, int]]) -> dict[tuple[int, int], float]:
    haut, larg = len(libre), len(libre[0])
    dist: dict[tuple[int, int], float] = {}
    tas: list[tuple[float, int, int]] = []
    for x, y in sources:
        if 0 <= x < larg and 0 <= y < haut and libre[y][x]:
            dist[(x, y)] = 0.0
            heapq.heappush(tas, (0.0, x, y))
    while tas:
        d, x, y = heapq.heappop(tas)
        if d > dist.get((x, y), math.inf):
            continue
        for dx, dy, c in VOISINS:
            nx, ny = x + dx, y + dy
            if not (0 <= nx < larg and 0 <= ny < haut) or not libre[ny][nx]:
                continue
            if dx and dy and not (libre[y][nx] and libre[ny][x]):
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

    def cases(self, ident: str, libre: list[list[bool]]) -> list[tuple[int, int]]:
        haut, larg = len(libre), len(libre[0])
        if ident in self.points:
            p = self.points[ident]
            cx, cy = int(math.floor(p["x"])), int(math.floor(p["y"]))
            if 0 <= cx < larg and 0 <= cy < haut and libre[cy][cx] and "portee" not in p:
                return [(cx, cy)]
            portee = p.get("portee", 1.5)
            res = []
            for y in range(cy - 4, cy + 5):
                for x in range(cx - 4, cx + 5):
                    if 0 <= x < larg and 0 <= y < haut and libre[y][x]:
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
                    if libre[y][x]]
        if ident in self.objets:
            return self.autour(self.objets[ident], libre)
        return []

    def autour(self, o: dict, libre: list[list[bool]]) -> list[tuple[int, int]]:
        """Cases libres qui touchent l'emprise d'un objet (8 voisins)."""
        haut, larg = len(libre), len(libre[0])
        x0, y0, w, h = emprise_monde(o, self.carte["types"])
        res = []
        for y in range(y0 - 1, y0 + h + 1):
            for x in range(x0 - 1, x0 + w + 1):
                if 0 <= x < larg and 0 <= y < haut and libre[y][x]:
                    if not (x0 <= x < x0 + w and y0 <= y < y0 + h):
                        res.append((x, y))
        return res


# ---------------------------------------------------------------------------
# Caméra isométrique


def boites_occultantes(carte: dict, avec_train: bool) -> list[tuple[str, float, float, float, float, float, float]]:
    """(id, x0, y0, x1, y1, z0, z1) des volumes qui peuvent cacher la vue."""
    types = carte["types"]
    boites = []
    for o in carte["objets"]:
        t = types[o["type"]]
        if t["hauteur"] <= 0.5:
            continue
        cx, cy = o["x"], o["y"]
        if "occultation_arbre" in t:
            for cote, z0, z1 in t["occultation_arbre"].values():
                boites.append((o["id"], cx - cote / 2, cy - cote / 2, cx + cote / 2, cy + cote / 2, z0, z1))
        elif "occultation" in t:
            cote, z0, z1 = t["occultation"]
            boites.append((o["id"], cx - cote / 2, cy - cote / 2, cx + cote / 2, cy + cote / 2, z0, z1))
        else:
            x0, y0, w, h = emprise_monde(o, types)
            boites.append((o["id"], x0, y0, x0 + w, y0 + h, 0.0, t["hauteur"]))
    # Un poteau, un lampadaire ou un tronc plus fins que 0,6 m ne cachent pas tout un personnage.
    boites = [b for b in boites if b[3] - b[1] >= 0.6 or b[4] - b[2] >= 0.6]
    if avec_train:
        r = next(z for z in carte["zones"] if z["id"] == "train_at_platform")["rect"]
        boites.append(("train", r["x"], r["y"] + 0.15, r["x"] + r["w"], r["y"] + r["h"] - 0.15, 0.0, HAUTEUR_TRAIN))
    return boites


def cache_par(px: float, py: float, hp: float, direction: tuple[float, float], boites: list,
              exclus: set[str]) -> str | None:
    ux, uy = direction[0] / SQRT2, direction[1] / SQRT2
    for ident, x0, y0, x1, y1, z0, z1 in boites:
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
            return ident
    return None


# ---------------------------------------------------------------------------
# Contrôles


def controler(carte: dict, rapport: Rapport, chemin_donnees: Path | None) -> dict[str, Any]:
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
    for y, lg in enumerate(lignes):
        for x, c in enumerate(lg):
            if c not in legende:
                rapport.erreur(f"terrain ({x}, {y}): code {c!r} absent de la légende")
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
        if not (0 <= rx0 and 0 <= ry0 and rx0 + w <= larg and ry0 + h <= haut):
            rapport.erreur(f"objet {o['id']}: sort de la carte")
        rect = o.get("rect")
        if rect != {"x": rx0, "y": ry0, "w": w, "h": h}:
            rapport.erreur(f"objet {o['id']}: `rect` ne correspond pas au centre et à la rotation")
    for p in carte["points"]:
        if not (0 <= p["x"] < larg and 0 <= p["y"] < haut):
            rapport.erreur(f"point {p['id']}: hors de la carte")
        if "rotation" in p and p["rotation"] not in (0, 1, 2, 3):
            rapport.erreur(f"point {p['id']}: rotation invalide")
        if p.get("objet") and p["objet"] not in {o["id"] for o in carte["objets"]}:
            rapport.erreur(f"point {p['id']}: objet {p['objet']!r} inconnu")
    for z in carte["zones"]:
        r = z.get("rect", {})
        if not all(k in r for k in "xywh") or r["x"] < 0 or r["y"] < 0 or r["x"] + r["w"] > larg \
                or r["y"] + r["h"] > haut or r["w"] <= 0 or r["h"] <= 0:
            rapport.erreur(f"zone {z['id']}: rectangle invalide")
    if rapport.erreurs:
        return resultats

    objets = {o["id"]: o for o in carte["objets"]}
    points = {p["id"]: p for p in carte["points"]}
    zones = {z["id"]: z["rect"] for z in carte["zones"]}

    # 2. Cohérence du terrain
    sous_batiments: set[tuple[int, int]] = set()
    for o in carte["objets"]:
        if types[o["type"]]["categorie"] == "batiment":
            x0, y0, w, h = emprise_monde(o, types)
            sous_batiments |= {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w)}
    cases_s = {(x, y) for y in range(haut) for x in range(larg) if lignes[y][x] == "s"}
    if cases_s != sous_batiments:
        rapport.erreur(f"sol de bâtiment: {len(cases_s ^ sous_batiments)} cases ne correspondent pas aux bâtiments")
    if "platform" in objets:
        x0, y0, w, h = emprise_monde(objets["platform"], types)
        quai = {(x, y) for y in range(y0, y0 + h) for x in range(x0, x0 + w)}
        cases_q = {(x, y) for y in range(haut) for x in range(larg) if lignes[y][x] == "q"}
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
                if t["categorie"] != "batiment" and c in "~=#gp":
                    if not (c == "~" and "~" in t.get("sols_permis", [])):
                        rapport.erreur(f"{o['id']}: posé sur un sol interdit {c!r} en ({x}, {y})")

    # 4. Marche
    libre = grille_bool(recalcul)
    libre_train = [ligne[:] for ligne in libre]
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
        total_libre = {(x, y) for y in range(haut) for x in range(larg) if grille[y][x]}
        poches = total_libre - set(atteint)
        if poches:
            rapport.erreur(f"[{nom_cas}] {len(poches)} cases franchissables isolées (poches sans issue), "
                           f"par exemple {sorted(poches)[:5]}")
        resultats[f"atteintes {nom_cas}"] = len(atteint)

    # Portes dégagées
    for o in carte["objets"]:
        t = types[o["type"]]
        for nom, ((cx, cy), (fx, fy)) in ouvertures(o, types).items():
            if not (0 <= fx < larg and 0 <= fy < haut) or not libre[fy][fx]:
                rapport.erreur(f"{o['id']}: {nom} bloquée (case devant ({fx}, {fy}) infranchissable)")
            if t.get("interieur") and not libre[cy][cx]:
                rapport.erreur(f"{o['id']}: {nom} ({cx}, {cy}) infranchissable alors que la pièce est jouable")

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

    # Potager
    reglages = _charger(chemin_donnees, "reglages.json") if chemin_donnees else None
    if "garden" in zones:
        g = zones["garden"]
        cases_g = {(x, y) for y in range(g["y"], g["y"] + g["h"]) for x in range(g["x"], g["x"] + g["w"])}
        cases_p = {(x, y) for y in range(haut) for x in range(larg) if lignes[y][x] == "p"}
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
        for o in arbres:
            if o["type"] not in ("tree_oak", "tree_fir"):
                rapport.erreur(f"arbre {o['id']}: seuls tree_oak et tree_fir existent dans la démo")

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
        couloir = [[all(0 <= x + dx < larg and 0 <= y + dy < haut and libre[y + dy][x + dx]
                        for dx in range(-rayon, rayon + 1) for dy in range(-rayon, rayon + 1))
                    for x in range(larg)] for y in range(haut)]
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
    eau = [(x + 0.5, y + 0.5) for y in range(haut) for x in range(larg) if lignes[y][x] == "~"]
    for p in carte["points"]:
        if p.get("peche") or p["id"] == "river_ford":
            if not lieux.cases(p["id"], libre):
                rapport.erreur(f"pêche {p['id']}: case infranchissable")
            d = min(math.hypot(p["x"] - ex, p["y"] - ey) for ex, ey in eau)
            if d > 6.0:
                rapport.erreur(f"pêche {p['id']}: eau profonde à {d:.1f} m (6 m au plus)")
        if p.get("cueillette") and "forest_edge" in zones:
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
    boites = boites_occultantes(carte, False)
    parts = {}
    for nom, d in ORIENTATIONS.items():
        cachees = sum(1 for y in range(haut) for x in range(larg) if libre[y][x]
                      and cache_par(x + 0.5, y + 0.5, HAUTEUR_PERSONNAGE, d, boites, set()))
        parts[nom] = cachees / max(1, sum(sum(r) for r in libre))
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
    chemin = Path(argv[1]) if len(argv) > 1 else CARTE_PAR_DEFAUT
    try:
        carte = json.loads(chemin.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"erreur: lecture de {chemin} impossible ({exc})")
        return 1
    rapport = Rapport()
    donnees = chemin.resolve().parent.parent if chemin.resolve().parent.name == "cartes" else None
    res = controler(carte, rapport, donnees)

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
