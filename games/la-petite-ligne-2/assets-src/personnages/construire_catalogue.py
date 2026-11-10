"""Fabrique tout le catalogue des personnages à partir de gabarits.toml (Blender 5.2, duo-python).

Sorties: un GLB par emplacement dans assets/commun/personnages/ (un nœud par pièce, squelette commun de 24 os,
clips dans body.glb), catalogue.json (contrat de src/donnees/schemas/personnage.ts) et morphologies.json (données
de fabrication que le contrat ne porte pas encore: cibles de morphose, longueurs par âge, conventions des zones).

Usage: duo-python construire_catalogue.py <dossier des GLB> <dossier des données>
"""
import json
import math
import os
import sys
import tomllib

import bpy
import bmesh  # après bpy
from bpy_extras import anim_utils
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from figurine import REGIONS, X, Y, Z, ZONE_FIXED, ZONE_SKIN, Builder, chain, limb_stations, rim, section_v, smooth, srgb, tag  # noqa: E402

OUT_GLB, OUT_DATA = sys.argv[-2:]
with open(os.path.join(HERE, "gabarits.toml"), "rb") as fh:
    G = tomllib.load(fh)
with open(os.path.join(HERE, "nuancier.json"), encoding="utf-8") as fh:
    N = {fam: dict(v) for fam, v in json.load(fh).items()}

# Repères de l'adulte (bible 2.1), en mètres.
H, HEAD_H, HEAD_W = 1.70, 0.34, 0.315
CHIN, COLLAR, WAIST, CROTCH, KNEE, ANKLE = 1.36, 1.325, 0.983, 0.80, 0.462, 0.10
SHOULDER_Z, HIP_Z = 1.255, 0.82
HEAD_C = Vector((0, 0, CHIN + HEAD_H / 2))
HEAD_R = Vector((HEAD_W / 2, 0.150, HEAD_H / 2))
EYE_Z = H - HEAD_H * 0.56
UNDERWEAR = "#E4DCCB"
SKIN = N["peaux"]["porcelaine"]
W_HEAD = lambda p: {"Head": 1.0}  # noqa: E731


def color_of(zone):
    return N[zone["famille"]][zone["defaut"]]


def zone_colors(zone):
    names = zone.get("couleurs") or list(N[zone["famille"]])
    return [N[zone["famille"]][n].lower() for n in names]


