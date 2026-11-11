#!/usr/bin/env python3
"""Compose le plan vu du dessus d'Aubrune (refonte), écrit plan.json, dessine les SVG et les PNG.

Usage: python3 -I construire_plan.py
Tout est composé ici, en code: ne jamais retoucher plan.json ni les SVG à la main.
Unité: 1 m. Axes: x vers l'est, y vers le sud. Origine au coin nord-ouest.
Repère de l'ancienne carte (halte.json): ancien (x, y) = nouveau (x - 100, y - 84) pour le coeur du bourg.
"""
import heapq
import json
import math
import os
import random
import subprocess

ICI = os.path.dirname(os.path.abspath(__file__))
L, H = 320, 208
# Vitesses du jeu (m/s): marche 1,5 et course 3,2 (décision du client, 2026-11-10; avant: 3 et 5).
MARCHE, COURSE, DRAISINE = 1.5, 3.2, 8.0


def vit(v):
    return ('%g' % v).replace('.', ',')

# ---------------------------------------------------------------- zones
ZONES = {
    'B': dict(nom='Le bourg et le passage à niveau', acte=1, couleur='#E9D9A8', poly=[
        (82, 100.5), (100, 100.5), (100, 90), (98, 82), (172, 82), (172, 63), (232, 63), (232, 100), (254, 100),
        (254, 138.5), (222, 132.5), (184, 129.5), (140, 129.5), (110, 130.5), (110, 125), (82, 126.5)]),
    'R': dict(nom='La rivière et le bief', acte=2, couleur='#A9C9DC', poly=[
        (0, 140), (26, 136), (34, 137), (52, 130.5), (66, 125.5), (70, 126), (78, 126), (82, 126.5), (110, 125),
        (110, 130.5), (140, 129.5), (184, 129.5), (222, 132.5), (258, 139.5), (290, 151.5), (320, 157.5),
        (320, 166.5), (290, 160.5), (258, 148.5), (222, 141.5), (184, 138.5), (140, 138.5), (96, 140.5),
        (66, 147.5), (36, 156.5), (0, 160.5)]),
    'V': dict(nom="La voie jusqu'au poste d'aiguillage", acte=2, couleur='#D3C3B5', poly=[
        (0, 88), (100, 90), (100, 100.5), (58, 102), (46, 110), (42, 134), (34, 137), (26, 136), (0, 140)]),
    'C': dict(nom='La Côte', acte=3, couleur='#8FB07A', poly=[
        (0, 0), (250, 0), (250, 63), (172, 63), (172, 82), (98, 82), (100, 90), (0, 88)]),
    'M': dict(nom='Le moulin', acte=3, couleur='#E3B98F', poly=[
        (58, 102), (82, 100.5), (82, 126.5), (78, 126), (70, 126), (66, 125.5), (52, 130.5), (46, 110)]),
    'F': dict(nom='La ferme', acte=3, couleur='#D9CF7E', poly=[
        (66, 147.5), (96, 140.5), (140, 138.5), (184, 138.5), (222, 141.5), (258, 148.5), (270, 153),
        (270, 204), (66, 204)]),
    'T': dict(nom='Le tunnel', acte=3, couleur='#B9B2C6', poly=[
        (250, 0), (320, 0), (320, 100), (232, 100), (232, 63), (250, 63)]),
}

# ---------------------------------------------------------------- eau
EAUX = [
    dict(id='aubrune', nom="l'Aubrune", largeur=9, pts=[(0, 156), (36, 152), (66, 143), (96, 136), (140, 134),
         (184, 134), (222, 137), (258, 144), (290, 156), (320, 162)],
         source=dict(type='bord'), exutoire=dict(type='bord'),
         raison="la rivière entre par l'ouest (amont) et sort par l'est; sa rive nord porte le chemin de la berge"),
    dict(id='bief', nom='le bief du moulin', largeur=3, pts=[(20, 149.5), (36, 141), (54, 133), (68, 128), (76, 127.5)],
         source=dict(type='eau', id='aubrune'), exutoire=dict(type='eau', id='fuite'),
         raison="canal pris sur l'Aubrune à la vanne, tenu plus haut que la rivière pour donner sa chute à la roue"),
    dict(id='fuite', nom='le canal de fuite', largeur=3, pts=[(76, 127.5), (82, 131), (86, 135.5)],
         source=dict(type='eau', id='bief'), exutoire=dict(type='eau', id='aubrune'),
         raison="l'eau qui a fait tourner la roue retourne à la rivière"),
    dict(id='ru', nom='le ru de la Côte', largeur=2, pts=[(176, 22), (174, 32), (172, 40), (168, 48), (164, 60),
         (164, 110), (164, 131)],
         source=dict(type='source', poi='source'), exutoire=dict(type='eau', id='aubrune'),
         raison="né à la source de la Côte, il remplit l'étang, passe sous la voie par un ponceau et se jette dans l'Aubrune"),
    dict(id='rigole', nom='la rigole du lavoir', largeur=1, pts=[(164, 111), (162.5, 113.2), (162.5, 118.8), (164, 121)],
         source=dict(type='eau', id='ru'), exutoire=dict(type='eau', id='ru'),
         raison="dérivation du ru: eau claire qui entre en haut du bassin et ressort en bas, jamais l'eau de la rivière"),
]
PLANS_EAU = [
    dict(id='etang', nom="l'étang de la Côte", cx=172, cy=40, rx=9, ry=7, alimente_par='ru',
         raison="retenue du ru derrière une petite digue (au sud), faite pour abreuver les bêtes du Haut; le ru en ressort par la bonde"),
]

# ---------------------------------------------------------------- voie ferrée
RAILS = [
    dict(id='ligne', nom='la Petite Ligne', pts=[(0, 97.5), (240, 97.5), (262, 94), (280, 84), (292, 70), (298, 52)]),
    dict(id='ligne_tunnel', nom='la ligne sous la Côte', tunnel=True, pts=[(298, 52), (299.5, 36), (300, 30), (300, 18), (300, 0)]),
    dict(id='garage', nom='la voie de garage du poste', pts=[(44, 97.5), (56, 93.5), (90, 93.5)]),
    dict(id='remise', nom='la voie de la remise', pts=[(138, 97.5), (150, 94.5), (156, 92.5)]),
]

# ---------------------------------------------------------------- noeuds (x, y, zone, raison d'une impasse)
N = {}


def n(i, x, y, z, impasse=None):
    N[i] = dict(x=x, y=y, zone=z)
    if impasse:
        N[i]['impasse'] = impasse


# bourg
n('quai', 140, 102.5, 'B'); n('quai_o', 123, 101.5, 'B'); n('quai_e', 149.5, 102, 'B')
n('n0', 118.5, 92, 'B'); n('pn', 118.5, 97.5, 'B'); n('pn_s', 118.5, 101.5, 'B'); n('gr0', 118.5, 108, 'B')
n('hd', 118.5, 115, 'B'); n('bg', 118.5, 126.5, 'B')
n('gr1', 140, 108, 'B'); n('gr2', 156, 108, 'B'); n('gr3', 164, 108, 'B'); n('gr4', 170, 108, 'B')
n('gr5', 182.5, 108, 'B'); n('gr6', 195.5, 108, 'B'); n('gr7', 211.5, 108, 'B'); n('gr8', 227.5, 108, 'B')
n('gr9', 250, 108, 'B')
n('pl', 140, 116, 'B'); n('pl_o', 133, 116, 'B'); n('lv', 154, 117, 'B')
n('bp', 140, 126, 'B'); n('bl', 156, 126, 'B'); n('br_o', 161.5, 126, 'B'); n('br_e', 166.5, 126, 'B')
n('be1', 184, 126, 'B'); n('bj', 195.5, 126.8, 'B'); n('be2', 210, 128, 'B'); n('be3', 230, 130.6, 'B')
n('be4', 252, 134.8, 'B'); n('cj', 251, 122, 'B')
n('ponton', 140, 129.3, 'B', "le ponton: on y vient pour pêcher, s'asseoir et regarder la rivière; il ne mène nulle part exprès")
n('cm1', 97, 108, 'B'); n('cm2', 89, 108, 'B'); n('mg', 83.5, 108, 'B')
n('cf0', 118.5, 87, 'B'); n('lis', 131, 92, 'B'); n('n1', 144.5, 92, 'B'); n('n2', 150, 92, 'B'); n('trav', 150, 97.5, 'B')
n('r0', 152, 84, 'B'); n('jd', 116.3, 121.3, 'B', "le jardin de la maison: le potager et le poulailler sont au bout de l'allée, on n'y passe pas pour aller ailleurs")
n('pne', 195.5, 97.5, 'B'); n('re1', 195.5, 90, 'B'); n('pv', 195.5, 82.5, 'B'); n('pv_o', 186, 82.5, 'B')
n('cs', 212, 81.5, 'B'); n('ci', 217, 74, 'B'); n('cn', 217, 66.5, 'B'); n('pnh', 227.5, 97.5, 'B')
# voie ouest
n('tw1', 98, 97.5, 'V'); n('tw2', 84, 97.5, 'V'); n('tw3', 66, 97.5, 'V'); n('tw4', 50, 97.5, 'V'); n('tw5', 43, 97.5, 'V')
n('po', 39, 100, 'V'); n('pg0', 34, 100, 'V'); n('pg', 33, 108, 'V'); n('d1', 35, 124, 'V')
# rivière, bief, île
n('bw2', 100, 128, 'R'); n('bw1', 85, 129.5, 'R'); n('i1', 79.5, 132.8, 'R'); n('i2', 68, 134.5, 'R')
n('i3', 54, 139.5, 'R'); n('i4', 37, 145.5, 'R'); n('v1', 32.5, 139.5, 'R')
n('vn', 24, 145.3, 'R', "la vanne et le déversoir: on y règle le niveau du bief (suite de la Baronne), on y pêche, on y fait des ricochets")
# moulin
n('mc', 74, 113, 'M'); n('me', 81, 121, 'M')
# ferme
n('gu_n', 118.5, 130, 'B'); n('gu_s', 118.5, 140, 'F'); n('f1', 118.5, 150, 'F'); n('fc', 134, 159, 'F')
n('fc2', 134, 167, 'F'); n('fe1', 162, 160, 'F'); n('fe2', 200, 158, 'F'); n('fe3', 238, 156, 'F'); n('pj_s', 252, 151, 'F')
n('fs1', 134, 184, 'F'); n('vr', 118.5, 183, 'F'); n('fs2', 104, 182, 'F'); n('fs3', 100, 160, 'F')
n('croix', 118.5, 197, 'F', "la croix de chemin, au bord de la carte: la vieille route continue vers un lieu futur, barrée par une barrière de pré; point de vue pour la photo")
# Côte
n('cf1', 118.5, 79, 'C'); n('c1', 116, 68, 'C'); n('c2', 98, 60, 'C'); n('c3', 76, 46, 'C'); n('c4', 58, 28, 'C')
n('c5', 88, 20, 'C'); n('c6', 114, 28, 'C'); n('cl', 122, 50, 'C'); n('e1', 146, 44, 'C'); n('et', 160, 42, 'C')
n('r1', 160, 74, 'C'); n('r2', 161, 58, 'C'); n('en', 163, 28, 'C'); n('so', 176, 19, 'C'); n('ee', 184, 36, 'C')
n('dg_o', 163, 49.5, 'C'); n('dg_e', 174, 50, 'C'); n('e2', 188, 48, 'C'); n('e3', 204, 54, 'C'); n('k1', 217, 60, 'C')
n('h1', 205, 26, 'C'); n('k2', 240, 44, 'C')
# tunnel
n('k3', 262, 36, 'T'); n('bv', 284, 30, 'T')
n('te1', 240, 97.5, 'T'); n('te2', 262, 94, 'T'); n('te3', 280, 84, 'T'); n('te4', 292, 70, 'T'); n('portail', 298, 52, 'T')
n('tu1', 299.5, 36, 'T'); n('tu2', 300, 30, 'T')
n('tu3', 300, 18, 'T', "le fond du tunnel: la voie se perd dans la brume derrière un éboulis; la cachette d'Émile est dans la dernière niche")

# ---------------------------------------------------------------- verrous (zones fermées par l'histoire)
VERROUS = {
    'V1': dict(acte=2, x=110, y=127, obstacle='le saule couché en travers du chemin de la berge',
               leve="Achille le fait débiter le jour de la leçon de pêche (acte 2)"),
    'V2': dict(acte=2, x=106, y=97.5, obstacle='les ronces de la tranchée, sur la voie',
               leve="Firmin donne le but « voie dégagée » (acte 2); hache de base"),
    'V2b': dict(acte=2, x=58, y=97.5, obstacle="trois frênes couchés sur la voie, trop gros pour la hache de base",
                leve="hache améliorée par Mado (acte 2): on bute, on revient avec l'outil"),
    'V3': dict(acte=3, x=118.5, y=135, obstacle='le gué emporté par la dernière crue (trois dalles manquent)',
               leve="Paulin Delmas remet les dalles en arrivant par le train (acte 3)"),
    'V4': dict(acte=3, x=80, y=110, obstacle='le portail de la cour du moulin, cadenassé, et le portillon de la berge',
               leve="Berthe arrive avec la clé (acte 3)"),
    'V5': dict(acte=3, x=118.5, y=83, obstacle='la barrière forestière de Basile (« coupe en cours »)',
               leve="Basile vous envoie au bois pour la chambre (acte 3)"),
    'V6': dict(acte=3, x=156, y=79, obstacle='le raidillon du ru, raviné',
               leve="Basile y pose trois rondins en marches (acte 3)"),
    'V7': dict(acte=3, x=217, y=63.5, obstacle='la porte haute du cimetière, fermée à clé',
               leve="Marthe prête la clé (acte 3, la coutume)"),
    'V8': dict(acte=3, x=234, y=97.5, obstacle='la grille de la Compagnie en travers de la voie (« Ligne fermée »)',
               leve="Firmin sort enfin la clé avec la lettre (acte 3); Jeanne connaît un trou, trop petit pour vous"),
    'V9': dict(acte=3, x=252, y=142.8, obstacle='la passerelle des Jardins, sans tablier', sens='raccourci',
               leve="les planches viennent de la ferme: raccourci ouvert depuis la rive sud (acte 3)"),
    'V10': dict(acte=3, x=292, y=30, obstacle="l'escalier de service du tunnel, verrouillé de l'intérieur", sens='raccourci',
                leve="on tire le verrou depuis le tunnel: raccourci vers le belvédère (acte 3)"),
    'V11': dict(acte=2, x=31.2, y=104.5, obstacle="le portillon du poste, fermé d'un loquet côté voie", sens='raccourci',
                leve="on l'ouvre depuis le poste: raccourci vers la vanne et le retour par la berge (acte 2)"),
}

# ---------------------------------------------------------------- arêtes (a, b, classe, nom, verrou)
A = []


def e(a, b, classe, nom=None, verrou=None):
    A.append(dict(a=a, b=b, classe=classe, nom=nom, verrou=verrou))


def chaine(ids, classe, nom=None):
    for a, b in zip(ids, ids[1:]):
        e(a, b, classe, nom)


chaine(['n0', 'pn', 'pn_s', 'gr0', 'hd', 'bg', 'gu_n'], 'route', 'route du Gué')
e('gu_n', 'gu_s', 'route', 'le gué', 'V3'); chaine(['gu_s', 'f1', 'vr', 'croix'], 'route', 'vieille route')
chaine(['gr0', 'gr1', 'gr2', 'gr3', 'gr4', 'gr5', 'gr6', 'gr7', 'gr8', 'gr9'], 'route', 'Grand-Route')
chaine(['quai_o', 'quai', 'quai_e'], 'rue', 'le quai'); e('quai_o', 'pn_s', 'rue'); e('quai', 'gr1', 'rue')
chaine(['quai_e', 'trav', 'n2'], 'chemin', 'traversée de service')
chaine(['gr1', 'pl', 'bp', 'ponton'], 'rue', 'la place'); e('pl_o', 'pl', 'rue')
chaine(['pl', 'lv', 'bl'], 'chemin', 'chemin du Lavoir'); e('lv', 'gr2', 'chemin', 'chemin du Lavoir')
chaine(['bg', 'bp', 'bl', 'br_o', 'br_e', 'be1', 'bj', 'be2', 'be3', 'be4'], 'chemin', 'chemin de la Berge')
e('gr6', 'bj', 'chemin', 'venelle des Jardins'); chaine(['gr9', 'cj', 'be4'], 'chemin', 'chemin des Jardins')
chaine(['gr0', 'cm1', 'cm2', 'mg'], 'chemin', 'chemin du Moulin'); e('mg', 'mc', 'chemin', 'chemin du Moulin', 'V4')
chaine(['mc', 'me'], 'chemin'); e('me', 'bw1', 'chemin', None, 'V4')
chaine(['cf0', 'n0', 'lis', 'n1', 'n2'], 'chemin', 'chemin de la Lisière')
chaine(['gr6', 'pne', 're1', 'pv', 'pv_o'], 'rue', "rue de l'Église"); chaine(['pv', 'cs', 'ci', 'cn'], 'chemin', 'allée du cimetière')
e('cn', 'k1', 'sentier', 'sentier des Crêtes', 'V7'); e('gr8', 'pnh', 'route')
chaine(['pn', 'trav', 'pne', 'pnh'], 'voie', 'sur la voie')
e('pn', 'tw1', 'voie', 'sur la voie', 'V2'); chaine(['tw1', 'tw2', 'tw3'], 'voie', 'la tranchée')
e('tw3', 'tw4', 'voie', 'la tranchée', 'V2b'); chaine(['tw4', 'tw5', 'po', 'pg0'], 'voie')
e('pg0', 'pg', 'sentier', 'descente du poste', 'V11'); chaine(['pg', 'd1', 'v1'], 'sentier', 'descente du poste')
e('v1', 'vn', 'sentier')
e('bg', 'bw2', 'chemin', 'chemin de la Berge', 'V1'); chaine(['bw2', 'bw1', 'i1', 'i2', 'i3', 'i4', 'v1'], 'sentier', "sentier de l'Île")
chaine(['f1', 'fc', 'fc2', 'fs1', 'vr', 'fs2', 'fs3', 'f1'], 'chemin', 'tour de la ferme')
chaine(['fc', 'fe1', 'fe2', 'fe3', 'pj_s'], 'chemin', 'chemin des Champs'); e('pj_s', 'be4', 'chemin', 'passerelle des Jardins', 'V9')
e('cf0', 'cf1', 'chemin', 'chemin forestier', 'V5'); chaine(['cf1', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'cl'], 'chemin', 'chemin forestier')
chaine(['c1', 'cl', 'e1', 'et'], 'sentier', 'sentier de la Côte')
e('n2', 'r0', 'sentier', 'sentier du Ru'); e('hd', 'jd', 'sentier', 'allée du jardin'); e('r0', 'r1', 'sentier', 'sentier du Ru', 'V6'); chaine(['r1', 'r2', 'et'], 'sentier', 'sentier du Ru')
chaine(['et', 'en', 'so', 'ee', 'e2'], 'sentier', "tour de l'étang"); chaine(['et', 'dg_o', 'dg_e', 'e2'], 'sentier', 'la digue')
chaine(['e2', 'e3', 'k1', 'k2', 'k3', 'bv'], 'sentier', 'sentier des Crêtes'); chaine(['so', 'h1', 'k2'], 'sentier', 'sentier du Haut')
e('pnh', 'te1', 'voie', 'sur la voie', 'V8'); chaine(['te1', 'te2', 'te3', 'te4', 'portail'], 'voie', 'la ligne morte')
chaine(['portail', 'tu1', 'tu2', 'tu3'], 'interieur', 'le tunnel'); e('tu2', 'bv', 'interieur', 'escalier de service', 'V10')

# ---------------------------------------------------------------- ouvrages (franchissements)
OUVRAGES = [
    dict(id='pn_garde', nature='passage à niveau', x=118.5, y=97.5, r=3, raison="gardé: deux lisses qui barrent la route (et non la voie), manoeuvrées depuis la maison du garde"),
    dict(id='trav_service', nature='traversée', x=150, y=96, r=4, raison="platelage de planches au bout du quai: Firmin traverse là chaque matin"),
    dict(id='pn_eglise', nature='passage à niveau', x=195.5, y=97.5, r=3, raison="la rue de l'Église existait avant la voie: simple croix de Saint-André"),
    dict(id='pn_hameaux', nature='passage à niveau', x=227.5, y=97.5, r=3, raison="accès de service à la voie, dernier point avant la grille de la Compagnie"),
    dict(id='ponceau', nature='ponceau', x=164, y=97.5, r=3, raison="voûte de pierre: le ru passe sous le remblai de la voie"),
    dict(id='pont_ru', nature='pont', x=164, y=108, r=3, raison="pont de pierre de la Grand-Route, 3 m entre parapets"),
    dict(id='passerelle_ru', nature='passerelle', x=164, y=126, r=3, raison="planches du chemin de la Berge sur le ru, juste avant son embouchure"),
    dict(id='ponton', nature='ponton', x=140, y=130.2, r=3, raison="dans l'axe de la place: on le voit depuis le puits"),
    dict(id='gue', nature='gué', x=118.5, y=135, r=6, raison="dans l'axe de la route du passage à niveau: la vieille route passait là avant tout pont"),
    dict(id='planches_fuite', nature='planches', x=82, y=131, r=3, raison="deux madriers sur le canal de fuite: le seul accès à pied sec à l'île du Bief"),
    dict(id='passerelle_vanne', nature='passerelle', x=34.5, y=142, r=3, raison="passerelle du meunier pour aller manoeuvrer la vanne"),
    dict(id='bonde', nature='digue', x=167.5, y=49.7, r=3, raison="on passe sur la digue de l'étang, au-dessus de la bonde"),
    dict(id='passerelle_jardins', nature='passerelle', x=252, y=142.8, r=6, raison="relie les champs de la ferme au bout de la Grand-Route: le raccourci du retour"),
    dict(id='deversoir', nature='déversoir', x=20, y=152, r=3, raison="seuil de pierre en travers de l'Aubrune, qui relève l'eau pour le bief (non franchissable)"),
]

# ---------------------------------------------------------------- bâtiments (rect x, y, l, h; porte; noeud)
B = []


def b(i, nom, x, y, l, h, porte, noeud, qui, raison, acte=1, ancien=None, interieur=None, sur_rail=None):
    B.append(dict(id=i, nom=nom, rect=[x, y, l, h], porte=list(porte) if porte else None, noeud=noeud, qui=qui,
                  raison=raison, acte=acte, ancien=ancien, interieur=interieur, sur_rail=sur_rail))


b('quai_b', 'le quai', 121, 99, 30, 4, None, 'quai', 'tous', "le coeur: le train s'arrête là, la caisse de la commande, le tableau, la cloche et la pendule y sont", ancien='platform', interieur=None)
b('halte', 'la halte', 151, 99, 10, 6, (156, 105), 'gr2', 'Firmin (bureau), consigne', "au bout est du quai, en ligne avec lui; porte au sud, sur la Grand-Route, là où arrivent les voyageurs à pied", ancien='station', interieur='salle des pas perdus, guichet, consigne (coffre commun), bureau de Firmin: 54 m²')
b('maison', 'la maison du garde-barrière', 104, 111, 11, 8, (115, 115), 'hd', 'les deux joueurs', "au passage à niveau; porte à l'est, vers la route: le garde sort et il est à sa barrière en dix pas. Emprise de la maison finie (88 m²), la ruine du début n'en occupe que la moitié est", ancien='gatekeeper_house', interieur='salle, cuisine, chambre, troisième pièce, étage, cave sous la chambre: 85 m² au sol')
b('epicerie', "l'épicerie-pension Ferrand", 122, 111, 8, 10, (130, 116), 'pl_o', 'Odette', "borde la place à l'ouest, vitrine et porte vers la place: on la voit en descendant du quai", ancien='ferrand_shop', interieur='boutique, cuisine, chambre de la pension: 70 m²')
b('scierie', "l'atelier de Basile", 102, 84, 10, 8, (112, 88), 'cf0', 'Basile', "contre le bois, au départ du chemin forestier: les grumes descendent et s'arrêtent là; porte et auvent à l'est, vers le chemin", ancien='sawmill', interieur='atelier et établi sous auvent: 60 m²')
b('firmin', 'la maison de Firmin', 141, 84, 7, 6, (144.5, 90), 'n1', 'Firmin', "en face du quai, de l'autre côté de la voie: il traverse par la traversée de service", ancien='firmin_house')
b('remise', 'la remise de la draisine', 156, 90, 6, 5, (156, 92.5), 'n2', 'draisine', "sur sa courte voie, porte à l'ouest dans l'axe des rails: la draisine sort droit sur la ligne (déplacée: l'ancienne avait sa porte au sud, sans rail devant)", acte=2, ancien='handcar_shed', sur_rail='remise')
b('fournil', "le fournil d'Achille", 165, 100, 7, 6, (168.5, 106), 'gr4', 'Achille', "sur la Grand-Route juste après le pont du ru: l'eau du pétrin est à sa porte", ancien='bakehouse', interieur='boutique et fournil: 36 m²')
b('mercerie', 'la mercerie-coiffure', 168, 111, 7, 7, (171.5, 111), 'gr4', 'Solange, Jeanne', "en face du fournil; porte au nord, sur la rue", ancien='salon_shop', interieur='boutique, fauteuil de coiffure, cabine: 42 m²')
b('ecole', "l'école-mairie", 180, 100, 7, 6, (183.5, 106), 'gr5', 'Armand (acte 2)', "au milieu du bourg, sa cour à l'ouest, entre le fournil et le café", acte=2, ancien='school_house', interieur='classe, archives de la mairie: 36 m²')
b('lucie', 'la maison de Lucie', 179, 111, 6, 6, (182, 111), 'gr5', 'Lucie (acte 2)', "en face de l'école, porte au nord sur la rue; la boîte aux lettres du bourg est à sa grille", acte=2, ancien='lucie_house')
b('cafe', 'le café de la Halte', 187, 100, 7, 6, (190.5, 106), 'gr6', 'Colette (acte 2)', "au carrefour de l'Église, terrasse et jeu de quilles au sud, côté soleil", acte=2, ancien='cafe', interieur='salle, comptoir, cuisine: 36 m²')
b('forge', 'la forge', 199, 100, 6, 6, (202, 106), 'gr6', 'Mado, Barnabé (acte 3)', "sur la Grand-Route, où passent les charrettes, à l'écart des maisons pour le bruit et le feu", ancien='forge', interieur='forge et appentis: 32 m²')
b('horloger', "l'atelier d'Ambroise", 208, 100, 7, 6, (211.5, 106), 'gr7', 'Ambroise', "ancienne menuiserie de la carte 0.13, reprise pour l'ancien régleur: à l'autre bout de la rue par rapport à la halte, il ne croise pas Firmin", ancien='joinery', interieur='atelier aux horloges: 36 m²')
b('honorine', "la maison d'Honorine", 218, 100, 6, 6, (221, 106), 'gr8', 'Honorine', "dernière maison avant le passage des Hameaux: de sa fenêtre elle voit la voie, c'est le témoin de la nuit de la fermeture", ancien='hamlet_house_a')
b('hameau_b', 'la maison aux volets clos', 230, 100, 6, 6, (233, 106), 'gr8', 'réserve (Nour, après la fin)', "une maison vide donne un habitant à accueillir plus tard", acte=4, ancien='hamlet_house_b')
b('hameau_c', 'la maison du bout', 228, 111, 6, 6, (231, 111), 'gr8', 'réserve (suite des lettres)', "destinataire d'une lettre en retard", acte=2, ancien='hamlet_house_c')
b('eglise', "l'église Saint-Aubin", 185, 67, 21, 12, (195.5, 79), 'pv', 'Marthe (clocher)', "sur le coteau, hors des crues, au bout de la rue de l'Église; portail au sud, sur le parvis; le clocher est à l'ouest de la nef", ancien='church', interieur="nef et clocher à trois niveaux (montée linéaire de la suite « La robe et la cloche »): 250 m²")
b('presbytere', 'le presbytère', 176, 79, 7, 7, (183, 82.5), 'pv_o', 'Martial (après la fin)', "contre l'église, porte à l'est sur le parvis", acte=4, ancien='presbytery')
b('marthe', 'la maison de Marthe', 187, 87, 6, 6, (193, 90), 're1', 'Marthe', "maison de la sonneuse, au pied du parvis, porte à l'est sur la rue de l'Église", ancien='sexton_house')
b('cheminot_o', 'la maison de cheminot (ouest)', 86, 110, 6, 6, (89, 110), 'cm2', 'réserve (Inès, après la fin)', "logements de la Compagnie près du passage à niveau; portes au nord, sur le chemin du Moulin", acte=4, ancien='rail_cottage_west')
b('cheminot_e', 'la maison de cheminot (est)', 94, 110, 6, 6, (97, 110), 'cm1', 'Barnabé avant son mariage: grenier (fanfare)', "voisine de la précédente", acte=2, ancien='rail_cottage_east')
b('lavoir', 'le lavoir', 157, 114, 5, 4, (157, 116), 'lv', 'tous (Armand et ses grenouilles)', "sur une dérivation du ru (eau claire), entre la halte, la place et la berge. Ouvert à l'OUEST, côté chemin: on y entre à pied sec; le bassin est côté ru. L'ancien s'ouvrait sur la rivière et n'était pas accessible", ancien='washhouse')
b('poste', "le poste d'aiguillage", 36, 101, 6, 4, (39, 101), 'po', 'personne (scène des leviers)', "au droit de l'aiguille de la voie de garage; porte au nord, face à la voie, cabine vitrée à l'étage d'où l'on voit le signal", acte=2, interieur='cabine des leviers à l’étage: 24 m²')
b('moulin', 'le moulin de la Vanne', 70, 118, 8, 8, (74, 118), 'mc', 'Berthe (acte 3)', "au bout du bief; la roue est sur le pignon sud, dans le bief; la porte au nord, sur la cour où s'arrêtent les charrettes", acte=3, ancien='mill', interieur='salle des meules et étage: 64 m² par niveau')
b('ferme_logis', 'le logis de la ferme Delmas', 136, 147, 9, 6, (140.5, 153), 'fc', 'Paulin, Margot, Léon (acte 3)', "sur la rive sud, hors du bourg, façade et porte au midi sur la cour (déplacée: l'ancienne ferme était serrée entre la route et la rivière, sans champs à elle)", acte=3, ancien='farmhouse', interieur='salle commune: 54 m²')
b('grange', 'la grange', 120, 162, 8, 10, (128, 167), 'fc2', 'les Delmas', "ferme la cour à l'ouest (vents de pluie), porte charretière à l'est sur la cour", acte=3, ancien='barn')
b('forestiere', 'la maison forestière', 62, 42, 6, 6, (68, 45), 'c3', 'réserve (Inès, après la fin)', "au bout carrossable du chemin forestier, porte à l'est sur le chemin", acte=4, ancien='forester_house')

