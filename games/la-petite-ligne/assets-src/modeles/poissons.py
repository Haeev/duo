"""Poissons de la pêche 0.12 (22 espèces) et vieille épuisette du ponton.

Lancer: duo-python poissons.py [--sans-planches]
Produit: assets/modeles/poissons.glb, stats/poissons.json,
         docs/jeux/jeu-1/gauntlet/captures/v0-12/poissons.webp (de près, profil et trois quarts dessus),
         docs/jeux/jeu-1/gauntlet/captures/v0-12/poissons-echelle.webp (taille réelle, mannequin de 1,80 m).

Un seul constructeur paramétrique (`build_fish`) pour toutes les espèces: corps lofté de sections en
super-ellipse (dos et ventre indépendants, ventre plat des poissons de fond), opercule en léger
ressaut, nageoires en plaques épaisses au contour arrondi, yeux, barbillons, taches et écailles
plaquées sur les facettes réelles (lancer de rayons), bandes de couleur portées par des anneaux du
corps (rayures de la perche). Couleurs unies de la palette commune, aucune case ajoutée.

Conventions (glTF): tête vers +Z, dos vers +Y. Chaque poisson est construit à la longueur médiane
de sa fourchette (`length_m`); le jeu le met à l'échelle `longueur tirée / length_m` autour de
l'origine. Origine = prise d'une main, sur l'axe du corps à 38 % de la longueur depuis le museau
(juste derrière les nageoires pectorales): mise à l'échelle et main restent d'accord. Deux repères
enfants: `<nœud>_tail` (deuxième main, au pédoncule de la queue) et `<nœud>_mouth` (bout du museau,
où la ligne accroche le poisson).
"""
import math
import os
import random
import tempfile
import sys

import bpy  # noqa: I001
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

ICI = os.path.dirname(os.path.abspath(__file__))
CAPTURES = os.path.normpath(os.path.join(ICI, "..", "..", "..", "..", "docs", "jeux", "jeu-1", "gauntlet",
                                         "captures", "v0-12"))
GRIP = 0.38  # place de la prise, en fraction de la longueur depuis le museau

# Forme commune; chaque espèce ne donne que ce qui change. Longueurs en fraction de la longueur totale.
BASE = dict(
    sides=8, rings=7, depth=0.22, width=0.12, bias=0.0, peak=0.36, wpeak=None, snout=0.2, wsnout=None,
    head_a=0.8, tail_b=1.0, tp=0.81, ped=0.32, wped=None, p=2.0, snout_dz=0.0, nose=-0.012, opercle=0.2,
    back="fish_back", side="fish_silver", belly="fish_belly", v_back=0.45, v_belly=-0.5, mouth=None,
    fin="fish_back", fin_low=None, tail_color=None, eye_iris="paint_cream", eye=(0.1, 0.35, 0.05),
    tail="fork", tail_h=0.12, dorsal=[(0.42, 0.54, 0.13, "tri", None)], anal=[(0.64, 0.73, 0.09, "tri", None)],
    adipose=None, pectoral=(0.2, -40, 0.15, 0.55, 30), pelvic=(0.47, -72, 0.11, 0.5, 25), barbels=[],
    bands=[], decals=[], fin_th=0.012,
)

