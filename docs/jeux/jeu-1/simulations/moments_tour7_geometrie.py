"""Moments rares, tour 7: contrôles géométriques sur la carte jouée (halte.json).

Document lié: docs/jeux/jeu-1/tour-07-conception.md (fiches 1.4, annexe B).

Ce script vérifie, pour chaque moment (les six de `donnees/moments.json` et les six
nouveaux du tour 7, décrits ici avec les mêmes images clés que les fiches):

1. M-02: temps où l'acteur principal reste à moins de 6 m de chaque case libre de
   l'anneau (cases dont le centre est entre `minRadius` et `radius` de la cible),
   ou de chaque place imposée (places à tenir, sièges, rives) quand le moment en impose.
   Même échantillonnage que `tests/moments.test.ts` (20 Hz, spline de Catmull-Rom aux
   extrémités doublées, copie de `sampleResolved`), mais seuil fixe de 6 m (et non
   `watch.radius`) et décompte arrêté à mi-fondu (la bête disparaît là, d'après le rendu).
2. Ligne de vue dans les quatre orientations de la caméra (élévation 35,264 degrés):
   part du temps de l'apogée où le centre de l'acteur est caché par un bâtiment, un arbre
   (tronc et houppier), un équipement haut ou un buisson, et la même chose pour les places
   des joueurs. Orientation 0 (par défaut): caméra au sud-est, regard vers le nord-ouest.
3. Cases et sols des points nouveaux (franchissable ou non, type de sol).

Usage: python3 -I moments_tour7_geometrie.py [chemin vers games/la-petite-ligne]
Bibliothèque standard uniquement.
"""

from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path

EL = math.radians(35.264)
TAN_EL = math.tan(EL)
SCREEN_RADIUS = 6.0  # M-02: seuil de distance (à l'écran chez les deux à tous les zooms)
M02_MIN = 3.4
DT = 0.05
# Direction horizontale vers la caméra, par orientation (0: caméra au sud-est).
ORIENTATIONS = {0: (1.0, 1.0), 1: (-1.0, 1.0), 2: (-1.0, -1.0), 3: (1.0, -1.0)}
ORIENTATION_NAMES = {0: "SE (défaut)", 1: "SO", 2: "NO", 3: "NE"}


# --- Carte ----------------------------------------------------------------------


@dataclass
class Occluder:
    name: str
    kind: str  # "box" ou "cyl"
    z0: float
    z1: float
    rect: tuple[float, float, float, float] = (0, 0, 0, 0)  # x0, y0, x1, y1
    center: tuple[float, float] = (0, 0)
    radius: float = 0.0

    def contains(self, x: float, y: float, z: float) -> bool:
        if z < self.z0 or z > self.z1:
            return False
        if self.kind == "box":
            x0, y0, x1, y1 = self.rect
            return x0 <= x < x1 and y0 <= y < y1
        return (x - self.center[0]) ** 2 + (y - self.center[1]) ** 2 < self.radius ** 2


@dataclass
class Map:
    width: int
    height: int
    ground: list[str]
    blocked: list[str]
    legend: dict[str, dict]
    points: dict[str, dict]
    occluders: list[Occluder] = field(default_factory=list)

    def cell(self, x: float, y: float) -> tuple[str, bool]:
        cx, cy = int(math.floor(x)), int(math.floor(y))
        if not (0 <= cx < self.width and 0 <= cy < self.height):
            return "?", True
        return self.ground[cy][cx], self.blocked[cy][cx] == "#"


def load_map(game: Path) -> Map:
    data = json.loads((game / "donnees" / "cartes" / "halte.json").read_text(encoding="utf-8"))
    types = data["types"]
    m = Map(
        width=data["taille"]["largeur"], height=data["taille"]["hauteur"],
        ground=data["terrain"]["lignes"], blocked=data["infranchissable"]["grille"],
        legend=data["terrain"]["legende"], points={p["id"]: p for p in data["points"]},
    )
    low = {"sol"}
    for o in data["objets"]:
        t = types[o["type"]]
        if t["categorie"] in low:
            continue
        r = o["rect"]
        h = float(t["hauteur"])
        if "occultation_arbre" in t:
            trunk = t["occultation_arbre"]["tronc"]
            crown = t["occultation_arbre"]["houppier"]
            m.occluders.append(Occluder(o["id"] + ":tronc", "cyl", trunk[1], trunk[2], center=(o["x"], o["y"]), radius=trunk[0] / 2))
            m.occluders.append(Occluder(o["id"] + ":houppier", "cyl", crown[1], crown[2], center=(o["x"], o["y"]), radius=crown[0] / 2))
        elif "occultation" in t:
            w, z0, z1 = t["occultation"]
            m.occluders.append(Occluder(o["id"], "cyl", z0, z1, center=(o["x"], o["y"]), radius=w / 2))
        else:
            m.occluders.append(Occluder(o["id"], "box", 0.0, h, rect=(r["x"], r["y"], r["x"] + r["w"], r["y"] + r["h"])))
    return m


