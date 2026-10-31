"""Train de La Petite Ligne: locomotive-tender à vapeur (030T), voiture de voyageurs, fourgon.

Lancer: duo-python train.py
Produit: assets/modeles/train.glb, planches/train.png

Exception assumée à la règle « avant vers +Z »: les véhicules sont alignés sur le module de
voie (rail_straight, selon X), l'avant de la locomotive vers +X. Origine au sol, au milieu
du véhicule, sur l'axe de la voie: les roues touchent le rail à 0,32 m (hauteur du rail).
Roues de 0,45 m de rayon partout: chaque animation `*_roll` fait un tour de roue en 1 s,
soit 2,83 m parcourus; timeScale = vitesse (m/s) / 2,83.
"""
import math
import os
import sys

import bpy  # noqa: I001
from bpy_extras import anim_utils

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402
from bourg import rail_straight, slab  # noqa: E402

RAIL_TOP = 0.32
WR = 0.45
AXLE_Z = RAIL_TOP + WR
FPS = 30


def wheelset(A, name, parent, x, spokes=True, color="loco_red"):
    g = A.geo()
    for s in (1, -1):
        y = s * 0.5
        g.cyl(WR, 0.1, loc=(0, y, 0), color="black", segs=16, rot=(90, 0, 0))
        g.cyl(WR - 0.07, 0.11, loc=(0, y, 0), color=color, segs=16, rot=(90, 0, 0))
        g.cyl(0.1, 0.13, loc=(0, y, 0), color="iron", segs=8, rot=(90, 0, 0))
        g.cyl(WR + 0.04, 0.03, loc=(0, y - s * 0.05, 0), color="iron", segs=16, rot=(90, 0, 0))
        if spokes:
            for k in range(4):
                g.box((0.05, 0.12, 2 * WR - 0.18), loc=(0, y + s * 0.005, 0), color="black", rot=(0, k * 45, 0))
    g.cyl(0.06, 1.0, loc=(0, 0, 0), color="iron", segs=6, rot=(90, 0, 0))
    return A.add(name, g, parent=parent, loc=(x, 0, AXLE_Z))


def buffers(g, x, s):
    """Traverse avant ou arrière: tampons et crochet. s = +1 avant (+X), -1 arrière."""
    g.box((0.16, 2.1, 0.32), loc=(x, 0, 1.05), color="loco_red")
    for y in (-0.62, 0.62):
        g.cyl(0.07, 0.34, loc=(x + s * 0.2, y, 1.05), color="iron", segs=6, rot=(0, 90, 0))
        g.cyl(0.17, 0.05, loc=(x + s * 0.38, y, 1.05), color="iron_light", segs=10, rot=(0, 90, 0))
    g.box((0.3, 0.08, 0.06), loc=(x + s * 0.2, 0, 1.0), color="iron")
    g.box((0.06, 0.12, 0.14), loc=(x + s * 0.34, 0, 0.98), color="iron")


def roll_animation(objs_rot, objs_rod, track):
    """Un tour de roue par seconde; bielles: translation sur le cercle du maneton."""
    n = FPS
    for ob in objs_rot:
        ob.rotation_mode = "XYZ"
        ad = ob.animation_data_create()
        act = bpy.data.actions.new(track + "_" + ob.name)
        ad.action = act
        for f in range(n + 1):
            ob.rotation_euler = (0, 2 * math.pi * f / n, 0)
            ob.keyframe_insert("rotation_euler", frame=f)
        _push(ob, act, track)
    for ob, phase in objs_rod:
        ad = ob.animation_data_create()
        act = bpy.data.actions.new(track + "_" + ob.name)
        ad.action = act
        x0, y0, z0 = ob.location
        for f in range(n + 1):
            a = 2 * math.pi * f / n + phase
            ob.location = (x0 + 0.2 * math.sin(a), y0, z0 + 0.2 * math.cos(a))
            ob.keyframe_insert("location", frame=f)
        ob.location = (x0, y0, z0)
        _push(ob, act, track)


def _push(ob, act, track):
    slot = ob.animation_data.action_slot
    for fc in anim_utils.action_get_channelbag_for_slot(act, slot).fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    tr = ob.animation_data.nla_tracks.new()
    tr.name = track
    tr.strips.new(track, 0, act)
    ob.animation_data.action = None


