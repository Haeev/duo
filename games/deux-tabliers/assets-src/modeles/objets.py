"""Postes, équipements, vaisselle, nourriture, cartons, objets uniques et petits objets de Deux Tabliers (démo v0.1).

Usage: duo-python games/deux-tabliers/assets-src/modeles/objets.py [-- --seulement id1,id2] [--sans-ao]

Même chaîne que meubles.py (atlas partagé `dt_meubles`, occlusion dans les couleurs de sommets, un GLB par identifiant).
Postes: l'avant du modèle (+Z glTF) est le côté où l'on travaille (le barista). Dans la coque d'Ormeval, la machine, le
moulin et la caisse regardent le nord (l'allée du barista): les poser tournés de 180 degrés.
Vaisselle et nourriture à 120 % (bible 4.2). Contenus (café, lait, thé, jus) en nœud à part `<id>_liquid`, pour les
montrer, les cacher ou les teinter.
"""

import argparse
import math
import os
import sys

import bpy  # noqa: F401
from mathutils import Matrix, Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
import commun as K  # noqa: E402
from geo import Geo  # noqa: E402
import geo as G  # noqa: E402
import scene_coque as S  # noqa: E402
import meubles as MB  # noqa: E402

pans = G.pans
CATALOGUE = {}
meuble = None


def objet(ident, style, categorie, budget, accroche="surface", nom=""):
    def deco(fn):
        CATALOGUE[ident] = dict(fn=fn, style=style, categorie=categorie, budget=budget, accroche=accroche, nom=nom)
        return fn
    return deco


def recentrer(g, verts=None, rot180=False, keep_z=False, centre=None, z0=None):
    """Ramène le modèle (construit aux cotes de la coque) au centre de son emprise (ou au point `centre` du plan), pied à
    z = 0 (ou à `z0`)."""
    vs = verts if verts is not None else list(g.bm.verts)
    xs = [v.co.x for v in vs]
    ys = [v.co.y for v in vs]
    zs = [v.co.z for v in vs]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    if centre is not None:
        cx, cy = centre[0], -centre[1]
    if z0 is None:
        z0 = 0 if keep_z else min(zs)
    for v in vs:
        v.co = Vector((v.co.x - cx, v.co.y - cy, v.co.z - z0))
        if rot180:
            v.co = Vector((-v.co.x, -v.co.y, v.co.z))
    return (cx, -cy, z0)


def sk(name, x, y, z):
    return {"name": name, "x": x, "y": y, "z": z}


# ------------------------------------------------------------------------------------------------
# Postes de la coque d'Ormeval (repris de l'essai, version fine)

@objet("station_espresso_2g", "neutre", "poste", 4000, nom="La vieille machine de Simone (deux groupes)")
def o_espresso(g):
    """Machine de l'essai (cuivre et laiton, deux groupes, buse vapeur, manomètre, chauffe-tasses), en Geo à part."""
    tmp = S.cafetiere()
    _absorber(g, tmp)
    recentrer(g, rot180=True, centre=(9.15, 9.005), z0=S.WORK)
    # repères relatifs à l'essai: groupes à x 8,96 et 9,34, façade y 8,98, plan à 0,95
    cx, cy = 9.15, (8.79 + 9.22) / 2
    socks = []
    for i, x in enumerate((cx - 0.19, cx + 0.19)):
        dx = -(x - cx)
        socks.append(sk(f"cup_{i}", dx, -(8.915 - cy), 0.066))
        socks.append(sk(f"group_{i}", dx, -(8.915 - cy), 0.205))
    socks.append(sk("steam_wand", -((cx - 0.38 + 0.075 - 0.02) - cx), -((8.98 - 0.1) - cy), 0.09))
    socks.append(sk("cup_warmer", 0.0, 0.0, 0.443))
    return {"sockets": socks, "usage": "barista face à la façade de la machine (avant du modèle)",
            "note": "dans la coque: centre à x 9,15, z 9,005, plan de travail à 0,95 m, avant tourné vers le nord (rotation 180°)"}


def _absorber(g, other):
    """Copie le maillage d'un autre Geo (construit par les fonctions de l'essai) dans g, clés comprises."""
    import bmesh as _bm
    bm = other.bm
    mp = {}
    for v in bm.verts:
        mp[v] = g.bm.verts.new(v.co)
    for f in bm.faces:
        try:
            nf = g.bm.faces.new([mp[v] for v in f.verts])
        except ValueError:
            continue
        nf.material_index = g.mi(_key(other.keys[f.material_index]))
        nf.smooth = f.smooth
    if other in Geo.registry:
        Geo.registry.remove(other)
    other.bm.free()


def _key(k):
    return {"glass": "glass", "emit": "glow", "paper": "paper", "player_on": "player_on", "oak_honey": "campagne_oak"}.get(k, k)


@objet("station_grinder", "neutre", "poste", 600, nom="Moulin de la machine")
def o_moulin(g):
    tmp, gl = S.moulin()
    _absorber(g, tmp)
    _absorber(g, gl)
    recentrer(g, rot180=True, centre=(9.78, 9.04), z0=S.WORK)
    return {"sockets": [sk("dose", 0.0, 0.13, 0.05)], "note": "dans la coque: x 9,78, z 9,04, sur le plan de 0,95 m, tourné vers le nord"}


@objet("moulin_dose", "neutre", "poste", 600, nom="Moulin à dose (équipement t1)")
def o_moulin_dose(g):
    g.box(-0.11, 0.11, -0.17, 0.15, 0, 0.05, "steel_dark", bevel=0.01)
    g.box(-0.09, 0.09, -0.15, 0.1, 0.05, 0.3, "t:zinc", bevel=0.015)
    g.box(-0.07, 0.07, 0.1, 0.16, 0.12, 0.25, "glass", bevel=0.01)
    g.lathe(0, 0.1, 0.04, [(0.0, 0.0), (0.05, 0.0), (0.05, 0.02)], 12, "steel")
    for i in range(6):
        a = i * math.pi / 3
        g.box(-0.004, 0.004, 0.11, 0.155, 0.13 + 0.015 * i, 0.135 + 0.015 * i, "steel_dark", bevel=0)
    g.rod((0.09, 0.0, 0.2), (0.15, 0.04, 0.2), 0.007, 6, "steel")
    g.sphere(0.15, 0.04, 0.2, 0.016, 0.016, 0.016, "ink", segs=8, rings=5)
    g.cyl(0, -0.03, 0.3, 0.33, 0.06, 12, "steel_dark")
    g.lathe(0, -0.03, 0.33, [(0.03, 0), (0.09, 0.18), (0.095, 0.2)], 12, "glass", cap_bottom=False, cap_top=False)
    g.lathe(0, -0.03, 0.335, [(0.035, 0), (0.08, 0.12)], 12, "espresso", cap_bottom=False, cap_top=True)
    g.cyl(0, -0.03, 0.53, 0.55, 0.1, 12, "steel_dark")
    return {"sockets": [sk("dose", 0.0, 0.1, 0.06)], "note": "doseur vitré à l'avant, levier à droite"}


