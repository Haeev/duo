#!/usr/bin/env python3
"""Validateur des plans des adresses de Cosy Café.

Lit plans.json (écrit par construire_plans.py, même source que les SVG) et vérifie, pour
chaque plan, les normes du document des adresses et les plafonds de l'architecte
(docs/jeux/cosy-cafe/technique.md, section 11, contraintes C1 à C18):

1. capacité: les places dessinées (intérieur, dehors) égalent les places annoncées;
   présents au plus (C2: places occupées, files pleines, employés, joueurs), employés (C5),
   places de file (C4), meubles posés (C6), niveaux (C17);
2. passages de 0,90 m: un gabarit de 0,90 m de large va de l'entrée à chaque caisse, à chaque
   passe, à chaque place, aux toilettes et à chaque sortie (centre du gabarit à 0,45 m au
   moins de tout obstacle); une place est atteinte quand le bord du passage est à 0,25 m au
   plus de l'assise, sans rien entre les deux;
3. allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file et non dedans
   (C13); livraisons de 1,20 m du point de livraison à la réserve; chaque zone libre atteinte
   par 1,20 m depuis l'entrée ou la livraison (meubles portés à deux);
4. sorties: une seconde sortie, à 5 m au moins de la première, dès 20 personnes à l'intérieur;
5. zone de travail: aucune file ne la traverse; aucun client, même mince (0,50 m), n'y entre
   ni dans les locaux du personnel; les joueurs atteignent chaque poste, la réserve, la
   livraison et chaque place;
6. files: chacune part de sa porte, finit à sa caisse, tient ses places, reste dans les passages;
7. passages à garder libres sans meuble; portes et escaliers à la bonne largeur;
8. lisibilité: depuis chaque caisse, d'un seul regard (100 degrés), on voit le client qui paie,
   toute la file et sa porte, sans rien d'opaque entre; un poste qui le demande voit la porte
   dans son axe de travail;
9. foule (C1, C3): depuis chaque point de vue déclaré et depuis une grille de points jouables
   (un tous les mètres), le nombre de personnages au pire dans le champ (places occupées,
   files pleines, figurants des espaces vus, l'autre joueur) reste sous 40; les meubles
   dessinés visibles d'un même point sont comptés (C6: 150 avec la décoration).

Usage: python3 -I valider_plans.py [plans.json] [--plan <id>] [--sans-grille]
Code de sortie 0 si aucune erreur. Bibliothèque standard seulement.
"""

import bisect
import heapq
import json
import math
import os
import sys
from collections import deque

RES = 0.05  # côté d'une case du raster de contrôle (m); les cotes des plans tombent sur ce pas
EPS = 1e-6
INF = float("inf")
SQ2 = math.sqrt(2)
NEIGH = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
         (1, 1, SQ2), (1, -1, SQ2), (-1, 1, SQ2), (-1, -1, SQ2)]


# Géométrie ---------------------------------------------------------------------------

def bbox(shape):
    if "rect" in shape:
        x, y, w, h = shape["rect"]
        return x, y, x + w, y + h
    if "circle" in shape:
        cx, cy, r = shape["circle"]
        return cx - r, cy - r, cx + r, cy + r
    xs = [p[0] for p in shape["poly"]]
    ys = [p[1] for p in shape["poly"]]
    return min(xs), min(ys), max(xs), max(ys)


def center(shape):
    if "circle" in shape:
        return shape["circle"][0], shape["circle"][1]
    x0, y0, x1, y1 = bbox(shape)
    return (x0 + x1) / 2, (y0 + y1) / 2


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
    qx, qy = ax + t * dx, ay + t * dy
    return math.hypot(px - qx, py - qy), qx, qy


def point_in_poly(px, py, pts):
    inside_ = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > py) != (y2 > py):
            xi = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
            if px < xi:
                inside_ = not inside_
    return inside_


def dist_to_shape(shape, px, py):
    """Distance d'un point au bord d'une forme (0 dedans) et point le plus proche."""
    if "rect" in shape:
        x, y, w, h = shape["rect"]
        qx = min(max(px, x), x + w)
        qy = min(max(py, y), y + h)
        return math.hypot(px - qx, py - qy), qx, qy
    if "circle" in shape:
        cx, cy, r = shape["circle"]
        d = math.hypot(px - cx, py - cy)
        if d <= r:
            return 0.0, px, py
        return d - r, cx + (px - cx) * r / d, cy + (py - cy) * r / d
    pts = shape["poly"]
    if point_in_poly(px, py, pts):
        return 0.0, px, py
    best = (INF, px, py)
    for i in range(len(pts)):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % len(pts)]
        d = seg_dist(px, py, ax, ay, bx, by)
        if d[0] < best[0]:
            best = d
    return best


def inside(shape, px, py, tol=1e-9):
    return dist_to_shape(shape, px, py)[0] <= tol


