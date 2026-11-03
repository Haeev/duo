"""Tour 10: la rue Haute (conception, table 1.3) et les passages du ru de la Côte.

- `bakery` (fournil d'Achille, 7 x 6, porte et guichet au sud sur la rue, four et sa cheminée à l'arrière
  côté voie, porte des sacs au pignon ouest, côté halte);
- `lucie_house` (maison de Lucie, 6 x 6, porte en façade, un seul niveau, volets, jardinet clos derrière);
- `school` (école-mairie, 11 x 5: cour murée à l'ouest avec son tilleul et le portail dans l'axe de la rue
  Haute, la mairie-école à l'est, clocheton);
- `culvert` (ponceau de la voie), `street_bridge` (pont de la rue), `footbridge` (passerelle de la promenade),
  `ford_stones` (gué de pierres plates).
Ces bâtiments ne se visitent pas à ce tour (étape 2 du monde): un corps et un toit, comme la maison de Firmin.

Appelé par bourg.py. Repères Blender: façade vers -Y (+Z glTF), origine au centre de l'emprise, au sol.
Passages: le ru coule le long de Z glTF (Y Blender); la rue, la voie ou la promenade le long de X.
"""
import math
import random

from mathutils import Vector

import lpl
from lpl import by_normal
from interieurs import door_frame, glazed, painted_word, pierced_wall


def _B():
    import bourg
    return bourg


def _walls(g, B, hx, hy, h, t, openings, color_out, color_in):
    """Quatre murs percés (fermés aux angles: façades pleine largeur, côtés entre elles)."""
    for side, ops in openings.items():
        f = B.Face(side, hx, hy)
        L = 2 * hx if side in ("front", "back") else 2 * hy - 2 * t
        inward = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (1, 0, 0), "right": (-1, 0, 0)}[side]
        pierced_wall(g, f, L, t, h, ops, B.wall_color(color_out, color_in, inward))


def _plinth(g, B, hx, hy, openings, h=0.4, color="stone_dark"):
    for side in ("front", "back", "left", "right"):
        f = B.Face(side, hx, hy)
        L = 2 * hx + 0.04 if side in ("front", "back") else 2 * hy
        segs = [(-L / 2, L / 2)]
        for (u, w, zb, zt) in sorted(openings.get(side, [])):
            if zb < h:
                a, b = segs.pop()
                segs += [(a, u - w / 2), (u + w / 2, b)]
        for a, b in segs:
            if b - a > 0.05:
                f.box(g, (b - a, 0.05, h), (a + b) / 2, 0.025, h / 2, color)


# Fournil d'Achille ---------------------------------------------------------------------------------

