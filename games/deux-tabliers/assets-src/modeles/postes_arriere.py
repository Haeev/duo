"""Postes de l'arrière-comptoir, de la réserve et de la cour d'Ormeval, refaits après la séance du 2026-11-09 (Deux Tabliers 0.2.4).

Usage: duo-python games/deux-tabliers/assets-src/modeles/postes_arriere.py [-- --seulement id1,id2] [--sans-ao]

Les joueurs ne reconnaissaient pas ces postes (blocs, contours, objets enfoncés dans le plan): chaque modèle se lit au premier
regard et se pose là où le plan et les données le mettent (`donnees/adresses/village.json`, `donnees/departs/village.json`,
`donnees/service/reglages.json`, `donnees/meubles.json`). Cotes et raisons dans les docstrings.

Même chaîne que objets.py (atlas partagé `dt_meubles`, occlusion dans les couleurs de sommets, un GLB par identifiant,
fiche `fiches/postes_arriere.json`). Repère du plan: x vers l'est, y vers le sud (l'avant du modèle, +Z glTF), z en haut.
Pivots: au sol au centre de l'emprise pour les postes posés au sol (plonge, réfrigérateurs, lave-vaisselle, étagères,
palette), centre du dessous pour les objets posés sur un plan (rail, vitrine, range-vaisselle, cartons).

Inscriptions en géométrie (police Patrick Hand, OFL, paquet @fontsource du jeu): pas de texture de plus.
"""

import argparse
import glob
import json
import math
import os
import sys

import bpy  # noqa: F401
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
import commun as K  # noqa: E402
from geo import Geo, P  # noqa: E402

DONNEES = os.path.normpath(os.path.join(ICI, "..", "..", "donnees"))
CATALOGUE = {}


def objet(ident, categorie, budget, accroche="surface", nom=""):
    def deco(fn):
        CATALOGUE[ident] = dict(fn=fn, style="neutre", categorie=categorie, budget=budget, accroche=accroche, nom=nom)
        return fn
    return deco


def sk(name, x, y, z, brut=False):
    return {"name": name, "x": x, "y": y, "z": z, "brut": brut}


# ------------------------------------------------------------------------------------------------
# Inscriptions

_POLICE = None


def police():
    """Patrick Hand (OFL), la main des tickets du jeu: lue dans les paquets @fontsource installés par pnpm."""
    global _POLICE
    if _POLICE is None:
        motifs = [
            os.path.join(K.RACINE, "games", "deux-tabliers", "node_modules", "@fontsource", "patrick-hand", "files",
                         "patrick-hand-latin-400-normal.woff"),
            os.path.join(K.RACINE, "node_modules", ".pnpm", "@fontsource+patrick-hand@*", "node_modules", "@fontsource",
                         "patrick-hand", "files", "patrick-hand-latin-400-normal.woff"),
        ]
        trouves = [p for m in motifs for p in sorted(glob.glob(m))]
        if not trouves:
            raise FileNotFoundError("police Patrick Hand introuvable: lancer pnpm install à la racine du dépôt")
        _POLICE = bpy.data.fonts.load(trouves[0])
    return _POLICE