class Body:
    """Cotes d'une corpulence et volumes du corps: tout vêtement est un de ces volumes, décalé."""

    def __init__(self, dims):
        self.B = dims
        self.arm_x = dims["sh"] / 2 - dims["arm"] / 2
        self.arm_len = SHOULDER_Z - (CROTCH + 0.035)
        self.leg_x = dims["hi"] / 4 + 0.004

    def torso_rows(self, off):
        B = self.B
        hi, wa, sh = B["hi"] / 2, B["wa"] / 2, B["sh"] / 2
        rows = [
            (0.775, 0.07, 0.06, 0), (0.80, hi * 0.80, B["d_hi"] * 0.42, 0), (0.86, hi, B["d_hi"] / 2, B["belly"] * 0.5),
            (0.92, hi * 0.99, B["d_hi"] / 2, B["belly"] * 0.8), (WAIST, wa, B["d_wa"] / 2, B["belly"]),
            (1.08, (wa + sh) / 2 - 0.005, (B["d_wa"] + B["d_ch"]) / 4, B["belly"] * 0.7), (1.18, sh - 0.015, B["d_ch"] / 2, B["belly"] * 0.2),
            (1.25, sh - 0.004, B["d_ch"] / 2 - 0.004, 0), (1.292, sh * 0.98, B["d_ch"] * 0.46, 0), (1.318, sh * 0.88, B["d_ch"] * 0.41, 0), (1.338, 0.080, 0.068, 0), (1.36, 0.052, 0.050, 0),
        ]
        return [(z, a + off, b + off, s) for z, a, b, s in rows]

    def torso_at(self, z, off=0.0):
        rows = self.torso_rows(off)
        for (z0, a0, b0, s0), (z1, a1, b1, s1) in zip(rows, rows[1:]):
            if z <= z1:
                t = min(max((z - z0) / (z1 - z0), 0.0), 1.0)
                return a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, s0 + (s1 - s0) * t
        return rows[-1][1:]

    def torso_stations(self, z0, z1, off=0.0, step=0.04):
        count = max(2, round((z1 - z0) / step))
        out = []
        for i in range(count + 1):
            z = z0 + (z1 - z0) * i / count
            a, b, s = self.torso_at(z, off)
            out.append((Vector((0, -s, z)), Z, X, a, b))
        return out

    @staticmethod
    def w_torso(p):
        if p.z > 1.30:
            k = smooth(1.30, 1.36, p.z)
            return {"Spine": 1 - k, "neck": k}
        return chain(p.z, [("Hips", 0.89), ("Spine02", 1.00), ("Spine01", 1.10), ("Spine", 1.21)])

    def arm_ends(self, s):
        return Vector((s * self.arm_x, 0, SHOULDER_Z)), Vector((s * (self.arm_x + self.arm_len), 0, SHOULDER_Z))

    def arm_t(self, p):
        return (abs(p.x) - self.arm_x) / self.arm_len

    def w_arm(self, s):
        L = "Left" if s > 0 else "Right"

        def w(p):
            k = smooth(0.38, 0.62, self.arm_t(p))
            return {L + "Arm": 1 - k, L + "ForeArm": k}
        return w

    def leg_ends(self, s):
        return Vector((s * self.leg_x, 0, HIP_Z)), Vector((s * self.leg_x, 0, ANKLE - 0.02))

    @staticmethod
    def leg_t(p):
        return (HIP_Z - p.z) / (HIP_Z - (ANKLE - 0.02))

    @staticmethod
    def w_leg(s):
        L = "Left" if s > 0 else "Right"

        def w(p):
            k = smooth(KNEE + 0.05, KNEE - 0.05, p.z)
            return {L + "UpLeg": 1 - k, L + "Leg": k}
        return w

    # ----- corps nu
    def body(self):
        b = Builder()
        B = self.B
        skin = lambda region: tag(ZONE_SKIN, SKIN, region)  # noqa: E731
        b.sweep(self.torso_stations(0.775, 1.34), 16, lambda c: tag(ZONE_FIXED, UNDERWEAR, "pelvis" if c.z < WAIST else "torso"), self.w_torso, cap0=True, cap1=True)
        b.sweep([(Vector((0, 0, z)), Z, X, 0.043, 0.043) for z in (1.30, 1.345, 1.39)], 10, skin("neck"), lambda p: {"neck": 1.0})
        for s in (-1, 1):
            L = "Left" if s > 0 else "Right"
            p0, p1 = self.arm_ends(s)

            def arm_region(c):
                t = self.arm_t(c)
                return skin("upper-arm-a" if t < 0.3 else "upper-arm-b" if t < 0.5 else "forearm")
            b.sweep(limb_stations(p0, p1, B["arm"] / 2, B["arm"] / 2 * 0.9, Z, True, True), 10, arm_region, self.w_arm(s), cap0=True, cap1=True)
            hand = p1 + X * (s * 0.046)
            wh = lambda p, L=L: {L + "Hand": 1.0}  # noqa: E731
            st = []
            for i in range(1, 9):
                a = -math.pi / 2 + math.pi * i / 9
                st.append((hand + X * (s * 0.060 * math.sin(a)), X * s, Z, 0.033 * math.cos(a) ** 0.7, 0.050 * math.cos(a) ** 0.7))
            b.sweep(st, 10, skin("hand"), wh, cap0=True, cap1=True)
            b.ellipsoid(hand + Vector((-s * 0.010, -0.049, -0.004)), Vector((0.028, 0.021, 0.020)), skin("hand"), wh, n=8, m=6, rot=(0, 0, s * 25))
            q0, q1 = self.leg_ends(s)

            def leg_region(c):
                t = self.leg_t(c)
                return skin("thigh-a" if t < 0.3 else "thigh-b" if t < 0.5 else "shin")
            b.sweep(limb_stations(q0, q1, B["leg"] / 2, B["leg"] / 2 * 0.88, X, True, False), 10, leg_region, self.w_leg(s), cap0=True, cap1=True)
        return b

    # ----- bases des vêtements
    def torse(self, spec, b=None, hem_z=None):
        b = b or Builder()
        B = self.B
        off, col, opening = spec["couche"], spec.get("col", 1.337), spec.get("ouverture", 0.0)
        bulge = 0.003 if spec.get("bourrelet") else 0.0
        tg = tag(0, color_of(spec["zones"][0]))
        keep = (lambda c, f: not (c.y < 0 and abs(c.x) < opening / 2)) if opening else None
        if hem_z is None:
            st = rim(self.torso_stations(WAIST - spec.get("ourlet", 0.06), col, off), off - 0.006, start=True, bulge=bulge)
        else:
            st = self.torso_stations(hem_z, col, off)
        st = rim(st, off + 0.006, end=True, bulge=bulge)
        b.sweep(st, 16, tg, self.w_torso, keep=keep)
        sleeve = spec.get("manches", 0.0)
        if sleeve > 0:
            for s in (-1, 1):
                p0, p1 = self.arm_ends(s)
                st = limb_stations(p0, p1, B["arm"] / 2, B["arm"] / 2 * 0.9, Z, True, False, off=off * 0.85, t1=sleeve)
                b.sweep(rim(st, off * 0.85 - 0.002, end=True, bulge=bulge), 10, tg, self.w_arm(s))
        return b

    def jambes(self, spec):
        b = Builder()
        B = self.B
        off = spec["couche"]
        tg = tag(0, color_of(spec["zones"][0]))
        b.sweep(rim(self.torso_stations(0.775, WAIST + 0.03, off), off - 0.002, end=True), 16, tg, self.w_torso, cap0=True)
        for s in (-1, 1):
            q0, q1 = self.leg_ends(s)
            st = limb_stations(q0, q1, B["leg"] / 2, B["leg"] / 2 * 0.88, X, True, False, off=off, t1=min(spec["longueur"], 0.99))
            b.sweep(rim(st, off - 0.002, end=True), 10, tg, self.w_leg(s))
        return b

    def skirt_stations(self, spec, top_z):
        hem = spec["bas"]
        st = []
        for i in range(11):
            t = i / 10
            z = hem + (top_z - hem) * t
            a, d, s = self.torso_at(max(z, 0.86), spec["couche"])
            flare = spec["evasement"] * smooth(0.0, 1.0, 1 - t) * (1 - t) ** 0.6
            st.append((Vector((0, -s * t, z)), Z, X, a + flare, d + flare))
        return st

    @staticmethod
    def w_skirt(top_z, hem):
        def w(p):
            t = min(max((top_z - p.z) / (top_z - hem), 0.0), 1.0)
            legs = 0.5 * smooth(0.3, 1.0, t)
            side = smooth(-0.16, 0.16, p.x)
            return {"Hips": 1 - legs, "LeftUpLeg": legs * side, "RightUpLeg": legs * (1 - side)}
        return w

    def jupe(self, spec):
        b = Builder()
        top_z = WAIST + 0.03
        st = rim(rim(self.skirt_stations(spec, top_z), 0.02, start=True), spec["couche"] - 0.002, end=True)
        b.sweep(st, 16, tag(0, color_of(spec["zones"][0])), self.w_skirt(top_z, spec["bas"]))
        return b

    def robe(self, spec):
        b = Builder()
        st = rim(self.skirt_stations(spec, WAIST), 0.02, start=True)
        ws = self.w_skirt(WAIST, spec["bas"])
        b.sweep(st, 16, tag(0, color_of(spec["zones"][0])), ws)
        return self.torse(spec, b, hem_z=WAIST)

    def galet(self, spec):
        b = Builder()
        shaft = spec["tige"]
        leather, sole = tag(0, color_of(spec["zones"][0])), tag(1, color_of(spec["zones"][1]))
        for s in (-1, 1):
            L = "Left" if s > 0 else "Right"

            def wf(p, L=L):
                k = smooth(0.13, 0.19, p.z)
                return {L + "Foot": 1 - k, L + "Leg": k}
            c = Vector((s * self.leg_x, -0.048, 0.052))
            start = len(b.verts)
            b.ellipsoid(c, Vector((0.064, 0.12, 0.064)), leather, wf, n=12, m=7)
            for i in range(start, len(b.verts)):
                b.verts[i].z = max(b.verts[i].z, 0.0)
            b.sweep([(Vector((s * self.leg_x, -0.048, z)), Z, X, 0.070 - 0.004 * i, 0.126 - 0.004 * i) for i, z in enumerate((0.0, 0.012, 0.022))], 12, sole, wf, cap0=True)
            r = self.B["leg"] / 2 * 0.88 + 0.016
            st = [(Vector((s * self.leg_x, 0.0, z)), Z, X, r, r) for z in ([0.05, shaft] if shaft <= 0.12 else [0.05, 0.12, 0.18, shaft])]
            b.sweep(rim(st, 0.014, end=True, bulge=0.003), 10, leather, wf)
        return b


