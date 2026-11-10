"""Voie D: corps de figurine et vêtements fabriqués par script sur le squelette commun (Blender 5.2, duo-python).

Le corps est fait de volumes de révolution lisses aux cotes de la bible (section 2.1): torse en tonneau, membres en
gélules, tête ellipsoïde, moufles. Chaque vêtement est le même volume décalé de quelques millimètres (couche 1: 15 mm,
couche 2: 30 mm), ouvert aux coutures de la bible (col, taille, poignets, chevilles) et épaissi (bord de 9 mm): il a
donc par construction les poids du corps, et le corps est masqué dessous. Les os du squelette commun sont replacés
sur les repères de la bible sans changer leur orientation de repos, pour que les clips partagés se rejouent.

Usage: duo-python voie_d.py <corps.glb (squelette et clips)> <nuancier.json> <dossier de sortie> <adult_medium|adult_round> <préfixe>
"""
import json
import math
import os
import sys

import bpy
import bmesh  # après bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from figurine import ANKLE, CHIN, COLLAR, CROTCH, H, HEAD_H, HEAD_W, KNEE, WAIST, W_HEAD, X, Z, Builder, chain, face_features, smooth  # noqa: E402

SOURCE, NUANCIER, OUT, BODY_KEY, PREFIX = sys.argv[1:6]
with open(NUANCIER, encoding="utf-8") as fh:
    N = {fam: dict(v) for fam, v in json.load(fh).items()}

# Cotes de la bible (2.1), en mètres. Profondeurs: non cotées par la bible, choisies ici (à valider).
BODIES = {
    "adult_medium": dict(sh=0.425, wa=0.320, hi=0.350, arm=0.085, leg=0.115, d_hi=0.21, d_wa=0.20, d_ch=0.215, belly=0.0),
    "adult_round": dict(sh=0.455, wa=0.430, hi=0.440, arm=0.100, leg=0.138, d_hi=0.29, d_wa=0.33, d_ch=0.27, belly=0.035),
}
B = BODIES[BODY_KEY]
SHOULDER_Z, HIP_Z = 1.255, 0.82
ARM_X = B["sh"] / 2 - B["arm"] / 2
ARM_LEN = SHOULDER_Z - (CROTCH + 0.035)
LEG_X = B["hi"] / 4 + 0.004
HEAD_C = Vector((0, 0, CHIN + HEAD_H / 2))
HEAD_R = Vector((HEAD_W / 2, 0.150, HEAD_H / 2))


# ---------- profils du corps (off = décalage du vêtement) ----------

def torso_profile(off=0.0):
    hi, wa, sh = B["hi"] / 2, B["wa"] / 2, B["sh"] / 2
    rows = [  # z, demi-largeur, demi-profondeur, avancée du ventre
        (0.775, 0.07, 0.06, 0), (0.80, hi * 0.80, B["d_hi"] * 0.42, 0), (0.86, hi, B["d_hi"] / 2, B["belly"] * 0.5),
        (0.92, hi * 0.99, B["d_hi"] / 2, B["belly"] * 0.8), (WAIST, wa, B["d_wa"] / 2, B["belly"]), (1.08, (wa + sh) / 2 - 0.005, (B["d_wa"] + B["d_ch"]) / 4, B["belly"] * 0.7),
        (1.18, sh - 0.015, B["d_ch"] / 2, B["belly"] * 0.2), (1.25, sh - 0.01, B["d_ch"] / 2 - 0.004, 0), (1.292, sh * 0.80, B["d_ch"] * 0.40, 0),
        (COLLAR, 0.068, 0.062, 0), (1.34, 0.056, 0.054, 0),
    ]
    return [(z, a + off, b + off, s) for z, a, b, s in rows]


def torso_at(z, off=0.0):
    rows = torso_profile(off)
    for (z0, a0, b0, s0), (z1, a1, b1, s1) in zip(rows, rows[1:]):
        if z <= z1:
            t = smooth(z0, z1, z) if z1 - z0 < 0.04 else min(max((z - z0) / (z1 - z0), 0.0), 1.0)
            return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, s0 + (s1 - s0) * t
    return rows[-1][1:]


