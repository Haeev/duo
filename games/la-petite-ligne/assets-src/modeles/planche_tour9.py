"""Planches de contrôle des modèles du tour 9, rendues depuis les GLB exportés (Cycles).

Lancer: duo-python planche_tour9.py <dossier de sortie> [echelle|maison|poses|zoom1|tout]
- echelle: chantiers, outils et objets à côté d'un joueur de 1,74 m (modeles-echelle.png);
- maison: objets muraux accrochés sur un pan de mur de la maisonnette, fauteuil, joueur (modeles-maison.png);
- poses: objets posés vus de près, chacun sur ce qui le porte: toit sur le puits, auvent sur la façade, banc au
  pignon, manivelle sur le poteau, fruits sur leur buisson (modeles-poses.png);
- zoom1: lisibilité des cueillettes au zoom de départ (57 px/m), de jour et au soleil couchant, avec la taille
  à l'écran et le contraste de luminance mesurés sur l'image (modeles-zoom1.png, modeles-zoom1.json).
"""
import json
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
GH_HX, GH_HY = 2.8, 2.3   # demi-emprise des murs de la maisonnette (bourg.GH)


def font(size):
    from PIL import ImageFont
    p = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    return ImageFont.truetype(p, size) if os.path.exists(p) else ImageFont.load_default(size)


def scene(files=("ferme.glb", "bourg.glb", "maison.glb")):
    lpl.reset()
    for f in files:
        bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, f))
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    for o in bpy.data.objects:
        o.rotation_mode = "XYZ"
        if o.type in ("MESH", "EMPTY", "ARMATURE"):
            o.hide_render = True


def load_player():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "personnages.glb"))
    new = set(bpy.data.objects) - before
    rig = next(o for o in new if o.type == "ARMATURE")
    keep = {"player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"}
    for o in new:
        if o.type == "MESH" and o.name not in keep:
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
    for o in (rig, *rig.children_recursive):
        o.hide_render = False
    return rig


def copy_of(name, loc, yaw=0.0, hide=()):
    src = bpy.data.objects[name]
    d = lpl.duplicate_tree(src)
    d.rotation_mode = "XYZ"
    d.location = loc
    d.rotation_euler = (0, 0, math.radians(yaw))
    for o in (d, *d.children_recursive):
        o.hide_render = any(o.name.startswith(h) for h in hide)
    return d


def spot_world(host, key):
    """Premier point d'un extra (repère glTF: x, hauteur, z vers l'avant) en coordonnées monde Blender."""
    x, y, z = host[key][0]
    return host.matrix_world @ Vector((x, -z, y))


def clear():
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)


def set_season(season):
    name = "palette.png" if season is None else f"palette-{season}.png"
    img = bpy.data.images.load(os.path.join(lpl.TEX_OUT, name), check_existing=True)
    for m in bpy.data.materials:
        if not m.name.startswith("lpl_palette") or not m.node_tree:
            continue
        link = m.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].links
        if link and link[0].from_node.type == "TEX_IMAGE":
            link[0].from_node.image = img


def grass_lin(season):
    hx = dict((w[0], w[1]) for w in P.WORLD)["grass"]
    if season:
        hx = P.SEASONS[season].get("grass", hx)
    return lpl.hex_lin(hx)


def labels(items, size=0.12):
    for txt, x, y in items:
        lpl.label(txt, (x, y, 0.005), size=size, rot=(30, 0, 0))


# Échelle ---------------------------------------------------------------------------------------------

