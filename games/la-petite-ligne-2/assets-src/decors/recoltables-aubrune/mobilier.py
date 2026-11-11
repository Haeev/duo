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
from formes import Atelier, at, entre, penche, ton


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


# ---------------------------------------------------------------------- volumes de révolution
def revolution(s: Atelier, profil, pans, mat, couleurs, haut=None, bas=None, phase=0.5, cercles=(), cercle_mat="metal", cercle_couleur=None, saillie=0.011):
    """Volume fermé autour de l'axe y: `profil` = [(y, rayon)] de bas en haut. `couleurs`: une par
    pan (douelles), répétée sur la hauteur; `haut`, `bas`: teinte des fonds (None: pas de fond).
    `phase` 0,5: un milieu de pan face à +z (une bonde, une marque y tombent à plat).

    `cercles` = [(y0, y1)]: cercles de fer en saillie de `saillie`, faits dans le même volume (mêmes
    sommets, matériau `cercle_mat`): un cercle posé à part serait traversé par les arêtes du fût."""
    ys = [p[0] for p in profil]
    rs = [p[1] for p in profil]

    def rayon(y):
        return float(np.interp(y, ys, rs))

    # Profil complet: (y, rayon, le tronçon au-dessus est-il un cercle). Sans cercle, le profil tel
    # quel (il peut avoir des marches: deux rayons à la même hauteur, une roue et son boudin).
    points = sorted({y for y in ys} | {y for c in cercles for y in c}) if cercles else []
    anneaux = [] if cercles else [(y, r, False) for y, r in profil]
    for y in points:
        dans = [c for c in cercles if c[0] - 1e-9 <= y <= c[1] + 1e-9]
        debut_c = any(abs(c[0] - y) < 1e-9 for c in cercles)
        fin_c = any(abs(c[1] - y) < 1e-9 for c in cercles)
        r = rayon(y)
        if debut_c:
            anneaux += [(y, r, False), (y, r + saillie, True)]
        elif fin_c:
            anneaux += [(y, r + saillie, False), (y, r, False)]
        else:
            anneaux.append((y, r, bool(dans)))
    v, faces, vers, teintes, mats = [], [], [], [], []
    angles = [(k + phase) / pans * math.tau for k in range(pans)]
    for y, r, _ in anneaux:
        v.extend((math.cos(a) * r, y, math.sin(a) * r) for a in angles)
    for i in range(len(anneaux) - 1):
        (ya, ra, cercle), (yb, rb, _) = anneaux[i], anneaux[i + 1]
        dy, dr = yb - ya, rb - ra
        for k in range(pans):
            j = (k + 1) % pans
            faces.append((i * pans + k, i * pans + j, (i + 1) * pans + j, (i + 1) * pans + k))
            a = (k + 0.5 + phase) / pans * math.tau
            # Normale du dehors dans le plan du profil: (dy, -dr) en (rayon, y).
            vers.append(np.array((math.cos(a) * dy, -dr, math.sin(a) * dy)))
            fer = cercle or (bool(cercles) and dy == 0 and max(ra, rb) > rayon(ya) + saillie / 2)
            teintes.append(cercle_couleur if fer else couleurs[k % len(couleurs)])
            mats.append(cercle_mat if fer else mat)
    for rang, c, signe in ((len(anneaux) - 1, haut, 1.0), (0, bas, -1.0)):
        if c is not None:
            faces.append(tuple(rang * pans + k for k in range(pans)))
            vers.append(np.array((0.0, signe, 0.0)))
            teintes.append(c)
            mats.append(mat)
    faces = orientees(v, faces, vers)
    premier = True
    for m in dict.fromkeys(mats):
        choisies = [i for i, x in enumerate(mats) if x == m]
        if not premier:
            s.morceaux -= 1
        s.morceau(v, [faces[i] for i in choisies], m, [teintes[i] for i in choisies], garde=True)
        premier = False


