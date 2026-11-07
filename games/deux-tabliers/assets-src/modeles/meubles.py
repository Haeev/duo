"""Meubles et décorations déplaçables de Deux Tabliers (démo v0.1), un GLB par identifiant du catalogue.

Usage: duo-python games/deux-tabliers/assets-src/modeles/meubles.py [-- --seulement id1,id2] [--sans-ao]

Chaque fonction `m_<id>` construit le modèle autour de l'origine (repère du plan: x est, y sud, z haut), avant
vers le sud (+Z glTF), pivot au centre de l'emprise au sol (au dos et en bas du milieu pour les objets muraux,
au point d'accroche pour les suspensions), et rend sa fiche: style, catégorie, accroche, assises, dessus, douilles.
Sorties: assets/modeles/<id>.glb et la partie « meubles » de assets/modeles/modeles.json (via fiches/meubles.json).
"""

import argparse
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

ICI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ICI, "lib"))
import commun as K  # noqa: E402
from geo import Geo  # noqa: E402
import geo as G  # noqa: E402

pans = G.pans
OAK, BWOOD, ASH, WAL = "t:oak_campagne", "t:wood_bistrot", "t:ash_nordique", "t:walnut"
STRAW, LINEN, MOLE, WOOL, MARBLE = "t:straw", "t:linen", "t:moleskine", "t:wool", "t:marble"

CATALOGUE = {}


def meuble(ident, style, categorie, budget, accroche="sol", nom=""):
    def deco(fn):
        CATALOGUE[ident] = dict(fn=fn, style=style, categorie=categorie, budget=budget, accroche=accroche, nom=nom)
        return fn
    return deco


def seat(x, y, z, avant=(0, 1)):
    """Assise: point au milieu du dessus de l'assise, direction du regard (plan: (0, 1) = sud = +Z glTF)."""
    return {"x": x, "y": y, "z": z, "avant": avant}


# ------------------------------------------------------------------------------------------------
# Campagne


@meuble("furn_chair_campagne", "campagne", "chaise", 600, nom="Chaise paillée")
def m_chair_campagne(g):
    """Chaise paillée de Meshy (essai de style, conformée: 594 triangles), pieds tournés en chêne miel."""
    p = os.path.join(K.RACINE, "docs/jeux/cosy-cafe/essai-style/meshy/furn_chair_campagne_B.json")
    d = json.load(open(p))
    bm = g.bm
    vs = [bm.verts.new(K.P(x, y, z)) for x, y, z in d["verts"]]
    for (a, b, c), k in zip(d["faces"], d["keys"]):
        try:
            f = bm.faces.new((vs[a], vs[b], vs[c]))
        except ValueError:
            continue
        f.material_index = g.mi(STRAW if k == "straw" else OAK)
    zmin = min(v.co.z for v in vs)
    for v in vs:
        v.co.z -= zmin
    return {"seats": [seat(0, 0.02, 0.45)], "meshy": "essai-style (furn_chair_campagne, tâche 01a1b7c5-0d20-7475-93dd-5a36ff5456fe)"}


@meuble("furn_stool_campagne", "campagne", "tabouret", 600, nom="Tabouret paillé")
def m_stool_campagne(g):
    s, leg, h = 0.36, 0.035, 0.45
    for x in (-s / 2, s / 2 - leg):
        for y in (-s / 2, s / 2 - leg):
            g.box(x, x + leg, y, y + leg, 0, h - 0.04, OAK, edges="nobottom")
    for z in (0.14, 0.24):
        g.box(-s / 2 + 0.01, s / 2 - 0.01, -s / 2 + leg / 2 - 0.009, -s / 2 + leg / 2 + 0.009, z, z + 0.018, OAK)
        g.box(-s / 2 + 0.01, s / 2 - 0.01, s / 2 - leg / 2 - 0.009, s / 2 - leg / 2 + 0.009, z, z + 0.018, OAK)
        g.box(-s / 2 + leg / 2 - 0.009, -s / 2 + leg / 2 + 0.009, -s / 2 + 0.01, s / 2 - 0.01, z + 0.06, z + 0.078, OAK)
        g.box(s / 2 - leg / 2 - 0.009, s / 2 - leg / 2 + 0.009, -s / 2 + 0.01, s / 2 - 0.01, z + 0.06, z + 0.078, OAK)
    g.box(-s / 2, s / 2, -s / 2, s / 2, h - 0.045, h - 0.015, OAK, bevel=0.008)
    g.box(-s / 2 + 0.02, s / 2 - 0.02, -s / 2 + 0.02, s / 2 - 0.02, h - 0.02, h + 0.004, STRAW, bevel=0.008)
    return {"seats": [seat(0, 0, h)]}