# ---------------------------------------------------------------- repères visibles de loin
REPERES = [
    dict(id='clocher', nom='le clocher', x=188, y=73, h=22, raison="repère du nord-est: visible de la place, de la berge et de la ferme; sa cloche donne l'heure"),
    dict(id='chateau_eau', nom="le château d'eau de la halte", x=129, y=90.5, h=12, raison="repère du centre: réservoir des locomotives, au nord du quai; où qu'on soit dans le bourg, il dit où est le quai"),
    dict(id='semaphore', nom='le sémaphore', x=30, y=94.5, h=10, raison="repère de l'ouest: on le voit au bout de la tranchée dès qu'on a coupé les ronces; c'est lui qu'il faut faire bouger"),
    dict(id='roue', nom='la roue du moulin', x=74, y=127.6, h=7, raison="repère du sud-ouest: vue depuis l'île et depuis le chemin du Moulin, immobile jusqu'à l'acte 3"),
    dict(id='vieux_chene', nom='le Vieux Chêne', x=124, y=47, h=18, raison="repère de la Côte: sa tête dépasse du bois, on le voit depuis la lisière"),
    dict(id='portail_tunnel', nom='le portail du tunnel', x=298, y=50.5, h=8, raison="repère de l'est: une bouche noire au bout de la courbe, visible dès la grille"),
    dict(id='gros_noyer', nom='le Gros Noyer', x=102, y=184, h=16, raison="repère du sud: seul sur sa butte au milieu des prés, il oriente le tour de la ferme"),
    dict(id='pigeonnier', nom='le pigeonnier de la ferme', x=148, y=158, h=10, raison="vu depuis le ponton par-dessus la rivière: donne envie de passer le gué bien avant qu'il soit refait"),
]

# ---------------------------------------------------------------- points d'intérêt (id, nom, type, noeud, x, y, acte)
P = []


def p(i, nom, typ, noeud, x, y, acte=1):
    P.append(dict(id=i, nom=nom, type=typ, noeud=noeud, x=x, y=y, acte=acte))


p('arret', 'arrêt du train, banc du réveil', 'histoire', 'quai', 136, 100.5)
p('caisse', 'caisse de la commande du samedi', 'service', 'quai', 141, 101.5, 2)
p('pendule', 'la pendule arrêtée sur 5 h 12', 'histoire', 'quai_e', 148, 100.5)
p('barriere', 'la barrière et le lumignon', 'histoire', 'pn_s', 120.5, 100.5)
p('potager', 'le potager (6, 12 puis 24 cases)', 'activite', 'jd', 110, 122.5)
p('poulailler', 'le poulailler', 'activite', 'jd', 115.7, 124.6)
p('puits', 'la pompe de la place (toilette)', 'service', 'pl', 144, 113.5)
p('tonnelle', "la tonnelle d'Odette (souper)", 'repos', 'pl_o', 133, 120)
p('fetes', "l'est de la place, libre pour les fêtes", 'activite', 'pl', 146, 119)
p('banc_ponton', 'coin de pêche du ponton', 'activite', 'ponton', 141.5, 130.5, 2)
p('coquillages', 'grève aux coquillages', 'collecte', 'bg', 123, 128.5, 2)
p('lisiere', 'la lisière: les deux arbres à abattre', 'activite', 'lis', 131, 88)
p('etabli', "l'établi de Basile", 'service', 'cf0', 114.5, 90.5)
p('quilles', 'le jeu de quilles du café', 'activite', 'gr6', 190, 110.5, 2)
p('cour_ecole', "la cour de l'école (insectes, fossiles d'Armand)", 'collecte', 'gr5', 177, 103, 2)
p('boite', 'la boîte aux lettres', 'histoire', 'gr5', 186, 110.5, 2)
p('enclume', "l'enclume et la meule de Mado", 'service', 'gr6', 197.4, 103.5)
p('jardins', 'les jardins de la Rive', 'collecte', 'bj', 192.5, 121.5)
p('banc_berge', 'banc de la berge', 'repos', 'be1', 184, 124.5)
p('peche_aval', "coin de pêche de l'aval", 'activite', 'be3', 231, 133, 2)
p('car', "l'arrêt du car", 'histoire', 'gr9', 251.5, 106)
p('verger', 'le verger communal', 'collecte', 'cj', 246, 120)
p('parvis', 'le parvis et la corde de la cloche', 'histoire', 'pv', 199, 83.5)
p('cimetiere', 'la tombe des Lacombe', 'histoire', 'ci', 220, 73)
p('fouille_voie', 'fouilles du talus', 'collecte', 'pnh', 224, 95, 3)
p('saule', 'le saule couché', 'histoire', 'bw2', 104, 125.6, 2)
p('fosse', 'la fosse de la Baronne', 'activite', 'i2', 68, 131, 2)
p('ile_insectes', "les roseaux de l'Île (libellules)", 'collecte', 'i3', 52, 141, 2)
p('vanne', 'la vanne (ricochets, niveau du bief)', 'activite', 'vn', 22, 146.5, 2)
p('greve_ile', "grève de l'Île (coquillages)", 'collecte', 'i4', 40, 147, 2)
p('ronces', 'mûres de la tranchée', 'collecte', 'tw2', 84, 99.5, 2)
p('wagon', 'le wagon oublié (instrument de la fanfare)', 'histoire', 'tw3', 70, 93.5, 2)
p('fouille_ouest', 'fouilles du ballast', 'collecte', 'tw4', 52, 99.5, 2)
p('leviers', 'la cabine des leviers', 'histoire', 'po', 41, 103, 2)
p('source_poste', 'la fontaine des cheminots', 'repos', 'd1', 37, 122, 2)
p('cour_moulin', 'la cour du moulin (guet des pas blancs)', 'histoire', 'mc', 72, 111, 3)
p('pre_meunier', 'le pré du meunier (insectes)', 'collecte', 'me', 80, 117, 3)
p('gue_p', 'le gué', 'histoire', 'gu_s', 121, 141.5, 3)
p('cour_ferme', 'la cour: graines, poules des Delmas', 'commerce', 'fc', 131, 156, 3)
p('foin', 'le pré aux balles de foin', 'activite', 'fs3', 96, 164, 3)
p('noyer', 'le Gros Noyer (noix, point de vue)', 'collecte', 'fs2', 105, 180, 3)
p('abreuvoir', "l'abreuvoir (pompe de la ferme)", 'service', 'fs1', 137, 185, 3)
p('champ', 'les champs (location)', 'activite', 'fe1', 164, 164, 3)
p('ruches', 'les ruches', 'collecte', 'fe2', 200, 161, 3)
p('pre_bas', "le pré bas (papillons)", 'collecte', 'fe3', 238, 159, 3)
p('borne', 'la borne de la vieille route (fouilles)', 'collecte', 'vr', 121, 185, 3)
p('croix_p', 'la croix de chemin (photo)', 'activite', 'croix', 120.5, 196, 3)
p('coupe', 'la coupe de Basile (bois)', 'activite', 'c2', 96, 57, 3)
p('chataignes', 'les châtaigniers', 'collecte', 'c1', 112, 70, 3)
p('pierre', 'la Pierre Levée (fouilles)', 'collecte', 'c4', 55, 26, 3)
p('myrtilles', 'la lande aux myrtilles', 'collecte', 'c5', 88, 17, 3)
p('champignons', 'le sous-bois aux champignons', 'collecte', 'c6', 112, 25, 3)
p('clairiere', 'la clairière (insectes, tronc-banc)', 'repos', 'cl', 119, 52, 3)
p('papillons', 'la prairie du milieu', 'collecte', 'e1', 146, 41, 3)
p('etang_p', "coin de pêche de l'étang", 'activite', 'et', 161.5, 39, 3)
p('cascade', 'les marches du ru', 'collecte', 'r2', 162, 62, 3)
p('source', "la source et l'oratoire", 'histoire', 'so', 176, 21, 3)
p('pres_haut', 'les prés du Haut (insectes rares)', 'collecte', 'h1', 205, 23, 3)
p('roche', 'la roche aux fossiles', 'collecte', 'e3', 204, 51, 3)
p('vue_bourg', 'le banc des Crêtes (vue sur le bourg)', 'repos', 'k2', 240, 47, 3)
p('belvedere', "le belvédère de l'Éperon (photo)", 'activite', 'bv', 281, 27, 3)
p('guerite', 'la guérite du cantonnier', 'histoire', 'te2', 262, 90.5, 3)
p('fouille_est', 'fouilles de la courbe (avec Jeanne)', 'collecte', 'te3', 283, 86, 3)
p('signal_est', 'le signal carré, rouillé', 'histoire', 'te4', 295, 71, 3)
p('niche', 'la première niche (lampe de mineur)', 'histoire', 'tu1', 301.5, 38, 3)
p('cachette', "la cachette d'Émile (le verre de la lanterne)", 'histoire', 'tu3', 302, 19, 3)

# ---------------------------------------------------------------- champs et prés (dessin seulement, avec raison)
PARCELLES = [
    dict(nom='champs', rect=[150, 164, 48, 26], couleur='#D8C36A'), dict(nom='pâture', rect=[86, 156, 26, 22], couleur='#A9C777'),
    dict(nom='pré bas', rect=[206, 160, 44, 22], couleur='#A9C777'), dict(nom='jardins de la Rive', rect=[186, 113, 20, 11], couleur='#B7C98A'),
    dict(nom='verger', rect=[238, 112, 12, 16], couleur='#B7C98A'), dict(nom='cimetière', rect=[208, 67, 18, 13], couleur='#C9CDB8'),
    dict(nom='place', rect=[131, 110, 18, 12], couleur='#D9CBB4'), dict(nom='parvis', rect=[185, 79, 21, 6], couleur='#D9CBB4'),
    dict(nom="cour de l'école", rect=[174, 100, 6, 6], couleur='#D9CBB4'), dict(nom='cour', rect=[128, 153, 14, 16], couleur='#D9CBB4'),
    dict(nom='cour du moulin', rect=[66, 108, 14, 10], couleur='#D9CBB4'), dict(nom='potager', rect=[106, 120.5, 8, 4], couleur='#9A7B55'),
    dict(nom='poulailler', rect=[114.4, 123.1, 2.6, 3], couleur='#B58B5A'),
]

# ---------------------------------------------------------------- sentiers de quête
QUETES = [
    dict(id='A1', acte=1, titre='Acte 1, « Logement fourni »: le tour du propriétaire', forme='étoile autour de la place',
         etapes=[('quai', 'réveil sur le banc du quai'), ('gr2', 'Firmin à la halte'), ('hd', 'la maison en ruine'), ('pl_o', "pension d'Odette"),
                 ('pl', 'toilette à la pompe'), ('cf0', 'Basile prête les outils'), ('lis', 'deux arbres à abattre'), ('hd', 'le toit, le potager, les poules'),
                 ('gr4', 'Solange, puis Achille (les oeufs)'), ('hd', 'première nuit: 5 h 12')], retour=[],
         guidage="chaque étape se voit depuis la précédente (le château d'eau, l'enseigne d'Odette, l'auvent de Basile); tout tient dans 100 m autour de la place"),
    dict(id='A2', acte=2, titre='Acte 2, « La minute d’écart »: la voie jusqu’au signal', forme='sentier linéaire, retour en boucle',
         etapes=[('gr2', 'Firmin donne le but'), ('pn', 'le passage à niveau'), ('tw1', 'les ronces (hache)'), ('tw3', 'le wagon oublié'),
                 ('tw4', 'les frênes couchés (retour chez Mado, hache améliorée)'), ('po', "le poste: scène des leviers, le sémaphore s'incline")],
         retour=[('po', 'portillon du poste'), ('v1', 'la passerelle de la vanne'), ('i2', 'la fosse du bief'), ('bw2', 'le saule'), ('bg', 'le gué'), ('hd', 'la maison')],
         guidage="les rails eux-mêmes et les talus de la tranchée; le sémaphore au bout de la perspective; au retour, on descend toujours et l'on suit l'eau"),
    dict(id='A2p', acte=2, titre='Acte 2: la pendule et la leçon de pêche', forme='deux allers courts depuis le centre',
         etapes=[('quai_e', 'la pendule'), ('gr7', 'Ambroise'), ('gr8', 'Honorine (la confidence)'), ('gr4', 'Achille'), ('bw2', 'le saule débité'), ('i2', 'la fosse: première pêche')],
         retour=[], guidage="la Grand-Route d'un bout à l'autre, puis la berge: une seule ligne à suivre à chaque fois"),
    dict(id='A3', acte=3, titre='Acte 3, « Ceux qui partent »: le verre de la lanterne', forme='sentier linéaire, retour par le haut',
         etapes=[('hd', 'la cave et la lanterne sans verre'), ('gr8', 'Jeanne attend au passage des Hameaux'), ('pnh', 'la grille de la Compagnie'), ('te2', 'la guérite'),
                 ('te3', 'fouilles de la courbe'), ('portail', 'le portail du tunnel'), ('tu1', 'la première niche'), ('tu3', "la cachette d'Émile")],
         retour=[('tu3', 'la cachette'), ('tu2', "l'escalier de service"), ('bv', 'le belvédère: tout Aubrune sous les yeux'), ('k1', 'les Crêtes'), ('cn', 'la porte haute du cimetière'),
                 ('pv', 'le parvis: Marthe et la cloche'), ('gr6', 'la forge: Mado sertit le verre'), ('pn_s', 'la barrière')],
         guidage="la voie en courbe, sans embranchement; la bouche noire du tunnel; dans le tunnel, une lampe par niche; en haut, le clocher droit devant pour redescendre"),
    dict(id='S3', acte=3, titre='Suite « Le fantôme du moulin »: les pas blancs', forme='piste de traces, linéaire',
         etapes=[('fc', 'Léon raconte le géant pâle'), ('bg', 'le gué'), ('mc', 'la cour du moulin: deux nuits de guet'), ('mg', 'les pas blancs sortent par le portail'),
                 ('gr0', 'ils suivent le chemin du Moulin'), ('gr6', 'ils finissent derrière la forge: Barnabé et ses brioches')], retour=[],
         guidage="les traces de farine au sol font le fil; la piste finit au centre, il n'y a pas de retour à faire"),
    dict(id='S5', acte=3, titre='Suite « Les lettres en retard »: la ligne de la draisine', forme='raccourci sur rail',
         etapes=[('tw5', 'arrêt du poste'), ('trav', 'arrêt de la halte'), ('portail', 'arrêt du tunnel')], retour=[],
         guidage="la draisine ne quitte pas les rails: trois arrêts, un levier"),
]

POINTS_CLES = [('quai', 'le quai'), ('hd', 'la maison'), ('pl', 'la place (pompe)'), ('pl_o', "l'épicerie"), ('cf0', "l'atelier de Basile"),
               ('gr4', 'le fournil et la mercerie'), ('gr6', "le carrefour de l'Église (café, forge)"), ('pv', "l'église"), ('lv', 'le lavoir'),
               ('ponton', 'le ponton'), ('bg', 'le gué (rive nord)'), ('gr9', "l'arrêt du car"), ('i2', 'la fosse du bief'), ('vn', 'la vanne'),
               ('po', "le poste d'aiguillage"), ('mc', 'le moulin'), ('fc', 'la ferme'), ('fs2', 'le Gros Noyer'), ('cl', 'la clairière du Vieux Chêne'),
               ('et', "l'étang"), ('so', 'la source'), ('bv', 'le belvédère'), ('portail', 'le portail du tunnel'), ('tu3', "la cachette d'Émile")]
PAIRES = [('quai', k) for k, _ in POINTS_CLES if k != 'quai'] + [('hd', k) for k in ('pl_o', 'gr4', 'gr6', 'po', 'mc', 'fc', 'et', 'tu3')] + [
    ('po', 'mc'), ('mc', 'fc'), ('fc', 'gr9'), ('bv', 'pv'), ('et', 'pv'), ('cl', 'cf0'), ('pn', 'po'), ('pnh', 'tu3')]

# ================================================================ version 2: l'ouest allongé de 64 m (décision du client)
# Tout ce qui est à l'est de x = 44,5 (bourg, moulin, île, Côte, ferme, tunnel) glisse de 64 m vers l'est;
# le poste, le sémaphore, la vanne et la prise du bief restent au bord ouest. La tranchée passe de 80 à 144 m.
ALLONGE, COUPE = 64, 44.5
L = 320 + ALLONGE


def sx(x):
    return x if x < COUPE else x + ALLONGE


def _etirer():
    for z in ZONES.values():
        z['poly'] = [(sx(x), y) for x, y in z['poly']]
    for w in EAUX + RAILS:
        w['pts'] = [(sx(x), y) for x, y in w['pts']]
    for lst in (PLANS_EAU,):
        for w in lst:
            w['cx'] = sx(w['cx'])
    for nn in N.values():
        nn['x'] = sx(nn['x'])
    for lst in (list(VERROUS.values()), OUVRAGES, REPERES, P):
        for o in lst:
            o['x'] = sx(o['x'])
    for bb in B:
        x0 = bb['rect'][0]
        bb['rect'][0] = sx(x0)
        if bb['porte']:
            bb['porte'][0] += bb['rect'][0] - x0
    for pc in PARCELLES:
        pc['rect'][0] = sx(pc['rect'][0])


_etirer()
_encoche = [(206.5, 129.5), (206.5, 132), (201.5, 132), (201.5, 129.5)]
# Le ponton (acte 1) avance sur l'eau: la zone du bourg l'englobe, la rivière (acte 2) le contourne.
_i = ZONES['B']['poly'].index((204, 129.5))
ZONES['B']['poly'][_i:_i + 1] = _encoche
_i = ZONES['R']['poly'].index((204, 129.5))
ZONES['R']['poly'][_i:_i + 1] = _encoche[::-1]
# La Côte s'arrête à x 100: à l'ouest, le bois du pourtour (décor), qui n'a ni chemin ni raison d'être jouable.
ZONES['C']['poly'] = [(100, 0), (314, 0), (314, 63), (236, 63), (236, 82), (162, 82), (164, 90), (100, 89.4)]
# La voie: une clairière au poste, puis une tranchée de 6 m entre deux talus (hors jeu de part et d'autre):
# les frênes de V2b la barrent d'un talus à l'autre, on ne les contourne pas.
# La descente du poste est un sentier de 4 m entre deux haies: le portillon V11 la barre d'un bord à l'autre.
ZONES['V']['poly'] = [(0, 88), (98, 89.3), (100, 94.5), (164, 94.5), (164, 100.5), (100, 100.5), (96, 104), (34, 104),
                      (34, 110), (40, 118), (40, 134), (34, 137), (26, 136), (30, 110), (30, 104), (0, 104)]
# Le tunnel: la courbe (séparée de la Côte par un talus), le tunnel sous l'éperon, l'escalier de service et la
# clairière du belvédère. Le rocher de l'éperon est hors jeu: on ne passe du belvédère au tunnel que par l'escalier (V10).
ZONES['T']['poly'] = [(296, 66), (336, 66), (350, 56), (360, 50), (360, 32), (352, 32), (352, 40), (314, 40), (314, 18),
                      (352, 18), (352, 28), (360, 28), (360, 12), (368, 12), (368, 52), (376, 60), (384, 62), (384, 100), (296, 100)]
ZONES['R']['poly'] = [p for p in ZONES['R']['poly'] if p != (36, 156.5)]
_i = ZONES['R']['poly'].index((0, 160.5))
ZONES['R']['poly'][_i:_i] = [(118, 151.5), (84, 155), (36, 156.5)]
EAUX[0]['pts'] = [(0, 156), (36, 152), (84, 149.5), (118, 146.5), (130, 143)] + EAUX[0]['pts'][3:]
RAILS[2]['pts'] = [(44, 97.5), (52, 93.5), (84, 93.5)]
for _k, _x in (('tw1', 160), ('tw2', 146), ('tw3', 128), ('tw4', 112)):
    N[_k]['x'] = _x
n('tw6', 72, 97.5, 'V')
n('i5', 78, 141, 'R')
N['vn'].update(x=26, y=142.5)
A[:] = [a for a in A if not ({a['a'], a['b']} in ({'tw4', 'tw5'}, {'i3', 'i4'}))]
chaine(['tw4', 'tw6', 'tw5'], 'voie', 'la clairière du poste')
chaine(['i3', 'i5', 'i4'], 'sentier', "sentier de l'Île")
VERROUS['V2b']['x'] = 121
for _q in P:
    if _q['id'] == 'ronces':
        _q.update(x=146, y=99.8)
    elif _q['id'] == 'wagon':
        _q.update(x=72, y=93.5, noeud='tw6')
    elif _q['id'] == 'fouille_ouest':
        _q.update(x=112, y=99.8)
    elif _q['id'] == 'vanne':
        _q.update(x=24, y=145)
    elif _q['id'] == 'lisiere':
        _q.update(x=199, y=88.5)
    elif _q['id'] == 'coquillages':
        _q['acte'] = 1
p('saule_ile', "le saule têtard de l'Île (coin de pêche du bief)", 'activite', 'i5', 78, 138.6, 2)
p('aiguille', "l'aiguille et la lanterne de la voie de garage", 'histoire', 'tw5', 47, 95.5, 2)
for _r in REPERES:
    if _r['id'] == 'chateau_eau':
        _r.update(x=189, y=87, raison=_r['raison'] + "; posé au nord du chemin de la Lisière, hors du chemin")
    elif _r['id'] == 'pigeonnier':
        _r.update(x=213, y=150.5, raison=_r['raison'] + "; à l'angle est du logis, hors du chemin des Champs")
    elif _r['id'] == 'gros_noyer':
        _r.update(x=161, y=187, raison=_r['raison'] + "; à 5 m du tour de la ferme, sur sa butte")
for _q in QUETES:
    if _q['id'] == 'A2':
        _q['etapes'] = [('gr2', 'Firmin donne le but'), ('pn', 'le passage à niveau'), ('tw1', 'les ronces (hache)'),
                        ('tw3', 'les frênes couchés: retour chez Mado, hache améliorée'), ('tw4', 'fouilles du ballast'),
                        ('tw6', 'le wagon oublié'), ('po', "le poste: scène des leviers, le sémaphore s'incline")]
POINTS_CLES += [('pnh', 'le passage des Hameaux'), ('pn', 'le passage à niveau')]

# ================================================================ version 2: verrous visibles, lisières habillées
# Chaque verrou a un objet posé dans le monde et sa phrase « pas encore » (tutoiement; [[f|m]] pour les accords).
OBJETS_VERROUS = {
    'V1': ('arbre couché', 'willow-fallen', "Le vieux saule barre le chemin. Pas encore: il faudra une scie, et quelqu'un qui sait par où couper."),
    'V2': ('ronces', 'brambles-wall', "Les ronces ont avalé la voie. Pas encore: Firmin a dit d'attendre son signal."),
    'V2b': ('arbres couchés', 'ash-trunks-fallen', "Trois frênes en travers des rails, d'un talus à l'autre. Pas encore: ta hache rebondit sur l'écorce."),
    'V3': ('dalles manquantes', 'ford-stones-missing', "Trois dalles du gué ont filé avec la crue. Pas encore: l'eau est trop vive pour sauter."),
    'V4': ('portail cadenassé', 'gate-padlocked', "Le portail du moulin est cadenassé. Pas encore: la clé est partie avec le meunier."),
    'V5': ('barrière forestière', 'forest-barrier', "« Coupe en cours, défense d'entrer. » Pas encore: Basile t'emmènera quand ce sera le moment."),
    'V6': ('éboulis', 'gully-washout', "Le raidillon s'est raviné, la terre s'effrite sous ton pied. Pas encore: il faudrait des marches."),
    'V7': ('grille fermée', 'cemetery-gate-locked', "La porte haute du cimetière est fermée à clé. Pas encore: c'est Marthe qui a la clé."),
    'V8': ('grille', 'company-gate', "« Ligne fermée. Compagnie des chemins de fer. » Pas encore: la grille ne bouge pas d'un pouce."),
    'V9': ('passerelle sans tablier', 'footbridge-bare', "Il ne reste que les poutres de la passerelle. Pas encore: il manque les planches."),
    'V10': ('chaîne', 'stair-door-chained', "La porte de l'escalier est fermée d'une chaîne, de l'autre côté. Pas encore: elle s'ouvre d'en bas."),
    'V11': ('portillon au loquet', 'wicket-latched', "Le portillon est fermé d'un loquet, côté voie. Pas encore: il s'ouvre depuis le poste."),
}
for _k, (_o, _m, _t) in OBJETS_VERROUS.items():
    VERROUS[_k].update(objet=_o, modele=_m, pas_encore=_t)

# Habillage des lisières: ce qui se voit là où une zone s'arrête (jamais un mur nu). Règle par paire de voisins,
# exceptions par position. Voisin « hors » = hors des zones (décor), « bord » = bord de la carte.
HABILLAGES = ('haie', 'talus', 'cloture', 'riviere', 'bois', 'muret')
REGLE_BORDURE = {
    ('V', 'hors'): 'talus', ('V', 'C'): 'talus', ('V', 'B'): 'haie', ('V', 'M'): 'haie', ('V', 'R'): 'haie', ('V', 'bord'): 'bois',
    ('C', 'B'): 'haie', ('C', 'V'): 'talus', ('C', 'T'): 'bois', ('C', 'hors'): 'bois', ('C', 'bord'): 'bois',
    ('M', 'B'): 'cloture', ('M', 'V'): 'cloture', ('M', 'R'): 'cloture', ('M', 'hors'): 'cloture',
    ('F', 'R'): 'riviere', ('F', 'B'): 'riviere', ('F', 'hors'): 'haie', ('F', 'bord'): 'haie',
    ('T', 'B'): 'cloture', ('T', 'C'): 'bois', ('T', 'hors'): 'talus', ('T', 'bord'): 'bois',
    ('R', 'B'): 'haie', ('R', 'V'): 'haie', ('R', 'M'): 'cloture', ('R', 'F'): 'riviere', ('R', 'hors'): 'haie', ('R', 'bord'): 'riviere',
    ('B', 'hors'): 'haie', ('B', 'bord'): 'haie', ('B', 'C'): 'haie', ('B', 'V'): 'haie', ('B', 'M'): 'cloture', ('B', 'R'): 'riviere',
    ('B', 'F'): 'riviere', ('B', 'T'): 'cloture',
}
POURQUOI_HABILLAGE = {
    'haie': "haie vive de noisetiers et d'aubépines, trop dense pour passer, basse pour la caméra (1,2 m)",
    'talus': "talus de terre embroussaillé (2 m de haut): les flancs de la tranchée ou de la courbe",
    'cloture': "clôture de bois ou grille (portail, propriété, Compagnie): on voit au travers, on ne passe pas",
    'riviere': "l'eau elle-même, ou sa berge raide plantée de saules",
    'bois': "lisière de bois dense: troncs serrés et fourrés, la forêt du pourtour du rendu prend le relais",
    'muret': "muret de pierre sèche d'un mètre (cimetière, cour)",
}

# ================================================================ version 2: sols (type de terrain partout)
SOL_ZONE = {'B': 'herbe-rase', 'R': 'prairie-humide', 'V': 'friche', 'C': 'sous-bois', 'M': 'pre', 'F': 'pre', 'T': 'friche-rocheuse'}
SOL_CHEMIN = {'route': 'empierre', 'rue': 'paves', 'chemin': 'terre', 'sentier': 'terre-tassee', 'voie': 'ballast', 'interieur': 'pierre'}
SOL_PARCELLE = {'champs': 'labour', 'pâture': 'pre', 'pré bas': 'prairie-humide', 'jardins de la Rive': 'terre-de-jardin',
                'verger': 'herbe-haute', 'cimetière': 'herbe-rase', 'place': 'paves', 'parvis': 'paves', "cour de l'école": 'terre-battue',
                'cour': 'terre-battue', 'cour du moulin': 'terre-battue', 'potager': 'terre-de-jardin', 'poulailler': 'terre-battue'}
SOLS_SUPPL = [  # rectangles de sol particuliers (x, y, l, h), posés après les parcelles
    dict(sol='lande', rect=[140, 8, 32, 18], pourquoi="la lande aux myrtilles: sol pauvre de la crête, bruyère et myrtilliers"),
    dict(sol='prairie', rect=[200, 34, 22, 14], pourquoi="la prairie du milieu, ouverte dans le bois (insectes)"),
    dict(sol='prairie', rect=[256, 14, 26, 20], pourquoi="les prés du Haut, au-dessus de la source"),
    dict(sol='prairie', rect=[176, 44, 14, 12], pourquoi="la clairière du Vieux Chêne"),
    dict(sol='galets', rect=[184, 128, 8, 2], pourquoi="la grève aux coquillages, au pied du chemin de la berge"),
    dict(sol='galets', rect=[100, 142, 18, 2], pourquoi="la grève de l'Île"),
    dict(sol='vase', rect=[227, 46, 18, 3], pourquoi="le bord de l'étang côté digue, roseaux"),
    dict(sol='gravier', rect=[185, 99, 30, 4], pourquoi="le quai: gravier entre deux bordures de pierre"),
    dict(sol='friche', rect=[40, 88, 58, 16], pourquoi="la clairière du poste: herbe folle sur l'ancien ballast"),
]

