"""Mobilier encré: les meubles qui venaient de l'ancienne chaîne arrondie (`assets-src/decors/`,
retirée le 2026-11-11), refaits dans le style encré, mêmes identifiants, mêmes cotes de jeu.

Famille `mobilier` (`aubrune-mobilier.glb`): lits, chaise, table, armoire, coffre, banc de quai,
baignoire, barrière de la voie, poteau de quai, pompe à eau, et l'intérieur de la voiture du
train de nuit (parois, porte, angle, applique, banquettes, couchette, tablette, porte-bagages).
Origine au centre de l'emprise, au sol, avant vers +z (le côté d'où l'on s'en sert). Chaque
pièce est un bloc fermé: on peut tourner autour dans la visionneuse sans voir à travers.

Cotes tenues (le jeu les lit au manifeste): assise à 45 cm (`seat`, bord avant), plateau de table
à 75 cm (`top`), couchage à 50 cm (48 pour la couchette du train, `bed`). Voiture du train: les
parois, la porte et l'angle sont au bord avant de leur case (z de 0,36 à 0,5), leur face
intérieure tournée vers +z; l'applique, la tablette et le porte-bagages ont leur dos en z le plus
bas (la carte les cale contre la paroi).

Raisons d'être:
- la pompe verse VERS LE BAS: son bec sort du corps de fonte, se coude et s'ouvre à 25 cm au-dessus
  de l'eau de l'auge de pierre; le bras de levier est derrière, on pompe face à l'auge;
- la baignoire se reconnaît à son robinet (col de cygne au-dessus de la bonde, deux croisillons
  rouge et bleu), à sa bonde et sa chaînette, et à ses quatre pieds de fonte;
- la barrière de la voie est un module de 2 m (le rendu les met bout à bout): deux poteaux à
  50 cm des bouts, trois lisses qui courent d'un bout à l'autre et rejoignent celles du voisin.
"""

from __future__ import annotations

import math

import numpy as np

from amenagements import _modele, _table, barre, boite, colonne, glace_reflet, orientees, prisme
from formes import Atelier, at, ton


# ---------------------------------------------------------------------- outils
def plaque(s: Atelier, x0, x1, y0, y1, z, mat, couleur):
    """Plaque plate tournée vers +z (posée sur une face: carte, papier, cadre)."""
    s.morceau([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 1, 2, 3)], mat, couleur, coeur=((x0 + x1) / 2, (y0 + y1) / 2, z - 1.0))


def _arrondi(a, b, r, n=4):
    """Rectangle arrondi (demi-longueur a en x, demi-largeur b en z, rayon r aux coins)."""
    pts = []
    for cx, cz, a0 in ((a - r, b - r, 0.0), (-(a - r), b - r, math.pi / 2), (-(a - r), -(b - r), math.pi), (a - r, -(b - r), 1.5 * math.pi)):
        for k in range(n + 1):
            t = a0 + k / n * math.pi / 2
            pts.append((cx + math.cos(t) * r, cz + math.sin(t) * r))
    return pts


def cuve(s: Atelier, dehors, dedans, mat, couleur, couleur_dedans, fond=None):
    """Cuve à paroi épaisse (baignoire, auge): anneaux du dehors de bas en haut, puis du dedans du
    haut vers le fond; chaque anneau = (a, b, rayon de coin, y). Lèvre plate entre le haut du
    dehors et le haut du dedans, fond plat dessous et dedans. Fermée de partout."""
    anneaux = [(_arrondi(a, b, r), y) for a, b, r, y in dehors]
    dedans_ = [(_arrondi(a, b, r), y) for a, b, r, y in dedans]
    n = len(anneaux[0][0])
    v, faces, vers, couleurs = [], [], [], []

    def ajoute(contour, y):
        i = len(v)
        v.extend((x, y, z) for x, z in contour)
        return i

    exts = [ajoute(c, y) for c, y in anneaux]
    ints = [ajoute(c, y) for c, y in dedans_]
    for liste, signe, teinte in ((exts, 1.0, couleur), (ints, -1.0, couleur_dedans)):
        for r in range(len(liste) - 1):
            a, b = liste[r], liste[r + 1]
            for k in range(n):
                j = (k + 1) % n
                faces.append((a + k, a + j, b + j, b + k))
                p = np.array(v[a + k]) + np.array(v[a + j])
                vers.append(np.array((p[0], 0.0, p[2])) * signe)
                couleurs.append(teinte)
    # Lèvre: du haut du dehors au haut du dedans.
    a, b = exts[-1], ints[0]
    for k in range(n):
        j = (k + 1) % n
        faces.append((a + k, a + j, b + j, b + k))
        vers.append(np.array((0.0, 1.0, 0.0)))
        couleurs.append(couleur)
    # Dessous et fond du dedans.
    for i0, haut in ((exts[0], -1.0), (ints[-1], 1.0)):
        c = len(v)
        y = v[i0][1]
        v.append((0.0, y, 0.0))
        for k in range(n):
            faces.append((i0 + k, i0 + (k + 1) % n, c))
            vers.append(np.array((0.0, haut, 0.0)))
            couleurs.append(couleur if haut < 0 else (fond if fond is not None else couleur_dedans))
    s.morceau(v, orientees(v, faces, vers), mat, couleurs, garde=True)


