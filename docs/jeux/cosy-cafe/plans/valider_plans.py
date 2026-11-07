#!/usr/bin/env python3
"""Validateur des plans des adresses de Cosy Café.

Lit plans.json (écrit par construire_plans.py, même source que les SVG) et vérifie,
pour chaque plan:

1. capacité: les places dessinées (intérieur, dehors) égalent les places annoncées;
2. passages: un gabarit de 0,90 m de large va de l'entrée à la caisse, à la passe, à chaque
   place, aux toilettes et à chaque sortie (centre du gabarit à 0,45 m au moins de tout
   obstacle); une place est atteinte quand le bord du passage est à 0,25 m au plus de l'assise
   (un pas), sans rien entre les deux;
3. sorties: une seconde sortie, à 5 m au moins de la première, dès 20 personnes présentes;
4. zone de travail: la file ne la traverse jamais, et aucun client, même mince (0,50 m), n'y
   entre ni dans les locaux du personnel; les joueurs atteignent chaque poste, la réserve et
   le point de livraison par des passages de 0,90 m;
5. file: elle part de la porte, finit à la caisse, tient ses places et reste dans les passages;
6. lisibilité: depuis la caisse (et les postes qui le demandent), la porte d'entrée et chaque
   place de la file sont dans le champ (100 degrés) et rien d'opaque ne les cache;
7. foule: pour chaque point de vue, le nombre de personnages au pire dans le champ (places
   occupées, file pleine, figurants des espaces vus, l'autre joueur) reste sous le plafond;
8. passages à garder libres: aucun meuble n'y est posé; portes et escaliers à la bonne largeur.

Usage: python3 -I valider_plans.py [plans.json] [--plan <id>]
Code de sortie 0 si aucune erreur. Bibliothèque standard seulement.
"""

import heapq
import json
import math
import os
import sys
from collections import deque

RES = 0.05  # côté d'une case du raster de contrôle (m); les cotes des plans tombent sur ce pas
EPS = 1e-6
NEIGH = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0),
         (1, 1, math.sqrt(2)), (1, -1, math.sqrt(2)), (-1, 1, math.sqrt(2)), (-1, -1, math.sqrt(2))]


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
    inside = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > py) != (y2 > py):
            xi = x1 + (py - y1) * (x2 - x1) / (y2 - y1)
            if px < xi:
                inside = not inside
    return inside


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
    best = (float("inf"), px, py)
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
        # Bord du cadre: au-delà, rien n'existe.
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
            elif "circle" in shape:
                cx, cy, r = shape["circle"]
                for j in range(j0, j1 + 1):
                    y = self.y0 + j * RES
                    base = j * nx + i0
                    for t, x in enumerate(xs):
                        d = max(0.0, math.hypot(x - cx, y - cy) - r)
                        d2 = d * d
                        if d2 < clr[base + t]:
                            clr[base + t] = d2
            else:
                for j in range(j0, j1 + 1):
                    y = self.y0 + j * RES
                    base = j * nx + i0
                    for t, x in enumerate(xs):
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
    INF = float("inf")
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
    best, bestd = None, float("inf")
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


def reach_shape(grid, ok, dist, solid, shape, reach, extra_free=()):
    """Plus courte distance d'approche d'une forme: une case franchissable atteinte, à
    `reach` au plus de la forme, reliée à elle par un segment sans obstacle."""
    x0, y0, x1, y1 = bbox(shape)
    i0 = max(0, int(math.floor((x0 - reach - grid.x0) / RES)))
    i1 = min(grid.nx - 1, int(math.ceil((x1 + reach - grid.x0) / RES)))
    j0 = max(0, int(math.floor((y0 - reach - grid.y0) / RES)))
    j1 = min(grid.ny - 1, int(math.ceil((y1 + reach - grid.y0) / RES)))
    best = float("inf")
    cands = []
    for j in range(j0, j1 + 1):
        for i in range(i0, i1 + 1):
            k = j * grid.nx + i
            if not ok[k] or dist[k] == float("inf"):
                continue
            px, py = grid.x0 + i * RES, grid.y0 + j * RES
            d, qx, qy = dist_to_shape(shape, px, py)
            if d <= reach + EPS:
                cands.append((dist[k], px, py, qx, qy))
    cands.sort()
    for dk, px, py, qx, qy in cands:
        if dk >= best:
            break
        if segment_clear(grid, solid, px, py, qx, qy, [shape] + list(extra_free)):
            best = dk
            break
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


