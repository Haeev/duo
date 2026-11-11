# Économie d'Aubrune: commerces, prix, revenu, maison

Version 2 du 2026-11-11 (game-designer), après la réponse du client sur le rythme de la maison (section 9). Complète le cahier des charges (4.2 et 4.6). Les valeurs vivent dans les données du jeu; ce document les explique. Les tableaux de prix et de revenu sortent du script `docs/jeux/jeu-1/simulations/economie_aubrune.py`, qui lit ces données: en cas d'écart, les données font foi et on relance le script.

## 1. Les sept commerces

Fiches: `games/la-petite-ligne-2/donnees/lieux/aubrune/commerces/`. Chaque commerce ouvre à 7 h et ferme quand son commerçant quitte son poste (la ligne de planning porte le champ `shop`). Tous: bonus d'amitié de 10 % sur les rachats à 3 cœurs, un besoin du jour payé 50 % de plus, un plafond de rachat par jour.

| Commerce | Tenu par | Où | Heures | En rayon | Rachète | Plafond par jour |
|---|---|---|---|---|---|---|
| Épicerie Ferrand | Odette | comptoir de la boutique, face à la porte de la place | 7 h à 21 h | pomme, farine, grain, graines de radis, de tomate, de carotte et de poireau, plants de pomme de terre, livre de cuisine (avec le réchaud), bœuf (avec le repas de l'acte 3), tourte du quai (une par semaine, dès le retour du train) | ce qui se mange, au prix le plus bas | 20 € |
| Fournil Pradel | Achille | comptoir devant le four, à droite en entrant | 7 h à 18 h | pain, tarte aux pommes | œufs (le mieux payé), pommes, mûres, bûches, tartes | 15 € |
| Café de la Halte | Colette (acte 2) | comptoir au fond de la salle, à droite | 7 h à 22 h | soupe de légumes (plat du jour), omelette | poissons, légumes, œufs, plats cuisinés (le mieux payé) | 85 € |
| Mercerie Mérigot | Solange | comptoir de la boutique, à l'ouest de la porte | 7 h à 19 h 30 | sac de toile (après les besaces), filet à insectes | coquelicots, vieilles pièces | 10 € |
| Forge Cazals | Mado | râtelier de la forge | 7 h à 20 h | pierre à aiguiser, hache, bêche | pierres, bûches | 8 € |
| Menuiserie Cornu | Basile | en lui parlant, sous son auvent | 7 h à 20 h | planche (bourse ou coffre commun), marteau | bûches (le mieux payé) | 35 € |
| Cour des Delmas | Margot (acte 3) | en lui parlant, dans la cour de la ferme | 7 h à 20 h | carotte, poireau, pomme de terre, grain, graines et plants (dont carotte, poireau, pomme de terre) moins chers qu'au bourg | mûres, coquelicots | 6 € |

Raisons des emplacements. Les cinq comptoirs sont ceux que le plan dessinait « à créer »; ils deviennent cinq types de meubles (`comptoir-epicerie`, `comptoir-fournil`, `comptoir-cafe`, `comptoir-mercerie`, `ratelier-de-la-forge`). Faute de modèle de comptoir livré, ils montrent la table de ferme (`table-farm`), le tonneau (`barrel`, au café) et l'étagère (`shelf`, à la forge), trois modèles livrés: une ligne à changer dans chaque fiche quand les modèles `comptoir` et `ratelier` existeront. Deux ont bougé d'une case pour tenir sur la grille et laisser libre l'axe de la porte: le comptoir d'Odette (2,5; 3) et celui d'Achille, à l'est devant le four (5; 2,5). Celui de Colette garde sa case (4,5; 1,5) et n'en fait qu'une: large de deux, il fermait soit le passage derrière le comptoir, soit l'accès à la table de l'est. Le râtelier de la forge donnait une hache forgée gratuite par jour: il est devenu le comptoir de Mado. Basile et Margot vendent dehors, là où ils travaillent: pas de comptoir à inventer.

Deux façons d'ouvrir une boutique: la touche d'action sur le comptoir, ou « regarder » à la fin de toute conversation avec le commerçant (champ `talk`).

## 2. Les prix

Prix de base en euros. « Meilleur rachat » dit où porter l'objet: c'est la leçon de l'œuf, généralisée.

| Objet | Meilleur rachat | Autres rachats | En rayon |
|---|---|---|---|
| Œuf | 1,00 (Fournil) | 0,70 (Café), 0,60 (Épicerie) | |
| Œuf roux | 1,50 (Fournil) | 1,10 (Café), 1,00 (Épicerie) | |
| Radis | 0,70 (Café) | 0,50 (Épicerie) | |
| Radis croquant | 2,00 (Café) | 1,40 (Épicerie) | |
| Tomate | 0,80 (Café) | 0,60 (Épicerie) | |
| Mûres | 0,50 (Fournil) | 0,40 (Café, Delmas), 0,30 (Épicerie) | |
| Coquelicot | 0,60 (Mercerie) | 0,50 (Café, Delmas), 0,40 (Épicerie) | |
| Bûche | 1,40 (Menuiserie) | 0,50 (Fournil), 0,40 (Forge) | |
| Pierre | 0,60 (Forge) | | |
| Vieille pièce | 2,00 (Mercerie) | | |
| Coquille de rivière | 1,20 (Mercerie) | 0,60 (Café) | |
| Coquille d'escargot d'eau | 0,40 (Mercerie) | | |
| Galet veiné | 0,90 (Mercerie) | | |
| Bois flotté | 0,70 (Mercerie) | 0,50 (Café) | |
| Tesson de faïence | 1,00 (Café) | | |
| Plume de héron | 0,80 (Mercerie) | | |
| Plume de martin-pêcheur | 2,40 (Mercerie) | | |
| Perle de rivière | 6,00 (Mercerie) | | |
| Girolle | 1,60 (Café) | 1,00 (Épicerie) | |
| Goujon | 2,90 (Café) | | |
| Ablette | 2,40 (Café) | | |
| Perche | 4,80 (Café) | | |
| Tanche | 6,00 (Café) | | |
| Truite fario | 7,20 (Café) | 2,00 (Épicerie) | |
| Brochet | 12,00 (Café) | | |
| Vairon | 2,00 (Café) | | |
| Loche franche | 2,20 (Café) | | |
| Gardon | 2,60 (Café) | | |
| Rotengle | 2,80 (Café) | | |
| Brème | 4,20 (Café) | | |
| Chevesne | 4,40 (Café) | | |
| Barbeau | 5,20 (Café) | | |
| Anguille | 8,40 (Café) | | |
| Ombre commun | 8,80 (Café) | | |
| Carpe de l'étang | 9,60 (Café) | | |
| Œuf au plat | 1,20 (Café) | | |
| Omelette aux herbes | 2,80 (Café) | | 3,50 (Café) |
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
| Tourte du quai | non | | 12,00 (Épicerie, une par semaine) |
| Grain (la ration) | non | | 0,10 (Delmas), 0,20 (Épicerie) |
| Graines de radis (la graine) | non | | 0,20 (Delmas, Épicerie) |
| Graines de tomate (la graine) | non | | 0,60 (Delmas), 0,80 (Épicerie) |
| Graines de carotte (la graine) | non | | 0,30 (Delmas), 0,40 (Épicerie) |
| Graines de poireau (la graine) | non | | 0,40 (Delmas), 0,50 (Épicerie) |
| Plants de pomme de terre (le plant) | non | | 0,40 (Delmas), 0,50 (Épicerie) |
| Graines de fleurs (la graine) | non | | capucine, souci 0,30, pensée, giroflée 0,40 (Épicerie); bleuet, marguerite 0,30, nigelle 0,40, tournesol 0,50 (Delmas) |
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

Ce qui rapporte reste ce qui se récolte, se pêche ou se pond, borné par le lieu et par le plafond de chaque commerçant. Cuisiner sa récolte paie: deux œufs valent 2 € chez Achille, une omelette 2,80 € chez Colette, et deux omelettes si elle est parfaite.

Écarts au tableau du cahier (4.6), tous dus à ce qui existe aujourd'hui à Aubrune:

| Objet | Cahier | Ici | Raison |
|---|---|---|---|
| Pomme | Odette 0,60, Achille 0,90 | Odette la vend 0,90, Achille 0,70 | la pomme s'achète toute l'année chez Odette, sa revente doit rester sous 0,90; le pommier du verger communal n'en donne qu'en automne (2026-11-11: 3 par jour, 2,10 € au rachat, hors du revenu du script) |
| Soupe de légumes | Colette 3,50, Odette 2,00 | 2,00 et 1,50 | les trois légumes se cultivent depuis le 2026-11-11, mais s'achètent toujours chez les Delmas (4,80 € les trois): à 3,50, deux soupes parfaites rapporteraient 7,00 € de légumes achetés 4,80 €, une boucle d'argent. Le prix reste donc à 2,00 tant que l'étal vend les légumes |
| Planche | Basile l'achète 1,40 | il la vend 1,60 et ne la rachète pas | aucun plan ne fait de planche |
| Ferraille, insectes, fossile en double | prix prévus | absents | objets à créer, ou sans acheteur |
| Coquille de rivière, plume | Armand 0,60 et 0,40 | Café 0,60 pour la coquille; plume chez Solange seulement | l'école n'est pas un commerce (audit C.2): la colonne d'Armand passe au café pour la coquille (Colette en garnit les pots de la terrasse) |

### La tourte du quai (2026-11-11)

Le repas spécial « Mains sûres » (les outils améliorés ne s'usent pas, tant que la faim reste au-dessus de 50: 25 minutes réelles au repos, 2 points par minute) se prenait gratuitement toutes les 12 heures à un étal de l'épicerie: le bonus était permanent et ne coûtait rien (audit du 11 novembre, B.11). L'étal est retiré; la tourte se cuisine à deux, ou s'achète au prix plein.

| | Valeur | Raison |
|---|---|---|
| Recette (`commun/recettes/tourte-du-quai.json`) | plan de travail: 2 farines, 1 œuf (pétrir, saler, foncer le moule); cuisinière: 2 pommes de terre, 1 poireau (émincer, faire fondre, cuire) | « pâte d'Achille, farce d'Odette »: une part par joueur, sur les deux postes de la cuisine de la maison (pas de four chez le garde); la cuisson attend le moule foncé, il faut se le dire |
| Mini-jeu | 32 s en tout: 14,9 s au plan de travail, 17,2 s à la cuisinière | même gabarit que le pot-au-feu (36 s); bornes du validateur: 15 à 40 s |
| Ingrédients au prix du rayon | 7,20 € (farine 1,60; œuf 1,00 au prix d'Achille; pommes de terre 2,80 et poireau 1,80 chez les Delmas) | 2,60 € et quelques graines pour un duo qui cultive ses légumes; le pot-au-feu en coûte 11,30 |
| En rayon chez Odette | 12,00 €, une par semaine (`restockDays` 7), dès le retour du train (`aubrune.acte2.train`) | les autres plats en rayon se vendent au prix de leurs ingrédients (tarte: 4,50 pour 4,50); un repas à bonus se paie 1,7 fois les siens, pour que cuisiner reste le bon choix; « le plat des jours de train » revient avec le train |
| Rachat | aucun | repas spécial: il ne se revend nulle part, donc aucune boucle d'argent (contrôle « cuisiner puis revendre ») |
| Ce que le bonus épargne | peu d'argent: une hache forgée tient 120 coups, soit 30 chênes (4 coups par chêne), et la carte en porte 13 qui repoussent en 3 jours: environ une pierre à aiguiser (1,50 €) par semaine | à 12 €, la tourte achetée ne se rembourse jamais: c'est un confort (faim à 100 pour les deux, aucun affûtage) ou un cadeau (Odette et Honorine l'adorent), pas un placement |

Comment on apprend la recette: Odette la donne avec sa seconde confidence, à 4 cœurs (`odette-secret-fil`, `ecriture-habitants.md` section 10). La première Veillée du premier train devait la donner aussi (`ecriture-fetes.md`, section 8): une ligne `give_recipe` à ajouter à la suite de la fête. Odette annonce le rayon une fois par joueur (`odette-souvenir-tourte-en-rayon`): une par semaine, douze euros, à manger à table, à deux.

## 3. Le revenu d'une journée à deux

Modèle: le duo passe une part de sa journée (30 minutes réelles) à récolter et vendre, prend d'abord ce qui rapporte le plus à la seconde, dans la limite de ce que la carte produit et des plafonds. Tirages à leur moyenne, potager en radis arrosés, sans mûres ni tomates (saison), sans besoin du jour ni amitié.

| Période | Duo tranquille (25 % du temps) | Duo médian (40 %) | Duo appliqué (55 %) |
|---|---|---|---|
| Acte 1 (jours 1 à 4) | 49,90 € | 49,90 € | 49,90 € |
| Acte 2 (jours 5 à 10) | 99,40 € | 131,40 € | 131,40 € |
| Acte 3 et après | 101,10 € | 133,60 € | 133,60 € |

Le pain de la journée (deux par joueur) retire 4,80 €.

Journée type du duo médian à l'acte 3, cuisine achetée: radis croquants 22,80 €, omelettes 12,00 €, bûches 32,40 € (23 bûches), pêche 48,40 € (11 poissons), vieilles pièces 6,00 €, pierres 6,00 €: 127,60 €. Aucune activité ne dépasse 40 % de la journée: pêche 38 %, bûches 25 %, radis 18 %.

Lecture:

- À l'acte 1, le revenu est borné par la carte (6 cases de potager, 2 poules, 13 chênes, 10 cailloux, 6 fouilles), pas par le temps: les trois duos gagnent pareil, et personne n'a de raison de se presser. C'est doux pour un début.
- Dès l'acte 2, la pêche est le débouché du temps en plus: elle seule ne s'épuise pas. Le plafond de Colette (85 €) la borne pour les duos médian et appliqué, qui gagnent donc pareil: s'appliquer davantage ne fait pas creuser l'écart.
- Le revenu dépasse désormais la fourchette du cahier (22 à 41 € par joueur): c'est voulu depuis la version 2, pour le rythme de la maison. Le sac ne change pas ces nombres, il épargne des allers-retours.
- Le tas de bois rendait 8 bûches toutes les 12 heures (18 € par jour sans outil): réglé à 4 bûches par jour.

### Carotte, poireau et pomme de terre au potager (2026-11-11)

Le script prend désormais au potager la culture qui rapporte le plus par case et par jour (arrosée chaque jour, graine payée, une culture qui repousse ne repart que de son stade de repousse). Les trois légumes rapportent moins que le radis et la tomate: ils servent la cuisine (soupe, pot-au-feu, matelote, gratin, pommes sautées) et le potager d'hiver, pas la bourse.

| Culture | Saisons | Jours entre deux récoltes (modèle) | Récolte | Graine par récolte | Net par case et par jour |
|---|---|---|---|---|---|
| Carotte | printemps, été, automne | 6 | carotte x3 à 1,10 | 0,30 | 0,50 |
| Poireau | automne, hiver | 8 | poireau x3 à 1,20 | 0,40 | 0,40 |
| Pomme de terre | printemps, été | 7 | pomme de terre x4 à 0,90 | 0,40 | 0,46 |
| Radis | printemps, automne | 4 | radis croquant x2 à 2,00 | 0,20 | 0,95 |
| Tomate | printemps, été | 3 | tomate x3 à 0,80 | 0,00 | 0,80 |

Le tableau du revenu ci-dessus (saisons ignorées, borne haute) ne bouge pas: le radis reste la meilleure case. Saison par saison, acte 3, duo médian:

| Saison | Culture du potager, avant | Revenu avant | Culture du potager, après | Revenu après | Écart |
|---|---|---|---|---|---|
| printemps | radis croquant | 133,63 | radis croquant | 133,63 | +0,0 % |
| été | tomate | 134,16 | tomate | 134,16 | +0,0 % |
| automne | radis croquant | 133,63 | radis croquant | 133,63 | +0,0 % |
| hiver | aucune | 126,53 | poireau | 129,51 | +2,4 % |

Seul l'hiver gagne (+2,98 € par jour), et reste sous les autres saisons: le potager n'est plus vide en hiver, sans que la bourse s'emballe (limite fixée: +5 %). Raisons des réglages: deux stades seulement (les modèles `crop-carotte`, `crop-poireau`, `crop-pomme-de-terre` ont les états de `crop-radis`); le poireau, lent, est le légume d'hiver; la pomme de terre donne le plus d'unités (4) au plus bas prix, comme les recettes en demandent deux ou trois; les graines coûtent 0,10 € de moins chez les Delmas qu'à l'Épicerie, comme la graine de tomate.

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
| Cuisine | 150 € | 6,40 € | jour 6 | jour 6 | jour 6 | jour 7 |
| Chambre | 300 € | 9,60 € | jour 12 | jour 11 | jour 11 | jour 16 |
| Troisième pièce | 450 € | 12,80 € | jour 21 | jour 18 | jour 18 | jour 28 |
| Étage | 800 € | 16,00 € | jour 38 | jour 31 | jour 31 | jour 51 |

La cuisine ne peut se payer qu'à partir du jour 5 (scène du règlement) et la chambre du jour 11 (scène de la trappe): la cuisine au jour 6 et la chambre au jour 11 ou 12 sont donc presque au plus tôt. Le pot-au-feu de l'acte 3 (étape `repas`, jour 11 et suivants) demande la cuisine payée: les trois duos l'ont depuis cinq jours au moins. Sans elle, Colette renvoie vers Basile (section 4.1). L'étage reste un but au long cours, atteint dans la première année de jeu (56 jours).

### 4.1 Le pot-au-feu attend la cuisine

L'étape `repas` de l'acte 3 (suite `ceux-qui-partent`) ne se franchit que si le dialogue `colette-repas` atteint son nœud `a1`, ce qu'il ne fait que si le fait `aubrune.maison-du-garde.cuisine` existe (cuisine payée et finie). Raison: Honorine annonce « un vrai pot-au-feu, fait à deux, dans une vraie cuisine », et la cuisinière et le plan de travail de la maison n'apparaissent qu'à ce moment. Sans la cuisine:

- les mains vides, Colette dit: « Mais un pot-au-feu pareil se mitonne chez soi, et la maison du garde n'a pas encore de cuisine. Va voir Basile pour le devis: 150 €. », puis la recette;
- avec une marmite cuisinée ailleurs, elle la laisse au joueur: « Elle sent bon, ta marmite. Mais Honorine a dit une vraie cuisine: la vôtre, à la maison du garde. Ces deux-là sentiraient la différence. » puis « Pas encore de cuisine ? Va voir Basile pour le devis: 150 €, quelques planches, quelques pierres. Garde la marmite, je garde le plan de table. »

Rien d'autre n'attend: les autres étapes de l'acte 3 et les suites secondaires qui ne dépendent pas du repas restent ouvertes. Seules attendent la suite de l'acte 3 après le repas et la guerre de la soupe, ouverte par lui. Depuis le 2026-11-11, l'étape lit directement le fait du logement (`aubrune.maison-du-garde.cuisine` vaut `restored`), que le validateur des quêtes connaît; le dialogue `colette-repas` ne fait plus que dire la réplique. Une marmite cuisinée ailleurs avant le paiement est acceptée une fois la cuisine payée.

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
| Meubles vendus par un commerce, ou livrés à la fin d'une étape | fait le 2026-11-11 (section 8): 45 meubles obtenables; la fin d'une étape de pièce ne livre toujours rien |
| Escaliers fermés tant que la pièce n'existe pas (les portes sont écrites par l'assembleur du plan) | on peut monter à l'étage avant de l'avoir construit |
| Pièce en sous-sol (`floor` au moins 0) | la cave est déclarée au niveau 0 |
| Commande du train du samedi | branchée le 2026-11-11 (section 6.1), hors du revenu par jour du script |
| Enclume à poser près de la forge (le meuble existe) | l'amélioration d'outil à 30 € ne se joue que par le dialogue de l'histoire |

À créer pour compléter l'offre (rien n'a été créé sans modèle): sac à dos de 10 cases (le modèle existe, ni fiche ni vignette), ferraille, plume, coquille de rivière, girolle, savon parfumé, vêtements et coiffures de Solange, un pommier et des coquelicots à poser sur la carte d'Aubrune (la ressource existe, le plan n'en place pas). Objets vendus ici qui ont une vignette mais pas de modèle 3D: grain, pierre à aiguiser, sac de toile, marteau.

### 6.1 La commande du samedi (2026-11-11)

Données: `donnees/lieux/aubrune/commande.json` (guichet), `commandes/` (six tables, 40 lignes), `lettres/` (huit lettres). Moteur: `src/simulation/commandes/`. Une fois l'acte 2 fini, chaque samedi de 10 h 04 à 14 h 40, Rosalie reçoit au quai une commande de 3 à 5 lignes tirées dans ce que le duo a déjà eu en main (récolté, pêché, cuisiné, reçu, vendu), une table après l'autre. Elle est au carnet dès le départ du train précédent. On livre ligne par ligne, du sac puis de la consigne de la halte; chaque unité est payée à la livraison, **au coffre commun** (la Compagnie paie la halte, et le coffre paie la maison). Ce qui manque reste demandé la semaine suivante, sans pénalité.

**Rapport choisi: 1,25 fois le meilleur rachat au comptoir**, arrondi aux 10 centimes (test: au-dessus du rachat, au plus 1,3 fois, sous le besoin du jour qui paie 1,5). Trois garde-fous, vérifiés par `tests/commande-du-samedi.test.ts` sur toutes les lignes: sous le prix de tout commerce qui vend l'objet (pomme 0,80 contre 0,90 à l'épicerie; carotte 1,40, poireau 1,50, pomme de terre 1,10, sous l'étal des Delmas); un plat dont tous les ingrédients s'achètent est payé moins que ses ingrédients, même réussi parfait (soupe de légumes 2,30, pommes sautées 2,50; l'omelette reste à 3,40, sous les 3,50 du café; la tarte aux pommes à 2,20); ni meuble de l'établi (fait de planches achetées) ni repas spécial. Sans rachat au comptoir (fleurs, plats du café non rachetés), un prix proche des ingrédients ou de deux à trois graines.

| Table | Lignes | Exemples (unité) |
|---|---|---|
| Potager | 9 (chacune en sa saison) | radis 0,90 x 10 à 16; carotte 1,40 x 8 à 12; tomate 1,00 x 10 à 15; pensée 0,90 x 6 à 10 |
| Pêche | 10 | goujon 3,60 x 5 à 8; perche 6,00 x 3 à 5; truite 9,00 x 2 à 3; brochet 15,00 x 1 à 2 |
| Cuisine | 13 | omelette 3,40 x 4 à 6; friture 9,60 x 2 à 3; truite grillée 9,90 x 2 à 3 |
| Basse-cour | 2 | œuf 1,30 x 8 à 14; œuf roux 1,90 x 4 à 8 |
| Bois et pierre | 2 | bûche 1,80 x 15 à 25; pierre 0,80 x 10 à 16 |
| Cueillette | 4 | mûres 0,60 x 10 à 16 (été, automne); vieille pièce 2,50 x 3 à 5 |

Gain attendu d'une commande livrée en entier (moyenne de 20 000 tirages, saisons comprises): **début** (après l'acte 2: radis, carottes, œufs, bûches, pierres, goujons, ablettes, vairons, œufs au plat, omelettes, cueillette) 60 à 63 € par semaine; **milieu** (acte 3: légumes d'été, perches, tanches, soupe, gratin, friture) 59 à 60 €; **fin** (tout) 57 à 59 €. Le montant reste stable: plus de lignes possibles, pas de lignes plus chères, la commande ne prend pas le pas sur le reste. Le gain se répartit sur des métiers variés, sans plafond de commerçant: un duo qui pêche beaucoup, bloqué par le plafond du café (85 € par jour), y gagne vraiment en plus.

Comparé aux coûts de la maison: environ 60 € par semaine, c'est une demi-journée de revenu d'un duo médian (127 € par jour), versée tout entière au coffre commun, soit environ 13 % de plus au coffre (qui reçoit la moitié du revenu net). L'étage (800 €) passe du jour 31 au jour 28 ou 29 (estimation, hors script) pour un duo médian qui livre chaque semaine; la cuisine (jour 6) et la chambre (jour 11) ne bougent pas, la commande ne commençant qu'après l'acte 2. Pour aider davantage, une seule valeur à monter par ligne: `count` (les prix gardent leurs garde-fous).

Le courrier: au plus deux lettres par passage, quand leurs conditions sont vraies. Huit lettres d'Aubrune: la Compagnie (la halte rouvre; douze lignes livrées, avec un mandat de 20 € une seule fois; l'horaire d'hiver), Margot Delmas (six graines de carotte, avant l'arrivée des Delmas), Berthe Lavergne (sa meule), Le Petit Rail (la première ligne livrée), les pêcheurs de Hautefonte (le premier brochet), Simone Arnal (après l'acte 3). Aucune ne touche au sac postal des « Lettres en retard », qui reste une suite à part.

## 7. Trois signalements

- L'assembleur du plan (`carte-aubrune/assembler_lieu.py`) n'est plus rejouable tel quel: il réécrit les intérieurs sans les champs ajoutés depuis à la main (`style`, tapis, étage de la pension). Seuls les comptoirs ont été reportés dans les fichiers versionnés.
- ~~L'étal de l'épicerie donne encore une tourte du quai gratuite toutes les 12 heures.~~ Fait le 2026-11-11 (section 2, « La tourte du quai »): l'étal est retiré de `interieurs/epicerie-rdc.json` (une cagette de légumes à sa place, sous le rayonnage du mur nord); le plan du bourg cite encore `epicerie-etal` (`plan.json`, `carte-aubrune/plan.json`, `plan.md`, `construire_plan.py`): à aligner avant de relancer l'assembleur.
- Le râtelier de Basile prête des haches de base sans fin: sans danger tant qu'aucun commerçant ne rachète d'outil (le test le garde).

## 8. Les meubles (2026-11-11)

Audit du 11 novembre, lignes B.2, B.9, B.12 et B.20. Données: un objet du sac par meuble (`commun/objets/<id>.json`, famille `furniture`, champ `prop` vers la fiche du meuble posé, même identifiant que la fiche pour reprendre sa vignette), des lignes `sells` dans sept commerces, un plan de l'établi, deux récompenses de suites. Chiffres: `docs/jeux/jeu-1/simulations/meubles_aubrune.py`, qui lit ces données et reprend le modèle de revenu de la section 3.

### 8.1 Le catalogue: 45 meubles en six séries

37 meubles nouveaux, tous sur une fiche posable qui avait déjà son modèle et sa vignette (aucun modèle créé; ni fiches `*-essai`, ni lumignon de fête, ni comptoir, banquette de train, lanterne de quai ou plante), plus les 8 meubles de la série campagne de l'établi. Tout se paie de la bourse ou du coffre commun (`purse-or-chest`). Aucun commerçant ne rachète un meuble: pas de boucle d'argent (contrôles de `tests/commerces-aubrune.test.ts`). « 1 par semaine »: `dailyStock` 1, `restockDays` 7; sinon le rayon se refait chaque matin.

| Série | Meuble | Prix | Source |
|---|---|---|---|
| Campagne | Chaise de ferme | 9,00 | Basile, 2 par jour |
| Campagne | Tabouret de ferme | 6,00 | Basile, 2 par jour |
| Campagne | Table de ferme | 34,00 | Basile, 1 par semaine |
| Campagne | Coffre de chêne | 18,00 | Basile |
| Campagne | Banc de table | 16,00 | Basile |
| Campagne | Tonnelet | 14,00 | Basile |
| Campagne | Tabouret, table de chevet, étagère, coffre à linge (miel ou sauge) | 3,20; 4,80; 7,00; 9,40 de matériaux | établi (plans existants) |
| Campagne | Bûches rangées | 6 bûches (8,40 au rachat) | établi, plan `buches-rangees` donné par Basile avec sa première confidence (1 cœur) |
| Chambre | Lit double | 58,00 | Basile, 1 par semaine, dès le repas de l'acte 3 (`aubrune.acte3.repas`) |
| Chambre | Armoire | 52,00 | Basile, 1 par semaine, dès le repas de l'acte 3 |
| Chambre | Lit simple | 38,00 | Basile, 1 par semaine |
| Chambre | Miroir sur pied | 26,00 | Basile, 1 par semaine |
| Chambre | Paysage encadré | 10,00 | Basile |
| Chambre | Panier à linge | 7,00 | Solange |
| Cuisine | Vaisselier | 48,00 | Basile, 1 par semaine, dès le repas de l'acte 3 |
| Cuisine | Boîtes à provisions | 8,00 | Mado (fer-blanc) |
| Cuisine | Pots de grès | 6,00 | Odette, 2 par jour |
| Cuisine | Bocaux de confiture | 5,00 | Odette, 2 par jour |
| Cuisine | Balai de genêt | 4,00 | Odette |
| Cuisine | Seau en fer | 4,00 | Mado, 2 par jour |
| Cuisine | Corbeille à pain | 4,00 | Achille |
| Cuisine | Cagette | 4,00 | Margot, 2 par jour |
| Murs et lumières | Poêle à bois | 56,00 | Mado, 1 par semaine, dès le retour du train (`aubrune.acte2.train`) |
| Murs et lumières | Lampe à pétrole | 16,00 | Mado |
| Murs et lumières | Lampe de table | 14,00 | Mado |
| Murs et lumières | Étagère murale garnie | 12,00 | Basile |
| Murs et lumières | Patère | 9,00 | Mado, 2 par jour |
| Murs et lumières | Médaillon ovale | 8,00 | Basile |
| Gare | Banc de quai | 26,00 | Basile, 1 par semaine, dès le retour du train |
| Gare | Horloge de salle d'attente | 22,00 | Basile, 1 par semaine, dès le retour du train |
| Gare | Pile de livres | 6,00 | Colette (dès son arrivée, avec le train) |
| Gare | Le Petit Rail | 4,00 | Colette |
| Gare | Pendule de la poste | rare | fin des « Lettres en retard » (Lucie), une seule |
| Tapis et petits objets | Tapis rond tressé | 18,00 | Solange |
| Tapis et petits objets | Chemin de couloir | 14,00 | Solange |
| Tapis et petits objets | Rideau de passage | 10,00 | Solange, 2 par jour |
| Tapis et petits objets | Bouquet des champs | 4,00 | Solange, 2 par jour |
| Tapis et petits objets | Portrait encadré | rare | fin de « La robe et la cloche » (Marthe), un seul |

Pourquoi ces sources: chacun vend ce que son métier fait ou fait venir. Basile le bois, et ce que la Compagnie a laissé dans la halte une fois le train revenu (banc de quai, horloge); Mado la fonte et le fer (poêle, lampes, patère, seau, boîtes en fer-blanc); Solange les étoffes, l'osier et les fleurs (elle rachète les coquelicots, elle en fait des bouquets); Odette, Achille et Margot l'objet de leur comptoir; Colette le journal de son dépôt et les livres oubliés par les voyageurs. L'établi est la voie économe: des matériaux et du temps au lieu de l'argent. Les deux pièces rares viennent de suites secondaires, aucune d'une fête. Le banc de quai est la seule assise du jardin (« dedans ou dehors »).

Fiches retouchées (données seulement): section `deco` ajoutée à l'armoire (confort 3), à la table à manger (surface, confort 3: la lampe se pose dessus), au lit double (confort 4) et au banc (dedans ou dehors, confort 1). Les fiches de l'inventaire de départ (coffre, lit simple, chaise, miroir, établi) gardent leurs valeurs par défaut.

### 8.2 La grille des prix

| Catégorie | Prix | Raison |
|---|---|---|
| Petits objets (posés sur un meuble, ou au sol sans usage) | 4 à 8 € | le prix d'un repas: on en prend en passant, pour le plaisir |
| Murs et rideaux | 8 à 12 € (horloge 22) | décor pur, confort 1 à 2 |
| Lampes et tapis | 14 à 18 € | confort 2, se voient de loin, éclairent la nuit |
| Sièges | 6 à 26 € | du tabouret au banc de quai à deux places |
| Rangements et tables | 14 à 34 € | une fonction: ranger, manger, poser |
| Grandes pièces | 38 à 58 € | dormir, ranger 20 cases, chauffer; confort 3 à 4 |
| Établi | 3,20 à 9,40 € de matériaux | le temps et les bûches remplacent l'argent |

Calage. Le revenu net du duo médian (section 3, pain et cuisine compris) est de 45 € par jour à l'acte 1 et de 123 € aux actes 2 et 3. La moitié va au coffre commun, qui paie les pièces; l'autre moitié, 61 € par jour, reste dans les bourses: c'est elle qui meuble, et c'est sur elle que se comptent les « deux à trois jours » d'une pièce. Listes d'emménagement (ce qu'une pièce « correctement meublée » contient, en gardant au moins 40 % du sol libre):

| Pièce | Ce qu'on y met | Coût | Jours de bourse | Jours de revenu du duo |
|---|---|---|---|---|
| Salle commune | table, poêle, vaisselier, chemin de couloir, horloge, lampe à pétrole, patère, bouquet (plus les deux chaises de départ) | 203,00 € | 3,3 | 1,7 |
| Cuisine | étagère murale, boîtes, bocaux, pots, corbeille, cagette | 39,00 € | 0,6 | 0,3 |
| Chambre | lit double, armoire, deux chevets (établi), tapis rond, lampe de table, rideau, paysage, panier | 178,60 € | 2,9 | 1,5 |
| Troisième pièce | coffre à linge (établi), miroir, rideau, seau, balai, chemin de couloir | 67,40 € | 1,1 | 0,5 |
| Étage | les deux lits simples de départ montés, banc de table, étagère et deux tabourets (établi), coffre, lampe de table, tapis rond, médaillon, livres, journal, tonnelet | 111,40 € | 1,8 | 0,9 |
| Cave | bûches rangées et coffre à linge (établi) | 17,80 € | 0,3 | 0,1 |
| Jardin | banc de quai, deux tabourets (établi) | 32,40 € | 0,5 | 0,3 |
| **Maison entière** | 45 pièces | **649,60 €** | 10,6 | 5,3 |

Lecture: les deux pièces à vivre (salle, chambre) coûtent trois jours de bourse, les autres moins de deux. Toute la maison meublée coûte 650 €, moins que l'étage seul (800 €). Son confort atteint 82,5 points, bien au-delà du dernier palier (50): le plus fort bonus de sommeil ne demande pas tout le catalogue, le reste est pour le plaisir.

### 8.3 Le jour de la maison meublée

Modèle du script: la moitié des bourses va aux meubles (le reste: outils, sacs, vêtements, graines); une pièce se meuble dès qu'elle est restaurée, meuble par meuble, et un article encore verrouillé attend sans bloquer les autres; une fois l'étage payé, le coffre commun aide. Hypothèses: retour du train au jour 8, repas de l'acte 3 au jour 11. Chaque case: jour où la pièce est restaurée, puis jour où elle est meublée.

| Pièce | Duo tranquille | Duo médian | Duo appliqué |
|---|---|---|---|
| Salle commune | 1, puis 13 | 1, puis 12 | 1, puis 12 |
| Cuisine | 6, puis 14 | 6, puis 7 | 6, puis 7 |
| Cave | 11, puis 15 | 11, puis 13 | 11, puis 13 |
| Chambre | 12, puis 22 | 11, puis 18 | 11, puis 18 |
| Troisième pièce | 22, puis 25 | 18, puis 21 | 18, puis 21 |
| Étage | 39, puis 39 | 31, puis 31 | 31, puis 31 |
| Jardin | 1, puis 14 | 1, puis 10 | 1, puis 10 |
| **Maison meublée** | **jour 39** | **jour 31** | **jour 31** |

Lecture: les meubles suivent les murs. Un duo médian a toute sa maison meublée au jour 31, le jour même où il paie l'étage (fin de la troisième saison); un duo tranquille au jour 39. Les meubles ne rallongent donc pas la maison que le client trouvait lente. Seule la chambre attend une semaine, parce qu'elle arrive en même temps que les grandes pièces de la salle (débloquées par le repas de l'acte 3). Avec 30 % des bourses seulement: jours 33 et 41. La commande du samedi (environ 60 € par semaine au coffre) n'est pas comptée: elle avance encore l'étage.

### 8.4 Le rayon qui tourne (prêt, à brancher)

Aujourd'hui tout le rayon de Basile reste en vente; les grandes pièces reviennent une fois par semaine. Un rayon qui change demande deux choses hors des données:

1. Une condition de semaine. `season_is` et `weekday_is` ne disent pas « cette semaine-ci ». À demander: `{ "type": "week_is", "weeks": [1] }`, la semaine dans la saison (1 ou 2 avec des saisons de 14 jours). Faute de mieux, la saison seule fait un rayon qui change toutes les deux semaines.
2. Le test « chaque commerce vend chaque article » (`tests/commerces-aubrune.test.ts`) achète chaque ligne dans une partie au printemps, sans amitié: une ligne de saison ou d'amitié y serait refusée (`locked`). Le test doit d'abord rendre vraie la condition de la ligne.

Proposition, à poser une fois ces deux points réglés (champ `unlock` des lignes de Basile):

| Quand | Pièces | Raison |
|---|---|---|
| Printemps | étagère murale garnie, paysage encadré | la cuisine (jour 6) et la chambre (jour 11) se meublent au printemps |
| Été | miroir sur pied | la troisième pièce (jour 18) |
| Automne | banc de table, médaillon ovale, tonnelet | l'étage (jour 31) |
| Hiver | lit simple | la chambre d'amis de l'étage, les visites d'hiver |
| Amitié de Basile, 2 cœurs (`bond_at_least` 200) | vaisselier | au lieu du repas de l'acte 3: il le garde pour qui revient le voir |
| Chambre payée (`aubrune.maison-du-garde.chambre`) | lit double, armoire | au lieu du repas de l'acte 3: on les achète quand on a où les mettre |

Effet estimé, non simulé: la salle commune passe du jour 12 au jour 16 environ pour le duo médian (deux cœurs vers le jour 16 avec une bûche offerte un jour sur deux); la maison meublée ne bouge pas (l'étage reste le dernier).

### 8.5 La baignoire et la salle d'eau (B.9)

Le contrat: une salle d'eau à 120 € payée au coffre, hygiène à 100 en 3 secondes, savon parfumé. Ce que permet le logement aujourd'hui: les pièces d'un même niveau ne se chevauchent pas (validateur), le rez-de-chaussée (10 x 7 m) est entièrement pris par la salle, la cuisine, la chambre et la troisième pièce, et l'étage est une seule pièce de 10 x 7 m. Une septième pièce ne tient pas sans changer la carte de l'intérieur. La troisième pièce et l'étage permettent déjà « se laver » (`unlocks: wash`).

Fait: la fiche `commun/meubles/baignoire.json` (modèle `tub` refait ce matin, 2 x 1 m, brique `relieve` « Prendre un bain »: 3 s, hygiène +100 jusqu'à 100, comme la douche du cahier; confort 3, dedans seulement). Elle reste `placeable: false`, sans objet ni ligne de vente: un objet ou un meuble posable sans vignette fait échouer `tests/interface-plume.test.ts`, et le studio ne dessine pas ici. Pour l'ouvrir, une fois la vignette `baignoire` dessinée (artiste 2D): `placeable: true`, l'objet `baignoire` (famille `furniture`, `prop` `baignoire`) et, chez Mado (la fonte, les pieds de fonte), `{ "item": "baignoire", "price": 6000, "dailyStock": 1, "restockDays": 28, "unlock": { "type": "remembered", "key": "aubrune.acte3.train2" }, "payment": "purse-or-chest" }`. Elle se posera là où l'on peut se laver: troisième pièce, étage, puis salle d'eau.

À demander au level designer pour la vraie salle d'eau: une pièce rectangulaire d'au moins 3 x 2 m (baignoire de 2 x 1, un mètre de passage, le coin du miroir), fermée par des murs dans `blocked`, avec une porte et une ardoise de chantier (`maison-chantier-salle-d-eau`). Deux places possibles: un appentis contre le mur sud de la troisième pièce, porte depuis elle (recommandé: la salle d'eau vient avant l'étage, comme son prix le dit; mais l'emprise de la maison grandit sur le plan du bourg); ou une cloison à l'étage côté est (x 34 à 37), loin de l'arrivée de l'escalier (32,5; 214,5), sans toucher au plan du bourg. La pièce, une fois la carte faite:

```json
{
  "id": "salle-d-eau",
  "name": "Salle d'eau",
  "area": { "x": 0, "y": 0, "w": 3, "h": 2 },
  "floor": 0,
  "start": "absent",
  "requires": ["troisieme-piece"],
  "stages": [
    {
      "name": "Carreler et mener l'eau",
      "materials": [{ "item": "planche", "count": 2 }, { "item": "pierre", "count": 6 }],
      "cost": 12000,
      "work": 24,
      "when": []
    }
  ],
  "unlocks": ["wash", "store"],
  "clue": "Derrière un carreau descellé, une boîte à savon en fer-blanc. Dedans, un billet de quai plié en quatre, daté du dernier jour de la ligne.",
  "site": "maison-chantier-salle-d-eau"
}
```

(`area` et `floor` à reprendre de la carte.) Le savon parfumé (1,50 €, Solange) attend sa brique: l'effet n'existe pas (les objets n'ont que `food`, `tool`, `meal`). À demander: un champ d'objet `wash: { "bond": 1.25 }`, consommé à la fin d'un bain (brique `relieve` d'hygiène qui monte à 100) quand le joueur en a un sur lui; tant que son hygiène reste au-dessus de 50, son bonus « Soigné » vaut ce facteur au lieu de 1,2; il s'affiche dans le médaillon d'hygiène (« Soigné, parfumé »). Le cahier dit 1,3, mais `besoins.json` plafonne les bonus à 1,25 (`maxBonus`) et le cahier lui-même dit « aucun bonus ne dépasse 25 % »: recommandation, 1,25.

### 8.6 Le nichoir (B.20)

Existant: le plan `nichoir` (établi, 2 planches, `source: quest`, donné par personne) et l'objet `nichoir` (famille `material`, vignette dessinée). Manque: un modèle 3D (aucun nœud dans `decors.json`), donc une fiche de meuble. Le nichoir n'est pas branché: un objet qui ne sert à rien serait une fausse récompense.

Proposition: **source**, Basile, à sa seconde confidence (`basile-secret-nichoirs`, 4 cœurs), où il raconte ses nichoirs de 1987 et dit « Le vôtre est resté »: un effet `{ "type": "give_plan", "plan": "nichoir" }` dans le nœud `retenir`. **Usage**: meuble du jardin (fiche `nichoir`: 1 x 1, non solide, couche `floor`, `where: outdoor`, confort 1), et l'objet passe en famille `furniture` avec `prop: "nichoir"`. À demander à l'artiste 3D: une boîte de planches de 25 cm, toit à deux pans, trou rond de 3 cm, sur un piquet de 1,6 m (hors de portée des chats, comme les posait Basile). Dix minutes de données une fois le modèle livré.

### 8.7 Les trophées de collection (B.12)

La brique n'existe pas: l'événement `collection_completed` part (`collections/registre.ts`), mais rien ne donne d'objet et aucun fait n'est écrit. À demander (dev gameplay): dans `commun/collections.json`, un champ facultatif `trophy` par catégorie, `{ "<lieu>": "<objet meuble>" }`. Quand une catégorie est complète dans un lieu, une seule fois par partie, le moteur range l'objet directement dans l'inventaire de la maison de ce lieu (pas dans un sac qui pourrait être plein), écrit le fait `collections.<lieu>.<catégorie>` (lu par les quêtes et les dialogues) et annonce `reward_given` aux deux joueurs. Le validateur refuse un trophée qui n'est pas un objet meuble posable. Test court: une catégorie factice de deux entrées, complétée par le test, livre son trophée. Les huit trophées d'Aubrune (modèles à faire, confort 3, uniques):

| Collection | Trophée | Idée du modèle | Pose |
|---|---|---|---|
| Poissons | Brochet sur planchette | brochet sculpté et peint sur une planche de chêne, plaque de laiton gravée « Aubrune » | mur |
| Insectes | Boîte d'entomologiste | coffret vitré de 16 cases, insectes épinglés, étiquettes à la plume | mur |
| Fossiles et trésors | Cabinet de curiosités | petite vitrine à trois étagères: ammonite, dent, vieille pièce, bille d'agate | sol, 1 x 1 |
| Fleurs | Arche fleurie | arceau de fer et de bois couvert des fleurs du carnet | jardin, 2 x 1 |
| Tenues | Mannequin de couturière | buste sur pied de Solange, mètre ruban autour du cou | sol, 1 x 1 |
| Recettes | Batterie de cuivre | barre murale de casseroles et de louches de cuivre | mur |
| Cartes postales et photos | Tourniquet à cartes | présentoir tournant de dépôt de presse, garni de cartes d'Aubrune | sol, 1 x 1 |
| Musiques | Phonographe à pavillon | phonographe à manivelle, pavillon en fleur de liseron | sur un meuble |

### 8.8 Deux signalements pour le level designer

- L'intérieur `maison-rdc` pose sans condition une vingtaine de meubles du catalogue (table, deux chaises, lit double, armoire, patère, horloge, médaillon, panier, deux seaux, chemin de couloir, balai, lampe, corbeille, journal, pots): la maison est meublée avant tout achat, et ces meubles de carte ne se déplacent pas en mode déco. Recommandation: ne garder sur la carte que les restes de la ruine (seau de gravats, balai) et l'ardoise de chantier; le nécessaire passe par l'inventaire de départ (`stock` du logement), le reste s'achète.
- Le baquet de lessive de Margot (`baquet` dans `carte.json`, au bord de la rivière) montre le modèle `tub`, devenu ce matin une baignoire de fonte à robinet: il lui faut un baquet de bois.

## 9. Historique des réglages

| Date | Changement | Raison |
|---|---|---|
| 2026-11-11 | Version 1 | première économie d'Aubrune |
| 2026-11-11 | Rachats: bûche chez Basile 0,60 à 1,40; pierre 0,30 à 0,60; vieille pièce 1,20 à 2,00; radis croquant 1,00 à 2,00 (Café) et 0,80 à 1,40 (Épicerie); omelette 2,20 à 2,80; poissons multipliés par 2,4 (goujon 2,90, ablette 2,40, perche 4,80, tanche 6,00, truite 7,20, brochet 12,00). Plafonds: Basile 12 à 35 €, Colette 45 à 85 €. Pot-au-feu de l'acte 3 conditionné à la cuisine payée. | le client trouve la maison trop lente (cuisine au jour 10, étage au jour 82 pour un duo tranquille) et veut le pot-au-feu dans la cuisine de la maison. Cible: environ deux fois plus vite, 40 à 50 € par jour à l'acte 1. Prix des pièces inchangés (cahier). L'omelette ne peut dépasser 2,89 € sans être rachetée plus cher qu'elle ne se vend (3,50 €, amitié et repas compris), d'où 2,80 €; les œufs crus restent à 1,00 € pour que cuisiner paie toujours. |
| 2026-11-11 | Commande du samedi branchée (section 6.1): 40 lignes à 1,25 fois le meilleur rachat, payées au coffre commun, environ 60 € par semaine; huit lettres. | audit d'Aubrune, B.6; le client trouve la maison trop lente: une rentrée régulière au coffre, sans plafond de commerçant. |
| 2026-11-11 | Collections d'Aubrune: 10 poissons nouveaux rachetés au café (2,00 à 9,60 €), graines de fleurs en rayon (0,30 à 0,50 €), 9 trésors « rares » ajoutés aux fouilles; fleurs, insectes, trésors et nouveaux plats sans rachat. | `collections-aubrune.md`. Le prix moyen d'une prise passe de 4,72 à 4,31 € (plus de poissons communs): duo tranquille 103,30 à 99,40 € (acte 2) et 104,90 à 101,10 € (acte 3); médian et appliqué inchangés (plafond du café). Les fouilles rendent environ 1,50 € de moins par jour en vieilles pièces (non compté par le script). |
| 2026-11-11 | Tourte du quai: étal gratuit retiré de l'épicerie; recette à deux postes (farine, œuf; pommes de terre, poireau); en rayon chez Odette à 12,00 €, une par semaine, dès le retour du train. | audit B.11: le bonus « Mains sûres » était permanent et gratuit. Aucun effet sur le revenu (la tourte ne se revend pas). |
| 2026-11-11 | Coquillages et rivière (cahier 4.7): 8 trouvailles de berge et la girolle, rachetées par Solange (coquille 1,20, escargot d'eau 0,40, galet veiné 0,90, bois flotté 0,70, plume de héron 0,80, plume de martin-pêcheur 2,40, perle 6,00) et le café (coquille 0,60, bois flotté 0,50, tesson 1,00, girolle 1,60); girolle 1,00 à l'épicerie. Coquille et plume de héron ajoutées aux besoins du jour de Solange. | audit B.7. Une tournée complète (19 points, 715 m, environ 9 minutes à deux) rapporte 10,80 € par temps sec en journée, 16 € à l'aube, 20 à 27 € sous la pluie, borné à 10 € par jour chez Solange (plafond): 1 à 2 € par minute, contre 5,90 € pour la pêche (11 poissons, 48,40 € en 8 minutes). Hors du script du revenu. Détail: `carte-aubrune/plan.md`, section 19. |
| 2026-11-11 | Meubles (section 8): 37 meubles nouveaux rendus obtenables (45 en tout), de 4 à 58 € chez Basile, Mado, Solange, Odette, Achille, Margot et Colette, payables de la bourse ou du coffre; plan des bûches rangées donné par Basile (1 cœur); pendule et portrait offerts par deux suites secondaires; fiche de la baignoire (non posable tant que sa vignette manque). | audit B.2, B.9, B.12, B.20. Une pièce à vivre meublée coûte environ 3 jours de bourse (1,5 jour de revenu du duo); la maison entière 650 €, meublée au jour 31 pour un duo médian, le jour de l'étage: les meubles ne rallongent pas la maison. Aucun meuble racheté, donc aucun effet sur le revenu. |