def bloc_arc(s: Atelier, a0, a1, r_in, r_out, y0, y1, mat, couleur, dedans=None, dessus=None, segments=2, tremble=0.0):
    """Pierre taillée en arc de cercle autour de l'axe y (margelle): fermée de partout."""
    v, faces, vers, teintes = [], [], [], []
    n = segments + 1
    angles = [a0 + (a1 - a0) * k / segments for k in range(n)]
    for y, r in ((y0, r_out), (y1, r_out), (y1, r_in), (y0, r_in)):
        v.extend((math.cos(a) * r, y, math.sin(a) * r) for a in angles)
    for k in range(segments):
        am = (angles[k] + angles[k + 1]) / 2
        radial = np.array((math.cos(am), 0.0, math.sin(am)))
        for c, (b0, b1) in enumerate(((0, 1), (1, 2), (2, 3), (3, 0))):
            faces.append((b0 * n + k, b0 * n + k + 1, b1 * n + k + 1, b1 * n + k))
            vers.append([radial, np.array((0.0, 1.0, 0.0)), -radial, np.array((0.0, -1.0, 0.0))][c])
            teintes.append([couleur, dessus or couleur, dedans or couleur, couleur][c])
    for k, signe in ((0, -1.0), (segments, 1.0)):
        a = angles[k]
        faces.append((k, n + k, 2 * n + k, 3 * n + k))
        vers.append(np.array((-math.sin(a), 0.0, math.cos(a))) * signe)
        teintes.append(couleur)
    s.morceau(v, orientees(v, faces, vers), mat, teintes, garde=True, tremble=tremble)


def rondin_z(s: Atelier, x, y, z0, z1, r, pans, ecorce, bout, mat="bois", phase=0.0, coeur=None):
    """Bûche couchée le long de z, bouts en bois de coupe, celui de devant (+z) cerclé d'écorce (le
    liseré sombre du bout dit « bûche » de loin), le coeur plus foncé. `phase` (en pans): rotation de la section;
    0 met un pan à plat dessous (elle repose sur le sol)."""
    v, faces, vers, teintes = [], [], [], []
    angles = [(k + 0.5 + phase) / pans * math.tau - math.pi / 2 for k in range(pans)]
    for z in (z0, z1):
        v.extend((x + math.cos(a) * r, y + math.sin(a) * r, z) for a in angles)
    for k in range(pans):
        j = (k + 1) % pans
        a = (k + 1 + phase) / pans * math.tau - math.pi / 2
        faces.append((k, j, pans + j, pans + k))
        vers.append(np.array((math.cos(a), math.sin(a), 0.0)))
        teintes.append(ecorce)
    for rang, z, signe in ((0, z0, -1.0), (1, z1, 1.0)):
        # Liseré d'écorce sur le bout de devant seul (celui que la caméra du jeu voit).
        base = rang * pans
        if signe > 0:
            base = len(v)
            v.extend((x + math.cos(a) * r * 0.8, y + math.sin(a) * r * 0.8, z) for a in angles)
            for k in range(pans):
                j = (k + 1) % pans
                faces.append((rang * pans + k, rang * pans + j, base + j, base + k))
                vers.append(np.array((0.0, 0.0, signe)))
                teintes.append(ton(ecorce, 0.8))
        faces.append(tuple(base + k for k in range(pans)))
        vers.append(np.array((0.0, 0.0, signe)))
        teintes.append(bout)
        if coeur is not None:
            c = len(v)
            v.extend((x + math.cos(a) * r * 0.16, y + math.sin(a) * r * 0.16, z + signe * 0.0008) for a in angles[::2])
            faces.append(tuple(range(c, c + len(angles[::2]))))
            vers.append(np.array((0.0, 0.0, signe)))
            teintes.append(coeur)
    s.morceau(v, orientees(v, faces, vers), mat, teintes, garde=True)


# ---------------------------------------------------------------------- meubles du bourg
def _abreuvoir(s, ctx):
    """Abreuvoir de pierre: une auge massive d'un seul bloc creusé (lèvre à 85 cm, à hauteur de
    mufle) sur deux dés bas, l'eau à 11 cm sous la lèvre; derrière, la borne de pierre et sa
    goulotte de fer qui la remplit (sans elle, d'où viendrait l'eau ?). Tient dans sa case."""
    pierre = ctx.tons("pierre")
    for sx in (-1, 1):
        boite(s, sx * 0.3 - 0.15, sx * 0.3 + 0.15, 0, 0.2, -0.27, 0.27, "pierre", pierre[1], tremble=0.004, dessus=ctx.un("pierre_dessus"))
    cuve(s,
         [(0.45, 0.285, 0.05, 0.19), (0.475, 0.305, 0.055, 0.8), (0.48, 0.31, 0.055, 0.85)],
         [(0.4, 0.235, 0.045, 0.85), (0.385, 0.22, 0.04, 0.74)],
         "pierre", pierre[0], ton(pierre[2], 0.86), fond=ctx.un("eau_sombre"))
    # Borne-fontaine au nord, contre l'auge: pilier, chapeau, goulotte coudée au-dessus de l'eau.
    boite(s, -0.09, 0.09, 0, 1.1, -0.48, -0.318, "pierre", pierre[2 % len(pierre)], tremble=0.003)
    boite(s, -0.115, 0.115, 1.098, 1.17, -0.495, -0.3, "pierre", pierre[1], tremble=0.003, sans="", dessus=ctx.un("pierre_dessus"))
    fer = ctx.un("fer")
    s.tube([(0, 0.98, -0.4, 0.022), (0, 0.98, -0.24, 0.022), (0, 0.955, -0.17, 0.021), (0, 0.9, -0.145, 0.02)], 6, "metal", fer, bouts=(True, True), coupe=ctx.un("noir"))
    # Le filet d'eau, de la bouche de la goulotte à l'eau de l'auge (il y entre).
    s.tube([(0, 0.905, -0.145, 0.009), (0, 0.82, -0.143, 0.008), (0, 0.735, -0.14, 0.009)], 5, "vitre", ctx.un("glace"), bouts=(True, True))


