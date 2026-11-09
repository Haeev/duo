"""Le café de la place du Tilleul (plan `village-arrivee` de plans.json), état d'arrivée.

Copie de l'essai de style (docs/jeux/cosy-cafe/essai-style/blender/scene_cafe.py) adaptée à Deux Tabliers: l'évier est un
poste à part (station_sink), la porte de la pièce du fond est dans coque.py (nœud qui se cache), l'ardoise de trottoir est un
objet déplaçable.

Coordonnées du plan (x vers l'est, y vers le sud, z en haut). Salle et comptoir: x 4,00 à 11,00, y 7,10 à 12,50,
plafond à 2,80 (bible, adresses.cjs). Chaque élément porte sa raison quand elle n'est pas évidente.
"""

import math

import bpy  # noqa: F401
import bmesh

from geo import Geo, P, pans, STYLE  # noqa: F401
import geo as G

X0, X1 = 4.0, 11.0  # murs ouest et est (faces intérieures)
Y0, Y1 = 7.1, 12.5  # mur du fond (nord) et façade (sud), faces intérieures
H = 2.8  # plafond
JOIST_B = 2.65  # dessous des solives
BEAM_B = 2.43  # dessous de la poutre maîtresse
WORK = 0.95  # plan de travail du barista
LEDGE = 1.10  # tablette des clients


def A():
    return G.STYLE.name == "A"


# ------------------------------------------------------------------------------------------------
# Coque

def coque():
    g = Geo("shell")
    # sol de tomettes (dessus à 0)
    g.box(X0, X1, Y0, Y1, -0.06, 0.0, "tomette", bevel=0, drop=("bottom",))
    # seuils de pierre sous les ouvertures de façade
    g.box(8.8, 10.0, Y1, 13.0, -0.06, 0.0, "stone_shade", bevel=0, drop=("bottom",))
    # plafond entre les solives
    g.box(X0, X1, Y0, Y1, H, H + 0.05, "ceiling", bevel=0, drop=("top",))
    # mur ouest et mur est (pleins)
    g.box(3.6, X0, Y0, Y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "w"))
    g.box(X1, 11.5, Y0, Y1, 0, H, "lime", bevel=0, drop=("top", "bottom", "e"))
    # mur du fond (nord): porte de la pièce du fond (fermée) et porte de la réserve
    mur_x(6.85, 7.1, [(5.95, 6.85, 0, 2.1), (10.0, 10.9, 0, 2.1)], g, face="s")
    # façade: vitrines (allège 0,45), porte vitrée, petite fenêtre (allège 0,90)
    mur_x(12.5, 13.0, [(4.4, 6.4, 0.45, 2.4), (6.5, 8.5, 0.45, 2.4), (8.8, 10.0, 0.0, 2.1), (10.2, 10.8, 0.9, 2.4)], g, face="n", x_a=3.6, x_b=11.5, ext=True)
    # plinthes de chêne (elles protègent la chaux du balai)
    for (a, b) in ((4.0, 5.7), (5.8, 5.95), (6.85, 7.0)):
        g.box(a, b, Y0, Y0 + 0.015, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "n"))
    for (a, b) in ((7.1, 11.0),):
        pass  # derrière l'arrière-comptoir: pas de plinthe (masquée)
    for (a, b) in ((9.2, 12.5),):
        g.box(X0, X0 + 0.015, a, b, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "w"))
    g.box(X1 - 0.015, X1, 9.5, Y1, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "e"))
    for (a, b) in ((X0, 4.4), (6.4, 6.5), (8.5, 8.8), (10.0, 10.2), (10.8, X1)):
        g.box(a, b, Y1 - 0.015, Y1, 0, 0.1, "beam", bevel=0.004, drop=("bottom", "s"))
    return g


def mur_x(y_in, y_out, ouvertures, g, face, x_a=X0, x_b=X1, ext=False):
    """Mur d'axe est-ouest entre y_in et y_out, percé d'ouvertures (x0, x1, z0, z1). Les tableaux des baies
    restent dans le mur (profondeur entière): l'appui intérieur est le dessus du mur sous l'allège."""
    y0, y1 = min(y_in, y_out), max(y_in, y_out)
    xs = sorted(ouvertures)
    cur = x_a
    drop_top = ("top", "bottom")
    for (a, b, z0, z1) in xs:
        if a > cur:
            g.box(cur, a, y0, y1, 0, H, "lime" if not ext else "lime", bevel=0, drop=drop_top)
        if z0 > 0:
            g.box(a, b, y0, y1, 0, z0, "lime", bevel=0, drop=("bottom",))
        g.box(a, b, y0, y1, z1, H, "lime", bevel=0, drop=("top",))
        cur = b
    if cur < x_b:
        g.box(cur, x_b, y0, y1, 0, H, "lime", bevel=0, drop=drop_top)


def poutres():
    g = Geo("beams")
    # poutre maîtresse nord-sud au milieu de la salle: elle porte les solives (et le plancher du logement)
    g.box(7.35, 7.65, Y0, Y1, BEAM_B, JOIST_B, "beam", grain="y", edges="notop")
    # solives est-ouest posées dessus, tous les 62 cm, scellées dans les murs latéraux
    y = Y0 + 0.35
    while y < Y1 - 0.1:
        g.box(X0, X1, y - 0.06, y + 0.06, JOIST_B, H, "beam", grain="x", edges="notop",
              bevel=0.03 if A() else 0.006)
        y += 0.62
    return g


def solives_y():
    out = []
    y = Y0 + 0.35
    while y < Y1 - 0.1:
        out.append(y)
        y += 0.62
    return out