def bakery(A):
    """Le fournil: rez-de-chaussée de pierre (le fournil et la boutique du guichet), logement d'Achille sous
    le toit (lucarne au sud). Le four de son grand-père dépasse à l'arrière, côté voie, sous un petit toit de
    tuiles, avec sa haute cheminée: la fumée part loin des maisons."""
    B = _B()
    hx, y0, y1, t, ze, zr = 3.2, -2.55, 1.55, 0.35, 3.0, 4.6
    hy = (y1 - y0) / 2
    yc = (y0 + y1) / 2
    root = A.group("bakery", {
        "footprint": [7, 6], "door_cell": 5, "window_cell": 3,
        "spots": {"bakery_window": [0.0, 3.0], "bakery_door": [1.9, 3.0], "sacks_door": [-3.6, 0.6],
                  "spot_hourglass": [0.45, 2.7]},
        "note": "porte en case 5, guichet en case 3 (le point bakery_window se tient dehors, devant le guichet, "
                "sous l'auvent); porte des sacs au pignon ouest; four et cheminée côté voie (nord). spots: repère "
                "glTF x, z du bâtiment; spot_hourglass: rebord du guichet, où poser le sablier offert"})
    g = A.geo()
    ops = {
        "front": [(-2.0, 0.85, 1.0, 2.1), (0.0, 1.3, 0.95, 2.2), (1.9, 0.95, 0.0, 2.15)],
        "back": [(-2.2, 0.7, 1.2, 2.0)],
        "left": [(0.1, 1.0, 0.0, 2.05)],
        "right": [(-0.4, 0.7, 1.1, 2.0)],
    }
    # corps décalé vers le sud (yc): le four occupe la bande nord de l'emprise
    g2 = A.geo()
    _walls(g2, B, hx, hy, ze, t, ops, "stone", "plaster_cream")
    _plinth(g2, B, hx, hy, ops, 0.45)
    fr = B.Face("front", hx, hy)
    glazed(g2, fr, -2.0, 0.85, 1.0, 2.1, t, frame="paint_cream", shutter="paint_red")
    # guichet: vitre haute, tablette de chêne qui dépasse dehors, volet rabattu en tablette sous elle
    glazed(g2, fr, 0.0, 1.3, 1.4, 2.2, t, frame="paint_red", sill="wood", mullion=True)
    fr.box(g2, (1.3, t, 0.45), 0.0, -t / 2, 1.175, "paint_red")
    fr.box(g2, (1.5, 0.45, 0.06), 0.0, 0.1, 0.98 + 0.03, "wood")
    fr.box(g2, (1.3, 0.05, 0.42), 0.0, 0.03, 0.74, "paint_red")
    for s in (1, -1):
        fr.box(g2, (0.04, 0.3, 0.04), s * 0.6, 0.15, 0.85, "iron", rot=(-35, 0, 0))
    # rebord du guichet: deux miches en vitrine
    for k, uu in enumerate((-0.35, -0.05)):
        p = fr.p(uu, 0.12, 1.1)
        g2.sphere(1.0, loc=p, color=by_normal("bread_crust", "bread"), segs=7, rings=4, scale=(0.11, 0.09, 0.07))
    door_frame(g2, fr, 1.9, 0.95, 2.15, t, frame="paint_red")
    fr.box(g2, (0.81, 0.05, 2.04), 1.9, -t + 0.06, 1.03, "paint_red")
    for z in (0.5, 1.45):
        fr.box(g2, (0.6, 0.06, 0.55), 1.9, -t + 0.04, z, "wood_dark")
    fl = B.Face("left", hx, hy)
    door_frame(g2, fl, 0.1, 1.0, 2.05, t, frame="wood_old")
    fl.box(g2, (0.86, 0.05, 1.96), 0.1, -t + 0.06, 0.98, "wood_old")
    for z in (0.4, 1.6):
        fl.box(g2, (0.7, 0.06, 0.06), 0.1, -t + 0.03, z, "iron")
    glazed(g2, B.Face("back", hx, hy), -2.2, 0.7, 1.2, 2.0, t, frame="paint_cream", shutter="paint_red")
    glazed(g2, B.Face("right", hx, hy), -0.4, 0.7, 1.1, 2.0, t, frame="paint_cream", shutter="paint_red")
    B.round_quoins(g2, hx, hy, ze - 0.05, light=True)
    # pignons
    for x, s in ((-hx, 1), (hx, -1)):
        g2.prism([(-hy, ze), (hy, ze), (0, zr - 0.22)], t, loc=(x + s * t / 2, 0, 0), color="stone", rot=(0, 0, 90))
    # auvent sur consoles, au-dessus du guichet et de la porte (planches et tuiles, dessous à 2,3 m)
    ax0, ax1, ad = -0.85, 2.55, 0.95
    B.slab(g2, [(ax0, -hy - ad, 2.42), (ax1, -hy - ad, 2.42), (ax1, -hy - 0.02, 2.72), (ax0, -hy - 0.02, 2.72)], 0.05,
           by_normal("tile", "wood_dark", "wood"))
    for k in range(1, 4):
        tt = k / 4
        yy = -hy - ad + ad * tt
        g2.box((ax1 - ax0, 0.04, 0.025), loc=((ax0 + ax1) / 2, yy, 2.42 + 0.3 * tt + 0.015), color="tile_dark",
               rot=(-math.degrees(math.atan2(0.3, ad)), 0, 0))
    for xa in (ax0 + 0.15, ax1 - 0.15):
        g2.box((0.08, ad - 0.05, 0.1), loc=(xa, -hy - ad / 2, 2.32), color="wood_dark")
        B.rod(g2, (xa, -hy - 0.02, 1.85), (xa, -hy - ad + 0.2, 2.3), 0.035, "wood_dark")
    # enseigne peinte (BOULANGERIE) sur le pignon ouest, vue en arrivant de la halte (en façade, la rive du toit
    # descend à 2,77 m juste au-dessus de l'auvent: pas de place), et la miche de fer forgé au coin
    fw = B.Face("left", hx, hy)
    fw.box(g2, (2.6, 0.05, 0.36), 0.1, 0.025, 2.55, "paint_cream")
    painted_word(g2, fw, 0.1, 0.054, 2.55, "BOULANGERIE", 0.042, "paint_red")
    B.rod(g2, (-hx - 0.02, -hy + 0.25, 2.45), (-hx - 0.6, -hy + 0.25, 2.45), 0.02, "iron")
    g2.box((0.04, 0.05, 0.5), loc=(-hx - 0.45, -hy + 0.25, 2.2), color="iron")
    g2.sphere(1.0, loc=(-hx - 0.45, -hy + 0.25, 1.95), color="brass", segs=8, rings=4, scale=(0.18, 0.04, 0.12))
    g2.transform(list(g2.bm.verts), lpl_translate((0, yc, 0)))
    A.add("bakery_body", g2, parent=root)
    # le four: massif de pierre et voûte de briques à l'arrière, sous un toit de tuiles à un pan
    ox0, ox1, oy0, oy1 = -0.7, 2.7, y1, 2.85
    g.box((ox1 - ox0, oy1 - oy0, 1.4), loc=((ox0 + ox1) / 2, (oy0 + oy1) / 2, 0), color="stone", base=True)
    g.box((ox1 - ox0 + 0.04, oy1 - oy0 + 0.04, 0.4), loc=((ox0 + ox1) / 2, (oy0 + oy1) / 2, 0), color="stone_dark",
          base=True)
    g.cyl((ox1 - ox0) / 2 - 0.15, oy1 - oy0 - 0.2, loc=((ox0 + ox1) / 2, (oy0 + oy1) / 2 + 0.05, 1.4),
          color="brick", segs=10, rot=(90, 0, 0), scale=(1, 0.55, 1))
    B.slab(g, [(ox0 - 0.15, oy1 + 0.25, 1.95), (ox1 + 0.15, oy1 + 0.25, 1.95), (ox1 + 0.15, oy0 - 0.05, 2.55),
               (ox0 - 0.15, oy0 - 0.05, 2.55)], 0.06, by_normal("tile", "tile_dark"))
    for x in (ox0 - 0.05, ox1 + 0.05):
        g.prism([(oy0, 1.4), (oy1, 1.4), (oy1, 1.9), (oy0, 2.45)], 0.12, loc=(x, 0, 0), color="stone",
                rot=(0, 0, 90))
    # haute cheminée du four, au coin nord-est (6,5 m: elle tire au-dessus du faîtage)
    B.round_chimney(g, 2.25, 2.4, 0.0, 6.4, color="brick", cap="stone_dark")
    # tas de fagots contre le four (le bois de chauffe), côté ouest
    for (xx, zz) in ((-1.55, 0.13), (-1.29, 0.13), (-1.03, 0.13), (-1.42, 0.34), (-1.16, 0.34), (-1.29, 0.55)):
        g.cyl(0.13, 1.0, loc=(xx, 2.2, zz), color=by_normal("log_end", "bark", thr=0.5), segs=6, rot=(90, 0, 0))
    A.add("bakery_oven", g, parent=root)
    r = A.geo()
    B.round_gable_roof(r, -hx, hx, -hy, hy, ze, zr, "tile", edge="tile_dark", ridge_color="tile_dark")
    B.round_chimney(r, -2.2, 0.5, 3.8, 5.4)
    # lucarne au sud: la chambre d'Achille (volets fermés l'après-midi: il dort)
    slope = (zr - ze) / hy
    yf, zb, zt, zp = -hy + 0.25, 3.1, 3.85, 4.2
    ye = -(zr - zt) / slope + 0.05
    yr = -(zr - zp) / slope
    r.box((1.0, ye - yf, zt - zb), loc=(-1.0, (yf + ye) / 2, zb), color="stone", base=True)
    r.prism([(-0.65, 0), (0.65, 0), (0, zp - zt)], yr - (yf - 0.15), loc=(-1.0, (yr + yf - 0.15) / 2, zt),
            color="tile_dark")
    r.box((0.55, 0.05, 0.5), loc=(-1.0, yf - 0.02, (zb + zt) / 2 + 0.03), color="glass")
    r.box((0.67, 0.04, 0.62), loc=(-1.0, yf - 0.01, (zb + zt) / 2 + 0.03), color="paint_cream")
    # volets ouverts à plat sur le front de la lucarne (dans sa largeur)
    for s in (1, -1):
        r.box((0.13, 0.035, 0.52), loc=(-1.0 + s * 0.415, yf - 0.03, (zb + zt) / 2 + 0.03), color="paint_red")
    r.transform(list(r.bm.verts), lpl_translate((0, yc, 0)))
    A.add("bakery_roof", r, parent=root)
    return root


