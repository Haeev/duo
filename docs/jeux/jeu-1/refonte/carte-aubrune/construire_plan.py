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
MARCHE, COURSE, DRAISINE = 3.0, 5.0, 8.0

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
n('be4', 254, 135.2, 'B'); n('cj', 252, 122, 'B')
n('ponton', 140, 130.2, 'B', "le ponton: on y vient pour pêcher, s'asseoir et regarder la rivière; il ne mène nulle part exprès")
n('cm1', 97, 108, 'B'); n('cm2', 89, 108, 'B'); n('mg', 83.5, 108, 'B')
n('cf0', 118.5, 87, 'B'); n('lis', 131, 92, 'B'); n('n1', 144.5, 92, 'B'); n('n2', 150, 92, 'B'); n('trav', 150, 97.5, 'B')
n('r0', 151, 84, 'B')
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
n('fc2', 134, 167, 'F'); n('fe1', 162, 160, 'F'); n('fe2', 200, 158, 'F'); n('fe3', 238, 156, 'F'); n('pj_s', 254, 151, 'F')
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
    'V9': dict(acte=3, x=254, y=143, obstacle='la passerelle des Jardins, sans tablier', sens='raccourci',
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
e('n1', 'r0', 'sentier', 'sentier du Ru'); e('r0', 'r1', 'sentier', 'sentier du Ru', 'V6'); chaine(['r1', 'r2', 'et'], 'sentier', 'sentier du Ru')
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
    dict(id='passerelle_jardins', nature='passerelle', x=254, y=143.2, r=6, raison="relie les champs de la ferme au bout de la Grand-Route: le raccourci du retour"),
    dict(id='deversoir', nature='déversoir', x=20, y=152, r=3, raison="seuil de pierre en travers de l'Aubrune, qui relève l'eau pour le bief (non franchissable)"),
]

# ---------------------------------------------------------------- bâtiments (rect x, y, l, h; porte; noeud)
B = []


def b(i, nom, x, y, l, h, porte, noeud, qui, raison, acte=1, ancien=None, interieur=None):
    B.append(dict(id=i, nom=nom, rect=[x, y, l, h], porte=list(porte) if porte else None, noeud=noeud, qui=qui,
                  raison=raison, acte=acte, ancien=ancien, interieur=interieur))


b('quai_b', 'le quai', 121, 99, 30, 4, None, 'quai', 'tous', "le coeur: le train s'arrête là, la caisse de la commande, le tableau, la cloche et la pendule y sont", ancien='platform', interieur=None)
b('halte', 'la halte', 151, 99, 10, 6, (156, 105), 'gr2', 'Firmin (bureau), consigne', "au bout est du quai, en ligne avec lui; porte au sud, sur la Grand-Route, là où arrivent les voyageurs à pied", ancien='station', interieur='salle des pas perdus, guichet, consigne (coffre commun), bureau de Firmin: 54 m²')
b('maison', 'la maison du garde-barrière', 104, 111, 11, 8, (115, 115), 'hd', 'les deux joueurs', "au passage à niveau; porte à l'est, vers la route: le garde sort et il est à sa barrière en dix pas. Emprise de la maison finie (88 m²), la ruine du début n'en occupe que la moitié est", ancien='gatekeeper_house', interieur='salle, cuisine, chambre, troisième pièce, étage, cave sous la chambre: 85 m² au sol')
b('epicerie', "l'épicerie-pension Ferrand", 122, 111, 8, 10, (130, 116), 'pl_o', 'Odette', "borde la place à l'ouest, vitrine et porte vers la place: on la voit en descendant du quai", ancien='ferrand_shop', interieur='boutique, cuisine, chambre de la pension: 70 m²')
b('scierie', "l'atelier de Basile", 102, 84, 10, 8, (112, 88), 'cf0', 'Basile', "contre le bois, au départ du chemin forestier: les grumes descendent et s'arrêtent là; porte et auvent à l'est, vers le chemin", ancien='sawmill', interieur='atelier et établi sous auvent: 60 m²')
b('firmin', 'la maison de Firmin', 141, 84, 7, 6, (144.5, 90), 'n1', 'Firmin', "en face du quai, de l'autre côté de la voie: il traverse par la traversée de service", ancien='firmin_house')
b('remise', 'la remise de la draisine', 156, 90, 6, 5, (156, 92.5), 'n2', 'draisine', "sur sa courte voie, porte à l'ouest dans l'axe des rails: la draisine sort droit sur la ligne (déplacée: l'ancienne avait sa porte au sud, sans rail devant)", acte=2, ancien='handcar_shed')
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
b('forestiere', 'la maison forestière', 66, 40, 6, 6, (72, 43), 'c3', 'réserve (Inès, après la fin)', "au bout carrossable du chemin forestier, porte à l'est sur le chemin", acte=4, ancien='forester_house')

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
p('potager', 'le potager (6, 12 puis 24 cases)', 'activite', 'hd', 107, 122.5)
p('poulailler', 'le poulailler', 'activite', 'hd', 113, 122.5)
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
p('enclume', "l'enclume et la meule de Mado", 'service', 'gr6', 206, 104)
p('jardins', 'les jardins de la Rive', 'collecte', 'bj', 190, 119)
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
    dict(nom='cour du moulin', rect=[66, 108, 14, 10], couleur='#D9CBB4'), dict(nom='potager', rect=[104, 120.5, 6, 4], couleur='#9A7B55'),
    dict(nom='poulailler', rect=[111.5, 121, 3, 3], couleur='#B58B5A'),
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
    ('po', 'mc'), ('mc', 'fc'), ('fc', 'gr9'), ('bv', 'pv'), ('et', 'pv'), ('cl', 'cf0')]


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


