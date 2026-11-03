"""Élevage de la 0.12 (docs/jeux/jeu-1/v0-12-conception.md, sections 4 et 6, lot L-rendu-modèles): chèvre
(deux robes, clips), clochette, piquet, chevrerie, poulailler agrandi, mangeoire à trémie, bidon de lait,
fromage frais, panier d'œufs.

Lancer: duo-python elevage.py
Produit: assets/modeles/elevage.glb, stats/elevage.json, blend/elevage.blend (planches: planche_v012.py)

Conventions de faune.py: la chèvre a son squelette (`goat`, os préfixés `goat_`), une peau rigide par pièce,
deux maillages enfants (`goat_chamois`, `goat_white`) à montrer l'un ou l'autre comme les robes de la poule;
clips sur place (la racine ne quitte pas l'origine), poses en rotations du repère du squelette (x: tangage,
positif = le bout de l'os vers l'avant descend; z: lacet vers la gauche de la bête).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402
import faune  # noqa: E402
from faune import R, Rig, ell, merge, seg, _legs, _gait  # noqa: E402

FPS = 30

# Chèvre (chevrette alpine): 0,72 m au garrot, 1,0 m du mufle à la croupe, tête portée à 0,95 m.
GOAT = {
    "p": "goat",
    "chest": ((0.165, 0.27, 0.2), (0, -0.12, 0.555), 3),
    "hips": ((0.158, 0.27, 0.185), (0, 0.16, 0.57), -2),
    "spine": ((0, 0.02, 0.57), (0, 0.42, 0.59), (0, -0.33, 0.59)),
    "neck": ((0, -0.28, 0.58), (0, -0.47, 0.875), 0.092, 0.064),
    "head": ((0.062, 0.088, 0.068), (0, -0.52, 0.91), 22),
    "muzzle": ((0, -0.56, 0.90), (0, -0.655, 0.853), (0, -0.67, 0.845), (0, -0.692, 0.831),
               0.047, 0.035, 0.031, 0.022),
    # oreilles portées de côté, presque à plat: la chèvre ne se confond pas avec la chevrette du pré
    "ear": (0.115, 0.058, (0.052, -0.49, 0.93), 74, -8, 30),
    "front": (0.078, (-0.30, 0.50), (-0.31, 0.33), (-0.305, 0.17), (-0.31, 0.035),
              (0.054, 0.038, 0.031, 0.025, 0.023, 0.021, 0.025)),
    "hind": (0.082, (0.30, 0.56), (0.23, 0.39), (0.35, 0.21), (0.325, 0.035), (0.046, 0.031, 0.023, 0.021, 0.025),
             ((0.064, 0.10, 0.13), (0.285, 0.47), -18)),
    "tail": ((0, 0.42, 0.62), (0, 0.47, 0.70), 0.026, 0.01),
}

# Robes: pelage, dessus (cou), dessous, bas des pattes, mufle, creux de l'oreille, cornes
COATS = {
    "goat_chamois": {"coat": "wood", "back": "fox_black", "belly": "wood_dark", "leg": "fox_black",
                     "muzzle": "fox_black", "ear_in": "plaster_rose", "horns": True},
    "goat_white": {"coat": "fox_white", "back": "fox_white", "belly": "goose_belly", "leg": "fox_white",
                   "muzzle": "plaster_rose", "ear_in": "plaster_rose", "horns": False},
}

NECK_T = 0.70   # place du collier le long du cou


def _neck_frame():
    n0, n1 = Vector(GOAT["neck"][0]), Vector(GOAT["neck"][1])
    d = (n1 - n0).normalized()
    c = n0 + (n1 - n0) * NECK_T
    # perpendiculaire au cou, vers le bas et l'avant (sous la gorge)
    down = Vector((0, -abs(d.z), -abs(d.y)))
    r = GOAT["neck"][2] + (GOAT["neck"][3] - GOAT["neck"][2]) * NECK_T
    return c, d, down.normalized(), r



def goat_mesh(A, robe):
    d, c = GOAT, COATS[robe]
    g = A.geo()
    p = "goat"
    coat, back, belly, leg = c["coat"], c["back"], c["belly"], c["leg"]

    def body(face):
        n = face.normal
        if n.z < -0.6:
            return belly
        return coat
    for part in ("chest", "hips"):
        semi, loc, tilt = d[part]
        ell(g, semi, loc, body, p + "_" + part, segs=12, rings=7, rot=(tilt, 0, 0))
    # cou et nuque (boule de raccord, comme la chevrette: pas de jour derrière la tête quand elle tourne)
    n0, n1, r0, r1 = d["neck"]
    seg(g, n0, n1, r0, r1, by_normal(back, coat, coat, thr=0.9), p + "_neck", segs=8)
    ell(g, (r1 * 1.02, r1 * 1.1, r1 * 1.05), n1, coat, p + "_neck", segs=8, rings=4)
    # collier de cuir et son anneau (la corde et la clochette s'y accrochent: socket_goat_neck)
    cc, cd, cdown, cr = _neck_frame()
    seg(g, tuple(cc - cd * 0.018), tuple(cc + cd * 0.018), cr * 1.16, cr * 1.16, "leather", p + "_neck", segs=8,
        cap=False)
    ring = cc + cdown * (cr * 1.16 + 0.008)
    g.cyl(0.014, 0.008, loc=tuple(ring), color="brass", segs=6, rot=(90, 0, 0), bone=p + "_neck")
    h = p + "_head"
    semi, hc, tilt = d["head"]
    ell(g, semi, hc, coat, h, segs=10, rings=6, rot=(tilt, 0, 0))
    m0, m1, m2, m3, ra, rb, rc, rd = d["muzzle"]
    # chanfrein droit et long, bout du nez de la couleur du mufle
    seg(g, m0, m1, ra, rb, coat, h, segs=6, cap=False)
    seg(g, m1, m2, rb, rc, c["muzzle"], h, segs=6, cap=False)
    seg(g, m2, m3, rc, rd, c["muzzle"], h, segs=6)
    # barbiche sous le menton: petit fuseau qui pend
    seg(g, (0, -0.62, 0.825), (0, -0.612, 0.75), 0.017, 0.004, back if robe == "goat_chamois" else coat, h, segs=5)
    for s, side in ((1, "l"), (-1, "r")):
        g.sphere(0.0105, loc=(s * 0.056, -0.54, 0.93), color="black", segs=5, rings=3, bone=h)
        faune.cupped_ear(g, d, s, c["ear_in"], coat, f"{p}_ear_{side}")
        if c["horns"]:
            # petites cornes de chevrette, qui partent vers l'arrière et s'écartent un peu
            a = (s * 0.026, -0.51, 0.965)
            b = (s * 0.034, -0.475, 1.025)
            e = (s * 0.042, -0.43, 1.055)
            f = (s * 0.05, -0.39, 1.05)
            seg(g, a, b, 0.021, 0.016, "goose_grey", h, segs=5, cap=False)
            seg(g, b, e, 0.016, 0.01, "goose_grey", h, segs=5, cap=False)
            seg(g, e, f, 0.01, 0.003, "goose_grey", h, segs=5)
    # pattes: épaule et avant-bras du pelage, canon et pied de la couleur des pattes, onglons noirs
    x, j0, j1, j2, j3, rr = d["front"]
    for s, side in ((1, "l"), (-1, "r")):
        xs = s * x
        b = f"{p}_leg_f{side}"
        seg(g, (xs, *j0), (xs, *j1), rr[0], rr[1], coat, b, segs=7)
        seg(g, (xs, *j1), (xs, *j2), rr[2], rr[3], coat, b + "_2", segs=7)
        g.sphere(rr[3] * 1.05, loc=(xs, *j2), color=leg, segs=6, rings=3, bone=b + "_3")
        seg(g, (xs, *j2), (xs, j3[0], j3[1]), rr[4], rr[5], leg, b + "_3", segs=5, cap=False)
        seg(g, (xs, j3[0], j3[1]), (xs, j3[0] - 0.01, 0.0), rr[5] * 1.15, rr[6], "black", b + "_3", segs=5)
    x, j0, j1, j2, j3, rr, (ts, tl, tt) = d["hind"]
    for s, side in ((1, "l"), (-1, "r")):
        xs = s * x
        b = f"{p}_leg_b{side}"
        ell(g, ts, (xs, *tl), body, b, segs=8, rings=5, rot=(tt, 0, 0))
        seg(g, (xs, *j1), (xs, *j2), rr[0], rr[1], coat, b + "_2", segs=7)
        g.sphere(rr[1] * 1.05, loc=(xs, *j2), color=leg, segs=6, rings=3, bone=b + "_3")
        seg(g, (xs, *j2), (xs, j3[0], j3[1]), rr[2], rr[3], leg, b + "_3", segs=5, cap=False)
        seg(g, (xs, j3[0], j3[1]), (xs, j3[0] - 0.01, 0.0), rr[3] * 1.15, rr[4], "black", b + "_3", segs=5)
    # pis (on trait la chèvre: il se voit de côté, entre les cuisses) et deux trayons
    ell(g, (0.055, 0.07, 0.05), (0, 0.27, 0.40), "plaster_rose", p + "_hips", segs=7, rings=4)
    for s in (1, -1):
        seg(g, (s * 0.025, 0.26, 0.37), (s * 0.03, 0.255, 0.335), 0.012, 0.008, "plaster_rose", p + "_hips", segs=5)
    # queue courte et relevée
    t0, t1, tr0, tr1 = d["tail"]
    seg(g, t0, t1, tr0, tr1, by_normal(back, coat, coat, thr=0.3), p + "_tail", segs=5)
    return g


def goat_clips(rig):
    p = "goat"
    C = {}
    ears = {"goat_ear_l": R(0, 0, 0), "goat_ear_r": R(0, 0, 0)}
    # repos: tête droite qui rumine, oreilles qui battent, coup d'oeil sur le côté, queue qui frétille
    chew_a = {"goat_head": R(-4)}
    chew_b = {"goat_head": R(2)}
    look = {"goat_neck": R(-4, 0, 24), "goat_head": R(-2, 0, 14)}
    C["goat_idle"] = (True, {0: merge(ears, chew_a), 10: chew_b, 20: chew_a, 30: chew_b,
                             40: merge(chew_a, {"goat_ear_l": R(-20, 0, 10), "goat_tail": R(0, 0, 30)}),
                             46: merge(chew_b, {"goat_tail": R(0, 0, -30)}), 52: chew_a,
                             70: merge(look, {"goat_ear_r": R(-16)}), 95: look,
                             110: chew_b, 120: merge(ears, chew_a)})
    walk_base = {"goat_neck": R(12), "goat_head": R(4)}
    # pas: un cycle de 0,8 s fait environ 0,6 m (timeScale = vitesse / 0,78)
    C["goat_walk"] = (True, _gait(p, {"bl": 0.0, "fl": 0.25, "br": 0.5, "fr": 0.75}, 0.62,
                                  (24, 60), (-26, 50), 22, 20, steps=12, frames=24, bob=0.008, base=walk_base))
    # trot (suivre le joueur qui tient la corde): diagonales, 0,4 s pour environ 1,1 m (timeScale = vitesse / 2,8)
    C["goat_trot"] = (True, _gait(p, {"fl": 0.0, "br": 0.0, "fr": 0.5, "bl": 0.5}, 0.45,
                                  (24, 70), (-32, 58), 30, 28, steps=6, frames=12, bob=0.016,
                                  base={"goat_neck": R(6), "goat_tail": R(-20)}))
    graze = merge({"goat_chest": R(5), "goat_neck": R(115), "goat_head": R(-35),
                   "goat_ear_l": R(-10, 0, 10), "goat_ear_r": R(-10, 0, -10)},
                  _legs(p, fl=(-30, 8, 0), fr=(-30, 8, 0), bl=(4, -3, 0), br=(4, -3, 0)))
    bite_l = merge(graze, {"goat_head": R(-26, 0, 16)})
    bite_r = merge(graze, {"goat_head": R(-26, 0, -14)})
    chew = merge(graze, {"goat_head": R(-48), "goat_tail": R(0, 0, 26)})
    step = merge(graze, _legs(p, fl=(-38, 14, 24)))
    C["goat_graze"] = (True, {0: graze, 14: bite_l, 22: graze, 30: bite_l, 40: chew, 52: merge(step, {"goat_tail": R(0, 0, -26)}),
                              60: merge(graze, _legs(p, fl=(-34, 8, 0))), 76: bite_r, 86: graze, 94: bite_r,
                              108: chew, 120: graze})
    # traite: immobile, pattes arrière un peu reculées, tête tenue un peu haute (l'autre joueur la tient au
    # collier); seules les oreilles et la queue bougent
    milk = merge({"goat_neck": R(-6), "goat_head": R(-6)},
                 _legs(p, bl=(10, -4, 0), br=(10, -4, 0)))
    C["goat_milk_stand"] = (True, {0: milk, 20: merge(milk, {"goat_ear_l": R(-18, 0, 12)}), 30: milk,
                                   50: merge(milk, {"goat_tail": R(0, 0, 28)}), 56: merge(milk, {"goat_tail": R(0, 0, -28)}),
                                   62: milk, 80: merge(milk, {"goat_ear_r": R(-18, 0, -12), "goat_head": R(-3)}), 90: milk})
    # couchée (la nuit à la chevrerie, la sieste au piquet): pattes repliées sous le corps, tête haute qui rumine
    lie = merge({"goat_root": {"l": (0, 0, -0.335)}, "goat_hips": R(-2), "goat_neck": R(-8), "goat_head": R(-6),
                 "goat_ear_l": R(10, 0, -6), "goat_ear_r": R(10, 0, 6)},
                _legs(p, fl=(-62, 150, 10), fr=(-62, 150, 10), bl=(-94, 150, -36), br=(-94, 150, -36)))
    lie_b = merge(lie, {"goat_head": R(0, 0, 0)})
    C["goat_lie"] = (True, {0: lie, 12: lie_b, 24: lie, 36: lie_b,
                            60: merge(lie, {"goat_neck": R(-6, 0, 20), "goat_head": R(-4, 0, 10)}),
                            84: merge(lie_b, {"goat_neck": R(-6, 0, 20)}), 108: lie_b, 120: lie})
    # clochette: lève la tête (le train passe), secoue deux fois, revient au repos (une fois)
    up = {"goat_neck": R(-14), "goat_head": R(-8), "goat_ear_l": R(-24, 0, 12), "goat_ear_r": R(-24, 0, -12)}
    C["goat_bell"] = (False, {0: {}, 6: up, 10: merge(up, {"goat_head": R(-8, 14, 0)}),
                              14: merge(up, {"goat_head": R(-8, -14, 0)}), 18: merge(up, {"goat_head": R(-8, 12, 0)}),
                              22: merge(up, {"goat_head": R(-8, -10, 0)}), 26: up, 36: {}})
    return rig.bake(C)


def goat_bell(A):
    """Clochette de laiton (0,06 m) et sa boucle: origine à la boucle (sous socket_goat_neck), elle pend vers le bas."""
    g = A.geo()
    g.lathe([(0.012, -0.012), (0.018, -0.02), (0.022, -0.045), (0.03, -0.062), (0.0, -0.062)],
            colors="brass", segs=8, close_bottom=False)
    g.cyl(0.006, 0.008, loc=(0, 0, -0.062), color="iron", segs=5, base=False)
    g.cyl(0.011, 0.006, loc=(0, 0, -0.006), color="brass", segs=6, rot=(90, 0, 0))
    return g


def goat_stake(A):
    """Piquet de pâture: châtaignier de 0,5 m hors sol, tête écrasée par la masse, anneau de fer et deux tours
    de corde nouée (la corde du jeu part de rope_anchor, au nœud)."""
    g = A.geo()
    g.cyl(0.032, 0.48, loc=(0, 0, 0), color="wood", segs=6, base=True, r2=0.028)
    g.cyl(0.036, 0.03, loc=(0, 0, 0.47), color="wood_old", segs=6, base=True, r2=0.03)
    g.cyl(0.04, 0.05, loc=(0, 0, 0.0), color="soil", segs=6, base=True, r2=0.032)
    for z in (0.39, 0.415):
        g.cyl(0.037, 0.018, loc=(0, 0, z), color="rope", segs=7)
    g.cyl(0.03, 0.01, loc=(0, -0.045, 0.40), color="iron", segs=7, rot=(90, 0, 0))
    g.sphere(0.016, loc=(0, -0.04, 0.37), color="rope", segs=5, rings=3)
    return g


def _plank_wall(g, L, H0, H1, axis, at, colors=("wood_new", "wood"), skip=(), z0=0.0, thick=0.04, n=None):
    """Mur de planches verticales de L de long, de hauteur H0 au début à H1 à la fin (mur sous une pente)."""
    n = n or max(3, int(round(L / 0.2)))
    w = L / n
    for k in range(n):
        if k in skip:
            continue
        u = -L / 2 + w * (k + 0.5)
        h = H0 + (H1 - H0) * (k + 0.5) / n - z0
        loc = (u, at, z0) if axis == "x" else (at, u, z0)
        size = (w - 0.012, thick, h) if axis == "x" else (thick, w - 0.012, h)
        g.box(size, loc=loc, color=colors[k % 2], base=True)


# Chevrerie: 2 x 2 m, porte coupée à mi-hauteur côté maison (-Y Blender, +Z glTF), toit d'une pente qui
# descend vers l'arrière (le talus): la pluie tombe derrière, jamais devant la porte.
SHED = {"w": 1.9, "d": 1.8, "front": 1.95, "back": 1.45, "door_x": -0.42, "door_w": 0.72, "door_h": 1.7}


def goat_shed(A):
    S = SHED
    W, D = S["w"], S["d"]
    root = A.group("goat_shed", {"footprint": [2, 2], "door_cell": 0,
                                 "doors": ["goat_shed_door_low", "goat_shed_door_high"],
                                 "inside": [0.25, 0.0, -0.1],
                                 "tub": "goat_shed_tub_water",
                                 "note": "porte coupée à mi-hauteur sur la case de gauche (vue de dehors), "
                                         "toit qui descend vers l'arrière (-Z): dos au talus; baquet à droite "
                                         "de la porte, eau (goat_shed_tub_water) à montrer quand il est plein"})
    g = A.geo()
    y0, y1 = -D / 2, D / 2

    def roof_z(y):
        return S["front"] + (S["back"] - S["front"]) * (y - y0) / D
    # soubassement de pierres sèches, plancher de terre battue paillé
    g.box((W + 0.06, D + 0.06, 0.14), loc=(0, 0, 0), color="stone", base=True)
    g.box((W - 0.4, D - 0.4, 0.02), loc=(0, 0, 0.14), color="straw", base=True)
    # poteaux d'angle
    # en retrait des planches (posées dehors, contre eux): aucune face confondue
    for x in (-W / 2 + 0.09, W / 2 - 0.09):
        for y in (y0 + 0.09, y1 - 0.09):
            g.box((0.1, 0.1, roof_z(y) - 0.14 - 0.02), loc=(x, y, 0.14), color="wood_dark", base=True)
    # façade: planches de part et d'autre de la porte, linteau
    dx, dw, dh = S["door_x"], S["door_w"], S["door_h"]
    n = 10
    w = W / n
    for k in range(n):
        u = -W / 2 + w * (k + 0.5)
        if abs(u - dx) < dw / 2 + 0.01:
            # au-dessus de la porte: bout de planche entre linteau et toit
            g.box((w - 0.012, 0.04, S["front"] - 0.14 - dh - 0.08), loc=(u, y0 + 0.02, 0.14 + dh + 0.08),
                  color="wood_new" if k % 2 else "wood", base=True)
            continue
        g.box((w - 0.012, 0.04, S["front"] - 0.16), loc=(u, y0 + 0.02, 0.14), color="wood_new" if k % 2 else "wood",
              base=True)
    for x in (dx - dw / 2 - 0.04, dx + dw / 2 + 0.04):
        g.box((0.08, 0.07, dh), loc=(x, y0 + 0.02, 0.14), color="wood_dark", base=True)
    g.box((dw + 0.16, 0.07, 0.08), loc=(dx, y0 + 0.02, 0.14 + dh), color="wood_dark", base=True)
    # arrière et côtés sous la pente (hauteurs qui suivent le toit)
    _plank_wall(g, W, S["back"] - 0.02, S["back"] - 0.02, "x", y1 - 0.02, z0=0.14, n=10)
    for x in (-W / 2 + 0.02, W / 2 - 0.02):
        n = 9
        w = D / n
        for k in range(n):
            u = y0 + w * (k + 0.5)
            top = roof_z(u + w / 2) - 0.02
            # fenêtre haute (jour d'aération) sur le côté droit
            if x > 0 and k in (3, 4, 5):
                g.box((0.04, w - 0.012, 0.42), loc=(x, u, 0.14), color="wood_new" if k % 2 else "wood", base=True)
                g.box((0.04, w - 0.012, top - 0.98), loc=(x, u, 0.98), color="wood_new" if k % 2 else "wood",
                      base=True)
                continue
            g.box((0.04, w - 0.012, top - 0.14), loc=(x, u, 0.14), color="wood_new" if k % 2 else "wood", base=True)
    for z in (0.56, 0.98):
        g.box((0.05, 3 * D / 9 + 0.04, 0.05), loc=(W / 2 - 0.01, y0 + 4.5 * D / 9, z), color="wood_dark")
    # râtelier à foin contre le mur du fond (on le voit par la porte)
    # deux lisses du mur de gauche au milieu (haute contre le mur du fond), barreaux de l'une à l'autre
    g.box((1.2, 0.05, 0.05), loc=(-0.31, y1 - 0.065, 1.15), color="wood_dark")
    g.box((1.2, 0.05, 0.05), loc=(-0.31, y1 - 0.3, 0.75), color="wood_dark")
    for k in range(8):
        x = -0.82 + k * 0.145
        seg(g, (x, y1 - 0.075, 1.14), (x, y1 - 0.29, 0.76), 0.012, 0.012, "wood", segs=5)
    g.sphere(0.3, loc=(-0.31, y1 - 0.17, 1.13), color="straw_dark", segs=7, rings=3, scale=(1.6, 0.35, 0.3))
    A.add("goat_shed_body", g, parent=root)
    # toit d'une pente: voliges débordantes, couvertes de bardeaux en trois rangs, rive avant chanfreinée
    r = A.geo()
    ang = math.degrees(math.atan2(S["front"] - S["back"], D))
    L = math.hypot(D, S["front"] - S["back"]) + 0.36
    cy, cz = 0.0, (S["front"] + S["back"]) / 2 + 0.035
    for k in range(4):
        t = -L / 2 + L * (k + 0.5) / 4
        y = cy + t * math.cos(math.radians(ang))
        z = cz - t * math.sin(math.radians(ang)) + 0.01 * (k % 2)
        r.box((W + 0.3, L / 4 + 0.04, 0.05), loc=(0, y, z), color="wood_dark" if k % 2 else "wood",
              rot=(-ang, 0, 0), bevel=0.012, bseg=1)
    for x in (-W / 2 - 0.15, W / 2 + 0.15):
        r.box((0.04, L, 0.1), loc=(x, cy, cz - 0.03), color="wood_dark", rot=(-ang, 0, 0))
    A.add("goat_shed_roof", r, parent=root)
    # porte coupée: vantail bas (fermé la nuit) et vantail haut, gonds à gauche (vue de dehors)
    for name, z0, h in (("goat_shed_door_low", 0.16, 0.8), ("goat_shed_door_high", 0.98, dh - 0.86)):
        dg = A.geo()
        for k in range(4):
            dg.box((dw / 4 - 0.01, 0.035, h), loc=(dw / 8 + k * dw / 4, 0, 0), color="wood_new" if k % 2 else "wood",
                   base=True)
        dg.box((dw - 0.04, 0.03, 0.08), loc=(dw / 2, -0.03, h * 0.2), color="wood_dark", base=True)
        dg.box((dw - 0.04, 0.03, 0.08), loc=(dw / 2, -0.03, h * 0.72), color="wood_dark", base=True)
        if name.endswith("low"):
            dg.box((0.08, 0.03, 0.03), loc=(dw - 0.1, -0.03, h * 0.55), color="iron")
        hinge = (dx - dw / 2, y0 - 0.01, z0)
        A.add(name, dg, parent=root, loc=hinge)
    # baquet (demi-tonneau) à droite de la porte, contre la façade
    t = A.geo()
    tx = 0.42
    t.lathe([(0.2, 0.0), (0.23, 0.12), (0.245, 0.26)], colors="wood", segs=10, close_top=False)
    t.lathe([(0.225, 0.26), (0.21, 0.12), (0.185, 0.03)], colors="wood_dark", segs=10, close_top=True,
            close_bottom=False)  # profil de haut en bas: le dernier rang est le fond
    # chant du bord, entre les douelles extérieures et intérieures (sinon on voit entre les deux)
    t.lathe([(0.245, 0.26), (0.225, 0.26)], colors="wood", segs=10, close_top=False, close_bottom=False)
    for z in (0.05, 0.2):
        t.cyl(0.215 + 0.025 * z / 0.26 + 0.01, 0.025, loc=(0, 0, z), color="iron", segs=10)
    A.add("goat_shed_tub", t, parent=root, loc=(tx, y0 - 0.32, 0))
    wtr = A.geo()
    wtr.cyl(0.215, 0.01, loc=(0, 0, 0.215), color="water", segs=10)
    A.add("goat_shed_tub_water", wtr, parent=root, loc=(tx, y0 - 0.32, 0))
    return root


def henhouse_extended(A):
    """Poulailler agrandi (chantier coop_extension, 9 poules): le poulailler réparé de bourg.py, plus un
    pondoir en appentis contre le pignon droit (sous la rive du toit, au-dessus de la clôture) et un second
    perchoir plus bas et plus en avant (dix places de 0,3 m)."""
    import bourg
    root = A.group("henhouse_extended", {"footprint": [3, 3], "door_cell": 1,
                                         "replaces": "henhouse_repaired",
                                         "note": "même origine et même emprise que henhouse: montrer ce nœud à la "
                                                 "place de henhouse_repaired une fois le chantier fini"})
    sub = bourg.henhouse(A, False, root)
    sub.name = "henhouse_extended_house"
    for ch in list(sub.children):
        ch.name = ch.name.replace("henhouse_repaired_", "henhouse_extended_")
    # appentis: plancher sur ses deux pieds, trois nids paillés derrière un bandeau, toit d'une pente
    g = A.geo()
    x0, x1 = 0.82, 1.3
    g.box((x1 - x0, 1.36, 0.08), loc=((x0 + x1) / 2, 0.5, 0.45), color="wood", base=True)
    for y in (-0.12, 1.12):
        g.box((0.08, 0.08, 0.45), loc=(x1 - 0.06, y, 0), color="wood", base=True)
    z_hi, z_lo = 1.2, 0.98

    def zt(x):
        return z_hi + (z_lo - z_hi) * (x - x0) / (x1 - x0)
    for k in range(7):
        u = -0.16 + 1.32 / 7 * (k + 0.5)
        g.box((0.04, 1.32 / 7 - 0.015, zt(x1) - 0.53), loc=(x1 - 0.02, u, 0.53), color="wood_new" if k % 2 else "wood",
              base=True)
    for y in (-0.16, 1.16):
        for k in range(3):
            xa = x0 + (x1 - x0) * k / 3
            xb = x0 + (x1 - x0) * (k + 1) / 3
            g.box((xb - xa - 0.012, 0.04, zt((xa + xb) / 2) - 0.53), loc=((xa + xb) / 2, y, 0.53),
                  color="wood_new" if k % 2 else "wood", base=True)
    for k in range(3):
        y = 0.04 + k * 0.42
        g.box((0.36, 0.34, 0.03), loc=(1.06, y, 0.53), color="straw", base=True)
        if k == 1:
            g.sphere(0.035, loc=(1.06, y + 0.04, 0.6), color="egg", segs=6, rings=4, scale=(1, 1, 1.25))
    r = A.geo()
    ang = math.degrees(math.atan2(z_hi - z_lo, x1 - x0))
    L = math.hypot(x1 - x0, z_hi - z_lo) + 0.12
    r.box((L, 1.52, 0.04), loc=((x0 + x1) / 2 + 0.05, 0.5, (z_hi + z_lo) / 2 + 0.025), color="wood_dark",
          rot=(0, ang, 0))
    r.box((0.03, 1.5, 0.08), loc=(x0 + 0.015, 0.5, z_hi + 0.03), color="wood")
    A.add("henhouse_extended_annex", g, parent=root)
    A.add("henhouse_extended_annex_roof", r, parent=root)
    # second perchoir, plus bas et plus près de la porte, sur ses tasseaux
    pg = A.geo()
    pg.cyl(0.028, 1.55, loc=(0, 0.3, 0.74), color="wood", segs=6, rot=(0, 90, 0))
    for x in (-0.76, 0.76):
        pg.box((0.03, 0.1, 0.08), loc=(x, 0.3, 0.68), color="wood")
    A.add("henhouse_extended_perch", pg, parent=root)
    return root


def hen_feeder_hopper(A):
    """Mangeoire à trémie (achat du catalogue): trémie de planches de 0,4 m sur deux tasseaux, couvercle en
    pente, auget devant (-Y) avec son grain (nœud hen_feeder_hopper_grain, à cacher quand le sac est vide)."""
    g = A.geo()
    for x in (-0.2, 0.2):
        g.box((0.05, 0.36, 0.06), loc=(x, 0.0, 0.0), color="wood_dark", base=True)
    # caisse: dos haut, devant plus bas (le couvercle penche vers l'avant)
    g.box((0.44, 0.03, 0.62), loc=(0, 0.13, 0.06), color="wood", base=True)
    g.box((0.44, 0.03, 0.48), loc=(0, -0.07, 0.17), color="wood_new", base=True)
    # côtés pris entre le devant et le dos (aucune face confondue: Cycles les noircit, Three.js les fait papilloter)
    for x in (-0.2, 0.2):
        g.prism([(-0.07, 0.06), (0.13, 0.06), (0.13, 0.675), (-0.07, 0.655)], 0.03, loc=(x, 0, 0), color="wood",
                rot=(0, 0, 90))
    # auget
    g.box((0.42, 0.16, 0.025), loc=(0, -0.13, 0.06), color="wood_dark", base=True)
    g.box((0.42, 0.025, 0.09), loc=(0, -0.2, 0.06), color="wood", base=True)
    for x in (-0.2, 0.2):
        g.box((0.03, 0.12, 0.065), loc=(x, -0.135, 0.085), color="wood", base=True)
    # couvercle en pente, charnière en haut du dos
    g.box((0.5, 0.3, 0.03), loc=(0, 0.03, 0.675), color="wood_dark", rot=(-8, 0, 0), bevel=0.008)
    g.box((0.08, 0.02, 0.03), loc=(0, -0.12, 0.67), color="iron")
    A.add("hen_feeder_hopper", g, {"footprint": [1, 1], "grain": "hen_feeder_hopper_grain",
                                   "note": "auget vers +Z: les poules picorent devant"})
    gr = A.geo()
    gr.box((0.37, 0.12, 0.035), loc=(0, -0.13, 0.085), color="grain", base=True)
    root = A.roots[-1]
    A.add("hen_feeder_hopper_grain", gr, parent=root)


def milk_can(A):
    """Bidon de lait de fer-blanc (5 litres, 0,32 m): corps, épaule, col, couvercle, anse; origine au sol."""
    g = A.geo()
    g.lathe([(0.1, 0.0), (0.105, 0.02), (0.105, 0.2), (0.08, 0.25), (0.055, 0.27), (0.055, 0.3)],
            colors=["tin", "tin", "tin", "tin", "tin"], segs=10)
    for z in (0.02, 0.19):
        g.cyl(0.108, 0.018, loc=(0, 0, z), color="iron_light", segs=10)
    g.cyl(0.062, 0.03, loc=(0, 0, 0.3), color="iron_light", segs=10, base=True)
    g.cyl(0.02, 0.025, loc=(0, 0, 0.33), color="iron", segs=6, base=True)
    # anse de fil de fer, de part et d'autre de l'épaule
    pts = [(math.cos(math.radians(a)) * 0.08, 0.0, 0.25 + math.sin(math.radians(a)) * 0.12) for a in range(0, 181, 30)]
    for a, b in zip(pts, pts[1:]):
        seg(g, a, b, 0.006, 0.006, "iron", segs=5)
    return g


def fresh_cheese(A):
    """Fromage frais de chèvre: palet blanc égoutté (0,11 m) sur une feuille de châtaignier, sur une planchette
    ronde; grossi d'un tiers pour la lecture au zoom 1 (0,18 m en tout)."""
    g = A.geo()
    g.cyl(0.09, 0.018, loc=(0, 0, 0), color="wood_new", segs=10, base=True)
    g.prism([(-0.085, 0.0), (-0.04, 0.035), (0.04, 0.038), (0.085, 0.0), (0.04, -0.038), (-0.04, -0.035)], 0.004,
            loc=(0, 0, 0.02), color="leaf_hazel", rot=(90, 0, 25))
    g.lathe([(0.055, 0.022), (0.058, 0.03), (0.056, 0.06), (0.045, 0.072), (0.0, 0.074)], colors="fox_white",
            segs=10)
    return g


