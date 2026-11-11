"""Décor des fêtes d'Aubrune (`docs/jeux/jeu-1/refonte/ecriture-fetes.md`, « Ce qu'il manque »).

Famille `fete`: des meubles du dehors posés pour un jour de fête (lu sur `aubrune.fete.jour`).
Mêmes règles que les meubles (`amenagements.py`): origine au centre de l'emprise de la fiche,
avant vers +z (le côté d'où l'on s'en sert, ou d'où on le regarde), rien hors de ses cases.
Ce qui brûle est en `flamme` (il luit quand la lampe est allumée, la nuit) et l'entrée donne
`lumiere` (rayon de la flaque au sol), comme les lanternes.

Raisons d'être tenues ici:
- le lumignon est coulé dans une coquille d'œuf posée sur une soucoupe de terre: on le pose
  par terre, sur un seuil, une lisse ou un tonneau, et il tient debout;
- une guirlande pend entre deux poteaux de 3 m: on passe dessous sans baisser la tête (2,4 m au
  plus bas); chaque module porte son poteau ouest, le poteau de bout ferme la file à l'est;
- la grande marmite pend au-dessus du feu, pas dedans: 25 cm d'air entre les flammes et le cul;
- la lisse fleurie est baissée en travers de la route (5 m), le contrepoids côté poteau, et
  repose sur sa fourche au bout: c'est la barrière du passage à niveau un jour de fête;
- le tonneau en perce est debout sur son chantier, le robinet à hauteur de cruche;
- l'ardoise du chevalet est penchée vers l'arrière: on la lit debout, la caméra aussi.
"""

from __future__ import annotations

import math

from amenagements import _lumiere, _pot, _table, barre, boite, colonne
from formes import Atelier, at, entre, penche, ton


def _poteau(s, ctx, x, z, haut, couleur=None):
    """Poteau de fête: une perche équarrie fichée en terre, un crochet au sommet."""
    c = couleur or ctx.un("bois_grise")
    boite(s, x - 0.045, x + 0.045, 0, haut, z - 0.045, z + 0.045, "bois", c, dessus=ctx.un("bois_coupe"))
    s.octa(0.03, 0.03, 0.03, at(x, haut - 0.08, z + 0.05), "metal", ctx.un("fer"))


def _chainette(a, b, fleche, n):
    """Points d'un fil pendu entre a et b, de flèche `fleche` au milieu."""
    out = []
    for k in range(n + 1):
        t = k / n
        out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - fleche * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t))
    return out


def _fanions(s, ctx, pts, graine, taille=0.16):
    """Fanions triangulaires le long d'un fil, couleurs du bourg en alternance."""
    tons = ctx.tons("etoffes")
    for k in range(len(pts) - 1):
        a, b = pts[k], pts[k + 1]
        mx, my, mz = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2
        s.morceau([a, b, (mx, my - taille, mz + 0.01)], [(0, 1, 2)], "etoffe", tons[(k + int(graine)) % len(tons)], coeur=(mx, my - taille / 2, mz - 1.0), double=True, envers=ton(tons[(k + int(graine)) % len(tons)], 0.8))


def _fil(s, ctx, pts, r=0.008):
    for a, b in zip(pts, pts[1:]):
        barre(s, a, b, r, 3, "metal", ctx.un("fer"), bouts=(False, False))


def _lampion(s, ctx, x, y, z, couleur, r=0.1, h=0.22):
    """Lampion de papier plissé (il luit la nuit): soufflet à pans, coiffe et culot sombres."""
    s.tube([(x, y - h, z, r * 0.55), (x, y - h * 0.75, z, r * 0.92), (x, y - h * 0.4, z, r), (x, y - h * 0.12, z, r * 0.8), (x, y - 0.02, z, r * 0.5)], 6, "flamme", couleur, bouts=(True, True))
    boite(s, x - 0.02, x + 0.02, y - 0.03, y, z - 0.02, z + 0.02, "metal", ctx.un("fer"), tremble=0.0)


