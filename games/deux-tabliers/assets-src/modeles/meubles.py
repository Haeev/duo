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


@meuble("chaise_paillee", "campagne", "chaise", 600, nom="Chaise paillée")
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


@meuble("tabouret_bois", "campagne", "tabouret", 600, nom="Tabouret de bois")
def m_stool_campagne(g):
    """Tabouret de comptoir en chêne: assise ronde à 0,75 m, quatre pieds écartés, repose-pieds carré."""
    h = 0.75
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.rod((sx * 0.17, sy * 0.17, 0), (sx * 0.12, sy * 0.12, h - 0.035), 0.019, pans(8), OAK)
    zr = 0.28
    for (a, b) in (((-0.155, -0.155), (0.155, -0.155)), ((-0.155, 0.155), (0.155, 0.155)), ((-0.155, -0.155), (-0.155, 0.155)), ((0.155, -0.155), (0.155, 0.155))):
        g.rod((a[0], a[1], zr), (b[0], b[1], zr), 0.014, pans(6), OAK)
    g.cyl(0, 0, h - 0.04, h, 0.18, pans(16), OAK, bevel=0.01)
    return {"seats": [seat(0, 0, h)], "note": "assise de comptoir (0,75 m) pour la tablette de 1,10 m"}


def table_carree(g, w, d, top_key, leg_key, h=0.75, leg=0.05, tz=0.04):
    for x in (-w / 2 + 0.04, w / 2 - 0.04 - leg):
        for y in (-d / 2 + 0.04, d / 2 - 0.04 - leg):
            g.box(x, x + leg, y, y + leg, 0, h - tz, leg_key, edges="vertical")
    g.box(-w / 2 + 0.06, w / 2 - 0.06, -d / 2 + 0.05, -d / 2 + 0.07, h - tz - 0.1, h - tz, leg_key)  # ceinture
    g.box(-w / 2 + 0.06, w / 2 - 0.06, d / 2 - 0.07, d / 2 - 0.05, h - tz - 0.1, h - tz, leg_key)
    g.box(-w / 2 + 0.05, -w / 2 + 0.07, -d / 2 + 0.06, d / 2 - 0.06, h - tz - 0.1, h - tz, leg_key)
    g.box(w / 2 - 0.07, w / 2 - 0.05, -d / 2 + 0.06, d / 2 - 0.06, h - tz - 0.1, h - tz, leg_key)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - tz, h, top_key, bevel=0.006)


def top(w, d, h, forme="rect"):
    return {"z": h, "forme": forme, "w": w, "d": d}


@meuble("table_basse_malle", "campagne", "table", 600, nom="Table basse malle")
def m_table_campagne_2(g):
    """Vieille malle de voyage devenue table basse: bois, cornières et serrure de laiton, sangles de cuir."""
    w, d, h = 0.8, 0.45, 0.45
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.03, h - 0.06, OAK, bevel=0.01)
    g.box(-w / 2 - 0.005, w / 2 + 0.005, -d / 2 - 0.005, d / 2 + 0.005, h - 0.065, h, OAK, bevel=0.012)
    for x in (-w / 2 + 0.03, w / 2 - 0.08):
        for y in (-d / 2 + 0.03, d / 2 - 0.08):
            g.box(x, x + 0.05, y, y + 0.05, 0, 0.03, "bistrot_wood", bevel=0.005)
    for x in (-0.22, 0.22):
        g.box(x - 0.025, x + 0.025, -d / 2 - 0.012, d / 2 + 0.012, 0.03, h + 0.004, "t:leather", bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            g.box(sx * w / 2 - (0.04 if sx > 0 else -0.0) - (0 if sx > 0 else 0.008), sx * w / 2 + (0.008 if sx > 0 else 0.04), sy * d / 2 - (0.04 if sy > 0 else -0.0) - (0 if sy > 0 else 0.008), sy * d / 2 + (0.008 if sy > 0 else 0.04), h - 0.07, h + 0.003, "brass", bevel=0.003)
    g.box(-0.04, 0.04, d / 2, d / 2 + 0.012, h - 0.12, h - 0.05, "brass", bevel=0.004)
    return {"top": top(w, d, h), "places": 0, "note": "table basse des fauteuils"}


@meuble("table_ferme", "campagne", "table", 600, nom="Table de ferme")
def m_table_campagne_4(g):
    table_carree(g, 1.2, 0.7, OAK, OAK, leg=0.065)
    return {"top": top(1.2, 0.7, 0.75), "places": 4}


@meuble("banc_ferme", "campagne", "banc", 1200, nom="Banc de ferme")
def m_bench_campagne(g):
    w, d, h = 1.4, 0.42, 0.45
    for x in (-w / 2 + 0.1, w / 2 - 0.15):
        g.box(x, x + 0.05, -d / 2 + 0.03, d / 2 - 0.03, 0, h - 0.04, OAK)
        g.box(x - 0.01, x + 0.06, -d / 2 + 0.02, d / 2 - 0.02, 0, 0.05, OAK)
    g.box(-w / 2 + 0.15, w / 2 - 0.15, -0.025, 0.025, 0.12, 0.17, OAK)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.045, h, OAK, bevel=0.008)
    return {"seats": [seat(-0.35, 0, h), seat(0.35, 0, h)], "note": "sans dossier: on s'y assoit des deux côtés (avant déclaré au sud)"}


@meuble("fauteuil_crapaud", "campagne", "fauteuil", 1200, nom="Fauteuil crapaud")
def m_armchair_campagne(g):
    """Fauteuil crapaud: bas et rond, dossier enveloppant, tissu de lin, petits pieds de chêne."""
    w, d = 0.75, 0.75
    for (x, y) in ((-0.28, -0.28), (0.28, -0.28), (-0.28, 0.28), (0.28, 0.28)):
        g.cyl(x, y, 0, 0.14, 0.02, pans(8), OAK, r_top=0.026)
    g.lathe(0, 0.0, 0.14, [(0.34, 0), (0.37, 0.05), (0.37, 0.24), (0.33, 0.27), (0.0, 0.28)], pans(16), LINEN, cap_bottom=True, cap_top=False, sy=1.0)
    # dossier et accotoirs: boudin bombé le long d'un arc autour de l'assise (côté nord), plus haut au milieu du dos
    k = 8
    rings = []
    for i in range(k + 1):
        a = -0.35 + (math.pi + 0.7) * i / k  # de l'est (côté accotoir) au nord puis à l'ouest
        cx, cy = 0.3 * math.cos(a), -0.3 * math.sin(a)
        zt = 0.5 + 0.3 * max(0.0, math.sin(a)) ** 0.9
        rings.append((cx, cy, zt))
    for (a, b) in zip(rings, rings[1:]):
        # panneau du dossier entre deux montants (section ronde approchée par un caisson très arrondi)
        za, zb_ = a[2], b[2]
        g.quad([(a[0], a[1], 0.3), (b[0], b[1], 0.3), (b[0], b[1], zb_), (a[0], a[1], za)], LINEN, normal_hint=(-a[0], -a[1], 0))
        g.quad([(a[0] * 1.28, a[1] * 1.28, 0.3), (a[0] * 1.28, a[1] * 1.28, za - 0.04), (b[0] * 1.28, b[1] * 1.28, zb_ - 0.04), (b[0] * 1.28, b[1] * 1.28, 0.3)], LINEN, normal_hint=(a[0], a[1], 0))
        g.quad([(a[0], a[1], za), (b[0], b[1], zb_), (b[0] * 1.14, b[1] * 1.14, zb_ + 0.03), (a[0] * 1.14, a[1] * 1.14, za + 0.03)], LINEN, normal_hint=(-a[0], -a[1], 1))
        g.quad([(a[0] * 1.14, a[1] * 1.14, za + 0.03), (b[0] * 1.14, b[1] * 1.14, zb_ + 0.03), (b[0] * 1.28, b[1] * 1.28, zb_ - 0.04), (a[0] * 1.28, a[1] * 1.28, za - 0.04)], LINEN, normal_hint=(a[0], a[1], 1))
    for c, sgn in ((rings[0], 1), (rings[-1], -1)):
        g.quad([(c[0], c[1], 0.3), (c[0], c[1], c[2]), (c[0] * 1.14, c[1] * 1.14, c[2] + 0.03), (c[0] * 1.28, c[1] * 1.28, c[2] - 0.04), (c[0] * 1.28, c[1] * 1.28, 0.3)], LINEN, normal_hint=(0, sgn, 0))
    g.box(-0.22, 0.22, -0.18, 0.3, 0.4, 0.46, LINEN, bevel=0.03, segs=2)
    return {"seats": [seat(0, 0.06, 0.46)]}


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