def overlap_area_rect(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    w = min(ax1, bx1) - max(ax0, bx0)
    h = min(ay1, by1) - max(ay0, by0)
    return w * h if w > 1e-6 and h > 1e-6 else 0.0


def lane_shapes(q):
    """La file pleine comme une suite de bandes de sa largeur, une par segment."""
    out = []
    half = q["width"] / 2
    for (x0, y0), (x1, y1) in zip(q["points"], q["points"][1:]):
        L = math.hypot(x1 - x0, y1 - y0) or 1
        ux, uy = (x1 - x0) / L, (y1 - y0) / L
        nx_, ny_ = -uy * half, ux * half
        out.append({"poly": [[x0 + nx_, y0 + ny_], [x1 + nx_, y1 + ny_],
                             [x1 - nx_, y1 - ny_], [x0 - nx_, y0 - ny_]]})
    return out


# Raster -------------------------------------------------------------------------------

class Grid:
    def __init__(self, level):
        x0, y0, x1, y1 = level["frame"]
        self.x0, self.y0 = x0, y0
        self.nx = int(round((x1 - x0) / RES)) + 1
        self.ny = int(round((y1 - y0) / RES)) + 1
        self.n = self.nx * self.ny

    def xy(self, k):
        return self.x0 + (k % self.nx) * RES, self.y0 + (k // self.nx) * RES

    def cell(self, x, y):
        i = int(round((x - self.x0) / RES))
        j = int(round((y - self.y0) / RES))
        if 0 <= i < self.nx and 0 <= j < self.ny:
            return j * self.nx + i
        return None

    def clearance2(self, shapes, cap):
        """Carré de la distance de chaque case au plus proche obstacle (plafonnée à cap)."""
        nx, ny = self.nx, self.ny
        cap2 = cap * cap
        clr = [cap2] * self.n
        capc = int(math.ceil(cap / RES))
        for j in range(ny):
            dj = min(j, ny - 1 - j)
            row = j * nx
            for i in range(nx):
                d = min(dj, i, nx - 1 - i)
                if d <= capc:
                    v = (d * RES) ** 2
                    if v < clr[row + i]:
                        clr[row + i] = v
        for shape in shapes:
            bx0, by0, bx1, by1 = bbox(shape)
            i0 = max(0, int(math.ceil((bx0 - cap - self.x0) / RES - 1e-9)))
            i1 = min(nx - 1, int(math.floor((bx1 + cap - self.x0) / RES + 1e-9)))
            j0 = max(0, int(math.ceil((by0 - cap - self.y0) / RES - 1e-9)))
            j1 = min(ny - 1, int(math.floor((by1 + cap - self.y0) / RES + 1e-9)))
            if i0 > i1 or j0 > j1:
                continue
            xs = [self.x0 + i * RES for i in range(i0, i1 + 1)]
            if "rect" in shape:
                rx, ry, rw, rh = shape["rect"]
                dx2 = [max(rx - x, 0.0, x - rx - rw) ** 2 for x in xs]
                for j in range(j0, j1 + 1):
                    y = self.y0 + j * RES
                    dy = max(ry - y, 0.0, y - ry - rh)
                    dy2 = dy * dy
                    if dy2 >= cap2:
                        continue
                    base = j * nx + i0
                    for t, v in enumerate(dx2):
                        d2 = v + dy2
                        if d2 < clr[base + t]:
                            clr[base + t] = d2
            else:
                for j in range(j0, j1 + 1):
                    y = self.y0 + j * RES
                    base = j * nx + i0
                    for t, x in enumerate(xs):
                        if "circle" in shape:
                            cx, cy, r = shape["circle"]
                            d = max(0.0, math.hypot(x - cx, y - cy) - r)
                        else:
                            d = dist_to_shape(shape, x, y)[0]
                        d2 = d * d
                        if d2 < clr[base + t]:
                            clr[base + t] = d2
        return clr

    def mask(self, shapes):
        """Cases dont le centre est dans l'une des formes."""
        m = bytearray(self.n)
        for shape in shapes:
            bx0, by0, bx1, by1 = bbox(shape)
            i0 = max(0, int(math.ceil((bx0 - self.x0) / RES - 1e-9)))
            i1 = min(self.nx - 1, int(math.floor((bx1 - self.x0) / RES + 1e-9)))
            j0 = max(0, int(math.ceil((by0 - self.y0) / RES - 1e-9)))
            j1 = min(self.ny - 1, int(math.floor((by1 - self.y0) / RES + 1e-9)))
            for j in range(j0, j1 + 1):
                y = self.y0 + j * RES
                for i in range(i0, i1 + 1):
                    x = self.x0 + i * RES
                    if "rect" in shape or inside(shape, x, y):
                        m[j * self.nx + i] = 1
        return m


def passable(clr2, r):
    lim = r * r - EPS
    return bytearray(1 if v >= lim else 0 for v in clr2)


# Recherches ---------------------------------------------------------------------------

def search(grids, ok, sources, links, weighted=True):
    """Dijkstra (ou parcours en largeur) sur plusieurs niveaux reliés par des escaliers."""
    dist = [[INF] * g.n for g in grids]
    heap = []
    dq = deque()
    for li, k in sources:
        if k is not None and ok[li][k] and dist[li][k] > 0:
            dist[li][k] = 0.0
            if weighted:
                heap.append((0.0, li, k))
            else:
                dq.append((li, k))
    heapq.heapify(heap)
    while heap or dq:
        if weighted:
            d, li, k = heapq.heappop(heap)
            if d > dist[li][k]:
                continue
        else:
            li, k = dq.popleft()
            d = dist[li][k]
        g = grids[li]
        nx, ny = g.nx, g.ny
        okl = ok[li]
        dl = dist[li]
        i, j = k % nx, k // nx
        for di, dj, c in NEIGH:
            ii, jj = i + di, j + dj
            if ii < 0 or jj < 0 or ii >= nx or jj >= ny:
                continue
            kk = jj * nx + ii
            if not okl[kk]:
                continue
            if di and dj and not (okl[j * nx + ii] and okl[jj * nx + i]):
                continue
            nd = d + c * RES
            if nd < dl[kk] - 1e-12:
                dl[kk] = nd
                if weighted:
                    heapq.heappush(heap, (nd, li, kk))
                else:
                    dq.append((li, kk))
        for (lj, kk), cost in links.get((li, k), ()):
            if ok[lj][kk] and d + cost < dist[lj][kk] - 1e-12:
                dist[lj][kk] = d + cost
                if weighted:
                    heapq.heappush(heap, (d + cost, lj, kk))
                else:
                    dq.append((lj, kk))
    return dist


def nearest_ok(grid, ok, x, y, radius=0.35):
    """Case franchissable la plus proche d'un point (le point peut tomber contre un meuble)."""
    k = grid.cell(x, y)
    if k is not None and ok[k]:
        return k
    best, bestd = None, INF
    rc = int(math.ceil(radius / RES))
    i0 = int(round((x - grid.x0) / RES))
    j0 = int(round((y - grid.y0) / RES))
    for dj in range(-rc, rc + 1):
        for di in range(-rc, rc + 1):
            i, j = i0 + di, j0 + dj
            if 0 <= i < grid.nx and 0 <= j < grid.ny and ok[j * grid.nx + i]:
                d = math.hypot(di, dj)
                if d < bestd and d * RES <= radius:
                    best, bestd = j * grid.nx + i, d
    return best


def segment_clear(grid, solid, ax, ay, bx, by, free_shapes):
    """Le segment va du passage à la forme visée (free_shapes[0]) sans traverser d'obstacle;
    les formes suivantes (comptoir sous un poste) se traversent."""
    target, others = free_shapes[0], free_shapes[1:]
    L = math.hypot(bx - ax, by - ay)
    n = max(1, int(L / (RES / 2)))
    for s in range(n + 1):
        t = s / n
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        if inside(target, x, y, tol=RES * 0.6):
            return True
        if any(inside(fs, x, y, tol=RES * 0.6) for fs in others):
            continue
        k = grid.cell(x, y)
        if k is None or solid[k]:
            return False
    return True


def reach_shape(grid, ok, dist, solid, shape, reach, extra_free=()):
    """Plus courte distance d'approche d'une forme: une case franchissable atteinte, à
    `reach` au plus de la forme, reliée à elle par un segment sans obstacle."""
    x0, y0, x1, y1 = bbox(shape)
    i0 = max(0, int(math.floor((x0 - reach - grid.x0) / RES)))
    i1 = min(grid.nx - 1, int(math.ceil((x1 + reach - grid.x0) / RES)))
    j0 = max(0, int(math.floor((y0 - reach - grid.y0) / RES)))
    j1 = min(grid.ny - 1, int(math.ceil((y1 + reach - grid.y0) / RES)))
    cands = []
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            k = j * grid.nx + i
            if not ok[k] or dist[k] == INF:
                continue
            px, py = grid.x0 + i * RES, grid.y0 + j * RES
            d, qx, qy = dist_to_shape(shape, px, py)
            if d <= reach + EPS:
                cands.append((dist[k], px, py, qx, qy))
    cands.sort()
    for dk, px, py, qx, qy in cands:
        if segment_clear(grid, solid, px, py, qx, qy, [shape] + list(extra_free)):
            return dk
    return INF


def los(grid, opaque, ax, ay, bx, by):
    """Ligne de vue: rien d'opaque entre deux points (pas d'une demi-case)."""
    L = math.hypot(bx - ax, by - ay)
    n = int(L / (RES * 0.5)) + 1
    dx, dy = (bx - ax) / n, (by - ay) / n
    x0, y0, inv, nx = grid.x0, grid.y0, 1.0 / RES, grid.nx
    x, y = ax, ay
    for _ in range(1, n):
        x += dx
        y += dy
        if opaque[int((y - y0) * inv + 0.5) * nx + int((x - x0) * inv + 0.5)]:
            return False
    return True


def door_face(shape, vx, vy):
    """Point de la porte le plus proche de l'observateur, 5 cm de son côté: on vise la face vue."""
    _, qx, qy = dist_to_shape(shape, vx, vy)
    L = math.hypot(vx - qx, vy - qy) or 1.0
    return qx + (vx - qx) / L * 0.05, qy + (vy - qy) / L * 0.05


def angle_of(vx, vy, tx, ty):
    """Angle du plan (0 = haut du dessin, 90 = droite), en degrés."""
    return math.degrees(math.atan2(tx - vx, -(ty - vy))) % 360


def angdiff(a, b):
    return abs((a - b + 180) % 360 - 180)


def covering_arc(angles):
    """Plus petit arc qui contient tous les angles: (largeur, milieu)."""
    if not angles:
        return 0.0, 0.0
    s = sorted(a % 360 for a in angles)
    if len(s) == 1:
        return 0.0, s[0]
    gaps = [(s[(i + 1) % len(s)] - s[i]) % 360 for i in range(len(s))]
    k = max(range(len(s)), key=lambda i: gaps[i])
    width = 360 - gaps[k]
    start = s[(k + 1) % len(s)]
    return width, (start + width / 2) % 360


def count_window(sorted_angles, lo, hi):
    """Nombre d'angles dans [lo, hi] modulo 360 (liste triée)."""
    lo %= 360
    hi %= 360
    if lo <= hi:
        return bisect.bisect_right(sorted_angles, hi) - bisect.bisect_left(sorted_angles, lo)
    return (len(sorted_angles) - bisect.bisect_left(sorted_angles, lo)) + bisect.bisect_right(sorted_angles, hi)


def queue_slots(q, pitch):
    pts = list(reversed(q["points"]))
    slots, seg, dist_in, need = [], 0, 0.0, 0.0
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


def polyline_samples(points, step):
    out = []
    for (x0, y0), (x1, y1) in zip(points, points[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(math.ceil(L / step)))
        for s in range(n):
            t = s / n
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, (x1 - x0) / (L or 1), (y1 - y0) / (L or 1)))
    x1, y1 = points[-1]
    if len(points) > 1:
        x0, y0 = points[-2]
        L = math.hypot(x1 - x0, y1 - y0) or 1
        out.append((x1, y1, (x1 - x0) / L, (y1 - y0) / L))
    return out


def fmt(v, digits=1):
    return f"{v:.{digits}f}".replace(".", ",")


# Contrôle d'un plan ---------------------------------------------------------------------

class Report:
    def __init__(self, plan):
        self.plan = plan
        self.errors = []
        self.lines = []
        self.views = []
        self.grid_worst = None

    def err(self, s):
        self.errors.append(s)

    def info(self, s):
        self.lines.append(s)


MOVABLE = ("table", "seat", "furniture")


def check_plan(plan, norms, with_grid=True):
    rep = Report(plan)
    levels = plan["levels"]
    addr = plan["address"]
    lid = {lv["id"]: i for i, lv in enumerate(levels)}
    grids = [Grid(lv) for lv in levels]
    r_pass = norms["passage_min"] / 2
    r_main = norms["main_aisle"] / 2
    r_leak = norms["leak_width"] / 2
    reach = norms["seat_reach"]
    staff = plan["staff"]

    # 1. Capacité et plafonds de l'architecte.
    seats = [(li, e) for li, lv in enumerate(levels) for e in lv["elements"] if e["kind"] == "seat"]
    count = {"inside": 0, "outside": 0}
    for _, e in seats:
        count[e["seat"]["area"]] += 1
    cap = plan["capacity"]
    if count["inside"] != cap["inside"] or count["outside"] != cap["outside"]:
        rep.err(f"capacité dessinée {count['inside']} + {count['outside']} différente de l'annoncée "
                f"{cap['inside']} + {cap['outside']}")
    rep.info(f"places dessinées: {count['inside']} à l'intérieur, {count['outside']} dehors "
             f"(annoncées: {cap['inside']} et {cap['outside']})")
    queues = [(li, q) for li, lv in enumerate(levels) for q in lv.get("queues", [])]
    q_places = sum(q["places"] for _, q in queues)
    for _, q in queues:
        if q["places"] > norms["queue_max"]:
            rep.err(f"file « {q['id']} » de {q['places']} places (C4: {norms['queue_max']} au plus)")
    if staff["employees"] > norms["employees_max"]:
        rep.err(f"{staff['employees']} employés (C5: {norms['employees_max']} au plus)")
    if len(levels) > norms["levels_max"]:
        rep.err(f"{len(levels)} niveaux (C17: {norms['levels_max']} au plus)")
    n_seats = count["inside"] + count["outside"]
    present = n_seats + q_places + staff["employees"] + staff["players"]
    pcap = norms["present_cap"][addr]
    if present > pcap:
        rate = (pcap - q_places - staff["employees"] - staff["players"]) / max(1, n_seats)
        occ = plan.get("occupancy_max")
        if occ is None or occ > rate + 1e-9:
            rep.err(f"{present} présents si tout est plein (C2: {pcap}); il faudrait déclarer une "
                    f"occupation de {rate * 100:.0f} % au plus")
        else:
            rep.info(f"présents: {present} si tout est plein; sous le plafond C2 de {pcap} avec "
                     f"{occ * 100:.0f} % des places occupées au plus (seuil: {rate * 100:.0f} %)")
    else:
        rep.info(f"présents au pire: {present} ({n_seats} places, {q_places} en file, "
                 f"{staff['employees']} employés, {staff['players']} joueurs; C2: {pcap})")
    n_furn = sum(1 for lv in levels for e in lv["elements"] if e["kind"] in MOVABLE)
    fcap = norms["furniture_cap"][addr]
    if n_furn > fcap:
        rep.err(f"{n_furn} meubles dessinés (C6: {fcap} au plus)")
    rep.info(f"meubles dessinés: {n_furn}; il en reste {fcap - n_furn} pour la décoration (C6: {fcap})")

    # 2. Rasters: clients, joueurs, file pleine, opacité.
    def obstacles(lv, network, with_queues=False, fixed_only=False):
        out = []
        for e in lv["elements"]:
            if fixed_only and e["kind"] in MOVABLE:
                continue
            if e["kind"] == "door":
                acc = e.get("access", "public")
                if acc == "closed" or (network == "clients" and acc == "staff"):
                    out.append(e["shape"])
            elif e.get("blocks"):
                out.append(e["shape"])
        for z in lv["zones"]:
            if z["kind"] == "backdrop":
                out.append(z["shape"])
        if with_queues:
            for q in lv.get("queues", []):
                out.extend(lane_shapes(q))
        return out

    cap_d = 0.75
    clr_c = [g.clearance2(obstacles(lv, "clients"), cap_d) for g, lv in zip(grids, levels)]
    clr_s = [g.clearance2(obstacles(lv, "staff"), cap_d) for g, lv in zip(grids, levels)]
    clr_q = [g.clearance2(obstacles(lv, "clients", True), cap_d) for g, lv in zip(grids, levels)]
    ok_c = [passable(c, r_pass) for c in clr_c]
    ok_leak = [passable(c, r_leak) for c in clr_c]
    ok_s = [passable(c, r_pass) for c in clr_s]
    ok_s_main = [passable(c, r_main) for c in clr_s]
    # Meubles portés à deux: la coque seule (murs, portes, comptoirs, postes), avant l'aménagement.
    clr_shell = [g.clearance2(obstacles(lv, "staff", fixed_only=True), cap_d) for g, lv in zip(grids, levels)]
    ok_shell_main = [passable(c, r_main) for c in clr_shell]
    ok_q_main = [passable(c, r_main) for c in clr_q]
    solid_c = [bytearray(1 if v <= EPS else 0 for v in c) for c in clr_c]
    solid_s = [bytearray(1 if v <= EPS else 0 for v in c) for c in clr_s]
    opaque = [g.mask([e["shape"] for e in lv["elements"] if e.get("opaque")]) for g, lv in zip(grids, levels)]
    # Brise-bise et vitrines garnies: ils cachent les clients assis, pas ceux qui sont debout.
    opaque_seated = []
    for g, lv, op in zip(grids, levels, opaque):
        low = g.mask([e["shape"] for e in lv["elements"] if e.get("screen_low")])
        opaque_seated.append(bytearray(a | b for a, b in zip(op, low)))

    def make_links(ok_list, public_only):
        links = {}
        for lk in plan["links"]:
            if public_only and not lk["public"]:
                continue
            la, lb = lid[lk["from"]["level"]], lid[lk["to"]["level"]]
            ka = nearest_ok(grids[la], ok_list[la], *lk["from"]["pos"], radius=0.6)
            kb = nearest_ok(grids[lb], ok_list[lb], *lk["to"]["pos"], radius=0.6)
            if ka is None or kb is None:
                continue
            links.setdefault((la, ka), []).append(((lb, kb), lk["length"]))
            links.setdefault((lb, kb), []).append(((la, ka), lk["length"]))
        return links

    def pts_of(name):
        out = []
        for li, lv in enumerate(levels):
            v = lv["points"].get(name)
            if v is None:
                continue
            if isinstance(v[0], list):
                out.extend((li, p) for p in v)
            else:
                out.append((li, v))
        return out

    def dist_point(li, p, ok_list, dist, radius=0.35):
        k = nearest_ok(grids[li], ok_list[li], p[0], p[1], radius)
        return INF if k is None else dist[li][k]

    entrances = pts_of("entrance")
    if not entrances:
        rep.err("aucune entrée")
        return rep
    links_c = make_links(ok_c, True)
    src_c = [(li, nearest_ok(grids[li], ok_c[li], *p)) for li, p in entrances]
    for (li, p), (_, k) in zip(entrances, src_c):
        if k is None:
            rep.err(f"entrée {p} hors des passages de 0,90 m")
    dist_c = search(grids, ok_c, src_c, links_c)

    # 3. Passages de 0,90 m.
    targets = []
    for li, q in queues:
        targets.append((f"caisse « {q['id']} »", li, q["register"]))
        targets.append((f"passe « {q['id']} »", li, q["pickup"]))
    for li, p in pts_of("wc"):
        targets.append(("toilettes", li, p))
    for li, p in pts_of("exits"):
        targets.append(("sortie", li, p))
    for label, li, p in targets:
        if dist_point(li, p, ok_c, dist_c) == INF:
            rep.err(f"{label} {p} injoignable par un passage de 0,90 m depuis l'entrée")
    for li, q in queues:
        d = dist_point(li, q["register"], ok_c, dist_c)
        if d < INF:
            rep.info(f"file « {q['id']} »: caisse à {fmt(d)} m de marche de l'entrée la plus proche")
    seat_dist, unreached = [], []
    for li, e in seats:
        d = reach_shape(grids[li], ok_c[li], dist_c[li], solid_c[li], e["shape"], reach)
        if d == INF:
            unreached.append(e["id"])
        else:
            seat_dist.append((d, e))
    if unreached:
        rep.err(f"{len(unreached)} place(s) sans passage de 0,90 m: {', '.join(unreached)}")
    if seat_dist:
        far = max(seat_dist, key=lambda t: t[0])
        rep.info(f"{len(seat_dist)}/{len(seats)} places atteintes par 0,90 m; la plus lointaine "
                 f"à {fmt(far[0])} m d'une entrée ({far[1]['seat']['room']})")

    # Allée principale de 1,20 m, de l'entrée à chaque passe, à côté des files pleines.
    links_qm = make_links(ok_q_main, True)
    src_qm = [(li, nearest_ok(grids[li], ok_q_main[li], *p, radius=0.6)) for li, p in entrances]
    dist_qm = search(grids, ok_q_main, src_qm, links_qm, weighted=False)
    bad_main = [q["id"] for li, q in queues if dist_point(li, q["pickup"], ok_q_main, dist_qm, radius=0.6) == INF]
    for qid in bad_main:
        rep.err(f"pas d'allée de 1,20 m de l'entrée à la passe « {qid} » à côté de la file pleine")
    if queues and not bad_main:
        rep.info("allée principale de 1,20 m de l'entrée à chaque passe, à côté de la file pleine")

    # 4. Sorties.
    exits = pts_of("exits")
    inside_people = cap["inside"] + staff["players"] + staff["employees"]
    if inside_people >= norms["second_exit_from"]:
        ok_pair = any(exits[i][0] == exits[j][0] and
                      math.hypot(exits[i][1][0] - exits[j][1][0], exits[i][1][1] - exits[j][1][1]) >= 5.0
                      for i in range(len(exits)) for j in range(i + 1, len(exits)))
        if not ok_pair:
            rep.err(f"{inside_people} personnes à l'intérieur: deux sorties éloignées de 5 m au moins sont dues")
        else:
            rep.info(f"{inside_people} personnes au plus à l'intérieur: {len(exits)} sorties éloignées")
    else:
        rep.info(f"{inside_people} personnes au plus à l'intérieur: {len(exits)} sortie(s)")

    # 5. Zones de travail et locaux du personnel.
    links_leak = make_links(ok_leak, True)
    dist_leak = search(grids, ok_leak, [(li, nearest_ok(grids[li], ok_leak[li], *p)) for li, p in entrances],
                       links_leak, weighted=False)
    leaks = 0
    for li, lv in enumerate(levels):
        g = grids[li]
        for z in lv["zones"]:
            if z["kind"] not in ("work", "private"):
                continue
            x0, y0, x1, y1 = bbox(z["shape"])
            found = False
            for j in range(max(0, int((y0 - g.y0) / RES)), min(g.ny, int((y1 - g.y0) / RES) + 1)):
                for i in range(max(0, int((x0 - g.x0) / RES)), min(g.nx, int((x1 - g.x0) / RES) + 1)):
                    k = j * g.nx + i
                    if dist_leak[li][k] < INF and inside(z["shape"], *g.xy(k), tol=-1e-9):
                        found = True
                        break
                if found:
                    break
            if found:
                leaks += 1
                rep.err(f"un client peut entrer dans « {z['label']} »")
    if not leaks:
        rep.info("aucun client ne peut entrer dans les zones de travail ni dans les locaux du personnel")

    staff_pts = pts_of("staff_start")
    links_s = make_links(ok_s, False)
    if not staff_pts:
        rep.err("pas de point de départ des joueurs (staff_start)")
        dist_s = [[INF] * g.n for g in grids]
    else:
        dist_s = search(grids, ok_s, [(li, nearest_ok(grids[li], ok_s[li], *p)) for li, p in staff_pts], links_s)
    posts = missed = 0
    for li, lv in enumerate(levels):
        supports = [e["shape"] for e in lv["elements"] if e["kind"] in ("counter", "backbar")]
        for e in lv["elements"]:
            if e["kind"] == "station" and e.get("post"):
                posts += 1
                under = [s for s in supports if overlap_area_rect(bbox(s), bbox(e["shape"])) > 0]
                if reach_shape(grids[li], ok_s[li], dist_s[li], solid_s[li], e["shape"], reach, under) == INF:
                    missed += 1
                    rep.err(f"poste « {e['label']} » ({e['id']}) hors d'atteinte des joueurs")
    for name, label in (("stock", "réserve"), ("delivery", "livraison")):
        for li, p in pts_of(name):
            if dist_point(li, p, ok_s, dist_s) == INF:
                rep.err(f"{label} {p} hors d'atteinte des joueurs")
    serv = []
    for li, e in seats:
        d = reach_shape(grids[li], ok_s[li], dist_s[li], solid_s[li], e["shape"], reach)
        if d == INF:
            rep.err(f"place {e['id']} hors d'atteinte des joueurs (service, débarrassage)")
        else:
            serv.append((d, e))
    rep.info(f"{posts - missed}/{posts} postes atteints par les joueurs par des passages de 0,90 m")
    if serv:
        far = max(serv, key=lambda t: t[0])
        rep.info(f"service: place la plus lointaine à {fmt(far[0])} m du comptoir ({far[1]['seat']['room']})")

    # Livraisons et meubles portés à deux: 1,20 m.
    links_sm = make_links(ok_s_main, False)
    deliveries = [(li, nearest_ok(grids[li], ok_s_main[li], *p, radius=0.6)) for li, p in pts_of("delivery")]
    dist_dl = search(grids, ok_s_main, deliveries, links_sm, weighted=False)
    for li, p in pts_of("stock"):
        if dist_point(li, p, ok_s_main, dist_dl, radius=0.6) == INF:
            rep.err(f"pas de passage de 1,20 m de la livraison à la réserve {p}")
    links_shell = make_links(ok_shell_main, False)
    src_big = [(li, nearest_ok(grids[li], ok_shell_main[li], *p, radius=0.6))
               for li, p in pts_of("delivery") + entrances]
    dist_big = search(grids, ok_shell_main, src_big, links_shell, weighted=False)
    bad_free = []
    for li, lv in enumerate(levels):
        g = grids[li]
        for z in lv["zones"]:
            if z["kind"] != "free":
                continue
            x0, y0, x1, y1 = bbox(z["shape"])
            hit = False
            for j in range(max(0, int((y0 - g.y0) / RES)), min(g.ny, int((y1 - g.y0) / RES) + 1)):
                for i in range(max(0, int((x0 - g.x0) / RES)), min(g.nx, int((x1 - g.x0) / RES) + 1)):
                    if dist_big[li][j * g.nx + i] < INF:
                        hit = True
                        break
                if hit:
                    break
            if not hit:
                bad_free.append(z["label"])
    if bad_free:
        rep.err(f"zone(s) libre(s) sans passage de 1,20 m pour un meuble porté à deux: {', '.join(bad_free)}")
    else:
        rep.info("livraison vers la réserve et meubles vers chaque zone libre: passages de 1,20 m")

    # 6. Files.
    for li, q in queues:
        lv = levels[li]
        g = grids[li]
        samples = polyline_samples(q["points"], RES)
        works = [z["shape"] for z in lv["zones"] if z["kind"] in ("work", "private")]
        half = q["width"] / 2
        crosses = any(inside(w, x + (-uy) * s, y + ux * s, tol=-1e-9)
                      for x, y, ux, uy in samples for s in (-half, 0.0, half) for w in works)
        off_net = sum(1 for x, y, _, _ in samples
                      if (lambda k: k is None or not ok_c[li][k] or dist_c[li][k] == INF)(g.cell(x, y)))
        if crosses:
            rep.err(f"la file « {q['id']} » traverse une zone de travail")
        if off_net:
            rep.err(f"la file « {q['id']} » sort des passages de 0,90 m sur {fmt(off_net * RES, 2)} m")
        length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(q["points"], q["points"][1:]))
        if length + 1e-6 < (q["places"] - 1) * norms["queue_pitch"]:
            rep.err(f"file « {q['id']} » de {fmt(length, 2)} m, trop courte pour {q['places']} personnes")
        reg = q["register"]
        if math.hypot(q["points"][-1][0] - reg[0], q["points"][-1][1] - reg[1]) > 0.6:
            rep.err(f"la file « {q['id']} » ne finit pas à sa caisse")
        doors = [e for e in lv["elements"] if e["kind"] == "door" and e["id"] in q["doors"]]
        if len(doors) != len(q["doors"]):
            rep.err(f"file « {q['id']} »: porte inconnue")
        elif doors:
            d0 = min(dist_to_shape(e["shape"], *q["points"][0])[0] for e in doors)
            if d0 > 2.5:
                rep.err(f"la file « {q['id']} » commence à {fmt(d0)} m de sa porte (2,5 m au plus)")
        pk = q["pickup"]
        if any(math.hypot(pk[0] - x, pk[1] - y) < half - 0.05 for x, y, _, _ in samples):
            rep.err(f"la passe « {q['id']} » est dans la file: le client reviendrait sur ses pas")
        if not crosses:
            rep.info(f"file « {q['id']} »: {q['places']} personnes sur {fmt(length, 2)} m, hors des zones de travail")

    # 7. Passages à garder libres, portes, escaliers.
    for li, lv in enumerate(levels):
        movable = [e for e in lv["elements"] if e["kind"] in MOVABLE and e.get("blocks")]
        for z in lv["zones"]:
            if z["kind"] != "keep_clear":
                continue
            zb = bbox(z["shape"])
            for e in movable:
                if overlap_area_rect(zb, bbox(e["shape"])) > 0.0004:
                    rep.err(f"« {e.get('label') or e['id']} » posé dans le passage « {z['label']} »")
        for e in lv["elements"]:
            if e["kind"] != "door":
                continue
            w = e.get("width", 0)
            if e.get("access") == "public" and w + EPS < norms["public_door_min"]:
                rep.err(f"porte {e['id']} de {fmt(w, 2)} m ({fmt(norms['public_door_min'], 2)} m au moins)")
            if (e.get("delivery") or e.get("entrance")) and w + EPS < norms["delivery_door_min"]:
                rep.err(f"porte {e['id']} ({e.get('label')}) de {fmt(w, 2)} m: entrées et livraisons "
                        f"demandent {fmt(norms['delivery_door_min'], 2)} m")
    for lk in plan["links"]:
        if lk["public"] and lk["width"] + EPS < norms["public_stair_min"]:
            rep.err(f"escalier {lk['id']} de {fmt(lk['width'], 2)} m ({fmt(norms['public_stair_min'], 2)} m au moins)")

    # 8 et 9. Vues: caisse, porte, foule; puis grille de points jouables.
    fov = norms["fov_deg"]
    half_fov = fov / 2
    crowd_cap = norms["crowd_cap"]
    level_targets = []
    for lv in levels:
        tg = {"seated": [center(e["shape"]) for e in lv["elements"] if e["kind"] == "seat"],
              "standing": [s for q in lv.get("queues", []) for s in queue_slots(q, norms["queue_pitch"])],
              "furn": [center(e["shape"]) for e in lv["elements"] if e["kind"] in MOVABLE],
              "spaces": []}
        for z in lv["zones"]:
            if z["kind"] != "space":
                continue
            x0, y0, x1, y1 = bbox(z["shape"])
            pts = []
            yy = y0 + 0.5
            while yy < y1:
                xx = x0 + 0.5
                while xx < x1:
                    if inside(z["shape"], xx, yy):
                        pts.append((xx, yy))
                    xx += 1.0
                yy += 1.0
            tg["spaces"].append((z, pts or [center(z["shape"])]))
        level_targets.append(tg)

    def crowd_at(li, vx, vy):
        g, op, tg = grids[li], opaque[li], level_targets[li]
        ops = opaque_seated[li]
        ang_people = sorted([angle_of(vx, vy, x, y) for x, y in tg["seated"] if los(g, ops, vx, vy, x, y)]
                            + [angle_of(vx, vy, x, y) for x, y in tg["standing"] if los(g, op, vx, vy, x, y)])
        space_angles = []
        for z, pts in tg["spaces"]:
            angs = sorted(angle_of(vx, vy, x, y) for x, y in pts if los(g, op, vx, vy, x, y))
            if angs:
                space_angles.append((z["extras"], angs))
        furn = sum(1 for x, y in tg["furn"] if los(g, op, vx, vy, x, y))
        worst, worst_dir = -1, 0
        for step in range(0, 360, 5):
            lo, hi = step - half_fov, step + half_fov
            c = count_window(ang_people, lo, hi) + 1
            c += sum(ex for ex, angs in space_angles if count_window(angs, lo, hi) > 0)
            if c > worst:
                worst, worst_dir = c, step
        around = len(ang_people) + sum(ex for ex, _ in space_angles) + 1
        return worst, worst_dir, around, furn

    for li, lv in enumerate(levels):
        g, op = grids[li], opaque[li]
        for v in lv["views"]:
            vx, vy = v["pos"]
            line = {"level": lv["id"], "view": v["id"], "label": v["label"]}
            for chk in v["checks"]:
                kind, _, ident = chk.partition(":")
                if kind == "queue":
                    q = next((q for q in lv.get("queues", []) if q["id"] == ident), None)
                    if q is None:
                        rep.err(f"vue « {v['label']} »: file « {ident} » inconnue")
                        continue
                    pts = [tuple(s) for s in queue_slots(q, norms["queue_pitch"])]
                    doors = [door_face(e["shape"], vx, vy) for e in lv["elements"]
                             if e["kind"] == "door" and e["id"] in q["doors"]]
                    hidden = [p for p in pts + doors if not los(g, op, vx, vy, p[0], p[1])]
                    width, _ = covering_arc([angle_of(vx, vy, x, y) for x, y in pts + doors])
                    if hidden:
                        rep.err(f"vue « {v['label']} »: {len(hidden)} point(s) de la file ou de la porte cachés")
                    if width > fov + 1e-6:
                        rep.err(f"vue « {v['label']} »: la file et la porte tiennent dans {width:.0f} degrés, "
                                f"plus que le champ de {fov}")
                    line["queue_arc"] = (width, len(pts))
                elif kind == "door":
                    e = next((e for e in lv["elements"] if e["kind"] == "door" and e["id"] == ident), None)
                    if e is None:
                        rep.err(f"vue « {v['label']} »: porte « {ident} » inconnue")
                        continue
                    dx, dy = door_face(e["shape"], vx, vy)
                    dd = angdiff(angle_of(vx, vy, dx, dy), v["facing_deg"])
                    if dd > half_fov or not los(g, op, vx, vy, dx, dy):
                        rep.err(f"vue « {v['label']} »: la porte n'est pas dans l'axe de travail ou elle est cachée")
                    line["door_deg"] = dd
            worst, wdir, around, furn = crowd_at(li, vx, vy)
            line.update(crowd=worst, crowd_dir=wdir, crowd_around=around, furn=furn)
            if worst > crowd_cap:
                rep.err(f"vue « {v['label']} »: {worst} personnages au pire dans le champ (C3: {crowd_cap})")
            rep.views.append(line)

    if with_grid:
        worst_pt, n_pts, over = None, 0, 0
        for li, lv in enumerate(levels):
            g = grids[li]
            fx0, fy0, fx1, fy1 = lv["frame"]
            yy = math.floor(fy0) + 0.5
            while yy < fy1:
                xx = math.floor(fx0) + 0.5
                while xx < fx1:
                    k = g.cell(xx, yy)
                    if k is not None and (dist_c[li][k] < INF or dist_s[li][k] < INF):
                        n_pts += 1
                        w, d, around, furn = crowd_at(li, xx, yy)
                        if worst_pt is None or w > worst_pt[0]:
                            worst_pt = (w, d, li, xx, yy, furn)
                        if w > crowd_cap:
                            over += 1
                            if over <= 5:
                                rep.err(f"point jouable ({fmt(xx)} ; {fmt(yy)}) du niveau {lv['id']}: "
                                        f"{w} personnages au pire dans le champ (C3: {crowd_cap})")
                    xx += 1.0
                yy += 1.0
        if over > 5:
            rep.err(f"et {over - 5} autre(s) point(s) jouable(s) au-dessus du plafond C3")
        if worst_pt:
            rep.grid_worst = worst_pt
            w, d, li, x, y, furn = worst_pt
            rep.info(f"grille de {n_pts} points jouables (un par mètre): au pire {w} personnages dans le champ, "
                     f"en ({fmt(x)} ; {fmt(y)}) du niveau {levels[li]['id']}")
    return rep


