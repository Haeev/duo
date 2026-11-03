"""Personnages de La Petite Ligne: squelette commun, joueurs, habitants, animations.

Lancer: duo-python personnages.py
Produit: assets/modeles/personnages.glb (+ textures/personnages.png), planches/personnages-*.png

Un seul squelette (`rig`) porte toutes les animations; chaque personnage est
un maillage à part, lié à ce squelette. Peau rigide par pièce (chaque pièce
suit un seul os, sauf jupes et tabliers, mélangés entre bassin et cuisses).
Expressions: clés de forme sur le visage (happy, tired, hungry, delighted,
blink); la base est l'expression neutre.
"""
import math
import os
import sys

import bpy  # noqa: I001
from bpy_extras import anim_utils
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import coiffures  # noqa: E402
import animations_012  # noqa: E402
import garde_robe as GR  # noqa: E402
import habitants_013 as H13  # noqa: E402
import palette as P  # noqa: E402

PP = sys.modules[__name__]
H13.PP = PP
coiffures.PP = PP

FPS = 30
HC = 1.58          # centre de la tête
HEAD = (0.27, 0.25, 0.27)

BONES = [
    # nom, tête, queue, parent
    ("root", (0, 0, 0), (0, 0, 0.25), None),
    ("hips", (0, 0, 0.90), (0, 0, 1.00), "root"),
    ("spine", (0, 0, 1.00), (0, 0, 1.16), "hips"),
    ("chest", (0, 0, 1.16), (0, 0, 1.37), "spine"),
    ("neck", (0, 0, 1.37), (0, 0, 1.45), "chest"),
    ("head", (0, 0, 1.45), (0, 0, 1.75), "neck"),
    ("upper_arm_l", (0.205, 0, 1.33), (0.225, 0, 1.065), "chest"),
    ("forearm_l", (0.225, 0, 1.065), (0.235, 0, 0.83), "upper_arm_l"),
    ("hand_l", (0.235, 0, 0.83), (0.24, 0, 0.74), "forearm_l"),
    ("upper_arm_r", (-0.205, 0, 1.33), (-0.225, 0, 1.065), "chest"),
    ("forearm_r", (-0.225, 0, 1.065), (-0.235, 0, 0.83), "upper_arm_r"),
    ("hand_r", (-0.235, 0, 0.83), (-0.24, 0, 0.74), "forearm_r"),
    ("thigh_l", (0.09, 0, 0.89), (0.09, 0, 0.48), "hips"),
    ("shin_l", (0.09, 0, 0.48), (0.09, 0, 0.085), "thigh_l"),
    ("foot_l", (0.09, 0, 0.085), (0.09, -0.13, 0.03), "shin_l"),
    ("thigh_r", (-0.09, 0, 0.89), (-0.09, 0, 0.48), "hips"),
    ("shin_r", (-0.09, 0, 0.48), (-0.09, 0, 0.085), "thigh_r"),
    ("foot_r", (-0.09, 0, 0.085), (-0.09, -0.13, 0.03), "shin_r"),
]
BONE_NAMES = [b[0] for b in BONES]

EXPRESSIONS = ["neutral", "happy", "tired", "hungry", "delighted", "blink"]


# Squelette ---------------------------------------------------------------