@meuble("suspension_osier", "campagne", "luminaire", 600, accroche="plafond", nom="Suspension en osier")
def m_pendant_campagne(g):
    zb = suspension(g, [(0.225, 0), (0.22, 0.05), (0.18, 0.2), (0.1, 0.31), (0.03, 0.35)], STRAW, h_cord=0.35)
    return {"lumiere": {"z": zb + 0.08}, "note": "abat-jour de 0,45 x 0,35 m et cordon de 0,35 m: bas à 2,10 m sous un plafond de 2,80 m"}


@meuble("etagere_pots", "campagne", "etagere", 1000, accroche="mur", nom="Étagère à pots")
def m_shelf_campagne(g):
    """Étagère murale à deux tablettes et barre à assiettes, peinte en sauge; origine au dos, en bas, au milieu."""
    w, d, h = 1.0, 0.24, 0.9
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


@meuble("chaise_cintree", "bistrot", "chaise", 600, nom="Chaise cintrée")
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
            g.rod(a, b, 0.016, 6, BWOOD, cap=False)
    # boucle du dossier (arc) entre les deux montants
    n = 7
    prev = None
    for i in range(n + 1):
        t = math.pi * i / n
        p = (-0.17 * math.cos(t), -0.22 - 0.03 * math.sin(t), 0.8 + 0.08 * math.sin(t))
        if prev:
            g.rod(prev, p, 0.014, 6, BWOOD, cap=False)
        prev = p
    # deux barreaux en S du dossier
    for s in (-1, 1):
        g.rod((s * 0.05, -0.16, h + 0.02), (s * 0.07, -0.205, 0.86), 0.01, pans(6), BWOOD)
    # cercle sous l'assise et cercle d'entrejambe
    for (z, rr) in ((h - 0.06, r - 0.01), (0.2, 0.17)):
        prev = None
        for i in range(11):
            a = 2 * math.pi * i / 10
            p = (rr * math.cos(a), 0.0 + rr * math.sin(a) * 0.95, z)
            if prev:
                g.rod(prev, p, 0.011, 5, BWOOD, cap=False)
            prev = p
    g.cyl(0, 0, h - 0.035, h, r, pans(16), BWOOD, bevel=0.008)
    return {"seats": [seat(0, 0.02, h)]}


@meuble("tabourets_zinc", "bistrot", "tabouret", 600, nom="Tabouret de comptoir zinc (équipement, vendu par deux)")
def m_stool_bistrot(g):
    h = 0.75
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        g.rod((0.19 * math.cos(a), 0.2 * math.sin(a), 0), (0.13 * math.cos(a), 0.13 * math.sin(a), h - 0.06), 0.013, pans(6), "brass")
    g.lathe(0, 0, 0.27, [(0.175, 0), (0.175, 0.02)], pans(16), "brass", cap_bottom=False, cap_top=False)
    g.lathe(0, 0, 0.27, [(0.165, 0.02), (0.165, 0)], pans(16), "brass", cap_bottom=False, cap_top=False)
    g.cyl(0, 0, h - 0.06, h - 0.035, 0.16, pans(16), "iron", bevel=0.005)
    g.lathe(0, 0, h - 0.035, [(0.175, 0), (0.18, 0.015), (0.17, 0.035), (0.0, 0.04)], pans(16), "t:zinc", cap_bottom=True, cap_top=False)
    return {"seats": [seat(0, 0, h)], "note": "assise à 0,75 m: pour la tablette de 1,10 m. L'équipement en compte deux: poser deux exemplaires"}


@meuble("gueridon_marbre", "bistrot", "table", 600, nom="Guéridon de marbre")
def m_gueridon(g):
    g.lathe(0, 0, 0, [(0.23, 0), (0.23, 0.015), (0.16, 0.04), (0.05, 0.07), (0.03, 0.09)], pans(16), "iron", cap_bottom=False, cap_top=True)
    g.cyl(0, 0, 0.08, 0.68, 0.025, pans(8), "iron")
    g.lathe(0, 0, 0.6, [(0.03, 0), (0.06, 0.06), (0.09, 0.08)], pans(12), "iron", cap_bottom=True, cap_top=True)
    g.cyl(0, 0, 0.71, 0.75, 0.3, pans(20), MARBLE, bevel=0.006)
    g.cyl(0, 0, 0.705, 0.715, 0.305, pans(20), "brass")
    return {"top": top(0.6, 0.6, 0.75, "rond"), "places": 2}


@meuble("table_bistrot_quatre", "bistrot", "table", 600, nom="Table de bistrot pour quatre")
def m_table_bistrot_4(g):
    w, d, h = 0.8, 0.8, 0.75
    g.lathe(0, 0, 0, [(0.3, 0), (0.3, 0.015), (0.2, 0.045), (0.06, 0.08), (0.035, 0.1)], pans(16), "iron", cap_bottom=False, cap_top=True)
    g.cyl(0, 0, 0.09, h - 0.06, 0.03, pans(8), "iron")
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        g.rod((0, 0, h - 0.2), (0.3 * math.cos(a), 0.3 * math.sin(a), h - 0.045), 0.012, 6, "iron")
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.04, h, BWOOD, bevel=0.008)
    g.box(-w / 2 - 0.004, w / 2 + 0.004, -d / 2 - 0.004, d / 2 + 0.004, h - 0.045, h - 0.035, "brass", bevel=0.002)
    return {"top": top(w, d, h), "places": 4}


@meuble("banquette_moleskine", "bistrot", "banquette", 1200, nom="Banquette de moleskine")
def m_banquette(g):
    w, d = 1.8, 0.55
    g.box(-w / 2, w / 2, -d / 2, d / 2 - 0.04, 0, 0.12, BWOOD, bevel=0.01)
    g.box(-w / 2, w / 2, -d / 2 + 0.15, d / 2, 0.12, 0.45, MOLE, bevel=0.03, segs=2)
    g.box(-w / 2, w / 2, -d / 2, -d / 2 + 0.15, 0.12, 0.87, MOLE, bevel=0.035, segs=2)
    g.box(-w / 2 - 0.01, w / 2 + 0.01, -d / 2 - 0.01, -d / 2 + 0.16, 0.87, 0.9, BWOOD, bevel=0.008)
    # capitons: boutons en losanges sur le dossier
    for j, z in enumerate((0.56, 0.66, 0.76)):
        n = 9 if j % 2 == 0 else 8
        for i in range(n):
            x = -w / 2 + 0.13 + (i + (0.5 if j % 2 else 0)) * (w - 0.26) / 8
            yb = -d / 2 + 0.151
            g.quad([(x, yb, z - 0.014), (x + 0.012, yb, z), (x, yb, z + 0.014), (x - 0.012, yb, z)], "ink", normal_hint=(0, 1, 0))
    for s in (-1, 1):
        g.box(s * w / 2 - (0.03 if s > 0 else 0), s * w / 2 + (0.0 if s > 0 else 0.03), -d / 2, d / 2, 0.12, 0.62, BWOOD, bevel=0.008)
    return {"seats": [seat(-0.55, 0.06, 0.45), seat(0.0, 0.06, 0.45), seat(0.55, 0.06, 0.45)], "note": "dos au mur (dossier au nord)"}


