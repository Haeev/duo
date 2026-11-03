"""Planche du retour R01 (0.12.2): les coupes qui descendent sous la tête, vues de trois quarts arrière et de
profil, à l'arrêt (`idle`, image 0) et à mi-pas (`walk`, image 0: contact, bras et buste au plus loin).

Planche « veste »: chemise, veste bleue (le cas de la capture du client), pantalon, bottines, cheveux châtains.
Planche « variantes »: même grille avec, par colonne, le ciré (capuche roulée), un tee-shirt sans par-dessus, la
casquette (variante `_hat`) et le bonnet par-dessus la veste.

Lancer après personnages.py:
    duo-python planche_coupes_longues.py <sortie.png> [veste|variantes] [--blend chemin.blend]
"""
import os
import sys
import tempfile

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import garde_robe as GR  # noqa: E402
import lpl  # noqa: E402
import palette as P  # noqa: E402
import rendus_personnages as RP  # noqa: E402

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
if "--blend" in ARGS:
    RP.BLEND = ARGS[ARGS.index("--blend") + 1]
SORTIE = os.path.abspath(ARGS[0])
QUOI = ARGS[1] if len(ARGS) > 1 and not ARGS[1].startswith("--") else "veste"

CUTS = ["bob", "ponytail", "braid", "pigtails", "wavy", "long", "bob_long"]
HAIR = P.PLAYER_PRESETS["hair_colors"][2]          # châtain, comme la capture du client
VESTE = ("veste", "#4E6F8F", "#2F4A63")
LOOK = dict(top=("chemise", "#EDE6D3", "#C9B48A"), bottom=("pantalon", "#5A5047", "#3E352E"),
            shoes=("bottines", "#5A4636", "#2E2622"))
# colonnes: (titre, clip, image, azimut, élévation, pièces en plus, chapeau)
VIEWS_34, VIEWS_PROFIL = (215, 24), (90, 6)
if QUOI == "veste":
    COLS = [("arrêt, 3/4 arrière", "idle", 0, VIEWS_34, dict(outer=VESTE)),
            ("arrêt, profil", "idle", 0, VIEWS_PROFIL, dict(outer=VESTE)),
            ("mi-pas, 3/4 arrière", "walk", 0, VIEWS_34, dict(outer=VESTE)),
            ("mi-pas, profil", "walk", 0, VIEWS_PROFIL, dict(outer=VESTE))]
else:
    COLS = [("ciré, mi-pas, 3/4 arrière", "walk", 0, VIEWS_34, dict(outer=("cire", "#E8B93A", "#2F3A52"))),
            ("tee-shirt, arrêt, profil", "idle", 0, VIEWS_PROFIL,
             dict(top=("tshirt", "#E787B1", "#F4E6EC"))),
            ("casquette, mi-pas, 3/4 arrière", "walk", 0, VIEWS_34,
             dict(outer=VESTE, hat=("casquette", "#2F3F5C", "#C8A150"))),
            ("bonnet, arrêt, profil", "idle", 0, VIEWS_PROFIL,
             dict(outer=VESTE, hat=("bonnet", "#8D3F3A", "#EDE6D3")))]


def material(base_mat, key, look):
    """Copie du matériau: cheveux châtains dans la rangée 0, couleurs des pièces portées dans la rangée 1."""
    from PIL import Image
    img = Image.open(os.path.join(lpl.TEX_SRC, "personnages.png")).convert("RGB")

    def put(col, row, hx):
        rgb = P.hex_to_rgb(hx)
        for dx in range(P.CELL):
            for dy in range(P.CELL):
                img.putpixel((col * P.CELL + dx, row * P.CELL + dy), rgb)
    put(P.CHAR_SLOTS.index("hair"), 0, HAIR["hair"])
    put(P.CHAR_SLOTS.index("hair_dark"), 0, HAIR["hair_dark"])
    put(P.CHAR_SLOTS.index("scarf"), 0, P.PLAYER_PRESETS["scarves"]["orb"])
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
    path = os.path.join(tempfile.gettempdir(), f"lpl_coupes_longues_{key}.png")
    img.save(path)
    mat = base_mat.copy()
    mat.name = "coupes_longues_" + key
    tex = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"][0]
    tex.image = bpy.data.images.load(path, check_existing=False)
    return mat


def main():
    from PIL import Image, ImageDraw, ImageFont
    RP.base_scene()
    # sources du .blend (vêtements, accessoires de la 0.13 posés à l'origine): toutes cachées, seules les copies
    # du personnage se rendent
    for ob in bpy.data.objects:
        if not ob.name.startswith(("sol_rendu", "soleil")):
            ob.hide_render = True
    sc = bpy.context.scene
    lpl.setup_render((380, 470), samples=8)
    base_mat = bpy.data.materials["lpl_characters"]
    cells = {}
    for ci, (title, clip, frame, (az, el), extra) in enumerate(COLS):
        look = dict(LOOK, **extra)
        mat = material(base_mat, str(ci), look)
        for cut in CUTS:
            hat = look.get("hat")
            parts = ["player_base", "player_hair_" + cut + ("_hat" if hat else ""),
                     "player_badge_orb" + ("_outer" if look.get("outer") else "")]
            parts += [f"wear_{s}_{look[s][0]}" for s in ("top", "bottom", "shoes", "outer", "hat") if look.get(s)]
            objs = RP.clone_character(parts, (0, 0, 0), mat=mat)
            act = bpy.data.actions[clip]
            ad = objs[0].animation_data_create()
            ad.action = act
            ad.action_slot = act.slots[0]
            sc.frame_set(frame)
            for o in list(bpy.data.objects):
                if o.type == "CAMERA":
                    bpy.data.objects.remove(o, do_unlink=True)
            # cadre: du milieu des cuisses au-dessus de la tête, de près
            lpl.iso_camera(target=(0, 0, 1.3), ortho=1.05, azimuth=az, elevation=el)
            f = os.path.join(tempfile.gettempdir(), f"coupes_longues_{QUOI}_{ci}_{cut}.png")
            lpl.render(f)
            cells[(ci, cut)] = f
            for o in objs:
                bpy.data.objects.remove(o, do_unlink=True)
    ttf = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(ttf, 17) if os.path.exists(ttf) else ImageFont.load_default()
    w, h, left, top = 380, 470, 120, 64
    sheet = Image.new("RGB", (left + w * len(COLS), top + h * len(CUTS)), (245, 243, 238))
    d = ImageDraw.Draw(sheet)
    d.text((8, 8), "0.12.2, retour R01: coupes longues (" + QUOI + "), cheveux châtains", fill=(20, 20, 20),
           font=font)
    for ci, col in enumerate(COLS):
        d.text((left + ci * w + 8, 36), col[0], fill=(20, 20, 20), font=font)
    for ri, cut in enumerate(CUTS):
        d.text((8, top + ri * h + h // 2), cut, fill=(20, 20, 20), font=font)
        for ci in range(len(COLS)):
            sheet.paste(Image.open(cells[(ci, cut)]).convert("RGB"), (left + ci * w, top + ri * h))
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    sheet.save(SORTIE)
    print("PLANCHE", SORTIE)


main()
