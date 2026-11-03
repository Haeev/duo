"""Visages des personnages témoins (plan de qualité visuelle, chantier 2, fiche 4.3).

Tête lisse (ellipsoïde travaillé: visage un peu aplati, joues, menton rond), sans arête au milieu du visage.
Traits:
- yeux peints: le blanc, l'iris, la pupille et le reflet sont peints dans une vignette de 32 x 32 px de
  `personnages.png` (sous les rangées de cases, `paint_tiles`), posée sur un décalque en forme d'oeil plaqué sur la
  tête. La paupière supérieure (trait épais qui déborde en pointe de cil) est une bande de la case `eye`;
- sourcils en coup de pinceau (attaque épaisse côté nez, pointe fine), case `hair_dark`: ils suivent la couleur
  des cheveux d'un joueur;
- bouche en trait courbe épaissi aux coins (case `mouth`), ouverte en forme sombre avec la langue (case `cheek`);
- joues: dégradé rose peint dans les couleurs de sommets (multiplié à la peau, donc juste pour toutes les peaux);
  ombre sous le nez, ombre de frange ou de visière, creux de l'oreille: même moyen;
- rides, rides du rire, grain de beauté: bandes minces de la case `skin_shade` (suivent la peau d'un joueur).
Toutes les expressions ont la même topologie (clés de forme). Le reflet est en haut à gauche vu de face, pour les
deux yeux (lumière de midi constante, fiche 4.3).
"""
import math

from mathutils import Vector

import temoins_outils as T

TILE = 32
TILE_Y0 = 128          # première ligne de pixels des vignettes (rangée 32 de cases)
TEX_W, TEX_H = 64, 256
EYE_TILES = {"colette": 0, "firmin": 1, "player": 2}
IRIS = {"colette": ("#5B3B24", "#2C1C13"), "firmin": ("#5D7387", "#2B3540"), "player": ("#4C3527", "#22170F")}
SCLERA = "#F3EDE2"

# Paramètres des visages (m, repère de la tête: x vers la gauche du personnage, z vers le haut depuis le centre).
FACES = {
    "colette": {"eye": "amande", "eye_x": 0.035, "eye_z": 0.0, "W": 0.034, "H": 0.046, "brow": (0.0078, 0.0024),
                "brow_arch": 0.0065, "brow_lift": 0.0125, "brow_in": 0.0, "mouth_w": 0.044, "mouth_z": -0.068,
                "smile": 0.0042, "nose": (0.019, 0.012, 0.016), "nose_z": -0.032, "blush": 1.0,
                "details": ("laugh", "mole")},
    "firmin": {"eye": "mi-clos", "eye_x": 0.035, "eye_z": 0.0, "W": 0.034, "H": 0.043, "brow": (0.011, 0.005),
               "brow_arch": 0.002, "brow_lift": 0.0095, "brow_in": -0.0028, "mouth_w": 0.04, "mouth_z": -0.074,
               "smile": 0.0015, "nose": (0.024, 0.016, 0.02), "nose_z": -0.034, "blush": 0.85,
               "details": ("crow", "fold", "lower_lid", "forehead")},
    "player": {"eye": "rond", "eye_x": 0.035, "eye_z": 0.002, "W": 0.034, "H": 0.046, "brow": (0.0075, 0.0024),
               "brow_arch": 0.0045, "brow_lift": 0.012, "brow_in": 0.0, "mouth_w": 0.038, "mouth_z": -0.068,
               "smile": 0.0035, "nose": (0.018, 0.012, 0.015), "nose_z": -0.032, "blush": 0.7, "details": ()},
}

NU, NV = 7, 4          # grille du décalque d'un oeil


