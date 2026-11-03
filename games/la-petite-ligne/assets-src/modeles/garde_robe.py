"""Garde-robe des joueurs (0.12, contrat `docs/jeux/jeu-1/garde-robe-0-12.md`).

Appelé par personnages.py. Les foulards sont retirés; la couleur et le symbole du profil Duo passent sur un
badge brodé au milieu de la poitrine (`player_badge_<symbole>`, et `_outer` quand un vêtement par-dessus est
porté). Le corps de base (`player_base`) est nu-neutre: peau, et un sous-vêtement neutre sur le torse et le
bassin. Chaque vêtement est un maillage à peau sur le squelette commun, nommé `wear_<emplacement>_<style>`.

Couleurs: les pièces des joueurs lisent la rangée 0 de `personnages.png` (peau, cheveux, yeux, bouche, joues,
badge dans `scarf` et `scarf_mark`). Les vêtements lisent la rangée 1, que le rendu réécrit pour chaque joueur
avec les couleurs des pièces portées (`WEAR_SLOTS`, dans l'ordre des colonnes): `principale` dans `<slot>_p`,
`secondaire` dans `<slot>_s`, `motif` (ou la secondaire s'il manque) dans `<slot>_m`. `wear_metal` (boutons,
boucles) et `wear_under` (sous-vêtement du corps) restent fixes.

Gabarits (tous les styles d'un emplacement ont la même enveloppe, pour que rien ne traverse):
- corps: torse et bassin à 0,9 des hauts, bras et jambes nus 15 % plus fins que les manches et le pantalon;
- hauts: anneaux `torso_rings` des tenues d'avant; par-dessus: x 1,10 en largeur et x 1,14 en profondeur;
- chaussures: au moins le galet d'avant (0,064 x 0,135 x 0,062), tiges au-dessus du revers du pantalon;
- chapeaux: posés au-dessus des sourcils (hc + 0,085), 2,5 cm plus larges que la tête; la coupe portée sous un
  chapeau est la variante `player_hair_<coupe>_hat`, dont tout ce qui dépasse au-dessus du bandeau est ramené
  sous la calotte (rien ne perce le chapeau, les mèches du dessous restent visibles).
"""
import math

import lpl
import palette as P

WEAR_ROW = 1
WEAR_SLOTS = ["top_p", "top_s", "top_m", "bottom_p", "bottom_s", "bottom_m", "shoes_p", "shoes_s",
              "outer_p", "outer_s", "outer_m", "hat_p", "hat_s", "hat_m", "wear_metal", "wear_under"]
# Valeurs fixes que le rendu laisse telles quelles dans la rangée 1
WEAR_FIXED = {"wear_metal": "#C8A150", "wear_under": "#E4DCCB"}

STYLES = {
    "top": ["tshirt", "chemise", "pull", "debardeur", "mariniere"],
    "bottom": ["pantalon", "short", "salopette", "jupe", "pantacourt"],
    "shoes": ["bottines", "bottes", "sabots", "espadrilles", "baskets"],
    "outer": ["veste", "gilet", "cire"],
    "hat": ["casquette", "paille", "bonnet"],
}
COVERS = {("bottom", "salopette"): ["top"]}

OUTER_K = (1.10, 1.14)
BADGE_Z = 1.31
HAT_BAND = 0.085      # bas du chapeau au-dessus du centre de la tête (les sourcils sont à hc + 0,08)


def wear_cells():
    cells = lpl.char_cells("player_a")
    for c, s in enumerate(WEAR_SLOTS):
        cells[s] = ((c + 0.5) / P.GRID, 1.0 - (WEAR_ROW + 0.5) / P.CHAR_GRID_H)
    return cells


# Corps nu-neutre --------------------------------------------------------------------------

