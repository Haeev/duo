"""Trains vus du dehors: l'autorail de nuit (le « 5 h 12 ») et le train du samedi.

Même chaîne que les aménagements (numpy seul, un ton en aplat par morceau, ni dessous ni UV).
Repère: origine au centre du véhicule, au niveau du ballast (y = 0), dans l'axe de la voie; la
longueur court le long de z, l'avant vers +z. Mesures prises sur le rendu de la voie du jeu
(`reglages-tuiles.ts`, `reglages-relief.ts`):
- rails à 0,72 m de l'axe, traverses de 12 cm, rails de 14 cm: le dessus du rail est à 0,26 m,
  les roues s'y posent;
- quai de 12 cm de haut, son bord à 1,5 m de l'axe (plan d'Aubrune): la caisse fait 2,7 m de
  large (15 cm de jeu au bord du quai), les marchepieds s'arrêtent à 1,46 m;
- plancher à 1 m: du quai, deux marches de 29 cm (0,41 et 0,71 m) sous chaque porte.
Portes des deux côtés: le même véhicule s'arrête à un quai à gauche ou à droite selon la gare.
Fenêtres de voyageurs en matériau `vitrage` (verre allumé avec les lampes): la nuit, la voiture
est éclairée. Les vitres de cabine restent `vitre` (on ne roule pas cabine éclairée).
"""

from __future__ import annotations

import math

from amenagements import _lanterne, _lumiere, _modele, barre, boite, colonne
from formes import Atelier, at, ton
from mobilier import revolution

RAIL_HAUT = 0.26
DEMI_ECART = 0.72
PLANCHER = 1.0
DEMI_LARGE = 1.35


# ====================================================================== outils
def caisse(s: Atelier, demi_l: float, profil, k: float, pli: float, couleurs, bout_bas, bout_haut, mat="metal", tremble=0.006):
    """Caisse d'un seul morceau: le profil (côté droit, du bas vers le faîte) tiré sur la
    longueur, miroir à gauche. Au-dessus de `pli`, chaque bout recule de `k` m par mètre (pare-brise
    incliné); `k = 0`: bouts droits. `couleurs`: une par pan du profil (2 x len(profil) - 1)."""
    anneau = list(profil) + [(-x, y) for x, y in reversed(profil)]
    n = len(anneau)
    v = []
    for e in (-1, 1):
        for x, y in anneau:
            v.append((x, y, e * (demi_l - max(0.0, y - pli) * k)))
    faces, teintes = [], []
    for i in range(n - 1):
        faces.append((i, i + 1, n + i + 1, n + i))
        teintes.append(couleurs[i])
    for d in (0, n):
        faces.append((d, d + 1, d + n - 2, d + n - 1))
        teintes.append(bout_bas)
        faces.append(tuple(d + i for i in range(1, n - 1)))
        teintes.append(bout_haut)
    s.morceau(v, faces, mat, teintes, coeur=(0.0, (profil[0][1] + profil[-1][1]) / 2, 0.0), tremble=tremble)


def plaque_cote(s: Atelier, cote: int, x: float, z0: float, z1: float, y0: float, y1: float, mat: str, couleur):
    """Plaque plate sur un flanc (vitre, porte), tournée vers le dehors (x du signe de `cote`)."""
    pts = [(cote * x, y0, z0), (cote * x, y0, z1), (cote * x, y1, z1), (cote * x, y1, z0)]
    s.morceau(pts, [(0, 1, 2, 3)], mat, couleur, coeur=(0.0, (y0 + y1) / 2, (z0 + z1) / 2))


def plaque_bout(s: Atelier, e: int, z_de, x0: float, x1: float, y0: float, y1: float, mat: str, couleur):
    """Plaque plate sur un bout (`z_de(y)`: place du bout à cette hauteur), tournée vers le dehors."""
    pts = [(x0, y0, z_de(y0) + e * 0.012), (x1, y0, z_de(y0) + e * 0.012), (x1, y1, z_de(y1) + e * 0.012), (x0, y1, z_de(y1) + e * 0.012)]
    ym = (y0 + y1) / 2
    s.morceau(pts, [(0, 1, 2, 3)], mat, couleur, coeur=(0.0, ym, z_de(ym) - e))