def menuiseries():
    """Châssis des vitrines (petits bois), porte vitrée, portes du fond. Châssis près du nu extérieur:
    l'appui intérieur profond sert de tablette (plante sur la petite fenêtre)."""
    g = Geo("joinery")
    gl = Geo("glass", kind="glass")
    yf0, yf1 = 12.84, 12.92
    fw = 0.06  # dormant
    mb = 0.03 if not A() else 0.04  # petits bois
    for (a, b, z0, z1, cols, rows) in ((4.4, 6.4, 0.45, 2.4, 3, 3), (6.5, 8.5, 0.45, 2.4, 3, 3), (10.2, 10.8, 0.9, 2.4, 1, 3)):
        g.box(a, b, yf0, yf1, z0, z0 + fw, "frame", bevel=0.01)
        g.box(a, b, yf0, yf1, z1 - fw, z1, "frame", bevel=0.01)
        g.box(a, a + fw, yf0, yf1, z0, z1, "frame", bevel=0.01)
        g.box(b - fw, b, yf0, yf1, z0, z1, "frame", bevel=0.01)
        for i in range(1, cols):
            x = a + (b - a) * i / cols
            g.box(x - mb / 2, x + mb / 2, yf0 + 0.01, yf1 - 0.01, z0 + fw, z1 - fw, "frame", bevel=0.006)
        for j in range(1, rows):
            z = z0 + (z1 - z0) * j / rows
            g.box(a + fw, b - fw, yf0 + 0.01, yf1 - 0.01, z - mb / 2, z + mb / 2, "frame", bevel=0.006)
        gl.quad([(a + fw, 12.88, z0 + fw), (b - fw, 12.88, z0 + fw), (b - fw, 12.88, z1 - fw), (a + fw, 12.88, z1 - fw)], "glass", normal_hint=(0, -1, 0))
        # appui de chêne côté salle
        g.box(a - 0.03, b + 0.03, Y1 - 0.04, yf0, z0 - 0.03, z0, "shelf", bevel=0.008, drop=("bottom",))
    # porte vitrée à deux vantaux, bois peint sauge, soubassement plein
    a, b = 8.8, 10.0
    g.box(a, a + 0.07, yf0, yf1, 0, 2.1, "door_sage", bevel=0.01)
    g.box(b - 0.07, b, yf0, yf1, 0, 2.1, "door_sage", bevel=0.01)
    g.box(a, b, yf0, yf1, 2.03, 2.1, "door_sage", bevel=0.01)
    for (va, vb) in ((a + 0.07, 9.4), (9.4, b - 0.07)):
        g.box(va, vb, yf0 + 0.005, yf1 - 0.005, 0.0, 0.85, "door_sage", bevel=0.01)
        g.box(va, va + 0.08, yf0 + 0.005, yf1 - 0.005, 0.85, 2.03, "door_sage", bevel=0.01)
        g.box(vb - 0.08, vb, yf0 + 0.005, yf1 - 0.005, 0.85, 2.03, "door_sage", bevel=0.01)
        g.box(va + 0.08, vb - 0.08, yf0 + 0.005, yf1 - 0.005, 1.95, 2.03, "door_sage", bevel=0.01)
        gl.quad([(va + 0.08, 12.88, 0.85), (vb - 0.08, 12.88, 0.85), (vb - 0.08, 12.88, 1.95), (va + 0.08, 12.88, 1.95)], "glass", normal_hint=(0, -1, 0))
        # panneau mouluré du soubassement et poignée de laiton côté intérieur
        g.box(va + 0.07, vb - 0.07, yf0 - 0.012, yf0 + 0.005, 0.12, 0.75, "door_sage", bevel=0.008)
    for x in (9.33, 9.47):
        g.rod((x, yf0 - 0.06, 1.0), (x, yf0 - 0.06, 1.2), 0.012, 6, "brass")
        g.rod((x, yf0, 1.02), (x, yf0 - 0.06, 1.02), 0.008, 6, "brass")
        g.rod((x, yf0, 1.18), (x, yf0 - 0.06, 1.18), 0.008, 6, "brass")
    # portes du fond: pièce du fond (chêne, fermée) et réserve (sauge, personnel)
    for (a, b, key) in ((10.0, 10.9, "door_sage"),):
        g.box(a - 0.07, a, Y0, Y0 + 0.025, 0, 2.17, "frame", bevel=0.008, drop=("bottom",))
        g.box(b, b + 0.07, Y0, Y0 + 0.025, 0, 2.17, "frame", bevel=0.008, drop=("bottom",))
        g.box(a - 0.07, b + 0.07, Y0, Y0 + 0.025, 2.1, 2.17, "frame", bevel=0.008)
        g.box(a, b, 6.98, 7.02, 0, 2.1, key, bevel=0.01, drop=("bottom",))
        for (z0, z1) in ((0.15, 0.95), (1.1, 1.95)):
            g.box(a + 0.1, b - 0.1, 7.02, 7.035, z0, z1, key, bevel=0.006)
        g.cyl(b - 0.1, 7.06, 0.98, 1.02, 0.025, 8, "brass")
        g.rod((b - 0.1, 7.02, 1.0), (b - 0.1, 7.06, 1.0), 0.008, 6, "brass")
    return g, gl


# ------------------------------------------------------------------------------------------------
# Comptoir et arrière-comptoir

def comptoir():
    g = Geo("counter")
    # corps du comptoir (bois peint sauge), plinthe en retrait
    g.box(8.03, X1, 8.84, 9.44, 0, 0.08, "walnut", bevel=0.004, drop=("bottom", "e"))
    g.box(8.0, X1, 8.8, 9.5, 0.08, 0.92, "counter_paint", bevel=None, edges="vertical", drop=("e",))
    # panneaux moulurés de la face clients (rythme de 0,75 m)
    x = 8.08
    while x + 0.6 < X1:
        g.box(x, x + 0.62, 9.5, 9.52, 0.2, 0.84, "counter_paint", bevel=0.012)
        x += 0.74
    # face barista: étagères ouvertes sous le plan (piles de soucoupes et d'assiettes)
    g.box(8.06, X1, 8.79, 8.8, 0.08, 0.1, "oak_dark", bevel=0)
    g.box(8.06, X1, 8.79, 8.8, 0.46, 0.48, "oak_dark", bevel=0)
    # plan de travail du barista (0,95 m), noyer
    g.box(7.98, X1, 8.76, 9.22, 0.92, WORK, "walnut", bevel=0.012, drop=("e",))
    # rehausse côté clients et tablette (1,10 m)
    g.box(8.0, X1, 9.22, 9.5, WORK, LEDGE - 0.04, "counter_paint", bevel=0.01, drop=("e",))
    g.box(7.98, X1, 9.18, 9.56, LEDGE - 0.04, LEDGE, "walnut", bevel=0.012, drop=("e",))
    # portillon du personnel entre la joue basse et le comptoir
    g.box(7.12, 7.98, 9.4, 9.46, 0.1, 1.0, "counter_paint", bevel=0.01)
    g.box(7.1, 8.0, 9.38, 9.48, 1.0, 1.04, "walnut", bevel=0.008)
    g.cyl(7.14, 9.43, 0.1, 1.0, 0.012, 6, "brass")
    # joue basse (cloison de 1,10 m): ferme le côté ouest du bar
    g.box(7.0, 7.1, Y0, 9.5, 0, LEDGE - 0.04, "counter_paint", bevel=0.01, drop=("bottom", "n"))
    g.box(6.98, 7.12, Y0, 9.52, LEDGE - 0.04, LEDGE, "walnut", bevel=0.01, drop=("n",))
    return g