def body(g, pp):
    """Bras et jambes en peau, torse et bassin en sous-vêtement. Pas de pieds: les chaussures sont obligatoires
    et ferment le bas de la jambe."""
    rings = [(ax * 0.9, ay * 0.88, z) for ax, ay, z in pp.torso_rings()]
    pp.loft8(g, rings, "wear_under", weights=pp.torso_weights, close_bottom=False)
    hw, hd = 0.155 * 0.92, 0.121 * 0.92
    pp.loft8(g, [(hw * 0.84, hd * 0.82, 0.8), (hw, hd * 0.97, 0.85), (hw * 1.04, hd, 0.92), (hw * 0.98, hd * 0.98, 1.0)],
             "wear_under", bone="hips")
    for side in ("l", "r"):
        s = 1 if side == "l" else -1
        up, fo = "upper_arm_" + side, "forearm_" + side
        g.sphere(0.07, loc=(s * 0.2, 0, 1.305), color="skin", segs=6, rings=4, bone=up)
        g.lathe([(0.05, 1.075), (0.058, 1.15), (0.056, 1.24)], loc=(s * 0.22, 0, 0), colors="skin", segs=6, bone=up,
                close_bottom=False, close_top=False)
        g.sphere(0.05, loc=(s * 0.226, 0, 1.065), color="skin", segs=6, rings=3, bone=fo)
        g.lathe([(0.04, 0.84), (0.05, 0.95), (0.047, 1.06)], loc=(s * 0.231, 0, 0), colors="skin", segs=6, bone=fo,
                close_top=False, close_bottom=False)
        x, r = s * 0.092, 0.084
        th, sh = "thigh_" + side, "shin_" + side
        g.lathe([(r * 0.76, 0.47), (r * 0.94, 0.64), (r * 0.92, 0.80), (r * 0.84, 0.9)], loc=(x, 0, 0), colors="skin",
                segs=6, bone=th, close_bottom=False, close_top=False)
        g.sphere(r * 0.8, loc=(x, 0, 0.48), color="skin", segs=6, rings=3, bone=sh)
        g.lathe([(r * 0.5, 0.09), (r * 0.62, 0.2), (r * 0.78, 0.32), (r * 0.74, 0.48)], loc=(x, 0, 0), colors="skin",
                segs=6, bone=sh, close_bottom=False, close_top=False)


# Hauts --------------------------------------------------------------------------------------

def _sleeve_long(g, pp, side, color, cuff, puff=1.0, cuff_r=0.06):
    s = 1 if side == "l" else -1
    up, fo = "upper_arm_" + side, "forearm_" + side
    g.sphere(0.083 * puff, loc=(s * 0.2, 0, 1.305), color=color, segs=8, rings=5, bone=up)
    g.lathe([(0.058 * puff, 1.075), (0.07 * puff, 1.19), (0.064 * puff, 1.30)], loc=(s * 0.22, 0, 0), colors=color,
            segs=6, bone=up, close_bottom=False, close_top=False)
    g.sphere(0.058 * puff, loc=(s * 0.226, 0, 1.065), color=color, segs=6, rings=4, bone=fo)
    g.lathe([(0.05 * puff, 0.855), (0.059 * puff, 0.95), (0.055 * puff, 1.06)], loc=(s * 0.231, 0, 0), colors=color,
            segs=6, bone=fo, close_top=False, close_bottom=False)
    g.lathe([(cuff_r, 0.83), (cuff_r + 0.002, 0.868)], loc=(s * 0.234, 0, 0), colors=cuff, segs=6, bone=fo)


def _sleeve_short(g, side, color, band, puff=1.0, bands=None):
    s = 1 if side == "l" else -1
    up = "upper_arm_" + side
    g.sphere(0.083 * puff, loc=(s * 0.2, 0, 1.305), color=color, segs=8, rings=5, bone=up)
    prof = [(0.064 * puff, 1.17), (0.074 * puff, 1.23), (0.072 * puff, 1.31)]
    g.lathe(prof, loc=(s * 0.215, 0, 0), colors=bands or color, segs=6, bone=up, close_top=False, close_bottom=False)
    g.lathe([(0.066 * puff, 1.155), (0.068 * puff, 1.185)], loc=(s * 0.215, 0, 0), colors=band, segs=6, bone=up)


def _neck_band(g, color, r=0.082, z0=1.39, z1=1.414, sy=0.85):
    g.lathe([(r, z0), (r * 0.94, z1)], colors=color, segs=10, scale=(1.0, sy, 1.0), bone="chest", close_bottom=False)


def _hem(g, pp, color, scale=(1.0, 1.0), z=None):
    r0 = pp.torso_rings()[0]
    zz = r0[2] if z is None else z
    pp.loft8(g, [(r0[0] * scale[0] + 0.004, r0[1] * scale[1] + 0.004, zz - 0.003),
                 (r0[0] * scale[0] + 0.006, r0[1] * scale[1] + 0.006, zz + 0.03)], color, bone="spine")


