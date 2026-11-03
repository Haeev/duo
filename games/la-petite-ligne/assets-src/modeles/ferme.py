"""Ferme et objets tenus de La Petite Ligne: cases du potager, cultures, récoltes, outils, poule.

Lancer: duo-python ferme.py
Produit: assets/modeles/ferme.glb, planches/ferme.png

Conventions propres à ce fichier:
- cases et cultures: origine au centre de la case (1 x 1 m), au sol; une culture se pose
  sur la case bêchée, à la même origine;
- petits objets (récoltes, sachets, matériaux): origine au centre de leur base, à l'échelle
  de jeu (un peu grossis pour rester lisibles en vue isométrique);
- outils: origine au point de prise, l'outil pend comme dans une main au repos
  (le jeu l'accroche au nœud socket_hand_r du squelette, sans transformation).
"""
import math
import os
import sys

import bpy  # noqa: I001
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cueillette  # noqa: E402
import lpl  # noqa: E402
from lpl import by_normal  # noqa: E402

RIDGES = (-0.29, 0.0, 0.29)
RIDGE_TOP = 0.10
SPOTS = [(-0.26, -0.29), (0.0, 0.0), (0.26, 0.29)]
CROP_COLORS = {"radish": "radish", "lettuce": "lettuce", "carrot": "carrot"}


# Potager -------------------------------------------------------------------

def garden_cell_grass(A):
    g = A.geo()
    g.box((0.98, 0.98, 0.025), color=by_normal("grass", "grass_dark"), base=True, bevel=0.01)
    for i, (x, y) in enumerate([(-0.3, -0.25), (0.28, -0.05), (-0.05, 0.3), (0.32, 0.33), (-0.34, 0.12)]):
        for k in range(3):
            a = math.radians(k * 120 + i * 37)
            g.cyl(0.022, 0.07 + 0.02 * (k % 2), loc=(x + 0.02 * math.cos(a), y + 0.02 * math.sin(a), 0.02),
                  color="grass_dark" if k % 2 else "moss", segs=4, r2=0.0, base=True, rot=(12 * math.cos(a), 12 * math.sin(a), 0))
    return g


def garden_cell_tilled(A, wet=False):
    g = A.geo()
    top, side = ("soil_wet_light", "soil_wet") if wet else ("soil_tilled_light", "soil_tilled")
    g.box((0.92, 0.92, 0.05), color=side, base=True, bevel=0.02)
    for y in RIDGES:
        g.prism([(-0.12, 0.0), (0.12, 0.0), (0.06, 0.055), (-0.06, 0.055)], 0.84, loc=(0, y, 0.045),
                color=by_normal(top, side, thr=0.8), rot=(0, 0, 90))
    for x, y in [(-0.2, -0.145), (0.18, 0.145), (0.3, -0.15)]:
        g.box((0.05, 0.018, 0.012), loc=(x, y, 0.047), color="soil_tilled_light" if not wet else "soil_wet",
              rot=(0, 0, 20))
    if wet:
        for x, y, s in [(-0.15, 0.145, 0.16), (0.22, -0.145, 0.12), (-0.33, -0.145, 0.08)]:
            g.cyl(s / 2, 0.004, loc=(x, y, 0.052), color="water", segs=8, scale=(1.0, 0.35, 1.0))
    return g


def stake(g, crop):
    g.box((0.02, 0.02, 0.22), loc=(0.38, -0.38, 0.0), color="wood", base=True)
    g.box((0.07, 0.012, 0.05), loc=(0.38, -0.392, 0.17), color="paper", rot=(0, 0, 0))
    g.box((0.05, 0.004, 0.03), loc=(0.38, -0.4, 0.17), color=CROP_COLORS[crop])


def leaf(g, base, length, width, yaw, pitch, color, thick=0.006):
    pts = [(0.0, 0.0), (length * 0.35, width / 2), (length, 0.0), (length * 0.35, -width / 2)]
    return g.prism(pts, thick, loc=base, color=color, rot=(90, -pitch, yaw))


def crop_model(A, crop, stage):
    g = A.geo()
    z = RIDGE_TOP - 0.008
    spots = [(0.0, 0.0)] if crop == "lettuce" else SPOTS
    if stage in ("seed", "sprout"):
        stake(g, crop)
    for si, (x, y) in enumerate(spots):
        rot0 = si * 47
        if stage == "seed":
            g.cyl(0.045, 0.012, loc=(x, y, z), color="soil_tilled", segs=7, scale=(1, 0.8, 1))
            for k in range(3):
                a = math.radians(rot0 + k * 120)
                g.box((0.014, 0.01, 0.01), loc=(x + 0.02 * math.cos(a), y + 0.02 * math.sin(a), z + 0.01),
                      color="seed", rot=(0, 0, rot0 + k * 50))
        elif stage == "sprout":
            g.cyl(0.006, 0.05, loc=(x, y, z), color="sprout", segs=4, base=True)
            n = 2 if crop != "carrot" else 3
            for k in range(n):
                leaf(g, (x, y, z + 0.045), 0.05, 0.03, rot0 + k * 360 / n, 25, "sprout")
        elif stage == "young":
            if crop == "radish":
                for k in range(4):
                    leaf(g, (x, y, z + 0.005), 0.11, 0.06, rot0 + k * 90, 35, "leaf_crop")
            elif crop == "carrot":
                for k in range(5):
                    leaf(g, (x, y, z + 0.005), 0.14, 0.025, rot0 + k * 72, 62, "leaf_carrot")
            else:
                for k in range(5):
                    leaf(g, (x, y, z + 0.005), 0.13, 0.09, rot0 + k * 72, 30, "lettuce")
                g.sphere(0.04, loc=(x, y, z + 0.03), color="lettuce_light", segs=6, rings=4)
        elif stage == "ripe":
            if crop == "radish":
                g.sphere(0.045, loc=(x, y, z + 0.02), color="radish", segs=8, rings=5, scale=(1, 1, 0.9))
                for k in range(6):
                    leaf(g, (x, y, z + 0.05), 0.17, 0.08, rot0 + k * 60, 40, "leaf_crop" if k % 2 else "leaf_crop_light")
            elif crop == "carrot":
                g.cyl(0.038, 0.035, loc=(x, y, z - 0.004), color="carrot", segs=8, base=True, r2=0.03)
                for k in range(7):
                    leaf(g, (x, y, z + 0.03), 0.24, 0.03, rot0 + k * 51, 66 - (k % 2) * 14, "leaf_carrot")
            else:
                g.sphere(0.13, loc=(x, y, z + 0.08), color="lettuce_light", segs=9, rings=6, scale=(1, 1, 0.8))
                for k in range(7):
                    leaf(g, (x, y, z + 0.02), 0.2, 0.17, rot0 + k * 51.4, 48, "lettuce", thick=0.01)
                for k in range(8):
                    leaf(g, (x, y, z + 0.01), 0.25, 0.17, rot0 + 22 + k * 45, 18, "leaf_crop", thick=0.01)
    return g


