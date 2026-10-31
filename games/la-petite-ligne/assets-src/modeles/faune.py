"""Faune et objets des moments rares (tour 6): héron, oie, mésange bleue, renard, échelle, nichoir,
chicot du chêne, brin de mousse.

Lancer: duo-python faune.py
Produit: assets/modeles/faune.glb, stats/faune.json, blend/faune.blend

Conventions propres à ce fichier (fiches: docs/jeux/jeu-1/tour-06-conception.md, section 1.4):
- chaque bête a son propre squelette (nœud racine du nom de la bête, maillage enfant `<bête>_mesh`),
  peau rigide par pièce comme la poule; animations sur place, la racine ne bouge pas;
- tailles réelles, sauf la mésange et sa mousse, agrandies de TIT_SCALE (lisibilité au zoom 1);
- origine au sol entre les pattes, sauf l'oie (ligne de flottaison) et les objets dont la fiche fixe
  le pivot (nichoir: le clou; chicot: le bout où se pose la mésange; échelle: milieu du pied);
- les poses sont écrites en rotations du repère du squelette (x: tangage, positif = le bout d'un os
  tourné vers l'avant descend; y: roulis; z: lacet, positif = vers la gauche de la bête), relatives au
  parent; Rig.pose les traduit en quaternions locaux.
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402

FPS = 30
# Mésange bleue (0,12 m) et martin-pêcheur: 7 à 10 pixels au zoom 1 à taille réelle. x 1,5 décidé sur
# la capture docs/jeux/jeu-1/gauntlet/captures/tour-06/faune-mesange-zoom1.png.
TIT_SCALE = 1.5
LADDER_ANGLE = 75.0      # degrés au-dessus du sol
LADDER_LENGTH = 3.0
RUNG_STEP = 0.28         # écart vertical des barreaux (5 barreaux = 1,40 m, comme la fiche)


# Squelettes ------------------------------------------------------------------------

def _rot(spec):
    """Rotation du repère du squelette: (x, y, z) en degrés appliqués dans cet ordre, ou [(axe, degrés), ...]."""
    m = Matrix.Identity(3)
    if spec is None:
        return m
    seq = spec if isinstance(spec, list) else list(zip("xyz", spec))
    for ax, deg in seq:
        m = Matrix.Rotation(math.radians(deg), 3, ax.upper()) @ m
    return m


def mirror(pose):
    """Échange gauche et droite d'une pose (les noms en _l et _r)."""
    out = {}
    for k, v in pose.items():
        k2 = k[:-2] + "_r" if k.endswith("_l") else k[:-2] + "_l" if k.endswith("_r") else k
        w = dict(v)
        r = w.get("r")
        if r is not None:
            w["r"] = [(a, d if a == "x" else -d) for a, d in r] if isinstance(r, list) else (r[0], -r[1], -r[2])
        if "l" in w:
            w["l"] = (-w["l"][0], w["l"][1], w["l"][2])
        out[k2] = w
    return out


def merge(*poses):
    out = {}
    for p in poses:
        for k, v in p.items():
            out[k] = dict(out.get(k, {}), **v)
    return out


def R(x=0.0, y=0.0, z=0.0):
    return {"r": (x, y, z)}


class Rig:
    def __init__(self, name, bones):
        ad = bpy.data.armatures.new(name)
        self.arm = arm = bpy.data.objects.new(name, ad)
        bpy.context.scene.collection.objects.link(arm)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="EDIT")
        for bname, head, tail, parent in bones:
            eb = ad.edit_bones.new(bname)
            eb.head, eb.tail = head, tail
            if parent:
                eb.parent = ad.edit_bones[parent]
                eb.use_connect = False
            d = (Vector(tail) - Vector(head)).normalized()
            eb.align_roll(Vector((0, -1, 0)) if abs(d.z) > 0.7 else Vector((0, 0, 1)))
        bpy.ops.object.mode_set(mode="OBJECT")
        self.names = [b[0] for b in bones]
        self.rest = {b.name: b.matrix_local.to_3x3() for b in ad.bones}
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"

    def local(self, bone, spec):
        rr = self.rest[bone]
        q = (rr.inverted() @ _rot(spec.get("r")) @ rr).to_quaternion()
        loc = rr.inverted() @ Vector(spec.get("l", (0, 0, 0)))
        return q, loc, Vector(spec.get("s", (1, 1, 1)))

    def bake(self, clips):
        """clips: {nom: (boucle, {image: pose})}. Une piste NLA par clip (export NLA_TRACKS)."""
        from bpy_extras import anim_utils
        arm = self.arm
        arm.animation_data_create()
        out = []
        for cname, (loop, keys) in clips.items():
            act = bpy.data.actions.new(cname)
            act.use_fake_user = True
            arm.animation_data.action = act
            last = {}
            for f in sorted(keys):
                pose = keys[f]
                for b in self.names:
                    q, loc, s = self.local(b, pose.get(b, {}))
                    if b in last and last[b].dot(q) < 0:
                        q = Quaternion((-q.w, -q.x, -q.y, -q.z))
                    last[b] = q
                    pb = arm.pose.bones[b]
                    pb.rotation_quaternion = q
                    pb.location = loc
                    pb.scale = s
                    pb.keyframe_insert("rotation_quaternion", frame=f)
                    pb.keyframe_insert("location", frame=f)
                    pb.keyframe_insert("scale", frame=f)
            frames = sorted(keys)
            act.use_frame_range = True
            act.frame_start, act.frame_end = frames[0], frames[-1]
            slot = arm.animation_data.action_slot
            if loop:
                for fc in anim_utils.action_get_channelbag_for_slot(act, slot).fcurves:
                    fc.modifiers.new("CYCLES")
            arm.animation_data.action = None
            tr = arm.animation_data.nla_tracks.new()
            tr.name = cname
            st = tr.strips.new(cname, int(frames[0]), act)
            st.action_slot = act.slots[0]
            out.append({"name": cname, "seconds": round((frames[-1] - frames[0]) / FPS, 3), "loop": loop})
        for pb in arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)
            pb.scale = (1, 1, 1)
        return out

    def skin(self, A, name, g):
        ob = A.add(name, g, parent=self.arm)
        ob.modifiers.new("rig", "ARMATURE").object = self.arm
        return ob

    def socket(self, name, bone, world_loc):
        ob = bpy.data.objects.new(name, None)
        ob.empty_display_size = 0.03
        bpy.context.scene.collection.objects.link(ob)
        ob.parent = self.arm
        ob.parent_type = "BONE"
        ob.parent_bone = bone
        bpy.context.view_layer.update()
        ob.matrix_world = Matrix.Translation(world_loc)
        return ob


