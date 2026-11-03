"""Le chat du bourg (0.13, docs/jeux/jeu-1/v0-13-habitants.md, section 7.4; lot H6). Appelé par faune.py.

Chat tigré gris à plastron et chaussettes blanches: les rayures sont des anneaux de facettes autour du corps
(comme les bandes de `banded_ball`, rien n'est posé par-dessus), le ventre, le plastron, le museau et les pattes
blancs pour qu'il se lise sur les pavés gris et dans l'herbe, de jour comme le soir.

Taille réelle: 0,46 m de corps, 0,25 m au garrot, queue de 0,3 m. Origine au sol entre les pattes, tête vers -Y
(+Z glTF). Clips (préfixés comme les autres bêtes de faune.glb): `cat_idle` (assis, la queue enroulée qui bat,
regard à gauche et à droite, une oreille qui frémit), `cat_walk` (pas en quatre temps en 0,8 s, queue dressée, 0,35 m/s),
`cat_sleep` (couché en rond, pattes repliées, la queue autour de lui, il respire), `cat_roll` (il se roule sur le dos, pattes en l'air, et
revient sur le flanc: la caresse à deux, geste 30). Les poses couchées et assises sont posées au sol par calcul
(point le plus bas du maillage déformé, image par image).
"""
import math

import bpy  # noqa: F401,I001
import bmesh
from mathutils import Vector

GREY, DARK, WHITE, PINK = "heron_grey", "heron_grey_dark", "feather_white", "goose_leg"
EYE, PUPIL = "hazel_husk", "fox_black"

CAT_BONES = [
    ("cat_root", (0, 0, 0), (0, 0, 0.08), None),
    ("cat_hips", (0, 0.13, 0.215), (0, 0.0, 0.225), "cat_root"),
    ("cat_chest", (0, 0.0, 0.225), (0, -0.14, 0.235), "cat_hips"),
    ("cat_neck", (0, -0.13, 0.25), (0, -0.175, 0.3), "cat_chest"),
    ("cat_head", (0, -0.175, 0.3), (0, -0.26, 0.3), "cat_neck"),
    ("cat_ear_l", (0.028, -0.19, 0.34), (0.034, -0.19, 0.375), "cat_head"),
    ("cat_ear_r", (-0.028, -0.19, 0.34), (-0.034, -0.19, 0.375), "cat_head"),
    ("cat_tail", (0, 0.17, 0.225), (0, 0.25, 0.205), "cat_hips"),
    ("cat_tail_2", (0, 0.25, 0.205), (0, 0.33, 0.18), "cat_tail"),
    ("cat_tail_3", (0, 0.33, 0.18), (0, 0.41, 0.16), "cat_tail_2"),
    ("cat_leg_fl", (0.034, -0.1, 0.2), (0.034, -0.1, 0.1), "cat_chest"),
    ("cat_leg_fl_2", (0.034, -0.1, 0.1), (0.034, -0.105, 0.0), "cat_leg_fl"),
    ("cat_leg_fr", (-0.034, -0.1, 0.2), (-0.034, -0.1, 0.1), "cat_chest"),
    ("cat_leg_fr_2", (-0.034, -0.1, 0.1), (-0.034, -0.105, 0.0), "cat_leg_fr"),
    ("cat_leg_bl", (0.04, 0.115, 0.2), (0.04, 0.085, 0.11), "cat_hips"),
    ("cat_leg_bl_2", (0.04, 0.085, 0.11), (0.04, 0.12, 0.0), "cat_leg_bl"),
    ("cat_leg_br", (-0.04, 0.115, 0.2), (-0.04, 0.085, 0.11), "cat_hips"),
    ("cat_leg_br_2", (-0.04, 0.085, 0.11), (-0.04, 0.12, 0.0), "cat_leg_br"),
]


def _fix(g, vs):
    fs = list({f for v in vs if v.is_valid for f in v.link_faces})
    bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    return vs


