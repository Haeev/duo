"""Planches de la garde-robe de la 0.12 (avant et après, pièces, coupes sous chapeau, clips).

Lancer: duo-python planche_beaute.py <dossier des GLB d'avant> <dossier de sortie des images>
Variable LPL_MODE: tenues, pieces, coupes, clips ou tout (défaut). Assemblage: planche_beaute.sh.
Les GLB d'avant se récupèrent dans Git (`git show <commit>:games/la-petite-ligne/assets/modeles/personnages.glb`).
Caméra du jeu (azimut 45, élévation 35,264), Cycles sur CPU. Les couleurs des vêtements sont écrites dans la rangée
1 d'une copie de `personnages.png` (comme le fera le rendu), le profil dans `scarf` et `scarf_mark` de la rangée 0.
"""
import math
import os
import sys
import tempfile

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import coiffures  # noqa: E402
import garde_robe as GR  # noqa: E402
import lpl  # noqa: E402
import palette as P  # noqa: E402
from planche_arrondi import AVANT, APRES, SORTIE, load, mannequin, pose  # noqa: E402
from planche_arrondi import shot as _shot  # noqa: E402

SCALE = float(os.environ.get("LPL_ECHELLE", "1"))


def shot(name, target, ortho, res):
    """Rendu d'une vue; LPL_ECHELLE réduit la taille des images (machine chargée)."""
    _shot(name, target, ortho, (int(res[0] * SCALE), int(res[1] * SCALE)))

OLD = {
    "a": ["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"],
    "b": ["player_base", "player_outfit_smock", "player_hair_bob", "player_scarf_star"],
    "c": ["player_base", "player_outfit_overalls", "player_hair_bun", "player_scarf_comet"],
    "d": ["player_base", "player_outfit_work", "player_hair_curls", "player_scarf_sun", "player_beard_short"],
    "e": ["player_base", "player_outfit_smock", "player_hair_ponytail", "player_scarf_planet"],
}
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
CLIPS = [("walk", (4, 12)), ("hoe", (11, 16)), ("chop", (17,)), ("harvest", (9,)), ("sit", (1,)),
         ("carry_two", (6,)), ("sit_ground", (1,)), ("sleep", (1,)), ("climb_ladder", (1,)), ("fish_cast", (10,)),
         ("pet", (1,))]


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


def show_parts(rig, tag, parts, mat=None):
    rig.hide_render = False
    for c in rig.children:
        on = c.name[len(tag):] in parts
        c.hide_render = not on
        if on and mat is not None and c.type == "MESH":
            c.data.materials[0] = mat


def hide_set(objs):
    for o in objs:
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True


def place_prop(ob, az):
    ob.parent = None
    ob.rotation_mode = "XYZ"
    ob.location = (0, 0, 0)
    ob.rotation_euler = (0, 0, math.radians(az))
    ob.hide_render = False
    for c in ob.children_recursive:
        c.hide_render = False


