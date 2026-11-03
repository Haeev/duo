"""Bâtiments neufs du village agrandi de la 0.13 (docs/jeux/jeu-1/v0-13-carte.md, sections 4, 7.1, 7.2, 11.3 et
17; lot L2, première moitié): église Saint-Aubin et son clocher, presbytère, café de la Côte, forge, menuiserie,
logis et grange-étable de la ferme, moulin de la Vanne et sa roue animée, maison forestière, lavoir, maisons du
village (sacristain, hameau, cheminots), passerelles du bief (`sluice_footbridge`, `tailrace_planks`).

Lancer: duo-python village_013.py
Produit: assets/modeles/village013.glb, stats/village013.json, blend/village013.blend
(planches: planche_batiments_013.py).

Noms des nœuds racines = types de la carte (`donnees/cartes-0-13/halte.json`). Repères Blender: porte vers -Y
(+Z glTF), +X à droite vu de dehors, origine au centre de l'emprise, au sol. Les coordonnées de la carte sont
traduites dans chaque fonction (« X, Y de la carte » en commentaire), selon la rotation de l'objet:
rotation 0: x = X - cx, y = cy - Y; rotation 1 (façade à l'est): x = cy - Y, y = cx - X;
rotation 2 (façade au nord): x = cx - X, y = Y - cy.
Bâtiments visitables (ADR 0016): murs du rez-de-chaussée `<type>_wall_front | back | left | right` (coupés
selon la caméra), toit, étage ou comble dans `cut_nodes`, sol `<type>_floor`, contenu `<type>_interior`,
vantaux `<type>_door` (pivot sur le gond). Sol intérieur à 0,12 m (hauteur `floor` de la carte).
"""
import math
import os
import random
import sys

import bpy  # noqa: I001
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lpl  # noqa: E402
import bourg as B  # noqa: E402
import details_012 as D  # noqa: E402
import interieurs as I  # noqa: E402
from interieurs import Footprints, Piece, blocked_cells, door_frame, glazed  # noqa: E402
from lpl import by_normal  # noqa: E402

FL = 0.12  # dessus du sol intérieur (hauteur `floor` des cases de bâtiment)
SIDES = ("front", "back", "left", "right")
INWARD = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (1, 0, 0), "right": (-1, 0, 0)}

# Lettres de plus pour les enseignes peintes (même grille de 5 rangées que interieurs.SIGN_FONT)
EXTRA_LETTERS = {
    "S": ("0111", "1000", "0110", "0001", "1110"),
    "T": ("111", "010", "010", "010", "010"),
    "D": ("1110", "1001", "1001", "1001", "1110"),
    "V": ("10001", "10001", "01010", "01010", "00100"),
    "H": ("1001", "1001", "1111", "1001", "1001"),
    " ": ("00", "00", "00", "00", "00"),
}
for _k, _v in EXTRA_LETTERS.items():
    I.SIGN_FONT.setdefault(_k, _v)


# Outils ------------------------------------------------------------------------------------------------

class OFace(B.Face):
    """Repère d'un mur (bourg.Face) dont le bâtiment est centré en x = ox."""

    def __init__(self, side, hx, hy, ox=0.0):
        super().__init__(side, hx, hy)
        self.ox = ox

    def p(self, u, d, z):
        x, y, zz = super().p(u, d, z)
        return (x + self.ox, y, zz)


def solid(g, verts, faces, color):
    """Volume fait main: faces orientées vers l'extérieur après coup, couleur posée ensuite (normales justes)."""
    vv = g.mesh(verts, faces, "stone")
    bmesh.ops.recalc_face_normals(g.bm, faces=list({f for v in vv for f in v.link_faces}))
    return g.recolor(vv, color)


def slab_ccw(g, pts, thick, color):
    """bourg.slab, dans le bon sens quel que soit l'ordre des coins (épaisseur toujours vers le bas)."""
    a, b, _, d = [Vector(p) for p in pts]
    if (b - a).cross(d - a).z < 0:
        pts = list(reversed(pts))
    return B.slab(g, pts, thick, color)


def half_disc(g, cx, r, z, color, n=8, side=1):
    """Demi-disque de x = cx vers +X (side 1), de 0 à z (sol de l'abside)."""
    ring = [(cx + side * r * math.cos(-math.pi / 2 + math.pi * k / n), r * math.sin(-math.pi / 2 + math.pi * k / n))
            for k in range(n + 1)]
    vs = [(cx, 0.0, z)] + [(x, y, z) for x, y in ring] + [(cx, 0.0, 0.0)] + [(x, y, 0.0) for x, y in ring]
    m = n + 2
    faces = [(0, 1 + k, 2 + k) for k in range(n)] + [(m, m + 2 + k, m + 1 + k) for k in range(n)]
    faces += [(1 + k, m + 1 + k, m + 2 + k, 2 + k) for k in range(n)]
    faces += [(0, m, m + 1, 1), (0, 1 + n, m + 1 + n, m)]
    return solid(g, vs, faces, color)


def pierced_wall(g, f, L, t, h, openings, col, z0=0.0):
    """Mur percé (comme interieurs.pierced_wall), qui accepte aussi des ouvertures superposées dans une même
    travée (porte sous une baie de clocher, meurtrière sous le beffroi): bandes pleines entre elles."""
    columns = []
    for (u, w, zb, zt) in sorted(openings):
        a, b = u - w / 2, u + w / 2
        if columns and a < columns[-1][1] - 1e-4:
            columns[-1][1] = max(columns[-1][1], b)
            columns[-1][2].append((a, b, zb, zt))
        else:
            columns.append([a, b, [(a, b, zb, zt)]])

    def band(a, b, za, zb_):
        if b - a > 1e-4 and zb_ - za > 1e-4:
            f.box(g, (b - a, t, zb_ - za), (a + b) / 2, -t / 2, (za + zb_) / 2, col)

    us = -L / 2
    for a, b, lst in columns:
        band(us, a, z0, h)
        z = z0
        for (oa, ob, zb, zt) in sorted(lst, key=lambda o: o[2]):
            band(a, b, z, zb)
            band(a, oa, zb, min(zt, h))
            band(ob, b, zb, min(zt, h))
            z = zt
        band(a, b, z, h)
        us = b
    band(us, L / 2, z0, h)


def box_flowers(f, g, u, d, z, w):
    """Jardinière d'appui: feuillage en boules jointives, fleurs posées dans le feuillage (aucune ne flotte).
    Remplace details_012.box_flowers dans ce script (interieurs.glazed l'appelle par le module)."""
    n = max(4, int(w / 0.12))
    cols = ["flower_red", "flower_pink", "flower_white", "flower_red", "flower_yellow"]
    for k in range(n):
        uu = u - w / 2 + 0.06 + k * (w - 0.12) / (n - 1)
        g.sphere(0.075, loc=f.p(uu, d, z + 0.07), color="leaf_bush", segs=6, rings=4, scale=(1.1, 1.0, 0.75))
    for k in range(n - 1):
        uu = u - w / 2 + 0.12 + k * (w - 0.24) / max(1, n - 2)
        g.sphere(0.04, loc=f.p(uu, d - 0.02 + 0.02 * (k % 2), z + 0.11 + 0.01 * (k % 2)), color=cols[k % len(cols)],
                 segs=6, rings=3)


D.box_flowers = box_flowers


def T(v):
    return Matrix.Translation(Vector(v))


def Rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, "Z")


def wall_len(side, hx, hy, t):
    return 2 * hx if side in ("front", "back") else 2 * hy - 2 * t


def word(g, f, u, d, z, text, px, color):
    """Mot peint (police des enseignes), accents É, È et Ô compris."""
    base = text.replace("È", "E").replace("Ô", "O")
    I.painted_word(g, f, u, d, z, base.replace("É", "É"), px, color)
    x = u - I.sign_word_width(base, px) / 2
    for ch, src in zip(base, text):
        w = len(I.SIGN_FONT[ch.replace("É", "E")][0])
        zb = z + 2.5 * px + 0.25 * px
        if src == "È":
            ua = x + 0.8 * px
            g.quad([f.p(ua + 0.8 * px, d, zb), f.p(ua + 1.8 * px, d, zb), f.p(ua + px, d, zb + 0.9 * px),
                    f.p(ua, d, zb + 0.9 * px)], color)
        elif src == "Ô":
            ua = x + 0.5 * px
            g.quad([f.p(ua, d, zb), f.p(ua + px, d, zb), f.p(ua + 1.5 * px, d, zb + 0.8 * px),
                    f.p(ua + 1.0 * px, d, zb + 0.8 * px)], color)
            g.quad([f.p(ua + 2.0 * px, d, zb), f.p(ua + 3.0 * px, d, zb), f.p(ua + 2.0 * px, d, zb + 0.8 * px),
                    f.p(ua + 1.5 * px, d, zb + 0.8 * px)], color)
        x += (w + 1) * px


def plinth_side(g, f, L, ops, h=0.45, color="stone_dark", d=0.03):
    """Soubassement de pierre devant un mur, sur toute sa longueur hors tout L (interrompu aux portes)."""
    segs = [(-L / 2, L / 2)]
    for (u, w, zb, zt) in sorted(ops):
        if zb < h:
            a, b = segs.pop()
            segs += [(a, u - w / 2), (u + w / 2, b)]
    for a, b in segs:
        if b - a > 0.05:
            f.box(g, (b - a, 2 * d, h), (a + b) / 2, d, h / 2, color)


def plinth_len(side, hx, hy):
    return 2 * hx + 0.06 if side in ("front", "back") else 2 * hy + 0.06


def quoins_side(g, hx, hy, z1, sy, color="stone_light", seed=7, step=0.36, ox=0.0, z0=0.0):
    """Chaînes d'angle des deux coins d'une façade (sy -1: devant, +1: derrière), de z0 à z1: blocs alternés,
    l'arête d'angle abattue (les trois autres arêtes sont contre le mur ou de profil, invisibles)."""
    rnd = random.Random(seed + (5 if sy > 0 else 0))
    for sx in (1, -1):
        z, i = z0, 0
        while z < z1 - 0.05:
            h = min(step, z1 - z)
            big = i % 2 == 0
            w, d = (0.44, 0.28) if big else (0.28, 0.44)
            w += rnd.uniform(-0.03, 0.03)
            d += rnd.uniform(-0.03, 0.03)
            out = rnd.uniform(0.015, 0.03)
            g.box((w, d, h - 0.03), loc=(ox + sx * (hx + out - w / 2), sy * (hy + out - d / 2), z + 0.015),
                  color=color, base=True, bevel=rnd.uniform(0.025, 0.04), bseg=1,
                  bedges=lambda a, b, sx=sx: B._vertical(a, b) and a.x * sx > 0 and a.y * sy > 0,
                  rot=(0, 0, rnd.uniform(-1.5, 1.5)))
            z += h
            i += 1


def arch_fill(g, f, u, w, zs, t, col, extra=0.12, n=8, d0=0.0):
    """Écoinçons d'un arc plein cintre dans le haut d'une ouverture rectangulaire (u, w, ..., zs + w/2 + extra)."""
    r = w / 2
    zt = zs + r + extra
    pts = [(-r, zs)]
    for k in range(1, n):
        a = math.pi - math.pi * k / n
        pts.append((r * math.cos(a), zs + r * math.sin(a)))
    pts += [(r, zs), (r, zt), (-r, zt)]
    g.prism(pts, t, loc=f.p(u, d0 - t / 2, 0), color=col, rot=(0, 0, f.rz))
    return zt


def arch_panel(g, f, u, w, zb, zs, d, thick, color, n=8):
    """Panneau en forme de baie cintrée (vitre, vantail cintré), dans le plan du mur à la profondeur d."""
    r = w / 2
    pts = [(-r, zb), (r, zb), (r, zs)]
    for k in range(1, n):
        a = math.pi * k / n
        pts.append((r * math.cos(a), zs + r * math.sin(a)))
    pts.append((-r, zs))
    g.prism(pts, thick, loc=f.p(u, d, 0), color=color, rot=(0, 0, f.rz))


def voussoirs(g, f, u, w, zs, color="stone_light", d=0.03, n=7, ring=0.2, depth=0.06, key=True):
    """Claveaux autour d'un arc plein cintre, en saillie sur le nu du mur."""
    r = w / 2 + ring / 2
    for k in range(n):
        a = math.pi * (k + 0.5) / n
        big = key and k == n // 2
        f.box(g, (math.pi * r / n - 0.025, depth, ring + (0.06 if big else 0.0)), u + r * math.cos(a), d,
              zs + r * math.sin(a), color, rot=(0, 90 - math.degrees(a), 0))


def win(g, f, u, zb, w, h, frame="paint_cream", shutter=None, sill="stone_light", mullion=True, closed=False,
        surround=None, flowers=False, d=0.0):
    """Fenêtre posée sur un mur plein (bâtiments sans intérieur): dormant en saillie, vitre, croisillons,
    appui, volets ouverts contre le mur ou fermés; encadrement de pierre ou de brique facultatif."""
    if surround:
        for s in (1, -1):
            f.box(g, (0.14, 0.04, h + 0.14), u + s * (w / 2 + 0.07), d + 0.02, zb + h / 2 + 0.07, surround)
        f.box(g, (w + 0.42, 0.05, 0.16), u, d + 0.025, zb + h + 0.08, surround)
    f.box(g, (w + 0.08, 0.05, h + 0.08), u, d + 0.025, zb + h / 2, frame)
    f.box(g, (w - 0.08, 0.02, h - 0.08), u, d + 0.055, zb + h / 2, "glass")
    if mullion:
        f.box(g, (0.04, 0.02, h - 0.08), u, d + 0.065, zb + h / 2, frame)
        f.box(g, (w - 0.08, 0.02, 0.035), u, d + 0.065, zb + h * 0.6, frame)
    f.box(g, (w + 0.22, 0.15, 0.06), u, d + 0.075, zb - 0.03, sill)
    if shutter:
        if closed:
            for s in (1, -1):
                f.box(g, (w / 2 + 0.02, 0.035, h + 0.02), u + s * (w / 4 + 0.005), d + 0.1, zb + h / 2, shutter)
                f.box(g, (w / 2 - 0.04, 0.045, 0.05), u + s * (w / 4), d + 0.1, zb + h * 0.25, "wood_dark")
                f.box(g, (w / 2 - 0.04, 0.045, 0.05), u + s * (w / 4), d + 0.1, zb + h * 0.75, "wood_dark")
            f.box(g, (0.03, 0.05, 0.03), u, d + 0.13, zb + h / 2, "iron")
        else:
            for s in (1, -1):
                uu = u + s * (w * 0.75 + 0.1 + (0.07 if surround else 0))
                f.box(g, (w / 2, 0.035, h), uu, d + 0.02, zb + h / 2, shutter)
                f.box(g, (w / 2 + 0.01, 0.045, 0.045), uu, d + 0.025, zb + h * 0.5, "wood_dark")
    if flowers:
        f.box(g, (w + 0.06, 0.2, 0.16), u, d + 0.18, zb + 0.05, "wood")
        D.box_flowers(f, g, u, d + 0.18, zb + 0.08, w)


def plank_leaf(g, lw, h, color="wood_dark", sign=1, studs=True, strap="iron"):
    """Vantail de planches (dans un Geo à part, gond à l'origine, le vantail vers +X; sign -1: vers le bas)."""
    n = max(3, int(lw / 0.16))
    for k in range(n):
        x = lw * (k + 0.5) / n
        g.box((lw / n - 0.012, 0.05, h - 0.02), loc=(x, 0, sign * (h / 2)), color=color if k % 2 else "wood")
    for zz in (0.3, h - 0.35):
        g.box((lw - 0.04, 0.03, 0.12), loc=(lw / 2, -0.035, sign * zz), color=strap)
        if studs:
            g.box((0.06, 0.04, 0.06), loc=(0.06, -0.04, sign * zz), color=strap)
    g.box((0.05, 0.05, 0.05), loc=(lw - 0.1, -0.05, sign * 1.0), color="iron_light")


def leaf_node(A, name, parent, f, u_hinge, d, lw, h, color="wood_dark", right=False, builder=None):
    """Vantail en nœud à part (ouvert par le rendu: rotation positive autour de l'axe vertical glTF).
    Gauche (vu de dehors): pivot sur le jambage gauche, vantail vers la droite. Droite: le nœud est retourné
    autour de Y Blender (Z glTF), le vantail est modelé tête en bas: la même rotation positive l'ouvre vers
    l'intérieur."""
    g = A.geo()
    if builder:
        builder(g, lw, h, -1 if right else 1)
    else:
        plank_leaf(g, lw, h, color, -1 if right else 1)
    ob = A.add(name, g, parent=parent, loc=f.p(u_hinge, d, 0.0))
    ob.rotation_euler = (0, math.pi if right else 0, math.radians(f.rz))
    return ob


def glazed_leaf(g, lw, h, sign, color="paint_green"):
    g.box((lw, 0.05, h - 0.02), loc=(lw / 2, 0, sign * (h / 2)), color=color)
    g.box((lw - 0.2, 0.06, 0.8), loc=(lw / 2, 0, sign * 1.45), color="glass")
    g.box((lw - 0.22, 0.06, 0.55), loc=(lw / 2, 0, sign * 0.5), color="wood_dark")
    for sy in (1, -1):
        g.box((0.05, 0.03, 0.05), loc=(lw - 0.1, sy * 0.04, sign * 1.0), color="brass")


def gable_prisms(g, hx, hy, ze, zr, t, color, axis="x", top_cut=0.24):
    """Pignons triangulaires (faîtage selon X: pignons à ±hx; selon Y: à ±hy)."""
    if axis == "x":
        for x, s in ((-hx, 1), (hx, -1)):
            g.prism([(-hy, ze), (hy, ze), (0, zr - top_cut)], t, loc=(x + s * t / 2, 0, 0), color=color, rot=(0, 0, 90))
    else:
        for y, s in ((-hy, 1), (hy, -1)):
            g.prism([(-hx, ze), (hx, ze), (0, zr - top_cut)], t, loc=(0, y + s * t / 2, 0), color=color)


def roof(g, hx, hy, ze, zr, color, edge, axis="x", over_x=0.36, over_y=0.32):
    """Toit à deux pans arrondi (bourg.round_gable_roof); axis y: faîtage selon Y (pignons devant et derrière)."""
    if axis == "x":
        B.round_gable_roof(g, -hx, hx, -hy, hy, ze, zr, color, edge=edge, ridge_color=edge, over_x=over_x, over_y=over_y)
        return
    p = Piece(g)
    B.round_gable_roof(g, -hy, hy, -hx, hx, ze, zr, color, edge=edge, ridge_color=edge, over_x=over_x, over_y=over_y)
    p.place((0, 0, 0), 90)


def eaves_of(hx, hy, ze, zr, color, edge):
    tmp = lpl.Geo(lpl.world_cells())
    roof(tmp, hx, hy, ze, zr, color, edge)
    e = {sd: D.eave(tmp.bm.verts, sd) for sd in (-1, 1)}
    tmp.bm.free()
    return e


def gutters(r, eaves, sides=(-1, 1)):
    for sd in sides:
        D.gutter(r, sd, *eaves[sd], hooks=False)


def downpipes(g, eaves, hy, xs, sides=(-1, 1)):
    """xs = (x, ...): une descente à x devant (pan -1) et à -x derrière (pan +1), aux coins opposés."""
    for sd in sides:
        gl = D.gutter_line(eaves[sd][0], eaves[sd][1], sd)
        for x in xs:
            D.pipe_wall(g, sd, -sd * x, sd * hy, *gl)


def pipe_necks(r, eaves, hy, xs, sides=(-1, 1)):
    for sd in sides:
        gl = D.gutter_line(eaves[sd][0], eaves[sd][1], sd)
        for x in xs:
            D.pipe_neck(r, sd, -sd * x, sd * hy, *gl)


def dormer(r, u, hy, ze, zr, w=0.75, wh=0.85, wall="stone", roof_col="lauze_dark", frame="paint_cream",
           shutter=None, side=-1, flowers=False):
    """Lucarne sur le pan avant (side -1) ou arrière (+1) d'un toit à faîtage selon X: joues et toit prolongés
    jusqu'au pan (rien ne flotte), fenêtre, volets ouverts à plat sur le front de la lucarne."""
    slope = (zr - ze) / hy
    s = side
    yf = s * (hy - 0.12)
    zb = ze - 0.25
    zt = ze + 0.25 + wh
    zp = zt + 0.32 + 0.25 * w
    ye = s * ((zr - zt) / slope) - s * 0.05
    yr = s * ((zr - zp) / slope)
    bw = w + 0.3
    r.box((bw, abs(ye - yf), zt - zb), loc=(u, (yf + ye) / 2, zb), color=wall, base=True)
    yo = yf + s * 0.15
    r.prism([(-bw / 2 - 0.12, 0), (bw / 2 + 0.12, 0), (0, zp - zt)], abs(yr - yo), loc=(u, (yr + yo) / 2, zt),
            color=by_normal(roof_col, roof_col, "wood_dark", thr=0.2))
    zc = ze + 0.25 + wh / 2
    r.box((w, 0.05, wh), loc=(u, yf + s * 0.02, zc), color="glass")
    r.box((w + 0.1, 0.04, wh + 0.1), loc=(u, yf + s * 0.005, zc), color=frame)
    r.box((0.035, 0.05, wh), loc=(u, yf + s * 0.04, zc), color=frame)
    r.box((w + 0.16, 0.14, 0.05), loc=(u, yf + s * 0.06, zc - wh / 2 - 0.03), color="stone_light")
    if shutter:
        for k in (1, -1):
            r.box((0.1, 0.035, wh), loc=(u + k * (w / 2 + 0.05 + 0.06), yf + s * 0.03, zc), color=shutter)
    if flowers:
        r.box((w + 0.04, 0.18, 0.14), loc=(u, yf + s * 0.15, zc - wh / 2), color="wood", base=True)
        f = B.Face("front" if s < 0 else "back", 0, -yf if s < 0 else yf)
        D.box_flowers(f, r, u if s < 0 else -u, 0.15, zc - wh / 2 + 0.03, w)


def stone_steps(g, f, u, w, n, rise, run, color="stone_light", d0=0.0):
    """Marches de pierre dehors devant une porte (n marches de rise sur run), du mur vers la rue."""
    for k in range(n):
        f.box(g, (w + 0.1 * (n - k), run * (n - k), rise), u, d0 + run * (n - k) / 2, rise * k + rise / 2, color,
              bevel=0.02, bedges=B._not_ground)


