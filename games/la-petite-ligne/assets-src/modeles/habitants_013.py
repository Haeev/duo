"""Les quatorze habitants de la 0.13 et leurs accessoires (docs/jeux/jeu-1/v0-13-habitants.md, section 2.3, lot H6).

Appelé par personnages.py (même squelette `rig`, mêmes clips, mêmes clés de forme que les habitants de la démo).
Chaque habitant a sa rangée dans `personnages.png` (palette.py); les cases `scarf` et `scarf_mark` portent chez
eux deux couleurs de plus (aucun foulard: la bible réserve les couleurs vives au cou aux joueurs).

Repères (Blender, Z en haut): l'avant du personnage vers -Y, sa gauche vers +X. Tête ronde des habitants: centre hc
renvoyé par `head_round_face`, demi-axes PHEAD (0,18 x 0,165 x 0,17); yeux à hc + 0,035, x = +-0,05; sourcils à
hc + 0,08; bouche vers hc - 0,032; oreilles à x = +-0,176.

Pourquoi ces choix (règle « au bon endroit, dans le bon sens, à la bonne taille »):
- les bords de chapeau sont relevés devant (rotation autour de X): à l'élévation de la caméra (35 degrés), un bord
  plat de plus de 0,2 m cacherait les yeux; on garde les yeux visibles comme sur la casquette de Firmin;
- les accessoires tenus (cartable, pot à lait, hache) ont leur origine à la prise et pendent comme les outils de
  `ferme.glb` (sous `socket_hand_r`); les vélos ont leur origine sous les pieds de celui qui les pousse (même
  position et même orientation que lui), le guidon tombe dans sa main gauche (clip `push_bike`).
"""
import math

import bpy  # noqa: F401,I001 (bpy avant bmesh)
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

import coiffures as CF

PP = None  # module personnages (posé par personnages.py)

# Échelle de pose (extra `scale`, à reporter dans `habitants.json`): fiches 2.3. Armand et Inès « grands »: le
# squelette est commun (os et jambes fixes), seule l'échelle donne le gabarit de 1,80 m demandé pour Armand.
SCALES = {"armand": 1.035, "berthe": 1.0, "martial": 1.0, "marthe": 0.92, "honorine": 0.86, "ines": 1.03,
          "barnabe": 1.10, "mado": 1.0, "paulin": 0.97, "margot": 0.97, "leon": 0.78, "ambroise": 0.94,
          "nour": 1.0, "colette": 1.0}
VILLAGERS = list(SCALES)

# Point de la main gauche sur le guidon (repère du personnage, Blender): poignée côté personnage de chaque vélo.
HAND_ON_BAR = Vector((0.31, -0.37, 0.98))
BIKE_X = 0.56          # axe du vélo, à la gauche de celui qui le pousse
WHEEL_R = 0.335
AXLE_FRONT, AXLE_REAR = -0.62, 0.42


# Outils de forme ---------------------------------------------------------------------------------------

def lobe(g, hc, c, r, segs=8, rings=5, rot=(0, 0, 0), color="hair", bone="head"):
    return CF._lobe(g, hc, c, r, segs=segs, rings=rings, rot=rot, color=color, bone=bone)


def fix_normals(g, vs):
    fs = list({f for v in vs if v.is_valid for f in v.link_faces})
    bmesh.ops.recalc_face_normals(g.bm, faces=fs)
    return vs


def seg(g, p0, p1, r0, r1, color, bone=None, segs=6, cap=True):
    """Cône tronqué de p0 à p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    eul = d.normalized().to_track_quat("Z", "Y").to_euler("XYZ")
    return g.cyl(r0, d.length, loc=tuple((p0 + p1) / 2), color=color, segs=segs, r2=r1, cap=cap,
                 rot=tuple(math.degrees(a) for a in eul), bone=bone)


def ring(g, center, r, t, d, color, bone=None, segs=10, rot=(90, 0, 0)):
    """Anneau plat (section rectangulaire t x d), dans le plan XY puis tourné (par défaut face à -Y)."""
    pts, faces = [], []
    for k in range(segs):
        a = 2 * math.pi * k / segs
        ca, sa = math.cos(a), math.sin(a)
        for rr, zz in ((r + t / 2, -d / 2), (r + t / 2, d / 2), (r - t / 2, d / 2), (r - t / 2, -d / 2)):
            pts.append((rr * ca, rr * sa, zz))
    for k in range(segs):
        k2 = (k + 1) % segs
        for j in range(4):
            j2 = (j + 1) % 4
            faces.append((k * 4 + j, k2 * 4 + j, k2 * 4 + j2, k * 4 + j2))
    vs = g.mesh(pts, faces, color, loc=center, rot=rot, bone=bone)
    return fix_normals(g, vs)


def loft_n(g, rings_, n, color, bone=None, weights=None, close_bottom=True, close_top=True):
    """Comme loft8 de personnages.py, avec n pans (une face à plat devant): pour les rayures et les carreaux."""
    c = math.cos(math.pi / n)
    pts, faces = [], []
    for ax, ay, z in rings_:
        for k in range(n):
            a = math.radians(180.0 / n + 360.0 / n * k) - math.pi / 2
            pts.append((ax / c * math.cos(a), ay / c * math.sin(a), z))
    for i in range(len(rings_) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((i * n + k, i * n + k2, (i + 1) * n + k2, (i + 1) * n + k))
    if close_bottom:
        faces.append(tuple(reversed(range(n))))
    if close_top:
        m = (len(rings_) - 1) * n
        faces.append(tuple(range(m, m + n)))
    vs = g.mesh(pts, faces, color, bone=bone, weights=weights)
    return fix_normals(g, vs)


def subdivide_rings(rings_, k=2):
    out = []
    for (a0, b0, z0), (a1, b1, z1) in zip(rings_, rings_[1:]):
        for j in range(k):
            t = j / k
            out.append((a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, z0 + (z1 - z0) * t))
    out.append(rings_[-1])
    return out


def checker(c1, c2, n, z_step, z0=0.0):
    """Couleur en damier selon l'azimut (n colonnes, une face pleine devant) et la hauteur (bandes de z_step)."""
    def f(face):
        p = face.calc_center_median()
        a = math.atan2(p.x, -p.y)
        col = int(math.floor(a / (2 * math.pi / n) + 0.5))
        band = int(math.floor((p.z - z0) / z_step))
        return c1 if (col + band) % 2 == 0 else c2
    return f


def stripes(c1, c2, n):
    def f(face):
        p = face.calc_center_median()
        a = math.atan2(p.x, -p.y)
        col = int(math.floor(a / (2 * math.pi / n) + 0.5))
        if abs(face.normal.z) > 0.7:
            return c1
        return c1 if col % 2 == 0 else c2
    return f


def front_band(g, rings_, hw0, hw1, z0, z1, color, off=0.004, t=0.008, n=4):
    """Bande plaquée sur la face avant (plate) du torse octogonal: chemise entre les pans d'un gilet, plastron.
    hw0, hw1: demi-largeurs en bas et en haut."""
    zs = [z0 + (z1 - z0) * i / n for i in range(n + 1)]
    pts = []
    for z in zs:
        hw = hw0 + (hw1 - hw0) * (z - z0) / (z1 - z0)
        y = PP.torso_front_y(z, rings_) - off
        pts += [(-hw, y, z), (hw, y, z)]
    m = len(pts)
    pts += [(x, y + t, z) for x, y, z in pts]
    faces = []
    for i in range(n):
        a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
        faces.append((a, b, c, d))
        faces.append((m + d, m + c, m + b, m + a))
        faces.append((b, m + b, m + c, c))
        faces.append((a, d, m + d, m + a))
    faces.append((0, m, m + 1, 1))
    faces.append((2 * n, 2 * n + 1, m + 2 * n + 1, m + 2 * n))
    vs = g.mesh(pts, faces, color, weights=PP.torso_weights)
    return fix_normals(g, vs)


def stick_dots(g, host, spots, color, size, bone=None, weights=None, sides=6, depth=0.003, elong=1.0, jitter=0.0):
    """Pastilles (fleurs, taches de farine) posées sur la surface d'un volume déjà construit, par lancer de rayons
    horizontaux vers l'axe du personnage. spots: [(azimut en degrés, 0 devant et 90 à gauche, z)]."""
    hv = [v for v in host if v.is_valid]
    idx = {v: i for i, v in enumerate(hv)}
    polys = [[idx[v] for v in f.verts] for f in {f for v in hv for f in v.link_faces} if all(v in idx for v in f.verts)]
    tree = BVHTree.FromPolygons([v.co.copy() for v in hv], polys)
    out = []
    for az, z in spots:
        a = math.radians(az)
        d = Vector((-math.sin(a), math.cos(a), 0.0))
        o = Vector((0, 0, z)) - d * 1.0
        hit = tree.ray_cast(o, d)
        if hit[0] is None:
            continue
        p, nrm = hit[0], hit[1]
        if nrm.dot(d) > 0:
            nrm = -nrm
        rot = nrm.to_track_quat("Z", "Y").to_matrix().to_4x4()
        # contour irrégulier (jitter), le même à chaque construction: les clés de forme restent valides
        jr = [1.0 + jitter * math.sin(2.7 * k + 0.9 * az + 3.1 * z) for k in range(sides)]
        pts = [(size * jr[k] * math.cos(2 * math.pi * k / sides),
                size * jr[k] * elong * math.sin(2 * math.pi * k / sides), 0.0) for k in range(sides)]
        pts += [(x * 0.8, y * 0.8, depth) for x, y, _ in pts]
        faces = [tuple(range(sides, 2 * sides)), tuple(reversed(range(sides)))]
        for k in range(sides):
            k2 = (k + 1) % sides
            faces.append((k, k2, sides + k2, sides + k))
        # mêmes poids pour toute la pastille, pris là où elle se pose (sinon elle se tord et se retourne en marchant)
        w0 = weights(p) if weights else None
        vs = g.mesh(pts, faces, color, bone=bone, weights=(lambda co, w0=w0: w0) if w0 else None)
        g.transform(vs, Matrix.Translation(p + nrm * 0.0005) @ rot)
        out += fix_normals(g, vs)
    return out