def _hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def tile_rect(who):
    i = EYE_TILES[who]
    return (i % 2) * TILE, TILE_Y0 + (i // 2) * TILE


def paint_tiles(img):
    """Peint les vignettes des yeux dans personnages.png (Pillow, image RGB de 64 x 256)."""
    from PIL import Image
    ss = 8
    for who in EYE_TILES:
        f = FACES[who]
        W, H = f["W"], f["H"]
        n = TILE * ss
        big = Image.new("RGB", (n, n))
        px = big.load()
        iris, rim = (_hex(c) for c in IRIS[who])
        scl = _hex(SCLERA)
        ri = 0.30 * H
        icx, icz = 0.0, -0.02 * H
        for j in range(n):
            for i in range(n):
                s, t = (i + 0.5) / n, (j + 0.5) / n
                x, z = (s - 0.5) * W, (0.5 - t) * H
                # blanc cassé, ombré sous la paupière
                k = max(0.0, min(1.0, (z - 0.05 * H) / (0.45 * H)))
                c = tuple(int(a * (1 - 0.16 * k)) for a in scl)
                d = math.hypot(x - icx, z - icz)
                if d < ri:
                    # iris: plus sombre en haut (ombre de la paupière) et au bord
                    up = max(0.0, (z - icz) / ri)
                    e = d / ri
                    m = min(1.0, 0.35 * up + max(0.0, e - 0.72) / 0.28 * 0.8)
                    c = tuple(int(a + (b - a) * m) for a, b in zip(iris, rim))
                    if d < 0.44 * ri:
                        c = (24, 18, 16)
                hx, hz = icx - 0.36 * ri, icz + 0.4 * ri
                if math.hypot(x - hx, z - hz) < 0.3 * ri:
                    c = (255, 255, 252)
                px[i, j] = c
        small = big.reduce(ss)
        x0, y0 = tile_rect(who)
        img.paste(small, (x0, y0))


def eye_uv(who, x, z):
    """UV (Blender) d'un point de l'oeil (x, z relatifs au centre de l'oeil, forme neutre)."""
    f = FACES[who]
    s = max(0.0, min(1.0, x / f["W"] + 0.5))
    t = max(0.0, min(1.0, 0.5 - z / f["H"]))
    x0, y0 = tile_rect(who)
    return ((x0 + 0.5 + s * (TILE - 1)) / TEX_W, 1.0 - (y0 + 0.5 + t * (TILE - 1)) / TEX_H)


# Tête -----------------------------------------------------------------------------------------------------

def head(g, hc, R, jaw=0.1, cheeks=0.035, flat=0.1):
    """Tête lisse: ellipsoïde de demi-axes R, visage aplati devant, mâchoire ronde. Renvoie ses sommets."""
    def deform(p):
        x, y, z = p.x, p.y, p.z
        if y < 0:
            y *= 1.0 - flat * (1.0 - min(1.0, abs(z))) ** 1.5 * (1.0 - min(1.0, abs(x)))
        if z < 0:
            k = -z
            x *= 1.0 - jaw * k ** 1.6
            if y < 0:
                y *= 1.0 - 0.06 * k ** 2
        # joues pleines (bas du visage, sur les côtés)
        c = max(0.0, -y) * max(0.0, 1.0 - abs(z + 0.32) / 0.45) * min(1.0, abs(x) * 1.6)
        f = 1.0 + cheeks * c
        return Vector((x * f, y * f, z))
    vs = T.ellipsoid(g, (0, 0, hc), R, "skin", segs=16, rings=11, bone="head", deform=deform)
    T.tag(g, "head", vs)
    return vs


def _eye_curves(shape, expr, u, s):
    """Bords haut et bas de l'oeil (en demi-hauteurs) au paramètre u (0 à 1 vers +X), s = côté (+1 oeil gauche)."""
    o = u if s > 0 else 1.0 - u
    e = math.sqrt(max(0.035, 1.0 - (2 * u - 1) ** 2))
    if shape == "rond":
        top, bot = 1.0 * e ** 0.8, -0.95 * e ** 0.9
    elif shape == "amande":
        top, bot = 1.0 * e ** 0.62 * (1.0 - 0.1 * o), -0.78 * e ** 1.15
        top -= 0.12 * o ** 2
        bot -= 0.06 * o ** 2
    elif shape == "mi-clos":
        top, bot = 0.6 * e ** 0.7, -0.88 * e ** 1.0
        top -= 0.1 * o ** 2
    else:
        top, bot = e, -e
    if expr == "happy":
        top = 0.42 * e ** 0.8 - 0.1
        bot = top - 0.2
    elif expr == "delighted":
        top = 0.62 * e ** 0.8 - 0.05
        bot = top - 0.2
    elif expr == "tired":
        top = min(top, 0.05 + 0.12 * e)
    elif expr == "hungry":
        top, bot = top * 1.1 + 0.04, bot * 1.06
    elif expr == "blink":
        top = -0.32 * e ** 0.9 + 0.02
        bot = top - 0.2
    if top - bot < 0.18:
        bot = top - 0.18
    return top, bot


def face(g, who, expr, hc, head_verts):
    """Pose les traits sur la tête (centre hc). Renvoie le dict des pièces (pour la peinture)."""
    f = FACES[who]
    surf = T.Surface(head_verts)
    W, H = f["W"], f["H"]
    ez = hc + f["eye_z"]
    y0 = -1.0
    parts = {}
    for s in (1, -1):
        cx = s * f["eye_x"]
        # oeil: grille plaquée, UV vers la vignette peinte
        rows = []
        for j in range(NV):
            row = []
            for i in range(NU):
                u = i / (NU - 1)
                top, bot = _eye_curves(f["eye"], expr, u, s)
                z = (bot + (top - bot) * j / (NV - 1)) * H / 2
                row.append((cx + (u - 0.5) * W, y0, ez + z))
            rows.append(row)
        gv = T.grid_piece(g, rows, "eye", bone="head")
        verts = [v for r in gv for v in r]
        # UV depuis la forme neutre (même règle pour toutes les expressions; seule la base compte)
        for v in verts:
            g.eye_uv[v] = eye_uv(who, v.co.x - cx, v.co.z - ez)
        surf.plate(g, verts, offset=0.0016)
        T.tag(g, "eyes", verts)
        # paupière supérieure: bande qui suit le bord haut, déborde dehors en pointe de cil
        pts, widths = [], []
        for i in range(NU):
            u = i / (NU - 1)
            top, _ = _eye_curves(f["eye"], expr, u, s)
            e = math.sqrt(max(0.0, 1.0 - (2 * u - 1) ** 2))
            pts.append(Vector((cx + (u - 0.5) * W * 1.04, y0, ez + top * H / 2 + 0.0011)))
            widths.append(0.0024 + 0.0016 * e)
        o_end = pts[-1] if s > 0 else pts[0]
        flick = Vector((cx + s * W * 0.62, y0, o_end.z + 0.0045))
        if s > 0:
            pts.append(flick)
            widths.append(0.0012)
        else:
            pts.insert(0, flick)
            widths.insert(0, 0.0012)
        lft, rgt = T.strip(g, pts, widths, "eye", lambda p: Vector((0, -1, 0)), bone="head")
        surf.plate(g, lft + rgt, offset=0.0021)
        T.tag(g, "lids", lft + rgt)
        if "lower_lid" in f["details"]:
            pts, widths = [], []
            for i in range(1, NU - 1):
                u = i / (NU - 1)
                _, bot = _eye_curves(f["eye"], "neutral", u, s)
                pts.append(Vector((cx + (u - 0.5) * W * 0.9, y0, ez + bot * H / 2 - 0.0035)))
                widths.append(0.0011)
            lft, rgt = T.strip(g, pts, widths, "skin_shade", lambda p: Vector((0, -1, 0)), bone="head")
            surf.plate(g, lft + rgt, offset=0.0014)
        # sourcil: coup de pinceau
        bi, bo = {"happy": (0.004, 0.003), "delighted": (0.008, 0.006), "tired": (-0.001, -0.006),
                  "hungry": (0.009, -0.002)}.get(expr, (0.0, 0.0))
        inner = Vector((cx - s * W * 0.42, y0, ez + H / 2 + f["brow_lift"] + f["brow_in"] + bi))
        outer = Vector((cx + s * W * 0.66, y0, ez + H / 2 + f["brow_lift"] - 0.004 + bo))
        mid = (inner + outer) / 2 + Vector((0, 0, f["brow_arch"] + 0.5 * (bi + bo) * 0.3))
        pts, widths = [], []
        w0, w1 = f["brow"]
        for k in range(7):
            t = k / 6
            p = inner * (1 - t) ** 2 + mid * 2 * t * (1 - t) + outer * t * t
            pts.append(p)
            widths.append(w0 + (w1 - w0) * t ** 1.3)
        if s < 0:
            pts.reverse()
            widths.reverse()
        lft, rgt = T.strip(g, pts, widths, "hair_dark", lambda p: Vector((0, -1, 0)), bone="head")
        if who == "firmin":
            # sourcils broussailleux: bord haut en dents irrégulières
            for i, v in enumerate(lft if s > 0 else rgt):
                v.co.z += 0.0016 * math.sin(i * 2.3 + 1.0)
        surf.plate(g, lft + rgt, offset=0.0019)
        T.tag(g, "brows", lft + rgt)
        # rides
        if "laugh" in f["details"] or "crow" in f["details"]:
            n = 2 if "crow" in f["details"] else 1
            for k in range(n):
                a0 = Vector((cx + s * W * 0.62, y0, ez - 0.002 - k * 0.006))
                a1 = a0 + Vector((s * 0.008, 0, -0.003 - k * 0.003))
                lft, rgt = T.strip(g, [a0, (a0 + a1) / 2 + Vector((s * 0.001, 0, 0.001)), a1],
                                   [0.0013, 0.0016, 0.0008], "skin_shade", lambda p: Vector((0, -1, 0)), bone="head")
                surf.plate(g, lft + rgt, offset=0.0013)
        if "fold" in f["details"]:
            pts = [Vector((s * 0.024, y0, hc + f["nose_z"] - 0.006)), Vector((s * 0.032, y0, hc + f["nose_z"] - 0.024)),
                   Vector((s * 0.034, y0, hc + f["mouth_z"] - 0.006))]
            lft, rgt = T.strip(g, T.catmull(pts, 5), [0.0012, 0.0017, 0.0018, 0.0015, 0.0008], "skin_shade",
                               lambda p: Vector((0, -1, 0)), bone="head")
            surf.plate(g, lft + rgt, offset=0.0013)
    if "forehead" in f["details"]:
        pts = [Vector((x, y0, hc + 0.066 + 0.004 * math.cos(x / 0.05))) for x in (-0.05, -0.025, 0.0, 0.025, 0.05)]
        lft, rgt = T.strip(g, pts, [0.0008, 0.0014, 0.0016, 0.0014, 0.0008], "skin_shade",
                           lambda p: Vector((0, -1, 0)), bone="head")
        surf.plate(g, lft + rgt, offset=0.0012)
    if "mole" in f["details"]:
        c = Vector((0.03, y0, hc + f["mouth_z"] - 0.008))
        pts = [c + Vector((0.0022 * math.cos(a), 0, 0.0022 * math.sin(a))) for a in
               [2 * math.pi * k / 6 for k in range(6)]]
        vs = T.flat_piece(g, pts, "hair_dark", bone="head")
        surf.plate(g, vs, offset=0.0012)
    parts["mouth"] = mouth(g, who, expr, hc, surf)
    return surf


def mouth(g, who, expr, hc, surf):
    f = FACES[who]
    y0 = -1.0
    W = f["mouth_w"] * {"happy": 1.1, "delighted": 1.12, "tired": 0.9, "hungry": 0.45}.get(expr, 1.0)
    z0 = hc + f["mouth_z"]
    sm = {"happy": 2.0, "delighted": 1.6, "tired": -0.6, "hungry": 0.0}.get(expr, 1.0) * f["smile"]
    n = 9
    top, bot = [], []
    for i in range(n):
        u = -1 + 2 * i / (n - 1)
        x = u * W / 2
        c = z0 + sm * u * u
        th = 0.0019 + 0.0009 * u * u
        if expr == "delighted":
            t = c + 0.0012
            b = c - 0.019 * (1 - u * u) ** 0.75 - 0.0012
        elif expr == "hungry":
            t = c + 0.0045 * (1 - u * u) ** 0.5 + 0.0008
            b = c - 0.0075 * (1 - u * u) ** 0.5 - 0.0008
        else:
            t, b = c + th, c - th
        top.append((x, y0, t))
        bot.append((x, y0, b))
    gv = T.grid_piece(g, [bot, top], "mouth", bone="head")
    verts = [v for r in gv for v in r]
    surf.plate(g, verts, offset=0.0016)
    T.tag(g, "mouth", verts)
    # langue: visible bouche ouverte, sinon rentrée sous la peau (même topologie, aucun triangle dégénéré)
    open_ = expr == "delighted"
    tw = W * 0.5
    rows = []
    for j, dz in enumerate((-0.0165, -0.009)):
        rows.append([(u * tw / 2, y0, z0 + sm * u * u + dz * (1 - 0.3 * u * u)) for u in (-1, -0.5, 0, 0.5, 1)])
    tv = T.grid_piece(g, rows, "cheek", bone="head")
    tverts = [v for r in tv for v in r]
    surf.plate(g, tverts, offset=0.0019 if open_ else -0.008)
    return verts


def nose(g, who, hc, surf):
    f = FACES[who]
    r = f["nose"]
    z = hc + f["nose_z"]
    loc, _ = surf.hit(Vector((0, -1.0, z)), Vector((0, 1, 0)))
    y = loc.y + r[1] * 0.45 if loc is not None else -0.16
    vs = T.ellipsoid(g, (0, y, z), r, "skin", segs=8, rings=5, bone="head")
    T.tag(g, "nose", vs)
    return vs


def ears(g, hc, R, z=-0.012, size=1.0):
    out = []
    for s in (1, -1):
        vs = T.ellipsoid(g, (s * R[0] * 0.96, 0.012, hc + z), (0.017 * size, 0.03 * size, 0.043 * size), "skin",
                         segs=7, rings=4, bone="head", rot=(0, 0, s * -12))
        for v in vs:
            # creux de l'oreille: face extérieure, au centre (forme en C)
            d = Vector((v.co.x - s * R[0] * 0.96, v.co.y - 0.012, v.co.z - hc - z))
            if s * d.x > 0.006:
                k = max(0.0, 1.0 - math.hypot(d.y / 0.022, d.z / 0.03))
                T.mul(g, v, (1.0 - 0.3 * k, 1.0 - 0.36 * k, 1.0 - 0.36 * k))
        T.tag(g, "ears", vs)
        out += vs
    return out


def paint_face(g, who, hc, under_shadow=None):
    """Joues, ombre sous le nez, ombre de frange ou de visière (couleurs de sommets de la tête)."""
    f = FACES[who]
    pink = (1.0, 0.8, 0.79)
    for v in g.tags.get("head", ()):
        x, y, z = v.co.x, v.co.y, v.co.z - hc
        if y > 0:
            continue
        for s in (1, -1):
            dx, dz = x - s * 0.083, z - (f["mouth_z"] + 0.03)
            k = math.exp(-(dx * dx + dz * dz) / (2 * 0.024 ** 2)) * f["blush"]
            if k > 0.01:
                T.mul(g, v, tuple(1.0 - (1.0 - c) * k for c in pink))
        # ombre sous le nez, du côté opposé au reflet (droite vue de face: +X)
        dx, dz = x - 0.006, z - (f["nose_z"] - 0.022)
        k = math.exp(-(dx * dx / (2 * 0.012 ** 2) + dz * dz / (2 * 0.006 ** 2)))
        if k > 0.02:
            T.mul(g, v, 1.0 - 0.16 * k)
        if under_shadow is not None:
            z0, depth, k0 = under_shadow
            if z0 - depth < z < z0 + 0.03:
                k = min(1.0, (z - (z0 - depth)) / depth)
                T.mul(g, v, 1.0 - k0 * k)
    for v in g.tags.get("nose", ()):
        T.mul(g, v, (1.0, 0.93, 0.91) if who == "firmin" else (1.0, 0.97, 0.96))