@objet("station_bouilloire", "neutre", "poste", 600, nom="Bouilloire")
def o_bouilloire(g):
    g.cyl(0, 0, 0, 0.02, 0.1, 14, "steel_dark", bevel=0.005)
    g.lathe(0, 0, 0.02, [(0.085, 0), (0.095, 0.03), (0.095, 0.14), (0.08, 0.2), (0.04, 0.23), (0.0, 0.235)], 14, "enamel", cap_bottom=True, cap_top=False)
    g.sphere(0, 0, 0.245, 0.02, 0.02, 0.015, "ink", segs=8, rings=4)
    pts = [(0, -0.08, 0.06), (0, -0.14, 0.12), (0, -0.13, 0.2), (0, -0.07, 0.21)]
    for a, b in zip(pts, pts[1:]):
        g.rod(a, b, 0.012, 6, "ink", cap=False)
    g.rod((0, 0.08, 0.12), (0, 0.15, 0.2), 0.012, 8, "enamel")
    return {"sockets": [sk("spout", 0.0, 0.15, 0.2)], "note": "bec vers l'avant, poignée derrière"}


@objet("bouilloire_temperature", "neutre", "poste", 600, nom="Bouilloire à température (équipement t3)")
def o_bouilloire_t(g):
    g.cyl(0, 0, 0, 0.025, 0.1, 14, "ink", bevel=0.005)
    g.box(-0.03, 0.03, 0.09, 0.1, 0.005, 0.02, "screen", bevel=0)
    g.lathe(0, 0, 0.025, [(0.08, 0), (0.085, 0.2), (0.07, 0.24), (0.0, 0.25)], 14, "steel", cap_bottom=True, cap_top=False)
    g.rod((0, 0.075, 0.18), (0, 0.18, 0.24), 0.007, 6, "steel")
    g.box(-0.015, 0.015, -0.16, -0.08, 0.06, 0.22, "ink", bevel=0.01)
    return {"sockets": [sk("spout", 0.0, 0.18, 0.24)], "note": "col de cygne pour verser lentement"}


@objet("station_vitrine", "neutre", "poste", 1000, nom="Vitrine réfrigérée du comptoir")
def o_vitrine(g):
    """Vitrine à gâteaux (0,90 x 0,45 x 0,32 m): sur l'arrière-comptoir d'Ormeval elle tient sous l'ardoise murale (1,22 m): socle de noyer, deux étagères, vitre bombée côté clients."""
    w, d, h = 0.9, 0.45, 0.32
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0, 0.08, "t:walnut", bevel=0.008)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, -d / 2 + 0.02, d / 2 - 0.02, 0.08, 0.085, "steel", bevel=0)
    g.box(-w / 2 + 0.03, w / 2 - 0.03, -d / 2 + 0.05, d / 2 - 0.08, 0.19, 0.2, "glass", bevel=0)
    for s in (-1, 1):
        g.box(s * w / 2 - (0.02 if s > 0 else 0), s * w / 2 + (0 if s > 0 else 0.02), -d / 2, d / 2, 0.08, h, "brass", bevel=0.004)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.02, h, "brass", bevel=0.004)
    # vitre bombée devant les clients (nord du modèle = arrière: côté clients); portes coulissantes côté barista (sud)
    n = 6
    for i in range(n):
        a0, a1 = math.pi / 2 * i / n, math.pi / 2 * (i + 1) / n
        y0, z0 = -d / 2 + 0.17 * (1 - math.cos(a0)), 0.085 + 0.215 * math.sin(a0)
        y1, z1 = -d / 2 + 0.17 * (1 - math.cos(a1)), 0.085 + 0.215 * math.sin(a1)
        g.quad([(-w / 2 + 0.02, y0 - 0.0, z0), (w / 2 - 0.02, y0, z0), (w / 2 - 0.02, y1, z1), (-w / 2 + 0.02, y1, z1)], "glass", normal_hint=(0, -1, 0))
    g.quad([(-w / 2 + 0.02, -d / 2 + 0.17, h - 0.02), (w / 2 - 0.02, -d / 2 + 0.17, h - 0.02), (w / 2 - 0.02, d / 2, h - 0.02), (-w / 2 + 0.02, d / 2, h - 0.02)], "glass", normal_hint=(0, 0, 1))
    g.quad([(-w / 2 + 0.02, d / 2, 0.085), (w / 2 - 0.02, d / 2, 0.085), (w / 2 - 0.02, d / 2, h - 0.02), (-w / 2 + 0.02, d / 2, h - 0.02)], "glass", normal_hint=(0, 1, 0))
    socks = [sk(f"shelf_low_{i}", -0.3 + i * 0.2, 0.0, 0.085) for i in range(4)] + [sk(f"shelf_high_{i}", -0.3 + i * 0.2, 0.05, 0.2) for i in range(4)]
    return {"sockets": socks, "note": "avant (sud du modèle) = côté barista, portes; vitre bombée vers les clients"}


@objet("station_caisse", "neutre", "poste", 600, nom="Caisse du comptoir")
def o_caisse(g):
    tmp = S.caisse_et_livre()
    _absorber(g, tmp[0])
    tmp[1].bm.free()
    if tmp[1] in Geo.registry:
        Geo.registry.remove(tmp[1])
    recentrer(g, rot180=True, centre=(10.6, 9.01), z0=S.WORK)
    return {"note": "touches vers le barista; afficheur vers les clients. Dans la coque: x 10,6, z 9,01, tourné vers le nord"}


@objet("station_ticket_rail", "neutre", "poste", 600, accroche="plafond", nom="Rail à tickets")
def o_rail(g):
    """Rail inox de 0,80 m pendu à une solive (origine au point d'accroche, sous la solive); six pinces mobiles."""
    zr = -0.77
    g.rod((-0.4, 0, zr), (0.4, 0, zr), 0.01, 8, "steel")
    for x in (-0.37, 0.37):
        g.rod((x, 0, zr), (x, 0, 0), 0.006, 6, "steel")
        g.cyl(x, 0, -0.01, 0.0, 0.02, 8, "steel")
    socks = []
    for i in range(6):
        x = -0.33 + i * 0.132
        g.box(x - 0.02, x + 0.02, -0.022, 0.01, zr - 0.012, zr + 0.025, "steel", bevel=0.004)
        socks.append(sk(f"ticket_{i}", x, -0.024, zr - 0.02))
    return {"sockets": socks, "note": "tickets face au nord (barista) dans la coque: poser tourné de 180°; rail à 1,88 m (solive à 2,65 m)"}


@objet("station_sink", "neutre", "poste", 600, nom="Évier de la plonge")
def o_sink(g):
    """Bac inox encastré et robinet col de cygne en laiton (posé sur le plan de 0,90 m, x 7,15 à 7,95 dans la coque)."""
    g.box(-0.35, 0.35, -0.19, 0.19, 0.0, 0.006, "steel", bevel=0.003)
    g.box(-0.29, 0.29, -0.13, 0.15, 0.003, 0.0065, "steel_dark", bevel=0)
    g.cyl(0.0, -0.215, 0.0, 0.25, 0.015, 8, "brass")
    g.rod((0, -0.215, 0.25), (0, -0.02, 0.22), 0.013, 8, "brass")
    g.rod((0, -0.02, 0.22), (0, -0.01, 0.14), 0.011, 8, "brass")
    for s in (-1, 1):
        g.cyl(s * 0.06, -0.215, 0.12, 0.15, 0.018, 8, "brass")
    return {"sockets": [sk("tap", 0.0, -0.01, 0.14), sk("basin", 0.0, 0.01, 0.006)],
            "note": "robinet au nord (contre le refend), avant du modèle = côté du plongeur; ne pas tourner dans la coque"}