# ================================================================ version 2: gabarits des bâtiments (assets-src/decors/gabarits.toml)
# Façades écrites dans le repère du monde (nord en haut), le modèle est posé en rotation 0. position: de 0 à 1
# depuis la gauche vue de dehors (maison.py). Couleurs: noms du nuancier [couleurs] de gabarits.toml.
GABARITS = {
    'quai_b': dict(base='quai', note="plateforme de 0,55 m, bordure de pierre côté voie, pas de toit"),
    'halte': dict(base='house-town', etages=1, hauteur_etage=3.4, toit='croupe', pente=30, fenetres=dict(sud=2, nord=3),
                  couleurs=dict(murs='pierre_claire', toit='lauze', menuiseries='rouge_cheminot', volets='rouge_cheminot', porte='rouge_cheminot'),
                  note="bâtiment voyageurs de la Compagnie: un seul niveau haut, auvent côté quai, pendule sur le pignon est"),
    'maison': dict(base='house-town', etages=2, toit='deux-pans', pente=40, fenetres=dict(sud=3, nord=2, est=2, ouest=1),
                   couleurs=dict(murs='enduit', toit='tuile', menuiseries='creme', volets='sauge', porte='sauge'),
                   note="maison finie; au début, ruine: moitié ouest sans toit, murs arasés à 1 m, moitié est couverte d'une bâche"),
    'epicerie': dict(base='shop-front', etages=2, toit='croupe', pente=35, devanture=dict(facade='est', largeur=4.2, position=0.5),
                     fenetres=dict(est=2, ouest=2, nord=2, sud=2),
                     couleurs=dict(murs='enduit_ocre', toit='lauze', volets='vert_sombre', porte='vert_sombre', menuiseries='vert_sombre', enseigne='vert_sombre')),
    'scierie': dict(base='shed', etages=1, hauteur_etage=3.6, toit='deux-pans', pente=30, fenetres=dict(sud=2, nord=1),
                    couleurs=dict(murs='bois_brut', toit='lauze', menuiseries='bois_sombre', porte='bois_sombre'),
                    note="grande porte et auvent de 3 m à l'est sur l'établi"),
    'firmin': dict(base='house-town', etages=2, toit='deux-pans', pente=40, couleurs=dict(murs='pierre', toit='tuile', volets='rouge_cheminot', porte='rouge_cheminot')),
    'remise': dict(base='shed', note="porte charretière de 3 m dans l'axe des rails"),
    'fournil': dict(base='shop-front', etages=2, toit='deux-pans', pente=40, devanture=dict(facade='sud', largeur=3.2, position=0.4),
                    couleurs=dict(murs='enduit', toit='tuile', menuiseries='miel', porte='miel', enseigne='bois_sombre'),
                    note="cheminée du four sur le pignon est, côté ru"),
    'mercerie': dict(base='shop-front', etages=2, toit='deux-pans', pente=40, devanture=dict(facade='nord', largeur=3.6, position=0.5),
                     couleurs=dict(murs='enduit_rose', toit='tuile', menuiseries='creme', volets='fleur_rose', porte='creme')),
    'ecole': dict(base='house-town', etages=2, toit='croupe', pente=35, couleurs=dict(murs='pierre_claire', toit='lauze', volets='bleu', porte='bleu'),
                  note="horloge et drapeau au-dessus de la porte: la mairie"),
    'lucie': dict(base='house-town', etages=2, couleurs=dict(murs='enduit', toit='tuile', volets='bleu', porte='bleu')),
    'cafe': dict(base='shop-front', etages=2, toit='deux-pans', pente=40, devanture=dict(facade='sud', largeur=4.0, position=0.5),
                 couleurs=dict(murs='enduit_ocre', toit='tuile', menuiseries='rouge_cheminot', porte='rouge_cheminot', enseigne='rouge_cheminot')),
    'forge': dict(base='shed', etages=1, hauteur_etage=3.4, toit='deux-pans', pente=35, couleurs=dict(murs='pierre', toit='lauze', porte='bois_sombre'),
                  note="grande baie ouverte au sud, cheminée de forge au nord"),
    'horloger': dict(base='shop-front', etages=2, devanture=dict(facade='sud', largeur=3.0, position=0.5), couleurs=dict(murs='pierre_claire', toit='tuile', menuiseries='bois_sombre', enseigne='laiton')),
    'honorine': dict(base='house-town', etages=2, couleurs=dict(murs='enduit_rose', toit='tuile', volets='sauge', porte='sauge')),
    'hameau_b': dict(base='house-town', etages=2, couleurs=dict(murs='enduit', toit='tuile', volets='bois_gris', porte='bois_gris'), note="volets clos"),
    'hameau_c': dict(base='house-town', etages=1, couleurs=dict(murs='pierre', toit='lauze', volets='rouge_cheminot', porte='rouge_cheminot')),
    'eglise': dict(base='eglise', note="modèle à part: nef de 21 x 12 m, clocher carré de 6 m à l'ouest (22 m de haut), portail au sud"),
    'presbytere': dict(base='house-town', etages=2, couleurs=dict(murs='pierre', toit='lauze', volets='vert_sombre', porte='vert_sombre')),
    'marthe': dict(base='house-town', etages=2, couleurs=dict(murs='enduit', toit='tuile', volets='bleu', porte='bleu')),
    'cheminot_o': dict(base='house-town', etages=2, couleurs=dict(murs='pierre_claire', toit='tuile', volets='rouge_cheminot', porte='rouge_cheminot'), note="logement type de la Compagnie, jumeau du voisin"),
    'cheminot_e': dict(base='house-town', etages=2, couleurs=dict(murs='pierre_claire', toit='tuile', volets='rouge_cheminot', porte='rouge_cheminot'), note="logement type de la Compagnie, jumeau du voisin"),
    'lavoir': dict(base='lavoir', note="toit en appentis sur quatre poteaux, ouvert à l'ouest, bassin de pierre à l'est"),
    'poste': dict(base='house-town', etages=2, hauteur_etage=2.8, toit='croupe', pente=30, fenetres=dict(sud=2, nord=3, est=2, ouest=2),
                  couleurs=dict(murs='pierre', toit='lauze', menuiseries='rouge_cheminot', porte='rouge_cheminot'),
                  note="cabine vitrée à l'étage, escalier extérieur au nord"),
    'moulin': dict(base='house-town', etages=2, toit='deux-pans', pente=45, couleurs=dict(murs='pierre', toit='tuile', menuiseries='bois_sombre', porte='bois_sombre'),
                   note="roue de 5 m sur le pignon sud, dans le bief"),
    'ferme_logis': dict(base='house-town', etages=2, toit='deux-pans', pente=40, couleurs=dict(murs='enduit_ocre', toit='tuile', volets='sauge', porte='sauge')),
    'grange': dict(base='shed', etages=1, hauteur_etage=5.0, toit='deux-pans', pente=40, couleurs=dict(murs='bois_gris', toit='tuile', porte='bois_brut'),
                   note="porte charretière de 3,5 m"),
    'forestiere': dict(base='house-town', etages=1, couleurs=dict(murs='pierre', toit='lauze', volets='vert_sombre', porte='vert_sombre')),
}


def gabarit(bb):
    """Entrée de gabarit complète (largeur, profondeur, portes) tirée de l'emprise et de la porte du plan."""
    g = dict(GABARITS[bb['id']])
    x, y, l, h = bb['rect']
    g.update(largeur=l, profondeur=h)
    if bb['porte']:
        px, py = bb['porte']
        if abs(px - x) < 1e-6:
            fac, pos = 'ouest', (py - y) / h
        elif abs(px - x - l) < 1e-6:
            fac, pos = 'est', (y + h - py) / h
        elif abs(py - y) < 1e-6:
            fac, pos = 'nord', (x + l - px) / l
        else:
            fac, pos = 'sud', (px - x) / l
        g['portes'] = [dict(facade=fac, position=round(pos, 3))]
        g['facade_porte'] = fac
    return g


for _b in B:
    _b['gabarit'] = gabarit(_b)

# ================================================================ version 2: mobilier de lieu
# type: meuble du jeu (donnees/commun/meubles) quand il existe; modele: entrée de gabarits.toml (ou à créer).
# regarde: ce que le banc regarde (le contrôle vérifie qu'il y fait face).
M_ = []


def mob(i, typ, modele, x, y, rot, pourquoi, regarde=None, acte=1):
    M_.append(dict(id=i, type=typ, modele=modele, x=x, y=y, rotation=rot, pourquoi=pourquoi, regarde=regarde, acte=acte))


mob('banc-du-quai', 'banc', 'bench-platform', 200, 100.5, 2, "le banc du réveil: on attend le train face à la voie", regarde=[200, 97.5])
mob('banc-quai-ouest', 'banc', 'bench-platform', 191, 100.5, 2, "second banc du quai, face à la voie", regarde=[191, 97.5])
mob('poteau-quai', 'poteau-de-quai', 'poteau-de-quai', 205.5, 102.5, 0, "là où l'on monte à deux: le point du quai")
mob('caisse-commande', None, 'crate', 207.5, 101.5, 0, "la caisse de la commande du samedi, au pied du poteau")
mob('panneau-gare', None, 'platform-sign', 196, 99.6, 2, "le nom de la halte se lit depuis le train, donc tourné vers la voie")
# Lampes du dehors: chacune a son meuble du jeu (`reverbere`, `lanterne-de-quai`, `lanterne-de-porte`), dont le modèle
# porte la lumière (manifeste des décors). Une lanterne de quai tourne sa potence vers la voie (rotation 2: le nord);
# une lanterne de porte est vissée sur la façade, à côté de la porte, et regarde la rue.
for _i, (_x, _pq) in enumerate(((188, "éclairage du quai, au bout ouest: la potence vers la voie"),
                               (212, "éclairage du quai, au bout est, devant la halte: la potence vers la voie"),
                               (203, "au milieu du quai, entre le banc du réveil et le poteau où l'on monte: on attend le train sous elle"))):
    mob('reverbere-quai-%d' % (_i + 1), 'lanterne-de-quai', 'platform-lantern', _x, 102.5, 2, _pq)
for _i, _x in enumerate((195.5, 216.5, 240.5, 262, 280.5, 302.5, 313)):
    mob('reverbere-route-%d' % (_i + 1), 'reverbere', 'street-lantern', _x, 111, 0, "la Grand-Route éclairée côté sud, entre les façades, tous les 20 m environ")
mob('reverbere-gue', 'reverbere', 'street-lantern', 179.5, 104.5, 0, "au carrefour du passage à niveau, la nuit du dénouement se joue ici")
mob('reverbere-place', 'reverbere', 'street-lantern', 205.5, 120.4, 0, "au sud de la place, près du banc: la pompe et le banc se trouvent la nuit, et la descente vers la berge")
mob('reverbere-parvis', 'reverbere', 'street-lantern', 257.5, 81, 0, "sur le parvis, à gauche du portail en sortant: on trouve la rue de l'Église en quittant l'office du soir")
mob('lanterne-halte', 'lanterne-de-porte', 'wall-lantern', 221.2, 105.03, 0, "à droite de la porte de la halte, côté place: la gare se trouve de loin, même le dernier train parti")
mob('lanterne-cafe', 'lanterne-de-porte', 'wall-lantern', 255.4, 106.03, 0, "entre la porte et la vitrine du café: allumée, elle dit que Colette sert encore", acte=2)
mob('lanterne-epicerie', 'lanterne-de-porte', 'wall-lantern', 194.03, 117.2, 1, "à la porte de l'épicerie-pension, côté place: les pensionnaires rentrent à la nuit")
mob('lisse-nord', None, 'level-crossing-gate', 182.5, 95.4, 0, "la lisse barre la route (bras est-ouest) au nord de la voie, jamais la voie")
mob('lisse-sud', None, 'level-crossing-gate', 182.5, 99.6, 0, "la lisse barre la route au sud de la voie")
mob('croix-pn-eglise', None, 'crossing-sign', 256.8, 95, 0, "passage à niveau non gardé: croix de Saint-André au bord de la rue")
mob('pompe-de-la-place', 'pompe', 'water-pump', 208, 113.5, 0, "la pompe de la place, sur l'ancien puits: l'eau de tous et la toilette du matin (acte 1)")
mob('banc-place', 'banc', 'bench-park', 208, 119.4, 2, "face au puits et à la halte: on y voit qui descend du train", regarde=[208, 113.5])
mob('ronces-maison-1', 'ronces', 'buisson', 167.5, 112.5, 0, "les ronces qui ont envahi la ruine, contre le pignon ouest: on les arrache à l'acte 1")
mob('ronces-maison-2', 'ronces', 'buisson', 176, 119.6, 0, "les ronces du jardin, devant le futur potager")
mob('table-tonnelle', 'table-a-manger', 'table-farm', 197.5, 120, 0, "la tonnelle d'Odette: le souper des pensionnaires")
mob('chaise-tonnelle-n', 'chaise', 'chair-farm', 197, 118.9, 0, "autour de la table de la tonnelle", regarde=[197, 120])
mob('chaise-tonnelle-s', 'chaise', 'chair-farm', 198, 121.1, 2, "autour de la table de la tonnelle", regarde=[198, 120])
mob('banc-ponton', 'banc', 'bench-park', 201.5, 128.2, 0, "au pied du ponton, face à la rivière et au pigeonnier de l'autre rive", regarde=[201.5, 134])
mob('banc-berge', 'banc', 'bench-park', 248, 124.4, 0, "face à la rivière, à l'ombre des saules", regarde=[248, 134])
for _i, (_x, _y) in enumerate(((179.4, 105), (256.4, 111.5), (185.6, 85), (185.6, 123.6), (317, 111.6), (150, 105.4))):
    mob('panneau-%d' % (_i + 1), None, 'signpost', _x, _y, 0,
        "panneau de carrefour: " + ("passage à niveau, Grand-Route, chemin du Moulin, le Gué", "rue de l'Église, venelle des Jardins",
                                    "chemin forestier, chemin de la Lisière", "chemin de la Berge, le Gué", "bout de la Grand-Route, chemin des Jardins, l'arrêt du car",
                                    "chemin du Moulin, portail du moulin")[_i])
mob('boite-lucie', None, 'mailbox', 248.4, 110.6, 2, "la boîte aux lettres du bourg, à la grille de Lucie, tournée vers la rue")
mob('boite-maison', None, 'mailbox', 179.6, 113.4, 1, "la boîte de la maison du garde, à côté de la porte, tournée vers la route: les lettres des habitants")
mob('pompe-jardin', 'pompe', 'water-pump', 179.5, 121.5, 0, "la pompe du jardin: l'eau de l'arrosoir à deux pas du potager")
mob('bois-maison', 'tas-de-bois', 'log-pile', 167.4, 116.5, 0, "bois de chauffage contre le pignon ouest, à l'abri du vent de pluie")
mob('bois-atelier', 'tas-de-bois', 'log-pile', 171, 93, 0, "les grumes refendues de Basile, au sud de l'atelier")
mob('haches-basile', 'etal-de-haches', 'ratelier', 177.2, 90.6, 1, "sous l'auvent est: Basile prête ses outils (acte 1)")
mob('potager', 'terre-cultivable', 'terre', 174, 122.5, 0, "le potager de 6 x 4 cases au bout de l'allée du jardin (24 cases)")
mob('banc-cretes', 'banc', 'bench-park', 304, 47.6, 0, "le banc des Crêtes: le bourg entier en contrebas", regarde=[260, 108])
mob('banc-etang', 'banc', 'bench-park', 225.5, 39.5, 1, "face à l'étang, au coin de pêche", regarde=[236, 40], acte=3)
mob('tronc-clairiere', 'banc', 'stump', 183, 52.4, 2, "un tronc couché sert de banc face au Vieux Chêne", regarde=[188, 47], acte=3)
mob('banc-belvedere', 'banc', 'bench-park', 345, 27.6, 3, "le belvédère regarde le bourg et le clocher, à l'ouest", regarde=[252, 73], acte=3)
mob('abreuvoir', 'pompe', 'water-pump', 201, 185.6, 0, "la pompe et l'abreuvoir des bêtes, au bout de la cour", acte=3)
mob('tonneaux-ferme', None, 'barrel', 196.5, 154.4, 0, "tonneaux de cidre contre le logis", acte=3)
mob('caisses-epicerie', None, 'crate', 194.7, 113.4, 0, "cageots de légumes devant la vitrine d'Odette")
mob('tonneau-cafe', None, 'barrel', 251.6, 106.6, 0, "le tonneau qui sert de table à la terrasse du café", acte=2)

# ================================================================ version 2: végétation par zones
VEGETATION = [
    dict(zone='C', densite=4.0, essences=['chêne', 'hêtre', 'châtaignier', 'charme'], sous_etage=['noisetier', 'houx', 'fougère'],
         modeles=['tree-round', 'tree-fir', 'bush-round', 'grass-tuft'], recul_chemins=4.5,
         pourquoi="bois de coteau exposé au sud: feuillus, châtaigniers vers le bourg, sapins seulement sur les crêtes au nord; clairières et prairies laissées libres"),
    dict(zone='T', densite=1.2, essences=['pin sylvestre', 'bouleau'], sous_etage=['genêt', 'ronce'], modeles=['tree-fir', 'bush-flowering'], recul_chemins=3.0,
         pourquoi="friche rocheuse au-dessus de la ligne morte: rien n'est entretenu depuis la fermeture"),
    dict(zone='V', densite=0.6, essences=['frêne', 'sureau'], sous_etage=['ronce', 'églantier'], modeles=['bush-round', 'bush-flowering'], recul_chemins=2.0,
         pourquoi="sur les talus de la tranchée seulement, rien dans le couloir des rails"),
    dict(zone='R', densite=1.5, essences=['saule blanc', 'aulne', 'peuplier'], sous_etage=['roseau', 'iris des marais'], modeles=['tree-round', 'grass-tuft'], recul_chemins=2.0,
         pourquoi="ripisylve: arbres en rang le long des berges, roseaux sur les grèves"),
    dict(zone='M', densite=0.4, essences=['noyer', 'saule têtard'], sous_etage=['ortie'], modeles=['tree-round', 'bush-round'], recul_chemins=3.0,
         pourquoi="deux noyers dans le pré du meunier, saules têtards le long du bief"),
    dict(zone='F', densite=0.3, essences=['chêne isolé', 'pommier', 'noyer'], sous_etage=['aubépine', 'charme (haies)'], modeles=['tree-round', 'tree-apple', 'bush-round'], recul_chemins=3.0,
         pourquoi="bocage: arbres dans les haies entre les champs, jamais au milieu d'un champ"),
    dict(zone='B', densite=0.2, essences=['tilleul', 'pommier', 'saule (berge)'], sous_etage=['lilas', 'rosier grimpant'], modeles=['tree-round', 'tree-apple', 'bush-flowering', 'flowers-poppy'], recul_chemins=1.5,
         pourquoi="des arbres plantés par les gens: tilleuls aux angles de la place, fruitiers dans les jardins, saules sur la berge"),
]
ARBRES_SINGULIERS = [
    dict(id='vieux-chene', type='gros-chene', x=188, y=47, pourquoi="repère de la Côte (18 m)"),
    dict(id='gros-noyer', type='gros-chene', x=161, y=187, pourquoi="repère du sud, noix à l'automne (modèle de noyer à créer, gros arbre en attendant)"),
    dict(id='chene-lisiere-1', type='chene', x=196, y=86, pourquoi="un des deux arbres à abattre de l'acte 1, au bord du chemin de la Lisière"),
    dict(id='chene-lisiere-2', type='chene', x=201, y=86, pourquoi="le second arbre à abattre de l'acte 1"),
    dict(id='tilleul-place-no', type='chene', x=196, y=110.6, pourquoi="tilleul à l'angle nord-ouest de la place (modèle tilleul à créer)"),
    dict(id='tilleul-place-ne', type='chene', x=212.4, y=110.6, pourquoi="tilleul à l'angle nord-est de la place"),
    dict(id='saule-berge-1', type='chene', x=228, y=128.6, pourquoi="saule de la berge (modèle saule à créer)"),
    dict(id='saule-berge-2', type='chene', x=262, y=129.4, pourquoi="saule de la berge"),
    dict(id='saule-berge-3', type='chene', x=286, y=131.6, pourquoi="saule de la berge"),
]

# ================================================================ version 2: ressources (pêche, culture, récolte, fouille)
# heures: plages de l'horloge du jeu; saisons: printemps, été, automne, hiver (toutes si absent).
RESSOURCES = [
    dict(id='peche-ponton', nature='peche', eau='aubrune', x=204, y=131.5, noeud='ponton', acte=2, heures='toutes', pourquoi="eau calme sous le ponton, poissons blancs"),
    dict(id='peche-aval', nature='peche', eau='aubrune', x=295, y=134, noeud='be3', acte=2, heures='matin et soir', pourquoi="courant de l'aval: truites au lever et au coucher"),
    dict(id='peche-fosse', nature='peche', eau='bief', x=132, y=131.4, noeud='i2', acte=2, heures='toutes', pourquoi="la fosse de la Baronne, sous la roue"),
    dict(id='peche-saule-ile', nature='peche', eau='bief', x=78, y=138.4, noeud='i5', acte=2, heures='jour', pourquoi="à l'ombre du saule têtard"),
    dict(id='peche-vanne', nature='peche', eau='aubrune', x=24, y=146, noeud='vn', acte=2, heures='toutes', saisons=['printemps', 'été', 'automne'], pourquoi="l'eau qui tombe du déversoir: ricochets et brochets"),
    dict(id='peche-etang', nature='peche', eau='etang', x=227, y=39, noeud='et', acte=3, heures='toutes', pourquoi="l'étang de la Côte, carpes et tanches"),
    dict(id='terre-6', nature='culture', rect=[171, 120.5, 6, 4], acte=1, pourquoi="le potager de départ (6 cases du jeu), au bout de l'allée du jardin"),
    dict(id='terre-12', nature='culture', rect=[166, 120.5, 12, 4], acte=1, pourquoi="agrandi à 12 cases après la toiture, vers l'ouest"),
    dict(id='terre-24', nature='culture', rect=[166, 119.5, 12, 6], acte=2, pourquoi="24 cases à l'acte 2: le jardin entier au sud de la maison et de son allée, le poulailler à l'ouest"),
    dict(id='champs-location', nature='culture', rect=[214, 164, 48, 26], acte=3, pourquoi="les champs des Delmas, loués par parcelles"),
    dict(id='mures-tranchee', nature='cueillette', x=146, y=100.2, noeud='tw2', acte=2, saisons=['été', 'automne'], heures='jour', pourquoi="les ronces des talus"),
    dict(id='chataignes', nature='cueillette', x=176, y=72, noeud='c1', acte=3, saisons=['automne'], heures='jour', pourquoi="châtaigniers du bas de la Côte, 3 m au sud des troncs (houppier)"),
    dict(id='champignons', nature='cueillette', x=176, y=25, noeud='c6', acte=3, saisons=['automne'], heures='matin', pourquoi="sous-bois humide, le matin après la pluie"),
    dict(id='myrtilles', nature='cueillette', x=152, y=17, noeud='c5', acte=3, saisons=['été'], heures='jour', pourquoi="la lande de la crête"),
    dict(id='noix', nature='cueillette', x=162, y=184, noeud='fs2', acte=3, saisons=['automne'], heures='jour', pourquoi="sous le Gros Noyer"),
    dict(id='pommes-verger', nature='cueillette', x=310, y=120, noeud='cj', acte=1, saisons=['automne'], heures='jour', pourquoi="le verger communal"),
    dict(id='legumes-jardins', nature='cueillette', x=256.5, y=121.5, noeud='bj', acte=1, saisons=['printemps', 'été'], heures='jour', pourquoi="les jardins de la Rive: ce qu'on vous laisse prendre"),
    dict(id='coquillages-greve', nature='cueillette', x=187, y=128.6, noeud='bg', acte=1, heures='matin', pourquoi="la grève au pied de la berge, eaux basses du matin"),
    dict(id='coquillages-ile', nature='cueillette', x=104, y=143, noeud='i4', acte=2, heures='matin', pourquoi="la grève de l'Île"),
    dict(id='insectes-roseaux', nature='insectes', x=116, y=141, noeud='i3', acte=2, saisons=['printemps', 'été'], heures='jour', pourquoi="libellules des roseaux"),
    dict(id='insectes-cour-ecole', nature='insectes', x=241, y=103, noeud='gr5', acte=2, heures='jour', pourquoi="la cour d'Armand"),
    dict(id='insectes-pre-meunier', nature='insectes', x=144, y=117, noeud='me', acte=3, saisons=['printemps', 'été'], heures='jour', pourquoi="le pré du meunier"),
    dict(id='insectes-pre-bas', nature='insectes', x=302, y=159, noeud='fe3', acte=3, saisons=['été'], heures='jour', pourquoi="papillons du pré bas"),
    dict(id='insectes-pres-haut', nature='insectes', x=269, y=23, noeud='h1', acte=3, saisons=['été'], heures='nuit', pourquoi="lucioles et insectes rares des prés du Haut, la nuit"),
    dict(id='insectes-clairiere', nature='insectes', x=183, y=50, noeud='cl', acte=3, heures='jour', pourquoi="la clairière"),
    dict(id='fouille-ballast', nature='fouille', x=112, y=99.8, noeud='tw4', acte=2, heures='toutes', pourquoi="le ballast de la voie ouest: boulons, plaques"),
    dict(id='fouille-talus', nature='fouille', x=288, y=95, noeud='pnh', acte=3, heures='toutes', pourquoi="le talus des Hameaux"),
    dict(id='fouille-courbe', nature='fouille', x=347, y=86, noeud='te3', acte=3, heures='toutes', pourquoi="la courbe de la ligne morte, avec Jeanne"),
    dict(id='fouille-pierre-levee', nature='fouille', x=119, y=26, noeud='c4', acte=3, heures='toutes', pourquoi="la Pierre Levée"),
    dict(id='fouille-roche', nature='fouille', x=268, y=51, noeud='e3', acte=3, heures='toutes', pourquoi="la roche aux fossiles"),
    dict(id='fouille-borne', nature='fouille', x=185, y=185, noeud='vr', acte=3, heures='toutes', pourquoi="la borne de la vieille route"),
    dict(id='bois-coupe', nature='bois', x=160, y=57, noeud='c2', acte=3, heures='jour', pourquoi="la coupe de Basile: le bois de la chambre"),
    dict(id='branches-lisiere', nature='bois', x=199, y=88.6, noeud='lis', acte=1, heures='jour', pourquoi="branches tombées à la lisière, de quoi commencer"),
]
# Objets du jeu posés pour les ressources qui ont déjà leur type de meuble (briques de récolte).
TYPE_RESSOURCE = {'fouille': 'point-de-fouille', 'bois': 'branches'}

# ================================================================ version 2: points nommés du dehors (fiches d'habitants)
POINTS_NOMMES = [
    dict(id='firmin-quai', x=203, y=101.5, role='poste', qui='Firmin', pourquoi="Firmin attend le train au milieu du quai"),
    dict(id='firmin-barriere', x=184.5, y=100.5, role='poste', qui='Firmin', pourquoi="Firmin à la barrière, en l'absence du garde"),
    dict(id='odette-vitrine', x=195, y=116, role='poste', qui='Odette', pourquoi="Odette balaie devant sa porte"),
    dict(id='basile-etabli', x=178, y=90.5, role='poste', qui='Basile', pourquoi="l'établi sous l'auvent"),
    dict(id='achille-porte', x=232.5, y=107, role='poste', qui='Achille', pourquoi="Achille sur le pas du fournil, au lever"),
    dict(id='mado-enclume', x=261.4, y=103.5, role='poste', qui='Mado', pourquoi="l'enclume dehors, sous l'auvent de la forge"),
    dict(id='marthe-parvis', x=263, y=83.5, role='poste', qui='Marthe', pourquoi="Marthe au pied du clocher, corde de la cloche"),
    dict(id='achille-peche', x=132, y=132, role='poste', qui='Achille', pourquoi="la pêche du lundi à la fosse"),
    dict(id='siege-banc-place', x=208, y=119, role='siege', qui=None, pourquoi="le banc de la place"),
    dict(id='siege-banc-reveil', x=200, y=101, role='siege', qui=None, pourquoi="le banc du réveil"),
    dict(id='siege-banc-ponton', x=201.5, y=127.8, role='siege', qui=None, pourquoi="le banc du ponton"),
    dict(id='siege-banc-berge', x=248, y=124, role='siege', qui=None, pourquoi="le banc de la berge"),
    dict(id='siege-tonnelle', x=197, y=118.6, role='siege', qui='Odette', pourquoi="la tonnelle, au souper"),
    dict(id='guet-moulin', x=136, y=111, role='poste', qui=None, pourquoi="le guet de nuit de la suite du « fantôme », dans la cour du moulin", acte=3),
]

# ================================================================ version 2: intérieurs (un fichier par niveau)
# rect des pièces en coordonnées locales (0, 0 au coin nord-ouest de la pièce, 1 case = 1 m).
# meubles: (id, type du jeu ou None, modèle, x, y, rotation); points: (id, x, y, rôle, qui).
# porte: (x, y, regard en arrivant) côté intérieur; escaliers: liens vers un autre niveau.
INT = []
# Tailles des types de meubles du jeu (`donnees/commun/meubles`): le plan dessine et contrôle l'emprise réelle.
_DOSSIER_MEUBLES = os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'donnees', 'commun', 'meubles')
TAILLES = {f[:-5]: json.load(open(os.path.join(_DOSSIER_MEUBLES, f), encoding='utf-8'))['size']
           for f in sorted(os.listdir(_DOSSIER_MEUBLES)) if f.endswith('.json')}


def emprise(m):
    """Cases (x, y) que le jeu bloque pour ce meuble: centre, taille du type, rotation; un modèle à créer: sa case."""
    t = TAILLES.get(m['type'])
    if t is None:
        return [(int(m['x']), int(m['y']))]
    w, h = (t['w'], t['h']) if m['rotation'] % 2 == 0 else (t['h'], t['w'])
    x0, x1 = math.floor(m['x'] - w / 2 + 1e-6), math.floor(m['x'] + w / 2 - 1e-6)
    y0, y1 = math.floor(m['y'] - h / 2 + 1e-6), math.floor(m['y'] + h / 2 - 1e-6)
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def interieur(i, bat, nom, l, h, pieces, cloisons, meubles, points, porte=None, escaliers=(), niveau=0, note=''):
    INT.append(dict(id=i, batiment=bat, nom=nom, largeur=l, hauteur=h, surface_m2=l * h, niveau=niveau, pieces=pieces,
                    cloisons=cloisons, meubles=[dict(id=a, type=b_, modele=c, x=x, y=y, rotation=r) for a, b_, c, x, y, r in meubles],
                    points=[dict(id=a, x=x, y=y, role=r, qui=q) for a, x, y, r, q in points], porte=porte, escaliers=list(escaliers), note=note))


interieur('halte', 'halte', 'la halte', 9, 5,
          [('salle des pas perdus', [0, 0, 5, 5]), ('guichet', [5, 0, 1, 5]), ('bureau de Firmin', [6, 0, 3, 3]), ('consigne', [6, 3, 3, 2])],
          [[6, 3, 2, 1]],
          [('halte-banc', 'banc', 'bench-platform', 1, 0.5, 0), ('halte-guichet', None, 'comptoir', 5.5, 2, 1),
           ('halte-bureau', 'table-a-manger', 'table-farm', 8, 0.5, 0), ('halte-chaise', 'chaise', 'chair-farm', 7.5, 1.5, 2),
           ('halte-consigne', 'coffre', 'chest', 8.5, 4.5, 3)],
          [('halte-p-guichet', 6.5, 2.5, 'comptoir', 'Firmin'), ('halte-p-bureau', 7.5, 1.6, 'siege', 'Firmin'), ('halte-p-banc', 1.5, 1, 'siege', None)],
          porte=(2.5, 4.5, 2), note="le guichet sépare la salle du bureau; la consigne est le coffre commun des deux joueurs")
interieur('maison-rdc', 'maison', 'la maison du garde, rez-de-chaussée', 10, 7,
          [('salle commune et cuisine', [5, 0, 5, 7]), ('chambre', [0, 0, 5, 4]), ('troisième pièce', [0, 4, 5, 3])],
          # La salle et la cuisine ne font qu'une pièce (la salle commune d'une maison de garde): la cloison qui les
          # séparait, avec la table et les chaises posées à cheval sur deux rangées, isolait la porte d'entrée de tout
          # le reste. La table contre le mur nord, près de la porte (une chaise au bout, une devant); le lit double
          # contre le mur est, tête au mur, entre la table et les feux; au milieu, 2 m libres de la porte au refend
          # (ouvert en y 2-3 vers la chambre et l'escalier de la cave), à l'escalier de l'étage et aux feux.
          [[5, 0, 1, 2], [5, 4, 1, 1], [5, 6, 1, 1]],
          [('maison-cuisiniere', 'cuisiniere', 'stove', 9.5, 6.5, 0), ('maison-plan', 'plan-de-travail', 'plan-de-travail', 8, 6.5, 0),
           ('maison-table', 'table-a-manger', 'table-farm', 7, 0.5, 0), ('maison-chaise-1', 'chaise', 'chair-farm', 8.5, 0.5, 3),
           ('maison-chaise-2', 'chaise', 'chair-farm', 6.5, 1.5, 2), ('lit-de-la-maison', 'lit-double', 'bed-double', 9, 4, 3), ('maison-armoire', 'armoire', 'wardrobe', 4.5, 0.5, 0)],
          [('maison-lit-g', 8.5, 2.5, 'lit', None), ('maison-lit-d', 8.5, 5.5, 'lit', None), ('maison-cuisine', 7.5, 5.5, 'poste', None)],
          porte=(9.5, 1.5, 3), escaliers=[dict(x=5.5, y=4.5, vers='maison-etage', regard=1), dict(x=0.5, y=3.5, vers='maison-cave', regard=2)],
          note="au début, la ruine: la moitié ouest (chambre, troisième pièce) sans toit et encombrée de gravats; on dort dans la salle. L'escalier de l'étage part de la cuisine, celui de la cave de la chambre")
interieur('maison-etage', 'maison', "la maison du garde, étage", 10, 7,
          [('grenier aménageable', [0, 0, 10, 7])], [], [], [('maison-etage-milieu', 5, 3.5, 'poste', None)],
          escaliers=[dict(x=5.5, y=4.5, vers='maison-rdc', regard=2)], niveau=1, note="sous le toit, ouvert à l'acte 2 (chambre d'amis, atelier)")
interieur('maison-cave', 'maison', 'la cave de la maison', 5, 4, [('cave voûtée', [0, 0, 5, 4])], [],
          [('cave-coffre', 'coffre', 'chest', 4.5, 3.5, 3)], [('cave-lanterne', 2.5, 1.5, 'poste', None)],
          escaliers=[dict(x=0.5, y=3.5, vers='maison-rdc', regard=2)], niveau=-1, note="la lanterne sans verre (acte 3) y attend; l'escalier descend à l'aplomb de celui de la chambre")