# ---------------------------------------------------------------------- meubles
def _lit(s, ctx, w, places):
    bois = ctx.tons("bois_meuble")
    d = 2.0
    # Montants (les pieds), tête au nord (-z, contre le mur), pied au sud.
    for sx in (-1, 1):
        x = sx * (w / 2 - 0.04)
        boite(s, x - 0.04, x + 0.04, 0, 0.95, -d / 2, -d / 2 + 0.08, "bois", bois[0], dessus=ctx.un("bois_clair"))
        boite(s, x - 0.04, x + 0.04, 0, 0.62, d / 2 - 0.08, d / 2, "bois", bois[0], dessus=ctx.un("bois_clair"))
        boite(s, x - 0.025, x + 0.025, 0.2, 0.36, -d / 2 + 0.08, d / 2 - 0.08, "bois", bois[1])
    # Tête de lit à panneau, pied plus bas.
    boite(s, -w / 2 + 0.08, w / 2 - 0.08, 0.36, 0.86, -d / 2 + 0.015, -d / 2 + 0.065, "bois", bois[2 % len(bois)])
    boite(s, -w / 2 + 0.08, w / 2 - 0.08, 0.86, 0.92, -d / 2 + 0.005, -d / 2 + 0.075, "bois", bois[0], dessus=ctx.un("bois_clair"))
    boite(s, -w / 2 + 0.08, w / 2 - 0.08, 0.36, 0.56, d / 2 - 0.065, d / 2 - 0.015, "bois", bois[2 % len(bois)])
    # Matelas, édredon (il couvre les deux tiers et tombe sur les côtés), drap retourné, oreillers.
    m = 0.075
    boite(s, -w / 2 + m, w / 2 - m, 0.36, 0.5, -d / 2 + 0.08, d / 2 - 0.08, "etoffe", ctx.un("creme"))
    edredon = ctx.un("etoffes", 0.4 if places > 1 else 0.7)
    boite(s, -w / 2 + m - 0.02, w / 2 - m + 0.02, 0.3, 0.535, -0.3, d / 2 - 0.07, "etoffe", edredon, dessus=ton(edredon, 1.08))
    boite(s, -w / 2 + m - 0.03, w / 2 - m + 0.03, 0.502, 0.55, -0.36, -0.26, "etoffe", ctx.un("creme"), dessus=ctx.un("creme"))
    for k in range(places):
        x = 0.0 if places == 1 else (k - 0.5) * (w - 2 * m) / 2
        s.box((w - 2 * m) / places - 0.06, 0.11, 0.3, at(x, 0.545, -0.72, 0.03 * (k - 0.5)), "etoffe", ctx.un("creme"), tremble=0.01, sans="")


def _chaise(s, ctx):
    bois = ctx.tons("bois_meuble")
    for sx in (-1, 1):
        x = sx * 0.18
        boite(s, x - 0.02, x + 0.02, 0, 0.425, 0.15, 0.19, "bois", bois[0], sans="y-")
        boite(s, x - 0.02, x + 0.02, 0, 0.92, -0.2, -0.16, "bois", bois[0], dessus=ctx.un("bois_clair"))
        boite(s, x - 0.012, x + 0.012, 0.14, 0.17, -0.16, 0.15, "bois", bois[1])
    boite(s, -0.16, 0.16, 0.18, 0.205, 0.155, 0.185, "bois", bois[1])
    # Assise paillée, bord avant à 21 cm du centre, dessus à 45 cm.
    boite(s, -0.21, 0.21, 0.425, 0.45, -0.2, 0.21, "bois", ctx.un("paille"), dessus=ctx.un("paille", 1))
    for y in (0.6, 0.78):
        boite(s, -0.16, 0.16, y, y + 0.07, -0.19, -0.17, "bois", bois[2 % len(bois)])


