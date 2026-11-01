"""Chantiers du bourg et de la maisonnette (tour 9, docs/jeux/jeu-1/tour-09-conception.md, section 2.6), le puits
ouvert et la manivelle des barrières (section 4.2): modèles appelés par bourg.py, exportés dans bourg.glb.

Repères côté Blender: Z en haut, face avant vers -Y (devient +Z en glTF). Origine au centre de l'emprise, au
sol, sauf mention contraire (auvent: nu du mur; manivelle: point d'accroche sur le poteau).

Pourquoi chaque pièce est là (CLAUDE.md, « Cohérence du monde »):
- ford_bench: on s'y assoit pour attendre une touche ou le héron, face à l'eau (avant du banc vers l'eau).
- house_bench: dos au pignon est de la maisonnette, au soleil du matin, face au chemin du quai et à la voie.
- quay_planter: jardinière de quai, côté place, longue selon le quai, fleurs de la saison.
- well_roof: un toit sur le puits ouvert (feuilles et pluie), poteaux hors de la margelle, treuil à hauteur de
  main; well: margelle et potence de fer à poulie tant que le toit n'est pas bâti.
- door_canopy: auvent sur la porte sud de la maisonnette, glissé sous la rive du toit (qui ne couvre que 0,33 m).
- level_crossing_crank: volant de 0,30 m sur le poteau de la barrière, côté place, pour baisser la lisse à la main.
"""
import math

import bpy  # noqa: F401,I001  (bmesh demande bpy chargé avant lui)
from mathutils import Vector

import lpl
from lpl import by_normal


def _not_ground(a, b):
    return not (abs(a.z) < 1e-4 and abs(b.z) < 1e-4)


# Bancs ---------------------------------------------------------------------------------------------------

SEAT_H = 0.45


def ford_bench(A):
    """Banc du gué en chêne, sans dossier (on s'y tourne vers l'eau ou vers l'autre): plateau de 1,8 x 0,36 m et
    8 cm, d'un seul madrier, sur deux pieds en tréteau (deux jambes écartées et une traverse), assise à 0,45 m.
    Deux places (seat_spots), 2 cases le long de X. Avant (-Y Blender, +Z glTF) vers l'eau."""
    g = A.geo()
    # madrier: dessus chanfreiné (3 cm, 2 segments), arêtes du dessous vives
    g.box((1.8, 0.36, 0.08), loc=(0, 0, SEAT_H - 0.08), color=by_normal("wood", "wood_dark"), base=True, bevel=0.03,
          bseg=2, bedges=lambda a, b: not (abs(a.z - 0.0) < 1e-4 and abs(b.z - 0.0) < 1e-4))
    for x in (-0.66, 0.66):
        # tréteau: deux jambes de 8 x 8 cm écartées de 12 degrés vers l'avant et l'arrière, traverse sous le plateau
        for s in (1, -1):
            ln = (SEAT_H - 0.08 - 0.04 - 0.04) / math.cos(math.radians(12)) + 0.02
            g.box((0.08, 0.08, ln), loc=(x, s * 0.13, 0.04), color="wood_dark", base=True, rot=(s * 12, 0, 0),
                  bevel=0.015, bedges=_not_ground)
        g.box((0.1, 0.42, 0.07), loc=(x, 0, SEAT_H - 0.15), color="wood", base=True, bevel=0.015)
        # sabots de pierre plate: le chêne ne pose pas dans la boue de la rive
        g.box((0.14, 0.52, 0.04), loc=(x, 0, 0), color="stone", base=True, bevel=0.012, bedges=_not_ground)
        # barre basse du tréteau, d'une jambe à l'autre
        g.box((0.06, 0.32, 0.06), loc=(x, 0, 0.15), color="wood_dark", base=True)
    # entretoise qui relie les barres basses des deux tréteaux (le banc tient)
    g.box((1.38, 0.06, 0.06), loc=(0, 0, 0.21), color="wood_dark", base=True, bevel=0.012)
    return g