def locomotive(A):
    root = A.group("locomotive", {"length_over_buffers": 7.4, "front": "+x", "smoke_anchor": "locomotive_smoke"})
    g = A.geo()
    # châssis et traverses
    g.box((6.4, 1.7, 0.36), loc=(0, 0, 0.88), color="black", base=True)
    g.box((6.0, 1.95, 0.06), loc=(0, 0, 1.22), color="black", base=True)
    buffers(g, 3.25, 1)
    buffers(g, -3.25, -1)
    # chaudière, boîte à fumée, cheminée, dômes
    g.cyl(0.62, 3.4, loc=(1.0, 0, 1.92), color="loco_green", segs=14, rot=(0, 90, 0))
    for x in (-0.3, 0.8, 1.9):
        g.cyl(0.635, 0.06, loc=(x, 0, 1.92), color="brass", segs=14, rot=(0, 90, 0))
    g.cyl(0.66, 0.8, loc=(2.95, 0, 1.92), color="black", segs=14, rot=(0, 90, 0))
    g.cyl(0.56, 0.06, loc=(3.36, 0, 1.92), color="iron", segs=14, rot=(0, 90, 0))
    g.cyl(0.08, 0.08, loc=(3.4, 0, 1.92), color="brass", segs=8, rot=(0, 90, 0))
    g.lathe([(0.2, 0.0), (0.17, 0.5), (0.2, 0.75), (0.27, 0.9)], loc=(2.95, 0, 2.45), colors="black", segs=10)
    g.cyl(0.21, 0.04, loc=(2.95, 0, 3.33), color="brass", segs=10)
    g.lathe([(0.32, 0.0), (0.3, 0.2), (0.22, 0.4), (0.0, 0.48)], loc=(1.15, 0, 2.42), colors="brass", segs=10)
    g.lathe([(0.24, 0.0), (0.22, 0.15), (0.0, 0.3)], loc=(0.2, 0, 2.45), colors="loco_green", segs=8)
    g.cyl(0.04, 0.25, loc=(-0.1, 0.25, 2.62), color="brass", segs=6, base=True)
    # caisses à eau latérales
    for s in (1, -1):
        g.box((2.6, 0.42, 1.05), loc=(0.85, s * 0.78, 1.25), color="loco_green", base=True, bevel=0.03)
        g.box((2.62, 0.43, 0.06), loc=(0.85, s * 0.78, 2.27), color="black", base=True)
        g.box((0.7, 0.012, 0.3), loc=(0.85, s * 1.0, 1.7), color="brass")
        g.box((0.55, 0.014, 0.18), loc=(0.85, s * 1.003, 1.7), color="black")
        # cylindres et marchepieds
        g.cyl(0.24, 0.8, loc=(2.55, s * 0.92, 1.0), color="black", segs=10, rot=(0, 90, 0))
        g.box((0.3, 0.25, 0.04), loc=(-2.2, s * 1.05, 0.62), color="iron")
        g.box((0.04, 0.04, 0.5), loc=(-2.32, s * 1.05, 0.62), color="iron", base=True)
    # cabine et soute
    g.box((1.9, 2.2, 1.95), loc=(-2.25, 0, 1.24), color="loco_green", base=True, bevel=0.03)
    for s in (1, -1):
        g.box((0.7, 0.04, 0.9), loc=(-2.15, s * 1.1, 2.15), color="shadow")
        g.box((1.9, 2.22, 0.08), loc=(-2.25, 0, 1.75), color="loco_green_light", base=True)
        g.box((0.5, 0.01, 0.2), loc=(-2.25, s * 1.115, 1.5), color="brass")
    for y in (-0.55, 0.55):
        g.cyl(0.2, 0.05, loc=(-1.29, y, 2.55), color="brass", segs=10, rot=(0, 90, 0))
        g.cyl(0.16, 0.06, loc=(-1.29, y, 2.55), color="glass", segs=10, rot=(0, 90, 0))
    roof_curved(g, -3.35, -1.15, 2.5, 3.12, 0.22, "black", "black")
    g.box((0.9, 1.9, 0.8), loc=(-3.0, 0, 1.24), color="loco_green", base=True)
    g.box((0.8, 1.7, 0.2), loc=(-3.0, 0, 2.02), color="black", base=True)
    # lanternes, sifflet, plaque
    for y in (-0.7, 0.7):
        g.box((0.18, 0.2, 0.26), loc=(3.3, y, 1.45), color="black", base=True)
        g.cyl(0.07, 0.04, loc=(3.4, y, 1.57), color="glass_lamp", segs=8, rot=(0, 90, 0))
        g.box((0.18, 0.2, 0.26), loc=(-3.4, y, 1.45), color="black", base=True)
        g.cyl(0.07, 0.04, loc=(-3.5, y, 1.57), color="glass_lamp", segs=8, rot=(0, 90, 0))
    g.box((0.3, 0.012, 0.18), loc=(2.95, -0.63, 2.15), color="brass")
    A.add("locomotive_body", g, parent=root)
    wheels = [wheelset(A, f"locomotive_wheels_{i + 1}", root, x) for i, x in enumerate((-1.25, 0.25, 1.75))]
    rods = []
    for s, side, ph in ((1, "l", 0.0), (-1, "r", math.pi / 2)):
        r = A.geo()
        r.box((3.2, 0.05, 0.1), loc=(0, 0, 0), color="iron_light")
        for x in (-1.5, 0.0, 1.5):
            r.cyl(0.06, 0.08, loc=(x, 0, 0), color="iron", segs=6, rot=(90, 0, 0))
        ob = A.add("locomotive_rod_" + side, r, parent=root, loc=(0.25, s * 0.62, AXLE_Z + 0.2))
        rods.append((ob, ph))
    sm = lpl.empty("locomotive_smoke", parent=root, loc=(2.95, 0, 3.4))
    sm["note"] = "point d'émission du panache (technical artist)"
    roll_animation(wheels, rods, "locomotive_roll")
    return root


