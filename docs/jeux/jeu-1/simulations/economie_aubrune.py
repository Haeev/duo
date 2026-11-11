#!/usr/bin/env python3
"""Économie d'Aubrune (La Petite Ligne, refonte): revenu d'une journée à deux et jours pour payer la maison.

Usage (depuis la racine du dépôt): python3 -I docs/jeux/jeu-1/simulations/economie_aubrune.py
Le script lit les données du jeu (commerces, carte, ressources, cultures, pêche, logement): les prix et les
quantités ne sont écrits qu'à un endroit. Seules les durées des gestes « avec la marche » sont des hypothèses,
réunies dans HYPOTHESES et à recaler sur une vraie séance du client.
Modèle: chaque jour, le duo consacre une part de sa journée à récolter et vendre; il prend d'abord ce qui
rapporte le plus à la seconde, dans la limite de ce que le lieu produit et de ce que chaque commerçant
peut payer par jour (plafond). Sans hasard: les tirages (butin, pêche) sont pris à leur moyenne.
"""
import json
import os
import sys

ICI = os.path.dirname(os.path.abspath(__file__))
PKG = os.path.normpath(os.path.join(ICI, '..', '..', '..', '..', 'games', 'la-petite-ligne-2'))
COMMUN = os.path.join(PKG, 'donnees', 'commun')
LIEU = os.path.join(PKG, 'donnees', 'lieux', 'aubrune')


def lire(*chemin):
    with open(os.path.join(*chemin), encoding='utf-8') as f:
        return json.load(f)


def dossier(*chemin):
    d = os.path.join(*chemin)
    return {f[:-5]: lire(d, f) for f in sorted(os.listdir(d)) if f.endswith('.json')}


REGLAGES = lire(COMMUN, 'reglages.json')
COMMERCES = dossier(LIEU, 'commerces')
RESSOURCES = dossier(COMMUN, 'ressources')
MEUBLES = dossier(COMMUN, 'meubles')
CULTURES = dossier(COMMUN, 'cultures')
OBJETS = dossier(COMMUN, 'objets')
RECETTES = dossier(COMMUN, 'recettes')
CARTE = lire(LIEU, 'carte.json')
FICHE = lire(LIEU, 'lieu.json')
MAISON = lire(LIEU, 'logements', 'maison-du-garde.json')
POULE = lire(COMMUN, 'especes', 'poule.json')

# Journée de jeu en secondes réelles (du lever à la nuit).
JOUR_S = (REGLAGES['clock']['nightStart'] - REGLAGES['clock']['dayStart']) / 60 * REGLAGES['clock']['secondsPerHour']

HYPOTHESES = {
    # secondes réelles par unité, marche comprise
    'marche_par_arbre': 30, 'marche_par_caillou': 12, 'marche_par_fouille': 40, 'marche_par_tas': 20,
    'seconde_par_oeuf': 2, 'seconde_par_case_et_par_jour': 0.7, 'seconde_par_poisson': 45,
    'seconde_par_omelette': 22, 'part_d_omelettes_parfaites': 0.5,
    'vente_par_pile': 6,           # ouvrir la boutique et vendre une pile
    'tournee_fixe': 195,           # par jour: le tour des comptoirs (150 s), le potager et le poulailler (45 s)
    'poissons_par_jour_au_plus': 20,
    'pains_par_joueur_et_par_jour': 2,
}
# Ce que l'histoire a ouvert, par période (cahier 6.3): commerçants présents, potager, poules, canne.
PERIODES = [
    dict(nom='acte 1 (jours 1 à 4)', jours=(1, 4), absents={'cafe-de-la-halte', 'cour-des-delmas'}, cases=6,
         poules=2, peche=False, cuisine_possible=False),
    dict(nom='acte 2 (jours 5 à 10)', jours=(5, 10), absents={'cour-des-delmas'}, cases=24, poules=4, peche=True,
         cuisine_possible=True),
    dict(nom='acte 3 et après (jour 11 et suivants)', jours=(11, 10 ** 6), absents=set(), cases=24, poules=6,
         peche=True, cuisine_possible=True),
]
PROFILS = [('duo tranquille', 0.25), ('duo médian', 0.40), ('duo appliqué', 0.55)]


def prix_de_rachat(objet, absents):
    """Commerçants qui rachètent l'objet, du mieux payant au moins payant: (prix de base, commerce)."""
    offres = []
    for c in COMMERCES.values():
        if c['id'] in absents:
            continue
        for ligne in c['buys']:
            if ligne.get('item') == objet:
                offres.append((ligne['price'], c['id']))
    return sorted(offres, reverse=True)