def table_carree(g, w, d, top_key, leg_key, h=0.75, leg=0.05, tz=0.04):
    for x in (-w / 2 + 0.04, w / 2 - 0.04 - leg):
        for y in (-d / 2 + 0.04, d / 2 - 0.04 - leg):
            g.box(x, x + leg, y, y + leg, 0, h - tz, leg_key, edges="vertical")
    g.box(-w / 2 + 0.06, w / 2 - 0.06, -d / 2 + 0.05, -d / 2 + 0.07, h - tz - 0.1, h - tz, leg_key)
    g.box(-w / 2 + 0.06, w / 2 - 0.06, d / 2 - 0.07, d / 2 - 0.05, h - tz - 0.1, h - tz, leg_key)
    g.box(-w / 2 + 0.05, -w / 2 + 0.07, -d / 2 + 0.06, d / 2 - 0.06, h - tz - 0.1, h - tz, leg_key)
    g.box(w / 2 - 0.07, w / 2 - 0.05, -d / 2 + 0.06, d / 2 - 0.06, h - tz - 0.1, h - tz, leg_key)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - tz, h, top_key, bevel=0.006)


def top(w, d, h, forme="rect"):
    return {"z": h, "forme": forme, "w": w, "d": d}


@meuble("furn_table_campagne_2", "campagne", "table", 600, nom="Petite table de ferme (2 places)")
def m_table_campagne_2(g):
    table_carree(g, 0.7, 0.7, OAK, OAK)
    return {"top": top(0.7, 0.7, 0.75), "places": 2}


@meuble("furn_table_campagne_4", "campagne", "table", 600, nom="Table de ferme (4 places)")
def m_table_campagne_4(g):
    table_carree(g, 1.3, 0.8, OAK, OAK, leg=0.065)
    return {"top": top(1.3, 0.8, 0.75), "places": 4}


@meuble("furn_bench_campagne", "campagne", "banc", 1200, nom="Banc de ferme")
def m_bench_campagne(g):
    w, d, h = 1.2, 0.34, 0.45
    for x in (-w / 2 + 0.1, w / 2 - 0.15):
        g.box(x, x + 0.05, -d / 2 + 0.03, d / 2 - 0.03, 0, h - 0.04, OAK)
        g.box(x - 0.01, x + 0.06, -d / 2 + 0.02, d / 2 - 0.02, 0, 0.05, OAK)
    g.box(-w / 2 + 0.15, w / 2 - 0.15, -0.025, 0.025, 0.12, 0.17, OAK)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.045, h, OAK, bevel=0.008)
    return {"seats": [seat(-0.3, 0, h), seat(0.3, 0, h)]}