def lpl_translate(v):
    from mathutils import Matrix
    return Matrix.Translation(Vector(v))


# Maison de Lucie -----------------------------------------------------------------------------------

def lucie_house(A):
    """Maison basse (un niveau, faîtage à 4,0 m), volets verts, porte en case 2; jardinet clos derrière
    (palissade basse, fleurs, rang de salades), où l'on sort par la porte de derrière."""
    B = _B()
    hx, y0, y1, t, ze, zr = 2.7, -2.7, 1.45, 0.3, 2.5, 4.0
    hy = (y1 - y0) / 2
    yc = (y0 + y1) / 2
    root = A.group("lucie_house", {
        "footprint": [6, 6], "door_cell": 2, "spots": {"lucie_house_door": [-0.5, 3.2]},
        "note": "façade à l'ouest sur la carte (rotation 3); jardinet clos à l'arrière (est), dans l'emprise"})
    ops = {
        "front": [(-0.5, 0.95, 0.0, 2.1), (-2.0, 0.8, 0.95, 1.95), (1.4, 0.8, 0.95, 1.95)],
        "back": [(-0.9, 0.85, 0.0, 2.05), (1.2, 0.7, 1.0, 1.9)],
        "left": [(0.0, 0.6, 1.1, 1.8)],
        "right": [(0.3, 0.6, 1.1, 1.8)],
    }
    g = A.geo()
    _walls(g, B, hx, hy, ze, t, ops, "plaster_cream", "plaster_shade")
    _plinth(g, B, hx, hy, ops, 0.35, "stone")
    f = B.Face("front", hx, hy)
    door_frame(g, f, -0.5, 0.95, 2.1, t, frame="stone_light")
    f.box(g, (0.81, 0.05, 1.99), -0.5, -t + 0.06, 1.0, "paint_green")
    for z in (0.5, 1.45):
        f.box(g, (0.6, 0.06, 0.55), -0.5, -t + 0.04, z, "wood_dark")
    for u in (-2.0, 1.4):
        glazed(g, f, u, 0.8, 0.95, 1.95, t, frame="paint_cream", shutter="paint_green", box_flowers=(u > 0))
    fb = B.Face("back", hx, hy)
    door_frame(g, fb, -0.9, 0.85, 2.05, t, frame="stone_light")
    fb.box(g, (0.71, 0.05, 1.94), -0.9, -t + 0.06, 0.97, "paint_green")
    glazed(g, fb, 1.2, 0.7, 1.0, 1.9, t, frame="paint_cream", shutter="paint_green")
    glazed(g, B.Face("left", hx, hy), 0.0, 0.6, 1.1, 1.8, t, frame="paint_cream", shutter="paint_green")
    glazed(g, B.Face("right", hx, hy), 0.3, 0.6, 1.1, 1.8, t, frame="paint_cream", shutter="paint_green")
    for x, s in ((-hx, 1), (hx, -1)):
        g.prism([(-hy, ze), (hy, ze), (0, zr - 0.22)], t, loc=(x + s * t / 2, 0, 0), color="plaster_cream",
                rot=(0, 0, 90))
    # boîte aux lettres de la factrice à côté de la porte, pot de géraniums sur la marche
    f.box(g, (0.26, 0.14, 0.32), 0.45, 0.07, 1.25, "paint_yellow")
    f.box(g, (0.18, 0.15, 0.02), 0.45, 0.075, 1.32, "black")
    g.lathe([(0.1, 0), (0.13, 0.2), (0.14, 0.22)], loc=(-1.2, -hy - 0.25, 0), colors="tile", segs=8)
    g.sphere(0.13, loc=(-1.2, -hy - 0.25, 0.3), color="leaf_bush", ico=1, jitter=0.08, seed=5, scale=(1, 1, 0.8))
    g.sphere(0.04, loc=(-1.16, -hy - 0.36, 0.38), color="flower_red", segs=6, rings=4)
    g.transform(list(g.bm.verts), lpl_translate((0, yc, 0)))
    # jardinet derrière: palissade basse sur trois côtés (accolée au mur du fond), fleurs et salades
    gy0, gy1, gx = y1, 2.85, hx
    for k in range(int((2 * gx) / 0.3) + 1):
        x = -gx + k * (2 * gx) / int((2 * gx) / 0.3)
        g.box((0.08, 0.03, 0.62), loc=(x, gy1, 0), color="white_paint", base=True)
    for k in range(1, int((gy1 - gy0) / 0.3) + 1):
        for x in (-gx, gx):
            g.box((0.03, 0.08, 0.62), loc=(x, gy0 + k * (gy1 - gy0) / int((gy1 - gy0) / 0.3), 0), color="white_paint",
                  base=True)
    for z in (0.18, 0.45):
        g.box((2 * gx, 0.03, 0.06), loc=(0, gy1 - 0.03, z), color="white_paint", base=True)
        for x in (-gx, gx):
            g.box((0.03, gy1 - gy0, 0.06), loc=(x + (0.03 if x < 0 else -0.03), (gy0 + gy1) / 2, z),
                  color="white_paint", base=True)
    g.box((2 * gx - 0.1, gy1 - gy0 - 0.06, 0.03), loc=(0, (gy0 + gy1) / 2, 0), color="soil", base=True)
    rnd = random.Random(8)
    for k in range(6):
        x = -2.3 + k * 0.42
        g.sphere(0.13, loc=(x, gy1 - 0.35, 0.12), color="lettuce", segs=6, rings=4, scale=(1, 1, 0.6))
    for k in range(7):
        x = -2.4 + k * 0.75 + rnd.uniform(-0.1, 0.1)
        g.sphere(0.16, loc=(x, gy0 + 0.45, 0.12), color="leaf_bush", segs=6, rings=4, scale=(1, 0.8, 0.8))
        g.sphere(0.05, loc=(x + 0.05, gy0 + 0.35, 0.27), color=["flower_pink", "flower_yellow", "flower_white",
                                                               "flower_violet"][k % 4], segs=6, rings=4)
    A.add("lucie_house_body", g, parent=root)
    r = A.geo()
    B.round_gable_roof(r, -hx, hx, y0, y1, ze, zr, "tile", edge="tile_dark", ridge_color="tile_dark")
    B.round_chimney(r, 1.6, yc + 0.7, 3.2, 4.7)
    A.add("lucie_house_roof", r, parent=root)
    return root