def roue(s: Atelier, x: float, z: float, r: float, couleur, pans=8, face=None):
    """Roue posée sur le rail (centre à r au-dessus du rail); seule la face du dehors est faite."""
    yc = RAIL_HAUT + r
    dehors = (False, True) if x > 0 else (True, False)
    s.tube([(x - 0.06, yc, z, r), (x + 0.06, yc, z, r)], pans, "metal", couleur, bouts=dehors, coupe=face if face is not None else ton(couleur, 1.25))


def essieux_libres(s: Atelier, ctx, a: float, r: float = 0.36):
    """Deux essieux d'un véhicule court: roues, plaques de garde, boîtes d'essieu, ressorts à lames."""
    fer = ctx.tons("fer")
    for z in (-a, a):
        for c in (-1, 1):
            roue(s, c * DEMI_ECART, z, r, fer[0])
            boite(s, *sorted((c * 0.82, c * 0.9)), 0.42, PLANCHER, z - 0.32, z + 0.32, "metal", fer[1], sans="y- y+")
            boite(s, *sorted((c * 0.84, c * 0.98)), 0.52, 0.76, z - 0.1, z + 0.1, "metal", fer[0])
            boite(s, *sorted((c * 0.86, c * 0.96)), 0.84, 0.92, z - 0.62, z + 0.62, "metal", ctx.un("fer_clair"))


def bogie(s: Atelier, ctx, z: float, r: float = 0.36, empattement: float = 1.0):
    """Bogie à deux essieux: quatre roues, longerons du dehors, traverse."""
    fer = ctx.tons("fer")
    yc = RAIL_HAUT + r
    for dz in (-empattement, empattement):
        for c in (-1, 1):
            roue(s, c * DEMI_ECART, z + dz, r, fer[0])
    for c in (-1, 1):
        boite(s, *sorted((c * 0.82, c * 0.94)), yc - 0.14, yc + 0.2, z - empattement - 0.42, z + empattement + 0.42, "metal", fer[1])
        for dz in (-empattement, empattement):
            boite(s, *sorted((c * 0.94, c * 1.04)), yc - 0.1, yc + 0.1, z + dz - 0.12, z + dz + 0.12, "metal", fer[0])
    boite(s, -0.82, 0.82, yc + 0.12, PLANCHER, z - 0.22, z + 0.22, "metal", fer[1], sans="y- y+")


def tampons(s: Atelier, ctx, demi_l: float, e: int, traverse, y=0.9):
    """Traverse de tête et ses deux tampons, au bout `e` (+1 l'avant, -1 l'arrière)."""
    fer = ctx.tons("fer")
    z0 = e * demi_l
    z1 = z0 + e * 0.12
    boite(s, -1.25, 1.25, y - 0.16, y + 0.16, *sorted((z0 - e * 0.02, z1)), "metal", traverse)
    for x in (-0.85, 0.85):
        za, zb, zc = z1, z1 + e * 0.24, z1 + e * 0.34
        s.tube([(x, y, za, 0.065), (x, y, zb, 0.065), (x, y, zb, 0.17), (x, y, zc, 0.17)], 6, "metal", fer[0], bouts=(False, True), coupe=ctx.un("fer_clair"))
    boite(s, -0.08, 0.08, y - 0.06, y + 0.06, *sorted((z1, z1 + e * 0.26)), "metal", fer[1])