def prix_d_achat(objet, absents=()):
    prix = [l['price'] for c in COMMERCES.values() if c['id'] not in absents for l in c['sells'] if l['item'] == objet]
    return min(prix) if prix else None


def moyenne_butin(ressource, objet):
    """Unités d'un objet par récolte d'une ressource (moyenne des tirages non rares)."""
    r = RESSOURCES[ressource]
    lignes = [l for l in r['loot'] if not l['rare'] and not l['weathers']]
    total = sum(l['weight'] for l in lignes)
    return r['rolls'] * sum(l['weight'] / total * (l['min'] + l['max']) / 2 for l in lignes if l['item'] == objet)


def compter(type_de_meuble):
    return sum(1 for o in CARTE['objects'] if o['type'] == type_de_meuble)


def valeur_moyenne_poisson(absents):
    """Prix moyen d'une prise, tous coins confondus, au meilleur commerçant (conditions de saison ignorées)."""
    total, poids = 0.0, 0.0
    for coin in FICHE['fishing']:
        for ligne in coin['table']:
            offres = prix_de_rachat(ligne['catch'], absents)
            total += ligne['weight'] * (offres[0][0] if offres else 0)
            poids += ligne['weight']
    return total / poids


def activites(periode):
    """Liste de (nom, objet vendu, unités par jour au plus, secondes par unité, frais par unité en centimes)."""
    h = HYPOTHESES
    hache = OBJETS['hache']['tool']
    coups = RESSOURCES['chene']['work'] / hache['work']['power'] * hache['gestureSeconds']
    buches = moyenne_butin('chene', 'buche')
    liste = [
        ('œufs du poulailler', 'oeuf', periode['poules'], h['seconde_par_oeuf'],
         prix_d_achat(POULE['food'], periode['absents']) * POULE['ration']),
        ('bûches des chênes', 'buche', compter('chene') / RESSOURCES['chene']['respawnDays'] * buches,
         (coups + h['marche_par_arbre']) / buches, 0),
        ('pierres', 'pierre', compter('caillou') / RESSOURCES['caillou']['respawnDays'], h['marche_par_caillou'], 0),
        ('vieilles pièces (fouilles)', 'vieille-piece',
         compter('point-de-fouille') / RESSOURCES['point-de-fouille']['respawnDays']
         * moyenne_butin('point-de-fouille', 'vieille-piece'),
         h['marche_par_fouille'] + RESSOURCES['point-de-fouille']['work'] / OBJETS['beche']['tool']['work']['power'], 0),
    ]
    tas = MEUBLES['tas-de-bois']['bricks'][0]
    par_tas = tas['stock']['count'] * min(2, 1440 / tas['stock']['refillMinutes'])
    liste.append(('bûches des tas de bois', 'buche', compter('tas-de-bois') * par_tas,
                  tas['seconds'] + h['marche_par_tas'] / tas['stock']['count'], 0))
    # Potager: radis arrosés chaque jour (le meilleur résultat), une récolte tous les `sum(stages)` jours.
    radis = CULTURES['radis']
    cycle = sum(radis['stages'])
    recolte = radis['qualities'][-1]
    liste.append(('radis croquants du potager', recolte['item'], periode['cases'] * recolte['count'] / cycle,
                  h['seconde_par_case_et_par_jour'] * cycle / recolte['count'],
                  prix_d_achat(radis['seed'], periode['absents']) / recolte['count']))
    if periode['peche']:
        liste.append(('pêche', '*poisson', h['poissons_par_jour_au_plus'], h['seconde_par_poisson'], 0))
    return liste