# École-mairie ------------------------------------------------------------------------------------

def school(A):
    """Cour murée à l'ouest (5,4 x 5 m, murs de 1,8 m chaperonnés de tuiles, portail de 2,4 m dans l'axe de la
    rue Haute, tilleul et banc), mairie-école à l'est: porte de la mairie sur la rue (perron de trois marches
    de 15 cm), porte de la classe sur la cour, hautes fenêtres, clocheton sur le faîtage côté cour."""
    B = _B()
    root = A.group("school", {
        "footprint": [11, 5], "door_cell": 3, "spots": {"school_gate": [-2.0, 3.0], "town_hall_door": [2.7, 2.9]},
        "note": "portail de la cour en case 3 (dans l'axe de la rue Haute), porte de la mairie en case 8; "
                "la classe s'ouvre sur la cour"})
    g = A.geo()
    # cour: sol de terre battue, murs, portail
    cx0, cx1, cy0, cy1, wt, wh = -5.5, -0.1, -2.5, 2.5, 0.35, 1.8
    g.box((cx1 - cx0 - 0.1, cy1 - cy0 - 0.1, 0.02), loc=((cx0 + cx1) / 2, 0, 0), color="path", base=True)
    gate_u, gate_w = -2.0, 2.4

    def wall(x0, x1, y0, y1):
        g.box((x1 - x0, y1 - y0, wh), loc=((x0 + x1) / 2, (y0 + y1) / 2, 0), color="stone", base=True)
        g.box((x1 - x0 + 0.08, y1 - y0 + 0.08, 0.3), loc=((x0 + x1) / 2, (y0 + y1) / 2, 0), color="stone_dark",
              base=True)
        # chaperon de tuiles à deux pentes
        if x1 - x0 > y1 - y0:
            g.prism([(y0 - 0.06, wh), (y1 + 0.06, wh), ((y0 + y1) / 2, wh + 0.16)], x1 - x0 + 0.06,
                    loc=((x0 + x1) / 2, 0, 0), color="tile_dark", rot=(0, 0, 90))
        else:
            g.prism([(x0 - 0.06, wh), (x1 + 0.06, wh), ((x0 + x1) / 2, wh + 0.16)], y1 - y0 + 0.06,
                    loc=(0, (y0 + y1) / 2, 0), color="tile_dark")

    wall(cx0, gate_u - gate_w / 2 - 0.25, cy0, cy0 + wt)
    wall(gate_u + gate_w / 2 + 0.25, cx1 + 0.1, cy0, cy0 + wt)
    wall(cx0, cx0 + wt, cy0 + wt, cy1 - wt)
    wall(cx0, cx1 + 0.1, cy1 - wt, cy1)
    # retour de mur jusqu'à l'angle de la mairie (en retrait de la rue): la cour reste close
    wall(cx1 - 0.25, cx1 + 0.1, cy0 + wt, -1.62)
    # piliers du portail et vantaux de fer peints, ouverts dans la journée (rabattus contre le mur, côté cour)
    for s in (1, -1):
        px = gate_u + s * (gate_w / 2 + 0.125)
        g.box((0.5, 0.5, 2.15), loc=(px, cy0 + wt / 2, 0), color="stone_light", base=True)
        g.box((0.6, 0.6, 0.12), loc=(px, cy0 + wt / 2, 2.15), color="stone_dark", base=True)
        g.sphere(0.14, loc=(px, cy0 + wt / 2, 2.38), color="stone_light", segs=8, rings=5)
        hx0 = gate_u + s * gate_w / 2
        lx = hx0 - s * 0.03
        for k in range(7):
            g.box((0.025, 0.025, 1.5), loc=(lx, cy0 + wt + 0.05 + k * 0.17, 0.15), color="paint_green", base=True)
        for z in (0.25, 1.0, 1.6):
            g.box((0.04, 1.15, 0.05), loc=(lx, cy0 + wt + 0.55, z), color="paint_green", base=True)
    # le tilleul (tronc évasé, houppier en trois boules facettées) et un banc sous son ombre
    tx, ty = -3.4, 0.5
    g.cyl(0.2, 2.4, loc=(tx, ty, 0), r2=0.14, color="bark", segs=8, base=True)
    for (dx, dy, dz, r) in ((0, 0, 3.4, 1.55), (-0.7, 0.4, 2.9, 1.05), (0.75, -0.3, 3.0, 1.1)):
        g.sphere(r, loc=(tx + dx, ty + dy, dz), color=by_normal("leaf_oak_light", "leaf_oak", "leaf_oak"), ico=1,
                 jitter=0.07, seed=int(r * 10), scale=(1, 1, 0.8))
    for x in (-0.6, 0.6):
        g.box((0.08, 0.36, 0.42), loc=(tx + x, ty - 0.9, 0), color="wood_dark", base=True)
    g.box((1.5, 0.38, 0.05), loc=(tx, ty - 0.9, 0.42), color="wood_new", base=True)
    A.add("school_yard", g, parent=root)
    # la mairie-école
    bx0, bx1, by0, by1, t, ze, zr = 0.0, 5.4, -1.62, 2.45, 0.4, 3.7, 5.0
    hx, hy = (bx1 - bx0) / 2, (by1 - by0) / 2
    xc, yc = (bx0 + bx1) / 2, (by0 + by1) / 2
    g = A.geo()
    ops = {
        "front": [(-1.65, 0.9, 1.0, 2.9), (0.0, 1.1, 0.45, 2.75), (1.65, 0.9, 1.0, 2.9)],
        "back": [(-1.3, 0.9, 1.0, 2.9), (1.3, 0.9, 1.0, 2.9)],
        "left": [(0.9, 1.0, 0.0, 2.3), (-0.8, 0.9, 1.0, 2.9)],
        "right": [(0.0, 0.9, 1.0, 2.9)],
    }
    _walls(g, B, hx, hy, ze, t, ops, "stone", "plaster_cream")
    _plinth(g, B, hx, hy, ops, 0.5, "stone_dark")
    f = B.Face("front", hx, hy)
    for u in (-1.65, 1.65):
        glazed(g, f, u, 0.9, 1.0, 2.9, t, frame="white_paint", shutter="paint_blue")
    door_frame(g, f, 0.0, 1.1, 2.75, t, frame="stone_light", step=None)
    f.box(g, (0.96, 0.05, 2.25), 0.0, -t + 0.06, 0.45 + 1.12, "paint_blue")
    f.box(g, (0.86, 0.06, 0.32), 0.0, -t + 0.04, 2.5, "glass")
    # perron de trois marches de 15 cm sur 28 cm devant la porte de la mairie (seuil à 45 cm)
    for k in range(3):
        f.box(g, (1.7 - k * 0.2, 0.84 - k * 0.28, 0.15), 0.0, 0.42 - k * 0.14, 0.075 + 0.15 * k, "stone_light")
    # plaque MAIRIE au-dessus de la porte, plaque ECOLE sur le mur de la cour
    f.box(g, (1.6, 0.05, 0.36), 0.0, 0.025, 3.15, "stone_light")
    painted_word(g, f, 0.0, 0.054, 3.15, "MAIRIE", 0.044, "black")
    fl = B.Face("left", hx, hy)
    door_frame(g, fl, 0.9, 1.0, 2.3, t, frame="stone_light", step="stone")
    fl.box(g, (0.86, 0.05, 2.19), 0.9, -t + 0.06, 1.1, "paint_blue")
    glazed(g, fl, -0.8, 0.9, 1.0, 2.9, t, frame="white_paint", shutter="paint_blue")
    fl.box(g, (1.1, 0.05, 0.3), 0.9, 0.025, 2.65, "stone_light")
    painted_word(g, fl, 0.9, 0.054, 2.62, "ÉCOLE", 0.034, "black")
    for u in (-1.3, 1.3):
        glazed(g, B.Face("back", hx, hy), u, 0.9, 1.0, 2.9, t, frame="white_paint", shutter="paint_blue")
    glazed(g, B.Face("right", hx, hy), 0.0, 0.9, 1.0, 2.9, t, frame="white_paint", shutter="paint_blue")
    B.round_quoins(g, hx, hy, ze - 0.05, light=True)
    for x, s in ((-hx, 1), (hx, -1)):
        g.prism([(-hy, ze), (hy, ze), (0, zr - 0.22)], t, loc=(x + s * t / 2, 0, 0), color="stone", rot=(0, 0, 90))
    g.transform(list(g.bm.verts), lpl_translate((xc, yc, 0)))
    A.add("school_body", g, parent=root)
    r = A.geo()
    B.gable_roof(r, -hx, hx, -hy, hy, ze, zr, "lauze", edge="lauze_dark", over=0.35, ridge_color="lauze_dark")
    B.round_chimney(r, 1.6, 0.9, 4.4, 6.0)
    # clocheton sur le faîtage, côté cour: quatre poteaux, la cloche, un petit toit à quatre pans
    kx = -hx + 0.9
    rz = zr + 0.05
    r.box((0.7, 0.7, 0.35), loc=(kx, 0, rz - 0.25), color="lauze_dark", base=True)
    for sx in (1, -1):
        for sy in (1, -1):
            r.box((0.07, 0.07, 0.75), loc=(kx + sx * 0.28, sy * 0.28, rz + 0.1), color="wood_dark", base=True)
    r.lathe([(0.12, 0.0), (0.1, 0.12), (0.06, 0.24), (0.0, 0.26)], loc=(kx, 0, rz + 0.35), colors="brass", segs=8,
            close_bottom=False)
    r.box((0.6, 0.05, 0.05), loc=(kx, 0, rz + 0.65), color="wood_dark")
    r.cyl(0.55, 0.45, loc=(kx, 0, rz + 0.85), r2=0.02, color="lauze_dark", segs=4, base=True, rot=(0, 0, 45))
    r.transform(list(r.bm.verts), lpl_translate((xc, yc, 0)))
    A.add("school_roof", r, parent=root)
    return root


