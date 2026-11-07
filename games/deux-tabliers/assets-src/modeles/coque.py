"""Coque du café d'Ormeval (plan `village-arrivee` et extensions de `village-maximum`), lumière cuite, export.

Usage: duo-python games/deux-tabliers/assets-src/modeles/coque.py [-- --res 2048 --spp 64 --sans-cuisson]

Sorties (assets/modeles/):
- shell_village.glb: nœuds `shell_village` (murs, sol, plafond, poutres, menuiseries, comptoir fixe et arrière-comptoir,
  ardoise murale, deux suspensions fixes du comptoir), `shell_village_glass` (vitrages), `shell_village_glow` (abat-jour
  allumés), `shell_village_street` (la place du Tilleul vue par les vitrines), `shell_village_fond_ferme` (pan du refend avec
  la porte fermée de la pièce du fond: à cacher quand l'extension « village_fond » est achetée);
- shell_village_ext_fond.glb: la pièce du fond (arche, cheminée, fenêtre sur la cour), même carte de lumière;
- shell_village_ext_terrasse.glb: le store banne de la terrasse (matériau des meubles, lumière dynamique);
- textures/: carte de lumière, textures de murs et de sols (variantes de peinture, papiers peints et sols du catalogue).

Repère: celui du plan, x = x du plan, z glTF = y du plan (sud), en mètres; les coques se posent sans transformation.
La lumière est celle de la fin d'après-midi (moment signature), sans aucun meuble (ils bougent).
"""

import argparse
import json
import math
import os
import sys
import tempfile
import time

import bpy
import numpy as np
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
import commun as K  # noqa: E402
import geo as G  # noqa: E402
from geo import Geo  # noqa: E402
import scene_coque as S  # noqa: E402
import textures as TX  # noqa: E402

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--res", type=int, default=2048)
ap.add_argument("--spp", type=int, default=64)
ap.add_argument("--sans-cuisson", action="store_true")
ap.add_argument("--travail", default=os.path.join(tempfile.gettempdir(), "dt-coque"))
args = ap.parse_args(argv)
os.makedirs(args.travail, exist_ok=True)
C = K.C

# ------------------------------------------------------------------------------------------------
# Textures de la coque et variantes du catalogue (1 m par tuile, répétées)


def _save(a, name, jpg=True):
    from PIL import Image
    a = np.clip(a, 0, 1)
    p = os.path.join(K.TEXDIR, name)
    im = Image.fromarray((a * 255 + 0.5).astype(np.uint8))
    if jpg:
        im.save(p, quality=88)
    else:
        im.save(p, optimize=True)
    return p


def _tint(a, hexs):
    la = K.s2l(a)
    return K.l2s(la * (K.s2l(K.rgb(hexs)) / max(1e-4, la.mean()))[None, None, :])


def plancher(n=512, seed=51):
    """Vieux plancher de chêne: lames de 12,5 cm, joints décalés, teintes de lame variées."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    base = TX.bois(n, seed)[..., 0]
    rows = 8
    r = np.floor(y * rows).astype(int)
    off = (r * 0.37) % 1.0
    plank = np.floor((x + off) * 2).astype(int)
    tint = rng.normal(0, 1, 64)[(r * 3 + plank) % 64]
    v = base * (1 + 0.06 * tint)
    jy = np.abs(((y * rows) % 1.0) - 0.5) > 0.485
    jx = np.abs((((x + off) * 2) % 1.0) - 0.5) > 0.494
    v = np.where(jy | jx, v * 0.68, v)
    a = np.stack([v, v * 0.97, v * 0.93], -1)
    return _tint(a, C["bourg_parquet"])


def carreaux_ciment(n=512, seed=53):
    """Carreaux de ciment de 20 cm: rosace vert d'eau, terre cuite et feuille sur fond crème (style jardin)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 5
    fx, fy = (x * k) % 1.0 - 0.5, (y * k) % 1.0 - 0.5
    r = np.sqrt(fx ** 2 + fy ** 2)
    a = np.arctan2(fy, fx)
    bg, c1, c2, c3 = (K.s2l(K.rgb(C[k_])) for k_ in ("jardin_tile", "jardin_water", "campagne_clay", "jardin_leaf"))
    petal = r < 0.18 + 0.1 * np.abs(np.cos(a * 2))
    centre = r < 0.08
    corner = (np.abs(fx) + np.abs(fy)) > 0.82
    border = (np.maximum(np.abs(fx), np.abs(fy)) > 0.44) & (np.maximum(np.abs(fx), np.abs(fy)) < 0.47)
    col = np.where(petal[..., None], c1, bg)
    col = np.where(centre[..., None], c2, col)
    col = np.where(corner[..., None], c3, col)
    col = np.where(border[..., None], c3 * 1.2, col)
    col = col * (1 + 0.03 * TX._noise((n, n), 1.0, rng))[..., None]
    joint = np.maximum(np.abs(fx), np.abs(fy)) > 0.495
    col = np.where(joint[..., None], bg * 0.7, col)
    return K.l2s(col)


