"""Planche d'ensemble: un coin du bourg assemblé à partir des GLB livrés (vue isométrique).

Lancer après les autres scripts: duo-python scene_bourg.py
Produit: planches/scene-bourg-jour.png, planches/scene-bourg-nuit.png

Tout vient des fichiers exportés (relus par l'importeur glTF de Blender): la scène
vérifie au passage que les GLB se rechargent, avec matériaux, squelette et animations.
"""
import math
import os
import sys

import bpy  # noqa: I001

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import palette as P  # noqa: E402

SRC = {}


def load(name):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(lpl.OUT, name + ".glb"))
    new = set(bpy.data.objects) - before
    for ob in new:
        SRC[ob.name] = ob
        ob.hide_render = True
        ob.hide_viewport = True
    return new


def put(name, x, y, rz=0.0, z=0.0, scale=1.0):
    src = SRC[name]
    d = lpl.duplicate_tree(src)
    d.location = (x, y, z)
    d.rotation_mode = "XYZ"
    d.rotation_euler = (0, 0, math.radians(rz))
    d.scale = (scale,) * 3
    for o in [d] + list(d.children_recursive):
        o.hide_render = False
        o.hide_viewport = False
    return d


def row_material(base, row):
    """Copie du matériau des personnages qui lit une autre rangée (joueur B)."""
    r = P.CHAR_ROW_ORDER.index(row)
    m = base.copy()
    nt = m.node_tree
    tex = [n for n in nt.nodes if n.type == "TEX_IMAGE"][0]
    uv = nt.nodes.new("ShaderNodeUVMap")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0, -r / P.GRID, 0)
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    return m


def character(parts, x, y, rz, action, frame, mat=None, expr=None, tool=None, scale=1.0):
    rig = SRC["rig"]
    r2 = rig.copy()
    r2.animation_data_clear()
    bpy.context.scene.collection.objects.link(r2)
    r2.hide_render = r2.hide_viewport = False
    r2.location = (x, y, 0)
    r2.rotation_mode = "XYZ"
    r2.rotation_euler = (0, 0, math.radians(rz))
    r2.scale = (scale,) * 3
    for p in parts:
        src = SRC[p]
        o = src.copy()
        o.data = src.data.copy()
        bpy.context.scene.collection.objects.link(o)
        o.hide_render = o.hide_viewport = False
        o.parent = r2
        for md in o.modifiers:
            if md.type == "ARMATURE":
                md.object = r2
        if mat:
            o.data.materials[0] = mat
        if expr and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 1.0 if kb.name == expr else 0.0
    act = bpy.data.actions.get(action)
    ad = r2.animation_data_create()
    tr = ad.nla_tracks.new()
    st = tr.strips.new(action, int(300 - frame), act)
    st.action_slot = act.slots[0]
    if tool:
        sock = SRC["socket_hand_r"]
        t = SRC[tool].copy()
        bpy.context.scene.collection.objects.link(t)
        t.hide_render = t.hide_viewport = False
        t.parent = r2
        t.parent_type = "BONE"
        t.parent_bone = sock.parent_bone
        t.matrix_parent_inverse.identity()
        t.rotation_mode = sock.rotation_mode
        t.location = sock.location
        t.rotation_quaternion = sock.rotation_quaternion
        t.rotation_euler = sock.rotation_euler
        t.scale = (1, 1, 1)
    return r2