def house_bench(A):
    """Banc au pignon: banc de bois neuf de Basile, à dossier, posé dos au mur. Assise de 1,7 x 0,43 m à 0,45 m,
    dossier de deux lattes incliné de 12 degrés dont le haut s'appuie au mur (HOUSE_BENCH_BACK = 0,39 m derrière
    l'origine: le nu du soubassement), accoudoirs sur jambettes, entretoise entre les pieds avant. Origine au
    milieu de l'assise, au sol (on s'y assoit comme sur bench). Avant (-Y Blender) vers le chemin."""
    g = A.geo()
    tan = math.tan(math.radians(12))
    yb, h = 0.16, 0.92   # pied du montant arrière, longueur du montant (haut à 0,90 m)
    for k in range(3):
        g.box((1.7, 0.13, 0.035), loc=(0, -0.15 + k * 0.14, SEAT_H - 0.035), color="wood_new", base=True,
              bevel=0.012)
    for x in (-0.78, 0.78):
        g.box((0.07, 0.07, SEAT_H - 0.035), loc=(x, -0.16, 0), color="wood", base=True, bevel=0.012,
              bedges=_not_ground)
        # pied arrière prolongé en montant de dossier, incliné vers le mur (son haut touche le mur)
        g.box((0.07, 0.07, h), loc=(x, yb, 0), color="wood", base=True, rot=(-12, 0, 0), bevel=0.012,
              bedges=_not_ground)
        g.box((0.07, 0.42, 0.06), loc=(x, 0.03, SEAT_H - 0.035 - 0.06), color="wood", base=True)
        # accoudoir posé sur une jambette (devant) et sur le montant (derrière)
        g.box((0.07, 0.56, 0.045), loc=(x, 0.03, 0.66), color="wood_new", base=True, bevel=0.012)
        g.box((0.05, 0.05, 0.66 - SEAT_H), loc=(x, -0.19, SEAT_H), color="wood", base=True)
    for z in (0.62, 0.8):
        # lattes du dossier, sur la face avant des montants inclinés
        g.box((1.62, 0.03, 0.12), loc=(0, yb + z * tan - 0.05, z), color="wood_new", base=True, rot=(-12, 0, 0),
              bevel=0.01)
    g.box((1.62, 0.05, 0.05), loc=(0, -0.16, 0.14), color="wood", base=True)
    # traverse du milieu sous les lattes (1,7 m de portée), sur l'entretoise par un montant
    g.box((0.05, 0.42, 0.05), loc=(0, 0.03, SEAT_H - 0.035 - 0.05), color="wood", base=True)
    g.box((0.05, 0.05, SEAT_H - 0.035 - 0.05 - 0.19), loc=(0, -0.16, 0.19), color="wood", base=True)
    return g


HOUSE_BENCH_BACK = round(0.16 + 0.92 * math.sin(math.radians(12)) + 0.035, 3)


# Jardinières du quai -----------------------------------------------------------------------------------

def quay_planter(A):
    """Jardinière du quai: caisse de planches peinte en vert (comme les volets et la caisse de la coopérative), de
    0,9 x 0,36 m et 0,4 m, sur deux patins, cerclée de fer aux angles. La terre affleure à 3 cm du bord. Les
    fleurs sont des enfants, un par saison (quay_planter_summer, _autumn, _winter): n'en montrer qu'un."""
    g = A.geo()
    W, D, H = 0.9, 0.36, 0.4
    for x in (-0.36, 0.36):
        g.box((0.08, D + 0.04, 0.04), loc=(x, 0, 0), color="wood_dark", base=True, bevel=0.01, bedges=_not_ground)
    g.box((W, D, H - 0.04), loc=(0, 0, 0.04), color=by_normal("soil_tilled", "paint_green"), base=True, bevel=0.025,
          bseg=2, bedges=lambda a, b: not (abs(a.z) < 1e-4 and abs(b.z) < 1e-4))
    # lames horizontales suggérées par deux baguettes, coins de fer
    for z in (0.15, 0.28):
        for s in (1, -1):
            g.box((W - 0.1, 0.012, 0.02), loc=(0, s * (D / 2 + 0.004), z), color="paint_cream")
    for sx in (1, -1):
        for sy in (1, -1):
            g.box((0.05, 0.05, H - 0.07), loc=(sx * (W / 2 - 0.012), sy * (D / 2 - 0.012), 0.05), color="iron",
                  base=True)
    return g