def board_scale():
    scene()
    rig = load_player()
    rig.location = (-1.2, 0.2, 0)
    rig.rotation_euler = (0, 0, math.radians(-20))
    copy_of("ford_bench", (0.6, 0.3, 0))
    copy_of("house_bench", (2.8, 0.3, 0))
    copy_of("quay_planter", (4.5, 0.3, 0), hide=("quay_planter_autumn", "quay_planter_winter"))
    copy_of("well", (6.6, 0.5, 0), hide=("well_gallows",))
    copy_of("well_roof", (6.6, 0.5, 0))
    copy_of("level_crossing_gate", (8.6, 0.5, 0))
    copy_of("level_crossing_crank", (8.6, 0.5 - 0.08, 1.0))
    copy_of("hen_crate", (10.0, 0.3, 0))
    copy_of("bush_elder", (11.6, 0.6, 0))
    for n, x in (("watering_can_copper", -2.6), ("axe_forged", -3.1), ("fishing_rod_bamboo", -3.9),
                 ("lamp_pole", -5.0)):
        t = copy_of(n, (x, -0.2, 1.1))
        if n == "lamp_pole":
            t.rotation_euler = (math.radians(-90), 0, 0)   # dressée, comme dans pole_raise
    clear()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(120, lpl.hex_lin("#A7B98A"))
    lpl.setup_render((2400, 900), 24)
    lpl.persp_camera((3.4, -17.5, 3.6), (3.4, 0, 1.1), lens=34)
    for x in range(-5, 13):
        lpl.label(f"{x} m", (x, -1.6, 0.005), size=0.14, rot=(30, 0, 0))
    labels([("joueur 1,74 m", -1.3, -0.9), ("banc du gué", 0.6, -0.9), ("banc au pignon", 2.8, -0.9),
            ("jardinière (été)", 4.5, -0.9), ("toit du puits", 6.6, -1.1), ("manivelle à 1 m", 8.6, -1.1),
            ("cage", 10.0, -0.9), ("sureau", 11.6, -1.1), ("outils et perche", -3.8, -1.1)])
    p = os.path.join(OUT, "modeles-echelle.png")
    lpl.render(p)
    print("PLANCHE", p)


# Maison ----------------------------------------------------------------------------------------------

def board_house():
    scene(("maison.glb",))
    rig = load_player()
    rig.location = (0.3, -1.6, 0)
    rig.rotation_euler = (0, 0, math.radians(200))
    g = lpl.Geo(lpl.world_cells())
    g.box((6.0, 0.3, 2.4), loc=(0, 0.65, 0), color="plaster_cream", base=True)
    mat = bpy.data.materials.get("lpl_palette") or lpl.palette_material("tmp", os.path.join(lpl.TEX_SRC, "palette.png"))
    wall = g.to_object("mur_essai", mat)
    wall.hide_render = False
    xs = (-2.5, -1.5, -0.5, 0.5, 1.5, 2.5)
    for n, x in zip(("straw_hat", "pressed_flowers", "coop_calendar", "wall_clock", "autumn_wreath",
                     "jeanne_drawing"), xs):
        copy_of(n, (x, 0, 0), hide=("coop_calendar_spring", "coop_calendar_summer", "coop_calendar_winter"))
    copy_of("wicker_armchair", (-1.4, -0.8, 0), yaw=-15)
    copy_of("chair", (1.6, -0.6, 0))
    clear()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((55, 0, 160), 3.0)
    lpl.ground_plane(40, lpl.hex_lin("#B79E78"))
    lpl.setup_render((2000, 1000), 24)
    lpl.persp_camera((0.6, -7.5, 1.7), (0, 0, 1.15), lens=34)
    p = os.path.join(OUT, "modeles-maison.png")
    lpl.render(p)
    print("PLANCHE", p)


# Posés, de près ---------------------------------------------------------------------------------------

def _shot(path, cam, target, lens=40, res=(640, 520)):
    for o in list(bpy.data.objects):
        if o.type == "CAMERA":
            bpy.data.objects.remove(o, do_unlink=True)
    lpl.setup_render(res, 20)
    lpl.persp_camera(cam, target, lens=lens)
    lpl.render(path)


