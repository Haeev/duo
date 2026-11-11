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

    # ----- coques ouvertes (vestes, gilets, plastrons, poches): angles en degrés, -90 = milieu du devant, 0 = côté gauche
    def surf(self, z, deg, off):
        """Point du buste à la hauteur z, à l'angle deg, décalé de off depuis la peau."""
        a, b, s = self.torso_at(z, off)
        t = math.radians(deg % 360.0)
        return Vector((a * math.cos(t), -s + b * math.sin(t), z))

    def coque(self, b, zs, arcs, off, tg, wfn, depth=0.007, zfix=None, bottom=True, top=True, offs=None):
        """Nappe posée sur le buste: rangées aux hauteurs zs, chaque rangée faite des arcs de arcs(z)
        [(angle début, angle fin, points, bord ouvert au début, bord ouvert à la fin)], même nombre de points
        d'une rangée à l'autre. Bords ouverts, ourlet et haut rentrés vers le corps de depth (bord épais).
        zfix(z, angle): hauteur réelle d'un point (ourlet en pointe); offs(z, angle): décalage propre."""
        zfix = zfix or (lambda z, t: z)
        offs = offs or (lambda z, t: off)

        def point(z, t, inner=False):
            return self.surf(zfix(z, t), t, offs(z, t) - (depth if inner else 0.0))
        rows = []
        for z in zs:
            row = []
            for t0, t1, n, o0, o1 in arcs(z):
                ts = [t0 + (t1 - t0) * j / (n - 1) for j in range(n)]
                row.append((ts, o0, o1))
            rows.append(row)
        outer = [[[self._vert(b, point(z, t), wfn) for t in ts] for ts, _, _ in row] for z, row in zip(zs, rows)]
        inner = {}

        def lip(i, k, j):
            key = (i, k, j)
            if key not in inner:
                inner[key] = self._vert(b, point(zs[i], rows[i][k][0][j], True), wfn)
            return inner[key]
        for i in range(len(zs) - 1):
            for k in range(len(rows[i])):
                r0, r1 = outer[i][k], outer[i + 1][k]
                for j in range(len(r0) - 1):
                    b.quad(r0[j], r0[j + 1], r1[j + 1], r1[j], tg)
                if rows[i][k][1] or rows[i + 1][k][1]:
                    b.quad(lip(i, k, 0), r0[0], r1[0], lip(i + 1, k, 0), tg)
                if rows[i][k][2] or rows[i + 1][k][2]:
                    last = len(r0) - 1
                    b.quad(r0[last], lip(i, k, last), lip(i + 1, k, last), r1[last], tg)
        for flag, i in ((bottom, 0), (top, len(zs) - 1)):
            if not flag:
                continue
            for k in range(len(rows[i])):
                r = outer[i][k]
                for j in range(len(r) - 1):
                    if i == 0:
                        b.quad(lip(i, k, j), lip(i, k, j + 1), r[j + 1], r[j], tg)
                    else:
                        b.quad(r[j], r[j + 1], lip(i, k, j + 1), lip(i, k, j), tg)

    @staticmethod
    def _vert(b, p, wfn):
        b.verts.append(p)
        b.weights.append(wfn(p))
        return len(b.verts) - 1

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
                puff = spec.get("bouffant", 0.0)
                if puff:  # manche ballon: renflée au milieu, resserrée au bord
                    n = len(st)
                    st = [(c, d, h, ru + puff * math.sin(math.pi * min(1, i / (n - 1.5))), rv + puff * math.sin(math.pi * min(1, i / (n - 1.5))))
                          for i, (c, d, h, ru, rv) in enumerate(st)]
                b.sweep(rim(st, off * 0.85 - 0.002, end=True, bulge=bulge), 10, tg, self.w_arm(s))
        return b

    def armhole(self, z, off, k):
        """Demi-angle (degrés) de l'emmanchure autour du côté à la hauteur z: la coque s'arrête à la largeur
        sh/2 - k x bras (l'épaule et le haut du bras restent dehors), 0 sous l'aisselle et au ras du cou."""
        a = self.torso_at(z, off)[0]
        x_lim = self.B["sh"] / 2 - self.B["arm"] * k
        fade = smooth(1.04, 1.13, z)
        lim = a - (a - x_lim) * fade
        return 0.0 if fade <= 0 or lim >= a * 0.999 else math.degrees(math.acos(lim / a))

    def veste(self, spec, b=None):
        """Gilet, cardigan, veste: coque ouverte au choix (encolure en V, devant ouvert, emmanchures), ourlet en
        pointe, bandes de côtes, boutons, poches, col et revers, manches."""
        b = b or Builder()
        B = self.B
        off = spec["couche"]
        main = tag(0, color_of(spec["zones"][0]))
        second = tag(1, color_of(spec["zones"][1])) if len(spec["zones"]) > 1 else tag(ZONE_FIXED, FIX["laiton"])
        hem, col = WAIST - spec.get("ourlet", 0.08), spec.get("col", 1.33)
        col_v, neck = spec.get("col_v"), spec.get("encolure", 0.0)
        front = spec.get("ouverture", 0.0) / 2
        drop = spec.get("pointes", 0.0)
        holes = spec.get("manches", 0.0) == 0 and spec.get("emmanchure", 0.55) > 0
        band, rib = spec.get("bande", 0.0), 0.004
        if len(spec["zones"]) > 2:  # dos d'une autre étoffe (gilet de costume)
            back = tag(2, color_of(spec["zones"][2]))
            main_only = main
            main = lambda c: back if c.y > 0.0 else main_only  # noqa: E731

        def half_open(z):
            w = front
            if col_v is not None and z > col_v:
                w += neck * ((z - col_v) / (col - col_v)) ** 0.9
            return w

        def delta(z, extra=0.0):
            w = half_open(z) + extra
            if w <= 0:
                return 0.0
            a = self.torso_at(z, off)[0]
            return math.degrees(math.asin(min(0.97, w / a)))

        def psi(z):
            if not holes:
                return 0.0
            # trou ouvert ou non selon le corps moyen, pour que toutes les corpulences gardent la même topologie
            if MEDIUM.armhole(z, off, spec.get("emmanchure", 0.55)) == 0:
                return 0.0
            return max(1.0, self.armhole(z, off, spec.get("emmanchure", 0.55)))

        def arcs(z):
            d, p = delta(z), psi(z)
            o = d > 0
            return [(-90 + d, -p, 7, o, p > 0), (p, 180 - p, 13, p > 0, p > 0), (180 + p, 270 - d, 7, p > 0, o)]

        def zfix(z, t):
            if drop <= 0 or z > hem + 0.13:
                return z
            c = max(0.0, -math.sin(math.radians(t)))
            dt = min(abs((t % 360) - 270), 360 - abs((t % 360) - 270))
            notch = 1 - 0.55 * math.exp(-(dt / 7.0) ** 2) if col_v is not None or front > 0 else 1.0
            return z - drop * c ** 3 * notch * (1 - (z - hem) / 0.13)

        def offs(z, t):
            return off + (rib if band and z < hem + band + 1e-6 else 0.0)
        count = max(4, round((col - hem) / 0.036))
        zs = [hem + (col - hem) * i / count for i in range(count + 1)]
        if band:
            zs = sorted(set(zs + [hem + band, hem + band + 0.0001]))
        self.coque(b, zs, arcs, off, main, self.w_torso, zfix=zfix, offs=offs)
        # col et revers: bande autour de la nuque, revers posés sur les bords du V
        if spec.get("revers"):
            top_d = delta(col - 0.001)
            zc = [col - 0.05, col - 0.025, col + 0.004]
            self.coque(b, zc, lambda z: [(-90 + top_d + 6, 270 - top_d - 6, 17, True, True)], off + 0.012, main, self.w_torso)
            low = col_v if col_v is not None else col - 0.16
            zl = [low + (col - 0.03 - low) * i / 5 for i in range(6)]
            width = lambda z: 4 + 20 * math.sin(math.pi * min(1.0, (z - low) / (col - 0.03 - low)) ** 0.8)  # noqa: E731
            self.coque(b, zl, lambda z: [(-90 + delta(z), -90 + delta(z) + width(z), 3, True, True),
                                          (270 - delta(z) - width(z), 270 - delta(z), 3, True, True)], off + 0.008, main, self.w_torso)
        # poches plaquées
        for z0, z1, tc, w in spec.get("poches", []):
            for s in (1, -1):
                t = -90 + s * tc
                self.coque(b, [z0, (z0 + z1) / 2, z1], lambda z, t=t, w=w: [(t - w, t + w, 3, True, True)], off + 0.006, main, self.w_torso, depth=0.005)
        # martingale: demi-ceinture dans le dos, boucle au milieu
        if spec.get("martingale"):
            zb = WAIST - 0.035
            self.coque(b, [zb - 0.013, zb + 0.013], lambda z: [(58, 122, 5, True, True)], off + 0.006, main, self.w_torso, depth=0.005)
            b.ellipsoid(self.surf(zb, 90, off + 0.011), Vector((0.016, 0.005, 0.014)), second, self.w_torso, n=6, m=3)
        # boutons sur le devant (ou sur le bord gauche d'un devant ouvert)
        n = spec.get("boutons", 0)
        if n:
            z_top = (col_v if col_v is not None else col - 0.06) - 0.025
            z_bot = hem + 0.035 + (band or 0)
            for i in range(n):
                z = z_top + (z_bot - z_top) * i / max(1, n - 1)
                t = -90 + (delta(z, 0.012) if front > 0 else 0)
                p = self.surf(z, t, off + 0.004 + (rib if band and z < hem + band else 0))
                b.ellipsoid(p, Vector((0.010, 0.005, 0.010)), second, self.w_torso, n=6, m=3)
        sleeve = spec.get("manches", 0.0)
        if sleeve > 0:
            for s in (-1, 1):
                p0, p1 = self.arm_ends(s)
                st = limb_stations(p0, p1, B["arm"] / 2, B["arm"] / 2 * 0.9, Z, True, False, off=off * 0.85, t1=sleeve)
                if band:  # poignet en côtes: le dernier tronçon renflé
                    c, d, hint, ru, rv = st[-1]
                    st = [x for x in st[:-1] if (c - x[0]).length > band + 0.004]
                    st += [(c - d * (band + 0.002), d, hint, ru, rv), (c - d * band, d, hint, ru + rib, rv + rib), (c, d, hint, ru + rib, rv + rib)]
                b.sweep(rim(st, off * 0.85 - 0.002, end=True), 10, main, self.w_arm(s))
        b.weld()
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
            cuff = spec.get("revers", 0.0)
            if cuff:  # revers retroussé au bas de la jambe
                t1 = min(spec["longueur"], 0.99)
                t0 = t1 - cuff / (q0 - q1).length
                st = limb_stations(q0, q1, B["leg"] / 2, B["leg"] / 2 * 0.88, X, False, False, off=off + 0.007, t0=t0, t1=t1, cuts=2)
                b.sweep(rim(rim(st, 0.008, start=True), 0.009, end=True), 10, tg, self.w_leg(s))
        return b

    def salopette(self, spec):
        """Jambes de pantalon, culotte montée par-dessus le haut, bavette, bretelles et boutons."""
        b = self.jambes(spec)
        B = self.B
        tg = tag(0, color_of(spec["zones"][0]))
        metal = tag(1, color_of(spec["zones"][1]))
        up = spec.get("couche_haut", 0.046)
        # culotte: près du corps aux hanches, montée à la couche d'un dessus vers la taille (pas de ballon aux hanches)
        st = []
        for i in range(9):
            z = 0.80 + (WAIST + 0.035 - 0.80) * i / 8
            o = spec["couche"] + 0.006 + (up - spec["couche"] - 0.006) * smooth(0.83, 0.95, z)
            a, d, s = self.torso_at(z, o)
            st.append((Vector((0, -s, z)), Z, X, a, d))
        b.sweep(rim(rim(st, 0.01, start=True), 0.008, end=True), 16, tg, self.w_torso)
        bib_top, half = spec.get("bavette", 1.20), 0.095

        def bib(z):
            d = math.degrees(math.asin(min(0.95, half / self.torso_at(z, up)[0])))
            return [(-90 - d, -90 + d, 5, True, True)]
        zs = [WAIST + 0.02 + (bib_top - WAIST - 0.02) * i / 5 for i in range(6)]
        self.coque(b, zs, bib, up, tg, self.w_torso, bottom=False)
        # poche de bavette
        zp = [bib_top - 0.10, bib_top - 0.07, bib_top - 0.035]
        self.coque(b, zp, lambda z: [(-90 - 16, -90 + 16, 3, True, True)], up + 0.006, tg, self.w_torso, depth=0.005)
        # bretelles: du coin de la bavette, par-dessus l'épaule, jusqu'au dos de la culotte
        for s in (1, -1):
            def theta(z, x, front):
                a = self.torso_at(z, up)[0]
                t = math.degrees(math.acos(min(0.99, x / a)))
                t = -t if front else t
                return t if s > 0 else 180 - t
            path = [(bib_top - 0.01, 0.075, True), (1.26, 0.088, True), (1.30, 0.095, True), (1.322, 0.10, True), (1.333, 0.102, None),
                    (1.322, 0.10, False), (1.30, 0.095, False), (1.25, 0.085, False), (1.17, 0.07, False), (1.08, 0.06, False), (WAIST + 0.02, 0.06, False)]
            pts = []
            for z, x, front in path:
                if front is None:
                    t = 0.0 if s > 0 else 180.0
                else:
                    t = theta(z, x, front)
                pts.append(self.surf(z, t, up + 0.004))
            self.strap(b, pts, 0.016, 0.004, tg)
            corner = self.surf(bib_top - 0.025, theta(bib_top - 0.025, 0.072, True), up + 0.007)
            b.ellipsoid(corner, Vector((0.011, 0.005, 0.011)), metal, self.w_torso, n=6, m=3)
        b.weld()
        return b

    def strap(self, b, pts, half_w, half_t, tg, wfn=None):
        """Bande plate qui suit des points posés sur le buste (bretelle, lien)."""
        wfn = wfn or self.w_torso
        st = []
        for i, p in enumerate(pts):
            a, c = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
            d = (c - a).normalized()
            out = Vector((p.x, p.y + self.torso_at(p.z, 0)[2], 0))
            out = out.normalized() if out.length > 1e-6 else Z
            st.append((p, d, out, half_t, half_w))
        b.sweep(st, 8, tg, wfn, cap0=True, cap1=True)

    def tablier(self, spec):
        """Tablier à bavette: bavette, devant noué à la taille, poche, lien de cou et nœud dans le dos."""
        b = Builder()
        off = spec["couche"]
        cloth = tag(0, color_of(spec["zones"][0]))
        trim = tag(1, color_of(spec["zones"][1]))
        bib_top, half = spec.get("bavette", 1.19), 0.10

        def bib(z):
            d = math.degrees(math.asin(min(0.95, half / self.torso_at(z, off)[0])))
            return [(-90 - d, -90 + d, 5, True, True)]
        zs = [WAIST - 0.03 + (bib_top - WAIST + 0.03) * i / 5 for i in range(6)]
        self.coque(b, zs, bib, off, cloth, self.w_torso, bottom=False)
        # devant: pan de jupe sur l'avant seulement, suit les cuisses comme une jupe
        hem, top_z = spec["bas"], WAIST
        ws = self.w_skirt(top_z, hem, spec.get("suivi", 0.9), spread=5.0)
        rows = []
        for i in range(8):
            t = i / 7
            z = hem + (top_z - hem) * t
            a, d, s = self.torso_at(max(z, 0.86), off)
            flare = spec.get("evasement", 0.07) * (1 - t)
            span = math.degrees(math.asin(min(0.97, spec.get("largeur", 0.22) / (a + flare))))
            rows.append([Vector(((a + flare) * math.cos(math.radians(-90 + span * (2 * j / 8 - 1))), -s * t + (d + flare) * math.sin(math.radians(-90 + span * (2 * j / 8 - 1))), z)) for j in range(9)])
        b.grid(rows, cloth, ws)
        # ourlet et bords épais: une rangée rentrée sous le bas
        lip = [Vector((p.x * 0.97, p.y * 0.95, p.z + 0.004)) for p in rows[0]]
        b.grid([lip, rows[0]], cloth, ws)
        # poche plaquée au milieu du devant
        pz0, pz1 = hem + 0.10, hem + 0.20
        prow = []
        for z in (pz0, (pz0 + pz1) / 2, pz1):
            t = (z - hem) / (top_z - hem)
            a, d, s = self.torso_at(max(z, 0.86), off + 0.006)
            flare = spec.get("evasement", 0.07) * (1 - t)
            prow.append([Vector(((a + flare) * math.cos(math.radians(u)), -s * t + (d + flare) * math.sin(math.radians(u)), z)) for u in (-112, -101, -90, -79, -68)])
        b.grid(prow, trim, ws)
        # lien à la taille, autour du dos, et nœud
        tie = off - 0.008
        self.coque(b, [WAIST - 0.022, WAIST + 0.006], lambda z: [(-90 + 30, 270 - 30, 13, True, True)], tie, trim, self.w_torso, depth=0.004)
        knot = self.surf(WAIST - 0.008, 90, tie + 0.01)
        for s in (1, -1):
            b.ellipsoid(knot + Vector((s * 0.035, 0.004, 0.006)), Vector((0.032, 0.008, 0.018)), trim, self.w_torso, n=8, m=4, rot=(0, 0, s * -8))
            self.strap(b, [knot + Vector((s * 0.008, 0.006, -0.01)), knot + Vector((s * 0.02, 0.008, -0.07)), knot + Vector((s * 0.03, 0.008, -0.13))], 0.012, 0.003, trim)
        b.ellipsoid(knot + Vector((0, 0.006, 0)), Vector((0.012, 0.009, 0.013)), trim, self.w_torso, n=6, m=3)
        # lien de cou: des coins de la bavette autour de la nuque
        pts = []
        for z, x, side in ((bib_top - 0.01, 0.085, -1), (1.26, 0.08, -1), (1.31, 0.072, -1), (1.338, 0.064, -1)):
            a = self.torso_at(z, off - 0.012)[0]
            pts.append(self.surf(z, -math.degrees(math.acos(min(0.99, x / a))), off - 0.012))
        ring = [self.surf(1.345, t, 0.040) for t in (-30, 0, 45, 90, 135, 180, 210)]
        back = [Vector((-p.x, p.y, p.z)) for p in reversed(pts)]
        self.strap(b, pts + ring + back, 0.011, 0.003, trim)
        b.weld()
        return b

    def echarpe(self, spec):
        """Écharpe: un tour de cou épais et deux pans sur la poitrine, rayures au bout."""
        b = Builder()
        main = tag(0, color_of(spec["zones"][0]))
        stripe = tag(1, color_of(spec["zones"][1])) if len(spec["zones"]) > 1 else main
        off = spec.get("couche", 0.058)
        z0 = spec.get("hauteur", 1.355)
        loop = []
        for i in range(16):
            t = -90 + 360 * i / 16
            front = max(0.0, -math.sin(math.radians(t)))
            p = self.surf(1.338, t, off)
            loop.append(Vector((p.x, p.y, z0 - 0.022 * front ** 2 + 0.006 * (1 - front))))
        st = []
        for i, p in enumerate(loop):
            d = (loop[(i + 1) % 16] - loop[i - 1]).normalized()
            st.append((p, d, Z, 0.030, 0.024))
        st.append(st[0])
        b.sweep(st, 8, main, self.w_torso)
        # pans: l'un long, l'autre plus court par-dessus, rayés au bout
        for x, low, lift in ((0.050, spec.get("pan", 1.02), 0.010), (-0.030, spec.get("pan", 1.02) + 0.09, 0.022)):
            pts = []
            n = 7
            for i in range(n):
                z = z0 - 0.035 - (z0 - 0.035 - low) * i / (n - 1)
                a = self.torso_at(z, 0.05)[0]
                t = -90 + math.degrees(math.asin(max(-0.9, min(0.9, x / a))))
                pts.append(self.surf(z, t, 0.040 + lift))

            def tg(c, low=low):
                u = c.z - low
                return stripe if 0.025 < u < 0.045 or 0.065 < u < 0.08 else main
            self.strap(b, pts, 0.036, 0.006, tg)
        b.weld()
        return b

    def foulard(self, spec):
        """Foulard noué: tour de cou fin, pointe sur la poitrine, nœud devant."""
        b = Builder()
        main = tag(0, color_of(spec["zones"][0]))
        off = spec.get("couche", 0.030)
        loop = [self.surf(1.338, -90 + 360 * i / 14, off) for i in range(14)]
        for p in loop:
            p.z = 1.345
        st = [(p, (loop[(i + 1) % 14] - loop[i - 1]).normalized(), Z, 0.015, 0.012) for i, p in enumerate(loop)]
        st.append(st[0])
        b.sweep(st, 8, main, self.w_torso)
        tip = spec.get("pointe", 1.20)

        def tri(z):
            u = (z - tip) / (1.33 - tip)
            d = 4 + 30 * u
            return [(-90 - d, -90 + d, 5, True, True)]
        zs = [tip + (1.33 - tip) * i / 4 for i in range(5)]
        self.coque(b, zs, tri, off, main, self.w_torso, depth=0.004, top=False)
        knot = self.surf(1.335, -90, off + 0.012)
        b.ellipsoid(knot, Vector((0.026, 0.016, 0.020)), main, self.w_torso, n=8, m=5)
        for s in (1, -1):
            b.ellipsoid(knot + Vector((s * 0.03, 0.002, -0.03)), Vector((0.012, 0.007, 0.03)), main, self.w_torso, n=6, m=4, rot=(0, s * 30, 0))
        b.weld()
        return b

    def sabot(self, spec):
        """Sabots de bois: coque taillée d'un bloc, pointe relevée, bride de cuir sur le cou-de-pied."""
        b = Builder()
        wood, strap = tag(0, color_of(spec["zones"][0])), tag(1, color_of(spec["zones"][1]))
        for s in (-1, 1):
            L = "Left" if s > 0 else "Right"

            def wf(p, L=L):
                k = smooth(0.13, 0.19, p.z)
                return {L + "Foot": 1 - k, L + "Leg": k}
            c = Vector((s * self.leg_x, -0.050, 0.058))
            start = len(b.verts)
            b.ellipsoid(c, Vector((0.070, 0.135, 0.066)), wood, wf, n=12, m=7)
            for i in range(start, len(b.verts)):
                v = b.verts[i]
                v.z = max(v.z, 0.0)
                if v.y < -0.12:  # pointe relevée
                    v.z += (-0.12 - v.y) * 0.9
                if v.z > 0.085 and v.y > -0.09:  # entrée du pied: le dessus s'ouvre en dos d'âne
                    v.z = 0.085 + (v.z - 0.085) * 0.35
            b.sweep([(Vector((s * self.leg_x, -0.050, z)), Z, X, 0.072 - 0.003 * i, 0.138 - 0.004 * i) for i, z in enumerate((0.0, 0.010, 0.020))], 12, wood, wf, cap0=True)
            # bride de cuir posée sur le dessus, de part et d'autre du cou-de-pied
            arc = []
            for i in range(7):
                a = math.pi * i / 6
                arc.append(Vector((s * self.leg_x + 0.074 * math.cos(a), -0.052, 0.07 + 0.045 * math.sin(a))))
            st = [(p, (arc[min(i + 1, 6)] - arc[max(i - 1, 0)]).normalized(), Y, 0.015, 0.006) for i, p in enumerate(arc)]
            b.sweep(st, 6, strap, wf, cap0=True, cap1=True)
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
    def w_skirt(top_z, hem, suivi=None, spread=0.6):
        """Poids d'une jupe: le bassin en haut, les cuisses vers l'ourlet (moitié par défaut). suivi = part donnée aux
        jambes à l'ourlet; avec suivi, sous le genou l'ourlet suit aussi le tibia (jupe longue, robe ample)."""
        def w(p):
            t = min(max((top_z - p.z) / (top_z - hem), 0.0), 1.0)
            if suivi is None:
                legs = 0.5 * smooth(0.3, 1.0, t)
                side = smooth(-0.16, 0.16, p.x)
            else:
                # suivi dès le haut des cuisses (assis, la cuisse ne ressort pas de la jupe), partagé entre les deux
                # jambes sur toute la largeur (en marche les deux élans se compensent, assis ils s'ajoutent), et
                # le dos suit moins (assis, il ne se relève pas en cuvette derrière)
                legs = suivi * smooth(0.06, 0.55, t) * (1 - 0.45 * smooth(-0.02, 0.12, p.y))
                side = smooth(-spread, spread, p.x)
            low = 0.0 if suivi is None else 0.35 * smooth(KNEE + 0.06, KNEE - 0.12, p.z)
            out = {"Hips": 1 - legs}
            for name, k in (("Left", side), ("Right", 1 - side)):
                out[name + "UpLeg"] = legs * k * (1 - low)
                out[name + "Leg"] = legs * k * low
            return out
        return w

    def jupe(self, spec):
        b = Builder()
        top_z = WAIST + 0.03
        st = rim(rim(self.skirt_stations(spec, top_z), 0.02, start=True), spec["couche"] - 0.002, end=True)
        b.sweep(st, 16, tag(0, color_of(spec["zones"][0])), self.w_skirt(top_z, spec["bas"], spec.get("suivi")))
        return b

    def robe(self, spec):
        b = Builder()
        st = rim(self.skirt_stations(spec, WAIST), 0.02, start=True)
        ws = self.w_skirt(WAIST, spec["bas"], spec.get("suivi"))
        b.sweep(st, 16, tag(0, color_of(spec["zones"][0])), ws)
        b = self.torse(spec, b, hem_z=WAIST)
        if len(spec["zones"]) > 1:
            trim = tag(1, color_of(spec["zones"][1]))
            off = spec["couche"]
            if spec.get("col_claudine"):  # col plat arrondi posé sur les épaules, fendu devant
                self.coque(b, [1.288, 1.312, 1.336], lambda z: [(-90 + 7, 270 - 7, 21, True, True)], off + 0.010, trim, self.w_torso, depth=0.006)
            if spec.get("ceinture"):
                self.coque(b, [WAIST - 0.018, WAIST + 0.018], lambda z: [(-90, 270, 21, False, False)], off + 0.007, trim, self.w_torso, depth=0.005)
                knot = self.surf(WAIST, 90, off + 0.012)
                for s in (1, -1):
                    b.ellipsoid(knot + Vector((s * 0.033, 0, 0.004)), Vector((0.03, 0.008, 0.017)), trim, self.w_torso, n=8, m=4, rot=(0, 0, s * -10))
                b.ellipsoid(knot, Vector((0.011, 0.009, 0.013)), trim, self.w_torso, n=6, m=3)
            b.weld()
        return b

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


