"""Personnages témoins de la qualité visuelle (étape A du plan `docs/jeux/jeu-1/qualite-visuelle-plan.md`):
Colette (gabarit rond), Firmin (gabarit trapu) et le joueur habillé (gabarit moyen: `player_base`, chemise,
pantalon, coupe courte).

Ce qui change par rapport aux habitants d'avant:
- volumes lissés (normales lissées, arêtes vives seulement au-delà de 50 degrés: ourlets, semelles, visières);
- visage peint et plaqué (`visages.py`), tête lisse;
- cheveux en mèches effilées sur une calotte qui épouse le crâne (épi ou raie, mèches folles);
- tissus: épaisseurs aux bords (ourlets retournés, revers, poignets), plis de jupe, poches, surpiqûres en tirets,
  plis et occlusion peints dans les couleurs de sommets (attribut `Col`, COLOR_0);
- gabarits (`gabarits.py`) et pose de repos propre à chacun (clips `idle_colette`, `idle_firmin`, `idle_player`).

Repères (Blender): devant vers -Y, gauche du personnage vers +X, Z en haut; chaque personnage est modelé autour des
os de son gabarit puis ramené au squelette commun (`gabarits.to_standard`).
"""
import math
import os

from mathutils import Matrix, Vector

import gabarits as G
import temoins_outils as T
import visages as V

PP = None   # module personnages (posé par personnages.py)
GR = None   # garde_robe
CF = None   # coiffures

GABARIT = {"colette": "rond", "firmin": "trapu", "firmin_scarf": "trapu", "player": "moyen"}
IDLE = {"colette": "idle_colette", "firmin": "idle_firmin", "player": "idle_player"}
HEADS = {"colette": (0.18, 0.163, 0.168), "firmin": (0.184, 0.167, 0.168), "player": (0.18, 0.165, 0.17)}


def J(gab, name, end="head"):
    return G.joint(gab, name, end)


def head_center(gab):
    return J(gab, "head").z + 0.095


def blend(z, z0, z1, b0, b1):
    """Poids qui glissent de b0 (sous z0) à b1 (au-dessus de z1)."""
    t = max(0.0, min(1.0, (z - z0) / (z1 - z0)))
    t = t * t * (3 - 2 * t)
    return {b0: 1.0 - t, b1: t} if 0 < t < 1 else ({b0: 1.0} if t <= 0 else {b1: 1.0})


def torso_w(z0=0.95, z1=1.03, z2=1.10, z3=1.18):
    def w(co):
        if co.z < z1:
            return blend(co.z, z0, z1, "hips", "spine")
        return blend(co.z, z2, z3, "spine", "chest")
    return w


def sph(hc, R, az, el, k):
    a, e = math.radians(az), math.radians(el)
    return Vector((R[0] * k * math.cos(e) * math.sin(a), -R[1] * k * math.cos(e) * math.cos(a), hc + R[2] * k * math.sin(e)))


# Tête complète ----------------------------------------------------------------------------------------------

def head_and_face(g, who, expr, hc, ears=True, ear_z=-0.012):
    R = HEADS[who]
    jaw, cheeks = {"colette": (0.07, 0.05), "firmin": (0.035, 0.03), "player": (0.09, 0.035)}[who]
    hv = V.head(g, hc, R, jaw=jaw, cheeks=cheeks)
    g.bm.normal_update()
    surf = V.face(g, who, expr, hc, hv)
    V.nose(g, who, hc, surf)
    if ears:
        V.ears(g, hc, R, z=ear_z)
    return surf


# Cheveux ----------------------------------------------------------------------------------------------------

def shell(g, hc, R, az_range, hairline, kfn, color="hair", inner="hair_dark", nseg=20, nrow=6, thick=0.018,
          bone="head", weights=None, top_el=86.0):
    """Calotte de cheveux: grille de la couronne (top_el) jusqu'à la lisière hairline(az) en degrés, rayon relatif
    kfn(az, el); couche intérieure sombre et bord épais (vu d'en dessous, pas de trou vers le crâne).
    az_range = (début, fin) en degrés; un tour complet si fin - début = 360."""
    a0, a1 = az_range
    full = abs((a1 - a0) - 360.0) < 1e-6
    cols = nseg if full else nseg + 1
    bm = g.bm
    outer, inn = [], []
    for c in range(cols):
        az = a0 + (a1 - a0) * c / nseg
        hl = hairline(az)
        o_col, i_col = [], []
        for r in range(nrow + 1):
            el = top_el + (hl - top_el) * (r / nrow) ** 0.9
            k = kfn(az, el)
            o_col.append(bm.verts.new(sph(hc, R, az, el, k)))
            i_col.append(bm.verts.new(sph(hc, R, az, el, k - thick / R[2])))
        outer.append(o_col)
        inn.append(i_col)
    faces = []
    ncol = cols if full else cols - 1
    for c in range(ncol):
        c2 = (c + 1) % cols
        for r in range(nrow):
            faces.append(bm.faces.new((outer[c][r], outer[c][r + 1], outer[c2][r + 1], outer[c2][r])))
            faces.append(bm.faces.new((inn[c][r], inn[c2][r], inn[c2][r + 1], inn[c][r + 1])))
        faces.append(bm.faces.new((outer[c][nrow], inn[c][nrow], inn[c2][nrow], outer[c2][nrow])))
    if not full:
        for c in (0, cols - 1):
            for r in range(nrow):
                q = (outer[c][r], inn[c][r], inn[c][r + 1], outer[c][r + 1])
                faces.append(bm.faces.new(q if c == 0 else tuple(reversed(q))))
    # couronne: deux pôles (dehors et dedans)
    po = bm.verts.new(sph(hc, R, 0, 90, kfn(0, 90)))
    pi = bm.verts.new(sph(hc, R, 0, 90, kfn(0, 90) - thick / R[2]))
    for c in range(ncol):
        c2 = (c + 1) % cols
        faces.append(bm.faces.new((po, outer[c][0], outer[c2][0])))
        faces.append(bm.faces.new((pi, inn[c2][0], inn[c][0])))
    if not full:
        faces.append(bm.faces.new((po, pi, inn[0][0], outer[0][0])))
        faces.append(bm.faces.new((po, outer[cols - 1][0], inn[cols - 1][0], pi)))
    ov = [v for col in outer for v in col] + [po]
    iv = [v for col in inn for v in col] + [pi]
    T.fix_normals(g, ov + iv)
    g._finish(ov, color, bone, weights)
    g._finish(iv, inner, bone, weights)
    T.tag(g, "hair", ov + iv)
    for v in iv:
        T.mul(g, v, 0.7)
    return ov


def hair_strands(g, hc, R, specs, kfn, color="hair", bone="head", weights=None):
    """specs: [(liste de (az, el, dk), largeur, épaisseur)] mèches posées sur la calotte (dk: écart au-dessus)."""
    out = []
    center = Vector((0, 0.01, hc))
    for path, w, t in specs:
        pts = [sph(hc, R, az, el, kfn(az, el) + dk) for az, el, dk in path]
        vs = T.strand(g, pts, w, t, color, center, bone=bone, weights=weights)
        T.tag(g, "hair", vs)
        # creux entre les mèches: la racine et le dessous plus sombres
        for v in vs:
            d = (v.co - center).length - (pts[0] - center).length
            T.mul(g, v, 0.86 if d < 0 else 1.0)
        out += vs
    return out