@meuble("mange_debout_zinc", "bistrot", "table", 600, nom="Mange-debout de zinc (hors catalogue)")
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


@meuble("globe_opalin", "bistrot", "luminaire", 600, accroche="plafond", nom="Globe opalin")
def m_pendant_bistrot(g):
    zb = -0.45
    g.sphere(0, 0, zb + 0.15, 0.15, 0.15, 0.15, "glow", segs=pans(10), rings=8)
    g.cyl(0, 0, zb + 0.28, zb + 0.32, 0.05, pans(10), "brass", bevel=0.006, r_top=0.035)
    g.rod((0, 0, zb + 0.32), (0, 0, -0.02), 0.006, 6, "brass")
    g.cyl(0, 0, -0.02, 0.0, 0.05, pans(10), "brass", bevel=0.004)
    return {"lumiere": {"z": zb + 0.15}, "note": "bas du globe à 2,35 m sous un plafond de 2,80 m"}


@meuble("miroir_peint", "bistrot", "miroir", 150, accroche="mur", nom="Miroir peint")
def m_mirror(g):
    """Miroir sans reflet calculé (C11): tain gris-vert et deux bandes claires peintes en biais."""
    w, h = 1.2, 0.9
    g.box(-w / 2, w / 2, 0, 0.05, 0, h, BWOOD, bevel=0.008)
    g.box(-w / 2 + 0.07, w / 2 - 0.07, 0.05, 0.055, 0.07, h - 0.07, "brass", bevel=0)
    g.quad([(-w / 2 + 0.08, 0.057, 0.08), (w / 2 - 0.08, 0.057, 0.08), (w / 2 - 0.08, 0.057, h - 0.08), (-w / 2 + 0.08, 0.057, h - 0.08)], "pq_mirror", normal_hint=(0, 1, 0))
    for (x0, dx) in ((-0.3, 0.12), (-0.08, 0.05)):
        z0, z1 = 0.12, h - 0.12
        sl = 0.3
        g.quad([(x0, 0.058, z0), (x0 + dx, 0.058, z0), (x0 + dx + sl, 0.058, z1), (x0 + sl, 0.058, z1)], "top_light_cream", normal_hint=(0, 1, 0))
    return {"note": "reflet peint (C11). Bas du cadre conseillé à 1,00 m: au-dessus du dossier de la banquette (0,90 m)"}




# ------------------------------------------------------------------------------------------------
# Jardin

IRON = "jardin_iron"


@meuble("chaise_fer_peint", "jardin", "chaise", 600, nom="Chaise de fer peint")
def m_chaise_fer(g):
    """Chaise de jardin en fer plat peint vert sombre, assise à lattes, dossier à barreaux cintrés."""
    h = 0.45
    for s in (-1, 1):
        g.rod((s * 0.19, 0.2, 0), (s * 0.18, 0.17, h - 0.02), 0.012, pans(6), IRON)
        pts = [(s * 0.18, -0.22, 0), (s * 0.18, -0.17, h - 0.02), (s * 0.19, -0.21, 0.66), (s * 0.2, -0.25, 0.85)]
        for a, b in zip(pts, pts[1:]):
            g.rod(a, b, 0.012, 6, IRON, cap=False)
    for i in range(5):
        y = -0.16 + i * 0.085
        g.box(-0.2, 0.2, y - 0.03, y + 0.03, h - 0.02, h, IRON, bevel=0.004)
    for z in (0.62, 0.72, 0.82):
        y = -0.2 - (z - 0.62) * 0.2
        g.box(-0.19, 0.19, y - 0.008, y + 0.008, z, z + 0.05, IRON, bevel=0.004)
    g.rod((-0.18, 0.17, 0.15), (0.18, 0.17, 0.15), 0.008, 6, IRON)
    g.rod((-0.18, -0.19, 0.15), (0.18, -0.19, 0.15), 0.008, 6, IRON)
    return {"seats": [seat(0, 0.02, h)]}


@meuble("table_fer_mosaique", "jardin", "table", 600, nom="Table de fer à mosaïque")
def m_table_mosaique(g):
    h = 0.75
    for i in range(3):
        a = math.pi / 2 + i * 2 * math.pi / 3
        g.rod((0.27 * math.cos(a), 0.27 * math.sin(a), 0), (0.05 * math.cos(a), 0.05 * math.sin(a), 0.35), 0.012, 6, IRON)
        g.rod((0.05 * math.cos(a), 0.05 * math.sin(a), 0.35), (0.22 * math.cos(a), 0.22 * math.sin(a), h - 0.03), 0.012, 6, IRON)
    g.cyl(0, 0, h - 0.035, h - 0.012, 0.3, pans(20), IRON, bevel=0.004)
    # mosaïque: anneaux de tesselles (couleurs de la palette jardin)
    cols = ["jardin_water", "jardin_tile", "faience_white", "jardin_water", "faience_blue", "jardin_tile"]
    k = 0
    for ring, (r0, r1) in enumerate(((0.0, 0.08), (0.08, 0.17), (0.17, 0.27))):
        n = 1 if ring == 0 else 8 * ring
        for i in range(n):
            a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
            if ring == 0:
                g.cyl(0, 0, h - 0.012, h, 0.075, pans(10), "faience_blue")
                continue
            pts = []
            for (r, a) in ((r0 + 0.006, a0 + 0.02), (r1 - 0.006, a0 + 0.02), (r1 - 0.006, a1 - 0.02), (r0 + 0.006, a1 - 0.02)):
                pts.append((r * math.cos(a), r * math.sin(a)))
            g.poly(pts, h, cols[k % len(cols)])
            k += 1
    g.lathe(0, 0, h - 0.014, [(0.3, 0), (0.305, 0.01), (0.3, 0.016)], pans(20), IRON, cap_bottom=False, cap_top=False)
    return {"top": top(0.6, 0.6, h, "rond"), "places": 2}


@meuble("fauteuil_rotin", "jardin", "fauteuil", 1200, nom="Fauteuil de rotin")
def m_fauteuil_rotin(g):
    """Fauteuil en corolle de rotin tressé, coussin de lin vert d'eau."""
    for (x, y) in ((-0.25, -0.22), (0.25, -0.22), (-0.27, 0.25), (0.27, 0.25)):
        g.cyl(x, y, 0, 0.3, 0.018, pans(6), "t:rattan")
    g.lathe(0, 0.02, 0.28, [(0.3, 0), (0.33, 0.04), (0.32, 0.08)], pans(16), "t:rattan", cap_bottom=True, cap_top=True)
    k = 14
    pts = []
    for i in range(k + 1):
        a = -0.45 + (math.pi + 0.9) * i / k
        pts.append((0.31 * math.cos(a), -0.31 * math.sin(a) + 0.02, 0.62 + 0.23 * max(0.0, math.sin(a)) ** 0.8))
    for (a, b) in zip(pts, pts[1:]):
        g.quad([(a[0], a[1], 0.34), (b[0], b[1], 0.34), (b[0], b[1], b[2]), (a[0], a[1], a[2])], "t:rattan", normal_hint=(-a[0], -a[1], 0))
        g.quad([(a[0] * 1.08, a[1] * 1.08, 0.34), (a[0] * 1.08, a[1] * 1.08, a[2]), (b[0] * 1.08, b[1] * 1.08, b[2]), (b[0] * 1.08, b[1] * 1.08, 0.34)], "t:rattan", normal_hint=(a[0], a[1], 0))
        g.quad([(a[0], a[1], a[2]), (b[0], b[1], b[2]), (b[0] * 1.08, b[1] * 1.08, b[2]), (a[0] * 1.08, a[1] * 1.08, a[2])], "t:rattan", normal_hint=(0, 0, 1))
    g.cyl(0, 0.03, 0.36, 0.43, 0.27, pans(16), "jardin_water", bevel=0.025)
    return {"seats": [seat(0, 0.06, 0.43)]}


