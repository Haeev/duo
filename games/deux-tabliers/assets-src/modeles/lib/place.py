"""La place du Tilleul d'Ormeval, vue par les vitrines du café et depuis la terrasse (décor de fond cuit).

Repère du plan (x vers l'est, y vers le sud, z en haut), mètres. Plan de la place (adresses.md, section 4.1, et
plans.json `village-maximum`, cadre 0..16 x 0..19,5; au-delà, dessin du studio):

- rangée nord (façades au sud, y = 13): maisons de l'ouest, la maison du café (logement à l'étage, porte de l'escalier
  à l'ouest de la boutique, conduit de la cheminée de la pièce du fond), la ruelle du Lavoir (x 11,5 à 13,5, plan
  ground-4), la boulangerie (« juste de l'autre côté de la ruelle »);
- trottoir de la terrasse (dessus à 0, bordure à 15,80), caniveau, puis la place pavée 16 cm plus bas: le tilleul
  (2,6; 17,4) et la fontaine (13,6; 17,6) du plan, un banc à l'ombre du tilleul;
- la route départementale (y 19,4 à 24,4) traverse la place d'ouest en est; le car pour Mérelles s'arrête devant la
  fontaine (abri et poteau sur le bord nord de la route);
- la mairie-école à l'est (façade à l'ouest, x = 22), l'église au sud (façade au nord, y = 34), maisons à l'ouest;
- au-delà: toits du village, coteau et collines de la vallée de l'Arvelle (lointain sans lumière, couleurs de sommets),
  dôme du ciel de fin d'après-midi.

Clés de matière des faces: « famille|teinte », familles pierre, enduit, tuiles, paves, dalles (matières répétées),
img:<case> (case de l'atlas ajustée à la face), pal (teinte seule), lointain, ciel.
"""

import math
import random

import bmesh
from mathutils import Matrix, Vector, noise

from geo import Geo, P

STONE = "#CDB892"  # pierre blonde (bible, village)
STONE_LIGHT = "#DCCBA6"
STONE_SHADE = "#B7A27E"
SHUTTER = "#7F979B"  # volets gris-bleu
ROOF = "#A9674A"
TREE = "#7D8F5C"  # vert tilleul de fin d'après-midi, entre feuillage clair et olive de la bible
PAVING = "#A49B8A"
ZINC = "#8E9496"
IRON = "#33373A"
WATER = "#5F7F86"

ENDUITS = ["#D9C7A4", "#E0CDB0", "#D7B994", "#E3D3B8", "#CFB79A"]
VOLETS = [SHUTTER, "#8DA08A", "#7F979B", "#9C6B5E", "#A3ADA8"]
PORTES = ["#5E7A71", "#6B4B35", "#7F979B", "#4F5D6B", "#8E3A34"]

# couronnes des arbres de la place, posées par `tilleul` et `arbre_simple`, construites par `feuillage` (objet à part)
COURONNES = []


def k(fam, tint="#FFFFFF"):
    return f"{fam}|{tint}"


# ------------------------------------------------------------------------------------------------
# Repère local d'une façade: u le long de la façade (gauche -> droite vu de dehors), v hauteur, w vers dehors

class Facade:
    def __init__(self, g, side, line, a, b):
        """side: s (regarde le sud, +y), n, e (+x), w. line: coordonnée de la façade; a, b: étendue le long."""
        self.g, self.side, self.line, self.a, self.b = g, side, line, a, b
        self.length = b - a

    def pt(self, u, w):
        s, L, a, b = self.side, self.line, self.a, self.b
        if s == "s":
            return (a + u, L + w)
        if s == "n":
            return (b - u, L - w)
        if s == "e":
            return (L + w, b - u)
        return (L - w, a + u)

    def normal(self):
        return {"s": (0, 1, 0), "n": (0, -1, 0), "e": (1, 0, 0), "w": (-1, 0, 0)}[self.side]

    def box(self, u0, u1, w0, w1, v0, v1, key, bevel=0, drop=()):
        p0, p1 = self.pt(u0, w0), self.pt(u1, w1)
        x0, x1 = sorted((p0[0], p1[0]))
        y0, y1 = sorted((p0[1], p1[1]))
        return self.g.box(x0, x1, y0, y1, v0, v1, key, bevel=bevel, drop=drop)

    def panel(self, u0, u1, v0, v1, w, key):
        pts = []
        for (u, v) in ((u0, v0), (u1, v0), (u1, v1), (u0, v1)):
            x, y = self.pt(u, w)
            pts.append((x, y, v))
        return self.g.quad(pts, key, normal_hint=self.normal())


def fenetre(f, uc, v0, wdt, hgt, rng, volet=SHUTTER, ferme=False, jardiniere=False, cadre=STONE_LIGHT, rideau=None):
    """Fenêtre à encadrement de pierre, appui saillant, volets à persiennes ouverts (ou fermés), jardinière éventuelle."""
    u0, u1 = uc - wdt / 2, uc + wdt / 2
    v1 = v0 + hgt
    e = 0.14
    # tableau (fond sombre) et croisée en retrait de 6 cm
    rid = rideau if rideau is not None else rng.random() < 0.5
    f.panel(u0, u1, v0, v1, 0.006, k("img:fenetre_rideau" if rid else "img:fenetre"))
    # encadrement (jambages, linteau), appui
    for (a, b) in ((u0 - e, u0), (u1, u1 + e)):
        f.box(a, b, 0.0, 0.05, v0, v1 + e, k("pierre", cadre), drop=("bottom",))
    f.box(u0, u1, 0.0, 0.05, v1, v1 + e, k("pierre", cadre))
    f.box(u0 - e - 0.03, u1 + e + 0.03, 0.0, 0.1, v0 - 0.07, v0, k("pierre", cadre))
    # volets
    if ferme:
        f.panel(u0, uc, v0, v1, 0.02, k("img:persiennes", volet))
        f.panel(uc, u1, v0, v1, 0.02, k("img:persiennes", volet))
    elif volet:
        for (a, b) in ((u0 - e - wdt / 2, u0 - e), (u1 + e, u1 + e + wdt / 2)):
            f.box(a, b, 0.05, 0.08, v0, v1, k("img:persiennes", volet))
        # arrêts de volet (petites pièces de fer)
        for uu in (u0 - e - wdt / 2 - 0.04, u1 + e + wdt / 2 + 0.02):
            f.box(uu, uu + 0.02, 0.0, 0.08, v0 + 0.1, v0 + 0.16, k("pal", IRON))
    if jardiniere:
        f.box(u0 - 0.05, u1 + 0.05, 0.1, 0.3, v0, v0 + 0.18, k("pal", "#9A5A3E"), bevel=0.01)
        # touffe de géraniums: trois bosses aplaties
        for i in range(3):
            t = (i + 0.5) / 3
            uu = u0 + (u1 - u0) * t
            x, y = f.pt(uu, 0.2)
            f.g.sphere(x, y, v0 + 0.24, (u1 - u0) / 5.2, 0.16, 0.13, k("img:fleurs"), segs=7, rings=4, smooth=True)


def porte(f, uc, wdt, hgt, couleur, cadre=STONE_LIGHT, marches=1, imposte=True):
    u0, u1 = uc - wdt / 2, uc + wdt / 2
    f.panel(u0, u1, 0.0, hgt, 0.006, k("img:porte", couleur))
    e = 0.16
    for (a, b) in ((u0 - e, u0), (u1, u1 + e)):
        f.box(a, b, 0.0, 0.06, 0, hgt + e, k("pierre", cadre), drop=("bottom",))
    f.box(u0, u1, 0.0, 0.06, hgt, hgt + e, k("pierre", cadre))
    for i in range(marches):
        # marches de seuil, 16 cm chacune, de la plus large (en bas) à la plus étroite
        z0 = -0.16 * (marches - i)
        f.box(u0 - 0.1 - 0.1 * (marches - 1 - i), u1 + 0.1 + 0.1 * (marches - 1 - i), 0.0, 0.3 * (marches - i), z0 - 0.04, z0 + 0.16,
              k("pierre", STONE_SHADE))


def toit(g, x0, x1, y0, y1, h, axis, pitch=33, over=0.35, tint=ROOF, chem=None, hip=False):
    """Toit à deux pans de tuiles (faîtage selon `axis`, 'x' ou 'y'), débords, rives, génoise sous l'égout.
    Murs pignons: prisme triangulaire en pierre. chem: [(x, y)] souches de cheminée."""
    t = math.tan(math.radians(pitch))
    th = 0.12
    if axis == "x":
        ym = (y0 + y1) / 2
        hr = h + (y1 - y0) / 2 * t
        for (ya, yb, sgn) in ((y0 - over, ym, -1), (y1 + over, ym, 1)):
            za = h - over * t
            pts = [(x0 - over * 0.6, ya, za), (x1 + over * 0.6, ya, za), (x1 + over * 0.6, yb, hr), (x0 - over * 0.6, yb, hr)]
            g.quad(pts, k("tuiles", tint), normal_hint=(0, sgn, 1))
            # dessous du débord (chevrons enduits, ombre)
            pts2 = [(x0 - over * 0.6, ya, za - th), (x1 + over * 0.6, ya, za - th), (x1 + over * 0.6, ya + (yb - ya) * 0.12, za - th + (hr - za) * 0.12),
                    (x0 - over * 0.6, ya + (yb - ya) * 0.12, za - th + (hr - za) * 0.12)]
            g.quad(pts2, k("pal", "#8A7A66"), normal_hint=(0, sgn, -1))
            g.quad([(x0 - over * 0.6, ya, za), (x1 + over * 0.6, ya, za), (x1 + over * 0.6, ya, za - th), (x0 - over * 0.6, ya, za - th)],
                   k("tuiles", tint), normal_hint=(0, sgn, 0))
        # faîtage (tuiles faîtières)
        g.box(x0 - over * 0.6, x1 + over * 0.6, ym - 0.12, ym + 0.12, hr - 0.04, hr + 0.1, k("tuiles", tint))
        # pignons
        for xx, sg in ((x0, -1), (x1, 1)):
            g.quad([(xx, y0, h), (xx, y1, h), (xx, ym, hr)], k("pierre", STONE), normal_hint=(sg, 0, 0))
        # génoise: deux rangs sous l'égout des deux pans
        for yy, sg in ((y0, -1), (y1, 1)):
            g.box(x0, x1, min(yy, yy + sg * 0.12), max(yy, yy + sg * 0.12), h - 0.22, h - 0.1, k("tuiles", "#B98466"))
            g.box(x0, x1, min(yy, yy + sg * 0.22), max(yy, yy + sg * 0.22), h - 0.1, h, k("tuiles", "#B98466"))
    else:
        xm = (x0 + x1) / 2
        hr = h + (x1 - x0) / 2 * t
        for (xa, xb, sgn) in ((x0 - over, xm, -1), (x1 + over, xm, 1)):
            za = h - over * t
            pts = [(xa, y0 - over * 0.6, za), (xa, y1 + over * 0.6, za), (xb, y1 + over * 0.6, hr), (xb, y0 - over * 0.6, hr)]
            g.quad(pts, k("tuiles", tint), normal_hint=(sgn, 0, 1))
            pts2 = [(xa, y0 - over * 0.6, za - th), (xa, y1 + over * 0.6, za - th), (xa + (xb - xa) * 0.12, y1 + over * 0.6, za - th + (hr - za) * 0.12),
                    (xa + (xb - xa) * 0.12, y0 - over * 0.6, za - th + (hr - za) * 0.12)]
            g.quad(pts2, k("pal", "#8A7A66"), normal_hint=(sgn, 0, -1))
            g.quad([(xa, y0 - over * 0.6, za), (xa, y1 + over * 0.6, za), (xa, y1 + over * 0.6, za - th), (xa, y0 - over * 0.6, za - th)],
                   k("tuiles", tint), normal_hint=(sgn, 0, 0))
        g.box(xm - 0.12, xm + 0.12, y0 - over * 0.6, y1 + over * 0.6, hr - 0.04, hr + 0.1, k("tuiles", tint))
        for yy, sg in ((y0, -1), (y1, 1)):
            g.quad([(x0, yy, h), (x1, yy, h), (xm, yy, hr)], k("pierre", STONE), normal_hint=(0, sg, 0))
        for xx, sg in ((x0, -1), (x1, 1)):
            g.box(min(xx, xx + sg * 0.12), max(xx, xx + sg * 0.12), y0, y1, h - 0.22, h - 0.1, k("tuiles", "#B98466"))
            g.box(min(xx, xx + sg * 0.22), max(xx, xx + sg * 0.22), y0, y1, h - 0.1, h, k("tuiles", "#B98466"))
    for (cx, cy) in chem or []:
        # souche de cheminée: jusqu'à 0,8 m au-dessus du faîtage, chapeau de pierre
        g.box(cx - 0.3, cx + 0.3, cy - 0.25, cy + 0.25, h, hr + 0.8, k("enduit", "#D6C3A2"))
        g.box(cx - 0.36, cx + 0.36, cy - 0.31, cy + 0.31, hr + 0.8, hr + 0.9, k("pierre", STONE_SHADE))
        g.box(cx - 0.12, cx + 0.12, cy - 0.12, cy + 0.12, hr + 0.9, hr + 1.05, k("pal", "#9A5A3E"))
    return hr


