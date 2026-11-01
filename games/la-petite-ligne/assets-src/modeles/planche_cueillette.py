"""Planches de contrôle de la cueillette et de la lisière (tour 8), rendues depuis les GLB exportés (Cycles).

Lancer: duo-python planche_cueillette.py <dossier de sortie> [echelle|zoom1|sol|tout]
- echelle: les modèles du tour 8 à côté d'un joueur de 1,74 m, mûres posées sur le roncier (berry_spots),
  noisettes au pied du noisetier, girolles au pied du chêne (objets-echelle.png);
- zoom1: lisibilité au zoom de départ du jeu (24 m sur 1366 px, 57 px/m), chaque objet sur l'herbe et avec la
  palette de sa saison, en couleur et en niveaux de gris, agrandi x 4 au plus proche (objets-zoom1.png);
- sol: chaque objet posé au sol vu de près en vue rasante, et les mûres sur le roncier, pour vérifier que rien ne
  flotte ni ne traverse le sol (objets-sol.png).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import palette as P  # noqa: E402

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else lpl.BOARDS
WHAT = sys.argv[2] if len(sys.argv) > 2 else "tout"

ITEMS = ("wild_garlic", "chanterelle", "blackberry", "hazelnut")
DECOR = ("bramble", "bush_hazel", "oak_sapling", "fir_sapling", "tree_stump")
# saison où chaque objet se cueille (section 2.2 de tour-08-conception.md): palette et herbe de cette saison
SEASON = {"wild_garlic": None, "dandelion": None, "chanterelle": "ete", "blackberry": "ete", "hazelnut": "automne"}
SEASON_NAME = {None: "printemps", "ete": "été", "automne": "automne"}


def font(size):
    from PIL import ImageFont
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default(size)


def scene():
    lpl.reset()
    for f in ("ferme.glb", "bourg.glb"):
        bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, f))
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    for o in bpy.data.objects:
        o.rotation_mode = "XYZ"


def load_player():
    """Joueur de 1,74 m (personnages.glb) en pose de repos, pièces de la tenue de travail."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "personnages.glb"))
    new = set(bpy.data.objects) - before
    rig = next(o for o in new if o.type == "ARMATURE")
    keep_parts = {"player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"}
    for o in new:
        if o.type == "MESH" and o.name not in keep_parts:
            bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    if rig.animation_data:
        rig.animation_data.action = None
        for tr in list(rig.animation_data.nla_tracks):
            rig.animation_data.nla_tracks.remove(tr)
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    rig.rotation_mode = "XYZ"
    return rig


def copy_of(name, loc, yaw=0.0):
    """Copie d'un nœud racine (et de ses enfants), posée à loc (Blender) avec un lacet en degrés."""
    src = bpy.data.objects[name]
    d = lpl.duplicate_tree(src)
    d.rotation_mode = "XYZ"
    d.location = loc
    d.rotation_euler = (0, 0, math.radians(yaw))
    for o in (d, *d.children_recursive):
        o.hide_render = False
    return d


def hide_sources():
    for o in bpy.data.objects:
        if o.type in ("MESH", "EMPTY", "ARMATURE"):
            o.hide_render = True


def clear_lights():
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)


def remove(objs):
    for d in objs:
        for o in [*d.children_recursive, d]:
            bpy.data.objects.remove(o, do_unlink=True)


def spots_world(br):
    """Points berry_spots du roncier (repère glTF du nœud: x, y haut, z avant) en coordonnées monde Blender."""
    out = []
    for (x, y, z) in br["berry_spots"]:
        out.append(br.matrix_world @ Vector((x, -z, y)))
    return out


def set_season(season):
    """Remplace l'image de la palette (couleur de base) par celle de la saison, comme le jeu (material.map)."""
    name = "palette.png" if season is None else f"palette-{season}.png"
    img = bpy.data.images.load(os.path.join(lpl.TEX_OUT, name), check_existing=True)
    for m in bpy.data.materials:
        if not m.name.startswith("lpl_palette") or not m.node_tree:
            continue
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        link = bsdf.inputs["Base Color"].links
        if link and link[0].from_node.type == "TEX_IMAGE":
            link[0].from_node.image = img


def grass_lin(season):
    hx = dict((w[0], w[1]) for w in P.WORLD)["grass"]
    if season:
        hx = P.SEASONS[season].get("grass", hx)
    return lpl.hex_lin(hx)


# Échelle ------------------------------------------------------------------------------------------