# id, nom, rareté, longueurs (cm), forme et couleurs (voir la table 3.1 de peche-0-12-conception.md)
SPECIES = [
    ("gudgeon", "goujon", "common", (8, 15), dict(
        depth=0.19, width=0.15, bias=0.28, peak=0.3, snout=0.24, ped=0.34, back="fish_olive", side="fish_silver",
        fin="fish_olive", eye=(0.1, 0.4, 0.055), dorsal=[(0.36, 0.48, 0.14, "tri", None)],
        anal=[(0.63, 0.71, 0.08, "tri", None)], tail_h=0.11,
        barbels=[(0.035, -55, 0.08, (0.15, -0.85, 0.35))],
        decals=[("row", "rock_dark", 0.3, 0.76, 2, 7, 0.026, 1.4), ("scatter", "rock_dark", 0.2, 0.7, 45, 80, 6,
                                                                   0.014, 1.0, 3, None)])),
    ("minnow", "vairon", "common", (5, 10), dict(
        depth=0.21, width=0.14, bias=0.06, snout=0.3, ped=0.36, back="fish_olive", side="heron_leg",
        belly="goose_leg", v_belly=-0.45, fin="heron_leg", eye=(0.1, 0.32, 0.06),
        dorsal=[(0.5, 0.6, 0.13, "tri", None)], anal=[(0.64, 0.73, 0.09, "tri", None)],
        decals=[("row", "rock_dark", 0.28, 0.78, 6, 8, 0.03, 1.2)])),
    ("stone_loach", "loche franche", "common", (6, 12), dict(
        depth=0.14, width=0.13, bias=0.12, peak=0.28, snout=0.38, head_a=0.6, tp=0.86, ped=0.62, wped=0.32,
        back="bark", side="soil_tilled_light", belly="sand", fin="soil_tilled_light", eye=(0.09, 0.55, 0.04),
        dorsal=[(0.45, 0.56, 0.11, "round", None)], anal=[(0.69, 0.76, 0.07, "round", None)], tail="trunc",
        tail_h=0.09, pectoral=(0.18, -45, 0.13, 0.6, 35), pelvic=(0.48, -75, 0.09, 0.5, 25),
        barbels=[(0.012, -20, 0.05, (0.3, -0.6, 0.5)), (0.02, -50, 0.05, (0.45, -0.7, 0.4)),
                 (0.03, -75, 0.045, (0.35, -0.85, 0.25))],
        decals=[("scatter", "bark_dark", 0.12, 0.84, 5, 75, 14, 0.03, 1.2, 7, None)])),
    ("bleak", "ablette", "common", (10, 18), dict(
        depth=0.19, width=0.1, bias=-0.06, peak=0.36, snout=0.14, ped=0.28, snout_dz=0.035, back="tin_paint",
        side="fish_silver", fin="fish_belly", tail_color="fish_back", eye=(0.1, 0.25, 0.065),
        dorsal=[(0.5, 0.58, 0.11, "tri", None)], anal=[(0.6, 0.77, 0.075, "long", None)], tail_h=0.13)),
    ("roach", "gardon", "common", (12, 30), dict(
        depth=0.28, width=0.12, bias=0.05, peak=0.38, snout=0.17, ped=0.3, fin="fish_back", fin_low="fox_red",
        eye_iris="trout_spot", eye=(0.1, 0.3, 0.055), dorsal=[(0.43, 0.55, 0.15, "tri", None)],
        anal=[(0.63, 0.72, 0.1, "tri", None)], tail_h=0.14)),
    ("chub", "chevesne", "common", (20, 50), dict(
        depth=0.22, width=0.16, peak=0.33, snout=0.34, head_a=0.6, ped=0.38, back="rock_dark", side="fish_silver",
        fin="rock_dark", fin_low="goose_bill", mouth="rock_dark", eye=(0.09, 0.35, 0.045),
        dorsal=[(0.43, 0.54, 0.12, "tri", None)], anal=[(0.64, 0.73, 0.1, "round", None)], tail_h=0.13,
        pectoral=(0.2, -40, 0.13, 0.55, 30))),
    ("trout", "truite fario", "rare", (20, 45), dict(
        sides=10, rings=6, depth=0.21, width=0.12, bias=0.05, snout=0.2, tp=0.83, ped=0.35, back="fish_olive",
        side="heron_leg", belly="log_end", fin="fish_olive", fin_low="owl_buff", eye_iris="brass",
        eye=(0.09, 0.4, 0.045), dorsal=[(0.42, 0.54, 0.12, "tri", None)], anal=[(0.66, 0.74, 0.09, "tri", None)],
        adipose=(0.75, 0.79, "trout_spot"), tail="emarg", tail_h=0.12,
        decals=[("scatter", "trout_spot", 0.2, 0.74, -15, 35, 7, 0.022, 1.0, 11, "fish_belly"),
                ("scatter", "black", 0.16, 0.66, 40, 80, 8, 0.016, 1.0, 12, None)])),
    ("perch", "perche", "rare", (15, 35), dict(
        sides=8, rings=4, depth=0.27, width=0.13, bias=0.1, peak=0.38, snout=0.2, ped=0.3, back="ivy",
        side="tit_green", belly="fish_belly", fin="heron_grey_dark", fin_low="goose_bill", tail_color="fox_red",
        eye_iris="paint_yellow", eye=(0.1, 0.38, 0.05),
        dorsal=[(0.3, 0.5, 0.16, "spiny", ("black", 0.86, 0.5)), (0.53, 0.66, 0.11, "tri", "tit_green")],
        anal=[(0.64, 0.72, 0.09, "tri", None)], tail="emarg", tail_h=0.13,
        bands=[(a, a + 0.04, -0.2, 1.1, "leaf_fir") for a in (0.3, 0.39, 0.48, 0.57, 0.66, 0.74)])),
    ("dace", "vandoise", "rare", (15, 28), dict(
        sides=10, rings=7, depth=0.19, width=0.11, peak=0.36, snout=0.16, ped=0.29, back="lauze_dark",
        side="fish_silver", fin="lauze", fin_low="straw", eye_iris="straw", eye=(0.1, 0.32, 0.05),
        dorsal=[(0.45, 0.55, 0.13, "tri", None)], anal=[(0.63, 0.72, 0.08, "tri", None)], tail_h=0.13)),
    ("bullhead", "chabot", "rare", (8, 15), dict(
        sides=10, rings=7, depth=0.17, width=0.27, wpeak=0.16, bias=0.32, peak=0.2, snout=0.5, wsnout=0.62,
        head_a=0.4, tp=0.87, ped=0.36, wped=0.22, back="bark", side="soil_tilled_light", belly="paper_dark",
        fin="soil_tilled_light", eye=(0.1, 0.72, 0.06), eye_iris="brass",
        dorsal=[(0.3, 0.41, 0.08, "round", None), (0.43, 0.8, 0.11, "long", None)],
        anal=[(0.56, 0.8, 0.08, "long", None)], tail="round", tail_h=0.1,
        pectoral=(0.19, -15, 0.25, 0.85, 88), pelvic=(0.3, -80, 0.1, 0.5, 30),
        decals=[("scatter", "bark_dark", 0.1, 0.85, 0, 85, 12, 0.03, 1.3, 5, None)])),
    ("tench", "tanche", "rare", (20, 45), dict(
        sides=10, rings=7, depth=0.27, width=0.16, peak=0.4, snout=0.26, head_a=0.7, ped=0.5, back="ivy",
        side="moss", belly="owl_buff", fin="ivy", eye_iris="trout_spot", eye=(0.09, 0.38, 0.035),
        dorsal=[(0.42, 0.55, 0.15, "round", None)], anal=[(0.62, 0.72, 0.11, "round", None)], tail="trunc",
        tail_h=0.13, pelvic=(0.46, -72, 0.14, 0.6, 25), barbels=[(0.03, -45, 0.03, (0.2, -0.8, 0.4))])),
    ("barbel", "barbeau", "epic", (35, 70), dict(
        sides=10, rings=8, depth=0.19, width=0.15, bias=0.26, peak=0.33, snout=0.2, ped=0.3, snout_dz=-0.01,
        back="bark", side="heron_leg", belly="sand", fin="bark", fin_low="fox_red_dark", tail_color="fox_red_dark",
        eye_iris="brass", eye=(0.11, 0.55, 0.035), dorsal=[(0.4, 0.5, 0.16, "tri", None)],
        anal=[(0.66, 0.74, 0.11, "tri", None)], tail_h=0.14,
        barbels=[(0.008, -60, 0.08, (0.15, -0.8, 0.4)), (0.04, -55, 0.1, (0.25, -0.8, 0.35))])),
    ("pike", "brochet", "epic", (50, 95), dict(
        sides=10, rings=9, depth=0.16, width=0.12, bias=0.04, peak=0.5, snout=0.13, wsnout=0.42, head_a=1.0,
        tp=0.86, ped=0.45, back="ivy", side="fish_olive", belly="fish_belly", fin="fish_olive",
        fin_low="fox_red_dark", tail_color="fox_red_dark", eye_iris="paint_yellow", eye=(0.12, 0.6, 0.03),
        mouth="fish_belly", opercle=0.24,
        dorsal=[(0.63, 0.78, 0.12, "round", None)], anal=[(0.66, 0.79, 0.1, "round", None)], tail_h=0.12,
        pectoral=(0.25, -45, 0.1, 0.5, 30), pelvic=(0.52, -75, 0.09, 0.5, 25),
        decals=[("scatter", "grass_dry", 0.26, 0.82, -30, 60, 9, 0.02, 1.9, 21, None)])),
    ("grayling", "ombre commun", "epic", (25, 45), dict(
        sides=10, rings=8, depth=0.2, width=0.11, peak=0.36, snout=0.15, ped=0.3, back="lauze", side="heron_grey",
        fin="lauze", fin_low="heron_grey", eye_iris="brass", eye=(0.09, 0.35, 0.05),
        dorsal=[(0.3, 0.57, 0.2, "sail", "flower_violet")], anal=[(0.65, 0.73, 0.08, "tri", None)],
        adipose=(0.74, 0.78, "heron_grey_dark"), tail_h=0.13,
        decals=[("scatter", "black", 0.16, 0.42, 5, 55, 6, 0.016, 1.0, 31, None)])),
    ("brook_lamprey", "lamproie de Planer", "epic", (10, 16), dict(
        sides=8, rings=9, depth=0.1, width=0.085, v_back=0.15, peak=0.3, snout=0.72, head_a=0.4, tp=0.9, ped=0.45,
        nose=0.012, back="sepia_dark", side="sepia", belly="paper", mouth="shadow", fin="sepia",
        eye=(0.07, 0.4, 0.035), eye_iris="sepia_dark", opercle=0.06,
        dorsal=[(0.58, 0.71, 0.035, "long", None), (0.74, 0.92, 0.045, "long", None)],
        anal=[(0.8, 0.92, 0.03, "long", None)], tail="round", tail_h=0.04, pectoral=None, pelvic=None,
        decals=[("row", "black", 0.11, 0.22, 8, 7, 0.009, 1.0)])),
    ("bitterling", "bouvière", "epic", (5, 8), dict(
        depth=0.33, width=0.12, peak=0.4, snout=0.2, ped=0.3, back="fish_back", side="fish_silver",
        fin="fish_back", fin_low="radish", eye_iris="trout_spot", eye=(0.11, 0.3, 0.06),
        dorsal=[(0.44, 0.6, 0.12, "tri", None)], anal=[(0.6, 0.72, 0.1, "tri", None)], tail_h=0.14,
        decals=[("row", "kingfisher_teal", 0.5, 0.8, 4, 5, 0.03, 2.4)])),
    ("shad", "alose", "legendary", (35, 55), dict(
        sides=10, rings=9, depth=0.25, width=0.12, bias=-0.06, peak=0.36, snout=0.16, ped=0.26, back="paint_blue",
        side="fish_silver", belly="feather_white", fin="lauze_light", fin_low="fish_belly", eye=(0.1, 0.32, 0.05),
        dorsal=[(0.42, 0.52, 0.12, "tri", None)], anal=[(0.66, 0.77, 0.06, "long", None)], tail="deep",
        tail_h=0.15,
        decals=[("spot", "black", 0.22, 40, 0.035, 1.2), ("row", "black", 0.29, 0.5, 40, 4, 0.02, 1.0)])),
    ("mirror_carp", "carpe miroir", "legendary", (55, 85), dict(
        sides=10, rings=8, depth=0.3, width=0.17, bias=0.16, peak=0.4, snout=0.22, head_a=0.7, ped=0.36,
        back="fish_olive", side="heron_leg", belly="owl_buff", fin="bark", eye_iris="brass", eye=(0.09, 0.32, 0.035),
        dorsal=[(0.38, 0.7, 0.13, "carp", None)], anal=[(0.66, 0.74, 0.1, "tri", None)], tail_h=0.16,
        barbels=[(0.01, -60, 0.035, (0.2, -0.8, 0.45)), (0.03, -55, 0.04, (0.3, -0.8, 0.4))],
        decals=[("scales", "brass", 0.26, 0.74, 70, 6), ("scales", "brass", 0.28, 0.72, 2, 5),
                ("scales", "brass", 0.4, 0.6, -40, 2)])),
    ("salmon", "saumon", "legendary", (70, 100), dict(
        sides=10, rings=9, depth=0.22, width=0.12, peak=0.38, snout=0.17, ped=0.24, back="lauze_dark",
        side="fish_silver", belly="feather_white", fin="lauze_dark", fin_low="fish_belly", eye_iris="brass",
        eye=(0.09, 0.36, 0.03), snout_dz=-0.012, dorsal=[(0.42, 0.53, 0.12, "tri", None)],
        anal=[(0.67, 0.75, 0.08, "tri", None)], adipose=(0.76, 0.79, "lauze_dark"), tail="trunc", tail_h=0.13,
        decals=[("scatter", "black", 0.16, 0.6, 30, 80, 10, 0.014, 1.0, 41, None)])),
    ("burbot", "lote", "legendary", (35, 60), dict(
        sides=10, rings=9, depth=0.14, width=0.12, bias=0.1, peak=0.27, snout=0.32, wsnout=0.48, head_a=0.6,
        tp=0.9, ped=0.36, wped=0.24, back="bark", side="heron_leg", belly="owl_buff", fin="bark",
        eye_iris="brass", eye=(0.08, 0.5, 0.035), opercle=0.18,
        dorsal=[(0.3, 0.38, 0.06, "round", None), (0.41, 0.88, 0.07, "long", None)],
        anal=[(0.48, 0.88, 0.065, "long", None)], tail="round", tail_h=0.08,
        pectoral=(0.19, -35, 0.11, 0.6, 35), pelvic=(0.15, -80, 0.08, 0.4, 25),
        barbels=[(0.02, -90, 0.06, (0.2, -0.95, 0.05))],
        decals=[("scatter", "bark_dark", 0.12, 0.86, -40, 80, 12, 0.03, 1.5, 51, None)])),
    ("golden_trout", "la Dorée", "mythic", (42, 48), dict(
        sides=12, rings=6, depth=0.22, width=0.125, bias=0.05, snout=0.2, tp=0.83, ped=0.35, back="bread_crust",
        side="flower_center", belly="log_end", v_back=0.55, fin="bread", fin_low="paint_cream", eye_iris="brass",
        eye=(0.09, 0.4, 0.045), dorsal=[(0.42, 0.55, 0.13, "tri", None)], anal=[(0.66, 0.74, 0.095, "tri", None)],
        adipose=(0.75, 0.79, "trout_spot"), tail="emarg", tail_h=0.125,
        decals=[("scatter", "trout_spot", 0.2, 0.74, -10, 35, 6, 0.02, 1.0, 61, "paint_cream"),
                ("scatter", "brass", 0.18, 0.7, 45, 80, 4, 0.013, 1.0, 62, None)])),
    ("moon_pike", "le Brochet de lune", "mythic", (110, 125), dict(
        sides=12, rings=9, depth=0.165, width=0.12, bias=0.04, peak=0.5, snout=0.13, wsnout=0.42, head_a=1.0,
        tp=0.86, ped=0.45, back="mattress_stripe", side="fish_silver", belly="feather_white", v_back=0.5,
        fin="lauze_light", fin_low="lauze_light", tail_color="lauze_light", eye_iris="water_foam",
        eye=(0.12, 0.6, 0.03), mouth="feather_white", opercle=0.24,
        dorsal=[(0.63, 0.78, 0.12, "round", None)], anal=[(0.66, 0.79, 0.1, "round", None)], tail_h=0.12,
        pectoral=(0.25, -45, 0.1, 0.5, 30), pelvic=(0.52, -75, 0.09, 0.5, 25),
        decals=[("scatter", "flower_white", 0.24, 0.82, -30, 65, 11, 0.018, 1.9, 71, None)])),
]

