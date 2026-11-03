"""Tenues de contrôle des planches de la garde-robe (planche_beaute.py, planche_beaute2.py): pièces portées,
couleurs écrites dans la rangée 1 d'une copie de `personnages.png`, comme le fera le rendu."""
import os
import tempfile

import bpy  # noqa: I001

import garde_robe as GR
import lpl
import palette as P

# tenues de la planche: pièces portées, couleurs (principale, secondaire[, motif]) et symbole du profil
LOOKS = {
    "a": dict(top=("chemise", "#5C7FA6", "#EDE6D3"), bottom=("pantalon", "#4A5D78", "#6B4A33"),
              shoes=("bottines", "#5A4636", "#2E2622"), hair="short", sym="orb"),
    "b": dict(top=("pull", "#B5663F", "#E9DCC0", "#9A5233"), bottom=("jupe", "#6B5541", "#3E2F25"),
              shoes=("espadrilles", "#C9B48A", "#8C6A48"), hair="bob", sym="star"),
    "c": dict(bottom=("salopette", "#5E6A55", "#F1EBDB", "#C8A150"), shoes=("baskets", "#D9D2C2", "#F4F0E6"),
              hair="bun", sym="comet", hat=("paille", "#E3C77E", "#9C4F67")),
    "d": dict(top=("mariniere", "#F2EDE1", "#2F4A78"), bottom=("pantacourt", "#C9B79A", "#8C7A60"),
              shoes=("sabots", "#B98A55", "#7A5A38"), hair="curls", beard="beard_short", sym="sun",
              outer=("gilet", "#D4A746", "#8C6A48")),
    "e": dict(top=("tshirt", "#E787B1", "#F4E6EC"), bottom=("short", "#3D4B52", "#2B3439"),
              shoes=("bottes", "#2F6F5E", "#1E3D35"), hair="ponytail", sym="planet",
              outer=("cire", "#E8B93A", "#2F3A52"), hat=("bonnet", "#8D3F3A", "#EDE6D3")),
    "f": dict(top=("debardeur", "#F1E7D2", "#C2563F"), bottom=("pantalon", "#3E4A5C", "#8C6A48"),
              shoes=("baskets", "#C2453B", "#F4F0E6"), hair="crop", sym="crescent",
              outer=("veste", "#3F6F6A", "#2B4A47"), hat=("casquette", "#2F3F5C", "#C8A150")),
}
SYM_COLORS = P.PLAYER_PRESETS["scarves"]

def parts_of(look):
    hat = look.get("hat")
    parts = ["player_base", "player_hair_" + look["hair"] + ("_hat" if hat else ""), "player_badge_" + look["sym"]
             + ("_outer" if look.get("outer") else "")]
    for slot in ("top", "bottom", "shoes", "outer", "hat"):
        if look.get(slot):
            parts.append(f"wear_{slot}_{look[slot][0]}")
    if look.get("beard"):
        parts.append("player_" + look["beard"])
    return parts


def look_material(base_mat, key, look):
    from PIL import Image
    img = Image.open(os.path.join(lpl.TEX_SRC, "personnages.png")).convert("RGB")

    def put(col, row, hx):
        rgb = P.hex_to_rgb(hx)
        for dx in range(P.CELL):
            for dy in range(P.CELL):
                img.putpixel((col * P.CELL + dx, row * P.CELL + dy), rgb)
    put(P.CHAR_SLOTS.index("scarf"), 0, SYM_COLORS[look["sym"]])
    for slot in ("top", "bottom", "shoes", "outer", "hat"):
        it = look.get(slot)
        if not it:
            continue
        cols = list(it[1:]) + [it[2]] * (3 - len(it[1:]))
        for suffix, hx in zip("psm", cols):
            if f"{slot}_{suffix}" in GR.WEAR_SLOTS:
                put(GR.WEAR_SLOTS.index(f"{slot}_{suffix}"), GR.WEAR_ROW, hx)
    for name, hx in GR.WEAR_FIXED.items():
        put(GR.WEAR_SLOTS.index(name), GR.WEAR_ROW, hx)
    path = os.path.join(tempfile.gettempdir(), f"lpl_garde_robe_{key}.png")
    img.save(path)
    mat = base_mat.copy()
    mat.name = "garde_robe_" + key
    tex = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"][0]
    tex.image = bpy.data.images.load(path, check_existing=False)
    return mat