# ---------------------------------------------------------------- tête, visage, cheveux
EXPRESSIONS = {
    # sourcils (montée, inclinaison en degrés: positif = bout intérieur relevé), paupières (0 ouvert, 1 fermé),
    # arc d'œil fermé (0 aucun, 1 rieur, -1 dormeur), joues, bouche.
    "neutral": dict(brow=(0.0, 0.0), lid=0.12, arc=0, cheeks=0, mouth=dict(w=0.030, curve=0.008, thick=0.006)),
    "joy": dict(brow=(0.005, 0.0), lid=1.0, arc=1, cheeks=1, mouth=dict(w=0.040, curve=0.005, open_bot=0.026, thick=0.006)),
    "surprise": dict(brow=(0.014, 4.0), lid=0.0, arc=0, cheeks=0, mouth=dict(w=0.014, open_top=0.014, open_bot=0.016, thick=0.004)),
    "thinking": dict(brow=(0.010, 8.0), brow_r=(-0.004, -6.0), lid=0.3, arc=0, cheeks=0, mouth=dict(w=0.020, cx=0.012, tilt=0.005, thick=0.006)),
    "embarrassed": dict(brow=(0.004, 14.0), lid=0.15, arc=0, cheeks=1, mouth=dict(w=0.028, wave=0.005, thick=0.006)),
    "sad": dict(brow=(0.002, 20.0), lid=0.38, arc=0, cheeks=0, mouth=dict(w=0.028, curve=-0.010, thick=0.006)),
    "angry": dict(brow=(-0.008, -20.0), lid=0.34, arc=0, cheeks=0, mouth=dict(w=0.030, curve=-0.008, thick=0.008)),
    "sleepy": dict(brow=(0.0, 4.0), lid=1.0, arc=-1, cheeks=0, mouth=dict(w=0.009, open_top=0.006, open_bot=0.007, thick=0.004)),
    "blink": dict(brow=(0.0, 0.0), lid=1.0, arc=-1, cheeks=0, mouth=dict(w=0.030, curve=0.008, thick=0.006)),
    "talk": dict(brow=(0.002, 0.0), lid=0.12, arc=0, cheeks=0, mouth=dict(w=0.022, open_top=0.006, open_bot=0.012, thick=0.005)),
}
FIX = N["fixes"]


