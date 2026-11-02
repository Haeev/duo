"""Tour 10: la maison qui grandit (conception, section 4) et les fenêtres de la maisonnette (section 6).

- `gatekeeper_cellar`: le cellier, appentis de planches contre le pignon ouest (emprise x 2 à 4, y 21 à 26;
  pièce x 3 et 4, y 22 à 25), toit à un pan (faîtage à 2,6 m contre le pignon), fenestron au nord;
- `gatekeeper_bedroom`: la chambre, aile nord à pans de bois et bardage (emprise x 5 à 11, y 16 à 21; pièce
  x 6 à 10, y 17 à 20), toit à deux pans perpendiculaire à celui de la maison, raccordé à son pan nord (noues);
  la panne faîtière de 5 m va du pignon nord au mur nord de la maison;
- `gatekeeper_house_wall_left_door` et `gatekeeper_house_wall_back_door`: les murs ouest et nord de la
  maisonnette réparée une fois la fenêtre devenue porte (le linteau reste, l'appui disparaît);
- nœuds vides `window_1` à `window_8` sous `gatekeeper_house` (centre de la fenêtre au nu intérieur du mur).

Origine des deux pièces = origine de `gatekeeper_house` (même position et rotation sur la carte). Les éléments
du chantier (4.3) sont des nœuds à part, dans l'ordre de la conception (extra `elements`): le jeu les montre
en fantôme (transparence) puis bâtis. Les tuiles (`<pièce>_roof`) et la porte percée ne paraissent qu'au matin
du `room_built`.
"""
import math

import lpl
from lpl import by_normal
from interieurs import door_leaf, pierced_wall


def _B():
    import bourg
    return bourg


GH = dict(hx=2.8, hy=2.3, ze=2.4, zr=3.9, t=0.3, floor=0.12)
WEST_WINDOW_U = 0.5   # fenêtre ouest de la maisonnette, centrée sur la case de la future porte (y 24)
BACK_WINDOW_U = -1.0  # fenêtre du fond (nord), Blender x = 1,0, case x 9 de la carte

# Fenêtres: (n, pièce, côté sur la carte, centre Blender (x, y), z bas, largeur, hauteur, normale vers la pièce,
# rideaux, devient)
WINDOWS = [
    (1, "main", "south", (1.7, -2.0), 0.95, 0.75, 0.9, (0, 1), True, None),
    (2, "main", "south", (-1.7, -2.0), 0.95, 0.75, 0.9, (0, 1), True, None),
    (3, "main", "north", (-BACK_WINDOW_U, 2.0), 1.0, 0.7, 0.8, (0, -1), True, "room_bedroom"),
    (4, "main", "west", (-2.5, -WEST_WINDOW_U), 1.0, 0.7, 0.8, (1, 0), True, "room_cellar"),
    (5, "main", "east", (2.5, 0.0), 1.0, 0.7, 0.8, (-1, 0), True, None),
    (6, "cellar", "north", (-4.5, 2.22), 1.3, 0.4, 0.3, (0, -1), False, None),
    (7, "bedroom", "north", (-0.9, 7.2), 1.0, 0.7, 0.8, (0, -1), True, None),
    (8, "bedroom", "east", (2.7, 4.7), 1.0, 0.7, 0.8, (-1, 0), True, None),
]


def window_nodes(root):
    """Nœuds vides window_<n> (repère glTF de la maisonnette: x, hauteur du centre, z = -y Blender) et extra
    `windows` sur la racine."""
    out = []
    for (n, room, side, (x, y), zb, w, h, nrm, curt, becomes) in WINDOWS:
        e = lpl.empty(f"window_{n}", parent=root, loc=(x, y, zb + h / 2), size=0.15)
        info = {"room": room, "side": side, "width": w, "height": h, "sill_y": zb,
                "inward": [nrm[0], 0, -nrm[1]], "curtains": curt}
        if becomes:
            info["becomes_door"] = becomes
        if not curt:
            info["refusal"] = "cellar_window"
        for k, v in info.items():
            e[k] = v
        out.append(dict(info, node=f"window_{n}", center=[round(x, 3), round(zb + h / 2, 3), round(-y, 3)]))
    root["windows"] = out
    return out