def damier(n=512, seed=55):
    """Damier de 25 cm noir et crème (bistrot), légère variation de chaque carreau."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 4
    ix, iy = np.floor(x * k).astype(int), np.floor(y * k).astype(int)
    dark = (ix + iy) % 2 == 0
    a, b = K.s2l(K.rgb(C["bistrot_tile_dark"])), K.s2l(K.rgb(C["bistrot_tile_light"]))
    var = rng.normal(0, 1, 64)[(iy * 8 + ix) % 64]
    col = np.where(dark[..., None], a, b) * (1 + 0.04 * var)[..., None]
    col = col * (1 + 0.02 * TX._noise((n, n), 1.5, rng))[..., None]
    fx, fy = (x * k) % 1.0, (y * k) % 1.0
    joint = (np.minimum(fx, 1 - fx) < 0.006) | (np.minimum(fy, 1 - fy) < 0.006)
    col = np.where(joint[..., None], b * 0.75, col)
    return K.l2s(col)


def papier_fleurs(n=512, seed=57):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    bg = K.s2l(K.rgb(C["campagne_linen"])) * 1.05
    col = np.broadcast_to(bg, (n, n, 3)).copy()
    cols = [K.s2l(K.rgb(C[k])) for k in ("campagne_clay", "campagne_faience", "campagne_sage", "campagne_straw")]
    for i in range(36):
        cx, cy = rng.uniform(0, 1), rng.uniform(0, 1)
        c = cols[i % 4]
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                d = np.sqrt((x - cx - dx) ** 2 + (y - cy - dy) ** 2)
                ang = np.arctan2(y - cy - dy, x - cx - dx)
                m = d < 0.018 * (0.7 + 0.3 * np.cos(5 * ang))
                col = np.where(m[..., None], c, col)
                st = (np.abs((x - cx - dx) * 0.2 + (y - cy - dy)) < 0.0025) & (y - cy - dy > 0.015) & (y - cy - dy < 0.06) & (np.abs(x - cx - dx) < 0.02)
                col = np.where(st[..., None], cols[2] * 0.8, col)
    col = col * (1 + 0.015 * TX._noise((n, n), 2, rng))[..., None]
    return K.l2s(col)


def papier_feuillage(n=512, seed=59):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    bg = K.s2l(K.rgb(C["jardin_water"]))
    col = np.broadcast_to(bg, (n, n, 3)).copy()
    leaf, leaf2 = K.s2l(K.rgb(C["jardin_leaf"])), K.s2l(K.rgb(C["leaf_light"]))
    for i in range(28):
        cx, cy, a0 = rng.uniform(0, 1), rng.uniform(0, 1), rng.uniform(0, math.pi)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                u = (x - cx - dx) * math.cos(a0) + (y - cy - dy) * math.sin(a0)
                v = -(x - cx - dx) * math.sin(a0) + (y - cy - dy) * math.cos(a0)
                m = (u / 0.06) ** 2 + (v / 0.022) ** 2 < 1
                col = np.where(m[..., None], leaf if i % 2 else leaf2, col)
    col = col * (1 + 0.015 * TX._noise((n, n), 2, rng))[..., None]
    return K.l2s(col)


def papier_rayures(n=512, seed=61):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    a, b = K.s2l(K.rgb(C["bistrot_tile_light"])), K.s2l(K.rgb(C["retro_cream"]))
    band = ((x * 10) % 1.0) < 0.5
    col = np.where(band[..., None], a, b)
    line = np.abs(((x * 10) % 1.0) - 0.5) < 0.012
    col = np.where(line[..., None], K.s2l(K.rgb(C["bistrot_brass"])), col)
    col = col * (1 + 0.012 * TX._noise((n, n), (4, 0.6), rng))[..., None]
    return K.l2s(col)


VARIANTES = {
    "sols": {
        "sol_plancher": {"fichier": "textures/sol_plancher.jpg", "nom": "Plancher de chêne (à l'arrivée)"},
        "sol_tomettes": {"fichier": "textures/sol_tomettes.jpg"},
        "sol_carreaux_ciment": {"fichier": "textures/sol_carreaux_ciment.jpg"},
        "sol_damier": {"fichier": "textures/sol_damier.jpg"},
    },
    "murs": {
        "peinture_chaux": {"fichier": "textures/mur_enduit.jpg", "teinte": C["village_lime"], "nom": "Chaux (à l'arrivée)"},
        "peinture_lin": {"fichier": "textures/mur_enduit.jpg", "teinte": C["campagne_linen"]},
        "peinture_vert_eau": {"fichier": "textures/mur_enduit.jpg", "teinte": C["jardin_water"]},
        "peinture_lie_de_vin": {"fichier": "textures/mur_enduit.jpg", "teinte": "#6E3A40"},
        "papier_fleurs_champs": {"fichier": "textures/papier_fleurs_champs.jpg", "teinte": "#FFFFFF"},
        "papier_feuillage": {"fichier": "textures/papier_feuillage.jpg", "teinte": "#FFFFFF"},
        "papier_rayures_creme": {"fichier": "textures/papier_rayures_creme.jpg", "teinte": "#FFFFFF"},
    },
}


def construire_textures():
    os.makedirs(K.TEXDIR, exist_ok=True)
    out = {}
    out["mur_enduit"] = _save(TX.chaux(512), "mur_enduit.jpg")
    out["coque_bois"] = _save(TX.bois(512), "coque_bois.jpg")
    out["coque_faience"] = _save(TX.faience(512, base=C["village_backbar"]), "coque_faience.jpg")
    out["coque_paves"] = _save(TX.paves(512), "coque_paves.jpg")
    out["coque_pierre"] = _save(TX.pierre(512), "coque_pierre.jpg")
    out["sol_plancher"] = _save(plancher(), "sol_plancher.jpg")
    out["sol_tomettes"] = _save(TX.tomettes(512, terre=C["village_tomette"], joint=C["village_tomette_joint"]), "sol_tomettes.jpg")
    out["sol_carreaux_ciment"] = _save(carreaux_ciment(), "sol_carreaux_ciment.jpg")
    out["sol_damier"] = _save(damier(), "sol_damier.jpg")
    out["papier_fleurs_champs"] = _save(papier_fleurs(), "papier_fleurs_champs.jpg")
    out["papier_feuillage"] = _save(papier_feuillage(), "papier_feuillage.jpg")
    out["papier_rayures_creme"] = _save(papier_rayures(), "papier_rayures_creme.jpg")
    return out


# ------------------------------------------------------------------------------------------------
# Matériaux de la coque

TILED = {"lime": 1.0, "ceiling": 1.0, "floor": 1.0, "beam": 1.0, "walnut": 1.5, "tiles_dark": 1.0, "paving": 0.5, "stone": 0.5,
         "stone_big": 0.5, "floor_fond": 1.0}
TILED_MAT = {
    # clé: (matériau, image, teinte, rugosité)
    "lime": ("shell_wall_paint", "mur_enduit", C["village_lime"], 0.92),
    "ceiling": ("shell_ceiling", "mur_enduit", C["village_ceiling"], 0.92),
    "floor": ("shell_floor", "sol_plancher", None, 0.55),
    "floor_fond": ("shell_floor_fond", "sol_tomettes", None, 0.6),
    "beam": ("shell_beams", "coque_bois", C["village_beam"], 0.7),
    "walnut": ("shell_walnut", "coque_bois", C["walnut"], 0.38),
    "tiles_dark": ("shell_backbar_tiles", "coque_faience", None, 0.2),
    "paving": ("street_paving", "coque_paves", C["village_paving"], 0.85),
    "stone": ("street_stone", "coque_pierre", C["village_stone"], 0.9),
    "stone_big": ("street_stone", "coque_pierre", C["village_stone"], 0.9),
}
# clés de l'essai -> clés de l'atlas
KEYMAP = {"frame": "campagne_linen", "door_sage": "village_counter", "counter_paint": "village_counter", "shelf": "village_shelf",
          "stone_shade": "village_stone_shade", "shutter": "village_shutter", "roof": "village_roof", "glass_ext": "glass", "water": "village_water",
          "bark": "village_bark", "tree": "village_tree", "tree_light": "leaf_light", "shade_clay": "campagne_clay", "emit": "glow",
          "oak_honey": "campagne_oak", "tomette": "village_tomette"}
_mats = {}


def _img(name):
    p = next(os.path.join(K.TEXDIR, f) for f in os.listdir(K.TEXDIR) if os.path.splitext(f)[0] == name)
    return bpy.data.images.load(p, check_existing=True)


def mat_for(key, rue=False):
    if key in ("glass", "glass_ext"):
        return K.mat_verre()
    if key in ("glow", "emit"):
        return K.mat_lampe()
    if key in TILED_MAT:
        name, img, tint, rough = TILED_MAT[key]
        if name in _mats:
            return _mats[name]
        m = bpy.data.materials.new(name)
        m.use_backface_culling = True
        nt = m.node_tree
        b = nt.nodes["Principled BSDF"]
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = _img(img)
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "UVMap"
        nt.links.new(uvn.outputs["UV"], t.inputs["Vector"])
        if tint:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(t.outputs["Color"], mix.inputs["A"])
            # la texture neutre a une moyenne d'environ 0,86 (sRGB): on compense pour retrouver la teinte de la palette
            lin = K.lin4(tint)
            mix.inputs["B"].default_value = tuple(min(1.0, c / 0.70) for c in lin[:3]) + (1.0,)
            nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
        else:
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
        b.inputs["Roughness"].default_value = rough
        m["lightmapped"] = True
        _mats[name] = m
        return m
    nom = "street_atlas" if rue else "shell_atlas"
    if nom in _mats:
        return _mats[nom]
    m = K.mat_meubles().copy()
    m.name = nom
    # pas d'occlusion de sommets sur la coque: la carte de lumière la porte
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type == "VERTEX_COLOR":
            nt.nodes.remove(n)
    m["lightmapped"] = True
    _mats[nom] = m
    return m


# ------------------------------------------------------------------------------------------------
# Géométrie: la salle (reprise de l'essai, cotes du plan), la pièce du fond, la cour, la rue

X0, X1, Y0, Y1, H = S.X0, S.X1, S.Y0, S.Y1, S.H
YR0 = 6.7  # face nord du refend (côté pièce du fond)
ARCH = (5.8, 7.0, 2.2)  # arche du plan village-maximum (opening-1)


def salle():
    g = Geo("shell_village")
    g.box(X0, X1, Y0, Y1, -0.06, 0.0, "floor", bevel=0, drop=("bottom",))
    g.box(8.8, 10.0, Y1, 13.0, -0.06, 0.0, "stone_shade", bevel=0, drop=("bottom",))
    g.box(X0, X1, Y0, Y1, H, H + 0.05, "ceiling", bevel=0, drop=("top",))
    g.box(3.6, X0, Y0, Y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "w"))
    g.box(X1, 11.5, Y0, Y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "e"))
    # refend nord (y 6,70 à 7,10): baie de l'arche (comblée par le nœud « fond_ferme ») et porte de la réserve
    S.mur_x(Y0, YR0, [(ARCH[0], ARCH[1], 0, ARCH[2]), (10.0, 10.9, 0, 2.1)], g, face="s")
    # façade: vitrines (allège 0,45), porte vitrée, petite fenêtre (allège 0,90)
    S.mur_x(12.5, 13.0, [(4.4, 6.4, 0.45, 2.4), (6.5, 8.5, 0.45, 2.4), (8.8, 10.0, 0.0, 2.1), (10.2, 10.8, 0.9, 2.4)], g, face="n", x_a=3.6, x_b=11.5, ext=True)
    # la face extérieure de la façade (y = 13,0) est en pierre: les peintures du catalogue ne la touchent pas
    for f in g.bm.faces:
        c = f.calc_center_median()
        if f.normal.y < -0.9 and abs(-c.y - 13.0) < 0.01:
            f.material_index = g.mi("stone_big")
    # plinthes de chêne
    for (a, b) in ((4.0, 5.7), (ARCH[1], 7.0)):
        g.box(a, b, Y0, Y0 + 0.015, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "n"))
    g.box(X0, X0 + 0.015, 9.2, Y1, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "w"))
    g.box(X1 - 0.015, X1, 9.5, Y1, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "e"))
    for (a, b) in ((X0, 4.4), (6.4, 6.5), (8.5, 8.8), (10.0, 10.2), (10.8, X1)):
        g.box(a, b, Y1 - 0.015, Y1, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "s"))
    # cabinet de toilette (plan: cloisons de 2,70 m, porte vers l'est): x 4,00 à 5,80, y 7,10 à 9,20
    g.box(5.7, 5.8, Y0, 7.6, 0, 2.7, "lime", bevel=0, drop=("bottom",))
    g.box(5.7, 5.8, 8.5, 9.2, 0, 2.7, "lime", bevel=0, drop=("bottom",))
    g.box(5.7, 5.8, 7.6, 8.5, 2.1, 2.7, "lime", bevel=0)
    g.box(X0, 5.7, 9.1, 9.2, 0, 2.7, "lime", bevel=0, drop=("bottom",))
    g.box(X0, 5.8, Y0, 9.2, 2.7, 2.72, "lime", bevel=0, drop=())
    # porte du cabinet (fermée, chêne peint) et son chambranle
    g.box(5.78, 5.83, 7.62, 8.48, 0.0, 2.08, "door_sage", bevel=0.008, drop=("bottom",))
    g.box(5.8, 5.82, 7.55, 8.55, 2.08, 2.15, "frame", bevel=0.004)
    g.cyl(5.86, 8.38, 0.98, 1.02, 0.02, 8, "brass")
    g.rod((5.83, 8.38, 1.0), (5.86, 8.38, 1.0), 0.007, 6, "brass")
    return g


def fond_ferme():
    """Pan du refend qui ferme la pièce du fond à l'arrivée: mur plein et porte de chêne fermée (porte door-4 du plan)."""
    g = Geo("shell_village_fond_ferme")
    a, b, hh = ARCH
    yp = Y0 - 0.12  # cloison de 12 cm au nu du refend côté salle: les tableaux de l'arche restent éclairés depuis le fond
    g.box(a, 5.95, yp, Y0, 0, hh, "lime", bevel=0, drop=("bottom", "top"))
    g.box(6.85, b, yp, Y0, 0, hh, "lime", bevel=0, drop=("bottom", "top"))
    g.box(5.95, 6.85, yp, Y0, 2.1, hh, "lime", bevel=0, drop=("top",))
    # vantail de chêne en feuillure, 5 cm en retrait du nu du mur côté salle, panneaux moulurés côté salle
    g.box(5.95, 6.85, 7.0, 7.05, 0, 2.1, "beam", bevel=0.008, drop=("bottom",))
    for (z0, z1) in ((0.15, 0.95), (1.1, 1.95)):
        g.box(6.05, 6.75, 7.05, 7.065, z0, z1, "beam", bevel=0.005)
    g.box(5.88, 5.95, Y0, Y0 + 0.02, 0, 2.17, "frame", bevel=0.006, drop=("bottom",))
    g.box(6.85, 6.92, Y0, Y0 + 0.02, 0, 2.17, "frame", bevel=0.006, drop=("bottom",))
    g.box(5.88, 6.92, Y0, Y0 + 0.02, 2.1, 2.17, "frame", bevel=0.006)
    g.cyl(6.75, 7.14, 0.98, 1.02, 0.025, 8, "brass")
    return g