def occluded_by(m: Map, x: float, y: float, z: float, orientation: int, extra: list[Occluder] | None = None) -> str | None:
    """Premier obstacle sur le rayon qui va du point vers la caméra (pas de 5 cm, 20 m au plus)."""
    hx, hy = ORIENTATIONS[orientation]
    n = math.hypot(hx, hy)
    hx, hy = hx / n, hy / n
    obstacles = m.occluders + (extra or [])
    r = 0.15
    while r < 20.0:
        px, py, pz = x + hx * r, y + hy * r, z + r * TAN_EL
        if pz > 9.5:
            return None
        for o in obstacles:
            if o.contains(px, py, pz):
                return o.name
        r += 0.05
    return None


# --- Chorégraphies (copie de `sampleResolved`, src/etat/moments.ts) ----------------


def catmull(p0: float, p1: float, p2: float, p3: float, u: float) -> float:
    u2, u3 = u * u, u * u * u
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)


def resolve(frames: list[list], start: tuple[float, float, float]) -> list[tuple[float, float, float]]:
    out, last = [], start
    for f in frames:
        last = (f[1] if f[1] is not None else last[0], f[2] if f[2] is not None else last[1], f[3])
        out.append(last)
    return out


def sample(frames: list[list], pts: list[tuple[float, float, float]], t: float) -> tuple[float, float, float]:
    if t <= frames[0][0] or len(frames) == 1:
        return pts[0]
    i = 0
    while i < len(frames) - 2 and frames[i + 1][0] <= t:
        i += 1
    a, b = frames[i], frames[i + 1]
    if t >= b[0] and i == len(frames) - 2:
        return pts[i + 1]
    span = b[0] - a[0]
    u = 1.0 if span <= 0 else min(1.0, max(0.0, (t - a[0]) / span))
    pp = pts[i - 1] if i - 1 >= 0 else pts[i]
    pn = pts[i + 2] if i + 2 < len(pts) else pts[i + 1]
    pa, pb = pts[i], pts[i + 1]
    return tuple(catmull(pp[k], pa[k], pb[k], pn[k], u) for k in range(3))  # type: ignore[return-value]


@dataclass
class Check:
    id: str
    seconds: float
    target: tuple[float, float]
    radius: float
    min_radius: float
    track: list[list]  # images clés de l'acteur principal [t, x, y, z, clip]
    height: float  # hauteur de l'acteur (m): on vise son milieu
    fade_last: float = 0.0
    places: list[tuple[float, float]] | None = None  # places imposées (sinon: l'anneau)
    visible_windows: list[tuple[float, float]] | None = None  # acteur présent seulement dans ces fenêtres (étoiles)
    extra_tracks: list[list[list]] = field(default_factory=list)  # autres acteurs comptés pour M-02


def ring_cells(m: Map, c: Check) -> list[tuple[float, float]]:
    if c.places is not None:
        return c.places
    out = []
    tx, ty = c.target
    for cy in range(int(math.floor(ty - c.radius)), int(ty + c.radius) + 1):
        for cx in range(int(math.floor(tx - c.radius)), int(tx + c.radius) + 1):
            p = (cx + 0.5, cy + 0.5)
            d = math.hypot(p[0] - tx, p[1] - ty)
            if d > c.radius or d < c.min_radius:
                continue
            if m.cell(*p)[1]:
                continue
            out.append(p)
    return out


