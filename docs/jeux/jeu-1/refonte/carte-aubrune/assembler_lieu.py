#!/usr/bin/env python3
"""Du plan version 2 au dossier du lieu d'Aubrune, après `outils/plan-vers-lieu.ts` (ADR 0022).

Usage (depuis la racine du dépôt):
  node games/la-petite-ligne-2/outils/plan-vers-lieu.ts docs/jeux/jeu-1/refonte/carte-aubrune/plan.json <brute.json>
  python3 -I docs/jeux/jeu-1/refonte/carte-aubrune/assembler_lieu.py <brute.json>

L'outil du paquet écrit la grille (collisions, terrain, zones, verrous, graphe); ce script y ajoute ce que le plan
version 2 décrit et que l'outil ne lit pas encore: sols détaillés (codes ajoutés au bout de la légende, les premiers
ne bougent pas), meubles et décor dont le type existe déjà (`donnees/commun/meubles`), points nommés, coins de pêche,
portes et intérieurs (annexe sous le dehors), nœuds de portes et d'intérieurs dans le graphe. Il écrit `carte.json`,
`lieu.json`, `climat.json` et `interieurs/*.json` du lieu, puis prouve qu'aucun verrou ne se contourne: pour chaque
verrou fermé (avec ceux des actes suivants et les raccourcis), aucun nœud que le graphe dit fermé n'est atteint en
marchant sur la grille. Rien de tout cela ne se retouche à la main: on corrige le plan et on relance les deux étapes.
"""
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..', '..', '..'))
PAQUET = os.path.join(RACINE, 'games', 'la-petite-ligne-2')
LIEU = os.path.join(PAQUET, 'donnees', 'lieux', 'aubrune')
ANNEXE_Y = 210  # sous le dehors (208) et son mur


def gid(s):
    return s.replace('_', '-').lower()