# Passages du ru de la Côte ---------------------------------------------------------------------------

def _arch_face(g, x0, x1, zb, zt, span, spring, crown, y, thick, color, ring="stone_light", n=8):
    """Tympan de pierre de x0 à x1 (z de zb à zt), percé d'un arc segmentaire centré en x = 0 (portée span,
    naissances à spring, clé à crown), épaisseur thick vers +Y depuis y. Claveaux autour de l'arc."""
    half = span / 2
    rise = crown - spring
    R = (half * half + rise * rise) / (2 * rise)
    zc = crown - R
    a0 = math.asin(half / R)
    arc = [(R * math.sin(-a0 + 2 * a0 * k / n), zc + R * math.cos(-a0 + 2 * a0 * k / n)) for k in range(n + 1)]
    left = [(x0, zb), (-half, zb), (-half, spring)] + arc[1:-1] + [(half, spring), (half, zb), (x1, zb), (x1, zt),
                                                                   (x0, zt)]
    g.prism(left, thick, loc=(0, y + thick / 2, 0), color=color, rot=(0, 0, 0))
    for k in range(n):
        a = -a0 + 2 * a0 * (k + 0.5) / n
        px, pz = R * math.sin(a), zc + R * math.cos(a)
        g.box((0.16, thick + 0.03, 0.24), loc=(px + math.sin(a) * 0.1, y + thick / 2, pz + math.cos(a) * 0.1),
              color=ring, rot=(0, math.degrees(a), 0))
    return R, zc, a0