def m02(m: Map, c: Check) -> tuple[float, tuple[float, float], int]:
    tracks = [c.track] + c.extra_tracks
    resolved = [resolve(tr, (tr[0][1], tr[0][2], tr[0][3])) for tr in tracks]
    end = c.seconds - c.fade_last / 2  # la bête disparaît à mi-fondu
    cells = ring_cells(m, c)
    worst, worst_cell = math.inf, (0.0, 0.0)
    for p in cells:
        inside = 0.0
        t = 0.0
        while t <= end + 1e-9:
            if c.visible_windows is None or any(a <= t <= b for a, b in c.visible_windows):
                for tr, pts in zip(tracks, resolved):
                    x, y, _ = sample(tr, pts, t)
                    if math.hypot(x - p[0], y - p[1]) <= SCREEN_RADIUS:
                        inside += DT
                        break
            t += DT
        if inside < worst:
            worst, worst_cell = inside, p
    return worst, worst_cell, len(cells)


def screen_pos(dx: float, dy: float, z: float) -> tuple[float, float]:
    """Position à l'écran (m) d'un point décalé de (dx, dy) au sol et à z de haut, orientation 0."""
    sx = (dx - dy) / math.sqrt(2)
    sy = -(dx + dy) / math.sqrt(2) * math.sin(EL) + z * math.cos(EL)
    return sx, sy


# Cadres des zooms (16:9, `camera.viewWidths` de src/rendu/reglages.ts), centrés sur le pied du
# joueur (`focus` de camera.ts), moins une marge pour le HUD. Le zoom 1 est le zoom de départ
# (`initialZoom: 1`, 24 m de large); le zoom 0 est le plus serré.
FRAMES = {"zoom 0 (16 m)": (8.0 - 0.4, 4.5 - 0.4), "zoom 1 (24 m, départ)": (12.0 - 0.5, 6.75 - 0.5)}


def onscreen(m: Map, c: Check, track: list[list], frame: tuple[float, float]) -> tuple[float, tuple[float, float]]:
    """Pire temps (s) où l'acteur est dans le cadre, orientation 0, caméra sur le joueur."""
    half_w, half_h = frame
    pts = resolve(track, (track[0][1], track[0][2], track[0][3]))
    end = c.seconds - c.fade_last / 2
    worst, worst_cell = math.inf, (0.0, 0.0)
    for p in ring_cells(m, c):
        inside, t = 0.0, 0.0
        while t <= end + 1e-9:
            if track[0][0] <= t and (c.visible_windows is None or any(a <= t <= b for a, b in c.visible_windows)):
                x, y, z = sample(track, pts, t)
                sx, sy = screen_pos(x - p[0], y - p[1], z + c.height / 2)
                if abs(sx) <= half_w and abs(sy) <= half_h:
                    inside += DT
            t += DT
        if inside < worst:
            worst, worst_cell = inside, p
    return worst, worst_cell


def hidden_share(m: Map, c: Check, orientation: int) -> tuple[float, str | None]:
    pts = resolve(c.track, (c.track[0][1], c.track[0][2], c.track[0][3]))
    end = c.seconds - c.fade_last / 2
    t, total, hidden = 0.0, 0, 0
    culprit: str | None = None
    while t <= end + 1e-9:
        if c.visible_windows is None or any(a <= t <= b for a, b in c.visible_windows):
            x, y, z = sample(c.track, pts, t)
            who = occluded_by(m, x, y, z + c.height / 2, orientation)
            total += 1
            if who is not None:
                hidden += 1
                culprit = culprit or who
        t += DT
    return (hidden / total if total else 0.0), culprit


# --- Les six moments joués (moments.json) -----------------------------------------


def existing_checks(game: Path, m: Map) -> list[Check]:
    data = json.loads((game / "donnees" / "moments.json").read_text(encoding="utf-8"))
    main = {"heron": ("heron", 0.95), "geese": ("goose", 0.4), "ladder": ("basile", 1.7),
            "tits": ("tit_a", 0.12), "fox": ("fox", 0.4), "glowworms": ("glowworms", 0.3)}
    out = []
    for d in data["moments"]:
        actor, h = main[d["id"]]
        w = d["watch"]
        p = m.points[d["anchor"]]
        target = (p["x"], p["y"])
        if w["target"] != "anchor":
            target = (m.points[d["anchor"]]["x"], m.points[d["anchor"]]["y"])
        places = None
        if w.get("hold"):
            places = [(m.points[h_]["x"], m.points[h_]["y"]) for h_ in w["hold"]]
        others = [tr for name, tr in d["climax"]["keyframes"].items() if name != actor]
        out.append(Check(d["id"], d["climax"]["seconds"], target, w["radius"], w["minRadius"],
                         d["climax"]["keyframes"][actor], h, d["climax"].get("fadeLastSeconds", 0.0), places,
                         extra_tracks=others))
    return out


