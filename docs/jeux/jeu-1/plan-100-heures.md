# La Petite Ligne: plan des 100 heures

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | proposition; D1 et D3 tranchées par le client le 2026-11-01, les autres décisions à valider (section 9) |
| Version du document | 0.2 |
| Dernière mise à jour | 2026-11-01 |
| Rédaction | game-designer, sur brief du manager (gauntlet de qualité, tour 1) |
| Documents liés | cahier des charges (règles de référence): `cahier-des-charges.md`; démo: `demo.md`, `semaine-2.md`; gauntlet: `gauntlet/grille.md`, `docs/modeles/gauntlet-qualite.md`; simulation de ce plan: `simulations/plan_100_heures.py`; retours du client: `retours/2026-11-01/retours.md`; conception du tour 10: `tour-10-conception.md` (simulation `simulations/tour10_maison.py`) |

## En bref

- **Objectif du client (2026-10-31)**: 100 heures de jeu à deux, amusantes et sans répétition, au niveau de soin des meilleures simulations de vie paisibles (références de qualité, jamais de contenu).
- **Point de départ**: une démo de deux semaines (environ 2 h), écrite jour par jour: chaque événement est calé sur une date. Ce calendrier écrit ne passe pas à l'échelle: à 100 h, il faudrait écrire 372 journées une par une.
- **Le principe du plan**: deux couches qui s'empilent. Des **systèmes qui renouvellent** le quotidien (saisons, météo tirée, commande générée, annonces, répliques vivantes, envies, visiteurs, collections) et du **contenu écrit qui avance** (huit arcs, 30 habitants et leurs histoires, sept gares, quatre métiers de plus, la maison qui grandit, le mystère d'Émile).
- **Le calendrier**: 372 journées, 4,4 années de jeu, 99,9 h, 150 séances de 40 minutes (section 2); avec la journée doublée (D1), 397 journées et 4,7 années pour 100 h (section 2.2). Huit arcs de 3 à 21 heures; chaque arc ouvre un lieu, des habitants, une mécanique et un but au long cours.
- **Anti-répétition et coopération**: seize règles chiffrées (section 4), toutes vérifiées par un robot « longue vie » qui joue cinq années simulées et par des statistiques sur les données. Exemple mesuré: avec la réserve de répliques de la démo, 41 % des conversations d'un habitant redisent une phrase entendue dans les 28 jours; avec la règle proposée, 0,7 %.
- **Prochain jalon (J1, détaillé section 7)**: « La fête des semailles et l'inauguration du quai », jours 15 à 23. Il pose huit systèmes de renouvellement (lots L1 à L8) sur la carte actuelle, avec dix modèles 3D nouveaux. Environ 1 h 20 de jeu en plus.
- **Neuf décisions pour le client** (section 9). Deux sont tranchées depuis la première soirée de jeu (2026-11-01): **D1**, des journées plus longues (la journée double dès le jour 1, 0,7 s par minute de jeu, avec un réglage de rythme; section 2.1), et **D3**, la maison s'agrandit (pièces bâties à deux d'abord, plan libre ensuite).
- **Retours du 1er novembre** (section 3.4): carte trop petite, trop peu d'habitants, aucun intérieur, besoins, coupes de cheveux, fenêtres, rangement, maison. Le tour 10 en fait la première étape (`tour-10-conception.md`): la rue Haute, deux habitants, deux intérieurs, des besoins doux, le cellier et la chambre, un rangement à cases; la suite est répartie dans les arcs.

## 1. Point de départ: ce que contient la démo

Mesures du 2026-10-31 sur `games/la-petite-ligne/donnees/` et `assets/`:

| Contenu | Démo (jours 1 à 15) | Version 1 du cahier (année 1) | Jeu complet (100 h, ce plan) |
|---|---|---|---|
| Habitants | 4 (Firmin, Odette, Basile, Jeanne) | 10, puis 13 avec ceux du bourg ajoutés au tour 10 | 30, puis 34 (section 3.4) |
| Textes (répliques, objectifs, lettres, messages) | 282, dont 88 répliques d'habitants en 77 dialogues | environ 1 500 | environ 9 000 (section 6) |
| Quêtes | 17 (6 principales, 11 secondaires) | 14 étapes de chapitre, 50 étapes d'habitants | environ 330 (section 6) |
| Objets | 46, dont 8 recettes | environ 250 | environ 700 |
| Cultures | 3 | 20 et 4 arbres | 44 et 10 arbres |
| Envies | 21 (15 personnelles, 6 à deux) | 60 | environ 240 |
| Lettres | 9 | 40 | environ 250 |
| Modèles 3D | 5 fichiers GLB, 212 maillages | inventaire du cahier, section 7 | environ 900 maillages (section 6) |
| Musiques | 9 | environ 20 | environ 45 |
| Sons | environ 120 | | environ 400 |
| Commande du samedi | 2, écrites | générée (EC-05 à EC-09) | générée |
| Météo | 15 journées écrites | tirée (FE-09) | tirée, aléas compris |

Diagnostic:

- La démo est un calendrier écrit: les quêtes partent sur `day_is` ou `day_at_least`, la météo et les commandes sont des listes par jour. C'est juste pour une démo qui doit se dérouler pareil pour tous; c'est intenable sur 372 journées.
- Les habitants n'ont qu'une poignée de phrases du quotidien: à la troisième semaine, ils se répéteraient presque à chaque conversation (section 4.2, mesure).
- Les ressources s'épuisent: les 12 arbres ne repoussent pas, la carte est un bourg compact de 64x48 m, trois cultures, trois poissons.
- La revue du tour 1 (`gauntlet/revues/tour-01-contenu-coop.md`, pilier 6 à 5 sur 10, pilier 7 à 6 sur 10) le confirme par la mesure: 55 % de redites en deux semaines à une conversation par jour, parce que le tirage ne garde que les répliques de plus haute priorité; quatre jours sans nouveauté (jours 11 à 14); un seul geste à deux en quinze jours (la poutre); 8 quêtes sur 17 qui se résument à « apporter N objets »; une réserve d'envies vide au jour 15 sur une graine. Ses cinq corrections (D1 à D5) sont le lot L0 de J1 (section 7.1); les règles R4, R6, R13 à R16 ci-dessous les généralisent.
- Ce qui est solide et se garde: le moteur de quêtes à conditions et effets (`donnees/README.md`), les scènes à deux, les robots qui jouent toute la démo sur plusieurs graines, la sauvegarde exacte, le rendu et l'interface.

## 2. Le rythme et la somme des heures

### 2.1 La journée doublée (D1, tranchée par le client le 2026-11-01)

Après sa première soirée de jeu, le client a trouvé les journées « beaucoup trop courtes » (R14) et a tranché D1: des journées plus longues. Au lieu du passage de 0,35 s à 0,8 s au jour 24 que proposait la version 0.1, la journée double dès le jour 1, avec un réglage de rythme décidé à deux.

| Période | Horloge | Journée réelle | Raison |
|---|---|---|---|
| Version 0.1 (proposée) | 0,35 s jusqu'au jour 23, puis 0,8 s | 8 min, puis 16,6 min | la démo sur la carte compacte, puis la Halte entière |
| **Retenu (D1, 2026-11-01)** | 0,7 s par minute de jeu dès le jour 1 (la durée de la démo doublée) | 15,1 min au modèle du cahier (900 minutes de jeu dehors et 4,6 min fixes) | le duo a fait le tour de la journée trop vite; un autre membre double la durée et ajoute le réglage |
| Réglage du duo « Rythme » | trois vitesses autour de 0,7 s (valeurs posées avec le réglage, à reporter ici) | | chaque duo choisit; une proposition chez l'autre, comme EC-11 |

