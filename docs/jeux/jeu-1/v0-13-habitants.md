# La Petite Ligne 0.13: les habitants (conception)

| Champ | Valeur |
|---|---|
| Jeu | `jeu-1`, La Petite Ligne |
| Version visée | 0.13.0 (après la 0.12), puis 0.13.1 pour les étapes d'amitié avancées |
| Statut | proposition à valider par le client (deux questions, section 11) |
| Version du document | 1 |
| Date | 2026-11-03 |
| Rédaction | game-designer, sur brief du manager (demande du client: une vingtaine d'habitants avec leur histoire, des suites de quêtes qui se croisent, des plannings découverts dans le carnet; ajout du client: la vie du village) |
| Carte | `v0-13-carte.md` (level designer, en parallèle): ses identifiants de lieux sont la référence (sections 7.3 et 8); ce document y range les habitants et demande quelques points de plus (section 1.3) |
| Règles reprises | cahier des charges HA-01 à HA-08 (liens, niveaux, souvenirs, rattrapage, pas de romance avec les joueurs, choix à deux); plan des 100 heures R2 à R4 (répliques), R11, R13 |
| Données | `games/la-petite-ligne/donnees/habitants.json` (format `schedule[]`, première entrée vraie), `quetes.json` |
| Simulation | `docs/jeux/jeu-1/simulations/v0_13_habitants.py` (bibliothèque standard): source unique des plannings de la section 3, contrôles (couverture de chaque minute, points connus, typographie), découverte des habitudes (section 4.11), rythme de l'amitié et des quêtes (section 5.7). `--tableaux` réimprime les tableaux, `--json` les écrit au format de `habitants.json`, `--croise` relit ce document et échoue en cas d'écart |

## En bref

**Pitch.** Vingt et un voisins qui vivent leur vie, chacun à son heure: on les apprend en les regardant faire et en les écoutant, leur semaine s'écrit dans le carnet commun, et leurs histoires se nouent les unes aux autres jusqu'à ce que le bourg devienne une famille.

**Fantasme.** « Mercredi, 19 h 55. Je te dis: Firmin va au café pour la manille, je l'ai lu dans le carnet. Toi, tu files au cimetière: Marthe sonne l'angélus à 19 h, puis elle rentre, c'est le moment de lui parler de la robe de noces. Demain, c'est l'anniversaire d'Honorine, elle reçoit à sa fenêtre à 14 h, et on sait qu'elle adore le chocolat chaud. »

| # | Ce qui arrive | Section |
|---|---|---|
| 1 | 21 habitants: les 6 de la démo, Lucie qui revient, 14 nouveaux, tous logés dans les 13 logis neufs et les maisons existantes | 1, 2 |
| 2 | Un planning par habitant: semaine type, variantes de pluie, de saison, jours particuliers (messe, marché, manille, chorale, quilles, lessive, moisson, Dimanche des lumignons, anniversaires): 255 habitudes | 3 |
| 3 | La page « Voisins » du carnet: chaque habitude se révèle quand l'un des deux la voit, l'entend en dialogue ou la lit sur un écriteau; une habitude inconnue montre son créneau en pointillé; le carnet dit « où est-il sans doute maintenant » | 4 |
| 4 | Une suite de 3 ou 4 quêtes par habitant (78 quêtes), 10 croisements, 4 décisions à deux qui changent les plannings de deux habitants | 5 |
| 5 | L'amitié visible: cinq lanternes, des gains pour parler, offrir, aider, fêter; jamais de perte | 6 |
| 6 | La vie du village: 30 gestes avec le décor, 20 scènes entre habitants, des habitants qui réagissent à la météo, aux tenues, aux prises de pêche, et qui saluent par le prénom; un chat | 7 |

Chiffres clés (simulation, graine fixe): un duo qui joue normalement connaît la moitié des habitudes en deux semaines de jeu, plus de huit sur dix en six semaines et toutes avant la fin de la deuxième année; sans les dialogues et les écriteaux, il n'en connaîtrait que deux sur trois au bout d'un an (les répliques font le travail, pas la chance). Avec au plus deux histoires en cours et une étape neuve par jour, un duo médian fait environ une étape d'habitant tous les deux jours pendant les dix-huit premières semaines de jeu, puis le rythme ralentit à mesure que les liens doivent mûrir; il finit les suites de la 0.13 vers le jour 115, en un an et quart de jeu (environ 30 heures).

## 0. Principes

| Principe | Règle | Pourquoi |
|---|---|---|
| Le bourg vit sans vous | Chaque habitant suit son planning, qu'un joueur le regarde ou non; il marche d'un lieu à l'autre par des trajets réels | on ne « fait pas apparaître » les gens: on les croise |
| Apprendre, c'est jouer | Le planning ne s'affiche jamais d'un coup: il s'écrit dans le carnet à mesure qu'on observe et qu'on écoute | la curiosité devient une activité, et l'un peut guider l'autre (« lis-moi le carnet ») |
| Deux joueurs, un carnet | Tout ce que l'un découvre s'écrit dans le carnet commun, avec le prénom de qui l'a vu | aucun ne prend de retard sur l'autre; le plus attentif fait gagner le duo |
| Les histoires se touchent | Une quête sur sept demande un autre habitant; quatre décisions à deux changent la suite et le planning de deux habitants | le bourg est un réseau, pas vingt et un fils parallèles |
| Jamais de punition | Aucune amitié ne baisse, aucun rendez-vous manqué ne coûte, aucune décision n'est mauvaise | des séances calmes, des niveaux de jeu différents dans le couple |
| Original | Aucun nom, personnage, histoire, lieu ou combinaison de règles repris d'un jeu existant du genre « vie de village »: les métiers, les liens et les intrigues sont propres à la vallée de l'Aubrune (une ligne de train qui rouvre, une halte, une meunière, une sonneuse, un horloger de la compagnie) | règle « Création originale » de `CLAUDE.md` |

**Amendement proposé au cahier (HA-08 bis).** HA-08 dit qu'un choix de dialogue ne change jamais l'issue d'une étape. Le client demande des quêtes « dont l'issue change la suite d'un autre ». Proposition: les choix de dialogue restent sans effet (HA-08); s'y ajoutent quatre **décisions à deux** (section 5.2), où les deux joueurs doivent se mettre d'accord; chaque option réussit toujours, et seule la variante de la suite et des plannings change. À inscrire dans l'historique du cahier (question 1).

**Partie en cours.** Le client joue une partie entamée. À la première aube jouée avec la 0.13: chaque habitant de la démo reçoit un lien de départ (60 par quête finie avec lui, au plus 250: Firmin, Odette, Basile et Jeanne sont à Voisinage, Achille et Solange à Connaissance); les habitudes de ces six habitants que le duo a forcément vues souvent sont déjà au carnet (« à la cloche du quai de 8 h à 18 h », « au comptoir de 7 h à 20 h », « à l'établi », « le banc du quai le matin », « le guichet du fournil », « le salon »), les autres restent à découvrir; la limite actuelle de la partie (jour 64, premier jour de l'hiver) rend injouables les anniversaires d'hiver (cinq) et les habitudes d'hiver: elles sont écrites et attendent que la limite bouge (question au manager, pas au client).

## 1. Lieux

### 1.1 Les lieux et leurs habitants

Identifiants de `v0-13-carte.md` (sections 4, 7 et 8) quand ils existent; sinon, proposés ici (1.3). Rôle, et qui y vit ou y travaille.

| Lieu (`id`) | Rôle | Y vit | Y travaille, y passe | Heures publiques |
|---|---|---|---|---|
| `halte` (quai, cloche, banc, arrêt du train) | la gare et son quai | | Firmin (8 h à 18 h), Lucie (tri du courrier 7 h, banc 17 h), Ambroise (8 h, journal 18 h), le samedi presque tout le bourg | train le samedi 10 h à 16 h |
| `firmin_house` | maison de Firmin, derrière la voie | Firmin | | |
| `grocery` (épicerie-pension) | épicerie, pension, terrasse sous tonnelle | Odette | Nour y déjeune en pension, Honorine y fait ses courses le jeudi, Solange y fait la mise en plis d'Odette le dimanche, Honorine et Odette y tricotent le dimanche | 7 h à 20 h; le dimanche 7 h à 13 h |
| `village_square` (place, puits, marelle, tilleul) | la place du bourg et son marché du dimanche | | Jeanne et Léon après l'école, Basile sous le tilleul le dimanche, l'étal (0.12) | |
| `sawmill` (scierie) | la scierie et l'établi de Basile | Basile | | 8 h à 18 h, sauf dimanche |
| `riverbank`, gué, ponton | la promenade de l'Aubrune | | Jeanne l'après-midi, Achille (pêche), Nour (promenade 17 h), Solange et Jeanne le dimanche, Lucie (photos) | |
| `bakery` (fournil, rue Haute) | le pain | Achille | Berthe y monte la farine le vendredi (après sa quête) | 6 h à 12 h, sauf lundi |
| `salon` (mercerie, coiffure, confection) | coupes, tissus, vêtements | Solange | | mardi à samedi 9 h à 12 h et 14 h à 18 h |
| `lucie_house` | maison de Lucie, jardinet | Lucie, Jeanne | | |
| `school` (école-mairie, cour, logement du maître) | la classe, la mairie, les archives | Armand | Jeanne et Léon (jours de classe) | classe lundi, mardi, jeudi, vendredi 8 h 30 à 16 h 30 (hors été); mairie mardi et vendredi 17 h à 19 h, samedi 9 h à 12 h |
| `church` (Saint-Aubin, nef, parvis) | la messe, la chorale, les cloches | | Martial (messe), Marthe (angélus, entretien), Armand (harmonium, chorale), les paroissiens | ouverte 7 h à 19 h; messe le dimanche 10 h 30; chorale le vendredi 20 h |
| `presbytery` (presbytère, jardin du curé, vigne) | la maison du curé, son conservatoire de graines | Martial | | |
| `cemetery` | le cimetière derrière le chevet | | Marthe (matin et soir), Basile (jeudi à l'aube), Honorine (vendredi 9 h), Odette (lundi 14 h), Firmin (premier dimanche de la saison) | |
| `sexton_house` (maison 1) | maison du sacristain | Marthe | | |
| `cafe` (café de la Côte, terrasse, allée de quilles) | le café, la manille du mercredi, les quilles du dimanche | Colette (à l'étage) | Berthe (déjeuner), Firmin, Basile, Martial (manille), les joueurs de quilles | 7 h à 12 h et 16 h à 23 h; dimanche dès 11 h 30; fermé le mardi |
| `forge` (cour, atelier, logis sous le toit) | ferrures, outils, roues | Mado, Barnabé | Barnabé y livre le charbon | 7 h à 12 h et 13 h 30 à 18 h; le lundi matin à la ferme |
| `joinery` (menuiserie) | l'ancien atelier de Basile, fermé (il le rouvre à l'étape 5 de son histoire) | personne (logis attenant vide) | | |
| `hamlet_house_a` (maison 2) | cabinet vétérinaire, enclos de soins | Nour | | consultations 14 h à 17 h, jeudi et samedi matin |
| `hamlet_house_b` (maison 3) | maison aux volets clos | personne à ce tour (la famille Roux, partie à la ville, revient avec un arc suivant) | | |
| `hamlet_house_c` (maison 5) | la dernière maison, sa glycine, sa chaise sur la route | Honorine | | |
| `farm` (logis, étable, cour, courtil, pâture) | la ferme | Paulin, Margot, Léon | Mado le lundi matin, Nour le mardi matin | |
| `field_high_01`, `field_high_02` | champs du Haut | | Paulin (champ 1); le champ 2 se loue au duo (quête de Paulin) | |
| `shared_gardens`, `washhouse` | jardins de la Rive, lavoir | | Colette (son carré le mardi), Margot et Colette (lessive le lundi 9 h) | |
| `mill` (moulin de la Vanne, bief, salle des meules) | le moulin, arrêté jusqu'à la première quête de Berthe | Berthe | Paulin et Margot (après « La part du meunier ») | ensache 6 h 30 à 12 h une fois remis en marche |
| `rail_cottage_west` (maison 6) | maison de cheminots, atelier d'horlogerie à la fenêtre | Ambroise | | mardi à samedi 8 h 15 à 12 h et 14 h à 18 h |
| `rail_cottage_east` (maison 7) | maison de cheminots vide (le poseur est parti à la retraite; elle attend le cantonnier d'un arc suivant) | personne | | |
| `forest` (bois de la Côte: coupe, clairière, mare, source, belvédère) | la forêt explorable | | Inès (tournées), Barnabé (coupe, meule), Basile (le dimanche), Jeanne et Léon (mercredi), Lucie et Armand (belvédère) | |
| `forester_house` | maison forestière | Inès | Nour (thé du dimanche) | |

### 1.2 Pourquoi chacun habite là

| Habitant | Logis | Pourquoi là |
|---|---|---|
| Martial | presbytère | le curé vit à côté de son église, porte sur le parvis |
| Marthe | maison du sacristain | la sonneuse doit être au pied du clocher trois fois par jour |
| Colette | café, à l'étage | la cafetière ferme à 23 h: elle vit au-dessus |
| Mado et Barnabé | logis sous le toit de la forge | la forge de son père; Barnabé descend du bois chaque soir par la route |
| Nour | maison A du hameau | sur la route de l'est, d'où partent ses tournées; une cour pour l'enclos de soins; l'ancienne maison du notaire (sa plaque est restée) |
| Honorine | maison C du hameau | la maison de son mari Octave, tournée vers la route: elle voit passer tout le monde, d'où ce qu'elle sait |
| Paulin, Margot, Léon | logis de la ferme | la ferme de la famille Delmas depuis quatre générations |
| Berthe | moulin, à l'étage | le moulin de son père |
| Ambroise | maison de cheminots ouest | ancien régleur des horloges de la compagnie du chemin de fer: la compagnie lui a laissé sa maison; à deux pas de la halte, d'où sa querelle avec la pendule de Firmin |
| Inès | maison forestière | le logement de fonction du garde |
| Armand | logement du maître, à l'école-mairie | le logement de fonction de l'instituteur |
| Lucie et Jeanne | maison de Lucie | existant (tour 10) |

Logis vides, avec leur raison: la menuiserie (l'atelier que Basile a fermé à la mort d'Hortense), la maison B du hameau (les Roux), la maison de cheminots est (le poste de poseur est vacant). Ils gardent la place des habitants des arcs suivants sans laisser de maison sans histoire.

### 1.3 Points demandés en plus de la carte

Points cités par les plannings qui ne sont ni dans `halte.json` ni dans `v0-13-carte.md` (8.1). Emplacements proposés; le level designer tranche.

| Point | Ce que c'est | Emplacement proposé | Pourquoi |
|---|---|---|---|
| `church_nave` | le milieu de la nef | allée centrale, x 95, y -11 | là où se tient le curé à la messe et où l'on chante |
| `church_bell_rope` | la corde des cloches | au fond de la nef, au pied du clocher-porche (x 90, y -12), côté intérieur | la sonneuse sonne depuis la nef: on la voit en entrant; la porte ouest du clocher reste fermée |
| `cemetery_tap` | fontaine et arrosoirs | contre le mur sud, à 2 m à l'est de la grille | on prend l'eau en entrant |
| `cemetery_bench` | banc | contre le mur sud, au soleil, tourné vers la croix | le banc de Marthe et de Martial |
| `grave_cornu`, `grave_valade`, `grave_ferrand`, `grave_merigot`, `grave_lacombe` | cinq tombes nommées | dans les rangs de 48 tombes, à au moins 3 m l'une de l'autre, `grave_lacombe` près de la croix | des visites qui reviennent chaque semaine (plannings); la tombe des Lacombe porte les parents de Firmin et une place vide sur la plaque: le sort d'Émile reste le mystère de l'arc A7 (ne pas y poser d'Émile Lacombe, contrairement à la proposition de la carte) |
| `sexton_garden` | jardin de dahlias | au sud de la maison du sacristain (x 87 à 92, y 9 à 10), muret bas | entre la maison et la voie, plein sud |
| `honorine_doorstep`, `honorine_window` | sa chaise sous la glycine, sa fenêtre | à droite de la porte de la maison C, côté route (130,5 ; 24,5); fenêtre du même mur | elle regarde la route, d'où elle voit passer tout le monde |
| `cafe_counter` | comptoir du café | contre le mur nord de la salle (déjà prévu au 7.2) | |
| `skittles_alley` | allée de quilles | placette du carrefour, devant la terrasse (x 85 à 92, y 22 et 23), le long de la route sans la barrer | les quilles se jouent devant le café, où l'on boit en regardant |
| `forge_inside`, `forge_door` | foyer et soufflet; grande porte (logis au-dessus) | atelier (7.2 de la carte); `forge_door` devant la grande porte | |
| `vet_yard` | enclos de soins | à l'est de la maison A (x 124 à 126, y 15 à 19), barrière basse | une cour où l'on voit les bêtes soignées |
| `rail_cottage_west_window` | l'établi d'Ambroise derrière sa fenêtre | fenêtre sud de la maison de cheminots ouest, visible du chemin des Cheminots | une vitrine improvisée: on le voit travailler en passant |
| `lucie_garden` | jardinet de Lucie | à l'est de sa maison (tour 10) | |
| `school_yard`, `school_lodging_door`, `mairie_desk` | cour vue du portail; porte du logement; bureau de la mairie | cour derrière le portail (77, 18); porte du logement au pignon est; bureau dans le bâtiment (intérieur plus tard) | |
| `forest_edge_path` | départ du sentier de la Côte | (40,5 ; 9,5), à la lisière | le lieu des mercredis d'oiseaux et des cueillettes d'Ambroise |
| `forester_bench` | banc devant la maison forestière | à droite de la porte (-5,5 ; -18,5) | |
| `charcoal_kiln` | la meule active de Barnabé | bord sud de la coupe (-8,5 ; -4,5), à plus de 6 m de tout arbre | une meule fume trois jours: loin des arbres; distincte de la charbonnière oubliée (secret de la carte), qui est celle de son grand-père |
| `bird_hide` | cabane des oiseaux (bâtie par la quête de Jeanne) | rive ouest de la mare, ouverture vers l'eau (40,5 ; -19,5) | on guette les oiseaux d'eau; elle n'existe qu'après la quête |
| `farm_garden` | courtil | entre la route et le logis (x 114 à 122, y 23 à 26, déjà prévu au 4.3) | |
| `threshing_floor` | aire de battage | ouest de la cour, devant la grange (x 112 à 115, y 33 à 35) | le blé passe du champ à la grange par la cour |
| `pasture_bank` | berge au bout de la pâture | (133,5 ; 37,5) | le coin de pêche de Léon, chez lui |
| `mill_yard`, `mill_race_bank`, `mill_inside` | cour du moulin; rive du bief; salle des meules | cour à l'est de la porte; rive nord du bief (x -16 à -12, y 34); intérieur (7.2 de la carte) | |

Écriteaux à poser (ils révèlent des habitudes quand on les lit, section 4.4): `grocery_sign` (porte de l'épicerie), `bakery_sign` (guichet), `salon_sign` (porte de la mercerie), `school_sign` et `mairie_sign` (portail de l'école), `church_sign` (portail de l'église), `church_sign_bells` (pied du clocher, dans la nef), `cafe_sign` (porte du café), `forge_sign` (grande porte), `vet_sign` (porte de la maison A), `clockmaker_sign` (fenêtre d'Ambroise), plus `mairie_poster` (le panneau d'affichage de la mairie, section 7.1).

Trajets à tracer (comme `trajets` de `halte.json`), pour chaque passage d'un planning à un autre lieu. Les plus empruntés: maison A du hameau vers la route des hameaux (Nour et Lucie à 8 h), maison du sacristain vers la nef (Marthe trois fois par jour), ferme vers l'école par la route (Léon, 7 h 40), forge vers la coupe par la voie et le chemin forestier (Barnabé), moulin vers le café (Berthe à midi), maison de cheminots ouest vers la halte (Ambroise à 8 h), et tous les foyers vers la nef le dimanche à 10 h 15. Règle: au plus 6 habitants changent de lieu dans la même minute de jeu; les autres partent jusqu'à 5 minutes plus tôt (étalement des calculs de chemin sur le PC de référence, question technique pour l'architecte).

## 2. Les habitants

### 2.1 Comment ils arrivent dans la partie

Les quatorze nouveaux vivent là depuis toujours: la carte s'agrandit, on découvre des gens qui étaient là. Pour qu'un nouveau joueur ne reçoive pas quatorze quêtes d'un coup:

| Règle | Valeur |
|---|---|
| Première aube jouée en 0.13 | Lucie revient par le train (quête « Le retour de Lucie », section 5): si l'aube est un samedi, au train de 10 h; sinon, à vélo par la route des hameaux à 9 h, la sacoche pleine |
| La tournée des présentations | À la fin du retour de Lucie, son carnet de tournée (objet de quête) liste les quatorze habitants; chaque jour, Lucie « présente » deux habitants de plus: ils sont signalés au carnet (« Lucie t'a parlé de Mado, la forgeronne ») avec leur logis connu. Rencontrer un habitant (première conversation) n'attend pas la présentation: on peut parler à tout le monde dès le premier jour |
| Première quête d'un habitant | Elle part à la première conversation, mais au plus une quête d'histoire neuve par jour (règle 5.1) |

### 2.2 Récapitulatif

| Habitant (`id`) | Âge | Métier | Logis | Anniversaire | En trois mots |
|---|---|---|---|---|---|
| Firmin Lacombe (`firmin`) | 64 ans | chef de halte bénévole, ancien cheminot | maison de Firmin | 6 de l'automne (jeudi) | bourru, ponctuel, tendre |
| Odette Ferrand (`odette`) | 61 ans | épicière et logeuse | épicerie-pension | 5 de l'été (mercredi) | gourmande, bavarde, rieuse |
| Basile Cornu (`basile`) | 72 ans | menuisier retraité, scierie | scierie | 4 du printemps (mardi) | taiseux, patient, veuf |
| Jeanne Ribot (`jeanne`) | 10 ans et demi | nièce de Lucie, en séjour pour l'année | maison de Lucie | 12 du printemps (mercredi) | intrépide, curieuse, têtue |
| Achille Pradel (`achille`) | 38 ans | boulanger | fournil | 13 de l'été (jeudi) | lent, ensommeillé, poète de la pâte |
| Solange Mérigot (`solange`) | 52 ans | coiffeuse, mercière, confection | mercerie | 10 de l'automne (lundi) | vive, observatrice, mélancolique |
| Lucie Arnaud (`lucie`) | 41 ans | factrice à vélo | maison de Lucie | 18 du printemps (mardi) | curieuse, pressée, rêve de photographie |
| Armand Castagné (`armand`) | 34 ans | instituteur et secrétaire de mairie | logement du maître | 4 de l'automne (mardi) | timide, méthodique, musicien |
| Berthe Lavergne (`berthe`) | 58 ans | meunière du moulin de la Vanne | moulin | 7 de l'hiver (vendredi) | franche, têtue, généreuse |
| Martial Roques (`martial`) | 63 ans | curé de la Halte et de quatre hameaux | presbytère | 4 de l'hiver (mardi) | jovial, sportif, entêté |
| Marthe Bousquet (`marthe`) | 76 ans | sacristine, sonneuse, gardienne du cimetière | maison du sacristain | 19 de l'hiver (mercredi) | sèche, exacte, drôle sans le vouloir |
| Honorine Valade (`honorine`) | 89 ans | la doyenne | maison C du hameau | 12 de l'hiver (mercredi) | malicieuse, mémoire d'éléphant |
| Inès Garrigue (`ines`) | 36 ans | garde forestière de la Côte | maison forestière | 12 de l'été (mercredi) | calme, précise, pince-sans-rire |
| Barnabé Tixier (`barnabe`) | 54 ans | bûcheron et charbonnier | forge (logis) | 13 de l'automne (jeudi) | colosse doux, chanteur |
| Madeleine « Mado » Cazals (`mado`) | 50 ans | forgeronne et maréchale | forge (logis) | 17 de l'hiver (lundi) | forte, rieuse, impatiente |
| Paulin Delmas (`paulin`) | 47 ans | cultivateur | ferme | 20 du printemps (jeudi) | têtu, travailleur, fier |
| Margot Delmas (`margot`) | 45 ans | cultivatrice | ferme | 19 de l'automne (mercredi) | gaie, organisée, diplomate |
| Léon Delmas (`leon`) | 11 ans | écolier | ferme | 3 de l'été (lundi) | fanfaron au grand cœur |
| Ambroise Pélissier (`ambroise`) | 74 ans | ancien régleur des horloges de la compagnie, horloger et cordonnier | maison de cheminots ouest | 11 de l'été (mardi) | pointilleux, ronchon, sentimental en secret |
| Nour Belkacem (`nour`) | 31 ans | vétérinaire de campagne | maison A du hameau | 7 du printemps (vendredi) | énergique, pressée, rieuse |
| Colette Lafon (`colette`) | 44 ans | cafetière du café de la Côte | café | 14 du printemps (vendredi) | chaleureuse, franche, sait garder un secret |

Anniversaires: cinq par saison (six au printemps), jamais un samedi de train, jamais un jour de fête ou de moisson, jamais deux le même jour. Jeanne aura 11 ans à l'année 2, Léon 12 (règle du plan: les enfants grandissent).

Note de cohérence: une vingtaine était demandée; le café de la Côte posé par la carte demandait sa cafetière, d'où vingt et un. Si le client préfère vingt, Colette se retire sans rien casser (seule la manille déménage chez Odette, comme dans la démo).

### 2.3 Fiches

Chaque fiche: caractère, histoire en cinq étapes (HA-02, étapes 3 et 5 en scènes à deux), liens, goûts (identifiants de `objets.json`, ou de la 0.12 quand l'objet y naît), apparence pour l'artiste 3D (squelette commun, hauteur 1,74 m à l'échelle 1,0, têtes au sixième; aucun habitant ne porte de couleur vive au cou, règle de la bible). Les goûts « adore » donnent +60, « aime » +30, « n'aime pas » 0 (l'objet est rendu, section 6).

#### Firmin Lacombe

| | |
|---|---|
| Caractère | Bourru, ponctuel jusqu'à la manie, tendre en dessous. Parle en horaires. Ne dit jamais qu'il est content: il le montre en repassant son uniforme |
| Histoire | 1. L'arrivée du duo et la commande (faite, démo). 2. **La montre arrêtée**: la montre d'Émile, arrêtée à 5 h 12, qu'il refuse de porter à l'horloger. 3. **La pendule de la halte** (scène à deux): la réconciliation avec Ambroise, la pendule raccrochée avant le train. 4. **L'uniforme d'Émile**: Solange le retouche, Ambroise fournit les boutons de laiton. 5. **La lettre d'Émile** (scène à deux): une lettre trouvée aux archives par Armand, adressée « au prochain garde-barrière » |
| Liens | neveu d'Émile (sort inconnu, fil rouge); ses parents au cimetière; tendresse pour Lucie (les jonquilles, le banc de 17 h); amis: Basile, l'abbé (manille); brouillé avec Ambroise depuis trente ans pour « la minute » de la pendule |
| Adore | truite (`trout`), écharpe de laine (`wool_scarf`), pain (`bread`) |
| Aime | chevesne (`chub`), pot de fleurs (`flower_pot`), planche (`plank`), noisettes grillées (0.12) |
| N'aime pas | pissenlit (« Ça, c'est pour les lapins. »), ail des ours (« Je dois parler aux voyageurs. ») |
| Apparence | inchangée (bible): veste de cheminot, casquette à bandeau rouge, moustache grise. À l'étape 4, l'uniforme d'Émile: même coupe, galons de laiton neufs |

#### Odette Ferrand

| | |
|---|---|
| Caractère | Gourmande, bavarde, rieuse; sait tout sur tout le monde et le dit (c'est la meilleure source de rumeurs sur les habitudes des autres) |
| Histoire | 1. Le souper de bienvenue (fait). 2. **La tarte de Mme Ferrand mère**: la recette perdue, dont Honorine et Marthe ont chacune une moitié. 3. **Le moule de ma mère**: le moule de fer-blanc retrouvé à la forge, rétamé à deux. 4. **La salle à manger de la pension** (scène à deux): on retire les draps, premier souper du dimanche avec quatre habitants. 5. **La lettre de Gustave**: son frère perdu de vue écrit, par la tournée de Lucie; les retrouvailles viendront avec un train (arc suivant) |
| Liens | sœur de Gustave (au loin); ses parents au cimetière (le lundi); Honorine était l'amie de sa mère; amie de Solange (mise en plis du dimanche) et d'Achille (la panière); rivalité amicale avec Colette (laquelle fait la meilleure soupe) |
| Adore | moulin à café (`coffee_mill`), gelée de sureau (`elder_jelly`), confiture de mûres (0.12) |
| Aime | pot de fleurs, œuf (`egg`), fromage frais (0.12), girolle (`chanterelle`) |
| N'aime pas | goujon (`gudgeon`: « Ça sent la vase. »), rondin (`log`: « Je ne fais pas de feu dans ma boutique. ») |
| Apparence | inchangée (bible) |

#### Basile Cornu

| | |
|---|---|
| Caractère | Taiseux, patient, des mains qui parlent pour lui; une tendresse bourrue pour les enfants |
| Histoire | 1. Le toit, les planches, la draisine (faits). 2. **La lame de la scie**: la grande lame à remettre en dents à la forge, portée à deux. 3. **L'apprentissage**: il apprend au duo un assemblage (recette de meuble neuve). 4. **Le banc d'Hortense** (scène à deux): le banc qu'il avait fait pour sa femme, réparé et posé sous le tilleul; le jeudi suivant, il parle d'elle. 5. **La menuiserie rouverte**: il choisit un chêne avec Inès et rouvre l'atelier fermé depuis la mort d'Hortense |
| Liens | veuf d'Hortense (jeudi à l'aube au cimetière); parrain de cœur de Mado (son père Joseph était son meilleur ami); manille avec Firmin et l'abbé; le dimanche au bois avec Inès |
| Adore | tablier de cuir (`leather_apron`), soupe de légumes (`vegetable_soup`) |
| Aime | noisette (`hazelnut`), planche, omelette (`omelette`), pain |
| N'aime pas | confiture de mûres (« Trop sucré pour mes dents. »), pot de fleurs (« Elle mourrait chez moi, je n'ai pas la main. ») |
| Apparence | inchangée (bible) |

#### Jeanne Ribot

| | |
|---|---|
| Caractère | Intrépide, pose mille questions, parie sur tout; collectionne galets et plumes |
| Histoire | 1. Le carnet de galets, le pari, le héron (faits). 2. **Les jumelles de grand-père**: Lucie les rapporte; Jeanne les prête le mercredi (premier pas vers le carnet d'oiseaux). 3. **Le martin-pêcheur**: le voir avec elle à l'aube. 4. **La cabane des oiseaux** (scène à deux, décision C5): Inès autorise, Basile aide, Léon veut sa part. 5. Elle décide de rester dans la vallée (arc suivant) |
| Liens | nièce de Lucie; gardée par Solange (tresses, retour du soir); copine et rivale de Léon; élève d'Armand; Inès lui apprend les oiseaux; veut devenir apprentie d'Achille |
| Adore | boîte de craies (`chalk_box`), mûre (`blackberry`), plume de geai (`jay_feather`), galet troué (`holed_pebble`, nouveau, 7.1) |
| Aime | plume de poule (0.12), brioche (`brioche`), chocolat chaud (`hot_chocolate`), confiture de mûres |
| N'aime pas | ail des ours (« Ça pique le nez ! »), cèpe (`cep`: « Il a une tête de crapaud. ») |
| Apparence | inchangée (bible) |

#### Achille Pradel

| | |
|---|---|
| Caractère | Lent, ensommeillé, poète de la pâte; dit des choses justes à moitié endormi |
| Histoire | 1. La panière (faite). 2. La voûte du fournil (0.12). 3. **La fournée de la moisson** (scène à deux): le soir du 18 de l'été, pétrir à deux vingt miches pour le repas de moisson. 4. **La farine de la vallée**: la première farine du moulin de Berthe, montée au fournil par la charrette. 5. **L'apprentie** (scène à deux): il confie le levain à Jeanne |
| Liens | petit-fils du boulanger qui a bâti le four; ami d'Odette (panière) et de Lucie (déjeuner sur le banc); pêche le lundi au ponton; attend la farine de Berthe |
| Adore | truite, sablier (`hourglass`) |
| Aime | noisette, œuf, chevesne, perche (0.12) |
| N'aime pas | pain (« Du pain ? À moi ? »), brioche (« J'en rêve la nuit, je n'en veux pas le jour. ») |
| Apparence | inchangée (tour 10) |

#### Solange Mérigot

| | |
|---|---|
| Caractère | Vive, observatrice, mots d'esprit, une pointe de mélancolie du théâtre |
| Histoire | 1. La première coupe (faite). 2. **Le fauteuil qui penche**: Basile et le duo le remettent d'aplomb; elle raconte le théâtre. 3. **La malle du théâtre** (scène à deux): les perruques; chaque joueur en choisit une pour l'autre. 4. **La blouse de la rentrée**: pour la première rentrée de Jeanne à l'école de la Halte (1er de l'automne). 5. Le rideau de scène de la Veillée des contes (hiver, arc suivant) |
| Liens | amie d'enfance de Lucie; garde Jeanne; coiffe Odette le dimanche; sa mère Eugénie au cimetière; chante l'alto à la chorale; aide Marthe à reprendre la robe de noces (C4) |
| Adore | peigne de corne (`horn_comb`), pot de fleurs |
| Aime | plume de geai, pissenlit (`dandelion`), gelée de sureau, rideaux (`curtains`) |
| N'aime pas | chevesne (« Les arêtes, très peu pour moi. »), rondin |
| Apparence | inchangée (tour 10) |

#### Lucie Arnaud

| | |
|---|---|
| Caractère | Curieuse, toujours pressée, rêve de photographie; rit fort et pédale vite |
| Histoire | 1. **Le retour de Lucie**: elle rentre de la longue tournée et ramène les jumelles de Jeanne. 2. **Le vieil appareil**: l'obturateur bloqué, réparé par Ambroise. 3. **La chambre noire** (scène à deux): un jour de pluie, développer les photos (l'un agite le bain, l'autre compte). 4. **L'exposition de la halte**: quatre photos des points de vue accrochées dans la salle d'attente, avec l'accord de Firmin. 5. Une photo du duo sur le quai (arc suivant) |
| Liens | tante de Jeanne; amie d'enfance de Solange; tendresse partagée avec Firmin (le banc de 17 h); déjeune avec Achille; part à 8 h avec Nour |
| Adore | mûre, confiture de mûres (0.12) |
| Aime | pain, pot de fleurs, pain chaud (`warm_bread`), noisettes grillées (0.12) |
| N'aime pas | œuf (« Des œufs dans une sacoche, plus jamais. »), rondin |
| Apparence | modèle existant (hors démo): veste de la poste #4E6F8F à galon #E0C25A, képi #3D5874, sacoche #8C5A35; vélo de factrice noir à porte-bagages (accessoire nouveau, à pousser à la main dans le bourg) |

#### Armand Castagné

| | |
|---|---|
| Caractère | Timide en face, sûr de lui au pupitre; méthodique; rêve d'écrire la chronique de la vallée; dirige la chorale et tient l'harmonium |
| Histoire | 1. **Les registres mouillés**: un mercredi de soleil, sortir à deux les registres humides de la mairie et les faire sécher dans la cour. 2. **La chronique d'Honorine**: trois dimanches à écouter Honorine; chaque joueur choisit une question dans la liste d'Armand. 3. **La chorale du vendredi** (scène à deux): le duo chante un soir (rythme à Espace, comme le volant de Jeanne). 4. **Le plan de la ligne**: aux archives, le plan de la voie d'Émile et une lettre « au prochain garde-barrière » (lance l'étape 5 de Firmin). 5. La Veillée des contes (hiver, arc suivant) |
| Liens | maître de Jeanne et de Léon; écrit la mémoire d'Honorine; harmonium de l'abbé; Solange corrige sa mesure; recrute Barnabé pour la basse |
| Adore | herbier encadré (`pressed_flowers`), chocolat chaud |
| Aime | brioche, gelée de sureau, plume de geai, radis à la croque-au-sel (`crunchy_radishes`) |
| N'aime pas | chevesne (« Je ne sais jamais par quel bout le prendre. »), clou (`nail`) |
| Apparence | grand et mince (échelle 1,0, jambes longues: gabarit 1,80 m); veste de velours côtelé noisette #7A5A3F, chemise blanche, nœud papillon bleu nuit #2E3A5C, pantalon gris; cheveux bruns raides à la raie; lunettes rondes cerclées de métal; accessoire: cartable de cuir, une craie à la main en classe |

#### Berthe Lavergne

| | |
|---|---|
| Caractère | Franche, têtue, cœur d'or; rit fort, parle à sa meule; ne supporte pas qu'on moule ailleurs ce qui pousse ici |
| Histoire | 1. **La vanne coincée**: lever la vanne du bief à deux (le geste prévu par la carte); la roue tourne, le moulin rouvre. 2. **La meule à rhabiller**: Mado forge le marteau, le duo pique la meule (rythme à deux). 3. **La part du meunier** (scène à deux, décision C2): la vieille querelle avec Paulin, qui fait moudre son blé à la ville. 4. **Les sacs du hameau**: le premier blé des Delmas moulu ici; Achille en fait le premier pain de la vallée. 5. La fête du moulin (arc suivant) |
| Liens | brouillée avec Paulin depuis onze ans (la « part du meunier »); amie de Margot (qui lui achète sa farine en cachette); déjeune au café; Mado lui forge ses outils |
| Adore | noisettes grillées (0.12), omelette |
| Aime | œuf, truite, noisette, fromage frais (0.12) |
| N'aime pas | laitue (`lettuce`: « De l'herbe pour les lapins. »), plume de geai |
| Apparence | robuste, épaules larges, bras farinés; blouse de toile écrue #E7D8B6 poudrée de farine, gilet sans manches vert bouteille #3F5A45, jupe brune, sabots; cheveux gris courts; accessoire: marteau à rhabiller, sac de farine sur l'épaule dans les trajets vers le fournil |

#### Martial Roques

| | |
|---|---|
| Caractère | Jovial, sportif (trois « Tours des vallées » à vélo dans sa jeunesse), têtu; garde dans les tiroirs de la sacristie et au jardin un conservatoire de graines que plus personne ne sème |
| Histoire | 1. **Les graines de la sacristie**: il confie au duo des graines anciennes à essayer au potager. 2. **La chaîne du vélo**: la chaîne cassée avant la tournée, refaite par Mado. 3. **Le blé rouge** (scène à deux): une bande de vieux blé semée au champ de Paulin, moissonnée à la main. 4. **La petite cloche**: la cloche fêlée du clocher, que Marthe veut refondre. 5. Les Rogations à l'oratoire de la source (arc suivant) |
| Liens | manille avec Firmin et Basile; harmonium d'Armand; se chamaille avec Marthe; le blé de Paulin; la vigne du presbytère |
| Adore | brioche, omelette |
| Aime | radis (`radish`), œuf, noisettes grillées (0.12), carotte (`carrot`) |
| N'aime pas | ail des ours (« Je parle de près à mes paroissiens. »), pissenlit |
| Apparence | sec et nerveux, mollets de cycliste; soutane noire #35373C retroussée par des pinces à vélo de laiton #C8A150, col blanc, chapeau rond à larges bords; cheveux gris en brosse; accessoire: vélo de course vert loco #3F6453 (poussé à la main dans le bourg), pompe à vélo |

#### Marthe Bousquet

| | |
|---|---|
| Caractère | Petite, sèche, droite comme un piquet; exacte (elle et Firmin se disputent la ponctualité); drôle sans le vouloir; parle aux morts comme à des voisins, sans tristesse |
| Histoire | 1. **L'angélus à deux**: elle apprend au duo à sonner (l'un tire la corde, l'autre compte les coups: trois fois trois, puis la volée). 2. **Les dahlias**: planter des dahlias sur quatre tombes, dont celle d'Hortense (le jeudi de Basile). 3. **La robe de noces** (scène à deux, décision C4): la brouille avec sa sœur. 4. **Le Dimanche des lumignons**: allumer avec le bourg les lumignons du cimetière (16 de l'automne). 5. La petite cloche refondue (avec l'abbé, arc suivant) |
| Liens | sœur cadette d'Honorine, brouillée depuis quarante ans (la robe de noces de leur mère, qu'Honorine a portée et déchirée le jour de son mariage, et qui devait revenir à Marthe); se chamaille avec l'abbé; veille sur les tombes de tout le bourg |
| Adore | pot de fleurs, gelée de sureau |
| Aime | carotte, laitue, radis, œuf |
| N'aime pas | plume de geai (« Les geais me volent mes graines. »), chocolat chaud |
| Apparence | petite (échelle 0,92), maigre, très droite; robe gris perle #B9B4AC, tablier bleu ardoise à poches #4A5A6A, chapeau de paille noir à ruban; gants de jardin; accessoire: trousseau de grosses clés à la ceinture, arrosoir de zinc |

#### Honorine Valade

| | |
|---|---|
| Caractère | Malicieuse, mémoire d'éléphant, voit tout depuis sa chaise; tricote pour tout le bourg; invente un peu, et le dit |
| Histoire | 1. **Le fil qui manque**: une laine de la couleur exacte d'un ancien gilet, à trouver chez Solange. 2. **La photo des deux sœurs**: Lucie, appareil réparé, rephotographie une vieille photo de famille. 3. **Côte à côte** (scène à deux): après la décision de « La robe de noces », la chorale où les deux sœurs chantent ensemble. 4. **La draisine d'Honorine**: elle veut revoir la voie des Vergers une fois, poussée à deux sur la draisine. 5. Le premier train raconté à la Veillée (arc suivant) |
| Liens | sœur aînée de Marthe (brouille); veuve d'Octave, ancien poseur de la voie (vendredi au cimetière); amie de la mère d'Odette (la tarte); Armand écrit sa chronique; tricote les moufles de Jeanne et de Léon; a connu Émile jeune |
| Adore | chocolat chaud, pain chaud |
| Aime | œuf, brioche, pot de fleurs, gelée de sureau |
| N'aime pas | goujon et chevesne (« À mon âge, les arêtes, c'est un risque. ») |
| Apparence | toute petite (échelle 0,86), voûtée; pèlerine tricotée crème #F1E5C9 sur une robe à petites fleurs bleu passé #7191D9 (désaturé), chignon blanc minuscule, lunettes rondes; accessoire: canne de buis, tricot et aiguilles |

#### Inès Garrigue

| | |
|---|---|
| Caractère | Calme, précise, peu bavarde, humour pince-sans-rire; venue d'une vallée plus haute il y a trois ans; dessine des cartes et compte les oiseaux |
| Histoire | 1. **Le sentier balisé**: peindre les marques du sentier à deux (l'un tient le pochoir, l'autre peint): le bois devient lisible. 2. **Les arbres à garder**: choisir avec Barnabé les arbres de la coupe (et le chêne de Basile). 3. **La nuit des chouettes** (scène à deux): un soir à 22 h, écouter les chouettes au Vieux Chêne sans bouger. 4. **Les points d'interrogation**: les trois « ? » de sa carte à explorer à deux. 5. Le belvédère réparé (arc suivant) |
| Liens | amie de Nour (thé du dimanche); apprend les oiseaux à Jeanne et Léon; travaille avec Barnabé; respecte Basile |
| Adore | noisettes grillées (0.12), cèpe |
| Aime | plume de geai, noisette, girolle, truite |
| N'aime pas | pot de fleurs (« Je préfère les fleurs où elles poussent. »), radis à la croque-au-sel |
| Apparence | grande et mince; veste de toile vert sapin #3F5A45 à écusson, pantalon de velours brun, guêtres de cuir, chapeau de garde à bord rabattu; peau mate #B9825C, natte noire courte; accessoire: carnet à croquis, marteau forestier à la ceinture |

#### Barnabé Tixier

| | |
|---|---|
| Caractère | Colosse doux, chante juste d'une voix de basse en travaillant (on l'entend avant de le voir), timide hors du bois |
| Histoire | 1. **La première meule**: monter une meule de charbon avec lui (porter les bûches à deux). 2. **La veille de la cuite**: un soir de cuite, veiller la meule: un seul des deux voit la couleur de la fumée et dit à l'autre où boucher l'évent (information propre, R16). 3. **La charbonnière oubliée** (scène à deux): la plate-forme cachée de la carte était celle de son grand-père; on y retrouve sa gourde. 4. **La basse de la chorale**: Armand le convainc, le duo l'accompagne au premier vendredi (il rejoint la chorale: planning changé). 5. La fête des charbonniers (arc suivant) |
| Liens | mari de Mado; travaille avec Inès; quilles du dimanche avec Paulin; Armand veut sa voix |
| Adore | soupe de légumes, omelette |
| Aime | pain, cèpe, œuf, noisette |
| N'aime pas | laitue (« Ça ne tient pas au corps. »), pissenlit |
| Apparence | très grand et large (échelle 1,10); barbe noire fournie piquée de gris; chemise à carreaux rouge-brun #A4463B sous un gilet de cuir; bonnet de laine brun; joues grises de charbon; accessoire: hache sur l'épaule |

#### Madeleine « Mado » Cazals

| | |
|---|---|
| Caractère | Forte, rieuse (son rire couvre l'enclume), franche, impatiente, généreuse; a repris la forge de son père Joseph |
| Histoire | 1. **Le soufflet percé**: rapiécer le soufflet; à deux, l'un souffle, l'autre tient la barre au feu. 2. **La hache de la forge**: elle forge l'outil amélioré qu'on n'achetait qu'au catalogue. 3. **La roue de la ferme** (scène à deux): cercler une roue de charrette chez Paulin (le cercle chaud posé, puis noyé). 4. **La grille du père Joseph**: finir la grille du cimetière que son père a laissée inachevée (avec Marthe). 5. Le concours des forgerons de la vallée (arc suivant) |
| Liens | femme de Barnabé; filleule de cœur de Basile; cliente: Paulin (roues, faux); forge pour Berthe, l'abbé, Odette; gagne aux quilles |
| Adore | brioche, noisettes grillées (0.12) |
| Aime | omelette, œuf, clou (« Tu sais parler à une forgeronne. »), truite |
| N'aime pas | gelée de sureau (« Ça colle aux doigts. »), herbier encadré |
| Apparence | carrure large, bras nus musclés; chemise écrue aux manches roulées, tablier de cuir noirci #4A3A30 (plus sombre et plus court que celui de Basile), pantalon de toile; cheveux châtain-roux courts et frisés; lunettes de forge relevées sur le front; accessoire: marteau et pince |

#### Paulin Delmas

| | |
|---|---|
| Caractère | Têtu, travailleur, peu de mots mais justes, fier de sa terre; perd aux quilles en silence |
| Histoire | 1. **Les sacs du samedi**: charger à deux ses sacs au train. 2. **Le champ du Haut**: il loue au duo le champ 2 (zone de culture nouvelle). 3. **La pesée** ou **La mouture à façon** (selon la décision C2 de Berthe): le blé des Delmas revient au moulin. 4. **La moisson** (17 au 19 de l'été): moissonner, battre, puis le repas. 5. La foire aux semences (arc suivant) |
| Liens | mari de Margot, père de Léon; brouillé avec Berthe; Mado cercle ses roues; Nour soigne ses vaches; l'abbé lui confie le blé rouge |
| Adore | soupe de légumes, carotte |
| Aime | pain, œuf, radis, radis à la croque-au-sel |
| N'aime pas | chocolat chaud (« Un bol de lait sucré ? Je ne suis plus un gamin. »), plume de geai |
| Apparence | trapu; chapeau de paille cabossé, chemise grise rayée, pantalon de velours brun à bretelles, bottes; moustache épaisse; accessoire: faux (été), fourche (sinon) |

#### Margot Delmas

| | |
|---|---|
| Caractère | Gaie, organisée, diplomate: c'est elle qui tient la paix du hameau; chante à la chorale; fait le meilleur beurre de la vallée |
| Histoire | 1. **Le beurre à deux**: baratter à deux (Espace en alternance). 2. **La génisse**: après le vêlage (quête de Nour), nommer la génisse à deux et lui apprendre la longe. 3. **Les tables de la moisson**: emprunter tables et bancs dans le bourg (Odette, Colette, Basile) pour le repas. 4. Le premier fromage de la ferme (arc suivant). 5. (arc suivant) |
| Liens | femme de Paulin, mère de Léon; amie de Berthe (la farine du jeudi, en cachette); lessive du lundi avec Colette; livre le beurre à Odette |
| Adore | confiture de mûres (0.12), pot de fleurs |
| Aime | laitue, fromage frais (0.12), gelée de sureau, carotte |
| N'aime pas | goujon, rondin |
| Apparence | ronde et vive; robe de cotonnade vert pomme passé #8BA37B à petits carreaux, tablier bleu-gris, sabots; cheveux bruns en chignon haut piqué d'un crayon; joues rouges; accessoire: pot à lait de fer-blanc |

#### Léon Delmas

| | |
|---|---|
| Caractère | Fanfaron au grand cœur; veut conduire une locomotive; parie contre Jeanne et perd une fois sur deux |
| Histoire | 1. **Le pari des loches**: attraper une loche à la main au bout de la pâture (l'un pousse les pierres, l'autre attend). 2. **La cloche de Léon**: obtenir de Firmin qu'il sonne la cloche à l'arrivée du train, un samedi. 3. **La cabane ou l'affût** (suite de la décision C5). 4 et 5. (arc suivant) |
| Liens | fils de Paulin et Margot; copain et rival de Jeanne; élève d'Armand; admire Firmin; Mado ne le laisse pas encore lancer aux quilles |
| Adore | brioche, chocolat chaud |
| Aime | chevesne, mûre, noisette, goujon |
| N'aime pas | laitue (« Les lapins, c'est chez nous. »), gelée de sureau |
| Apparence | petit (échelle 0,78); culottes courtes de velours, chemise blanche sortie, bretelles, casquette de cheminot trop grande (rouge passé); genoux écorchés (pansement); cheveux noirs en épi; accessoire: sifflet de chef de train en fer-blanc au cou, sur un lacet brun |

#### Ambroise Pélissier

| | |
|---|---|
| Caractère | Pointilleux, ronchon, parle en proverbes d'horloger, sentimental en secret; a réglé pendant quarante ans les horloges de toutes les gares de la ligne |
| Histoire | 1. **Les ressorts du samedi**: aller chercher au train le petit colis de ressorts qu'il attend depuis un an. 2. **La montre d'Émile** (décision C1): la montre que Firmin a fait porter; dedans, un ticket de quai plié sans destination (fil rouge, sans réponse). 3. **Les souliers de la rentrée**: des souliers pour Jeanne, avec la blouse de Solange. 4 et 5. L'horloge du clocher (arc suivant) |
| Liens | brouillé avec Firmin pour « la minute »; répare les ciseaux de Solange et l'appareil de Lucie; lit le journal sur le banc du quai quand Firmin est parti |
| Adore | gelée de sureau, noisettes grillées (0.12) |
| Aime | brioche, œuf, herbier encadré, horloge murale (`wall_clock`) |
| N'aime pas | rondin (« De la sciure dans mes rouages ? »), goujon |
| Apparence | petit et voûté (échelle 0,94); blouse grise d'atelier #8D8F94, gilet noir à chaîne de montre de laiton, manchettes de lustrine; crâne chauve, couronne de cheveux blancs, favoris; accessoire: loupe d'horloger vissée à l'œil gauche (relevée en marchant) |

#### Nour Belkacem

| | |
|---|---|
| Caractère | Énergique, toujours pressée, rire facile; arrivée l'an dernier de la ville: une nouvelle venue, comme le duo, qui donne des astuces (« Moi aussi, la première semaine, je me suis perdue au hameau ») |
| Histoire | 1. **La visite de Nour**: elle examine tes poules (l'un tient la poule, l'autre lit le carnet de santé); ensuite elle passe chaque jeudi (planning qui touche le duo). 2. **Le vêlage** (scène à deux): un soir à 22 h, à l'étable, avec Margot. 3. **Le renard à l'épine**: avec Inès, approcher à deux un jeune renard qui boite (l'un tend la couverture, l'autre attend sans bouger); il repart guéri. 4. **L'enclos de soins**: bâtir l'enclos de la maison A avec des planches de Basile. 5. (arc suivant) |
| Liens | amie d'Inès; soigne les vaches des Delmas et les bêtes du duo; déjeune en pension chez Odette; fait la course à vélo avec Lucie |
| Adore | chocolat chaud, pain chaud |
| Aime | fromage frais (0.12), confiture de mûres (0.12), carotte, noisettes grillées (0.12) |
| N'aime pas | omelette et œuf (« J'ai vu trop de poules cette semaine. ») |
| Apparence | taille moyenne, vive; veste de toile kaki à poches, pantalon fuselé, bottes de caoutchouc; peau #B9825C, cheveux noirs bouclés en queue; accessoire: grosse sacoche de cuir de vétérinaire, stéthoscope; vélo noir à panier |

#### Colette Lafon

| | |
|---|---|
| Caractère | Chaleureuse, franche, elle entend tout et ne répète rien (le contraire d'Odette, d'où leur rivalité amicale); joue de l'accordéon de son oncle |
| Histoire | 1. **Les chaises de la terrasse**: recoller à deux six chaises avec la colle de Basile. 2. **Le concours de soupe** (suite de la dispute de trois jours avec Odette, scène 7.2): le duo goûte, les deux gagnent. 3. **Le bal du café** (scène à deux): le premier bal depuis vingt ans; elle joue, le duo danse (rythme). 4. **L'accordéon de l'oncle**: Ambroise remet en place les anches. 5. (arc suivant) |
| Liens | rivale et amie d'Odette; lessive du lundi avec Margot; sert la manille et les quilles; Berthe déjeune chez elle |
| Adore | girolle, noisettes grillées (0.12) |
| Aime | œuf, carotte, laitue, fromage frais (0.12) |
| N'aime pas | chocolat chaud (« J'en sers toute la journée. »), goujon |
| Apparence | taille moyenne, ronde; robe brique foncé #8E3F35, tablier noir court de serveuse, manches retroussées; cheveux noirs au carré avec frange; boucles d'oreilles de laiton; accessoire: torchon sur l'épaule, plateau; accordéon (P1, pour le bal et l'anniversaire) |