# Contours des nageoires impaires: (avancée le long de la base, hauteur relative); 0 = base dans le corps.
FIN_SHAPES = {
    "tri": [(0.0, 0.0), (0.18, 1.0), (0.45, 0.88), (1.08, 0.3), (1.0, 0.0)],
    "round": [(0.0, 0.0), (0.12, 0.75), (0.45, 1.0), (0.85, 0.85), (1.08, 0.35), (1.0, 0.0)],
    "spiny": [(0.0, 0.0), (0.1, 1.0), (0.32, 0.95), (0.58, 0.78), (0.85, 0.5), (1.0, 0.0)],
    "sail": [(0.0, 0.0), (0.08, 0.85), (0.4, 1.0), (0.9, 0.95), (1.12, 0.55), (1.0, 0.0)],
    "long": [(0.0, 0.0), (0.06, 0.8), (0.5, 1.0), (0.94, 0.85), (1.0, 0.0)],
    "carp": [(0.0, 0.0), (0.08, 1.15), (0.2, 0.75), (0.6, 0.6), (1.02, 0.42), (1.0, 0.0)],
}
TAIL_NOTCH = {"fork": 0.62, "deep": 0.5, "emarg": 0.88}


def env(s, peak, tp, s0, ped, a, b):
    """Enveloppe de 0 (museau) à tp (pédoncule): s0 au museau, 1 au plus large, ped au pédoncule."""
    if s <= peak:
        return s0 + (1 - s0) * math.sin(max(0.0, s) / peak * math.pi / 2) ** a
    u = min(1.0, (s - peak) / (tp - peak))
    return ped + (1 - ped) * math.cos(u * math.pi / 2) ** b