def inner_window(g, f, u, zb, w, h, t, frame="paint_cream"):
    """Fenêtre vue de dedans sur un mur plein (maisonnette): embrasure sombre, vitre, dormant, tablette."""
    f.box(g, (w + 0.04, 0.02, h + 0.04), u, -t - 0.01, zb + h / 2, "shadow")
    f.box(g, (w - 0.06, 0.02, h - 0.06), u, -t - 0.02, zb + h / 2, "glass")
    for s in (1, -1):
        f.box(g, (0.06, 0.04, h), u + s * (w / 2 - 0.03), -t - 0.03, zb + h / 2, frame)
    f.box(g, (w - 0.12, 0.04, 0.05), u, -t - 0.03, zb + h - 0.025, frame)
    f.box(g, (0.04, 0.04, h - 0.1), u, -t - 0.035, zb + h / 2, frame)
    f.box(g, (w + 0.1, 0.12, 0.04), u, -t - 0.06, zb - 0.02, "wood")


# Murs de la maisonnette avec la porte percée --------------------------------------------------------

def house_wall_door(A, side, parent):
    """Mur ouest (cellier) ou nord (chambre) de la maisonnette réparée, la fenêtre devenue porte: ouverture de
    0,9 x 2,05 m au droit de l'ancienne fenêtre, jambages de pierre, linteau de l'ancienne fenêtre gardé."""
    B = _B()
    hx, hy, ze, zr, t = GH["hx"], GH["hy"], GH["ze"], GH["zr"], GH["t"]
    g = A.geo()
    f = B.Face(side, hx, hy)
    L = 2 * hx if side == "back" else 2 * hy - 2 * t
    inward = {"back": (0, -1, 0), "left": (1, 0, 0)}[side]
    col = B.wall_color("stone", "plaster_cream", inward)
    u = BACK_WINDOW_U if side == "back" else WEST_WINDOW_U
    pierced_wall(g, f, L, t, ze, [(u, 0.9, 0.0, 2.05)], col)
    for (a, b) in ((-L / 2, u - 0.45), (u + 0.45, L / 2)):
        f.box(g, (b - a + (0.02 if side == "back" else 0), t + 0.06, 0.28), (a + b) / 2, -t / 2, 0.14,
              by_normal("stone_dark", "stone_dark"))
    B.stone_texture(g, f, L, ze, n=5, seed={"back": 2, "left": 3}[side])
    for s in (1, -1):
        f.box(g, (0.14, t + 0.04, 2.05), u + s * 0.52, -t / 2, 1.025, "stone_light")
    f.box(g, (1.2, t + 0.04, 0.16), u, -t / 2, 2.13, "stone_light")
    f.box(g, (1.3, 0.4, 0.1), u, -t / 2, 0.05, "stone_dark")
    if side == "left":
        x = -hx + t / 2
        g.prism([(-hy, ze), (hy, ze), (0, zr - 0.15)], t, loc=(x, 0, 0), color=col, rot=(0, 0, 90))
        B.quoins(g, hx, hy, ze, sxs=(-1,))
    return A.add(f"gatekeeper_house_wall_{side}_door", g, parent=parent)


# Le cellier ----------------------------------------------------------------------------------------

CEL = dict(x0=-5.8, x1=-2.8, y0=-2.3, y1=2.3, ze=1.95, zr=2.6, fl=0.12, over=0.25)


def poly_slab(g, top, thick, color):
    """Plaque d'épaisseur thick sous un polygone plan (ordre quelconque: remis dans le sens trigonométrique)."""
    from mathutils import Vector
    pts = [Vector(p) for p in top]
    area = sum(pts[i].x * pts[(i + 1) % len(pts)].y - pts[(i + 1) % len(pts)].x * pts[i].y for i in range(len(pts)))
    if area < 0:
        pts.reverse()
    n = (pts[1] - pts[0]).cross(pts[2] - pts[1])
    n = n.normalized() if n.z > 0 else -n.normalized()
    T = [g.bm.verts.new(tuple(p)) for p in pts]
    Bv = [g.bm.verts.new(tuple(p - n * thick)) for p in pts]
    g.bm.faces.new(T)
    g.bm.faces.new(list(reversed(Bv)))
    m = len(pts)
    for i in range(m):
        j = (i + 1) % m
        g.bm.faces.new([T[j], T[i], Bv[i], Bv[j]])
    return g._finish(T + Bv, color)