def _armoire(s, ctx):
    bois = ctx.tons("bois_meuble")
    w, z0, z1 = 0.98, -0.3, 0.26
    for sx in (-1, 1):
        for zz in (z0 + 0.03, z1 - 0.03):
            boite(s, sx * (w / 2 - 0.05) - 0.03, sx * (w / 2 - 0.05) + 0.03, 0, 0.1, zz - 0.03, zz + 0.03, "bois", bois[1], sans="y-")
    boite(s, -w / 2 + 0.02, w / 2 - 0.02, 0.1805, 1.8195, z0, z1, "bois", bois[0], tremble=0.002)

    boite(s, -w / 2, w / 2, 1.82, 1.95, z0 - 0.0, z1 + 0.04, "bois", bois[1], dessus=ctx.un("bois_clair"))
    boite(s, -w / 2, w / 2, 0.1, 0.18, z0, z1 + 0.03, "bois", bois[1])
    # Deux portes à panneaux, boutons de laiton, entrée de serrure.
    for sx in (-1, 1):
        xa, xb = (0.004, w / 2 - 0.04) if sx > 0 else (-w / 2 + 0.04, -0.004)
        boite(s, xa, xb, 0.2, 1.8, z1, z1 + 0.02, "bois", ctx.un("bois_meuble", 2))
        for ya, yb in ((0.3, 0.95), (1.07, 1.7)):
            boite(s, xa + 0.06, xb - 0.06, ya, yb, z1 + 0.02, z1 + 0.035, "bois", ctx.un("bois_clair", 1))
        s.octa(0.018, 0.018, 0.014, at(sx * 0.04, 1.0, z1 + 0.035), "metal", ctx.un("laiton"))


def _coffre(s, ctx):
    bois = ctx.tons("bois_meuble")
    fer = ctx.un("fer")
    w, z0, z1 = 0.82, -0.22, 0.22
    boite(s, -w / 2 + 0.02, w / 2 - 0.02, 0.0, 0.44, z0, z1, "bois", bois[0])
    # Couvercle bombé: un demi-tonneau couché le long de x.
    arc = [(z0 - 0.01 + (z1 - z0 + 0.02) * (1 - math.cos(t)) / 2, 0.44 + 0.12 * math.sin(t)) for t in np.linspace(0, math.pi, 7)]
    prisme(s, "x", -w / 2, w / 2, arc, "bois", bois[1])
    for x in (-0.27, 0.27):
        for (za, ya), (zb, yb) in zip(arc, arc[1:]):
            a = math.atan2(yb - ya, zb - za)
            s.box(0.05, 0.012, math.hypot(zb - za, yb - ya) + 0.004, at(x, (ya + yb) / 2 + 0.006 * math.cos(a), (za + zb) / 2 - 0.006 * math.sin(a), 0, -a), "metal", fer, tremble=0.0, sans="")
        boite(s, x - 0.025, x + 0.025, 0.02, 0.44, z1, z1 + 0.012, "metal", fer, tremble=0.0)
    boite(s, -0.05, 0.05, 0.32, 0.43, z1 + 0.006, z1 + 0.02, "metal", ctx.un("laiton"), tremble=0.0)
    # Poignées de fer sur les flancs.
    for sx in (-1, 1):
        xa, xb = sorted((sx * (w / 2 - 0.02), sx * (w / 2 + 0.02)))
        boite(s, xa, xb, 0.3, 0.33, -0.07, 0.07, "metal", fer, tremble=0.0)


def _banc(s, ctx):
    fonte = ctx.un("peint_vert")
    bois = ctx.tons("bois_clair")
    for sx in (-1, 1):
        x = sx * 0.72
        boite(s, x - 0.03, x + 0.03, 0, 0.38, 0.12, 0.18, "metal", fonte, tremble=0.0)
        boite(s, x - 0.03, x + 0.03, 0, 0.38, -0.24, -0.18, "metal", fonte, tremble=0.0)
        boite(s, x - 0.032, x + 0.032, 0.379, 0.42, -0.245, 0.2, "metal", fonte, tremble=0.0)
        # Montant du dossier, penché vers l'arrière; accoudoir.
        a = 0.2
        s.box(0.06, 0.48, 0.05, at(x, 0.64, -0.26, 0, -a), "metal", fonte, tremble=0.0, sans="")
        boite(s, x - 0.03, x + 0.03, 0.6, 0.64, -0.2, 0.19, "metal", fonte, tremble=0.0)
        boite(s, x - 0.025, x + 0.025, 0.451, 0.601, 0.15, 0.19, "metal", fonte, tremble=0.0)
    # Lattes de l'assise (dessus à 45 cm, bord avant à 21 cm), posées sur les traverses de fonte;
    # le montant de l'accoudoir se pose sur la latte de devant.
    for k in range(4):
        z = -0.21 + k * 0.105
        boite(s, -0.85, 0.85, 0.4205, 0.45, z, z + 0.09, "bois", bois[k % len(bois)], tremble=0.0)
    for k in range(3):
        y = 0.52 + k * 0.12
        # Devant les montants du dossier (ils les portent), au fil de leur pente.
        zz = -0.26 - (y + 0.0425 - 0.64) * math.tan(0.2)
        boite(s, -0.85, 0.85, y, y + 0.085, zz + 0.026, zz + 0.05, "bois", bois[(k + 1) % len(bois)], tremble=0.0)