@meuble("furn_armchair_campagne", "campagne", "fauteuil", 1200, nom="Bergère de lin")
def m_armchair_campagne(g):
    w, d = 0.72, 0.7
    for (x, y) in ((-w / 2 + 0.03, -d / 2 + 0.03), (w / 2 - 0.03, -d / 2 + 0.03), (-w / 2 + 0.03, d / 2 - 0.05), (w / 2 - 0.03, d / 2 - 0.05)):
        g.cyl(x, y, 0, 0.2, 0.022, pans(8), OAK, r_top=0.026)
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.2, 0.3, OAK, bevel=0.012)
    # assise (coussin bombé), dossier et accotoirs rembourrés
    g.box(-w / 2 + 0.09, w / 2 - 0.09, -d / 2 + 0.16, d / 2 - 0.02, 0.3, 0.43, LINEN, bevel=0.035, segs=3)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, -d / 2, -d / 2 + 0.16, 0.3, 0.92, LINEN, bevel=0.04, segs=3)
    for s in (-1, 1):
        x0 = s * (w / 2 - 0.1)
        g.box(min(x0, s * w / 2), max(x0, s * w / 2), -d / 2 + 0.1, d / 2 - 0.02, 0.3, 0.62, LINEN, bevel=0.035, segs=3)
        g.box(min(x0, s * w / 2) - 0.005, max(x0, s * w / 2) + 0.005, -d / 2 + 0.1, d / 2 - 0.0, 0.6, 0.64, OAK, bevel=0.012)
    return {"seats": [seat(0, 0.06, 0.43)]}


def suspension(g, prof, key, h_cord=1.0, inner=True):
    """Suspension accrochée au plafond (origine = point d'accroche, au plafond): abat-jour en bas du cordon."""
    zb = -h_cord - prof[-1][1]
    g.lathe(0, 0, zb, prof, pans(14), key, cap_bottom=False, cap_top=True)
    if inner:
        inn = [(r - 0.006, dz + 0.004) for r, dz in prof]
        vs = g.lathe(0, 0, zb, inn, pans(14), "glow", cap_bottom=False, cap_top=False)
        for f in {f for v in vs for f in v.link_faces}:
            f.normal_flip()
        g.sphere(0, 0, zb + 0.05, 0.035, 0.035, 0.045, "glow", segs=10, rings=6)
    g.rod((0, 0, zb + prof[-1][1]), (0, 0, -0.02), 0.005, 6, "ink")
    g.cyl(0, 0, -0.02, 0.0, 0.045, pans(10), key, bevel=0.004)
    return zb


@meuble("furn_pendant_campagne", "campagne", "luminaire", 600, accroche="plafond", nom="Suspension en terre cuite")
def m_pendant_campagne(g):
    zb = suspension(g, [(0.14, 0), (0.13, 0.03), (0.09, 0.13), (0.04, 0.17), (0.02, 0.19)], "t:terracotta", h_cord=0.5)
    return {"lumiere": {"z": zb + 0.06}, "note": "cordon de 0,50 m: bas de l'abat-jour à 2,11 m sous un plafond de 2,80 m"}


@meuble("furn_shelf_campagne", "campagne", "etagere", 1000, accroche="mur", nom="Vaisselier mural sauge")
def m_shelf_campagne(g):
    """Étagère murale à deux tablettes et barre à assiettes, peinte en sauge; origine au dos, en bas, au milieu."""
    w, d, h = 1.0, 0.24, 0.8
    for x in (-w / 2, w / 2 - 0.025):
        g.box(x, x + 0.025, -0.0, d, 0, h, "sage_paint", bevel=0.005)
    g.box(-w / 2, w / 2, 0, 0.012, 0.02, h, "sage_paint", bevel=0)
    for z in (0.02, 0.38, h - 0.025):
        g.box(-w / 2 + 0.025, w / 2 - 0.025, 0.012, d, z, z + 0.025, "sage_paint", bevel=0.005)
    g.rod((-w / 2 + 0.025, d - 0.03, 0.12), (w / 2 - 0.025, d - 0.03, 0.12), 0.006, 6, "brass")
    return {"surfaces": [{"z": 0.045, "w": 0.95, "d": 0.2, "y": 0.13}, {"z": 0.405, "w": 0.95, "d": 0.2, "y": 0.13}, {"z": h, "w": 1.0, "d": 0.23, "y": 0.12}]}


# ------------------------------------------------------------------------------------------------
# Bistrot

def bentwood_leg(g, x, y, z_top, splay, key):
    g.rod((x + splay[0], y + splay[1], 0.0), (x, y, z_top), 0.016, pans(6), key)


