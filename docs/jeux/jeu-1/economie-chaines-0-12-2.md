# La Petite Ligne 0.12.2: ce que vaut chaque étape d'une chaîne de production

Demande du client (3 novembre): « Est-ce rentable de nourrir les poules et vendre les œufs, avec le prix du sac de grain ? Il faut que tout soit calculé pour que, plus il y a d'étapes d'acquisition, plus le prix est haut (poule, sac de grain, œuf, omelette, etc.), pareil pour tous les autres aspects du jeu. »

Calcul: `python3 -I docs/jeux/jeu-1/simulations/economie_chaines.py --chaines` (lit les données du jeu, moins d'une seconde, code de sortie 1 s'il signale quelque chose). Contrôle permanent: `tests/economie-chaines.test.ts`. Règle en données: `reglages.economy.chains`.

## En bref

- **Oui, les œufs sont rentables, et ils le restent.** Avant le patch, un sac de grain à 25 aubrins faisait 30 rations: 0,83 aubrin par œuf, qu'Odette paie 6,4. Le grain ne pesait que 13 % de l'œuf, il ne comptait pas. Le sac passe à 40 (1,33 la ration, 21 % de l'œuf): une poule nourrie rapporte encore 5,1 aubrins net par jour, une poule bien soignée (beaux œufs) 8,3.
- **Sur les onze recettes qui font un produit à vendre, sept étaient sous la règle et deux plats n'avaient aucun prix** (la croque-au-sel et la soupe). La poêlée de girolles ne rapportait rien, la cagette faisait perdre de l'argent, la gelée de sureau ne gagnait que 10 %. Après le patch, chaque étape rapporte au moins sa marge, et le script ne signale plus rien.
- Les quantités des recettes ne changent pas (les textes du jeu les citent): seuls les prix de vente et le prix du grain bougent. Les commandes du samedi, l'ardoise, les annonces et les quêtes ne changent pas.

## 1. La règle

**Valeur d'Odette.** Toutes les valeurs se comptent au prix de base du comptoir d'Odette: le prix de vente (`sellPrice`) x 0,8, pour une unité ordinaire, en saison neutre, avant que l'offre ne baisse. Un intrant acheté vaut son prix d'achat. Un intrant récolté vaut ce qu'Odette en donnerait: le transformer, c'est renoncer à le vendre. C'est le cas le plus strict: à l'étal du dimanche (x 1 à x 1,5 du prix de vente) et à la commande (x 1,5), produits et récoltes montent ensemble et les achats pèsent moins.

**Une étape de transformation** (réchaud, établi) doit rapporter:

valeur du produit ≥ valeur des intrants x (1 + marge) + temps passé x valeur du temps

| Réglage (`reglages.economy.chains`) | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Marge minimale (`minMargin`) | 0,25 | part de la valeur des intrants | 0,2 à 0,4 | une étape de plus doit se voir dans le prix (le client); moins de 25 %, on ne fait pas l'effort |
| Marge par filière en plus (`extraSourceMargin`) | 0,10 | par filière d'intrants au-delà de la première | 0,05 à 0,15 | réunir des intrants de deux filières (lisière et poulailler, bois et clous de l'épicerie) demande de se répartir le travail: la coopération demandée se paie |
| Valeur du temps (`minuteValue`) | 0,20 | aubrin par minute de jeu | 0,15 à 0,25 | ce que rapporte une minute de pêche ordinaire chez Odette (environ 12 aubrins l'heure de jeu, section 4): l'activité sans plafond qu'on ferait à la place |
| Manutention (`handlingSeconds`) | 4 | secondes réelles, ajoutées à la durée de la recette | 2 à 6 | aller au poste, choisir la recette, ranger le produit |
| Catégories d'usage (`usageCategories`) | meubles | | | table, chaise, étagères, lit: faits pour la maison, sans prix de vente, hors règle |
| Remboursement d'une bête (`paybackDays`) | 14 à 42 | jours de jeu, bête bien soignée, produits vendus bruts | | en une à deux saisons: assez vite pour que l'achat se sente, pas assez pour être une évidence |

Une **filière** est l'origine d'un intrant: un achat chez Odette, une bête (poules, chèvre), ou la catégorie de l'objet (potager, lisière, rivière, bois). Le temps se compte pour un joueur seul; les recettes faites à deux au même poste vont deux fois plus vite (`building.twoPlayersRecipes`), donc leur marge par minute double.

**Plus d'étapes, plus de valeur.** Chaque étape ajoute au moins 25 % et son temps, donc la valeur d'une chaîne monte à chaque étape: arbre, rondin (sans prix), 8 planches 38,4, une cagette 19,2 pour deux planches et un clou (11,6).

**Cas particuliers, tranchés.**

| Cas | Règle |
|---|---|
| Intrant sans prix (rondin) | vaut 0: seul son temps compte (la coupe de l'arbre est payée par les planches) |
| Meubles fabriqués | objets d'usage, sans prix de vente: la pièce est petite, on ne revend pas ce qu'on a bâti pour la maison |
| Pain, brioche, pain chaud, chocolat chaud | achetés à Achille et à Odette pour être mangés, pas des produits du duo: pas de revente |
| Culture | la récolte d'une case vaut au moins la graine x 1,25 plus le temps des gestes (semer, arroser, récolter) |
| Élevage | d'abord couvrir l'entretien: un œuf vaut au moins sa ration de grain x 1,25. Puis rapporter: une bête du catalogue bien soignée se rembourse en 14 à 42 jours |
| Produits gratuits (cueillette, pêche) | modestes: au plus le double de la valeur du temps par heure de jeu active |
| Activité | aucune ne rapporte moins de la moitié de la valeur du temps (inutile), aucune ne domine toutes les autres à la fois par jour et par heure active |

## 2. Avant et après

Valeurs d'Odette (aubrins). « Exigé »: ce que la règle demande au produit.

| Étape | Intrants | Produit avant | Marge avant | Produit après | Marge après | Exigé |
|---|---|---|---|---|---|---|
| Sac de grain → œuf (une ration) | 0,83 → 1,33 | 6,4 | +670 % | 6,4 | +380 % | 1,7 |
| 3 œufs → 2 omelettes | 19,2 | 32,0 | +67 % | 32,0 | +67 % | 26,0 |
| 3 girolles, 1 œuf → 2 poêlées | 35,2 | 35,2 | 0 % | 51,2 | +45 % | 49,8 |
| 2 bidons de lait → 1 fromage frais | 14,4 | 19,2 | +33 % | 22,4 | +56 % | 20,3 |
| 8 mûres, 1 sucre, 2 bocaux → 2 confitures | 26,2 | 32,0 | +22 % | 41,6 | +59 % | 38,2 |
| 6 grappes, 1 sucre, 2 bocaux → 2 gelées | 26,2 | 28,8 | +10 % | 41,6 | +59 % | 38,2 |
| 8 noisettes → 1 cornet grillé | 19,2 | 24,0 | +25 % | 27,2 | +42 % | 26,3 |
| 3 radis → 2 croque-au-sel | 16,8 | sans prix | | 25,6 | +52 % | 23,0 |
| 2 carottes, 2 radis, 1 laitue → 2 soupes | 62,4 | sans prix (60 à la commande seulement) | | 96,0 | +54 % | 80,0 |
| 2 planches, 1 clou → 1 cagette | 11,6 | 11,2 | -3 % | 19,2 | +66 % | 17,9 |
| 3 planches, 2 clous → 1 nichoir | 18,4 | 24,0 | +30 % | 28,8 | +57 % | 27,7 |
| 1 rondin → 4 planches | 0 | 19,2 | | 19,2 | | 3,4 |
| Potager: sachet → 3 radis; laitue; 3 carottes | 6; 8; 12 | 16,8; 25,6; 38,4 | +180 à +220 % | inchangé | | 9,8; 12,9; 18,4 |

Valeurs changées (`objets.json`; prix de vente au comptoir, avant le x 0,8 d'Odette):

| Objet | Champ | Avant | Après | Plage | Raison |
|---|---|---|---|---|---|
| sac de grain | `buyPrice` | 25 | 40 | 35 à 70 | le grain devient un vrai coût (21 % de l'œuf) sans que la poule cesse de rapporter; au-delà de 70, la poule blanche ne se rembourse plus en deux saisons |
| radis à la croque-au-sel | `sellPrice` | aucun | 16 | 15 à 20 | le prix que la commande lui donnait déjà |
| soupe de légumes | `sellPrice` | aucun | 60 | 50 à 70 | le prix que la commande et l'annonce de Firmin lui donnaient déjà |
| fromage frais | `sellPrice` | 24 | 28 | 26 à 32 | deux traites et le réchaud |
| confiture de mûres | `sellPrice` | 20 | 26 | 24 à 30 | mûres, sucre et bocaux de l'épicerie: deux filières |
| gelée de sureau | `sellPrice` | 18 | 26 | 24 à 30 | mêmes intrants en valeur que la confiture, et le sureau ne se cueille que deux semaines par an |
| noisettes grillées | `sellPrice` | 30 | 34 | 33 à 38 | huit noisettes pour un seul cornet |
| poêlée de girolles | `sellPrice` | 22 | 32 | 32 à 36 | girolles de la lisière et œuf du poulailler: deux filières |
| cagette | `sellPrice` | 14 | 24 | 23 à 28 | troisième étape du bois (rondin, planche, cagette), plus un clou acheté |
| nichoir | `sellPrice` | 30 | 36 | 35 à 40 | trois planches et deux clous |

Dans `reglages.json`, la commande ne porte plus de prix propre pour la croque-au-sel et la soupe (16 et 60): elle prend désormais leur prix de vente, le même. Rien ne bouge dans les paiements.

**Rations: inchangées** (30 par sac, une par poule et par jour). Jouer sur le prix seul garde les tests et le texte « Trente rations » justes. Quand les poules picorent le pré (printemps, été), un œuf un jour sur deux sans grain: nourrir rapporte encore une demi-poule d'œufs (3,2) pour 1,33 de grain.

## 3. L'élevage

| Bête du catalogue | Prix | Gain net par jour, bien soignée | Remboursée en | Nourrie seulement |
|---|---|---|---|---|
| poule rousse (Brioche) | 250 | 8,3 (un bel œuf moins sa ration) | 30 jours | 49 jours |
| poule blanche (Pervenche) | 300 | 8,3 | 36 jours | 59 jours |
| deuxième chèvre | 450 | 14,4 (deux bidons, pâture gratuite) | 31 jours | 62 jours |

Bien soignée: une poule ravie (80 et plus) pond un bel œuf (x 1,5); une chèvre gaie donne deux bidons. Les soins se paient donc en argent, pas seulement en humeur. La poule blanche et la deuxième chèvre paraissent au catalogue le jour 43: elles se remboursent après le jour 64, à la reprise de la même sauvegarde (question 3).

## 4. Ce que rapporte une heure de jeu

Une heure de jeu est une heure de l'horloge du jeu (42 s réelles), comme dans la conception de la pêche. Valeurs d'Odette, nettes des graines et du grain. Les durées des gestes sont des hypothèses écrites en tête du script (2 s par geste au potager, 60 s pour le tour de la lisière, 12 s par prise...). Une séance d'une heure réelle fait 4,8 journées.

| Activité | Gain net au plus par jour | Temps actif par jour (min de jeu) | Par heure de jeu active | Par heure réelle, si on la fait chaque jour |
|---|---|---|---|---|
| potager, 12 cases de radis; laitues; carottes | 65; 70; 79 | 69; 57; 51 | 57; 74; 92 | 309; 335; 377 |
| cueillette (printemps, été, automne) | 26 à 30 | 90 | 17 à 20 | 123 à 142 |
| pêche | sans plafond | | 10 à 11 (estimation du script); 11 à 14 d'après les mesures de la conception de la pêche (coin qui frémit, heures dorées) | 520 à 920 pour un joueur qui ne fait que pêcher, selon la saison et l'offre d'Odette |
| 5 poules nourries; bien soignées | 25; 41 | 16; 42 | 97; 59 | 121; 197 |
| une chèvre bien soignée, lait; en fromage | 14; 22 | 53; 64 | 16; 21 | 69; 107 |
| bois (1,2 arbre par jour, en planches) | 46 | 96 | 29 | 219 |
| plis de Lucie, avant midi | 29 | 87 | 20 | 136 |

Lecture. Les activités à plafond (potager, poules, bois) rapportent le plus par minute, mais peu de minutes par jour; la pêche rapporte le moins par minute, mais sans fin: c'est elle qui fixe la valeur du temps, et c'est le temps libre qu'on y met qui décide de sa part. Aucune activité ne domine les autres à la fois par jour et par heure active, aucune ne tombe sous la moitié de la valeur du temps. La chèvre est la moins rentable à la minute (beaucoup de soins pour deux bidons): c'est voulu, elle se soigne à deux et se rattrape en fromage. Les produits gratuits restent modestes: cueillette et pêche sous 24 aubrins l'heure de jeu active.

## 5. Ce qui ne change pas

- Commandes du samedi: les lignes et leurs paiements sont identiques (leurs prix viennent de la table de la commande ou de prix de vente inchangés; la soupe et la croque-au-sel gardent 60 et 16). Ce qui est nouveau: une soupe ou une croque-au-sel posée en plus dans la caisse est payée (60 et 16) au lieu de revenir au cellier, et les autres produits en plus sont payés à leur nouveau prix.
- Ardoise d'Odette: elle peut désormais afficher la soupe ou la croque-au-sel (articles qui ont un prix et que le duo a déjà faits).
- Quêtes, annonces, astuces, textes: aucun ne cite un prix qui bouge; « trois œufs font deux omelettes » et les recettes des textes restent justes. Les récompenses de quête sont des sommes fixes. Coïncidence heureuse: les 40 aubrins de Jeanne « pour le grain » paient désormais un sac exactement.
- Sauvegardes: les prix ne sont pas dans l'état, rien à migrer.
- La bourse bouge à peine. Simulation de la 0.12 (`v0_12_economie.py`, 300 graines, duo médian, l'élevage d'abord) relancée avec le grain à 40, le fromage à 28 et les conserves au nouveau prix: revenus des jours 1 à 64 de 20 833 à 21 150 (+1,5 %), grain de 218 à 351, bourse au jour 64 de 3 424 à 3 618. Le grain coûte un peu plus, les transformations rapportent un peu plus: les deux se compensent presque.

## 6. Limites connues et questions

1. **Un produit sort toujours « ordinaire »**, même fait d'intrants beaux: trois beaux œufs (28,8) donnent deux omelettes ordinaires (32,0), soit +11 %; trois beaux radis donnent une croque-au-sel à +2 %, la soupe de beaux légumes +3 %. Recommandation: en 0.13, le produit est beau quand tous ses intrants récoltés le sont (petit changement de code, dev gameplay); la règle tient alors aussi pour les beaux produits.
2. **« Une recette faite à deux rapporte plus. »** Aujourd'hui, à deux au même poste, une recette va deux fois plus vite (marge par minute doublée), mais l'omelette, la croque-au-sel et la soupe n'y sont pas. Recommandation: les ajouter à `building.twoPlayersRecipes` (une ligne de réglage) pour que la règle vaille pour tout le réchaud.
3. **Bêtes du catalogue d'automne** (poule blanche 300, deuxième chèvre 450, jour 43): remboursées en 36 et 31 jours bien soignées, donc après le jour 64. Recommandation: garder ces prix, la partie reprend sur la même sauvegarde; les baisser (250 et 350) seulement si le client veut les voir rentrer dans leurs frais avant l'hiver.

## Historique

- 2026-11-03: création (0.12.2), règle des chaînes, script et test, prix rééquilibrés.