def _plank_wall_x(g, x, y0, y1, z0, z1_at, t, color="wood", openings=()):
    """Bardage vertical d'un mur le long de Y en x (épaisseur t centrée), planches de 0,2 m; z1_at(y) donne le
    haut (chaque planche s'arrête sous le plus bas de ses deux bords). openings: [(y, largeur, bas, haut)]."""
    n = max(1, int(round((y1 - y0) / 0.2)))
    for k in range(n):
        ya, yb = y0 + (y1 - y0) * k / n, y0 + (y1 - y0) * (k + 1) / n
        ym = (ya + yb) / 2
        top = min(z1_at(ya + 0.004), z1_at(yb - 0.004))
        segs = [(z0, top)]
        for (oy, ow, oz0, oz1) in openings:
            if abs(ym - oy) < ow / 2:
                a, b = segs.pop()
                segs += [(a, oz0), (oz1, b)]
        for (a, b) in segs:
            if b - a > 0.02:
                g.box((t, yb - ya - 0.008, b - a), loc=(x, ym, a), color=color if k % 2 else "wood_new", base=True)


def _plank_wall_y(g, y, x0, x1, z0, z1_at, t, color="wood", openings=()):
    n = max(1, int(round((x1 - x0) / 0.2)))
    for k in range(n):
        xa, xb = x0 + (x1 - x0) * k / n, x0 + (x1 - x0) * (k + 1) / n
        xm = (xa + xb) / 2
        top = min(z1_at(xa + 0.004), z1_at(xb - 0.004))
        segs = [(z0, top)]
        for (ox, ow, oz0, oz1) in openings:
            if abs(xm - ox) < ow / 2:
                a, b = segs.pop()
                segs += [(a, oz0), (oz1, b)]
        for (a, b) in segs:
            if b - a > 0.02:
                g.box((xb - xa - 0.008, t, b - a), loc=(xm, y, a), color=color if k % 2 else "wood_new", base=True)