# Primitives propres à la faune --------------------------------------------------------

def seg(g, p0, p1, r0, r1, color, bone=None, segs=6, cap=True):
    """Cône tronqué de p0 (rayon r0) à p1 (rayon r1)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    eul = d.normalized().to_track_quat("Z", "Y").to_euler("XYZ")
    return g.cyl(r0, d.length, loc=tuple((p0 + p1) / 2), color=color, segs=segs, r2=r1, cap=cap,
                 rot=tuple(math.degrees(a) for a in eul), bone=bone)


def ell(g, semi, loc, color, bone=None, segs=8, rings=5, rot=(0, 0, 0)):
    """Ellipsoïde à facettes (demi-axes semi)."""
    return g.sphere(1.0, loc=loc, color=color, segs=segs, rings=rings, scale=semi, rot=rot, bone=bone)


def plate(g, outline, z, t0, t1, top, bottom, bone=None, side=None):
    """Plaque (aile, queue): contour convexe [(x, y), ...] dans le plan z, épaisseur de t0 (premier point)
    à t1 (selon la distance à l'axe x = premier x), dessus et dessous de couleurs propres."""
    x0 = outline[0][0]
    xs = [abs(p[0] - x0) for p in outline]
    span = max(xs) or 1.0
    vs = []
    for (x, y), dx in zip(outline, xs):
        t = t0 + (t1 - t0) * dx / span
        vs.append((x, y, z + t / 2))
    for (x, y), dx in zip(outline, xs):
        t = t0 + (t1 - t0) * dx / span
        vs.append((x, y, z - t / 2))
    n = len(outline)
    area = sum(outline[i][0] * outline[(i + 1) % n][1] - outline[(i + 1) % n][0] * outline[i][1] for i in range(n))
    ring = list(range(n)) if area > 0 else list(reversed(range(n)))
    faces = [ring, [i + n for i in reversed(ring)]]
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]
        faces.append([a, b, b + n, a + n][::-1])
    return g.mesh(vs, faces, by_normal(top, side or top, bottom, thr=0.3), bone=bone)


def mirror_x(outline):
    return [(-x, y) for x, y in outline]


# Héron cendré ------------------------------------------------------------------------

HERON_BONES = [
    ("heron_root", (0, 0, 0), (0, 0, 0.1), None),
    ("heron_body", (0, 0.05, 0.50), (0, -0.12, 0.62), "heron_root"),
    ("heron_neck", (0, -0.13, 0.63), (0, -0.17, 0.79), "heron_body"),
    ("heron_neck_2", (0, -0.17, 0.79), (0, -0.13, 0.90), "heron_neck"),
    ("heron_head", (0, -0.13, 0.90), (0, -0.21, 0.905), "heron_neck_2"),
    ("heron_wing_l", (0.07, -0.06, 0.62), (0.40, -0.06, 0.62), "heron_body"),
    ("heron_wingtip_l", (0.40, -0.06, 0.62), (0.86, -0.06, 0.62), "heron_wing_l"),
    ("heron_wing_r", (-0.07, -0.06, 0.62), (-0.40, -0.06, 0.62), "heron_body"),
    ("heron_wingtip_r", (-0.40, -0.06, 0.62), (-0.86, -0.06, 0.62), "heron_wing_r"),
    ("heron_leg_l", (0.045, 0.05, 0.46), (0.045, 0.07, 0.25), "heron_root"),
    ("heron_shin_l", (0.045, 0.07, 0.25), (0.045, 0.05, 0.02), "heron_leg_l"),
    ("heron_leg_r", (-0.045, 0.05, 0.46), (-0.045, 0.07, 0.25), "heron_root"),
    ("heron_shin_r", (-0.045, 0.07, 0.25), (-0.045, 0.05, 0.02), "heron_leg_r"),
]


def heron_mesh(A):
    g = A.geo()
    b = "heron_body"
    ell(g, (0.10, 0.22, 0.11), (0, 0.05, 0.56), by_normal("heron_grey", "heron_grey", "feather_white", thr=0.35), b,
        segs=8, rings=6, rot=(-22, 0, 0))
    # poitrail clair et plumes pendantes sous le cou
    ell(g, (0.07, 0.07, 0.08), (0, -0.10, 0.58), "feather_white", b, segs=7, rings=4, rot=(-30, 0, 0))
    ell(g, (0.06, 0.09, 0.025), (0, 0.29, 0.475), "heron_grey_dark", b, segs=6, rings=3, rot=(-14, 0, 0))
    n = "heron_neck"
    seg(g, (0, -0.12, 0.61), (0, -0.17, 0.79), 0.042, 0.03, "feather_white", n, segs=6)
    # trait noir du devant du cou
    g.box((0.012, 0.012, 0.12), loc=(0, -0.178, 0.70), color="black", rot=(15.5, 0, 0), bone=n)
    ell(g, (0.031, 0.031, 0.031), (0, -0.17, 0.79), "feather_white", n, segs=6, rings=4)
    n2 = "heron_neck_2"
    seg(g, (0, -0.17, 0.79), (0, -0.135, 0.895), 0.029, 0.025, "feather_white", n2, segs=6)
    h = "heron_head"
    ell(g, (0.032, 0.056, 0.037), (0, -0.155, 0.905), "feather_white", h, segs=7, rings=5)
    # bandeau noir au-dessus de l'oeil, prolongé en aigrette derrière la tête
    for s in (1, -1):
        g.box((0.006, 0.07, 0.014), loc=(s * 0.026, -0.15, 0.922), color="black", rot=(0, s * 14, 0), bone=h)
    seg(g, (0, -0.13, 0.928), (0, -0.01, 0.905), 0.011, 0.002, "black", h, segs=5)
    seg(g, (0, -0.205, 0.902), (0, -0.325, 0.893), 0.014, 0.0025, "beak", h, segs=5)
    for s in (1, -1):
        g.box((0.004, 0.01, 0.01), loc=(s * 0.031, -0.18, 0.91), color="heron_leg", bone=h)
    # ailes, dépliées au repos du squelette (les poses les replient)
    for s, side in ((1, "l"), (-1, "r")):
        inner = [(0.06, -0.085), (0.40, -0.095), (0.40, 0.19), (0.06, 0.20)]
        outer = [(0.40, -0.095), (0.66, -0.085), (0.83, -0.035), (0.86, 0.03), (0.80, 0.10), (0.40, 0.19)]
        if s < 0:
            inner, outer = mirror_x(inner), mirror_x(outer)
        plate(g, inner, 0.62, 0.035, 0.022, "heron_grey", "heron_grey", "heron_wing_" + side)
        plate(g, outer, 0.62, 0.022, 0.01, "heron_grey_dark", "heron_grey_dark", "heron_wingtip_" + side)
        leg, shin = "heron_leg_" + side, "heron_shin_" + side
        x = s * 0.045
        ell(g, (0.032, 0.04, 0.05), (x, 0.05, 0.47), "heron_grey", leg, segs=6, rings=4)
        seg(g, (x, 0.05, 0.45), (x, 0.07, 0.25), 0.012, 0.009, "heron_leg", leg, segs=5)
        ell(g, (0.012, 0.012, 0.014), (x, 0.07, 0.25), "heron_leg", shin, segs=5, rings=3)
        seg(g, (x, 0.07, 0.25), (x, 0.05, 0.02), 0.009, 0.008, "heron_leg", shin, segs=5)
        for a in (-28, 0, 28):
            ar = math.radians(a)
            g.box((0.008, 0.085, 0.007), loc=(x + math.sin(ar) * 0.04, 0.05 - math.cos(ar) * 0.04, 0.0035),
                  color="heron_leg", rot=(0, 0, a), bone=shin)
        g.box((0.008, 0.045, 0.007), loc=(x, 0.072, 0.0035), color="heron_leg", bone=shin)
    return g