def flower_pot(g, f, u, d, scale=0.85, seed=0, cols=("flower_red", "flower_white", "flower_pink")):
    """Pot de terre cuite au pied d'un mur: bord roulé, motte de feuillage en trois boules, trois fleurs."""
    x, y, _ = f.p(u, d, 0)
    s = scale
    g.lathe([(0.11 * s, 0.0), (0.15 * s, 0.24 * s), (0.17 * s, 0.25 * s), (0.17 * s, 0.29 * s)], loc=(x, y, 0),
            colors=["tile", "tile_dark", "tile_dark"], segs=8)
    for k in range(3):
        a = math.radians(120 * k + 40 * seed)
        g.sphere(0.1 * s, loc=(x + 0.06 * s * math.cos(a), y + 0.06 * s * math.sin(a), 0.33 * s), color="leaf_bush",
                 segs=6, rings=4, scale=(1, 1, 0.8))
        b = a + math.radians(60)
        g.sphere(0.045 * s, loc=(x + 0.09 * s * math.cos(b), y + 0.09 * s * math.sin(b), 0.41 * s),
                 color=cols[k % len(cols)], segs=5, rings=3)


def bench_stone(g, f, u, w=1.0, d=0.22):
    f.box(g, (w, 0.36, 0.08), u, d, 0.42, "stone_light", bevel=0.02)
    for s in (1, -1):
        f.box(g, (0.16, 0.3, 0.38), u + s * (w / 2 - 0.12), d, 0.19, "stone")


def wall_lamp(g, f, u, z, d=0.0):
    """Applique de fer et lanterne de verre (lueur de nuit)."""
    f.box(g, (0.1, 0.04, 0.16), u, d + 0.02, z, "iron")
    f.box(g, (0.03, 0.32, 0.03), u, d + 0.18, z + 0.04, "iron")
    p = f.p(u, d + 0.33, z - 0.1)
    g.box((0.16, 0.16, 0.2), loc=p, color="glass_lamp", rot=(0, 0, f.rz))
    g.cyl(0.13, 0.1, loc=(p[0], p[1], p[2] + 0.13), r2=0.02, color="iron", segs=6)
    g.box((0.14, 0.14, 0.03), loc=(p[0], p[1], p[2] - 0.11), color="iron", rot=(0, 0, f.rz))


def rope(g, pts, r=0.018, color="rope"):
    for a, b in zip(pts, pts[1:]):
        B.rod(g, a, b, r, color, segs=5)


def _gl(x, y):
    return [round(x, 3), round(-y, 3)]


def interior_root(A, name, foot, door_cell, rooms, cut, note, extra=None):
    ex = {"footprint": foot, "door_cell": door_cell, "cut_walls": True, "cut_nodes": cut,
          "interior": {"floor_y": FL, "rooms": rooms}, "note": note}
    ex.update(extra or {})
    return A.group(name, ex)


def side_walls(A, root, name, hx, hy, h, t, ops, out, inn, deco=None, plinth=0.45, plinth_col="stone_dark",
               quoins="stone_light"):
    """Les quatre murs d'un rez-de-chaussée visitable, chacun dans son nœud (`<name>_wall_<côté>`)."""
    nodes = {}
    for side in SIDES:
        g = A.geo()
        f = B.Face(side, hx, hy)
        L = wall_len(side, hx, hy, t)
        pierced_wall(g, f, L, t, h, ops.get(side, []), B.wall_color(out, inn, INWARD[side]))
        if plinth:
            plinth_side(g, f, plinth_len(side, hx, hy), ops.get(side, []), plinth, plinth_col)
        if quoins and side in ("front", "back"):
            quoins_side(g, hx, hy, h - 0.05, -1 if side == "front" else 1, quoins)
        if deco:
            deco(side, g, f)
        nodes[side] = A.add(f"{name}_wall_{side}", g, parent=root)
    return nodes


def house_walls(g, hx, hy, h, t, ops, out, inn, plinth=0.4, plinth_col="stone_dark"):
    for side in SIDES:
        f = B.Face(side, hx, hy)
        L = wall_len(side, hx, hy, t)
        pierced_wall(g, f, L, t, h, ops.get(side, []), B.wall_color(out, inn, INWARD[side]))
        if plinth:
            plinth_side(g, f, plinth_len(side, hx, hy), ops.get(side, []), plinth, plinth_col)


# Mobilier ------------------------------------------------------------------------------------------------

def round_table(g, loc, r=0.38, h=0.72, top="wood_new", cloth=None):
    p = Piece(g)
    g.cyl(r, 0.04, loc=(0, 0, h - 0.04), color=top, segs=10, base=True)
    if cloth:
        g.cyl(r + 0.02, 0.012, loc=(0, 0, h), color=cloth, segs=10, base=True)
    g.cyl(0.04, h - 0.04, loc=(0, 0, 0), color="wood_dark", segs=6, base=True)
    g.cyl(0.22, 0.04, loc=(0, 0, 0), color="wood_dark", segs=8, base=True)
    return p.place(loc, 0)


def bench_plain(g, loc, rz, L=2.0, seat=0.45, color="wood"):
    """Banc sans dossier: planche, deux pieds en planche, entretoise."""
    p = Piece(g)
    g.box((L, 0.3, 0.05), loc=(0, 0, seat - 0.05), color=color, base=True, bevel=0.012)
    for s in (1, -1):
        g.box((0.05, 0.26, seat - 0.05), loc=(s * (L / 2 - 0.2), 0, 0), color="wood_dark", base=True)
    g.box((L - 0.4, 0.04, 0.06), loc=(0, 0, 0.18), color="wood_dark", base=True)
    return p.place(loc, rz)


def pew(g, loc, L=2.8):
    """Banc d'église à dossier et agenouilloir, tourné vers +X (le chœur): jouées arrondies, entretoises."""
    p = Piece(g)
    seat = 0.45
    g.box((0.4, L - 0.1, 0.05), loc=(0, 0, seat - 0.05), color="wood", base=True, bevel=0.012)
    g.box((0.05, L - 0.1, 0.5), loc=(-0.2, 0, seat + 0.02), color="wood_dark", base=True)
    g.box((0.07, L - 0.08, 0.05), loc=(-0.2, 0, seat + 0.52), color="wood", base=True, bevel=0.012)
    for s in (1, -1):
        g.box((0.55, 0.06, seat + 0.42), loc=(0.0, s * (L / 2 - 0.03), 0), color="wood_dark", base=True)
        g.cyl(0.275, 0.06, loc=(0.0, s * (L / 2 - 0.03), seat + 0.42), color="wood_dark", segs=8, rot=(90, 0, 0),
              scale=(1, 0.45, 1))
    # agenouilloir devant (pour le banc suivant: le fidèle de devant s'y agenouille), sur deux traverses
    g.box((0.16, L - 0.2, 0.06), loc=(0.42, 0, 0.12), color="wood", base=True)
    for s in (1, -1):
        g.box((0.5, 0.05, 0.05), loc=(0.2, s * (L / 2 - 0.12), 0.08), color="wood_dark", base=True)
    g.box((0.04, L - 0.2, 0.04), loc=(0.2, 0, 0.12), color="wood_dark", base=True)
    return p.place(loc, 0)


def bell(g, loc, r=0.42, color="paint_yellow"):
    """Cloche de bronze (profil tourné), battant, mouton de chêne au-dessus."""
    x, y, z = loc
    h = r * 1.8
    prof = [(r * 1.0, 0.0), (r * 1.02, 0.05 * h), (r * 0.82, 0.22 * h), (r * 0.62, 0.55 * h), (r * 0.58, 0.85 * h),
            (r * 0.42, 1.0 * h), (0.0, 1.03 * h)]
    g.lathe(prof, loc=(x, y, z), colors=["straw_dark", color, color, color, color, color], segs=12, close_bottom=False)
    g.lathe([(r * 0.9, 0.04 * h), (r * 0.55, 0.5 * h), (r * 0.4, 0.95 * h), (0.0, 0.98 * h)], loc=(x, y, z),
            colors="shadow", segs=10, close_bottom=True)
    g.cyl(0.02, 0.6 * h, loc=(x, y, z + 0.18 * h), color="iron", segs=5, base=True)
    g.sphere(0.07, loc=(x, y, z + 0.12 * h), color="iron", segs=6, rings=4)
    g.box((0.2, 0.2, 0.12), loc=(x, y, z + 1.0 * h), color="iron", base=True)
    return z + 1.12 * h


def candle_row(g, x0, y, z, n, dx=0.07, h=0.12):
    for k in range(n):
        x = x0 + k * dx
        g.cyl(0.012, h, loc=(x, y, z), color="white_paint", segs=5, base=True)
        g.box((0.015, 0.015, 0.03), loc=(x, y, z + h + 0.012), color="flame")


# Église Saint-Aubin ------------------------------------------------------------------------------------------
# Carte: emprise x 85 à 105, y -17 à -6 (centre 95,5 ; -11), rotation 0. x = X - 95,5, y = -11 - Y.
# Nef: cases x 90 à 101, y -16 à -7 (x -5,5 à 6,5, y -5 à 5); chœur x 102 à 104, y -13 à -10 (x 6,5 à 9,5,
# y -2 à 2); clocher-porche x 85 à 89 (x -10,5 à -5,5), fermé. Portail sud en (95, -6): x 0.

CHURCH = dict(x0=-6.1, x1=6.9, hy=5.6, t=0.6, ze=7.0, zr=11.0, tx0=-10.4, tx1=-5.5, th=2.45, tz=13.9)


def _buttress(g, x, y_face, s, h=5.2, w=0.75, d=0.42):
    """Contrefort contre un mur long (s -1: devant, vers -Y), glacis de pierre qui le ramène au mur."""
    g.box((w, d, h), loc=(x, y_face + s * d / 2, 0), color="stone", base=True, bevel=0.05, bedges=B._vertical)
    g.box((w + 0.08, d + 0.08, 0.4), loc=(x, y_face + s * d / 2, 0), color="stone_dark", base=True)
    solid(g, [(x - w / 2, y_face, h), (x + w / 2, y_face, h), (x + w / 2, y_face + s * d, h),
              (x - w / 2, y_face + s * d, h), (x - w / 2, y_face, h + 0.9), (x + w / 2, y_face, h + 0.9)],
          [(0, 1, 2, 3), (0, 1, 5, 4), (1, 2, 5), (3, 0, 4), (2, 3, 4, 5)], "stone_light")


def church(A):
    C = CHURCH
    t, ze, zr, hy = C["t"], C["ze"], C["zr"], C["hy"]
    x0, x1 = C["x0"], C["x1"]
    hx = (x1 - x0) / 2
    xc = (x0 + x1) / 2
    root = interior_root(
        A, "church", [21, 12], 10,
        [{"id": "church_nave", "x": [-5.5, 6.5], "z": [-5.0, 5.0]},
         {"id": "church_choir", "x": [6.5, 9.5], "z": [-2.0, 2.0]}],
        ["church_roof"],
        "portail sud en case 10 (x 0); nef de 12 x 10 m, chœur et abside à l'est; clocher-porche à l'ouest dans "
        "church_wall_left (coupé avec le mur ouest quand la caméra regarde de l'ouest); cloches visibles dans les "
        "baies sud et est du beffroi; clocher centré sur l'axe de la nef (0,5 m au sud de la case de la carte)",
        {"tower_top": 20.0})

    def fu(X):  # u d'un point du mur sud (devant) d'abscisse X
        return X - xc

    def bu(X):  # u d'un point du mur nord (derrière)
        return xc - X

    # sol de dalles (nef et chœur), tapis rouge dans l'allée du portail et l'allée centrale
    g = A.geo()
    I.floor_tiles(g, -5.5, 6.5, -5.0, 5.0, FL, a="stone_light", b="stone", cell=1.0)
    I.floor_tiles(g, 6.5, 7.5, -2.0, 2.0, FL, a="stone_light", b="stone", cell=1.0)
    half_disc(g, 7.5, 2.02, FL, by_normal("stone_light", "stone"), n=8)
    g.box((11.0, 1.0, 0.012), loc=(1.5, 0, FL), color="fabric_red", base=True)
    g.box((1.0, 4.0, 0.012), loc=(0, -3.0, FL), color="fabric_red", base=True)
    A.add("church_floor", g, parent=root)

    win_X = (-3.9, 3.9)
    zb_w, zs_w, ww = 3.1, 5.1, 0.9
    pw, ph = 1.5, 2.45
    but_X = (-2.5, 2.5, 6.55)

    def tall_window(g, f, u, t_):
        arch_fill(g, f, u, ww, zs_w, t_, B.wall_color("stone", "plaster_cream", INWARD[f.side]))
        arch_panel(g, f, u, ww, zb_w, zs_w, -t_ / 2, 0.03, "glass")
        for zz in (zb_w + 0.55, zb_w + 1.1, zb_w + 1.65):
            f.box(g, (ww, 0.045, 0.025), u, -t_ / 2, zz, "black")
        f.box(g, (0.025, 0.045, zs_w - zb_w + ww / 2 - 0.05), u, -t_ / 2, (zb_w + zs_w + ww / 2) / 2, "black")
        for du, zz, c in ((-0.2, zb_w + 0.83, "flower_blue"), (0.2, zb_w + 1.38, "fabric_red"),
                          (-0.2, zb_w + 1.93, "paint_yellow"), (0.0, zs_w + 0.2, "flower_blue")):
            for dd in (-t_ / 2 - 0.025, -t_ / 2 + 0.025):
                f.box(g, (0.22, 0.012, 0.22), u + du, dd, zz, c, rot=(0, 45, 0))
        voussoirs(g, f, u, ww, zs_w, "stone_light", d=0.03, n=7, ring=0.2)
        for s in (1, -1):
            f.box(g, (0.16, 0.05, zs_w - zb_w), u + s * (ww / 2 + 0.08), 0.025, (zb_w + zs_w) / 2, "stone_light")
        f.box(g, (ww + 0.4, 0.2, 0.1), u, 0.06, zb_w - 0.05, "stone_light", bevel=0.02)

    def portal(g, f):
        """Portail roman: tympan à la croix, deux voussures, colonnettes et chapiteaux, larmier en bâtière."""
        u0 = fu(0.0)
        r = pw / 2
        arch_panel(g, f, u0, pw, ph - 0.01, ph, 0.02, 0.04, "stone_light")
        f.box(g, (0.42, 0.04, 0.07), u0, 0.05, ph + 0.36, "stone_dark")
        f.box(g, (0.07, 0.04, 0.46), u0, 0.05, ph + 0.3, "stone_dark")
        voussoirs(g, f, u0, pw, ph, "stone_light", d=0.1, n=9, ring=0.2, depth=0.2)
        voussoirs(g, f, u0, pw + 0.4, ph, "stone", d=0.05, n=11, ring=0.18, depth=0.1, key=False)
        for s in (1, -1):
            f.box(g, (0.2, 0.14, ph), u0 + s * (r + 0.1), 0.07, ph / 2, "stone_light", bevel=0.02)
            f.box(g, (0.2, 0.1, ph), u0 + s * (r + 0.3), 0.05, ph / 2, "stone", bevel=0.02)
            f.box(g, (0.5, 0.2, 0.12), u0 + s * (r + 0.2), 0.1, ph + 0.0 - 0.06, "stone_light")
            # larmier en bâtière au-dessus de l'arc
            L = math.hypot(1.3, 1.55)
            ang = math.degrees(math.atan2(1.55, 1.3))
            f.box(g, (L, 0.16, 0.14), u0 + s * 0.65, 0.08, ph + 0.1 + 0.78, "stone_light", rot=(0, s * ang, 0))
        f.box(g, (0.08, 0.1, 0.48), u0, 0.08, ph + 1.85, "stone_light")
        f.box(g, (0.3, 0.1, 0.08), u0, 0.08, ph + 1.95, "stone_light")
        f.box(g, (pw + 0.6, 0.45, FL), u0, 0.22, FL / 2, "stone_light", bevel=0.02, bedges=B._not_ground)

    nodes = {}
    for side in SIDES:
        g = A.geo()
        f = OFace(side, hx, hy, xc)
        L = wall_len(side, hx, hy, t)
        if side == "front":
            ops = [(fu(X), ww, zb_w, zs_w + ww / 2 + 0.12) for X in win_X] + [(fu(0.0), pw, 0.0, ph)]
            pierced_wall(g, f, L, t, ze - 0.05, ops, B.wall_color("stone", "plaster_cream", INWARD[side]))
            plinth_side(g, f, 2 * hx + 0.06, ops, 0.5, "stone_dark")
            quoins_side(g, hx, hy, ze - 0.1, -1, "stone_light", seed=11, ox=xc)
            for X in win_X:
                tall_window(g, f, fu(X), t)
            portal(g, f)
            for X in but_X:
                _buttress(g, X, -hy, -1)
            _buttress(g, -5.82, -hy, -1, h=4.2, w=0.55)
            # tableau des offices (church_sign, 94,5 ; -4,5), à gauche du portail
            ub = fu(-1.72)
            f.box(g, (0.62, 0.06, 0.82), ub, 0.03, 1.55, "wood_dark", bevel=0.01)
            f.box(g, (0.52, 0.02, 0.66), ub, 0.065, 1.53, "glass")
            for k, (du, dz) in enumerate(((-0.1, 0.12), (0.12, 0.05), (-0.05, -0.16))):
                f.box(g, (0.18, 0.02, 0.22), ub + du, 0.08, 1.53 + dz, "paper" if k % 2 == 0 else "paper_dark")
            f.box(g, (0.72, 0.18, 0.05), ub, 0.1, 1.98, "wood_dark")
            # bénitier, dedans, à droite en entrant
            g.lathe([(0.0, 0.0), (0.14, 0.06), (0.17, 0.14), (0.15, 0.15)], loc=f.p(fu(1.05), -t - 0.13, 0.88),
                    colors="stone_light", segs=8, close_top=False)
            f.box(g, (0.1, 0.12, 0.3), fu(1.05), -t - 0.04, 0.72, "stone_light")
        elif side == "back":
            ops = [(bu(X), ww, zb_w, zs_w + ww / 2 + 0.12) for X in win_X]
            pierced_wall(g, f, L, t, ze - 0.05, ops, B.wall_color("stone", "plaster_cream", INWARD[side]))
            plinth_side(g, f, 2 * hx + 0.06, ops, 0.5, "stone_dark")
            quoins_side(g, hx, hy, ze - 0.1, 1, "stone_light", seed=12, ox=xc)
            for X in win_X:
                tall_window(g, f, bu(X), t)
            for X in but_X:
                _buttress(g, X, hy, 1)
            # frise peinte au mur nord (dedans), à 2,7 et 2,85 m: le mur qui reste debout pour la caméra
            f.box(g, (2 * hx - 1.4, 0.02, 0.12), 0.0, -t - 0.01, 2.85, "paint_red")
            f.box(g, (2 * hx - 1.4, 0.02, 0.04), 0.0, -t - 0.01, 2.68, "paint_yellow")
            # chemin de croix (petits cadres), hors de la chaire, de la statue et de l'harmonium
            for X in (-4.6, -1.7, 2.6, 4.4):
                f.box(g, (0.32, 0.04, 0.4), bu(X), -t - 0.02, 2.1, "wood_dark")
                f.box(g, (0.24, 0.045, 0.3), bu(X), -t - 0.02, 2.1, "sepia")
            # porte de la chaire, dans l'épaisseur du mur (l'escalier est pris dans le mur)
            f.box(g, (0.6, 0.06, 1.15), bu(1.0), -t - 0.02, 1.95, "shadow")
            f.box(g, (0.72, 0.08, 0.08), bu(1.0), -t - 0.03, 2.56, "stone_light")
        elif side == "left":
            # mur ouest de la nef de part et d'autre du clocher (le mur est du clocher ferme la nef au milieu)
            ops = [(0.0, 2 * C["th"] + 0.02, 0.0, ze)]
            pierced_wall(g, f, L, t, ze - 0.05, ops, B.wall_color("stone", "plaster_cream", INWARD[side]))
            plinth_side(g, f, 2 * hy + 0.06, ops, 0.5, "stone_dark")
        else:
            # mur de l'arc triomphal (entre nef et chœur): arc plein cintre de 3,6 m, naissance à 2,6 m
            ops = [(0.0, 3.6, 0.0, 4.52)]
            col = B.wall_color("stone", "plaster_cream", INWARD[side])
            pierced_wall(g, f, L, t, ze - 0.05, ops, col)
            arch_fill(g, f, 0.0, 3.6, 2.6, t, col)
        nodes[side] = g
    # le chœur et son abside (murs dans les nœuds sud, nord et est)
    cx_a, ri, ro, zc_e = 7.5, 2.0, 2.5, 6.0
    gf, gb, gr, gl = nodes["front"], nodes["back"], nodes["right"], nodes["left"]
    for s, gg in ((-1, gf), (1, gb)):
        gg.box((cx_a - x1 + 0.02, 0.5, zc_e - 0.05), loc=((x1 + cx_a) / 2, s * 2.25, 0),
               color=B.wall_color("stone", "plaster_cream", (0, -s, 0)), base=True)
        gg.box((cx_a - x1 + 0.06, 0.06, 0.5), loc=((x1 + cx_a) / 2, s * 2.53, 0), color="stone_dark", base=True)
    nseg = 5
    for k in range(nseg):
        a0 = -math.pi / 2 + math.pi * k / nseg
        a1 = -math.pi / 2 + math.pi * (k + 1) / nseg
        am = (a0 + a1) / 2
        P = [(cx_a + ri * math.cos(a), ri * math.sin(a)) for a in (a0, a1)] + \
            [(cx_a + ro * math.cos(a), ro * math.sin(a)) for a in (a1, a0)]
        vs = [(p[0], p[1], 0.0) for p in P] + [(p[0], p[1], zc_e - 0.05) for p in P]
        solid(gr, vs, [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)],
              lambda f_, am=am: "plaster_cream" if f_.normal.x * math.cos(am) + f_.normal.y * math.sin(am) < -0.7
              else "stone")
        chord = 2 * ro * math.sin(math.pi / nseg / 2)
        gr.box((0.06, chord + 0.02, 0.5), loc=(cx_a + (ro + 0.03) * math.cos(am), (ro + 0.03) * math.sin(am), 0),
               color="stone_dark", base=True, rot=(0, 0, math.degrees(am)))
        if k in (1, 2, 3):
            # baie étroite: vitre au travers du mur (vue dehors et dedans), encadrement de pierre dehors
            rm = (ri + ro) / 2
            gr.box((ro - ri + 0.04, 0.32, 1.5), loc=(cx_a + rm * math.cos(am), rm * math.sin(am), 2.6), color="glass",
                   base=True, rot=(0, 0, math.degrees(am)))
            gr.box((0.06, 0.54, 1.72), loc=(cx_a + (ro + 0.02) * math.cos(am), (ro + 0.02) * math.sin(am), 2.49),
                   color="stone_light", base=True, rot=(0, 0, math.degrees(am)))
            gr.box((0.06, 0.32, 1.48), loc=(cx_a + (ro + 0.05) * math.cos(am), (ro + 0.05) * math.sin(am), 2.61),
                   color="glass", base=True, rot=(0, 0, math.degrees(am)))
    for k in (1, 4):
        a = -math.pi / 2 + math.pi * k / nseg
        gr.box((0.55, 0.5, 4.2), loc=(cx_a + (ro + 0.22) * math.cos(a), (ro + 0.22) * math.sin(a), 0), color="stone",
               base=True, rot=(0, 0, math.degrees(a)), bevel=0.04, bedges=B._vertical)
    # clocher-porche, dans le nœud du mur ouest
    tower(gl, C)
    # corde des cloches (church_bell_rope, 90,5 ; -11,5): poulie sur console contre le clocher, poignée de laine
    rx, ry = -5.0, 0.5
    gl.box((0.5, 0.12, 0.12), loc=(-5.25, ry, 6.0), color="wood_dark")
    gl.cyl(0.08, 0.06, loc=(rx, ry, 5.86), color="wood", segs=8, rot=(90, 0, 0))
    rope(gl, [(rx, ry, 5.8), (rx, ry, 1.05)], 0.016)
    gl.cyl(0.035, 0.32, loc=(rx, ry, 1.05), color="fabric_red", segs=6, base=True)
    rope(gl, [(rx, ry, 1.05), (rx + 0.04, ry, 0.8), (-5.46, ry + 0.15, 0.9)], 0.014)
    gl.box((0.06, 0.06, 0.08), loc=(-5.47, ry + 0.15, 0.9), color="iron")
    # écriteau des sonneries (church_sign_bells, 90,5 ; -10,5) et vantail fermé de la porte du clocher
    gl.box((0.05, 0.4, 0.3), loc=(-5.47, -0.55, 1.55), color="wood_dark")
    gl.box((0.055, 0.32, 0.22), loc=(-5.47, -0.55, 1.55), color="paper")
    for zz in (1.63, 1.55, 1.47):
        gl.box((0.06, 0.24, 0.015), loc=(-5.46, -0.55, zz), color="sepia_dark")
    gl.box((0.06, 0.82, 2.08), loc=(-5.56, 1.2, 0.0), color="wood_dark", base=True)
    for zz in (0.4, 1.6):
        gl.box((0.07, 0.7, 0.07), loc=(-5.54, 1.2, zz), color="iron", base=True)
    A.add("church_wall_front", gf, parent=root)
    A.add("church_wall_back", gb, parent=root)
    A.add("church_wall_left", gl, parent=root)
    A.add("church_wall_right", gr, parent=root)
    # vantaux du portail (deux, s'ouvrent vers la nef)
    ff = B.Face("front", 0.0, hy)
    for right in (False, True):
        name = "church_right_door" if right else "church_left_door"
        leaf_node(A, name, root, ff, (pw / 2 - 0.02) * (1 if right else -1), -t + 0.06, pw / 2 - 0.03, ph - 0.03,
                  "wood_dark", right=right)
    # toits: nef (pignon ouest arasé contre le clocher), pignons, chœur et demi-cône de l'abside
    r = A.geo()
    B.gable_roof(r, -5.75, x1, -hy, hy, ze, zr, "lauze", edge="lauze_dark", over=0.4, ridge_color="lauze_dark")
    for xg in (x1 - t / 2, x0 + t / 2):
        r.prism([(-hy, ze - 0.05), (hy, ze - 0.05), (0, zr - 0.25)], t, loc=(xg, 0, 0), color="stone", rot=(0, 0, 90))
    r.box((0.12, 0.12, 0.85), loc=(x1 - 0.05, 0, zr + 0.05), color="stone_light", base=True)
    r.box((0.12, 0.5, 0.12), loc=(x1 - 0.05, 0, zr + 0.55), color="stone_light", base=True)
    cz_e, cz_r = 6.0, 9.0
    B.gable_roof(r, x1 - 0.3, cx_a, -ro, ro, cz_e, cz_r, "lauze", edge="lauze_dark", over=0.3, ridge_color="lauze_dark")
    _apse_roof(r, cx_a, ro + 0.3, cz_e - 0.3 * (cz_r - cz_e) / ro + 0.03, cz_r + 0.03)
    A.add("church_roof", r, parent=root)
    church_interior(A, root)
    return root