def arriere_comptoir():
    g = Geo("backbar")
    x0, x1, y0, y1 = 7.1, 9.9, Y0, 7.7
    # niche du réfrigérateur sous le plan (x 8,00 à 8,75, poste station-2): ouverte jusqu'au sol, le modèle
    # station_fridge_under la remplit (sans réfrigérateur, la place vide se voit: départ de la v0.3)
    fx0, fx1 = 8.0, 8.75
    for a, b in ((x0, fx0), (fx1, x1)):
        g.box(a, b, y0, y1 - 0.03, 0, 0.08, "walnut", bevel=0.004, drop=("bottom", "n"))
    # caisson de la plonge: creux sous le bac (le bac inox du poste station_sink descend à 0,74 m), bandeau avant
    # et joue contre la niche jusqu'au plan
    g.box(x0, fx0, y0, y1, 0.08, 0.70, "counter_paint", bevel=None, edges="vertical", drop=("n",))
    g.box(x0, fx0, y1 - 0.02, y1, 0.70, 0.87, "counter_paint", bevel=0, drop=("n", "top"))
    g.box(fx0 - 0.02, fx0, y0, y1 - 0.02, 0.70, 0.87, "counter_paint", bevel=0, drop=("n", "top", "s"))
    g.box(fx1, x1, y0, y1, 0.08, 0.87, "counter_paint", bevel=None, edges="vertical", drop=("n",))
    # plan de noyer percé pour le bac de la plonge (le plateau inox du poste recouvre les bords de la découpe)
    hx0, hx1, hy0, hy1 = 7.21, 7.67, 7.17, 7.63
    g.box(x0 - 0.01, hx0, y0, y1 + 0.03, 0.87, 0.9, "walnut", bevel=0.01, drop=("n",))
    g.box(hx1, x1 + 0.02, y0, y1 + 0.03, 0.87, 0.9, "walnut", bevel=0.01, drop=("n",))
    g.box(hx0, hx1, y0, hy0, 0.87, 0.9, "walnut", bevel=0.01, drop=("n",))
    g.box(hx0, hx1, hy1, y1 + 0.03, 0.87, 0.9, "walnut", bevel=0.01)
    # portes de placard sous la plonge et à l'est de la niche
    g.box(7.18, 7.93, y1, y1 + 0.015, 0.14, 0.82, "counter_paint", bevel=0.008)
    g.box(8.82, 9.84, y1, y1 + 0.015, 0.14, 0.82, "counter_paint", bevel=0.008)
    for x in (7.86, 9.77):
        g.cyl(x, y1 + 0.025, 0.48, 0.5, 0.018, 8, "brass")
    # l'évier, son robinet et l'égouttoir sont le poste station_sink, posé sur ce plan (x 7,15 à 7,95)
    # faïence vert sombre derrière: fond sombre pour la vaisselle rangée (bible, règle 2)
    g.box(7.1, 9.9, Y0, Y0 + 0.012, 0.9, 2.0, "tiles_dark", bevel=0, drop=("n",))
    # étagères de chêne ciré sur consoles
    # étagères au-dessus de la plonge et du réfrigérateur (les tasses près de l'évier et de la machine)
    for z in (1.32, 1.71):
        g.box(7.22, 8.68, Y0 + 0.012, Y0 + 0.29, z - 0.03, z, "shelf", bevel=0.008)
        for x in (7.32, 8.58):
            g.box(x - 0.015, x + 0.015, Y0 + 0.012, Y0 + 0.22, z - 0.18, z - 0.03, "steel_dark", bevel=0.004)
    # ardoise murale face à la porte et à la file, à côté de la porte de la réserve: depuis l'entrée, ni le rail
    # à tickets (au-dessus de la passe) ni les suspensions ne la cachent (texte posé par la scène Three.js, Caveat)
    sx0, sx1, sz0, sz1 = 8.78, 9.9, 1.22, 2.22
    g.box(sx0, sx1, Y0 + 0.012, Y0 + 0.04, sz0, sz1, "oak_dark", bevel=0.012)
    g.box(sx0 + 0.05, sx1 - 0.05, Y0 + 0.04, Y0 + 0.045, sz0 + 0.05, sz1 - 0.05, "slate", bevel=0)
    return g