def roof_curved(g, x0, x1, w, z, rise, color, edge):
    """Toit bombé en trois pans."""
    pts = [(-w / 2, z), (-w / 4, z + rise * 0.75), (w / 4, z + rise * 0.75), (w / 2, z)]
    for (ya, za), (yb, zb) in zip(pts[:-1], pts[1:]):
        slab(g, [(x1, yb, zb), (x0, yb, zb), (x0, ya, za), (x1, ya, za)], 0.06, by_normal(color, edge, edge, thr=0.3))


def coach(A):
    root = A.group("coach", {"length_over_buffers": 9.0})
    g = A.geo()
    L = 7.0
    g.box((L + 1.2, 1.7, 0.3), loc=(0, 0, 0.9), color="black", base=True)
    g.box((L + 1.6, 2.3, 0.08), loc=(0, 0, 1.2), color="wood_dark", base=True)
    buffers(g, (L + 1.6) / 2 + 0.05, 1)
    buffers(g, -(L + 1.6) / 2 - 0.05, -1)
    # caisse bicolore
    g.box((L, 2.3, 0.95), loc=(0, 0, 1.28), color="coach_brown", base=True, bevel=0.02)
    g.box((L, 2.3, 0.85), loc=(0, 0, 2.23), color="coach_cream", base=True, bevel=0.02)
    g.box((L + 0.02, 2.32, 0.06), loc=(0, 0, 2.2), color="brass", base=True)
    for s in (1, -1):
        for k in range(6):
            x = -L / 2 + 0.75 + k * (L - 1.5) / 5
            g.box((0.62, 0.04, 0.55), loc=(x, s * 1.15, 2.33), color="glass", base=True)
            g.box((0.7, 0.03, 0.06), loc=(x, s * 1.16, 2.9), color="coach_brown", base=True)
        g.box((1.2, 0.03, 0.22), loc=(0, s * 1.165, 1.7), color="coach_cream")
        for k in range(3):
            g.box((0.12, 0.035, 0.14), loc=(-0.3 + k * 0.3, s * 1.17, 1.7), color="coach_brown")
    # plateformes d'extrémité avec garde-corps
    for s in (1, -1):
        x = s * (L / 2 + 0.4)
        g.box((0.8, 2.2, 0.06), loc=(x, 0, 1.28), color="wood", base=True)
        for y in (-1.05, 1.05):
            g.box((0.05, 0.05, 1.0), loc=(x + s * 0.35, y, 1.34), color="iron", base=True)
            g.box((0.7, 0.04, 0.04), loc=(x, y, 2.3), color="iron", base=True)
        g.box((0.04, 2.1, 0.04), loc=(x + s * 0.35, 0, 2.3), color="iron", base=True)
        g.box((0.04, 0.6, 0.04), loc=(x + s * 0.35, -0.75, 1.8), color="iron", base=True)
        g.box((0.04, 0.6, 0.04), loc=(x + s * 0.35, 0.75, 1.8), color="iron", base=True)
        g.box((0.06, 0.9, 1.75), loc=(s * L / 2 + s * 0.02, 0, 1.3), color="coach_brown", base=True)
        g.box((0.07, 0.5, 0.6), loc=(s * L / 2 + s * 0.03, 0, 2.3), color="glass", base=True)
        for y in (-0.95, 0.95):
            g.box((0.25, 0.3, 0.04), loc=(x, y * 1.12, 0.95), color="iron")
    roof_curved(g, -L / 2 - 0.85, L / 2 + 0.85, 2.5, 3.07, 0.35, "lauze_dark", "black")
    for x in (-2.0, 0.0, 2.0):
        g.cyl(0.1, 0.18, loc=(x, 0, 3.32), color="black", segs=6, base=True)
    A.add("coach_body", g, parent=root)
    wheels = [wheelset(A, f"coach_wheels_{i + 1}", root, x, spokes=False, color="black") for i, x in enumerate((-2.4, 2.4))]
    roll_animation(wheels, [], "coach_roll")
    return root