# Récoltes et cueillette -------------------------------------------------------

def item_radish(A):
    g = A.geo()
    g.sphere(0.05, loc=(0, 0, 0.05), color="radish", segs=8, rings=6, scale=(1, 1, 0.95))
    g.cyl(0.012, 0.06, loc=(0, 0, 0.0), color="radish_tip", segs=5, r2=0.002, rot=(180, 0, 0), base=False)
    for k in range(3):
        leaf(g, (0, 0, 0.09), 0.13, 0.06, k * 120, 60, "leaf_crop")
    return g


def item_carrot(A):
    g = A.geo()
    g.cyl(0.035, 0.24, loc=(0.0, 0, 0.035), color="carrot", segs=8, r2=0.006, rot=(0, 90, 0))
    for k in range(4):
        leaf(g, (-0.12, 0, 0.035), 0.12, 0.03, 180 + (k - 1.5) * 18, 20, "leaf_carrot")
    return g


def item_lettuce(A):
    g = A.geo()
    g.sphere(0.1, loc=(0, 0, 0.09), color="lettuce_light", segs=9, rings=6, scale=(1, 1, 0.85))
    for k in range(7):
        leaf(g, (0, 0, 0.02), 0.15, 0.14, k * 51.4, 55, "lettuce", thick=0.01)
    return g


def item_egg(A):
    g = A.geo()
    g.sphere(0.035, loc=(0, 0, 0.043), color="egg", segs=8, rings=6, scale=(1, 1, 1.25))
    return g


def dandelion(A):
    g = A.geo()
    for k in range(7):
        leaf(g, (0, 0, 0.005), 0.14, 0.045, k * 51.4, 14, "leaf_bush" if k % 2 else "leaf_hazel")
    for h, dx, open_ in ((0.17, 0.02, True), (0.12, -0.04, False)):
        g.cyl(0.005, h, loc=(dx, 0.01, 0.0), color="leaf_crop", segs=4, base=True)
        if open_:
            g.cyl(0.035, 0.02, loc=(dx, 0.01, h), color="flower_yellow", segs=10, r2=0.028)
            g.cyl(0.015, 0.008, loc=(dx, 0.01, h + 0.012), color="flower_center", segs=6)
        else:
            g.sphere(0.018, loc=(dx, 0.01, h + 0.01), color="leaf_crop", segs=6, rings=4, scale=(1, 1, 1.3))
    return g


def seed_packet(A, crop):
    g = A.geo()
    g.box((0.11, 0.018, 0.15), color="paper", base=True, bevel=0.004)
    g.box((0.112, 0.02, 0.035), loc=(0, 0, 0.115), color=CROP_COLORS[crop], base=True)
    g.box((0.112, 0.02, 0.012), loc=(0, 0, 0.0), color="paper_dark", base=True)
    pic = {"radish": "radish", "lettuce": "lettuce", "carrot": "carrot"}[crop]
    g.cyl(0.03, 0.004, loc=(0, -0.011, 0.065), color=pic, segs=10, rot=(90, 0, 0))
    g.box((0.01, 0.004, 0.025), loc=(0, -0.012, 0.1), color="leaf_crop", rot=(0, 0, 0))
    return g


# Outils (origine = prise) -------------------------------------------------------

def tool_hoe(A):
    g = A.geo()
    g.cyl(0.018, 1.25, loc=(0, 0, 0.25 - 0.625), color="wood", segs=6)
    g.cyl(0.024, 0.06, loc=(0, 0, -0.95), color="iron", segs=6)
    g.box((0.03, 0.08, 0.025), loc=(0, 0.04, -0.965), color="iron")
    g.box((0.17, 0.11, 0.012), loc=(0, 0.11, -0.985), color=by_normal("iron_light", "iron"), rot=(-12, 0, 0),
          bevel=0.003)
    return g


def tool_watering_can(A):
    g = A.geo()
    g.cyl(0.11, 0.20, loc=(0, 0.02, -0.32), color="tin_paint", segs=10, base=True)
    g.cyl(0.113, 0.02, loc=(0, 0.02, -0.32), color="tin", segs=10, base=True)
    g.cyl(0.113, 0.02, loc=(0, 0.02, -0.14), color="tin", segs=10, base=True)
    g.cyl(0.05, 0.02, loc=(0, 0.06, -0.12), color="tin", segs=8, base=True)
    g.box((0.025, 0.16, 0.022), loc=(0, 0.02, 0.0), color="tin_paint")
    for y in (-0.06, 0.1):
        g.box((0.022, 0.022, 0.14), loc=(0, y, -0.07), color="tin_paint")
    # bec qui monte du bas du corps vers l'avant, pomme au bout (tour 9: il pendait vers le bas, pomme en l'air)
    g.cyl(0.016, 0.3, loc=(0, -0.17, -0.22), color="tin_paint", segs=6, r2=0.012, rot=(50, 0, 0))
    g.cyl(0.018, 0.04, loc=(0, -0.29, -0.12), color="tin", segs=7, r2=0.04, rot=(50, 0, 0))
    return g


def tool_axe(A):
    g = A.geo()
    g.cyl(0.02, 0.72, loc=(0, 0, 0.08 - 0.36), color="wood", segs=6, r2=0.017)
    g.box((0.035, 0.11, 0.08), loc=(0, -0.02, -0.6), color="iron", bevel=0.005)
    g.box((0.03, 0.06, 0.12), loc=(0, -0.09, -0.6), color="iron", taper=(0.6, 1.0))
    g.box((0.012, 0.012, 0.13), loc=(0, -0.122, -0.6), color="iron_light")
    return g


def tool_saw(A):
    g = A.geo()
    g.box((0.03, 0.11, 0.13), loc=(0, 0.0, -0.02), color="wood", bevel=0.012)
    g.box((0.034, 0.05, 0.06), loc=(0, 0.0, -0.01), color="wood_dark")
    g.prism([(-0.065, -0.07), (0.055, -0.07), (0.03, -0.6), (-0.035, -0.6)], 0.004, loc=(0, 0, 0),
            color="tin", rot=(0, 0, 90))
    for k in range(9):
        z = -0.1 - k * 0.055
        g.box((0.004, 0.012, 0.012), loc=(0, -0.066 + k * 0.003, z), color="iron", rot=(45, 0, 0))
    return g


def tool_hammer(A):
    g = A.geo()
    g.cyl(0.015, 0.36, loc=(0, 0, 0.05 - 0.18), color="wood", segs=6)
    g.box((0.04, 0.13, 0.04), loc=(0, -0.01, -0.31), color="iron", bevel=0.006)
    g.cyl(0.024, 0.02, loc=(0, -0.08, -0.31), color="iron_light", segs=8, rot=(90, 0, 0))
    return g