def build_rig():
    ad = bpy.data.armatures.new("rig")
    arm = bpy.data.objects.new("rig", ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, par in BONES:
        eb = ad.edit_bones.new(name)
        eb.head, eb.tail = h, t
        if par:
            eb.parent = ad.edit_bones[par]
        if name.startswith("foot"):
            eb.align_roll(Vector((0, 0, 1)))
        else:
            eb.align_roll(Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def add_socket(arm, name, bone, world_loc):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = arm
    ob.parent_type = "BONE"
    ob.parent_bone = bone
    bpy.context.view_layer.update()
    ob.matrix_world = Matrix.Translation(world_loc)
    return ob


# Pièces du corps ---------------------------------------------------------

def torso_weights(co):
    return {"spine": 1.0} if co.z < 1.10 else {"chest": 1.0}


def skirt_weights(z_top, z_bot, rad):
    def w(co):
        t = max(0.0, min(1.0, (z_top - co.z) / max(1e-6, z_top - z_bot)))
        front = max(0.0, min(1.0, (-co.y / rad + 0.35) / 1.2))
        wt = 0.8 * t * front
        side = "thigh_l" if co.x >= 0 else "thigh_r"
        return {"hips": 1.0 - wt, side: wt}
    return w


def head_block(g, k=1.0):
    hx, hy, hz = (HEAD[0] * k, HEAD[1] * k, HEAD[2] * k)
    hc = HC + (hz - HEAD[2]) / 2
    g.box((hx, hy, hz), loc=(0, 0, hc), color="skin", bevel=0.045 * k, bseg=2, bone="head")
    # oreilles et nez
    for s in (1, -1):
        g.box((0.025 * k, 0.05 * k, 0.065 * k), loc=(s * (hx / 2 + 0.008 * k), 0.005, hc - 0.005 * k),
              color="skin_shade", bevel=0.008, bone="head")
    g.box((0.032 * k, 0.024 * k, 0.038 * k), loc=(0, -hy / 2 - 0.01 * k, hc - 0.026 * k), color="skin",
          bevel=0.007, bone="head")
    return hc, hx, hy, hz


def _oct(cx, cz, y, fn, n=8):
    """Disque à 8 côtés dans le plan XZ (face vers -Y): fn(angle) -> (dx, dz)."""
    pts = [(cx, y, cz + fn(None)[1])]
    for i in range(n):
        a = 2 * math.pi * i / n
        dx, dz = fn(a)
        pts.append((cx + dx, y, cz + dz))
    faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
    return pts, faces


def face_features(g, hc, hy, expr, k=1.0, mouth_y=None, cheek_base=0.0, brow_k=1.0, eye_k=1.0, eye_x=0.055,
                  lid=0.004):
    y = -hy / 2 - 0.004
    rx, rz = 0.016 * k * eye_k, 0.024 * k * eye_k

    def eye_shape(a):
        if a is None:
            return {"happy": (0, 0.25 * rz), "delighted": (0, 0.55 * rz), "tired": (0, -0.2 * rz),
                    "blink": (0, -0.2 * rz)}.get(expr, (0, 0))
        c, s = math.cos(a), math.sin(a)
        x = rx * c
        if expr == "delighted":
            zt = 0.6 * rz * abs(s)
            return (x * 1.15, zt + (0.006 if s >= 0 else -0.006) * k)
        if expr == "happy":
            return (x * 1.05, rz * s if s >= 0 else 0.35 * rz * s + 0.25 * rz * (1 - c * c))
        if expr == "tired":
            return (x * 1.05, 0.15 * rz * s if s >= 0 else 0.8 * rz * s)
        if expr == "blink":
            return (x * 1.1, -0.25 * rz * (1 - c * c) + (lid if s >= 0 else -lid) * k)
        if expr == "hungry":
            return (x * 1.1, rz * 1.1 * s)
        return (x, rz * s)

    for sx in (1, -1):
        pts, fs = _oct(sx * eye_x * k, hc + 0.005 * k, y, eye_shape)
        g.mesh(pts, fs, "eye", bone="head")

    # sourcils: quad (intérieur, extérieur)
    bz = hc + 0.05 * k
    bi, bo = {"happy": (0.006, 0.006), "delighted": (0.012, 0.008), "tired": (-0.002, -0.011),
              "hungry": (0.011, -0.004)}.get(expr, (0.0, 0.0))
    th = 0.0095 * k * brow_k
    for sx in (1, -1):
        xi, xo = sx * 0.032 * k, sx * 0.08 * k
        zi, zo = bz + bi * k, bz + bo * k
        pts = [(xi, y, zi - th / 2), (xo, y, zo - th / 2), (xo, y, zo + th / 2), (xi, y, zi + th / 2)]
        if sx < 0:
            pts = [pts[1], pts[0], pts[3], pts[2]]
        g.mesh(pts, [(0, 1, 2, 3)], "hair_dark", bone="head")

    # bouche
    my = (-hy / 2 - 0.004) if mouth_y is None else mouth_y
    mz = hc - 0.062 * k
    w, tc, bc, t0 = {"neutral": (0.028, 0.006, 0.012, 0.0028), "happy": (0.036, 0.010, 0.022, 0.003),
                     "delighted": (0.04, 0.0, 0.03, 0.002), "tired": (0.024, -0.002, -0.001, 0.0025),
                     "hungry": (0.014, -0.009, 0.009, 0.002), "blink": (0.028, 0.006, 0.012, 0.0028)}[expr]
    w, tc, bc, t0 = w * k, tc * k, bc * k, t0 * k

    def mouth_shape(a):
        if a is None:
            return (0, (-tc + t0 - bc - t0) / 2)
        c, s = math.cos(a), math.sin(a)
        x = w * c
        q = 1 - c * c
        if s > 1e-6:
            return (x, -tc * q + t0)
        if s < -1e-6:
            return (x, -bc * q - t0)
        return (x, 0.0)
    pts, fs = _oct(0, mz, my, mouth_shape)
    g.mesh(pts, fs, "mouth", bone="head")

    # joues
    cs = max({"happy": 0.7, "delighted": 1.0}.get(expr, 0.0), cheek_base)
    # joues cachées dans la tête quand elles ne servent pas (pas de triangle dégénéré)
    cy = y + 0.001 if cs > 0 else -hy / 2 + 0.008
    r = 0.018 * k * max(cs, 0.6)
    for sx in (1, -1):
        pts, fs = _oct(sx * 0.07 * k, hc - 0.035 * k, cy,
                       lambda a, r=r: (0, 0) if a is None else (r * math.cos(a), r * 0.8 * math.sin(a)))
        g.mesh(pts, fs, "cheek", bone="head")


def neck(g, color="skin"):
    g.cyl(0.05, 0.13, loc=(0, 0, 1.405), color=color, segs=8, bone="neck")


def hands(g, color="skin"):
    for s, side in ((1, "l"), (-1, "r")):
        b = "hand_" + side
        g.box((0.054, 0.08, 0.094), loc=(s * 0.24, 0, 0.785), color=color, bevel=0.016, bone=b)
        g.box((0.026, 0.03, 0.05), loc=(s * 0.226, -0.045, 0.80), color=color, rot=(-20, 0, 0), bevel=0.007,
              bone=b)


def arm(g, side, sleeve="long", top="top", trim="top_trim", skin="skin", r_up=0.059, puff=1.0):
    if ROUND:
        return arm_round(g, side, sleeve, top, trim, skin, puff)
    s = 1 if side == "l" else -1
    up, fo = "upper_arm_" + side, "forearm_" + side
    # épaule ronde
    g.sphere(0.07 * puff, loc=(s * 0.205, 0, 1.315), color=top, segs=8, rings=5, bone=up)
    if sleeve == "short":
        g.cyl(r_up * 1.12 * puff, 0.11, loc=(s * 0.210, 0, 1.255), color=top, segs=8, bone=up)
        g.cyl(r_up * 0.85, 0.20, loc=(s * 0.217, 0, 1.15), color=skin, segs=7, bone=up)
    else:
        g.cyl(r_up * puff, 0.27, loc=(s * 0.215, 0, 1.197), color=top, segs=8, r2=r_up * 0.92 * puff, bone=up)
    lower = top if sleeve == "long" else skin
    g.sphere(0.054 * (puff if sleeve == "long" else 1.0), loc=(s * 0.225, 0, 1.065), color=lower, segs=7,
             rings=5, bone=fo)
    g.cyl(0.053 * (puff if sleeve == "long" else 0.95), 0.24, loc=(s * 0.23, 0, 0.947), color=lower, segs=7,
          r2=0.045, bone=fo)
    if sleeve == "long":
        g.cyl(0.054, 0.035, loc=(s * 0.234, 0, 0.845), color=trim, segs=7, bone=fo)
    elif sleeve == "rolled":
        g.cyl(0.064, 0.05, loc=(s * 0.224, 0, 1.06), color=trim, segs=8, bone=up)


def leg(g, side, thigh="bottom", shin=None, shoe="shoes", cuff=None, r=0.084, boots=False):
    if ROUND:
        return leg_round(g, side, thigh, shin, shoe, cuff, r, boots)
    s = 1 if side == "l" else -1
    th, sh, ft = "thigh_" + side, "shin_" + side, "foot_" + side
    shin = shin or thigh
    g.cyl(r, 0.43, loc=(s * 0.09, 0, 0.68), color=thigh, segs=8, r2=r * 0.86, bone=th)
    g.sphere(r * 0.87, loc=(s * 0.09, 0, 0.48), color=shin, segs=8, rings=5, bone=sh)
    g.cyl(r * 0.8, 0.38, loc=(s * 0.09, 0, 0.29), color=shin, segs=8, r2=r * 0.66, bone=sh)
    if cuff:
        g.cyl(r * 0.76, 0.05, loc=(s * 0.09, 0, 0.125), color=cuff, segs=8, bone=sh)
    if boots:
        g.cyl(r * 0.72, 0.16, loc=(s * 0.09, 0, 0.13), color=shoe, segs=8, bone=sh)
    g.box((0.098, 0.215, 0.088), loc=(s * 0.09, -0.045, 0.044), color=shoe, bevel=0.025, bseg=2, bone=ft)
    g.box((0.104, 0.225, 0.018), loc=(s * 0.09, -0.045, 0.009), color="hair_dark" if shoe == "shoes" else shoe,
          bone=ft)


def torso(g, w_top=0.38, w_bot=0.30, d=0.22, z0=0.97, z1=1.385, color="top", belly=0.0):
    if ROUND and belly == 0:
        return torso_round(g, w_top, w_bot, d, z0, z1, color)
    h = z1 - z0
    g.box((w_bot, d, h), loc=(0, 0, z0), color=color, taper=(w_top / w_bot, 1.0), bevel=0.035, bseg=2,
          weights=torso_weights, base=True)
    if belly > 0:
        g.sphere(0.16, loc=(0, -d / 2 + 0.07 - belly * 0.5, 1.07), scale=(1.15, 0.6 + belly * 2, 0.95),
                 color=color, segs=10, rings=6, bone="spine")


def pelvis(g, w=0.31, d=0.21, color="bottom", z0=0.80, z1=1.0):
    if ROUND:
        return pelvis_round(g, w, d, color, z0, z1)
    g.box((w, d, z1 - z0), loc=(0, 0, z0), color=color, bevel=0.03, bseg=1, bone="hips", base=True)


def collar(g, color="top_trim", w=0.17, d=0.16):
    if ROUND:
        # 0.12: rabats arrondis couchés sur le haut du torse (plus de plaquettes à angles vifs)
        for s in (1, -1):
            g.sphere(1.0, loc=(s * (w / 4 + 0.006), torso_front_y(1.372) - 0.004, 1.372), color=color, segs=8, rings=4,
                     scale=(w / 4 + 0.012, 0.012, 0.036), rot=(-38, 0, s * 24), bone="chest")
        return
    for s in (1, -1):
        g.box((w / 2, 0.07, 0.03), loc=(s * w / 4, -d / 2 + 0.015, 1.385), color=color, rot=(-25, 0, s * 18),
              bone="chest")


def belt(g, w=0.315, d=0.215, color="extra_a", buckle="metal", z=0.985):
    if ROUND:
        return belt_round(g, w, d, color, buckle, z)
    g.box((w, d, 0.04), loc=(0, 0, z), color=color, bone="hips")
    g.box((0.05, 0.012, 0.035), loc=(0, -d / 2 - 0.004, z), color=buckle, bone="hips")


def buttons(g, n=3, z0=1.05, z1=1.30, y=-0.108, color="metal", bone="chest", x=0.0, rings=None):
    for i in range(n):
        z = z0 + (z1 - z0) * (i / max(1, n - 1))
        b = bone if z > 1.10 else "spine"
        yy = torso_front_y(z, rings) - 0.003 if ROUND else y
        g.box((0.018, 0.01, 0.018), loc=(x, yy, z), color=color, bone=b)


# Low poly arrondi des joueurs (décision du client du 2026-10-31, bible section 8) -------------
# Même squelette, mêmes prises: seules les formes changent. Tête en boule facettée (1/5 de la
# hauteur), coiffure en lobes, torse octogonal bombé aux épaules arrondies, membres à 6 pans
# renflés, mains en moufles, chaussures en galets.

ROUND = False      # vrai pendant la construction des pièces des joueurs
PK = 1.26          # échelle des traits du visage sur la tête ronde
PHC = 1.545        # centre de la tête ronde: le sommet ne bouge pas (hauteur totale inchangée)
PHEAD = (0.18, 0.165, 0.17)   # demi-axes de la tête (x, y, z): 34 cm de haut, 5 % plus large que haute
C8 = math.cos(math.pi / 8)


def rounded(builder):
    def b(g, e):
        global ROUND
        ROUND = True
        try:
            builder(g, e)
        finally:
            ROUND = False
    return b


def torso_rings(w_top=0.38, w_bot=0.31, d=0.21, z0=0.97, z1=1.385, belly=0.0):
    """Anneaux (demi-largeur, demi-profondeur, z) du torse: ventre et dos bombés, épaules arrondies."""
    kx_b, kx_t, ky = w_bot / 0.31, w_top / 0.38, d / 0.21
    h = z1 - z0
    # bas de chemise un peu évasé (rangée décalée de 1,5 cm) qui retombe sur la ceinture
    b = belly * 0.6
    return [(0.162 * kx_b, 0.124 * ky + b * 0.5, z0 - 0.012), (0.168 * kx_b, 0.134 * ky + b, z0 + 0.05),
            (0.178 * kx_b, 0.142 * ky + b, z0 + 0.27 * h),
            (0.186 * kx_t, 0.138 * ky + b * 0.5, z0 + 0.55 * h), (0.178 * kx_t, 0.128 * ky, z0 + 0.77 * h),
            (0.152 * kx_t, 0.11 * ky, z0 + 0.92 * h), (0.094 * kx_t, 0.076 * ky, z1 + 0.012)]


def torso_front_y(z, rings=None):
    rings = rings or torso_rings()
    for (_, a0, z0), (_, a1, z1) in zip(rings, rings[1:]):
        if z0 <= z <= z1:
            return -(a0 + (a1 - a0) * (z - z0) / (z1 - z0))
    return -rings[-1][1]


def loft8(g, rings, color, bone=None, weights=None, close_bottom=True, close_top=True):
    """Volume octogonal (faces à plat devant et sur les côtés) par anneaux (ax, ay, z) en apothèmes."""
    pts, faces = [], []
    for ax, ay, z in rings:
        for k in range(8):
            a = math.radians(22.5 + 45 * k)
            pts.append((ax / C8 * math.cos(a), ay / C8 * math.sin(a), z))
    for i in range(len(rings) - 1):
        for k in range(8):
            k2 = (k + 1) % 8
            faces.append((i * 8 + k, i * 8 + k2, (i + 1) * 8 + k2, (i + 1) * 8 + k))
    if close_bottom:
        faces.append(tuple(reversed(range(8))))
    if close_top:
        n = (len(rings) - 1) * 8
        faces.append(tuple(range(n, n + 8)))
    return g.mesh(pts, faces, color, bone=bone, weights=weights)


def head_round(g, s=1.0):
    """Tête en boule facettée à 12 pans (tour de révolution symétrique: arête verticale au milieu du
    visage, bande de facettes centrée sur les yeux); sommet fixe. Renvoie (hc, largeur, profondeur, hauteur)."""
    rx, ry, rz = (a * s for a in PHEAD)
    hc = PHC + PHEAD[2] - rz
    lats = [-90, -58, -30, -6, 20, 44, 66, 90]
    prof = [(math.cos(math.radians(a)), math.sin(math.radians(a))) for a in lats]
    g.head_verts = g.lathe(prof, loc=(0, 0, hc), colors="skin", segs=12, scale=(rx, ry, rz), bone="head")
    for sx in (1, -1):
        g.sphere(1.0, loc=(sx * (rx - 0.004), 0.01, hc - 0.01), color="skin_shade", segs=6, rings=4,
                 scale=(0.016 * s, 0.032 * s, 0.042 * s), bone="head")
    g.sphere(1.0, loc=(0, -ry * 0.985, hc + 0.008 * s), color="skin", segs=6, rings=4,
             scale=(0.024 * s, 0.016 * s, 0.024 * s), bone="head")
    return hc, 2 * rx, 2 * ry, 2 * rz


def project_on_head(g, start, hx, hy, hz, hc):
    """Plaque les traits du visage (dessinés sur le plan y = -hy/2) sur les facettes de la tête,
    par lancer de rayons: même décalage qu'à plat (devant pour les traits, dedans pour les joues cachées)."""
    from mathutils.bvhtree import BVHTree
    hv = [v for v in g.head_verts if v.is_valid]
    idx = {v: i for i, v in enumerate(hv)}
    polys = [[idx[v] for v in f.verts] for f in {f for v in hv for f in v.link_faces} if all(v in idx for v in f.verts)]
    tree = BVHTree.FromPolygons([v.co.copy() for v in hv], polys)
    # start: sommets d'avant les traits (un ensemble, pas un indice: bmesh réutilise les places des
    # sommets supprimés, l'ordre de la liste n'est donc pas chronologique)
    for v in [v for v in g.bm.verts if v not in start]:
        hit = tree.ray_cast(Vector((v.co.x, -1.0, v.co.z)), Vector((0, 1, 0)))
        if hit[0] is not None:
            off = v.co.y + hy / 2
            # 4 mm de plus devant: une corde entre deux facettes passe sous la surface
            v.co.y = hit[0].y + (off - 0.004 if off < 0 else off)


def hair_round(g, style, hc, s=1.0):
    """Coiffures en masses arrondies: calotte, nuque, mèches en lobes (s: échelle de la tête)."""
    rx, ry, rz = PHEAD

    def lobe(c, r, segs=8, rings=5, rot=(0, 0, 0), color="hair"):
        g.sphere(1.0, loc=(c[0] * s, c[1] * s, hc + c[2] * s), color=color, segs=segs, rings=rings,
                 scale=tuple(a * s for a in r), rot=rot, bone="head")

    if style == "sides":  # Firmin, Basile: nuque et côtés, le dessus sous la coiffe
        lobe((0, 0.09, -0.01), (0.16, 0.1, 0.1))
        for sx in (1, -1):
            lobe((sx * 0.165, 0.04, 0.03), (0.04, 0.09, 0.075), segs=6, rings=4)
        return
    # calotte: ellipsoïde décalé vers le haut et l'arrière, qui laisse front et sourcils libres
    lobe((0, 0.04, 0.06), (rx + 0.014, ry + 0.016, 0.13), segs=12, rings=7)
    if style == "braids":  # Jeanne: tresses en perles de lobes
        lobe((0, 0.085, -0.02), (0.15, 0.1, 0.1))
        for sx in (1, -1):
            for i in range(4):
                lobe((sx * 0.19, 0.03, -0.03 - i * 0.055), (0.035 * (1 - i * 0.06), 0.035, 0.04), segs=6, rings=4)
            lobe((sx * 0.19, 0.03, -0.25), (0.03, 0.025, 0.02), segs=6, rings=3, color="extra_a")
        return
    if style == "ponytail":  # Lucie
        lobe((0, 0.09, -0.02), (0.15, 0.1, 0.1))
        lobe((0, 0.2, -0.06), (0.06, 0.06, 0.13), segs=8, rings=5, rot=(-12, 0, 0))
        lobe((0, 0.17, 0.05), (0.035, 0.03, 0.025), segs=6, rings=3, color="extra_b")
        return
    if style == "short":
        lobe((0, 0.085, -0.03), (0.15, 0.1, 0.1))
        lobe((0.03, -0.1, 0.16), (0.09, 0.035, 0.04), segs=6, rings=4, rot=(20, 0, 8))
        for sx in (1, -1):
            lobe((sx * 0.168, 0.03, 0.075), (0.035, 0.08, 0.06), segs=6, rings=4)
    elif style == "bob":
        # 0.12.2: nuque et côtés arrêtés au-dessus du col et des épaules (ils y entraient de 3 cm)
        lobe((0, 0.08, -0.035), (0.19, 0.11, 0.105))
        lobe((0, -0.1, 0.162), (0.14, 0.034, 0.04), segs=8, rings=4, rot=(15, 0, 0))
        for sx in (1, -1):
            lobe((sx * 0.168, -0.005, -0.03), (0.05, 0.115, 0.112), segs=6, rings=5)
    else:  # bun
        lobe((0, 0.09, -0.01), (0.15, 0.1, 0.09))
        lobe((0, 0.15, 0.14), (0.085, 0.08, 0.08), segs=8, rings=5)
        lobe((-0.03, -0.1, 0.162), (0.085, 0.034, 0.038), segs=6, rings=4, rot=(20, 0, -8))
        for sx in (1, -1):
            lobe((sx * 0.168, 0.03, 0.075), (0.035, 0.08, 0.06), segs=6, rings=4)


def hands_round(g, color="skin"):
    """Moufles: une boule facettée et le pouce."""
    for s, side in ((1, "l"), (-1, "r")):
        b = "hand_" + side
        # 0.12: main plus franche (on la lit au zoom de jeu), pouce détaché
        g.sphere(1.0, loc=(s * 0.243, 0, 0.78), color=color, segs=8, rings=5, scale=(0.041, 0.055, 0.066), bone=b)
        g.sphere(1.0, loc=(s * 0.221, -0.047, 0.803), color=color, segs=6, rings=4, scale=(0.019, 0.024, 0.033),
                 rot=(-20, 0, 0), bone=b)


def arm_round(g, side, sleeve="long", top="top", trim="top_trim", skin="skin", puff=1.0):
    s = 1 if side == "l" else -1
    up, fo = "upper_arm_" + side, "forearm_" + side
    # épaule ronde qui recouvre le haut du torse
    g.sphere(0.083 * puff, loc=(s * 0.2, 0, 1.305), color=top, segs=8, rings=5, bone=up)
    if sleeve == "short":
        g.lathe([(0.06 * puff, 1.2), (0.075 * puff, 1.25), (0.07 * puff, 1.31)], loc=(s * 0.215, 0, 0), colors=top,
                segs=6, bone=up, close_top=False)
        g.lathe([(0.05, 1.075), (0.058, 1.15), (0.056, 1.22)], loc=(s * 0.22, 0, 0), colors=skin, segs=6, bone=up,
                close_bottom=False, close_top=False)
    else:
        g.lathe([(0.058 * puff, 1.075), (0.07 * puff, 1.19), (0.064 * puff, 1.30)], loc=(s * 0.22, 0, 0), colors=top,
                segs=6, bone=up, close_bottom=False, close_top=False)
    lower = top if sleeve == "long" else skin
    q = puff if sleeve == "long" else 1.0
    g.sphere(0.058 * q, loc=(s * 0.226, 0, 1.065), color=lower, segs=6, rings=4, bone=fo)
    g.lathe([(0.046 * q, 0.84), (0.059 * q, 0.95), (0.055 * q, 1.06)], loc=(s * 0.231, 0, 0), colors=lower, segs=6,
            bone=fo, close_top=False)
    if sleeve == "long":
        g.lathe([(0.058, 0.83), (0.058, 0.865)], loc=(s * 0.234, 0, 0), colors=trim, segs=6, bone=fo)
    elif sleeve == "rolled":
        g.lathe([(0.075, 1.035), (0.076, 1.09)], loc=(s * 0.223, 0, 0), colors=trim, segs=6, bone=up)


def leg_round(g, side, thigh="bottom", shin=None, shoe="shoes", cuff=None, r=0.084, boots=False):
    s = 1 if side == "l" else -1
    th, sh, ft = "thigh_" + side, "shin_" + side, "foot_" + side
    shin = shin or thigh
    x = s * 0.092
    g.lathe([(r * 0.86, 0.47), (r * 1.1, 0.64), (r * 1.08, 0.80), (r * 0.98, 0.89)], loc=(x, 0, 0), colors=thigh,
            segs=6, bone=th,
            close_bottom=False, close_top=False)
    g.sphere(r * 0.92, loc=(x, 0, 0.48), color=shin, segs=6, rings=4, bone=sh)
    # mollet renflé, jambe effilée vers la cheville
    g.lathe([(r * 0.56, 0.10), (r * 0.72, 0.2), (r * 0.9, 0.32), (r * 0.84, 0.48)], loc=(x, 0, 0), colors=shin,
            segs=6, bone=sh,
            close_top=False)
    if boots:
        g.lathe([(r * 0.66, 0.06), (r * 0.8, 0.2), (r * 0.84, 0.235)], loc=(x, 0, 0), colors=shoe, segs=6, bone=sh)
    elif cuff:
        g.lathe([(r * 0.66, 0.105), (r * 0.7, 0.155)], loc=(x, 0, 0), colors=cuff, segs=6, bone=sh)
    # chaussure en galet, semelle à plat (arête au sol vive)
    vs = g.sphere(1.0, loc=(x, -0.047, 0.057), color=lpl.by_normal(shoe, shoe, "hair_dark" if shoe == "shoes" else shoe),
                  segs=10, rings=6, scale=(0.068, 0.142, 0.064), bone=ft)
    for v in vs:
        if v.co.z < 0.0:
            v.co.z = 0.0


def torso_round(g, w_top=0.38, w_bot=0.30, d=0.22, z0=0.97, z1=1.385, color="top", belly=0.0):
    loft8(g, torso_rings(w_top, w_bot, d, z0, z1, belly), color, weights=torso_weights, close_bottom=False)


def pelvis_round(g, w=0.31, d=0.21, color="bottom", z0=0.80, z1=1.0):
    hw, hd = w / 2, d * 1.15 / 2
    # hanches arrondies: bas resserré, renflement à mi-hauteur
    loft8(g, [(hw * 0.84, hd * 0.82, z0), (hw * 1.0, hd * 0.97, z0 + 0.05), (hw * 1.06, hd * 1.03, z0 + 0.12),
              (hw * 0.99, hd * 0.98, z1)], color, bone="hips")


def belt_round(g, w=0.315, d=0.215, color="extra_a", buckle="metal", z=0.985):
    ax, ay = 0.168, 0.128
    loft8(g, [(ax, ay, z - 0.022), (ax, ay, z + 0.022)], color, bone="hips")
    g.box((0.055, 0.012, 0.038), loc=(0, -ay - 0.004, z), color=buckle, bevel=0.005, bone="hips")


def scarf_round(g, symbol=None):
    """Foulard agrandi d'un tiers, un pan qui dépasse de la silhouette (le signe du profil Duo)."""
    g.cyl(0.1, 0.065, loc=(0, 0.0, 1.38), r2=0.09, color="scarf", segs=10, scale=(1.4, 1.05, 1), bone="chest")
    zt = 1.385
    yc = torso_front_y(1.32) - 0.014
    g.prism([(-0.14, 0.0), (0.14, 0.0), (0.0, -0.2)], 0.025, loc=(0, yc, zt), color="scarf", rot=(-6, 0, 0),
            bone="chest")
    g.box((0.07, 0.055, 0.055), loc=(0, 0.12, 1.375), color="scarf", bevel=0.016, bone="chest")
    g.box((0.045, 0.018, 0.14), loc=(0.035, 0.145, 1.3), color="scarf", rot=(8, 0, 15), bevel=0.006, bone="chest")
    g.box((0.055, 0.018, 0.27), loc=(-0.075, 0.215, 1.27), color="scarf", rot=(-52, 0, -35), bevel=0.006, bone="chest")
    if symbol:
        R = lpl._rot((-6, 0, 0))
        c = Vector((0, yc, zt)) + (R @ Vector((0, -0.0125 - 0.0022, -0.072, 0.0))).xyz
        add_symbol(g, symbol, center=tuple(c), size=0.073)


# Coiffures ----------------------------------------------------------------

def hair_cap(g, hc, k=1.0, color="hair", h_extra=0.0):
    wx, bv = (1.05, 0.05) if ROUND else (1.0, 0.035)
    g.box((0.292 * k * wx, 0.272 * k, (0.09 + h_extra) * k), loc=(0, 0.004, hc + (0.10 + h_extra / 2) * k), color=color,
          bevel=bv * k, bseg=2, bone="head")


def hair_back(g, hc, k=1.0, z_bot=-0.06, color="hair", width=0.29):
    z_top = 0.14
    h = (z_top - z_bot) * k
    wx, bs = (1.05, 2) if ROUND else (1.0, 1)
    g.box((width * k * wx, 0.06 * k, h), loc=(0, 0.112 * k, hc + (z_top + z_bot) / 2 * k), color=color,
          bevel=(0.025 if ROUND else 0.02) * k, bseg=bs, bone="head")


def hair_sides(g, hc, k=1.0, z_bot=0.0, color="hair", y=0.025, depth=0.20):
    z_top = 0.13
    for s in (1, -1):
        wx = 1.05 if ROUND else 1.0
        g.box((0.03 * k, depth * k, (z_top - z_bot) * k), loc=(s * 0.145 * k * wx, y * k, hc + (z_top + z_bot) / 2 * k),
              color=color, bevel=0.012 * k if ROUND else 0.01 * k, bone="head")


def fringe(g, hc, k=1.0, color="hair", z=0.105, w=0.25, h=0.055, tilt=8, parts=1):
    if parts == 1:
        g.box((w * k, 0.04 * k, h * k), loc=(0, -0.122 * k, hc + z * k), color=color, rot=(tilt, 0, 0),
              bevel=0.012 * k, bone="head")
    else:
        for i in range(parts):
            x = (-w / 2 + w * (i + 0.5) / parts) * k
            hh = h * (1.0 if i % 2 == 0 else 0.75)
            g.box((w / parts * 1.15 * k, 0.04 * k, hh * k), loc=(x, -0.122 * k, hc + (z + (h - hh) / 2) * k),
                  color=color, rot=(tilt, 0, (i - parts / 2) * 6), bevel=0.01 * k, bone="head")


def hair_style(g, style, hc, k=1.0):
    if ROUND and style in ("short", "bob", "bun"):
        hair_round(g, style, hc)  # pièces des joueurs (tête de taille standard)
        coiffures.strands(g, hc, style)
        coiffures.settle(g, style, hc)  # 0.12.2: posée sur les vêtements, ce qui pend suit le buste
        return
    if ROUND and style in coiffures.NEW_CUTS:
        coiffures.hair_cut(g, style, hc)  # tour 10 (coiffures.py)
        coiffures.settle(g, style, hc)
        return
    if style == "short":
        hair_cap(g, hc, k)
        hair_back(g, hc, k, z_bot=-0.05)
        hair_sides(g, hc, k, z_bot=0.03)
        fringe(g, hc, k, z=0.105, w=0.25, h=0.06, tilt=12, parts=3)
    elif style == "bob":
        hair_cap(g, hc, k, h_extra=0.01)
        hair_back(g, hc, k, z_bot=-0.11, width=0.31)
        hair_sides(g, hc, k, z_bot=-0.10, y=0.0, depth=0.25)
        for s in (1, -1):
            g.box((0.04 * k, 0.24 * k, 0.05 * k), loc=(s * 0.15 * k, 0.0, hc - 0.095 * k), color="hair",
                  bevel=0.015 * k, bone="head")
        fringe(g, hc, k, z=0.085, w=0.27, h=0.07, tilt=5)
    elif style == "bun":
        hair_cap(g, hc, k)
        hair_back(g, hc, k, z_bot=-0.02)
        hair_sides(g, hc, k, z_bot=0.04)
        g.sphere(0.072 * k, loc=(0, 0.13 * k, hc + 0.135 * k), color="hair", segs=8, rings=6, bone="head")
        g.box((0.15 * k, 0.03 * k, 0.03 * k), loc=(0, 0.11 * k, hc + 0.09 * k), color="hair_dark", bone="head")
        fringe(g, hc, k, z=0.11, w=0.25, h=0.04, tilt=10, parts=2)
    elif style == "braids":
        hair_cap(g, hc, k)
        hair_back(g, hc, k, z_bot=-0.03)
        hair_sides(g, hc, k, z_bot=-0.02)
        fringe(g, hc, k, z=0.10, w=0.26, h=0.06, tilt=10, parts=4)
        for s in (1, -1):
            x = s * 0.155 * k
            for i in range(4):
                z = hc + (-0.04 - i * 0.05) * k
                g.sphere(0.03 * k * (1 - i * 0.06), loc=(x, 0.03 * k, z), color="hair", segs=6, rings=4,
                         scale=(1, 1, 1.2), bone="head")
            g.box((0.05 * k, 0.03 * k, 0.025 * k), loc=(x, 0.03 * k, hc - 0.22 * k), color="extra_a", bevel=0.006,
                  bone="head")
            g.cyl(0.02 * k, 0.05 * k, loc=(x, 0.03 * k, hc - 0.255 * k), r2=0.008 * k, color="hair", segs=6,
                  bone="head")
    elif style == "ponytail":
        hair_cap(g, hc, k)
        hair_back(g, hc, k, z_bot=-0.03)
        hair_sides(g, hc, k, z_bot=0.02)
        fringe(g, hc, k, z=0.11, w=0.25, h=0.05, tilt=12, parts=2)
        g.box((0.05 * k, 0.03 * k, 0.03 * k), loc=(0, 0.15 * k, hc + 0.06 * k), color="extra_b", bone="head")
        g.box((0.07 * k, 0.06 * k, 0.20 * k), loc=(0, 0.175 * k, hc - 0.04 * k), color="hair", taper=(1.3, 1.2),
              rot=(-12, 0, 0), bevel=0.02 * k, bone="head")
    elif style == "fringe_sides":  # Firmin, Basile: côtés et nuque, le dessus sous la casquette
        hair_back(g, hc, k, z_bot=-0.03)
        hair_sides(g, hc, k, z_bot=0.0, depth=0.16, y=0.04)


def cap_rail(g, hc, k=1.0):
    """Casquette de chef de halte: bandeau rouge, visière noire, écusson laiton."""
    top = hc + 0.135 * k
    g.cyl(0.152 * k, 0.05 * k, loc=(0, 0.005, top + 0.02 * k), color="extra_b", segs=12, bone="head")
    g.cyl(0.158 * k, 0.05 * k, loc=(0, 0.01, top + 0.065 * k), r2=0.172 * k, color="extra_a", segs=12, bone="head")
    g.cyl(0.172 * k, 0.012 * k, loc=(0, 0.012, top + 0.095 * k), color="extra_a", segs=12, bone="head")
    g.box((0.21 * k, 0.09 * k, 0.012 * k), loc=(0, -0.16 * k, top + 0.005 * k), color="eye", rot=(-18, 0, 0),
          bevel=0.02 * k, bone="head")
    g.box((0.035 * k, 0.012 * k, 0.03 * k), loc=(0, -0.155 * k, top + 0.055 * k), color="metal", bone="head")


def cap_post(g, hc, k=1.0):
    """Képi souple de factrice."""
    top = hc + 0.13 * k
    g.cyl(0.15 * k, 0.07 * k, loc=(0, 0.01, top + 0.03 * k), r2=0.155 * k, color="extra_b", segs=12, bone="head")
    g.cyl(0.152 * k, 0.018 * k, loc=(0, 0.01, top + 0.01 * k), color="top_trim", segs=12, bone="head")
    g.box((0.19 * k, 0.07 * k, 0.012 * k), loc=(0, -0.155 * k, top - 0.005 * k), color="eye", rot=(-15, 0, 0),
          bevel=0.015 * k, bone="head")


def beret(g, hc, k=1.0):
    top = hc + 0.14 * k
    g.cyl(0.165 * k, 0.05 * k, loc=(0.01, 0.01, top + 0.012 * k), r2=0.14 * k, color="extra_b", segs=12,
          rot=(0, -8, 0), bone="head")
    g.cyl(0.012 * k, 0.03 * k, loc=(0.01, 0.01, top + 0.05 * k), color="extra_b", segs=5, bone="head")


def mustache(g, hc, k=1.0, big=False, y=None):
    y = -0.125 * k - 0.012 if y is None else y
    w = 0.11 if big else 0.085
    for s in (1, -1):
        g.box((w / 2 * k, 0.025 * k, 0.026 * k), loc=(s * w / 4 * k, y, hc - 0.045 * k), color="hair",
              rot=(0, s * 12, 0), bevel=0.008 * k, bone="head")


def beard(g, hc, k=1.0):
    g.box((0.24 * k, 0.06 * k, 0.10 * k), loc=(0, -0.122 * k, hc - 0.097 * k), color="hair",
          bevel=0.03 * k, bseg=2, bone="head")
    g.box((0.16 * k, 0.07 * k, 0.07 * k), loc=(0, -0.12 * k, hc - 0.15 * k), color="hair", bevel=0.025 * k, bseg=2,
          bone="head")
    for s in (1, -1):
        g.box((0.04 * k, 0.17 * k, 0.12 * k), loc=(s * 0.125 * k, -0.03 * k, hc - 0.06 * k), color="hair",
              bevel=0.012 * k, bone="head")


# Vêtements --------------------------------------------------------------------

def skirt(g, z_top=0.99, z_bot=0.42, r_top=0.19, r_bot=0.31, color="bottom", segs=10, hem=None):
    w = skirt_weights(z_top, z_bot, r_bot)
    if ROUND:
        # robe évasée, ourlet arrondi (le bord rentre sous la cloche)
        rb = r_bot * 1.06
        g.lathe([(rb * 0.9, z_bot), (rb, z_bot + 0.03), (rb * 0.98, z_bot + 0.07), ((r_top + rb) / 2 * 0.93, (z_top + z_bot) / 2),
                 (r_top * 1.02, z_top - 0.08), (r_top, z_top)], colors=[hem or color, hem or color, color, color, color],
                segs=12, weights=w, scale=(1.0, 0.88, 1.0))
        return
    g.lathe([(r_bot, z_bot), (r_bot * 0.96, z_bot + 0.03), ((r_top + r_bot) / 2 * 0.95, (z_top + z_bot) / 2),
             (r_top, z_top)], colors=[hem or color, color, color], segs=segs, weights=w, scale=(1.0, 0.85, 1.0))


def apron(g, z_top=1.0, z_bot=0.47, w_top=0.24, w_bot=0.33, y=-0.0, color="extra_a", bib_to=None, front_r=0.2,
          rings=None):
    """Tablier: panneau devant la jupe (ou le pantalon), mélangé bassin/cuisses."""
    if ROUND:
        return apron_round(g, z_top, z_bot, w_top, w_bot, color, bib_to, front_r, rings)
    wfn = skirt_weights(z_top, z_bot, 0.2)
    yb = -front_r - 0.02
    pts = [(-w_bot / 2, yb - 0.04, z_bot), (w_bot / 2, yb - 0.04, z_bot), (w_top / 2, yb + 0.06, z_top),
           (-w_top / 2, yb + 0.06, z_top)]
    vs = []
    for p in pts:
        vs.append(p)
    back = [(x, yy + 0.015, z) for (x, yy, z) in pts]
    allp = vs + back
    faces = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    g.mesh(allp, faces, color, weights=wfn)
    if bib_to:
        g.box((0.2, 0.015, bib_to - z_top), loc=(0, -0.118, z_top), color=color, base=True, weights=torso_weights)
        for s in (1, -1):
            g.box((0.025, 0.24, 0.02), loc=(s * 0.1, 0.0, bib_to - 0.005), color=color, bone="chest")
    g.box((0.32, 0.225, 0.03), loc=(0, 0, z_top - 0.005), color=color, bone="hips")


def apron_round(g, z_top, z_bot, w_top, w_bot, color, bib_to, front_r, rings=None):
    """Tablier courbé sur 5 colonnes et 3 rangs: il épouse la jupe ou le ventre, coins du bas
    arrondis, ourlet ondulé; bavette courbée sur le torse."""
    wfn = skirt_weights(z_top, z_bot, 0.2)
    nc, t = 5, 0.014

    def panel(rows, weights=None, bone=None):
        # rows: [(z, demi-largeur, rayon x, rayon y, décalage du bas)] du bas vers le haut
        pts, faces = [], []
        for z, hw, rx, ry, wave in rows:
            for c in range(nc):
                u = -1 + 2 * c / (nc - 1)
                x = u * hw
                yy = -ry * math.sqrt(max(0.05, 1 - (x / rx) ** 2)) - 0.012
                dz = wave(u) if wave else 0.0
                pts.append((x, yy, z + dz))
        n = len(pts)
        for p in list(pts):
            pts.append((p[0], p[1] + t, p[2]))
        R = len(rows)
        for r in range(R - 1):
            for c in range(nc - 1):
                i = r * nc + c
                faces.append((i, i + 1, i + nc + 1, i + nc))
                faces.append((n + i, n + i + nc, n + i + nc + 1, n + i + 1))
        for r in range(R - 1):
            for c in (0, nc - 1):
                i, j = r * nc + c, (r + 1) * nc + c
                faces.append((i, j, n + j, n + i) if c == 0 else (j, i, n + i, n + j))
        for c in range(nc - 1):
            faces.append((c + 1, c, n + c, n + c + 1))
            top = (R - 1) * nc
            faces.append((top + c, top + c + 1, n + top + c + 1, n + top + c))
        return g.mesh(pts, faces, color, weights=weights, bone=bone)

    def wave(u):
        # ourlet ondulé, coins relevés (arrondis)
        return 0.012 * math.cos(u * math.pi * 2) + 0.03 * u ** 4

    rs = front_r + 0.03
    panel([(z_bot, w_bot / 2, rs * 1.6, rs * 1.05, wave), ((z_bot + z_top) / 2, (w_bot + w_top) / 4, rs * 1.5, rs * 0.98, None),
           (z_top, w_top / 2, rs * 1.3, rs * 0.86, None)], weights=wfn)
    if bib_to:
        rings = rings or torso_rings()
        za, zb = z_top, bib_to
        ya, yb = -torso_front_y(za + 0.02, rings), -torso_front_y((za + zb) / 2, rings)
        yc = -torso_front_y(zb - 0.02, rings)
        panel([(za, 0.1, 0.2, ya + 0.004, None), ((za + zb) / 2, 0.1, 0.2, yb + 0.004, None),
               (zb, 0.095, 0.2, yc + 0.004, lambda u: -0.01 * u * u)], weights=torso_weights)
        for sx in (1, -1):
            g.box((0.025, 0.25, 0.02), loc=(sx * 0.1, 0.0, bib_to - 0.005), color=color, bone="chest")
    g.lathe([(0.2, z_top - 0.02), (0.2, z_top + 0.012)], colors=color, segs=10, scale=(1.0, 0.72, 1.0), bone="hips")


def overall_bib(g, color="bottom", z0=1.0, z1=1.27, straps="bottom", buttons_c="metal"):
    fy = torso_front_y(1.15) + 0.105 if ROUND else 0.0  # torse en tonneau plus épais: bavette avancée
    g.box((0.24, 0.02, z1 - z0), loc=(0, -0.113 + fy, z0), color=color, base=True, weights=torso_weights)
    g.box((0.08, 0.008, 0.06), loc=(0, -0.125 + fy, z0 + 0.12), color=color, bone="chest")
    for s in (1, -1):
        g.box((0.035, 0.245, 0.02), loc=(s * 0.095, 0.0, z1 + 0.11), color=straps, rot=(0, 0, 0), bone="chest")
        g.box((0.035, 0.015, 0.13), loc=(s * 0.095, -0.115 + fy, z1 + 0.045), color=straps, bone="chest")
        g.box((0.035, 0.015, 0.33), loc=(s * 0.095, 0.115 - fy, z1 - 0.06), color=straps, bone="chest")
        g.box((0.02, 0.01, 0.02), loc=(s * 0.095, -0.125 + fy, z1 - 0.005), color=buttons_c, bone="chest")


def scarf(g, symbol=None):
    """Foulard noué: anneau au cou, pointe sur la poitrine, nœud et deux pans dans le dos."""
    if ROUND:
        return scarf_round(g, symbol)
    g.cyl(0.082, 0.05, loc=(0, 0.0, 1.38), r2=0.075, color="scarf", segs=10, bone="chest")
    g.prism([(-0.105, 0.0), (0.105, 0.0), (0.0, -0.15)], 0.02, loc=(0, -0.112, 1.385), color="scarf",
            rot=(-6, 0, 0), bone="chest")
    g.box((0.05, 0.04, 0.04), loc=(0, 0.095, 1.37), color="scarf", bevel=0.01, bone="chest")
    for s in (1, -1):
        g.box((0.035, 0.015, 0.09), loc=(s * 0.022, 0.118, 1.315), color="scarf", rot=(8, 0, s * 15), bone="chest")
    if symbol:
        add_symbol(g, symbol, center=(0, -0.124, 1.33), size=0.055)


def add_symbol(g, sym, center, size):
    cx, cy, cz = center
    r = size / 2

    def circ(rad, n=10, ox=0.0, oz=0.0):
        return [(ox + rad * math.cos(2 * math.pi * i / n), oz + rad * math.sin(2 * math.pi * i / n)) for i in range(n)]
    shapes = []
    if sym == "orb":
        shapes.append(circ(r * 0.75))
    elif sym == "crescent":
        outer = [(r * 0.8 * math.cos(a), r * 0.8 * math.sin(a)) for a in
                 [math.radians(d) for d in range(40, 330, 26)]]
        inner = [(r * 0.25 + r * 0.6 * math.cos(a), r * 0.12 + r * 0.6 * math.sin(a)) for a in
                 [math.radians(d) for d in range(300, 50, -30)]]
        shapes.append(outer + inner)
    elif sym == "star":
        pts = []
        for i in range(8):
            a = math.pi / 2 + i * math.pi / 4
            rr = r * 0.95 if i % 2 == 0 else r * 0.28
            pts.append((rr * math.cos(a), rr * math.sin(a)))
        shapes.append(pts)
    elif sym == "sun":
        shapes.append(circ(r * 0.45))
        for i in range(8):
            a = i * math.pi / 4
            shapes.append([(r * 0.58 * math.cos(a - 0.2), r * 0.58 * math.sin(a - 0.2)),
                           (r * 0.95 * math.cos(a), r * 0.95 * math.sin(a)),
                           (r * 0.58 * math.cos(a + 0.2), r * 0.58 * math.sin(a + 0.2))])
    elif sym == "planet":
        shapes.append(circ(r * 0.5))
        shapes.append([(-r, -0.08 * r), (r, 0.22 * r), (r, 0.36 * r), (-r, 0.06 * r)])
    elif sym == "comet":
        shapes.append(circ(r * 0.4, ox=r * 0.4, oz=-r * 0.3))
        shapes.append([(r * 0.15, -r * 0.05), (-r * 0.95, r * 0.75), (r * 0.6, r * 0.05)])
    for pts in shapes:
        g.prism(pts, 0.004, loc=(cx, cy, cz), color="scarf_mark", rot=(-6, 0, 0), bone="chest")


def satchel(g):
    g.box((0.04, 0.26, 0.02), loc=(0.0, 0.0, 1.22), color="extra_a", rot=(0, 52, 0), bone="chest")
    g.box((0.03, 0.02, 0.5), loc=(0.02, -0.115, 1.12), color="extra_a", rot=(0, -40, 0), bone="chest")
    g.box((0.03, 0.02, 0.5), loc=(0.02, 0.115, 1.12), color="extra_a", rot=(0, -40, 0), bone="chest")
    g.box((0.07, 0.24, 0.2), loc=(-0.205, -0.02, 0.92), color="extra_a", bevel=0.02, bone="hips")
    g.box((0.075, 0.245, 0.08), loc=(-0.207, -0.02, 0.99), color="hair_dark", bevel=0.015, bone="hips")
    g.box((0.01, 0.03, 0.03), loc=(-0.247, -0.02, 0.96), color="metal", bone="hips")


# Personnages ------------------------------------------------------------

def build_npc(g, who, expr):
    if who == "firmin":
        hc, hx, hy, hz = head_block(g)
        face_features(g, hc, hy, expr, brow_k=1.6)
        hair_style(g, "fringe_sides", hc)
        mustache(g, hc, big=True)
        cap_rail(g, hc)
        neck(g)
        torso(g, w_top=0.40, w_bot=0.34, d=0.23, belly=0.05)
        g.box((0.35, 0.235, 0.17), loc=(0, 0, 0.80), color="top", bevel=0.03, bone="hips", base=True)
        collar(g, color="top_trim")
        buttons(g, n=4, z0=0.86, z1=1.30, y=-0.122)
        g.box((0.006, 0.01, 0.06), loc=(0.07, -0.124, 1.05), color="metal", rot=(0, 30, 0), bone="spine")
        for s, side in ((1, "l"), (-1, "r")):
            arm(g, side, sleeve="long", puff=1.05)
            leg(g, side, thigh="bottom", cuff="bottom", r=0.088)
        hands(g)
    elif who == "odette":
        hc, hx, hy, hz = head_block(g)
        face_features(g, hc, hy, expr, cheek_base=0.55)
        hair_style(g, "bun", hc)
        neck(g)
        torso(g, w_top=0.39, w_bot=0.35, d=0.23, belly=0.06)
        collar(g, color="top_trim", w=0.19)
        skirt(g, z_top=1.0, z_bot=0.40, r_top=0.20, r_bot=0.33, hem="top_trim")
        apron(g, z_top=1.0, z_bot=0.46, w_top=0.26, w_bot=0.36, color="extra_a", bib_to=1.27, front_r=0.21)
        for s, side in ((1, "l"), (-1, "r")):
            arm(g, side, sleeve="rolled", top="top", trim="top_trim", puff=1.08)
            leg(g, side, thigh="extra_b", shin="extra_b", r=0.08)
        hands(g)
    elif who == "basile":
        hc, hx, hy, hz = head_block(g)
        face_features(g, hc, hy, expr, mouth_y=-0.125 - 0.034, brow_k=1.7)
        hair_style(g, "fringe_sides", hc)
        beard(g, hc)
        mustache(g, hc, big=True, y=-0.16)
        beret(g, hc)
        neck(g)
        torso(g, w_top=0.42, w_bot=0.33, d=0.22)
        pelvis(g, w=0.32, d=0.22)
        collar(g, color="top_trim")
        apron(g, z_top=0.99, z_bot=0.40, w_top=0.28, w_bot=0.34, color="extra_a", bib_to=1.30, front_r=0.2)
        g.box((0.11, 0.012, 0.08), loc=(0.05, -0.135, 0.86), color="extra_b", bone="hips")
        g.box((0.012, 0.01, 0.07), loc=(0.07, -0.142, 0.90), color="eye", rot=(0, 10, 0), bone="hips")
        for s, side in ((1, "l"), (-1, "r")):
            arm(g, side, sleeve="rolled", puff=1.1)
            leg(g, side, thigh="bottom", cuff="bottom", r=0.09, boots=True)
        hands(g)
    elif who == "jeanne":
        k = 1.18
        hc, hx, hy, hz = head_block(g, k)
        face_features(g, hc, hy, expr, k=k, eye_k=1.12, cheek_base=0.3)
        hair_style(g, "braids", hc, k)
        g.cyl(0.05, 0.10, loc=(0, 0, 1.41), color="skin", segs=8, bone="neck")
        torso(g, w_top=0.33, w_bot=0.30, d=0.20)
        pelvis(g, w=0.30, d=0.20)
        overall_bib(g, color="bottom", z0=1.0, z1=1.25, straps="bottom")
        collar(g, color="top_trim", w=0.16)
        for s, side in ((1, "l"), (-1, "r")):
            arm(g, side, sleeve="short", r_up=0.058)
            leg(g, side, thigh="bottom", cuff="top_trim", r=0.085)
        hands(g)
        g.box((0.07, 0.012, 0.06), loc=(0.0, -0.126, 1.13), color="extra_b", bevel=0.005, bone="spine")
    elif who == "lucie":
        hc, hx, hy, hz = head_block(g)
        face_features(g, hc, hy, expr)
        hair_style(g, "ponytail", hc)
        cap_post(g, hc)
        neck(g)
        torso(g, w_top=0.37, w_bot=0.30, d=0.21)
        g.box((0.32, 0.215, 0.14), loc=(0, 0, 0.84), color="top", bevel=0.03, bone="hips", base=True)
        collar(g, color="top_trim")
        buttons(g, n=4, z0=0.90, z1=1.30, y=-0.11, color="top_trim")
        satchel(g)
        for s, side in ((1, "l"), (-1, "r")):
            arm(g, side, sleeve="long", trim="top_trim")
            leg(g, side, thigh="bottom", cuff="bottom")
        hands(g)


def head_round_face(g, expr, s=1.0, **face_kw):
    """Tête ronde (échelle s, sommet fixe) et traits plaqués; renvoie le centre de la tête."""
    hc, hx, hy, hz = head_round(g, s)
    start = set(g.bm.verts)
    mouth_dy = face_kw.pop("mouth_dy", None)
    if mouth_dy is not None:
        face_kw["mouth_y"] = -hy / 2 + mouth_dy
    face_features(g, hc + 0.03 * s, hy, expr, k=s, eye_k=0.9 * face_kw.pop("eye_k", 1.0), eye_x=0.05, **face_kw)
    project_on_head(g, start, hx, hy, hz, hc)
    return hc


def hat_top(hc, s=1.0, drop=0.075):
    """Hauteur de pose d'une coiffe sur la tête ronde (elle descend sur la boule au lieu d'y flotter)."""
    return hc + (PHEAD[2] - drop) * s


def cap_rail_round(g, hc, s=1.0):
    top = hat_top(hc, s)
    g.lathe([(0.166 * s, top - 0.01 * s), (0.17 * s, top + 0.045 * s)], loc=(0, 0.005, 0), colors="extra_b", segs=12,
            bone="head")
    g.lathe([(0.17 * s, top + 0.045 * s), (0.19 * s, top + 0.1 * s), (0.17 * s, top + 0.125 * s),
             (0.0, top + 0.13 * s)], loc=(0, 0.01, 0), colors="extra_a", segs=12, close_bottom=False, bone="head")
    # visière courte et relevée: on voit les yeux et la moustache en vue isométrique
    vs = g.sphere(1.0, loc=(0, -0.168 * s, top + 0.012 * s), color="eye", segs=10, rings=4,
                  scale=(0.1 * s, 0.05 * s, 0.013 * s), rot=(-30, 0, 0), bone="head")
    g.box((0.04 * s, 0.012 * s, 0.032 * s), loc=(0, -0.172 * s, top + 0.06 * s), color="metal", bevel=0.006,
          bone="head")
    return vs


def cap_post_round(g, hc, s=1.0):
    top = hat_top(hc, s, 0.08)
    g.lathe([(0.168 * s, top), (0.17 * s, top + 0.03 * s), (0.175 * s, top + 0.085 * s), (0.0, top + 0.1 * s)],
            loc=(0, 0.01, 0), colors="extra_b", segs=12, close_bottom=False, bone="head")
    g.lathe([(0.172 * s, top - 0.005 * s), (0.172 * s, top + 0.02 * s)], loc=(0, 0.01, 0), colors="top_trim", segs=12,
            bone="head")
    g.sphere(1.0, loc=(0, -0.172 * s, top - 0.004), color="eye", segs=10, rings=4, scale=(0.1 * s, 0.06 * s, 0.013 * s),
             rot=(-15, 0, 0), bone="head")


def beret_round(g, hc, s=1.0):
    top = hat_top(hc, s, 0.05)
    g.sphere(1.0, loc=(0.012, 0.01, top + 0.02 * s), color="extra_b", segs=12, rings=5, scale=(0.2 * s, 0.195 * s, 0.06 * s),
             rot=(0, -8, 0), bone="head")
    g.cyl(0.012 * s, 0.03 * s, loc=(0.01, 0.01, top + 0.08 * s), color="extra_b", segs=5, bone="head")


def mustache_round(g, hc, s=1.0, big=False):
    w = 0.12 if big else 0.09
    y = -PHEAD[1] * s * 0.96
    for sx in (1, -1):
        g.sphere(1.0, loc=(sx * w / 4 * s, y - 0.004, hc - 0.05 * s), color="hair", segs=6, rings=4,
                 scale=(w / 3.4 * s, 0.022 * s, 0.02 * s), rot=(0, sx * 14, 0), bone="head")


def beard_round(g, hc, s=1.0):
    ry = PHEAD[1] * s
    g.sphere(1.0, loc=(0, -ry * 0.82, hc - 0.105 * s), color="hair", segs=10, rings=6, scale=(0.15 * s, 0.07 * s, 0.085 * s),
             bone="head")
    g.sphere(1.0, loc=(0, -ry * 0.8, hc - 0.165 * s), color="hair", segs=8, rings=5, scale=(0.09 * s, 0.06 * s, 0.05 * s),
             bone="head")
    for sx in (1, -1):
        g.sphere(1.0, loc=(sx * 0.15 * s, -0.04 * s, hc - 0.06 * s), color="hair", segs=6, rings=4,
                 scale=(0.04 * s, 0.09 * s, 0.07 * s), bone="head")


def coat_skirt_round(g, ax, ay, z0, z1, color="top"):
    """Bas de veste ou de vareuse arrondi (remplace la boîte sous la taille)."""
    loft8(g, [(ax * 0.98, ay * 0.98, z0), (ax * 1.04, ay * 1.05, z0 + (z1 - z0) * 0.45), (ax, ay, z1)], color,
          bone="hips")


def build_npc_round(g, who, expr):
    if who == "firmin":
        hc = head_round_face(g, expr, brow_k=1.6)
        hair_round(g, "sides", hc)
        mustache_round(g, hc, big=True)
        cap_rail_round(g, hc)
        neck(g)
        torso_round(g, w_top=0.40, w_bot=0.34, d=0.23, belly=0.05)
        coat_skirt_round(g, 0.178, 0.135, 0.80, 0.97)
        collar(g, color="top_trim")
        buttons(g, n=4, z0=0.86, z1=1.30, y=-0.122, rings=torso_rings(0.40, 0.34, 0.23, belly=0.05))
        for side in ("l", "r"):
            arm_round(g, side, sleeve="long", puff=1.05)
            leg_round(g, side, thigh="bottom", cuff="bottom", r=0.088)
        hands_round(g)
    elif who == "odette":
        hc = head_round_face(g, expr, cheek_base=0.55)
        hair_round(g, "bun", hc)
        coiffures.strands(g, hc, "bun")
        neck(g)
        torso_round(g, w_top=0.39, w_bot=0.35, d=0.23, belly=0.06)
        collar(g, color="top_trim", w=0.19)
        skirt(g, z_top=1.0, z_bot=0.40, r_top=0.21, r_bot=0.34, hem="top_trim", segs=12)
        apron(g, z_top=1.0, z_bot=0.46, w_top=0.26, w_bot=0.36, color="extra_a", bib_to=1.27, front_r=0.23,
              rings=torso_rings(0.39, 0.35, 0.23, belly=0.06))
        for side in ("l", "r"):
            arm_round(g, side, sleeve="rolled", top="top", trim="top_trim", puff=1.08)
            leg_round(g, side, thigh="extra_b", shin="extra_b", r=0.08)
        hands_round(g)
    elif who == "basile":
        hc = head_round_face(g, expr, mouth_dy=-0.04, brow_k=1.7)
        hair_round(g, "sides", hc)
        beard_round(g, hc)
        mustache_round(g, hc, big=True)
        beret_round(g, hc)
        neck(g)
        torso_round(g, w_top=0.42, w_bot=0.33, d=0.22)
        pelvis_round(g, w=0.32, d=0.22)
        collar(g, color="top_trim")
        apron(g, z_top=0.99, z_bot=0.40, w_top=0.28, w_bot=0.34, color="extra_a", bib_to=1.30, front_r=0.22,
              rings=torso_rings(0.42, 0.33, 0.22))
        g.box((0.11, 0.012, 0.08), loc=(0.05, -0.155, 0.86), color="extra_b", bevel=0.01, bone="hips")
        g.box((0.012, 0.01, 0.07), loc=(0.07, -0.162, 0.90), color="eye", rot=(0, 10, 0), bone="hips")
        for side in ("l", "r"):
            arm_round(g, side, sleeve="rolled", puff=1.1)
            leg_round(g, side, thigh="bottom", cuff="bottom", r=0.09, boots=True)
        hands_round(g)
    elif who == "jeanne":
        s = 1.08
        hc = head_round_face(g, expr, s=s, eye_k=1.12, cheek_base=0.3)
        hair_round(g, "braids", hc, s)
        torso_round(g, w_top=0.33, w_bot=0.30, d=0.20)
        pelvis_round(g, w=0.30, d=0.20)
        overall_bib(g, color="bottom", z0=1.0, z1=1.25, straps="bottom")
        collar(g, color="top_trim", w=0.16)
        for side in ("l", "r"):
            arm_round(g, side, sleeve="short")
            leg_round(g, side, thigh="bottom", cuff="top_trim", r=0.085)
        hands_round(g)
        g.box((0.07, 0.012, 0.06), loc=(0.0, torso_front_y(1.13, torso_rings(0.33, 0.30, 0.20)) - 0.006, 1.13),
              color="extra_b", bevel=0.005, bone="spine")
    elif who == "achille":
        # boulanger, lent et rond: chemise blanche aux manches retroussées (farine aux avant-bras), grand tablier
        # fariné à bavette, calot de mitron, pantalon de toile, moustache tombante
        rings = torso_rings(0.41, 0.37, 0.24, belly=0.08)
        hc = head_round_face(g, expr, brow_k=1.3, cheek_base=0.4)
        hair_round(g, "sides", hc)
        mustache_round(g, hc)
        top = hat_top(hc, 1.0, 0.07)
        g.lathe([(0.168, top - 0.01), (0.172, top + 0.035)], loc=(0, 0.01, 0), colors="extra_a", segs=12, bone="head")
        g.sphere(1.0, loc=(0, 0.01, top + 0.04), color="extra_a", segs=10, rings=4, scale=(0.15, 0.17, 0.045),
                 bone="head")
        g.box((0.012, 0.3, 0.035), loc=(0, 0.01, top + 0.07), color="extra_b", bone="head")
        neck(g)
        torso_round(g, w_top=0.41, w_bot=0.37, d=0.24, belly=0.08)
        pelvis_round(g, w=0.33, d=0.23)
        collar(g, color="top_trim")
        apron(g, z_top=1.0, z_bot=0.45, w_top=0.28, w_bot=0.36, color="extra_a", bib_to=1.3, front_r=0.24, rings=rings)
        for side in ("l", "r"):
            arm_round(g, side, sleeve="rolled", top="top", trim="top_trim", skin="skin", puff=1.1)
            leg_round(g, side, thigh="bottom", cuff="bottom", r=0.09)
        hands_round(g)
    elif who == "solange":
        # coiffeuse et mercière, vive: blouse à deux poches sur une jupe, ciseaux pendus à la ceinture, lunettes
        # au cou sur leur cordon, chignon de théâtre
        rings = torso_rings(0.36, 0.30, 0.21)
        hc = head_round_face(g, expr, cheek_base=0.25, brow_k=1.1)
        hair_round(g, "bun", hc)
        coiffures.strands(g, hc, "bun")
        neck(g)
        torso_round(g, w_top=0.36, w_bot=0.30, d=0.21)
        collar(g, color="top_trim", w=0.17)
        skirt(g, z_top=0.99, z_bot=0.42, r_top=0.19, r_bot=0.29, color="bottom", segs=10)
        coat_skirt_round(g, 0.165, 0.124, 0.8, 0.98)
        buttons(g, n=4, z0=0.86, z1=1.3, y=-0.11, color="top_trim", rings=rings)
        for sx in (1, -1):
            g.box((0.08, 0.012, 0.075), loc=(sx * 0.085, -0.13, 0.86), color="top_trim", bone="hips")
        # ciseaux au côté droit: cordon de la ceinture, anneaux rouges, lames d'acier vers le bas
        g.box((0.008, 0.008, 0.08), loc=(-0.17, -0.06, 0.9), color="extra_b", bone="hips")
        for k, dx in enumerate((-0.012, 0.012)):
            g.cyl(0.018, 0.008, loc=(-0.172 + dx, -0.075, 0.84), color="extra_a", segs=6, rot=(0, 90, 0), bone="hips")
            g.box((0.008, 0.012, 0.09), loc=(-0.172 + dx * 0.4, -0.08, 0.78), color="metal", rot=(0, dx * 300, 0),
                  bone="hips")
        # lunettes au cou: cordon et deux verres ronds sur la poitrine
        yl = torso_front_y(1.25, rings) - 0.012
        for sx in (1, -1):
            g.cyl(0.022, 0.006, loc=(sx * 0.03, yl, 1.25), color="metal", segs=8, rot=(90, 0, 0), bone="chest")
            g.box((0.005, 0.005, 0.14), loc=(sx * 0.065, yl + 0.03, 1.31), color="extra_b", rot=(20, 0, sx * 20),
                  bone="chest")
        for side in ("l", "r"):
            arm_round(g, side, sleeve="long", top="top", trim="top_trim")
            leg_round(g, side, thigh="skin", shin="skin", r=0.075)
        hands_round(g)
    elif who == "lucie":
        hc = head_round_face(g, expr)
        hair_round(g, "ponytail", hc)
        cap_post_round(g, hc)
        neck(g)
        torso_round(g, w_top=0.37, w_bot=0.30, d=0.21)
        coat_skirt_round(g, 0.162, 0.122, 0.84, 0.98)
        collar(g, color="top_trim")
        buttons(g, n=4, z0=0.90, z1=1.30, y=-0.11, color="top_trim", rings=torso_rings(0.37, 0.30, 0.21))
        satchel(g)
        for side in ("l", "r"):
            arm_round(g, side, sleeve="long", trim="top_trim")
            leg_round(g, side, thigh="bottom", cuff="bottom")
        hands_round(g)


# Tour 9: équipage du train (bustes à la fenêtre de la cabine) et écharpe de Firmin ---------------------

def build_crew_round(g, who, expr):
    """Buste d'un membre de l'équipage (salut du mécanicien): tête, torse, bras et bas de veste fermé à 0,82 m;
    pas de jambes (la caisse de la cabine les cache). Mécanicien: casquette ronde à visière et lunettes
    relevées, grosse moustache, bleu de chauffe, foulard rouge. Chauffeur: casquette plate, barbe courte,
    vareuse de toile sombre aux manches retroussées, foulard blanc, suie sur les joues."""
    if who == "driver":
        hc = head_round_face(g, expr, brow_k=1.4)
        hair_round(g, "sides", hc)
        mustache_round(g, hc, big=True)
        cap_post_round(g, hc)
        top = hat_top(hc, 1.0, 0.08)
        # lunettes de cabine relevées sur la casquette
        for sx in (1, -1):
            g.cyl(0.028, 0.02, loc=(sx * 0.045, -0.15, top + 0.06), color="metal", segs=8, rot=(70, 0, 0),
                  bone="head")
        g.box((0.03, 0.012, 0.012), loc=(0, -0.155, top + 0.062), color="metal", bone="head")
        sleeve = "long"
    else:
        hc = head_round_face(g, expr, brow_k=1.2, cheek_base=0.2)
        hair_round(g, "sides", hc)
        beard_round(g, hc)
        beret_round(g, hc)
        sleeve = "rolled"
    neck(g)
    rings = torso_rings(0.40, 0.33, 0.22)
    torso_round(g, w_top=0.40, w_bot=0.33, d=0.22)
    coat_skirt_round(g, 0.168, 0.128, 0.82, 0.97)
    collar(g, color="top_trim")
    buttons(g, n=3, z0=1.0, z1=1.28, y=-0.118, color="metal", rings=rings)
    # foulard noué au cou, pointe sur la poitrine
    g.cyl(0.1, 0.06, loc=(0, 0.0, 1.38), r2=0.09, color="scarf", segs=10, scale=(1.35, 1.05, 1), bone="chest")
    g.prism([(-0.11, 0.0), (0.11, 0.0), (0.0, -0.15)], 0.022, loc=(0, torso_front_y(1.32, rings) - 0.012, 1.385),
            color="scarf", rot=(-6, 0, 0), bone="chest")
    for side in ("l", "r"):
        arm_round(g, side, sleeve=sleeve, puff=1.05)
    hands_round(g)


def firmin_scarf(g, expr):
    """Écharpe de laine de Firmin (cadeau, tour 9): rouge à rayures crème comme l'objet offert (wool_scarf),
    deux tours au cou par-dessus le col, un pan sur la poitrine (frange crème), l'autre rejeté sur l'épaule
    gauche, dans le dos. Pièce à part sur le squelette commun, rangée de Firmin."""
    rings = torso_rings(0.40, 0.34, 0.23, belly=0.05)
    g.cyl(0.108, 0.09, loc=(0, 0.0, 1.39), r2=0.096, color="scarf_mark", segs=10, scale=(1.42, 1.12, 1),
          bone="chest")
    g.cyl(0.11, 0.02, loc=(0, 0.0, 1.405), r2=0.1, color="scarf", segs=10, scale=(1.42, 1.12, 1), bone="chest")
    fy = torso_front_y(1.22, rings) - 0.022
    g.box((0.085, 0.03, 0.32), loc=(0.07, fy, 1.215), color="scarf_mark", rot=(-9, 0, 4), bevel=0.008, bone="chest")
    for z in (1.12, 1.16):
        g.box((0.088, 0.034, 0.018), loc=(0.07 - 0.004 * (1.215 - z) * 10, fy - 0.006 * (1.215 - z) * 10, z),
              color="scarf", rot=(-9, 0, 4), bone="chest")
    for k in range(4):
        g.box((0.012, 0.02, 0.04), loc=(0.04 + k * 0.02, fy - 0.02, 1.04), color="scarf", rot=(-9, 0, 4),
              bone="chest")
    g.box((0.085, 0.03, 0.3), loc=(-0.12, 0.13, 1.28), color="scarf_mark", rot=(12, 0, -12), bevel=0.008,
          bone="chest")


def build_player_base(g, expr):
    if ROUND:
        hc, hx, hy, hz = head_round(g)
        start = set(g.bm.verts)
        # traits à la taille d'origine, yeux réduits et rapprochés: chaque trait tient sur une facette
        # (arête verticale au milieu du visage, bande de facettes centrée sur les yeux), ligne des yeux
        # un peu au-dessus de l'équateur: en vue isométrique, le bas de la boule fuit
        face_features(g, hc + 0.03, hy, expr, k=1.0, eye_k=0.8, eye_x=0.048, lid=0.0065)
        project_on_head(g, start, hx, hy, hz, hc)
        neck(g)
        hands_round(g)
        # 0.12: corps nu-neutre sous les vêtements modulaires (garde_robe.py)
        GR.body(g, PP)
        return
    hc, hx, hy, hz = head_block(g)
    face_features(g, hc, hy, expr)
    neck(g)
    hands(g)


def build_outfit(g, kind):
    if kind == "work":
        torso(g, w_top=0.38, w_bot=0.31, d=0.21)
        pelvis(g)
        collar(g)
        buttons(g, n=3, z0=1.08, z1=1.30, y=-0.108, color="top_trim")
        g.box((0.07, 0.01, 0.06), loc=(0.085, torso_front_y(1.23) - 0.004 if ROUND else -0.108, 1.23),
              color="top_trim", bone="chest")
        belt(g)
        for side in ("l", "r"):
            arm(g, side, sleeve="rolled")
            leg(g, side, thigh="bottom", cuff="bottom")
    elif kind == "smock":
        torso(g, w_top=0.38, w_bot=0.32, d=0.215)
        pelvis(g)
        skirt(g, z_top=1.0, z_bot=0.66, r_top=0.18, r_bot=0.25, color="top", hem="top_trim")
        collar(g)
        buttons(g, n=3, z0=1.10, z1=1.30, y=-0.11, color="top_trim")
        for side in ("l", "r"):
            arm(g, side, sleeve="long")
            leg(g, side, thigh="bottom", cuff="bottom")
    elif kind == "overalls":
        torso(g, w_top=0.38, w_bot=0.31, d=0.21)
        pelvis(g)
        overall_bib(g, color="bottom", straps="bottom", buttons_c="metal")
        collar(g)
        for side in ("l", "r"):
            arm(g, side, sleeve="rolled")
            leg(g, side, thigh="bottom", cuff="top_trim")


# Maillages avec clés de forme ---------------------------------------------------

def make_mesh(name, row, builder, mat, arm, with_face, cells=None):
    """builder(g, expr) construit le maillage; même topologie pour chaque expression."""
    cells = cells or lpl.char_cells(row)
    g = lpl.Geo(cells)
    builder(g, "neutral")
    tris = g.tri_count()
    ob = g.to_object(name, mat)
    if with_face:
        ob.shape_key_add(name="Basis", from_mix=False)
        for expr in EXPRESSIONS[1:]:
            g2 = lpl.Geo(cells)
            builder(g2, expr)
            g2.bm.verts.ensure_lookup_table()
            co = [c for v in g2.bm.verts for c in v.co]
            g2.bm.free()
            sk = ob.shape_key_add(name=expr, from_mix=False)
            assert len(co) == len(sk.data) * 3, (name, expr)
            base = [c for v in ob.data.vertices for c in v.co]
            moved = sum(1 for i in range(0, len(co), 3) if abs(co[i] - base[i]) + abs(co[i + 1] - base[i + 1]) + abs(co[i + 2] - base[i + 2]) > 1e-6)
            assert moved < 120, (name, expr, moved)
            sk.data.foreach_set("co", co)
            sk.value = 0.0
    # maillage à la racine (recommandation glTF pour les maillages à peau), lié au squelette par le modificateur
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    return ob, tris


# Animations -------------------------------------------------------------------

def mirror(pose):
    """Échange gauche et droite (pour les cycles de marche)."""
    out = {}
    for k, v in pose.items():
        if k.endswith("_l"):
            k2 = k[:-2] + "_r"
        elif k.endswith("_r"):
            k2 = k[:-2] + "_l"
        else:
            k2 = k
        if k == "hips_loc":
            out[k2] = v
        elif isinstance(v, tuple):
            out[k2] = (v[0], -v[1], -v[2])
    return out


def merge(*ps):
    out = {}
    for p in ps:
        out.update(p)
    return out


ARMS_DOWN = {"upper_arm_l": (0, 0, 4), "upper_arm_r": (0, 0, -4), "forearm_l": (10, 0, 0), "forearm_r": (10, 0, 0)}
SIT_LEGS = {"hips_loc": (0, -0.36, 0.0), "thigh_l": (86, 0, 2), "thigh_r": (86, 0, -2), "shin_l": (-86, 0, 0),
            "shin_r": (-86, 0, 0), "spine": (-4, 0, 0)}


def walk_keys(swing=30, bob=0.03, arm_sw=24, lean=4, frames=16, arms=None):
    q = frames // 4
    contact = {"thigh_l": (swing, 0, 0), "shin_l": (-6, 0, 0), "foot_l": (8, 0, 0),
               "thigh_r": (-swing * 0.8, 0, 0), "shin_r": (-22, 0, 0), "foot_r": (-14, 0, 0),
               "upper_arm_l": (-arm_sw, 0, 5), "upper_arm_r": (arm_sw, 0, -5),
               "forearm_l": (12, 0, 0), "forearm_r": (28, 0, 0),
               "hips": (0, 6, 0), "spine": (lean, -3, 0), "chest": (0, -5, 0), "head": (-2, 2, 0),
               "hips_loc": (0, -bob * 0.3, 0)}
    passing = {"thigh_l": (2, 0, 0), "shin_l": (-4, 0, 0), "foot_l": (0, 0, 0),
               "thigh_r": (12, 0, 0), "shin_r": (-62, 0, 0), "foot_r": (8, 0, 0),
               "upper_arm_l": (-2, 0, 5), "upper_arm_r": (4, 0, -5), "forearm_l": (14, 0, 0),
               "forearm_r": (16, 0, 0), "hips": (0, 0, 0), "spine": (lean, 0, 0), "chest": (0, 0, 0),
               "head": (-2, 0, 0), "hips_loc": (0, bob, 0)}
    if arms:
        contact.update(arms)
        passing.update(arms)
        c2 = mirror(contact)
        p2 = mirror(passing)
        c2.update(arms)
        p2.update(arms)
    else:
        c2, p2 = mirror(contact), mirror(passing)
    return {0: contact, q: passing, 2 * q: c2, 3 * q: p2, frames: contact}


def anims():
    A = {}
    idle_a = merge(ARMS_DOWN, {"chest": (0, 0, 0), "head": (0, 0, 0)})
    idle_b = merge(ARMS_DOWN, {"chest": (-2.5, 0, 0), "spine": (-1, 0, 0), "head": (-2, 5, 0),
                               "upper_arm_l": (2, 0, 6), "upper_arm_r": (-2, 0, -6), "hips_loc": (0, 0.004, 0)})
    idle_c = merge(ARMS_DOWN, {"chest": (0, 0, 0), "head": (1, -4, 1), "hips_loc": (0, -0.002, 0)})
    A["idle"] = (True, {0: idle_a, 30: idle_b, 60: idle_c, 90: idle_a})
    A["walk"] = (True, walk_keys())
    carry_arms = {"upper_arm_l": (168, 0, 12), "upper_arm_r": (168, 0, -12), "forearm_l": (18, 0, 0),
                  "forearm_r": (18, 0, 0), "hand_l": (20, 0, 0), "hand_r": (20, 0, 0)}
    A["carry_two"] = (True, walk_keys(swing=22, bob=0.02, lean=0, frames=24, arms=carry_arms))
    hold = {"upper_arm_r": (38, 0, 4), "forearm_r": (38, 0, 0), "upper_arm_l": (44, 0, -14),
            "forearm_l": (40, 0, 0), "hand_r": (-20, 0, 0), "hand_l": (-20, 0, 0)}
    raised = {"upper_arm_r": (155, 0, 4), "forearm_r": (25, 0, 0), "upper_arm_l": (150, 0, -12),
              "forearm_l": (28, 0, 0), "spine": (-8, 0, 0), "chest": (-6, 0, 0), "head": (-6, 0, 0),
              "hand_r": (-30, 0, 0), "hand_l": (-30, 0, 0)}
    strike = {"upper_arm_r": (62, 0, 4), "forearm_r": (8, 0, 0), "upper_arm_l": (66, 0, -12),
              "forearm_l": (12, 0, 0), "spine": (24, 0, 0), "chest": (8, 0, 0), "head": (6, 0, 0),
              "hips_loc": (0, -0.05, 0), "thigh_l": (18, 0, 0), "thigh_r": (14, 0, 0), "shin_l": (-30, 0, 0),
              "shin_r": (-26, 0, 0), "foot_l": (12, 0, 0), "foot_r": (12, 0, 0), "hand_r": (-10, 0, 0),
              "hand_l": (-10, 0, 0)}
    A["hoe"] = (True, {0: hold, 11: raised, 16: strike, 23: merge(strike, {"spine": (20, 0, 0)}), 30: hold})
    bag = {"upper_arm_l": (22, 0, -6), "forearm_l": (78, 0, 0), "hand_l": (10, 0, 0)}
    sow_a = merge(bag, {"spine": (14, 0, 0), "chest": (6, 0, 0), "head": (12, 0, 0), "upper_arm_r": (18, 0, -8),
                        "forearm_r": (30, 0, 0), "hand_r": (0, 0, 0)})
    sow_b = merge(bag, {"spine": (18, -6, 0), "chest": (8, -6, 0), "head": (14, -4, 0),
                        "upper_arm_r": (62, 0, -26), "forearm_r": (12, 0, 0), "hand_r": (35, 0, 0),
                        "hips_loc": (0, -0.015, 0)})
    A["sow"] = (True, {0: sow_a, 12: sow_b, 18: merge(sow_b, {"hand_r": (10, 0, 0)}), 30: sow_a})
    can = {"upper_arm_r": (40, 0, -6), "forearm_r": (14, 0, 0), "spine": (8, 0, 0), "head": (14, 0, 0),
           "upper_arm_l": (8, 0, 6), "forearm_l": (16, 0, 0)}
    A["water"] = (True, {0: merge(can, {"hand_r": (0, 0, 0)}),
                         10: merge(can, {"hand_r": (-48, 0, 0), "upper_arm_r": (46, 0, -6)}),
                         20: merge(can, {"hand_r": (-52, 0, 0), "upper_arm_r": (44, 0, -12), "chest": (0, -5, 0)}),
                         30: merge(can, {"hand_r": (-48, 0, 0), "upper_arm_r": (46, 0, 0), "chest": (0, 5, 0)}),
                         40: merge(can, {"hand_r": (0, 0, 0)})})
    stand = merge(ARMS_DOWN, {})
    crouch = {"spine": (34, 0, 0), "chest": (14, 0, 0), "head": (10, 0, 0), "hips_loc": (0, -0.16, 0.02),
              "thigh_l": (58, 0, 6), "thigh_r": (58, 0, -6), "shin_l": (-88, 0, 0), "shin_r": (-88, 0, 0),
              "foot_l": (30, 0, 0), "foot_r": (30, 0, 0), "upper_arm_l": (58, 0, -6), "upper_arm_r": (58, 0, 6),
              "forearm_l": (26, 0, 0), "forearm_r": (26, 0, 0)}
    pull = merge(crouch, {"spine": (20, 0, 0), "hips_loc": (0, -0.1, 0.02), "thigh_l": (40, 0, 6),
                          "thigh_r": (40, 0, -6), "shin_l": (-62, 0, 0), "shin_r": (-62, 0, 0),
                          "foot_l": (22, 0, 0), "foot_r": (22, 0, 0), "upper_arm_l": (52, 0, -8),
                          "upper_arm_r": (52, 0, 8), "forearm_l": (70, 0, 0), "forearm_r": (70, 0, 0)})
    show = merge(stand, {"upper_arm_l": (40, 0, -8), "upper_arm_r": (40, 0, 8), "forearm_l": (95, 0, 0),
                         "forearm_r": (95, 0, 0), "head": (6, 0, 0), "chest": (-4, 0, 0)})
    A["harvest"] = (True, {0: stand, 9: crouch, 15: crouch, 21: pull, 27: show, 36: stand})
    ax_hold = {"upper_arm_r": (30, 0, 8), "forearm_r": (30, 0, 0), "upper_arm_l": (36, 0, -16),
               "forearm_l": (36, 0, 0), "hand_r": (-30, 0, 0), "hand_l": (-30, 0, 0)}
    ax_up = {"upper_arm_r": (130, -20, -30), "forearm_r": (40, 0, 0), "upper_arm_l": (120, 0, -40),
             "forearm_l": (60, 0, 0), "chest": (-6, -26, 0), "spine": (0, -12, 0), "head": (0, 20, 0),
             "hand_r": (-40, 0, 0), "hand_l": (-40, 0, 0), "thigh_l": (8, 0, 0), "thigh_r": (-6, 0, 0)}
    ax_hit = {"upper_arm_r": (82, 0, 18), "forearm_r": (6, 0, 0), "upper_arm_l": (84, 0, -22),
              "forearm_l": (10, 0, 0), "chest": (6, 18, 0), "spine": (10, 8, 0), "head": (0, -10, 0),
              "hand_r": (0, 0, 0), "hand_l": (0, 0, 0), "thigh_l": (14, 0, 0), "shin_l": (-14, 0, 0),
              "hips_loc": (0, -0.03, 0)}
    A["chop"] = (True, {0: ax_hold, 12: ax_up, 17: ax_hit, 23: ax_hit, 32: ax_hold})
    saw_base = {"spine": (22, 0, 0), "chest": (6, 4, 0), "head": (14, 0, 0), "upper_arm_l": (46, 0, -18),
                "forearm_l": (48, 0, 0), "hand_l": (-20, 0, 0), "thigh_l": (10, 0, 0), "shin_l": (-6, 0, 0),
                "thigh_r": (-8, 0, 0)}
    A["saw"] = (True, {0: merge(saw_base, {"upper_arm_r": (22, 0, -6), "forearm_r": (78, 0, 0), "hand_r": (-50, 0, 0)}),
                       9: merge(saw_base, {"upper_arm_r": (58, 0, -6), "forearm_r": (26, 0, 0), "hand_r": (-20, 0, 0),
                                           "chest": (8, -4, 0)}),
                       18: merge(saw_base, {"upper_arm_r": (22, 0, -6), "forearm_r": (78, 0, 0), "hand_r": (-50, 0, 0)})})
    ham_base = {"spine": (18, 0, 0), "head": (16, 0, 0), "upper_arm_l": (38, 0, -14), "forearm_l": (46, 0, 0),
                "hand_l": (-10, 0, 0)}
    A["hammer"] = (True, {0: merge(ham_base, {"upper_arm_r": (70, 0, -4), "forearm_r": (100, 0, 0), "hand_r": (-30, 0, 0)}),
                          8: merge(ham_base, {"upper_arm_r": (44, 0, -4), "forearm_r": (26, 0, 0), "hand_r": (10, 0, 0)}),
                          11: merge(ham_base, {"upper_arm_r": (44, 0, -4), "forearm_r": (30, 0, 0), "hand_r": (0, 0, 0)}),
                          20: merge(ham_base, {"upper_arm_r": (70, 0, -4), "forearm_r": (100, 0, 0), "hand_r": (-30, 0, 0)})})
    t0 = merge(ARMS_DOWN, {"upper_arm_r": (18, 0, -10), "forearm_r": (62, 0, 0), "hand_r": (10, 0, 0), "head": (0, 0, 0)})
    t1 = merge(ARMS_DOWN, {"upper_arm_r": (22, 0, -16), "forearm_r": (82, 20, 0), "hand_r": (-10, 0, 0),
                           "upper_arm_l": (14, 0, 10), "forearm_l": (50, 0, 0), "head": (-4, 4, -3), "chest": (0, 4, 0)})
    t2 = merge(ARMS_DOWN, {"upper_arm_r": (14, 0, -8), "forearm_r": (54, 0, 0), "head": (4, -2, 2),
                           "upper_arm_l": (20, 0, 14), "forearm_l": (70, -20, 0), "chest": (0, -4, 0)})
    A["talk"] = (True, {0: t0, 15: t1, 30: t2, 45: merge(t1, {"head": (2, 6, 0)}), 60: t0})
    give = merge(ARMS_DOWN, {"upper_arm_l": (66, 0, -8), "upper_arm_r": (66, 0, 8), "forearm_l": (18, 0, 0),
                             "forearm_r": (18, 0, 0), "hand_l": (-24, 0, 0), "hand_r": (-24, 0, 0),
                             "spine": (8, 0, 0), "head": (6, 0, 0)})
    A["give"] = (False, {0: ARMS_DOWN, 10: give, 22: give, 32: ARMS_DOWN})
    sit = merge(SIT_LEGS, {"upper_arm_l": (22, 0, 0), "upper_arm_r": (22, 0, 0), "forearm_l": (42, 0, 0),
                           "forearm_r": (42, 0, 0), "hand_l": (10, 0, 0), "hand_r": (10, 0, 0)})
    A["sit"] = (True, {0: sit, 40: merge(sit, {"chest": (-2.5, 0, 0), "head": (-2, 4, 0), "hips_loc": (0, -0.356, 0)}),
                       80: sit})
    eat_a = {"upper_arm_r": (40, 0, -12), "forearm_r": (96, 0, 0), "hand_r": (-10, 0, 0), "upper_arm_l": (34, 0, 6),
             "forearm_l": (64, 0, 0), "head": (6, 0, 0)}
    eat_b = merge(eat_a, {"upper_arm_r": (52, 0, -18), "forearm_r": (132, 0, 0), "head": (-2, 0, 0)})
    A["eat"] = (True, {0: merge(ARMS_DOWN, eat_a), 12: merge(ARMS_DOWN, eat_b), 20: merge(ARMS_DOWN, eat_b, {"head": (2, 0, 0)}),
                       34: merge(ARMS_DOWN, eat_a)})
    A["sit_eat"] = (True, {0: merge(SIT_LEGS, eat_a), 12: merge(SIT_LEGS, eat_b),
                           20: merge(SIT_LEGS, eat_b, {"head": (2, 0, 0)}), 34: merge(SIT_LEGS, eat_a)})
    sleep = {"hips": (-90, 0, 0), "hips_loc": (0, -0.31, 0.0), "upper_arm_l": (0, 0, 8), "upper_arm_r": (0, 0, -8),
             "forearm_l": (12, 0, 0), "forearm_r": (12, 0, 0), "head": (-6, 18, 0), "foot_l": (-30, 0, 4),
             "foot_r": (-30, 0, -4), "thigh_l": (6, 0, 3), "thigh_r": (2, 0, -3), "shin_l": (-8, 0, 0)}
    A["sleep"] = (True, {0: sleep, 50: merge(sleep, {"chest": (-3, 0, 0), "spine": (-1, 0, 0)}), 100: sleep})
    w0 = merge(ARMS_DOWN, {"upper_arm_r": (12, 0, -150), "forearm_r": (0, 0, -18), "hand_r": (0, 0, -10),
                           "head": (0, 0, 4), "chest": (0, 0, 3)})
    w1 = merge(w0, {"forearm_r": (0, 0, 20), "hand_r": (0, 0, 10)})
    A["wave"] = (True, {0: w0, 8: w1, 16: w0, 24: w1, 32: w0})
    # P1 (démo): caresser une poule, se taper dans la main
    pet = merge(crouch, {"upper_arm_r": (62, 0, 4), "forearm_r": (20, 0, 0), "upper_arm_l": (30, 0, 4),
                         "forearm_l": (60, 0, 0)})
    A["pet"] = (True, {0: pet, 12: merge(pet, {"upper_arm_r": (56, 0, 0), "hand_r": (20, 0, 0)}), 24: pet})
    hf = merge(ARMS_DOWN, {"upper_arm_r": (150, 0, -10), "forearm_r": (10, 0, 0), "hand_r": (-20, 0, 0),
                           "chest": (-4, 0, 0)})
    A["high_five"] = (False, {0: ARMS_DOWN, 8: hf, 12: merge(hf, {"upper_arm_r": (140, 0, -6), "spine": (6, 0, 0)}),
                              24: ARMS_DOWN})
    # Pêche (canne de ferme.glb dans socket_hand_r: au repos elle monte à 42 degrés devant la main;
    # la pente de la canne vaut 42 degrés + la somme des flexions bras, avant-bras, main et buste)
    wait = {"upper_arm_r": (18, 0, -6), "forearm_r": (24, 0, 0), "hand_r": (-45, 0, 0),
            "upper_arm_l": (16, 0, 10), "forearm_l": (34, 0, 0), "hand_l": (0, 0, 0),
            "spine": (-2, 0, 0), "head": (8, 0, 0), "hips": (0, 0, 2), "thigh_l": (4, 0, 0), "thigh_r": (-2, 0, -3)}
    wait_b = merge(wait, {"hand_r": (-41, 0, 0), "chest": (-2, 0, 0), "head": (6, 4, 0), "hips_loc": (0, 0.004, 0)})
    A["fish_wait"] = (True, {0: wait, 45: wait_b, 90: wait})
    wind = merge(wait, {"upper_arm_r": (150, 0, -10), "forearm_r": (30, 0, 0), "hand_r": (-40, 0, 0),
                        "chest": (-4, 16, 0), "spine": (-6, 6, 0), "head": (-4, -10, 0),
                        "upper_arm_l": (30, 0, 14), "forearm_l": (50, 0, 0), "thigh_r": (-10, 0, -3), "thigh_l": (10, 0, 0)})
    snap = merge(wait, {"upper_arm_r": (78, 0, -6), "forearm_r": (10, 0, 0), "hand_r": (-28, 0, 0),
                        "chest": (6, -10, 0), "spine": (6, -4, 0), "head": (4, 4, 0), "thigh_l": (16, 0, 0),
                        "shin_l": (-10, 0, 0), "hips_loc": (0, -0.02, 0)})
    release = merge(wait, {"upper_arm_r": (32, 0, -6), "forearm_r": (10, 0, 0), "hand_r": (-46, 0, 0),
                           "chest": (6, -4, 0), "spine": (8, 0, 0), "head": (8, 0, 0), "thigh_l": (12, 0, 0),
                           "shin_l": (-8, 0, 0), "hips_loc": (0, -0.015, 0)})
    A["fish_cast"] = (False, {0: wait, 10: wind, 14: snap, 18: release, 30: wait})
    lift = merge(wait, {"upper_arm_r": (62, 0, -6), "forearm_r": (56, 0, 0), "hand_r": (-30, 0, 0),
                        "upper_arm_l": (42, 0, 20), "forearm_l": (70, 0, 0), "spine": (-10, 0, 0), "chest": (-6, 0, 0),
                        "head": (-4, 0, 0), "thigh_l": (14, 0, 0), "shin_l": (-10, 0, 0), "thigh_r": (-8, 0, -3),
                        "hips_loc": (0, -0.02, 0)})
    reel_a = merge(lift, {"upper_arm_r": (50, 0, -6), "forearm_r": (40, 0, 0), "upper_arm_l": (40, 0, 22),
                          "forearm_l": (58, 0, 0), "hand_l": (20, 0, 0), "spine": (-4, 0, 0)})
    reel_b = merge(reel_a, {"forearm_l": (88, 0, 0), "hand_l": (-15, 0, 0), "upper_arm_l": (46, 0, 18)})
    A["fish_strike"] = (False, {0: wait, 5: lift, 10: merge(lift, {"spine": (-12, 0, 0)}), 16: reel_a, 21: reel_b,
                                26: reel_a, 31: reel_b, 36: reel_a, 48: wait})
    # Assis par terre (absence, veillée sur la paillasse): bassin au sol, genoux levés, bras autour des jambes
    ground = {"hips_loc": (0, -0.74, 0.0), "spine": (12, 0, 0), "chest": (4, 0, 0), "head": (-6, 0, 0),
              "thigh_l": (128, 0, 8), "thigh_r": (128, 0, -8), "shin_l": (-108, 0, 0), "shin_r": (-108, 0, 0),
              "foot_l": (-20, 0, 0), "foot_r": (-20, 0, 0), "upper_arm_l": (30, 0, -6), "upper_arm_r": (30, 0, 6),
              "forearm_l": (40, 0, 0), "forearm_r": (40, 0, 0), "hand_l": (10, 0, 0), "hand_r": (10, 0, 0)}
    ground_b = merge(ground, {"chest": (2, 0, 0), "head": (-8, 8, 0), "hips_loc": (0, -0.736, 0.0)})
    A["sit_ground"] = (True, {0: ground, 45: ground_b, 90: ground})
    A.update(ladder_anims())
    A.update(tour9_anims())
    # 0.12: gestes plus vivants et clips nouveaux (animations_012.py), mêmes noms et mêmes contacts
    animations_012.anims_012(A, SIT_LEGS)
    return A


def tour9_anims():
    """Clips des moments du tour 9 (tour-09-conception.md, 4.1 à 4.4), sur le squelette commun."""
    A = {}
    # Étoiles de l'Aubrune: assis au bord du ponton (même assise que sit: placer la racine sous le bord, 0,47 m
    # plus bas que le plancher), jambes qui pendent au-dessus de l'eau et se balancent en décalé, mains posées sur
    # le plancher à côté des hanches. Boucle de 4 s.
    edge = merge(SIT_LEGS, {"thigh_l": (84, 0, 3), "thigh_r": (84, 0, -3), "spine": (4, 0, 0), "chest": (2, 0, 0),
                            "upper_arm_l": (-14, 0, 10), "upper_arm_r": (-14, 0, -10), "forearm_l": (12, 0, 0),
                            "forearm_r": (12, 0, 0), "hand_l": (70, 0, 0), "hand_r": (70, 0, 0)})

    def swing(a, b):
        return {"shin_l": (-a, 0, 0), "shin_r": (-b, 0, 0), "foot_l": (a - 80, 0, 0), "foot_r": (b - 80, 0, 0)}
    A["sit_edge"] = (True, {0: merge(edge, swing(70, 100)), 30: merge(edge, swing(100, 70), {"head": (2, 6, 0)}),
                            60: merge(edge, swing(70, 100)), 90: merge(edge, swing(100, 70), {"head": (2, -5, 0)}),
                            120: merge(edge, swing(70, 100))})
    # regarder le ciel, toujours assis au bord (1,5 s, une fois): la tête bascule en arrière, le buste suit
    up = merge(edge, swing(85, 85), {"neck": (-14, 0, 0), "head": (-34, 0, 0), "chest": (-8, 0, 0), "spine": (-4, 0, 0)})
    A["look_up"] = (False, {0: merge(edge, swing(85, 85)), 18: up, 45: merge(up, {"head": (-36, 4, 0)})})
    # Salut du mécanicien: les deux mains sur le volant de la manivelle (1,0 m, à 0,4 m devant), puis la main
    # droite tourne la poignée (un tour par seconde, cercle de 0,15 m face au joueur), la gauche tient le poteau
    hold = {"spine": (8, 0, 0), "chest": (4, 0, 0), "head": (10, 0, 0), "upper_arm_l": (40, 0, 8), "forearm_l": (14, 0, 0),
            "hand_l": (-10, 0, 0), "upper_arm_r": (40, 0, -8), "forearm_r": (14, 0, 0), "hand_r": (-10, 0, 0),
            "thigh_l": (6, 0, 0), "thigh_r": (-4, 0, 0)}
    A["crank_hold"] = (True, {0: hold, 30: merge(hold, {"chest": (6, 0, 0), "hips_loc": (0, -0.006, 0)}), 60: hold})
    turn = merge(hold, {"upper_arm_l": (34, 0, 14), "forearm_l": (24, 0, 0)})
    A["crank_turn"] = (True, {0: merge(turn, {"upper_arm_r": (56, 0, -8), "forearm_r": (6, 0, 0)}),
                              8: merge(turn, {"upper_arm_r": (42, 0, -22), "forearm_r": (10, 0, 0), "chest": (4, -4, 0)}),
                              15: merge(turn, {"upper_arm_r": (28, 0, -8), "forearm_r": (22, 0, 0)}),
                              23: merge(turn, {"upper_arm_r": (42, 0, 6), "forearm_r": (14, 0, 0), "chest": (4, 4, 0)}),
                              30: merge(turn, {"upper_arm_r": (56, 0, -8), "forearm_r": (6, 0, 0)})})
    # répondre au salut: grand geste du bras droit levé, de tout le bras, buste qui suit
    wb0 = merge(ARMS_DOWN, {"upper_arm_r": (20, 0, -160), "forearm_r": (0, 0, -10), "hand_r": (0, 0, -6),
                            "chest": (-4, 0, 6), "head": (-6, 0, 6)})
    wb1 = merge(wb0, {"upper_arm_r": (20, 0, -132), "forearm_r": (0, 0, 24), "chest": (-4, 0, 2)})
    A["wave_back"] = (True, {0: wb0, 9: wb1, 18: wb0, 27: wb1, 36: wb0})
    # Lanternes du quai: perche (lamp_pole, portée à l'horizontale le long du corps) prise devant la poitrine,
    # dressée (0 s), puis levée vers la lanterne, inclinée de 20 degrés vers l'avant, le bout à 2,8 m et 0,9 m
    # devant (0,6 s); pole_lower fait le chemin inverse (0,5 s). La perche suit la main droite: sa pente vaut
    # 90 degrés moins la somme des flexions bras, avant-bras et main.
    pole_hold = merge(ARMS_DOWN, {"upper_arm_r": (30, 0, -6), "forearm_r": (90, 0, 0), "hand_r": (-30, 0, 0),
                                  "upper_arm_l": (34, 0, 18), "forearm_l": (70, 0, 0), "hand_l": (-10, 0, 0)})
    pole_up = merge(ARMS_DOWN, {"upper_arm_r": (110, 0, -4), "forearm_r": (10, 0, 0), "hand_r": (-50, 0, 0),
                                "upper_arm_l": (80, 0, 16), "forearm_l": (34, 0, 0), "hand_l": (-20, 0, 0),
                                "spine": (-6, 0, 0), "chest": (-6, 0, 0), "head": (-22, 0, 0)})
    A["pole_raise"] = (False, {0: pole_hold, 10: merge(pole_up, {"head": (-16, 0, 0)}), 18: pole_up})
    A["pole_lower"] = (False, {0: pole_up, 15: pole_hold})
    # Équipage (bustes): le mécanicien se penche à la fenêtre et salue de la main gauche (côté quai)
    lean = {"spine": (14, 0, 6), "chest": (8, 0, 8), "head": (-6, 0, 10), "upper_arm_l": (30, 0, 14),
            "forearm_l": (60, 0, 0), "upper_arm_r": (20, 0, -6), "forearm_r": (50, 0, 0)}
    A["driver_lean"] = (True, {0: lean, 45: merge(lean, {"head": (-4, 0, 16), "chest": (9, 0, 9)}), 90: lean})
    dw0 = merge(lean, {"upper_arm_l": (20, 0, 150), "forearm_l": (0, 0, 16), "hand_l": (0, 0, 8)})
    dw1 = merge(dw0, {"forearm_l": (0, 0, -22), "hand_l": (0, 0, -10)})
    A["driver_wave"] = (True, {0: dw0, 8: dw1, 16: dw0, 24: dw1, 32: dw0})
    return A


# Échelle de Basile (tour 6, docs/jeux/jeu-1/tour-06-conception.md section 1.4.3) ----------------------
# Poses calculées par une cinématique inverse plane: pieds sur les barreaux, mains sur les montants de
# ladder_wood (faune.glb: 75 degrés, barreaux tous les 0,28 m de hauteur, montants à x +-0,20).
# Repère du personnage: f vers l'avant, z vers le haut depuis la racine, x vers sa gauche.

LAD_TAN = math.tan(math.radians(15))   # avance du plan de l'échelle par mètre de hauteur
RUNG = 0.28
L_THIGH, L_SHIN, L_UP, L_FORE = 0.41, 0.395, 0.2658, 0.235


def _ik2(df, dz, l1, l2):
    """(direction de la cible depuis la verticale basse, vers l'avant; écart du premier os; flexion), en radians."""
    d = max(min(math.hypot(df, dz), (l1 + l2) * 0.999), abs(l1 - l2) + 1e-3)
    phi = math.atan2(df, -dz)
    a = math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))
    g = math.acos((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))
    return phi, a, math.pi - g