def top(g, pp, style):
    rings = pp.torso_rings()
    if style == "tshirt":
        pp.loft8(g, rings, "top_p", weights=pp.torso_weights, close_bottom=False)
        _neck_band(g, "top_s")
        for side in ("l", "r"):
            _sleeve_short(g, side, "top_p", "top_s")
    elif style == "chemise":
        pp.loft8(g, rings, "top_p", weights=pp.torso_weights, close_bottom=False)
        pp.collar(g, color="top_p", w=0.19)
        # patte de boutonnage et boutons sous le badge, poche de poitrine à rabat
        for i, z in enumerate((1.02, 1.1, 1.18, 1.25)):
            y = pp.torso_front_y(z) - 0.003
            g.box((0.018, 0.01, 0.018), loc=(0, y, z), color="top_s", bone="chest" if z > 1.1 else "spine")
        y = pp.torso_front_y(1.17) - 0.004
        g.box((0.075, 0.01, 0.07), loc=(-0.085, y, 1.17), color="top_p", bevel=0.004, bone="chest")
        g.box((0.08, 0.014, 0.024), loc=(-0.085, y - 0.004, 1.2), color="top_s", bevel=0.004, bone="chest")
        for side in ("l", "r"):
            _sleeve_long(g, pp, side, "top_p", "top_s")
    elif style == "pull":
        pp.loft8(g, rings, "top_p", weights=pp.torso_weights, close_bottom=False)
        _hem(g, pp, "top_s", (1.03, 1.04))
        # col roulé bas (côtes)
        g.lathe([(0.088, 1.37), (0.094, 1.39), (0.085, 1.415)], colors="top_s", segs=10, scale=(1.0, 0.84, 1.0),
                bone="chest", close_bottom=False)
        for side in ("l", "r"):
            _sleeve_long(g, pp, side, "top_p", "top_s", puff=1.1, cuff_r=0.063)
    elif style == "debardeur":
        rr = [(ax, ay, z) for ax, ay, z in rings[:-1]] + [(0.12, 0.09, rings[-2][2] + 0.03)]
        pp.loft8(g, rr, "top_p", weights=pp.torso_weights, close_bottom=False, close_top=False)
        _neck_band(g, "top_s", r=0.122, z0=rings[-2][2] + 0.02, z1=rings[-2][2] + 0.045, sy=0.76)
        # emmanchures bordées
        for s in (1, -1):
            g.lathe([(0.075, -0.012), (0.075, 0.012)], loc=(s * 0.17, 0, 1.255), rot=(0, 90, 0), colors="top_s",
                    segs=8, scale=(1.0, 1.25, 1.0), bone="chest")
    elif style == "mariniere":
        def stripe(face):
            z = face.calc_center_median().z
            return "top_s" if int((z - 0.94) / 0.045) % 2 else "top_p"
        # anneaux intermédiaires: une rayure par bande
        fine = []
        for (a0, b0, z0), (a1, b1, z1) in zip(rings, rings[1:]):
            n = max(1, round((z1 - z0) / 0.045))
            for k in range(n):
                t = k / n
                fine.append((a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, z0 + (z1 - z0) * t))
        fine.append(rings[-1])
        pp.loft8(g, fine, stripe, weights=pp.torso_weights, close_bottom=False)
        _neck_band(g, "top_p", r=0.09)
        for side in ("l", "r"):
            s = 1 if side == "l" else -1
            up, fo = "upper_arm_" + side, "forearm_" + side
            g.sphere(0.083, loc=(s * 0.2, 0, 1.305), color="top_p", segs=8, rings=5, bone=up)
            g.lathe([(0.058, 1.075), (0.064, 1.13), (0.07, 1.19), (0.067, 1.245), (0.064, 1.30)],
                    loc=(s * 0.22, 0, 0), colors=["top_s", "top_p", "top_s", "top_p"], segs=6, bone=up,
                    close_bottom=False, close_top=False)
            g.sphere(0.058, loc=(s * 0.226, 0, 1.065), color="top_p", segs=6, rings=4, bone=fo)
            g.lathe([(0.056, 0.96), (0.057, 1.06)], loc=(s * 0.231, 0, 0), colors="top_s", segs=6, bone=fo,
                    close_top=False)
    else:
        raise ValueError(style)


# Bas ------------------------------------------------------------------------------------------

def _pelvis(g, pp, color, belt=None):
    hw, hd = 0.155, 0.121
    pp.loft8(g, [(hw * 0.84, hd * 0.82, 0.8), (hw, hd * 0.97, 0.85), (hw * 1.06, hd * 1.03, 0.92),
                 (hw * 0.99, hd * 0.98, 1.0)], color, bone="hips")
    if belt:
        pp.loft8(g, [(0.162, 0.128, 0.965), (0.162, 0.128, 1.005)], belt, bone="hips")
        g.box((0.05, 0.012, 0.036), loc=(0, -0.132, 0.985), color="wear_metal", bevel=0.004, bone="hips")


