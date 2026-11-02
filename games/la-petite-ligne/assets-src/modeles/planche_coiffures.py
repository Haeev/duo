"""Planches du tour 10: les 15 coupes et les 3 barbes (bustes sous trois angles, une couleur par buste parmi les
huit), et les poses où une coupe longue risque de traverser quelque chose (couché sur le lit double, porter la
poutre à deux, lancer de la canne, assis); Achille et Solange.

Lancer après personnages.py, maison.py et ferme.py:
    duo-python planche_coiffures.py <dossier> [coupes|poses|habitants|tout]
"""
import math
import os
import sys
import tempfile

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import palette as P  # noqa: E402
from rendus_personnages import base_scene, clone_character  # noqa: E402

CUTS = ["short", "bob", "bun", "crop", "curls", "ponytail", "braid", "pigtails", "wavy", "long", "fringe", "quiff",
        "cloud", "crown", "bob_long"]
SKINS = ["#F2CDB0", "#E8BE9A", "#D29E78", "#B9825C", "#8E5C3E", "#6A4430"]


def hair_material(base_mat, k, skin=None):
    """Copie du matériau des personnages dont la rangée 0 porte la couleur de cheveux k (et une peau)."""
    from PIL import Image
    img = Image.open(os.path.join(lpl.TEX_SRC, "personnages.png")).convert("RGB")
    col = P.PLAYER_PRESETS["hair_colors"][k]
    row = dict(P.CHAR_ROWS["player_a"], hair=col["hair"], hair_dark=col["hair_dark"])
    if skin:
        row["skin"] = skin
    for c, slot in enumerate(P.CHAR_SLOTS):
        rgb = P.hex_to_rgb(row[slot])
        for dx in range(P.CELL):
            for dy in range(P.CELL):
                img.putpixel((c * P.CELL + dx, dy), rgb)
    path = os.path.join(tempfile.gettempdir(), f"lpl_cheveux_{k}_{skin or ''}.png".replace("#", ""))
    img.save(path)
    mat = base_mat.copy()
    mat.name = f"cheveux_{k}_{skin}"
    tex = [n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE"][0]
    tex.image = bpy.data.images.load(path, check_existing=True)
    return mat


def import_only(fichier, names):
    """Importe un GLB et n'en garde que les nœuds racines nommés (et leurs enfants)."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, fichier))
    new = [o for o in bpy.data.objects if o not in before]
    keep = set()
    for o in new:
        if o.name in names:
            keep |= {o, *o.children_recursive}
    for name in [o.name for o in new if o not in keep]:
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)


def set_clip(rig, clip, frame=None):
    act = bpy.data.actions[clip]
    ad = rig.animation_data_create()
    ad.action = act
    ad.action_slot = act.slots[0]


def busts(dossier):
    """Trois rangées de bustes (cinq coupes) et une de barbes, sous trois angles: trois quarts avant,
    profil gauche, trois quarts arrière."""
    base_scene()
    base_mat = bpy.data.materials["lpl_characters"]
    sc = bpy.context.scene
    lpl.setup_render((1800, 520), samples=20)
    rows = [CUTS[0:5], CUTS[5:10], CUTS[10:15], ["beard_short", "beard_full", "mustache", "cloud", "crop"]]
    outs = []
    for ri, row in enumerate(rows):
        made = []
        for i, cut in enumerate(row):
            k = (ri * 5 + i) % 8
            mat = hair_material(base_mat, k, SKINS[(ri * 5 + i) % 6])
            parts = ["player_base", ["player_outfit_work", "player_outfit_smock", "player_outfit_overalls"][i % 3],
                     ["player_scarf_orb", "player_scarf_star", "player_scarf_sun"][i % 3]]
            if cut.startswith("beard") or cut == "mustache":
                parts += ["player_" + cut, "player_hair_" + ["short", "crop", "quiff", "cloud", "crop"][i]]
            else:
                parts.append("player_hair_" + cut)
            if ri == 3 and i >= 3:
                parts.append("player_" + ["beard_full", "mustache"][i - 3])
            objs = clone_character(parts, (i * 0.75, 0, 0), mat=mat)
            set_clip(objs[0], "idle")
            made += objs
            lpl.label(f"{cut} ({P.PLAYER_PRESETS['hair_colors'][k]['id']})", (i * 0.75, -0.45, 0.02), size=0.05,
                      rot=(90, 0, 0))
        sc.frame_set(0)
        for vi, az in enumerate((25, 125, 205)):
            for o in list(bpy.data.objects):
                if o.type == "CAMERA":
                    bpy.data.objects.remove(o, do_unlink=True)
            # cadre: les bustes (de 1,15 m au sommet des coiffures), vus un peu d'en haut
            cam = lpl.iso_camera(target=(1.5, 0, 1.45), ortho=3.6, azimuth=az, elevation=12)
            if az == 90:
                cam.data.ortho_scale = 3.6
            f = os.path.join(tempfile.gettempdir(), f"bustes_{ri}_{vi}.png")
            sc.render.filepath = f
            bpy.ops.render.render(write_still=True)
            outs.append(f)
        for o in made:
            bpy.data.objects.remove(o, do_unlink=True)
    return outs


def poses(dossier):
    """Coupes longues et volumineuses dans les poses à risque, vues de côté: couché sur le lit double (tête à la
    tête de lit), porter la poutre (la poutre au-dessus des têtes), lancer de la canne (armé derrière la tête),
    assis sur la chaise."""
    base_scene()
    base_mat = bpy.data.materials["lpl_characters"]
    sc = bpy.context.scene
    lpl.setup_render((1800, 1000), samples=16)
    import_only("maison.glb", {"double_bed", "chair"})
    bed, chair = bpy.data.objects["double_bed"], bpy.data.objects["chair"]
    long_cuts = ["long", "braid", "ponytail", "cloud", "wavy", "pigtails", "crown", "bob_long"]
    made = []
    # ligne 1: couchés (deux par lit), ligne 2: lancer, ligne 3: porter, ligne 4: assis
    for i, cut in enumerate(long_cuts):
        mat = hair_material(base_mat, i % 8, SKINS[i % 6])
        parts = ["player_base", "player_outfit_work", "player_scarf_orb", "player_hair_" + cut]
        x = i * 1.0
        if i % 2 == 0:
            b = bed.copy()
            sc.collection.objects.link(b)
            b.location = (x + 0.36, 0, 0)
            made.append(b)
        objs = clone_character(parts, (x + (0.0 if i % 2 == 0 else -0.28), 0, 0.5 - 0.0), mat=mat)
        set_clip(objs[0], "sleep")
        made += objs
        objs = clone_character(parts, (x, -3.0, 0), mat=mat)
        set_clip(objs[0], "fish_cast")
        made += objs
        objs = clone_character(parts, (x, -5.0, 0), mat=mat)
        set_clip(objs[0], "carry_two")
        made += objs
        c = chair.copy()
        sc.collection.objects.link(c)
        c.location = (x, -7.0, 0)
        made.append(c)
        objs = clone_character(parts, (x, -7.0, 0), mat=mat)
        set_clip(objs[0], "sit")
        made += objs
    beam = None
    import_only("ferme.glb", {"beam"})
    if "beam" in bpy.data.objects:
        beam = bpy.data.objects["beam"]
        beam.rotation_mode = "XYZ"
        beam.rotation_euler = (0, 0, math.radians(90))
        beam.location = (3.5, -5.0, 1.78)
        beam.scale = (1, 1.8, 1)
    shots = []
    for ci, (frame, az, el) in enumerate(((14, 90, 25), (14, 270, 25), (14, 200, 35))):
        sc.frame_set(frame)
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.iso_camera(target=(3.6, -3.5, 1.0), ortho=10.5, azimuth=az, elevation=el)
        f = os.path.join(tempfile.gettempdir(), f"poses_{ci}.png")
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    return shots


def villagers(dossier):
    base_scene()
    sc = bpy.context.scene
    lpl.setup_render((1600, 800), samples=20)
    for i, (n, clip) in enumerate((("villager_achille", "idle"), ("villager_solange", "idle"),
                                   ("villager_achille", "carry_two"), ("villager_solange", "talk"))):
        objs = clone_character([n], (i * 1.0, 0, 0))
        set_clip(objs[0], clip)
    for i, n in enumerate(("villager_odette", "villager_basile")):
        objs = clone_character([n], (4.2 + i * 0.9, 0, 0))
        set_clip(objs[0], "idle")
    sc.frame_set(10)
    shots = []
    for vi, az in enumerate((20, 160, 270)):
        for o in list(bpy.data.objects):
            if o.type == "CAMERA":
                bpy.data.objects.remove(o, do_unlink=True)
        lpl.iso_camera(target=(2.4, 0, 0.95), ortho=6.2, azimuth=az, elevation=14)
        f = os.path.join(tempfile.gettempdir(), f"habitants_{vi}.png")
        sc.render.filepath = f
        bpy.ops.render.render(write_still=True)
        shots.append(f)
    return shots


if __name__ == "__main__":
    dossier = os.path.abspath(sys.argv[-2])
    what = sys.argv[-1]
    out = []
    if what in ("coupes", "tout"):
        out += busts(dossier)
    if what in ("poses", "tout"):
        out += poses(dossier)
    if what in ("habitants", "tout"):
        out += villagers(dossier)
    print("PLANCHES", " ".join(out))