def _body(u, w, sg, c):
    """Positions (f, z) de la hanche et des épaules pour hips_loc (0, u, w), buste penché de sg puis c degrés."""
    s1, s2 = math.radians(sg), math.radians(sg + c)
    hip = (w, 0.89 + u)
    sh = (w + 0.16 * math.sin(s1) + 0.17 * math.sin(s2), 0.90 + u + 0.10 + 0.16 * math.cos(s1) + 0.17 * math.cos(s2))
    return hip, sh


def _leg(side, hip, ankle):
    phi, a, bend = _ik2(ankle[0] - hip[0], ankle[1] - hip[1], L_THIGH, L_SHIN)
    t = phi + a
    return {"thigh_" + side: (math.degrees(t), 0, 0), "shin_" + side: (-math.degrees(bend), 0, 0),
            "foot_" + side: (-math.degrees(t - bend), 0, 0)}


def _arm(side, sh, lean, target, l2=L_FORE + 0.045, hand=None):
    """Bras vers target (f, x, z), épaule à x +-0,205; lean = inclinaison du buste (degrés)."""
    xs = 0.205 if side == "l" else -0.205
    df, dx, dz = target[0] - sh[0], target[1] - xs, target[2] - sh[1]
    phi, a, bend = _ik2(math.hypot(df, dx), dz, L_UP, l2)
    up = phi - a
    yaw = math.degrees(math.atan2(dx, df))
    out = {"upper_arm_" + side: (math.degrees(up) + lean, -yaw, 0), "forearm_" + side: (math.degrees(bend), 0, 0)}
    out["hand_" + side] = hand(math.degrees(up + bend)) if hand else (0, 0, 0)
    return out