def hair_colette(g, hc):
    R = HEADS["colette"]

    def hairline(az):
        a = abs(((az + 180) % 360) - 180)
        if a < 38:
            return 24.0 + 3.0 * math.cos(a / 38 * math.pi)
        if a < 80:
            t = (a - 38) / 42
            return 24.0 + (-33.0 - 24.0) * (t * t * (3 - 2 * t))
        return -33.0 - 4.0 * min(1.0, (a - 80) / 60)

    def kfn(az, el):
        a = abs(((az + 180) % 360) - 180)
        side = min(1.0, max(0.0, (a - 30) / 40))
        flare = max(0.0, min(1.0, (12 - el) / 42)) ** 1.4 * side
        turn = max(0.0, min(1.0, (-26 - el) / 10)) * side
        return 1.075 + 0.12 * flare - 0.05 * turn

    shell(g, hc, R, (-180, 180), hairline, kfn, nseg=16, nrow=5)
    specs = []
    # frange droite: cinq mèches du dessus vers le front, longueurs inégales (pointes au-dessus des sourcils)
    for az, tip, w in ((-30, 21, 0.034), (-15, 18.5, 0.036), (0, 20, 0.036), (15, 18, 0.036), (30, 21.5, 0.032)):
        specs.append(([(az * 0.5, 72, -0.004), (az * 0.8, 52, 0.016), (az, 34, 0.018), (az * 1.04, tip, 0.012)], w, 0.011))
    # côtés: mèches en S qui couvrent l'oreille, pointes rentrées vers la joue
    for s in (1, -1):
        for az, w in ((50, 0.048), (82, 0.05), (118, 0.048)):
            path = [(s * (az - 18), 66, -0.004), (s * (az - 4), 34, 0.016), (s * az, 0, 0.02), (s * (az + 3), -24, 0.018),
                    (s * (az - 2), -31, 0.008)]
            specs.append((path, w, 0.012))
    # dos: depuis l'épi (haut du crâne, à l'arrière), vers la nuque
    for az in (154, 180, 206):
        specs.append(([(180 + (az - 180) * 0.3, 70, -0.004), (az, 40, 0.014), (az, 0, 0.018), (az, -30, 0.016),
                       (az, -37, 0.006)], 0.05, 0.012))
    # mèches folles: une sur le dessus (épi), une à la tempe droite, une derrière l'oreille gauche
    specs.append(([(178, 74, 0.01), (150, 84, 0.03), (60, 86, 0.04)], 0.014, 0.007))
    specs.append(([(-40, 40, 0.02), (-46, 22, 0.03), (-50, 8, 0.026)], 0.012, 0.006))
    specs.append(([(105, 20, 0.022), (112, -2, 0.03), (108, -18, 0.03)], 0.012, 0.006))
    hair_strands(g, hc, R, specs, kfn)


def hair_firmin_sides(g, hc):
    """Côtés et nuque gris sous la casquette (le dessus est sous la calotte de la casquette)."""
    R = HEADS["firmin"]

    def hairline(az):
        a = abs(((az + 180) % 360) - 180)
        if a < 100:
            return 6.0 - 4.0 * (a - 52) / 48
        return 2.0 - 30.0 * min(1.0, (a - 100) / 70)

    def kfn(az, el):
        return 1.035 + 0.01 * max(0.0, el) / 30
    shell(g, hc, R, (52, 308), hairline, kfn, nseg=16, nrow=3, thick=0.012, top_el=34.0)
    specs = []
    for s in (1, -1):
        for az in (60, 82, 110, 140):
            specs.append(([(s * (az - 6), 30, 0.004), (s * az, 16, 0.012), (s * (az + 8), 4, 0.01)], 0.03, 0.009))
    for az in (165, 195):
        specs.append(([(az, 28, 0.004), (az, 4, 0.012), (az, -22, 0.008)], 0.036, 0.009))
    hair_strands(g, hc, R, specs, kfn)


def mustache_firmin(g, hc, surf):
    """Grosse moustache grise en mèches: elle part sous le nez et tombe aux coins de la bouche."""
    f = V.FACES["firmin"]
    zb = hc + f["nose_z"] - 0.014
    out = []
    center = Vector((0, 0.06, hc - 0.02))
    for s in (1, -1):
        for k, (dx, w) in enumerate(((0.006, 0.026), (0.019, 0.022))):
            pts2 = [(s * dx, zb + 0.002), (s * (dx + 0.016), zb - 0.006 - k * 0.002),
                    (s * (dx + 0.028), zb - 0.018 - k * 0.003), (s * (dx + 0.03), zb - 0.03 - k * 0.002)]
            pts = []
            for x, z in pts2:
                loc, n = surf.hit(Vector((x, -1, z)), Vector((0, 1, 0)))
                pts.append(loc + n * 0.007)
            vs = T.strand(g, pts, w, 0.009, "hair", center, bone="head")
            T.tag(g, "hair", vs)
            out += vs
    return out


def hair_player_short(g, hc, strands=True):
    """Coupe courte du joueur: raie à droite, mèches qui partent de la raie, petit épi sur le crâne."""
    R = HEADS["player"]

    def hairline(az):
        a = ((az + 180) % 360) - 180
        b = abs(a)
        if b < 46:
            return 25.0 + 3.5 * math.sin(a / 46 * 2.5 * math.pi)
        if b < 100:
            t = (b - 46) / 54
            return 25.0 + (13.0 - 25.0) * t
        return 13.0 - 46.0 * min(1.0, (b - 100) / 72) ** 1.2

    def kfn(az, el):
        a = abs(((az + 180) % 360) - 180)
        front = max(0.0, 1.0 - a / 70) * max(0.0, min(1.0, (50 - el) / 20))
        return 1.075 - 0.05 * front

    shell(g, hc, R, (-180, 180), hairline, kfn, nseg=16, nrow=5, thick=0.016)
    if not strands:
        return
    part = -26.0
    specs = []
    # côté large (gauche du personnage): mèches couchées depuis la raie vers la tempe et l'arrière
    for az_t, el_t, w in ((44, 28, 0.046), (88, 17, 0.048), (130, 10, 0.046)):
        specs.append(([(part + 6, 74, -0.004), ((part + az_t) / 2 + 10, 64, 0.016), (az_t, 40, 0.018), (az_t + 6, el_t, 0.01)],
                      w, 0.012))
    # devant: deux mèches relevées en petite houppe
    specs.append(([(part + 4, 50, 0.006), (part + 14, 40, 0.024), (part + 28, 34, 0.026), (part + 40, 33, 0.016)], 0.036, 0.013))
    specs.append(([(part + 2, 58, 0.006), (part + 2, 44, 0.026), (part + 8, 36, 0.028), (part + 20, 32, 0.016)], 0.032, 0.012))
    specs.append(([(part + 10, 46, -0.002), (part + 16, 34, 0.02), (part + 22, 22, 0.02), (part + 30, 17, 0.01)], 0.034, 0.01))
    specs.append(([(part + 30, 44, -0.002), (part + 36, 32, 0.018), (part + 42, 22, 0.016)], 0.03, 0.009))
    # côté étroit (droite): deux mèches vers la tempe
    for az_t, el_t in ((-50, 26), (-82, 16)):
        specs.append(([(part - 4, 72, -0.004), (az_t * 0.7, 52, 0.016), (az_t, 30, 0.016), (az_t - 4, el_t, 0.008)], 0.036, 0.011))
    # arrière: depuis l'épi vers la nuque
    for az in (166, 194):
        specs.append(([(178, 66, -0.004), (az, 40, 0.014), (az, 5, 0.014), (az, -22, 0.006)], 0.04, 0.011))
    # mèches folles: épi qui se dresse, une au front, une à la nuque
    specs.append(([(176, 70, 0.012), (176, 80, 0.035), (150, 84, 0.05)], 0.014, 0.008))
    specs.append(([(part + 30, 40, 0.024), (part + 40, 32, 0.034), (part + 46, 27, 0.03)], 0.012, 0.007))
    specs.append(([(150, -10, 0.012), (146, -24, 0.02), (140, -30, 0.02)], 0.012, 0.006))
    hair_strands(g, hc, R, specs, kfn)


# Casquette de Firmin -------------------------------------------------------------------------------------------