def _glyphes(s):
    """Triangles plats d'un texte (courbe FONT de Blender, résolution 1: environ 20 triangles par lettre)."""
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = s
    cu.font = police()
    cu.size = 1.0
    cu.resolution_u = 1
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    ob = bpy.data.objects.new("txt", cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    verts = [(v.co.x, v.co.y) for v in me.vertices]
    faces = [list(p.vertices) for p in me.polygons]
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.curves.remove(cu)
    bpy.data.meshes.remove(me)
    return verts, faces


_CAP = None


def ecrire(g, s, key, centre, u, v, n, hauteur, largeur_max=None):
    """Écrit `s` à plat: `centre` (point du plan), `u` sens de lecture, `v` haut des lettres, `n` normale (côté lu),
    vecteurs unitaires du plan. `hauteur`: hauteur d'une capitale (mesurée sur un E); largeur bornée par `largeur_max`."""
    global _CAP
    if _CAP is None:
        ve, _ = _glyphes("E")
        _CAP = max(p[1] for p in ve) - min(p[1] for p in ve)
    verts, faces = _glyphes(s)
    xs = [p[0] for p in verts]
    ys = [p[1] for p in verts]
    sc = hauteur / _CAP
    larg = (max(xs) - min(xs)) * sc
    if largeur_max is not None and larg > largeur_max:
        sc *= largeur_max / larg
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    U, V = Vector(u), Vector(v)
    C = Vector(centre)
    bm = g.bm
    vs = []
    for x, y in verts:
        p = C + U * ((x - cx) * sc) + V * ((y - cy) * sc)
        vs.append(bm.verts.new(P(p.x, p.y, p.z)))
    nb = P(*n)
    mi = g.mi(key)
    for f in faces:
        try:
            face = bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue
        face.normal_update()
        if face.normal.dot(nb) < 0:
            face.normal_flip()
        face.material_index = mi
        face.smooth = False
    return larg


FACE = dict(u=(1, 0, 0), v=(0, 0, 1), n=(0, 1, 0))  # face avant (sud), lue debout devant
DESSUS = dict(u=(1, 0, 0), v=(0, -1, 0), n=(0, 0, 1))  # dessus, lu depuis l'avant


def quad_face(g, x0, x1, z0, z1, y, key):
    """Rectangle vertical tourné vers l'avant (+y du plan)."""
    g.quad([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], key, normal_hint=(0, 1, 0))


def quad_dessus(g, x0, x1, y0, y1, z, key):
    g.quad([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], key, normal_hint=(0, 0, 1))


def tasse_retournee(g, x, y, z, r_bord, r_pied, h, segs=10, anse=True):
    """Tasse posée à l'envers (bord en bas): ce qui se range propre sur une étagère."""
    g.lathe(x, y, z, [(r_bord, 0), (r_bord * 0.96, h * 0.55), (r_pied, h), (0.0, h)], segs, "porcelain",
            cap_bottom=True, cap_top=False, smooth=True)
    if anse:
        g.rod((x + r_bord * 0.9, y, z + h * 0.25), (x + r_bord + 0.012, y, z + h * 0.5), 0.0045, 5, "porcelain", cap=False)
        g.rod((x + r_bord + 0.012, y, z + h * 0.5), (x + r_bord * 0.75, y, z + h * 0.8), 0.0045, 5, "porcelain", cap=False)


# ------------------------------------------------------------------------------------------------
# Arrière-comptoir et passe

@objet("station_ticket_rail", "poste", 600, nom="Rail à tickets de la passe")
def o_rail(g):
    """Rail de comptoir vissé sur la tablette de la passe (données: `rail-1`, ancré à la passe, y 1,105 m, x 8,05 à 8,65,
    z 9,375): barre inox de 60 cm sur deux montants de 42 cm, glissière à billes côté barista. À 1,53-1,56 m, il se voit de la
    caisse (10,6; 8,25) par-dessus la galerie de la machine (1,48 m), et de la machine (9,15; 8,25).
    Avant du modèle (+Z) = côté barista: le jeu le pose tourné de 180 degrés (MODEL_TURN_DEG).
    Tickets: nœuds `ticket_0` à `ticket_5` (papier vierge accroché aux billes), le jeu montre autant de tickets qu'il y a
    de commandes en cours et cache les autres."""
    L, zb, hb = 0.6, 0.42, 0.036
    for x in (-0.27, 0.27):
        g.box(x - 0.028, x + 0.028, -0.02, 0.02, 0.0, 0.006, "steel", bevel=0.002)
        g.cyl(x, 0.0, 0.006, zb, 0.009, 10, "steel")
    # profil du rail et glissière sombre côté barista
    g.box(-L / 2, L / 2, -0.014, 0.014, zb, zb + hb, "steel", bevel=0.003)
    g.box(-L / 2 + 0.006, L / 2 - 0.006, 0.0138, 0.0152, zb + 0.004, zb + 0.016, "steel_dark", bevel=0)
    for s in (-1, 1):
        g.box(s * L / 2 - 0.004, s * L / 2 + 0.004, -0.016, 0.016, zb - 0.002, zb + hb + 0.002, "rubber", bevel=0.002)
    socks = []
    extra = []
    for i in range(6):
        x = -0.25 + i * 0.1
        g.cyl(x, 0.016, zb + 0.002, zb + 0.016, 0.0075, 6, "chrome")
        socks.append(sk(f"ticket_{i}", x, 0.02, zb + 0.002))
        t = Geo(f"ticket_{i}")
        t.box(x - 0.038, x + 0.038, 0.0175, 0.0182, zb - 0.118, zb + 0.004, "paper", bevel=0)
        # écriture du ticket (traits d'encre): lisible comme une commande, sans prétendre dire laquelle
        for j, (a, b) in enumerate(((-0.03, 0.02), (-0.03, 0.028), (-0.03, 0.006), (-0.03, 0.024))):
            z = zb - 0.022 - j * 0.02
            t.quad([(x + a, 0.0187, z), (x + b, 0.0187, z), (x + b, 0.0187, z + 0.0045), (x + a, 0.0187, z + 0.0045)], "ink",
                   normal_hint=(0, 1, 0))
        extra.append(t)
    return {"sockets": socks, "extra_geos": extra,
            "note": "pied sur la tablette de la passe (1,105 m), barre à 0,42-0,456 m; avant = barista (poser tourné de 180°); "
                    "nœuds ticket_0 à ticket_5 à montrer selon les commandes en cours"}


@objet("station_vitrine", "vitrine", 1000, nom="Vitrine réfrigérée à viennoiseries")
def o_vitrine(g):
    """Vitrine de comptoir (0,50 x 0,30 x 0,30 m) sur l'arrière-comptoir, sous l'ardoise murale (x 8,78 à 9,28, z 7,13 à
    7,43; données: `vitrine-1`, x +0,53 et z -0,12 de l'arrière-comptoir). Pourquoi là: ni sur le plan du réfrigérateur
    (x 8,00 à 8,75, où l'on prépare), ni sous les étagères murales (consoles à 1,14 m); le dessus (1,21 m) passe sous le
    cadre de l'ardoise (1,22 m) et l'ardoise, qui affiche la carte, est juste au-dessus des viennoiseries.
    Socle de noyer ventilé (froid), deux plateaux inox, montants de laiton, vitres droites coulissantes devant et vitres
    de côté. Emplacements des produits: nœuds `slot_0` à `slot_11` (0 à 5 en bas, 6 à 11 en haut; trois colonnes, deux
    rangs), à remplir par le jeu selon le stock de la vitrine."""
    w, d, h = 0.50, 0.30, 0.30
    zb, zt = 0.06, h - 0.02
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.0, zb, "t:walnut", bevel=0.006, drop=("bottom",))
    # grille du groupe froid et inscription dorée sur le socle
    g.box(-0.225, -0.155, d / 2, d / 2 + 0.003, 0.014, 0.046, "steel_dark", bevel=0)
    for z in (0.02, 0.029, 0.038):
        g.box(-0.222, -0.158, d / 2 + 0.003, d / 2 + 0.005, z, z + 0.003, "brass", bevel=0)
    ecrire(g, "Viennoiseries", "gold", (0.04, d / 2 + 0.0015, zb / 2), **FACE, hauteur=0.024, largeur_max=0.33)
    # plateaux
    g.box(-w / 2 + 0.012, w / 2 - 0.012, -d / 2 + 0.012, d / 2 - 0.012, zb, zb + 0.004, "steel", bevel=0, drop=("bottom",))
    zp = 0.165
    g.box(-w / 2 + 0.012, w / 2 - 0.012, -d / 2 + 0.012, d / 2 - 0.03, zp, zp + 0.004, "steel", bevel=0)
    g.box(-w / 2 + 0.012, w / 2 - 0.012, d / 2 - 0.03, d / 2 - 0.024, zp - 0.006, zp + 0.006, "brass", bevel=0.001)
    # fond, montants, dessus
    g.box(-w / 2 + 0.012, w / 2 - 0.012, -d / 2, -d / 2 + 0.01, zb, zt, "oak_dark", bevel=0)
    for x in (-w / 2, w / 2 - 0.012):
        for y in (-d / 2, d / 2 - 0.012):
            g.box(x, x + 0.012, y, y + 0.012, zb, zt, "brass", bevel=0.002)
    g.box(-w / 2 - 0.005, w / 2 + 0.005, -d / 2 - 0.005, d / 2 + 0.005, zt, h, "t:walnut", bevel=0.005)
    # vitres coulissantes devant (deux panneaux décalés, rails de laiton), vitres de côté
    yv = d / 2 - 0.004
    quad_face(g, -w / 2 + 0.012, 0.012, zb + 0.004, zt, yv, "glass")
    quad_face(g, -0.012, w / 2 - 0.012, zb + 0.004, zt, yv - 0.006, "glass")
    for x, y in ((0.012, yv), (-0.012, yv - 0.006)):
        g.box(x - 0.003, x + 0.003, y - 0.002, y + 0.002, zb + 0.004, zt, "brass", bevel=0)
    for x in (-0.03, 0.03):
        g.cyl(x, yv + 0.004 if x < 0 else yv - 0.002, zb + 0.06, zb + 0.09, 0.004, 6, "brass")
    for s in (-1, 1):
        x = s * (w / 2 - 0.004)
        g.quad([(x, -d / 2 + 0.01, zb), (x, d / 2 - 0.012, zb), (x, d / 2 - 0.012, zt), (x, -d / 2 + 0.01, zt)], "glass",
               normal_hint=(s, 0, 0))
    socks = []
    i = 0
    for z in (zb + 0.004, zp + 0.004):
        for y in (-0.06, 0.06):
            for x in (-0.15, 0.0, 0.15):
                socks.append(sk(f"slot_{i}", x, y, z, brut=True))
                i += 1
    return {"sockets": socks,
            "note": "vitre et inscription vers le barista et la salle (+Z); slot_0..5 plateau bas (z 0,064), slot_6..11 plateau "
                    "haut (z 0,169), rang du fond puis rang de devant, colonnes ouest, centre, est"}