def porte(s: Atelier, ctx, cote: int, z0: float, z1: float, couleur, vitrage: bool, haut=2.85):
    """Porte de flanc: battant, sa vitre (allumée si `vitrage`), main courante et deux marches
    sous le seuil (du quai à 0,12 m au plancher à 1 m)."""
    plaque_cote(s, cote, DEMI_LARGE + 0.01, z0, z1, PLANCHER + 0.02, haut, "metal", couleur)
    plaque_cote(s, cote, DEMI_LARGE + 0.02, z0 + 0.1, z1 - 0.1, 2.0, 2.6, "vitrage" if vitrage else "vitre", ctx.un("glace"))
    for z in (z0 - 0.05, z1 + 0.05):
        barre(s, (cote * (DEMI_LARGE + 0.05), 1.15, z), (cote * (DEMI_LARGE + 0.05), 2.5, z), 0.016, 3, "metal", ctx.un("laiton"), bouts=(False, False))
    fer = ctx.tons("fer")
    for y, xe in ((0.41, 1.46), (0.71, 1.42)):
        boite(s, *sorted((cote * 1.16, cote * xe)), y - 0.045, y, z0 - 0.04, z1 + 0.04, "metal", fer[1])
    for z in (z0, z1):
        boite(s, *sorted((cote * 1.28, cote * 1.33)), 0.36, PLANCHER, z - 0.03, z + 0.03, "metal", fer[0], sans="y- y+")


def fanal(s: Atelier, ctx, x: float, y: float, z: float, e: int, r=0.1):
    """Feu de tête ou de queue: un boîtier et son verre (allumé la nuit) tourné vers le bout `e`."""
    boite(s, x - r - 0.03, x + r + 0.03, y - r - 0.03, y + r + 0.03, *sorted((z, z + e * 0.1)), "metal", ctx.un("fer"))
    boite(s, x - r, x + r, y - r, y + r, *sorted((z + e * 0.1, z + e * 0.13)), "flamme", ctx.un("verre_lampe"), sans="y-")


# ====================================================================== véhicules
def _autorail(s: Atelier, ctx, entree):
    """Autorail court à une caisse, deux cabines: nez anguleux, pare-brise incliné, bande crème
    des fenêtres, radiateur sur le toit. Deux portes par flanc, près des cabines."""
    L = 6.8
    bas, creme, toit = ctx.un("livree_autorail"), ctx.un("livree_creme"), ctx.un("toit_train")
    laiton = ctx.un("laiton")
    profil = [(DEMI_LARGE, PLANCHER), (DEMI_LARGE, 1.95), (DEMI_LARGE, 2.75), (DEMI_LARGE, 3.0), (1.2, 3.32), (0.62, 3.48)]
    pans = [bas, creme, bas, toit, toit, toit, toit, toit, bas, creme, bas]
    k, pli = 0.32, 1.95
    caisse(s, L, profil, k, pli, pans, bas, creme)
    for c in (-1, 1):
        # Sept baies de voyageurs, une vitre de cabine à chaque bout.
        for i in range(7):
            zc = -3.6 + i * 1.2
            plaque_cote(s, c, DEMI_LARGE + 0.012, zc - 0.45, zc + 0.45, 2.02, 2.66, "vitrage", ctx.un("glace", i))
        for e in (-1, 1):
            plaque_cote(s, c, DEMI_LARGE + 0.012, *sorted((e * 5.75, e * 6.25)), 2.02, 2.62, "vitre", ctx.un("glace"))
            porte(s, ctx, c, *sorted((e * 4.48, e * 5.32)), ton(bas, 0.85), True)
    for e in (-1, 1):

        def z_de(y, e=e):
            return e * (L - max(0.0, y - pli) * k)

        for x0, x1 in ((-1.12, -0.08), (0.08, 1.12)):
            plaque_bout(s, e, z_de, x0, x1, 2.08, 2.72, "vitre", ctx.un("glace", 1))
        for x in (-0.86, 0.86):
            fanal(s, ctx, x, 1.5, z_de(1.5), e)
        fanal(s, ctx, 0.0, 3.08, z_de(3.08) - e * 0.06, e, r=0.08)
        tampons(s, ctx, L, e, ctx.un("tampon_rouge"))
        bogie(s, ctx, e * 4.6)
    # Sous la caisse, entre les bogies: moteur et réservoir. Sur le toit: radiateur, échappement.
    fer = ctx.tons("fer")
    boite(s, -0.95, 0.95, 0.5, PLANCHER, -2.4, 2.4, "metal", fer[1], sans="y- y+")
    # Toit: vu d'abord à 50 degrés, il porte le dessin du véhicule. Couvre-joints des tôles tous
    # les 1,3 m, gouttières au-dessus des portes, radiateur à ailettes au milieu, deux aérateurs,
    # échappement et avertisseur.
    for k in range(-4, 5):
        if abs(k) <= 1:
            continue
        z = k * 1.3
        boite(s, -0.62, 0.62, 3.46, 3.5, z - 0.03, z + 0.03, "metal", ton(toit, 0.82), tremble=0.0)
    for c in (-1, 1):
        barre(s, (c * 1.22, 3.31, -6.2), (c * 1.22, 3.31, 6.2), 0.03, 3, "metal", ton(toit, 0.75), bouts=(False, False))
    boite(s, -0.48, 0.48, 3.44, 3.62, -1.05, 1.05, "metal", fer[1], tremble=0.0)
    for k in range(6):
        z = -0.85 + k * 0.34
        boite(s, -0.44, 0.44, 3.62, 3.67, z - 0.04, z + 0.04, "metal", ctx.un("zinc"), tremble=0.0, sans="y- x+ x-")
    for z in (-3.25, 3.25):
        colonne(s, 0.0, z, 3.44, 3.6, 0.16, 6, "metal", ctx.un("zinc"), dessus=ton(toit, 0.7))
    colonne(s, 0.36, 1.5, 3.4, 3.95, 0.07, 6, "metal", fer[0], dessus=ctx.un("noir"))
    for e in (-1, 1):
        barre(s, (-0.3, 3.5, e * 5.6), (-0.3, 3.56, e * 6.0), 0.04, 5, "metal", laiton, bouts=(False, True))
    return {"pourquoi": entree.get("pourquoi")}


