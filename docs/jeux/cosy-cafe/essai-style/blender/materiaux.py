"""Matières des deux variantes.

Chaque face de la scène porte une clé (« lime », « walnut », ou une couleur « #RRGGBB » de la palette pour les
personnages). La variante décide du rendu:

- A, « stylisé chaleureux »: une seule texture de palette (cases de 4 px, filtrage au plus proche), une face
  par case, aucune texture de matière; tout le décor dans un seul matériau (bible, section 6).
- B, « semi-réaliste »: matières PBR réduites (bois veiné, tomettes, chaux, faïence, paille, pierre, pavés)
  en tuiles de 512 px au plus, métaux et émaux par facteurs; ce qui n'a pas de texture reste sur la palette.

Toutes les couleurs viennent de la palette de la bible (exporter_palette.cjs lit bible/source/palette.cjs).
"""

import json
import os
import subprocess

import bpy

ICI = os.path.dirname(os.path.abspath(__file__))


def charger_palette():
    out = subprocess.run(["node", os.path.join(ICI, "exporter_palette.cjs")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


PAL = charger_palette()
C = PAL["couleurs"]

# clé de la scène -> identifiant de la palette
CLES = {
    "lime": "village_lime",
    "ceiling": "village_ceiling",
    "beam": "village_beam",
    "tomette": "village_tomette",
    "joint": "village_tomette_joint",
    "counter_paint": "village_counter",
    "door_sage": "village_counter",
    "walnut": "walnut",
    "shelf": "village_shelf",
    "tiles_dark": "village_backbar",
    "oak_honey": "campagne_oak",
    "straw": "campagne_straw",
    "oak_dark": "oak_dark",
    "frame": "campagne_linen",
    "copper": "copper",
    "brass": "brass",
    "steel": "steel",
    "steel_dark": "steel_dark",
    "porcelain": "porcelain",
    "rim": "house_bottle",
    "enamel": "house_bottle",
    "shade_clay": "campagne_clay",
    "espresso": "espresso",
    "crema": "crema",
    "milk": "milk",
    "crust": "crust",
    "crumb": "crumb",
    "paper": "paper",
    "ink": "ink",
    "slate": "slate",
    "tray": "tray",
    "book": "house_bordeaux",
    "page": "paper",
    "leaf": "leaf",
    "leaf_light": "leaf_light",
    "pot": "pot",
    "linen": "linen",
    "kraft": "kraft",
    "glass": "glass",
    "glass_ext": "glass",
    "alert": "alert",
    "alert_ink": "alert_ink",
    "player_on": "player_on",
    "piping": "player_piping",
    "stone": "village_stone",
    "stone_shade": "village_stone_shade",
    "shutter": "village_shutter",
    "roof": "village_roof",
    "tree": "village_tree",
    "tree_light": "leaf_light",
    "bark": "village_bark",
    "paving": "village_paving",
    "water": "village_water",
    "zinc": "zinc",
    "contact": "shadow_contact",
    "emit": "lamp_shade",
}


def hex_of(key):
    if key.startswith("#"):
        return key.upper()
    if key in CLES:
        return C[CLES[key]].upper()
    if key in C:
        return C[key].upper()
    raise KeyError(key)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexs):
    h = hexs.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def lin(hexs):
    return tuple(srgb_to_lin(c) for c in rgb(hexs)) + (1.0,)


# ------------------------------------------------------------------------------------------------
# Texture de palette (partagée par A, et par B pour ce qui n'a pas de texture de matière)

GRILLE = 16  # 16 x 16 cases de 4 px: 64 x 64


class Palette:
    def __init__(self):
        self.cells = {}  # hex -> index

    def cell(self, key):
        hx = hex_of(key)
        if hx not in self.cells:
            if len(self.cells) >= GRILLE * GRILLE:
                raise RuntimeError("palette pleine")
            self.cells[hx] = len(self.cells)
        i = self.cells[hx]
        cx, cy = i % GRILLE, i // GRILLE
        # centre de la case, v vers le haut dans Blender (l'export retourne v)
        return ((cx + 0.5) / GRILLE, 1 - (cy + 0.5) / GRILLE)

    def image(self, name="palette"):
        n = GRILLE * 4
        img = bpy.data.images.get(name) or bpy.data.images.new(name, n, n, alpha=False)
        px = [0.0] * (n * n * 4)
        for hx, i in self.cells.items():
            r, g, b = rgb(hx)
            cx, cy = i % GRILLE, i // GRILLE
            for yy in range(4):
                for xx in range(4):
                    x = cx * 4 + xx
                    y = n - 1 - (cy * 4 + yy)  # Blender range les pixels du bas vers le haut
                    o = (y * n + x) * 4
                    px[o:o + 4] = [r, g, b, 1.0]
        img.pixels.foreach_set(px)
        img.update()
        return img


# ------------------------------------------------------------------------------------------------
# Spécifications de la variante B: texture de matière (ou None = palette), rugosité, métal, échelle des UV

B_SPEC = {
    # clé: (texture, rugosité, métal, répétitions par mètre)
    "lime": ("chaux", 0.92, 0.0, 1.0),
    "ceiling": ("chaux", 0.92, 0.0, 1.0),
    "beam": ("bois", 0.7, 0.0, 1.0),
    "tomette": ("tomettes", 0.62, 0.0, 1.0),
    "counter_paint": ("peinture", 0.55, 0.0, 1.0),
    "door_sage": ("peinture", 0.55, 0.0, 1.0),
    "frame": ("peinture", 0.5, 0.0, 1.0),
    "walnut": ("bois", 0.38, 0.0, 1.5),
    "shelf": ("bois", 0.5, 0.0, 1.5),
    "oak_honey": ("bois", 0.55, 0.0, 2.0),
    "oak_dark": ("bois", 0.42, 0.0, 1.5),
    "tray": ("bois", 0.4, 0.0, 2.0),
    "tiles_dark": ("faience", 0.18, 0.0, 1.0),
    "straw": ("paille", 0.85, 0.0, 2.0),
    "stone": ("pierre", 0.9, 0.0, 0.5),
    "stone_shade": ("pierre", 0.9, 0.0, 0.5),
    "paving": ("paves", 0.85, 0.0, 0.5),
    "copper": (None, 0.32, 1.0, 1.0),
    "brass": (None, 0.3, 1.0, 1.0),
    "steel": (None, 0.28, 1.0, 1.0),
    "steel_dark": (None, 0.45, 0.6, 1.0),
    "zinc": (None, 0.5, 0.8, 1.0),
    "porcelain": (None, 0.12, 0.0, 1.0),
    "rim": (None, 0.12, 0.0, 1.0),
    "enamel": (None, 0.2, 0.0, 1.0),
    "slate": (None, 0.7, 0.0, 1.0),
}
# familles de matériaux de B qui partagent la palette (un seul matériau par famille)
B_FAMILLE_PALETTE = {
    "metal": ["copper", "brass", "steel", "steel_dark", "zinc"],
    "glaze": ["porcelain", "rim", "enamel"],
}


def uv_scale_for(variant):
    def f(key):
        if variant == "B" and key in B_SPEC and B_SPEC[key][0]:
            return B_SPEC[key][3]
        return 1.0
    return f


def _principled(mat):
    return mat.node_tree.nodes["Principled BSDF"]


def mat_palette(name, palette_img, rough=0.85, metal=0.0, kind="static"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_backface_culling = True
    nt = m.node_tree
    bsdf = _principled(m)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = palette_img
    tex.interpolation = "Closest"
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m["kind"] = kind
    return m


def mat_texture(name, img, factor_hex, rough, metal):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_backface_culling = True
    nt = m.node_tree
    bsdf = _principled(m)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    uvn = nt.nodes.new("ShaderNodeUVMap")
    uvn.uv_map = "UVMap"
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    if factor_hex:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = factor_hex
        nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m["kind"] = "static"
    return m


def mat_glass():
    m = bpy.data.materials.get("glass")
    if m:
        return m
    m = bpy.data.materials.new("glass")
    bsdf = _principled(m)
    bsdf.inputs["Base Color"].default_value = lin(C["glass_tint"])
    bsdf.inputs["Alpha"].default_value = 0.15
    bsdf.inputs["Roughness"].default_value = 0.05
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = False
    m["kind"] = "glass"
    return m


def mat_emit():
    m = bpy.data.materials.get("lamp_emit")
    if m:
        return m
    m = bpy.data.materials.new("lamp_emit")
    m.use_backface_culling = True
    bsdf = _principled(m)
    bsdf.inputs["Base Color"].default_value = lin(C["lamp_shade"])
    bsdf.inputs["Emission Color"].default_value = lin(C["lamp_shade"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    m["kind"] = "emit"
    return m


class Materiaux:
    """Construit les matériaux d'une variante et donne le matériau de chaque clé."""

    def __init__(self, variant, textures):
        self.variant = variant
        self.textures = textures  # nom -> image Blender (variante B)
        self.palette = Palette()
        self.palette_img = None

    def uv_fixe(self, key, kind):
        """UV constant de la face (case de palette), ou None si la face garde sa projection (texture de matière)."""
        if key == "emit" or key == "glass":
            return (0.5, 0.5)
        if self.variant == "B" and kind != "char" and key in B_SPEC and B_SPEC[key][0]:
            return None
        return self.palette.cell(key)

    def finaliser_palette(self):
        self.palette_img = self.palette.image()

    def get(self, key, kind):
        if key == "glass":
            return mat_glass()
        if key == "emit":
            return mat_emit()
        if kind == "char":
            return mat_palette("char_palette", self.palette_img, rough=0.8, kind="char")
        if self.variant == "A":
            return mat_palette("palette", self.palette_img, rough=0.85)
        spec = B_SPEC.get(key)
        if spec is None:
            return mat_palette("b_palette", self.palette_img, rough=0.75)
        tex, rough, metal, _ = spec
        if tex is None:
            for fam, keys in B_FAMILLE_PALETTE.items():
                if key in keys:
                    if fam == "metal":
                        return mat_palette("b_metal", self.palette_img, rough=0.32, metal=1.0)
                    return mat_palette("b_glaze", self.palette_img, rough=0.12)
            return mat_palette("b_palette", self.palette_img, rough=0.75)
        # matière texturée: la texture est neutre (moyenne connue), teintée par la couleur de la palette,
        # sauf tomettes et faïence dont la texture porte ses vraies couleurs
        img, mean_lin = self.textures[tex]
        if tex in ("tomettes", "faience"):
            return mat_texture(f"b_{key}", img, None, rough, metal)
        target = lin(hex_of(key))
        fac = tuple(min(1.0, target[i] / max(1e-4, mean_lin)) for i in range(3)) + (1.0,)
        return mat_texture(f"b_{key}", img, fac, rough, metal)
