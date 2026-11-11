"""Objets d'intérieur d'Aubrune: ce qui rend une pièce habitée (lampes, horloges, cadres, vaisselle,
paniers, tapis, sièges d'appoint).

Mêmes règles que les meubles (`amenagements.py`): origine au centre de l'emprise de la fiche,
avant vers +z (le côté d'où l'on s'en sert), rien hors de ses cases. Selon la couche de pose de la
fiche (`deco.layer`):
- `floor` et `rug`: posé au sol, y = 0 au plancher;
- `top`: posé sur un meuble, y = 0 au plateau qui le porte (le rendu l'élève au `top` du meuble);
- `wall`: accroché au mur, le mur est derrière (z = -0,5, bord de la case), hauteurs comptées
  depuis le plancher (un cadre à hauteur d'yeux, une horloge au-dessus des têtes).
Lampes: verre ou abat-jour en `flamme` (il luit quand la lampe est allumée), foyer au manifeste
(`light`) par `lumiere` de l'entrée, comme les lampes du dehors.
"""

from __future__ import annotations

import math

from amenagements import _lumiere, _modele, _pot, barre, boite, bosse, colonne
from feu import langue
from formes import Atelier, at, penche, ton

MUR = -0.5


def _disque_mural(s: Atelier, x, y, z0, z1, r, pans, mat, cote, face, echelle_y=1.0):
    """Disque plat tenu au mur (cadran, médaillon): tranche `cote`, face `face` vers +z."""
    m = at(x, y, 0)
    m[:3, 1] *= echelle_y
    with s.groupe(m):
        s.tube([(0, 0, z0, r), (0, 0, z1, r)], pans, mat, cote, bouts=(False, True), coupe=face)


def _aiguilles(s: Atelier, x, y, z, r, couleur, heure=-0.9, minute=1.55):
    for ang, long_, larg in ((heure, 0.55, 0.018), (minute, 0.85, 0.012)):
        c, sn = math.cos(ang), math.sin(ang)
        pts = [(x - sn * larg, y + c * larg, z), (x + sn * larg, y - c * larg, z), (x + c * r * long_, y + sn * r * long_, z)]
        s.morceau(pts, [(0, 1, 2)], "metal", couleur, coeur=(x, y, z - 1.0), sol=False)


def _plaque(s: Atelier, x0, x1, y0, y1, z, mat, couleur):
    """Plaque plate face à +z (toile d'un cadre, cadran, étiquette)."""
    s.morceau([(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)], [(0, 1, 2, 3)], mat, couleur, coeur=((x0 + x1) / 2, (y0 + y1) / 2, z - 1.0))


def _livre(s: Atelier, ctx, x, y, z, w, h, d, couleur, ry=0.0):
    """Livre couché: couverture de couleur, tranche crème devant."""
    s.box(w, h, d, at(x, y + h / 2, z, ry), "etoffe", couleur, tremble=0.002, dessus=ton(couleur, 1.08))