def body_loft(g, sections, segs, bone, stripe_from=1):
    """Corps tigré: sections (y, demi-largeur, demi-hauteur, z du centre) le long de Y; une rayure sombre sur deux
    anneaux sur le dos et les flancs, ventre blanc."""
    pts, faces, ring_of = [], [], []
    for (y, rx, rz, zc) in sections:
        for k in range(segs):
            a = 2 * math.pi * (k + 0.5) / segs
            pts.append((rx * math.cos(a), y, zc + rz * math.sin(a)))
    n = len(sections)
    for i in range(n - 1):
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2, (i + 1) * segs + k2, (i + 1) * segs + k))
            ring_of.append(i)
    pts.append((0, sections[0][0] - 0.012, sections[0][3]))
    pts.append((0, sections[-1][0] + 0.012, sections[-1][3]))
    c0, c1 = len(pts) - 2, len(pts) - 1
    for k in range(segs):
        k2 = (k + 1) % segs
        faces.append((c0, k2, k))
        ring_of.append(-1)
        faces.append((c1, (n - 1) * segs + k, (n - 1) * segs + k2))
        ring_of.append(-2)
    zmid = sum(s[3] for s in sections) / n

    def col(face):
        c = face.calc_center_median()
        if c.z < zmid - 0.035:
            return WHITE
        if face.normal.z < -0.55:
            return WHITE
        y = c.y
        idx = min(range(n - 1), key=lambda i: abs((sections[i][0] + sections[i + 1][0]) / 2 - y))
        return DARK if (idx >= stripe_from and idx % 2 == 1 and abs(face.normal.y) < 0.8) else GREY
    vs = g.mesh(pts, faces, GREY, bone=bone)
    _fix(g, vs)
    g.bm.normal_update()
    # couleurs après la remise des normales vers dehors (le ventre se reconnaît à sa normale)
    return g.recolor(vs, col)


def ell(g, semi, loc, color, bone, segs=8, rings=5, rot=(0, 0, 0)):
    return g.sphere(1.0, loc=loc, color=color, segs=segs, rings=rings, scale=semi, rot=rot, bone=bone)


def seg(g, p0, p1, r0, r1, color, bone, segs=6):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    eul = d.normalized().to_track_quat("Z", "Y").to_euler("XYZ")
    return g.cyl(r0, d.length, loc=tuple((p0 + p1) / 2), color=color, segs=segs, r2=r1,
                 rot=tuple(math.degrees(a) for a in eul), bone=bone)