def tool_fishing_rod(A):
    g = A.geo()
    a = math.radians(42)
    L = 2.0
    d = Vector((0, -math.cos(a), math.sin(a)))
    g.cyl(0.02, 0.32, loc=tuple(d * 0.05), color="cobble_dark", segs=6, rot=(90 - 42, 0, 0))
    mid = d * (L / 2)
    g.cyl(0.012, L, loc=tuple(mid), color="wood_new", segs=5, r2=0.004, rot=(90 - 42, 0, 0))
    g.cyl(0.03, 0.025, loc=(0.03, -0.06, -0.02), color="iron", segs=8, rot=(0, 90, 0))
    tip = d * L
    g.cyl(0.008, 0.03, loc=tuple(tip), color="iron", segs=5)
    # la ligne et le bouchon sont dessinés par le jeu (du nœud fishing_rod_tip au bouchon fishing_float)
    return g


# Outils de la Halte (tour 9, catalogue, rayon Outillage): même prise, même pente et même bout que l'outil de
# départ (les clips et ROD_TIP du rendu restent justes), une autre matière et un geste qui se devine.

def tool_watering_can_copper(A):
    """Arrosoir de cuivre de 20 litres (deux fois l'arrosoir peint): plus haut et plus large, cerclé de laiton,
    pomme d'arrosage en cuivre clair. L'anse reste à l'origine (point de prise), le bec part devant (-Y)."""
    g = A.geo()
    # corps en tonneau à 10 pans: 0,26 m de haut, 0,125 m de rayon au ventre (0,11 et 0,20 pour l'ancien)
    g.lathe([(0.112, -0.42), (0.126, -0.33), (0.12, -0.2), (0.1, -0.165)], colors="copper", segs=10, phase=18)
    for z in (-0.405, -0.19):
        g.cyl(0.124 if z < -0.3 else 0.116, 0.018, loc=(0, 0, z), color="brass", segs=10)
    g.cyl(0.05, 0.03, loc=(0, 0.05, -0.15), color="copper_light", segs=8, base=True)
    # anse en arceau du goulot à l'arrière: tenue à l'origine, deux montants posés sur le dessus
    g.box((0.026, 0.19, 0.024), loc=(0, 0.02, 0.0), color="copper", bevel=0.006)
    for y in (-0.065, 0.105):
        g.box((0.024, 0.024, 0.165), loc=(0, y, -0.085), color="copper")
    # bec long (le cuivre se martèle) et pomme large: on arrose plus loin
    g.cyl(0.018, 0.36, loc=(0, -0.215, -0.265), color="copper", segs=6, r2=0.012, rot=(45, 0, 0))
    g.cyl(0.02, 0.05, loc=(0, -0.352, -0.128), color="copper_light", segs=8, r2=0.05, rot=(45, 0, 0))
    return g


def tool_axe_forged(A):
    """Hache de la forge: manche de frêne foncé en légère courbe, garde de cuir sous la tête, tête d'acier bleui
    plus longue que la hache de départ, tranchant affûté clair (on voit qu'il coupe). Même prise et même tête."""
    g = A.geo()
    g.cyl(0.021, 0.74, loc=(0, 0.004, 0.08 - 0.37), color="wood_dark", segs=6, r2=0.017, rot=(1.5, 0, 0))
    g.cyl(0.024, 0.09, loc=(0, 0.002, 0.03), color="leather", segs=6)
    g.cyl(0.023, 0.05, loc=(0, 0.006, -0.52), color="leather", segs=6)
    # douille et joue de la tête, biseau en éventail vers le tranchant
    g.box((0.044, 0.1, 0.09), loc=(0, -0.01, -0.6), color="steel_forged", bevel=0.008)
    # lame qui s'évase de l'oeil (9 cm) au tranchant (17 cm), en arc
    blade = [(0.0, -0.04), (-0.07, -0.06), (-0.115, -0.085), (-0.13, -0.05), (-0.135, 0.0), (-0.13, 0.05),
             (-0.115, 0.085), (-0.07, 0.06), (0.0, 0.04)]
    g.prism(blade, 0.024, loc=(0, -0.05, -0.6), color="steel_forged", rot=(0, 0, 90))
    g.prism([(-0.128, -0.082), (-0.142, -0.05), (-0.147, 0.0), (-0.142, 0.05), (-0.128, 0.082), (-0.122, 0.0)],
            0.012, loc=(0, -0.05, -0.6), color="iron_light", rot=(0, 0, 90))
    g.box((0.034, 0.05, 0.06), loc=(0, 0.06, -0.6), color="steel_forged", bevel=0.006)
    return g


def tool_fishing_rod_bamboo(A):
    """Canne en bambou refendu: même pente (42 degrés) et même longueur (2 m) que la canne de départ, donc le
    même bout de ligne (fishing_rod_bamboo_tip = fishing_rod_tip). Bambou clair à nœuds sombres, poignée de
    liège, quatre ligatures rouges (les fils qui tiennent les brins collés), moulinet de laiton."""
    g = A.geo()
    a = math.radians(42)
    L = 2.0
    d = Vector((0, -math.cos(a), math.sin(a)))
    rot = (90 - 42, 0, 0)
    g.cyl(0.021, 0.3, loc=tuple(d * 0.04), color="straw_dark", segs=6, rot=rot)
    g.cyl(0.024, 0.03, loc=tuple(d * 0.2), color="brass", segs=6, rot=rot)
    g.cyl(0.013, L - 0.2, loc=tuple(d * (0.2 + (L - 0.2) / 2)), color="bamboo", segs=6, r2=0.005, rot=rot)
    for k, t in enumerate((0.42, 0.72, 1.02, 1.32, 1.6, 1.84)):
        r = 0.013 - (0.008 * (t - 0.2) / (L - 0.2))
        g.cyl(r + 0.0035, 0.018, loc=tuple(d * t), color="bamboo_node", segs=6, rot=rot)
    for t in (0.58, 0.88, 1.18, 1.48):
        r = 0.013 - (0.008 * (t - 0.2) / (L - 0.2))
        g.cyl(r + 0.003, 0.03, loc=tuple(d * t), color="paint_red", segs=6, rot=rot)
    g.cyl(0.034, 0.024, loc=(0.03, -0.06, -0.02), color="brass", segs=8, rot=(0, 90, 0))
    g.box((0.03, 0.012, 0.012), loc=(0.055, -0.06, -0.02), color="wood_dark")
    tip = d * L
    g.cyl(0.008, 0.03, loc=tuple(tip), color="brass", segs=5)
    return g


