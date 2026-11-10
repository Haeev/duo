"""Essai de style 2, voie A: corps commun aux proportions réalistes (7 têtes), vêtements portés par la texture.

Un maillage par personnage (corps, tête, coiffure, chaussures), un matériau, un atlas de 512 px peint par script
(Pillow): un haut, un bas, des chaussures, un visage et des cheveux sont des zones de l'atlas. Squelette et marche:
ceux du rig de Meshy du studio (`assets-src/personnages/source/squelette-meshy.glb`).

Usage: duo-python voie_a.py <dossier de sortie>
Sorties: <id>.glb (atlas neutre embarqué) et <id>-<expression>.png (atlas d'expression) pour chaque personnage.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "../../../../../.."))
SKELETON = os.path.join(REPO, "games/la-petite-ligne-2/assets-src/personnages/source/squelette-meshy.glb")
OUT = sys.argv[-1]
S = 512  # atlas: 512 px par personnage (budget du PC de référence)

# Zones de l'atlas (u0, v0, u1, v1), v vers le haut comme dans Blender.
R = {"torso": (0, 0.5, 0.5, 1), "head": (0.5, 0.5, 1, 1), "legs": (0, 0, 0.25, 0.5), "arms": (0.25, 0, 0.5, 0.5),
     "hair": (0.5, 0.25, 1, 0.5), "shoes": (0.5, 0, 0.75, 0.25), "skin": (0.75, 0, 1, 0.25)}

# Personnages: corpulence (demi-largeurs en m) et tenue (couleurs, motifs). Ajouter une tenue = une entrée.
CHARACTERS = {
    "lea": dict(build=dict(sh=0.20, wa=0.135, hi=0.175, chest=0.105, arm=0.040, thigh=0.080), skin=(224, 178, 140),
                hair=(92, 58, 38), hair_style="bob", eyes=(70, 90, 60), lips=(170, 80, 75),
                top=dict(kind="plaid", color=(176, 58, 52), stripes=(40, 52, 70), sleeve=0.96), bottom=dict(kind="jeans", color=(52, 70, 105)),
                shoes=dict(color=(110, 70, 40))),
    "marcel": dict(build=dict(sh=0.215, wa=0.165, hi=0.165, chest=0.115, arm=0.043, thigh=0.082), skin=(232, 190, 160),
                   hair=(160, 156, 150), hair_style="short", eyes=(70, 100, 140), lips=(160, 95, 90), moustache=True,
                   top=dict(kind="shirt_vest", color=(236, 232, 222), vest=(105, 110, 60), sleeve=0.55),
                   bottom=dict(kind="cord", color=(120, 80, 50)), shoes=dict(color=(35, 30, 30))),
}


class Mesh:
    def __init__(self):
        self.verts, self.weights, self.faces, self.uvs = [], [], [], []

    def tube(self, rings, n, region, wfn, keep=None):
        """rings: [(centre, rayon x, rayon y)] le long du membre; u fait le tour (devant à u = 0,5), v le long."""
        u0, v0, u1, v1 = R[region]
        grid = []
        for i, (c, rx, ry) in enumerate(rings):
            row = []
            for j in range(n + 1):
                a = 2 * math.pi * j / n
                p = c + Vector((rx * math.sin(a), ry * math.cos(a), 0))
                row.append(len(self.verts))
                self.verts.append(p)
                self.weights.append(wfn(p))
            grid.append(row)
        for i in range(len(rings) - 1):
            for j in range(n):
                if keep and not keep(j / n, i / (len(rings) - 1)):
                    continue
                f = (grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j])
                uv = [(j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1)]
                self.faces.append(f)
                self.uvs.append([(u0 + (u1 - u0) * a / n, v0 + (v1 - v0) * b / (len(rings) - 1)) for a, b in uv])

    def limb(self, a, b, r0, r1, n, region, wfn, steps=8, rot_x=False):
        """Membre entre deux points: anneaux perpendiculaires à l'axe, fermés par des bouts arrondis."""
        d = (b - a).normalized()
        side = Vector((0, 1, 0)) if abs(d.y) < 0.9 else Vector((1, 0, 0))
        ux = d.cross(side).normalized()
        uy = d.cross(ux).normalized()
        u0, v0, u1, v1 = R[region]
        rings = []
        for k in range(-2, steps + 3):
            t = min(max(k / steps, 0), 1)
            r = r0 + (r1 - r0) * t
            ext = 0.0
            if k < 0:
                ext, r = -r * (0.55 if k == -1 else 0.9), r * (0.8 if k == -1 else 0.35)
            if k > steps:
                ext, r = r * (0.55 if k == steps + 1 else 0.9), r * (0.8 if k == steps + 1 else 0.35)
            rings.append((a + (b - a) * t + d * ext, r))
        grid = []
        for c, r in rings:
            row = []
            for j in range(n + 1):
                ang = 2 * math.pi * j / n
                p = c + ux * (r * math.sin(ang)) + uy * (r * math.cos(ang))
                row.append(len(self.verts))
                self.verts.append(p)
                self.weights.append(wfn(p))
            grid.append(row)
        m = len(rings) - 1
        for i in range(m):
            for j in range(n):
                self.faces.append((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
                self.uvs.append([(u0 + (u1 - u0) * a / n, v1 - (v1 - v0) * b / m) for a, b in ((j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1))])


def smooth(a, b, t):
    u = min(max((t - a) / (b - a), 0.0), 1.0)
    return u * u * (3 - 2 * u)


def chain(t, nodes):
    if t <= nodes[0][1]:
        return {nodes[0][0]: 1.0}
    for (a, pa), (b, pb) in zip(nodes, nodes[1:]):
        if t <= pb:
            k = smooth(pa, pb, t)
            return {a: 1 - k, b: k}
    return {nodes[-1][0]: 1.0}


def load_skeleton():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 30
    bpy.ops.import_scene.gltf(filepath=SKELETON)
    rig = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
    for o in list(bpy.context.scene.objects):
        if o is not rig and o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    J = {b.name: rig.matrix_world @ b.head_local for b in rig.data.bones}
    T = {b.name: rig.matrix_world @ b.tail_local for b in rig.data.bones}
    return rig, J, T


def build(cid, spec, rig, J, T):
    B = spec["build"]
    m = Mesh()
    yc = 0.022
    # Torse: de l'entrejambe à la base du cou. Demi-largeurs et demi-profondeurs par hauteur.
    rows = [(0.70, 0.10, 0.07), (0.76, B["hi"] * 0.92, 0.095), (0.84, B["hi"], 0.105), (0.92, B["hi"] * 0.96, 0.10), (0.99, B["wa"], 0.09),
            (1.07, (B["wa"] + B["sh"]) / 2 * 0.93, B["chest"] * 0.95), (1.16, B["sh"] * 0.9, B["chest"]), (1.24, B["sh"] * 0.97, B["chest"] * 0.92),
            (1.29, B["sh"] * 0.85, B["chest"] * 0.78), (1.325, 0.10, 0.07), (1.35, 0.055, 0.05)]
    w_torso = lambda p: chain(p.z, [("Hips", 0.93), ("Spine02", 1.05), ("Spine01", 1.17), ("Spine", 1.28), ("neck", 1.34)])  # noqa: E731
    m.tube([(Vector((0, yc, z)), a, b) for z, a, b in rows], 20, "torso", w_torso)
    # Cou et tête: tête de 0,235 m (7,2 têtes pour 1,70 m), visage devant (u = 0,5).
    m.tube([(Vector((0, 0.012, z)), 0.048, 0.050) for z in (1.30, 1.40, 1.50)], 12, "skin", lambda p: {"neck": 1.0} if p.z < 1.43 else {"Head": 1.0})
    # Proportions adoucies (demande du client): tête de 0,25 m, 6,8 têtes pour 1,70 m, traits ronds.
    chin, top, hw, hd = 1.450, 1.700, 0.080, 0.100
    hc = Vector((0, -0.004, chin))
    head_rows = []
    for k in range(13):
        t = k / 12
        z = chin + (top - chin) * (1 - math.cos(math.pi * t)) / 2
        s = math.sin(math.pi * min(t * 1.05 + 0.04, 1.0)) ** 0.75
        jaw = 0.78 + 0.22 * smooth(0.0, 0.45, t)
        head_rows.append((Vector((0, hc.y + 0.01 * (1 - t), z)), max(hw * s * jaw, 0.004), max(hd * s * (0.86 + 0.14 * smooth(0, 0.4, t)), 0.004)))
    head_rows[0] = (head_rows[0][0] + Vector((0, 0, 0.012)), 0.030, 0.035)
    m.tube(head_rows, 24, "head", lambda p: {"Head": 1.0})
    for s in (-1, 1):  # oreilles
        c = Vector((s * (hw + 0.004), 0.008, 1.555))
        m.limb(c - Vector((0, 0, 0.022)), c + Vector((0, 0, 0.022)), 0.012, 0.010, 6, "skin", lambda p: {"Head": 1.0}, steps=2)
    nose = Vector((0, hc.y - hd * 0.97, 1.548))
    m.limb(nose + Vector((0, 0.012, 0.03)), nose + Vector((0, -0.010, -0.004)), 0.007, 0.012, 8, "skin", lambda p: {"Head": 1.0}, steps=3)
    # Bras et mains.
    for s, L in ((1, "Left"), (-1, "Right")):
        sh, el, wr = J[L + "Arm"], J[L + "ForeArm"], J[L + "Hand"]
        sh = sh + Vector((-s * 0.02, 0, 0))
        w_arm = lambda p, L=L, sh=sh, el=el, wr=wr: chain(abs(p.x), [(L + "Arm", abs(sh.x) + 0.05), (L + "ForeArm", abs(el.x) + 0.02), (L + "Hand", abs(wr.x))])  # noqa: E731
        m.limb(sh, wr, B["arm"], B["arm"] * 0.72, 12, "arms", w_arm, steps=10)
        hand_end = wr + (T[L + "Hand"] - wr) * 0.5
        m.limb(wr + (hand_end - wr) * 0.1, hand_end, 0.033, 0.028, 8, "skin", lambda p, L=L: {L + "Hand": 1.0}, steps=3)
        # Jambes et chaussures.
        hip, knee, ank = J[L + "UpLeg"], J[L + "Leg"], J[L + "Foot"]
        w_leg = lambda p, L=L, knee=knee: chain(-p.z, [(L + "UpLeg", -knee.z - 0.06), (L + "Leg", -knee.z + 0.06)])  # noqa: E731
        m.limb(hip + Vector((0, 0, 0.06)), ank + Vector((0, -0.01, 0.0)), B["thigh"], 0.042, 12, "legs", w_leg, steps=12)
        toe = J[L + "ToeBase"]
        heel = Vector((ank.x, ank.y + 0.02, 0.045))
        tip = Vector((T[L + "ToeBase"].x, T[L + "ToeBase"].y + 0.005, 0.035))
        start = len(m.verts)
        m.limb(heel, tip, 0.048, 0.042, 10, "shoes", lambda p, L=L, toe=toe: {L + "Foot": 1.0} if p.y > toe.y else {L + "ToeBase": 1.0}, steps=6)
        for i in range(start, len(m.verts)):
            m.verts[i].z = max(m.verts[i].z, 0.0)
        m.limb(ank + Vector((0, -0.005, -0.03)), ank + Vector((0, -0.005, 0.05)), 0.050, 0.046, 10, "shoes", lambda p, L=L: {L + "Foot": 1.0}, steps=2)
    # Coiffure: coque texturée au-dessus de la ligne des cheveux, ouverte sur le visage; masse jusqu'aux épaules (carré).
    style = spec["hair_style"]
    hrows = []
    low = 1.40 if style == "bob" else 1.50
    for k in range(12):
        t = k / 11
        z = low + (top + 0.022 - low) * t
        zt = (z - chin) / (top - chin)
        s = math.sin(math.pi * min(max(zt, 0.02) * 1.05 + 0.04, 1.0)) ** 0.75
        flare = 1.0 + (0.30 * (1 - smooth(1.40, 1.56, z)) if style == "bob" else 0.0)
        rx = max(hw * max(s, 0.6 if z < 1.6 else s) * 1.12 * flare + 0.006, 0.006)
        ry = max(hd * max(s, 0.6 if z < 1.6 else s) * 1.10 * flare + 0.006, 0.006)
        if k == 11:
            rx, ry = 0.01, 0.01
        hrows.append((Vector((0, hc.y + 0.008, z)), rx, ry))
    line = 1.628 if style == "bob" else 1.645

    def keep(u, v):
        z = low + (top + 0.022 - low) * v
        front = abs(u - 0.5) < (0.30 if style == "bob" else 0.36)
        return not (front and z < line)
    m.tube(hrows, 24, "hair", lambda p: {"Head": 1.0}, keep=keep)
    if spec.get("moustache"):
        mz = 1.505
        for s in (-1, 1):
            a = Vector((s * 0.004, hc.y - hd * 0.93, mz))
            m.limb(a, a + Vector((s * 0.030, 0.008, -0.006)), 0.008, 0.006, 6, "hair", lambda p: {"Head": 1.0}, steps=3)

    me = bpy.data.meshes.new(cid)
    me.from_pydata([tuple(v) for v in m.verts], [], m.faces)
    uv = me.uv_layers.new(name="UVMap")
    for poly, uvs in zip(me.polygons, m.uvs):
        poly.use_smooth = True
        for li, val in zip(poly.loop_indices, uvs):
            uv.data[li].uv = val
    o = bpy.data.objects.new(cid, me)
    bpy.context.scene.collection.objects.link(o)
    groups = {}
    for i, w in enumerate(m.weights):
        tot = sum(w.values())
        for bone, x in w.items():
            if x > 1e-4:
                groups.setdefault(bone, o.vertex_groups.new(name=bone)).add([i], x / tot, "REPLACE")
    o.parent = rig
    o.modifiers.new("Armature", "ARMATURE").object = rig
    return o


# ---------------------------------------------------------------- peinture de l'atlas
def box(region):
    u0, v0, u1, v1 = R[region]
    return int(u0 * S), int((1 - v1) * S), int(u1 * S), int((1 - v0) * S)


def shade(c, k):
    return tuple(max(0, min(255, int(x * k))) for x in c)


def noise_fill(d, rect, color, amount=10, seed=1):
    rnd = random.Random(seed)
    x0, y0, x1, y1 = rect
    d.rectangle(rect, fill=color)
    for _ in range((x1 - x0) * (y1 - y0) // 6):
        x, y = rnd.randrange(x0, x1), rnd.randrange(y0, y1)
        k = 1 + rnd.uniform(-amount, amount) / 100
        d.point((x, y), fill=shade(color, k))


def paint(spec, expression):
    img = Image.new("RGB", (S, S), spec["skin"])
    d = ImageDraw.Draw(img)
    skin, top, bottom = spec["skin"], spec["top"], spec["bottom"]
    # Torse: bas du torse (sous la taille, v < 0,49) au bas, au-dessus le haut. u = 0,5 devant, 0 et 1 dos.
    x0, y0, x1, y1 = box("torso")
    W, H = x1 - x0, y1 - y0
    waist = y0 + int(H * (1 - 0.445))
    noise_fill(d, (x0, y0, x1, waist), top["color"], 8, 2)
    noise_fill(d, (x0, waist, x1, y1), bottom["color"], 10, 3)
    d.rectangle((x0, waist - 6, x1, waist + 2), fill=shade(bottom["color"], 0.7))  # ceinture
    d.rectangle((x0 + W // 2 - 6, waist - 6, x0 + W // 2 + 6, waist + 2), fill=(170, 150, 90))  # boucle
    for u in (0.25, 0.75):  # coutures de côté
        d.line((x0 + W * u, y0, x0 + W * u, y1), fill=shade(top["color"], 0.78), width=2)
    for k in range(5):  # plis sous les bras et à la taille
        y = waist - 12 - k * 9
        for u in (0.18, 0.62):
            d.arc((x0 + W * u, y - 6, x0 + W * u + 46, y + 10), 200, 340, fill=shade(top["color"], 0.82), width=2)
    neck_y = y0 + 10
    if top["kind"] == "plaid":  # carreaux dessinés dans la texture (bandes croisées), boutons au milieu
        plaid(d, (x0, y0, x1, waist - 2), top)
        cx = x0 + W // 2
        for k in range(5):
            d.ellipse((cx - 4, neck_y + 18 + k * 22, cx + 4, neck_y + 26 + k * 22), fill=(235, 228, 210))
        d.line((cx, neck_y, cx, waist - 8), fill=shade(top["color"], 0.6), width=2)
    elif top["kind"] == "sweater":
        for k in range(0, W, 5):  # côtes du col et de l'ourlet
            d.line((x0 + k, y0, x0 + k, y0 + 14), fill=shade(top["color"], 0.85))
            d.line((x0 + k, waist - 22, x0 + k, waist - 8), fill=shade(top["color"], 0.85))
        d.rectangle((x0, waist - 24, x1, waist - 22), fill=shade(top["color"], 0.8))
    else:  # chemise: patte boutonnée, col, puis gilet ouvert
        cx = x0 + W // 2
        d.line((cx, neck_y, cx, waist - 8), fill=shade(top["color"], 0.75), width=2)
        for k in range(5):
            d.ellipse((cx - 4, neck_y + 18 + k * 22, cx + 4, neck_y + 26 + k * 22), fill=(200, 196, 186))
        d.polygon([(cx - 40, y0), (cx, neck_y + 22), (cx + 40, y0)], fill=shade(top["color"], 0.92), outline=shade(top["color"], 0.7))
        if top.get("vest"):
            vc = top["vest"]
            noise_fill(d, (x0, y0 + 26, cx - 22, waist - 4), vc, 12, 5)
            noise_fill(d, (cx + 22, y0 + 26, x1, waist - 4), vc, 12, 6)
            for k in range(4):
                d.ellipse((cx - 34, y0 + 50 + k * 26, cx - 26, y0 + 58 + k * 26), fill=(60, 50, 40))
            d.rectangle((cx - 80, y0 + 110, cx - 46, y0 + 128), outline=shade(vc, 0.7), width=2)  # poche
            d.line((cx - 22, y0 + 26, cx - 22, waist - 4), fill=shade(vc, 0.6), width=3)
            d.line((cx + 22, y0 + 26, cx + 22, waist - 4), fill=shade(vc, 0.6), width=3)
    # Poches et braguette du bas.
    cx = x0 + W // 2
    d.line((cx, waist + 4, cx, y1), fill=shade(bottom["color"], 0.7), width=2)
    for u in (0.32, 0.68):
        d.arc((x0 + W * u - 26, waist - 8, x0 + W * u + 26, waist + 36), 0, 180, fill=shade(bottom["color"], 0.68), width=2)
    # Jambes: v = 0 hanche, 1 cheville. u = 0,5 devant.
    x0, y0, x1, y1 = box("legs")
    W, H = x1 - x0, y1 - y0
    noise_fill(d, (x0, y0, x1, y1), bottom["color"], 12 if bottom["kind"] == "cord" else 9, 7)
    if bottom["kind"] == "cord":
        for k in range(0, W, 4):
            d.line((x0 + k, y0, x0 + k, y1), fill=shade(bottom["color"], 0.86))
    for u in (0.25, 0.75):
        d.line((x0 + W * u, y0, x0 + W * u, y1), fill=shade(bottom["color"], 0.75), width=2)
        d.line((x0 + W * u + 2, y0, x0 + W * u + 2, y1), fill=(200, 160, 90) if bottom["kind"] == "jeans" else shade(bottom["color"], 0.9))
    for k in range(3):  # plis au genou et à la cheville
        yk = y0 + int(H * 0.52) + k * 6
        d.arc((x0 + W * 0.35, yk, x0 + W * 0.65, yk + 10), 200, 340, fill=shade(bottom["color"], 0.75), width=2)
        ya = y0 + int(H * 0.86) + k * 7
        d.arc((x0 + W * 0.3, ya, x0 + W * 0.7, ya + 10), 200, 340, fill=shade(bottom["color"], 0.78), width=2)
    d.rectangle((x0, y1 - 10, x1, y1), fill=shade(bottom["color"], 0.8))
    # Bras: manche jusqu'à `sleeve`, poignet ou revers, puis peau.
    x0, y0, x1, y1 = box("arms")
    W, H = x1 - x0, y1 - y0
    cuff = y0 + int(H * top["sleeve"] * 0.92)
    noise_fill(d, (x0, y0, x1, cuff), top["color"], 8, 9)
    if top["kind"] == "plaid":
        plaid(d, (x0, y0, x1, cuff), top)
    d.rectangle((x0, cuff - 8, x1, cuff), fill=shade(top["color"], 0.85))
    for k in range(3):
        ye = y0 + int(H * 0.47) + k * 7
        if ye < cuff - 10:
            d.arc((x0 + W * 0.2, ye, x0 + W * 0.8, ye + 9), 20, 160, fill=shade(top["color"], 0.8), width=2)
    # Chaussures.
    x0, y0, x1, y1 = box("shoes")
    noise_fill(d, (x0, y0, x1, y1), spec["shoes"]["color"], 8, 11)
    d.rectangle((x0, y1 - 18, x1, y1), fill=(40, 34, 30))
    for k in range(4):
        d.line((x0 + 50, y0 + 30 + k * 10, x0 + 78, y0 + 30 + k * 10), fill=shade(spec["shoes"]["color"], 1.4), width=2)
    # Cheveux: mèches en traits.
    x0, y0, x1, y1 = box("hair")
    hc = spec["hair"]
    noise_fill(d, (x0, y0, x1, y1), hc, 6, 13)
    rnd = random.Random(4)
    for _ in range(260):
        x = rnd.randrange(x0, x1)
        d.line((x, y0 + rnd.randrange(0, 20), x + rnd.randrange(-6, 7), y1), fill=shade(hc, rnd.choice((0.75, 0.85, 1.2, 1.3))), width=1)
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    d = ImageDraw.Draw(img)
    face(d, spec, expression)
    return img


def plaid(d, rect, top):
    x0, y0, x1, y1 = rect
    dark = top["stripes"]
    for k in range(x0, x1, 24):
        d.rectangle((k, y0, k + 8, y1), fill=tuple((a + b) // 2 for a, b in zip(top["color"], dark)))
    for k in range(y0, y1, 24):
        d.rectangle((x0, k, x1, k + 8), fill=tuple((a + b) // 2 for a, b in zip(top["color"], dark)))
    for kx in range(x0, x1, 24):
        for ky in range(y0, y1, 24):
            d.rectangle((kx, ky, kx + 8, ky + 8), fill=dark)
    for k in range(x0 + 16, x1, 24):
        d.line((k, y0, k, y1), fill=(220, 200, 150))


def face(d, spec, expression):
    """Visage peint sur la zone de la tête: u = 0,5 devant; v de 0 (menton) à 1 (sommet)."""
    x0, y0, x1, y1 = box("head")
    W, H = x1 - x0, y1 - y0
    skin = spec["skin"]
    cx = x0 + W // 2

    def vy(v):  # hauteur réelle sur le crâne (rangées en cosinus)
        t = math.acos(1 - 2 * v) / math.pi
        return y1 - int(H * t)
    # cheveux peints au-dessus de la ligne (rien de clair ne paraît sous la coque)
    d.rectangle((x0, y0, x1, vy(0.68)), fill=spec["hair"])
    d.rectangle((x0, y0, cx - 70, vy(0.42)), fill=spec["hair"])
    d.rectangle((cx + 70, y0, x1, vy(0.42)), fill=spec["hair"])
    d.ellipse((cx - 70, vy(0.35), cx - 40, vy(0.22)), fill=shade(skin, 0.95))  # joues
    d.ellipse((cx + 40, vy(0.35), cx + 70, vy(0.22)), fill=shade(skin, 0.95))
    ey = vy(0.47)
    for s in (-1, 1):
        ex = cx + s * 27
        if expression == "joie":
            d.arc((ex - 13, ey - 6, ex + 13, ey + 12), 200, 340, fill=(50, 35, 30), width=3)
        else:
            open_k = 1.35 if expression == "surprise" else 1.0
            d.ellipse((ex - 13, ey - int(8 * open_k), ex + 13, ey + int(8 * open_k)), fill=(245, 240, 232))
            d.ellipse((ex - 7, ey - 7, ex + 7, ey + 7), fill=spec["eyes"])
            d.ellipse((ex - 3, ey - 3, ex + 3, ey + 3), fill=(20, 18, 20))
            d.ellipse((ex - 5, ey - 6, ex - 2, ey - 3), fill=(255, 255, 255))
            d.arc((ex - 14, ey - int(10 * open_k), ex + 14, ey + int(8 * open_k)), 190, 350, fill=(45, 32, 28), width=3)
        by = ey - (24 if expression == "surprise" else 17)
        d.line((ex - 14 * s * -1, by + 3, ex, by - 1, ex + 14 * s, by + 2), fill=shade(spec["hair"], 0.8), width=4, joint="curve")
    d.ellipse((cx - 9, vy(0.33), cx + 9, vy(0.29)), fill=shade(skin, 0.85))  # ombre du nez
    my = vy(0.205)
    lips = spec["lips"]
    if expression == "joie":
        d.chord((cx - 22, my - 10, cx + 22, my + 14), 0, 180, fill=(120, 40, 40), outline=lips, width=3)
        d.rectangle((cx - 14, my + 1, cx + 14, my + 4), fill=(240, 236, 228))
    elif expression == "surprise":
        d.ellipse((cx - 9, my - 6, cx + 9, my + 12), fill=(110, 40, 40), outline=lips, width=3)
    else:
        d.arc((cx - 18, my - 8, cx + 18, my + 6), 20, 160, fill=lips, width=4)


rig, J, T = load_skeleton()
os.makedirs(OUT, exist_ok=True)
for cid, spec in CHARACTERS.items():
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH":
            bpy.data.objects.remove(o, do_unlink=True)
    o = build(cid, spec, rig, J, T)
    for expr in ("neutre", "joie", "surprise"):
        paint(spec, expr).save(os.path.join(OUT, f"{cid}-{expr}.png"))
    img = bpy.data.images.load(os.path.join(OUT, f"{cid}-neutre.png"))
    mat = bpy.data.materials.new(cid)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.8
    tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
    tex.image = img
    mat.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    o.data.materials.append(mat)
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, f"{cid}.glb"), export_format="GLB", use_selection=True, export_skins=True,
                              export_animations=True, export_image_format="AUTO")
    print("VOIE_A", cid, len(o.data.polygons), sum(len(p.vertices) - 2 for p in o.data.polygons), "triangles")
