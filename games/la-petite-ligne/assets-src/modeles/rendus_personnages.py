"""Planches de contrôle des personnages (Cycles sur CPU).

Lancer après personnages.py (et ferme.py pour les outils tenus en main):
    duo-python rendus_personnages.py [alignement|expressions|poses|tout]
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import palette as P  # noqa: E402

BLEND = os.path.join(lpl.HERE, "blend", "personnages.blend")
PREVIEW_ROWS = {
    # rangées supplémentaires pour montrer des choix de création (aperçu seulement)
    "player_c": dict(P.CHAR_ROWS["player_a"], **P.PLAYER_PRESETS["outfits"]["sauge"],
                     skin="#D29E78", skin_shade="#B98260", hair="#C9A267", hair_dark="#9C7B48", scarf="#FC663F"),
    "player_d": dict(P.CHAR_ROWS["player_a"], **P.PLAYER_PRESETS["outfits"]["moutarde"],
                     skin="#8E5C3E", skin_shade="#744A31", hair="#2E2622", hair_dark="#1E1916", scarf="#22B07D"),
}


def preview_material(base_mat, row_name):
    """Copie du matériau qui lit une autre rangée de la texture (aperçu des joueurs)."""
    from PIL import Image
    src = os.path.join(lpl.TEX_SRC, "personnages.png")
    img = Image.open(src).convert("RGB")
    rows = list(P.CHAR_ROW_ORDER) + list(PREVIEW_ROWS)
    for i, rn in enumerate(PREVIEW_ROWS):
        r = len(P.CHAR_ROW_ORDER) + i
        for c, slot in enumerate(P.CHAR_SLOTS):
            rgb = P.hex_to_rgb(PREVIEW_ROWS[rn][slot])
            for dx in range(P.CELL):
                for dy in range(P.CELL):
                    img.putpixel((c * P.CELL + dx, r * P.CELL + dy), rgb)
    import tempfile
    tmp = os.path.join(tempfile.gettempdir(), "lpl_apercu_personnages.png")
    img.save(tmp)
    mat = base_mat.copy()
    mat.name = "apercu_" + row_name
    nt = mat.node_tree
    tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    tex.image = bpy.data.images.load(tmp, check_existing=True)
    r = rows.index(row_name)
    if r:
        uv = nt.nodes.new("ShaderNodeUVMap")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (0, -r / P.CHAR_GRID_H, 0)
        nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    return mat


def clone_character(parts, loc, rot_z=0.0, mat=None, expr=None, scale=1.0):
    rig = bpy.data.objects["rig"]
    r2 = rig.copy()
    r2.animation_data_clear()
    bpy.context.scene.collection.objects.link(r2)
    r2.location = loc
    r2.rotation_euler = (0, 0, math.radians(rot_z))
    r2.scale = (scale,) * 3
    r2.hide_render = False
    out = [r2]
    for p in parts:
        src = bpy.data.objects[p]
        o = src.copy()
        o.data = src.data.copy()
        bpy.context.scene.collection.objects.link(o)
        o.parent = r2
        o.modifiers["rig"].object = r2
        o.hide_render = False
        if mat:
            o.data.materials[0] = mat
        if expr and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 1.0 if kb.name == expr else 0.0
        out.append(o)
    return out


def hide_sources():
    for ob in list(bpy.data.objects):
        if ob.name == "rig" or ob.name.startswith(("player_", "villager_", "socket_", "rail_crew_")):
            ob.hide_render = True


def base_scene():
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    hide_sources()
    lpl.setup_render((1600, 900), samples=24)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((52, 0, 140), 3.0)
    lpl.ground_plane(60, lpl.hex_lin("#9DB27A"))
    bpy.context.scene.frame_set(0)


CAST = [
    (["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"], "player_a", "joueur A"),
    (["player_base", "player_outfit_smock", "player_hair_bun", "player_scarf_crescent"], "player_b", "joueur B"),
    (["player_base", "player_outfit_overalls", "player_hair_bob", "player_scarf_sun"], "player_c", "joueur C"),
    (["player_base", "player_outfit_work", "player_hair_bob", "player_scarf_comet"], "player_d", "joueur D"),
    (["villager_firmin"], None, "Firmin"),
    (["villager_odette"], None, "Odette"),
    (["villager_basile"], None, "Basile"),
    (["villager_lucie"], None, "Lucie"),
    (["villager_jeanne"], None, "Jeanne (0,75)"),
]


def lineup():
    base_scene()
    base_mat = bpy.data.materials["lpl_characters"]
    n = len(CAST)
    sp = 0.9
    for i, (parts, row, lab) in enumerate(CAST):
        x = (i - (n - 1) / 2) * sp
        mat = preview_material(base_mat, row) if row else None
        sc = 0.75 if "jeanne" in parts[0] else 1.0
        clone_character(parts, (x, 0, 0), 0, mat, scale=sc)
        lpl.label(lab, (x, -0.5, 0.02), size=0.12, rot=(90, 0, 0))
    # mannequin de 1,80 m
    g = lpl.Geo(lpl.world_cells())
    g.box((0.3, 0.05, 1.8), loc=(0, 0, 0), color="paper_dark", base=True)
    for h in range(1, 18):
        g.box((0.34 if h % 5 == 0 else 0.32, 0.055, 0.008), loc=(0, 0, h * 0.1), color="shadow")
    mat = lpl.palette_material("tmp_pal", os.path.join(lpl.TEX_SRC, "palette.png"))
    ob = g.to_object("mannequin_180", mat)
    ob.location = ((n + 1) / 2 * sp, 0.0, 0)
    lpl.label("1,80 m", (ob.location.x, -0.5, 0.02), size=0.12, rot=(90, 0, 0))
    cam = lpl.persp_camera((0, -9.5, 1.6), (0, 0, 0.85), lens=40)
    lpl.render(os.path.join(lpl.BOARDS, "personnages-alignement.png"))
    # vue isométrique, de dos et de trois quarts
    cam.location = Vector((7.5, -7.5, 6.2))
    lpl.iso_camera((0, 0, 0.8), ortho=9.5, azimuth=45, elevation=30)
    lpl.render(os.path.join(lpl.BOARDS, "personnages-iso.png"))
    lpl.iso_camera((0, 0, 0.8), ortho=9.5, azimuth=225, elevation=30)
    lpl.render(os.path.join(lpl.BOARDS, "personnages-iso-dos.png"))


def expressions():
    base_scene()
    bpy.context.scene.render.resolution_x, bpy.context.scene.render.resolution_y = (1600, 820)
    exprs = ["neutral", "happy", "delighted", "tired", "hungry", "blink"]
    rows = [(["player_base", "player_hair_short", "player_outfit_work", "player_scarf_star"], "joueur"),
            (["villager_odette"], "Odette"), (["villager_basile"], "Basile"), (["villager_firmin"], "Firmin")]
    for j, (parts, lab) in enumerate(rows):
        gx, gz = (j % 2) * 2.95, -(j // 2) * 1.85
        for i, e in enumerate(exprs):
            clone_character(parts, (gx + i * 0.42, 0, gz), 0, None, expr=e)
            lpl.label(e, (gx + i * 0.42, -0.3, gz + 1.79), size=0.05, rot=(90, 0, 0))
        lpl.label(lab, (gx + 1.05, -0.3, gz + 1.88), size=0.07, rot=(90, 0, 0))
    for ob in bpy.data.objects:
        if ob.name == "sol_rendu":
            ob.hide_render = True
    cam = lpl.persp_camera((2.6, -12, 0.75), (2.6, 0, 0.75), lens=50)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 6.0
    lpl.render(os.path.join(lpl.BOARDS, "personnages-expressions.png"))


TOOLS = {"hoe": "hoe", "water": "watering_can", "chop": "axe", "saw": "saw", "hammer": "hammer",
         "sow": "seed_packet_radish", "eat": "bread", "sit_eat": "dish_soup", "harvest": "radish",
         "give": "egg", "talk": None, "pet": None, "fish_wait": "fishing_rod", "fish_cast": "fishing_rod",
         "fish_strike": "fishing_rod", "pole_raise": "lamp_pole", "pole_lower": "lamp_pole"}
POSE_FRAMES = {"idle": 30, "walk": 0, "carry_two": 6, "hoe": 16, "sow": 12, "water": 20, "harvest": 15,
               "chop": 12, "saw": 9, "hammer": 0, "talk": 15, "give": 15, "sit": 0, "eat": 12, "sit_eat": 12,
               "sleep": 0, "wave": 8, "pet": 0, "high_five": 10, "fish_wait": 0, "fish_cast": 10,
               "fish_strike": 5, "sit_ground": 0}
# planche de la pêche et de l'absence: plusieurs images par animation
PECHE = [("fish_wait", 0), ("fish_cast", 10), ("fish_cast", 14), ("fish_cast", 18), ("fish_strike", 5),
         ("fish_strike", 21), ("sit_ground", 0), ("sit_ground", 45)]


# tour 9: clips des moments (étoiles, salut du mécanicien, lanternes), plusieurs images par clip
TOUR9 = [("sit_edge", 0), ("sit_edge", 30), ("look_up", 45), ("crank_hold", 0), ("crank_turn", 0),
         ("crank_turn", 15), ("wave_back", 0), ("wave_back", 9), ("pole_raise", 0), ("pole_raise", 18),
         ("pole_lower", 15)]


def poses(liste=None, sortie="personnages-poses.png", cols=7, dossier=None, cam=None):
    """Une vignette par animation (image clé caractéristique), outil en main, assemblées en planche."""
    from PIL import Image, ImageDraw, ImageFont
    base_scene()
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = (420, 460)
    sc.cycles.samples = 16
    tools = {}
    for path in (os.path.join(lpl.OUT, "ferme.glb"), os.path.join(lpl.OUT, "maison.glb")):
        if not os.path.exists(path):
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=path)
        for ob in set(bpy.data.objects) - before:
            ob.hide_render = True
            tools[ob.name] = ob
    if liste is None:
        liste = list(POSE_FRAMES.items())
    acts = [(bpy.data.actions[n], f) for n, f in liste]
    parts = ["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"]
    objs = clone_character(parts, (0, 0, 0), 0)
    r2 = objs[0]
    ad = r2.animation_data_create()
    sock = bpy.data.objects["socket_hand_r"]
    if cam:
        lpl.persp_camera(*cam)
    else:
        lpl.persp_camera((2.3, -3.3, 1.75), (0, 0, 0.82), lens=34)
    tiles = []
    for act, frame in acts:
        held = []
        tname = TOOLS.get(act.name)
        if act.name == "carry_two":
            tname = "beam"
        if tname and tname in tools:
            t = tools[tname].copy()
            bpy.context.scene.collection.objects.link(t)
            t.hide_render = False
            t.parent = r2
            t.rotation_mode = sock.rotation_mode
            if tname == "beam":
                t.location = (0, 0, 1.78)
                t.rotation_euler = (0, 0, 0)
                t.scale = (1, 0.4, 1)
            else:
                t.parent_type = "BONE"
                t.parent_bone = "hand_r"
                t.matrix_parent_inverse.identity()
                t.location = sock.location
                t.rotation_euler = sock.rotation_euler
                t.rotation_quaternion = sock.rotation_quaternion
                t.scale = (1, 1, 1)
            held.append(t)
        ad.action = act
        ad.action_slot = act.slots[0]
        sc.frame_set(frame)
        out = os.path.join(lpl.BOARDS, f"_pose_{act.name}_{frame}.png")
        lpl.render(out)
        tiles.append((act.name if liste is None or len({n for n, _ in liste}) == len(liste) else f"{act.name} {frame}", out))
        for t in held:
            bpy.data.objects.remove(t, do_unlink=True)
    tw, th = 420, 460
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, rows * th), (230, 236, 240))
    dr = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.load_default(size=26)
    except TypeError:
        font = ImageFont.load_default()
    for k, (name, path) in enumerate(tiles):
        im = Image.open(path).convert("RGB")
        x, y = (k % cols) * tw, (k // cols) * th
        sheet.paste(im, (x, y))
        dr.text((x + 12, y + 10), name, fill=(30, 30, 36), font=font)
        os.remove(path)
    sheet.save(os.path.join(dossier or lpl.BOARDS, sortie))


def equipage(dossier):
    """Mécanicien et chauffeur (bustes) penchés et saluant, Firmin avec son écharpe, un joueur de 1,74 m."""
    base_scene()
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = (1800, 900)
    cast = [(["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"], None, "joueur 1,74 m"),
            (["villager_firmin", "villager_firmin_scarf"], None, "Firmin et son écharpe"),
            (["rail_crew_driver"], "driver_lean", "mécanicien (driver_lean)"),
            (["rail_crew_driver"], "driver_wave", "mécanicien (driver_wave)"),
            (["rail_crew_stoker"], "driver_lean", "chauffeur (driver_lean)")]
    for i, (parts, clip, lab) in enumerate(cast):
        x = (i - 2) * 0.95
        objs = clone_character(parts, (x, 0, 0), 0)
        if clip:
            act = bpy.data.actions[clip]
            ad = objs[0].animation_data_create()
            ad.action = act
            ad.action_slot = act.slots[0]
        lpl.label(lab, (x, -0.55, 0.02), size=0.07, rot=(90, 0, 0))
    sc.frame_set(8)
    lpl.persp_camera((1.2, -6.5, 1.6), (0, 0, 1.0), lens=40)
    lpl.render(os.path.join(dossier, "modeles-equipage.png"))


if __name__ == "__main__":
    what = sys.argv[-1] if len(sys.argv) > 1 else "tout"
    if what in ("alignement", "tout"):
        lineup()
    if what in ("expressions", "tout"):
        expressions()
    if what in ("poses", "tout"):
        poses()
    if what in ("peche", "tout"):
        poses(PECHE, "personnages-peche.png", cols=4)
    if what == "equipage":
        # duo-python rendus_personnages.py <dossier> equipage: bustes de l'équipage, écharpe de Firmin, joueur
        dossier = os.path.abspath(sys.argv[-2])
        equipage(dossier)
    if what == "tour9":
        # duo-python rendus_personnages.py <dossier> tour9: clips du tour 9, perche en main, vue de côté
        dossier = os.path.abspath(sys.argv[-2])
        poses(TOUR9, "modeles-clips-joueurs.png", cols=6, dossier=dossier,
              cam=((4.2, -0.5, 1.5), (0, -0.4, 1.3), 34))