def visible(grid, opaque, ax, ay, bx, by, skip_end=0.0):
    L = math.hypot(bx - ax, by - ay)
    if L < 1e-9:
        return True
    n = max(1, int(L / (RES / 2)))
    for s in range(1, n):
        t = s / n
        if L * (1 - t) < skip_end:
            break
        k = grid.cell(ax + (bx - ax) * t, ay + (by - ay) * t)
        if k is None or opaque[k]:
            return False
    return True


def angle_of(vx, vy, tx, ty):
    """Angle du plan (0 = haut du dessin, 90 = droite), en degrés."""
    return math.degrees(math.atan2(tx - vx, -(ty - vy))) % 360


def angdiff(a, b):
    return abs((a - b + 180) % 360 - 180)


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
        self.warnings = []
        self.lines = []
        self.views = []

    def err(self, s):
        self.errors.append(s)

    def warn(self, s):
        self.warnings.append(s)

    def info(self, s):
        self.lines.append(s)


def check_plan(plan, norms):
    rep = Report(plan)
    levels = plan["levels"]
    lid = {lv["id"]: i for i, lv in enumerate(levels)}
    grids = [Grid(lv) for lv in levels]
    r_pass = norms["passage_min"] / 2
    r_main = norms["main_aisle"] / 2
    r_leak = norms["leak_width"] / 2
    reach = norms["seat_reach"]

    # 1. Capacité.
    seats = []
    for li, lv in enumerate(levels):
        for e in lv["elements"]:
            if e["kind"] == "seat":
                seats.append((li, e))
    count = {"inside": 0, "outside": 0}
    for _, e in seats:
        count[e["seat"]["area"]] += 1
    cap = plan["capacity"]
    if count["inside"] != cap["inside"] or count["outside"] != cap["outside"]:
        rep.err(f"capacité dessinée {count['inside']} + {count['outside']} différente de l'annoncée "
                f"{cap['inside']} + {cap['outside']}")
    rep.info(f"places dessinées: {count['inside']} à l'intérieur, {count['outside']} dehors "
             f"(annoncées: {cap['inside']} et {cap['outside']})")

    # Obstacles par réseau.
    def obstacles(lv, network):
        out = []
        for e in lv["elements"]:
            if e["kind"] == "door":
                acc = e.get("access", "public")
                if acc == "closed" or (network == "clients" and acc == "staff"):
                    out.append(e["shape"])
            elif e.get("blocks"):
                out.append(e["shape"])
        return out

    cap_d = 0.75  # au-delà, la largeur ne change plus rien aux contrôles (1,40 m au plus)
    clr_c = [g.clearance2(obstacles(lv, "clients"), cap_d) for g, lv in zip(grids, levels)]
    clr_s = [g.clearance2(obstacles(lv, "staff"), cap_d) for g, lv in zip(grids, levels)]
    ok_c = [passable(c, r_pass) for c in clr_c]
    ok_leak = [passable(c, r_leak) for c in clr_c]
    ok_s = [passable(c, r_pass) for c in clr_s]
    solid_c = [bytearray(1 if v <= EPS else 0 for v in c) for c in clr_c]
    solid_s = [bytearray(1 if v <= EPS else 0 for v in c) for c in clr_s]
    opaque = []
    for g, lv in zip(grids, levels):
        opaque.append(g.mask([e["shape"] for e in lv["elements"] if e.get("opaque")]))

    # Liaisons entre niveaux (escaliers).
    def make_links(ok_list, public_only):
        links = {}
        for lk in plan["links"]:
            if public_only and not lk["public"]:
                continue
            la, lb = lid[lk["from"]["level"]], lid[lk["to"]["level"]]
            ka = nearest_ok(grids[la], ok_list[la], *lk["from"]["pos"])
            kb = nearest_ok(grids[lb], ok_list[lb], *lk["to"]["pos"])
            if ka is None or kb is None:
                rep.err(f"escalier {lk['id']}: palier injoignable")
                continue
            links.setdefault((la, ka), []).append(((lb, kb), lk["length"]))
            links.setdefault((lb, kb), []).append(((la, ka), lk["length"]))
        return links

    links_c = make_links(ok_c, True)
    links_s = make_links(ok_s, False)
    links_leak = make_links(ok_leak, True)

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

    entrances = pts_of("entrance")
    if not entrances:
        rep.err("aucune entrée")
        return rep
    src_c = [(li, nearest_ok(grids[li], ok_c[li], *p)) for li, p in entrances]
    for (li, p), (_, k) in zip(entrances, src_c):
        if k is None:
            rep.err(f"entrée {p} hors des passages de 0,90 m")
    dist_c = search(grids, ok_c, src_c, links_c)

    def dist_point(li, p, ok_list, dist, radius=0.35):
        k = nearest_ok(grids[li], ok_list[li], p[0], p[1], radius)
        if k is None:
            return float("inf")
        return dist[li][k]

    # 2. Passages de 0,90 m: caisse, passe, toilettes, sorties, places.
    targets = []
    for name, label in (("register", "caisse"), ("pickup", "passe")):
        for li, p in pts_of(name):
            targets.append((label, li, p))
    for li, p in pts_of("wc"):
        targets.append(("toilettes", li, p))
    for li, p in pts_of("exits"):
        targets.append(("sortie", li, p))
    found = {}
    for label, li, p in targets:
        d = dist_point(li, p, ok_c, dist_c)
        if d == float("inf"):
            rep.err(f"{label} {p} injoignable par un passage de 0,90 m depuis l'entrée")
        else:
            found.setdefault(label, []).append(d)
    if "caisse" in found:
        rep.info(f"entrée vers caisse: {fmt(min(found['caisse']))} m de marche")

    seat_dist = []
    unreached = []
    for li, e in seats:
        d = reach_shape(grids[li], ok_c[li], dist_c[li], solid_c[li], e["shape"], reach)
        if d == float("inf"):
            unreached.append(e["id"])
        else:
            seat_dist.append((d, e))
    if unreached:
        rep.err(f"{len(unreached)} place(s) sans passage de 0,90 m: {', '.join(unreached)}")
    if seat_dist:
        far = max(seat_dist, key=lambda t: t[0])
        rep.info(f"{len(seat_dist)}/{len(seats)} places atteintes par 0,90 m; la plus lointaine "
                 f"à {fmt(far[0])} m de l'entrée ({far[1]['seat']['room']})")

    # Passage le plus étroit entre l'entrée et la caisse (mesure, pas une règle).
    regs = pts_of("register")
    if regs:
        li_r, p_r = regs[0]
        widest = None
        for width in (1.40, 1.20, 1.10, 1.00, 0.90):
            okw = [passable(c, width / 2) for c in clr_c]
            lk = make_links(okw, True)
            srcw = [(li, nearest_ok(grids[li], okw[li], *p, radius=0.6)) for li, p in entrances]
            dw = search(grids, okw, srcw, lk, weighted=False)
            if dist_point(li_r, p_r, okw, dw, radius=0.6) < float("inf"):
                widest = width
                break
        if widest is None:
            rep.info("entrée vers caisse: passage le plus étroit sous 0,90 m")
        else:
            rep.info(f"entrée vers caisse: passage le plus étroit de {fmt(widest, 2)} m au moins")

    # 3. Sorties.
    exits = pts_of("exits")
    people = cap["inside"] + plan["staff"]["players"] + plan["staff"]["employees"]
    if people >= norms["second_exit_from"]:
        ok_pair = False
        for i in range(len(exits)):
            for j in range(i + 1, len(exits)):
                (la, pa), (lb, pb) = exits[i], exits[j]
                if la == lb and math.hypot(pa[0] - pb[0], pa[1] - pb[1]) >= 5.0:
                    ok_pair = True
        if not ok_pair:
            rep.err(f"{people} personnes à l'intérieur: deux sorties éloignées de 5 m au moins sont dues")
        else:
            rep.info(f"{people} personnes au plus à l'intérieur: {len(exits)} sorties")
    else:
        rep.info(f"{people} personnes au plus à l'intérieur: {len(exits)} sortie(s)")

    # 4. Zone de travail et locaux du personnel.
    dist_leak = search(grids, ok_leak, [(li, nearest_ok(grids[li], ok_leak[li], *p)) for li, p in entrances],
                       links_leak, weighted=False)
    for li, lv in enumerate(levels):
        for z in lv["zones"]:
            if z["kind"] not in ("work", "private"):
                continue
            g = grids[li]
            x0, y0, x1, y1 = bbox(z["shape"])
            leak = False
            for j in range(max(0, int((y0 - g.y0) / RES)), min(g.ny, int((y1 - g.y0) / RES) + 1)):
                for i in range(max(0, int((x0 - g.x0) / RES)), min(g.nx, int((x1 - g.x0) / RES) + 1)):
                    k = j * g.nx + i
                    if dist_leak[li][k] < float("inf") and inside(z["shape"], *g.xy(k), tol=-1e-9):
                        leak = True
                        break
                if leak:
                    break
            if leak:
                rep.err(f"un client peut entrer dans « {z['label']} »")
    rep.info("aucun client ne peut entrer dans la zone de travail ni dans les locaux du personnel"
             if not any("peut entrer" in e for e in rep.errors) else "fuite dans une zone du personnel")

    staff_pts = pts_of("staff_start")
    if not staff_pts:
        rep.err("pas de point de départ des joueurs (staff_start)")
    else:
        src_s = [(li, nearest_ok(grids[li], ok_s[li], *p)) for li, p in staff_pts]
        dist_s = search(grids, ok_s, src_s, links_s)
        posts = 0
        missed_posts = 0
        for li, lv in enumerate(levels):
            # Un poste posé sur un comptoir s'atteint par-dessus ce comptoir.
            supports = [e["shape"] for e in lv["elements"] if e["kind"] in ("counter", "backbar")]
            for e in lv["elements"]:
                if e["kind"] == "station" and e.get("post"):
                    posts += 1
                    under = [s for s in supports if overlap_area_rect(bbox(s), bbox(e["shape"])) > 0]
                    d = reach_shape(grids[li], ok_s[li], dist_s[li], solid_s[li], e["shape"], reach, under)
                    if d == float("inf"):
                        missed_posts += 1
                        rep.err(f"poste « {e['label']} » ({e['id']}) hors d'atteinte des joueurs")
        for name, label in (("stock", "réserve"), ("delivery", "livraison")):
            for li, p in pts_of(name):
                if dist_point(li, p, ok_s, dist_s) == float("inf"):
                    rep.err(f"{label} {p} hors d'atteinte des joueurs")
        serv = []
        for li, e in seats:
            d = reach_shape(grids[li], ok_s[li], dist_s[li], solid_s[li], e["shape"], reach)
            if d == float("inf"):
                rep.err(f"place {e['id']} hors d'atteinte des joueurs (service, débarrassage)")
            else:
                serv.append((d, e))
        rep.info(f"{posts - missed_posts}/{posts} postes atteints par les joueurs par des passages de 0,90 m")
        if serv:
            far = max(serv, key=lambda t: t[0])
            rep.info(f"service: place la plus lointaine à {fmt(far[0])} m de la zone de travail "
                     f"({far[1]['seat']['room']})")

    # 5. File.
    for li, lv in enumerate(levels):
        q = lv.get("queue")
        if not q:
            continue
        g = grids[li]
        samples = polyline_samples(q["points"], RES)
        works = [z["shape"] for z in lv["zones"] if z["kind"] in ("work", "private")]
        half = q["width"] / 2
        crosses = False
        off_net = 0
        for x, y, ux, uy in samples:
            nxv, nyv = -uy, ux
            for s in (-half, 0.0, half):
                px, py = x + nxv * s, y + nyv * s
                if any(inside(w, px, py, tol=-1e-9) for w in works):
                    crosses = True
            k = g.cell(x, y)
            if k is None or not ok_c[li][k] or dist_c[li][k] == float("inf"):
                off_net += 1
        if crosses:
            rep.err("la file traverse la zone de travail")
        if off_net:
            rep.err(f"la file sort des passages de 0,90 m sur {fmt(off_net * RES, 2)} m")
        length = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(q["points"], q["points"][1:]))
        if length + 1e-6 < (q["places"] - 1) * norms["queue_pitch"]:
            rep.err(f"file de {fmt(length, 2)} m trop courte pour {q['places']} personnes")
        reg = lv["points"].get("register")
        if reg and math.hypot(q["points"][-1][0] - reg[0], q["points"][-1][1] - reg[1]) > 0.6:
            rep.err("la file ne finit pas à la caisse")
        doors = [e for e in lv["elements"] if e["kind"] == "door" and e.get("entrance")]
        if doors:
            d0 = min(dist_to_shape(e["shape"], *q["points"][0])[0] for e in doors)
            if d0 > 2.5:
                rep.err(f"la file commence à {fmt(d0)} m de la porte d'entrée (2,5 m au plus)")
        pk = lv["points"].get("pickup")
        if pk:
            for x, y, ux, uy in samples:
                if math.hypot(pk[0] - x, pk[1] - y) < half - 0.05:
                    rep.err("la passe est dans la file: le client revient sur ses pas")
                    break
        rep.info(f"file: {q['places']} personnes sur {fmt(length, 2)} m, hors de la zone de travail"
                 if not crosses else "file: traverse la zone de travail")

    # 8. Passages à garder libres, portes, escaliers.
    for li, lv in enumerate(levels):
        movable = [e for e in lv["elements"] if e["kind"] in ("table", "seat", "furniture") and e.get("blocks")]
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
                rep.err(f"porte {e['id']} de {fmt(w, 2)} m (0,90 m au moins)")
            if e.get("delivery") and w + EPS < norms["delivery_door_min"]:
                rep.err(f"porte de livraison {e['id']} de {fmt(w, 2)} m (1,20 m au moins)")
    for lk in plan["links"]:
        if lk["public"] and lk["width"] + EPS < norms["public_stair_min"]:
            rep.err(f"escalier {lk['id']} de {fmt(lk['width'], 2)} m (1,20 m au moins)")

    # 6 et 7. Vues: porte, file, foule.
    fov = norms["fov_deg"]
    for li, lv in enumerate(levels):
        g = grids[li]
        op = opaque[li]
        q = lv.get("queue")
        slots = queue_slots(q, norms["queue_pitch"]) if q else []
        doors = [e for e in lv["elements"] if e["kind"] == "door" and e.get("entrance")]
        lv_seats = [e for e in lv["elements"] if e["kind"] == "seat"]
        spaces = [z for z in lv["zones"] if z["kind"] == "space"]
        space_samples = []
        for z in spaces:
            x0, y0, x1, y1 = bbox(z["shape"])
            pts = []
            yy = y0 + 0.25
            while yy < y1:
                xx = x0 + 0.25
                while xx < x1:
                    if inside(z["shape"], xx, yy):
                        pts.append((xx, yy))
                    xx += 0.5
                yy += 0.5
            space_samples.append(pts)
        for v in lv["views"]:
            vx, vy = v["pos"]
            face = v["facing_deg"]
            vis_seats = []
            for e in lv_seats:
                sx, sy = center(e["shape"])
                if visible(g, op, vx, vy, sx, sy):
                    vis_seats.append(angle_of(vx, vy, sx, sy))
            vis_slots = []
            for i, (sx, sy) in enumerate(slots):
                ok = visible(g, op, vx, vy, sx, sy)
                vis_slots.append((i, angle_of(vx, vy, sx, sy), ok))
            vis_spaces = []
            for z, pts in zip(spaces, space_samples):
                angs = [angle_of(vx, vy, px, py) for px, py in pts if visible(g, op, vx, vy, px, py)]
                vis_spaces.append((z, angs))
            line = {"plan": plan["id"], "level": lv["id"], "view": v["id"], "label": v["label"]}
            if "door" in v["checks"]:
                best = None
                for e in doors:
                    dx, dy = center(e["shape"])
                    a_ = angle_of(vx, vy, dx, dy)
                    dd = angdiff(a_, face)
                    vis = visible(g, op, vx, vy, dx, dy, skip_end=0.3)
                    if vis and dd <= fov / 2 and (best is None or dd < best):
                        best = dd
                if best is None:
                    rep.err(f"vue « {v['label']} »: la porte d'entrée n'est pas dans le champ, ou elle est cachée")
                line["door_deg"] = best
            if "queue" in v["checks"]:
                seen = sum(1 for i, a_, ok in vis_slots if ok and angdiff(a_, face) <= fov / 2)
                if seen < len(slots):
                    rep.err(f"vue « {v['label']}  »: {len(slots) - seen} place(s) de la file hors du champ ou cachées")
                line["queue_seen"] = (seen, len(slots))
            line["seats_front"] = sum(1 for a_ in vis_seats if angdiff(a_, face) <= fov / 2)
            line["seats_total"] = len(lv_seats)
            worst, worst_dir = -1, 0
            for step in range(0, 360, 5):
                c = sum(1 for a_ in vis_seats if angdiff(a_, step) <= fov / 2)
                c += sum(1 for i, a_, ok in vis_slots if ok and angdiff(a_, step) <= fov / 2)
                c += sum(z["extras"] for z, angs in vis_spaces if any(angdiff(a_, step) <= fov / 2 for a_ in angs))
                c += 1  # l'autre joueur, compté partout
                if c > worst:
                    worst, worst_dir = c, step
            around = len(vis_seats) + sum(1 for _, _, ok in vis_slots if ok)
            around += sum(z["extras"] for z, angs in vis_spaces if angs) + 1
            line["crowd"] = worst
            line["crowd_dir"] = worst_dir
            line["crowd_around"] = around
            if worst > norms["crowd_cap"]:
                rep.err(f"vue « {v['label']} »: {worst} personnages au pire dans le champ "
                        f"(plafond {norms['crowd_cap']})")
            rep.views.append(line)
    return rep


