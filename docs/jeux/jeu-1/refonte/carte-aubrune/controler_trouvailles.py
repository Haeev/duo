"""Contrôle des trouvailles de berge d'Aubrune (et des girolles), sur la carte produite par la chaîne du plan.

Pour chaque point de trouvaille de `carte.json` (meuble dont la ressource est listée dans TROUVAILLES):
- sol: ni chemin, ni rue, ni route, ni sentier, ni ouvrage, ni eau, ni bâtiment; aucune case bloquée, aucune porte;
- seul sur sa case (aucun autre objet, décor de fête compris);
- au bord de l'eau (une case d'eau parmi les huit voisines), sauf les girolles (sous-bois);
- dans une zone ouverte à son acte, et atteint à pied depuis la porte de la maison, verrous des actes suivants fermés
  (parcours en largeur sur la grille, huit directions sans couper les angles: l'eau ne se traverse pas).
Puis la promenade: tournée du plus proche voisin depuis la porte de la maison et retour, par acte, en mètres et
en minutes à la marche du plan. Sans dépendance: `python3 -I controler_trouvailles.py` (0 erreur attendue).
"""
import heapq
import json
import math
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
LIEU = os.path.join(ICI, '..', '..', '..', '..', '..', 'games', 'la-petite-ligne-2', 'donnees', 'lieux', 'aubrune')
COMMUN = os.path.join(LIEU, '..', '..', 'commun')
TROUVAILLES = {'coquilles-de-greve', 'mulettes-du-bief', 'galets-veines', 'laisse-de-crue', 'tessons-du-lavoir',
               'plumes-de-heron', 'limnees-de-l-etang', 'girolles'}
SANS_EAU = {'girolles'}
SOLS_INTERDITS = {'route', 'rue', 'chemin', 'sentier', 'voie', 'ouvrage', 'eau', 'batiment', 'quai', 'hors-jeu',
                  'lisiere', 'annexe'}
INFRANCHISSABLES = {'eau', 'batiment', 'hors-jeu', 'annexe'}
DEPART = (179, 116)  # case devant la porte de la maison du garde-barrière (porte en 179,5 115,5, face au sud)


def dans(poly, x, y):
    dedans = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dedans = not dedans
    return dedans


def lire(*p):
    with open(os.path.join(*p), encoding='utf-8') as f:
        return json.load(f)