def main():
    mode = os.environ.get("LPL_MODE", "tout")
    os.makedirs(SORTIE, exist_ok=True)
    lpl.reset()
    lpl.setup_render((420, 600), int(os.environ.get("LPL_SAMPLES", "10")))
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(400, lpl.hex_lin("#A7B98A"), z=-0.002)
    old = load(os.path.join(AVANT, "personnages.glb"), "A_", sorted({n for v in OLD.values() for n in v}))
    names = set()
    for lk in LOOKS.values():
        names.update(parts_of(lk))
    names.update(f"wear_{s}_{st}" for s, sts in GR.STYLES.items() for st in sts)
    names.update(f"player_hair_{h}{x}" for h in ["short", "bob", "bun"] + coiffures.NEW_CUTS for x in ("", "_hat"))
    new = load(os.path.join(APRES, "personnages.glb"), "B_", sorted(names))
    for r in (old, new):
        r["rig"].location = (0, 0, 0)
        r["rig"].rotation_mode = "XYZ"
    tools = load(os.path.join(APRES, "maison.glb"), "M_", ["chair", "double_bed"])
    tools.update(load(os.path.join(APRES, "faune.glb"), "F_", ["ladder_wood"]))
    hide_set(tools.values())
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF") and not m.name.startswith("mannequin"):
            lpl.set_emission(m, 0.0)
    for o in list(bpy.data.objects):
        if o.type == "MESH" and o.parent is None and o.name.endswith("Icosphere"):
            bpy.data.objects.remove(o, do_unlink=True)
    base_mat = [c for c in new["rig"].children if c.type == "MESH"][0].data.materials[0]
    mats = {k: look_material(base_mat, k, lk) for k, lk in LOOKS.items()}
    man = mannequin((0.75, 0.0))
    oldrig, rig = old["rig"], new["rig"]
    if mode in ("tenues", "tout") or "tenues" in mode:
        hide_set([rig])
        for k, parts in OLD.items():
            if k not in os.environ.get("LPL_TENUES", "abcdef"):
                continue
            show_parts(oldrig, "A_", parts)
            oldrig.rotation_euler = (0, 0, math.radians(20))
            pose(oldrig, "A_", "idle", 1)
            shot(f"tenue_{k}_a", (0, 0, 0.9), 2.3, (420, 600))
        hide_set([oldrig])
        for k, lk in LOOKS.items():
            if k not in os.environ.get("LPL_TENUES", "abcdef"):
                continue
            show_parts(rig, "B_", parts_of(lk), mats[k])
            for az, tag in ((20, "b"), (200, "dos")):
                rig.rotation_euler = (0, 0, math.radians(az))
                pose(rig, "B_", "idle", 1)
                shot(f"tenue_{k}_{tag}", (0, 0, 0.9), 2.3, (420, 600))
            rig.rotation_euler = (0, 0, math.radians(45))
            shot(f"buste_{k}", (0, 0, 1.38), 0.95, (360, 360))
    hide_set([oldrig])
    man.hide_render = True
    if mode in ("pieces", "tout") or "pieces" in mode:
        # chaque pièce sur le corps nu-neutre, aux couleurs de la tenue qui la porte (ou de la tenue a)
        for slot, styles in GR.STYLES.items():
            for st in styles:
                k = next((k for k, lk in LOOKS.items() if lk.get(slot) and lk[slot][0] == st), "a")
                parts = ["player_base", f"wear_{slot}_{st}"]
                if slot == "hat":
                    parts.append("player_hair_" + LOOKS[k]["hair"] + "_hat")
                show_parts(rig, "B_", parts, mats[k])
                rig.rotation_euler = (0, 0, math.radians(30))
                pose(rig, "B_", "idle", 1)
                if slot == "shoes":
                    shot(f"piece_{slot}_{st}", (0, 0, 0.22), 0.75, (300, 300))
                elif slot == "hat":
                    shot(f"piece_{slot}_{st}", (0, 0, 1.58), 0.75, (300, 300))
                else:
                    shot(f"piece_{slot}_{st}", (0, 0, 0.95), 2.0, (300, 300))
        show_parts(rig, "B_", ["player_base"], mats["a"])
        shot("piece_corps_base", (0, 0, 0.95), 2.0, (300, 300))
    if mode in ("coupes", "tout") or "coupes" in mode:
        hats = ["casquette", "paille", "bonnet"]
        for i, h in enumerate(["short", "bob", "bun"] + coiffures.NEW_CUTS):
            hat = hats[i % 3]
            k = ("f", "c", "e")[i % 3]
            for with_hat in (False, True):
                parts = ["player_base", "wear_top_tshirt", "player_hair_" + h + ("_hat" if with_hat else "")]
                if with_hat:
                    parts.append(f"wear_hat_{hat}")
                show_parts(rig, "B_", parts, mats[k])
                for az, tag in ((30, "av"),):
                    rig.rotation_euler = (0, 0, math.radians(az))
                    pose(rig, "B_", "idle", 1)
                    shot(f"coupe_{h}_{'chapeau' if with_hat else 'nu'}_{tag}", (0, 0, 1.55), 0.75, (260, 260))
    if mode in ("clips", "tout") or "clips" in mode:
        for k in os.environ.get("LPL_LOOKS", "e"):
            show_parts(rig, "B_", parts_of(LOOKS[k]), mats[k])
            rig.rotation_euler = (0, 0, math.radians(-60))
            for clip, frames in CLIPS:
                prop = {"sit": "chair", "sleep": "double_bed", "climb_ladder": "ladder_wood"}.get(clip)
                if prop:
                    place_prop(tools[prop], -60)
                for f in frames:
                    pose(rig, "B_", clip, f)
                    shot(f"clip_{k}_{clip}_{f:03d}", (0, 0, 0.85), 2.4, (260, 340))
                if prop:
                    hide_set([tools[prop]])


main()