def cap_firmin(g, hc):
    """Casquette de chef de halte: bandeau rouge épais, calotte qui s'évase, coutures sur le dessus, visière noire à
    tranche, écusson et bouton de laiton. Le bord relevé devant laisse voir les yeux à 35 degrés."""
    top = hc + 0.088
    out = []
    band = T.loft(g, [(top - 0.012, 0.176, 0.178, 0.176), (top + 0.004, 0.182, 0.184, 0.18),
                      (top + 0.04, 0.183, 0.185, 0.181), (top + 0.05, 0.178, 0.18, 0.176)], "extra_b", n=20, bone="head",
                  close_bottom=False)
    out += [v for r in band for v in r]
    crown = T.loft(g, [(top + 0.045, 0.176, 0.178, 0.174), (top + 0.085, 0.196, 0.2, 0.19),
                       (top + 0.112, 0.198, 0.204, 0.19), (top + 0.13, 0.17, 0.176, 0.162),
                       (top + 0.137, 0.09, 0.09, 0.085), (top + 0.139, 0.02, 0.02, 0.02)], "extra_a", n=20, bone="head",
                   close_top=True)
    cv = [v for r in crown for v in r]
    out += cv
    # coutures du dessus: quatre lignes en croix (couleur de sommets plus sombre le long des méridiens)
    for v in cv:
        a = math.atan2(v.co.x, -v.co.y)
        k = min(abs(math.sin(2 * a)), 1.0)
        if v.co.z > top + 0.1:
            T.mul(g, v, 0.78 + 0.22 * min(1.0, k * 3))
    # dessous de l'évasement plus sombre (ombre portée de la calotte sur le bandeau)
    for v in out:
        if top + 0.03 < v.co.z < top + 0.06:
            T.mul(g, v, 0.8)
    # visière: deux couches courbes et une tranche
    rows = []
    for j, (r, dz) in enumerate(((0.168, 0.0), (0.21, -0.003), (0.24, -0.008))):
        row = []
        for k in range(9):
            a = math.radians(-62 + 124 * k / 8)
            row.append((r * math.sin(a), -r * 0.98 * math.cos(a), top + 0.008 + dz))
        rows.append(row)
    bm = g.bm
    vis_top = [[bm.verts.new(p) for p in r] for r in rows]
    vis_bot = [[bm.verts.new((p[0], p[1], p[2] - 0.009)) for p in r] for r in rows]
    for i in range(2):
        for k in range(8):
            bm.faces.new((vis_top[i][k], vis_top[i + 1][k], vis_top[i + 1][k + 1], vis_top[i][k + 1]))
            bm.faces.new((vis_bot[i][k], vis_bot[i][k + 1], vis_bot[i + 1][k + 1], vis_bot[i + 1][k]))
    for k in range(8):
        bm.faces.new((vis_top[2][k], vis_bot[2][k], vis_bot[2][k + 1], vis_top[2][k + 1]))
    for i in range(2):
        for k in (0, 8):
            bm.faces.new((vis_top[i][k], vis_bot[i][k], vis_bot[i + 1][k], vis_top[i + 1][k]))
    vv = [v for r in vis_top + vis_bot for v in r]
    T.fix_normals(g, vv)
    # bord relevé devant: rotation autour du centre de la tête
    M = Matrix.Translation((0, 0, top)) @ Matrix.Rotation(math.radians(-24), 4, "X") @ Matrix.Translation((0, 0, -top))
    g.transform(vv, M)
    g._finish(vv, "eye", "head", None, False)
    for v in vv:
        if v.co.z < top:
            T.mul(g, v, 0.75)
    # écusson de laiton et bouton du dessus
    loc = Vector((0, -0.186, top + 0.07))
    T.ellipsoid(g, tuple(loc), (0.02, 0.006, 0.016), "metal", segs=6, rings=3, bone="head")
    T.ellipsoid(g, (0, 0, top + 0.14), (0.012, 0.012, 0.006), "extra_a", segs=8, rings=4, bone="head")
    T.tag(g, "cap", out + vv)
    return out


# Mains et pieds ----------------------------------------------------------------------------------------------

def hand(g, gab, side, color="skin", k=1.0):
    """Main détendue (fiche 4.6): paume, index à part, trois doigts groupés, pouce; doigts à demi fléchis. Paume
    tournée vers la cuisse. Liée à l'os de la main."""
    s = 1 if side == "l" else -1
    b = "hand_" + side
    w = J(gab, "hand_" + side)
    d = (J(gab, "hand_" + side, "tail") - w).normalized()
    out = []
    pc = w + d * 0.04 * k
    out += T.ellipsoid(g, tuple(pc), (0.019 * k, 0.04 * k, 0.046 * k), color, segs=8, rings=5, bone=b)
    # doigts: trois groupés (dos de la main vers l'extérieur), index devant, à demi fléchis vers la paume
    base = pc + d * 0.036 * k
    curl = Vector((-s * 0.012, 0, 0))
    for dy, r, ln in ((0.012, 0.016, 1.0), (-0.024, 0.0105, 1.04)):
        p0 = base + Vector((s * 0.002, dy * k, 0))
        p1 = p0 + d * 0.024 * k * ln + curl * 0.3
        p2 = p1 + d * 0.016 * k * ln + curl * 0.9
        p3 = p2 + d * 0.006 * k + curl * 0.9
        out += T.tube(g, [p0, (p1 + p2) / 2, p3], [r * k, r * k * 0.9, r * k * 0.6], color, n=6, bone=b,
                      flat=0.7 if dy > 0 else 0.95, up=(s, 0, 0))
    # pouce: part du haut de la paume, vers l'avant et le bas, côté intérieur
    t0 = pc + Vector((-s * 0.008, -0.03 * k, 0.012 * k))
    t1 = t0 + Vector((-s * 0.008, -0.014 * k, -0.018 * k))
    t2 = t1 + Vector((-s * 0.004, -0.004 * k, -0.016 * k))
    out += T.tube(g, [t0, t1, t2], [0.011 * k, 0.0095 * k, 0.007 * k], color, n=6, bone=b)
    T.tag(g, "hands", out)
    return out


def shoe(g, gab, side, color="shoes", sole="eye", heel=0.02, k=1.0, strap=None):
    """Chaussure: empeigne arrondie au bout un peu relevé, semelle plus sombre en tranche, talon."""
    x = J(gab, "thigh_" + side).x
    b = "foot_" + side
    out = []

    def deform(p):
        # bout relevé et dessus aplati vers l'arrière
        if p.y < -0.5:
            p.z += 0.12 * (-p.y - 0.5)
        return p
    vs = T.ellipsoid(g, (x, -0.04, 0.05), (0.05 * k, 0.122 * k, 0.046), color, segs=8, rings=6, bone=b, deform=deform)
    for v in vs:
        if v.co.z < 0.014:
            v.co.z = 0.014
    out += vs
    # semelle: dalle arrondie de 1,4 cm, tranche vive
    rings = [(0.0, 0.052 * k, 0.128 * k, 0.128 * k, 2.4, x, -0.042), (0.016, 0.054 * k, 0.13 * k, 0.13 * k, 2.4, x, -0.042)]
    sv = T.loft(g, rings, sole, n=12, bone=b, close_bottom=True, close_top=True, smooth=False)
    out += [v for r in sv for v in r]
    if heel:
        hv = T.loft(g, [(0.0, 0.036, 0.03, 0.03, 3.0, x, 0.052), (heel + 0.014, 0.038, 0.032, 0.032, 3.0, x, 0.05)], sole,
                    n=8, bone=b, close_bottom=True, close_top=True, smooth=False)
        out += [v for r in hv for v in r]
    if strap:
        out += T.tube(g, [Vector((x - 0.048, -0.03, 0.07)), Vector((x, -0.034, 0.093)), Vector((x + 0.048, -0.03, 0.07))],
                      [0.006, 0.006, 0.006], strap, n=6, bone=b, flat=0.4, up=(0, -1, 0))
    T.tag(g, "shoes", out)
    return out