def piece_du_fond():
    """Pièce du fond (plan village-maximum): x 4,00 à 8,00, y 3,50 à 6,70, cheminée au mur nord, fenêtre sur la cour."""
    g = Geo("shell_village_ext_fond")
    x0, x1, y0, y1 = 4.0, 8.0, 3.5, YR0
    g.box(x0, x1, y0, y1, -0.06, 0.0, "floor_fond", bevel=0, drop=("bottom",))
    g.box(x0, x1, y0, y1, H, H + 0.05, "ceiling", bevel=0, drop=("top",))
    g.box(3.6, x0, y0, y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "w"))
    g.box(x1, 8.1, y0, y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "e"))
    # mur nord sur la cour, fenêtre de 1,10 m (allège 0,90)
    S.mur_x(y0, 3.0, [(6.6, 7.7, 0.9, 2.4)], g, face="s", x_a=3.6, x_b=8.1)
    # tableaux de l'arche (épaisseur du refend), linteau de chêne apparent
    a, b, hh = ARCH
    g.box(a - 0.001, a, YR0, Y0, 0, hh, "lime", bevel=0)
    g.box(a, b, YR0 - 0.02, Y0 + 0.02, hh - 0.0, hh + 0.18, "beam", bevel=0.01)
    # solives et poutre maîtresse (même rythme que la salle)
    for y in (3.85, 4.47, 5.09, 5.71, 6.33):
        g.box(x0, x1, y - 0.06, y + 0.06, S.JOIST_B, H, "beam", grain="x", edges="notop", bevel=0.006)
    # cheminée (fixture-6: x 4,50 à 6,00, y 3,50 à 4,05, 1,20 m), conduit jusqu'au plafond
    cx0, cx1, cy1 = 4.5, 6.0, 4.05
    g.box(cx0, cx0 + 0.25, y0, cy1, 0, 1.05, "stone_big", bevel=0.01)
    g.box(cx1 - 0.25, cx1, y0, cy1, 0, 1.05, "stone_big", bevel=0.01)
    g.box(cx0 + 0.25, cx1 - 0.25, y0, y0 + 0.1, 0, 1.05, "ink", bevel=0)
    g.box(cx0 - 0.05, cx1 + 0.05, y0, cy1 + 0.06, 1.05, 1.2, "stone_big", bevel=0.015)
    g.box(cx0 + 0.15, cx1 - 0.15, y0, y0 + 0.4, 1.2, H, "lime", bevel=0, drop=("top",))
    g.box(cx0 + 0.2, cx1 - 0.2, y0, cy1 + 0.25, -0.0, 0.03, "stone_shade", bevel=0.006)
    # chenets et bûches (le feu est cuit dans la lumière)
    for x in (cx0 + 0.45, cx1 - 0.45):
        g.box(x - 0.015, x + 0.015, y0 + 0.15, y0 + 0.4, 0.03, 0.18, "iron", bevel=0.004)
    for (dx, z) in ((-0.15, 0.1), (0.15, 0.1), (0.0, 0.18)):
        g.rod(((cx0 + cx1) / 2 + dx - 0.2, y0 + 0.3, z), ((cx0 + cx1) / 2 + dx + 0.2, y0 + 0.28, z), 0.05, 7, "bark")
    # plinthes
    g.box(x0, x1, YR0 - 0.015, YR0, 0, 0.1, "beam", bevel=0.004, drop=("bottom",))
    return g