@objet("station_dishwasher", "neutre", "poste", 600, nom="Lave-verres sous le plan")
def o_dishwasher(g):
    """Façade du lave-verres sous l'évier (0,76 x 0,04 x 0,72 m): elle se pose devant le placard de la plonge (x 7,18 à 7,93,
    y 7,70) et le recouvre."""
    g.box(-0.38, 0.38, 0, 0.035, 0.1, 0.84, "steel", bevel=0.006)
    g.box(-0.36, 0.36, 0.035, 0.04, 0.7, 0.8, "steel_dark", bevel=0)
    g.rod((-0.25, 0.07, 0.66), (0.25, 0.07, 0.66), 0.01, 8, "steel")
    for x in (-0.25, 0.25):
        g.rod((x, 0.035, 0.66), (x, 0.07, 0.66), 0.008, 6, "steel")
    for i in range(3):
        g.cyl(0.18 + i * 0.05, 0.04, 0.75, 0.765, 0.012, 8, ["ink", "alert", "leaf"][i])
    return {"note": "origine au dos de la façade, en bas; dans la coque: x 7,555, z 7,70"}


@objet("station_cup_shelf", "neutre", "poste", 1000, nom="Étagère à tasses")
def o_cup_shelf(g):
    """Étagère à deux niveaux pour l'arrière-comptoir (0,60 x 0,25 x 0,40 m), tasses retournées (le jeu les compte)."""
    for x in (-0.29, 0.29):
        for y in (-0.11, 0.11):
            g.rod((x, y, 0), (x, y, 0.4), 0.008, 6, "steel")
    socks = []
    for zi, z in enumerate((0.02, 0.22)):
        g.box(-0.3, 0.3, -0.125, 0.125, z, z + 0.012, "steel", bevel=0.003)
        for i in range(4):
            for j in range(2):
                socks.append(sk(f"cup_{zi}_{i}_{j}", -0.21 + i * 0.14, -0.06 + j * 0.12, z + 0.012))
    return {"sockets": socks, "note": "16 places de tasse (douilles cup_niveau_colonne_rangée)"}


# ------------------------------------------------------------------------------------------------
# Équipements achetables (postes-equipements.json)

@objet("presse_levier", "neutre", "poste", 600, nom="Presse-agrumes à levier")
def o_presse(g):
    g.cyl(0, 0, 0, 0.03, 0.12, 12, "iron", bevel=0.006)
    g.box(-0.02, 0.02, -0.1, -0.06, 0.03, 0.4, "iron", bevel=0.006)
    g.lathe(0, 0.0, 0.12, [(0.02, 0), (0.07, 0.04), (0.08, 0.06)], 12, "steel", cap_bottom=True, cap_top=False)
    g.lathe(0, 0.0, 0.14, [(0.03, 0), (0.0, 0.04)], 10, "steel", cap_bottom=True, cap_top=False)
    g.lathe(0, 0.0, 0.22, [(0.075, 0), (0.06, 0.05), (0.02, 0.07)], 12, "steel", cap_bottom=True, cap_top=True)
    g.rod((0, -0.08, 0.38), (0, -0.0, 0.3), 0.01, 6, "iron")
    g.rod((0, -0.08, 0.38), (0, 0.18, 0.42), 0.012, 6, "iron")
    g.sphere(0, 0.18, 0.42, 0.02, 0.02, 0.02, "enamel_white", segs=8, rings=5)
    g.rod((0, 0.075, 0.12), (0, 0.11, 0.09), 0.008, 6, "steel")
    return {"sockets": [sk("glass", 0.0, 0.11, 0.03)], "note": "verre posé sous le bec (douille glass)"}


@objet("creperie", "neutre", "poste", 600, nom="Crêpière")
def o_crepiere(g):
    g.box(-0.22, 0.22, -0.22, 0.22, 0, 0.12, "t:zinc", bevel=0.01)
    g.cyl(0, 0, 0.12, 0.15, 0.2, 20, "iron", bevel=0.004)
    g.box(-0.08, 0.08, 0.22, 0.225, 0.03, 0.09, "ink", bevel=0)
    g.cyl(0.05, 0.226, 0.05, 0.07, 0.012, 8, "brass")
    return {"sockets": [sk("plate", 0.0, 0.0, 0.15)]}


@objet("frigo_vitre", "neutre", "poste", 2000, accroche="sol", nom="Réfrigérateur vitré")
def o_frigo_vitre(g):
    w, d, h = 0.6, 0.6, 0.85
    g.box(-w / 2, w / 2, -d / 2, d / 2 - 0.04, 0.02, h, "fridge_white", bevel=0.01)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, d / 2 - 0.045, d / 2, 0.06, h - 0.02, "steel_dark", bevel=0.006)
    g.quad([(-w / 2 + 0.06, d / 2 + 0.001, 0.1), (w / 2 - 0.06, d / 2 + 0.001, 0.1), (w / 2 - 0.06, d / 2 + 0.001, h - 0.06), (-w / 2 + 0.06, d / 2 + 0.001, h - 0.06)], "glass", normal_hint=(0, 1, 0))
    for z in (0.3, 0.55):
        g.box(-w / 2 + 0.04, w / 2 - 0.04, -d / 2 + 0.04, d / 2 - 0.06, z, z + 0.01, "steel", bevel=0)
        for i in range(5):
            x = -0.2 + i * 0.1
            g.cyl(x, 0.1, z + 0.01, z + 0.2, 0.03, 8, "bottle_green_glass")
            g.cyl(x, 0.1, z + 0.2, z + 0.24, 0.012, 6, "bottle_green_glass")
    g.box(-w / 2 + 0.02, w / 2 - 0.02, -d / 2 + 0.02, d / 2 - 0.06, 0.0, 0.02, "ink", bevel=0)
    g.rod((w / 2 - 0.06, d / 2 + 0.02, 0.2), (w / 2 - 0.06, d / 2 + 0.02, 0.7), 0.01, 6, "steel")
    return {"note": "sous le plan ou dans l'allée (work_area); bouteilles de limonade visibles"}


@objet("etagere_livres_equip", "neutre", "etagere", 1000, accroche="sol", nom="Étagère à livres (livres de Lise)")
def o_livres(g):
    w, d, h = 1.0, 0.3, 1.8
    OAK = "t:oak_campagne"
    for x in (-w / 2, w / 2 - 0.025):
        g.box(x, x + 0.025, -d / 2, d / 2, 0, h, OAK, bevel=0.004)
    g.box(-w / 2, w / 2, -d / 2, -d / 2 + 0.012, 0, h, OAK, bevel=0)
    import random
    rnd = random.Random(3)
    cols = ["book_red", "book_green", "book_blue", "book_ochre", "paper_old", "house_bordeaux"]
    for k, z in enumerate((0.0, 0.42, 0.84, 1.26)):
        g.box(-w / 2 + 0.025, w / 2 - 0.025, -d / 2 + 0.012, d / 2, z, z + 0.025, OAK, bevel=0.004)
        x = -w / 2 + 0.04
        while x < w / 2 - 0.12 and k < 4:
            t = rnd.uniform(0.025, 0.05)
            hh = rnd.uniform(0.2, 0.3)
            if rnd.random() < 0.12:
                x += 0.06
                continue
            g.box(x, x + t, -d / 2 + 0.03, -d / 2 + 0.03 + rnd.uniform(0.15, 0.2), z + 0.025, z + 0.025 + hh, cols[rnd.randrange(len(cols))], bevel=0, drop=("bottom", "n"))
            x += t + 0.002
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.03, h, OAK, bevel=0.006)
    return {"note": "dos au mur (nord)"}