def arm_tube(g, gab, side, part, radii, color, t0=0.0, t1=1.0, n=10, close=(False, False)):
    """Tube le long d'un os du bras (part: upper_arm ou forearm) de t0 à t1 de sa longueur."""
    b = part + "_" + side
    h, t = J(gab, b), J(gab, b, "tail")
    pts = [h.lerp(t, t0 + (t1 - t0) * i / (len(radii) - 1)) for i in range(len(radii))]
    return T.tube(g, pts, radii, color, n=n, bone=b, cap0=close[0], cap1=close[1])


def leg_tube(g, gab, side, part, radii, color, t0=0.0, t1=1.0, n=10, close=(False, False), dy=None):
    b = part + "_" + side
    h, t = J(gab, b), J(gab, b, "tail")
    pts = [h.lerp(t, t0 + (t1 - t0) * i / (len(radii) - 1)) for i in range(len(radii))]
    if dy:
        pts = [p + Vector((0, dy[i], 0)) for i, p in enumerate(pts)]
    return T.tube(g, pts, radii, color, n=n, bone=b, cap0=close[0], cap1=close[1])


# Colette ------------------------------------------------------------------------------------------------------

COLETTE_TORSO = [(0.97, 0.15, 0.126, 0.118, 2.3), (1.02, 0.152, 0.13, 0.118, 2.3), (1.08, 0.165, 0.143, 0.124, 2.3),
                 (1.15, 0.176, 0.158, 0.127, 2.3), (1.21, 0.178, 0.153, 0.125, 2.3), (1.265, 0.171, 0.137, 0.121, 2.3),
                 (1.3, 0.152, 0.117, 0.109, 2.2), (1.335, 0.108, 0.088, 0.086, 2.0), (1.362, 0.066, 0.06, 0.06, 2.0)]
SKIRT = {"top": 1.0, "hem": 0.43, "prof": [(1.0, 0.172), (0.92, 0.2), (0.8, 0.228), (0.65, 0.262), (0.52, 0.294),
                                            (0.45, 0.31)], "pleats": 12}


def skirt_r(z, a):
    """Rayon extérieur de la jupe de Colette (plis compris) à la hauteur z, azimut a."""
    prof = SKIRT["prof"]
    r = prof[-1][1]
    for (z0, r0), (z1, r1) in zip(prof, prof[1:]):
        if z1 <= z <= z0:
            r = r0 + (r1 - r0) * (z0 - z) / (z0 - z1)
            break
    t = max(0.0, min(1.0, (SKIRT["top"] - z) / (SKIRT["top"] - SKIRT["hem"])))
    return r * (1 + 0.05 * t ** 1.2 * math.cos(SKIRT["pleats"] * a)), t


def front_y(rings, z):
    for a, b in zip(rings, rings[1:]):
        if a[0] <= z <= b[0]:
            t = (z - a[0]) / (b[0] - a[0])
            return -(a[2] + (b[2] - a[2]) * t)
    return -rings[-1][2]