def _flammes(s, ctx, x, y, z, rayon, n, graine, haut=0.3):
    """Feu de bois: des langues de flamme (`flamme`), braises au pied."""
    braise = ctx.tons("braise")
    for k in range(n):
        a = graine + k / n * math.tau
        d = 0.0 if k == 0 else rayon * entre(0.3, 0.7, graine + k)
        h = haut * entre(0.6, 1.1, graine + k * 1.7) * (1.25 if k == 0 else 1.0)
        px, pz = x + math.cos(a) * d, z + math.sin(a) * d
        s.morceau([(px - 0.05, y, pz - 0.03), (px + 0.05, y, pz - 0.03), (px + 0.035, y, pz + 0.05), (px - 0.04, y, pz + 0.045), (px + penche(graine + k, 0.04), y + h, pz + penche(graine + k + 2, 0.04))],
                  [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], "flamme", braise[k % len(braise)], coeur=(px, y + h * 0.3, pz))


def _buches_croisees(s, ctx, x, z, rayon, graine, y=0.0):
    ecorce = ctx.tons("ecorce_chene")
    coupe = ctx.un("bois_coupe")
    for k in range(4):
        a = graine + k * math.pi / 2 + 0.3
        dx, dz = math.cos(a) * rayon, math.sin(a) * rayon
        s.tube([(x + dx, y + 0.05, z + dz, 0.05), (x + dx * 0.15, y + 0.13, z + dz * 0.15, 0.045)], 5, "bois", ecorce[k % len(ecorce)], bouts=(True, False), coupe=coupe)


def _chaise(s, ctx, x, z, cap):
    """Chaise de musicien, paillée."""
    bois = ctx.tons("bois_meuble")
    with s.groupe(at(x, 0, z, cap)):
        boite(s, -0.2, 0.2, 0.42, 0.46, -0.2, 0.2, "bois", ctx.un("paille"), dessus=ctx.un("paille", 1))
        for sx in (-1, 1):
            for sz in (-1, 1):
                boite(s, sx * 0.17 - 0.02, sx * 0.17 + 0.02, 0, 0.42 if sz > 0 else 0.92, sz * 0.17 - 0.02, sz * 0.17 + 0.02, "bois", bois[0], sans="y-")
        boite(s, -0.17, 0.17, 0.75, 0.88, -0.19, -0.16, "bois", bois[1], sans="y-")