class Body:
    def __init__(self, P):
        self.P = P
        self.L = P["L"]

    def eh(self, s):
        P = self.P
        return env(s, P["peak"], P["tp"], P["snout"], P["ped"], P["head_a"], P["tail_b"])

    def ew(self, s):
        P = self.P
        return env(s, P["wpeak"] or P["peak"], P["tp"], P["wsnout"] or P["snout"], P["wped"] or P["ped"],
                   P["head_a"], P["tail_b"])

    def top(self, s):
        return self.L * self.P["depth"] / 2 * (1 + self.P["bias"]) * self.eh(s)

    def bot(self, s):
        return self.L * self.P["depth"] / 2 * (1 - self.P["bias"]) * self.eh(s)

    def hw(self, s):
        return self.L * self.P["width"] / 2 * self.ew(s)

    def zoff(self, s):
        pk = self.P["peak"]
        return self.L * self.P["snout_dz"] * max(0.0, 1 - s / pk) ** 2

    def y(self, s):
        return (s - GRIP) * self.L

    def point(self, s, theta, k=1.0):
        c, sn = math.cos(theta), math.sin(theta)
        e = 2 / self.P["p"]
        x = self.hw(s) * math.copysign(abs(c) ** e, c) * k
        h = self.top(s) if sn > 0 else self.bot(s)
        z = self.zoff(s) + h * math.copysign(abs(sn) ** e, sn) * k
        return Vector((x, self.y(s), z))

    def axis(self, s):
        return Vector((0.0, self.y(s), self.zoff(s)))


def ring_ts(P):
    tp, op = P["tp"], P["opercle"]
    ts = [0.0, 0.03, 0.075, op, op + 0.015]
    n = P["rings"]
    a = op + 0.05
    ts += [a + (tp - a) * i / (n - 1) for i in range(n)]
    for s0, s1, *_ in P["bands"]:
        ts += [s0, s1]
    ts = sorted(set(round(t, 4) for t in ts if 0 <= t <= tp))
    out = []
    for t in ts:
        keep_pair = abs(t - (op + 0.015)) < 1e-6
        if out and t - out[-1] < 0.012 and not keep_pair:
            # deux anneaux trop proches: garder le bord de bande ou de l'opercule
            if any(abs(t - b) < 1e-6 for bd in P["bands"] for b in bd[:2]):
                out[-1] = t
            continue
        out.append(t)
    return out