def _locomotive(s: Atelier, ctx, entree):
    """Petite locomotive-tender à trois essieux couplés: caisses à eau le long de la chaudière,
    cabine à l'arrière, soute à charbon derrière, cheminée à l'avant (+z)."""
    fer = ctx.tons("fer")
    vert, laiton, rouge = ctx.un("livree_loco"), ctx.un("laiton"), ctx.un("tampon_rouge")
    plateau = 1.22
    # Tablier et longerons.
    boite(s, -1.05, 1.05, plateau - 0.08, plateau, -4.15, 4.0, "metal", fer[0], dessus=fer[1])
    boite(s, -0.6, 0.6, 0.45, plateau - 0.08, -4.0, 3.9, "metal", fer[1], sans="y- y+")
    r = 0.52
    for z in (-2.2, -0.6, 1.0):
        for c in (-1, 1):
            roue(s, c * DEMI_ECART, z, r, ctx.un("noir"), pans=10, face=vert)
            s.octa(0.03, 0.09, 0.09, at(c * 0.79, RAIL_HAUT + r, z), "metal", rouge)
    for c in (-1, 1):
        # Bielle d'accouplement, cylindre, tige de piston.
        boite(s, *sorted((c * 0.82, c * 0.87)), 0.72, 0.82, -2.3, 1.1, "metal", ctx.un("fer_clair"))
        s.tube([(c * 0.98, 0.84, 2.0, 0.26), (c * 0.98, 0.84, 3.0, 0.26)], 8, "metal", fer[0], bouts=(False, True), coupe=ctx.un("fer_clair"))
        barre(s, (c * 0.98, 0.84, 2.0), (c * 0.9, 0.78, 1.15), 0.035, 4, "metal", ctx.un("fer_clair"), bouts=(False, False))
        # Caisse à eau, bouchon de remplissage.
        boite(s, *sorted((c * 0.72, c * 1.05)), plateau, 2.4, -0.75, 2.25, "metal", vert, dessus=ton(vert, 1.12))
        colonne(s, c * 0.98, 1.9, 2.4, 2.48, 0.1, 6, "metal", laiton)
        # Cabine: flanc, sa fenêtre, l'entrée sombre, la main courante, les marches.
        boite(s, *sorted((c * 1.0, c * 1.1)), plateau, 3.22, -3.45, -0.75, "metal", vert, dessus=ton(vert, 1.12))
        plaque_cote(s, c, 1.112, -1.6, -0.95, 2.35, 2.95, "vitre", ctx.un("glace"))
        plaque_cote(s, c, 1.112, -3.2, -2.55, 1.35, 2.9, "metal", ctx.un("fond"))
        barre(s, (c * 1.15, 1.4, -3.25), (c * 1.15, 2.8, -3.25), 0.016, 3, "metal", laiton, bouts=(False, False))
        for y, xe in ((0.48, 1.42), (0.86, 1.36)):
            boite(s, *sorted((c * 0.98, c * xe)), y - 0.045, y, -3.2, -2.55, "metal", fer[1])
    # Face avant de la cabine, ses deux hublots; arrière; toit débordant.
    boite(s, -1.0, 1.0, 2.4, 3.22, -0.85, -0.75, "metal", vert, sans="y-")
    for c in (-1, 1):
        plaque_bout(s, 1, lambda y: -0.74, c * 0.95, c * 0.55, 2.62, 3.0, "vitre", ctx.un("glace", 1))
    boite(s, -1.0, 1.0, plateau, 3.22, -3.5, -3.42, "metal", vert, sans="y-")
    boite(s, -1.18, 1.18, 3.22, 3.34, -3.6, -0.66, "metal", fer[0], dessus=ctx.un("toit_train"))
    # Soute à charbon et son tas.
    boite(s, -1.0, 1.0, plateau, 2.35, -4.15, -3.5, "metal", vert, dessus=ton(vert, 1.12))
    s.galet(0.92, 0.26, 0.3, at(0, 2.27, -3.82), "pierre", ctx.un("noir"), 31, points=12, pose=0.35)
    # Chaudière, cercles de laiton, boîte à fumée, cheminée, dôme, soupape.
    yb = 2.02
    s.tube([(0, yb, -0.75, 0.62), (0, yb, 3.2, 0.62)], 10, "metal", vert, bouts=(False, False))
    for z in (0.5, 1.9):
        s.tube([(0, yb, z - 0.04, 0.635), (0, yb, z + 0.04, 0.635)], 10, "metal", laiton, bouts=(False, False))
    s.tube([(0, yb, 3.2, 0.66), (0, yb, 3.92, 0.66)], 10, "metal", fer[0], bouts=(False, True), coupe=fer[1])
    boite(s, -0.5, 0.5, plateau, yb - 0.4, 3.2, 3.92, "metal", fer[0], sans="y-")
    s.tube([(0, 2.6, 3.56, 0.16), (0, 3.2, 3.56, 0.18), (0, 3.38, 3.56, 0.23)], 8, "metal", fer[0], bouts=(False, True), coupe=ctx.un("noir"))
    s.tube([(0, 2.5, 1.3, 0.3), (0, 2.82, 1.3, 0.24), (0, 2.92, 1.3, 0.14)], 8, "metal", laiton, bouts=(False, True))
    colonne(s, 0, 0.1, 2.55, 2.9, 0.07, 6, "metal", laiton)
    fanal(s, ctx, 0.0, 2.85, 3.92, 1, r=0.09)
    for e, z in ((1, 4.0), (-1, -4.15)):
        tampons(s, ctx, abs(z), e, rouge)
        for x in (-0.62, 0.62):
            fanal(s, ctx, x, 1.26, z, e, r=0.08)
    return {"pourquoi": entree.get("pourquoi")}