def _plane(z):
    return LAD_TAN * z


CLIMB = {"u": -0.17, "w": -0.16, "sg": 14, "c": 4}


def climb_pose(p):
    """Pose de montée à la phase p (0 à 1 = deux barreaux, 1,2 s); la racine monte de 0,56 m par cycle."""
    hip, sh = _body(CLIMB["u"], CLIMB["w"], CLIMB["sg"], CLIMB["c"])
    pose = {"hips_loc": (0, CLIMB["u"], CLIMB["w"]), "spine": (CLIMB["sg"], 0, 0), "chest": (CLIMB["c"], 0, 0),
            "head": (-16, 0, 0), "neck": (-4, 0, 0)}
    lean = CLIMB["sg"] + CLIMB["c"]

    def limb(q, hi, back):
        q %= 1.0
        if q < 0.75:
            return hi - 2 * RUNG * q, 0.0
        t = (q - 0.75) / 0.25
        sm = t * t * (3 - 2 * t)
        return hi - 1.5 * RUNG + 1.5 * RUNG * sm, back * math.sin(math.pi * t)
    for side, q in (("l", p), ("r", p + 0.5)):
        z, back = limb(q, RUNG, 0.13)
        pose.update(_leg(side, hip, (_plane(z) - 0.08 - back, z + 0.102)))
    # main droite avec le pied gauche, main gauche avec le pied droit
    for side, q in (("r", p), ("l", p + 0.5)):
        z, back = limb(q, 1.48, 0.09)
        pose.update(_arm(side, sh, lean, (_plane(z) - 0.04 - back, 0.2 if side == "l" else -0.2, z)))
    return pose