def ecrire_json(dist_t, dens):
    plan = dict(
        format='plan-de-lieu', version=1, id='aubrune', nom='Aubrune', echelle='1 unité = 1 m; x vers l’est, y vers le sud',
        taille=dict(largeur=L, hauteur=H), vitesses=dict(marche=MARCHE, course=COURSE, draisine=DRAISINE),
        ancien_repere=dict(note='coeur du bourg: ancien (x, y) de halte.json = nouveau (x - 100, y - 84), à 1 ou 2 m près', dx=100, dy=84),
        zones={k: dict(z, surface_m2=round(aire(z['poly']))) for k, z in ZONES.items()},
        eaux=EAUX, plans_eau=PLANS_EAU, rails=RAILS, noeuds=N, aretes=A, verrous=VERROUS, ouvrages=OUVRAGES, batiments=B,
        reperes=REPERES, points_interet=P, parcelles=PARCELLES, quetes=QUETES,
        points_cles=[dict(noeud=k, nom=v) for k, v in POINTS_CLES], distances=dist_t, densite=dens)
    lignes = ['{']
    cles = list(plan)
    for i, k in enumerate(cles):
        v = plan[k]
        fin = ',' if i < len(cles) - 1 else ''
        if isinstance(v, list) and v and isinstance(v[0], dict):
            lignes.append(' %s: [' % json.dumps(k))
            lignes += ['  ' + json.dumps(x, ensure_ascii=False) + (',' if j < len(v) - 1 else '') for j, x in enumerate(v)]
            lignes.append(' ]' + fin)
        elif isinstance(v, dict) and k in ('noeuds', 'zones', 'verrous'):
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
    d = ['| De | À | Distance | Marche (3 m/s) | Course (5 m/s) |', '|---|---|---|---|---|']
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
        if dans(ZONES['T']['poly'], x, y) and y > 60 and x < 300 and (x + y * 0.8) < 345:
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
    s.append('<path d="M290,56 Q298,44 306,56" fill="none" stroke="#3D3833" stroke-width="1.2"/>')
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
    for kk, v in VERROUS.items():
        c = '#3F6F8F' if v.get('sens') else '#B3261E'
        s.append('<rect x="%g" y="%g" width="%g" height="%g" rx="0.8" fill="%s" stroke="#FFFDF5" stroke-width="0.4"/>' % (v['x'] - 2.6 * k, v['y'] - 1.7 * k, 5.2 * k, 3.4 * k, c))
        s.append(texte(v['x'], v['y'] + 0.85 * k, kk, 2.3 * k, coul='#FFFFFF', gras=True, halo=False))
    # points d'intérêt
    for q in ([] if sans_poi else P):
        s.append('<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#FFFDF5" stroke-width="0.35"/>' % (q['x'], q['y'], 1.15 * max(k, 0.7), COUL_P[q['type']]))
    # repères
    for r in REPERES:
        s.append(etoile(r['x'], r['y'], 3.0 * max(k, 0.75)))
    if attenue:
        s.append('<rect x="0" y="0" width="%d" height="%d" fill="#FFFDF5" opacity="0.45"/>' % (L, H))
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
    s.append(texte(33, 4, '1 case = 1 m; course 5 m/s: 50 m = 10 s', 2.2, halo=False))
    s.append('</g>')
    return s