def cellar(A):
    """Faîtage à 2,6 m contre le pignon, perpendiculaire à lui: un petit toit à deux pans glissé sous la rive du
    toit de la maison. Un seul pan de 2,6 m sur toute la largeur passerait par-dessus les coins de cette rive
    (dessous à 2,1 m aux angles); abaissé dessous, il serait trop plat pour la tuile et trop bas pour la tête.
    Égouts à 1,95 m au nord et au sud, pignon de planches à l'ouest: les étagères hautes s'y adossent, on se
    tient debout dans l'allée côté maison."""
    C = CEL
    x0, x1, y0, y1, ze, zr, fl, ov = C["x0"], C["x1"], C["y0"], C["y1"], C["ze"], C["zr"], C["fl"], C["over"]
    hw = (y1 - y0) / 2
    slope = (zr - ze) / hw

    def under(y):
        """Dessous des chevrons en y (le pignon s'arrête dessous)."""
        return zr - abs(y) * slope - 0.2

    elements = [
        {"id_hint": "post_1", "nodes": ["gatekeeper_cellar_post_1"], "planks": 2, "nails": 1},
        {"id_hint": "post_2", "nodes": ["gatekeeper_cellar_post_2"], "planks": 2, "nails": 1},
        {"id_hint": "plate", "nodes": ["gatekeeper_cellar_plate"], "planks": 3, "nails": 2,
         "needs": ["post_1", "post_2"]},
        {"id_hint": "wall_1", "nodes": ["gatekeeper_cellar_wall_left"], "planks": 3, "nails": 1, "needs": ["plate"]},
        {"id_hint": "wall_2", "nodes": ["gatekeeper_cellar_wall_back", "gatekeeper_cellar_wall_front"], "planks": 3,
         "nails": 1, "needs": ["plate"]},
        {"id_hint": "roof", "nodes": ["gatekeeper_cellar_roof_frame"], "planks": 3, "nails": 2,
         "needs": ["wall_1", "wall_2"]},
    ]
    root = A.group("gatekeeper_cellar", {
        "room": "room_cellar", "attach": "gatekeeper_house (même origine, même rotation)",
        "footprint_world": {"x": [2, 5], "y": [21, 27]}, "interior": {"x": [-5.5, -2.8], "z": [-2.0, 2.0],
                                                                     "floor_y": fl},
        "elements": elements, "built_nodes": ["gatekeeper_cellar_roof", "gatekeeper_cellar_door"],
        "site_nodes": ["gatekeeper_cellar_floor"],
        "cut_nodes": ["gatekeeper_cellar_roof", "gatekeeper_cellar_roof_frame"],
        "rack_spots": [{"x": -5.0, "z": -1.0, "facing": "+x", "cells": [[3, 22], [3, 23]]},
                       {"x": -5.0, "z": 1.0, "facing": "+x", "cells": [[3, 24], [3, 25]]}],
        "note": "repère de gatekeeper_house. site_nodes dès le matin du site; éléments en fantôme puis bâtis; "
                "built_nodes au matin de room_built, avec gatekeeper_house_wall_left_door à la place de "
                "gatekeeper_house_repaired_wall_left. rack_spots: les deux places d'étagère haute, dos au pignon "
                "ouest (cases de la carte pour la maisonnette en (8,5 ; 24), rotation 0)"})
    B = _B()
    g = A.geo()
    # sol de dalles à 0,12 m (même niveau que le plancher de la pièce), solin de pierre sous les murs
    g.box((x1 - x0, y1 - y0, fl - 0.01), loc=((x0 + x1) / 2, 0, 0), color="stone_dark", base=True)
    for i in range(5):
        for j in range(8):
            xx = x0 + 0.27 + i * 0.52 + (0.13 if j % 2 else 0)
            yy = y0 + 0.27 + j * 0.47
            if xx + 0.45 > x1 - 0.02 or yy + 0.42 > y1 - 0.25:
                continue
            g.quad([(xx, yy, fl), (xx + 0.45, yy, fl), (xx + 0.45, yy + 0.42, fl), (xx, yy + 0.42, fl)],
                   "stone" if (i + j) % 3 else "stone_light")
    for (a, b, c, d) in ((x0, x0 + 0.24, y0, y1), (x0 + 0.24, x1, y1 - 0.24, y1), (x0 + 0.24, x1, y0, y0 + 0.24)):
        g.box((b - a, d - c, 0.25), loc=((a + b) / 2, (c + d) / 2, 0), color="stone", base=True)
    A.add("gatekeeper_cellar_floor", g, parent=root)
    # poteaux d'angle sur le solin, sous les sablières
    for k, y in enumerate((y1 - 0.12, y0 + 0.12)):
        g = A.geo()
        g.box((0.14, 0.14, ze - 0.25 - 0.14), loc=(x0 + 0.12, y, 0.25), color="wood_dark", base=True)
        A.add(f"gatekeeper_cellar_post_{k + 1}", g, parent=root)
    # sablières nord et sud: des poteaux au pignon de la maison, où elles s'appuient
    g = A.geo()
    for y in (y1 - 0.12, y0 + 0.12):
        g.box((x1 - x0 - 0.05, 0.16, 0.14), loc=((x0 + x1) / 2 + 0.025, y, ze - 0.14), color="wood_dark", base=True)
        g.box((0.04, 0.24, 0.04), loc=(x0 + 0.04, y, ze - 0.1), color="iron")
    A.add("gatekeeper_cellar_plate", g, parent=root)
    # pignon ouest (plein) et murs nord (fenestron) et sud, en planches
    g = A.geo()
    _plank_wall_x(g, x0 + 0.03, y0 + 0.2, y1 - 0.2, 0.25, under, 0.04)
    for z in (0.6, 1.3):
        g.box((0.05, y1 - y0 - 0.4, 0.08), loc=(x0 + 0.07, 0, z), color="wood_dark", base=True)
    A.add("gatekeeper_cellar_wall_left", g, parent=root)
    fx, fw, fz0, fz1 = -4.5, 0.4, 1.3, 1.6
    for side, y, ops in (("back", y1 - 0.06, [(fx, fw, fz0, fz1)]), ("front", y0 + 0.06, [])):
        g = A.geo()
        _plank_wall_y(g, y, x0 + 0.19, x1, 0.25, lambda x: ze - 0.14, 0.04, openings=ops)
        g.box((x1 - x0 - 0.19, 0.05, 0.08), loc=((x0 + 0.19 + x1) / 2, y + (0.045 if side == "back" else -0.045), 0.6),
              color="wood_dark", base=True)
        if ops:
            for sx in (1, -1):
                g.box((0.05, 0.07, fz1 - fz0 + 0.1), loc=(fx + sx * (fw / 2 + 0.025), y, fz0 - 0.05), color="wood_dark",
                      base=True)
            for zz in (fz0 - 0.05, fz1):
                g.box((fw + 0.1, 0.07, 0.05), loc=(fx, y, zz), color="wood_dark", base=True)
            g.box((fw, 0.012, fz1 - fz0), loc=(fx, y, fz0), color="glass", base=True)
            g.box((0.03, 0.02, fz1 - fz0), loc=(fx, y, fz0), color="wood_dark", base=True)
        A.add(f"gatekeeper_cellar_wall_{side}", g, parent=root)
    # charpente: panne faîtière du pignon ouest au pignon de la maison (sur un poinçon), chevrons, voliges
    g = A.geo()
    g.box((x1 - x0 + ov, 0.12, 0.14), loc=((x0 - ov + x1) / 2, 0, zr - 0.33), color="wood_dark", base=True)
    g.box((0.12, 0.12, zr - 0.33 - ze + 0.14), loc=(x0 + 0.12, 0, ze - 0.14), color="wood_dark", base=True)
    a = math.degrees(math.atan(slope))
    Lr = (hw + ov) / math.cos(math.atan(slope))
    for k in range(5):
        x = x0 - ov + 0.1 + k * (x1 - x0 + ov - 0.25) / 4
        for sy in (1, -1):
            g.box((0.07, Lr, 0.09), loc=(x, sy * (hw + ov) / 2, zr - (hw + ov) / 2 * slope - 0.13), color="wood_dark",
                  rot=(-sy * a, 0, 0))
    for sy in (1, -1):
        poly_slab(g, [(x0 - ov, 0, zr - 0.06), (x1, 0, zr - 0.06), (x1, sy * (hw + ov), zr - 0.06 - (hw + ov) * slope),
                      (x0 - ov, sy * (hw + ov), zr - 0.06 - (hw + ov) * slope)], 0.025, "wood_old")
    A.add("gatekeeper_cellar_roof_frame", g, parent=root)
    # tuiles posées la nuit par Basile et Firmin; boudin de faîtage; solin de mortier contre le pignon
    g = A.geo()
    for sy in (1, -1):
        poly_slab(g, [(x0 - ov, 0, zr), (x1, 0, zr), (x1, sy * (hw + ov), zr - (hw + ov) * slope),
                      (x0 - ov, sy * (hw + ov), zr - (hw + ov) * slope)], 0.035,
                  by_normal("lauze", "lauze_dark", "lauze_dark"))
        for k in range(1, 5):
            yy = sy * (hw + ov) * k / 5
            g.box((x1 - x0 + ov - 0.02, 0.05, 0.025), loc=((x0 - ov + x1) / 2, yy, zr - abs(yy) * slope + 0.012),
                  color="lauze_dark", rot=(-sy * a, 0, 0))
    g.cyl(0.08, x1 - x0 + ov + 0.03, loc=((x0 - ov + x1) / 2, 0, zr + 0.02), color="lauze_dark", segs=8, rot=(0, 90, 0))
    for sy in (1, -1):
        g.box((0.08, hw + ov, 0.1), loc=(x1 - 0.02, sy * (hw + ov) / 2, zr - (hw + ov) / 2 * slope + 0.02),
              color="stone_light", rot=(-sy * a, 0, 0))
    A.add("gatekeeper_cellar_roof", g, parent=root)
    door_leaf(A, "gatekeeper_cellar_door", root, B.Face("left", GH["hx"], GH["hy"]), WEST_WINDOW_U, 0.9, 2.05,
              GH["t"], color="wood", panel="wood_dark")
    return root