@objet("range_velos", "neutre", "terrasse", 600, accroche="sol", nom="Range-vélos")
def o_velos(g):
    for i in range(4):
        x = -0.6 + i * 0.4
        pts = [(x, -0.2, 0), (x, -0.2, 0.55), (x, -0.05, 0.75), (x, 0.1, 0.55), (x, 0.1, 0)]
        for a, b in zip(pts, pts[1:]):
            g.rod(a, b, 0.016, 6, "jardin_iron", cap=False)
    g.box(-0.85, 0.85, -0.25, 0.15, 0.0, 0.02, "steel_dark", bevel=0.004)
    g.rod((-0.6, -0.05, 0.4), (0.6, -0.05, 0.4), 0.012, 6, "jardin_iron")
    return {"note": "sur le trottoir, contre la façade (street); 1,80 x 0,50 m"}


@objet("coin_enfants", "neutre", "jeu", 1200, accroche="sol", nom="Chaise haute et coin des enfants")
def o_enfants(g):
    g.box(-0.6, 0.6, -0.6, 0.6, 0, 0.01, "familles_sky", bevel=0.004, edges="top")
    for i, (x, y, c) in enumerate(((-0.3, -0.2, "child_red"), (-0.15, -0.25, "child_yellow"), (0.0, -0.3, "child_blue"))):
        g.box(x - 0.1, x + 0.1, y - 0.1, y + 0.1, 0.01, 0.13, c, bevel=0.012)
    for i in range(5):
        a = i * 0.4
        g.rod((0.1 + 0.05 * math.cos(a), 0.2, 0.015), (0.18 + 0.05 * math.cos(a), 0.25 + 0.02 * i, 0.015), 0.005, 5, ["child_red", "child_yellow", "child_blue", "leaf", "ink"][i])
    # chaise haute
    OAK = "t:oak_campagne"
    cx, cy = 0.35, -0.25
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.rod((cx + sx * 0.2, cy + sy * 0.2, 0), (cx + sx * 0.14, cy + sy * 0.14, 0.55), 0.016, 6, OAK)
    g.box(cx - 0.17, cx + 0.17, cy - 0.17, cy + 0.17, 0.55, 0.58, OAK, bevel=0.006)
    g.box(cx - 0.16, cx + 0.16, cy - 0.17, cy - 0.14, 0.58, 0.88, OAK, bevel=0.006)
    g.box(cx - 0.17, cx + 0.17, cy + 0.08, cy + 0.2, 0.75, 0.77, OAK, bevel=0.005)
    g.rod((cx - 0.17, cy + 0.17, 0.25), (cx + 0.17, cy + 0.17, 0.25), 0.012, 6, OAK)
    return {"seats": [MB.seat(0.35, -0.22, 0.58)], "note": "tapis de 1,20 m, cubes, crayons, chaise haute (assise 0,58 m)"}


# ------------------------------------------------------------------------------------------------
# Vaisselle (120 %), contenus en nœud à part

def tasse(g, x, y, z, kind, contenu=True, soucoupe=False):
    s = 1.2
    if kind == "espresso":
        r0, r1, h = 0.022 * s, 0.03 * s, 0.05 * s
    else:
        r0, r1, h = 0.03 * s, 0.05 * s, 0.065 * s
    t = 0.004
    g.lathe(x, y, z, [(r0 * 0.8, 0), (r0, 0.006), (r1, h - 0.005), (r1, h), (r1 - t, h), (r0 - t, 0.012), (0.0, 0.01)], 12, "porcelain",
            keys=["porcelain", "porcelain", "rim", "porcelain", "porcelain", "porcelain"], cap_bottom=True, cap_top=False)
    pts = []
    for i in range(5):
        t_ = math.pi * i / 4
        pts.append((r1 * 0.95 + 0.018 * s * math.sin(t_), z + h * 0.25 + h * 0.5 * (1 - math.cos(t_)) / 2 * 1.4))
    for i in range(len(pts) - 1):
        (u0, w0), (u1, w1) = pts[i], pts[i + 1]
        g.rod((x + u0, y, w0), (x + u1, y, w1), 0.005, 5, "porcelain", cap=False)
    return r1 - t - 0.001, z + h - 0.012


def liquide(ident, z0, z1, r1, r0, key):
    """Contenu opaque: tronc de cône plein sous le bord, dessus à la couleur de la boisson (nœud <id>_liquid)."""
    lg = Geo(ident + "_liquid", smooth=True)
    lg.lathe(0, 0, z0, [(r0, 0), (r1, z1 - z0)], 12, key, cap_bottom=False, cap_top=True)
    return lg


@objet("ware_cup_espresso", "neutre", "vaisselle", 250, nom="Tasse à espresso")
def o_cup_espresso(g):
    r, ztop = tasse(g, 0, 0, 0, "espresso")
    return {"extra_geos": [liquide("ware_cup_espresso", 0.012, ztop, r, 0.023, "crema")],
            "note": "7 cm à 120 %; anse vers l'est (+X); contenu: nœud ware_cup_espresso_liquid (crème d'espresso)"}


@objet("ware_cup_cappuccino", "neutre", "vaisselle", 250, nom="Tasse à cappuccino")
def o_cup_cappu(g):
    r, ztop = tasse(g, 0, 0, 0, "cappuccino")
    return {"extra_geos": [liquide("ware_cup_cappuccino", 0.012, ztop, r, 0.032, "milk")],
            "note": "sert aussi au café crème, au chocolat et au noisette (teinter ou remplacer le contenu, nœud _liquid)"}


@objet("ware_saucer", "neutre", "vaisselle", 250, nom="Soucoupe")
def o_saucer(g):
    sr = 0.075 * 1.2
    g.lathe(0, 0, 0, [(sr * 0.55, 0), (sr * 0.9, 0.004), (sr, 0.012), (sr * 0.97, 0.014), (sr * 0.5, 0.008)], 16, "porcelain",
            keys=["porcelain", "porcelain", "rim", "porcelain"], cap_bottom=True, cap_top=True)
    return {"sockets": [sk("cup", 0.0, 0.0, 0.008)]}


@objet("ware_plate", "neutre", "vaisselle", 250, nom="Assiette à dessert")
def o_plate(g):
    r = 0.12
    g.lathe(0, 0, 0, [(r * 0.55, 0), (r * 0.6, 0.004), (r * 0.82, 0.006), (r * 0.94, 0.014), (r, 0.016), (r * 0.97, 0.018), (r * 0.6, 0.009)],
            16, "porcelain", keys=["porcelain", "porcelain", "porcelain", "rim", "rim", "porcelain"], cap_bottom=True, cap_top=True)
    return {"sockets": [sk("food", 0.0, 0.0, 0.009)], "note": "24 cm (120 %)"}


@objet("ware_glass", "neutre", "vaisselle", 250, nom="Verre (citronnade, jus, limonade)")
def o_glass(g):
    g.lathe(0, 0, 0, [(0.03, 0), (0.035, 0.008), (0.04, 0.13), (0.037, 0.13), (0.032, 0.012), (0.0, 0.01)], 12, "glass", cap_bottom=True, cap_top=False)
    return {"extra_geos": [liquide("ware_glass", 0.012, 0.11, 0.0355, 0.031, "citrus")], "note": "13 cm; contenu opaque sous le bord (bible 6), nœud _liquid"}