def _apse_roof(r, cx, R, z0, z1, n=6, thick=0.14):
    """Demi-cône de lauzes sur l'abside (de -90 à +90 degrés autour de x = cx), avec son épaisseur de rive."""
    apex = (cx, 0.0, z1)
    ring = [(cx + R * math.cos(-math.pi / 2 + math.pi * k / n), R * math.sin(-math.pi / 2 + math.pi * k / n)) for k in
            range(n + 1)]
    vs = [apex] + [(p[0], p[1], z0) for p in ring] + [(p[0], p[1], z0 - thick) for p in ring] + [(cx, 0.0, z0 - thick)]
    m = n + 1
    faces = []
    for k in range(n):
        faces.append((0, 1 + k, 2 + k))
        faces.append((1 + k, 1 + m + k, 2 + m + k, 2 + k))
        faces.append((2 * m + 1, 2 + m + k, 1 + m + k))
    faces.append((0, 1 + n, 1 + m + n, 2 * m + 1))
    faces.append((0, 2 * m + 1, 1 + m, 1))
    vv = r.mesh(vs, faces, "lauze")
    bmesh.ops.recalc_face_normals(r.bm, faces=list({f for v in vv for f in v.link_faces}))
    r.recolor(vv, by_normal("lauze", "lauze_dark", "lauze_dark", thr=0.3))
    # rangs de lauzes: deux anneaux de petits bandeaux
    for tt in (0.33, 0.66):
        rr = R * (1 - tt)
        zz = z0 + (z1 - z0) * tt
        for k in range(n):
            a = -math.pi / 2 + math.pi * (k + 0.5) / n
            r.box((0.05, 2 * rr * math.sin(math.pi / n / 2) + 0.02, 0.03), loc=(cx + rr * math.cos(a), rr * math.sin(a), zz + 0.01),
                  color="lauze_dark", rot=(0, -math.degrees(math.atan2(z1 - z0, R)), math.degrees(a)))


def tower(g, C):
    """Clocher-porche: fût carré de 4,9 m (x -10,4 à -5,5), contreforts d'angle à l'ouest, porte ouest fermée,
    beffroi à quatre baies cintrées (cloches pendues dans les baies sud et est, abat-sons à l'ouest et au nord),
    corniche, flèche de lauzes à coyau, boule, croix et coq à 20 m. Le mur est du clocher ferme la nef."""
    x0, x1, h, ztop = C["tx0"], C["tx1"], C["th"], C["tz"]
    cx = (x0 + x1) / 2
    hx = (x1 - x0) / 2
    t = 0.7
    p = Piece(g)
    zb0, zbs, bw = 10.7, 12.6, 1.35
    belfry = (0.0, bw, zb0, zbs + bw / 2 + 0.12)
    ops = {"front": [belfry, (0.0, 0.26, 7.6, 8.9)], "back": [belfry], "left": [belfry, (0.0, 1.3, 0.0, 2.77)],
           "right": [belfry, (1.2, 0.9, 0.0, 2.15)]}
    for side in SIDES:
        f = B.Face(side, hx, h)
        L = wall_len(side, hx, h, t)
        Lo = 2 * hx if side in ("front", "back") else 2 * h
        col = B.wall_color("stone", "stone_dark", INWARD[side])
        pierced_wall(g, f, L, t, ztop, ops[side], col)
        arch_fill(g, f, 0.0, bw, zbs, t, col)
        voussoirs(g, f, 0.0, bw, zbs, "stone_light", d=0.03, n=7, ring=0.22)
        for s in (1, -1):
            f.box(g, (0.18, 0.06, zbs - zb0), s * (bw / 2 + 0.09), 0.03, (zb0 + zbs) / 2, "stone_light")
        f.box(g, (bw + 0.4, 0.22, 0.12), 0.0, 0.08, zb0 - 0.06, "stone_light", bevel=0.02)
        if side in ("back", "left"):
            # abat-sons (planches inclinées) dans les baies ouest et nord
            for k in range(5):
                f.box(g, (bw + 0.03, 0.05, 0.36), 0.0, -t / 2, zb0 + 0.3 + k * 0.38, "wood_old", rot=(35, 0, 0))
        if side == "left":
            # porte ouest du clocher, fermée: arc, vantaux de chêne, pentures, seuil
            arch_fill(g, f, 0.0, 1.3, 2.0, t, col)
            arch_panel(g, f, 0.0, 1.3, 0.0, 2.0, -0.25, 0.06, "wood_dark")
            f.box(g, (0.03, 0.07, 2.6), 0.0, -0.25, 1.3, "black")
            for zz in (0.5, 1.6):
                f.box(g, (1.2, 0.08, 0.08), 0.0, -0.25, zz, "iron")
            voussoirs(g, f, 0.0, 1.3, 2.0, "stone_light", d=0.03, n=7, ring=0.22)
            f.box(g, (1.8, 0.5, 0.12), 0.0, 0.25, 0.06, "stone_light", bevel=0.02, bedges=B._not_ground)
        # cordon au niveau de l'égout de la nef, corniche du beffroi (ils font le tour, coins compris)
        f.box(g, (Lo + 0.24, 0.12, 0.14), 0.0, 0.06, 7.15, "stone_light")
        f.box(g, (Lo + 0.48, 0.24, 0.22), 0.0, 0.12, ztop - 0.08, "stone_light", bevel=0.03)
        if side != "right":
            plinth_side(g, f, Lo + 0.08, ops[side], 0.6, "stone_dark", d=0.04)
    quoins_side(g, hx, h, ztop - 0.25, -1, "stone_light", seed=21, step=0.5)
    quoins_side(g, hx, h, ztop - 0.25, 1, "stone_light", seed=22, step=0.5)
    # contreforts d'angle ouest, tournés vers le nord et le sud (dans l'emprise), en deux ressauts
    for sy in (1, -1):
        for zz, hh, dd in ((0.0, 4.5, 0.55), (4.5, 3.2, 0.38)):
            g.box((0.7, dd, hh), loc=(-hx + 0.35, sy * (h + dd / 2), zz), color="stone", base=True, bevel=0.04,
                  bedges=B._vertical)
            solid(g, [(-hx, sy * h, zz + hh), (-hx + 0.7, sy * h, zz + hh), (-hx + 0.7, sy * (h + dd), zz + hh),
                      (-hx, sy * (h + dd), zz + hh), (-hx, sy * h, zz + hh + 0.6), (-hx + 0.7, sy * h, zz + hh + 0.6)],
                  [(0, 1, 2, 3), (0, 1, 5, 4), (1, 2, 5), (3, 0, 4), (2, 3, 4, 5)], "stone_light")
    # plancher du beffroi et poteaux du beffroi de chêne
    g.box((2 * hx - 2 * t + 0.02, 2 * h - 2 * t + 0.02, 0.12), loc=(0, 0, zb0 - 0.32), color="wood_dark", base=True)
    for sx in (1, -1):
        for sy in (1, -1):
            g.box((0.16, 0.16, 2.5), loc=(sx * (hx - t - 0.12), sy * (h - t - 0.12), zb0 - 0.2), color="wood_dark",
                  base=True)
    # cloches pendues dans l'épaisseur des baies sud et est (vues de la caméra du jeu, qui plonge à 35 degrés:
    # pendues au milieu du beffroi, elles seraient cachées par le jambage), sur un joug de chêne scellé dans les
    # jambages, sous l'arc
    zj = zbs + 0.3
    yb = -(h - t / 2)
    g.box((bw + 0.3, 0.2, 0.2), loc=(0, yb, zj), color="wood_dark", base=True)
    top = bell(g, (0.0, yb, 11.9), r=0.4)
    g.box((0.08, 0.08, zj - top + 0.01), loc=(0, yb, top - 0.01), color="iron", base=True)
    xb = hx - t / 2
    g.box((0.2, bw + 0.3, 0.2), loc=(xb, 0, zj), color="wood_dark", base=True)
    top = bell(g, (xb, 0.0, 12.0), r=0.34)
    g.box((0.08, 0.08, zj - top + 0.01), loc=(xb, 0, top - 0.01), color="iron", base=True)
    # flèche: coyau (pan évasé) puis pyramide, arêtiers sombres; boule, croix, coq de girouette
    _spire(g, hx + 0.32, h + 0.32, ztop + 0.12, 2.05, ztop + 0.75, 19.35)
    g.sphere(0.12, loc=(0, 0, 19.38), color="brass", segs=8, rings=5)
    g.cyl(0.025, 0.62, loc=(0, 0, 19.38), color="iron", segs=5, base=True)
    g.box((0.32, 0.03, 0.03), loc=(0, 0, 19.78), color="iron")
    cock = [(-0.16, 0.0), (0.02, 0.0), (0.12, 0.05), (0.17, 0.14), (0.13, 0.17), (0.1, 0.12), (0.03, 0.1),
            (-0.07, 0.2), (-0.14, 0.17), (-0.19, 0.06)]
    g.prism(cock, 0.025, loc=(0, 0, 19.84), color="brass")
    g.cyl(0.012, 0.06, loc=(0, 0, 19.8), color="iron", segs=5, base=True)
    p.place((cx, 0, 0), 0)


def _spire(g, ax, ay, z0, r1, z1, z2):
    """Flèche carrée: égout débordant (ax, ay) à z0, coyau jusqu'à r1 à z1, pointe à z2; épaisseur de rive."""
    pts0 = [(-ax, -ay), (ax, -ay), (ax, ay), (-ax, ay)]
    pts1 = [(-r1, -r1), (r1, -r1), (r1, r1), (-r1, r1)]
    vs = [(x, y, z0) for x, y in pts0] + [(x, y, z1) for x, y in pts1] + [(0, 0, z2)] + \
         [(x * 0.97, y * 0.97, z0 - 0.16) for x, y in pts0]
    faces = []
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append((k, k2, 4 + k2, 4 + k))
        faces.append((4 + k, 4 + k2, 8))
        faces.append((9 + k, 9 + k2, k2, k))
    faces.append((12, 11, 10, 9))
    vv = g.mesh(vs, faces, "lauze")
    bmesh.ops.recalc_face_normals(g.bm, faces=list({f for v in vv for f in v.link_faces}))
    g.recolor(vv, by_normal("lauze", "lauze", "lauze_dark", thr=0.95))
    for k in range(4):
        a = Vector((pts1[k][0], pts1[k][1], z1))
        b = Vector((0, 0, z2))
        D.rod(g, a, b, 0.07, "lauze_dark", segs=6)
        a0 = Vector((pts0[k][0], pts0[k][1], z0))
        D.rod(g, a0, a, 0.07, "lauze_dark", segs=6)
    # rangs de lauzes sur la pyramide
    for tt in (0.25, 0.5, 0.72):
        rr = r1 * (1 - tt)
        zz = z1 + (z2 - z1) * tt
        ang = math.degrees(math.atan2(z2 - z1, r1))
        for k in range(4):
            a = math.radians(90 * k)
            g.box((2 * rr, 0.05, 0.03), loc=(rr * math.sin(a) * 1.0, -rr * math.cos(a), zz + 0.01), color="lauze_dark",
                  rot=(-ang, 0, 90 * k))


def church_interior(A, root):
    """Bancs (8 blocs de 3 places tournés vers le chœur), chaire, statue de saint Aubin, harmonium, présentoir
    de cierges, autel isolé dans le chœur (cases de la carte, interieurs.church.mobilier)."""
    g = A.geo()
    fp = Footprints()
    z = FL
    # bancs: cases x 91, 93, 97, 99 (x -4, -2, 2, 4), y 1 à 4 et -4 à -1
    for xc in (-4.0, -2.0, 2.0, 4.0):
        for yc in (2.5, -2.5):
            fp.add(pew(g, (xc - 0.15, yc, z), L=2.8))
    # chaire (96, -16): cuve octogonale sur colonne, abat-voix, contre le mur nord (porte dans l'épaisseur)
    px, py = 1.0, 4.55
    p = Piece(g)
    g.cyl(0.09, 1.3, loc=(0, 0, 0), color="stone_light", segs=8, base=True)
    g.lathe([(0.15, 1.15), (0.42, 1.38), (0.44, 1.5), (0.44, 2.35), (0.48, 2.42)], loc=(0, 0, 0),
            colors=["wood_dark", "wood_dark", "wood", "wood_dark"], segs=8, phase=22.5, close_top=True)
    for k in range(8):
        a = math.radians(22.5 + 45 * k)
        if math.sin(a) > 0.5:
            continue
        g.box((0.22, 0.03, 0.5), loc=(0.45 * math.cos(a), 0.45 * math.sin(a), 1.95), color="wood_new",
              rot=(0, 0, math.degrees(a) + 90))
    g.box((0.9, 0.06, 1.6), loc=(0, 0.42, 2.4), color="wood_dark", base=True)
    g.cyl(0.62, 0.12, loc=(0, 0, 4.0), color="wood_dark", segs=8, base=True, rot=(0, 0, 22.5))
    g.lathe([(0.55, 4.12), (0.25, 4.45), (0.0, 4.55)], loc=(0, 0, 0), colors="wood", segs=8, phase=22.5)
    fp.add(p.place((px, py, z), 0))
    # statue de saint Aubin (92, -16) sur son socle: robe, chape bleue, mitre et crosse
    sx, sy = -3.0, 4.55
    p = Piece(g)
    g.box((0.5, 0.42, 1.1), loc=(0, 0, 0), color="stone_light", base=True, bevel=0.03)
    g.box((0.6, 0.5, 0.08), loc=(0, 0, 1.1), color="stone", base=True, bevel=0.02)
    g.lathe([(0.2, 1.18), (0.17, 1.6), (0.14, 1.95), (0.1, 2.0)], loc=(0, 0, 0), colors="paint_cream", segs=8)
    g.lathe([(0.22, 1.3), (0.2, 1.7), (0.16, 1.95), (0.08, 2.02)], loc=(0, 0.03, 0), colors="paint_blue", segs=8,
            scale=(1.0, 0.7, 1.0))
    g.sphere(0.1, loc=(0, 0, 2.1), color="plaster_cream", segs=8, rings=5)
    g.cyl(0.08, 0.17, loc=(0, 0, 2.17), r2=0.02, color="paint_yellow", segs=6, base=True)
    g.cyl(0.015, 1.0, loc=(0.2, -0.05, 1.2), color="brass", segs=5, base=True)
    g.box((0.08, 0.02, 0.1), loc=(0.17, -0.05, 2.22), color="brass")
    g.cyl(0.18, 0.012, loc=(0, 0.1, 2.12), color="brass", segs=10, rot=(90, 0, 0))
    candle_row(g, -0.15, -0.12, 1.18, 3, 0.15)
    fp.add(p.place((sx, sy, z), 0))
    # harmonium (100, -16): buffet, clavier au sud, tabouret
    hx_, hy_ = 5.0, 4.6
    p = Piece(g)
    g.box((1.15, 0.5, 0.95), loc=(0, 0.0, 0), color="wood_dark", base=True, bevel=0.02)
    g.box((1.0, 0.25, 0.06), loc=(0, -0.3, 0.8), color="wood", base=True)
    g.box((0.9, 0.16, 0.03), loc=(0, -0.32, 0.86), color="white_paint", base=True)
    g.box((1.15, 0.12, 0.45), loc=(0, 0.2, 0.95), color="wood_dark", base=True)
    g.box((0.5, 0.03, 0.3), loc=(0, 0.1, 1.05), color="paper", rot=(-12, 0, 0))
    for x in (-0.3, 0.3):
        g.box((0.14, 0.2, 0.04), loc=(x, -0.2, 0.08), color="wood_new", base=True, rot=(15, 0, 0))
    g.cyl(0.17, 0.05, loc=(0, -0.72, 0.45), color="wood", segs=8, base=True)
    g.cyl(0.03, 0.45, loc=(0, -0.72, 0.0), color="wood_dark", segs=5, base=True)
    g.cyl(0.14, 0.03, loc=(0, -0.72, 0.0), color="wood_dark", segs=6, base=True)
    fp.add(p.place((hx_, hy_, z), 0))
    # présentoir de cierges (101, -8): plateau de fer à trois rangs sur pied
    p = Piece(g)
    g.cyl(0.03, 0.8, loc=(0, 0, 0), color="iron", segs=5, base=True)
    g.cyl(0.2, 0.03, loc=(0, 0, 0), color="iron", segs=6, base=True)
    g.box((0.7, 0.4, 0.04), loc=(0, 0, 0.8), color="iron", base=True)
    g.box((0.66, 0.36, 0.02), loc=(0, 0, 0.84), color="brass", base=True)
    for k, yy in enumerate((-0.12, 0.0, 0.12)):
        candle_row(g, -0.27, yy, 0.86, 7, 0.09, h=0.08 + 0.04 * k)
    g.box((0.16, 0.12, 0.2), loc=(0.3, 0.3, 0.0), color="wood_dark", base=True)
    fp.add(p.place((6.0, -3.5, z), 0))
    # autel (103, -12 et -11): bloc de pierre, nappe, croix et deux chandeliers; on en fait le tour
    p = Piece(g)
    g.box((0.85, 1.8, 0.95), loc=(0, 0, 0), color="stone_light", base=True, bevel=0.03)
    g.box((0.95, 1.9, 0.08), loc=(0, 0, 0.95), color="stone", base=True, bevel=0.02)
    g.box((0.97, 1.92, 0.012), loc=(0, 0, 1.03), color="white_paint", base=True)
    g.box((0.012, 1.92, 0.32), loc=(-0.485, 0, 0.72), color="white_paint", base=True)
    g.box((0.02, 0.5, 0.3), loc=(-0.434, 0, 0.3), color="paint_yellow")
    g.cyl(0.015, 0.45, loc=(0.2, 0, 1.04), color="brass", segs=5, base=True)
    g.box((0.03, 0.22, 0.03), loc=(0.2, 0, 1.38), color="brass")
    for yy in (-0.6, 0.6):
        g.cyl(0.05, 0.03, loc=(0.2, yy, 1.04), color="brass", segs=6, base=True)
        g.cyl(0.012, 0.22, loc=(0.2, yy, 1.07), color="brass", segs=5, base=True)
        candle_row(g, 0.2, yy, 1.29, 1)
    fp.add(p.place((8.0, 0.0, z), 0))
    A.add("church_interior", g, parent=root)
    root["interior_spots"] = {"church_altar": _gl(7.3, 0.0), "church_pulpit": _gl(1.0, 3.9),
                              "church_bell_rope": _gl(-5.0, 0.5), "church_harmonium_stool": _gl(5.0, 3.88),
                              "church_candles": _gl(6.0, -3.5)}
    root["interior_blocked"] = blocked_cells(fp.boxes, -5.5, 9.5, -5.0, 5.0)