DIRS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"]


def compass(plan_deg, north_deg):
    """Direction vraie d'un angle du plan, sachant où pointe le nord sur le dessin."""
    true_deg = (plan_deg - north_deg) % 360
    return DIRS[int(((true_deg + 22.5) % 360) // 45)]


def main(argv):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.json")
    args = list(argv)
    with_grid = "--sans-grille" not in args
    args = [a for a in args if a != "--sans-grille"]
    only = None
    if "--plan" in args:
        i = args.index("--plan")
        only = args[i + 1]
        del args[i:i + 2]
    if args:
        path = args[0]
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    norms = data["norms"]
    total_err = 0
    for plan in data["plans"]:
        if only and plan["id"] != only:
            continue
        rep = check_plan(plan, norms, with_grid)
        total_err += len(rep.errors)
        print(f"== {plan['id']}: {plan['title']}, {plan['state_label'].lower()}")
        for s in rep.lines:
            print(f"  {s}")
        for v in rep.views:
            parts = [f"vue « {v['label']} »"]
            if "queue_arc" in v:
                w, n = v["queue_arc"]
                parts.append(f"client, file ({n} places) et porte d'un seul regard: {w:.0f} degrés sur {norms['fov_deg']}")
            if "door_deg" in v:
                parts.append(f"porte à {v['door_deg']:.0f} degrés de l'axe de travail")
            parts.append(f"foule au pire {v['crowd']} dans le champ (regard vers le "
                         f"{compass(v['crowd_dir'], plan['north_deg'])}), {v['crowd_around']} en se retournant; "
                         f"{v['furn']} meubles dessinés en vue")
            print("  " + "; ".join(parts))
        for e in rep.errors:
            print(f"  ERREUR: {e}")
        print(f"  {len(rep.errors)} erreur(s)")
    print(f"Total: {total_err} erreur(s)")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
