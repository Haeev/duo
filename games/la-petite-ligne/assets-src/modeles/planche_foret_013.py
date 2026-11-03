"""Planches de la forêt et des petits objets de la 0.13 (foret_013.py), rendues depuis les GLB exportés (Cycles).

Lancer: duo-python planche_foret_013.py <dossier de sortie> [arbres|objets|sousbois|cimetiere|bosquet|tout]
- arbres: chaque essence (et le chêne, le sapin, le bouleau du bourg pour comparer), un joueur de 1,74 m au pied;
- objets: les objets du bourg et de la campagne, chacun avec un joueur; vigne en trois tronçons bout à bout;
- sousbois: fougères, myrtilliers, houx, framboisier, champignons, branches mortes, avec un joueur;
- cimetiere: un angle du cimetière monté comme sur la carte (tronçons, angle, tombes, croix, fontaine), à la
  distance de la caméra du jeu, pour juger les raccords du mur;
- bosquet: un bosquet mêlé de toutes les essences et du sous-bois, à la caméra du jeu (zoom 1: 24 m sur
  1366 px, élévation 35,264 degrés, vue vers le nord-ouest), au printemps et à l'automne.
Les arbres sont posés sans rotation ni mise à l'échelle, comme le rendu les pose (objets de la carte).
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
SAMPLES = 10
FOREST_FLOOR = "#9C9460"


def scene():
    lpl.reset()
    for f in ("foret013.glb", "bourg.glb"):
        bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, f))
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    for o in bpy.data.objects:
        o.rotation_mode = "XYZ"
        if o.type in ("MESH", "EMPTY"):
            o.hide_render = True


def player_mesh():
    """Joueur de 1,74 m (personnages.glb) en pose de repos, figé en un seul maillage."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, "personnages.glb"))
    new = set(bpy.data.objects) - before
    rig = next(o for o in new if o.type == "ARMATURE")
    rig.data.pose_position = "REST"
    keep = {"player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"}
    dg = bpy.context.evaluated_depsgraph_get()
    parts = []
    for o in new:
        if o.type == "MESH" and o.name in keep:
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            me.transform(o.matrix_world)
            parts.append(me)
    import bmesh
    bm = bmesh.new()
    mats = []
    for me in parts:
        off = len(mats)
        for m in me.materials:
            mats.append(m)
        tmp = bmesh.new()
        tmp.from_mesh(me)
        for f in tmp.faces:
            f.material_index += off
        me2 = bpy.data.meshes.new("tmp")
        tmp.to_mesh(me2)
        bm.from_mesh(me2)
        tmp.free()
    me = bpy.data.meshes.new("player_static")
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new("player_static", me)
    bpy.context.scene.collection.objects.link(ob)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    for m in bpy.data.materials:
        if m.node_tree and m.node_tree.nodes.get("Principled BSDF"):
            lpl.set_emission(m, 0.0)
    ob.hide_render = True
    return ob


def copy_of(name, loc, yaw=0.0):
    src = bpy.data.objects[name]
    d = lpl.duplicate_tree(src)
    d.rotation_mode = "XYZ"
    d.location = loc
    d.rotation_euler = (0, 0, math.radians(yaw))
    for o in (d, *d.children_recursive):
        o.hide_render = False
    return d


def player_at(src, loc, yaw=-30.0):
    o = src.copy()
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, math.radians(yaw))
    o.hide_render = False
    return o


def clear_lights():
    for o in list(bpy.data.objects):
        if o.type in ("LIGHT", "CAMERA"):
            bpy.data.objects.remove(o, do_unlink=True)


def remove(objs):
    for d in objs:
        if d.name not in bpy.data.objects:
            continue
        for o in [*d.children_recursive, d]:
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.name.startswith(("etiquette_", "sol_rendu", "player_static.")):
            bpy.data.objects.remove(o, do_unlink=True)