def body_color(P, B):
    """Couleur d'un point du corps (centre d'un quadrilatère: ses deux triangles gardent la même couleur)."""
    def f(c):
        s = c.y / B.L + GRIP
        if s < 0.004 and P["mouth"]:
            return P["mouth"]
        sc = min(max(s, 0.0), P["tp"])
        zr = c.z - B.zoff(sc)
        h = B.top(sc) if zr > 0 else B.bot(sc)
        v = zr / max(h, 1e-6)
        for s0, s1, vmin, vmax, col in P["bands"]:
            if s0 <= s <= s1 and vmin <= v <= vmax:
                return col
        if v > P["v_back"]:
            return P["back"]
        if v < P["v_belly"]:
            return P["belly"]
        return P["side"]
    return f


def solid(g, coords, faces, color):
    vs = [g.bm.verts.new(tuple(c)) for c in coords]
    fs = [g.bm.faces.new([vs[i] for i in f]) for f in faces]
    bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    g._finish(vs, color)
    return vs


def plate(g, O, A, Bv, pts, th, color):
    """Plaque d'épaisseur th: contour 2D (a, b) dans le plan (A, B) autour de O."""
    N = A.cross(Bv).normalized()
    n = len(pts)
    coords = [O + A * a + Bv * b + N * (th / 2) for a, b in pts] + [O + A * a + Bv * b - N * (th / 2) for a, b in pts]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
    return solid(g, coords, faces, color)


def frustum(g, base, axis, r1, r2, h, segs, color):
    """Tronc de cône plein de base `base` le long de `axis` (r2 = 0: cône pointu)."""
    axis = axis.normalized()
    ref = Vector((0, 0, 1)) if abs(axis.z) < 0.9 else Vector((1, 0, 0))
    u = axis.cross(ref).normalized()
    w = axis.cross(u)
    coords, faces = [], []
    for k in range(segs):
        a = 2 * math.pi * k / segs
        coords.append(base + (u * math.cos(a) + w * math.sin(a)) * r1)
    if r2 > 0:
        for k in range(segs):
            a = 2 * math.pi * k / segs
            coords.append(base + axis * h + (u * math.cos(a) + w * math.sin(a)) * r2)
        faces.append(list(range(segs)))
        faces.append(list(range(segs, 2 * segs)))
        faces += [[k, (k + 1) % segs, segs + (k + 1) % segs, segs + k] for k in range(segs)]
    else:
        coords.append(base + axis * h)
        faces.append(list(range(segs)))
        faces += [[k, (k + 1) % segs, segs] for k in range(segs)]
    return solid(g, coords, faces, color)