def _planter_soil(g, z):
    g.box((0.84, 0.3, 0.02), loc=(0, 0, z), color="soil_tilled", base=True)


def planter_flowers(A, season):
    """Fleurs de la jardinière: été, géraniums rouges en boules sur feuillage rond; automne, asters mauves en
    touffes hautes; hiver, paillage de paille et deux branches de sapin (rien ne fleurit, la terre est couverte).
    Origine au sol de la jardinière (la terre est à 0,37 m)."""
    g = A.geo()
    z0 = 0.355
    if season == "summer":
        for k, x in enumerate((-0.3, -0.1, 0.1, 0.3)):
            y = 0.03 if k % 2 else -0.03
            g.sphere(0.12, loc=(x, y, z0 + 0.08), color="leaf_crop", ico=1, jitter=0.1, seed=60 + k,
                     scale=(1.0, 0.9, 0.7))
            for j in range(2):
                g.sphere(0.06, loc=(x + (j - 0.5) * 0.07, y - 0.04, z0 + 0.2 + 0.03 * j), color="flower_red", ico=1,
                         jitter=0.12, seed=70 + k * 3 + j)
    elif season == "autumn":
        for k, x in enumerate((-0.32, -0.16, 0.0, 0.16, 0.32)):
            y = 0.04 if k % 2 else -0.04
            g.sphere(0.1, loc=(x, y, z0 + 0.1), color="leaf_bush", ico=1, jitter=0.1, seed=80 + k,
                     scale=(0.9, 0.85, 1.1))
            for j in range(3):
                a = math.radians(j * 120 + k * 30)
                g.sphere(0.035, loc=(x + 0.035 * math.cos(a), y + 0.035 * math.sin(a) - 0.01, z0 + 0.16 + 0.015 * j),
                         color="flower_violet", ico=1, jitter=0.1, seed=90 + k * 3 + j, scale=(1, 1, 0.6))
    else:
        g.box((0.84, 0.3, 0.04), loc=(0, 0, z0 - 0.005), color="straw_dark", base=True, bevel=0.01)
        for k in range(9):
            x = -0.36 + k * 0.09
            g.box((0.1, 0.012, 0.012), loc=(x, (k % 3 - 1) * 0.08, z0 + 0.04), color="straw", rot=(0, 0, k * 41))
        for x, yaw in ((-0.18, 20), (0.2, -15)):
            g.cyl(0.012, 0.36, loc=(x, 0.0, z0 + 0.06), color="bark", segs=5, rot=(90, 0, yaw))
            for j in range(4):
                g.cyl(0.05, 0.08, loc=(x + (j - 1.5) * 0.06, 0.02 * (j % 2), z0 + 0.075), color="leaf_fir",
                      segs=5, r2=0.01, rot=(90, 0, yaw + 90))
    return g


# Puits -------------------------------------------------------------------------------------------------

WELL_R = 0.85


def well_curb(g):
    """Margelle du puits (inchangée): couronne de pierre de 1,7 m, eau à 0,35 m."""
    g.lathe([(WELL_R, 0.0), (WELL_R, 0.75), (0.68, 0.75), (0.68, 0.2)], colors=["stone", "stone_light", "stone"],
            segs=12, close_top=False, close_bottom=True)
    g.cyl(0.68, 0.02, loc=(0, 0, 0.35), color="water_deep", segs=12)
    for k in range(10):
        a = math.radians(k * 36 + 10)
        g.box((0.4, 0.06, 0.18), loc=(0.86 * math.cos(a), 0.86 * math.sin(a), 0.2 + (k % 2) * 0.3), color="stone_dark",
              rot=(0, 0, k * 36 + 100))