@meuble("cloche_verre", "jardin", "luminaire", 600, accroche="plafond", nom="Suspension cloche de verre")
def m_cloche_verre(g):
    zb = -0.6
    g.lathe(0, 0, zb, [(0.17, 0), (0.165, 0.03), (0.15, 0.18), (0.1, 0.3), (0.04, 0.36), (0.02, 0.4)], pans(14), "glass", cap_bottom=False, cap_top=True)
    g.sphere(0, 0, zb + 0.16, 0.05, 0.05, 0.065, "glow", segs=10, rings=6)
    g.cyl(0, 0, zb + 0.36, zb + 0.42, 0.035, pans(10), IRON, bevel=0.004)
    g.rod((0, 0, zb + 0.42), (0, 0, -0.02), 0.005, 6, "ink")
    g.cyl(0, 0, -0.02, 0.0, 0.045, pans(10), IRON, bevel=0.004)
    return {"lumiere": {"z": zb + 0.16}, "note": "cloche de 0,35 x 0,40 m, bas à 2,20 m sous un plafond de 2,80 m"}


def pot(g, r, h, key="t:terracotta", x=0.0, y=0.0, z=0.0, soil=True):
    g.lathe(x, y, z, [(r * 0.72, 0), (r * 0.95, h * 0.85), (r, h * 0.86), (r, h), (r * 0.9, h)], pans(12), key, cap_bottom=True, cap_top=False)
    if soil:
        g.cyl(x, y, z + h - 0.03, z + h - 0.025, r * 0.9, pans(12), "soil", cap_bottom=False)


def feuillage(g, cx, cy, cz, rx, rz, key_a, key_b, n=7, seed=1, segs=7, rings=5):
    import random
    rnd = random.Random(seed)
    g.sphere(cx, cy, cz, rx, rx, rz, key_a, segs=segs, rings=rings)
    for i in range(n):
        a = 2 * math.pi * i / n + rnd.uniform(-0.3, 0.3)
        r = rx * rnd.uniform(0.5, 0.75)
        rr = rx * rnd.uniform(0.45, 0.6)
        g.sphere(cx + r * math.cos(a), cy + r * math.sin(a), cz + rz * rnd.uniform(-0.3, 0.45), rr, rr, rr * 0.85, key_b if i % 2 else key_a, segs=max(5, segs - 1), rings=max(4, rings - 1))


@meuble("citronnier_pot", "jardin", "plante", 1200, nom="Citronnier en pot")
def m_citronnier(g):
    pot(g, 0.27, 0.42)
    g.cyl(0, 0, 0.39, 0.85, 0.03, pans(6), "village_bark", r_top=0.022)
    for (a, b) in (((0, 0, 0.75), (0.12, 0.05, 0.95)), ((0, 0, 0.8), (-0.1, -0.04, 1.0))):
        g.rod(a, b, 0.016, 6, "village_bark")
    feuillage(g, 0, 0, 1.08, 0.3, 0.28, "leaf", "leaf_dark", seed=3)
    import random
    rnd = random.Random(5)
    for i in range(9):
        a = rnd.uniform(0, 2 * math.pi)
        z = 1.08 + rnd.uniform(-0.15, 0.12)
        r = 0.33 * math.sqrt(max(0.1, 1 - ((z - 1.08) / 0.3) ** 2))
        g.sphere(r * math.cos(a), r * math.sin(a), z, 0.035, 0.035, 0.042, "lemon", segs=8, rings=5)
    return {"note": "1,40 m"}


@meuble("olivier_pot", "jardin", "plante", 1200, nom="Olivier en pot")
def m_olivier(g):
    pot(g, 0.38, 0.5)
    pts = [(0, 0, 0.47), (0.05, 0.02, 0.9), (-0.02, 0.0, 1.25)]
    for a, b in zip(pts, pts[1:]):
        g.rod(a, b, 0.05, pans(6), "village_bark")
    for (a, b) in (((0.05, 0.02, 0.9), (0.3, 0.1, 1.35)), ((0.0, 0.0, 1.1), (-0.3, -0.1, 1.45)), ((-0.02, 0, 1.25), (0.05, 0.15, 1.6))):
        g.rod(a, b, 0.025, 6, "village_bark")
    for (x, y, z, r, s) in ((0.3, 0.1, 1.5, 0.3, 1), (-0.3, -0.1, 1.6, 0.3, 2), (0.05, 0.15, 1.75, 0.28, 3), (0.0, -0.15, 1.45, 0.25, 4)):
        feuillage(g, x, y, z, r, r * 0.75, "olive_green", "leaf_light", n=3, seed=s, segs=7, rings=5)
    return {"note": "2,00 m: sur la terrasse, ou sous le plafond de 2,80 m"}


@meuble("herbier_encadre", "jardin", "cadre", 150, accroche="mur", nom="Herbier encadré")
def m_herbier(g):
    w, h = 0.4, 0.55
    g.box(-w / 2, w / 2, 0, 0.03, 0, h, "jardin_iron", bevel=0.004)
    g.box(-w / 2 + 0.035, w / 2 - 0.035, 0.03, 0.032, 0.035, h - 0.035, "paper_old", bevel=0)
    # tige et feuilles pressées (à plat)
    g.quad([(-0.004, 0.034, 0.08), (0.004, 0.034, 0.08), (0.01, 0.034, 0.45), (0.002, 0.034, 0.45)], "leaf_dark", normal_hint=(0, 1, 0))
    for i, z in enumerate((0.15, 0.22, 0.29, 0.36, 0.42)):
        s = 1 if i % 2 else -1
        g.quad([(0.005, 0.0345, z), (s * 0.07, 0.0345, z + 0.03), (s * 0.1, 0.0345, z + 0.06), (s * 0.03, 0.0345, z + 0.04)], "leaf" if i % 2 else "leaf_light", normal_hint=(0, 1, 0))
    return {}


@meuble("tapis_jonc", "jardin", "tapis", 150, nom="Tapis de jonc")
def m_tapis_jonc(g):
    g.box(-0.7, 0.7, -1.0, 1.0, 0.0, 0.01, "t:jonc", bevel=0.004, edges="top")
    return {"note": "se pose sous les meubles (floor_under)"}