def _objet(sorte: str, entree: dict, ctx, g: float) -> tuple[Atelier, dict]:
    s = Atelier(g)
    notice: dict = {}
    fer = ctx.tons("fer")
    laiton = ctx.un("laiton")
    bois = ctx.tons("bois_meuble")
    foyer = None

    # ------------------------------------------------------------------ lampes
    if sorte == "lampe-de-table":
        # Pied de faïence, abat-jour de tissu tendu (`flamme`: il s'allume avec la lampe).
        s.tube([(0, 0, 0, 0.08), (0, 0.03, 0, 0.08), (0, 0.1, 0, 0.06), (0, 0.2, 0, 0.035)], 7, "vitre", ctx.un("peint_bleu"), bouts=(False, True))
        colonne(s, 0, 0, 0.2, 0.3, 0.012, 4, "metal", laiton)
        s.tube([(0, 0.26, 0, 0.16), (0, 0.44, 0, 0.09)], 8, "flamme", ctx.un("abat_jour"), bouts=(False, True))
        foyer = (0.0, 0.32, 0.0)
    elif sorte == "lampe-a-petrole":
        # Pied de laiton, réservoir de verre, mèche dans son verre de lampe (`flamme`).
        s.tube([(0, 0, 0, 0.07), (0, 0.02, 0, 0.07), (0, 0.05, 0, 0.03), (0, 0.09, 0, 0.03)], 6, "metal", laiton, bouts=(False, False))
        s.tube([(0, 0.09, 0, 0.05), (0, 0.13, 0, 0.075), (0, 0.17, 0, 0.05)], 7, "vitre", ctx.un("vitre"), bouts=(False, False))
        colonne(s, 0, 0, 0.17, 0.2, 0.04, 6, "metal", laiton)
        s.tube([(0, 0.2, 0, 0.032), (0, 0.24, 0, 0.05), (0, 0.29, 0, 0.034), (0, 0.38, 0, 0.026)], 7, "flamme", ctx.un("verre_lampe"), bouts=(False, True))
        barre(s, (0.04, 0.12, 0), (0.1, 0.12, 0), 0.008, 3, "metal", laiton)
        foyer = (0.0, 0.26, 0.0)
    # ------------------------------------------------------------------ horloges
    elif sorte == "horloge-murale":
        # Régulateur: caisse de noyer sous un grand cadran, balancier de laiton derrière sa vitre.
        boite(s, -0.15, 0.15, 1.3, 1.92, MUR, MUR + 0.1, "bois", ctx.un("bois_sombre"), sans="z-")
        _plaque(s, -0.1, 0.1, 1.38, 1.8, MUR + 0.102, "vitre", ctx.un("glace"))
        barre(s, (0, 1.82, MUR + 0.11), (0, 1.5, MUR + 0.11), 0.006, 3, "metal", laiton, bouts=(False, False))
        _disque_mural(s, 0, 1.48, MUR + 0.1, MUR + 0.115, 0.055, 7, "metal", laiton, laiton)
        _disque_mural(s, 0, 2.06, MUR, MUR + 0.11, 0.19, 10, "bois", ctx.un("bois_sombre"), ctx.un("bois_sombre"))
        _disque_mural(s, 0, 2.06, MUR + 0.11, MUR + 0.12, 0.15, 10, "metal", laiton, ctx.un("email"))
        _aiguilles(s, 0, 2.06, MUR + 0.125, 0.15, ctx.un("noir"))
        boite(s, -0.17, 0.17, 1.26, 1.3, MUR, MUR + 0.12, "bois", ctx.un("bois_sombre"), sans="z- y-")
    elif sorte == "pendule":
        # Pendule de cheminée: socle, corps de bois sombre en chapelle, cadran d'émail, deux pieds.
        boite(s, -0.2, 0.2, 0.0, 0.04, -0.08, 0.08, "bois", ctx.un("bois_sombre"))
        boite(s, -0.15, 0.15, 0.04, 0.26, -0.06, 0.06, "bois", ctx.un("bois_sombre", 1))
        s.morceau([(-0.15, 0.26, -0.06), (0.15, 0.26, -0.06), (0.15, 0.26, 0.06), (-0.15, 0.26, 0.06), (0, 0.36, -0.06), (0, 0.36, 0.06)],
                  [(0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4)], "bois", ctx.un("bois_sombre"), coeur=(0, 0.28, 0))
        _disque_mural(s, 0, 0.19, 0.06, 0.075, 0.075, 9, "metal", laiton, ctx.un("email"))
        _aiguilles(s, 0, 0.19, 0.078, 0.075, ctx.un("noir"))
        s.octa(0.03, 0.03, 0.03, at(0, 0.38, 0), "metal", laiton)
    # ------------------------------------------------------------------ cadres
    elif sorte == "cadre":
        forme = entree["forme"]
        cadre = ctx.un("bois_sombre") if forme != "ovale" else laiton
        if forme == "ovale":
            # Médaillon ovale: un portrait de famille, cadre doré.
            _disque_mural(s, 0, 1.62, MUR, MUR + 0.04, 0.2, 10, "metal", cadre, cadre, echelle_y=1.3)
            _disque_mural(s, 0, 1.62, MUR + 0.04, MUR + 0.05, 0.16, 10, "etoffe", ctx.un("fond"), ctx.un("portrait_fond"), echelle_y=1.3)
            _disque_mural(s, 0, 1.58, MUR + 0.05, MUR + 0.056, 0.065, 7, "etoffe", ctx.un("portrait_peau"), ctx.un("portrait_peau"), echelle_y=1.2)
            s.morceau([(-0.12, 1.4, MUR + 0.056), (0.12, 1.4, MUR + 0.056), (0.06, 1.52, MUR + 0.056), (-0.06, 1.52, MUR + 0.056)], [(0, 1, 2, 3)], "etoffe", ctx.un("noir"), coeur=(0, 1.46, MUR - 1))
        else:
            w, h, y = (0.36, 0.48, 1.62) if forme == "portrait" else (0.66, 0.42, 1.6)
            boite(s, -w / 2, w / 2, y - h / 2, y + h / 2, MUR, MUR + 0.035, "bois", cadre, sans="z- y-")
            m = 0.05
            if forme == "portrait":
                # Une femme en buste sur fond sombre.
                _plaque(s, -w / 2 + m, w / 2 - m, y - h / 2 + m, y + h / 2 - m, MUR + 0.037, "etoffe", ctx.un("portrait_fond"))
                s.morceau([(-0.11, y - h / 2 + m, MUR + 0.04), (0.11, y - h / 2 + m, MUR + 0.04), (0.06, y - 0.02, MUR + 0.04), (-0.06, y - 0.02, MUR + 0.04)], [(0, 1, 2, 3)], "etoffe", ctx.un("peint_rouge"), coeur=(0, y, MUR - 1))
                s.morceau([(0, y - 0.01, MUR + 0.041), (0.05, y + 0.05, MUR + 0.041), (0.035, y + 0.12, MUR + 0.041), (-0.035, y + 0.12, MUR + 0.041), (-0.05, y + 0.05, MUR + 0.041)], [(0, 1, 2, 3, 4)], "etoffe", ctx.un("portrait_peau"), coeur=(0, y, MUR - 1))
            else:
                # Paysage: ciel, coteau, le clocher du bourg.
                x0, x1, y0, y1 = -w / 2 + m, w / 2 - m, y - h / 2 + m, y + h / 2 - m
                _plaque(s, x0, x1, (y0 + y1) / 2, y1, MUR + 0.037, "etoffe", ctx.un("peint_bleu"))
                s.morceau([(x0, y0, MUR + 0.038), (x1, y0, MUR + 0.038), (x1, y0 + 0.13, MUR + 0.038), (0.05, y0 + 0.2, MUR + 0.038), (x0, y0 + 0.12, MUR + 0.038)], [(0, 1, 2, 3, 4)], "etoffe", ctx.un("haie"), coeur=(0, y, MUR - 1))
                s.morceau([(0.1, y0 + 0.15, MUR + 0.04), (0.14, y0 + 0.15, MUR + 0.04), (0.12, y0 + 0.27, MUR + 0.04)], [(0, 1, 2)], "etoffe", ctx.un("tuile", 3), coeur=(0, y, MUR - 1))
    # ------------------------------------------------------------------ rangements muraux
    elif sorte == "etagere-murale":
        # Planche sur deux consoles, à 1,5 m: bocaux, deux livres debout, un pichet.
        y = 1.5
        boite(s, -0.42, 0.42, y - 0.03, y, MUR, MUR + 0.22, "bois", bois[0], dessus=ctx.un("bois_clair"), sans="z-")
        for x in (-0.3, 0.3):
            s.morceau([(x, y - 0.03, MUR), (x, y - 0.22, MUR), (x, y - 0.03, MUR + 0.18)], [(0, 1, 2)], "bois", bois[1], coeur=(x - 1, y, MUR), sol=False)
        for k, x in enumerate((-0.32, -0.22)):
            colonne(s, x, MUR + 0.11, y, y + 0.14, 0.045, 6, "vitre", ctx.un("confiture", k), dessus=ctx.un("etoffes", k))
        boite(s, -0.08, -0.04, y, y + 0.22, MUR + 0.03, MUR + 0.19, "etoffe", ctx.un("etoffes", 0), sans="y- z-")
        boite(s, -0.035, 0.01, y, y + 0.2, MUR + 0.03, MUR + 0.18, "etoffe", ctx.un("etoffes", 2), sans="y- z-")
        _pot(s, 0.2, y, MUR + 0.11, 0.06, 0.16, ctx.un("gres", 2), pans=6, contenu=ton(ctx.un("gres", 2), 0.7))
        colonne(s, 0.34, MUR + 0.1, y, y + 0.09, 0.05, 6, "vitre", ctx.un("email", 1), dessus=ctx.un("fond"))
    elif sorte == "patere":
        # Planche à quatre patères à 1,65 m: un manteau, une veste, un chapeau.
        y = 1.65
        boite(s, -0.45, 0.45, y - 0.06, y + 0.06, MUR, MUR + 0.03, "bois", bois[0], sans="z-")
        for x in (-0.29, -0.1, 0.09, 0.31):
            barre(s, (x, y, MUR + 0.03), (x, y + 0.03, MUR + 0.11), 0.015, 4, "metal", laiton, bouts=(False, True))
        for x, bas, couleur, larg in ((-0.29, 0.62, ctx.un("manteau"), 0.17), (0.09, 0.98, ctx.un("manteau", 1), 0.15)):
            # Vêtement pendu: épaules étroites sous la patère, s'évase vers le bas, plis en pans.
            haut = y + 0.02
            v = [(x - 0.08, haut, MUR + 0.04), (x + 0.08, haut, MUR + 0.04), (x + 0.09, haut, MUR + 0.13), (x - 0.09, haut, MUR + 0.13),
                 (x - larg, bas, MUR + 0.02), (x + larg, bas, MUR + 0.02), (x + larg + 0.02, bas, MUR + 0.2), (x, bas, MUR + 0.24), (x - larg - 0.02, bas, MUR + 0.2)]
            faces = [(0, 1, 2, 3), (3, 2, 6, 7), (3, 7, 8), (1, 5, 6, 2), (0, 3, 8, 4)]
            s.morceau(v, faces, "etoffe", couleur, coeur=(x, (haut + bas) / 2, MUR + 0.08), dessus=ton(couleur, 1.1))
            s.morceau([(x - 0.07, haut, MUR + 0.135), (x + 0.07, haut, MUR + 0.135), (x, haut - 0.2, MUR + 0.2)], [(0, 1, 2)], "etoffe", ton(couleur, 0.75), coeur=(x, haut, MUR), sol=False)
        s.tube([(0.31, y - 0.02, MUR + 0.165, 0.15), (0.31, y + 0.0, MUR + 0.165, 0.15), (0.31, y + 0.01, MUR + 0.165, 0.09), (0.31, y + 0.1, MUR + 0.165, 0.08)], 8, "etoffe", ctx.un("feutre"), bouts=(False, True))
    elif sorte == "rideau-de-porte":
        # Rideau de passage tendu sur sa tringle devant l'embrasure, retenu sur le côté par une
        # embrasse: on voit qu'on peut passer, et l'autre pièce reste à l'abri des regards.
        barre(s, (-0.48, 2.12, MUR + 0.06), (0.48, 2.12, MUR + 0.06), 0.015, 4, "metal", laiton)
        rangs = ((2.1, -0.46, 0.42), (1.05, -0.44, -0.18), (0.03, -0.46, 0.02))
        plis = 7
        tons = [ctx.un("rideau"), ctx.un("rideau", 1)]
        v = []
        for y, x0, x1 in rangs:
            for i in range(plis + 1):
                x = x0 + (x1 - x0) * i / plis
                v.append((x, y, MUR + (0.04 if i % 2 else 0.1)))
        faces, couleurs = [], []
        for j in range(len(rangs) - 1):
            for i in range(plis):
                a = j * (plis + 1) + i
                faces.append((a, a + 1, a + plis + 2, a + plis + 1))
                couleurs.append(tons[i % 2])
        s.morceau(v, faces, "etoffe", couleurs, coeur=(-0.1, 1.0, MUR - 1.0))
        barre(s, (-0.46, 1.05, MUR + 0.11), (-0.17, 1.05, MUR + 0.11), 0.02, 4, "etoffe", ctx.un("feu_rouge"))
    # ------------------------------------------------------------------ meubles de rangement
    elif sorte == "vaisselier":
        # Buffet bas à deux portes, dessus de bois clair; vaisselier à deux étagères garnies
        # d'assiettes debout et de bols, corniche. Contre le mur (dos à -0,5).
        w = 1.3
        tons_b = ctx.tons("bois_meuble")
        boite(s, -w / 2, w / 2, 0.0, 0.86, -0.5, -0.04, "bois", tons_b[0], sans="y- y+ z-")
        boite(s, -w / 2 - 0.02, w / 2 + 0.02, 0.86, 0.9, -0.5, -0.02, "bois", ctx.un("bois_clair"), sans="y- z-")
        for x0 in (-w / 2 + 0.06, 0.03):
            _plaque(s, x0, x0 + w / 2 - 0.09, 0.14, 0.78, -0.035, "bois", ton(tons_b[0], 1.12))
        for x in (-0.06, 0.06):
            s.octa(0.02, 0.02, 0.02, at(x, 0.52, -0.02), "metal", laiton)
        boite(s, -w / 2, w / 2, 0.9, 2.0, -0.5, -0.46, "bois", tons_b[1], sans="y- z-")
        for x in (-w / 2, w / 2 - 0.04):
            boite(s, x, x + 0.04, 0.9, 2.0, -0.5, -0.24, "bois", tons_b[0], sans="y- z-")
        boite(s, -w / 2 - 0.04, w / 2 + 0.04, 2.0, 2.1, -0.5, -0.2, "bois", tons_b[0], dessus=ctx.un("bois_clair"), sans="y- z-")
        for y in (1.25, 1.62):
            boite(s, -w / 2 + 0.04, w / 2 - 0.04, y - 0.025, y, -0.46, -0.26, "bois", ctx.un("bois_clair"), sans="y- z-")
            for i in range(4):
                x = -0.45 + i * 0.3
                couleur = ctx.un("vaisselle", i + int(y * 10))
                _disque_mural(s, x, y + 0.12, -0.44, -0.425, 0.11, 7, "vitre", couleur, ton(couleur, 1.08))
        for i, x in enumerate((-0.3, 0.3)):
            _pot(s, x, 0.9, -0.24, 0.1, 0.07, ctx.un("vaisselle", i + 2), pans=7, contenu=ton(ctx.un("vaisselle", i + 2), 0.75))
        notice["top"] = 0.9
    elif sorte == "poele":
        # Poêle de fonte sur quatre pieds, porte vitrée où danse le feu, bouilloire sur le dessus,
        # tuyau qui monte puis rentre dans le mur (le conduit est dans la maçonnerie).
        boite(s, -0.25, 0.25, 0.14, 0.66, -0.26, 0.22, "metal", fer[0], sans="y-")
        boite(s, -0.28, 0.28, 0.66, 0.7, -0.29, 0.25, "metal", fer[1])
        for sx in (-1, 1):
            for sz in (-1, 1):
                boite(s, sx * 0.21 - 0.03, sx * 0.21 + 0.03, 0, 0.14, -0.02 + sz * 0.2 - 0.03, -0.02 + sz * 0.2 + 0.03, "metal", fer[1], sans="y- y+")
        # Porte du foyer: un cadre de fonte autour de la fenêtre (sans verre: on y voit le feu),
        # le fond noir de suie, les braises sur la grille et trois langues de flamme.
        for x0, x1, y0, y1 in ((-0.16, 0.16, 0.26, 0.3), (-0.16, 0.16, 0.46, 0.5), (-0.16, -0.12, 0.3, 0.46), (0.12, 0.16, 0.3, 0.46)):
            boite(s, x0, x1, y0, y1, 0.221, 0.248, "metal", fer[1], sans="z-", tremble=0.0)

        _plaque(s, -0.118, 0.118, 0.302, 0.458, 0.2215, "metal", ctx.un("fond"))
        for k, x in enumerate((-0.08, -0.03, 0.02, 0.07)):
            s.octa(0.026, 0.014, 0.012, at(x, 0.305, 0.232, k), "braise", ctx.un("braise", k))
        for k, (x, h) in enumerate(((-0.05, 0.1), (0.02, 0.13), (0.07, 0.08))):
            langue(s, (x, 0.297, 0.233), h, 0.014, ctx.un("flamme_coeur") if k == 1 else ctx.un("braise", k), g + k * 7, vers=(0.004 * (k - 1), 0.0))


        s.octa(0.02, 0.02, 0.02, at(0.13, 0.38, 0.245), "metal", laiton)
        s.tube([(-0.08, 0.7, 0.02, 0.1), (-0.08, 0.84, 0.02, 0.11), (-0.08, 0.88, 0.02, 0.05)], 7, "metal", ctx.un("cuivre"), bouts=(False, True))
        barre(s, (0.02, 0.8, 0.02), (0.1, 0.86, 0.04), 0.012, 3, "metal", ctx.un("cuivre"))
        s.tube([(0.12, 0.7, -0.14, 0.065), (0.12, 2.15, -0.14, 0.065), (0.12, 2.3, -0.3, 0.065), (0.12, 2.3, -0.5, 0.065)], 6, "metal", fer[0], bouts=(False, False))
        boite(s, 0.0, 0.24, 2.18, 2.42, -0.5, -0.48, "metal", fer[1], sans="z-")
        foyer = (0.0, 0.38, 0.32)
        notice["top"] = 0.7
    # ------------------------------------------------------------------ au sol
    elif sorte == "panier":
        # Panier d'osier à anse, du linge plié dedans.
        s.tube([(0, 0, 0, 0.17), (0, 0.24, 0, 0.21), (0, 0.26, 0, 0.22)], 8, "bois", ctx.un("osier"), bouts=(False, True), coupe=ctx.un("etoffes", 3))
        s.tube([(-0.2, 0.26, 0, 0.012), (-0.14, 0.44, 0, 0.012), (0.14, 0.44, 0, 0.012), (0.2, 0.26, 0, 0.012)], 4, "bois", ton(ctx.un("osier"), 0.85), bouts=(False, False))
        s.galet(0.12, 0.05, 0.1, at(0.04, 0.24, 0.02, 0.4), "etoffe", ctx.un("creme"), g, points=8, pose=0.3)
    elif sorte == "buches":
        # Bûches rangées près du poêle: trois, deux, une, sections claires vers la pièce.
        k = 0
        for rang, n in enumerate((3, 2, 1)):
            for i in range(n):
                x = (i - (n - 1) / 2) * 0.22
                y = 0.1 + rang * 0.18
                s.tube([(x + penche(g + k, 0.01), y, -0.3, 0.1), (x, y, 0.28, 0.095)], 6, "bois", ctx.un("bois_mort", k), bouts=(True, True), coupe=ctx.un("bois_coupe", k), tors=0.3)
                k += 1
    elif sorte == "caisse-de-legumes":
        # Cagette de planches à claire-voie: carottes, choux, pommes de terre de la récolte.
        for y0 in (0.0, 0.14):
            for sz in (-1, 1):
                boite(s, -0.3, 0.3, y0 + 0.02, y0 + 0.12, sz * 0.2 - 0.012, sz * 0.2 + 0.012, "bois", ctx.un("bois_clair", y0 * 10 + sz), sans="y-")
            for sx in (-1, 1):
                boite(s, sx * 0.3 - 0.012, sx * 0.3 + 0.012, y0 + 0.02, y0 + 0.12, -0.2, 0.2, "bois", ctx.un("bois_clair", 2), sans="y-")
        for sx in (-1, 1):
            for sz in (-1, 1):
                boite(s, sx * 0.29 - 0.02, sx * 0.29 + 0.02, 0, 0.27, sz * 0.19 - 0.02, sz * 0.19 + 0.02, "bois", ctx.un("bois_meuble"), sans="y-")
        for i, (x, z) in enumerate(((-0.17, -0.08), (-0.02, 0.06))):
            bosse(s, x, 0.18, z, 0.11, 0.13, g + i, ctx.un("feuille_potager", i), mat="fruit", pans=5, dessus=ctx.un("feuille_potager", 2))
        for i in range(3):
            s.galet(0.05, 0.035, 0.045, at(0.12 + penche(g + i, 0.06), 0.24, -0.1 + i * 0.07, i), "fruit", ctx.un("patate"), g + i, points=6, pose=0.3)
        for i in range(3):
            x = 0.06 + i * 0.07
            barre(s, (x, 0.27, 0.12), (x + 0.04, 0.25, -0.1), 0.022, 4, "fruit", ctx.un("carotte"), bouts=(True, False))
            s.brin((x, 0.27, 0.12), (x - 0.03, 0.36, 0.2), 0.05, "tige", ctx.un("tige"))
    elif sorte == "tonnelet":
        # Tonnelet couché sur son chantier, cercles de fer, robinet de laiton vers la pièce.
        for x in (-0.16, 0.16):
            boite(s, x - 0.04, x + 0.04, 0, 0.12, -0.2, 0.2, "bois", ctx.un("bois_meuble"))
        yc = 0.3
        s.tube([(-0.24, yc, 0, 0.15), (-0.12, yc, 0, 0.18), (0.12, yc, 0, 0.18), (0.24, yc, 0, 0.15)], 8, "bois", ctx.un("bois_clair", 1), bouts=(True, True), coupe=ctx.un("bois_meuble", 2))
        for x in (-0.19, 0.19):
            s.tube([(x - 0.015, yc, 0, 0.168), (x + 0.015, yc, 0, 0.168)], 8, "metal", fer[0], bouts=(False, False))
        barre(s, (0, yc + 0.02, 0.17), (0, yc - 0.06, 0.28), 0.018, 4, "metal", laiton, bouts=(False, True))
    elif sorte == "seau":
        # Seau de zinc à anse, de l'eau dedans.
        s.tube([(0, 0, 0, 0.12), (0, 0.28, 0, 0.15)], 8, "metal", ctx.un("zinc"), bouts=(False, True), coupe=ctx.un("eau_sombre"))
        s.tube([(0, 0.27, 0, 0.152), (0, 0.29, 0, 0.152)], 8, "metal", ctx.un("zinc", 1), bouts=(False, False))
        s.tube([(-0.15, 0.27, 0, 0.008), (-0.1, 0.4, 0.02, 0.008), (0.1, 0.4, 0.02, 0.008), (0.15, 0.27, 0, 0.008)], 3, "metal", fer[0], bouts=(False, False))
    elif sorte == "balai":
        # Balai de paille debout dans le coin, manche appuyé au mur.
        barre(s, (0.0, 0.32, -0.36), (0.06, 1.4, -0.47), 0.014, 4, "bois", ctx.un("bois_clair"), bouts=(False, True))
        s.morceau([(-0.03, 0.34, -0.37), (0.03, 0.34, -0.37), (0.12, 0.0, -0.32), (-0.12, 0.0, -0.32), (0.11, 0.0, -0.24), (-0.11, 0.0, -0.24), (0.0, 0.34, -0.33)],
                  [(0, 1, 2, 3), (6, 5, 4), (1, 6, 4, 2), (0, 3, 5, 6)], "bois", ctx.un("paille"), coeur=(0, 0.15, -0.31))
        boite(s, -0.04, 0.04, 0.3, 0.34, -0.38, -0.32, "metal", ctx.un("feu_rouge"))
    # ------------------------------------------------------------------ sièges
    elif sorte == "tabouret":
        # Tabouret à trois pieds écartés, assise ronde à 45 cm.
        s.tube([(0, 0.42, 0, 0.17), (0, 0.46, 0, 0.17)], 8, "bois", ctx.un("bois_meuble"), bouts=(False, True), coupe=ctx.un("bois_clair", 2))
        for k in range(3):
            a = k / 3 * math.tau + 0.5
            barre(s, (math.cos(a) * 0.1, 0.42, math.sin(a) * 0.1), (math.cos(a) * 0.17, 0, math.sin(a) * 0.17), 0.022, 4, "bois", ctx.un("bois_meuble", k), bouts=(False, False))
        notice["top"] = 0.46
    elif sorte == "banc-de-table":
        # Banc de ferme sur deux tréteaux pleins, entretoise: on s'y assied à deux le long d'une table.
        boite(s, -0.8, 0.8, 0.41, 0.46, -0.16, 0.16, "bois", ctx.un("bois_meuble"), dessus=ctx.un("bois_clair", 1))
        for x in (-0.62, 0.62):
            s.morceau([(x - 0.03, 0, -0.15), (x + 0.03, 0, -0.15), (x + 0.03, 0, 0.15), (x - 0.03, 0, 0.15), (x - 0.03, 0.41, -0.12), (x + 0.03, 0.41, -0.12), (x + 0.03, 0.41, 0.12), (x - 0.03, 0.41, 0.12)],
                      [(0, 4, 7, 3), (1, 2, 6, 5), (0, 1, 5, 4), (3, 7, 6, 2)], "bois", ctx.un("bois_meuble", 1), coeur=(x, 0.2, 0))
        boite(s, -0.6, 0.6, 0.18, 0.24, -0.02, 0.02, "bois", ctx.un("bois_meuble", 2), sans="y-")
        notice["top"] = 0.46
    # ------------------------------------------------------------------ tapis
    elif sorte == "tapis-rond":
        # Tapis tressé de chiffons: anneaux de couleurs (on le fait en tournant la tresse).
        anneaux = (0.0, 0.22, 0.42, 0.62, 0.8, 0.9)
        tons = ctx.tons("tresse")
        pans = 14
        v, faces, couleurs = [(0.0, 0.012, 0.0)], [], []
        for r in anneaux[1:]:
            for i in range(pans):
                a = i / pans * math.tau
                v.append((math.cos(a) * r, 0.012, math.sin(a) * r))
        for j in range(len(anneaux) - 1):
            for i in range(pans):
                k = (i + 1) % pans
                if j == 0:
                    faces.append((0, 1 + i, 1 + k))
                else:
                    a0 = 1 + (j - 1) * pans
                    a1 = 1 + j * pans
                    faces.append((a0 + i, a1 + i, a1 + k, a0 + k))
                couleurs.append(tons[j % len(tons)])
        s.morceau(v, faces, "etoffe", couleurs, coeur=(0, -1, 0), sol=False)
    elif sorte == "tapis-long":
        # Chemin de couloir à bandes tissées, franges aux deux bouts.
        tons = ctx.tons("tresse")
        bandes = (-1.25, -1.05, -0.8, -0.35, 0.35, 0.8, 1.05, 1.25)
        v, faces, couleurs = [], [], []
        for x in bandes:
            v += [(x, 0.012, -0.36), (x, 0.012, 0.36)]
        for i in range(len(bandes) - 1):
            faces.append((2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2))
            couleurs.append(tons[[0, 2, 1, 3, 1, 2, 0][i]])
        s.morceau(v, faces, "etoffe", couleurs, coeur=(0, -1, 0), sol=False)
        for sx in (-1, 1):
            for k in range(6):
                z = -0.3 + k * 0.12
                s.morceau([(sx * 1.25, 0.012, z - 0.02), (sx * 1.25, 0.012, z + 0.02), (sx * 1.36, 0.012, z)], [(0, 1, 2)], "etoffe", ctx.un("creme"), coeur=(0, -1, 0), sol=False)
    # ------------------------------------------------------------------ sur un meuble
    elif sorte == "bocaux":
        groupe = entree["groupe"]
        if groupe == "confitures":
            # Confitures de l'été: bocaux de verre, couvercles de tissu à carreaux noués.
            for k, (x, z) in enumerate(((-0.12, -0.04), (0.0, 0.05), (0.12, -0.03))):
                colonne(s, x, z, 0, 0.13, 0.055, 6, "vitre", ctx.un("confiture", k), dessus=ctx.un("confiture", k))
                s.tube([(x, 0.13, z, 0.07), (x, 0.15, z, 0.05)], 6, "etoffe", ctx.un("etoffes", k), bouts=(False, True))
        elif groupe == "gres":
            # Pots de grès à saumure et une cruche: on conserve à la cave, on sert à la cuisine.
            _pot(s, -0.1, 0, 0.0, 0.1, 0.24, ctx.un("gres"), pans=7, contenu=ctx.un("bois_sombre"))
            _pot(s, 0.1, 0, -0.03, 0.08, 0.16, ctx.un("gres", 1), pans=7, contenu=ctx.un("bois_sombre"))
            s.tube([(0.08, 0, 0.11, 0.06), (0.08, 0.12, 0.11, 0.065), (0.08, 0.2, 0.11, 0.035), (0.08, 0.23, 0.11, 0.04)], 6, "vitre", ctx.un("gres", 2), bouts=(False, True), coupe=ctx.un("fond"))
        else:
            # Boîtes de fer peintes: sucre, café, farine (on les reconnaît à la couleur).
            for k, (x, h, c) in enumerate(((-0.12, 0.2, "peint_rouge"), (0.0, 0.17, "peint_bleu"), (0.11, 0.14, "peint_creme"))):
                colonne(s, x, 0.0, 0, h, 0.055, 6, "metal", ctx.un(c), dessus=ctx.un("fer_clair"))
                _plaque(s, x - 0.03, x + 0.03, h * 0.4, h * 0.7, 0.056, "etoffe", ctx.un("papier"))
    elif sorte == "bouquet":
        # Bouquet des champs dans un vase de faïence: coquelicots, ombelles, boutons d'or.
        s.tube([(0, 0, 0, 0.05), (0, 0.12, 0, 0.075), (0, 0.2, 0, 0.04), (0, 0.23, 0, 0.05)], 6, "vitre", ctx.un("peint_bleu"), bouts=(False, True), coupe=ctx.un("eau_sombre"))
        fleurs = ((-0.08, 0.42, 0.03, "coquelicot"), (0.07, 0.45, -0.02, "ombelle"), (0.0, 0.5, 0.05, "coquelicot"), (0.1, 0.38, 0.08, "bouton_or"), (-0.05, 0.4, -0.08, "ombelle"))
        for k, (x, y, z, c) in enumerate(fleurs):
            barre(s, (0, 0.2, 0), (x, y, z), 0.006, 3, "tige", ctx.un("tige"), bouts=(False, False))
            s.octa(0.04, 0.025, 0.04, at(x, y, z, k), "fleur", ctx.un(c, k), dessus=ctx.un(c, k + 1))
        bosse(s, 0, 0.2, 0, 0.1, 0.12, g, ctx.un("feuille_potager"), mat="feuillage", pans=5)
    elif sorte == "pile-de-livres":
        for k, (h, w, d, ry) in enumerate(((0.05, 0.26, 0.19, 0.0), (0.04, 0.24, 0.17, 0.12), (0.06, 0.22, 0.16, -0.1), (0.035, 0.18, 0.13, 0.25))):
            y = sum(p[0] for p in ((0.05,), (0.04,), (0.06,), (0.035,))[:k])
            _livre(s, ctx, penche(g + k, 0.015), y, penche(g + k * 3, 0.015), w, h, d, ctx.un("reliure", k), ry)
    elif sorte == "journal":
        # Journal plié en deux sur la table, colonnes imprimées, un coin relevé.
        s.box(0.3, 0.012, 0.21, at(0, 0.006, 0, 0.2), "etoffe", ctx.un("papier"), tremble=0.0)
        with s.groupe(at(0, 0.0125, 0, 0.2)):
            for k in range(3):
                x = -0.1 + k * 0.1
                _plaque_dessus(s, x - 0.04, x + 0.04, -0.07, 0.08, 0.0, ctx.un("encre_journal"))
            _plaque_dessus(s, -0.14, 0.14, -0.095, -0.08, 0.0, ctx.un("encre_journal"))
    elif sorte == "corbeille-de-pain":
        # Corbeille d'osier ovale, une miche et un morceau de baguette.
        m = at(0, 0, 0)
        m[:3, 0] *= 1.35
        with s.groupe(m):
            s.tube([(0, 0, 0, 0.13), (0, 0.08, 0, 0.16)], 8, "bois", ctx.un("osier"), bouts=(False, True), coupe=ton(ctx.un("osier"), 0.7))
        s.galet(0.12, 0.08, 0.1, at(-0.06, 0.06, 0, 0.3), "fruit", ctx.un("pain"), g, points=9, pose=0.2)
        barre(s, (0.0, 0.12, 0.06), (0.2, 0.1, -0.04), 0.03, 5, "fruit", ctx.un("pain", 1), coupe=ctx.un("farine"))
    else:
        raise SystemExit(f"{entree['id']}: sorte d'objet inconnue « {sorte} »")
    if foyer is not None:
        notice["light"] = _lumiere(entree, foyer)
    return s, notice


def _plaque_dessus(s: Atelier, x0, x1, z0, z1, y, couleur):
    """Plaque plate tournée vers le ciel (lignes imprimées d'un journal)."""
    s.morceau([(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2, 3)], "etoffe", couleur, coeur=((x0 + x1) / 2, y - 1.0, (z0 + z1) / 2), sol=False)


def objet(entree: dict, ctx) -> list[dict]:
    s, notice = _objet(entree["sorte"], entree, ctx, entree["graine"])
    return [_modele(entree["id"], s, states={}, variants=[], pourquoi=entree.get("pourquoi"), **notice)]


FAMILLES_INTERIEURS = {"objet": objet}