@meuble("furn_chair_bistrot", "bistrot", "chaise", 600, nom="Chaise cintrée")
def m_chair_bistrot(g):
    h = 0.45
    r = 0.2
    # pieds avant, légèrement écartés
    for s in (-1, 1):
        bentwood_leg(g, s * 0.14, 0.12, h - 0.03, (s * 0.03, 0.03), BWOOD)
    # pieds arrière qui montent en un seul cintre jusqu'au dossier
    for s in (-1, 1):
        pts = [(s * 0.15, -0.2, 0.0), (s * 0.135, -0.15, h - 0.03), (s * 0.15, -0.19, 0.62), (s * 0.17, -0.22, 0.8)]
        for a, b in zip(pts, pts[1:]):
            g.rod(a, b, 0.016, pans(6), BWOOD)
            g.sphere(*b, 0.016, 0.016, 0.016, BWOOD, segs=pans(6), rings=4)
    # boucle du dossier (arc) entre les deux montants
    n = 9
    prev = None
    for i in range(n + 1):
        t = math.pi * i / n
        p = (-0.17 * math.cos(t), -0.22 - 0.03 * math.sin(t), 0.8 + 0.08 * math.sin(t))
        if prev:
            g.rod(prev, p, 0.014, pans(6), BWOOD)
        prev = p
    # deux barreaux en S du dossier
    for s in (-1, 1):
        g.rod((s * 0.05, -0.16, h + 0.02), (s * 0.07, -0.205, 0.86), 0.01, pans(6), BWOOD)
    # cercle sous l'assise et cercle d'entrejambe
    for (z, rr) in ((h - 0.06, r - 0.01), (0.2, 0.17)):
        prev = None
        for i in range(17):
            a = 2 * math.pi * i / 16
            p = (rr * math.cos(a), 0.0 + rr * math.sin(a) * 0.95, z)
            if prev:
                g.rod(prev, p, 0.011, pans(6), BWOOD)
            prev = p
    g.cyl(0, 0, h - 0.035, h, r, pans(16), BWOOD, bevel=0.008)
    return {"seats": [seat(0, 0.02, h)]}


@meuble("furn_stool_bistrot_high", "bistrot", "tabouret", 600, nom="Tabouret haut de comptoir")
def m_stool_bistrot(g):
    h = 0.75
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        g.rod((0.2 * math.cos(a), 0.2 * math.sin(a), 0), (0.13 * math.cos(a), 0.13 * math.sin(a), h - 0.06), 0.013, pans(6), "brass")
    g.lathe(0, 0, 0.27, [(0.175, 0), (0.175, 0.02)], pans(16), "brass", cap_bottom=False, cap_top=False)
    g.lathe(0, 0, 0.27, [(0.165, 0.02), (0.165, 0)], pans(16), "brass", cap_bottom=False, cap_top=False)
    g.cyl(0, 0, h - 0.07, h - 0.05, 0.16, pans(16), BWOOD, bevel=0.005)
    g.lathe(0, 0, h - 0.05, [(0.17, 0), (0.178, 0.02), (0.165, 0.055), (0.0, 0.065)], pans(16), MOLE, cap_bottom=True, cap_top=False)
    return {"seats": [seat(0, 0, h + 0.01)], "note": "assise à 0,76 m: pour le comptoir de 1,10 m"}


@meuble("furn_gueridon_bistrot", "bistrot", "table", 600, nom="Guéridon de marbre")
def m_gueridon(g):
    g.lathe(0, 0, 0, [(0.23, 0), (0.23, 0.015), (0.16, 0.04), (0.05, 0.07), (0.03, 0.09)], pans(16), "iron", cap_bottom=False, cap_top=True)
    g.cyl(0, 0, 0.08, 0.68, 0.025, pans(8), "iron")
    g.lathe(0, 0, 0.6, [(0.03, 0), (0.06, 0.06), (0.09, 0.08)], pans(12), "iron", cap_bottom=True, cap_top=True)
    g.cyl(0, 0, 0.71, 0.75, 0.3, pans(20), MARBLE, bevel=0.006)
    g.cyl(0, 0, 0.705, 0.715, 0.305, pans(20), "brass")
    return {"top": top(0.6, 0.6, 0.75, "rond"), "places": 2}