def controler():
    carte = lire(LIEU, 'carte.json')
    plan = lire(ICI, 'plan.json')
    W, H = carte['width'], carte['height']
    leg = carte['terrain']['legend']
    codes = []
    r = carte['terrain']['runs']
    for i in range(0, len(r), 2):
        codes += [r[i]] * r[i + 1]
    nature = lambda x, y: leg[codes[y * W + x]]
    bloque = set()
    for b in carte['blocked']:
        for yy in range(b['y'], b['y'] + b['h']):
            for xx in range(b['x'], b['x'] + b['w']):
                bloque.add((xx, yy))
    portes = {(int(d['x']), int(d['y'])) for d in carte['doors'].values()}
    par_case = {}
    for o in carte['objects']:
        par_case.setdefault((int(o['x']), int(o['y'])), []).append(o['id'])
    verrous = {k.lower(): v['acte'] for k, v in plan['verrous'].items()}
    zones = carte['zones']
    err, info = [], []

    def acte_zone(x, y):
        for z in zones.values():
            if dans(z['polygon'], x, y):
                return z['act']
        return None

    def libre(x, y, ferme):
        return 0 <= x < W and 0 <= y < H and (x, y) not in bloque and nature(x, y) not in INFRANCHISSABLES and (x, y) not in ferme

    def cases_fermees(acte):
        ferme = set()
        for k, v in carte['locks'].items():
            if verrous.get(k, 1) > acte:
                for rc in v['rects']:
                    for yy in range(rc['y'], rc['y'] + rc['h']):
                        for xx in range(rc['x'], rc['x'] + rc['w']):
                            ferme.add((xx, yy))
        return ferme

    def distances(src, ferme):
        d = {src: 0.0}
        tas = [(0.0, src)]
        while tas:
            dd, (x, y) = heapq.heappop(tas)
            if dd > d[(x, y)]:
                continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)):
                nx, ny = x + dx, y + dy
                if not libre(nx, ny, ferme):
                    continue
                if dx and dy and not (libre(x + dx, y, ferme) and libre(x, y + dy, ferme)):
                    continue
                nd = dd + (1.4142 if dx and dy else 1.0)
                if nd < d.get((nx, ny), 1e18):
                    d[(nx, ny)] = nd
                    heapq.heappush(tas, (nd, (nx, ny)))
        return d

    plan_mob = {m['id']: m for m in plan['mobilier']}
    points = []
    for o in carte['objects']:
        if o['type'] not in TROUVAILLES:
            continue
        x, y = int(o['x']), int(o['y'])
        m = plan_mob.get(o['id'], {})
        acte = m.get('acte', 1)
        if not m.get('pourquoi'):
            err.append('%s: sans raison d\'être (« pourquoi »)' % o['id'])
        if abs(o['x'] - x - 0.5) > 1e-6 or abs(o['y'] - y - 0.5) > 1e-6:
            err.append('%s: à cheval sur deux cases (%g, %g)' % (o['id'], o['x'], o['y']))
        if nature(x, y) in SOLS_INTERDITS:
            err.append('%s: posé sur « %s »' % (o['id'], nature(x, y)))
        if (x, y) in bloque:
            err.append('%s: sur une case bloquée' % o['id'])
        if (x, y) in portes:
            err.append('%s: sur le seuil d\'une porte' % o['id'])
        if len(par_case[(x, y)]) > 1:
            err.append('%s: partage sa case avec %s' % (o['id'], ', '.join(i for i in par_case[(x, y)] if i != o['id'])))
        if o['type'] not in SANS_EAU and not any(nature(x + dx, y + dy) == 'eau' for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
            err.append('%s: pas au bord de l\'eau' % o['id'])
        az = acte_zone(o['x'], o['y'])
        if az is None:
            err.append('%s: hors de toute zone jouable' % o['id'])
        elif az != acte:
            err.append('%s: acte %d dans le plan, zone de l\'acte %d' % (o['id'], acte, az))
        points.append((o['id'], o['type'], (x, y), acte))
    # Ressources citées par les points: chaque fiche existe.
    for t in sorted({p[1] for p in points}):
        if not os.path.exists(os.path.join(COMMUN, 'ressources', t + '.json')):
            err.append('ressource %s: fiche absente' % t)
    marche = plan['vitesses']['marche']
    for acte in (1, 2, 3):
        ferme = cases_fermees(acte)
        visibles = [p for p in points if p[3] <= acte]
        d0 = distances(DEPART, ferme)
        for pid, _, c, a in visibles:
            if c not in d0:
                err.append('%s: inatteignable à pied à l\'acte %d' % (pid, acte))
        visibles = [p for p in visibles if p[2] in d0]
        if not visibles:
            continue
        # Tournée du plus proche voisin, depuis la porte de la maison et retour.
        tables = {p[2]: distances(p[2], ferme) for p in visibles}
        reste, ici, total, ordre = list(visibles), DEPART, 0.0, []
        dist_de = lambda a, b: (d0 if a == DEPART else tables[a]).get(b, 1e18)
        while reste:
            suivant = min(reste, key=lambda p: dist_de(ici, p[2]))
            total += dist_de(ici, suivant[2])
            ordre.append(suivant[0])
            ici = suivant[2]
            reste.remove(suivant)
        total += tables[ici].get(DEPART, 1e18) if ici != DEPART else 0
        info.append('acte %d: %d points, promenade de %d m (%.1f min à la marche, %.2f m/s), dans l\'ordre: %s' % (
            acte, len(visibles), round(total), total / marche / 60, marche, ', '.join(ordre)))
    return err, info


if __name__ == '__main__':
    erreurs, infos = controler()
    for i in infos:
        print('info:', i)
    for e in erreurs:
        print('ERREUR:', e)
    print('%d erreur(s)' % len(erreurs))
    sys.exit(1 if erreurs else 0)