def heron_clips(rig):
    # aile repliée le long du flanc: bord d'attaque en haut, bas de l'aile rentré contre le ventre
    # (une plaque rigide repliée ainsi montre sa face inférieure: les deux faces sont grises)
    fold = {"heron_wing_l": {"r": [("x", -90), ("z", 88), ("y", 14), ("x", -16)], "l": (0.035, 0.0, 0.03),
                             "s": (0.62, 0.95, 1)},
            "heron_wingtip_l": {"s": (0.85, 0.28, 1)}}
    fold = merge(fold, mirror(fold))
    stand = merge(fold, {"heron_neck": R(14), "heron_neck_2": R(-12), "heron_head": R(-2)})
    alert = merge(fold, {"heron_body": R(-8), "heron_neck": R(-12), "heron_neck_2": R(-22), "heron_head": R(40)})
    retract = {"heron_neck": R(-38), "heron_neck_2": R(70), "heron_head": R(-28)}

    def legs(pl, sl, pr, sr):
        return {"heron_leg_l": R(pl), "heron_shin_l": R(sl), "heron_leg_r": R(pr), "heron_shin_r": R(sr)}

    def wings(a, tip=0.0, sweep=0.0, pitch=0.0):
        w = {"heron_wing_l": {"r": [("x", pitch), ("y", -a), ("z", sweep)]}, "heron_wingtip_l": {"r": [("y", -tip)]}}
        return merge(w, mirror(w))

    C = {}
    C["heron_idle"] = (True, {0: stand, 24: merge(stand, {"heron_head": R(0, 0, 28)}),
                              44: merge(stand, {"heron_head": R(0, 0, 24)}),
                              62: merge(stand, {"heron_neck": R(-10), "heron_neck_2": R(22), "heron_head": R(-12)}),
                              84: merge(stand, {"heron_neck": R(-8), "heron_neck_2": R(18), "heron_head": R(-10, 0, -22)}),
                              104: merge(stand, {"heron_head": R(0, 0, -10)}), 120: stand})
    cock = merge(stand, {"heron_body": R(14), "heron_neck": R(-6), "heron_neck_2": R(40), "heron_head": R(-6)})
    strike = merge(stand, {"heron_body": R(46), "heron_neck": R(52), "heron_neck_2": R(-34), "heron_head": R(-10)})
    C["heron_strike"] = (False, {0: stand, 6: cock, 10: strike, 14: merge(strike, {"heron_body": R(48)}),
                                 24: stand})
    C["heron_alert"] = (False, {0: stand, 8: alert, 30: merge(alert, {"heron_head": R(40, 0, 6)})})
    C["heron_shy_step"] = (False, {0: alert, 6: merge(alert, legs(-38, 62, 0, 0), {"heron_root": {"l": (0, 0, 0.004)}}),
                                   12: alert, 18: merge(alert, legs(0, 0, -38, 62)), 24: alert})
    crouch = merge(fold, retract, {"heron_body": {"r": (10, 0, 0), "l": (0, 0, -0.06)}}, legs(-22, 44, -22, 44))
    up = lambda a, tip, extra: merge(wings(a, tip), {"heron_body": R(-14)}, retract, extra)  # noqa: E731
    dangle = legs(18, 26, 14, 30)
    C["heron_takeoff"] = (False, {0: alert, 6: crouch,
                                  10: up(62, 20, merge(legs(-12, 20, -12, 20), {"heron_body": R(-18)})),
                                  16: up(-36, -12, dangle), 22: up(52, 18, dangle), 28: up(-38, -14, dangle),
                                  34: up(50, 16, dangle), 40: up(-30, -10, dangle), 42: up(-22, -6, dangle)})
    fly_base = merge({"heron_body": R(18)}, retract, legs(78, 8, 76, 10))
    C["heron_fly"] = (True, {0: merge(fly_base, wings(-22, -6)), 5: merge(fly_base, wings(-34, -14)),
                             11: merge(fly_base, wings(34, 10)), 15: merge(fly_base, wings(-22, -6)),
                             20: merge(fly_base, wings(-34, -14)), 26: merge(fly_base, wings(34, 10)),
                             30: merge(fly_base, wings(-22, -6))})
    brake = merge({"heron_body": R(-30)}, retract, legs(-46, -14, -44, -12))
    C["heron_land"] = (False, {0: merge(brake, wings(46, 18, -18, -20)), 6: merge(brake, wings(-12, -4, -22, -24)),
                               12: merge(brake, wings(40, 16, -14, -16), legs(-16, 8, -14, 8)),
                               18: merge(stand, {"heron_body": R(-6)}, retract), 24: merge(stand, retract)})
    hunch = merge(stand, {"heron_body": R(6), "heron_neck": R(-62), "heron_neck_2": R(112), "heron_head": R(-56)})
    C["heron_rest"] = (True, {0: hunch, 40: merge(hunch, {"heron_head": R(-34, 0, 12), "heron_root": {"l": (0, 0, -0.004)}}),
                              80: merge(hunch, {"heron_head": R(-36, 0, -8)}), 120: hunch})
    return rig.bake(C)