def ladder_anims():
    A = {}
    A["climb_ladder"] = (True, {f: climb_pose(f / 36) for f in range(0, 37, 3)})
    start = climb_pose(0.5)
    # Basile en haut: pied gauche sur le barreau, pied droit un barreau plus haut, main gauche au montant.
    # Nichoir penché (le bas vers l'est) à sa droite: il prend le coin bas côté échelle et le ramène.
    feet = {k: v for k, v in start.items() if k.startswith(("thigh", "shin", "foot"))}

    def lean_pose(sg, c, rh, hand=None, head=(-10, 0, -14)):
        hip, sh = _body(CLIMB["u"], CLIMB["w"], sg, c)
        pose = dict(feet, hips_loc=(0, CLIMB["u"], CLIMB["w"]), spine=(sg, 0, 0), chest=(c, 0, 0), head=head)
        pose.update(_arm("l", sh, sg + c, (_plane(1.48) - 0.04, 0.2, 1.48)))
        pose.update(_arm("r", sh, sg + c, rh, l2=L_FORE + (0.0 if hand else 0.045), hand=hand))
        return pose
    tilted, straight = (0.42, -0.31, 0.894), (0.333, -0.223, 0.90)
    A["reach_up"] = (False, {0: start, 9: lean_pose(22, 8, tilted), 15: lean_pose(22, 8, tilted),
                             24: lean_pose(20, 6, straight)})
    # Marteau (ferme.glb, sous socket_hand_r): manche à l'horizontale vers l'avant, main retournée (tête de
    # frappe vers le bas); il tape le haut du nichoir, côté échelle. Choc à 0,25 s.
    head_pt = (0.443, -0.134, 1.16)

    def tap(raise_deg):
        wrist = (head_pt[0] - 0.31 - 0.045, head_pt[1], head_pt[2] + 0.09)

        def hand(abs_deg):
            return (-(90 + raise_deg - abs_deg), 180, 0)
        return lean_pose(20, 6, wrist, hand=hand, head=(-4, 0, -16))
    A["hammer_tap"] = (True, {0: tap(28), 5: tap(22), 7.5: tap(0), 10: tap(8), 18: tap(28)})

    # Joueurs: tenir l'échelle, face au montant (0,35 m devant), mains à 0,9 et 1,2 m, pieds écartés.
    def hold(sg, head):
        hip, sh = _body(-0.01, 0.02, sg, 4)
        pose = {"hips_loc": (0, -0.01, 0.02), "spine": (sg, 0, 0), "chest": (4, 0, 0), "head": head,
                "thigh_l": (-4, 0, 7), "thigh_r": (4, 0, -7), "shin_l": (-6, 0, 0), "shin_r": (-6, 0, 0),
                "foot_l": (8, 0, -4), "foot_r": (2, 0, 4)}
        pose.update(_arm("r", sh, sg + 4, (0.31, -0.02, 1.2)))
        pose.update(_arm("l", sh, sg + 4, (0.31, 0.02, 0.9)))
        return pose
    A["hold_ladder"] = (True, {0: hold(9, (-22, 0, 0)), 30: hold(11, (-24, 4, 0)), 60: hold(9, (-22, 0, 0))})
    return A