# Moulin de la Vanne -------------------------------------------------------------------------------------------
# Carte: emprise x -17 à -11, y 28 à 34 (centre -13,5 ; 31,5), rotation 1 (porte à l'est).
# x = 31,5 - Y (le long de la façade, vers le nord), y = -13,5 - X (vers l'ouest). Salle des meules x -16 à -12,
# y 29 à 33: x -2,5 à 2,5, y -2,5 à 2,5. Mur sud (côté bief) à x -2,5 à -3,0; bief à partir de x -3,5 (Y 35).

MILL = dict(hx=3.0, hy=3.0, t=0.5, h1=3.0, ze=5.5, zr=9.0)


def watermill(A):
    M = MILL
    hx, hy, t, h1, ze, zr = M["hx"], M["hy"], M["t"], M["h1"], M["ze"], M["zr"]
    root = interior_root(
        A, "watermill", [7, 7], 3,
        [{"id": "mill_millstones", "x": [-2.5, 2.5], "z": [-2.5, 2.5]}],
        ["watermill_roof", "watermill_upper"],
        "façade (porte, porte à sacs, potence) sur le pignon est de la carte; le mur gauche (-X) est le mur sud, "
        "le long du bief: l'axe de la roue (mill_wheel) y entre à 0,95 m; le rouet et la lanterne tournent "
        "dans la salle, contre ce mur (nœud mill_wheel)")
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    I.floor_boards(g, -2.5, 2.5, -2.5, 2.5, FL, along="y", w=0.5)
    # perré de pierre au bord du bief, sous le mur sud (Y 34,5 à 35)
    g.box((0.52, 2 * hy + 0.9, 0.6), loc=(-hx - 0.24, 0, -0.55), color=by_normal("stone_light", "stone"), base=True)
    A.add("watermill_floor", g, parent=root)
    ops = {
        "front": [(0.0, 1.1, 0.0, 2.3), (-1.85, 0.75, 1.0, 2.1), (1.85, 0.75, 1.0, 2.1)],
        "back": [(-1.2, 0.75, 1.1, 2.1)],
        "left": [(-1.6, 0.75, 1.05, 2.05), (1.7, 0.75, 1.05, 2.05), (0.0, 0.42, 0.75, 1.17)],
        "right": [(0.0, 0.75, 1.1, 2.1)],
    }

    def deco(side, g_, f):
        if side == "front":
            door_frame(g_, f, 0.0, 1.1, 2.3, t, frame="wood_dark", step="stone_dark")
            for u in (-1.85, 1.85):
                glazed(g_, f, u, 0.75, 1.0, 2.1, t, frame="paint_cream", shutter="paint_blue")
            f.box(g_, (1.3, 0.12, 0.22), 0.0, 0.05, 2.42, "stone_light")
            # sacs de farine au pied du mur, à droite de la porte
            for k, (uu, zz) in enumerate(((1.0, 0.0), (1.35, 0.0), (1.18, 0.42))):
                p = f.p(uu, 0.25, zz)
                g_.sphere(1.0, loc=(p[0], p[1], zz + 0.22), color=by_normal("paper", "paper_dark"), segs=8, rings=5,
                          scale=(0.2, 0.17, 0.24), rot=(0, 0, 10 * k))
                g_.cyl(0.07, 0.08, loc=(p[0], p[1], zz + 0.42), color="rope", segs=6, base=True)
        elif side == "left":
            for u in (-1.6, 1.7):
                glazed(g_, f, u, 0.75, 1.05, 2.05, t, frame="paint_cream", shutter="paint_blue")
            # passage de l'axe: palier de chêne et cadre de pierre
            f.box(g_, (0.7, 0.1, 0.12), 0.0, 0.05, 1.23, "stone_light")
            f.box(g_, (0.7, 0.1, 0.12), 0.0, 0.05, 0.69, "stone_light")
            f.box(g_, (0.62, t + 0.02, 0.08), 0.0, -t / 2, 0.75 + 0.04, "wood_dark")
            f.box(g_, (0.62, t + 0.02, 0.08), 0.0, -t / 2, 1.17 - 0.04, "wood_dark")
        elif side == "back":
            glazed(g_, f, -1.2, 0.75, 1.1, 2.1, t, frame="paint_cream", shutter="paint_blue")
        elif side == "right":
            glazed(g_, f, 0.0, 0.75, 1.1, 2.1, t, frame="paint_cream", shutter="paint_blue")

    side_walls(A, root, "watermill", hx, hy, h1, t, ops, "stone", "plaster_cream", deco, plinth=0.55)
    I.door_leaf(A, "watermill_door", root, B.Face("front", hx, hy), 0.0, 1.1, 2.3, t, color="wood_dark")
    # étage (logis de la meunière) et pignons; plancher = plafond de la salle
    g = A.geo()
    g.box((2 * hx - 2 * t, 2 * hy - 2 * t, 0.14), loc=(0, 0, h1 - 0.14), color="wood_dark", base=True)
    g.box((2 * hx, 2 * hy, ze - h1 - 0.05), loc=(0, 0, h1), color="stone", base=True)
    gable_prisms(g, hx, hy, ze - 0.05, zr, t, "stone", axis="y")
    for side in SIDES:
        f = B.Face(side, hx, hy)
        L = wall_len(side, hx, hy, 0.0)
        f.box(g, (L + 0.06, 0.1, 0.14), 0.0, 0.05, h1 + 0.05, "stone_light")
    quoins_side(g, hx, hy, ze - 0.1, -1, "stone_light", seed=31, z0=h1 - 0.05 + 0.0)
    quoins_side(g, hx, hy, ze - 0.1, 1, "stone_light", seed=32, z0=h1 - 0.05)
    fr = B.Face("front", hx, hy)
    for u in (-1.6, 1.6):
        win(g, fr, u, 3.55, 0.7, 0.95, shutter="paint_blue", flowers=True)
    # porte à sacs au pignon, potence, poulie, corde et sac de farine pendu
    fr.box(g, (1.0, 0.05, 1.25), 0.0, 0.02, 6.1, "wood_dark")
    fr.box(g, (0.9, 0.05, 1.15), 0.0, 0.035, 6.1, "shadow")
    fr.box(g, (0.9, 0.04, 1.12), -0.3, 0.46, 6.1, "wood_dark", rot=(0, 0, -70))
    fr.box(g, (1.2, 0.12, 0.1), 0.0, 0.07, 5.45, "stone_light")
    fr.box(g, (0.18, 1.2, 0.2), 0.0, 0.6, 7.25, "wood_dark")
    fr.box(g, (0.12, 0.12, 0.85), 0.0, 0.02, 6.9, "wood_dark")
    B.rod(g, fr.p(0.0, 0.05, 6.5), fr.p(0.0, 0.8, 7.2), 0.05, "wood_dark")
    pp = fr.p(0.0, 1.05, 7.12)
    g.cyl(0.11, 0.06, loc=pp, color="iron", segs=8, rot=(0, 90, 0))
    rope(g, [fr.p(0.0, 1.16, 7.1), fr.p(0.0, 1.16, 5.86)], 0.014)
    sp = fr.p(0.0, 1.16, 5.6)
    g.sphere(1.0, loc=sp, color=by_normal("paper", "paper_dark"), segs=8, rings=5, scale=(0.2, 0.17, 0.3))
    word(g, fr, 0.0, 0.03, 2.83, "MOULIN", 0.05, "paint_blue")
    fr.box(g, (1.75, 0.03, 0.4), 0.0, 0.012, 2.83, "paint_cream")
    fb = B.Face("back", hx, hy)
    win(g, fb, 0.8, 3.55, 0.7, 0.95, shutter="paint_blue")
    win(g, fb, 0.0, 6.0, 0.55, 0.7, shutter=None)
    fl = B.Face("left", hx, hy)
    for u in (-1.5, 1.5):
        win(g, fl, u, 3.55, 0.7, 0.95, shutter="paint_blue", flowers=(u > 0))
    win(g, B.Face("right", hx, hy), -1.0, 3.55, 0.7, 0.95, shutter="paint_blue")
    A.add("watermill_upper", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "lauze", "lauze_dark", axis="y", over_x=0.38, over_y=0.34)
    B.round_chimney(r, 1.6, 1.2, 6.4, 9.6)
    A.add("watermill_roof", r, parent=root)
    mill_interior(A, root)
    return root


def mill_interior(A, root):
    """Salle des meules: beffroi de chêne et meules sous leur archure contre le mur ouest (+Y), trémie, auget,
    sac sous la goulotte; sacs de farine contre le mur sud (-X, cases -14 et -13 ; 33) à côté du rouet; poutre du
    plafond où tourne la lanterne."""
    g = A.geo()
    fp = Footprints()
    z = FL
    # cases -16 et -15 ; 30 et 31: x -0,5 à 1,5, y 0,5 à 2,5
    bx0, bx1, by0, by1 = -0.45, 1.45, 1.05, 2.45
    g.box((bx1 - bx0, by1 - by0, 0.55), loc=((bx0 + bx1) / 2, (by0 + by1) / 2, z), color="wood_dark", base=True,
          bevel=0.02)
    for xx in (bx0 + 0.06, bx1 - 0.06):
        g.box((0.12, 0.12, 0.55), loc=(xx, by0 + 0.06, z), color="wood", base=True)
    cx, cy = 0.5, 1.75
    zt = z + 0.55
    g.cyl(0.66, 0.42, loc=(cx, cy, zt), color="wood", segs=12, base=True)
    g.cyl(0.68, 0.04, loc=(cx, cy, zt + 0.12), color="iron", segs=12, base=True)
    g.cyl(0.62, 0.03, loc=(cx, cy, zt + 0.42), color="wood_new", segs=12, base=True)
    # trémie sur son chevalet, auget et goulotte vers le sac
    for sx in (-0.35, 0.35):
        g.box((0.06, 0.06, 0.6), loc=(cx + sx, cy, zt + 0.42), color="wood_dark", base=True)
    g.box((0.82, 0.08, 0.06), loc=(cx, cy, zt + 0.98), color="wood_dark")
    g.cyl(0.36, 0.42, loc=(cx, cy, zt + 0.98), r2=0.08, color="wood_new", segs=4, rot=(180, 0, 45))
    g.cyl(0.33, 0.02, loc=(cx, cy, zt + 0.99), color="grain", segs=4, rot=(0, 0, 45))
    g.box((0.12, 0.42, 0.06), loc=(cx, cy - 0.32, zt + 0.5), color="wood", rot=(-15, 0, 0))
    g.box((0.16, 0.36, 0.1), loc=(cx, by0 - 0.12, z + 0.45), color="wood", rot=(35, 0, 0))
    I.sack(g, (cx, by0 - 0.3, z), h=0.5, color="paper", fold="paper_dark", seed=1)
    fp.rect(bx0, bx1, by0 - 0.55, by1)
    # balance à sacs et pelle à farine contre le beffroi
    g.box((0.04, 0.04, 1.0), loc=(bx1 + 0.08, by0 + 0.2, z), color="wood", base=True, rot=(0, -8, 0))
    g.box((0.22, 0.03, 0.26), loc=(bx1 + 0.2, by0 + 0.2, z + 0.08), color="wood_new", base=True, rot=(0, -8, 0))
    # sacs de farine contre le mur sud (case -13 ; 33: x -2,5 à -1,5, y -1,5 à -0,5)
    for k, (x, y, zz) in enumerate(((-2.2, -1.25, 0.0), (-2.2, -0.82, 0.0), (-1.8, -1.05, 0.0), (-2.2, -1.04, 0.47))):
        g.sphere(1.0, loc=(x, y, z + zz + 0.24), color=by_normal("paper", "paper_dark"), segs=8, rings=5,
                 scale=(0.2, 0.2, 0.25), rot=(0, 0, 25 * k))
        g.cyl(0.07, 0.08, loc=(x, y, z + zz + 0.46), color="rope", segs=6, base=True)
    fp.rect(-2.45, -1.55, -1.45, -0.6)
    # poutre du plafond (porte le palier haut de la lanterne), nord-sud au-dessus du rouet
    g.box((5.0, 0.22, 0.26), loc=(0.0, 0.0, MILL["h1"] - 0.14 - 0.26), color="wood_dark", base=True)
    # chaises de la meunière, lampe, farine au sol
    for k, (x, y) in enumerate(((1.6, -1.8), (1.95, -1.3))):
        g.cyl(0.18 + 0.06 * k, 0.01, loc=(x, y, z), color="paper", segs=8, base=True)
    A.add("watermill_interior", g, parent=root)
    root["interior_spots"] = {"mill_hopper": _gl(cx, by0 - 0.7), "mill_sacks": _gl(-1.3, -1.0),
                              "mill_gear": _gl(-1.4, 0.0)}
    root["interior_blocked"] = blocked_cells(fp.boxes, -2.5, 2.5, -2.5, 2.5)


# Roue du moulin (animée) ------------------------------------------------------------------------------------
# Carte: mill_wheel en (-13,5 ; 36), rotation 1. Repère du modèle: x = 36 - Y (vers le moulin, au nord),
# y = -13,5 - X (vers l'amont, à l'ouest). Mur sud du moulin: nu extérieur à Y 34,5 (x 1,5), intérieur à Y 34
# (x 2,0). Bief Y 35 à 37 (x -1 à 1), eau du bief en dessous du sol (lit à -0,46).

WHEEL = dict(R=1.25, zc=0.95, width=0.72, n=10, period=8.0, cogs=15, staves=5)


def mill_wheel(A):
    W = WHEEL
    R, zc, wd, n = W["R"], W["zc"], W["width"], W["n"]
    root = A.group("mill_wheel", {
        "footprint": [2, 1], "animation": "mill_wheel_turn", "period_s": W["period"],
        "gear_ratio": W["cogs"] / W["staves"],
        "note": "roue à aubes de 2,5 m, axe selon X du modèle, le moulin du côté +X: posée à la rotation 1 de la "
                "carte (comme le moulin), l'axe entre dans le mur sud et porte le rouet, qui mène la lanterne de "
                "l'arbre vertical dans la salle des meules. L'eau du bief (vers l'est de la carte, -Z du modèle) "
                "pousse le bas de la roue: mill_wheel_turn tourne dans ce sens (boucle de 8 s). Palier extérieur "
                "sur une pile de pierre de la rive sud du bief"})
    # parties fixes: pile et palier de la rive sud, palier dans le mur, crapaudine de l'arbre
    g = A.geo()
    g.box((0.5, 0.7, 0.72 + 0.46), loc=(-1.05, 0, -0.46), color=by_normal("stone_light", "stone"), base=True,
          bevel=0.04, bedges=B._vertical)
    g.box((0.36, 0.42, 0.16), loc=(-1.05, 0, 0.72), color="wood_dark", base=True)
    g.box((0.24, 0.24, 0.06), loc=(2.54, 0.0, FL), color="iron", base=True)
    A.add("mill_wheel_frame", g, parent=root)
    # rotor: axe, deux couronnes, bras, aubes, frettes; rouet à alluchons dans la salle
    g = A.geo()
    g.cyl(0.15, 3.6, loc=(0.6, 0, 0), color="wood_dark", segs=8, rot=(0, 90, 0))
    g.cyl(0.21, 0.5, loc=(0, 0, 0), color="iron", segs=8, rot=(0, 90, 0))
    for side in (-1, 1):
        xs = side * (wd / 2 - 0.05)
        # couronne: n tronçons de jante
        for k in range(n):
            a = 2 * math.pi * (k + 0.5) / n
            L = 2 * (R - 0.08) * math.sin(math.pi / n) + 0.04
            g.box((0.09, L, 0.16), loc=(xs, (R - 0.08) * math.cos(a), (R - 0.08) * math.sin(a)), color="wood",
                  rot=(math.degrees(a) + 90, 0, 0))
        # bras
        for k in range(5):
            a = 2 * math.pi * k / 5
            L = R - 0.2
            g.box((0.08, 0.1, L), loc=(xs, (L / 2 + 0.1) * math.cos(a), (L / 2 + 0.1) * math.sin(a)), color="wood_dark",
                  rot=(math.degrees(a) - 90, 0, 0))
    # aubes entre les couronnes, un peu en saillie
    for k in range(n):
        a = 2 * math.pi * k / n
        rr = R - 0.06
        g.box((wd + 0.04, 0.05, 0.42), loc=(0, rr * math.cos(a), rr * math.sin(a)), color="wood_old",
              rot=(math.degrees(a) - 90, 0, 0))
    # rouet: disque de chêne, cercle de fer, 24 alluchons sur sa face vers la salle (+X)
    xr = 2.22
    rr = 0.62
    g.cyl(rr, 0.12, loc=(xr, 0, 0), color="wood", segs=12, rot=(0, 90, 0))
    g.cyl(rr + 0.02, 0.05, loc=(xr - 0.03, 0, 0), color="iron", segs=12, rot=(0, 90, 0))
    for k in range(W["cogs"]):
        a = 2 * math.pi * k / W["cogs"]
        g.box((0.14, 0.06, 0.06), loc=(xr + 0.12, (rr - 0.07) * math.cos(a), (rr - 0.07) * math.sin(a)), color="wood_new",
              rot=(math.degrees(a), 0, 0))
    rot = A.add("mill_wheel_rotor", g, parent=root, loc=(0, 0, zc))
    # lanterne et arbre vertical (fuseaux pris entre deux plateaux), au-dessus des alluchons du haut
    g = A.geo()
    rl = 0.2
    g.cyl(0.07, MILL["h1"] - 0.4 - FL - 0.06, loc=(0, 0, 0), color="wood_dark", segs=6, base=True)
    for zz in (zc + rr - 0.18, zc + rr + 0.14):
        g.cyl(rl + 0.05, 0.04, loc=(0, 0, zz - FL - 0.06), color="wood", segs=8, base=True)
    for k in range(W["staves"]):
        a = 2 * math.pi * k / W["staves"]
        g.cyl(0.022, 0.34, loc=(rl * math.cos(a), rl * math.sin(a), zc + rr - 0.16 - FL - 0.06), color="wood_new", segs=5,
              base=True)
    lan = A.add("mill_wheel_lantern", g, parent=root, loc=(xr + 0.12 + rl, 0, FL + 0.06))
    # animation: une piste NLA de même nom sur les deux nœuds (une seule animation à l'export)
    fps = 30
    frames = int(W["period"] * fps)
    for ob, axis, turns in ((rot, 0, -1.0), (lan, 2, -W["cogs"] / W["staves"])):
        ob.rotation_mode = "XYZ"
        ad = ob.animation_data_create()
        act = bpy.data.actions.new(f"{ob.name}_turn")
        ad.action = act
        ob.rotation_euler = (0, 0, 0)
        ob.keyframe_insert("rotation_euler", index=axis, frame=0)
        e = list(ob.rotation_euler)
        e[axis] = 2 * math.pi * turns
        ob.rotation_euler = e
        ob.keyframe_insert("rotation_euler", index=axis, frame=frames)
        from bpy_extras import anim_utils
        cb = anim_utils.action_get_channelbag_for_slot(act, ad.action_slot)
        for fc in cb.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
        ob.rotation_euler = (0, 0, 0)
        tr = ad.nla_tracks.new()
        tr.name = "mill_wheel_turn"
        st = tr.strips.new("mill_wheel_turn", 0, act)
        st.action_slot = act.slots[0]
        ad.action = None
    return root


# Passerelles du bief ----------------------------------------------------------------------------------------

def sluice_footbridge(A):
    """Passerelle de la vanne (carte x -19 et -18, y 35 et 36, centre -18 ; 36), à poser à la rotation 0: le bief
    coule selon +X du modèle (vers l'est), on y marche selon Z. Platelage à 0,16 m sur deux longrines posées sur
    des dés de pierre aux rives, garde-corps aval; la vanne en amont (-X): deux poteaux à rainures, chapeau,
    crémaillère et volant qu'on tourne à deux. La vanne est un nœud à part (`sluice_footbridge_gate`), baissée:
    la lever de `gate_lift` (m) selon +Y glTF."""
    root = A.group("sluice_footbridge", {
        "footprint": [2, 2], "flow_axis": "x", "walk_axis": "z", "walk_height": 0.16, "gate_lift": 0.5,
        "note": "à poser à la rotation 0 (le bief coule d'ouest en est); vanne baissée au repos"})
    g = A.geo()
    L = 3.0
    for y in (-L / 2 + 0.25, L / 2 - 0.25):
        g.box((1.7, 0.55, 0.62), loc=(0, y, -0.5), color=by_normal("stone_light", "stone"), base=True, bevel=0.03)
    for x in (-0.55, 0.55):
        g.box((0.14, L - 0.1, 0.18), loc=(x, 0, -0.06), color="wood_dark", base=True)
    n = 13
    for k in range(n):
        y = -L / 2 + 0.17 + k * (L - 0.34) / (n - 1)
        g.box((1.4, 0.2, 0.04), loc=(0, y, 0.12), color="wood" if k % 2 else "wood_new", base=True)
    for s in (1, -1):
        g.box((1.4, 0.42, 0.04), loc=(0, s * (L / 2 + 0.14), 0.06), color="wood_old",
              rot=(s * math.degrees(math.atan2(0.12, 0.42)), 0, 0))
    # garde-corps côté aval (+X)
    for k in range(3):
        y = -1.1 + k * 1.1
        g.box((0.07, 0.07, 1.1), loc=(0.66, y, -0.06), color="wood_dark", base=True)
    g.box((0.08, 2.4, 0.06), loc=(0.66, 0, 1.0), color="wood", base=True)
    g.box((0.04, 2.3, 0.05), loc=(0.69, 0, 0.55), color="wood_dark", base=True)
    # cadre de la vanne, à l'amont du platelage (rien au-dessus du passage): poteaux de chêne rainurés plantés dans
    # le lit, chapeau à 1,0 m, boîte du pignon au milieu; arbre de fer le long du chapeau et deux manivelles, une sur
    # chaque rive: on lève la vanne à deux, chacun à sa manivelle
    xg = -0.82
    for y in (-1.08, 1.08):
        g.box((0.2, 0.2, 1.46 + 0.46), loc=(xg, y, -0.46), color="wood_dark", base=True, bevel=0.02)
        g.box((0.26, 0.08, 1.4 + 0.46), loc=(xg, y - math.copysign(0.13, y), -0.46), color="wood", base=True)
    g.box((0.24, 2.6, 0.2), loc=(xg, 0, 1.0), color="wood_dark", base=True, bevel=0.02)
    g.box((0.2, 0.3, 0.24), loc=(xg, 0, 1.2), color="iron", base=True)
    zs = 1.32
    for y in (-1.08, 1.08):
        g.box((0.16, 0.14, 0.12), loc=(xg, y, 1.2), color="iron", base=True)
    B.rod(g, (xg, -1.5, zs), (xg, 1.5, zs), 0.03, "iron")
    for s in (1, -1):
        B.rod(g, (xg, s * 1.5, zs), (xg + 0.0, s * 1.5, zs - 0.28), 0.025, "iron")
        g.cyl(0.03, 0.18, loc=(xg, s * 1.59, zs - 0.28), color="wood_new", segs=5, rot=(90, 0, 0))

    A.add("sluice_footbridge_frame", g, parent=root)
    gg = A.geo()
    for k in range(5):
        gg.box((0.07, 2.08, 0.15), loc=(xg, 0, -0.46 + 0.06 + k * 0.15), color="wood_old" if k % 2 else "wood",
               base=True)
    gg.box((0.08, 2.08, 0.06), loc=(xg, 0, 0.36), color="iron", base=True)
    gg.box((0.06, 0.08, 1.45), loc=(xg, 0.0, 0.36), color="iron", base=True)
    for k in range(9):
        gg.box((0.07, 0.1, 0.03), loc=(xg, 0.0, 0.5 + 0.13 * k), color="iron_light")
    A.add("sluice_footbridge_gate", gg, parent=root)
    return root


