#!/usr/bin/env python3
"""Plans des cinq adresses de Cosy Café: composition, export JSON et dessin SVG.

Une seule source: ce script compose chaque plan (coque, mobilier, zones, parcours,
points de vue), écrit `plans.json`, que lit `valider_plans.py`, puis dessine chaque
SVG à partir de ce même JSON et le convertit en PNG si rsvg-convert est présent.

Repère de chaque plan: x vers la droite, y vers le bas, en mètres; la rue est toujours
en bas du dessin et la flèche du nord donne l'orientation vraie.

Usage: python3 -I construire_plans.py [--sans-png]
Bibliothèque standard seulement.
"""

import json
import math
import os
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# Normes partagées avec le validateur (recopiées dans plans.json).
NORMS = {
    "passage_min": 0.90,  # passage libre minimal partout où l'on circule
    "main_aisle": 1.20,  # allée principale conseillée, de l'entrée à la caisse
    "seat_reach": 0.70,  # distance au plus entre le bord d'un passage de 0,90 m et l'assise
    "leak_width": 0.50,  # gabarit le plus mince d'un client, pour l'étanchéité du comptoir
    "fov_deg": 100,  # champ horizontal supposé de la caméra subjective
    "eye_height": 1.65,
    "crowd_cap": 40,  # plafond provisoire de personnages animés dans le champ
    "queue_pitch": 0.60,  # une personne dans une file
    "public_door_min": 0.90,
    "delivery_door_min": 1.20,
    "public_stair_min": 1.20,
    "second_exit_from": 20,  # personnes présentes à partir desquelles une seconde sortie est due
    "opaque_from": 1.60,  # hauteur à partir de laquelle un meuble cache un visage
    # Plafonds de l'architecte (docs/jeux/cosy-cafe/technique.md, section 11).
    "queue_max": 6,  # C4
    "employees_max": 12,  # C5
    "levels_max": 2,  # C17
    "present_cap": {"village": 24, "bourg": 48, "ville": 72, "paris-quartier": 80, "paris-maison": 120},  # C2
    "furniture_cap": {"village": 60, "bourg": 120, "ville": 200, "paris-quartier": 180, "paris-maison": 350},  # C6
    "furniture_visible_max": 150,  # C6
    "technical_min": 0.60,  # C13
}

CHAIR = 0.45  # emprise d'une chaise
CHAIR_GAP = 0.05  # recul de la chaise depuis le bord de la table, convive assis
STOOL_R = 0.20


def r3(v):
    return round(v + 0.0, 3)


def rect(x, y, w, h):
    return {"rect": [r3(x), r3(y), r3(w), r3(h)]}


def circle(cx, cy, r):
    return {"circle": [r3(cx), r3(cy), r3(r)]}


def poly(points):
    return {"poly": [[r3(x), r3(y)] for x, y in points]}


def shape_bbox(shape):
    if "rect" in shape:
        x, y, w, h = shape["rect"]
        return x, y, x + w, y + h
    if "circle" in shape:
        cx, cy, r = shape["circle"]
        return cx - r, cy - r, cx + r, cy + r
    xs = [p[0] for p in shape["poly"]]
    ys = [p[1] for p in shape["poly"]]
    return min(xs), min(ys), max(xs), max(ys)


def shape_center(shape):
    x0, y0, x1, y1 = shape_bbox(shape)
    return (x0 + x1) / 2, (y0 + y1) / 2


BLOCKING_KINDS = {
    "wall", "partition", "window", "column", "counter", "backbar", "station",
    "table", "seat", "furniture", "fixture", "tree",
}


class Level:
    """Un niveau d'un plan: éléments, zones, points, file, vues, parcours, textes."""

    def __init__(self, level_id, name, frame, draw_offset=(0.0, 0.0)):
        self.data = {
            "id": level_id,
            "name": name,
            "frame": [r3(v) for v in frame],
            "draw_offset": [r3(v) for v in draw_offset],
            "elements": [],
            "zones": [],
            "points": {},
            "queues": [],
            "views": [],
            "routes": [],
            "texts": [],
            "dims": [],
        }
        self._count = {}

    # Éléments -----------------------------------------------------------------
    def _next_id(self, prefix):
        n = self._count.get(prefix, 0) + 1
        self._count[prefix] = n
        return f"{prefix}-{n}"

    def add(self, kind, shape, **attrs):
        el = {"id": attrs.pop("id", None) or self._next_id(kind), "kind": kind, "shape": shape}
        height = attrs.get("height")
        if "blocks" not in attrs:
            attrs["blocks"] = kind in BLOCKING_KINDS
        if "opaque" not in attrs:
            if kind in ("wall", "column"):
                attrs["opaque"] = True
            elif kind == "partition":
                attrs["opaque"] = not attrs.get("glazed", False) and (height is None or height >= NORMS["opaque_from"])
            elif kind in ("window", "opening", "ground", "floor", "marker", "hood"):
                attrs["opaque"] = False
            elif kind == "door":
                attrs["opaque"] = not attrs.get("glazed", False) and attrs.get("access") != "public"
            else:
                attrs["opaque"] = height is not None and height >= NORMS["opaque_from"]
        el.update(attrs)
        self.data["elements"].append(el)
        return el

    def _opening(self, o, shape, orient):
        kind = o.get("type", "door")
        attrs = {k: v for k, v in o.items() if k not in ("at", "w", "type")}
        attrs["orient"] = orient
        attrs["width"] = r3(o["w"])
        if kind == "door":
            attrs.setdefault("access", "public")
            attrs.setdefault("swing", {"leaves": 1, "hinge": "start", "side": "+"})
            attrs.setdefault("height", 2.10)
        elif kind == "window":
            attrs.setdefault("height", 2.40)
        return self.add(kind, shape, **attrs)

    def wall_h(self, x0, x1, y0, y1, openings=(), kind="wall", **attrs):
        """Mur horizontal de x0 à x1, d'épaisseur y0 à y1, coupé par ses ouvertures
        ({"at": x, "w": largeur, "type": "door" | "window" | "opening", ...})."""
        cur = x0
        for o in sorted(openings, key=lambda o: o["at"]):
            a, b = o["at"], o["at"] + o["w"]
            if a > cur + 1e-9:
                self.add(kind, rect(cur, y0, a - cur, y1 - y0), **attrs)
            self._opening(o, rect(a, y0, b - a, y1 - y0), "h")
            cur = b
        if x1 > cur + 1e-9:
            self.add(kind, rect(cur, y0, x1 - cur, y1 - y0), **attrs)

    def wall_v(self, y0, y1, x0, x1, openings=(), kind="wall", **attrs):
        """Mur vertical de y0 à y1, d'épaisseur x0 à x1, coupé par ses ouvertures."""
        cur = y0
        for o in sorted(openings, key=lambda o: o["at"]):
            a, b = o["at"], o["at"] + o["w"]
            if a > cur + 1e-9:
                self.add(kind, rect(x0, cur, x1 - x0, a - cur), **attrs)
            self._opening(o, rect(x0, a, x1 - x0, b - a), "v")
            cur = b
        if y1 > cur + 1e-9:
            self.add(kind, rect(x0, cur, x1 - x0, y1 - cur), **attrs)

    def ground(self, shape, style, label=None):
        return self.add("ground", shape, style=style, label=label)

    def floor(self, shape, style="floor"):
        return self.add("floor", shape, style=style)

    def station(self, x, y, w, h, label, style, height=0.9, post=None, reason=None, fixed=True, **attrs):
        return self.add("station", rect(x, y, w, h), label=label, style=style, height=height,
                        post=post, reason=reason, fixed=fixed, **attrs)

    def counter(self, x, y, w, h, label="comptoir", height=1.10, reason=None, **attrs):
        return self.add("counter", rect(x, y, w, h), label=label, height=height, reason=reason, fixed=True, **attrs)

    def backbar(self, x, y, w, h, label="arrière-comptoir", height=0.90, reason=None, **attrs):
        return self.add("backbar", rect(x, y, w, h), label=label, height=height, reason=reason, fixed=True, **attrs)

    def furniture(self, shape, style, label=None, height=0.9, **attrs):
        return self.add("furniture", shape, style=style, label=label, height=height, **attrs)

    def fixture(self, shape, style, label=None, height=0.9, reason=None, **attrs):
        return self.add("fixture", shape, style=style, label=label, height=height, reason=reason, fixed=True, **attrs)

    def hood(self, x, y, w, h, label="hotte", reason=None):
        return self.add("hood", rect(x, y, w, h), label=label, reason=reason, fixed=True, blocks=False)

    def marker(self, x, y, style, label=None, reason=None):
        return self.add("marker", circle(x, y, 0.12), style=style, label=label, reason=reason, fixed=True, blocks=False)

    def tree(self, cx, cy, crown, trunk=0.25, label=None):
        return self.add("tree", circle(cx, cy, trunk), crown=r3(crown), label=label, height=6.0, opaque=False)

    # Assises ------------------------------------------------------------------
    def seat(self, shape, area, room, style="chair", back=None, **attrs):
        return self.add("seat", shape, seat={"area": area, "room": room}, style=style, back=back,
                        height=attrs.pop("height", 0.9), **attrs)

    def table(self, x, y, w, h, chairs, area="inside", room="salle", round_=False, height=0.75):
        """Table de coin nord-ouest (x, y); chairs: côtés « N S E W », suivis d'un
        nombre pour plusieurs chaises sur un même côté (« N2 S2 »)."""
        if round_:
            self.add("table", circle(x + w / 2, y + h / 2, w / 2), height=height, round=True)
        else:
            self.add("table", rect(x, y, w, h), height=height)
        for token in chairs.split():
            side, count = token[0], int(token[1:] or 1)
            for i in range(count):
                if side in "NS":
                    cx = x + w * (i + 0.5) / count
                    cy = y - CHAIR_GAP - CHAIR / 2 if side == "N" else y + h + CHAIR_GAP + CHAIR / 2
                else:
                    cy = y + h * (i + 0.5) / count
                    cx = x - CHAIR_GAP - CHAIR / 2 if side == "W" else x + w + CHAIR_GAP + CHAIR / 2
                self.seat(rect(cx - CHAIR / 2, cy - CHAIR / 2, CHAIR, CHAIR), area, room, back=side)

    def stool(self, cx, cy, area="inside", room="salle"):
        return self.seat(circle(cx, cy, STOOL_R), area, room, style="stool", height=0.75)

    def bench(self, x, y, w, h, places, area, room, back, style="bench"):
        """Banc ou banquette découpé en places égales (le long du grand côté)."""
        horizontal = w >= h
        for i in range(places):
            if horizontal:
                self.seat(rect(x + w * i / places, y, w / places, h), area, room, style=style, back=back)
            else:
                self.seat(rect(x, y + h * i / places, w, h / places), area, room, style=style, back=back)

    def armchair(self, x, y, area="inside", room="salle", back="N", size=0.75):
        return self.seat(rect(x, y, size, size), area, room, style="armchair", back=back, height=0.8)

    # Zones, points, file, vues ----------------------------------------------------
    def zone(self, kind, shape, label=None, extras=0, **attrs):
        z = {"id": attrs.pop("id", None) or self._next_id("zone-" + kind), "kind": kind, "shape": shape, "label": label}
        if kind == "space":
            z["extras"] = extras
        z.update(attrs)
        self.data["zones"].append(z)
        return z

    def point(self, name, x, y):
        many = ("entrance", "exits", "wc")
        if name in many:
            self.data["points"].setdefault(name, []).append([r3(x), r3(y)])
        else:
            self.data["points"][name] = [r3(x), r3(y)]

    def queue(self, qid, points, width, places, register, pickup, doors):
        """File d'attente: de sa porte (premier point) à sa caisse (dernier point)."""
        self.data["queues"].append({
            "id": qid, "points": [[r3(x), r3(y)] for x, y in points], "width": r3(width), "places": places,
            "register": [r3(register[0]), r3(register[1])], "pickup": [r3(pickup[0]), r3(pickup[1])],
            "doors": list(doors)})

    def view(self, view_id, label, x, y, facing, checks=()):
        self.data["views"].append({"id": view_id, "label": label, "pos": [r3(x), r3(y)],
                                   "facing_deg": facing, "checks": list(checks)})

    def route(self, kind, points, label=None):
        self.data["routes"].append({"kind": kind, "points": [[r3(x), r3(y)] for x, y in points], "label": label})

    def text(self, x, y, s, style="label", rotate=0, anchor="middle"):
        self.data["texts"].append({"pos": [r3(x), r3(y)], "text": s, "style": style, "rotate": rotate, "anchor": anchor})

    def dim(self, p0, p1, s, offset=0.6):
        self.data["dims"].append({"from": [r3(p0[0]), r3(p0[1])], "to": [r3(p1[0]), r3(p1[1])], "text": s, "offset": offset})


