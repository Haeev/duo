#!/usr/bin/env python3
"""Contrôle du plan d'Aubrune: lit plan.json (et le tableau des distances de plan.md), ne dépend pas du constructeur.
Puis rejoue l'ordre réel de l'histoire (fiches de quêtes et de scènes du lieu) sur la grille de carte.json, et la règle
d'accès: dans chaque état de l'histoire, portes, escaliers, meubles à brique et points cités du dehors et des intérieurs
s'atteignent à pied depuis le quai (escaliers qui font arriver dans leur salle, meubles posés sur leurs cases, 2 m vers
les escaliers et les lits des joueurs).

Usage: python3 -I controler_plan.py            contrôle le plan, code de sortie 1 s'il y a une erreur
       python3 -I controler_plan.py --eprouver casse une copie du plan (de la carte, des intérieurs et du décor des fêtes) de 36 façons et vérifie que chaque casse est vue
"""
import copy
import heapq
import json
import math
import os
import re
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
ACCES_MAX = 10.0      # mètres entre une porte et le chemin qui la dessert
DENSITE_S = 25.0      # secondes de marche au plus jusqu'au point d'intérêt le plus proche (mètres: selon la vitesse du plan)
PARTAGE_MAX = 0.35    # part du retour d'une quête qui peut reprendre l'aller


def dseg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = 0 if dx == dy == 0 else max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
    return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)


def croise(p1, p2, p3, p4):
    """Point de croisement franc de deux segments (les contacts aux extrémités ne comptent pas), ou None."""
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 1e-6 < t < 1 - 1e-6 and 1e-6 < u < 1 - 1e-6:
        return (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def segs(pts):
    return list(zip(pts, pts[1:]))


def dist_poly(p, pts):
    return min(dseg(p, a, b) for a, b in segs(pts))


def seg_rect(a, b, r, marge=0.0):
    """Vrai si le segment entre dans le rectangle rétréci de la marge."""
    x, y, l, h = r[0] + marge, r[1] + marge, r[2] - 2 * marge, r[3] - 2 * marge
    n = max(2, int(math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25))
    for i in range(n + 1):
        px, py = a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n
        if x < px < x + l and y < py < y + h:
            return True
    return False


def dist_rect_poly(r, pts):
    x, y, l, h = r
    coins = [(x, y), (x + l, y), (x + l, y + h), (x, y + h)]
    d = min(dist_poly(c, pts) for c in coins)
    for a, b in segs(pts):
        for c1, c2 in zip(coins, coins[1:] + coins[:1]):
            if croise(a, b, c1, c2):
                return 0.0
            d = min(d, dseg(a, c1, c2), dseg(b, c1, c2))
        if x < a[0] < x + l and y < a[1] < y + h:
            return 0.0
    return d


def dans(poly, x, y):
    r = False
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            r = not r
    return r


class Plan:
    def __init__(self, d):
        self.d = d
        self.N = d['noeuds']

    def pos(self, i):
        return (self.N[i]['x'], self.N[i]['y'])

    def long(self, a):
        p, q = self.pos(a['a']), self.pos(a['b'])
        return math.hypot(p[0] - q[0], p[1] - q[1])

    def graphe(self, acte):
        g = {k: [] for k in self.N}
        for a in self.d['aretes']:
            if a.get('verrou') and self.d['verrous'][a['verrou']]['acte'] > acte:
                continue
            ln = self.long(a)
            g[a['a']].append((a['b'], ln)); g[a['b']].append((a['a'], ln))
        return g

    @staticmethod
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

    def trajet(self, g, etapes):
        total, aretes = 0.0, []
        for a, b in zip(etapes, etapes[1:]):
            d, prev = self.dijkstra(g, [a])
            if b not in d:
                return None, None
            total += d[b]
            c = b
            while c != a:
                aretes.append(frozenset((c, prev[c]))); c = prev[c]
        return total, aretes


_FICHES = None


def fiches_meubles():
    global _FICHES
    if _FICHES is None:
        dossier = os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'donnees', 'commun', 'meubles')
        _FICHES = {f[:-5]: json.load(open(os.path.join(dossier, f), encoding='utf-8')) for f in os.listdir(dossier) if f.endswith('.json')}
    return _FICHES


_MANIFESTE = None


def manifeste():
    global _MANIFESTE
    if _MANIFESTE is None:
        f = os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'assets', 'commun', 'decors', 'decors.json')
        _MANIFESTE = json.load(open(f, encoding='utf-8'))['models']
    return _MANIFESTE


# Le rendu décale une fenêtre derrière tout volume de 1,3 m et plus à 0,75 m d'un mur (`tallObject`, `spanAlong`).
HAUT_FENETRE, PORTEE_FENETRE = 1.3, 0.75


_BORNES = {}


