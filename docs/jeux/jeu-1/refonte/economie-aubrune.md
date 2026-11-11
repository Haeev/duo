# Économie d'Aubrune: commerces, prix, revenu, maison

Version 1 du 2026-11-11 (game-designer). Complète le cahier des charges (4.2 et 4.6). Les valeurs vivent dans les données du jeu; ce document les explique. Les tableaux de prix et de revenu sortent du script `docs/jeux/jeu-1/simulations/economie_aubrune.py`, qui lit ces données: en cas d'écart, les données font foi et on relance le script.

## 1. Les sept commerces

Fiches: `games/la-petite-ligne-2/donnees/lieux/aubrune/commerces/`. Chaque commerce ouvre à 7 h et ferme quand son commerçant quitte son poste (la ligne de planning porte le champ `shop`). Tous: bonus d'amitié de 10 % sur les rachats à 3 cœurs, un besoin du jour payé 50 % de plus, un plafond de rachat par jour.

| Commerce | Tenu par | Où | Heures | En rayon | Rachète | Plafond par jour |
|---|---|---|---|---|---|---|
| Épicerie Ferrand | Odette | comptoir de la boutique, face à la porte de la place | 7 h à 21 h | pomme, farine, grain, graines de radis et de tomate, livre de cuisine (avec le réchaud), bœuf (avec le repas de l'acte 3) | ce qui se mange, au prix le plus bas | 20 € |
| Fournil Pradel | Achille | comptoir devant le four, à droite en entrant | 7 h à 18 h | pain, tarte aux pommes | œufs (le mieux payé), pommes, mûres, bûches, tartes | 15 € |
| Café de la Halte | Colette (acte 2) | comptoir au fond de la salle, à droite | 7 h à 22 h | soupe de légumes (plat du jour), omelette | poissons, légumes, œufs, plats cuisinés (le mieux payé) | 45 € |
| Mercerie Mérigot | Solange | comptoir de la boutique, à l'ouest de la porte | 7 h à 19 h 30 | sac de toile (après les besaces), filet à insectes | coquelicots, vieilles pièces | 10 € |
| Forge Cazals | Mado | râtelier de la forge | 7 h à 20 h | pierre à aiguiser, hache, bêche | pierres, bûches | 8 € |
| Menuiserie Cornu | Basile | en lui parlant, sous son auvent | 7 h à 20 h | planche (bourse ou coffre commun), marteau | bûches (le mieux payé) | 12 € |
| Cour des Delmas | Margot (acte 3) | en lui parlant, dans la cour de la ferme | 7 h à 20 h | carotte, poireau, pomme de terre, grain et graines moins chers qu'au bourg | mûres, coquelicots | 6 € |

Raisons des emplacements. Les cinq comptoirs sont ceux que le plan dessinait « à créer »; ils deviennent cinq types de meubles (`comptoir-epicerie`, `comptoir-fournil`, `comptoir-cafe`, `comptoir-mercerie`, `ratelier-de-la-forge`). Faute de modèle de comptoir livré, ils montrent la table de ferme (`table-farm`), le tonneau (`barrel`, au café) et l'étagère (`shelf`, à la forge), trois modèles livrés: une ligne à changer dans chaque fiche quand les modèles `comptoir` et `ratelier` existeront. Deux ont bougé d'une case pour tenir sur la grille et laisser libre l'axe de la porte: le comptoir d'Odette (2,5; 3) et celui d'Achille, à l'est devant le four (5; 2,5). Celui de Colette garde sa case (4,5; 1,5) et n'en fait qu'une: large de deux, il fermait soit le passage derrière le comptoir, soit l'accès à la table de l'est. Le râtelier de la forge donnait une hache forgée gratuite par jour: il est devenu le comptoir de Mado. Basile et Margot vendent dehors, là où ils travaillent: pas de comptoir à inventer.

Deux façons d'ouvrir une boutique: la touche d'action sur le comptoir, ou « regarder » à la fin de toute conversation avec le commerçant (champ `talk`).

## 2. Les prix

Prix de base en euros. « Meilleur rachat » dit où porter l'objet: c'est la leçon de l'œuf, généralisée.

| Objet | Meilleur rachat | Autres rachats | En rayon |
|---|---|---|---|
| Œuf | 1,00 (Fournil) | 0,70 (Café), 0,60 (Épicerie) | |
| Œuf roux | 1,50 (Fournil) | 1,10 (Café), 1,00 (Épicerie) | |
| Radis | 0,70 (Café) | 0,50 (Épicerie) | |
| Radis croquant | 1,00 (Café) | 0,80 (Épicerie) | |
| Tomate | 0,80 (Café) | 0,60 (Épicerie) | |
| Mûres | 0,50 (Fournil) | 0,40 (Café, Delmas), 0,30 (Épicerie) | |
| Coquelicot | 0,60 (Mercerie) | 0,50 (Café, Delmas), 0,40 (Épicerie) | |
| Bûche | 0,60 (Menuiserie) | 0,50 (Fournil), 0,40 (Forge) | |
| Pierre | 0,30 (Forge) | | |
| Vieille pièce | 1,20 (Mercerie) | | |
| Goujon | 1,20 (Café) | | |
| Ablette | 1,00 (Café) | | |
| Perche | 2,00 (Café) | | |
| Tanche | 2,50 (Café) | | |
| Truite fario | 3,00 (Café) | 2,00 (Épicerie) | |
| Brochet | 5,00 (Café) | | |
| Œuf au plat | 1,20 (Café) | | |
| Omelette aux herbes | 2,20 (Café) | | 3,50 (Café) |
| Soupe de légumes | 2,00 (Café) | 1,50 (Épicerie) | 3,00 (Café) |
| Pommes sautées | 2,00 (Café) | | |
| Tarte aux pommes | 1,70 (Fournil) | | 4,50 (Fournil) |
| Tarte bien dorée | 2,00 (Fournil) | | |
| Pomme | 0,70 (Fournil) | 0,60 (Café) | 0,90 (Épicerie) |
| Carotte | 1,10 (Café) | 0,80 (Épicerie) | 1,60 (Delmas) |
| Poireau | 1,20 (Café) | 0,90 (Épicerie) | 1,80 (Delmas) |
| Pomme de terre | 0,90 (Café) | 0,60 (Épicerie) | 1,40 (Delmas) |
| Pain | non | | 1,20 (Fournil) |
| Farine | non | | 0,80 (Épicerie) |
| Morceau de bœuf | non | | 3,50 (Épicerie) |
| Grain (la ration) | non | | 0,10 (Delmas), 0,20 (Épicerie) |
| Graines de radis (la graine) | non | | 0,20 (Delmas, Épicerie) |
| Graines de tomate (la graine) | non | | 0,60 (Delmas), 0,80 (Épicerie) |
| Planche | non | | 1,60 (Menuiserie) |
| Pierre à aiguiser | non | | 1,50 (Forge) |
| Hache, bêche | non | | 8,00 (Forge) |
| Marteau | non | | 5,00 (Menuiserie) |
| Filet à insectes | non | | 6,00 (Mercerie) |
| Sac de toile (6 cases) | non | | 35,00 (Mercerie) |
| Livre de cuisine | non | | 12,00 (Épicerie) |

Ne se revendent nulle part, et c'est voulu: tartine, pomme cuite (un pain ou une pomme achetés), pot-au-feu et tourte (repas spéciaux), meubles fabriqués, nichoir, lanterne, outils, fossile (il va au carnet; l'école d'Armand, qui devait l'acheter, n'a rien à vendre et n'est pas livrée).