def tailrace_planks(A):
    """Planches du halage sur le canal de fuite (carte x -9 et -8, y 37, centre -8 ; 37,5), à la rotation 0: le
    canal coule selon Z du modèle (vers le sud et l'Aubrune), on y marche selon X. Deux rondins sur les rives,
    planches de 1 m, piquets aux abouts."""
    g = A.geo()
    L = 2.8
    for y in (-0.36, 0.36):
        g.cyl(0.1, L, loc=(0, y, -0.06), color=by_normal("log_end", "bark", thr=0.5), segs=7, rot=(0, 90, 0))
    n = 12
    for k in range(n):
        x = -L / 2 + 0.14 + k * (L - 0.28) / (n - 1)
        g.box((0.2, 1.0, 0.04), loc=(x, 0, 0.025), color="wood_old" if k % 3 else "wood", base=True,
              rot=(0, 0, (k % 3 - 1) * 1.5))
    for x in (-L / 2 + 0.05, L / 2 - 0.05):
        for y in (-0.55, 0.55):
            g.cyl(0.05, 0.5, loc=(x, y, -0.25), color="wood_dark", segs=6, base=True)
    return g


# Lavoir ----------------------------------------------------------------------------------------------------
# Carte: x 99 à 103, y 35 à 37 (centre 101,5 ; 36,5), rotation 2 (ouvert au nord, sur le chemin). x = 101,5 - X,
# y = Y - 36,5: le nord (le chemin, le mur haut et son entrée) en -Y, la rivière (y 38) en +Y.

def washhouse(A):
    root = A.group("washhouse", {
        "footprint": [5, 3], "door_cell": 2,
        "note": "mur haut au nord (porte de la carte, case 2), toit à un pan qui descend vers la rivière sur une "
                "sablière et deux poteaux; bassin au sud, pierres à laver au bord nord du bassin (on lave tourné "
                "vers la rivière et la caméra), trop-plein vers l'Aubrune"})
    g = A.geo()
    hx, y0, y1 = 2.45, -1.45, 1.45
    zN = 3.6
    t = 0.4
    slope = 1.2 / (y1 - y0)

    def zr_(y):
        """Dessus du toit au-dessus de y (3,6 m au nord, 2,4 m au sud)."""
        return zN - (y - y0) * slope

    col = B.wall_color("stone", "stone_light", (0, 1, 0))
    # mur nord et son entrée cintrée
    f = B.Face("front", hx, -y0)
    ops = [(0.0, 1.3, 0.0, 2.27)]
    pierced_wall(g, f, 2 * hx, t, zN - 0.2, ops, col)
    plinth_side(g, f, 2 * hx + 0.06, ops, 0.45, "stone_dark")
    arch_fill(g, f, 0.0, 1.3, 1.5, t, col)
    voussoirs(g, f, 0.0, 1.3, 1.5, "stone_light", n=7, ring=0.18)
    quoins_side(g, hx, -y0, zN - 0.3, -1, "stone_light", seed=41)
    f.box(g, (1.6, 0.4, 0.06), 0.0, 0.2, 0.03, "stone_light")
    # murets de côté (est et ouest), poteaux d'angle sur dés de pierre au sud, sablière et aisseliers
    yy0 = y0 + t
    yp = y1 - 0.2
    zbt = zr_(yp) - 0.17
    for sx in (1, -1):
        g.box((0.35, y1 - yy0 - 0.25, 1.0), loc=(sx * (hx - 0.175), (yy0 + y1 - 0.25) / 2, 0), color="stone", base=True,
              bevel=0.04, bedges=B._not_ground)
        g.box((0.42, y1 - yy0 - 0.2, 0.08), loc=(sx * (hx - 0.175), (yy0 + y1 - 0.25) / 2, 1.0), color="stone_light",
              base=True, bevel=0.02)
        g.box((0.36, 0.36, 0.3), loc=(sx * (hx - 0.18), yp, 0), color="stone_light", base=True, bevel=0.03)
        g.box((0.18, 0.18, zbt - 0.24 - 0.3), loc=(sx * (hx - 0.18), yp, 0.3), color="wood_dark", base=True)
        B.rod(g, (sx * (hx - 0.18), yp, zbt - 1.0), (sx * (hx - 0.85), yp, zbt - 0.25), 0.05, "wood_dark")
    g.box((2 * hx + 0.1, 0.2, 0.24), loc=(0, yp, zbt - 0.24), color="wood_dark", base=True)
    # chevrons du toit à un pan, du haut du mur nord à la sablière (débord au sud)
    for k in range(7):
        x = -hx + 0.25 + k * (2 * hx - 0.5) / 6
        ya, yb = y0 + t - 0.05, y1 + 0.3
        B.rod(g, (x, ya, zr_(ya) - 0.12), (x, yb, zr_(yb) - 0.12), 0.05, "wood")
    # bassin: margelle, eau, pierres à laver inclinées au nord, trop-plein au sud
    bx, by0, by1 = 1.95, -0.25, 1.2
    for sx in (1, -1):
        g.box((0.22, by1 - by0, 0.3), loc=(sx * (bx - 0.11), (by0 + by1) / 2, 0), color="stone", base=True)
    g.box((2 * bx, 0.22, 0.3), loc=(0, by1 - 0.11, 0), color="stone", base=True)
    g.box((2 * bx - 0.44, by1 - by0 - 0.22, 0.02), loc=(0, (by0 + by1 - 0.22) / 2, 0.06), color="water", base=True)
    for k in range(4):
        g.box((0.82, 0.42, 0.08), loc=(-1.35 + k * 0.9, by0 + 0.1, 0.2), color="stone_light", rot=(-16, 0, 0),
              bevel=0.015)
    g.box((2 * bx - 0.44, 0.2, 0.18), loc=(0, by0 - 0.05, 0), color="stone", base=True)
    g.box((0.3, 0.24, 0.04), loc=(1.0, by1 - 0.11, 0.27), color="water")
    g.box((0.3, 0.16, 0.04), loc=(1.0, by1 + 0.07, 0.2), color="water_foam", rot=(-35, 0, 0))
    # dallage (sol à 0,12) entre le mur nord et le bassin
    g.box((2 * hx - 0.1, by0 - yy0 - 0.15, FL), loc=(0, (yy0 + by0 - 0.15) / 2, 0), color="stone_light", base=True)
    # arrivée d'eau de source: tuyau de fonte au travers du muret ouest, filet d'eau dans le bassin
    B.rod(g, (-hx - 0.05, 0.5, 0.7), (-1.6, 0.5, 0.7), 0.04, "iron")
    B.rod(g, (-1.58, 0.5, 0.67), (-1.55, 0.5, 0.08), 0.02, "water_foam")
    # garde-genoux, battoir, panier de linge, seau; linge sur la corde tendue entre les poteaux
    for x in (-0.9, 0.6):
        g.box((0.5, 0.36, 0.3), loc=(x, by0 - 0.33, FL), color="wood", base=True, bevel=0.02)
        g.box((0.44, 0.3, 0.06), loc=(x, by0 - 0.33, FL + 0.3), color="straw", base=True)
    g.box((0.08, 0.32, 0.02), loc=(-0.55, by0 + 0.1, 0.253), color="wood_new", rot=(-16, 0, 20))
    g.lathe([(0.2, 0.0), (0.26, 0.24), (0.27, 0.26)], loc=(1.55, -0.55, FL), colors="straw_dark", segs=10,
            close_top=False)
    for k in range(3):
        g.sphere(0.12, loc=(1.5 + 0.08 * k, -0.55 + 0.05 * (k - 1), FL + 0.27),
                 color=["white_paint", "fabric_cream", "fabric_blue"][k], segs=6, rings=4, scale=(1.3, 1, 0.5))
    g.lathe([(0.12, 0.0), (0.15, 0.26)], loc=(-1.75, -0.6, FL), colors="tin", segs=8, close_top=False)
    yl = yp - 0.09
    zl = zbt - 0.45
    rope(g, [(-hx + 0.27, yl, zl), (hx - 0.27, yl, zl)], 0.008)
    for x, c, w_ in ((-1.3, "white_paint", 0.6), (-0.3, "fabric_cream", 0.5), (0.6, "fabric_blue", 0.45)):
        g.box((w_, 0.02, 0.55), loc=(x, yl, zl - 0.28), color=c)
        g.box((0.03, 0.03, 0.06), loc=(x - w_ / 2 + 0.06, yl, zl - 0.01), color="wood_new")
        g.box((0.03, 0.03, 0.06), loc=(x + w_ / 2 - 0.06, yl, zl - 0.01), color="wood_new")
    A.add("washhouse_body", g, parent=root)
    r = A.geo()
    ov_n, ov_s, ov_x = 0.15, 0.35, 0.3
    slab_ccw(r, [(-hx - ov_x, y1 + ov_s, zr_(y1 + ov_s) + 0.06), (hx + ov_x, y1 + ov_s, zr_(y1 + ov_s) + 0.06),
                 (hx + ov_x, y0 - ov_n, zr_(y0 - ov_n) + 0.06), (-hx - ov_x, y0 - ov_n, zr_(y0 - ov_n) + 0.06)],
             0.12, by_normal("tile", "tile_dark", "wood_dark"))
    nr = 6
    for k in range(1, nr):
        yy = y1 + ov_s - (y1 + ov_s - y0 + ov_n) * k / nr
        r.box((2 * (hx + ov_x) - 0.04, 0.05, 0.03), loc=(0, yy, zr_(yy) + 0.075), color="tile_dark",
              rot=(-math.degrees(math.atan(slope)), 0, 0))
    r.box((2 * (hx + ov_x), 0.24, 0.1), loc=(0, y0 - ov_n + 0.12, zr_(y0) + 0.02), color="tile_dark", base=True)
    A.add("washhouse_roof", r, parent=root)
    return root


# Maisons du village ----------------------------------------------------------------------------------------

def simple_house(A, name, spec):
    """Maison à un niveau (ou un niveau et demi) sans intérieur: murs percés, fenêtres vitrées (volets ouverts ou
    clos, encadrement facultatif), fenêtres de pignon posées sur le pignon, porte, toit à deux pans, cheminée;
    spec règle couleurs, ouvertures et détails (extra(g, f) pour le corps, roof_extra(r) pour le toit)."""
    hx, hy, t, ze, zr = spec["hx"], spec["hy"], spec["t"], spec["ze"], spec["zr"]
    out, inn = spec["walls"]
    door_u, door_w = spec["door"]
    wall_wins = [w for w in spec["windows"] if w[3] < ze - 0.3]
    gable_wins = [w for w in spec["windows"] if w[3] >= ze - 0.3]
    ops = {s: [] for s in SIDES}
    ops["front"].append((door_u, door_w, 0.0, 2.1))
    for side, u, w, zb, zt in wall_wins:
        ops[side].append((u, w, zb, zt))
    g = A.geo()
    house_walls(g, hx, hy, ze - 0.05, t, ops, out, inn, plinth=spec.get("plinth", 0.4),
                plinth_col=spec.get("plinth_col", "stone_dark"))
    g.box((2 * hx - 2 * t + 0.02, 2 * hy - 2 * t + 0.02, FL), color="wood_dark", base=True)
    if spec.get("quoins"):
        for sy in (-1, 1):
            quoins_side(g, hx, hy, ze - 0.12, sy, spec["quoins"], seed=spec.get("seed", 3), step=spec.get("quoin_step", 0.36))
    shutter = spec.get("shutter")
    closed = spec.get("closed", False)
    sur = spec.get("surround")
    frame = spec.get("frame", "paint_cream")
    for side, u, w, zb, zt in wall_wins:
        f = B.Face(side, hx, hy)
        h = zt - zb
        if spec.get("open_window") == (side, u):
            continue
        glazed(g, f, u, w, zb, zt, t, frame=frame, shutter=None if (closed or sur or w < 0.62) else shutter,
               box_flowers=(side, u) in spec.get("flowers", ()))
        if sur:
            for s in (1, -1):
                f.box(g, (0.14, 0.04, h + 0.12), u + s * (w / 2 + 0.07), 0.02, (zb + zt) / 2 + 0.06, sur)
            f.box(g, (w + 0.42, 0.05, 0.16), u, 0.025, zt + 0.08, sur)
        if shutter and closed and w >= 0.62:
            for s in (1, -1):
                f.box(g, (w / 2 + 0.01, 0.035, h + 0.02), u + s * (w / 4), 0.06 if sur else 0.03, zb + h / 2, shutter)
                for zz in (0.22, 0.78):
                    f.box(g, (w / 2 - 0.06, 0.045, 0.045), u + s * (w / 4), 0.07 if sur else 0.04, zb + h * zz,
                          "wood_dark")
        elif shutter and sur and w >= 0.62:
            for s in (1, -1):
                uu = u + s * (w * 0.75 + 0.18)
                f.box(g, (w / 2, 0.035, h), uu, 0.02, zb + h / 2, shutter)
                f.box(g, (w / 2 + 0.01, 0.045, 0.045), uu, 0.025, zb + h * 0.5, "wood_dark")
    for side, u, w, zb, zt in gable_wins:
        win(g, B.Face(side, hx, hy), u, zb, w, zt - zb, frame=frame, shutter=None, surround=sur)
    f = B.Face("front", hx, hy)
    door_frame(g, f, door_u, door_w, 2.1, t, frame=spec.get("door_frame", "stone_light"))
    f.box(g, (door_w - 0.14, 0.05, 2.0), door_u, -t + 0.06, 1.0, spec.get("door_color", "paint_green"))
    for z in (0.5, 1.45):
        f.box(g, (door_w - 0.34, 0.06, 0.55), door_u, -t + 0.04, z, "wood_dark")
    f.box(g, (0.05, 0.05, 0.05), door_u + door_w / 2 - 0.17, -t + 0.03, 1.0, "brass")
    if sur:
        f.box(g, (door_w + 0.42, 0.05, 0.18), door_u, 0.025, 2.21, sur)
    axis = spec.get("axis", "x")
    gable_prisms(g, hx, hy, ze - 0.05, zr, t, spec.get("gable", out), axis=axis)
    if spec.get("extra"):
        spec["extra"](g, f)
    root = A.group(name, dict({"footprint": spec["foot"], "door_cell": spec["door_cell"]}, **spec.get("extras", {})))
    A.add(name + "_body", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, spec["roof"][0], spec["roof"][1], axis=axis)
    for (x, y, z0, z1) in spec.get("chimneys", ()):
        B.round_chimney(r, x, y, z0, z1, spec.get("chimney_col", "stone"))
    if spec.get("roof_extra"):
        spec["roof_extra"](r)
    A.add(name + "_roof", r, parent=root)
    return root


def village_house_a(A, shuttered=False):
    """Maison de pierre à un niveau (sacristain, hameau B): lauzes, volets rouges, porte en case 2, banc et pots
    de fleurs; variante aux volets clos (`village_house_a_shuttered`, maison B du hameau)."""
    hx = hy = 2.75
    name = "village_house_a_shuttered" if shuttered else "village_house_a"

    def extra(g, f):
        if shuttered:
            f.box(g, (0.5, 0.03, 0.34), 1.45, 0.02, 1.0, "wood_old")
            return
        flower_pot(g, f, -1.2, 0.28, 0.8, 3)
        flower_pot(g, f, 0.2, 0.26, 0.7, 4, ("flower_yellow", "flower_white", "flower_violet"))
        bench_stone(g, f, 1.6, 1.0, 0.2)
        wall_lamp(g, f, 0.25, 2.2)
        # fagots contre le pignon ouest
        fl = B.Face("left", hx, hy)
        for k, (uu, zz) in enumerate(((0.6, 0.13), (0.86, 0.13), (1.12, 0.13), (0.73, 0.36), (0.99, 0.36))):
            p = fl.p(uu, 0.15, zz)
            g.cyl(0.13, 0.9, loc=p, color=by_normal("log_end", "bark", thr=0.5), segs=6, rot=(90, 0, 0))

    spec = dict(hx=hx, hy=hy, t=0.35, ze=3.0, zr=5.5, walls=("stone", "plaster_shade"), door=(-0.5, 0.9),
                door_cell=2, foot=[6, 6], quoins="stone_light", seed=5,
                windows=[("front", -1.9, 0.8, 0.95, 2.0), ("front", 1.45, 0.8, 0.95, 2.0),
                         ("back", 0.8, 0.8, 0.95, 2.0), ("left", 0.0, 0.55, 3.35, 4.05),
                         ("right", 0.0, 0.55, 3.35, 4.05), ("right", -1.0, 0.7, 1.0, 1.9)],
                shutter="paint_red", closed=shuttered, roof=("lauze", "lauze_dark"),
                chimneys=[(1.6, 0.7, 4.3, 6.0)], extra=extra, door_color="wood_dark" if shuttered else "paint_red",
                flowers=() if shuttered else (("front", 1.45),),
                extras={"note": "porte en case 2; volets clos, porte fermée: maison inhabitée"} if shuttered else
                {"note": "porte en case 2"})
    return simple_house(A, name, spec)


def village_house_b(A):
    """Maison de hameau enduite d'ocre, tuiles, volets bleus, glycine qui monte du pied de la porte et court sur
    la façade (hameau A et C)."""
    hx = hy = 2.75

    def extra(g, f):
        # glycine: tronc tors du pied droit de la porte, bras de fer à 2,55 m, grappes violettes
        x0 = 0.1
        # (sous la rive, qui descend à 2,55 m à 0,3 m du mur: le bras et le feuillage restent sous 2,45 m)
        pts = [(x0, 0.12, 0.0), (x0 + 0.06, 0.16, 0.7), (x0 - 0.02, 0.14, 1.4), (x0 + 0.05, 0.15, 1.9),
               (x0, 0.17, 2.22)]
        rope(g, [f.p(*p) for p in pts], 0.05, "bark")
        f.box(g, (4.6, 0.03, 0.03), -0.2, 0.26, 2.28, "iron")
        for uu in (-2.2, 0.0, 1.8):
            f.box(g, (0.03, 0.26, 0.03), uu, 0.13, 2.28, "iron")
        rope(g, [f.p(x0, 0.17, 2.22), f.p(x0 - 0.8, 0.25, 2.3), f.p(-1.9, 0.26, 2.3), f.p(-2.4, 0.25, 2.28)], 0.035,
             "bark")
        rope(g, [f.p(x0, 0.17, 2.22), f.p(x0 + 0.7, 0.25, 2.3), f.p(1.9, 0.26, 2.29)], 0.03, "bark")
        rnd = random.Random(12)
        for k in range(13):
            uu = -2.3 + k * 0.35 + rnd.uniform(-0.08, 0.08)
            p = f.p(uu, 0.27 + rnd.uniform(-0.03, 0.04), 2.33 + rnd.uniform(-0.03, 0.03))
            g.sphere(0.15, loc=p, color="vine_leaf" if k % 2 else "vine_leaf_dark", segs=6, rings=4, jitter=0.12, seed=k,
                     scale=(1.3, 0.8, 0.55))
            if k % 2 == 0 and abs(uu - x0) > 0.3:
                q = f.p(uu + 0.05, 0.3, 2.12)
                g.cyl(0.07, 0.34, loc=q, r2=0.015, color="flower_violet", segs=5, rot=(180, 0, 0))
        flower_pot(g, f, -1.25, 0.3, 0.8, 7, ("flower_white", "flower_pink", "flower_red"))
        # sabots et grattoir de fer à côté de la porte
        f.box(g, (0.3, 0.12, 0.04), 0.45, 0.2, 0.02, "iron")

    spec = dict(hx=hx, hy=hy, t=0.35, ze=3.0, zr=5.5, walls=("plaster_ochre", "plaster_cream"), door=(-0.5, 0.9),
                door_cell=2, foot=[6, 6], quoins="stone_light", seed=9, plinth_col="stone",
                windows=[("front", -1.9, 0.8, 0.95, 1.95), ("front", 1.45, 0.8, 0.95, 1.95),
                         ("back", -0.9, 0.8, 0.95, 2.0), ("back", 1.3, 0.6, 1.2, 1.9),
                         ("left", 0.0, 0.55, 3.3, 4.0), ("right", 0.4, 0.7, 1.0, 1.9)],
                shutter="paint_blue", roof=("tile", "tile_dark"), chimneys=[(-1.5, 0.8, 4.2, 6.0)], extra=extra,
                door_color="paint_blue", flowers=(("front", -1.9),),
                extras={"note": "porte en case 2; glycine sur la façade"})
    return simple_house(A, "village_house_b", spec)


