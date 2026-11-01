"""Objets de la maison et cadeaux du tour 9 (docs/jeux/jeu-1/tour-09-conception.md, sections 2.3, 2.7 et 6.4):
modèles appelés par maison.py, exportés dans maison.glb.

Muraux (extra wall: True): dos contre le bord arrière de la case (+Y Blender, -Z glTF, le mur est à y = 0,5),
accrochés à hauteur d'yeux comme le cadre (1,3 à 1,8 m); la pièce de 5 x 4 cases est pleine au sol, le rayon
Maison vend donc surtout des objets de mur. Chacun tient par quelque chose qui se voit: clou, ficelle, punaises.
Couleurs fixes (pas de case de feuillage, qui change avec la saison): la couronne reste rousse toute l'année.
"""
import math

import bpy  # noqa: F401,I001
from mathutils import Vector

from lpl import by_normal

WALL = 0.5   # nu du mur, en y (bord arrière de la case)


def _nail(g, x, z, length=0.04):
    """Clou planté dans le mur, tête vers la pièce."""
    g.cyl(0.004, length, loc=(x, WALL - length / 2, z), color="iron", segs=5, rot=(90, 0, 0))
    g.cyl(0.009, 0.004, loc=(x, WALL - length, z), color="iron", segs=6, rot=(90, 0, 0))


def straw_hat(A):
    """Chapeau de paille accroché à un clou par son ruban (1,62 m): bord large de 0,42 m posé contre le mur,
    calotte bombée vers la pièce, ruban rouge. Le clou passe sous le ruban, au-dessus de la calotte."""
    g = A.geo()
    zc, yb = 1.5, WALL - 0.025
    # bord (disque plat et ondulé), légèrement penché: le bas touche le mur, le haut s'écarte de 3 cm
    g.lathe([(0.0, 0.0), (0.12, 0.004), (0.2, 0.0), (0.212, -0.012)], loc=(0, yb, zc), colors="straw", segs=12,
            rot=(84, 0, 0), close_bottom=False)
    g.lathe([(0.212, -0.012), (0.2, -0.014), (0.12, -0.008), (0.0, -0.006)], loc=(0, yb, zc), colors="straw_dark",
            segs=12, rot=(84, 0, 0), close_bottom=False, close_top=False)
    # calotte et ruban
    g.lathe([(0.11, 0.0), (0.112, 0.05), (0.1, 0.09), (0.06, 0.115), (0.0, 0.12)], loc=(0, yb - 0.004, zc),
            colors=["fabric_red", "straw", "straw", "straw"], segs=10, rot=(84, 0, 0))
    _nail(g, 0.0, zc + 0.13, 0.05)
    g.box((0.04, 0.012, 0.04), loc=(0.0, WALL - 0.035, zc + 0.115), color="fabric_red", rot=(0, 45, 0))
    return g


def pressed_flowers(A):
    """Herbier encadré (0,36 x 0,46 m, à 1,45 m): cadre de bois sombre, fond de papier, trois fleurs pressées à
    plat (tige, feuilles, corolles de couleur) et une étiquette; pendu par une ficelle à un clou."""
    g = A.geo()
    z, y = 1.45, WALL - 0.02
    g.box((0.36, 0.035, 0.46), loc=(0, y, z), color="wood_dark", bevel=0.008)
    g.box((0.29, 0.036, 0.39), loc=(0, y - 0.002, z), color="paper")
    fy = y - 0.021
    for k, (x, col) in enumerate(((-0.08, "flower_blue"), (0.0, "flower_pink"), (0.08, "flower_yellow"))):
        g.box((0.008, 0.004, 0.2), loc=(x, fy, z - 0.04), color="leaf_crop", rot=(0, 6 * (k - 1), 0))
        for s in (1, -1):
            g.box((0.04, 0.004, 0.016), loc=(x + s * 0.02, fy, z - 0.06 + 0.03 * k), color="leaf_carrot",
                  rot=(0, s * 30, 0))
        for j in range(5):
            a = math.radians(j * 72)
            g.cyl(0.014, 0.004, loc=(x + 0.02 * math.cos(a), fy, z + 0.08 + 0.02 * math.sin(a)), color=col, segs=6,
                  rot=(90, 0, 0))
        g.cyl(0.01, 0.005, loc=(x, fy - 0.001, z + 0.08), color="flower_center", segs=6, rot=(90, 0, 0))
    g.box((0.12, 0.004, 0.03), loc=(0, fy, z - 0.16), color="paper_dark")
    _nail(g, 0.0, z + 0.36)
    for s in (1, -1):
        g.cyl(0.003, 0.17, loc=(s * 0.06, WALL - 0.03, z + 0.29), color="rope", segs=4, rot=(0, -s * 42, 0))
    return g