# Oie cendrée -------------------------------------------------------------------------

GOOSE_BONES = [
    ("goose_root", (0, 0, 0), (0, 0, 0.08), None),
    ("goose_body", (0, 0.10, 0.02), (0, -0.12, 0.06), "goose_root"),
    ("goose_neck", (0, -0.19, 0.09), (0, -0.235, 0.31), "goose_body"),
    ("goose_head", (0, -0.235, 0.33), (0, -0.33, 0.355), "goose_neck"),
    ("goose_wing_l", (0.10, -0.10, 0.11), (0.40, -0.10, 0.11), "goose_body"),
    ("goose_wingtip_l", (0.40, -0.10, 0.11), (0.80, -0.10, 0.11), "goose_wing_l"),
    ("goose_wing_r", (-0.10, -0.10, 0.11), (-0.40, -0.10, 0.11), "goose_body"),
    ("goose_wingtip_r", (-0.40, -0.10, 0.11), (-0.80, -0.10, 0.11), "goose_wing_r"),
    ("goose_leg_l", (0.06, 0.08, -0.04), (0.06, 0.10, -0.17), "goose_root"),
    ("goose_leg_r", (-0.06, 0.08, -0.04), (-0.06, 0.10, -0.17), "goose_root"),
]


def goose_mesh(A):
    g = A.geo()
    b = "goose_body"
    ell(g, (0.15, 0.29, 0.12), (0, 0.04, 0.03), by_normal("goose_grey", "goose_grey", "goose_belly", thr=0.3), b,
        segs=8, rings=6, rot=(-4, 0, 0))
    ell(g, (0.10, 0.10, 0.09), (0, -0.17, 0.06), "goose_grey", b, segs=7, rings=4)
    ell(g, (0.07, 0.075, 0.03), (0, 0.33, 0.09), "goose_grey_dark", b, segs=6, rings=3, rot=(-20, 0, 0))
    ell(g, (0.06, 0.05, 0.035), (0, 0.30, 0.045), "white_paint", b, segs=6, rings=3)
    n = "goose_neck"
    seg(g, (0, -0.19, 0.08), (0, -0.235, 0.32), 0.05, 0.034, "goose_grey_dark", n, segs=6)
    h = "goose_head"
    ell(g, (0.034, 0.055, 0.038), (0, -0.255, 0.365), "goose_grey_dark", h, segs=7, rings=4)
    seg(g, (0, -0.295, 0.362), (0, -0.375, 0.347), 0.019, 0.007, "goose_bill", h, segs=5)
    g.box((0.012, 0.012, 0.012), loc=(0, -0.373, 0.349), color="goose_belly", bone=h)
    for s in (1, -1):
        g.box((0.004, 0.01, 0.01), loc=(s * 0.032, -0.27, 0.375), color="black", bone=h)
    for s, side in ((1, "l"), (-1, "r")):
        inner = [(0.09, -0.115), (0.40, -0.125), (0.40, 0.12), (0.09, 0.14)]
        outer = [(0.40, -0.125), (0.66, -0.11), (0.81, -0.075), (0.78, -0.02), (0.40, 0.12)]
        if s < 0:
            inner, outer = mirror_x(inner), mirror_x(outer)
        plate(g, inner, 0.11, 0.03, 0.02, "goose_grey", "goose_grey", "goose_wing_" + side)
        plate(g, outer, 0.11, 0.02, 0.01, "goose_grey_dark", "goose_grey_dark", "goose_wingtip_" + side)
        leg = "goose_leg_" + side
        x = s * 0.06
        seg(g, (x, 0.08, -0.04), (x, 0.10, -0.16), 0.014, 0.011, "goose_leg", leg, segs=5)
        g.mesh([(x, 0.10, -0.168), (x - 0.04, 0.02, -0.17), (x + 0.04, 0.02, -0.17),
                (x, 0.10, -0.158), (x - 0.04, 0.02, -0.162), (x + 0.04, 0.02, -0.162)],
               [[0, 1, 2], [3, 5, 4], [0, 3, 4, 1], [1, 4, 5, 2], [2, 5, 3, 0]], "goose_leg", bone=leg)
    return g


def goose_clips(rig):
    fold = {"goose_wing_l": {"r": [("x", -62), ("z", 90), ("x", -14)], "l": (0.03, 0.0, 0.035), "s": (0.62, 0.9, 1)},
            "goose_wingtip_l": {"s": (0.85, 0.22, 1)}}
    fold = merge(fold, mirror(fold))

    def wings(a, tip=0.0):
        w = {"goose_wing_l": {"r": [("y", -a)]}, "goose_wingtip_l": {"r": [("y", -tip)]}}
        return merge(w, mirror(w))

    tuck = {"goose_leg_l": R(70), "goose_leg_r": R(70)}
    C = {}
    C["goose_swim"] = (True, {0: merge(fold, tuck), 22: merge(fold, tuck, {"goose_body": R(0, 3, 0), "goose_root": {"l": (0, 0, 0.004)}}),
                              45: merge(fold, tuck, {"goose_body": R(0, -3, 0)}),
                              55: merge(fold, tuck, {"goose_neck": R(46), "goose_head": R(40)}),
                              66: merge(fold, tuck, {"goose_neck": R(50), "goose_head": R(46), "goose_body": R(4)}),
                              76: merge(fold, tuck), 90: merge(fold, tuck)})
    alert = merge(fold, tuck, {"goose_body": R(-6), "goose_neck": R(-12), "goose_head": R(14)})
    C["goose_alert"] = (False, {0: merge(fold, tuck), 8: alert, 30: merge(alert, {"goose_head": R(14, 0, 10)})})
    run = {"goose_body": {"r": (-16, 0, 0), "l": (0, 0, 0.05)}, "goose_neck": R(26), "goose_head": R(-8)}
    C["goose_run"] = (True, {0: merge(run, wings(58, 20), {"goose_leg_l": R(-42), "goose_leg_r": R(36)}),
                             6: merge(run, wings(-30, -14), {"goose_leg_l": R(36), "goose_leg_r": R(-42)}),
                             12: merge(run, wings(58, 20), {"goose_leg_l": R(-42), "goose_leg_r": R(36)})})
    fly = merge({"goose_neck": R(58), "goose_head": R(-52)}, {"goose_leg_l": R(84), "goose_leg_r": R(84)})
    keys = {}
    for k in range(4):
        keys[k * 10] = merge(fly, wings(32, 12))
        if k < 3:
            keys[k * 10 + 5] = merge(fly, wings(-30, -12))
    C["goose_fly"] = (True, keys)
    return rig.bake(C)


