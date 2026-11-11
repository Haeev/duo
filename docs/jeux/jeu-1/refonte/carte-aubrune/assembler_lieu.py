#!/usr/bin/env python3
"""Du plan version 2 au dossier du lieu d'Aubrune, après `outils/plan-vers-lieu.ts` (ADR 0022).

Usage (depuis la racine du dépôt):
  node games/la-petite-ligne-2/outils/plan-vers-lieu.ts docs/jeux/jeu-1/refonte/carte-aubrune/plan.json <brute.json>
  python3 -I docs/jeux/jeu-1/refonte/carte-aubrune/assembler_lieu.py <brute.json>

L'outil du paquet écrit la grille (collisions, terrain, zones, verrous, graphe); ce script y ajoute ce que le plan
version 2 décrit et que l'outil ne lit pas encore: sols détaillés (codes ajoutés au bout de la légende, les premiers
ne bougent pas), meubles et décor dont le type existe déjà (`donnees/commun/meubles`), points nommés, coins de pêche,
portes et intérieurs (annexe sous le dehors), nœuds de portes et d'intérieurs dans le graphe. Il écrit `carte.json`,
`lieu.json`, `climat.json`, `interieurs/*.json` et la copie de `plan.json` du lieu, puis prouve qu'aucun verrou ne se contourne: pour chaque
verrou fermé (avec ceux des actes suivants et les raccourcis), aucun nœud que le graphe dit fermé n'est atteint en
marchant sur la grille. Rien de ce que le script écrit ne se retouche à la main: on corrige le plan et on relance les
deux étapes.

Ce qui s'ajoute à la main dans les fichiers du lieu est conservé d'une passe à l'autre (`conserver`): tout champ que
le script n'écrit pas lui-même. Dans un intérieur: l'habillage du rendu (`style`, `rugs`, `windows`); sur un meuble ou
une porte, d'un intérieur comme de `carte.json`, retrouvés par leur identifiant: les conditions de jeu (`when` d'un
meuble, `opens` et `says` d'une porte, `group`...). Un meuble ou une porte qui disparaît du plan perd ses ajouts.
Un objet du plan qui porte lui-même `when` (décor des fêtes, version 7) l'écrit tel quel: le plan l'emporte.
Relancer le script sans toucher au plan ne change donc aucun fichier.
"""
import json
import os
import shutil
import subprocess
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
RACINE = os.path.normpath(os.path.join(ICI, '..', '..', '..', '..', '..'))
PAQUET = os.path.join(RACINE, 'games', 'la-petite-ligne-2')
LIEU = os.path.join(PAQUET, 'donnees', 'lieux', 'aubrune')
ANNEXE_Y = 210  # sous le dehors (208) et son mur


# Ce que le script écrit lui-même; tout autre champ trouvé dans un fichier existant a été ajouté à la main.
ECRITS_PIECE = {'schema', 'id', 'name', 'width', 'height', 'at', 'blocked', 'points', 'objects', 'doors', 'pourquoi'}
ECRITS_MEUBLE = {'id', 'type', 'x', 'y', 'rotation', 'resource', 'on'}


def objet(m, **plus):
    """Un meuble du plan tel que le lieu l'écrit; `on`: le porteur (même pièce) ou une hauteur en mètres."""
    o = dict(id=m['id'], type=m['type'], x=m['x'], y=m['y'], rotation=m['rotation'])
    if m.get('on') is not None:
        o['on'] = m['on']
    # Condition de présence venue du plan (décor de fête): le plan la porte, une retouche à la main ne l'écrase pas.
    if m.get('when') is not None:
        o['when'] = m['when']
    o.update(plus)
    return o
ECRITS_PORTE = {'x', 'y', 'facing', 'to'}


def gid(s):
    return s.replace('_', '-').lower()


def lire(chemin):
    if not os.path.exists(chemin):
        return None
    with open(chemin, encoding='utf-8') as f:
        return json.load(f)


def conserver_elements(objets, portes, ancien, gardes, ecrits=ECRITS_MEUBLE):
    """Reporte sur les meubles et les portes (retrouvés par identifiant) les champs ajoutés à la main dans `ancien`."""
    vieux_objets = {o['id']: o for o in ancien.get('objects', [])}
    for o in objets:
        for k, v in vieux_objets.get(o['id'], {}).items():
            # `when` écrit par le plan l'emporte; celui ajouté à la main (meuble d'intérieur) est gardé.
            if k not in ecrits and k not in o:
                o[k] = v
                gardes.append('%s.%s' % (o['id'], k))
    for k_porte, d in portes.items():
        for k, v in (ancien.get('doors') or {}).get(k_porte, {}).items():
            if k not in ECRITS_PORTE:
                d[k] = v
                gardes.append('%s.%s' % (k_porte, k))