def cat_mesh(A):
    g = A.geo()
    body_loft(g, [(-0.175, 0.03, 0.035, 0.235), (-0.15, 0.058, 0.066, 0.23), (-0.1, 0.066, 0.074, 0.225),
                  (-0.05, 0.064, 0.07, 0.222), (0.0, 0.06, 0.066, 0.222)], 10, "cat_chest", stripe_from=2)
    body_loft(g, [(-0.03, 0.06, 0.066, 0.222), (0.03, 0.064, 0.068, 0.222), (0.08, 0.07, 0.072, 0.22),
                  (0.13, 0.068, 0.07, 0.218), (0.165, 0.05, 0.052, 0.222), (0.185, 0.022, 0.025, 0.226)], 10,
              "cat_hips", stripe_from=1)
    # plastron blanc
    ell(g, (0.042, 0.03, 0.055), (0, -0.168, 0.212), WHITE, "cat_chest", segs=8, rings=5)
    # cou et tête ronde: calotte tigrée (rayures du front), joues et museau blancs, nez rose
    seg(g, (0, -0.12, 0.245), (0, -0.18, 0.3), 0.045, 0.038, GREY, "cat_neck", segs=8)
    h = "cat_head"
    hv = ell(g, (0.062, 0.056, 0.052), (0, -0.215, 0.312), GREY, h, segs=10, rings=6)

    def head_col(face):
        c = face.calc_center_median()
        if c.z > 0.34 and abs(c.x) < 0.03 and c.y < -0.2:
            return DARK
        if c.z > 0.35 and c.y > -0.235:
            return DARK if int((c.y + 0.3) / 0.018) % 2 == 0 else GREY
        return GREY
    g.recolor(hv, head_col)
    for s in (1, -1):
        ell(g, (0.03, 0.024, 0.024), (s * 0.021, -0.258, 0.292), WHITE, h, segs=7, rings=4)
        # yeux vert-jaune en amande, pupille fendue
        e = g.mesh([(0, 0, 0)] + [(0.011 * math.cos(a), 0, 0.0075 * math.sin(a))
                                  for a in [2 * math.pi * k / 8 for k in range(8)]],
                   [(0, 1 + k, 1 + (k + 1) % 8) for k in range(8)], EYE, bone=h)
        pv = g.mesh([(0, 0, 0)] + [(0.0028 * math.cos(a), 0, 0.0068 * math.sin(a))
                                   for a in [2 * math.pi * k / 6 for k in range(6)]],
                    [(0, 1 + k, 1 + (k + 1) % 6) for k in range(6)], PUPIL, bone=h)
        from mathutils import Matrix
        M = Matrix.Translation((s * 0.025, -0.263, 0.324)) @ Matrix.Rotation(math.radians(-s * 22), 4, "Z") \
            @ Matrix.Rotation(math.radians(-14), 4, "X")
        g.transform(e, M)
        g.transform(pv, Matrix.Translation((0, -0.0015, 0)) @ M)
    ell(g, (0.01, 0.008, 0.007), (0, -0.277, 0.303), PINK, h, segs=6, rings=3)
    # oreilles: triangles épais, intérieur rose, bout arrondi
    for s in (1, -1):
        ear = "cat_ear_" + ("l" if s > 0 else "r")
        pts = [(-0.022, 0.0, 0.0), (0.022, 0.0, 0.0), (0.004, 0.0, 0.04), (-0.004, 0.0, 0.04)]
        back = [(x, 0.012, z) for x, y, z in pts]
        inner = [(x * 0.6, -0.003, z * 0.78 + 0.004) for x, y, z in pts]
        vs = g.mesh(pts + back, [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)],
                    GREY, bone=ear)
        _fix(g, vs)
        iv = g.mesh(inner, [(0, 1, 2, 3)], PINK, bone=ear)
        from mathutils import Matrix
        M = Matrix.Translation((s * 0.032, -0.195, 0.345)) @ Matrix.Rotation(math.radians(-s * 18), 4, "Y") \
            @ Matrix.Rotation(math.radians(s * 12), 4, "Z") @ Matrix.Rotation(math.radians(-12), 4, "X")
        g.transform(vs, M)
        g.transform(iv, M)
        _fix(g, iv)
    # queue tigrée, bout sombre
    for b, p0, p1, r0, r1, c in (("cat_tail", (0, 0.165, 0.226), (0, 0.255, 0.204), 0.03, 0.027, GREY),
                                 ("cat_tail_2", (0, 0.25, 0.205), (0, 0.335, 0.18), 0.027, 0.024, DARK),
                                 ("cat_tail_3", (0, 0.33, 0.181), (0, 0.4, 0.162), 0.024, 0.02, GREY)):
        seg(g, p0, p1, r0, r1, c, b, segs=7)
        ell(g, (r1, r1, r1), p1, c, b, segs=7, rings=4)
    ell(g, (0.021, 0.028, 0.021), (0, 0.405, 0.16), DARK, "cat_tail_3", segs=7, rings=4)
    # pattes grises, chaussettes blanches
    for s, side in ((1, "l"), (-1, "r")):
        x = s * 0.034
        seg(g, (x, -0.1, 0.21), (x, -0.1, 0.1), 0.024, 0.017, GREY, "cat_leg_f" + side, segs=6)
        seg(g, (x, -0.1, 0.1), (x, -0.104, 0.012), 0.016, 0.014, WHITE, "cat_leg_f" + side + "_2", segs=6)
        ell(g, (0.017, 0.022, 0.012), (x, -0.112, 0.012), WHITE, "cat_leg_f" + side + "_2", segs=6, rings=3)
        xb = s * 0.04
        ell(g, (0.034, 0.055, 0.06), (xb, 0.11, 0.18), GREY, "cat_leg_b" + side, segs=7, rings=4, rot=(-20, 0, 0))
        seg(g, (xb, 0.1, 0.15), (xb, 0.085, 0.11), 0.02, 0.016, GREY, "cat_leg_b" + side, segs=6)
        seg(g, (xb, 0.085, 0.11), (xb, 0.118, 0.012), 0.015, 0.013, WHITE, "cat_leg_b" + side + "_2", segs=6)
        ell(g, (0.017, 0.024, 0.012), (xb, 0.11, 0.012), WHITE, "cat_leg_b" + side + "_2", segs=6, rings=3)
    return g


def R(x=0.0, y=0.0, z=0.0):
    return {"r": (x, y, z)}


def _legs(fl, fr, bl, br):
    out = {}
    for k, (a, b) in (("fl", fl), ("fr", fr), ("bl", bl), ("br", br)):
        out["cat_leg_" + k] = R(a)
        out["cat_leg_" + k + "_2"] = R(b)
    return out


def _merge(*ps):
    out = {}
    for p in ps:
        for k, v in p.items():
            out[k] = dict(out.get(k, {}), **v)
    return out


def ground(rig, mesh_ob, pose, lift=0.0):
    """Abaisse ou relève la racine pour que le point le plus bas du maillage déformé touche le sol."""
    names = rig.names
    for b in names:
        q, loc, s = rig.local(b, pose.get(b, {}))
        pb = rig.arm.pose.bones[b]
        pb.rotation_quaternion = q
        pb.location = loc
        pb.scale = s
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mesh_ob.evaluated_get(dg)
    me = ev.to_mesh()
    mz = min((ev.matrix_world @ v.co).z for v in me.vertices)
    ev.to_mesh_clear()
    p = dict(pose)
    root = dict(p.get("cat_root", {}))
    l0 = root.get("l", (0, 0, 0))
    root["l"] = (l0[0], l0[1], l0[2] - mz + lift)
    p["cat_root"] = root
    return p