def colette(g, expr):
    gab = "rond"
    hc = head_center(gab)
    surf = head_and_face(g, "colette", expr, hc, ears=False)
    hair_colette(g, hc)
    V.paint_face(g, "colette", hc, under_shadow=(0.052, 0.022, 0.2))
    # cou
    T.tag(g, "neck", T.loft(g, [(1.33, 0.048, 0.046, 0.05), (1.40, 0.046, 0.044, 0.048), (hc - 0.08, 0.05, 0.048, 0.052)],
                            "skin", n=12, bone="neck")[0])
    # buste de la robe
    tr = T.loft(g, COLETTE_TORSO, "top", n=18, weights=torso_w())
    torso_v = [v for r in tr for v in r]
    T.tag(g, "torso", torso_v)
    tsurf = T.Surface(torso_v)
    # jupe plissée, ourlet ondulé retourné (épaisseur visible d'en dessous)
    n = 32
    hem = SKIRT["hem"]
    zs = [hem + 0.014, hem, hem + 0.06, 0.52, 0.65, 0.8, 0.92, SKIRT["top"]]
    grid = []
    bm = g.bm
    for i, z in enumerate(zs):
        ring = []
        for k in range(n):
            a = 2 * math.pi * k / n
            r, t = skirt_r(z, a)
            zz = z
            if i <= 1:
                zz += 0.012 * math.sin(3 * a + 0.5) + 0.005 * math.sin(7 * a + 1.3)
            if i == 0:
                r *= 0.955
            ring.append(bm.verts.new((r * math.sin(a), -r * 0.9 * math.cos(a), zz)))
        grid.append(ring)
    for i in range(len(grid) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((grid[i][k], grid[i][k2], grid[i + 1][k2], grid[i + 1][k]))
    sk = [v for r in grid for v in r]
    sw = PP.skirt_weights(SKIRT["top"], hem, 0.31)
    g._finish(sk, "bottom", None, sw)
    T.fix_normals(g, sk)
    T.tag(g, "skirt", sk)
    for i, ring in enumerate(grid):
        for k, v in enumerate(ring):
            a = 2 * math.pi * k / n
            t = max(0.0, min(1.0, (SKIRT["top"] - v.co.z) / (SKIRT["top"] - hem)))
            valley = (1 - math.cos(SKIRT["pleats"] * a)) / 2
            T.mul(g, v, 1.0 - 0.22 * valley * t ** 0.8)
            if i == 0:
                T.mul(g, v, 0.55)
    ssurf = T.Surface(sk)
    # tablier noir court, plaqué sur la jupe; ourlet, poche à surpiqûre crème, cordon et noeud dans le dos
    colette_apron(g, ssurf)
    # col claudine (deux rabats ronds), boutons, manches retroussées
    for s in (1, -1):
        z = 1.338
        y = front_y(COLETTE_TORSO, z) - 0.006
        vs = T.ellipsoid(g, (s * 0.046, y, z), (0.05, 0.011, 0.032), "top_trim", segs=8, rings=4, bone="chest",
                         rot=(-40, 0, s * 26))
        T.tag(g, "collar", vs)
    T.loft(g, [(1.345, 0.078, 0.07, 0.074), (1.37, 0.07, 0.064, 0.068)], "top_trim", n=16, bone="chest",
           close_bottom=False, close_top=False)
    for z in (1.18, 1.235, 1.29):
        loc, nrm = tsurf.hit(Vector((0, -1, z)), Vector((0, 1, 0)))
        b = T.ellipsoid(g, tuple(loc + nrm * 0.002), (0.008, 0.004, 0.008), "top_trim", segs=8, rings=4, bone="chest")
        T.mul(g, b[len(b) // 2], 0.6)
    for side in ("l", "r"):
        s = 1 if side == "l" else -1
        sh = J(gab, "upper_arm_" + side)
        T.tag(g, "sleeve", T.ellipsoid(g, tuple(sh + Vector((s * 0.002, 0, -0.022))), (0.07, 0.066, 0.064), "top", segs=10,
                                       rings=6, bone="upper_arm_" + side))
        T.tag(g, "sleeve", arm_tube(g, gab, side, "upper_arm", [0.074, 0.077, 0.075], "top", 0.0, 0.5, n=8))
        # revers de la manche retroussée: anneau épais, dessous ombré
        cuff = arm_tube(g, gab, side, "upper_arm", [0.071, 0.078, 0.079, 0.073], "top_trim", 0.46, 0.6,
                        n=8, close=(True, True))
        for v in cuff:
            T.mul(g, v, 0.9)
        T.tag(g, "skin_arm", arm_tube(g, gab, side, "upper_arm", [0.054, 0.05, 0.047], "skin", 0.45, 1.02, n=8))
        T.tag(g, "skin_arm", T.ellipsoid(g, tuple(J(gab, "forearm_" + side)), (0.047, 0.047, 0.05), "skin", segs=8, rings=5,
                                         bone="forearm_" + side))
        T.tag(g, "skin_arm", arm_tube(g, gab, side, "forearm", [0.047, 0.045, 0.038, 0.033], "skin", 0.0, 1.0, n=8))
        hand(g, gab, side)
        # jambes: bas sombres, chaussures à bride
        leg_tube(g, gab, side, "thigh", [0.078, 0.064], "hair_dark", 0.0, 1.0, n=6, close=(True, False))
        T.ellipsoid(g, tuple(J(gab, "shin_" + side)), (0.058, 0.058, 0.06), "hair_dark", segs=6, rings=4,
                    bone="shin_" + side)
        leg_tube(g, gab, side, "shin", [0.056, 0.058, 0.04, 0.034], "hair_dark", 0.0, 0.98, n=8, dy=[0, 0.005, 0.004, 0])
        shoe(g, gab, side, "shoes", "extra_b", heel=0.022, k=0.93, strap="shoes")
    torchon(g, tsurf)
    # plis peints: sous la poitrine, à la taille, au pli du coude
    for v in torso_v:
        if 1.03 < v.co.z < 1.1:
            T.mul(g, v, 0.92)
    return surf


def colette_apron(g, ssurf):
    zt, zb = 1.0, 0.66
    nr, nc = 5, 7
    rows = []
    for r in range(nr):
        z = zb + (zt - zb) * r / (nr - 1)
        hw = (0.165 + (0.135 - 0.165) * r / (nr - 1))
        row = []
        for c in range(nc):
            u = -1 + 2 * c / (nc - 1)
            x = u * hw
            dz = (0.01 * math.cos(u * math.pi * 1.5) + 0.02 * u ** 4) if r == 0 else 0.0
            row.append((x, -1.0, z + dz))
        rows.append(row)
    gv = T.grid_piece(g, rows, "extra_a", weights=PP.skirt_weights(1.0, 0.43, 0.31))
    verts = [v for r in gv for v in r]
    # plaqué sur le sommet des plis (le tablier passe par-dessus), 6 mm devant
    for v in verts:
        best = None
        for k in range(-3, 4):
            a = math.atan2(v.co.x, 0.3) + k * 0.02
            r, _ = skirt_r(v.co.z, a)
            rr = max(skirt_r(v.co.z, a + j * 0.04)[0] for j in range(-4, 5))
            best = rr if best is None else max(best, rr)
        a = math.asin(max(-1.0, min(1.0, v.co.x / best)))
        v.co.y = -best * 0.9 * math.cos(a) - 0.006
    # épaisseur: dos du tablier et tranche
    bm = g.bm
    back = [[bm.verts.new(v.co + Vector((0, 0.005, 0))) for v in r] for r in gv]
    for i in range(nr - 1):
        for c in range(nc - 1):
            bm.faces.new((back[i][c], back[i][c + 1], back[i + 1][c + 1], back[i + 1][c])).normal_flip()
    edges = [(gv[0][c], gv[0][c + 1], back[0][c + 1], back[0][c]) for c in range(nc - 1)]
    edges += [(gv[i][0], back[i][0], back[i + 1][0], gv[i + 1][0]) for i in range(nr - 1)]
    edges += [(gv[i][nc - 1], gv[i + 1][nc - 1], back[i + 1][nc - 1], back[i][nc - 1]) for i in range(nr - 1)]
    for q in edges:
        bm.faces.new(q)
    bv = [v for r in back for v in r]
    allv = verts + bv
    T.fix_normals(g, allv)
    g._finish(bv, "extra_a", None, PP.skirt_weights(1.0, 0.43, 0.31))
    T.tag(g, "apron", allv)
    asurf = T.Surface(verts)
    # ourlet: tirets à 1,2 cm du bas; poche à droite (vue de face, côté droit du personnage)
    hem = [(-0.16 + 0.32 * k / 30, -0.5, zb + 0.016 + 0.01 * math.cos((-1 + 2 * k / 30) * math.pi * 1.5)) for k in range(31)]
    T.dashes(g, asurf, hem, "scarf", direction=(0, 1, 0), weights=PP.skirt_weights(1.0, 0.43, 0.31))
    px, pz, pw, ph = -0.075, 0.79, 0.085, 0.07
    pocket = [(px - pw / 2 + pw * k / 6, -1.0, pz - ph / 2) for k in range(7)]
    prow = [pocket, [(x, y, pz + ph / 2) for x, y, z in pocket]]
    pg = T.grid_piece(g, prow, "extra_a", weights=PP.skirt_weights(1.0, 0.43, 0.31))
    pv = [v for r in pg for v in r]
    asurf.plate(g, pv, offset=0.0035)
    for v in pg[1]:
        T.mul(g, v, 0.7)
    path = [(px - pw / 2 + 0.006, -0.5, pz + ph / 2 - 0.006), (px - pw / 2 + 0.006, -0.5, pz - ph / 2 + 0.006),
            (px + pw / 2 - 0.006, -0.5, pz - ph / 2 + 0.006), (px + pw / 2 - 0.006, -0.5, pz + ph / 2 - 0.006)]
    T.dashes(g, asurf, path, "scarf", dash=0.009, gap=0.006, offset=0.0052, direction=(0, 1, 0),
             weights=PP.skirt_weights(1.0, 0.43, 0.31))
    # cordon à la taille et noeud dans le dos
    T.loft(g, [(0.985, 0.158, 0.135, 0.124), (1.012, 0.158, 0.135, 0.124)], "extra_a", n=20, bone="hips",
           close_bottom=False, close_top=False)
    for s in (1, -1):
        T.ellipsoid(g, (s * 0.04, 0.132, 1.0), (0.035, 0.012, 0.022), "extra_a", segs=6, rings=4, bone="hips",
                    rot=(0, s * 20, 0))
        T.tube(g, [Vector((s * 0.01, 0.13, 0.995)), Vector((s * 0.03, 0.142, 0.93)), Vector((s * 0.035, 0.15, 0.87))],
               [0.009, 0.009, 0.007], "extra_a", n=6, weights=PP.skirt_weights(1.0, 0.43, 0.31), flat=0.35,
               up=(0, 1, 0))
    T.ellipsoid(g, (0, 0.134, 1.0), (0.014, 0.012, 0.014), "extra_a", segs=8, rings=5, bone="hips")
    return allv


def torchon(g, tsurf):
    """Torchon rayé sur l'épaule gauche: un pan devant, un pan dans le dos, deux rayures bleues aux bouts."""
    x = 0.128
    zs_f = [1.17, 1.24, 1.3]
    pts = []
    for z in zs_f:
        loc, nrm = tsurf.hit(Vector((x, -1, z)), Vector((0, 1, 0)))
        pts.append((loc + nrm * 0.008, nrm))
    pts.append((Vector((x, -0.085, 1.352)), Vector((0, -0.6, 0.8)).normalized()))
    pts.append((Vector((x, -0.02, 1.378)), Vector((0, 0, 1))))
    pts.append((Vector((x, 0.05, 1.37)), Vector((0, 0.5, 0.86)).normalized()))
    pts.append((Vector((x, 0.11, 1.33)), Vector((0, 0.9, 0.4)).normalized()))
    for z in (1.27, 1.2, 1.13):
        loc, nrm = tsurf.hit(Vector((x, 1, z)), Vector((0, -1, 0)))
        pts.append((loc + nrm * 0.008, nrm))
    n = len(pts)
    bm = g.bm
    w, th = 0.042, 0.005
    secs = []
    for i, (p, nrm) in enumerate(pts):
        t = (pts[min(i + 1, n - 1)][0] - pts[max(i - 1, 0)][0]).normalized()
        side = nrm.cross(t).normalized()
        nn = t.cross(side).normalized()
        if nn.dot(nrm) < 0:
            nn = -nn
        secs.append([bm.verts.new(p + side * w + nn * th), bm.verts.new(p - side * w + nn * th),
                     bm.verts.new(p - side * w - nn * th), bm.verts.new(p + side * w - nn * th)])
    for i in range(n - 1):
        a, b = secs[i], secs[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bm.faces.new(secs[0])
    bm.faces.new(list(reversed(secs[-1])))
    vs = [v for s in secs for v in s]
    T.fix_normals(g, vs)

    def col(face):
        c = face.calc_center_median()
        return "scarf_mark" if any(abs(c.z - zz) < 0.012 for zz in (1.2, 1.15)) else "scarf"
    g._finish(vs, col, "chest", None, False)
    # rayures: deux bandes près de chaque bout (faces recoloriées par la hauteur)
    T.tag(g, "torchon", vs)
    return vs


# Firmin -------------------------------------------------------------------------------------------------------

FIRMIN_TORSO = [(0.775, 0.17, 0.142, 0.13, 2.3), (0.79, 0.178, 0.15, 0.135, 2.3), (0.84, 0.182, 0.156, 0.135, 2.3),
                (0.92, 0.188, 0.158, 0.135, 2.3), (1.0, 0.192, 0.163, 0.136, 2.3), (1.08, 0.194, 0.162, 0.136, 2.3),
                (1.16, 0.196, 0.158, 0.138, 2.3), (1.24, 0.196, 0.153, 0.139, 2.3), (1.29, 0.197, 0.139, 0.131, 2.2),
                (1.322, 0.178, 0.12, 0.116, 2.1), (1.348, 0.122, 0.093, 0.091, 2.0), (1.37, 0.072, 0.066, 0.066, 2.0)]


def firmin(g, expr):
    gab = "trapu"
    hc = head_center(gab)
    surf = head_and_face(g, "firmin", expr, hc, ears=True, ear_z=-0.016)
    hair_firmin_sides(g, hc)
    mustache_firmin(g, hc, surf)
    cap_firmin(g, hc)
    V.paint_face(g, "firmin", hc, under_shadow=(0.078, 0.03, 0.28))
    T.tag(g, "neck", T.loft(g, [(1.31, 0.054, 0.05, 0.056), (1.38, 0.053, 0.05, 0.054), (hc - 0.085, 0.056, 0.052, 0.058)],
                            "skin", n=12, bone="neck")[0])
    # veste de cheminot: ourlet retourné, devant croisé, boutons de laiton, col rabattu, trois poches à rabat
    # premier anneau: revers intérieur de l'ourlet (plus haut et en retrait), vu d'en dessous comme une épaisseur
    tr = T.loft(g, [(0.79, 0.168, 0.14, 0.126, 2.3), (0.775, 0.178, 0.15, 0.135, 2.3)] + FIRMIN_TORSO[2:], "top",
                n=20, weights=torso_w(0.93, 1.0, 1.1, 1.18))
    torso_v = [v for r in tr for v in r]
    for v in tr[0]:
        T.mul(g, v, 0.55)
    T.tag(g, "torso", torso_v)
    tsurf = T.Surface(torso_v)
    tw = torso_w(0.93, 1.0, 1.1, 1.18)
    # patte de boutonnage (le pan gauche croise sur le droit): bande en relief et ombre à côté
    pts = []
    for z in [0.785 + k * (1.32 - 0.785) / 12 for k in range(13)]:
        loc, nrm = tsurf.hit(Vector((0.012, -1, z)), Vector((0, 1, 0)))
        pts.append(loc + nrm * 0.0035)
    lft, rgt = T.strip(g, pts, [0.03] * len(pts), "top", lambda p: tsurf.hit(Vector((p.x, -1, p.z)), Vector((0, 1, 0)))[1],
                       weights=tw)
    for v in torso_v:
        if v.co.y < 0 and -0.01 < v.co.x < 0.004:
            T.mul(g, v, 0.7)
    for z in (0.86, 0.99, 1.12, 1.25):
        loc, nrm = tsurf.hit(Vector((0.012, -1, z)), Vector((0, 1, 0)))
        T.tag(g, "buttons", T.ellipsoid(g, tuple(loc + nrm * 0.006), (0.011, 0.006, 0.011), "metal", segs=6, rings=3,
                                        weights=lambda co, z=z: tw(Vector((0, 0, z)))))
    # col rabattu
    for s in (1, -1):
        z = 1.33
        y = -0.105
        vs = T.ellipsoid(g, (s * 0.05, y, z), (0.05, 0.012, 0.036), "top_trim", segs=8, rings=4, bone="chest",
                         rot=(-42, 0, s * 30))
        for v in vs:
            if v.co.z < z - 0.02:
                v.co.x += s * 0.006
    T.loft(g, [(1.34, 0.085, 0.078, 0.08), (1.385, 0.074, 0.068, 0.072)], "top_trim", n=16, bone="chest",
           close_bottom=False, close_top=False)
    # poches: une de poitrine à gauche, deux basses
    for (px, pz, pw, ph, flap) in ((0.09, 1.2, 0.08, 0.075, True), (0.1, 0.88, 0.1, 0.09, True), (-0.1, 0.88, 0.1, 0.09, True)):
        pocket(g, tsurf, px, pz, pw, ph, "top", tw)
    # chaîne de la montre de l'oncle Émile: du troisième bouton à la poche basse gauche
    pts = []
    for k in range(9):
        t = k / 8
        x = 0.014 + (0.075 - 0.014) * t
        z = 1.0 + (0.925 - 1.0) * t - 0.03 * math.sin(math.pi * t)
        loc, nrm = tsurf.hit(Vector((x, -1, z)), Vector((0, 1, 0)))
        pts.append(loc + nrm * 0.008)
    T.tag(g, "chain", T.tube(g, pts, [0.0032] * 9, "metal", n=5, weights=tw))
    # bas de la veste: surpiqûre de l'ourlet
    path = []
    for k in range(73):
        a = 2 * math.pi * k / 72
        x, y = T.section(0.178, 0.15, 0.135, a, 2.3)
        path.append((x * 1.1, y * 1.1, 0.8))
    T.dashes(g, tsurf, path, "top_trim", weights=tw)
    # manches longues, coudes, poignets épais
    for side in ("l", "r"):
        s = 1 if side == "l" else -1
        sh = J(gab, "upper_arm_" + side)
        T.tag(g, "sleeve", T.ellipsoid(g, tuple(sh + Vector((-s * 0.012, 0, -0.034))), (0.07, 0.068, 0.062), "top", segs=8,
                                       rings=6, bone="upper_arm_" + side))
        T.tag(g, "sleeve", arm_tube(g, gab, side, "upper_arm", [0.068, 0.07, 0.066, 0.062], "top", 0.0, 1.02, n=8))
        el = T.ellipsoid(g, tuple(J(gab, "forearm_" + side)), (0.061, 0.06, 0.064), "top", segs=8, rings=5,
                         bone="forearm_" + side)
        T.tag(g, "sleeve", el)
        fa = arm_tube(g, gab, side, "forearm", [0.06, 0.059, 0.055, 0.052], "top", 0.0, 0.92, n=8)
        T.tag(g, "sleeve", fa)
        # pli de compression au creux du coude (couleur de sommets)
        e = J(gab, "forearm_" + side)
        for v in el + fa:
            if v.co.y < e.y - 0.01 and abs(v.co.z - e.z) < 0.05:
                T.mul(g, v, 0.82)
        cuff = arm_tube(g, gab, side, "forearm", [0.057, 0.06, 0.06, 0.056], "top_trim", 0.84, 0.99, n=8, close=(True, True))
        T.tag(g, "cuff", cuff)
        hand(g, gab, side, k=1.06)
        # pantalon: jambes droites, pli marqué devant (couleur de sommets), cassure sur la chaussure
        th = leg_tube(g, gab, side, "thigh", [0.092, 0.084, 0.074], "bottom", 0.0, 1.0, n=8, close=(True, False))
        kn = T.ellipsoid(g, tuple(J(gab, "shin_" + side)), (0.074, 0.074, 0.075), "bottom", segs=8, rings=5,
                         bone="shin_" + side)
        sh_ = leg_tube(g, gab, side, "shin", [0.073, 0.068, 0.066, 0.07], "bottom", 0.0, 0.96, n=8)
        x0 = J(gab, "thigh_" + side).x
        for v in th + kn + sh_:
            if v.co.y < 0 and abs(v.co.x - x0) < 0.012:
                T.mul(g, v, 0.86)
        T.tag(g, "legs", th + kn + sh_)
        shoe(g, gab, side, "shoes", "eye", heel=0.02, k=1.05)
    # pantalon visible sous la veste (entrejambe)
    T.loft(g, [(0.74, 0.16, 0.13, 0.12), (0.82, 0.17, 0.14, 0.125)], "bottom", n=16, bone="hips", close_bottom=True)
    return surf


def pocket(g, surf, px, pz, pw, ph, color, weights):
    """Poche plaquée à rabat: corps en léger relief, rabat épais qui projette une ombre, surpiqûre sur trois côtés."""
    y = -1.0
    rows = [[(px - pw / 2 + pw * k / 3, y, pz - ph / 2) for k in range(4)],
            [(px - pw / 2 + pw * k / 3, y, pz + ph * 0.25) for k in range(4)]]
    gv = T.grid_piece(g, rows, color, weights=weights)
    pv = [v for r in gv for v in r]
    surf.plate(g, pv, offset=0.0028)
    flap = [[(px - pw / 2 - 0.004 + (pw + 0.008) * k / 5, y, pz + ph * 0.18 - (0.012 if 0 < k < 5 else 0.0)) for k in range(6)],
            [(px - pw / 2 - 0.004 + (pw + 0.008) * k / 5, y, pz + ph / 2) for k in range(6)]]
    fg = T.grid_piece(g, flap, color, weights=weights)
    fv = [v for r in fg for v in r]
    surf.plate(g, fv, offset=0.0055)
    # sous le rabat: plus sombre
    for v in gv[1]:
        T.mul(g, v, 0.66)
    path = [(px - pw / 2 + 0.006, -0.5, pz + ph * 0.18), (px - pw / 2 + 0.006, -0.5, pz - ph / 2 + 0.006),
            (px + pw / 2 - 0.006, -0.5, pz - ph / 2 + 0.006), (px + pw / 2 - 0.006, -0.5, pz + ph * 0.18)]
    T.dashes(g, surf, path, "top_trim", dash=0.011, gap=0.007, width=0.0026, offset=0.0042, direction=(0, 1, 0),
             weights=weights)
    return pv + fv


# Joueur --------------------------------------------------------------------------------------------------------

def player_base(g, expr):
    """Corps du joueur: tête lisse et visage peint, mains détendues; corps nu-neutre de garde_robe (inchangé, les
    vêtements gardent leur enveloppe)."""
    gab = "moyen"
    hc = PP.PHC
    head_and_face(g, "player", expr, hc, ears=True)
    V.paint_face(g, "player", hc)
    PP.neck(g)
    for side in ("l", "r"):
        hand(g, gab, side)
    GR.body(g, PP)


def player_hair_short(g, expr):
    hair_player_short(g, PP.PHC)


def player_hair_short_hat(g, expr):
    # sous un chapeau seuls la lisière et la nuque se voient: la calotte suffit (comme les autres variantes _hat,
    # construites sans mèches)
    hair_player_short(g, PP.PHC, strands=False)
    GR.flatten_under_hat(g, PP.PHC, *PP.PHEAD)


def chemise(g, expr):
    """Chemise du joueur (wear_top_chemise): même enveloppe; patte de boutonnage surpiquée, poche de poitrine
    surpiquée (tirets ton sur ton), coutures de côté et plis peints (aisselles, coude, taille)."""
    GR.top(g, PP, "chemise")
    torso = [v for v in g.bm.verts if v.co.z > 0.95 and abs(v.co.x) < 0.2 and v.co.z < 1.4]
    tsurf = T.Surface(torso)
    # patte de boutonnage: bande en relief
    pts = []
    for z in [0.97 + k * 0.03 for k in range(14)]:
        loc, nrm = tsurf.hit(Vector((0.0, -1, z)), Vector((0, 1, 0)))
        if loc is not None:
            pts.append(loc + nrm * 0.0025)
    T.strip(g, pts, [0.026] * len(pts), "top_p", lambda p: tsurf.hit(Vector((p.x, -1, p.z)), Vector((0, 1, 0)))[1],
            weights=PP.torso_weights)
    for side_x in (-0.013, 0.013):
        path = [(side_x, -0.5, z) for z in (0.975, 1.36)]
        T.dashes(g, tsurf, path, "top_p", dash=0.009, gap=0.006, width=0.002, offset=0.0035, direction=(0, 1, 0),
                 weights=PP.torso_weights, darken=0.6)
    # poche de poitrine (droite du personnage), surpiqûre
    px, pz, pw, ph = -0.085, 1.17, 0.075, 0.07
    path = [(px - pw / 2 + 0.005, -0.5, pz + ph / 2), (px - pw / 2 + 0.005, -0.5, pz - ph / 2 + 0.005),
            (px + pw / 2 - 0.005, -0.5, pz - ph / 2 + 0.005), (px + pw / 2 - 0.005, -0.5, pz + ph / 2)]
    T.dashes(g, tsurf, path, "top_p", dash=0.008, gap=0.005, width=0.002, offset=0.0105, direction=(0, 1, 0),
             weights=PP.torso_weights, darken=0.6)
    paint_garment(g, "top")


def pantalon(g, expr):
    """Pantalon du joueur (wear_bottom_pantalon): passants de ceinture, braguette et poches surpiquées, coutures de
    côté et pli devant peints, plis derrière le genou."""
    GR.bottom(g, PP, "pantalon")
    pel = [v for v in g.bm.verts if 0.78 < v.co.z < 1.01]
    psurf = T.Surface(pel)
    # passants de ceinture
    for a in (-60, -20, 20, 60, 150, 210):
        r = math.radians(a)
        loc, nrm = psurf.hit(Vector((math.sin(r), -math.cos(r), 0.985)), Vector((-math.sin(r), math.cos(r), 0)))
        if loc is not None:
            g.box((0.012, 0.006, 0.05), loc=tuple(loc + nrm * 0.004), color="bottom_p", rot=(0, 0, -a), bone="hips",
                  smooth=False)
    # braguette en J et poches de devant en arc
    fly = [(0.012, -0.5, 0.96), (0.012, -0.5, 0.86), (0.002, -0.5, 0.835)]
    T.dashes(g, psurf, fly, "bottom_p", dash=0.008, gap=0.005, width=0.002, direction=(0, 1, 0), bone="hips", darken=0.6)
    for s in (1, -1):
        arc = [(s * (0.06 + 0.06 * math.sin(math.pi / 2 * t)), -0.5, 0.96 - 0.07 * (1 - math.cos(math.pi / 2 * t)))
               for t in [k / 6 for k in range(7)]]
        T.dashes(g, psurf, arc, "bottom_p", dash=0.008, gap=0.005, width=0.002, direction=(0, 1, 0), bone="hips", darken=0.6)
    paint_garment(g, "bottom")


def paint_garment(g, kind):
    """Plis et coutures peints sur une pièce du joueur (couleurs de sommets, multipliées à la teinte choisie)."""
    for v in g.bm.verts:
        x, y, z = v.co
        if kind == "top":
            # coutures de côté
            if abs(abs(x) - 0.17) < 0.012 and 0.95 < z < 1.3:
                T.mul(g, v, 0.84)
            # aisselles et creux du coude
            if 1.18 < z < 1.27 and 0.12 < abs(x) < 0.2:
                T.mul(g, v, 0.86)
            if 1.02 < z < 1.11 and abs(x) > 0.18 and y < -0.01:
                T.mul(g, v, 0.84)
            if 0.95 < z < 1.0 and abs(x) < 0.2:
                T.mul(g, v, 0.9)
        else:
            if abs(abs(x) - 0.092) > 0.06 and z < 0.88 and abs(y) < 0.02:
                T.mul(g, v, 0.85)
            if z < 0.85 and y < -0.05 and abs(abs(x) - 0.092) < 0.012:
                T.mul(g, v, 0.88)
            if 0.43 < z < 0.53 and y > 0.02:
                T.mul(g, v, 0.82)


# Construction (comme personnages.make_mesh, plus couleurs, normales et gabarit) ---------------------------

def make(name, row, builder, mat, arm, with_face, cells, gab="moyen", context=None, lpl=None, extras=None):
    cells = cells or lpl.char_cells(row)
    g = T.init(lpl.Geo(cells))
    g.eye_uv = {}
    builder(g, "neutral")
    g.bm.normal_update()
    T.finish_colors(g, context() if callable(context) else context)
    # UV des yeux vers les vignettes peintes
    for f in g.bm.faces:
        if all(v in g.eye_uv for v in f.verts):
            for lp in f.loops:
                lp[g.uv].uv = g.eye_uv[lp.vert]
    G.to_standard(g, gab)
    tris = g.tri_count()
    if os.environ.get("LPL_DETAIL_TRIS"):
        seen = set()
        out = {}
        for tg, vs in g.tags.items():
            n = sum(len(f.verts) - 2 for f in g.bm.faces if f not in seen and all(v in vs for v in f.verts))
            seen.update(f for f in g.bm.faces if all(v in vs for v in f.verts))
            out[tg] = n
        out["autres"] = sum(len(f.verts) - 2 for f in g.bm.faces if f not in seen)
        print("DETAIL", name, tris, out)
    ob = T.to_object(g, name, mat)
    if with_face:
        ob.shape_key_add(name="Basis", from_mix=False)
        for expr in PP.EXPRESSIONS[1:]:
            g2 = T.init(lpl.Geo(cells))
            g2.eye_uv = {}
            builder(g2, expr)
            G.to_standard(g2, gab)
            g2.bm.verts.ensure_lookup_table()
            co = [c for v in g2.bm.verts for c in v.co]
            g2.bm.free()
            sk = ob.shape_key_add(name=expr, from_mix=False)
            assert len(co) == len(sk.data) * 3, (name, expr, len(co) // 3, len(sk.data))
            sk.data.foreach_set("co", co)
            sk.value = 0.0
    mod = ob.modifiers.new("rig", "ARMATURE")
    mod.object = arm
    ob["gabarit"] = gab
    for k, v in (extras or {}).items():
        ob[k] = v
    return ob, tris


def context_geo(lpl, cells, *builders):
    """Triangles de pièces voisines (pour l'occlusion d'une pièce portée avec elles)."""
    out = []
    for b in builders:
        g = T.init(lpl.Geo(cells))
        g.eye_uv = {}
        b(g, "neutral")
        out.append(T.context_of(g))
        g.bm.free()
    return T.merge_context(*out)


# Poses de repos ----------------------------------------------------------------------------------------------

def idle_clips(A):
    """Pose de repos propre à chaque témoin (fiche 4.2: bras écartés de 8 à 12 degrés, coudes fléchis de 12 à 18;
    respiration visible). Repère des os de personnages.anims: x lève ou plie vers l'avant, z écarte (bras gauche
    positif vers l'extérieur)."""
    def breath(p, k):
        q = dict(p)
        c = q.get("chest", (0, 0, 0))
        q["chest"] = (c[0] - 2.2 * k, c[1], c[2])
        ul, ur = q.get("upper_arm_l", (0, 0, 0)), q.get("upper_arm_r", (0, 0, 0))
        q["upper_arm_l"] = (ul[0], ul[1], ul[2] + 1.2 * k)
        q["upper_arm_r"] = (ur[0], ur[1], ur[2] - 1.2 * k)
        hl = q.get("hips_loc", (0, 0, 0))
        q["hips_loc"] = (hl[0], hl[1] + 0.003 * k, hl[2])
        return q

    def m(*ps):
        out = {}
        for p in ps:
            out.update(p)
        return out
    # joueur: détendu, appui sur la jambe droite, regard qui fait le tour
    base = {"upper_arm_l": (3, 0, 10), "upper_arm_r": (3, 0, -10), "forearm_l": (15, 0, 0), "forearm_r": (15, 0, 0),
            "hand_l": (6, 0, 0), "hand_r": (6, 0, 0)}
    shift = {"hips": (0, 3, -2.5), "thigh_r": (0, 0, 2.5), "thigh_l": (5, 0, 2.5), "shin_l": (-9, 0, 0), "foot_l": (4, 0, 0),
             "spine": (0, -2, 1.5), "chest": (0, -1, 1.5)}
    A["idle_player"] = (True, {0: breath(m(base, shift), 0), 30: breath(m(base, shift), 1),
                               60: breath(m(base, shift, {"head": (0, 12, 0)}), 0),
                               90: breath(m(base, shift, {"head": (0, 12, 0)}), 1),
                               120: breath(m(base, shift, {"head": (-3, -8, 2)}), 0),
                               150: breath(m(base, shift, {"head": (-3, -8, 2)}), 1), 180: breath(m(base, shift), 0)})
    # angles des bras calculés par verifier/poses_repos.py (poignet et coude visés sur le squelette du gabarit)
    # Colette: poing gauche sur la hanche, bras droit détendu, appui sur la jambe gauche, tête penchée (franche)
    akimbo = {"upper_arm_l": (-43, 68, -2), "forearm_l": (94, 0, 0), "hand_l": (-64, 0, -51),
              "upper_arm_r": (4, 0, -9), "forearm_r": (16, 0, 0), "hand_r": (6, 0, 0),
              "hips": (0, -4, 3), "thigh_l": (0, 0, -3), "thigh_r": (5, 0, -3), "shin_r": (-9, 0, 0), "foot_r": (4, 0, 0),
              "spine": (0, 3, -2), "chest": (-2, 2, -2), "head": (2, 0, 6)}
    A["idle_colette"] = (True, {0: breath(akimbo, 0), 30: breath(akimbo, 1), 60: breath(m(akimbo, {"head": (0, 10, 4)}), 0),
                                90: breath(m(akimbo, {"head": (0, 10, 4)}), 1), 120: breath(akimbo, 0)})
    # Firmin: mains dans le dos, buste redressé, il surveille le quai (tête à gauche puis à droite)
    back = {"upper_arm_l": (39, 124, 32), "upper_arm_r": (39, -124, -32), "forearm_l": (59, 0, 0), "forearm_r": (59, 0, 0),
            "hand_l": (-3, -3, 24), "hand_r": (-3, 3, -24), "spine": (-3, 0, 0), "chest": (-3, 0, 0), "head": (-4, 0, 0),
            "thigh_l": (0, 0, 3), "thigh_r": (0, 0, -3)}
    A["idle_firmin"] = (True, {0: breath(back, 0), 30: breath(back, 1), 60: breath(m(back, {"head": (-4, 18, 0)}), 0.3),
                               100: breath(m(back, {"head": (-4, 18, 0)}), 0.8), 130: breath(back, 0),
                               160: breath(m(back, {"head": (-2, -16, 0)}), 1), 200: breath(m(back, {"head": (-2, -16, 0)}), 0.2),
                               240: breath(back, 0)})


def firmin_scarf(g, expr):
    """Écharpe de laine de Firmin (tour 9) reprise au gabarit trapu: tour du cou abaissé au cou court, élargi au
    thorax en tonneau."""
    PP.firmin_scarf(g, expr)
    for v in g.bm.verts:
        v.co.z -= 0.024
        v.co.x *= 1.05
        v.co.y = v.co.y * 1.08 - 0.004