@meuble("furn_table_bistrot_4", "bistrot", "table", 600, nom="Table de bistrot (4 places)")
def m_table_bistrot_4(g):
    w, d, h = 1.2, 0.7, 0.75
    for x in (-w / 2 + 0.12, w / 2 - 0.12):
        g.box(x - 0.025, x + 0.025, -d / 2 + 0.1, d / 2 - 0.1, 0.03, h - 0.06, "iron", bevel=0.006, edges="vertical")
        g.box(x - 0.03, x + 0.03, -d / 2 + 0.06, d / 2 - 0.06, 0, 0.03, "iron", bevel=0.006)
    g.box(-w / 2 + 0.12, w / 2 - 0.12, -0.02, 0.02, 0.12, 0.16, "iron", bevel=0.005)
    g.box(-w / 2 + 0.05, w / 2 - 0.05, -d / 2 + 0.05, d / 2 - 0.05, h - 0.06, h - 0.035, "iron", bevel=0.004)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.035, h, BWOOD, bevel=0.008)
    return {"top": top(w, d, h), "places": 4}


@meuble("furn_banquette_bistrot", "bistrot", "banquette", 1200, nom="Banquette capitonnée")
def m_banquette(g):
    w, d = 1.4, 0.6
    g.box(-w / 2, w / 2, -d / 2, d / 2 - 0.04, 0, 0.12, BWOOD, bevel=0.01)
    g.box(-w / 2, w / 2, -d / 2 + 0.17, d / 2, 0.12, 0.45, MOLE, bevel=0.03, segs=2)
    g.box(-w / 2, w / 2, -d / 2, -d / 2 + 0.17, 0.12, 1.0, MOLE, bevel=0.035, segs=2)
    g.box(-w / 2 - 0.01, w / 2 + 0.01, -d / 2 - 0.01, -d / 2 + 0.18, 1.0, 1.03, BWOOD, bevel=0.008)
    # capitons: boutons en losanges sur le dossier
    for j, z in enumerate((0.58, 0.72, 0.86)):
        n = 7 if j % 2 == 0 else 6
        for i in range(n):
            x = -w / 2 + 0.13 + (i + (0.5 if j % 2 else 0)) * (w - 0.26) / 6
            g.sphere(x, -d / 2 + 0.17, z, 0.012, 0.008, 0.012, "bistrot_moleskine", segs=6, rings=4)
    for s in (-1, 1):
        g.box(s * w / 2 - (0.03 if s > 0 else 0), s * w / 2 + (0.0 if s > 0 else 0.03), -d / 2, d / 2, 0.12, 0.62, BWOOD, bevel=0.008)
    return {"seats": [seat(-0.35, 0.06, 0.45), seat(0.35, 0.06, 0.45)], "note": "dos au mur (dossier au nord)"}


@meuble("furn_mange_debout_bistrot", "bistrot", "table", 600, nom="Mange-debout de zinc")
def m_mange_debout(g):
    h = 1.1
    g.lathe(0, 0, 0, [(0.25, 0), (0.25, 0.015), (0.17, 0.045), (0.05, 0.08), (0.03, 0.1)], pans(16), "iron", cap_bottom=False, cap_top=True)
    g.cyl(0, 0, 0.09, h - 0.04, 0.03, pans(8), "iron")
    g.lathe(0, 0, 0.3, [(0.2, 0), (0.2, 0.012)], pans(16), "brass", cap_bottom=False, cap_top=False)
    for i in range(4):
        a = i * math.pi / 2
        g.rod((0.03 * math.cos(a), 0.03 * math.sin(a), 0.306), (0.2 * math.cos(a), 0.2 * math.sin(a), 0.306), 0.008, 6, "brass")
    g.lathe(0, 0, h - 0.1, [(0.03, 0), (0.08, 0.07), (0.1, 0.08)], pans(12), "iron", cap_bottom=True, cap_top=True)
    g.cyl(0, 0, h - 0.04, h, 0.3, pans(20), "t:zinc", bevel=0.008)
    return {"top": top(0.6, 0.6, h, "rond"), "places": 2, "note": "debout: repose-pieds de laiton à 0,30 m"}