def _vault(g, span, spring, crown, y0, y1, color="shadow", n=8):
    half = span / 2
    rise = crown - spring
    R = (half * half + rise * rise) / (2 * rise)
    zc = crown - R
    a0 = math.asin(half / R)
    for k in range(n):
        a, b = -a0 + 2 * a0 * k / n, -a0 + 2 * a0 * (k + 1) / n
        p = [(R * math.sin(a), zc + R * math.cos(a)), (R * math.sin(b), zc + R * math.cos(b))]
        g.quad([(p[0][0], y1, p[0][1]), (p[1][0], y1, p[1][1]), (p[1][0], y0, p[1][1]), (p[0][0], y0, p[0][1])],
               color)
    for s in (1, -1):
        g.quad([(s * half, y0, spring), (s * half, y1, spring), (s * half, y1, -0.9), (s * half, y0, -0.9)][::s],
               color)


def culvert(A):
    """Ponceau de la voie: la voie passe le ru sur une voûte de pierre (portée 1,5 m); têtes de pont arasées au
    niveau du ballast (4 cm: rien ne dépasse dans le gabarit du train), assises dans le lit du ru."""
    g = A.geo()
    L, span = 3.4, 1.5
    for y0 in (1.15, -1.55):
        _arch_face(g, -L / 2, L / 2, -0.95, 0.04, span, -0.55, -0.12, y0, 0.4, "stone")
    _vault(g, span, -0.55, -0.12, -1.15, 1.15)
    g.box((span, 3.1, 0.04), loc=(0, 0, -0.95), color="rock_dark", base=True)
    return g