@objet("station_cup_shelf", "etagere", 1000, nom="Range-vaisselle propre")
def o_range_vaisselle(g):
    """Petite étagère de noyer à deux niveaux (0,34 x 0,28 x 0,25 m) au bout de l'arrière-comptoir (données: `pile-tasses-1`,
    x 9,70: de 9,53 à 9,87, le plan s'arrête à 9,90). La vaisselle propre se voit: pile d'assiettes et verres retournés en
    bas, tasses retournées en haut; le centre du dessus reste libre (emplacement `dessus` des données, 0,25 m)."""
    w, d = 0.34, 0.28
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.0, 0.016, "t:walnut", bevel=0.004, drop=("bottom",))
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.235, 0.25, "t:walnut", bevel=0.004)
    for x in (-w / 2 + 0.014, w / 2 - 0.014):
        for y in (-d / 2 + 0.014, d / 2 - 0.014):
            g.cyl(x, y, 0.016, 0.235, 0.006, 6, "chrome")
    g.rod((-w / 2 + 0.014, -d / 2 + 0.014, 0.13), (w / 2 - 0.014, -d / 2 + 0.014, 0.13), 0.004, 6, "chrome", cap=False)
    # pile de cinq assiettes (24 cm, liseré vert de la maison sur chaque bord)
    prof = [(0.065, 0.0), (0.11, 0.008)]
    keys = ["porcelain"]
    z = 0.008
    for k in range(5):
        prof += [(0.116, z + 0.004), (0.116, z + 0.008)]
        keys += ["porcelain", "rim"]
        z += 0.012
    prof += [(0.105, z), (0.07, z - 0.004), (0.0, z - 0.004)]
    keys += ["porcelain", "porcelain", "porcelain"]
    g.lathe(-0.045, 0.0, 0.016, prof, 10, "porcelain", keys=keys, cap_bottom=True, cap_top=False, smooth=True)
    # verres retournés à droite
    for y in (-0.06, 0.06):
        g.lathe(0.125, y, 0.016, [(0.034, 0), (0.036, 0.11), (0.0, 0.11)], 10, "glass", cap_bottom=False, cap_top=False)
    # tasses à espresso retournées sur le dessus, centre libre
    for (x, y) in ((-0.11, -0.085), (0.0, -0.085), (0.11, -0.085), (-0.12, 0.08), (0.12, 0.08)):
        tasse_retournee(g, x, y, 0.25, 0.034, 0.024, 0.058, segs=10, anse=(y < 0))
    return {"sockets": [sk("dessus", 0.0, 0.0, 0.25)],
            "note": "vaisselle propre lisible (assiettes, verres, tasses); dessus libre au centre"}