def arm_k(g, side, sleeve="long", top="top", trim="top_trim", skin="skin", puff=1.0, k=1.0):
    """arm_round de personnages.py avec des bras nus plus épais (k) pour les manches courtes et retroussées."""
    s = 1 if side == "l" else -1
    up, fo = "upper_arm_" + side, "forearm_" + side
    g.sphere(0.083 * puff, loc=(s * 0.2, 0, 1.305), color=top, segs=8, rings=5, bone=up)
    if sleeve == "short":
        g.lathe([(0.064 * puff, 1.2), (0.078 * puff, 1.25), (0.072 * puff, 1.31)], loc=(s * 0.215, 0, 0), colors=top,
                segs=6, bone=up, close_top=False)
        g.lathe([(0.05 * k, 1.075), (0.06 * k, 1.15), (0.058 * k, 1.21)], loc=(s * 0.22, 0, 0), colors=skin, segs=6,
                bone=up, close_bottom=False, close_top=False)
        g.lathe([(0.066 * puff, 1.19), (0.07 * puff, 1.225)], loc=(s * 0.217, 0, 0), colors=trim, segs=6, bone=up)
    else:
        g.lathe([(0.058 * puff, 1.075), (0.07 * puff, 1.19), (0.064 * puff, 1.30)], loc=(s * 0.22, 0, 0), colors=top,
                segs=6, bone=up, close_bottom=False, close_top=False)
    lower = top if sleeve == "long" else skin
    q = puff if sleeve == "long" else k
    g.sphere(0.058 * q, loc=(s * 0.226, 0, 1.065), color=lower, segs=6, rings=4, bone=fo)
    g.lathe([(0.046 * q, 0.84), (0.059 * q, 0.95), (0.055 * q, 1.06)], loc=(s * 0.231, 0, 0), colors=lower, segs=6,
            bone=fo, close_top=False)
    if sleeve == "long":
        g.lathe([(0.058 * puff, 0.83), (0.058 * puff, 0.865)], loc=(s * 0.234, 0, 0), colors=trim, segs=6, bone=fo)
    elif sleeve == "rolled":
        g.lathe([(0.075 * puff, 1.035), (0.076 * puff, 1.09)], loc=(s * 0.223, 0, 0), colors=trim, segs=6, bone=up)


def shin_wrap(g, side, z0, z1, r0, r1, color, x=0.092, segs=6):
    """Manchon sur le tibia (guêtres, bottes hautes, chaussettes)."""
    s = 1 if side == "l" else -1
    g.lathe([(r0, z0), ((r0 + r1) / 2 * 1.04, (z0 + z1) / 2), (r1, z1)], loc=(s * x, 0, 0), colors=color, segs=segs,
            bone="shin_" + side)


def skirt_radius(z, z_top, z_bot, r_top, r_bot):
    """Rayon (x) de la jupe ronde de personnages.skirt à la hauteur z (même profil)."""
    rb = r_bot * 1.06
    prof = [(rb * 0.9, z_bot), (rb, z_bot + 0.03), (rb * 0.98, z_bot + 0.07),
            ((r_top + rb) / 2 * 0.93, (z_top + z_bot) / 2), (r_top * 1.02, z_top - 0.08), (r_top, z_top)]
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return prof[-1][0] if z > z_top else prof[0][0]


def apron_on_skirt(g, skirt, z_top, z_bot, w_top, w_bot, color, rows=5, nc=5, t=0.012, rings_=None):
    """Tablier plaqué sur une jupe évasée: chaque rang suit le rayon de la jupe à sa hauteur (apron de
    personnages.py tombe droit et décolle d'une jupe très évasée, vu de profil). skirt = (z_top, z_bot, r_top,
    r_bot) de la jupe."""
    zt, zb, rt, rbot = skirt
    w = PP.skirt_weights(z_top, z_bot, 0.2)
    pts = []
    for r in range(rows):
        z = z_bot + (z_top - z_bot) * r / (rows - 1)
        hw = (w_bot + (w_top - w_bot) * r / (rows - 1)) / 2
        rx = skirt_radius(z, zt, zb, rt, rbot)
        ry = rx * 0.88
        for c in range(nc):
            u = -1 + 2 * c / (nc - 1)
            x = u * hw
            yy = -ry * math.sqrt(max(0.05, 1 - (x / rx) ** 2)) - 0.01
            dz = (0.012 * math.cos(u * math.pi * 2) + 0.03 * u ** 4) if r == 0 else 0.0
            pts.append((x, yy, z + dz))
    n = len(pts)
    pts += [(x, y + t, z) for x, y, z in pts]
    faces = []
    for r in range(rows - 1):
        for c in range(nc - 1):
            i = r * nc + c
            faces.append((i, i + 1, i + nc + 1, i + nc))
            faces.append((n + i, n + i + nc, n + i + nc + 1, n + i + 1))
        for c in (0, nc - 1):
            i, j = r * nc + c, (r + 1) * nc + c
            faces.append((i, j, n + j, n + i))
    for c in range(nc - 1):
        faces.append((c, c + 1, n + c + 1, n + c))
        top = (rows - 1) * nc
        faces.append((top + c, top + c + 1, n + top + c + 1, n + top + c))
    vs = g.mesh(pts, faces, color, weights=w)
    fix_normals(g, vs)
    if rings_ is not None:
        # cordon à la taille, ajusté au torse (la ceinture ronde de personnages.apron déborde d'une taille fine)
        ax, ay = rings_[1][0], rings_[1][1]
        PP.loft8(g, [(ax * 1.05, ay * 1.1, z_top - 0.024), (ax * 1.05, ay * 1.1, z_top + 0.01)], color, bone="hips")
    else:
        g.lathe([(0.2, z_top - 0.02), (0.2, z_top + 0.012)], colors=color, segs=10, scale=(1.0, 0.72, 1.0),
                bone="hips")
    return vs


def skirt_fn(g, z_top, z_bot, r_top, r_bot, color, segs=12, sub=1):
    """Jupe arrondie de personnages.skirt, couleur libre (damier, fleurs); sub: anneaux intermédiaires."""
    w = PP.skirt_weights(z_top, z_bot, r_bot)
    rb = r_bot * 1.06
    prof = [(rb * 0.9, z_bot), (rb, z_bot + 0.03), (rb * 0.98, z_bot + 0.07),
            ((r_top + rb) / 2 * 0.93, (z_top + z_bot) / 2), (r_top * 1.02, z_top - 0.08), (r_top, z_top)]
    if sub > 1:
        fine = [prof[0], prof[1]]
        for (r0, z0), (r1, z1) in zip(prof[1:], prof[2:]):
            for j in range(1, sub + 1):
                t = j / sub
                fine.append((r0 + (r1 - r0) * t, z0 + (z1 - z0) * t))
        prof = fine
    return g.lathe(prof, colors=color, segs=segs, weights=w, scale=(1.0, 0.88, 1.0))


def hat(g, hc, crown, brim, band=None, rc=0.172, h=0.11, rb=0.24, tilt=-10.0, drop=0.075, dome=0.85, wobble=0.0,
        brim_droop=0.0, segs=12, crown_top=None):
    """Chapeau rond: calotte, ruban, bord (relevé devant de -tilt degrés; brim_droop rabat le bord vers le bas;
    wobble cabosse le bord). Tout tourne autour du centre de la tête."""
    top = PP.hat_top(hc, 1.0, drop)
    vs = []
    prof = [(rc, top - 0.012), (rc * 1.01, top + h * 0.55), (rc * dome, top + h), (0.0, top + h * 1.04)]
    cv = g.lathe(prof, loc=(0, 0.004, 0), colors=crown_top or crown, segs=segs, close_bottom=False, bone="head")
    if wobble:
        for v in cv:
            if v.is_valid and v.co.z > top + h * 0.9:
                v.co.z -= 0.025 * max(0.0, 1 - abs(v.co.x) / (rc * 0.7))
    vs += cv
    if band:
        vs += g.lathe([(rc * 1.012, top - 0.004), (rc * 1.018, top + 0.03)], loc=(0, 0.004, 0), colors=band, segs=segs,
                      bone="head")
    zb = top - 0.006
    bp = [(rc * 0.97, zb + 0.012), (rb, zb - brim_droop), (rb, zb - brim_droop + 0.012), (rc * 0.97, zb + 0.024),
          (rc * 0.97, zb + 0.012)]
    bv = g.lathe(bp, loc=(0, 0.004, 0), colors=brim, segs=segs + 4, close_bottom=False, close_top=False, bone="head")
    if wobble:
        for v in bv:
            if not v.is_valid:
                continue
            rr = math.hypot(v.co.x, v.co.y)
            if rr > rc * 1.1:
                a = math.atan2(v.co.y, v.co.x)
                v.co.z += wobble * math.sin(3 * a + 0.7) * (rr - rc) / (rb - rc)
    vs += bv
    M = Matrix.Translation((0, 0, hc)) @ Matrix.Rotation(math.radians(tilt), 4, "X") @ Matrix.Translation((0, 0, -hc))
    g.transform(vs, M)
    return vs