def _thigh(g, side, color, z_bot=0.47, hem=None):
    s = 1 if side == "l" else -1
    x, r = s * 0.092, 0.084
    prof = [(r * 0.86, 0.47), (r * 1.1, 0.64), (r * 1.08, 0.80), (r * 0.98, 0.89)]
    if z_bot > 0.47:
        prof = [(r * 1.04, z_bot)] + [p for p in prof if p[1] > z_bot + 0.02]
    g.lathe(prof, loc=(x, 0, 0), colors=color, segs=6, bone="thigh_" + side, close_bottom=False, close_top=False)
    if hem:
        g.lathe([(prof[0][0] + 0.004, z_bot - 0.005), (prof[0][0] + 0.006, z_bot + 0.03)], loc=(x, 0, 0), colors=hem,
                segs=6, bone="thigh_" + side)


def _shin(g, side, color, z_bot=0.10, cuff=None):
    s = 1 if side == "l" else -1
    x, r = s * 0.092, 0.084
    g.sphere(r * 0.92, loc=(x, 0, 0.48), color=color, segs=6, rings=4, bone="shin_" + side)
    prof = [(r * 0.6, 0.10), (r * 0.72, 0.2), (r * 0.9, 0.32), (r * 0.84, 0.48)]
    if z_bot > 0.1:
        prof = [(r * 0.86, z_bot)] + [p for p in prof if p[1] > z_bot + 0.02]
    g.lathe(prof, loc=(x, 0, 0), colors=color, segs=6, bone="shin_" + side, close_top=False, close_bottom=False)
    if cuff:
        r0 = prof[0][0]
        g.lathe([(r0 + 0.004, z_bot - 0.004), (r0 + 0.007, z_bot + 0.045)], loc=(x, 0, 0), colors=cuff, segs=6,
                bone="shin_" + side)


def _back_pockets(g, color):
    for sx in (1, -1):
        g.box((0.075, 0.012, 0.075), loc=(sx * 0.07, 0.123, 0.9), color=color, bevel=0.005, bone="hips")


def bottom(g, pp, style):
    if style == "pantalon":
        _pelvis(g, pp, "bottom_p", belt="bottom_s")
        _back_pockets(g, "bottom_p")
        for side in ("l", "r"):
            _thigh(g, side, "bottom_p")
            _shin(g, side, "bottom_p", cuff="bottom_s")
    elif style == "short":
        _pelvis(g, pp, "bottom_p", belt="bottom_s")
        _back_pockets(g, "bottom_p")
        for side in ("l", "r"):
            _thigh(g, side, "bottom_p", z_bot=0.6, hem="bottom_s")
    elif style == "pantacourt":
        _pelvis(g, pp, "bottom_p", belt="bottom_s")
        for side in ("l", "r"):
            _thigh(g, side, "bottom_p")
            _shin(g, side, "bottom_p", z_bot=0.27, cuff="bottom_s")
    elif style == "jupe":
        pp.skirt(g, z_top=1.0, z_bot=0.5, r_top=0.19, r_bot=0.3, color="bottom_p", hem="bottom_s")
        pp.loft8(g, [(0.168, 0.15, 0.965), (0.168, 0.15, 1.01)], "bottom_s", bone="hips")
    elif style == "salopette":
        # tee-shirt de dessous compris (la salopette couvre le haut)
        pp.loft8(g, pp.torso_rings(), "bottom_s", weights=pp.torso_weights, close_bottom=False)
        _neck_band(g, "bottom_s")
        for side in ("l", "r"):
            _sleeve_short(g, side, "bottom_s", "bottom_s")
        _pelvis(g, pp, "bottom_p")
        old = (pp.ROUND,)
        pp.ROUND = True
        try:
            fy = pp.torso_front_y(1.15) + 0.105
            g.box((0.24, 0.02, 0.27), loc=(0, -0.113 + fy, 1.0), color="bottom_p", base=True, weights=pp.torso_weights)
            g.box((0.1, 0.008, 0.07), loc=(0, -0.126 + fy, 1.1), color="bottom_p", bevel=0.003, bone="chest")
            g.box((0.104, 0.01, 0.014), loc=(0, -0.128 + fy, 1.14), color="bottom_m", bone="chest")
            for s in (1, -1):
                g.box((0.035, 0.245, 0.02), loc=(s * 0.095, 0.0, 1.38), color="bottom_p", bone="chest")
                g.box((0.035, 0.015, 0.13), loc=(s * 0.095, -0.115 + fy, 1.315), color="bottom_p", bone="chest")
                g.box((0.035, 0.015, 0.33), loc=(s * 0.095, 0.115 - fy, 1.21), color="bottom_p", bone="chest")
                g.box((0.022, 0.01, 0.022), loc=(s * 0.095, -0.125 + fy, 1.262), color="wear_metal", bone="chest")
        finally:
            pp.ROUND = old[0]
        for side in ("l", "r"):
            _thigh(g, side, "bottom_p")
            _shin(g, side, "bottom_p", cuff="bottom_m")
    else:
        raise ValueError(style)