@objet("station_sink", "poste", 1500, accroche="sol", nom="Plonge: bac inox, robinet col de cygne et égouttoir")
def o_sink(g):
    """Plonge de l'arrière-comptoir (données: `station-1`, x 7,15 à 7,95, centre 7,55; 7,395), sur l'arrivée d'eau et
    l'évacuation du refend (`marker-2` x 7,4, `marker-3` x 7,7). Pivot au sol au centre de l'emprise, comme les données
    (y 0). Plateau inox posé sur le plan de noyer de la coque, percé là où la coque est percée (x 7,21 à 7,67, z 7,17 à
    7,63): bac de 43 x 43 cm et 16 cm de fond (0,745 m, emplacement `bac` des données), robinet col de cygne contre la
    faïence (sous l'étagère murale: 1,20 m au plus haut, étagère à 1,29 m), égouttoir rainuré à l'est avec un égouttoir
    à vaisselle (deux assiettes, une tasse). Douilles `basin` (fond du bac), `tap` (bec), `rack` (égouttoir) pour
    l'animation de lavage."""
    zt, zf = 0.906, 0.745
    bx0, bx1, by0, by1 = -0.325, 0.105, -0.21, 0.22  # bac (repère du modèle)
    X0, X1, Y0, Y1 = -0.40, 0.40, -0.28, 0.34
    for (a, b, c, e) in ((X0, bx0, Y0, Y1), (bx1, X1, Y0, Y1), (bx0, bx1, Y0, by0), (bx0, bx1, by1, Y1)):
        g.box(a, b, c, e, 0.900, zt, "steel", bevel=0, drop=("bottom",))
    g.box(X0, X1, Y1, Y1 + 0.005, 0.865, zt, "steel", bevel=0.002)
    g.box(X0, X1, Y0, Y0 + 0.01, zt, zt + 0.05, "steel", bevel=0.003, drop=("bottom",))
    # parois et fond du bac (faces tournées vers l'intérieur)
    g.quad([(bx0, by0, zf), (bx0, by1, zf), (bx0, by1, zt), (bx0, by0, zt)], "steel", normal_hint=(1, 0, 0))
    g.quad([(bx1, by0, zf), (bx1, by1, zf), (bx1, by1, zt), (bx1, by0, zt)], "steel", normal_hint=(-1, 0, 0))
    g.quad([(bx0, by0, zf), (bx1, by0, zf), (bx1, by0, zt), (bx0, by0, zt)], "steel", normal_hint=(0, 1, 0))
    g.quad([(bx0, by1, zf), (bx1, by1, zf), (bx1, by1, zt), (bx0, by1, zt)], "steel", normal_hint=(0, -1, 0))
    quad_dessus(g, bx0, bx1, by0, by1, zf, "steel")
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
    g.cyl(cx, cy, zf, zf + 0.003, 0.03, 12, "steel_dark")
    g.cyl(cx, cy, zf + 0.003, zf + 0.004, 0.012, 8, "ink")
    # égouttoir rainuré
    for x in (0.15, 0.2, 0.25, 0.3, 0.35):
        g.box(x - 0.003, x + 0.003, -0.2, 0.26, zt, zt + 0.0015, "steel_dark", bevel=0)
    # égouttoir à vaisselle en fil chromé, deux assiettes debout, une tasse retournée
    rx0, rx1, ry0, ry1, zr = 0.135, 0.385, -0.17, 0.2, zt + 0.012
    for (a, b) in (((rx0, ry0), (rx1, ry0)), ((rx1, ry0), (rx1, ry1)), ((rx1, ry1), (rx0, ry1)), ((rx0, ry1), (rx0, ry0))):
        g.rod((a[0], a[1], zr), (b[0], b[1], zr), 0.003, 4, "chrome", cap=False)
    for x in (rx0, rx1):
        for y in (ry0, ry1):
            g.rod((x, y, zt + 0.0015), (x, y, zr), 0.003, 4, "chrome", cap=False)
    for i in range(5):
        x = 0.165 + i * 0.03
        for y in (-0.06, 0.1):
            g.rod((x, y, zr), (x, y, zr + 0.06), 0.0025, 4, "chrome", cap=False)
    for x in (0.18, 0.21):
        g.rod((x - 0.005, 0.02, zr + 0.11), (x + 0.005, 0.02, zr + 0.11), 0.11, 14, "porcelain")
    tasse_retournee(g, 0.33, 0.12, zr, 0.034, 0.024, 0.058, segs=10, anse=False)
    # robinet col de cygne chromé contre la faïence, levier sur le côté
    tx, ty = cx, -0.245
    g.cyl(tx, ty, zt, zt + 0.02, 0.022, 10, "chrome")
    g.cyl(tx, ty, zt + 0.02, 1.13, 0.012, 10, "chrome", cap_top=False)
    R = 0.07
    yc = ty + R
    pts = [(yc - R * math.cos(t), 1.13 + R * math.sin(t)) for t in [math.pi * k / 6 for k in range(7)]]
    for (y0, z0), (y1, z1) in zip(pts, pts[1:]):
        g.rod((tx, y0, z0), (tx, y1, z1), 0.011, 10, "chrome", cap=False)
    g.cyl(tx, yc + R, 1.085, 1.13, 0.011, 10, "chrome", cap_top=False)
    g.cyl(tx, yc + R, 1.08, 1.085, 0.013, 10, "steel_dark")
    g.rod((tx + 0.012, ty, 1.0), (tx + 0.075, ty + 0.01, 1.035), 0.006, 6, "chrome")
    g.sphere(tx + 0.078, ty + 0.01, 1.037, 0.009, 0.009, 0.009, "chrome", segs=8, rings=4)
    return {"sockets": [sk("basin", cx, cy, zf + 0.004), sk("tap", tx, yc + R, 1.08), sk("rack", 0.26, 0.02, zr)],
            "note": "pivot au sol (données y 0); bac dans la découpe du plan de la coque; emplacement bac des données au fond "
                    "(0,745 m, x -0,11)"}


@objet("station_dishwasher", "poste", 2000, accroche="sol", nom="Lave-vaisselle sous le plan")
def o_dishwasher(g):
    """Façade du lave-vaisselle (achat `lave-vaisselle`, sous l'arrière-comptoir à x 9,15: devant le placard x 8,82 à 9,84).
    Pivot au sol au centre de l'emprise des données (0,60 x 0,55), façade inox à 0,32 m devant (z 7,72 à 7,75), poignée
    barre, bandeau de commande, plinthe. Le caisson reste dans la coque."""
    yf = 0.318
    g.box(-0.30, 0.30, yf, yf + 0.032, 0.09, 0.85, "steel", bevel=0.006)
    g.box(-0.29, 0.29, yf - 0.006, yf + 0.012, 0.008, 0.088, "steel_dark", bevel=0.003)
    g.box(-0.29, 0.29, yf + 0.032, yf + 0.034, 0.79, 0.835, "steel_dark", bevel=0)
    g.box(-0.24, -0.12, yf + 0.034, yf + 0.036, 0.8, 0.825, "screen", bevel=0)
    for i, key in enumerate(("ink", "alert", "leaf")):
        g.cyl(0.12 + i * 0.05, yf + 0.034, 0.805, 0.82, 0.009, 8, key)
        g.rod((0.12 + i * 0.05, yf + 0.034, 0.8125), (0.12 + i * 0.05, yf + 0.04, 0.8125), 0.009, 8, key)
    g.rod((-0.22, yf + 0.06, 0.74), (0.22, yf + 0.06, 0.74), 0.01, 8, "chrome")
    for x in (-0.22, 0.22):
        g.rod((x, yf + 0.032, 0.74), (x, yf + 0.06, 0.74), 0.008, 6, "chrome", cap=False)
    return {"sockets": [sk("panier", 0.0, 0.4, 0.45)],
            "note": "pivot au sol (données y 0); façade devant le placard de la coque"}