@meuble("furn_pendant_bistrot", "bistrot", "luminaire", 600, accroche="plafond", nom="Globe opalin")
def m_pendant_bistrot(g):
    zb = -0.68
    g.sphere(0, 0, zb + 0.12, 0.13, 0.13, 0.13, "glow", segs=pans(10), rings=8)
    g.cyl(0, 0, zb + 0.235, zb + 0.29, 0.05, pans(10), "brass", bevel=0.006, r_top=0.035)
    g.rod((0, 0, zb + 0.29), (0, 0, -0.02), 0.006, 6, "brass")
    g.cyl(0, 0, -0.02, 0.0, 0.05, pans(10), "brass", bevel=0.004)
    return {"lumiere": {"z": zb + 0.12}, "note": "bas du globe à 2,12 m sous un plafond de 2,80 m"}


@meuble("deco_mirror_bistrot", "bistrot", "miroir", 150, accroche="mur", nom="Grand miroir peint")
def m_mirror(g):
    """Miroir sans reflet calculé (C11): tain gris-vert et deux bandes claires peintes en biais."""
    w, h = 0.9, 1.2
    g.box(-w / 2, w / 2, 0, 0.035, 0, h, BWOOD, bevel=0.008)
    g.box(-w / 2 + 0.07, w / 2 - 0.07, 0.035, 0.04, 0.07, h - 0.07, "brass", bevel=0)
    g.quad([(-w / 2 + 0.08, 0.042, 0.08), (w / 2 - 0.08, 0.042, 0.08), (w / 2 - 0.08, 0.042, h - 0.08), (-w / 2 + 0.08, 0.042, h - 0.08)], "pq_mirror", normal_hint=(0, 1, 0))
    for (x0, dx) in ((-0.2, 0.12), (0.02, 0.05)):
        z0, z1 = 0.15, h - 0.15
        sl = 0.35
        g.quad([(x0, 0.043, z0), (x0 + dx, 0.043, z0), (x0 + dx + sl, 0.043, z1), (x0 + sl, 0.043, z1)], "top_light_cream", normal_hint=(0, 1, 0))
    return {"note": "accroché à 0,90 m du sol au bas du cadre (au-dessus du dossier de la banquette, 1,03 m)"}


# ------------------------------------------------------------------------------------------------
# Nordique

@meuble("furn_chair_nordique", "nordique", "chaise", 600, nom="Chaise de frêne")
def m_chair_nordique(g):
    h = 0.45
    for (x, y, back) in ((-0.19, 0.17, False), (0.19, 0.17, False), (-0.18, -0.17, True), (0.18, -0.17, True)):
        g.cyl(x, y, 0, h - 0.03, 0.017, pans(8), ASH, r_top=0.021)
        if back:
            g.rod((x, y, h - 0.03), (x * 1.05, y - 0.04, 0.78), 0.016, pans(8), ASH)
    g.box(-0.22, 0.22, -0.21, 0.21, h - 0.035, h, ASH, bevel=0.012)
    # dossier courbe: planche cintrée en cinq pans
    n = 6
    for i in range(n):
        a0, a1 = -0.6 + 1.2 * i / n, -0.6 + 1.2 * (i + 1) / n
        x0, x1 = 0.36 * math.sin(a0), 0.36 * math.sin(a1)
        y0, y1 = -0.21 - 0.06 * math.cos(a0) + 0.06, -0.21 - 0.06 * math.cos(a1) + 0.06
        g.quad([(x0, y0, 0.66), (x1, y1, 0.66), (x1, y1, 0.8), (x0, y0, 0.8)], ASH, normal_hint=(0, 1, 0))
        g.quad([(x0, y0 - 0.02, 0.66), (x0, y0 - 0.02, 0.8), (x1, y1 - 0.02, 0.8), (x1, y1 - 0.02, 0.66)], ASH, normal_hint=(0, -1, 0))
        g.quad([(x0, y0, 0.8), (x1, y1, 0.8), (x1, y1 - 0.02, 0.8), (x0, y0 - 0.02, 0.8)], ASH, normal_hint=(0, 0, 1))
        g.quad([(x0, y0, 0.66), (x0, y0 - 0.02, 0.66), (x1, y1 - 0.02, 0.66), (x1, y1, 0.66)], ASH, normal_hint=(0, 0, -1))
    for s in (-1, 1):
        x, y = 0.36 * math.sin(s * 0.6), -0.21 - 0.06 * math.cos(0.6) + 0.06
        g.quad([(x, y, 0.66), (x, y - 0.02, 0.66), (x, y - 0.02, 0.8), (x, y, 0.8)], ASH, normal_hint=(s, 0, 0))
    return {"seats": [seat(0, 0.02, h)]}