def bake_actions(arm, A):
    arm.animation_data_create()
    names = []
    for name, (loop, keys) in A.items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        arm.animation_data.action = act
        frames = sorted(keys)
        for f in frames:
            pose = keys[f]
            for b in BONE_NAMES:
                pb = arm.pose.bones[b]
                r = pose.get(b, (0, 0, 0))
                pb.rotation_euler = tuple(math.radians(a) for a in r)
                pb.keyframe_insert("rotation_euler", frame=f)
            hb = arm.pose.bones["hips"]
            hb.location = pose.get("hips_loc", (0, 0, 0))
            hb.keyframe_insert("location", frame=f)
        act.use_frame_range = True
        act.frame_start, act.frame_end = frames[0], frames[-1]
        if loop:
            slot = arm.animation_data.action_slot
            cb = anim_utils.action_get_channelbag_for_slot(act, slot)
            for fc in cb.fcurves:
                fc.modifiers.new("CYCLES")
                fc.update()
        names.append((name, frames[-1] / FPS, loop))
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    return names


# Programme -----------------------------------------------------------------

NPCS = ["firmin", "odette", "basile", "jeanne", "lucie", "achille", "solange"]
HAIRS = ["short", "bob", "bun"] + coiffures.NEW_CUTS
OUTFITS = ["work", "smock", "overalls"]
SYMBOLS = ["orb", "crescent", "star", "sun", "planet", "comet"]