def torso_stations(z0, z1, off=0.0, step=0.03):
    count = max(2, round((z1 - z0) / step))
    out = []
    for i in range(count + 1):
        z = z0 + (z1 - z0) * i / count
        a, b, s = torso_at(z, off)
        out.append((Vector((0, -s, z)), Z, X, a, b))
    return out


def w_torso(p):
    w = chain(p.z, [("Hips", 0.89), ("Spine02", 1.00), ("Spine01", 1.10), ("Spine", 1.21)])
    if p.z > 1.30:
        k = smooth(1.30, 1.36, p.z)
        w = {"Spine": 1 - k, "neck": k}
    return w


def limb_stations(p0, p1, r0, r1, hint, round0, round1, off=0.0, t0=0.0, t1=1.0, cuts=10, k=3):
    """Gélule de p0 à p1 (bouts arrondis au choix), limitée à la portion [t0, t1] de sa longueur."""
    d = (p1 - p0).normalized()
    st = []
    if round0 and t0 <= 0:
        for i in range(k, 0, -1):
            a = math.pi / 2 * i / (k + 0.4)
            st.append((p0 - d * ((r0 + off) * math.sin(a)), d, hint, (r0 + off) * math.cos(a), (r0 + off) * math.cos(a)))
    for i in range(cuts + 1):
        t = t0 + (t1 - t0) * i / cuts
        r = r0 + (r1 - r0) * t + off
        st.append((p0 + (p1 - p0) * t, d, hint, r, r))
    if round1 and t1 >= 1:
        for i in range(1, k + 1):
            a = math.pi / 2 * i / (k + 0.4)
            st.append((p1 + d * ((r1 + off) * math.sin(a)), d, hint, (r1 + off) * math.cos(a), (r1 + off) * math.cos(a)))
    return st


def arm_ends(side):
    return Vector((side * ARM_X, 0, SHOULDER_Z)), Vector((side * (ARM_X + ARM_LEN), 0, SHOULDER_Z))


def w_arm(side):
    L = "Left" if side > 0 else "Right"
    elbow = ARM_X + ARM_LEN / 2
    return lambda p: {L + "Arm": 1 - smooth(elbow - 0.05, elbow + 0.05, abs(p.x)), L + "ForeArm": smooth(elbow - 0.05, elbow + 0.05, abs(p.x))}


def leg_ends(side):
    return Vector((side * LEG_X, 0, HIP_Z)), Vector((side * LEG_X, 0, ANKLE - 0.02))


def w_leg(side):
    L = "Left" if side > 0 else "Right"
    return lambda p: {L + "UpLeg": 1 - smooth(KNEE - 0.05, KNEE + 0.05, 2 * KNEE - p.z), L + "Leg": smooth(KNEE - 0.05, KNEE + 0.05, 2 * KNEE - p.z)}


def head_surface_y(x, z, off=0.0):
    q = 1 - (x / (HEAD_R.x + off)) ** 2 - ((z - HEAD_C.z) / (HEAD_R.z + off)) ** 2
    return -(HEAD_R.y + off) * math.sqrt(max(q, 0.0))


# ---------- squelette: os replacés sur les repères de la bible ----------

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SOURCE)
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
for o in list(bpy.context.scene.objects):
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
clips = {}
for act in bpy.data.actions:
    base = act.name.split("_squelette")[0].split(".")[0]
    if base in ("walk", "run", "idle", "wave") and base not in clips:
        clips[base] = act
        act.use_fake_user = True
if rig.animation_data:
    rig.animation_data.action = None
    for tr in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(tr)
for pb in rig.pose.bones:
    pb.matrix_basis.identity()

heads = {"Hips": (0, 0, 0.90), "Spine02": (0, 0, 0.99), "Spine01": (0, 0, 1.09), "Spine": (0, 0, 1.19), "neck": (0, 0, 1.31), "Head": (0, 0, CHIN + 0.01)}
for s, L in ((1, "Left"), (-1, "Right")):
    heads.update({
        L + "Shoulder": (s * 0.03, 0, SHOULDER_Z), L + "Arm": (s * ARM_X, 0, SHOULDER_Z), L + "ForeArm": (s * (ARM_X + ARM_LEN / 2), 0, SHOULDER_Z),
        L + "Hand": (s * (ARM_X + ARM_LEN), 0, SHOULDER_Z), L + "UpLeg": (s * LEG_X, 0, HIP_Z), L + "Leg": (s * LEG_X, 0, KNEE),
        L + "Foot": (s * LEG_X, 0, ANKLE), L + "ToeBase": (s * LEG_X, -0.11, 0.03),
    })