def _banc_ferme(s, ctx):
    """Banc de ferme sans dossier: deux planches épaisses (dessus à 45 cm, bord avant à 17 cm) sur
    quatre pieds écartés dont les tenons affleurent le dessus, et leurs entretoises."""
    bois = ctx.tons("bois_meuble")
    for k, (za, zb) in enumerate(((-0.17, -0.0015), (0.0015, 0.17))):
        boite(s, -0.93, 0.93, 0.39, 0.45, za, zb, "bois", bois[k], tremble=0.0, sans="", dessus=ctx.un("bois_clair", 2 - k))
    for sx in (-1, 1):
        for sz in (-1, 1):
            barre(s, (sx * 0.8, 0, sz * 0.15), (sx * 0.71, 0.425, sz * 0.105), 0.03, 6, "bois", bois[1], bouts=(True, True), coupe=ctx.un("bois_coupe"))
            # Tenon traversant: son bout de bois et son coin affleurent le dessus du plateau.
            x, z = sx * 0.706, sz * 0.103
            s.morceau([(x - 0.026, 0.4512, z - 0.022), (x + 0.026, 0.4512, z - 0.022), (x + 0.026, 0.4512, z + 0.022), (x - 0.026, 0.4512, z + 0.022)], [(0, 1, 2, 3)], "bois", ctx.un("bois_coupe", 1), coeur=(x, 0.0, z))
            s.morceau([(x - 0.004, 0.4515, z - 0.024), (x + 0.004, 0.4515, z - 0.024), (x + 0.004, 0.4515, z + 0.024), (x - 0.004, 0.4515, z + 0.024)], [(0, 1, 2, 3)], "bois", ctx.un("bois_sombre"), coeur=(x, 0.0, z))
        # Entretoise de bout (dans les deux pieds), à 15 cm du sol.
        y = 0.15
        x = sx * (0.8 - 0.09 * y / 0.425)
        zz = 0.15 - 0.045 * y / 0.425
        barre(s, (x, y, -zz), (x, y, zz), 0.02, 5, "bois", bois[2 % len(bois)])
    # Entretoise longue, d'une entretoise de bout à l'autre.
    barre(s, (-0.784, 0.17, 0.0), (0.784, 0.17, 0.0), 0.018, 5, "bois", bois[1])