class Fish:
    def __init__(self, A, fid, name, rarity, cm, over):
        P = dict(BASE)
        P.update(over)
        P["L"] = (cm[0] + cm[1]) / 200.0
        self.P, self.fid, self.name, self.rarity, self.cm = P, fid, name, rarity, cm
        self.B = Body(P)
        self.g = A.geo()
        self.rnd = random.Random(fid)
        self.th = max(0.0025, P["fin_th"] * P["L"])

    # corps ----------------------------------------------------------------
    def body(self):
        P, B, g = self.P, self.B, self.g
        n = P["sides"]
        ts = ring_ts(P)
        op = P["opercle"]
        rings = []
        for t in ts:
            k = 1.06 if abs(t - op) < 1e-6 else 1.0
            rings.append([B.point(t, 2 * math.pi * j / n, k) for j in range(n)])
        nose = B.axis(0.0) + Vector((0, P["nose"] * B.L, 0))
        tail = B.axis(P["tp"]) + Vector((0, 0.004 * B.L, 0))
        coords = [v for r in rings for v in r] + [nose, tail]
        i_nose, i_tail = len(coords) - 2, len(coords) - 1

        def idx(i, j):
            return i * n + (j % n)
        tris = []
        for i in range(len(rings) - 1):
            for j in range(n):
                a, b, c, d = idx(i, j), idx(i, j + 1), idx(i + 1, j + 1), idx(i + 1, j)
                key = (coords[a] + coords[b] + coords[c] + coords[d]) / 4
                tris += [((a, b, c), key), ((a, c, d), key)]
        last = len(rings) - 1
        for j in range(n):
            t1 = (i_nose, idx(0, j + 1), idx(0, j))
            t2 = (i_tail, idx(last, j), idx(last, j + 1))
            tris.append((t1, sum((coords[k] for k in t1), Vector()) / 3))
            tris.append((t2, sum((coords[k] for k in t2), Vector()) / 3))
        # orientation vers l'extérieur: comparée à l'axe du corps au droit de la face
        out, keys = [], []
        for t, key in tris:
            keys.append(key)
            a, b, c = (coords[k] for k in t)
            nrm = (b - a).cross(c - a)
            cen = (a + b + c) / 3
            s = min(max(cen.y / B.L + GRIP, 0.03), P["tp"] - 0.03)
            ref = B.axis(s)
            if t[0] == i_nose and P["nose"] > 0:
                ref = B.axis(0.08)
            if nrm.dot(cen - ref) < 0:
                t = (t[0], t[2], t[1])
            out.append(t)
        self.coords, self.tris = coords, out
        self.bvh = BVHTree.FromPolygons(coords, out)
        vs = [g.bm.verts.new(tuple(c)) for c in coords]
        colof = body_color(P, B)
        face_col = {}
        for t, key in zip(out, keys):
            face_col[g.bm.faces.new([vs[k] for k in t])] = colof(key)
        g._finish(vs, lambda face: face_col[face])

    def hit(self, s, theta_deg, side):
        """Point de la surface à facettes vu depuis le dehors, et sa normale."""
        B = self.B
        th = math.radians(theta_deg)
        d = Vector((side * math.cos(th), 0, math.sin(th)))
        o = B.axis(s) + d * B.L
        loc, nrm, i, _ = self.bvh.ray_cast(o, -d)
        if loc is None:
            return None
        return loc, nrm.normalized(), i

    # nageoires ------------------------------------------------------------
    def median(self, s0, s1, h, shape, color, top=True):
        B = self.B
        pts = []
        for ds, dh in FIN_SHAPES[shape]:
            s = s0 + ds * (s1 - s0)
            sc = min(max(s, 0.0), self.P["tp"])
            if top:
                z = B.zoff(sc) + (B.top(sc) * 0.8 if dh == 0 else B.top(sc) * 0.92 + dh * h * B.L)
            else:
                z = B.zoff(sc) - (B.bot(sc) * 0.8 if dh == 0 else B.bot(sc) * 0.92 + dh * h * B.L)
            pts.append((B.y(s), z))
        plate(self.g, Vector((0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), pts, self.th, color)
        return pts

    def caudal(self):
        P, B = self.P, self.B
        tp = P["tp"]
        hc = P["tail_h"] * B.L
        sb = tp - 0.15 * (1 - tp)
        hb = 0.75 * min(B.top(sb), B.bot(sb))
        shape = P["tail"]
        if shape in TAIL_NOTCH:
            f = TAIL_NOTCH[shape]
            m = 0.5 * (1 + f) + 0.04
            uw = [(0.45, 0.6), (1.0, 1.0), (m, 0.48), (f, 0.0), (m, -0.48), (1.0, -1.0), (0.45, -0.6)]
        elif shape == "trunc":
            uw = [(0.45, 0.62), (0.95, 0.95), (1.0, 0.5), (1.0, -0.5), (0.95, -0.95), (0.45, -0.62)]
        else:
            uw = [(0.3, 0.8), (0.7, 0.85), (0.95, 0.5), (1.0, 0.0), (0.95, -0.5), (0.7, -0.85), (0.3, -0.8)]
        z0 = B.zoff(tp)
        pts = [(B.y(sb), z0 + hb)]
        pts += [(B.y(tp + u * (1 - tp)), z0 + w * hc) for u, w in uw]
        pts.append((B.y(sb), z0 - hb))
        plate(self.g, Vector((0, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1)), pts, self.th,
              P["tail_color"] or P["fin"])

    def paired(self, spec, color):
        if spec is None:
            return
        s, theta, ln, wid, out_deg = spec
        L = self.B.L
        shape = [(0.0, 0.0), (0.3, 0.0), (1.0, 0.35), (0.92, 0.7), (0.55, 0.92), (0.1, 0.55)]
        for side in (1, -1):
            r = self.hit(s, theta, side)
            if r is None:
                continue
            H, n, _ = r
            A0 = Vector((0, 1, 0))
            A = (A0 - n * A0.dot(n)).normalized()
            D = n.cross(A)
            if D.z > 0:
                D = -D
            a = math.radians(out_deg)
            Bv = (D * math.cos(a) + n * math.sin(a)).normalized()
            O = H - n * self.th
            pts = [(u * ln * L, w * ln * wid * L) for u, w in shape]
            plate(self.g, O, A, Bv, pts, self.th, color)

    def fins(self):
        P, B = self.P, self.B
        low = P["fin_low"] or P["fin"]
        for s0, s1, h, shape, extra in P["dorsal"]:
            col = P["fin"]
            mark = None
            if isinstance(extra, str):
                col = extra
            elif extra:
                mark = extra
            pts = self.median(s0, s1, h, shape, col, top=True)
            if mark:
                # tache sombre au bout de la première dorsale (perche): petite plaque collée sur la nageoire
                mc, fu, fv = mark
                y = B.y(s0 + fu * (s1 - s0))
                sc = s0 + fu * (s1 - s0)
                z = B.zoff(sc) + B.top(sc) * 0.92 + fv * h * B.L
                r = 0.18 * h * B.L
                for side in (1, -1):
                    o = Vector((side * (self.th / 2 + 0.0006), y, z))
                    plate(self.g, o, Vector((0, 1, 0)), Vector((0, 0, 1)),
                          [(r * math.cos(2 * math.pi * k / 6), r * 0.8 * math.sin(2 * math.pi * k / 6))
                           for k in range(6)], 0.0008, mc)
            del pts
        for s0, s1, h, shape, extra in P["anal"]:
            self.median(s0, s1, h, shape, extra or low, top=False)
        if P["adipose"]:
            s0, s1, col = P["adipose"]
            self.median(s0, s1, 0.035, "round", col, top=True)
        self.caudal()
        self.paired(P["pectoral"], low)
        self.paired(P["pelvic"], low)

    # tête -------------------------------------------------------------------
    def eyes(self):
        P = self.P
        s, v, r = P["eye"]
        rr = r * self.B.L / 2
        theta = math.degrees(math.asin(max(-1.0, min(1.0, v))))
        for side in (1, -1):
            h = self.hit(s, theta, side)
            if h is None:
                continue
            H, n, _ = h

            def col(face, n=n):
                return "black" if face.normal.dot(n) > 0.8 else P["eye_iris"]
            frustum(self.g, H - n * rr * 0.5, n, rr, rr * 0.62, rr * 0.82, 6, col)

    def barbels(self):
        B = self.B
        for s, theta, ln, d in self.P["barbels"]:
            for side in (1, -1):
                base = B.point(s, math.radians(theta) if side > 0 else math.pi - math.radians(theta), 0.85)
                direction = Vector((side * d[2], d[0], d[1] * 1.0)).normalized()
                r = max(0.0012, 0.0075 * B.L)
                frustum(self.g, base, direction, r, 0.0, ln * B.L, 5, self.P["fin_low"] or self.P["side"])

    # taches et écailles ------------------------------------------------------
    def decal(self, s, theta, side, r, color, elong=1.0, nv=6, lift=1.0):
        h = self.hit(s, theta, side)
        if h is None:
            return False
        loc, n, i = h
        a, b, c = (self.coords[k] for k in self.tris[i])
        e1 = Vector((0, 1, 0)) - n * n.y
        if e1.length < 1e-6:
            return False
        e1.normalize()
        e2 = n.cross(e1)
        off = max(0.0008, 0.003 * self.B.L) * lift

        def inside(p):
            for p0, p1 in ((a, b), (b, c), (c, a)):
                if (p1 - p0).cross(p - p0).dot(n) < -1e-9:
                    return False
            return True
        inc = (a + b + c) / 3
        center = loc
        for _ in range(10):
            ring = [center + (e1 * math.cos(2 * math.pi * k / nv) * elong + e2 * math.sin(2 * math.pi * k / nv)) * r
                    for k in range(nv)]
            if all(inside(p) for p in ring):
                break
            center = center.lerp(inc, 0.35)
            r *= 0.88
        else:
            return False
        vs = [self.g.bm.verts.new(tuple(p + n * off)) for p in ring]
        self.g.bm.faces.new(vs)
        self.g._finish(vs, color)
        return True

    def scale_decal(self, s, theta, side, color):
        """Grande écaille miroir: le triangle de facette touché, réduit et aux coins abattus."""
        h = self.hit(s, theta, side)
        if h is None:
            return
        loc, n, i = h
        tri = [self.coords[k] for k in self.tris[i]]
        cen = sum(tri, Vector()) / 3
        pts = []
        for k in range(3):
            p0, p1 = tri[k], tri[(k + 1) % 3]
            q0 = cen.lerp(p0, 0.72)
            q1 = cen.lerp(p1, 0.72)
            pts += [q0.lerp(q1, 0.18), q0.lerp(q1, 0.82)]
        off = max(0.0008, 0.003 * self.B.L)
        nrm = (tri[1] - tri[0]).cross(tri[2] - tri[0]).normalized()
        vs = [self.g.bm.verts.new(tuple(p + nrm * off)) for p in pts]
        self.g.bm.faces.new(vs)
        self.g._finish(vs, color)

    def decals(self):
        for d in self.P["decals"]:
            kind = d[0]
            for side in (1, -1):
                rnd = random.Random(f"{self.fid}-{side}-{d[1]}")
                if kind == "row":
                    _, col, s0, s1, theta, cnt, r, el = d
                    for k in range(cnt):
                        s = s0 + (s1 - s0) * k / max(1, cnt - 1)
                        self.decal(s, theta, side, r * self.B.L, col, el)
                elif kind == "spot":
                    _, col, s, theta, r, el = d
                    self.decal(s, theta, side, r * self.B.L, col, el)
                elif kind == "scatter":
                    _, col, s0, s1, t0, t1, cnt, r, el, seed, ring_col = d
                    for k in range(cnt):
                        s = s0 + (s1 - s0) * (k + rnd.uniform(0.15, 0.85)) / cnt
                        theta = rnd.uniform(t0, t1)
                        rr = r * self.B.L * rnd.uniform(0.8, 1.15)
                        if ring_col:
                            if self.decal(s, theta, side, rr * 1.45, ring_col, el):
                                self.decal(s, theta, side, rr, col, el, lift=1.8)
                        else:
                            self.decal(s, theta, side, rr, col, el)
                elif kind == "scales":
                    _, col, s0, s1, theta, cnt = d
                    for k in range(cnt):
                        s = s0 + (s1 - s0) * k / max(1, cnt - 1) + rnd.uniform(-0.015, 0.015)
                        self.scale_decal(s, theta + rnd.uniform(-6, 6), side, col)

    def build(self):
        self.body()
        self.fins()
        self.eyes()
        self.barbels()
        self.decals()
        return self.g


def fish_extras(f):
    B = f.B
    tail = B.axis(f.P["tp"] - 0.04)
    mouth = B.axis(0.0) + Vector((0, f.P["nose"] * B.L if f.P["nose"] < 0 else 0, 0))

    def gl(v):
        return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]
    return {"kind": "fish", "rarity": f.rarity, "length_m": round(B.L, 4), "length_cm": list(f.cm),
            "hold_tail": gl(tail), "mouth": gl(mouth)}, tail, mouth