NEXT = {"Hips": "Spine02", "Spine02": "Spine01", "Spine01": "Spine", "Spine": "neck", "neck": "Head"}
for L in ("Left", "Right"):
    NEXT.update({L + "Shoulder": L + "Arm", L + "Arm": L + "ForeArm", L + "ForeArm": L + "Hand", L + "UpLeg": L + "Leg", L + "Leg": L + "Foot", L + "Foot": L + "ToeBase"})
bpy.context.view_layer.objects.active = rig
old_hips = rig.data.bones["Hips"].head_local.z
bpy.ops.object.mode_set(mode="EDIT")
ebs = rig.data.edit_bones
old = {eb.name: (eb.head.copy(), eb.tail.copy(), eb.z_axis.copy()) for eb in ebs}
for eb in ebs:
    eb.use_connect = False
for eb in ebs:
    h0, t0, z0 = old[eb.name]
    if eb.name in heads:
        eb.head = Vector(heads[eb.name])
        eb.tail = Vector(heads[NEXT[eb.name]]) if eb.name in NEXT else eb.head + (t0 - h0)
    else:  # bouts de tête: ils suivent l'os de la tête
        delta = Vector(heads["Head"]) - old["Head"][0]
        eb.head, eb.tail = h0 + delta, t0 + delta
    eb.align_roll(z0)
bpy.ops.object.mode_set(mode="OBJECT")
k_hips = rig.data.bones["Hips"].head_local.z / old_hips
from bpy_extras import anim_utils  # noqa: E402
for act in clips.values():
    for fc in anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves:
        if fc.data_path == 'pose.bones["Hips"].location':
            for kp in fc.keyframe_points:
                for pt in (kp.co, kp.handle_left, kp.handle_right):
                    pt.y *= k_hips
            fc.update()

# ---------- pièces ----------
MAT, SATIN = 0.85, 0.55
pieces = {}


def register(name, obj, categorie, masque):
    obj["categorie"] = categorie
    obj["masque"] = masque
    pieces[name] = obj


def body(skin):
    b = Builder()
    b.sweep(torso_stations(0.775, 1.34), 18, lambda c: "bassin" if c.z < WAIST else "torse", w_torso, cap0=True, cap1=True)
    b.sweep([(Vector((0, 0, z)), Z, X, 0.043, 0.043) for z in (1.30, 1.33, 1.36, 1.39)], 16, "cou", lambda p: {"neck": 1.0})
    for s in (-1, 1):
        L = "Left" if s > 0 else "Right"
        p0, p1 = arm_ends(s)
        elbow = ARM_X + ARM_LEN / 2
        b.sweep(limb_stations(p0, p1, B["arm"] / 2, B["arm"] / 2 * 0.9, Z, True, True), 12, lambda c: "bras" if abs(c.x) < elbow else "avant_bras", w_arm(s), cap0=True, cap1=True)
        hand = p1 + X * (s * 0.045)
        wh = lambda p, L=L: {L + "Hand": 1.0}  # noqa: E731
        st = []
        for i in range(1, 10):
            a = -math.pi / 2 + math.pi * i / 10
            st.append((hand + X * (s * 0.052 * math.sin(a)), X * s, Z, 0.027 * math.cos(a) ** 0.8, 0.043 * math.cos(a) ** 0.8))
        b.sweep(st, 14, "mains", wh, cap0=True, cap1=True)
        b.ellipsoid(hand + Vector((-s * 0.012, -0.042, -0.004)), Vector((0.022, 0.017, 0.016)), "mains", wh, n=10, m=8)
        q0, q1 = leg_ends(s)
        b.sweep(limb_stations(q0, q1, B["leg"] / 2, B["leg"] / 2 * 0.88, X, True, False), 12, lambda c: "cuisses" if c.z > KNEE else "jambes", w_leg(s), cap0=True, cap1=True)
    colors = {z: (skin, MAT) for z in ("bassin", "torse", "cou", "bras", "avant_bras", "mains", "cuisses", "jambes")}
    for z in ("bassin", "torse"):
        colors[z] = ("#E4DCCB", MAT)  # sous-vêtement uni de la bible (2.2)
    return b.to_object("corps", colors, rig)