class Plan:
    def __init__(self, plan_id, address, state, number, title, state_label, north_deg,
                 capacity, staff, summary, scale_px=40):
        self.data = {
            "id": plan_id,
            "address": address,
            "state": state,
            "number": number,
            "title": title,
            "state_label": state_label,
            "north_deg": north_deg,
            "capacity": capacity,
            "staff": staff,
            "summary": summary,
            "scale_px": scale_px,
            "levels": [],
            "links": [],
        }
        self.levels = []

    def level(self, level_id, name, frame, draw_offset=(0.0, 0.0)):
        lv = Level(level_id, name, frame, draw_offset)
        self.levels.append(lv)
        return lv

    def link(self, link_id, label, frm, to, width, length, public):
        self.data["links"].append({"id": link_id, "label": label, "from": frm, "to": to,
                                   "width": width, "length": length, "public": public})

    def export(self):
        out = dict(self.data)
        out["levels"] = [lv.data for lv in self.levels]
        return out


def fmt(v, digits=2):
    """Nombre à la française (virgule décimale)."""
    s = f"{v:.{digits}f}"
    return s.replace(".", ",")


# =====================================================================================
# 1. Village: Ormeval, le Café de la place
# =====================================================================================

def village(state):
    arrival = state == "arrivee"
    cap = {"inside": 8, "outside": 2} if arrival else {"inside": 12, "outside": 6}
    p = Plan(
        f"village-{state}", "village", state, 1,
        "Ormeval, le Café de la place",
        "À l'arrivée" if arrival else "Agrandi au maximum",
        0, cap, {"players": 2, "employees": 0},
        ("Boutique de 38 m² (7,00 x 5,40 m) sur la place du Tilleul, vitrine au sud. "
         + ("La pièce du fond est fermée; dehors, seul le banc de la patronne."
            if arrival else "E1: terrasse sous le store. E2: la pièce du fond, au coin du feu.")),
        scale_px=50,
    )
    L = p.level("rdc", "Rez-de-chaussée", (0, 0, 16, 19.5))

    # Dehors: la cour au nord, la ruelle du Lavoir à l'est, la place au sud.
    L.ground(rect(2.1, 0, 9.4, 3.0), "courtyard")
    L.ground(rect(0, 0, 2.1, 3.0), "grass")
    L.ground(rect(11.7, 0, 4.3, 3.0), "grass")
    L.ground(rect(11.5, 0, 2.0, 13.0), "pavement")
    L.ground(rect(0, 13.0, 16, 6.5), "pavement")
    L.ground(rect(0, 3.0, 1.9, 10.0), "neighbour")
    L.ground(rect(13.5, 3.0, 2.5, 10.0), "neighbour")
    L.zone("backdrop", rect(0, 0, 1.9, 13.0), "décor")
    L.zone("backdrop", rect(11.7, 0, 4.3, 13.0), "décor")
    L.zone("backdrop", rect(0, 16.5, 16, 3.0), "décor")
    L.text(0.95, 8.0, "maison voisine", "street", rotate=-90)
    L.text(14.75, 8.0, "boulangerie", "street", rotate=-90)
    L.text(12.6, 6.4, "ruelle du Lavoir", "street", rotate=-90)
    L.text(4.6, 1.85, "cour: poubelles, caisses vides, figuier", "street", anchor="start")
    L.text(8.0, 16.2, "trottoir de la place (on y joue jusqu'ici)", "note")
    L.text(8.0, 19.05, "place du Tilleul: arrêt du car, mairie-école à l'est, église au sud", "street")
    L.tree(2.6, 17.4, 1.9, label="tilleul")
    L.fixture(circle(13.6, 17.6, 0.8), "fountain", "fontaine", height=0.8)
    L.tree(3.2, 1.2, 1.1, trunk=0.15, label="figuier")
    L.fixture(rect(6.4, 0.3, 1.8, 0.7), "bins", "poubelles", height=1.1)
    L.wall_v(0.0, 3.0, 1.9, 2.1, kind="partition", height=1.8)
    L.wall_v(0.0, 3.0, 11.5, 11.7, [{"at": 0.6, "w": 1.6, "type": "door", "access": "staff", "delivery": True,
                                     "swing": {"leaves": 2, "hinge": "start", "side": "-"}, "label": "portail"}],
             kind="partition", height=1.8)

    # Maison: murs de pierre de 0,5 m, refend de 0,4 m, plafond à 2,70 m sous les solives.
    L.wall_h(1.9, 11.5, 3.0, 3.5, [
        {"at": 6.6, "w": 1.1, "type": "window", "sill": 0.9},
        {"at": 9.3, "w": 1.2, "type": "door", "access": "staff", "delivery": True, "label": "porte de la cour",
         "swing": {"leaves": 2, "hinge": "start", "side": "+"}},
    ])
    L.wall_v(3.0, 13.0, 1.9, 2.4)
    L.wall_v(3.5, 12.5, 3.6, 4.0)
    L.wall_v(3.0, 13.0, 11.0, 11.5)
    L.floor(rect(2.4, 3.5, 1.2, 9.0), "neighbour")
    L.fixture(rect(2.45, 4.0, 1.1, 4.2), "stairs", "escalier du logement", height=0.0, steps=15, up="N")
    L.wall_h(1.9, 11.5, 12.5, 13.0, [
        {"at": 2.5, "w": 0.9, "type": "door", "access": "closed", "label": "logement",
         "swing": {"leaves": 1, "hinge": "start", "side": "-"}},
        {"at": 4.4, "w": 2.0, "type": "window", "sill": 0.45},
        {"at": 6.5, "w": 2.0, "type": "window", "sill": 0.45},
        {"at": 8.8, "w": 1.2, "type": "door", "access": "public", "glazed": True, "label": "entrée",
         "entrance": True, "id": "porte-entree", "swing": {"leaves": 2, "hinge": "start", "side": "+"}},
        {"at": 10.2, "w": 0.6, "type": "window", "sill": 0.9},
    ])
    if arrival:
        refend_door = {"at": 5.95, "w": 0.9, "type": "door", "access": "closed",
                       "swing": {"leaves": 1, "hinge": "start", "side": "-"}, "label": "pièce du fond"}
    else:
        refend_door = {"at": 5.8, "w": 1.2, "type": "opening", "label": "arche"}
    L.wall_h(4.0, 11.0, 6.7, 7.1, [refend_door,
                                   {"at": 10.0, "w": 0.9, "type": "door", "access": "staff",
                                    "swing": {"leaves": 1, "hinge": "end", "side": "-"}}])
    L.wall_v(3.5, 6.7, 8.0, 8.1, kind="partition", height=2.7)

    L.floor(rect(4.0, 7.1, 7.0, 5.4), "wood")
    L.floor(rect(4.0, 3.5, 4.0, 3.2), "closed" if arrival else "wood")
    L.floor(rect(8.1, 3.5, 2.9, 3.2), "tiles")

    # Toilettes des clients, dans l'angle nord-ouest de la boutique.
    L.floor(rect(4.0, 7.1, 1.7, 2.0), "tiles")
    L.wall_v(7.1, 9.2, 5.7, 5.8, [{"at": 7.6, "w": 0.9, "type": "door", "access": "public",
                                   "swing": {"leaves": 1, "hinge": "start", "side": "+"}, "label": "WC"}],
             kind="partition", height=2.7)
    L.wall_h(4.0, 5.7, 9.1, 9.2, kind="partition", height=2.7)
    L.fixture(rect(4.1, 7.15, 0.4, 0.65), "wc", "WC", height=0.45)
    L.fixture(rect(5.1, 7.15, 0.5, 0.35), "basin", "lave-mains", height=0.85)
    L.marker(4.3, 8.0, "drain")
    L.point("wc", 4.85, 8.4)

    # Zone de travail: arrière-comptoir contre le refend, allée de 1,10 m, comptoir face à la porte.
    L.zone("work", rect(7.1, 7.1, 3.9, 2.4), "zone de travail")
    L.wall_v(7.1, 9.5, 7.0, 7.1, kind="partition", height=1.10)
    L.backbar(7.1, 7.1, 2.8, 0.6,
              reason="Contre le refend: l'eau et l'évacuation de l'ancienne cuisine arrivent derrière ce mur.")
    L.station(7.15, 7.12, 0.8, 0.55, "plonge", "sink", post="plonge",
              reason="Évier et lave-verres sous le plan, sur l'arrivée d'eau du refend.")
    L.station(8.0, 7.12, 0.75, 0.55, "frigo", "fridge", post="frigo",
              reason="Réfrigérateur sous le plan, à un pas de la machine: le lait est à portée de main.")
    L.marker(7.4, 6.95, "water")
    L.marker(7.7, 6.95, "drain")
    L.text(9.3, 7.4, "ardoise", "note")
    L.counter(8.0, 8.8, 3.0, 0.7, reason="Parallèle à la façade: derrière lui, on fait face à la porte.")
    L.station(8.05, 8.85, 0.6, 0.55, "passe", "pass", height=1.10, post="passe")
    L.station(8.75, 8.85, 0.8, 0.55, "machine", "machine", height=1.40, post="machine",
              reason="Sur le comptoir, face à la salle: seul point du comptoir où arrivent l'eau, l'évacuation "
                     "et la prise de 32 A, passées sous le plancher de l'allée.")
    L.station(9.6, 8.88, 0.35, 0.45, "moulin", "grinder", height=1.45, post="moulin", label_at=[9.78, 9.72])
    L.station(10.25, 8.85, 0.7, 0.55, "caisse", "register", height=1.25, post="caisse",
              reason="Au bout du comptoir, côté porte: la file y arrive tout droit, le long du mur est.")
    L.marker(9.15, 8.65, "power")
    L.wall_h(7.1, 8.0, 8.8, 9.5, [{"at": 7.1, "w": 0.9, "type": "door", "access": "staff",
                                   "swing": {"leaves": 1, "hinge": "start", "side": "+"}, "label": "portillon"}],
             kind="partition", height=1.10)

    # Réserve: tableau électrique, porte de la cour pour les livraisons.
    L.zone("private", rect(8.1, 3.5, 2.9, 3.2), "réserve")
    L.furniture(rect(8.15, 3.55, 0.85, 0.45), "shelf", "étagères", height=2.0)
    L.furniture(rect(10.5, 4.4, 0.45, 1.5), "shelf", "étagères", height=2.0)
    L.station(8.15, 5.9, 0.7, 0.75, "frigo", "fridge", height=1.85, post="frigo de la réserve")
    L.marker(10.8, 3.8, "panel", "tableau")
    L.point("stock", 9.3, 5.0)
    L.point("delivery", 10.6, 1.6)

    # Pièce du fond: l'ancienne cuisine et sa cheminée.
    L.fixture(rect(4.5, 3.5, 1.5, 0.55), "fireplace", "cheminée", height=1.2,
              reason="Le conduit monte dans le mur du fond, côté cour, comme dans les anciennes cuisines du village.")
    if arrival:
        L.zone("extension", rect(4.0, 3.5, 4.0, 3.2), "E2: la pièce du fond, fermée")
        L.zone("extension", rect(4.0, 13.0, 4.8, 2.5), "E1: terrasse sous le store")
        L.furniture(rect(4.2, 5.3, 1.6, 1.1), "crates", "affaires de la patronne", height=1.2)
    else:
        L.zone("free", rect(4.0, 4.05, 4.0, 2.65), "pièce du fond")
        L.armchair(4.1, 4.3, back="W", room="fond")
        L.armchair(5.65, 4.3, back="E", room="fond")
        L.furniture(circle(5.25, 4.7, 0.25), "low_table", None, height=0.45)
        L.table(7.3, 4.6, 0.7, 0.7, "N S", room="fond")
        L.furniture(rect(4.05, 6.15, 1.4, 0.5), "shelf", "livres", height=1.8)

    # Salle: trois tables le long de la vitrine, une dans le coin des toilettes.
    L.zone("free", rect(4.0, 9.2, 4.8, 3.3), "salle")
    L.zone("keep_clear", rect(5.8, 7.1, 1.2, 2.4), "dégagement")
    L.zone("keep_clear", rect(7.1, 9.5, 2.9, 1.2), "passe")
    L.zone("keep_clear", rect(10.0, 9.5, 1.0, 3.0), "file")
    L.zone("keep_clear", rect(8.8, 10.7, 1.2, 1.8), "porte")
    for x in (4.5, 6.1, 7.7):
        L.table(x, 11.9, 0.6, 0.6, "W E", round_=True)
    L.table(4.0, 9.75, 0.7, 0.7, "N S")

    # Terrasse: le banc de la patronne, puis deux tables sous le store.
    L.bench(5.0, 13.05, 1.2, 0.45, 2, "outside", "terrasse", back="N")
    L.furniture(rect(8.3, 13.1, 0.4, 0.3), "slate", "ardoise", height=1.2)
    L.zone("keep_clear", rect(8.8, 13.0, 1.2, 3.5), "porte")
    if not arrival:
        L.zone("free", rect(4.0, 13.0, 4.8, 2.5), "terrasse")
        L.hood(4.0, 13.0, 4.8, 2.5, label="store banne")
        L.table(5.2, 14.45, 0.6, 0.6, "W E", area="outside", room="terrasse", round_=True)
        L.table(7.1, 14.45, 0.6, 0.6, "W E", area="outside", room="terrasse", round_=True)
        L.furniture(rect(4.05, 15.05, 0.6, 0.4), "plant", "jardinière", height=0.9)

    # Points, file, vues, espaces.
    L.point("entrance", 9.4, 16.0)
    L.point("exits", 9.4, 16.0)
    L.point("staff_start", 8.7, 8.25)
    L.queue("comptoir", [(10.5, 12.05), (10.5, 9.95)], 1.0, 4, register=(10.55, 9.95), pickup=(8.35, 9.95),
            doors=["porte-entree"])
    L.view("caisse", "caisse", 10.6, 8.25, 180, ["queue:comptoir"])
    L.view("machine", "machine", 9.15, 8.25, 180, ["door:porte-entree"])
    L.view("entree", "entrée", 9.4, 12.1, 0, [])
    L.zone("space", rect(4.0, 7.1, 7.0, 5.4), "salle et comptoir", extras=2)
    L.zone("space", rect(4.0, 3.5, 4.0, 3.2), "pièce du fond", extras=1)
    L.zone("space", rect(0, 13.0, 16, 6.5), "place", extras=4)

    # Parcours.
    L.route("clients", [(9.4, 15.8), (9.4, 13.4), (9.6, 12.3), (10.5, 11.9), (10.5, 10.2)])
    L.route("clients", [(10.2, 9.95), (8.6, 9.95)])
    L.route("clients", [(8.2, 10.3), (7.5, 11.1), (5.8, 11.3)])
    if arrival:
        L.route("clients", [(6.4, 10.2), (6.4, 8.45), (6.0, 8.05)])
    else:
        L.route("clients", [(6.4, 10.2), (6.4, 6.2), (6.6, 5.6)])
    L.route("staff", [(8.3, 8.25), (7.55, 8.25), (7.55, 10.1), (6.8, 10.9)])
    L.route("staff", [(10.45, 7.9), (10.45, 5.9)])
    L.route("delivery", [(12.6, 12.5), (12.6, 1.4), (9.9, 1.4), (9.9, 4.6)])

    # Textes et cotes.
    L.text(6.0, 5.1 if arrival else 6.45, "pièce du fond", "room")
    L.text(9.5, 4.6, "réserve", "room")
    L.text(6.3, 10.95, "salle", "room")
    L.text(6.4, 15.75, "terrasse", "room")
    L.text(3.0, 9.6, "logement", "street", rotate=-90)
    L.dim((4.0, 3.0), (11.0, 3.0), "7,00 m", offset=-0.3)
    L.dim((11.0, 7.1), (11.0, 12.5), "5,40 m", offset=0.95)
    L.dim((11.0, 3.5), (11.0, 6.7), "3,20 m", offset=0.95)
    return p