def _baignoire(s, ctx):
    email = ctx.un("email")
    blanc = ctx.un("creme")
    laiton = ctx.un("laiton")
    cuve(s,
         [(0.68, 0.3, 0.26, 0.12), (0.74, 0.35, 0.3, 0.48), (0.75, 0.36, 0.3, 0.56)],
         [(0.7, 0.31, 0.27, 0.56), (0.64, 0.26, 0.23, 0.32), (0.6, 0.23, 0.21, 0.2)],
         "metal", email, blanc)
    # Pieds de fonte (griffes), sous le ventre.
    for sx in (-1, 1):
        for sz in (-1, 1):
            s.tube([(sx * 0.52, 0.0, sz * 0.2, 0.05), (sx * 0.53, 0.06, sz * 0.21, 0.035), (sx * 0.52, 0.14, sz * 0.2, 0.045)], 6, "metal", ctx.un("fer"), bouts=(True, True))
    # Bonde et sa chaînette, au pied du robinet (bout ouest).
    colonne(s, -0.48, 0.0, 0.2, 0.206, 0.035, 8, "metal", laiton, dessus=ctx.un("fond"))
    s.tube([(-0.48, 0.205, -0.012, 0.006), (-0.48, 0.225, 0.0, 0.006), (-0.48, 0.205, 0.012, 0.006)], 4, "metal", laiton, bouts=(True, True))
    # Robinet: un col de cygne de laiton posé sur la lèvre, bec au-dessus de la bonde, qui verse
    # vers le bas; deux croisillons, rouge (chaude) et bleu (froide).
    s.tube([(-0.72, 0.55, 0.0, 0.022), (-0.72, 0.74, 0.0, 0.02), (-0.66, 0.79, 0.0, 0.018), (-0.58, 0.76, 0.0, 0.017), (-0.555, 0.69, 0.0, 0.016)], 6, "metal", laiton, bouts=(True, True), coupe=ctx.un("fond"))
    for sz, c in ((-1, "peint_bleu"), (1, "feu_rouge")):
        barre(s, (-0.72, 0.62, 0.0), (-0.72, 0.62, sz * 0.09), 0.012, 5, "metal", laiton)
        s.octa(0.03, 0.012, 0.03, at(-0.72, 0.645, sz * 0.09), "metal", ctx.un(c), dessus=ctx.un(c))
        barre(s, (-0.72, 0.62, sz * 0.09), (-0.72, 0.64, sz * 0.09), 0.01, 4, "metal", laiton)


def _barriere(s, ctx):
    bois = ctx.tons("bois_grise")
    for x in (-0.5, 0.5):
        boite(s, x - 0.05, x + 0.05, 0, 1.1, -0.05, 0.05, "bois", bois[0], dessus=ctx.un("bois_coupe"))
    for k, y in enumerate((0.3, 0.62, 0.94)):
        boite(s, -1.0, 1.0, y, y + 0.1, 0.05, 0.085, "bois", bois[(k + 1) % len(bois)], tremble=0.0)


def _poteau_quai(s, ctx):
    fonte = ctx.un("peint_vert")
    for sx in (-1, 1):
        x = sx * 0.4
        colonne(s, x, 0, 0, 0.12, 0.07, 8, "metal", fonte)
        colonne(s, x, 0, 0.12, 2.68, 0.04, 8, "metal", fonte, r1=0.032)
        s.octa(0.05, 0.07, 0.05, at(x, 2.72, 0), "metal", fonte)
    # Plaque émaillée du nom de la halte: fond crème, filet et bord bleus.
    # Plaque fixée devant les colonnettes (elle ne les traverse pas), émaillée des deux faces.
    boite(s, -0.49, 0.49, 2.22, 2.62, 0.037, 0.097, "metal", ctx.un("peint_bleu"), tremble=0.0)
    for z in (0.097, 0.037):
        sgn = 1 if z > 0 else -1
        v = [(-0.44, 2.27, z + sgn * 0.002), (0.44, 2.27, z + sgn * 0.002), (0.44, 2.57, z + sgn * 0.002), (-0.44, 2.57, z + sgn * 0.002)]
        s.morceau(v, [(0, 1, 2, 3)], "metal", ctx.un("email"), coeur=(0, 2.4, z - sgn))
        v = [(-0.36, 2.38, z + sgn * 0.003), (0.36, 2.38, z + sgn * 0.003), (0.36, 2.46, z + sgn * 0.003), (-0.36, 2.46, z + sgn * 0.003)]

        s.morceau(v, [(0, 1, 2, 3)], "metal", ctx.un("ardoise"), coeur=(0, 2.4, z - sgn))


