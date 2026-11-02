"""Tour 10 (conception, sections 5 et 6): rangement à cases et rideaux aux fenêtres.

- `oak_chest`: grand coffre de chêne, haut comme une commode (1 x 1);
- `cellar_rack`: étagère haute du cellier, du sol au plafond (1,68 m: le dessous des chevrons du cellier est à
  1,76 m au-dessus du sol aux bouts des deux places), 2 x 1, dos au mur;
- `tool_rack`: le râtelier près de la porte, 12 crochets (extra `hook_spots`), mural;
- `curtains_window`: rideaux posés à une fenêtre, deux états et une tringle: `curtains_rod`, puis pour chaque
  couleur `<article>_open` et `<article>_closed` (articles `curtains`, `curtains_blue`, `curtains_red`,
  `curtains_yellow`, `curtains_green`, `curtains_gingham`). Un seul matériau par fichier: une couleur = deux
  nœuds de plus (environ 400 triangles), plutôt qu'une variante de matériau.

Appelé par maison.py. Origine des meubles au centre de l'emprise, au sol, avant vers -Y (+Z glTF).
Rideaux: origine au centre de la fenêtre au nu intérieur du mur (le nœud `window_<n>` de la maisonnette),
la pièce vers -Y (+Z glTF); faits pour une fenêtre de 0,75 x 0,9 m: mettre à l'échelle en X selon `width`
(0,7 à 0,75) et en Y selon `height` (0,8 à 0,9) du nœud de la fenêtre.
"""
import math

from lpl import by_normal

CURTAIN_COLORS = {
    "curtains": "fabric_cream", "curtains_blue": "fabric_blue", "curtains_red": "fabric_red",
    "curtains_yellow": "fabric_yellow", "curtains_green": "fabric_green", "curtains_gingham": "gingham",
}
WIN_W, WIN_H = 0.75, 0.9


def oak_chest(A):
    """Grand coffre de chêne de 0,9 x 0,55 m, 0,85 m de haut: socle mouluré, panneaux, couvercle bombé, ferrures,
    poignées de côté. 32 cases."""
    g = A.geo()
    g.box((0.92, 0.58, 0.08), color="wood_dark", base=True)
    g.box((0.86, 0.52, 0.66), loc=(0, 0, 0.08), color=by_normal("wood", "wood"), base=True)
    for x in (-0.22, 0.22):
        g.box((0.36, 0.02, 0.48), loc=(x, -0.265, 0.17), color="wood_new", base=True)
    g.box((0.04, 0.025, 0.66), loc=(0, -0.265, 0.08), color="wood_dark", base=True)
    # couvercle à rebord arrondi (chanfrein de 2 segments), deux bandes de fer qui le ceinturent et descendent
    # sur la face, contre le coffre
    g.box((0.9, 0.56, 0.11), loc=(0, 0, 0.74), color="wood", base=True, bevel=0.035, bseg=2)
    for x in (-0.3, 0.3):
        g.box((0.05, 0.57, 0.012), loc=(x, 0, 0.85), color="iron", base=True)
        g.box((0.05, 0.012, 0.7), loc=(x, -0.281, 0.15), color="iron", base=True)
        g.box((0.05, 0.012, 0.7), loc=(x, 0.281, 0.15), color="iron", base=True)
    g.box((0.1, 0.03, 0.12), loc=(0, -0.285, 0.62), color="brass", base=True)
    for s in (1, -1):
        g.box((0.03, 0.14, 0.04), loc=(s * 0.445, 0, 0.55), color="iron")
    return g