@meuble("furn_stool_nordique", "nordique", "tabouret", 600, nom="Tabouret à trois pieds")
def m_stool_nordique(g):
    h = 0.46
    for i in range(3):
        a = math.pi / 2 + i * 2 * math.pi / 3
        g.rod((0.17 * math.cos(a), 0.17 * math.sin(a), 0), (0.1 * math.cos(a), 0.1 * math.sin(a), h - 0.03), 0.017, pans(8), ASH)
    g.cyl(0, 0, h - 0.035, h, 0.17, pans(16), ASH, bevel=0.01)
    g.cyl(0, 0, h, h + 0.02, 0.15, pans(16), WOOL, bevel=0.008)
    return {"seats": [seat(0, 0, h + 0.02)]}


@meuble("furn_table_nordique_2", "nordique", "table", 600, nom="Table ronde au linoléum")
def m_table_nordique_2(g):
    h = 0.75
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        g.rod((0.3 * math.cos(a), 0.3 * math.sin(a), 0), (0.2 * math.cos(a), 0.2 * math.sin(a), h - 0.035), 0.02, pans(8), ASH)
    g.cyl(0, 0, h - 0.07, h - 0.035, 0.22, pans(16), ASH, bevel=0.006)
    g.cyl(0, 0, h - 0.035, h - 0.004, 0.35, pans(20), ASH, bevel=0.006)
    g.cyl(0, 0, h - 0.004, h, 0.34, pans(20), "nordique_fir")
    return {"top": top(0.7, 0.7, h, "rond"), "places": 2}


@meuble("furn_table_nordique_4", "nordique", "table", 600, nom="Grande table de frêne")
def m_table_nordique_4(g):
    w, d, h = 1.3, 0.8, 0.75
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.rod((sx * (w / 2 - 0.06), sy * (d / 2 - 0.06), 0), (sx * (w / 2 - 0.12), sy * (d / 2 - 0.12), h - 0.035), 0.022, pans(8), ASH)
    g.box(-w / 2 + 0.1, w / 2 - 0.1, -d / 2 + 0.1, d / 2 - 0.1, h - 0.1, h - 0.035, ASH, bevel=0.006)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.035, h, ASH, bevel=0.01)
    return {"top": top(w, d, h), "places": 4}


@meuble("furn_bench_nordique", "nordique", "banc", 1200, nom="Banc à coussins et plaid")
def m_bench_nordique(g):
    w, d, h = 1.3, 0.4, 0.42
    for x in (-w / 2 + 0.08, w / 2 - 0.12):
        for y in (-d / 2 + 0.05, d / 2 - 0.09):
            g.box(x, x + 0.04, y, y + 0.04, 0, h - 0.04, ASH, edges="vertical")
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.04, h, ASH, bevel=0.008)
    for x0 in (-w / 2 + 0.03, 0.01):
        g.box(x0, x0 + w / 2 - 0.05, -d / 2 + 0.03, d / 2 - 0.03, h, h + 0.06, WOOL, bevel=0.025, segs=2)
    # plaid plié sur un bout
    g.box(w / 2 - 0.3, w / 2 - 0.05, -d / 2 - 0.005, d / 2 + 0.005, h + 0.06, h + 0.09, "nordique_rose", bevel=0.012)
    g.box(w / 2 - 0.3, w / 2 - 0.05, d / 2 - 0.02, d / 2 + 0.005, h - 0.12, h + 0.09, "nordique_rose", bevel=0.01)
    return {"seats": [seat(-0.32, 0, h + 0.06), seat(0.25, 0, h + 0.06)], "note": "plaid replié sur le bout est"}