def _une_fete(sorte: str, entree: dict, ctx, graine: float, vide: bool):
    s = Atelier(graine)
    notice: dict = {}
    fer = ctx.tons("fer")
    bois = ctx.tons("bois_meuble")
    foyer = None
    if sorte == "lumignon":
        # Soucoupe de terre cuite, coquille d'œuf coulée de cire, mèche et flamme.
        colonne(s, 0, 0, 0, 0.022, 0.085, 8, "terre", ctx.un("terre_cuite"), r1=0.095, dessus=ctx.un("terre_cuite", 1))
        s.tube([(0, 0.022, 0, 0.03), (0, 0.04, 0, 0.046), (0, 0.068, 0, 0.05), (0, 0.088, 0, 0.044)], 7, "vitre", ctx.un("coquille"), bouts=(False, True), coupe=ctx.un("cire"))
        barre(s, (0, 0.088, 0), (0, 0.1, 0), 0.004, 3, "bois", ctx.un("noir"), bouts=(False, True))
        s.octa(0.016, 0.036, 0.016, at(0, 0.132, 0), "flamme", ctx.un("braise", 1))
        foyer = [0.0, 0.13, 0.0]
    elif sorte == "guirlande":
        # Un poteau à l'ouest, la guirlande pendue jusqu'au poteau suivant (4 m plus à l'est).
        x0, x1, h = -1.92, 1.99, 2.95
        _poteau(s, ctx, x0, 0.0, 3.05)
        pts = _chainette((x0, h, 0.04), (x1, h, 0.04), 0.5, 8)
        _fil(s, ctx, pts)
        tons = ctx.tons("lampions")
        for k in range(1, 8):
            x, y, z = pts[k]
            _lampion(s, ctx, x, y - 0.01, z, tons[k % len(tons)])
        foyer = [0.0, 2.3, 0.04]
    elif sorte == "poteau-guirlande":
        # Le poteau qui ferme une file de guirlandes, à l'est: un crochet, rien d'autre.
        _poteau(s, ctx, 0.08, 0.0, 3.05)
    elif sorte == "estrade":
        # Estrade de fanfare (4 x 3 cases): plancher à 60 cm sur une jupe de planches, deux marches
        # au milieu de l'avant, quatre perches et un cordon de fanions, chaises, pupitres, grosse caisse.
        w, d, h = 3.8, 2.34, 0.6
        z0 = -0.29
        clair = ctx.tons("bois_clair")
        boite(s, -w / 2, w / 2, 0, h - 0.06, z0 - d / 2, z0 + d / 2, "bardage", ctx.un("bois_grise"), sans="y- y+")
        n = 9
        for k in range(n):
            x0 = -w / 2 + k * w / n
            boite(s, x0 + 0.005, x0 + w / n - 0.005, h - 0.06, h, z0 - d / 2 - 0.03, z0 + d / 2 + 0.03, "bois", clair[k % len(clair)], tremble=0.002, sans="y-")
        # Marches devant (+z).
        for k, (yy, dz) in enumerate(((0.2, 0.62), (0.4, 0.32))):
            boite(s, -0.55, 0.55, 0, yy, z0 + d / 2, z0 + d / 2 + dz, "bois", clair[(k + 1) % len(clair)], dessus=clair[k % len(clair)])
        # Perches et cordon de fanions (on joue sous les fanions, pas sous un toit).
        coins = [(-w / 2 + 0.06, z0 - d / 2 + 0.06), (w / 2 - 0.06, z0 - d / 2 + 0.06), (w / 2 - 0.06, z0 + d / 2 - 0.06), (-w / 2 + 0.06, z0 + d / 2 - 0.06)]
        for x, z in coins:
            boite(s, x - 0.035, x + 0.035, h, h + 1.95, z - 0.035, z + 0.035, "bois", ctx.un("peint_vert"), dessus=ctx.un("laiton"))
        for i in range(4):
            a, b = coins[i], coins[(i + 1) % 4]
            pts = _chainette((a[0], h + 1.88, a[1]), (b[0], h + 1.88, b[1]), 0.22, 5 if i % 2 == 0 else 4)
            _fanions(s, ctx, pts, graine + i)
        # Garde-corps derrière et sur les côtés (on ne recule pas dans le vide).
        boite(s, -w / 2 + 0.04, w / 2 - 0.04, h + 0.8, h + 0.86, z0 - d / 2 + 0.03, z0 - d / 2 + 0.09, "bois", bois[0])
        for sx in (-1, 1):
            boite(s, sx * (w / 2 - 0.06) - 0.03, sx * (w / 2 - 0.06) + 0.03, h + 0.8, h + 0.86, z0 - d / 2 + 0.06, z0 + d / 2 - 0.06, "bois", bois[0])
        # Musiciens absents: leurs chaises, deux pupitres, la grosse caisse.
        for k, x in enumerate((-1.2, -0.4, 0.4, 1.2)):
            with s.groupe(at(0, h, 0)):
                _chaise(s, ctx, x, z0 - 0.35 - 0.12 * (k % 2), penche(graine + k, 0.2))
        for x in (-0.8, 0.8):
            with s.groupe(at(0, h, 0)):
                barre(s, (x, 0, z0 + 0.25), (x, 1.05, z0 + 0.25), 0.012, 3, "metal", fer[0], bouts=(False, True))
                s.box(0.34, 0.24, 0.015, at(x, 1.12, z0 + 0.25, 0, -0.6), "metal", fer[0], tremble=0.0)
                s.box(0.28, 0.2, 0.01, at(x, 1.13, z0 + 0.262, 0, -0.6), "etoffe", ctx.un("papier"), tremble=0.0)
        with s.groupe(at(1.35, h, z0 + 0.7)):
            s.tube([(-0.17, 0.33, 0, 0.32), (0.17, 0.33, 0, 0.32)], 10, "etoffe", ctx.un("peint_rouge"), bouts=(True, True), coupe=ctx.un("creme"))
            for sx in (-1, 1):
                s.tube([(sx * 0.17, 0.33, 0, 0.335), (sx * 0.2, 0.33, 0, 0.335)], 10, "bois", ctx.un("laiton"), bouts=(False, False))
            for sz in (-1, 1):
                barre(s, (0, 0, sz * 0.18), (0, 0.06, sz * 0.12), 0.02, 3, "bois", bois[1])
        notice["top"] = h
    elif sorte == "grande-marmite":
        # Grand chaudron du concours (2 x 2 cases) pendu à un trépied au-dessus d'un feu de bois.
        pierre = ctx.tons("pierre")
        for k in range(9):
            a = k / 9 * math.tau + graine
            s.galet(0.1, 0.09, 0.09, at(math.cos(a) * 0.62, 0, math.sin(a) * 0.62, a), "pierre", pierre[k % len(pierre)], graine + k, points=8, dessus=ctx.un("fond") if k % 3 == 0 else None)
        _buches_croisees(s, ctx, 0, 0, 0.42, graine)
        if not vide:
            _flammes(s, ctx, 0, 0.08, 0, 0.3, 5, graine, haut=0.32)
        # Trépied: trois jambes de fer jointes au sommet, la chaîne, le chaudron.
        sommet = (0, 1.9, 0)
        for k in range(3):
            a = k / 3 * math.tau + 0.5
            barre(s, (math.cos(a) * 0.9, 0, math.sin(a) * 0.9), sommet, 0.025, 4, "metal", fer[0], bouts=(False, False))
        barre(s, sommet, (0, 1.27, 0), 0.012, 3, "metal", fer[1], bouts=(False, False))
        barre(s, (-0.44, 1.18, 0), (0, 1.27, 0), 0.01, 3, "metal", fer[1], bouts=(False, False))
        barre(s, (0.44, 1.18, 0), (0, 1.27, 0), 0.01, 3, "metal", fer[1], bouts=(False, False))
        s.tube([(0, 0.66, 0, 0.18), (0, 0.72, 0, 0.36), (0, 0.9, 0, 0.45), (0, 1.12, 0, 0.44), (0, 1.17, 0, 0.46)], 12, "metal", fer[0], bouts=(True, True), coupe=ctx.un("soupe") if not vide else ctx.un("fond"))
        barre(s, (0.1, 1.1, 0.05), (0.42, 1.48, 0.2), 0.016, 4, "bois", ctx.un("bois_clair"))
        foyer = [0.0, 0.25, 0.0]
    elif sorte == "brasero":
        # Brasero de la veillée: corbeille de fer sur trois pieds, braises qui rougeoient.
        for k in range(3):
            a = k / 3 * math.tau + 0.2
            barre(s, (math.cos(a) * 0.36, 0, math.sin(a) * 0.36), (math.cos(a) * 0.24, 0.6, math.sin(a) * 0.24), 0.02, 4, "metal", fer[0], bouts=(False, True))
        s.tube([(0, 0.55, 0, 0.2), (0, 0.66, 0, 0.3), (0, 0.84, 0, 0.36)], 9, "metal", fer[0], bouts=(True, False))
        s.tube([(0, 0.84, 0, 0.36), (0, 0.87, 0, 0.375)], 9, "metal", fer[1], bouts=(False, False))
        colonne(s, 0, 0, 0.6, 0.8, 0.33, 9, "flamme", ctx.un("braise", 2), dessus=ctx.un("braise"))
        _flammes(s, ctx, 0, 0.8, 0, 0.22, 4, graine, haut=0.24)
        foyer = [0.0, 0.95, 0.0]
    elif sorte == "lisse-fleurie":
        # Lisse du passage à niveau, baissée en travers de la route: poteau et contrepoids à
        # l'ouest, bras rouge et blanc de 4,5 m, fourche au bout; une guirlande de fleurs l'enroule.
        px, py = -2.05, 1.0
        boite(s, px - 0.13, px + 0.13, 0, 1.12, -0.13, 0.13, "metal", ctx.un("peint_creme"), dessus=ctx.un("fer"))
        barre(s, (px, py, -0.16), (px, py, 0.16), 0.03, 6, "metal", fer[0])
        boite(s, -2.48, px - 0.05, py - 0.14, py + 0.14, 0.13, 0.25, "metal", fer[0], dessus=ctx.un("fer_clair"))
        bandes = 9
        long = 4.45
        for k in range(bandes):
            x0 = px + k * long / bandes
            barre(s, (x0, py, 0.19), (x0 + long / bandes, py, 0.19), 0.055 - 0.002 * k, 6, "bois", ctx.un("feu_rouge") if k % 2 == 0 else ctx.un("creme"), bouts=(k == bandes - 1, False))
        # Fourche d'appui au bout.
        fx = px + long - 0.12
        boite(s, fx - 0.04, fx + 0.04, 0, py - 0.06, 0.15, 0.23, "metal", fer[1], sans="y-")
        boite(s, fx - 0.04, fx + 0.04, py - 0.06, py + 0.05, 0.1, 0.12, "metal", fer[1])
        # Guirlande: feuillage et fleurs des prés enroulés autour du bras.
        fleurs = [ctx.un("coquelicot"), ctx.un("ombelle"), ctx.un("bouton_or"), ctx.un("coquelicot", 1)]
        vert = ctx.tons("feuille_potager")
        n = 22
        for k in range(n):
            t = (k + 0.5) / n
            x = px + 0.2 + t * (long - 0.4)
            a = k * 1.9
            y, z = py + math.sin(a) * 0.075, 0.19 + math.cos(a) * 0.075
            if k % 3 == 1:
                s.feuille((x, y, z), (math.cos(k), 0.6, math.sin(k) * 0.6 + 0.3), 0.11, 0.06, "tige", vert[k % len(vert)], envers=ton(vert[0], 0.75), cambre=0.2)
            else:
                s.octa(0.065, 0.05, 0.065, at(x, y + 0.01, z, k), "fleur", fleurs[k % len(fleurs)])
        # Le nœud de ruban près du poteau.
        rouge = ctx.un("peint_rouge")
        for sgn in (-1, 1):
            s.morceau([(px + 0.32, py + 0.02, 0.26), (px + 0.32 + sgn * 0.15, py + 0.1, 0.27), (px + 0.32 + sgn * 0.15, py - 0.06, 0.27)], [(0, 1, 2)], "etoffe", rouge, coeur=(px + 0.32, py, 0.0), double=True)
            s.morceau([(px + 0.32, py, 0.26), (px + 0.32 + sgn * 0.08, py - 0.32, 0.28), (px + 0.32 + sgn * 0.14, py - 0.28, 0.28)], [(0, 1, 2)], "etoffe", rouge, coeur=(px + 0.32, py - 0.2, 0.0), double=True)
    elif sorte == "banderole":
        # Banderole tendue entre deux perches, face au sud (+z): toile crème bordée de rouge, le
        # nom de la fête peint en lettres sombres.
        for x in (-1.92, 1.92):
            _poteau(s, ctx, x, 0.0, 3.2)
        n = 8
        haut, bas = 2.95, 2.45
        creme, rouge, encre = ctx.un("creme"), ctx.un("peint_rouge"), ctx.un("fond")
        v, f, c = [], [], []
        for k in range(n + 1):
            t = k / n
            x = -1.85 + 3.7 * t
            sag = 0.12 * 4 * t * (1 - t)
            for yy in (haut - sag, haut - sag - 0.08, bas - sag + 0.08, bas - sag):
                v.append((x, yy, 0.0))
        for k in range(n):
            for j in range(3):
                a = k * 4 + j
                f.append((a, a + 1, a + 5, a + 4))
                c.append(creme if j == 1 else rouge)
        s.morceau(v, f, "etoffe", c, coeur=(0, 2.7, -1.0), double=True, envers=ton(creme, 0.85))
        # Lettres: des traits peints (de loin, une ligne d'écriture).
        for k in range(11):
            t = (k + 0.5) / 11
            x = -1.6 + 3.2 * t
            sag = 0.12 * 4 * ((x + 1.85) / 3.7) * (1 - (x + 1.85) / 3.7)
            hh = 0.2 if k % 4 else 0.24
            boite(s, x - 0.07, x + 0.07, 2.6 - sag, 2.6 - sag + hh, 0.004, 0.012, "etoffe", encre, tremble=0.0, sans="y- z-")
    elif sorte == "table-banquet":
        # Grande table du banquet (3 x 1 cases): nappe blanche qui tombe, bols de soupe, pain,
        # pichets de cidre, la tourte au milieu.
        _table(s, ctx, 2.8, 0.8, 0.76, epaisseur=0.05)
        creme = ctx.un("creme")
        boite(s, -1.44, 1.44, 0.76, 0.768, -0.44, 0.44, "etoffe", creme, tremble=0.0, sans="y-")
        for sz in (-1, 1):
            boite(s, -1.44, 1.44, 0.6, 0.768, sz * 0.44 - 0.004, sz * 0.44 + 0.004, "etoffe", ton(creme, 0.95), tremble=0.0, sans="y- y+")
        y = 0.768
        for k in range(6):
            x = -1.15 + k * 0.46
            for sz in (-1, 1):
                if (k + (sz > 0)) % 2:
                    continue
                _pot(s, x, y, sz * 0.25, 0.075, 0.07, ctx.un("vaisselle", k), contenu=ctx.un("soupe"))
        for k, x in enumerate((-0.75, 0.75)):
            s.galet(0.15, 0.09, 0.11, at(x, y, 0.02, 0.3 + k), "fruit", ctx.un("pain", k), graine + k, points=9, pose=0.15)
            _pot(s, x * 1.45, y, -0.05, 0.07, 0.2, ctx.un("gres", k), contenu=ctx.un("cidre"))
        s.tube([(0, y, 0, 0.19), (0, y + 0.05, 0, 0.2), (0, y + 0.075, 0, 0.16)], 10, "fruit", ctx.un("tourte"), bouts=(False, True), coupe=ctx.un("tourte", 1))
        notice["top"] = 0.76
    elif sorte == "tonneau-en-perce":
        # Tonneau debout sur son chantier, mis en perce: robinet de laiton devant (+z), la cruche
        # dessous, deux gobelets sur le fond.
        boite(s, -0.34, 0.34, 0, 0.16, -0.28, -0.18, "bois", bois[1])
        boite(s, -0.34, 0.34, 0, 0.16, 0.18, 0.28, "bois", bois[1])
        y0, y1 = 0.16, 1.02
        s.tube([(0, y0, 0, 0.26), (0, y0 + 0.22, 0, 0.31), (0, (y0 + y1) / 2, 0, 0.325), (0, y1 - 0.22, 0, 0.31), (0, y1, 0, 0.26)], 10, "bois", bois[0], bouts=(False, True), coupe=ctx.un("bois_clair"))
        for yy, rr in ((y0 + 0.08, 0.285), (y0 + 0.28, 0.318), (y1 - 0.28, 0.318), (y1 - 0.08, 0.285)):
            s.tube([(0, yy - 0.025, 0, rr), (0, yy + 0.025, 0, rr)], 10, "metal", fer[0], bouts=(False, False))
        barre(s, (0, y0 + 0.22, 0.3), (0, y0 + 0.22, 0.4), 0.025, 5, "metal", ctx.un("laiton"))
        barre(s, (0, y0 + 0.22, 0.38), (0, y0 + 0.31, 0.38), 0.012, 4, "metal", ctx.un("laiton"))
        _pot(s, 0.0, 0, 0.42, 0.075, 0.2, ctx.un("gres", 1), contenu=ctx.un("cidre"))
        for x in (-0.1, 0.12):
            _pot(s, x, y1, -0.05 + x * 0.3, 0.04, 0.09, ctx.un("gres", 2), contenu=ctx.un("cidre"))
    elif sorte == "ardoise":
        # Chevalet de bois et son ardoise à craie, penchée vers l'arrière, lisible debout (+z).
        clair = ctx.un("bois_clair")
        inc = -0.22
        for sx in (-1, 1):
            barre(s, (sx * 0.3, 0, 0.16), (sx * 0.26, 1.5, -0.12), 0.022, 4, "bois", bois[0], bouts=(False, True))
        barre(s, (0, 0, -0.42), (0, 1.42, -0.12), 0.02, 4, "bois", bois[1], bouts=(False, True))
        with s.groupe(at(0, 0.98, 0.0, 0, inc)):
            boite(s, -0.34, 0.34, -0.42, 0.42, -0.01, 0.01, "bois", ctx.un("ardoise"), tremble=0.0, sans="z-")
            for x0, x1, y0, y1 in ((-0.38, -0.34, -0.46, 0.46), (0.34, 0.38, -0.46, 0.46), (-0.38, 0.38, -0.46, -0.42), (-0.38, 0.38, 0.42, 0.46)):
                boite(s, x0, x1, y0, y1, -0.025, 0.025, "bois", clair, sans="z-")
            craie = ctx.un("craie")
            for k, (x0, larg) in enumerate(((-0.24, 0.42), (-0.24, 0.3), (-0.24, 0.46), (-0.16, 0.26), (-0.24, 0.36))):
                y = 0.28 - k * 0.13
                boite(s, x0, x0 + larg, y, y + 0.025 + (0.01 if k == 0 else 0.0), 0.011, 0.015, "etoffe", craie, tremble=0.0, sans="z-")
            boite(s, -0.36, 0.36, -0.5, -0.47, 0.0, 0.07, "bois", clair)
            boite(s, 0.1, 0.17, -0.47, -0.45, 0.02, 0.04, "etoffe", craie, tremble=0.0)
    else:
        raise SystemExit(f"{entree['id']}: sorte de décor de fête inconnue « {sorte} »")
    if foyer is not None:
        notice["light"] = _lumiere(entree, foyer)
    return s, notice


def fete(entree: dict, ctx) -> list[dict]:
    sorte = entree["sorte"]
    out = []
    etats = {}
    if "bare" in entree.get("etats", []):
        ident = f"{entree['id']}-bare"
        s, notice = _une_fete(sorte, entree, ctx, entree["graine"], True)
        out.append({"id": ident, "atelier": s, "etat": "bare", "de": entree["id"], **notice})
        etats["bare"] = ident
    s, notice = _une_fete(sorte, entree, ctx, entree["graine"], False)
    out.append({"id": entree["id"], "atelier": s, "states": etats, "variants": [], "pourquoi": entree.get("pourquoi"), **notice})
    return out


FAMILLES_FETES = {"fete": fete}