def set_season(season):
    name = "palette.png" if season is None else f"palette-{season}.png"
    img = bpy.data.images.load(os.path.join(lpl.TEX_OUT, name), check_existing=True)
    for m in bpy.data.materials:
        if not m.name.startswith("lpl_palette") or not m.node_tree:
            continue
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        link = bsdf.inputs["Base Color"].links
        if link and link[0].from_node.type == "TEX_IMAGE":
            link[0].from_node.image = img


def light(ground_hex="#A7B98A"):
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    return lpl.ground_plane(400, lpl.hex_lin(ground_hex), z=0.0)


def frame_iso(objs, res, azimuth=45, elevation=35.264, margin=1.06):
    pts = []
    for d in objs:
        for o in [d, *d.children_recursive]:
            if o.type == "MESH":
                for c in o.bound_box:
                    pts.append(o.matrix_world @ Vector(c))
    cam = lpl.iso_camera((0, 0, 0), 10, azimuth, elevation)
    bpy.context.view_layer.update()
    mw = cam.matrix_world
    cr, cu, cf = mw.col[0].xyz, mw.col[1].xyz, mw.col[2].xyz
    sx = [p.dot(cr) for p in pts]
    sy = [p.dot(cu) for p in pts]
    w, h = max(sx) - min(sx), max(sy) - min(sy)
    center = cr * (max(sx) + min(sx)) / 2 + cu * (max(sy) + min(sy)) / 2
    cam.location = center + cf * 120
    cam.data.ortho_scale = max(w, h * res[0] / res[1]) * margin
    return cam


def row_board(items, path, res=(2400, 1200), spacing=None, label_size=0.32, cols=None):
    """items: [(nœud, largeur de la place, libellé)]; une rangée (ou plusieurs) le long de la droite de l'écran,
    un joueur au sud-est de chaque objet, le libellé devant."""
    player = player_mesh()
    gp = light()
    R = Vector((1, 1, 0)) / math.sqrt(2)
    D = Vector((1, -1, 0)) / math.sqrt(2)
    placed = []
    u = v = 0.0
    n = 0
    pitch = max(w for _, w, _ in items) + 1.5
    for name, w, text in items:
        if cols and n and n % cols == 0:
            u = 0.0
            v += pitch
        c = R * (u + w / 2) + D * v
        placed.append(copy_of(name, (c.x, c.y, 0)))
        fp = bpy.data.objects[name].get("footprint", [1, 1])
        pp = c + D * (max(fp[1] / 2, 0.5) + 0.5) + R * (min(w / 2 - 0.3, 0.9))
        placed.append(player_at(player, (pp.x, pp.y, 0)))
        lp = c + D * (max(fp[1] / 2, 0.5) + 1.25)
        lpl.label(text, (lp.x, lp.y, 0.01), size=label_size, rot=(0, 0, 45))
        u += w
        n += 1
    bpy.context.view_layer.update()
    lpl.setup_render(res, SAMPLES)
    frame_iso(placed, res)
    lpl.render(path)
    remove(placed)
    bpy.data.objects.remove(player, do_unlink=True)
    print("PLANCHE", path)


def board_trees():
    items = [("tree_beech", 5.4, "hêtre"), ("tree_chestnut", 5.6, "châtaignier"), ("tree_lime", 4.4, "tilleul"),
             ("tree_walnut", 5.6, "noyer"), ("tree_pear", 3.6, "poirier"), ("tree_plum", 3.8, "prunier"),
             ("tree_cherry", 4.0, "cerisier"), ("tree_old_oak", 8.8, "Vieux Chêne"), ("snag_tree", 2.4, "arbre mort"),
             ("tree_birch_large", 3.4, "bouleau (bourg)"), ("tree_oak_large", 4.4, "chêne (bourg)"),
             ("tree_fir_large", 4.0, "sapin (bourg)")]
    row_board(items, os.path.join(OUT, "foret013-arbres.png"), res=(2200, 1200), cols=6, label_size=0.38)