def cat_clips(rig, mesh_ob):
    C = {}
    tail_up = {"cat_tail": R(48), "cat_tail_2": R(18), "cat_tail_3": R(-40)}
    # pas en quatre temps (arrière gauche, avant gauche, arrière droit, avant droit), 1 s, queue dressée
    frames, steps = 24, 12
    phases = {"bl": 0.0, "fl": 0.25, "br": 0.5, "fr": 0.75}
    walk = {}
    for i in range(steps + 1):
        t = i / steps
        legs = {}
        for k, off in phases.items():
            ph = (t + off) % 1.0
            amp = 26 if k.startswith("f") else 24
            if ph < 0.62:
                a, b = -amp + 2 * amp * ph / 0.62, 0.0
            else:
                s = (ph - 0.62) / 0.38
                a = amp - 2 * amp * s
                b = (34 if k.startswith("f") else 30) * math.sin(math.pi * s)
            legs[k] = (a, b)
        pose = _merge(tail_up, _legs(legs["fl"], legs["fr"], legs["bl"], legs["br"]),
                      {"cat_hips": R(0, 2.5 * math.sin(2 * math.pi * t), 0),
                       "cat_head": R(0, 0, 3 * math.sin(2 * math.pi * t)),
                       "cat_tail_3": R(-40, 0, 10 * math.sin(2 * math.pi * t)),
                       "cat_root": {"l": (0, 0, 0.004 * math.cos(4 * math.pi * t))}})
        walk[round(t * frames)] = pose
    C["cat_walk"] = (True, walk)
    # assis: bassin au sol, buste dressé, pattes avant droites, queue enroulée devant les pattes
    sit = _merge({"cat_hips": R(-44), "cat_chest": R(8), "cat_neck": R(-4), "cat_head": R(28)},
                 _legs((36, 0), (36, 0), (-58, 96), (-58, 96)),
                 {"cat_tail": R(-40, 0, 34), "cat_tail_2": R(-6, 0, 50), "cat_tail_3": R(0, 0, 44)})
    sit = ground(rig, mesh_ob, sit)
    look_l = _merge(sit, {"cat_head": R(28, 0, 26), "cat_neck": R(-4, 0, 8)})
    look_r = _merge(sit, {"cat_head": R(26, 0, -24), "cat_neck": R(-4, 0, -6)})
    flick = _merge(sit, {"cat_ear_l": R(0, 0, 30), "cat_tail_3": R(0, 0, 70)})
    C["cat_idle"] = (True, {0: sit, 20: _merge(sit, {"cat_tail_3": R(0, 0, 20)}), 40: sit, 60: look_l, 85: look_l,
                            95: flick, 100: look_l, 120: sit, 140: look_r, 165: look_r, 185: sit,
                            200: _merge(sit, {"cat_tail_3": R(0, 0, 18)}), 220: sit})
    # endormi en rond: couché sur le ventre, pattes repliées dessous, le corps courbé, la tête posée sur le côté,
    # la queue enroulée au sol autour de lui; il respire
    curl = _merge({"cat_hips": R(0, 0, -14), "cat_chest": R(0, 0, 26), "cat_neck": R(16, 0, 40),
                   "cat_head": R(24, 18, 34)},
                  _legs((70, -140), (66, -136), (-80, 150), (-80, 150)),
                  {"cat_tail": R(8, 0, -62), "cat_tail_2": R(4, 0, -58), "cat_tail_3": R(2, 0, -52)})
    curl = ground(rig, mesh_ob, curl)
    breathe = _merge(curl, {"cat_chest": {"r": (0, 0, 26), "s": (1.04, 1.0, 1.05)}})
    C["cat_sleep"] = (True, {0: curl, 45: breathe, 90: curl})
    # se rouler sur le dos: du flanc au dos, les pattes battent, puis il revient
    side = _merge({"cat_hips": R(0, 80, 0), "cat_chest": R(0, 0, 8), "cat_head": R(0, -20, 6)},
                  _legs((-20, 30), (-10, 20), (-20, 30), (-14, 24)), {"cat_tail": R(0, 0, 20)})
    back = _merge({"cat_hips": R(0, 170, 0), "cat_chest": R(0, 0, -10), "cat_neck": R(0, 0, -8),
                   "cat_head": R(-10, 10, -14)},
                  _legs((-60, 70), (-40, 80), (-40, 60), (-56, 50)), {"cat_tail": R(0, 0, -20), "cat_tail_2": R(0, 0, 20)})
    back2 = _merge(back, {"cat_chest": R(0, 0, 12), "cat_head": R(-10, 16, 10)},
                   _legs((-80, 50), (-30, 90), (-56, 40), (-38, 64)))
    side, back, back2 = (ground(rig, mesh_ob, p) for p in (side, back, back2))
    C["cat_roll"] = (True, {0: side, 16: back, 28: back2, 40: back, 52: back2, 64: back, 80: side})
    for b in rig.names:
        pb = rig.arm.pose.bones[b]
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)
    return rig.bake(C)