# La chambre ----------------------------------------------------------------------------------------

BED = dict(x0=-2.8, x1=2.8, y0=2.3, y1=7.3, ze=2.0, zr=3.6, fl=0.12, over=0.3, truss_y=2.78)


def bedroom(A):
    """Égouts à 2,0 m: sablières et murs passent sous le débord du toit de la maison (dessous à 2,03 m au bord)
    sans le toucher. La ferme est juste au nord de ce débord (y 2,78) et la panne faîtière de 4,8 m va d'elle au
    pignon nord. Les tuiles rejoignent le pan nord de la maison par deux noues."""
    D = BED
    x0, x1, y0, y1, ze, zr, fl, ov = D["x0"], D["x1"], D["y0"], D["y1"], D["ze"], D["zr"], D["fl"], D["over"]
    hw = (x1 - x0) / 2
    slope = (zr - ze) / hw
    hslope = (GH["zr"] - GH["ze"]) / GH["hy"]
    ty = D["truss_y"]
    elements = [{"id_hint": f"post_{k + 1}", "nodes": [f"gatekeeper_bedroom_post_{k + 1}"], "planks": 2, "nails": 1}
                for k in range(4)]
    elements += [{"id_hint": f"plate_{k + 1}", "nodes": [f"gatekeeper_bedroom_plate_{k + 1}"], "planks": 3, "nails": 1,
                  "needs": ["post_1", "post_2", "post_3", "post_4"]} for k in range(2)]
    elements += [{"id_hint": f"wall_{k + 1}", "nodes": [n], "planks": 3, "nails": 1, "needs": ["plate_1", "plate_2"]}
                 for k, n in enumerate(("gatekeeper_bedroom_wall_left", "gatekeeper_bedroom_wall_right",
                                        "gatekeeper_bedroom_wall_back", "gatekeeper_bedroom_wall_back_gable"))]
    elements += [{"id_hint": "truss_ridge", "nodes": ["gatekeeper_bedroom_truss"], "planks": 4, "nails": 2,
                  "needs": ["wall_1", "wall_2", "wall_3", "wall_4"], "after_carry": "ridge_purlin"},
                 {"id_hint": "floor", "nodes": ["gatekeeper_bedroom_floor"], "planks": 6, "nails": 2}]
    root = A.group("gatekeeper_bedroom", {
        "room": "room_bedroom", "attach": "gatekeeper_house (même origine, même rotation)",
        "footprint_world": {"x": [5, 12], "y": [16, 22]}, "interior": {"x": [-2.5, 2.5], "z": [-7.0, -2.3],
                                                                      "floor_y": fl},
        "elements": elements, "built_nodes": ["gatekeeper_bedroom_roof", "gatekeeper_bedroom_door"],
        "site_nodes": ["gatekeeper_bedroom_sill"],
        "cut_nodes": ["gatekeeper_bedroom_roof", "gatekeeper_bedroom_truss", "gatekeeper_bedroom_wall_back_gable"],
        "ridge_purlin": {"from": [0.0, zr - 0.08, -ty], "to": [0.0, zr - 0.08, -(y1 + ov)],
                         "length": round(y1 + ov - ty, 2),
                         "note": "dessus de la panne posée (repère de la maisonnette): là où le porter à deux l'amène"},
        "furniture_spots": {"double_bed": [-1.25, -5.9], "dresser": [1.75, -6.65], "armchair": [1.9, -3.4]},
        "note": "repère de gatekeeper_house. site_nodes dès le matin du site; éléments en fantôme puis bâtis; "
                "built_nodes au matin de room_built, avec gatekeeper_house_wall_back_door à la place de "
                "gatekeeper_house_repaired_wall_back"})
    B = _B()
    g = A.geo()
    n = int(round((y1 - y0 - 0.2) / 0.3))
    g.box((x1 - x0 - 0.3, y1 - y0 - 0.2, 0.08), loc=(0, (y0 + y1) / 2 - 0.05, 0), color="stone_dark", base=True)
    for k in range(n):
        yy = y0 + 0.05 + (y1 - y0 - 0.2) * (k + 0.5) / n
        g.box((x1 - x0 - 0.3, (y1 - y0 - 0.2) / n - 0.01, fl - 0.08), loc=(0, yy, 0.08),
              color="wood_new" if k % 2 else "wood", base=True)
    A.add("gatekeeper_bedroom_floor", g, parent=root)
    g = A.geo()
    for (a, b, c, d) in ((x0, x0 + 0.24, y0, y1), (x1 - 0.24, x1, y0, y1), (x0 + 0.24, x1 - 0.24, y1 - 0.24, y1)):
        g.box((b - a, d - c, 0.25), loc=((a + b) / 2, (c + d) / 2, 0), color="stone", base=True)
    A.add("gatekeeper_bedroom_sill", g, parent=root)
    posts = [(x0 + 0.12, y1 - 0.12), (x1 - 0.12, y1 - 0.12), (x0 + 0.12, y0 + 0.1), (x1 - 0.12, y0 + 0.1)]
    for k, (px, py) in enumerate(posts):
        g = A.geo()
        g.box((0.15, 0.15, ze - 0.25 - 0.15), loc=(px, py, 0.25), color="wood_dark", base=True)
        A.add(f"gatekeeper_bedroom_post_{k + 1}", g, parent=root)
    for k, px in enumerate((x0 + 0.12, x1 - 0.12)):
        g = A.geo()
        g.box((0.16, y1 - y0, 0.15), loc=(px, (y0 + y1) / 2, ze - 0.15), color="wood_dark", base=True)
        A.add(f"gatekeeper_bedroom_plate_{k + 1}", g, parent=root)
    _, _, _, (wx7, _), zb7, w7, h7, _, _, _ = WINDOWS[6]
    _, _, _, (_, wy8), zb8, w8, h8, _, _, _ = WINDOWS[7]
    for side, x, ops in (("left", x0 + 0.05, []), ("right", x1 - 0.05, [(wy8, w8, zb8, zb8 + h8)])):
        g = A.geo()
        _plank_wall_x(g, x, y0 + 0.18, y1 - 0.2, 0.25, lambda y: ze - 0.15, 0.05, openings=ops)
        g.box((0.05, y1 - y0 - 0.4, 0.08), loc=(x + (-0.05 if side == "left" else 0.05), (y0 + y1) / 2, 0.75),
              color="wood_dark", base=True)
        if ops:
            _frame_window_x(g, x, wy8, zb8, w8, h8, outward=1)
        A.add(f"gatekeeper_bedroom_wall_{side}", g, parent=root)
    g = A.geo()
    _plank_wall_y(g, y1 - 0.05, x0 + 0.2, x1 - 0.2, 0.25, lambda x: ze - 0.15, 0.05, openings=[(wx7, w7, zb7, zb7 + h7)])
    g.box((x1 - x0 - 0.4, 0.05, 0.08), loc=(0, y1, 0.75), color="wood_dark", base=True)
    _frame_window_y(g, y1 - 0.05, wx7, zb7, w7, h7, outward=1)
    A.add("gatekeeper_bedroom_wall_back", g, parent=root)
    # pignon nord: entrait, poinçon qui porte le bout de la panne, bardage sous les chevrons de rive
    g = A.geo()
    g.box((x1 - x0, 0.12, 0.12), loc=(0, y1 - 0.08, ze - 0.02), color="wood_dark", base=True)
    g.box((0.12, 0.12, zr - 0.28 - ze - 0.1), loc=(0, y1 - 0.08, ze + 0.1), color="wood_dark", base=True)
    _plank_wall_y(g, y1 - 0.02, x0 + 0.1, x1 - 0.1, ze + 0.1, lambda x: zr - abs(x) * slope - 0.2, 0.04)
    A.add("gatekeeper_bedroom_wall_back_gable", g, parent=root)
    # la ferme (entrait, arbalétriers, poinçon) au sud, la panne faîtière portée à deux, les chevrons
    g = A.geo()
    g.box((x1 - x0 - 0.1, 0.14, 0.15), loc=(0, ty, ze - 0.15), color="wood_dark", base=True)
    L = math.hypot(hw, zr - ze)
    a = math.degrees(math.atan2(zr - ze, hw))
    for s in (1, -1):
        g.box((L - 0.1, 0.14, 0.14), loc=(s * hw / 2, ty, (ze + zr) / 2 - 0.2), color="wood_dark", rot=(0, s * a, 0))
    g.box((0.13, 0.14, zr - 0.28 - ze), loc=(0, ty, ze), color="wood_dark", base=True)
    g.box((0.16, y1 + ov - ty, 0.2), loc=(0, (y1 + ov + ty) / 2, zr - 0.28), color="wood", base=True)
    Lc = (hw + ov) / math.cos(math.radians(a))
    for k in range(5):
        yy = ty + 0.35 + k * (y1 + ov - ty - 0.5) / 4
        for s in (1, -1):
            g.box((Lc, 0.07, 0.09), loc=(s * (hw + ov) / 2, yy, zr - (hw + ov) / 2 * slope - 0.14), color="wood_dark",
                  rot=(0, s * a, 0))
    A.add("gatekeeper_bedroom_truss", g, parent=root)
    g = A.geo()
    _bedroom_roof(g, D, hslope)
    A.add("gatekeeper_bedroom_roof", g, parent=root)
    door_leaf(A, "gatekeeper_bedroom_door", root, B.Face("back", GH["hx"], GH["hy"]), BACK_WINDOW_U, 0.9, 2.05,
              GH["t"], color="wood", panel="wood_dark")
    return root


