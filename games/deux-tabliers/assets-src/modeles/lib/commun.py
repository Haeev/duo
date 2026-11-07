"""Bibliothèque commune des modèles de Deux Tabliers (Blender 5.2, `duo-python`), rendu semi-réaliste (variante B).

Repère de travail: celui des plans (`docs/jeux/cosy-cafe/plans/plans.json`): x vers l'est, y vers le sud, z en haut,
en mètres. Blender reçoit (x, -y, z) (geo.P); l'export glTF donne x = x, Y en haut, z = y du plan. Un meuble est
construit autour de l'origine, l'avant vers le sud (y du plan positif), donc vers +Z glTF.

Matières des meubles et objets: un seul matériau partagé, `dt_meubles`, sur un atlas de 2048 px en 4 x 4 tuiles de
512 px (une tuile de palette, quinze tuiles de matière déjà teintées), plus une carte rugosité et métal au même plan.
Les GLB référencent l'atlas en fichier externe (`textures/`): un seul exemplaire sur le disque pour tout le catalogue.
Deux matériaux à part: `dt_verre` (transparent) et `dt_lampe` (abat-jour allumé, émissif).
"""

import json
import math
import os
import random
import struct
import subprocess
import tempfile

import bpy
import bmesh
import numpy as np
from mathutils import Vector

import geo as G
from geo import Geo, P  # noqa: F401
import textures as TX

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(ICI)
RACINE = os.path.normpath(os.path.join(SRC, "..", "..", "..", ".."))
ASSETS = os.path.normpath(os.path.join(SRC, "..", "..", "assets", "modeles"))
TEXDIR = os.path.join(ASSETS, "textures")

# Variante B de l'essai: chanfreins de la bible x 0,18 (3 à 5 mm), pièces rondes à 2 fois les pans, lissage à 40 degrés
STYLE_B = G.Style("B", 0.18, 0.002, 1, 1, 2.0, True, 40)
G.set_style(STYLE_B)