def bourg(state):
    arrival = state == "arrivee"
    cap = {"inside": 11, "outside": 0} if arrival else {"inside": 21, "outside": 18}
    p = Plan(
        f"bourg-{state}", "bourg", state, 2,
        "Mérelles, la boutique de la place de la Halle",
        "À l'arrivée" if arrival else "Agrandie au maximum",
        90, cap, {"players": 2, "employees": 0 if arrival else 1},
        ("Ancienne pâtisserie de 81 m² (7,00 x 11,60 m), vitrine à l'est, face à la halle. "
         + ("Le laboratoire attend son four; la remise et la cour servent de débarras."
            if arrival else "E1: terrasse de la halle. E2: salle de la remise. E3: la cour sous la treille. "
                            "Un coup de main les jours de marché.")),
        scale_px=40,
    )
    L = p.level("rdc", "Rez-de-chaussée", (0, 0, 11, 31.5))

    # Dehors: ruelle des Tanneurs (ouest, en haut), place de la Halle (est, en bas).
    L.ground(rect(0, 0, 11, 2.0), "pavement")
    L.ground(rect(0, 2.0, 1.5, 22.9), "neighbour")
    L.ground(rect(9.5, 2.0, 1.5, 22.9), "neighbour")
    L.ground(rect(0, 24.9, 11, 6.6), "pavement")
    L.zone("backdrop", rect(0, 0, 11, 2.0), "décor")
    L.zone("backdrop", rect(0, 2.0, 1.5, 22.9), "décor")
    L.zone("backdrop", rect(9.5, 2.0, 1.5, 22.9), "décor")
    L.zone("backdrop", rect(0, 28.6, 11, 2.9), "décor")
    L.text(5.5, 0.9, "ruelle des Tanneurs (vers l'Arvelle)", "street")
    L.text(0.75, 14.0, "maison voisine", "street", rotate=-90)
    L.text(10.25, 7.0, "quincaillerie", "street", rotate=-90)
    L.text(5.5, 28.25, "trottoir de la place (on y joue jusqu'ici)", "note")
    L.text(5.5, 30.75, "place de la Halle: la halle aux grains en face,", "street")
    L.text(5.5, 31.2, "marché le jeudi; la gare au nord, par la Grand-Rue", "street")
    for x in (1.0, 4.4, 7.8):
        L.furniture(rect(x, 29.0, 2.2, 1.0), "stall", "étal du jeudi", height=2.1, blocks=False, opaque=False)
    L.fixture(circle(10.4, 26.6, 0.18), "post", None, height=4.0)
    L.text(10.4, 27.2, "réverbère", "note")

    # Remise (au fond, sur la ruelle) et porche des livraisons.
    L.wall_h(1.5, 9.5, 2.0, 2.5, [
        {"at": 3.0, "w": 1.2, "type": "window", "sill": 1.2},
        {"at": 6.7, "w": 2.3, "type": "door", "access": "staff" if arrival else "public", "delivery": True,
         "label": "portail", "swing": {"leaves": 2, "hinge": "start", "side": "+"}},
    ])
    L.wall_v(2.0, 6.8, 1.5, 2.0)
    L.wall_v(2.0, 24.9, 9.0, 9.5)
    L.wall_v(2.5, 6.8, 6.6, 6.7)
    L.wall_h(1.5, 6.7, 6.5, 6.8, [
        {"at": 3.4, "w": 1.4, "type": "door", "access": "closed" if arrival else "public", "glazed": True,
         "label": "remise", "swing": {"leaves": 2, "hinge": "start", "side": "-"}},
        {"at": 5.0, "w": 1.2, "type": "window", "sill": 0.9},
    ])
    L.floor(rect(2.0, 2.5, 4.6, 4.0), "closed" if arrival else "wood")
    L.floor(rect(6.7, 2.5, 2.3, 4.3), "courtyard")
    L.hood(6.7, 2.0, 2.3, 4.8, label="")
    L.wall_v(6.8, 12.3, 1.5, 2.0, kind="wall")

    # Cour.
    L.ground(rect(2.0, 6.8, 7.0, 5.5), "courtyard")
    L.fixture(rect(8.15, 7.0, 0.75, 1.3), "bins", "poubelles", height=1.1)
    L.point("delivery", 7.85, 3.2)

    # Bâtiment principal: mur du fond sur la cour.
    L.wall_h(1.5, 9.5, 12.3, 12.8, [
        {"at": 2.3, "w": 1.4, "type": "door", "access": "staff", "delivery": True, "label": "livraisons",
         "swing": {"leaves": 2, "hinge": "start", "side": "-"}},
        {"at": 4.6, "w": 1.0, "type": "window", "sill": 1.1},
        {"at": 7.95, "w": 0.9, "type": "door", "access": "staff" if arrival else "public", "glazed": True,
         "label": "cour", "swing": {"leaves": 1, "hinge": "end", "side": "-"}},
    ])
    L.wall_v(12.3, 24.9, 1.5, 2.0)
    L.floor(rect(2.0, 12.8, 3.9, 4.7), "kitchen")
    L.floor(rect(6.0, 12.8, 1.65, 2.6), "tiles")
    L.floor(rect(6.0, 15.5, 1.65, 2.0), "tiles")
    L.floor(rect(7.75, 12.8, 1.25, 4.8), "wood")
    L.floor(rect(2.0, 17.6, 7.0, 6.8), "wood")

    # Laboratoire (l'ancien fournil du pâtissier).
    L.zone("private", rect(2.0, 12.8, 3.9, 4.7), "laboratoire")
    L.station(2.05, 14.1, 0.95, 1.0, "four", "oven", height=1.6, post="four",
              reason="Contre le mur mitoyen: le conduit de l'ancien four du pâtissier y monte jusqu'au toit.")
    L.hood(2.0, 13.9, 1.25, 1.4, label="hotte")
    L.marker(2.25, 13.7, "duct")
    L.marker(3.25, 14.6, "power")
    if not arrival:
        L.station(2.05, 15.35, 0.95, 1.0, "four 2", "oven", height=1.6, post="four 2")
        L.hood(2.0, 15.15, 1.25, 1.4, label="")
    L.station(3.9, 15.0, 1.8, 0.8, "marbre", "worktop", height=0.9, post="marbre",
              reason="Le marbre du pâtissier, scellé: on y façonne pâtes et gâteaux.")
    L.station(3.75, 12.85, 0.75, 0.75, "frigo", "fridge", height=1.9, post="armoire froide")
    L.station(4.6, 12.85, 0.9, 0.6, "évier", "sink", post="évier du labo")
    L.marker(5.05, 13.65, "water")
    L.station(4.3, 16.6, 1.0, 0.85, "batteur", "worktop", height=1.0, post="batteur")
    L.wall_v(12.8, 17.5, 5.9, 6.0, [{"at": 13.7, "w": 1.2, "type": "door", "access": "staff", "delivery": True,
                                     "label": "réserve", "swing": {"leaves": 2, "hinge": "start", "side": "+"}}],
             kind="partition", height=3.1)
    # Réserve.
    L.zone("private", rect(6.0, 12.8, 1.65, 2.6), "réserve")
    L.furniture(rect(6.05, 12.85, 1.55, 0.4), "shelf", "étagères", height=2.0)
    L.furniture(rect(7.3, 13.4, 0.3, 1.9), "shelf", "", height=2.0)
    L.marker(6.3, 15.2, "panel", "tableau")
    L.point("stock", 6.6, 14.2)
    L.wall_h(6.0, 7.65, 15.4, 15.5, kind="partition", height=3.1)
    # Toilettes des clients, sur le couloir.
    L.fixture(rect(6.05, 16.75, 0.4, 0.65), "wc", "WC", height=0.45)
    L.fixture(rect(6.1, 15.55, 0.5, 0.35), "basin", "lave-mains", height=0.85)
    L.marker(6.25, 16.45, "drain")
    L.point("wc", 6.9, 16.2)
    L.wall_v(12.8, 17.5, 7.65, 7.75, [{"at": 15.9, "w": 0.9, "type": "door", "access": "public",
                                       "swing": {"leaves": 1, "hinge": "start", "side": "-"}, "label": "WC"}],
             kind="partition", height=3.1)
    # Cloison du fond de boutique: porte du labo, vitrage sur le fournil, mur plein derrière les toilettes.
    L.wall_h(2.0, 2.9, 17.5, 17.6, [{"at": 2.0, "w": 0.9, "type": "door", "access": "staff",
                                     "swing": {"leaves": 1, "hinge": "start", "side": "-"}}], kind="partition")
    L.add("partition", rect(2.9, 17.5, 3.0, 0.1), height=3.1, glazed=True, label=None,
          reason="Vitrée au-dessus de l'arrière-comptoir: la salle voit les fournées.")
    L.wall_h(5.9, 7.75, 17.5, 17.6, kind="partition", height=3.1)

    # Zone de travail: arrière-comptoir, allée de 1,10 m, comptoir en face de la porte.
    L.zone("work", rect(2.0, 17.6, 5.65, 2.4), "zone de travail")
    L.backbar(2.9, 17.6, 4.75, 0.6, reason="Adossé à la cloison vitrée du laboratoire.")
    L.station(2.95, 17.62, 0.8, 0.55, "thés", "tea", post="thés")
    L.station(5.75, 17.62, 0.75, 0.55, "frigo", "fridge", post="frigo")
    L.station(6.55, 17.62, 1.05, 0.55, "plonge", "sink", post="plonge")
    L.marker(6.9, 17.4, "water")
    L.marker(7.25, 17.4, "drain")
    L.text(4.3, 17.9, "ardoise", "note")
    L.counter(2.0, 19.3, 4.75, 0.7, reason="Face à la porte: la file longe le mur sud et arrive à la caisse.")
    L.station(2.15, 19.35, 0.8, 0.55, "caisse", "register", height=1.25, post="caisse",
              reason="Au bout de la file, à l'angle: le client voit les gâteaux en payant.")
    L.station(3.05, 19.35, 1.5, 0.6, "vitrine à gâteaux", "display", height=1.25, post="vitrine",
              reason="Entre la caisse et la machine: la file passe devant en arrivant.")
    L.station(4.75, 19.35, 0.8, 0.55, "machine", "machine", height=1.40, post="machine")
    L.station(5.6, 19.4, 0.35, 0.45, "moulin", "grinder", height=1.45, post="moulin", label_at=[5.78, 20.25])
    L.station(6.05, 19.35, 0.65, 0.55, "passe", "pass", height=1.10, post="passe")
    L.marker(5.15, 19.15, "power")
    L.wall_h(6.75, 7.65, 19.3, 20.0, [{"at": 6.75, "w": 0.9, "type": "door", "access": "staff",
                                       "swing": {"leaves": 1, "hinge": "end", "side": "+"}, "label": "portillon"}],
             kind="partition", height=1.10)
    L.wall_v(17.6, 20.0, 7.65, 7.75, kind="partition", height=1.10)

    # Façade sur la place: porte à deux vantaux, vitrine en deux panneaux.
    L.wall_h(1.5, 9.5, 24.4, 24.9, [
        {"at": 3.0, "w": 1.2, "type": "door", "access": "public", "glazed": True, "entrance": True, "label": "entrée",
         "id": "porte-entree", "swing": {"leaves": 2, "hinge": "start", "side": "+"}},
        {"at": 4.5, "w": 2.05, "type": "window", "sill": 0.45},
        {"at": 6.65, "w": 2.05, "type": "window", "sill": 0.45},
    ])

    # Salle: allée de 1,20 m de la porte à la passe, deux rangs de tables.
    L.zone("free", rect(4.3, 21.2, 4.7, 3.2), "salle")
    L.zone("keep_clear", rect(2.0, 20.0, 1.1, 4.4), "file")
    L.zone("keep_clear", rect(3.1, 20.0, 4.65, 1.2), "passe")
    L.zone("keep_clear", rect(3.1, 21.2, 1.2, 3.2), "allée")
    L.zone("keep_clear", rect(7.75, 12.8, 1.25, 8.15), "couloir")
    if arrival:
        for x in (4.5, 6.1, 7.7):
            L.table(x, 21.75, 0.6, 0.6, "N S")
    else:
        L.table(4.5, 21.75, 1.2, 0.7, "N2 S2")
        L.table(6.7, 21.75, 1.2, 0.7, "N2 S2")
    L.table(5.0, 23.8, 0.6, 0.6, "W E", round_=True)
    L.table(6.6, 23.8, 0.6, 0.6, "W E", round_=True)
    L.table(8.4, 23.8, 0.6, 0.6, "W", round_=True)

    # Extensions.
    if arrival:
        L.zone("extension", rect(2.0, 2.5, 4.6, 4.0), "E2: salle de la remise")
        L.zone("extension", rect(2.0, 6.8, 7.0, 5.5), "E3: la cour")
        L.zone("extension", rect(1.5, 24.9, 8.0, 2.6), "E1: terrasse de la halle")
        L.furniture(rect(2.3, 3.0, 2.0, 1.2), "crates", "bric-à-brac", height=1.5)
        L.furniture(rect(3.0, 8.0, 1.8, 1.0), "crates", "cagettes", height=1.2)
    else:
        # E2: la remise, sa grande table de ferme et sa desserte.
        L.zone("free", rect(2.0, 2.5, 4.6, 4.0), "remise")
        L.table(3.1, 4.05, 2.4, 0.9, "N4 S4", room="remise")
        L.furniture(rect(2.05, 3.0, 0.45, 2.6), "shelf", "desserte", height=0.95)
        # E3: la cour sous la treille.
        L.zone("free", rect(2.0, 6.8, 7.0, 5.5), "cour")
        L.hood(2.0, 6.8, 7.0, 5.5, label="treille")
        L.table(2.1, 8.2, 0.6, 0.6, "N S", area="outside", room="cour", round_=True)
        L.table(2.1, 10.0, 0.6, 0.6, "N S", area="outside", room="cour", round_=True)
        L.table(4.2, 9.1, 0.6, 0.6, "W E", area="outside", room="cour", round_=True)
        L.table(5.9, 8.4, 0.6, 0.6, "W E", area="outside", room="cour", round_=True)
        # E1: la terrasse de la halle, sous le store.
        L.zone("free", rect(4.2, 24.9, 5.3, 2.6), "terrasse")
        L.hood(1.5, 24.9, 8.0, 2.6, label="store")
        for x in (4.95, 6.55, 8.15):
            L.table(x, 25.0, 0.6, 0.6, "W E", area="outside", room="terrasse", round_=True)
        for x in (4.95, 6.55):
            L.table(x, 26.6, 0.6, 0.6, "W E", area="outside", room="terrasse", round_=True)
        L.furniture(rect(8.4, 26.7, 1.0, 0.4), "plant", "jardinière", height=0.9)
        L.furniture(rect(1.6, 24.95, 1.3, 0.4), "plant", "jardinière", height=0.9)
    L.zone("keep_clear", rect(3.0, 24.9, 1.2, 3.7), "porte")
    L.furniture(rect(4.3, 25.05, 0.25, 0.5), "slate", "ardoise", height=1.2)

    # Points, file, vues, espaces.
    L.point("entrance", 3.6, 28.2)
    L.point("exits", 3.6, 28.2)
    if not arrival:
        L.point("exits", 7.85, 2.9)
    L.point("staff_start", 4.5, 18.75)
    L.queue("comptoir", [(2.55, 23.75), (2.55, 20.45)], 1.1, 6, register=(2.55, 20.45), pickup=(6.4, 20.45),
            doors=["porte-entree"])
    L.view("caisse", "caisse", 2.55, 18.75, 180, ["queue:comptoir"])
    L.view("machine", "machine", 5.15, 18.75, 180, ["door:porte-entree"])
    L.view("salle", "fond de salle", 8.4, 20.6, 180, [])
    L.view("couloir", "couloir", 8.4, 13.6, 0, [])
    L.zone("space", rect(2.0, 17.6, 7.0, 6.8), "salle", extras=3 if arrival else 4)
    L.zone("space", rect(2.0, 12.8, 3.9, 4.7), "laboratoire", extras=0)
    L.zone("space", rect(7.75, 12.8, 1.25, 4.8), "couloir", extras=1)
    L.zone("space", rect(0, 24.9, 11, 6.6), "place", extras=6)
    if not arrival:
        L.view("remise", "remise", 6.1, 6.0, 270, [])
        L.view("cour", "cour", 8.4, 11.8, 0, [])
        L.view("terrasse", "terrasse", 3.6, 27.2, 0, [])
        L.zone("space", rect(2.0, 2.5, 4.6, 4.0), "remise", extras=1)
        L.zone("space", rect(2.0, 6.8, 7.0, 5.5), "cour", extras=1)

    # Parcours.
    L.route("clients", [(3.6, 28.0), (3.6, 24.6), (2.55, 23.5), (2.55, 20.7)])
    L.route("clients", [(2.95, 20.45), (6.1, 20.45)])
    L.route("clients", [(6.4, 20.8), (7.4, 23.0), (7.0, 23.3)])
    L.route("clients", [(7.9, 20.6), (8.4, 19.0), (8.4, 16.4), (8.0, 16.4)])
    if not arrival:
        L.route("clients", [(8.4, 15.5), (8.4, 11.6), (5.6, 8.0), (4.1, 7.1)])
    L.route("staff", [(4.1, 18.75), (7.2, 18.75), (7.2, 20.3), (7.6, 22.9)])
    L.route("staff", [(2.45, 18.6), (2.45, 16.9), (3.4, 16.4)])
    L.route("delivery", [(7.85, 2.7), (7.6, 8.6), (7.6, 11.6), (3.0, 11.6), (3.0, 14.3), (6.4, 14.3)])

    # Textes et cotes.
    L.text(4.6, 14.4, "laboratoire", "room")
    L.text(6.8, 14.9, "réserve", "room")
    L.text(8.4, 14.6, "couloir", "room", rotate=-90)
    L.text(3.7, 23.2, "salle", "room")
    L.text(4.3, 5.9 if not arrival else 5.0, "remise", "room")
    L.text(7.85, 4.2, "porche", "room", rotate=-90)
    L.text(5.5, 12.0 if not arrival else 10.0, "cour", "room")
    L.text(6.9, 27.9, "terrasse", "room")
    L.dim((2.0, 24.9), (9.0, 24.9), "7,00 m", offset=3.0)
    L.dim((9.0, 12.8), (9.0, 24.4), "11,60 m (laboratoire et boutique)", offset=1.05)
    return p