def cour():
    """La cour vue par la fenêtre de la pièce du fond: sol, mur mitoyen, figuier (plan: tree-2)."""
    g = Geo("shell_village_ext_fond_cour")
    g.box(1.9, 11.7, -1.0, 3.0, -0.1, -0.02, "paving", bevel=0, drop=("bottom",))
    g.box(1.9, 11.7, -1.2, -1.0, -0.1, 2.6, "stone", bevel=0)
    g.cyl(3.2, 1.2, -0.02, 2.4, 0.15, 7, "bark", r_top=0.1)
    for (dx, dy, dz, r) in ((0, 0, 3.4, 1.1), (0.7, 0.3, 3.0, 0.8), (-0.6, -0.2, 3.1, 0.8)):
        g.sphere(3.2 + dx, 1.2 + dy, dz, r, r, r * 0.85, "tree" if r > 1 else "tree_light", segs=10, rings=6)
    g.box(6.4, 8.2, 0.3, 1.0, -0.02, 1.1, "village_shutter", bevel=0.02)
    return g


def remap_keys(g):
    g.keys = [KEYMAP.get(k, k) for k in g.keys]


def construire():
    geos = {}
    geos["salle"] = salle()
    geos["poutres"] = S.poutres()
    joinery, glass = S.menuiseries()
    geos["menuiseries"] = joinery
    geos["vitrages"] = glass
    geos["comptoir"] = S.comptoir()
    geos["arriere"] = S.arriere_comptoir()
    lamps = Geo("lamps")
    emit = Geo("shell_village_glow", kind="emit")
    bulbs = [S.suspension(lamps, emit, x, y, "enamel") for (x, y) in ((9.15, 8.72), (10.6, 8.85))]
    geos["lampes"] = lamps
    geos["glow"] = emit
    street, tree = S.place()
    geos["rue"] = street
    geos["tilleul"] = tree
    geos["fond_ferme"] = fond_ferme()
    geos["fond"] = piece_du_fond()
    geos["cour"] = cour()
    return geos, bulbs