def lamp_pole(A):
    """Perche d'allumeur de réverbères (moment des lanternes du quai): 2,2 m de frêne, crochet de laiton pour
    ouvrir la porte de la lanterne et porte-mèche au bout. Portée en main (socket_hand_r): prise à l'origine,
    perche à l'horizontale vers l'avant au repos du bras (bout à 1,2 m devant la main, talon à 1,0 m derrière),
    comme on porte une perche le long du corps. pole_raise la dresse devant la poitrine puis l'incline de 20
    degrés vers l'avant jusqu'à la lanterne (bout à 2,8 m, 0,9 m devant le personnage; flamme du lampadaire à
    2,75 m); la flamme et le halo sont au technical artist (nœud lamp_pole_tip)."""
    g = A.geo()
    g.cyl(0.018, 2.12, loc=(0, 0, 0.06), color="wood", segs=6, r2=0.014)
    g.cyl(0.021, 0.05, loc=(0, 0, -0.98), color="iron", segs=6)
    g.cyl(0.02, 0.2, loc=(0, 0, 0.0), color="leather", segs=6)
    # virole et crochet: tige qui part du bout, se recourbe vers l'avant (-Y) puis redescend
    g.cyl(0.02, 0.06, loc=(0, 0, 1.13), color="brass", segs=6)
    g.cyl(0.006, 0.12, loc=(0, -0.03, 1.2), color="brass", segs=5, rot=(-30, 0, 0))
    g.cyl(0.006, 0.07, loc=(0, -0.075, 1.24), color="brass", segs=5, rot=(90, 0, 0))
    g.cyl(0.006, 0.05, loc=(0, -0.11, 1.22), color="brass", segs=5)
    # porte-mèche: petit tube droit dans l'axe, mèche de coton au-dessus
    g.cyl(0.012, 0.05, loc=(0, 0, 1.185), color="brass", segs=6)
    g.cyl(0.006, 0.02, loc=(0, 0, 1.22), color="rope", segs=5)
    # construite dressée (+Z), couchée vers l'avant (-Y): le crochet regarde vers le bas au repos, vers la
    # lanterne une fois la perche levée
    g.transform(list(g.bm.verts), Matrix.Rotation(math.radians(90), 4, "X"))
    return g


def hen_crate(A):
    """Cage de transport d'une poule (livrée par le train, posée devant le poulailler): 0,62 x 0,44 m et 0,5 m de
    haut, fond et toit de planches, barreaux de noisetier sur les quatre faces (la poule se voit dedans: place
    intérieure de 0,54 x 0,36 x 0,40 m pour une poule de 0,42 m tête baissée), porte coulissante à l'avant (-Y),
    poignée de corde sur le toit, étiquette de la coopérative. Origine au sol, au centre."""
    g = A.geo()
    W, D, H = 0.62, 0.44, 0.5
    g.box((W, D, 0.04), color="wood", base=True, bevel=0.01)
    g.box((W + 0.02, D + 0.02, 0.035), loc=(0, 0, H - 0.035), color="wood_new", base=True, bevel=0.01)
    for sx in (1, -1):
        for sy in (1, -1):
            g.box((0.04, 0.04, H - 0.075), loc=(sx * (W / 2 - 0.02), sy * (D / 2 - 0.02), 0.04), color="wood_dark",
                  base=True)
    # barreaux ronds, du fond au toit: 6 en façade et à l'arrière, 4 sur les côtés
    for k in range(6):
        x = -W / 2 + 0.07 + k * (W - 0.14) / 5
        for y in (-D / 2 + 0.02, D / 2 - 0.02):
            if y < 0 and k in (2, 3):
                continue
            g.cyl(0.008, H - 0.075, loc=(x, y, 0.04), color="wood_new", segs=5, base=True)
    for k in range(4):
        y = -D / 2 + 0.07 + k * (D - 0.14) / 3
        for x in (-W / 2 + 0.02, W / 2 - 0.02):
            g.cyl(0.008, H - 0.075, loc=(x, y, 0.04), color="wood_new", segs=5, base=True)
    # porte coulissante (deux barreaux sur une traverse), glissée dans ses guides
    for x in (-0.04, 0.04):
        g.cyl(0.008, 0.36, loc=(x, -D / 2 - 0.004, 0.04), color="wood_new", segs=5, base=True)
    g.box((0.16, 0.016, 0.03), loc=(0, -D / 2 - 0.004, 0.4), color="wood")
    for x in (-0.09, 0.09):
        g.box((0.016, 0.02, 0.425), loc=(x, -D / 2 - 0.006, 0.04), color="wood_dark", base=True)
    # poignée de corde et étiquette
    for x in (-0.12, 0.12):
        g.cyl(0.01, 0.06, loc=(x, 0, H + 0.03), color="rope", segs=5)
    g.cyl(0.01, 0.24, loc=(0, 0, H + 0.06), color="rope", segs=5, rot=(0, 90, 0))
    g.box((0.12, 0.006, 0.07), loc=(0.17, -D / 2 - 0.02, 0.25), color="paper", rot=(0, 4, 0))
    g.box((0.07, 0.008, 0.012), loc=(0.17, -D / 2 - 0.022, 0.265), color="paint_green")
    return g


def fishing_float(A):
    g = A.geo()
    g.sphere(0.03, loc=(0, 0, 0.0), color="flower_red", segs=8, rings=5, scale=(1, 1, 0.9))
    g.cyl(0.031, 0.012, loc=(0, 0, 0.006), color="white_paint", segs=8)
    g.cyl(0.004, 0.06, loc=(0, 0, 0.02), color="white_paint", segs=4, base=True)
    return g


# Matériaux ------------------------------------------------------------------

def item_log(A, length=0.8, r=0.14):
    g = A.geo()
    g.cyl(r, length, loc=(0, 0, r), color="bark", segs=8, rot=(0, 90, 0), bevel=0.01)
    for s in (1, -1):
        g.cyl(r * 0.82, 0.012, loc=(s * length / 2, 0, r), color="log_end", segs=8, rot=(0, 90, 0))
        g.cyl(r * 0.45, 0.016, loc=(s * length / 2, 0, r), color="log_ring", segs=8, rot=(0, 90, 0))
    g.box((0.08, 0.05, 0.05), loc=(0.12, -r * 0.8, r * 1.4), color="bark_dark", rot=(0, 0, 0))
    return g


def item_plank(A):
    g = A.geo()
    g.box((1.0, 0.18, 0.03), color="wood_new", base=True, bevel=0.006)
    for x in (-0.25, 0.18):
        g.box((0.3, 0.006, 0.002), loc=(x, -0.03, 0.03), color="wood")
    return g


def item_beam(A):
    g = A.geo()
    g.box((0.16, 4.5, 0.16), color="wood", base=True, bevel=0.015)
    for s in (1, -1):
        g.box((0.13, 0.006, 0.13), loc=(0, s * 2.25, 0.08), color="log_end")
    for y in (-1.2, 0.4, 1.6):
        g.box((0.004, 0.5, 0.004), loc=(0.081, y, 0.1), color="wood_dark")
    return g