@objet("station_fridge_under", "poste", 2000, accroche="sol", nom="Réfrigérateur sous le plan et plan de préparation")
def o_frigo_sous_plan(g):
    """Réfrigérateur sous le plan (données: `station-2`, x 8,00 à 8,75, centre 8,375; 7,395), dans la niche de la coque:
    caisson et porte pleine inox, joint, poignée barre à droite (charnières côté plonge), afficheur 3 °C, grille basse,
    étiquette « Lait · Beurre ». Sur le plan au-dessus, le poste de préparation: planche à découper sous l'emplacement
    `plan` des données (x +0,05; 0,913 m), couteau devant, pot à ustensiles contre la faïence (hors des consoles de
    l'étagère murale, à 8,58). La bouilloire des données (x 8,10) garde sa place à l'ouest de la planche."""
    yf = 0.30
    g.box(-0.37, 0.37, -0.28, yf, 0.0, 0.86, "steel", bevel=0.004, drop=("n", "top", "bottom"))
    g.box(-0.368, 0.368, yf - 0.004, yf, 0.08, 0.858, "rubber", bevel=0)
    g.box(-0.365, 0.365, yf, yf + 0.035, 0.085, 0.855, "steel", bevel=0.006)
    # grille de ventilation
    g.box(-0.36, 0.36, yf - 0.005, yf + 0.01, 0.012, 0.075, "steel_dark", bevel=0)
    for z in (0.025, 0.042, 0.059):
        g.box(-0.35, 0.35, yf + 0.01, yf + 0.013, z, z + 0.006, "steel", bevel=0)
    # charnières (ouest) et poignée barre (est)
    for z in (0.11, 0.83):
        g.box(-0.372, -0.355, yf + 0.005, yf + 0.04, z - 0.015, z + 0.015, "steel_dark", bevel=0.002)
    g.rod((0.315, yf + 0.065, 0.32), (0.315, yf + 0.065, 0.74), 0.011, 8, "chrome")
    for z in (0.34, 0.72):
        g.rod((0.315, yf + 0.035, z), (0.315, yf + 0.065, z), 0.008, 6, "chrome", cap=False)
    # afficheur de température et étiquette scotchée
    yd = yf + 0.035
    g.box(-0.31, -0.17, yd, yd + 0.006, 0.77, 0.825, "screen", bevel=0.002)
    ecrire(g, "3°C", "alert", (-0.24, yd + 0.0068, 0.7975), **FACE, hauteur=0.028, largeur_max=0.11)
    quad_face(g, -0.15, 0.15, 0.56, 0.66, yd + 0.001, "paper")
    for x in (-0.15, 0.15):
        g.quad([(x - 0.02, yd + 0.0015, 0.645), (x + 0.02, yd + 0.0015, 0.655), (x + 0.02, yd + 0.0015, 0.672),
                (x - 0.02, yd + 0.0015, 0.662)], "tape", normal_hint=(0, 1, 0))
    ecrire(g, "Lait · Beurre", "ink", (0.0, yd + 0.002, 0.61), **FACE, hauteur=0.036, largeur_max=0.27)
    # poste de préparation sur le plan (0,90 m)
    zp = 0.90
    g.box(-0.14, 0.26, -0.10, 0.16, zp, zp + 0.012, "t:oak_campagne", bevel=0.004, drop=("bottom",))
    g.cyl(0.235, -0.075, zp + 0.012, zp + 0.0125, 0.012, 8, "oak_dark")
    g.box(-0.13, -0.04, 0.142, 0.158, zp + 0.012, zp + 0.027, "walnut", bevel=0.004)
    g.prism([(-0.04, 0.145), (0.08, 0.145), (0.105, 0.152), (-0.04, 0.156)], zp + 0.012, zp + 0.0145, "chrome")
    px, py = 0.29, -0.2
    g.lathe(px, py, zp, [(0.044, 0), (0.05, 0.012), (0.05, 0.125), (0.046, 0.13), (0.044, 0.02), (0.0, 0.02)], 12, "campagne_clay",
            keys=["campagne_clay", "campagne_clay", "porcelain", "porcelain", "ink"], cap_bottom=True, cap_top=False, smooth=True)
    g.rod((px - 0.01, py + 0.005, zp + 0.03), (px - 0.03, py + 0.02, zp + 0.26), 0.006, 6, "walnut")
    g.sphere(px - 0.032, py + 0.021, zp + 0.28, 0.02, 0.009, 0.03, "walnut", segs=8, rings=4)
    g.rod((px + 0.012, py - 0.005, zp + 0.03), (px + 0.03, py - 0.012, zp + 0.22), 0.005, 6, "ink")
    g.sphere(px + 0.034, py - 0.013, zp + 0.255, 0.018, 0.018, 0.04, "chrome", segs=6, rings=4)
    g.rod((px + 0.005, py + 0.012, zp + 0.03), (px + 0.012, py + 0.03, zp + 0.24), 0.005, 6, "walnut")
    g.box(px + 0.0, px + 0.026, py + 0.026, py + 0.034, zp + 0.21, zp + 0.27, "walnut", bevel=0.002)
    return {"sockets": [sk("plan", 0.05, 0.0, zp + 0.012), sk("door", 0.0, yf + 0.035, 0.45)],
            "note": "pivot au sol (données y 0); porte à 0,30-0,335 m devant le centre (z 7,695 à 7,73), sous le plan de la coque; "
                    "planche du poste de préparation au-dessus (0,912 m)"}


# ------------------------------------------------------------------------------------------------
# Réserve

