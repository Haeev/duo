"""Planches de contrôle de la faune (tour 6), rendues depuis le GLB exporté (Cycles).

Lancer: duo-python planche_faune.py <dossier de sortie> [clips|echelle|zoom1|tout]
- clips: une planche par bête (faune-clips-<bête>.png): une rangée par clip, cinq images clés;
- echelle: les modèles de faune.glb côte à côte avec un joueur de 1,74 m (faune-echelle.png);
- zoom1: mésange au nichoir à l'échelle du zoom 1 du jeu (16 m sur 1366 pixels), taille réelle et agrandie
  (faune-mesange-zoom1.png).
Tour 7 (troisième argument de clips: liste de bêtes, ex. roe_deer,fawn,kingfisher):
- echelle7: chevrette, faon, martin-pêcheur sur son pieu et ablette à côté d'un joueur (faune-echelle-tour7.png);
- zoom1kf: martin-pêcheur au zoom de départ (24 m sur 1366 px), x 1 et x 1,5 (faune-martin-pecheur-zoom1.png);
- contraste7: chaque bête sur son fond réel, couleur, niveaux de gris et deutéranopie, avec les L* mesurés
  (faune-gris-deuteranopie-tour7.png).
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
# bêtes des planches de clips (troisième argument, séparées par des virgules; défaut: toutes)
ONLY = sys.argv[3].split(",") if len(sys.argv) > 3 else None
FPS = 30

ANIMALS = {
    # bête: (azimut, élévation, cadre en m, hauteur du centre du cadre)
    "heron": (60, 18, 2.0, 0.55),
    "goose": (60, 22, 1.9, 0.1),
    "blue_tit": (60, 18, 0.32, 0.06),
    "fox": (70, 15, 1.35, 0.3),
    # tour 7
    "roe_deer": (65, 15, 2.3, 0.62),
    "fawn": (65, 15, 1.5, 0.36),
    "kingfisher": (60, 16, 0.5, 0.06),
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


# Tour 7: chevrette, faon, martin-pêcheur et son pieu ------------------------------------------

def load_player():
    """Joueur de 1,74 m (personnages.glb) en pose de repos, pièces de la tenue de travail."""
    from mathutils import Matrix
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
    return rig


def place(name, loc, yaw=0.0):
    o = bpy.data.objects[name]
    o.location = loc
    o.rotation_mode = "XYZ"
    o.rotation_euler = (0, 0, math.radians(yaw))
    return o


def show(objs):
    for o in bpy.data.objects:
        if o.type in ("MESH", "ARMATURE", "EMPTY"):
            o.hide_render = True
    for o in objs:
        for x in (o, *o.children_recursive):
            x.hide_render = False


def clear_lights():
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)


def board_scale7():
    """Chevrette, faon, martin-pêcheur sur son pieu (ligne d'eau à 0) et ablette, à côté d'un joueur de 1,74 m."""
    rig = load_player()
    # toutes les poses à l'image 0: la scène n'a qu'une image courante pour tous les squelettes
    set_action(bpy.data.objects["roe_deer"], "deer_stamp", 0)
    set_action(bpy.data.objects["fawn"], "fawn_suckle", 0)
    set_action(bpy.data.objects["kingfisher"], "kf_perch", 0)
    # de profil, tête vers la gauche de l'image (vue de face, de -Y)
    place(rig.name, (-1.5, 0, 0))
    place("roe_deer", (0.0, 0, 0), -90)
    place("fawn", (1.2, 0, 0), -90)
    place("mooring_post", (2.3, 0, 0.95))
    place("kingfisher", (2.3, 0, 0.97), -90)
    place("small_fish", (2.75, -0.2, 0.97))
    show([rig, *(bpy.data.objects[n] for n in ("roe_deer", "fawn", "mooring_post", "kingfisher", "small_fish"))])
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    gp = lpl.ground_plane(60, lpl.hex_lin("#A7B98A"), z=-0.002)
    lpl.setup_render((1800, 900), 24)
    lpl.persp_camera((0.6, -9.0, 1.1), (0.6, 0, 0.85), lens=55)
    for x in range(-2, 4):
        lpl.label(f"{x} m", (x, -0.9, 0.005), size=0.12)
    lpl.label("pieu: ligne d'eau au sol", (2.3, -0.6, 0.005), size=0.07)
    lpl.label("ablette", (2.75, -0.2, 0.88), size=0.06, rot=(90, 0, 0))
    path = os.path.join(OUT, "faune-echelle-tour7.png")
    lpl.render(path)
    bpy.data.objects.remove(gp, do_unlink=True)
    print("PLANCHE", path)


def board_zoom1_kf():
    """Martin-pêcheur sur le pieu, au zoom de départ du jeu (24 m sur 1366 px, 57 px/m), x 1 et x 1,5."""
    from PIL import Image, ImageDraw
    kf = bpy.data.objects["kingfisher"]
    set_action(kf, "kf_perch", 0)
    place("mooring_post", (0, 0, 0.95))
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    show([bpy.data.objects["mooring_post"], kf])
    water = lpl.ground_plane(60, lpl.hex_lin("#4C899A"), z=0.0)
    shots = []
    for scale in (1.0, 1.5):
        kf.scale = (scale / 1.5,) * 3
        place("kingfisher", (0, 0, 0.97), 0)
        lpl.setup_render((171, 128), 16)
        lpl.iso_camera(target=(0, 0, 0.7), ortho=3.0, azimuth=45, elevation=35.264)
        p = os.path.join(OUT, f"_tmp_kf_{scale}.png")
        lpl.render(p)
        shots.append((scale, p))
    kf.scale = (1, 1, 1)
    big = [Image.open(p).resize((171 * 4, 128 * 4), Image.NEAREST) for _, p in shots]
    img = Image.new("RGB", (171 * 4 * 2 + 30, 128 * 4 + 70), (245, 243, 238))
    d = ImageDraw.Draw(img)
    for i, ((s, _), b) in enumerate(zip(shots, big)):
        img.paste(b, (10 + i * (171 * 4 + 10), 60))
        d.text((10 + i * (171 * 4 + 10), 10), f"martin-pêcheur x {s} ({0.17 * s:.2f} m) sur son pieu, zoom 1: 57 px/m,",
               fill=(20, 20, 20), font=font(17))
        d.text((10 + i * (171 * 4 + 10), 32), "agrandi x 4 au plus proche (pixels réels)", fill=(20, 20, 20), font=font(17))
    path = os.path.join(OUT, "faune-martin-pecheur-zoom1.png")
    img.save(path)
    for _, p in shots:
        os.remove(p)
    bpy.data.objects.remove(water, do_unlink=True)
    print("PLANCHE", path)


# Machado, Oliveira et Fernandes (2009), deutéranopie de sévérité 1, sur des valeurs linéaires
DEUTAN = ((0.367322, 0.860646, -0.227968), (0.280085, 0.672501, 0.047413), (-0.011820, 0.042940, 0.968881))


def _lin(a):
    import numpy as np
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def _srgb(a):
    import numpy as np
    a = np.clip(a, 0, 1)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1 / 2.4) - 0.055)


def _lstar(lin_rgb):
    import numpy as np
    y = lin_rgb[..., 0] * 0.2126 + lin_rgb[..., 1] * 0.7152 + lin_rgb[..., 2] * 0.0722
    return np.where(y > 0.008856, 116 * np.cbrt(y) - 16, 903.3 * y)


def board_contrast7():
    """Chaque bête sur son fond réel (pré à l'aube, eau du ponton le matin), zoom 0 du jeu (16 m sur 1366 px,
    85 px/m) agrandi x 3: couleur, niveaux de gris (L*), deutéranopie. L* moyen de la bête et du fond mesuré
    sur un masque (rendu sans fond)."""
    import numpy as np
    from PIL import Image, ImageDraw
    cases = [
        # (titre, objets à montrer, sol, couleur du sol, soleil (rotation, énergie, couleur), cible, cadre)
        ("Chevrette en alerte, pré de l'est à l'aube (deer_stamp, image 0)", ["roe_deer"], "#93B45E", ((72, 0, 95), 2.6, (1.0, 0.86, 0.72)),
         (0, 0, 0.55), 2.4),
        ("Faon trottinant, même pré (fawn_trot)", ["fawn"], "#93B45E", ((72, 0, 95), 2.6, (1.0, 0.86, 0.72)), (0, 0, 0.32), 2.4),
        ("Martin-pêcheur x 1,5 sur son pieu, eau du ponton le matin (kf_perch)", ["kingfisher", "mooring_post"], "#4C899A",
         ((48, 0, 140), 3.0, (1.0, 0.95, 0.86)), (0, 0, 0.75), 2.4),
    ]
    set_action(bpy.data.objects["roe_deer"], "deer_stamp", 0)
    set_action(bpy.data.objects["fawn"], "fawn_trot", 0)
    set_action(bpy.data.objects["kingfisher"], "kf_perch", 0)
    place("roe_deer", (0, 0, 0), 120)
    place("fawn", (0, 0, 0), 120)
    place("mooring_post", (0, 0, 0.95))
    place("kingfisher", (0, 0, 0.97), 150)
    px = int(2.4 * 85)
    cell = px * 3
    rows = []
    for title, names, ground, (srot, sen, scol), target, frame in cases:
        clear_lights()
        lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
        lpl.sun(srot, sen, scol)
        show([bpy.data.objects[n] for n in names])
        lpl.iso_camera(target=target, ortho=frame, azimuth=45, elevation=35.264)
        lpl.setup_render((px, px), 24, transparent=True)
        pm = os.path.join(OUT, "_tmp_mask.png")
        lpl.render(pm)
        gp = lpl.ground_plane(60, lpl.hex_lin(ground), z=0.0)
        lpl.setup_render((px, px), 24)
        pc = os.path.join(OUT, "_tmp_col.png")
        lpl.render(pc)
        bpy.data.objects.remove(gp, do_unlink=True)
        col = np.asarray(Image.open(pc).convert("RGB")).astype(float) / 255
        mask = np.asarray(Image.open(pm).convert("RGBA"))[..., 3] > 200
        lin = _lin(col)
        L = _lstar(lin)
        deut = _srgb(np.einsum("ij,hwj->hwi", np.array(DEUTAN), lin))
        bg = ~(np.asarray(Image.open(pm).convert("RGBA"))[..., 3] > 10)
        l_animal, l_bg = float(L[mask].mean()), float(L[bg].mean())
        grey = np.repeat((L / 100)[..., None], 3, axis=2)
        ims = [Image.fromarray((a * 255).astype("uint8")).resize((cell, cell), Image.NEAREST) for a in (col, grey, deut)]
        rows.append((f"{title}: L* bête {l_animal:.1f}, fond {l_bg:.1f} (écart {abs(l_animal - l_bg):.1f})", ims))
        os.remove(pm)
        os.remove(pc)
    img = Image.new("RGB", (cell * 3, 34 + len(rows) * (cell + 30)), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((8, 8), "Tour 7 sur fond réel, zoom 0 x 3 (colonnes: couleur, niveaux de gris L*, deutéranopie; Machado 2009)",
           fill=(20, 20, 20), font=font(18))
    y = 34
    for title, ims in rows:
        d.text((8, y + 6), title, fill=(20, 20, 20), font=font(16))
        for i, im in enumerate(ims):
            img.paste(im, (i * cell, y + 30))
        y += cell + 30
    path = os.path.join(OUT, "faune-gris-deuteranopie-tour7.png")
    img.save(path)
    print("PLANCHE", path, [r[0] for r in rows])


def main():
    os.makedirs(OUT, exist_ok=True)
    scene()
    if WHAT == "echelle7":
        board_scale7()
    if WHAT == "zoom1kf":
        board_zoom1_kf()
    if WHAT == "contraste7":
        board_contrast7()
    if WHAT in ("clips", "tout"):
        for a in ANIMALS:
            if ONLY is None or a in ONLY:
                board_clips(a)
    if WHAT in ("zoom1", "tout"):
        board_zoom1()
    if WHAT in ("echelle", "tout"):
        board_scale()
    import shutil
    shutil.rmtree(os.path.join(OUT, "_tmp"), ignore_errors=True)


main()