def board_scale():
    scene()
    rig = load_player()
    hide_sources()
    for o in (rig, *rig.children_recursive):
        o.hide_render = False
    rig.location = (-1.6, 0.3, 0)
    rig.rotation_euler = (0, 0, math.radians(-20))
    placed = []
    br = copy_of("bramble", (0.0, 0.4, 0))
    placed.append(br)
    bpy.context.view_layer.update()
    for i, p in enumerate(spots_world(br)):
        placed.append(copy_of("blackberry", p, yaw=40 * i))
    placed.append(copy_of("bush_hazel", (1.9, 0.6, 0)))
    placed.append(copy_of("hazelnut", (1.75, -0.35, 0)))
    placed.append(copy_of("oak_sapling", (3.4, 0.5, 0)))
    placed.append(copy_of("chanterelle", (3.35, -0.25, 0), yaw=30))
    placed.append(copy_of("fir_sapling", (4.8, 0.5, 0)))
    placed.append(copy_of("tree_stump", (6.1, 0.5, 0)))
    placed.append(copy_of("wild_garlic", (5.0, -0.45, 0)))
    placed.append(copy_of("dandelion", (6.0, -0.45, 0)))
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    gp = lpl.ground_plane(80, lpl.hex_lin("#A7B98A"), z=0.0)
    lpl.setup_render((2000, 900), 24)
    lpl.persp_camera((2.25, -12.5, 2.8), (2.25, 0, 0.7), lens=40)
    for x in range(-2, 7):
        lpl.label(f"{x} m", (x, -1.3, 0.005), size=0.16, rot=(30, 0, 0))
    for (txt, x, y) in (("joueur 1,74 m", -1.6, -0.75), ("roncier et mûres", 0.0, -0.75), ("noisetier, noisettes", 1.8, -0.9),
                        ("rejet du chêne, girolles", 3.4, -0.9), ("jeune sapin, ail des ours", 4.9, -0.95),
                        ("souche, pissenlit", 6.05, -0.95)):
        lpl.label(txt, (x, y, 0.005), size=0.13, rot=(30, 0, 0))
    path = os.path.join(OUT, "objets-echelle.png")
    lpl.render(path)
    remove(placed)
    bpy.data.objects.remove(gp, do_unlink=True)
    print("PLANCHE", path)


# Lisibilité au zoom 1 -------------------------------------------------------------------------------