def street_bridge(A):
    """Pont de pierre de la rue: tablier pavé au niveau de la rue (rien à enjamber pour la charrette), 2,2 m
    entre les parapets bas (0,65 m), arche segmentaire de 2 m sous le tablier, bouts de parapet en dés."""
    g = A.geo()
    L, half_w, span = 4.0, 1.1, 2.0
    # tablier pavé
    g.box((L, 2 * half_w, 0.06), loc=(0, 0, -0.04), color="cobble", base=True)
    for k in range(10):
        g.box((L, 0.02, 0.012), loc=(0, -half_w + 0.2 + k * 0.2, 0.02), color="cobble_dark", base=True)
    for s in (1, -1):
        y = s * half_w
        _arch_face(g, -L / 2, L / 2, -0.95, 0.02, span, -0.6, -0.18, y if s > 0 else y - 0.35, 0.35, "stone")
        g.box((L, 0.35, 0.63), loc=(0, y + s * 0.175, 0.02), color="stone", base=True)
        g.box((L + 0.1, 0.45, 0.1), loc=(0, y + s * 0.175, 0.65), color="stone_light", base=True, bevel=0.03)
        for sx in (1, -1):
            g.box((0.45, 0.45, 0.85), loc=(sx * (L / 2 - 0.1), y + s * 0.175, 0.0), color="stone_light", base=True,
                  bevel=0.04)
            g.box((0.52, 0.52, 0.08), loc=(sx * (L / 2 - 0.1), y + s * 0.175, 0.85), color="stone_dark", base=True)
    _vault(g, span, -0.6, -0.18, -half_w, half_w)
    g.box((span, 2 * half_w + 0.7, 0.04), loc=(0, 0, -0.95), color="rock_dark", base=True)
    return g