def page(nom, vue, largeur_px, elements, panneau=None, titre=None):
    x0, y0, w, h = vue
    ech = largeur_px / w
    pan = 330 if panneau else 0
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
        o.append('<text x="%g" y="15" font-family="DejaVu Sans" font-size="11" fill="#2E2A26" text-anchor="middle">échelle: %d m (%d s de marche, %d s de course)</text>' % (bx + m * ech / 2, m, round(m / MARCHE), round(m / COURSE)))
        o.append('<path d="M%g,30 L%g,8 M%g,4 L%g,13 L%g,13 Z" stroke="#2E2A26" stroke-width="2" fill="#2E2A26"/><text x="%g" y="24" font-family="DejaVu Sans" font-size="12" font-weight="bold" fill="#2E2A26">N</text>' % (bx - 30, bx - 30, bx - 30, bx - 35, bx - 25, bx - 22))
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
           ('etoile', 'repère visible de loin', None), ('carre', 'verrou d’histoire (zone fermée)', '#B3261E'), ('carre', 'raccourci qui se débloque', '#3F6F8F')]
    for kk in ('histoire', 'service', 'activite', 'collecte', 'repos'):
        lg.append(('pastille', NOM_P[kk], COUL_P[kk]))
    return lg


LABELS_ZONES = {'B': ('LE BOURG', 222, 118), 'R': ('LA RIVIÈRE ET LE BIEF', 196, 135.3), 'V': ('LA VOIE ET LE POSTE', 62, 87), 'C': ('LA CÔTE', 60, 10),
                'M': ('LE MOULIN', 64, 105.6), 'F': ('LA FERME', 190, 198), 'T': ('LE TUNNEL', 280, 10)}