def gouttiere(f, h, u_desc):
    """Gouttière de zinc pendante sous l'égout et descente jusqu'au sol (dauphin de fonte en bas)."""
    f.box(-0.3, f.length + 0.3, 0.3, 0.42, h - 0.32, h - 0.22, k("pal", ZINC))
    x, y = f.pt(u_desc, 0.12)
    f.g.cyl(x, y, 0.0, h - 0.25, 0.045, 6, k("pal", ZINC))
    f.g.cyl(x, y, -0.2, 0.9, 0.055, 6, k("pal", IRON))
    f.box(u_desc - 0.05, u_desc + 0.05, 0.0, 0.36, h - 0.32, h - 0.26, k("pal", ZINC))


def chaines(f, h, tint=STONE_LIGHT):
    """Chaînes d'angle en pierre de taille sur une façade enduite (harpes alternées)."""
    z = 0.0
    i = 0
    while z < h - 0.05:
        z1 = min(h, z + 0.32)
        ln = 0.42 if i % 2 == 0 else 0.26
        f.box(0, ln, 0, 0.025, z, z1 - 0.02, k("pierre", tint))
        f.box(f.length - ln, f.length, 0, 0.025, z, z1 - 0.02, k("pierre", tint))
        z = z1
        i += 1


def maison(g, rect, side, h, floors, bays, rng, mat="enduit", tint=None, door_bay=None, volet=None, porte_c=None, roof_axis=None,
           chem=None, jard=(), fermes=(), socle=True, desc=0.3):
    """Maison de village: murs (pierre ou enduit), soubassement, fenêtres à volets par travée, porte, toit, gouttière."""
    x0, x1, y0, y1 = rect
    tint = tint or (STONE if mat == "pierre" else ENDUITS[rng.randrange(len(ENDUITS))])
    drop = ("bottom", "top")
    g.box(x0, x1, y0, y1, -0.2, h, k(mat, tint), bevel=0, drop=drop)
    line = {"s": y1, "n": y0, "e": x1, "w": x0}[side]
    a, b = (x0, x1) if side in "sn" else (y0, y1)
    f = Facade(g, side, line, a, b)
    if socle:
        f.box(-0.02, f.length + 0.02, 0, 0.04, -0.2, 0.55, k("pierre", STONE_SHADE))
    if mat == "enduit":
        chaines(f, h)
    volet = volet or VOLETS[rng.randrange(len(VOLETS))]
    porte_c = porte_c or PORTES[rng.randrange(len(PORTES))]
    step = f.length / bays
    for fl in range(floors):
        v0 = 0.95 + fl * 2.85 if fl else 0.95
        for i in range(bays):
            uc = step * (i + 0.5)
            if fl == 0 and door_bay == i:
                porte(f, uc, 1.0, 2.25, porte_c)
                continue
            fenetre(f, uc, v0, 0.9 if fl else 0.95, 1.35 if fl else 1.4, rng, volet=volet, ferme=(fl, i) in fermes,
                    jardiniere=(fl, i) in jard)
    # bandeau d'étage
    if floors > 1:
        f.box(-0.02, f.length + 0.02, 0, 0.05, 2.62, 2.78, k("pierre", STONE_LIGHT))
    gouttiere(f, h, f.length * desc)
    axis = roof_axis or ("x" if side in "sn" else "y")
    return toit(g, x0, x1, y0, y1, h, axis, chem=chem)


# ------------------------------------------------------------------------------------------------
# Sol: trottoir, bordure, caniveau, place pavée, route, ruelle

def sol(g):
    # trottoir de la terrasse et de la boulangerie (dalles, dessus à 0 comme le sol du café)
    g.box(-10.0, 22.0, 13.0, 15.8, -0.08, 0.0, k("dalles", "#D8CDB8"), bevel=0, drop=("bottom",))
    # bordure de granit et caniveau pavé (deux rangs, en pente vers le milieu)
    g.box(-10.0, 22.0, 15.8, 15.96, -0.18, 0.0, k("pierre", "#B9B2A6"), bevel=0.012, drop=("bottom",))
    g.box(-10.0, 22.0, 15.96, 16.3, -0.22, -0.18, k("paves", "#8F887C"), bevel=0, drop=("bottom",))
    # place pavée (nord de la route), 18 cm plus bas que le trottoir
    g.box(-10.0, 22.0, 16.3, 19.2, -0.24, -0.16, k("paves", PAVING), bevel=0, drop=("bottom",))
    # bordure et caniveau nord de la route
    g.box(-30.0, 40.0, 19.2, 19.36, -0.3, -0.16, k("pierre", "#B9B2A6"), bevel=0.012, drop=("bottom",))
    # route départementale: chaussée pavée plus sombre, bombée au milieu
    g.box(-30.0, 40.0, 19.36, 21.9, -0.32, -0.27, k("paves", "#7E786E"), bevel=0, drop=("bottom",))
    g.box(-30.0, 40.0, 21.9, 24.4, -0.32, -0.27, k("paves", "#7A746A"), bevel=0, drop=("bottom",))
    g.box(-30.0, 40.0, 24.4, 24.56, -0.3, -0.16, k("pierre", "#B9B2A6"), bevel=0.012, drop=("bottom",))
    # parvis et sud de la place
    g.box(-10.0, 22.0, 24.56, 34.0, -0.24, -0.16, k("paves", "#A8A08E"), bevel=0, drop=("bottom",))
    g.box(-30.0, -10.0, 13.0, 19.2, -0.24, -0.16, k("paves", PAVING), bevel=0, drop=("bottom",))
    g.box(22.0, 40.0, 13.0, 19.2, -0.24, -0.16, k("paves", PAVING), bevel=0, drop=("bottom",))
    g.box(-30.0, -10.0, 24.56, 46.0, -0.24, -0.16, k("paves", "#A8A08E"), bevel=0, drop=("bottom",))
    g.box(22.0, 40.0, 24.56, 46.0, -0.24, -0.16, k("paves", "#A8A08E"), bevel=0, drop=("bottom",))
    g.box(-10.0, 22.0, 34.0, 46.0, -0.24, -0.16, k("paves", "#A8A08E"), bevel=0, drop=("bottom",))
    # ruelle du Lavoir (plan ground-4): pavée, elle monte vers le nord entre le café et la boulangerie
    pts = [(11.5, 13.0, 0.0), (13.5, 13.0, 0.0), (13.5, 3.0, 0.9), (11.5, 3.0, 0.9)]
    g.quad(pts, k("paves", "#9C9484"), normal_hint=(0, 0, 1))
    # rigole centrale de la ruelle
    g.quad([(12.42, 13.0, 0.005), (12.58, 13.0, 0.005), (12.58, 3.0, 0.905), (12.42, 3.0, 0.905)], k("pierre", "#A69D8E"), normal_hint=(0, 0, 1))


# ------------------------------------------------------------------------------------------------
# Bâtiments