def casquette(spec, rig):
    """Casquette plate de campagne: calotte sur le crâne, dessus aplati et avancé, petite visière."""
    tg = tag(0, color_of(spec["zones"][0]))
    front, nape = spec.get("front", 1.625), spec.get("nuque", 1.555)
    b = Builder()
    b.ellipsoid(HEAD_C, HEAD_R, tg, W_HEAD, n=20, m=13, off=0.025)
    top = HEAD_C.z + HEAD_R.z + 0.025
    for v in b.verts:  # dessus aplati (relevé vers le sommet, jamais plus bas que lui) et avancé vers la visière
        k = smooth(1.60, 1.70, v.z)
        v.z += k * ((top + 0.008 - (top - v.z) * 0.55) - v.z)
        v.y = v.y * (1 + 0.15 * k) - 0.02 * k
        v.x *= 1 + 0.07 * k
    b.cut = (Vector((0, 0, (front + nape) / 2)), Vector((0, (front - nape) / (2 * HEAD_R.y), 1.0)))
    crown = b.to_object(spec["id"], rig)
    bpy.context.view_layer.objects.active = crown
    mod = crown.modifiers.new("epaisseur", "SOLIDIFY")
    mod.thickness = 0.008
    mod.offset = -1.0
    mod.use_rim_only = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    v = Builder()
    v.ellipsoid(Vector((0, -0.172, front + 0.004)), Vector((0.105, 0.085, 0.008)), tg, W_HEAD, n=12, m=4, rot=(-16, 0, 0))
    v.cut = (Vector((0, -0.150, 0)), Vector((0, -1.0, 0)))
    return join([crown, v.to_object(spec["id"] + "-visiere", rig)], spec["id"])