def _caisse(s, ctx):
    """Caisse à claire-voie (0,7 x 0,5, couvercle à 60 cm): lattes jointives par trois, tasseaux
    d'angle, couvercle de trois planches; l'intérieur sombre se voit entre les lattes. Marque au
    pochoir sur le devant."""
    clair = ctx.tons("bois_clair")
    coeur = ton(ctx.un("bois_sombre"), 0.62)
    boite(s, -0.33, 0.33, 0, 0.578, -0.23, 0.23, "bois", coeur, tremble=0.0)
    for k, (y0, y1) in enumerate(((0.02, 0.18), (0.21, 0.37), (0.4, 0.556))):
        for sz in (-1, 1):
            za, zb = sorted((sz * 0.2312, sz * 0.2492))
            boite(s, -0.33, 0.33, y0, y1, za, zb, "bois", clair[(k + (sz > 0)) % len(clair)], tremble=0.0, sans="")
        for sx in (-1, 1):
            xa, xb = sorted((sx * 0.3312, sx * 0.3492))
            boite(s, xa, xb, y0, y1, -0.23, 0.23, "bois", clair[(k + 2 + (sx > 0)) % len(clair)], tremble=0.0, sans="")
    for sx in (-1, 1):
        for sz in (-1, 1):
            boite(s, sx * 0.338 - 0.022, sx * 0.338 + 0.022, 0, 0.58, sz * 0.238 - 0.022, sz * 0.238 + 0.022, "bois", ctx.un("bois_meuble", sx + sz), tremble=0.0, dessus=ctx.un("bois_coupe"))
    # Tasseaux du haut et du bas, cloués par-dessus les lattes devant et derrière, entre les montants.
    for sz in (-1, 1):
        za, zb = sorted((sz * 0.2496, sz * 0.2616))
        for y0, y1 in ((0.02, 0.085), (0.49, 0.556)):
            boite(s, -0.314, 0.314, y0, y1, za, zb, "bois", ctx.un("bois_meuble", 1), tremble=0.0, sans="")
    for k in range(3):
        z0 = -0.27 + k * 0.183
        boite(s, -0.37, 0.37, 0.581, 0.6, z0, z0 + 0.169, "bois", clair[(k + 1) % len(clair)], tremble=0.0, sans="")
    # Marque au pochoir: un losange et deux traits, peints sur la latte du milieu.
    encre = ctx.un("fond")
    s.morceau([(-0.2, 0.29, 0.2502), (-0.14, 0.33, 0.2502), (-0.08, 0.29, 0.2502), (-0.14, 0.25, 0.2502)], [(0, 1, 2, 3)], "etoffe", encre, coeur=(-0.14, 0.29, 0.0))
    for y in (0.27, 0.31):
        s.morceau([(-0.03, y - 0.008, 0.2502), (0.2, y - 0.008, 0.2502), (0.2, y + 0.008, 0.2502), (-0.03, y + 0.008, 0.2502)], [(0, 1, 2, 3)], "etoffe", encre, coeur=(0.08, y, 0.0))