def maison_du_cafe(g, rng):
    """La maison du café: logement de l'étage (pierre blonde), porte de l'escalier à l'ouest de la boutique,
    cordon de pierre au-dessus des vitrines (raccord avec la coque), conduit de la cheminée de la pièce du fond."""
    f = Facade(g, "s", 13.0, 1.9, 11.5)
    # mur de l'étage (la coque s'arrête au plafond, 2,80 m)
    g.box(1.9, 11.5, 12.6, 13.0, 2.8, 6.6, k("pierre", STONE), bevel=0, drop=("bottom", "top"))
    # rez-de-chaussée à l'ouest de la boutique: la cage d'escalier du logement
    g.box(1.9, 3.6, 12.5, 13.0, -0.02, 2.8, k("pierre", STONE), bevel=0, drop=("bottom", "top"))
    porte(f, 0.85, 0.95, 2.2, "#5E7A71")
    # soubassement et cordon (le cordon couvre la jointure avec la façade de la coque)
    f.box(-0.02, 1.72, 0, 0.04, -0.02, 0.5, k("pierre", STONE_SHADE))
    f.box(-0.05, f.length + 0.05, -0.02, 0.07, 2.74, 2.96, k("pierre", STONE_LIGHT))
    # étage: quatre fenêtres alignées sur les baies du rez-de-chaussée, jardinières de Simone
    for i, xc in enumerate((2.75, 5.4, 7.5, 9.6)):
        fenetre(f, xc - 1.9, 3.55, 0.9, 1.4, rng, volet=SHUTTER, jardiniere=i in (1, 2, 3), rideau=True)
    gouttiere(f, 6.6, 0.15)
    f.box(-0.1, 0.0, 0.0, 0.06, -0.02, 6.6, k("pierre", STONE_LIGHT))
    # banc de la patronne sous la vitrine, dos au mur (plan seat-13 et seat-14: x 5,00 à 6,20, y 13,05 à 13,50,
    # assise à 0,45 m): pieds de fonte, lattes de chêne, dossier contre l'allège
    for x in (5.08, 6.12):
        g.box(x - 0.03, x + 0.03, 13.12, 13.45, -0.02, 0.42, k("pal", IRON), bevel=0.008)
    for i in range(4):
        yy = 13.14 + i * 0.1
        g.box(5.0, 6.2, yy - 0.04, yy + 0.04, 0.42, 0.47, k("img:ecorce", "#B08A5E"), bevel=0.006)
    for zz in (0.55, 0.72):
        g.box(5.0, 6.2, 13.1, 13.15, zz, zz + 0.1, k("img:ecorce", "#B08A5E"), bevel=0.006)
    # applique de la rue au coin est (lanterne de fonte sur potence)
    lanterne_murale(g, 11.2, 13.0, 3.5)
    toit(g, 1.9, 11.5, 3.0, 13.0, 6.6, "x", chem=[(5.25, 3.6), (9.6, 9.0)])
    # pignon est, sur la ruelle (le café est l'angle de la ruelle du Lavoir)
    g.box(11.5, 11.52, 3.0, 13.0, -0.02, 6.6, k("pierre", STONE), bevel=0, drop=("bottom", "top", "w"))
    g.box(1.88, 1.9, 3.0, 13.0, 2.8, 6.6, k("pierre", STONE), bevel=0, drop=("bottom", "top", "e"))


def lanterne_murale(g, x, y, z):
    g.box(x - 0.03, x + 0.03, y, y + 0.55, z + 0.38, z + 0.43, k("pal", IRON))
    g.box(x - 0.04, x + 0.04, y, y + 0.03, z - 0.05, z + 0.5, k("pal", IRON))
    lanterne(g, x, y + 0.55, z - 0.05)


def lanterne(g, x, y, z):
    """Lanterne de fonte à quatre vitres (allumée le soir; le jour, verre clair)."""
    g.cyl(x, y, z + 0.35, z + 0.42, 0.06, 6, k("pal", IRON))
    g.cyl(x, y, z, z + 0.08, 0.12, 4, k("pal", IRON), phase=45)
    g.cyl(x, y, z + 0.08, z + 0.32, 0.15, 4, k("pal", "#E8DCC0"), r_top=0.17, phase=45)
    g.cyl(x, y, z + 0.32, z + 0.38, 0.2, 4, k("pal", IRON), r_top=0.05, phase=45)


def reverbere(g, x, y, z0=-0.16):
    g.cyl(x, y, z0, z0 + 0.5, 0.13, 8, k("pal", IRON), r_top=0.09)
    g.cyl(x, y, z0 + 0.5, z0 + 3.3, 0.06, 8, k("pal", IRON), r_top=0.045)
    g.cyl(x, y, z0 + 3.3, z0 + 3.4, 0.08, 8, k("pal", IRON))
    lanterne(g, x, y, z0 + 3.4)


def ruelle(g, rng):
    """Ruelle du Lavoir: murs de jardin et maison au fond, vue en enfilade entre le café et la boulangerie."""
    g.box(11.5, 13.5, 2.7, 3.0, 0.0, 3.6, k("pierre", STONE), bevel=0)
    g.box(11.0, 14.0, 2.5, 2.7, 3.4, 3.65, k("pierre", STONE_SHADE), bevel=0)
    # arceau de lierre sur le mur du fond
    for i in range(5):
        g.sphere(11.8 + i * 0.45, 2.95, 3.0 + rng.uniform(-0.3, 0.4), 0.35, 0.15, 0.3, k("img:feuillage", "#5E7A45"), segs=7, rings=4)


def boulangerie(g, rng):
    """Boulangerie (x 13,5 à 20,5): devanture de bois peint vert bouteille, vitrine garnie, enseigne, étage d'enduit."""
    x0, x1, y0, y1 = 13.5, 20.5, 4.0, 13.0
    g.box(x0, x1, y0, y1, -0.2, 6.3, k("enduit", "#E2CFAE"), bevel=0, drop=("bottom", "top"))
    f = Facade(g, "s", y1, x0, x1)
    chaines(f, 6.3)
    f.box(-0.02, f.length + 0.02, 0, 0.04, -0.2, 0.4, k("pierre", STONE_SHADE))
    # devanture en applique (épaisseur 15 cm), de 0,8 m à 6,2 m le long de la façade
    a, b = 0.6, 6.4
    vert = "#2F4A3C"
    f.box(a, b, 0.0, 0.15, 0.0, 0.7, k("img:enseigne_boul@0,0,1,0.5", "#FFFFFF"))
    f.box(a - 0.25, a, 0.0, 0.2, 0.0, 3.3, k("pal", vert))
    f.box(b, b + 0.25, 0.0, 0.2, 0.0, 3.3, k("pal", vert))
    f.box(a - 0.3, b + 0.3, 0.0, 0.3, 3.1, 3.3, k("pal", vert))
    f.box(a - 0.3, b + 0.3, 0.0, 0.3, 2.45, 2.5, k("pal", "#C9A24E"))
    f.panel(a, b, 2.5, 3.1, 0.305, k("img:enseigne_boul@0,0.5,1,1"))
    # vitrine (gauche) et porte vitrée (droite)
    f.panel(a, 4.6, 0.7, 2.45, 0.02, k("img:vitrine_boul"))
    f.box(4.6, 4.75, 0.0, 0.15, 0.0, 2.45, k("pal", vert))
    f.panel(4.75, b, 0.0, 2.45, 0.02, k("img:porte", "#6E8A7A"))
    for uu in (1.9, 3.25):
        f.box(uu - 0.03, uu + 0.03, 0.0, 0.06, 0.7, 2.45, k("pal", vert))
    # store replié (toile rayée) sous l'enseigne, lanternes
    f.box(a, b, 0.25, 0.42, 2.25, 2.42, k("pal", "#B44A3E"))
    # étage: trois fenêtres
    for i, uc in enumerate((1.2, 3.5, 5.8)):
        fenetre(f, uc, 3.8, 0.9, 1.35, rng, volet="#8DA08A", jardiniere=i == 1)
    gouttiere(f, 6.3, 6.85)
    toit(g, x0, x1, y0, y1, 6.3, "x", chem=[(16.0, 6.0)])
    # pignon sur la ruelle
    g.box(13.48, 13.5, 3.0, 13.0, -0.02, 6.3, k("enduit", "#E2CFAE"), bevel=0, drop=("bottom", "top", "e"))
    # pots de lauriers de part et d'autre de la porte (la boulangère les sort le matin)
    for uu in (0.25, 6.75):
        x, y = f.pt(uu, 0.4)
        pot_fleuri(g, x, y, 0.0, big=True)
    # vélo d'un client contre la façade, à gauche de la devanture
    x, y = f.pt(0.0, 0.25)
    velo(g, x - 0.1, y, 0.0, along="x", color="#2E5E8C")


def pot_fleuri(g, x, y, z, big=False):
    r = 0.28 if big else 0.2
    g.cyl(x, y, z, z + r * 1.6, r * 0.8, 8, k("pal", "#A65A3E"), r_top=r)
    g.cyl(x, y, z + r * 1.6, z + r * 1.7, r * 1.05, 8, k("pal", "#B2694A"))
    g.sphere(x, y, z + r * 1.6 + r * 0.9, r * 1.3, r * 1.3, r * 1.2, k("img:feuillage", "#4F6E3E"), segs=8, rings=5)


def velo(g, x, y, z, along="x", color="#2E5E8C"):
    """Bicyclette de ville appuyée (roues de 66 cm, cadre col de cygne, panier)."""
    r = 0.33
    d = 1.05
    ax = (1, 0) if along == "x" else (0, 1)

    def p(t, h):
        return (x + ax[0] * t, y + ax[1] * t, z + h)

    for t in (0.0, d):
        cx, cy, cz = p(t, r)
        # roue: anneau de 12 pans (pneu) et moyeu
        n = 12
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            pa = (cx + ax[0] * r * math.cos(a0), cy + ax[1] * r * math.cos(a0), cz + r * math.sin(a0))
            pb = (cx + ax[0] * r * math.cos(a1), cy + ax[1] * r * math.cos(a1), cz + r * math.sin(a1))
            g.rod(pa, pb, 0.018, 4, k("pal", "#2B2B2D"), cap=False)
    frame = [((0.0, r), (0.42, r + 0.02)), ((0.42, r + 0.02), (0.3, r + 0.48)), ((0.3, r + 0.48), (0.82, r + 0.42)),
             ((0.82, r + 0.42), (d, r)), ((0.42, r + 0.02), (0.82, r + 0.42)), ((0.0, r), (0.3, r + 0.48)),
             ((0.82, r + 0.42), (0.86, r + 0.62))]
    for (a, b) in frame:
        g.rod(p(*a), p(*b), 0.017, 5, k("pal", color), cap=False)
    sx, sy, sz = p(0.3, r + 0.5)
    g.box(sx - 0.1, sx + 0.1, sy - 0.07, sy + 0.07, sz, sz + 0.06, k("pal", "#3A2C25"))
    hb = p(0.86, r + 0.62)
    g.rod((hb[0] - ax[1] * 0.25, hb[1] - ax[0] * 0.25, hb[2]), (hb[0] + ax[1] * 0.25, hb[1] + ax[0] * 0.25, hb[2]), 0.014, 5, k("pal", IRON))
    bx, by, bz = p(1.0, r + 0.5)
    g.box(bx - 0.17, bx + 0.17, by - 0.17, by + 0.17, bz, bz + 0.22, k("pal", "#B08A55"))