def coop_calendar(A):
    """Calendrier de la coopérative (0,34 x 0,52 m, à 1,5 m), pendu à un clou: bandeau vert de la coopérative,
    grille des jours, et la gravure de la saison en nœud enfant (coop_calendar_spring, _summer, _autumn,
    _winter: n'en montrer qu'un)."""
    g = A.geo()
    z, y = 1.5, WALL - 0.008
    g.box((0.34, 0.012, 0.52), loc=(0, y, z), color="paper")
    g.box((0.33, 0.014, 0.06), loc=(0, y - 0.001, z + 0.23), color="paint_green")
    g.box((0.18, 0.004, 0.014), loc=(0, y - 0.009, z + 0.23), color="paint_cream")
    # grille des jours: cinq lignes et six colonnes de cases
    for r in range(5):
        for c in range(6):
            g.box((0.036, 0.004, 0.026), loc=(-0.11 + c * 0.044, y - 0.007, z - 0.07 - r * 0.036),
                  color="paper_dark" if (r * 6 + c) % 7 else "fabric_red")
    _nail(g, 0.0, z + 0.245, 0.03)
    return g


def calendar_engraving(A, season):
    """Gravure de la saison (0,26 x 0,15 m) sur le haut du calendrier: printemps, verger en fleurs; été, blé et
    soleil; automne, la Halte (bâtiment, quai, arbre roux), comme le dit le catalogue; hiver, toits sous la neige."""
    g = A.geo()
    z, y = 1.5 + 0.11, WALL - 0.016
    g.box((0.27, 0.004, 0.16), loc=(0, y, z), color="sepia")
    fy = y - 0.003
    if season == "spring":
        for x in (-0.07, 0.06):
            g.box((0.012, 0.004, 0.06), loc=(x, fy, z - 0.04), color="bark")
            g.cyl(0.04, 0.004, loc=(x, fy, z + 0.01), color="flower_pink", segs=8, rot=(90, 0, 0))
        g.box((0.25, 0.004, 0.02), loc=(0, fy, z - 0.065), color="grass")
    elif season == "summer":
        g.cyl(0.03, 0.004, loc=(0.08, fy, z + 0.04), color="flower_yellow", segs=8, rot=(90, 0, 0))
        for k in range(7):
            g.box((0.01, 0.004, 0.08), loc=(-0.1 + k * 0.025, fy, z - 0.03), color="straw", rot=(0, 8 * (k - 3), 0))
    elif season == "autumn":
        g.box((0.14, 0.004, 0.06), loc=(-0.03, fy, z - 0.03), color="plaster_cream")
        g.box((0.16, 0.004, 0.025), loc=(-0.03, fy - 0.001, z + 0.01), color="tile", rot=(0, 0, 0))
        g.box((0.25, 0.004, 0.012), loc=(0, fy, z - 0.068), color="stone_dark")
        g.box((0.01, 0.004, 0.05), loc=(0.09, fy, z - 0.04), color="bark")
        g.cyl(0.035, 0.004, loc=(0.09, fy, z + 0.0), color="fox_red", segs=8, rot=(90, 0, 0))
        g.box((0.02, 0.004, 0.025), loc=(-0.06, fy - 0.001, z - 0.04), color="glass")
    else:
        for x in (-0.06, 0.05):
            g.box((0.09, 0.004, 0.05), loc=(x, fy, z - 0.04), color="stone")
            g.box((0.1, 0.004, 0.025), loc=(x, fy - 0.001, z), color="white_paint")
        g.box((0.25, 0.004, 0.02), loc=(0, fy, z - 0.068), color="white_paint")
    return g