def footbridge(A):
    """Passerelle de la promenade: planches sur deux poutres de chêne posées sur des dés de pierre aux berges,
    1,6 m hors tout, garde-corps d'un côté (aval, au sud: +Z glTF) boulonné sur la poutre; platelage à 0,16 m,
    abouts en pente douce."""
    g = A.geo()
    L = 3.8
    for sx in (1, -1):
        g.box((0.5, 1.7, 0.55), loc=(sx * (L / 2 - 0.35), 0, -0.45), color="stone", base=True, bevel=0.03)
    for y in (-0.7, 0.7):
        g.box((L - 0.3, 0.16, 0.2), loc=(0, y, -0.08), color="wood_dark", base=True)
    n = 19
    for k in range(n):
        x = -L / 2 + 0.25 + k * (L - 0.5) / (n - 1)
        g.box((0.17, 1.5, 0.04), loc=(x, 0.0, 0.12), color="wood" if k % 2 else "wood_new", base=True)
    # abouts: une planche inclinée de chaque côté, du sol au platelage
    for sx in (1, -1):
        g.box((0.45, 1.5, 0.04), loc=(sx * (L / 2 + 0.03), 0, 0.065), color="wood_old",
              rot=(0, sx * math.degrees(math.atan2(0.13, 0.45)), 0))
    # garde-corps côté aval (-Y Blender = +Z glTF): poteaux boulonnés sur la face de la poutre, lisses dessus
    yr = -0.78 - 0.035
    for k in range(4):
        x = -L / 2 + 0.45 + k * (L - 0.9) / 3
        g.box((0.07, 0.07, 1.12), loc=(x, yr, -0.06), color="wood_dark", base=True)
        g.box((0.03, 0.03, 0.03), loc=(x, yr - 0.04, 0.02), color="iron")
    g.box((L - 0.8, 0.09, 0.06), loc=(0, yr, 1.06), color="wood", base=True)
    g.box((L - 0.8, 0.04, 0.05), loc=(0, yr + 0.05, 0.55), color="wood_dark", base=True)
    return g


def ford_stones(A):
    """Gué de pierres plates: quatre dalles posées en travers du ru, dessus à 12 cm sous la berge (au-dessus de
    l'eau), espacées d'un pas de saut (0,55 m), assises dans le lit."""
    g = A.geo()
    rnd = random.Random(63)
    for k, x in enumerate((-0.85, -0.3, 0.27, 0.82)):
        y = rnd.uniform(-0.08, 0.08)
        r = rnd.uniform(0.2, 0.25)
        g.cyl(r, 0.7, loc=(x, y, -0.82), r2=r * 0.92, color=by_normal("rock_light", "rock"), segs=7, base=True,
              rot=(0, 0, rnd.uniform(0, 50)), scale=(1.15, 0.95, 1))
    return g