def board_objects():
    items = [("grave_a", 2.6, "grave_a"), ("grave_b", 2.6, "grave_b"), ("grave_c", 2.6, "grave_c"),
             ("grave_d", 2.6, "grave_d"), ("cemetery_cross", 2.0, "croix"), ("cemetery_tap", 2.0, "fontaine"),
             ("cemetery_wall", 1.8, "mur (1 m)"), ("cemetery_wall_corner", 1.8, "angle du mur"),
             ("crossing_sign", 2.0, "croix de Saint-André"), ("oratory", 2.0, "oratoire"),
             ("anvil", 1.8, "enclume"), ("hand_pump", 2.0, "pompe"), ("water_trough", 2.8, "abreuvoir"),
             ("manure_heap", 2.8, "fumier"), ("fallen_trunk", 3.6, "chablis"), ("postcard_rack", 1.8, "tourniquet"),
             ("cafe_table", 2.0, "table du café"), ("vine_row", 3.6, "vigne (3 m)")]
    row_board(items, os.path.join(OUT, "foret013-objets.png"), res=(2600, 1400), cols=6, label_size=0.22)


def board_undergrowth():
    items = [("fern", 1.6, "fougère"), ("fern_small", 1.4, "petite fougère"), ("bilberry_bush", 1.6, "myrtilliers"),
             ("holly_bush", 1.8, "houx"), ("raspberry_bush", 1.8, "framboisier"),
             ("mushroom_cluster", 1.2, "amanites (décor)"), ("black_trumpet", 1.2, "trompettes"),
             ("deadwood_branch", 1.8, "bois mort")]
    row_board(items, os.path.join(OUT, "foret013-sousbois.png"), res=(2400, 1000), label_size=0.14)


def board_cemetery():
    """Angle sud-ouest du cimetière tel que la carte le monte (repère de la carte: x vers l'est, y vers le sud;
    Blender: x, -y), à la caméra du jeu, avec l'angle proposé (cemetery_wall_corner, rotation 1)."""
    player = player_mesh()
    gp = light("#A3AE80")
    placed = []

    def at(name, cx, cy, rot=0, w=1, h=1):
        # centre d'emprise en coordonnées de la carte -> Blender; rotation par quarts (sens trigonométrique vu
        # du dessus en Three.js = sens trigonométrique autour de Z ici)
        d = copy_of(name, (cx, -cy, 0), yaw=90 * rot)
        placed.append(d)
        return d
    # angle en (0, 0): mur ouest vers le nord (y négatif), mur sud vers l'est
    at("cemetery_wall_corner", 0.5, 0.5, rot=1)
    for y in range(1, 7):
        at("cemetery_wall", 0.5, 0.5 - y, rot=1)
    for x in range(1, 9):
        at("cemetery_wall", 0.5 + x, 0.5, rot=0)
    names = ["grave_a", "grave_b", "grave_c", "grave_d", "grave_c", "grave_a", "grave_d", "grave_b"]
    k = 0
    for gx in (3.0, 6.0):
        for gy in (-1.5, -2.5, -3.5, -4.5):
            at(names[k % len(names)], gx, gy)
            k += 1
    at("cemetery_cross", 8.5, -5.5)
    at("cemetery_tap", 8.5, -0.5)
    placed.append(player_at(player, (4.6, 2.0, 0), yaw=-20))
    placed.append(player_at(player, (7.4, 3.2, 0), yaw=200))
    lpl.setup_render((1366, 768), SAMPLES)
    cam = lpl.iso_camera((5.0, 2.5, 0.5), 12.0)
    lpl.render(os.path.join(OUT, "foret013-cimetiere.png"))
    bpy.data.objects.remove(cam, do_unlink=True)
    # vue rapprochée de l'angle (raccord des tronçons)
    lpl.setup_render((1200, 900), SAMPLES)
    lpl.iso_camera((1.2, -1.0, 0.6), 3.6, azimuth=45, elevation=30)
    lpl.render(os.path.join(OUT, "foret013-cimetiere-angle.png"))
    clear_lights()
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.iso_camera((1.2, -1.0, 0.6), 3.6, azimuth=225, elevation=30)
    lpl.render(os.path.join(OUT, "foret013-cimetiere-angle-dos.png"))
    remove(placed)
    bpy.data.objects.remove(player, do_unlink=True)
    print("PLANCHE cimetiere")