def main():
    t0 = time.time()
    K.vider_scene()
    construire_textures()
    geos, bulbs = construire()
    objs = {}
    for name, g in geos.items():
        remap_keys(g)
        rue = name in ("rue", "tilleul", "cour")
        ob = K.finir(g, seed=7, tiled=TILED, matfn=(lambda k, r=rue: mat_for(k, r)))
        objs[name] = ob
    print(f"géométrie: {time.time() - t0:.0f} s")
    baked = [o for n, o in objs.items() if n not in ("vitrages", "glow")]
    # seconde UV (carte de lumière) sur tout ce qui est cuit
    for ob in baked:
        ob.data.uv_layers.new(name="lightmap")
        ob.data.uv_layers.active = ob.data.uv_layers["lightmap"]
    bpy.ops.object.select_all(action="DESELECT")
    for ob in baked:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = baked[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode="OBJECT")
    for n in ("rue", "tilleul", "cour"):
        uv = objs[n].data.uv_layers["lightmap"]
        for d in uv.data:
            d.uv = d.uv * 0.3
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(margin=0.0025, rotate=True, scale=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    for ob in baked:
        ob.data.uv_layers.active = ob.data.uv_layers["UVMap"]
        ob.data.uv_layers["UVMap"].active_render = True

    sc = bpy.context.scene
    mom = K.PAL["moments"]["afternoon"]
    SUN_AZ, SUN_EL = 205.0, float(mom["sunElevation"])
    world = bpy.data.worlds.new("ciel")
    sc.world = world
    world.node_tree.nodes["Background"].inputs["Color"].default_value = K.lin4("#D8CFCF")
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 2.4

    def demi_blanc(hx):
        return tuple(0.5 + 0.5 * c for c in K.lin4(hx)[:3])

    sun = bpy.data.lights.new("soleil", "SUN")
    sun.energy = 5.5
    sun.color = demi_blanc(mom["sun"])
    sun.angle = math.radians(1.2)
    so = bpy.data.objects.new("soleil", sun)
    sc.collection.objects.link(so)
    az, el = math.radians(SUN_AZ), math.radians(SUN_EL)
    so.rotation_euler = Vector((math.sin(az) * math.cos(el), math.cos(az) * math.cos(el), math.sin(el))).to_track_quat("Z", "Y").to_euler()
    lights = [(b, 70.0 * mom["lamps"], "#FFC27A") for b in bulbs]
    # feu de la cheminée et plafonnier de la pièce du fond (lumière chaude du coin du feu)
    lights.append(((5.25, 3.8, 0.35), 60.0, "#FF9A50"))
    lights.append(((6.0, 5.1, 2.3), 40.0 * mom["lamps"], "#FFC27A"))
    for i, (p, e, col) in enumerate(lights):
        li = bpy.data.lights.new(f"lampe_{i}", "POINT")
        li.energy = e
        li.color = demi_blanc(col)
        li.shadow_soft_size = 0.05
        lo = bpy.data.objects.new(f"lampe_{i}", li)
        lo.location = K.P(*p)
        sc.collection.objects.link(lo)

    lm_name = "shell_village_lightmap"
    lm_png = os.path.join(K.TEXDIR, lm_name + ".png")
    meta_p = os.path.join(args.travail, "lightmap.json")
    if not args.sans_cuisson:
        sc.render.engine = "CYCLES"
        sc.cycles.device = "CPU"
        sc.cycles.samples = args.spp
        sc.cycles.max_bounces = 6
        sc.cycles.diffuse_bounces = 4
        sc.render.bake.margin = 6
        img = bpy.data.images.new("lightmap_raw", args.res, args.res, float_buffer=True)
        tmp_nodes = []
        for m in {s.material for o in baked for s in o.material_slots}:
            n = m.node_tree.nodes.new("ShaderNodeTexImage")
            n.image = img
            m.node_tree.nodes.active = n
            tmp_nodes.append((m, n))
        for n in ("vitrages", "glow"):
            objs[n].hide_render = True
        bpy.ops.object.select_all(action="DESELECT")
        for ob in baked:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = baked[0]
        t = time.time()
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, uv_layer="lightmap")
        print(f"cuisson: {time.time() - t:.0f} s")
        for n in ("vitrages", "glow"):
            objs[n].hide_render = False
        for m, n in tmp_nodes:
            m.node_tree.nodes.remove(n)
        raw = np.array(img.pixels[:], dtype=np.float32).reshape(args.res, args.res, 4)[..., :3]
        # débruitage OpenImageDenoise par le compositeur (méthode de l'essai)
        raw_exr = os.path.join(args.travail, "lm_brut.exr")
        img.filepath_raw = raw_exr
        img.file_format = "OPEN_EXR"
        img.save()
        ng = bpy.data.node_groups.new("debruitage", "CompositorNodeTree")
        sc.compositing_node_group = ng
        ni = ng.nodes.new("CompositorNodeImage")
        ni.image = img
        nd = ng.nodes.new("CompositorNodeDenoise")
        go = ng.nodes.new("NodeGroupOutput")
        ng.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        ng.links.new(ni.outputs["Image"], nd.inputs["Image"])
        ng.links.new(nd.outputs["Image"], go.inputs[0])
        sc.render.engine = "BLENDER_WORKBENCH"
        sc.render.resolution_x = sc.render.resolution_y = args.res
        sc.render.resolution_percentage = 100
        sc.render.image_settings.file_format = "OPEN_EXR"
        den_exr = os.path.join(args.travail, "lm_debruite.exr")
        sc.render.filepath = den_exr
        hidden = [o for o in sc.objects if not o.hide_render]
        for o in hidden:
            o.hide_render = True
        bpy.ops.render.render(write_still=True)
        for o in hidden:
            o.hide_render = False
        sc.compositing_node_group = None
        den = bpy.data.images.load(den_exr)
        a = np.array(den.pixels[:], dtype=np.float32).reshape(args.res, args.res, 4)[..., :3]
        a = np.where(a.sum(-1, keepdims=True) > 1e-5, a, raw)
        lum = a.mean(-1)
        used = lum[lum > 1e-4]
        Kc = float(np.percentile(used, 99.7)) if used.size else 1.0
        enc = K.l2s(np.clip(a / Kc, 0, 1))
        from PIL import Image
        Image.fromarray((np.flipud(enc) * 255 + 0.5).astype(np.uint8)).save(lm_png, optimize=True)
        meta = {"lightmap_scale": Kc, "bake_spp": args.spp, "bake_res": args.res}
        json.dump(meta, open(meta_p, "w"))
    else:
        meta = json.load(open(meta_p))

    # branchement de la carte de lumière: occlusion glTF sur la seconde UV
    lm_img = bpy.data.images.load(lm_png, check_existing=True)
    lm_img.colorspace_settings.name = "sRGB"
    grp = bpy.data.node_groups.get("glTF Material Output") or bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
    if not grp.interface.items_tree:
        grp.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    for m in {s.material for o in baked for s in o.material_slots}:
        if not m.get("lightmapped"):
            continue
        nt = m.node_tree
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = "lightmap"
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = lm_img
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
        gn = nt.nodes.new("ShaderNodeGroup")
        gn.node_tree = grp
        nt.links.new(sep.outputs["Red"], gn.inputs["Occlusion"])

    def joindre(liste, nom):
        bpy.ops.object.select_all(action="DESELECT")
        for o in liste:
            o.select_set(True)
        bpy.context.view_layer.objects.active = liste[0]
        if len(liste) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = nom
        ob.data.name = nom
        return ob

    shell = joindre([objs[n] for n in ("salle", "poutres", "menuiseries", "comptoir", "arriere", "lampes")], "shell_village")
    street = joindre([objs["rue"], objs["tilleul"]], "shell_village_street")
    glass = objs["vitrages"]
    glass.name = glass.data.name = "shell_village_glass"
    glow = objs["glow"]
    ferme = objs["fond_ferme"]
    fond = joindre([objs["fond"], objs["cour"]], "shell_village_ext_fond")
    for o in (shell, street, glass, glow, ferme, fond):
        o.data.uv_layers.active_index = 0
    K.ao_blanc([shell, street, glass, glow, ferme, fond])
    for o in (shell, street, ferme, fond):
        o["lightmap_scale"] = meta["lightmap_scale"]
    fiches = {}
    for nom, objs_ in (("shell_village", [shell, glass, glow, street, ferme]), ("shell_village_ext_fond", [fond])):
        path = os.path.join(K.ASSETS, nom + ".glb")
        size = K.exporter_glb(objs_, path, extras={"lightmap_scale": meta["lightmap_scale"], "lightmap": f"textures/{lm_name}.png"})
        fiches[nom] = {"id": nom, "fichier": nom + ".glb", "poids_octets": size,
                       "triangles": {o.name: K.tris(o) for o in objs_},
                       "materiaux": sorted({s.material.name for o in objs_ for s in o.material_slots})}
    fiches["cuisson"] = {**meta, "soleil": {"azimut_deg": SUN_AZ, "hauteur_deg": SUN_EL}, "lampes": [list(p) for p, _, _ in lights]}
    fiches["variantes"] = VARIANTES
    out = os.path.join(ICI, "fiches", "coque.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump(fiches, open(out, "w"), ensure_ascii=False, indent=1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ICI, "fiches", "coque.blend"), compress=True)
    print(json.dumps({k: v for k, v in fiches.items() if k.startswith("shell")}, ensure_ascii=False))
    print(f"total: {time.time() - t0:.0f} s")


main()