def egg_basket(A):
    """Panier d'osier (0,32 m) à anse, six œufs sur un lit de paille."""
    g = A.geo()
    g.lathe([(0.11, 0.0), (0.14, 0.03), (0.155, 0.07), (0.16, 0.11)],
            colors=["straw_dark", "straw", "straw_dark"], segs=10, close_top=False)
    g.lathe([(0.15, 0.11), (0.145, 0.07), (0.13, 0.035), (0.1, 0.015)], colors="straw_dark", segs=10,
            close_top=False)
    g.cyl(0.165, 0.02, loc=(0, 0, 0.11), color="straw_dark", segs=10)
    g.cyl(0.14, 0.01, loc=(0, 0, 0.085), color="straw", segs=10, base=True)
    for k, (x, y) in enumerate(((0.05, 0.03), (-0.05, 0.04), (0.0, -0.05), (0.07, -0.05), (-0.07, -0.04),
                                (0.0, 0.08))):
        g.sphere(0.035, loc=(x, y, 0.13), color="egg" if k != 3 else "paper_dark", segs=6, rings=4,
                 scale=(1, 1, 1.25), rot=(15 * (k % 3) - 15, 0, 30 * k))
    pts = [(math.cos(math.radians(a)) * 0.155, 0.0, 0.11 + math.sin(math.radians(a)) * 0.2) for a in range(0, 181, 30)]
    for a, b in zip(pts, pts[1:]):
        seg(g, a, b, 0.011, 0.011, "straw_dark", segs=5)
    return g