def chapeau(spec, rig):
    """Chapeau de paille: profil tourné (dessous du bord, bord, dessus, calotte), ruban autour de la calotte."""
    straw, ribbon = tag(0, color_of(spec["zones"][0])), tag(1, color_of(spec["zones"][1]))
    base, brim = spec.get("bas", 1.600), spec.get("bord", 0.29)
    prof = [(base, 0.172, 0.164), (base - 0.006, brim * 0.75, brim * 0.72), (base - 0.016, brim, brim * 0.96), (base - 0.008, brim + 0.006, brim * 0.96 + 0.006),
            (base + 0.004, brim * 0.75, brim * 0.72), (base + 0.012, 0.176, 0.168), (base + 0.05, 0.172, 0.164), (base + 0.15, 0.165, 0.157), (base + 0.185, 0.15, 0.142), (base + 0.195, 0.10, 0.095)]
    b = Builder()
    b.sweep([(Vector((0, 0.004, z)), Z, X, rx, ry) for z, rx, ry in prof], 20, lambda c: ribbon if base + 0.012 < c.z < base + 0.05 and math.hypot(c.x, c.y) < 0.18 else straw, W_HEAD, cap1=True)
    m3 = Matrix.Rotation(math.radians(-5), 3, "X")
    pivot = Vector((0, 0, base))
    b.verts = [pivot + m3 @ (p - pivot) for p in b.verts]
    return b.to_object(spec["id"], rig)


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
    if base in ("torse", "robe", "veste"):
        open_front = spec.get("ouverture") or spec.get("col_v") is not None
        holes = base == "veste" and spec.get("manches", 0.0) == 0
        if not open_front and not holes:
            out.append("torso")
        sleeve = spec.get("manches", 0.0)
        out += [r for r, t in (("upper-arm-a", 0.3), ("upper-arm-b", 0.5), ("forearm", 0.95)) if sleeve >= t]
    if base == "jambes":
        out.append("pelvis")
        out += [r for r, t in (("thigh-a", 0.3), ("thigh-b", 0.5), ("shin", 0.95)) if spec["longueur"] >= t]
    if base in ("jupe", "robe"):
        out += ["pelvis", "thigh-a"]
    return out