def _frame_window_x(g, x, y, zb, w, h, outward=1):
    """Fenêtre dans un pan de bardage le long de Y: dormant, vitre, tablette dedans, appui et volets dehors."""
    d = 0.05
    for s in (1, -1):
        g.box((0.09, 0.07, h + 0.1), loc=(x, y + s * (w / 2 + 0.035), zb - 0.05), color="paint_cream", base=True)
    for zz in (zb - 0.05, zb + h):
        g.box((0.09, w + 0.14, 0.06), loc=(x, y, zz), color="paint_cream", base=True)
    g.box((0.012, w, h), loc=(x, y, zb), color="glass", base=True)
    g.box((0.03, 0.03, h), loc=(x, y, zb), color="paint_cream", base=True)
    g.box((0.14, w + 0.2, 0.04), loc=(x + outward * 0.08, y, zb - 0.09), color="wood", base=True)
    g.box((0.14, w + 0.1, 0.035), loc=(x - outward * 0.08, y, zb - 0.04), color="wood", base=True)
    for s in (1, -1):
        g.box((0.035, w / 2, h), loc=(x + outward * (d + 0.03), y + s * (w * 0.75 + 0.05), zb), color="paint_blue",
              base=True)


def _frame_window_y(g, y, x, zb, w, h, outward=1):
    d = 0.05
    for s in (1, -1):
        g.box((0.07, 0.09, h + 0.1), loc=(x + s * (w / 2 + 0.035), y, zb - 0.05), color="paint_cream", base=True)
    for zz in (zb - 0.05, zb + h):
        g.box((w + 0.14, 0.09, 0.06), loc=(x, y, zz), color="paint_cream", base=True)
    g.box((w, 0.012, h), loc=(x, y, zb), color="glass", base=True)
    g.box((0.03, 0.03, h), loc=(x, y, zb), color="paint_cream", base=True)
    g.box((w + 0.2, 0.14, 0.04), loc=(x, y + outward * 0.08, zb - 0.09), color="wood", base=True)
    g.box((w + 0.1, 0.14, 0.035), loc=(x, y - outward * 0.08, zb - 0.04), color="wood", base=True)
    for s in (1, -1):
        g.box((w / 2, 0.035, h), loc=(x + s * (w * 0.75 + 0.05), y + outward * (d + 0.03), zb), color="paint_blue",
              base=True)