def board_posed():
    from PIL import Image, ImageDraw
    scene()
    clear()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    gp = lpl.ground_plane(80, lpl.hex_lin("#A7B98A"))
    gp.hide_render = False
    shots = []

    def tmp(i):
        return os.path.join(OUT, f"_tmp_pose_{i}.png")
    # 1. toit du puits sur le puits ouvert (même origine), vue basse
    a = [copy_of("well", (0, 0, 0), hide=("well_gallows",)), copy_of("well_roof", (0, 0, 0))]
    _shot(tmp(1), (2.6, -3.0, 1.2), (0, 0, 1.2), 30)
    shots.append(("well + well_roof (même origine)", tmp(1)))
    # 2. puits ouvert avec sa potence
    b = [copy_of("well", (0, 0, 0))]
    for o in a:
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True
    _shot(tmp(2), (2.2, -2.6, 1.6), (0, 0, 1.0), 32)
    shots.append(("well (ouvert, potence)", tmp(2)))
    for o in b:
        o.hide_render = True
        for c in o.children_recursive:
            c.hide_render = True
    # 3. auvent sur la façade de la maisonnette réparée, joueur sous l'auvent
    house = copy_of("gatekeeper_house_repaired", (0, 0, 0))
    house.location = (0, 0, 0)
    canopy = copy_of("door_canopy", (0, -GH_HY, 0))
    rig = load_player()
    rig.location = (0.0, -GH_HY - 0.7, 0)
    _shot(tmp(3), (2.4, -6.0, 1.8), (0, -GH_HY - 0.4, 1.7), 34)
    shots.append(("door_canopy sur la porte (joueur 1,74 m dessous)", tmp(3)))
    _shot(tmp(4), (3.2, -GH_HY - 0.6, 2.0), (0, -GH_HY - 0.5, 2.05), 40)
    shots.append(("door_canopy de profil (sous la rive du toit)", tmp(4)))
    # 4. banc au pignon est: dos au mur (soubassement à hx + 0,03), face à l'est
    bench = copy_of("house_bench", (GH_HX + 0.03 + 0.386, 0.3, 0), yaw=90)
    rig.location = (GH_HX + 1.6, -0.4, 0)
    _shot(tmp(5), (GH_HX + 2.6, -2.4, 1.3), (GH_HX + 0.4, 0.3, 0.6), 34)
    shots.append(("house_bench contre le pignon est", tmp(5)))
    for o in (house, canopy, bench, rig):
        for c in (o, *o.children_recursive):
            c.hide_render = True
    # 5. manivelle sur le poteau de la barrière, à 1,0 m, côté -Y
    post = copy_of("level_crossing_gate", (0, 0, 0))
    crank = copy_of("level_crossing_crank", (0, -0.08, 1.0))
    _shot(tmp(6), (0.9, -1.3, 1.3), (0, -0.1, 1.0), 40)
    shots.append(("level_crossing_crank sur le poteau (1,0 m)", tmp(6)))
    for o in (post, crank):
        for c in (o, *o.children_recursive):
            c.hide_render = True
    # 6. fruits sur leur hôte (points berry_spots, nut_spots), avec le lacet de l'hôte
    br = copy_of("bramble", (0, 0, 0))
    bpy.context.view_layer.update()
    bb = copy_of("blackberry", spot_world(br, "berry_spots"))
    _shot(tmp(7), (0.5, -1.6, 0.7), (0, -0.1, 0.42), 40)
    shots.append(("blackberry sur bramble (face sud)", tmp(7)))
    for o in (br, bb):
        o.hide_render = True
    el = copy_of("bush_elder", (0, 0, 0))
    bpy.context.view_layer.update()
    eb = copy_of("elderberry", spot_world(el, "berry_spots"))
    set_season("automne")
    _shot(tmp(8), (0.7, -2.6, 1.2), (0, -0.3, 0.85), 38)
    shots.append(("elderberry sur bush_elder (automne)", tmp(8)))
    for o in (el, eb):
        o.hide_render = True
    hz = copy_of("bush_hazel", (0, 0, 0))
    bpy.context.view_layer.update()
    hn = copy_of("hazelnut", spot_world(hz, "nut_spots"))
    _shot(tmp(9), (1.2, -2.6, 1.3), (0, -0.25, 0.3), 36)
    shots.append(("hazelnut à nut_spots de bush_hazel (automne)", tmp(9)))
    for o in (hz, hn):
        o.hide_render = True
    set_season(None)
    ims = [Image.open(p).convert("RGB") for _, p in shots]
    w, h = ims[0].size
    cols = 3
    img = Image.new("RGB", (w * cols, (h + 28) * ((len(ims) + cols - 1) // cols) + 40), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((8, 8), "Posés, vus de près (GLB exportés): chaque pièce sur ce qui la porte", fill=(20, 20, 20), font=font(18))
    for i, ((name, _), im) in enumerate(zip(shots, ims)):
        x, y = (i % cols) * w, 40 + (i // cols) * (h + 28)
        d.text((x + 8, y + 4), name, fill=(20, 20, 20), font=font(15))
        img.paste(im, (x, y + 26))
    p = os.path.join(OUT, "modeles-poses.png")
    img.save(p)
    for _, q in shots:
        os.remove(q)
    print("PLANCHE", p)


# Lisibilité au zoom 1 ----------------------------------------------------------------------------------

def _lum(rgb):
    def f(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])


def _measure(with_path, without_path):
    """Pixels de la cueillette (différence avec le rendu sans elle), boîte englobante en pixels, luminance
    moyenne de la cueillette et du support derrière elle (mêmes pixels sans la cueillette), contraste."""
    from PIL import Image
    a = Image.open(with_path).convert("RGB")
    b = Image.open(without_path).convert("RGB")
    w, h = a.size
    pa, pb = a.load(), b.load()
    pts, la, lb = [], [], []
    for y in range(h):
        for x in range(w):
            ca, cb = pa[x, y], pb[x, y]
            if sum(abs(ca[i] - cb[i]) for i in range(3)) > 36:
                pts.append((x, y))
                la.append(_lum(ca))
                lb.append(_lum(cb))
    if not pts:
        return {"pixels": 0}
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    # on compare les 30 % les plus sombres ou les plus clairs selon le sens de l'écart (ce qui porte la lecture)
    mean_a, mean_b = sum(la) / len(la), sum(lb) / len(lb)
    darker = mean_a < mean_b
    sa = sorted(la, reverse=not darker)[: max(1, len(la) * 3 // 10)]
    va = sum(sa) / len(sa)
    hi, lo = max(va, mean_b), min(va, mean_b)
    return {"pixels": len(pts), "box_px": [max(xs) - min(xs) + 1, max(ys) - min(ys) + 1],
            "lum_fruit": round(mean_a, 3), "lum_support": round(mean_b, 3),
            "contraste_30pc": round((hi + 0.05) / (lo + 0.05), 2),
            "contraste_moyen": round((max(mean_a, mean_b) + 0.05) / (min(mean_a, mean_b) + 0.05), 2)}


def board_zoom1():
    """Au zoom 1 (57 px/m), 3 m x 2,25 m autour de la cueillette, de jour et au soleil couchant, en vue de jeu
    (azimut 45, élévation 35,26). Mesures sur l'image: taille à l'écran et contraste avec le support."""
    from PIL import Image, ImageDraw, ImageOps
    scene()
    cases = [("blackberry", "bramble", "berry_spots", "ete", "mûres sur le roncier (été)", 0.45),
             ("elderberry", "bush_elder", "berry_spots", "automne", "sureau sur bush_elder (automne)", 0.85),
             ("hazelnut", "bush_hazel", "nut_spots", "automne", "noisettes sous le noisetier (automne)", 0.3),
             ("cep", None, None, "automne", "cèpes au sol (automne)", 0.1)]
    lights = [("jour", (50, 0, 140), 3.0, (1.0, 0.95, 0.86), "#DCE6EE", 0.9),
              ("soir", (78, 0, 250), 2.2, (1.0, 0.72, 0.5), "#C9B9B0", 0.45)]
    shots, data = [], {}
    for item, host, key, season, title, tz in cases:
        set_season(season)
        for lname, rot, energy, col, sky, sky_s in lights:
            for az in (45, 225):
                clear()
                lpl.world(lpl.hex_lin(sky), sky_s)
                lpl.sun(rot, energy, col)
                gp = lpl.ground_plane(60, grass_lin(season))
                gp.hide_render = False
                placed = []
                if host:
                    hst = copy_of(host, (0, 0, 0))
                    placed.append(hst)
                    bpy.context.view_layer.update()
                    fruit = copy_of(item, spot_world(hst, key))
                else:
                    fruit = copy_of(item, (0, 0, 0))
                lpl.setup_render((171, 128), 24)
                lpl.iso_camera(target=(0, -0.1, tz), ortho=3.0, azimuth=az, elevation=35.264)
                pa = os.path.join(OUT, f"_z_{item}_{lname}_{az}_a.png")
                lpl.render(pa)
                for o in (fruit, *fruit.children_recursive):
                    o.hide_render = True
                pb = os.path.join(OUT, f"_z_{item}_{lname}_{az}_b.png")
                lpl.render(pb)
                m = _measure(pa, pb)
                data[f"{item}/{lname}/az{az}"] = m
                shots.append((f"{title}, {lname}, az {az}", pa, m))
                os.remove(pb)
                for o in placed + [fruit]:
                    for c in (o, *o.children_recursive):
                        bpy.data.objects.remove(c, do_unlink=True) if c.name in bpy.data.objects else None
                bpy.data.objects.remove(gp, do_unlink=True)
    set_season(None)
    big = [Image.open(p).convert("RGB").resize((171 * 3, 128 * 3), Image.NEAREST) for _, p, _ in shots]
    cols = 4
    cw, ch = 171 * 3 + 10, 128 * 3 * 2 + 70
    rows = (len(big) + cols - 1) // cols
    img = Image.new("RGB", (cw * cols + 10, ch * rows + 50), (245, 243, 238))
    d = ImageDraw.Draw(img)
    d.text((10, 10), "Zoom 1 (57 px/m, 3 m x 2,25 m), agrandi x 3 au plus proche; dessous: niveaux de gris. "
           "Mesures: boîte à l'écran (px) et contraste de luminance cueillette / support derrière elle",
           fill=(20, 20, 20), font=font(17))
    for i, ((title, _, m), b) in enumerate(zip(shots, big)):
        x, y = 10 + (i % cols) * cw, 45 + (i // cols) * ch
        d.text((x, y), title, fill=(20, 20, 20), font=font(14))
        box = m.get("box_px", [0, 0])
        d.text((x, y + 18), f"{box[0]} x {box[1]} px, contraste {m.get('contraste_30pc', 0)} (30 %), "
               f"{m.get('contraste_moyen', 0)} (moyen)", fill=(90, 30, 30), font=font(13))
        img.paste(b, (x, y + 38))
        img.paste(ImageOps.grayscale(b).convert("RGB"), (x, y + 38 + 128 * 3 + 4))
    p = os.path.join(OUT, "modeles-zoom1.png")
    img.save(p)
    for _, q, _ in shots:
        os.remove(q)
    with open(os.path.join(OUT, "modeles-zoom1.json"), "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print("PLANCHE", p)
    print(json.dumps(data, ensure_ascii=False))


def main():
    os.makedirs(OUT, exist_ok=True)
    if WHAT in ("echelle", "tout"):
        board_scale()
    if WHAT in ("maison", "tout"):
        board_house()
    if WHAT in ("poses", "tout"):
        board_posed()
    if WHAT in ("zoom1", "tout"):
        board_zoom1()


main()