interieur('epicerie-rdc', 'epicerie', "l'épicerie Ferrand", 7, 9,
          # Les pensionnaires traversent la cuisine pour monter: baie de 2 m (x 3-4), la table à l'ouest, près du
          # fourneau, hors du passage de la baie à l'escalier (coin sud-est).
          [('boutique', [0, 0, 7, 5]), ('cuisine', [0, 5, 7, 4])], [[0, 5, 3, 1], [5, 5, 2, 1]],
          [('epicerie-comptoir', 'comptoir-epicerie', 'comptoir', 2.5, 3, 1),
           ('epicerie-cuisiniere', 'cuisiniere', 'stove', 0.5, 8.5, 0), ('epicerie-table', 'table-a-manger', 'table-farm', 2, 7.5, 0)],
          [('odette-comptoir', 1, 2.5, 'comptoir', 'Odette'), ('odette-cuisine', 1.5, 8.5, 'poste', 'Odette')],
          porte=(6.5, 2.5, 3), escaliers=[dict(x=6.5, y=8.5, vers='epicerie-etage', regard=2)], note="la boutique donne sur la place (porte à l'est), la cuisine derrière")
interieur('epicerie-etage', 'epicerie', 'la pension Ferrand, étage', 7, 9,
          # L'escalier arrive sur un palier de 2 m (x 5-6) qui mène tout droit à la pension: les pensionnaires ne
          # traversent plus la chambre d'Odette, qui ouvre sur le palier (porte en x 4, y 6).
          [('chambre de la pension', [0, 0, 7, 5]), ('chambre d’Odette', [0, 6, 4, 3]), ('palier', [5, 5, 2, 4])], [[0, 5, 5, 1], [4, 7, 1, 2]],
          [('lit-pension-1', 'lit-simple', 'bed-single', 0.5, 1, 0), ('lit-pension-2', 'lit-simple', 'bed-single', 2.5, 1, 0),
           ('odette-lit', 'lit-simple', 'bed-single', 0.5, 7, 0)],
          [('pension-lit-a', 1.5, 1.5, 'lit', None), ('pension-lit-b', 3.5, 1.5, 'lit', None), ('odette-lit-p', 1.5, 7.5, 'lit', 'Odette')],
          escaliers=[dict(x=6.5, y=8.5, vers='epicerie-rdc', regard=2)], niveau=1, note="la chambre du premier soir, deux lits simples; l'escalier arrive sur un palier, la chambre d'Odette à côté")
interieur('fournil', 'fournil', "le fournil d'Achille", 6, 5,
          [('boutique', [0, 2, 6, 3]), ('fournil', [0, 0, 6, 2])], [[0, 2, 2, 1]],
          [('fournil-four', 'four', 'four', 5.5, 0.5, 0), ('fournil-petrin', 'plan-de-travail', 'plan-de-travail', 2, 0.5, 0),
           ('fournil-comptoir', 'comptoir-fournil', 'comptoir', 5, 2.5, 0)],
          [('achille-four', 4.5, 1, 'poste', 'Achille'), ('achille-comptoir', 4.5, 1.5, 'comptoir', 'Achille')],
          porte=(3.5, 4.5, 2), note="le four contre le pignon est, côté ru; la boutique sur la rue")
interieur('mercerie', 'mercerie', 'la mercerie-coiffure', 6, 6,
          [('boutique', [0, 0, 6, 3]), ('salon de coiffure', [0, 3, 4, 3]), ('cabine', [4, 3, 2, 3])], [[4, 3, 1, 2]],
          [('mercerie-comptoir', 'comptoir-mercerie', 'comptoir', 2, 1.5, 0), ('mercerie-fauteuil', 'chaise', 'chair-bedroom', 1.5, 4.5, 2),
           ('mercerie-armoire', 'armoire', 'wardrobe', 5.5, 5.5, 0)],
          [('solange-comptoir', 2, 2.4, 'comptoir', 'Solange'), ('jeanne-fauteuil', 2.5, 4.5, 'poste', 'Jeanne'), ('mercerie-cabine', 5, 4.5, 'poste', None)],
          porte=(3.5, 0.5, 0), note="porte au nord sur la rue; la cabine sert à essayer les tenues")
interieur('forge', 'forge', 'la forge', 5, 5,
          [('forge', [0, 0, 5, 5])], [],
          [('forge-foyer', 'four', 'four', 2.5, 0.5, 0), ('forge-haches', 'ratelier-de-la-forge', 'ratelier', 4.5, 2.5, 3), ('forge-coffre', 'coffre', 'chest', 0.5, 2.5, 1)],
          [('mado-foyer', 2.5, 1.6, 'poste', 'Mado'), ('mado-etabli', 3.5, 2.5, 'poste', 'Mado')],
          porte=(2.5, 4.5, 2), note="foyer au nord sous la hotte; l'enclume est dehors, sous l'auvent")
interieur('atelier-basile', 'scierie', "l'atelier de Basile", 9, 7,
          [('atelier', [0, 0, 9, 7])], [],
          [('basile-etabli', 'plan-de-travail', 'plan-de-travail', 4, 0.5, 0), ('basile-bois', 'tas-de-bois', 'log-pile', 0.5, 6.5, 0),
           ('basile-haches', 'etal-de-haches', 'ratelier', 8.5, 0.5, 0)],
          [('basile-p-etabli', 4, 1.6, 'poste', 'Basile')],
          porte=(8.5, 3.5, 3), note="atelier d'une pièce, porte à l'est vers l'auvent")


# ================================================================ version 3: raccord à l'histoire écrite (actes 2 et 3)
# 1. La voie: l'histoire ouvre la zone « v » dès l'article 7 (V2), avant les frênes (V2b). La plus grande part de la
#    zone est donc avant les frênes: la tranchée, puis la plaine du garage où dort le wagon (« Un wagon dort sur la voie
#    de garage », fiche de quête), puis un étranglement de 7 m où les frênes sont couchés, juste avant le poste.
ZONES['V']['poly'] = [(20, 88), (47, 88), (47, 94), (55, 94), (55, 84), (100, 84), (100, 94.5), (164, 94.5), (164, 100.5),
                      (100, 100.5), (100, 104), (55, 104), (55, 100.5), (47, 100.5), (47, 104), (34, 104), (34, 110), (40, 118),
                      (40, 134), (34, 137), (26, 136), (30, 110), (30, 104), (20, 104)]
RAILS[2]['pts'] = [(56, 97.5), (64, 93.5), (92, 93.5)]
RAILS[2]['raison'] = "l'aiguille est à 13 m du poste, après l'étranglement: la voie de garage longe la plaine et finit sur un heurtoir"
for _k, _x in (('tw1', 160), ('tw2', 146), ('tw4', 112), ('tw6', 80), ('tw3', 63), ('tw5', 44)):
    N[_k].update(x=_x, y=97.5)
_chaine_voie = {'tw1', 'tw2', 'tw3', 'tw4', 'tw5', 'tw6', 'po'}
A[:] = [a for a in A if not ({a['a'], a['b']} <= _chaine_voie)]
chaine(['tw1', 'tw2', 'tw4', 'tw6', 'tw3'], 'voie', 'la tranchée et la plaine du garage')
e('tw3', 'tw5', 'voie', "l'étranglement du poste", 'V2b'); chaine(['tw5', 'po'], 'voie', 'la clairière du poste')
VERROUS['V2b'].update(x=51, y=97.5, obstacle="trois frênes couchés en travers de l'étranglement du poste, sur la ligne, trop gros pour la hache de base")
for _q in P:
    if _q['id'] == 'wagon':
        _q.update(x=69, y=93.5, noeud='tw3', nom="le wagon oublié sur la voie de garage (cabane de Jeanne)")
    elif _q['id'] == 'aiguille':
        _q.update(x=56, y=95.5, noeud='tw3')
for _q in QUETES:
    if _q['id'] == 'A2':
        _q['etapes'] = [('gr2', 'Firmin donne le but (article 7)'), ('pn', 'le passage à niveau'), ('tw1', 'les ronces (V2)'),
                        ('tw2', 'mûres de la tranchée'), ('tw3', 'le wagon; on bute sur les frênes: Mado forge la hache'),
                        ('po', "le poste: le sémaphore, le bras, les leviers")]
# 2. Le portillon de la berge du moulin (V4): l'ancien tracé passait par un coin du bourg et posait un second carré
#    de V4 sur le sentier de l'Île, qui fermait la rivière même après la leçon de pêche (V1). Il descend maintenant
#    droit du pré du meunier à la berge, entre le moulin et la haie du bourg.
n('mp', 144.5, 126.9, 'R')
# Le carrefour des Crêtes (k1) était dans le carré de la porte haute du cimetière (V7): tant que Marthe n'a pas
# prêté la clé, le sentier des Crêtes était coupé sur la grille (vu par le contrôle de l'ordre de l'histoire).
N['k1'].update(y=55)
A[:] = [a for a in A if {a['a'], a['b']} != {'me', 'bw1'}]
e('me', 'mp', 'chemin', 'portillon de la berge', 'V4'); e('mp', 'bw1', 'chemin', 'berge du moulin')

# Ordre réel des verrous dans l'histoire (fiches de quêtes et de scènes; le contrôle le relit dans les fiches).
# antichambre: nœuds d'une zone qu'on peut atteindre avant l'étape qui l'ouvre, avec la raison.
ORDRE_HISTOIRE = [
    dict(acte=2, etape='la-minute-d-ecart/article-7', verrous=['V2'], zones=['V'], effet="la tranchée et la plaine du garage, jusqu'aux frênes"),
    dict(acte=2, etape='la-minute-d-ecart/degager', verrous=['V2b'], zones=[], effet="l'étranglement et la clairière du poste"),
    dict(acte=2, etape='la-minute-d-ecart/leviers', verrous=['V11'], zones=['R'], effet="la descente vers la vanne: la rivière par l'amont"),
    dict(acte=2, etape='la-minute-d-ecart/lecon', verrous=['V1'], zones=['R'], effet="le saule débité: la rivière par l'aval (fil parallèle à celui de la voie)"),
    dict(acte=3, etape='ceux-qui-partent/chambre', verrous=['V5', 'V6'], zones=['C'], effet="la Côte par la barrière et le raidillon"),
    dict(acte=3, etape='ceux-qui-partent/tirage', verrous=['V8'], zones=['T'], effet="la ligne morte et le tunnel"),
    dict(acte=3, etape='ceux-qui-partent/train-des-cinq', verrous=['V4'], zones=['M'], effet="la cour du moulin et le portillon de la berge"),
    dict(acte=3, etape='ceux-qui-partent/gue', verrous=['V3', 'V9'], zones=['F'], effet="le gué refait et la passerelle des Jardins"),
    dict(acte=3, etape='ceux-qui-partent/lumignon', verrous=['V7'], zones=[], effet="la porte haute du cimetière (raccourci des Crêtes)"),
    dict(acte=3, etape='ceux-qui-partent/cachette', verrous=['V10'], zones=[], effet="l'escalier de service, du tunnel au belvédère"),
]
ANTICHAMBRES = {
    'T': dict(noeuds=['k3', 'bv'], raison="le belvédère de l'Éperon est au bout du sentier des Crêtes: on le découvre avec la Côte (chapitre 1 de l'acte 3); le tunnel, lui, n'ouvre qu'avec la grille"),
}

# 3. Ce que l'histoire utilise et que la carte n'avait pas (section 7 de ecriture-actes-2-3.md).
#    Chênes qui repoussent (ressource « chene », 3 jours): la lisière pour l'acte 2, la coupe pour l'acte 3.
ARBRES_SINGULIERS += [
    dict(id='chene-lisiere-3', type='chene', x=186, y=84.2, pourquoi="lisière: les bûches de l'acte 2 (cuisine, commande, hache); repousse en 3 jours, à 3 m du château d'eau"),
    dict(id='chene-lisiere-4', type='chene', x=192.5, y=84, pourquoi="lisière: second chêne de l'acte 2, hors du chemin forestier"),
    dict(id='chene-coupe-1', type='chene', x=157, y=51, pourquoi="la coupe de Basile (c2): les huit bûches de la chambre, au bord du chemin forestier"),
    dict(id='chene-coupe-2', type='chene', x=158, y=64, pourquoi="la coupe de Basile, côté aval du chemin"),
    dict(id='chene-coupe-3', type='chene', x=167, y=56, pourquoi="la coupe de Basile, côté amont"),
    dict(id='chene-coupe-4', type='chene', x=171, y=60, pourquoi="la coupe de Basile, vers le carrefour du bas"),
]
#    Pierres plates (ressource « caillou », 1 jour): la grève du gué (bg) et la grève de l'Île (i4).
for _i, _x in enumerate((185, 186.6, 188.2, 189.8, 191.4, 184)):
    mob('caillou-greve-%d' % (_i + 1), 'caillou', 'caillou', _x, 129.4 if _i < 5 else 129.6, 0,
        "pierres plates de la grève, au pied de la berge et à 10 m du gué: la hache forgée (3 pierres) et le gué (6 pierres)", acte=1)
for _i, _x in enumerate((39, 41, 43, 45)):
    mob('caillou-ile-%d' % (_i + 1), 'caillou', 'caillou', _x, 146.4, 0, "pierres plates de la grève de l'Île, au pied de la vanne (i4)", acte=2)
#    Mûres de la tranchée (ressource « ronces »): sur les bords, la voie reste libre (3 m entre elles).
for _i, (_x, _y) in enumerate(((144.5, 95.5), (148.5, 95.5), (146.5, 99.5))):
    mob('ronces-tranchee-%d' % (_i + 1), 'ronces', 'buisson', _x, _y, 0, "les ronces des talus de la tranchée (tw2): mûres de l'été et de l'automne, sans barrer la voie", acte=2)
#    Poules et ponte: le poulailler du jardin (brique « shelter », pondoirs), son parc au sud, hors des chemins.
mob('poulailler-jardin', 'poulailler', 'poulailler', 161, 120, 0,
    "le poulailler du jardin, à 6 m du pignon ouest de la maison: son parc (6 x 4 m) descend vers la berge sans toucher le chemin", acte=1)
#    Le wagon oublié: une caisse de wagon sur la voie de garage, la cabane de Jeanne.
mob('wagon-oublie', None, 'wagon-old', 69, 93.5, 0, "le wagon oublié sur la voie de garage, porte côté ligne: la cabane de Jeanne (41 bâtons à la craie)", acte=2)
#    Réchaud de la cuisine (fait aubrune.maison.rechaud), puis cuisinière: les deux sont posés dans la cuisine.
_maison = next(i for i in INT if i['id'] == 'maison-rdc')
_maison['meubles'].append(dict(id='maison-rechaud', type='rechaud', modele='rechaud', x=6.5, y=6.5, rotation=2))
# Un meuble contre le mur sud a sa façade au nord (rotation 2): la cuisinière et le plan ne tournent plus le dos à la pièce.
for _it in INT:
    for _m in _it['meubles']:
        if _m['id'] in ('maison-cuisiniere', 'maison-plan', 'epicerie-cuisiniere'):
            _m['rotation'] = 2
#    L'allée du jardin longe le mur sud de la maison, entre la maison et le potager, et finit au poulailler.
N['jd'].update(x=179.6, y=119.4)
n('jo', 165.2, 119.4, 'B', "l'allée du jardin finit au poulailler, contre le pignon ouest de la maison; on n'y passe pas pour aller ailleurs")
e('jd', 'jo', 'sentier', 'allée du jardin')
for _r in RESSOURCES:
    if _r['id'] in ('terre-24',):
        _r['rect'] = [166, 120.5, 12, 5]
for _q in P:
    if _q['id'] == 'poulailler':
        _q.update(x=161, y=122.5, noeud='jo')
    elif _q['id'] == 'greve_ile':
        _q.update(x=42, y=146.6)
for _r in RESSOURCES:
    if _r['id'] == 'coquillages-ile':
        _r.update(x=42, y=146.6)
RESSOURCES.append(dict(id='legumes-ferme', nature='cueillette', x=216, y=155.5, noeud='fc', acte=3, saisons=['printemps', 'été', 'automne'], heures='jour',
                       pourquoi="le potager de la ferme, à l'est de la cour: carottes, poireaux, pommes de terre du pot-au-feu"))
#    Natures des parcelles (exportées dans le terrain par l'outil du paquet) et nouvelles parcelles.
NATURE_PARCELLE = {'champs': 'labour', 'pâture': 'pre', 'pré bas': 'pre', 'jardins de la Rive': 'potager', 'verger': 'verger',
                   'cimetière': 'cimetiere', 'place': 'place', 'parvis': 'place', "cour de l'école": 'cour', 'cour': 'cour',
                   'cour du moulin': 'cour', 'potager': 'potager', 'poulailler': 'cour', 'potager de la ferme': 'potager'}
for _pc in PARCELLES:
    if _pc['nom'] == 'poulailler':
        _pc['rect'] = [158, 119, 6, 7]
PARCELLES.append(dict(nom='potager de la ferme', rect=[210, 153, 12, 4.5], couleur='#9A7B55'))
for _pc in PARCELLES:
    _pc['nature'] = NATURE_PARCELLE[_pc['nom']]
SOL_PARCELLE['potager de la ferme'] = 'terre-de-jardin'
for _s in SOLS_SUPPL:
    if _s['sol'] == 'galets' and _s['rect'][0] == 100:
        _s.update(rect=[36, 146, 12, 1], pourquoi="la grève de l'Île, au pied de la vanne: pierres plates et coquillages")
    elif _s['sol'] == 'friche':
        _s.update(rect=[20, 84, 80, 20], pourquoi="la clairière du poste et la plaine du garage: herbe folle sur l'ancien ballast")
#    Nature des repères (le rendu en tire la silhouette).
for _r, _nat in zip(REPERES, ('clocher', 'chateau-d-eau', 'signal', 'roue', 'arbre', 'portail', 'arbre', 'pigeonnier')):
    _r['nature'] = _nat
#    Coins de pêche du lieu (champ `fishing` de lieu.json): l'assembleur cherche les cases d'eau et écrit la proposition.
#    Poissons et poids: proposition du level design, à équilibrer par le game designer.
PECHE_LIEU = [
    dict(id='ponton', ressource='peche-ponton', ombres=3, table=dict(goujon=4, ablette=4, perche=2)),
    dict(id='aval', ressource='peche-aval', ombres=3, table=dict(truite=3, goujon=2, ablette=2)),
    dict(id='fosse', ressource='peche-fosse', ombres=4, table=dict(goujon=3, perche=3, tanche=2, brochet=1)),
    dict(id='saule-ile', ressource='peche-saule-ile', ombres=3, table=dict(goujon=3, perche=2, tanche=2)),
    dict(id='vanne', ressource='peche-vanne', ombres=3, table=dict(brochet=2, truite=2, ablette=2)),
    dict(id='etang', ressource='peche-etang', ombres=4, table=dict(tanche=3, perche=2, goujon=2)),
]
#    Ce que l'histoire attend et qu'aucun type de `donnees/commun/` ne fait encore (rien n'est inventé ici).
MANQUES = [
    ("frênes couchés à abattre à la hache forgée (`tw3`, V2b)", "ressource « coupe » qui exige un outil de niveau 1 (le chêne accepte la hache de base, `minTier` 0)", "aujourd'hui: y revenir avec la hache forgée"),
    ("vanne à ouvrir (`vn`)", "meuble à brique « manœuvrer » qui pose un fait (la roue tourne)", "aujourd'hui: y arriver (`v1`)"),
    ("légumes de la ferme (carotte, poireau, pomme de terre) au potager de la ferme", "cultures `carotte`, `poireau`, `pomme-de-terre` (seuls `radis` et `tomate` existent)", "point `legumes-ferme` posé, parcelle « potager de la ferme » dessinée"),
    ("bœuf chez Odette (`pl-o`)", "article du commerce d'Odette (lot commerce, pas la carte)", "rien à poser sur la carte"),
    ("coins de pêche `i2` et `ponton`", "champ `fishing` de `lieu.json` (fiche de l'écriture)", "proposition calculée par l'assembleur, à recopier"),
    ("réchaud puis cuisinière", "un meuble qui apparaît avec un fait (`aubrune.maison.rechaud`)", "les deux sont posés dans la cuisine dès le début"),
    ("comptoirs, tableau noir, autel, cloche, leviers, meules du moulin", "modèles et types de meubles (`comptoir-buvette` exige un commerce)", "posés dans les plans des intérieurs, listés « à créer »"),
]

# 4. Les six intérieurs qui manquaient. Porte intérieure au droit de la porte du plan (x local = x porte - x emprise - 0,5).
interieur('cafe', 'cafe', 'le café de la Halte', 6, 5,
          # Le coin cuisine n'a plus de cloison (elle enfermait le fourneau derrière le plan de travail): il s'ouvre
          # derrière le comptoir. Les deux tables, contre les murs est et ouest, laissent l'allée de 2 m (x 2-3) de la
          # porte au comptoir; les chaises regardent leur table.
          [('cuisine et comptoir', [0, 0, 6, 2]), ('salle', [0, 2, 6, 3])], [],
          [('cafe-cuisiniere', 'cuisiniere', 'stove', 0.5, 0.5, 0), ('cafe-plan', 'plan-de-travail', 'plan-de-travail', 2, 0.5, 0),
           ('cafe-comptoir', 'comptoir-cafe', 'comptoir', 4.5, 1.5, 0), ('cafe-table-1', 'table-a-manger', 'table-farm', 0.5, 3, 1),
           ('cafe-chaise-1', 'chaise', 'chair-farm', 1.5, 2.5, 3), ('cafe-chaise-2', 'chaise', 'chair-farm', 1.5, 3.5, 3),
           ('cafe-table-2', 'table-a-manger', 'table-farm', 5.5, 4, 3), ('cafe-chaise-3', 'chaise', 'chair-farm', 4.5, 4.5, 1),
           ('cafe-chaise-4', 'chaise', 'chair-farm', 5.5, 2.5, 0)],
          [('colette-comptoir', 4.5, 0.5, 'comptoir', 'Colette')],
          porte=(3.5, 4.5, 2), note="salle sur la rue (porte au sud, côté terrasse), comptoir et coin cuisine au nord; allée de 2 m de la porte au comptoir, passage derrière le comptoir à l'est")
interieur('ecole', 'ecole', "l'école-mairie", 6, 5,
          [('classe et secrétariat de mairie', [0, 0, 6, 5])], [],
          [('ecole-tableau', None, 'blackboard', 3, 0.5, 0), ('ecole-archives', 'armoire', 'wardrobe', 5.5, 0.5, 0),
           ('ecole-banc-1', 'banc', 'bench-platform', 1, 2.5, 2), ('ecole-banc-2', 'banc', 'bench-platform', 5, 2.5, 2),
           ('ecole-table-mairie', 'table-a-manger', 'table-farm', 1, 3.5, 0)],
          [('armand-tableau', 3.5, 1.5, 'poste', 'Armand')],
          porte=(3.5, 4.5, 2), note="une seule salle: l'instituteur est aussi secrétaire de mairie (armoire des archives, table du registre); les bancs regardent le tableau, au nord")
interieur('eglise', 'eglise', "l'église Saint-Aubin", 20, 11,
          [('base du clocher', [0, 3, 5, 5]), ('nef', [6, 0, 12, 11]), ('chœur', [18, 0, 2, 11])],
          # L'arc entre la nef et la base du clocher fait 2 m (y 5-6): on y monte à deux, vers la chambre des cloches.
          [[0, 0, 5, 3], [0, 8, 5, 3], [5, 0, 1, 5], [5, 7, 1, 4]],
          [('eglise-autel', None, 'altar', 18.5, 5.5, 3), ('eglise-banc-1', 'banc', 'bench-platform', 8.5, 2, 1),
           ('eglise-banc-2', 'banc', 'bench-platform', 12.5, 2, 1), ('eglise-banc-3', 'banc', 'bench-platform', 14.5, 2, 1),
           ('eglise-banc-4', 'banc', 'bench-platform', 8.5, 8, 1), ('eglise-banc-5', 'banc', 'bench-platform', 12.5, 8, 1),
           ('eglise-banc-6', 'banc', 'bench-platform', 14.5, 8, 1)],
          [('marthe-corde', 2.5, 4.5, 'poste', 'Marthe'), ('eglise-choeur', 17, 5.5, 'poste', None)],
          porte=(10.5, 10.5, 2), escaliers=[dict(x=0.5, y=5.5, vers='eglise-clocher', regard=0)],
          note="portail latéral au sud, chœur à l'est, clocher à l'ouest: on entre face à l'allée, la corde de la cloche pend dans la base du clocher")
interieur('eglise-clocher', 'eglise', 'la chambre des cloches', 5, 5, [('chambre des cloches', [0, 0, 5, 5])], [],
          [('clocher-cloche', None, 'bell', 2.5, 2.5, 0)], [('clocher-vue', 2.5, 4.5, 'poste', None)],
          escaliers=[dict(x=0.5, y=2.5, vers='eglise', regard=0)], niveau=1,
          note="en haut de l'échelle du sonneur: la cloche au milieu, les abat-son ouverts sur le bourg (la vue de « La robe et la cloche »); le niveau intermédiaire attend l'écriture de la suite")
interieur('poste', 'poste', "le poste d'aiguillage, rez-de-chaussée", 5, 3, [('salle des transmissions', [0, 0, 5, 3])], [],
          [('poste-coffre', 'coffre', 'chest', 0.5, 2.5, 1)], [('poste-bas', 2.5, 1.5, 'poste', None)],
          porte=(2.5, 0.5, 0), escaliers=[dict(x=4.5, y=2.5, vers='poste-cabine', regard=2)],
          note="les tringles des leviers descendent vers la voie; l'escalier monte à la cabine")
interieur('poste-cabine', 'poste', 'la cabine des leviers', 5, 3, [('cabine vitrée', [0, 0, 5, 3])], [],
          [('poste-leviers', None, 'lever-frame', 2.5, 0.5, 0), ('poste-chaise', 'chaise', 'chair-farm', 0.5, 2.5, 1)],
          [('poste-cabine-leviers', 2.5, 1.5, 'poste', None)],
          escaliers=[dict(x=4.5, y=2.5, vers='poste', regard=2)], niveau=1,
          note="les leviers face à la voie (nord), la vitre donne sur le sémaphore: celui du dedans lit les étiquettes, celui du dehors voit le bras")
interieur('moulin', 'moulin', 'le moulin de la Vanne, salle des meules', 7, 7, [('salle des meules', [0, 0, 7, 7])], [],
          [('moulin-meules', None, 'millstones', 3, 4, 0), ('moulin-sacs', 'coffre', 'chest', 6.5, 6.5, 3)],
          [('berthe-meules', 4.5, 3.5, 'poste', 'Berthe')],
          # L'escalier est dans le coin sud-ouest: on en sort vers le nord, dans la salle (vers le sud, c'était le mur).
          porte=(3.5, 0.5, 0), escaliers=[dict(x=0.5, y=6.5, vers='moulin-etage', regard=2)],
          note="porte au nord sur la cour; les meules au milieu, l'arbre de la roue entre par le pignon sud")
interieur('moulin-etage', 'moulin', 'le grenier du moulin', 7, 7, [('grenier à grain', [0, 0, 7, 7])], [],
          [('moulin-grain-1', 'coffre', 'chest', 6.5, 0.5, 3), ('moulin-grain-2', 'coffre', 'chest', 6.5, 1.5, 3)],
          [('moulin-grenier', 3.5, 3.5, 'poste', None)],
          escaliers=[dict(x=0.5, y=6.5, vers='moulin', regard=2)], niveau=1, note="le grain monté en sacs, la trémie au-dessus des meules")
interieur('ferme-logis', 'ferme_logis', 'le logis de la ferme Delmas', 8, 5, [('salle commune', [0, 0, 8, 5])], [],
          [('logis-cuisiniere', 'cuisiniere', 'stove', 0.5, 0.5, 0), ('logis-plan', 'plan-de-travail', 'plan-de-travail', 2, 0.5, 0),
           # La table et ses chaises à l'est de l'allée de la porte (x 3-4): elles fermaient la salle en diagonale,
           # l'armoire et la moitié est n'étaient plus atteignables, et une chaise barrait l'entrée.
           ('logis-table', 'table-a-manger', 'table-farm', 6, 2.5, 0), ('logis-chaise-1', 'chaise', 'chair-farm', 5.5, 1.5, 0),
           ('logis-chaise-2', 'chaise', 'chair-farm', 6.5, 3.5, 2), ('logis-armoire', 'armoire', 'wardrobe', 7.5, 0.5, 0)],
          [('margot-cuisine', 1.5, 1.5, 'poste', 'Margot'), ('paulin-table', 5.5, 3.5, 'poste', 'Paulin')],
          porte=(4.5, 4.5, 2), note="une salle commune: la cuisine au nord-ouest, la grande table à l'est de l'allée, la porte au midi sur la cour")


# ================================================================ version 4: manques relevés la nuit du 2026-11-11
# 1. La grue à eau: la locomotive fait de l'eau en face du château d'eau, qui la remplit par une conduite enterrée
#    (8 m, droit vers le sud). Elle est au bord nord de la voie, colonne à 2,2 m de l'axe des rails: son bras
#    pivote au-dessus du tender. Repère en données (`landmarks.kind`), modèle livré `water-crane`.
REPERES.append(dict(id='grue_eau', nom='la grue à eau', x=189, y=95.3, h=3.6, nature='grue-a-eau',
                    raison="en face du château d'eau, qui la remplit par une conduite enterrée; au bord nord de la voie, son bras pivote au-dessus de la locomotive à l'arrêt devant le quai"))
# 2. Les lits des habitants qui dormaient debout (section 8 de ecriture-suites-secondaires.md).
#    Marthe: une pièce de 5 x 5, porte à l'est sur la rue de l'Église (au droit de la porte du plan); le lit contre
#    le mur ouest, au fond, loin de la rue; la table contre le mur sud, sous la fenêtre au soleil. Ni cuisinière ni
#    armoire: on ne cuisine ni ne range chez une voisine.
interieur('marthe', 'marthe', 'la maison de Marthe', 5, 5, [('salle', [0, 0, 5, 5])], [],
          [('marthe-lit', 'lit-simple', 'bed-single', 0.5, 1, 0), ('marthe-table', 'table-a-manger', 'table-farm', 1, 4.5, 2),
           ('marthe-chaise', 'chaise', 'chair-farm', 1.5, 3.5, 0)],
          [('marthe-lit-p', 1.5, 1.5, 'lit', 'Marthe')],
          porte=(4.5, 2.5, 3), note="la maison de la sonneuse: une salle, le lit au fond contre le mur ouest, la table au midi; 1,5 m libres devant la porte, à l'est sur la rue de l'Église")
for _b in B:
    if _b['id'] == 'marthe':
        _b['interieur'] = 'une salle: lit, table: 25 m²'
#    Berthe: le meunier dort au moulin, au grenier au-dessus des meules: il entend la meule et la vanne la nuit.
#    Le lit dans le coin nord-ouest, loin de l'escalier (sud-ouest) et des sacs de grain (est).
for _it in INT:
    if _it['id'] == 'moulin-etage':
        _it['meubles'].append(dict(id='berthe-lit', type='lit-simple', modele='bed-single', x=0.5, y=1, rotation=0))
        _it['points'].append(dict(id='berthe-lit-p', x=1.5, y=1.5, role='lit', qui='Berthe'))
        _it['note'] = "le grain monté en sacs, la trémie au-dessus des meules; le lit de Berthe au coin nord-ouest: le meunier dort au moulin, il entend la meule et la vanne"