def _voiture(s: Atelier, ctx, entree):
    """Voiture de voyageurs à compartiments, deux essieux: caisse de teck, quatre portières par
    flanc, une baie de chaque côté de chaque portière, lanternes de toit."""
    L = 6.0
    teck, clair, toit = ctx.un("livree_teck"), ctx.un("livree_teck", 1), ctx.un("toit_train")
    profil = [(DEMI_LARGE, PLANCHER), (DEMI_LARGE, 1.9), (DEMI_LARGE, 2.72), (DEMI_LARGE, 2.95), (1.15, 3.22), (0.55, 3.38)]
    pans = [teck, clair, teck, toit, toit, toit, toit, toit, teck, clair, teck]
    caisse(s, L, profil, 0.0, 3.0, pans, teck, teck, mat="bardage")
    portieres = (-4.2, -1.4, 1.4, 4.2)
    for c in (-1, 1):
        for i, zc in enumerate(portieres):
            porte(s, ctx, c, zc - 0.36, zc + 0.36, ton(teck, 0.86), True, haut=2.8)
            for d in (-0.86, 0.86):
                plaque_cote(s, c, DEMI_LARGE + 0.012, zc + d - 0.3, zc + d + 0.3, 2.0, 2.62, "vitrage", ctx.un("glace", i))
    for e in (-1, 1):
        tampons(s, ctx, L, e, ctx.un("fer", 1))
        plaque_bout(s, e, lambda y, e=e: e * L, -0.35, 0.35, 2.0, 2.5, "vitrage", ctx.un("glace"))
    for zc in portieres:
        colonne(s, 0, zc, 3.34, 3.52, 0.11, 6, "metal", ctx.un("fer", 1), dessus=ctx.un("noir"))
    essieux_libres(s, ctx, 3.6)
    return {"pourquoi": entree.get("pourquoi")}