def _pompe(s, ctx):
    pierre = ctx.tons("pierre")
    fonte = ctx.un("fer")
    fonte_c = ctx.un("fer", 1)
    # Auge de pierre devant la pompe: fond, quatre bords, l'eau au ras du fond.
    z0, z1, x0 = 0.02, 0.46, 0.4
    boite(s, -x0, x0, 0, 0.22, z0, z1, "pierre", pierre[0], tremble=0.004, dessus=ctx.un("eau_sombre"))
    boite(s, -x0, x0, 0.22, 0.34, z1 - 0.06, z1, "pierre", pierre[1], tremble=0.003, dessus=ctx.un("pierre_dessus"))
    boite(s, -x0, x0, 0.22, 0.34, z0, z0 + 0.06, "pierre", pierre[1], tremble=0.003, dessus=ctx.un("pierre_dessus"))
    for sx in (-1, 1):
        boite(s, sx * x0 - 0.06 if sx > 0 else -x0, sx * x0 if sx > 0 else -x0 + 0.06, 0.22, 0.34, z0 + 0.06, z1 - 0.06, "pierre", pierre[2 % len(pierre)], tremble=0.003, dessus=ctx.un("pierre_dessus"))
    # Corps de fonte sur son dé de pierre, derrière l'auge.
    zc = -0.24
    boite(s, -0.16, 0.16, 0, 0.12, zc - 0.16, zc + 0.16, "pierre", pierre[1], dessus=ctx.un("pierre_dessus"))
    s.tube([(0, 0.12, zc, 0.11), (0, 0.2, zc, 0.09), (0, 0.98, zc, 0.075), (0, 1.02, zc, 0.095)], 8, "metal", fonte, bouts=(False, True))
    s.tube([(0, 1.02, zc, 0.085), (0, 1.12, zc, 0.07), (0, 1.17, zc, 0.03)], 8, "metal", fonte_c, bouts=(False, True))
    s.octa(0.035, 0.05, 0.035, at(0, 1.2, zc), "metal", fonte)
    # Bec: sort du corps vers l'auge, se coude et s'ouvre vers le bas, au-dessus de l'eau.
    s.tube([(0, 0.66, zc + 0.03, 0.04), (0, 0.66, 0.06, 0.038), (0, 0.63, 0.15, 0.036), (0, 0.55, 0.19, 0.034), (0, 0.48, 0.195, 0.034)], 7, "metal", fonte, bouts=(True, True), coupe=ctx.un("fond"))
    colonne(s, 0, zc, 0.6, 0.72, 0.09, 8, "metal", fonte_c)
    # Bras de levier: chape derrière la tête, bras qui descend vers l'arrière, poignée.
    for sx in (-1, 1):
        boite(s, sx * 0.032 - 0.01, sx * 0.032 + 0.01, 0.95, 1.06, zc - 0.13, zc - 0.06, "metal", fonte_c, tremble=0.0)
    s.tube([(0, 1.02, -0.31, 0.02), (0, 1.03, -0.37, 0.02), (0, 0.98, -0.43, 0.018), (0, 0.9, -0.46, 0.017)], 6, "metal", fonte, bouts=(True, True))
    s.tube([(0, 0.91, -0.46, 0.022), (0, 0.82, -0.466, 0.022)], 6, "bois", ctx.un("bois_meuble"), bouts=(True, True))