# 3. Un pommier et deux touffes de coquelicots (types `pommier-d-automne` et `coquelicots`). Revenu possible ajouté,
#    tirages à leur moyenne (méthode de economie-aubrune.md, section 3): pommier 2 tirages de 1 à 2 pommes par jour,
#    en automne seulement (2026-11-11, game-designer), 3 x 0,70 = 2,10 EUR; coquelicots 1 à 2 fleurs par jour et par
#    touffe, au printemps et en été, 1,5 x 0,60 = 0,90 EUR chacune. Total: 1,80 EUR par jour au printemps et en été,
#    2,10 EUR en automne, rien en hiver.
ARBRES_SINGULIERS.append(dict(id='pommier-verger', type='pommier-d-automne', x=309.5, y=118.5,
                              pourquoi="le pommier du verger communal: on le secoue, les pommes tombent dans l'herbe; le coin de cueillette est au sud-est, côté caméra, hors du houppier"))
mob('coquelicots-verger', 'coquelicots', 'poppies', 305.5, 124.5, 0,
    "dans l'herbe haute du verger, qu'on ne fauche qu'en juillet: la seule touffe du bourg (la mercerie les rachète)")
mob('coquelicots-champs', 'coquelicots', 'poppies', 236.5, 162.5, 0,
    "sur la tournière des champs des Delmas, entre le chemin des Champs et le labour: le coquelicot pousse au bord des blés", acte=3)
# 4. L'enclume dehors, contre le mur ouest de la forge, sous l'auvent qui donne sur la rue de l'Église: Mado y tape
#    côté rue, face à l'est (poste `mado-enclume`), le foyer est derrière le mur.
mob('enclume-forge', 'enclume', 'enclume', 262.5, 103.5, 3,
    "contre le mur ouest de la forge, sous l'auvent, au bord de la rue de l'Église: Mado s'y tient côté rue, au poste mado-enclume (amélioration et réparation des outils)")
#    Le râtelier de Basile, dos au mur est de l'atelier (il était à 1,2 m du mur, sans appui), à côté de la porte;
#    le poulailler du jardin posé sur ses cases (3 x 2), sa rampe au sud vers le parc.
for _m in M_:
    if _m['id'] == 'haches-basile':
        _m.update(x=176.5, y=90.5, pourquoi="sous l'auvent est, dos au mur de l'atelier, à côté de la porte: Basile prête ses outils (acte 1)")
    elif _m['id'] == 'poulailler-jardin':
        _m.update(x=161.5, pourquoi="le poulailler du jardin (3 x 2 m) en haut de son parc, à 5,5 m du pignon ouest de la maison: sa rampe descend au sud dans le parc, qui ne touche pas le chemin")
# 5. Sols: « prairie » était un second nom du pré (`pre`), que le rendu connaît; les autres natures sans aspect sont
#    listées dans plan.md (section 15), leur aspect et leur semis d'arbres relèvent du rendu.
for _s in SOLS_SUPPL:
    if _s['sol'] == 'prairie':
        _s['sol'] = 'pre'
# 6. La traversée de service ne coupe plus le bout du quai: le quai s'arrête 3 m avant la halte (27 m), la
#    traversée passe entre les deux, au niveau des rails, et l'on monte sur le quai d'une marche (bordure de 12 cm).
for _b in B:
    if _b['id'] == 'quai_b':
        _b['rect'][2] = 27
        _b['gabarit'] = gabarit(_b)
        _b['raison'] += "; 27 m: il s'arrête à 3 m de la halte, où passe la traversée de service"
for _s in SOLS_SUPPL:
    if _s['sol'] == 'gravier':
        _s['rect'] = [185, 99, 27, 4]
for _m in M_:
    if _m['id'] == 'reverbere-quai-2':
        _m.update(x=210.5, pourquoi="éclairage du quai, au bout est, au-dessus de la marche de la traversée de service: la potence vers la voie")


# ================================================================ version 5: revue visuelle du 2026-11-11 (corrections 2 et 5)
# 1. Intérieurs habités. Objets d'intérieur livrés le 2026-11-11 (`donnees/commun/meubles`), posés selon qui vit là.
#    Règles (contrôlées par `verifier_habite` plus bas et par controler_plan.py):
#    - Le rendu pose un objet de la carte au sol (`base: 0`) et n'a pas de champ « posé sur »: les objets de plateau
#      (couche `top`: lampes, pendule, journal, livres, bocaux, boîtes, pots, bouquet, corbeille de pain) attendent
#      ce moyen; leur place prévue est dans plan.md (section 16). Ici: objets de sol, tapis et objets muraux.
#    - La caméra regarde du sud-ouest (lacet 45): les murs nord et est restent debout, les murs sud et ouest sont
#      coupés. Un objet mural va donc au mur nord (rotation 0, dos au nord) ou au mur est (rotation 3), jamais sur
#      une fenêtre ni une porte (relevé des fenêtres du rendu), jamais sur une cloison (le rendu ne la dessine pas).
#    - 1,5 m libres devant chaque porte et chaque escalier (les deux cases devant); aucun objet sur un point;
#      rien dans l'emprise prévue d'un meuble encore sans modèle (guichet, tableau, meules, autel, leviers, cloche).
#    - Un objet haut (vaisselier, poêle) se pose contre un mur debout ou à plus de 0,75 m d'une fenêtre.
_MODELES = {f[:-5]: json.load(open(os.path.join(_DOSSIER_MEUBLES, f), encoding='utf-8'))['model']
            for f in sorted(os.listdir(_DOSSIER_MEUBLES)) if f.endswith('.json')}
HABITE = {
    # La maison du garde: les joueurs la meublent eux-mêmes (stock, décoration); on n'y met que ce qu'une salle
    # commune a toujours, et dans la moitié en ruine les outils du déblayage.
    'maison-rdc': [
        ('patere', 'patere', 9.5, 0.5, 0, "contre le mur nord, à côté de la porte d'entrée: on y prend sa veste en sortant"),
        ('horloge', 'horloge-murale', 8.5, 0.5, 0, "au-dessus du bout de table: on la lit de la table, du lit et de la porte"),
        ('portrait', 'cadre-ovale', 9.5, 3.5, 3, "au mur est, au-dessus de la tête du lit"),
        ('panier', 'panier-a-linge', 9.5, 2.5, 0, "au pied du lit, contre le mur est, hors du passage de la porte"),
        ('seau', 'seau', 9.5, 5.5, 0, "l'eau tirée à la pompe du jardin, posée à côté de la cuisinière"),
        ('tapis-de-sol', 'tapis-long', 7.5, 2.5, 0, "le passage de la porte vers la cuisine et le lit, là où l'on marche le plus"),
        ('balai', 'balai', 3.5, 1.5, 0, "le balai du déblayage, laissé dans la chambre en ruine"),
        ('seau-gravats', 'seau', 2.5, 0.5, 0, "le seau des gravats de la chambre en ruine"),
    ],
    'maison-cave': [
        ('etagere', 'etagere-murale', 1.5, 0.5, 0, "l'étagère des conserves contre le mur nord, au frais"),
        ('caisse', 'caisse-de-legumes', 3.5, 0.5, 0, "les pommes de terre de l'hiver, au frais et dans le noir"),
        ('tonnelet', 'tonnelet', 4.5, 0.5, 0, "un tonnelet de vin oublié par l'ancien garde"),
    ],
    'halte': [
        ('horloge', 'horloge-murale', 8.5, 0.5, 3, "l'horloge de Firmin, au coin de son bureau: il la lit du guichet (il parle en horaires)"),
        ('affiche', 'cadre-paysage', 0.5, 0.5, 0, "l'affiche de la ligne au-dessus du banc des voyageurs"),
        ('reglement', 'cadre-portrait', 8.5, 0.5, 0, "le règlement de la Compagnie encadré au-dessus du bureau de Firmin"),
        ('patere', 'patere', 8.5, 1.5, 3, "la patère de Firmin dans son bureau (casquette, pèlerine); à trois cœurs, il en visse une seconde à ton nom"),
        ('poele', 'poele', 3.5, 1.5, 0, "le poêle de la salle d'attente, au milieu, à 1 m du mur des fenêtres; le guichet garde ses deux cases de clients"),
        ('buches', 'buches-d-interieur', 3.5, 0.5, 0, "le bois du poêle, contre le mur nord, entre deux fenêtres"),
        ('balai', 'balai', 0.5, 3.5, 0, "le balai de Firmin: la salle des pas perdus se balaie après chaque train"),
        ('colis', 'caisse-de-legumes', 7.5, 4.5, 0, "un cageot en consigne, qui attend le train du samedi"),
        ('fut', 'tonnelet', 6.5, 4.5, 0, "un fût expédié par la ligne, en consigne"),
    ],
    # Colette: « le tabouret du bout devient le tien » (à trois cœurs).
    'cafe': [
        ('etagere-1', 'etagere-murale', 1.5, 0.5, 0, "les tasses et les boîtes de chicorée au-dessus du plan de travail"),
        ('etagere-2', 'etagere-murale', 2.5, 0.5, 0, "la vaisselle du café, au-dessus du plan de travail"),
        ('horloge', 'horloge-murale', 5.5, 0.5, 0, "l'heure des trains, derrière le comptoir: Colette la lit en servant"),
        ('portrait', 'cadre-portrait', 5.5, 4.5, 3, "un portrait au-dessus de la table du fond (pas en y 3: il masquerait la fenêtre est)"),
        # Le tabouret du bout du comptoir attend: devant ce comptoir d'une case, il prendrait la place du client.
        # Pas de bûches: toute case pleine de la rangée y 1 enfermerait la cuisinière, et (3; 0) est le seul passage
        # vers la place de Colette derrière le comptoir.
        ('tonnelet', 'tonnelet', 0.5, 4.5, 0, "le tonnelet de vin du pays, au coin de la salle, loin du soleil de la vitrine"),
        ('seau', 'seau', 0.5, 1.5, 0, "l'eau de la cuisinière, posée à côté d'elle"),
        ('balai', 'balai', 2.5, 4.5, 0, "appuyé à côté de la porte, sans gêner l'entrée"),
        ('tapis-de-sol', 'tapis-long', 3.5, 2.5, 1, "l'allée de la porte au comptoir: on s'y essuie les pieds"),
    ],
    # Odette: épicerie devant, cuisine et souper des pensionnaires derrière; « le bocal de derrière: les cerises de sa mère ».
    'epicerie-rdc': [
        ('etagere-1', 'etagere-murale', 0.5, 0.5, 0, "les rayons de l'épicerie, côté Odette, derrière le comptoir"),
        ('etagere-2', 'etagere-murale', 3.5, 0.5, 0, "les rayons de l'épicerie, entre les deux fenêtres"),
        ('etagere-3', 'etagere-murale', 6.5, 0.5, 0, "les rayons de l'épicerie, dans le coin de la porte"),
        ('caisse-1', 'caisse-de-legumes', 1.5, 0.5, 0, "la réserve de pommes de terre, derrière le comptoir"),
        ('caisse-2', 'caisse-de-legumes', 4.5, 0.5, 0, "un cageot de pommes contre le mur du fond"),
        ('caisse-4', 'caisse-de-legumes', 5.5, 0.5, 0, "un cageot à la place de l'ancien étal: la tourte ne se donne plus, elle se vend en rayon"),
        ('tonnelet', 'tonnelet', 0.5, 4.5, 0, "l'huile au détail, derrière le comptoir"),
        ('horloge', 'horloge-murale', 6.5, 4.5, 3, "au mur est, vue du comptoir: l'heure de fermer"),
        ('balai', 'balai', 6.5, 3.5, 0, "à côté de la porte: Odette balaie devant chez elle"),
        ('portrait', 'cadre-portrait', 6.5, 6.5, 3, "dans la cuisine, le portrait de sa mère (celle des cerises)"),
        ('buches', 'buches-d-interieur', 0.5, 7.5, 0, "le bois de la cuisinière, à côté d'elle"),
        ('seau', 'seau', 2.5, 8.5, 0, "l'eau de la cuisine, entre la cuisinière et la table"),
        ('vaisselier', 'vaisselier', 2, 6.5, 0, "la vaisselle du souper, face à la table, dos à la cloison de la boutique"),
        ('panier', 'panier-a-linge', 5.5, 6.5, 0, "le linge des pensionnaires, au pied de l'escalier, prêt à monter"),
        ('tonnelet-2', 'tonnelet', 5.5, 8.5, 0, "le cidre, sous l'escalier"),
        ('caisse-3', 'caisse-de-legumes', 4.5, 8.5, 0, "les légumes du souper à éplucher"),
        ('tapis-de-sol', 'tapis-rond', 2, 8, 0, "sous la table du souper"),
    ],
    'epicerie-etage': [
        ('gravure', 'cadre-paysage', 3.5, 0.5, 0, "une gravure entre les deux lits, au-dessus de la place de la table de nuit"),
        ('patere', 'patere', 6.5, 0.5, 0, "la patère des pensionnaires, dans le coin le plus proche du palier"),
        ('portrait', 'cadre-portrait', 6.5, 3.5, 3, "un portrait au mur est de la chambre"),
        ('etagere', 'etagere-murale', 6.5, 4.5, 3, "l'étagère où l'on pose ses affaires, près du palier"),
        ('panier', 'panier-a-linge', 4.5, 0.5, 0, "le linge sale des pensionnaires, sous la fenêtre"),
        ('tapis-de-sol', 'tapis-long', 2.5, 2.5, 0, "la descente de lit au pied des deux lits"),
        ('tabouret', 'tabouret-de-ferme', 4.5, 1.5, 0, "le tabouret qui sert de table de nuit au second lit"),
        ('odette-panier', 'panier-a-linge', 0.5, 8.5, 0, "le panier d'Odette au pied de son lit"),
        ('odette-tapis-rond', 'tapis-rond', 3, 8, 0, "le tapis tressé de la chambre d'Odette, à côté du lit"),
    ],
    # Achille: « à moitié endormi »; le fournil derrière, la boutique devant.
    'fournil': [
        ('etagere', 'etagere-murale', 0.5, 0.5, 0, "les moules et les bannetons au-dessus du pétrin"),
        ('buches', 'buches-d-interieur', 4.5, 0.5, 0, "le bois du four rangé contre lui, côté pétrin, hors de sa gueule"),
        ('affiche', 'cadre-paysage', 5.5, 1.5, 3, "au mur est, face au comptoir"),
        ('etagere-pains', 'etagere-murale', 5.5, 2.5, 3, "les pains rangés derrière le comptoir"),
        ('horloge', 'horloge-murale', 5.5, 3.5, 3, "l'heure des fournées, lue du comptoir"),
        ('patere', 'patere', 5.5, 4.5, 3, "le tablier et la veste d'Achille, près de la porte"),
        ('seau', 'seau', 0.5, 1.5, 0, "l'eau du pétrin, à côté de lui"),
        ('balai', 'balai', 2.5, 1.5, 0, "la farine se balaie devant le pétrin"),
        ('tabouret', 'tabouret-de-ferme', 0.5, 3.5, 0, "le tabouret où Achille somnole entre deux fournées"),
        ('panier', 'panier-a-linge', 0.5, 4.5, 0, "les toiles à pâtons propres, revenues de la lessive"),
        ('tapis-de-sol', 'tapis-long', 3.5, 2.5, 1, "l'allée de la porte au comptoir"),
    ],
    # Solange: ancienne comédienne (« a quitté la scène par trac »).
    'mercerie': [
        ('rubans', 'etagere-murale', 0.5, 0.5, 0, "les bobines et les rubans, à gauche en entrant"),
        ('boutons', 'etagere-murale', 1.5, 0.5, 0, "les boîtes de boutons, au-dessus du bout du comptoir"),
        ('patere', 'patere', 5.5, 0.5, 0, "les manteaux des clientes, près de la porte"),
        ('affiche', 'cadre-portrait', 5.5, 1.5, 3, "une affiche de théâtre encadrée: le seul souvenir de scène que Solange montre"),
        ('panier', 'panier-a-linge', 0.5, 3.5, 0, "les serviettes du salon de coiffure"),
        ('balai', 'balai', 0.5, 5.5, 0, "les cheveux se balaient au coin du salon"),
        ('tapis-de-sol', 'tapis-rond', 2, 4, 0, "sous le fauteuil de coiffure"),
        ('tabouret', 'tabouret-de-ferme', 3.5, 3.5, 0, "le tabouret où l'on attend son tour au salon"),
    ],
    # Mado: rit fort, tape; elle écrit à Barnabé sur des fers à cheval.
    'forge': [
        ('fers', 'etagere-murale', 0.5, 0.5, 0, "les fers à cheval et les clous, au mur nord"),
        ('patere', 'patere', 4.5, 0.5, 0, "le tablier de cuir de Mado"),
        ('outils', 'etagere-murale', 4.5, 1.5, 3, "les pinces et les marteaux au mur est, au-dessus du râtelier"),
        ('seau', 'seau', 1.5, 0.5, 0, "le seau de trempe à côté du foyer"),
        ('buches', 'buches-d-interieur', 3.5, 0.5, 0, "le bois du foyer, de l'autre côté"),
        ('tonnelet', 'tonnelet', 0.5, 3.5, 0, "la réserve d'eau, près du coffre"),
        ('balai', 'balai', 0.5, 4.5, 0, "à côté de la porte"),
    ],
    # Basile: trois mots par phrase; il parle à ses planches et prête son rabot.
    'atelier-basile': [
        ('rabots', 'etagere-murale', 0.5, 0.5, 0, "les rabots et les gouges (dont celui qu'il te prête)"),
        ('outils', 'etagere-murale', 1.5, 0.5, 0, "les serre-joints, au mur nord"),
        ('patere', 'patere', 7.5, 0.5, 0, "la veste de Basile, entre l'établi et le râtelier"),
        ('planches', 'etagere-murale', 8.5, 5.5, 3, "les petites planches choisies, au mur est"),
        ('balai', 'balai', 8.5, 6.5, 0, "les copeaux se balaient vers le coin"),
        ('seau', 'seau', 5.5, 0.5, 0, "l'eau de la pierre à affûter, à côté de l'établi"),
        ('tabouret', 'tabouret-de-ferme', 5.5, 1.5, 0, "le tabouret de l'établi"),
        ('buches', 'buches-d-interieur', 2.5, 6.5, 0, "les chutes de bois, près du tas (une case libre entre eux: on y prend le bois)"),
        ('tonnelet', 'tonnelet', 0.5, 5.5, 0, "la colle et l'huile de lin"),
    ],
    # Armand: instituteur et secrétaire de mairie; il fait la leçon au squelette (modèle à créer).
    'ecole': [
        ('patere', 'patere', 5.5, 4.5, 3, "les blouses et les cartables, près de la porte"),
        ('poele', 'poele', 0.5, 0.5, 0, "le poêle de la classe, dans le coin nord-ouest"),
        ('buches', 'buches-d-interieur', 0.5, 1.5, 0, "le bois du poêle, à côté de lui"),
        ('balai', 'balai', 4.5, 4.5, 0, "la classe se balaie le soir; appuyé à côté de la porte, au mur sud ouvert par la porte"),
        ('seau', 'seau', 1.5, 4.5, 0, "l'eau de l'éponge du tableau"),
    ],
    # Margot et Paulin: la salle commune de la ferme.
    'ferme-logis': [
        ('etagere', 'etagere-murale', 3.5, 0.5, 0, "les écuelles, à côté du plan de travail"),
        ('horloge', 'horloge-murale', 4.5, 0.5, 0, "l'horloge de la ferme, entre les fenêtres, vue de la table"),
        ('patere', 'patere', 7.5, 4.5, 3, "les vestes de travail, du côté de la porte"),
        ('seau', 'seau', 3.5, 1.5, 0, "l'eau de la cuisine, devant le plan de travail"),
        ('buches', 'buches-d-interieur', 0.5, 2.5, 0, "le bois de la cuisinière, une case plus loin: la case devant elle reste libre"),
        ('caisse', 'caisse-de-legumes', 0.5, 3.5, 0, "les légumes du potager de la ferme"),
        ('tonnelet', 'tonnelet', 0.5, 4.5, 0, "le cidre de la ferme"),
        ('panier', 'panier-a-linge', 7.5, 2.5, 0, "le linge à repriser, à côté de la table"),
        ('balai', 'balai', 3.5, 4.5, 0, "à côté de la porte"),
        ('tapis-de-sol', 'tapis-rond', 6, 3, 0, "sous la table"),
    ],
    # Marthe: sèche, exacte; « un coup de cloche en moins pour sa sœur ».
    'marthe': [
        ('soeur', 'cadre-ovale', 0.5, 0.5, 0, "le portrait de sa sœur, au-dessus de la tête du lit"),
        ('horloge', 'horloge-murale', 1.5, 0.5, 0, "l'heure exacte de la sonneuse, vue du lit"),
        ('etagere', 'etagere-murale', 3.5, 0.5, 0, "au mur nord, près de la porte"),
        ('patere', 'patere', 4.5, 0.5, 0, "la pèlerine et la clé de l'église, près de la porte"),
        ('panier', 'panier-a-linge', 2.5, 0.5, 0, "sous la fenêtre"),
    ],
    # Berthe: sa meule s'appelle Marguerite, comme sa mère.
    'moulin': [
        ('portrait', 'cadre-portrait', 6.5, 3.5, 3, "le portrait de Marguerite, sa mère, face aux meules qui portent son nom"),
        ('balai', 'balai', 5.5, 3.5, 0, "la farine se balaie autour des meules"),
        ('tabouret', 'tabouret-de-ferme', 1.5, 1.5, 0, "le tabouret d'où Berthe écoute sa meule"),
        ('seau', 'seau', 5.5, 0.5, 0, "à droite de la porte"),
    ],
    'moulin-etage': [
        ('patere', 'patere', 3.5, 0.5, 0, "la veste du meunier, près du lit, entre les deux fenêtres"),
        ('panier', 'panier-a-linge', 1.5, 0.5, 0, "le linge de Berthe, à la tête du lit"),
    ],
    'eglise': [
        ('tapis-1', 'tapis-long', 8.5, 5.5, 0, "le tapis de l'allée centrale, de l'arc du clocher vers le chœur"),
        ('tapis-2', 'tapis-long', 11.5, 5.5, 0, "le tapis de l'allée centrale"),
        ('tapis-3', 'tapis-long', 14.5, 5.5, 0, "le tapis de l'allée centrale, jusqu'au chœur"),
        ('balai', 'balai', 4.5, 3.5, 0, "Marthe range son balai dans la base du clocher"),
        ('seau', 'seau', 4.5, 7.5, 0, "et son seau, de l'autre côté de l'arc"),
    ],
    'poste': [
        ('horloge', 'horloge-murale', 0.5, 0.5, 0, "l'heure exacte des trains, au mur nord"),
        ('patere', 'patere', 4.5, 0.5, 0, "la veste de l'aiguilleur, au pied de l'escalier"),
        ('plan-voies', 'cadre-paysage', 4.5, 1.5, 3, "le tableau des circulations au mur est"),
        ('balai', 'balai', 3.5, 2.5, 0, "à côté de l'escalier, hors de son arrivée"),
    ],
    'poste-cabine': [
        ('poele', 'poele', 0.5, 0.5, 0, "le poêle de la cabine, dans le coin, loin des leviers"),
        ('buches', 'buches-d-interieur', 0.5, 1.5, 0, "son bois"),
        ('plan-voies', 'cadre-paysage', 4.5, 0.5, 3, "le plan des voies, au mur est, au bout des leviers"),
    ],
}
for _it in INT:
    for _s, _t, _x, _y, _r, _pq in HABITE.get(_it['id'], ()):
        _it['meubles'].append(dict(id='%s-%s' % (_it['id'], _s), type=_t, modele=_MODELES[_t], x=_x, y=_y, rotation=_r, pourquoi=_pq))

# 2. Vues de jour trop vides dehors. Seuls des types de meubles sans brique de récolte (le décor ajouté n'est pas
#    récoltable, l'économie ne bouge pas). Les rochers, buissons, herbes sauvages, tonneaux, caisses, bancs de ferme,
#    tas de bûches, puits, auges et clôtures ont un modèle livré mais aucun type de meuble: listés dans plan.md (section 16).
DECOR_VUES = [
    # ferme (220, 162): les champs des Delmas et leur potager.
    ('ferme', 'cageot-ferme-1', 'caisse-de-legumes', 212.5, 157.5, 0, "cageots de la récolte du potager de la ferme, au bord du chemin des Champs: la charrette les prend là"),
    ('ferme', 'cageot-ferme-2', 'caisse-de-legumes', 213.5, 157.5, 0, "cageots de la récolte, au bord du chemin"),
    ('ferme', 'cageot-ferme-3', 'caisse-de-legumes', 214.5, 157.5, 0, "cageots de la récolte, au bord du chemin"),
    ('ferme', 'seau-potager-ferme', 'seau', 210.5, 157.5, 0, "le seau d'arrosage, au coin du potager"),
    ('ferme', 'banc-champs', 'banc-de-table', 228, 156.5, 0, "le banc où Margot et Paulin cassent la croûte, au bord du chemin, face à leurs champs"),
    ('ferme', 'panier-champs', 'panier-a-linge', 229.5, 156.5, 0, "le panier du casse-croûte, à côté du banc"),
    ('ferme', 'tonnelet-labour', 'tonnelet', 213.5, 163.5, 0, "le tonnelet d'eau des travailleurs, au coin du labour"),
    ('ferme', 'seau-labour', 'seau', 212.5, 164.5, 0, "le seau des bêtes de trait, au coin du labour"),
    # talus (196, 141.5): l'arrière du logis de la ferme, entre son mur nord et la rivière.
    ('talus', 'bois-logis-1', 'buches-d-interieur', 201.5, 146.5, 0, "le bois de chauffe empilé contre le mur nord du logis, sous l'avant-toit"),
    ('talus', 'bois-logis-2', 'buches-d-interieur', 202.5, 146.5, 0, "le bois de chauffe contre le mur nord du logis"),
    ('talus', 'tonnelet-logis', 'tonnelet', 204.5, 146.5, 0, "un tonnelet qui attend le cidre, contre le mur nord, à l'ombre"),
    ('talus', 'banc-talus', 'banc-de-table', 196, 143.5, 2, "un banc à mi-pente, face à la rivière et au bourg: Margot y écosse"),
    ('talus', 'panier-talus', 'panier-a-linge', 197.5, 143.5, 0, "le panier de légumes à écosser, à côté du banc"),
    ('talus', 'seau-talus', 'seau', 192.5, 140.5, 0, "le seau puisé à la rivière, en haut de la berge (Margot descend à la grève le matin)"),
    # clôture (151, 101.5): le pré des cheminots, entre leur chemin et la clôture de la voie.
    ('cloture', 'banc-cheminots', 'banc', 152, 101.5, 2, "le banc des cheminots face à la voie: on y regarde passer les trains"),
    ('cloture', 'bois-cheminots-1', 'buches-d-interieur', 157.5, 100.5, 0, "le bois fendu des logements de la Compagnie, au pied de la clôture"),
    ('cloture', 'bois-cheminots-2', 'buches-d-interieur', 158.5, 100.5, 0, "le bois fendu des logements de la Compagnie"),
    ('cloture', 'cageot-cheminots', 'caisse-de-legumes', 147.5, 104.5, 0, "un cageot du jardin des cheminots, au bord de leur chemin"),
    ('cloture', 'seau-cheminots', 'seau', 148.5, 104.5, 0, "le seau d'arrosage du jardin des cheminots"),
    # berge (195.5, 127.2): l'arrière de la pension d'Odette, la berge et la grève.
    ('berge', 'tonnelet-pension', 'tonnelet', 188.5, 121.5, 0, "le tonnelet de cidre d'Odette contre le mur sud de la pension, à l'ombre"),
    ('berge', 'panier-pension', 'panier-a-linge', 191.5, 122.5, 0, "le linge des pensionnaires, qu'Odette étend au soleil de la berge"),
    ('berge', 'seau-pension', 'seau', 190.5, 122.5, 0, "le seau de la lessive, à côté du panier"),
    ('berge', 'bois-flotte-1', 'buches-d-interieur', 193.5, 128.5, 0, "du bois flotté tiré de la grève, qui sèche au-dessus de l'eau"),
    ('berge', 'bois-flotte-2', 'buches-d-interieur', 194.5, 128.5, 0, "du bois flotté qui sèche"),
    # rue du bourg (204, 124): la place, la tonnelle et la descente au ponton.
    ('rue-du-bourg', 'seau-pompe', 'seau', 208, 114.5, 0, "le seau sous le bec de la pompe de la place"),
    ('rue-du-bourg', 'tonnelet-tonnelle', 'tonnelet', 195.5, 122.5, 0, "le cidre du souper de la tonnelle, au pied de la pension"),
    ('rue-du-bourg', 'panier-lessive', 'panier-a-linge', 210.5, 122.5, 0, "la lessive descendue à la rivière, posée en haut de la berge"),
    ('rue-du-bourg', 'seau-lessive', 'seau', 211.5, 122.5, 0, "le seau de rinçage de la lessive"),
    # orée (104, 90): la plaine du garage, au bord du ballast.
    ('oree', 'tonnelet-garage', 'tonnelet', 97.5, 94.5, 0, "un tonnelet de graisse d'aiguillage oublié par la Compagnie au bord de la plaine du garage"),
    ('oree', 'seau-garage', 'seau', 96.5, 94.5, 0, "le seau de graisse, à côté"),
]
for _v, _i, _t, _x, _y, _r, _pq in DECOR_VUES:
    mob(_i, _t, _MODELES[_t], _x, _y, _r, _pq, acte=1 if _v in ('berge', 'rue-du-bourg', 'cloture') else 2 if _v == 'oree' else 3)
    M_[-1]['vue'] = _v

# 3. Fouilles qui ont leur fiche de ressource (`donnees/commun/ressources/<id>.json`): l'objet la porte (`resource`).
for _r in RESSOURCES:
    if _r['id'] in ('fouille-roche', 'fouille-ballast', 'fouille-pierre-levee'):
        _r['fiche'] = _r['id']


# ================================================================ version 6: objets posés sur les meubles, décor du dehors (2026-11-11)
# 1. Le moyen qui manquait existe: un objet d'une pièce déclare `on` (l'identifiant de son porteur, dans la même
#    pièce) et le rendu le pose sur le plateau (`top` de la fiche du porteur; `src/donnees/poses.ts`). La place de
#    chaque objet se donne dans le repère du modèle du porteur (gx le long du meuble, gz vers sa façade), sur la
#    partie du plateau que le modèle laisse libre (relevé des sommets au-dessus du plateau: la balance et les bocaux
#    du comptoir d'Odette, la cafetière de Colette, les miches d'Achille, les coupons de Solange restent seuls).
#    Règles (controler_plan.py, `controler_habillage`): porteur dans la pièce, avec `top`; centre dans la boîte du
#    modèle du porteur; pas deux objets l'un dans l'autre; rien qui monte à 1,3 m ou plus à moins de 0,75 m d'un mur
#    (le rendu y décalerait une fenêtre). Rien ne se pose sur un tabouret ni sur une chaise: on s'y assoit.
#    Les objets posés ne bloquent pas et ne se visent pas: on s'assoit toujours à la table, le comptoir sert toujours.
def _local(m, gx, gz):
    a = m['rotation'] * math.pi / 2
    return (round(m['x'] + gx * math.cos(a) + gz * math.sin(a), 3), round(m['y'] - gx * math.sin(a) + gz * math.cos(a), 3))