# Mésange bleue -------------------------------------------------------------------------

def _ts(p):
    return tuple(v * TIT_SCALE for v in p)


TIT_BONES = [
    ("tit_root", (0, 0, 0), _ts((0, 0, 0.02)), None),
    ("tit_body", _ts((0, 0.015, 0.024)), _ts((0, -0.02, 0.034)), "tit_root"),
    ("tit_head", _ts((0, -0.022, 0.044)), _ts((0, -0.045, 0.048)), "tit_body"),
    ("tit_wing_l", _ts((0.016, -0.012, 0.038)), _ts((0.02, 0.034, 0.03)), "tit_body"),
    ("tit_wing_r", _ts((-0.016, -0.012, 0.038)), _ts((-0.02, 0.034, 0.03)), "tit_body"),
    ("tit_tail", _ts((0, 0.03, 0.03)), _ts((0, 0.07, 0.022)), "tit_body"),
]


def blue_tit_mesh(A):
    g = A.geo()
    S = TIT_SCALE
    b = "tit_body"
    ell(g, _ts((0.021, 0.031, 0.022)), _ts((0, 0.002, 0.03)), by_normal("tit_green", "tit_yellow", "tit_yellow", thr=0.45), b,
        segs=7, rings=5, rot=(-12, 0, 0))
    h = "tit_head"

    def head_color(face):
        n = face.normal
        if n.z > 0.42:
            return "tit_blue"
        if n.z < -0.55:
            return "jay_stripe"
        return "white_paint"
    g.sphere(0.0175 * S, loc=_ts((0, -0.027, 0.048)), color=head_color, segs=7, rings=5, bone=h)
    seg(g, _ts((0, -0.042, 0.047)), _ts((0, -0.054, 0.046)), 0.004 * S, 0.0008 * S, "jay_stripe", h, segs=5)
    for s in (1, -1):
        g.box(_ts((0.003, 0.02, 0.004)), loc=_ts((s * 0.0155, -0.03, 0.049)), color="jay_stripe", rot=(0, 0, s * 8), bone=h)
        side = "tit_wing_" + ("l" if s > 0 else "r")
        wing = [(0.0, -0.012), (0.005, -0.01), (0.005, 0.024), (0.0, 0.03)]
        pts = [(s * 0.0135 + s * x, y) for x, y in wing]
        plate(g, [_ts((x, y))[:2] for x, y in pts], 0.036 * S, 0.006 * S, 0.004 * S, "tit_blue", "tit_blue", side)
        # pattes: deux brins sous le corps, doigts posés sur le perchoir (origine)
        seg(g, _ts((s * 0.007, 0.004, 0.014)), _ts((s * 0.007, 0.002, 0.001)), 0.0018 * S, 0.0015 * S, "lauze_dark", "tit_root", segs=5)
        g.box(_ts((0.003, 0.014, 0.002)), loc=_ts((s * 0.007, 0.0, 0.001)), color="lauze_dark", bone="tit_root")
    plate(g, [_ts((-0.008, 0.026))[:2], _ts((0.008, 0.026))[:2], _ts((0.009, 0.06))[:2], _ts((-0.009, 0.06))[:2]],
          0.027 * S, 0.004 * S, 0.003 * S, "tit_blue", "tit_blue", "tit_tail")
    return g


def tit_clips(rig):
    S = TIT_SCALE
    rest = {}
    opn = {"tit_wing_l": {"r": [("z", -80)]}}
    opn = merge(opn, mirror(opn))

    def flap(a):
        w = {"tit_wing_l": {"r": [("z", -80), ("y", -a)]}}
        return merge(w, mirror(w), {"tit_body": R(10), "tit_tail": R(-6)})
    C = {}
    C["tit_perch"] = (True, {0: rest, 10: {"tit_head": R(0, 0, 40)}, 18: {"tit_head": R(-6, 0, -32)},
                             23: {"tit_body": {"r": (6, 0, 0), "l": (0, 0, -0.003 * S)}, "tit_head": R(0, 0, -20)},
                             27: {"tit_root": {"l": (0, 0, 0.016 * S)}, "tit_tail": R(-20), "tit_head": R(0, 0, -10)},
                             32: {"tit_head": R(0, 0, 10)}, 42: {"tit_head": R(0, 0, 24)},
                             50: {"tit_tail": R(-28)}, 53: {}, 60: rest})
    C["tit_fly"] = (True, {0: flap(50), 3: flap(-40), 6: flap(50)})
    sing = {"tit_head": R(-32), "tit_body": {"r": (-6, 0, 0), "s": (1.08, 1.0, 1.08)}}
    C["tit_sing"] = (False, {0: rest, 6: sing, 12: merge(sing, {"tit_head": R(-38), "tit_tail": R(-12)}),
                             18: merge(sing, {"tit_head": R(-28), "tit_tail": R(6)}),
                             26: merge(sing, {"tit_head": R(-38, 0, 8), "tit_tail": R(-10)}),
                             34: merge(sing, {"tit_head": R(-30, 0, -6)}), 39: sing, 45: rest})
    lunge = {"tit_body": {"r": (28, 0, 0), "l": (0, -0.012 * S, 0.0)}, "tit_head": R(10), "tit_tail": R(-24)}
    C["tit_enter"] = (False, {0: rest, 5: merge(lunge, {"tit_body": {"r": (24, 0, 0), "l": (0, -0.006 * S, 0)}}), 9: lunge})
    C["tit_exit"] = (False, {0: lunge, 4: merge(lunge, opn), 9: rest})
    return rig.bake(C)