def dessiner(dist_t):
    # ---- plan d'ensemble: bâtiments numérotés, légende à droite
    el = fond(1.0)
    for i, bb in enumerate(B):
        x, y, l, h = bb['rect']
        el.append(texte(x + l / 2, y + h / 2 + 1.1, str(i + 1), 3.0, coul='#FFFFFF' if bb['porte'] else '#2E2A26', gras=True, halo=False))
    for kz, z in ZONES.items():
        court, x, y = LABELS_ZONES[kz]
        el.append(texte(x, y, court + ' (acte %d)' % z['acte'], 3.4, gras=True, coul='#3A342C'))
    for r, (dx, dy, anc) in zip(REPERES, [(3.5, -1, 'start'), (1, -3.6, 'middle'), (-4, -1.5, 'end'), (-4, 4.5, 'end'), (4, -2, 'start'), (-5, 1, 'end'), (0, 8, 'middle'), (5, 4, 'start')]):
        el.append(texte(r['x'] + dx, r['y'] + dy, r['nom'], 2.8, anc=anc, ital=True))
    for nom_, x, y in (("l'Aubrune", 280, 157.5), ("l'Aubrune", 12, 158), ('le bief', 46, 135), ("l'étang", 172, 41), ('le ru', 168.5, 72), ("l'île du Bief", 58, 143),
                       ('Grand-Route', 240, 106.3), ('chemin de la Berge', 222, 127), ('chemin forestier', 82, 55), ('sentier des Crêtes', 252, 46), ('la tranchée', 76, 100.6),
                       ('la ligne morte', 272, 98), ('vieille route', 127, 176), ('prés lointains (décor)', 292, 124), ('prés lointains (décor)', 30, 184), ('bois (décor)', 20, 40), ('chemin des Champs', 182, 156.5), ('vers Hautefonte', 14, 103), ('vers Combe-Veilleuse', 300, 5)):
        el.append(texte(x, y, nom_, 2.5, ital=True, coul='#4A4034'))
    lg = legende_base() + [('t', 'Bâtiments (porte du côté du chemin)', None)]
    for i, bb in enumerate(B):
        lg.append(('num', bb['nom'], str(i + 1)))
    page('plan-ensemble', (0, 0, L, H), 1500, el, lg, "Aubrune: plan d'ensemble, 320 x 208 m (1 case = 1 m), nord en haut")

    # ---- plans de zone
    vues = {'B': ('zone-1-bourg', (80, 60, 178, 80), 'Zone 1: le bourg et le passage à niveau (acte 1)'),
            'R': ('zone-2-riviere-bief', (0, 96, 130, 68), 'Zone 2: la rivière et le bief, côté amont (acte 2); l’aval longe le bourg (plan de la zone 1)'),
            'V': ('zone-3-voie-poste', (0, 84, 126, 60), "Zone 3: la voie jusqu'au poste d'aiguillage (acte 2)"),
            'C': ('zone-4-cote', (40, 0, 250, 100), 'Zone 4: la Côte (acte 3)'),
            'M': ('zone-5-moulin', (44, 98, 62, 44), 'Zone 5: le moulin (acte 3)'),
            'F': ('zone-6-ferme', (62, 122, 212, 84), 'Zone 6: la ferme (acte 3)'),
            'T': ('zone-7-tunnel', (206, 0, 114, 112), 'Zone 7: le tunnel (acte 3)')}
    for kz, (nom, vue, titre) in vues.items():
        k = vue[2] / 250.0
        el = fond(k, numeros=False, sans_poi=True)
        vus = []

        def pose(x, y, s_, t, **kw):
            # évite les chevauchements: décale vers le bas tant qu'une étiquette voisine gêne
            w = len(s_) * t * 0.56
            anc = kw.get('anc', 'middle')
            for _ in range(8):
                x1 = x - w / 2 if anc == 'middle' else x if anc == 'start' else x - w
                if all(x1 + w < a or x1 > b_ or y + 0.3 * t < c or y - t > d for a, b_, c, d in vus):
                    break
                y += t * 1.05
            vus.append((x1, x1 + w, y - t, y + 0.3 * t))
            el.append(texte(x, y, s_, t, **kw))

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
        for j, q in enumerate(P):
            if dedans(q['x'], q['y']):
                el.append('<circle cx="%g" cy="%g" r="%g" fill="%s" stroke="#FFFDF5" stroke-width="%g"/>' % (q['x'], q['y'], 1.9 * kk_, COUL_P[q['type']], 0.3 * kk_))
                el.append(texte(q['x'], q['y'] + 0.75 * kk_, str(j + 1), 2.1 * kk_, coul='#FFFFFF', gras=True, halo=False))
                vus.append((q['x'] - 2 * kk_, q['x'] + 2 * kk_, q['y'] - 2 * kk_, q['y'] + 2 * kk_))
                lg.append(('pnum', q['nom'] + ('' if q['acte'] == 1 else ' (acte %d)' % q['acte']), (str(j + 1), COUL_P[q['type']])))
        for kk, v in VERROUS.items():
            vus.append((v['x'] - 2.6 * k, v['x'] + 2.6 * k, v['y'] - 1.7 * k, v['y'] + 1.7 * k))
        for r in REPERES:
            if dedans(r['x'], r['y']):
                pose(r['x'], r['y'] - 4 * kk_, r['nom'], 2.6 * kk_, ital=True, gras=True)
        for o in OUVRAGES:
            if dedans(o['x'], o['y']):
                pose(o['x'], o['y'] + 4.6 * kk_, o['id'].replace('_', ' ').replace('pn ', 'PN ').replace('trav service', 'traversée'), 2.0 * kk_, ital=True, coul='#5A4632')
        lg.append(('t', 'Verrous', None))
        for kk, v in VERROUS.items():
            if dedans(v['x'], v['y']):
                lg.append(('num', v['obstacle'][:47], kk))
        lg += [('t', 'Signes', None), ('etoile', 'repère visible de loin', None), ('carre', 'point clair: la porte du bâtiment', '#B86B4F'),
               ('carre', 'rouge: verrou; bleu: raccourci', '#B3261E'), ('trait', 'sentier (1 m); plein: chemin, rue, route', ('#B08A56', 2, '4 3'))]
        page(nom, vue, 1500, el, lg, titre)

    # ---- plans des trajets de quête
    coul_q = {'A1': '#C2410C', 'A2': '#1D4ED8', 'A2p': '#0E7490', 'A3': '#7E22CE', 'S3': '#B45309', 'S5': '#0F766E'}
    for nom, ids, titre, vue in (('quetes-acte-1', ['A1'], 'Sentiers de quête, acte 1: le tour du propriétaire (bourg)', (84, 76, 130, 62)),
                                 ('quetes-acte-2', ['A2', 'A2p'], "Sentiers de quête, acte 2: la voie jusqu'au signal, retour par la vanne et la berge", (0, 78, 256, 86)),
                                 ('quetes-acte-3', ['A3', 'S3', 'S5'], 'Sentiers de quête, acte 3: le tunnel, retour par le belvédère; les pas blancs; la draisine', (20, 0, 300, 172))):
        k = vue[2] / 250.0
        el = fond(k, attenue=True)
        lg = [('t', 'Trajets', None)]
        for qi in ids:
            q = next(x for x in QUETES if x['id'] == qi)
            c = coul_q[qi]
            dec = 0.9 * k * ids.index(qi)
            el.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%g" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>' % (
                pts([(N[i]['x'] + dec, N[i]['y'] + dec) for i in q['aller_noeuds']]), c, 1.5 * k))
            if q['retour_noeuds']:
                el.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="%g" stroke-dasharray="%g %g" stroke-linejoin="round" opacity="0.9"/>' % (
                    pts([(N[i]['x'] + dec, N[i]['y'] + dec) for i in q['retour_noeuds']]), c, 1.5 * k, 3 * k, 2 * k))
            lg.append(('trait', q['titre'][:44], (c, 4, None)))
            lg.append(('trait', 'aller %d m, retour %d m' % (q['aller_m'], q['retour_m']), (c, 4, '6 4')))
            vu = {}
            for j, (nid, lib) in enumerate(q['etapes'] + [(a, b_) for a, b_ in q['retour'][1:]]):
                lettre = '%d' % (j + 1)
                if nid in vu:
                    vu[nid].append(lettre)
                else:
                    vu[nid] = [lettre]
                lg.append(('num', lib[:46], lettre))
            for nid, ls in vu.items():
                lab = ','.join(ls)
                w = max(2.6, 1.0 + len(lab) * 1.25) * k
                el.append('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" stroke="#FFFDF5" stroke-width="%g"/>' % (
                    N[nid]['x'] + dec - w, N[nid]['y'] + dec - 2.3 * k, 2 * w, 4.6 * k, 2.2 * k, c, 0.4 * k))
                el.append(texte(N[nid]['x'] + dec, N[nid]['y'] + dec + 1.0 * k, lab, 2.7 * k, coul='#FFFFFF', gras=True, halo=False))
        for r in REPERES:
            if vue[0] < r['x'] < vue[0] + vue[2] and vue[1] + 6 * k < r['y'] < vue[1] + vue[3]:
                el.append(texte(r['x'], r['y'] - 4 * k, r['nom'], 2.6 * k, ital=True, gras=True))
        page(nom, vue, 1500, el, lg, titre)


if __name__ == '__main__':
    dist_t, dens = calculer()
    ecrire_json(dist_t, dens)
    tableaux(dist_t, dens)
    dessiner(dist_t)
    print('plan.json, 11 SVG et PNG écrits; réseau %d m, %d bâtiments, %d points; pire densité %s m' % (
        dens['longueur_reseau_m'], len(B), len(P), dens['pire_m']))