Le contenu se compte en heures de jeu, jamais en secondes: les horaires, les besoins (tour 10, section 3) et les envies tiennent à toute vitesse entre 0,5 et 1,0 s. Ce qui dépend de la vitesse: la marche (la rue Haute est à 24 à 27 s de la maisonnette, 34 à 39 minutes de jeu) et l'économie (la paie des commandes a été calée sur les robots à 0,35 s: à remesurer à la nouvelle vitesse avant tout réglage de prix; le tour 10 l'a testée aussi à revenus x 1,25). La phrase d'Odette prévue au jour 22 (« Les jours rallongent... ») reste une phrase d'été, sans changement d'horloge.

### 2.2 Le calendrier des arcs

Résultat de `python3 simulations/plan_100_heures.py` (partie 1), saisons de 21 jours (TE-02):

| Arc | Jours | Saisons | Journées | Heures | Cumul |
|---|---|---|---|---|---|
| A1 Le printemps de la Halte (démo, semaine 3) | 1 à 23 | printemps 1, début de l'été 1 | 23 | 3,3 | 3,3 |
| A2 L'été du bourg | 24 à 42 | été 1 | 19 | 5,3 | 8,6 |
| A3 Les Vergers | 43 à 84 | automne 1, hiver 1 | 42 | 11,6 | 20,2 |
| A4 Lac-Clair (épisode 2) | 85 à 137 | printemps 2 à automne 2 | 53 | 14,7 | 34,9 |
| A5 La Tourbière (épisode 3) | 138 à 190 | automne 2 à été 3 | 53 | 14,7 | 49,5 |
| A6 Les Hauts (épisode 4) | 191 à 243 | été 3 à hiver 3 | 53 | 14,7 | 64,2 |
| A7 Le Terminus oublié (épisode 5) | 244 à 296 | hiver 3 à automne 4 | 53 | 14,7 | 78,8 |
| A8 La vallée entière | 297 à 372 | automne 4 à été 5 | 76 | 21,0 | 99,9 |
| **Total** | | 4,4 années | **372** | **99,9** | 150 séances de 40 min |

Avec la journée doublée (D1), les mêmes journées durent plus longtemps (`simulations/tour10_maison.py`, partie 1): A1 5,8 h, A2 4,8 h, A3 10,6 h, A4 à A7 13,3 h chacun, soit 93,6 h pour les 372 journées. Pour 100 h, A8 passe de 76 à 102 journées (25,7 h): **397 journées, 4,7 années de jeu, 100,2 h**. L'année 1 (A1 à A3) fait 21,2 h au lieu de 20,2 h. `plan_100_heures.py` garde l'ancienne horloge: à mettre à jour quand les vitesses du réglage seront fixées.

Contrôle: A1 à A3 (20,2 h) forment la version 1 du cahier (une année, deux gares); A4 à A7 (58,7 h) les quatre épisodes du cahier (53 journées chacun, 6.11); A8 (21 h) le « long terme » du cahier (18,1 h dans la version 0.1), allongé de 2,9 h parce que la démo, plus rapide, raccourcit l'année 1 de 3,1 h. Le script refuse un total hors de 99 à 101,5 h.

À deux heures par semaine, c'est un an de soirées. Un duo optimiseur ira plus vite sur les chapitres (une semaine de moins sur le chapitre 2 selon `economie_et_chapitres.py`), mais les saisons, les fêtes et les années ne s'accélèrent pas: le jeu ne s'épuise pas plus vite qu'il ne se vit.

## 3. La structure longue

### 3.1 Les huit arcs

Chaque arc apporte au moins: un lieu neuf, des habitants neufs ou une étape neuve des anciens, une mécanique neuve, un but au long cours, une fête ou une inauguration. Aucun arc ne retire rien (SV-06).

| Arc | Durée | Lieu neuf | Habitants | Mécanique neuve | Buts | Relié à |
|---|---|---|---|---|---|---|
| **A1 Le printemps de la Halte** | 3,3 h | la place en fête, le quai et sa marquise | Lucie (5e habitante de la Halte) | saisons et météo tirée, commande générée, répliques vivantes, petites annonces, carnet de la vallée, chantier collectif, repousse des arbres | inaugurer le quai (chapitre 1) | ouvre la voie (A2): la draisine est prête depuis la semaine 2 |
| **A2 L'été du bourg** | 5,3 h | la Halte entière: la rue Haute (tour 10), les intérieurs du bourg, l'amont de l'Aubrune et le moulin, le bois de la Côte, gué, remise; puis la voie des Vergers (400 m) | les habitants de la Halte passent aux étapes 2 et 3 de leur histoire; Achille, Solange, Armand et Berthe arrivent (section 3.4); trois premiers visiteurs | les cinq métiers, rangs 1 à 3 et regard du métier; liens chiffrés; jumelles et oiseaux; cultures d'été; agrandissements de la maison par pièces; aléas d'été (grêle, coup de sec) | rangs de métier, carnet d'oiseaux, la cuisine et la chambre, dégager les quatre obstacles de la voie à deux | la voie mène aux Vergers (A3) |
| **A3 Les Vergers** | 11,6 h | le hameau des Vergers, l'étang, les terrasses | Hélène, Augustin, Rose, Victor, Nadia | deux gares et trajets, chèvres, ruches, arbres fruitiers, conserverie, Foire d'automne, hiver (neige, poêle, Veillée des contes), plan libre de la maison | chapitre 2 (gare des Vergers), première année complète | la page du carnet de l'oncle parle de Lac-Clair (A4); le locotracteur de Nadia annonce Cheminot (A5) |
| **A4 Lac-Clair** | 14,7 h | le lac, ses rives, le lavoir, l'île | cinq habitants du lac | métier Artisanat (poterie, tissage), barque, pêche au lac et pêche de nuit aux lanternes; les fêtes de l'année 2 ont chacune une activité nouvelle | rebâtir le lavoir, Fête des lanternes du lac | l'argile et la laine nourrissent la maison; le tissage habille les coins à soi |
| **A5 La Tourbière** | 14,7 h | les brumes, l'herboristerie, la tourbière | cinq habitants | métier Cheminot (voie, signaux, wagons), croisement des semences et conservatoire, brumes qui cachent et révèlent | premier wagon restauré (wagon-serre), conservatoire à moitié | les wagons deviennent un fil au long cours (A8) |
| **A6 Les Hauts** | 14,7 h | les estives, le chalet d'alpage de Rose | cinq habitants | rangs 4 et 5 de tous les métiers, brebis et vaches, fromagerie, transhumance à deux (grand geste à deux en plusieurs étapes) | la transhumance, la fromagerie des Hauts | l'histoire de Rose et de son chalet (A3) trouve sa fin |
| **A7 Le Terminus oublié** | 14,7 h | la gare qui n'est sur aucune carte | cinq habitants, dont la dernière trace d'Émile | fin de l'histoire d'Émile: énigmes en chaîne sur toute la vallée, wagon-salon, grand concours de la vallée | le premier train qui monte jusqu'au Terminus | clôt le fil rouge ouvert le jour 1 (la boîte en fer) |
| **A8 La vallée entière** | 21 h | toute la ligne, la vallée électrifiée | les 30 habitants, leurs familles de passage, les visiteurs qui reviennent | électrification (premières ampoules, veillées éclairées), vélo, « maison idéale », conservatoire complet, almanach de l'année 5 (événements uniques), marché du samedi tenu par le duo | achever le carnet, les wagons, la maison idéale, les histoires « Comme la famille » | fin ouverte: la vallée continue sans fin (HI-04) |

### 3.2 Les fils transversaux

Les arcs avancent dans l'espace; ces fils avancent dans le temps et relient les arcs entre eux.