def build_props_013(mat, stats):
    """Accessoires de la 0.13 (objets fixes, sans squelette, matériau des personnages): vélos poussés à la main
    (roues en nœuds enfants), cartable, pot à lait, hache de bûcheron, accordéon."""
    out = []

    def static(name, row, fn, extras):
        g = lpl.Geo(lpl.char_cells(row))
        fn(g)
        stats["meshes"][name] = g.tri_count()
        ob = g.to_object(name, mat)
        for k, v in extras.items():
            ob[k] = v
        out.append(ob)
        return ob
    held = "origine à la prise: accrocher sous socket_hand_r (ou socket_hand_l) sans transformation"
    static("school_satchel", "props", H13.school_satchel, {"kind": "carried", "owner": "armand", "note": held})
    static("milk_can", "props", H13.milk_can, {"kind": "carried", "owner": "margot", "note": held})
    static("felling_axe", "props", H13.felling_axe, {"kind": "tool", "owner": "barnabe", "socket": "socket_hand_r",
                                                     "note": held + "; fer en bas, tranchant vers l'avant"})
    static("accordion", "props", H13.accordion, {"kind": "carried", "owner": "colette",
                                                 "note": "origine au centre: tenir devant la poitrine (carry_one_idle), "
                                                         "clavier côté main droite"})
    hb = H13.HAND_ON_BAR
    for who in ("lucie", "martial", "nour"):
        name = "bicycle_" + who
        g = H13.bicycle(lambda: lpl.Geo(lpl.char_cells("bicycles")), who)
        tris = g.tri_count()
        ob = g.to_object(name, mat)
        ob["kind"] = "pushed"
        ob["owner"] = who
        ob["wheel_radius"] = H13.WHEEL_R
        ob["hand_l"] = [round(hb.x, 3), round(hb.z, 3), round(-hb.y, 3)]
        ob["note"] = ("poser avec la position et l'orientation de celui qui le pousse (clips push_bike et "
                      "push_bike_idle): vélo à sa gauche, poignée sous sa main gauche (hand_l, repère glTF); "
                      "roues: tourner les enfants _wheel_front et _wheel_rear autour de leur X local, "
                      "angle = distance parcourue / wheel_radius")
        out.append(ob)
        for part, y in (("front", H13.AXLE_FRONT), ("rear", H13.AXLE_REAR)):
            gw = H13.wheel(lpl.Geo(lpl.char_cells("bicycles")))
            tris += gw.tri_count()
            w = gw.to_object(name + "_wheel_" + part, mat, parent=ob, loc=(H13.BIKE_X, y, H13.WHEEL_R))
            out.append(w)
        stats["meshes"][name] = tris
    return out