@meuble("parasol_toile", "jardin", "terrasse", 1200, nom="Parasol de toile")
def m_parasol(g):
    g.lathe(0, 0, 0, [(0.25, 0), (0.25, 0.06), (0.06, 0.1), (0.0, 0.1)], pans(12), "iron", cap_bottom=False, cap_top=False)
    g.cyl(0, 0, 0.08, 2.3, 0.02, pans(6), "t:oak_campagne")
    n = 8
    apex, rim_z, R = 2.3, 1.95, 1.0
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p0 = (R * math.cos(a0), R * math.sin(a0), rim_z)
        p1 = (R * math.cos(a1), R * math.sin(a1), rim_z)
        g.quad([(0, 0, apex), p0, p1], "t:stripes", normal_hint=(math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2), 2))
        g.quad([(0, 0, apex - 0.01), p1, p0], "t:stripes", normal_hint=(-math.cos((a0 + a1) / 2), -math.sin((a0 + a1) / 2), -2))
        # lambrequin
        q0 = (p0[0], p0[1], rim_z - 0.12)
        q1 = (p1[0], p1[1], rim_z - 0.12)
        g.quad([p0, q0, q1, p1], "t:stripes", normal_hint=(math.cos((a0 + a1) / 2), math.sin((a0 + a1) / 2), 0))
        g.quad([p0, p1, q1, q0], "t:stripes", normal_hint=(-math.cos((a0 + a1) / 2), -math.sin((a0 + a1) / 2), 0))
        g.rod((0, 0, 1.55), (0.9 * math.cos(a0), 0.9 * math.sin(a0), rim_z + 0.03), 0.006, 5, "steel_dark")
    g.sphere(0, 0, apex + 0.03, 0.03, 0.03, 0.04, "t:oak_campagne", segs=8, rings=5)
    return {"note": "toile à 1,95 m au bord, 1,83 m au lambrequin: passer dessous demande de baisser un peu la tête (à poser au-dessus d'une table)"}


@meuble("jardinieres_terrasse", "neutre", "terrasse", 1200, nom="Jardinière de terrasse")
def m_jardiniere(g):
    w, d, h = 0.8, 0.3, 0.4
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0, h, "t:oak_campagne", bevel=0.008)
    g.box(-w / 2 + 0.03, w / 2 - 0.03, -d / 2 + 0.03, d / 2 - 0.03, h - 0.04, h - 0.03, "soil", bevel=0)
    import random
    rnd = random.Random(7)
    for i in range(7):
        x = -w / 2 + 0.08 + i * (w - 0.16) / 6
        feuillage(g, x, rnd.uniform(-0.05, 0.05), h + 0.1, 0.09, 0.08, "leaf", "leaf_light", n=1, seed=i, segs=6, rings=4)
        for j in range(2):
            a = rnd.uniform(0, 6.28)
            g.sphere(x + 0.08 * math.cos(a), 0.06 * math.sin(a), h + 0.12 + rnd.uniform(0, 0.08), 0.025, 0.025, 0.02, "flower_red" if (i + j) % 3 else "flower_white", segs=6, rings=4)
    return {}


@meuble("guirlande_guinguette", "jardin", "luminaire", 1200, accroche="store", nom="Guirlande guinguette")
def m_guirlande(g):
    """Câble de 6 m sous le store, 12 ampoules en poire; origine au milieu, câble à z = 0, extrémités aux points d'accroche."""
    n = 12
    L = 6.0
    pts = []
    for i in range(13):
        x = -L / 2 + L * i / 12
        z = -0.18 * (1 - (2 * x / L) ** 2)
        pts.append((x, 0, z))
    for a, b in zip(pts, pts[1:]):
        g.rod(a, b, 0.004, 4, "ink", cap=False)
    for i in range(n):
        x = -L / 2 + L * (i + 0.5) / n
        z = -0.18 * (1 - (2 * x / L) ** 2)
        g.cyl(x, 0, z - 0.04, z, 0.012, 6, "ink")
        g.sphere(x, 0, z - 0.075, 0.03, 0.03, 0.04, "glow", segs=6, rings=4)
    return {"note": "6 m, flèche de 18 cm au milieu"}


@meuble("lanterne_tilleul", "jardin", "luminaire", 600, accroche="store", nom="Lanterne de la fête du Tilleul (pièce unique)")
def m_lanterne(g):
    zb = -0.5
    g.lathe(0, 0, zb, [(0.12, 0), (0.15, 0.08), (0.15, 0.3), (0.1, 0.38)], pans(10), "glass", cap_bottom=True, cap_top=False)
    g.sphere(0, 0, zb + 0.18, 0.05, 0.05, 0.07, "glow", segs=8, rings=5)
    g.lathe(0, 0, zb + 0.36, [(0.12, 0), (0.06, 0.08), (0.02, 0.1)], pans(10), IRON, cap_bottom=True, cap_top=True)
    for i in range(6):
        a = i * math.pi / 3
        g.rod((0.15 * math.cos(a), 0.15 * math.sin(a), zb + 0.08), (0.15 * math.cos(a), 0.15 * math.sin(a), zb + 0.3), 0.005, 4, IRON)
    g.lathe(0, 0, zb - 0.02, [(0.13, 0), (0.13, 0.02)], pans(10), IRON, cap_bottom=True, cap_top=True)
    g.rod((0, 0, zb + 0.46), (0, 0, 0), 0.006, 4, IRON)
    return {"lumiere": {"z": zb + 0.18}}


# ------------------------------------------------------------------------------------------------
# Campagne et bistrot (suite)

@meuble("applique_laiton", "bistrot", "luminaire", 600, accroche="mur", nom="Applique de laiton")
def m_applique(g):
    """Origine au dos de la platine, en bas; poser la platine à 1,80 m environ."""
    g.box(-0.05, 0.05, 0, 0.02, 0, 0.16, "brass", bevel=0.005)
    pts = [(0, 0.02, 0.08), (0, 0.12, 0.08), (0, 0.18, 0.15)]
    for a, b in zip(pts, pts[1:]):
        g.rod(a, b, 0.008, 6, "brass")
    g.lathe(0, 0.18, 0.15, [(0.02, 0), (0.025, 0.02)], pans(8), "brass", cap_bottom=True, cap_top=False)
    g.lathe(0, 0.18, 0.15, [(0.035, 0.0), (0.075, 0.1), (0.08, 0.12)], pans(12), "glow", cap_bottom=False, cap_top=False)
    g.lathe(0, 0.18, 0.15, [(0.08, 0.12), (0.075, 0.1), (0.035, 0.0)], pans(12), "enamel_white", cap_bottom=False, cap_top=False)
    return {"lumiere": {"z": 0.22}, "note": "tulipe opaline tournée vers le haut"}


@meuble("lampe_lin", "campagne", "luminaire", 600, accroche="surface", nom="Lampe à abat-jour de lin")
def m_lampe_lin(g):
    g.lathe(0, 0, 0, [(0.08, 0), (0.08, 0.015), (0.06, 0.03)], pans(12), "glaze_sage", cap_bottom=False, cap_top=True)
    g.lathe(0, 0, 0.02, [(0.05, 0), (0.09, 0.1), (0.08, 0.2), (0.03, 0.27), (0.02, 0.3)], pans(14), "glaze_sage", cap_bottom=False, cap_top=True)
    g.cyl(0, 0, 0.3, 0.36, 0.01, 6, "brass")
    g.lathe(0, 0, 0.32, [(0.15, 0), (0.1, 0.22)], pans(14), "t:linen", cap_bottom=False, cap_top=False)
    g.lathe(0, 0, 0.32, [(0.098, 0.22), (0.148, 0.0)], pans(14), "glow", cap_bottom=False, cap_top=False)
    return {"lumiere": {"z": 0.4}, "note": "0,55 m: sur une table, une desserte ou un appui"}