def wall_clock(A):
    """Horloge murale de 0,62 m (cadran à 1,75 m): caisse de bois sombre, cadran de 0,26 m à douze traits,
    fenêtre vitrée sur le balancier. Aiguilles et balancier en nœuds enfants (wall_clock_hour, _minute, tournent
    autour de leur axe Z local, vers la pièce; wall_clock_pendulum, pivot en haut, oscille autour de Z)."""
    g = A.geo()
    zc, y = 1.75, WALL - 0.04
    g.cyl(0.155, 0.08, loc=(0, y, zc), color="wood_dark", segs=12, rot=(90, 0, 0), bevel=0.01)
    g.cyl(0.13, 0.01, loc=(0, y - 0.036, zc), color="paper", segs=12, rot=(90, 0, 0))
    for k in range(12):
        a = math.radians(k * 30)
        big = k % 3 == 0
        g.box((0.012 if big else 0.008, 0.004, 0.03 if big else 0.018),
              loc=(0.11 * math.sin(a), y - 0.042, zc + 0.11 * math.cos(a)), color="black", rot=(0, -k * 30, 0))
    # niche ouverte (pas de vitre: le verre de la palette est opaque), fond sombre où bat le balancier
    zb = zc - 0.31
    g.box((0.16, 0.012, 0.36), loc=(0, WALL - 0.006, zb), color="wood_dark")
    g.box((0.16, 0.004, 0.3), loc=(0, WALL - 0.014, zb), color="shadow")
    for s in (1, -1):
        g.box((0.02, 0.07, 0.36), loc=(s * 0.09, WALL - 0.035, zb), color="wood_dark", bevel=0.006)
    g.box((0.16, 0.07, 0.03), loc=(0, WALL - 0.035, zb + 0.165), color="wood_dark")
    g.box((0.22, 0.08, 0.03), loc=(0, WALL - 0.04, zb - 0.19), color="wood", bevel=0.008)
    return g


def clock_hand(A, length, width):
    g = A.geo()
    g.box((width, 0.006, length), loc=(0, 0, length / 2 - 0.015), color="black")
    g.cyl(0.012, 0.008, color="brass", segs=6, rot=(90, 0, 0))
    return g


def clock_pendulum(A):
    g = A.geo()
    g.box((0.008, 0.006, 0.18), loc=(0, 0, -0.09), color="brass")
    g.cyl(0.035, 0.012, loc=(0, 0, -0.19), color="brass", segs=10, rot=(90, 0, 0))
    return g


def autumn_wreath(A):
    """Couronne de feuilles de chêne et de vigne vierge (0,42 m, à 1,6 m), nouée d'un ruban rouge, pendue à un
    clou: anneau de paille tressée couvert de feuilles rousses et or, deux glands."""
    g = A.geo()
    zc, y = 1.6, WALL - 0.03
    g.lathe([(0.15, -0.015), (0.18, -0.015), (0.18, 0.015), (0.15, 0.015), (0.15, -0.015)], loc=(0, y, zc),
            colors="straw_dark", segs=12, rot=(90, 0, 0), close_top=False, close_bottom=False)
    cols = ("leaf_litter", "fox_red", "fox_red_dark", "flower_yellow", "fox_red", "leaf_litter", "ember")
    # feuilles plates et pointues, à plat contre l'anneau, en écailles qui suivent le tour (24, deux rangs)
    leaf = [(0.0, 0.0), (0.025, 0.022), (0.06, 0.024), (0.095, 0.0), (0.06, -0.024), (0.025, -0.022)]
    for k in range(24):
        deg = k * 15 + 4
        a = math.radians(deg)
        r = 0.135 + 0.035 * (k % 2)
        p = (r * math.cos(a), y - 0.019 - 0.006 * (k % 3), zc + r * math.sin(a))
        g.prism(leaf, 0.008, loc=p, color=cols[k % 7], rot=(0, -(deg + 100 + 25 * (k % 2)), 0))
    for x in (-0.05, 0.04):
        g.sphere(0.02, loc=(x, y - 0.045, zc - 0.165), color="bark", segs=6, rings=4, scale=(1, 1, 1.3))
    # noeud du ruban en bas, clou en haut
    g.box((0.06, 0.02, 0.04), loc=(0, y - 0.02, zc - 0.19), color="fabric_red", bevel=0.006)
    for s in (1, -1):
        g.box((0.025, 0.012, 0.09), loc=(s * 0.03, y - 0.02, zc - 0.25), color="fabric_red", rot=(0, s * 18, 0))
    _nail(g, 0.0, zc + 0.205, 0.06)
    return g