def _paroi_train(s, ctx, sorte):
    """Paroi de voiture (1 m), de 14 cm, au bord de sa case (z de 0,36 à 0,5), face intérieure à +z:
    soubassement de teck, lisse, haut crème, corniche; rien ne dépasse z = 0,5."""
    teck = ctx.tons("livree_teck")
    z0, z1 = 0.36, 0.47
    # Trois blocs empilés (1 mm de joint): soubassement de teck, haut crème, corniche.
    boite(s, -0.5, 0.5, 0, 0.9, z0, z1 + 0.012, "bois", teck[0], tremble=0.0)
    boite(s, -0.5, 0.5, 0.901, 0.959, z0, z1 + 0.022, "bois", teck[1], tremble=0.0)
    boite(s, -0.5, 0.5, 0.96, 1.999, z0, z1, "bois", ctx.un("livree_creme"), tremble=0.0)
    boite(s, -0.5, 0.5, 2.0, 2.15, z0, z1 + 0.025, "bois", teck[1], tremble=0.0)
    for x in (-0.25, 0.25):
        boite(s, x - 0.18, x + 0.18, 0.12, 0.78, z1 + 0.011, z1 + 0.02, "bois", teck[1], tremble=0.0)
    if sorte == "fenetre":
        # Fenêtre: cadre de teck, glace de nuit (on ne voit pas dehors), deux reflets; embrasses.
        boite(s, -0.4, 0.4, 1.0, 1.08, z1, z1 + 0.028, "bois", teck[1], tremble=0.0)
        boite(s, -0.4, 0.4, 1.74, 1.8, z1, z1 + 0.022, "bois", teck[1], tremble=0.0)
        for x in (-0.4, 0.34):
            boite(s, x, x + 0.06, 1.08, 1.74, z1, z1 + 0.022, "bois", teck[1], tremble=0.0)
        nuit = ctx.tons("nuit")
        glace_reflet(s, -0.343, 0.343, 1.077, 1.743, z1 + 0.006, nuit[0], nuit[1], bandes=((-0.2, -0.12), (0.0, 0.03)))

        for sx in (-1, 1):
            s.tube([(sx * 0.455, 1.05, z1 + 0.004, 0.024), (sx * 0.45, 1.4, z1 + 0.004, 0.02), (sx * 0.445, 1.78, z1 + 0.004, 0.024)], 6, "etoffe", ctx.un("velours"), bouts=(True, True))
    elif sorte == "plan":
        # Plan de la ligne sous verre: cadre, papier, la ligne et ses haltes.
        boite(s, -0.34, 0.34, 1.12, 1.62, z1, z1 + 0.02, "bois", teck[1], tremble=0.0)
        plaque(s, -0.3, 0.3, 1.16, 1.58, z1 + 0.021, "etoffe", ctx.un("papier"))
        pts = [(-0.25, 1.3), (-0.12, 1.42), (0.02, 1.36), (0.14, 1.47), (0.25, 1.4)]
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            a = math.atan2(yb - ya, xb - xa)
            lg = math.hypot(xb - xa, yb - ya)
            s.box(lg + 0.012, 0.012, 0.004, at((xa + xb) / 2, (ya + yb) / 2, z1 + 0.024, 0, 0, a), "etoffe", ctx.un("feu_rouge"), tremble=0.0, sans="z-")
        for x, y in pts:
            s.box(0.026, 0.026, 0.005, at(x, y, z1 + 0.025), "etoffe", ctx.un("ardoise"), tremble=0.0, sans="z-")


def _porte_train(s, ctx):
    teck = ctx.tons("livree_teck")
    z0, z1 = 0.354, 0.47
    boite(s, -0.5, -0.4, 0, 2.15, z0, z1, "bois", ctx.un("bois_sombre"), tremble=0.0)
    boite(s, 0.4, 0.5, 0, 2.15, z0, z1, "bois", ctx.un("bois_sombre"), tremble=0.0)
    boite(s, -0.4, 0.4, 2.0, 2.15, z0, z1, "bois", ctx.un("bois_sombre"), tremble=0.0)
    boite(s, -0.399, 0.399, 0.0, 1.999, z0 + 0.04, z1 - 0.02, "bois", teck[0], tremble=0.0)

    boite(s, -0.3, 0.3, 0.15, 0.9, z1 - 0.021, z1 - 0.005, "bois", teck[1], tremble=0.0)
    boite(s, -0.3, 0.3, 1.15, 1.75, z1 - 0.021, z1, "bois", teck[1], tremble=0.0)
    glace_reflet(s, -0.24, 0.24, 1.2, 1.7, z1 + 0.001, ctx.un("nuit"), ctx.tons("nuit")[1], bandes=((-0.15, -0.08),))
    barre(s, (0.3, 1.0, z1 - 0.02), (0.3, 1.0, z1 + 0.012), 0.01, 4, "metal", ctx.un("laiton"))
    barre(s, (0.24, 1.0, z1 + 0.017), (0.33, 1.0, z1 + 0.017), 0.011, 5, "metal", ctx.un("laiton"))