def item_ridge_purlin(A):
    """Panne faîtière de chêne équarrie, 16 x 20 cm, 4,9 m, tenons aux deux bouts (ferme et poinçon du pignon)."""
    g = A.geo()
    g.box((0.16, 4.9, 0.2), color="wood", base=True, bevel=0.015)
    for s in (1, -1):
        g.box((0.14, 0.006, 0.18), loc=(0, s * 2.45, 0.1), color="log_end")
        g.box((0.06, 0.1, 0.12), loc=(0, s * 2.5, 0.1), color="wood")
    for y in (-1.6, -0.2, 1.1, 2.0):
        g.box((0.004, 0.6, 0.004), loc=(0.081, y, 0.12), color="wood_dark")
    return g


def item_nail_box(A):
    g = A.geo()
    g.box((0.14, 0.09, 0.05), color="wood_new", base=True, bevel=0.004)
    g.box((0.12, 0.07, 0.01), loc=(0, 0, 0.042), color="shadow", base=True)
    for k in range(9):
        x, y = -0.045 + (k % 3) * 0.045, -0.02 + (k // 3) * 0.02
        g.cyl(0.004, 0.035, loc=(x, y, 0.045), color="iron_light", segs=4, base=True, rot=(8 * (k % 2), 10, 0))
        g.cyl(0.009, 0.004, loc=(x, y, 0.08), color="iron_light", segs=6)
    g.box((0.07, 0.003, 0.025), loc=(0, -0.046, 0.025), color="paper")
    return g


# Poule ---------------------------------------------------------------------

HEN_BONES = [("hen_root", (0, 0, 0), (0, 0, 0.08), None),
             ("hen_body", (0, 0.03, 0.17), (0, -0.07, 0.24), "hen_root"),
             ("hen_head", (0, -0.08, 0.26), (0, -0.1, 0.38), "hen_body"),
             ("hen_leg_l", (0.045, 0.01, 0.15), (0.045, 0.01, 0.0), "hen_root"),
             ("hen_leg_r", (-0.045, 0.01, 0.15), (-0.045, 0.01, 0.0), "hen_root")]


def hen_rig():
    ad = bpy.data.armatures.new("hen")
    arm = bpy.data.objects.new("hen", ad)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    for name, h, t, par in HEN_BONES:
        eb = ad.edit_bones.new(name)
        eb.head, eb.tail = h, t
        if par:
            eb.parent = ad.edit_bones[par]
        eb.align_roll(Vector((0, 0, 1)) if name == "hen_body" else Vector((0, -1, 0)))
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"
    return arm


def hen_mesh(A, body):
    g = A.geo()
    dark = {"chicken_white": "chicken_white", "chicken_russet": "bark", "chicken_black": "chicken_black"}[body]
    g.sphere(0.13, loc=(0, 0.02, 0.21), color=body, segs=9, rings=6, scale=(0.85, 1.25, 0.9), bone="hen_body")
    # queue en éventail: trois plumes facettées un peu relevées
    for a in (-25, 0, 25):
        g.sphere(1.0, loc=(math.sin(math.radians(a)) * 0.03, 0.16, 0.29), color=dark, segs=5, rings=3,
                 scale=(0.014, 0.045, 0.08), rot=(-35, a, 0), bone="hen_body")
    for s in (1, -1):
        g.sphere(0.08, loc=(s * 0.1, 0.03, 0.22), color=dark if body != "chicken_white" else "egg", segs=7, rings=4,
                 scale=(0.35, 1.2, 0.75), bone="hen_body")
    g.sphere(0.055, loc=(0, -0.1, 0.33), color=body, segs=8, rings=5, scale=(0.9, 1.0, 1.1), bone="hen_head")
    g.cyl(0.045, 0.1, loc=(0, -0.085, 0.27), color=body, segs=7, r2=0.04, bone="hen_head")
    g.prism([(-0.03, 0.0), (0.035, 0.0), (0.03, 0.035), (0.01, 0.025), (-0.005, 0.04), (-0.02, 0.025)], 0.014,
            loc=(0, -0.11, 0.375), color="comb_red", rot=(0, 0, 90), bone="hen_head")
    g.box((0.012, 0.018, 0.03), loc=(0, -0.152, 0.30), color="comb_red", bone="hen_head")
    g.cyl(0.014, 0.04, loc=(0, -0.165, 0.33), color="beak", segs=5, r2=0.002, rot=(90, 0, 0), bone="hen_head")
    for s in (1, -1):
        g.box((0.004, 0.012, 0.012), loc=(s * 0.048, -0.125, 0.345), color="black", bone="hen_head")
        side = "hen_leg_l" if s > 0 else "hen_leg_r"
        g.cyl(0.009, 0.13, loc=(s * 0.045, 0.01, 0.075), color="beak", segs=5, bone=side)
        for a in (-30, 0, 30):
            g.box((0.01, 0.055, 0.008), loc=(s * 0.045 + math.sin(math.radians(a)) * 0.02,
                                             0.01 - math.cos(math.radians(a)) * 0.025, 0.004),
                  color="beak", rot=(0, 0, a), bone=side)
    return g


# Robes de la 0.12 (v0-12-conception.md 4.2): dorée, cendrée, coucou (rayée), le coq doré et le poussin.
# Même squelette et mêmes clips que les trois robes d'origine; une seule robe visible à la fois.
HEN_VARIANTS = [("hen_white", "chicken_white"), ("hen_red", "chicken_russet"), ("hen_black", "chicken_black"),
                ("hen_golden", "golden"), ("hen_ash", "ash"), ("hen_cuckoo", "cuckoo"), ("hen_rooster", "rooster"),
                ("hen_chick", "chick")]
CHICK_SCALE = 0.4   # le poussin est modelé à la taille de la poule (mêmes pivots), à poser à l'échelle 0,4


def _bands(zc, rz, rings, a, b):
    """Rayures de la poule coucou: une couleur par rang de facettes (rangs de même latitude), en alternance."""
    def f(face):
        z = face.calc_center_median().z
        lat = math.acos(max(-1.0, min(1.0, (z - zc) / rz)))
        return a if int(lat / (math.pi / rings)) % 2 == 0 else b
    return f


def hen_robe(A, robe):
    """Poules dorée, cendrée et coucou: la silhouette de hen_mesh, couleurs propres (rayures pour la coucou)."""
    g = A.geo()
    body, wing, tail, neck = {"golden": ("leaf_litter", "copper", "copper", "leaf_litter"),
                              "ash": ("lauze_light", "lauze", "lauze_dark", "lauze_light"),
                              "cuckoo": (None, None, "heron_grey_dark", "heron_grey")}[robe]
    barred = robe == "cuckoo"
    if barred:
        g.sphere(0.13, loc=(0, 0.02, 0.21), color=_bands(0.21, 0.117, 7, "heron_grey", "feather_white"), segs=9,
                 rings=7, scale=(0.85, 1.25, 0.9), bone="hen_body")
    else:
        g.sphere(0.13, loc=(0, 0.02, 0.21), color=body, segs=9, rings=6, scale=(0.85, 1.25, 0.9), bone="hen_body")
    for a in (-25, 0, 25):
        g.sphere(1.0, loc=(math.sin(math.radians(a)) * 0.03, 0.16, 0.29), color=tail, segs=4 if barred else 5,
                 rings=3, scale=(0.014, 0.045, 0.08), rot=(-35, a, 0), bone="hen_body")
    for s in (1, -1):
        wc = _bands(0.22, 0.06, 4, "feather_white", "heron_grey") if barred else wing
        g.sphere(0.08, loc=(s * 0.1, 0.03, 0.22), color=wc, segs=7, rings=4, scale=(0.35, 1.2, 0.75), bone="hen_body")
    head = _bands(0.33, 0.0605, 5, "heron_grey", "feather_white") if barred else neck
    g.sphere(0.055, loc=(0, -0.1, 0.33), color=head, segs=7 if barred else 8, rings=5, scale=(0.9, 1.0, 1.1), bone="hen_head")
    g.cyl(0.045, 0.1, loc=(0, -0.085, 0.27), color=neck, segs=7, r2=0.04, bone="hen_head")
    _hen_face_and_legs(g)
    return g


def _hen_face_and_legs(g, comb=None, wattle=(0.012, 0.018, 0.03), head_z=0.0):
    g.prism(comb or [(-0.03, 0.0), (0.035, 0.0), (0.03, 0.035), (0.01, 0.025), (-0.005, 0.04), (-0.02, 0.025)],
            0.014, loc=(0, -0.11, 0.375 + head_z), color="comb_red", rot=(0, 0, 90), bone="hen_head")
    g.box(wattle, loc=(0, -0.152, 0.30 + head_z - (wattle[2] - 0.03) / 2), color="comb_red", bone="hen_head")
    g.cyl(0.014, 0.04, loc=(0, -0.165, 0.33 + head_z), color="beak", segs=5, r2=0.002, rot=(90, 0, 0), bone="hen_head")
    for s in (1, -1):
        g.box((0.004, 0.012, 0.012), loc=(s * 0.048, -0.125, 0.345 + head_z), color="black", bone="hen_head")
        side = "hen_leg_l" if s > 0 else "hen_leg_r"
        g.cyl(0.009, 0.13, loc=(s * 0.045, 0.01, 0.075), color="beak", segs=5, bone=side)
        for a in (-30, 0, 30):
            g.box((0.01, 0.055, 0.008), loc=(s * 0.045 + math.sin(math.radians(a)) * 0.02,
                                             0.01 - math.cos(math.radians(a)) * 0.025, 0.004),
                  color="beak", rot=(0, 0, a), bone=side)


def _sickle(g, p0, p1, p2, p3, w0, w1, color, yaw, x, ts=(0.0, 0.33, 0.66, 1.0)):
    """Faucille de la queue du coq: plume plate courbe (Bézier dans le plan de profil), épaisse de 1,2 cm."""
    def bez(t):
        u = 1 - t
        return tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))
    cs = [bez(t) for t in ts]
    last = len(ts) - 1
    out, inn = [], []
    for i, t in enumerate(ts):
        a = cs[max(i - 1, 0)]
        b = cs[min(i + 1, last)]
        dx, dz = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dz) or 1.0
        nx, nz = -dz / n, dx / n
        w = (w0 + (w1 - w0) * t) / 2
        out.append((cs[i][0] + nx * w, cs[i][1] + nz * w))
        inn.append((cs[i][0] - nx * w, cs[i][1] - nz * w))
    g.prism(out + list(reversed(inn)), 0.012, loc=(x, 0, 0), color=color, rot=(0, 0, 90 + yaw), bone="hen_body")