def mairie_ecole(g, rng):
    """Mairie-école (est de la place, façade à l'ouest): corps central à fronton et horloge, drapeau, inscription;
    l'école dans l'aile sud, grille et préau. Pierre de taille claire, toit en croupe de tuiles."""
    x0, x1, y0, y1 = 22.0, 31.0, 25.2, 35.0
    g.box(x0, x1, y0, y1, -0.3, 7.6, k("pierre", "#D8C8A4"), bevel=0, drop=("bottom", "top"))
    f = Facade(g, "w", x0, y0, y1)
    f.box(-0.02, f.length + 0.02, 0, 0.05, -0.3, 0.7, k("pierre", STONE_SHADE))
    f.box(-0.03, f.length + 0.03, 0, 0.07, 3.35, 3.55, k("pierre", STONE_LIGHT))
    f.box(-0.05, f.length + 0.05, 0, 0.12, 7.3, 7.6, k("pierre", STONE_LIGHT))
    # avant-corps central (3 m) en saillie de 30 cm, fronton à horloge
    uc = f.length / 2
    f.box(uc - 1.6, uc + 1.6, 0.0, 0.3, -0.3, 7.6, k("pierre", "#DED0AE"))
    # fronton triangulaire
    xA, yA = f.pt(uc - 1.7, 0.32)
    xB, yB = f.pt(uc + 1.7, 0.32)
    xC, yC = f.pt(uc, 0.32)
    g.quad([(xA, yA, 7.6), (xB, yB, 7.6), (xC, yC, 9.0)], k("pierre", "#DED0AE"), normal_hint=(-1, 0, 0))
    A, B, Cc = f.pt(uc - 1.8, 0.4), f.pt(uc + 1.8, 0.4), f.pt(uc, 0.4)
    A2, B2, C2 = f.pt(uc - 1.8, -0.6), f.pt(uc + 1.8, -0.6), f.pt(uc, -0.6)
    g.quad([(A[0], A[1], 7.55), (Cc[0], Cc[1], 9.05), (C2[0], C2[1], 9.05), (A2[0], A2[1], 7.55)], k("tuiles", ROOF), normal_hint=(0, -1, 1))
    g.quad([(Cc[0], Cc[1], 9.05), (B[0], B[1], 7.55), (B2[0], B2[1], 7.55), (C2[0], C2[1], 9.05)], k("tuiles", ROOF), normal_hint=(0, 1, 1))
    # horloge dans le fronton
    f.panel(uc - 0.45, uc + 0.45, 7.7, 8.6, 0.33, k("img:horloge"))
    # porte de la mairie, inscription, balcon et drapeau
    porte(f, uc, 1.4, 2.8, "#4F5D6B", marches=0)
    for i in range(3):
        f.box(uc - 1.2 + i * 0.12, uc + 1.2 - i * 0.12, 0.3, 0.3 + 0.9 - i * 0.3, -0.3 + i * 0.16, -0.14 + i * 0.16, k("pierre", STONE_SHADE))
    # « MAIRIE » gravé dans la frise de l'avant-corps, sous la corniche (lettres de 45 cm: lisibles de la terrasse)
    f.panel(uc - 1.45, uc + 1.45, 6.4, 7.12, 0.31, k("img:mairie@0,0.7539,1,0.9922"))
    fenetre(f, uc, 4.1, 1.1, 2.0, rng, volet=None, cadre="#E6D8B8")
    f.box(uc - 0.8, uc + 0.8, 0.3, 0.75, 3.95, 4.05, k("pierre", STONE_LIGHT))
    for i in range(9):
        u = uc - 0.75 + i * 0.1875
        f.box(u - 0.012, u + 0.012, 0.66, 0.69, 4.05, 4.95, k("pal", IRON))
    f.box(uc - 0.8, uc + 0.8, 0.62, 0.72, 4.92, 4.98, k("pal", IRON))
    # hampe et drapeau tricolore à l'angle nord de la façade, penchés vers la place et vers le nord: vus de la terrasse
    # (nord-ouest) comme du parvis (sud-ouest), ils se projettent loin de « MAIRIE » (avant-corps, 2,5 m plus au sud)
    bx, by = f.pt(0.35, 0.06)
    tx_, ty_ = f.pt(-0.3, 1.05)
    base, tipp = Vector((bx, by, 6.3)), Vector((tx_, ty_, 7.05))
    g.rod(tuple(base), tuple(tipp), 0.025, 6, k("pal", "#E8E2D2"))
    g.sphere(tipp.x, tipp.y, tipp.z + 0.02, 0.045, 0.045, 0.045, k("pal", "#C9A24A"), segs=6, rings=4)
    ax = (tipp - base).normalized()
    hoist0, hoist1 = tipp - ax * 0.08, tipp - ax * 0.68  # guindant de 60 cm lacé le long de la hampe
    side = ax.cross(Vector((0, 0, 1))).normalized() * 0.004
    # le drapeau pend (90 cm): bandes bleue, blanche, rouge du guindant vers le battant, léger ondoiement
    for (c0, c1, col) in ((0.0, 1 / 3, "#2A408C"), (1 / 3, 2 / 3, "#F0F0EC"), (2 / 3, 1.0, "#C82E32")):
        def pt(h, c):
            q = h + Vector((0, 0, -0.9 * c)) + side * (8 * math.sin(c * 5.0))
            return (q.x, q.y, q.z)
        for sgn in (1, -1):
            o = side * (0.5 + 0.5 * sgn)
            pts = [pt(hoist0 + o, c0), pt(hoist1 + o, c0), pt(hoist1 + o, c1), pt(hoist0 + o, c1)]
            g.quad(pts, k("pal", col), normal_hint=tuple(side * sgn))
    # ailes: fenêtres hautes (salles de classe au sud, salle du conseil au nord)
    for uu in (0.9, 2.4, f.length - 2.4, f.length - 0.9):
        fenetre(f, uu, 0.95, 1.0, 1.9, rng, volet=None, cadre="#E6D8B8", rideau=False)
        fenetre(f, uu, 4.2, 1.0, 1.7, rng, volet=None, cadre="#E6D8B8", rideau=True)
    # « ÉCOLE PUBLIQUE » en cartouche sur deux lignes, entre les fenêtres de l'étage de l'aile sud et la corniche
    f.panel(f.length - 3.15, f.length - 0.15, 6.0, 7.2, 0.012, k("img:mairie@0,0.3281,1,0.7266"))
    # plaque de la place (émaillée bleue), au coin nord
    f.panel(0.3, 0.95, 2.5, 2.8, 0.03, k("img:ecole@0,0,1,0.5"))
    # toit en croupe (simplifié: deux pans et deux croupes)
    hr = 7.6 + 2.6
    over = 0.4
    xa, xb = x0 - over, x1 + over
    ya, yb = y0 - over, y1 + over
    xm = (x0 + x1) / 2
    zE = 7.6 - 0.25
    g.quad([(xa, ya, zE), (xa, yb, zE), (xm, yb - 3.0, hr), (xm, ya + 3.0, hr)], k("tuiles", ROOF), normal_hint=(-1, 0, 1))
    g.quad([(xb, ya, zE), (xb, yb, zE), (xm, yb - 3.0, hr), (xm, ya + 3.0, hr)], k("tuiles", ROOF), normal_hint=(1, 0, 1))
    g.quad([(xa, ya, zE), (xb, ya, zE), (xm, ya + 3.0, hr)], k("tuiles", ROOF), normal_hint=(0, -1, 1))
    g.quad([(xa, yb, zE), (xb, yb, zE), (xm, yb - 3.0, hr)], k("tuiles", ROOF), normal_hint=(0, 1, 1))
    g.box(xm - 0.1, xm + 0.1, ya + 3.0, yb - 3.0, hr - 0.05, hr + 0.08, k("tuiles", ROOF))
    # clocheton de l'école sur le faîtage
    g.box(xm - 0.35, xm + 0.35, 29.7, 30.4, hr - 0.4, hr + 0.9, k("enduit", "#E6D8B8"))
    g.lathe(xm, 30.05, hr + 0.9, [(0.6, 0), (0.0, 0.8)], 4, k("pal", "#5A6066"), phase=45)
    # cour de l'école au sud: mur bahut et grille, portail
    g.box(x0, x0 + 0.3, y1, y1 + 6.0, -0.3, 0.6, k("pierre", STONE_SHADE))
    for i in range(30):
        yy = y1 + 0.1 + i * 0.2
        g.box(x0 + 0.13, x0 + 0.17, yy - 0.012, yy + 0.012, 0.6, 1.8, k("pal", "#2F4A3C"))
    g.box(x0 + 0.1, x0 + 0.2, y1, y1 + 6.0, 1.7, 1.76, k("pal", "#2F4A3C"))
    g.box(x0 + 0.1, x0 + 0.2, y1, y1 + 6.0, 0.7, 0.76, k("pal", "#2F4A3C"))
    # marronnier de la cour, derrière la grille
    arbre_simple(g, x0 + 3.0, y1 + 3.2, -0.3, 4.2, 2.8, "#5E7250", rng)
    # panneau d'affichage municipal, contre le mur nord de l'avant-corps
    xs, ys = f.pt(uc - 2.9, 0.12)
    g.box(xs - 0.06, xs + 0.06, ys - 0.75, ys + 0.75, 0.9, 2.1, k("pal", "#5E4630"))
    g.quad([(xs - 0.07, ys - 0.68, 0.98), (xs - 0.07, ys + 0.68, 0.98), (xs - 0.07, ys + 0.68, 2.02), (xs - 0.07, ys - 0.68, 2.02)],
           k("img:affiches"), normal_hint=(-1, 0, 0))
    g.box(xs - 0.14, xs + 0.06, ys - 0.8, ys + 0.8, 2.1, 2.2, k("pal", "#4A3828"))


def branche(g, a, b, r0, r1, segs, key):
    """Branche effilée de a (rayon r0) à b (rayon r1), close par un bout arrondi qui dépasse b de r1: vue de dessous,
    aucune section tranchée (le départ, lui, naît dans la pièce porteuse)."""
    bm = g.bm
    A, B = P(*a), P(*b)
    d = B - A
    ln = d.length
    q = d.to_track_quat("Z", "Y")
    M = Matrix.Translation(A) @ q.to_matrix().to_4x4()
    rings = []
    for (z, r) in ((0.0, r0), (ln, r1), (ln + 0.55 * r1, 0.8 * r1)):
        rings.append([bm.verts.new(M @ Vector((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)))
                      for i in range(segs)])
    tip = bm.verts.new(M @ Vector((0, 0, ln + r1)))
    faces = []
    for r_a, r_b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            faces.append(bm.faces.new([r_a[i], r_a[j], r_b[j], r_b[i]]))
    for i in range(segs):
        faces.append(bm.faces.new([rings[-1][i], rings[-1][(i + 1) % segs], tip]))
    for f in faces:
        f.material_index = g.mi(key)
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def arbre_simple(g, x, y, z, h, r, tint, rng, segs=10):
    """Arbre de cour: tronc, trois charpentières, couronne de bouquets découpés (objet `feuillage`)."""
    g.cyl(x, y, z, z + h * 0.55, 0.16, 6, k("img:ecorce", "#8A7A68"), r_top=0.11)
    tips = []
    for i in range(3):
        a = 2 * math.pi * i / 3 + rng.uniform(-0.3, 0.3)
        tip = (x + math.cos(a) * r * 0.55, y + math.sin(a) * r * 0.55, z + h * 0.85)
        branche(g, (x, y, z + h * 0.5), tip, 0.08, 0.05, 5, k("img:ecorce", "#8A7A68"))
        tips.append(tip)
    COURONNES.append({"centre": (x, y, z + h * 0.78), "rx": r, "rys": r, "ryn": r, "rz": r * 0.75, "zmin": z + h * 0.5,
                      "ymin": -1e9, "tips": tips + [(x, y, z + h * 0.78 + r * 0.6)], "n": 70, "r": (0.4, 0.7), "tint": tint,
                      "seed": 37})