def cellar_rack(A):
    """Étagère haute du cellier, 2 m le long du mur et 0,4 m de fond, 1,68 m: cinq tablettes, bocaux, sacs,
    pommes de terre, oignons tressés, dos contre le mur (+Y)."""
    import random
    g = A.geo()
    W, D, H = 1.9, 0.4, 1.68
    y = 0.5 - D / 2 - 0.02
    for x in (-W / 2 + 0.03, 0.0, W / 2 - 0.03):
        g.box((0.06, D, H), loc=(x, y, 0), color="wood_dark", base=True)
    levels = (0.08, 0.42, 0.76, 1.1, 1.44)
    for z in levels:
        g.box((W - 0.12, D, 0.035), loc=(0, y, z), color="wood", base=True)
    g.box((W, 0.03, 0.05), loc=(0, 0.47, H - 0.05), color="wood_dark", base=True)
    rnd = random.Random(10)
    for li, z in enumerate(levels):
        top = z + 0.035
        x = -W / 2 + 0.14
        while x < W / 2 - 0.14:
            if abs(x) < 0.08:
                x += 0.1
                continue
            kind = ["crates", "sacks", "jars", "crates", "jars"][li]
            if kind == "jars":
                hh = rnd.uniform(0.16, 0.24)
                # bocal: cylindre à 6 pans, couvercle de toile (dessus) et confiture ou conserve (côtés)
                fill = rnd.choice(["strawberry", "carrot", "egg", "grain", "elder_stem"])
                g.cyl(0.06, hh, loc=(x, y, top), color=by_normal("fabric_cream", fill), segs=6, base=True)
                x += 0.19
            elif kind == "sacks":
                g.sphere(1.0, loc=(x + 0.05, y, top + 0.13), color="burlap", segs=6, rings=4, scale=(0.13, 0.15, 0.14))
                x += 0.3
            else:
                g.box((0.34, 0.3, 0.18), loc=(x + 0.12, y, top), color=by_normal("potato", "wood_new"), base=True)
                x += 0.4
    # tresse d'oignons pendue au montant de droite
    for k in range(5):
        g.sphere(0.04, loc=(W / 2 + 0.03, y - 0.15, 1.35 - k * 0.07), color="carrot" if k % 2 else "straw_dark",
                 segs=5, rings=3)
    return g


def tool_rack(A):
    """Râtelier mural près de la porte: planche de 1,6 m à 1,45 m de haut sur deux tasseaux, 12 crochets de fer.
    Extra hook_spots: point d'accroche de chaque crochet (x, hauteur, z vers la pièce, repère glTF)."""
    g = A.geo()
    yb = 0.5 - 0.02
    g.box((1.6, 0.03, 0.22), loc=(0, yb, 1.34), color="wood", base=True)
    g.box((1.6, 0.03, 0.08), loc=(0, yb, 0.42), color="wood", base=True)
    for x in (-0.7, 0.7):
        g.box((0.06, 0.03, 1.14), loc=(x, yb + 0.005, 0.38), color="wood_dark", base=True)
    hooks = []
    for k in range(12):
        x = -0.715 + k * 0.13
        g.box((0.02, 0.1, 0.02), loc=(x, yb - 0.065, 1.47), color="iron", rot=(-20, 0, 0))
        g.box((0.02, 0.02, 0.05), loc=(x, yb - 0.11, 1.48), color="iron", base=True)
        hooks.append([round(x, 3), 1.5, round(-(yb - 0.11), 3)])
    # le râtelier vide le premier jour: une vieille casquette et un bout de corde sur deux crochets
    g.cyl(0.03, 0.4, loc=(0.6, yb - 0.1, 1.3), color="rope", segs=5)
    return g, hooks