def journee(periode, part, cuisine=False):
    """Revenu net d'une journée du duo (centimes), et son détail par activité."""
    temps = 2 * part * JOUR_S - HYPOTHESES['tournee_fixe']
    reste = {c['id']: c.get('dailyBuyCap', 10 ** 9) for c in COMMERCES.values() if c['id'] not in periode['absents']}
    lots = []
    for nom, objet, unites, secondes, frais in activites(periode):
        if objet == '*poisson':
            offres = [(valeur_moyenne_poisson(periode['absents']), 'cafe-de-la-halte')]
        else:
            offres = prix_de_rachat(objet, periode['absents'])
        if not offres:
            continue
        lots.append(dict(nom=nom, objet=objet, unites=unites, secondes=secondes, frais=frais, offres=offres))
    if cuisine and periode['cuisine_possible']:
        # La vraie cuisine transforme les œufs: deux œufs font une omelette, deux si elle est parfaite.
        h = HYPOTHESES
        oeufs = next(l for l in lots if l['objet'] == 'oeuf')
        offres = prix_de_rachat('omelette', periode['absents'])
        if offres:
            par_fournee = 1 + h['part_d_omelettes_parfaites']
            lots.append(dict(nom='omelettes (œufs cuisinés)', objet='omelette', unites=oeufs['unites'] / 2 * par_fournee,
                             secondes=(h['seconde_par_omelette'] + 2 * oeufs['secondes']) / par_fournee,
                             frais=2 * oeufs['frais'] / par_fournee, offres=offres))
            lots.remove(oeufs)
    # Le plus rentable à la seconde d'abord; une pile vendue coûte aussi le passage au comptoir.
    lots.sort(key=lambda l: (l['offres'][0][0] - l['frais']) / l['secondes'], reverse=True)
    detail, revenu = [], 0.0
    for lot in lots:
        vendues, gagne = 0.0, 0.0
        a_vendre = lot['unites']
        for prix, commerce in lot['offres']:
            if a_vendre <= 0 or temps <= 0:
                break
            pile = OBJETS.get(lot['objet'], {'stack': 3})['stack']
            par_unite = lot['secondes'] + HYPOTHESES['vente_par_pile'] / pile
            n = min(a_vendre, temps / par_unite, reste[commerce] / prix)
            if n <= 0:
                continue
            temps -= n * par_unite
            reste[commerce] -= n * prix
            a_vendre -= n
            vendues += n
            gagne += n * (prix - lot['frais'])
        if vendues > 0:
            detail.append((lot['nom'], vendues, gagne))
            revenu += gagne
    repas = 2 * HYPOTHESES['pains_par_joueur_et_par_jour'] * prix_d_achat('pain')
    return revenu, repas, detail


def euros(centimes):
    return ('%.2f' % (centimes / 100)).replace('.', ',')


def table_des_prix():
    lignes = ['| Objet | Meilleur rachat | Autres rachats | En rayon |', '|---|---|---|---|']
    noms = {c['id']: c['name'] for c in COMMERCES.values()}
    for ident, objet in OBJETS.items():
        rachats = prix_de_rachat(ident, ())
        ventes = sorted((l['price'], c['id']) for c in COMMERCES.values() for l in c['sells'] if l['item'] == ident)
        if not rachats and not ventes:
            continue
        meilleur = '%s (%s)' % (euros(rachats[0][0]), noms[rachats[0][1]]) if rachats else 'non'
        autres = ', '.join('%s (%s)' % (euros(p), noms[c]) for p, c in rachats[1:]) or ''
        rayon = ', '.join('%s (%s)' % (euros(p), noms[c]) for p, c in ventes) or ''
        lignes.append('| %s | %s | %s | %s |' % (objet['name'], meilleur, autres, rayon))
    return '\n'.join(lignes)


def table_des_revenus():
    lignes = ['| Période | ' + ' | '.join('%s (%d %%)' % (n, p * 100) for n, p in PROFILS) + ' |', '|---|---|---|---|']
    for periode in PERIODES:
        cellules = []
        for _, part in PROFILS:
            revenu, repas, _ = journee(periode, part)
            cellules.append('%s (net %s)' % (euros(revenu), euros(revenu - repas)))
        lignes.append('| %s | %s |' % (periode['nom'], ' | '.join(cellules)))
    return '\n'.join(lignes)


def table_du_detail(periode, part):
    revenu, repas, detail = journee(periode, part, cuisine=True)
    lignes = ['| Activité | Unités vendues | Gain (€) |', '|---|---|---|']
    for nom, unites, gagne in detail:
        lignes.append('| %s | %.1f | %s |' % (nom, unites, euros(gagne)))
    lignes.append('| **Total de la journée à deux** | | **%s** |' % euros(revenu))
    lignes.append('| pain (2 par joueur) | | -%s |' % euros(repas))
    return '\n'.join(lignes)


def etapes_de_la_maison():
    """(pièce, prix en centimes, matériaux achetés en centimes, premier jour possible)."""
    ouverture = {'cuisine': 5, 'chambre': 11, 'troisieme-piece': 11, 'etage': 11}
    out = []
    for piece in MAISON['rooms']:
        prix = sum(e['cost'] for e in piece['stages'])
        if prix == 0:
            continue
        achats = sum((prix_d_achat(m['item']) or 0) * m['count'] for e in piece['stages'] for m in e['materials'])
        out.append((piece['name'], prix, achats, ouverture[piece['id']]))
    return out