@meuble("affiche_tilleul_1962", "neutre", "cadre", 150, accroche="mur", nom="Affiche de la fête du Tilleul, 1962")
def m_affiche(g):
    """Affiche ancienne: ciel, tilleul, place; le texte de l'affiche est laissé au jeu (aucun texte peint)."""
    w, h = 0.5, 0.7
    g.box(-w / 2, w / 2, 0, 0.03, 0, h, "oak_dark", bevel=0.004)
    y = 0.031
    g.quad([(-0.22, y, 0.03), (0.22, y, 0.03), (0.22, y, 0.67), (-0.22, y, 0.67)], "paper_old", normal_hint=(0, 1, 0))
    y = 0.032
    g.quad([(-0.2, y, 0.3), (0.2, y, 0.3), (0.2, y, 0.55), (-0.2, y, 0.55)], "poster_sky", normal_hint=(0, 1, 0))
    g.quad([(-0.2, y, 0.08), (0.2, y, 0.08), (0.2, y, 0.3), (-0.2, y, 0.3)], "poster_ground", normal_hint=(0, 1, 0))
    n = 10
    pts = [(0.0 + 0.11 * math.cos(2 * math.pi * i / n), 0.4 + 0.1 * math.sin(2 * math.pi * i / n)) for i in range(n)]
    g.quad([(x, 0.033, z) for x, z in pts], "poster_tree", normal_hint=(0, 1, 0))
    g.quad([(-0.012, 0.033, 0.22), (0.012, 0.033, 0.22), (0.012, 0.033, 0.33), (-0.012, 0.033, 0.33)], "bistrot_wood", normal_hint=(0, 1, 0))
    g.quad([(-0.18, 0.033, 0.58), (0.18, 0.033, 0.58), (0.18, 0.033, 0.64), (-0.18, 0.033, 0.64)], "house_bordeaux", normal_hint=(0, 1, 0))
    return {"note": "bandeau bordeaux en haut: place du titre, écrit par le jeu si on le souhaite"}


@meuble("assiettes_faience", "campagne", "cadre", 600, accroche="mur", nom="Assiettes de faïence au mur")
def m_assiettes(g):
    """Cinq assiettes accrochées en arc (0,9 x 0,6 m), construites à plat puis dressées face au sud."""
    from mathutils import Matrix
    places = [(-0.33, 0.04, 0.12), (0.33, 0.04, 0.12), (-0.17, 0.34, 0.11), (0.17, 0.34, 0.11), (0.0, 0.16, 0.14)]
    for (x, z, r) in places:
        vs = g.lathe(0, 0, 0, [(r * 0.6, 0.0), (r * 0.94, 0.012), (r, 0.016), (r * 0.6, 0.009)],
                     12, "faience_white", keys=["faience_white", "faience_blue", "faience_white"])
        vs += g.cyl(0, 0, 0.0093, 0.0103, r * 0.35, 10, "faience_blue", cap_bottom=False)
        M = Matrix.Translation(K.P(x, 0.0, z + r)) @ Matrix.Rotation(math.radians(90), 4, "X")
        Geo.transform(set(vs), M)
    return {}


@meuble("horloge_ecole", "neutre", "horloge", 600, accroche="mur", nom="Horloge d'école")
def m_horloge(g):
    """Cadran construit à plat (normale vers le haut), puis dressé face au sud contre le mur."""
    from mathutils import Matrix
    r = 0.175
    vs = []
    vs += g.cyl(0, 0, 0, 0.05, r, pans(16), "t:oak_campagne", bevel=0.008)
    vs += g.cyl(0, 0, 0.05, 0.055, r - 0.02, pans(16), "enamel_white")
    for k in range(12):
        l = 0.025 if k % 3 == 0 else 0.012
        m = g.box(-0.004, 0.004, -(r - 0.03), -(r - 0.03 - l), 0.055, 0.058, "ink", bevel=0)
        Geo.rotate_z(m, 0, 0, 30 * k)
        vs += m
    m = g.box(-0.004, 0.004, -0.1, 0.005, 0.058, 0.061, "ink", bevel=0)
    vs += m
    m = g.box(-0.005, 0.005, -0.07, 0.005, 0.061, 0.064, "ink", bevel=0)
    Geo.rotate_z(m, 0, 0, -120)
    vs += m
    vs += g.cyl(0, 0, 0.055, 0.066, 0.008, 8, "brass")
    M = Matrix.Translation(K.P(0, 0.0, r)) @ Matrix.Rotation(math.radians(90), 4, "X")
    Geo.transform(set(vs), M)
    return {"note": "heure fixe (7 h): aiguilles fixes en v0.1"}


@meuble("tapis_lirette", "campagne", "tapis", 150, nom="Tapis lirette")
def m_tapis_lirette(g):
    g.box(-0.6, 0.6, -0.9, 0.9, 0.0, 0.01, "t:lirette", bevel=0.004, edges="top")
    return {"note": "se pose sous les meubles (floor_under)"}


@meuble("vaisselier_sauge", "campagne", "etagere", 1500, nom="Vaisselier peint en sauge")
def m_vaisselier(g):
    w, d, h = 1.4, 0.5, 2.0
    P_ = "sage_paint"
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.08, 0.9, P_, bevel=0.01)
    g.box(-w / 2 + 0.03, w / 2 - 0.03, -d / 2 + 0.03, d / 2 - 0.02, 0.0, 0.08, P_, bevel=0.006)
    g.box(-w / 2 - 0.02, w / 2 + 0.02, -d / 2 - 0.01, d / 2 + 0.02, 0.9, 0.94, OAK, bevel=0.008)
    for i in range(3):
        x0 = -w / 2 + 0.05 + i * (w - 0.1) / 3
        g.box(x0 + 0.01, x0 + (w - 0.1) / 3 - 0.01, d / 2, d / 2 + 0.015, 0.14, 0.84, P_, bevel=0.008)
        g.sphere(x0 + (w - 0.1) / 6, d / 2 + 0.03, 0.7, 0.018, 0.018, 0.018, "brass", segs=8, rings=5)
    # haut: étagères ouvertes, fond, corniche
    g.box(-w / 2 + 0.05, w / 2 - 0.05, -d / 2, -d / 2 + 0.02, 0.94, h - 0.08, P_, bevel=0)
    for x in (-w / 2 + 0.05, w / 2 - 0.08):
        g.box(x, x + 0.03, -d / 2, -d / 2 + 0.3, 0.94, h - 0.08, P_, bevel=0.006)
    for z in (1.3, 1.65):
        g.box(-w / 2 + 0.08, w / 2 - 0.08, -d / 2 + 0.02, -d / 2 + 0.28, z - 0.025, z, P_, bevel=0.005)
        g.rod((-w / 2 + 0.08, -d / 2 + 0.22, z + 0.07), (w / 2 - 0.08, -d / 2 + 0.22, z + 0.07), 0.006, 6, "brass")
    g.box(-w / 2, w / 2, -d / 2 - 0.01, -d / 2 + 0.33, h - 0.08, h, P_, bevel=0.01)
    return {"surfaces": [{"z": 0.94, "w": 1.4, "d": 0.5, "y": 0.0}, {"z": 1.3, "w": 1.24, "d": 0.26, "y": -0.1}, {"z": 1.65, "w": 1.24, "d": 0.26, "y": -0.1}],
            "note": "dos au mur (nord); deux tablettes à 1,30 et 1,65 m"}


@meuble("desserte_zinc", "bistrot", "etagere", 1000, nom="Desserte à dessus de zinc")
def m_desserte(g):
    w, d, h = 1.0, 0.45, 0.95
    for x in (-w / 2 + 0.03, w / 2 - 0.07):
        for y in (-d / 2 + 0.03, d / 2 - 0.07):
            g.box(x, x + 0.04, y, y + 0.04, 0, h - 0.03, BWOOD, edges="vertical")
    for z in (0.12, 0.5):
        g.box(-w / 2 + 0.03, w / 2 - 0.03, -d / 2 + 0.03, d / 2 - 0.03, z, z + 0.025, BWOOD, bevel=0.005)
    g.box(-w / 2, w / 2, -d / 2, d / 2, h - 0.03, h, "t:zinc", bevel=0.006)
    g.box(-w / 2 - 0.004, w / 2 + 0.004, d / 2 - 0.004, d / 2 + 0.006, h - 0.04, h, "t:zinc", bevel=0.003)
    return {"surfaces": [{"z": h, "w": w, "d": d, "y": 0.0}, {"z": 0.525, "w": 0.92, "d": 0.38, "y": 0.0}, {"z": 0.145, "w": 0.92, "d": 0.38, "y": 0.0}],
            "note": "dos au mur (nord)"}