Règles qui empêchent d'imprimer de l'argent, vérifiées par `tests/commerces-aubrune.test.ts` sur tous les objets, toutes les recettes et tous les plans, au pire des bonus cumulés (besoin du jour x 1,5, amitié x 1,1, repas « meilleurs prix » x 1,1):

- un objet en rayon quelque part n'est jamais besoin du jour, et sa meilleure revente reste sous son prix d'achat (pomme: 0,80 au mieux contre 0,90);
- une recette dont tous les ingrédients s'achètent ne rapporte rien, même réussie « parfaite » (soupe de légumes: 4,80 € de légumes, 4,80 € au mieux pour deux soupes);
- un plan ne produit rien qu'un commerçant rachète;
- les commerçants ne rachètent que des objets nommés (aucune famille entière): un objet ajouté plus tard ne se vend pas par accident;
- un dialogue qui vend un objet le vend au prix du rayon.

Ce qui rapporte reste ce qui se récolte, se pêche ou se pond, borné par le lieu et par le plafond de chaque commerçant. Cuisiner sa récolte paie: deux œufs valent 2 € chez Achille, une omelette 2,20 € chez Colette, et deux omelettes si elle est parfaite.

Écarts au tableau du cahier (4.6), tous dus à ce qui existe aujourd'hui à Aubrune:

| Objet | Cahier | Ici | Raison |
|---|---|---|---|
| Pomme | Odette 0,60, Achille 0,90 | Odette la vend 0,90, Achille 0,70 | aucun pommier à Aubrune: la pomme s'achète, sa revente doit rester sous 0,90 |
| Soupe de légumes | Colette 3,50, Odette 2,00 | 2,00 et 1,50 | carotte, poireau et pomme de terre ne se cultivent pas encore: tout s'achète; à remonter quand les cultures existeront |
| Planche | Basile l'achète 1,40 | il la vend 1,60 et ne la rachète pas | aucun plan ne fait de planche |
| Ferraille, plume, coquille, girolle, insectes, fossile en double | prix prévus | absents | objets à créer, ou sans acheteur |

## 3. Le revenu d'une journée à deux

Modèle: le duo passe une part de sa journée (30 minutes réelles) à récolter et vendre, prend d'abord ce qui rapporte le plus à la seconde, dans la limite de ce que la carte produit et des plafonds. Tirages à leur moyenne, potager en radis arrosés, sans mûres ni tomates (saison), sans besoin du jour ni amitié.

| Période | Duo tranquille (25 % du temps) | Duo médian (40 %) | Duo appliqué (55 %) |
|---|---|---|---|
| Acte 1 (jours 1 à 4) | 23,90 € | 23,90 € | 23,90 € |
| Acte 2 (jours 5 à 10) | 46,30 € | 65,50 € | 67,20 € |
| Acte 3 et après | 48,20 € | 67,50 € | 69,40 € |

Le pain de la journée (deux par joueur) retire 4,80 €.

Journée type du duo médian à l'acte 2, cuisine achetée: radis croquants 10,80 €, omelettes 5,80 €, bûches 13,60 € (23 bûches), pêche 26,40 € (13 poissons), vieilles pièces 3,60 €, pierres 3,00 €: 63,20 €.

Lecture:

- À l'acte 1, le revenu est borné par la carte (6 cases de potager, 2 poules, 13 chênes, 10 cailloux, 6 fouilles), pas par le temps: les trois duos gagnent pareil, et personne n'a de raison de se presser. C'est doux pour un début.
- Dès l'acte 2, la pêche est le débouché du temps en plus: elle seule ne s'épuise pas. Le plafond de Colette (45 €) la borne pour le duo appliqué.
- Le revenu tombe dans la fourchette du cahier (22 à 41 € par joueur). Le sac ne change pas ces nombres, il épargne des allers-retours.
- Le tas de bois rendait 8 bûches toutes les 12 heures (18 € par jour sans outil): réglé à 4 bûches par jour.

## 4. La maison du garde-barrière

Fiche: `donnees/lieux/aubrune/logements/maison-du-garde.json`, sur les trois intérieurs existants. L'histoire ouvre, l'argent équipe: Basile fait le gros œuvre contre des bûches dans les scènes de l'histoire, puis chaque pièce se termine au coffre commun (complété par la bourse de qui paie), avec quelques matériaux et un travail plus rapide à deux. Basile annonce chaque devis et commente chaque pièce finie, en trois mots.

| Pièce | Attend | Prix | Matériaux | Travail seul | Ce qu'elle permet d'installer | Intérieur |
|---|---|---|---|---|---|---|
| Salle commune | le toit de l'acte 1 | 0 | aucun | 8 s | dormir, ranger | `maison-rdc`, moitié est |
| Cuisine | la scène du règlement (acte 2), la salle | 150 € | 4 planches, 4 pierres | 20 s | cuisiner, ranger | `maison-rdc`, mur sud de la salle |
| Chambre | la scène de la trappe (acte 3), la salle | 300 € | 6 planches, 2 bûches | 30 s | dormir, ranger | `maison-rdc`, nord-ouest |
| Troisième pièce | la chambre | 450 € | 8 planches, 4 pierres | 40 s | se laver, ranger | `maison-rdc`, sud-ouest |
| Étage | la troisième pièce | 800 € | 10 planches, 6 bûches | 60 s | dormir, ranger, se laver | `maison-etage` |
| Cave | la scène de la trappe, la salle | 0 | aucun | 20 s | ranger | `maison-cave` |

Chaque pièce restaurée compte pour le confort (bonus de sommeil) et retient le fait `aubrune.maison-du-garde.<pièce>`. Le logement s'appelle `maison-du-garde` et non `maison`, pour ne pas écraser les faits de l'histoire (`aubrune.maison.cuisine`). Meubles trouvés dans la maison à l'arrivée (inventaire): 2 coffres, 2 lits simples, 2 chaises, 1 miroir, 1 établi. Chaque pièce payée livre un indice de la vie d'Émile (carnet de menus, clou de la casquette, indicateurs cornés, lucarne): propositions à faire relire avec l'écriture.