# Épuisette ----------------------------------------------------------------------

def tube(g, pts, r, sides, color, closed=False):
    """Tube de section polygonale le long d'une polyligne (repère transporté, bouts fermés)."""
    n = len(pts)
    frames = []
    prev = None
    for i in range(n):
        if closed:
            t = (pts[(i + 1) % n] - pts[i - 1]).normalized()
        else:
            t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        if prev is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            u = t.cross(ref).normalized()
        else:
            u = (prev - t * prev.dot(t)).normalized()
        frames.append((u, t.cross(u)))
        prev = u
    coords = []
    for p, (u, w) in zip(pts, frames):
        for k in range(sides):
            a = 2 * math.pi * k / sides
            coords.append(p + (u * math.cos(a) + w * math.sin(a)) * r)
    faces = []
    segs = n if closed else n - 1
    for i in range(segs):
        i2 = (i + 1) % n
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append([i * sides + k, i * sides + k2, i2 * sides + k2, i2 * sides + k])
    if not closed:
        faces.append(list(range(sides)))
        faces.append(list(range((n - 1) * sides, n * sides)))
    return solid(g, coords, faces, color)


def landing_net(A):
    """Vieille épuisette du ponton: manche de frêne grisé, virole et cercle de fer, filet de corde.

    Origine à la main arrière (bout du manche); manche couché vers l'avant (-Y Blender, +Z glTF),
    cercle à plat au bout, filet qui pend dessous: la pose « tendue » sous un poisson.
    """
    g = A.geo()
    R, depth = 0.3, 0.46
    y_ferrule = -1.36
    g.cyl(0.017, 1.51, loc=(0, (0.15 + y_ferrule) / 2, 0), color="wood_old", segs=6, rot=(90, 0, 0))
    g.cyl(0.02, 0.025, loc=(0, 0.15, 0), color="wood_old_dark", segs=6, rot=(90, 0, 0))
    g.cyl(0.022, 0.09, loc=(0, y_ferrule - 0.02, 0), color="iron", segs=6, rot=(90, 0, 0))
    cy = y_ferrule - 0.06 - R
    hoop = [Vector((R * math.sin(2 * math.pi * k / 16), cy + R * math.cos(2 * math.pi * k / 16), 0)) for k in range(16)]
    tube(g, hoop, 0.009, 4, "iron", closed=True)
    # filet: huit cordes du cercle au fond, deux cordes de tour; poche arrondie qui pend
    levels = [(0.0, 1.0), (0.17, 0.9), (0.33, 0.68), (0.44, 0.34)]
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        pts = [Vector((R * f * math.sin(a), cy + R * f * math.cos(a), -depth * dz / 0.46 - 0.004))
               for dz, f in levels]
        pts.append(Vector((0, cy, -depth + 0.01)))
        tube(g, pts, 0.006, 4, "rope")
    for dz, f in levels[1:3]:
        ring = [Vector((R * f * math.sin(2 * math.pi * k / 12), cy + R * f * math.cos(2 * math.pi * k / 12),
                        -depth * dz / 0.46)) for k in range(12)]
        tube(g, ring, 0.006, 4, "rope", closed=True)
    g.sphere(0.022, loc=(0, cy, -depth + 0.01), color="rope", segs=6, rings=4)
    return g, Vector((0, cy, 0))