def moss_tuft(A):
    """Brin de mousse tenu au bec: origine au point de prise (en haut au milieu), touffe pendante."""
    g = A.geo()
    S = TIT_SCALE
    g.sphere(0.012 * S, loc=_ts((0.0, -0.004, -0.012)), color="moss", ico=1, jitter=0.15, seed=3, scale=(1.2, 0.9, 1.0))
    g.sphere(0.009 * S, loc=_ts((0.01, 0.002, -0.018)), color="grass_dark", ico=1, jitter=0.15, seed=5)
    g.sphere(0.008 * S, loc=_ts((-0.011, 0.003, -0.016)), color="moss", ico=1, jitter=0.15, seed=8)
    for a, l in ((-30, 0.022), (20, 0.026), (65, 0.018)):
        g.box(_ts((0.0025, 0.0025, l)), loc=_ts((math.sin(math.radians(a)) * 0.012, 0.0, -0.024)), color="grass_dry",
              rot=(0, a * 0.6, a))
    return g


# Renard roux ---------------------------------------------------------------------------

FOX_BONES = [
    ("fox_root", (0, 0, 0), (0, 0, 0.1), None),
    ("fox_hips", (0, 0.18, 0.31), (0, 0.0, 0.32), "fox_root"),
    ("fox_chest", (0, 0.0, 0.32), (0, -0.20, 0.33), "fox_hips"),
    ("fox_neck", (0, -0.19, 0.35), (0, -0.28, 0.43), "fox_chest"),
    ("fox_head", (0, -0.28, 0.43), (0, -0.40, 0.42), "fox_neck"),
    ("fox_ear_l", (0.032, -0.30, 0.47), (0.04, -0.30, 0.53), "fox_head"),
    ("fox_ear_r", (-0.032, -0.30, 0.47), (-0.04, -0.30, 0.53), "fox_head"),
    ("fox_tail", (0, 0.26, 0.33), (0, 0.45, 0.27), "fox_hips"),
    ("fox_tail_2", (0, 0.45, 0.27), (0, 0.66, 0.20), "fox_tail"),
    ("fox_leg_fl", (0.045, -0.15, 0.29), (0.045, -0.145, 0.15), "fox_chest"),
    ("fox_leg_fl_2", (0.045, -0.145, 0.15), (0.045, -0.155, 0.0), "fox_leg_fl"),
    ("fox_leg_fr", (-0.045, -0.15, 0.29), (-0.045, -0.145, 0.15), "fox_chest"),
    ("fox_leg_fr_2", (-0.045, -0.145, 0.15), (-0.045, -0.155, 0.0), "fox_leg_fr"),
    ("fox_leg_bl", (0.05, 0.19, 0.29), (0.05, 0.13, 0.16), "fox_hips"),
    ("fox_leg_bl_2", (0.05, 0.13, 0.16), (0.05, 0.20, 0.0), "fox_leg_bl"),
    ("fox_leg_br", (-0.05, 0.19, 0.29), (-0.05, 0.13, 0.16), "fox_hips"),
    ("fox_leg_br_2", (-0.05, 0.13, 0.16), (-0.05, 0.20, 0.0), "fox_leg_br"),
]


def fox_mesh(A):
    g = A.geo()
    coat = by_normal("fox_red_dark", "fox_red", "fox_white", thr=0.55)
    ell(g, (0.085, 0.15, 0.10), (0, -0.09, 0.31), coat, "fox_chest", segs=8, rings=5)
    ell(g, (0.08, 0.15, 0.09), (0, 0.12, 0.315), coat, "fox_hips", segs=8, rings=5, rot=(4, 0, 0))
    ell(g, (0.055, 0.05, 0.065), (0, -0.215, 0.32), "fox_white", "fox_chest", segs=6, rings=4)
    seg(g, (0, -0.17, 0.34), (0, -0.275, 0.43), 0.058, 0.046, "fox_red", "fox_neck", segs=6)
    h = "fox_head"
    ell(g, (0.056, 0.062, 0.05), (0, -0.305, 0.44), "fox_red", h, segs=7, rings=5)
    ell(g, (0.05, 0.045, 0.028), (0, -0.335, 0.412), "fox_white", h, segs=7, rings=4)
    seg(g, (0, -0.335, 0.428), (0, -0.44, 0.414), 0.03, 0.011, by_normal("fox_red", "fox_red", "fox_white", thr=0.4), h, segs=6)
    g.sphere(0.012, loc=(0, -0.443, 0.415), color="fox_black", segs=5, rings=3, bone=h)
    for s in (1, -1):
        g.box((0.006, 0.012, 0.01), loc=(s * 0.042, -0.345, 0.452), color="fox_black", rot=(0, 0, -s * 25), bone=h)
        ear = "fox_ear_" + ("l" if s > 0 else "r")

        def ear_color(face):
            return "fox_white" if face.normal.y < -0.5 else "fox_black"
        g.prism([(-0.026, 0.0), (0.026, 0.0), (0.004, 0.075)], 0.014, loc=(s * 0.036, -0.30, 0.462), color=ear_color,
                rot=(0, s * -12, 0), bone=ear)
    # queue touffue, bout blanc
    ell(g, (0.05, 0.12, 0.05), (0, 0.35, 0.30), "fox_red", "fox_tail", segs=7, rings=4, rot=(-18, 0, 0))
    ell(g, (0.058, 0.12, 0.056), (0, 0.54, 0.238), "fox_red", "fox_tail_2", segs=7, rings=4, rot=(-18, 0, 0))
    ell(g, (0.042, 0.055, 0.042), (0, 0.655, 0.20), "fox_white", "fox_tail_2", segs=6, rings=4, rot=(-18, 0, 0))
    for s, side in ((1, "l"), (-1, "r")):
        x = s * 0.045
        seg(g, (x, -0.15, 0.30), (x, -0.145, 0.15), 0.03, 0.02, "fox_red", "fox_leg_f" + side, segs=6)
        seg(g, (x, -0.145, 0.15), (x, -0.15, 0.02), 0.018, 0.015, "fox_black", "fox_leg_f" + side + "_2", segs=5)
        ell(g, (0.019, 0.028, 0.014), (x, -0.162, 0.014), "fox_black", "fox_leg_f" + side + "_2", segs=6, rings=3)
        xb = s * 0.05
        ell(g, (0.042, 0.075, 0.075), (xb, 0.165, 0.25), "fox_red", "fox_leg_b" + side, segs=6, rings=4, rot=(-25, 0, 0))
        seg(g, (xb, 0.15, 0.20), (xb, 0.13, 0.16), 0.024, 0.02, "fox_red", "fox_leg_b" + side, segs=5)
        seg(g, (xb, 0.13, 0.16), (xb, 0.195, 0.02), 0.017, 0.014, "fox_black", "fox_leg_b" + side + "_2", segs=5)
        ell(g, (0.019, 0.028, 0.014), (xb, 0.185, 0.014), "fox_black", "fox_leg_b" + side + "_2", segs=6, rings=3)
    return g