# Programme ---------------------------------------------------------------------

def main():
    lpl.reset()
    bpy.context.scene.render.fps = FPS
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)

    rig = Rig("goat", faune.deer_bones(GOAT))
    A._register(rig.arm, {"kind": "animal", "origin": "sol entre les pattes", "withers": 0.72, "head_up": 0.95,
                          "length": 1.0, "collision_radius": 0.45, "variants": list(COATS),
                          "neck_socket": "socket_goat_neck",
                          "note": "deux robes (goat_chamois, goat_white): n'en montrer qu'une. Corde et clochette "
                                  "au collier (socket_goat_neck). goat_walk: timeScale = vitesse / 0,78; goat_trot: "
                                  "vitesse / 2,8; goat_bell une fois (LoopOnce)"})
    meshes = {}
    for robe in COATS:
        meshes[robe] = rig.skin(A, robe, goat_mesh(A, robe))
    cc, cd, cdown, cr = _neck_frame()
    rig.socket("socket_goat_neck", "goat_neck", cc + cdown * (cr * 1.16 + 0.02))
    clips = goat_clips(rig)

    A.add("goat_bell", goat_bell(A), {"kind": "item", "socket": "socket_goat_neck",
                                      "note": "accrocher sous socket_goat_neck sans transformation"})
    A.add("goat_stake", goat_stake(A), {"kind": "prop", "rope_anchor": [0.0, 0.405, 0.0], "rope_length": 2.5,
                                        "note": "corde dessinée par le jeu de rope_anchor à socket_goat_neck"})
    lpl.AUTO_ROUND = True
    # plafonds relevés (bible, 350 000 triangles): abris arrondis jusqu'aux poteaux et soubassements
    lpl.AUTO_MIN = (0.6, 0.08)
    goat_shed(A)
    henhouse_extended(A)
    lpl.AUTO_ROUND = False
    hen_feeder_hopper(A)
    A.add("milk_can", milk_can(A), {"kind": "item", "size_m": 0.33})
    A.add("fresh_cheese", fresh_cheese(A), {"kind": "item", "size_m": 0.18})
    A.add("egg_basket", egg_basket(A), {"kind": "item", "size_m": 0.32})

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "elevage.glb")
    size = lpl.export_glb(path, objs, animation_mode="NLA_TRACKS")
    st = A.stats()
    st["goat"]["tris_each_variant"] = {k: lpl.tri_count_obj(v) for k, v in meshes.items()}
    lpl.write_stats("elevage", {"nodes": st, "animations": {"goat": clips}, "file_bytes": size})
    os.makedirs(os.path.join(lpl.HERE, "blend"), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "elevage.blend"), compress=True)
    print("ELEVAGE", size, {k: v["tris"] for k, v in st.items()}, st["goat"]["tris_each_variant"])


if __name__ == "__main__":
    main()
