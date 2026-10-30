# La Petite Ligne: démo d'une heure

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne (titre provisoire) |
| Statut | brouillon, à livrer en premier (priorité du client du 2026-10-30) |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |
| Rédaction | game-designer |
| Documents liés | cahier des charges: `docs/jeux/jeu-1/cahier-des-charges.md` (les règles de référence); simulation de la démo: `docs/jeux/jeu-1/simulations/demo_rythme.py` |

## En bref

- **La démo**: la première semaine du jeu complet. Le duo descend du train un samedi à 10 h, répare à deux la maisonnette du garde-barrière, fait pousser son potager, rencontre quatre habitants et remplit la commande de la coopérative jusqu'au train du samedi suivant, à 16 h: c'est le point d'orgue et la fin de la démo.
- **Durée**: huit journées de jeu, 63 minutes réelles en moyenne (60 à 66 pour 8 démos sur 10), grâce à une horloge de démo plus rapide (0,35 s par minute de jeu au lieu de 0,8).
- **Ce qu'elle prouve**: qu'une journée à deux est agréable (chacun son activité, des rendez-vous ensemble), que la commande du samedi donne envie de s'organiser, et que la maison qu'on aménage soi-même fait plaisir.
- **Règles**: celles du cahier des charges, réduites (section 2). Toute valeur propre à la démo est dans la section 5.
- **Priorités**: P0, indispensable pour que la démo se joue d'un bout à l'autre; P1, à ajouter s'il reste du temps, dans l'ordre de la liste.

## 1. Périmètre de la première heure

### 1.1 Les huit journées

Le jour 1 et le jour 8 sont des samedis, jours du train. Chaque journée apporte une nouveauté, pour que l'heure ne s'essouffle pas.