def eglise(g, rng):
    """Église Saint-... au fond de la place: nef de pierre, façade au nord, portail en arc, rosace, contreforts,
    clocher carré à abat-sons et flèche d'ardoise, coq. Aucun édifice réel."""
    x0, x1, y0, y1 = 4.0, 13.0, 34.0, 48.0
    h = 9.0
    g.box(x0, x1, y0, y1, -0.3, h, k("pierre", STONE), bevel=0, drop=("bottom", "top"))
    f = Facade(g, "n", y0, x0, x1)
    # pignon de façade, rampants saillants
    xm = (x0 + x1) / 2
    g.quad([(x0, y0, h), (x1, y0, h), (xm, y0, 13.0)], k("pierre", STONE), normal_hint=(0, -1, 0))
    g.quad([(x0 - 0.2, y0 - 0.25, h), (xm, y0 - 0.25, 13.1), (xm, y1 + 0.25, 13.1), (x0 - 0.2, y1 + 0.25, h)], k("tuiles", "#9C6A52"), normal_hint=(-1, 0, 1))
    g.quad([(xm, y0 - 0.25, 13.1), (x1 + 0.2, y0 - 0.25, h), (x1 + 0.2, y1 + 0.25, h), (xm, y1 + 0.25, 13.1)], k("tuiles", "#9C6A52"), normal_hint=(1, 0, 1))
    # contreforts d'angle
    for uu in (-0.5, f.length - 0.1):
        f.box(uu, uu + 0.6, 0.0, 0.9, -0.3, 6.0, k("pierre", STONE_LIGHT))
        f.box(uu, uu + 0.6, 0.0, 0.5, 6.0, 7.2, k("pierre", STONE_LIGHT))
    # portail: arc en plein cintre (voussures en anneaux), vantaux de chêne, marches
    uc = f.length / 2
    rw = 1.0
    zc = 2.6
    f.panel(uc - rw, uc + rw, -0.3, zc, 0.006, k("img:rosace@0,0,1,0.5"))
    for ring_i, (r0, r1) in enumerate(((1.0, 1.25), (1.25, 1.5))):
        n = 9
        for i in range(n):
            a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
            pts = []
            for (r, a) in ((r0, a0), (r1, a0), (r1, a1), (r0, a1)):
                x, y = f.pt(uc - r * math.cos(a), 0.02 + 0.06 * ring_i)
                pts.append((x, y, zc + r * math.sin(a)))
            g.quad(pts, k("pierre", STONE_LIGHT), normal_hint=(0, -1, 0))
        for side in (-1, 1):
            f.box(uc + side * r0 if side > 0 else uc - r1, uc + side * r1 if side > 0 else uc - r0, 0.0, 0.02 + 0.06 * ring_i, -0.3, zc,
                  k("pierre", STONE_LIGHT))
    # tympan (pierre) entre l'arc et la porte
    n = 9
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        pa = f.pt(uc - rw * math.cos(a0), 0.008)
        pb = f.pt(uc - rw * math.cos(a1), 0.008)
        pc = f.pt(uc, 0.008)
        g.quad([(pa[0], pa[1], zc + rw * math.sin(a0)), (pb[0], pb[1], zc + rw * math.sin(a1)), (pc[0], pc[1], zc)], k("pierre", STONE_SHADE),
               normal_hint=(0, -1, 0))
    for i in range(3):
        f.box(uc - 2.4 + 0.3 * i, uc + 2.4 - 0.3 * i, 0.0, 1.2 - 0.4 * i, -0.3 + 0.16 * i, -0.14 + 0.16 * i, k("pierre", STONE_SHADE))
    # rosace: disque à 24 pans pris dans le cercle de la case (pas de fond carré), entouré d'une moulure de pierre
    zr, rr, rf = 6.7, 1.1, 1.26
    ring = [(math.cos(2 * math.pi * i / 24), math.sin(2 * math.pi * i / 24)) for i in range(24)]
    disc = []
    for (c_, s_) in ring:
        x, y = f.pt(uc + rr * c_, 0.02)
        disc.append((x, y, zr + rr * s_))
    g.quad(disc, k("img:rosace@0.2617,0.5117,0.7383,0.9883"), normal_hint=(0, -1, 0))
    for i in range(24):
        (c0, s0), (c1, s1) = ring[i], ring[(i + 1) % 24]
        pts = []
        for (r_, c_, s_) in ((rr - 0.02, c0, s0), (rf, c0, s0), (rf, c1, s1), (rr - 0.02, c1, s1)):
            x, y = f.pt(uc + r_ * c_, 0.07)
            pts.append((x, y, zr + r_ * s_))
        g.quad(pts, k("pierre", STONE_LIGHT), normal_hint=(0, -1, 0))
        pa, pb = f.pt(uc + rf * c0, 0.07), f.pt(uc + rf * c1, 0.07)
        qa, qb = f.pt(uc + rf * c0, 0.0), f.pt(uc + rf * c1, 0.0)
        g.quad([(qa[0], qa[1], zr + rf * s0), (qb[0], qb[1], zr + rf * s1), (pb[0], pb[1], zr + rf * s1), (pa[0], pa[1], zr + rf * s0)],
               k("pierre", STONE_LIGHT), normal_hint=(-(c0 + c1) * 0.5, 0, (s0 + s1) * 0.5))
    g.cyl(*f.pt(uc, 0.0), 5.5, 5.62, 0.1, 4, k("pierre", STONE_LIGHT))
    # baies de la nef sur le côté est (vues depuis la place, en biais)
    for yy in (37.0, 41.0, 45.0):
        g.box(x1, x1 + 0.02, yy - 0.4, yy + 0.4, 3.0, 6.0, k("pal", "#4A4E5E"))
    # clocher accolé à l'est de la façade
    cx0, cx1, cy0, cy1 = 10.2, 13.4, 33.4, 36.6
    g.box(cx0, cx1, cy0, cy1, -0.3, 17.0, k("pierre", STONE), bevel=0, drop=("bottom",))
    for zz in (9.2, 13.0):
        g.box(cx0 - 0.08, cx1 + 0.08, cy0 - 0.08, cy1 + 0.08, zz, zz + 0.25, k("pierre", STONE_LIGHT))
    for (side, xx, yy) in (("n", (cx0 + cx1) / 2, cy0), ("w", cx0, (cy0 + cy1) / 2), ("e", cx1, (cy0 + cy1) / 2)):
        ff = Facade(g, side, {"n": cy0, "w": cx0, "e": cx1}[side], cx0 if side == "n" else cy0, cx1 if side == "n" else cy1)
        u = ff.length / 2
        ff.box(u - 0.5, u + 0.5, 0.0, 0.01, 13.8, 15.9, k("pal", "#2E2A26"))
        for j in range(6):
            ff.box(u - 0.5, u + 0.5, 0.0, 0.05, 14.0 + j * 0.3, 14.1 + j * 0.3, k("pal", "#6B5A48"))
        ff.box(u - 0.62, u + 0.62, 0.0, 0.06, 15.9, 16.1, k("pierre", STONE_LIGHT))
        ff.box(u - 0.15, u + 0.15, 0.0, 0.01, 10.4, 11.4, k("pal", "#2E2A26"))
    g.box(cx0 - 0.15, cx1 + 0.15, cy0 - 0.15, cy1 + 0.15, 17.0, 17.35, k("pierre", STONE_LIGHT))
    xm2, ym2 = (cx0 + cx1) / 2, (cy0 + cy1) / 2
    g.lathe(xm2, ym2, 17.35, [(2.25, 0), (0.0, 7.5)], 8, k("pal", "#5A6066"), phase=22.5, cap_bottom=True, cap_top=False)
    g.rod((xm2, ym2, 24.7), (xm2, ym2, 26.0), 0.03, 4, k("pal", IRON))
    g.rod((xm2 - 0.3, ym2, 25.6), (xm2 + 0.3, ym2, 25.6), 0.025, 4, k("pal", IRON))
    g.box(xm2 - 0.15, xm2 + 0.15, ym2 - 0.03, ym2 + 0.03, 26.0, 26.25, k("pal", "#B08A40"))


def fontaine(g, rng):
    """Fontaine du plan (fixture-1, 13,6; 17,6, r 0,8): bassin octogonal de pierre, pile centrale, deux goulots
    de bronze, vasque haute, pomme de pin. Les randonneurs y remplissent leur gourde (côté place)."""
    fx, fy = 13.6, 17.6
    z0 = -0.2
    g.cyl(fx, fy, z0, z0 + 0.12, 0.92, 8, k("pierre", STONE_SHADE), phase=22.5)
    g.cyl(fx, fy, z0 + 0.12, z0 + 0.62, 0.8, 8, k("pierre", STONE), phase=22.5, cap_top=False)
    # margelle: anneau plat
    ri, ro = 0.66, 0.84
    for i in range(8):
        a0, a1 = math.radians(22.5 + 45 * i), math.radians(22.5 + 45 * (i + 1))
        pts = [(fx + ro * math.cos(a0), fy + ro * math.sin(a0), z0 + 0.7), (fx + ro * math.cos(a1), fy + ro * math.sin(a1), z0 + 0.7),
               (fx + ri * math.cos(a1), fy + ri * math.sin(a1), z0 + 0.7), (fx + ri * math.cos(a0), fy + ri * math.sin(a0), z0 + 0.7)]
        g.quad(pts, k("pierre", STONE_LIGHT), normal_hint=(0, 0, 1))
        for (r, hint) in ((ro, 1), (ri, -1)):
            pa = (fx + r * math.cos(a0), fy + r * math.sin(a0))
            pb = (fx + r * math.cos(a1), fy + r * math.sin(a1))
            mx, my = (pa[0] + pb[0]) / 2 - fx, (pa[1] + pb[1]) / 2 - fy
            g.quad([(pa[0], pa[1], z0 + 0.6 if r == ro else z0 + 0.3), (pb[0], pb[1], z0 + 0.6 if r == ro else z0 + 0.3),
                    (pb[0], pb[1], z0 + 0.7), (pa[0], pa[1], z0 + 0.7)], k("pierre", STONE_LIGHT), normal_hint=(mx * hint, my * hint, 0))
    # eau
    g.cyl(fx, fy, z0 + 0.5, z0 + 0.56, 0.68, 8, k("pal", WATER), phase=22.5, cap_bottom=False)
    # pile centrale et vasque
    g.cyl(fx, fy, z0 + 0.5, z0 + 1.6, 0.22, 8, k("pierre", STONE), phase=22.5)
    g.cyl(fx, fy, z0 + 1.6, z0 + 1.72, 0.3, 8, k("pierre", STONE_LIGHT), phase=22.5)
    g.lathe(fx, fy, z0 + 1.72, [(0.12, 0), (0.42, 0.18), (0.46, 0.26), (0.0, 0.26)], 10, k("pierre", STONE_LIGHT))
    g.lathe(fx, fy, z0 + 1.98, [(0.1, 0), (0.14, 0.12), (0.08, 0.3), (0.0, 0.38)], 8, k("pierre", STONE))
    # goulots (bronze) vers le nord et le sud, filets d'eau
    for sgn in (-1, 1):
        g.rod((fx, fy + sgn * 0.2, z0 + 1.25), (fx, fy + sgn * 0.42, z0 + 1.2), 0.025, 6, k("pal", "#7A6440"))
        g.rod((fx, fy + sgn * 0.43, z0 + 1.18), (fx, fy + sgn * 0.47, z0 + 0.56), 0.012, 4, k("pal", "#B9CED0"), cap=False)