def _puits(s, ctx):
    """Puits du bourg (2 x 2 cases): margelle de deux assises de pierre (80 cm, on s'y accoude),
    l'eau sombre au fond; deux montants posés sur la margelle portent un petit toit de tuiles à
    deux pans; entre eux le treuil, sa corde enroulée et sa manivelle à l'est; le seau pend à la
    corde au-dessus de l'eau, prêt à descendre."""
    pierre = ctx.tons("pierre")
    sombre = ton(pierre[0], 0.62)
    n = 8
    joint = 0.012
    for k in range(n):
        a0, a1 = k / n * math.tau + joint, (k + 1) / n * math.tau - joint
        bloc_arc(s, a0, a1, 0.5, 0.72, 0.0, 0.62, "pierre", pierre[k % len(pierre)], dedans=sombre, tremble=0.003)
        b0, b1 = a0 + math.pi / n, a1 + math.pi / n
        bloc_arc(s, b0, b1, 0.48, 0.76, 0.623, 0.8, "pierre", pierre[(k + 1) % len(pierre)], dedans=sombre, dessus=ctx.un("pierre_dessus"), tremble=0.003)
    # L'eau, au fond du puits (le cuvelage descend dessous: on la voit loin sous la margelle).
    eau = [(math.cos(k / 12 * math.tau) * 0.496, 0.12, math.sin(k / 12 * math.tau) * 0.496) for k in range(12)]
    s.morceau(eau, [tuple(range(12))], "pierre", ctx.un("eau_sombre"), coeur=(0, -1, 0))
    # Montants, posés dans la margelle, jusque sous le toit.
    bois = ctx.tons("bois_grise")
    for sx in (-1, 1):
        boite(s, sx * 0.61 - 0.055, sx * 0.61 + 0.055, 0.785, 2.25, -0.055, 0.055, "bois", bois[0], tremble=0.002)
    # Toit à deux pans (faîte le long de x à 2,30 m, égouts à 1,92 m): une dalle d'un seul tenant,
    # rangs de tuiles en bandes de teintes; faîtière posée dessus.
    tuile = ctx.tons("tuile")
    e, zf, ye, yf, xl = 0.07, 0.68, 1.92, 2.3, 0.82
    v, faces, vers, teintes = [], [], [], []

    def pt(x, z, y):
        v.append((x, y, z))
        return len(v) - 1

    rangs = 4
    for sz in (-1, 1):
        pente = (yf - ye) / zf
        nrm = np.array((0.0, 1.0, sz * pente))
        nrm /= np.linalg.norm(nrm)
        for r in range(rangs):
            t0, t1 = r / rangs, (r + 1) / rangs
            za, zb = sz * zf * t0, sz * zf * t1
            ya, yb = yf - (yf - ye) * t0, yf - (yf - ye) * t1
            q = [pt(-xl, za, ya), pt(xl, za, ya), pt(xl, zb, yb), pt(-xl, zb, yb)]
            faces.append(tuple(q))
            vers.append(nrm)
            teintes.append(tuile[(r + (sz > 0)) % 3])
        # Dessous, chant de l'égout, pignons.
        b = [pt(-xl, 0, yf - e), pt(xl, 0, yf - e), pt(xl, sz * zf, ye - e), pt(-xl, sz * zf, ye - e)]
        faces.append(tuple(b))
        vers.append(np.array((0.0, -1.0, -sz * pente)))
        teintes.append(ctx.un("bois_grise", 1))
        h = [pt(-xl, sz * zf, ye), pt(xl, sz * zf, ye), pt(xl, sz * zf, ye - e), pt(-xl, sz * zf, ye - e)]
        faces.append(tuple(h))
        vers.append(np.array((0.0, 0.0, sz)))
        teintes.append(tuile[3])
        for sx in (-1, 1):
            g = [pt(sx * xl, 0, yf), pt(sx * xl, sz * zf, ye), pt(sx * xl, sz * zf, ye - e), pt(sx * xl, 0, yf - e)]
            faces.append(tuple(g))
            vers.append(np.array((sx, 0.0, 0.0)))
            teintes.append(tuile[3])
    s.morceau(v, orientees(v, faces, vers), "tuile", teintes, garde=True)
    barre(s, (-0.8, yf + 0.005, 0), (0.8, yf + 0.005, 0), 0.05, 6, "tuile", tuile[3])
    # Pignons de planches au droit des montants: ils ferment le dessous du toit de côté. Chacun en
    # deux moitiés prises dans le montant (une planche entière le traverserait).
    def sous_toit(z):
        return yf - e - 0.006 - (yf - ye) * abs(z) / zf

    for sx in (-1, 1):
        xa, xb = sorted((sx * 0.59, sx * 0.63))
        for sz in (-1, 1):
            prisme(s, "x", xa, xb, [(sz * 0.62, sous_toit(0.62)), (sz * 0.02, sous_toit(0.62)), (sz * 0.02, sous_toit(0.02))], "bois", bois[2 % len(bois)])
    # Treuil: un tambour entre les montants (ses bouts y sont pris), la corde enroulée au milieu.
    yt = 1.32
    corde = ctx.un("paille", 1)
    # Les spires de la corde: des anneaux alternés, clairs et sombres, sur le tambour.
    spires = 5
    tambour = [(-0.58, yt, 0, 0.075), (-0.2, yt, 0, 0.075)]
    for k in range(spires + 1):
        x = -0.18 + 0.36 * k / spires
        tambour.append((x, yt, 0, 0.092 if k % 2 == 0 else 0.086))
    tambour += [(0.2, yt, 0, 0.075), (0.58, yt, 0, 0.075)]
    pans = 8
    treuil = ctx.un("bois_meuble", 1)
    teintes = [treuil] * (2 * pans) + [c for k in range(spires) for c in [corde if k % 2 == 0 else ton(corde, 0.85)] * pans] + [treuil] * (2 * pans) + [ctx.un("bois_coupe")] * 2
    s.tube(tambour, pans, "bois", teintes, bouts=(True, True))
    # Linteau entre les têtes des montants, sous le faîte: il tient l'écart des montants.
    boite(s, -0.57, 0.57, 2.12, 2.2, -0.045, 0.045, "bois", bois[1], tremble=0.0)
    # Manivelle à l'est: bout d'axe de fer, bras, poignée de bois.
    fer = ctx.un("fer")
    barre(s, (0.64, yt, 0), (0.74, yt, 0), 0.022, 6, "metal", fer)
    barre(s, (0.725, yt, 0), (0.725, yt - 0.2, 0.09), 0.016, 4, "metal", fer)
    barre(s, (0.71, yt - 0.195, 0.088), (0.82, yt - 0.195, 0.088), 0.022, 6, "bois", ctx.un("bois_meuble"))
    # Seau cerclé, pendu à la corde au-dessus de l'eau (son fond sous la margelle).
    yb, hb = 0.74, 0.24
    revolution(s, [(yb, 0.11), (yb + hb, 0.13)], 10, "bois", ctx.tons("bois_meuble"), haut=ctx.un("eau_sombre"), bas=ctx.un("bois_sombre"),
               cercles=((yb + 0.03, yb + 0.055), (yb + hb - 0.075, yb + hb - 0.05)), cercle_couleur=fer)
    # Anse de fer prise dans les douelles au-dessus du cercle haut.
    anse = [(-0.115, yb + hb - 0.025, 0.0, 0.007), (-0.1, yb + hb + 0.06, 0.0, 0.007), (0.0, yb + hb + 0.095, 0.0, 0.007), (0.1, yb + hb + 0.06, 0.0, 0.007), (0.115, yb + hb - 0.025, 0.0, 0.007)]
    s.tube(anse, 4, "metal", fer, bouts=(True, True))
    barre(s, (0.0, yb + hb + 0.099, 0.0), (0.0, yt - 0.082, 0.0), 0.011, 5, "bois", corde)