def glasses(g, hc, color="metal", r=0.03, y=-0.171, s=1.0):
    zc = hc + 0.035 * s
    for sx in (1, -1):
        ring(g, (sx * 0.05 * s, y * s, zc), r * s, 0.007, 0.007, color, bone="head", segs=10)
        p0 = Vector((sx * (0.05 + r) * s, y * s, zc + 0.005))
        p1 = Vector((sx * 0.13 * s, -0.118 * s, zc + 0.008))
        p2 = Vector((sx * 0.17 * s, -0.05 * s, zc + 0.006))
        p3 = Vector((sx * 0.177 * s, 0.01 * s, zc - 0.012))
        for a, b in ((p0, p1), (p1, p2), (p2, p3)):
            seg(g, a, b, 0.0035, 0.0035, color, bone="head", segs=4)
    seg(g, (-(0.05 - r) * s + 0.002, y * s, zc + 0.006), ((0.05 - r) * s - 0.002, y * s, zc + 0.006), 0.0035, 0.0035,
        color, bone="head", segs=4)


CF.STRAND_SETS.setdefault("side_part", ((-150, -112, -74, -36, 2, 40, 78, 116, 154), 36, 0.125, 34))


def side_part(g, hc):
    """Cheveux raides peignés à la raie (côté gauche du personnage), nuque nette: calotte, mèche couchée vers la
    droite sur le front, mèches peignées dans le même sens."""
    CF._cap(g, hc, thick=0.013, segs=12, rings=7)
    CF._nape(g, hc, z=-0.035, w=0.15, h=0.075)
    lobe(g, hc, (-0.03, -0.098, 0.15), (0.12, 0.045, 0.045), segs=8, rings=4, rot=(22, 0, 12))
    lobe(g, hc, (0.075, -0.06, 0.168), (0.012, 0.09, 0.02), segs=6, rings=3, color="hair_dark", rot=(30, 0, 0))
    for sx in (1, -1):
        lobe(g, hc, (sx * 0.17, -0.01, 0.06), (0.035, 0.075, 0.06), segs=6, rings=4)
    CF.strands(g, hc, "side_part")


def big_nose(g, hc, sc=(0.03, 0.022, 0.03), dz=0.0):
    g.sphere(1.0, loc=(0, -PP.PHEAD[1] * 0.985 - 0.002, hc + 0.008 + dz), color="skin", segs=6, rings=4, scale=sc,
             bone="head")


def nudge_head(g, before, d):
    """Tête un peu en avant et plus bas (dos voûté): toutes les pièces construites depuis `before`."""
    vs = [v for v in g.bm.verts if v not in before]
    g.transform(vs, Matrix.Translation(Vector(d)))


def strap(g, pts, w, t, color, bone="chest"):
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        d = b - a
        eul = d.normalized().to_track_quat("Z", "Y").to_euler("XYZ")
        g.box((w, t, d.length), loc=tuple((a + b) / 2), color=color, rot=tuple(math.degrees(e) for e in eul),
              bone=bone)


def suspenders(g, rings_, color, z_bot=0.99, x=0.075, back=True, z_back=0.99):
    """Bretelles: deux bandes devant (sur le torse, depuis z_bot), par-dessus l'épaule, croisées dans le dos
    jusqu'à la taille (z_back)."""
    for sx in (1, -1):
        pts = []
        for z in [z_bot] + [z for z in (1.12, 1.26, 1.34) if z > z_bot + 0.02]:
            pts.append((sx * x, PP.torso_front_y(z, rings_) - 0.006, z))
        pts.append((sx * x * 1.05, -0.02, 1.405))
        if back:
            pts.append((sx * x * 1.05, 0.06, 1.39))
            for z in (1.3, 1.16):
                pts.append((-sx * x * (1.30 - z) * 4.5, -PP.torso_front_y(z, rings_) + 0.006, z))
            pts.append((-sx * x * 0.9, -PP.torso_front_y(z_back, rings_) + 0.006, z_back))
        strap(g, pts, 0.03, 0.01, color)


def hammer_at_hip(g, side, handle, head, z=0.9, y=-0.03, head_dir=1):
    s = 1 if side == "l" else -1
    x = s * 0.195
    seg(g, (x, y, z - 0.17), (x, y, z + 0.06), 0.011, 0.012, handle, bone="hips", segs=5)
    g.box((0.03, 0.12, 0.034), loc=(x, y + 0.01 * head_dir, z + 0.07), color=head, bevel=0.006, bone="hips")


# Habitants ---------------------------------------------------------------------------------------------------

def build(g, who, expr):
    fn = globals()["v_" + who]
    fn(g, expr)


def v_armand(g, expr):
    rings_ = PP.torso_rings(0.37, 0.29, 0.20)
    hc = PP.head_round_face(g, expr, cheek_base=0.3, brow_k=1.05)
    side_part(g, hc)
    glasses(g, hc)
    PP.neck(g)
    PP.torso_round(g, w_top=0.37, w_bot=0.29, d=0.20)
    # veste ouverte: chemise blanche en V, revers de velours plus sombre, noeud papillon bleu nuit
    front_band(g, rings_, 0.012, 0.05, 1.04, 1.37, "top_trim", off=0.003)
    for sx in (1, -1):
        p = [(sx * 0.05, PP.torso_front_y(1.36, rings_) - 0.006, 1.36),
             (sx * 0.014, PP.torso_front_y(1.04, rings_) - 0.006, 1.04)]
        strap(g, p, 0.026, 0.008, "scarf")
    yb = PP.torso_front_y(1.35, rings_) - 0.014
    for sx in (1, -1):
        g.prism([(0.0, 0.0), (sx * 0.05, 0.022), (sx * 0.05, -0.022)], 0.016, loc=(0, yb, 1.35), color="extra_b",
                bone="chest")
    g.box((0.018, 0.02, 0.022), loc=(0, yb - 0.004, 1.35), color="extra_b", bevel=0.004, bone="chest")
    PP.collar(g, color="top_trim", w=0.15)
    PP.coat_skirt_round(g, 0.158, 0.116, 0.79, 0.98)
    for z in (0.95, 1.0):
        g.box((0.016, 0.01, 0.016), loc=(0.012, PP.torso_front_y(1.0, rings_) - 0.004, z), color="scarf",
              bone="spine")
    # poche de poitrine et craie (instituteur)
    g.box((0.07, 0.008, 0.012), loc=(0.085, PP.torso_front_y(1.22, rings_) - 0.003, 1.22), color="scarf",
          bone="chest")
    g.box((0.01, 0.01, 0.04), loc=(0.07, PP.torso_front_y(1.24, rings_) - 0.002, 1.24), color="scarf_mark",
          bone="chest")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="top", trim="top_trim", puff=0.98)
        PP.leg_round(g, side, thigh="bottom", cuff="bottom", r=0.078)
    PP.hands_round(g)


def v_berthe(g, expr):
    rings_ = PP.torso_rings(0.44, 0.36, 0.245, belly=0.04)
    hc = PP.head_round_face(g, expr, cheek_base=0.5, brow_k=1.45)
    CF.hair_cut(g, "curls", hc)
    PP.neck(g)
    # gilet sans manches vert bouteille sur la blouse écrue: la blouse se voit devant, aux épaules et aux bras
    PP.torso_round(g, w_top=0.44, w_bot=0.36, d=0.245, belly=0.04, color="extra_a")
    front_band(g, rings_, 0.045, 0.06, 0.98, 1.37, "top", off=0.003)
    PP.buttons(g, n=3, z0=1.05, z1=1.28, color="extra_b", rings=PP.torso_rings(0.44, 0.36, 0.245, belly=0.04))
    PP.collar(g, color="top", w=0.19)
    sk = PP.skirt(g, z_top=1.0, z_bot=0.40, r_top=0.215, r_bot=0.34, color="bottom", segs=12)
    del sk
    # farine: taches sur la jupe (devant, là où l'on porte les sacs) et sur le gilet
    host = [v for v in g.bm.verts]
    w = PP.skirt_weights(1.0, 0.40, 0.34)
    # deux traînées de chaque côté (les mains essuyées sur la jupe) et une sur le devant (le sac porté)
    # au milieu des facettes de la jupe (un patch à plat ne doit pas chevaucher une arête)
    smears = [(-45, 0.8), (45, 0.8), (15, 0.59)]
    stick_dots(g, host, smears, "scarf_mark", 0.038, weights=w, sides=9, elong=1.35, jitter=0.25)
    for side in ("l", "r"):
        arm_k(g, side, sleeve="rolled", top="top", trim="top", skin="scarf", puff=1.14, k=1.12)
        PP.leg_round(g, side, thigh="bottom", shin="bottom", r=0.084)
    PP.hands_round(g, color="scarf")


def v_martial(g, expr):
    rings_ = PP.torso_rings(0.37, 0.30, 0.21)
    hc = PP.head_round_face(g, expr, cheek_base=0.5, brow_k=1.3, eye_k=1.05)
    PP.hair_round(g, "sides", hc)
    hat(g, hc, "extra_a", "extra_a", band="extra_b", rc=0.17, h=0.085, rb=0.25, tilt=-12, dome=0.8)
    PP.neck(g)
    # col romain: anneau blanc et sa languette devant
    yc = PP.torso_front_y(1.37, rings_) - 0.004
    g.box((0.05, 0.012, 0.04), loc=(0, yc, 1.37), color="top_trim", rot=(-30, 0, 0), bevel=0.004, bone="chest")
    for sx in (1, -1):
        g.box((0.05, 0.03, 0.022), loc=(sx * 0.05, yc + 0.02, 1.39), color="top", rot=(-30, 0, sx * 30),
              bevel=0.006, bone="chest")
    PP.torso_round(g, w_top=0.37, w_bot=0.30, d=0.21)
    PP.buttons(g, n=7, z0=1.02, z1=1.34, color="scarf_mark", rings=rings_)
    PP.belt_round(g, color="extra_b", buckle="extra_b")
    # soutane retroussée à mi-mollet (pinces à vélo aux chevilles)
    PP.skirt(g, z_top=1.0, z_bot=0.47, r_top=0.19, r_bot=0.27, color="top", segs=12)
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="top", trim="top", puff=1.0)
        PP.leg_round(g, side, thigh="bottom", shin="bottom", r=0.094, cuff="metal")
    PP.hands_round(g)