# --- Les six moments du tour 7 (images clés des fiches 1.4.7 à 1.4.12) ---------------

ROE_GRAZE = (58.0, 27.0)
FAWN_BED = (59.4, 25.9)
KF_POST = (46.1, 39.9)
MIST_ANCHOR = (29.5, 40.5)
MIST_PLACES = [(29.5, 38.5), (29.5, 42.5), (28.5, 38.5), (30.5, 42.5), (31.5, 38.5), (27.5, 42.5)]
STARS_ANCHOR = (45.0, 40.6)
STARS_SEATS = [(44.55, 39.8), (45.45, 39.8)]
WALTZ_FLOOR = (33.4, 25.6)
WALTZ_PLACES = [(33.0, 25.6), (33.8, 25.6)]
CROSSING = (18.5, 13.5)
CRANKS = [(15.6, 11.5), (21.4, 15.5)]

# Chevrette: elle reste à son point jusqu'à 6,8 s; le faon, couché à 1,8 m d'elle dans l'herbe
# haute (au nord-est: l'axe horizontal de l'écran en orientation 0), se lève et vient téter.
ROE_TRACK = [
    [0.0, 58.0, 27.0, 0.0, "deer_call"],
    [1.6, 58.0, 27.0, 0.0, "deer_watch_fawn"],
    [4.6, 58.0, 27.0, 0.0, "deer_lick"],
    [6.8, 58.0, 27.0, 0.0, "deer_walk"],
    [7.6, 59.2, 27.0, 0.0, "deer_bound"],
    [8.4, 60.9, 27.1, 0.0, "deer_bound"],
    [9.2, 62.4, 27.2, 0.0, "deer_bound"],
]
FAWN_TRACK = [
    [0.0, 59.4, 25.9, -0.3, "hidden"],
    [1.0, 59.4, 25.9, -0.3, "fawn_rustle"],
    [1.6, 59.4, 25.9, 0.0, "fawn_rise"],
    [2.4, 59.3, 26.1, 0.0, "fawn_trot"],
    [3.6, 58.8, 26.5, 0.0, "fawn_trot"],
    [4.6, 58.5, 26.7, 0.0, "fawn_suckle"],
    [6.8, 58.5, 26.7, 0.0, "fawn_trot"],
    [7.6, 59.4, 26.5, 0.0, "fawn_bound"],
    [8.4, 61.0, 26.6, 0.0, "fawn_bound"],
    [9.2, 62.4, 26.7, 0.0, "fawn_bound"],
]
KF_TRACK = [
    [0.0, 46.1, 39.9, 0.97, "kf_perch"],
    [1.0, 46.1, 39.9, 0.97, "kf_dive"],
    [1.3, 46.6, 40.6, 0.0, None],
    [1.8, 46.6, 40.6, 0.0, "kf_fly"],
    [2.1, 46.4, 40.3, 0.5, None],
    [2.4, 46.1, 39.9, 0.97, "kf_beat"],
    [3.6, 46.1, 39.9, 0.97, "kf_swallow"],
    [4.1, 46.1, 39.9, 0.97, "kf_perch"],
    [4.8, 46.1, 39.9, 0.97, "kf_fly"],
    [5.3, 43.0, 40.3, 0.4, "kf_fly"],
    [5.8, 39.0, 40.3, 0.4, "kf_fly"],
]
MIST_TRACK = [[0.0, 29.5, 40.5, 0.0, "mist_lift"], [9.0, 29.5, 40.5, 0.0, None]]
# Étoiles filantes: chaque traînée est un acteur visible dans sa fenêtre; on suit le point lumineux.
STAR_TRACKS = [
    [[0.0, 42.5, 41.0, 0.0, "streak"], [0.6, 44.0, 42.2, 0.0, None]],
    [[2.4, 47.8, 40.8, 0.0, "streak"], [3.0, 46.2, 42.4, 0.0, None]],
    [[4.5, 41.8, 40.7, 0.0, "bolide"], [5.9, 47.6, 42.6, 0.0, None]],
    [[7.6, 45.2, 40.9, 0.0, "streak"], [8.2, 43.6, 42.5, 0.0, None]],
    [[9.4, 46.0, 40.6, 0.0, "streak"], [10.0, 47.4, 41.9, 0.0, None]],
]
STAR_WINDOWS = [(0.0, 0.6), (2.4, 3.0), (4.5, 6.9), (7.6, 8.2), (9.4, 10.0)]  # le bolide laisse 1 s de traînée
WALTZ_TRACK = [[0.0, 33.4, 25.6, 0.0, "waltz"], [16.0, 33.4, 25.6, 0.0, None]]
ODETTE_TRACK = [[0.0, 30.6, 26.3, 0.0, "odette_needle"], [16.0, 30.6, 26.3, 0.0, None]]
# Train: la cabine de la locomotive (côté sud, où se penche le mécanicien), départ « au pas ».
TRAIN_CAB = [
    [0.0, 44.5, 14.8, 2.6, "train_depart"],
    [2.0, 43.5, 14.8, 2.6, None],
    [4.0, 40.5, 14.8, 2.6, None],
    [6.0, 35.5, 14.8, 2.6, None],
    [8.0, 29.5, 14.8, 2.6, None],
    [9.5, 25.0, 14.8, 2.6, "driver_wave"],
    [11.0, 21.6, 14.8, 2.6, None],
    [12.5, 19.0, 14.8, 2.6, None],
    [14.0, 16.6, 14.8, 2.6, "driver_lean"],
    [15.5, 13.6, 14.8, 2.6, None],
    [17.0, 9.0, 14.8, 2.6, None],
    [18.5, 2.0, 14.8, 2.6, None],
    [20.0, -8.0, 14.8, 2.6, None],
]
TRAIN_STOKER = [[t, x, 12.2, z, c] for t, x, _, z, c in TRAIN_CAB]  # le chauffeur, côté nord