def cafetiere():
    """Machine à expresso à deux groupes, cuivre et laiton, sur le plan de travail (0,76 x 0,42 x 0,48 m, bible);
    groupes tournés vers le barista (nord), dos vers la salle: son dessus reste sous les yeux (1,43 m).
    Pièces lisibles de près: têtes de groupe en cloche, porte-filtres à panier et becs, poignées noires,
    buse vapeur coudée et sa molette, robinet d'eau chaude, manomètre à cadran, grille d'égouttage, chauffe-tasses."""
    g = Geo("station_espresso_2g")
    cx = 9.15
    x0, x1 = cx - 0.38, cx + 0.38
    yf, yb = 8.98, 9.22  # façade (nord) et dos du corps
    z0 = WORK
    n = pans(16)
    # pieds
    for x in (x0 + 0.06, x1 - 0.06):
        for y in (8.86, 9.16):
            g.cyl(x, y, z0, z0 + 0.025, 0.022, pans(10), "steel_dark", bevel=0.005)
    # socle et bac d'égouttage à grille fine
    g.box(x0 + 0.01, x1 - 0.01, yf - 0.005, yb, z0 + 0.025, z0 + 0.06, "steel_dark", bevel=0.01)
    g.box(x0 + 0.04, x1 - 0.04, 8.79, yf, z0 + 0.025, z0 + 0.06, "steel", bevel=0.01)
    for i in range(11):
        x = x0 + 0.07 + i * (x1 - x0 - 0.14) / 10
        g.box(x - 0.004, x + 0.004, 8.805, yf - 0.01, z0 + 0.06, z0 + 0.066, "steel", bevel=0)
    g.box(x0 + 0.06, x1 - 0.06, 8.805, yf - 0.01, z0 + 0.052, z0 + 0.058, "steel_dark", bevel=0)
    # corps de cuivre aux angles très arrondis, bandeau de laiton en haut
    zb0, zb1 = z0 + 0.06, z0 + 0.43
    g.box(x0, x1, yf, yb, zb0, zb1, "copper", bevel=0.07 if A() else 0.04, segs=4 if A() else 2, edges="notop")
    g.box(x0 + 0.005, x1 - 0.005, yf - 0.006, yb + 0.006, zb1 - 0.03, zb1 - 0.012, "brass", bevel=0.008, segs=2)
    # façade de cuivre bordée de laiton, qui porte les groupes
    g.box(x0 + 0.07, x1 - 0.07, yf - 0.016, yf + 0.01, z0 + 0.15, zb1 - 0.04, "brass", bevel=0.02, segs=2)
    g.box(x0 + 0.085, x1 - 0.085, yf - 0.022, yf, z0 + 0.165, zb1 - 0.055, "copper", bevel=0.015, segs=2)
    zg = z0 + 0.3  # axe des bossages
    for x in (cx - 0.19, cx + 0.19):
        # bossage horizontal et tête de groupe en cloche (laiton)
        g.rod((x, yf - 0.02, zg), (x, yf - 0.06, zg), 0.026, pans(14), "steel")
        # tête de groupe chromée, cylindrique, bague de laiton
        g.lathe(x, yf - 0.065, z0 + 0.205, [(0.046, 0), (0.05, 0.008), (0.05, 0.045), (0.042, 0.06), (0.03, 0.075), (0.028, 0.095)],
                pans(16), "steel", cap_bottom=True, cap_top=True, smooth=True)
        g.cyl(x, yf - 0.065, z0 + 0.235, z0 + 0.247, 0.053, pans(16), "brass", bevel=0.003)
        # porte-filtre: panier évasé, deux becs, col d'acier et poignée noire tournée vers le barista
        zp = z0 + 0.168
        g.lathe(x, yf - 0.065, zp, [(0.03, 0), (0.044, 0.012), (0.05, 0.032), (0.052, 0.037)], pans(16), "steel",
                cap_bottom=True, cap_top=True, smooth=True)
        for dx in (-0.016, 0.016):
            g.lathe(x + dx, yf - 0.065, zp - 0.016, [(0.004, 0), (0.008, 0.016)], 8, "steel", cap_bottom=True, cap_top=False, smooth=True)
        g.rod((x, yf - 0.11, zp + 0.024), (x, yf - 0.15, zp + 0.02), 0.011, 10, "steel")
        g.rod((x, yf - 0.15, zp + 0.02), (x, yf - 0.27, zp + 0.005), 0.019, pans(12), "ink", smooth=True)
        g.sphere(x, yf - 0.272, zp + 0.005, 0.021, 0.021, 0.021, "ink", segs=pans(12), rings=6)
        # molette du robinet de vapeur au-dessus du groupe
        g.cyl(x, yf - 0.03, zb1 - 0.075, zb1 - 0.055, 0.02, pans(12), "brass", bevel=0.004)
    # manomètre au centre: lunette de laiton, cadran crème, aiguille
    man = g.cyl(cx, 0, 0, 0.014, 0.05, pans(20), "brass", bevel=0.004)
    face = g.cyl(cx, 0, 0.014, 0.017, 0.042, pans(20), "paper")
    for v in man + face:
        x, y, z = v.co.x, -v.co.y, v.co.z
        v.co = P(x, yf - 0.014 - z, z0 + 0.32 + y)
    g.quad([(cx - 0.003, yf - 0.0325, z0 + 0.318), (cx + 0.003, yf - 0.0325, z0 + 0.318), (cx + 0.022, yf - 0.0325, z0 + 0.345),
            (cx + 0.018, yf - 0.0325, z0 + 0.348)], "ink", normal_hint=(0, -1, 0))
    for k in range(7):
        a = math.radians(-135 + k * 45)
        px, pz = cx + 0.035 * math.sin(a), z0 + 0.32 + 0.035 * math.cos(a)
        g.box(px - 0.002, px + 0.002, yf - 0.0325, yf - 0.031, pz - 0.002, pz + 0.002, "ink", bevel=0)
    # buse vapeur (ouest, à droite du barista): molette, tube coudé, rotule, embout
    xs = x0 + 0.075
    g.cyl(xs, yf - 0.02, zb1 - 0.08, zb1 - 0.055, 0.022, pans(12), "brass", bevel=0.005)
    pts = [(xs, yf - 0.014, zg + 0.04), (xs, yf - 0.05, zg + 0.035), (xs - 0.005, yf - 0.08, zg + 0.015), (xs - 0.012, yf - 0.095, zg - 0.02),
           (xs - 0.018, yf - 0.1, z0 + 0.12), (xs - 0.02, yf - 0.1, z0 + 0.09)]
    for a_, b_ in zip(pts, pts[1:]):
        g.rod(a_, b_, 0.0085, 8, "steel", cap=False)
    g.sphere(xs, yf - 0.05, zg + 0.035, 0.016, 0.016, 0.016, "steel", segs=8, rings=5)
    # robinet d'eau chaude (est)
    xh = x1 - 0.075
    g.cyl(xh, yf - 0.02, zb1 - 0.08, zb1 - 0.055, 0.022, pans(12), "brass", bevel=0.005)
    g.rod((xh, yf - 0.014, zg), (xh, yf - 0.06, zg - 0.01), 0.01, 10, "steel")
    g.rod((xh, yf - 0.06, zg - 0.01), (xh, yf - 0.065, z0 + 0.17), 0.009, 10, "steel")
    # chauffe-tasses et galerie de laiton
    g.box(x0 + 0.03, x1 - 0.03, yf + 0.01, yb - 0.01, zb1, zb1 + 0.012, "steel", bevel=0.005)
    zr = zb1 + 0.065
    for (a, b) in (((x0 + 0.04, yf + 0.02), (x1 - 0.04, yf + 0.02)), ((x0 + 0.04, yb - 0.02), (x1 - 0.04, yb - 0.02)),
                   ((x0 + 0.04, yf + 0.02), (x0 + 0.04, yb - 0.02)), ((x1 - 0.04, yf + 0.02), (x1 - 0.04, yb - 0.02))):
        g.rod((a[0], a[1], zr), (b[0], b[1], zr), 0.006, 6, "brass", cap=False)
    for (x, y) in ((x0 + 0.04, yf + 0.02), (x1 - 0.04, yf + 0.02), (x0 + 0.04, yb - 0.02), (x1 - 0.04, yb - 0.02), (cx, yf + 0.02), (cx, yb - 0.02)):
        g.rod((x, y, zb1 + 0.012), (x, y, zr), 0.006, 6, "brass", cap=False)
        g.sphere(x, y, zr, 0.009, 0.009, 0.009, "brass", segs=6, rings=4)
    return g


def _coucher(g, x, y, z, deg):
    """Couche le dernier tour (construit debout à l'origine) vers le nord, incliné de `deg` depuis la verticale."""
    import bmesh as _bm
    from mathutils import Matrix
    vs = [v for v in g.bm.verts if abs(v.co.x) < 0.03 and abs(v.co.y) < 0.03 and -0.001 <= v.co.z <= 0.131]
    R = Matrix.Rotation(math.radians(deg), 4, "X")
    for v in vs:
        v.co = R @ v.co
        v.co.x += x
        v.co.y += -y
        v.co.z += z


def moulin():
    g = Geo("station_grinder")
    cx, cy = 9.78, 9.04
    z0 = WORK
    g.box(cx - 0.09, cx + 0.09, cy - 0.13, cy + 0.11, z0, z0 + 0.18, "steel_dark", bevel=0.02)
    g.box(cx - 0.06, cx + 0.06, cy - 0.15, cy - 0.11, z0 + 0.03, z0 + 0.05, "steel", bevel=0.004)
    g.cyl(cx, cy, z0 + 0.18, z0 + 0.32, 0.075, pans(14), "copper", bevel=0.01)
    g.cyl(cx, cy, z0 + 0.32, z0 + 0.335, 0.05, pans(12), "steel")
    g.lathe(cx, cy, z0 + 0.335, [(0.03, 0), (0.085, 0.09)], pans(14), "espresso", cap_bottom=False, cap_top=True)
    gl = Geo("glass_grinder", kind="glass")
    gl.lathe(cx, cy, z0 + 0.335, [(0.035, 0), (0.095, 0.13)], pans(14), "glass", cap_bottom=False, cap_top=False)
    g.cyl(cx, cy, z0 + 0.465, z0 + 0.48, 0.1, pans(14), "steel_dark")
    return g, gl