def v_marthe(g, expr):
    rings_ = PP.torso_rings(0.33, 0.27, 0.19)
    hc = PP.head_round_face(g, expr, brow_k=1.6, eye_k=0.92)
    PP.hair_round(g, "sides", hc)
    lobe(g, hc, (0, 0.155, -0.045), (0.06, 0.05, 0.05), segs=8, rings=5)
    lobe(g, hc, (0, 0.17, -0.02), (0.045, 0.04, 0.03), segs=6, rings=4, color="hair_dark")
    hat(g, hc, "extra_b", "extra_b", band="scarf_mark", rc=0.168, h=0.075, rb=0.215, tilt=-9, dome=0.88)
    PP.neck(g)
    PP.torso_round(g, w_top=0.33, w_bot=0.27, d=0.19)
    PP.collar(g, color="top_trim", w=0.14)
    PP.skirt(g, z_top=0.99, z_bot=0.30, r_top=0.175, r_bot=0.25, color="bottom", segs=12)
    # tablier à bavette plaqué sur la robe, bretelles croisées dans le dos, deux poches
    sk = (0.99, 0.30, 0.175, 0.25)
    apron_on_skirt(g, sk, 1.0, 0.47, 0.24, 0.30, "extra_a", rings_=rings_)
    front_band(g, rings_, 0.055, 0.055, 0.98, 1.24, "extra_a", off=0.004)
    suspenders(g, rings_, "extra_a", z_bot=1.23, x=0.045)
    w = PP.skirt_weights(1.0, 0.47, 0.2)
    zp = 0.72
    yp = -skirt_radius(zp, *sk) * 0.88 * math.sqrt(1 - (0.07 / skirt_radius(zp, *sk)) ** 2) - 0.026
    for sx in (1, -1):
        g.box((0.085, 0.01, 0.075), loc=(sx * 0.07, yp, zp), color="scarf_mark", rot=(-8, 0, sx * 10), weights=w)
    # trousseau de grosses clés au côté droit
    ring(g, (-0.19, -0.05, 0.9), 0.026, 0.007, 0.007, "metal", bone="hips", segs=8, rot=(90, 0, 90))
    for k, (dy, a) in enumerate(((-0.02, -12), (0.0, 0), (0.02, 14))):
        x, y = -0.192, -0.05 + dy
        g.box((0.008, 0.012, 0.075), loc=(x, y, 0.845), color="metal", rot=(a, 0, 0), bone="hips")
        g.box((0.008, 0.026, 0.026), loc=(x, y + math.sin(math.radians(a)) * 0.04, 0.808), color="metal",
              rot=(a, 0, 0), bone="hips")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="top", trim="top_trim", puff=0.95)
        PP.leg_round(g, side, thigh="scarf_mark", shin="scarf_mark", r=0.072)
    PP.hands_round(g, color="scarf")


def v_honorine(g, expr):
    rings_ = PP.torso_rings(0.34, 0.31, 0.21, belly=0.03)
    before = set(g.bm.verts)
    hc = PP.head_round_face(g, expr, cheek_base=0.55, eye_k=0.96, brow_k=0.9)
    PP.hair_round(g, "short", hc)
    lobe(g, hc, (0, 0.04, 0.2), (0.06, 0.055, 0.045), segs=8, rings=5)
    lobe(g, hc, (0, 0.035, 0.24), (0.04, 0.038, 0.03), segs=6, rings=4, color="hair_dark")
    glasses(g, hc)
    nudge_head(g, before, (0, -0.022, -0.02))
    PP.neck(g)
    PP.torso_round(g, w_top=0.34, w_bot=0.31, d=0.21, belly=0.03, color="bottom")
    sk = PP.skirt(g, z_top=1.0, z_bot=0.30, r_top=0.2, r_bot=0.3, color="bottom", segs=12)
    del sk
    host = list(g.bm.verts)
    w = PP.skirt_weights(1.0, 0.30, 0.3)
    # fleurettes au milieu des facettes (azimuts de 15 + 30 k), en quinconce
    spots = [(az, z) for i, z in enumerate((0.42, 0.56, 0.7, 0.84)) for az in range(-165 + 30 * (i % 2), 180, 60)]
    stick_dots(g, host, spots, "scarf", 0.018, weights=w, sides=5)
    # pèlerine tricotée: cape sur les épaules, dos rond (voûtée), côtes au bord
    cape = [(0.27, 1.1), (0.275, 1.13), (0.25, 1.24), (0.17, 1.34), (0.09, 1.405)]
    g.lathe(cape, colors=["top_trim", "top", "top", "top"], segs=12, scale=(1.0, 0.8, 1.0), close_bottom=False,
            bone="chest")
    lobe(g, 0.0, (0, 0.105, 1.28), (0.16, 0.08, 0.1), segs=10, rings=5, color="top", bone="chest")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="bottom", trim="top", puff=0.95)
        PP.leg_round(g, side, thigh="bottom", shin="hair_dark", r=0.07)
    PP.hands_round(g)
    # canne de buis dans la main droite, bout au sol (au repos)
    seg(g, (-0.246, -0.035, 0.0), (-0.246, -0.035, 0.84), 0.012, 0.013, "extra_a", bone="hand_r", segs=6)
    seg(g, (-0.246, -0.035, 0.84), (-0.246, -0.09, 0.86), 0.013, 0.013, "extra_b", bone="hand_r", segs=6)
    g.sphere(0.014, loc=(-0.246, -0.035, 0.004), color="extra_b", segs=6, rings=3, bone="hand_r")


def v_ines(g, expr):
    rings_ = PP.torso_rings(0.36, 0.29, 0.21)
    hc = PP.head_round_face(g, expr, cheek_base=0.15, brow_k=1.25, eye_k=0.95)
    PP.hair_round(g, "sides", hc)
    # natte noire courte à la nuque
    for i in range(3):
        lobe(g, hc, (0, 0.17 + 0.01 * i, -0.08 - 0.05 * i), (0.032 - 0.003 * i, 0.03, 0.034), segs=6, rings=4,
             color="hair" if i % 2 == 0 else "hair_dark", bone="head" if i == 0 else "neck")
    lobe(g, hc, (0, 0.2, -0.215), (0.024, 0.02, 0.016), segs=6, rings=3, color="extra_a", bone="neck")
    hat(g, hc, "extra_b", "extra_b", band="extra_a", rc=0.172, h=0.1, rb=0.225, tilt=-6, dome=0.9, brim_droop=0.03)
    PP.neck(g)
    PP.torso_round(g, w_top=0.36, w_bot=0.29, d=0.21)
    PP.coat_skirt_round(g, 0.16, 0.12, 0.79, 0.98)
    PP.collar(g, color="top_trim", w=0.16)
    PP.buttons(g, n=4, z0=0.9, z1=1.3, color="extra_a", rings=rings_)
    for sx in (1, -1):
        g.box((0.075, 0.01, 0.06), loc=(sx * 0.075, PP.torso_front_y(1.22, rings_) - 0.004, 1.22), color="top_trim",
              bone="chest")
    # écusson de garde sur la poitrine gauche et carnet à croquis qui dépasse de la poche droite
    ye = PP.torso_front_y(1.29, rings_) - 0.006
    g.prism([(-0.03, 0.03), (0.03, 0.03), (0.03, -0.01), (0.0, -0.035), (-0.03, -0.01)], 0.006,
            loc=(0.075, ye, 1.29), color="scarf", bone="chest")
    g.prism([(-0.012, 0.012), (0.012, 0.012), (0.0, -0.018)], 0.004, loc=(0.075, ye - 0.004, 1.29),
            color="top", bone="chest")
    g.box((0.055, 0.012, 0.05), loc=(-0.075, PP.torso_front_y(1.25, rings_) + 0.0, 1.255), color="scarf",
          bone="chest")
    PP.belt_round(g, color="extra_a", buckle="metal", z=0.95)
    # marteau forestier à la ceinture, côté droit
    hammer_at_hip(g, "r", "extra_a", "metal", z=0.86, y=0.0)
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="top", trim="top_trim", puff=1.0)
        PP.leg_round(g, side, thigh="bottom", cuff=None, r=0.08)
        shin_wrap(g, side, 0.1, 0.37, 0.062, 0.072, "scarf_mark")
    PP.hands_round(g)


