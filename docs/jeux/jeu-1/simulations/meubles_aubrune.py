#!/usr/bin/env python3
"""Meubles d'Aubrune (La Petite Ligne, refonte): catalogue, prix d'une pièce meublée, jour de la maison meublée.

Usage (depuis la racine du dépôt): python3 -I docs/jeux/jeu-1/simulations/meubles_aubrune.py
Lit les données du jeu (commerces, objets, meubles, plans, logement) et réutilise le modèle de revenu de
`economie_aubrune.py`. Les listes d'emménagement (ce qu'une pièce « correctement meublée » contient) et les
jours où l'histoire débloque des articles sont des hypothèses de conception, réunies plus bas.
Modèle: chaque jour, la moitié du revenu net va au coffre commun, qui paie les pièces (comme dans
`economie_aubrune.py`); l'autre moitié va aux bourses, dont une part (PART_MEUBLES) va aux meubles, le reste aux
outils, sacs, vêtements et graines. Une pièce se meuble dès qu'elle est restaurée, dans l'ordre de la maison;
un meuble fabriqué coûte ses matériaux (planches au prix de Basile, bûches et pierres au prix où on les aurait
revendues). Une fois l'étage payé, le coffre commun finance aussi les meubles.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import economie_aubrune as eco  # noqa: E402

OBJETS = eco.OBJETS
MEUBLES = eco.MEUBLES
COMMERCES = eco.COMMERCES
PLANS = eco.dossier(eco.COMMUN, 'plans')
REGLAGES_CONFORT = dict(par_piece=2, copies_pleines=2, paliers=[8, 18, 32, 50])  # logement/reglages.ts

# Jour où l'histoire ouvre chaque déblocage, duo médian (cahier 6.3; à recaler sur une séance).
DEBLOCAGES = {'aubrune.acte2.train': 8, 'aubrune.acte3.repas': 11, 'aubrune.acte3.train2': 16}
PART_MEUBLES = 0.5
# Matières premières récoltées: valeur de rachat qu'on renonce à toucher (centimes).
VALEUR_RECOLTE = {'buche': 140, 'pierre': 60}

# Listes d'emménagement: (pièce du logement, [(objet, nombre)]). Les meubles de départ (2 coffres, 2 lits
# simples, 2 chaises, miroir, établi) ne sont pas rachetés: ils vont dans la salle, puis les lits montent.
LISTES = [
    ('salle', [('table-a-manger', 1), ('poele', 1), ('vaisselier', 1), ('tapis-long', 1), ('horloge-murale', 1),
               ('lampe-a-petrole', 1), ('patere', 1), ('bouquet', 1)]),
    ('cuisine', [('etagere-murale', 1), ('boites-a-provisions', 1), ('bocaux-de-confiture', 1), ('pots-de-gres', 1),
                 ('corbeille-de-pain', 1), ('caisse-de-legumes', 1)]),
    ('cave', [('buches-d-interieur', 1), ('coffre-a-linge-miel', 1)]),
    ('chambre', [('lit-double', 1), ('armoire', 1), ('table-de-chevet-miel', 2), ('tapis-rond', 1),
                 ('lampe-de-table', 1), ('rideau-de-porte', 1), ('cadre-paysage', 1), ('panier-a-linge', 1)]),
    ('troisieme-piece', [('coffre-a-linge-sauge', 1), ('miroir', 1), ('rideau-de-porte', 1), ('seau', 1),
                         ('balai', 1), ('tapis-long', 1)]),
    ('etage', [('banc-de-table', 1), ('etagere-sauge', 1), ('coffre', 1), ('tabouret-miel', 2),
               ('lampe-de-table', 1), ('tapis-rond', 1), ('cadre-ovale', 1), ('pile-de-livres', 1),
               ('journal', 1), ('tonnelet', 1)]),
    ('jardin', [('banc', 1), ('tabouret-sauge', 2)]),
]
DEPART = {'coffre': 2, 'lit-simple': 2, 'chaise': 2, 'miroir': 1, 'etabli': 1}


def ligne_de_vente(objet):
    for c in COMMERCES.values():
        for l in c['sells']:
            if l['item'] == objet:
                return c, l
    return None, None


def plan_de(objet):
    for p in PLANS.values():
        if p['makes']['kind'] == 'furniture' and any(v['item'] == objet for v in p['makes']['variants']):
            return p
    return None


def cout(objet):
    """(centimes, source lisible, clé de déblocage ou None)."""
    c, l = ligne_de_vente(objet)
    if l is not None:
        cle = l.get('unlock', {}).get('key')
        return l['price'], c['name'], cle
    p = plan_de(objet)
    if p is not None:
        total = 0
        for m in p['materials']:
            prix = eco.prix_d_achat(m['item']) or VALEUR_RECOLTE.get(m['item'], 0)
            total += prix * m['count']
        return total, 'établi (%s)' % p['name'], None
    return None, 'récompense de suite', None


def confort(objet):
    deco = MEUBLES[OBJETS[objet]['prop']].get('deco')
    return deco['comfort'] if deco else 1


def table_du_catalogue():
    lignes = ['| Objet | Prix | Source | Débloqué par |', '|---|---|---|---|']
    meubles = sorted(i for i, o in OBJETS.items() if o['family'] == 'furniture')
    for objet in meubles:
        prix, source, cle = cout(objet)
        lignes.append('| %s | %s | %s | %s |' % (OBJETS[objet]['name'], eco.euros(prix) if prix else 'offert',
                                                source, cle or ''))
    return '\n'.join(lignes), len(meubles)


def table_des_listes(revenu_jour, bourse_jour):
    noms = {r['id']: r['name'] for r in eco.MAISON['rooms']}
    noms['jardin'] = 'Jardin'
    lignes = ['| Pièce | Pièces achetées ou fabriquées | Coût | Jours de revenu du duo | Jours de bourse |',
              '|---|---|---|---|---|']
    total = 0
    for piece, liste in LISTES:
        somme = sum(cout(o)[0] * n for o, n in liste)
        total += somme
        lignes.append('| %s | %d | %s € | %.1f | %.1f |' % (noms[piece], sum(n for _, n in liste), eco.euros(somme),
                                                         somme / revenu_jour, somme / bourse_jour))
    lignes.append('| **Maison entière** | %d | **%s €** | %.1f | %.1f |' % (
        sum(n for _, l in LISTES for _, n in l), eco.euros(total), total / revenu_jour, total / bourse_jour))
    return '\n'.join(lignes), total


def confort_final():
    """Confort de la maison finie et meublée (logement/etat.ts: copies au-delà de deux pour moitié)."""
    copies = dict(DEPART)
    for piece, liste in LISTES:
        if piece == 'jardin':
            continue
        for o, n in liste:
            fiche = OBJETS[o]['prop']
            copies[fiche] = copies.get(fiche, 0) + n
    points = 0.0
    for fiche, n in copies.items():
        deco = MEUBLES[fiche].get('deco')
        c = deco['comfort'] if deco else 1
        pleines = min(n, REGLAGES_CONFORT['copies_pleines'])
        points += c * pleines + c * (n - pleines) / 2
    pieces = len([r for r in eco.MAISON['rooms']]) * REGLAGES_CONFORT['par_piece']
    total = points + pieces
    palier = sum(1 for p in REGLAGES_CONFORT['paliers'] if total >= p)
    return total, palier


def jour_meuble(part, part_meubles=PART_MEUBLES):
    """Jour où chaque pièce est meublée, et jour de la maison entière."""
    restauree = {'salle': 1, 'cave': 11}
    noms = {r['name']: r['id'] for r in eco.MAISON['rooms']}
    for nom, jour in eco.jours_de_la_maison(part):
        restauree[noms[nom]] = jour
    fin_des_pieces = max(restauree.values())
    restauree['jardin'] = 1
    bourse, coffre_libre, jour = 0.0, 0.0, 0
    # Pièce par pièce dans l'ordre de la maison, meuble par meuble: un article encore verrouillé par
    # l'histoire attend sans bloquer les autres.
    a_faire = [(piece, o) for piece, liste in sorted(LISTES, key=lambda pl: restauree.get(pl[0], 10 ** 6))
               for o, n in liste for _ in range(n)]
    reste = {piece: sum(n for _, n in liste) for piece, liste in LISTES}
    fait = {}
    while a_faire and jour < 400:
        jour += 1
        periode = next(p for p in eco.PERIODES if p['jours'][0] <= jour <= p['jours'][1])
        revenu, repas, _ = eco.journee(periode, part, jour >= restauree.get('cuisine', 99))
        net = max(0.0, revenu - repas)
        bourse += part_meubles * net / 2
        if jour > fin_des_pieces:
            coffre_libre += net / 2
        for piece, o in list(a_faire):
            if restauree.get(piece, 10 ** 6) > jour:
                continue
            prix, _, cle = cout(o)
            if cle is not None and DEBLOCAGES[cle] > jour:
                continue
            if bourse + coffre_libre < prix:
                break
            pris = min(bourse, prix)
            bourse -= pris
            coffre_libre -= prix - pris
            a_faire.remove((piece, o))
            reste[piece] -= 1
            if reste[piece] == 0:
                fait[piece] = jour
    return restauree, fait


def main():
    catalogue, n = table_du_catalogue()
    print('## Catalogue (%d meubles obtenables)\n\n%s\n' % (n, catalogue))
    for periode in eco.PERIODES:
        revenu, repas, _ = eco.journee(periode, 0.40, True)
        print('Revenu net du duo médian, %s: %s € par jour, dont %s € aux bourses.' % (
            periode['nom'], eco.euros(revenu - repas), eco.euros((revenu - repas) / 2)))
    revenu, repas, _ = eco.journee(eco.PERIODES[2], 0.40, True)
    net = revenu - repas
    listes, total = table_des_listes(net, net / 2)
    print('\n## Listes d\'emménagement (jours comptés au revenu net de l\'acte 3, duo médian)\n\n' + listes + '\n')
    points, palier = confort_final()
    print('Confort de la maison finie et meublée: %.1f points, palier %d sur 4.\n' % (points, palier))
    noms = {r['id']: r['name'] for r in eco.MAISON['rooms']}
    noms['jardin'] = 'Jardin'
    for part_meubles in (0.5, 0.3):
        print('## Jour où chaque pièce est meublée (part des bourses aux meubles: %d %%)\n' % (part_meubles * 100))
        print('| Pièce | ' + ' | '.join('%s: restaurée, meublée' % p for p, _ in eco.PROFILS) + ' |')
        print('|---|---|---|---|')
        resultats = [jour_meuble(part, part_meubles) for _, part in eco.PROFILS]
        for piece, _ in LISTES:
            cellules = []
            for restauree, fait in resultats:
                r = restauree.get(piece)
                cellules.append('%s, %s' % ('jour %d' % r if r else '?', 'jour %d' % fait[piece] if piece in fait
                                            else 'au-delà de 400'))
            print('| %s | %s |' % (noms[piece], ' | '.join(cellules)))
        fins = ['jour %d' % max(f.values()) if len(f) == len(LISTES) else 'non' for _, f in resultats]
        print('| **Maison meublée** | %s |\n' % ' | '.join(fins))
    return 0


if __name__ == '__main__':
    sys.exit(main())