Jours pour payer chaque étape, la moitié du revenu net allant au coffre commun (hypothèse du cahier), planches comprises:

| Étape | Prix | Planches achetées | Duo tranquille | Duo médian | Duo appliqué | Cahier (médian) |
|---|---|---|---|---|---|---|
| Cuisine | 150 € | 6,40 € | jour 10 | jour 8 | jour 8 | jour 7 |
| Chambre | 300 € | 9,60 € | jour 24 | jour 19 | jour 19 | jour 16 |
| Troisième pièce | 450 € | 12,80 € | jour 45 | jour 35 | jour 35 | jour 28 |
| Étage | 800 € | 16,00 € | jour 82 | jour 63 | jour 63 | jour 51 |

La cuisine est payée avant le repas de l'acte 3 (jour 11 et suivants) par les trois duos; l'étage reste un but au long cours (une année de jeu fait 56 jours).

## 5. Les répliques de comptoir

| Réplique | Où elle vit | Quand elle se dit |
|---|---|---|
| Accueil, ce qu'il achète, ce qu'il vend | dialogue `<habitant>-boutique` | la première fois qu'un joueur vient avec de quoi vendre, pendant les heures d'ouverture |
| Achat, pas assez d'argent | même dialogue: une offre payée sur place (pomme, quignon, soupe, coup de peigne, pierre à aiguiser, planche, carotte) | au choix du joueur |
| Fermé | dialogue `<habitant>-boutique-fermee` | la nuit |
| Ce qu'il ne rachète pas | champ `refusal` du commerce | dans l'écran de boutique |
| « Je regarde » et « au revoir » du joueur | champ `talk` du commerce | à la fin de chaque conversation |

Les jours suivants, le bonjour est celui du quotidien de l'habitant, suivi du choix d'ouvrir la boutique.

## 6. Ce que les briques ne font pas encore

| Manque | Conséquence aujourd'hui |
|---|---|
| Répliques du commerçant sur un achat, une vente, un refus d'argent, dans l'écran de boutique | l'écran dit des textes communs; les répliques écrites passent par les dialogues ci-dessus |
| Condition « a au moins tant d'argent » dans un dialogue | le refus se dit seulement quand un paiement échoue |
| Commerce ou rachat conditionné par l'histoire | le comptoir du café rachète avant l'arrivée de Colette (ses articles, eux, sont verrouillés) |
| Planning d'un habitant vers un point d'intérieur (deux tests chargent la carte sans les intérieurs) | les commerçants se tiennent devant leur porte; le comptoir se sert seul |
| Meuble de la carte qui apparaît avec un fait ou une pièce restaurée | cuisinière et plan de travail sont posés dès le début: payer la cuisine ouvre la pose de meubles et le confort, pas l'usage |
| Meubles vendus par un commerce, ou livrés à la fin d'une étape | les meubles viennent de l'inventaire de départ et de l'établi |
| Escaliers fermés tant que la pièce n'existe pas (les portes sont écrites par l'assembleur du plan) | on peut monter à l'étage avant de l'avoir construit |
| Pièce en sous-sol (`floor` au moins 0) | la cave est déclarée au niveau 0 |
| Commande du train du samedi | non comptée dans le revenu |
| Enclume à poser près de la forge (le meuble existe) | l'amélioration d'outil à 30 € ne se joue que par le dialogue de l'histoire |

À créer pour compléter l'offre (rien n'a été créé sans modèle): sac à dos de 10 cases (le modèle existe, ni fiche ni vignette), ferraille, plume, coquille de rivière, girolle, savon parfumé, vêtements et coiffures de Solange, cultures de carotte, poireau et pomme de terre, un pommier et des coquelicots à poser sur la carte d'Aubrune (la ressource existe, le plan n'en place pas). Objets vendus ici qui ont une vignette mais pas de modèle 3D: grain, pierre à aiguiser, sac de toile, marteau.

## 7. Trois signalements

- L'assembleur du plan (`carte-aubrune/assembler_lieu.py`) n'est plus rejouable tel quel: il réécrit les intérieurs sans les champs ajoutés depuis à la main (`style`, tapis, étage de la pension). Seuls les comptoirs ont été reportés dans les fichiers versionnés.
- L'étal de l'épicerie donne encore une tourte du quai gratuite toutes les 12 heures (repas spécial): à retirer ou à mettre en rayon.
- Le râtelier de Basile prête des haches de base sans fin: sans danger tant qu'aucun commerçant ne rachète d'outil (le test le garde).
