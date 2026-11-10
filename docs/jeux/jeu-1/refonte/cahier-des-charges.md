# Cahier des charges: La Petite Ligne, la refonte

| Champ | Valeur |
|---|---|
| Identifiant | `la-petite-ligne` (paquet `games/la-petite-ligne`, version actuelle 0.13.0) |
| Statut | brouillon, à faire valider par le client |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-11-10 |
| Rédaction | game-designer (sections 1 à 6, 11, propositions des sections 12 à 14); sections 7 à 10 à compléter par leurs responsables |
| Sources | réponses du client aux 75 questions: `docs/jeux/jeu-1/refonte/reponses-client-2026-11-10.md` (fait foi; les renvois « R23 » désignent ses réponses); ressenti visé: `docs/jeux/jeu-1/refonte/references-de-ressenti.md`; simulation: `docs/jeux/jeu-1/simulations/refonte_besoins_economie.py` |
| Remplace | pour tout le contenu: `docs/jeux/jeu-1/cahier-des-charges.md` et les documents de conception 0.12 et 0.13, qui deviennent des archives |

> Ce document tranche et chiffre. Chaque valeur est une valeur de départ, réglable, rangée dans un fichier de configuration. Ce que le client doit encore décider est en section 14, avec une recommandation à chaque fois.

## En bref

- **Le jeu**: une vie tranquille à deux (potager, pêche, collections, déco, voisins attachants) portée par une vraie histoire, tendre, drôle et mystérieuse, qui vous mène en train de lieu en lieu.
- **Trois lieux écrits**: Aubrune (le bourg où l'on apprend tout), Hautefonte (la métropole), Combe-Veilleuse (le village abandonné et hanté). D'autres lieux viendront par mises à jour. Chaque lieu: une grande suite de quêtes, des suites secondaires mémorables, son logement, ses activités, ses fêtes. Objectif: 15 heures de jeu au moins par lieu.
- **Le fil rouge**: vous avez été embauchés comme gardes de la Petite Ligne par une lettre signée d'un homme disparu depuis trente ans, et le train qui vous a déposés ne figure sur aucun horaire.
- **Trois besoins qui comptent** (faim, sommeil, hygiène), simples: gêne sous 20 %, blocage à 0 %, petit bonus au-dessus de 50 %.
- **Prise en main refaite**: clavier seul pour marcher, une seule touche d'action, caméra proche qui tourne librement, pas de sac au début.
- **Page blanche pour le contenu**: les 78 quêtes, l'étal du marché, les métiers, la monnaie « aubrun » et les sauvegardes de la 0.13 disparaissent. Les habitants d'Aubrune qui servent la nouvelle histoire sont repris et réécrits.

## 1. Résumé (game-designer)

- **Pitch**: à deux, descendez d'un train que personne n'a vu passer, installez-vous dans la maison en ruine du garde-barrière et remontez la Petite Ligne de gare en gare pour comprendre qui vous a fait venir, en vivant dans chaque lieu une vie douce et une grande histoire.
- **Fantasme du joueur**: « Ce soir, on arrose, on pêche, on dîne chez nous à la table qu'on a fabriquée, et à 5 h 12 on guette ensemble, à la barrière, la lumière qui passe sur les rails. »
- **Genre**: jeu de vie tranquille et narratif en coopération.
- **Vue**: 3D, caméra proche du personnage, rotation libre à 360 degrés, zoom à la molette (R17). Rendu lisse et doux, comme une figurine (R46); proportions actuelles gardées (R45).
- **Mode à deux**: coopération libre. Chacun va où il veut (R9); on se retrouve pour le train, les repas à deux et les grandes scènes de l'histoire. Manifeste: `mode: coop`, résultat `progress`.
- **Durée d'une séance**: 1 heure à 1 h 30 (R1), soit deux à trois journées de jeu. On quitte à tout moment sans rien perdre.
- **Piliers**:
  1. **Une histoire qui nous emmène**: chaque lieu est une saison de feuilleton, avec un mystère, des rebondissements et une fin qui change le lieu.
  2. **Un quotidien qui répond**: chaque geste a un son, un mouvement, une particule; chaque prise nouvelle se fête; rien ne meurt.
  3. **Des gens qu'on n'oublie pas**: des habitants au caractère marqué, qui se souviennent de ce que vous avez fait.

### 1.1 Public et séance type

Un couple, dans la même pièce, de niveaux de jeu différents. Séance type de 75 minutes:

| Minutes | Ce qui se passe |
|---|---|
| 0 à 5 | Réveil à la maison, 6 h. Petit déjeuner, toilette, coup d'œil au potager et au poulailler |
| 5 à 30 | Journée 1: chacun de son côté (une étape de quête, pêche, ventes), on se raconte à voix haute ce qu'on découvre |
| 30 à 35 | Soir: on cuisine, on dîne, on se couche (ou on veille: la nuit se joue) |
| 35 à 65 | Journée 2: une scène d'histoire à deux, un achat pour la maison, dix minutes de déco |
| 65 à 75 | Soir ou début de nuit: on range, on se couche, la sauvegarde se fait au coucher |

### 1.2 Ce qui change par rapport à la 0.13

| Sujet | 0.13 | Refonte | Réponse |
|---|---|---|---|
| Structure | un bourg, une vallée | des lieux reliés par le train, une histoire par lieu | R6, R75 |
| Quêtes | 78 petites quêtes d'habitants | une suite principale et 6 suites secondaires longues par lieu, très peu de petites demandes | R27, R40, R70 |
| Journée | 17 minutes | jour de 30 minutes, nuit jouable de 20 minutes | R3, R4 |
| Besoins | lus sur le visage, bonus seulement | trois jauges avec malus, blocage et bonus | R23 |
| Déplacement | clavier et clic | clavier seul, caméra libre | R16, R17 |
| Action | barre d'outils et gestes multiples | une touche contextuelle | R18 |
| Sac | 10 cases | aucun sac au début, puis 4, 6, 10, 15, 20; piles limitées | R20 |
| Outils | inusables | de base inusables et lents; améliorés qui s'usent et se réparent | R19 |
| Argent | « aubruns », bourse commune | « sous », une bourse par joueur, un coffre commun | R10, R13 |
| Vente | étal du marché | uniquement aux commerçants, selon leur métier, à des prix différents | R34 |
| Dialogues | bulles | bandeau bas avec portrait, lettre par lettre, babil | R37, R38, R63 |
| Amitié | lanternes | cœurs visibles | R39 |
| Maison | maisonnette | ruine à restaurer et agrandir, mode déco vu du dessus | R11, R52, R54 |
| Personnages | modèles fixes | catalogue de pièces à assembler, vrai éditeur | R47 à R51 |

### 1.3 Ce qui est abandonné

L'étal du marché, les cinq métiers et le « regard du métier », la bourse et le cellier communs, le carnet des habitudes des voisins (plannings à découvrir), les 78 quêtes et les scènes du village, le musée ou toute exposition de collections hors du carnet (R55), la décoration du bourg (R53), les émotes et signaux entre joueurs (R14), le déplacement au clic, la caméra à quatre angles, les sauvegardes existantes (R7). La commande du train du samedi est gardée, sans échec possible.

### 1.4 Création originale

Le client cite deux références de genre: un jeu de vie paisible très connu (pour le quotidien) et les versions portables d'un jeu de simulation de vie (pour l'histoire guidée et le ton). On garde le genre et l'intention. Ce qui nous distingue: une ligne de train qu'on remonte, des habitants humains, un couple de joueurs embauchés (ni héritage, ni panne, ni dette envers un commerçant), une monnaie et des noms à nous, pas de musée, pas de voisins animaux. Points de vigilance signalés au manager en section 14 (babil, confidences, logement du troisième lieu).

## 2. Expérience à deux (game-designer)

### 2.1 Rôles et interactions