| Fil | Ce qui avance | Rythme | Exemple d'étape |
|---|---|---|---|
| **Saisons et années** | cultures, poissons, oiseaux, cueillettes, palette, musiques, emplois du temps des habitants, fêtes | une saison toutes les 21 journées (5,8 h); chaque année a son almanach (règle R9) | année 2: la crue de printemps de l'Aubrune (un gué à rebâtir, des poissons remontés) |
| **Métiers** | 5 métiers aux rangs 1 à 3 (A2), Artisanat (A4), Cheminot (A5), rangs 4 et 5 (A6), une spécialité par rang 3 et 5 | un rang principal tous les 20 à 30 jours | rang 4 de Pêche et cueillette: la nasse à anguilles et la pêche de nuit |
| **La maison qui grandit** (D3, tranchée le 2026-11-01) | maisonnette (démo), cellier et chambre bâtis à deux (tour 10, été et automne de l'année 1), grenier aménagé (hiver 1), cuisine et atelier (A2 et A3), plan libre (J3), atelier de poterie (A4), véranda (A5), étage (A6), maison idéale (A8); le rangement grandit avec elle (coffre, grand coffre, étagères, cellier) | une étape par arc au moins | « La chambre a enfin une fenêtre. Tu dors avec le chant du merle. » |
| **Habitants** | 34 habitants (les 30 de la version 0.1 et quatre de plus au bourg: Achille, Solange, Armand, Berthe), chacun en cinq étapes (HA-02), puis une vie après leur histoire (ils changent de métier, d'emploi du temps, de tenue, d'avis) | une étape d'habitant tous les deux à trois jours en moyenne | Jeanne grandit: dix ans à l'année 1, onze à l'année 2, d'autres questions, d'autres envies |
| **Le mystère d'Émile** | trois énigmes (A1, A3), le carnet de route (démo), une énigme par épisode, la chaîne finale (A7) | une énigme par arc | « Là où l'eau ne gèle jamais, j'ai laissé la clé du dernier quai. É. L. » |
| **Le carnet de la vallée** | 165 pages (version 1) puis 80 par épisode et 50 au long cours: 535 pages | des pages tous les jours; coup de pouce des collections (CN-04) | « Martin-pêcheur: vu ensemble, au gué, le 9 de l'été, année 1. » |
| **La ligne** | chaque gare rouverte allonge le trajet du train du samedi; le train porte plus de visiteurs et de colis | une gare par arc à partir de A3 | le train du samedi s'arrête désormais à Lac-Clair: les visiteurs du lac descendent chez vous |

### 3.3 Ce qui se passe dans une journée, une semaine, une saison à 50 heures

Pour vérifier qu'à mi-chemin le jeu reste neuf, une journée typique de l'année 3 (été, A6):

- Petit-déjeuner: chacun son envie (une sur trois jamais vécue, section 4.3), la météo, une lettre d'un visiteur parti l'an dernier.
- Matin: soins du potager des Vergers et des brebis des Hauts, trajet en draisine.
- Jour: une annonce (« Livrer deux fromages aux estives »), une étape de l'histoire d'un habitant des Hauts, une page du carnet (un oiseau de montagne), la troisième étape de la transhumance.
- Veillée: tissage d'un rideau pour le coin à soi, plan de l'étage.
- La semaine: la commande du samedi tirée parmi 120 produits, un visiteur, un aléa (orage de montagne).
- La saison: une fête dont une activité est neuve cette année, un changement de métier principal possible.

### 3.4 Les retours du 1er novembre dans les 100 heures

Après la première soirée de jeu (`retours/2026-11-01/retours.md`), le client a demandé un monde plus grand, plus d'habitants, des intérieurs, des besoins, plus de coiffures, des fenêtres, un rangement limité et une maison qui grandit. Chaque sujet commence au tour 10 (`tour-10-conception.md`) et continue dans les arcs, pour se renouveler jusqu'à 100 h.

| Sujet | Tour 10 (année 1, jours 1 à 64) | Suite dans les arcs | Ce qui le renouvelle sur 100 h |
|---|---|---|---|
| R23 Monde plus grand | la rue Haute: la carte passe de 64 à 100 m de large (ru de la Côte, fournil, mercerie-coiffure, maison de Lucie, école) | A2: intérieurs du bourg, amont de l'Aubrune et moulin de la Vanne, bois de la Côte; A3: la voie des Vergers; puis une gare par arc | un lieu par arc au moins (section 3.1) |
| R24 Habitants | Achille Pradel (boulanger), Solange Mérigot (coiffeuse et mercière, elle garde Jeanne) | A2: Armand Castagné (instituteur et secrétaire de mairie, les archives d'Émile), Berthe Lavergne (meunière); Lucie avec J1; cinq habitants par gare | 34 habitants en cinq étapes, réserves de répliques R3 (environ 430 phrases de plus pour les quatre du bourg) |
| R25 Intérieurs | l'épicerie-pension d'Odette, la mercerie-coiffure | A2: la halte, le fournil, l'école, la scierie, le moulin; un intérieur au moins par gare (chèvrerie, gare des Vergers...); les maisons des habitants dans les scènes de leurs histoires | chaque intérieur a ses heures, ce qu'on y fait et une étape d'histoire |
| R15 Besoins | Ventre, Repos et Cœur visibles, bonus seulement; souper, sieste, retrouvailles, sommeil de la chambre | recettes et desserts de la cuisine (A2), poêle de l'hiver (A3), Veillée des contes | les plats changent avec les saisons et les gares; jamais de besoin nouveau qui punit |
| R16 Coiffures | 15 coupes, 8 couleurs; au salon en cours de partie, proposition de l'autre depuis le banc | une coupe de saison par saison (Solange, après sa scène 3), barbes et moustaches si le client les veut, perruques de théâtre (scène) | quatre coupes nouvelles par année |
| R17 Fenêtres | rideaux aux seules fenêtres, ouverts et fermés; six couleurs | tissage (A4): rideaux tissés à la maison; volets peints | les fenêtres des pièces nouvelles |
| R18 Maison (D3) | cellier et chambre, bâtis à deux, l'ordre choisi par le duo | grenier, cuisine, atelier, plan libre (J3) et la suite de la section 3.2 | une étape de maison par arc |
| R19 Rangement | coffre de 20 cases, grand coffre, étagères, cellier; outils au râtelier | buffet, commode, grenier de rangement, cellier de la gare des Vergers | la capacité suit les objets (690 à 100 h) |

## 4. Principes anti-répétition

### 4.1 Les seize règles

Chaque règle a un seuil, une mesure et un outil de vérification. « Robot longue vie »: le simulateur sans affichage joue 5 années sur 8 graines avec deux profils (médian, tranquille) et écrit un journal de tout ce que voit chaque joueur (répliques, envies, annonces, commandes, visiteurs, événements, pages). « Statistiques »: un contrôle des fichiers de données, sans jouer.

| # | Règle | Seuil | Vérification |
|---|---|---|---|
| R1 | Une nouveauté par journée | au moins une « première fois » par journée (réplique jamais entendue, page, objet, lieu, étape, événement) pour 95 % des journées des 100 h, et au moins trois par semaine pour 100 % des semaines | robot longue vie: courbe des premières fois par journée |
| R2 | Répliques du quotidien qui se renouvellent | moins de 2 % des conversations redisent une phrase entendue par ce joueur dans les 28 derniers jours; moins de 20 % sur toute la présence de l'habitant | robot longue vie; simulation section 4.2 |
| R3 | Réserves de répliques par habitant | au moins 8 phrases par niveau de lien, 10 par saison, 3 par type de temps, 15 gabarits de souvenir; 5 phrases neuves par saison et par année vécue ensuite | statistiques (extension de `valider_donnees.py`) |
| R4 | Tirage « la moins récente » | parmi les répliques possibles, l'habitant dit celle que ce joueur a entendue le moins récemment (jamais entendue d'abord), à égalité au hasard | test unitaire du tirage |
| R5 | Le monde réagit | 40 % des conversations au moins parlent d'un fait des trois derniers jours (ce que le duo a récolté, offert, bâti, pêché, la météo, la fête, l'autre joueur), par gabarits à variables (« {joueur} m'a apporté des {objet} hier ») | robot longue vie: part des répliques de souvenir |
| R6 | Envies | jamais la même deux fois en 7 jours pour un joueur (HA-07); au moins 24 envies possibles par saison au départ, 6 de plus par arc et par saison; coup de pouce x4 pour les envies jamais vécues; au moins 30 % d'envies jamais vécues chaque année | robot longue vie; simulation section 4.3 |
| R7 | Annonces et commandes | annonces tirées parmi au moins 30 gabarits (10 de plus par arc), jamais le même gabarit deux fois en 10 jours; commande du samedi selon EC-07, et au moins deux produits commandables nouveaux par saison vécue | robot longue vie; `economie_et_chapitres.py` |
| R8 | Les saisons changent le travail | chaque saison change au moins 4 cultures, 3 poissons, 4 oiseaux, 3 cueillettes, la palette, la musique de journée, l'emploi du temps des habitants, et apporte une fête | statistiques par saison et par lieu |
| R9 | Les années ne se ressemblent pas | chaque fête a une activité neuve par année pendant 4 ans; chaque année a au moins 6 événements uniques (almanach) et au moins 6 visiteurs jamais vus; un habitant qui a fini son histoire change (nouveau rôle, nouvelles répliques) | statistiques sur l'almanach; robot longue vie |
| R10 | Collections sans traîne | coup de pouce par collection (CN-04); pour chaque collection, la dernière entrée vient au plus 10 h après la dernière entrée débloquée pour 90 % des duos | `collections_v1.py` étendu à toutes les collections |
| R11 | Trois horizons toujours visibles | chaque matin, le carnet affiche au moins un but du jour (envie, annonce), un de la semaine (commande, fête), un au long cours (étape de chapitre, d'habitant, de maison) | robot longue vie: état du carnet à chaque aube |
| R12 | Pas de corvée qui grossit | les soins quotidiens (arroser, nourrir, traire) prennent au plus 30 % du temps dehors; chaque arc offre une aide qui allège (arrosoir 3x3, abreuvoir, nasse, Jeanne qui nourrit les poules le dimanche) | robot longue vie: temps par activité |

| R13 | Des quêtes de formes variées | au plus 35 % de quêtes « apporter N objets » par arc, jamais deux de suite chez le même habitant; au moins cinq formes par arc parmi: observer (lieu, heure, météo), retrouver, attendre le bon moment, bâtir, se coordonner à deux, accompagner, deviner (énigme), fabriquer | statistiques sur `quetes.json` (forme déclarée par quête) |
| R14 | Des samedis qui diffèrent | chaque train a un « fait du samedi » tiré d'une réserve (visiteur à accueillir, commande à thème, colis surprise, retard du train, fanfare, habitant qui part ou revient), jamais le même deux samedis de suite, au moins 12 sortes à 100 h | robot longue vie |
| R15 | Des gestes à deux qui se renouvellent | au moins un geste à deux exigé par semaine de jeu; au moins un geste à deux nouveau par arc (porter, lever, pousser la draisine, pomper, danser, ramer la barque, l'aiguillage et la cabine du Cheminot, la transhumance, tendre la toile du wagon-salon); aucun ne peut échouer (GE-01) | robot longue vie: gestes par semaine et par sorte |
| R16 | Des savoirs propres à chaque joueur | au moins deux informations propres à un joueur dès J2 (envie, regard du métier), une de plus par arc (lettre adressée à un seul, indice d'énigme partagé en deux moitiés, carte du pêcheur); au moins 25 % des envies personnelles touchent l'autre joueur (offrir, montrer, rejoindre) | statistiques sur les envies et les regards; observation chez le client |

Surprises (R1, R9): une réserve d'au moins 60 événements rares et uniques sur les 100 h (une volée de grues qui passe, un cerf-volant perdu dans le pommier, un arc-en-ciel double vu ensemble, le facteur remplacé un jour par sa sœur), au plus un par semaine, chacun une seule fois par monde, chacun avec sa page du carnet ou sa réplique de souvenir.

### 4.2 Simulation des répliques

`python3 simulations/plan_100_heures.py` (partie 2). Hypothèses: chaque joueur parle à un habitant donné une journée sur deux environ (55 %), 40 % des conversations portent sur un souvenir (300 variantes: 15 gabarits par 20 faits), le lien monte d'un niveau par mois.

| Réserve d'un habitant | Habitant de la Halte (371 journées): redites, dont à moins de 28 jours | Habitant d'un épisode (120 journées) |
|---|---|---|
| démo actuelle: environ 6 phrases, tirage au hasard | 52 %, 40,6 % | 32 %, 30,9 % |
| 8 générales et 6 par saison, au hasard | 43 %, 19,5 % | 18 %, 14,7 % |
| les mêmes, tirage « la moins récente » | 41 %, 10,9 % | 11 %, 5,8 % |
| 8 par niveau, 10 par saison, 3 par temps, la moins récente | 32 %, 0,8 % | 4 %, 0,7 % |
| **cible (R3)**: la même, plus 5 neuves par saison et par année | **17 %, 0,7 %** | **2 %, 0,7 %** |

Lecture: le tirage « la moins récente » coûte une ligne de code et divise les redites récentes par deux; la réserve par niveau, par saison et par temps les rend rares; les phrases neuves de chaque année font le reste pour les habitants du début, qui vivent quatre ans avec le duo. La cible coûte environ 107 phrases par habitant, plus 20 par année vécue après la première.

### 4.3 Simulation des envies

Partie 3 du même script: part des envies déjà vécues par un joueur, années 1 à 5.

| Réserve par saison | Année 1 | Année 2 | Année 3 | Année 4 | Année 5 |
|---|---|---|---|---|---|
| 12, au hasard | 44 % | 99 % | 100 % | 100 % | 100 % |
| 24, au hasard | 20 % | 76 % | 93 % | 97 % | 99 % |
| 24, coup de pouce x4 | 9 % | 77 % | 99 % | 100 % | 100 % |
| **24, plus 6 par arc et par saison, coup de pouce x4 (R6)** | **10 %** | **49 %** | **66 %** | **69 %** | **69 %** |

Lecture: une réserve fixe s'épuise dès l'année 2, coup de pouce ou non; seul l'apport de chaque arc garde un tiers d'envies neuves. Les envies déjà vécues ne sont pas un défaut en soi (« pique-niquer au bord de l'étang » se refait avec plaisir), à condition qu'un tiers au moins surprenne.

### 4.4 Vérification automatique

1. **Statistiques sur les données** (à chaque `pnpm verifier`): l'extension de `outils/valider_donnees.py` compte, pour chaque habitant, chaque saison, chaque lieu et chaque arc, les réserves de R3, R6, R7, R8, R13 et R16, et échoue sous le seuil. Elle signale aussi les répliques jamais atteignables (conditions contradictoires).
2. **Robot longue vie** (nouveau test, hors de la boucle rapide, lancé à chaque jalon): 5 années, 8 graines, 2 profils, en moins de 10 minutes grâce à une horloge sans affichage. Il écrit `test-results/longue-vie.json` et vérifie R1, R2, R5, R6, R7, R9, R11, R12, R14 et R15.
3. **Couverture du contenu**: part des textes écrits jamais affichés en 100 h simulées, sous 5 % (un texte jamais vu est un texte perdu).
4. **Courbes jointes au journal du gauntlet**: premières fois par journée, redites par habitant, temps par activité.

## 5. Systèmes manquants, par ordre de valeur

Effort en tours de gauntlet (60 à 90 minutes de studio, membres en parallèle): S = 1 tour, M = 2 à 3, L = 4 à 6, XL = plus de 6. La valeur se lit à ce que le système renouvelle par heure de jeu.

| # | Système | Valeur | Effort | Contenu à produire (100 h) | Jalon |
|---|---|---|---|---|---|
| 1 | **Saisons et météo tirée** (TE-02, FE-03, FE-09): saison courante, cultures de saison, météo tirée par la graine du monde, jours imposés (fêtes), conditions `season_is` | sans elle, rien ne change d'une semaine à l'autre | M | palettes et musiques par saison, 44 cultures | J1 |
| 2 | **Répliques vivantes**: réserves conditionnées (lien, saison, temps, jour, lieu), tirage « la moins récente », gabarits de souvenir à variables, mémoire de qui a fait quoi (HA-03) | le monde réagit; les habitants ont une voix sur 100 h | M | environ 3 900 phrases du quotidien et 450 gabarits (section 6) | J1 |
| 3 | **Commande du samedi générée** (EC-05 à EC-09) et confiance | le pouls hebdomadaire ne s'use pas | S | prix et lots de 120 produits | J1 |
| 4 | **Petites annonces** (EC-10) | un but du jour neuf chaque matin | S | 100 gabarits | J1 |
| 5 | **Carnet de la vallée** (CN-01, CN-02): pages, « ensemble », progression commune (SV-08) | le but au long cours le plus lisible | M | 535 pages | J1 |
| 6 | **Chantier collectif** (MA-08) et geste « lever » (GE-03) | les rendez-vous à deux de chaque arc | M | un chantier par gare (7) et 10 chantiers de fil | J1 |
| 7 | **Fêtes**: cadre d'une journée spéciale (décor, étals, activités, musique) | quatre temps forts par année, variés chaque année | M | 4 fêtes et 16 variantes annuelles, 5 fêtes de gare | J1 (première fête) |
| 8 | **Repousse des ressources**: arbres qui repoussent, coupes du bois, pierres | lève le mur du bois fini | S | souches et jeunes arbres | J1 |
| 9 | **Liens chiffrés et histoires en cinq étapes** (HA-01, HA-02) | 150 étapes d'habitants, la moitié des émotions du jeu | M (système), L (contenu par arc) | 150 étapes, dont 60 scènes à deux | J2 |
| 10 | **Métiers, rangs, regard du métier** (ME-01 à ME-05) | la profondeur et l'asymétrie qui fait parler | L | 7 métiers, 5 rangs, 14 spécialités | J2 |
| 11 | **Collections**: jumelles et oiseaux, poissons et cueillettes complets, coup de pouce (CN-03 à CN-06) | des découvertes jusqu'à la fin | M | 72 oiseaux, 36 poissons, 36 cueillettes | J2 |
| 12 | **Visiteurs du samedi** (HA-06) | des têtes neuves chaque semaine | M | 36 modèles, assemblés de pièces communes | J2 |
| 13 | **La maison qui grandit**: pièces ajoutées (J2), puis plan libre à deux (MA-01 à MA-07, J3) | le grand projet personnel du couple | XL | 60 meubles en essences et teintes, kits de murs par gare | J2, J3 |
| 14 | **Plusieurs zones et trajets** (GE-06): voie, draisine, chargement par zone | la vallée s'agrandit | L | 7 gares, 6 voies | J2 (voie), J3 |
| 15 | **Bêtes et arbres** (FE-07, FE-08): chèvres, ruches, fruitiers, puis brebis et vaches | une vie à soigner qui grandit | L | 6 bêtes, 10 arbres | J3, A6 |
| 16 | **Almanach des années** (R9): événements uniques, variantes des fêtes, habitants qui changent | l'année 3 ne ressemble pas à l'année 1 | M | 60 événements, 16 variantes de fêtes | J4 |
| 17 | **Cadre d'épisode** (SV-06): contenu ajouté sans réinstaller, migrations | rend les arcs A4 à A8 livrables un par un | L (architecte-technique) | | J4 |
| 18 | **Robot longue vie** et statistiques (section 4.4) | sans lui, on ne prouve rien | M (qa-testeur) | | J1 (premier jet), J2 |
| 19 | **Besoins doux** (tour 10, R15): Ventre, Repos et Cœur visibles, bonus seulement, sieste, retrouvailles | donne un sens aux repas, au lit et aux moments à deux | M | plats et desserts de chaque arc | tour 10 |
| 20 | **Intérieurs visitables** (tour 10, R25): règle commune, heures, coupe des murs par joueur | le bourg a des lieux où entrer | M (règle), S par intérieur | un intérieur par gare, cinq au bourg | tour 10, puis chaque arc |
| 21 | **Rangement à cases** (tour 10, R19) et râtelier | un but d'aménagement qui suit la maison | S | meubles de rangement par arc | tour 10 |
| 22 | **Apparence en cours de partie** (tour 10, R16): salon, couleurs, proposition de l'autre | se regarder, se surprendre | S | coupes de saison | tour 10 |

## 6. Volume de contenu à produire

Estimation pour les 100 h, par arc (textes: répliques et textes courts; modèles: maillages GLB distincts, variantes de couleur comprises dans le même maillage).

| Arc | Quêtes (étapes d'histoire, d'habitants, secondaires) | Textes | Objets | Modèles 3D | Musiques |
|---|---|---|---|---|---|
| Démo (fait) | 17 | 280 | 46 | 212 | 9 |
| A1 (J1) | 11, plus 12 gabarits d'annonces | 450 | 25 | 10 | 2 |
| A2 | 35 | 1 300 | 90 | 120 | 5 |
| A3 | 45 | 1 600 | 110 | 150 | 7 |
| A4 à A7 (par épisode) | 45 | 1 100 | 90 | 90 | 5 |
| A8 | 40 | 1 000 | 60 | 50 | 2 |
| **Total** | **environ 330** | **environ 9 000** | **environ 690** | **environ 900** | **environ 45** |

Détail des textes à 100 h: phrases du quotidien 3 900 (30 habitants à 92 phrases, plus 20 par année vécue après la première: R3), gabarits de souvenir 450, étapes d'habitants 1 800 (150 étapes, 12 répliques), quêtes et chapitres 1 000, lettres 250, envies 240, annonces 100, visiteurs 360 (36 modèles, 10 répliques), carnet 535 notes, almanach et fêtes 300, soit environ 9 000. C'est six fois le volume de la version 0.1 du cahier (1 500 textes pour la version 1), qui ne comptait pas les règles R2 à R5.

## 7. Les jalons

Chaque jalon prolonge la même sauvegarde (la partie du client continue), finit sur une scène et un écran de fin, et passe tout le gauntlet (G1 à G7) avant d'arriver chez le client.

| Jalon | Contenu | Heures ajoutées | Cumul | Ce qu'on valide avec le client |
|---|---|---|---|---|
| **J1 La fête des semailles et l'inauguration du quai** (jours 15 à 23) | section 7.1 | 1,3 | 3,3 | le monde qui réagit, la commande générée, la première fête |
| J2 L'été du bourg (jours 24 à 42) | la Halte entière, cinq métiers et rangs, liens et étapes 2 et 3 des cinq habitants, jumelles et 8 oiseaux, 7 cultures d'été, 3 visiteurs, cuisine et chambre ajoutées, la voie et ses quatre obstacles, Feux de la mi-été | 5,3 | 8,6 | l'asymétrie des métiers (la journée doublée est livrée avant, D1) |
| J3 Les Vergers, l'automne (jours 43 à 63) | le hameau, cinq habitants, chèvres, ruches, verger, Foire aux bêtes et aux fruits, chantier de la gare, plan libre de la maison | 5,8 | 14,4 | deux gares, la maison libre |
| J4 L'hiver et la première année (jours 64 à 84) | neige, poêle, Veillée des contes, inauguration des Vergers, almanach de l'année 2, cadre d'épisode | 5,8 | 20,2 | une année complète: c'est la version 1 du cahier |
| J5 à J8 Les quatre épisodes (A4 à A7) | un jalon par épisode, découpé en deux livraisons (le chapitre, puis la vie à la nouvelle gare) | 14,7 chacun | 78,8 | chaque gare |
| J9 La vallée entière (A8) | électrification, maison idéale, wagons, almanach de l'année 5 | 21 | 99,9 | les 100 h |

### 7.1 J1: la fête des semailles et l'inauguration du quai (jours 15 à 23)

**Titres**: « Le quai en fête » (étape 1.6 du cahier) est déjà le titre de la quête `firmin_flowers` de la semaine 2, et « Les gens du bourg » celui de `meet_village`: J1 prend d'autres titres.

**Intention**: la Halte devient un lieu qui vit sans vous attendre. Les habitants parlent de ce que vous avez fait, la météo n'est plus écrite, la coopérative compose sa commande, le bourg fait la fête, et vous bâtissez à deux la marquise du quai pour l'inaugurer le dimanche 23. Même carte; dix modèles nouveaux, dont Lucie.

**Déroulé**

| Jour | Ce qui arrive | Ce que font les joueurs | Rendez-vous à deux |
|---|---|---|---|
| 15, samedi (après 16 h) | la commande 2 est payée; la démo ne finit plus ici. Firmin: le quai mérite une marquise avant l'inauguration. Le panneau et la caisse du chantier apparaissent sur le quai. 18 h: lettre de la coopérative, commande 3 (générée) | lire le panneau du chantier, préparer la fête | |
| 16, dimanche | **Fête des semailles**, place du bourg, 10 h à 22 h, soleil imposé. Lucie, la factrice, rentre de sa tournée des hameaux et arrive à vélo à 10 h (la démo ne faisait que la citer) | planter l'arbre de mai (geste « lever »), la bourse aux graines d'Odette (plants de fraisier), le bal de 20 h à 22 h | lever l'arbre de mai; danser au bal |
| 17, lundi | météo tirée dès ce jour. Lucie fait le tour du bourg; dès qu'on a parlé aux cinq habitants, Firmin ouvre le tableau des annonces | première annonce; quête de Lucie (l'appareil photo) | |
| 18, mardi | trois annonces chaque matin; Basile montre les souches qui repoussent et confie quatre jeunes arbres (une fois plantés, il vend des planches) | chantier: planches, clous, travail | |
| 19, mercredi | Lucie confie la première carte postale ancienne (point de vue 1) | trouver le point de vue (CN-07), remplir la page | regarder le point de vue ensemble (page « ensemble ») |
| 20, jeudi | confiance niveau 2 (si atteinte: le catalogue gagne un rayon de meubles); Jeanne veut planter des fraisiers | lever la marquise (geste à deux), dernières planches | lever la marquise |
| 21, vendredi | dernier jour du catalogue et du printemps | remplir la caisse de la commande 3 | |
| 22, samedi | **premier jour de l'été**: palette d'été (P1, directeur artistique et tech-artist), envies d'été, Odette remarque que les jours rallongent (phrase de saison: l'horloge ne change plus ce jour-là, D1 l'a doublée dès le jour 1). 10 h: le train, le catalogue, un visiteur (l'inspecteur de la coopérative, venu pour l'inauguration). 16 h: commande 3 payée | dernières livraisons | le départ du train |
| 23, dimanche | **Inauguration du quai** (étape 1.6 du cahier): scène à deux, Firmin ressort l'uniforme d'Émile, bal, lettre de la coopérative (« Si la voie des Vergers est dégagée, le train ira jusque là-haut. ») | la fête, la photo du duo par Lucie | la scène, le bal (si la lettre de Lucie a été remise en semaine 2, Firmin l'invite à danser: le fil de la démo continue); écran de fin « Trois semaines à la Halte d'Aubrune » |

Garde-fou du jalon: si le chantier n'est pas fini au départ du train du jour 22, Basile et Firmin le finissent dans la nuit (« On a fini la marquise à la lanterne. Elle tient, regardez-moi ça. »), pour que l'inauguration ait lieu le 23 sur toutes les graines. À partir de J2, la règle du cahier (MA-08, HI-03) reprend: le village aide, l'inauguration attend.

Garde-fou de la remise: un duo qui n'a pas résolu la première énigme n'a ni la draisine ni l'accès à la remise. Si la remise est encore fermée au matin du jour 16, Basile force la serrure avant la fête (« La serrure a cédé. Elle était plus rouillée que moi. »): la casquette d'Émile (`firmin_uniform`) et la voie de J2 restent accessibles à tous; l'énigme garde sa récompense pour qui l'a trouvée.

**Systèmes livrés par J1** (réutilisés jusqu'à 100 h)

| Lot | Système | Règle du cahier | Détail pour J1 | Membres |
|---|---|---|---|---|
| L0 | Corrections de la revue du tour 1 (prérequis) | HA-07, GE-01 | D1 (tirage du quotidien hors priorité stricte, dès maintenant), D2 (pousser la draisine à deux), D3 (jours 11 à 14 garnis), D4 (rattrapage de l'énigme 1), D5 (fenêtre de sept jours pour les envies, envies qui touchent l'autre): voir `gauntlet/revues/tour-01-contenu-coop.md`. L2 prolonge D1 | dev gameplay, game-designer, level-designer |
| L1 | Saisons et météo tirée | TE-02, FE-03, FE-09 | saison calculée (21 jours), `season_is`; météo tirée la veille avec la graine du monde selon la table FE-09, `weatherByDay` devient une liste de jours imposés (jour 16 et jour 23: soleil); radis, laitue et carotte deviennent « printemps et été » (écart, section 8) | dev gameplay, game-designer (données) |
| L2 | Répliques vivantes | HA-03, R2 à R5 | réserves `ambient` par habitant, conditions habituelles (`season_is`, `weather_is`, `weekday_is`, `talked_to`...), tirage « la moins récente » par joueur, gabarits de souvenir à variables `{joueur}`, `{objet}`, `{nombre}`, faits retenus pendant 3 jours (récolté, offert, pêché, bâti, mangé ensemble); mémoire sauvegardée | dev gameplay, game-designer (textes) |
| L3 | Commande générée | EC-05 à EC-07 | la commande 3 est générée au jour 15 à 16 h selon EC-07 parmi les produits déjà obtenus, jamais un produit qui s'achète tel quel (planches de Basile, pain d'Odette); garde-fou de faisabilité: chaque ligne doit pouvoir se faire en 6 jours avec ce que possède le duo (sinon la ligne est remplacée); les commandes 1 et 2 restent écrites | dev gameplay |
| L4 | Petites annonces | EC-10 | tableau des annonces, trois au plus, renouvelées chaque matin, 12 gabarits (section ci-dessous), récompense en sous et en lien | dev gameplay, ux-ui (tableau), game-designer |
| L5 | Carnet de la vallée | CN-01, CN-02, CN-07, SV-08 | onglet « Pages » du carnet, environ 40 pages accessibles en J1 (étapes, recettes, poissons, cueillettes, énigmes, la fête, le point de vue 1, les coins à soi), mention « ensemble » à moins de 15 m, progression envoyée à la plateforme | dev gameplay, ux-ui |
| L6 | Chantier collectif et geste « lever » | MA-08, GE-03 | panneau et caisse sur le quai; même format que les constructions guidées de la démo (`elements`, `inputs`, `seconds`): 12 éléments (4 poteaux, 4 chevrons, 4 pans de toiture), 30 planches et 10 clous, 60 s de travail à un (30 s à deux, `twoPlayersSpeedMultiplier`), puis le geste « lever la marquise » (5 s à deux); le village apporte 15 % des matériaux restants au train du samedi | dev gameplay, artiste 3D |
| L7 | Fête | 6.8 | cadre réutilisable: une journée, un lieu, un décor qui apparaît le matin, des activités facultatives, une musique, des horaires; première fête: les semailles | dev gameplay, artiste 3D, sound-designer |
| L8 | Repousse des arbres | nouveau (écart) | un arbre abattu laisse une souche; jeune arbre au bout de 4 jours, à couper au bout de 8; Basile vend aussi des planches (8 sous, 20 par jour) | dev gameplay |
| L9 | Robot longue vie, premier jet | section 4.4 | les robots jouent jusqu'au jour 23 sur 8 graines et écrivent le journal des répliques, envies, annonces et premières fois | qa-testeur |

**Quêtes nouvelles**

| Id | Type | Titre | Départ | Étapes | Récompense |
|---|---|---|---|---|---|
| `third_order` | principale | La commande du samedi 22 | jour 15, 16 h | déposer la commande 3 (générée) avant le jour 22 à 16 h | paiement, confiance |
| `quay_canopy` | principale | Une marquise pour le quai | jour 15, 16 h | 1. lire le panneau du chantier; 2. apporter les matériaux; 3. bâtir les 12 éléments (60 s de travail à un, 30 s à deux); 4. lever la marquise à deux | drapeau `quay_done` |
| `quay_inauguration` | principale | L'inauguration du quai | `quay_done` (ou le garde-fou du jour 22) | rejoindre la scène du quai le dimanche 23 | page d'histoire, écran de fin |
| `seed_festival` | fête | La fête des semailles | jour 16, 10 h | au choix: lever l'arbre de mai, la bourse aux graines, danser (une activité à deux suffit pour la page « fête vécue ») | page du carnet, plants de fraisier |
| `meet_lucie` | principale | La factrice est de retour | jour 16 | avoir parlé aux cinq habitants de la Halte | Firmin ouvre le tableau des annonces |
| `lucie_camera` | secondaire | L'appareil de Lucie | jour 17 | 1. Lucie montre le vieil appareil; 2. lui apporter 3 pissenlits et un pain (« pour le moral »); 3. une nuit | Lucie prend des photos; la photo du duo à l'inauguration |
| `first_viewpoint` | secondaire | La carte postale du gué | jour 19 | se tenir au point de vue du gué, face au quai, entre 7 h et 19 h | page « point de vue », cadre de la carte postale |
| `basile_saplings` | secondaire | Les jeunes arbres | jour 18 | planter 4 jeunes arbres donnés par Basile à la lisière | Basile vend des planches; page du carnet |
| `jeanne_strawberries` | secondaire | Les fraises de Jeanne | jour 20 | planter 2 fraisiers et les arroser deux jours | Jeanne promet de vous montrer « un oiseau bleu qui pêche » (amorce de J2) |
| `odette_buffet` | secondaire | Le buffet d'Odette | jour 21 | apporter 6 œufs et 2 omelettes pour le buffet de l'inauguration | 60 sous et deux lampions pour la maison; le buffet a vos omelettes |
| `firmin_uniform` | secondaire | L'uniforme d'Émile | jour 21 | trouver la casquette d'Émile dans la remise (près de la draisine) | Firmin la porte à l'inauguration |

**Gabarits d'annonces (12)**: livrer N {légume} à Odette; porter un colis de la halte à Basile; trouver N pissenlits pour la tisane de Firmin; réparer la clôture du jardin d'Odette (planches); pêcher un {poisson} pour le souper de Jeanne; apporter des bûches à Lucie; ranger la caisse de la halte (un geste de 10 s); poser une lettre chez Basile avant midi; porter le journal de la coopérative à Odette; aider Basile à scier (5 planches à l'établi); une soupe chaude pour Firmin; montrer le potager à l'inspecteur (jour 22 seulement). Règle: jamais le même gabarit deux fois en 10 jours (R7), récompense de 40 à 120 sous et lien +50.

**Textes à écrire** (game-designer, environ 450)

| Texte | Nombre |
|---|---|
| Répliques du quotidien: 5 habitants x (8 au premier niveau de lien, 10 de printemps, 6 d'été pour les jours 22 et 23, 3 par temps sur 3 temps) | 5 x 33 = 165 |
| Gabarits de souvenir: 15 par habitant, à variables | 75 |
| Scènes: fête (arbre de mai, bal), arrivée de Lucie, chantier, inauguration, garde-fou | 60 |
| Quêtes: titres, objectifs, réponses des habitants | 60 |
| Annonces: 12 gabarits, demande, remerciement | 36 |
| Lettres: commande 3, invitation à la fête, catalogue, récapitulatif, inauguration, lettre de l'inspecteur | 6 |
| Envies: 10 personnelles (printemps et été, dont 3 qui touchent l'autre joueur: R16), 3 à deux | 13 |
| Pages du carnet (notes) | 40 |

Exemples, dans le ton:

- Odette, un jour de pluie: « Ne vous mouillez pas pour mes radis, va. La pluie fait le travail mieux que vous. »
- Basile, souvenir d'une récolte: « {joueur} m'a montré ses carottes. Belles. Je n'ai rien dit, mais je l'ai pensé. »
- Lucie, à la fête: « Je pédale depuis l'aube pour ne pas rater ça. Vous dansez, ce soir ? Je veux une photo. »
- Firmin, à l'inauguration: « Émile disait qu'un quai sans marquise, c'est un quai qui attend la pluie. Le nôtre n'attend plus rien. »
- Envie à deux: « Lever l'arbre de mai ensemble. »
- Le carnet: « Fête des semailles: vécue ensemble, le 16 du printemps, année 1. »

**Objets nouveaux (environ 25)**: plant de fraisier, fraise, sachet de graines de la bourse (variante d'étiquette), jeune arbre, souche (état), casquette d'Émile, appareil photo de Lucie, carte postale du gué, photo du duo (décoration), lampion (décoration), ruban de l'arbre de mai (décoration), banc du bourg (catalogue, rayon meubles), horloge murale (rayon meubles), étagère haute (rayon meubles), et les produits de la commande générée déjà existants. Chaque objet de rendu a un substitut dans `src/rendu/substituts.ts` (carnet du game designer).

**Modèles 3D nouveaux (10)**: Lucie et son vélo (squelette commun), fraisier en cinq stades, souche et jeune arbre, marquise du quai (fantôme et bâtie), panneau et caisse du chantier, arbre de mai avec rubans, guirlande de lampions, deux étals de fête, casquette d'Émile, appareil photo. Animations: lever à deux (déjà au cahier, GE-03), danser à deux, pédaler (Lucie).

**Sons et musiques**: deux musiques nouvelles (la fête au bourg, l'inauguration), une variation d'été du thème de la Halte (P1); sons: vélo et sonnette de Lucie, arbre de mai qui se dresse, marquise posée, lampions, applaudissements, déclencheur de l'appareil photo, tableau des annonces.

**Critères de réussite de J1** (à rendre testables par qa-testeur)

| # | Critère | Vérification |
|---|---|---|
| J1-01 | Les robots finissent J1 (inauguration du jour 23) sur 8 graines, reprise des sauvegardes comprise, y compris une sauvegarde de fin de démo (jour 15) | robots |
| J1-02 | Deux graines différentes donnent deux suites de météo différentes; les jours 16 et 23 ont du soleil sur toutes les graines | test unitaire |
| J1-03 | La commande 3 respecte EC-07 et chaque ligne est faisable avec ce que possède le duo au jour 15 (1 000 graines) | test unitaire |
| J1-04 | Sur les jours 15 à 23, à raison de deux conversations au plus par joueur, par habitant et par jour, aucun joueur n'entend deux fois la même réplique du quotidien d'un même habitant (robots, 8 graines) | robot longue vie |
| J1-05 | 40 % au moins des conversations du quotidien sont des souvenirs à variables, et chaque variable est remplie (aucun `{` affiché) | robot longue vie |
| J1-06 | Chaque matin des jours 17 à 23, trois annonces au plus, aucun gabarit répété en 10 jours | robot longue vie |
| J1-07 | Chaque journée de J1 a au moins une première fois (R1) | robot longue vie |
| J1-08 | Le carnet compte au moins 30 pages remplissables en J1; la progression envoyée à la plateforme est égale aux pages de la sauvegarde | robots, test unitaire |
| J1-09 | Le geste « lever » ne peut pas échouer; relâcher 30 s puis reprendre ne perd rien (CA-J1-032) | test à deux contextes |
| J1-10 | Les textes nouveaux passent le contrôle d'écriture neutre et typographique (CA-J1-037) | validateur |
| J1-11 | Les budgets de rendu tiennent avec la fête affichée (décor, habitants, lampions) sur la place | G4 |
| J1-12 | Au moins un geste à deux exigé (lever la marquise) et deux proposés (l'arbre de mai, la danse); trois quêtes « apporter » au plus sur onze (R13) | robots, statistiques |
| J1-13 | Séance chez le client: les deux joueurs disent que le bourg « parle de ce qu'on fait » et que la fête est un moment à deux | observation |

**Hors de J1**: métiers et rangs, affichage des liens (le lien est compté dès J1, sans être montré, pour que les répliques par niveau et les étapes de J2 partent du bon point), oiseaux et jumelles, cultures d'été, visiteurs au-delà de l'inspecteur, agrandissement de la maison, nouvelle carte (tout cela en J2; la rue Haute, le cellier et la chambre arrivent dès le tour 10).

## 8. Écarts avec la version 0.1 du cahier des charges

| Sujet | Cahier 0.1 | Ce plan | Raison |
|---|---|---|---|
| Horloge | 0,8 s par minute de jeu dès le jour 1 (TE-01) | 0,7 s dès le jour 1 (D1, tranchée le 2026-11-01), réglage du duo à trois vitesses | le client a trouvé les journées trop courtes; la démo doublée est proche de la vitesse du cahier |
| Heures de l'année 1 | 23,3 h | 20,2 h | printemps plus court; compensé par l'arc A8 (21 h au lieu de 18,1 h) |
| Arrivée aux Vergers | jour 30 (été, duo médian) | jour 43 (début de l'automne) | l'été entier sert à la Halte complète, aux métiers et à la voie; à resimuler: la règle des collections (« chaque entrée des Vergers visible en automne ou en hiver ») reste vraie, mais `collections_v1.py` doit être relancé avec cette arrivée |
| Draisine | étape 2.1: 500 sous de pièces au chapitre 2 | réparée par Basile en semaine 2 (démo) | déjà joué; la voie (étape 2.2) reste au chapitre 2 |
| Carte de la Halte | 120x90 m | 64x48 m jusqu'à J1, la Halte entière en J2 | la démo; la carte complète est un chantier de level-designer pour J2 |
| Potager de départ | 24 cases | 12 | la démo; agrandissement par défrichage en J2 (FE-01) |
| Arbres | ressource renouvelée implicite | 12 arbres sans repousse dans la démo; repousse en J1 | le bois fini bloquait toute commande de planches |
| Radis, laitue, carotte | printemps seulement | printemps et été | les cultures d'été arrivent en J2; le potager ne s'arrête pas au jour 22 |
| Seuil des gros achats | 500 sous | 100 sous dans la démo | à ramener à 500 en J2, quand la bourse grossit |
| Habitants | 10 en version 1, 30 au total | inchangé, mais chaque habitant a une réserve de répliques chiffrée (R3) | anti-répétition |
| Volume d'écriture | 1 500 textes en version 1 | environ 3 600 pour l'année 1, 9 000 pour 100 h | règles R2 à R5 |
| Pages du carnet | 165 en version 1, 485 à 100 h (SV-05) | 165 puis 535 | 80 par épisode et 50 au long cours |
| Fêtes | quatre, identiques chaque année | une activité neuve par fête et par année pendant 4 ans, plus une fête par gare | R9 |
| Collections | 24 oiseaux, 12 poissons, 12 cueillettes en version 1 | inchangé en version 1; 72, 36 et 36 à 100 h | R8, R10 |
| Gestes à deux | porter, lever, pomper, danser et gestes contemplatifs (GE-01 à GE-05) | les mêmes, plus un geste nouveau par arc et un geste exigé par semaine (R15) | la coopération ne doit pas devenir une routine |
| Samedi | train, commande, courrier, visiteurs, chaque semaine pareil | un « fait du samedi » tiré d'une réserve, jamais le même deux samedis de suite (R14) | 53 trains en 100 h |
| Quêtes | formes non réglées | au plus 35 % de quêtes d'apport par arc, cinq formes au moins (R13) | revue du tour 1: 8 quêtes sur 17 sont des apports |
| Long terme | « réparti sur les épisodes » | un arc à part entière (A8) avec l'almanach de l'année 5 | rendre les 21 dernières heures aussi écrites que les autres |

## 9. Décisions pour le client

| # | Décision | Options | Recommandation |
|---|---|---|---|
| D1 | Le rythme de la journée après la démo | garder 0,35 s (journée de 8 min, 750 journées pour 100 h); passer à 0,8 s (journée de 16,6 min); 0,6 s (13,6 min) | **Tranchée par le client le 2026-11-01**: des journées plus longues. La journée double dès le jour 1 (0,7 s, 15,1 min), avec un réglage de rythme (section 2.1) |
| D2 | L'ordre de l'année 1 | Vergers dès l'été (cahier 0.1); tout l'été à la Halte, Vergers à l'automne (ce plan) | ce plan: la Halte entière, les métiers et la voie avant la deuxième gare, pour ne pas ouvrir deux lieux à moitié vides |
| D3 | La maison qui grandit | plan libre dès J2; pièces ajoutées en J2, plan libre en J3 | **Tranchée par le client le 2026-11-01**: oui, la maison s'agrandit. Appliquée selon la recommandation: pièces ajoutées d'abord, bâties à deux avec la charpente de Basile (cellier et chambre dès le tour 10, l'ordre choisi par le duo), plan libre à deux en J3 (section 3.2; `tour-10-conception.md`, section 4) |
| D4 | La partie de la démo continue-t-elle dans J1 ? | oui, la sauvegarde du jour 15 se poursuit; ou nouvelle partie à chaque jalon | oui: rien ne se perd, migration testée (critère J1-01) |
| D5 | Le volume d'écriture | 1 500 textes (cahier 0.1); 9 000 avec les règles anti-répétition | 9 000, écrits par jalon (450 en J1), avec des gabarits de souvenir pour que le monde réagisse; c'est ce qui fait qu'on ne s'ennuie pas à 50 h |
| D6 | Le garde-fou de J1 | inauguration le 23 quoi qu'il arrive (le village finit la marquise); ou inauguration le dimanche qui suit le chantier fini (règle du cahier) | garde-fou pour J1 seulement, pour que chaque jalon finisse sur sa fête; règle du cahier dès J2 |
| D7 | La tendresse entre vos personnages (Q4 du cahier) | complices; tendres en plus; aucun geste | complices et tendres en douceur, comme au cahier; J1 n'a besoin que de la danse au bal |
| D8 | Après le Terminus (A8) | la vallée continue sans fin (HI-04); une fin écrite après 100 h | sans fin, avec un almanach par année pour qu'on puisse y rester; une lettre de fin au jour 372 pour qui veut s'arrêter là |
| D9 | Le rythme des livraisons | un jalon toutes les une à deux semaines (environ 5 h de jeu chacun après J1); ou de gros épisodes plus rares | un jalon court et jouable à chaque fois, comme la démo: vous jouez au rythme où nous produisons |

## 10. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-10-31 | 0.1 | Première rédaction: arcs, règles anti-répétition chiffrées, systèmes manquants, jalons, J1 détaillé, écarts avec le cahier 0.1, simulation `plan_100_heures.py` | game-designer, sur brief du manager (objectif de 100 heures fixé par le client) |
| 2026-11-01 | 0.2 | D1 et D3 tranchées par le client (journée doublée dès le jour 1 avec un réglage; la maison s'agrandit, pièces d'abord); calendrier recompté à 0,7 s (397 journées pour 100 h); section 3.4: les retours de la soirée du 1er novembre dans les 100 heures; quatre habitants de plus au bourg (34 au total); systèmes 19 à 22 | client (soirée de jeu du 2026-11-01), par le manager; game-designer |