GROVE = [
    ("tree_beech", -8.5, -6.0), ("tree_beech", -4.0, -8.0), ("tree_chestnut", 0.5, -7.0), ("tree_fir_large", 5.0, -8.5),
    ("tree_lime", 9.0, -6.5), ("tree_beech", -10.5, -1.5), ("tree_chestnut", -6.0, -2.5), ("tree_oak_large", -1.5, -3.0),
    ("tree_old_oak", 4.5, -2.0), ("tree_walnut", 10.5, -1.5), ("tree_birch_large", -9.0, 3.0),
    ("tree_cherry", -4.5, 2.5), ("tree_birch_small", -0.5, 1.0), ("tree_pear", 9.0, 3.5), ("tree_plum", 12.0, 0.8),
    ("snag_tree", -1.0, 5.0), ("tree_fir_small", -12.5, -5.5), ("tree_chestnut", 13.0, -6.0),
]
UNDER = [
    ("fern", -7.0, 0.5), ("fern_small", -6.2, 1.2), ("fern", -2.8, -0.2), ("fern", 1.8, 2.8), ("fern_small", 2.6, 3.4),
    ("bilberry_bush", -11.0, -3.6), ("bilberry_bush", -10.0, -3.0), ("holly_bush", 7.0, 2.0), ("holly_bush", 8.2, 0.2),
    ("raspberry_bush", -3.0, 4.6), ("mushroom_cluster", 1.0, -0.6), ("deadwood_branch", -6.8, 4.6),
    ("fallen_trunk", 3.0, 5.6), ("black_trumpet", 6.5, 4.5), ("fern", 11.0, 5.0), ("fern_small", -9.5, 6.0),
]


def board_grove():
    player = player_mesh()
    placed = []
    for name, x, y in GROVE + UNDER:
        placed.append(copy_of(name, (x, y, 0)))
    placed.append(player_at(player, (0.8, 3.2, 0), yaw=-30))
    placed.append(player_at(player, (6.0, 3.0, 0), yaw=200))
    bpy.context.view_layer.update()
    res = (1366, 768)
    for season, tag in ((None, "printemps"), ("automne", "automne")):
        set_season(season)
        gp = light(FOREST_FLOOR)
        lpl.setup_render(res, SAMPLES)
        # zoom 1 du jeu: 24 m de large sur 1366 px (57 px/m), centré sur le bosquet
        cam = frame_iso(placed, res)
        cam.data.ortho_scale = 24.0
        lpl.render(os.path.join(OUT, f"foret013-bosquet-{tag}.png"))
        bpy.data.objects.remove(gp, do_unlink=True)
    set_season(None)
    gp = light(FOREST_FLOOR)
    cam = frame_iso(placed, res, azimuth=225)
    cam.data.ortho_scale = 24.0
    lpl.render(os.path.join(OUT, "foret013-bosquet-nord-ouest.png"))
    bpy.data.objects.remove(gp, do_unlink=True)
    remove(placed)
    bpy.data.objects.remove(player, do_unlink=True)
    print("PLANCHE bosquet")


def main():
    os.makedirs(OUT, exist_ok=True)
    scene()
    if WHAT in ("arbres", "tout"):
        board_trees()
    if WHAT in ("objets", "tout"):
        board_objects()
    if WHAT in ("sousbois", "tout"):
        board_undergrowth()
    if WHAT in ("cimetiere", "tout"):
        board_cemetery()
    if WHAT in ("bosquet", "tout"):
        board_grove()


if __name__ == "__main__":
    main()
