"""Ferme et objets tenus de La Petite Ligne: cases du potager, cultures, récoltes, outils, poule.

Lancer: duo-python ferme.py
Produit: assets/modeles/ferme.glb, planches/ferme.png

Conventions propres à ce fichier:
- cases et cultures: origine au centre de la case (1 x 1 m), au sol; une culture se pose
  sur la case bêchée, à la même origine;
- petits objets (récoltes, sachets, matériaux): origine au centre de leur base, à l'échelle
  de jeu (un peu grossis pour rester lisibles en vue isométrique);
- outils: origine au point de prise, l'outil pend comme dans une main au repos
  (le jeu l'accroche au nœud socket_hand_r du squelette, sans transformation).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402

RIDGES = (-0.29, 0.0, 0.29)
RIDGE_TOP = 0.10
SPOTS = [(-0.26, -0.29), (0.0, 0.0), (0.26, 0.29)]
CROP_COLORS = {"radish": "radish", "lettuce": "lettuce", "carrot": "carrot"}


# Potager -------------------------------------------------------------------

def garden_cell_grass(A):
    g = A.geo()
    g.box((0.98, 0.98, 0.025), color=by_normal("grass", "grass_dark"), base=True, bevel=0.01)
    for i, (x, y) in enumerate([(-0.3, -0.25), (0.28, -0.05), (-0.05, 0.3), (0.32, 0.33), (-0.34, 0.12)]):
        for k in range(3):
            a = math.radians(k * 120 + i * 37)
            g.cyl(0.022, 0.07 + 0.02 * (k % 2), loc=(x + 0.02 * math.cos(a), y + 0.02 * math.sin(a), 0.02),
                  color="grass_dark" if k % 2 else "moss", segs=4, r2=0.0, base=True, rot=(12 * math.cos(a), 12 * math.sin(a), 0))
    return g


def garden_cell_tilled(A, wet=False):
    g = A.geo()
    top, side = ("soil_wet_light", "soil_wet") if wet else ("soil_tilled_light", "soil_tilled")
    g.box((0.92, 0.92, 0.05), color=side, base=True, bevel=0.02)
    for y in RIDGES:
        g.prism([(-0.12, 0.0), (0.12, 0.0), (0.06, 0.055), (-0.06, 0.055)], 0.84, loc=(0, y, 0.045),
                color=by_normal(top, side, thr=0.8), rot=(0, 0, 90))
    for x, y in [(-0.2, -0.145), (0.18, 0.145), (0.3, -0.15)]:
        g.box((0.05, 0.018, 0.012), loc=(x, y, 0.047), color="soil_tilled_light" if not wet else "soil_wet",
              rot=(0, 0, 20))
    if wet:
        for x, y, s in [(-0.15, 0.145, 0.16), (0.22, -0.145, 0.12), (-0.33, -0.145, 0.08)]:
            g.cyl(s / 2, 0.004, loc=(x, y, 0.052), color="water", segs=8, scale=(1.0, 0.35, 1.0))
    return g


def stake(g, crop):
    g.box((0.02, 0.02, 0.22), loc=(0.38, -0.38, 0.0), color="wood", base=True)
    g.box((0.07, 0.012, 0.05), loc=(0.38, -0.392, 0.17), color="paper", rot=(0, 0, 0))
    g.box((0.05, 0.004, 0.03), loc=(0.38, -0.4, 0.17), color=CROP_COLORS[crop])


def leaf(g, base, length, width, yaw, pitch, color, thick=0.006):
    pts = [(0.0, 0.0), (length * 0.35, width / 2), (length, 0.0), (length * 0.35, -width / 2)]
    return g.prism(pts, thick, loc=base, color=color, rot=(90, -pitch, yaw))


def crop_model(A, crop, stage):
    g = A.geo()
    z = RIDGE_TOP - 0.008
    spots = [(0.0, 0.0)] if crop == "lettuce" else SPOTS
    if stage in ("seed", "sprout"):
        stake(g, crop)
    for si, (x, y) in enumerate(spots):
        rot0 = si * 47
        if stage == "seed":
            g.cyl(0.045, 0.012, loc=(x, y, z), color="soil_tilled", segs=7, scale=(1, 0.8, 1))
            for k in range(3):
                a = math.radians(rot0 + k * 120)
                g.box((0.014, 0.01, 0.01), loc=(x + 0.02 * math.cos(a), y + 0.02 * math.sin(a), z + 0.01),
                      color="seed", rot=(0, 0, rot0 + k * 50))
        elif stage == "sprout":
            g.cyl(0.006, 0.05, loc=(x, y, z), color="sprout", segs=4, base=True)
            n = 2 if crop != "carrot" else 3
            for k in range(n):
                leaf(g, (x, y, z + 0.045), 0.05, 0.03, rot0 + k * 360 / n, 25, "sprout")
        elif stage == "young":
            if crop == "radish":
                for k in range(4):
                    leaf(g, (x, y, z + 0.005), 0.11, 0.06, rot0 + k * 90, 35, "leaf_crop")
            elif crop == "carrot":
                for k in range(5):
                    leaf(g, (x, y, z + 0.005), 0.14, 0.025, rot0 + k * 72, 62, "leaf_carrot")
            else:
                for k in range(5):
                    leaf(g, (x, y, z + 0.005), 0.13, 0.09, rot0 + k * 72, 30, "lettuce")
                g.sphere(0.04, loc=(x, y, z + 0.03), color="lettuce_light", segs=6, rings=4)
        elif stage == "ripe":
            if crop == "radish":
                g.sphere(0.045, loc=(x, y, z + 0.02), color="radish", segs=8, rings=5, scale=(1, 1, 0.9))
                for k in range(6):
                    leaf(g, (x, y, z + 0.05), 0.17, 0.08, rot0 + k * 60, 40, "leaf_crop" if k % 2 else "leaf_crop_light")
            elif crop == "carrot":
                g.cyl(0.038, 0.035, loc=(x, y, z - 0.004), color="carrot", segs=8, base=True, r2=0.03)
                for k in range(7):
                    leaf(g, (x, y, z + 0.03), 0.24, 0.03, rot0 + k * 51, 66 - (k % 2) * 14, "leaf_carrot")
            else:
                g.sphere(0.13, loc=(x, y, z + 0.08), color="lettuce_light", segs=9, rings=6, scale=(1, 1, 0.8))
                for k in range(7):
                    leaf(g, (x, y, z + 0.02), 0.2, 0.17, rot0 + k * 51.4, 48, "lettuce", thick=0.01)
                for k in range(8):
                    leaf(g, (x, y, z + 0.01), 0.25, 0.17, rot0 + 22 + k * 45, 18, "leaf_crop", thick=0.01)
    return g


# Récoltes et cueillette -------------------------------------------------------

def item_radish(A):
    g = A.geo()
    g.sphere(0.05, loc=(0, 0, 0.05), color="radish", segs=8, rings=6, scale=(1, 1, 0.95))
    g.cyl(0.012, 0.06, loc=(0, 0, 0.0), color="radish_tip", segs=5, r2=0.002, rot=(180, 0, 0), base=False)
    for k in range(3):
        leaf(g, (0, 0, 0.09), 0.13, 0.06, k * 120, 60, "leaf_crop")
    return g


def item_carrot(A):
    g = A.geo()
    g.cyl(0.035, 0.24, loc=(0.0, 0, 0.035), color="carrot", segs=8, r2=0.006, rot=(0, 90, 0))
    for k in range(4):
        leaf(g, (-0.12, 0, 0.035), 0.12, 0.03, 180 + (k - 1.5) * 18, 20, "leaf_carrot")
    return g


def item_lettuce(A):
    g = A.geo()
    g.sphere(0.1, loc=(0, 0, 0.09), color="lettuce_light", segs=9, rings=6, scale=(1, 1, 0.85))
    for k in range(7):
        leaf(g, (0, 0, 0.02), 0.15, 0.14, k * 51.4, 55, "lettuce", thick=0.01)
    return g


def item_egg(A):
    g = A.geo()
    g.sphere(0.035, loc=(0, 0, 0.043), color="egg", segs=8, rings=6, scale=(1, 1, 1.25))
    return g


def dandelion(A):
    g = A.geo()
    for k in range(7):
        leaf(g, (0, 0, 0.005), 0.14, 0.045, k * 51.4, 14, "leaf_bush" if k % 2 else "leaf_hazel")
    for h, dx, open_ in ((0.17, 0.02, True), (0.12, -0.04, False)):
        g.cyl(0.005, h, loc=(dx, 0.01, 0.0), color="leaf_crop", segs=4, base=True)
        if open_:
            g.cyl(0.035, 0.02, loc=(dx, 0.01, h), color="flower_yellow", segs=10, r2=0.028)
            g.cyl(0.015, 0.008, loc=(dx, 0.01, h + 0.012), color="flower_center", segs=6)
        else:
            g.sphere(0.018, loc=(dx, 0.01, h + 0.01), color="leaf_crop", segs=6, rings=4, scale=(1, 1, 1.3))
    return g


def seed_packet(A, crop):
    g = A.geo()
    g.box((0.11, 0.018, 0.15), color="paper", base=True, bevel=0.004)
    g.box((0.112, 0.02, 0.035), loc=(0, 0, 0.115), color=CROP_COLORS[crop], base=True)
    g.box((0.112, 0.02, 0.012), loc=(0, 0, 0.0), color="paper_dark", base=True)
    pic = {"radish": "radish", "lettuce": "lettuce", "carrot": "carrot"}[crop]
    g.cyl(0.03, 0.004, loc=(0, -0.011, 0.065), color=pic, segs=10, rot=(90, 0, 0))
    g.box((0.01, 0.004, 0.025), loc=(0, -0.012, 0.1), color="leaf_crop", rot=(0, 0, 0))
    return g


# Outils (origine = prise) -------------------------------------------------------

def tool_hoe(A):
    g = A.geo()
    g.cyl(0.018, 1.25, loc=(0, 0, 0.25 - 0.625), color="wood", segs=6)
    g.cyl(0.024, 0.06, loc=(0, 0, -0.95), color="iron", segs=6)
    g.box((0.03, 0.08, 0.025), loc=(0, 0.04, -0.965), color="iron")
    g.box((0.17, 0.11, 0.012), loc=(0, 0.11, -0.985), color=by_normal("iron_light", "iron"), rot=(-12, 0, 0),
          bevel=0.003)
    return g


def tool_watering_can(A):
    g = A.geo()
    g.cyl(0.11, 0.20, loc=(0, 0.02, -0.32), color="tin_paint", segs=10, base=True)
    g.cyl(0.113, 0.02, loc=(0, 0.02, -0.32), color="tin", segs=10, base=True)
    g.cyl(0.113, 0.02, loc=(0, 0.02, -0.14), color="tin", segs=10, base=True)
    g.cyl(0.05, 0.02, loc=(0, 0.06, -0.12), color="tin", segs=8, base=True)
    g.box((0.025, 0.16, 0.022), loc=(0, 0.02, 0.0), color="tin_paint")
    for y in (-0.06, 0.1):
        g.box((0.022, 0.022, 0.14), loc=(0, y, -0.07), color="tin_paint")
    g.cyl(0.016, 0.3, loc=(0, -0.17, -0.22), color="tin_paint", segs=6, r2=0.012, rot=(-50, 0, 0))
    g.cyl(0.018, 0.04, loc=(0, -0.29, -0.12), color="tin", segs=7, r2=0.04, rot=(-50, 0, 0))
    return g


def tool_axe(A):
    g = A.geo()
    g.cyl(0.02, 0.72, loc=(0, 0, 0.08 - 0.36), color="wood", segs=6, r2=0.017)
    g.box((0.035, 0.11, 0.08), loc=(0, -0.02, -0.6), color="iron", bevel=0.005)
    g.box((0.03, 0.06, 0.12), loc=(0, -0.09, -0.6), color="iron", taper=(0.6, 1.0))
    g.box((0.012, 0.012, 0.13), loc=(0, -0.122, -0.6), color="iron_light")
    return g


def tool_saw(A):
    g = A.geo()
    g.box((0.03, 0.11, 0.13), loc=(0, 0.0, -0.02), color="wood", bevel=0.012)
    g.box((0.034, 0.05, 0.06), loc=(0, 0.0, -0.01), color="wood_dark")
    g.prism([(-0.065, -0.07), (0.055, -0.07), (0.03, -0.6), (-0.035, -0.6)], 0.004, loc=(0, 0, 0),
            color="tin", rot=(0, 0, 90))
    for k in range(9):
        z = -0.1 - k * 0.055
        g.box((0.004, 0.012, 0.012), loc=(0, -0.066 + k * 0.003, z), color="iron", rot=(45, 0, 0))
    return g


def tool_hammer(A):
    g = A.geo()
    g.cyl(0.015, 0.36, loc=(0, 0, 0.05 - 0.18), color="wood", segs=6)
    g.box((0.04, 0.13, 0.04), loc=(0, -0.01, -0.31), color="iron", bevel=0.006)
    g.cyl(0.024, 0.02, loc=(0, -0.08, -0.31), color="iron_light", segs=8, rot=(90, 0, 0))
    return g


def tool_fishing_rod(A):
    g = A.geo()
    a = math.radians(42)
    L = 2.0
    d = Vector((0, -math.cos(a), math.sin(a)))
    g.cyl(0.02, 0.32, loc=tuple(d * 0.05), color="cobble_dark", segs=6, rot=(-(90 - 42), 0, 0))
    mid = d * (L / 2)
    g.cyl(0.012, L, loc=tuple(mid), color="wood_new", segs=5, r2=0.004, rot=(-(90 - 42), 0, 0))
    g.cyl(0.03, 0.025, loc=(0.03, -0.06, -0.02), color="iron", segs=8, rot=(0, 90, 0))
    tip = d * L
    g.box((0.003, 0.003, 0.9), loc=(tip.x, tip.y, tip.z - 0.45), color="white_paint")
    g.sphere(0.022, loc=(tip.x, tip.y, tip.z - 0.92), color="flower_red", segs=6, rings=4)
    g.cyl(0.02, 0.012, loc=(tip.x, tip.y, tip.z - 0.905), color="white_paint", segs=6)
    return g


# Matériaux ------------------------------------------------------------------

def item_log(A, length=0.8, r=0.14):
    g = A.geo()
    g.cyl(r, length, loc=(0, 0, r), color="bark", segs=8, rot=(0, 90, 0), bevel=0.01)
    for s in (1, -1):
        g.cyl(r * 0.82, 0.012, loc=(s * length / 2, 0, r), color="log_end", segs=8, rot=(0, 90, 0))
        g.cyl(r * 0.45, 0.016, loc=(s * length / 2, 0, r), color="log_ring", segs=8, rot=(0, 90, 0))
    g.box((0.08, 0.05, 0.05), loc=(0.12, -r * 0.8, r * 1.4), color="bark_dark", rot=(0, 0, 0))
    return g


def item_plank(A):
    g = A.geo()
    g.box((1.0, 0.18, 0.03), color="wood_new", base=True, bevel=0.006)
    for x in (-0.25, 0.18):
        g.box((0.3, 0.006, 0.002), loc=(x, -0.03, 0.03), color="wood")
    return g


def item_beam(A):
    g = A.geo()
    g.box((0.16, 4.5, 0.16), color="wood", base=True, bevel=0.015)
    for s in (1, -1):
        g.box((0.13, 0.006, 0.13), loc=(0, s * 2.25, 0.08), color="log_end")
    for y in (-1.2, 0.4, 1.6):
        g.box((0.004, 0.5, 0.004), loc=(0.081, y, 0.1), color="wood_dark")
    return g


def item_nail_box(A):
    g = A.geo()
    g.box((0.14, 0.09, 0.05), color="wood_new", base=True, bevel=0.004)
    g.box((0.12, 0.07, 0.01), loc=(0, 0, 0.042), color="shadow", base=True)
    for k in range(9):
        x, y = -0.045 + (k % 3) * 0.045, -0.02 + (k // 3) * 0.02
        g.cyl(0.004, 0.035, loc=(x, y, 0.045), color="iron_light", segs=4, base=True, rot=(8 * (k % 2), 10, 0))
        g.cyl(0.009, 0.004, loc=(x, y, 0.08), color="iron_light", segs=6)
    g.box((0.07, 0.003, 0.025), loc=(0, -0.046, 0.025), color="paper")
    return g


# Poissons ---------------------------------------------------------------------

def fish(A, kind):
    g = A.geo()
    L, H, W, back, side, spots = {"gudgeon": (0.14, 0.035, 0.03, "fish_back", "fish_silver", "rock_dark"),
                                  "chub": (0.3, 0.075, 0.055, "fish_back", "fish_silver", None),
                                  "trout": (0.32, 0.075, 0.05, "fish_olive", "fish_belly", "trout_spot")}[kind]
    zc = H / 2 + 0.005
    col = lpl.by_height([(zc - H * 0.25, "fish_belly"), (zc + H * 0.2, side), (1.0, back)])
    g.sphere(0.5, loc=(0, 0, zc), color=col, segs=10, rings=6, scale=(W, L, H))
    g.prism([(0.0, 0.0), (H * 0.9, H * 0.55), (H * 0.9, -H * 0.55)], 0.008, loc=(0, L * 0.45, zc),
            color=back, rot=(0, 0, 90))
    g.prism([(-L * 0.12, 0.0), (L * 0.1, 0.0), (L * 0.02, H * 0.45)], 0.006, loc=(0, -L * 0.02, zc + H * 0.42),
            color=back, rot=(0, 0, 90))
    for s in (1, -1):
        g.box((0.004, 0.008, 0.008), loc=(s * W * 0.38, -L * 0.36, zc + H * 0.12), color="black")
    if spots:
        for k in range(6):
            y = -L * 0.2 + k * L * 0.08
            for s in (1, -1):
                g.box((0.004, 0.012, 0.01), loc=(s * W * 0.47, y, zc + (0.15 if k % 2 else -0.05) * H), color=spots)
    return g


# Poule ---------------------------------------------------------------------

HEN_BONES = [("hen_root", (0, 0, 0), (0, 0, 0.08), None),
             ("hen_body", (0, 0.03, 0.17), (0, -0.07, 0.24), "hen_root"),
             ("hen_head", (0, -0.08, 0.26), (0, -0.1, 0.38), "hen_body"),
             ("hen_leg_l", (0.045, 0.01, 0.15), (0.045, 0.01, 0.0), "hen_root"),
             ("hen_leg_r", (-0.045, 0.01, 0.15), (-0.045, 0.01, 0.0), "hen_root")]


def hen_rig():
    ad = bpy.data.armatures.new("hen")
    arm = bpy.data.objects.new("hen", ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, par in HEN_BONES:
        eb = ad.edit_bones.new(name)
        eb.head, eb.tail = h, t
        if par:
            eb.parent = ad.edit_bones[par]
        eb.align_roll(Vector((0, 0, 1)) if name == "hen_body" else Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def hen_mesh(A, body):
    g = A.geo()
    dark = {"chicken_white": "chicken_white", "chicken_russet": "bark", "chicken_black": "chicken_black"}[body]
    g.sphere(0.13, loc=(0, 0.02, 0.21), color=body, segs=9, rings=6, scale=(0.85, 1.25, 0.9), bone="hen_body")
    g.prism([(-0.06, 0.0), (0.07, 0.0), (0.05, 0.14), (-0.02, 0.12)], 0.08, loc=(0, 0.15, 0.22), color=dark,
            rot=(0, 0, 90), bone="hen_body")
    for s in (1, -1):
        g.sphere(0.08, loc=(s * 0.1, 0.03, 0.22), color=dark if body != "chicken_white" else "egg", segs=7, rings=4,
                 scale=(0.35, 1.2, 0.75), bone="hen_body")
    g.sphere(0.055, loc=(0, -0.1, 0.33), color=body, segs=8, rings=5, scale=(0.9, 1.0, 1.1), bone="hen_head")
    g.cyl(0.045, 0.1, loc=(0, -0.085, 0.27), color=body, segs=7, r2=0.04, bone="hen_head")
    g.prism([(-0.03, 0.0), (0.035, 0.0), (0.03, 0.035), (0.01, 0.025), (-0.005, 0.04), (-0.02, 0.025)], 0.014,
            loc=(0, -0.11, 0.375), color="comb_red", rot=(0, 0, 90), bone="hen_head")
    g.box((0.012, 0.018, 0.03), loc=(0, -0.152, 0.30), color="comb_red", bone="hen_head")
    g.cyl(0.014, 0.04, loc=(0, -0.165, 0.33), color="beak", segs=5, r2=0.002, rot=(90, 0, 0), bone="hen_head")
    for s in (1, -1):
        g.box((0.004, 0.012, 0.012), loc=(s * 0.048, -0.125, 0.345), color="black", bone="hen_head")
        side = "hen_leg_l" if s > 0 else "hen_leg_r"
        g.cyl(0.009, 0.13, loc=(s * 0.045, 0.01, 0.075), color="beak", segs=5, bone=side)
        for a in (-30, 0, 30):
            g.box((0.01, 0.055, 0.008), loc=(s * 0.045 + math.sin(math.radians(a)) * 0.02,
                                             0.01 - math.cos(math.radians(a)) * 0.025, 0.004),
                  color="beak", rot=(0, 0, a), bone=side)
    return g


def hen_actions(arm):
    from bpy_extras import anim_utils
    arm.animation_data_create()
    names = [b[0] for b in HEN_BONES]
    clips = {
        "hen_idle": {0: {}, 20: {"hen_head": (0, 0, 25)}, 34: {"hen_head": (0, 0, 25)},
                     50: {"hen_head": (-10, 0, -20), "hen_body": (3, 0, 0)}, 70: {}},
        "hen_walk": {0: {"hen_leg_l": (28, 0, 0), "hen_leg_r": (-28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0},
                     4: {"hen_leg_l": (0, 0, 0), "hen_leg_r": (0, 0, 0), "hen_head": (8, 0, 0), "loc": 0.012},
                     8: {"hen_leg_l": (-28, 0, 0), "hen_leg_r": (28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0},
                     12: {"hen_leg_l": (0, 0, 0), "hen_leg_r": (0, 0, 0), "hen_head": (8, 0, 0), "loc": 0.012},
                     16: {"hen_leg_l": (28, 0, 0), "hen_leg_r": (-28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0}},
        "hen_peck": {0: {}, 8: {"hen_body": (-30, 0, 0), "hen_head": (60, 0, 0)},
                     11: {"hen_body": (-34, 0, 0), "hen_head": (70, 0, 0)},
                     15: {"hen_body": (-28, 0, 0), "hen_head": (50, 0, 0)},
                     18: {"hen_body": (-34, 0, 0), "hen_head": (70, 0, 0)}, 30: {}},
    }
    for cname, keys in clips.items():
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f, pose in sorted(keys.items()):
            for b in names:
                pb = arm.pose.bones[b]
                pb.rotation_euler = tuple(math.radians(v) for v in pose.get(b, (0, 0, 0)))
                pb.keyframe_insert("rotation_euler", frame=f)
            rb = arm.pose.bones["hen_root"]
            rb.location = (0, pose.get("loc", 0.0), 0)
            rb.keyframe_insert("location", frame=f)
        slot = arm.animation_data.action_slot
        for fc in anim_utils.action_get_channelbag_for_slot(act, slot).fcurves:
            fc.modifiers.new("CYCLES")
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    return list(clips)


# Mobilier du potager --------------------------------------------------------

def hen_feeder(A):
    g = A.geo()
    g.box((0.62, 0.26, 0.14), loc=(0, 0, 0.12), color="wood", base=True, bevel=0.01)
    g.box((0.56, 0.2, 0.02), loc=(0, 0, 0.235), color="grain", base=True)
    for s in (1, -1):
        g.prism([(-0.14, 0.0), (0.14, 0.0), (0.0, 0.3)], 0.03, loc=(s * 0.3, 0, 0.0), color="wood_dark",
                rot=(0, 0, 90))
    g.box((0.66, 0.03, 0.03), loc=(0, 0, 0.32), color="wood_dark")
    return g


def grain_sack(A):
    g = A.geo()
    g.lathe([(0.17, 0.0), (0.2, 0.08), (0.2, 0.3), (0.14, 0.42), (0.06, 0.47), (0.09, 0.53)],
            colors=["burlap", "burlap", "burlap", "burlap_dark", "burlap"], segs=9, scale=(1, 0.85, 1))
    g.cyl(0.065, 0.025, loc=(0, 0, 0.46), color="rope", segs=8)
    g.box((0.14, 0.004, 0.08), loc=(0, -0.172, 0.2), color="paper_dark")
    return g


def water_barrel(A):
    g = A.geo()
    g.lathe([(0.27, 0.0), (0.31, 0.2), (0.32, 0.4), (0.31, 0.6), (0.27, 0.8)], colors="wood", segs=12)
    for z in (0.08, 0.36, 0.44, 0.72):
        r = 0.285 + 0.03 * math.sin(math.pi * z / 0.8)
        g.cyl(r + 0.008, 0.035, loc=(0, 0, z), color="iron", segs=12)
    g.cyl(0.255, 0.01, loc=(0, 0, 0.775), color="water", segs=12)
    g.cyl(0.022, 0.06, loc=(0, -0.3, 0.12), color="brass", segs=6, rot=(90, 0, 0))
    return g


# Programme --------------------------------------------------------------------

def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    A.add("garden_cell_grass", garden_cell_grass(A), {"footprint": [1, 1]})
    A.add("garden_cell_tilled", garden_cell_tilled(A), {"footprint": [1, 1]})
    A.add("garden_cell_tilled_wet", garden_cell_tilled(A, wet=True), {"footprint": [1, 1]})
    for crop in ("radish", "lettuce", "carrot"):
        for stage in ("seed", "sprout", "young", "ripe"):
            A.add(f"{crop}_stage_{stage}", crop_model(A, crop, stage), {"footprint": [1, 1], "on": "garden_cell_tilled"})
    A.add("radish", item_radish(A), {"kind": "item"})
    A.add("carrot", item_carrot(A), {"kind": "item"})
    A.add("lettuce", item_lettuce(A), {"kind": "item"})
    A.add("egg", item_egg(A), {"kind": "item"})
    A.add("dandelion", dandelion(A), {"kind": "item"})
    for crop in ("radish", "lettuce", "carrot"):
        A.add("seed_packet_" + crop, seed_packet(A, crop), {"kind": "item"})
    for name, fn in (("hoe", tool_hoe), ("watering_can", tool_watering_can), ("axe", tool_axe), ("saw", tool_saw),
                     ("hammer", tool_hammer), ("fishing_rod", tool_fishing_rod)):
        A.add(name, fn(A), {"kind": "tool", "socket": "socket_hand_r"})
    A.add("log", item_log(A), {"kind": "item"})
    A.add("plank", item_plank(A), {"kind": "item"})
    A.add("beam", item_beam(A), {"kind": "carried", "length_axis": "z", "carry_height": 1.78})
    A.add("nail_box", item_nail_box(A), {"kind": "item"})
    for kind in ("gudgeon", "chub", "trout"):
        A.add("fish_" + kind, fish(A, kind), {"kind": "item"})
    A.add("hen_feeder", hen_feeder(A), {"footprint": [1, 1]})
    A.add("grain_sack", grain_sack(A), {"kind": "item"})
    A.add("water_barrel", water_barrel(A), {"footprint": [1, 1]})
    # poule: squelette + trois robes
    arm = hen_rig()
    A._register(arm, {"variants": ["hen_white", "hen_red", "hen_black"]})
    for vname, body in (("hen_white", "chicken_white"), ("hen_red", "chicken_russet"), ("hen_black", "chicken_black")):
        ob = A.add(vname, hen_mesh(A, body), parent=arm)
        ob.modifiers.new("rig", "ARMATURE").object = arm
    clips = hen_actions(arm)

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "ferme.glb")
    size = lpl.export_glb(path, objs, animation_mode="ACTIONS")
    st = A.stats()
    st["hen"]["tris_each_variant"] = lpl.tri_count_obj(bpy.data.objects["hen_white"])
    lpl.write_stats("ferme", {"nodes": st, "animations": clips, "file_bytes": size})
    print("FERME", size, {k: v["tris"] for k, v in st.items()})

    # planche
    roots = [r for r in A.roots if r.name != "hen"]
    hens = []
    for i, v in enumerate(("hen_white", "hen_red", "hen_black")):
        e = lpl.empty("planche_" + v)
        h2 = bpy.data.objects["hen"].copy()
        bpy.context.scene.collection.objects.link(h2)
        h2.parent = e
        m = bpy.data.objects[v].copy()
        bpy.context.scene.collection.objects.link(m)
        m.parent = h2
        m.modifiers["rig"].object = h2
        hens.append(e)
    bpy.data.objects["hen"].hide_render = True
    for v in ("hen_white", "hen_red", "hen_black"):
        bpy.data.objects[v].hide_render = True

    def spacing(r):
        n = r.name
        if n == "beam":
            return 2.4
        if n.startswith(("garden", "planche_radish", "planche_lettuce", "planche_carrot", "water_barrel", "hen_feeder")):
            return 1.2
        if n in ("hoe", "fishing_rod"):
            return 1.2
        return 0.7
    cell = bpy.data.objects["garden_cell_tilled"]
    order = []
    for r in roots:
        if "_stage_" in r.name:
            e = lpl.empty("planche_" + r.name)
            c = cell.copy()
            bpy.context.scene.collection.objects.link(c)
            c.parent = e
            c2 = r.copy()
            bpy.context.scene.collection.objects.link(c2)
            c2.parent = e
            order.append(e)
        else:
            order.append(r)
    order += hens
    for r in roots:
        if "_stage_" in r.name:
            r.hide_render = True
    lpl.board(order, os.path.join(lpl.BOARDS, "ferme.png"), cols=10, spacing=spacing, label_size=0.085,
              res=(2000, 1250), names={e.name: e.name.replace("planche_", "") for e in order if e.name.startswith("planche_")})


if __name__ == "__main__":
    main()