def _tas_de_buches(s, ctx):
    """Tas de bûches rangé en pyramide (5, 4, 3, 2), bûches couchées le long de z: leurs bouts de
    bois frais regardent l'avant et l'arrière, l'écorce fait les flancs."""
    ecorce = ctx.tons("ecorce_chene") + ctx.tons("bois_mort")[:1]
    coupe = ctx.tons("bois_coupe")
    pas, rc, pans = 0.15, 0.077, 8
    ri = rc * math.cos(math.pi / pans)
    for rang, nombre in enumerate((5, 4, 3, 2)):
        y = ri + rang * pas * math.sqrt(3) / 2
        for k in range(nombre):
            x = (k - (nombre - 1) / 2) * pas
            g = rang * 7 + k
            z0 = -0.4 + penche(g * 1.7, 0.035)
            z1 = 0.4 + penche(g * 2.9, 0.035)
            # Le rang du bas a un pan à plat sur le sol; au-dessus, la section tourne au hasard.
            phase = 0.0 if rang == 0 else entre(0.0, 1.0, g * 3.3)
            rondin_z(s, x, y, z0, z1, rc, pans, ecorce[g % len(ecorce)], coupe[g % len(coupe)], phase=phase, coeur=ton(coupe[g % len(coupe)], 0.82))


def _tonneau(s, ctx):
    """Tonneau debout (85 cm, on pose dessus): douelles de deux tons, ventre, quatre cercles de fer,
    la bonde sur le ventre côté avant, le fond de planches."""
    bois = ctx.tons("bois_meuble")
    profil = [(0.0, 0.25), (0.14, 0.287), (0.425, 0.307), (0.71, 0.287), (0.85, 0.25)]
    pans = 12
    revolution(s, profil, pans, "bois", [bois[0], bois[2 % len(bois)], bois[1]], haut=ctx.un("bois_clair", 1), bas=bois[1],
               cercles=((0.05, 0.1), (0.2, 0.245), (0.605, 0.65), (0.75, 0.8)), cercle_couleur=ctx.un("fer"))
    # Bonde de bois sur le ventre, face à l'avant.
    barre(s, (0, 0.425, 0.27), (0, 0.425, 0.318), 0.032, 6, "bois", ctx.un("bois_sombre"), coupe=ctx.un("bois_coupe"))
    # Fond: deux joints de planches en traits sombres.
    for x in (-0.07, 0.07):
        s.morceau([(x - 0.006, 0.8502, -0.22), (x + 0.006, 0.8502, -0.22), (x + 0.006, 0.8502, 0.22), (x - 0.006, 0.8502, 0.22)], [(0, 1, 2, 3)], "bois", ctx.un("bois_sombre"), coeur=(x, 0.0, 0.0))


def _poutre_x(s: Atelier, xs, demi_y, demi_z, y, z, mat, couleurs, bouts=None):
    """Poutre de section rectangulaire le long de x, d'un seul morceau, coupée en tronçons
    (`xs` croissants), un ton par tronçon (bandes d'une lisse); `bouts`: teinte des deux bouts."""
    v, faces, vers, teintes = [], [], [], []
    coins = [(-demi_y, -demi_z), (demi_y, -demi_z), (demi_y, demi_z), (-demi_y, demi_z)]
    normales = [np.array((0.0, 0.0, -1.0)), np.array((0.0, 1.0, 0.0)), np.array((0.0, 0.0, 1.0)), np.array((0.0, -1.0, 0.0))]
    for x in xs:
        v.extend((x, y + dy, z + dz) for dy, dz in coins)
    for i in range(len(xs) - 1):
        for k in range(4):
            j = (k + 1) % 4
            faces.append((4 * i + k, 4 * i + j, 4 * (i + 1) + j, 4 * (i + 1) + k))
            vers.append(normales[k])
            teintes.append(couleurs[i % len(couleurs)])
    for i, signe in ((0, -1.0), (len(xs) - 1, 1.0)):
        faces.append(tuple(4 * i + k for k in range(4)))
        vers.append(np.array((signe, 0.0, 0.0)))
        teintes.append(bouts if bouts is not None else couleurs[0])
    s.morceau(v, orientees(v, faces, vers), mat, teintes, garde=True)