ADDRESSES = [village, bourg]


# =====================================================================================
# Dessin SVG (depuis le JSON)
# =====================================================================================

COLORS = {
    "courtyard": "#e6e0d3", "pavement": "#ebe6dc", "sidewalk": "#efebe3", "road": "#d6d1c7",
    "grass": "#dce9cc", "neighbour": "#d9d4cb", "gravel": "#ece6d8", "water": "#cfe2f0",
    "floor": "#fbf8f1", "wood": "#f7eedd", "tiles": "#f1efea", "kitchen": "#eef1f1", "closed": "#ebe7e0",
    "wall": "#3b3b3b", "partition": "#777777",
    "counter": "#a8743c", "backbar": "#c9a271", "table": "#ffffff", "chair": "#d6cfc3",
    "stool": "#d6cfc3", "bench": "#cbb99c", "armchair": "#c4a984", "banquette": "#c4a984", "sofa": "#c4a984",
    "work": "#f6d7ad", "private": "#e4dccd", "free": "#7cab61", "keep_clear": "#9a7cc4",
    "extension": "#2e7d32", "clients": "#2563a8", "staff": "#d4761c", "delivery": "#2f8a3a",
    "queue": "#7b57b3",
}

STATION_FILL = {
    "machine": "#4b4b4b", "grinder": "#6d6d6d", "register": "#2f5f8f", "pass": "#e9d6ae",
    "sink": "#a9cbe6", "dishwasher": "#94b8d8", "fridge": "#cfe0ec", "display": "#f1e3bf",
    "oven": "#a14d2a", "roaster": "#6b3e26", "hob": "#8a5a44", "worktop": "#d9c7a7",
    "tea": "#9d8f6a", "juicer": "#e2a34c", "slowbar": "#7a5a3a", "lift": "#9aa3ad",
}