def well_gallows(A):
    """Potence du puits ouvert: arceau de fer forgé scellé dans la margelle, poulie au milieu, corde et seau posé
    sur la margelle (on tire le seau à la main). Cachée quand le toit du puits est bâti (le treuil la remplace)."""
    g = A.geo()
    n = 9
    pts = []
    for i in range(n):
        t = math.pi * i / (n - 1)
        pts.append(Vector((0.72 * math.cos(t), 0.0, 0.74 + 1.1 * math.sin(t))))
    for i in range(n - 1):
        p, q = pts[i], pts[i + 1]
        d = q - p
        mid = (p + q) / 2
        ang = math.degrees(math.atan2(d.x, d.z))
        g.cyl(0.022, d.length + 0.012, loc=tuple(mid), color="iron", segs=6, rot=(0, ang, 0))
    # volutes de fer aux pieds de l'arceau, scellées dans la margelle
    for s in (1, -1):
        g.cyl(0.05, 0.05, loc=(s * 0.72, 0.0, 0.75), color="iron", segs=6, base=True)
    # poulie dans le plan nord-sud (la corde va vers le seau, au sud), chape prise dans l'arceau
    g.cyl(0.07, 0.03, loc=(0, 0, 1.74), color="iron", segs=10, rot=(0, 90, 0))
    g.box((0.05, 0.03, 0.1), loc=(0, 0, 1.8), color="iron")
    # seau de bois cerclé posé sur la margelle (au sud), anse de fer; la corde va de l'anse à la poulie, et son
    # bout libre pend de l'autre côté, au-dessus de l'eau
    g.lathe([(0.12, 0.0), (0.145, 0.24)], loc=(0.0, -0.76, 0.75), colors="wood", segs=8)
    for z in (0.05, 0.19):
        g.cyl(0.14 if z > 0.1 else 0.125, 0.025, loc=(0.0, -0.76, 0.75 + z), color="iron", segs=8)
    _rod(g, (-0.14, -0.76, 0.98), (-0.06, -0.76, 1.07), 0.007, "iron")
    _rod(g, (-0.06, -0.76, 1.07), (0.06, -0.76, 1.07), 0.007, "iron")
    _rod(g, (0.06, -0.76, 1.07), (0.14, -0.76, 0.98), 0.007, "iron")
    _rod(g, (0.0, -0.76, 1.07), (0.0, -0.07, 1.74), 0.006, "rope")
    _rod(g, (0.0, 0.07, 1.74), (0.0, 0.07, 1.2), 0.006, "rope")
    return g


def _rod(g, p, q, r, color, segs=5):
    """Tige ou corde droite de p à q."""
    p, q = Vector(p), Vector(q)
    d = q - p
    from mathutils import Matrix
    rot = d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    vs = g.cyl(r, d.length, color=color, segs=segs)
    g.transform(vs, Matrix.Translation((p + q) / 2) @ rot)