def _bedroom_roof(g, D, hslope):
    """Deux pans de tuiles du pignon nord (débord de 0,3 m) jusqu'au toit de la maison. Au sud, chaque pan suit
    la noue (son intersection avec le dessus du toit de la maison abaissé de 6 cm: le bord entre dans l'épaisseur
    de ce toit) jusqu'au bord de son débord nord (y 2,65); au-delà, vers l'égout, le pan passe sous ce débord
    jusqu'au mur nord de la maison (y 2,3): l'aile basse se glisse sous l'avant-toit."""
    x0, x1, y1, ze, zr, ov = D["x0"], D["x1"], D["y1"], D["ze"], D["zr"], D["over"]
    hw = (x1 - x0) / 2
    slope = (zr - ze) / hw
    zrr = zr + 0.03
    hzr = GH["zr"] + 0.03 - 0.06
    heave = GH["hy"] + 0.35

    def zw(x):
        return zrr - abs(x) * slope

    def yv(z):
        return (hzr - z) / hslope

    xe = hw + ov
    xs = (zrr - (hzr - heave * hslope)) / slope
    a = math.degrees(math.atan(slope))
    for s in (1, -1):
        pts = [(0.0, y1 + ov, zrr), (0.0, yv(zrr), zrr), (s * xs, heave, zw(xs)), (s * xs, GH["hy"], zw(xs)),
               (s * xe, GH["hy"], zw(xe)), (s * xe, y1 + ov, zw(xe))]
        poly_slab(g, pts, 0.05, by_normal("lauze", "lauze_dark", "lauze_dark"))
        for k in range(1, 6):
            x = s * xe * (1 - k / 6)
            z = zw(x)
            ys = max(GH["hy"], yv(z)) if abs(x) > xs else yv(z)
            g.box((0.04, y1 + ov - ys - 0.04, 0.025), loc=(x, (y1 + ov + ys) / 2 + 0.02, z + 0.012), color="lauze_dark",
                  rot=(0, -s * a, 0))
    yr = yv(zrr)
    g.cyl(0.1, y1 + ov - yr, loc=(0, (y1 + ov + yr) / 2, zrr + 0.02), color="lauze_dark", segs=8, rot=(90, 0, 0))
    for s in (1, -1):
        L = math.hypot(xe, xe * slope)
        g.box((L, 0.04, 0.16), loc=(s * xe / 2, y1 + ov - 0.02, (zrr + zw(xe)) / 2 - 0.1), color="wood_dark",
              rot=(0, s * a, 0))