@objet("ware_teapot", "neutre", "vaisselle", 250, nom="Théière")
def o_teapot(g):
    g.lathe(0, 0, 0, [(0.05, 0), (0.075, 0.03), (0.08, 0.07), (0.06, 0.11), (0.03, 0.12), (0.0, 0.125)], 12, "glaze_sage", cap_bottom=True, cap_top=False)
    g.sphere(0, 0, 0.13, 0.012, 0.012, 0.012, "glaze_sage", segs=6, rings=4)
    g.rod((0.07, 0, 0.04), (0.13, 0, 0.11), 0.01, 6, "glaze_sage")
    g.rod((-0.075, 0, 0.09), (-0.11, 0, 0.07), 0.008, 5, "glaze_sage", cap=False)
    g.rod((-0.11, 0, 0.07), (-0.075, 0, 0.03), 0.008, 5, "glaze_sage", cap=False)
    return {"note": "le thé compte deux pièces de vaisselle (tasse et théière)"}


@objet("ware_tray", "neutre", "vaisselle", 250, nom="Plateau")
def o_tray(g):
    g.box(-0.2, 0.2, -0.15, 0.15, 0, 0.008, "t:walnut", bevel=0.004)
    for (a, b, c, d) in ((-0.2, 0.2, -0.15, -0.14), (-0.2, 0.2, 0.14, 0.15), (-0.2, -0.19, -0.14, 0.14), (0.19, 0.2, -0.14, 0.14)):
        g.box(a, b, c, d, 0.008, 0.03, "t:walnut", bevel=0.003)
    socks = [sk(f"slot_{i}", -0.12 + (i % 3) * 0.12, -0.06 + (i // 3) * 0.12, 0.008) for i in range(6)]
    return {"sockets": socks, "note": "40 x 30 cm, six emplacements"}


@objet("ware_takeaway_cup", "neutre", "vaisselle", 250, nom="Gobelet à emporter")
def o_takeaway(g):
    g.lathe(0, 0, 0, [(0.03, 0), (0.04, 0.1), (0.0, 0.1)], 12, "kraft", cap_bottom=True, cap_top=False)
    g.lathe(0, 0, 0.03, [(0.034, 0), (0.037, 0.05)], 12, "paper", cap_bottom=False, cap_top=False)
    g.lathe(0, 0, 0.1, [(0.042, 0), (0.042, 0.008), (0.03, 0.016), (0.0, 0.018)], 12, "paper", cap_bottom=True, cap_top=False)
    return {"note": "couvercle crème: le jeu peut y écrire (événement du car de 8 h 12)"}


@objet("pichet_thermometre", "neutre", "vaisselle", 250, nom="Pichet thermomètre (équipement t0)")
def o_pichet(g):
    g.lathe(0, 0, 0, [(0.04, 0), (0.05, 0.005), (0.052, 0.09), (0.045, 0.13), (0.048, 0.14), (0.044, 0.14), (0.0, 0.01)], 12, "steel", cap_bottom=True, cap_top=False)
    g.rod((0.05, 0, 0.12), (0.075, 0, 0.1), 0.006, 5, "steel", cap=False)
    g.rod((0.075, 0, 0.1), (0.05, 0, 0.04), 0.006, 5, "steel", cap=False)
    g.cyl(-0.035, 0.0, 0.1, 0.16, 0.004, 5, "steel_dark")
    g.cyl(-0.035, 0.0, 0.16, 0.17, 0.016, 10, "enamel_white")
    return {"extra_geos": [liquide("pichet_thermometre", 0.012, 0.09, 0.048, 0.042, "milk")]}


# ------------------------------------------------------------------------------------------------
# Nourriture (120 %)

@objet("food_croissant", "neutre", "nourriture", 250, nom="Croissant")
def o_croissant(g):
    S.croissant_geo(g, 0, 0, 0, 0)
    for i, k in enumerate(g.keys):
        g.keys[i] = _key(k)
    recentrer(g)
    return {"note": "16 cm à 120 %"}


@objet("food_pain_chocolat", "neutre", "nourriture", 250, nom="Pain au chocolat")
def o_pac(g):
    s = 1.2
    w, d, h = 0.12 * s, 0.075 * s, 0.035 * s
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0, h, "crust", bevel=0.012, segs=1)
    for x in (-0.025, 0.025):
        g.box(x - 0.007, x + 0.007, -d / 2 - 0.002, -d / 2 + 0.01, h * 0.35, h * 0.65, "chocolate_bar", bevel=0.002)
        g.box(x - 0.007, x + 0.007, d / 2 - 0.01, d / 2 + 0.002, h * 0.35, h * 0.65, "chocolate_bar", bevel=0.002)
    for i in range(3):
        g.box(-w / 2 + 0.01, w / 2 - 0.01, -d / 2 + 0.01 + i * 0.03, -d / 2 + 0.02 + i * 0.03, h - 0.002, h + 0.002, "pastry", bevel=0, drop=("bottom",))
    return {"note": "14 x 9 cm (120 %), barres de chocolat visibles aux deux bouts"}


@objet("food_tartine", "neutre", "nourriture", 250, nom="Tartine beurre-confiture")
def o_tartine(g):
    s = 1.2
    g.box(-0.09 * s, 0.09 * s, -0.04 * s, 0.04 * s, 0, 0.022, "crumb", bevel=0.006, faces_keys={"n": "crust", "s": "crust", "e": "crust", "w": "crust"})
    g.box(-0.08 * s, 0.08 * s, -0.033 * s, 0.033 * s, 0.022, 0.026, "berry", bevel=0.002)
    return {}


@objet("food_tarte_fruits", "neutre", "nourriture", 250, nom="Part de tarte aux fruits")
def o_tarte(g):
    """Part de tarte (un huitième d'une tarte de 26 cm, à 120 %): pâte, crème, abricots nappés."""
    R = 0.13 * 1.2
    a = math.radians(45)
    n = 4
    rim = [(R * math.cos(-a / 2 + a * i / n), R * math.sin(-a / 2 + a * i / n)) for i in range(n + 1)]
    pts = [(0.0, 0.0)] + rim
    g.prism(pts, 0, 0.012, "pastry")
    inner = [(0.012, 0.0)] + [(x * 0.9, y * 0.9) for x, y in rim]
    g.prism(inner, 0.012, 0.028, "custard")
    g.prism([(R * 0.9 * math.cos(-a / 2 + a * i / n), R * 0.9 * math.sin(-a / 2 + a * i / n)) for i in range(n + 1)] +
            [(R * math.cos(-a / 2 + a * i / n), R * math.sin(-a / 2 + a * i / n)) for i in range(n, -1, -1)], 0.012, 0.034, "crust")
    for (r, t) in ((0.05, -0.12), (0.09, 0.15), (0.12, -0.25), (0.12, 0.25)):
        g.sphere(r * math.cos(t), r * math.sin(t), 0.03, 0.017, 0.017, 0.008, "glaze_apricot", segs=6, rings=3)
    recentrer(g)
    return {"note": "pointe vers l'ouest dans le modèle; recentrée sur son emprise"}


@objet("food_crepe", "neutre", "nourriture", 250, nom="Crêpe pliée")
def o_crepe(g):
    R = 0.13
    pts = [(R * math.cos(math.radians(a)), R * math.sin(math.radians(a))) for a in range(-45, 46, 10)]
    g.prism([(0, 0)] + pts, 0, 0.012, "custard")
    g.sphere(0.05, 0.0, 0.016, 0.02, 0.02, 0.006, "pastry", segs=8, rings=4)
    recentrer(g)
    return {"note": "pliée en quatre"}


# ------------------------------------------------------------------------------------------------
# Livraisons

def carton(g, w, d, h):
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0, h, "t:kraft", bevel=0.004)
    g.box(-0.03, 0.03, -d / 2 - 0.001, d / 2 + 0.001, h - 0.0005, h + 0.001, "tape", bevel=0)
    g.box(-w / 2 + 0.03, -w / 2 + 0.12, d / 2, d / 2 + 0.002, h * 0.55, h * 0.75, "label", bevel=0)


@objet("crate_box_s", "neutre", "carton", 100, accroche="sol", nom="Petit carton (ingrédients secs)")
def o_box_s(g):
    carton(g, 0.3, 0.2, 0.2)
    return {}


@objet("crate_box_m", "neutre", "carton", 100, accroche="sol", nom="Carton moyen")
def o_box_m(g):
    carton(g, 0.4, 0.3, 0.3)
    return {}


@objet("crate_box_l", "neutre", "carton", 100, accroche="sol", nom="Grand carton lourd (se porte à deux)")
def o_box_l(g):
    carton(g, 0.6, 0.4, 0.4)
    return {}


# ------------------------------------------------------------------------------------------------
# Rue et terrasse

@objet("ardoise_trottoir", "neutre", "rue", 600, accroche="sol", nom="Ardoise de trottoir")
def o_ardoise(g):
    """Chevalet de chêne à deux faces (plan: furniture-4, 0,40 x 0,30 m, 1,05 m): ardoise face au sud et au nord."""
    from mathutils import Matrix
    piv = Matrix.Translation(K.P(0, 0, 1.05))
    piv_inv = Matrix.Translation(K.P(0, 0, -1.05))
    for side in (1, -1):
        vs = []
        vs += g.box(-0.2, 0.2, -0.02, 0.0, 0.0, 1.05, "oak_dark", bevel=0.006)
        vs += g.box(-0.17, 0.17, -0.025, -0.02, 0.38, 1.0, "slate", bevel=0)
        # chevalet: les deux panneaux pivotent autour de l'arête du haut, pieds écartés
        M = piv @ Matrix.Rotation(math.radians(8), 4, "X") @ piv_inv
        if side < 0:
            M = Matrix.Rotation(math.pi, 4, "Z") @ M
        Geo.transform(set(vs), M)
    return {"note": "zones d'écriture: ardoises de 0,34 x 0,62 m sur chaque face (texte du jeu, Caveat)"}


@objet("shell_village_ext_terrasse", "neutre", "extension", 3000, accroche="plan", nom="Terrasse sous le store (extension)")
def o_terrasse(g):
    """Store banne du plan village-maximum (hood-1: x 4,00 à 8,80, y 13,00 à 15,50), en coordonnées du plan (se pose tel quel
    comme la coque). Toile rayée vert bouteille et écru, bras articulés, lambrequin; 2,60 m au mur, 2,25 m au bord."""
    x0, x1, y0, y1 = 4.0, 8.8, 13.0, 15.5
    z0, z1 = 2.6, 2.25
    g.box(x0 - 0.05, x1 + 0.05, y0, y0 + 0.14, z0 - 0.05, z0 + 0.1, "steel_dark", bevel=0.01)
    g.quad([(x0, y0 + 0.1, z0), (x1, y0 + 0.1, z0), (x1, y1, z1), (x0, y1, z1)], "t:stripes", normal_hint=(0, 0.3, 1))
    g.quad([(x0, y0 + 0.1, z0 - 0.01), (x0, y1, z1 - 0.01), (x1, y1, z1 - 0.01), (x1, y0 + 0.1, z0 - 0.01)], "t:stripes", normal_hint=(0, -0.3, -1))
    n = 16
    for i in range(n):
        xa, xb = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
        xm = (xa + xb) / 2
        pts = [(xa, y1, z1), (xb, y1, z1), (xb, y1, z1 - 0.2), (xm, y1, z1 - 0.26), (xa, y1, z1 - 0.2)]
        g.quad(pts, "t:stripes", normal_hint=(0, 1, 0))
        g.quad(list(reversed(pts)), "t:stripes", normal_hint=(0, -1, 0))
    g.rod((x0, y1, z1), (x1, y1, z1), 0.02, 8, "steel_dark")
    for x in (x0 + 0.3, x1 - 0.3):
        g.rod((x, y0 + 0.05, z0 - 0.35), (x, y0 + 1.25, z0 - 0.05), 0.02, 6, "steel_dark")
        g.rod((x, y0 + 1.25, z0 - 0.05), (x, y1 - 0.02, z1 - 0.01), 0.02, 6, "steel_dark")
        g.box(x - 0.05, x + 0.05, y0, y0 + 0.04, z0 - 0.45, z0 - 0.25, "steel_dark", bevel=0.006)
    return {"note": "coordonnées du plan, à poser sans transformation; bord du lambrequin à 1,99 m (au-dessus des têtes: 2,05 m au plus bas des bras)",
            "plan": True}


# ------------------------------------------------------------------------------------------------
# Objets uniques et brocante: cadres (tailles du catalogue)

def cadre(g, w, h, dd, fond, motif=None, cadre_key="oak_dark"):
    g.box(-w / 2, w / 2, 0, dd, 0, h, cadre_key, bevel=0.003)
    m = min(0.03, w * 0.08)
    g.quad([(-w / 2 + m, dd + 0.001, m), (w / 2 - m, dd + 0.001, m), (w / 2 - m, dd + 0.001, h - m), (-w / 2 + m, dd + 0.001, h - m)], fond, normal_hint=(0, 1, 0))
    for (u0, v0, u1, v1, k) in (motif or []):
        X = lambda u: -w / 2 + m + (w - 2 * m) * u
        Z = lambda v: m + (h - 2 * m) * v
        g.quad([(X(u0), dd + 0.002, Z(v0)), (X(u1), dd + 0.002, Z(v0)), (X(u1), dd + 0.002, Z(v1)), (X(u0), dd + 0.002, Z(v1))], k, normal_hint=(0, 1, 0))


CADRES = {
    "aquarelle_simone": (0.5, 0.4, 0.03, "paper_old", [(0.0, 0.0, 1.0, 0.35, "poster_ground"), (0.1, 0.35, 0.45, 0.8, "poster_tree"), (0.55, 0.35, 0.9, 0.6, "village_stone")], "Aquarelle de Simone (la place vue de son banc)"),
    "dessins_noe": (0.7, 0.5, 0.03, "paper", [(0.05, 0.1, 0.3, 0.5, "child_red"), (0.4, 0.2, 0.6, 0.8, "child_yellow"), (0.7, 0.1, 0.95, 0.4, "child_blue")], "Dessins de Noé"),
    "carte_postale_brissac": (0.15, 0.1, 0.01, "poster_sky", [(0.0, 0.0, 1.0, 0.4, "familles_sky")], "Carte postale d'Octave Brissac"),
    "joint_encadre": (0.25, 0.25, 0.03, "paper_old", [(0.3, 0.3, 0.7, 0.7, "rubber")], "Le vieux joint du groupe, encadré"),
    "fanion_godillots": (0.4, 0.3, 0.02, "promeneurs_forest", [(0.1, 0.4, 0.9, 0.6, "paper")], "Fanion des Godillots"),
    "coupure_echo": (0.3, 0.4, 0.02, "paper_old", [(0.1, 0.75, 0.9, 0.9, "ink"), (0.1, 0.4, 0.45, 0.7, "felt"), (0.55, 0.1, 0.9, 0.7, "felt")], "Coupure de L'Écho de l'Arvelle"),
    "plaque_hygiene": (0.2, 0.15, 0.01, "faience_white", [(0.1, 0.6, 0.9, 0.8, "faience_blue")], "Plaque de l'inspection"),
    "photo_maries": (0.3, 0.4, 0.02, "paper_old", [(0.15, 0.1, 0.45, 0.75, "familles_sky"), (0.55, 0.1, 0.85, 0.75, "top_light_cream")], "Photo des mariés"),
    "brocante_plaque_emaillee": (0.6, 0.4, 0.02, "house_bottle", [(0.08, 0.3, 0.92, 0.7, "enamel_white")], "Plaque émaillée (brocante)"),
}


def _make_cadre(ident, spec):
    w, h, dd, fond, motif, nom = spec

    def fn(g):
        cadre(g, w, h, dd, fond, motif, cadre_key="paper" if dd <= 0.01 else "oak_dark")
        return {"note": "image figurée en aplats; texte éventuel écrit par le jeu"}
    CATALOGUE[ident] = dict(fn=fn, style="neutre", categorie="cadre", budget=150, accroche="mur", nom=nom)


for _i, _s in CADRES.items():
    _make_cadre(_i, _s)


@objet("ecuelle_gribouille", "neutre", "terrasse", 250, accroche="sol", nom="Écuelle de Gribouille")
def o_ecuelle(g):
    g.lathe(0, 0, 0, [(0.1, 0), (0.12, 0.06), (0.11, 0.07), (0.08, 0.02), (0.0, 0.02)], 14, "enamel_white",
            keys=["enamel_white", "rim", "enamel_white", "enamel_white"], cap_bottom=True, cap_top=False)
    g.cyl(0, 0, 0.02, 0.045, 0.085, 14, "village_water", cap_bottom=False)
    return {}


@objet("moulin_mamie_odile", "campagne", "comptoir", 250, nom="Moulin à poivre de Mamie Odile")
def o_moulin_odile(g):
    g.lathe(0, 0, 0, [(0.03, 0), (0.032, 0.02), (0.022, 0.08), (0.028, 0.16), (0.03, 0.2), (0.02, 0.23), (0.006, 0.25)], 10, "t:oak_campagne", cap_bottom=True, cap_top=True)
    return {}


@objet("pichet_argent", "neutre", "comptoir", 250, nom="Pichet d'argent (concours du cœur de lait)")
def o_pichet_argent(g):
    g.lathe(0, 0, 0, [(0.04, 0), (0.05, 0.01), (0.045, 0.06), (0.05, 0.15), (0.055, 0.17), (0.0, 0.01)], 12, "chrome", cap_bottom=True, cap_top=False)
    g.rod((0.045, 0, 0.14), (0.08, 0, 0.12), 0.006, 5, "chrome", cap=False)
    g.rod((0.08, 0, 0.12), (0.045, 0, 0.05), 0.006, 5, "chrome", cap=False)
    return {}


@objet("brocante_moulin_cafe", "campagne", "comptoir", 600, nom="Moulin à café à manivelle (brocante)")
def o_moulin_cafe(g):
    g.box(-0.08, 0.08, -0.08, 0.08, 0, 0.16, "t:walnut", bevel=0.008)
    g.box(-0.04, 0.04, 0.08, 0.085, 0.03, 0.07, "brass", bevel=0)
    g.lathe(0, 0, 0.16, [(0.06, 0), (0.05, 0.05), (0.02, 0.07)], 12, "brass", cap_bottom=True, cap_top=True)
    g.rod((0, 0, 0.23), (0.09, 0, 0.25), 0.006, 5, "iron")
    g.rod((0.09, 0, 0.25), (0.09, 0, 0.3), 0.006, 5, "iron")
    g.sphere(0.09, 0, 0.31, 0.014, 0.014, 0.02, "t:walnut", segs=8, rings=4)
    return {}


@objet("brocante_lampe_champignon", "retro", "luminaire", 600, nom="Lampe champignon (brocante)")
def o_champignon(g):
    g.lathe(0, 0, 0, [(0.09, 0), (0.09, 0.02), (0.04, 0.05), (0.03, 0.22)], 14, "retro_orange", cap_bottom=True, cap_top=False)
    g.lathe(0, 0, 0.2, [(0.03, 0), (0.15, 0.02), (0.14, 0.08), (0.08, 0.17), (0.0, 0.2)], 14, "retro_orange", cap_bottom=False, cap_top=False)
    g.lathe(0, 0, 0.2, [(0.0, 0.17), (0.13, 0.03), (0.03, 0.005)], 14, "glow", cap_bottom=False, cap_top=False)
    return {"lumiere": {"z": 0.25}}


@objet("brocante_chaises_coques", "retro", "chaise", 600, accroche="sol", nom="Chaise coque (brocante, vendue par deux)")
def o_coque(g):
    for (x, y) in ((-0.18, 0.17), (0.18, 0.17), (-0.18, -0.17), (0.18, -0.17)):
        g.rod((x, y, 0), (x * 0.6, y * 0.6, 0.4), 0.01, 6, "chrome")
    g.lathe(0, 0, 0.4, [(0.0, 0.0), (0.2, 0.02), (0.23, 0.05)], 14, "retro_mustard", cap_bottom=True, cap_top=True, sy=0.95)
    n = 9
    for i in range(n):
        a0, a1 = math.pi + math.pi * i / n - 0.4, math.pi + math.pi * (i + 1) / n - 0.4
        a1 = min(a1, 2 * math.pi + 0.4)
        p0 = (0.23 * math.cos(a0), 0.23 * math.sin(a0))
        p1 = (0.23 * math.cos(a1), 0.23 * math.sin(a1))
        hz = lambda a: 0.6 + 0.2 * max(0.0, -math.sin(a))
        g.quad([(p0[0], p0[1], 0.44), (p1[0], p1[1], 0.44), (p1[0], p1[1], hz(a1)), (p0[0], p0[1], hz(a0))], "retro_mustard", normal_hint=(-p0[0], -p0[1], 0))
        g.quad([(p0[0], p0[1], 0.44), (p0[0], p0[1], hz(a0)), (p1[0], p1[1], hz(a1)), (p1[0], p1[1], 0.44)], "retro_mustard", normal_hint=(p0[0], p0[1], 0))
    return {"seats": [MB.seat(0, 0.02, 0.45)], "note": "à poser par deux (count 2)"}


@objet("brocante_banc_nordique", "nordique", "banc", 1200, accroche="sol", nom="Banc nordique (brocante)")
def o_banc_nordique(g):
    w, d, h = 1.2, 0.4, 0.45
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.rod((sx * (w / 2 - 0.06), sy * (d / 2 - 0.05), 0), (sx * (w / 2 - 0.1), sy * (d / 2 - 0.08), h - 0.035), 0.02, 6, "nordique_ash")
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.035, h, "nordique_ash", bevel=0.01)
    g.box(-w / 2 + 0.05, -0.02, -d / 2 + 0.04, d / 2 - 0.04, h, h + 0.05, "nordique_wool", bevel=0.02)
    g.box(0.02, w / 2 - 0.05, -d / 2 + 0.04, d / 2 - 0.04, h, h + 0.05, "nordique_rose", bevel=0.02)
    return {"seats": [MB.seat(-0.3, 0, h + 0.05), MB.seat(0.3, 0, h + 0.05)]}