def hen_rooster_mesh(A):
    """Coq doré (plafonds relevés de la bible: plus rond que la poule, 700 triangles; un seul coq): plus grand que la poule (0,52 m à la pointe de la queue, crête à 0,47 m), camail doré, dos
    rouge, poitrail noir, queue en faucilles noir bleuté, grande crête et barbillons; mêmes os que la poule."""
    g = A.geo()

    def body(face):
        n = face.normal
        if n.y < -0.35 and n.z < 0.45:
            return "fox_black"       # poitrail
        if n.z > 0.55:
            return "fox_red"         # dos et lancettes
        return "fox_red_dark"
    g.sphere(0.14, loc=(0, 0.02, 0.225), color=body, segs=11, rings=7, scale=(0.85, 1.2, 0.95), bone="hen_body")
    for s in (1, -1):
        g.sphere(0.085, loc=(s * 0.108, 0.04, 0.235), color="fox_red_dark", segs=7, rings=5, scale=(0.35, 1.2, 0.75),
                 bone="hen_body")
    # faucilles: la grande au milieu, deux plus courtes écartées
    # plumes larges (5 à 8 cm à la base): fines, elles se lisaient comme des tiges
    _sickle(g, (0.11, 0.27), (0.14, 0.53), (0.31, 0.53), (0.33, 0.33), 0.085, 0.03, "jay_stripe", 0, 0.0)
    for s in (1, -1):
        _sickle(g, (0.1, 0.26), (0.12, 0.45), (0.26, 0.45), (0.28, 0.29), 0.075, 0.025, "fox_black", s * 16,
                s * 0.025)
        # lancettes de la selle: deux petites faucilles dorées qui retombent sur la queue
        _sickle(g, (0.07, 0.31), (0.12, 0.40), (0.2, 0.39), (0.22, 0.3), 0.05, 0.015, "leaf_litter", s * 28,
                s * 0.035)
    g.sphere(0.06, loc=(0, -0.105, 0.36), color="leaf_litter", segs=9, rings=6, scale=(0.9, 1.0, 1.1), bone="hen_head")
    g.cyl(0.056, 0.125, loc=(0, -0.088, 0.285), color="leaf_litter", segs=7, r2=0.042, bone="hen_head")
    comb = [(-0.04, 0.0), (0.045, 0.0), (0.045, 0.04), (0.03, 0.03), (0.02, 0.062), (0.005, 0.038), (-0.008, 0.066),
            (-0.022, 0.036), (-0.035, 0.05)]
    _hen_face_and_legs(g, comb=comb, wattle=(0.016, 0.022, 0.055), head_z=0.03)
    return g


def hen_chick_mesh(A):
    """Poussin (0,12 m une fois posé à CHICK_SCALE): boule de duvet jaune, tête ronde, bec orangé; modelé à la
    taille de la poule pour garder les pivots de son squelette (peck, walk et idle lui vont tels quels)."""
    g = A.geo()
    g.sphere(0.105, loc=(0, 0.02, 0.17), color="tit_yellow", segs=8, rings=5, scale=(0.95, 1.1, 0.92), bone="hen_body")
    for s in (1, -1):
        g.sphere(0.05, loc=(s * 0.09, 0.04, 0.18), color="flower_yellow", segs=6, rings=3, scale=(0.35, 1.0, 0.6),
                 bone="hen_body")
    g.sphere(0.078, loc=(0, -0.085, 0.29), color="tit_yellow", segs=7, rings=4, bone="hen_head")
    g.cyl(0.022, 0.05, loc=(0, -0.175, 0.29), color="goose_bill", segs=5, r2=0.003, rot=(90, 0, 0), bone="hen_head")
    for s in (1, -1):
        g.box((0.012, 0.016, 0.022), loc=(s * 0.058, -0.14, 0.31), color="black", bone="hen_head")
        side = "hen_leg_l" if s > 0 else "hen_leg_r"
        g.cyl(0.014, 0.09, loc=(s * 0.045, 0.01, 0.045), color="goose_bill", segs=5, bone=side)
        g.box((0.04, 0.06, 0.014), loc=(s * 0.045, -0.015, 0.007), color="goose_bill", bone=side)
    return g