def new_checks() -> list[Check]:
    return [
        Check("roe_deer", 9.2, ROE_GRAZE, 5.5, 3.0, ROE_TRACK, 0.7, 0.8, extra_tracks=[FAWN_TRACK]),
        Check("roe_deer, faon seul (info)", 9.2, ROE_GRAZE, 5.5, 3.0, FAWN_TRACK, 0.45, 0.8),
        Check("kingfisher", 5.8, KF_POST, 5.5, 2.5, KF_TRACK, 0.17, 0.4),
        Check("mist", 9.0, MIST_ANCHOR, 6.0, 0.0, MIST_TRACK, 1.0, 0.0, MIST_PLACES),
        Check("falling_stars", 10.0, STARS_ANCHOR, 3.0, 0.0, STAR_TRACKS[0], 0.0, 0.0, STARS_SEATS,
              STAR_WINDOWS, STAR_TRACKS[1:]),
        Check("odette_waltz", 16.0, WALTZ_FLOOR, 3.0, 0.0, WALTZ_TRACK, 1.6, 0.0, WALTZ_PLACES, extra_tracks=[ODETTE_TRACK]),
        Check("train_salute", 20.0, CROSSING, 4.0, 0.0, TRAIN_CAB, 0.6, 0.5, CRANKS, extra_tracks=[TRAIN_STOKER]),
    ]


NEW_POINTS = {
    "roe_deer_edge": (62.2, 27.0),
    "roe_deer_graze": ROE_GRAZE,
    "fawn_bed": FAWN_BED,
    "kingfisher_post": KF_POST,
    "kingfisher_dive": (46.6, 40.6),
    "mist_narrows": MIST_ANCHOR,
    "mist_bank_north": (29.5, 38.5),
    "mist_bank_south": (29.5, 42.5),
    "pontoon_seat_west": STARS_SEATS[0],
    "pontoon_seat_east": STARS_SEATS[1],
    "waltz_floor": WALTZ_FLOOR,
    "waltz_a": WALTZ_PLACES[0],
    "waltz_b": WALTZ_PLACES[1],
    "odette_phonograph": (31.2, 26.0),
    "gate_north_crank": CRANKS[0],
    "gate_south_crank": CRANKS[1],
}

