# Carnet du game designer

Apprentissages durables (pièges, conventions, repères vérifiés). Pas d'avancement ici.

## Conventions de rédaction

- Dans les documents que lit le client, ne pas nommer les jeux qu'il cite en référence: écrire « le jeu de référence « île paisible » » ou « le jeu de référence de simulation de vie », et lister les éléments emblématiques écartés de façon générique.
- Tutoiement: le jeu tutoie chaque joueur; un personnage qui s'adresse aux deux joueurs à la fois dit « vous » (pluriel), ce qui reste conforme.
- Chiffres d'un plan de sortie: vérifier que version 1 + épisodes + activités transversales retombent sur le total annoncé (erreur commise puis corrigée le 2026-10-30).

## Homonymies et concepts déjà pris (à vérifier avant de proposer)

- Village bâti sur le dos d'une créature géante qui marche: existe déjà (city builder sorti en 2022).
- Taverne ou auberge avec ferme, brassage et coopération en ligne: genre encombré, plusieurs jeux existants; s'en distinguer nettement.
- « Les Discrets »: nom d'un groupe de musique français; éviter comme titre.

## Repères de rythme (script `docs/jeux/jeu-1/simulations/rythme_et_collections.py`)

- Une journée de jeu d'environ 17 minutes réelles et quatre saisons d'environ 20 jours donnent environ 24 heures par année de jeu: 100 heures font environ 4 années de jeu et 150 séances de 40 minutes.
- À 2 heures de jeu par semaine, 100 heures font environ un an de vie réelle.

## Collections tirées au hasard

- Sans aide, avec raretés (poids 6, 3, 1) et disponibilité saisonnière, atteindre 100 % prend 2 à 4 fois plus longtemps qu'atteindre 90 %: la fin traîne et ennuie.
- Un coup de pouce (poids x4 pour les entrées jamais vues) ramène l'achèvement juste après le dernier contenu débloqué. En faire la règle par défaut, réglable dans les tables d'équilibrage.

## Pièges de simulation

- Ne pas déduire un numéro de saison par division d'un temps en virgule flottante: au retour sur une frontière (6,6 x 3), l'arrondi peut bloquer la boucle sans fin. Compter les saisons par un entier.
- Pour une collection, seul compte l'instant de la prochaine entrée nouvelle: simuler cet événement (loi exponentielle entre deux changements d'état) est exact et des centaines de fois plus rapide que de simuler chaque tirage.

## Contrôles

- En AZERTY, la rangée des chiffres demande Maj: ne jamais en faire un passage obligé (barre d'outils à la molette, chiffres en raccourci facultatif).