def tilleul(g, rng):
    """Le tilleul de la place (plan tree-1, 2,6; 17,4): vieux tronc évasé, charpentières, houppier en volume
    (bouquets de feuillage déformés). Côté façade, la couronne est taillée à 1 m du logement (plus large au sud)."""
    tx, ty = 2.6, 17.4
    z0 = -0.2
    # tronc évasé (empattement), légèrement tors
    prof = [(0.62, 0), (0.45, 0.3), (0.38, 1.2), (0.36, 2.4), (0.33, 3.2)]
    vs = g.lathe(tx, ty, z0, prof, 10, k("img:ecorce", "#8C8274"), cap_bottom=False, cap_top=True)
    for v in vs:
        h = v.co.z - z0
        v.co.x += 0.04 * math.sin(h * 1.7)
        v.co.y += 0.03 * math.cos(h * 1.3)
    # grille d'arbre (fonte) et banquette de pierre autour du pied
    for i in range(16):
        a0, a1 = 2 * math.pi * i / 16, 2 * math.pi * (i + 1) / 16
        for (r0, r1) in ((0.75, 1.15),):
            g.quad([(tx + r0 * math.cos(a0), ty + r0 * math.sin(a0), -0.155), (tx + r1 * math.cos(a0), ty + r1 * math.sin(a0), -0.155),
                    (tx + r1 * math.cos(a1), ty + r1 * math.sin(a1), -0.155), (tx + r0 * math.cos(a1), ty + r0 * math.sin(a1), -0.155)],
                   k("pal", "#3A3E3C"), normal_hint=(0, 0, 1))
    # charpentières: cinq branches maîtresses, chacune avec deux rameaux
    branches = []
    for i in range(6):
        a = 2 * math.pi * (i + rng.uniform(-0.15, 0.15)) / 6
        reach = 2.4 if math.sin(a) < -0.3 else 3.2  # moins vers le nord (le logement)
        b0 = (tx + 0.25 * math.cos(a), ty + 0.25 * math.sin(a), z0 + 3.0 + rng.uniform(-0.2, 0.3))
        b1 = (tx + reach * 0.55 * math.cos(a), ty + reach * 0.55 * math.sin(a), z0 + 5.2 + rng.uniform(-0.3, 0.4))
        b2 = (tx + reach * math.cos(a + 0.2), ty + reach * math.sin(a + 0.2), z0 + 7.0 + rng.uniform(-0.4, 0.5))
        branche(g, b0, b1, 0.17, 0.13, 6, k("img:ecorce", "#857B6E"))
        branche(g, b1, b2, 0.1, 0.06, 5, k("img:ecorce", "#857B6E"))
        b3 = (tx + reach * 0.85 * math.cos(a - 0.35), ty + reach * 0.85 * math.sin(a - 0.35), z0 + 5.6)
        branche(g, b1, b3, 0.07, 0.045, 5, k("img:ecorce", "#857B6E"))
        branches += [b1, b2, b3]
    branche(g, (tx, ty, z0 + 3.0), (tx + 0.1, ty + 0.2, z0 + 8.6), 0.2, 0.09, 6, k("img:ecorce", "#857B6E"))
    # houppier: bouquets de feuillage découpé (objet à part, voir `feuillage`), groupés au bout des rameaux
    COURONNES.append({"centre": (tx, ty + 0.5, z0 + 7.2), "rx": 4.4, "rys": 4.6, "ryn": 3.3, "rz": 3.3, "zmin": z0 + 4.3,
                      "ymin": 14.1, "tips": branches + [(tx + 0.1, ty + 0.2, z0 + 8.6)], "n": 205, "r": (0.42, 0.78),
                      "tint": TREE, "seed": 31})


FEUILLAGE_TILE = 1.3  # mètres par tuile de la texture de feuillage découpé (feuilles de 7 à 9 cm)


def _srgb(c):
    return "#%02X%02X%02X" % tuple(max(0, min(255, int(round(v * 255)))) for v in c)


def feuillage(sun_dir):
    """Feuillage des arbres de la place, en un Geo sans lumière cuite: pour chaque couronne, des bouquets (icosphères
    déformées par un bruit) groupés autour des bouts de rameaux, ce qui laisse des trouées de ciel entre les groupes; le
    bord de chaque bouquet est découpé par la texture de feuillage (alpha). Lumière calculée ici, par sommet, en couleurs
    de coin (`g.loop_cols`, sRGB): soleil (avec l'ombre portée des autres bouquets, par lancer de rayons), ciel, et
    assombrissement vers le cœur de la couronne. UV en projection sur le plan dominant de chaque face (`g.loop_uvs`)."""
    from mathutils.bvhtree import BVHTree
    g = Geo("shell_village_place_foliage")
    bm = g.bm
    sun = P(*sun_dir).normalized()
    blobs = []
    for cr in COURONNES:
        rng = random.Random(cr["seed"])
        cx, cy, cz = cr["centre"]
        rx, rz = cr["rx"], cr["rz"]

        def env(d, cr=cr):
            return Vector((d.x * cr["rx"], d.y * (cr["rys"] if d.y > 0 else cr["ryn"]), d.z * cr["rz"]))

        # groupes: bouts de rameaux ramenés vers l'enveloppe, plus quelques groupes au sommet et sur les flancs
        groups = []
        for t in cr["tips"]:
            d = Vector((t[0] - cx, t[1] - cy, t[2] - cz))
            if d.length < 1e-3:
                d = Vector((0, 0, 1))
            d.normalize()
            groups.append(d)
        while len(groups) < max(10, len(cr["tips"]) + 8):
            d = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-0.3, 1)))
            if d.length > 0.2:
                groups.append(d.normalized())
        n_per = cr["n"] / len(groups)
        for gi, gd in enumerate(groups):
            m = int(n_per + (1 if rng.random() < n_per % 1 else 0))
            for _ in range(m):
                d = (gd + Vector((rng.gauss(0, 0.24), rng.gauss(0, 0.24), rng.gauss(0, 0.2)))).normalized()
                e = 0.66 + 0.3 * rng.random() ** 0.6
                o = env(d) * e
                p = (cx + o.x, cy + o.y, cz + o.z)
                if p[2] < cr["zmin"]:
                    # dessous de la couronne: remonté par paliers irréguliers (pas de plafond plat)
                    p = (p[0], p[1], cr["zmin"] + rng.uniform(0, 1.2))
                if p[1] < cr["ymin"]:
                    p = (p[0], cr["ymin"] + rng.uniform(0, 0.3), p[2])
                r = rng.uniform(*cr["r"]) * (1.15 if d.z > 0.3 else 1.0)
                blobs.append((P(*p), r, cr, Vector((rng.uniform(0, 100), rng.uniform(0, 100), rng.uniform(0, 100))), rng.random()))
    # géométrie
    spans = []
    for (c, r, cr, seed, jit) in blobs:
        # 80 faces (subdivisions=1 donne l'icosaèdre de 20 faces dans Blender 5); construite à part puis recopiée: dans le
        # maillage commun, l'opérateur invalide des sommets déjà posés
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=2, radius=r)
        tmp.verts.index_update()
        vs = [bm.verts.new(v.co) for v in tmp.verts]
        for tf in tmp.faces:
            bm.faces.new([vs[v.index] for v in tf.verts])
        tmp.free()
        for v in vs:
            n = v.co.normalized()
            disp = 0.28 * noise.noise(n * 2.2 + seed) + 0.12 * noise.noise(n * 5.0 + seed)
            v.co = c + Vector((n.x * r * (1 + disp), n.y * r * (1 + disp), n.z * r * 0.85 * (1 + disp)))
        spans.append((vs, c, cr, jit))
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        f.material_index = g.mi(k("feuillage", "#FFFFFF"))
        f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.normal_update()
    tree = BVHTree.FromBMesh(bm)
    # lumière par sommet
    shade = {}
    for (vs, c, cr, jit) in spans:
        cc = P(*cr["centre"])
        base = Vector([int(cr["tint"][i:i + 2], 16) / 255 for i in (1, 3, 5)])
        for v in vs:
            n = (v.co - c).normalized()
            lam = max(0.0, n.dot(sun))
            vis = 0.0
            if lam > 0:
                for off in ((0, 0, 0), (0.15, 0.1, 0.0), (-0.1, -0.15, 0.1)):
                    o = v.co + n * 0.06 + Vector(off)
                    hit = tree.ray_cast(o, sun, 12.0)
                    if hit[0] is None:
                        vis += 1 / 3
                    elif hit[3] > 2.5:
                        vis += 0.12  # ombre légère d'un bouquet lointain (le feuillage laisse passer le jour)
            q = v.co - cc
            dz = cr["rz"]
            ell = math.sqrt((q.x / cr["rx"]) ** 2 + (q.y / max(cr["rys"], cr["ryn"])) ** 2 + (q.z / dz) ** 2)
            ao = max(0.35, min(1.0, 0.25 + 0.85 * ell)) * (0.85 + 0.15 * max(0.0, n.z))
            sky = 0.55 + 0.25 * n.z
            light = ao * (0.42 * sky + 0.95 * lam * vis)
            warm = 0.07 * lam * vis
            col = (min(1, base.x * (0.55 + 1.1 * light) + warm), min(1, base.y * (0.52 + 1.05 * light) + warm * 0.7),
                   min(1, base.z * (0.5 + light) * 0.92))
            col = tuple(cc_ * (0.94 + 0.12 * jit) for cc_ in col)
            # le rendu ACES pousse la saturation des verts: on ramène 30 % vers le gris de même luminance
            lum_ = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2]
            col = tuple(lum_ + 0.7 * (cc_ - lum_) for cc_ in col)
            shade[v] = _srgb(col)
    # UV (projection sur le plan dominant, continue d'une face à l'autre, décalage par bouquet) et couleurs de coin
    blob_of = {}
    for bi, (vs, c, cr, jit) in enumerate(spans):
        for v in vs:
            blob_of[v] = (bi, jit)
    g.loop_uvs, g.loop_cols = [], []
    for f in bm.faces:
        nrm = f.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        bi, jit = blob_of[f.verts[0]]
        ou, ov = (bi * 0.618) % 1.0, (bi * 0.382 + jit) % 1.0
        for lp in f.loops:
            co = lp.vert.co
            a, b = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            g.loop_uvs.append((a / FEUILLAGE_TILE + ou, b / FEUILLAGE_TILE + ov))
            g.loop_cols.append(shade[lp.vert])
    return g