DIRS = ["nord", "nord-est", "est", "sud-est", "sud", "sud-ouest", "ouest", "nord-ouest"]


def compass(plan_deg, north_deg):
    """Direction vraie d'un angle du plan, sachant où pointe le nord sur le dessin."""
    true_deg = (plan_deg - north_deg) % 360
    return DIRS[int(((true_deg + 22.5) % 360) // 45)]


def main(argv):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "plans.json")
    only = None
    args = list(argv)
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
        rep = check_plan(plan, norms)
        total_err += len(rep.errors)
        print(f"== {plan['id']}: {plan['title']}, {plan['state_label'].lower()}")
        for s in rep.lines:
            print(f"  {s}")
        for v in rep.views:
            parts = [f"vue « {v['label']} »"]
            if "door_deg" in v:
                parts.append("porte dans le champ" + (f" à {v['door_deg']:.0f} degrés de l'axe" if v["door_deg"] is not None else ": NON"))
            if "queue_seen" in v:
                parts.append(f"file vue {v['queue_seen'][0]}/{v['queue_seen'][1]}")
            parts.append(f"places devant soi {v['seats_front']}/{v['seats_total']}")
            parts.append(f"foule au pire {v['crowd']} dans le champ (regard vers le "
                         f"{compass(v['crowd_dir'], plan['north_deg'])}), {v['crowd_around']} en se retournant")
            print("  " + "; ".join(parts))
        for w in rep.warnings:
            print(f"  attention: {w}")
        for e in rep.errors:
            print(f"  ERREUR: {e}")
        print(f"  {len(rep.errors)} erreur(s)")
    print(f"Total: {total_err} erreur(s)")
    return 1 if total_err else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