- Aucun rôle imposé: les deux personnages savent tout faire. Chacun a son sac, sa bourse, ses besoins, ses tenues, ses cœurs d'amitié.
- En commun: l'histoire (une étape franchie par l'un vaut pour les deux), le logement, le coffre commun, le carnet des collections (une prise de l'un s'inscrit pour les deux, avec le prénom de qui l'a trouvée), les plans et les recettes.
- Liberté totale de déplacement dans le lieu (R9). Trois moments demandent d'être ensemble: prendre le train, sauter la nuit en dormant, partager un repas spécial.
- Tout geste « à deux » (porter une poutre, scier, lever une vanne) reste faisable seul: à deux il va deux fois plus vite et rapporte 50 % de plus (R12). Exceptions justifiées, listées en 6.3: le train, le repas spécial et les quatre scènes de dénouement.

### 2.2 Ce que montre chaque écran

| Information | Chez les deux | Chez un seul |
|---|---|---|
| Heure, jour, saison, météo | oui | |
| Bourse, besoins, sac, barre d'outils | | les siens |
| Dialogue courant (bandeau bas) | pendant les scènes d'histoire à deux | pendant une conversation ordinaire; l'autre voit trois points au-dessus des têtes |
| Position de l'autre joueur | sur la carte plein écran | |
| Scènes asymétriques (6.3) | | chacun voit la moitié de l'information: l'un lit les étiquettes des leviers, l'autre voit le signal |

### 2.3 Ce qu'on a intérêt à se dire

« Achille paie les œufs 10, pas 6 », « j'ai trouvé une clé dans la cave », « viens, il pleut, la truite sort », « attends-moi pour dîner ». Les scènes asymétriques obligent à se décrire ce qu'on voit. Rien à l'écran ne remplace la parole (R14).

### 2.4 Niveaux de jeu différents

- **Aide réglable par joueur**, trois crans (Normal, Coup de pouce, Grand coup de pouce), dans les options, changeable à tout moment, jamais montrée à l'autre: elle élargit les fenêtres des mini-jeux (pêche, cuisine, filet, musique) de 0, 25 et 50 %.
- Aucun classement, aucun compteur comparé entre les deux joueurs. Les collections sont communes.
- Un mini-jeu raté ne coûte jamais d'objet rare: au pire un appât, ou un plat « simple » au lieu de « réussi ».
- Le joueur le plus à l'aise peut prendre le poste difficile d'une scène à deux; les postes s'échangent librement.

## 3. Boucles de jeu (game-designer)

- **Boucle de 30 secondes**: je vois une cible réagir (elle brille, une bulle dit l'action), j'appuie sur Espace, le geste répond (son, rebond, particules), l'objet rejoint mon sac ou la prise se fête.
- **Boucle d'une journée (30 minutes)**: se lever, manger, se laver; avancer une étape d'histoire ou une activité; remplir ses poches; vendre au bon commerçant; acheter ou fabriquer quelque chose pour soi ou pour la maison; dîner; dormir ou veiller.
- **Boucle d'un lieu (15 heures et plus)**: arriver en train, recevoir un logement, rencontrer les habitants, ouvrir les zones du lieu avec les actes de l'histoire, dénouer le mystère, voir le lieu changer (il se repeuple, il s'embellit), recevoir la prochaine destination.
- **Entre les lieux**: personnages, sacs, bourses, coffre commun, outils, tenues, collections, recettes, plans et amitiés se gardent. On revient en arrière quand on veut: les lieux déjà visités continuent de vivre (saisons, fêtes, suites secondaires restantes).

## 4. Règles (game-designer)

### 4.1 Les lieux et le train

| Règle | Valeur | Raison |
|---|---|---|
| Voyager | les deux personnages sur le quai, chacun valide « Monter » à la portière; l'un attend l'autre sans limite de temps | R9: seul moment où l'on doit être ensemble |
| Départs | à toute heure du jour entre 6 h et 20 h, dès que la ligne vers ce lieu est rouverte par l'histoire | pas d'attente subie |
| Durée | 2 heures de jeu ajoutées à l'horloge; à l'écran, une scène de wagon de 20 à 40 secondes (le temps de charger le lieu) où l'on peut parler au contrôleur | le trajet a un coût léger et un charme |
| Prix | gratuit avec la carte de ligne reçue à la fin d'Aubrune | l'argent sert à la maison, pas au billet (R33) |
| Retour | toujours possible vers tout lieu déjà rouvert | R6 |
| Train du samedi | à Aubrune, chaque samedi à 10 h: la commande de la semaine (3 à 5 lignes d'objets, payée en sous, ce qui manque est reporté sans pénalité), le courrier, parfois un nouvel habitant | décision du premier tour |
| Une seule horloge | l'heure, le jour, la saison et la météo sont les mêmes dans tous les lieux; seul le lieu où se trouvent les joueurs est simulé en détail | simple à comprendre et à sauvegarder |
| Pendant l'absence | le potager pousse sans faner, le poulailler garde ses œufs jusqu'à la limite du pondoir, les habitants avancent leur calendrier | rien ne punit le voyage |

Ce qui persiste d'un lieu à l'autre: les deux personnages (apparence, tenues, besoins), les sacs et leur contenu, les bourses, le coffre commun (un guichet de consigne dans chaque gare donne accès au même coffre), les outils, le carnet (collections, recettes, plans, confidences), les cœurs d'amitié. Ce qui reste dans un lieu: le logement et ses meubles, le potager, les bêtes, les coffres de rangement.

### 4.2 Le logement

| Lieu | Logement | Agrandissement | Décor extérieur |
|---|---|---|---|
| Aubrune | la maison du garde-barrière, en ruine | restauration par l'histoire (première pièce), puis cuisine, chambre, troisième pièce, étage, payés au coffre commun (4.6) | jardin autour de la maison seulement (R53) |
| Hautefonte | un appartement de fonction de la Compagnie, donné | aucun (R11); toute la décoration est libre | un balcon |
| Combe-Veilleuse | un wagon de service garé sur la voie de garage, à aménager | la maison du chef de gare s'ajoute au fil de l'histoire | le bout de quai devant le wagon |

- **Place** (R32): chaque logement terminé loge sans gêne le nécessaire (deux lits ou un lit double, table et deux chaises, cuisine complète de 3 m de linéaire, coin toilette, établi, deux coffres) et garde au moins 40 % de sol libre pour décorer. Repère pour le level-designer: maison d'Aubrune finie, 85 m² au sol plus l'étage; appartement, 70 m²; wagon, 30 m².
- **Mode déco** (R52): dans le logement, la touche B passe en vue du dessus; les meubles se glissent à la souris, tournent par quarts de tour à la molette, se rangent dans l'inventaire de la maison. Les deux joueurs peuvent décorer en même temps; un meuble tenu par l'un est verrouillé pour l'autre.
- **Meubles**: par séries assorties en plusieurs couleurs (R57). Fabriqués à l'établi sur plans dans les villages, achetés en métropole, certains seulement achetables (R59).
- **Logement lié à l'intrigue**: chaque pièce restaurée livre un indice de l'histoire (5.2). Une pièce n'est jamais qu'un achat.

### 4.3 Le temps

| Valeur | Départ | Plage | Raison |
|---|---|---|---|
| Une heure de jeu | 125 secondes réelles | 100 à 150 | donne exactement les durées demandées (R3) |
| Jour | de 6 h à 20 h 30: 30 minutes réelles | | |
| Nuit jouable | de 20 h 30 à 6 h: 20 minutes réelles | | R3, R4 |
| Dormir pour passer au lendemain | à partir de 15 h, quand les deux personnages sont au lit: fondu, réveil à 6 h | 15 h fixe | R3 |
| Sieste | à toute heure, seul, sur un lit ou un banc: le temps ne saute pas, le sommeil remonte (4.4) | | permet à l'un de dormir pendant que l'autre veille |
| Sans dormir | la nuit passe, 6 h sonne, le jour suivant commence où que l'on soit (R4) | | |
| Semaine | 7 jours, du lundi au dimanche; le samedi est le jour du train | | |
| Saison | 14 jours de jeu, soit 2 semaines | 14 à 21 | R5; une année de 56 jours dure environ 33 heures réelles si l'on dort presque chaque nuit |
| Météo | tirée chaque matin par saison: beau, couvert, pluie, brume, neige (hiver) | | sert la rareté (R58) |
| Pause | Échap (pause de Duo): l'horloge s'arrête pour les deux | | |
| Dialogue ordinaire | l'horloge continue; les besoins du joueur qui lit sont figés | | on ne perd rien à lire |
| Scène d'histoire à deux | horloge et besoins figés | | |

Rareté (R58): chaque entrée de collection porte une plage d'heures, une ou plusieurs météos, une ou plusieurs saisons et un lieu. Le carnet affiche ces conditions dès qu'un habitant en a parlé ou après la première prise. Coup de pouce: une entrée jamais prise a un poids multiplié par 4 quand ses conditions sont réunies (apprentissage du carnet du game-designer: sans cela, les derniers 10 % d'une collection prennent 2 à 4 fois plus de temps que le reste).

### 4.4 Les besoins (R23 à R26)

Trois jauges de 0 à 100 par joueur. Elles n'apparaissent à l'écran que lorsqu'elles changent de palier, quand on maintient la touche Alt, et en permanence sous 20 (R60 et note de ressenti).

| Palier | Faim | Sommeil | Hygiène |
|---|---|---|---|
| 0: bloqué | vitesse à 50 %; la touche d'action ne sert plus qu'à manger (et à parler à un commerçant de bouche); le personnage se tient le ventre | vitesse à 50 %; la touche d'action ne sert plus qu'à s'allonger (lit, banc, herbe); il bâille | des mouches tournent autour du personnage; les habitants refusent la conversation (étapes de quête, cadeaux, petites demandes); les commerçants servent quand même, en se pinçant le nez |
| 1 à 20: malus | vitesse à 80 %, gestes d'outil 25 % plus lents | vitesse à 80 %, fenêtres des mini-jeux réduites de 20 % | chaque habitant fait une remarque (écrite pour lui), aucun point d'amitié gagné, une étape de quête sur dialogue échoue et se retente une fois lavé |
| 21 à 50: neutre | rien | rien | rien |
| 51 à 100: bonus | **Bien nourri**: gestes d'outil 15 % plus rapides | **Bien reposé**: marche et course 10 % plus rapides, fenêtres de pêche et de filet 15 % plus larges | **Soigné**: points d'amitié gagnés multipliés par 1,2 |
| Les trois au-dessus de 50 | **En pleine forme**: chance de trouver une entrée rare multipliée par 1,25 | | |

Les cinq bonus cochés par le client (R24) y sont tous, chacun attaché à une jauge. Un bonus dure tant que sa jauge reste au-dessus de 50 (R25). Aucun bonus ne dépasse 25 %: on ne devient pas un dieu parce qu'on a dîné.

| Valeur | Départ | Plage | Raison |
|---|---|---|---|
| Faim: perte au repos | 2,0 points par minute réelle | 1,5 à 2,5 | de 100 à 0 en 50 minutes, soit un jour et une nuit |
| Faim: pendant un effort (outil, course) | perte multipliée par 1,5 | 1,2 à 2 | manger a du sens quand on travaille |
| Sommeil: perte éveillé | 1,6 point par minute | 1,3 à 2 | 52 après une journée, 20 après une journée et une nuit blanche: la nuit blanche se paie pile à l'aube |
| Hygiène: perte | 1,0 point par minute, plus 1 point par geste salissant (bêcher, fouiller, poulailler, pêche, pluie de boue) | | une toilette par jour suffit |
| Nuit au lit (saut) | sommeil à 100 (à 80 sur une paillasse), faim moins 15, hygiène moins 10 | | on se lève avec l'envie d'un petit déjeuner |
| Sieste | plus 6 points de sommeil par minute réelle | 4 à 10 | de 20 à 60 en moins de 7 minutes |
| En-cas (fruit, pain) | faim plus 10 à plus 25 | | |
| Plat simple (réchaud) | faim plus 35 | | 2 à 3 par jour tiennent la faim au-dessus de 50 |
| Plat cuisiné (vraie cuisine) | faim plus 50 à plus 70, selon la réussite du mini-jeu | | |
| Repas spécial à deux | faim à 100 pour les deux, plus un bonus exclusif (ci-dessous) | | R26 |
| Se débarbouiller (pompe, rivière, fontaine) | hygiène plus 40, plafonnée à 60, geste de 4 secondes | | disponible dès le premier jour |
| Baquet (maison d'Aubrune) | hygiène à 100, 10 secondes | | |
| Douche ou bain (salle d'eau, bains publics de Hautefonte, source chaude de Combe-Veilleuse) | hygiène à 100, 6 secondes; avec un savon parfumé: bonus Soigné porté à 1,3 jusqu'à ce que la jauge repasse sous 50 | | un petit puits d'argent agréable |

**Repas spéciaux à deux** (R26): de gros repas en 4 étapes, cuisinés dans une vraie cuisine sur deux postes en même temps (l'un coupe pendant que l'autre remue; seul, on enchaîne les deux postes, deux fois plus longtemps), puis servis à table. Les deux s'assoient: une animation de repas de 15 secondes (on trinque, on se sert, vapeur et petits bruits de couverts). Le bonus exclusif vaut pour les deux tant que la faim de chacun reste au-dessus de 50.

| Repas spécial | Lieu d'origine | Bonus exclusif |
|---|---|---|
| Pot-au-feu du dimanche | Aubrune | **Bonne étoile**: une prise sur dix donne un exemplaire en plus |
| Tourte de la halte | Aubrune | **Mains sûres**: les outils améliorés ne s'usent pas |
| Friture du canal | Hautefonte | **Beau parleur**: les commerçants paient 10 % de plus |
| Fondue des veilleurs | Combe-Veilleuse | **Yeux de chat**: de nuit, les entrées rares se signalent par un scintillement |

Résultats de la simulation (60 journées, graine fixe):

| Profil | Habitudes | Faim en bonus | Sommeil en bonus | Hygiène en bonus | En pleine forme | Temps bloqué |
|---|---|---|---|---|---|---|
| Régulier | mange dès 55, dort chaque nuit, se lave dès 60 | 100 % | 100 % | 100 % | 100 % | 0 % |
| Tête en l'air | mange à 20, dort 6 nuits sur 10, se lave à 20 | 15 % | 67 % | 63 % | 6 % | 0 % |
| Noctambule | joue toutes les nuits, fait des siestes | 86 % | 24 % | 100 % | 21 % | 0 % |

Lecture: qui s'occupe de soi (2,5 plats simples et 1,3 toilette par journée) garde ses bonus toute la journée; qui néglige perd les bonus sans jamais être bloqué tant qu'il réagit au malus; le blocage à 0 ne touche que celui qui ignore le malus pendant plus de 6 minutes réelles (faim sous effort) à 12 minutes (sommeil). Veiller toutes les nuits est permis et coûte 1,7 sieste par journée.

### 4.5 Sac, barre d'outils, piles, outils

**Barre d'outils**: 5 emplacements dès le début, pour les outils comme pour les objets. Il n'y a pas de sac au départ (R20): les poches sont la barre. Un objet ramassé sans place reste au sol, brille, et une bulle dit « Poches pleines ».

| Sac | Cases en plus de la barre | Où | Prix |
|---|---|---|---|
| Besace | 4 | Aubrune, offerte par Solange à l'acte 1 | quête |
| Sac de toile | 6 | Aubrune, mercerie de Solange | 350 sous |
| Sac à dos | 10 | Aubrune, mercerie, après l'acte 2 | 900 sous |
| Sac de voyage | 15 | Hautefonte, grand magasin | 2 500 sous |
| Malle à bretelles | 20 | Combe-Veilleuse, plan trouvé, fabriquée à l'établi | matériaux |

Un sac remplace le précédent (repris à moitié prix). Les lieux suivants pourront monter à 25 et 30. À la maison: coffres de rangement de 20 cases (plan de Basile), mêmes piles.

| Famille d'objets | Pile maximale | Raison |
|---|---|---|
| Poisson, par espèce | 3 | R20 |
| Bûche | 5 | R20 |
| Planche | 10 | R20 |
| Pierre, ferraille | 5 | lourd |
| Légume, fruit, par espèce | 10 | une récolte de planche tient en une case |
| Œuf | 6 | fragile |
| Fleur, champignon, baie | 10 | |
| Insecte, par espèce | 3 | comme les poissons |
| Coquillage, plume | 10 | |
| Fossile, trésor | 1 | chaque trouvaille compte |
| Graines, par espèce | 20 | |
| Appât, fil, clous, pellicule | 20 | consommables |
| Plat cuisiné, par recette | 3 | |
| Repas spécial | 1 | se mange à table |
| Meuble, vêtement, outil | 1 | |

**Outils** (R19). Les outils de base ne s'usent jamais et sont lents. Un outil amélioré remplace l'outil de base, travaille mieux et s'use; à 0 d'usure il est « émoussé »: toujours utilisable, mais plus lent que l'outil de base, jusqu'à réparation.

| Outil | De base (inusable) | Amélioré | Fin (Hautefonte) | Usure de l'amélioré | Émoussé | Réparation |
|---|---|---|---|---|---|---|
| Hache | arbre en 6 coups | 4 coups | 2 coups | 120 coups | 9 coups | meule de la forge: geste de 5 secondes, gratuit chez Mado, ou pierre à aiguiser (20 sous) n'importe où |
| Bêche (potager, fouilles) | 1 case par geste, 2 s | 3 cases en ligne | 9 cases | 150 gestes | 1 case, 3 s | meule, comme la hache |
| Arrosoir | 3 cases par plein | 9 cases | 18 cases | 200 arrosages | fuit: 1 case par plein | rustine d'étain (15 sous chez Mado), posée à l'établi |
| Canne à pêche | zone de tension étroite | zone 30 % plus large | 60 % plus large | 60 prises | zone plus étroite que la canne de base | bobine de fil neuf (25 sous, épicerie) |
| Filet à insectes | portée 1 m | 1,5 m | 2 m | 80 coups | troué: une prise sur deux s'échappe | ficelle (10 sous), raccommodé à la maison ou chez Solange |
| Marteau (restauration, établi) | fabrication en 8 s | 5 s | 3 s | 100 fabrications | 12 s | manche neuf: 1 planche, à l'établi |
| Appareil photo | 6 poses par pellicule | 12 poses, zoom | 24 poses | ne s'use pas | | pellicule (30 sous) |
| Instrument | 3 airs | 6 airs | tous les airs | ne s'use pas, se désaccorde après 20 airs (fausses notes comiques) | | accordé par Armand, gratuit, ou soi-même avec un diapason (plan) |

Prix: amélioré 300 sous et des matériaux, à la forge de Mado ou chez l'artisan concerné; fin 1 200 sous à Hautefonte. L'usure restante se lit sur l'icône de l'outil (un liseré qui se vide), jamais par un chiffre.

### 4.6 Économie

**Nom de la monnaie** (R13): trois propositions.

| Nom | Pour | Contre |
|---|---|---|
| **le sou** (recommandé) | compris en une seconde, vaut partout (bourg, métropole, village des fantômes), riche en expressions pour les dialogues (« sans le sou », « sou à sou », « pas un sou de bon sens ») | mot courant, peu distinctif |
| le poinçon | propre à l'univers du train (le trou du contrôleur dans le billet), original | demande une explication, moins naturel dans une épicerie |
| le rond | familier et drôle (« il n'a plus un rond ») | registre trop argotique pour les personnages âgés ou guindés |

Nom écarté: tout ce qui évoque une clochette ou un grelot, trop proche de la monnaie du jeu de référence. La suite du document compte en sous.

- **Bourse** par joueur; **coffre commun** au logement et aux guichets de consigne des gares (R10). Chacun y verse et en retire librement. Le coffre commun paie seul les achats du foyer (pièces de la maison, cuisine, salle d'eau, établi); ces achats peuvent se compléter par les bourses. Tout le reste se paie de sa bourse.
- **Vente** (R34): uniquement aux commerçants, dans le thème de leur métier. Chacun affiche à son ardoise ce qu'il achète. Ce qu'il n'achète pas, il le dit avec son caractère (« Du goujon ? Ça sent la vase. »). Chaque matin, chaque commerçant a un **besoin du jour** écrit à la craie devant sa boutique: cet objet est payé 50 % de plus.
- **Boutiques** (R64): un menu en images, deux onglets (Acheter, Vendre), les objets vendables du sac déjà triés, le prix de ce commerçant sous chaque objet, un bouton « Tout vendre de cette sorte ».

Prix d'achat par les commerçants d'Aubrune (en sous, « non » = n'achète pas):

| Objet | Odette, épicerie | Achille, fournil | Colette, café | Basile, menuiserie | Mado, forge | Solange, mercerie | Armand, école |
|---|---|---|---|---|---|---|---|
| Œuf | 6 | 10 | 7 | non | non | non | non |
| Radis | 5 | non | 7 | non | non | non | non |
| Carotte | 8 | non | 11 | non | non | non | non |
| Pomme | 6 | 9 | 6 | non | non | non | non |
| Goujon | non | non | 12 | non | non | non | non |
| Truite | 20 | non | 30 | non | non | non | non |
| Girolle | 10 | non | 16 | non | non | non | non |
| Bûche | non | 5 | non | 6 | 4 | non | non |
| Planche | non | non | non | 14 | non | non | non |
| Ferraille | non | non | non | non | 15 | non | non |
| Plume | non | non | non | non | non | 8 | 4 |
| Fleur des champs | 4 | non | 5 | non | non | 6 | non |
| Coquille de rivière | non | non | non | non | non | 12 | 6 |
| Insecte commun | non | non | non | non | non | non | 10 |
| Insecte rare | non | non | non | non | non | non | 40 |
| Fossile en double | non | non | non | non | non | non | 60 |
| Soupe de légumes (plat) | 20 | non | 35 | non | non | non | non |

Lecture: l'épicerie prend presque tout ce qui se mange, au prix le plus bas; l'artisan qui en a vraiment besoin paie 40 à 70 % de plus. C'est l'exemple du client (l'œuf), généralisé. Une pile vendue au bon endroit vaut 50 sous en moyenne.

Puits d'argent (R33): le logement, les meubles et la décoration, les vêtements, les outils, les sacs, les consommables. Embellir un lieu et rouvrir la ligne ne s'achètent jamais: ce sont des récompenses de quêtes.

| Dépense | Prix | Payé par |
|---|---|---|
| Pain (faim plus 25) | 12 | bourse |
| Plat du jour au café (faim plus 50) | 30 | bourse |
| Sachet de 5 graines | 10 à 40 | bourse |
| Savon parfumé | 15 | bourse |
| Vêtement | 60 à 400 | bourse |
| Meuble | 40 à 600 | bourse ou coffre |
| Outil amélioré | 300 | bourse |
| Maison d'Aubrune: cuisine | 1 500 | coffre commun |
| Maison d'Aubrune: chambre | 3 000 | coffre commun |
| Maison d'Aubrune: troisième pièce | 4 500 | coffre commun |
| Maison d'Aubrune: étage | 8 000 | coffre commun |
| Salle d'eau (baquet remplacé par une douche) | 1 200 | coffre commun |

Résultats de la simulation (deux joueurs, la moitié des gains versée au coffre, 10 % du coffre en meubles):

| Revenu d'un joueur | Sous par journée (40 % du temps à récolter et vendre) |
|---|---|
| sans sac, outils de base | 218 |
| besace de 4 | 267 |
| sac de 6, outils améliorés | 395 |
| sac de 10, outils améliorés | 411 |

| Palier atteint au jour de jeu | Duo tranquille (25 % du temps) | Duo médian (40 %) | Duo appliqué (55 %) |
|---|---|---|---|
| Sac de 6 pour chaque joueur | 5 | 7 | 3 |
| Cuisine | 11 | 7 | 6 |
| 3 outils améliorés par joueur | 16 | 9 | 7 |
| Sac de 10 pour chaque joueur | 23 | 14 | 11 |
| Chambre | 26 | 16 | 12 |
| Troisième pièce | 47 | 28 | 21 |
| Étage | 83 | 51 | 37 |

Lecture: le sac agrandit surtout le confort (moins d'allers-retours), ce sont les outils qui augmentent le revenu. Le duo médian a sa cuisine quand l'histoire lui apprend les repas à deux (acte 2), et son étage vers la fin de la première année de jeu: la maison reste un but au long cours, y compris quand on revient à Aubrune depuis un autre lieu. Le modèle est grossier (revenu moyen par pile, pas de fêtes ni de commandes du samedi): à recaler au prototype.

### 4.7 Activités

Chaque activité existe dans une forme adaptée au lieu (R28). Règles communes: une touche; une prise nouvelle est fêtée (le personnage la montre, un jingle, une ligne de texte, l'entrée s'écrit au carnet); une prise connue va vite.

| Activité | Règle | Aubrune | Hautefonte | Combe-Veilleuse |
|---|---|---|---|---|
| Potager (R30) | rien ne meurt; une plante mûrit en 2 à 6 jours; un jour arrosé (ou de pluie) compte double et monte la qualité; 6 cases, puis 12, puis 24 | oui | jardinières du balcon (4 cases) | potager de la gare (8 cases), légumes de brume |
| Pêche (R29) | mini-jeu en trois temps: viser l'ombre (jauge de lancer), ferrer au bon plongeon du bouchon (il y a des feintes), puis tenir la ligne: le poisson tire à gauche ou à droite, on contre avec Q et D pour garder la tension dans la zone, on mouline avec Espace quand il fatigue. Ligne trop tendue 1,5 s: il s'échappe, on perd l'appât. Durée: 15 à 45 secondes selon l'espèce. À deux: l'autre peut donner le coup d'épuisette final (prise de qualité supérieure) | rivière, bief, étang | canal et port | lac de brume, de nuit surtout |
| Insectes (R28) | approche lente (marcher sans courir), coup de filet dans la fenêtre | prés, bois | papillons du parc, pigeons bagués à photographier plutôt qu'à attraper | lucioles et papillons de nuit |
| Fouilles | un sol qui scintille, la bêche, parfois un fossile en plusieurs morceaux à assembler au carnet | le long de la voie, la Côte | les puces du dimanche: on chine dans des caisses (même mini-jeu, sans pelle) | les ruines |
| Coquillages et rivière | ramassage au bord de l'eau, selon l'heure et la pluie | berges | quais à marée basse | rives du lac |
| Photo | cadrer un sujet demandé ou un point de vue; les photos se collent au carnet et se posent en cadre à la maison | paysages, habitants | scènes de rue | ce que l'œil ne voit pas (5.4) |
| Musique | mini-jeu de rythme à quatre touches (Q, S, D, F); à deux, deux instruments, un duo | fanfare de la halte | cabaret, musiciens de rue | kiosque |
| Cuisine (R32) | réchaud: une étape (retirer du feu dans la fenêtre), plats simples; vraie cuisine: 2 à 4 étapes (couper en rythme, régler le feu, assaisonner), trois réussites (simple, réussi, parfait), jamais de plat perdu | réchaud puis cuisine | cuisine de l'appartement, recettes de brasserie | poêle du wagon, recettes anciennes |
| Basse-cour (R31) | autonome: une trémie de 20 rations, chaque poule mange une ration et pond un œuf par jour dans un pondoir de 12. Deux gestes: remplir, ramasser tout. Un panneau unique en 3D montre les poules (nom, humeur), le niveau de grain, les œufs. Le niveau de grain se voit aussi sur la trémie dans le monde. Sans grain, elles ne pondent plus, rien d'autre. Caresser une poule: une chance sur dix d'un œuf roux le lendemain. 4 poules, puis 6, puis 8 | oui | non | non (une chouette apprivoisée, à nourrir, qui rapporte un objet par nuit) |
| Fabrication (R59) | à l'établi, sur plans (quêtes, amitié, fouilles, achat); matériaux en piles | meubles de campagne, coffres, outils | peu de fabrication: on achète | plans anciens, lanternes |

**Petites activités propres au lieu** (R13), qui rapportent un peu d'argent ou de ressources, toujours rejouables:

| Lieu | Activités |
|---|---|
| Aubrune | quilles au café (20 à 60 sous); course de draisine sur la voie, à deux en pompant en alternance, ou seul contre le chrono; ricochets au bief; ramassage des balles de foin chez les Delmas |
| Hautefonte | service du midi à la brasserie (prendre et porter les commandes, pourboires); tir à la ficelle de la fête foraine; course de triporteurs; lâcher de journaux à vélo |
| Combe-Veilleuse | cache-cache avec les enfants fantômes; partie de cartes contre un revenant mauvais perdant; allumer les veilleuses de la grand-rue avant minuit |

**Événements** (R35), un par saison et par lieu, de 10 h à 22 h, sans rien à rater (ils reviennent chaque année):

| Lieu | Printemps | Été | Automne | Hiver |
|---|---|---|---|---|
| Aubrune | Fête des barrières fleuries | Nuit des lumignons | Concours de la soupe | Veillée du premier train |
| Hautefonte | Grande braderie | Bal des quais | Salon de la radio | Vitrines de fin d'année |
| Combe-Veilleuse | Réveil du lac | Bal du kiosque | Nuit des veilleuses | Grand silence |

### 4.8 Collections

Dans le carnet seulement (R55), communes aux deux joueurs. Liste de R56:

| Collection | Aubrune | Hautefonte | Combe-Veilleuse | Comment |
|---|---|---|---|---|
| Poissons | 16 | 10 | 10 | pêche |
| Insectes | 16 | 6 | 12 | filet |
| Fossiles et trésors | 12 | 10 | 14 | fouilles, puces |
| Fleurs | 12 | 6 | 8 | cueillette (pas de croisement: non coché en R28) |
| Tenues | 15 pièces par catégorie au total du jeu (R50), réparties entre les lieux | | | boutiques, cadeaux, quêtes |
| Recettes | 18 | 14 | 10 | habitants, essais, quêtes |
| Cartes postales et photos | 12 | 12 | 12 | points de vue, sujets demandés |
| Musiques | 8 | 8 | 6 | partitions trouvées, airs appris |

Une collection complète dans un lieu donne un meuble trophée unique. Les meubles ne sont pas une collection (non cochés en R56).

### 4.9 Habitants

- **Humains** (R43), **personnalités marquées** (R44): chaque habitant a un registre de langue, un tic, un sujet favori, une mauvaise foi bien à lui. Aucun habitant ne ressemble à un autre, y compris physiquement (R50); les habitants secondaires ont la même qualité de modèle et d'écriture que ceux des quêtes, avec moins de texte (R36).
- **Dialogue** (R37, R63): bandeau bas avec portrait, lettre par lettre (40 caractères par seconde), trois lignes au plus par page; Espace affiche tout, puis passe. **Babil** (R38): chaque habitant a un instrument pour voix (Firmin un basson, Jeanne un pipeau, Honorine une boîte à musique), dont les notes suivent les syllabes et la ponctuation. Émotions en onomatopées stylisées au-dessus de la tête (R51).
- **Amitié** (R39): 5 cœurs de 100 points par habitant et par joueur. Jamais de perte.

| Geste | Points | Limite |
|---|---|---|
| Première conversation du jour | 5 | une par jour |
| Cadeau aimé, adoré | 15, 30 | un par jour |
| Petite demande rendue | 20 | |
| Étape d'une suite de quêtes où il joue | 50 | |
| Partager un repas spécial avec lui | 40 | un par semaine |
| Hygiène au-dessus de 50 | gains multipliés par 1,2 | |
| Hygiène sous 20 | aucun gain | |

- **Confidences**: à 2 et à 4 cœurs, l'habitant confie quelque chose (un souvenir, un soupçon, un aveu), qui s'écrit à sa page du carnet. Certaines confidences sont des indices: elles ouvrent une étape d'une suite secondaire ou une piste de l'histoire principale. On les obtient par ce qu'on a fait pour lui, jamais en les achetant ni en les échangeant.
- **Mémoire** (R41): le jeu tient un registre de souvenirs (étapes franchies et choix, premières prises, cadeaux, tenue portée, fois où l'on est venu sale, nuits blanches, fêtes). Chaque habitant a au moins 12 répliques conditionnées par un souvenir, dont 4 sur ce qu'a fait l'autre joueur (« Ta moitié m'a vendu douze œufs hier. Douze ! »). Une réplique de souvenir ne se dit qu'une fois.
- **Petites demandes** (R40): au plus une par jour de jeu dans le lieu, portée par un seul habitant, signalée par une bulle (R69), jamais obligatoire, jamais requise par une suite. Moins de 10 % des répliques écrites.
- **Repeuplement** (R42): Aubrune compte 10 habitants à l'arrivée et 20 à la fin; les nouveaux descendent du train du samedi après chaque acte, emménagent dans une maison rouverte, et le bourg change (volets ouverts, vitrine rallumée, fumée). À Hautefonte, c'est la clientèle du commerce aidé qui grossit; à Combe-Veilleuse, les vivants reviennent à mesure que les fantômes partent. Le jeu compose aussi des passants depuis le catalogue de pièces, pour les quais et les rues.

### 4.10 Quêtes et suivi

- Une suite principale et 6 suites secondaires par lieu. Une suite se joue en étapes longues; chaque étape passe par une activité (pêcher, photographier, cuisiner, fouiller, veiller la nuit), par un déplacement dans une zone nouvelle ou par une conversation où l'on doit avoir compris quelque chose. Aucune étape ne se réduit à « rapporte N objets », sauf dans l'acte 1 d'Aubrune, qui apprend les gestes (R27).
- Histoire très guidée (R70): la page « Histoire » du carnet dit toujours quoi faire ensuite, en une phrase. Les suites secondaires s'ouvrent par les actes et par les cœurs.
- **Repère à la demande** (R68): la touche G montre pendant 3 secondes une flèche au sol vers l'objectif de la suite choisie au carnet, puis disparaît. Rien d'autre à l'écran.
- **Zones qui s'ouvrent**: chaque acte ouvre une partie du lieu (5.2).
- Deux joueurs, une histoire: une étape franchie par l'un l'est pour les deux; l'autre reçoit une ligne au bas de l'écran (« Étape franchie: la cave du garde-barrière ») et retrouve la scène au carnet, à relire.
- **Décisions à deux**: à la fin de certaines suites, un choix que les deux doivent valider du même côté. Aucune option n'est mauvaise; le lieu en garde la trace.

### 4.11 Cas limites

| Cas | Règle |
|---|---|
| Deux joueurs sur le même objet | le premier appui (heure de l'hôte) gagne; l'autre voit l'objet partir et reçoit le son de refus doux |
| Deux joueurs parlent au même habitant | chacun sa conversation, l'habitant se tourne vers le dernier arrivé entre deux pages |
| L'un dort, l'autre veille | le dormeur fait une sieste (pas de saut); une ligne dit au veilleur « Ta moitié dort. Va te coucher pour passer au lendemain. » |
| 6 h arrive pendant un mini-jeu ou un dialogue | le jour change à la fin du geste, sans coupure |
| Faim à 0 sans rien à manger ni un sou | Odette (ou l'équivalent du lieu) offre une soupe par jour: « Ça me fait mal de vous voir comme ça. » |
| Sommeil à 0 loin d'un lit | on s'allonge dans l'herbe ou sur un banc (sieste à demi-vitesse) |
| Hygiène à 0 et étape de quête | l'étape attend; le carnet dit « Un brin de toilette d'abord » |
| Sac plein pendant une récompense de quête | la récompense attend chez l'habitant, sans limite de temps |
| L'un veut prendre le train, pas l'autre | rien ne part; on peut redescendre du marchepied |
| Déconnexion d'un joueur | le jeu se met en pause pour l'autre (horloge, besoins, monde figés) jusqu'au retour, ou jusqu'à « Retour au salon », qui sauvegarde |
| Sauvegarde | automatique à chaque coucher, à chaque aube, à chaque étape de quête, à chaque voyage en train, à la sortie. Trois emplacements de partie. Contenu: horloge, lieux (logement, potager, bêtes, coffres, état des suites, habitants présents), joueurs rattachés à leur identifiant stable (apparence, sac, bourse, besoins, cœurs), carnet, registre de souvenirs |
| Résultat d'une séance pour Duo | `progress`: jours de jeu vécus, étapes d'histoire franchies, entrées de collection ajoutées pendant la séance. Une séance quittée par « Retour au salon » est une fin normale, pas une partie interrompue (à voir avec l'architecte-technique) |
| Pas de mode solo (R15) | la partie ne se lance qu'à deux |

### 4.12 Métriques

| Valeur | Départ | Raison |
|---|---|---|
| Marche, course | 3,0 m/s, 5,0 m/s | course sans jauge d'endurance: c'est la faim qui la paie |
| Accélération, freinage | 0,15 s, 0,10 s | doux, sans glisser |
| Portée de la touche d'action | 1,2 m devant le personnage, cône de 100 degrés; une seule cible à la fois, la plus proche de l'axe | la cible se montre toujours avant l'appui |
| Réponse à une action | visible et audible en moins de 0,1 s; aucune action courante ne bloque plus de 1,5 s | note de ressenti |
| Caméra | distance de 6 à 18 m, 11 m par défaut; inclinaison de 35 à 60 degrés liée au zoom; rotation de 120 degrés par seconde | proche, lisible |
| Aubrune | 260 m sur 200 m en fin d'histoire (traversée en 50 s de course), contre 64 m sur 48 m pour la démo | « des cartes plus grandes » (R27) |
| Hautefonte | 4 quartiers d'environ 150 m sur 150 m, reliés par le tramway | |
| Combe-Veilleuse | 220 m sur 220 m, en étages sur la pente | |

## 5. Contrôles (game-designer, ux-ui-designer)

Touches lues par position (`KeyboardEvent.code`), libellés selon le clavier réel.

| Action | Touche (clavier AZERTY) | Souris |
|---|---|---|
| Se déplacer (relatif à la caméra) | Z, Q, S, D | non (R16) |
| Courir | Maj gauche maintenue | |
| Action contextuelle (R18) | Espace | |
| Tourner la caméra | A et E | clic droit maintenu et glisser |
| Zoom | | molette |
| Choisir un emplacement de la barre | Tab (suivant), Maj+Tab (précédent), ou les cinq premières touches de la rangée du haut, sans Maj | |
| Ranger l'outil (mains libres) | X | |
| Carnet (histoire, sac, collections, voisins, carte) | C | navigation à la souris |
| Repère de quête, 3 secondes | G | |
| Voir ses besoins | Alt maintenue | |
| Mode déco (dans le logement) | B | glisser, molette pour tourner |
| Dialogue: tout afficher, continuer | Espace | clic gauche |
| Fermer un menu | Retour arrière, ou C | bouton de fermeture |
| Pause (Duo) | Échap | |
| Mini-jeux | Q, S, D, F et Espace | |

- Reconfiguration des touches: oui.
- **Touche d'action**: le jeu choisit l'action selon la cible et l'outil en main. La cible réagit dès qu'elle est à portée (léger rebond, brillance) et une petite bulle dit le verbe (« Arroser », « Parler », « Ramasser ») (R21). Pas de nom au survol dans le monde, seulement dans les menus, en 4 mots au plus (R65). Aucune zone d'action sans objet visible.
- **Ressenti** (R22): chaque geste a un son court, l'objet touché bouge (l'arbre tremble, la terre saute, l'eau éclabousse), des particules (feuilles, gouttes, étoiles d'une prise rare) et, sur les gros coups seulement (arbre qui tombe, poutre posée, gros poisson sorti), une vibration d'écran de 0,15 s réglable et désactivable.
- **À l'écran en permanence** (R60): l'heure avec la météo, la bourse, la barre d'outils. Tout le reste vient quand il sert.
- **Carnet** (R61): un seul carnet animé à onglets en images. Sac: objets en 3D qui tournent au survol (R62). Carte: dessinée, plein écran, avec les habitants déjà rencontrés et l'autre joueur (R66).

## 6. Contenu (game-designer, level-designer)

### 6.1 L'arc général: la Petite Ligne

**Ce que tout le monde croit.** La Compagnie a fermé la Petite Ligne il y a trente ans, en une nuit, parce qu'elle ne rapportait plus. Les gares se sont vidées l'une après l'autre.

**Ce que vous découvrez, lieu après lieu.**

- Vous avez répondu, chacun de votre côté, à la même petite annonce: « La Compagnie de la Petite Ligne recrute deux gardes de ligne. Logement fourni. Sens de l'heure exigé. » Votre lettre d'embauche est signée « É. Lacombe, chef de ligne ». Émile Lacombe a disparu la nuit de la fermeture.
- Un train sans fumée ni bruit passe encore chaque nuit à 5 h 12. Il n'est sur aucun horaire. C'est lui qui vous a déposés. Les habitants ne voient qu'une lueur sur les rails; une photographie, elle, montre le train.
- Le 5 h 12 était le train de ceux qui partent pour de bon: de tout temps, les morts de la vallée y montaient avant l'aube, et deux gardes vivants lui ouvraient la voie (une barrière, une lanterne). Un comptable de la Compagnie a supprimé ce train parce que ses voyageurs ne payaient pas leur billet. Depuis, ceux qui devaient partir attendent au terminus, Combe-Veilleuse, que les vivants ont fini par quitter.
- Émile n'est pas mort. Il tient seul, depuis trente ans, les lanternes du terminus. Il a envoyé plus de quatre cents lettres d'embauche.

**Pourquoi le train.** Parce que chaque gare rouverte le laisse aller une gare plus loin: le 5 h 12 ne s'arrête que dans une halte « en service » (une pendule à l'heure, un signal, une barrière, des gens). Rouvrir un lieu est donc le but de chaque suite principale, et le voyage en est la récompense.

**Pourquoi nous.** Réponse tendre et drôle, donnée au troisième lieu: vous êtes les seuls à avoir répondu. En trente ans. Et il fallait deux personnes qui tiennent l'une à l'autre: la barrière et la lanterne ne se manœuvrent pas par des gens qui ne s'attendent pas.

**Ton.** Du surnaturel traité avec douceur et humour: le contrôleur du 5 h 12 est tatillon et vexé par ses trente ans de retard, les fantômes sont de mauvaise foi, personne ne fait peur. Jamais sombre: on ne montre aucune mort, on parle de départs.

**Personnages de la ligne**: le Contrôleur (Anatole, casquette trop grande, on ne voit jamais ses yeux, connaît le règlement par cœur et l'applique à tout); Rosalie Vasseur, mécanicienne du train du samedi (bien vivante, rieuse, ne croit à rien de tout cela).

### 6.2 Aubrune: distribution

Bourg de campagne au bout de la partie vivante de la ligne. Lieu d'apprentissage. Habitants repris de la 0.13 quand ils servent l'histoire, réécrits pour le nouveau ton.

| Habitant | Caractère, façon de parler | Rôle | Présence |
|---|---|---|---|
| Firmin Lacombe, 64 ans, chef de halte sans trains | bourru, ponctuel jusqu'à la manie, parle en horaires | neveu d'Émile; cœur de la suite principale; cache la lettre | dès le début |
| Odette Ferrand, 61 ans, épicière et logeuse | gourmande, bavarde, sait tout et le répète | vous loge le premier soir; apprend manger, se laver, vendre | dès le début |
| Basile Cornu, 72 ans, menuisier | taiseux, trois mots par phrase | restauration de la maison, établi, plans | dès le début |
| Achille Pradel, 38 ans, boulanger | à moitié endormi, poète de la pâte | vente (il paie mieux les œufs), pêche du lundi | dès le début |
| Solange Mérigot, 52 ans, mercière et coiffeuse | vive, moqueuse, ancienne du théâtre | sacs, tenues, coiffures; remarque la première votre hygiène | dès le début |
| Mado Cazals, 50 ans, forgeronne | forte, rieuse, impatiente | outils améliorés, réparations, signal | dès le début |
| Ambroise Pélissier, 74 ans, ancien régleur des horloges de la Compagnie | pointilleux, ronchon, sentimental en secret | la pendule de la halte; brouillé avec Firmin depuis trente ans pour « la minute » | dès le début |
| Honorine Valade, 89 ans, la doyenne | malicieuse, mémoire d'éléphant, ment pour s'amuser | témoin de la nuit de la fermeture | dès le début |
| Marthe Bousquet, 76 ans, sonneuse, sœur d'Honorine | sèche, exacte, drôle sans le vouloir | la cloche, les lumignons | dès le début |
| Jeanne Ribot, 10 ans, gardée par Solange | intrépide, parie sur tout | guide des fouilles et des cachettes; voit ce que les adultes ne regardent plus | dès le début |
| Lucie Arnaud, 41 ans, factrice et photographe | pressée, curieuse, rit fort | la photo du 5 h 12; les lettres en retard | train de l'acte 2 |
| Colette Lafon, 44 ans, cafetière | chaleureuse, franche | rouvre le café; cuisine, quilles | train de l'acte 2 |
| Armand Castagné, 34 ans, instituteur | timide en face, sûr de lui au pupitre | école, insectes et fossiles, fanfare, archives | train de l'acte 2 |
| Paulin, Margot et Léon Delmas, cultivateurs et leur fils de 11 ans | lui têtu, elle diplomate, le petit fanfaron | reprennent la ferme: graines, poules | train de l'acte 3 |
| Berthe Lavergne, 58 ans, meunière | franche, parle à sa meule | rouvre le moulin | train de l'acte 3 |
| Barnabé Tixier, 54 ans, bûcheron, mari de Mado | colosse doux, chante en travaillant | le « fantôme » du moulin | train de l'acte 3 |
| Nour Belkacem, vétérinaire; Inès Garrigue, garde forestière; Martial Roques, curé à vélo | | arrivent après la fin; portent les fêtes et les collections | après l'histoire |

### 6.3 Aubrune: suite principale, « Le train de 5 h 12 »

Durée visée: 9 à 10 heures, soit 16 à 18 journées de jeu pour un duo médian.

**Prologue jouable: « Terminus » (10 minutes).** Un compartiment, la nuit. Les deux personnages sont assis face à face. Le Contrôleur demande vos papiers: la photo d'identité est l'éditeur de personnage (R47), chacun sur son écran. On apprend en faisant (R71): marcher dans le couloir, tourner la caméra, la touche d'action (ouvrir une porte, prendre sa valise), le dialogue, et la faim (le chariot passe, on mange un sandwich, la jauge apparaît puis s'efface). Un tunnel. Le train s'arrête à Aubrune au petit matin. Vous descendez. Vous vous retournez: plus de train, des rails rouillés, des herbes entre les traverses. Firmin accourt en pantoufles: « Personne n'est descendu ici depuis trente ans. Et il n'y a pas de train. »

**Acte 1: « Logement fourni » (jours 1 à 4, 2 heures). Zone ouverte: le bourg et le passage à niveau.**

- Firmin lit votre lettre, blêmit en voyant la signature, la met dans sa poche et change de sujet. Le « logement fourni » est la maison du garde-barrière: un toit crevé, des ronces, une porte qui tient par habitude. C'était la maison d'Émile.
- Première nuit à la pension d'Odette (dormir), toilette à la pompe (« Vous sentez le wagon. », hygiène), souper (faim).
- Basile prête les outils de base. On débroussaille, on abat deux arbres, on porte les planches (à deux ou seul), on pose le toit de la première pièce (marteau). Solange offre les besaces. On bêche le premier carré de potager, on reçoit deux poules d'Odette.
- Première vente: Odette prend les œufs à 6 sous, et lâche qu'Achille « les paie n'importe quoi ». Il les paie 10. La leçon des commerçants tient en une scène.
- **Rebondissement**: première nuit dans la maison. À 5 h 12, la sonnerie du passage à niveau retentit toute seule et une lueur dorée file sur les rails. Qu'on dorme ou qu'on veille, la scène a lieu (réveil en sursaut ou vue en direct). Au matin, Firmin: « Les barrières ne sonnent plus. Vous avez rêvé. Tous les deux. Le même rêve. Ça arrive. »

**Acte 2: « La minute d'écart » (jours 5 à 10, 3 heures). Zones ouvertes: la rivière et le bief, la voie jusqu'au poste d'aiguillage.**

- But donné par Firmin, pour vous occuper ailleurs: faire revenir le vrai train, celui du samedi. Le règlement de la Compagnie (retrouvé dans la cuisine de la maison, une fois restaurée) exige une halte « en service »: une pendule à l'heure, un signal qui marche, une voie dégagée, une première commande prête sur le quai.
- **La pendule**: elle est arrêtée sur 5 h 12, comme la montre d'Émile que Firmin garde sans la remonter. Ambroise seul sait la régler, et les deux hommes ne se parlent plus depuis trente ans. Chacun vous donne sa version de « la minute »: la confidence d'Honorine (2 cœurs) révèle qu'ils ont raison tous les deux. La nuit de la fermeture, Ambroise avait avancé la pendule d'une minute sur ordre de la Compagnie, pour que le dernier train parte sans Émile. Émile est parti quand même, à pied, sur la voie.
- **Le signal**: Mado refait le bras, il faut d'abord améliorer la hache pour dégager le poste d'aiguillage (outils améliorés, usure, meule). Scène asymétrique: dans la cabine, l'un voit des leviers aux étiquettes à demi effacées; dehors, l'autre voit le signal et les aiguilles bouger. Il faut se parler pour trouver la bonne combinaison. Seul, on fait les allers-retours (c'est plus long, pas bloquant).
- **La commande**: légumes du potager, œufs, poissons (la pêche s'apprend avec Achille), planches. Sans échec: ce qui manque part la semaine suivante.
- **Dénouement de l'acte**: le samedi, la pendule repart, Firmin et Ambroise se serrent la main sans se regarder, le train de Rosalie entre en gare dans un vacarme joyeux. Lucie, Colette et Armand en descendent; le café et l'école rouvrent.
- **Rebondissement**: Rosalie vous tend une lettre arrivée au dépôt. Expéditeur: É. Lacombe, postée à Hautefonte avant-hier. Et elle rit quand vous parlez de votre arrivée: « Mardi ? Aucun train n'a roulé sur cette ligne mardi. Ni depuis trente ans. C'est moi la première. » La lettre dit seulement: « Bien arrivés ? Il reste la cave. »

**Acte 3: « Ceux qui partent » (jours 11 à 17, 4 heures). Zones ouvertes: la Côte, le moulin, la ferme, le tunnel.**

- **La cave**: elle n'existe sur aucun plan. On la trouve en restaurant la chambre (trappe sous le plancher). Dedans: le registre de nuit d'Émile, une colonne par jour, une seule ligne à chaque fois, « 5 h 12, passé », et une lanterne sans verre.
- **La photo**: Lucie, à qui vous avez appris l'heure, veille avec vous et photographie la lueur (activité photo, nuit jouable). Au développement, la photo montre un train entier, fenêtres éclairées, et un contrôleur à la portière. Firmin cède enfin et sort la lettre de sa poche: il a reconnu l'écriture dès le premier jour.
- **La coutume**: Honorine (4 cœurs) et Marthe racontent ce que les anciens savaient sans le dire: on laissait un lumignon à la barrière « pour ceux qui partent », et le garde levait sa lanterne au passage du 5 h 12. Personne ne demandait qui était dans le train.
- **Préparer la halte de nuit**: retrouver le verre de la lanterne (fouilles le long de la voie avec Jeanne, qui connaît la cachette d'Émile), le faire sertir par Mado, graisser la barrière, obtenir de Marthe qu'elle sonne à l'heure juste, remplir le registre de la halte (les Delmas, Berthe et Barnabé arrivent par le train du samedi: la halte a ses « douze foyers »).
- **Dénouement (scène à deux obligatoire)**: nuit du dernier jour, 5 h 12. L'un baisse la barrière, l'autre lève la lanterne. Le train s'arrête pour la première fois en trente ans, dans un soupir. Le Contrôleur descend, regarde sa montre: « Trente ans de retard. On va encore dire que c'est ma faute. » Il poinçonne vos lettres d'embauche, vous remet deux cartes de ligne et un ordre de mission: le siège de la Compagnie, à Hautefonte, bureau 512. « Monsieur Lacombe vous y attend. Enfin, il attend. » Il remonte, le train repart, sans personne dedans: à Aubrune, personne n'attendait.
- **Fin**: au matin, les habitants trouvent la barrière baissée et la lanterne chaude. Firmin remonte la montre d'Émile. Fête sur le quai (première Veillée du premier train).

**Ce que la suite débloque**: la ligne vers Hautefonte et les cartes de ligne; 10 habitants de plus; le café, l'école, le moulin, la ferme; le sac à dos de 10; la cuisine, la chambre et la cave de la maison; les quatre fêtes; les suites secondaires restantes.

**Comment elle apprend le jeu**: prologue (marcher, caméra, action, dialogue, faim), acte 1 (dormir, se laver, outils de base, sac, potager, poules, vendre), acte 2 (outils améliorés et usure, pêche, cuisine au réchaud, commande du samedi, scène asymétrique, confidences), acte 3 (photo, fouilles, nuit jouable, vraie cuisine et premier repas spécial, offert à Firmin et Ambroise).

### 6.4 Aubrune: suites secondaires

Chacune dure 1 heure à 1 h 30, en 4 à 6 étapes.

| Suite | Habitants | Résumé | Rebondissement et fin | Débloque |
|---|---|---|---|---|
| **La Baronne** | Achille, Colette, Jeanne | Trois générations de boulangers ont raté la même perche énorme du bief. Achille s'endort toujours avant la touche. On apprend ses heures, ses appâts, ses météos | La Baronne, enfin sortie, porte une alliance prise dans la lèvre: celle de la grand-mère d'Achille, jetée à l'eau un jour de colère. Décision à deux: la relâcher ou l'offrir au café | canne améliorée, poissons rares, recette de la friture |
| **La guerre de la soupe** | Odette, Colette, Honorine | Chacune jure faire la meilleure soupe du bourg et vous prend comme commis et comme espion. Quelqu'un sale les marmites la nuit | La coupable est Honorine, 89 ans, prise la main dans le sel: elle veut que les deux cuisinent ensemble, comme leurs mères. Fin: une soupe à quatre mains et le premier Concours de la soupe | vraie cuisine (plan), 6 recettes, fête d'automne |
| **Le fantôme du moulin** | Berthe, Barnabé, Léon, Jeanne | De la farine disparaît, des pas blancs traversent la cour, les enfants jurent avoir vu un géant pâle. Deux nuits de guet | Le géant est Barnabé, qui pétrit des brioches en cachette parce qu'« un bûcheron, ça ne fait pas de la brioche ». Fin: il entre en apprentissage chez Achille, la tête haute | brioches, plan du pétrin, amitié de Berthe |
| **La fanfare de la halte** | Armand, Solange, Barnabé, Martial | Un train qui arrive mérite une fanfare. Il faut retrouver les instruments (grenier, forge, fond du bief), les remettre en état, répéter | Le jour du concert, Armand a disparu. On le retrouve au lavoir, dirigeant les grenouilles: il a le trac. Fin: il dirige de dos, face au train | instruments des joueurs, collection des musiques |
| **Les lettres en retard** | Lucie, Firmin, Basile, Marthe | Un sac postal oublié à la consigne depuis la fermeture: six lettres de trente ans. Chacune ouvre une petite histoire (une demande en mariage jamais reçue, une dette de trois sous, une recette) | La sixième est adressée « aux deux nouveaux gardes de la halte », datée d'il y a trente ans. Dedans: la clé de la draisine et « Merci d'avance. É. L. » | cartes postales, draisine (course et raccourci sur la voie) |
| **La robe et la cloche** | Marthe, Honorine, Mado | Les deux sœurs ne se parlent plus depuis quarante ans, pour une robe de noces. La petite cloche fêlée sonne toute seule certaines nuits | Ce sont Jeanne et Léon qui sonnent, pour forcer les deux vieilles à sortir en même temps. La robe était dans le clocher. Fin: la cloche est refondue, les sœurs se disputent à nouveau, mais ensemble | tenues anciennes, la cloche qui s'entend dans tout le bourg, fête d'été |

### 6.5 Hautefonte, la métropole (deuxième lieu)

**Prémisse.** La grande ville au bout de la plaine: tramways, enseignes, quais du canal, grands magasins. Le siège de la Compagnie occupe la Gare Centrale, dix étages de bureaux où plus personne ne sait à quoi sert la Petite Ligne. Vous avez un ordre de mission pour le bureau 512. L'étage 5 s'arrête au bureau 511.

**Logement.** Un appartement de fonction au cinquième sans ascenseur: pas une pièce à ajouter, tout à décorer (R11). Vraie cuisine, salle d'eau, balcon à jardinières. Le voisin du dessous tape au plafond quand on joue de la musique après 22 h.

**Suite principale, « Le bureau 512 »:**

1. Au siège, personne ne connaît Émile Lacombe, et pourtant sa signature figure au bas de vos fiches de paie. On vous donne un badge provisoire et l'ordre d'attendre.
2. Le registre des trains de nuit est volé aux archives. L'inspectrice Clémence Aubier, du commissariat des Quais, vous soupçonne, puis vous embauche: vous seuls savez ce que ce registre contient.
3. Le directeur veut vendre l'emprise de la Petite Ligne à un promoteur. Sans registre, le 5 h 12 n'a jamais existé.
4. Le voleur est le vieil archiviste, qui cachait le registre pour le sauver. Rebondissement: c'est lui, jeune comptable, qui avait supprimé le train. Il répare depuis trente ans.
5. Au conseil de la Compagnie, vous produisez le registre, la photo de Lucie et vos cartes poinçonnées. La ligne est classée. Derrière un classeur du bureau 511, une porte: le bureau 512, une machine à écrire encore tiède, quatre cents lettres revenues « n'habite pas à l'adresse indiquée », et deux billets pour Combe-Veilleuse.

**Suites secondaires:**

- **Au Bazar Pivoine**: un vieux magasin qui périclite face à une grande enseigne. On refait la vitrine (déco), on retrouve les fournisseurs, on tient la caisse un jour de braderie; la clientèle grossit à vue d'œil (R42). Rebondissement: l'enseigne rivale appartient à la sœur de la patronne.
- **Les affaires de l'inspectrice Aubier**: trois enquêtes absurdes et tendres (le voleur qui ne prend que les chaussures gauches, la statue du square qui change de pose la nuit, le perroquet témoin). Indices par la photo, les fouilles et les confidences.
- **Le feuilleton de minuit**: l'auteur du feuilleton radio le plus écouté de la ville a disparu avant le dernier épisode. On le cherche, et faute de mieux on joue la fin en direct (musique et choix de répliques à deux).

**Activités propres**: pêche au canal et au port, photo de rue, les puces du dimanche, service à la brasserie, cabaret, tramway entre quartiers, grands magasins (tenues, meubles achetés seulement, sacs de 15, outils fins), bains publics. Peu d'insectes, pas de basse-cour.

### 6.6 Combe-Veilleuse, le village abandonné et hanté (troisième lieu)

**Prémisse.** Le terminus, dans la montagne, sous la brume. Le jour: des maisons vides, des volets qui battent, des jardins retournés à la friche. La nuit: les fenêtres s'allument une à une. Ceux qui attendent le train depuis trente ans sont là, de mauvaise humeur, très polis, et persuadés que c'est vous qui êtes en retard. Le jour sert à explorer et à réparer; la nuit jouable sert à rencontrer.

**Logement.** Un wagon de service de la Compagnie sur la voie de garage: deux compartiments et une plateforme à aménager, un poêle. La maison du chef de gare s'y ajoute au fil de l'histoire. Asymétrie: qui porte la lanterne d'Émile voit les fantômes; l'autre ne fait que les entendre (et lit leurs répliques). On se passe la lanterne.

**Suite principale, « Ceux qui attendent »:**

1. Sur le quai, des lanternes entretenues, du thé encore chaud, personne. Quelqu'un de vivant habite ici.
2. La nuit, les habitants se montrent. Chacun reste pour une raison: une affaire à finir. On reconstitue, maison par maison, pourquoi les vivants sont partis (personne n'a eu peur: on ne s'entendait plus dormir).
3. Émile, 88 ans, descend enfin du château d'eau. Il n'a rien d'un mystère: un vieil homme têtu qui n'a pas voulu laisser ses voyageurs seuls. Il vous dit pourquoi vous (6.1).
4. Remettre le terminus en service: la plaque tournante, la pendule, la cloche, et un billet par voyageur, qui ne s'obtient qu'en dénouant son affaire (les suites secondaires nourrissent la principale).
5. Le 5 h 12 entre en gare. Ceux qui sont prêts montent; ceux dont l'affaire reste à finir attendront le prochain, et il y en aura désormais un chaque nuit. Décision à deux pour Émile: rentrer à Aubrune chez Firmin, ou rester chef de gare. Les vivants reviennent, le village se rallume, de jour cette fois.

**Suites secondaires:**

- **Le dernier bal**: le chef de la fanfare du kiosque veut finir le bal interrompu il y a trente ans. Il faut retrouver les partitions, convaincre les danseurs brouillés, et jouer (musique à deux). Rebondissement: il manquait une danseuse, et elle est vivante, à Hautefonte.
- **La recette que personne n'a goûtée**: la cuisinière de l'auberge mijote le même plat depuis trente ans sans pouvoir y goûter. Vous cuisinez sous ses ordres, vous mangez pour elle (repas spécial à deux) et vous lui décrivez. Elle n'est jamais contente. C'est le but.
- **Le facteur qui ne sait pas**: il distribue chaque nuit le même courrier à des boîtes vides et s'étonne que personne ne réponde. Personne n'ose lui dire. Rebondissement: il le sait très bien; il attend une lettre précise, et elle était dans le sac postal d'Aubrune.

**Activités propres**: lucioles et papillons de nuit, pêche au lac de brume, fouilles dans les ruines, photo de ce que l'œil ne voit pas, champignons, source chaude (hygiène), plans anciens à l'établi, la chouette.

### 6.7 Difficulté

| Contenu | Intention | Difficulté (1 à 5) |
|---|---|---|
| Aubrune | apprendre tout, sans jamais se sentir en classe | 1 à 2 |
| Hautefonte | enquêter, parler, décorer; plus de monde, plus d'argent | 2 à 3 |
| Combe-Veilleuse | la nuit, l'asymétrie, les mini-jeux les plus fins | 3 |

## 7. Direction artistique (directeur-artistique)

À rédiger. Cadre fixé par le client: rendu lisse et doux, comme une figurine (R46); proportions actuelles (R45); visages modélisés en relief, émotions en onomatopées stylisées (R51); corps enfant, adulte, âgé, avec 2 ou 3 corpulences (R48); catalogue d'une quinzaine de pièces par catégorie pour sept catégories de vêtements (R49, R50); aucun habitant vu deux fois; la beauté passe avant la fluidité sur le PC (R73). Demandes du design: une identité par lieu, une cible d'action toujours lisible, des portraits pour le bandeau de dialogue.

## 8. Direction sonore (sound-designer)

À rédiger. Cadre: un air selon l'heure, la météo et le lieu (R72); un son court par geste (R22); un babil par habitant, sur un timbre d'instrument (4.9); un jingle de prise nouvelle; la cloche et la sonnerie du passage à niveau entendues des deux joueurs dans tout le bourg.

## 9. Interface et HUD (ux-ui-designer)

À rédiger. Cadre: presque rien à l'écran (R60); un carnet animé à onglets en images (R61); sac en 3D (R62); bandeau de dialogue bas avec portrait (R63); boutiques en menu (R64); noms au survol dans les menus seulement (R65); carte plein écran (R66); taille des textes actuelle (R67); repère de quête de 3 secondes (R68); bulle sur l'habitant qui a quelque chose pour nous (R69); panneau unique du poulailler (R31).

## 10. Technique (architecte-technique, dev-reseau, tech-artist)

À rédiger. Questions du design: chargement d'un lieu pendant la scène de wagon; simulation réduite des lieux absents; un format de sauvegarde neuf (les anciennes sont abandonnées, R7); le statut d'une séance quittée normalement; R73 (la beauté avant la fluidité) face à la machine de référence, avec un plancher d'images par seconde à fixer.

## 11. Périmètre (game-designer, manager)

- **Version 1 de la refonte**: Aubrune complet (prologue, trois actes, six suites secondaires, 20 habitants, toutes les activités du tableau 4.7, quatre fêtes, quatre saisons, maison jusqu'à l'étage, collections d'Aubrune), tous les systèmes du socle, le quai de départ vers Hautefonte.
- **Ensuite, par mises à jour**: Hautefonte, puis Combe-Veilleuse, puis d'autres lieux (R75). Sacs de 25 et 30, outils d'un quatrième rang, nouvelles séries de meubles.
- **Hors périmètre**: mode solo; étal ou vente entre joueurs; musée; décoration du bourg; émotes et signaux; déplacement au clic; romance avec les habitants; combats, mort, échec de quête; horloge réelle; croisement de fleurs; reprise des sauvegardes de la 0.13; manette.

## 12. Critères d'acceptation (proposition, à rendre testables par qa-testeur)

**Structure et train**

- CA-01: étant donné la ligne vers un lieu rouverte et un seul joueur sur le marchepied, quand il valide « Monter », alors le train ne part pas; il part quand le second valide.
- CA-02: étant donné un voyage aller puis retour, quand on revient, alors sacs, bourses, coffre commun, outils, tenues, carnet et cœurs sont identiques, et le logement quitté est dans l'état laissé.
- CA-03: étant donné 10 jours passés ailleurs, quand on revient à Aubrune, alors aucune plante n'est morte et le pondoir contient au plus 12 œufs.

**Temps**

- CA-04: sans intervention, de 6 h à 20 h 30 il s'écoule 30 minutes réelles (à 15 secondes près) et de 20 h 30 à 6 h, 20 minutes.
- CA-05: avant 15 h, se coucher à deux ne fait pas sauter la nuit; à partir de 15 h, deux personnages au lit donnent un réveil à 6 h le lendemain.
- CA-06: sans dormir, le jour suivant commence à 6 h sans écran de chargement ni téléportation.
- CA-07: une saison dure 14 jours; une entrée de collection hors de ses conditions (heure, météo, saison) n'apparaît jamais.

**Besoins**

- CA-08: une jauge qui passe sous 20 applique le malus du tableau 4.4 dans la seconde et s'affiche; au-dessus de 50, le bonus s'affiche puis l'icône s'efface en 5 secondes.
- CA-09: faim à 0, la touche d'action sur un arbre ne fait rien d'autre que le geste de refus; sur un plat, elle mange.
- CA-10: hygiène sous 20, chaque habitant testé dit sa remarque et aucun point d'amitié n'est gagné; à 0, une étape de quête sur dialogue ne se franchit pas, et se franchit après une toilette.
- CA-11: aucun bonus cumulé ne dépasse 25 % sur une même valeur, hors repas spécial.
- CA-12: un repas spécial ne donne son bonus exclusif que si les deux personnages sont assis à la même table; il reste cuisinable par un joueur seul.
- CA-13: le script `refonte_besoins_economie.py` relancé donne les tableaux de 4.4 et 4.6.

**Prise en main**

- CA-14: aucun clic dans le monde ne déplace le personnage; la caméra tourne de façon continue sur 360 degrés.
- CA-15: toute cible à portée réagit et affiche son verbe avant l'appui; aucune zone du monde ne propose d'action sans objet visible (balayage automatique de la carte).
- CA-16: chaque action de la liste des gestes a un son, une animation de l'objet touché et des particules, déclenchés en moins de 0,1 s.
- CA-17: au début d'une partie, le sac n'existe pas et la barre compte 5 emplacements; chaque pile respecte le maximum du tableau 4.5.
- CA-18: un outil de base utilisé 1 000 fois ne change pas; un outil amélioré arrivé à 0 est plus lent que l'outil de base et retrouve ses valeurs après la réparation prévue.

**Économie**

- CA-19: un commerçant ne propose à la vente que les objets de son thème; le même œuf rapporte 6 sous chez Odette et 10 chez Achille.
- CA-20: le coffre commun ne paie que les achats du foyer; chaque joueur peut y verser et en retirer depuis le logement et depuis chaque gare.
- CA-21: aucun embellissement de lieu ni réouverture de ligne n'a de prix en sous.

**Activités et collections**

- CA-22: au potager, 30 jours sans arroser ne font mourir aucune plante; une plante arrosée chaque jour mûrit en moitié moins de jours.
- CA-23: une pêche ratée ne coûte qu'un appât; avec l'aide au cran « Grand coup de pouce », la zone de tension est 50 % plus large.
- CA-24: le panneau du poulailler montre sur un seul écran les poules, le grain restant et les œufs; remplir et ramasser prennent chacun un appui.
- CA-25: une prise nouvelle déclenche la présentation (pose, jingle, texte) et s'inscrit au carnet des deux joueurs; une prise connue ne bloque pas plus de 1,5 s.

**Habitants et dialogues**

- CA-26: tout dialogue s'affiche dans le bandeau bas avec portrait, lettre par lettre, trois lignes au plus par page, avec le babil de l'habitant.
- CA-27: après un événement du registre de souvenirs, l'habitant concerné dit sa réplique de souvenir à la conversation suivante, une seule fois.
- CA-28: sur 14 jours simulés, jamais plus d'une petite demande par jour dans le lieu.
- CA-29: un habitant arrivé par le train a un logis, une page au carnet et des répliques dès son premier jour.

**Narration**

- CA-30: un duo neuf termine le prologue en moins de 15 minutes sans lire d'autre aide que les bulles d'action.
- CA-31: chaque étape de la suite principale d'Aubrune peut être franchie par un joueur seul, sauf le dénouement de l'acte 3; un robot la joue de bout en bout.
- CA-32: une étape franchie par l'un est marquée chez l'autre dans la seconde, et la scène est relisible au carnet.
- CA-33: la touche G affiche le repère 3 secondes, puis plus rien.

**Sauvegarde et réseau**

- CA-34: quitter au milieu d'une journée puis reprendre rend l'état du dernier point de sauvegarde, sans objet ni sou dupliqué.
- CA-35: quand un joueur se déconnecte, l'horloge et les besoins de l'autre se figent; ils reprennent au retour.

## 13. Jalons (proposition, dates à fixer par le manager)

| Jalon | Contenu attendu | Date visée | Validé le |
|---|---|---|---|
| 1. Socle jouable | caméra et déplacement au clavier, touche d'action avec cibles et ressenti, trois besoins avec paliers, barre de 5 et besace, bandeau de dialogue avec babil, éditeur de personnage réduit, prologue en train et premier jour de l'acte 1 (pension, pompe, souper, première vente) en formes simples | | |
| 2. Aubrune, acte 1 et quotidien | maison (première pièce, mode déco), potager, poulailler, outils et usure, sacs, commerçants et prix, pêche, réchaud, horloge complète avec nuit et saut, sauvegarde neuve, 10 habitants | | |
| 3. Aubrune, histoire complète | actes 2 et 3, scènes à deux, train du samedi, arrivées d'habitants, photo, fouilles, insectes, vraie cuisine et repas spéciaux, carnet et collections, amitié, confidences et souvenirs | | |
| 4. Aubrune 1.0 | six suites secondaires, fêtes, saisons, maison jusqu'à l'étage, musique, catalogue de personnages, art et son définitifs, recette sur les deux machines | | |
| 5. Hautefonte | deuxième lieu complet | | |
| 6. Combe-Veilleuse | troisième lieu complet | | |

## 14. Questions ouvertes et décisions

Contradictions repérées dans les réponses (C) et questions nouvelles (Q).

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|
| C1 | R23 demande trois jauges, R60 presque rien à l'écran | toujours visibles; visibles au changement de palier, sous 20 et sur une touche | la seconde (retenue en 4.4) | | |
| C2 | R3 « on peut dormir pour passer la journée » et R4 « la nuit passe toute seule », avec deux joueurs: que se passe-t-il si un seul dort ? | il faut être deux au lit pour sauter; un seul suffit et l'autre est ramené | deux au lit pour sauter, sieste libre pour un seul (retenu en 4.3) | | |
| C3 | R36: tous les habitants de même qualité; R50: aucun habitant vu deux fois; or une métropole demande une foule | foule de passants composés par le jeu, sans dialogue long; rues peu peuplées | passants composés depuis le catalogue, une réplique chacun, et 20 habitants écrits par lieu | | |
| C4 | R28 n'a pas coché « fleurs à planter et à croiser », R56 collectionne les fleurs | fleurs sauvages à cueillir; ajouter le croisement | cueillette seule (retenu en 4.8) | | |
| C5 | R73 (la beauté avant la fluidité) face au PC de référence | fixer un plancher; laisser libre | plancher de 30 images par seconde sur le PC, réglage de qualité par machine | | |
| C6 | R12 « toujours faisables seul » et R9 « certaines quêtes peuvent demander d'être deux » | aucune exception; quelques exceptions | exceptions limitées au train, au repas spécial et à un dénouement par lieu | | |
| C7 | R74 « page blanche » et reprise d'habitants de la 0.13 | reprendre les habitants utiles, réécrits; tout renommer | reprendre (6.2): vous les connaissez, leurs modèles serviront de base, toutes leurs quêtes sont neuves | | |
| Q1 | Nom de la monnaie | sou, poinçon, rond | sou | | |
| Q2 | Le fil rouge assume du surnaturel doux dès Aubrune (un train que seule la photo montre), puis des fantômes au troisième lieu | l'assumer; garder Aubrune sans surnaturel | l'assumer: c'est le « mystère » demandé en R8 et il prépare le village hanté | | |
| Q3 | Émile est retrouvé vivant au troisième lieu | vivant; fantôme lui-même | vivant: des retrouvailles avec Firmin, un ton tendre | | |
| Q4 | Durée d'une saison | 14 jours; 21 jours | 14: on voit deux saisons pendant l'histoire d'Aubrune | | |
| Q5 | Noms des lieux: Hautefonte, Combe-Veilleuse | les garder; en proposer d'autres | les garder, après vérification d'homonymie (non faite, voir compte rendu) | | |
| Q6 | Le titre « La Petite Ligne » | le garder; le changer | le garder: il décrit mieux encore le nouveau jeu | | |
| Q7 | Besoin à 0: le blocage est-il assez doux ? | comme écrit; plus sévère; sans blocage | comme écrit, avec la soupe d'Odette en secours | | |
| Q8 | La commande du train du samedi continue-t-elle dans les autres lieux ? | Aubrune seulement; un équivalent par lieu | un équivalent par lieu (la braderie de Hautefonte), à écrire avec chaque lieu | | |
| Q9 | Durée visée par lieu | 10 heures; 15 heures; 20 heures et plus | 15 heures (9 à 10 d'histoire, 6 à 8 de suites secondaires), plus le quotidien sans limite | | |

Signalements au manager (création originale): le babil est un procédé de genre, rendu distinct par les timbres d'instruments; les confidences sont des indices et non une monnaie d'échange, pour ne pas reprendre un mécanisme d'une référence; le logement du troisième lieu est un wagon et non un établissement à remettre en état avec des clients de l'intrigue; la monnaie évite toute clochette. Le motif du train des défunts est un thème de conte, mais un jeu récent de gestion douce où l'on accompagne des esprits existe: nous nous en écartons par l'enquête sur le village, l'absence de bateau et de constructions pour les esprits.

## 15. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-11-10 | 0.1 | première rédaction de la refonte, d'après les 75 réponses du client | client, via le manager |