def _lisse(s, ctx):
    """Lisse de passage à niveau relevable (5 cases le long de x): socle et poteau à l'ouest, sa
    lanterne en haut; la lisse rayée rouge et blanc de 4 m, son contrepoids de fonte derrière le
    pivot, repose baissée dans la fourche à l'est. Le nœud `lisse` tourne autour de z, à son
    pivot: 0 baissée en travers de la route, +80 degrés levée (le bras monte, le contrepoids
    descend à côté du poteau, sans le toucher). Avant (+z): le côté de la route d'où l'on arrive."""
    fer = ctx.tons("fer")
    px, py, zb = -1.95, 1.0, 0.19
    boite(s, px - 0.2, px + 0.2, 0, 0.12, -0.18, 0.18, "pierre", ctx.un("pierre", 1), tremble=0.003, dessus=ctx.un("pierre_dessus"))
    boite(s, px - 0.09, px + 0.09, 0.121, 1.3, -0.09, 0.09, "metal", ctx.un("peint_creme"), tremble=0.0)
    boite(s, px - 0.11, px + 0.11, 1.301, 1.34, -0.11, 0.11, "metal", fer[0], tremble=0.0, sans="")
    barre(s, (px, py, 0.05), (px, py, zb), 0.03, 6, "metal", ctx.un("fer_clair"))
    _lanterne_pn(s, ctx, px, 1.342)
    # Fourche d'appui à l'est: la lisse baissée y repose, entre ses deux dents.
    fx = px + 3.85
    dy = 0.06
    boite(s, fx - 0.07, fx + 0.07, 0, 0.06, zb - 0.09, zb + 0.09, "pierre", ctx.un("pierre", 2), tremble=0.002, dessus=ctx.un("pierre_dessus"))
    boite(s, fx - 0.04, fx + 0.04, 0.061, py - dy - 0.004, zb - 0.065, zb + 0.065, "metal", ctx.un("peint_creme"), tremble=0.0)
    for c in (-1, 1):
        za, zb_ = sorted((zb + c * 0.045, zb + c * 0.065))
        boite(s, fx - 0.03, fx + 0.03, py - dy - 0.003, py + 0.04, za, zb_, "metal", fer[0], tremble=0.0, sans="")
    with s.noeud("lisse", (px, py, zb), axe="z", baissee=0, levee=80):
        rouge, blanc = ctx.un("feu_rouge"), ctx.un("creme")
        xs = [px - 0.3, px] + [px + 0.5 * (k + 1) for k in range(8)]
        _poutre_x(s, xs, dy, 0.04, py, zb, "bois", [fer[1]] + [rouge, blanc] * 4, bouts=blanc)
        boite(s, px - 0.4, px - 0.18, py - 0.12, py + 0.1, zb - 0.07, zb + 0.07, "metal", fer[0], tremble=0.0, sans="")
        # Disque rouge bordé de blanc au milieu de la lisse, tourné vers la route.
        xd = px + 2.0
        barre(s, (xd, py, zb + 0.041), (xd, py, zb + 0.053), 0.13, 12, "metal", blanc)
        barre(s, (xd, py, zb + 0.0535), (xd, py, zb + 0.058), 0.095, 12, "metal", rouge)


def _lanterne_pn(s, ctx, x, y):
    """Lanterne du poteau: verre rouge vers la route (+z) et vers la voie, blanc sur les côtés."""
    fer = ctx.tons("fer")
    c = 0.065
    boite(s, x - c - 0.02, x + c + 0.02, y, y + 0.04, -c - 0.02, c + 0.02, "metal", fer[0], tremble=0.0, sans="")
    v = [(x - c, y + 0.04, -c), (x + c, y + 0.04, -c), (x + c, y + 0.04, c), (x - c, y + 0.04, c)]
    v += [(px, py + 0.16, pz) for px, py, pz in v]
    faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    rouge, verre = ctx.un("feu_rouge"), ctx.un("verre_lampe")
    s.morceau(v, faces, "flamme", [rouge, verre, rouge, verre], coeur=(x, y + 0.12, 0.0))
    for sx in (-1, 1):
        for sz in (-1, 1):
            boite(s, x + sx * c - 0.012, x + sx * c + 0.012, y + 0.04, y + 0.2, sz * c - 0.012, sz * c + 0.012, "metal", fer[1], tremble=0.0, sans="y- y+")
    d = c + 0.05
    pts = [(x - d, y + 0.2, -d), (x + d, y + 0.2, -d), (x + d, y + 0.2, d), (x - d, y + 0.2, d), (x, y + 0.28, 0.0)]
    s.morceau(pts, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (0, 3, 2, 1)], "metal", fer[0], coeur=(x, y + 0.23, 0.0))
    s.octa(0.025, 0.035, 0.025, at(x, y + 0.3, 0.0), "metal", fer[1])