class Svg:
    def __init__(self):
        self.parts = []

    def add(self, s):
        self.parts.append(s)


def esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;"))


def wrap(text, width):
    lines, cur = [], ""
    for word in text.split():
        if cur and len(cur) + 1 + len(word) > width:
            lines.append(cur)
            cur = word
        else:
            cur = f"{cur} {word}" if cur else word
    if cur:
        lines.append(cur)
    return lines


def draw_plan(plan):
    S = plan["scale_px"]
    levels = plan["levels"]
    ux0 = min(lv["frame"][0] + lv["draw_offset"][0] for lv in levels)
    uy0 = min(lv["frame"][1] + lv["draw_offset"][1] for lv in levels)
    ux1 = max(lv["frame"][2] + lv["draw_offset"][0] for lv in levels)
    uy1 = max(lv["frame"][3] + lv["draw_offset"][1] for lv in levels)
    margin = 34
    legend_w = 330
    plan_w = (ux1 - ux0) * S
    plan_h = (uy1 - uy0) * S
    width = int(max(plan_w + 2 * margin + legend_w, 1180))
    cap = plan["capacity"]
    summary = (f"{cap['inside']} places assises à l'intérieur, {cap['outside']} dehors. " + plan["summary"])
    summary_lines = wrap(summary, int((width - 2 * margin) / (0.58 * 14)))
    title_h = 60 + 20 * len(summary_lines) + 18
    height = int(max(plan_h + title_h + 2 * margin + 14, title_h + 2 * margin + len(LEGEND) * 21 + 260))

    out = Svg()
    a = out.add
    a(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
      f'viewBox="0 0 {width} {height}" font-family="DejaVu Sans, sans-serif">')
    a('<defs>'
      '<pattern id="hatch-free" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      f'<rect width="8" height="8" fill="{COLORS["free"]}" fill-opacity="0.10"/>'
      f'<line x1="0" y1="0" x2="0" y2="8" stroke="{COLORS["free"]}" stroke-width="1.4" stroke-opacity="0.55"/></pattern>'
      '<pattern id="hatch-clear" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">'
      f'<line x1="0" y1="0" x2="0" y2="7" stroke="{COLORS["keep_clear"]}" stroke-width="1.2" stroke-opacity="0.45"/></pattern>'
      '<pattern id="hatch-closed" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      '<line x1="0" y1="0" x2="0" y2="6" stroke="#9b958a" stroke-width="1" stroke-opacity="0.6"/></pattern>'
      '<pattern id="hatch-backdrop" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">'
      '<rect width="10" height="10" fill="#ffffff" fill-opacity="0.35"/>'
      '<line x1="0" y1="0" x2="0" y2="10" stroke="#8c867a" stroke-width="0.8" stroke-opacity="0.45"/></pattern>'
      '<pattern id="hatch-fire" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      '<rect width="5" height="5" fill="#b9a493"/><line x1="0" y1="0" x2="0" y2="5" stroke="#7a5f4c" stroke-width="1.2"/></pattern>'
      )
    for name in ("clients", "staff", "delivery"):
        a(f'<marker id="arrow-{name}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" '
          f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{COLORS[name]}"/></marker>')
    a('</defs>')
    a(f'<rect width="{width}" height="{height}" fill="#ffffff"/>')

    def X(x, lv):
        return margin + (x + lv["draw_offset"][0] - ux0) * S

    def Y(y, lv):
        return title_h + margin + (y + lv["draw_offset"][1] - uy0) * S

    def shape_svg(shape, lv, attrs):
        if "rect" in shape:
            x, y, w, h = shape["rect"]
            return (f'<rect x="{X(x, lv):.1f}" y="{Y(y, lv):.1f}" width="{w * S:.1f}" height="{h * S:.1f}" {attrs}/>')
        if "circle" in shape:
            cx, cy, r = shape["circle"]
            return f'<circle cx="{X(cx, lv):.1f}" cy="{Y(cy, lv):.1f}" r="{r * S:.1f}" {attrs}/>'
        pts = " ".join(f"{X(px, lv):.1f},{Y(py, lv):.1f}" for px, py in shape["poly"])
        return f'<polygon points="{pts}" {attrs}/>'

    def label(x, y, s, lv, size=9, color="#222", weight="normal", anchor="middle", rotate=0, italic=False):
        px, py = X(x, lv), Y(y, lv)
        tr = f' transform="rotate({rotate} {px:.1f} {py:.1f})"' if rotate else ""
        st = ' font-style="italic"' if italic else ""
        a(f'<text x="{px:.1f}" y="{py:.1f}" font-size="{size}" fill="{color}" font-weight="{weight}" '
          f'text-anchor="{anchor}" dominant-baseline="middle"{tr}{st}>{esc(s)}</text>')

    # Titre.
    a(f'<text x="{margin}" y="34" font-size="23" font-weight="bold" fill="#1d1d1d">'
      f'{plan["number"]}. {esc(plan["title"])}: {esc(plan["state_label"].lower())}</text>')
    for i, ln in enumerate(summary_lines):
        a(f'<text x="{margin}" y="{60 + 20 * i}" font-size="14" fill="#333">{esc(ln)}</text>')
    a(f'<text x="{margin}" y="{60 + 20 * len(summary_lines) + 2}" font-size="11" fill="#666">Grille d\'un mètre, '
      f'nord selon la flèche. Dessiné par construire_plans.py, contrôlé par valider_plans.py (même source: '
      f'plans.json).</text>')

    for lv in levels:
        fx0, fy0, fx1, fy1 = lv["frame"]
        if len(levels) > 1:
            label(fx0, fy0 - 0.45, lv["name"], lv, size=14, weight="bold", anchor="start")
        a(f'<rect x="{X(fx0, lv):.1f}" y="{Y(fy0, lv):.1f}" width="{(fx1 - fx0) * S:.1f}" '
          f'height="{(fy1 - fy0) * S:.1f}" fill="#f6f3ec"/>')
        els = lv["elements"]
        for e in els:
            if e["kind"] == "ground":
                a(shape_svg(e["shape"], lv, f'fill="{COLORS.get(e["style"], "#eee")}"'))
        for e in els:
            if e["kind"] == "floor":
                fill = COLORS.get(e["style"], "#fbf8f1")
                a(shape_svg(e["shape"], lv, f'fill="{fill}"'))
                if e["style"] == "closed":
                    a(shape_svg(e["shape"], lv, 'fill="url(#hatch-closed)"'))
        # Arbres: houppiers sous tout le reste.
        for e in els:
            if e["kind"] == "tree":
                cx, cy, _ = e["shape"]["circle"]
                a(f'<circle cx="{X(cx, lv):.1f}" cy="{Y(cy, lv):.1f}" r="{e["crown"] * S:.1f}" fill="#b8d49c" '
                  f'fill-opacity="0.55" stroke="#8fb36f" stroke-width="1"/>')
        # Zones.
        for z in lv["zones"]:
            k = z["kind"]
            if k == "work":
                a(shape_svg(z["shape"], lv, f'fill="{COLORS["work"]}" fill-opacity="0.75"'))
            elif k == "private":
                a(shape_svg(z["shape"], lv, f'fill="{COLORS["private"]}" fill-opacity="0.8"'))
            elif k == "free":
                a(shape_svg(z["shape"], lv, 'fill="url(#hatch-free)"'))
            elif k == "keep_clear":
                a(shape_svg(z["shape"], lv, 'fill="url(#hatch-clear)"'))
            elif k == "backdrop":
                a(shape_svg(z["shape"], lv, 'fill="url(#hatch-backdrop)"'))
        # Grille d'un mètre.
        g = []
        for xi in range(int(math.ceil(fx0)), int(math.floor(fx1)) + 1):
            col = "#c9c4ba" if xi % 5 else "#a59f94"
            g.append(f'<line x1="{X(xi, lv):.1f}" y1="{Y(fy0, lv):.1f}" x2="{X(xi, lv):.1f}" y2="{Y(fy1, lv):.1f}" '
                     f'stroke="{col}" stroke-width="{0.5 if xi % 5 else 0.9}" stroke-opacity="0.8"/>')
        for yi in range(int(math.ceil(fy0)), int(math.floor(fy1)) + 1):
            col = "#c9c4ba" if yi % 5 else "#a59f94"
            g.append(f'<line x1="{X(fx0, lv):.1f}" y1="{Y(yi, lv):.1f}" x2="{X(fx1, lv):.1f}" y2="{Y(yi, lv):.1f}" '
                     f'stroke="{col}" stroke-width="{0.5 if yi % 5 else 0.9}" stroke-opacity="0.8"/>')
        a("".join(g))
        for xi in range(int(math.ceil(fx0)), int(math.floor(fx1)) + 1):
            if xi % 2 == 0:
                label(xi, fy0 - 0.18, str(xi), lv, size=7, color="#8a8478")
        for yi in range(int(math.ceil(fy0)), int(math.floor(fy1)) + 1):
            if yi % 2 == 0:
                label(fx0 - 0.25, yi, str(yi), lv, size=7, color="#8a8478")
        # Mobilier et postes.
        for e in els:
            k = e["kind"]
            st = e.get("style")
            if k == "table":
                a(shape_svg(e["shape"], lv, 'fill="#ffffff" stroke="#4d4d4d" stroke-width="1.2"'))
            elif k == "seat":
                fill = COLORS.get(st, "#d6cfc3")
                rx = ' rx="3"' if st in ("armchair", "sofa") else ""
                a(shape_svg(e["shape"], lv, f'fill="{fill}" stroke="#4d4d4d" stroke-width="0.9"{rx}'))
                back = e.get("back")
                if back and "rect" in e["shape"]:
                    x, y, w, h = e["shape"]["rect"]
                    t = 0.07 if st == "chair" else 0.14
                    br = {"N": (x, y, w, t), "S": (x, y + h - t, w, t),
                          "W": (x, y, t, h), "E": (x + w - t, y, t, h)}[back]
                    a(shape_svg(rect(*br), lv, 'fill="#5a5148"'))
            elif k == "furniture":
                if st == "plant":
                    a(shape_svg(e["shape"], lv, 'fill="#8fbf73" stroke="#5e8b47" stroke-width="1"'))
                elif st == "rug":
                    a(shape_svg(e["shape"], lv, 'fill="#e9c9a8" fill-opacity="0.5" stroke="#b98b62" stroke-dasharray="3,2"'))
                elif st == "low_table":
                    a(shape_svg(e["shape"], lv, 'fill="#efe4d2" stroke="#4d4d4d" stroke-width="1"'))
                elif st in ("shelf", "shelf_high"):
                    a(shape_svg(e["shape"], lv, 'fill="#d3bf9c" stroke="#7a6545" stroke-width="1"'))
                elif st == "slate":
                    a(shape_svg(e["shape"], lv, 'fill="#3f4a45" stroke="#222" stroke-width="1"'))
                else:
                    a(shape_svg(e["shape"], lv, 'fill="#ddd2bf" stroke="#6d6d6d" stroke-width="1"'))
            elif k == "fixture":
                if st == "wc":
                    x, y, w, h = e["shape"]["rect"]
                    a(shape_svg(e["shape"], lv, 'fill="#ffffff" stroke="#555" stroke-width="1" rx="4"'))
                elif st == "basin":
                    a(shape_svg(e["shape"], lv, 'fill="#ffffff" stroke="#555" stroke-width="1" rx="3"'))
                elif st == "fireplace":
                    a(shape_svg(e["shape"], lv, 'fill="url(#hatch-fire)" stroke="#5c4636" stroke-width="1.2"'))
                elif st == "stairs":
                    a(shape_svg(e["shape"], lv, 'fill="#ece7df" stroke="#555" stroke-width="1"'))
                    x, y, w, h = e["shape"]["rect"]
                    n = e.get("steps", 10)
                    up = e.get("up", "N")
                    lines = []
                    for i in range(1, n):
                        if up in "NS":
                            yy = y + h * i / n
                            lines.append(f'<line x1="{X(x, lv):.1f}" y1="{Y(yy, lv):.1f}" x2="{X(x + w, lv):.1f}" '
                                         f'y2="{Y(yy, lv):.1f}" stroke="#777" stroke-width="0.7"/>')
                        else:
                            xx = x + w * i / n
                            lines.append(f'<line x1="{X(xx, lv):.1f}" y1="{Y(y, lv):.1f}" x2="{X(xx, lv):.1f}" '
                                         f'y2="{Y(y + h, lv):.1f}" stroke="#777" stroke-width="0.7"/>')
                    a("".join(lines))
                    cx, cy = x + w / 2, y + h / 2
                    d = {"N": (0, -1), "S": (0, 1), "E": (1, 0), "W": (-1, 0)}[up]
                    ln = (h if up in "NS" else w) * 0.38
                    a(f'<line x1="{X(cx - d[0] * ln, lv):.1f}" y1="{Y(cy - d[1] * ln, lv):.1f}" '
                      f'x2="{X(cx + d[0] * ln, lv):.1f}" y2="{Y(cy + d[1] * ln, lv):.1f}" stroke="#333" '
                      f'stroke-width="1.3" marker-end="url(#arrow-clients)"/>')
                elif st == "fountain":
                    a(shape_svg(e["shape"], lv, 'fill="#cfe2f0" stroke="#6f8fa8" stroke-width="2"'))
                elif st == "bins":
                    a(shape_svg(e["shape"], lv, 'fill="#9aa48f" stroke="#555" stroke-width="1"'))
                else:
                    a(shape_svg(e["shape"], lv, 'fill="#ddd6c9" stroke="#666" stroke-width="1"'))
            elif k == "counter":
                a(shape_svg(e["shape"], lv, f'fill="{COLORS["counter"]}" stroke="#5b3f1d" stroke-width="1.3"'))
            elif k == "backbar":
                a(shape_svg(e["shape"], lv, f'fill="{COLORS["backbar"]}" stroke="#6b4e2c" stroke-width="1"'))
        for e in els:
            if e["kind"] == "station":
                fill = STATION_FILL.get(e.get("style"), "#bbbbbb")
                a(shape_svg(e["shape"], lv, f'fill="{fill}" stroke="#2f2f2f" stroke-width="1"'))
        for e in els:
            if e["kind"] == "tree":
                a(shape_svg(e["shape"], lv, 'fill="#7a5a3c"'))
        # Store, hottes et autres éléments au-dessus des têtes: contour en tirets.
        for e in els:
            if e["kind"] == "hood":
                a(shape_svg(e["shape"], lv, 'fill="none" stroke="#9c4a2a" stroke-width="1.4" stroke-dasharray="6,4"'))
        # Murs, cloisons, poteaux.
        for e in els:
            if e["kind"] in ("wall", "column"):
                a(shape_svg(e["shape"], lv, f'fill="{COLORS["wall"]}"'))
            elif e["kind"] == "partition":
                fill = "#9fc0de" if e.get("glazed") else COLORS["partition"]
                a(shape_svg(e["shape"], lv, f'fill="{fill}"'))
        # Ouvertures.
        for e in els:
            if e["kind"] == "window":
                x, y, w, h = e["shape"]["rect"]
                a(shape_svg(e["shape"], lv, 'fill="#ffffff" stroke="#3b3b3b" stroke-width="0.8"'))
                if e["orient"] == "h":
                    for f in (0.3, 0.7):
                        a(f'<line x1="{X(x, lv):.1f}" y1="{Y(y + h * f, lv):.1f}" x2="{X(x + w, lv):.1f}" '
                          f'y2="{Y(y + h * f, lv):.1f}" stroke="#3f7fc0" stroke-width="1.6"/>')
                else:
                    for f in (0.3, 0.7):
                        a(f'<line x1="{X(x + w * f, lv):.1f}" y1="{Y(y, lv):.1f}" x2="{X(x + w * f, lv):.1f}" '
                          f'y2="{Y(y + h, lv):.1f}" stroke="#3f7fc0" stroke-width="1.6"/>')
            elif e["kind"] == "door":
                draw_door(a, e, lv, X, Y, S)
            elif e["kind"] == "opening":
                x, y, w, h = e["shape"]["rect"]
                a(shape_svg(e["shape"], lv, 'fill="#fbf8f1"'))
                if e["orient"] == "h":
                    for xx in (x, x + w):
                        a(f'<line x1="{X(xx, lv):.1f}" y1="{Y(y, lv):.1f}" x2="{X(xx, lv):.1f}" y2="{Y(y + h, lv):.1f}" '
                          f'stroke="#3b3b3b" stroke-width="1.2"/>')
                else:
                    for yy in (y, y + h):
                        a(f'<line x1="{X(x, lv):.1f}" y1="{Y(yy, lv):.1f}" x2="{X(x + w, lv):.1f}" y2="{Y(yy, lv):.1f}" '
                          f'stroke="#3b3b3b" stroke-width="1.2"/>')
        # Marqueurs techniques.
        for e in els:
            if e["kind"] == "marker":
                cx, cy, _ = e["shape"]["circle"]
                px, py = X(cx, lv), Y(cy, lv)
                st = e["style"]
                if st == "water":
                    a(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4.2" fill="#2f7fd1" stroke="#ffffff" stroke-width="1"/>')
                elif st == "drain":
                    a(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="4.2" fill="#ffffff" stroke="#2f7fd1" stroke-width="2"/>')
                elif st == "power":
                    a(f'<rect x="{px - 4.5:.1f}" y="{py - 4.5:.1f}" width="9" height="9" fill="#e8a317" '
                      f'stroke="#7a5200" stroke-width="1"/>')
                elif st == "panel":
                    a(f'<rect x="{px - 5:.1f}" y="{py - 4:.1f}" width="10" height="8" fill="#ffffff" '
                      f'stroke="#7a5200" stroke-width="1.4"/>')
                elif st == "duct":
                    a(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="#9c4a2a" stroke="#ffffff" stroke-width="1"/>')
        # Zones d'extension (contour) et libellés de zones.
        for z in lv["zones"]:
            if z["kind"] == "extension":
                a(shape_svg(z["shape"], lv, f'fill="none" stroke="{COLORS["extension"]}" stroke-width="2.2" '
                                             'stroke-dasharray="9,5"'))
                x0, y0, x1, y1 = shape_bbox(z["shape"])
                label(x0 + 0.15, y1 - 0.3, z["label"], lv, size=10, color=COLORS["extension"], weight="bold",
                      anchor="start")
        # File d'attente.
        for q in lv["queues"]:
            pts = " ".join(f"{X(x, lv):.1f},{Y(y, lv):.1f}" for x, y in q["points"])
            a(f'<polyline points="{pts}" fill="none" stroke="{COLORS["queue"]}" stroke-opacity="0.22" '
              f'stroke-width="{q["width"] * S:.1f}" stroke-linecap="butt" stroke-linejoin="round"/>')
            for i, (sx, sy) in enumerate(queue_slots(q)):
                a(f'<circle cx="{X(sx, lv):.1f}" cy="{Y(sy, lv):.1f}" r="7" fill="#ffffff" stroke="{COLORS["queue"]}" '
                  f'stroke-width="1.5"/>')
                label(sx, sy, str(i + 1), lv, size=8, color=COLORS["queue"], weight="bold")
        # Parcours.
        for r in lv["routes"]:
            col = COLORS[r["kind"]]
            dash = {"clients": "", "staff": ' stroke-dasharray="6,3"', "delivery": ' stroke-dasharray="10,3,2,3"'}[r["kind"]]
            pts = " ".join(f"{X(x, lv):.1f},{Y(y, lv):.1f}" for x, y in r["points"])
            a(f'<polyline points="{pts}" fill="none" stroke="{col}" stroke-width="2.2"{dash} '
              f'marker-end="url(#arrow-{r["kind"]})" stroke-linejoin="round"/>')
        # Points de vue.
        for v in lv["views"]:
            vx, vy = v["pos"]
            px, py = X(vx, lv), Y(vy, lv)
            if "queue" in v["checks"]:
                half = NORMS["fov_deg"] / 2
                rr = 3.2 * S
                a0 = math.radians(v["facing_deg"] - half)
                a1 = math.radians(v["facing_deg"] + half)
                p0 = (px + rr * math.sin(a0), py - rr * math.cos(a0))
                p1 = (px + rr * math.sin(a1), py - rr * math.cos(a1))
                a(f'<path d="M{px:.1f},{py:.1f} L{p0[0]:.1f},{p0[1]:.1f} A{rr:.1f},{rr:.1f} 0 0 1 {p1[0]:.1f},{p1[1]:.1f} z" '
                  f'fill="#f2c94c" fill-opacity="0.16" stroke="#c99a06" stroke-opacity="0.6" stroke-width="1"/>')
            a(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="5" fill="#f2c94c" stroke="#7a5d00" stroke-width="1.2"/>')
            a(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="1.8" fill="#3b2c00"/>')
        # Libellés des éléments.
        for e in els:
            lab = e.get("label")
            if not lab:
                continue
            k = e["kind"]
            if k in ("station", "fixture", "furniture", "hood", "tree"):
                cx, cy = shape_center(e["shape"])
                x0, y0, x1, y1 = shape_bbox(e["shape"])
                vertical = (y1 - y0) > 1.6 * (x1 - x0) and (y1 - y0) > 1.0
                color = "#ffffff" if (k == "station" and e.get("style") in ("machine", "grinder", "register", "oven", "roaster", "hob", "slowbar")) else "#222"
                if k == "counter":
                    color = "#ffffff"
                if k == "hood":
                    color = "#9c4a2a"
                    cy = y0 + 0.25
                if k == "tree":
                    cy = cy + e["crown"] * 0.55
                    color = "#4f6f35"
                if k == "fixture" and e.get("style") == "stairs":
                    cx = x0 + (x1 - x0) / 2
                size = 8 if k in ("station", "fixture", "furniture") else 9
                if e.get("label_at"):
                    cx, cy = e["label_at"]
                    color = "#222"
                    vertical = False
                label(cx, cy, lab, lv, size=size, color=color, rotate=-90 if vertical else 0)
            elif k == "marker" and e.get("label"):
                cx, cy, _ = e["shape"]["circle"]
                label(cx, cy - 0.28, lab, lv, size=7, color="#7a5200")
        for t in lv["texts"]:
            x, y = t["pos"]
            st = t["style"]
            if st == "room":
                label(x, y, t["text"], lv, size=13, color="#3a3a3a", weight="bold", anchor=t["anchor"], rotate=t["rotate"])
            elif st == "street":
                label(x, y, t["text"], lv, size=11, color="#6b655b", anchor=t["anchor"], rotate=t["rotate"], italic=True)
            elif st == "note":
                label(x, y, t["text"], lv, size=9, color="#4a4a4a", anchor=t["anchor"], rotate=t["rotate"])
            else:
                label(x, y, t["text"], lv, size=9, color="#222", anchor=t["anchor"], rotate=t["rotate"])
        for v in lv["views"]:
            vx, vy = v["pos"]
        for q in lv["queues"]:
            x, y = q["pickup"]
            a(f'<circle cx="{X(x, lv):.1f}" cy="{Y(y, lv):.1f}" r="3.5" fill="{COLORS["clients"]}"/>')
        # Cotes.
        for d in lv["dims"]:
            draw_dim(a, d, lv, X, Y, label)

    draw_legend(a, plan, int(plan_w + 2 * margin) + 6, title_h + margin, legend_w - 20, S)
    a('</svg>')
    return "\n".join(out.parts)


def queue_slots(q):
    """Places de la file, de la caisse vers l'arrière, tous les 0,60 m."""
    pts = list(reversed(q["points"]))
    slots = []
    pitch = NORMS["queue_pitch"]
    seg = 0
    dist_in = 0.0
    need = 0.0
    while len(slots) < q["places"] and seg < len(pts) - 1:
        (x0, y0), (x1, y1) = pts[seg], pts[seg + 1]
        L = math.hypot(x1 - x0, y1 - y0)
        if need <= dist_in + L + 1e-9:
            t = (need - dist_in) / L if L else 0
            slots.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
            need += pitch
        else:
            dist_in += L
            seg += 1
    return slots


def draw_door(a, e, lv, X, Y, S):
    x, y, w, h = e["shape"]["rect"]
    access = e.get("access", "public")
    color = {"public": "#2b2b2b", "staff": COLORS["staff"], "closed": "#8a8a8a"}[access]
    a(f'<rect x="{X(x, lv):.1f}" y="{Y(y, lv):.1f}" width="{w * S:.1f}" height="{h * S:.1f}" fill="#fbf8f1"/>')
    sw = e.get("swing", {"leaves": 1, "hinge": "start", "side": "+"})
    leaves = sw.get("leaves", 1)
    horiz = e["orient"] == "h"
    length = w if horiz else h
    dash = ' stroke-dasharray="4,3"' if access == "closed" else ""
    if access == "closed":
        # Porte fermée: battant dessiné fermé.
        if horiz:
            a(f'<line x1="{X(x, lv):.1f}" y1="{Y(y + h / 2, lv):.1f}" x2="{X(x + w, lv):.1f}" y2="{Y(y + h / 2, lv):.1f}" '
              f'stroke="{color}" stroke-width="3"/>')
        else:
            a(f'<line x1="{X(x + w / 2, lv):.1f}" y1="{Y(y, lv):.1f}" x2="{X(x + w / 2, lv):.1f}" y2="{Y(y + h, lv):.1f}" '
              f'stroke="{color}" stroke-width="3"/>')
        return
    if leaves == 0:
        if horiz:
            a(f'<line x1="{X(x, lv):.1f}" y1="{Y(y + h / 2, lv):.1f}" x2="{X(x + w * 0.55, lv):.1f}" '
              f'y2="{Y(y + h / 2, lv):.1f}" stroke="{color}" stroke-width="2.4"/>')
        else:
            a(f'<line x1="{X(x + w / 2, lv):.1f}" y1="{Y(y, lv):.1f}" x2="{X(x + w / 2, lv):.1f}" '
              f'y2="{Y(y + h * 0.55, lv):.1f}" stroke="{color}" stroke-width="2.4"/>')
        return
    hinges = []
    if leaves == 2:
        hinges = [("start", length / 2), ("end", length / 2)]
    else:
        hinges = [(sw.get("hinge", "start"), length)]
    side = 1 if sw.get("side", "+") == "+" else -1
    for hinge, lw in hinges:
        if horiz:
            face = y + h if side > 0 else y
            hx = x if hinge == "start" else x + w
            hy = face
            cx_, cy_ = (hx + lw, hy) if hinge == "start" else (hx - lw, hy)
            ox, oy = hx, hy + side * lw
        else:
            face = x + w if side > 0 else x
            hx, hy = face, (y if hinge == "start" else y + h)
            cx_, cy_ = (hx, hy + lw) if hinge == "start" else (hx, hy - lw)
            ox, oy = hx + side * lw, hy
        ac = math.atan2(cy_ - hy, cx_ - hx)
        ao = math.atan2(oy - hy, ox - hx)
        d = (ao - ac + math.pi) % (2 * math.pi) - math.pi
        sweep = 1 if d > 0 else 0
        a(f'<line x1="{X(hx, lv):.1f}" y1="{Y(hy, lv):.1f}" x2="{X(ox, lv):.1f}" y2="{Y(oy, lv):.1f}" '
          f'stroke="{color}" stroke-width="2"{dash}/>')
        a(f'<path d="M{X(cx_, lv):.1f},{Y(cy_, lv):.1f} A{lw * S:.1f},{lw * S:.1f} 0 0 {sweep} '
          f'{X(ox, lv):.1f},{Y(oy, lv):.1f}" fill="none" stroke="{color}" stroke-width="0.9" '
          f'stroke-dasharray="3,2"/>')


def draw_dim(a, d, lv, X, Y, label):
    (x0, y0), (x1, y1) = d["from"], d["to"]
    off = d["offset"]
    if abs(y1 - y0) < 1e-6:
        yy = y0 + off
        a(f'<line x1="{X(x0, lv):.1f}" y1="{Y(yy, lv):.1f}" x2="{X(x1, lv):.1f}" y2="{Y(yy, lv):.1f}" '
          f'stroke="#555" stroke-width="0.9"/>')
        for xx in (x0, x1):
            a(f'<line x1="{X(xx, lv):.1f}" y1="{Y(yy - 0.15, lv):.1f}" x2="{X(xx, lv):.1f}" y2="{Y(yy + 0.15, lv):.1f}" '
              f'stroke="#555" stroke-width="1.2"/>')
        label((x0 + x1) / 2, yy - 0.2, d["text"], lv, size=9, color="#333")
    else:
        xx = x0 + off
        a(f'<line x1="{X(xx, lv):.1f}" y1="{Y(y0, lv):.1f}" x2="{X(xx, lv):.1f}" y2="{Y(y1, lv):.1f}" '
          f'stroke="#555" stroke-width="0.9"/>')
        for yy in (y0, y1):
            a(f'<line x1="{X(xx - 0.15, lv):.1f}" y1="{Y(yy, lv):.1f}" x2="{X(xx + 0.15, lv):.1f}" y2="{Y(yy, lv):.1f}" '
              f'stroke="#555" stroke-width="1.2"/>')
        label(xx + 0.22, (y0 + y1) / 2, d["text"], lv, size=9, color="#333", rotate=-90)


LEGEND = [
    ("wall", "Mur porteur"),
    ("partition", "Cloison (joue basse du comptoir comprise)"),
    ("window", "Vitrine ou fenêtre"),
    ("door_public", "Porte des clients (battant et débattement)"),
    ("door_staff", "Porte ou portillon du personnel"),
    ("door_closed", "Porte fermée à clé"),
    ("counter", "Comptoir (1,10 m côté clients)"),
    ("backbar", "Arrière-comptoir (0,90 m)"),
    ("station", "Poste fixe (libellé dessus)"),
    ("table", "Table"),
    ("seat", "Place assise (dossier en trait épais)"),
    ("work", "Zone de travail (joueurs, employés)"),
    ("private", "Réserve, cuisine, locaux du personnel"),
    ("free", "Zone libre: meubles du duo"),
    ("keep_clear", "Passage à garder libre"),
    ("extension", "Extension possible (pointillés)"),
    ("backdrop", "Décor de fond, hors du jeu (C18)"),
    ("queue", "File d'attente, places numérotées"),
    ("clients", "Parcours des clients"),
    ("staff", "Parcours des joueurs"),
    ("delivery", "Livraisons"),
    ("water", "Arrivée d'eau"),
    ("drain", "Évacuation"),
    ("power", "Prise de force (32 A ou 400 V)"),
    ("panel", "Tableau électrique"),
    ("hood", "Hotte, store ou verrière (au-dessus)"),
    ("view", "Point de vue contrôlé (champ de 100 degrés)"),
]


def draw_legend(a, plan, x, y, w, S):
    a(f'<rect x="{x - 8}" y="{y - 8}" width="{w + 10}" height="{len(LEGEND) * 21 + 200}" fill="#ffffff" '
      f'stroke="#cfc9bd" stroke-width="1"/>')
    a(f'<text x="{x}" y="{y + 10}" font-size="13" font-weight="bold" fill="#222">Légende</text>')
    yy = y + 30
    for key, text in LEGEND:
        sx, sy = x, yy - 7
        if key == "wall":
            a(f'<rect x="{sx}" y="{sy + 3}" width="28" height="8" fill="{COLORS["wall"]}"/>')
        elif key == "partition":
            a(f'<rect x="{sx}" y="{sy + 5}" width="28" height="4" fill="{COLORS["partition"]}"/>')
        elif key == "window":
            a(f'<rect x="{sx}" y="{sy + 2}" width="28" height="10" fill="#fff" stroke="#3b3b3b" stroke-width="0.8"/>'
              f'<line x1="{sx}" y1="{sy + 5}" x2="{sx + 28}" y2="{sy + 5}" stroke="#3f7fc0" stroke-width="1.6"/>'
              f'<line x1="{sx}" y1="{sy + 9}" x2="{sx + 28}" y2="{sy + 9}" stroke="#3f7fc0" stroke-width="1.6"/>')
        elif key.startswith("door"):
            col = {"door_public": "#2b2b2b", "door_staff": COLORS["staff"], "door_closed": "#8a8a8a"}[key]
            if key == "door_closed":
                a(f'<line x1="{sx}" y1="{sy + 12}" x2="{sx + 22}" y2="{sy + 12}" stroke="{col}" stroke-width="3"/>')
            else:
                a(f'<line x1="{sx}" y1="{sy + 14}" x2="{sx}" y2="{sy - 6}" stroke="{col}" stroke-width="2"/>'
                  f'<path d="M{sx + 20},{sy + 14} A20,20 0 0 0 {sx},{sy - 6}" fill="none" stroke="{col}" '
                  f'stroke-width="0.9" stroke-dasharray="3,2"/>')
        elif key == "counter":
            a(f'<rect x="{sx}" y="{sy + 1}" width="28" height="12" fill="{COLORS["counter"]}" stroke="#5b3f1d"/>')
        elif key == "backbar":
            a(f'<rect x="{sx}" y="{sy + 1}" width="28" height="12" fill="{COLORS["backbar"]}" stroke="#6b4e2c"/>')
        elif key == "station":
            a(f'<rect x="{sx}" y="{sy + 1}" width="14" height="12" fill="#4b4b4b" stroke="#222"/>'
              f'<rect x="{sx + 15}" y="{sy + 1}" width="13" height="12" fill="#a9cbe6" stroke="#222"/>')
        elif key == "table":
            a(f'<rect x="{sx + 4}" y="{sy}" width="16" height="14" fill="#fff" stroke="#4d4d4d" stroke-width="1.2"/>')
        elif key == "seat":
            a(f'<rect x="{sx + 6}" y="{sy + 1}" width="12" height="12" fill="{COLORS["chair"]}" stroke="#4d4d4d"/>'
              f'<rect x="{sx + 6}" y="{sy + 1}" width="12" height="3" fill="#5a5148"/>')
        elif key == "work":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="{COLORS["work"]}"/>')
        elif key == "private":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="{COLORS["private"]}"/>')
        elif key == "free":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="url(#hatch-free)" stroke="#cfe3c4"/>')
        elif key == "keep_clear":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="url(#hatch-clear)" stroke="#ddd2ee"/>')
        elif key == "backdrop":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="#efebe3"/><rect x="{sx}" y="{sy}" width="28" '
              f'height="14" fill="url(#hatch-backdrop)" stroke="#cfc9bd"/>')
        elif key == "extension":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="none" stroke="{COLORS["extension"]}" '
              f'stroke-width="2" stroke-dasharray="6,3"/>')
        elif key == "queue":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="{COLORS["queue"]}" fill-opacity="0.22"/>'
              f'<circle cx="{sx + 8}" cy="{sy + 7}" r="6" fill="#fff" stroke="{COLORS["queue"]}" stroke-width="1.4"/>'
              f'<text x="{sx + 8}" y="{sy + 7}" font-size="8" text-anchor="middle" dominant-baseline="middle" '
              f'fill="{COLORS["queue"]}" font-weight="bold">1</text>')
        elif key in ("clients", "staff", "delivery"):
            dash = {"clients": "", "staff": ' stroke-dasharray="6,3"', "delivery": ' stroke-dasharray="10,3,2,3"'}[key]
            a(f'<line x1="{sx}" y1="{sy + 7}" x2="{sx + 26}" y2="{sy + 7}" stroke="{COLORS[key]}" stroke-width="2.2"'
              f'{dash} marker-end="url(#arrow-{key})"/>')
        elif key == "water":
            a(f'<circle cx="{sx + 10}" cy="{sy + 7}" r="4.2" fill="#2f7fd1" stroke="#fff"/>')
        elif key == "drain":
            a(f'<circle cx="{sx + 10}" cy="{sy + 7}" r="4.2" fill="#fff" stroke="#2f7fd1" stroke-width="2"/>')
        elif key == "power":
            a(f'<rect x="{sx + 5.5}" y="{sy + 2.5}" width="9" height="9" fill="#e8a317" stroke="#7a5200"/>')
        elif key == "panel":
            a(f'<rect x="{sx + 5}" y="{sy + 3}" width="10" height="8" fill="#fff" stroke="#7a5200" stroke-width="1.4"/>')
        elif key == "hood":
            a(f'<rect x="{sx}" y="{sy}" width="28" height="14" fill="none" stroke="#9c4a2a" stroke-width="1.4" '
              f'stroke-dasharray="6,4"/>')
        elif key == "view":
            a(f'<path d="M{sx + 4},{sy + 13} L{sx + 26},{sy - 2} A22,22 0 0 1 {sx + 26},{sy + 16} z" fill="#f2c94c" '
              f'fill-opacity="0.25" stroke="#c99a06"/><circle cx="{sx + 4}" cy="{sy + 7}" r="5" fill="#f2c94c" '
              f'stroke="#7a5d00"/>')
        a(f'<text x="{x + 38}" y="{yy}" font-size="11" fill="#222" dominant-baseline="middle">{esc(text)}</text>')
        yy += 21
    # Échelle.
    yy += 14
    a(f'<text x="{x}" y="{yy}" font-size="11" fill="#222">Échelle</text>')
    yy += 12
    for i in range(5):
        fill = "#3b3b3b" if i % 2 == 0 else "#ffffff"
        a(f'<rect x="{x + i * S}" y="{yy}" width="{S}" height="8" fill="{fill}" stroke="#3b3b3b" stroke-width="0.8"/>')
    for i in range(6):
        a(f'<text x="{x + i * S}" y="{yy + 20}" font-size="9" text-anchor="middle" fill="#333">{i}</text>')
    a(f'<text x="{x + 5 * S + 10}" y="{yy + 8}" font-size="10" fill="#333">m</text>')
    # Nord.
    cx, cy = x + w - 40, yy + 4
    ang = plan["north_deg"]
    a(f'<g transform="rotate({ang} {cx} {cy})"><circle cx="{cx}" cy="{cy}" r="22" fill="#fff" stroke="#3b3b3b" '
      f'stroke-width="1.2"/><path d="M{cx},{cy - 19} L{cx + 7},{cy + 8} L{cx},{cy + 3} L{cx - 7},{cy + 8} z" '
      f'fill="#3b3b3b"/><text x="{cx}" y="{cy - 26}" font-size="12" font-weight="bold" text-anchor="middle" '
      f'fill="#3b3b3b">N</text></g>')
    yy += 46
    lines = legend_notes(plan)
    for ln in lines:
        a(f'<text x="{x}" y="{yy}" font-size="10" fill="#444">{esc(ln)}</text>')
        yy += 14


def legend_notes(plan):
    st = plan["staff"]
    out = [f"Joueurs: {st['players']}; employés au plus: {st['employees']}."]
    for lk in plan["links"]:
        out.append(f"{lk['label']}: {fmt(lk['width'])} m de large.")
    return out


# =====================================================================================
# Sorties
# =====================================================================================

def main(argv):
    plans = []
    for fn in ADDRESSES:
        for state in ("arrivee", "maximum"):
            plans.append(fn(state).export())
    data = {"format": "cosy-cafe-plans", "version": 1, "unit": "m", "norms": NORMS, "plans": plans}
    with open(os.path.join(HERE, "plans.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(os.path.join(HERE, "plans.json"), encoding="utf-8") as f:
        data = json.load(f)
    rsvg = shutil.which("rsvg-convert") if "--sans-png" not in argv else None
    for plan in data["plans"]:
        svg = draw_plan(plan)
        path = os.path.join(HERE, plan["id"] + ".svg")
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(svg)
            f.write("\n")
        if rsvg:
            subprocess.run([rsvg, "-o", os.path.join(HERE, plan["id"] + ".png"), path], check=True)
    print(f"{len(data['plans'])} plans écrits dans {HERE}" + (" (SVG et PNG)" if rsvg else " (SVG)"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