SUR = {
    # pièce: (suffixe, type, porteur, gx, gz, rotation par rapport au porteur, pourquoi)
    'maison-rdc': [
        ('lampe', 'lampe-a-petrole', 'maison-table', 0.42, -0.2, 0, "la lampe du repas, au bout de la table côté mur: on y mange et on y lit le soir"),
        ('pain', 'corbeille-de-pain', 'maison-table', -0.05, -0.12, 0, "la miche du jour au milieu de la table"),
        ('journal', 'journal', 'maison-table', -0.45, 0.18, 2, "le journal du matin, déplié devant la chaise"),
        ('pots', 'pots-de-gres', 'maison-plan', -0.77, -0.15, 1, "la saumure et le cidre, au bout du plan de travail près de la cuisinière"),
    ],
    'maison-cave': [
        ('bocaux', 'bocaux-de-confiture', 'cave-coffre', -0.2, 0, 0, "les confitures de l'ancien garde, au frais sur le coffre"),
        ('pots', 'pots-de-gres', 'cave-coffre', 0.22, 0.01, 1, "les pots de grès de la saumure, à côté"),
    ],
    'halte': [
        ('lampe', 'lampe-de-table', 'halte-bureau', 0.45, -0.18, 0, "la lampe du bureau de Firmin: il fait ses écritures avant le premier train"),
        ('registres', 'pile-de-livres', 'halte-bureau', 0.05, -0.2, 0, "les registres de la halte (billets, colis, retards)"),
        ('journal', 'journal', 'halte-bureau', -0.45, 0.15, 0, "le journal que le train du matin dépose, devant sa chaise"),
    ],
    'cafe': [
        ('pendule', 'pendule', 'cafe-comptoir', -0.2, 0.11, 0, "la pendule du zinc, cadran vers la salle: les clients y lisent l'heure du train"),
        ('boites', 'boites-a-provisions', 'cafe-plan', -0.07, -0.2, 0, "le café, le sucre et la chicorée, au milieu du plan de travail"),
        ('bocaux', 'bocaux-de-confiture', 'cafe-plan', -0.77, -0.1, 1, "les confitures du petit déjeuner, au bout du plan, près de la cuisinière"),
        ('bouquet-1', 'bouquet', 'cafe-table-1', 0, -0.22, 0, "un bouquet du pré, côté mur: on ne le renverse pas en s'asseyant"),
        ('pain', 'corbeille-de-pain', 'cafe-table-1', 0.35, 0.05, 0, "la corbeille de pain des casse-croûte"),
        ('journal', 'journal', 'cafe-table-2', -0.4, 0.1, 0, "le journal du café, qui passe de table en table"),
        ('bouquet-2', 'bouquet', 'cafe-table-2', 0.35, -0.2, 0, "le bouquet de la seconde table, contre le mur est"),
    ],
    'epicerie-rdc': [
        ('bocaux', 'bocaux-de-confiture', 'epicerie-comptoir', 0.3, 0.08, 0, "les confitures à vendre, devant la balance, côté client"),
        ('boites', 'boites-a-provisions', 'epicerie-comptoir', -0.45, 0.17, 0, "les boîtes de sucre et de café au détail, au bord du comptoir"),
        ('pain', 'corbeille-de-pain', 'epicerie-table', 0.2, 0, 0, "le pain du souper des pensionnaires"),
        ('lampe', 'lampe-a-petrole', 'epicerie-table', -0.4, -0.15, 0, "la lampe du souper, du côté de la cuisinière"),
    ],
    'epicerie-etage': [
        ('chevet-lampe', 'lampe-de-table', 'epicerie-etage-chevet', 0, 0, 0, "la lampe des pensionnaires, entre les deux lits"),
        ('odette-livres', 'pile-de-livres', 'epicerie-etage-odette-chevet', -0.13, 0, 0, "les cahiers de comptes d'Odette, qu'elle reprend au lit"),
        ('odette-lampe', 'lampe-a-petrole', 'epicerie-etage-odette-chevet', 0.17, 0, 0, "sa lampe de chevet"),
    ],
    'fournil': [
        ('pain', 'corbeille-de-pain', 'fournil-comptoir', 0.15, 0.08, 0, "la corbeille des pains du jour, devant les miches, côté client"),
        ('boites', 'boites-a-provisions', 'fournil-petrin', -0.07, -0.2, 0, "le sel, le sucre et le levain, au milieu du pétrin"),
    ],
    'mercerie': [
        ('boites-boutons', 'boites-a-provisions', 'mercerie-comptoir', 0.77, -0.1, 1, "les boîtes de boutons, au bout du comptoir"),
        ('bouquet', 'bouquet', 'mercerie-comptoir', 0, 0.1, 0, "le bouquet de Solange au milieu du comptoir: une loge d'actrice garde toujours des fleurs"),
        ('patrons', 'pile-de-livres', 'mercerie-comptoir', 0.35, 0.15, 0, "les catalogues de patrons, ouverts aux clientes"),
    ],
    'forge': [
        ('lampe', 'lampe-a-petrole', 'forge-coffre', 0.25, 0, 0, "la lampe de Mado sur le coffre: la forge est sombre hors du foyer"),
        ('clous', 'boites-a-provisions', 'forge-coffre', -0.15, 0, 0, "les boîtes de clous à ferrer"),
    ],
    'atelier-basile': [
        ('carnet', 'pile-de-livres', 'basile-etabli', -0.07, -0.2, 0, "le carnet de cotes de Basile, au milieu de l'établi"),
        ('lampe', 'lampe-a-petrole', 'basile-etabli', -0.77, -0.15, 0, "la lampe de l'établi, au bout, loin des copeaux du rabot"),
    ],
    'ecole': [
        ('registres', 'pile-de-livres', 'ecole-table-mairie', -0.4, 0, 0, "les registres de l'état civil, sur la table de la mairie"),
        ('lampe', 'lampe-de-table', 'ecole-table-mairie', 0.45, -0.15, 0, "la lampe du secrétaire de mairie: Armand écrit le soir"),
        ('journal', 'journal', 'ecole-table-mairie', 0.05, 0.15, 0, "le journal officiel, à afficher à la porte"),
        ('bouquet', 'bouquet', 'ecole-table-mairie', -0.05, -0.2, 0, "le bouquet que les enfants cueillent pour le maître"),
        ('cahiers', 'pile-de-livres', 'ecole-caisse', 0, 0, 0, "les cahiers ramassés, à corriger"),
    ],
    'ferme-logis': [
        ('lampe', 'lampe-a-petrole', 'logis-table', 0.4, -0.15, 0, "la lampe de la veillée, au bout de la table"),
        ('pain', 'corbeille-de-pain', 'logis-table', -0.15, 0.05, 0, "la miche de la ferme"),
        ('pots', 'pots-de-gres', 'logis-plan', -0.77, -0.1, 1, "les pots de grès du lard et du cidre, au bout du plan près de la cuisinière"),
    ],
    'marthe': [
        ('lampe', 'lampe-a-petrole', 'marthe-table', 0.5, -0.1, 0, "la lampe de Marthe, du côté du mur"),
        ('journal', 'journal', 'marthe-table', -0.4, 0.2, 0, "le journal, devant sa chaise: elle y vérifie l'heure des offices"),
        ('bouquet', 'bouquet', 'marthe-table', 0.05, -0.15, 0, "le bouquet qu'elle prend aux fleurs de l'autel quand elles fanent"),
        ('missel', 'pile-de-livres', 'marthe-chevet', 0, 0, 0, "son missel et l'almanach, au chevet"),
    ],
    'moulin': [
        ('lampe', 'lampe-a-petrole', 'moulin-sacs', -0.2, 0, 0, "la lampe de Berthe, sur le coffre aux sacs"),
        ('moutures', 'pile-de-livres', 'moulin-sacs', 0.2, 0, 0, "le livre des moutures: qui a apporté quoi, et combien"),
    ],
    'moulin-etage': [
        ('lampe', 'lampe-a-petrole', 'moulin-grain-1', 0, 0, 0, "la lampe du grenier, posée sur le coffre à grain"),
    ],
    'poste': [
        ('lampe', 'lampe-de-table', 'poste-coffre', 0.2, 0, 0, "la lampe de l'aiguilleur, sur le coffre"),
        ('registre', 'journal', 'poste-coffre', -0.2, 0, 0, "le registre des circulations, ouvert à la page du jour"),
    ],
}
# Objets de sol ajoutés pour tenir 12 petits objets par pièce de vie (même règles que la version 5).
HABITE_6 = {
    'epicerie-etage': [
        ('chevet', 'caisse', 1.5, 0.5, 0, "une caisse retournée sert de table de nuit entre les deux lits des pensionnaires"),
        ('odette-chevet', 'caisse', 1.5, 6.5, 0, "la table de nuit d'Odette, une caisse de l'épicerie, à la tête de son lit"),
    ],
    'mercerie': [
        ('seau', 'seau', 0.5, 4.5, 0, "l'eau tiède du shampoing, à côté du fauteuil de coiffure"),
    ],
    'forge': [
        ('fers-neufs', 'caisse', 4.5, 3.5, 0, "la caisse des fers neufs, sous le râtelier"),
        ('tonneau', 'tonneau', 4.5, 4.5, 0, "l'eau de pluie où l'on remplit le seau de trempe"),
        ('tabouret', 'tabouret-de-ferme', 1.5, 1.5, 0, "le tabouret où Mado s'assied pour ferrer, près du foyer"),
    ],
    'atelier-basile': [
        ('chevilles', 'caisse', 6.5, 0.5, 0, "la caisse des chevilles et des clous, au bout de l'établi"),
    ],
    'ecole': [
        ('caisse', 'caisse', 4.5, 1.5, 0, "la caisse des ardoises et des craies, au pied de l'armoire"),
        ('tabouret', 'tabouret-de-ferme', 2.5, 1.5, 0, "le tabouret du maître, à côté du tableau"),
    ],
    'marthe': [
        ('seau', 'seau', 4.5, 4.5, 0, "l'eau de la toilette, dans le coin le plus loin du lit"),
        ('tapis-de-sol', 'tapis-rond', 3, 3, 0, "le tapis tressé devant la porte"),
        ('chevet', 'caisse', 1.5, 0.5, 0, "une caisse en guise de table de chevet, à la tête du lit"),
    ],
    'moulin': [
        ('caisse', 'caisse', 5.5, 6.5, 0, "la caisse du son, à côté du coffre aux sacs"),
        ('tonneau', 'tonneau', 6.5, 4.5, 0, "le tonneau de farine blutée, prêt à livrer (le coffre aux sacs reste abordable par le nord)"),
    ],
    'moulin-etage': [
        ('caisse', 'caisse', 6.5, 2.5, 0, "une caisse de grain, à la suite des coffres"),
        ('tonneau', 'tonneau', 6.5, 3.5, 0, "le tonneau de son du grenier"),
    ],
}
for _it in INT:
    for _s, _t, _x, _y, _r, _pq in HABITE_6.get(_it['id'], ()):
        _it['meubles'].append(dict(id='%s-%s' % (_it['id'], _s), type=_t, modele=_MODELES[_t], x=_x, y=_y, rotation=_r, pourquoi=_pq))
    _par_id = {m['id']: m for m in _it['meubles']}
    for _s, _t, _p, _gx, _gz, _r, _pq in SUR.get(_it['id'], ()):
        _x, _y = _local(_par_id[_p], _gx, _gz)
        _it['meubles'].append(dict(id='%s-%s' % (_it['id'], _s), type=_t, modele=_MODELES[_t], x=_x, y=_y,
                                   rotation=(_par_id[_p]['rotation'] + _r) % 4, on=_p, pourquoi=_pq))

# 2. Décor du dehors sans récolte (fiches du 2026-11-11 sur des modèles déjà livrés: rocher, gros rocher, buisson,
#    herbes hautes, tonneau, caisse, banc de ferme, tas de bûches, puits, abreuvoir de pierre, baquet, clôture).
#    Les objets du plan qui attendaient ces types les reçoivent, recentrés sur leur case.
for _m in M_:
    if _m['id'] == 'tonneaux-ferme':
        _m.update(type='tonneau', x=196.5, y=154.5)
    elif _m['id'] == 'caisses-epicerie':
        _m.update(type='caisse', x=194.5, y=113.5)
    # Le tonneau de la terrasse du café (251,6; 106,6) reste sans type: posé, il barrerait la Grand-Route.
# Vues du dehors (captures `ensemble-*`, critère du directeur artistique: aucune zone vide de plus de 4 x 4 m à
# l'écran). Rien sur un chemin, une route, un seuil, un nœud ni contre un point; rien de récoltable.
DECOR_6 = [
    # ferme (220, 162): le potager de la ferme se clôt côté pré (les poules et les bêtes n'y entrent pas) et reste
    # ouvert sur le chemin des Champs, où l'on charge les cageots. Les pierres sorties du labour s'entassent au bord.
    *[('ferme', 'cloture-potager-n%d' % _i, 'cloture', _x, 152.5, 0, "la clôture du potager de la ferme, côté pré: les bêtes n'y entrent pas")
      for _i, _x in enumerate((211, 213, 215, 217, 219, 221), 1)],
    ('ferme', 'cloture-potager-e1', 'cloture', 222.5, 154, 1, "la clôture du potager, côté est"),
    ('ferme', 'cloture-potager-e2', 'cloture', 222.5, 156, 1, "la clôture du potager, côté est; le côté du chemin reste ouvert"),
    ('ferme', 'cloture-potager-o1', 'cloture', 209.5, 154, 1, "la clôture du potager, côté de la cour"),
    ('ferme', 'cloture-potager-o2', 'cloture', 209.5, 156, 1, "la clôture du potager, côté de la cour"),
    ('ferme', 'herbes-pre-1', 'herbes-hautes', 224.5, 149.5, 0, "l'herbe haute du pré, que la faux n'a pas encore prise"),
    ('ferme', 'buisson-pre-1', 'buisson', 229.5, 149.5, 0, "un buisson de la haie vive qui borde le pré au nord"),
    ('ferme', 'buisson-pre-2', 'buisson', 232.5, 150.5, 0, "la haie vive du pré"),
    ('ferme', 'epierrage-1', 'rocher', 224.5, 153.5, 0, "le tas d'épierrage: les pierres sorties du champ, au coin du potager"),
    ('ferme', 'epierrage-2', 'rocher-moussu', 225.5, 153.5, 0, "le tas d'épierrage, les plus vieilles pierres moussues"),
    ('ferme', 'epierrage-3', 'rocher', 224.5, 154.5, 0, "le tas d'épierrage"),
    ('ferme', 'herbes-pre-2', 'herbes-hautes', 230.5, 153.5, 0, "l'herbe haute du pré"),
    ('ferme', 'herbes-pre-3', 'herbes-hautes', 228.5, 151.5, 0, "l'herbe haute du pré"),
    ('ferme', 'bloc-pre', 'gros-rocher-moussu', 210, 167, 0, "le bloc que la charrue contourne depuis toujours, au coin du pré"),
    ('ferme', 'herbes-labour-1', 'herbes-hautes', 212.5, 167.5, 0, "l'herbe haute de la tournière, au bout des sillons"),
    ('ferme', 'herbes-labour-2', 'herbes-hautes', 211.5, 169.5, 0, "l'herbe haute de la tournière"),
    ('ferme', 'herbes-labour-3', 'herbes-hautes', 209.5, 171.5, 0, "l'herbe haute du pré"),
    ('ferme', 'herbes-labour-4', 'herbes-hautes', 211.5, 173.5, 0, "l'herbe haute du pré"),
    ('ferme', 'buisson-labour-1', 'buisson', 209.5, 163.5, 0, "un buisson au bord du chemin, à l'angle du pré"),
    ('ferme', 'buisson-labour-2', 'buisson', 213.5, 172.5, 0, "un buisson au bout du labour"),
    ('ferme', 'epierrage-4', 'rocher', 213.5, 166.5, 0, "les pierres jetées hors du labour, au bord du champ"),
    ('ferme', 'epierrage-5', 'rocher-moussu', 213.5, 167.5, 0, "les pierres jetées hors du labour"),
    # talus (196, 141.5): l'arrière du logis, la pente vers la rivière.
    ('talus', 'buisson-berge-1', 'buisson', 187.5, 140.5, 0, "un buisson de berge en haut du talus, les racines dans la pente"),
    ('talus', 'herbes-berge-1', 'herbes-hautes', 189.5, 140.5, 0, "l'herbe haute du haut de la berge, que personne ne fauche"),
    ('talus', 'herbes-berge-2', 'herbes-hautes', 196.5, 140.5, 0, "l'herbe haute du haut de la berge"),
    ('talus', 'herbes-berge-3', 'herbes-hautes', 200.5, 140.5, 0, "l'herbe haute du haut de la berge"),
    ('talus', 'herbes-berge-4', 'herbes-hautes', 203.5, 141.5, 0, "l'herbe haute du haut de la berge"),
    ('talus', 'bloc-talus', 'gros-rocher-moussu', 190, 144, 0, "un bloc moussu à mi-pente, tombé du talus il y a longtemps"),
    ('talus', 'rocher-talus', 'rocher', 193.5, 146.5, 0, "une pierre du talus"),
    ('talus', 'herbes-talus-1', 'herbes-hautes', 187.5, 146.5, 0, "l'herbe haute de la pente"),
    ('talus', 'herbes-talus-2', 'herbes-hautes', 191.5, 148.5, 0, "l'herbe haute de la pente"),
    ('talus', 'herbes-talus-3', 'herbes-hautes', 196.5, 147.5, 0, "l'herbe haute de la pente"),
    ('talus', 'buisson-talus', 'buisson', 199.5, 143.5, 0, "un buisson au coin du logis, côté rivière"),
    ('talus', 'buches-pignon', 'tas-de-buches', 199.5, 148.5, 0, "les bûches empilées contre le pignon ouest du logis"),
    ('talus', 'baquet-margot', 'baquet', 202, 143.5, 0, "le baquet de lessive de Margot, en haut de la berge: elle rince à la rivière"),
    # clôture (151, 101.5): le pré des cheminots le long de la voie.
    ('cloture', 'tonneau-cheminots', 'tonneau', 147.5, 102.5, 0, "le tonneau d'eau de pluie du jardin des cheminots"),
    ('cloture', 'herbes-voie-1', 'herbes-hautes', 149.5, 100.5, 0, "l'herbe haute au pied de la clôture de la voie, où la faux ne passe pas"),
    ('cloture', 'herbes-voie-2', 'herbes-hautes', 154.5, 100.5, 0, "l'herbe haute au pied de la clôture"),
    ('cloture', 'herbes-voie-3', 'herbes-hautes', 155.5, 101.5, 0, "l'herbe haute au pied de la clôture"),
    ('cloture', 'buisson-cheminots', 'buisson', 159.5, 101.5, 0, "un buisson qui ferme le pré à l'est"),
    ('cloture', 'rocher-cheminots', 'rocher', 153.5, 103.5, 0, "une borne de pierre oubliée par la Compagnie"),
    ('cloture', 'caisse-cheminots', 'caisse', 150.5, 103.5, 0, "une caisse de la Compagnie qui sert de table au jardin"),
    ('cloture', 'herbes-cheminots-1', 'herbes-hautes', 151.5, 104.5, 0, "l'herbe haute du pré des cheminots"),
    ('cloture', 'herbes-cheminots-2', 'herbes-hautes', 157.5, 104.5, 0, "l'herbe haute du pré des cheminots"),
    ('cloture', 'herbes-cheminots-3', 'herbes-hautes', 143.5, 103.5, 0, "l'herbe haute au bord du jardin"),
    # berge (195.5, 127.2): la grève et le bout de la tonnelle.
    ('berge', 'herbes-greve-1', 'herbes-hautes', 194.5, 129.5, 0, "une touffe de joncs au bord de l'eau"),
    ('berge', 'herbes-greve-2', 'herbes-hautes', 198.5, 129.5, 0, "une touffe de joncs au bord de l'eau"),
    ('berge', 'buisson-tonnelle', 'buisson', 199.5, 123.5, 0, "un sureau au coin de la tonnelle, côté rivière"),
    # orée (104, 90): le sous-bois au nord de la voie passe à la forêt par des buissons et des pierres moussues; la
    # friche du garage, à l'ouest, garde ses herbes et ses ronciers bas.
    ('oree', 'buisson-oree-1', 'buisson', 101.5, 87.5, 0, "un buisson de l'orée: la forêt gagne sur le sous-bois"),
    ('oree', 'buisson-oree-2', 'buisson', 104.5, 86.5, 0, "un buisson de l'orée"),
    ('oree', 'buisson-oree-3', 'buisson', 108.5, 87.5, 0, "un buisson de l'orée"),
    ('oree', 'buisson-oree-4', 'buisson', 112.5, 86.5, 0, "un buisson de l'orée"),
    ('oree', 'herbes-oree-1', 'herbes-hautes', 102.5, 84.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-2', 'herbes-hautes', 106.5, 83.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-3', 'herbes-hautes', 110.5, 84.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-4', 'herbes-hautes', 114.5, 83.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-5', 'herbes-hautes', 103.5, 80.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-6', 'herbes-hautes', 108.5, 80.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'herbes-oree-7', 'herbes-hautes', 112.5, 80.5, 0, "l'herbe haute du sous-bois"),
    ('oree', 'bloc-oree', 'gros-rocher-moussu', 106, 86, 0, "un bloc moussu au pied de la forêt"),
    ('oree', 'rocher-oree-1', 'rocher-moussu', 110.5, 82.5, 0, "une pierre moussue du sous-bois"),
    ('oree', 'rocher-oree-2', 'rocher-moussu', 101.5, 81.5, 0, "une pierre moussue du sous-bois"),
    ('oree', 'buches-oree', 'tas-de-buches', 114.5, 87.5, 0, "les bûches d'une ancienne coupe, laissées à sécher au bord du bois"),
    ('oree', 'herbes-friche-1', 'herbes-hautes', 94.5, 85.5, 0, "l'herbe haute de la friche du garage"),
    ('oree', 'herbes-friche-2', 'herbes-hautes', 97.5, 87.5, 0, "l'herbe haute de la friche du garage"),
    ('oree', 'herbes-friche-3', 'herbes-hautes', 95.5, 90.5, 0, "l'herbe haute de la friche du garage"),
    ('oree', 'herbes-friche-4', 'herbes-hautes', 98.5, 92.5, 0, "l'herbe haute de la friche du garage"),
    ('oree', 'buisson-friche-1', 'buisson', 93.5, 88.5, 0, "un buisson de la friche"),
    ('oree', 'buisson-friche-2', 'buisson', 96.5, 84.5, 0, "un buisson de la friche"),
    ('oree', 'rocher-friche', 'rocher', 98.5, 89.5, 0, "un rocher laissé là quand on a tracé la voie, dans la friche"),
]
for _v, _i, _t, _x, _y, _r, _pq in DECOR_6:
    mob(_i, _t, _MODELES[_t], _x, _y, _r, _pq, acte=1 if _v in ('berge', 'rue-du-bourg', 'cloture') else 2 if _v == 'oree' else 3)
    M_[-1]['vue'] = _v


# ================================================================ version 7: le décor des fêtes et des veillées (2026-11-11)
# Chaque objet porte `when` (conditions du jeu, `src/simulation/lieux/presents.ts`): il n'existe que pendant sa fête.
# `event_is` en `begun` tient du début de la fête jusqu'à l'aube suivante: le décor paraît quand la fête commence et
# disparaît quand le bourg range. `fete` (nom court) sert aux contrôles et au tableau de plan.md. Règles tenues par
# controler_plan.py (`controler_fetes`): rien sur la voie ni sur les deux rangées du bord du quai (le train du samedi
# y ouvre ses portes); rien sur un point, un nœud, une porte et les deux cases devant elle; un objet solide jamais
# sur une route, une rue, un chemin ou un sentier (seules les lisses barrent la route, c'est leur rôle: on les
# contourne par l'accotement), et à 1 m au moins de chaque poste d'habitant de sa fête; tout poste de la fête reste
# atteignable depuis le quai, son décor posé.
def _quand(*evs, depuis=None, jusqu_a=None, plus=()):
    c = [dict(type='event_is', events=list(evs), when='begun')]
    if depuis is not None:
        c.append(dict(type='time_is', **{'from': depuis, 'to': jusqu_a}))
    return c + list(plus)


BARR, LUM, SOUPE, HIVER = 'fete-des-barrieres-fleuries', 'nuit-des-lumignons', 'concours-de-la-soupe', 'veillee-du-premier-train'
VEILLEES = ['veillee-du-quai-printemps', 'veillee-du-quai-ete', 'veillee-du-quai-automne', 'veillee-du-quai-hiver', 'premiere-veillee-du-quai']
# Manifeste des décors livrés: qui porte une lumière (`light`), pour le tableau de plan.md.
_MAN = json.load(open(os.path.join(_DOSSIER_MEUBLES, '..', '..', '..', 'assets', 'commun', 'decors', 'decors.json'), encoding='utf-8'))['models']
NUIT = 1230  # 20 h 30: la nuit tombe, chacun pose son lumignon (écriture des fêtes, section 3)
AUBE = 360   # borne de fin de plage: `begun` s'éteint de toute façon à l'aube


def fete(i, typ, x, y, rot, quand, nom, pourquoi):
    mob(i, typ, _MODELES[typ], x, y, rot, pourquoi)
    M_[-1].update(when=quand, fete=nom)


# 1. Fête des barrières fleuries (printemps, passage à niveau). Les lisses fleuries sont baissées par la scène
#    d'ouverture (`les-lisses-en-fleurs`, fait `aubrune.barrieres.lisses` = `baissees`) et relevées par la clôture
#    (`levees`): entre les deux, elles barrent la route du Gué (« la route du Gué est fermée, pour la plus belle
#    raison de l'année »), une au nord et une au sud de la voie, bras est-ouest en travers de la route de 5 m. On passe
#    à pied par l'accotement (une case d'herbe de chaque côté). Relevées, elles ne se dessinent pas: aucun jour ordinaire
#    ne montre de lisse (le modèle levé n'existe pas), la fête ne fait pas exception.
_LISSES = _quand(BARR, plus=[dict(type='remembered', key='aubrune.barrieres.lisses', equals='baissees')])
fete('fete-lisse-nord', 'lisse-fleurie', 182.5, 95.5, 0, _LISSES, 'barrières',
     "la lisse nord baissée en travers de la route, sur la rangée d'herbe au nord de la voie, jamais sur la voie")
fete('fete-lisse-sud', 'lisse-fleurie', 182.5, 99.5, 0, _LISSES, 'barrières',
     "la lisse sud baissée en travers de la route, juste au sud de la voie: Jeanne, Léon et Solange se tiennent à son pied (pn-s, 2 m au sud)")
fete('fete-barrieres-banderole', 'banderole', 182.5, 104.5, 0, _quand(BARR), 'barrières',
     "au-dessus de la route du Gué, entre le carrefour et la lisse sud, face au sud: on la lit en venant du bourg; non solide, elle ne barre rien")
fete('fete-barrieres-tonneau', 'tonneau-en-perce', 177.5, 104.5, 0, _quand(BARR), 'barrières',
     "le tonneau du café mis en perce par Colette, sur l'herbe au coin du passage à niveau: à 5 m du carrefour où elle se tient (gr0), hors de la route")

# 2. Nuit des lumignons (été). Le jour (10 h à 20 h 30), les vingt et un lumignons coulés refroidissent sur le
#    parvis, en rangs au pied de la façade, à l'est du portail (Marthe y coule la cire, poste marthe-parvis). La nuit
#    (20 h 30 à l'aube), chacun a posé le sien là où il compte (écriture des fêtes, section 3), à un ou deux mètres de
#    son poste de nuit: une lumière par âme, du parvis à tout le bourg. Le lumignon n'est pas solide.
_LUM_JOUR = _quand(LUM, depuis=600, jusqu_a=NUIT)
_LUM_NUIT = _quand(LUM, depuis=NUIT, jusqu_a=AUBE)
_PARVIS = [(x, 79.5) for x in range(261, 268)] + [(x, 80.5) for x in range(261, 268)] + [(x, 84.5) for x in range(262, 269)]
for _k, (_x, _y) in enumerate(_PARVIS, 1):
    fete('fete-lumignon-parvis-%02d' % _k, 'lumignon', _x + 0.5, _y, 0, _LUM_JOUR, 'lumignons (jour)',
         "un lumignon coulé qui refroidit sur le parvis, en rang au pied de la façade, à 2 m au moins du portail")
_LUMIGNONS = [
    # qui, x, y, où et pour qui (écriture des fêtes, section 3)
    ('firmin', 184.5, 99.5, "à la barrière, coin est de la route au bord de la voie, à côté de son poste (pour son oncle)"),
    ('jeanne', 180.5, 99.5, "à côté, coin ouest de la route au bord de la voie, en face de Firmin (pour le train de 5 h 12)"),
    ('odette', 195.5, 118.5, "sous la tonnelle, au coin de la pension, près de la table du souper"),
    ('basile', 177.5, 91.5, "au pied de l'établi, sous l'auvent de l'atelier"),
    ('achille', 230.5, 106.5, "sous la fenêtre du fournil, à l'ouest de la porte"),
    ('solange', 234.5, 110.5, "devant la mercerie, à côté du seuil (hors des deux cases devant la porte)"),
    ('mado', 262.5, 102.5, "au pied de l'enclume, côté nord: le lumignon ne se pose pas sur l'enclume, il se pose contre"),
    ('barnabe', 264.5, 106.5, "devant la forge, à l'ouest de la porte, côté rue de l'Église"),
    ('ambroise', 204.5, 103.5, "sur le quai, côté bourg, sous la pendule de la halte (pour la minute)"),
    ('honorine-1', 283.5, 106.5, "sur son seuil, à gauche de la porte (pour sa marraine)"),
    ('honorine-2', 286.5, 106.5, "sur son seuil, à droite de la porte (« pour le plaisir »)"),
    ('marthe', 251.5, 79.5, "au pied du clocher, à l'ouest du portail"),
    ('lucie', 249.5, 110.5, "au pied de la boîte aux lettres du bourg, à sa grille"),
    ('colette', 252.5, 106.5, "sur la terrasse du café, entre la porte et le coin de la vitrine"),
    ('armand', 220.5, 117.5, "contre le lavoir, à côté de son ouverture"),
    ('paulin', 181.5, 129.5, "au gué, sur la route qui descend à l'eau"),
    ('margot', 180.5, 129.5, "au gué, à côté de celui de Paulin"),
    ('leon', 185.5, 127.5, "en haut de la grève, au bord du chemin de la berge"),
    ('berthe', 202.5, 129.5, "au bout du ponton (le sien part sur l'eau: la lumière qui dérive n'existe pas encore)"),
    ('martial', 282.5, 74.5, "au cimetière, au bord de l'allée, entre les tombes: un seul, pour tous"),
]
for _q, _x, _y, _pq in _LUMIGNONS:
    fete('fete-lumignon-' + _q, 'lumignon', _x, _y, 0, _LUM_NUIT, 'lumignons (nuit)', _pq)
# Rosalie repart à 22 h: son lumignon ne brûle que jusque-là, sur le quai, au pied de son poste (la locomotive est à
# l'arrêt devant, et rien ne se pose sur les deux rangées du bord).
fete('fete-lumignon-rosalie', 'lumignon', 212.5, 101.5, 0, _quand(LUM, depuis=NUIT, jusqu_a=1320), 'lumignons (nuit)',
     "sur le quai, au bout est, face à la locomotive à l'arrêt, jusqu'au départ de 22 h")

# 3. Concours de la soupe (automne, place). Deux marmites sur leur feu, de part et d'autre de la rue du Bourg, au nord
#    de la place (rangées 112 et 113): à l'ouest la soupe des mères, côté épicerie où se tiennent Odette et Colette
#    (pl-o); à l'est la panade du moulin, à l'est de la pompe, que l'on atteint toujours par l'ouest et le sud. Le
#    banquet au sud-est de la place, à côté du banc d'Honorine qui préside (sa place et le devant du banc restent
#    libres). L'ardoise du palmarès au coin nord-est, face au sud: on la lit depuis le carrefour (pl).
fete('fete-soupe-marmite-meres', 'grande-marmite', 199, 113, 0, _quand(SOUPE), 'soupe',
     "la soupe des mères (Odette et Colette), côté épicerie, à 2 m de la rue: on y goûte depuis la place")
fete('fete-soupe-marmite-moulin', 'grande-marmite', 210, 113, 0, _quand(SOUPE), 'soupe',
     "la panade du moulin (Berthe), en face, à l'est de la pompe: la pompe s'atteint toujours par l'ouest et le sud")
fete('fete-soupe-table', 'table-de-banquet', 211.5, 120.5, 0, _quand(SOUPE), 'soupe',
     "la grande table du concours, au sud-est de la place, à côté du banc où Honorine préside")
fete('fete-soupe-banc-nord', 'banc-de-table', 211, 119.5, 0, _quand(SOUPE), 'soupe',
     "le banc nord de la grande table, face à elle; le devant du banc d'Honorine reste libre")
fete('fete-soupe-banc-sud', 'banc-de-table', 211, 121.5, 2, _quand(SOUPE), 'soupe',
     "le banc sud de la grande table, face à elle")
fete('fete-soupe-ardoise', 'ardoise-a-craie', 206.5, 111.5, 0, _quand(SOUPE), 'soupe',
     "l'ardoise du palmarès, au coin nord-est de la place, face au sud: on la lit depuis le carrefour")

# 4. Veillée du premier train (hiver, quai) et veillées du quai. Le quai fait 5 m de profondeur, et le train du samedi
#    reste à quai jusqu'à 22 h: les deux rangées du bord restent libres (3 m avec la troisième), la rue qui longe le
#    quai au sud aussi; le brasero et la table vont sur la dernière rangée du quai, le reste sur l'herbe au sud de la
#    rue ou hors du quai. Une file de trois guirlandes court sur la bande d'herbe au sud du quai (poteau de
#    chaque guirlande à l'ouest, poteau de bout à l'est), du banc ouest au passage vers la Grand-Route: commune aux
#    veillées, à la veillée d'hiver et à la fête des barrières (le quai-o y accueille Ambroise, Martial et Rosalie).
_GUIRL = _quand(*([BARR, HIVER] + VEILLEES))
for _k, _x in enumerate((191.5, 195.5, 199.5), 1):
    fete('fete-quai-guirlande-%d' % _k, 'guirlande-de-lampions', _x, 104.5, 0, _GUIRL, 'quai',
         "guirlande de lampions sur l'herbe au sud du quai, entre le quai et la Grand-Route: elle éclaire le quai sans rien poser dessus")
fete('fete-quai-poteau', 'poteau-de-guirlande', 201.5, 104.5, 0, _GUIRL, 'quai',
     "le poteau du bout de la file, à l'ouest du passage vers la Grand-Route, qu'il laisse libre")
_VEIL = _quand(*([HIVER] + VEILLEES))
fete('fete-quai-brasero', 'brasero', 211.5, 102.5, 0, _VEIL, 'quai',
     "le brasero de Mado au bout est du quai, sur la troisième rangée (hors du bord), à côté de la lanterne: Mado, Barnabé, Basile et Berthe se tiennent autour (quai-e, à 1,5 m); la rue qui longe le quai au sud reste libre")
fete('fete-quai-banc-1', 'banc-de-ferme', 212, 104.5, 2, _VEIL, 'quai',
     "un banc sur l'herbe au sud de la rue du quai, face au brasero et à la voie")
fete('fete-quai-banc-2', 'banc-de-ferme', 209, 104.5, 2, _VEIL, 'quai',
     "un second banc à côté, face au quai: les vieux s'assoient, les autres restent debout autour du feu")
# Veillée du premier train seulement: la table de la tourte, la banderole, le tonneau et l'estrade.
fete('fete-hiver-table', 'table-de-banquet', 195.5, 102.5, 0, _quand(HIVER), 'hiver',
     "la table de la tourte sur la dernière rangée du quai, entre les deux bancs, son long côté vers la voie (« côté voie, c'est la place du voyageur »): on passe au nord (3 m) et par la rue du quai au sud")
fete('fete-hiver-banderole', 'banderole', 204, 104.5, 0, _quand(HIVER), 'hiver',
     "au-dessus du passage qui monte de la Grand-Route au quai, face au sud: on la lit en arrivant")
fete('fete-hiver-tonneau', 'tonneau-en-perce', 186.5, 104.5, 0, _quand(HIVER), 'hiver',
     "le tonneau en perce sur l'herbe au pied du bout ouest du quai, près de Jeanne, Solange, Lucie et Armand (quai-o)")
fete('fete-hiver-estrade', 'estrade-de-fanfare', 175.5, 102, 1, _quand(HIVER), 'hiver',
     "l'estrade sur l'herbe à l'ouest de la route du Gué, face à l'est (vers le quai): le quai, 5 m de profondeur et le train à quai, n'a pas la place de 4 x 3 m; à 1 m du bord de la voie")


# ================================================================ version 8: coquillages et rivière (cahier 4.7, 2026-11-11)
# Trouvailles de berge: une ressource par sorte de rive (`donnees/commun/ressources/<id>.json`), un meuble du même
# identifiant qui la porte, un point par case au bord de l'eau, jamais sur un chemin ni un seuil. Le meuble porte le nom
# de sa ressource: une ligne de plus ici suffit pour un point de plus. Contrôle: `controler_trouvailles.py`.
# Pas de coquillage de mer: Aubrune est dans les terres (mulettes, escargots d'eau, galets, bois, faïence, plumes).
TROUVAILLES = [
    # acte 1, la grève du gué: graviers au pied de la berge, à l'ouest des pierres plates (rangée 129, cailloux)
    ('berge-coquilles-gue-1', 'coquilles-de-greve', 187.5, 129.5, 1,
     "grève du gué: le courant ralentit avant le gué et dépose les coquilles vides des mulettes sur le gravier"),
    ('berge-coquilles-gue-2', 'coquilles-de-greve', 190.5, 129.5, 1,
     "grève du gué, côté aval: second dépôt de coquilles, entre deux pierres plates"),
    ('berge-galets-gue', 'galets-veines', 192.5, 129.5, 1,
     "bout aval de la grève: les galets veinés de quartz roulés depuis la Côte s'y arrêtent, avec les pierres plates"),
    ('berge-laisse-joncs', 'laisse-de-crue', 197.5, 129.5, 1,
     "au pied des joncs, à côté du bois flotté qui sèche: les joncs retiennent ce que la rivière charrie"),
    # acte 1, le lavoir et sa rigole: ce qu'on casse en lavant file avec l'eau claire
    ('berge-tessons-lavoir', 'tessons-du-lavoir', 225.5, 119.5, 1,
     "au pied du lavoir, côté bassin, sur la rive ouest de la rigole: les assiettes rincées au bassin y laissent leurs éclats"),
    ('berge-tessons-rigole', 'tessons-du-lavoir', 226.5, 128.5, 1,
     "à la bouche de la rigole, où elle rend à l'Aubrune ce qu'on a lavé: les tessons roulés s'arrêtent dans l'angle, sous le saule"),
    # acte 1, la rive aval: les saules têtards où le héron guette au lever du jour
    ('berge-plumes-aval', 'plumes-de-heron', 264.5, 130.5, 1,
     "sous le saule têtard de l'aval, au sud-est du tronc (vu de la caméra): le héron y pêche à l'aube et y laisse ses plumes"),
    ('berge-laisse-aval', 'laisse-de-crue', 272.5, 130.5, 1,
     "là où la rive s'avance dans le courant: la crue y dépose son bois avant le coude"),
    # acte 2, l'Île: la grève de la vanne et l'anse du bief
    ('berge-coquilles-ile', 'coquilles-de-greve', 37.5, 146.5, 2,
     "grève de l'Île, au pied de la vanne: l'eau qui tombe du déversoir y roule les coquilles"),
    ('berge-galets-ile', 'galets-veines', 46.5, 146.5, 2,
     "bout est de la grève de l'Île, après les pierres plates: les galets du déversoir"),
    ('berge-mulettes-anse-1', 'mulettes-du-bief', 48.5, 141.5, 2,
     "l'anse du bief, côté Île: l'eau se calme en sortant de la vanne, les mulettes vivent dans le sable clair (la perle est là)"),
    ('berge-mulettes-anse-2', 'mulettes-du-bief', 52.5, 141.5, 2,
     "l'anse du bief, plus à l'est: le second lit de mulettes, au bord du sentier de l'Île sans le toucher"),
    ('berge-plumes-anse', 'plumes-de-heron', 56.5, 141.5, 2,
     "le bout de l'anse, où l'eau est la plus basse: le héron y pêche à l'aube, le martin-pêcheur file au ras de l'eau"),
    ('berge-laisse-ile', 'laisse-de-crue', 70.5, 145.5, 2,
     "rive sud de l'Île, face à la rivière: la pointe que la crue recouvre et où elle laisse son bois"),
    # acte 3, l'étang de la Côte: la vase du bord, côté digue (eau dormante: escargots d'eau)
    ('berge-limnees-etang-o', 'limnees-de-l-etang', 230.5, 46.5, 3,
     "bord de vase de l'étang, à l'ouest de la bonde: les escargots d'eau des roseaux y laissent leurs coquilles"),
    ('berge-limnees-etang-e', 'limnees-de-l-etang', 242.5, 46.5, 3,
     "bord de vase de l'étang, à l'est, au pied du sentier de la digue"),
    ('berge-plumes-etang', 'plumes-de-heron', 234.5, 47.5, 3,
     "la vase à l'est de la bonde, eau basse: le héron de l'étang y guette à l'aube"),
    # acte 3, les girolles: sous-bois humide au carrefour du haut (c6), de part et d'autre du chemin, jamais dessus
    ('cote-girolles-1', 'girolles', 180.5, 26.5, 3,
     "sous-bois humide à l'est du chemin forestier, au carrefour du haut: les girolles de l'été et de l'automne, le matin"),
    ('cote-girolles-2', 'girolles', 174.5, 29.5, 3,
     "sous-bois de l'autre côté du chemin, en contrebas: second rond de girolles"),
]
# Modèle de repli de chaque meuble (manifeste des décors) en attendant les siens: liste pour l'artiste dans plan.md.
_REPLI = {'coquilles-de-greve': 'stone-b', 'mulettes-du-bief': 'stone-b', 'galets-veines': 'stone-c',
          'laisse-de-crue': 'dead-branches-b', 'tessons-du-lavoir': 'stone-b', 'plumes-de-heron': 'wild-herbs',
          'limnees-de-l-etang': 'stone-b', 'girolles': 'wild-herbs'}
for _i, _t, _x, _y, _a, _pq in TROUVAILLES:
    mob(_i, _t, _REPLI[_t], _x, _y, 0, _pq, acte=_a)
for _r in RESSOURCES:
    if _r['id'] in ('coquillages-greve', 'coquillages-ile'):
        _r.update(heures='toutes', pourquoi=_r['pourquoi'] + "; coquilles, galets et bois flotté (version 8): plus après la pluie")
    elif _r['id'] == 'champignons':
        _r.update(saisons=['été', 'automne'], pourquoi="girolles du sous-bois humide, le matin (plus quand il pleut), posées en version 8")


# ================================================================ calculs
def dist(a, b):
    return math.hypot(N[a]['x'] - N[b]['x'], N[a]['y'] - N[b]['y'])


def graphe(acte=3, sans=()):
    g = {k: [] for k in N}
    for ar in A:
        v = ar['verrou']
        if v and (VERROUS[v]['acte'] > acte or v in sans):
            continue
        d = dist(ar['a'], ar['b'])
        g[ar['a']].append((ar['b'], d)); g[ar['b']].append((ar['a'], d))
    return g


def dijkstra(g, sources):
    d = {s: 0.0 for s in sources}; prev = {}
    tas = [(0.0, s) for s in sources]
    while tas:
        du, u = heapq.heappop(tas)
        if du > d.get(u, 1e18):
            continue
        for v, w in g[u]:
            if du + w < d.get(v, 1e18):
                d[v] = du + w; prev[v] = u; heapq.heappush(tas, (du + w, v))
    return d, prev


def chemin(g, a, b):
    d, prev = dijkstra(g, [a])
    if b not in d:
        return None, None
    c = [b]
    while c[-1] != a:
        c.append(prev[c[-1]])
    return d[b], c[::-1]


def parcours(g, etapes):
    total, noeuds = 0.0, [etapes[0]]
    for a, b in zip(etapes, etapes[1:]):
        d, c = chemin(g, a, b)
        total += d; noeuds += c[1:]
    return total, noeuds


def aire(poly):
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]))) / 2