def van(A):
    root = A.group("van", {"length_over_buffers": 7.0, "door": "porte coulissante au milieu, côté -Z et +Z"})
    g = A.geo()
    L = 5.8
    g.box((L + 0.2, 1.7, 0.3), loc=(0, 0, 0.9), color="black", base=True)
    buffers(g, L / 2 + 0.15, 1)
    buffers(g, -L / 2 - 0.15, -1)
    g.box((L, 2.3, 1.75), loc=(0, 0, 1.22), color="van_wood", base=True, bevel=0.02)
    for s in (1, -1):
        n = 22
        for k in range(n):
            x = -L / 2 + 0.13 + k * (L - 0.26) / (n - 1)
            g.box((0.02, 0.02, 1.7), loc=(x, s * 1.155, 1.24), color="wood_dark", base=True)
        g.box((1.5, 0.05, 1.6), loc=(0.0, s * 1.17, 1.27), color="paint_red", base=True)
        g.box((1.6, 0.06, 0.06), loc=(0.0, s * 1.19, 2.88), color="iron", base=True)
        g.box((1.52, 0.06, 0.08), loc=(0.0, s * 1.19, 1.95), color="wood_dark", base=True, rot=(0, 46, 0))
        for x in (-L / 2 + 0.05, L / 2 - 0.05):
            g.box((0.08, 0.06, 1.75), loc=(x, s * 1.16, 1.22), color="iron", base=True)
        g.box((0.5, 0.01, 0.25), loc=(-1.9, s * 1.17, 2.5), color="paint_cream")
        g.box((0.35, 0.012, 0.1), loc=(-1.9, s * 1.175, 2.5), color="shadow")
    roof_curved(g, -L / 2 - 0.12, L / 2 + 0.12, 2.45, 2.97, 0.3, "lauze", "black")
    # vigie du garde-frein
    g.box((1.2, 1.5, 0.6), loc=(-1.9, 0, 3.15), color="van_wood", base=True)
    for s in (1, -1):
        g.box((0.7, 0.03, 0.3), loc=(-1.9, s * 0.76, 3.4), color="glass")
    g.box((1.4, 1.7, 0.06), loc=(-1.9, 0, 3.75), color="black", base=True)
    A.add("van_body", g, parent=root)
    wheels = [wheelset(A, f"van_wheels_{i + 1}", root, x, spokes=False, color="black") for i, x in enumerate((-1.8, 1.8))]
    roll_animation(wheels, [], "van_roll")
    return root


def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    roots = [locomotive(A), coach(A), van(A)]
    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "train.glb")
    size = lpl.export_glb(path, objs, animation_mode="NLA_TRACKS")
    st = A.stats()
    lpl.write_stats("train", {"nodes": st, "animations": ["locomotive_roll", "coach_roll", "van_roll"], "file_bytes": size})
    print("TRAIN", size, {k: v["tris"] for k, v in st.items()})
    # planche: le train sur sa voie, de trois quarts
    rail = rail_straight(A).to_object("rail_tmp", mat)
    rails = []
    for k in range(8):
        r = rail.copy()
        bpy.context.scene.collection.objects.link(r)
        r.location = (-14 + k * 4, 0, 0)
        rails.append(r)
    rail.hide_render = True
    x = 9.0
    lpl.setup_render((1800, 900), 24)
    lpl.world(lpl.hex_lin("#DCE6EE"), 0.9)
    lpl.sun((50, 0, 140), 3.0)
    lpl.ground_plane(200, lpl.hex_lin("#A7B98A"), z=-0.002)
    for r, off in zip(roots, (x - 3.7, x - 3.7 - 7.4 / 2 - 4.5 - 0.1, x - 3.7 - 3.7 - 9.0 - 3.5 - 0.2)):
        r.location = (off - 4.0, 0, 0)
    lpl.set_emission(mat, 0.0)
    bpy.context.scene.frame_set(7)
    lpl.persp_camera((6.0, -15.0, 6.5), (-3.0, 0, 1.4), lens=38)
    lpl.render(os.path.join(lpl.BOARDS, "train.png"))


if __name__ == "__main__":
    main()