def well_roof(A):
    """Toit du puits: quatre poteaux de chêne de 12 cm aux coins (hors de la margelle, sur des dés de pierre),
    sablières et entraits, toit de tuiles à deux pans (faîte à 2,4 m), qui reste dans l'emprise de 2 x 2 m; treuil
    à tambour posé sur deux lisses à 1,3 m (à hauteur de main), manivelle côté est, corde et seau au-dessus de
    l'eau. Se pose à l'origine du puits (même emprise)."""
    from bourg import gable_roof
    g = A.geo()
    P = 0.8           # poteaux aux coins: à 1,13 m du centre, la margelle fait 0,85 m de rayon
    ze, zr = 1.88, 2.33
    for sx in (1, -1):
        for sy in (1, -1):
            g.box((0.2, 0.2, 0.08), loc=(sx * P, sy * P, 0), color="stone", base=True, bevel=0.02, bedges=_not_ground)
            g.box((0.12, 0.12, ze - 0.08), loc=(sx * P, sy * P, 0.08), color="wood", base=True, bevel=0.02,
                  bedges=_not_ground)
    # sablières (le long du faîtage) et entraits (en travers), posés sur la tête des poteaux
    for sy in (1, -1):
        g.box((2 * P + 0.16, 0.13, 0.12), loc=(0, sy * P, ze - 0.06), color="wood_dark", bevel=0.015)
    for sx in (1, -1):
        g.box((0.13, 2 * P - 0.12, 0.11), loc=(sx * P, 0, ze - 0.065), color="wood_dark", bevel=0.015)
        # poinçon du pignon sous le faîtage, et deux arbalétriers
        g.box((0.1, 0.1, zr - ze - 0.06), loc=(sx * P, 0, ze), color="wood_dark", base=True)
        for sy in (1, -1):
            dz = zr - ze - 0.04
            ln = math.hypot(P, dz)
            g.box((0.08, ln, 0.08), loc=(sx * P, sy * P / 2, ze + dz / 2 - 0.02), color="wood_dark",
                  rot=(-math.degrees(math.atan2(dz, P)) * sy, 0, 0))
        # lisses du treuil, à 1,25 m, d'un poteau à l'autre (elles contreventent aussi)
        g.box((0.08, 2 * P - 0.12, 0.08), loc=(sx * P, 0, 1.25), color="wood")
    # panne faîtière d'un pignon à l'autre, sous le faîtage
    g.box((2 * P + 0.1, 0.1, 0.1), loc=(0, 0, zr - 0.05), color="wood_dark")
    gable_roof(g, -P - 0.06, P + 0.06, -P - 0.04, P + 0.04, ze + 0.0, zr, "tile", edge="tile_dark", over=0.1,
               thick=0.06, ridge_color="tile_dark")
    # treuil: tambour de 0,16 m sur un axe posé dans deux paliers sur les lisses, corde enroulée, manivelle à l'est
    g.cyl(0.08, 1.1, loc=(0, 0, 1.37), color="wood", segs=8, rot=(0, 90, 0))
    g.cyl(0.085, 0.36, loc=(0, 0, 1.37), color="rope", segs=8, rot=(0, 90, 0))
    g.cyl(0.025, 2 * P + 0.24, loc=(0, 0, 1.37), color="iron", segs=6, rot=(0, 90, 0))
    for sx in (1, -1):
        g.box((0.1, 0.12, 0.08), loc=(sx * P, 0, 1.29), color="iron", base=True)
    g.box((0.04, 0.04, 0.3), loc=(P + 0.14, 0, 1.37 - 0.15), color="iron")
    g.cyl(0.02, 0.14, loc=(P + 0.2, 0, 1.24), color="wood_dark", segs=6, rot=(0, 90, 0))
    g.cyl(0.006, 0.36, loc=(0.0, -0.085, 1.37 - 0.18), color="rope", segs=5)
    g.lathe([(0.11, 0.0), (0.135, 0.22)], loc=(0.0, -0.085, 0.79), colors="wood", segs=8)
    for z in (0.04, 0.17):
        g.cyl(0.13 if z > 0.1 else 0.115, 0.022, loc=(0.0, -0.085, 0.79 + z), color="iron", segs=8)
    g.box((0.24, 0.01, 0.01), loc=(0.0, -0.085, 1.02), color="iron", rot=(0, 0, 0))
    return g


# Auvent de la porte -------------------------------------------------------------------------------------