def dans(poly, x, y):
    r = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            r = not r
    return r


def temps(m, v):
    s = round(m / v)
    return '%d s' % s if s < 60 else '%d min %02d' % (s // 60, s % 60)


def calculer():
    g = graphe(3)
    for q in QUETES:
        ids = [k for k, _ in q['etapes']]
        q['aller_m'], q['aller_noeuds'] = parcours(g, ids)
        q['aller_m'] = round(q['aller_m'], 1)
        if q['retour']:
            sans = ()
            m, c = parcours(g, [k for k, _ in q['retour']])
            q['retour_m'], q['retour_noeuds'] = round(m, 1), c
        else:
            q['retour_m'], q['retour_noeuds'] = 0.0, []
    dist_t = []
    noms = dict(POINTS_CLES)
    for a, k in PAIRES:
        d, _ = chemin(g, a, k)
        dist_t.append(dict(de=a, a=k, de_nom=noms[a], a_nom=noms[k], m=round(d)))
    # densité: distance de réseau au point d'intérêt le plus proche, échantillonnée tous les 5 m
    src = sorted({q['noeud'] for q in P} | {bb['noeud'] for bb in B})
    dp, _ = dijkstra(g, src)
    pire, somme, nb, ou = 0.0, 0.0, 0, None
    for ar in A:
        ln = dist(ar['a'], ar['b']); t = 0.0
        while t <= ln:
            v = min(dp[ar['a']] + t, dp[ar['b']] + ln - t)
            somme += v; nb += 1
            if v > pire:
                pire, ou = v, (ar['a'], ar['b'])
            t += 5.0
    longueur = sum(dist(ar['a'], ar['b']) for ar in A)
    dens = dict(pire_m=round(pire, 1), pire_arete=list(ou), moyenne_m=round(somme / nb, 1), longueur_reseau_m=round(longueur),
                points=len(P) + len(B), metres_par_point=round(longueur / (len(P) + len(B)), 1))
    return dist_t, dens


def voisin_de(zk, x, y):
    if not (0 <= x <= L and 0 <= y <= H):
        return 'bord'
    for k, z in ZONES.items():
        if k != zk and dans(z['poly'], x, y):
            return k
    return 'hors'


def bordures():
    """Découpe le contour de chaque zone par voisin et lui donne son habillage (règle, puis exceptions)."""
    out = {}
    for zk, z in ZONES.items():
        poly = z['poly']
        morceaux = []
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            ln = math.hypot(x2 - x1, y2 - y1)
            if ln < 1e-9:
                continue
            nb = max(1, int(math.ceil(ln / 4.0)))
            nx, ny = (y2 - y1) / ln, -(x2 - x1) / ln
            debut = len(morceaux)  # on ne fusionne qu'à l'intérieur d'un même côté du polygone
            for i in range(nb):
                a = (x1 + (x2 - x1) * i / nb, y1 + (y2 - y1) * i / nb)
                b_ = (x1 + (x2 - x1) * (i + 1) / nb, y1 + (y2 - y1) * (i + 1) / nb)
                mx, my = (a[0] + b_[0]) / 2, (a[1] + b_[1]) / 2
                # le côté extérieur est celui qui n'est pas dans la zone
                sgn = -1 if dans(poly, mx + nx * 1.2, my + ny * 1.2) else 1
                v = voisin_de(zk, mx + sgn * nx * 1.5, my + sgn * ny * 1.5)
                if v != 'bord' and v != 'hors' and v == zk:
                    v = 'hors'
                hab = REGLE_BORDURE.get((zk, v), 'haie')
                if zk == 'V' and v == 'hors' and mx < 98:
                    hab = 'haie'
                if zk == 'B' and v == 'hors' and 268 < mx < 292 and my < 82:
                    hab = 'muret'
                if len(morceaux) > debut and morceaux[-1]['voisin'] == v and morceaux[-1]['habillage'] == hab and morceaux[-1]['a'] == [round(a[0], 2), round(a[1], 2)]:
                    morceaux[-1]['a'] = [round(b_[0], 2), round(b_[1], 2)]
                else:
                    morceaux.append(dict(de=[round(a[0], 2), round(a[1], 2)], a=[round(b_[0], 2), round(b_[1], 2)], voisin=v, habillage=hab))
        out[zk] = morceaux
    return out


def ecrire_json(dist_t, dens):
    plan = dict(
        format='plan-de-lieu', version=1, revision=3, statut="version 3, plan validé par le client le 2026-11-10, raccordé à l'histoire écrite (actes 1 à 3)",
        id='aubrune', nom='Aubrune', echelle='1 unité = 1 m; x vers l’est, y vers le sud',
        taille=dict(largeur=L, hauteur=H), vitesses=dict(marche=MARCHE, course=COURSE, draisine=DRAISINE),
        ancien_repere=dict(note="coeur du bourg: ancien (x, y) de halte.json = nouveau (x - 164, y - 84), à 1 ou 2 m près (version 2: tout ce qui est à l'est de x 44,5 a glissé de 64 m)", dx=164, dy=84),
        allongement_ouest=dict(metres=ALLONGE, coupe_x=COUPE, raison="décision du client: le sentier de l'acte 2 (la voie jusqu'au poste) prend la longueur de celui de l'acte 3"),
        zones={k: dict(z, surface_m2=round(aire(z['poly']))) for k, z in ZONES.items()},
        eaux=EAUX, plans_eau=PLANS_EAU, rails=RAILS, noeuds=N, aretes=A, verrous=VERROUS, ouvrages=OUVRAGES, batiments=B,
        reperes=REPERES, points_interet=P, parcelles=PARCELLES, quetes=QUETES,
        points_cles=[dict(noeud=k, nom=v) for k, v in POINTS_CLES], distances=dist_t, densite=dens,
        habillages={k: POURQUOI_HABILLAGE[k] for k in HABILLAGES}, bordures=bordures(),
        sols=dict(par_zone=SOL_ZONE, par_chemin=SOL_CHEMIN, par_parcelle=SOL_PARCELLE, rects=SOLS_SUPPL),
        mobilier=M_, vegetation=VEGETATION, arbres=ARBRES_SINGULIERS, ressources=RESSOURCES, type_ressource=TYPE_RESSOURCE,
        points_nommes=POINTS_NOMMES, interieurs=INT,
        ordre_histoire=ORDRE_HISTOIRE, antichambres=ANTICHAMBRES, peche_lieu=PECHE_LIEU,
        manques=[dict(besoin=a, type_a_creer=b, en_attendant=c) for a, b, c in MANQUES])
    lignes = ['{']
    cles = list(plan)
    for i, k in enumerate(cles):
        v = plan[k]
        fin = ',' if i < len(cles) - 1 else ''
        if isinstance(v, list) and v and isinstance(v[0], dict):
            lignes.append(' %s: [' % json.dumps(k))
            lignes += ['  ' + json.dumps(x, ensure_ascii=False) + (',' if j < len(v) - 1 else '') for j, x in enumerate(v)]
            lignes.append(' ]' + fin)
        elif isinstance(v, dict) and k in ('noeuds', 'zones', 'verrous', 'bordures', 'sols', 'antichambres'):
            lignes.append(' %s: {' % json.dumps(k))
            ks = list(v)
            lignes += ['  %s: %s%s' % (json.dumps(x), json.dumps(v[x], ensure_ascii=False), ',' if j < len(ks) - 1 else '') for j, x in enumerate(ks)]
            lignes.append(' }' + fin)
        else:
            lignes.append(' %s: %s%s' % (json.dumps(k), json.dumps(v, ensure_ascii=False), fin))
    lignes.append('}')
    with open(os.path.join(ICI, 'plan.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(lignes) + '\n')


# ================================================================ tableaux injectés dans plan.md
def tableaux(dist_t, dens):
    t = {}
    z = ['| Zone | Ouverte à | Surface | Bâtiments | Points d’intérêt |', '|---|---|---|---|---|']
    for k, zz in ZONES.items():
        nb = sum(1 for bb in B if N[bb['noeud']]['zone'] == k); np_ = sum(1 for q in P if N[q['noeud']]['zone'] == k)
        z.append('| %s | acte %d | %d m² | %d | %d |' % (zz['nom'], zz['acte'], round(aire(zz['poly'])), nb, np_))
    z.append('| **Total jouable** | | **%d m²** sur %d m² de carte (%d x %d m) | %d | %d |' % (
        sum(round(aire(zz['poly'])) for zz in ZONES.values()), L * H, L, H, len(B), len(P)))
    t['zones'] = z
    d = ['| De | À | Distance | Marche (%s m/s) | Course (%s m/s) |' % (vit(MARCHE), vit(COURSE)), '|---|---|---|---|---|']
    for r in dist_t:
        d.append('| %s | %s | %d m | %s | %s |' % (r['de_nom'], r['a_nom'], r['m'], temps(r['m'], MARCHE), temps(r['m'], COURSE)))
    t['distances'] = d
    q = ['| Sentier | Forme | Aller | Retour | Total à la marche | Total à la course |', '|---|---|---|---|---|---|']
    for qq in QUETES:
        tot = qq['aller_m'] + qq['retour_m']
        q.append('| %s | %s | %d m | %s | %s | %s |' % (qq['titre'], qq['forme'], round(qq['aller_m']),
                 ('%d m' % round(qq['retour_m'])) if qq['retour_m'] else 'sur place', temps(tot, MARCHE), temps(tot, COURSE)))
    t['quetes'] = q
    t['densite'] = ['- Réseau de chemins: %d m; %d points d’intérêt et bâtiments, soit un tous les %s m de chemin en moyenne.' % (
        dens['longueur_reseau_m'], dens['points'], str(dens['metres_par_point']).replace('.', ',')),
        '- Distance moyenne, depuis un point quelconque du réseau, au point d’intérêt le plus proche: %s m (%s à la marche).' % (
            str(dens['moyenne_m']).replace('.', ','), temps(dens['moyenne_m'], MARCHE)),
        '- Pire cas: %s m (%s à la marche, %s à la course), sur le tronçon %s.' % (
            str(dens['pire_m']).replace('.', ','), temps(dens['pire_m'], MARCHE), temps(dens['pire_m'], COURSE), ' - '.join(dens['pire_arete']))]
    v = ['| Verrou | Où | Obstacle | Ce qui le lève |', '|---|---|---|---|']
    for k, vv in VERROUS.items():
        v.append('| %s (acte %d%s) | x %s, y %s | %s | %s |' % (k, vv['acte'], ', raccourci' if vv.get('sens') else '', vv['x'], vv['y'], vv['obstacle'], vv['leve']))
    t['verrous'] = v
    bt = ['| Bâtiment | Emprise | Qui | Porte | Pourquoi là, pourquoi dans ce sens |', '|---|---|---|---|---|']
    for bb in B:
        x, y, l, h = bb['rect']
        cote = '(pas de porte: plateforme)'
        if bb['porte']:
            px, py = bb['porte']
            cote = 'ouest' if px == x else 'est' if px == x + l else 'nord' if py == y else 'sud'
        bt.append('| %s | %g x %g m | %s | %s | %s |' % (bb['nom'], l, h, bb['qui'], cote, bb['raison']))
    t['batiments'] = bt
    t['verrous_v2'] = ['| Verrou | Objet posé | Modèle | Phrase « pas encore » |', '|---|---|---|---|'] + [
        '| %s | %s | `%s` | %s |' % (k, v['objet'], v['modele'], v['pas_encore']) for k, v in VERROUS.items()]
    gb = ['| Bâtiment | Gabarit de base | Largeur x profondeur | Étages | Toit | Porte (façade, position) | Couleurs ou note |', '|---|---|---|---|---|---|---|']
    for bb in B:
        g = bb['gabarit']
        pt = ', '.join('%s %.2f' % (q['facade'], q['position']) for q in g.get('portes', [])) or '(aucune)'
        gb.append('| %s | `%s` | %g x %g m | %s | %s | %s | %s |' % (bb['nom'], g['base'], g['largeur'], g['profondeur'], g.get('etages', '(modèle)'),
                  g.get('toit', '(modèle)'), pt, ', '.join('%s %s' % kv for kv in g.get('couleurs', {}).items()) or g.get('note', '')))
    t['gabarits'] = gb
    t['mobilier'] = ['| Objet | Type du jeu | Modèle | Où (x, y) | Face au | Pourquoi |', '|---|---|---|---|---|---|'] + [
        '| %s | %s | `%s` | %g, %g | %s | %s |' % (m['id'], m['type'] or '(à créer)', m['modele'], m['x'], m['y'], 'sud est nord ouest'.split()[m['rotation']], m['pourquoi'])
        for m in M_ if not m.get('when')]

    def _cond(m):
        out = []
        for c in m['when']:
            if c['type'] == 'time_is':
                out.append('de %d h %02d à %d h %02d' % (c['from'] // 60, c['from'] % 60, c['to'] // 60, c['to'] % 60))
            elif c['type'] == 'remembered':
                out.append('`%s` = `%s`' % (c['key'], c['equals']))
        return ', '.join(out) or 'toute la fête'
    _lum = lambda m: 'oui' if (_MAN.get(m['modele']) or {}).get('light') else ''
    t['fetes'] = ['| Objet | Type du jeu | Fête | Où (x, y) | Face au | En plus de la fête | Lampe | Pourquoi |', '|---|---|---|---|---|---|---|---|'] + [
        '| %s | %s | %s | %g, %g | %s | %s | %s | %s |' % (m['id'], m['type'], m['fete'], m['x'], m['y'], 'sud est nord ouest'.split()[m['rotation']],
                                                       _cond(m), _lum(m), m['pourquoi']) for m in M_ if m.get('when')]
    t['vegetation'] = ['| Zone | Arbres pour 100 m² | Essences | Sous-étage | Recul des chemins | Pourquoi |', '|---|---|---|---|---|---|'] + [
        '| %s | %s | %s | %s | %s m | %s |' % (ZONES[v['zone']]['nom'], str(v['densite']).replace('.', ','), ', '.join(v['essences']), ', '.join(v['sous_etage']),
                                            str(v['recul_chemins']).replace('.', ','), v['pourquoi']) for v in VEGETATION]
    t['ressources'] = ['| Ressource | Nature | Où | Acte | Heures | Saisons | Pourquoi |', '|---|---|---|---|---|---|---|'] + [
        '| %s | %s | %s | %d | %s | %s | %s |' % (r['id'], r['nature'], ('x %g, y %g' % (r['x'], r['y'])) if 'x' in r else 'rectangle %s' % r['rect'], r['acte'],
                                               r.get('heures', 'toutes'), ', '.join(r.get('saisons', [])) or 'toutes', r['pourquoi']) for r in RESSOURCES]
    it = []
    for i in INT:
        it.append('**%s** (`interieurs/%s.json`, %d x %d m, %d m², niveau %d): %s.' % (i['nom'], i['id'], i['largeur'], i['hauteur'], i['surface_m2'], i['niveau'], i['note']))
        grille = [['.'] * i['largeur'] for _ in range(i['hauteur'])]
        for c in i['cloisons']:
            for yy in range(c[1], c[1] + c[3]):
                for xx in range(c[0], c[0] + c[2]):
                    grille[yy][xx] = '#'
        # Toute l'emprise du meuble, telle que le jeu la bloque (centre, taille du type, rotation).
        # Un objet posé sur un meuble (`on`) ne prend pas de case: il est listé avec son porteur.
        for m in i['meubles']:
            if m.get('on') is not None:
                continue
            for xx, yy in emprise(m):
                if 0 <= yy < i['hauteur'] and 0 <= xx < i['largeur']:
                    grille[yy][xx] = (m['type'] or m['modele'])[0].upper()
        for q in i['points']:
            grille[int(q['y'])][int(q['x'])] = '*'
        if i['porte']:
            grille[int(i['porte'][1])][int(i['porte'][0])] = 'P'
        for e in i['escaliers']:
            grille[int(e['y'])][int(e['x'])] = 'E'
        it += ['', '```text'] + [' '.join(r) for r in grille] + ['```', '',
               'Pièces: ' + '; '.join('%s (%d x %d)' % (n, r[2], r[3]) for n, r in i['pieces']) + '. Meubles: ' +
               (', '.join('%s (%s%s)' % (m['id'], m['type'] or m['modele'] + ', à créer', ', sur ' + m['on'] if m.get('on') else '')
                          for m in i['meubles']) or 'aucun') + '. Points: ' +
               (', '.join('%s (%s%s)' % (q['id'], q['role'], ', ' + q['qui'] if q['qui'] else '') for q in i['points']) or 'aucun') + '.', '']
    t['interieurs'] = it
    t['ordre_histoire'] = ['| Acte | Étape (fiche) | Verrous levés | Zone ouverte | Ce qui s’ouvre sur la carte |', '|---|---|---|---|---|'] + [
        '| %d | `%s` | %s | %s | %s |' % (o['acte'], o['etape'], ', '.join(o['verrous']), ', '.join(ZONES[z]['nom'] for z in o['zones']) or '(aucune: dans une zone déjà ouverte)', o['effet'])
        for o in ORDRE_HISTOIRE] + [''] + ['Antichambre: %s, nœuds %s: %s.' % (ZONES[k]['nom'], ', '.join('`%s`' % n_ for n_ in v['noeuds']), v['raison']) for k, v in ANTICHAMBRES.items()]
    nouveaux = [m for m in M_ if m['id'].startswith(('caillou-', 'ronces-tranchee', 'poulailler-', 'wagon-'))]
    t['objets_histoire'] = ['| Objet | Type du jeu | Où (x, y) | Pourquoi là |', '|---|---|---|---|'] + [
        '| %s | %s | %g, %g | %s |' % (m['id'], m['type'] or '(à créer: `%s`)' % m['modele'], m['x'], m['y'], m['pourquoi']) for m in nouveaux] + [
        '| %s | %s | %g, %g | %s |' % (a['id'], a['type'], a['x'], a['y'], a['pourquoi']) for a in ARBRES_SINGULIERS if a['id'].startswith(('chene-lisiere-3', 'chene-lisiere-4', 'chene-coupe'))] + [
        '| maison-rechaud | rechaud | cuisine de la maison (6,5; 6,5) | le réchaud de l’œuf au plat, contre le mur sud, façade vers la pièce |',
        '| legumes-ferme | (point) | 216, 155,5 | le potager de la ferme, à l’est de la cour |']
    t['manques'] = ['| Besoin de l’histoire | Ce qui manque dans `donnees/commun/` (ou ailleurs) | En attendant |', '|---|---|---|'] + [
        '| %s | %s | %s |' % m for m in MANQUES]
    t['points_nommes'] = ['| Point | Rôle | Qui | Pourquoi |', '|---|---|---|---|'] + [
        '| %s | %s | %s | %s |' % (q['id'], q['role'], q['qui'] or 'tous', q['pourquoi']) for q in POINTS_NOMMES]
    chemin_md = os.path.join(ICI, 'plan.md')
    if os.path.exists(chemin_md):
        txt = open(chemin_md, encoding='utf-8').read()
        for k, lignes in t.items():
            deb, fin = '<!-- genere:%s:debut -->' % k, '<!-- genere:%s:fin -->' % k
            if deb in txt and fin in txt:
                i, j = txt.index(deb) + len(deb), txt.index(fin)
                txt = txt[:i] + '\n' + '\n'.join(lignes) + '\n' + txt[j:]
        with open(chemin_md, 'w', encoding='utf-8', newline='\n') as f:
            f.write(txt)


# ================================================================ dessin
STYLE_A = {'route': ('#B9A27A', 4.0, None), 'rue': ('#C9B79A', 3.0, None), 'chemin': ('#CFB489', 2.2, None),
           'sentier': ('#B08A56', 1.1, '2.2 1.6'), 'voie': ('#7A5F47', 0.9, '0.8 1.4'), 'interieur': ('#5B5470', 1.2, '1.2 1.2')}
COUL_P = {'histoire': '#9B4C3B', 'service': '#3F6F8F', 'commerce': '#3F6F8F', 'activite': '#C2812B', 'collecte': '#5E8A3A', 'repos': '#7A6FA0'}
NOM_P = {'histoire': 'histoire', 'service': 'service, commerce', 'activite': 'activité', 'collecte': 'cueillette, fouilles, insectes', 'repos': 'banc, point de vue'}


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def texte(x, y, s, t=3.0, anc='middle', coul='#2E2A26', gras=False, halo=True, ital=False):
    a = 'font-family="DejaVu Sans" font-size="%g" text-anchor="%s"%s%s' % (t, anc, ' font-weight="bold"' if gras else '', ' font-style="italic"' if ital else '')
    o = ''
    if halo:
        o += '<text x="%g" y="%g" %s fill="none" stroke="#FFFDF5" stroke-width="%g" stroke-linejoin="round" opacity="0.9">%s</text>' % (x, y, a, t * 0.28, esc(s))
    return o + '<text x="%g" y="%g" %s fill="%s">%s</text>' % (x, y, a, coul, esc(s))


def pts(l):
    return ' '.join('%g,%g' % (x, y) for x, y in l)


def fond(detail, attenue=False, numeros=None, noms_bat=True, noms_poi=False, zones_teinte=True, rnd_seed=7, sans_poi=False):
    """Rend la liste des éléments SVG du plan, en mètres. detail: facteur de taille des textes (1 = plan d'ensemble)."""
    s = []
    k = detail
    s.append('<rect x="0" y="0" width="%d" height="%d" fill="#B7CC8E"/>' % (L, H))
    s.append('<rect x="0" y="0" width="%d" height="%d" fill="#A7B38F"/>' % (L, H))
    if zones_teinte:
        for z in ZONES.values():
            s.append('<polygon points="%s" fill="%s" opacity="0.55"/>' % (pts(z['poly']), z['couleur']))
    # bois de la Côte: arbres semés hors des chemins
    rnd = random.Random(rnd_seed)
    segs = [((N[a['a']]['x'], N[a['a']]['y']), (N[a['b']]['x'], N[a['b']]['y'])) for a in A]
    arbres = []
    for _ in range(2600):
        x, y = rnd.uniform(0, L), rnd.uniform(0, 96)
        if not (dans(ZONES['C']['poly'], x, y) or dans(ZONES['T']['poly'], x, y)) or y > 93:
            continue
        if dans(ZONES['T']['poly'], x, y) and (y > 60 or x > 352):
            continue
        if min(dseg((x, y), a, b_) for a, b_ in segs) < 4.5:
            continue
        if math.hypot((x - 172) / 12, (y - 40) / 10) < 1 or math.hypot(x - 122, y - 50) < 9 or math.hypot(x - 205, y - 26) < 12 or math.hypot(x - 282, y - 29) < 6:
            continue
        if any(bb['rect'][0] - 3 < x < bb['rect'][0] + bb['rect'][2] + 3 and bb['rect'][1] - 3 < y < bb['rect'][1] + bb['rect'][3] + 3 for bb in B):
            continue
        if any(math.hypot(x - ax, y - ay) < 3.2 for ax, ay in arbres[-400:]):
            continue
        arbres.append((x, y))
    for x, y in arbres:
        s.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="#6E9A5B" opacity="0.8"/>' % (x, y, rnd.uniform(1.6, 2.4)))
    for pc in PARCELLES:
        x, y, l, h = pc['rect']
        s.append('<rect x="%g" y="%g" width="%g" height="%g" fill="%s" stroke="#8C7B5A" stroke-width="0.25" stroke-dasharray="1 0.8" opacity="0.9"/>' % (x, y, l, h, pc['couleur']))
    # lisières habillées (version 2)
    styl = {'haie': ('#4F7244', '0.9 0.7'), 'talus': ('#8C6A45', None), 'cloture': ('#5A4632', '0.4 0.6'), 'bois': ('#3F6453', None), 'muret': ('#9A8F80', None)}
    for zk, ms in BORD.items():
        for m in ms:
            if m['habillage'] in styl:
                c_, da = styl[m['habillage']]
                s.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g"%s opacity="0.85"/>' % (
                    m['de'][0], m['de'][1], m['a'][0], m['a'][1], c_, 0.9, ' stroke-dasharray="%s"' % da if da else ''))
    # eau
    for w in EAUX:
        s.append('<polyline points="%s" fill="none" stroke="#7090A5" stroke-width="%g" stroke-linecap="round" stroke-linejoin="round"/>' % (pts(w['pts']), w['largeur']))
    for w in PLANS_EAU:
        s.append('<ellipse cx="%g" cy="%g" rx="%g" ry="%g" fill="#7090A5"/>' % (w['cx'], w['cy'], w['rx'], w['ry']))
    s.append('<line x1="17.5" y1="149" x2="21" y2="158" stroke="#EDE6D6" stroke-width="1.2"/>')  # déversoir
    # chemins
    for passe in (0, 1):
        for a in A:
            coul, larg, tirets = STYLE_A[a['classe']]
            p1, p2 = N[a['a']], N[a['b']]
            if passe == 0 and not tirets:
                s.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#8C7B5A" stroke-width="%g" stroke-linecap="round"/>' % (p1['x'], p1['y'], p2['x'], p2['y'], larg + 0.6))
            if passe == 1:
                s.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g" stroke-linecap="round"%s/>' % (
                    p1['x'], p1['y'], p2['x'], p2['y'], coul, larg, ' stroke-dasharray="%s"' % tirets if tirets else ''))
    # rails
    for r in RAILS:
        op = ' opacity="0.45"' if r.get('tunnel') else ''
        s.append('<polyline points="%s" fill="none" stroke="#8E8576" stroke-width="3" stroke-linejoin="round"%s/>' % (pts(r['pts']), op))
        s.append('<polyline points="%s" fill="none" stroke="#3D3833" stroke-width="1.5" stroke-dasharray="0.35 0.9" stroke-linejoin="round"%s/>' % (pts(r['pts']), op))
    # la colline au-dessus du tunnel
    s.append('<path d="M355,57 Q362,45 369,57" fill="none" stroke="#3D3833" stroke-width="1.2"/>')
    # ouvrages
    for o in OUVRAGES:
        if o['nature'] in ('pont', 'passerelle', 'planches', 'gué', 'ponton', 'digue'):
            s.append('<circle cx="%g" cy="%g" r="%g" fill="none" stroke="#5A4632" stroke-width="0.5"/>' % (o['x'], o['y'], 2.2))
        elif o['nature'] == 'passage à niveau':
            s.append('<path d="M%g,%g l3,3 M%g,%g l-3,3" stroke="#9B4C3B" stroke-width="0.7"/>' % (o['x'] - 1.5, o['y'] - 1.5, o['x'] + 1.5, o['y'] - 1.5))
    # bâtiments
    for i, bb in enumerate(B):
        x, y, l, h = bb['rect']
        quai = bb['porte'] is None
        s.append('<rect x="%g" y="%g" width="%g" height="%g" fill="%s" stroke="#5A4632" stroke-width="0.45"/>' % (x, y, l, h, '#D5CCBC' if quai else '#B86B4F' if bb['acte'] < 4 else '#A9A39A'))
        if bb['porte']:
            px, py = bb['porte']; nn = N[bb['noeud']]
            s.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="#CFB489" stroke-width="1.0" stroke-dasharray="0.8 0.6"/>' % (px, py, nn['x'], nn['y']))
            s.append('<circle cx="%g" cy="%g" r="1.0" fill="#FFF3C4" stroke="#2E2A26" stroke-width="0.35"/>' % (px, py))
    # verrous
    s += etiquettes_verrous(k)
    # points d'intérêt
    for q in ([] if sans_poi else P):
        s.append('<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#FFFDF5" stroke-width="0.35"/>' % (q['x'], q['y'], 1.15 * max(k, 0.7), COUL_P[q['type']]))
    # repères
    for r in REPERES:
        s.append(etoile(r['x'], r['y'], 3.0 * max(k, 0.75)))
    if attenue:
        s.append('<rect x="0" y="0" width="%d" height="%d" fill="#FFFDF5" opacity="0.45"/>' % (L, H))
    return s


def etiquettes_verrous(k):
    """Étiquettes des verrous; jamais plus petites qu'à 0,6 de l'échelle du plan d'ensemble (zone 5: k = 0,26)."""
    s = []
    kv = max(k, 0.6)
    for kk, v in VERROUS.items():
        c = '#3F6F8F' if v.get('sens') else '#B3261E'
        lv = max(5.2, 1.55 * len(kk) + 1.4)
        s.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" stroke="#FFFDF5" stroke-width="%g"/>' % (
            v['x'] - lv / 2 * kv, v['y'] - 1.7 * kv, lv * kv, 3.4 * kv, 0.8 * kv, c, 0.4 * kv))
        s.append(texte(v['x'], v['y'] + 0.85 * kv, kk, 2.3 * kv, coul='#FFFFFF', gras=True, halo=False))
    return s