def conserver(room, ancien, gardes):
    """La pièce écrite par le script, plus les champs ajoutés à la main dans le fichier existant, dans le même ordre."""
    if ancien is None:
        return room
    conserver_elements(room['objects'], room['doors'], ancien, gardes)
    ajouts = {k: v for k, v in ancien.items() if k not in ECRITS_PIECE}
    gardes += ['%s.%s' % (room['id'], k) for k in ajouts]
    fusion = dict(room, **ajouts)
    ordre = [k for k in ancien if k in fusion] + [k for k in fusion if k not in ancien]
    return {k: fusion[k] for k in ordre}


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
    # Les parcelles gardent la nature que l'outil leur donne (place, cimetière, labour...): le rendu en tire leur
    # aspect. Seules l'herbe des zones et les surfaces particulières (lande, galets, vase...) reçoivent un sol.
    natures = {gid(p['nature']) for p in plan['parcelles'] if p.get('nature')}
    rects = [(r['rect'], r['sol']) for r in plan['sols']['rects']]
    modifiables = {herbe, champ} | {legende.index(s) for s in legende[14:] if s not in natures}
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
            objets.append(objet(m, pourquoi=m['pourquoi'][:400]))
        else:
            manquants.setdefault(m['modele'], []).append(m['id'])
    for r in plan['ressources']:
        t = plan['type_ressource'].get(r['nature'])
        if t and t in types and 'x' in r:
            o = dict(id=gid(r['id']), type=t, x=r['x'], y=r['y'], rotation=0)
            # Un coin qui a sa fiche de ressource (`commun/ressources/<fiche>.json`) la porte: sa table remplace celle du type.
            if r.get('fiche'):
                o['resource'] = r['fiche']
            objets.append(dict(o, pourquoi=r['pourquoi'][:400]))
    for k, v in plan['verrous'].items():
        manquants.setdefault(v['modele'], []).append('verrou')
        # La phrase « pas encore » montrée par la touche d'action tant que le verrou est fermé.
        carte['locks'][gid(k)]['says'] = v['pas_encore']
    carte['objects'] = objets

    # ---- coins de pêche: le plus grand rectangle d'eau (8 x 5 au plus) près de chaque coin, pour `fishing` de lieu.json
    eau = legende.index('eau')
    ress = {r['id']: r for r in plan['ressources']}
    peche = []
    for c in plan.get('peche_lieu', []):
        r = ress[c['ressource']]
        best = None
        for w in range(8, 2, -1):
            for h in range(5, 1, -1):
                for y0 in range(int(r['y']) - 7, int(r['y']) + 3):
                    for x0 in range(int(r['x']) - 7, int(r['x']) + 3):
                        if x0 < 0 or y0 < 0 or x0 + w > W or y0 + h > H:
                            continue
                        if any(codes[(y0 + j) * W + x0 + i] != eau for j in range(h) for i in range(w)):
                            continue
                        d = abs(x0 + w / 2 - r['x']) + abs(y0 + h / 2 - r['y'])
                        cle = (-w * h, d)
                        if best is None or cle < best[0]:
                            best = (cle, dict(x=x0, y=y0, w=w, h=h))
        if best is None:
            raise SystemExit('coin de pêche %s: aucune eau près de (%g, %g)' % (c['id'], r['x'], r['y']))
        peche.append(dict(id=c['id'], area=best[1], shadows=c['ombres'], table=[dict(catch=k, weight=v) for k, v in c['table'].items()]))
    with open(os.path.join(ICI, 'peche-lieu.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(dict(note="proposition du level design pour le champ `fishing` de lieu.json (poissons et poids à équilibrer par le game designer)", fishing=peche), f, ensure_ascii=False, indent=1)
        f.write('\n')

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
    anciens, gardes = {}, []
    for f in os.listdir(os.path.join(LIEU, 'interieurs')):
        if f.endswith('.json'):
            anciens[f[:-5]] = lire(os.path.join(LIEU, 'interieurs', f))
            os.remove(os.path.join(LIEU, 'interieurs', f))
    ancienne_carte = lire(os.path.join(LIEU, 'carte.json')) or {}
    x_cur = 2
    sens_dehors = {'sud': 0, 'est': 1, 'nord': 2, 'ouest': 3}
    for it in plan['interieurs']:
        at = dict(x=x_cur, y=ANNEXE_Y)
        x_cur += it['largeur'] + 3
        iid = gid(it['id'])
        loc = lambda x, y: dict(x=at['x'] + x, y=at['y'] + y)
        room = dict(schema=1, id=iid, name=it['nom'][:1].upper() + it['nom'][1:], width=it['largeur'], height=it['hauteur'], at=at,
                    blocked=[dict(x=c[0], y=c[1], w=c[2], h=c[3]) for c in it['cloisons']],
                    points={}, objects=[], doors={}, pourquoi=it['note'][:400])
        for m in it['meubles']:
            if m['type'] in types:
                room['objects'].append(objet(m))
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
        room = conserver(room, anciens.get(iid), gardes)
        with open(os.path.join(LIEU, 'interieurs', iid + '.json'), 'w', encoding='utf-8', newline='\n') as f:
            json.dump(room, f, ensure_ascii=False, indent=1)
            f.write('\n')
    carte['doors'] = portes
    # Dehors, le `pourquoi` d'un meuble vient du plan: celui du fichier n'est pas un ajout.
    conserver_elements(objets, portes, ancienne_carte, gardes, ECRITS_MEUBLE | {'pourquoi'})
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
    print('champs ajoutés à la main, conservés (%d):' % len(gardes), ', '.join(gardes))

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

    # Le jeu lit sa copie du plan (la publication ne récupère pas `docs/`); `tests/plan-copie.test.ts` la garde égale
    # à la source: la copie est mise en forme avec les autres, puis recopiée sur la source (docs/ n'est pas formaté).
    shutil.copyfile(os.path.join(ICI, 'plan.json'), os.path.join(LIEU, 'plan.json'))
    # Mise en forme du dépôt (`pnpm format:verifier`): les fichiers du lieu se relisent ligne à ligne dans les diffs.
    sorties = [os.path.join(LIEU, 'carte.json'), os.path.join(LIEU, 'climat.json'), os.path.join(LIEU, 'plan.json')] + [
        os.path.join(LIEU, 'interieurs', f) for f in sorted(os.listdir(os.path.join(LIEU, 'interieurs')))]
    r = subprocess.run(['npx', 'prettier', '--write', '--log-level', 'warn'] + sorties, cwd=PAQUET)
    if r.returncode != 0:
        print('prettier a échoué: fichiers du lieu laissés tels quels')
    shutil.copyfile(os.path.join(LIEU, 'plan.json'), os.path.join(ICI, 'plan.json'))
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