def fox_clips(rig):
    def legs(fl, fl2, fr, fr2, bl, bl2, br, br2):
        return {"fox_leg_fl": R(fl), "fox_leg_fl_2": R(fl2), "fox_leg_fr": R(fr), "fox_leg_fr_2": R(fr2),
                "fox_leg_bl": R(bl), "fox_leg_bl_2": R(bl2), "fox_leg_br": R(br), "fox_leg_br_2": R(br2)}
    stand = {}
    tail_level = {"fox_tail": R(-10), "fox_tail_2": R(-4)}
    C = {}
    # trot: diagonales (avant gauche avec arrière droit); négatif = patte vers l'avant
    a = merge(tail_level, legs(-26, 6, 22, 4, 20, -4, -24, 8))
    pa = merge(tail_level, legs(-2, 0, -6, 48, -4, 30, -8, 0), {"fox_root": {"l": (0, 0, 0.012)}})
    b = merge(tail_level, legs(22, 4, -26, 6, -24, 8, 20, -4))
    pb = merge(tail_level, legs(-6, 48, -2, 0, -8, 0, -4, 30), {"fox_root": {"l": (0, 0, 0.012)}})
    C["fox_trot"] = (True, {0: a, 4: pa, 9: b, 13: pb, 18: a})
    listen = {"fox_neck": R(26), "fox_head": R(16, 18, 0), "fox_ear_l": R(14), "fox_ear_r": R(14), "fox_tail": R(6)}
    C["fox_listen"] = (False, {0: stand, 10: listen, 38: merge(listen, {"fox_head": R(16, -16, 4)}),
                               64: merge(listen, {"fox_head": R(18, -14, 0)}), 75: stand})
    crouch = merge({"fox_hips": {"r": (8, 0, 0), "l": (0, 0, -0.05)}, "fox_chest": R(-4), "fox_neck": R(30),
                    "fox_head": R(10), "fox_tail": R(-8)}, legs(10, -20, 10, -20, -30, 44, -30, 44))
    launch = merge({"fox_hips": R(-34), "fox_chest": R(-6), "fox_neck": R(-6), "fox_tail": R(-10)},
                   legs(-50, 10, -46, 12, 60, 10, 58, 12))
    apex = merge({"fox_hips": R(40), "fox_chest": R(10), "fox_neck": R(10), "fox_head": R(6), "fox_tail": R(-42),
                  "fox_tail_2": R(-12)}, legs(-30, -12, -30, -12, 24, 30, 24, 30))
    land = merge({"fox_hips": {"r": (24, 0, 0), "l": (0, 0, -0.02)}, "fox_chest": R(8), "fox_neck": R(34),
                  "fox_head": R(22), "fox_tail": R(-34)}, legs(-12, 4, -12, 4, 6, 30, 6, 30))
    C["fox_pounce"] = (False, {0: stand, 8: crouch, 11: crouch, 15: launch, 20: apex, 26: land, 30: land, 36: stand})
    sniff = merge({"fox_neck": R(48), "fox_head": R(30), "fox_tail": R(14)}, legs(-6, 0, -6, 0, 0, 0, 0, 0))
    C["fox_sniff"] = (False, {0: stand, 10: sniff, 22: merge(sniff, {"fox_head": R(30, 0, 16)}),
                              36: merge(sniff, {"fox_head": R(32, 0, -14)}), 50: sniff, 60: stand})
    look = {"fox_neck": R(-14), "fox_head": R(6), "fox_ear_l": R(-10), "fox_ear_r": R(-10), "fox_tail": R(-4)}
    C["fox_look"] = (False, {0: stand, 9: look, 30: merge(look, {"fox_head": R(4, 0, 6)})})
    bark = merge(look, {"fox_neck": R(-26), "fox_head": R(-22), "fox_chest": R(-5), "fox_ear_l": R(10), "fox_ear_r": R(10)})
    C["fox_bark"] = (False, {0: look, 5: bark, 10: look, 19: bark, 24: look, 36: look})
    return rig.bake(C)


# Objets ---------------------------------------------------------------------------------

def ladder_wood(A):
    """Échelle de 3 m penchée à 75 degrés vers l'avant (+Z glTF), origine au milieu du pied.

    Barreaux tous les 0,28 m de hauteur (le premier à 0,28 m, le dixième à 2,80 m), montants de 0,05 x 0,07
    coupés à l'horizontale au pied et à la verticale en tête (posés à plat sur le sol et contre le tronc).
    """
    g = A.geo()
    a = math.radians(LADDER_ANGLE)
    axis = Vector((0, -math.cos(a), math.sin(a)))
    nrm = Vector((0, math.sin(a), math.cos(a)))
    top = axis * LADDER_LENGTH
    for x in (-0.2, 0.2):
        vs = []
        for z_end in (0, 1):
            for sx in (-0.025, 0.025):
                for sn in (-0.035, 0.035):
                    p = Vector((x + sx, 0, 0)) + nrm * sn
                    if z_end == 0:
                        p = p - axis * (p.z / axis.z)
                    else:
                        p = p + top
                        p = p - axis * ((p.y - top.y) / axis.y)
                    vs.append(tuple(p))
        # sommets: pied (0..3), tête (4..7); ordre (sx, sn): (-,-), (-,+), (+,-), (+,+)
        faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
        verts = g.mesh(vs, faces, "wood_old")
        g.bevel(verts, 0.008, 1, "wood_old", lambda p, q: abs((Vector(q) - Vector(p)).normalized().dot(axis)) > 0.9)
    for k in range(1, 11):
        z = RUNG_STEP * k
        c = axis * (z / axis.z)
        g.cyl(0.017, 0.40, loc=tuple(c), color="wood", segs=6, rot=(0, 90, 0), cap=False)
    return g