def _applique(s, ctx):
    laiton = ctx.un("laiton")
    boite(s, -0.045, 0.045, 1.46, 1.66, -0.089, -0.075, "metal", laiton, tremble=0.0)
    s.tube([(0, 1.56, -0.08, 0.012), (0, 1.56, -0.02, 0.012), (0, 1.53, 0.01, 0.012)], 5, "metal", laiton, bouts=(True, True))
    # Tulipe de verre dépoli: elle luit quand on allume (`flamme`).
    s.tube([(0, 1.46, 0.01, 0.02), (0, 1.5, 0.01, 0.05), (0, 1.58, 0.01, 0.07), (0, 1.62, 0.01, 0.055)], 8, "flamme", ctx.un("verre_lampe"), bouts=(True, True))
    colonne(s, 0, 0.01, 1.52, 1.535, 0.03, 6, "metal", laiton)


def _porte_bagages(s, ctx, vide):
    laiton = ctx.un("laiton")
    fer = ctx.un("fer")
    for x in (-1.15, 1.15):
        boite(s, x - 0.02, x + 0.02, 1.72, 2.02, -0.2, -0.185, "metal", fer, tremble=0.0)
        s.box(0.03, 0.03, 0.4, at(x, 1.74, -0.0), "metal", fer, tremble=0.0, sans="")
        barre(s, (x, 1.75, 0.17), (x, 1.98, -0.185), 0.012, 4, "metal", fer)
    for z in (-0.15, -0.05, 0.05, 0.15):
        barre(s, (-1.3, 1.76, z), (1.3, 1.76, z), 0.01, 4, "metal", laiton)
    barre(s, (-1.3, 1.77, 0.18), (1.3, 1.77, 0.18), 0.014, 5, "metal", laiton)
    if not vide:
        # Deux valises posées à plat: une rouge sangle de cuir, une bleu-vert.
        for x, w, c in ((-0.55, 0.62, "peint_rouge"), (0.35, 0.5, "peint_volet")):
            boite(s, x - w / 2, x + w / 2, 1.773, 1.95, -0.16, 0.14, "etoffe", ctx.un(c), dessus=ton(ctx.un(c), 1.1), tremble=0.0)
            # Sangles de cuir posées sur le dessus et le devant; poignée.
            for dx in (-w / 4, w / 4):
                boite(s, x + dx - 0.02, x + dx + 0.02, 1.95, 1.955, -0.16, 0.14, "etoffe", ctx.un("cuir"), tremble=0.0)
                boite(s, x + dx - 0.02, x + dx + 0.02, 1.773, 1.955, 0.14, 0.145, "etoffe", ctx.un("cuir"), tremble=0.0)
            s.box(0.12, 0.02, 0.03, at(x, 1.965, -0.01), "etoffe", ctx.un("cuir"), tremble=0.0, sans="")



def _tablette(s, ctx):
    teck = ctx.tons("livree_teck")
    boite(s, -0.225, 0.225, 0.72, 0.75, -0.275, 0.275, "bois", teck[1], dessus=ctx.un("bois_clair"), tremble=0.002)
    boite(s, -0.15, 0.15, 0.55, 0.72, -0.275, -0.25, "bois", teck[0], tremble=0.0)
    s.tube([(0, 0.0, 0.12, 0.08), (0, 0.03, 0.12, 0.06), (0, 0.05, 0.12, 0.025), (0, 0.72, 0.12, 0.022)], 6, "metal", ctx.un("fer"), bouts=(False, True))


def _banquette_train(s, ctx):
    teck = ctx.tons("livree_teck")
    velours = ctx.tons("velours")
    # Rien ne dépasse z = -0,32 derrière (la banquette est adossée à une paroi ou à une couchette)
    # ni les bords de sa case: tremblé nul sur le pourtour.
    boite(s, -0.48, 0.48, 0, 0.3, -0.3, 0.29, "bois", teck[0], tremble=0.0)
    boite(s, -0.46, 0.46, 0.3, 0.45, -0.24, 0.325, "etoffe", velours[0], dessus=velours[1], tremble=0.0)
    a = 0.14
    s.box(0.92, 0.72, 0.12, at(0, 0.8, -0.2, 0, -a), "etoffe", velours[0], tremble=0.0, sans="")
    # Appui-tête: un boudin posé sur le haut du dossier (à moitié dedans), moins large que lui.
    s.tube([(-0.44, 1.16, -0.25, 0.055), (0.44, 1.16, -0.25, 0.055)], 8, "etoffe", velours[1], bouts=(True, True))
    for sx in (-1, 1):
        boite(s, sx * 0.48 - 0.025 if sx > 0 else -0.5, sx * 0.48 + 0.02 if sx > 0 else -0.455, 0, 0.62, -0.315, 0.3, "bois", teck[1], dessus=ctx.un("bois_clair"), tremble=0.0)