@objet("brocante_horloge_comtoise", "campagne", "horloge", 1200, accroche="sol", nom="Horloge comtoise (brocante)")
def o_comtoise(g):
    OAK = "t:oak_campagne"
    g.box(-0.25, 0.25, -0.15, 0.15, 0, 0.45, OAK, bevel=0.01)
    g.lathe(0, 0, 0.45, [(0.17, 0), (0.13, 0.5), (0.12, 1.4)], 8, OAK, cap_bottom=False, cap_top=False, phase=22.5, sy=0.85)
    g.box(-0.24, 0.24, -0.15, 0.15, 1.6, 2.1, OAK, bevel=0.012)
    g.box(-0.26, 0.26, -0.16, 0.16, 2.1, 2.2, OAK, bevel=0.012)
    g.box(-0.24, 0.24, -0.12, 0.13, 1.45, 1.6, OAK, bevel=0.008)
    from mathutils import Matrix
    vs = g.cyl(0, 0, 0, 0.01, 0.16, 16, "enamel_white")
    vs += g.cyl(0, 0, 0.01, 0.013, 0.02, 8, "brass")
    Geo.transform(set(vs), Matrix.Translation(K.P(0, 0.15, 1.85)) @ Matrix.Rotation(math.radians(90), 4, "X"))
    vs = g.cyl(0, 0, 0, 0.006, 0.09, 14, "brass")
    Geo.transform(set(vs), Matrix.Translation(K.P(0, 0.13, 0.95)) @ Matrix.Rotation(math.radians(90), 4, "X"))
    g.rod((0, 0.12, 1.45), (0, 0.12, 0.98), 0.006, 5, "brass")
    return {"note": "dos au mur; balancier fixe en v0.1"}