### 2.4 Le réseau des liens

| Sorte | Liens |
|---|---|
| Familles | Lucie, tante de Jeanne; Paulin et Margot, parents de Léon; Mado et Barnabé, mariés; Honorine et Marthe, sœurs; Firmin, neveu d'Émile; Odette, sœur de Gustave (au loin) |
| Disparus (au cimetière) | Hortense Cornu (femme de Basile), Octave Valade (mari d'Honorine), les parents Ferrand, Eugénie Mérigot (mère de Solange), les parents Lacombe; aucune tombe pour Émile |
| Amitiés | Firmin, Basile et l'abbé (manille); Odette et Solange; Odette et Honorine; Lucie et Solange; Lucie et Achille; Lucie et Nour; Nour et Inès; Margot et Berthe; Margot et Colette; Jeanne et Léon; Armand et Honorine; Basile et Mado |
| Tendresse (sans romance avec les joueurs, HA-05) | Firmin et Lucie (déjà en jeu: les jonquilles, la casquette du dimanche) |
| Brouilles | Firmin et Ambroise (la minute de la pendule, trente ans); Berthe et Paulin (la part du meunier, onze ans); Marthe et Honorine (la robe de noces, quarante ans); Odette et Colette (la soupe: une rivalité gaie, jamais grave) |
| Ce que chacun attend d'un autre | Achille attend la farine de Berthe; l'abbé attend une forge pour son vélo; Lucie attend Ambroise pour son appareil; Jeanne attend Inès pour sa cabane; Barnabé attend qu'Armand le rassure |

## 3. Plannings

### 3.1 Règles

**Format.** Celui de `habitants.json` (`schedule[]`: `{ when?, from, to, point, activity }`, la première entrée vraie l'emporte), avec un champ nouveau `habit`: l'identifiant de l'habitude à laquelle l'entrée appartient (une habitude peut avoir plusieurs entrées: la manille sur la terrasse, ou au comptoir s'il pleut). Les habitudes elles-mêmes (`habits[]`: `id`, `kind`, `label` du carnet, `reveals[]`) sont un tableau nouveau de chaque habitant. `python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py --json FICHIER` écrit les deux au bon format; le lot données (H4) les reporte dans `habitants.json`.

**Les six habitants de la démo.** Leurs entrées existantes restent telles quelles, dans le même ordre (des tests épinglent leurs positions des jours 1 à 15); on leur ajoute le champ `habit` et des entrées neuves, toutes avec `day_at_least 16` quand elles changeraient une journée de la démo. Dans les tableaux, « existant: … » renvoie à une condition déjà écrite dans `habitants.json`.

**Conditions nouvelles** (moteur, lot H1):

| Condition | Vraie quand | Exemple |
|---|---|---|
| `school_day` | lundi, mardi, jeudi ou vendredi, hors été (vacances), hors jour de fête | la classe d'Armand; pour Jeanne, avec `day_at_least 43` (elle entre à l'école à l'automne de l'année 1, règle du tour 9) |
| `special_day { id }` | le jour est dans le calendrier des jours particuliers (table suivante) | la moisson, le Dimanche des lumignons, la cuite |
| `season_day_is { days }` | le jour de la saison (1 à 21) est dans la liste | le premier dimanche de la saison est toujours le jour 2 (une saison commence un samedi) |
| `birthday_of { villager }` | c'est l'anniversaire de cet habitant (`self` dans son propre planning) | les entrées « anniv » |
| `decision_made { decision, option }` | la décision à deux a été prise avec cette option (section 5.2) | les plannings qui changent après « La part du meunier » |

Les autres conditions existent (`weekday_is`, `weather_is`, `season_is`, `day_at_least`, `flag`, `not`). Activités: celles du README; `stand` dans la nef ou au café veut dire « visible dedans ». Rien n'est en dur: les jours particuliers vivent dans `donnees/calendrier.json` (nouveau), les heures dans les plannings.

**Calendrier des jours particuliers.**

| Jour | Quand | Ce qui change | Qui |
|---|---|---|---|
| Samedi du train | chaque samedi (dès le jour 22; jours 1, 8 et 15 comme dans la démo) | le quai se remplit de 9 h à 17 h | Firmin, Basile, Jeanne, Léon, Achille, Solange, Lucie, Mado, Paulin, Berthe |
| Dimanche | chaque dimanche | messe 10 h 30 à 11 h 30; marché sur la place 8 h à 13 h (0.12); boutiques fermées l'après-midi; quilles devant le café 15 h à 18 h; mise en plis et tricot chez Odette | presque tout le bourg |
| Lundi | chaque lundi | fournil fermé (Achille pêche); salon fermé (Solange coud à la vitrine); lessive au lavoir; Mado à la ferme; atelier d'Ambroise fermé | Achille, Solange, Margot, Colette, Mado, Ambroise |
| Mardi | chaque mardi | café fermé (Colette au jardin, accordéon le soir); mairie 17 h à 19 h; Nour à l'étable | Colette, Armand, Nour |
| Mercredi | chaque mercredi | pas d'école: oiseaux à la lisière; manille au café 20 h à 22 h; archives de la mairie | Jeanne, Léon, Inès, Armand, Firmin, Basile, Martial |
| Jeudi | chaque jeudi | Basile au cimetière à l'aube; courses d'Honorine; Margot au moulin; Nour chez le duo (après sa quête) | |
| Vendredi | chaque vendredi | chorale à l'église 20 h à 21 h 30; Honorine au cimetière à 9 h; mairie | Armand, Solange, Marthe, Honorine, Margot (Barnabé après sa quête) |
| Premier dimanche de la saison | jour 2 de chaque saison | Firmin fleurit la tombe de ses parents à 7 h | Firmin (et les sœurs, si la robe est partagée) |
| `cuite` | été jours 8 à 10, automne jours 3 à 5 | Barnabé ne quitte pas sa meule, jour et nuit | Barnabé |
| `harvest` | été jours 17 et 18 (lundi, mardi) | moisson au champ du Haut | Paulin, Margot, Léon |
| `threshing` | été jour 19 (mercredi) | battage dans la cour, repas de moisson 19 h à 22 h | Paulin, Margot, Léon (le bourg y passe: scène 7.2) |
| `lumignons` | automne jour 16 (dimanche) | Dimanche des lumignons: 17 h à 20 h au cimetière | Marthe, Firmin, Odette, Basile, Solange, Honorine |
| Anniversaires | table 2.2 | une entrée « anniv » par habitant | chacun le sien |
| Fêtes de la vallée (P1) | fête des semailles (printemps 16), feux de la mi-été (été 9) | règle commune quand le cadre des fêtes existera (plan, système 7): de 10 h à 22 h, tout habitant qui n'a pas d'habitude « jour » ce jour-là est sur le lieu de la fête | tous |

**Variantes.** Chaque habitant a au moins une variante de pluie ou de saison qui se voit (ou une raison écrite de ne pas en avoir: un boulanger cuit par tous les temps). L'été change les soirées (on reste dehors plus tard) et les vacances des enfants; l'hiver rentre les plus âgés derrière leur fenêtre.

### 3.2 Les plannings, habitant par habitant

Pour chaque habitant, deux tableaux: les entrées dans l'ordre de priorité (la première vraie l'emporte; « Jours »: `lu ma me je ve sa di`), puis ses habitudes telles qu'elles s'écrivent au carnet et comment les apprendre en plus de les voir. Ces tableaux sont imprimés par le script (`--tableaux`) et relus par lui (`--croise`).

#### Firmin Lacombe (`firmin`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 20 h | `grave_lacombe` | stand | jour: `lumignons` |
| 2 | `birthday` | tous | 18 h à 21 h | `grocery_terrace` | host | anniversaire |
| 3 | `train` | sa | 6 h à 17 h | `train_stop` | wait_train | existant: train_day |
| 4 | `season_grave` | di | 7 h à 8 h | `grave_lacombe` | stand | jour de saison 2; dès le jour 16 |
| 5 | `summer_bench` | tous | 18 h à 20 h | `quay_bench` | stand | été |
| 6 | `manille` | me | 20 h à 22 h | `cafe_counter` | stand | pluie; dès le jour 16 |
| 7 | `manille` | me | 20 h à 22 h | `cafe_terrace` | stand | dès le jour 16 |
| 8 | `rain` | tous | 8 h à 18 h | `station_door` | stand | pluie; dès le jour 16 |
| 9 | `lucie_bench` | lu ma me je ve sa | 17 h à 18 h | `quay_bench` | stand | `lucie_back` |
| 10 | `quay` | tous | 8 h à 18 h | `quay_bell` | stand |  |
| 11 | `home` | tous | 6 h à 8 h, 18 h à 24 h | `firmin_house` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, il éclaire la tombe des Lacombe, de 17 h à 20 h | Marthe: « Au Dimanche des lumignons, Firmin éclaire la tombe des Lacombe. Il laisse toujours une place vide sur la plaque. » |
| `birthday` | anniv | Le 6 de l'automne, son anniversaire: un gâteau sur la terrasse d'Odette, de 18 h à 21 h | Odette: « Le 6 de l'automne, c'est l'anniversaire de Firmin. Je lui fais un gâteau sur ma terrasse à 18 h, et il fait semblant d'être surpris. » |
| `train` | jour | Le samedi, sur le quai de 6 h au départ du train (17 h) | Firmin: « Le samedi, je suis sur le quai avant le soleil. Le train n'attend personne, alors moi je l'attends. » |
| `season_grave` | jour | Le premier dimanche de chaque saison, à 7 h, il fleurit la tombe de ses parents | Marthe: « Firmin, je le vois au cimetière le premier dimanche de chaque saison, à 7 h pile. Avant moi, ce qui m'agace. » |
| `summer_bench` | saison | L'été, il prend le frais sur le banc du quai, de 18 h à 20 h | Firmin: « L'été, après 18 h, je prends le frais sur le banc du quai. Les rails chantent en refroidissant. » |
| `manille` | routine | Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut) | Basile: « Le mercredi soir, manille au café de la Côte. Firmin triche. L'abbé aussi, mais lui, il demande pardon. »<br>Colette: « Le mercredi, s'il pleut, mes joueurs de manille s'installent au comptoir. Ils font plus de bruit que la pluie. » |
| `rain` | pluie | Sous la pluie, il garde le quai depuis la porte de la halte, de 8 h à 18 h | Firmin: « Quand il pleut, je garde le quai depuis la porte. La cloche, elle, n'a pas peur de l'eau. » |
| `lucie_bench` | apres | Depuis le retour de Lucie, il s'assoit avec elle sur le banc du quai, de 17 h à 18 h | Jeanne: « Tous les jours à 5 h du soir, ma tante va s'asseoir sur le banc du quai, à côté de Firmin. Par hasard, elle dit. » |
| `quay` | routine | Tous les jours, à la cloche du quai, de 8 h à 18 h | Firmin: « De 8 h à 6 h du soir, je suis à ma cloche. Comme Émile, et comme personne d'autre. » |
| `home` | maison | Chez lui (la maison aux tuiles rondes, derrière la voie) avant 8 h et après 18 h | Firmin: « À 6 h du soir, je rentre. Ma maison est derrière la voie, celle aux tuiles rondes, au pied du bois. » |