def nest_box(A):
    """Nichoir à mésange: origine sur le clou (en haut au milieu du dos, contre l'écorce), entrée vers +Z glTF.

    Caisse de 0,15 x 0,25 x 0,16 sur une planche de dos de 2 cm qui dépasse en haut (clouée au tronc):
    0,18 m de profondeur en tout. Trou de 28 mm à 0,17 m du bas, toit de planche goudronnée débordant de 4 cm.
    """
    g = A.geo()
    back_t, depth, w, h = 0.02, 0.16, 0.15, 0.25
    top, bot = -0.05, -0.30           # haut de la caisse (côté dos) et bas, sous le clou
    g.box((0.16, back_t, 0.36), loc=(0, -back_t / 2, 0.03 - 0.18), color="wood_old_dark", bevel=0.004)
    # caisse: profil (y, z) extrudé en x, dessus en pente vers l'avant
    y0, y1 = -back_t, -back_t - depth
    prof = [(y0, bot), (y1, bot), (y1, top - 0.025), (y0, top)]
    vs = g.prism([(-y, z) for y, z in prof], w, loc=(0, 0, 0), color=by_normal("wood_old", "wood_old", "wood_old_dark"),
                 rot=(0, 0, -90))
    # angles verticaux de la caisse arrondis (les arêtes du dos restent contre la planche)
    g.bevel(vs, 0.012, 1, by_normal("wood_old", "wood_old", "wood_old_dark"),
            lambda p, q: abs(p.x - q.x) < 1e-4 and abs(p.y - q.y) < 1e-4 and p.y < y0 - 0.01)
    # toit: planche goudronnée en pente (posée sur le dessus de la caisse), débord de 4 cm devant et sur les côtés
    slope = math.atan2(0.025, depth)
    yc = (y0 + y1 - 0.04) / 2
    zc = top + (yc - y0) / (y1 - y0) * -0.025 + 0.009 / math.cos(slope)
    g.box((w + 0.08, depth + 0.045, 0.018), loc=(0, yc, zc), color="tar", rot=(math.degrees(slope), 0, 0), bevel=0.005)
    # trou d'envol (28 mm) et clou
    g.cyl(0.014, 0.004, loc=(0, y1 - 0.001, bot + 0.17), color="shadow", segs=8, rot=(90, 0, 0))
    g.cyl(0.006, 0.006, loc=(0, -back_t - 0.002, 0.0), color="iron", segs=6, rot=(90, 0, 0))
    return g


def oak_branch_stub(A):
    """Chicot (branche morte) du grand chêne: origine au bout, là où se pose la mésange (dessus du bout).

    Il repart vers le tronc de tree_oak_01 (nord-ouest et vers le bas, posé à rotation 0); 0,6 m hors de
    l'écorce, le reste pris dans le tronc.
    """
    g = A.geo()
    d = Vector((-0.30, 0.36, -0.37)).normalized()
    tip = Vector((0, 0, -0.022))
    base = tip + d * 0.78
    seg(g, tuple(base), tuple(tip), 0.05, 0.022, "wood_old_dark", segs=6)
    g.sphere(0.022, loc=tuple(tip), color="wood_old", segs=6, rings=3, scale=(1, 1, 0.6))
    # brindille cassée qui part du chicot vers le haut
    m = tip + d * 0.22
    seg(g, tuple(m), tuple(m + Vector((0.06, -0.05, 0.11))), 0.014, 0.007, "wood_old_dark", segs=5)
    return g


# Programme --------------------------------------------------------------------------------

def main():
    lpl.reset()
    bpy.context.scene.render.fps = FPS
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    anims = {}

    heron = Rig("heron", HERON_BONES)
    A._register(heron.arm, {"kind": "animal", "origin": "sol sous les pattes", "height": 0.95, "length": 0.9,
                            "wingspan": 1.7, "collision_radius": 0.3})
    heron.skin(A, "heron_mesh", heron_mesh(A))
    anims["heron"] = heron_clips(heron)

    goose = Rig("goose", GOOSE_BONES)
    A._register(goose.arm, {"kind": "animal", "origin": "ligne de flottaison", "length": 0.8, "wingspan": 1.6,
                            "note": "neuf instances d'un seul maillage (SkeletonUtils.clone)"})
    goose.skin(A, "goose_mesh", goose_mesh(A))
    anims["goose"] = goose_clips(goose)

    tit = Rig("blue_tit", TIT_BONES)
    A._register(tit.arm, {"kind": "animal", "origin": "pattes sur le perchoir", "display_scale": TIT_SCALE,
                          "length": round(0.12 * TIT_SCALE, 3), "beak_socket": "socket_blue_tit_beak"})
    tit.skin(A, "blue_tit_mesh", blue_tit_mesh(A))
    tit.socket("socket_blue_tit_beak", "tit_head", Vector(_ts((0, -0.054, 0.045))))
    anims["blue_tit"] = tit_clips(tit)

    fox = Rig("fox", FOX_BONES)
    A._register(fox.arm, {"kind": "animal", "origin": "sol entre les pattes", "withers": 0.4, "length": 0.65,
                          "tail": 0.4})
    fox.skin(A, "fox_mesh", fox_mesh(A))
    anims["fox"] = fox_clips(fox)

    a = math.radians(LADDER_ANGLE)
    A.add("ladder_wood", ladder_wood(A), {"kind": "prop", "lean_deg": LADDER_ANGLE, "length": LADDER_LENGTH,
                                          "rung_step": RUNG_STEP, "rungs": 10,
                                          "top": [0.0, round(LADDER_LENGTH * math.sin(a), 3), round(LADDER_LENGTH * math.cos(a), 3)],
                                          "note": "penchée vers +Z: la poser avec la rotation de celui qui grimpe"})
    A.add("nest_box", nest_box(A), {"kind": "prop", "pivot": "clou", "tilt_deg": 25,
                                    "entrance": [0.0, -0.13, 0.181],
                                    "roof_perch": [0.0, -0.048, 0.12],
                                    "note": "penché: tourner de 25 degrés autour de Z glTF (le bas vers +X)"})
    A.add("oak_branch_stub", oak_branch_stub(A), {"kind": "prop", "pivot": "bout du chicot (perchoir)"})
    A.add("moss_tuft", moss_tuft(A), {"kind": "item", "socket": "socket_blue_tit_beak"})

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "faune.glb")
    size = lpl.export_glb(path, objs, animation_mode="NLA_TRACKS")
    st = A.stats()
    lpl.write_stats("faune", {"nodes": st, "animations": anims, "file_bytes": size})
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "faune.blend"), compress=True)
    print("FAUNE", size, {k: v["tris"] for k, v in st.items()})


if __name__ == "__main__":
    main()