def _scale_hex(h, s, warm=0.0):
    r, gg, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    r, gg, b = min(1, r * s + warm), min(1, gg * s + warm * 0.6), min(1, b * s)
    q = lambda v: max(0, min(255, int(round(v * 255 / 8) * 8)))  # noqa: E731 (couleurs regroupées: moins de clés)
    return "#%02X%02X%02X" % (q(r), q(gg), q(b))


def banc(g, x0, x1, y, facing, z=-0.16):
    """Banc public: pieds de fonte, lattes de chêne. facing: 's' ou 'e' etc. (côté où regardent les gens)."""
    if facing in "sn":
        sg = 1 if facing == "s" else -1
        for xx in (x0 + 0.15, x1 - 0.15):
            g.box(xx - 0.03, xx + 0.03, y - 0.25, y + 0.25, z, z + 0.45, k("pal", IRON))
            g.box(xx - 0.03, xx + 0.03, y - 0.25 * sg - 0.03, y - 0.25 * sg + 0.03, z + 0.45, z + 0.9, k("pal", IRON))
        for i in range(4):
            yy = y - 0.22 + i * 0.12
            g.box(x0, x1, yy - 0.045, yy + 0.045, z + 0.43, z + 0.47, k("img:ecorce", "#B08A5E"))
        yb = y - 0.25 * sg
        for i in range(2):
            zz = z + 0.58 + i * 0.16
            g.box(x0, x1, yb - 0.03, yb + 0.03, zz, zz + 0.09, k("img:ecorce", "#B08A5E"))


def arret_du_car(g):
    """Arrêt du car (ligne 12 vers Mérelles) devant la fontaine: abri de bois ouvert sur la route, poteau à plaque."""
    x0, x1, y0, y1 = 15.2, 17.8, 16.95, 18.3
    z = -0.16
    for (xx, yy) in ((x0 + 0.06, y0 + 0.06), (x1 - 0.06, y0 + 0.06), (x0 + 0.06, y1 - 0.1), (x1 - 0.06, y1 - 0.1)):
        g.box(xx - 0.05, xx + 0.05, yy - 0.05, yy + 0.05, z, z + 2.35, k("pal", "#5E4630"))
    # fond et joues en planches, toit à un pan
    g.box(x0, x1, y0, y0 + 0.05, z + 0.2, z + 2.2, k("img:ecorce", "#9C7C58"))
    g.box(x0, x0 + 0.05, y0, y1 - 0.4, z + 0.9, z + 2.2, k("img:ecorce", "#9C7C58"))
    g.box(x1 - 0.05, x1, y0, y1 - 0.4, z + 0.9, z + 2.2, k("img:ecorce", "#9C7C58"))
    g.quad([(x0 - 0.15, y0 - 0.2, z + 2.55), (x1 + 0.15, y0 - 0.2, z + 2.55), (x1 + 0.15, y1 + 0.3, z + 2.3), (x0 - 0.15, y1 + 0.3, z + 2.3)],
           k("tuiles", ROOF), normal_hint=(0, 0.3, 1))
    g.quad([(x0 - 0.15, y0 - 0.2, z + 2.45), (x1 + 0.15, y0 - 0.2, z + 2.45), (x1 + 0.15, y1 + 0.3, z + 2.2), (x0 - 0.15, y1 + 0.3, z + 2.2)],
           k("pal", "#6B5442"), normal_hint=(0, 0, -1))
    g.box(x0 - 0.15, x1 + 0.15, y1 + 0.25, y1 + 0.32, z + 2.15, z + 2.32, k("pal", "#5E4630"))
    # banc intérieur et fiche horaire sur le fond
    g.box(x0 + 0.2, x1 - 0.2, y0 + 0.05, y0 + 0.45, z + 0.42, z + 0.47, k("img:ecorce", "#B08A5E"))
    for xx in (x0 + 0.4, x1 - 0.4):
        g.box(xx - 0.03, xx + 0.03, y0 + 0.1, y0 + 0.4, z, z + 0.42, k("pal", IRON))
    g.quad([(x0 + 0.5, y0 + 0.052, z + 1.1), (x0 + 1.1, y0 + 0.052, z + 1.1), (x0 + 1.1, y0 + 0.052, z + 1.7), (x0 + 0.5, y0 + 0.052, z + 1.7)],
           k("img:arret_car@0,0,1,0.5"), normal_hint=(0, 1, 0))
    # poteau au bord du trottoir, plaque vers la route (lisible des deux côtés)
    px, py = 18.3, 19.0
    g.cyl(px, py, z, z + 2.7, 0.04, 6, k("pal", "#8E9496"))
    for (yy, hint) in ((py + 0.03, 1), (py - 0.03, -1)):
        g.quad([(px - 0.3, yy, z + 2.1), (px + 0.3, yy, z + 2.1), (px + 0.3, yy, z + 2.7), (px - 0.3, yy, z + 2.7)],
               k("img:arret_car@0,0.5,1,1"), normal_hint=(0, hint, 0))


def maisons(g, rng):
    """Maisons de la place: rangée nord à l'ouest du café, côté ouest et sud de la place, coin nord-est."""
    hs = []
    # rangée nord, à l'ouest du café (la maison voisine du plan, ground-6, et la suivante)
    hs.append(maison(g, (-4.4, 1.9, 5.0, 13.0), "s", 6.9, 2, 3, rng, mat="enduit", tint="#DCC6A2", door_bay=1, jard={(1, 0), (1, 2)},
                     chem=[(-1.5, 8.0)]))
    hs.append(maison(g, (-11.5, -4.4, 4.0, 13.0), "s", 7.6, 2, 3, rng, mat="pierre", door_bay=0, fermes={(1, 2)}, chem=[(-8.0, 7.5)]))
    # coin nord-ouest: maison qui regarde l'est, la route passe au sud
    hs.append(maison(g, (-17.0, -10.0, 13.0, 19.0), "e", 6.4, 2, 2, rng, mat="enduit", tint="#D7B994", door_bay=None))
    # côté ouest de la place (façades à l'est, x = -4)
    hs.append(maison(g, (-11.0, -4.0, 25.2, 30.2), "e", 7.2, 2, 2, rng, mat="pierre", door_bay=1, jard={(1, 0)}, chem=[(-7.0, 27.0)]))
    hs.append(maison(g, (-11.5, -4.2, 30.2, 36.0), "e", 6.6, 2, 2, rng, mat="enduit", tint="#E0CDB0", door_bay=0, fermes={(1, 1)}))
    # sud-ouest, à côté de l'église (façade au nord)
    hs.append(maison(g, (-4.2, 3.2, 36.0, 44.0), "n", 6.2, 2, 3, rng, mat="enduit", tint="#D9C7A4", door_bay=2, jard={(1, 1)}, chem=[(0.0, 40.0)]))
    # sud-est, le presbytère entre l'église et la cour de l'école
    hs.append(maison(g, (14.8, 21.6, 41.5, 48.0), "n", 6.8, 2, 3, rng, mat="pierre", door_bay=1, chem=[(18.0, 44.0)]))
    # coin nord-est (façade à l'ouest), au-delà de la boulangerie
    hs.append(maison(g, (22.0, 29.0, 13.0, 19.0), "w", 7.0, 2, 2, rng, mat="enduit", tint="#E3D3B8", door_bay=0, jard={(1, 1)}))
    return hs


def place(rng=None):
    """Toute la place cuite, en un Geo (un objet, un matériau par famille)."""
    rng = rng or random.Random(11)
    g = Geo("shell_village_place")
    COURONNES.clear()
    sol(g)
    maison_du_cafe(g, rng)
    ruelle(g, rng)
    boulangerie(g, rng)
    maisons(g, rng)
    mairie_ecole(g, rng)
    eglise(g, rng)
    fontaine(g, rng)
    tilleul(g, rng)
    arret_du_car(g)
    # banc à l'ombre du tilleul, tourné vers la place et l'église
    banc(g, -0.4, 1.2, 17.0, "s")
    # bancs du parvis, tournés vers le tilleul et le café
    banc(g, 1.5, 3.1, 27.0, "n")
    banc(g, 14.0, 15.6, 27.0, "n")
    # réverbères: bord nord de la route (devant le café et la fontaine), parvis, coin de la mairie
    for (x, y) in ((8.65, 18.9), (-3.0, 18.9), (11.2, 25.1), (21.3, 25.0), (-2.0, 25.1)):
        reverbere(g, x, y)
    # vélo d'un randonneur contre la margelle de la fontaine (côté place)
    velo(g, 12.15, 16.75, -0.2, along="x", color="#9C3B32")
    # pots de fleurs sur le parvis, aux marches de l'église
    for (x, y) in ((6.0, 33.2), (11.0, 33.2), (-3.4, 26.0)):
        pot_fleuri(g, x, y, -0.16, big=True)
    return g


# ------------------------------------------------------------------------------------------------
# Lointain (sans lumière cuite): toits du village au-delà de la place, coteau, collines; dôme du ciel

def _shade(hexs, nrm, sun, haze, fog="#B7B3B4"):
    """Couleur d'une face du lointain: lambert doux vers le soleil, voile de l'air vers la couleur de l'horizon."""
    r, gg, b = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lam = 0.5 + 0.42 * max(0.0, nrm.dot(sun))
    fr, fg, fb = (int(fog[i:i + 2], 16) / 255 for i in (1, 3, 5))
    r, gg, b = r * lam, gg * lam, b * lam
    r, gg, b = r * (1 - haze) + fr * haze, gg * (1 - haze) + fg * haze, b * (1 - haze) + fb * haze
    q = lambda v: max(0, min(255, int(round(v * 255 / 4) * 4)))  # noqa: E731
    return "#%02X%02X%02X" % (q(r), q(gg), q(b))