def _fourgon(s: Atelier, ctx, entree):
    """Fourgon à bagages, deux essieux: caisse de planches, grande porte roulante au milieu de chaque
    flanc, compartiment du chef de train à l'arrière avec sa vigie sur le toit."""
    L = 4.5
    brun, toit = ctx.un("livree_fourgon"), ctx.un("toit_train")
    profil = [(DEMI_LARGE, PLANCHER), (DEMI_LARGE, 1.9), (DEMI_LARGE, 2.72), (DEMI_LARGE, 2.95), (1.15, 3.22), (0.55, 3.38)]
    pans = [brun, brun, brun, toit, toit, toit, toit, toit, brun, brun, brun]
    caisse(s, L, profil, 0.0, 3.0, pans, brun, brun, mat="bardage")
    fer = ctx.tons("fer")
    for c in (-1, 1):
        plaque_cote(s, c, DEMI_LARGE + 0.012, -0.8, 0.8, PLANCHER + 0.04, 2.78, "bardage", ton(brun, 0.82))
        for y in (1.06, 2.82):
            barre(s, (c * 1.39, y, -1.9), (c * 1.39, y, 1.0), 0.02, 4, "metal", fer[0])
        porte(s, ctx, c, -3.95, -3.35, ton(brun, 0.82), True, haut=2.8)
        plaque_cote(s, c, DEMI_LARGE + 0.012, -2.95, -2.45, 2.05, 2.55, "vitrage", ctx.un("glace"))
        plaque_cote(s, c, DEMI_LARGE + 0.012, 2.2, 3.2, 2.3, 2.55, "vitre", ctx.un("fond"))
    # Vigie: on y voit la ligne par-dessus le train, vitres sur les quatre côtés.
    boite(s, -1.0, 1.0, 3.25, 3.92, -3.75, -2.55, "bardage", ctx.un("livree_fourgon"), sans="y-")
    boite(s, -1.08, 1.08, 3.92, 4.0, -3.85, -2.45, "metal", toit)
    for c in (-1, 1):
        plaque_cote(s, c, 1.012, -3.55, -2.75, 3.45, 3.8, "vitrage", ctx.un("glace"))
    for e, z in ((1, -2.55), (-1, -3.75)):
        plaque_bout(s, e, lambda y, z=z: z, -0.7, 0.7, 3.45, 3.8, "vitrage", ctx.un("glace", 1))
    for e in (-1, 1):
        tampons(s, ctx, L, e, ctx.un("fer", 1))
    # Feux de queue: le fourgon ferme le train.
    for x in (-0.9, 0.9):
        fanal(s, ctx, x, 2.7, -L, -1, r=0.08)
    essieux_libres(s, ctx, 2.6)
    return {"pourquoi": entree.get("pourquoi")}


# ====================================================================== draisine
# Draisine à bras de cheminot (`donnees/lieux/aubrune/vehicules/draisine.json`). Mêmes mesures de
# voie que les trains: les roues se posent sur le rail (dessus à 0,26 m). Les roues de 25 cm de
# rayon passent sous le plancher (dessus à 0,82 m): de là, bancs à 42 cm, pivot du balancier à
# 72 cm, comme la fiche les compte depuis le plancher.
DRAISINE = {"essieu": RAIL_HAUT + 0.25, "rayon": 0.25, "plancher": 0.82, "bout": 1.3, "demi": 0.85, "essieux": 0.8}