# Chaussures ------------------------------------------------------------------------------------

def _galet(g, side, color, scale, y=-0.045, z=0.055, toe_up=0.0, sole=None):
    s = 1 if side == "l" else -1
    x = s * 0.092
    col = lpl.by_normal(color, color, sole or color)
    vs = g.sphere(1.0, loc=(x, y, z), color=col, segs=8, rings=5, scale=scale, bone="foot_" + side)
    for v in vs:
        if v.co.z < 0.0:
            v.co.z = 0.0
        if toe_up and v.co.y < y - scale[1] * 0.55:
            v.co.z += toe_up * (y - scale[1] * 0.55 - v.co.y) / (scale[1] * 0.45)
    return vs


def _sole(g, side, color, scale, y=-0.045, h=0.022):
    s = 1 if side == "l" else -1
    g.lathe([(1.0, 0.0), (1.0, h)], loc=(s * 0.092, y, 0), colors=color, segs=10, scale=(scale[0], scale[1], 1.0),
            bone="foot_" + side)


def shoes(g, pp, style):
    for side in ("l", "r"):
        s = 1 if side == "l" else -1
        x = s * 0.092
        sh = "shin_" + side
        if style == "bottines":
            _galet(g, side, "shoes_p", (0.068, 0.142, 0.066), sole="shoes_s")
            _sole(g, side, "shoes_s", (0.07, 0.145))
            g.lathe([(0.058, 0.07), (0.064, 0.15), (0.066, 0.2)], loc=(x, 0, 0), colors="shoes_p", segs=6, bone=sh,
                    close_bottom=False)
            g.lathe([(0.068, 0.195), (0.07, 0.215)], loc=(x, 0, 0), colors="shoes_s", segs=6, bone=sh)
            for k, z in enumerate((0.1, 0.135, 0.17)):
                g.box((0.034, 0.008, 0.008), loc=(x, -0.062 + k * 0.002, z), color="shoes_s", bone=sh)
        elif style == "bottes":
            _galet(g, side, "shoes_p", (0.07, 0.145, 0.066), sole="shoes_s")
            _sole(g, side, "shoes_s", (0.072, 0.148), h=0.026)
            g.lathe([(0.06, 0.05), (0.071, 0.25), (0.081, 0.4)], loc=(x, 0, 0), colors="shoes_p", segs=8, bone=sh,
                    close_bottom=False, close_top=False)
            g.lathe([(0.082, 0.385), (0.085, 0.41)], loc=(x, 0, 0), colors="shoes_s", segs=8, bone=sh)
        elif style == "sabots":
            _galet(g, side, "shoes_p", (0.074, 0.158, 0.07), y=-0.05, toe_up=0.025)
            g.lathe([(0.064, 0.085), (0.066, 0.115)], loc=(x, 0.005, 0), colors="shoes_s", segs=8, bone="foot_" + side,
                    scale=(1.0, 1.2, 1.0))
        elif style == "espadrilles":
            _galet(g, side, "shoes_p", (0.066, 0.14, 0.054), z=0.05)
            _sole(g, side, "shoes_s", (0.07, 0.146), h=0.026)
        elif style == "baskets":
            _galet(g, side, "shoes_p", (0.069, 0.144, 0.064), z=0.058)
            _sole(g, side, "shoes_s", (0.073, 0.15), h=0.03)
            vs = g.sphere(1.0, loc=(x, -0.15, 0.04), color="shoes_s", segs=6, rings=4, scale=(0.055, 0.045, 0.03),
                          bone="foot_" + side)
            for v in vs:
                v.co.z = max(v.co.z, 0.0)
            for yy, zz in ((-0.095, 0.119), (-0.073, 0.122), (-0.051, 0.122)):
                g.box((0.036, 0.008, 0.008), loc=(x, yy, zz), color="shoes_s", bone="foot_" + side)
        else:
            raise ValueError(style)


# Par-dessus -----------------------------------------------------------------------------------

def outer_rings(pp, z_bot=0.86):
    kx, ky = OUTER_K
    rings = [(ax * kx, ay * ky, z) for ax, ay, z in pp.torso_rings()]
    rings[0] = (rings[0][0], rings[0][1], z_bot)
    return rings