@meuble("furn_armchair_nordique", "nordique", "fauteuil", 1200, nom="Fauteuil de laine")
def m_armchair_nordique(g):
    w, d = 0.7, 0.72
    for (x, y) in ((-w / 2 + 0.06, d / 2 - 0.08), (w / 2 - 0.06, d / 2 - 0.08), (-w / 2 + 0.06, -d / 2 + 0.08), (w / 2 - 0.06, -d / 2 + 0.08)):
        g.rod((x * 1.05, y * 1.05, 0), (x, y, 0.22), 0.018, pans(8), ASH)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, -d / 2 + 0.02, d / 2 - 0.02, 0.22, 0.3, ASH, bevel=0.012)
    g.box(-w / 2 + 0.06, w / 2 - 0.06, -d / 2 + 0.12, d / 2 - 0.03, 0.3, 0.42, WOOL, bevel=0.04, segs=3)
    # coque enveloppante: dossier incliné et joues
    vs = g.box(-w / 2 + 0.02, w / 2 - 0.02, -0.06, 0.06, 0.3, 0.9, WOOL, bevel=0.045, segs=3)
    Geo.transform(vs, __import__("mathutils").Matrix.Translation(K.P(0, -d / 2 + 0.1, 0.3)) @ __import__("mathutils").Matrix.Rotation(math.radians(-12), 4, "X") @ __import__("mathutils").Matrix.Translation(K.P(0, 0, -0.3)))
    for s in (-1, 1):
        g.box(s * (w / 2 - 0.09) - 0.045 * (1 - s), s * (w / 2 - 0.09) + 0.045 * (1 + s), -d / 2 + 0.08, d / 2 - 0.08, 0.3, 0.6, WOOL, bevel=0.04, segs=3)
    return {"seats": [seat(0, 0.08, 0.42)]}


@meuble("furn_pendant_nordique", "nordique", "luminaire", 600, accroche="plafond", nom="Suspension à lamelles")
def m_pendant_nordique(g):
    zb = -0.7
    rings = [(0.2, 0.0), (0.21, 0.04), (0.19, 0.08), (0.15, 0.12), (0.1, 0.16), (0.05, 0.19)]
    for i, (r, dz) in enumerate(rings):
        g.lathe(0, 0, zb + dz, [(r, 0), (r + 0.02, 0.025)], pans(14), ASH, cap_bottom=False, cap_top=False)
        g.lathe(0, 0, zb + dz, [(r + 0.015, 0.025), (r - 0.005, 0.0)], pans(14), ASH, cap_bottom=False, cap_top=False)
    g.sphere(0, 0, zb + 0.08, 0.06, 0.06, 0.07, "glow", segs=10, rings=6)
    g.rod((0, 0, zb + 0.2), (0, 0, -0.02), 0.005, 6, "ink")
    g.cyl(0, 0, -0.02, 0.0, 0.045, pans(10), "nordique_white", bevel=0.004)
    return {"lumiere": {"z": zb + 0.08}}


@meuble("furn_shelf_nordique", "nordique", "etagere", 1000, accroche="mur", nom="Étagère murale de frêne")
def m_shelf_nordique(g):
    w = 0.9
    for z in (0.0, 0.32):
        g.box(-w / 2, w / 2, 0.0, 0.22, z, z + 0.025, ASH, bevel=0.006)
        for x in (-w / 2 + 0.12, w / 2 - 0.12):
            g.box(x - 0.012, x + 0.012, 0.0, 0.16, z - 0.12, z, "nordique_white", bevel=0.004)
    return {"surfaces": [{"z": 0.025, "w": 0.88, "d": 0.2, "y": 0.11}, {"z": 0.345, "w": 0.88, "d": 0.2, "y": 0.11}],
            "note": "origine au dos de la tablette basse; poser à 1,20 m environ"}