#### Odette Ferrand (`odette`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 20 h | `grave_ferrand` | stand | jour: `lumignons` |
| 2 | `birthday` | tous | 18 h à 21 h | `grocery_terrace` | host | anniversaire |
| 3 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand | dès le jour 16 |
| 4 | `sunday_plis` | di | 14 h à 16 h | `grocery_table` | host |  |
| 5 | `sunday_terrace` | di | 16 h à 18 h | `grocery_terrace` | stand | sans pluie; dès le jour 16 |
| 6 | `sunday_rest` | di | 13 h à 14 h, 16 h à 20 h | `grocery_door` | home | dès le jour 16 |
| 7 | `monday_grave` | lu | 14 h à 14 h 30 | `grave_ferrand` | stand | dès le jour 16 |
| 8 | `summer_terrace` | tous | 20 h à 21 h | `grocery_terrace` | stand | été |
| 9 | `counter` | tous | 7 h à 20 h | `grocery_inside_counter` | serve |  |
| 10 | `home` | tous | 6 h à 7 h, 20 h à 24 h | `grocery_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, trois bougies sur la tombe des Ferrand, de 17 h à 20 h | Odette: « Au Dimanche des lumignons, je porte trois bougies à mes parents. Une pour chacun, et une pour Gustave, où qu'il soit. » |
| `birthday` | anniv | Le 5 de l'été, son anniversaire: elle ferme à 18 h et reçoit sur la terrasse jusqu'à 21 h | Solange: « Le 5 de l'été, Odette fête son anniversaire sur sa terrasse. Elle ferme à 18 h: c'est le seul jour de l'année. » |
| `mass` | jour | Le dimanche, elle ferme pour la messe, de 10 h 30 à 11 h 30 | écriteau `grocery_sign`: « Fermé pendant la messe du dimanche (10 h 30 à 11 h 30). O. F. »<br>Odette: « Le dimanche à 10 h 30, je ferme pour la messe. Une heure, pas plus: le bon Dieu sait que j'ai des clients. » |
| `sunday_plis` | jour | Le dimanche, mise en plis par Solange à la petite table, de 14 h à 16 h | Solange: « Le dimanche à 2 h, je fais la mise en plis d'Odette, à sa petite table. Elle parle, je frise. » |
| `sunday_terrace` | jour | Le dimanche, tricot avec Honorine sur la terrasse, de 16 h à 18 h (s'il ne pleut pas) | Honorine: « Le dimanche à 4 h, Odette et moi, on tricote sur sa terrasse. Elle tricote mal, mais elle parle bien. » |
| `sunday_rest` | jour | Le dimanche, boutique fermée de 13 h à 14 h et après 18 h | écriteau `grocery_sign`: « Le dimanche: ouvert de 7 h à 13 h (sauf pendant la messe). »<br>Honorine: « Le dimanche après-midi, Odette ferme boutique. C'est le seul moment où elle s'assoit. » |
| `monday_grave` | jour | Le lundi, de 14 h à 14 h 30, elle porte des fleurs à ses parents | écriteau `grocery_sign`: « Le lundi: je reviens à 14 h 30. O. F. »<br>Marthe: « Le lundi à 2 h, Odette vient voir ses parents. Elle leur raconte toute la semaine, ils ne s'ennuient pas. » |
| `summer_terrace` | saison | L'été, sur la terrasse de 20 h à 21 h | Odette: « L'été, je prends l'air sur ma terrasse après la fermeture. Le soir, tout le bourg passe devant. » |
| `market` | marche | Le dimanche, une fois dans la matinée, elle passe à l'étal du marché | Odette: « Le dimanche, je ferme boutique cinq minutes pour venir à ton étal. Pas plus: mes clients sont aussi les tiens. » |
| `counter` | routine | Tous les jours, au comptoir de 7 h à 20 h | écriteau `grocery_sign`: « ÉPICERIE FERRAND. Ouvert tous les jours de 7 h à 20 h. »<br>Odette: « De 7 h à 20 h, je suis à mon comptoir. Après, je tire le rideau et je compte mes bocaux. » |
| `home` | maison | Chez elle, au-dessus de l'épicerie, avant 7 h et après 20 h | Odette: « À 20 h, je monte. Ma chambre donne sur la place: je vois tout, même dans le noir. » |

#### Basile Cornu (`basile`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 20 h | `grave_cornu` | stand | jour: `lumignons` |
| 2 | `birthday` | tous | 8 h à 18 h | `clearing_center` | work | anniversaire |
| 3 | `train` | sa | 9 h 30 à 16 h 30 | `train_stop` | wait_train | existant: train_day |
| 4 | `thursday_grave` | je | 6 h 30 à 7 h 30 | `grave_cornu` | stand | dès le jour 16 |
| 5 | `manille` | me | 20 h à 22 h | `cafe_counter` | stand | pluie; dès le jour 16 |
| 6 | `manille` | me | 20 h à 22 h | `cafe_terrace` | stand | dès le jour 16 |
| 7 | `sunday_wood` | di | 9 h à 12 h | `forest_cut` | stand | sans pluie; dès le jour 16 |
| 8 | `sunday_square` | di | 14 h à 18 h | `square_lime_tree` | stand | sans pluie; dès le jour 16 |
| 9 | `sunday_rest` | di | 6 h à 24 h | `sawmill_yard` | home | dès le jour 16 |
| 10 | `summer_yard` | tous | 18 h à 19 h 30 | `sawmill_yard` | stand | été |
| 11 | `workbench` | tous | 8 h à 18 h | `basile_at_workbench` | work |  |
| 12 | `home` | tous | 6 h à 8 h, 18 h à 24 h | `sawmill_yard` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, une lanterne pour Hortense, de 17 h à 20 h | Basile: « Au Dimanche des lumignons, je pose une lanterne pour Hortense. Elle avait peur du noir, alors je reste un peu. » |
| `birthday` | anniv | Le 4 du printemps, son anniversaire: il va planter un chêne à la clairière du Vieux Chêne, de 8 h à 18 h | Jeanne: « Le 4 du printemps, c'est l'anniversaire de Basile. Il va planter un chêne au bois. Il dit qu'il en a planté soixante-douze ! » |
| `train` | jour | Le samedi, au train de 9 h 30 à 16 h 30 | Basile: « Le samedi, je vais au train: il y a toujours une caisse que personne ne sait porter. » |
| `thursday_grave` | routine | Le jeudi, de 6 h 30 à 7 h 30, il ratisse la tombe d'Hortense | Marthe: « Le jeudi, à la première heure, Basile vient voir Hortense. Ils s'étaient mariés un jeudi. Il ne dit rien, il ratisse le gravier. » |
| `manille` | routine | Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut) | Firmin: « Le mercredi soir, manille au café, avec Basile et l'abbé. Sur la terrasse, ou au comptoir s'il pleut. » |
| `sunday_wood` | jour | Le dimanche, il va voir ses arbres à la coupe, de 9 h à 12 h (s'il ne pleut pas) | Inès: « Le dimanche matin, Basile monte au bois voir ses arbres. Il les appelle par leur nom, et ils ne lui répondent pas, ce qui l'arrange. » |
| `sunday_square` | jour | Le dimanche, il taille des bouts de bois sous le tilleul de la place, de 14 h à 18 h (s'il ne pleut pas) | Basile: « Le dimanche après-midi, je taille des bouts de bois sous le tilleul de la place. Ça occupe les mains. » |
| `sunday_rest` | jour | Le dimanche, l'atelier est fermé: il reste chez lui le reste du jour | Odette: « Le dimanche, Basile ferme son atelier. Ne frappe pas, il fait semblant de ne pas entendre. » |
| `summer_yard` | saison | L'été, il prend le frais dans la cour de la scierie, de 18 h à 19 h 30 | Basile: « L'été, après l'établi, je m'assois dans la cour. L'odeur du bois chaud, ça se respire. » |
| `workbench` | routine | À son établi de 8 h à 18 h (le dimanche aussi pendant les deux premières semaines) | Basile: « À l'établi de 8 h à 6 h du soir. Le bois n'aime pas qu'on le brusque, moi non plus. » |
| `home` | maison | Chez lui, au-dessus de la scierie, avant 8 h et après 18 h | Basile: « Le soir, je suis chez moi, au-dessus de la scierie. À mon âge, le soir commence tôt. » |

#### Jeanne Ribot (`jeanne`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 15 h à 17 h | `village_square` | host | anniversaire |
| 2 | `train` | sa | 9 h 30 à 16 h 30 | `train_stop` | wait_train | existant: train_day |
| 3 | `recess` | lu ma je ve | 10 h à 10 h 20, 14 h 30 à 14 h 50 | `school_yard` | play | jour de classe; dès le jour 43 |
| 4 | `school` | lu ma je ve | 8 h à 16 h 30 | `school_gate` | absent | jour de classe; dès le jour 43 |
| 5 | `after_school` | lu ma je ve | 16 h 30 à 18 h 30 | `well_shelter` | play | jour de classe; dès le jour 43; pluie |
| 6 | `after_school` | lu ma je ve | 16 h 30 à 18 h 30 | `village_square` | play | jour de classe; dès le jour 43 |
| 7 | `hopscotch` | tous | 18 h 30 à 20 h | `hopscotch` | play | existant: chalk_box; sans pluie |
| 8 | `rain` | tous | 8 h à 18 h | `well_shelter` | play | existant: rain_well_roof |
| 9 | `rain` | tous | 8 h à 18 h | `quay_bench` | play | existant: rain_no_roof |
| 10 | `hide` | me | 14 h à 17 h | `bird_hide` | play | sans pluie; `bird_hide_built` |
| 11 | `wednesday_birds` | me | 14 h à 17 h | `forest_edge_path` | play | sans pluie; dès le jour 16; printemps, été, automne |
| 12 | `sunday_berge` | di | 10 h à 12 h | `riverbank` | play | existant: solange_here |
| 13 | `summer_square` | tous | 18 h à 21 h | `village_square` | play | été |
| 14 | `morning_bench` | tous | 8 h à 12 h | `quay_bench` | play |  |
| 15 | `riverbank` | tous | 12 h à 18 h | `riverbank` | play |  |
| 16 | `evening_square` | tous | 18 h à 18 h 30 | `village_square` | play |  |
| 17 | `home` | tous | 6 h à 8 h, 18 h 30 à 24 h | `lucie_house_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 12 du printemps, son anniversaire: un goûter sur la place, de 15 h à 17 h | Léon: « Le 12 du printemps, c'est l'anniversaire de Jeanne. Elle fait un goûter sur la place à 3 h. Elle a dit que tu pouvais venir. » |
| `train` | jour | Le samedi, elle regarde le train depuis le quai, de 9 h 30 à 16 h 30 | Firmin: « Le samedi, Jeanne ne quitte pas le quai tant que le train est là. Elle compte les wagons, alors qu'il n'y en a que deux. » |
| `recess` | routine | Les jours de classe, récréation dans la cour à 10 h et à 14 h 30 (20 minutes) | Jeanne: « À la récré de 10 h et de 2 h et demie, on joue au loup dans la cour. Léon triche, il court trop vite. » |
| `school` | routine | Les jours de classe (lundi, mardi, jeudi, vendredi, hors été), à l'école de 8 h à 16 h 30 | écriteau `school_sign`: « École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30. »<br>Armand: « Jeanne est à l'école le lundi, le mardi, le jeudi et le vendredi. Le mercredi, elle est libre comme l'air, hélas pour mes leçons. » |
| `after_school` | routine | Les jours de classe, sur la place de 16 h 30 à 18 h 30 (sous le toit du puits s'il pleut) | Solange: « Après la classe, Jeanne file sur la place. S'il pleut, elle se met sous le toit du puits avec Léon. » |
| `hopscotch` | routine | Le soir, la marelle de 18 h 30 à 20 h (avec ses craies, s'il ne pleut pas) | Jeanne: « Le soir après 6 h et demie, je fais la marelle avec mes craies, s'il ne pleut pas. Tu sais sauter à cloche-pied ? » |
| `rain` | pluie | Sous la pluie, elle joue sous le toit du puits (ou sur le banc du quai), de 8 h à 18 h | Jeanne: « Quand il pleut, je joue sous le toit du puits. Les gouttes font de la musique sur les tuiles. » |
| `hide` | apres | Depuis « La cabane des oiseaux »: le mercredi, à la cabane de la mare de 14 h à 17 h (s'il ne pleut pas) | Inès: « Le mercredi, Jeanne est à sa cabane de la mare dès 2 h. Elle compte les poules d'eau et elle me corrige quand je me trompe. » |
| `wednesday_birds` | routine | Le mercredi, elle guette les oiseaux à l'orée avec Léon, de 14 h à 17 h (hors hiver, s'il ne pleut pas) | Inès: « Le mercredi après-midi, Jeanne et Léon viennent à l'orée compter les oiseaux. Ils se disputent pour chaque mésange. » |
| `sunday_berge` | jour | Le dimanche, promenade sur la berge avec Solange, de 10 h à 12 h | Solange: « Le dimanche matin, je promène Jeanne sur la berge, de 10 h à midi. Elle ramasse tous les galets du monde. » |
| `summer_square` | saison | L'été, sur la place de 18 h à 21 h | Jeanne: « L'été, je reste sur la place jusqu'à 9 h du soir ! Tante Lucie dit oui parce qu'il fait jour. » |
| `morning_bench` | routine | Le matin, sur le banc du quai de 8 h à 12 h | Firmin: « Le matin, Jeanne s'installe sur mon banc du quai. Elle me pose des questions jusqu'à midi. » |
| `riverbank` | routine | L'après-midi, au bord de l'Aubrune de 12 h à 18 h | Jeanne: « L'après-midi, je suis au bord de l'Aubrune. Les galets plats, c'est là qu'ils sont. » |
| `evening_square` | routine | En fin d'après-midi, sur la place de 18 h à 18 h 30, puis Solange la ramène | Solange: « À 6 h du soir, je descends chercher Jeanne sur la place. Elle dit toujours encore cinq minutes. » |
| `home` | maison | Chez sa tante Lucie, en face de la mercerie, avant 8 h et après 18 h 30 (20 h avec la marelle) | Jeanne: « Je dors chez tante Lucie, la maison en face de chez Solange. Ma fenêtre donne sur les pommiers. » |

#### Achille Pradel (`achille`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 17 h | `bakery_window` | serve | anniversaire |
| 2 | `monday_pontoon` | lu | 8 h à 12 h | `fishing_pontoon` | stand | sans pluie |
| 3 | `monday_pontoon` | lu | 6 h à 12 h | `bakery_window` | home |  |
| 4 | `monday_terrace` | lu | 12 h à 14 h | `grocery_terrace` | stand |  |
| 5 | `train` | sa | 10 h à 11 h | `train_stop` | wait_train |  |
| 6 | `basket` | ma me je ve sa di | 9 h à 9 h 30 | `grocery_door` | stand |  |
| 7 | `window` | ma me je ve sa di | 6 h à 9 h, 9 h 30 à 12 h | `bakery_window` | serve |  |
| 8 | `lunch` | tous | 12 h à 13 h | `upper_street_bench` | stand |  |
| 9 | `sleep` | tous | 13 h à 17 h 30 | `bakery_window` | home |  |
| 10 | `evening_fish` | tous | 17 h 30 à 19 h | `bakery_window` | stand | pluie |
| 11 | `evening_fish` | tous | 17 h 30 à 19 h | `fishing_ford_north` | stand |  |
| 12 | `home` | tous | 6 h à 24 h | `bakery_window` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 13 de l'été, son anniversaire: pas de sieste, il tient le guichet de 14 h à 17 h | Jeanne: « Le 13 de l'été, c'est l'anniversaire d'Achille ! Il ne fait pas la sieste, et l'après-midi il donne des chouquettes au guichet. » |
| `monday_pontoon` | jour | Le lundi, le fournil est fermé: il pêche au ponton de 8 h à 12 h (chez lui s'il pleut) | écriteau `bakery_sign`: « Fermé le lundi. Le boulanger est à la pêche. »<br>Odette: « Le lundi, Achille pêche au ponton toute la matinée. S'il pleut, il dort. S'il fait beau, il dort aussi, mais assis. » |
| `monday_terrace` | jour | Le lundi, il déjeune sur la terrasse d'Odette de 12 h à 14 h | Achille: « Le lundi midi, je déjeune sur la terrasse d'Odette. C'est le seul jour où quelqu'un me fait à manger. » |
| `train` | jour | Le samedi, au train de 10 h à 11 h pour ses sacs de farine | Achille: « Le samedi à 10 h, je suis au train pour mes sacs de farine. Ils pèsent plus lourd que moi, ou presque. » |
| `basket` | routine | Du mardi au dimanche, de 9 h à 9 h 30, il descend la panière chez Odette | Odette: « À 9 h, Achille descend la panière chez moi. Tu peux régler ta montre dessus. Enfin, pas sur celle d'Ambroise. » |
| `window` | routine | Du mardi au dimanche, au guichet de 6 h à 9 h (pain chaud) et de 9 h 30 à 12 h | écriteau `bakery_sign`: « Pain chaud de 6 h à 9 h. Pain jusqu'à midi. Brioche le dimanche. Fermé le lundi. »<br>Achille: « Le guichet ouvre à 6 h. Le pain chaud, c'est jusqu'à 9 h; après, il est juste bon. » |
| `lunch` | routine | À midi, il déjeune sur le banc de la rue Haute (avec Lucie, depuis son retour) | Lucie: « À midi, Achille déjeune sur le banc de la rue Haute. Je m'assois avec lui, il me donne le quignon. » |
| `sleep` | routine | L'après-midi, il dort au fournil, volets fermés, de 13 h à 17 h 30 | écriteau `bakery_sign`: « Le boulanger dort de 13 h à 17 h 30. Merci de ne pas frapper. A. P. »<br>Solange: « L'après-midi, les volets du fournil sont fermés: Achille dort. Il cuit la nuit, le pauvre. » |
| `evening_fish` | routine | Le soir, il pêche au gué de 17 h 30 à 19 h (sous l'auvent du fournil s'il pleut) | Achille: « Le soir, de 17 h 30 à 19 h, je pêche au gué. S'il pleut, je regarde la pluie sous mon auvent: c'est presque pareil. » |
| `home` | maison | Chez lui, au-dessus du fournil, après 19 h | Achille: « À 7 h du soir, au lit. Le four se réveille avant moi, et il ne me laisse jamais dormir. » |

#### Solange Mérigot (`solange`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 20 h | `grave_merigot` | stand | jour: `lumignons` |
| 2 | `birthday` | tous | 18 h 30 à 20 h | `salon_counter` | host | anniversaire |
| 3 | `train` | sa | 10 h à 10 h 45 | `train_stop` | wait_train |  |
| 4 | `fetch` | tous | 18 h à 18 h 30 | `village_square` | stand |  |
| 5 | `fetch` | tous | 18 h 30 à 19 h | `lucie_house_door` | stand |  |
| 6 | `sunday_berge` | di | 10 h à 12 h | `riverbank` | stand |  |
| 7 | `sunday_plis` | di | 14 h à 16 h | `grocery_table` | stand |  |
| 8 | `monday_window` | lu | 10 h à 16 h | `salon_window` | work |  |
| 9 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand | dès le jour 16 |
| 10 | `salon` | ma me je ve sa | 9 h à 12 h, 14 h à 18 h | `salon_counter` | serve |  |
| 11 | `home` | tous | 6 h à 24 h | `salon_counter` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, un lumignon pour sa mère, de 17 h à 20 h | Solange: « Au Dimanche des lumignons, je pose un lumignon pour ma mère. Elle tenait la mercerie avant moi; elle aurait détesté mes rideaux. » |
| `birthday` | anniv | Le 10 de l'automne, son anniversaire: elle ouvre la malle du théâtre au salon, de 18 h à 20 h | Lucie: « Le 10 de l'automne, Solange a son anniversaire. Elle ouvre la malle du théâtre le soir au salon, et elle ne veut pas qu'on le sache. » |
| `train` | jour | Le samedi, au train de 10 h à 10 h 45 pour ses colis de tissu | écriteau `salon_sign`: « Le samedi, le salon ouvre à 10 h 45 (colis du train). »<br>Solange: « Le samedi, à 10 h, je descends au train chercher mes colis de tissu. Le salon ouvre à 10 h 45, pas avant. » |
| `fetch` | routine | Tous les jours, elle va chercher Jeanne sur la place à 18 h, puis la ramène chez Lucie | Jeanne: « À 6 h, Solange vient me chercher sur la place, et on remonte ensemble. Elle marche vite pour quelqu'un qui dit qu'elle est vieille. » |
| `sunday_berge` | jour | Le dimanche, promenade sur la berge avec Jeanne, de 10 h à 12 h | Jeanne: « Le dimanche matin, Solange m'emmène sur la berge. Elle dit que les galets, c'est bon pour la patience. » |
| `sunday_plis` | jour | Le dimanche, mise en plis d'Odette à l'épicerie, de 14 h à 16 h | Odette: « Le dimanche à 2 h, Solange me frise à ma petite table. Je ressors avec dix ans de moins, pour une semaine. » |
| `monday_window` | jour | Le lundi, salon fermé: elle coud à la vitrine de 10 h à 16 h | écriteau `salon_sign`: « Le lundi, le salon est fermé. La couturière est à sa vitrine. »<br>Solange: « Le lundi, le salon est fermé, mais je couds à ma vitrine de 10 h à 4 h. Fais-moi signe en passant. » |
| `chorale` | routine | Le vendredi, la chorale à l'église de 20 h à 21 h 30 | Armand: « Le vendredi à 8 h du soir, chorale à l'église. Solange chante l'alto et corrige ma mesure, gentiment, devant tout le monde. » |
| `salon` | routine | Du mardi au samedi, au salon de 9 h à 12 h et de 14 h à 18 h | écriteau `salon_sign`: « SALON MÉRIGOT. Du mardi au samedi, 9 h à 12 h et 14 h à 18 h. »<br>Solange: « Le salon, c'est du mardi au samedi. Le matin et l'après-midi, avec une pause pour les ciseaux. » |
| `home` | maison | Chez elle, sous le toit de la mercerie, le reste du temps (de 12 h à 14 h, le soir et la nuit) | Solange: « De midi à 2 h, je monte sous mon toit. Même les ciseaux ont besoin de souffler. » |

#### Lucie Arnaud (`lucie`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `round` | tous | 6 h à 24 h | `offstage` | absent | sans `lucie_back` |
| 2 | `birthday` | tous | 14 h à 18 h | `village_square` | stand | anniversaire |
| 3 | `darkroom` | lu ma me je ve | 14 h à 17 h | `lucie_house_door` | home | pluie |
| 4 | `train` | sa | 10 h à 11 h | `train_stop` | wait_train |  |
| 5 | `sorting` | lu ma me je ve sa | 7 h à 8 h | `quay_bench` | work |  |
| 6 | `round` | lu ma me je ve | 8 h à 12 h | `offstage` | absent |  |
| 7 | `round` | sa | 11 h à 16 h | `offstage` | absent |  |
| 8 | `lunch` | lu ma me je ve | 12 h à 13 h | `upper_street_bench` | stand |  |
| 9 | `photo_lookout` | lu me | 14 h à 17 h | `lookout` | stand | sans pluie |
| 10 | `photo_pontoon` | ma je | 14 h à 17 h | `fishing_pontoon` | stand | sans pluie |
| 11 | `photo_church` | ve | 14 h à 17 h | `church_square` | stand | sans pluie |
| 12 | `quay_bench` | lu ma me je ve sa | 17 h à 18 h | `quay_bench` | stand |  |
| 13 | `sunday_garden` | di | 9 h à 12 h | `lucie_garden` | work |  |
| 14 | `sunday_walk` | di | 14 h à 17 h | `riverbank` | stand | sans pluie |
| 15 | `home` | tous | 6 h à 24 h | `lucie_house_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 18 du printemps, son anniversaire: pas de tournée l'après-midi, elle photographie la place de 14 h à 18 h | Solange: « Le 18 du printemps, Lucie fête son anniversaire en photographiant tout le bourg, l'après-midi, sur la place. Souris, elle vise bien. » |
| `darkroom` | pluie | Les jours de pluie, de 14 h à 17 h, elle développe ses photos (chambre noire, chez elle) | Lucie: « Les jours de pluie, l'après-midi, je m'enferme dans ma chambre noire. Ne frappe pas: la lumière, c'est la fin de mes photos. »<br>Jeanne: « Quand il pleut, tante Lucie fait des photos dans le noir. Je n'ai pas le droit d'entrer, même pour un biscuit. » |
| `train` | jour | Le samedi, au train de 10 h à 11 h pour les sacs postaux, puis la tournée | Firmin: « Le samedi, Lucie prend les sacs postaux au train à 10 h, puis elle file aux hameaux. » |
| `sorting` | routine | Du lundi au samedi, elle trie le courrier sur le banc du quai de 7 h à 8 h (et y laisse la sacoche du bourg) | Firmin: « À 7 h, Lucie trie le courrier sur mon banc. À 8 h, elle te laisse la sacoche du bourg et elle part. » |
| `round` | routine | Du lundi au vendredi, tournée des hameaux à vélo de 8 h à 12 h (le samedi de 11 h à 16 h) | Lucie: « Le matin, je fais les hameaux à vélo: douze fermes, trois côtes et un chien qui me déteste. » |
| `lunch` | routine | Du lundi au vendredi, déjeuner sur le banc de la rue Haute avec Achille, de 12 h à 13 h | Achille: « À midi, Lucie s'assoit sur mon banc. Elle me raconte les hameaux, je lui donne le quignon. C'est un bon marché. » |
| `photo_lookout` | routine | Le lundi et le mercredi, photos au belvédère de 14 h à 17 h (s'il ne pleut pas) | Lucie: « L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église. » |
| `photo_pontoon` | routine | Le mardi et le jeudi, photos au ponton de 14 h à 17 h (s'il ne pleut pas) | Lucie: « L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église. »<br>Achille: « Le mardi et le jeudi, Lucie vient au ponton avec sa boîte noire. Elle fait fuir mes poissons, mais ils reviennent pour la photo. » |
| `photo_church` | routine | Le vendredi, photos devant l'église de 14 h à 17 h (s'il ne pleut pas) | Lucie: « L'après-midi, je photographie. Le lundi et le mercredi au belvédère, le mardi et le jeudi au ponton, le vendredi devant l'église. »<br>Marthe: « Le vendredi, Lucie photographie mon clocher. Il n'a pas changé depuis cent ans, mais elle dit que la lumière, si. » |
| `quay_bench` | routine | Du lundi au samedi, sur le banc du quai avec Firmin, de 17 h à 18 h | Jeanne: « Tous les jours à 5 h du soir, ma tante va s'asseoir sur le banc du quai, à côté de Firmin. Par hasard, elle dit. » |
| `sunday_garden` | jour | Le dimanche, elle bêche son jardinet de 9 h à 12 h | Lucie: « Le dimanche matin, je bêche mon jardinet. Mes salades sont plus petites que les tiennes, ne le répète à personne. » |
| `sunday_walk` | jour | Le dimanche, photos de galets sur la berge avec Jeanne, de 14 h à 17 h (s'il ne pleut pas) | Jeanne: « Le dimanche après-midi, tante Lucie m'emmène sur la berge photographier les galets. Ils ne bougent pas, c'est pratique. » |
| `home` | maison | Chez elle, en face de la mercerie, le reste du temps | Lucie: « J'habite en face de chez Solange. Le soir, on se parle d'une fenêtre à l'autre, comme à dix ans. » |

#### Armand Castagné (`armand`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 18 h à 19 h | `church_nave` | stand | anniversaire |
| 2 | `mass` | di | 10 h 15 à 11 h 30 | `church_nave` | stand |  |
| 3 | `chronicle` | di | 14 h à 16 h | `honorine_doorstep` | stand | `armand_chronicle`; sans pluie |
| 4 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand |  |
| 5 | `mairie` | ma ve | 17 h à 19 h | `mairie_desk` | serve |  |
| 6 | `mairie` | sa | 9 h à 12 h | `mairie_desk` | serve |  |
| 7 | `gate` | lu ma je ve | 8 h à 8 h 30, 16 h 30 à 17 h | `school_gate` | stand | jour de classe |
| 8 | `recess` | lu ma je ve | 10 h à 10 h 20, 14 h 30 à 14 h 50 | `school_yard` | stand | jour de classe |
| 9 | `class` | lu ma je ve | 8 h 30 à 16 h 30 | `school_gate` | absent | jour de classe |
| 10 | `wednesday_archives` | me | 9 h à 12 h | `mairie_desk` | work |  |
| 11 | `lookout` | me | 14 h à 18 h | `lookout` | stand | sans pluie |
| 12 | `lookout` | lu ma je ve | 14 h à 17 h | `lookout` | stand | sans pluie; été |
| 13 | `summer_river` | lu ma je ve | 9 h à 12 h | `riverbank` | stand | sans pluie; été |
| 14 | `home` | tous | 6 h à 24 h | `school_lodging_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 4 de l'automne, son anniversaire: il joue de l'harmonium à l'église, seul, de 18 h à 19 h | Martial: « Le 4 de l'automne, Armand a son anniversaire. Il joue de l'harmonium tout seul à 18 h. Je fais semblant de ne pas l'entendre. » |
| `mass` | jour | Le dimanche, à l'harmonium de la messe, de 10 h 15 à 11 h 30 | Martial: « Armand tient l'harmonium à la messe de 10 h 30. Il arrive à 10 h 15 pour l'accorder, et il l'accorde mal. »<br>écriteau `church_sign`: « Notre-Dame-du-Gué. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu. » |
| `chronicle` | apres | Le dimanche, chez Honorine pour sa chronique, de 14 h à 16 h (depuis « La chronique d'Honorine ») | Honorine: « Le dimanche à 2 h, le petit maître vient m'écouter sous ma glycine. Il écrit tout ce que je dis, même quand j'invente. » |
| `chorale` | routine | Le vendredi, il dirige la chorale à l'église de 20 h à 21 h 30 | Armand: « Chorale le vendredi à 20 h, à l'église. Tout le monde peut venir, même ceux qui chantent comme des portes. »<br>écriteau `church_sign`: « Notre-Dame-du-Gué. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu. » |
| `mairie` | routine | La mairie: mardi et vendredi de 17 h à 19 h, samedi de 9 h à 12 h | écriteau `mairie_sign`: « MAIRIE. Le mardi et le vendredi de 17 h à 19 h, le samedi de 9 h à 12 h. Le secrétaire est aussi le maître: patience. »<br>Armand: « Le mardi et le vendredi, après la classe, j'ouvre la mairie. Le samedi matin aussi. Personne ne vient, mais il faut que ce soit ouvert. » |
| `gate` | routine | Les jours de classe, au portail de l'école de 8 h à 8 h 30 et de 16 h 30 à 17 h | Léon: « Le maître nous attend au portail à 8 h. S'il pleut, il a un parapluie énorme, on tient à quatre dessous. » |
| `recess` | routine | Les jours de classe, il surveille la cour à 10 h et à 14 h 30 (20 minutes) | Armand: « À 10 h et à 2 h et demie, récréation. Je surveille la cour et je compte les genoux écorchés. » |
| `class` | routine | Les jours de classe, en classe de 8 h 30 à 16 h 30 | écriteau `school_sign`: « École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30. » |
| `wednesday_archives` | routine | Le mercredi, il range les archives de la mairie de 9 h à 12 h | Armand: « Le mercredi matin, je range les archives de la mairie. Il y a des registres de cent ans et des souris de deux semaines. » |
| `lookout` | routine | Le mercredi (et en été, du lundi au vendredi), il dessine des fleurs au belvédère de 14 h à 18 h (s'il ne pleut pas) | Lucie: « Le mercredi après-midi, Armand dessine des fleurs au belvédère. Il ne les montre à personne, sauf à moi, parce que j'insiste. » |
| `summer_river` | saison | L'été, aquarelles sur la berge du lundi au vendredi, de 9 h à 12 h (s'il ne pleut pas) | Jeanne: « L'été, le maître peint des aquarelles au bord de l'Aubrune. Il dit que c'est du travail. Moi aussi, je travaille, alors. » |
| `home` | maison | Chez lui, au logement du maître au-dessus de l'école, le reste du temps | Armand: « J'habite au-dessus de l'école, le logement du maître. Le soir, je corrige les cahiers à la lampe. » |

#### Berthe Lavergne (`berthe`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 17 h | `mill_yard` | host | anniversaire |
| 2 | `friday_flour` | ve | 14 h à 15 h | `bakery_back` | work | `valley_flour` |
| 3 | `weighing` | sa | 9 h à 10 h | `train_stop` | work | décision `mouture:weighing` |
| 4 | `watch_train` | sa | 9 h à 10 h | `train_stop` | stand | sans `mouture_settled` |
| 5 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand |  |
| 6 | `sunday_bief` | di | 14 h à 17 h | `mill_race_bank` | stand | sans pluie |
| 7 | `sunday_home` | di | 6 h à 24 h | `mill_door` | home |  |
| 8 | `lunch_cafe` | lu ma me je ve sa | 12 h à 13 h | `cafe_counter` | stand | pluie |
| 9 | `lunch_cafe` | lu ma me je ve sa | 12 h à 13 h | `cafe_terrace` | stand |  |
| 10 | `repair` | lu ma me je ve sa | 8 h à 12 h, 14 h à 17 h | `mill_yard` | work | sans `mill_running` |
| 11 | `monday_dress` | lu | 8 h à 12 h | `mill_yard` | work | `mill_running` |
| 12 | `sluice` | lu ma me je ve sa | 6 h à 6 h 30, 17 h à 17 h 30 | `mill_sluice` | work | `mill_running` |
| 13 | `summer_low` | lu ma me je ve sa | 13 h à 17 h | `mill_race_bank` | stand | été; `mill_running` |
| 14 | `grind` | lu ma me je ve sa | 6 h 30 à 12 h | `mill_door` | work | `mill_running` |
| 15 | `afternoon` | lu ma me je ve sa | 13 h à 17 h | `mill_inside` | work | `mill_running` |
| 16 | `home` | tous | 6 h à 24 h | `mill_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 7 de l'hiver, son anniversaire: la meule chôme et elle fait des crêpes dans la cour, de 14 h à 17 h | Margot: « Le 7 de l'hiver, c'est l'anniversaire de Berthe. Elle arrête la meule et elle fait des crêpes dans la cour. Paulin n'y va pas, moi si. » |
| `friday_flour` | apres | Le vendredi, elle monte la farine au fournil de 14 h à 15 h (depuis « La farine de la vallée ») | Achille: « Le vendredi à 2 h, Berthe monte la farine au fournil avec sa charrette. Elle refuse qu'on l'aide, puis elle accepte. » |
| `weighing` | apres | Depuis la pesée publique: le samedi, elle pèse le blé de Paulin à la bascule de la halte, de 9 h à 10 h | Firmin: « Le samedi à 9 h, la meunière et Paulin pèsent le blé sur ma bascule, devant tout le monde. Ils comptent à voix haute. Moi, j'arbitre. » |
| `watch_train` | routine | Le samedi, de 9 h à 10 h, elle regarde partir les sacs de Paulin vers la ville (jusqu'à « La part du meunier ») | Honorine: « Le samedi, Berthe va au quai voir partir le blé de Paulin pour la ville. Elle ne dit rien. Ça s'entend jusque chez moi. »<br>Berthe: « Le samedi à 9 h, je vais voir partir le blé du Pré-Long au train. Moudre en ville ce qui pousse ici, je veux voir ça de mes yeux. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30 | Berthe: « Le dimanche, la meule se repose et moi je vais à la messe. Je dors au troisième rang, mais je dors bien. » |
| `sunday_bief` | jour | Le dimanche, au bord du bief de 14 h à 17 h (s'il ne pleut pas) | Berthe: « Le dimanche après-midi, je m'assois au bord du bief. L'eau travaille pour moi six jours, je la regarde le septième. » |
| `sunday_home` | jour | Le dimanche, chez elle le reste du jour | Margot: « Le dimanche, le moulin est fermé. Berthe ne travaille pas, elle le dit à qui veut l'entendre. » |
| `lunch_cafe` | routine | Du lundi au samedi, elle déjeune au café de 12 h à 13 h (sur la terrasse, au comptoir s'il pleut) | Colette: « À midi, Berthe déjeune chez moi. Une soupe, un verre, deux nouvelles. Elle repart à une heure pile, la meule l'attend. » |
| `repair` | routine | Tant que le moulin est arrêté, elle répare la roue dans la cour, de 8 h à 12 h et de 14 h à 17 h | Berthe: « Mon moulin ne tourne plus depuis l'hiver. Je répare ma roue tous les jours, matin et après-midi. Elle ne m'aide pas beaucoup. »<br>Basile: « La meunière passe ses journées dans sa cour, à genoux devant sa roue. Il lui faudrait quatre mains pour la vanne. » |
| `monday_dress` | jour | Le lundi, le moulin se tait: elle pique la meule dans la cour de 8 h à 12 h (moulin remis en marche) | Berthe: « Le lundi, je rhabille la meule: un coup de marteau, une rainure. Sans ça, la farine serait du sable. » |
| `sluice` | routine | Elle lève la vanne du bief à 6 h et la baisse à 17 h (moulin remis en marche, sauf le dimanche) | Berthe: « À 6 h, je lève la vanne; à 5 h du soir, je la baisse. L'eau connaît l'heure mieux que moi. » |
| `summer_low` | saison | L'été, l'eau est basse: l'après-midi, elle attend au bord du bief, de 13 h à 17 h | Margot: « L'été, l'après-midi, le bief est trop bas. Berthe s'assoit au bord et elle regarde l'eau comme on regarde un enfant qui traîne. » |
| `grind` | routine | Du lundi au samedi, elle ensache à la porte du moulin de 6 h 30 à 12 h (moulin remis en marche) | Berthe: « Le matin, je suis à la porte du moulin à ensacher. Viens tôt: à midi, je file au café et je ne parle plus de farine. » |
| `afternoon` | routine | L'après-midi, aux meules, dans le moulin, de 13 h à 17 h (moulin remis en marche) | Berthe: « L'après-midi, je suis dedans, aux meules. Tu entendras le moulin avant de me voir. » |
| `home` | maison | Chez elle, à l'étage du moulin, le reste du temps | Berthe: « Le soir, je suis chez moi, à l'étage du moulin. Le bruit de l'eau, c'est ma berceuse. » |

#### Martial Roques (`martial`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 16 h | `village_square` | stand | anniversaire |
| 2 | `sunday_parvis` | di | 10 h à 10 h 30, 11 h 30 à 12 h | `church_square` | stand |  |
| 3 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | host |  |
| 4 | `sunday_hamlets` | di | 14 h à 18 h | `offstage` | absent |  |
| 5 | `open` | tous | 7 h à 7 h 30 | `church_porch` | stand |  |
| 6 | `manille` | me | 20 h à 22 h | `cafe_counter` | stand | pluie |
| 7 | `manille` | me | 20 h à 22 h | `cafe_terrace` | stand |  |
| 8 | `rounds` | lu ma je ve | 9 h à 17 h | `offstage` | absent |  |
| 9 | `wednesday_bike` | me | 9 h à 12 h | `presbytery_door` | work |  |
| 10 | `vintage` | sa | 9 h à 12 h | `vineyard` | work | automne; sans pluie |
| 11 | `saturday_church` | sa | 14 h à 16 h | `church_nave` | stand |  |
| 12 | `saturday_church` | sa | 16 h à 18 h | `cemetery_bench` | stand |  |
| 13 | `garden` | lu ma me je ve sa | 7 h 30 à 9 h, 17 h à 19 h | `priest_garden` | work |  |
| 14 | `garden` | me | 14 h à 17 h | `priest_garden` | work |  |
| 15 | `garden` | sa | 9 h à 12 h | `priest_garden` | work |  |
| 16 | `home` | tous | 6 h à 24 h | `presbytery_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 4 de l'hiver, son anniversaire: il fait le tour du bourg à vélo, de 14 h à 16 h, et s'arrête sur la place | Basile: « Le 4 de l'hiver, l'abbé a son anniversaire. Il fait trois fois le tour de la place à vélo pour prouver qu'il a encore ses jambes. » |
| `sunday_parvis` | jour | Le dimanche, il accueille sur le parvis de 10 h à 10 h 30 et salue de 11 h 30 à 12 h | Martial: « Le dimanche, je suis sur le parvis à 10 h pour serrer les mains. Après la messe aussi, pour les compter. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30 | écriteau `church_sign`: « Notre-Dame-du-Gué. Messe le dimanche à 10 h 30. Chorale le vendredi à 20 h, tout le monde est bienvenu. »<br>Marthe: « Messe à 10 h 30, le dimanche. L'abbé commence à l'heure, je l'y oblige. » |
| `sunday_hamlets` | jour | Le dimanche après-midi, il pédale vers les hameaux, de 14 h à 18 h | Lucie: « Le dimanche après-midi, l'abbé fait les hameaux à vélo, comme moi la semaine. On se croise à la côte, il me double toujours. » |
| `open` | routine | Tous les jours, il ouvre l'église à 7 h (une demi-heure au portail) | Honorine: « À 7 h, l'abbé ouvre l'église. Je l'entends tousser sur le parvis, ça me sert de réveil. » |
| `manille` | routine | Le mercredi, la manille au café de 20 h à 22 h (sur la terrasse, au comptoir s'il pleut) | Firmin: « Le mercredi soir, l'abbé joue à la manille avec Basile et moi, au café. Il bénit ses cartes, ce n'est pas du jeu. » |
| `rounds` | routine | Le lundi, le mardi, le jeudi et le vendredi, tournée des hameaux à vélo, de 9 h à 17 h | Martial: « Quatre hameaux, quatre jours: lundi, mardi, jeudi, vendredi. Je pars à 9 h par la route de l'est, je reviens pour 5 h. »<br>Madeleine: « L'abbé passe devant ma forge à 9 h, à vélo, et il me crie le temps qu'il fera. Il se trompe une fois sur deux. » |
| `wednesday_bike` | routine | Le mercredi, il entretient son vélo de course devant le presbytère, de 9 h à 12 h | Martial: « Le mercredi matin, je graisse mon vélo devant la porte. Trois Tours des vallées, et la chaîne d'origine ! » |
| `vintage` | saison | À l'automne, le samedi matin, il vendange sa vigne de 9 h à 12 h (s'il ne pleut pas) | Martial: « À l'automne, le samedi matin, je vendange ma vigne. Huit rangs, un tonneau, et un vin que je ne sers qu'aux gens qui m'ont aidé. » |
| `saturday_church` | routine | Le samedi, il prépare l'église de 14 h à 16 h, puis s'assoit au cimetière avec Marthe jusqu'à 18 h | Marthe: « Le samedi après-midi, l'abbé prépare son dimanche, puis il vient m'embêter sur mon banc. Je le laisse faire. » |
| `garden` | routine | Au jardin des graines du presbytère, de 7 h 30 à 9 h, puis de 17 h à 19 h (et le mercredi après-midi, le samedi matin) | Martial: « Mon jardin, c'est mon conservatoire: des graines que plus personne ne sème. J'y suis le matin avant de partir, et le soir en rentrant. » |
| `home` | maison | Chez lui, au presbytère, le reste du temps | Martial: « Le presbytère, c'est la maison au bord du parvis, à l'ouest. Frappe fort, je suis souvent au fond du jardin. » |

#### Marthe Bousquet (`marthe`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 20 h | `cemetery_gate` | host | jour: `lumignons` |
| 2 | `birthday` | tous | 11 h 30 à 12 h 30 | `church_bell_rope` | work | anniversaire |
| 3 | `angelus` | tous | 6 h 50 à 7 h 10, 11 h 50 à 12 h 10, 18 h 50 à 19 h 10 | `church_bell_rope` | work |  |
| 4 | `sunday_church` | di | 9 h à 11 h 30 | `church_nave` | work |  |
| 5 | `sisters_terrace` | di | 16 h à 18 h | `grocery_terrace` | stand | `sisters_reconciled`; sans pluie |
| 6 | `dress_walk` | di | 15 h à 16 h | `church_square` | stand | jour de saison 2; décision `robe:shared` |
| 7 | `sunday_bench` | di | 14 h à 17 h | `cemetery_bench` | stand |  |
| 8 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand |  |
| 9 | `rain` | lu ma me je ve sa | 7 h 10 à 11 h 50 | `church_nave` | work | pluie |
| 10 | `cemetery` | lu ma me je ve sa | 7 h 10 à 11 h 50 | `cemetery_tap` | work |  |
| 11 | `garden` | lu ma me je ve sa | 14 h à 17 h | `sexton_garden` | work | sans pluie |
| 12 | `evening_bench` | lu ma me je ve sa | 17 h à 18 h 50 | `cemetery_bench` | stand |  |
| 13 | `home` | tous | 6 h à 24 h | `sexton_house_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, elle distribue les lumignons à la grille du cimetière, de 17 h à 20 h | Marthe: « Au Dimanche des lumignons, je donne un lumignon à chacun, à la grille. Les morts aiment la compagnie, et moi aussi, une fois l'an. » |
| `birthday` | anniv | Le 19 de l'hiver, son anniversaire: elle sonne une volée de plus à midi | Honorine: « Le 19 de l'hiver, ma sœur sonne une volée de plus à midi. C'est son anniversaire, et elle croit que personne ne le sait. » |
| `angelus` | routine | L'angélus, tous les jours à 7 h, à midi et à 19 h (vingt minutes à la corde) | Marthe: « Je sonne l'angélus à 7 h, à midi et à 7 h du soir. Depuis cinquante ans. Les cloches ne m'ont jamais attendue. »<br>écriteau `church_sign_bells`: « Angélus: 7 h, 12 h, 19 h. La sonneuse ne prend pas de rendez-vous. » |
| `sunday_church` | jour | Le dimanche, à l'église de 9 h à 11 h 30 (elle prépare, puis la messe) | Martial: « Le dimanche, Marthe est à l'église dès 9 h. Elle range ce que j'ai rangé la veille. » |
| `sisters_terrace` | apres | Depuis « La robe de noces »: le dimanche, tricot chez Odette avec sa sœur, de 16 h à 18 h | Odette: « Le dimanche, Marthe et Honorine tricotent sur ma terrasse, côte à côte. Quarante ans de silence, et maintenant elles ne s'arrêtent plus. » |
| `dress_walk` | apres | Si la robe est confiée aux deux sœurs: le premier dimanche de chaque saison, de 15 h à 16 h, elles la portent ensemble sur le parvis | Solange: « Le premier dimanche de chaque saison, Marthe et Honorine se passent la robe de noces sur le parvis, à 3 h. Elles la plient à quatre mains. » |
| `sunday_bench` | jour | Le dimanche, sur le banc du cimetière de 14 h à 17 h | Marthe: « Le dimanche après-midi, je m'assois sur mon banc et je donne des nouvelles. Ils sont nombreux, ça prend du temps. » |
| `chorale` | routine | Le vendredi, la chorale de 20 h à 21 h 30, à gauche (sa sœur à droite, jusqu'à la réconciliation) | Solange: « À la chorale du vendredi, Marthe chante à gauche, Honorine à droite. Elles ne se regardent pas, mais elles chantent juste ensemble. » |
| `rain` | pluie | Les jours de pluie, elle cire les bancs de l'église de 7 h 10 à 11 h 50 | Marthe: « Quand il pleut, je cire les bancs. Les morts n'ont pas besoin de moi sous la pluie, les bancs si. » |
| `cemetery` | routine | Du lundi au samedi, elle soigne le cimetière de 7 h 10 à 11 h 50 (à la fontaine et aux arrosoirs) | Basile: « Le matin, Marthe arrose ses dahlias au cimetière. Elle a le plus beau jardin du bourg, et le plus calme. » |
| `garden` | routine | Du lundi au samedi, dans son jardin de dahlias de 14 h à 17 h (s'il ne pleut pas) | Marthe: « L'après-midi, je suis dans mon jardin, derrière la maison. Que des dahlias: ma sœur fait des roses, je ne copie personne. » |
| `evening_bench` | routine | Du lundi au samedi, sur le banc du cimetière de 17 h à 18 h 50 | Martial: « Le soir, avant l'angélus, Marthe s'assoit sur le banc du cimetière. Elle dit qu'elle surveille. Moi, je crois qu'elle se repose. » |
| `home` | maison | Chez elle, la maison du sacristain au pied de l'église, le reste du temps | Marthe: « J'habite la maison du sacristain, au pied de l'église. Ma sœur habite au bout de la route des hameaux. C'est loin. C'est très bien. » |

#### Honorine Valade (`honorine`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `lumignons` | di | 17 h à 19 h | `grave_valade` | stand | jour: `lumignons` |
| 2 | `birthday` | tous | 14 h à 17 h | `honorine_window` | host | anniversaire |
| 3 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand |  |
| 4 | `dress_walk` | di | 15 h à 16 h | `church_square` | stand | jour de saison 2; décision `robe:shared` |
| 5 | `sunday_terrace` | di | 16 h à 18 h | `grocery_terrace` | stand | sans pluie |
| 6 | `friday_grave` | ve | 9 h à 10 h | `grave_valade` | stand |  |
| 7 | `thursday_shop` | je | 10 h à 11 h | `grocery_customer` | stand |  |
| 8 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand |  |
| 9 | `candle` | lu ma me je ve sa | 8 h à 8 h 30 | `church_nave` | stand |  |
| 10 | `winter` | tous | 8 h 30 à 12 h, 14 h à 18 h | `honorine_window` | stand | hiver |
| 11 | `rain` | tous | 8 h 30 à 12 h, 14 h à 18 h | `honorine_window` | stand | pluie |
| 12 | `summer` | tous | 8 h 30 à 11 h, 17 h à 20 h | `honorine_doorstep` | stand | été |
| 13 | `summer` | tous | 11 h à 17 h | `hamlet_house_c_door` | home | été |
| 14 | `doorstep` | tous | 8 h 30 à 12 h, 14 h à 18 h | `honorine_doorstep` | stand |  |
| 15 | `home` | tous | 6 h à 24 h | `hamlet_house_c_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `lumignons` | jour | Au Dimanche des lumignons, sur la tombe d'Octave de 17 h à 19 h | Honorine: « Au Dimanche des lumignons, je vais voir Octave avec ma bougie. Je lui dis qui s'est marié et qui a grossi. » |
| `birthday` | anniv | Le 12 de l'hiver, son anniversaire: tout le bourg passe sous sa fenêtre, de 14 h à 17 h | Odette: « Le 12 de l'hiver, Honorine a son anniversaire. Elle reçoit à sa fenêtre et elle compte qui est venu. Elle note aussi qui n'est pas venu. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30 | Honorine: « Le dimanche, messe à 10 h 30, au premier banc. J'y suis depuis quatre-vingts ans, le banc a pris ma forme. » |
| `dress_walk` | apres | Si la robe est confiée aux deux sœurs: le premier dimanche de chaque saison, de 15 h à 16 h, elles la portent ensemble sur le parvis | Martial: « Le premier dimanche de la saison, les sœurs Bousquet se retrouvent sur mon parvis avec la robe. Je n'ai jamais vu une procession aussi sérieuse. » |
| `sunday_terrace` | jour | Le dimanche, tricot chez Odette de 16 h à 18 h (s'il ne pleut pas) | Odette: « Le dimanche à 4 h, Honorine vient tricoter sur ma terrasse. Elle me raconte ma mère, et je fais semblant de ne pas pleurer. » |
| `friday_grave` | routine | Le vendredi, de 9 h à 10 h, sur la tombe d'Octave | Marthe: « Le vendredi à 9 h, ma sœur va voir Octave. Je m'en vais à l'autre bout du cimetière. Elle aussi, je crois. »<br>Honorine: « Le vendredi matin, je vais voir mon Octave. Il est parti un vendredi, il aimait les choses bien rangées. » |
| `thursday_shop` | routine | Le jeudi, ses courses chez Odette de 10 h à 11 h | Odette: « Le jeudi à 10 h, Honorine fait ses courses. Une heure pour trois choses: elle choisit, elle raconte, elle rechoisit. » |
| `chorale` | routine | Le vendredi, la chorale de 20 h à 21 h 30, à droite (sa sœur à gauche, jusqu'à la réconciliation) | Armand: « À la chorale, Honorine a la plus belle voix et la plus vieille. Elle chante à droite, Marthe à gauche. Ne les mets jamais côte à côte. » |
| `candle` | routine | Du lundi au samedi, elle allume un cierge à l'église de 8 h à 8 h 30 | Martial: « Chaque matin à 8 h, Honorine allume son cierge. Je lui ai dit qu'un par semaine suffisait. Elle m'a répondu qu'elle n'avait pas le temps d'attendre. » |
| `winter` | saison | L'hiver, elle tricote derrière sa fenêtre au lieu du seuil | Honorine: « L'hiver, je tricote derrière ma fenêtre. Je vois aussi bien, et le froid ne me voit pas. » |
| `rain` | pluie | Les jours de pluie, elle tricote derrière sa fenêtre | Jeanne: « Quand il pleut, Honorine tricote derrière sa fenêtre. Si tu lui fais coucou, elle lève une aiguille. » |
| `summer` | saison | L'été, sur son seuil le matin jusqu'à 11 h, puis le soir de 17 h à 20 h | Honorine: « L'été, je sors tôt et je rentre à 11 h, avant que le soleil me cuise. Je ressors à 5 h, quand il a fini. » |
| `doorstep` | routine | Sur sa chaise, sous la glycine, de 8 h 30 à 12 h et de 14 h à 18 h | Honorine: « Le matin et l'après-midi, je suis sur ma chaise, sous la glycine. Je vois passer toute la route des hameaux. Je vois même ce qu'on ne me montre pas. » |
| `home` | maison | Chez elle, la dernière maison du hameau, le reste du temps (sieste de 12 h à 14 h) | Honorine: « J'habite la dernière maison du hameau, celle à la glycine. De midi à deux heures, je fais la sieste. À mon âge, c'est un devoir. » |

#### Inès Garrigue (`ines`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 8 h à 18 h | `lookout` | stand | anniversaire |
| 2 | `sunday_dawn` | di | 6 h à 9 h | `lookout` | stand |  |
| 3 | `sunday_nour` | di | 14 h à 17 h | `forester_bench` | stand | sans pluie |
| 4 | `patrol_clearing` | lu je | 7 h à 12 h | `clearing_center` | work |  |
| 5 | `patrol_spring` | ma ve | 7 h à 12 h | `spring` | work |  |
| 6 | `patrol_coupe` | me sa | 7 h à 12 h | `forest_cut` | work |  |
| 7 | `lunch` | lu ma me je ve sa | 12 h à 13 h 30 | `forester_bench` | stand |  |
| 8 | `wednesday_kids` | me | 14 h à 17 h | `forest_edge_path` | stand | sans pluie; printemps, été, automne |
| 9 | `with_barnabe` | ma je | 14 h à 17 h | `forest_cut` | work |  |
| 10 | `rain` | lu ma me je ve sa | 14 h à 17 h | `forester_house_door` | home | pluie |
| 11 | `maps` | lu ve sa | 14 h à 17 h | `forester_bench` | work |  |
| 12 | `shopping` | lu je | 17 h 30 à 18 h 30 | `grocery_customer` | stand |  |
| 13 | `home` | tous | 6 h à 24 h | `forester_house_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 12 de l'été, son anniversaire: elle passe la journée au belvédère, de 8 h à 18 h | Nour: « Le 12 de l'été, Inès a son anniversaire. Elle monte au belvédère toute la journée et elle compte les oiseaux. C'est sa fête, elle dit. » |
| `sunday_dawn` | jour | Le dimanche, elle compte les oiseaux au belvédère de 6 h à 9 h | Inès: « Le dimanche, à l'aube, je compte les oiseaux au belvédère. Je dis aube: 6 h. Les oiseaux, eux, sont déjà levés. » |
| `sunday_nour` | jour | Le dimanche, thé avec Nour sur le banc de la maison forestière, de 14 h à 17 h (s'il ne pleut pas) | Nour: « Le dimanche après-midi, je monte prendre le thé chez Inès, sur son banc. On se raconte les bêtes de la semaine. » |
| `patrol_clearing` | routine | Le lundi et le jeudi, tournée à la clairière de 7 h à 12 h | Inès: « Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe. » |
| `patrol_spring` | routine | Le mardi et le vendredi, tournée à la source de 7 h à 12 h | Inès: « Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe. »<br>Barnabé: « Le mardi, Inès est à la source dès 7 h. Elle vérifie que l'eau est toujours là. Elle l'est toujours. » |
| `patrol_coupe` | routine | Le mercredi et le samedi, elle marque les arbres de la parcelle de coupe, de 7 h à 12 h | Inès: « Ma tournée change chaque jour: lundi et jeudi la clairière, mardi et vendredi la source, mercredi et samedi la coupe. » |
| `lunch` | routine | Du lundi au samedi, elle déjeune sur le banc de la maison forestière, de 12 h à 13 h 30 | Inès: « À midi, je déjeune sur mon banc. Si tu viens, apporte de quoi parler, moi j'apporte de quoi manger. » |
| `wednesday_kids` | routine | Le mercredi, à l'orée avec Jeanne et Léon, de 14 h à 17 h (hors hiver, s'il ne pleut pas) | Jeanne: « Le mercredi, Inès nous apprend les oiseaux à l'orée. Elle siffle comme une mésange. Léon siffle comme une bouilloire. » |
| `with_barnabe` | routine | Le mardi et le jeudi, à la parcelle de coupe avec Barnabé, de 14 h à 17 h | Barnabé: « Le mardi et le jeudi après-midi, Inès vient voir ce que j'abats. Elle a toujours raison, c'est épuisant. » |
| `rain` | pluie | Les jours de pluie, l'après-midi, elle reste chez elle à dessiner ses cartes | Inès: « Quand il pleut, l'après-midi, je reste au sec et je dessine mes cartes. Le matin, non: la pluie, c'est quand le bois parle. » |
| `maps` | routine | Le lundi, le vendredi et le samedi, elle dessine ses cartes sur son banc, de 14 h à 17 h | Nour: « L'après-midi, Inès dessine des cartes sur son banc. Elle met des points d'interrogation là où elle n'est pas encore allée. » |
| `shopping` | routine | Le lundi et le jeudi, ses courses chez Odette de 17 h 30 à 18 h 30 | Odette: « Le lundi et le jeudi, à 5 h et demie, la garde forestière descend faire ses courses. Elle achète toujours les mêmes choses, dans le même ordre. » |
| `home` | maison | Chez elle, à la maison forestière, le reste du temps | Inès: « J'habite la maison forestière, au bout du chemin forestier. Toit rouge, bois cordé contre le mur. On ne peut pas la rater, et pourtant certains y arrivent. » |

#### Barnabé Tixier (`barnabe`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 18 h à 20 h | `village_square` | stand | anniversaire |
| 2 | `cuite` | tous | 6 h à 24 h | `charcoal_kiln` | work | jour: `cuite` |
| 3 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand | `barnabe_choir` |
| 4 | `sunday_quilles` | di | 15 h à 18 h | `skittles_alley` | play | sans pluie |
| 5 | `rain` | lu ma me je ve sa | 7 h à 17 h | `forge_inside` | work | pluie |
| 6 | `coupe` | lu ma me je ve sa | 7 h à 12 h | `forest_cut` | work |  |
| 7 | `lunch` | lu ma me je ve sa | 12 h à 13 h | `clearing_center` | stand |  |
| 8 | `with_ines` | ma je | 13 h à 17 h | `forest_cut` | work |  |
| 9 | `kiln` | lu me ve sa | 13 h à 17 h | `charcoal_kiln` | work |  |
| 10 | `delivery` | lu je | 17 h à 18 h | `forge_yard` | work |  |
| 11 | `home` | tous | 6 h à 24 h | `forge_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 13 de l'automne, son anniversaire: il chante sur la place de 18 h à 20 h | Madeleine: « Le 13 de l'automne, Barnabé a son anniversaire. Il chante sur la place à 6 h du soir. Si on applaudit, il recommence. » |
| `cuite` | jour | Les jours de cuite (8 à 10 de l'été, 3 à 5 de l'automne), il ne quitte pas la meule | Barnabé: « Trois jours de cuite l'été, du 8 au 10, et trois l'automne, du 3 au 5. Je dors à côté de la meule, comme on veille un malade. »<br>Madeleine: « Pendant les cuites, mon mari dort au bois. Je lui monte la soupe à midi, sinon il mangerait du charbon. » |
| `chorale` | apres | Depuis « La basse de la chorale »: le vendredi, il chante à l'église de 20 h à 21 h 30 | Armand: « Le vendredi, Barnabé chante la basse à la chorale. Les vitraux tremblent un peu. Marthe dit que c'est la première fois qu'ils servent. » |
| `sunday_quilles` | jour | Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas) | Paulin: « Le dimanche à 3 h, quilles devant le café: Barnabé, Mado, moi, et le petit qui ramasse. Mado gagne. Toujours. » |
| `rain` | pluie | Les jours de pluie, il aide à la forge de 7 h à 17 h | Barnabé: « Quand il pleut, le bois est trop glissant. Je descends à la forge tirer le soufflet pour Mado. Elle dit que je souffle mal. » |
| `coupe` | routine | Du lundi au samedi, il abat à la parcelle de coupe de 7 h à 12 h | Barnabé: « Le matin, j'abats à la parcelle de l'année. Ce qu'Inès a marqué, pas un arbre de plus. » |
| `lunch` | routine | Du lundi au samedi, il déjeune en chantant à la clairière, de 12 h à 13 h | Inès: « À midi, Barnabé chante à la clairière. Si tu entends une basse dans le bois, c'est lui. Les chevreuils le connaissent. » |
| `with_ines` | routine | Le mardi et le jeudi, à la parcelle de coupe avec Inès, de 13 h à 17 h | Inès: « Le mardi et le jeudi après-midi, je rejoins Barnabé à la parcelle. Je lui montre les arbres à garder, il fait la tête. » |
| `kiln` | routine | Le lundi, le mercredi, le vendredi et le samedi, il monte sa meule de 13 h à 17 h | Barnabé: « L'après-midi, je monte ma meule, bûche après bûche, comme une maison sans porte. » |
| `delivery` | routine | Le lundi et le jeudi, il livre le charbon à la forge de 17 h à 18 h | Madeleine: « Le lundi et le jeudi, à 5 h, Barnabé me descend le charbon. C'est le seul moment où il est plus noir que moi. » |
| `home` | maison | Chez lui, sous le toit de la forge, le reste du temps | Barnabé: « J'habite avec Mado, sous le toit de la forge. Le soir, j'ai les oreilles qui sonnent encore du marteau. » |

#### Madeleine Cazals (`mado`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 17 h | `skittles_alley` | play | anniversaire |
| 2 | `monday_farm` | lu | 8 h à 12 h | `farmyard` | work |  |
| 3 | `train` | sa | 10 h à 11 h | `train_stop` | wait_train |  |
| 4 | `sunday_quilles` | di | 15 h à 18 h | `skittles_alley` | play | sans pluie |
| 5 | `summer_siesta` | lu ma me je ve sa | 13 h 30 à 15 h | `forge_door` | home | été |
| 6 | `anvil` | lu ma me je ve sa | 7 h à 12 h, 13 h 30 à 18 h | `forge_yard` | work |  |
| 7 | `yard` | lu ma me je ve sa | 18 h à 19 h | `forge_yard` | stand |  |
| 8 | `home` | tous | 6 h à 24 h | `forge_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 17 de l'hiver, son anniversaire: la forge est éteinte, elle tient la place aux quilles de 14 h à 17 h | Barnabé: « Le 17 de l'hiver, c'est l'anniversaire de Mado. La forge est éteinte, elle défie tout le bourg aux quilles, neige ou pas. » |
| `monday_farm` | jour | Le lundi, au Pré-Long de 8 h à 12 h (roues et faux des Delmas) | écriteau `forge_sign`: « FORGE CAZALS. 7 h à 12 h, 13 h 30 à 18 h. Le lundi matin, la forgeronne est au Pré-Long. »<br>Margot: « Le lundi matin, Mado vient cercler nos roues et affûter les faux. Paulin lui prépare le café. Elle le boit comme on boit de l'eau. » |
| `train` | jour | Le samedi, au train de 10 h à 11 h pour ses barres de fer | Madeleine: « Le samedi à 10 h, je prends mes barres de fer au train. Firmin me regarde les soulever et il se tient le dos. » |
| `sunday_quilles` | jour | Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas) | Madeleine: « Le dimanche à 3 h, je gagne aux quilles. Viens perdre, c'est gratuit. » |
| `summer_siesta` | saison | L'été, la forge est trop chaude: elle rentre de 13 h 30 à 15 h | Madeleine: « L'été, de 1 h et demie à 3 h, je ferme. Entre le feu et le soleil, il faut choisir. » |
| `anvil` | routine | Du lundi au samedi, à l'enclume de 7 h à 12 h et de 13 h 30 à 18 h | écriteau `forge_sign`: « FORGE CAZALS. 7 h à 12 h, 13 h 30 à 18 h. Le lundi matin, la forgeronne est au Pré-Long. »<br>Basile: « Mado est à son enclume du matin au soir. Son père faisait pareil. Lui chantait moins faux. » |
| `yard` | routine | Du lundi au samedi, elle range la cour de la forge de 18 h à 19 h | Madeleine: « À 6 h du soir, je laisse le feu mourir et je range la cour. Le fer froid, ça se range mieux. » |
| `home` | maison | Chez elle, sous le toit de la forge, le reste du temps (déjeuner de 12 h à 13 h 30) | Madeleine: « De midi à 1 h et demie, je déjeune à la maison. Barnabé mange au bois, alors je mange pour deux. » |

#### Paulin Delmas (`paulin`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 7 h à 18 h | `field_high_01` | work | anniversaire |
| 2 | `threshing` | tous | 6 h à 18 h | `threshing_floor` | work | jour: `threshing` |
| 3 | `threshing` | tous | 19 h à 22 h | `farmyard` | host | jour: `threshing` |
| 4 | `harvest` | tous | 6 h à 20 h | `field_high_01` | work | jour: `harvest` |
| 5 | `weighing` | sa | 9 h à 10 h | `train_stop` | work | décision `mouture:weighing` |
| 6 | `watch_mill` | je | 14 h à 16 h | `mill_door` | stand | décision `mouture:watch` |
| 7 | `train` | sa | 9 h à 11 h | `train_stop` | work | dès le jour 16 |
| 8 | `quilles` | di | 15 h à 18 h | `skittles_alley` | play | sans pluie |
| 9 | `sunday_home` | di | 7 h à 15 h | `farm_door` | home |  |
| 10 | `milking` | tous | 6 h à 7 h, 18 h à 19 h | `barn_door` | work |  |
| 11 | `rain` | lu ma me je ve sa | 7 h à 12 h, 13 h 30 à 18 h | `barn_door` | work | pluie |
| 12 | `winter` | lu ma me je ve sa | 7 h à 12 h, 13 h 30 à 18 h | `barn_door` | work | hiver |
| 13 | `field` | lu ma me je ve sa | 7 h à 12 h, 13 h 30 à 18 h | `field_high_01` | work |  |
| 14 | `lunch` | lu ma me je ve sa | 12 h à 13 h 30 | `farmyard` | stand |  |
| 15 | `home` | tous | 6 h à 24 h | `farm_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 20 du printemps, son anniversaire: il ne quitte pas son champ, Margot lui porte un gâteau à midi | Léon: « Le 20 du printemps, c'est l'anniversaire de papa. Il travaille quand même. Maman lui porte un gâteau au champ, il fait semblant de râler. » |
| `threshing` | jour | Le 19 de l'été, battage dans la cour de 6 h à 18 h, puis repas de moisson jusqu'à 22 h | Margot: « Le 19 de l'été, on bat le blé dans la cour, et le soir, repas de moisson. Tout le bourg vient, même ceux qui n'ont rien fait. » |
| `harvest` | jour | Le 17 et le 18 de l'été, moisson au champ du Haut de 6 h à 20 h | Paulin: « Moisson le 17 et le 18 de l'été, battage le 19. Ces trois jours-là, je ne connais plus personne. » |
| `weighing` | apres | Depuis la pesée publique: le samedi, il pèse son blé avec Berthe à la bascule de la halte, de 9 h à 10 h | Paulin: « Le samedi à 9 h, on pèse mon blé sur la bascule de Firmin, la meunière et moi. Devant témoins. Elle a toujours eu raison, c'est le pire. » |
| `watch_mill` | apres | Depuis la mouture à façon: le jeudi, il regarde moudre son blé au moulin, de 14 h à 16 h | Berthe: « Le jeudi après-midi, Paulin vient regarder sa farine sortir de ma meule. Il ne dit rien, il compte les sacs. Je lui sers un café, il le boit. » |
| `train` | jour | Le samedi, il charge ses sacs au train de 9 h à 11 h | Paulin: « Le samedi, je monte mes sacs au train à 9 h: les pommes de terre pour la coopérative, et mon blé pour le moulin de la ville. »<br>Berthe: « Le samedi, Paulin envoie son blé moudre en ville. Comme si ma meule était faite pour les cailloux. » |
| `quilles` | jour | Le dimanche, les quilles devant le café de 15 h à 18 h (s'il ne pleut pas) | Madeleine: « Le dimanche, Paulin joue aux quilles avec nous devant le café. Il perd en silence, c'est sa façon d'être poli. » |
| `sunday_home` | jour | Le dimanche matin, il reste chez lui | Margot: « Le dimanche matin, Paulin dort. C'est son seul péché, et il ne le confesse à personne. » |
| `milking` | routine | Tous les jours, la traite à l'étable de 6 h à 7 h et de 18 h à 19 h | Paulin: « 6 h et 6 h du soir, la traite. Les vaches n'ont pas de dimanche, alors moi non plus, à moitié. » |
| `rain` | pluie | Les jours de pluie, il répare à l'étable de 7 h à 12 h et de 13 h 30 à 18 h | Margot: « Quand il pleut, Paulin répare tout ce qui ne marche pas dans la grange. Et ce qui marche aussi, pour être sûr. » |
| `winter` | saison | L'hiver, il travaille à la grange de 7 h à 12 h et de 13 h 30 à 18 h | Paulin: « L'hiver, la terre dort. Moi, je suis à la grange: les outils, les sacs, les semences. » |
| `field` | routine | Du printemps à l'automne, au champ du Haut de 7 h à 12 h et de 13 h 30 à 18 h | Paulin: « Au printemps je plante, l'été je moissonne, à l'automne j'arrache. Tu me trouveras au champ du Haut, de l'autre côté de la voie. »<br>Léon: « Papa est au champ du Haut toute la journée. Il dit bonjour aux épis, je l'ai entendu. » |
| `lunch` | routine | Du lundi au samedi, repas dans la cour de la ferme de 12 h à 13 h 30 | Paulin: « À midi, on mange dans la cour, sous le noyer. Tu peux venir, mais on ne parle pas la bouche pleine, et on a toujours la bouche pleine. » |
| `home` | maison | Chez lui, au logis de la ferme, le soir | Paulin: « Le soir, je suis à la ferme, après la menuiserie. La maison qui tourne le dos à la route: elle regarde le soleil, pas les passants. » |

#### Margot Delmas (`margot`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 15 h à 18 h | `farmyard` | host | anniversaire |
| 2 | `threshing` | tous | 9 h à 22 h | `farmyard` | host | jour: `threshing` |
| 3 | `harvest` | tous | 7 h à 18 h | `field_high_01` | work | jour: `harvest` |
| 4 | `laundry` | lu | 9 h à 11 h | `washhouse` | work |  |
| 5 | `butter` | ma ve | 9 h à 10 h | `grocery_door` | work |  |
| 6 | `mill_thursday` | je | 14 h à 15 h | `mill_door` | stand | `mill_running` |
| 7 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand |  |
| 8 | `sunday_quilles` | di | 15 h à 18 h | `skittles_alley` | stand | sans pluie |
| 9 | `chorale` | ve | 20 h à 21 h 30 | `church_nave` | stand |  |
| 10 | `milking` | tous | 6 h à 7 h, 18 h à 19 h | `barn_door` | work |  |
| 11 | `poultry` | lu ma me je ve sa | 7 h à 9 h | `farmyard` | work |  |
| 12 | `garden` | lu ma me je ve sa | 10 h à 12 h, 15 h à 18 h | `farm_garden` | work | sans pluie |
| 13 | `lunch` | lu ma me je ve sa | 12 h à 13 h 30 | `farmyard` | stand |  |
| 14 | `home` | tous | 6 h à 24 h | `farm_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 19 de l'automne, son anniversaire: un goûter dans la cour de la ferme, de 15 h à 18 h | Léon: « Le 19 de l'automne, c'est l'anniversaire de maman. Goûter dans la cour à 3 h. Elle fait la tarte, papa fait la vaisselle, c'est la règle. » |
| `threshing` | jour | Le 19 de l'été, elle prépare puis sert le repas de moisson dans la cour, de 9 h à 22 h | Margot: « Le 19 de l'été, je fais à manger pour trente. Si tu viens, viens avec des bras, pas avec des fourchettes. » |
| `harvest` | jour | Le 17 et le 18 de l'été, moisson au champ du Haut de 7 h à 18 h | Margot: « Pendant la moisson, je lie les gerbes derrière Paulin. Il fauche droit, je lie droit, c'est notre façon de nous dire des choses. » |
| `laundry` | routine | Le lundi, la lessive au lavoir de 9 h à 11 h (avec Colette) | Colette: « Le lundi à 9 h, lessive au lavoir avec Margot. On frotte, on rince, et on refait le bourg entier. Le linge sort propre, le bourg un peu moins. » |
| `butter` | routine | Le mardi et le vendredi, elle livre le beurre à Odette de 9 h à 10 h | Odette: « Le mardi et le vendredi à 9 h, Margot m'apporte son beurre. Le meilleur de la vallée, et elle le sait, ce qui le rend plus cher. » |
| `mill_thursday` | routine | Le jeudi, de 14 h à 15 h, elle prend sa farine au moulin (sans le dire à Paulin; moulin remis en marche) | Berthe: « Le jeudi, Margot vient prendre sa farine au moulin. Elle dit que c'est pour les crêpes. Son mari ne sait pas. Il ne veut pas savoir. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30, avec Léon | Martial: « Le dimanche, Margot vient à la messe avec le petit. Lui s'endort au troisième rang. Je fais le sermon plus court, par charité. » |
| `sunday_quilles` | jour | Le dimanche, elle compte les points des quilles devant le café, de 15 h à 18 h (s'il ne pleut pas) | Margot: « Le dimanche, je compte les points aux quilles. Je triche pour Paulin, Mado le sait, elle gagne quand même. » |
| `chorale` | routine | Le vendredi, la chorale à l'église de 20 h à 21 h 30 | Armand: « Le vendredi, Margot remonte toute la route pour la chorale, même en hiver. Elle a une voix qui porte jusqu'à la ferme. » |
| `milking` | routine | Tous les jours, la traite à l'étable de 6 h à 7 h et de 18 h à 19 h | Margot: « La traite, c'est 6 h et 6 h du soir, avec Paulin. Les vaches préfèrent mes mains, mais il ne faut pas le lui dire. » |
| `poultry` | routine | Du lundi au samedi, sa basse-cour dans la cour de 7 h à 9 h | Margot: « De 7 h à 9 h, je m'occupe de mes poules. Elles sont plus bavardes que les tiennes, j'en suis sûre. » |
| `garden` | routine | Au courtil de la ferme de 10 h à 12 h et de 15 h à 18 h (s'il ne pleut pas) | Margot: « Le courtil, devant la ferme, c'est le mien. Les champs, c'est Paulin. Mes carottes sont plus droites que ses sillons. » |
| `lunch` | routine | Du lundi au samedi, repas dans la cour de 12 h à 13 h 30 | Paulin: « À midi, Margot met la table dans la cour, même quand il menace de pleuvoir. Le noyer protège, elle dit. » |
| `home` | maison | Chez elle, au logis de la ferme, le reste du temps | Margot: « Le soir, je suis à la ferme. Les jours de pluie aussi: j'ai toujours quelque chose sur le feu. » |

#### Léon Delmas (`leon`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 18 h | `quay_bench` | play | anniversaire |
| 2 | `harvest` | tous | 7 h à 18 h | `field_high_01` | work | jour: `harvest` |
| 3 | `run` | lu ma je ve | 7 h 40 à 8 h | `forge_yard` | play | jour de classe |
| 4 | `recess` | lu ma je ve | 10 h à 10 h 20, 14 h 30 à 14 h 50 | `school_yard` | play | jour de classe |
| 5 | `school` | lu ma je ve | 8 h à 16 h 30 | `school_gate` | absent | jour de classe |
| 6 | `after_school` | lu ma je ve | 16 h 30 à 18 h | `well_shelter` | play | jour de classe; pluie |
| 7 | `after_school` | lu ma je ve | 16 h 30 à 18 h | `village_square` | play | jour de classe |
| 8 | `hide` | me | 14 h à 17 h | `bird_hide` | play | sans pluie; décision `cabane:shared` |
| 9 | `affut` | me | 14 h à 17 h | `pasture_bank` | play | sans pluie; décision `cabane:jeanne` |
| 10 | `wednesday_birds` | me | 14 h à 17 h | `forest_edge_path` | play | sans pluie; printemps, été, automne |
| 11 | `train` | sa | 10 h à 16 h | `train_stop` | wait_train |  |
| 12 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand |  |
| 13 | `quilles` | di | 15 h à 18 h | `skittles_alley` | play | sans pluie |
| 14 | `summer_fishing` | tous | 14 h à 18 h | `pasture_bank` | play | été |
| 15 | `summer_field` | lu ma me je ve sa | 7 h à 12 h | `field_high_01` | work | été |
| 16 | `milking` | tous | 18 h à 19 h | `barn_door` | work |  |
| 17 | `free_days` | lu ma me je ve | 8 h à 12 h | `farmyard` | work |  |
| 18 | `home` | tous | 6 h à 24 h | `farm_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 3 de l'été, son anniversaire: il passe l'après-midi sur le banc du quai, de 14 h à 18 h | Jeanne: « Le 3 de l'été, c'est l'anniversaire de Léon. Il demande à Firmin de rester au quai tout l'après-midi. Il n'y a même pas de train. » |
| `harvest` | jour | Pendant la moisson (17 au 19 de l'été), il aide de 7 h à 18 h | Léon: « Pendant la moisson, je ramasse les épis tombés. Papa dit que c'est le travail le plus important. Je crois qu'il dit ça pour que je ne parte pas. » |
| `run` | routine | Les jours de classe, il passe en courant devant la forge de 7 h 40 à 8 h | Madeleine: « Les jours d'école, le petit Delmas passe devant ma forge à 7 h 40, en courant. Je pourrais régler l'enclume sur lui. » |
| `recess` | routine | Les jours de classe, récréation dans la cour à 10 h et à 14 h 30 (20 minutes) | Léon: « À la récré, je gagne au loup. Jeanne dit que je triche. C'est faux: je cours. » |
| `school` | routine | Les jours de classe, à l'école de 8 h à 16 h 30 | écriteau `school_sign`: « École de la Halte. Classe le lundi, le mardi, le jeudi et le vendredi, de 8 h 30 à 16 h 30. »<br>Armand: « Léon est mon élève le plus ponctuel. Il arrive à 8 h moins cinq, essoufflé, avec une chaussure délacée. » |
| `after_school` | routine | Les jours de classe, sur la place de 16 h 30 à 18 h (sous le toit du puits s'il pleut) | Jeanne: « Après l'école, Léon et moi, on joue sur la place jusqu'à 6 h. S'il pleut, sous le toit du puits. Il rentre traire avec son père. » |
| `hide` | apres | Depuis « La cabane des oiseaux », à deux: le mercredi, à la cabane avec Jeanne de 14 h à 17 h | Jeanne: « Le mercredi après-midi, Léon et moi, on est à la cabane de la mare. On a un cahier pour deux. Il écrit mal, je dessine bien. » |
| `affut` | apres | Depuis « La cabane des oiseaux », pour Jeanne: le mercredi, à son affût de la berge de 14 h à 17 h | Léon: « Le mercredi, je suis à mon affût, au bout de la pâture. La cabane, c'est pour dessiner. Mon affût, c'est pour guetter. Ce n'est pas pareil. » |
| `wednesday_birds` | routine | Le mercredi, à l'orée avec Jeanne et Inès de 14 h à 17 h (hors hiver, s'il ne pleut pas) | Léon: « Le mercredi après-midi, Inès nous apprend les oiseaux à l'orée. J'en ai vu plus que Jeanne. Elle dit que les corbeaux ne comptent pas. » |
| `train` | jour | Le samedi, il regarde le train depuis le quai de 10 h à 16 h | Firmin: « Le samedi, le petit Delmas est sur le quai à 10 h. Il veut conduire la locomotive. Je lui ai dit de commencer par la draisine. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30 (au troisième rang, souvent endormi) | Léon: « Le dimanche, maman m'emmène à la messe. Je m'assois au troisième rang, c'est là qu'on dort le mieux. » |
| `quilles` | jour | Le dimanche, il ramasse les quilles devant le café de 15 h à 18 h (s'il ne pleut pas) | Léon: « Le dimanche, je ramasse les quilles. Un jour, Mado me laissera lancer. Elle dit que c'est quand j'aurai de la moustache. » |
| `summer_fishing` | saison | L'été, il pêche au bout de la pâture de 14 h à 18 h | Léon: « L'été, l'après-midi, je pêche au bout de la pâture. Les loches, je les attrape à la main. Enfin, presque. » |
| `summer_field` | saison | L'été, il aide au champ du Haut de 7 h à 12 h | Paulin: « L'été, le petit m'aide le matin au champ. Il ramasse plus de sauterelles que d'épis. » |
| `milking` | routine | Tous les jours, il aide à la traite de 18 h à 19 h | Léon: « À 6 h du soir, j'aide à traire. Marguerite me connaît, elle me donne un coup de queue pour dire bonjour. » |
| `free_days` | routine | Les jours sans classe (mercredi, vacances), à la ferme le matin de 8 h à 12 h | Margot: « Les jours sans école, Léon est à la ferme le matin. Il nourrit les poules, et les poules lui apprennent la patience. » |
| `home` | maison | Chez lui, au logis de la ferme, le reste du temps | Léon: « J'habite la ferme, au bout de la route. Ma chambre donne sur l'étable: ça sent la vache, mais il fait chaud. » |

#### Ambroise Pélissier (`ambroise`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 14 h à 18 h | `station_door` | stand | anniversaire |
| 2 | `clocks_together` | lu ma me je ve sa | 8 h à 8 h 15 | `quay_bell` | stand | `clocks_reconciled` |
| 3 | `clockcheck` | lu ma me je ve sa | 8 h à 8 h 10 | `station_door` | stand | sans `clocks_reconciled` |
| 4 | `manille` | me | 20 h à 22 h | `cafe_counter` | stand | `clocks_reconciled`; pluie |
| 5 | `manille` | me | 20 h à 22 h | `cafe_terrace` | stand | `clocks_reconciled` |
| 6 | `monday_forest` | lu | 9 h à 12 h | `forest_edge_path` | stand | sans pluie |
| 7 | `mass` | di | 10 h 30 à 11 h 30 | `church_nave` | stand |  |
| 8 | `shop` | ma me je ve sa | 8 h 15 à 12 h, 14 h à 18 h | `rail_cottage_west_window` | work |  |
| 9 | `newspaper` | tous | 18 h à 19 h | `quay_bench` | stand | sans pluie |
| 10 | `home` | tous | 6 h à 24 h | `rail_cottage_west_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 11 de l'été, son anniversaire: il remonte les horloges du bourg de 14 h à 18 h, et soupire devant celle de la halte | Odette: « Le 11 de l'été, Ambroise a son anniversaire. Il fait le tour du bourg pour remonter les horloges, et il s'arrête devant celle de la halte en soupirant. » |
| `clocks_together` | apres | Depuis la réconciliation: à 8 h, il règle la pendule avec Firmin à la cloche du quai | Firmin: « À 8 h, Ambroise vient régler la pendule avec moi. Il dit qu'elle retarde. Je dis que sa montre avance. On a raison l'un et l'autre, ça nous suffit. » |
| `clockcheck` | routine | Du lundi au samedi, de 8 h à 8 h 10, il compare sa montre à la pendule de la halte et soupire | Firmin: « Tous les matins à 8 h, l'horloger vient regarder ma pendule depuis la porte. Il soupire et il repart. Trente ans qu'il soupire. »<br>Ambroise: « À 8 h, je vais voir la pendule de la halte. Elle retarde d'une minute. Depuis trente ans. Quelqu'un doit bien la surveiller. » |
| `manille` | apres | Depuis la réconciliation: le mercredi, la manille au café de 20 h à 22 h | Basile: « Ambroise joue à la manille avec nous, maintenant. Il compte les points à la seconde près. Firmin conteste à la minute près. » |
| `monday_forest` | jour | Le lundi, atelier fermé: il cueille à la lisière de 9 h à 12 h (s'il ne pleut pas) | écriteau `clockmaker_sign`: « A. PÉLISSIER. Montres, pendules, souliers. 8 h 15 à 12 h, 14 h à 18 h. Fermé le lundi. »<br>Ambroise: « Le lundi, je ferme. Je vais cueillir à la lisière: les champignons ne sont jamais en avance, eux. » |
| `mass` | jour | Le dimanche, la messe de 10 h 30 à 11 h 30 (il vérifie que l'abbé commence à l'heure) | Martial: « Ambroise vient à la messe le dimanche. Il sort sa montre à 10 h 30 pile. Si je suis en retard, il la secoue. » |
| `shop` | routine | Du mardi au samedi, à l'établi derrière sa fenêtre de 8 h 15 à 12 h et de 14 h à 18 h | écriteau `clockmaker_sign`: « A. PÉLISSIER. Montres, pendules, souliers. 8 h 15 à 12 h, 14 h à 18 h. Fermé le lundi. »<br>Solange: « L'horloger est derrière sa fenêtre du matin au soir, la loupe à l'œil. Il me répare mes ciseaux; je lui coupe ce qu'il lui reste de cheveux. » |
| `newspaper` | routine | Le soir, il lit le journal sur le banc du quai de 18 h à 19 h, quand Firmin est rentré (s'il ne pleut pas) | Lucie: « À 6 h du soir, Firmin quitte le quai et Ambroise s'assoit sur son banc avec le journal du samedi. Ils ne s'y croisent jamais. Exprès. » |
| `home` | maison | Chez lui, à la maison de cheminots de l'ouest, le reste du temps | Ambroise: « J'habite la maison de cheminots de l'ouest: la compagnie me l'a laissée. Quarante pendules, qui sonnent toutes à la même seconde. Sauf une, pour le principe. » |

#### Nour Belkacem (`nour`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 12 h à 15 h | `grocery_terrace` | stand | anniversaire |
| 2 | `duo_visit` | je | 8 h à 9 h | `chicken_coop` | work | `nour_visits` |
| 3 | `rounds` | lu me ve | 8 h à 12 h | `offstage` | absent |  |
| 4 | `farm` | ma | 8 h à 12 h | `barn_door` | work |  |
| 5 | `consult_morning` | sa | 8 h à 12 h | `hamlet_house_a_door` | serve |  |
| 6 | `consult_morning` | je | 9 h à 12 h | `hamlet_house_a_door` | serve |  |
| 7 | `yard` | tous | 7 h à 8 h | `vet_yard` | work |  |
| 8 | `lunch` | lu ma me je ve sa | 12 h à 13 h | `grocery_table` | stand | pluie |
| 9 | `lunch` | lu ma me je ve sa | 12 h à 13 h | `grocery_terrace` | stand |  |
| 10 | `consult` | lu ma me je ve sa | 14 h à 17 h | `hamlet_house_a_door` | serve |  |
| 11 | `walk` | lu ma me je ve sa | 17 h à 18 h | `riverbank` | stand | sans pluie |
| 12 | `sunday_ines` | di | 14 h à 17 h | `forester_bench` | stand | sans pluie |
| 13 | `home` | tous | 6 h à 24 h | `hamlet_house_a_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 7 du printemps, son anniversaire: pas de tournée, elle déjeune longtemps chez Odette, de 12 h à 15 h | Inès: « Le 7 du printemps, Nour a son anniversaire. Elle s'accorde trois heures de déjeuner chez Odette. Le reste de l'année, elle mange debout. » |
| `duo_visit` | apres | Depuis « La visite de Nour »: le jeudi, de 8 h à 9 h, elle passe voir tes bêtes | Nour: « Le jeudi à 8 h, je passe voir tes poules, et ta chèvre si tu en as une. Ne range rien, je veux voir comment elles vivent. » |
| `rounds` | routine | Le lundi, le mercredi et le vendredi, tournée des hameaux à vélo de 8 h à 12 h | Nour: « Lundi, mercredi, vendredi: les hameaux, à vélo. Je pars à 8 h par la route de l'est, en même temps que Lucie. On fait la course jusqu'au virage. »<br>Lucie: « Le lundi, le mercredi et le vendredi, Nour part avec moi à 8 h. Elle me bat à la côte. Je la bats à la descente. » |
| `farm` | routine | Le mardi, à l'étable de la ferme de 8 h à 12 h | Margot: « Le mardi matin, la vétérinaire vient voir nos vaches. Elle leur parle en arabe, elles adorent. » |
| `consult_morning` | routine | Le jeudi et le samedi, consultations au cabinet de 9 h à 12 h (dès 8 h le samedi) | écriteau `vet_sign`: « N. BELKACEM, VÉTÉRINAIRE. Consultations de 14 h à 17 h du lundi au samedi, et le jeudi et le samedi matin. En cas d'urgence, sonnez fort. »<br>Nour: « Le jeudi et le samedi matin, je reçois au cabinet. Les autres matins, je suis sur les routes. » |
| `yard` | routine | Tous les jours, elle soigne ses pensionnaires dans l'enclos de 7 h à 8 h | Nour: « À 7 h, je soigne mes pensionnaires dans l'enclos. En ce moment: un hérisson grognon et un geai qui imite la sonnette. » |
| `lunch` | routine | Du lundi au samedi, elle déjeune en pension chez Odette de 12 h à 13 h (sur la terrasse, à l'intérieur s'il pleut) | Odette: « À midi, la vétérinaire déjeune chez moi, en pension. Elle mange vite et elle parle vite, je n'ai jamais le dernier mot. » |
| `consult` | routine | Du lundi au samedi, consultations au cabinet de 14 h à 17 h | écriteau `vet_sign`: « N. BELKACEM, VÉTÉRINAIRE. Consultations de 14 h à 17 h du lundi au samedi, et le jeudi et le samedi matin. En cas d'urgence, sonnez fort. » |
| `walk` | routine | Du lundi au samedi, elle se promène sur la berge de 17 h à 18 h (s'il ne pleut pas) | Nour: « À 5 h, je marche une heure sur la berge. Sinon je ne vois que des étables. C'est joli, une étable, mais pas toute la journée. » |
| `sunday_ines` | jour | Le dimanche, thé chez Inès de 14 h à 17 h (s'il ne pleut pas) | Inès: « Le dimanche après-midi, Nour monte prendre le thé chez moi. Elle parle pour deux, ça m'arrange. » |
| `market` | marche | Le dimanche, une fois dans la matinée, elle passe à l'étal du marché | Nour: « Le dimanche, je dors jusqu'à 10 h, puis je viens à ton étal. S'il reste du fromage, la semaine est réussie. » |
| `home` | maison | Chez elle, la première maison du hameau, le reste du temps | Nour: « J'habite la première maison du hameau, après la menuiserie. La plaque de l'ancien notaire est encore à la porte: on vient pour un testament, on repart avec un vermifuge. » |

#### Colette Lafon (`colette`)

| # | Habitude | Jours | Heures | Point | Activité | Conditions |
|---|---|---|---|---|---|---|
| 1 | `birthday` | tous | 20 h à 23 h | `cafe_terrace` | host | anniversaire |
| 2 | `tuesday_garden` | ma | 9 h à 12 h | `shared_garden_plot` | work | sans pluie |
| 3 | `tuesday_accordion` | ma | 20 h à 21 h | `cafe_terrace` | stand | sans pluie |
| 4 | `tuesday_home` | ma | 6 h à 24 h | `cafe_door` | home |  |
| 5 | `laundry` | lu | 9 h à 11 h | `washhouse` | work |  |
| 6 | `laundry` | lu | 7 h à 9 h | `cafe_door` | home |  |
| 7 | `manille` | me | 20 h à 22 h | `cafe_counter` | serve | pluie |
| 8 | `manille` | me | 20 h à 22 h | `cafe_terrace` | serve |  |
| 9 | `sunday_terrace` | di | 11 h 30 à 14 h, 15 h à 19 h | `cafe_terrace` | serve | sans pluie |
| 10 | `sunday_rest` | di | 6 h à 11 h 30 | `cafe_door` | home |  |
| 11 | `summer_terrace` | tous | 18 h à 23 h | `cafe_terrace` | serve | été; sans pluie |
| 12 | `counter` | tous | 7 h à 12 h, 16 h à 23 h | `cafe_counter` | serve |  |
| 13 | `home` | tous | 6 h à 24 h | `cafe_door` | home |  |

| Habitude | Sorte | Au carnet | Comment l'apprendre (en plus de la voir) |
|---|---|---|---|
| `birthday` | anniv | Le 14 du printemps, son anniversaire: elle joue de l'accordéon sur la terrasse de 20 h à 23 h | Odette: « Le 14 du printemps, Colette a son anniversaire. Elle sort l'accordéon de son oncle sur la terrasse. Je ne danse pas, mais je tape du pied. » |
| `tuesday_garden` | jour | Le mardi, café fermé: elle soigne son carré aux jardins de la Rive, de 9 h à 12 h | écriteau `cafe_sign`: « CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi. »<br>Colette: « Le mardi, je ferme. Je bêche mon carré aux jardins de la Rive, et je ne sers personne, pas même un verre d'eau. » |
| `tuesday_accordion` | jour | Le mardi soir, elle s'exerce à l'accordéon sur la terrasse, de 20 h à 21 h (s'il ne pleut pas) | Basile: « Le mardi soir, Colette répète à l'accordéon sur sa terrasse. Elle se trompe toujours au même endroit, c'est comme une horloge. » |
| `tuesday_home` | jour | Le mardi, chez elle le reste du jour | Firmin: « Le mardi, le café est fermé. Si tu as soif, Odette a de l'eau, et moi j'ai un banc. » |
| `laundry` | routine | Le lundi, la lessive au lavoir de 9 h à 11 h (avec Margot); le café ouvre à 11 h | Margot: « Le lundi matin, Colette lave ses nappes au lavoir avec moi. Elle chante, je frotte. Ou le contraire. »<br>écriteau `cafe_sign`: « Le lundi, le café ouvre à 11 h (jour de lessive). » |
| `manille` | routine | Le mercredi soir, elle sert la manille sur la terrasse (au comptoir s'il pleut), de 20 h à 22 h | Colette: « Le mercredi soir, Firmin, Basile et l'abbé jouent à la manille chez moi. Je sers, je compte, et je ne dis jamais qui triche. » |
| `sunday_terrace` | jour | Le dimanche, elle sert en terrasse après la messe (11 h 30 à 14 h) et pendant les quilles (15 h à 19 h) | Colette: « Le dimanche, j'ouvre à la sortie de la messe. L'après-midi, je sers les joueurs de quilles. Les perdants paient, c'est la tradition. » |
| `sunday_rest` | jour | Le dimanche matin, café fermé jusqu'à la sortie de la messe | écriteau `cafe_sign`: « CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi. » |
| `summer_terrace` | saison | L'été, elle sert en terrasse de 18 h à 23 h (s'il ne pleut pas) | Colette: « L'été, le soir, je sors les tables sur la terrasse. Le café se remplit quand le soleil se couche. » |
| `counter` | routine | Au comptoir de 7 h à 12 h et de 16 h à 23 h (le lundi dès 11 h) | écriteau `cafe_sign`: « CAFÉ DE LA CÔTE. 7 h à 12 h et 16 h à 23 h. Le dimanche, dès la sortie de la messe. Fermé le mardi. »<br>Colette: « Le café ouvre à 7 h pour ceux qui partent tôt et ferme à 23 h pour ceux qui rentrent tard. Entre midi et 4 h, je dors un peu. » |
| `home` | maison | Chez elle, à l'étage du café, le reste du temps | Colette: « J'habite au-dessus du café, la fenêtre sur le carrefour. Je m'endors avec le bruit des derniers verres. » |

### 3.3 Ce que donnent ces plannings

Contrôles du script: aucun trou (chaque habitant a une entrée pour chaque tranche de 10 minutes de 6 h à 24 h, chaque jour, chaque saison, chaque temps, avec et sans les drapeaux des quêtes), aucune entrée jamais atteinte, chaque point connu, chaque habitude apprenable par au moins une réplique ou un écriteau, aucun tiret interdit ni tournure genrée.

| Habitant | Habitudes | Dont visibles | Heures visibles par jour (moyenne de l'année, temps tirés) | Apprises par dialogue | Par écriteau |
|---|---|---|---|---|---|
| Firmin Lacombe | 10 | 9 | 11.3 | 10 | 0 |
| Odette Ferrand | 11 | 8 | 12.5 | 11 | 4 |
| Basile Cornu | 11 | 9 | 9.6 | 11 | 0 |
| Jeanne Ribot | 15 | 13 | 9.4 | 15 | 1 |
| Achille Pradel | 10 | 8 | 8.1 | 10 | 3 |
| Solange Mérigot | 10 | 9 | 7.3 | 10 | 3 |
| Lucie Arnaud | 13 | 10 | 4.8 | 13 | 0 |
| Armand Castagné | 12 | 10 | 3.3 | 11 | 4 |
| Berthe Lavergne | 15 | 13 | 6.8 | 15 | 0 |
| Martial Roques | 12 | 9 | 5.5 | 12 | 1 |
| Marthe Bousquet | 13 | 12 | 9.1 | 13 | 1 |
| Honorine Valade | 14 | 13 | 7.9 | 14 | 0 |
| Inès Garrigue | 13 | 11 | 8.2 | 13 | 0 |
| Barnabé Tixier | 11 | 10 | 9.7 | 11 | 0 |
| Madeleine Cazals | 8 | 6 | 8.1 | 8 | 2 |
| Paulin Delmas | 14 | 12 | 11.0 | 14 | 0 |
| Margot Delmas | 14 | 13 | 9.0 | 14 | 0 |
| Léon Delmas | 17 | 15 | 6.3 | 17 | 1 |
| Ambroise Pélissier | 9 | 8 | 6.0 | 9 | 2 |
| Nour Belkacem | 12 | 9 | 6.4 | 11 | 2 |
| Colette Lafon | 11 | 8 | 9.8 | 10 | 4 |
| **Total** | **255** | | | | |

Lecture: entre 3 et 12 heures de jeu visibles par jour selon le métier (Armand est en classe, Lucie en tournée: on les guette à des heures précises, c'est ce qui rend leur page intéressante). Chaque habitant a entre 8 et 17 habitudes.

## 4. Le carnet: la page « Voisins »

### 4.1 Le principe

Un onglet nouveau du carnet, « Voisins » (à côté de Quêtes, Courrier, Sac, Souvenirs, Besoins), commun aux deux joueurs. Une page par habitant rencontré ou présenté. Le planning de chacun s'y écrit au crayon, habitude par habitude, à mesure que le duo l'apprend. On n'y lit jamais ce qu'on n'a pas appris.

### 4.2 La page d'un habitant

| Zone | Contenu | Quand elle se remplit |
|---|---|---|
| En-tête | portrait (crayonné, il se colore à mesure que les habitudes sont connues: 0 % gris, 100 % aquarelle), nom, métier, âge (« 64 ans »), logis (« derrière la voie ») | à la rencontre (le logis peut venir de la présentation de Lucie) |
| Amitié | cinq lanternes, le nom du niveau (« Voisinage »), la lanterne suivante qui se remplit (section 6) | toujours |
| Anniversaire | « 6 de l'automne (jeudi) », ou « ? » | quand une réplique le dit ou quand on voit son habitude d'anniversaire |
| Sa semaine | une grille: 7 lignes (lundi à dimanche), 6 colonnes (6 h à 9 h, 9 h à 12 h, 12 h à 14 h, 14 h à 18 h, 18 h à 21 h, 21 h à 24 h). Une case connue montre le pictogramme du lieu et son nom court (« Quai », « Café ») | habitude par habitude (une habitude remplit toutes ses cases d'un coup; une case peut porter deux habitudes, la plus longue en grand, l'autre en petit: la récréation de 10 h dans la case de la classe) |
| Habitudes particulières | une ligne par variante: « Sous la pluie: … », « L'été: … », « Le premier dimanche de la saison: … », « Moisson: … », « Anniversaire: … », « Depuis … (quête): … » | idem |
| Ses goûts | « Adore », « Aime », « N'aime pas »: les objets découverts | au premier cadeau de cet objet, ou par une réplique |
| Son histoire | les étapes faites (titres et date de jeu), l'étape en cours, puis « Étape suivante: quand vous serez plus proches » | |
| Maintenant | « Maintenant (mardi, 14 h 10): sans doute à la cour de la forge », ou « Tu ne sais pas encore où trouver Mado à cette heure-ci. » | calcul sur les seules habitudes connues (4.7) |
| Indice | « Habitudes: 7 sur 11 » et une petite jauge de crayon | toujours |

### 4.3 Règle d'observation (vu)

Une habitude H d'un habitant V devient connue pour le duo quand l'une de ces situations dure 2 secondes réelles, chez l'un ou l'autre joueur:

| Situation | Conditions |
|---|---|
| V est visible à son poste | l'entrée en cours de V appartient à H; V est arrivé (à moins de 2 m du point, pas en marche); son activité n'est ni `home` ni `absent`; un joueur est à moins de 10 m (6 m de 21 h à 24 h, l'obscurité); le joueur et V sont du même côté d'un mur: tous deux dehors, ou dans le même intérieur; les points « fenêtre » (vitrine de Solange, fenêtre d'Honorine, établi d'Ambroise, corde des cloches porte ouverte) se voient du dehors |
| V entre ou sort | pour une habitude chez soi, dedans ou hors de la carte (`home`, `absent`): un joueur à moins de 10 m voit V franchir sa porte ou la sortie (`village_exit`) dans les 5 minutes de jeu qui suivent le début ou la fin de l'habitude |
| On lui parle sur place | une conversation avec V pendant H (même si V marche encore) |

La condition « 2 secondes » évite les découvertes en traversant l'écran à toute allure; la distance de 10 m garantit qu'il est à l'écran à tous les zooms (carnet: 6 m de demi-hauteur au zoom serré, l'habitant de 1,74 m reste en vue). Il n'y a pas de test de ligne de vue: un mur ou un houppier entre les deux n'empêche rien (simplicité, coût nul sur le PC de référence); la règle du même côté d'un mur évite les découvertes à travers une façade.

**Partage.** Toute découverte va au carnet commun. Notification chez les deux (3 s, sans son fort: un crayon qui gratte, `pencil-note`): « Carnet: Achille pêche au gué le soir (vu par Camille). » Si les deux étaient dans la situation au même moment: « (vu ensemble) ». Les deux machines étant dans la même pièce, rien n'est secret ici (R16).

### 4.4 Apprendre par les dialogues et les écriteaux

| Source | Règle |
|---|---|
| Réplique de l'habitant | Les répliques de la colonne « Comment l'apprendre » des tableaux 3.2 sont des répliques du quotidien (`daily`, priorité 2: au-dessus du tout-venant, en dessous des quêtes et des dates). Elles ne sont tirées que si l'habitude n'est pas encore connue (condition `not habit_known`); entendue, la réplique révèle l'habitude (effet `reveal_habit`). Une fois tout appris, elles rejoignent la réserve ordinaire (tirage « la moins récente », R4) |
| Rumeur | Une réplique dite par un autre habitant que V (Odette, Honorine et Colette en disent beaucoup) révèle l'habitude de V de la même façon |
| Bavardage entendu | Dans une scène entre habitants (section 7.2), une bulle qui parle d'un troisième habitant révèle l'habitude si un joueur est à moins de 4 m |
| Annonce en marche | Un habitant à Voisinage ou plus qui part vers une habitude, croisé à moins de 5 m, le dit en passant (« Je file à la chorale ! ») et la révèle (section 7.3) |
| Écriteau | Lire un écriteau (Examiner) révèle toutes les habitudes qu'il cite (horaires d'une boutique, de la messe, de la mairie, de la forge) |
| Une seule réplique pour plusieurs habitudes | permis (Lucie donne ses trois lieux de photo d'un coup) |

### 4.5 Ce que montre une habitude inconnue

| Cas | Affichage |
|---|---|
| Habitude routinière inconnue | ses cases de la grille sont hachurées au crayon, avec un « ? »: on sait que l'habitant est quelque part à ce moment-là, pas où. Le survol dit: « Tu ne sais pas encore ce que fait Mado le mardi entre 14 h et 18 h. » |
| Variante inconnue (pluie, saison, jour particulier, anniversaire) | une ligne « Sous la pluie: ? » apparaît seulement quand sa condition a été vraie au moins une fois depuis la rencontre (on ne montre pas un trou qu'on ne pouvait pas remplir); avant: rien |
| Habitude née d'une quête | rien avant la quête; à la fin de la quête, elle s'écrit d'elle-même (le duo l'a provoquée), avec « depuis {titre} » |
| Habitude qui disparaît (la meunière ne va plus voir partir les sacs de Paulin) | barrée au crayon, « jusqu'à {titre} », gardée en souvenir |
| Chez lui | la case dit « À la maison » (épicène) |

### 4.6 Progression et récompense

- Indice par habitant: « Habitudes: n sur N » (N compte les habitudes déjà possibles; une habitude d'une quête non faite ne compte pas).
- Toutes connues: tampon « Réglé comme une horloge » sur la page, lien +50 avec l'habitant (une fois), et une réplique de lui (« Tu sais où me trouver mieux que moi. »).
- Indice global sur la couverture de l'onglet: « Le bourg: 140 habitudes sur 255 ». À 100 %: un objet mural unique, le « calendrier du bourg » (le planning de tout le monde à la craie, posé au mur de la maisonnette).

### 4.7 « Où est-il sans doute maintenant ? »

Fonction pure (lot H1), appelée par l'interface: à partir de l'heure, du jour, du temps et de la saison, elle parcourt les habitudes connues de V dans l'ordre de son planning et rend la première qui tient, ou « inconnu ». Elle ne lit jamais la vraie position. Elle peut se tromper sur une variante encore inconnue (il pleut, et l'on ne sait pas encore où va Jeanne sous la pluie): elle dit alors « sans doute », jamais « sûrement ». C'est le cœur du jeu à deux: l'un lit le carnet, l'autre court.

### 4.8 Rattrapage

Une habitude dont la condition a été vraie 10 jours de jeu sans être découverte devient « prioritaire »: la prochaine conversation avec un habitant qui a une réplique de rumeur sur elle la dit (avant tout autre quotidien). Réglage `habits.gossipAfterDays` (10, plage 7 à 21). Effet mesuré (4.11): il ne change presque rien à la médiane et resserre la queue (les jours particuliers et les anniversaires): c'est le bon profil (carnet: rattrapage proportionnel).

### 4.9 Cas limites

| Cas | Règle |
|---|---|
| Les deux joueurs découvrent la même habitude dans le même tick | une seule écriture, « vu ensemble » |
| Un joueur absent (règle d'absence) | les découvertes de l'autre s'écrivent; à son retour, l'onglet porte un point « nouveau » et la liste de ce qui a changé |
| L'habitant n'est pas encore rencontré | ses habitudes peuvent se découvrir (on voit quelqu'un), elles s'écrivent sur une page « Une personne inconnue » qui prend son nom à la rencontre; sa première conversation dit son nom |
| L'habitant marche encore vers son point | pas d'observation tant qu'il n'est pas arrivé (sauf si on lui parle) |
| Une scène arrête l'horloge | les découvertes restent possibles (2 s réelles), utile au marché |
| Une habitude change par une décision | la nouvelle s'écrit d'elle-même; l'ancienne est barrée |
| Partie reprise d'une version antérieure | habitudes de départ de la section 0; aucune découverte ne se perd à la sauvegarde |
| Taille de l'état | un ensemble de bits par habitant (255 habitudes: 32 octets), plus le jour et le joueur de chaque découverte pour la notification de retour (bornée aux 30 dernières) |

### 4.10 Textes d'interface

| Clé | Texte |
|---|---|
| `ui.notebookTabs.neighbours` | Voisins |
| `ui.neighbours.unknownCell` | Tu ne sais pas encore ce que fait {name} le {weekday} entre {from} et {to}. |
| `ui.neighbours.home` | À la maison |
| `ui.neighbours.now` | Maintenant ({weekday}, {time}): sans doute {place}. |
| `ui.neighbours.nowUnknown` | Tu ne sais pas encore où trouver {name} à cette heure-ci. |
| `ui.neighbours.count` | Habitudes: {known} sur {total} |
| `ui.neighbours.stamp` | Réglé comme une horloge |
| `ui.neighbours.since` | depuis « {quest} » |
| `ui.neighbours.until` | jusqu'à « {quest} » |
| `ui.neighbours.introducedBy` | Lucie t'a parlé de {name}, {job}. |
| `ui.neighbours.unknownPerson` | Une personne inconnue |
| `messages.habit_found` | Carnet: {habit} (vu par {player}). |
| `messages.habit_found_together` | Carnet: {habit} (vu ensemble). |
| `messages.habit_heard` | Carnet: {habit} ({speaker} te l'a dit). |
| `messages.habit_read` | Carnet: {habit} (écrit sur la porte). |
| `messages.habits_all` | Tu connais toutes les habitudes de {name}. |

Note: aucun texte ne s'accorde au joueur; les libellés d'habitude sont ceux des tableaux 3.2 (« Le soir, il pêche au gué… »).

### 4.11 Simulation de la découverte

Modèle (section 8 du script): chaque joueur passe chaque heure de jeu dans un secteur du bourg (35 % du temps à la maison et au potager, le reste réparti selon l'attrait des lieux, trois lieux préférés par jour), plus un passage par la place ou le quai; il voit une habitude visible de son secteur avec une chance de 0,7 et une habitude invisible (porte, sortie) avec 0,2; il parle à cinq habitants par jour, dont chacun révèle une habitude à lui avec 0,3 et une rumeur avec 0,1; rattrapage à 10 jours. Météo tirée, 60 duos, 336 jours (4 années de jeu). Part des habitudes connues (médiane):

**règle proposée (vu, dialogues, écriteaux, rattrapage) (60 duos)**

| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 34 % | 46 % | 25 % | 31 % | 14 % | 10 % | 12 % |
| 14 | 52 % | 67 % | 43 % | 62 % | 43 % | 19 % | 19 % |
| 21 | 64 % | 78 % | 59 % | 81 % | 57 % | 33 % | 31 % |
| 42 | 84 % | 91 % | 81 % | 100 % | 93 % | 62 % | 56 % |
| 63 | 92 % | 97 % | 90 % | 100 % | 93 % | 81 % | 75 % |
| 84 | 97 % | 99 % | 99 % | 100 % | 100 % | 90 % | 88 % |
| 168 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 336 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

**sans rattrapage (60 duos)**

| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 34 % | 46 % | 25 % | 38 % | 14 % | 14 % | 12 % |
| 14 | 50 % | 64 % | 42 % | 62 % | 36 % | 19 % | 25 % |
| 21 | 63 % | 75 % | 58 % | 88 % | 57 % | 33 % | 31 % |
| 42 | 84 % | 90 % | 83 % | 100 % | 93 % | 62 % | 56 % |
| 63 | 92 % | 96 % | 90 % | 100 % | 93 % | 81 % | 75 % |
| 84 | 96 % | 98 % | 94 % | 100 % | 100 % | 90 % | 88 % |
| 168 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 336 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

**vu seulement (60 duos)**

| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 25 % | 38 % | 13 % | 12 % | 0 % | 5 % | 6 % |
| 14 | 34 % | 52 % | 20 % | 38 % | 0 % | 10 % | 6 % |
| 21 | 41 % | 60 % | 28 % | 50 % | 0 % | 14 % | 6 % |
| 42 | 56 % | 70 % | 46 % | 62 % | 64 % | 33 % | 6 % |
| 63 | 62 % | 76 % | 57 % | 75 % | 64 % | 38 % | 6 % |
| 84 | 66 % | 78 % | 61 % | 88 % | 79 % | 43 % | 6 % |
| 168 | 74 % | 83 % | 72 % | 100 % | 86 % | 57 % | 6 % |
| 336 | 79 % | 87 % | 83 % | 100 % | 93 % | 67 % | 6 % |

Lecture: la moitié du bourg en deux semaines, 84 % en six, 97 % au bout d'un an (84 jours), tout avant la fin de la deuxième année. La colonne « apres » (habitudes nées des quêtes) est sous-estimée: le modèle n'ouvre que celle du retour de Lucie, alors que le jeu les écrit d'elles-mêmes à la fin de chaque quête (4.5). Les répliques et les écriteaux font la différence (sans eux, 80 % au bout de quatre ans: les habitudes des jours particuliers et des anniversaires ne se rencontrent presque pas par hasard). Le rattrapage pèse peu en moyenne et rattrape la fin de la collection, comme voulu. Hypothèse à remesurer avec les robots une fois le lot H1 livré (le modèle de déplacement est grossier).

## 5. Suites de quêtes

### 5.1 Règles

| Règle | Valeur | Raison |
|---|---|---|
| Une suite par habitant | 3 ou 4 quêtes (78 en tout), une par étape d'histoire (HA-02); l'étape 5 des anciens et des nouveaux vient avec les arcs suivants | assez pour un an et demi de jeu, sans épuiser les personnages |
| Ouverture | la quête n d'un habitant s'ouvre quand le lien atteint son niveau (colonne « Ouvre ») et que les prérequis d'autres habitants sont faits | HA-02 |
| Au plus 2 histoires en cours | les autres prêtes attendent; l'habitant dit « J'aurai quelque chose à te demander, quand tu auras un moment. » et une petite lanterne s'allume au-dessus de lui | mesuré (5.7): avec 3 ou sans limite, un duo médian reçoit une à trois quêtes par jour les trois premières semaines, et le carnet déborde |
| Au plus une quête d'histoire neuve par jour | | idem |
| 3 jours au moins entre deux étapes d'un même habitant | | laisse respirer chaque histoire, et fait tourner les visages |
| Formes (R13) | au plus 35 % de « apporter N objets »; ici: 15 sur 78 (19 %); jamais deux de suite chez le même habitant | |
| Étapes 3 et 5 | scènes à deux (HA-02) | |
| Récompenses | quête 1: 40 aubrins; 2: 60; 3: 80; 4: 120 (plus un objet unique quand le tableau le dit); lien +100 avec l'habitant (HA-01); lien +50 avec l'habitant croisé | à l'échelle des quêtes de la 0.12 (30 à 120) |
| Un seul joueur connecté | les étapes à deux attendent l'autre, sans échéance (règle existante) | |
| Dates | une quête calée sur une date (moisson, lumignons, cuite) s'ouvre au plus tôt 7 jours avant; manquée, elle revient l'année suivante, sans reproche | |

### 5.2 Les décisions à deux

Quatre quêtes portent une décision qui change la suite de deux habitants (HA-08 bis). Panneau « Décision à deux », chez les deux: la question, deux options avec ce qu'elles changent en une ligne. Chacun choisit sur son écran et voit le choix de l'autre. D'accord: la décision est prise après 2 s (le tampon tombe). Pas d'accord: « Vous n'êtes pas du même avis: parlez-en. » Aucun minuteur; fermer le panneau le laisse ouvert dans le carnet (« Une décision vous attend »). Un joueur absent: elle attend. Chaque option réussit et rapporte autant; seules la variante de la quête suivante et les habitudes changent.

| Décision (`id`) | Quête | Question | Option A | Option B |
|---|---|---|---|---|
| `minute` | « La montre d'Émile » (Ambroise) | « Dire à Firmin qui a réparé la montre ? » | `now`: « Tout de suite. » Firmin et Ambroise se réconcilient à la fin de la quête (drapeau `clocks_reconciled`); « La pendule de la halte » se fait à quatre mains, Ambroise sur l'escabeau | `letter`: « Ambroise le dira à sa façon. » « La pendule de la halte » commence par une lettre d'Ambroise à porter (pli de Lucie, 0.12); la réconciliation vient à la fin, sur le quai |
| `mouture` | « La part du meunier » (Berthe) | « Comment Berthe et Paulin se feront-ils confiance ? » | `weighing`: « La pesée publique. » Chaque samedi à 9 h, le blé est pesé sur la bascule de la halte (habitude nouvelle des deux; Firmin arbitre) | `watch`: « La mouture à façon. » Le jeudi après-midi, Paulin regarde moudre son blé au moulin (habitude nouvelle des deux) |
| `robe` | « La robe de noces » (Marthe) | « À qui revient la robe réparée par Solange ? » | `marthe`: « À Marthe, comme leur mère l'avait voulu. » Honorine lui offre en retour le voile du même trousseau (« Côte à côte » se joue à la fenêtre d'Honorine) | `shared`: « Aux deux sœurs. » La robe change de maison chaque saison: le premier dimanche, elles la portent ensemble sur le parvis (habitude nouvelle des deux) |
| `cabane` | « La cabane des oiseaux » (Jeanne) | « Léon veut sa part de la cabane. » | `shared`: « Une cabane pour deux. » Jeanne et Léon y sont le mercredi; la quête de Léon devient « Un cahier pour deux » | `jeanne`: « La cabane de Jeanne. » Léon bâtit son affût au bout de la pâture; sa quête devient « L'affût de Léon » |

### 5.3 Les croisements

| # | Croisement | Qui | Comment les suites se touchent |
|---|---|---|---|
| C1 | La minute de la halte | Firmin, Ambroise | « La montre arrêtée » (Firmin) fait porter la montre chez Ambroise; « La montre d'Émile » (Ambroise) porte la décision `minute`; « La pendule de la halte » (Firmin) en dépend; à la fin, Ambroise rejoint la manille (habitude nouvelle) et règle la pendule avec Firmin à 8 h |
| C2 | La part du meunier | Berthe, Paulin, Firmin | décision `mouture`; « La pesée » ou « La mouture à façon » (Paulin) en est la variante; « Les sacs du hameau » (Berthe) ne s'ouvre qu'après; quatre habitudes changent |
| C3 | La farine de la vallée | Mado, Berthe, Achille | « Le soufflet percé » (Mado) rend la forge capable de forger le marteau de « La meule à rhabiller » (Berthe), qui ouvre « La farine de la vallée » (Achille); ensuite Berthe monte la farine au fournil le vendredi |
| C4 | La robe de noces | Marthe, Honorine, Solange, Lucie | « La photo des deux sœurs » (Honorine, appareil réparé de Lucie) ouvre « La robe de noces » (Marthe), où Solange répare la robe; décision `robe`; « Côte à côte » (Honorine) en est la suite; les sœurs tricotent ensemble le dimanche et chantent côte à côte |
| C5 | La cabane des oiseaux | Inès, Jeanne, Basile, Léon | « Les arbres à garder » (Inès) autorise la cabane; Basile la bâtit avec le duo; décision `cabane`; la quête de Léon en est la variante |
| C6 | Le vêlage | Margot, Nour | « Le beurre à deux » (Margot) fait connaître la ferme; « Le vêlage » (Nour) ouvre « La génisse » (Margot) |
| C7 | La tarte de Mme Ferrand mère | Odette, Honorine, Marthe | chaque sœur a une moitié de la recette; si C4 est fait, elles la donnent ensemble en une visite; sinon, deux visites et deux moitiés à rapprocher dans le carnet |
| C8 | Le blé rouge | Paulin, Martial | « Le champ du Haut » (Paulin) ouvre « Le blé rouge » (l'abbé), une bande semée dans le champ de Paulin; « La moisson » (Paulin) la récolte |
| C9 | L'appareil et l'exposition | Ambroise, Lucie, Firmin, Honorine | « Les ressorts du samedi » (Ambroise) ouvre « Le vieil appareil » (Lucie); « La pendule de la halte » (Firmin) ouvre « L'exposition de la halte » (Lucie); l'appareil réparé ouvre « La photo des deux sœurs » |
| C10 | La basse de la chorale | Armand, Barnabé | « La chorale du vendredi » (Armand) ouvre « La basse de la chorale » (Barnabé); Barnabé chante le vendredi (habitude nouvelle) |

Et des chaînes simples: « Le plan de la ligne » (Armand) attend « L'uniforme d'Émile » (Firmin) et ouvre « La lettre d'Émile »; « Le moule de ma mère » (Odette) et « La lame de la scie » (Basile) attendent la forge remise en état; « La chaîne du vélo » (l'abbé) aussi; « La petite cloche » et « La grille du père Joseph » attendent « Les dahlias » (Marthe); « Les souliers de la rentrée » (Ambroise) suivent « La blouse de la rentrée » (Solange); « L'accordéon de l'oncle » (Colette) suit « La montre d'Émile »; « Le concours de soupe » (Colette) suit « La tarte » (Odette).

### 5.4 Les suites

Colonnes: identifiant, titre, ouverture (niveau de lien et prérequis), étapes (objectifs du carnet, avec la sorte de condition), forme (R13), récompense (aubrins; lien avec l'habitant +100 sauf mention; lien croisé +50).

**Firmin**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `firmin_watch` | La montre arrêtée | Connaissance | 1. Écouter Firmin à la cloche (la montre d'Émile, arrêtée à 5 h 12). 2. Porter la montre à Ambroise, à sa fenêtre (`given`). 3. Revenir deux nuits plus tard (`nights_passed`) | apporter, attendre | 40; +50 Ambroise |
| `firmin_clock` | La pendule de la halte | Voisinage, « La montre d'Émile » faite | variante `now`: 1. Décrocher la pendule à deux (l'un tient l'escabeau, l'autre décroche, gestes à deux existants). 2. La porter chez Ambroise (gros colis à deux). 3. La raccrocher le samedi avant 10 h, Ambroise au pied de l'escabeau (scène à deux `firmin_clock_scene`). Variante `letter`: étape 0 « Porter la lettre d'Ambroise à Firmin » (pli), puis les mêmes | bâtir à deux, scène | 60; +50 Ambroise; drapeau `clocks_reconciled` |
| `firmin_uniform` | L'uniforme d'Émile | Amitié, « La malle du théâtre » faite | 1. Sortir l'uniforme d'Émile du grenier de la halte. 2. Le confier à Solange (`given`). 3. Demander à Ambroise six boutons de laiton (dialogue). 4. Le samedi, Firmin l'étrenne au train (être à deux au quai à 10 h) | accompagner, se coordonner | 80; objet: casquette d'Émile (décoration murale) |
| `firmin_letter` | La lettre d'Émile | Grande amitié, « Le plan de la ligne » fait | 1. Lire avec Firmin la lettre trouvée par Armand, à 17 h sur le quai (« il ne quittait jamais le quai avant cinq heures »). 2. Scène à deux `firmin_letter_scene`: chaque joueur lit une moitié de la lettre sur son écran (information propre, R16) et la lit à voix haute à l'autre | deviner, scène | 120; une page du carnet d'Émile (fil rouge A7) |

**Odette**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `odette_tart` | La tarte de Mme Ferrand mère | Connaissance, « Le fil qui manque » fait | 1. Demander à Honorine (sur sa chaise) ce qu'elle se rappelle. 2. Demander à Marthe l'autre moitié (au cimetière). Variante C4 faite: une seule visite aux deux sœurs. 3. Cuire la tarte à deux au fourneau d'Odette (une pincée de fleur de sureau: 1 grappe, 3 œufs) | retrouver, fabriquer | 40; recette « tarte de Mme Ferrand »; +50 Honorine |
| `odette_mold` | Le moule de ma mère | Voisinage, « Le soufflet percé » fait | 1. Retrouver le moule à la forge (Mado se souvient: son père l'avait à rétamer). 2. Rétamer à deux (l'un au soufflet, l'autre étale l'étain, Espace maintenu). 3. Le rendre à Odette | retrouver, à deux | 60; +50 Mado |
| `odette_dining` | La salle à manger de la pension | Amitié | 1. Ôter les draps des tables et des chaises (4 gestes, à deux plus vite). 2. Basile recolle une chaise (2 planches). 3. Le dimanche à 19 h, souper avec Odette, Honorine, Firmin et Nour (scène à deux `odette_dining_scene`) | bâtir, scène | 80; la salle à manger ouvre le dimanche soir (souper à 15 aubrins, Ventre +40) |
| `odette_gustave` | La lettre de Gustave | Grande amitié, « Le retour de Lucie » fait | 1. Lucie rapporte une lettre d'un frère perdu de vue; la lire avec Odette. 2. Aider Odette à répondre: chaque joueur choisit une phrase (ton seulement, HA-08). 3. Poster la réponse au train du samedi | accompagner | 120; lettre de Gustave au courrier (son arrivée viendra avec un arc suivant) |

**Basile**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `basile_blade` | La lame de la scie | Connaissance, « Le soufflet percé » fait | 1. Démonter la lame à deux (porter à deux, 2 m). 2. La porter à la forge. 3. Deux nuits; la remonter à deux | porter à deux | 40; une bûche donne 5 planches au lieu de 4; +50 Mado |
| `basile_joint` | L'apprentissage | Voisinage | 1. Écouter Basile à l'établi. 2. Fabriquer à deux un tabouret à queue d'aronde (recette nouvelle, 2 planches) | fabriquer à deux | 60; recettes tabouret, étagère d'angle |
| `basile_bench` | Le banc d'Hortense | Amitié | 1. Trouver le vieux banc derrière la scierie. 2. Le réparer (3 planches de chêne, 2 clous). 3. Le poser sous le tilleul de la place, à deux. 4. Le jeudi suivant, à 7 h 30, scène à deux `basile_bench_scene` au cimetière: il parle d'Hortense | bâtir, scène | 80; le banc d'Hortense sur la place (on peut s'y asseoir) |
| `basile_joinery` | La menuiserie rouverte | Grande amitié, « Les arbres à garder » fait | 1. Choisir avec Inès le chêne à abattre (marquage). 2. L'abattre à deux et le porter au parc à grumes. 3. Ouvrir la menuiserie (balayer, 4 gestes) | se coordonner | 120; la menuiserie ouvre le samedi (meubles sur commande) |

**Jeanne**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `jeanne_binoculars` | Les jumelles de grand-père | Connaissance, « Le retour de Lucie » fait | 1. Jeanne veut essayer les jumelles: la rejoindre un mercredi à 14 h à la lisière (habitude). 2. Repérer avec elle trois oiseaux nommés par Inès (moments existants ou présences) | observer | 40; les jumelles se prêtent le mercredi (carnet d'oiseaux, système à venir) |
| `jeanne_kingfisher` | Le martin-pêcheur | Voisinage | 1. Être à deux au poteau du martin-pêcheur à l'aube (6 h à 7 h 30), sans bouger 10 s, avec Jeanne. 2. Lui raconter (dialogue) | observer, attendre | 60; dessin de Jeanne (décoration) |
| `jeanne_hide` | La cabane des oiseaux | Amitié, « Les arbres à garder » fait | 1. Demander l'accord d'Inès. 2. Bâtir avec Basile la cabane au bord de la mare (8 planches, 4 clous, chantier à deux). 3. Décision `cabane`. 4. Première guette à trois (scène à deux `jeanne_hide_scene`) | bâtir, décider, scène | 80; la cabane (point `bird_hide`); +50 Inès |

**Achille**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `achille_harvest_batch` | La fournée de la moisson | Voisinage; s'ouvre le 11 de l'été | 1. Le 18 de l'été, entre 21 h et 23 h (veillée), pétrir à deux au fournil (scène à deux `achille_batch_scene`: Espace en alternance, 20 miches). 2. Le 19 à 18 h, porter la panière au repas de moisson | scène, porter à deux | 60; +50 Margot |
| `achille_valley_flour` | La farine de la vallée | Amitié, « La meule à rhabiller » faite | 1. Aller chercher au moulin le premier sac moulu ici (gros colis à deux). 2. Cuire avec Achille le premier pain de la vallée (fournil, à deux). 3. En porter un à Berthe | porter à deux, fabriquer | 80; pain de la vallée chez Achille (Ventre +20, 6 aubrins); drapeau `valley_flour`; +50 Berthe |
| `achille_apprentice` | L'apprentie | Grande amitié, « Le martin-pêcheur » fait | 1. Convaincre Solange et Lucie de laisser Jeanne se lever tôt (deux dialogues). 2. Scène à deux à 6 h au fournil `achille_apprentice_scene`: Achille confie le levain à Jeanne; chaque joueur tient un bocal | accompagner, scène | 120; +50 Jeanne |

**Solange**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `solange_chair` | Le fauteuil qui penche | Connaissance | 1. Porter le fauteuil à deux jusqu'à l'établi de Basile. 2. Le caler (1 planche). 3. Le rapporter; Solange raconte le théâtre | porter à deux | 40; +50 Basile |
| `solange_trunk` | La malle du théâtre | Voisinage | 1. Descendre la malle du comble (échelle à deux). 2. Scène à deux `solange_trunk_scene`: chaque joueur choisit une perruque pour l'autre (visible chez les deux, le temps de la scène et une heure de jeu) | scène | 60; deux coiffures nouvelles (garde-robe 0.12) |
| `solange_school_smock` | La blouse de la rentrée | Amitié; s'ouvre au plus tôt le 14 de l'été | 1. Apporter 2 coupons de toile (0.12). 2. Prendre les mesures de Jeanne à deux (l'un tient le mètre, l'autre note). 3. Le 1er de l'automne à 8 h, accompagner Jeanne au portail de l'école | apporter, accompagner | 80; +50 Jeanne |

**Lucie**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `lucie_return` | Le retour de Lucie | première aube en 0.13 | 1. Accueillir Lucie (au train si c'est samedi, sinon à la route des hameaux à 9 h). 2. Porter sa sacoche à deux jusqu'à sa maison. 3. Firmin met sa casquette du dimanche (si le secret de « Le mot de Lucie » a été remis, une réplique de plus) | accompagner | 40; drapeau `lucie_back`; la tournée des présentations commence |
| `lucie_camera` | Le vieil appareil | Connaissance, « Les ressorts du samedi » fait | 1. Porter l'appareil à Ambroise. 2. Deux nuits. 3. Première photo avec Lucie au belvédère, un lundi ou un mercredi à 14 h (habitude) | apporter, observer | 40; +50 Ambroise |
| `lucie_darkroom` | La chambre noire | Voisinage; un jour de pluie | 1. Entrer chez Lucie entre 14 h et 17 h un jour de pluie (habitude). 2. Scène à deux `lucie_darkroom_scene`: l'un agite le bain (Espace maintenu), l'autre compte (information propre: seul lui voit le chronomètre) | scène, se coordonner | 60; la photo du duo (cadre) |
| `lucie_exhibition` | L'exposition de la halte | Amitié, « La pendule de la halte » faite | 1. Photographier avec Lucie quatre points de vue (belvédère, ponton, parvis, quai), aux heures de ses habitudes. 2. Demander l'accord de Firmin. 3. Accrocher les photos à deux dans la salle d'attente | observer, bâtir | 80; l'exposition (décor de la halte); +50 Firmin |

**Armand**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `armand_registers` | Les registres mouillés | rencontre; un mercredi de soleil | 1. Sortir les registres de la mairie dans la cour (6 piles, porter, à deux plus vite). 2. Les rentrer avant 18 h | porter | 40 |
| `armand_chronicle` | La chronique d'Honorine | Connaissance, « Le fil qui manque » fait | 1. Trois dimanches à 14 h chez Honorine avec Armand (habitude nouvelle d'Armand); chaque fois, chaque joueur choisit une question de la liste (ton seulement) | accompagner, attendre | 60; la « Chronique de la Halte » (livre à lire, s'enrichit à chaque étape d'habitant); +50 Honorine; drapeau `armand_chronicle` |
| `armand_choir` | La chorale du vendredi | Voisinage | 1. Venir un vendredi à 20 h à l'église. 2. Scène à deux `armand_choir_scene`: chanter (Espace en mesure, fenêtre de 0,8 s, comme le volant de Jeanne; toujours réussie) | scène | 60 |
| `armand_line_plan` | Le plan de la ligne | Amitié, « L'uniforme d'Émile » fait | 1. Un mercredi matin, fouiller les archives avec Armand (trois cartons, l'un lit l'étiquette, l'autre ouvre). 2. Trouver le plan de la voie d'Émile et une lettre « au prochain garde-barrière ». 3. Les porter à Firmin | retrouver, se coordonner | 80; le plan d'Émile (décoration murale); +50 Firmin |

**Berthe**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `berthe_sluice` | La vanne coincée | rencontre | 1. Lever la vanne du bief à deux (deux manivelles, comme la barrière du passage à niveau). 2. Regarder la roue repartir (scène courte, partagée) | geste à deux | 40; le moulin tourne (drapeau `mill_running`): farine en vente chez Berthe (3 aubrins le sac) |
| `berthe_millstone` | La meule à rhabiller | Connaissance, « Le soufflet percé » fait | 1. Demander à Mado le marteau à rhabiller (2 clous, 1 rondin). 2. Un lundi, rhabiller la meule à deux (rythme: l'un frappe, l'autre déplace la règle) | fabriquer, à deux | 40; +50 Mado |
| `berthe_share` | La part du meunier | Voisinage, « Les sacs du samedi » fait | 1. Écouter Berthe (le samedi à 9 h, au quai). 2. Écouter Paulin (à son champ). 3. Scène à deux `berthe_share_scene` à la bascule de la halte, avec les deux; décision `mouture` | décider, scène | 60; drapeau `mouture_settled`; +50 Paulin |
| `berthe_hamlet_sacks` | Les sacs du hameau | Amitié, « La pesée » ou « La mouture à façon » faite | 1. Porter à deux le blé de Paulin au moulin (gros colis). 2. Ensacher avec Berthe. 3. Partager le premier pain avec Paulin et Berthe (Achille le cuit) | porter à deux | 80; +50 Paulin |

**Martial**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `martial_seeds` | Les graines de la sacristie | rencontre | 1. Recevoir trois sachets de graines anciennes (radis rond de la Côte, laitue grise, carotte blanche: variétés nouvelles des cultures existantes). 2. En récolter une de chaque au potager. 3. En rapporter à l'abbé | cultiver | 40; les trois variétés en vente au presbytère |
| `martial_chain` | La chaîne du vélo | Connaissance, « Le soufflet percé » fait | 1. Porter le vélo de l'abbé à la forge (le pousser). 2. Mado forge un maillon. 3. Le rapporter avant 9 h un lundi | apporter, attendre | 40; +50 Mado |
| `martial_red_wheat` | Le blé rouge | Voisinage, « Le champ du Haut » fait | 1. Semer avec l'abbé une bande de blé rouge au champ de Paulin (4 cases). 2. Scène à deux `martial_wheat_scene` au champ, à la moisson | cultiver, scène | 60; graines de blé rouge; +50 Paulin |
| `martial_small_bell` | La petite cloche | Amitié, « Les dahlias » fait | 1. Monter au clocher avec Marthe (échelle à deux). 2. Décrocher la petite cloche fêlée à deux. 3. La descendre au train du samedi (elle part à la fonderie de la ville; son retour, arc suivant) | porter à deux | 80; +50 Marthe |

**Marthe**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `marthe_angelus` | L'angélus à deux | rencontre | 1. Être à l'église à 18 h 50. 2. Sonner l'angélus de 19 h à deux: l'un tire la corde (Espace en mesure), l'autre compte les coups sur son écran (information propre) et dit « stop » à neuf | geste à deux | 40; les joueurs peuvent sonner la cloche une fois par jour hors des heures (7.1) |
| `marthe_dahlias` | Les dahlias | Connaissance | 1. Acheter 4 bulbes de dahlia chez Odette (5 aubrins). 2. Les planter sur les tombes d'Hortense, d'Octave, des Ferrand, d'Eugénie (à deux plus vite). 3. Le jeudi suivant, voir Basile découvrir les dahlias (observer) | apporter, observer | 40 |
| `marthe_wedding_dress` | La robe de noces | Voisinage, « La photo des deux sœurs » faite | 1. Écouter Marthe (la robe de leur mère). 2. Écouter Honorine (le jour de son mariage). 3. Porter la robe à Solange; deux nuits. 4. Scène à deux `marthe_dress_scene` sur le parvis, les deux sœurs face à face; décision `robe` | décider, scène | 60; drapeau `sisters_reconciled`; +50 Honorine, +50 Solange |
| `marthe_lumignons` | Le Dimanche des lumignons | Amitié; s'ouvre le 9 de l'automne | 1. Fabriquer 6 lumignons (bocal 0.12 et bougie d'Odette). 2. Le 16 de l'automne, de 17 h à 20 h, les poser avec Marthe sur les tombes que le carnet connaît (habitudes des lumignons). 3. Soupe sur la place | fabriquer, se coordonner | 80; souvenir du carnet |

**Honorine**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `honorine_yarn` | Le fil qui manque | rencontre | 1. Trouver chez Solange la laine « couleur de ciel avant l'orage » (choisir parmi trois pelotes: Honorine dit laquelle quand on les lui décrit; seul le joueur qui tient la pelote voit sa couleur exacte, R16) | retrouver | 40; moufles tricotées (objet, Cœur +5 quand on les porte l'hiver) |
| `honorine_photo` | La photo des deux sœurs | Connaissance, « Le vieil appareil » fait | 1. Prendre chez Honorine une vieille photo abîmée. 2. Lucie la rephotographie (chambre noire). 3. En porter une à Honorine, et l'autre (que faire ?) à Marthe: elle la garde sans un mot | apporter | 40; +50 Lucie |
| `honorine_side_by_side` | Côte à côte | Voisinage, « La robe de noces » faite | variante `marthe`: scène à deux `honorine_veil_scene` à sa fenêtre: le voile du trousseau. Variante `shared`: scène à la chorale du vendredi, les deux sœurs au même rang. Dans les deux cas, leurs habitudes de chorale changent | scène | 60; +50 Marthe |
| `honorine_handcar` | La draisine d'Honorine | Amitié; draisine en état (quête existante `handcar`) | 1. Installer Honorine sur la draisine (l'aider à monter, à deux). 2. La pousser à deux jusqu'au bout de la voie dégagée et retour. 3. Elle raconte le premier train | accompagner, à deux | 80; un chapitre de la Chronique |

**Inès**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `ines_trail` | Le sentier balisé | rencontre | 1. Prendre le pot de peinture à la maison forestière. 2. Peindre quatre marques à deux (l'un tient le pochoir, l'autre peint) sur les sentiers de la Côte | geste à deux | 40; marques visibles en forêt (aide à s'orienter) |
| `ines_keep_trees` | Les arbres à garder | Connaissance, « La première meule » faite | 1. Avec Inès et Barnabé à la coupe, un mardi ou un jeudi après-midi: désigner trois arbres à garder parmi six (chaque joueur voit sur son écran les marques d'un côté du tronc, R16: il faut se parler) | se coordonner | 40; +50 Barnabé |
| `ines_owls` | La nuit des chouettes | Voisinage | 1. Rejoindre Inès au Vieux Chêne à 22 h. 2. Scène à deux `ines_owls_scene`: ne pas bouger 20 s (les chouettes se posent), puis chaque joueur dit combien il en a vu | attendre, scène | 60 |
| `ines_question_marks` | Les points d'interrogation | Amitié | 1. Inès confie sa carte: trois « ? » (le rond des fées, la charbonnière oubliée, la mare au crépuscule, secrets de la carte 5.5). 2. Les trouver (à deux pour les deux premiers, règles de la carte) | explorer | 80; la carte de la Côte (le carnet affiche la forêt) |

**Barnabé**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `barnabe_first_kiln` | La première meule | rencontre | 1. Porter à deux 8 bûches à la meule (le chablis de la coupe). 2. Couvrir la meule de mottes (4 gestes) | porter à deux | 40 |
| `barnabe_watch` | La veille de la cuite | Connaissance; jours de cuite | 1. Un soir de cuite, entre 20 h et 23 h, veiller la meule avec Barnabé. 2. Scène à deux `barnabe_watch_scene`: un seul joueur voit la couleur de la fumée (R16) et dit où boucher; l'autre bouche (trois fois). Toujours réussie | se coordonner, scène | 40; 2 sacs de charbon de bois (vendables à Mado) |
| `barnabe_old_pit` | La charbonnière oubliée | Voisinage | 1. Trouver la plate-forme cachée (secret de la carte). 2. Scène à deux `barnabe_pit_scene`: Barnabé reconnaît la gourde de son grand-père | explorer, scène | 60; la gourde (objet, se boit à la source: Repos +10) |
| `barnabe_bass` | La basse de la chorale | Amitié, « La chorale du vendredi » faite | 1. Écouter Armand (il veut une basse). 2. Convaincre Barnabé (trois répliques, chaque joueur en choisit une: ton seulement). 3. Un vendredi, l'accompagner à la chorale | accompagner | 80; drapeau `barnabe_choir`; +50 Armand |

**Mado**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `mado_bellows` | Le soufflet percé | rencontre | 1. Apporter 2 planches et un vieux tablier de cuir (Basile en a un, à demander). 2. Rapiécer à deux (l'un tient, l'autre coud: 6 clics). 3. Premier feu: l'un souffle, l'autre tient la barre | geste à deux | 40; la forge travaille (prérequis de cinq quêtes) |
| `mado_axe` | La hache de la forge | Connaissance | 1. Apporter 1 rondin et 4 clous. 2. Frapper à deux (l'un tient, l'autre frappe en rythme) | fabriquer à deux | 40; la hache de la forge (outil existant, sans passer par le catalogue) |
| `mado_wheel` | La roue de la ferme | Voisinage, « Les sacs du samedi » fait | 1. Le lundi matin à la ferme (habitude). 2. Scène à deux `mado_wheel_scene`: poser le cercle chaud (l'un tient la pince, l'autre frappe), puis noyer (seau du puits) | scène, à deux | 60; +50 Paulin |
| `mado_gate` | La grille du père Joseph | Amitié, « Les dahlias » fait | 1. Retrouver le dessin de la grille dans l'atelier. 2. Forger les deux derniers barreaux (2 fois le geste de la hache). 3. Les poser à deux à la grille du cimetière, avec Marthe | fabriquer, bâtir | 80; la grille achevée (décor); +50 Marthe |

**Paulin**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `paulin_sacks` | Les sacs du samedi | rencontre | 1. Le samedi à 9 h, porter à deux trois sacs de la ferme au quai (gros colis) | porter à deux | 40 |
| `paulin_field` | Le champ du Haut | Connaissance | 1. Visiter le champ 2 avec Paulin. 2. Le louer (200 aubrins la saison, réglage). 3. Y semer 6 cases | cultiver | 40; le champ 2 est au duo (règles de culture de plein champ: carte, section 6) |
| `paulin_mill_again` | La pesée (variante `weighing`) ou La mouture à façon (variante `watch`) | Voisinage, « La part du meunier » faite | `weighing`: 1. Le samedi à 9 h, peser à deux le blé sur la bascule de Firmin (l'un lit le poids, information propre, l'autre l'annonce). `watch`: 1. Le jeudi à 14 h, accompagner Paulin au moulin et regarder moudre (rester 30 s) | se coordonner ou attendre | 60; +50 Berthe |
| `paulin_harvest` | La moisson | Amitié, « Le blé rouge » fait; s'ouvre le 10 de l'été | 1. Le 17 ou le 18 de l'été, moissonner à deux (l'un fauche, l'autre lie, 10 gerbes). 2. Le 19, battre dans la cour. 3. Le repas de moisson (scène à deux `harvest_supper_scene`, avec le bourg) | à deux, scène | 120; un sac de farine de la ferme chaque saison; +50 l'abbé |

**Margot**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `margot_butter` | Le beurre à deux | rencontre | 1. Baratter à deux (Espace en alternance, 20 coups). 2. Porter la motte à Odette un mardi ou un vendredi à 9 h (habitude) | geste à deux, apporter | 40; beurre en vente à la ferme |
| `margot_heifer` | La génisse | Connaissance, « Le vêlage » fait | 1. Nommer la génisse à deux (trois noms proposés, à tour de rôle, règle des bêtes de la 0.12). 2. Lui apprendre la longe à deux (elle ne suit que si les deux sont à moins de 4 m, règle de la chevrette) | à deux | 40; la génisse dans la pâture, à son nom; +50 Nour |
| `margot_harvest_tables` | Les tables de la moisson | Voisinage; s'ouvre le 12 de l'été | 1. Emprunter deux tables à Odette, quatre bancs à Colette, des tréteaux à Basile (dialogues). 2. Les porter à deux dans la cour de la ferme avant le 19 à 18 h. Si le duo n'y arrive pas, le bourg les a portés: rien n'est perdu | porter à deux | 60; +50 Odette, +50 Colette |

**Léon**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `leon_loach` | Le pari des loches | rencontre | 1. Au bout de la pâture, attraper une loche à la main: l'un soulève les pierres (Espace), l'autre attend la loche (Espace au bon moment, fenêtre de 0,8 s). 2. La relâcher (Léon a perdu son pari, il le reconnaît) | geste à deux | 40 |
| `leon_bell` | La cloche de Léon | Connaissance, « La montre arrêtée » faite | 1. Demander à Firmin (dialogue; il cède si le duo vient avec Léon). 2. Le samedi à 10 h, Léon sonne la cloche à l'arrivée du train (scène courte, être à deux au quai) | accompagner | 40; +50 Firmin |
| `leon_hide_or_blind` | Un cahier pour deux (variante `shared`) ou L'affût de Léon (variante `jeanne`) | Voisinage, « La cabane des oiseaux » faite | `shared`: 1. Fabriquer un cahier d'oiseaux pour deux (1 planche, 1 coupon de toile); le porter à la cabane un mercredi. `jeanne`: 1. Bâtir l'affût de Léon au bout de la pâture (4 planches, à deux). 2. Une guette à l'affût | fabriquer, bâtir | 60; +50 Jeanne |

**Ambroise**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `ambroise_springs` | Les ressorts du samedi | rencontre | 1. Le samedi, retirer au train le petit colis d'Ambroise (Firmin le tend sans un mot). 2. Le porter à sa fenêtre | apporter | 40 |
| `ambroise_emile_watch` | La montre d'Émile | Connaissance, « La montre arrêtée » faite | 1. Le jour d'après le dépôt de la montre, regarder Ambroise l'ouvrir (rester 20 s à sa fenêtre: il trouve un ticket de quai plié, sans destination). 2. Décision `minute` | observer, décider | 40; le ticket (objet de collection du fil rouge); +50 Firmin |
| `ambroise_school_shoes` | Les souliers de la rentrée | Voisinage, « La blouse de la rentrée » faite | 1. Prendre la pointure de Jeanne (dessiner son pied à deux, l'un tient la feuille). 2. Apporter 1 coupon de cuir (le vieux tablier de Basile, s'il n'a pas servi; sinon au catalogue). 3. Les porter à Jeanne | apporter, fabriquer | 60; +50 Solange |

**Nour**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `nour_visit` | La visite de Nour | rencontre | 1. Recevoir Nour au poulailler (elle propose un jeudi à 8 h). 2. L'un tient chaque poule, l'autre lit le carnet de santé (information propre: seul lui voit la page) et dit à Nour ce qu'elle cherche | à deux | 40; bonheur des poules +10; drapeau `nour_visits` (elle passe chaque jeudi: conseils, jamais de reproche) |
| `nour_calving` | Le vêlage | Connaissance, « Le beurre à deux » fait | 1. Un soir (lettre de Margot au courrier, le jour même), être à l'étable à 22 h. 2. Scène à deux `nour_calving_scene`: l'un tient la lanterne, l'autre la corde, au signal de Nour (Espace au bon moment). Toujours réussie | scène, se coordonner | 40; +50 Margot |
| `nour_fox` | Le renard à l'épine | Voisinage, « Les arbres à garder » fait | 1. Repérer avec Inès les traces du jeune renard (belvédère). 2. L'approcher à deux: l'un tend la couverture et ne bouge plus, l'autre attend (10 s). 3. Nour ôte l'épine; il repart (le moment du renard existant revient plus souvent pendant une saison) | observer, attendre | 60; +50 Inès |
| `nour_care_pen` | L'enclos de soins | Amitié | 1. Apporter 6 planches et 4 clous. 2. Bâtir l'enclos à deux (chantier). 3. Le premier pensionnaire arrive (un hérisson) | bâtir | 80; l'enclos visible, ses pensionnaires changent chaque saison |

**Colette**

| `id` | Titre | Ouvre | Étapes | Forme | Récompense |
|---|---|---|---|---|---|
| `colette_chairs` | Les chaises de la terrasse | rencontre | 1. Demander à Basile sa colle d'os. 2. Recoller à deux six chaises (l'un tient, l'autre serre) | geste à deux | 40; la terrasse a six chaises (on peut s'y asseoir) |
| `colette_soup` | Le concours de soupe | Connaissance, « La tarte de Mme Ferrand mère » faite; après la dispute de trois jours (scène 7.2, S06) | 1. Apporter à chacune ses légumes (3 carottes à Odette, 3 radis à Colette). 2. Goûter les deux soupes à deux (sur la place, à 12 h). 3. Le verdict: chaque joueur dit sa préférée sur son écran; quoi qu'il arrive, Firmin déclare « égalité » et les deux soupes entrent au menu | apporter, scène | 40; soupe du jour au café et à la pension; +50 Odette |
| `colette_ball` | Le bal du café | Voisinage | 1. Pendre les lampions de la terrasse à deux (échelle). 2. Un samedi à 20 h, scène à deux `colette_ball_scene`: Colette joue, le duo danse (rythme à deux, toujours réussie), le bourg regarde | scène | 60; bal du café le premier samedi de chaque saison (habitude nouvelle de Colette et de plusieurs habitants, P1) |
| `colette_accordion` | L'accordéon de l'oncle | Amitié, « La montre d'Émile » faite | 1. Porter l'accordéon à Ambroise (gros colis). 2. Deux nuits. 3. Colette joue l'air de son oncle sur la terrasse, à deux | apporter, attendre | 80; +50 Ambroise |

### 5.5 Format (proche de `quetes.json`)

Exemple 1, la quête qui porte la décision `minute`:

```json
{
  "id": "ambroise_emile_watch", "kind": "side", "tier": "P0", "title": "La montre d'Émile", "giver": "ambroise", "story": { "villager": "ambroise", "step": 2 },
  "start": { "when": [{ "type": "quest_done", "quest": "firmin_watch" }, { "type": "bond_at_least", "villager": "ambroise", "level": 1 }] },
  "steps": [
    { "id": "open", "objective": "Regarder Ambroise ouvrir la montre, à sa fenêtre.", "conditions": [{ "type": "stayed_at", "point": "rail_cottage_west_window", "seconds": 20, "who": "either" }, { "type": "habit_active", "villager": "ambroise", "habit": "shop" }] },
    { "id": "decide", "objective": "Décider à deux: dire à Firmin qui a réparé la montre ?", "conditions": [{ "type": "decision_made", "decision": "minute" }], "effects": [{ "type": "open_decision", "decision": "minute" }] }
  ],
  "completionEffects": [
    { "type": "give_money", "amount": 40 }, { "type": "give_item", "item": "platform_ticket", "count": 1, "to": "cellar" },
    { "type": "add_bond", "villager": "ambroise", "amount": 100 }, { "type": "add_bond", "villager": "firmin", "amount": 50 },
    { "type": "if", "condition": { "type": "decision_made", "decision": "minute", "option": "now" }, "then": [{ "type": "set_flag", "flag": "clocks_reconciled" }] }
  ],
  "completionText": "Un ticket de quai, plié en quatre, sans destination."
}
```

Exemple 2, une variante de suite et un changement de planning (« La pesée »):

```json
{
  "id": "paulin_mill_again", "kind": "side", "tier": "P0", "giver": "paulin", "story": { "villager": "paulin", "step": 3 },
  "title": { "variants": [{ "when": [{ "type": "decision_made", "decision": "mouture", "option": "weighing" }], "text": "La pesée" }, { "when": [], "text": "La mouture à façon" }] },
  "start": { "when": [{ "type": "quest_done", "quest": "berthe_share" }, { "type": "bond_at_least", "villager": "paulin", "level": 2 }] },
  "steps": [
    { "id": "weigh", "when": [{ "type": "decision_made", "decision": "mouture", "option": "weighing" }], "objective": "Samedi à 9 h, peser le blé de Paulin sur la bascule de la halte, à deux.", "conditions": [{ "type": "scene_played", "dialogue": "paulin_weighing_scene", "since": "step_start" }] },
    { "id": "watch", "when": [{ "type": "decision_made", "decision": "mouture", "option": "watch" }], "objective": "Jeudi à 14 h, regarder moudre le blé de Paulin au moulin.", "conditions": [{ "type": "stayed_at", "point": "mill_door", "seconds": 30, "who": "both" }, { "type": "weekday_is", "weekdays": ["thursday"] }] }
  ],
  "completionEffects": [{ "type": "give_money", "amount": 60 }, { "type": "add_bond", "villager": "paulin", "amount": 100 }, { "type": "add_bond", "villager": "berthe", "amount": 50 }],
  "completionText": "Le blé du hameau retourne au moulin de la Vanne."
}
```

Les habitudes nées d'une décision n'ont pas besoin d'effet: leur entrée de planning porte `decision_made`, et le carnet les écrit d'elles-mêmes à la fin de la quête (4.5).

### 5.6 Conditions et effets nouveaux

| Nom | Sorte | Paramètres | Sens |
|---|---|---|---|
| `bond_at_least` | condition | `villager`, `level` (0 à 5) | niveau d'amitié atteint |
| `habit_known` | condition | `villager`, `habit` | l'habitude est au carnet (sert aux répliques révélatrices: `not habit_known`) |
| `habit_active` | condition | `villager`, `habit` | l'habitant suit cette habitude en ce moment |
| `decision_made` | condition | `decision`, `option` facultatif | décision prise (avec cette option) |
| `school_day`, `special_day`, `season_day_is`, `birthday_of` | conditions | section 3.1 | |
| `gift_given` | condition | `villager`, `taste` (`adore`, `aime`, `neutre`, `deteste`) facultatif | pour les envies et les quêtes de cadeaux |
| `reveal_habit` | effet | `villager`, `habit` | écrit l'habitude au carnet (répliques, écriteaux, scènes) |
| `add_bond` | effet | `villager`, `amount` | lien (jamais négatif) |
| `open_decision` | effet | `decision` | ouvre le panneau de décision à deux |
| `introduce` | effet | `villager` | la présentation de Lucie (2.1) |
| `story` | champ de quête | `villager`, `step` | rattache la quête à l'histoire (page « Son histoire » du carnet) et aux règles d'ouverture 5.1 |
| `title.variants` | champ de quête | comme les lettres | titre selon une décision |

### 5.7 Rythme mesuré

Modèle (section 9 du script): chaque joueur parle chaque jour à 3, 5 ou 7 habitants (duo tranquille, médian, assidu), plus souvent à ses préférés et à ceux qui ont une quête; un cadeau par jour avec une chance de 0,3 à 0,8, mieux choisi à mesure que les goûts sont connus; une quête d'histoire dure en moyenne 4, 2,5 ou 1,5 jours; Lucie présente deux habitants par jour; 200 duos, 336 jours. Les dates (moisson, lumignons, cuite) ne sont pas modélisées: elles retardent quelques quêtes d'une saison au plus.

| Duo | Règle | Étapes faites au jour 84 | Étapes par jour, j1 à 21 | j22 à 63 | j64 à 126 | j127 à 252 | j253 à 336 | Suites finies au jour 336 | Actives en moyenne (j1 à 84) | Habitants « Comme la famille » au jour 336 |
|---|---|---|---|---|---|---|---|---|---|---|
| tranquille | sans limite | 74 | 2.14 | 0.62 | 0.08 | 0.01 | 0.00 | 100 % | 4.0 | 17 |
| tranquille | 3 actives | 56 | 0.64 | 0.68 | 0.54 | 0.02 | 0.00 | 100 % | 3.0 | 17 |
| tranquille | règle proposée | 36 | 0.43 | 0.44 | 0.44 | 0.18 | 0.00 | 100 % | 1.9 | 17 |
| médian | sans limite | 77 | 2.76 | 0.40 | 0.03 | 0.00 | 0.00 | 100 % | 2.8 | 21 |
| médian | 3 actives | 76 | 0.95 | 1.00 | 0.24 | 0.00 | 0.00 | 100 % | 2.7 | 21 |
| médian | règle proposée | 51 | 0.57 | 0.60 | 0.57 | 0.02 | 0.00 | 100 % | 1.9 | 21 |
| assidu | sans limite | 78 | 3.19 | 0.21 | 0.02 | 0.00 | 0.00 | 100 % | 1.9 | 21 |
| assidu | 3 actives | 78 | 1.38 | 1.14 | 0.02 | 0.00 | 0.00 | 100 % | 1.9 | 21 |
| assidu | règle proposée | 68 | 0.76 | 0.83 | 0.43 | 0.00 | 0.00 | 100 % | 1.7 | 21 |

Jour médian de chaque quête de la suite (duo médian, règle proposée):

| Habitant | Étape 1 | Étape 2 | Étape 3 | Étape 4 |
|---|---|---|---|---|
| Firmin Lacombe | 28 (100 %) | 66 (100 %) | 92 (100 %) | 115 (100 %) |
| Odette Ferrand | 53 (100 %) | 76 (100 %) | 83 (100 %) | 95 (100 %) |
| Basile Cornu | 50 (100 %) | 60 (100 %) | 67 (100 %) | 91 (100 %) |
| Jeanne Ribot | 55 (100 %) | 64 (100 %) | 88 (100 %) |  |
| Achille Pradel | 35 (100 %) | 79 (100 %) | 106 (100 %) |  |
| Solange Mérigot | 28 (100 %) | 40 (100 %) | 48 (100 %) |  |
| Lucie Arnaud | 28 (100 %) | 56 (100 %) | 63 (100 %) | 96 (100 %) |
| Armand Castagné | 24 (100 %) | 50 (100 %) | 60 (100 %) | 110 (100 %) |
| Berthe Lavergne | 26 (100 %) | 53 (100 %) | 71 (100 %) | 86 (100 %) |
| Martial Roques | 36 (100 %) | 62 (100 %) | 82 (100 %) | 96 (100 %) |
| Marthe Bousquet | 26 (100 %) | 36 (100 %) | 93 (100 %) | 98 (100 %) |
| Honorine Valade | 27 (100 %) | 75 (100 %) | 97 (100 %) | 103 (100 %) |
| Inès Garrigue | 24 (100 %) | 55 (100 %) | 64 (100 %) | 72 (100 %) |
| Barnabé Tixier | 24 (100 %) | 35 (100 %) | 43 (100 %) | 90 (100 %) |
| Madeleine Cazals | 26 (100 %) | 36 (100 %) | 63 (100 %) | 84 (100 %) |
| Paulin Delmas | 28 (100 %) | 38 (100 %) | 82 (100 %) | 101 (100 %) |
| Margot Delmas | 20 (100 %) | 66 (100 %) | 75 (100 %) |  |
| Léon Delmas | 30 (100 %) | 61 (100 %) | 108 (100 %) |  |
| Ambroise Pélissier | 26 (100 %) | 62 (100 %) | 92 (100 %) |  |
| Nour Belkacem | 30 (100 %) | 62 (100 %) | 88 (100 %) | 98 (100 %) |
| Colette Lafon | 25 (100 %) | 75 (100 %) | 84 (100 %) | 103 (100 %) |

Lecture: sans limite, un duo médian reçoit presque trois quêtes d'histoire par jour la première semaine, et 77 des 78 sont faites au jour 84: le carnet déborde puis se vide. Avec la règle proposée (2 en cours, 1 neuve par jour, 3 jours entre deux étapes d'un même habitant), le rythme reste autour d'une étape tous les deux jours pendant quatre mois de jeu, et les suites se finissent vers les jours 85 à 115 (une année de jeu et un quart, environ 30 heures), assez tôt pour que le duo voie les décisions changer le bourg, assez tard pour laisser la place aux arcs suivants. Un duo tranquille va un tiers moins vite et finit quand même tout vers le jour 200, dans la troisième année. La règle à bouger en premier si le client trouve que ça traîne: deux histoires en cours passent à trois.

## 6. L'amitié

### 6.1 Niveaux

Valeurs du cahier (HA-01, HA-02), gardées. Un lien par habitant, commun au duo, de 0 à 1000.

| Niveau | Seuil | Nom affiché | Lanternes | Ce qu'il débloque |
|---|---|---|---|---|
| 0 | 0 | De vue | aucune allumée | se saluer, la première quête |
| 1 | 100 | Connaissance | 1 | l'étape 2; il dit le prénom de chacun (« Bonjour, Camille ! ») |
| 2 | 250 | Voisinage | 2 | l'étape 3; il fait signe de loin; il annonce où il va en passant (révèle des habitudes, 7.3); une réserve de répliques neuves |
| 3 | 450 | Amitié | 3 | l'étape 4; une lettre par saison avec un petit cadeau (graine, recette, objet de son métier); il vient aux anniversaires de l'autre habitant dont il est proche |
| 4 | 700 | Grande amitié | 4 | l'étape 5 (arcs suivants); une habitude nouvelle: il passe à la maisonnette le dimanche après-midi une fois par saison (visite, scène courte, il apporte quelque chose) |
| 5 | 1000 | Comme la famille | 5, dorées | un objet unique de lui pour la maison (table 6.4), une photo avec le duo au carnet (Lucie), sa propre appellation affectueuse (7.3) |

### 6.2 Gains

| Geste | Gain | Plafond | Note |
|---|---|---|---|
| Parler (première conversation du jour) | +10 | une par joueur, par habitant et par jour | HA-01; deux joueurs: +20 |
| Cadeau adoré, aimé, autre | +60, +30, +10 | un par joueur, par habitant et par jour | HA-01 |
| Cadeau qu'il n'aime pas | 0; l'habitant le rend gentiment, l'objet revient au sac | | « Oh, c'est gentil, mais je n'en ferais rien de bon. Garde-le, il plaira à quelqu'un. » et le carnet note « N'aime pas » |
| Cadeau le jour de son anniversaire | gain doublé (adoré +120), et +20 pour « Bon anniversaire » (choix de dialogue, une fois par joueur) | | les anniversaires se lisent au carnet |
| Étape de son histoire | +100 | | HA-01 |
| Croisement (aider un autre habitant dans une quête qui le concerne) | +50 | | 5.4 |
| Annonce du tableau remplie pour lui | +50 | | HA-01 |
| Vente au marché au prix « Doux » | +2 | | 0.12 |
| Toutes ses habitudes connues | +50 | une fois | 4.6 |
| Être là à son habitude d'anniversaire (à moins de 10 m pendant 30 s) | +20 | une fois par an | on vient à son goûter |

Jamais de perte: ni l'oubli, ni un cadeau raté, ni un anniversaire manqué ne coûtent rien. Le rattrapage HA-04 (visite à la maison quand le lien seul bloque une étape de chapitre) reste.

### 6.3 Ce qu'on voit

- Dans la bulle de dialogue, à côté du nom: les cinq lanternes (la suivante se remplit par quarts).
- Au gain: la lanterne frémit chez les deux, petit son de verre (`bond-chime`), notification seulement au passage d'un niveau: « Avec Odette: Voisinage. Elle te fait signe de loin. »
- Au carnet: la page (4.2).
- Aucune comparaison entre les joueurs (HA-03): le lien est au duo, on ne voit jamais « qui a fait le plus ».

### 6.4 Objets « Comme la famille »

Firmin: la lanterne du quai miniature; Odette: le moule de sa mère, en double; Basile: le banc gravé à vos deux prénoms; Jeanne: son plus beau galet, peint; Achille: une miche de fer forgé pour la porte; Solange: un miroir de loge du théâtre; Lucie: votre photo encadrée sur le quai; Armand: la Chronique reliée; Berthe: une meule de pierre en table basse; Martial: un vieux pot de semences; Marthe: une petite cloche; Honorine: un plaid tricoté aux deux couleurs des joueurs (couleurs du profil Duo); Inès: sa carte de la Côte encadrée; Barnabé: un tabouret de souche; Mado: des chenets forgés; Paulin: une gerbe de blé rouge; Margot: une baratte miniature; Léon: son sifflet de chef de train; Ambroise: une horloge qui avance d'une minute (« pour le principe »); Nour: un nichoir à hérisson; Colette: une affiche du bal. Tous des objets de décoration (règle des objets muraux et de jardin du tour 9: la pièce est petite).

### 6.5 Migration

Format de sauvegarde suivant (après celui de la 0.12): `bonds` (21 entiers), `habitsKnown` (ensembles de bits par habitant), `tastesKnown`, `decisions`, `storyDone`; liens de départ et habitudes connues d'office: section 0. Une sauvegarde de la 0.12 se charge sans perte.

## 7. La vie du village

Demande du client: beaucoup plus d'interactions, avec le décor et entre les habitants, pour un monde plus vivant et plus agréable. Trois couches: ce que les joueurs font avec le décor (7.1), ce que les habitants font entre eux sous leurs yeux (7.2), ce que les habitants disent des joueurs (7.3). Et un chat (7.4).

### 7.0 Règles communes

| Règle | Valeur | Raison |
|---|---|---|
| Aucun geste nouveau au clavier | tout passe par Agir (`{act}`, appui ou maintien) et Examiner (`{examine}`) | rien à apprendre; les touches restent celles du jeu (carnet: AZERTY, Échap réservé) |
| Une réplique courte, jamais la même deux fois en 7 jours | chaque geste a une réserve de 4 à 8 répliques (selon saison, temps, heure), tirée « la moins récente » pour ce joueur (R4); réserve épuisée dans la fenêtre: le geste se joue sans réplique (son et animation seuls) | anti-répétition sans nouvelle règle |
| Trouvailles | au plus une par geste et par joueur et par jour, au plus quatre trouvailles de décor par joueur et par jour; tirées par `unitDraw(seed, "deco:<id>", jour)`; jamais deux fois de suite la même | on revient avec plaisir, on ne farme pas |
| Argent | aucun geste de décor ne rapporte d'aubrins (hors la vente d'objets trouvés, au prix de la 0.12) | l'économie reste celle de la 0.12 |
| Sons | un son par geste, spatialisé (entendu par l'autre s'il est près, même pièce: rien de secret); 10 s au moins entre deux mêmes sons d'un même joueur | pas de cacophonie |
| À deux | un geste fait par les deux en moins de 3 s donne une variante (réplique, image) et, une fois, un souvenir dans l'onglet Souvenirs | le plaisir se partage |
| Habitants témoins | un habitant à moins de 6 m peut réagir (une fois par geste et par jour), par une réplique de sa réserve | le décor relie aux gens |

### 7.1 Gestes avec le décor (30)

| # | `id` | Où | Geste | Retour | Trouvaille, effet | Anti-répétition | À deux |
|---|---|---|---|---|---|---|---|
| 1 | `well_peek` | margelle du puits (place) | Agir: s'asseoir et se pencher; maintenir: crier dans le puits | goutte qui résonne; « Ton reflet a l'air content. »; la nuit: « La lune est tombée dedans. »; maintien: écho « hou… ou… » | aucune | réserve de 6 | deux reflets côte à côte: souvenir « Deux têtes dans le puits » |
| 2 | `bell_ring` | cloche du quai | Agir: un coup | `quay-bell`, entendu à 30 m; Firmin présent: « Pas de train, pas de cloche ! » (une fois par jour); Léon accourt s'il est sur la place | après « La cloche de Léon », sonner l'arrivée du train le samedi à 10 h: Firmin +5 (une fois par samedi) | 20 s de repos entre deux coups (la main reste sur la corde, muette) | |
| 3 | `station_register` | registre de la halte, sur le guichet | Examiner | une page écrite par Firmin, générée de l'historique: « Samedi 29: train à 10 h 02, un voyageur, trois colis (dont celui d'Ambroise). Soleil. F. L. »; quatre semaines feuilletables | révèle les habitudes du samedi des habitants cités (colis de Solange, sacs de Paulin) | la page change chaque semaine | |
| 4 | `skim_stone` | berge, langue de sable, ponton | Agir maintenu puis relâché (jauge, 0,6 s idéal) | 0 à 7 rebonds, un `plic` par rebond; réplique seulement si record battu: « Six ! Le record de la berge. » | 1 fois sur 20 en ramassant: un galet troué (Jeanne l'adore) | aucune réplique hors record | lancer ensemble: les rebonds s'additionnent, record à deux au carnet |
| 5 | `apple_shake` | pommiers de Lucie et du verger communal (automne) | Agir: secouer le tronc | le houppier frémit, 1 à 3 pommes tombent (objet `apple`, nouveau), sinon des feuilles; Lucie présente: « Mes pommes sont à qui les ramasse. » | une fois par arbre et par jour | | l'un secoue, l'autre attrape (Agir au bon moment, 0,8 s): pommes de belle qualité |
| 6 | `awning_shelter` | porte de la halte, auvent du fournil, lavoir, toit du puits, tonnelle, porche de l'église | sous la pluie, rester 2 s sous l'abri | le personnage s'ébroue; pluie qui tambourine (son proche); « La pluie tambourine sur l'auvent. » une fois par pluie et par abri | un habitant abrité au même endroit dit une réplique de pluie (réserve existante) | une réplique par pluie et par abri | ensemble sous le même abri: Cœur +2 chacun (une fois par jour), souvenir « À l'abri » |
| 7 | `fence_lean` | barrière de la pâture, passage à niveau, clôture du jardin, parapet du pont | Agir: s'accouder | pose accoudée; pâture: les vaches approchent en 10 s; passage à niveau quand le train passe: le personnage fait signe, la locomotive siffle | | réserve de 5 par lieu | |
| 8 | `mairie_poster` | panneau d'affichage de la mairie | Examiner | une affiche à la main d'Armand, changée chaque lundi (réserve de 24 sans redite sur 8 semaines; celles des jours particuliers posées la semaine d'avant: « Battage au hameau le 19 », « Chorale: on cherche des basses », « Objet trouvé: une clé de pendule ») | révèle les habitudes citées | | |
| 9 | `dandelion_blow` | pissenlits montés en graine (prés, printemps et été) | Agir: souffler | les aigrettes s'envolent dans le sens du vent (tour 2) | | une fois par touffe et par jour | ensemble en 2 s: « Deux vœux d'un coup. », souvenir une fois par an |
| 10 | `church_candle` | présentoir de cierges, nef | Agir: allumer | une flamme qui reste jusqu'au soir; Honorine présente: « Tu l'as allumé pour qui ? » (aucune réponse demandée) | | un cierge par joueur et par jour | deux flammes côte à côte |
| 11 | `harmonium_note` | harmonium (hors messe et chorale) | Agir | une note; Marthe présente: « Pas trop fort, ils dorment. » | | une note par seconde | ensemble: un accord (parmi quatre accords doux) |
| 12 | `bell_rope_pull` | corde des cloches (après « L'angélus à deux ») | Agir maintenu | une volée de 10 s entendue partout; trois habitants dehors lèvent la tête: « Déjà midi ? » | | une fois par jour, jamais à moins de 30 minutes d'un angélus | |
| 13 | `grave_flower` | les cinq tombes nommées | Agir avec un pot de fleurs, un bleuet ou un pissenlit en main | la fleur reste 3 jours; si un proche passe dans la journée: « Tu as mis une fleur pour Hortense ? » | lien +10 avec ce proche (une fois par semaine et par tombe) | une fleur par tombe à la fois | |
| 14 | `washhouse_scrub` | lavoir | Agir maintenu: le battoir | `battoir` sur la pierre; « Ta chemise sent l'Aubrune. » | le lundi matin, Margot et Colette bavardent (scène S13) | réserve de 6 | |
| 15 | `pump_handle` | pompe des jardins de la Rive | Agir maintenu | grincement et jet; remplit l'arrosoir | | | l'un pompe, l'autre tient l'arrosoir: deux fois plus vite |
| 16 | `millwheel_watch` | rive du bief (moulin remis en marche) | Agir: s'asseoir | la caméra ne bouge pas; après 10 s: « Le bruit de l'eau, c'est la berceuse de Berthe. » | Repos +5, une fois par jour | réserve de 4 | |
| 17 | `cafe_coffee` | comptoir du café, Colette présente | Agir | 2 aubrins, tasse fumante; Repos +10 | | un café par joueur et par demi-journée | deux cafés en même temps: « Deux cafés, deux cuillères. », Cœur +5 chacun (une fois par jour) |
| 18 | `skittles_throw` | allée de quilles, hors partie des habitants (le dimanche, si Mado invite) | Agir maintenu puis relâché (force) | 9 quilles, le score au-dessus de l'allée; Mado présente: « Pas mal, pour une première partie. » | | aucune hors score | une partie en trois lancers chacun |
| 19 | `lookout_shout` | belvédère | Agir: crier | mains en porte-voix, écho double; dans le bourg, un écho lointain plus faible | | une fois par minute | |
| 20 | `oak_knock` | tronc du Vieux Chêne | Agir: frapper | toc toc; un pic répond; 1 fois sur 5, l'écureuil de la carte descend (`squirrel_old_oak`) | | toutes les 5 minutes | |
| 21 | `spring_drink` | bassin de la source | Agir: boire | accroupi; « L'eau a le goût de la pierre. » | Repos +5, une fois par jour; remplit la gourde de Barnabé | réserve de 4 | |
| 22 | `bench_carve` | banc du belvédère | Agir à deux en moins de 5 s | les initiales des deux prénoms apparaissent gravées, pour toujours | souvenir « Nos initiales au belvédère » | une seule fois par partie | il faut être deux |
| 23 | `leaf_pile` | tas de feuilles sous le tilleul et à la lisière (automne) | Agir: sauter | les feuilles volent, le tas se reforme la nuit; Jeanne ou Léon présents sautent aussi | | une fois par tas et par heure | |
| 24 | `puddle_jump` | flaques des chemins (pluie) | Agir sur une flaque | éclaboussure; Jeanne rit si elle est là | | une flaque toutes les 10 s | |
| 25 | `weathervane` | girouette du clocher, depuis le parvis | Examiner | « Le coq regarde l'ouest: il pleuvra demain. » (lit la météo du lendemain, juste quatre fois sur cinq; Martial s'en moque) | utile au potager | un regard utile par jour, ensuite « Le coq n'a pas bougé. » | |
| 26 | `hay_nap` | foin de la grange (portes ouvertes) | Agir: s'allonger | allongé; l'été, les hirondelles passent; Paulin la première fois: « Pas dans ma paille propre ! », puis il sourit | Repos +10, une fois par jour | | ensemble: souvenir « Une sieste dans le foin » |
| 27 | `quay_timetable` | horaire de la halte (porte) | Examiner | l'horaire du samedi et la ligne de Firmin au crayon: le fait du samedi qui vient (« Samedi: fanfare de la coopérative ») | révèle les habitudes du samedi des habitants cités | change chaque semaine | |
| 28 | `stepping_stones` | pierres du gué du ru (`ru_stepping_stones`) | Agir à chaque pierre (trois sauts en rythme) | raté: « Plouf. Juste un pied. », rien d'autre | | | |
| 29 | `postcard_rack` | tourniquet de cartes postales d'Odette | Examiner: le faire tourner | grincement; douze cartes de la vallée (les points de vue de Lucie, les gares à venir) | acheter une carte (2 aubrins): Lucie les adore | | |
| 30 | `cat_pet` | le chat du bourg (7.4) | Agir près de lui couché | ronronnement; il se frotte | Cœur +3, une fois par jour | | ensemble: il se roule sur le dos |

### 7.2 Scènes entre habitants (20)

Une scène est légère: les habitants sont déjà à leur point de planning; ils se tournent l'un vers l'autre et des bulles s'affichent au-dessus d'eux (toutes les 6 à 10 s) chez un joueur à moins de 8 m. Elle n'arrête ni l'horloge ni personne. Réserve de 6 bulles au moins par scène, tirées « la moins récente ». Une bulle qui parle d'un troisième habitant révèle son habitude si un joueur est à moins de 4 m (4.4): c'est le lien voulu entre la vie du village et le carnet.

| # | `id` | Qui | Quand, où | Ce qu'on voit (bulles d'exemple) | Révèle | Fréquence |
|---|---|---|---|---|---|---|
| S01 | `morning_greetings` | deux habitants qui se croisent à moins de 3 m | 6 h à 10 h, sur leurs trajets | casquette levée, main levée; « Bonjour, Firmin ! » « Belle journée, Odette. » | | 4 croisements sur 10, une fois par paire et par jour |
| S02 | `basket_at_odette` | Achille, Odette | 9 h, porte de l'épicerie (mardi à dimanche) | « Six miches et une couronne. » « Tu as encore de la farine sur le nez. » | la panière d'Achille, le comptoir d'Odette | chaque jour |
| S03 | `quay_five` | Lucie, Firmin | 17 h, banc du quai | peu de mots: « Les hameaux ? » « Toujours là. » « Et toi ? » « Toujours là aussi. » | leurs habitudes du banc | chaque jour |
| S04 | `bench_handover` | Firmin, Ambroise | 18 h, banc du quai | avant C1: Ambroise attend que Firmin soit à 15 m pour s'asseoir (ils s'évitent); après: « Lacombe. » « Pélissier. » et ils restent cinq minutes | le journal d'Ambroise | chaque jour |
| S05 | `manille` | Firmin, Basile, l'abbé (Ambroise après C1), Colette | mercredi 20 h, café | « Atout cœur ! » « Firmin, ta manche. » « Je ne triche pas, je prie. » | la manille de chacun | chaque mercredi |
| S06 | `soup_dispute` | Odette, Colette | sur trois jours, une fois par an (au premier jour de pluie de l'automne, ou au plus tard le 5 de l'automne) | jour 1, 12 h, terrasse du café: « Il manque du sel. » « Il manque surtout ta langue dans ta poche. »; jour 2: Odette fait le tour par la rue Haute pour ne pas passer devant le café (trajet visible), Colette au comptoir: « Elle boude. Moi aussi. »; jour 3, 16 h: Colette porte un bol à la terrasse d'Odette, elles trinquent | les rumeurs de ces trois jours chez Honorine et Firmin révèlent leurs habitudes | une fois par an; ouvre « Le concours de soupe » |
| S07 | `terrace_lunch` | Nour, Odette | 12 h, tonnelle de l'épicerie | Odette s'assoit dix minutes: « Tu as mangé debout hier, je t'ai vu. » « Je mange toujours debout. » | le déjeuner de Nour | du lundi au samedi |
| S08 | `kids_play` | Jeanne, Léon | 16 h 30 à 18 h, place (sous le puits s'il pleut); mercredi à la lisière | course au loup en cercle, marelle, comptage d'oiseaux à voix haute; si un joueur est là, Jeanne lui demande d'arbitrer | leurs habitudes d'après la classe | jours de classe et mercredi |
| S09 | `carry_together` | Paulin et Barnabé; Mado et Firmin | samedi 9 h à 11 h, quai | Paulin et Barnabé portent un sac à deux (animation de portage des joueurs); Mado soulève seule ses barres, Firmin se tient le dos: « Doucement, Mado, le quai est neuf. » | les habitudes du samedi | chaque samedi |
| S10 | `angelus_pause` | habitants dehors | 7 h, 12 h, 19 h | ils s'arrêtent 3 s; Firmin et Ambroise sortent leur montre (avant C1, Ambroise secoue la tête) | | à chaque angélus |
| S11 | `mass_exit` | l'abbé et les paroissiens | dimanche 11 h 30, parvis | l'abbé serre les mains, les enfants courent, Ambroise vérifie l'heure, Berthe et Paulin s'ignorent (avant C2), puis on descend au café | la messe de chacun (vus à la sortie) | chaque dimanche |
| S12 | `skittles_sunday` | Mado, Paulin, Léon, Margot, Barnabé, Colette | dimanche 15 h à 18 h, devant le café | Mado lance, Paulin perd en silence, Léon ramasse, Margot compte, Barnabé chante quand Mado gagne | les quilles de chacun | chaque dimanche sans pluie |
| S13 | `laundry_gossip` | Margot, Colette | lundi 9 h à 11 h, lavoir | réserve de 12 rumeurs sur les autres: « Ambroise est à la lisière le lundi, il cueille. » « Berthe va voir partir le blé de Paulin, le samedi. » | une habitude d'un autre habitant par bulle entendue | chaque lundi: la meilleure raison d'aller au lavoir |
| S14 | `sisters_apart` | Marthe, Honorine | vendredi 9 h, cimetière; vendredi 20 h, chorale | avant C4: Marthe range son arrosoir et fait le tour par l'autre allée (trajet visible); à la chorale, chacune son côté; après: bras dessus, bras dessous jusqu'à la grille | les visites du vendredi | chaque vendredi |
| S15 | `bike_race` | Lucie, Nour | lundi, mercredi, vendredi 8 h, route des hameaux | elles partent ensemble en pédalant: « Au virage ! » | les tournées des deux | trois fois par semaine |
| S16 | `weather_shout` | l'abbé, Mado | 9 h, devant la forge (lundi, mardi, jeudi, vendredi) | l'abbé, à vélo: « Pluie demain ! » (juste une fois sur deux); Mado: « Tu disais ça la semaine dernière. » | la tournée de l'abbé, l'enclume de Mado | quatre fois par semaine |
| S17 | `milking_trio` | Paulin, Margot, Léon | 18 h, étable | la vache Marguerite donne un coup de queue à Léon; « Elle t'aime bien. » « Elle a une drôle de façon de le dire. » | la traite des trois | chaque jour |
| S18 | `birthday_gathering` | l'habitant fêté et 2 à 4 proches (table 2.4) | à son habitude d'anniversaire | chacun arrive avec un petit paquet; « Bon anniversaire ! » | la date au carnet pour qui le voit | une fois par an et par habitant |
| S19 | `grain_quarrel` | Berthe, Paulin, Firmin | samedi 9 h, quai | avant C2: Berthe regarde partir les sacs sans un mot, Paulin charge sans se retourner, Firmin entre les deux: « Beau temps pour le blé. »; après « La pesée »: ils lisent le poids ensemble, à voix haute | les habitudes du samedi des deux | chaque samedi |
| S20 | `evening_windows` | Lucie, Solange | 21 h à 21 h 30, rue Haute, sans pluie | elles se parlent d'une fenêtre à l'autre; deux bulles: « Jeanne dort ? » « Comme un loir. Et toi ? » | | chaque soir sans pluie |

### 7.3 Réactions aux joueurs

| Déclencheur | Qui | Exemple | Règle |
|---|---|---|---|
| La météo | tous | « Quel temps de canard ! Tu as vu Firmin sous sa porte ? » | une remarque par habitant, par joueur et par jour, à la première conversation ou au passage à moins de 3 m sous la pluie; réserve météo de R3 (3 par temps), 3 neuves par nouvel habitant |
| Une tenue neuve (garde-robe 0.12) | lien Connaissance et plus | « Elle est neuve, ta veste ? Elle te va bien. »; Solange: « Je reconnais mon ourlet. » | le premier jour où un joueur porte une pièce que cet habitant n'a jamais vue, à moins de 4 m; une fois par pièce et par habitant; au plus trois compliments par joueur et par jour; le texte parle du vêtement, jamais du joueur (« elle te va bien ») |
| Une coupe nouvelle (salon) | idem | « Solange est passée par là, ça se voit. » | idem |
| Une prise rare ou mieux (pêche 0.12) | tous, surtout Achille, Léon, Firmin | sur le coup, à moins de 6 m dans l'heure: « Une perche pareille ! Tu la mets en vitrine ? »; le lendemain, la nouvelle circule (HA-03): « Il paraît que Camille a sorti une truite de 40 cm. » | une fois par prise; la rumeur une fois par habitant |
| Le prénom selon l'amitié | tous | De vue: « Bonjour ! »; Connaissance: « Bonjour, Camille ! »; Voisinage: un signe de la main à 12 m, et le prénom; Amitié: il vient à 3 m pour une réplique s'il est libre; Grande amitié et plus: son appellation à lui | appellations, toutes accordées à un nom et jamais au joueur: Firmin « chef », Odette « mon chou », Jeanne « camarade », Achille « mon levain », Solange « ma muse », Lucie « mon timbre », Berthe « ma farine », l'abbé « brave âme », Honorine « mon petit cœur », Barnabé « l'oiseau », Mado « la jeunesse », Margot « mon trésor », Léon « chef de gare », Nour « collègue », Colette « mon rayon de soleil »; Basile, Armand, Marthe, Inès, Paulin et Ambroise disent seulement le prénom (c'est leur façon) |
| Les deux ensemble | tous | « Toujours ensemble, vous deux ! » | les deux joueurs à moins de 4 m l'un de l'autre et de l'habitant; une fois par habitant et par semaine |
| Il part vers une habitude | lien Voisinage et plus | « Je file à la chorale ! » « Je vais voir Hortense. » | croisé à moins de 5 m dans les 10 minutes de jeu avant l'habitude; révèle l'habitude (4.4); une fois par habitude et par jour |
| Ce que tu tiens en main | tous | un objet qu'il adore, en main à moins de 3 m: « Oh, c'est une gelée de sureau ? » | révèle « Adore: gelée de sureau » au carnet; une fois par objet |
| La nuit | habitants dehors après 22 h (Colette, Barnabé les soirs de cuite) | « Tu ne dors pas ? Moi non plus. » | une fois par nuit |
| Un geste de décor sous ses yeux | les témoins (7.0) | Léon après un ricochet: « Six ! Je t'ai vu ! » | une fois par geste et par jour |
| Un cadeau fait à un autre | proches de l'habitant gâté | « Tu as apporté des noisettes à Basile ? Il en a parlé toute la matinée. » | souvenir HA-03, une fois par cadeau |

Au plus trois réactions spontanées par habitant, par joueur et par jour, hors conversations; jamais pendant une scène à deux ou un menu. Priorité: il part vers une habitude, prise rare, tenue, ce que tu tiens, météo, salut.

### 7.4 Le chat du bourg

La démo dit « il n'y a pas de chat au bourg » (réplique `odette_after_gift`, et les tours 8 et 9 l'ont vérifié). La 0.13 en fait une histoire: la chatte de la grange de la ferme a eu des petits; Margot en confie un « au bourg ». Il choisit lui-même la tonnelle d'Odette.

| Point | Règle |
|---|---|
| Arrivée | à partir du troisième jour joué en 0.13, après « Le beurre à deux »: Margot pose le panier sur la place à 10 h (scène courte); le duo choisit son nom à deux parmi trois (Pompon, Grisaille, Mistral; tirage sans redite des autres plus tard), règle de nommage des bêtes de la 0.12 |
| La réplique d'Odette | `odette_after_gift` prend la condition `not flag cat_here`; nouvelle réplique: « Il y a un chat au bourg, maintenant. Il a choisi ma tonnelle. Je n'ai rien dit. » |
| Son planning (page « Le chat » au carnet, 6 habitudes, mêmes règles qu'un habitant) | 7 h à 10 h tonnelle d'Odette (au soleil); 10 h à 12 h guichet du fournil (les miettes d'Achille); 12 h à 15 h banc du quai (sieste); 15 h à 17 h devant la fenêtre d'Ambroise (il regarde les balanciers); 17 h à 19 h cour de la ferme (chez sa mère); pluie: sous le toit du puits; la nuit: hors carte (il chasse) |
| Caresser | 7.1, geste 30 |
| Il suit | 1 fois sur 20, il suit un joueur 20 s en marchant derrière lui |
| Trouvaille | une fois par semaine, il dépose devant la maisonnette une plume de geai ou un bouton de laiton (jamais une bête) |
| Aucune règle de soin | il n'a ni faim ni besoins; il ne s'en va jamais |

## 8. Actions et retours

| Action du joueur | Retour visuel | Retour sonore |
|---|---|---|
| Se tenir près d'un habitant à son habitude (2 s) | le crayon du carnet gratte dans le coin du HUD, notification « Carnet: … (vu par …) » chez les deux | `pencil-note`, doux |
| Lire un écriteau (Examiner) | panneau de l'écriteau en gros caractères, habitudes révélées soulignées au crayon | papier |
| Ouvrir l'onglet Voisins | grille de la semaine, cases hachurées pour l'inconnu, portrait plus ou moins coloré | page tournée (existant) |
| Survoler une case | infobulle (heure, lieu, ou « Tu ne sais pas encore… ») | aucun |
| Cliquer « Maintenant » | la case du moment s'éclaire; le lieu clignote sur la mini-carte du carnet si elle existe | aucun |
| Parler à un habitant | ses lanternes dans la bulle; +10 lien: la lanterne frémit | `bond-chime` léger, seulement au premier gain du jour |
| Offrir un objet | réaction selon le goût (visage, réplique); « Adore » au carnet; objet rendu s'il n'aime pas | `gift-happy`, `gift-polite` |
| Passer un niveau d'amitié | une lanterne s'allume, notification chez les deux | `bond-level` (petite volée de clochettes) |
| Souhaiter un anniversaire | l'habitant rayonne, petit bouquet au-dessus de lui | `birthday-chime` |
| Décision à deux | panneau chez les deux, choix de l'autre visible, tampon « Décidé ensemble » | tampon (existant), `decision-agree` |
| Désaccord | « Vous n'êtes pas du même avis: parlez-en. », les deux choix restent affichés | aucun (pas de son de refus) |
| Une habitude découverte qui change (décision) | l'ancienne se barre au crayon, la nouvelle s'écrit | `pencil-note` |
| Gestes de décor | table 7.1 | table 7.1 |
| Caresser le chat | il ferme les yeux, queue en l'air | `cat-purr` |
| Un habitant réagit à toi | bulle au-dessus de lui (2 s) | aucun, ou son de voix murmurée (motif de l'habitant, P1) |

## 9. Lots de production

Chaque lot ajoute ses réglages à `reglages.json` (clés `habits`, `bonds`, `village`) et ses textes à `textes.json` sous des clés à lui. Critères à rendre testables par qa-testeur.

| Lot | Qui | Contenu | Dépend de |
|---|---|---|---|
| **H0** Alignement de la carte | level designer | points de 1.3, cinq tombes nommées, écriteaux, trajets des 21 habitants (règle des 6 départs par minute), tas de feuilles, flaques, girouette, tourniquet, pompe | `v0-13-carte.md` L1 |
| **H1** Plannings et découverte (simulation) | dev gameplay | champ `habit`, `habits[]`, conditions de 3.1, calendrier (`calendrier.json`), anniversaires, règle d'observation 4.3, `reveal_habit`, écriteaux, rattrapage, fonction « maintenant » (4.7), annonce en marche (7.3), état et migration (4.9, 6.5) | H0 (des points provisoires suffisent pour commencer) |
| **H2** Amitié et cadeaux | dev gameplay | liens, gains et plafonds (6.2), goûts (« adore, aime, neutre, n'aime pas », rendu de l'objet), anniversaires, déblocages (6.1), panneau de décision à deux côté simulation (5.2) | H1 |
| **H3** Interface du carnet et de l'amitié | dev gameplay 2D, ux-ui | onglet Voisins (4.2), grille, hachures, « maintenant », goûts, histoire; lanternes dans la bulle; notifications; panneau de décision | H1, H2 |
| **H4** Données des habitants | dev gameplay (transcription), game designer (textes) | `habitants.json`: 14 nouveaux et Lucie, plannings et habitudes (sortie `--json` du script), répliques révélatrices (section 3.2), goûts, anniversaires; quotidien minimal des nouveaux: environ 23 répliques chacun (8 de premier niveau, 3 par temps, 2 par saison jouable), à écrire par le game designer dans une mission suivante (environ 350 phrases); `calendrier.json`; écriteaux; objets nouveaux: pomme (`apple`), galet troué (`holed_pebble`), ticket de quai (`platform_ticket`), bulbe de dahlia, bougie, lumignon, sac de charbon de bois, gourde de Barnabé, moufles, carte postale, beurre, sac de farine, pain de la vallée, tabouret, étagère d'angle, et les objets « Comme la famille » (6.4) | H1 pour les conditions (le validateur peut être étendu avant) |
| **H5** Quêtes de la 0.13.0 | dev gameplay | les 56 quêtes qui s'ouvrent jusqu'à Voisinage (dont les quatre décisions), conditions et effets de 5.6, scènes à deux; les 22 quêtes d'Amitié et de Grande amitié en 0.13.1 (un duo médian n'y arrive qu'après trois semaines de jeu au moins, section 5.7) | H1, H2, H4 |
| **H6** Modèles des habitants | artiste 3D, dev rendu | 14 habitants (2.3), sur le squelette commun, plafond de 3 600 triangles chacun (tour 10); accessoires: trois vélos poussés à la main (Lucie, l'abbé, Nour), loupe, accordéon (P1), hache, pot à lait, cartable, sifflet; le chat (quadrupède, animations `idle`, `walk`, `sleep`, `roll`); substituts dans `substituts.ts` | aucun |
| **H7** Vie du village | dev gameplay, dev rendu | gestes de décor (7.1: 18 en P0, les 12 autres en P1: 3, 5, 11, 12, 16, 20, 22, 23, 25, 26, 28, 29), scènes (7.2: S01 à S13 en P0, le reste en P1), réactions (7.3), le chat (7.4) | H1, H2, H6 (chat) |
| **H8** Son | sound-designer | 14 motifs d'habitants (P1), angélus (trois cloches, volée), harmonium, enclume, moulin, café, battoir, `pencil-note`, `bond-chime`, `bond-level`, `birthday-chime`, `decision-agree`, `cat-purr`, `plic`, écho | aucun |
| **H9** Recette | qa-testeur | critères ci-dessous, robots longue vie | tous |

**Ordre d'intégration**: H0 et H6 et H8 commencent tout de suite; H1, puis H2 et H4 en parallèle, puis H3, puis H5, puis H7, puis H9. Chaque lot se fusionne avec ses tests.

### 9.1 Critères d'acceptation proposés

| # | Critère | Vérification |
|---|---|---|
| HB-01 | Pour chaque habitant, chaque jour de la semaine, chaque saison et chaque temps, une entrée de planning tient de 6 h à 24 h | test sur les données (port du contrôle du script) |
| HB-02 | Les plannings de `habitants.json` sont identiques à la sortie `--json` du script | test de comparaison |
| HB-03 | Les six habitants de la démo sont aux mêmes points qu'avant aux jours 1 à 15, sur 8 graines | tests existants inchangés et robots |
| HB-04 | Un joueur immobile à 8 m de Firmin à la cloche, 2 s réelles, écrit l'habitude chez les deux, avec son prénom | test |
| HB-05 | À 12 m, ou à 8 m mais de l'autre côté d'une façade (un dedans, un dehors), rien ne s'écrit | test |
| HB-06 | Entendre une réplique révélatrice écrit l'habitude; une fois connue, cette réplique n'est plus tirée en priorité | test |
| HB-07 | Lire l'écriteau du café écrit ses quatre habitudes d'horaires | test |
| HB-08 | Une variante de pluie inconnue n'apparaît pas au carnet avant la première pluie depuis la rencontre, puis apparaît en « ? » | test |
| HB-09 | « Maintenant » ne dit jamais un lieu qui n'est pas au carnet (100 instants tirés, 20 habitants, carnet à moitié rempli) | test |
| HB-10 | Une habitude observable 10 jours sans être découverte est dite à la conversation suivante qui peut la dire | test |
| HB-11 | Le lien ne baisse jamais, sur 336 jours de robot, 20 graines | robot longue vie |
| HB-12 | Un cadeau « n'aime pas » revient au sac et note « N'aime pas » au carnet | test |
| HB-13 | Le jour de l'anniversaire, un cadeau adoré donne +120 | test |
| HB-14 | Jamais plus de 2 quêtes d'histoire en cours ni plus d'une neuve par jour (robot 336 jours) | robot |
| HB-15 | Chaque option des quatre décisions mène au bout de la suite et change les habitudes prévues (deux parties, une par option) | robot |
| HB-16 | Une décision sans accord reste ouverte; aucune ne se prend seule; un joueur absent la fait attendre | test |
| HB-17 | Aucun texte nouveau ne contient de tiret interdit ni de tournure genrée (validateur) | `valider_donnees.py` |
| HB-18 | Un geste de décor ne redit pas une réplique entendue par ce joueur dans les 7 derniers jours | test |
| HB-19 | Au plus 4 trouvailles de décor par joueur et par jour, aucune en aubrins | robot |
| HB-20 | Les budgets de rendu tiennent avec 21 habitants visibles au carrefour le dimanche à 11 h 30 (sortie de la messe) | mesure (G4) |
| HB-21 | Les calculs de chemin d'une minute de changement de poste restent dans le budget de trame que fixera l'architecte pour le PC de référence (6 départs au plus par minute) | mesure, à tester chez le client |
| HB-22 | Séance chez le client: au moins une fois, l'un lit le carnet pour dire à l'autre où trouver quelqu'un | observation |

## 10. Hors périmètre de la 0.13

Les étapes 5 des histoires (arcs suivants); les fêtes complètes (semailles, mi-été: cadre des fêtes du plan); l'hiver et la Veillée des contes tant que la limite de la partie est au jour 64; Gustave en personne; la famille Roux et le cantonnier (logis vides); les intérieurs des maisons (on y entre seulement par les scènes, règle du tour 10); la salle de bal du café à l'étage; romance avec les habitants (HA-05); toute perte d'amitié; les métiers du duo (plan des 100 heures); le carnet d'oiseaux complet (les jumelles ouvrent seulement l'idée); un deuxième chat.

## 11. Questions pour le client (par le manager)

1. **Des décisions à deux qui changent la suite (HA-08 bis).** Le cahier dit qu'un choix ne change jamais l'issue. Le client demande des quêtes dont l'issue change la suite d'un autre. Recommandation: garder HA-08 pour les choix de dialogue et ajouter quatre décisions à deux, où les deux joueurs doivent s'accorder, chaque option réussissant toujours et ne changeant que la variante de la suite et les habitudes de deux habitants (section 5.2).
2. **Vingt et un habitants plutôt que vingt.** Le café de la Côte posé par la carte demande sa cafetière (Colette). Recommandation: garder les vingt et un; si le client en veut vingt tout rond, Colette se retire sans rien casser (la manille retourne chez Odette).

Pour le manager (pas pour le client): la limite de la partie au jour 64 rend injouables cinq anniversaires et les habitudes d'hiver; à trancher avec la feuille de route.

## Annexe A. Sortie de la simulation

`python3 -I docs/jeux/jeu-1/simulations/v0_13_habitants.py` (environ 10 minutes sur la machine du studio, bibliothèque standard, graine fixe):

```text
Contrôles: aucune erreur

Points: 90 cités, 28 déjà sur la carte, 62 nouveaux
Nouveaux: barn_door, bird_hide, cafe_counter, cafe_door, cafe_terrace, cemetery_bench, cemetery_gate, cemetery_tap, charcoal_kiln, church_bell_rope, church_nave, church_porch, church_square, clearing_center, farm_door, farm_garden, farmyard, field_high_01, forest_cut, forest_edge_path, forest_pond, forester_bench, forester_house_door, forge_door, forge_inside, forge_yard, grave_cornu, grave_ferrand, grave_lacombe, grave_merigot, grave_valade, hamlet_house_a_door, hamlet_house_c_door, honorine_doorstep, honorine_window, joinery_yard, lookout, lucie_garden, mairie_desk, mill_door, mill_inside, mill_race_bank, mill_sluice, mill_yard, pasture_bank, pasture_gate, presbytery_door, priest_garden, rail_cottage_west_door, rail_cottage_west_window, school_lodging_door, school_yard, sexton_garden, sexton_house_door, shared_garden_plot, skittles_alley, spring, square_lime_tree, threshing_floor, vet_yard, vineyard, washhouse

Statistiques des plannings
| Habitant | Habitudes | Dont visibles | Heures visibles par jour (moyenne de l'année, temps tirés) | Apprises par dialogue | Par écriteau |
|---|---|---|---|---|---|
| Firmin Lacombe | 10 | 9 | 11.3 | 10 | 0 |
| Odette Ferrand | 11 | 8 | 12.5 | 11 | 4 |
| Basile Cornu | 11 | 9 | 9.6 | 11 | 0 |
| Jeanne Ribot | 15 | 13 | 9.4 | 15 | 1 |
| Achille Pradel | 10 | 8 | 8.1 | 10 | 3 |
| Solange Mérigot | 10 | 9 | 7.3 | 10 | 3 |
| Lucie Arnaud | 13 | 10 | 4.8 | 13 | 0 |
| Armand Castagné | 12 | 10 | 3.3 | 11 | 4 |
| Berthe Lavergne | 15 | 13 | 6.8 | 15 | 0 |
| Martial Roques | 12 | 9 | 5.5 | 12 | 1 |
| Marthe Bousquet | 13 | 12 | 9.1 | 13 | 1 |
| Honorine Valade | 14 | 13 | 7.9 | 14 | 0 |
| Inès Garrigue | 13 | 11 | 8.2 | 13 | 0 |
| Barnabé Tixier | 11 | 10 | 9.7 | 11 | 0 |
| Madeleine Cazals | 8 | 6 | 8.1 | 8 | 2 |
| Paulin Delmas | 14 | 12 | 11.0 | 14 | 0 |
| Margot Delmas | 14 | 13 | 9.0 | 14 | 0 |
| Léon Delmas | 17 | 15 | 6.3 | 17 | 1 |
| Ambroise Pélissier | 9 | 8 | 6.0 | 9 | 2 |
| Nour Belkacem | 12 | 9 | 6.4 | 11 | 2 |
| Colette Lafon | 11 | 8 | 9.8 | 10 | 4 |
| **Total** | **255** | | | | |

Découverte des habitudes (part connue, médiane)
règle proposée (vu, dialogues, écriteaux, rattrapage) (60 duos)
| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 34 % | 46 % | 25 % | 31 % | 14 % | 10 % | 12 % |
| 14 | 52 % | 67 % | 43 % | 62 % | 43 % | 19 % | 19 % |
| 21 | 64 % | 78 % | 59 % | 81 % | 57 % | 33 % | 31 % |
| 42 | 84 % | 91 % | 81 % | 100 % | 93 % | 62 % | 56 % |
| 63 | 92 % | 97 % | 90 % | 100 % | 93 % | 81 % | 75 % |
| 84 | 97 % | 99 % | 99 % | 100 % | 100 % | 90 % | 88 % |
| 168 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 336 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

sans rattrapage (60 duos)
| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 34 % | 46 % | 25 % | 38 % | 14 % | 14 % | 12 % |
| 14 | 50 % | 64 % | 42 % | 62 % | 36 % | 19 % | 25 % |
| 21 | 63 % | 75 % | 58 % | 88 % | 57 % | 33 % | 31 % |
| 42 | 84 % | 90 % | 83 % | 100 % | 93 % | 62 % | 56 % |
| 63 | 92 % | 96 % | 90 % | 100 % | 93 % | 81 % | 75 % |
| 84 | 96 % | 98 % | 94 % | 100 % | 100 % | 90 % | 88 % |
| 168 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| 336 | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |

vu seulement (60 duos)
| Jour | tout | routine | jour | pluie | saison | anniv | apres |
|---|---|---|---|---|---|---|---|
| 7 | 25 % | 38 % | 13 % | 12 % | 0 % | 5 % | 6 % |
| 14 | 34 % | 52 % | 20 % | 38 % | 0 % | 10 % | 6 % |
| 21 | 41 % | 60 % | 28 % | 50 % | 0 % | 14 % | 6 % |
| 42 | 56 % | 70 % | 46 % | 62 % | 64 % | 33 % | 6 % |
| 63 | 62 % | 76 % | 57 % | 75 % | 64 % | 38 % | 6 % |
| 84 | 66 % | 78 % | 61 % | 88 % | 79 % | 43 % | 6 % |
| 168 | 74 % | 83 % | 72 % | 100 % | 86 % | 57 % | 6 % |
| 336 | 79 % | 87 % | 83 % | 100 % | 93 % | 67 % | 6 % |

Amitié et suites de quêtes
| Duo | Règle | Étapes faites au jour 84 | Étapes par jour, j1 à 21 | j22 à 63 | j64 à 126 | j127 à 252 | j253 à 336 | Suites finies au jour 336 | Actives en moyenne (j1 à 84) | Habitants « Comme la famille » au jour 336 |
|---|---|---|---|---|---|---|---|---|---|---|
| tranquille | sans limite | 74 | 2.14 | 0.62 | 0.08 | 0.01 | 0.00 | 100 % | 4.0 | 17 |
| tranquille | 3 actives | 56 | 0.64 | 0.68 | 0.54 | 0.02 | 0.00 | 100 % | 3.0 | 17 |
| tranquille | règle proposée | 36 | 0.43 | 0.44 | 0.44 | 0.18 | 0.00 | 100 % | 1.9 | 17 |
| médian | sans limite | 77 | 2.76 | 0.40 | 0.03 | 0.00 | 0.00 | 100 % | 2.8 | 21 |
| médian | 3 actives | 76 | 0.95 | 1.00 | 0.24 | 0.00 | 0.00 | 100 % | 2.7 | 21 |
| médian | règle proposée | 51 | 0.57 | 0.60 | 0.57 | 0.02 | 0.00 | 100 % | 1.9 | 21 |
| assidu | sans limite | 78 | 3.19 | 0.21 | 0.02 | 0.00 | 0.00 | 100 % | 1.9 | 21 |
| assidu | 3 actives | 78 | 1.38 | 1.14 | 0.02 | 0.00 | 0.00 | 100 % | 1.9 | 21 |
| assidu | règle proposée | 68 | 0.76 | 0.83 | 0.43 | 0.00 | 0.00 | 100 % | 1.7 | 21 |

Jour médian de chaque étape (duo médian, règle proposée; part des duos qui l'ont faite au jour 336)
| Habitant | Étape 1 | Étape 2 | Étape 3 | Étape 4 |
|---|---|---|---|---|
| Firmin Lacombe | 28 (100 %) | 66 (100 %) | 92 (100 %) | 115 (100 %) |
| Odette Ferrand | 53 (100 %) | 76 (100 %) | 83 (100 %) | 95 (100 %) |
| Basile Cornu | 50 (100 %) | 60 (100 %) | 67 (100 %) | 91 (100 %) |
| Jeanne Ribot | 55 (100 %) | 64 (100 %) | 88 (100 %) |  |
| Achille Pradel | 35 (100 %) | 79 (100 %) | 106 (100 %) |  |
| Solange Mérigot | 28 (100 %) | 40 (100 %) | 48 (100 %) |  |
| Lucie Arnaud | 28 (100 %) | 56 (100 %) | 63 (100 %) | 96 (100 %) |
| Armand Castagné | 24 (100 %) | 50 (100 %) | 60 (100 %) | 110 (100 %) |
| Berthe Lavergne | 26 (100 %) | 53 (100 %) | 71 (100 %) | 86 (100 %) |
| Martial Roques | 36 (100 %) | 62 (100 %) | 82 (100 %) | 96 (100 %) |
| Marthe Bousquet | 26 (100 %) | 36 (100 %) | 93 (100 %) | 98 (100 %) |
| Honorine Valade | 27 (100 %) | 75 (100 %) | 97 (100 %) | 103 (100 %) |
| Inès Garrigue | 24 (100 %) | 55 (100 %) | 64 (100 %) | 72 (100 %) |
| Barnabé Tixier | 24 (100 %) | 35 (100 %) | 43 (100 %) | 90 (100 %) |
| Madeleine Cazals | 26 (100 %) | 36 (100 %) | 63 (100 %) | 84 (100 %) |
| Paulin Delmas | 28 (100 %) | 38 (100 %) | 82 (100 %) | 101 (100 %) |
| Margot Delmas | 20 (100 %) | 66 (100 %) | 75 (100 %) |  |
| Léon Delmas | 30 (100 %) | 61 (100 %) | 108 (100 %) |  |
| Ambroise Pélissier | 26 (100 %) | 62 (100 %) | 92 (100 %) |  |
| Nour Belkacem | 30 (100 %) | 62 (100 %) | 88 (100 %) | 98 (100 %) |
| Colette Lafon | 25 (100 %) | 75 (100 %) | 84 (100 %) | 103 (100 %) |
```

## Historique

| Version | Date | Changement |
|---|---|---|
| 1 | 2026-11-03 | première version (game-designer): 21 habitants, plannings, carnet, suites de quêtes, amitié, vie du village; lieux alignés sur `v0-13-carte.md` |