def lineman_house(A, shuttered=False):
    """Maison de cheminots de la compagnie: un niveau et demi (égout 3,2 m, lucarne), enduit crème, chaînes et
    arcs de brique, tuiles, plaque émaillée de la compagnie; fenêtre sud ouverte sur l'établi d'Ambroise
    (rail_cottage_west_window, x -1,5). Variante aux volets clos (`lineman_house_shuttered`, maison vide)."""
    hx = hy = 2.75
    name = "lineman_house_shuttered" if shuttered else "lineman_house"
    bench_u = -1.5

    def extra(g, f):
        # plaque de la compagnie à côté de la porte
        f.box(g, (0.34, 0.04, 0.22), 0.5, 0.045, 2.55, "paint_blue")
        f.box(g, (0.26, 0.045, 0.14), 0.5, 0.047, 2.55, "white_paint")
        f.box(g, (0.05, 0.05, 0.09), 0.5, 0.05, 2.55, "paint_blue")
        f.box(g, (2 * hx + 0.04, 0.05, 0.16), 0.0, 0.025, 2.9, "brick")
        if shuttered:
            return
        flower_pot(g, f, 1.05, 0.28, 0.75, 11, ("flower_red", "flower_white", "flower_yellow"))
        # fenêtre ouverte sur l'établi: battants rabattus dedans, l'établi à l'appui, l'étau, la lampe
        zb, zt, w = 0.95, 2.0, 0.8
        t = 0.35
        for s in (1, -1):
            f.box(g, (0.05, 0.4, zt - zb - 0.06), bench_u + s * (w / 2 - 0.04), -t - 0.2, (zb + zt) / 2, "paint_cream",
                  rot=(0, 0, s * 8))
            f.box(g, (0.03, 0.34, zt - zb - 0.2), bench_u + s * (w / 2 - 0.05), -t - 0.2, (zb + zt) / 2, "glass",
                  rot=(0, 0, s * 8))
        f.box(g, (w + 0.16, 0.12, 0.06), bench_u, 0.04, zb - 0.03, "stone_light")
        f.box(g, (1.5, 0.6, 0.06), bench_u, -t - 0.32, zb - 0.06, "wood", bevel=0.01)
        for s in (1, -1):
            f.box(g, (0.07, 0.07, zb - 0.06), bench_u + s * 0.68, -t - 0.55, (zb - 0.06) / 2, "wood_dark")
        f.box(g, (0.16, 0.12, 0.14), bench_u - 0.32, -t - 0.15, zb + 0.04, "steel_forged")
        f.box(g, (0.05, 0.16, 0.04), bench_u - 0.32, -t - 0.06, zb + 0.1, "iron")
        f.box(g, (0.32, 0.06, 0.04), bench_u + 0.15, -t - 0.2, zb - 0.01, "iron_light", rot=(0, 0, 25))
        f.box(g, (0.18, 0.12, 0.05), bench_u + 0.2, -t - 0.42, zb - 0.005, "wood_new")
        f.box(g, (2 * hx - 2 * t, 0.04, ze_ - 0.2), 0.0, -2 * hy + t + 0.02, (ze_ - 0.2) / 2, "shadow")
        p = f.p(bench_u + 0.45, -t - 0.4, zb - 0.03)
        g.cyl(0.07, 0.18, loc=p, r2=0.05, color="lamp_shade", segs=6, base=True)

    ze_ = 3.2
    spec = dict(hx=hx, hy=hy, t=0.35, ze=ze_, zr=6.0, walls=("plaster_cream", "plaster_shade"), door=(0.5, 0.9),
                door_cell=3, foot=[6, 6], quoins="brick", seed=13, plinth_col="stone",
                windows=[("front", bench_u, 0.8, 0.95, 2.0), ("front", 1.85, 0.6, 1.1, 1.9),
                         ("back", -1.0, 0.8, 0.95, 2.0), ("back", 1.2, 0.8, 0.95, 2.0),
                         ("left", 0.0, 0.6, 3.5, 4.3), ("right", 0.0, 0.6, 3.5, 4.3), ("left", -1.0, 0.7, 1.0, 1.9)],
                shutter="paint_red", closed=shuttered, roof=("tile", "tile_dark"), chimneys=[(1.5, 0.8, 4.5, 6.6)],
                chimney_col="brick", extra=extra, door_color="paint_red", surround="brick",
                open_window=None if shuttered else ("front", bench_u),
                roof_extra=lambda r: dormer(r, -0.2, hy, ze_, 6.0, wall="plaster_cream", roof_col="tile_dark",
                                            frame="paint_cream", shutter=None if shuttered else "paint_red"),
                extras={"note": "porte en case 3 (x 0,5); la fenêtre à gauche de la porte (x -1,5) est ouverte sur "
                                "l'établi d'Ambroise" if not shuttered else "porte en case 3; volets clos (maison vide)"})
    return simple_house(A, name, spec)


def forester_house(A):
    """Maison forestière: enduit crème, chaînes de pierre, arcs de brique sur les baies, toit rouge (tuiles),
    plaque MAISON FORESTIÈRE, bois de cerf au-dessus de la porte, stère de bûches contre le pignon est."""
    hx = hy = 2.75

    def extra(g, f):
        f.box(g, (1.92, 0.04, 0.22), 0.5, 0.02, 2.44, "paint_green")
        word(g, f, 0.5, 0.045, 2.43, "MAISON FORESTIÈRE", 0.021, "white_paint")
        # bois de cerf sur un écusson, à gauche de la porte (case 3, x 0,5), à hauteur d'homme
        ua = -0.37
        f.box(g, (0.2, 0.05, 0.16), ua, 0.025, 1.85, "wood_dark")
        for s in (1, -1):
            pts = [(ua + s * 0.04, 0.06, 1.88), (ua + s * 0.17, 0.1, 2.0), (ua + s * 0.24, 0.1, 2.16)]
            rope(g, [f.p(*q) for q in pts], 0.018, "paper_dark")
            rope(g, [f.p(ua + s * 0.15, 0.1, 1.98), f.p(ua + s * 0.11, 0.11, 2.1)], 0.012, "paper_dark")
            rope(g, [f.p(ua + s * 0.21, 0.1, 2.09), f.p(ua + s * 0.29, 0.1, 2.16)], 0.012, "paper_dark")
        # stère de bûches contre le pignon est, sous un petit appentis de planches
        fr = B.Face("right", hx, hy)
        for row in range(3):
            for k in range(6 - (row == 2)):
                uu = -1.45 + k * 0.3 + (0.15 if row % 2 else 0) + (0.15 if row == 2 else 0)
                p = fr.p(uu, 0.3, 0.14 + row * 0.25)
                g.cyl(0.13, 0.55, loc=p, color=by_normal("log_end", "bark", thr=0.5), segs=5, rot=(0, 90, 0))
        for uu in (-1.75, 0.35):
            fr.box(g, (0.08, 0.08, 1.35), uu, 0.55, 0.675, "wood_dark")
        slab_ccw(g, [fr.p(-1.85, 0.0, 1.55), fr.p(0.45, 0.0, 1.55), fr.p(0.45, 0.7, 1.35), fr.p(-1.85, 0.7, 1.35)],
                 0.04, by_normal("wood_old", "wood_dark"))
        flower_pot(g, f, -0.45, 0.28, 0.75, 13, ("flower_red", "flower_pink", "flower_white"))

    spec = dict(hx=hx, hy=hy, t=0.35, ze=3.0, zr=6.0, walls=("plaster_cream", "plaster_shade"), door=(0.5, 0.95),
                door_cell=3, foot=[6, 6], quoins="stone_light", seed=17, quoin_step=0.45, plinth_col="stone",
                windows=[("front", -1.6, 0.8, 0.95, 2.0), ("front", 2.0, 0.6, 1.1, 1.9),
                         ("back", -0.8, 0.8, 0.95, 2.0), ("back", 1.3, 0.8, 0.95, 2.0),
                         ("left", 0.0, 0.6, 3.3, 4.2), ("left", -1.0, 0.7, 1.0, 1.9), ("right", 0.0, 0.6, 3.3, 4.2)],
                shutter="paint_green", roof=("tile", "tile_dark"), chimneys=[(-1.4, 0.9, 4.4, 6.6)],
                chimney_col="brick", extra=extra, door_color="paint_green",
                extras={"note": "porte en case 3 (x 0,5); plaque MAISON FORESTIÈRE, bois de cerf"})
    return simple_house(A, "forester_house", spec)


def presbytery_house(A):
    """Presbytère: deux niveaux (étage dans le comble, deux lucarnes), enduit crème et pierre de taille, lauzes;
    porte au milieu de la façade (case 3) sous une croix, cordon de sonnette, rosier palissé; pignon sud (gauche)
    tourné vers le jardin du curé."""
    hx = hy = 3.15
    ze, zr = 4.0, 7.5
    eav = None

    def extra(g, f):
        # croix de fer au-dessus de la porte, cordon de sonnette, rosier palissé à droite
        f.box(g, (0.04, 0.04, 0.42), 0.0, 0.03, 2.62, "iron")
        f.box(g, (0.24, 0.04, 0.04), 0.0, 0.03, 2.7, "iron")
        rope(g, [f.p(0.62, 0.07, 1.95), f.p(0.62, 0.07, 1.3)], 0.008, "iron")
        g.sphere(0.03, loc=f.p(0.62, 0.075, 1.27), color="brass", segs=6, rings=4)
        flower_pot(g, f, -1.0, 0.3, 0.8, 23, ("flower_pink", "flower_white", "flower_red"))
        downpipes(g, eav, hy, (hx - 0.08,))
        f.box(g, (2 * hx + 0.04, 0.1, 0.14), 0.0, 0.05, 2.85, "stone_light")

    eav = eaves_of(hx, hy, ze, zr, "lauze", "lauze_dark")

    def roof_extra(r):
        gutters(r, eav)
        pipe_necks(r, eav, hy, (hx - 0.08,))
        for u in (-1.5, 1.5):
            dormer(r, u, hy, ze, zr, w=0.75, wh=0.85, wall="plaster_cream", roof_col="lauze_dark", frame="paint_cream",
                   shutter="paint_green")

    spec = dict(hx=hx, hy=hy, t=0.4, ze=ze, zr=zr, walls=("plaster_cream", "plaster_shade"), door=(0.0, 1.0),
                door_cell=3, foot=[7, 7], quoins="stone_light", seed=19, quoin_step=0.5, plinth_col="stone",
                windows=[("front", -1.9, 0.9, 0.9, 2.15), ("front", 1.9, 0.9, 0.9, 2.15),
                         ("back", -1.5, 0.9, 0.9, 2.15), ("back", 1.5, 0.9, 0.9, 2.15),
                         ("left", -1.2, 0.9, 0.9, 2.15), ("left", 1.2, 0.9, 0.9, 2.15), ("left", 0.0, 0.8, 4.3, 5.4),
                         ("right", 0.0, 0.9, 0.9, 2.15), ("right", 0.0, 0.7, 4.3, 5.3)],
                shutter="paint_green", roof=("lauze", "lauze_dark"),
                chimneys=[(-2.4, 0.6, 5.5, 8.2), (2.4, 0.6, 5.5, 8.2)], extra=extra, door_color="paint_green",
                surround="stone_light", flowers=(("left", 1.2),), roof_extra=roof_extra,
                extras={"note": "porte au milieu (case 3); le pignon gauche (-X) regarde le jardin du curé, au sud"})
    return simple_house(A, "presbytery_house", spec)


# Café de la Côte -------------------------------------------------------------------------------------------
# Carte: x 87 à 93, y 15 à 20 (centre 90,5 ; 18), rotation 0. x = X - 90,5, y = 18 - Y. Salle x 88 à 92, y 16 à 19:
# x -2,5 à 2,5, y -2 à 2. Comptoir (89 à 91 ; 16): x -1,5 à 1,5, y 1 à 2. Poêle (88 ; 18): x -2,5 à -1,5, y -1 à 0.
# Tables (89 ; 18) et (91 ; 18): x -1 et 1, y -0,5. Ardoise (cafe_sign, 91,5): x 1. Terrasse au sud-ouest.

CAFE = dict(hx=2.9, hy=2.4, t=0.4, h1=3.1, ze=6.0, zr=8.5)


def cafe_house(A):
    C = CAFE
    hx, hy, t, h1, ze, zr = C["hx"], C["hy"], C["t"], C["h1"], C["ze"], C["zr"]
    root = interior_root(
        A, "cafe_house", [7, 6], 3, [{"id": "cafe_room", "x": [-2.5, 2.5], "z": [-2.0, 2.0]}],
        ["cafe_house_roof", "cafe_house_upper"],
        "porte en case 3 (x 0); salle du rez-de-chaussée (comptoir au nord, poêle à l'ouest, deux tables), salle du "
        "bal à l'étage (fenêtres hautes, balconnet); store vert sur la terrasse (ouest de la façade), ardoise à "
        "droite de la porte")
    eav = eaves_of(hx, hy, ze, zr, "tile", "tile_dark")
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    I.floor_tiles(g, -2.5, 2.5, -2.0, 2.0, FL)
    A.add("cafe_house_floor", g, parent=root)
    ops = {"front": [(0.0, 1.0, 0.0, 2.25), (-1.75, 1.1, 0.75, 2.3), (1.75, 1.1, 0.75, 2.3)],
           "back": [], "left": [], "right": [(-0.5, 0.9, 0.9, 2.2)]}

    def deco(side, g_, f):
        if side == "front":
            door_frame(g_, f, 0.0, 1.0, 2.25, t, frame="paint_green")
            for u in (-1.75, 1.75):
                glazed(g_, f, u, 1.1, 0.75, 2.3, t, frame="paint_green", sill="paint_green", mullion=True,
                       inner_sill="wood_new")
                f.box(g_, (1.2, 0.08, 0.7), u, 0.04, 0.4, "paint_green")
                f.box(g_, (1.0, 0.09, 0.5), u, 0.045, 0.4, "wood_dark")
            # imposte vitrée au-dessus de la porte, applique
            wall_lamp(g_, f, 0.75, 2.45)
            # ardoise du café (cafe_sign, x 1): heures, manille du mercredi, quilles du dimanche
            f.box(g_, (0.42, 0.05, 0.66), 0.88, 0.025, 1.45, "wood_new")
            f.box(g_, (0.34, 0.055, 0.56), 0.88, 0.03, 1.45, "black")
            for k, L in enumerate((0.24, 0.17, 0.21, 0.14)):
                f.box(g_, (L, 0.06, 0.025), 0.88 - (0.24 - L) / 2, 0.035, 1.64 - k * 0.11, "white_paint")
            # store de toile verte et crème sur la terrasse (ouest), sur trois bras de fer
            x0, x1 = -hx + 0.08, -0.62
            n = 7
            for k in range(n):
                xa = x0 + (x1 - x0) * k / n
                xb = x0 + (x1 - x0) * (k + 1) / n
                c = "fabric_green" if k % 2 == 0 else "fabric_cream"
                B.slab(g_, [(xa, -hy - 1.35, 2.5), (xb, -hy - 1.35, 2.5), (xb, -hy - 0.02, 2.98), (xa, -hy - 0.02, 2.98)],
                       0.03, c)
                f.box(g_, ((x1 - x0) / n, 0.03, 0.2 if k % 2 == 0 else 0.14), (xa + xb) / 2, 1.345,
                      2.5 - (0.1 if k % 2 == 0 else 0.07), c)
            for xa in (x0 + 0.12, (x0 + x1) / 2, x1 - 0.12):
                B.rod(g_, (xa, -hy - 0.02, 2.4), (xa, -hy - 1.28, 2.48), 0.018, "iron")
            g_.box((x1 - x0, 0.1, 0.12), loc=((x0 + x1) / 2, -hy - 0.04, 2.98), color="iron")
            flower_pot(g_, f, 2.55, 0.28, 0.85, 2)
        elif side == "back":
            # étagère à bouteilles et miroir derrière le comptoir (contre le mur nord, dedans)
            fi = B.Face("back", hx, hy)
            fi.box(g_, (3.0, 0.03, 1.0), 0.0, -t - 0.015, 1.95, "glass")
            fi.box(g_, (3.1, 0.05, 1.1), 0.0, -t - 0.01, 1.95, "wood_dark")
            rnd = random.Random(31)
            for zz in (1.0, 1.4):
                fi.box(g_, (3.0, 0.25, 0.04), 0.0, -t - 0.125, zz, "wood")
                x = -1.35
                while x < 1.4:
                    c = rnd.choice(["glass", "vine_leaf_dark", "fabric_red", "paint_yellow", "ceramic"])
                    p = fi.p(x, -t - 0.12, zz + 0.02)
                    g_.lathe([(0.04, 0.0), (0.04, 0.2), (0.015, 0.3)], loc=p, colors=c, segs=5)
                    x += rnd.uniform(0.2, 0.3)
            # lambris vert contre le mur nord (dedans), horloge
            fi.box(g_, (2 * hx - 2 * t, 0.03, 0.9), 0.0, -t - 0.015, FL + 0.45, "paint_green")
            p = fi.p(2.0, -t - 0.03, 2.4)
            g_.cyl(0.18, 0.04, loc=p, color="white_paint", segs=10, rot=(90, 0, 0))
            g_.cyl(0.2, 0.03, loc=fi.p(2.0, -t - 0.01, 2.4), color="wood_dark", segs=10, rot=(90, 0, 0))
            fi.box(g_, (0.02, 0.05, 0.13), 2.0, -t - 0.06, 2.45, "black")
            fi.box(g_, (0.1, 0.05, 0.02), 2.04, -t - 0.06, 2.4, "black")
        elif side == "left":
            fi = B.Face("left", hx, hy)
            fi.box(g_, (2 * hy - 2 * t, 0.03, 0.9), 0.0, -t - 0.015, FL + 0.45, "paint_green")
            # gravure encadrée
            fi.box(g_, (0.5, 0.03, 0.4), -0.9, -t - 0.02, 1.8, "wood_dark")
            fi.box(g_, (0.4, 0.035, 0.3), -0.9, -t - 0.02, 1.8, "sepia")
        elif side == "right":
            glazed(g_, f, -0.5, 0.9, 0.9, 2.2, t, frame="paint_green", shutter="paint_green")

    side_walls(A, root, "cafe_house", hx, hy, h1, t, ops, "plaster_rose", "plaster_cream", deco, plinth=0.5,
               plinth_col="stone")
    I.door_leaf(A, "cafe_house_door", root, B.Face("front", hx, hy), 0.0, 1.0, 2.25, t, color="paint_green", glass=True)
    # étage: salle du bal
    g = A.geo()
    g.box((2 * hx - 2 * t, 2 * hy - 2 * t, 0.14), loc=(0, 0, h1 - 0.14), color="wood_dark", base=True)
    g.box((2 * hx, 2 * hy, ze - h1 - 0.05), loc=(0, 0, h1), color="plaster_rose", base=True)
    gable_prisms(g, hx, hy, ze - 0.05, zr, 0.3, "plaster_rose", axis="x")
    for side in SIDES:
        f = B.Face(side, hx, hy)
        L = wall_len(side, hx, hy, 0.0)
        f.box(g, (L + (0.06 if side in ("front", "back") else 0), 0.1, 0.14), 0.0, 0.05, h1 + 0.03, "stone_light")
    quoins_side(g, hx, hy, ze - 0.1, -1, "stone_light", seed=51, z0=h1 - 0.05)
    quoins_side(g, hx, hy, ze - 0.1, 1, "stone_light", seed=52, z0=h1 - 0.05)
    fr = B.Face("front", hx, hy)
    fr.box(g, (4.1, 0.05, 0.42), 0.0, 0.025, 3.5, "paint_cream")
    fr.box(g, (4.2, 0.06, 0.05), 0.0, 0.03, 3.73, "paint_green")
    fr.box(g, (4.2, 0.06, 0.05), 0.0, 0.03, 3.27, "paint_green")
    word(g, fr, 0.0, 0.055, 3.48, "CAFÉ DE LA CÔTE", 0.042, "paint_green")
    for u in (-1.88, 0.0, 1.88):
        win(g, fr, u, 3.95, 0.78, 1.55, frame="white_paint", shutter="paint_green", flowers=(u != 0.0))
    # balconnet de fer à la fenêtre du milieu
    fr.box(g, (1.05, 0.32, 0.05), 0.0, 0.16, 3.92, "stone_light")
    for k in range(8):
        fr.box(g, (0.02, 0.02, 0.62), -0.45 + k * 0.128, 0.3, 4.25, "iron")
    fr.box(g, (1.0, 0.04, 0.04), 0.0, 0.3, 4.56, "iron")
    fb = B.Face("back", hx, hy)
    for u in (-1.2, 1.2):
        win(g, fb, u, 3.95, 0.78, 1.4, frame="white_paint", shutter="paint_green")
    win(g, B.Face("left", hx, hy), 0.0, 4.0, 0.7, 1.3, frame="white_paint", shutter="paint_green")
    win(g, B.Face("right", hx, hy), 0.0, 4.0, 0.7, 1.3, frame="white_paint", shutter="paint_green")
    win(g, B.Face("right", hx, hy), 0.0, 6.4, 0.5, 0.6, frame="white_paint")
    downpipes(g, eav, hy, (hx - 0.08,))
    A.add("cafe_house_upper", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "tile", "tile_dark", axis="x")
    gutters(r, eav)
    pipe_necks(r, eav, hy, (hx - 0.08,))
    B.round_chimney(r, -2.2, 0.9, 7.2, 9.3)
    B.round_chimney(r, 2.0, -0.9, 7.2, 9.0)
    A.add("cafe_house_roof", r, parent=root)
    cafe_interior(A, root)
    return root