def head(name, skin, brows):
    b = Builder()
    b.ellipsoid(HEAD_C, HEAD_R, "peau", W_HEAD, n=24, m=16)
    for s in (-1, 1):
        b.ellipsoid(HEAD_C + Vector((s * (HEAD_R.x - 0.004), 0.012, -0.03)), Vector((0.016, 0.026, 0.036)), "peau", W_HEAD, n=10, m=8)
    b.ellipsoid(Vector((0, head_surface_y(0, 1.487) - 0.004, 1.487)), Vector((0.017, 0.02, 0.016)), "peau", W_HEAD, n=10, m=8)
    face_features(b, head_surface_y)
    o = b.to_object(name, {"peau": (skin, MAT), "oeil": (N["fixes"]["oeil"], 0.25), "sourcils": (brows, MAT), "bouche": (N["fixes"]["bouche"], SATIN)}, rig)
    register(name, o, "tete", [])


def hair(name, color, style):
    b = Builder()
    off = 0.004
    if style == "court":
        keep = lambda c: c.z > 1.552 - 0.50 * c.y + 0.25 * abs(c.x) * (c.y < 0)  # noqa: E731
    else:  # carré avec frange
        keep = lambda c: c.z > (1.60 if c.y < -0.085 else 1.425)  # noqa: E731
    b.ellipsoid(HEAD_C, HEAD_R, "cheveux", W_HEAD, n=24, m=18, keep=None if style == "court" else keep, off=off)
    if style == "court":
        b.cut = (Vector((0, 0, 1.552)), Vector((0, 0.50, 1.0)))
    o = b.to_object(name, {"cheveux": (color, MAT)}, rig, thickness=0.016 if style == "court" else 0.024)
    register(name, o, "cheveux", [])


def shoes(name, color):
    b = Builder()
    for s in (-1, 1):
        L = "Left" if s > 0 else "Right"
        wf = lambda p, L=L: {L + "Foot": 1.0}  # noqa: E731
        c = Vector((s * LEG_X, -0.048, 0.052))
        start = len(b.verts)
        b.ellipsoid(c, Vector((0.062, 0.12, 0.062)), "cuir", wf, n=18, m=12)
        for i in range(start, len(b.verts)):
            v = b.verts[i]
            v.z = max(v.z, 0.0)
            if v.y > -0.02:  # talon plus étroit, tige qui remonte à la cheville
                v.z += 0.035 * smooth(-0.02, 0.05, v.y) * (v.z > 0.03)
        b.sweep([(Vector((s * LEG_X, -0.048, z)), Z, X, 0.068 - 0.004 * i, 0.126 - 0.004 * i) for i, z in enumerate((0.0, 0.012, 0.022))], 18, "semelle", wf, cap0=True)
    o = b.to_object(name, {"cuir": (color, SATIN), "semelle": (N["fixes"]["semelle"], MAT)}, rig)
    register(name, o, "chaussures", [])


def sleeves(b, off, t_end, tag):
    for s in (-1, 1):
        p0, p1 = arm_ends(s)
        b.sweep(limb_stations(p0, p1, B["arm"] / 2, B["arm"] / 2 * 0.9, Z, True, False, off=off, t1=t_end), 12, tag, w_arm(s))


def top(name, color, off, hem, sleeve_end, masque, opening=False, categorie="haut"):
    b = Builder()
    keep = (lambda c: not (c.y < 0 and abs(c.x) < 0.045)) if opening else None
    b.sweep(torso_stations(hem, 1.337 if not opening else 1.315, off), 18, "tissu", w_torso, keep=keep)
    sleeves(b, off * 0.85, sleeve_end, "tissu")
    o = b.to_object(name, {"tissu": (color, MAT)}, rig, thickness=0.008)
    register(name, o, categorie, masque)