def door_canopy(A):
    """Auvent sur la porte de la maisonnette, sans emprise au sol. Origine au nu du mur de façade, au droit de la
    porte, au sol; l'auvent avance vers -Y (dehors). La rive du toit de la maisonnette ne couvre que 0,33 m devant
    le mur (dessous à 2,20 m à 0,1 m du mur, 2,12 m au bord): l'auvent se glisse sous elle (son haut à 2,08 m à
    0,25 m du mur) et porte la couverture jusqu'à 1,15 m, en pente douce (bas du bord à 1,93 m, une personne de
    1,74 m passe). Deux consoles et deux jambes de force scellées au mur à x = +-0,80 (hors du chambranle de la
    porte et de la lampe), couverture de lauzes comme le toit, bord avant arrondi."""
    g = A.geo()
    X = 0.8
    d0, d1 = 0.22, 1.15
    z_back, z_front = 2.06, 1.98
    slope = math.degrees(math.atan2(z_back - z_front, d1 - d0))
    T = 0.05   # épaisseur de la couverture

    def deck_z(d):
        """Milieu de la couverture à d mètres du mur."""
        return z_back + (z_front - z_back) * (d - d0) / (d1 - d0) - T / 2

    for sx in (1, -1):
        # console de 8 x 10 cm sous la couverture, du mur au bord avant, de même pente
        ln = d1 + 0.02
        dc = ln / 2
        g.box((0.08, ln, 0.1), loc=(sx * X, -dc, deck_z(dc) - T / 2 - 0.05), color="wood_dark", rot=(slope, 0, 0),
              bevel=0.012)
        # jambe de force du mur (1,45 m) au dessous de la console, à 0,68 m du mur
        dy = 0.68
        dz = deck_z(dy) - T / 2 - 0.1 - 1.45
        g.box((0.07, math.hypot(dy, dz) + 0.02, 0.07), loc=(sx * X, -dy / 2, 1.45 + dz / 2), color="wood_dark",
              rot=(-math.degrees(math.atan2(dz, dy)), 0, 0))
        # sabot de fer au mur
        g.box((0.12, 0.03, 0.16), loc=(sx * X, -0.015, 1.47), color="iron")
    # couverture: dalle de lauzes d'un tenant, deux rangs suggérés, bord avant en boudin (bible 8.3)
    W = 2 * X + 0.24
    dm = (d0 + d1) / 2
    ln = math.hypot(d1 - d0, z_back - z_front)
    g.box((W, ln, T), loc=(0, -dm, deck_z(dm)), color=by_normal("lauze", "lauze_dark"), rot=(slope, 0, 0),
          bevel=0.012)
    for d in (d0 + (d1 - d0) / 3, d0 + 2 * (d1 - d0) / 3):
        g.box((W - 0.06, 0.05, 0.02), loc=(0, -d, deck_z(d) + T / 2 + 0.006), color="lauze_dark", rot=(slope, 0, 0))
    g.cyl(0.04, W + 0.02, loc=(0, -d1, deck_z(d1)), color="lauze_dark", segs=8, rot=(0, 90, 0))
    return g


# Manivelle des barrières -------------------------------------------------------------------------------

def crank_bracket(A):
    """Support de la manivelle, vissé sur le poteau: plaque cintrée sur le poteau (rayon 0,08 m), boîtier et axe
    qui sort vers -Y (vers la place). Origine au point d'accroche sur la surface du poteau, à 1,0 m."""
    g = A.geo()
    g.box((0.12, 0.03, 0.18), loc=(0, -0.015, 0), color="iron", bevel=0.008)
    g.cyl(0.04, 0.07, loc=(0, -0.06, 0), color="iron", segs=8, rot=(90, 0, 0))
    g.cyl(0.015, 0.06, loc=(0, -0.11, 0), color="iron_light", segs=6, rot=(90, 0, 0))
    return g


def crank_wheel(A):
    """Volant de 0,30 m à cinq rayons et poignée tournante (nœud animé): pivot sur son axe, qui est l'axe Z
    glTF du nœud (avant), rim à 10 pans."""
    g = A.geo()
    R = 0.15
    segs = 10
    # jante: anneau d'une seule pièce (profil carré tourné), sans jour entre les pans
    e = 0.012
    g.lathe([(R - e, -e), (R + e, -e), (R + e, e), (R - e, e), (R - e, -e)], colors="paint_red", segs=segs,
            rot=(90, 0, 0), close_top=False, close_bottom=False, phase=18)
    for k in range(5):
        a = 2 * math.pi * k / 5 + math.pi / 2
        g.box((0.016, 0.014, R - 0.02), loc=(math.cos(a) * R / 2, 0, math.sin(a) * R / 2), color="paint_red",
              rot=(0, -math.degrees(a) + 90, 0))
    g.cyl(0.03, 0.04, loc=(0, 0, 0), color="iron", segs=8, rot=(90, 0, 0))
    # poignée: tige et manchon de bois sur le rim, vers l'extérieur (-Y)
    hx, hz = R * math.cos(math.radians(-30)), R * math.sin(math.radians(-30))
    g.cyl(0.008, 0.05, loc=(hx, -0.025, hz), color="iron", segs=5, rot=(90, 0, 0))
    g.cyl(0.016, 0.08, loc=(hx, -0.08, hz), color="wood_dark", segs=6, rot=(90, 0, 0))
    return g