def build():
    lpl.reset()
    for n in ("bourg", "ferme", "maison", "personnages"):
        load(n)
    # la maisonnette réparée, son potager, le poulailler
    put("gatekeeper_house_repaired", 0, 0)
    for k in range(6):
        put("ground_dirt", -1.0, -3.5 - k)
    for k in range(5):
        put("ground_dirt", -2.0 - k, -8.5)
    crops = {
        (0, 0): ("garden_cell_tilled_wet", "radish_stage_ripe"), (1, 0): ("garden_cell_tilled_wet", "radish_stage_ripe"),
        (2, 0): ("garden_cell_tilled_wet", "radish_stage_young"), (3, 0): ("garden_cell_tilled", "radish_stage_sprout"),
        (0, 1): ("garden_cell_tilled_wet", "lettuce_stage_ripe"), (1, 1): ("garden_cell_tilled_wet", "lettuce_stage_young"),
        (2, 1): ("garden_cell_tilled", "carrot_stage_young"), (3, 1): ("garden_cell_tilled", "carrot_stage_sprout"),
        (0, 2): ("garden_cell_tilled", "carrot_stage_seed"), (1, 2): ("garden_cell_tilled", None),
        (2, 2): ("garden_cell_grass", None), (3, 2): ("garden_cell_grass", None),
    }
    for (i, j), (cell, crop) in crops.items():
        x, y = -5.5 + i, -4.5 - j
        put(cell, x, y)
        if crop:
            put(crop, x, y)
    for k in range(3):
        put("fence_picket", -6.2, -4.5 - k, 90)
    put("fence_post", -6.2, -7.0)
    put("henhouse_repaired", 3.5, -5.5)
    for v, (x, y, rz) in zip(("hen_white", "hen_red", "hen_black"), ((2.6, -6.4, 30), (3.9, -6.6, -60), (4.3, -5.9, 160))):
        h = SRC["hen"].copy()
        bpy.context.scene.collection.objects.link(h)
        h.hide_render = h.hide_viewport = False
        h.location = (x, y, 0)
        h.rotation_mode = "XYZ"
        h.rotation_euler = (0, 0, math.radians(rz))
        m = SRC[v].copy()
        bpy.context.scene.collection.objects.link(m)
        m.hide_render = m.hide_viewport = False
        m.parent = h
        for md in m.modifiers:
            if md.type == "ARMATURE":
                md.object = h
        act = bpy.data.actions.get("hen_peck" if v == "hen_red" else "hen_idle")
        ad = h.animation_data_create()
        st = ad.nla_tracks.new().strips.new(act.name, 300 - 10, act)
        st.action_slot = act.slots[0]
    put("hen_feeder", 2.9, -5.0, 90)
    put("water_barrel", 3.4, -2.0)
    put("bench", 1.3, -3.6, 0)
    put("lamp_post", -2.4, -3.6)
    put("mailbox", 3.4, -3.4)
    # la voie et le passage à niveau, derrière la maison
    for k in range(9):
        put("rail_straight", -18 + k * 4, 5.0)
    put("level_crossing_gate", -9.6, 3.6, 0)
    for k in range(1, 6):
        put("ground_dirt", -11.0, 2.5 - k * 1.0)
    # nature
    put("tree_oak_large", -9.5, -3.0, 20)
    put("tree_birch_large", 7.5, 1.0, 0)
    put("tree_fir_large", -8.5, 8.5, 10)
    put("tree_fir_small", 6.5, 8.0, 40)
    put("tree_oak_small", 9.5, -3.5, 70)
    put("bush_round", -4.0, 3.3, 0)
    put("bush_hazel", 5.5, -1.0, 0)
    put("bush_bramble", -8.0, -8.0, 30)
    put("rock_medium", 6.5, -9.5, 0)
    put("grass_tall", -3.5, -9.6, 0)
    put("grass_tall", 1.0, -9.0, 0)
    put("flowers_yellow", 0.8, -2.6, 0)
    put("flowers_red", -6.5, -3.4, 0)
    put("flowers_white", 5.2, -8.6, 0)
    put("flowers_blue", -7.0, -6.0, 0)
    put("woodpile", -4.6, 1.5, 90)
    put("tree_stump", -7.5, 0.5, 0)
    put("log", -6.8, 1.1, 30)
    # les personnages: A bêche, B arrose, Jeanne regarde les poules
    base_mat = bpy.data.materials["lpl_characters"]
    character(["player_base", "player_outfit_work", "player_hair_short", "player_scarf_orb"], -1.6, -6.5, -90, "hoe", 16,
              expr="happy", tool="hoe")
    character(["player_base", "player_outfit_smock", "player_hair_bun", "player_scarf_crescent"], -3.5, -7.7, 180, "water",
              20, mat=row_material(base_mat, "player_b"), tool="watering_can", expr="neutral")
    character(["villager_jeanne"], 2.0, -7.8, -150, "talk", 10, expr="delighted", scale=0.75)
    bpy.context.scene.frame_set(300)


def render_views():
    sc = lpl.setup_render((1800, 1000), 32)
    lpl.ground_plane(400, lpl.hex_lin(P.WORLD[0][1]), z=-0.001)
    pal = [m for m in bpy.data.materials if m.name.startswith("lpl_palette")]
    # jour: matin de printemps (soleil bas à l'est, ciel doux)
    w = lpl.world(lpl.hex_lin("#D9E6F0"), 0.85)
    s = lpl.sun((52, 0, 118), 3.4, color=(1.0, 0.93, 0.82), angle=3.0)
    for m in pal:
        lpl.set_emission(m, 0.0)
    lpl.iso_camera((-1.5, -2.5, 0.5), ortho=23.0, azimuth=45, elevation=33)
    lpl.render(os.path.join(lpl.BOARDS, "scene-bourg-jour.png"))
    # nuit: lune froide, fenêtres et lampadaire allumés (émission de la palette)
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*lpl.hex_lin("#1E2A44"), 1)
    bg.inputs["Strength"].default_value = 0.35
    s.data.energy = 0.35
    s.data.color = (0.62, 0.72, 1.0)
    for m in pal:
        lpl.set_emission(m, 4.0)
    pt = bpy.data.lights.new("lampadaire", "POINT")
    pt.energy = 120
    pt.color = (1.0, 0.75, 0.42)
    ob = bpy.data.objects.new("lampadaire", pt)
    sc.collection.objects.link(ob)
    ob.location = (-2.4, -3.6, 2.85)
    lpl.render(os.path.join(lpl.BOARDS, "scene-bourg-nuit.png"))


if __name__ == "__main__":
    build()
    render_views()