def v_barnabe(g, expr):
    rings_ = PP.torso_rings(0.45, 0.38, 0.25, belly=0.05)
    hc = PP.head_round_face(g, expr, cheek_base=0.75, brow_k=1.7, eye_k=0.95, mouth_dy=-0.03)
    PP.hair_round(g, "sides", hc)
    big_nose(g, hc, (0.03, 0.022, 0.028))
    # barbe noire fournie piquée de gris
    ry = PP.PHEAD[1]
    lobe(g, hc, (0, -ry * 0.8, -0.14), (0.155, 0.08, 0.08), segs=10, rings=6)
    lobe(g, hc, (0, -ry * 0.78, -0.2), (0.1, 0.065, 0.055), segs=8, rings=5, color="scarf_mark")
    for sx in (1, -1):
        lobe(g, hc, (sx * 0.15, -0.04, -0.07), (0.045, 0.095, 0.08), segs=6, rings=4)
        lobe(g, hc, (sx * 0.06, -ry * 0.9, -0.165), (0.04, 0.04, 0.04), segs=6, rings=4, color="scarf_mark")
        lobe(g, hc, (sx * 0.03, -ry * 0.97 - 0.006, -0.02), (0.04, 0.022, 0.016), segs=6, rings=4,
             rot=(0, sx * 14, 0))
    # bonnet de laine brun à revers, porté en arrière (les sourcils restent libres)
    top = hc + 0.09
    bv = g.lathe([(0.188, top - 0.005), (0.193, top + 0.05)], colors="extra_b", segs=12, bone="head")
    bv += g.lathe([(0.185, top + 0.05), (0.178, top + 0.1), (0.12, top + 0.16), (0.0, top + 0.18)], colors="extra_a",
                  segs=12, close_bottom=False, bone="head")
    g.transform(bv, Matrix.Translation((0, 0.012, hc)) @ Matrix.Rotation(math.radians(-14), 4, "X")
                @ Matrix.Translation((0, 0, -hc)))
    PP.neck(g)
    plaid = checker("top", "top_trim", 8, 0.075, 0.97)
    # gilet de cuir sur la chemise à carreaux
    PP.torso_round(g, w_top=0.45, w_bot=0.38, d=0.25, belly=0.05, color="scarf")
    front_band(g, rings_, 0.05, 0.065, 0.98, 1.37, plaid, off=0.003)
    PP.collar(g, color="top", w=0.2)
    PP.pelvis_round(g, w=0.34, d=0.24)
    PP.belt_round(g, color="extra_b", buckle="metal")
    for side in ("l", "r"):
        arm_k(g, side, sleeve="rolled", top=plaid, trim="top_trim", skin="skin", puff=1.16, k=1.15)
        PP.leg_round(g, side, thigh="bottom", cuff="bottom", r=0.095, boots=True)
    PP.hands_round(g)


def v_mado(g, expr):
    rings_ = PP.torso_rings(0.44, 0.35, 0.235)
    hc = PP.head_round_face(g, expr, cheek_base=0.6, brow_k=1.35)
    CF.hair_cut(g, "curls", hc)
    # lunettes de forge relevées sur le front: sangle et deux verres sombres cerclés
    top = hc + 0.118
    sv = g.lathe([(0.168, top - 0.012), (0.168, top + 0.012)], colors="scarf_mark", segs=12, scale=(1.0, 0.93, 1.0),
                 close_bottom=False, close_top=False, bone="head")
    g.transform(sv, Matrix.Translation((0, 0.0, hc)) @ Matrix.Rotation(math.radians(-16), 4, "X")
                @ Matrix.Translation((0, 0, -hc)))
    for sx in (1, -1):
        c = (sx * 0.048, -0.13, hc + 0.125)
        g.cyl(0.03, 0.026, loc=c, color="metal", segs=8, rot=(58, 0, 0), bone="head")
        g.cyl(0.024, 0.03, loc=c, color="scarf", segs=8, rot=(58, 0, 0), bone="head")
    g.box((0.03, 0.012, 0.012), loc=(0, -0.168, hc + 0.14), color="metal", bone="head")
    PP.neck(g)
    PP.torso_round(g, w_top=0.44, w_bot=0.35, d=0.235)
    PP.collar(g, color="top_trim", w=0.18)
    PP.pelvis_round(g, w=0.33, d=0.23)
    # tablier de cuir raide: pan devant le bassin, bavette sur la face plate du torse, bretelles croisées
    apron_on_skirt(g, (1.0, 0.3, 0.185, 0.165), 1.0, 0.56, 0.26, 0.3, "extra_a", rings_=rings_)
    front_band(g, rings_, 0.062, 0.062, 0.98, 1.31, "extra_a", off=0.004)
    suspenders(g, rings_, "extra_a", z_bot=1.3, x=0.06)
    for side in ("l", "r"):
        arm_k(g, side, sleeve="short", top="top", trim="top_trim", skin="skin", puff=1.12, k=1.22)
        PP.leg_round(g, side, thigh="bottom", cuff="bottom", r=0.088, boots=True)
    PP.hands_round(g)
    # marteau glissé dans la boucle du tablier, à gauche
    hammer_at_hip(g, "l", "extra_b", "metal", z=0.9, y=-0.05)


def v_paulin(g, expr):
    rings_ = PP.torso_rings(0.43, 0.37, 0.245, belly=0.05)
    hc = PP.head_round_face(g, expr, cheek_base=0.35, brow_k=1.75, mouth_dy=-0.01)
    PP.hair_round(g, "sides", hc)
    big_nose(g, hc, (0.028, 0.021, 0.027))
    ry = PP.PHEAD[1]
    for sx in (1, -1):
        lobe(g, hc, (sx * 0.034, -ry * 0.97 - 0.008, -0.022), (0.05, 0.026, 0.022), segs=6, rings=4,
             rot=(0, sx * 18, 0))
    hat(g, hc, "scarf", "scarf", band="extra_b", rc=0.172, h=0.095, rb=0.27, tilt=-11, dome=0.82, wobble=0.022)
    PP.neck(g)
    rz = subdivide_rings(rings_)
    loft_n(g, rz, 16, stripes("top", "top_trim", 16), weights=PP.torso_weights, close_bottom=False)
    PP.collar(g, color="top", w=0.18)
    PP.buttons(g, n=3, z0=1.12, z1=1.32, color="top_trim", rings=rings_)
    PP.pelvis_round(g, w=0.34, d=0.24)
    PP.belt_round(g, color="extra_a", buckle="metal")
    suspenders(g, rings_, "extra_a")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="rolled", top="top", trim="top", puff=1.12)
        PP.leg_round(g, side, thigh="bottom", cuff="bottom", r=0.094, boots=True)
        shin_wrap(g, side, 0.06, 0.3, 0.066, 0.078, "shoes")
    PP.hands_round(g)


def v_margot(g, expr):
    rings_ = PP.torso_rings(0.40, 0.36, 0.24, belly=0.07)
    hc = PP.head_round_face(g, expr, cheek_base=0.85, eye_k=1.05, brow_k=1.1)
    PP.hair_round(g, "short", hc)
    CF.strands(g, hc, "bun")
    # chignon haut piqué d'un crayon
    lobe(g, hc, (0, 0.05, 0.2), (0.075, 0.07, 0.06), segs=8, rings=5)
    lobe(g, hc, (0, 0.05, 0.245), (0.05, 0.048, 0.03), segs=6, rings=4, color="hair_dark")
    seg(g, (-0.09, 0.08, hc + 0.2), (0.08, 0.02, hc + 0.25), 0.007, 0.007, "scarf", bone="head", segs=6)
    seg(g, (0.08, 0.02, hc + 0.25), (0.1, 0.013, hc + 0.256), 0.007, 0.002, "scarf_mark", bone="head", segs=6)
    PP.neck(g)
    gingham = checker("top", "top_trim", 16, 0.045, 0.955)
    loft_n(g, subdivide_rings(rings_, 3), 16, gingham, weights=PP.torso_weights, close_bottom=False)
    PP.collar(g, color="extra_b", w=0.19)
    skirt_fn(g, 1.0, 0.40, 0.215, 0.335, checker("top", "top_trim", 16, 0.06, 0.43), segs=16, sub=3)
    apron_on_skirt(g, (1.0, 0.40, 0.215, 0.335), 1.0, 0.47, 0.27, 0.34, "extra_a")
    for side in ("l", "r"):
        arm_k(g, side, sleeve="rolled", top=gingham, trim="top_trim", skin="skin", puff=1.1, k=1.08)
        PP.leg_round(g, side, thigh="scarf_mark", shin="scarf_mark", r=0.08)
    PP.hands_round(g)