def _outer_sleeves(g, side, color, cuff):
    s = 1 if side == "l" else -1
    up, fo = "upper_arm_" + side, "forearm_" + side
    g.sphere(0.096, loc=(s * 0.2, 0, 1.305), color=color, segs=8, rings=5, bone=up)
    g.lathe([(0.072, 1.075), (0.086, 1.19), (0.08, 1.30)], loc=(s * 0.22, 0, 0), colors=color, segs=6, bone=up,
            close_bottom=False, close_top=False)
    g.sphere(0.072, loc=(s * 0.226, 0, 1.065), color=color, segs=6, rings=4, bone=fo)
    g.lathe([(0.064, 0.86), (0.072, 0.95), (0.07, 1.06)], loc=(s * 0.231, 0, 0), colors=color, segs=6, bone=fo,
            close_top=False, close_bottom=False)
    g.lathe([(0.07, 0.845), (0.072, 0.885)], loc=(s * 0.233, 0, 0), colors=cuff, segs=6, bone=fo)


def _outer_front_y(pp, z):
    return pp.torso_front_y(z) * OUTER_K[1]


def outer(g, pp, style):
    if style in ("veste", "gilet"):
        rings = outer_rings(pp, 0.86)
        pp.loft8(g, rings, "outer_p", weights=lambda co: {"hips": 1.0} if co.z < 0.97 else pp.torso_weights(co),
                 close_bottom=False)
        r0 = rings[0]
        pp.loft8(g, [(r0[0] + 0.004, r0[1] + 0.004, 0.857), (r0[0] + 0.005, r0[1] + 0.005, 0.89)],
                 "outer_s" if style == "gilet" else "outer_p", bone="hips")
        for z in (0.95, 1.05, 1.15, 1.25):
            g.box((0.02, 0.012, 0.02), loc=(0, _outer_front_y(pp, z) - 0.004, z), color="wear_metal", bevel=0.003,
                  bone="chest" if z > 1.1 else "spine")
        if style == "veste":
            # revers du col et poches plaquées à rabat
            for sx in (1, -1):
                g.prism([(0, 0), (sx * 0.1, 0.0), (sx * 0.035, -0.12)], 0.012,
                        loc=(0, _outer_front_y(pp, 1.36) - 0.008, 1.395), color="outer_s", rot=(-24, 0, 0),
                        bone="chest")
                y = _outer_front_y(pp, 1.0) - 0.004
                g.box((0.1, 0.012, 0.09), loc=(sx * 0.1, y, 1.0), rot=(0, 0, 0), color="outer_p", bevel=0.005,
                      bone="spine")
                g.box((0.106, 0.016, 0.026), loc=(sx * 0.1, y - 0.003, 1.045), color="outer_s", bevel=0.004,
                      bone="spine")
            for side in ("l", "r"):
                _outer_sleeves(g, side, "outer_p", "outer_s")
        else:
            # bordure en V du col tricoté, côtes du bas et des poignets
            for sx in (1, -1):
                g.prism([(sx * 0.006, 0.0), (sx * 0.075, 0.07), (sx * 0.09, 0.055), (sx * 0.02, -0.02)], 0.01,
                        loc=(0, _outer_front_y(pp, 1.3) - 0.004, 1.3), color="outer_s", rot=(-14, 0, 0), bone="chest")
            for side in ("l", "r"):
                _outer_sleeves(g, side, "outer_p", "outer_s")
    elif style == "cire":
        rings = outer_rings(pp, 0.97)
        pp.loft8(g, rings, "outer_p", weights=pp.torso_weights, close_bottom=False)
        w = pp.skirt_weights(0.99, 0.62, 0.3)
        g.lathe([(0.29, 0.62), (0.3, 0.645), (0.25, 0.8), (0.215, 0.92), (0.205, 0.99)],
                colors=["outer_s", "outer_p", "outer_p", "outer_p"], segs=12, weights=w, scale=(1.0, 0.84, 1.0),
                close_bottom=False, close_top=False)
        # capuche roulée dans le dos, brandebourgs
        g.sphere(1.0, loc=(0, 0.14, 1.36), color="outer_p", segs=8, rings=5, scale=(0.13, 0.05, 0.06), bone="chest")
        for z in (0.9, 1.02, 1.14, 1.25):
            w2 = (lambda co: {"spine": 1.0}) if z > 0.97 else w
            y = (_outer_front_y(pp, z) if z > 0.97 else -0.215 * 0.84) - 0.005
            g.box((0.045, 0.012, 0.016), loc=(0, y, z), color="outer_s", bevel=0.004, weights=w2)
        for side in ("l", "r"):
            _outer_sleeves(g, side, "outer_p", "outer_s")
    else:
        raise ValueError(style)