| Jour | Ce qui arrive | Ce que font les deux joueurs | Rendez-vous à deux |
|---|---|---|---|
| 1, samedi (dès 10 h) | création des personnages, le premier train, Firmin et les clés, la maisonnette en ruine, le courrier de la coopérative et la commande au tableau | porter la poutre, poser les planches du toit et de la porte, découvrir la boîte en fer au grenier, rencontrer Odette (le pain est offert, les graines s'achètent à son comptoir) | porter la poutre; première veillée et premier souper (le pain d'Odette) sur les deux paillasses |
| 2, dimanche | premier petit-déjeuner: forme, envie du jour | bêcher, semer, arroser les 12 cases; Odette propose les poules (quête S1), Basile ses planches (S2) | se répartir le potager et le bois |
| 3, lundi | Jeanne arrive, curieuse de la boîte en fer (S4); un mot de Basile | couper un arbre, scier à l'établi, réparer le poulailler; Odette prévient: « Demain il pleut, mon genou me l'a dit. » | |
| 4, mardi | la pluie (on n'arrose pas); les premiers radis; les trois poules arrivent le soir | récolter, vendre à l'épicerie, fabriquer la table et les chaises; Odette demande des radis et des laitues (S3) | premier souper à table |
| 5, mercredi | les premiers œufs, les premières laitues | soins du matin, bois, aménagement; à 19 h, le souper de bienvenue chez Odette | scène à deux chez Odette (S3) |
| 6, jeudi | les premières carottes; rappel de la coopérative: le catalogue ferme vendredi à minuit | choisir ensemble ce qu'on commande au catalogue (accord des deux au-delà de 100 sous), fabriquer le lit double | décider à deux d'un achat |
| 7, vendredi | dernier jour pour le catalogue; Firmin repasse son uniforme et souffle l'indice d'Émile | remplir la caisse, résoudre l'énigme à 17 h (l'ombre de la cloche) | l'énigme, si elle n'est pas encore résolue |
| 8, samedi (jusqu'à 16 h) | 10 h: le train arrive avec les colis du catalogue et le courrier; 16 h: il repart avec la commande | dernières récoltes du matin, compléter la caisse, poser les colis dans la maison | le départ du train sur le quai, récapitulatif, scène finale de Firmin, écran de fin |

### 1.2 Lieux

Une seule zone, le bourg d'Aubrune, compacte (64x48 m) pour que l'horloge rapide ne soit pas mangée par la marche. Coordonnées indicatives en mètres (x vers l'est, y vers le sud), à ajuster par level-designer; les distances, elles, comptent pour le rythme.

| Lieu | Contenu | Place indicative | Distance depuis la maisonnette |
|---|---|---|---|
| La voie et la halte | rails le long du bord nord, la halte, le quai, la caisse de la coopérative, le tableau (commande, catalogue), la cloche, un banc | voie y 0 à 4; halte et quai x 24 à 40, y 2 à 9; banc à 3 m à l'est de la cloche | 20 m (6 s) |
| La maisonnette du garde-barrière | au passage à niveau, à l'ouest; une pièce de 5x4 m et un grenier; potager de 12 cases (4x3) au sud; le poulailler en ruine | x 4 à 12, y 6 à 14; potager x 4 à 8, y 16 à 19; poulailler x 12 à 15, y 16 à 19 | |
| La place du bourg | l'épicerie-pension d'Odette (façade et comptoir sur la place), la maison de Firmin, un puits (remplir l'arrosoir) | place x 26 à 40, y 16 à 28; épicerie x 40 à 48, y 16 à 24; Firmin x 18 à 24, y 10 à 15; puits au centre de la place | 30 m (9 s) |
| La scierie de Basile | façade, l'établi sous un auvent, un tas de bois | x 50 à 60, y 26 à 34 | 45 m (13 s) |
| La lisière du bois de la Côte | 12 arbres à couper (chênes et sapins), quelques pissenlits | x 50 à 64, y 36 à 48 | 50 m (14 s) |
| La rivière Aubrune et son gué | le long du bord sud; décor et ambiance en P0, pêche en P1 | y 40 à 48, gué vers x 30 | 35 m (10 s) |
| La remise de la draisine | fermée à clé; elle ne s'ouvre qu'à la fin, pour annoncer la suite | bout est du quai, x 44 à 50, y 2 à 7 | 40 m |

Intérieur jouable: la seule pièce de la maisonnette (le grenier sert seulement à la scène de la boîte en fer). L'épicerie se joue au comptoir, depuis la place.

### 1.3 Habitants (quatre)

| Habitant | Rôle dans la démo | Où le trouver |
|---|---|---|
| Firmin Lacombe, chef de halte bénévole | l'accueil, le but, la commande, l'indice de l'énigme, la scène finale | le quai de 8 h à 18 h, sa maison ensuite |
| Odette Ferrand, épicière | achète et vend (graines, matelas, pot de fleurs, clous), donne les poules (S1), le souper de bienvenue (S3) | son comptoir de 7 h à 20 h |
| Basile Cornu, menuisier retraité | les planches du toit, l'établi, les plans des meubles (S2) | la scierie de 8 h à 18 h; à la maisonnette le jour 1 |
| Jeanne Ribot, 10 ans, nièce de la factrice | la curiosité, les indices de l'énigme (S4), la bonne humeur | le quai le matin, la rivière l'après-midi, la place le soir |

Lucie, la factrice, est seulement citée par Jeanne; le courrier arrive au tableau de la halte.

### 1.4 Cultures (trois)

Radis, laitue, carotte. Leurs pousses sont accélérées pour la démo (section 5): les radis donnent trois récoltes dans la semaine, les laitues deux, les carottes une.

### 1.5 Aménagement de la maison (douze modèles)

| Objet | Comment on l'obtient | Effet |
|---|---|---|
| Paillasse (deux) | déjà là | Sommeil 50 |
| Lit double | fabriqué à l'établi (16 planches) avec un matelas acheté chez Odette (120 sous, accord des deux) | Sommeil 85 pour les deux: fini, les paillasses qui piquent |
| Table | fabriquée (8 planches) | le souper à table compte comme souper partagé (Cœur +5) |
| Chaise (jusqu'à deux) | fabriquée (4 planches chacune) | confort |
| Coffre | déjà là, réparé au jour 1 | le cellier commun |
| Étagère | fabriquée (6 planches) | décoration, confort |
| Réchaud | déjà là | cuisiner les trois recettes |
| Pot de fleurs | chez Odette (15 sous) | beauté |
| Lampe à pétrole | catalogue (40 sous), arrive au train du jour 8 | lumière chaude, beauté |
| Tapis | catalogue (60 sous), jour 8 | confort |
| Rideaux | catalogue (30 sous), jour 8 | beauté |
| Poste à galène | catalogue (120 sous, accord des deux), jour 8 | il annoncera le temps du lendemain (la suite) |

Les plans des meubles fabriqués viennent de Basile (quête S2). On pose, déplace et tourne les meubles sur la grille de la pièce, à deux en même temps.

### 1.6 Quêtes

**Trame: « Une semaine à la Halte »** (P0)

| # | Étape | Condition | Récompense |
|---|---|---|---|
| T1 | Le premier train | jour 1, scène à deux sur le quai | les clés, le courrier de bienvenue, 200 sous |
| T2 | Un toit sur nos têtes | porter la poutre à deux, construire les 12 éléments fantômes (toit et porte), dormir | la boîte en fer et sa carte d'énigme |
| T3 | Premières pousses | bêcher, semer, arroser, puis une première récolte | la confiance d'Odette (elle achète vos légumes) |
| T4 | Les gens du bourg | avoir parlé à Firmin, Odette, Basile et Jeanne | Firmin: « Vous êtes d'ici, maintenant. » |
| T5 | La commande du samedi | déposer avant samedi 16 h: 12 radis, 3 laitues, 6 œufs, 10 planches | paiement x1,5, +25 % si elle est complète, scène finale |

**Quêtes secondaires**

| # | Quête | Donnée par, quand | Objectif | Récompense | Priorité |
|---|---|---|---|---|---|
| S1 | Les poules de Mme Ferrand | Odette, jour 2 | réparer le poulailler (8 planches, 2 clous) | trois poules (Bichette, Cocotte et la Duchesse), des œufs chaque matin dès le jour 5 | P0 |
| S2 | Les planches de Basile | Basile, jour 2 | couper un arbre, scier 4 planches à son établi | les plans de la table, de la chaise, de l'étagère et du lit double | P0 |
| S3 | Le souper de bienvenue | Odette, jour 4, après les premiers radis | lui apporter 3 radis et 2 laitues avant le jour 5 à 19 h, puis venir à deux | scène à deux, Ventre 100 pour les deux, la recette de la soupe de légumes | P0 |
| S4 | La première énigme d'Émile | la carte de la boîte en fer (jour 1); Jeanne aide dès le jour 3, Firmin donne l'indice le jour 7 | un jour de soleil, entre 17 h et 17 h 30, l'ombre de la cloche touche le banc: bêcher à cet endroit | la clé de la remise et une vieille photo de la halte; à la fin, la remise s'ouvre sur la draisine | P0 |
| S5 | Le pari de Jeanne | Jeanne, jour 3 | pêcher une truite au gué | sa plume de geai (décoration) | P1 |

## 2. Systèmes de la démo

### 2.1 Gardés, et réduits au nécessaire

| Système | Dans la démo | Priorité | Règles de référence du cahier |
|---|---|---|---|
| Deux joueurs, deux écrans, chacun son personnage | création simplifiée: prénom, trois coiffures, quatre couleurs de tenue, le foulard à la couleur du profil Duo; ni traits ni métier | P0 | PE-01 |
| Horloge partagée | 6 h à 24 h, s'arrête quand les deux sont dans un menu ou une scène; minuit ramène à la maison | P0 | TE-01 à TE-08 |
| Petit-déjeuner, veillée, coucher à deux | comme le cahier; la veillée commence dès 19 h quand les deux sont dans la maison | P0 | TE-04, TE-06, TE-07 |
| Besoins et forme | Ventre (souper), Sommeil (lit), Cœur (envie, souper partagé, geste à deux); endurance tirée de la forme; portrait à cinq expressions et une phrase au réveil | P0 | PE-03 à PE-06 |
| Envies du jour | dix envies personnelles et trois à deux | P0 | HA-07 |
| Potager | bêcher, semer, arroser (puits de la place ou tonneau de la maisonnette), récolter; une culture pousse si elle a bu la veille; deux qualités seulement: ordinaire, et belle si arrosée chaque jour de sa pousse | P0 | FE-02 à FE-04, FE-06 simplifié |
| Bois | couper un arbre (hache), scier les rondins en planches à l'établi de Basile | P0 | |
| Poules | trois, une mangeoire à remplir de grain (sac offert), un œuf par poule nourrie et par jour | P0 | FE-07 |
| Construction guidée | éléments fantômes déjà posés (toit, porte, poulailler), à bâtir en maintenant l'action; deux fois plus vite à deux | P0 | MA-03 |
| Aménagement | poser, déplacer, tourner les douze meubles sur la grille de la pièce, à deux en même temps | P0 | MA-02 |
| Fabrication | à l'établi: planches, puis meubles selon les plans de Basile | P0 | |
| Cuisine | au réchaud, pendant la veillée: radis à la croque-au-sel (3 radis), omelette (3 œufs), soupe de légumes (2 carottes, 2 radis, 1 laitue; recette de S3); deux portions par recette | P0 | section 6.6 du cahier |
| Économie | bourse commune; Odette achète à 80 % (300 sous par jour au plus) et vend graines, clous, matelas, pot de fleurs; catalogue d'une page; caisse de la coopérative payée au départ du train | P0 | EC-01 à EC-03, EC-08 |
| Gros achat | accord de l'autre à partir de 100 sous (matelas, poste à galène) | P0 | EC-04 |
| Commande du samedi | fixe, quatre lignes (pas de tirage), affichée dès le jour 1 | P0 | EC-05, EC-08 |
| Geste à deux | porter la poutre (jour 1) | P0 | GE-01, GE-02 |
| Dialogues et scènes à deux | répliques choisies sur chaque écran (HA-08) | P0 | HA-08 |
| Carnet | onglets Quêtes, Courrier, Sac | P0 | |
| Tutoriel doux | astuces contextuelles, une fois chez chaque joueur (section 3.1) | P0 | |
| Fin de la démo | écran de fin, puis la séance inscrite à l'historique si la plateforme est prête | P0 | SV-07 |
| Actions simultanées | premier reçu servi, « Déjà pris par Sacha » | P0 | SI-01, SI-02 |
| Coin à soi | un coin de 2x2 cases de la pièce, désigné par chacun, où seul son propriétaire pose ses objets | P1 | MA-06 |
| Absence | horloge arrêtée après 3 min sans entrée d'un joueur | P1 | PA-04 |
| Sauvegarde | à l'aube et en quittant, un seul emplacement | P1 | SV-03 |
| Repère | épingle à sa couleur, visible chez les deux | P1 | GE-07 |
| Pêche | au gué, trois poissons (goujon, chevesne, truite) | P1 | CN-05 |
| Regard du métier | un seul: les cases qui ont soif, visibles chez celui qui choisit « jardinier » à la création | P1 | ME-04 |

### 2.2 Volontairement absents

- Les saisons (une semaine de printemps), la météo libre et les aléas: le temps de la semaine est écrit à l'avance (soleil, pluie le jour 4, nuages le jour 6).
- Les métiers, l'expérience, les rangs, les spécialités, les traits (le regard du métier seulement en P1).
- La vigueur du sol, les rotations, la qualité « superbe », le défrichage.
- Le plan libre de la maison (murs, pièces reconnues), les chantiers collectifs, le coup de main du village.
- La confiance de la coopérative, les annonces, les visiteurs, les fêtes, le carnet de collections (oiseaux, poissons, cueillettes, pages).
- Les Vergers, la voie, la draisine (seulement montrée à la fin), les chèvres, les ruches, les arbres fruitiers.
- Les liens chiffrés avec les habitants: les habitants réagissent aux quêtes, sans niveaux.
- Les trois emplacements de sauvegarde, les migrations, les épisodes.

## 3. Textes

Règles du cahier (section 6.12): tutoiement de chaque joueur, « vous » quand un habitant parle aux deux, rédaction neutre (aucun accord au genre d'un joueur), pas de tiret cadratin ni demi-cadratin. « Camille » et « Sacha » sont des exemples de prénoms.

### 3.1 Tutoriel doux

Astuces en bas de l'écran, 6 s, une seule à la fois, une fois chez chaque joueur, jamais bloquantes. Les noms de touches s'affichent selon le clavier réel.

| # | Déclencheur | Texte |
|---|---|---|
| A1 | arrivée sur le quai | Z Q S D pour marcher, ou un clic sur le sol. |
| A2 | premier objet à portée | Espace ou un clic pour agir sur ce qui est devant toi. |
| A3 | première fois qu'un outil sert | La molette change d'outil. |
| A4 | la poutre | Une poutre se porte à deux: approchez-vous et maintenez Espace ensemble. |
| A5 | un élément fantôme | Maintiens Espace sur un élément transparent pour le construire. À deux, ça va deux fois plus vite. |
| A6 | herbe du potager, houe en main | Un clic sur l'herbe pour bêcher. |
| A7 | terre bêchée, graines en main | Sème sur la terre bêchée. |
| A8 | après le premier semis | Arrose chaque jour: une culture ne pousse que si elle a bu la veille. |
| A9 | arrosoir vide | Le puits de la place ou le tonneau de la maison remplissent l'arrosoir. |
| A10 | première culture mûre | Elle est prête: un clic pour récolter. |
| A11 | 19 h | Rentrez tous les deux à la maison: la veillée arrête l'horloge. |
| A12 | première veillée | Cuisinez au réchaud, mangez ensemble, puis allez au lit. |
| A13 | l'établi | À l'établi, un rondin donne quatre planches, et un plan devient un meuble. |
| A14 | meuble en main | La molette tourne le meuble, Espace le pose, X le reprend. |
| A15 | la caisse du quai | Dépose ici les produits de la commande. Ils partent samedi à 16 h. |
| A16 | premier achat de 100 sous ou plus | À partir de 100 sous, l'achat attend l'accord de l'autre. |
| A17 | premier courrier | Tab ouvre le carnet: quêtes, courrier, sac. |

### 3.2 Dialogues

**Firmin**

- Arrivée (scène à deux):
  - « Bienvenue à la Halte d'Aubrune ! Vous êtes les premiers voyageurs depuis vingt ans. »
  - « La ligne rouvre. Un train par semaine, le samedi. La coopérative vous confie la maisonnette du garde-barrière, là-bas, au passage à niveau. »
  - « Elle a besoin d'un toit, je ne vous mens pas. Basile vous a laissé des planches. »
  - « Faites revivre la halte, et le train ira plus loin. Samedi prochain, on compte sur vous: la commande est au tableau. »
  - Choix: « On s'y met tout de suite ! » (Firmin: « Voilà qui me plaît. ») ou « Vingt ans, vraiment ? » (Firmin: « Vingt ans. La dernière fois, j'avais encore mes cheveux. »)
- Au quotidien:
  - « Le train ? Samedi, 10 h, pas une minute de retard. Enfin, en principe. »
  - « La caisse de la coopérative ne mord pas. Déposez-y ce que vous voulez envoyer à la ville. »
  - (pluie) « Belle pluie. Vos radis vous remercient, mes genoux un peu moins. »
  - (jour 7) « Demain, c'est le grand jour. J'ai repassé mon uniforme. Deux fois. »
- Indice de l'énigme (jour 7, si elle n'est pas résolue): « Mon oncle Émile aimait les devinettes. Et il ne quittait jamais le quai avant cinq heures du soir. »
- Fin (après le départ du train):
  - commande complète: « Quatre lignes sur quatre ! Je n'ai jamais vu ça. Bon, je n'ai pas vu grand-chose depuis vingt ans. »
  - commande partielle: « La coopérative est contente, et moi aussi. La semaine prochaine, on fera encore mieux. »
  - puis: « La coopérative écrit que si la voie des Vergers est dégagée, le train montera jusque là-haut. La draisine dort dans la remise. Il faudra des bras. Quatre, par exemple. »
  - si la clé de la remise a été trouvée: « Vous avez la clé de la remise ? Alors c'est vous qu'Émile attendait. » (la remise s'ouvre sur la draisine)

**Odette**

- Rencontre: « Ah, les nouveaux ! Ici, on vend de tout et on sait tout. Surtout on sait tout. »
- Graines (jour 1): « Pour commencer: radis, laitues, carottes. Les radis sont pressés, les carottes prennent leur temps. Comme les gens. »
- Le pain: « Et prenez ce pain pour ce soir. Personne ne dort le ventre vide dans ma rue. »
- Au quotidien:
  - « Je vous achète vos légumes, mais à mon prix. La coopérative paie mieux, le samedi. »
  - « Petite mine, ce matin. Un vrai lit, ça change une vie. J'ai des matelas. »
  - « Jeanne est encore passée me poser cent questions. Cent une, en fait. »
  - (jour 3) « Demain il pleut, mon genou me l'a dit. »
- S1, la demande: « Mes trois poules s'ennuient dans ma cour. Réparez le vieux poulailler du garde-barrière, et elles sont à vous. Huit planches, deux clous et un peu d'huile de coude. »
- S1, la fin: « Les voilà: Bichette, Cocotte et la Duchesse. La Duchesse pond quand elle veut, ne le prenez pas pour vous. »
- S3, la demande: « Vos premiers radis ! Apportez-m'en trois, et deux laitues, et je vous fais à souper demain soir. Chez moi, à sept heures. »
- S3, la scène à deux: « Vous deux, vous avez remis de la vie dans ma rue. Tenez, ma recette de soupe. Ne la donnez à personne. » Choix: « Promis. » (Odette: « Je savais que je pouvais compter sur vous. ») ou « Même pas à Firmin ? » (Odette: « Surtout pas à Firmin. Il la salerait trop. »)
- Jour 8: « Le train ! Allez, allez, je garde la boutique. »

**Basile**

- Jour 1, à la maisonnette: « Basile. Menuisier. Enfin, je l'étais. Votre poutre est là. Elle se porte à deux, comme les soucis. »
- Après le toit: « Pas mal, pour des débutants. Le toit tiendra. La porte grince, mais une porte qui grince, c'est une porte qui parle. »
- S2, la demande: « Du bois, il y en a plein la lisière. Coupez un arbre, sciez quatre planches à mon établi, et je vous montre comment on fait une table. »
- S2, la fin: « Voilà. Une table, une chaise, une étagère, et le lit, si vous avez du courage. Tout est dans ce carnet. Le lit, c'est du travail. Mais vous dormirez mieux. »
- Au quotidien:
  - « Le chêne, c'est solide. Le sapin, c'est rapide. Comme les gens, dirait Odette. »
  - « Mon établi est à vous. Ma scie à moi, vous n'y touchez pas. »
  - (jour 8) « J'ai vu ce train partir il y a vingt ans. Le voir revenir, ça fait quelque chose. »

**Jeanne**

- Rencontre (jour 3): « C'est vous, les nouveaux ? Moi, c'est Jeanne. Dix ans et demi. Vous avez trouvé un trésor dans la maisonnette ? Tout le monde dit qu'il y en a un. »
- Devant la carte: « Une devinette ! Je peux aider ? Je suis très forte en devinettes. Presque. »
- Indices: « La cloche, c'est celle du quai. Le banc est juste à côté. Mais une ombre, ça bouge tout le temps... » et (pluie) « Pas d'ombre quand il pleut. Ça, je le sais. »
- Au quotidien:
  - « Tu savais que les poules descendent des dinosaures ? Ça explique la Duchesse. »
  - « Ma tante Lucie dit que le train va changer la vallée. Moi, je veux juste monter dedans. »
  - (jour 8) « Il arrive ! Il arrive ! Vous croyez qu'il y a des gens dedans ? »
- S4, la fin: « Une clé ! C'est celle de la remise, j'en suis sûre. Qu'est-ce qu'il y a dans la remise ? Dites-moi ! »
- S5 (P1): « Je parie que vous n'attrapez pas une truite avant samedi. Si vous y arrivez, je vous donne ma plume de geai. La plus belle du monde. »

**La carte d'énigme**: « Quand l'ombre de la cloche touche le banc, ce que je cherchais dort à ses pieds. É. L. »

### 3.3 Quêtes (titre et objectif au carnet)

| # | Titre | Objectif affiché | À la fin |
|---|---|---|---|
| T1 | Le premier train | Parler à Firmin sur le quai. | Les clés de la maisonnette sont à vous. |
| T2 | Un toit sur nos têtes | Porter la poutre à deux, puis construire le toit et la porte. | Un toit ! Et quelque chose brille au grenier. |
| T3 | Premières pousses | Bêcher, semer, arroser, puis récolter. | Les premiers radis d'Aubrune depuis vingt ans. |
| T4 | Les gens du bourg | Faire connaissance avec Firmin, Odette, Basile et Jeanne. | Vous êtes d'ici, maintenant. |
| T5 | La commande du samedi | Déposer dans la caisse du quai avant samedi 16 h: 12 radis, 3 laitues, 6 œufs, 10 planches. | (récapitulatif de la coopérative) |
| S1 | Les poules de Mme Ferrand | Réparer le poulailler: 8 planches, 2 clous. | Trois poules, et des œufs chaque matin. |
| S2 | Les planches de Basile | Couper un arbre, scier 4 planches à l'établi. | Les plans des meubles sont dans ton carnet. |
| S3 | Le souper de bienvenue | Apporter 3 radis et 2 laitues à Odette, puis venir à deux mercredi à 19 h. | La recette de la soupe de légumes. |
| S4 | La première énigme d'Émile | Quand l'ombre de la cloche touche le banc... | La clé de la remise. |
| S5 | Le pari de Jeanne (P1) | Pêcher une truite au gué. | La plume de geai de Jeanne. |

### 3.4 Courrier

| Jour | De | Texte |
|---|---|---|
| 1 | la coopérative | « Chers nouveaux gardiens de la Halte d'Aubrune, la coopérative de la ligne vous souhaite la bienvenue. Voici 200 sous pour vos premiers pas, et notre première commande, à déposer dans la caisse du quai avant le départ du train, samedi prochain à 16 h: 12 radis, 3 laitues, 6 œufs, 10 planches. Ce que vous commandez au catalogue avant vendredi minuit arrive par le train. Bonne semaine ! » |
| 3 | Basile | « L'établi de la scierie est ouvert. La hache est accrochée à côté. B. » |
| 6 | la coopérative | « Rappel: le catalogue ferme vendredi à minuit. Les rideaux font fureur à la ville, paraît-il. » |
| 8 | la coopérative, au départ du train | « La coopérative a reçu 4 lignes sur 4: 540 sous. Merci ! Les radis d'Aubrune ont fait sensation à la ville. » (variante: « N lignes sur 4: X sous. Merci, et à samedi prochain ! ») |
| 8 | la coopérative | « Si la voie des Vergers est dégagée, le train montera jusque là-haut. Il paraît que les cerisiers attendent quelqu'un. » |

### 3.5 Envies, forme, messages

- **Envies personnelles** (une par matin chez chacun, jamais la même deux fois): « Croquer des radis tout frais. », « Dormir dans un vrai lit. », « Faire la connaissance de Jeanne. », « Rendre la maison un peu plus jolie. », « Fendre du bois. », « Récolter quelque chose de beau. », « Cuisiner une soupe. », « Rendre service à Mme Ferrand. », « Regarder passer la rivière. », « Voir arriver le train. » (jour 8 seulement).
- **Envies à deux** (jours 2, 5 et 7): « Souper à la même table. », « Regarder la rivière ensemble. », « Ranger la maison à deux. »
- **Forme au réveil**: Petite forme: « La nuit a été courte et le ventre crie. Un bon souper, ce soir ? »; Ça va: « Ça va. La paillasse pique un peu. »; En forme: « Bien dormi, bien mangé: en forme. »; Pleine forme: « Pleine forme ! Le lit neuf y est pour beaucoup. »; Forme rayonnante: « Tout sourit ce matin: forme rayonnante. »
- **Messages**: « Déjà pris par Sacha. »; « Il manque 40 sous. »; « Sacha propose d'acheter un matelas pour 120 sous. D'accord ? »; « Le train de samedi est en gare ! »; « Le train part dans une heure. »; « Il se fait tard, tu rentres par le sentier. »; « Plus d'énergie: tout prend deux fois plus de temps. Un en-cas ? »; « L'horloge attend Camille. » (P1).
- **Écran de fin**: « Fin de la démo. Une semaine à la Halte d'Aubrune. La suite de la ligne arrive bientôt. » Trois chiffres: journées vécues (8), lignes de la commande remplies (sur 4), meubles posés.

## 4. Assets de la démo

Les budgets du cahier s'appliquent (PC de référence). Un seul squelette pour tous les personnages.

### 4.1 Modèles et animations 3D

| Priorité | Élément | Détail |
|---|---|---|
| P0 | Squelette humain commun | adulte; Jeanne à l'échelle 0,75 |
| P0 | Les deux joueurs | trois coiffures, quatre couleurs de tenue, le foulard à la couleur du profil Duo |
| P0 | Quatre habitants | Firmin (casquette et veste de cheminot), Odette (tablier, chignon), Basile (tablier de cuir, barbe), Jeanne (salopette, tresses) |
| P0 | Animations | attendre, marcher, porter à deux, bêcher, semer, arroser, récolter, couper à la hache, scier, marteler, parler, s'asseoir, manger, dormir |
| P0 | La voie et la halte | rails et traverses en module, la halte, le quai, la caisse, le tableau, la cloche sur son poteau, le banc |
| P0 | Le train | locomotive, une voiture, un fourgon; entrée et départ en glissement |
| P0 | La maisonnette | deux états (en ruine, réparée), intérieur d'une pièce aux murs coupables, grenier, porte, tonneau d'eau |
| P0 | Le potager | case d'herbe, case bêchée, case bêchée et arrosée |
| P0 | Trois cultures | radis, laitue, carotte, chacune en quatre stades (semis, pousse, adulte, mûre), et l'objet récolté |
| P0 | Le bourg | façade et comptoir de l'épicerie, maison de Firmin, puits, scierie et son établi, remise de la draisine (fermée, puis ouverte sur la draisine), chemins, herbe, barrières, quelques massifs |
| P0 | Le bois | chêne et sapin, souche, rondin |
| P0 | Le poulailler et les poules | poulailler (ruine, réparé), une poule en trois couleurs, mangeoire |
| P0 | Objets tenus et récoltés | houe, arrosoir, hache, sachet de graines, planche, rondin, poutre, clou, œuf, pain, bol de soupe, assiette, colis du catalogue, boîte en fer, clé, carte |
| P0 | Les douze meubles | paillasse, lit double, table, chaise, coffre, étagère, réchaud, pot de fleurs, lampe à pétrole, tapis, rideaux, poste à galène |
| P0 | Ombre de la cloche | la lumière directionnelle suit l'heure; repère discret au sol quand l'ombre touche le banc (17 h à 17 h 30, par soleil) |
| P1 | La rivière et le gué jouables | berges, eau animée, canne, bouchon, trois poissons |
| P1 | Effets | fumée de la locomotive, poussière de construction, gouttes de pluie, éclats de bois |
| P1 | Animations en plus | pêcher, caresser une poule, s'asseoir sur le banc, se taper dans la main |
| P1 | La draisine détaillée | balancier animé (préfigure le chapitre 2) |

### 4.2 Sons et musiques

| Priorité | Élément | Détail |
|---|---|---|
| P0 | Train | sifflet, roulement et freinage, cloche du quai |
| P0 | Pas | herbe, terre, bois du quai et du plancher |
| P0 | Potager | bêcher, semer, arroser, eau du puits, récolte (« pop »), tintement de la qualité « belle » |
| P0 | Bois et construction | coup de hache, chute d'arbre, scie, marteau, élément terminé, meuble posé |
| P0 | Geste à deux | « hop » et souffle de l'effort |
| P0 | Vie de la maison | porte qui grince, réchaud, manger, se coucher |
| P0 | Poules | gloussements |
| P0 | Interface | clic, page du carnet, notification douce, tampon de la caisse, monnaie, proposition d'achat |
| P0 | Musiques | thème du bourg le jour (boucle de 2 à 3 min), veillée (boucle de 2 min), courte fanfare d'arrivée du train, air de la commande réussie et de la fin (30 à 60 s) |
| P0 | Ambiances | oiseaux du matin, rivière, vent léger, grillons du soir |
| P1 | Pluie | sur le toit et dehors |
| P1 | Pêche | lancer, « plouf », « ploc » |
| P1 | Motifs des habitants | quatre petits motifs instrumentaux à l'ouverture d'une conversation |
| P1 | Nuit | berceuse courte |
| P1 | Repère | carillon |

## 5. Valeurs de réglage de la démo

Valeurs propres à la démo, dans le même fichier de configuration typé que le jeu (un profil « démo »). Ce qui n'est pas listé reprend le cahier.

| Paramètre | Démo | Jeu complet | Raison |
|---|---|---|---|
| Durée d'une minute de jeu | 0,35 s | 0,8 s | la semaine en 63 min (60 à 66); dehors de 6 h à 19 h 30 en 4,7 min |
| Journée | 6 h à 24 h, veillée dès 19 h | idem | |
| Premier jour | commence à 10 h, au train | idem | |
| Dernier jour | finit au départ du train, 16 h | sans fin | point d'orgue |
| Météo | écrite: soleil, pluie le jour 4, nuages le jour 6 | tirée chaque jour | la pluie montre qu'on n'arrose pas; le soleil des jours 5 à 7 permet l'énigme |
| Potager | 12 cases, déjà en herbe, sans défrichage | 24 cases et plus | assez pour la commande et la cuisine |
| Radis | 2 jours, 3 par case, graine 6, prix 7 | 4 jours | trois récoltes (jours 4, 6, 8) |
| Laitue | 3 jours, 1 par case, graine 8, prix 32 | 6 jours | deux récoltes (jours 5, 8) |
| Carotte | 4 jours, 3 par case, graine 12, prix 16 | 8 jours | une récolte (jour 6), pour la soupe |
| Qualité | « belle » (prix x1,5) si arrosée chaque jour de sa pousse | score de soin | une seule règle à comprendre |
| Arbre | 3 coups de hache, 2 rondins; un rondin donne 4 planches à l'établi | | 56 planches dans la semaine: 14 rondins, 7 des 12 arbres de la lisière |
| Planches nécessaires | toit 12 (offertes), poulailler 8, table 8, chaises 8, étagère 6, lit double 16, commande 10 | | |
| Poules | 3, un œuf par jour si la mangeoire est remplie (sac de grain offert) | grain payant | |
| Endurance | 80 + 0,4 x forme; coûts du cahier divisés par 2 | coûts du cahier | une journée courte ne doit pas buter sur la fatigue |
| Ventre | pain 50, plat simple 60, soupe 80, deux plats dont la soupe 100, souper d'Odette 100 | | |
| Sommeil | paillasse 50, lit double 85 | | le lit change la forme dès le lendemain |
| Cœur | 40, envie +15, envie à deux +25, souper partagé +5, geste à deux +10 | idem | |
| Bourse de départ | 200 sous | | |
| Odette achète | 80 %, 300 sous par jour au plus | idem | |
| Odette vend | graines (prix ci-dessus), clou 2, matelas 120, pot de fleurs 15 | | |
| Catalogue (arrive le jour 8) | lampe 40, tapis 60, rideaux 30, poste à galène 120 | | les colis du train au point d'orgue |
| Gros achat | 100 sous | 500 sous | le matelas et le poste à galène se décident à deux |
| Commande | 12 radis, 3 laitues, 6 œufs, 10 planches; x1,5, +25 % si complète | tirée chaque semaine | 288 sous de valeur de base, 540 sous payés si elle est complète |

Simulation (`python3 docs/jeux/jeu-1/simulations/demo_rythme.py`):

| Minute de jeu | Durée de la démo (moyenne; 8 sur 10 entre) |
|---|---|
| 0,30 s | 58 min (55 à 61) |
| **0,35 s (retenu)** | **63 min (60 à 66)** |
| 0,40 s | 68 min (65 à 71) |
| 0,80 s (jeu complet) | 109 min (105 à 112) |

Hypothèses: création 3 min, scène d'arrivée 2 min, fin 3 min; retour à la maison entre 18 h 30 et 21 h (vers 19 h 30 le plus souvent); veillée de 1,5 min (2 min le jour 1); dialogues et scènes 0,6 min par jour (1,2 le jour 1).

Budget d'un duo médian qui suit le plan conseillé par Odette (4 cases de chaque culture): 36 radis, 8 laitues, 12 carottes et 12 œufs dans la semaine; 184 sous de graines; 341 sous de ventes chez Odette; environ 357 sous en bourse avant le train sans aucun achat. Le duo peut donc s'offrir le matelas et une ou deux choses au catalogue, pas tout: il faut choisir ensemble. La commande complète rapporte 540 sous au départ du train, pour la semaine suivante.

## 6. Contrôles de la démo

Ceux du cahier (section 5), réduits: Z Q S D ou clic au sol pour marcher; Espace ou clic gauche pour agir; maintenir pour porter et construire; X ou clic droit pour examiner et reprendre un meuble; molette pour changer d'outil ou tourner un meuble (1 à 6 en raccourci facultatif); A et E pour tourner la caméra; R et F pour le zoom; Tab pour le carnet; Échap pour la pause de la plateforme. La rangée des chiffres n'est jamais obligatoire.

## 7. Critères de réussite de la démo

| # | Critère | Vérification |
|---|---|---|
| D-01 | La démo se joue d'un bout à l'autre à deux, du train du jour 1 au train du jour 8, sans blocage | partie complète à deux contextes, puis chez le client |
| D-02 | Elle dure de 50 à 75 minutes | chronométrée chez le client |
| D-03 | Un duo qui découvre le jeu remplit au moins 3 des 4 lignes de la commande | observation chez le client |
| D-04 | Chaque jour, chaque joueur a quelque chose à faire et au moins un rendez-vous à deux a lieu | observation, et ce que disent les joueurs |
| D-05 | Chaque action P0 a son retour visuel et sonore (tableau 5.2 du cahier) | test, puis à l'écoute |
| D-06 | Aucune action ne demande la rangée des chiffres; tout se fait aussi à la souris seule | test |
| D-07 | Tous les textes respectent le tutoiement, la rédaction neutre et l'interdiction des tirets longs | contrôle automatique et relecture |
| D-08 | La quête S4 ne bloque jamais la fin: sans la clé, la scène finale a lieu quand même, avec l'autre réplique | test |

## 8. Écarts assumés avec le cahier

- L'horloge de démo est 2,3 fois plus rapide que celle du jeu (0,35 s contre 0,8 s), et les cultures poussent deux fois plus vite: c'est une semaine resserrée, pas le rythme cible. Le rythme d'une vraie journée (16,6 min) se mesurera au prototype.
- La commande est fixe et le temps est écrit: l'heure doit se dérouler pareil pour tous.
- La qualité, la cuisine et l'économie sont simplifiées; leurs règles complètes restent celles du cahier.
- Tout ce que la démo construit (personnages, bourg, maisonnette, potager, poules, meubles, quatre habitants, commande, veillée) sert tel quel au prototype et à la version 1.