# Bases construites sur le corps, une fois par corpulence et silhouette (cibles de morphose).
BODY_BASES = ("torse", "jambes", "jupe", "robe", "galet", "veste", "echarpe", "foulard", "tablier", "salopette", "sabot")
objects = {}  # id -> (objet, spec, variante à plat)
b0, morphs = with_builds(lambda body: body.body())
objects["body-base"] = (b0.to_object("body-base", rig, morphs), {"id": "body-base", "slot": "body", "base": "corps", "zones": [], "tags": []}, None)
for spec in G["pieces"]:
    base = spec["base"]
    if base in BODY_BASES:
        b0, morphs = with_builds(lambda body, spec=spec, base=base: getattr(body, base)(spec))
        objects[spec["id"]] = (b0.to_object(spec["id"], rig, morphs), spec, None)
    elif base == "tete":
        objects[spec["id"]] = (head(spec, rig), spec, None)
    elif base == "coiffure":
        full, flat = hair(spec, rig)
        objects[spec["id"]] = (full, spec, flat)
    elif base in ("casquette", "chapeau"):
        objects[spec["id"]] = ({"casquette": casquette, "chapeau": chapeau}[base](spec, rig), spec, None)
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
    entry = {"id": pid, "name": spec.get("nom", "Corps")}
    if spec.get("description"):
        entry["description"] = spec["description"]
    catalogue["pieces"].append({**entry, "slot": spec["slot"], "file": f"{spec['slot']}.glb", "node": pid, "covers": covers_of(spec),
                                "hair": spec.get("cheveux"), "zones": zones, "tags": spec.get("tags", []), "triangles": triangles(o)})
    details["defaults"][pid] = [zone_colors(z).index(color_of(z).lower()) for z in spec["zones"]]
with open(os.path.join(OUT_DATA, "catalogue.json"), "w", encoding="utf-8") as fh:
    json.dump(catalogue, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
with open(os.path.join(OUT_DATA, "morphologies.json"), "w", encoding="utf-8") as fh:
    json.dump(details, fh, ensure_ascii=False, indent=1)
    fh.write("\n")
print("CATALOGUE", json.dumps({"pieces": {p["id"]: p["triangles"] for p in catalogue["pieces"]}, "fichiers": sizes, "clips": details["clips"]}, ensure_ascii=False))