def skull(spec):
    b = Builder()
    sk = tag(ZONE_SKIN, SKIN)
    b.ellipsoid(HEAD_C, HEAD_R, sk, W_HEAD, n=20, m=13)
    jaw, chin = spec["machoire"], spec["menton"]
    for v in b.verts:
        t = smooth(EYE_Z - 0.01, CHIN + 0.02, v.z)  # 0 aux yeux, 1 au menton
        v.x *= 1 + jaw * t
        v.y *= 1 + jaw * 0.5 * t
        v.z -= chin * t
    e = spec["oreilles"]
    for s in (-1, 1):
        b.ellipsoid(HEAD_C + Vector((s * (HEAD_R.x - 0.002), 0.012, -0.03)), Vector((0.016 * e, 0.026 * e, 0.038 * e)), sk, W_HEAD, n=6, m=5)
    return b


def face(b, surf, spec, e):
    """Visage à pièces: yeux, paupières, arcs d'œil fermé, sourcils, joues, bouche, nez. Même topologie pour chaque expression."""
    sk = tag(ZONE_SKIN, SKIN)
    ink, white = tag(ZONE_FIXED, FIX["oeil"]), tag(ZONE_FIXED, FIX["blanc_oeil"])
    nz = spec["nez"]
    b.ellipsoid(Vector((0, surf(0, EYE_Z - 0.035) - 0.004 * nz, EYE_Z - 0.035)), Vector((0.017 * nz, 0.022 * nz, 0.016 * nz)), sk, W_HEAD, n=8, m=5)
    for s in (-1, 1):
        ex = s * 0.061
        y = surf(ex, EYE_Z)
        b.ellipsoid(Vector((ex, y + 0.002, EYE_Z)), Vector((0.027, 0.007, 0.030)), white, W_HEAD, n=10, m=5)
        b.ellipsoid(Vector((ex * 0.97, y - 0.004, EYE_Z - 0.001)), Vector((0.017, 0.006, 0.020)), ink, W_HEAD, n=10, m=5)
        b.ellipsoid(Vector((ex - 0.006, y - 0.009, EYE_Z + 0.008)), Vector((0.006, 0.003, 0.006)), white, W_HEAD, n=6, m=4)
        # paupière: coque à la couleur de la peau, repliée en haut de l'œil quand il est ouvert
        start = len(b.verts)
        b.ellipsoid(Vector((ex, y + 0.001, EYE_Z)), Vector((0.0295, 0.0115, 0.0325)), sk, W_HEAD, n=10, m=6)
        c = max(e["lid"], 0.06)
        top = EYE_Z + 0.0325
        for i in range(start, len(b.verts)):
            v = b.verts[i]
            v.z = top - (top - v.z) * c
            v.y += 0.004 * (1 - c)
        # arc de l'œil fermé: caché dans la tête tant qu'il ne sert pas
        st = []
        for i in range(5):
            u = -1 + i / 2
            if e["arc"]:
                z = EYE_Z - 0.004 + e["arc"] * 0.010 * (1 - u * u) - (0.004 if e["arc"] < 0 else 0)
                p = Vector((ex + u * 0.024, 0, z))
                p.y = y - 0.0125
            else:
                p = Vector((ex + u * 0.004, y + 0.03, EYE_Z))
            st.append((p, X, Z, 0.0026 if i in (0, 4) else 0.0042, 0.0026 if i in (0, 4) else 0.0042))
        b.sweep(st, 6, ink, W_HEAD, cap0=True, cap1=True)
        # sourcil
        dz, tilt = e.get("brow_r", e["brow"]) if s < 0 else e["brow"]
        rise = math.tan(math.radians(tilt)) * 0.026
        pts = [Vector((s * 0.030, 0, EYE_Z + 0.054 + dz + rise)), Vector((s * 0.058, 0, EYE_Z + 0.060 + dz)), Vector((s * 0.088, 0, EYE_Z + 0.054 + dz - rise))]
        for p in pts:
            p.y = surf(p.x, p.z) - 0.004
        st = [(pts[0], pts[1] - pts[0], Z, 0.004, 0.004), (pts[0] + (pts[1] - pts[0]) * 0.2, pts[1] - pts[0], Z, 0.0075, 0.0075), (pts[1], pts[2] - pts[0], Z, 0.008, 0.008),
              (pts[2] - (pts[2] - pts[1]) * 0.2, pts[2] - pts[1], Z, 0.0075, 0.0075), (pts[2], pts[2] - pts[1], Z, 0.004, 0.004)]
        b.sweep(st, 6, tag(0, color_of(spec["zones"][0])), W_HEAD, cap0=True, cap1=True)
        # joue
        cx, cz = s * 0.094, EYE_Z - 0.058
        b.ellipsoid(Vector((cx, surf(cx, cz) + (0.001 if e["cheeks"] else 0.02), cz)), Vector((0.021, 0.004, 0.015)), tag(ZONE_FIXED, FIX["joue"]), W_HEAD, n=8, m=4)
    # bouche: plaque en relief dont le contour change
    m = e["mouth"]
    mz = CHIN + HEAD_H * 0.235 - spec["menton"] * 0.5
    w, cx = m["w"] * 1.25, m.get("cx", 0.0)
    nx, rows = 10, 4
    base = len(b.verts)
    for i in range(nx + 1):
        u = -1 + 2 * i / nx
        arc = math.sqrt(max(1 - u * u, 0.0))
        mid = m.get("curve", 0.0) * u * u + m.get("tilt", 0.0) * u + m.get("wave", 0.0) * math.sin(1.5 * math.pi * u)
        half = m["thick"] * 0.7 * (0.45 + 0.55 * arc)
        z_top = mz + mid + half + m.get("open_top", 0.0) * arc
        z_bot = mz + mid - half - m.get("open_bot", 0.0) * arc
        for j in range(rows + 1):
            t = j / rows
            x, z = cx + u * w, z_bot + (z_top - z_bot) * t
            b.verts.append(Vector((x, surf(x, z) - 0.001 - 0.004 * math.sin(math.pi * t) * (0.4 + 0.6 * arc), z)))
            b.weights.append({"Head": 1.0})
    mouth = tag(1, color_of(spec["zones"][1]))
    for i in range(nx):
        for j in range(rows):
            a = base + i * (rows + 1) + j
            b.faces.append((a, a + rows + 1, a + rows + 2, a + 1))
            b.tags.append(mouth)