@objet("reserve_frigo_armoire", "poste", 2000, accroche="sol", nom="Armoire froide de la réserve")
def o_armoire(g):
    """Armoire froide inox à porte pleine (0,70 x 0,75 x 1,85 m), contre le refend dans la réserve (données: `station-7`,
    x 8,15 à 8,85, z 5,90 à 6,65). Elle s'ouvre vers le nord (l'allée de la réserve, place `pied` des données à z -0,60):
    le jeu la pose tournée de 180 degrés. Charnières du côté de la cloison ouest (x 8,10): la porte s'ouvre contre le mur
    et laisse l'allée libre; poignée barre de l'autre côté. Bandeau de commande avec afficheur 3 °C, grille, étiquette des
    produits frais (ingrédients rangés « frigo » dans les données)."""
    w, d, h = 0.70, 0.75, 1.85
    yf = d / 2 - 0.045
    g.box(-w / 2, w / 2, -d / 2, yf, 0.06, h, "steel", bevel=0.008, drop=("bottom",))
    for x in (-w / 2 + 0.05, w / 2 - 0.05):
        for y in (-d / 2 + 0.05, yf - 0.05):
            g.cyl(x, y, 0.0, 0.06, 0.022, 8, "steel_dark")
    # bandeau de commande: afficheur, touches, grille
    g.box(-w / 2 + 0.01, w / 2 - 0.01, yf, yf + 0.012, 1.70, 1.84, "steel_dark", bevel=0.004)
    g.box(-0.27, -0.09, yf + 0.012, yf + 0.016, 1.735, 1.805, "screen", bevel=0.002)
    ecrire(g, "3°C", "alert", (-0.18, yf + 0.0168, 1.77), **FACE, hauteur=0.035, largeur_max=0.14)
    for i in range(3):
        g.cyl(-0.05 + i * 0.03, yf + 0.012, 1.76, 1.78, 0.008, 8, "chrome")
        g.rod((-0.05 + i * 0.03, yf + 0.012, 1.77), (-0.05 + i * 0.03, yf + 0.018, 1.77), 0.008, 8, "chrome")
    for z in (1.725, 1.75, 1.775, 1.8):
        g.box(0.08, 0.31, yf + 0.012, yf + 0.016, z, z + 0.01, "ink", bevel=0)
    # porte pleine, joint, charnières (côté +x du modèle: l'ouest une fois posée), poignée barre
    g.box(-w / 2 + 0.012, w / 2 - 0.012, yf - 0.004, yf, 0.098, 1.684, "rubber", bevel=0)
    g.box(-w / 2 + 0.015, w / 2 - 0.015, yf, yf + 0.04, 0.1, 1.68, "steel", bevel=0.01)
    for z in (0.16, 1.62):
        g.box(w / 2 - 0.02, w / 2 + 0.004, yf + 0.004, yf + 0.045, z - 0.03, z + 0.03, "steel_dark", bevel=0.003)
    hx = -w / 2 + 0.07
    g.rod((hx, yf + 0.075, 0.75), (hx, yf + 0.075, 1.3), 0.013, 8, "chrome")
    for z in (0.78, 1.27):
        g.rod((hx, yf + 0.04, z), (hx, yf + 0.075, z), 0.009, 6, "chrome", cap=False)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, yf - 0.004, yf + 0.012, 0.065, 0.098, "steel_dark", bevel=0)
    # étiquette scotchée: ce qui se range ici
    ye = yf + 0.041
    quad_face(g, -0.2, 0.2, 1.24, 1.42, ye, "paper")
    for x in (-0.2, 0.2):
        g.quad([(x - 0.025, ye + 0.0005, 1.405), (x + 0.025, ye + 0.0005, 1.415), (x + 0.025, ye + 0.0005, 1.435),
                (x - 0.025, ye + 0.0005, 1.425)], "tape", normal_hint=(0, 1, 0))
    ecrire(g, "Lait · Beurre · Œufs", "ink", (0.0, ye + 0.001, 1.365), **FACE, hauteur=0.03, largeur_max=0.36)
    ecrire(g, "Menthe · Limonade", "ink", (0.0, ye + 0.001, 1.295), **FACE, hauteur=0.03, largeur_max=0.36)
    return {"sockets": [sk("pied", 0.0, 0.6, 0.0)],
            "note": "avant (+Z) = porte: poser tourné de 180° (porte vers le nord dans la réserve); charnières côté +X du modèle"}


def etagere(g, w, d, h, niveaux):
    """Rayonnage de réserve en acier galvanisé: montants en cornière, tablettes à rebord, croix de contreventement."""
    for x in (-w / 2, w / 2 - 0.03):
        for y in (-d / 2, d / 2 - 0.03):
            g.box(x, x + 0.03, y, y + 0.03, 0.0, h, "steel", bevel=0, drop=("bottom",))
    for z in niveaux:
        g.box(-w / 2 + 0.002, w / 2 - 0.002, -d / 2 + 0.002, d / 2 - 0.002, z - 0.008, z, "zinc", bevel=0)
        g.box(-w / 2 + 0.03, w / 2 - 0.03, d / 2 - 0.004, d / 2, z - 0.04, z - 0.008, "zinc", bevel=0, drop=("top",))
    yb = -d / 2 + 0.006
    g.rod((-w / 2 + 0.03, yb, niveaux[0]), (w / 2 - 0.03, yb, niveaux[-2]), 0.004, 4, "steel_dark", cap=False)
    g.rod((w / 2 - 0.03, yb, niveaux[0]), (-w / 2 + 0.03, yb, niveaux[-2]), 0.004, 4, "steel_dark", cap=False)


def sac(g, x, y, z, w, d, h, key, mot=None, hauteur=0.04):
    """Sac de papier fort plié en haut (café en grains, farine): corps arrondi, pli, mot écrit au feutre devant."""
    # chanfrein de 1,8 cm (le style B multiplie les chanfreins par 0,18)
    g.box(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + h, key, bevel=0.1, segs=1, drop=("bottom",))
    g.box(x - w / 2 + 0.015, x + w / 2 - 0.015, y - 0.012, y + 0.012, z + h - 0.01, z + h + 0.035, key, bevel=0,
          drop=("bottom",))
    if mot:
        ecrire(g, mot, "ink", (x, y + d / 2 + 0.0015, z + h * 0.55), **FACE, hauteur=hauteur, largeur_max=w - 0.05)