# ------------------------------------------------------------------------------------------------
# Objets d'événements (evenements.json)

@objet("event_piece_montee", "neutre", "evenement", 1200, nom="Pièce montée du café d'honneur")
def o_piece_montee(g):
    g.cyl(0, 0, 0, 0.02, 0.22, 16, "t:walnut", bevel=0.005)
    # croquembouche: cône de choux (profil ondulé, un rang de choux tous les 4 cm), fleur au sommet
    prof = []
    H_ = 0.5
    for i in range(13):
        t = i / 12
        r = 0.17 * (1 - t) + 0.02
        prof.append((r + 0.012 * (1 if i % 2 else -1), 0.02 + H_ * t))
    g.lathe(0, 0, 0.0, prof, 14, "crust", cap_bottom=False, cap_top=True)
    for i in range(10):
        a = i * 2.4
        t = 0.1 + 0.08 * i
        r = 0.17 * (1 - t) + 0.035
        g.sphere(r * math.cos(a), r * math.sin(a), 0.02 + H_ * t, 0.012, 0.012, 0.01, "flower_white", segs=5, rings=3)
    g.sphere(0, 0, 0.02 + H_ + 0.03, 0.03, 0.03, 0.03, "flower_white", segs=8, rings=5)
    return {"note": "se porte à deux (événement le_cafe_d_honneur)"}