def main():
    lpl.reset()
    tex = lpl.build_char_texture()
    mat = lpl.palette_material("lpl_characters", tex)
    arm = build_rig()
    sockets = [add_socket(arm, "socket_hand_r", "hand_r", Vector((-0.238, -0.004, 0.785))),
               add_socket(arm, "socket_hand_l", "hand_l", Vector((0.238, -0.004, 0.785)))]
    objs = [arm] + sockets
    stats = {"meshes": {}}

    def add(name, row, builder, face, cells=None):
        ob, tris = make_mesh(name, row, builder, mat, arm, face, cells)
        objs.append(ob)
        stats["meshes"][name] = tris
        return ob

    add("player_base", "player_a", rounded(build_player_base), True, GR.wear_cells())
    for o in OUTFITS:
        add("player_outfit_" + o, "player_a", rounded(lambda g, e, o=o: build_outfit(g, o)), False)
    for h in HAIRS:
        add("player_hair_" + h, "player_a", rounded(lambda g, e, h=h: hair_style(g, h, PHC, PK)), False)
    # tour 10: barbe courte, barbe fournie, moustache (pièces des joueurs au choix, couleur des cheveux)
    for f in coiffures.FACIAL:
        name = "player_" + f if f == "mustache" else "player_" + f
        add(name, "player_a", rounded(lambda g, e, f=f: coiffures.facial(g, f, PHC)), False)
    # 0.12 (garde-robe): plus de foulard; vêtements modulaires, badge du profil, coupes sous un chapeau
    wc = GR.wear_cells()
    for slot, styles in GR.STYLES.items():
        for st in styles:
            if slot == "hat":
                fn = (lambda g, e, st=st: GR.hat(g, PP, st, PHC))
            else:
                fn = (lambda g, e, slot=slot, st=st: getattr(GR, slot)(g, PP, st))
            ob = add(f"wear_{slot}_{st}", "player_a", rounded(fn), False, wc)
            ob["slot"] = slot
            if (slot, st) in GR.COVERS:
                ob["covers"] = GR.COVERS[(slot, st)]
    for s in SYMBOLS:
        add("player_badge_" + s, "player_a", rounded(lambda g, e, s=s: GR.badge(g, PP, s)), False)
        add("player_badge_" + s + "_outer", "player_a", rounded(lambda g, e, s=s: GR.badge(g, PP, s, True)), False)

    def hair_hat(g, e, h):
        coiffures.STRANDS = False
        try:
            hair_style(g, h, PHC, PK)
        finally:
            coiffures.STRANDS = True
        GR.flatten_under_hat(g, PHC, *PHEAD)
    for h in HAIRS:
        add("player_hair_" + h + "_hat", "player_a", rounded(lambda g, e, h=h: hair_hat(g, e, h)), False)
    for n in NPCS:
        ob = add("villager_" + n, n, rounded(lambda g, e, n=n: build_npc_round(g, n, e)), True)
        if n == "jeanne":
            ob["scale"] = 0.75
    # 0.13 (lot H6): quatorze habitants nouveaux (habitants_013.py), même squelette et mêmes expressions
    for n in H13.VILLAGERS:
        ob = add("villager_" + n, n, rounded(lambda g, e, n=n: H13.build(g, n, e)), True)
        ob["scale"] = H13.SCALES[n]
    for name, raised in (("villager_ambroise_loupe", False), ("villager_ambroise_loupe_up", True)):
        ob = add(name, "ambroise", rounded(lambda g, e, r=raised: H13.ambroise_loupe(g, e, r)), False)
        ob["note"] = ("loupe d'horloger d'Ambroise, à montrer avec villager_ambroise: " +
                      ("relevée sur le front (en marchant)" if raised else "à l'oeil gauche (au travail)"))
    objs.extend(build_props_013(mat, stats))
    # tour 9: écharpe de Firmin (pièce à montrer avec villager_firmin en automne et en hiver), équipage du train
    add("villager_firmin_scarf", "firmin", rounded(firmin_scarf), False)
    for who in ("driver", "stoker"):
        ob = add("rail_crew_" + who, who, rounded(lambda g, e, who=who: build_crew_round(g, who, e)), True)
        ob["note"] = "buste (pas de jambes): racine au plancher de la cabine, clips driver_lean et driver_wave"

    A = anims()
    stats["push_bike_hand_error_m"] = round(H13.push_bike_clips(A, arm), 4)
    names = bake_actions(arm, A)
    stats["animations"] = [{"name": n, "seconds": round(d, 3), "loop": lp} for n, d, lp in names]
    path = os.path.join(lpl.OUT, "personnages.glb")
    size = lpl.export_glb(path, objs, animation_mode="ACTIONS")
    stats["file_bytes"] = size
    # personnage complet d'un joueur: base + tenue + coiffure + foulard
    m = stats["meshes"]
    stats["player_example_tris"] = (m["player_base"] + m["wear_top_chemise"] + m["wear_bottom_pantalon"]
                                    + m["wear_shoes_bottines"] + m["player_hair_short"] + m["player_badge_orb"])
    # pire cas: le style le plus lourd de chaque emplacement, la coupe la plus lourde et sa barbe
    worst = m["player_base"] + max(m["player_badge_" + s + "_outer"] for s in SYMBOLS)
    for slot, styles in GR.STYLES.items():
        if slot not in ("top", "bottom"):
            worst += max(m[f"wear_{slot}_{st}"] for st in styles)
    # la salopette couvre le haut: le haut n'est pas dessiné avec elle
    top_max = max(m["wear_top_" + st] for st in GR.STYLES["top"])
    worst += max(m["wear_bottom_" + st] + (0 if ("bottom", st) in GR.COVERS else top_max) for st in GR.STYLES["bottom"])
    # sans chapeau, la coupe la plus lourde garde ses mèches; avec chapeau, sa variante aplatie
    hat_max = max(m["wear_hat_" + st] for st in GR.STYLES["hat"])
    worst -= hat_max
    worst += max(hat_max + max(m["player_hair_" + h + "_hat"] for h in HAIRS),
                 max(m["player_hair_" + h] for h in HAIRS)) + m["player_beard_full"]
    stats["player_worst_tris"] = worst
    lpl.write_stats("personnages", stats)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "personnages.blend"), compress=True)
    print("STATS", stats)


if __name__ == "__main__":
    main()