def v_leon(g, expr):
    s = 1.08
    rings_ = PP.torso_rings(0.33, 0.30, 0.20)
    hc = PP.head_round_face(g, expr, s=s, eye_k=1.12, cheek_base=0.35, brow_k=1.35)
    PP.hair_round(g, "sides", hc, s)
    # épi: deux mèches dressées qui sortent de sous la casquette, derrière
    for sx, a in ((1, 18), (-1, -10)):
        lobe(g, hc, (sx * 0.035 * s, 0.17 * s, 0.05 * s), (0.022 * s, 0.02 * s, 0.055 * s), segs=6, rings=4,
             rot=(-62, a, 0))
    # casquette de cheminot trop grande, rouge passé, visière noire de travers
    top = PP.hat_top(hc, s, 0.085)
    cv = g.lathe([(0.19 * s, top - 0.012), (0.195 * s, top + 0.04 * s)], colors="extra_b", segs=12, bone="head")
    cv += g.lathe([(0.195 * s, top + 0.04 * s), (0.215 * s, top + 0.1 * s), (0.19 * s, top + 0.13 * s),
                   (0.0, top + 0.135 * s)], colors="extra_b", segs=12, close_bottom=False, bone="head")
    cv += g.sphere(1.0, loc=(0, -0.19 * s, top + 0.005), color="eye", segs=10, rings=4,
                   scale=(0.11 * s, 0.055 * s, 0.013 * s), rot=(-26, 0, 0), bone="head")
    cv += g.box((0.04, 0.012, 0.03), loc=(0, -0.2 * s, top + 0.055 * s), color="metal", bevel=0.005, bone="head")
    g.transform(cv, Matrix.Translation((0, 0, hc)) @ Matrix.Rotation(math.radians(-8), 4, "Y")
                @ Matrix.Rotation(math.radians(-6), 4, "X") @ Matrix.Translation((0, 0, -hc)))
    g.cyl(0.05, 0.10, loc=(0, 0, 1.41), color="skin", segs=8, bone="neck")
    PP.torso_round(g, w_top=0.33, w_bot=0.30, d=0.20)
    PP.collar(g, color="top_trim", w=0.16)
    # chemise sortie: le pan blanc dépasse sous les bretelles
    PP.coat_skirt_round(g, 0.163, 0.124, 0.86, 0.99, color="top")
    PP.pelvis_round(g, w=0.30, d=0.20)
    suspenders(g, rings_, "extra_a", z_bot=0.94)
    # sifflet de chef de train en fer-blanc, au cou sur un lacet brun
    yl = PP.torso_front_y(1.24, rings_)
    strap(g, [(-0.05, -0.05, 1.395), (-0.012, yl - 0.012, 1.25)], 0.008, 0.006, "extra_a")
    strap(g, [(0.05, -0.05, 1.395), (0.012, yl - 0.012, 1.25)], 0.008, 0.006, "extra_a")
    g.cyl(0.013, 0.05, loc=(0.0, yl - 0.02, 1.225), color="metal", segs=6, rot=(0, 0, 0), bone="chest")
    g.box((0.014, 0.02, 0.02), loc=(0.0, yl - 0.032, 1.255), color="metal", bone="chest")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="rolled", top="top", trim="top_trim")
        PP.leg_round(g, side, thigh="bottom", shin="skin", r=0.085)
        shin_wrap(g, side, 0.09, 0.27, 0.06, 0.068, "scarf_mark")
        # ourlet des culottes juste au-dessus du genou (le genou ne perce plus le bas du velours)
        g.lathe([(0.086, 0.5), (0.084, 0.55)], loc=((1 if side == "l" else -1) * 0.092, 0, 0), colors="bottom",
                segs=6, bone="thigh_" + side)
    # genou gauche écorché: pansement en croix, sous l'ourlet
    g.box((0.05, 0.012, 0.018), loc=(0.092, -0.072, 0.455), color="scarf", bone="shin_l")
    g.box((0.018, 0.012, 0.05), loc=(0.092, -0.073, 0.455), color="scarf", bone="shin_l")
    PP.hands_round(g)


def v_ambroise(g, expr):
    rings_ = PP.torso_rings(0.35, 0.31, 0.21, belly=0.04)
    before = set(g.bm.verts)
    hc = PP.head_round_face(g, expr, brow_k=2.0, eye_k=0.86)
    big_nose(g, hc, (0.03, 0.024, 0.032), dz=-0.004)
    # crâne chauve, couronne de cheveux blancs au-dessus des oreilles et derrière, favoris
    for k in range(9):
        a = math.radians(-116 + 29 * k)
        x, y = 0.158 * math.sin(a), 0.148 * math.cos(a)
        lobe(g, hc, (x, y, 0.025 + 0.01 * (k % 2)), (0.04, 0.034, 0.032), segs=6, rings=4,
             rot=(0, 0, -math.degrees(a)), color="hair" if k % 2 == 0 else "hair_dark")
    for sx in (1, -1):
        lobe(g, hc, (sx * 0.168, -0.055, -0.025), (0.026, 0.04, 0.068), segs=6, rings=4)
    nudge_head(g, before, (0, -0.015, -0.012))
    PP.neck(g)
    PP.torso_round(g, w_top=0.35, w_bot=0.31, d=0.21, belly=0.04)
    # gilet noir dans l'encolure de la blouse, chaîne de montre de laiton
    front_band(g, rings_, 0.0, 0.07, 1.12, 1.37, "scarf", off=0.003)
    yc = PP.torso_front_y(1.2, rings_) - 0.012
    strap(g, [(0.0, yc, 1.215), (-0.025, yc, 1.192), (-0.05, yc + 0.003, 1.2)], 0.006, 0.006, "metal")
    PP.collar(g, color="top_trim", w=0.16)
    PP.buttons(g, n=4, z0=0.7, z1=1.08, color="top_trim", rings=rings_)
    # blouse d'atelier jusqu'aux genoux
    PP.skirt(g, z_top=0.99, z_bot=0.56, r_top=0.19, r_bot=0.25, color="top", segs=12)
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="long", top="top", trim="top", puff=1.0)
        s = 1 if side == "l" else -1
        g.lathe([(0.062, 0.86), (0.069, 0.95), (0.064, 1.03)], loc=(s * 0.231, 0, 0), colors="scarf_mark", segs=6,
                bone="forearm_" + side)
        PP.leg_round(g, side, thigh="bottom", cuff="bottom", r=0.078)
    PP.hands_round(g)


def v_nour(g, expr):
    rings_ = PP.torso_rings(0.36, 0.30, 0.21)
    hc = PP.head_round_face(g, expr, cheek_base=0.45, eye_k=1.08, brow_k=1.1)
    CF._hair_cut_base(g, "curls", hc)
    # queue de cheval bouclée
    lobe(g, hc, (0, 0.165, 0.07), (0.035, 0.03, 0.03), segs=6, rings=4, color="hair_dark")
    for i, (y, z, r) in enumerate(((0.2, -0.0, 0.055), (0.215, -0.08, 0.05), (0.21, -0.15, 0.042))):
        lobe(g, hc, (0.01 * (i % 2), y, z), (r, r * 0.9, r), segs=6, rings=4,
             color="hair" if i % 2 == 0 else "hair_dark", bone="head" if i == 0 else "neck")
    PP.neck(g)
    PP.torso_round(g, w_top=0.36, w_bot=0.30, d=0.21)
    PP.coat_skirt_round(g, 0.163, 0.122, 0.79, 0.98)
    PP.collar(g, color="top_trim", w=0.17)
    PP.buttons(g, n=4, z0=0.9, z1=1.3, color="metal", rings=rings_)
    for sx in (1, -1):
        g.box((0.075, 0.012, 0.07), loc=(sx * 0.075, PP.torso_front_y(1.22, rings_) - 0.004, 1.21), color="top_trim",
              bone="chest")
        g.box((0.08, 0.012, 0.08), loc=(sx * 0.085, -0.135, 0.86), color="top_trim", rot=(-4, 0, 0), bone="hips")
    # stéthoscope autour du cou, pavillon sur la poitrine
    yl = PP.torso_front_y(1.2, rings_)
    strap(g, [(-0.065, -0.03, 1.4), (-0.06, yl - 0.012, 1.3), (-0.04, yl - 0.012, 1.2)], 0.01, 0.01, "scarf")
    strap(g, [(0.065, -0.03, 1.4), (0.06, yl - 0.012, 1.3), (0.05, yl - 0.012, 1.24)], 0.01, 0.01, "scarf")
    strap(g, [(-0.065, -0.03, 1.4), (0.0, 0.07, 1.41), (0.065, -0.03, 1.4)], 0.01, 0.01, "scarf")
    g.cyl(0.02, 0.012, loc=(-0.04, yl - 0.02, 1.19), color="scarf_mark", segs=8, rot=(90, 0, 0), bone="chest")
    # grosse sacoche de cuir de vétérinaire à la hanche gauche, bandoulière de l'épaule droite
    strap(g, [(-0.12, -0.02, 1.4), (-0.06, PP.torso_front_y(1.3, rings_) - 0.008, 1.3),
              (0.1, PP.torso_front_y(1.06, rings_) - 0.008, 1.06), (0.2, -0.05, 0.98)], 0.035, 0.012, "extra_b")
    strap(g, [(-0.12, 0.02, 1.4), (-0.04, 0.14, 1.28), (0.12, 0.13, 1.06), (0.2, 0.05, 0.98)], 0.035, 0.012,
          "extra_b")
    g.box((0.085, 0.28, 0.21), loc=(0.225, -0.01, 0.9), color="extra_a", bevel=0.025, bseg=2, bone="hips")
    g.box((0.09, 0.285, 0.085), loc=(0.227, -0.01, 0.975), color="extra_b", bevel=0.018, bone="hips")
    for dy in (-0.07, 0.05):
        g.box((0.012, 0.02, 0.03), loc=(0.273, dy, 0.94), color="metal", bone="hips")
    for side in ("l", "r"):
        PP.arm_round(g, side, sleeve="rolled", top="top", trim="top_trim", puff=1.04)
        PP.leg_round(g, side, thigh="bottom", cuff=None, r=0.074)
        shin_wrap(g, side, 0.05, 0.37, 0.066, 0.078, "shoes")
    PP.hands_round(g)


def v_colette(g, expr):
    rings_ = PP.torso_rings(0.40, 0.35, 0.235, belly=0.05)
    hc = PP.head_round_face(g, expr, cheek_base=0.5, brow_k=1.2)
    PP.hair_round(g, "bob", hc)
    CF.strands(g, hc, "bob")
    # frange droite, posée sur le front au-dessus des sourcils
    lobe(g, hc, (0, -0.112, 0.118), (0.145, 0.034, 0.042), segs=10, rings=4, rot=(16, 0, 0))
    # les boucles d'oreilles de la fiche restent cachées sous le carré: pas de pièce (elle se poserait sur l'épaule)
    PP.neck(g)
    PP.torso_round(g, w_top=0.40, w_bot=0.35, d=0.235, belly=0.05)
    PP.collar(g, color="top_trim", w=0.17)
    PP.buttons(g, n=3, z0=1.12, z1=1.3, color="top_trim", rings=rings_)
    PP.skirt(g, z_top=1.0, z_bot=0.42, r_top=0.21, r_bot=0.32, color="bottom", segs=12)
    # tablier noir court de serveuse, plaqué sur la jupe
    apron_on_skirt(g, (1.0, 0.42, 0.21, 0.32), 1.0, 0.66, 0.27, 0.33, "extra_a", rows=4)
    # torchon rayé sur l'épaule gauche, un pan devant et un derrière
    for y0, sgn, h in ((PP.torso_front_y(1.31, rings_) - 0.008, -1, 0.15), (-PP.torso_front_y(1.28, rings_) + 0.008, 1, 0.2)):
        zc = 1.385 - h / 2
        vs = g.box((0.085, 0.012, h), color="scarf", bone="chest")
        for dz in (0.03, 0.05):
            vs += g.box((0.087, 0.016, 0.012), loc=(0, 0, -h / 2 + dz), color="scarf_mark", bone="chest")
        g.transform(vs, Matrix.Translation((0.135, y0, zc)) @ Matrix.Rotation(math.radians(-10), 4, "Y")
                    @ Matrix.Rotation(math.radians(sgn * 14), 4, "X"))
    g.box((0.085, 0.2, 0.016), loc=(0.135, 0.0, 1.38), color="scarf", rot=(0, -10, 0), bone="chest")
    for side in ("l", "r"):
        arm_k(g, side, sleeve="rolled", top="top", trim="top_trim", skin="skin", puff=1.08, k=1.05)
        PP.leg_round(g, side, thigh="hair_dark", shin="hair_dark", r=0.078)
    PP.hands_round(g)