def jeanne_drawing(A):
    """Dessin de Jeanne (sa première poésie): feuille de cahier de 0,32 x 0,23 m punaisée au mur à 1,4 m, quatre
    punaises rouges; un train vert et un soleil au crayon, et quatre lignes d'écriture bleue dessous."""
    g = A.geo()
    z, y = 1.4, WALL - 0.004
    g.box((0.32, 0.006, 0.23), loc=(0, y, z), color="paper", rot=(0, 2.5, 0))
    fy = y - 0.004
    g.box((0.1, 0.003, 0.04), loc=(-0.05, fy, z + 0.04), color="paint_green")
    g.box((0.035, 0.003, 0.05), loc=(-0.11, fy, z + 0.05), color="paint_green")
    for x in (-0.09, -0.04, 0.0):
        g.cyl(0.012, 0.003, loc=(x, fy, z + 0.015), color="black", segs=6, rot=(90, 0, 0))
    g.box((0.012, 0.003, 0.03), loc=(-0.115, fy, z + 0.09), color="black")
    g.cyl(0.025, 0.003, loc=(0.1, fy, z + 0.07), color="flower_yellow", segs=8, rot=(90, 0, 0))
    for k in range(4):
        g.box((0.2 - 0.03 * (k % 2), 0.003, 0.006), loc=(-0.01, fy, z - 0.03 - k * 0.022), color="fabric_blue",
              rot=(0, 2.5, 0))
    for (x, dz) in ((-0.15, 0.105), (0.15, 0.105), (-0.15, -0.105), (0.15, -0.105)):
        g.cyl(0.008, 0.008, loc=(x, y - 0.006, z + dz), color="fabric_red", segs=6, rot=(90, 0, 0))
    return g


def wicker_armchair(A):
    """Fauteuil d'osier (1 x 1, assise à 0,42 m): cuve ronde tressée dont le dossier et les accoudoirs ne font
    qu'un (bandes de tressage claires et sombres), coussin de lin, quatre pieds courts sous une ceinture."""
    g = A.geo()
    sh = 0.42
    # assise: galette tressée et coussin
    g.cyl(0.26, 0.06, loc=(0, 0, sh - 0.1), color="straw_dark", segs=12, base=True, scale=(1.0, 0.92, 1.0))
    g.cyl(0.24, 0.05, loc=(0, 0.0, sh - 0.045), color="fabric_cream", segs=12, base=True, scale=(1.0, 0.9, 1.0),
          bevel=0.015)
    # cuve: anneau en fer à cheval ouvert vers l'avant (-Y), qui monte de 0,62 m (accoudoirs) à 0,9 m (dos);
    # trois rangs de tressage par pan, clair et foncé en quinconce, boudin continu sur le bord
    from cueillette import tube
    n, r = 9, 0.28
    rim = []
    for i in range(n + 1):
        t = i / n
        a = math.radians(-30 + 240 * t)
        rim.append(Vector((r * math.cos(a), r * math.sin(a) * 0.95, 0.62 + 0.28 * math.sin(math.pi * t))))
    for i in range(n):
        a0, a1 = math.radians(-30 + 240 * i / n), math.radians(-30 + 240 * (i + 1) / n)
        am = (a0 + a1) / 2
        hm = (rim[i].z + rim[i + 1].z) / 2
        p = Vector((r * math.cos(am), r * math.sin(am) * 0.95, 0))
        seg = 2 * r * math.sin((a1 - a0) / 2) + 0.01
        h = (hm - (sh - 0.1)) / 3
        for j in range(3):
            g.box((seg, 0.05, h + 0.002), loc=(p.x, p.y, sh - 0.1 + j * h), color="straw" if (i + j) % 2 else "straw_dark",
                  base=True, rot=(0, 0, math.degrees(am) + 90), no_round=True)
    tube(g, rim, 0.032, 0.032, "straw_dark", segs=6)
    # ceinture et pieds
    g.cyl(0.27, 0.05, loc=(0, 0, sh - 0.15), color="wood", segs=12, base=True, scale=(1.0, 0.92, 1.0))
    for k in range(4):
        a = math.radians(45 + k * 90)
        g.cyl(0.025, sh - 0.15, loc=(0.2 * math.cos(a), 0.18 * math.sin(a), 0), color="wood", segs=6, base=True)
    return g