def _panel(g, xa, xb, z_top, z_bot, color, tie=None, pleats=4, rows=6, depth=0.025):
    """Pan de rideau plissé (bande de quads à double face) de xa à xb (xb du côté du centre de la fenêtre), de
    z_top à z_bot; tie: (z, largeur): pincé par l'embrasse à cette hauteur (rideau ouvert). gingham: damier."""
    cols = pleats * 2
    grid = []
    for r in range(rows + 1):
        z = z_top + (z_bot - z_top) * r / rows
        if tie:
            tz, tw = tie
            k = min(1.0, abs(z - tz) / 0.35)
            k = k * k
            w = tw + (abs(xb - xa) - tw) * (0.55 + 0.45 * k if z < tz else k)
            x0 = xa
            x1 = xa + math.copysign(w, xb - xa)
        else:
            x0, x1 = xa, xb
        row = []
        for c in range(cols + 1):
            x = x0 + (x1 - x0) * c / cols
            y = -depth if c % 2 else 0.0
            row.append((x, y - 0.02, z))
        grid.append(row)
    for r in range(rows):
        for c in range(cols):
            if color == "gingham":
                col = "fabric_red" if ((c // 2) + r) % 2 else "fabric_cream"
            else:
                col = color
            a, b, cc, d = grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]
            g.quad([a, b, cc, d], col, double=True)


def curtains_rod(A):
    g = A.geo()
    zt = WIN_H / 2 + 0.12
    L = WIN_W + 0.4
    g.cyl(0.013, L, loc=(0, -0.06, zt), color="brass", segs=6, rot=(0, 90, 0))
    for s in (1, -1):
        g.sphere(0.025, loc=(s * (L / 2 + 0.015), -0.06, zt), color="brass", segs=6, rings=4)
        g.box((0.025, 0.06, 0.025), loc=(s * (L / 2 - 0.06), -0.03, zt), color="brass")
    return g


def curtains_state(A, color, closed):
    g = A.geo()
    zt = WIN_H / 2 + 0.1
    zb = -WIN_H / 2 - 0.06
    L = WIN_W + 0.36
    for s in (1, -1):
        out = s * L / 2
        if closed:
            _panel(g, out, s * 0.005, zt, zb, color)
        else:
            _panel(g, out, out - s * 0.2, zt, zb, color, tie=(zb + 0.45, 0.09), pleats=2)
            g.box((0.12, 0.075, 0.035), loc=(out - s * 0.045, -0.035, zb + 0.45), color="fabric_red" if color != "fabric_red"
                  else "fabric_cream")
        # anneaux sur la tringle
        for k in range(4):
            x = out + (s * 0.005 - out if closed else -s * 0.2) * k / 3
            g.cyl(0.02, 0.012, loc=(x, -0.06, zt + 0.01), color="brass", segs=6, rot=(0, 90, 0))
    return g


def build(A):
    """Ajoute les nœuds du tour 10 au fichier maison; renvoie (meubles, rideaux) pour les planches."""
    import lpl
    keep = lpl.AUTO_ROUND
    lpl.AUTO_ROUND = False  # budget d'un meuble (900): chanfreins posés à la main
    furn = [A.add("oak_chest", oak_chest(A), {"footprint": [1, 1], "storage_cells": 32}),
            A.add("cellar_rack", cellar_rack(A), {"footprint": [2, 1], "wall": True, "storage_cells": 12,
                                                  "note": "seulement aux deux places du cellier (rack_spots de "
                                                          "gatekeeper_cellar), dos au pignon ouest"})]
    g, hooks = tool_rack(A)
    furn.append(A.add("tool_rack", g, {"footprint": [2, 1], "wall": True, "hook_spots": hooks,
                                      "note": "outils pendus à hook_spots (12 crochets), près de la porte"}))
    lpl.AUTO_ROUND = keep
    states = {}
    for item, col in CURTAIN_COLORS.items():
        states[item] = {"open": item + "_open", "closed": item + "_closed"}
    root = A.group("curtains_window", {
        "rod": "curtains_rod", "states": states, "window_size": [WIN_W, WIN_H],
        "note": "origine au centre de la fenêtre (window_<n>), au nu intérieur du mur; la pièce vers +Z glTF. "
                "Montrer curtains_rod et l'état de l'article posé; échelle X = width / 0,75, Y = height / 0,9"})
    A.add("curtains_rod", curtains_rod(A), parent=root)
    for item, col in CURTAIN_COLORS.items():
        A.add(item + "_open", curtains_state(A, col, False), parent=root)
        A.add(item + "_closed", curtains_state(A, col, True), parent=root)
    return furn, [root]