def board_zoom1():
    """Chaque objet seul (et les mûres sur le roncier, les noisettes au pied du noisetier) au zoom de départ:
    24 m sur 1366 px, soit 57 px/m. On rend 3 m x 2,25 m (171 x 128 px), agrandis x 4 au plus proche."""
    from PIL import Image, ImageDraw, ImageOps
    scene()
    hide_sources()
    shots = []
    cases = [("dandelion", "pissenlit (référence, déjà en jeu)", ["dandelion"]),
             ("wild_garlic", "ail des ours", ["wild_garlic"]),
             ("chanterelle", "girolles", ["chanterelle"]),
             ("blackberry", "mûres sur le roncier", ["bramble+blackberry"]),
             ("hazelnut", "noisettes au pied du noisetier", ["bush_hazel+hazelnut"]),
             ("blackberry", "mûres au sol", ["blackberry"])]
    for key, title, what in cases:
        season = SEASON[key]
        set_season(season)
        clear_lights()
        lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
        lpl.sun((50, 0, 140), 3.0)
        gp = lpl.ground_plane(60, grass_lin(season), z=0.0)
        placed = []
        target_z = 0.1
        for w in what:
            if w == "bramble+blackberry":
                br = copy_of("bramble", (0, 0.35, 0))
                placed.append(br)
                bpy.context.view_layer.update()
                for i, p in enumerate(spots_world(br)):
                    placed.append(copy_of("blackberry", p, yaw=40 * i))
                target_z = 0.45
            elif w == "bush_hazel+hazelnut":
                placed.append(copy_of("bush_hazel", (-0.3, 0.6, 0)))
                placed.append(copy_of("hazelnut", (0.45, -0.25, 0)))
                target_z = 0.6
            else:
                placed.append(copy_of(w, (0, 0, 0)))
        lpl.setup_render((171, 128), 16)
        lpl.iso_camera(target=(0, 0, target_z), ortho=3.0, azimuth=45, elevation=35.264)
        p = os.path.join(OUT, f"_tmp_zoom1_{len(shots)}.png")
        lpl.render(p)
        shots.append((title, SEASON_NAME[season], p))
        remove(placed)
        bpy.data.objects.remove(gp, do_unlink=True)
    set_season(None)
    big = [Image.open(p).convert("RGB").resize((171 * 4, 128 * 4), Image.NEAREST) for _, _, p in shots]
    cols = 3
    rows = (len(big) + cols - 1) // cols
    cw, ch = 171 * 4 + 10, 128 * 4 * 2 + 60
    img = Image.new("RGB", (cw * cols + 10, ch * rows + 60), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((10, 10), "Zoom 1 du jeu: 57 px/m (24 m sur 1366 px), 3 m x 2,25 m autour de l'objet, agrandi x 4 au plus "
           "proche (pixels réels); dessous: niveaux de gris", fill=(20, 20, 20), font=font(18))
    for i, ((title, season, _), b) in enumerate(zip(shots, big)):
        x, y = 10 + (i % cols) * cw, 50 + (i // cols) * ch
        d.text((x, y), f"{title} ({season})", fill=(20, 20, 20), font=font(17))
        img.paste(b, (x, y + 25))
        img.paste(ImageOps.grayscale(b).convert("RGB"), (x, y + 25 + 128 * 4 + 5))
    path = os.path.join(OUT, "objets-zoom1.png")
    img.save(path)
    for _, _, p in shots:
        os.remove(p)
    print("PLANCHE", path)


# Au sol, de près -------------------------------------------------------------------------------------

def board_ground():
    """Vue rasante (élévation 8 degrés) de chaque objet posé au sol, et des mûres sur le roncier vues de près."""
    from PIL import Image, ImageDraw
    scene()
    hide_sources()
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    gp = lpl.ground_plane(60, lpl.hex_lin("#A7B98A"), z=0.0)
    shots = []
    cases = [("wild_garlic", 0.55, 0.16, 8, 30), ("chanterelle", 0.38, 0.06, 8, 30), ("blackberry", 0.34, 0.04, 8, 30),
             ("hazelnut", 0.34, 0.04, 8, 30), ("bramble", 1.55, 0.36, 8, 30), ("bush_hazel", 3.0, 1.02, 8, 30),
             ("oak_sapling", 2.1, 0.72, 8, 30), ("fir_sapling", 1.9, 0.62, 8, 30), ("bramble+berries", 0.75, 0.5, 25, 20)]
    for name, size, tz, el, az in cases:
        placed = []
        if name == "bramble+berries":
            br = copy_of("bramble", (0, 0, 0))
            placed.append(br)
            bpy.context.view_layer.update()
            for i, p in enumerate(spots_world(br)):
                placed.append(copy_of("blackberry", p, yaw=40 * i))
            target = (-0.1, -0.1, tz)
        else:
            placed.append(copy_of(name, (0, 0, 0)))
            target = (0, 0, tz)
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.setup_render((520, 420), 20)
        lpl.iso_camera(target=target, ortho=size, azimuth=az, elevation=el)
        p = os.path.join(OUT, f"_tmp_sol_{len(shots)}.png")
        lpl.render(p)
        shots.append((name, el, p))
        remove(placed)
    bpy.data.objects.remove(gp, do_unlink=True)
    ims = [Image.open(p).convert("RGB") for _, _, p in shots]
    cols = 3
    w, h = ims[0].size
    img = Image.new("RGB", (w * cols, (h + 28) * ((len(ims) + cols - 1) // cols) + 40), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((8, 8), "Au sol, de près (vue rasante, élévation 8 degrés; mûres sur le roncier: 25 degrés), GLB exportés",
           fill=(20, 20, 20), font=font(17))
    for i, ((name, el, _), im) in enumerate(zip(shots, ims)):
        x, y = (i % cols) * w, 40 + (i // cols) * (h + 28)
        d.text((x + 8, y + 4), name.replace("+berries", " + blackberry"), fill=(20, 20, 20), font=font(15))
        img.paste(im, (x, y + 26))
    path = os.path.join(OUT, "objets-sol.png")
    img.save(path)
    for _, _, p in shots:
        os.remove(p)
    print("PLANCHE", path)


def main():
    os.makedirs(OUT, exist_ok=True)
    if WHAT in ("echelle", "tout"):
        board_scale()
    if WHAT in ("zoom1", "tout"):
        board_zoom1()
    if WHAT in ("sol", "tout"):
        board_ground()


main()