def head(spec, rig):
    morphs = {}
    basis = None
    probe = skull(spec)
    bvh = BVHTree.FromPolygons(probe.verts, probe.faces)

    def surf(x, z):
        hit = bvh.ray_cast(Vector((x, -1.0, z)), Y)[0]
        return hit.y if hit else -HEAD_R.y
    for name, e in EXPRESSIONS.items():
        b = skull(spec)
        face(b, surf, spec, e)
        if basis is None:
            basis = b
        else:
            morphs[name] = b.verts
    return basis.to_object(spec["id"], rig, morphs)


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def hair(spec, rig):
    tg = tag(0, color_of(spec["zones"][0]))
    front, nape = spec["front"], spec["nuque"]

    def cap(name):
        b = Builder()
        b.ellipsoid(HEAD_C, HEAD_R, tg, W_HEAD, n=20, m=13, off=0.013)
        b.cut = (Vector((0, 0, (front + nape) / 2)), Vector((0, (front - nape) / (2 * HEAD_R.y), 1.0)))
        o = b.to_object(name, rig)
        bpy.context.view_layer.objects.active = o
        mod = o.modifiers.new("epaisseur", "SOLIDIFY")
        mod.thickness = 0.012
        mod.offset = -1.0
        mod.use_rim_only = True
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        return o
    b = Builder()
    for x, y, z, rx, ry, rz, ax, ay, az in spec["meches"]:
        sides = (1, -1) if spec.get("miroir") and abs(x) > 1e-6 else (1,)
        for s in sides:
            b.ellipsoid(Vector((s * x, y, z)), Vector((rx, ry, rz)), tg, W_HEAD, n=10, m=6, rot=(ax, s * ay, s * az))
    full = join([cap(spec["id"]), b.to_object(spec["id"] + "-meches", rig)], spec["id"])
    flat = cap(spec["id"] + "--flat")
    return full, flat