@objet("event_carnet_vert", "neutre", "evenement", 250, nom="Carnet vert de la critique")
def o_carnet(g):
    g.box(-0.07, 0.07, -0.1, 0.1, 0, 0.018, "book_green", bevel=0.003)
    g.box(-0.066, 0.068, -0.097, 0.097, 0.002, 0.016, "paper", bevel=0)
    g.box(0.045, 0.055, -0.101, 0.101, 0.0, 0.019, "ink", bevel=0)
    return {}


@objet("event_valise_octave", "neutre", "evenement", 250, accroche="sol", nom="Valise à roulettes d'Octave")
def o_valise(g):
    g.box(-0.2, 0.2, -0.12, 0.12, 0.05, 0.6, "presses_coat", bevel=0.02)
    for x in (-0.15, 0.15):
        g.rod((x - 0.012, -0.08, 0.025), (x + 0.012, -0.08, 0.025), 0.025, 8, "rubber")
    g.rod((-0.08, -0.1, 0.6), (-0.08, -0.1, 0.95), 0.008, 5, "steel_dark")
    g.rod((0.08, -0.1, 0.6), (0.08, -0.1, 0.95), 0.008, 5, "steel_dark")
    g.rod((-0.08, -0.1, 0.95), (0.08, -0.1, 0.95), 0.012, 6, "ink")
    return {}


@objet("event_gourde", "neutre", "evenement", 250, nom="Gourde de randonneur (les Godillots)")
def o_gourde(g):
    g.lathe(0, 0, 0, [(0.035, 0), (0.04, 0.01), (0.04, 0.17), (0.03, 0.2), (0.016, 0.21), (0.016, 0.225)], 10, "promeneurs_forest", cap_bottom=True, cap_top=False)
    g.cyl(0, 0, 0.22, 0.24, 0.019, 10, "steel_dark")
    return {"sockets": [sk("bouchon", 0.0, 0.0, 0.24)], "note": "à remplir à l'évier (événement les_godillots)"}


@objet("event_boite_outils", "neutre", "evenement", 600, accroche="sol", nom="Boîte à outils de la réserve")
def o_boite_outils(g):
    g.box(-0.22, 0.22, -0.1, 0.1, 0, 0.16, "lacquer_red", bevel=0.008)
    g.box(-0.23, 0.23, -0.11, 0.11, 0.16, 0.19, "lacquer_red", bevel=0.008)
    g.rod((-0.12, 0, 0.19), (-0.12, 0, 0.25), 0.008, 6, "steel_dark")
    g.rod((0.12, 0, 0.19), (0.12, 0, 0.25), 0.008, 6, "steel_dark")
    g.rod((-0.12, 0, 0.25), (0.12, 0, 0.25), 0.012, 8, "ink")
    for x in (-0.18, 0.18):
        g.box(x - 0.02, x + 0.02, 0.1, 0.112, 0.13, 0.17, "steel", bevel=0.002)
    return {"note": "le joint neuf est dedans (événement la_vieille_dame_tousse)"}


@objet("event_table_treteaux", "neutre", "evenement", 600, accroche="sol", nom="Table à tréteaux de la mairie")
def o_treteaux(g):
    w, d, h = 1.8, 0.7, 0.75
    for x in (-w / 2 + 0.2, w / 2 - 0.2):
        for s in (-1, 1):
            g.rod((x, s * 0.3, 0), (x, s * 0.08, h - 0.03), 0.02, 6, "campagne_oak")
        g.box(x - 0.03, x + 0.03, -0.12, 0.12, h - 0.05, h - 0.03, "campagne_oak", bevel=0.004)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.03, h, "t:oak_campagne", bevel=0.006)
    return {"top": {"z": h, "forme": "rect", "w": w, "d": d}, "places": 4, "note": "fête du Tilleul sans terrasse (4 places dehors)"}


@objet("event_balai", "neutre", "evenement", 250, accroche="sol", nom="Balai")
def o_balai(g):
    g.rod((0, 0, 0.12), (0, 0, 1.4), 0.013, 6, "campagne_oak")
    g.box(-0.16, 0.16, -0.025, 0.025, 0.06, 0.12, "campagne_oak", bevel=0.006)
    g.box(-0.15, 0.15, -0.02, 0.02, 0.0, 0.06, "campagne_straw", bevel=0.004)
    return {"note": "rangé debout dans la réserve; tenu à deux mains pour « sol balayé » (l_inspection)"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--seulement", default="")
    ap.add_argument("--sans-ao", action="store_true")
    a = ap.parse_args(argv)
    import catalogue as CAT
    K.construire_atlas()
    ids = [i for i in a.seulement.split(",") if i] or list(CATALOGUE)
    CAT.produire(CATALOGUE, ids, os.path.join(ICI, "fiches", "objets.json"), ao=not a.sans_ao)


if __name__ == "__main__":
    main()
