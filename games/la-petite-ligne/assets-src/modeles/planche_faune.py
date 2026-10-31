"""Planches de contrôle de la faune (tour 6), rendues depuis le GLB exporté (Cycles).

Lancer: duo-python planche_faune.py <dossier de sortie> [clips|echelle|zoom1|tout]
- clips: une planche par bête (faune-clips-<bête>.png): une rangée par clip, cinq images clés;
- echelle: les modèles de faune.glb côte à côte avec un joueur de 1,74 m (faune-echelle.png);
- zoom1: mésange au nichoir à l'échelle du zoom 1 du jeu (16 m sur 1366 pixels), taille réelle et agrandie
  (faune-mesange-zoom1.png).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402

OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(lpl.BOARDS)
WHAT = sys.argv[2] if len(sys.argv) > 2 else "tout"
FPS = 30

ANIMALS = {
    # bête: (azimut, élévation, cadre en m, hauteur du centre du cadre)
    "heron": (60, 18, 2.0, 0.55),
    "goose": (60, 22, 1.9, 0.1),
    "blue_tit": (60, 18, 0.32, 0.06),
    "fox": (70, 15, 1.35, 0.3),
}


def scene():
    lpl.reset()
    bpy.context.scene.render.fps = FPS
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "faune.glb"))
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)


def only(names):
    keep = set()
    for n in names:
        o = bpy.data.objects[n]
        keep |= {o, *o.children_recursive}
    for o in bpy.data.objects:
        if o.type in ("MESH", "ARMATURE", "EMPTY"):
            o.hide_render = o not in keep


def clips_of(animal):
    import json
    st = json.load(open(os.path.join(lpl.STATS, "faune.json"), encoding="utf-8"))
    return [a for a in st["animations"][animal]]


def set_action(arm, name, frame):
    ad = arm.animation_data or arm.animation_data_create()
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)
    act = bpy.data.actions[name]
    ad.action = act
    ad.action_slot = act.slots[0]
    bpy.context.scene.frame_set(0)
    bpy.context.scene.frame_set(frame)


def font(size):
    from PIL import ImageFont
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)


def board_clips(animal):
    from PIL import Image, ImageDraw
    az, el, frame_m, zc = ANIMALS[animal]
    only([animal])
    gp = lpl.ground_plane(50, lpl.hex_lin("#A7B98A"), z=-0.002)
    if animal == "goose":
        gp.location.z = -0.0   # ligne de flottaison: le sol du rendu tient lieu d'eau
        gp.data.materials[0].node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lpl.hex_lin("#6CAAB9"), 1)
    lpl.setup_render((300, 260), 10)
    cam = lpl.iso_camera(target=(0, 0, zc), ortho=frame_m, azimuth=az, elevation=el)
    arm = bpy.data.objects[animal]
    rows = []
    tmp = os.path.join(OUT, "_tmp")
    os.makedirs(tmp, exist_ok=True)
    for clip in clips_of(animal):
        n = round(clip["seconds"] * FPS)
        frames = sorted({round(n * k / 4) for k in range(5)})
        cells = []
        for f in frames:
            set_action(arm, clip["name"], f)
            p = os.path.join(tmp, f"{clip['name']}_{f}.png")
            lpl.render(p)
            cells.append((f, Image.open(p).copy()))
        rows.append((clip, cells))
    cw, ch = 300, 260
    lab = 230
    img = Image.new("RGB", (lab + cw * 5, ch * len(rows) + 40), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((10, 8), f"{animal}: images clés de chaque clip (faune.glb, sur place)", fill=(30, 30, 30), font=font(20))
    for r, (clip, cells) in enumerate(rows):
        y = 40 + r * ch
        d.text((10, y + 100), clip["name"], fill=(20, 20, 20), font=font(19))
        d.text((10, y + 128), f"{clip['seconds']} s, {'boucle' if clip['loop'] else 'une fois'}", fill=(80, 80, 80), font=font(15))
        for c, (f, im) in enumerate(cells):
            img.paste(im, (lab + c * cw, y))
            d.text((lab + c * cw + 6, y + 4), f"{f / FPS:.2f} s", fill=(40, 40, 40), font=font(14))
    path = os.path.join(OUT, f"faune-clips-{animal}.png")
    img.save(path)
    bpy.data.objects.remove(gp, do_unlink=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    print("PLANCHE", path)


def board_scale():
    """Les modèles côte à côte, en attente, avec un joueur de 1,74 m (personnages.glb)."""
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
    from mathutils import Matrix
    for pb in rig.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)
    poses = {"heron": "heron_idle", "goose": "goose_swim", "blue_tit": "tit_perch", "fox": "fox_look"}
    for a, c in poses.items():
        set_action(bpy.data.objects[a], c, 0 if a != "fox" else 20)
    # le long de l'axe X, de gauche à droite à l'écran (vue de face légèrement plongeante)
    place = {"ladder_wood": -2.3, rig.name: -1.2, "heron": -0.25, "fox": 0.75, "goose": 1.75, "nest_box": 2.55,
             "blue_tit": 2.95, "oak_branch_stub": 3.4, "moss_tuft": 3.7}
    for n, x in place.items():
        o = bpy.data.objects[n]
        o.location = (x, 0, 0)
    for n in ("heron", "fox", "goose"):
        bpy.data.objects[n].rotation_mode = "XYZ"
        bpy.data.objects[n].rotation_euler = (0, 0, math.radians(-90))   # de profil, tête vers la gauche
    bpy.data.objects["nest_box"].location = (2.55, 0.1, 0.62)
    bpy.data.objects["oak_branch_stub"].location = (3.4, 0, 0.5)
    bpy.data.objects["moss_tuft"].location = (3.4, -0.3, 0.12)
    bpy.data.objects["blue_tit"].location = (2.55, -0.08, 0.62 - 0.048)
    only(list(place))
    rig.hide_render = False
    for o in rig.children_recursive:
        o.hide_render = False
    gp = lpl.ground_plane(60, lpl.hex_lin("#A7B98A"), z=-0.002)
    lpl.setup_render((1800, 820), 24)
    lpl.persp_camera((0.8, -10.5, 2.0), (0.8, 0, 0.8), lens=55)
    for x in range(-3, 5):
        lpl.label(f"{x} m", (x, -0.9, 0.005), size=0.12)
    path = os.path.join(OUT, "faune-echelle.png")
    lpl.render(path)
    bpy.data.objects.remove(gp, do_unlink=True)
    print("PLANCHE", path)


def board_zoom1():
    """Mésange au toit du nichoir, vue isométrique du jeu au zoom 1: 16 m sur 1366 pixels (85 px/m)."""
    only(["nest_box", "blue_tit"])
    nb = bpy.data.objects["nest_box"]
    nb.location = (0, 0, 2.575)
    tit = bpy.data.objects["blue_tit"]
    set_action(tit, "tit_perch", 0)
    gp = lpl.ground_plane(60, lpl.hex_lin("#A7B98A"), z=-0.002)
    # tronc stylisé derrière le nichoir (repère de taille seulement)
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.22, depth=3.0, location=(0, 0.22, 1.5))
    trunk = bpy.context.active_object
    m = bpy.data.materials.new("tronc")
    m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*lpl.hex_lin("#6E5743"), 1)
    trunk.data.materials.append(m)
    # 16 m de large sur 1366 px: on ne rend que 2 m (171 px) autour du nichoir, puis on agrandit x 4 au plus proche
    shots = []
    for scale in (1.0, 1.5):
        tit.scale = (scale / 1.5,) * 3
        tit.location = (0, -0.055 * 1.0 - 0.0, 2.575 - 0.048)
        lpl.setup_render((171, 128), 16)
        lpl.iso_camera(target=(0, 0, 2.4), ortho=2.0, azimuth=45, elevation=35.264)
        p = os.path.join(OUT, f"_tmp_zoom1_{scale}.png")
        lpl.render(p)
        shots.append((scale, p))
    from PIL import Image, ImageDraw
    big = [Image.open(p).resize((171 * 4, 128 * 4), Image.NEAREST) for _, p in shots]
    img = Image.new("RGB", (171 * 4 * 2 + 30, 128 * 4 + 70), (245, 243, 238))
    d = ImageDraw.Draw(img)
    for i, ((s, _), b) in enumerate(zip(shots, big)):
        img.paste(b, (10 + i * (171 * 4 + 10), 60))
        d.text((10 + i * (171 * 4 + 10), 10), f"mésange x {s} ({0.12 * s:.2f} m), zoom 1: 85 px/m, agrandi x 4 (pixels réels)",
               fill=(20, 20, 20), font=font(17))
    path = os.path.join(OUT, "faune-mesange-zoom1.png")
    img.save(path)
    for _, p in shots:
        os.remove(p)
    bpy.data.objects.remove(gp, do_unlink=True)
    bpy.data.objects.remove(trunk, do_unlink=True)
    print("PLANCHE", path)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene()
    if WHAT in ("clips", "tout"):
        for a in ANIMALS:
            board_clips(a)
    if WHAT in ("zoom1", "tout"):
        board_zoom1()
    if WHAT in ("echelle", "tout"):
        board_scale()
    import shutil
    shutil.rmtree(os.path.join(OUT, "_tmp"), ignore_errors=True)


main()