def rigid_from_meshy(spec, rig):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, spec["fichier"]))
    new = [o for o in set(bpy.data.objects) - before]
    meshes = [o for o in new if o.type == "MESH"]
    o = join(meshes, spec["id"])
    world = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = world
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for x in new:
        if x is not o:
            bpy.data.objects.remove(x, do_unlink=True)
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0005)
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    xs, ys, zs = zip(*[v.co for v in me.vertices])
    k = spec["largeur"] / (max(xs) - min(xs))
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    for v in me.vertices:
        v.co = Vector(((v.co.x - cx) * k, (v.co.y - cy) * k + HEAD_C.y, (v.co.z - min(zs)) * k + spec["bas"]))
    for layer in list(me.uv_layers):
        me.uv_layers.remove(layer)
    for attr in list(me.color_attributes):
        me.color_attributes.remove(attr)
    uv = me.uv_layers.new(name="UVMap")
    col = me.color_attributes.new("Color", "FLOAT_COLOR", "CORNER")
    rgb = srgb(color_of(spec["zones"][0]))
    for p in me.polygons:
        p.use_smooth = True
        for li in p.loop_indices:
            uv.data[li].uv = (0.5 / 8, section_v(0))
            col.data[li].color = (*rgb, 1.0)
    me.color_attributes.active_color = col
    me.materials.clear()
    me.materials.append(bpy.data.materials["figurine"])
    o.vertex_groups.clear()
    o.vertex_groups.new(name=spec["os"]).add(list(range(len(me.vertices))), 1.0, "REPLACE")
    o.parent = rig
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.modifiers.new("Armature", "ARMATURE").object = rig
    return o


# ---------------------------------------------------------------- squelette et clips
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, "source", "squelette-meshy.glb"))
rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
for o in list(bpy.context.scene.objects):
    if o is not rig:
        bpy.data.objects.remove(o, do_unlink=True)
clips = {}
for act in bpy.data.actions:
    base = act.name.split(".")[0].split("_squelette")[0]
    if base in ("walk", "run") and base not in clips:
        clips[base] = act
        act.name = base
        act.use_fake_user = True
if rig.animation_data:
    rig.animation_data.action = None
    for tr in list(rig.animation_data.nla_tracks):
        rig.animation_data.nla_tracks.remove(tr)
for pb in rig.pose.bones:
    pb.matrix_basis.identity()