def _pupitre(s, ctx):
    """Pupitre de fanfare: trépied et tige de fer, plateau penché vers l'arrière (on le lit debout,
    de l'avant), rebord où tient le cahier ouvert; deux pages de portées."""
    fer = ctx.tons("fer")
    for k in range(3):
        a = k / 3 * math.tau + math.pi / 2
        barre(s, (math.cos(a) * 0.26, 0, math.sin(a) * 0.26), (math.cos(a) * 0.018, 0.36, math.sin(a) * 0.018), 0.012, 5, "metal", fer[0], bouts=(False, True))
    barre(s, (0, 0.32, 0), (0, 0.41, 0), 0.026, 6, "metal", fer[1])
    # Tige en deux brins coulissants, serrés par la bague à vis (la hauteur se règle).
    barre(s, (0, 0.39, 0), (0, 0.735, 0), 0.011, 6, "metal", fer[0])
    barre(s, (0, 0.745, 0), (0, 1.08, 0), 0.009, 6, "metal", fer[0])
    barre(s, (0, 0.72, 0), (0, 0.76, 0), 0.02, 6, "metal", fer[1])
    s.octa(0.016, 0.016, 0.03, at(0, 0.74, 0.035), "metal", ctx.un("laiton"))
    inc = -0.35
    with s.groupe(at(0, 1.1, 0.0143, 0, inc)):
        boite(s, -0.03, 0.03, -0.06, 0.02, -0.04, -0.0065, "metal", fer[1], tremble=0.0, sans="")
        boite(s, -0.25, 0.25, -0.17, 0.17, -0.006, 0.006, "metal", fer[0], tremble=0.0, sans="")
        boite(s, -0.25, 0.25, -0.19, -0.171, -0.006, 0.05, "metal", fer[0], tremble=0.0, sans="")
        papier = ctx.un("papier")
        encre = ctx.un("fond")
        for x0, x1 in ((-0.22, -0.006), (0.006, 0.22)):
            boite(s, x0, x1, -0.165, 0.15, 0.0065, 0.009, "etoffe", papier, tremble=0.0, sans="z-")
            for portee in range(3):
                for ligne in range(5):
                    yl = 0.11 - portee * 0.09 - ligne * 0.012
                    s.morceau([(x0 + 0.015, yl, 0.0095), (x1 - 0.015, yl, 0.0095), (x1 - 0.015, yl + 0.003, 0.0095), (x0 + 0.015, yl + 0.003, 0.0095)], [(0, 1, 2, 3)], "etoffe", encre, coeur=((x0 + x1) / 2, yl, -1.0))
                for n in range(4):
                    xn = x0 + 0.04 + n * (x1 - x0 - 0.06) / 4
                    yn = 0.11 - portee * 0.09 - 0.012 * ((n * 3 + portee) % 5)
                    s.morceau([(xn - 0.007, yn - 0.004, 0.0098), (xn + 0.007, yn - 0.004, 0.0098), (xn + 0.007, yn + 0.004, 0.0098), (xn - 0.007, yn + 0.004, 0.0098)], [(0, 1, 2, 3)], "etoffe", encre, coeur=(xn, yn, -1.0))


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
    elif sorte == "abreuvoir":
        _abreuvoir(s, ctx)
        notice["top"] = 0.85
    elif sorte == "banc-ferme":
        _banc_ferme(s, ctx)
        notice["seat"] = {"height": 0.45, "front": 0.17}
    elif sorte == "caisse":
        _caisse(s, ctx)
        notice["top"] = 0.6
    elif sorte == "puits":
        _puits(s, ctx)
    elif sorte == "tas-de-buches":
        _tas_de_buches(s, ctx)
    elif sorte == "tonneau":
        _tonneau(s, ctx)
        notice["top"] = 0.85
    elif sorte == "lisse":
        _lisse(s, ctx)
    elif sorte == "pupitre":
        _pupitre(s, ctx)
    else:
        raise SystemExit(f"{entree['id']}: sorte de mobilier inconnue « {sorte} »")
    return s, notice


def mobilier(entree: dict, ctx) -> list[dict]:
    s, notice = _un_meuble(entree["sorte"], entree, ctx, False)
    return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"), **notice)]


FAMILLES_MOBILIER = {"mobilier": mobilier}