def boite(g, x, y, z, w, d, h, key, couvercle=None):
    g.box(x - w / 2, x + w / 2, y - d / 2, y + d / 2, z, z + h, key, bevel=0, drop=("bottom",))
    if couvercle:
        g.box(x - w / 2 - 0.002, x + w / 2 + 0.002, y - d / 2 - 0.002, y + d / 2 + 0.002, z + h - 0.015, z + h + 0.002, couvercle,
              bevel=0, drop=("bottom",))


def boite_ronde(g, x, y, z, r, h, key, couvercle):
    """Boîte à thé en fer: corps et couvercle à 8 pans (lissés)."""
    g.cyl(x, y, z, z + h, r, 10, key, cap_bottom=False, cap_top=False, smooth=True)
    g.cyl(x, y, z + h - 0.012, z + h + 0.004, r * 1.04, 10, couvercle, cap_bottom=False, smooth=True)


def bocal(g, x, y, z, r, h, key, couvercle):
    g.cyl(x, y, z, z + h, r, 10, key, cap_bottom=False)
    g.cyl(x, y, z + h, z + h + 0.015, r * 1.05, 10, couvercle, cap_bottom=False)


def cageot(g, x, y, z, w, d, fruits):
    """Cageot de bois clair à claire-voie, fruits ronds dessus (oranges, citrons)."""
    for yy in (y - d / 2, y + d / 2 - 0.012):
        g.box(x - w / 2, x + w / 2, yy, yy + 0.012, z, z + 0.1, "t:oak_campagne", bevel=0)
    for xx in (x - w / 2, x + w / 2 - 0.012):
        g.box(xx, xx + 0.012, y - d / 2 + 0.012, y + d / 2 - 0.012, z, z + 0.1, "t:oak_campagne", bevel=0)
    g.box(x - w / 2 + 0.012, x + w / 2 - 0.012, y - d / 2 + 0.012, y + d / 2 - 0.012, z, z + 0.008, "t:oak_campagne", bevel=0)
    # dômes seuls (le bas est caché par les planches), 10 pans: lisses au-delà de l'arête vive de 40 degrés
    r = 0.05
    for i, key in enumerate(fruits):
        fx = x - w / 2 + 0.08 + i * (w - 0.16) / max(1, len(fruits) - 1)
        g.sphere(fx, y + (0.03 if i % 2 else -0.03), z + 0.07, r, r, r * 0.95, key, segs=10, rings=6, zcut=0.0)


@objet("reserve_etagere", "etagere", 1000, accroche="sol", nom="Étagère de la réserve (0,85 m)")
def o_etagere(g):
    """Rayonnage galvanisé contre le mur sur cour de la réserve (données: `furniture-1`, x 8,15 à 9,00, z 3,55 à 4,00; avant au
    sud, vers l'allée). Ce qui se range « en réserve » d'après les données: sacs de café en grains en bas (lourds), farine et
    sucre, thés et chocolat en boîtes, confitures, cageot d'oranges et de citrons, cartons vides pliés en haut."""
    w, d, h = 0.85, 0.45, 2.0
    niv = [0.12, 0.54, 0.96, 1.38, 1.8]
    etagere(g, w, d, h, niv)
    sac(g, -0.2, 0.0, niv[0], 0.3, 0.2, 0.32, "kraft", "Café", 0.055)
    sac(g, 0.17, -0.02, niv[0], 0.28, 0.18, 0.3, "kraft")
    sac(g, -0.2, 0.0, niv[1], 0.3, 0.18, 0.3, "paper_old", "Farine", 0.045)
    boite(g, 0.19, 0.02, niv[1], 0.26, 0.13, 0.17, "paper")
    for i, (key, cov) in enumerate((("faience_blue", "steel"), ("house_bordeaux", "brass"))):
        boite_ronde(g, -0.28 + i * 0.12, 0.02, niv[2], 0.05, 0.16, key, cov)
    boite(g, 0.0, 0.0, niv[2], 0.12, 0.09, 0.2, "chocolate", "house_mustard")
    bocal(g, 0.2, 0.06, niv[2], 0.032, 0.09, "glaze_apricot", "house_bordeaux")
    cageot(g, -0.15, 0.0, niv[3], 0.4, 0.3, ["apricot", "lemon", "apricot"])
    g.box(0.12, 0.38, -0.15, 0.15, niv[4], niv[4] + 0.03, "t:kraft", bevel=0, drop=("bottom",))
    return {"sockets": [sk("pied", 0.0, 0.4, 0.0)], "note": "avant au sud (+Z), comme les données"}


@objet("reserve_etagere_longue", "etagere", 1000, accroche="sol", nom="Étagère longue de la réserve (1,20 m)")
def o_etagere_longue(g):
    """Rayonnage galvanisé contre le mur est de la réserve (données: `furniture-2`, x 10,50 à 10,95, z 4,40 à 5,60, posé à
    90 degrés; place `pied` à z -0,40 des données: l'avant regarde l'ouest, vers l'allée): le jeu le pose tourné de 180
    degrés. Le stock du bar: café, thés, sucre, chocolat, confitures, panier à pain, cartons pliés."""
    w, d, h = 1.2, 0.45, 2.0
    niv = [0.12, 0.54, 0.96, 1.38, 1.8]
    etagere(g, w, d, h, niv)
    for i, x in enumerate((-0.4, -0.08)):
        sac(g, x, 0.0, niv[0], 0.3, 0.2, 0.32, "kraft", "Café" if i == 0 else None, 0.055)
    sac(g, 0.32, 0.0, niv[0], 0.32, 0.2, 0.3, "paper_old")
    boite(g, -0.315, 0.02, niv[1], 0.35, 0.13, 0.17, "paper")
    for i in range(3):
        boite_ronde(g, 0.12 + i * 0.13, 0.0, niv[1], 0.055, 0.18, ("faience_blue", "house_bottle", "house_bordeaux")[i], "brass")
    for i in range(2):
        boite(g, -0.42 + i * 0.14, 0.0, niv[2], 0.12, 0.09, 0.2, "chocolate", "house_mustard")
    bocal(g, -0.04, 0.06, niv[2], 0.032, 0.09, "berry", "house_bordeaux")
    cageot(g, -0.3, 0.0, niv[3], 0.4, 0.3, ["lemon", "apricot", "lemon"])
    g.box(0.05, 0.5, -0.12, 0.12, niv[3], niv[3] + 0.09, "t:straw", bevel=0, drop=("bottom",))
    g.box(-0.5, 0.0, -0.15, 0.15, niv[4], niv[4] + 0.03, "t:kraft", bevel=0, drop=("bottom",))
    return {"sockets": [sk("pied", 0.0, 0.4, 0.0)],
            "note": "avant (+Z) = allée: poser tourné de 180° (avant vers l'ouest une fois posé à 90° contre le mur est)"}