def cafe_interior(A, root):
    g = A.geo()
    fp = Footprints()
    z = FL
    # comptoir de zinc, façade de bois à panneaux, repose-pied de laiton
    I.counter(g, -1.45, 1.45, 1.0, 1.5, h=z + 1.0, top="tin", body="wood_dark")
    for k in range(5):
        g.box((0.44, 0.02, 0.5), loc=(-1.16 + k * 0.58, 0.99, z + 0.45), color="wood", base=True)
    B.rod(g, (-1.4, 0.975, z + 0.15), (1.4, 0.975, z + 0.15), 0.02, "brass")
    fp.rect(-1.45, 1.45, 1.0, 1.55)
    # sur le comptoir: percolateur, verres, carafe
    g.cyl(0.13, 0.4, loc=(-1.0, 1.25, z + 1.0), color="copper", segs=8, base=True)
    g.sphere(0.13, loc=(-1.0, 1.25, z + 1.4), color="brass", segs=8, rings=4, scale=(1, 1, 0.6))
    for k in range(4):
        g.cyl(0.03, 0.09, loc=(0.2 + k * 0.12, 1.2, z + 1.0), color="glass", segs=6, base=True)
    g.lathe([(0.05, 0.0), (0.06, 0.12), (0.02, 0.2), (0.025, 0.24)], loc=(0.85, 1.25, z + 1.0), colors="glass", segs=6)
    # poêle contre le mur ouest, tuyau vers le mur
    fp.add(I.iron_stove(g, (-2.1, -0.5, z), 90, flue_to=2.4))
    B.rod(g, (-2.02, -0.42, 2.4), (-2.48, -0.42, 2.55), 0.07, "black")
    # tables rondes et chaises: la manille à l'ouest (cartes), la carafe à l'est
    for x, cards in ((-1.0, True), (1.0, False)):
        fp.add(round_table(g, (x, -0.5, z), r=0.36, cloth=None if cards else "fabric_red"))
        I.plain_chair(g, (x - 0.55, -0.5, z), -90)
        I.plain_chair(g, (x + 0.55, -0.5, z), 90)
        if cards:
            for k in range(4):
                g.box((0.06, 0.09, 0.004), loc=(x - 0.12 + k * 0.08, -0.5 + 0.06 * (k % 2), z + 0.722),
                      color="white_paint", base=True, rot=(0, 0, 20 * k))
            g.box((0.06, 0.09, 0.03), loc=(x + 0.18, -0.4, z + 0.722), color="fabric_red", base=True)
        else:
            g.lathe([(0.05, 0.0), (0.06, 0.12), (0.02, 0.2), (0.025, 0.24)], loc=(x, -0.5, z + 0.73), colors="glass",
                    segs=6)
            for s in (1, -1):
                g.cyl(0.03, 0.09, loc=(x + s * 0.18, -0.55, z + 0.73), color="glass", segs=6, base=True)
    # portemanteau près de la porte (mur sud, dedans: dans le contenu, debout sur le sol)
    g.cyl(0.025, 1.75, loc=(-0.85, -1.75, z), color="wood_dark", segs=6, base=True)
    g.cyl(0.18, 0.03, loc=(-0.85, -1.75, z), color="wood_dark", segs=6, base=True)
    for a in (0, 120, 240):
        ra = math.radians(a)
        B.rod(g, (-0.85, -1.75, z + 1.65), (-0.85 + 0.15 * math.cos(ra), -1.75 + 0.15 * math.sin(ra), z + 1.75), 0.015,
              "wood_dark")
    g.sphere(0.12, loc=(-0.72, -1.75, z + 1.68), color="fabric_blue", segs=6, rings=4, scale=(0.6, 1, 1.3))
    A.add("cafe_house_interior", g, parent=root)
    root["interior_spots"] = {"cafe_counter_inside": _gl(0.0, 1.75), "cafe_counter": _gl(0.0, 0.5),
                              "cafe_table_west": _gl(-1.0, -0.5), "cafe_table_east": _gl(1.0, -0.5),
                              "cafe_table_west_seats": [_gl(-1.55, -0.5), _gl(-0.45, -0.5)],
                              "cafe_table_east_seats": [_gl(0.45, -0.5), _gl(1.55, -0.5)], "cafe_stove": _gl(-2.1, -0.5)}
    root["interior_blocked"] = blocked_cells(fp.boxes, -2.5, 2.5, -2.0, 2.0)
    root["seat_height"] = 0.47


# Forge ---------------------------------------------------------------------------------------------------------
# Carte: x 98 à 103, y 15 à 20 (centre 101 ; 18), rotation 0. x = X - 101, y = 18 - Y. Atelier x 99 à 102, y 16
# à 19: x -2 à 2, y -2 à 2. Grande porte (100 et 101 ; 20): x -1 à 1 (vantail fixe à gauche, vantail ouvrant à
# droite, case 3). Foyer (100 et 101 ; 16): x -1 à 1, y 1 à 2. Râtelier (99 ; 19): x -2 à -1, y -2 à -1.
# Écriteau (forge_sign, 102,5): x 1,5.

FORGE = dict(hx=2.45, hy=2.45, t=0.45, ze=3.0, zr=5.5)


def forge_shop(A):
    F = FORGE
    hx, hy, t, ze, zr = F["hx"], F["hy"], F["t"], F["ze"], F["zr"]
    root = interior_root(
        A, "forge_shop", [6, 6], 3, [{"id": "forge_workshop", "x": [-2.0, 2.0], "z": [-2.0, 2.0]}],
        ["forge_shop_roof", "forge_shop_attic"],
        "grande porte au sud (cases 2 et 3): vantail fixe à gauche, vantail ouvrant à droite (forge_shop_door); "
        "foyer et soufflet au mur nord sous la hotte, cheminée de brique noircie au nord; logis sous le toit "
        "(lucarne au sud); écriteau à droite de la porte")
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    g.box((4.0, 4.0, FL - 0.02), loc=(0, 0, 0.02), color=by_normal("path_dark", "stone_dark"), base=True)
    A.add("forge_shop_floor", g, parent=root)
    ops = {"front": [(0.0, 2.0, 0.0, 2.6), (-1.85, 0.5, 1.2, 2.0)], "back": [], "left": [(0.4, 0.6, 1.1, 1.9)],
           "right": [(0.0, 0.8, 1.0, 2.0)]}

    def deco(side, g_, f):
        if side == "front":
            for s in (1, -1):
                f.box(g_, (0.1, t + 0.04, 2.6), s * 0.95, -t / 2, 1.3, "wood_dark")
            f.box(g_, (2.3, t + 0.06, 0.2), 0.0, -t / 2, 2.7, "wood_dark")
            f.box(g_, (2.0, 0.4, 0.1), 0.0, 0.2, 0.05, "stone_dark", bevel=0.02, bedges=B._not_ground)
            glazed(g_, f, -1.85, 0.5, 1.2, 2.0, t, frame="wood_dark", mullion=False)
            # vantail fixe de gauche, fermé (cloué au linteau)
            pg = Piece(g_)
            plank_leaf(g_, 0.86, 2.5, "wood_dark")
            pg.place(f.p(-0.9, -t + 0.06, 0.05), 0)
            # fers à cheval cloués sur le linteau, anneau d'attache, écriteau (forge_sign)
            for uu in (-0.4, 0.0, 0.4):
                g_.cyl(0.065, 0.02, loc=f.p(uu, 0.04, 2.7), color="iron", segs=8, rot=(90, 0, 0))
                g_.cyl(0.04, 0.025, loc=f.p(uu, 0.04, 2.69), color="wood_dark", segs=8, rot=(90, 0, 0))
            p = f.p(-1.4, 0.01, 1.3)
            g_.cyl(0.07, 0.02, loc=p, color="iron", segs=8, rot=(90, 0, 0))
            f.box(g_, (0.52, 0.04, 0.36), 1.6, 0.02, 1.75, "wood_new")
            word(g_, f, 1.6, 0.045, 1.78, "FORGE", 0.04, "black")
            f.box(g_, (0.3, 0.03, 0.03), 1.6, 0.045, 1.6, "black")
        elif side == "back":
            # hotte et conduit (dedans, contre le mur nord): la hotte reste avec le mur qui la porte
            fi = B.Face("back", hx, hy)
            p = fi.p(0.0, -t - 0.45, 1.6)
            g_.cyl(0.95, 1.05, loc=p, r2=0.3, color=by_normal("tar", "brick", "black"), segs=4, base=True,
                   rot=(0, 0, 45), scale=(1.25, 0.6, 1))
            fi.box(g_, (0.6, 0.45, ze - 2.65), 0.0, -t - 0.22, (2.65 + ze) / 2, "brick")
            # cheminée de brique dehors, contre le mur nord: monte au-dessus du faîtage, haut noirci
            g_.box((0.9, 0.5, 3.0), loc=(0.0, hy + 0.25, 0), color="brick", base=True, bevel=0.04, bedges=B._vertical)
            g_.box((0.98, 0.56, 0.4), loc=(0.0, hy + 0.27, 0), color="stone_dark", base=True)
            # râtelier de pinces? non: outils de la cour (vieux fers) pendus dehors
            fo = B.Face("back", hx, hy)
            for k in range(3):
                p = fo.p(-1.4 + 0.25 * k, 0.01, 1.6)
                g_.cyl(0.07, 0.02, loc=p, color="iron", segs=8, rot=(90, 0, 0))
        elif side == "left":
            glazed(g_, f, 0.4, 0.6, 1.1, 1.9, t, frame="wood_dark", mullion=False)
            # râtelier des pinces et marteaux (case 99 ; 19), contre le mur ouest, dedans
            fi = B.Face("left", hx, hy)
            uu = 1.5
            fi.box(g_, (0.95, 0.05, 0.12), uu, -t - 0.025, 1.55, "wood_dark")
            fi.box(g_, (0.95, 0.05, 0.12), uu, -t - 0.025, 0.75, "wood_dark")
            for k in range(6):
                x = uu - 0.4 + k * 0.16
                if k % 2:
                    fi.box(g_, (0.03, 0.04, 0.9), x, -t - 0.07, 1.15, "iron")
                    fi.box(g_, (0.06, 0.05, 0.08), x, -t - 0.07, 0.72, "iron")
                else:
                    fi.box(g_, (0.03, 0.04, 0.6), x, -t - 0.07, 1.25, "wood")
                    fi.box(g_, (0.07, 0.12, 0.06), x, -t - 0.1, 1.58, "steel_forged")
            g_.box((0.06, 0.06, 0.6), loc=(-2.0 + 0.1, -1.5, FL), color="wood_dark", base=True) if False else None
        elif side == "right":
            glazed(g_, f, 0.0, 0.8, 1.0, 2.0, t, frame="wood_dark")

    side_walls(A, root, "forge_shop", hx, hy, ze - 0.05, t, ops, "stone", "stone_light", deco, plinth=0.6)
    leaf_node(A, "forge_shop_door", root, B.Face("front", hx, hy), 0.9, -t + 0.06, 0.86, 2.5, "wood_dark", right=True)
    # comble (logis sous le toit) et pignons
    g = A.geo()
    g.box((2 * hx - 2 * t, 2 * hy - 2 * t, 0.12), loc=(0, 0, ze - 0.2), color="wood_dark", base=True)
    gable_prisms(g, hx, hy, ze - 0.05, zr, t, "stone", axis="x")
    A.add("forge_shop_attic", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "tile", "tile_dark", axis="x")
    # souche de la cheminée au-dessus du toit (continue la cheminée du mur nord), haut noirci, suie sur le pan
    yc = hy + 0.25
    r.box((0.9, 0.5, 3.6), loc=(0.0, yc, 3.0), color="brick", base=True, bevel=0.04, bedges=B._vertical)
    r.box((0.9, 0.5, 1.0), loc=(0.0, yc - 0.0, 6.6), color="tar", base=True, bevel=0.04, bedges=B._vertical)
    r.box((1.04, 0.64, 0.12), loc=(0.0, yc, 7.6), color="black", base=True, bevel=0.03)
    r.box((0.5, 0.3, 0.12), loc=(0.0, yc, 7.66), color="shadow", base=True)
    dormer(r, -0.9, hy, ze, zr, w=0.65, wh=0.7, wall="stone", roof_col="tile_dark", frame="paint_cream",
           shutter="paint_red", flowers=True)
    A.add("forge_shop_roof", r, parent=root)
    forge_interior(A, root)
    return root


def forge_interior(A, root):
    g = A.geo()
    fp = Footprints()
    z = FL
    # foyer de brique (x -0,95 à 0,3) et soufflet de cuir (x 0,35 à 0,95), contre le mur nord (y 1,2 à 2)
    g.box((1.25, 0.8, 0.72), loc=(-0.325, 1.58, z), color="brick", base=True, bevel=0.03)
    g.box((1.3, 0.85, 0.06), loc=(-0.325, 1.58, z + 0.72), color="stone_dark", base=True, bevel=0.015)
    g.cyl(0.32, 0.06, loc=(-0.35, 1.55, z + 0.76), color="black", segs=8, base=True, scale=(1.2, 1, 1))
    for k, (x, y) in enumerate(((-0.4, 1.5), (-0.25, 1.62), (-0.48, 1.65))):
        g.sphere(0.08, loc=(x, y, z + 0.84), color="ember", segs=6, rings=3, scale=(1, 1, 0.5))
    g.lathe([(0.13, 0.0), (0.15, 0.3)], loc=(-0.85, 1.35, z + 0.78), colors="tin", segs=8, close_top=False)
    g.cyl(0.14, 0.02, loc=(-0.85, 1.35, z + 1.0), color="water", segs=8, base=True)
    # pinces posées sur le bord du foyer
    g.box((0.5, 0.03, 0.02), loc=(-0.1, 1.17, z + 0.79), color="iron", rot=(0, 0, 12))
    # soufflet: deux planches, cuir plissé, buse vers le foyer, perche et chaîne
    bx, by, bz = 0.65, 1.6, z + 0.55
    g.box((0.55, 0.62, 0.05), loc=(bx, by, bz), color="wood_dark", base=True)
    g.box((0.5, 0.56, 0.22), loc=(bx, by, bz + 0.05), color="leather", base=True, taper=(0.92, 0.92))
    g.box((0.55, 0.62, 0.05), loc=(bx, by, bz + 0.27), color="wood_dark", base=True)
    B.rod(g, (bx - 0.25, by, bz + 0.14), (0.25, 1.6, z + 0.74), 0.035, "iron")
    for x in (bx - 0.22, bx + 0.22):
        g.box((0.06, 0.06, 0.55), loc=(x, by, z), color="wood_dark", base=True)
    g.box((0.06, 0.06, 1.6), loc=(0.92, 1.95, z), color="wood_dark", base=True)
    B.rod(g, (0.92, 1.95, z + 1.6), (0.05, 1.3, z + 1.95), 0.03, "wood")
    rope(g, [(bx, by, bz + 0.32), (0.45, 1.5, z + 1.8)], 0.008, "iron")
    fp.rect(-0.95, 0.95, 1.18, 2.0)
    A.add("forge_shop_interior", g, parent=root)
    root["interior_spots"] = {"forge_hearth": _gl(-0.3, 0.6), "forge_bellows": _gl(0.65, 0.9),
                              "forge_tool_rack": _gl(-1.4, -1.5)}
    root["interior_blocked"] = blocked_cells(fp.boxes + [(-2.0, -1.0, -2.0, -1.0)], -2.0, 2.0, -2.0, 2.0)


# Menuiserie ----------------------------------------------------------------------------------------------------
# Carte: x 108 à 114, y 15 à 20 (centre 111,5 ; 18), rotation 1 (porte à l'est). x = 18 - Y, y = 111,5 - X.
# Atelier x 109 à 113, y 16 à 19: x -2 à 2, y -2,5 à 2,5. Porte (114 ; 18): x -0,5. Établi (110 à 112 ; 16):
# x 1 à 2 (mur droit, nord), y -1,5 à 1,5. Râtelier (109 ; 18 et 19): mur du fond (+Y, ouest), x -2 à 0.

JOINERY = dict(hx=2.45, hy=2.95, t=0.45, ze=3.2, zr=6.0)


def joinery_shop(A):
    J = JOINERY
    hx, hy, t, ze, zr = J["hx"], J["hy"], J["t"], J["ze"], J["zr"]
    root = interior_root(
        A, "joinery_shop", [6, 7], 2, [{"id": "joinery_workshop", "x": [-2.0, 2.0], "z": [-2.5, 2.5]}],
        ["joinery_shop_roof", "joinery_shop_attic"],
        "pignon sur la cour (porte en case 2, x -0,5); grenier aux planches sous le toit (porte haute et potence); "
        "établi au mur droit (nord de la carte), râtelier au mur du fond (ouest); menuiserie fermée: poussière, "
        "copeaux, une chaise commencée")
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    I.floor_boards(g, -2.0, 2.0, -2.5, 2.5, FL, along="y", w=0.4)
    rnd = random.Random(8)
    for k in range(10):
        g.sphere(rnd.uniform(0.12, 0.22), loc=(rnd.uniform(0.0, 1.3), rnd.uniform(-1.6, 1.6), FL), color="wood_new",
                 segs=6, rings=3, scale=(1, 1, 0.18))
    A.add("joinery_shop_floor", g, parent=root)
    ops = {"front": [(-0.5, 1.0, 0.0, 2.2), (1.35, 1.0, 0.9, 2.2)], "back": [(1.0, 0.7, 1.1, 2.0)],
           "left": [(-1.2, 0.9, 1.0, 2.1), (1.0, 0.9, 1.0, 2.1)], "right": [(0.0, 0.9, 1.4, 2.3)]}

    def deco(side, g_, f):
        if side == "front":
            door_frame(g_, f, -0.5, 1.0, 2.2, t, frame="wood_dark")
            glazed(g_, f, 1.35, 1.0, 0.9, 2.2, t, frame="wood_dark", shutter="paint_green")
            f.box(g_, (1.4, 0.05, 0.4), 0.3, 0.025, 2.65, "wood_new") if False else None
        elif side == "back":
            glazed(g_, f, 1.0, 0.7, 1.1, 2.0, t, frame="wood_dark", mullion=False)
            # râtelier d'outils (cases 109 ; 18 et 19), contre le mur ouest, dedans: x -2 à 0 = u 0 à 2
            fi = B.Face("back", hx, hy)
            uu = 1.0
            fi.box(g_, (1.8, 0.04, 1.1), uu, -t - 0.02, 1.55, "wood_old")
            for zz in (1.1, 1.95):
                fi.box(g_, (1.8, 0.08, 0.05), uu, -t - 0.06, zz, "wood_dark")
            for k in range(3):
                # scies (lame et poignée)
                x = uu - 0.7 + k * 0.32
                fi.box(g_, (0.18, 0.02, 0.62), x, -t - 0.06, 1.5, "iron_light", rot=(0, 4 * k - 4, 0))
                fi.box(g_, (0.14, 0.04, 0.12), x, -t - 0.07, 1.86, "wood")
            for k in range(3):
                x = uu + 0.3 + k * 0.2
                fi.box(g_, (0.03, 0.05, 0.3), x, -t - 0.07, 1.25, "wood")
                fi.box(g_, (0.03, 0.03, 0.12), x, -t - 0.07, 1.07, "iron_light")
            # rabots sur la tablette
            fi.box(g_, (1.8, 0.24, 0.04), uu, -t - 0.12, 1.97, "wood")
            for k in range(3):
                fi.box(g_, (0.26, 0.08, 0.08), uu - 0.5 + k * 0.45, -t - 0.12, 2.03, "wood_new")
        elif side == "left":
            for u in (-1.2, 1.0):
                glazed(g_, f, u, 0.9, 1.0, 2.1, t, frame="wood_dark", shutter="paint_green")
            # planches debout contre le mur sud, dedans (0,15 m de fond)
            fi = B.Face("left", hx, hy)
            for k in range(5):
                fi.box(g_, (0.22, 0.04, 2.3), -0.1 + k * 0.23 - 0.0, -t - 0.06 - 0.02 * (k % 2), 1.15 + FL, "wood_new" if k % 2
                       else "wood", rot=(-4, 0, 0))
        elif side == "right":
            glazed(g_, f, 0.0, 0.9, 1.4, 2.3, t, frame="wood_dark", mullion=True)

    side_walls(A, root, "joinery_shop", hx, hy, ze - 0.05, t, ops, "stone", "plaster_shade", deco, plinth=0.5)
    I.door_leaf(A, "joinery_shop_door", root, B.Face("front", hx, hy), -0.5, 1.0, 2.2, t, color="paint_green")
    # comble: plancher du grenier, pignons de bardage (planches verticales) au-dessus de la pierre
    g = A.geo()
    g.box((2 * hx - 2 * t, 2 * hy - 2 * t, 0.12), loc=(0, 0, ze - 0.2), color="wood_dark", base=True)
    for ys in (-1, 1):
        y = ys * (hy - 0.06)
        n = 16
        for k in range(n):
            x = -hx + (k + 0.5) * 2 * hx / n
            top = ze + (zr - 0.25 - ze) * (1 - abs(x) / hx)
            g.box((2 * hx / n - 0.01, 0.06 + 0.01 * (k % 2), top - ze + 0.05), loc=(x, y + ys * 0.03 * (k % 2), ze - 0.05),
                  color="wood_old" if k % 3 else "wood_old_dark", base=True)
        g.box((2 * hx + 0.02, 0.16, 0.12), loc=(0, y, ze - 0.12), color="wood_dark", base=True)
    f = B.Face("front", hx, hy)
    # porte du grenier et potence, enseigne MENUISERIE sous la porte haute
    f.box(g, (0.95, 0.06, 1.1), -0.3, 0.03, 4.05, "shadow")
    f.box(g, (0.5, 0.05, 1.1), -0.73, 0.28, 4.05, "wood_old_dark", rot=(0, 0, -80))
    f.box(g, (1.15, 0.08, 0.08), -0.3, 0.06, 3.48, "wood_dark")
    f.box(g, (2.5, 0.05, 0.32), 0.0, 0.025, 3.15, "paint_cream")
    word(g, f, 0.0, 0.052, 3.15, "MENUISERIE", 0.032, "paint_green")
    f.box(g, (0.16, 1.3, 0.18), -0.3, 0.6, 5.0, "wood_dark")
    B.rod(g, f.p(-0.3, 0.05, 4.65), f.p(-0.3, 0.75, 4.98), 0.05, "wood_dark")
    pp = f.p(-0.3, 1.1, 4.88)
    g.cyl(0.1, 0.06, loc=pp, color="iron", segs=8, rot=(0, 90, 0))
    rope(g, [f.p(-0.3, 1.2, 4.86), f.p(-0.3, 1.2, 3.6), f.p(-0.25, 1.0, 3.3), f.p(-0.12, 0.3, 3.3)], 0.012)
    fb = B.Face("back", hx, hy)
    fb.box(g, (0.6, 0.06, 0.7), 0.0, 0.03, 4.1, "glass")
    fb.box(g, (0.7, 0.05, 0.8), 0.0, 0.02, 4.1, "wood_dark")
    A.add("joinery_shop_attic", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "tile", "tile_dark", axis="y")
    B.round_chimney(r, 1.3, 1.6, 4.2, 6.8)
    A.add("joinery_shop_roof", r, parent=root)
    joinery_interior(A, root)
    return root