# Points écartés au tour 7 (lieu de la chevrette prévu au tour 6) et pourquoi.
REJECTED = {
    "roe_deer_graze du tour 6 (52,5 ; 4,5)": (52.5, 4.5, 0.35),
    "bande au nord-ouest du chêne (49,0 ; 3,2)": (49.0, 3.2, 0.35),
    "contre la maison de Firmin (48,6 ; 6,5)": (48.6, 6.5, 0.35),
}


def main() -> None:
    game = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[4] / "games" / "la-petite-ligne"
    m = load_map(game)

    print("== 1. Points nouveaux: case, sol, franchissable ==")
    for pid, (x, y) in NEW_POINTS.items():
        g, blocked = m.cell(x, y)
        name = m.legend.get(g, {}).get("nom", g)
        print(f"{pid:20} ({x:5.2f} ; {y:5.2f})  case ({int(x)}, {int(y)}) '{g}' {name}, {'bloquée' if blocked else 'libre'}")
    print()

    print("== 2. M-02: pire temps à moins de 6 m (anneau ou places imposées), décompte arrêté à mi-fondu ==")
    print("moment | cases ou places | pire (s) | case du pire | verdict (3,4 s)")
    for c in existing_checks(game, m) + new_checks():
        worst, cell, n = m02(m, c)
        print(f"{c.id:28} | {n:3} | {worst:4.2f} | ({cell[0]:.1f} ; {cell[1]:.1f}) | {'tenu' if worst >= M02_MIN - 1e-9 else 'NON TENU'}")
    print()

    print("== 2 bis. Acteur principal dans le cadre, orientation 0, caméra sur le joueur: pire temps de l'apogée ==")
    print("moment | durée vue | " + " | ".join(FRAMES))
    for c in existing_checks(game, m) + new_checks():
        cells = []
        for frame in FRAMES.values():
            worst, cell = onscreen(m, c, c.track, frame)
            cells.append(f"{worst:5.2f} s, pire depuis ({cell[0]:.1f} ; {cell[1]:.1f})")
        print(f"{c.id:28} | {c.seconds - c.fade_last / 2:4.1f} s | " + " | ".join(cells))
    print()

    print("== 3. Ligne de vue de l'acteur principal pendant l'apogée (part du temps caché, premier obstacle) ==")
    print("moment | " + " | ".join(ORIENTATION_NAMES[k] for k in range(4)))
    for c in existing_checks(game, m) + new_checks():
        cells = []
        for k in range(4):
            share, who = hidden_share(m, c, k)
            cells.append(f"{share:4.0%}" + (f" ({who})" if who else ""))
        print(f"{c.id:28} | " + " | ".join(cells))
    print()

    print("== 4. Places des joueurs: cachées en orientation 0 (hauteur des yeux 1,5 m, puis 0,9 m) ==")
    for pid in ("mist_bank_north", "mist_bank_south", "pontoon_seat_west", "pontoon_seat_east", "waltz_a", "waltz_b",
                "gate_north_crank", "gate_south_crank"):
        x, y = NEW_POINTS[pid]
        print(f"{pid:20} " + ", ".join(f"z {z}: {occluded_by(m, x, y, z, 0) or 'visible'}" for z in (1.5, 0.9)))
    train_box = [Occluder("train", "box", 0.0, 4.2, rect=(-10.0, 12.1, 50.7, 14.9))]
    print(f"{'gate_north_crank':20} pendant le passage du train: {occluded_by(m, *CRANKS[0], 1.5, 0, train_box) or 'visible'}"
          " (découpe obligatoire du rendu, règle de la carte)")
    print()

    print("== 5. Lieux écartés pour la chevrette (centre du corps à 0,35 m), orientation 0 ==")
    for label, (x, y, z) in REJECTED.items():
        print(f"{label}: {occluded_by(m, x, y, z, 0) or 'visible'}")
    for label, (x, y) in (("roe_deer_graze du tour 7", ROE_GRAZE), ("fawn_bed", FAWN_BED)):
        print(f"{label}: {occluded_by(m, x, y, 0.35, 0) or 'visible'}")


if __name__ == "__main__":
    main()