# Planches -------------------------------------------------------------------------

def label_text(fid, name, cm):
    return f"{name} ({cm[0]} à {cm[1]} cm)"


def board_close(entries, path, elevation, roll=0.0, res=(1800, 1125)):
    """Chaque poisson ramené à 1 m, tête à gauche, flanc gauche vers la caméra (de près);
    roll: le poisson roule autour de sa longueur et montre le dos (degrés)."""
    lpl.setup_render(res, 12)
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.world(lpl.hex_lin("#E4EAEE"), 1.0)
    lpl.sun((50, 0, -30), 3.0)
    cols = 5
    placed, labels = [], []
    for i, (ob, text, length) in enumerate(entries):
        c, r = i % cols, i // cols
        d = lpl.duplicate_tree(ob)
        d.hide_render = False
        for ch in d.children_recursive:
            ch.hide_render = False
        k = 1.0 / length
        d.scale = (k, k, k)
        d.rotation_euler = (0, math.radians(roll), math.radians(-90))
        d.location = (c * 1.45, 0, -r * 0.78)
        placed.append(d)
        el = math.radians(elevation)
        lb = lpl.label(text, (c * 1.45, -0.5 * math.cos(el), -r * 0.78 - 0.3), size=0.075,
                       rot=(90 - elevation, 0, 0))
        labels.append(lb)
    keep = {o.name for d in placed for o in [d] + list(d.children_recursive)}
    hidden = []
    for o in bpy.context.scene.objects:
        if o.type in ("MESH", "EMPTY") and o.name not in keep and not o.name.startswith("etiquette_"):
            if not o.hide_render:
                o.hide_render = True
                hidden.append(o)
    rows = (len(entries) + cols - 1) // cols
    cx = (cols - 1) * 1.45 / 2
    cz = -(rows - 1) * 0.78 / 2 - 0.05
    el = math.radians(elevation)
    cam = lpl.iso_camera((cx, 0, cz), 10, 0, elevation, 40)
    cam.data.ortho_scale = max(cols * 1.45 + 0.3, (rows * 0.78 + 0.3) * math.cos(el) * res[0] / res[1])
    for m in bpy.data.materials:
        if m.name.startswith("lpl_palette"):
            lpl.set_emission(m, 0.0)
    lpl.render(path)
    for d in placed:
        for o in [d] + list(d.children_recursive):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in labels:
        bpy.data.objects.remove(o, do_unlink=True)
    for o in hidden:
        o.hide_render = False


def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    fishes = []
    for fid, name, rarity, cm, over in SPECIES:
        f = Fish(A, fid, name, rarity, cm, over)
        g = f.build()
        node = "fish_" + fid
        extras, tail, mouth = fish_extras(f)
        ob = A.add(node, g, extras)
        lpl.empty(node + "_tail", parent=ob, loc=tuple(tail), size=0.03)
        lpl.empty(node + "_mouth", parent=ob, loc=tuple(mouth), size=0.03)
        fishes.append((ob, f))
    gnet, hoop = landing_net(A)
    net = A.add("landing_net", gnet, {"kind": "tool", "socket": "socket_hand_r", "length_m": 1.75,
                                      "hoop_diameter_m": 0.6,
                                      "note": "manche couché vers l'avant (+Z glTF), cercle à plat, filet qui pend; "
                                              "origine à la main arrière, landing_net_hand_l = main avant, "
                                              "landing_net_hoop = centre du cercle"})
    lpl.empty("landing_net_hand_l", parent=net, loc=(0, -0.55, 0), size=0.05)
    lpl.empty("landing_net_hoop", parent=net, loc=tuple(hoop), size=0.05)

    path = os.path.join(lpl.OUT, "poissons.glb")
    size = lpl.export_glb(path, A.all_objects(), animations=False)
    st = A.stats()
    lpl.write_stats("poissons", {"nodes": st, "animations": [], "file_bytes": size})
    bad = {k: v["tris"] for k, v in st.items() if k.startswith("fish_") and not 300 <= v["tris"] <= 600}
    print("POISSONS", size, {k: v["tris"] for k, v in st.items()})
    if bad:
        print("HORS BUDGET", bad)

    if "--sans-planches" in sys.argv or os.environ.get("LPL_SANS_PLANCHES"):
        return
    os.makedirs(CAPTURES, exist_ok=True)
    tmp = os.path.join(tempfile.gettempdir(), "lpl-poissons")  # rendus bruts, hors du dépôt
    os.makedirs(tmp, exist_ok=True)
    if "--echelle" not in sys.argv:
        entries = [(ob, label_text(f.fid, f.name, f.cm), f.B.L) for ob, f in fishes]
        board_close(entries, os.path.join(tmp, "profil.png"), 12)
        board_close(entries, os.path.join(tmp, "dessus.png"), 12, roll=60)
    # taille réelle: mannequin de 1,80 m (dans la grille, pour qu'il entre dans le cadre), poissons à leur
    # longueur médiane, épuisette
    gm = A.geo()
    gm.box((0.3, 0.05, 1.8), color="paper_dark", base=True)
    for h in range(1, 18):
        gm.box((0.34 if h % 5 == 0 else 0.32, 0.055, 0.008), loc=(0, 0, h * 0.1), color="shadow")
    dummy = gm.to_object("mannequin_1m80", mat)
    roots = [dummy] + [ob for ob, _ in fishes] + [net]

    def spacing(r):
        if r.name == "landing_net":
            return 2.0
        if r.name == "mannequin_1m80":
            return 0.6
        return max(0.35, r.get("length_m", 0.3) + 0.15)
    lpl.board(roots, os.path.join(tmp, "echelle.png"), cols=8, spacing=spacing, label_size=0.06,
              res=(1800, 1050), samples=12)


if __name__ == "__main__":
    main()