def etoile(x, y, r):
    p_ = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r if i % 2 == 0 else r * 0.45
        p_.append((x + rr * math.cos(a), y + rr * math.sin(a)))
    return '<polygon points="%s" fill="#F2C230" stroke="#5A4632" stroke-width="0.4"/>' % pts(p_)


def dseg(p, a, b_):
    (px, py), (ax, ay), (bx, by) = p, a, b_
    dx, dy = bx - ax, by - ay
    t = 0 if dx == dy == 0 else max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def nord_echelle(x, y, k):
    s = ['<g transform="translate(%g,%g) scale(%g)">' % (x, y, k)]
    s.append('<rect x="-3" y="-13" width="62" height="19" fill="#FFFDF5" opacity="0.92" stroke="#5A4632" stroke-width="0.3"/>')
    s.append('<path d="M2,2 L2,-9 M2,-10.5 L0.2,-6.5 L3.8,-6.5 Z" stroke="#2E2A26" stroke-width="0.6" fill="#2E2A26"/>')
    s.append(texte(2, 5, 'N', 2.8, halo=False, gras=True))
    s.append('<rect x="8" y="-2" width="25" height="1.6" fill="#2E2A26"/><rect x="33" y="-2" width="25" height="1.6" fill="#FFFDF5" stroke="#2E2A26" stroke-width="0.3"/>')
    s.append(texte(8, -4, '0', 2.6, halo=False)); s.append(texte(33, -4, '25 m', 2.6, halo=False)); s.append(texte(56, -4, '50 m', 2.6, halo=False))
    s.append(texte(33, 4, '1 case = 1 m; course %s m/s: 50 m = %d s' % (vit(COURSE), round(50 / COURSE)), 2.2, halo=False))
    s.append('</g>')
    return s


def page(nom, vue, largeur_px, elements, panneau=None, titre=None):
    x0, y0, w, h = vue
    ech = largeur_px / w
    pan = 480 if panneau else 0
    haut = h * ech + (34 if titre else 0)
    if panneau:
        haut = max(haut, 34 + 30 + 14.5 * len(panneau) + 8 * sum(1 for p_ in panneau if p_[0] == 't'))
    o = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (largeur_px + pan, haut, largeur_px + pan, haut),
         '<rect width="100%" height="100%" fill="#FFFDF5"/>']
    dy = 34 if titre else 0
    if titre:
        o.append('<text x="12" y="23" font-family="DejaVu Sans" font-size="17" font-weight="bold" fill="#2E2A26">%s</text>' % esc(titre))
        m = 50 if ech < 9 else 20
        bx = largeur_px + pan - 20 - m * ech
        o.append('<rect x="%g" y="20" width="%g" height="5" fill="#2E2A26"/><rect x="%g" y="20" width="%g" height="5" fill="#FFFDF5" stroke="#2E2A26" stroke-width="1"/>' % (bx, m * ech / 2, bx + m * ech / 2, m * ech / 2))
        lib = 'échelle: %d m (%d s de marche, %d s de course)' % (m, round(m / MARCHE), round(m / COURSE))
        o.append('<text x="%g" y="15" font-family="DejaVu Sans" font-size="11" fill="#2E2A26" text-anchor="end">%s</text>' % (largeur_px + pan - 12, lib))
        # La flèche du nord se tient à gauche de l'échelle et de son texte, jamais dessous.
        nx = min(bx, largeur_px + pan - 12 - 6.4 * len(lib)) - 30
        o.append('<path d="M%g,30 L%g,8 M%g,4 L%g,13 L%g,13 Z" stroke="#2E2A26" stroke-width="2" fill="#2E2A26"/><text x="%g" y="24" font-family="DejaVu Sans" font-size="12" font-weight="bold" fill="#2E2A26">N</text>' % (nx, nx, nx, nx - 5, nx + 5, nx + 8))
    o.append('<svg x="0" y="%d" width="%d" height="%g" viewBox="%g %g %g %g">' % (dy, largeur_px, h * ech, x0, y0, w, h))
    o += elements
    o.append('<rect x="%g" y="%g" width="%g" height="%g" fill="none" stroke="#2E2A26" stroke-width="%g"/>' % (x0, y0, w, h, 1.5 / ech))
    o.append('</svg>')
    if panneau:
        yy = dy + 16
        for kind, txt_, coul in panneau:
            xx = largeur_px + 12
            if kind == 't':
                yy += 6
                o.append('<text x="%d" y="%d" font-family="DejaVu Sans" font-size="13" font-weight="bold" fill="#2E2A26">%s</text>' % (xx, yy, esc(txt_)))
                yy += 17
                continue
            if kind == 'pastille':
                o.append('<circle cx="%d" cy="%d" r="5" fill="%s" stroke="#5A4632" stroke-width="0.6"/>' % (xx + 8, yy - 4, coul))
            elif kind == 'carre':
                o.append('<rect x="%d" y="%d" width="16" height="11" fill="%s" stroke="#5A4632" stroke-width="0.6"/>' % (xx, yy - 10, coul))
            elif kind == 'trait':
                c, lw, dash = coul
                o.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="%g"%s/>' % (xx, yy - 4, xx + 18, yy - 4, c, lw, ' stroke-dasharray="%s"' % dash if dash else ''))
            elif kind == 'etoile':
                o.append(etoile(xx + 8, yy - 4, 7))
            elif kind == 'pnum':
                o.append('<circle cx="%d" cy="%d" r="7.5" fill="%s"/>' % (xx + 8, yy - 4, coul[1]))
                o.append('<text x="%d" y="%d" font-family="DejaVu Sans" font-size="9" font-weight="bold" fill="#FFFFFF" text-anchor="middle">%s</text>' % (xx + 8, yy - 0.8, coul[0]))
            elif kind == 'num':
                o.append('<text x="%d" y="%d" font-family="DejaVu Sans" font-size="10.5" font-weight="bold" fill="#2E2A26" text-anchor="end">%s</text>' % (xx + 16, yy, coul))
            txt_ = txt_ if len(txt_) <= 74 else txt_[:72].rstrip() + '...'
            o.append('<text x="%d" y="%d" font-family="DejaVu Sans" font-size="10.5" fill="#2E2A26">%s</text>' % (xx + 24, yy, esc(txt_)))
            yy += 14.5
    o.append('</svg>')
    svg = os.path.join(ICI, nom + '.svg')
    with open(svg, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(o) + '\n')
    png = os.path.join(ICI, nom + '.png')
    subprocess.run(['rsvg-convert', svg, '-o', png], check=True)
    subprocess.run(['convert', png, '-strip', '-colors', '256', 'PNG8:' + png], check=True)


def legende_base():
    lg = [('t', 'Légende', None)]
    lg += [('trait', 'route (4 m)', ('#B9A27A', 5, None)), ('trait', 'rue, quai, place (3 m)', ('#C9B79A', 4, None)), ('trait', 'chemin de terre (2 m)', ('#CFB489', 3, None)),
           ('trait', 'sentier (1 m)', ('#B08A56', 2, '4 3')), ('trait', 'marche sur la voie', ('#7A5F47', 2, '2 3')), ('trait', 'tunnel, escalier (couvert)', ('#5B5470', 2, '3 3')),
           ('trait', 'voie ferrée', ('#3D3833', 3, '1 2')), ('carre', 'eau (toujours reliée à sa source)', '#7090A5'),
           ('carre', 'bâtiment habité; point clair: la porte', '#B86B4F'), ('carre', 'bâtiment en réserve (après la fin)', '#A9A39A'),
           ('etoile', 'repère visible de loin', None), ('carre', 'verrou d’histoire (zone fermée)', '#B3261E'), ('carre', 'raccourci qui se débloque', '#3F6F8F'),
           ('trait', 'lisière: haie, talus, clôture, bois', ('#4F7244', 3, '4 3')), ('carre', 'hors jeu (décor)', '#A7B38F')]
    for kk in ('histoire', 'service', 'activite', 'collecte', 'repos'):
        lg.append(('pastille', NOM_P[kk], COUL_P[kk]))
    return lg


LABELS_ZONES = {'B': ('LE BOURG', 286, 118), 'R': ('LA RIVIÈRE ET LE BIEF', 260, 135.3), 'V': ('LA VOIE ET LE POSTE', 70, 86), 'C': ('LA CÔTE', 130, 10),
                'M': ('LE MOULIN', 128, 105.6), 'F': ('LA FERME', 254, 198), 'T': ('LE TUNNEL', 334, 10)}


def dessiner(dist_t):
    # ---- plan d'ensemble: bâtiments numérotés, légende à droite
    el = fond(1.0)
    for i, bb in enumerate(B):
        x, y, l, h = bb['rect']
        el.append(texte(x + l / 2, y + h / 2 + 1.1, str(i + 1), 3.0, coul='#FFFFFF' if bb['porte'] else '#2E2A26', gras=True, halo=False))
    for kz, z in ZONES.items():
        court, x, y = LABELS_ZONES[kz]
        el.append(texte(x, y, court + ' (acte %d)' % z['acte'], 3.4, gras=True, coul='#3A342C'))
    for r, (dx, dy, anc) in zip(REPERES, [(-4, 2.5, 'end'), (-4, -1.5, 'end'), (-4, -1.5, 'end'), (-4, 4.5, 'end'), (4, -2, 'start'), (-5, 1, 'end'), (-4, 4, 'end'), (5, 1, 'start')]):
        el.append(texte(r['x'] + dx, r['y'] + dy, r['nom'].replace(' de la halte', ''), 2.8, anc=anc, ital=True))
    for nom_, x, y in (("l'Aubrune", 280, 157.5), ("l'Aubrune", 12, 158), ('le bief', 46, 135), ("l'étang", 172, 41), ('le ru', 168.5, 72), ("l'île du Bief", 58, 143),
                       ('Grand-Route', 240, 106.3), ('chemin de la Berge', 222, 127), ('chemin forestier', 82, 55), ('sentier des Crêtes', 252, 46), ('la tranchée', 66, 92.2),
                       ('la ligne morte', 272, 98), ('vieille route', 127, 176), ('prés lointains (décor)', 292, 124), ('prés lointains (décor)', 30, 184), ('bois (décor)', 30, 40), ('le pré du poste (décor)', 40, 118), ('chemin des Champs', 182, 156.5), ('vers Hautefonte', 14, 103), ('vers Combe-Veilleuse', 300, 5), ("l'éperon (rocher)", 268, 59.5)):
        el.append(texte(sx(x) if x not in (14, 12) else x, y, nom_, 2.5, ital=True, coul='#4A4034'))
    lg = legende_base() + [('t', 'Bâtiments (porte du côté du chemin)', None)]
    for i, bb in enumerate(B):
        lg.append(('num', bb['nom'], str(i + 1)))
    page('plan-ensemble', (0, 0, L, H), 1500, el, lg, "Aubrune, version 3: plan d'ensemble, 384 x 208 m (1 case = 1 m), nord en haut")

    # ---- plans de zone
    vues = {'B': ('zone-1-bourg', (144, 60, 178, 80), 'Zone 1: le bourg et le passage à niveau (acte 1)'),
            'R': ('zone-2-riviere-bief', (0, 100, 194, 64), 'Zone 2: la rivière et le bief, côté amont (acte 2); l’aval longe le bourg (zone 1)'),
            'V': ('zone-3-voie-poste', (0, 80, 190, 64), "Zone 3: la voie jusqu'au poste d'aiguillage (acte 2), tranchée de 64 m de plus"),
            'C': ('zone-4-cote', (96, 0, 270, 100), 'Zone 4: la Côte (acte 3)'),
            'M': ('zone-5-moulin', (100, 96, 64, 44), 'Zone 5: le moulin (acte 3)'),
            'F': ('zone-6-ferme', (126, 122, 212, 84), 'Zone 6: la ferme (acte 3)'),
            'T': ('zone-7-tunnel', (270, 0, 114, 112), 'Zone 7: le tunnel (acte 3)')}
    for kz, (nom, vue, titre) in vues.items():
        k = vue[2] / 250.0
        el = fond(k, numeros=False, sans_poi=True)
        vus = []

        def pose(x, y, s_, t, **kw):
            # évite les chevauchements: essaie au-dessus, au-dessous, à droite, à gauche, de plus en plus loin
            w = len(s_) * t * 0.56
            libre = lambda x1, yy: all(x1 + w < a or x1 > b_ or yy + 0.3 * t < c or yy - t > d for a, b_, c, d in vus)
            essais = [(0, 0)] + [(dx * j, dy * j) for j in (1, 2, 3, 4) for dx, dy in ((0, -1.1 * t), (0, 1.1 * t), (0.5 * w + t, 0), (-0.5 * w - t, 0))]
            x0, y0 = x, y
            for dx, dy in essais:
                x, y = x0 + dx, y0 + dy
                x1 = x - w / 2
                if libre(x1, y):
                    break
            else:
                x, y = x0, y0
                x1 = x - w / 2
            vus.append((x1, x1 + w, y - t, y + 0.3 * t))
            el.append(texte(x, y, s_, t, **dict(kw, anc='middle')))

        dedans = lambda x, y: vue[0] + 1 < x < vue[0] + vue[2] - 1 and vue[1] + 1 < y < vue[1] + vue[3] - 1
        kk_ = max(k, 0.42)
        lg = [('t', 'Bâtiments (numéros du plan d’ensemble)', None)]
        for i, bb in enumerate(B):
            x, y, l, h = bb['rect']
            if dedans(x + l / 2, y + h / 2):
                el.append(texte(x + l / 2, y + h / 2 + 1.0 * kk_, str(i + 1), 2.9 * kk_, coul='#FFFFFF' if bb['porte'] else '#2E2A26', gras=True, halo=False))
                vus.append((x, x + l, y, y + h))
                lg.append(('num', bb['nom'] + ' (' + bb['qui'].split(',')[0].split(' (')[0] + ')', str(i + 1)))
        lg.append(('t', 'Points d’intérêt', None))
        centres = [(bb['rect'][0] + bb['rect'][2] / 2, bb['rect'][1] + bb['rect'][3] / 2) for bb in B]
        for j, q in enumerate(P):
            if dedans(q['x'], q['y']):
                qx, qy = q['x'], q['y']
                while any(math.hypot(qx - cx_, qy - cy_) < 4.4 * kk_ for cx_, cy_ in centres):
                    qx += 1.2 * kk_
                q = dict(q, x=qx, y=qy)
                el.append('<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#FFFDF5" stroke-width="%g"/>' % (q['x'], q['y'], 1.9 * kk_, COUL_P[q['type']], 0.3 * kk_))
                el.append(texte(q['x'], q['y'] + 0.75 * kk_, str(j + 1), 2.1 * kk_, coul='#FFFFFF', gras=True, halo=False))
                vus.append((q['x'] - 2 * kk_, q['x'] + 2 * kk_, q['y'] - 2 * kk_, q['y'] + 2 * kk_))
                lg.append(('pnum', q['nom'] + ('' if q['acte'] == 1 else ' (acte %d)' % q['acte']), (str(j + 1), COUL_P[q['type']])))
        kv = max(k, 0.6)
        for kk, v in VERROUS.items():
            lv = max(5.2, 1.55 * len(kk) + 1.4) / 2
            vus.append((v['x'] - lv * kv, v['x'] + lv * kv, v['y'] - 1.7 * kv, v['y'] + 1.7 * kv))
        for r in REPERES:
            rr = 3.0 * max(k, 0.75)
            vus.append((r['x'] - rr, r['x'] + rr, r['y'] - rr, r['y'] + rr))
        for r in REPERES:
            if dedans(r['x'], r['y']):
                pose(r['x'], r['y'] - 4 * kk_, r['nom'], 2.6 * kk_, ital=True, gras=True)
        for o in OUVRAGES:
            if dedans(o['x'], o['y']):
                pose(o['x'], o['y'] + 4.6 * kk_, o['id'].replace('_', ' ').replace('pn ', 'PN ').replace('trav service', 'traversée'), 2.0 * kk_, ital=True, coul='#5A4632')
        lg.append(('t', 'Verrous', None))
        for kk, v in VERROUS.items():
            if dedans(v['x'], v['y']):
                lg.append(('num', v['obstacle'][:60], kk))
        lg += [('t', 'Signes', None), ('etoile', 'repère visible de loin', None), ('carre', 'point clair: la porte du bâtiment', '#B86B4F'),
               ('carre', 'rouge: verrou; bleu: raccourci', '#B3261E'), ('trait', 'sentier (1 m); plein: chemin, rue, route', ('#B08A56', 2, '4 3')),
               ('trait', 'lisière: haie', ('#4F7244', 3, '4 3')), ('trait', 'lisière: talus', ('#8C6A45', 3, None)), ('trait', 'lisière: clôture, grille', ('#5A4632', 3, '2 3')),
               ('trait', 'lisière: bois dense', ('#3F6453', 3, None)), ('carre', 'hors jeu (décor: talus, prés, bois)', '#A7B38F')]
        page(nom, vue, 1500, el, lg, titre)

    # ---- plans des trajets de quête
    coul_q = {'A1': '#C2410C', 'A2': '#1D4ED8', 'A2p': '#0E7490', 'A3': '#7E22CE', 'S3': '#B45309', 'S5': '#0F766E'}
    for nom, ids, titre, vue in (('quetes-acte-1', ['A1'], 'Sentiers de quête, acte 1: le tour du propriétaire (bourg)', (148, 76, 130, 62)),
                                 ('quetes-acte-2', ['A2', 'A2p'], "Sentiers de quête, acte 2: la voie jusqu'au signal, retour par la vanne et la berge", (0, 78, 330, 86)),
                                 ('quetes-acte-3', ['A3', 'S3', 'S5'], 'Sentiers de quête, acte 3: le tunnel, retour par le belvédère; les pas blancs; la draisine', (84, 0, 300, 172))):
        k = vue[2] / 250.0
        el = fond(k, attenue=True)
        lg = [('t', 'Trajets', None)]
        # Pastilles: places déjà prises (étiquettes de verrous, puis pastilles posées); une pastille qui gêne
        # s'écarte autour de son nœud et y reste reliée par un trait.
        prises, pastilles, traits = [], [], []
        kv = max(k, 0.6)
        for kk, v in VERROUS.items():
            lv = max(5.2, 1.55 * len(kk) + 1.4) / 2
            prises.append((v['x'] - lv * kv, v['x'] + lv * kv, v['y'] - 1.7 * kv, v['y'] + 1.7 * kv))
        for qi in ids:
            q = next(x for x in QUETES if x['id'] == qi)
            c = coul_q[qi]
            dec = 0.9 * k * ids.index(qi)
            el.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%g" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>' % (
                pts([(N[i]['x'] + dec, N[i]['y'] + dec) for i in q['aller_noeuds']]), c, 1.5 * k))
            if q['retour_noeuds']:
                el.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%g" stroke-dasharray="%g %g" stroke-linejoin="round" opacity="0.9"/>' % (
                    pts([(N[i]['x'] + dec, N[i]['y'] + dec) for i in q['retour_noeuds']]), c, 1.5 * k, 3 * k, 2 * k))
            lg.append(('trait', q['titre'][:60], (c, 4, None)))
            lg.append(('trait', 'aller %d m, retour %d m' % (q['aller_m'], q['retour_m']), (c, 4, '6 4')))
            vu = {}
            for j, (nid, lib) in enumerate(q['etapes'] + [(a, b_) for a, b_ in q['retour'][1:]]):
                lettre = '%d' % (j + 1)
                if nid in vu:
                    vu[nid].append(lettre)
                else:
                    vu[nid] = [lettre]
                lg.append(('num', lib[:58], lettre))
            for nid, ls in vu.items():
                lab = ','.join(ls)
                w = max(2.6, 1.0 + len(lab) * 1.25) * k
                hy = 2.3 * k
                nx_, ny_ = N[nid]['x'] + dec, N[nid]['y'] + dec
                libre = lambda cx, cy: all(cx + w < a or cx - w > b_ or cy + hy < c_ or cy - hy > d_ for a, b_, c_, d_ in prises)
                cx, cy = nx_, ny_
                if not libre(cx, cy):
                    for j in (1, 2, 3, 4):
                        trouve = False
                        for ax, ay in ((0, -1), (0, 1), (1, 0), (-1, 0), (1, -1), (-1, -1), (1, 1), (-1, 1)):
                            px, py = nx_ + ax * j * (w + 0.6 * k), ny_ + ay * j * (2 * hy + 0.6 * k)
                            if libre(px, py):
                                cx, cy, trouve = px, py, True
                                break
                        if trouve:
                            break
                if (cx, cy) != (nx_, ny_):
                    traits.append('<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g"/>' % (nx_, ny_, cx, cy, c, 0.5 * k))
                    traits.append('<circle cx="%g" cy="%g" r="%g" fill="%s"/>' % (nx_, ny_, 0.9 * k, c))
                prises.append((cx - w, cx + w, cy - hy, cy + hy))
                pastilles.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" stroke="#FFFDF5" stroke-width="%g"/>' % (
                    cx - w, cy - hy, 2 * w, 2 * hy, 2.2 * k, c, 0.4 * k))
                pastilles.append(texte(cx, cy + 1.0 * k, lab, 2.7 * k, coul='#FFFFFF', gras=True, halo=False))
        for r in REPERES:
            if vue[0] < r['x'] < vue[0] + vue[2] and vue[1] + 6 * k < r['y'] < vue[1] + vue[3]:
                # au-dessus de l'étoile, ou dessous si une étiquette de verrou ou une pastille y est déjà
                t_, w_ = 2.6 * k, len(r['nom']) * 2.6 * k * 0.56
                for dy_ in (-4 * k, 6.5 * k, -8 * k):
                    yy = r['y'] + dy_
                    if all(r['x'] + w_ / 2 < a or r['x'] - w_ / 2 > b_ or yy < c_ or yy - t_ > d_ for a, b_, c_, d_ in prises):
                        break
                el.append(texte(r['x'], yy, r['nom'], t_, ital=True, gras=True))
        page(nom, vue, 1500, el + traits + etiquettes_verrous(k) + pastilles, lg, titre)


if __name__ == '__main__':
    BORD = bordures()
    dist_t, dens = calculer()
    ecrire_json(dist_t, dens)
    tableaux(dist_t, dens)
    dessiner(dist_t)
    print('plan.json, 11 SVG et PNG écrits; réseau %d m, %d bâtiments, %d points; pire densité %s m' % (
        dens['longueur_reseau_m'], len(B), len(P), dens['pire_m']))