def _roue(s: Atelier, ctx, cote: int, z: float):
    """Roue à boudin de fonte, boudin du côté de la voie (dedans), bandage sur le rail; un sommet
    tout en bas, posé sur le rail. Pans de deux tons: on la voit tourner."""
    fer = ctx.tons("fer")
    e, r = DRAISINE["essieu"], DRAISINE["rayon"]
    # Repère local: y = axe de la roue vers le dehors (côté `cote`).
    profil = [(-0.06, r + 0.015), (-0.04, r + 0.015), (-0.04, r), (0.04, r)]
    with s.groupe(at(cote * DEMI_ECART, e, z, 0.0, 0.0, -cote * math.pi / 2)):
        revolution(s, profil, 10, "metal", [fer[0], fer[1]], haut=ctx.un("fer_clair"), bas=fer[1], phase=0.0)


def _draisine(s: Atelier, ctx, entree):
    """Plateforme de bois sur un châssis à deux essieux, deux bancs face à face, le balancier au
    milieu sur son chevalet de fer, levier de frein, lanterne à l'avant. Nœuds mobiles:
    `balancier` (bascule autour de x, au pivot), `roue-avant`, `roue-arriere` (roulent autour de x,
    à l'essieu): chacun est un nœud enfant du GLB, à son pivot."""
    d = DRAISINE
    e, pl, bout, demi = d["essieu"], d["plancher"], d["bout"], d["demi"]
    fer = ctx.tons("fer")
    bois = ctx.tons("bois_meuble")
    # Essieux et roues: un nœud par essieu (les deux roues et l'arbre tournent ensemble).
    for nom, z in (("roue-avant", d["essieux"]), ("roue-arriere", -d["essieux"])):
        with s.noeud(nom, (0.0, e, z), axe="x", rayon=d["rayon"]):
            for cote in (-1, 1):
                _roue(s, ctx, cote, z)
            barre(s, (-0.7, e, z), (0.7, e, z), 0.035, 8, "metal", fer[0])
    # Châssis: longerons de chêne peints au rouge des wagons de service, dehors des roues, boîtes
    # d'essieu de fonte, traverses de tête.
    sous = pl - 0.036
    rouge = ctx.un("peint_rouge")
    for c in (-1, 1):
        xa, xb = sorted((c * 0.8, c * demi))
        boite(s, xa, xb, 0.6, sous - 0.001, -bout + 0.06, bout - 0.06, "bois", rouge, tremble=0.0, sans="")
        for z in (-d["essieux"], d["essieux"]):
            xa, xb = sorted((c * 0.763, c * 0.83))
            boite(s, xa, xb, e - 0.07, 0.61, z - 0.07, z + 0.07, "metal", fer[1], tremble=0.0, sans="")
    for c in (-1, 1):
        za, zb = sorted((c * (bout - 0.12), c * (bout - 0.06)))
        boite(s, -0.799, 0.799, 0.6, sous - 0.001, za, zb, "bois", rouge, tremble=0.0, sans="")
        za, zb = sorted((c * (bout - 0.059), c * bout))
        for x in (-0.52, 0.52):
            boite(s, x - 0.1, x + 0.1, 0.62, 0.75, za, zb, "bois", ctx.un("bois_coupe", 1), tremble=0.0, sans="")
    boite(s, -0.799, 0.799, 0.7, sous - 0.001, -0.04, 0.04, "bois", ctx.un("bois_sombre"), tremble=0.0, sans="")
    # Plancher: sept planches le long de la voie, un jour de 6 mm entre elles.
    n, jour = 7, 0.006
    large = (2 * demi - (n - 1) * jour) / n
    grise = ctx.tons("bois_grise")
    for k in range(n):
        x0 = -demi + k * (large + jour)
        boite(s, x0, x0 + large, sous, pl, -bout + 0.06, bout - 0.06, "bois", grise[k % len(grise)], tremble=0.0, sans="")
    # Bancs face à face (dessus à 42 cm du plancher), dossier du côté du bout.
    for c in (-1, 1):
        za, zb = sorted((c * 0.67, c * 1.03))
        boite(s, -0.5, 0.5, pl + 0.37, pl + 0.42, za, zb, "bois", bois[0], tremble=0.0, sans="", dessus=ctx.un("bois_clair", 1))
        for x in (-0.45, 0.45):
            za, zb = sorted((c * 0.7, c * 1.0))
            boite(s, x - 0.02, x + 0.02, pl + 0.001, pl + 0.369, za, zb, "bois", bois[1], tremble=0.0, sans="")
            za, zb = sorted((c * 1.031, c * 1.07))
            boite(s, x - 0.025, x + 0.025, pl + 0.001, pl + 0.7, za, zb, "bois", bois[1], tremble=0.0, sans="", dessus=ctx.un("bois_coupe"))
        za, zb = sorted((c * 1.0, c * 1.03))
        boite(s, -0.49, 0.49, pl + 0.56, pl + 0.66, za, zb, "bois", bois[2 % len(bois)], tremble=0.0, sans="")
    # Chevalet du balancier: deux jambes de fer, deux flasques, les bouts d'axe dans le moyeu.
    p = pl + 0.72
    for c in (-1, 1):
        barre(s, (c * 0.17, pl - 0.01, 0.0), (c * 0.085, p - 0.07, 0.0), 0.03, 6, "metal", fer[0])
        xa, xb = sorted((c * 0.066, c * 0.096))
        boite(s, xa, xb, p - 0.1, p + 0.06, -0.07, 0.07, "metal", fer[1], tremble=0.0, sans="")
        barre(s, (c * 0.092, p, 0.0), (c * 0.045, p, 0.0), 0.015, 6, "metal", ctx.un("fer_clair"))
    # Balancier: moyeu de fonte, fléau de chêne en deux bras, poignées en travers à 0,5 m du pivot.
    with s.noeud("balancier", (0.0, p, 0.0), axe="x", debattement=14):
        barre(s, (-0.06, p, 0.0), (0.06, p, 0.0), 0.05, 8, "metal", fer[0])
        for c in (-1, 1):
            za, zb = sorted((c * 0.02, c * 0.53))
            boite(s, -0.035, 0.035, p - 0.03, p + 0.03, za, zb, "bois", bois[0], tremble=0.0, sans="", dessus=ctx.un("bois_clair"))
            for x in (-1, 1):
                barre(s, (x * 0.03, p, c * 0.5), (x * 0.35, p, c * 0.5), 0.022, 6, "bois", ctx.un("bois_clair", 2))
    # Levier de frein sur le flanc droit, devant le chevalet: secteur de fer, levier, poignée.
    boite(s, 0.6, 0.7, pl + 0.001, pl + 0.08, 0.3, 0.4, "metal", fer[1], tremble=0.0, sans="")
    barre(s, (0.65, pl + 0.04, 0.35), (0.65, pl + 0.5, 0.24), 0.018, 6, "metal", fer[0])
    barre(s, (0.65, pl + 0.48, 0.245), (0.65, pl + 0.6, 0.215), 0.024, 6, "bois", ctx.un("bois_meuble", 1))
    # Lanterne à l'avant, posée sur le plancher derrière le dossier du banc avant.
    _lanterne(s, ctx, 0.0, pl + 0.042, 1.15, 0.13, 0.17, fer)
    return {"pourquoi": entree.get("pourquoi")}


SORTES = {"autorail": _autorail, "locomotive": _locomotive, "voiture": _voiture, "fourgon": _fourgon, "draisine": _draisine}


def vehicule(entree: dict, ctx) -> list[dict]:
    sorte = entree["sorte"]
    if sorte not in SORTES:
        raise SystemExit(f"{entree['id']}: sorte de véhicule inconnue « {sorte} »")
    s = Atelier(entree["graine"])
    notice = SORTES[sorte](s, ctx, entree)
    if "lumiere" in entree:
        # Lumière de la caisse éclairée: au milieu, à hauteur des vitres; sa flaque tombe sur le quai.
        notice["light"] = _lumiere(entree, (0.0, 2.3, 0.0))
    return [_modele(entree["id"], s, states={}, variants=[], **notice)]


FAMILLES_VEHICULES = {"vehicule": vehicule}