MEDIUM = Body(G["corpulences"]["medium"])
heads = {"Hips": (0, 0, 0.90), "Spine02": (0, 0, 0.99), "Spine01": (0, 0, 1.09), "Spine": (0, 0, 1.19), "neck": (0, 0, 1.31), "Head": (0, 0, CHIN + 0.01)}
for s, L in ((1, "Left"), (-1, "Right")):
    ax, lx = MEDIUM.arm_x, MEDIUM.leg_x
    heads.update({
        L + "Shoulder": (s * 0.03, 0, SHOULDER_Z), L + "Arm": (s * ax, 0, SHOULDER_Z), L + "ForeArm": (s * (ax + MEDIUM.arm_len / 2), 0, SHOULDER_Z),
        L + "Hand": (s * (ax + MEDIUM.arm_len), 0, SHOULDER_Z), L + "UpLeg": (s * lx, 0, HIP_Z), L + "Leg": (s * lx, 0, KNEE),
        L + "Foot": (s * lx, 0, ANKLE), L + "ToeBase": (s * lx, -0.11, 0.03),
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
    else:
        delta = Vector(heads["Head"]) - old["Head"][0]
        eb.head, eb.tail = h0 + delta, t0 + delta
    eb.align_roll(z0)
bpy.ops.object.mode_set(mode="OBJECT")
k_hips = rig.data.bones["Hips"].head_local.z / old_hips
for act in clips.values():
    for fc in anim_utils.action_get_channelbag_for_slot(act, act.slots[0]).fcurves:
        if fc.data_path == 'pose.bones["Hips"].location':
            for kp in fc.keyframe_points:
                for pt in (kp.co, kp.handle_left, kp.handle_right):
                    pt.y *= k_hips
            fc.update()

# Clips du studio: poses écrites en rotations dans le repère du personnage (X droite-gauche, Y arrière, Z haut),
# appliquées os par os des parents vers les enfants. Degrés. Les bras partent de la pose en T.
ORDER = sorted(rig.pose.bones, key=lambda pb: len(pb.bone.parent_recursive))
for pb in rig.pose.bones:
    pb.rotation_mode = "QUATERNION"


def set_pose(pose, hips_dz=0.0):
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    bpy.context.view_layer.update()
    for pb in ORDER:
        steps = pose.get(pb.name)
        if pb.name == "Hips" and hips_dz:
            pb.matrix = Matrix.Translation((0, 0, hips_dz)) @ pb.matrix
            bpy.context.view_layer.update()
        if not steps:
            continue
        for axis, deg in steps:
            head = pb.matrix.translation.copy()
            pb.matrix = Matrix.Translation(head) @ Matrix.Rotation(math.radians(deg), 4, axis) @ Matrix.Translation(-head) @ pb.matrix
            bpy.context.view_layer.update()


def make_clip(name, keys):
    """keys: [(image, pose, descente des hanches)] à 30 images par seconde."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    ad = rig.animation_data_create()
    ad.action = act
    for frame, pose, dz in keys:
        set_pose(pose, dz)
        for pb in rig.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        rig.pose.bones["Hips"].keyframe_insert("location", frame=frame)
    ad.action = None
    for pb in rig.pose.bones:
        pb.matrix_basis.identity()
    clips[name] = act


def arms(down, out_l=0.0, fore=0.0, forward=0.0):
    return {"LeftArm": [("Y", down), ("X", -forward)], "RightArm": [("Y", -down), ("X", -forward)], "LeftForeArm": [("X", -fore)], "RightForeArm": [("X", -fore)]}


REST = arms(80, fore=6)
BREATH = {**arms(78, fore=8), "Spine01": [("X", -1.5)], "Spine": [("X", -1.0)], "LeftShoulder": [("Y", -2.5)], "RightShoulder": [("Y", 2.5)], "Head": [("X", 1.5)]}
make_clip("idle", [(0, REST, 0.0), (45, BREATH, 0.004), (90, REST, 0.0)])
SEAT = 0.47
SIT = {**arms(74, fore=58), "LeftUpLeg": [("X", -88)], "RightUpLeg": [("X", -88)], "LeftLeg": [("X", 88)], "RightLeg": [("X", 88)], "Spine02": [("X", 2)]}
sit_dz = (SEAT + G["corpulences"]["medium"]["leg"] / 2) - HIP_Z
make_clip("sit", [(0, SIT, sit_dz), (45, {**SIT, "Spine01": [("X", -1.5)]}, sit_dz + 0.003), (90, SIT, sit_dz)])
CARRY = {**arms(62, fore=78, forward=18), "Spine01": [("X", 3)]}
make_clip("carry", [(0, CARRY, 0.0), (30, {**CARRY, "Spine": [("X", -1)]}, 0.003), (60, CARRY, 0.0)])

# ---------------------------------------------------------------- pièces
BUILDS = {"slim": G["corpulences"]["slim"], "round": G["corpulences"]["round"]}
for key, factors in G["silhouettes"].items():
    BUILDS[key] = {**G["corpulences"]["medium"], **{k: G["corpulences"]["medium"][k] * f for k, f in factors.items()}}
BODIES = {k: Body(v) for k, v in BUILDS.items()}


def with_builds(fn):
    """Construit la pièce sur le corps moyen, puis sur chaque corpulence et silhouette: ce sont ses cibles de morphose."""
    basis = fn(MEDIUM)
    return basis, {k: fn(body).verts for k, body in BODIES.items()}


def covers_of(spec):
    base = spec["base"]
    out = []
    if base in ("torse", "robe"):
        if not spec.get("ouverture"):
            out.append("torso")
        sleeve = spec.get("manches", 0.0)
        out += [r for r, t in (("upper-arm-a", 0.3), ("upper-arm-b", 0.5), ("forearm", 0.95)) if sleeve >= t]
    if base == "jambes":
        out.append("pelvis")
        out += [r for r, t in (("thigh-a", 0.3), ("thigh-b", 0.5), ("shin", 0.95)) if spec["longueur"] >= t]
    if base in ("jupe", "robe"):
        out += ["pelvis", "thigh-a"]
    return out


objects = {}  # id -> (objet, spec, variante à plat)
b0, morphs = with_builds(lambda body: body.body())
objects["body-base"] = (b0.to_object("body-base", rig, morphs), {"id": "body-base", "slot": "body", "base": "corps", "zones": [], "tags": []}, None)
for spec in G["pieces"]:
    base = spec["base"]
    if base in ("torse", "jambes", "jupe", "robe", "galet"):
        b0, morphs = with_builds(lambda body, spec=spec, base=base: getattr(body, base)(spec))
        objects[spec["id"]] = (b0.to_object(spec["id"], rig, morphs), spec, None)
    elif base == "tete":
        objects[spec["id"]] = (head(spec, rig), spec, None)
    elif base == "coiffure":
        full, flat = hair(spec, rig)
        objects[spec["id"]] = (full, spec, flat)
    elif base == "meshy-rigide":
        objects[spec["id"]] = (rigid_from_meshy(spec, rig), spec, None)
    else:
        raise SystemExit(f"{spec['id']}: base inconnue « {base} »")

# ---------------------------------------------------------------- export
os.makedirs(OUT_GLB, exist_ok=True)
os.makedirs(OUT_DATA, exist_ok=True)
rig.name = "squelette"
ad = rig.animation_data_create()
for name, act in clips.items():
    track = ad.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name, int(act.frame_range[0]), act)
    strip.action_slot = act.slots[0]


def triangles(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


by_slot = {}
for pid, (o, spec, flat) in objects.items():
    by_slot.setdefault(spec["slot"], []).extend([o] + ([flat] if flat else []))
sizes = {}
for slot, objs in by_slot.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    path = os.path.join(OUT_GLB, f"{slot}.glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_yup=True, export_skins=True,
                              export_animations=slot == "body", export_animation_mode="NLA_TRACKS", export_morph=True, export_morph_normal=False,
                              export_vertex_color="ACTIVE", export_all_vertex_colors=False, export_materials="EXPORT", export_texcoords=True)
    sizes[slot] = os.path.getsize(path)

skins = [v.lower() for v in N["peaux"].values()]
catalogue = {"schema": 1, "skeleton": "duo-24", "shapes": [], "skins": skins, "pieces": []}
details = {"regions": REGIONS, "zones": {"teintables": [0, 1, 2], "fixe": ZONE_FIXED, "peau": ZONE_SKIN},
           "expressions": [k for k in EXPRESSIONS if k != "neutral"], "clips": {n: round((a.frame_range[1] - a.frame_range[0]) / 30, 3) for n, a in clips.items()},
           "flat_suffix": "--flat", "shapes": {}, "defaults": {}, "files": sizes}
for m in G["morphologies"]:
    scale = m.get("scale", 1.0)
    catalogue["shapes"].append({"id": m["id"], "age": m["age"], "build": m["build"], "height": round(H * scale * (1 - (1 - m.get("legs", 1.0)) * 0.47 - (1 - m.get("torso", 1.0)) * 0.26), 3)})
    details["shapes"][m["id"]] = {"morphs": [x for x in (m["build"], m["silhouette"]) if x != "medium"], "scale": scale, "head": m.get("head", 1.0),
                                  "legs": m.get("legs", 1.0), "arms": m.get("arms", 1.0), "torso": m.get("torso", 1.0)}
for pid, (o, spec, flat) in objects.items():
    zones = [{"id": z["id"], "colors": zone_colors(z)} for z in spec["zones"]]
    if not spec.get("nom") and pid != "body-base":
        raise SystemExit(f"{pid}: champ « nom » manquant (nom affiché dans l'éditeur)")
    catalogue["pieces"].append({"id": pid, "name": spec.get("nom", "Corps"), "slot": spec["slot"], "file": f"{spec['slot']}.glb", "node": pid, "covers": covers_of(spec),
                                "hair": spec.get("cheveux"), "zones": zones, "tags": spec.get("tags", []), "triangles": triangles(o)})
    details["defaults"][pid] = [zone_colors(z).index(color_of(z).lower()) for z in spec["zones"]]
with open(os.path.join(OUT_DATA, "catalogue.json"), "w", encoding="utf-8") as fh:
    json.dump(catalogue, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
with open(os.path.join(OUT_DATA, "morphologies.json"), "w", encoding="utf-8") as fh:
    json.dump(details, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("CATALOGUE", json.dumps({"pieces": {p["id"]: p["triangles"] for p in catalogue["pieces"]}, "fichiers": sizes, "clips": details["clips"]}, ensure_ascii=False))