def chalk_box(A):
    """Boîte de craies (cadeau pour Jeanne): boîte de bois de 0,16 x 0,1 m ouverte, couvercle glissé dessous,
    six craies de couleur, dont la verte « qui ne sert à rien »."""
    g = A.geo()
    g.box((0.16, 0.1, 0.035), color="wood_new", base=True, bevel=0.004)
    g.box((0.148, 0.088, 0.004), loc=(0, 0, 0.031), color="wood_dark", base=True)
    cols = ("white_paint", "flower_yellow", "flower_red", "flower_blue", "flower_pink", "paint_green")
    for k, c in enumerate(cols):
        g.cyl(0.0065, 0.13, loc=(0, -0.035 + k * 0.014, 0.042), color=c, segs=6, rot=(0, 90, 0))
    return g


def coffee_mill(A):
    """Moulin à café (cadeau pour Odette, posé sur le comptoir): caisse de bois de 0,13 m, tiroir à bouton de
    laiton, trémie de laiton dessus, manivelle à boule de bois. Origine sous la caisse."""
    g = A.geo()
    g.box((0.13, 0.13, 0.13), color="wood", base=True, bevel=0.008)
    g.box((0.1, 0.01, 0.045), loc=(0, -0.066, 0.035), color="wood_dark")
    g.sphere(0.008, loc=(0, -0.074, 0.058), color="brass", segs=6, rings=4)
    g.lathe([(0.05, 0.13), (0.058, 0.15), (0.03, 0.17), (0.012, 0.175)], colors="brass", segs=10)
    g.cyl(0.006, 0.05, loc=(0, 0, 0.19), color="iron", segs=5)
    g.box((0.11, 0.012, 0.01), loc=(0.05, 0, 0.215), color="iron")
    g.cyl(0.004, 0.03, loc=(0.1, 0, 0.23), color="iron", segs=5)
    g.sphere(0.016, loc=(0.1, 0, 0.255), color="wood_dark", segs=6, rings=4, scale=(1, 1, 1.2))
    return g


def elder_jelly(A):
    """Pot de gelée de sureau d'Odette: bocal de verre (8,5 cm), gelée noir violacé, coiffe de tissu à carreaux
    nouée d'une ficelle, étiquette."""
    g = A.geo()
    g.lathe([(0.035, 0.0), (0.04, 0.008), (0.04, 0.07), (0.034, 0.078)], colors="glass", segs=10)
    g.cyl(0.037, 0.06, loc=(0, 0, 0.008), color="blackberry", segs=10, base=True)
    g.lathe([(0.046, 0.068), (0.04, 0.085), (0.0, 0.09)], colors="fabric_red", segs=10, close_bottom=False)
    g.cyl(0.036, 0.006, loc=(0, 0, 0.076), color="rope", segs=10)
    g.box((0.04, 0.004, 0.025), loc=(0, -0.041, 0.04), color="paper", rot=(0, 0, 0))
    return g


def leather_apron(A):
    """Tablier de cuir (cadeau pour Basile), plié en trois et lié de ses cordons, tel qu'on l'offre."""
    g = A.geo()
    g.box((0.3, 0.22, 0.045), color=by_normal("leather", "leather"), base=True, bevel=0.008)
    g.box((0.29, 0.21, 0.004), loc=(0, 0, 0.045), color="wood_dark", base=True)
    g.box((0.31, 0.012, 0.05), loc=(0.0, 0.03, 0.0), color="rope", base=True)
    g.box((0.012, 0.23, 0.05), loc=(0.06, 0.0, 0.0), color="rope", base=True)
    return g


def wool_scarf(A):
    """Écharpe de laine (cadeau pour Firmin), roulée: rouleau rouge à rayures crème, frange qui dépasse."""
    g = A.geo()
    g.cyl(0.05, 0.24, loc=(0, 0, 0.05), color="paint_red", segs=8, rot=(0, 90, 0))
    for x in (-0.07, 0.0, 0.07):
        g.cyl(0.0505, 0.02, loc=(x, 0, 0.05), color="paint_cream", segs=8, rot=(0, 90, 0))
    g.box((0.14, 0.11, 0.008), loc=(0.02, -0.07, 0.0), color="paint_red", base=True)
    for k in range(5):
        g.box((0.008, 0.03, 0.006), loc=(-0.03 + k * 0.025, -0.135, 0.0), color="paint_cream", base=True)
    return g