@meuble("fauteuil_club", "bistrot", "fauteuil", 1200, nom="Fauteuil club")
def m_fauteuil_club(g):
    w, d = 0.8, 0.8
    L = "t:leather"
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0.05, 0.25, L, bevel=0.04, segs=2)
    g.box(-w / 2 + 0.14, w / 2 - 0.14, -d / 2 + 0.2, d / 2 - 0.02, 0.25, 0.42, L, bevel=0.04, segs=3)
    g.box(-w / 2 + 0.06, w / 2 - 0.06, -d / 2, -d / 2 + 0.2, 0.25, 0.8, L, bevel=0.05, segs=3)
    for s in (-1, 1):
        x0, x1 = (w / 2 - 0.15, w / 2) if s > 0 else (-w / 2, -w / 2 + 0.15)
        g.box(x0, x1, -d / 2 + 0.05, d / 2, 0.25, 0.6, L, bevel=0.06, segs=3)
    for (x, y) in ((-0.33, -0.33), (0.33, -0.33), (-0.33, 0.33), (0.33, 0.33)):
        g.cyl(x, y, 0, 0.05, 0.03, pans(8), BWOOD)
    return {"seats": [seat(0, 0.08, 0.42)]}


# ------------------------------------------------------------------------------------------------
# Plantes et petits objets

@meuble("fougere_suspendue", "neutre", "plante", 1200, accroche="plafond", nom="Fougère suspendue")
def m_fougere(g):
    zb = -0.6
    g.lathe(0, 0, zb, [(0.08, 0), (0.12, 0.08), (0.13, 0.14)], pans(10), "t:terracotta", cap_bottom=True, cap_top=False)
    for i in range(3):
        a = 2 * math.pi * i / 3
        g.rod((0.12 * math.cos(a), 0.12 * math.sin(a), zb + 0.13), (0, 0, -0.02), 0.003, 4, "kraft")
    g.cyl(0, 0, -0.02, 0.0, 0.03, 8, "brass")
    for i in range(12):
        a = 2 * math.pi * i / 12
        L = 0.28 + 0.06 * (i % 3)
        base = (0.05 * math.cos(a), 0.05 * math.sin(a), zb + 0.13)
        mid = (0.15 * math.cos(a), 0.15 * math.sin(a), zb + 0.2)
        tip = ((0.12 + L * 0.6) * math.cos(a), (0.12 + L * 0.6) * math.sin(a), zb + 0.13 - L * 0.5)
        for (p, q) in ((base, mid), (mid, tip)):
            dx, dy = -math.sin(a) * 0.04, math.cos(a) * 0.04
            g.quad([(p[0] - dx, p[1] - dy, p[2]), (p[0] + dx, p[1] + dy, p[2]), (q[0] + dx * 0.6, q[1] + dy * 0.6, q[2]), (q[0] - dx * 0.6, q[1] - dy * 0.6, q[2])], "leaf" if i % 2 else "leaf_light", normal_hint=(0, 0, 1))
            g.quad([(p[0] - dx, p[1] - dy, p[2] - 0.003), (q[0] - dx * 0.6, q[1] - dy * 0.6, q[2] - 0.003), (q[0] + dx * 0.6, q[1] + dy * 0.6, q[2] - 0.003), (p[0] + dx, p[1] + dy, p[2] - 0.003)], "leaf_dark", normal_hint=(0, 0, -1))
    return {"note": "pend à 0,60 m sous le plafond (bas des frondes vers 2,05 m)"}


@meuble("pothos_etagere", "neutre", "plante", 600, accroche="surface", nom="Pothos d'étagère")
def m_pothos(g):
    pot(g, 0.08, 0.11, key="glaze_sage")
    feuillage(g, 0, 0, 0.17, 0.09, 0.07, "leaf", "leaf_light", n=3, seed=11, segs=6, rings=4)
    # tiges retombantes serrées contre le pot, feuilles en cœur le long de la tige (pas de boule au bout: pattes d'araignée)
    for i in range(3):
        a = 1.2 + i * 0.4
        r0 = 0.085
        for j in range(4):
            z = 0.115 - j * 0.03
            x, y = (r0 + 0.012 * j) * math.cos(a), (r0 + 0.012 * j) * math.sin(a)
            g.sphere(x, y, z, 0.026, 0.014, 0.022, "leaf" if (i + j) % 2 else "leaf_light", segs=5, rings=3)
    return {"note": "feuilles qui retombent sur le devant du pot (sud), sans passer sous son pied"}


@meuble("bouquet_champetre", "neutre", "plante", 600, accroche="surface", nom="Bouquet champêtre")
def m_bouquet(g):
    g.lathe(0, 0, 0, [(0.04, 0), (0.055, 0.06), (0.045, 0.14), (0.03, 0.17), (0.035, 0.19), (0.0, 0.19)], pans(12), "faience_blue", cap_bottom=True, cap_top=False)
    import random
    rnd = random.Random(13)
    for i in range(9):
        a = rnd.uniform(0, 6.28)
        r = rnd.uniform(0.02, 0.07)
        tip = (r * math.cos(a), r * math.sin(a), 0.27 + rnd.uniform(0, 0.08))
        g.rod((0, 0, 0.15), tip, 0.003, 4, "leaf")
        k = ["flower_white", "flower_yellow", "flower_rose", "flower_white"][i % 4]
        g.sphere(*tip, 0.022, 0.022, 0.012, k, segs=6, rings=4)
    return {}


@meuble("geraniums_vitrine", "neutre", "plante", 1200, accroche="appui", nom="Géraniums de la vitrine")
def m_geraniums(g):
    w, d, h = 0.8, 0.18, 0.13
    g.box(-w / 2, w / 2, -d / 2, d / 2, 0, h, "t:terracotta", bevel=0.008)
    g.box(-w / 2 + 0.015, w / 2 - 0.015, -d / 2 + 0.015, d / 2 - 0.015, h - 0.02, h - 0.012, "soil", bevel=0)
    for i in range(4):
        x = -0.3 + i * 0.2
        feuillage(g, x, 0, h + 0.05, 0.08, 0.05, "leaf", "leaf_dark", n=2, seed=20 + i, segs=6, rings=4)
        for j in range(2):
            a = j * 2.1 + i
            g.sphere(x + 0.05 * math.cos(a), 0.04 * math.sin(a), h + 0.11, 0.03, 0.03, 0.025, "flower_red", segs=7, rings=4)
    return {"note": "appui intérieur de la vitrine (0,45 m) ou de la petite fenêtre (0,90 m)"}


@meuble("cloche_gateaux", "campagne", "comptoir", 600, accroche="surface", nom="Cloche à gâteaux")
def m_cloche_gateaux(g):
    g.cyl(0, 0, 0, 0.012, 0.08, pans(12), WAL)
    g.cyl(0, 0, 0.012, 0.03, 0.15, pans(16), WAL, bevel=0.005)
    prof = [(0.14, 0)] + [(0.14 * math.cos(a), 0.06 + 0.2 * math.sin(a)) for a in [i * math.pi / 2 / 6 for i in range(1, 7)]]
    g.lathe(0, 0, 0.03, [(0.14, 0), (0.14, 0.06)] + prof[1:], pans(16), "glass", cap_bottom=False, cap_top=False)
    g.sphere(0, 0, 0.3, 0.02, 0.02, 0.02, "brass", segs=8, rings=5)
    return {"sockets": [{"name": "food_0", "x": -0.05, "y": 0.0, "z": 0.03}, {"name": "food_1", "x": 0.05, "y": 0.02, "z": 0.03}],
            "note": "plateau de noyer et cloche de verre; douilles des viennoiseries dessous"}