def _couchette(s, ctx):
    teck = ctx.tons("livree_teck")
    boite(s, -0.48, 0.48, 0, 0.36, -0.96, 0.96, "bois", teck[0], tremble=0.0)
    boite(s, -0.5, 0.5, 0, 1.15, -1.0, -0.96, "bois", teck[1], dessus=ctx.un("bois_clair"), tremble=0.0)
    boite(s, -0.5, 0.5, 0, 0.7, 0.96, 1.0, "bois", teck[1], dessus=ctx.un("bois_clair"), tremble=0.0)

    boite(s, -0.46, 0.46, 0.361, 0.48, -0.959, 0.959, "etoffe", ctx.un("creme"), tremble=0.0)
    s.box(0.6, 0.1, 0.3, at(0, 0.52, -0.75), "etoffe", ctx.un("creme"), tremble=0.008, sans="")
    # Couverture pliée sur le pied: elle va jusqu'au panneau du pied (le matelas finit dessous).
    couverture = ctx.un("peint_volet")
    boite(s, -0.47, 0.47, 0.3, 0.505, -0.2, 0.97, "etoffe", couverture, dessus=ton(couverture, 1.1), tremble=0.0)
    boite(s, -0.455, 0.455, 0.42, 0.51, -0.25, -0.2, "etoffe", ton(couverture, 0.8), tremble=0.0)
    boite(s, -0.46, 0.46, 0.49, 0.515, 0.35, 0.38, "etoffe", ton(couverture, 0.8), tremble=0.0)


# ---------------------------------------------------------------------- famille
def _un_meuble(sorte: str, entree: dict, ctx, vide: bool):
    s = Atelier(entree["graine"])
    notice: dict = {}
    if sorte == "lit":
        _lit(s, ctx, entree["largeur"], entree["places"])
        notice["bed"] = {"height": 0.5, "places": entree["places"]}
    elif sorte == "chaise":
        _chaise(s, ctx)
        notice["seat"] = {"height": 0.45, "front": 0.21}
    elif sorte == "table":
        _table(s, ctx, 1.4, 0.8, 0.75, epaisseur=0.05, plateau="bois_clair")
        notice["top"] = 0.75
    elif sorte == "armoire":
        _armoire(s, ctx)
    elif sorte == "coffre":
        _coffre(s, ctx)
    elif sorte == "banc":
        _banc(s, ctx)
        notice["seat"] = {"height": 0.45, "front": 0.21}
    elif sorte == "baignoire":
        _baignoire(s, ctx)
    elif sorte == "barriere":
        _barriere(s, ctx)
    elif sorte == "poteau-quai":
        _poteau_quai(s, ctx)
    elif sorte == "pompe":
        _pompe(s, ctx)
        notice["top"] = 0.34
    elif sorte in ("paroi", "paroi-fenetre", "paroi-plan"):
        _paroi_train(s, ctx, {"paroi": "", "paroi-fenetre": "fenetre", "paroi-plan": "plan"}[sorte])
    elif sorte == "angle-caisse":
        boite(s, 0.36, 0.5, 0, 2.15, 0.36, 0.5, "bois", ctx.un("bois_sombre"), tremble=0.0)
        boite(s, 0.355, 0.5, 2.0, 2.15, 0.355, 0.5, "bois", ctx.un("livree_teck", 1), tremble=0.0)
    elif sorte == "porte-train":
        _porte_train(s, ctx)
    elif sorte == "applique":
        _applique(s, ctx)
    elif sorte == "porte-bagages":
        _porte_bagages(s, ctx, entree.get("vide", False))
    elif sorte == "tablette":
        _tablette(s, ctx)
        notice["top"] = 0.75
    elif sorte == "banquette-train":
        _banquette_train(s, ctx)
        notice["seat"] = {"height": 0.45, "front": 0.325}
    elif sorte == "couchette":
        _couchette(s, ctx)
        notice["bed"] = {"height": 0.48, "places": 1}
    else:
        raise SystemExit(f"{entree['id']}: sorte de mobilier inconnue « {sorte} »")
    return s, notice


def mobilier(entree: dict, ctx) -> list[dict]:
    s, notice = _un_meuble(entree["sorte"], entree, ctx, False)
    return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"), **notice)]


FAMILLES_MOBILIER = {"mobilier": mobilier}