def hen_actions(arm):
    from bpy_extras import anim_utils
    arm.animation_data_create()
    names = [b[0] for b in HEN_BONES]
    clips = {
        "hen_idle": {0: {}, 20: {"hen_head": (0, 0, 25)}, 34: {"hen_head": (0, 0, 25)},
                     50: {"hen_head": (-10, 0, -20), "hen_body": (3, 0, 0)}, 70: {}},
        "hen_walk": {0: {"hen_leg_l": (28, 0, 0), "hen_leg_r": (-28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0},
                     4: {"hen_leg_l": (0, 0, 0), "hen_leg_r": (0, 0, 0), "hen_head": (8, 0, 0), "loc": 0.012},
                     8: {"hen_leg_l": (-28, 0, 0), "hen_leg_r": (28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0},
                     12: {"hen_leg_l": (0, 0, 0), "hen_leg_r": (0, 0, 0), "hen_head": (8, 0, 0), "loc": 0.012},
                     16: {"hen_leg_l": (28, 0, 0), "hen_leg_r": (-28, 0, 0), "hen_head": (-12, 0, 0), "loc": 0.0}},
        "hen_peck": {0: {}, 8: {"hen_body": (-30, 0, 0), "hen_head": (60, 0, 0)},
                     11: {"hen_body": (-34, 0, 0), "hen_head": (70, 0, 0)},
                     15: {"hen_body": (-28, 0, 0), "hen_head": (50, 0, 0)},
                     18: {"hen_body": (-34, 0, 0), "hen_head": (70, 0, 0)}, 30: {}},
    }
    for cname, keys in clips.items():
        act = bpy.data.actions.new(cname)
        act.use_fake_user = True
        arm.animation_data.action = act
        for f, pose in sorted(keys.items()):
            for b in names:
                pb = arm.pose.bones[b]
                pb.rotation_euler = tuple(math.radians(v) for v in pose.get(b, (0, 0, 0)))
                pb.keyframe_insert("rotation_euler", frame=f)
            rb = arm.pose.bones["hen_root"]
            rb.location = (0, pose.get("loc", 0.0), 0)
            rb.keyframe_insert("location", frame=f)
        slot = arm.animation_data.action_slot
        for fc in anim_utils.action_get_channelbag_for_slot(act, slot).fcurves:
            fc.modifiers.new("CYCLES")
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
    return list(clips)


# Mobilier du potager --------------------------------------------------------

def hen_feeder(A):
    g = A.geo()
    g.box((0.62, 0.26, 0.14), loc=(0, 0, 0.12), color="wood", base=True, bevel=0.01)
    g.box((0.56, 0.2, 0.02), loc=(0, 0, 0.235), color="grain", base=True)
    for s in (1, -1):
        g.prism([(-0.14, 0.0), (0.14, 0.0), (0.0, 0.3)], 0.03, loc=(s * 0.3, 0, 0.0), color="wood_dark",
                rot=(0, 0, 90))
    g.box((0.66, 0.03, 0.03), loc=(0, 0, 0.32), color="wood_dark")
    return g


def grain_sack(A):
    g = A.geo()
    g.lathe([(0.17, 0.0), (0.2, 0.08), (0.2, 0.3), (0.14, 0.42), (0.06, 0.47), (0.09, 0.53)],
            colors=["burlap", "burlap", "burlap", "burlap_dark", "burlap"], segs=9, scale=(1, 0.85, 1))
    g.cyl(0.065, 0.025, loc=(0, 0, 0.46), color="rope", segs=8)
    g.box((0.14, 0.004, 0.08), loc=(0, -0.172, 0.2), color="paper_dark")
    return g


def water_barrel(A):
    g = A.geo()
    g.lathe([(0.27, 0.0), (0.31, 0.2), (0.32, 0.4), (0.31, 0.6), (0.27, 0.8)], colors="wood", segs=12)
    for z in (0.08, 0.36, 0.44, 0.72):
        r = 0.285 + 0.03 * math.sin(math.pi * z / 0.8)
        g.cyl(r + 0.008, 0.035, loc=(0, 0, z), color="iron", segs=12)
    g.cyl(0.255, 0.01, loc=(0, 0, 0.775), color="water", segs=12)
    g.cyl(0.022, 0.06, loc=(0, -0.3, 0.12), color="brass", segs=6, rot=(90, 0, 0))
    return g


# Programme --------------------------------------------------------------------

def main():
    lpl.reset()
    tex = lpl.build_world_textures()
    mat = lpl.palette_material("lpl_palette", tex["palette"], tex["palette-mr"], tex["palette-emission"])
    A = lpl.Assets(mat)
    A.add("garden_cell_grass", garden_cell_grass(A), {"footprint": [1, 1]})
    A.add("garden_cell_tilled", garden_cell_tilled(A), {"footprint": [1, 1]})
    A.add("garden_cell_tilled_wet", garden_cell_tilled(A, wet=True), {"footprint": [1, 1]})
    for crop in ("radish", "lettuce", "carrot"):
        for stage in ("seed", "sprout", "young", "ripe"):
            A.add(f"{crop}_stage_{stage}", crop_model(A, crop, stage), {"footprint": [1, 1], "on": "garden_cell_tilled"})
    A.add("radish", item_radish(A), {"kind": "item"})
    A.add("carrot", item_carrot(A), {"kind": "item"})
    A.add("lettuce", item_lettuce(A), {"kind": "item"})
    A.add("egg", item_egg(A), {"kind": "item"})
    A.add("dandelion", dandelion(A), {"kind": "item"})
    # cueillette du tour 8 (cueillette.py): grossies comme le pissenlit, 0,25 m au moins (lisibles au zoom 1)
    A.add("wild_garlic", cueillette.wild_garlic(A), {"kind": "item", "size_m": 0.41})
    A.add("chanterelle", cueillette.chanterelle(A), {"kind": "item", "size_m": 0.3})
    # tour 9 (5.1 de tour-09-conception.md): mûres en trois grappes sur la face sud du roncier, noisettes sur
    # une jonchée de feuilles sous le noisetier, cèpes, ombelles de sureau sur la face sud du sureau
    A.add("blackberry", cueillette.blackberry_on_bramble(A),
          {"kind": "item", "size_m": 0.66, "posed_on": "bramble",
           "note": "trois grappes: origine au point berry_spots de bramble, même lacet que le roncier (pas de lacet "
                   "au hasard), jamais au sol"})
    A.add("hazelnut", cueillette.hazelnut(A),
          {"kind": "item", "size_m": 0.6, "posed_on": "bush_hazel",
           "note": "jonchée de feuilles et tas: origine au point nut_spots de bush_hazel, au sol"})
    A.add("cep", cueillette.cep(A), {"kind": "item", "size_m": 0.25, "note": "au pied d'un chêne, côté sud"})
    A.add("elderberry", cueillette.elderberry_on_elder(A),
          {"kind": "item", "size_m": 0.7, "posed_on": "bush_elder",
           "note": "trois ombelles: origine au point berry_spots de bush_elder, même lacet que le sureau, jamais au sol"})
    for crop in ("radish", "lettuce", "carrot"):
        A.add("seed_packet_" + crop, seed_packet(A, crop), {"kind": "item"})
    for name, fn in (("hoe", tool_hoe), ("watering_can", tool_watering_can), ("axe", tool_axe), ("saw", tool_saw),
                     ("hammer", tool_hammer), ("fishing_rod", tool_fishing_rod)):
        ob = A.add(name, fn(A), {"kind": "tool", "socket": "socket_hand_r"})
        if name == "fishing_rod":
            a = math.radians(42)
            lpl.empty("fishing_rod_tip", parent=ob, loc=(0, -2.0 * math.cos(a), 2.0 * math.sin(a)))
    # outils de la Halte (tour 9): même toolKind, même prise et même bout que l'outil de départ
    for name, fn, kind in (("watering_can_copper", tool_watering_can_copper, "watering_can"),
                           ("axe_forged", tool_axe_forged, "axe"),
                           ("fishing_rod_bamboo", tool_fishing_rod_bamboo, "fishing_rod")):
        ob = A.add(name, fn(A), {"kind": "tool", "socket": "socket_hand_r", "tool_kind": kind})
        if kind == "fishing_rod":
            a = math.radians(42)
            lpl.empty("fishing_rod_bamboo_tip", parent=ob, loc=(0, -2.0 * math.cos(a), 2.0 * math.sin(a)))
    pole = A.add("lamp_pole", lamp_pole(A), {"kind": "tool", "socket": "socket_hand_r", "length_m": 2.2,
                                             "note": "perche couchée vers l'avant (+Z glTF) au repos; clips pole_raise et pole_lower"})
    lpl.empty("lamp_pole_tip", parent=pole, loc=(0, -1.235, 0))
    A.add("hen_crate", hen_crate(A), {"footprint": [1, 1], "note": "cage de transport: posée devant le poulailler, "
                                                                   "poule à l'origine, dedans"})
    A.add("fishing_float", fishing_float(A), {"kind": "item", "note": "bouchon: origine au niveau de l'eau"})
    A.add("log", item_log(A), {"kind": "item"})
    A.add("plank", item_plank(A), {"kind": "item"})
    A.add("beam", item_beam(A), {"kind": "carried", "length_axis": "z", "carry_height": 1.78})
    # tour 10: la panne faîtière de la chambre (4,9 m), portée à deux comme la poutre du jour 1
    A.add("ridge_purlin", item_ridge_purlin(A), {"kind": "carried", "length_axis": "z", "carry_height": 1.78,
                                                 "length_m": 4.9})
    A.add("nail_box", item_nail_box(A), {"kind": "item"})
    # poissons: poissons.glb depuis la 0.12 (poissons.py, 22 espèces au même gabarit)
    A.add("hen_feeder", hen_feeder(A), {"footprint": [1, 1]})
    A.add("grain_sack", grain_sack(A), {"kind": "item"})
    A.add("water_barrel", water_barrel(A), {"footprint": [1, 1]})
    # poule: squelette + trois robes
    arm = hen_rig()
    A._register(arm, {"variants": [v for v, _ in HEN_VARIANTS],
                      "note": "une robe visible à la fois; hen_rooster: le coq (mêmes clips); hen_chick: le poussin, "
                              "racine à l'échelle 0,4 (extra scale de la robe)"})
    for vname, body in HEN_VARIANTS:
        if body.startswith("chicken_"):
            g = hen_mesh(A, body)
        elif body == "rooster":
            g = hen_rooster_mesh(A)
        elif body == "chick":
            g = hen_chick_mesh(A)
        else:
            g = hen_robe(A, body)
        ob = A.add(vname, g, parent=arm, extras={"scale": CHICK_SCALE} if body == "chick" else None)
        ob.modifiers.new("rig", "ARMATURE").object = arm
    clips = hen_actions(arm)

    objs = A.all_objects()
    path = os.path.join(lpl.OUT, "ferme.glb")
    size = lpl.export_glb(path, objs, animation_mode="ACTIONS")
    st = A.stats()
    st["hen"]["tris_each_variant"] = {v: lpl.tri_count_obj(bpy.data.objects[v]) for v, _ in HEN_VARIANTS}
    lpl.write_stats("ferme", {"nodes": st, "animations": clips, "file_bytes": size})
    print("FERME", size, {k: v["tris"] for k, v in st.items()})

    # planche
    roots = [r for r in A.roots if r.name != "hen"]
    hens = []
    for v, _ in HEN_VARIANTS:
        e = lpl.empty("planche_" + v)
        h2 = bpy.data.objects["hen"].copy()
        bpy.context.scene.collection.objects.link(h2)
        h2.parent = e
        m = bpy.data.objects[v].copy()
        bpy.context.scene.collection.objects.link(m)
        m.parent = h2
        m.modifiers["rig"].object = h2
        hens.append(e)
    bpy.data.objects["hen"].hide_render = True
    for v, _ in HEN_VARIANTS:
        bpy.data.objects[v].hide_render = True

    def spacing(r):
        n = r.name
        if n == "beam":
            return 2.4
        if n.startswith(("garden", "planche_radish", "planche_lettuce", "planche_carrot", "water_barrel", "hen_feeder")):
            return 1.2
        if n in ("hoe", "fishing_rod"):
            return 1.2
        return 0.7
    cell = bpy.data.objects["garden_cell_tilled"]
    order = []
    for r in roots:
        if "_stage_" in r.name:
            e = lpl.empty("planche_" + r.name)
            c = cell.copy()
            bpy.context.scene.collection.objects.link(c)
            c.parent = e
            c2 = r.copy()
            bpy.context.scene.collection.objects.link(c2)
            c2.parent = e
            order.append(e)
        else:
            order.append(r)
    order += hens
    for r in roots:
        if "_stage_" in r.name:
            r.hide_render = True
    lpl.board(order, os.path.join(lpl.BOARDS, "ferme.png"), cols=10, spacing=spacing, label_size=0.085,
              res=(2000, 1250), names={e.name: e.name.replace("planche_", "") for e in order if e.name.startswith("planche_")})


if __name__ == "__main__":
    main()