def joinery_interior(A, root):
    g = A.geo()
    fp = Footprints()
    z = FL
    # établi le long du mur nord (+X): plateau épais, pieds, entretoises, étau, valet, rabot, chaise commencée
    x0, x1, y0, y1 = 1.25, 1.95, -1.4, 1.4
    g.box((x1 - x0, y1 - y0, 0.1), loc=((x0 + x1) / 2, 0, z + 0.78), color="wood_new", base=True, bevel=0.015)
    for y in (y0 + 0.12, y1 - 0.12):
        for x in (x0 + 0.08, x1 - 0.08):
            g.box((0.1, 0.1, 0.78), loc=(x, y, z), color="wood", base=True)
        g.box((x1 - x0 - 0.1, 0.08, 0.08), loc=((x0 + x1) / 2, y, z + 0.2), color="wood_dark", base=True)
    g.box((0.08, y1 - y0 - 0.2, 0.1), loc=((x0 + x1) / 2, 0, z + 0.2), color="wood_dark", base=True)
    g.box((0.18, 0.12, 0.2), loc=(x0 - 0.02, y0 + 0.3, z + 0.7), color="wood_dark", base=True)
    B.rod(g, (x0 - 0.15, y0 + 0.3, z + 0.82), (x0 - 0.15, y0 + 0.3 + 0.0, z + 0.82), 0.02, "iron") if False else None
    g.box((0.04, 0.25, 0.03), loc=(x0 - 0.12, y0 + 0.3, z + 0.82), color="iron")
    g.box((0.24, 0.07, 0.07), loc=(1.6, 0.6, z + 0.88), color="wood", base=True)
    g.box((0.08, 0.04, 0.06), loc=(1.62, 0.6, z + 0.95), color="wood_dark", base=True)
    # chaise commencée: assise et deux pieds, posée sur l'établi
    g.box((0.4, 0.38, 0.04), loc=(1.6, -0.6, z + 0.88), color="wood_new", base=True)
    for yy in (-0.75, -0.45):
        g.box((0.04, 0.04, 0.42), loc=(1.75, yy, z + 0.92), color="wood_new", base=True)
    # poussière: un drap sur le bout de l'établi
    g.box((0.6, 0.6, 0.02), loc=(1.6, 1.05, z + 0.88), color="paper_dark", base=True)
    for k in range(6):
        g.sphere(0.04, loc=(1.45 + 0.05 * k, -0.1 + 0.07 * (k % 3), z + 0.89), color="wood_new", segs=5, rings=3,
                 scale=(1.5, 1, 0.5))
    fp.rect(x0 - 0.2, x1, y0, y1)
    # tréteaux et planche au milieu? non: le milieu reste libre (cases de passage)
    A.add("joinery_shop_interior", g, parent=root)
    root["interior_spots"] = {"joinery_bench": _gl(0.8, 0.0), "joinery_tool_rack": _gl(-1.0, 1.9)}
    root["interior_blocked"] = blocked_cells(fp.boxes + [(-2.0, 0.0, 1.5, 2.5)], -2.0, 2.0, -2.5, 2.5)


# Logis de la ferme ------------------------------------------------------------------------------------------
# Carte: x 114 à 122, y 27 à 32 (centre 118,5 ; 30), rotation 0. x = X - 118,5, y = 30 - Y. Salle x 115 à 121,
# y 28 à 31: x -3,5 à 3,5, y -2 à 2. Porte (118 ; 32): x 0. Cheminée (115 ; 28 et 29): x -3,5 à -2,5, y 0 à 2.
# Table (117 à 119 ; 29): x -1,5 à 1,5, y 0 à 1.

FARM = dict(hx=3.95, hy=2.45, t=0.45, h1=2.8, ze=5.0, zr=8.0)


def farm_house(A):
    F = FARM
    hx, hy, t, h1, ze, zr = F["hx"], F["hy"], F["t"], F["h1"], F["ze"], F["zr"]
    root = interior_root(
        A, "farm_house", [9, 6], 4, [{"id": "farmhouse_hall", "x": [-3.5, 3.5], "z": [-2.0, 2.0]}],
        ["farm_house_roof", "farm_house_upper"],
        "façade au midi sur la cour (porte en case 4, x 0), le dos à la route; salle commune: cheminée au mur ouest, "
        "grande table et bancs; treille sur la façade, banc de pierre")
    eav = eaves_of(hx, hy, ze, zr, "tile", "tile_dark")
    g = A.geo()
    g.box((2 * hx, 2 * hy, 0.02), color="stone_dark", base=True)
    I.floor_tiles(g, -3.5, 3.5, -2.0, 2.0, FL, a="tile", b="tile_dark", cell=0.5)
    A.add("farm_house_floor", g, parent=root)
    ops = {"front": [(0.0, 1.0, 0.0, 2.2), (-2.3, 0.9, 0.95, 2.1), (2.3, 0.9, 0.95, 2.1)],
           "back": [(-1.6, 0.8, 1.0, 2.0), (1.8, 0.8, 1.0, 2.0)], "left": [],
           "right": [(0.0, 0.8, 1.0, 2.0)]}

    def deco(side, g_, f):
        if side == "front":
            door_frame(g_, f, 0.0, 1.0, 2.2, t, frame="stone_light")
            for u in (-2.3, 2.3):
                glazed(g_, f, u, 0.9, 0.95, 2.1, t, frame="paint_cream", shutter="paint_blue")
            # arc surbaissé de pierre sur la porte, banc de pierre, chapelet d'ail, treille de vigne
            R, zc = 0.97, 1.53
            for k in range(7):
                a = math.radians(48 + 84 * (k + 0.5) / 7)
                f.box(g_, (0.24, 0.06, 0.24), (R + 0.12) * math.cos(a), 0.03, zc + (R + 0.12) * math.sin(a),
                      "stone_light", rot=(0, 90 - math.degrees(a), 0))
            bench_stone(g_, f, -1.15, 0.95, 0.22)
            rope(g_, [f.p(0.75, 0.08, 2.3), f.p(0.75, 0.08, 1.7)], 0.008, "straw")
            for k in range(3):
                g_.sphere(0.055, loc=f.p(0.75 + 0.03 * (k % 2), 0.1, 2.15 - k * 0.13), color="paper", segs=5, rings=3)
            for uu in (-3.3, -0.9, 0.9, 3.3):
                f.box(g_, (0.04, 0.5, 0.04), uu, 0.25, 2.62, "iron")
            B.rod(g_, f.p(-3.5, 0.5, 2.62), f.p(3.5, 0.5, 2.62), 0.02, "iron")
            rnd = random.Random(17)
            pts = [f.p(3.6, 0.35, 0.0), f.p(3.55, 0.4, 1.2), f.p(3.45, 0.45, 2.55)]
            rope(g_, pts, 0.05, "bark")
            for k in range(12):
                uu = 3.4 - k * 0.6 + rnd.uniform(-0.1, 0.1)
                g_.sphere(0.26, loc=f.p(uu, 0.5 + rnd.uniform(-0.05, 0.08), 2.69 + rnd.uniform(-0.02, 0.03)),
                          color="vine_leaf" if k % 2 else "vine_leaf_dark", segs=6, rings=4, jitter=0.14, seed=k,
                          scale=(1.25, 1.0, 0.5))
                if k % 4 == 1:
                    for (du, dz) in ((0.0, 0.0), (0.06, 0.07), (-0.06, 0.07)):
                        g_.sphere(0.06, loc=f.p(uu + du, 0.55, 2.47 + dz), color="blackberry", segs=5, rings=3)
            flower_pot(g_, f, -3.3, 0.3, 0.8, 22, ("flower_yellow", "flower_white", "flower_red"))
        elif side == "back":
            for u in (-1.6, 1.8):
                glazed(g_, f, u, 0.8, 1.0, 2.0, t, frame="paint_cream", shutter="paint_blue")
            # vaisselier mural (assiettes, cruches) contre le mur nord, dedans
            fi = B.Face("back", hx, hy)
            uu = 0.0
            for zz in (1.35, 1.75, 2.15):
                fi.box(g_, (1.6, 0.22, 0.04), uu, -t - 0.11, zz, "wood")
                for k in range(3):
                    p = fi.p(uu - 0.5 + 0.5 * k, -t - 0.06, zz + 0.13)
                    g_.cyl(0.11, 0.02, loc=p, color="ceramic_blue" if (k + int(zz * 10)) % 2 else "ceramic", segs=7,
                           rot=(80, 0, 180))
            fi.box(g_, (1.7, 0.03, 1.1), uu, -t - 0.015, 1.8, "wood_dark")
        elif side == "left":
            pass
            # cheminée de la salle commune (cases 115 ; 28 et 29), au mur ouest: jambages, manteau, hotte
            fi = B.Face("left", hx, hy)
            uu = -1.0 + 0.0
            uu = -1.05
            for s in (1, -1):
                fi.box(g_, (0.24, 0.6, 1.25), uu + s * 0.72, -t - 0.3, FL + 0.625, "stone_light", bevel=0.02)
            fi.box(g_, (1.8, 0.68, 0.22), uu, -t - 0.34, FL + 1.36, "wood_dark", bevel=0.02)
            fi.box(g_, (1.86, 0.74, 0.05), uu, -t - 0.37, FL + 1.5, "stone_light")
            p = fi.p(uu, -t - 0.32, FL + 1.53)
            g_.cyl(0.8, h1 - FL - 1.53, loc=p, r2=0.62, color="plaster_cream", segs=4, base=True, rot=(0, 0, 45),
                   scale=(1.15, 0.55, 1))
            fi.box(g_, (1.2, 0.04, 1.2), uu, -t - 0.02, FL + 0.6, "tar")
            fi.box(g_, (1.24, 0.5, 0.04), uu, -t - 0.25, FL + 0.02, "stone_dark")
            for k in range(3):
                p = fi.p(uu - 0.25 + 0.25 * k, -t - 0.3, FL + 0.1)
                g_.cyl(0.06, 0.6, loc=p, color=by_normal("log_end", "bark", thr=0.5), segs=6, rot=(90, 0, 0))
            for k in range(3):
                g_.sphere(0.06, loc=fi.p(uu - 0.15 + 0.15 * k, -t - 0.28, FL + 0.2), color="ember", segs=6, rings=3)
            rope(g_, [fi.p(uu, -t - 0.3, FL + 1.3), fi.p(uu, -t - 0.3, FL + 0.73)], 0.01, "iron")
            g_.cyl(0.16, 0.22, loc=fi.p(uu, -t - 0.3, FL + 0.52), color="black", segs=8, base=True, r2=0.18)
            for s in (1, -1):
                g_.cyl(0.04, 0.22, loc=fi.p(uu + s * 0.6, -t - 0.55, FL + 1.525), color="brass", segs=6, base=True)
        elif side == "right":
            glazed(g_, f, 0.0, 0.8, 1.0, 2.0, t, frame="paint_cream", shutter="paint_blue")

    side_walls(A, root, "farm_house", hx, hy, h1, t, ops, "stone", "plaster_cream", deco, plinth=0.5)
    I.door_leaf(A, "farm_house_door", root, B.Face("front", hx, hy), 0.0, 1.0, 2.2, t, color="paint_blue")
    g = A.geo()
    g.box((2 * hx - 2 * t, 2 * hy - 2 * t, 0.14), loc=(0, 0, h1 - 0.14), color="wood_dark", base=True)
    g.box((2 * hx, 2 * hy, ze - h1 - 0.05), loc=(0, 0, h1), color="stone", base=True)
    gable_prisms(g, hx, hy, ze - 0.05, zr, 0.4, "stone", axis="x")
    quoins_side(g, hx, hy, ze - 0.1, -1, "stone_light", seed=61, z0=h1 - 0.05, step=0.45)
    quoins_side(g, hx, hy, ze - 0.1, 1, "stone_light", seed=62, z0=h1 - 0.05, step=0.45)
    fr = B.Face("front", hx, hy)
    for u in (-2.3, 0.0, 2.3):
        win(g, fr, u, 3.4, 0.8, 1.1, shutter="paint_blue", flowers=(u == 0.0))
    fb = B.Face("back", hx, hy)
    for u in (-1.6, 1.8):
        win(g, fb, u, 3.4, 0.8, 1.1, shutter="paint_blue")
    A.add("farm_house_upper", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "tile", "tile_dark", axis="x")
    B.round_chimney(r, -hx + 0.55, 1.0, 6.4, 8.7)
    A.add("farm_house_roof", r, parent=root)
    farm_interior(A, root)
    return root


def farm_interior(A, root):
    g = A.geo()
    fp = Footprints()
    z = FL
    # grande table (x -1,4 à 1,4, y 0,15 à 0,85) et deux bancs le long, à cheval sur le bord des cases
    p = Piece(g)
    g.box((2.8, 0.75, 0.06), loc=(0, 0, 0.72), color="wood", base=True, bevel=0.015)
    for x in (-1.2, 1.2):
        g.box((0.1, 0.6, 0.72), loc=(x, 0, 0), color="wood_dark", base=True)
        g.box((0.1, 0.66, 0.08), loc=(x, 0, 0.08), color="wood_dark", base=True)
    g.box((2.3, 0.06, 0.08), loc=(0, 0, 0.2), color="wood_dark", base=True)
    fp.add(p.place((0, 0.5, z), 0))
    bench_plain(g, (0, -0.02, z), 0, L=2.6)
    bench_plain(g, (0, 1.02, z), 0, L=2.6)
    # sur la table: miche, pichet, soupière, bols
    g.sphere(0.13, loc=(-0.6, 0.5, z + 0.84), color=by_normal("bread_crust", "bread"), segs=8, rings=4, scale=(1, 1, 0.6))
    g.lathe([(0.07, 0.0), (0.09, 0.12), (0.06, 0.2), (0.07, 0.24)], loc=(0.3, 0.45, z + 0.78), colors="ceramic", segs=8)
    g.lathe([(0.12, 0.0), (0.16, 0.1), (0.14, 0.14), (0.0, 0.16)], loc=(0.8, 0.55, z + 0.78), colors="ceramic_blue",
            segs=8)
    for x in (-1.0, 0.0, 1.0):
        g.lathe([(0.04, 0.0), (0.07, 0.06)], loc=(x, 0.3, z + 0.78), colors="ceramic", segs=6, close_top=False)
    A.add("farm_house_interior", g, parent=root)
    root["interior_spots"] = {"farmhouse_table": _gl(0.0, 0.5), "farmhouse_table_seats": [_gl(-0.8, -0.02),
                                                                                        _gl(0.8, -0.02),
                                                                                        _gl(-0.8, 1.02), _gl(0.8, 1.02)],
                              "farmhouse_fireplace": _gl(-2.4, 1.05)}
    root["interior_blocked"] = blocked_cells(fp.boxes + [(-3.5, -2.95, 0.15, 1.95)], -3.5, 3.5, -2.0, 2.0)
    root["seat_height"] = 0.45


# Grange-étable ----------------------------------------------------------------------------------------------
# Carte: x 105 à 111, y 29 à 35 (centre 108,5 ; 32,5), rotation 1 (porte de l'étable à l'est, case 3: x 0).
# Pignon sur la cour; le mur gauche (-X) regarde le sud et le lavoir.

def farm_barn(A):
    hx = hy = 3.2
    t, ze, zr = 0.45, 4.5, 8.0
    root = A.group("farm_barn", {
        "footprint": [7, 7], "door_cell": 3,
        "note": "pignon sur la cour (porte de l'étable en case 3, x 0, porte coupée en deux); fenil au-dessus, sa "
                "porte ouverte sur le foin et sa potence; bardage de planches au pignon"})
    g = A.geo()
    ops = {"front": [(0.0, 1.4, 0.0, 2.3), (-2.1, 0.55, 1.4, 1.9), (2.1, 0.55, 1.4, 1.9)],
           "back": [(0.0, 0.5, 1.6, 2.0)],
           "left": [(-1.8, 0.2, 1.6, 2.4), (0.0, 0.2, 1.6, 2.4), (1.8, 0.2, 1.6, 2.4), (-1.0, 1.2, 0.0, 2.2)],
           "right": [(-1.5, 0.2, 1.6, 2.4), (1.5, 0.2, 1.6, 2.4)]}
    house_walls(g, hx, hy, ze - 0.05, t, ops, "stone", "stone_dark", plinth=0.5)
    g.box((2 * hx - 2 * t + 0.02, 2 * hy - 2 * t + 0.02, 0.05), color="path_dark", base=True)
    for sy in (-1, 1):
        quoins_side(g, hx, hy, ze - 0.12, sy, "stone_light", seed=71)
    f = B.Face("front", hx, hy)
    door_frame(g, f, 0.0, 1.4, 2.3, t, frame="wood_dark", step=None)
    # porte coupée de l'étable: bas fermé, haut ouvert rabattu contre le mur
    f.box(g, (1.26, 0.06, 1.15), 0.0, -t + 0.08, 0.6, "wood_dark")
    for k in range(4):
        f.box(g, (0.03, 0.065, 1.1), -0.45 + 0.3 * k, -t + 0.08, 0.6, "wood")
    f.box(g, (1.26, 0.07, 0.08), 0.0, -t + 0.08, 0.95, "iron")
    f.box(g, (0.63, 0.06, 1.05), 1.05, 0.03, 1.73, "wood_dark")
    f.box(g, (0.63, 0.06, 1.05), -1.05, 0.03, 1.73, "wood_dark")
    f.box(g, (1.26, 0.04, 1.1), 0.0, -t * 0.6, 1.75, "shadow")
    for u in (-2.1, 2.1):
        f.box(g, (0.55, 0.04, 0.5), u, -t / 2, 1.65, "shadow")
        for k in range(3):
            f.box(g, (0.03, t + 0.02, 0.5), u - 0.17 + 0.17 * k, -t / 2, 1.65, "wood_dark")
    # fumier? non (objet de la carte). Râteau et fourche contre le mur, à droite de la porte
    f.box(g, (0.03, 0.03, 1.6), 1.6, 0.06, 0.8, "wood", rot=(0, -6, 0))
    f.box(g, (0.3, 0.03, 0.05), 1.55, 0.07, 1.6, "iron", rot=(0, -6, 0))
    # côté sud: porte de la grange (charretière) et sa rampe de terre
    fl = B.Face("left", hx, hy)
    fl.box(g, (1.15, 0.06, 2.1), -1.0, -t + 0.08, 1.05, "wood_old")
    for k in range(5):
        fl.box(g, (0.03, 0.065, 2.0), -1.45 + 0.22 * k, -t + 0.08, 1.05, "wood_old_dark")
    fl.box(g, (1.2, 0.07, 0.08), -1.0, -t + 0.08, 1.1, "wood_dark", rot=(0, 55, 0))
    for u in (-1.8, 0.0, 1.8):
        fl.box(g, (0.2, 0.04, 0.8), u, -t / 2, 2.0, "shadow")
    for u in (-1.5, 1.5):
        B.Face("right", hx, hy).box(g, (0.2, 0.04, 0.8), u, -t / 2, 2.0, "shadow")
    B.Face("back", hx, hy).box(g, (0.5, 0.04, 0.4), 0.0, -t / 2, 1.8, "shadow")
    # pignons: pierre jusqu'à l'égout, bardage de planches au-dessus (devant et derrière)
    for ys in (-1, 1):
        y = ys * (hy - 0.05)
        n = 18
        for k in range(n):
            x = -hx + (k + 0.5) * 2 * hx / n
            top = ze + (zr - 0.25 - ze) * (1 - abs(x) / hx)
            g.box((2 * hx / n - 0.012, 0.07, top - ze + 0.05), loc=(x, y + ys * 0.03 * (k % 2), ze - 0.05),
                  color="wood_old" if k % 3 else "wood_old_dark", base=True)
        g.box((2 * hx + 0.04, 0.18, 0.14), loc=(0, y, ze - 0.14), color="wood_dark", base=True)
    # fenil: porte haute ouverte sur le foin qui déborde, potence et poulie
    f.box(g, (1.4, 0.1, 1.35), 0.0, 0.02, 5.4, "shadow")
    f.box(g, (1.5, 0.12, 0.1), 0.0, 0.06, 4.7, "wood_dark")
    for s in (1, -1):
        f.box(g, (0.7, 0.05, 1.3), s * 1.12, 0.035, 5.4, "wood_old")
    g.sphere(1.0, loc=f.p(0.0, 0.1, 5.05), color=by_normal("straw", "straw_dark"), segs=8, rings=4,
             scale=(0.7, 0.3, 0.32))
    f.box(g, (0.16, 1.2, 0.18), 0.0, 0.6, 6.55, "wood_dark")
    B.rod(g, f.p(0.0, 0.05, 6.2), f.p(0.0, 0.7, 6.5), 0.05, "wood_dark")
    g.cyl(0.1, 0.06, loc=f.p(0.0, 1.05, 6.44), color="iron", segs=8, rot=(0, 90, 0))
    rope(g, [f.p(0.0, 1.15, 6.42), f.p(0.0, 1.15, 5.2), f.p(0.15, 1.0, 4.85)], 0.012)
    A.add("farm_barn_body", g, parent=root)
    r = A.geo()
    roof(r, hx, hy, ze, zr, "tile", "tile_dark", axis="y", over_x=0.4, over_y=0.36)
    # lucarne d'aération (chatière) sur le pan sud
    A.add("farm_barn_roof", r, parent=root)
    return root


# Assemblage --------------------------------------------------------------------------------------------------

def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    lpl.AUTO_ROUND = False
    church(A)
    presbytery_house(A)
    village_house_a(A)
    village_house_a(A, shuttered=True)
    village_house_b(A)
    lineman_house(A)
    lineman_house(A, shuttered=True)
    forester_house(A)
    cafe_house(A)
    forge_shop(A)
    joinery_shop(A)
    farm_house(A)
    farm_barn(A)
    washhouse(A)
    watermill(A)
    mill_wheel(A)
    sluice_footbridge(A)
    A.add("tailrace_planks", tailrace_planks(A), {"footprint": [2, 1], "flow_axis": "z", "walk_axis": "x",
                                                  "walk_height": 0.065,
                                                  "note": "à poser à la rotation 0 (le canal de fuite coule vers le "
                                                          "sud)"})
    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "village013.glb")
    size = lpl.export_glb(path, objs, animation_mode="NLA_TRACKS", animations=True)
    st = A.stats()
    parts = {}
    for r_ in A.roots:
        parts[r_.name] = {c.name: lpl.tree_tris(c) for c in r_.children}
    lpl.write_stats("village013", {"nodes": st, "parts": parts, "file_bytes": size,
                                   "animations": {"mill_wheel": [{"name": "mill_wheel_turn", "seconds": WHEEL["period"],
                                                                  "loop": True}]}})
    os.makedirs(os.path.join(lpl.HERE, "blend"), exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(lpl.HERE, "blend", "village013.blend"), compress=True)
    print("VILLAGE013", size, {k: v["tris"] for k, v in st.items()})


if __name__ == "__main__":
    main()