def lointain(sun_dir, rng=None):
    """Toits au-delà de la place (25 à 45 m), coteau boisé et collines de la vallée (45 à 64 m): un seul matériau sans
    lumière (couleurs de sommets calculées ici)."""
    rng = rng or random.Random(5)
    g = Geo("shell_village_far")
    sun = P(*sun_dir).normalized()
    centre = (7.5, 16.0)
    # toits du village: anneau de maisons simples, hors de la place
    for i in range(34):
        a = 2 * math.pi * i / 34 + rng.uniform(-0.05, 0.05)
        d = rng.uniform(36, 48)
        x, y = centre[0] + math.cos(a) * d, centre[1] + math.sin(a) * d
        w, dd, h = rng.uniform(6, 10), rng.uniform(6, 9), rng.uniform(5.5, 8.5)
        base = rng.choice(ENDUITS + [STONE, STONE])
        haze = min(0.4, (d - 30) / 50)
        # la route départementale continue vers l'ouest et l'est: aucune maison en travers (couloir y 17,5 à 26,5)
        if (x < -18 or x > 33) and y + dd / 2 > 17.5 and y - dd / 2 < 26.5:
            continue
        before = len(g.bm.faces)
        g.box(x - w / 2, x + w / 2, y - dd / 2, y + dd / 2, -0.5, h, k("lointain", base), bevel=0, drop=("bottom",))
        axis = "x" if rng.random() < 0.5 else "y"
        t = math.tan(math.radians(33))
        if axis == "x":
            hr = h + dd / 2 * t
            for (ya, sg) in ((y - dd / 2 - 0.3, -1), (y + dd / 2 + 0.3, 1)):
                g.quad([(x - w / 2 - 0.2, ya, h - 0.2), (x + w / 2 + 0.2, ya, h - 0.2), (x + w / 2 + 0.2, y, hr), (x - w / 2 - 0.2, y, hr)],
                       k("lointain", ROOF), normal_hint=(0, sg, 1))
            for xx, sg in ((x - w / 2, -1), (x + w / 2, 1)):
                g.quad([(xx, y - dd / 2, h), (xx, y + dd / 2, h), (xx, y, hr)], k("lointain", base), normal_hint=(sg, 0, 0))
        else:
            hr = h + w / 2 * t
            for (xa, sg) in ((x - w / 2 - 0.3, -1), (x + w / 2 + 0.3, 1)):
                g.quad([(xa, y - dd / 2 - 0.2, h - 0.2), (xa, y + dd / 2 + 0.2, h - 0.2), (x, y + dd / 2 + 0.2, hr), (x, y - dd / 2 - 0.2, hr)],
                       k("lointain", ROOF), normal_hint=(sg, 0, 1))
            for yy, sg in ((y - dd / 2, -1), (y + dd / 2, 1)):
                g.quad([(x - w / 2, yy, h), (x + w / 2, yy, h), (x, yy, hr)], k("lointain", base), normal_hint=(0, sg, 0))
        _fenetres_lointain(g, x, y, w, dd, h, centre)
        _haze_faces(g, before, sun, haze)
        # quelques arbres de jardin entre les toits
        if i % 3 == 0:
            before = len(g.bm.faces)
            tx, ty = centre[0] + math.cos(a + 0.06) * (d - 6), centre[1] + math.sin(a + 0.06) * (d - 6)
            g.sphere(tx, ty, 5.0, 3.0, 3.0, 3.2, k("lointain", "#5F7F4A"), segs=8, rings=5, smooth=False)
            _haze_faces(g, before, sun, haze)
    # la route au-delà de la place (ouest et est), ses accotements, et les maisons qui la bordent, pignon ou façade sur rue
    for (xa, xb) in ((-52.0, -29.5), (39.5, 60.0)):
        before = len(g.bm.faces)
        g.quad([(xa, 19.36, -0.29), (xb, 19.36, -0.29), (xb, 24.4, -0.29), (xa, 24.4, -0.29)], k("lointain", "#7C766C"), normal_hint=(0, 0, 1))
        for (ya, yb) in ((17.0, 19.36), (24.4, 27.0)):
            g.quad([(xa, ya, -0.22), (xb, ya, -0.22), (xb, yb, -0.22), (xa, yb, -0.22)], k("lointain", "#8E8A6E"), normal_hint=(0, 0, 1))
        _haze_faces(g, before, sun, 0.2)
    for (x, y, w, dd, h, side, base) in ((-35.0, 13.2, 7.0, 6.5, 6.6, "s", "#C9B48E"), (-42.0, 14.0, 6.0, 7.0, 7.2, "s", STONE),
                                         (-38.5, 30.2, 8.0, 6.5, 6.2, "n", "#CDB89A"), (46.0, 14.2, 7.0, 6.0, 6.8, "s", "#CFB79A"),
                                         (52.0, 30.0, 7.0, 6.5, 6.4, "n", STONE)):
        before = len(g.bm.faces)
        g.box(x - w / 2, x + w / 2, y - dd / 2, y + dd / 2, -0.5, h, k("lointain", base), bevel=0, drop=("bottom",))
        hr = h + dd / 2 * math.tan(math.radians(33))
        for (ya, sg) in ((y - dd / 2 - 0.3, -1), (y + dd / 2 + 0.3, 1)):
            g.quad([(x - w / 2 - 0.2, ya, h - 0.2), (x + w / 2 + 0.2, ya, h - 0.2), (x + w / 2 + 0.2, y, hr), (x - w / 2 - 0.2, y, hr)],
                   k("lointain", ROOF), normal_hint=(0, sg, 1))
        for xx, sg in ((x - w / 2, -1), (x + w / 2, 1)):
            g.quad([(xx, y - dd / 2, h), (xx, y + dd / 2, h), (xx, y, hr)], k("lointain", base), normal_hint=(sg, 0, 0))
        _fenetres_lointain(g, x, y, w, dd, h, (x, 21.9))
        _haze_faces(g, before, sun, min(0.4, (abs(x - 7.5) - 30) / 50))
    # collines: deux anneaux de crêtes (coteau boisé proche, collines bleutées loin), bas sous le sol
    for (rad, hmin, hmax, col, haze, n) in ((54.0, 7.0, 16.0, "#5E7448", 0.35, 48), (64.0, 10.0, 22.0, "#71837A", 0.6, 40)):
        before = len(g.bm.faces)
        ph = rng.uniform(0, 10)
        ring_top = []
        for i in range(n + 1):
            a = 2 * math.pi * i / n
            hh = hmin + (hmax - hmin) * (0.5 + 0.35 * math.sin(a * 3 + ph) + 0.15 * math.sin(a * 7 + ph * 2))
            ring_top.append((centre[0] + math.cos(a) * rad, centre[1] + math.sin(a) * rad, hh))
        for i in range(n):
            a, b = ring_top[i], ring_top[i + 1]
            ia = (centre[0] + (a[0] - centre[0]) * 0.97, centre[1] + (a[1] - centre[1]) * 0.97, -2.0)
            ib = (centre[0] + (b[0] - centre[0]) * 0.97, centre[1] + (b[1] - centre[1]) * 0.97, -2.0)
            mx, my = (a[0] + b[0]) / 2 - centre[0], (a[1] + b[1]) / 2 - centre[1]
            g.quad([ia, ib, b, a], k("lointain", col), normal_hint=(-mx, -my, 0.3))
        _haze_faces(g, before, sun, haze)
    return g


def _fenetres_lointain(g, x, y, w, dd, h, centre):
    """Fenêtres et volets des maisons du lointain, sur les murs tournés vers la place (ou la route): sans elles, un mur
    d'enduit clair au soleil se lit comme une boîte blanche."""
    for (nx, ny, line, a, b) in ((1, 0, x + w / 2, y - dd / 2, y + dd / 2), (-1, 0, x - w / 2, y - dd / 2, y + dd / 2),
                                 (0, 1, y + dd / 2, x - w / 2, x + w / 2), (0, -1, y - dd / 2, x - w / 2, x + w / 2)):
        if nx * (centre[0] - x) + ny * (centre[1] - y) <= 0:
            continue
        bays = max(2, int((b - a) / 2.6))
        for fl in range(2 if h > 5.8 else 1):
            z0 = 1.0 + fl * 2.8
            for i in range(bays):
                u = a + (b - a) * (i + 0.5) / bays
                for (du, col) in ((0.0, "#3E4044"), (-0.78, "#6F8588"), (0.78, "#6F8588")):
                    hw = 0.42 if du == 0 else 0.34
                    u0, u1 = u + du - hw, u + du + hw
                    off = 0.03 if du == 0 else 0.04
                    if nx:
                        pts = [(line + nx * off, u0, z0), (line + nx * off, u1, z0), (line + nx * off, u1, z0 + 1.35), (line + nx * off, u0, z0 + 1.35)]
                    else:
                        pts = [(u0, line + ny * off, z0), (u1, line + ny * off, z0), (u1, line + ny * off, z0 + 1.35), (u0, line + ny * off, z0 + 1.35)]
                    g.quad(pts, k("lointain", col), normal_hint=(nx, ny, 0))


def _haze_faces(g, start, sun, haze):
    g.bm.faces.ensure_lookup_table()
    for f in g.bm.faces[start:]:
        key = g.keys[f.material_index]
        fam, tint = key.split("|")
        f.normal_update()
        f.material_index = g.mi(k("lointain", _shade(tint, f.normal, sun, haze)))


def ciel(radius=70.0, centre=(7.5, 14.0)):
    """Dôme du ciel (UV: azimut, hauteur), un peu sous l'horizon pour couvrir les jointures avec le lointain."""
    g = Geo("shell_village_sky")
    bm = g.bm
    na, ne = 32, 10
    els = [-12.0] + [90.0 * i / ne for i in range(ne)] + [90.0]
    rings = []
    for e in els[:-1]:
        er = math.radians(e)
        ring = []
        for i in range(na + 1):
            a = 2 * math.pi * i / na
            # azimut depuis le nord (-y du plan), sens horaire vu de dessus: x = sin a, y du plan = -cos a
            ring.append(bm.verts.new(P(centre[0] + radius * math.cos(er) * math.sin(a), centre[1] - radius * math.cos(er) * math.cos(a),
                                       radius * math.sin(er) - 4.0)))
        rings.append(ring)
    top = bm.verts.new(P(centre[0], centre[1], radius - 4.0))
    faces = []
    for r in range(len(rings) - 1):
        for i in range(na):
            faces.append(bm.faces.new([rings[r][i], rings[r][i + 1], rings[r + 1][i + 1], rings[r + 1][i]]))
    for i in range(na):
        faces.append(bm.faces.new([rings[-1][i], rings[-1][i + 1], top]))
    for f in faces:
        f.material_index = g.mi("ciel|#FFFFFF")
        f.smooth = True
    # normales vers l'intérieur (vu du dedans)
    for f in faces:
        f.normal_update()
        c = f.calc_center_median() - P(centre[0], centre[1], -4.0)
        if f.normal.dot(c) > 0:
            f.normal_flip()
    g.sky_meta = {"centre": centre, "radius": radius, "els": els, "na": na}
    return g