def caisse_et_livre():
    g = Geo("register")
    cx = 10.6
    z0 = WORK
    g.box(cx - 0.24, cx + 0.24, 8.84, 9.18, z0, z0 + 0.09, "walnut", bevel=0.01)
    g.box(cx - 0.08, cx + 0.08, 8.835, 8.84, z0 + 0.03, z0 + 0.06, "brass", bevel=0)
    g.box(cx - 0.2, cx + 0.2, 8.88, 9.12, z0 + 0.09, z0 + 0.17, "brass", bevel=0.015)
    for i in range(4):
        for j in range(3):
            g.box(cx - 0.15 + i * 0.09, cx - 0.09 + i * 0.09, 8.9 + j * 0.055, 8.94 + j * 0.055, z0 + 0.17, z0 + 0.185, "porcelain", bevel=0, drop=("bottom",))
    # afficheur sombre tourné vers les clients
    g.cyl(cx, 9.12, z0 + 0.17, z0 + 0.3, 0.012, 6, "brass")
    g.box(cx - 0.09, cx + 0.09, 9.1, 9.14, z0 + 0.3, z0 + 0.36, "slate", bevel=0.006)
    # livre d'or ouvert sur la tablette, près de la caisse (la cliente qui paie peut écrire)
    b = Geo("guest_book")
    bx, by = 10.08, 9.37
    b.box(bx - 0.17, bx + 0.17, by - 0.11, by + 0.11, LEDGE, LEDGE + 0.012, "book", bevel=0.004)
    for s in (-1, 1):
        v = b.box(min(bx, bx + s * 0.16), max(bx, bx + s * 0.16), by - 0.1, by + 0.1, LEDGE + 0.012, LEDGE + 0.024, "page", bevel=0.003)
    b.box(bx - 0.004, bx + 0.004, by - 0.1, by + 0.1, LEDGE + 0.024, LEDGE + 0.026, "book", bevel=0)
    for k in range(5):
        y = by - 0.06 + k * 0.028
        b.box(bx - 0.13, bx - 0.04 - (k % 2) * 0.02, y, y + 0.004, LEDGE + 0.024, LEDGE + 0.0255, "ink", bevel=0)
        b.box(bx + 0.03, bx + 0.12 - (k % 3) * 0.015, y, y + 0.004, LEDGE + 0.024, LEDGE + 0.0255, "ink", bevel=0)
    return [g, b]


def rail_tickets(joueurs):
    """Rail inox au-dessus de la passe, pendu à la solive par deux tiges; quatre tickets face au barista:
    pince de l'astre aqua, pince du croissant mauve, ticket libre, ticket qui attend (bandeau ambre, sablier)."""
    g = Geo("ticket_rail")
    yj = min(solives_y(), key=lambda y: abs(y - 9.2))
    yr = yj
    zr = 1.88
    g.rod((7.95, yr, zr), (8.75, yr, zr), 0.01, 8, "steel")
    for x in (7.98, 8.72):
        g.rod((x, yr, zr), (x, yr, JOIST_B), 0.006, 6, "steel")
    tickets = [(8.06, "orb"), (8.25, "crescent"), (8.44, None), (8.62, "alert")]
    yt = yr - 0.012  # face nord du ticket, vers le barista
    for x, clip in tickets:
        g.box(x - 0.06, x + 0.06, yt - 0.002, yt, zr - 0.19, zr - 0.02, "paper", bevel=0)
        # le texte du ticket est écrit par le jeu (toile posée par la scène Three.js, Patrick Hand)
        if clip == "alert":
            g.box(x - 0.06, x + 0.06, yt - 0.004, yt - 0.002, zr - 0.06, zr - 0.02, "alert", bevel=0)
            # sablier (deux triangles)
            g.quad([(x - 0.012, yt - 0.005, zr - 0.025), (x + 0.012, yt - 0.005, zr - 0.025), (x, yt - 0.005, zr - 0.04)], "alert_ink", normal_hint=(0, -1, 0))
            g.quad([(x, yt - 0.005, zr - 0.04), (x + 0.012, yt - 0.005, zr - 0.055), (x - 0.012, yt - 0.005, zr - 0.055)], "alert_ink", normal_hint=(0, -1, 0))
            g.box(x - 0.02, x + 0.02, yt - 0.01, yr + 0.01, zr - 0.012, zr + 0.025, "steel", bevel=0.004)
        elif clip:
            col = joueurs[clip]["couleur"]
            g.box(x - 0.035, x + 0.035, yt - 0.016, yr + 0.012, zr - 0.04, zr + 0.03, col, bevel=0.006)
            symbole(g, clip, x, yt - 0.0165, zr - 0.005, 0.045)
        else:
            g.box(x - 0.02, x + 0.02, yt - 0.01, yr + 0.01, zr - 0.012, zr + 0.025, "steel", bevel=0.004)
    return g


def _run(pts, flags):
    """Plus longue suite contiguë (sur un cercle) des points marqués, dans l'ordre."""
    n = len(pts)
    start = next(i for i in range(n) if flags[i] and not flags[i - 1])
    out = []
    i = start
    while flags[i % n]:
        out.append(pts[i % n])
        i += 1
        if len(out) >= n:
            break
    return out