@meuble("bocal_biscuits", "neutre", "comptoir", 600, accroche="surface", nom="Bocal à biscuits")
def m_bocal(g):
    g.lathe(0, 0, 0, [(0.07, 0), (0.085, 0.01), (0.09, 0.2), (0.06, 0.24), (0.06, 0.255)], pans(14), "glass", cap_bottom=True, cap_top=False)
    g.cyl(0, 0, 0.25, 0.28, 0.068, pans(14), "t:oak_campagne", bevel=0.005)
    g.sphere(0, 0, 0.29, 0.018, 0.018, 0.015, "t:oak_campagne", segs=8, rings=5)
    for i in range(6):
        a = i * 1.1
        g.cyl(0.04 * math.cos(a), 0.04 * math.sin(a), 0.01 + (i // 3) * 0.02, 0.02 + (i // 3) * 0.02, 0.035, pans(10), "crust" if i % 2 else "crumb")
    return {}


@meuble("pot_pourboires_gres", "campagne", "comptoir", 250, accroche="surface", nom="Pot à pourboires en grès")
def m_pot_pourboires(g):
    g.lathe(0, 0, 0, [(0.05, 0), (0.065, 0.04), (0.07, 0.12), (0.06, 0.16), (0.062, 0.175), (0.054, 0.175), (0.05, 0.03)], pans(12), "glaze_blue",
            keys=["glaze_blue", "glaze_blue", "glaze_blue", "glaze_blue", "glaze_blue", "glaze_blue"], cap_bottom=True, cap_top=True)
    for i in range(3):
        g.cyl(0.015 * i - 0.015, 0.01 * (i % 2), 0.035 + 0.006 * i, 0.04 + 0.006 * i, 0.012, 8, "brass")
    return {}


@meuble("caisse_ancienne", "bistrot", "comptoir", 600, accroche="surface", nom="Caisse enregistreuse ancienne")
def m_caisse_ancienne(g):
    """Caisse de laiton à touches rondes et tiroir; elle remplace la caisse du poste (même emprise)."""
    g.box(-0.18, 0.18, -0.18, 0.18, 0, 0.08, BWOOD, bevel=0.008)
    g.box(-0.08, 0.08, 0.18, 0.183, 0.03, 0.06, "brass", bevel=0)
    vs = g.box(-0.16, 0.16, -0.14, 0.14, 0.08, 0.2, "brass", bevel=0.012)
    for i in range(5):
        for j in range(3):
            g.cyl(-0.1 + i * 0.05, 0.1 - j * 0.045, 0.2, 0.225, 0.014, 6, "enamel_white", cap_bottom=False)
    g.box(-0.14, 0.14, -0.14, -0.1, 0.2, 0.33, "brass", bevel=0.01)
    g.box(-0.09, 0.09, -0.16, -0.14, 0.26, 0.31, "ink", bevel=0.003)
    g.box(0.16, 0.18, 0.0, 0.03, 0.12, 0.14, "brass", bevel=0.002)
    g.rod((0.18, 0.015, 0.13), (0.24, 0.015, 0.22), 0.007, 6, "brass")
    g.sphere(0.24, 0.015, 0.23, 0.018, 0.018, 0.018, "enamel_white", segs=8, rings=5)
    return {"note": "touches vers le barista (sud du modèle): la tourner vers l'arrière-comptoir; afficheur vers les clients"}


@meuble("enseigne_bois_peint", "campagne", "enseigne", 600, accroche="facade", nom="Enseigne de bois peint")
def m_enseigne_bois(g):
    w, h = 1.8, 0.5
    g.box(-w / 2, w / 2, 0, 0.05, 0, h, "sage_paint", bevel=0.01)
    g.box(-w / 2 + 0.04, w / 2 - 0.04, 0.05, 0.055, 0.04, h - 0.04, "top_light_cream", bevel=0)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, 0.05, 0.06, 0.015, 0.035, "gold", bevel=0)
    g.box(-w / 2 + 0.02, w / 2 - 0.02, 0.05, 0.06, h - 0.035, h - 0.015, "gold", bevel=0)
    return {"note": "nom de la maison écrit par le jeu (toile 2D) sur le panneau crème: zone de 1,72 x 0,42 m, plan à 0,056 m du mur"}


@meuble("enseigne_fer_forge", "jardin", "enseigne", 600, accroche="facade", nom="Enseigne de fer forgé (potence)")
def m_enseigne_fer(g):
    """Potence perpendiculaire au mur (vers le sud), panneau rond pendu; origine au mur, au bas de la platine."""
    g.box(-0.06, 0.06, 0, 0.02, 0, 0.12, IRON, bevel=0.004)
    g.rod((0, 0.02, 0.1), (0, 0.7, 0.1), 0.01, 6, IRON)
    g.rod((0, 0.02, 0.0), (0, 0.35, 0.1), 0.008, 6, IRON)
    for i in range(10):
        a = math.pi * i / 9
        g.sphere(0, 0.3 + 0.08 * math.cos(a), 0.1 + 0.06 * math.sin(a), 0.006, 0.006, 0.006, IRON, segs=4, rings=3)
    for y in (0.25, 0.5):
        g.rod((0, y, 0.1), (0, y, -0.02), 0.004, 4, IRON)
    from mathutils import Matrix
    vs = g.cyl(0, 0, -0.015, 0.015, 0.3, pans(16), IRON, bevel=0.004)
    vs += g.cyl(0, 0, 0.015, 0.018, 0.27, pans(16), "top_light_cream")
    vs += g.cyl(0, 0, -0.018, -0.015, 0.27, pans(16), "top_light_cream")
    M = Matrix.Translation(K.P(0, 0.375, -0.3)) @ Matrix.Rotation(math.radians(90), 4, "Y")
    Geo.transform(set(vs), M)
    return {"note": "origine au bas de la platine fixée sur la façade; le disque de 0,6 m pend sous la potence (jusqu'à 0,60 m sous l'origine): poser la platine à 2,90 m au moins. Fond crème des deux côtés pour le nom écrit par le jeu"}


@meuble("enseigne_lettres_dorees", "bistrot", "enseigne", 150, accroche="vitrine", nom="Lettres dorées sur la vitrine")
def m_lettres(g):
    """Bandeau doré à poser sur la vitre (côté rue); le nom en lettres d'or est dessiné par le jeu sur la zone sombre."""
    w, h = 2.0, 0.4
    g.box(-w / 2, w / 2, 0, 0.004, 0, 0.012, "gold", bevel=0)
    g.box(-w / 2, w / 2, 0, 0.004, h - 0.012, h, "gold", bevel=0)
    for x in (-w / 2, w / 2 - 0.012):
        g.box(x, x + 0.012, 0, 0.004, 0, h, "gold", bevel=0)
    return {"note": "cadre fin, le texte doré est une toile du jeu (police de la bible)"}


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--seulement", default="")
    ap.add_argument("--sans-ao", action="store_true")
    ap.add_argument("--sans-atlas", action="store_true")
    a = ap.parse_args(argv)
    import catalogue as CAT
    if not a.sans_atlas:
        K.construire_atlas()
    ids = [i for i in a.seulement.split(",") if i] or list(CATALOGUE)
    CAT.produire(CATALOGUE, ids, os.path.join(ICI, "fiches", "meubles.json"), ao=not a.sans_ao)


if __name__ == "__main__":
    main()