# Chapeaux --------------------------------------------------------------------------------------

def hat(g, pp, style, hc):
    z0 = hc + HAT_BAND
    if style == "casquette":
        g.lathe([(1.0, 0.0), (0.99, 0.04), (0.86, 0.09), (0.52, 0.125), (0.0, 0.137)], loc=(0, 0.008, z0),
                colors="hat_p", segs=12, scale=(0.184, 0.172, 1.0), close_bottom=False, bone="head")
        g.lathe([(1.0, -0.004), (1.0, 0.018)], loc=(0, 0.008, z0), colors="hat_s", segs=12, scale=(0.186, 0.174, 1.0),
                close_bottom=False, close_top=False, bone="head")
        g.sphere(1.0, loc=(0, -0.2, z0 + 0.004), color="hat_s", segs=10, rings=4, scale=(0.12, 0.075, 0.012),
                 rot=(-10, 0, 0), bone="head")
        g.sphere(0.014, loc=(0, 0.008, z0 + 0.137), color="hat_s", segs=6, rings=3, bone="head")
    elif style == "paille":
        g.lathe([(1.0, 0.0), (0.97, 0.07), (0.86, 0.115), (0.0, 0.125)], loc=(0, 0.0, z0 - 0.005), colors="hat_p",
                segs=12, scale=(0.185, 0.175, 1.0), close_bottom=False, bone="head")
        g.lathe([(1.0, 0.0), (1.0, 0.03)], loc=(0, 0.0, z0 - 0.002), colors="hat_s", segs=12, scale=(0.188, 0.178, 1.0),
                close_bottom=False, close_top=False, bone="head")
        # bord large qui ondule et retombe un peu
        n = 16
        pts, faces = [], []
        for k in range(n):
            a = 2 * math.pi * k / n
            c, s = math.cos(a), math.sin(a)
            # bord relevé devant (le visage reste visible depuis la caméra du jeu), qui retombe sur les côtés
            dz = 0.01 * math.cos(2 * a) - 0.006 + (0.035 * -s if s < 0 else 0.0)
            for (r, h) in ((0.18, 0.0), (0.275, -0.016 + dz), (0.275, -0.004 + dz), (0.18, 0.012)):
                pts.append((r * c * 1.0, r * s * 0.97, z0 + h))
        for k in range(n):
            k2 = (k + 1) % n
            for j in range(4):
                j2 = (j + 1) % 4
                faces.append((k * 4 + j, k2 * 4 + j, k2 * 4 + j2, k * 4 + j2))
        vs = g.mesh(pts, faces, "hat_p", bone="head")
        import bmesh
        bmesh.ops.recalc_face_normals(g.bm, faces=list({f for v in vs for f in v.link_faces}))
    elif style == "bonnet":
        g.lathe([(1.0, 0.0), (0.98, 0.06), (0.86, 0.12), (0.56, 0.165), (0.0, 0.178)], loc=(0, 0.006, z0),
                colors="hat_p", segs=12, scale=(0.184, 0.172, 1.0), close_bottom=False, bone="head")
        g.lathe([(1.0, -0.004), (1.03, 0.022), (1.0, 0.05)], loc=(0, 0.006, z0), colors="hat_s", segs=12,
                scale=(0.19, 0.178, 1.0), close_bottom=False, close_top=False, bone="head")
        g.sphere(0.042, loc=(0, 0.006, z0 + 0.19), color="hat_s", segs=8, rings=5, bone="head")
    else:
        raise ValueError(style)


def flatten_under_hat(g, hc, rx, ry, rz):
    """Coupe portée sous un chapeau: ce qui monte au-dessus du bandeau rentre sous la calotte (ellipsoïde de la
    tête grossie de 1,2 cm), progressivement sur 3 cm pour garder une silhouette continue."""
    ax, ay, az = rx + 0.012, ry + 0.012, rz + 0.012
    zc = hc + HAT_BAND
    for v in g.bm.verts:
        dz = v.co.z - hc
        t = min(1.0, max(0.0, (v.co.z - (zc - 0.03)) / 0.03))
        if t <= 0:
            continue
        e = math.sqrt((v.co.x / ax) ** 2 + ((v.co.y - 0.008) / ay) ** 2 + (dz / az) ** 2)
        if e > 1.0:
            k = 1.0 + (1.0 / e - 1.0) * t
            v.co.x *= k
            v.co.y = 0.008 + (v.co.y - 0.008) * k
            v.co.z = hc + dz * k
    # une masse très large (nuage) se replie sur elle-même: on remet les faces dans le bon sens, îlot par îlot
    import bmesh
    bmesh.ops.recalc_face_normals(g.bm, faces=list(g.bm.faces))
    seen = set()
    for f0 in g.bm.faces:
        if f0 in seen:
            continue
        island, stack = [], [f0]
        seen.add(f0)
        while stack:
            f = stack.pop()
            island.append(f)
            for e in f.edges:
                for f2 in e.link_faces:
                    if f2 not in seen:
                        seen.add(f2)
                        stack.append(f2)
        vol = 0.0
        for f in island:
            vs = [v.co for v in f.verts]
            for i in range(1, len(vs) - 1):
                vol += vs[0].dot(vs[i].cross(vs[i + 1])) / 6.0
        if vol < 0:
            bmesh.ops.reverse_faces(g.bm, faces=island)