def symbole_contour(clip, size):
    """Contour du symbole d'un joueur (repère du symbole: u à droite, v en haut, centré)."""
    n = 40
    if clip == "orb":
        r = size * 7.6 / 24
        return [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    # croissant de Duo: cercle de rayon 9,2 moins un cercle de rayon 7,4 décalé vers le haut à droite
    R, r2 = size * 9.2 / 24, size * 7.4 / 24
    off = (size * 4.1 / 24, size * 4.1 / 24)
    big = [(R * math.cos(2 * math.pi * i / n), R * math.sin(2 * math.pi * i / n)) for i in range(n)]
    outer = _run(big, [(p[0] - off[0]) ** 2 + (p[1] - off[1]) ** 2 > r2 ** 2 for p in big])
    small = [(off[0] + r2 * math.cos(2 * math.pi * i / n), off[1] + r2 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    inner = list(reversed(_run(small, [p[0] ** 2 + p[1] ** 2 < R ** 2 for p in small])))
    d = lambda a, b: (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2
    if d(outer[-1], inner[0]) > d(outer[-1], inner[-1]):
        inner.reverse()
    return outer + inner


def symbole(g, clip, x, y, z, size, facing=-1):
    """Symbole d'un joueur dans un plan vertical face au nord (facing=-1) ou au sud (+1), en « player_on »."""
    pts = symbole_contour(clip, size)
    # vu de face, u va vers la droite de l'observateur: vers l'ouest (-x) pour qui regarde vers le sud (face nord)
    g.quad([(x + facing * u, y, z + v) for u, v in pts], "player_on", normal_hint=(0, facing, 0))


# ------------------------------------------------------------------------------------------------
# Vaisselle et nourriture (120 %)

def tasse(g, x, y, z, kind="cappuccino", contenu=True, anse_deg=0.0, soucoupe=True):
    """Tasse et soucoupe au liseré vert bouteille. kind: espresso (7 cm) ou cappuccino (10 cm)."""
    s = 1.2
    if kind == "espresso":
        r0, r1, h, sr = 0.022 * s, 0.03 * s, 0.05 * s, 0.055 * s
    else:
        r0, r1, h, sr = 0.03 * s, 0.05 * s, 0.065 * s, 0.075 * s
    n12, n16 = pans(12), pans(16)
    if soucoupe:
        g.lathe(x, y, z, [(sr * 0.55, 0), (sr * 0.9, 0.004), (sr, 0.012), (sr * 0.97, 0.014), (sr * 0.5, 0.008)], n16, "porcelain",
                keys=["porcelain", "porcelain", "rim", "porcelain"], cap_bottom=True, cap_top=True)
    zc = z + (0.008 if soucoupe else 0.0)
    t = 0.004
    g.lathe(x, y, zc, [(r0 * 0.8, 0), (r0, 0.006), (r1, h - 0.005), (r1, h), (r1 - t, h), (r0 - t, 0.012), (0.0, 0.01)], n12, "porcelain",
            keys=["porcelain", "porcelain", "rim", "porcelain", "porcelain", "porcelain"], cap_bottom=True, cap_top=False)
    if contenu:
        top = "milk" if kind == "cappuccino" else "crema"
        g.cyl(x, y, zc + 0.012, zc + h - 0.012, r1 - t - 0.001, n12, top, r_top=r1 - t - 0.001, cap_bottom=False)
        if kind == "cappuccino":
            # dessin de lait: cœur de crème au centre de la mousse
            g.cyl(x, y, zc + h - 0.012, zc + h - 0.011, (r1 - t) * 0.55, n12, "crema", cap_bottom=False)
    # anse (anneau aplati) côté est par défaut
    a = math.radians(anse_deg)
    ca, sa = math.cos(a), math.sin(a)
    pts = []
    for i in range(7):
        t_ = math.pi * i / 6
        pts.append((r1 * 0.95 + 0.018 * s * math.sin(t_), zc + h * 0.25 + h * 0.5 * (1 - math.cos(t_)) / 2 * 1.4))
    for i in range(len(pts) - 1):
        (u0, w0), (u1, w1) = pts[i], pts[i + 1]
        g.rod((x + u0 * ca, y + u0 * sa, w0), (x + u1 * ca, y + u1 * sa, w1), 0.005, 6, "porcelain")


def assiette(g, x, y, z, r=0.12):
    n = pans(16)
    g.lathe(x, y, z, [(r * 0.55, 0), (r * 0.6, 0.004), (r * 0.82, 0.006), (r * 0.94, 0.014), (r, 0.016), (r * 0.97, 0.018), (r * 0.6, 0.009)],
            n, "porcelain", keys=["porcelain", "porcelain", "porcelain", "rim", "rim", "porcelain"], cap_bottom=True, cap_top=True)


def croissant_geo(g, x, y, z, deg=0.0, s=1.2):
    """Croissant de 16 cm à 120 %: tube balayé le long d'un arc en lune, pointes effilées et recourbées,
    renflements des tours de pâte, dessous aplati. Doré (croûte), bouts un peu plus clairs (mie)."""
    bm = g.bm
    before = set(bm.verts)
    n_t, n_r = 15, pans(8)
    R = 0.055 * s
    rings = []
    for i in range(n_t):
        t = i / (n_t - 1) * 2 - 1
        a = t * 1.25
        cx, cy = R * math.sin(a), R * (1 - math.cos(a)) * 0.9 - R * 0.35
        tx, ty = math.cos(a), math.sin(a) * 0.9
        ln = math.hypot(tx, ty)
        nx, ny = -ty / ln, tx / ln  # normale horizontale à l'arc
        rad = 0.028 * s * (1 - abs(t) ** 1.7 * 0.82) * (1 + 0.09 * math.cos(t * math.pi * 3.5))
        ring = []
        for j in range(n_r):
            b = 2 * math.pi * j / n_r
            u, w = math.cos(b), math.sin(b)
            hz = rad * 0.72 * w
            if hz < -rad * 0.32:
                hz = -rad * 0.32  # dessous posé à plat
            px, py = cx + nx * rad * u, cy + ny * rad * u
            ring.append(bm.verts.new(P(x + px, y + py, z + rad * 0.32 + hz)))
        rings.append((ring, abs(t)))
    faces = []
    for k in range(n_t - 1):
        ra, ta = rings[k]
        rb, _ = rings[k + 1]
        key = "crumb" if ta > 0.85 else "crust"
        for j in range(n_r):
            jj = (j + 1) % n_r
            f = bm.faces.new([ra[j], ra[jj], rb[jj], rb[j]])
            f.material_index = g.mi(key)
            faces.append(f)
    for ring, _ in (rings[0], rings[-1]):
        f = bm.faces.new(ring)
        f.material_index = g.mi("crumb")
        faces.append(f)
    bmesh.ops.recalc_face_normals(bm, faces=faces)
    for f in faces:
        f.smooth = True
    vs = [v for v in bm.verts if v not in before]
    Geo.rotate_z(vs, x, y, deg)
    return vs


# ------------------------------------------------------------------------------------------------
# Mobilier de la salle

def table_ronde(g, cx, cy):
    g.cyl(cx, cy, 0, 0.03, 0.22, pans(16), "steel_dark", r_top=0.2, bevel=0.01, cap_bottom=False)
    g.cyl(cx, cy, 0.03, 0.7, 0.028, pans(8), "steel_dark", bevel=0)
    g.cyl(cx, cy, 0.68, 0.72, 0.08, pans(10), "steel_dark", bevel=0.006)
    g.cyl(cx, cy, 0.72, 0.75, 0.3, pans(20), "oak_dark", bevel=0.012 if A() else 0.004)


def table_carree(g, x0, y0, s=0.7):
    leg = 0.05 if A() else 0.04
    for (x, y) in ((x0 + 0.04, y0 + 0.04), (x0 + s - 0.04 - leg, y0 + 0.04), (x0 + 0.04, y0 + s - 0.04 - leg), (x0 + s - 0.04 - leg, y0 + s - 0.04 - leg)):
        g.box(x, x + leg, y, y + leg, 0, 0.7, "oak_honey", bevel=0.01, edges="vertical")
    for (a, b, c, d) in ((x0 + 0.06, x0 + s - 0.06, y0 + 0.05, y0 + 0.07), (x0 + 0.06, x0 + s - 0.06, y0 + s - 0.07, y0 + s - 0.05),
                         (x0 + 0.05, x0 + 0.07, y0 + 0.06, y0 + s - 0.06), (x0 + s - 0.07, x0 + s - 0.05, y0 + 0.06, y0 + s - 0.06)):
        g.box(a, b, c, d, 0.6, 0.7, "oak_honey", bevel=0.006)
    g.box(x0, x0 + s, y0, y0 + s, 0.71, 0.75, "oak_dark", bevel=0.015 if A() else 0.005)


def chaise(g, x0, y0, dossier):
    """Chaise paillée (bible, style campagne) dans le rectangle de place du plan (0,45 m), dossier du côté
    indiqué (N, S, E, W): assise à 0,45 m, dossier à échelons jusqu'à 0,90 m."""
    s = 0.45
    cx, cy = x0 + s / 2, y0 + s / 2
    vs = []
    leg = 0.04 if A() else 0.03
    m = 0.025
    # construite dossier au nord, puis tournée
    for (x, y) in ((x0 + m, y0 + m), (x0 + s - m - leg, y0 + m), (x0 + m, y0 + s - m - leg), (x0 + s - m - leg, y0 + s - m - leg)):
        back = y < cy
        top = 0.9 if back else 0.44
        vs += g.box(x, x + leg, y, y + leg, 0, top, "oak_honey", bevel=0.01 if A() else 0.004, edges="nobottom")
    for z in (0.14, 0.26):
        vs += g.box(x0 + m + 0.01, x0 + s - m - 0.01, y0 + s - m - leg / 2 - 0.008, y0 + s - m - leg / 2 + 0.008, z, z + 0.018, "oak_honey", bevel=0.004)
        vs += g.box(x0 + m + leg / 2 - 0.008, x0 + m + leg / 2 + 0.008, y0 + m + 0.01, y0 + s - m - 0.01, z + 0.06, z + 0.078, "oak_honey", bevel=0.004)
        vs += g.box(x0 + s - m - leg / 2 - 0.008, x0 + s - m - leg / 2 + 0.008, y0 + m + 0.01, y0 + s - m - 0.01, z + 0.06, z + 0.078, "oak_honey", bevel=0.004)
    # assise paillée bombée dans un cadre
    vs += g.box(x0 + m, x0 + s - m, y0 + m, y0 + s - m, 0.4, 0.44, "oak_honey", bevel=0.008)
    vs += g.box(x0 + m + 0.02, x0 + s - m - 0.02, y0 + m + 0.02, y0 + s - m - 0.02, 0.43, 0.46 if A() else 0.452, "straw", bevel=0.015 if A() else 0.006)
    # échelons du dossier, un peu cintrés (trois)
    for z in (0.58, 0.7, 0.82):
        vs += g.box(x0 + m + leg, x0 + s - m - leg, y0 + m + 0.005, y0 + m + leg - 0.005, z, z + 0.055, "oak_honey", bevel=0.008 if A() else 0.004)
    rot = {"N": 0, "E": 90, "S": 180, "W": 270}[dossier]
    Geo.rotate_z(vs, cx, cy, rot)


def suspension(g, emit, x, y, kind):
    """Suspension: émaillée vert bouteille au comptoir, terre cuite aux tables. Bas de l'abat-jour à 2,10 m
    (rien sous 2,05 m sur un passage), fil jusqu'au plafond entre deux solives ou à la solive."""
    zb = 2.1
    if kind == "enamel":
        prof = [(0.18, 0), (0.17, 0.02), (0.11, 0.1), (0.05, 0.16), (0.025, 0.2)]
        key = "enamel"
    else:
        prof = [(0.14, 0), (0.13, 0.03), (0.09, 0.13), (0.04, 0.17), (0.02, 0.19)]
        key = "shade_clay"
    g.lathe(x, y, zb, prof, pans(14), key, cap_bottom=False, cap_top=True)
    # intérieur clair (émissif) et ampoule
    inner = [(r - 0.006, dz + 0.004) for r, dz in prof]
    vs = emit.lathe(x, y, zb, inner, pans(14), "emit", cap_bottom=False, cap_top=False)
    for f in {f for v in vs for f in v.link_faces}:
        f.normal_flip()
    emit.sphere(x, y, zb + 0.05, 0.035, 0.035, 0.045, "emit", segs=10, rings=6)
    g.rod((x, y, zb + prof[-1][1]), (x, y, H), 0.005, 6, "ink")
    g.cyl(x, y, H - 0.02 if not under_joist(y) else JOIST_B - 0.02, H if not under_joist(y) else JOIST_B, 0.04, 10, "linen")
    return (x, y, zb + 0.06)


def under_joist(y):
    return any(abs(y - j) <= 0.06 for j in solives_y())


def plante(g, x, y, z):
    """Plante en pot (repli scripté si le modèle Meshy manque)."""
    g.lathe(x, y, z, [(0.07, 0), (0.09, 0.14), (0.1, 0.15), (0.1, 0.17), (0.085, 0.17)], pans(10), "pot", cap_top=True)
    for (dx, dy, dz, r) in ((0, 0, 0.3, 0.11), (0.06, 0.03, 0.38, 0.08), (-0.05, -0.02, 0.4, 0.08), (0.01, -0.05, 0.47, 0.07)):
        g.sphere(x + dx, y + dy, z + dz, r, r, r * 0.9, "leaf" if r > 0.09 else "leaf_light", segs=10, rings=6)


# ------------------------------------------------------------------------------------------------
# Dehors: la place du Tilleul

def place():
    g = Geo("street", kind="ext")
    # trottoir de la terrasse (y 13,0 à 15,8, dessus à 0 comme le sol du café: les meubles de la terrasse s'y posent à
    # y = 0), bordure, place pavée 14 cm plus bas. La terrasse du plan va jusqu'à 15,50 (store) et ses tables à 14,75.
    g.box(-14, 30, 13.0, 15.8, -0.06, 0.0, "paving", bevel=0, drop=("bottom",))
    g.box(-14, 30, 15.8, 15.95, -0.16, 0.0, "stone_shade", bevel=0, drop=("bottom",))
    g.box(-14, 30, 15.95, 48, -0.2, -0.14, "paving", bevel=0, drop=("bottom",))
    # étages du café (le logement de Simone): pierre blonde de 2,80 à 6,50 m, trois fenêtres à volets, corniche
    g.box(3.6, 11.5, 13.0, 13.1, 2.8, 6.5, "stone", bevel=0)
    g.box(3.5, 11.6, 13.0, 13.3, 2.62, 2.8, "stone_shade", bevel=0.01)
    g.box(3.5, 11.6, 13.0, 13.35, 6.5, 6.7, "stone_shade", bevel=0.01)
    for xc in (5.4, 7.5, 9.6):
        for (z0, z1) in ((3.4, 4.8),):
            g.box(xc - 0.45, xc + 0.45, 13.1, 13.12, z0, z1, "ink", bevel=0)
            for side in (-1, 1):
                xs = xc + side * 0.75
                g.box(xs - 0.27, xs + 0.27, 13.1, 13.16, z0, z1, "shutter", bevel=0)
            g.box(xc - 0.55, xc + 0.55, 13.1, 13.18, z0 - 0.08, z0, "stone_shade", bevel=0)
    # façade extérieure du café et de ses voisins (pierre blonde), au-dessus de la vitrine
    g.box(-14, 3.6, 13.0, 13.1, -0.02, 6.5, "stone", bevel=0)
    g.box(11.5, 30, 13.0, 13.1, -0.02, 6.5, "stone", bevel=0)
    # maisons à l'ouest de la place (mairie-école à l'est, église au sud: plan)
    for (x, y0, y1, h, seed) in ((-4.0, 15.5, 22.0, 7.5, 1), (-4.5, 22.2, 29.0, 6.8, 2)):
        maison(g, x, y0, y1, h, "e", seed)
    for (x, y0, y1, h, seed) in ((19.0, 15.5, 24.0, 8.2, 3), (19.5, 24.2, 30.0, 6.6, 4)):
        maison(g, x, y0, y1, h, "w", seed)
    eglise(g)
    # banc de la patronne sous la vitrine (dos au mur), ardoise de trottoir tournée vers les passants
    for x in (5.08, 6.12):
        g.box(x - 0.03, x + 0.03, 13.12, 13.45, -0.02, 0.42, "steel_dark", bevel=0.008)
    g.box(5.0, 6.2, 13.08, 13.5, 0.42, 0.47, "beam", bevel=0.01)
    g.box(5.0, 6.2, 13.1, 13.15, 0.47, 0.85, "beam", bevel=0.01)
    # l'ardoise de trottoir est un objet déplaçable (ardoise_trottoir.glb)
    # fontaine (pierre blonde, eau)
    fx, fy = 13.6, 17.6
    g.cyl(fx, fy, -0.16, 0.55, 0.8, pans(16), "stone", bevel=0.03)
    g.cyl(fx, fy, 0.4, 0.5, 0.7, pans(16), "water", cap_bottom=False)
    g.cyl(fx, fy, 0.5, 1.5, 0.12, pans(8), "stone_shade")
    g.cyl(fx, fy, 1.45, 1.6, 0.32, pans(12), "stone", r_top=0.38, bevel=0.02)
    # tilleul
    t = Geo("tree_lime", kind="ext")
    tx, ty = 2.6, 17.4
    t.cyl(tx, ty, -0.16, 2.6, 0.22, pans(8), "bark", r_top=0.16)
    for (dx, dy, dz, r, k) in ((0, 0, 4.0, 1.9, "tree"), (0.9, 0.5, 4.6, 1.2, "tree_light"), (-0.9, -0.3, 4.5, 1.2, "tree"),
                               (0.2, -0.8, 5.0, 1.1, "tree_light"), (-0.3, 0.9, 3.4, 1.2, "tree")):
        t.sphere(tx + dx, ty + dy, dz, r, r, r * 0.85, k, segs=pans(12), rings=8, smooth=not A())
    return [g, t]


def maison(g, x, y0, y1, h, face, seed):
    """Maison de pierre blonde à deux niveaux, toit de tuiles; fenêtres à volets gris-bleu sur la place."""
    d = 7.0
    if face == "e":
        bx0, bx1 = x - d, x
    else:
        bx0, bx1 = x, x + d
    g.box(bx0, bx1, y0, y1, -0.2, h, "stone", bevel=0)
    # toit à deux pans, faîtage nord-sud
    ridge = h + 2.4
    xm = (bx0 + bx1) / 2
    for (a, b) in ((bx0 - 0.3, xm), (xm, bx1 + 0.3)):
        za = h - 0.15 if a < xm else ridge
        zb = ridge if a < xm else h - 0.15
        g.quad([(a, y0 - 0.3, za), (a, y1 + 0.3, za), (b, y1 + 0.3, zb), (b, y0 - 0.3, zb)], "roof", normal_hint=(0, 0, 1))
    xf = bx1 if face == "e" else bx0
    s = 1 if face == "e" else -1
    n = int((y1 - y0) // 2.1)
    for k in range(n):
        yc = y0 + (y1 - y0) * (k + 0.5) / n
        for z0 in (0.9, 3.9) if h < 7 else (0.9, 3.9):
            z1 = z0 + 1.5 if z0 > 1 else z0 + 1.4
            if z0 < 1 and k == n // 2:
                z0, z1 = 0.0, 2.3  # porte
                g.box(xf - 0.05 * s if s < 0 else xf - 0.02, xf + 0.02 if s > 0 else xf + 0.05, yc - 0.5, yc + 0.5, -0.02, z1, "beam", bevel=0)
                continue
            g.box(min(xf, xf + 0.02 * s), max(xf, xf + 0.02 * s), yc - 0.45, yc + 0.45, z0, z1, "ink" if (seed + k) % 3 else "glass_ext", bevel=0)
            for side in (-1, 1):
                ys = yc + side * 0.75
                g.box(min(xf, xf + 0.06 * s), max(xf, xf + 0.06 * s), ys - 0.27, ys + 0.27, z0, z1, "shutter", bevel=0)
            g.box(min(xf, xf + 0.08 * s), max(xf, xf + 0.08 * s), yc - 0.55, yc + 0.55, z0 - 0.08, z0, "stone_shade", bevel=0)


def eglise(g):
    """Église au fond de la place (façade simple et clocher; aucun édifice réel)."""
    y0 = 34.0
    g.box(4.0, 13.0, y0, y0 + 12, -0.2, 9.0, "stone", bevel=0)
    g.quad([(4.0, y0, 9.0), (8.5, y0, 12.5), (13.0, y0, 9.0)], "stone", normal_hint=(0, -1, 0))
    g.quad([(3.8, y0 - 0.2, 9.0), (3.8, y0 + 12.2, 9.0), (8.5, y0 + 12.2, 12.5), (8.5, y0 - 0.2, 12.5)], "roof", normal_hint=(-1, 0, 1))
    g.quad([(8.5, y0 - 0.2, 12.5), (8.5, y0 + 12.2, 12.5), (13.2, y0 + 12.2, 9.0), (13.2, y0 - 0.2, 9.0)], "roof", normal_hint=(1, 0, 1))
    # portail et rosace
    g.box(7.6, 9.4, y0 - 0.05, y0, -0.2, 3.2, "beam", bevel=0)
    g.cyl(8.5, y0 - 0.02, 0, 0.02, 0.8, 16, "stone_shade")
    # clocher carré et flèche de zinc
    g.box(9.8, 12.6, y0 + 0.5, y0 + 3.3, 9.0, 15.5, "stone", bevel=0)
    g.box(10.6, 11.8, y0 + 0.47, y0 + 0.5, 12.8, 14.4, "ink", bevel=0)
    g.lathe(11.2, y0 + 1.9, 15.5, [(2.0, 0), (0.0, 4.5)], 4, "zinc", phase=45, cap_bottom=True, cap_top=False)