# Pièces portées et accessoires -------------------------------------------------------------------------------

def ambroise_loupe(g, expr, raised):
    """Loupe d'horloger sur un serre-tête de fil: vissée à l'oeil gauche (au travail), ou relevée sur le front
    (en marchant). Pièce à part, à fusionner avec `villager_ambroise` comme l'écharpe de Firmin."""
    hc = PP.PHC + PP.PHEAD[2] - PP.PHEAD[2]
    d = Vector((0, -0.015, -0.012))
    zb = hc + 0.095
    bv = g.lathe([(0.152, zb - 0.006), (0.152, zb + 0.006)], colors="metal", segs=12, scale=(1.0, 0.95, 1.0),
                 close_bottom=False, close_top=False, bone="head")
    g.transform(bv, Matrix.Translation(d))
    if raised:
        c = Vector((0.05, -0.15, hc + 0.13)) + d
        rot = (25, 0, 0)
    else:
        c = Vector((0.05, -0.192, hc + 0.035)) + d
        rot = (90, 0, 0)
    vs = g.cyl(0.024, 0.04, loc=tuple(c), r2=0.02, color="extra_a", segs=8, rot=rot, bone="head")
    n = (Matrix.Rotation(math.radians(rot[0]), 3, "X") @ Vector((0, 0, 1)))
    g.cyl(0.019, 0.004, loc=tuple(c + n * 0.021), color="extra_b", segs=8, rot=rot, bone="head")
    side = Vector((0.12, -0.11, hc + 0.1)) + d
    seg(g, side, c + Vector((0.02, 0.0, 0.0)), 0.003, 0.003, "metal", bone="head", segs=4)
    return vs


def school_satchel(g):
    """Cartable de cuir d'Armand: origine à la poignée, le cartable pend dessous (comme les outils de ferme.glb)."""
    g.box((0.36, 0.11, 0.26), loc=(0, 0, -0.17), color="skin", bevel=0.02, bseg=2)
    g.box((0.365, 0.115, 0.14), loc=(0, 0.0, -0.1), color="skin_shade", bevel=0.015)
    for sx in (1, -1):
        g.box((0.035, 0.12, 0.13), loc=(sx * 0.1, -0.003, -0.14), color="skin_shade")
        g.box((0.03, 0.124, 0.024), loc=(sx * 0.1, -0.003, -0.19), color="extra_a")
    seg(g, (-0.06, 0, -0.04), (-0.05, 0, 0.015), 0.01, 0.01, "skin_shade", segs=5)
    seg(g, (-0.05, 0, 0.015), (0.05, 0, 0.015), 0.01, 0.01, "skin_shade", segs=5)
    seg(g, (0.05, 0, 0.015), (0.06, 0, -0.04), 0.01, 0.01, "skin_shade", segs=5)
    return g


def milk_can(g):
    """Pot à lait de fer-blanc de Margot (5 litres): origine à l'anse."""
    g.lathe([(0.075, -0.33), (0.085, -0.31), (0.085, -0.17), (0.06, -0.12), (0.045, -0.1), (0.05, -0.085),
             (0.05, -0.075)], colors=["mouth", "top", "top", "mouth", "mouth", "mouth"], segs=10, close_bottom=True)
    g.lathe([(0.054, -0.08), (0.054, -0.06), (0.025, -0.05), (0.0, -0.045)], colors="mouth", segs=10,
            close_bottom=False)
    g.lathe([(0.088, -0.25), (0.088, -0.235)], colors="mouth", segs=10)
    g.lathe([(0.088, -0.17 - 0.01), (0.088, -0.165)], colors="mouth", segs=10)
    pts = [(0.0, -0.0)]
    for k in range(7):
        a = math.radians(180 * k / 6)
        pts.append((0.062 * math.cos(a), -0.1 + 0.095 * math.sin(a)))
    for a, b in zip(pts[1:], pts[2:]):
        seg(g, (a[0], 0, a[1]), (b[0], 0, b[1]), 0.005, 0.005, "bottom", segs=4)
    return g


def felling_axe(g):
    """Hache de bûcheron de Barnabé: manche de 0,85 m, fer large; origine à la prise (main haute), le fer en bas,
    tranchant vers l'avant (-Y, +Z glTF), comme la hache de ferme.glb."""
    seg(g, (0, 0.0, 0.08), (0, -0.01, -0.77), 0.019, 0.022, "hair", segs=6)
    seg(g, (0, -0.01, -0.77), (0, -0.012, -0.8), 0.024, 0.02, "hair_dark", segs=6)
    g.box((0.04, 0.12, 0.085), loc=(0, -0.025, -0.7), color="top_trim", bevel=0.006)
    g.prism([(-0.075, 0.042), (-0.075, -0.042), (-0.17, -0.09), (-0.185, 0.0), (-0.17, 0.09)], 0.036,
            loc=(0, 0, -0.7), color="top_trim", rot=(0, 0, 90))
    g.box((0.012, 0.016, 0.17), loc=(0, -0.182, -0.7), color="bottom")
    return g


def accordion(g):
    """Accordéon de l'oncle de Colette (P1): soufflet rouge et noir entre deux caisses; origine au centre, clavier
    à droite (côté main droite), sangles côté corps (+Y Blender)."""
    for sx, col in ((-1, "shoes"), (1, "shoes")):
        g.box((0.07, 0.17, 0.3), loc=(sx * 0.15, 0, 0), color=col, bevel=0.02, bseg=1)
    g.box((0.03, 0.12, 0.27), loc=(-0.2, -0.01, 0), color="scarf", bevel=0.006)
    for k in range(7):
        x = -0.1 + k * 0.033
        g.box((0.026, 0.18 + 0.02 * (k % 2), 0.31 + 0.02 * (k % 2)), loc=(x, 0, 0),
              color="scarf_mark" if k % 2 else "shoes")
    for sx in (-1, 1):
        g.box((0.072, 0.004, 0.06), loc=(sx * 0.15, -0.088, 0.09), color="extra_a")
    return g


# Vélos: origine sous celui qui pousse; le vélo à sa gauche (+X), roue avant devant (-Y), roues en nœuds enfants
# (tourner autour de leur X local: angle = distance / WHEEL_R).

def wheel(g, color_tyre="hair", rim="eye", hub="metal"):
    segs = 12
    pts, faces = [], []
    sec = [(WHEEL_R, -0.018), (WHEEL_R + 0.012, 0.0), (WHEEL_R, 0.018), (WHEEL_R - 0.022, 0.0)]
    ns = len(sec)
    for k in range(segs):
        a = 2 * math.pi * k / segs
        for r, x in sec:
            pts.append((x, r * math.cos(a), r * math.sin(a)))
    for k in range(segs):
        k2 = (k + 1) % segs
        for j in range(ns):
            j2 = (j + 1) % ns
            faces.append((k * ns + j, k2 * ns + j, k2 * ns + j2, k * ns + j2))

    def col(face):
        c = face.calc_center_median()
        return color_tyre if math.hypot(c.y, c.z) > WHEEL_R - 0.008 else rim
    vs = g.mesh(pts, faces, col)
    fix_normals(g, vs)
    for k in range(3):
        a = math.radians(60 * k + 10)
        p = Vector((0, math.cos(a), math.sin(a))) * (WHEEL_R - 0.02)
        seg(g, -p, p, 0.0035, 0.0035, hub, segs=4)
    g.cyl(0.028, 0.08, loc=(0, 0, 0), color=hub, segs=6, rot=(0, 90, 0))
    return g