def jours_de_la_maison(part, part_au_coffre=0.5):
    """Jour où chaque étape est payée: la moitié du revenu net va au coffre commun (hypothèse du cahier)."""
    coffre, jour, paye = 0.0, 0, []
    a_payer = etapes_de_la_maison()
    cuisine = False
    while a_payer and jour < 400:
        jour += 1
        periode = next(p for p in PERIODES if p['jours'][0] <= jour <= p['jours'][1])
        revenu, repas, _ = journee(periode, part, cuisine)
        coffre += part_au_coffre * max(0.0, revenu - repas)
        nom, prix, achats, des_le = a_payer[0]
        if jour >= des_le and coffre >= prix + achats:
            coffre -= prix + achats
            paye.append((nom, jour))
            a_payer.pop(0)
            cuisine = True
    return paye


def table_de_la_maison():
    etapes = etapes_de_la_maison()
    par_profil = [dict(jours_de_la_maison(part)) for _, part in PROFILS]
    lignes = ['| Étape | Prix | Matériaux achetés | ' + ' | '.join(n for n, _ in PROFILS) + ' |', '|---|---|---|---|---|---|']
    for nom, prix, achats, _ in etapes:
        jours = ' | '.join('jour %d' % p[nom] if nom in p else 'au-delà de 400' for p in par_profil)
        lignes.append('| %s | %s € | %s € | %s |' % (nom, euros(prix), euros(achats), jours))
    return '\n'.join(lignes)


SAISONS = [('printemps', 'spring'), ('été', 'summer'), ('automne', 'autumn'), ('hiver', 'winter')]


def table_des_pommes():
    """Pommes des arbres de la carte, par saison: unités par jour et valeur au meilleur rachat.
    Hors du revenu ci-dessus (le duo n'y passe que quelques secondes), donné pour juger d'un
    changement de saison des fruits (pommes d'Aubrune en automne seulement, 2026-11-11)."""
    lignes = ['| Saison | Arbres | Pommes par jour | Valeur au rachat (€ par jour) |', '|---|---|---|---|']
    prix = prix_de_rachat('pomme', set())[0][0]
    for nom, saison in SAISONS:
        arbres, pommes = 0, 0.0
        for o in CARTE['objects']:
            meuble = MEUBLES.get(o['type'])
            for brique in (meuble or {}).get('bricks', []):
                if brique.get('brick') != 'harvest':
                    continue
                r = RESSOURCES[brique['resource']]
                lignes_butin = [l for l in r['loot'] if not l['rare'] and not l['weathers']
                                and (not l['seasons'] or saison in l['seasons'])]
                total = sum(l['weight'] for l in r['loot'] if not l['rare'] and not l['weathers'])
                par_recolte = r['rolls'] * sum(l['weight'] / total * (l['min'] + l['max']) / 2
                                               for l in lignes_butin if l['item'] == 'pomme')
                if any(l['item'] == 'pomme' for l in r['loot']):
                    arbres += 1
                    pommes += par_recolte / r['respawnDays']
        lignes.append('| %s | %d | %.1f | %s |' % (nom, arbres, pommes, euros(pommes * prix)))
    return '\n'.join(lignes)


def main():
    print('Journée de jeu: %.0f s réelles (%.1f min)\n' % (JOUR_S, JOUR_S / 60))
    print('## Prix\n\n' + table_des_prix() + '\n')
    print('## Revenu d\'une journée à deux (euros, brut puis net du pain)\n\n' + table_des_revenus() + '\n')
    for periode in PERIODES:
        print('## Détail, duo médian, %s, cuisine achetée si possible\n\n%s\n' % (periode['nom'], table_du_detail(periode, 0.40)))
    print('## Jours pour payer la maison (moitié du revenu net au coffre commun)\n\n' + table_de_la_maison() + '\n')
    print('## Pommes des arbres de la carte, par saison (hors revenu ci-dessus)\n\n' + table_des_pommes() + '\n')
    plafonds = sum(c.get('dailyBuyCap', 0) for c in COMMERCES.values())
    print('Plafond de rachat de tous les commerçants réunis: %s € par jour.' % euros(plafonds))
    return 0


if __name__ == '__main__':
    sys.exit(main())