def trousers(name, color, leg_end_z, masque):
    b = Builder()
    off = 0.008
    b.sweep(torso_stations(0.775, WAIST + 0.03, off), 18, "tissu", w_torso, cap0=True)
    for s in (-1, 1):
        q0, q1 = leg_ends(s)
        t1 = (q0.z - leg_end_z) / (q0.z - q1.z)
        b.sweep(limb_stations(q0, q1, B["leg"] / 2, B["leg"] / 2 * 0.88, X, True, False, off=off, t1=t1), 12, "tissu", w_leg(s))
    o = b.to_object(name, {"tissu": (color, MAT)}, rig, thickness=0.008)
    register(name, o, "bas", masque)


def skirt(name, color, hem_z):
    b = Builder()
    top_z = WAIST + 0.03
    st = []
    for i in range(13):
        t = i / 12
        z = top_z + (hem_z - top_z) * t
        a, d, s = torso_at(max(z, 0.86), 0.008)
        flare = smooth(0.0, 1.0, t) * 0.085 + 0.02 * t
        st.append((Vector((0, -s * (1 - t), z)), Z, X, a + flare, d + flare))

    def w(p):
        t = min(max((top_z - p.z) / (top_z - hem_z), 0.0), 1.0)
        legs = 0.75 * smooth(0.25, 1.0, t)
        side = smooth(-0.09, 0.09, p.x)
        return {"Hips": 1 - legs, "LeftUpLeg": legs * side, "RightUpLeg": legs * (1 - side)}
    b.sweep(st, 22, "tissu", w)
    o = b.to_object(name, {"tissu": (color, MAT)}, rig, thickness=0.008)
    register(name, o, "bas", ["bassin"])


T = N["tissus"]
skin_default = N["peaux"]["porcelaine" if BODY_KEY == "adult_medium" else "acajou"]
corps = body(skin_default)
head("tete_ronde", skin_default, N["cheveux"]["chatain" if BODY_KEY == "adult_medium" else "noir"])
hair("cheveux_court", N["cheveux"]["chatain"], "court")
hair("cheveux_carre", N["cheveux"]["noir"], "carre")
shoes("chaussures_galet", N["fixes"]["cuir_sombre"] if BODY_KEY == "adult_medium" else T["encre"])
top("haut_tshirt", T["moutarde"], 0.019, WAIST - 0.06, 0.30, ["torse"])
top("haut_pull", T["ardoise"], 0.021, WAIST - 0.09, 0.975, ["torse", "bras", "avant_bras"])
top("veste_ouverte", T["canard"], 0.038, WAIST - 0.12, 0.975, [], opening=True, categorie="veste")
trousers("bas_pantalon", T["marine"], ANKLE - 0.015, ["bassin", "cuisses", "jambes"])
trousers("bas_short", T["olive"], 0.56, ["bassin"])
skirt("bas_jupe", T["prune"], 0.50)

# ---------- export ----------
os.makedirs(OUT, exist_ok=True)
rig.name = "squelette_commun"
report = {"corps": BODY_KEY, "pieces": {}}


def export(objs, path, animations):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_skins=True, export_extras=True,
                              export_animations=animations, export_animation_mode="NLA_TRACKS", export_vertex_color="NONE", export_materials="EXPORT")


for name, o in pieces.items():
    path = os.path.join(OUT, f"{PREFIX}_{name}.glb")
    export([o], path, False)
    report["pieces"][name] = {"categorie": o["categorie"], "masque": list(o["masque"]), "triangles": sum(len(p.vertices) - 2 for p in o.data.polygons), "octets": os.path.getsize(path)}
ad = rig.animation_data_create()
for name, act in clips.items():
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    strip.action_slot = act.slots[0]
path = os.path.join(OUT, f"{PREFIX}_corps.glb")
export([corps], path, True)
report["corps_triangles"] = sum(len(p.vertices) - 2 for p in corps.data.polygons)
report["corps_octets"] = os.path.getsize(path)
report["clips"] = sorted(clips)
report["os"] = {b.name: [round(x, 4) for x in b.head_local] for b in rig.data.bones}
with open(os.path.join(OUT, f"{PREFIX}_rapport.json"), "w", encoding="utf-8") as fh:
    json.dump(report, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("VOIE_D", json.dumps({k: v for k, v in report.items() if k != "os"}, ensure_ascii=False))