def bicycle(A_geo, who):
    """Cadre, guidon, selle, pédalier, garde-boue et accessoires; roues à part (wheel). Renvoie la Geo du cadre."""
    g = A_geo()
    x = BIKE_X
    fa, ra, ax = AXLE_FRONT, AXLE_REAR, WHEEL_R
    frame = "skin_shade" if who == "martial" else "skin"
    bb = Vector((x, -0.04, 0.29))
    seat = Vector((x, 0.07, 0.8))
    head_t = Vector((x, -0.5, 0.86))
    head_b = Vector((x, -0.53, 0.66))
    r = 0.017
    seg(g, bb, seat, r, r, frame)
    seg(g, bb, head_b, r * 1.1, r * 1.1, frame)
    seg(g, head_b, head_t, 0.02, 0.02, frame)
    if who == "martial":
        seg(g, seat, head_t + Vector((0, 0, -0.02)), r, r, frame)
    else:
        # cadre ouvert (factrice, vétérinaire): tube bas et courbe
        mid = Vector((x, -0.3, 0.5))
        seg(g, seat + Vector((0, -0.02, -0.12)), mid, r, r, frame)
        seg(g, mid, head_b + Vector((0, 0.02, 0.08)), r, r, frame)
    for sx in (1, -1):
        rr = Vector((x + sx * 0.04, ra, ax))
        seg(g, bb + Vector((sx * 0.02, 0, 0)), rr, 0.011, 0.01, frame, segs=5)
        seg(g, seat + Vector((sx * 0.015, 0.0, -0.02)), rr, 0.011, 0.01, frame, segs=5)
        ff = Vector((x + sx * 0.04, fa, ax))
        seg(g, head_b + Vector((sx * 0.02, 0, 0)), ff, 0.013, 0.011, frame, segs=5)
    # tige de selle, selle de cuir
    seg(g, seat, seat + Vector((0, 0.02, 0.1)), 0.012, 0.012, "metal", segs=5)
    g.sphere(1.0, loc=(x, 0.06, 0.915), color="mouth", segs=8, rings=4, scale=(0.075, 0.13, 0.03))
    # potence et guidon: poignée gauche (côté personnage) sous la main gauche
    stem = Vector((x, -0.5, 0.97))
    seg(g, head_t, stem, 0.014, 0.014, "metal", segs=5)
    hb = HAND_ON_BAR
    if who == "martial":
        # cintre de course: hauts du guidon à plat, crosses qui descendent devant
        lx = x - (x - hb.x) * 0.95
        hx = 2 * x - lx
        bar = [Vector((lx, hb.y - 0.06, hb.z - 0.02)), Vector((hx, hb.y - 0.06, hb.z - 0.02))]
        seg(g, stem, Vector((x, bar[0].y, bar[0].z)), 0.012, 0.012, "metal", segs=5)
        seg(g, bar[0], bar[1], 0.012, 0.012, "eye", segs=6)
        for p in bar:
            c1 = p + Vector((0, -0.08, -0.03))
            c2 = p + Vector((0, -0.06, -0.13))
            c3 = p + Vector((0, 0.02, -0.15))
            seg(g, p, c1, 0.013, 0.013, "mouth", segs=6)
            seg(g, c1, c2, 0.013, 0.013, "mouth", segs=6)
            seg(g, c2, c3, 0.013, 0.013, "mouth", segs=6)
        # pompe à vélo sous le tube horizontal, tenue par deux colliers
        p0, p1 = seat + Vector((0, -0.07, -0.04)), head_t + Vector((0, 0.08, -0.07))
        seg(g, p0, p1, 0.014, 0.014, "cheek", segs=6)
        t0, t1 = seat, head_t + Vector((0, 0, -0.02))
        for f in (0.2, 0.8):
            a, b = p0.lerp(p1, f), t0.lerp(t1, f + 0.05 * (1 if f < 0.5 else -1))
            seg(g, a, b, 0.006, 0.006, "metal", segs=4)
    else:
        lg = Vector((hb.x, hb.y, hb.z))
        rg = Vector((2 * x - hb.x, hb.y, hb.z))
        mid_l = Vector((x - 0.1, -0.5, 0.98))
        mid_r = Vector((x + 0.1, -0.5, 0.98))
        seg(g, mid_l, mid_r, 0.012, 0.012, "eye", segs=6)
        seg(g, mid_l, lg + Vector((0.05, 0, 0)), 0.012, 0.012, "eye", segs=6)
        seg(g, mid_r, rg + Vector((-0.05, 0, 0)), 0.012, 0.012, "eye", segs=6)
        for p in (lg, rg):
            seg(g, p + Vector((0.055 * (1 if p.x < x else -1), 0, 0)), p - Vector((0.045 * (1 if p.x < x else -1), 0, 0)),
                0.016, 0.016, "mouth", segs=6)
        # sonnette de laiton
        g.cyl(0.022, 0.02, loc=(x - 0.13, -0.5, 1.0), color="top", segs=8)
        # garde-boue
        for axle, a0, a1 in ((fa, 200, 330), (ra, 210, 350)):
            pts = []
            for k in range(6):
                a = math.radians(a0 + (a1 - a0) * k / 5)
                pts.append(Vector((x, axle + (ax + 0.04) * math.cos(a), ax - (ax + 0.04) * math.sin(a))))
            for p0, p1 in zip(pts, pts[1:]):
                seg(g, p0, p1, 0.03, 0.03, frame, segs=4)
    # pédalier: plateau, manivelles, pédales
    g.cyl(0.09, 0.012, loc=(x - 0.035, bb.y, bb.z), color="metal", segs=10, rot=(0, 90, 0))
    for sx, sgn in ((-1, 1), (1, -1)):
        tip = Vector((x + sx * 0.06, bb.y + sgn * 0.11, bb.z - sgn * 0.08))
        seg(g, Vector((x + sx * 0.05, bb.y, bb.z)), tip, 0.01, 0.01, "metal", segs=4)
        g.box((0.08, 0.05, 0.02), loc=(tip.x + sx * 0.03, tip.y, tip.z), color="hair")
    # chaîne
    seg(g, Vector((x - 0.04, bb.y, bb.z + 0.09)), Vector((x - 0.04, ra, ax + 0.04)), 0.006, 0.006, "hair", segs=4)
    seg(g, Vector((x - 0.04, bb.y, bb.z - 0.09)), Vector((x - 0.04, ra, ax - 0.04)), 0.006, 0.006, "hair", segs=4)
    if who == "lucie":
        # porte-bagages et deux sacoches de cuir, plaque jaune de la poste
        g.box((0.14, 0.34, 0.016), loc=(x, 0.36, 0.72), color="metal")
        for sx in (1, -1):
            seg(g, Vector((x + sx * 0.06, 0.48, 0.72)), Vector((x + sx * 0.04, ra, ax)), 0.008, 0.008, "metal",
                segs=4)
            g.box((0.07, 0.24, 0.2), loc=(x + sx * 0.1, 0.38, 0.6), color="shoes", bevel=0.018)
            g.box((0.075, 0.245, 0.06), loc=(x + sx * 0.101, 0.38, 0.67), color="hair_dark", bevel=0.01)
        g.box((0.004, 0.16, 0.1), loc=(x - 0.025, -0.18, 0.7), color="scarf", rot=(0, 0, 0))
        g.box((0.0045, 0.1, 0.03), loc=(x - 0.026, -0.18, 0.72), color="scarf_mark")
    elif who == "nour":
        # panier d'osier devant le guidon
        g.lathe([(0.13, 0.98), (0.15, 1.12), (0.155, 1.15)], loc=(x, -0.68, 0), colors=["top_trim", "bottom"],
                segs=8, scale=(1.0, 0.75, 1.0), close_top=False)
        g.lathe([(0.15, 1.13), (0.16, 1.16)], loc=(x, -0.68, 0), colors="bottom", segs=8, scale=(1.0, 0.75, 1.0))
        seg(g, Vector((x, -0.55, 0.96)), Vector((x, -0.62, 1.0)), 0.01, 0.01, "metal", segs=4)
    # catadioptre rouge à l'arrière: sur le garde-boue (posé sur sa courbe), ou sous la selle du vélo de course
    if who == "martial":
        g.box((0.04, 0.012, 0.03), loc=(x, seat.y + 0.02, seat.z - 0.03), color="extra_b")
    else:
        a = math.radians(312)
        rr = ax + 0.04 + 0.016
        g.box((0.045, 0.012, 0.03), loc=(x, ra + rr * math.cos(a), ax - rr * math.sin(a)), color="extra_b",
              rot=(-48, 0, 0))
    return g


# Clips de la 0.13 ------------------------------------------------------------------------------------------

def solve_left_arm(arm, target):
    """Rotations (degrés, repère des os comme les clips) du bras gauche qui posent la prise de la main sur target."""
    import itertools  # noqa: F401
    pb = {n: arm.pose.bones[n] for n in ("upper_arm_l", "forearm_l", "hand_l")}

    def place(p):
        pb["upper_arm_l"].rotation_euler = tuple(math.radians(a) for a in (p[0], p[1], p[2]))
        pb["forearm_l"].rotation_euler = (math.radians(p[3]), 0, 0)
        pb["hand_l"].rotation_euler = (math.radians(-15), 0, 0)
        bpy.context.view_layer.update()
        b = pb["hand_l"]
        mid = arm.matrix_world @ ((b.head + b.tail) / 2)
        return (mid - target).length
    p = [40.0, 0.0, -10.0, 20.0]
    best = place(p)
    step = 8.0
    while step > 0.2:
        moved = False
        for i in range(4):
            for d in (step, -step):
                q = list(p)
                q[i] += d
                e = place(q)
                if e < best - 1e-6:
                    best, p, moved = e, q, True
        if not moved:
            step /= 2
    for b in pb.values():
        b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    return {"upper_arm_l": (p[0], p[1], p[2]), "forearm_l": (p[3], 0, 0), "hand_l": (-15, 0, 0)}, best


def push_bike_clips(A, arm):
    """`push_bike`: marcher à côté du vélo, main gauche sur la poignée (mêmes pas que walk, 0,533 s);
    `push_bike_idle`: arrêté à côté du vélo (3 s). Le vélo se pose avec la même position et la même orientation que
    le personnage."""
    import animations_012 as A12
    hold, err = solve_left_arm(arm, HAND_ON_BAR)
    A["push_bike"] = (True, A12.walk_cycle(swing=26, bob=0.026, arm=24, arms=hold, lean=3))
    base = A12.merge(A12.ARMS, hold)
    A["push_bike_idle"] = (True, {0: base, 45: A12.merge(base, {"chest": (-2.5, 0, 0), "head": (0, 8, 0),
                                                                "hips_loc": (0, 0.004, 0)}), 90: base})
    return err