def main(brute):
    plan = json.load(open(os.path.join(ICI, 'plan.json'), encoding='utf-8'))
    carte = json.load(open(brute, encoding='utf-8'))
    types = {f[:-5] for f in os.listdir(os.path.join(PAQUET, 'donnees', 'commun', 'meubles')) if f.endswith('.json')}
    W, H = carte['width'], plan['taille']['hauteur']
    manquants = {}

    # ---- sols: codes ajoutés au bout de la légende
    legende = carte['terrain']['legend']
    codes = []
    for c, k in zip(carte['terrain']['runs'][0::2], carte['terrain']['runs'][1::2]):
        codes += [c] * k

    def code(nom):
        if nom not in legende:
            legende.append(nom)
        return legende.index(nom)

    def dans(poly, x, y):
        r = False
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                r = not r
        return r

    herbe, champ = legende.index('herbe'), legende.index('champ')
    zones = plan['zones']
    for y in range(H):
        for x in range(W):
            i = y * W + x
            if codes[i] == herbe:
                for zk, z in zones.items():
                    if dans(z['poly'], x + 0.5, y + 0.5):
                        codes[i] = code(plan['sols']['par_zone'][zk])
                        break
    rects = [(p['rect'], plan['sols']['par_parcelle'].get(p['nom'], 'pre')) for p in plan['parcelles']]
    rects += [(r['rect'], r['sol']) for r in plan['sols']['rects']]
    modifiables = {herbe, champ} | {legende.index(s) for s in legende[14:]}
    for (rx, ry, rw, rh), sol in rects:
        for y in range(max(0, int(ry)), min(H, int(ry + rh + 0.999))):
            for x in range(max(0, int(rx)), min(W, int(rx + rw + 0.999))):
                if rx <= x + 0.5 < rx + rw and ry <= y + 0.5 < ry + rh and codes[y * W + x] in modifiables:
                    codes[y * W + x] = code(sol)
    runs = []
    for c in codes:
        if runs and runs[-2] == c:
            runs[-1] += 1
        else:
            runs += [c, 1]
    carte['terrain']['runs'] = runs

    # ---- objets du dehors (types existants seulement)
    objets = []
    for m in plan['mobilier'] + [dict(a, rotation=0, modele=a['type']) for a in plan['arbres']]:
        if m['type'] in types:
            objets.append(dict(id=m['id'], type=m['type'], x=m['x'], y=m['y'], rotation=m['rotation']))
        else:
            manquants.setdefault(m['modele'], []).append(m['id'])
    for r in plan['ressources']:
        t = plan['type_ressource'].get(r['nature'])
        if t and t in types and 'x' in r:
            objets.append(dict(id=gid(r['id']), type=t, x=r['x'], y=r['y'], rotation=0))
    for v in plan['verrous'].values():
        manquants.setdefault(v['modele'], []).append('verrou')
    carte['objects'] = objets

    # ---- points nommés et coins de ressources
    pts = carte['points']
    for p in plan['points_nommes']:
        pts[p['id']] = dict(x=p['x'], y=p['y'])
    for r in plan['ressources']:
        if 'x' in r:
            pts[gid(r['id'])] = dict(x=r['x'], y=r['y'])

    # ---- intérieurs, portes, graphe
    noeuds, aretes = carte['graph']['nodes'], carte['graph']['edges']
    portes = {}
    bats = {b['id']: b for b in plan['batiments']}
    os.makedirs(os.path.join(LIEU, 'interieurs'), exist_ok=True)
    for f in os.listdir(os.path.join(LIEU, 'interieurs')):
        if f.endswith('.json'):
            os.remove(os.path.join(LIEU, 'interieurs', f))
    x_cur = 2
    sens_dehors = {'sud': 0, 'est': 1, 'nord': 2, 'ouest': 3}
    for it in plan['interieurs']:
        at = dict(x=x_cur, y=ANNEXE_Y)
        x_cur += it['largeur'] + 3
        iid = gid(it['id'])
        loc = lambda x, y: dict(x=at['x'] + x, y=at['y'] + y)
        room = dict(schema=1, id=iid, name=it['nom'][:1].upper() + it['nom'][1:], width=it['largeur'], height=it['hauteur'], at=at,
                    blocked=[dict(x=c[0], y=c[1], w=c[2], h=c[3]) for c in it['cloisons']],
                    points={}, objects=[], doors={})
        for m in it['meubles']:
            if m['type'] in types:
                room['objects'].append(dict(id=m['id'], type=m['type'], x=m['x'], y=m['y'], rotation=m['rotation']))
            else:
                manquants.setdefault(m['modele'], []).append(m['id'])
        noeud_entree = None
        if it['porte']:
            b = bats[it['batiment']]
            px, py = b['porte']
            fac = b['gabarit']['facade_porte']
            dx, dy = {'sud': (0, 0.5), 'nord': (0, -0.5), 'est': (0.5, 0), 'ouest': (-0.5, 0)}[fac]
            dehors = dict(x=int(px + dx) + 0.5, y=int(py + dy) + 0.5)
            id_d, id_i = 'porte-' + gid(b['id']) + ('' if it['niveau'] == 0 and iid == gid(b['id']) else '-' + iid), iid + '-porte'
            id_d = id_d[:40]
            portes[id_d] = dict(dehors, facing=sens_dehors[fac], to=id_i)
            ix, iy, regard = it['porte']
            room['doors'][id_i] = dict(x=ix, y=iy, facing=regard, to=id_d)
            noeuds[id_d] = dict(x=dehors['x'], y=dehors['y'])
            noeuds[id_i] = loc(ix, iy)
            aretes.append(dict(a=gid(b['noeud']), b=id_d, kind='chemin', lock=None))
            aretes.append(dict(a=id_d, b=id_i, kind='porte', lock=None))
            noeud_entree = id_i
        for e in it['escaliers']:
            id_e = (iid + '-esc-' + gid(e['vers']))[:40]
            room['doors'][id_e] = dict(x=e['x'], y=e['y'], facing=e['regard'], to=(gid(e['vers']) + '-esc-' + iid)[:40])
            noeuds[id_e] = loc(e['x'], e['y'])
            if noeud_entree is None:
                noeud_entree = id_e
            elif id_e != noeud_entree:
                aretes.append(dict(a=noeud_entree, b=id_e, kind='interieur', lock=None))
            autre = (gid(e['vers']) + '-esc-' + iid)[:40]
            if iid < gid(e['vers']):
                aretes.append(dict(a=id_e, b=autre, kind='porte', lock=None))
        for p in it['points']:
            room['points'][p['id']] = dict(x=p['x'], y=p['y'])
            noeuds[p['id']] = loc(p['x'], p['y'])
            if noeud_entree:
                aretes.append(dict(a=noeud_entree, b=p['id'], kind='interieur', lock=None))
        with open(os.path.join(LIEU, 'interieurs', iid + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(room, f, ensure_ascii=False, indent=1)
            f.write('\n')
    carte['doors'] = portes
    # Le bâtiment nomme son intérieur de plain-pied quand il est livré; sinon l'identifiant prévu reste.
    for it in plan['interieurs']:
        if it['niveau'] == 0:
            carte['buildings'][gid(it['batiment'])]['interior'] = gid(it['id'])

    # Un point se tient sur une case libre: le siège devant le banc, le pêcheur sur la berge, le dormeur au bord du lit.
    tailles = {}
    for t in types:
        d = json.load(open(os.path.join(PAQUET, 'donnees', 'commun', 'meubles', t + '.json'), encoding='utf-8'))
        tailles[t] = (d['size']['w'], d['size']['h'], d.get('solid', False))

    def occupation(w, h, rects, objs):
        occ = bytearray(w * h)
        for r in rects:
            for y in range(max(0, r['y']), min(h, r['y'] + r['h'])):
                for x in range(max(0, r['x']), min(w, r['x'] + r['w'])):
                    occ[y * w + x] = 1
        for o in objs:
            ow, oh, solide = tailles[o['type']]
            if o['rotation'] in (1, 3):
                ow, oh = oh, ow
            if not solide:
                continue
            for y in range(int(o['y'] - oh / 2 + 0.01), int(o['y'] + oh / 2 - 0.01) + 1):
                for x in range(int(o['x'] - ow / 2 + 0.01), int(o['x'] + ow / 2 - 0.01) + 1):
                    if 0 <= x < w and 0 <= y < h:
                        occ[y * w + x] = 1
        return occ

    def degager(points, occ, w, h, ou):
        for k, p in points.items():
            cx, cy = int(p['x']), int(p['y'])
            if 0 <= cx < w and 0 <= cy < h and not occ[cy * w + cx]:
                continue
            best = None
            for r in range(1, 7):
                for y in range(cy - r, cy + r + 1):
                    for x in range(cx - r, cx + r + 1):
                        if 0 <= x < w and 0 <= y < h and not occ[y * w + x]:
                            d = (x + 0.5 - p['x']) ** 2 + (y + 0.5 - p['y']) ** 2
                            if best is None or d < best[0]:
                                best = (d, x, y)
                if best:
                    break
            if best is None:
                raise SystemExit('point %s (%s): aucune case libre à moins de 6 m' % (k, ou))
            p['x'], p['y'] = best[1] + 0.5, best[2] + 0.5
            deplaces.append('%s (%s)' % (k, ou))

    deplaces = []
    degager(pts, occupation(W, carte['height'], carte['blocked'], objets), W, H, 'dehors')
    for f in sorted(os.listdir(os.path.join(LIEU, 'interieurs'))):
        chemin = os.path.join(LIEU, 'interieurs', f)
        room = json.load(open(chemin, encoding='utf-8'))
        degager(room['points'], occupation(room['width'], room['height'], room['blocked'], room['objects']), room['width'], room['height'], room['id'])
        for k, p in room['points'].items():
            noeuds[k] = dict(x=room['at']['x'] + p['x'], y=room['at']['y'] + p['y'])
        with open(chemin, 'w', encoding='utf-8', newline='\n') as fo:
            json.dump(room, fo, ensure_ascii=False, indent=1)
            fo.write('\n')
    for k in pts:
        if k in noeuds:
            noeuds[k] = dict(pts[k])
    print('points posés sur la case libre la plus proche:', ', '.join(deplaces))

    with open(os.path.join(LIEU, 'carte.json'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(carte, ensure_ascii=False, separators=(',', ':')) + '\n')
    lieu = dict(schema=1, id='aubrune', name='Aubrune', station=dict(arrival='quai', platform='quai', platformRadius=3),
                links=[], activities=[], music=None)
    # La fiche du lieu appartient aussi à l'écriture (liens vers le train de nuit): on ne la crée que si elle manque.
    if not os.path.exists(os.path.join(LIEU, 'lieu.json')):
        with open(os.path.join(LIEU, 'lieu.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(lieu, f, ensure_ascii=False, indent=2)
            f.write('\n')
    climat = dict(schema=1, seasons=dict(
        spring=dict(weights=dict(clear=30, overcast=25, rain=20, mist=25), ambience='aubrune-printemps'),
        summer=dict(weights=dict(clear=50, overcast=20, rain=10, mist=10, storm=10), ambience='aubrune-ete'),
        autumn=dict(weights=dict(clear=20, overcast=25, rain=25, mist=30), ambience='aubrune-automne'),
        winter=dict(weights=dict(clear=20, overcast=30, rain=10, mist=20, snow=20), ambience='aubrune-hiver')), changeChance=0.3)
    with open(os.path.join(LIEU, 'climat.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(climat, f, ensure_ascii=False, indent=2)
        f.write('\n')

    erreurs = eprouver_verrous(plan, carte)
    print('carte.json: %d objets, %d points, %d portes, %d noeuds, %d arêtes; %d intérieurs; légende de %d sols' % (
        len(objets), len(pts), len(portes), len(noeuds), len(aretes), len(plan['interieurs']), len(legende)))
    print('modèles à créer (type de meuble absent, pas posés dans carte.json):')
    for k, v in sorted(manquants.items()):
        print('  %s: %d (%s)' % (k, len(v), ', '.join(v[:4]) + (' ...' if len(v) > 4 else '')))
    for e in erreurs:
        print('ERREUR:', e)
    print('%d erreur(s)' % len(erreurs))
    return 1 if erreurs else 0


def eprouver_verrous(plan, carte):
    """Pour chaque verrou fermé: le graphe dit quels nœuds restent fermés; la marche sur la grille ne doit pas les atteindre."""
    W, H = carte['width'], plan['taille']['hauteur']
    plein = bytearray(W * H)
    for r in carte['blocked']:
        for y in range(r['y'], min(H, r['y'] + r['h'])):
            for x in range(r['x'], r['x'] + r['w']):
                plein[y * W + x] = 1
    verrous = plan['verrous']
    N = plan['noeuds']
    err = []
    for vk, v in verrous.items():
        fermes = {k for k, w in verrous.items() if k == vk or w['acte'] > v['acte'] or w.get('sens') == 'raccourci'}
        # graphe
        adj = {k: [] for k in N}
        for a in plan['aretes']:
            if a['verrou'] in fermes:
                continue
            adj[a['a']].append(a['b']); adj[a['b']].append(a['a'])
        vus, pile = {'quai'}, ['quai']
        while pile:
            u = pile.pop()
            for w_ in adj[u]:
                if w_ not in vus:
                    vus.add(w_); pile.append(w_)
        # grille
        bloque = bytearray(plein)
        for k in fermes:
            for r in carte['locks'][gid(k)]['rects']:
                for y in range(max(0, r['y']), min(H, r['y'] + r['h'])):
                    for x in range(max(0, r['x']), min(W, r['x'] + r['w'])):
                        bloque[y * W + x] = 1
        q = N['quai']
        s = int(q['y']) * W + int(q['x'])
        atteint = bytearray(W * H); atteint[s] = 1; pile = [s]
        while pile:
            i = pile.pop()
            x = i % W
            for j in (i - 1 if x > 0 else -1, i + 1 if x < W - 1 else -1, i - W, i + W):
                if 0 <= j < W * H and not atteint[j] and not bloque[j]:
                    atteint[j] = 1; pile.append(j)
        for k, nn in N.items():
            if k not in vus and atteint[int(nn['y']) * W + int(nn['x'])]:
                err.append('verrou %s fermé: le noeud %s (zone %s) est atteint à pied par la grille, le verrou se contourne' % (vk, k, nn['zone']))
    return err


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