# Badge du profil ---------------------------------------------------------------------------------

def badge(g, pp, symbol, outer_layer=False):
    """Écusson brodé de 7 cm au milieu de la poitrine, au-dessus de la bavette de la salopette: fond à la couleur
    du profil (`scarf`), liseré et symbole en `scarf_mark`. Il épouse la pente du haut du torse."""
    from mathutils import Vector
    z = BADGE_Z
    k = OUTER_K[1] if outer_layer else 1.0
    y_surf = pp.torso_front_y(z) * k
    slope = (pp.torso_front_y(z + 0.02) - pp.torso_front_y(z - 0.02)) * k / 0.04
    tilt = math.degrees(math.atan(-slope))
    thick = 0.012
    c = (0, y_surf + thick / 2 - 0.0045, z)
    n = 10
    rim = [(0.04 * math.cos(2 * math.pi * i / n), 0.04 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    g.prism(rim, thick, loc=c, color="scarf_mark", rot=(tilt, 0, 0), bone="chest")
    inner = [(0.034 * math.cos(2 * math.pi * i / n), 0.034 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    R = lpl._rot((tilt, 0, 0))
    c2 = Vector(c) + (R @ Vector((0, -thick / 2 - 0.001, 0, 0.0))).xyz
    g.prism(inner, 0.002, loc=tuple(c2), color="scarf", rot=(tilt, 0, 0), bone="chest")
    c3 = Vector(c) + (R @ Vector((0, -thick / 2 - 0.0035, 0, 0.0))).xyz
    sym_prisms(g, pp, symbol, tuple(c3), 0.056, tilt)


def sym_prisms(g, pp, sym, center, size, tilt):
    """Symbole du profil (mêmes formes que l'ancien foulard), à plat dans le plan de l'écusson."""
    r = size / 2

    def circ(rad, n=10, ox=0.0, oz=0.0):
        return [(ox + rad * math.cos(2 * math.pi * i / n), oz + rad * math.sin(2 * math.pi * i / n)) for i in range(n)]
    shapes = []
    if sym == "orb":
        shapes.append(circ(r * 0.62))
    elif sym == "crescent":
        outer = [(r * 0.8 * math.cos(a), r * 0.8 * math.sin(a)) for a in [math.radians(d) for d in range(40, 330, 26)]]
        inner = [(r * 0.25 + r * 0.6 * math.cos(a), r * 0.12 + r * 0.6 * math.sin(a)) for a in
                 [math.radians(d) for d in range(300, 50, -30)]]
        shapes.append(outer + inner)
    elif sym == "star":
        pts = []
        for i in range(10):
            a = math.pi / 2 + i * math.pi / 5
            rr = r * 0.95 if i % 2 == 0 else r * 0.4
            pts.append((rr * math.cos(a), rr * math.sin(a)))
        shapes.append(pts)
    elif sym == "sun":
        shapes.append(circ(r * 0.45))
        for i in range(8):
            a = i * math.pi / 4
            shapes.append([(r * 0.56 * math.cos(a - 0.22), r * 0.56 * math.sin(a - 0.22)),
                           (r * 0.95 * math.cos(a), r * 0.95 * math.sin(a)),
                           (r * 0.56 * math.cos(a + 0.22), r * 0.56 * math.sin(a + 0.22))])
    elif sym == "planet":
        shapes.append(circ(r * 0.5))
        shapes.append([(-r, -0.1 * r), (r, 0.24 * r), (r, 0.4 * r), (-r, 0.06 * r)])
    elif sym == "comet":
        shapes.append(circ(r * 0.4, ox=r * 0.4, oz=-r * 0.3))
        shapes.append([(r * 0.15, -r * 0.05), (-r * 0.95, r * 0.75), (r * 0.6, r * 0.05)])
    for pts in shapes:
        g.prism(pts, 0.003, loc=center, color="scarf_mark", rot=(tilt, 0, 0), bone="chest")