def bornes_glb(modele):
    """(xmin, zmin, xmax, zmax) du modèle dans son repère, lus dans le GLB (bornes des sommets de chaque maillage,
    transformées par les nœuds): un comptoir n'est pas centré sur son origine (le zinc déborde côté client)."""
    if modele in _BORNES:
        return _BORNES[modele]
    import struct
    s = manifeste()[modele]
    f = os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'assets', 'commun', 'decors', s['file'])
    b = open(f, 'rb').read()
    js = json.loads(b[20:20 + struct.unpack_from('<I', b, 12)[0]])

    def mat(n):
        t = n.get('translation', [0, 0, 0]); x, y, z, w = n.get('rotation', [0, 0, 0, 1]); sc = n.get('scale', [1, 1, 1])
        r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
             [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
             [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
        return lambda p: [sum(r[i][j] * p[j] * sc[j] for j in range(3)) + t[i] for i in range(3)]

    pts = []

    def visiter(i, f):
        n = js['nodes'][i]
        g = mat(n)
        h = lambda p: f(g(p))
        if 'mesh' in n:
            for prim in js['meshes'][n['mesh']]['primitives']:
                a = js['accessors'][prim['attributes']['POSITION']]
                for cx in (a['min'][0], a['max'][0]):
                    for cy in (a['min'][1], a['max'][1]):
                        for cz in (a['min'][2], a['max'][2]):
                            pts.append(h([cx, cy, cz]))
        for c in n.get('children', []):
            visiter(c, h)
    visiter([i for i, n in enumerate(js['nodes']) if n.get('name') == modele][0], lambda p: p)
    _BORNES[modele] = (min(p[0] for p in pts), min(p[2] for p in pts), max(p[0] for p in pts), max(p[2] for p in pts))
    return _BORNES[modele]


def modele_de(m):
    """Le modèle que le rendu dessine: celui de la fiche du type (le `modele` du plan n'est qu'une indication)."""
    return fiches_meubles()[m['type']]['model']


def taille_de(m):
    """Taille (w, d, h en m) du modèle dessiné. Un modèle absent du manifeste (retiré, pas encore refait) est dessiné
    en forme provisoire sur l'emprise de sa fiche: hauteur de son plateau, sinon 1 m."""
    s = manifeste().get(modele_de(m))
    if s is not None:
        return s['size']
    f = fiches_meubles()[m['type']]
    return dict(w=f['size']['w'], d=f['size']['h'], h=f.get('top', 1.0))


def boite_modele(m):
    """Boîte au sol (x0, y0, x1, y1) du modèle d'un meuble posé, dans le repère de la pièce (origine du modèle au
    centre de l'objet; gx le long du meuble, gz vers sa façade)."""
    a = m['rotation'] * math.pi / 2
    ca, sa = round(math.cos(a)), round(math.sin(a))
    if modele_de(m) in manifeste():
        xmin, zmin, xmax, zmax = bornes_glb(modele_de(m))
    else:
        t = taille_de(m)
        xmin, zmin, xmax, zmax = -t['w'] / 2, -t['d'] / 2, t['w'] / 2, t['d'] / 2
    coins = [(xmin, zmin), (xmax, zmax)]
    pts = [(m['x'] + gx * ca + gz * sa, m['y'] - gx * sa + gz * ca) for gx in (coins[0][0], coins[1][0]) for gz in (coins[0][1], coins[1][1])]
    return (min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts))


def controler_poses(it):
    """Objets posés sur un meuble (`on`, version 6): fiche sans brique et non solide; porteur dans la même pièce, avec
    un plateau (`top`); centre dans la boîte du modèle du porteur (sinon il flotte au bord), pas dans un autre objet
    posé; et rien de 1,3 m ou plus (plateau compris) à 0,75 m d'un mur, sauf au droit d'un porteur aussi haut: le
    rendu y décalerait une fenêtre."""
    err = []
    F = fiches_meubles()
    M = manifeste()
    W, H = it['largeur'], it['hauteur']
    par_id = {m['id']: m for m in it['meubles']}

    def hauteur(m, n=0):
        on = m.get('on')
        if on is None:
            return 0.0
        if isinstance(on, (int, float)):
            return float(on)
        p = par_id.get(on)
        if p is None or n > 3 or (F.get(p['type']) or {}).get('top') is None:
            return None
        h = hauteur(p, n + 1)
        return None if h is None else h + F[p['type']]['top']

    def murs(x0, y0, x1, y1):
        return [k for k, g in (('nord', y0), ('ouest', x0), ('sud', H - y1), ('est', W - x1)) if g <= PORTEE_FENETRE]

    poses = [m for m in it['meubles'] if m.get('on') is not None]
    for m in poses:
        quoi = "intérieur %s: objet posé %s" % (it['id'], m['id'])
        f = F.get(m['type'])
        if f is None:
            err.append("%s: type %s sans fiche" % (quoi, m['type']))
            continue
        if f.get('bricks') or f.get('solid'):
            err.append("%s: un objet posé est du décor (ni brique, ni solide)" % quoi)
        base = hauteur(m)
        if base is None:
            err.append("%s: porteur %s absent de la pièce, sans plateau ou chaîne trop longue" % (quoi, m['on']))
            continue
        p = par_id.get(m['on']) if isinstance(m['on'], str) else None
        if p is not None:
            x0, y0, x1, y1 = boite_modele(p)
            if not (x0 <= m['x'] <= x1 and y0 <= m['y'] <= y1):
                err.append("%s: centre (%.2f, %.2f) hors du plateau de %s (%.2f..%.2f, %.2f..%.2f)" % (quoi, m['x'], m['y'], p['id'], x0, x1, y0, y1))
        total = base + taille_de(m)['h']
        if total >= HAUT_FENETRE:
            pres = murs(m['x'] - 0.5, m['y'] - 0.5, m['x'] + 0.5, m['y'] + 0.5)
            if pres:
                couvert = p is not None and taille_de(p)['h'] >= HAUT_FENETRE
                if couvert:
                    t = F[p['type']]['size']
                    w, h = (t['w'], t['h']) if p['rotation'] % 2 == 0 else (t['h'], t['w'])
                    couvert = abs(m['x'] - p['x']) <= (w - 1) / 2 + 1e-6 and abs(m['y'] - p['y']) <= (h - 1) / 2 + 1e-6
                if not couvert:
                    err.append("%s: monte à %.2f m à moins de %.2f m du mur %s (le rendu y décalerait une fenêtre)" % (quoi, total, PORTEE_FENETRE, '/'.join(pres)))
    for i, a in enumerate(poses):
        for b in poses[i + 1:]:
            if a['on'] != b['on']:
                continue
            ra = max(taille_de(a)['w'], taille_de(a)['d']) / 2
            rb = max(taille_de(b)['w'], taille_de(b)['d']) / 2
            if math.hypot(a['x'] - b['x'], a['y'] - b['y']) < 0.8 * (ra + rb):
                err.append("intérieur %s: %s et %s se chevauchent sur %s" % (it['id'], a['id'], b['id'], a['on']))
    return err


def controler_habillage(it):
    """Petits objets d'une pièce (couches `floor`, `rug`, `wall` des fiches): un objet mural pend à un mur debout
    (la caméra regarde du sud-ouest: mur nord en rotation 0, mur est en rotation 3), hors d'une cloison; un objet
    de plateau (`top`) est posé sur un meuble (`on`, contrôlé par `controler_poses`); rien sur un point, rien dans
    les deux cases devant une porte ou un escalier (1,5 m libres), rien dans l'emprise d'un meuble encore sans modèle."""
    err = controler_poses(it)
    ids = [m['id'] for m in it['meubles']]
    err += ["intérieur %s: identifiant %s en double" % (it['id'], i) for i in sorted({i for i in ids if ids.count(i) > 1})]
    F = fiches_meubles()
    W, H = it['largeur'], it['hauteur']
    cloison = {(x, y) for cx, cy, cw, ch in it['cloisons'] for x in range(cx, cx + cw) for y in range(cy, cy + ch)}
    devant = set()
    portes = ([tuple(it['porte'])] if it['porte'] else []) + [(e['x'], e['y'], e['regard']) for e in it['escaliers']]
    for px, py, r in portes:
        dx, dy = ((0, 1), (1, 0), (0, -1), (-1, 0))[r]
        devant |= {(int(px) + k * dx, int(py) + k * dy) for k in (1, 2)}
    points = {(int(p['x']), int(p['y'])) for p in it['points']}
    reserve = set()
    for m in it['meubles']:
        if m['type'] is None:
            reserve |= {(int(m['x']) + i, int(m['y']) + j) for i in (-1, 0) for j in (-1, 0)} | {(int(m['x']), int(m['y']))}
    for m in it['meubles']:
        deco = (F.get(m['type']) or {}).get('deco')
        if m.get('on') is not None:
            continue
        if deco is None and 'pourquoi' in m and (F.get(m['type']) or {}).get('size'):
            deco = {'layer': 'floor'}
        if not deco or 'pourquoi' not in m:
            continue
        c = (int(m['x']), int(m['y']))
        quoi = "intérieur %s: objet %s" % (it['id'], m['id'])
        if deco['layer'] == 'top':
            err.append("%s: objet de plateau posé au sol: lui donner son porteur (`on`)" % quoi)
        elif deco['layer'] == 'wall':
            if not ((c[1] == 0 and m['rotation'] == 0) or (c[0] == W - 1 and m['rotation'] == 3)):
                err.append("%s: objet mural hors d'un mur debout (nord en rotation 0, est en rotation 3)" % quoi)
            if c in cloison:
                err.append("%s: accroché à une cloison, que le rendu ne dessine pas" % quoi)
        else:
            for cc in emprise_type(m, F):
                if cc in devant and deco['layer'] != 'rug':
                    err.append("%s: dans les 1,5 m devant une porte ou un escalier (case %d, %d)" % (quoi, cc[0], cc[1]))
                if cc in points and deco['layer'] != 'rug':
                    err.append("%s: posé sur un point (case %d, %d)" % (quoi, cc[0], cc[1]))
                if cc in reserve:
                    err.append("%s: dans l'emprise d'un meuble encore sans modèle (case %d, %d)" % (quoi, cc[0], cc[1]))
                if cc in cloison or not (0 <= cc[0] < W and 0 <= cc[1] < H):
                    err.append("%s: dans une cloison ou hors de la pièce" % quoi)
    return err


def emprise_type(m, F):
    t = F[m['type']]['size']
    w, h = (t['w'], t['h']) if m['rotation'] % 2 == 0 else (t['h'], t['w'])
    x0, x1 = math.floor(m['x'] - w / 2 + 1e-6), math.floor(m['x'] + w / 2 - 1e-6)
    y0, y1 = math.floor(m['y'] - h / 2 + 1e-6), math.floor(m['y'] + h / 2 - 1e-6)
    return [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def controler(d, md=None):
    err, info = [], []
    P = Plan(d)
    N = P.N
    Lg, Ht = d['taille']['largeur'], d['taille']['hauteur']
    eaux = {w['id']: w for w in d['eaux']}
    ouvr = d['ouvrages']
    bats = d['batiments']

    def ouvrage_pres(pt, natures=None):
        return any(math.hypot(pt[0] - o['x'], pt[1] - o['y']) <= o['r'] and (natures is None or o['nature'] in natures) for o in ouvr)

    # ---- 0. références
    for a in d['aretes']:
        for k in (a['a'], a['b']):
            if k not in N:
                err.append("arête %s-%s: noeud inconnu %s" % (a['a'], a['b'], k))
        if a.get('verrou') and a['verrou'] not in d['verrous']:
            err.append("arête %s-%s: verrou inconnu %s" % (a['a'], a['b'], a['verrou']))
    if err:
        return err, info
    for i, nn in N.items():
        if not (0 <= nn['x'] <= Lg and 0 <= nn['y'] <= Ht):
            err.append("noeud %s hors de la carte" % i)
        z = d['zones'].get(nn['zone'])
        if not z:
            err.append("noeud %s: zone inconnue" % i)
        elif not dans(z['poly'], nn['x'], nn['y']):
            err.append("noeud %s (%g, %g): annoncé dans la zone %s mais hors de son contour" % (i, nn['x'], nn['y'], nn['zone']))

    # ---- 1. bâtiments: emprises, portes, accès
    g3 = P.graphe(99)
    d_quai, _ = P.dijkstra(g3, ['quai'])
    for i, b in enumerate(bats):
        r = b['rect']
        for c in bats[i + 1:]:
            q = c['rect']
            if r[0] < q[0] + q[2] and q[0] < r[0] + r[2] and r[1] < q[1] + q[3] and q[1] < r[1] + r[3]:
                err.append("bâtiments qui se chevauchent: %s et %s" % (b['id'], c['id']))
        for w in d['eaux']:
            if dist_rect_poly(r, w['pts']) < w['largeur'] / 2 - 1e-6:
                err.append("bâtiment %s dans l'eau (%s)" % (b['id'], w['id']))
        for w in d['plans_eau']:
            if math.hypot((r[0] + r[2] / 2 - w['cx']) / (w['rx'] + r[2] / 2), (r[1] + r[3] / 2 - w['cy']) / (w['ry'] + r[3] / 2)) < 1:
                err.append("bâtiment %s dans %s" % (b['id'], w['id']))
        if b['porte'] is not None:
            for rl in d['rails']:
                if rl['id'] != b.get('sur_rail') and dist_rect_poly(r, rl['pts']) < 1.5 - 1e-6:
                    err.append("bâtiment %s sur la voie (%s)" % (b['id'], rl['id']))
        if not b.get('raison'):
            err.append("bâtiment %s sans raison d'être écrite" % b['id'])
        if b['noeud'] not in N:
            err.append("bâtiment %s: noeud d'accès inconnu" % b['id']); continue
        if b['noeud'] not in d_quai:
            err.append("bâtiment %s: son chemin n'est pas relié au quai" % b['id'])
        if b['porte'] is None:
            continue
        px, py = b['porte']
        x, y, l, h = r
        sur = (abs(px - x) < 1e-6 or abs(px - x - l) < 1e-6) and y <= py <= y + h or (abs(py - y) < 1e-6 or abs(py - y - h) < 1e-6) and x <= px <= x + l
        if not sur:
            err.append("bâtiment %s: la porte (%g, %g) n'est pas sur un mur" % (b['id'], px, py)); continue
        nrm = (-1, 0) if abs(px - x) < 1e-6 else (1, 0) if abs(px - x - l) < 1e-6 else (0, -1) if abs(py - y) < 1e-6 else (0, 1)
        nx, ny = P.pos(b['noeud'])
        dd = math.hypot(nx - px, ny - py)
        if dd > ACCES_MAX:
            err.append("bâtiment %s: porte à %.1f m du chemin (plafond %g)" % (b['id'], dd, ACCES_MAX))
        if (nx - px) * nrm[0] + (ny - py) * nrm[1] <= 0.2:
            err.append("bâtiment %s: la porte tourne le dos à son chemin (noeud %s)" % (b['id'], b['noeud']))
        for c in bats:
            if c['porte'] is not None and seg_rect((px, py), (nx, ny), c['rect'], 0.05):
                err.append("bâtiment %s: l'accès à la porte traverse %s" % (b['id'], c['id']))
        for w in d['eaux']:
            for s1, s2 in segs(w['pts']):
                pt = croise((px, py), (nx, ny), tuple(s1), tuple(s2))
                if pt and not ouvrage_pres(pt):
                    err.append("bâtiment %s: l'accès à la porte traverse %s (porte côté eau)" % (b['id'], w['id']))

    # ---- 2. eau: aucune eau sans source ni exutoire
    def bout_ok(w, bout, pt):
        s = w.get(bout)
        if not s:
            return "pas de %s" % bout
        if s['type'] == 'bord':
            return None if min(pt[0], pt[1], Lg - pt[0], Ht - pt[1]) < 0.5 else "%s annoncé au bord de la carte, mais le tracé n'y touche pas" % bout
        if s['type'] == 'eau':
            o = eaux.get(s.get('id'))
            if not o:
                return "%s: eau inconnue %s" % (bout, s.get('id'))
            return None if dist_poly(pt, o['pts']) <= o['largeur'] / 2 + 1.0 else "%s: le tracé ne rejoint pas %s (%.1f m)" % (bout, o['id'], dist_poly(pt, o['pts']))
        if s['type'] == 'source':
            q = next((q for q in d['points_interet'] if q['id'] == s.get('poi')), None)
            if not q:
                return "source: point d'intérêt inconnu"
            return None if math.hypot(q['x'] - pt[0], q['y'] - pt[1]) <= 4 else "la source est à plus de 4 m du début du tracé"
        return "type de %s inconnu" % bout
    for w in d['eaux']:
        for bout, pt in (('source', w['pts'][0]), ('exutoire', w['pts'][-1])):
            m = bout_ok(w, bout, pt)
            if m:
                err.append("eau %s: %s" % (w['id'], m))
        if not w.get('raison'):
            err.append("eau %s sans raison d'être écrite" % w['id'])
    for w in d['plans_eau']:
        o = eaux.get(w.get('alimente_par'))
        if not o:
            err.append("plan d'eau %s: isolé, aucun cours d'eau ne l'alimente" % w['id']); continue
        dedans = [math.hypot((p[0] - w['cx']) / w['rx'], (p[1] - w['cy']) / w['ry']) < 1 for p in o['pts']]
        if not any(dedans) or dedans[0] or dedans[-1]:
            err.append("plan d'eau %s: %s doit y entrer et en ressortir" % (w['id'], o['id']))
    # eau contre voie: un ponceau
    for w in d['eaux']:
        for rl in d['rails']:
            for a, b in segs(w['pts']):
                for c, e in segs(rl['pts']):
                    pt = croise(tuple(a), tuple(b), tuple(c), tuple(e))
                    if pt and not ouvrage_pres(pt, ('ponceau', 'pont')):
                        err.append("%s passe sous la voie %s en (%.0f, %.0f) sans ponceau" % (w['id'], rl['id'], pt[0], pt[1]))

    # ---- 3. chemins: franchissements, bâtiments, impasses
    deg = {k: 0 for k in N}
    for a in d['aretes']:
        deg[a['a']] += 1; deg[a['b']] += 1
        p, q = P.pos(a['a']), P.pos(a['b'])
        nom = "%s-%s" % (a['a'], a['b'])
        for w in d['eaux']:
            for s1, s2 in segs(w['pts']):
                pt = croise(p, q, tuple(s1), tuple(s2))
                if pt and not ouvrage_pres(pt):
                    err.append("chemin %s: traverse %s en (%.0f, %.0f) sans pont, passerelle ni gué" % (nom, w['id'], pt[0], pt[1]))
        for w in d['plans_eau']:
            for i in range(21):
                x, y = p[0] + (q[0] - p[0]) * i / 20, p[1] + (q[1] - p[1]) * i / 20
                if math.hypot((x - w['cx']) / w['rx'], (y - w['cy']) / w['ry']) < 1:
                    err.append("chemin %s: passe dans %s" % (nom, w['id'])); break
        if a['classe'] not in ('voie', 'interieur'):
            for rl in d['rails']:
                for s1, s2 in segs(rl['pts']):
                    pt = croise(p, q, tuple(s1), tuple(s2))
                    if pt and not ouvrage_pres(pt, ('passage à niveau', 'traversée')):
                        err.append("chemin %s: coupe la voie en (%.0f, %.0f) sans passage à niveau" % (nom, pt[0], pt[1]))
        for b in bats:
            if b['porte'] is not None and seg_rect(p, q, b['rect'], 0.05):
                err.append("chemin %s: traverse le bâtiment %s" % (nom, b['id']))
    for i, nn in N.items():
        if deg[i] == 0:
            err.append("noeud %s: relié à rien" % i)
        if i not in d_quai:
            err.append("noeud %s: inatteignable depuis le quai" % i)
        hors_eau = not ouvrage_pres((nn['x'], nn['y']))
        for w in d['eaux']:
            if hors_eau and dist_poly((nn['x'], nn['y']), w['pts']) < w['largeur'] / 2 + 0.8:
                err.append("noeud %s: dans l'eau (%s)" % (i, w['id']))
        classes = {a['classe'] for a in d['aretes'] if i in (a['a'], a['b'])}
        if classes - {'voie', 'interieur'}:
            for rl in d['rails']:
                if not rl.get('tunnel') and dist_poly((nn['x'], nn['y']), rl['pts']) < 0.5 and not ouvrage_pres((nn['x'], nn['y']), ('passage à niveau', 'traversée')):
                    err.append("noeud %s: un chemin arrive sur la voie sans passage à niveau" % i)
        if deg[i] == 1 and not nn.get('impasse') and not any(b['noeud'] == i for b in bats):
            err.append("noeud %s: chemin en impasse sans raison notée" % i)
    # arêtes qui se croisent sans carrefour
    ar = d['aretes']
    for i, a in enumerate(ar):
        for b in ar[i + 1:]:
            if {a['a'], a['b']} & {b['a'], b['b']}:
                continue
            pt = croise(P.pos(a['a']), P.pos(a['b']), P.pos(b['a']), P.pos(b['b']))
            if pt and not ('interieur' in (a['classe'], b['classe'])):
                err.append("chemins %s-%s et %s-%s: se croisent en (%.0f, %.0f) sans carrefour" % (a['a'], a['b'], b['a'], b['b'], pt[0], pt[1]))

    # ---- 4. zones fermées par l'histoire: chaque noeud s'ouvre à l'acte de sa zone, pas avant
    ouverture = {}
    for acte in (1, 2, 3):
        dd, _ = P.dijkstra(P.graphe(acte), ['quai'])
        for k in dd:
            ouverture.setdefault(k, acte)
    for i, nn in N.items():
        za = d['zones'][nn['zone']]['acte']
        if ouverture.get(i) is None:
            err.append("noeud %s: jamais ouvert" % i)
        elif ouverture[i] < za:
            err.append("noeud %s (zone %s, acte %d): atteignable dès l'acte %d, un verrou manque" % (i, nn['zone'], za, ouverture[i]))
        elif ouverture[i] > za:
            err.append("noeud %s (zone %s, acte %d): ne s'ouvre qu'à l'acte %d" % (i, nn['zone'], za, ouverture[i]))
    for b in bats:
        if b['noeud'] in ouverture and b['acte'] < ouverture[b['noeud']]:
            err.append("bâtiment %s: utile dès l'acte %d mais son accès n'ouvre qu'à l'acte %d" % (b['id'], b['acte'], ouverture[b['noeud']]))
    for q in d['points_interet']:
        if q['noeud'] not in N:
            err.append("point %s: noeud inconnu" % q['id']); continue
        if q['acte'] < ouverture.get(q['noeud'], 9):
            err.append("point %s: utile dès l'acte %d mais son accès n'ouvre qu'à l'acte %d" % (q['id'], q['acte'], ouverture.get(q['noeud'], 9)))
        if math.hypot(q['x'] - N[q['noeud']]['x'], q['y'] - N[q['noeud']]['y']) > 8:
            err.append("point %s: à plus de 8 m de son chemin" % q['id'])
    for k, v in d['verrous'].items():
        if not any(a.get('verrou') == k for a in d['aretes']):
            err.append("verrou %s: posé sur aucun chemin" % k)

    # ---- 4 bis. version 2: verrous visibles, lisières habillées, couloirs des verrous internes, gabarits, bancs
    if d.get('revision', 1) >= 2:
        for k, v in d['verrous'].items():
            if not v.get('objet') or not v.get('modele'):
                err.append("verrou %s: aucun objet visible" % k)
            if 'Pas encore' not in v.get('pas_encore', ''):
                err.append("verrou %s: pas de phrase « pas encore »" % k)
        hab = set(d['habillages'])
        for zk, z in d['zones'].items():
            morceaux = d['bordures'].get(zk, [])
            per = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(z['poly'], z['poly'][1:] + z['poly'][:1]))
            couvert = sum(math.hypot(m['a'][0] - m['de'][0], m['a'][1] - m['de'][1]) for m in morceaux)
            if abs(per - couvert) > 1.0:
                err.append("zone %s: lisière habillée sur %.0f m sur %.0f m de contour" % (zk, couvert, per))
            for m in morceaux:
                if m['habillage'] not in hab:
                    err.append("zone %s: lisière nue (%s) vers %s en (%.0f, %.0f)" % (zk, m['habillage'], m['voisin'], m['de'][0], m['de'][1]))
        # verrou posé à l'intérieur d'une zone: le couloir doit être plus étroit que l'obstacle (7 m)
        for k, v in d['verrous'].items():
            ar = [a for a in d['aretes'] if a.get('verrou') == k]
            if not ar or N[ar[0]['a']]['zone'] != N[ar[0]['b']]['zone']:
                continue
            z = d['zones'][N[ar[0]['a']]['zone']]['poly']
            pa, pb = P.pos(ar[0]['a']), P.pos(ar[0]['b'])
            ln = math.hypot(pb[0] - pa[0], pb[1] - pa[1])
            nx, ny = -(pb[1] - pa[1]) / ln, (pb[0] - pa[0]) / ln
            larg = 0.0
            for sg in (1, -1):
                t = 0.0
                while t < 60 and dans(z, v['x'] + sg * nx * t, v['y'] + sg * ny * t):
                    t += 0.25
                larg += t
            if larg > 7.0:
                err.append("verrou %s: posé dans un passage de %.1f m, plus large que l'obstacle (7 m): on le contourne" % (k, larg))
        for b in bats:
            g = b.get('gabarit') or {}
            if g.get('largeur') != b['rect'][2] or g.get('profondeur') != b['rect'][3]:
                err.append("bâtiment %s: gabarit d'une autre taille que l'emprise" % b['id'])
            if b['porte'] is not None:
                x, y, l, h = b['rect']
                px, py = b['porte']
                fac = 'ouest' if abs(px - x) < 1e-6 else 'est' if abs(px - x - l) < 1e-6 else 'nord' if abs(py - y) < 1e-6 else 'sud'
                if g.get('facade_porte') != fac or not g.get('portes'):
                    err.append("bâtiment %s: la porte du gabarit n'est pas sur la façade %s du plan" % (b['id'], fac))
        for m in d['mobilier']:
            for b in bats:
                x, y, l, h = b['rect']
                if b['porte'] is not None and x < m['x'] < x + l and y < m['y'] < y + h:
                    err.append("objet %s: posé dans le bâtiment %s" % (m['id'], b['id']))
            if m.get('regarde'):
                vx, vy = m['regarde'][0] - m['x'], m['regarde'][1] - m['y']
                fx, fy = [(0, 1), (1, 0), (0, -1), (-1, 0)][m['rotation']]
                if (vx * fx + vy * fy) / max(1e-9, math.hypot(vx, vy)) < 0.5:
                    err.append("objet %s: tourne le dos (ou le flanc) à ce qu'il regarde" % m['id'])
        for it in d['interieurs']:
            if not it['porte'] and not it['escaliers']:
                err.append("intérieur %s: ni porte ni escalier" % it['id'])
            err += controler_habillage(it)
        info.append("version 2: %d lisières habillées, %d objets de lieu, %d intérieurs, %d ressources" % (
            sum(len(v) for v in d['bordures'].values()), len(d['mobilier']), len(d['interieurs']), len(d['ressources'])))

    # ---- 5. densité d'intérêt
    src = sorted({q['noeud'] for q in d['points_interet'] if q['noeud'] in N} | {b['noeud'] for b in bats if b['noeud'] in N})
    dp, _ = P.dijkstra(g3, src)
    pire = 0.0
    for a in d['aretes']:
        ln = P.long(a); t = 0.0
        while t <= ln:
            v = min(dp.get(a['a'], 1e9) + t, dp.get(a['b'], 1e9) + ln - t)
            if v > pire:
                pire, ou = v, "%s-%s" % (a['a'], a['b'])
            t += 5.0
    if pire > DENSITE_S * d['vitesses']['marche']:
        err.append("densité: %.0f m de chemin sans rien à faire près de %s (plafond %g m, %g s de marche)" % (pire, ou, DENSITE_S * d['vitesses']['marche'], DENSITE_S))
    info.append("densité: pire distance à un point d'intérêt %.1f m (annoncé %.1f)" % (pire, d['densite']['pire_m']))
    if abs(pire - d['densite']['pire_m']) > 0.5:
        err.append("densité annoncée %.1f m, recalculée %.1f m" % (d['densite']['pire_m'], pire))

    # ---- 6. quêtes: étapes reliées, longueurs recalculées, retour par un autre chemin
    for q in d['quetes']:
        g = P.graphe(q['acte'])
        m, ar_aller = P.trajet(g, [e[0] for e in q['etapes']])
        if m is None:
            err.append("quête %s: une étape est inatteignable à l'acte %d" % (q['id'], q['acte'])); continue
        if abs(m - q['aller_m']) > 0.5:
            err.append("quête %s: aller annoncé %.1f m, recalculé %.1f m" % (q['id'], q['aller_m'], m))
        if q['retour']:
            mr, ar_ret = P.trajet(g, [e[0] for e in q['retour']])
            if mr is None:
                err.append("quête %s: retour impossible" % q['id']); continue
            if abs(mr - q['retour_m']) > 0.5:
                err.append("quête %s: retour annoncé %.1f m, recalculé %.1f m" % (q['id'], q['retour_m'], mr))
            lon = lambda e: math.hypot(*(a - b for a, b in zip(*[P.pos(k) for k in e])))
            commun = sum(lon(e) for e in set(ar_ret) if e in set(ar_aller))
            if mr > 0 and commun / mr > PARTAGE_MAX:
                err.append("quête %s: le retour reprend %.0f %% de l'aller (plafond %.0f %%)" % (q['id'], 100 * commun / mr, 100 * PARTAGE_MAX))
            info.append("quête %s: aller %.0f m, retour %.0f m dont %.0f m communs" % (q['id'], m, mr, commun))
        else:
            info.append("quête %s: aller %.0f m" % (q['id'], m))

    # ---- 7. distances annoncées (plan.json et tableau de plan.md)
    noms = {p_['nom']: p_['noeud'] for p_ in d['points_cles']}
    for r in d['distances']:
        dd, _ = P.dijkstra(g3, [r['de']])
        if r['a'] not in dd or abs(dd[r['a']] - r['m']) > 0.51:
            err.append("distance %s vers %s: annoncée %s m, recalculée %s" % (r['de'], r['a'], r['m'], '%.1f m' % dd[r['a']] if r['a'] in dd else 'impossible'))
    if md is not None:
        bloc = re.search(r'<!-- genere:distances:debut -->(.*?)<!-- genere:distances:fin -->', md, re.S)
        if not bloc:
            err.append("plan.md: tableau des distances introuvable")
        else:
            nb = 0
            v = d['vitesses']
            for ligne in bloc.group(1).strip().split('\n')[2:]:
                c = [x.strip() for x in ligne.strip('|').split('|')]
                if c[0] not in noms or c[1] not in noms:
                    err.append("plan.md: lieu inconnu dans « %s »" % ligne); continue
                dd, _ = P.dijkstra(g3, [noms[c[0]]])
                m = dd.get(noms[c[1]])
                if m is None or abs(m - int(c[2].split()[0])) > 0.51:
                    err.append("plan.md: %s vers %s annoncé %s, recalculé %s" % (c[0], c[1], c[2], m))
                    continue
                for col, vit in ((3, v['marche']), (4, v['course'])):
                    s = round(round(m) / vit)
                    attendu = '%d s' % s if s < 60 else '%d min %02d' % (s // 60, s % 60)
                    if c[col] != attendu:
                        err.append("plan.md: %s vers %s, temps annoncé %s, recalculé %s" % (c[0], c[1], c[col], attendu))
                nb += 1
            info.append("plan.md: %d distances et %d temps relus et recalculés" % (nb, 2 * nb))
    info.append("%d noeuds, %d arêtes, %d bâtiments, %d eaux, %d ouvrages, %d verrous, %d points d'intérêt" % (
        len(N), len(d['aretes']), len(bats), len(d['eaux']) + len(d['plans_eau']), len(ouvr), len(d['verrous']), len(d['points_interet'])))
    return err, info


# ================================================================ ordre réel de l'histoire, sur la grille du lieu
LIEU = os.path.normpath(os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'donnees', 'lieux', 'aubrune'))
PART_OUVERTE = 0.5   # `PLACES.zoneOpenShare` du jeu: une zone est ouverte quand on en rejoint la moitié des cases libres


def gid(s):
    return s.replace('_', '-').lower()


def lire_fiches(lieu=LIEU):
    """Suites, chapitres et étapes du lieu, dans l'ordre de leurs `requires`; scènes par identifiant."""
    suites = {}
    for f in sorted(os.listdir(os.path.join(lieu, 'quetes'))):
        if f.endswith('.json'):
            q = json.load(open(os.path.join(lieu, 'quetes', f), encoding='utf-8'))
            suites[q['id']] = q
    scenes = {}
    for f in sorted(os.listdir(os.path.join(lieu, 'scenes'))):
        if f.endswith('.json'):
            s = json.load(open(os.path.join(lieu, 'scenes', f), encoding='utf-8'))
            scenes[s['id']] = s
    return suites, scenes


def effets_de(o, out):
    """Verrous (fait `<lieu>.verrou.<id>` retenu à vrai) et zones (`unlock_zone`) posés n'importe où dans o."""
    if isinstance(o, dict):
        if o.get('type') == 'remember' and isinstance(o.get('key'), str) and '.verrou.' in o['key'] and o.get('value') is True:
            out['verrous'].add(o['key'].split('.verrou.')[1])
        if o.get('type') == 'unlock_zone':
            out['zones'].add(o['zone'])
        for v in o.values():
            effets_de(v, out)
    elif isinstance(o, list):
        for v in o:
            effets_de(v, out)
    return out


def etapes_ordonnees(suites, scenes):
    """Chaque étape: ses ancêtres (règles de `quetes/moteur.ts`: `after`, sinon l'étape d'avant; chapitres et
    suites l'un après l'autre), ses effets (fiche et scènes qu'elle joue ou attend), ses cibles (points)."""
    ordre, vus = [], set()
    while len(ordre) < len(suites):
        for qid, q in suites.items():
            req = [r['quest'] for r in q.get('requires', []) if r.get('type') == 'quest_step' and r.get('quest') in suites]
            if qid not in vus and all(r in vus for r in req):
                ordre.append(qid); vus.add(qid)
                break
        else:
            raise ValueError('suites en cercle: %s' % sorted(set(suites) - vus))
    etapes, avant_tout = {}, set()
    for qid in ordre:
        q = suites[qid]
        for ch in q['chapters']:
            ids = ['%s/%s' % (qid, s['id']) for s in ch['steps']]
            for i, s in enumerate(ch['steps']):
                if 'after' in s:
                    pre = ['%s/%s' % (qid, a) for a in s['after']]
                else:
                    pre = [ids[i - 1]] if i > 0 else []
                eff = effets_de(s.get('onDone', []), dict(verrous=set(), zones=set()))
                for c in s.get('done', []) + s.get('onStart', []):
                    sc = c.get('scene')
                    if sc in scenes and c.get('type') in ('scene_seen', 'play_scene'):
                        effets_de(scenes[sc], eff)
                cibles = set()
                if isinstance(s.get('target'), dict) and s['target'].get('point'):
                    cibles.add(s['target']['point'])
                cibles |= {c['point'] for c in s.get('done', []) if c.get('type') == 'reach' and c.get('point')}
                etapes[ids[i]] = dict(pre=set(pre), base=set(avant_tout), eff=eff, cibles=cibles)
            avant_tout |= set(ids)
    # ancêtres transitifs
    memo = {}

    def anc(k):
        if k not in memo:
            memo[k] = set()
            for p in etapes[k]['pre'] | etapes[k]['base']:
                memo[k] |= {p} | anc(p)
        return memo[k]
    for k in etapes:
        etapes[k]['anc'] = anc(k)
    return ordre, etapes


class Grille:
    """La grille du lieu telle que le jeu la lit: murs (`blocked`), verrous fermés, zones (la première l'emporte)."""
    def __init__(self, carte):
        from collections import deque
        self.deque = deque
        self.c = carte
        self.W, self.H = carte['width'], carte['height']
        W, H = self.W, self.H
        self.base = bytearray(W * H)
        for r in carte['blocked']:
            x0, x1 = max(0, r['x']), min(W, r['x'] + r['w'])
            for y in range(max(0, r['y']), min(H, r['y'] + r['h'])):
                self.base[y * W + x0: y * W + x1] = b'\x01' * (x1 - x0)
        self.ids = list(carte.get('zones', {}))
        self.zone_of = bytearray(W * H)
        for k, zid in enumerate(self.ids):
            poly = carte['zones'][zid]['polygon']
            x0, x1 = max(0, int(min(p[0] for p in poly))), min(W, int(max(p[0] for p in poly)) + 1)
            y0, y1 = max(0, int(min(p[1] for p in poly))), min(H, int(max(p[1] for p in poly)) + 1)
            for y in range(y0, y1):
                for x in range(x0, x1):
                    if self.zone_of[y * W + x] == 0 and dans(poly, x + 0.5, y + 0.5):
                        self.zone_of[y * W + x] = k + 1
        self.cache = {}

    def atteint(self, ouverts):
        cle = frozenset(ouverts)
        if cle in self.cache:
            return self.cache[cle]
        W, H = self.W, self.H
        mur = bytearray(self.base)
        for lk, l in self.c['locks'].items():
            if lk in ouverts:
                continue
            for r in l['rects']:
                for y in range(max(0, r['y']), min(H, r['y'] + r['h'])):
                    for x in range(max(0, r['x']), min(W, r['x'] + r['w'])):
                        mur[y * W + x] = 1
        a = self.c['points']['quai']
        s = int(a['y']) * W + int(a['x'])
        vu = bytearray(W * H); vu[s] = 1
        file = self.deque([s])
        while file:
            i = file.popleft(); x = i % W
            for j in ((i + 1) if x < W - 1 else -1, (i - 1) if x > 0 else -1, i + W, i - W):
                if 0 <= j < W * H and not vu[j] and not mur[j]:
                    vu[j] = 1; file.append(j)
        part = {}
        cells = [0] * len(self.ids); got = [0] * len(self.ids)
        for i in range(W * H):
            z = self.zone_of[i]
            if z == 0 or self.base[i]:
                continue
            cells[z - 1] += 1
            if vu[i] and not mur[i]:
                got[z - 1] += 1
        for k, zid in enumerate(self.ids):
            part[zid] = got[k] / cells[k] if cells[k] else 0.0
        self.cache[cle] = (vu, part)
        return vu, part

    def touche(self, vu, x, y):
        return bool(vu[int(y) * self.W + int(x)])


def etats_histoire(lus):
    """Tous les ensembles d'étapes à verrous que les fiches permettent (fermés vers le bas: si une étape est
    franchie, ses ancêtres le sont aussi), dans tous les ordres des fils parallèles."""
    cles = sorted(lus)
    etats = set()

    def etendre(courant, reste):
        etats.add(frozenset(courant))
        for k in reste:
            if lus[k]['anc'] & set(cles) <= courant:
                etendre(courant | {k}, [r for r in reste if r != k])
    etendre(frozenset(), cles)
    return etats


def controler_histoire(d, carte, fiches):
    """Pour chaque état de l'histoire (ensemble d'étapes à verrous franchies, dans tous les ordres que les fiches
    permettent): chaque zone que l'histoire a ouverte l'est sur la grille (la moitié de ses cases au moins), aucune
    autre ne l'est, rien d'une zone fermée n'est atteint hors de son antichambre déclarée, la grille et le graphe du
    plan disent la même chose nœud par nœud, et la cible de chaque étape est atteignable quand elle s'ouvre."""
    err, info = [], []
    suites, scenes = fiches
    _, etapes = etapes_ordonnees(suites, scenes)
    G = Grille(carte)
    N = d['noeuds']
    zone_jeu = {gid(k): k for k in d['zones']}
    verrou_jeu = {gid(k): k for k in d['verrous']}
    noeud_jeu = {gid(k): k for k in N}
    # 1. ordre annoncé par le plan = ordre lu dans les fiches
    lus = {k: e for k, e in etapes.items() if e['eff']['verrous'] or e['eff']['zones']}
    annonce = {o['etape']: o for o in d.get('ordre_histoire', [])}
    for k, e in lus.items():
        o = annonce.get(k)
        vs = sorted(verrou_jeu.get(v, v) for v in e['eff']['verrous'])
        zs = sorted(zone_jeu.get(z, z) for z in e['eff']['zones'])
        if o is None:
            err.append("ordre de l'histoire: l'étape %s lève %s et ouvre %s, absente du plan" % (k, vs, zs))
        elif sorted(o['verrous']) != vs or sorted(o['zones']) != zs:
            err.append("ordre de l'histoire: %s lève %s et ouvre %s dans les fiches, le plan annonce %s et %s" % (k, vs, zs, sorted(o['verrous']), sorted(o['zones'])))
    for k in annonce:
        if k not in lus:
            err.append("ordre de l'histoire: le plan annonce %s, qui ne lève rien dans les fiches" % k)
    for v in d['verrous']:
        if not any(gid(v) in e['eff']['verrous'] for e in lus.values()):
            err.append("ordre de l'histoire: aucune étape ne lève %s" % v)
    # 2. états: ensembles d'étapes à verrous fermés vers le bas (si une étape est franchie, ses ancêtres aussi)
    etats = etats_histoire(lus)
    actes = {gid(k): z['acte'] for k, z in d['zones'].items()}
    anti = {gid(k): set(v['noeuds']) for k, v in d.get('antichambres', {}).items()}

    def graphe_atteint(ouverts):
        adj = {k: [] for k in N}
        for a in d['aretes']:
            if a.get('verrou') and gid(a['verrou']) not in ouverts:
                continue
            adj[a['a']].append(a['b']); adj[a['b']].append(a['a'])
        vus, pile = {'quai'}, ['quai']
        while pile:
            u = pile.pop()
            for w in adj[u]:
                if w not in vus:
                    vus.add(w); pile.append(w)
        return vus
    for etat in sorted(etats, key=lambda s: (len(s), sorted(s))):
        ouverts = set().union(*[lus[k]['eff']['verrous'] for k in etat]) if etat else set()
        zones = set().union(*[lus[k]['eff']['zones'] for k in etat]) if etat else set()
        vu, part = G.atteint(ouverts)
        gr = graphe_atteint(ouverts)
        nom = '+'.join(k.split('/')[1] for k in sorted(etat, key=lambda s: len(lus[s]['anc']))) or 'début'
        for z, p in part.items():
            ouverte_histoire = actes.get(z, 1) == 1 or z in zones
            if ouverte_histoire and p < PART_OUVERTE:
                err.append("état %s: l'histoire a ouvert la zone %s, on n'en rejoint que %.0f %%" % (nom, z, 100 * p))
            if not ouverte_histoire and p >= PART_OUVERTE:
                err.append("état %s: la zone %s est ouverte (%.0f %%) avant l'étape qui l'ouvre" % (nom, z, 100 * p))
        for k, nn in N.items():
            g_ = G.touche(vu, nn['x'], nn['y'])
            if g_ and k not in gr:
                err.append("état %s: le nœud %s (zone %s) est atteint à pied, le graphe le dit fermé: un verrou se contourne" % (nom, k, nn['zone']))
            elif k in gr and not g_:
                err.append("état %s: le nœud %s est ouvert dans le graphe mais pas sur la grille" % (nom, k))
            z = gid(nn['zone'])
            if g_ and actes.get(z, 1) > 1 and z not in zones and k not in anti.get(z, set()):
                err.append("état %s: le nœud %s de la zone %s est atteint avant l'étape qui l'ouvre (hors antichambre)" % (nom, k, z))
        info.append("histoire, état %s: verrous %s; zones %s" % (nom, ','.join(sorted(ouverts)) or '-', ' '.join('%s %.0f%%' % (z, 100 * p) for z, p in part.items())))
    # 3. la cible de chaque étape, quand elle s'ouvre (ses ancêtres franchis, pas plus)
    points_des_pieces = {k for s in lire_interieurs() for k in s.get('points', {})}
    nb = 0
    for k, e in etapes.items():
        ouverts = set().union(*[etapes[a]['eff']['verrous'] for a in e['anc']]) if e['anc'] else set()
        vu, _ = G.atteint(ouverts)
        for c in e['cibles']:
            if c in noeud_jeu:
                nn = N[noeud_jeu[c]]
            elif c in carte['points']:
                nn = carte['points'][c]
                if nn['y'] >= d['taille']['hauteur']:
                    continue  # point d'un intérieur: atteint par sa porte
            elif c in points_des_pieces:
                continue  # point d'un intérieur (fichier de la pièce): la règle d'accès le suit, porte comprise
            else:
                err.append("étape %s: point %s inconnu de la carte" % (k, c)); continue
            nb += 1
            if not G.touche(vu, nn['x'], nn['y']):
                err.append("étape %s: sa cible %s n'est pas atteignable quand l'étape s'ouvre (verrous ouverts: %s)" % (k, c, ','.join(sorted(ouverts)) or '-'))
    info.append("histoire: %d étapes lues, %d lèvent un verrou ou ouvrent une zone, %d états contrôlés, %d cibles atteignables à leur ouverture" % (
        len(etapes), len(lus), len(etats), nb))
    return err, info


# ================================================================ règle d'accès: tout ce que l'histoire utilise s'atteint à pied
VOISINS = ((1, 0), (-1, 0), (0, 1), (0, -1))
CAP = ((0, 1), (1, 0), (0, -1), (-1, 0))   # `facing` d'une porte: 0 sud, 1 est, 2 nord, 3 ouest
ARRIVEE = 1.0                               # `PLACES.arriveOffset`: on arrive à 1 m devant la porte jumelle
RAYON_LIBRE = 8                             # `movement.freeCellRadius` de `reglages.json`


def lire_meubles(lieu=LIEU):
    dossier = os.path.join(lieu, '..', '..', 'commun', 'meubles')
    types = {}
    for f in os.listdir(dossier):
        if f.endswith('.json'):
            m = json.load(open(os.path.join(dossier, f), encoding='utf-8'))
            types[f[:-5]] = dict(w=m['size']['w'], h=m['size']['h'], solide=m.get('solid', False),
                                 briques=[b['brick'] for b in m.get('bricks', [])])
    return types


def lire_interieurs(lieu=LIEU):
    dossier = os.path.join(lieu, 'interieurs')
    return [json.load(open(os.path.join(dossier, f), encoding='utf-8')) for f in sorted(os.listdir(dossier)) if f.endswith('.json')]


def points_cites(lieu=LIEU):
    """Points nommés par une quête, une scène, un planning d'habitant ou la fiche du lieu: toute chaîne des fiches."""
    vus = set()

    def lire(o):
        if isinstance(o, str):
            vus.add(o)
        elif isinstance(o, dict):
            for v in o.values():
                lire(v)
        elif isinstance(o, list):
            for v in o:
                lire(v)
    for sous in ('quetes', 'scenes', 'habitants'):
        for f in sorted(os.listdir(os.path.join(lieu, sous))):
            if f.endswith('.json'):
                lire(json.load(open(os.path.join(lieu, sous, f), encoding='utf-8')))
    lire(json.load(open(os.path.join(lieu, 'lieu.json'), encoding='utf-8')))
    return vus


class Lieu:
    """Le lieu tel que le jeu le charge (`withInteriors`): le dehors, les intérieurs posés dans l'annexe et entourés
    d'un mur, leurs cloisons, les meubles solides (sauf l'obstacle d'un verrou et la porte battante), les portes.
    Marcher sur une porte fait passer à sa jumelle (1 m devant elle): la case d'une porte ne se traverse pas."""

    def __init__(self, carte, interieurs, types):
        self.c, self.types = carte, types
        W, H = self.W, self.H = carte['width'], carte['height']
        self.base = bytearray(W * H)

        def remplir(x0, y0, w, h):
            for y in range(max(0, y0), min(H, y0 + h)):
                for x in range(max(0, x0), min(W, x0 + w)):
                    self.base[y * W + x] = 1
        for r in carte['blocked']:
            remplir(r['x'], r['y'], r['w'], r['h'])
        self.salles = {}
        objets = [dict(o, salle=None) for o in carte['objects']]
        self.portes = {k: dict(p, salle=None) for k, p in carte.get('doors', {}).items()}
        self.points = {k: dict(p, salle=None) for k, p in carte['points'].items()}
        for s in interieurs:
            ax, ay, w, h = s['at']['x'], s['at']['y'], s['width'], s['height']
            self.salles[s['id']] = (ax, ay, w, h)
            remplir(ax - 1, ay - 1, w + 2, 1); remplir(ax - 1, ay + h, w + 2, 1)
            remplir(ax - 1, ay, 1, h); remplir(ax + w, ay, 1, h)
            for r in s['blocked']:
                remplir(ax + r['x'], ay + r['y'], r['w'], r['h'])
            objets += [dict(o, x=o['x'] + ax, y=o['y'] + ay, salle=s['id']) for o in s['objects']]
            self.portes.update({k: dict(p, x=p['x'] + ax, y=p['y'] + ay, salle=s['id']) for k, p in s.get('doors', {}).items()})
            self.points.update({k: dict(x=p['x'] + ax, y=p['y'] + ay, salle=s['id']) for k, p in s['points'].items()})
        obstacles_verrou = {l.get('object') for l in carte.get('locks', {}).values()}
        self.objets = []
        for o in objets:
            t = types.get(o['type'])
            if t is None:
                continue
            w, h = (t['w'], t['h']) if o['rotation'] % 2 == 0 else (t['h'], t['w'])
            x0, x1 = math.floor(o['x'] - w / 2 + 1e-6), math.floor(o['x'] + w / 2 - 1e-6)
            y0, y1 = math.floor(o['y'] - h / 2 + 1e-6), math.floor(o['y'] + h / 2 - 1e-6)
            cases = [(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
            if t['solide'] and o['id'] not in obstacles_verrou and 'open' not in t['briques']:
                for x, y in cases:
                    if 0 <= x < W and 0 <= y < H:
                        self.base[y * W + x] = 1
            self.objets.append(dict(o, cases=cases, solide=t['solide'], briques=t['briques']))
        # Cases d'où l'on touche une porte (la sienne et ses quatre voisines) et case d'arrivée de chaque porte.
        self.case_porte = {}
        self.touche_porte = {}
        for k, p in self.portes.items():
            cx, cy = int(p['x']), int(p['y'])
            self.case_porte[cy * W + cx] = k
            for dx, dy in ((0, 0),) + VOISINS:
                self.touche_porte.setdefault((cy + dy) * W + cx + dx, []).append(k)
        self.cache = {}

    def salle_de(self, x, y):
        for k, (ax, ay, w, h) in self.salles.items():
            if ax <= x < ax + w and ay <= y < ay + h:
                return k
        return None

    def libre(self, mur, i):
        return not mur[i] and i not in self.case_porte

    def arrivee(self, mur, porte):
        p = self.portes[porte]
        fx, fy = CAP[p['facing']]
        x, y = int(p['x']) + 0.5 + fx * ARRIVEE, int(p['y']) + 0.5 + fy * ARRIVEE
        tx, ty = int(x), int(y)
        for r in range(RAYON_LIBRE + 1):
            best = None
            for cy in range(ty - r, ty + r + 1):
                for cx in range(tx - r, tx + r + 1):
                    if max(abs(cx - tx), abs(cy - ty)) != r or not (0 <= cx < self.W and 0 <= cy < self.H):
                        continue
                    if self.libre(mur, cy * self.W + cx):
                        dd = math.hypot(cx + 0.5 - x, cy + 0.5 - y)
                        if best is None or dd < best[0] - 1e-9:
                            best = (dd, cy * self.W + cx)
            if best:
                return best[1]
        return None

    def atteint(self, ouverts):
        """Cases rejointes à pied depuis l'arrivée du lieu (quai), verrous `ouverts` levés, portes franchies."""
        cle = frozenset(ouverts)
        if cle in self.cache:
            return self.cache[cle]
        W, H = self.W, self.H
        mur = bytearray(self.base)
        for lk, l in self.c.get('locks', {}).items():
            if lk not in ouverts:
                for r in l['rects']:
                    for y in range(max(0, r['y']), min(H, r['y'] + r['h'])):
                        for x in range(max(0, r['x']), min(W, r['x'] + r['w'])):
                            mur[y * W + x] = 1
        a = self.c['points']['quai']
        s = int(a['y']) * W + int(a['x'])
        vu = bytearray(W * H)
        vu[s] = 1
        file, portes_vues = [s], set()
        for i in file:
            x = i % W
            for k in self.touche_porte.get(i, ()):
                if k not in portes_vues:
                    portes_vues.add(k)
                    j = self.arrivee(mur, self.portes[k]['to'])
                    if j is not None and not vu[j]:
                        vu[j] = 1; file.append(j)
            for dx, dy in VOISINS:
                if 0 <= x + dx < W:
                    j = i + dy * W + dx
                    if 0 <= j < W * H and not vu[j] and self.libre(mur, j):
                        vu[j] = 1; file.append(j)
        self.cache[cle] = (vu, portes_vues)
        return vu, portes_vues

    def elements(self, cites):
        """Ce que l'histoire et la vie du lieu utilisent: portes et escaliers, meubles à brique (lit, siège, coffre,
        comptoir, réchaud, établi, poulailler...), points cités par les fiches et tous les points des intérieurs.
        Chacun: (libellé, salle, x, y, cases d'où on l'atteint)."""
        W = self.W
        out = []

        def autour(cases, dedans):
            r = set(cases) if dedans else set()
            for x, y in cases:
                r |= {(x + dx, y + dy) for dx, dy in VOISINS}
            return {y * W + x for x, y in r if 0 <= x < W and 0 <= y < self.H}
        for k, p in sorted(self.portes.items()):
            out.append(('porte « %s »' % k, p['salle'], p['x'], p['y'], None, k))
        for o in self.objets:
            if o['briques']:
                out.append(('meuble « %s » (%s, %s)' % (o['id'], o['type'], '/'.join(o['briques'])), o['salle'], o['x'], o['y'],
                            autour(o['cases'], not o['solide']), None))
        for k, p in sorted(self.points.items()):
            if k in cites or p['salle'] is not None:
                c = (int(p['x']), int(p['y']))
                out.append(('point « %s »' % k, p['salle'], p['x'], p['y'], autour([c], True), None))
        return out


def lits_d_habitants(d):
    """Lits que le plan donne à un habitant (point « lit » avec un « qui », posé sur le lit ou à côté): les joueurs
    n'y vont pas à deux, la règle des 2 m ne s'y applique pas."""
    prives = set()
    for it in d['interieurs']:
        for q in it['points']:
            if q['role'] == 'lit' and q['qui']:
                lits = [m for m in it['meubles'] if m['type'] and m['type'].startswith('lit')]
                if lits:
                    prives.add(min(lits, key=lambda m: math.hypot(m['x'] - q['x'], m['y'] - q['y']))['id'])
    return prives


def controler_gabarit_interieurs(L, prives=frozenset()):
    """Dans les intérieurs: on arrive de chaque porte et de chaque escalier dans la salle qu'il dessert, sur une case
    libre; aucun meuble n'est posé à cheval sur des cases (son emprise = sa taille); de l'arrivée de chaque salle à
    chaque escalier et à chaque lit des joueurs, un passage de 2 m (deux joueurs s'y croisent: corps de 0,6 m qui se
    repoussent)."""
    err = []
    W = L.W
    mur = bytearray(L.base)
    for k, p in sorted(L.portes.items()):
        jumelle = L.portes[p['to']]
        j = L.arrivee(mur, p['to'])
        ou = L.salle_de(j % W, j // W) if j is not None else '?'
        if j is None or ou != jumelle['salle']:
            err.append("porte « %s »: on arrive par « %s » hors de %s (case %s)" % (
                k, p['to'], ('« %s »' % jumelle['salle']) if jumelle['salle'] else 'du dehors', 'aucune' if j is None else '%d, %d' % (j % W, j // W)))
    for o in L.objets:
        t = L.types[o['type']]
        w, h = (t['w'], t['h']) if o['rotation'] % 2 == 0 else (t['h'], t['w'])
        # Un objet posé sur un meuble (`on`) ne bloque rien: il se place où le plateau le porte.
        if o['salle'] and len(o['cases']) != w * h and o.get('on') is None:
            ax, ay = L.salles[o['salle']][:2]
            err.append("meuble « %s » (%s, %d x %d) dans « %s »: posé à cheval (%g; %g), il bloque %d cases" % (
                o['id'], o['type'], w, h, o['salle'], o['x'] - ax, o['y'] - ay, len(o['cases'])))
    # Passage de 2 m: chemin de blocs 2 x 2 libres (coin nord-ouest du bloc), depuis l'arrivée de chaque porte d'une salle.
    # Un bloc passe aussi en diagonale: entre deux coins de meubles opposés, il reste 1,41 m, où deux corps de 0,6 m
    # passent de front.
    libre = lambda x, y: 0 <= x < W and 0 <= y < L.H and L.libre(mur, y * W + x)
    bloc = lambda x, y: libre(x, y) and libre(x + 1, y) and libre(x, y + 1) and libre(x + 1, y + 1)
    pas_bloc = VOISINS + ((1, 1), (1, -1), (-1, 1), (-1, -1))
    for s, (ax, ay, w, h) in sorted(L.salles.items()):
        departs = [L.arrivee(mur, k) for k, p in L.portes.items() if p['salle'] == s]
        cibles = [('escalier « %s »' % k, [(int(p['x']), int(p['y']))]) for k, p in L.portes.items() if p['salle'] == s and L.portes[p['to']]['salle']]
        cibles += [('lit « %s »' % o['id'], o['cases']) for o in L.objets if o['salle'] == s and 'sleep' in o['briques'] and o['id'] not in prives]
        for j in departs:
            if j is None:
                continue
            jx, jy = j % W, j // W
            vus = {(x, y) for x in (jx - 1, jx) for y in (jy - 1, jy) if bloc(x, y)}
            file = list(vus)
            for x, y in file:
                for dx, dy in pas_bloc:
                    if (x + dx, y + dy) not in vus and bloc(x + dx, y + dy):
                        vus.add((x + dx, y + dy)); file.append((x + dx, y + dy))
            couvert = {(x + i, y + k) for x, y in vus for i in (0, 1) for k in (0, 1)}
            for nom, cases in cibles:
                bord = {(x + dx, y + dy) for x, y in cases for dx, dy in VOISINS} - set(cases)
                # Arriver au pied même de la cible (lit près de la porte) dispense du passage.
                if not bord & couvert and (jx, jy) not in bord:
                    err.append("salle « %s »: pas de passage de 2 m de l'arrivée (%d; %d) jusqu'au %s" % (s, jx - ax, jy - ay, nom))
    return sorted(set(err))


def tient(conds, faits):
    """Une liste de conditions (`when`) tient-elle avec ces faits retenus ({clé: True} ou {clé: valeur})? Seuls les
    faits (`remembered`) et leurs combinaisons sont lus; toute autre condition (heure, agenda...) compte comme vraie."""
    def une(c):
        t = c['type']
        if t == 'remembered':
            v = faits.get(c['key'])
            return bool(v) if 'equals' not in c else v == c['equals']
        if t == 'not':
            return not une(c['condition'])
        if t == 'all':
            return all(une(x) for x in c['conditions'])
        if t == 'any':
            return any(une(x) for x in c['conditions'])
        return True
    return all(une(c) for c in conds)


def gabarit_par_etat(carte, interieurs, types, prives):
    """Gabarit des intérieurs (`controler_gabarit_interieurs`) dans chaque combinaison des faits que citent les meubles
    conditionnés des intérieurs: deux meubles qui ne se montrent jamais ensemble (l'ardoise du chantier de la cuisine,
    puis le plan de travail qui la remplace) ne se comptent plus comme posés à la fois. Faits à valeur: une valeur
    citée, ou aucune."""
    def cles(c, out):
        if c['type'] == 'remembered':
            out.setdefault(c['key'], set()).add(c.get('equals', True))
        for x in [c.get('condition')] + c.get('conditions', []):
            if x:
                cles(x, out)
    cites = {}
    for it in interieurs:
        for o in it['objects']:
            for c in o.get('when', []):
                cles(c, cites)
    noms = sorted(cites)
    choix = [sorted(cites[k], key=str) + [None] for k in noms]
    err = set()
    for combi in __import__('itertools').product(*choix):
        faits = {k: v for k, v in zip(noms, combi) if v is not None}
        filtres = [dict(it, objects=[o for o in it['objects'] if tient(o.get('when', []), faits)]) for it in interieurs]
        err.update(controler_gabarit_interieurs(Lieu(carte, filtres, types), prives))
    return sorted(err)


def controler_acces(d, carte, fiches, interieurs=None, types=None, lieu=LIEU):
    """Règle d'accès: dans chaque état de l'histoire, tout élément que le graphe du plan dit ouvert (le nœud le plus
    proche, dans la même salle ou dehors, est atteint par le graphe) s'atteint à pied sur la grille, portes et escaliers
    compris; tous verrous levés, tout s'atteint. Renvoie les erreurs (une par élément, au premier état fautif)."""
    err, info = [], []
    suites, scenes = fiches
    _, etapes = etapes_ordonnees(suites, scenes)
    lus = {k: e for k, e in etapes.items() if e['eff']['verrous'] or e['eff']['zones']}
    etats = sorted(etats_histoire(lus), key=lambda s: (len(s), sorted(s)))
    L = Lieu(carte, lire_interieurs(lieu) if interieurs is None else interieurs, lire_meubles(lieu) if types is None else types)
    noeuds = carte['graph']['nodes']
    salle_noeud = {k: L.salle_de(n['x'], n['y']) for k, n in noeuds.items()}
    tous = set(carte.get('locks', {}))
    elts = L.elements(points_cites(lieu))

    def noeud_proche(salle, x, y):
        cands = [(math.hypot(n['x'] - x, n['y'] - y), k) for k, n in noeuds.items() if salle_noeud[k] == salle]
        return min(cands)[1] if cands else None

    def graphe_atteint(ouverts):
        adj = {k: [] for k in noeuds}
        for a in carte['graph']['edges']:
            if a.get('lock') is None or a['lock'] in ouverts:
                adj[a['a']].append(a['b']); adj[a['b']].append(a['a'])
        vus, pile = {'quai'}, ['quai']
        while pile:
            for w in adj[pile.pop()]:
                if w not in vus:
                    vus.add(w); pile.append(w)
        return vus
    proches = [noeud_proche(e[1], e[2], e[3]) for e in elts]
    fautifs = {}
    liste = [(('+'.join(k.split('/')[1] for k in sorted(s, key=lambda s_: len(lus[s_]['anc']))) or 'début'),
              set().union(*[lus[k]['eff']['verrous'] for k in s]) if s else set()) for s in etats]
    liste.append(('tous verrous levés', tous))
    for nom, ouverts in liste:
        vu, portes_vues = L.atteint(ouverts)
        gr = graphe_atteint(ouverts) if nom != 'tous verrous levés' else set(noeuds)
        for (lib, salle, x, y, cases, porte), n in zip(elts, proches):
            if lib in fautifs or (n is not None and n not in gr):
                continue
            ok = porte in portes_vues if porte else any(vu[i] for i in cases)
            if not ok:
                fautifs[lib] = "accès, état %s: %s, %s (%g; %g), n'est pas atteignable à pied depuis le quai" % (
                    nom, lib, ('dans « %s »' % salle) if salle else 'dehors', x - (L.salles[salle][0] if salle else 0), y - (L.salles[salle][1] if salle else 0))
    err += list(fautifs.values())
    err += gabarit_par_etat(carte, lire_interieurs(lieu) if interieurs is None else interieurs,
                            lire_meubles(lieu) if types is None else types, lits_d_habitants(d))
    info.append("accès: %d éléments (portes, escaliers, meubles à brique, points cités) dans %d intérieurs et le dehors, %d états; %d inaccessibles" % (
        len(elts), len(L.salles), len(liste), len(fautifs)))
    return err, info


CIRCULATION = ('route', 'rue', 'chemin', 'sentier')
BARRENT = ('lisse-fleurie',)        # types qui barrent une route par nature (contournés par l'accotement)
RECUL_POSTE = 1.0                   # m entre un poste d'habitant de la fête et un objet solide de son décor
PORTEE_LAMPES, LAMPES_MAX = 26.0, 6  # `INK_SETTINGS.lights.reach` et `MAX_LAMPS` (src/rendu/encre)


def evenements_cites(conds):
    out = set()

    def lire(o):
        if isinstance(o, dict):
            if o.get('type') == 'event_is':
                out.update(o['events'])
            for v in o.values():
                lire(v)
        elif isinstance(o, list):
            for v in o:
                lire(v)
    lire(conds)
    return out


def postes_de_fete(lieu=LIEU):
    """Points tenus par les habitants pendant chaque événement: {événement: {point: [habitants]}} (sièges exclus)."""
    out = {}
    for f in sorted(os.listdir(os.path.join(lieu, 'habitants'))):
        h = json.load(open(os.path.join(lieu, 'habitants', f), encoding='utf-8'))
        for s in h['life']['schedule']:
            pt = s['at'].get('point')
            for ev in evenements_cites(s.get('when', [])):
                if pt:
                    out.setdefault(ev, {}).setdefault(pt, []).append(h['id'])
    return out


def lampe_de(o, F):
    """(x, y) du foyer d'un objet posé dont le modèle déclare sa lumière, ou None."""
    lum = manifeste().get(F[o['type']]['model'], {}).get('light')
    if lum is None:
        return None
    a = o['rotation'] * math.pi / 2
    gx, gz = lum['at'][0], lum['at'][2]
    return (o['x'] + gx * math.cos(a) + gz * math.sin(a), o['y'] - gx * math.sin(a) + gz * math.cos(a))


def controler_fetes(d, carte, lieu=LIEU):
    """Décor des fêtes (objets à `when`): conditions qui citent des événements du lieu; rien sur la voie, sur les deux
    rangées du bord du quai, sur un point, un nœud, une porte ou les deux cases devant elle; rien de solide sur une
    route, une rue, un chemin ou un sentier (sauf ce qui barre par nature, contournable par ses deux bouts), ni à moins
    de 1 m d'un poste d'habitant de la fête; chaque fête, son décor posé et celui des autres absent, laisse tous ses
    postes atteignables depuis le quai. Compte aussi les lampes que chaque fête ajoute (info)."""
    err, info = [], []
    F = fiches_meubles()
    evs = {f[:-5] for f in os.listdir(os.path.join(lieu, 'evenements')) if f.endswith('.json')}
    W = carte['width']
    leg = carte['terrain']['legend']
    codes = []
    for c, k in zip(carte['terrain']['runs'][0::2], carte['terrain']['runs'][1::2]):
        codes += [c] * k
    nature = lambda x, y: leg[codes[y * W + x]] if 0 <= x < W and 0 <= y < carte['height'] else 'hors-jeu'
    quai = next(b for b in d['batiments'] if b['id'] == 'quai_b')
    qx, qy, ql, qh = quai['rect']
    bord_quai = lambda x, y: qx <= x < qx + ql and qy <= y < qy + 2
    sur_quai = lambda x, y: qx <= x < qx + ql and qy <= y < qy + qh
    interdits = {}
    for k, p in carte['points'].items():
        interdits[(int(p['x']), int(p['y']))] = 'le point « %s »' % k
    for k, n in carte['graph']['nodes'].items():
        if n['y'] < carte['height'] - 48:
            interdits.setdefault((int(n['x']), int(n['y'])), 'le nœud « %s »' % k)
    for k, p in carte.get('doors', {}).items():
        fx, fy = CAP[p['facing']]
        for i in range(3):
            interdits.setdefault((int(p['x']) + i * fx, int(p['y']) + i * fy), 'la porte « %s » (ou les deux cases devant)' % k)
    postes = postes_de_fete(lieu)
    fetes = [o for o in carte['objects'] if 'when' in o]
    for o in fetes:
        nom = "décor de fête %s (%s)" % (o['id'], o['type'])
        cites = evenements_cites(o['when'])
        if not cites:
            err.append("%s: sa condition ne cite aucun événement" % nom)
        for e_ in sorted(cites - evs):
            err.append("%s: l'événement « %s » n'existe pas" % (nom, e_))
        cases = emprise_type(o, F)
        solide = F[o['type']].get('solid', False)
        for x, y in cases:
            n_ = nature(x, y)
            # Au passage à niveau, la voie croise la route: le sol y est `route`, les rails y passent quand même.
            if n_ not in ('eau', 'batiment', 'hors-jeu') and any(
                    not r.get('tunnel') and dist_poly((x + 0.5, y + 0.5), r['points']) < 1.6 for r in carte.get('rails', [])):
                n_ = 'voie'
            if n_ in ('voie', 'eau', 'batiment', 'hors-jeu'):
                err.append("%s: posé sur %s (case %d, %d)" % (nom, n_, x, y))
            if bord_quai(x, y):
                err.append("%s: sur le bord du quai, où le train ouvre ses portes (case %d, %d)" % (nom, x, y))
            if (x, y) in interdits:
                err.append("%s: posé sur %s (case %d, %d)" % (nom, interdits[(x, y)], x, y))
            if solide and n_ in CIRCULATION and o['type'] not in BARRENT and not sur_quai(x, y):
                err.append("%s: solide sur une %s (case %d, %d): il barre le passage" % (nom, n_, x, y))
        if solide and o['type'] in BARRENT:
            xs, ys = [c[0] for c in cases], [c[1] for c in cases]
            bouts = [(min(xs) - 1, ys[0]), (max(xs) + 1, ys[0])] if len(set(ys)) == 1 else [(xs[0], min(ys) - 1), (xs[0], max(ys) + 1)]
            if not all(nature(*b) not in ('voie', 'eau', 'batiment', 'hors-jeu') for b in bouts):
                err.append("%s: barre sans accotement libre à ses deux bouts" % nom)
        if solide:
            x0, y0 = min(c[0] for c in cases), min(c[1] for c in cases)
            x1, y1 = max(c[0] for c in cases) + 1, max(c[1] for c in cases) + 1
            for ev in cites:
                for pt in postes.get(ev, {}):
                    p = carte['points'].get(pt)
                    if p is None:
                        continue
                    dd = math.hypot(max(x0 - p['x'], 0, p['x'] - x1), max(y0 - p['y'], 0, p['y'] - y1))
                    # Ce qui barre se manœuvre: le garde se tient contre sa lisse (corps de 0,3 m, écart de 0,1 m).
                    if dd < (0.4 if o['type'] in BARRENT else RECUL_POSTE):
                        err.append("%s: à %.1f m du poste « %s » (%s) pendant « %s »" % (nom, dd, pt, ', '.join(postes[ev][pt]), ev))
    # Chaque événement à décor: son décor posé, les autres absents, tous verrous levés.
    types = lire_meubles(lieu)
    interieurs = lire_interieurs(lieu)
    tous = set(carte.get('locks', {}))
    par_ev = {}
    for o in fetes:
        for ev in evenements_cites(o['when']):
            par_ev.setdefault(ev, []).append(o)
    fixes = [o for o in carte['objects'] if 'when' not in o]
    lampes_fixes = [(o['id'], lampe_de(o, F)) for o in fixes if lampe_de(o, F)]
    for ev in sorted(par_ev):
        L = Lieu(dict(carte, objects=fixes + par_ev[ev]), interieurs, types)
        vu, _ = L.atteint(tous)
        for pt, qui in sorted(postes.get(ev, {}).items()):
            p = carte['points'].get(pt)
            if p is None:
                continue
            c = (int(p['x']), int(p['y']))
            if not any(vu[(c[1] + dy) * W + c[0] + dx] for dx, dy in ((0, 0),) + VOISINS):
                err.append("fête « %s »: le poste « %s » (%s) n'est plus atteignable depuis le quai" % (ev, pt, ', '.join(qui)))
        # Lampes: le rendu en éclaire LAMPES_MAX, les plus proches du point visé, à PORTEE_LAMPES au plus.
        # Par moment de la fête (plages `time_is` de son décor: le jour et la nuit des lumignons ne coexistent pas).
        def minutes(o):
            plages = [c for c in o['when'] if c.get('type') == 'time_is']
            if not plages:
                return set(range(0, 1440, 30))
            a, b = plages[0]['from'], plages[0]['to']
            return {m for m in range(0, 1440, 30) if (a <= m < b if a <= b else (m >= a or m < b))}
        moments = sorted({frozenset(minutes(o)) for o in par_ev[ev]}, key=lambda s: (len(s), min(s)))
        vus_ensembles = set()
        for mo in moments:
            ensemble = frozenset(o['id'] for o in par_ev[ev] if minutes(o) & mo)
            if ensemble in vus_ensembles:
                continue
            vus_ensembles.add(ensemble)
            pire_f, pire_t, ou = 0, 0, '-'
            lampes = [lampe_de(o, F) for o in par_ev[ev] if lampe_de(o, F) and minutes(o) & mo]
            for pt in postes.get(ev, {}):
                p = carte['points'].get(pt)
                if p is None:
                    continue
                nf = sum(1 for x, y in lampes if math.hypot(x - p['x'], y - p['y']) <= PORTEE_LAMPES)
                nt = nf + sum(1 for _, (x, y) in lampes_fixes if math.hypot(x - p['x'], y - p['y']) <= PORTEE_LAMPES)
                if (nf, nt) > (pire_f, pire_t):
                    pire_f, pire_t, ou = nf, nt, pt
            debut = min(m for m in mo if (m - 30) % 1440 not in mo) if len(mo) < 48 else 0
            plage = '' if len(mo) == 48 else ' (à partir de %d h %02d)' % (debut // 60, debut % 60)
            info.append("fête « %s »%s: %d objets de décor, %d lampes ajoutées; au pire %d de ces lampes et %d lampes en tout à %g m d'un poste (%s), le rendu en éclaire %d" % (
                ev, plage, sum(1 for o in par_ev[ev] if minutes(o) & mo), len(lampes), pire_f, pire_t, PORTEE_LAMPES, ou, LAMPES_MAX))
    return err, info


def eprouver(d):
    def casse(nom, f, attendu):
        c = copy.deepcopy(d)
        if f not in casses_interieurs and f not in casses_fetes:
            f(c)
        if f in (ordre_faux, frenes_trop_courts, belvedere_non_declare):
            carte = json.load(open(os.path.join(LIEU, 'carte.json'), encoding='utf-8'))
            if f is frenes_trop_courts:
                carte['locks']['v2b']['rects'] = [dict(x=48, y=94, w=7, h=3)]
            err, _ = controler_histoire(c, carte, lire_fiches())
        elif f in casses_fetes:
            # Casse du décor des fêtes sur une copie de carte.json, puis `controler_fetes`.
            carte = json.load(open(os.path.join(LIEU, 'carte.json'), encoding='utf-8'))
            f(carte)
            err, _ = controler_fetes(c, carte)
        elif f in casses_interieurs:
            # Casse d'un intérieur du lieu (copie des fichiers), puis la règle d'accès.
            carte = json.load(open(os.path.join(LIEU, 'carte.json'), encoding='utf-8'))
            salles = {s['id']: s for s in lire_interieurs()}
            f(salles)
            err, _ = controler_acces(c, carte, lire_fiches(), interieurs=list(salles.values()))
        else:
            err, _ = controler(c)
        ok = any(attendu in e for e in err)
        print("  %s %s: %s" % ('vu ' if ok else 'RATÉ', nom, next((e for e in err if attendu in e), '(aucune erreur de ce type)')))
        return ok

    def ordre_faux(c):
        c['ordre_histoire'][0]['verrous'] = ['V2b']

    def frenes_trop_courts(c):
        pass

    def belvedere_non_declare(c):
        c['antichambres'] = {}

    def meuble(s, salle, i):
        return next(o for o in s[salle]['objects'] if o['id'] == i)

    def table_epicerie_sur_la_baie(s):
        # Le signalement 1: la table de la cuisine à cheval sur deux rangées, au droit de la baie.
        meuble(s, 'epicerie-rdc', 'epicerie-table').update(x=4, y=7)
        s['epicerie-rdc']['blocked'] = [dict(x=0, y=5, w=3, h=1), dict(x=4, y=5, w=3, h=1)]

    def salle_fermee_maison(s):
        # Le signalement 2: table et chaises à cheval qui murent la salle, cloison de la cuisine.
        for i, x, y in (('maison-table', 7, 2), ('maison-chaise-1', 7, 1), ('maison-chaise-2', 7, 3)):
            meuble(s, 'maison-rdc', i).update(x=x, y=y)
        s['maison-rdc']['blocked'].append(dict(x=6, y=4, w=2, h=1))

    def escalier_dans_le_mur(s):
        for p in s['moulin-etage']['doors'].values():
            p['facing'] = 0

    def chaise_a_cheval(s):
        meuble(s, 'cafe', 'cafe-chaise-1').update(x=2, y=2)

    def baie_d_un_metre(s):
        s['epicerie-rdc']['blocked'] = [dict(x=0, y=5, w=4, h=1), dict(x=5, y=5, w=2, h=1)]
    casses_interieurs = (table_epicerie_sur_la_baie, salle_fermee_maison, escalier_dans_le_mur, chaise_a_cheval, baie_d_un_metre)

    def decor(carte, i):
        return next(o for o in carte['objects'] if o['id'] == i)

    def lisse_sur_la_voie(carte):
        decor(carte, 'fete-lisse-nord')['y'] = 97.5

    def marmite_sur_la_rue(carte):
        decor(carte, 'fete-soupe-marmite-meres')['x'] = 204

    def table_au_bord_du_quai(carte):
        decor(carte, 'fete-hiver-table')['y'] = 100.5

    def brasero_dans_la_foule(carte):
        decor(carte, 'fete-quai-brasero')['x'] = 213.5

    def quai_mure(carte):
        # Huit ardoises autour du poste du bout est du quai: Mado et les siens ne l'atteignent plus.
        for k, (dx, dy) in enumerate((a, b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a, b) != (0, 0)):
            carte['objects'].append(dict(id='fete-mur-%d' % k, type='ardoise-a-craie', x=213.5 + dx, y=102.5 + dy, rotation=0,
                                         when=[dict(type='event_is', events=['veillee-du-premier-train'], when='begun')]))

    def fete_inconnue(carte):
        decor(carte, 'fete-soupe-ardoise')['when'] = [dict(type='event_is', events=['fete-de-la-lune'], when='begun')]
    casses_fetes = (lisse_sur_la_voie, marmite_sur_la_rue, table_au_bord_du_quai, brasero_dans_la_foule, quai_mure, fete_inconnue)
    bat = lambda c, i: next(b for b in c['batiments'] if b['id'] == i)
    eau = lambda c, i: next(w for w in c['eaux'] if w['id'] == i)

    def lavoir_cote_riviere(c):
        b = bat(c, 'lavoir'); b['porte'] = [b['rect'][0] + b['rect'][2], b['rect'][1] + 2]

    def carre_d_eau(c):
        c['plans_eau'].append(dict(id='mare', nom='mare', cx=60, cy=60, rx=4, ry=4, alimente_par=None))

    def ru_coupe(c):
        eau(c, 'ru')['pts'] = eau(c, 'ru')['pts'][:5]

    def impasse(c):
        c['noeuds']['bout'] = dict(x=230, y=120, zone='B'); c['aretes'].append(dict(a='gr8', b='bout', classe='chemin', nom=None, verrou=None))

    def sans_pont(c):
        c['ouvrages'] = [o for o in c['ouvrages'] if o['id'] != 'pont_ru']

    def sans_pn(c):
        c['ouvrages'] = [o for o in c['ouvrages'] if o['id'] != 'pn_eglise']

    def distance_fausse(c):
        c['distances'][3]['m'] += 12

    def verrou_oublie(c):
        for a in c['aretes']:
            if a.get('verrou') == 'V3':
                a['verrou'] = None

    def maison_sur_le_chemin(c):
        bat(c, 'forge')['rect'] = [193, 100, 6, 6]

    def porte_loin(c):
        bat(c, 'moulin')['noeud'] = 'cm2'

    def bief_sans_prise(c):
        eau(c, 'bief')['pts'][0] = [30, 138]

    def quete_coupee(c):
        next(q for q in c['quetes'] if q['id'] == 'A2')['acte'] = 1

    def verrou_sans_objet(c):
        c['verrous']['V5'].pop('objet', None)

    def lisiere_nue(c):
        c['bordures']['M'][0]['habillage'] = 'mur'

    def couloir_large(c):
        p_ = c['zones']['V']['poly']
        p_[p_.index([47, 94])] = [47, 88]
        p_[p_.index([55, 94])] = [55, 88]

    def banc_de_dos(c):
        next(m for m in c['mobilier'] if m['id'] == 'banc-ponton')['rotation'] = 2

    def vanne_dans_l_eau(c):
        c['noeuds']['vn'].update(x=24, y=145.3)

    def porte_mal_gabaritee(c):
        bat(c, 'forge')['gabarit']['facade_porte'] = 'nord'

    def piece(c, i):
        return next(it for it in c['interieurs'] if it['id'] == i)

    def objet_de(c, salle, i):
        return next(m for m in piece(c, salle)['meubles'] if m['id'] == i)

    def lampe_au_bord(c):
        objet_de(c, 'maison-rdc', 'maison-rdc-lampe')['y'] = 0.95

    def lampe_sur_la_chaise(c):
        objet_de(c, 'maison-rdc', 'maison-rdc-lampe')['on'] = 'maison-chaise-1'

    def bouquet_contre_la_fenetre(c):
        objet_de(c, 'cafe', 'cafe-pendule').update(x=4.3, y=1.2)
        objet_de(c, 'cafe', 'cafe-comptoir').update(y=0.5)

    def pain_sur_la_lampe(c):
        objet_de(c, 'maison-rdc', 'maison-rdc-pain').update(x=7.38, y=0.32)

    essais = [("porte du lavoir côté ru", lavoir_cote_riviere, "tourne le dos"), ("carré d'eau au milieu de rien", carre_d_eau, "isolé"),
              ("ru qui n'arrive nulle part", ru_coupe, "exutoire"), ("chemin en impasse", impasse, "impasse sans raison"),
              ("pont retiré", sans_pont, "dans l'eau"), ("passage à niveau retiré", sans_pn, "sans passage à niveau"),
              ("distance fausse", distance_fausse, "annoncée"), ("verrou du gué oublié", verrou_oublie, "un verrou manque"),
              ("forge posée sur la rue", maison_sur_le_chemin, "traverse le bâtiment"), ("porte du moulin sans chemin", porte_loin, "du chemin"),
              ("bief sans prise d'eau", bief_sans_prise, "source"), ("quête hors de son acte", quete_coupee, "inatteignable"),
              ("verrou sans objet", verrou_sans_objet, "aucun objet visible"), ("lisière en mur nu", lisiere_nue, "lisière nue"),
              ("étranglement du poste sans talus autour de V2b", couloir_large, "on le contourne"), ("banc dos à la rivière", banc_de_dos, "tourne le dos"),
              ("vanne posée sur l'eau (version 1)", vanne_dans_l_eau, "dans l'eau"), ("porte du gabarit sur la mauvaise façade", porte_mal_gabaritee, "façade"),
              ("ordre des verrous annoncé faux", ordre_faux, "dans les fiches"), ("frênes qui ne barrent que la moitié de l'étranglement", frenes_trop_courts, "se contourne"),
              ("belvédère atteint sans antichambre déclarée", belvedere_non_declare, "hors antichambre"),
              ("table de l'épicerie sur la baie (signalement 1)", table_epicerie_sur_la_baie, "meuble « lit-pension-1 » (lit-simple, sleep), dans « epicerie-etage »"),
              ("salle de la maison murée (signalement 2)", salle_fermee_maison, "porte « maison-rdc-esc-maison-cave »"),
              ("escalier du moulin qui fait arriver dans le mur", escalier_dans_le_mur, "hors de « moulin-etage »"),
              ("chaise du café à cheval sur quatre cases", chaise_a_cheval, "posé à cheval"),
              ("baie de 1 m vers l'escalier de l'épicerie", baie_d_un_metre, "pas de passage de 2 m"),
              ("lampe au bord de la table, hors du plateau", lampe_au_bord, "hors du plateau"),
              ("lampe posée sur une chaise", lampe_sur_la_chaise, "sans plateau"),
              ("pendule du zinc contre le mur nord", bouquet_contre_la_fenetre, "décalerait une fenêtre"),
              ("corbeille posée dans la lampe", pain_sur_la_lampe, "se chevauchent"),
              ("lisse fleurie posée sur la voie", lisse_sur_la_voie, "posé sur voie"),
              ("marmite au milieu de la rue du Bourg", marmite_sur_la_rue, "il barre le passage"),
              ("table de la tourte au bord du quai", table_au_bord_du_quai, "bord du quai"),
              ("brasero dans le groupe de Mado", brasero_dans_la_foule, "du poste « quai-e »"),
              ("poste du bout est muré par le décor", quai_mure, "n'est plus atteignable"),
              ("ardoise d'une fête qui n'existe pas", fete_inconnue, "n'existe pas")]
    res = [casse(*e) for e in essais]
    print("banc d'épreuve: %d casses vues sur %d" % (sum(res), len(res)))
    return all(res)


if __name__ == '__main__':
    with open(os.path.join(ICI, 'plan.json'), encoding='utf-8') as f:
        plan = json.load(f)
    if '--eprouver' in sys.argv:
        sys.exit(0 if eprouver(plan) else 1)
    chemin_md = os.path.join(ICI, 'plan.md')
    md = open(chemin_md, encoding='utf-8').read() if os.path.exists(chemin_md) else None
    erreurs, infos = controler(plan, md)
    chemin_carte = os.path.join(LIEU, 'carte.json')
    if os.path.exists(chemin_carte):
        carte = json.load(open(chemin_carte, encoding='utf-8'))
        fiches = lire_fiches()
        e2, i2 = controler_histoire(plan, carte, fiches)
        e3, i3 = controler_acces(plan, carte, fiches)
        e4, i4 = controler_fetes(plan, carte)
        erreurs += e2 + e3 + e4; infos += i2 + i3 + i4
    else:
        erreurs.append("carte du lieu absente (%s): lancer plan-vers-lieu.ts puis assembler_lieu.py" % chemin_carte)
    for i in infos:
        print("info:", i)
    for e_ in erreurs:
        print("ERREUR:", e_)
    print("%d erreur(s)" % len(erreurs))
    sys.exit(1 if erreurs else 0)