# ------------------------------------------------------------------------------------------------
# Cour: palette des livraisons et cartons étiquetés

@objet("reserve_palette", "livraison", 300, accroche="sol", nom="Demi-palette des livraisons")
def o_palette(g):
    """Demi-palette de bois (0,80 x 0,60 x 0,15 m) dans la cour, devant la porte de la réserve (données: `palette-1`, x 8,9,
    z 2,4): les fournisseurs y posent les cartons du matin (emplacements s1 à s4 des données, dessus à 0,15 m)."""
    key = "t:oak_campagne"
    for y in (-0.25, 0.0, 0.25):
        g.box(-0.4, 0.4, y - 0.05, y + 0.05, 0.0, 0.022, key, bevel=0, drop=("bottom",))
        for x in (-0.35, 0.0, 0.35):
            g.box(x - 0.05, x + 0.05, y - 0.045, y + 0.045, 0.022, 0.11, key, bevel=0, drop=("bottom", "top"))
        g.box(-0.4, 0.4, y - 0.05, y + 0.05, 0.11, 0.128, key, bevel=0, drop=("bottom",))
    for x in (-0.34, -0.17, 0.0, 0.17, 0.34):
        g.box(x - 0.055, x + 0.055, -0.3, 0.3, 0.128, 0.15, key, bevel=0, drop=("bottom",))
    socks = [sk(n, x, y, 0.15) for n, x, y in (("s1", -0.2, -0.15), ("s2", 0.2, -0.15), ("s3", -0.2, 0.15), ("s4", 0.2, 0.15))]
    return {"sockets": socks, "note": "dessus à 0,15 m (emplacements s1 à s4 des données)"}


# Mot écrit sur le carton de chaque ingrédient (`donnees/service/ingredients.json`): court, lisible à 2 m.
MOTS = {
    "grains-maison": "Café", "lait-entier": "Lait", "lait-avoine": "Lait d’avoine", "beurre": "Beurre", "oeufs": "Œufs",
    "cacao": "Chocolat", "the-noir": "Thé noir", "the-vert": "Thé vert", "plantes-simone": "Tisanes", "menthe": "Menthe",
    "oranges": "Oranges", "citrons": "Citrons", "sucre": "Sucre", "farine": "Farine", "confiture": "Confiture",
    "limonade-bouteille": "Limonade", "accompagnement": "Sucres", "pain-campagne": "Pain", "croissant-boulanger": "Croissants",
    "pain-chocolat-boulanger": "Pains choc.", "tarte-boulanger": "Tartes",
}


def ingredients():
    data = json.load(open(os.path.join(DONNEES, "service", "ingredients.json"), encoding="utf-8"))
    return data["ingredients"] if isinstance(data, dict) else data


def carton_modele(ident):
    return "carton_" + ident.replace("-", "_")


def _carton(ing):
    def fn(g):
        """Carton de livraison étiqueté (contenu écrit au feutre sur une étiquette du dessus, lu depuis l'avant). Petit
        carton 0,36 x 0,26 x 0,22 m, carton lourd (à porter à deux) 0,38 x 0,28 x 0,30 m: ils tiennent à quatre sur la
        demi-palette (emplacements espacés de 0,40 x 0,30 m)."""
        w, d, h = (0.38, 0.28, 0.30) if ing.get("heavy") else (0.36, 0.26, 0.22)
        g.box(-w / 2, w / 2, -d / 2, d / 2, 0.0, h, "t:kraft", bevel=0, drop=("bottom",))
        # ruban sur la jointure des rabats (le long de x, au fond du dessus) et sur les deux faces
        yt = -d / 2 + 0.06
        quad_dessus(g, -w / 2, w / 2, yt - 0.025, yt + 0.025, h + 0.0008, "tape")
        for s in (-1, 1):
            x = s * (w / 2 + 0.0008)
            g.quad([(x, yt - 0.025, h - 0.06), (x, yt + 0.025, h - 0.06), (x, yt + 0.025, h), (x, yt - 0.025, h)], "tape",
                   normal_hint=(s, 0, 0))
        quad_dessus(g, -w / 2 + 0.025, w / 2 - 0.025, yt + 0.04, d / 2 - 0.02, h + 0.0008, "paper")
        yc = (yt + 0.04 + d / 2 - 0.02) / 2
        ecrire(g, MOTS[ing["id"]], "ink", (0.0, yc, h + 0.0016), **DESSUS, hauteur=0.042, largeur_max=w - 0.07)
        return {"note": f"{ing['label']} ({'lourd' if ing.get('heavy') else 'léger'}); mot lu depuis l'avant (+Z)"}
    fn.__name__ = carton_modele(ing["id"])
    return fn


for _ing in ingredients():
    if _ing["id"] in MOTS:
        objet(carton_modele(_ing["id"]), "carton", 250, accroche="sol", nom=f"Carton « {MOTS[_ing['id']]} »")(_carton(_ing))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--seulement", default="")
    ap.add_argument("--sans-ao", action="store_true")
    a = ap.parse_args(argv)
    import catalogue as CAT
    K.construire_atlas()
    manquants = [i["id"] for i in ingredients() if i["id"] not in MOTS]
    if manquants:
        raise SystemExit(f"ingrédients sans mot de carton: {manquants}")
    ids = [i for i in a.seulement.split(",") if i] or list(CATALOGUE)
    CAT.produire(CATALOGUE, ids, os.path.join(ICI, "fiches", "postes_arriere.json"), ao=not a.sans_ao)


if __name__ == "__main__":
    main()