def charger_palette():
    out = subprocess.run(["node", os.path.join(ICI, "exporter_palette.cjs")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


PAL = charger_palette()
C = PAL["couleurs"]


def rgb(hexs):
    h = hexs.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def s2l(a):
    a = np.asarray(a, dtype=np.float64)
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def l2s(a):
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(a, 1 / 2.4) - 0.055)


def lin4(hexs):
    return tuple(s2l(rgb(hexs))) + (1.0,)


# ------------------------------------------------------------------------------------------------
# Atlas des meubles

N_ATLAS = 2048
TUILE = 512
GRID = 4
CELL = 16  # cases de palette: 32 x 32 dans la tuile 0
N_ORM = 512

# clés de palette -> (hex, rugosité, métal). Les métaux et émaux se lisent par la rugosité et le métal
# (variante B), le reste est mat.
METAUX = {"copper": 0.32, "brass": 0.3, "steel": 0.28, "steel_dark": 0.45, "zinc": 0.5, "chrome": 0.18, "iron": 0.55}
EMAUX = {"porcelain": 0.12, "rim": 0.12, "enamel": 0.2, "glaze_sage": 0.2, "glaze_blue": 0.2, "lacquer_red": 0.25}
EXTRA = {
    "chrome": "#C9CDD0", "iron": "#2F3432", "rim": C["house_bottle"], "enamel": C["house_bottle"], "glaze_sage": C["campagne_sage"],
    "glaze_blue": C["campagne_faience"], "lacquer_red": "#8E3A34", "white_paint": C["nordique_white"], "cushion_cream": C["campagne_linen"],
    "sage_paint": C["village_counter"], "slate_frame": C["oak_dark"], "cardboard": C["kraft"], "tape": "#C9A86A", "label": C["paper"],
    "chocolate_bar": C["chocolate"], "glaze_apricot": "#D9963F", "apricot": "#E0A040", "custard": "#E9C77A", "pastry": C["crust"],
    "leaf_dark": "#46623A", "flower_white": "#EEE8DA", "flower_yellow": "#E1B64A", "flower_rose": "#C98A8C",
    "bulb": C["lamp_shade"], "screen": "#2E3436", "rubber": "#2B2B2D", "fridge_white": "#E4E0D6",
}

# tuiles de matière: nom -> (générateur, teinte, rugosité, métal, mètres par tuile)
TUILES = [
    ("palette", None, None, None, None, None),
    ("oak_campagne", "bois", C["campagne_oak"], 0.55, 0.0, 1.0),
    ("wood_bistrot", "bois", C["bistrot_wood"], 0.38, 0.0, 1.0),
    ("ash_nordique", "bois", C["nordique_ash"], 0.6, 0.0, 1.0),
    ("walnut", "bois", C["walnut"], 0.38, 0.0, 1.0),
    ("straw", "paille", C["campagne_straw"], 0.85, 0.0, 0.5),
    ("linen", "lin", C["campagne_linen"], 0.9, 0.0, 0.5),
    ("moleskine", "cuir", C["bistrot_moleskine"], 0.45, 0.0, 1.0),
    ("wool", "laine", C["nordique_wool"], 0.95, 0.0, 0.5),
    ("marble", "marbre", C["bistrot_marble"], 0.2, 0.0, 1.0),
    ("terracotta", "terre", C["campagne_clay"], 0.8, 0.0, 0.5),
    ("rug_bistrot", "tapis_losanges", None, 0.95, 0.0, 1.0),
    ("stripes", "rayures", None, 0.85, 0.0, 1.0),
    ("zinc", "zinc", C["bistrot_zinc"], 0.45, 0.8, 1.0),
    ("kraft", "kraft", C["kraft"], 0.9, 0.0, 0.5),
    ("rug_campagne", "tapis_chiffons", None, 0.95, 0.0, 1.0),
]
TUILE_INDEX = {t[0]: i for i, t in enumerate(TUILES)}


def _tile_rect(i):
    col, row = i % GRID, i // GRID
    return col, row


class Atlas:
    def __init__(self):
        self.cells = {}  # clé -> index

    def key_hex(self, key):
        if key.startswith("#"):
            return key.upper()
        if key in EXTRA:
            return EXTRA[key].upper()
        if key in C:
            return C[key].upper()
        raise KeyError(key)

    def rough_metal(self, key):
        if key.startswith("t:"):
            t = TUILES[TUILE_INDEX[key[2:]]]
            return t[3], t[4]
        if key in METAUX:
            return METAUX[key], 1.0
        if key in EMAUX:
            return EMAUX[key], 0.0
        return 0.72, 0.0

    def cell_uv(self, key):
        if key not in self.cells:
            self.cells[key] = len(self.cells)
            if len(self.cells) > 32 * 32:
                raise RuntimeError("palette de l'atlas pleine")
        i = self.cells[key]
        cx, cy = i % 32, i // 32
        return ((cx + 0.5) * CELL / N_ATLAS, 1 - (cy + 0.5) * CELL / N_ATLAS)

    @staticmethod
    def tile_uv(name, u, v):
        """u, v dans [0, 1] de la tuile -> UV Blender de l'atlas (marge de 6 px contre le débord des mipmaps)."""
        col, row = _tile_rect(TUILE_INDEX[name])
        m = 6 / TUILE
        uu = (col + m + u * (1 - 2 * m)) / GRID
        vv = 1 - (row + 1) / GRID + (m + v * (1 - 2 * m)) / GRID
        return (uu, vv)


ATLAS = Atlas()
# cases fixes, toujours au même endroit d'une construction à l'autre (l'atlas est partagé par plusieurs scripts)
CASES_FIXES = ["porcelain", "rim", "paper", "milk", "ink", "espresso", "crema", "chocolate", "tea", "crust", "crumb", "berry", "kraft",
               "walnut", "oak_dark", "slate", "zinc", "tray", "oak_honey", "linen", "leaf", "leaf_light", "pot", "copper", "brass", "steel",
               "steel_dark", "glass", "lamp_shade", "alert", "alert_ink", "player_on", "chrome", "iron", "enamel", "glaze_sage", "glaze_blue",
               "lacquer_red", "white_paint", "cushion_cream", "sage_paint", "cardboard", "tape", "label", "chocolate_bar", "glaze_apricot",
               "apricot", "custard", "pastry", "leaf_dark", "flower_white", "flower_yellow", "flower_rose", "bulb", "screen", "rubber",
               "fridge_white", "campagne_oak", "campagne_linen", "campagne_clay", "campagne_sage", "campagne_faience", "campagne_straw",
               "bistrot_moleskine", "bistrot_wood", "bistrot_brass", "bistrot_zinc", "bistrot_tile_dark", "bistrot_tile_light", "bistrot_marble",
               "nordique_ash", "nordique_white", "nordique_wool", "nordique_blue", "nordique_rose", "nordique_fir", "house_bottle",
               "house_bordeaux", "house_mustard", "house_terracotta", "village_counter", "village_beam", "plaster", "marble_dark",
               "citrus", "season_autumn_leaf", "jardin_iron", "jardin_rattan", "jardin_pot", "shadow_contact", "village_stone", "village_shutter",
               "top_light_cream", "presses_coat", "familles_sky", "gourmands_raspberry", "promeneurs_forest", "lamp_warm"]
for _k in CASES_FIXES:
    ATLAS.cell_uv(_k)


# --- générateurs supplémentaires (en plus de ceux de l'essai: bois, paille, chaux, peinture, pierre, pavés, tomettes, faïence)

def _noise(shape, sigma, rng):
    return TX._noise(shape, sigma, rng)


def gen_lin(n=512, seed=21):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 96
    wx = 0.5 + 0.5 * np.cos(x * k * 2 * math.pi)
    wy = 0.5 + 0.5 * np.cos(y * k * 2 * math.pi)
    v = 0.84 + 0.04 * (wx * wy) + 0.03 * _noise((n, n), (0.6, 6), rng) + 0.02 * _noise((n, n), (6, 0.6), rng)
    return np.stack([v, v, v], -1)


def gen_cuir(n=512, seed=23):
    rng = np.random.default_rng(seed)
    v = 0.86 + 0.03 * _noise((n, n), 1.2, rng) + 0.03 * _noise((n, n), n / 16, rng)
    return np.stack([v, v, v], -1)


def gen_laine(n=512, seed=25):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    k = 40
    rib = 0.5 + 0.5 * np.cos(x * k * 2 * math.pi)
    v = 0.82 + 0.06 * rib + 0.04 * _noise((n, n), 1.0, rng)
    return np.stack([v, v, v], -1)


def gen_marbre(n=512, seed=27):
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    w = _noise((n, n), n / 10, rng) * 0.6 + _noise((n, n), n / 30, rng) * 0.2
    veins = np.abs(np.sin((x * 3 + y * 1.5 + w) * math.pi * 2))
    v = 0.84 + 0.06 * _noise((n, n), n / 12, rng) + 0.25 * np.clip(1 - veins / 0.05, 0, 1)
    return np.stack([v, v * 1.01, v], -1)


def gen_terre(n=512, seed=29):
    rng = np.random.default_rng(seed)
    v = 0.86 + 0.04 * _noise((n, n), n / 20, rng) + 0.025 * _noise((n, n), 1.0, rng)
    return np.stack([v, v, v], -1)


def gen_zinc(n=512, seed=31):
    rng = np.random.default_rng(seed)
    v = 0.86 + 0.03 * _noise((n, n), (0.5, n / 4), rng) + 0.03 * _noise((n, n), n / 8, rng)
    return np.stack([v, v, v], -1)


def gen_kraft(n=512, seed=33):
    rng = np.random.default_rng(seed)
    v = 0.86 + 0.035 * _noise((n, n), 0.8, rng) + 0.02 * _noise((n, n), n / 12, rng)
    return np.stack([v, v * 0.99, v * 0.97], -1)


def gen_rayures(n=512, seed=35):
    """Toile rayée du store et du parasol: vert bouteille de la maison et écru, bandes de 12,5 cm (8 par mètre)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    a, b = s2l(rgb(C["house_bottle"])), s2l(rgb(C["campagne_linen"]))
    band = ((x * 8) % 1.0) < 0.5
    col = np.where(band[..., None], a[None, None, :], b[None, None, :])
    col = col * (1 + 0.04 * _noise((n, n), (0.6, 4), rng))[..., None]
    return l2s(col)


def gen_tapis_losanges(n=512, seed=37):
    """Tapis du bistrot: losanges bordeaux et crème, bordure sombre (tuile d'un mètre)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    a, b, c = s2l(rgb(C["bistrot_moleskine"])), s2l(rgb(C["bistrot_tile_light"])), s2l(rgb(C["bistrot_wood"]))
    d = (np.abs(((x * 6) % 1.0) - 0.5) + np.abs(((y * 6) % 1.0) - 0.5))
    col = np.where((d < 0.32)[..., None], b[None, None, :], a[None, None, :])
    col = np.where((np.abs(d - 0.36) < 0.025)[..., None], c[None, None, :], col)
    col = col * (1 + 0.05 * _noise((n, n), 0.8, rng))[..., None]
    return l2s(col)


def gen_tapis_chiffons(n=512, seed=39):
    """Tapis de chiffons de la campagne: bandes tissées irrégulières (lin, terre cuite, sauge, faïence)."""
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[0:n, 0:n] / n
    cols = [s2l(rgb(C[k])) for k in ("campagne_linen", "campagne_clay", "campagne_sage", "campagne_faience", "campagne_linen", "campagne_straw")]
    rows = 18
    idx = (np.floor(y * rows).astype(int) * 7 + 3) % len(cols)
    col = np.stack([np.choose(idx, [c[i] for c in cols]) for i in range(3)], -1)
    weave = 0.5 + 0.5 * np.cos(x * 120 * 2 * math.pi)
    col = col * (0.92 + 0.08 * weave + 0.05 * _noise((n, n), 0.8, rng))[..., None]
    return l2s(col)


GENS = {"bois": TX.bois, "paille": TX.paille, "lin": gen_lin, "cuir": gen_cuir, "laine": gen_laine, "marbre": gen_marbre, "terre": gen_terre,
        "zinc": gen_zinc, "kraft": gen_kraft, "rayures": gen_rayures, "tapis_losanges": gen_tapis_losanges, "tapis_chiffons": gen_tapis_chiffons}


def construire_atlas():
    """Écrit textures/meubles_atlas.jpg (couleur, sRGB) et textures/meubles_orm.png (G rugosité, B métal)."""
    from PIL import Image

    os.makedirs(TEXDIR, exist_ok=True)
    img = np.zeros((N_ATLAS, N_ATLAS, 3))
    orm = np.zeros((N_ORM, N_ORM, 3))
    orm[..., 0] = 1.0
    k = N_ORM / N_ATLAS
    for i, (name, gen, tint, rough, metal, _) in enumerate(TUILES):
        col, row = _tile_rect(i)
        y0, x0 = row * TUILE, col * TUILE
        if name == "palette":
            for key, ci in ATLAS.cells.items():
                cx, cy = ci % 32, ci // 32
                img[y0 + cy * CELL:y0 + (cy + 1) * CELL, x0 + cx * CELL:x0 + (cx + 1) * CELL] = rgb(ATLAS.key_hex(key))
                r, m = ATLAS.rough_metal(key)
                c0 = int(round(cx * CELL * k)), int(round(cy * CELL * k))
                c1 = int(round((cx + 1) * CELL * k)), int(round((cy + 1) * CELL * k))
                orm[int(y0 * k) + c0[1]:int(y0 * k) + c1[1], int(x0 * k) + c0[0]:int(x0 * k) + c1[0], 1] = r
                orm[int(y0 * k) + c0[1]:int(y0 * k) + c1[1], int(x0 * k) + c0[0]:int(x0 * k) + c1[0], 2] = m
            continue
        a = GENS[gen](n=TUILE) if gen in ("bois", "paille") else GENS[gen](n=TUILE)
        a = np.clip(a, 0, 1)
        if tint:
            la = s2l(a)
            mean = la.mean()
            a = l2s(la * (s2l(rgb(tint)) / max(1e-4, mean))[None, None, :])
        img[y0:y0 + TUILE, x0:x0 + TUILE] = a
        orm[int(y0 * k):int((y0 + TUILE) * k), int(x0 * k):int((x0 + TUILE) * k), 1] = rough
        orm[int(y0 * k):int((y0 + TUILE) * k), int(x0 * k):int((x0 + TUILE) * k), 2] = metal
    Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(TEXDIR, "meubles_atlas.jpg"), quality=90)
    Image.fromarray((np.clip(orm, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(TEXDIR, "meubles_orm.png"), optimize=True)


# ------------------------------------------------------------------------------------------------
# Matériaux

def _bsdf(m):
    return m.node_tree.nodes["Principled BSDF"]


def mat_meubles():
    m = bpy.data.materials.get("dt_meubles")
    if m:
        return m
    m = bpy.data.materials.new("dt_meubles")
    m.use_backface_culling = True
    nt = m.node_tree
    b = _bsdf(m)
    col = bpy.data.images.load(os.path.join(TEXDIR, "meubles_atlas.jpg"), check_existing=True)
    orm = bpy.data.images.load(os.path.join(TEXDIR, "meubles_orm.png"), check_existing=True)
    orm.colorspace_settings.name = "Non-Color"
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    t1 = nt.nodes.new("ShaderNodeTexImage")
    t1.image = col
    t2 = nt.nodes.new("ShaderNodeTexImage")
    t2.image = orm
    nt.links.new(uvn.outputs["UV"], t1.inputs["Vector"])
    nt.links.new(uvn.outputs["UV"], t2.inputs["Vector"])
    # occlusion des sommets multipliée à la couleur (l'export écrit COLOR_0, que Three.js multiplie)
    va = nt.nodes.new("ShaderNodeVertexColor")
    va.layer_name = "ao"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    nt.links.new(t1.outputs["Color"], mix.inputs["A"])
    nt.links.new(va.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(t2.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    return m


def mat_verre():
    m = bpy.data.materials.get("dt_verre")
    if m:
        return m
    m = bpy.data.materials.new("dt_verre")
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = lin4(C["glass"])
    b.inputs["Alpha"].default_value = 0.28
    b.inputs["Roughness"].default_value = 0.08
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = False
    return m


def mat_lampe():
    m = bpy.data.materials.get("dt_lampe")
    if m:
        return m
    m = bpy.data.materials.new("dt_lampe")
    m.use_backface_culling = True
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = lin4(C["lamp_shade"])
    b.inputs["Emission Color"].default_value = lin4(C["lamp_shade"])
    b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.6
    return m


# ------------------------------------------------------------------------------------------------
# Du Geo à l'objet Blender, UV de l'atlas

def _islands(bm, keys):
    """Îlots de faces connexes de même clé texturée."""
    seen = set()
    out = []
    for f in bm.faces:
        if f.index in seen or not keys[f.material_index].startswith("t:"):
            continue
        k = f.material_index
        stack = [f]
        isl = []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen and h.material_index == k:
                        seen.add(h.index)
                        stack.append(h)
        out.append(isl)
    return out


def finir(geo, coll=None, seed=1):
    """Crée l'objet Blender d'un Geo: lissage de la variante B, UV de l'atlas (case de palette au centre pour les clés
    simples; projection en mètres pour les tuiles, chaque îlot placé dans sa tuile à un décalage tiré au sort)."""
    rng = random.Random(seed)
    bm = geo.bm
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.normal_update()
    bm.faces.index_update()
    for lay in list(bm.loops.layers.uv.values()):
        bm.loops.layers.uv.remove(lay)
    uv = bm.loops.layers.uv.new("UVMap")
    keys = geo.keys
    gl = geo.gl
    proj = {}
    for f in bm.faces:
        k = keys[f.material_index]
        if not k.startswith("t:"):
            c = ATLAS.cell_uv(k) if k not in ("glass", "glow") else (0.5, 0.5)
            for lp in f.loops:
                lp[uv].uv = c
            continue
        span = TUILES[TUILE_INDEX[k[2:]]][5]
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = {2: (0, 1), 1: (0, 2), 0: (1, 2)}[ax]
        g = f[gl] - 1
        if g == b:
            a, b = b, a
        proj[f.index] = [(lp.vert.co[a] / span, lp.vert.co[b] / span) for lp in f.loops]
    for isl in _islands(bm, keys):
        pts = [p for f in isl for p in proj[f.index]]
        u0, u1 = min(p[0] for p in pts), max(p[0] for p in pts)
        v0, v1 = min(p[1] for p in pts), max(p[1] for p in pts)
        e = max(u1 - u0, v1 - v0, 1e-6)
        s = min(1.0, 0.98 / e)
        du = rng.uniform(0, max(0.0, 1 - (u1 - u0) * s))
        dv = rng.uniform(0, max(0.0, 1 - (v1 - v0) * s))
        name = keys[isl[0].material_index][2:]
        for f in isl:
            for lp, (pu, pv) in zip(f.loops, proj[f.index]):
                lp[uv].uv = Atlas.tile_uv(name, (pu - u0) * s + du, (pv - v0) * s + dv)
    lim = math.radians(G.STYLE.sharp_deg if not geo.smooth else 60)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2:
            fa, fb = e.link_faces
            if fa.normal.angle(fb.normal, 0) > lim or fa.material_index != fb.material_index:
                e.smooth = False
        else:
            e.smooth = False
    me = bpy.data.meshes.new(geo.name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(geo.name, me)
    (coll or bpy.context.scene.collection).objects.link(ob)
    # matériaux: un par famille
    fam = []
    for k in keys:
        fam.append({"glass": mat_verre, "glow": mat_lampe}.get(k, mat_meubles)())
    uniq = []
    remap = []
    for m in fam:
        if m not in uniq:
            uniq.append(m)
        remap.append(uniq.index(m))
    for p in me.polygons:
        p.material_index = remap[p.material_index]
    for m in uniq:
        me.materials.append(m)
    if Geo.registry and Geo.registry[-1] is geo:
        Geo.registry.pop()
    elif geo in Geo.registry:
        Geo.registry.remove(geo)
    return ob


def separer_par_materiau(ob):
    """Un objet par matériau (dt_meubles, dt_verre, dt_lampe): nœuds `<nom>`, `<nom>_glass`, `<nom>_glow`."""
    if len(ob.data.materials) <= 1:
        return [ob]
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.mesh.separate(type="MATERIAL")
    parts = [o for o in bpy.context.selected_objects]
    base = ob.name.split(".")[0]
    for o in parts:
        mname = o.data.materials[0].name if o.data.materials else ""
        o.name = {"dt_verre": base + "_glass", "dt_lampe": base + "_glow"}.get(mname, base)
        o.data.name = o.name
    return parts


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


# ------------------------------------------------------------------------------------------------
# Occlusion dans les couleurs de sommets (Cycles, cuisson AO vers l'attribut de couleur)

def cuire_ao(objs, samples=24, distance=0.25, mini=0.5):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    if sc.world is None:
        sc.world = bpy.data.worlds.new("monde")
    sc.world.light_settings.distance = distance
    for o in objs:
        me = o.data
        if "ao" not in me.color_attributes:
            me.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
        me.color_attributes.active_color = me.color_attributes["ao"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
    for o in objs:
        att = o.data.color_attributes["ao"]
        n = len(att.data)
        a = np.empty(n * 4, dtype=np.float32)
        att.data.foreach_get("color", a)
        a = a.reshape(n, 4)
        v = mini + (1 - mini) * a[:, 0]
        a[:, 0] = a[:, 1] = a[:, 2] = v
        a[:, 3] = 1
        att.data.foreach_set("color", a.ravel())


def ao_blanc(objs):
    for o in objs:
        me = o.data
        if "ao" not in me.color_attributes:
            me.color_attributes.new("ao", "BYTE_COLOR", "CORNER")
        att = me.color_attributes["ao"]
        a = np.ones(len(att.data) * 4, dtype=np.float32)
        att.data.foreach_set("color", a)
        me.color_attributes.active_color = att


# ------------------------------------------------------------------------------------------------
# Export: glTF séparé dans un dossier temporaire, puis GLB dont les images restent des fichiers externes

URIS = {"meubles_atlas": "textures/meubles_atlas.jpg", "meubles_orm": "textures/meubles_orm.png"}


def exporter_glb(objs, chemin, extras=None, externes=True):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    if extras:
        for k, v in extras.items():
            objs[0][k] = v
    tmp = tempfile.mkdtemp(prefix="dt_export_")
    gltf_path = os.path.join(tmp, "m.gltf")
    bpy.ops.export_scene.gltf(filepath=gltf_path, export_format="GLTF_SEPARATE", use_selection=True, export_yup=True, export_apply=True,
                              export_texcoords=True, export_normals=True, export_materials="EXPORT", export_extras=True,
                              export_vertex_color="ACTIVE", export_cameras=False, export_lights=False, export_image_format="AUTO",
                              export_texture_dir="tex")
    with open(gltf_path) as fh:
        g = json.load(fh)
    binp = os.path.join(tmp, g["buffers"][0]["uri"])
    with open(binp, "rb") as fh:
        data = fh.read()
    g["buffers"][0].pop("uri", None)
    g["buffers"][0]["byteLength"] = len(data)
    for im in g.get("images", []):
        base = os.path.splitext(os.path.basename(im.get("uri", "")))[0]
        if externes and base in URIS:
            im["uri"] = URIS[base]
            im["mimeType"] = "image/jpeg" if URIS[base].endswith(".jpg") else "image/png"
        else:
            # image propre au modèle: on l'embarque
            with open(os.path.join(tmp, im["uri"]), "rb") as fh:
                b = fh.read()
            while len(data) % 4:
                data += b"\0"
            g.setdefault("bufferViews", []).append({"buffer": 0, "byteOffset": len(data), "byteLength": len(b)})
            data += b
            im["bufferView"] = len(g["bufferViews"]) - 1
            im["mimeType"] = "image/png" if im["uri"].endswith(".png") else "image/jpeg"
            im.pop("uri")
    g["buffers"][0]["byteLength"] = len(data)
    js = json.dumps(g, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    while len(data) % 4:
        data += b"\0"
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(data))
    out += struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(data), 0x004E4942) + data
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "wb") as fh:
        fh.write(out)
    return os.path.getsize(chemin)


def bornes(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def gltf_dims(objs):
    """Dimensions en repère glTF: largeur x (est-ouest), hauteur y, profondeur z (avant-arrière)."""
    mn, mx = bornes(objs)
    return [round(mx.x - mn.x, 3), round(mx.z - mn.z, 3), round(mx.y - mn.y, 3)]


def vider_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    Geo.registry.clear()
