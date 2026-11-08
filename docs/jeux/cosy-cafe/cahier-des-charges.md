# Cahier des charges: Cosy Café (titre de travail)

| Champ | Valeur |
|---|---|
| Identifiant | `cosy-cafe` (provisoire; l'architecte rappelle qu'il peut rester même si le titre change, section 1.1) |
| Statut | brouillon |
| Version du document | 0.2.4 |
| Dernière mise à jour | 2026-11-08 |
| Rédaction | game-designer: sections 1 à 6, 11, 13, 14 et proposition de la section 12; manager: consolidation, résumés des sections 7 à 10, questions Q11 à Q19, section 16 |
| Documents liés | cadrage: `docs/jeux/cosy-cafe/cadrage.md`; plans et adresses: `docs/jeux/cosy-cafe/plans/`, `docs/jeux/cosy-cafe/adresses.md`; bible: `docs/jeux/cosy-cafe/bible-artistique.md`; son: `docs/jeux/cosy-cafe/son.md`; interface: `docs/jeux/cosy-cafe/ux.md`; technique: `docs/jeux/cosy-cafe/technique.md`; simulation: `docs/jeux/cosy-cafe/simulations/cosy_cafe.py` et `resultats.md`; plateforme: `docs/plateforme/cahier-des-charges.md` (F05 à F09) |

> Mode d'emploi: copier ce modèle dans `docs/jeux/<id-du-jeu>/cahier-des-charges.md`. Chaque section indique ses responsables. Le manager consolide, le client valide. Une fois validé, ce document est le contrat: toute modification passe par le manager et s'inscrit dans l'historique (section 15).

## En bref

- **Le jeu**: à deux, en vue à la première personne, vous rouvrez le petit café d'un village, fermé depuis trois ans: une boutique vide que vous équipez avec votre épargne (machine, comptoir, tables, vaisselle, premier stock), puis que vous tenez ensemble: l'un au comptoir, l'autre à la machine, ou l'inverse, comme vous voulez. Ce que vous écrivez sur l'ardoise décide de qui pousse la porte; les meubles, la décoration et la musique décident de l'envie de rester. On sert, on encaisse, on débarrasse, on lave, on range la livraison du matin, on lit le livre d'or le soir.
- **La progression**: cinq adresses, chacune plus grande et plus vivante. Ormeval, le café de la place du Tilleul (38 m², une boutique vide à équiper); Mérelles, l'ancienne pâtisserie face à la halle (le four, le service en salle, le marché du jeudi); Montaurel, l'Imprimerie d'une ville universitaire (les employés, le brunch, le café de spécialité); le café de l'angle des Plumassiers, à Paris (l'équipe reprise, les touristes); la Graineterie du boulevard des Horticulteurs, une maison sous verrière sur deux niveaux (notre mélange, le laboratoire de pâtisserie, la visite d'un guide). Chaque café quitté reste ouvert, confié à quelqu'un: à la fin, la maison en tient cinq.
- **La durée**: l'histoire principale dure <!-- val:fin_h_median -->34,0 h pour un duo médian (de <!-- val:fin_h_rapide -->28,3 h pour un duo rapide à <!-- val:fin_h_lent -->53,1 h pour un duo qui prend son temps), soit <!-- val:seances_median -->51 séances de 40 minutes; puis le jeu continue sans fin. Une journée ouverte dure environ <!-- val:journee_median_min -->20 minutes réelles: un service de 10 à 13 minutes entre une préparation et une fermeture à votre rythme.
- **Ce qui le rend unique**: l'ardoise qui fait la clientèle; le coup de feu à deux, réglé à la voix parce que chacun ne voit que ce qu'il regarde; des habitués qui ont un prénom, une commande fétiche et une histoire; un style de décoration cohérent qui compte vraiment; des fournisseurs qui ont un visage; aucune faillite, aucune partie perdue, rien qui compare les deux joueurs.
- **Chiffres sortis d'une simulation**: chaque journée de chaque partie simulée est jouée client par client (`simulations/cosy_cafe.py`, 120 parties); les tables de ce cahier en sont la copie exacte, vérifiée par un contrôle automatique.
- **À trancher** (section 14): le titre (cinq propositions), la durée de l'histoire, Paris réel ou inventé, deux cafés à la fois, garder ou revendre les anciens cafés, les options de commande (lait d'avoine, déca), la place des aides, puis Q11 à Q19 (musique, voix, mains, signes des joueurs, maison parisienne, terrasse, direction de rendu après l'essai 3D, réglages, annonce de départ), Q20 à Q26 (le départ dans une boutique vide: Simone, l'épargne, le prêt, ses meubles, les livraisons du premier jour, les adresses suivantes, le ménage).

## 1. Résumé (game-designer)

- **Pitch**: à deux, faites du petit café d'Ormeval l'endroit où l'on aime s'arrêter, puis faites grandir votre maison d'adresse en adresse, jusqu'à Paris.
- **Fantasme du joueur**: « C'est notre café: on a choisi chaque meuble et chaque ligne de l'ardoise, on connaît nos habitués par leur prénom, on tient le coup de feu à deux en se parlant, et on l'a fait grandir ensemble jusqu'à Paris. »
- **Genre**: simulation de commerce en coopération (café, salon de thé, petite restauration sucrée et salée).
- **Vue**: 3D à la première personne (« FPS » au sens de vue subjective: ni tir ni combat). Caméra à hauteur d'yeux (1,65 m), champ de vision vertical de 60° par défaut, réglable de 50 à 75° (technique, section 2.3). Aucune cinématique: la caméra ne bouge jamais sans le joueur (C22); les scènes se jouent en place, par dialogues.
- **Mode à deux**: coopération, pot commun (une caisse, un stock, une maison), aucun rôle imposé; l'asymétrie naît du regard (chacun voit ce qu'il regarde) et des postes. Manifeste: `mode: "coop"`, `play: "session"`.
- **Durée d'une partie**: séances libres de 10 à 45 minutes, quittées à tout moment sans rien perdre (reprise en plein service possible). Une séance de 40 minutes fait environ deux journées.
- **Piliers** (cadrage, section 4.1):
  1. **Le coup de feu à deux**: servir ensemble, se répartir les postes à la voix, sentir le service s'huiler de jour en jour.
  2. **Notre carte, notre style, nos clients**: l'ardoise, les meubles, la décoration et la musique décident de qui pousse la porte et de qui revient.
  3. **Du comptoir de village à la maison parisienne**: chaque adresse est plus grande, plus vivante, plus exigeante; les précédentes restent dans la maison.

### 1.1 Titre et vérification d'homonymie

« Cosy Café » est très pris. Recherche web du 2026-11-07 (Steam, itch.io, boutiques, cafés, livres): « Tailside: Cozy Cafe Sim », simulateur de café douillet sorti sur Steam le 21 janvier 2026 (Coffee Beans Dev); « Cosy Cafe », petit jeu d'un créateur seul sur itch.io; d'autres simulateurs de café en vue subjective, dont un en coopération (cadrage, section 6). Le titre se confondrait avec eux dans un moteur de recherche et dans l'esprit des joueurs.

Titres de rechange, en français, vérifiés le même jour (aucun jeu, film, livre ni marque trouvés sous ce nom exact):

| Titre | Ce qu'il dit | Voisins trouvés, sans conflit |
|---|---|---|
| **Deux Tabliers** (recommandé) | le couple au travail, la douceur du métier; « tablier » est aussi l'ancien nom d'un plateau de jeu | un restaurant « Les Petits Tabliers » à Nice, un restaurant « Deux » à Paris |
| L'Ardoise du jour | la mécanique centrale: ce qu'on écrit fait la clientèle | de nombreux restaurants « L'Ardoise » (nom courant) |
| Comptoir à deux | le lieu et le couple | le film « Brèves de comptoir » (2014), beaucoup de cafés « Comptoir » |
| Petit noir, grand crème | l'esprit du café français, du village à Paris | un café-librairie « Un Petit Noir » à Lyon; « noir » évoque aussi le roman policier |
| Les Deux Tasses | la maison du couple, et les tasses de la réputation | aucun résultat; des cafés de ce nom peuvent exister sans être référencés |

Le guide de la fin s'appelle « le Guide de la Tasse » et sa distinction « la Tasse d'or »: aucun guide ni prix de ce nom trouvé le 2026-11-07 (à revérifier avant la bêta). Décision: question Q1. L'identifiant `cosy-cafe` peut rester quel que soit le titre: le joueur ne le voit jamais (technique, section 6.4).

### 1.2 Ce qui le distingue des jeux du genre

Le client cite deux simulateurs de commerce en vue subjective. On garde le genre et l'intention (la vue subjective, les gestes concrets, acheter, aménager, servir, agrandir); on écarte leurs signes reconnaissables et ceux des jeux de café existants:

- pas d'ordinateur de commande qui fait tomber des cartons devant la porte: on commande à la fermeture, les fournisseurs livrent le matin en personne (une laitière à triporteur, un boulanger, une livreuse en vélo cargo à Paris), et l'on porte les gros cartons à deux;
- pas de caisse où l'on scanne des articles, pas de rendu de monnaie en mini-jeu: on écoute la commande, le ticket s'imprime et rejoint le rail au-dessus du comptoir;
- pas de prix fixés article par article sur des étagères: une ardoise de huit à vingt lignes, écrite chaque matin, qui décide des profils qui entrent;
- pas de note étoilée qui tombe après une mauvaise journée: une réputation en tasses qui ne baisse jamais, et un livre d'or écrit à la main qui dit ce qui a plu ou manqué;
- pas de dette ni de faillite: le pire est une journée calme;
- le couple au centre: deux postes qui ne se voient pas, des gros meubles portés à deux, les grandes décisions prises ensemble, et rien qui compare les deux joueurs.

### 1.3 Écarts avec le cadrage

| Cadrage | Ce cahier | Raison |
|---|---|---|
| Neuf profils de clients | dix: ajout des **voisins** [`voisins`], qui viennent pour deux mots au comptoir | donne un vrai poids au poste calme (parler aux gens) et fait vivre le zinc à chaque adresse; un profil de plus à habiller pour la bible (7.2) |
| Journée de 15 à 20 minutes | journée ouverte de <!-- val:journee_median_min -->20 minutes en moyenne (17 à 24 selon le duo), lundi de fermeture en plus | mesuré par la simulation: service de 10 à 13 minutes selon l'adresse, préparation et fermeture du duo médian (4 et 3,5 minutes) |
| Saisons de 28 jours, 35 h pour l'histoire | 28 jours confirmés; histoire principale en <!-- val:fin_h_median -->34,0 h pour un duo médian | simulation, section 4.21 |
| Places assises (ordre de grandeur) | les plans du level designer, repris tels quels (table `adresses`): Ormeval 10 places à l'arrivée, 18 au maximum (depuis la démo v0.3, les places d'Ormeval s'achètent: `demo/depart-cellule-vide-v0-3.md`); Mérelles 11 puis 39; l'Imprimerie 27 puis 45; les Plumassiers 24 puis 45; la Graineterie 53 puis 88 | les plans font foi; tous restent sous les plafonds de l'architecte (C2) |
| Le bourg, une boutique de la grand-rue | Mérelles, l'ancienne pâtisserie face à la halle (plans) | le level designer a placé l'adresse; le four y attend dans son laboratoire, d'où le personnage de René, l'ancien pâtissier |
| Réputation « de une à cinq tasses » | en demi-tasses, sans jamais baisser | aucune perte, rien à reprocher à l'autre joueur après un service difficile |
| Employés à la troisième adresse | confirmé, avec un coup de main au bourg les jours de marché et le week-end, et une équipe reprise avec chaque café parisien | à deux, une grande adresse refuse près des deux tiers de ses clients (section 4.21); un café d'angle se reprend d'ordinaire avec son personnel |

## 2. Expérience à deux (game-designer)

### 2.1 Rôles et postes

- **Aucun rôle imposé.** Les deux joueurs savent tout faire: prendre une commande, tirer un espresso, mousser le lait, servir, débarrasser, laver, ranger, décorer. On se répartit les postes à la voix, et l'on en change quand on veut, même au milieu d'un service.
- **Deux familles de postes**, pour deux tempéraments:
  - **les postes calmes**: comptoir et caisse, salle et terrasse, conversation avec les voisins et les habitués, débarrasser, plonge, décoration. Ils demandent de l'attention plutôt que de l'adresse;
  - **les postes techniques**: machine à espresso (moudre, tasser, lancer et arrêter l'extraction), buse vapeur (la bonne température, le dessin sur le lait), four et fournées, crêpière et gaufrier, méthodes douces. Ils récompensent la précision sans jamais la punir (règle CO-06).
- **Pot commun**: une caisse, un stock, une maison, un livre d'or, « Nos projets ». Personne n'a d'argent à soi, rien ne s'attribue à l'un ou à l'autre.
- **Interdépendance naturelle**: une commande passe par le comptoir puis par le bar puis par la salle; la plonge nourrit le bar en tasses propres; la livraison du matin remplit le frigo du bar. Un joueur seul ne peut tenir un service: la pancarte « Petite pause » ferme la porte dès que l'un s'absente (PA-04).
- **Gestes à deux**: porter les gros meubles et les gros cartons (C14: 1,2 m/s au plus), sans échec possible; se passer un objet de la main à la main (1,5 m); faire signe à l'autre (un repère visible chez les deux).

### 2.2 Ce que montre chaque écran

En vue subjective, chacun ne voit que ce qu'il regarde. Le jeu n'ajoute presque rien à l'écran: les informations sont des objets du café, visibles par qui les regarde.

| Information | Chez les deux | Chez un seul |
|---|---|---|
| Heure (pendule fixe de l'adresse, son.md), jour, météo | oui, dans le monde et en petit dans le HUD | |
| Tickets du rail (commandes, table, options, attente) | oui, quand on regarde le rail au-dessus du comptoir | |
| File devant la caisse, clients qui attendent leur commande | oui, en les regardant | |
| État d'une machine (extraction qui coule, lait qui chauffe, minuterie du four) | oui, en la regardant | la fenêtre du geste en cours (aiguille, jauge de température): seulement chez celui qui fait le geste (C16) |
| Qualité d'un geste (« Parfait », « Bien », « Correct ») | | seulement chez celui qui l'a fait, en petit, sans son (son.md) |
| Humeur d'un client | son visage et sa posture (bible, 7.6), sans jauge | |
| Prénom d'un habitué, sa commande fétiche | en le regardant à moins de 3 m, si on l'a déjà servi une fois | |
| Aides réglées | | chacun les siennes, invisibles pour l'autre (CA-34) |
| Caisse, stock, ardoise, réputation, livre d'or, « Nos projets » | oui (tablette de la maison, ardoise, livre d'or posés dans le café) | |
| Où est l'autre | son avatar, avec un liseré à sa couleur quand il est caché par un mur | |
| Tablette ouverte | l'avatar de l'autre la tient en main | le contenu ne s'affiche que sur l'écran de celui qui la consulte |

### 2.3 Ce qui pousse à se parler

1. **Les postes ne se voient pas.** À la machine, on tourne le dos à la salle; à la caisse, on ne voit pas la machine. « Trois personnes attendent ! », « Le crème de la table 4 est prêt ! », « Il n'y a plus de tasses propres ! » ne peuvent venir que de celui qui le voit.
2. **Le rail des tickets.** Prendre un ticket le teinte à sa couleur: « Je prends le 7 et le 8 », « Tu peux faire le chocolat ? ».
3. **Les habitués.** Reconnaître Mathis à 8 h 10 et lancer son espresso avant qu'il commande (« Comme d'habitude ? ») demande qu'on se le dise: celui qui le voit entrer n'est pas forcément celui qui est à la machine.
4. **Les voisins.** Ils veulent deux mots au comptoir; celui qui est en salle passe le relais: « Va voir Simone, elle t'attend ».
5. **L'ardoise et la décoration.** Écrire la carte, choisir un style, acheter un gros meuble: décisions communes, souvent négociées (« Les familles viennent le mercredi, mettons un chocolat »). Les achats importants demandent l'accord des deux (EC-05).
6. **Le livre d'or du soir.** Lu ensemble à la fermeture: « Pas trouvé de place pour m'asseoir, dommage » appelle une discussion sur la terrasse.
7. **Les employés** (à partir de la ville) parlent aussi: « J'ai besoin de quelqu'un au bar ! ». Les joueurs se répartissent alors les renforts.

### 2.4 Deux niveaux différents

- **Des postes d'exigence différente** (2.1): chacun prend celui qui lui va, sans que l'autre le voie ou le compte.
- **Des aides propres à chaque joueur**, invisibles pour l'autre (CO-07): gestes simplifiés (un clic par geste, qualité « Bien » assurée), rappel des options (la bouteille de lait d'avoine s'éclaire), guide du poste (le prochain objet à prendre brille).
- **Des réglages du duo**, décidés à deux: rythme paisible (une heure de jeu dure 75 secondes au lieu de 60), patience des clients grande (une fois et demie), affluence douce (x0,8). Mesuré sur un duo tranquille au bourg: les clients repartis passent de <!-- val:aides_bourg_normal -->14 % à <!-- val:aides_bourg_les_deux -->3 % avec le rythme paisible et la patience grande (section 4.21).
- **Des rattrapages automatiques**: la réputation monte plus vite quand on reste longtemps à une adresse (RE-05); les fournisseurs livrent même quand la caisse est vide (EC-06).
- **Rien ne compare les joueurs**: aucune statistique par joueur, aucune qualité affichée chez l'autre, aucun son de réussite ou d'échec d'un geste (son.md), tout va au pot commun; l'historique ne retient que des faits partagés.
- **Rien ne demande de réflexe**: la meilleure fenêtre d'extraction dure 2 secondes, la machine s'arrête seule à 20 secondes, et « Correct » reste un bon café.

### 2.5 Aucun temps mort subi

| Situation | Ce que fait celui qui attend |
|---|---|
| Heure creuse du service | une fournée, la vitrine, un mot avec un habitué, la plonge, un réassort, la décoration (on peut déplacer un meuble libre en plein service) |
| L'autre consulte la tablette | le service continue; on prend ses tickets |
| Préparation (horloge arrêtée) | chacun a de quoi faire: ranger la livraison (les gros cartons à deux), fournées, carafes, ardoise, décoration, achats |
| Fermeture (horloge arrêtée) | l'un lit le livre d'or, l'autre passe la commande aux fournisseurs; le bilan s'affiche chez les deux |
| Le jour de l'installation (jour 1, Ormeval) | toujours deux tâches indépendantes ouvertes: l'un au téléphone pendant que l'autre découvre le local; un balai et une éponge, un outil chacun; la livraison de Gaby arrive pendant le ménage; la chauffe de la machine (20 s) tombe quand il reste la salle à installer (`demo/depart-cellule-vide-v0-3.md`, 5.3) |
| Le lundi (fermé) | brocante, travaux, visite d'une succursale: activités faites ensemble, ou « Passer à mardi » d'un commun accord |
| Un client parle longuement à l'un | l'autre continue; l'horloge ne s'arrête pas pour une conversation |
| L'un s'absente du clavier | après 60 secondes de service sans entrée, la pancarte passe à « Petite pause »; l'autre finit les commandes en cours (PA-04) |
| Déménagement | une scène commune en place, puis un fondu: aucun écran d'attente au-delà du chargement (5 s au plus, C23) |

## 3. Boucles de jeu (game-designer)

- **Boucle de 30 secondes**: une commande au comptoir, un espresso lancé, le lait moussé pendant que l'extraction coule, le service, une table débarrassée. « Deux crèmes et un chocolat ! », « Ça part ! ». Chaque geste a son retour visuel et sonore (section 5.2).
- **Boucle d'une journée** (<!-- val:journee_median_min -->20 minutes réelles en moyenne):
  1. **Préparation**, horloge arrêtée à l'heure d'ouverture: ranger la livraison du matin, fournées et carafes, ardoise du jour (la tablette propose une carte, on la retouche), décoration, achats. 2 à 6 minutes.
  2. **Service**, horloge en marche dès que la pancarte se retourne: trois coups de feu dans la journée (le café du matin, le déjeuner dès le bourg, le goûter), des heures plus calmes entre eux. 10 à 13 minutes selon l'adresse.
  3. **Fermeture**, horloge arrêtée: les derniers clients finissent tranquillement, puis le bilan (caisse, clients, mots du livre d'or), la commande aux fournisseurs, les achats et travaux, « Nos projets ». 2 à 5 minutes. La journée finit quand les deux joueurs ont dit « À demain ».
- **Boucle d'une semaine**: lundi fermé (brocante, travaux, visite d'une succursale), jour de marché, mercredi des familles, sorties d'école, week-end des promeneurs et, dès la ville, du brunch. Un défi local tombe un dimanche ou un jour de marché.
- **Boucle d'une saison** (28 jours, quatre semaines): météo et envies de saison (boissons chaudes l'hiver, terrasse et boissons glacées l'été), une recette découverte chaque saison, deux événements.
- **Boucle d'une adresse** (trois à cinq semaines pour un duo médian): arriver et rencontrer la personne qui vous confie le lieu; équiper et décorer (à Ormeval, tout part d'une boutique vide: `demo/depart-cellule-vide-v0-3.md`); gagner la réputation; ouvrir la première extension; tenir le défi local (une journée de fête, toujours réussie); recevoir la lettre de l'adresse suivante, mettre de côté, déménager un lundi. Le café quitté devient une succursale.
- **Long terme**: la maison et ses cinq cafés, les histoires des habitués, les recettes, la visite du Guide de la Tasse et la fête de la maison; puis le jeu libre: retourner jouer dans chaque café, finir « Nos projets », tout décorer.
- **Entre les séances**: rien ne bouge. Pas d'horloge réelle, pas de succursale qui tourne sans vous. On retrouve la maison à la seconde près, quelle que soit la machine qui héberge.

**Comprendre le but en moins d'une minute**: la première scène le dit en trois phrases, sur la place, devant le rideau baissé. Simone, l'ancienne patronne, propriétaire des murs, tend les clés: « Ah, vous voilà. Le café dort depuis trois ans, depuis ma retraite. Les murs sont à moi, j'habite juste au-dessus. » « Vous voilà chez vous. Faites de ce café l'endroit où l'on aime s'arrêter : équipez-le, écrivez votre carte, servez vos clients, et la maison grandira. » « Tenez, les clés. Le rideau de la porte est dur : levez-le à deux. » Pendant l'installation, le guide de Simone tient la liste « À faire »; ensuite, « Nos projets » affiche toujours les trois prochains objectifs.

## 4. Règles (game-designer)

Les règles sont numérotées pour la recette (préfixe par système). « Le duo » désigne les deux joueurs ensemble; « un joueur » suffit quand l'un des deux suffit. L'hôte fait autorité (ADR 0007): il reçoit les intentions des deux joueurs et les applique dans leur ordre d'arrivée; les gestes de précision sont jugés sur la machine du joueur qui les fait (C16). Toutes les valeurs chiffrées vivent dans les tables de la section 4.20, qui deviendront les fichiers de configuration typés du jeu (`reglages.json`, `profils.json`, `recettes.json`, `meubles.json`, technique, section 8.2).

### 4.1 Entités et états

| Entité | États et données |
|---|---|
| Maison (une par emplacement de sauvegarde, trois emplacements) | nom, emblème et couleurs choisis à deux, caisse, tirelire du déménagement, somme « à régler », renommée, recettes connues, fiches, « Nos projets », livre d'or (300 mots gardés), date (année, saison, jour, heure, minute), météo du jour et du lendemain, réglages du duo, état du générateur aléatoire, liaison des avatars aux joueurs |
| Café (un par adresse ouverte) | adresse, rôle (café joué ou succursale), meubles et décorations posés (position, niveau, rotation, teinte, style), postes et niveaux d'équipement, extensions faites et en travaux, places par type, vaisselle (propre, sale, en usage), stock (par produit et par date), ardoise (recettes et prix), mode de service (comptoir ou salle), points de réputation et tasses, satisfaction de la veille, équipe, gérance, résultats des 28 derniers jours |
| Joueur (deux) | identifiant stable du joueur Duo, avatar (silhouette, coiffure, haut, tablier à la couleur du joueur), position et regard, objet en main ou plateau, poste réservé, aides, état: actif, au poste, à la tablette, en aménagement, en port à deux, en conversation, absent |
| Groupe de clients | profil, taille (1 à 4 personnes), heure d'arrivée, patience, étape (dehors, file, attend une place, assis sans commande, attend sa commande, servi, recommande, parti, reparti), place, commande(s), pièces de vaisselle sur sa table, satisfaction |
| Habitué | prénom, profil, commande fétiche, heures et jours de passage, lien (0 à 800 points, cinq niveaux), étape de son histoire, adresses où il passe |
| Ticket | commande, articles et options, table ou comptoir, heure, couleur du joueur ou de l'employé qui l'a pris, articles prêts |
| Article en préparation | recette, étapes faites, poste occupé, minuterie de la machine, qualité de chaque étape |
| Employé | prénom, rôle, deux traits, niveau (1 à 3), jours travaillés, jours de présence, postes confiés, recettes montrées, adresse |
| Fournisseur | prénom, ce qu'il livre, adresse, heure de livraison |
| Carton | produit ou meuble, poids (léger: porté seul; lourd: à deux), emplacement (porte de service, réserve, frigo) |
| Proposition | achat important, ouverture, fermeture anticipée, déménagement, réglage du duo: en attente de l'accord de l'autre |

### 4.2 Le temps

- **TE-01** L'horloge est partagée: les deux joueurs vivent la même minute. Une minute de jeu dure 1 seconde réelle; une heure de jeu, une minute réelle. Réglage du duo « Rythme paisible »: 1,25 seconde.
- **TE-02** La journée a trois temps (cadrage, section 4.2):
  1. **Préparation**: l'horloge est arrêtée à l'heure d'ouverture de l'adresse (table `adresses`).
  2. **Service**: l'horloge tourne de l'ouverture à la fermeture. Les gestes se font en secondes réelles.
  3. **Fermeture**: à l'heure de fermeture, la pancarte se retourne seule; plus personne n'entre. Les commandes déjà prises sont préparées et servies; les clients installés finissent tranquillement pendant 15 minutes de jeu (fermeture douce), puis partent; un client servi après cette fermeture douce part dans les 5 minutes de jeu. L'horloge s'arrête quand le dernier client est sorti.
- **TE-03** Ouvrir: un joueur retourne la pancarte (ou appuie sur sa touche d'ouverture); l'autre voit « On ouvre ? » et répond « Oui, on ouvre » par la même action. La pancarte se retourne quand les deux l'ont fait. Raison: un joueur en pleine décoration ne doit pas voir arriver les clients sans l'avoir voulu.
- **TE-04** Fermer plus tôt: proposition d'un joueur, accord de l'autre; la suite comme TE-02.3. Utile pour une séance courte.
- **TE-05** Finir la journée: au bilan, chaque joueur choisit « À demain » ou « Encore un instant »; la journée suivante commence quand les deux ont choisi « À demain » (puis PA-08 propose de finir la séance).
- **TE-06** La semaine compte sept jours. Le jour 1 de la maison est le lundi du printemps de l'année 1. Le lundi, la maison est fermée (TE-08); mardi à dimanche, elle ouvre.
- **TE-07** Les saisons durent 28 jours (quatre semaines) et commencent un lundi: printemps, été, automne, hiver. L'année compte 112 jours.
- **TE-08** Le lundi, l'horloge est arrêtée toute la journée: travaux (les extensions commandées se construisent), brocante (des pièces uniques à prix doux), visite d'une succursale (dialogue avec la gérance, réglages), commandes. La journée finit quand les deux ont choisi « Passer à mardi ». Raison: un vrai café ferme un jour par semaine; c'est le jour des chantiers et des flâneries. Le jour 1, ce lundi est celui de l'installation dans la boutique vide d'Ormeval (`demo/depart-cellule-vide-v0-3.md`); les achats de ce jour-là sont livrés dans la journée par Gaby, devant la vitrine.
- **TE-09** Jours particuliers de la semaine (multiplicateurs: table `jours`):
  - jour de marché: Mérelles le jeudi, Montaurel le samedi, les Plumassiers le mardi et le vendredi, le boulevard des Horticulteurs le dimanche; Ormeval n'a pas de marché;
  - mercredi: les enfants n'ont pas classe l'après-midi, les familles viennent;
  - mardi, jeudi, vendredi: la sortie d'école à 16 h 30 fait le goûter;
  - samedi et dimanche: promeneurs, familles et, dès que la cuisine de l'Imprimerie est ouverte, brunch; les pressés se font rares.
- **TE-10** La météo du jour se tire à l'aube selon la saison (table `meteo`): soleil, couvert, pluie, chaleur (été), froid et neige (hiver). Celle du lendemain s'annonce à la fermeture, à la radio du café: on peut préparer une carafe de citronnade la veille d'une chaleur. La terrasse n'accueille personne sous la pluie, le froid ou la neige (une fois les plaids achetés, elle rouvre par froid sec).
- **TE-11** Événements (calendrier en section 6.8): de semaine, de saison, d'adresse (défis). Ils n'interrompent jamais un geste et s'annoncent la veille.
- **TE-12** Aucune horloge réelle: rien ne se passe entre deux séances. Le monde ne bouge que quand les deux jouent ensemble.
- **TE-13** L'adresse du jour se choisit à l'aube, avant la préparation, quand la maison a plusieurs cafés (C23). Par défaut: le dernier café ouvert. Le café principal non joué ce jour-là tourne comme une succursale s'il a au moins un employé en salle; sinon il garde sa pancarte « Fermé exceptionnellement ».

### 4.3 La carte et l'attrait

- **AT-01** L'**ardoise** est la carte du jour. Elle a un nombre de lignes fixé par l'adresse (8 au village, 12 au bourg, 16 en ville et au café d'angle, 20 à la maison parisienne). Chaque ligne est une recette connue, faisable avec les postes du café, et son prix. Une ardoise de trottoir la montre à la rue: c'est elle qui fait entrer les clients. Raison des limites: choisir, c'est décider qui l'on veut accueillir.
- **AT-02** Chaque matin, la tablette propose l'ardoise qui attire le plus de monde avec les recettes faisables et le stock (le duo de la simulation la suit); le duo la garde ou la retouche. Une recette dont un produit manque est grisée (« Plus de lait d'avoine »).
- **AT-03** Le **prix** de chaque ligne se règle de -30 % à +50 % du prix conseillé, par pas de 0,10 €. Le prix conseillé vaut le prix du village multiplié par l'indice de l'adresse (de x1 au village à x2 à la maison parisienne, table `adresses`): un espresso coûte 1,40 € au comptoir d'Ormeval, 2,80 € à la maison parisienne. En salle et en terrasse, à partir du bourg, s'ajoute le prix en salle (x1,2, l'usage français).
- **AT-04** Chaque profil (section 6.4) a une **envie principale** et deux ou trois **envies secondaires**, chacune une famille de recettes. Les **points d'envie** d'un profil: 3 si l'ardoise propose au moins une recette de son envie principale, +1 si elle en propose trois ou plus (variété), +1 par envie secondaire présente.
- **AT-05** Facteur **carte** selon les points d'envie: 0 point x0 (personne de ce profil n'entre), 1: x0,35, 2: x0,55, 3: x0,75, 4: x0,9, 5: x1, 6: x1,1, 7 et plus: x1,2. Facteur **prix**: 1 - sensibilité du profil x (indice de prix - 1), borné de x0,4 à x1,25, où l'indice est le prix moyen des lignes qui l'attirent divisé par le prix conseillé. Facteur **lieu**: 0,75 + 0,25 x ambiance / 100, +0,10 si le style dominant est l'un de ceux du profil avec une cohérence de 50 % au moins (+0,15 à 75 %), +0,08 par équipement recherché présent (deux au plus). Facteur **réputation**: de x0,7 (une tasse) à x1,3 (cinq tasses). Facteur **humeur**: 1 + (satisfaction moyenne de la veille - 70) / 100, borné à ±10 % (« Hier, vos clients étaient ravis: on en parle sur la place »).
- **AT-06** Les **passants intéressés** d'un profil dans une heure = flux de base de l'adresse (table `flux`, groupes par jour) x poids de l'heure (table `courbes`, ramené aux heures d'ouverture) x jour (table `jours`) x météo (table `meteo`) x saison (table `saisons`).
- **AT-07** Groupes attendus d'un profil dans l'heure = **passants intéressés x carte x prix x lieu x réputation x humeur** (x affluence, réglage du duo). Les arrivées suivent une loi de Poisson autour de cette valeur. Exemple chiffré, un mardi de printemps couvert, la première semaine à Ormeval (deux tasses, ambiance 40, style campagne à 50 % de cohérence, gobelets à emporter achetés; ardoise: espresso, allongé, noisette, café crème, thé noir, chocolat chaud, croissant, pain au chocolat):

<!-- table:res_exemple -->
| Profil | Heure | Passants intéressés dans l'heure | Carte | Prix | Lieu | Réputation (2 tasses) | Humeur d'hier (74) | Groupes attendus dans l'heure |
|---|---|---|---|---|---|---|---|---|
| Les pressés | 8 h | 1,62 | 6 points: x1,1 | x1 | x0,93 | x0,85 | x1,04 | 1,47 |
| Les voisins | 8 h | 1,22 | 6 points: x1,1 | x1 | x0,95 | x0,85 | x1,04 | 1,13 |
| Les familles | 16 h | 0,60 | 4 points: x0,9 | x1 | x0,95 | x0,85 | x1,04 | 0,45 |
| Les gourmands | 16 h | 0,84 | 3 points: x0,75 | x1 | x0,95 | x0,85 | x1,04 | 0,53 |

  Lecture: entre 8 h et 9 h, un groupe et demi de pressés et un groupe de voisins sont attendus; au goûter, les gourmands trouvent trois envies secondaires mais aucune pâtisserie: écrire une tarte sur l'ardoise les ferait passer de 3 à 6 points (de x0,75 à x1,1).
- **AT-08** Réglage du duo « Affluence »: douce (x0,8), normale (x1), vive (x1,2). Il multiplie les passants; il ne change ni les prix ni les seuils de la progression (une affluence douce allonge donc l'histoire).
- **AT-09** Les goûts se découvrent: la première fois qu'un profil commande une recette, sa fiche du « Carnet des clients » (tablette) l'inscrit; les envies d'un profil s'y lisent en toutes lettres dès le premier client servi.

### 4.4 Clients: arrivée, comportement, patience

- **CL-01** Les clients viennent en **groupes** de une à quatre personnes (table `profils`); un groupe commande une fois pour tous et occupe une place par personne.
- **CL-02** À la porte, un groupe **estime l'attente**: 25 secondes par groupe qui attend déjà (dans la file, à l'entrée en attendant une place, assis sans avoir commandé, en attente de sa commande), divisées par le nombre de personnes qui servent (joueurs et employés présents). Si l'attente estimée dépasse sa patience (table `profils`), il passe son chemin. Raison: un café plein mais bien tenu attire encore; un café débordé se voit de la rue.
- **CL-03** Un groupe n'entre pas non plus si le café est complet (plafond de personnages présents de l'adresse, C2, joueurs et employés compris) ou si la file d'attente, de **six places au plus** (C4), ne peut le recevoir. Il le dit d'un geste devant la vitrine (« C'est complet, on repassera »). Ces clients-là sont comptés « repartis » au bilan, sans autre effet que l'argent qu'ils n'ont pas dépensé.
- **CL-04** **Service au comptoir** (le seul au village, au choix ensuite): on commande à la caisse, on paie, on récupère sa commande sur le passe, puis on s'assoit ou l'on reste au comptoir. **Service en salle** (à partir du bourg, réglé par café sur la tablette, achat « Service en salle »): les groupes qui veulent une table s'assoient d'abord; un joueur ou un employé prend la commande à la table, la sert sur un plateau et encaisse à la table (terminal portable). Les profils du comptoir (pressés, voisins, connaisseurs) commandent toujours à la caisse.
- **CL-05** **Patience**: de 35 secondes (pressés) à 120 secondes (voisins) dans la file ou avant qu'on prenne la commande à table (table `profils`). Un groupe qui n'a pas encore commandé et dont la patience s'épuise repart. Réglage du duo « Patience des clients: grande »: x1,5.
- **CL-06** **Un client qui a commandé ne repart jamais** avant d'être servi, et ne se fâche jamais. Son attente pèse sur sa satisfaction (RE-01); son visage et sa posture passent de « attend » à « impatient » (bible, 7.6), jamais à la colère.
- **CL-07** **Les places**: chaque profil veut un type de place (comptoir, table, confort, terrasse); s'il n'y en a pas, il prend la plus proche dans l'ordre de la table des replis (une table plutôt qu'un fauteuil, un fauteuil plutôt que la terrasse, puis le comptoir pour un groupe de deux au plus). Les profils du comptoir préfèrent rester debout au zinc (places debout de l'adresse) plutôt que de prendre une table. Sans aucune place, un groupe servi au comptoir boit debout et repart deux fois plus vite. Une table pas encore débarrassée peut être prise: le groupe s'y installe, un peu déçu (RE-01).
- **CL-08** **Séjour**: une fois servi, le groupe reste de 5 minutes de jeu (pressés, souvent à emporter) à 4 heures et demie (télétravailleurs, table `profils`); certains **recommandent** pendant leur séjour (un second café, une théière de plus): le voisin revient au comptoir, le client en salle lève la main.
- **CL-09** **Emporter**: une fois les gobelets achetés, la moitié des pressés et quelques autres emportent leur commande; ils ne prennent ni place ni vaisselle.
- **CL-10** Les clients et les employés **ne bloquent jamais un joueur** (C15): ils s'écartent, ralentissent ou contournent. Deux clients face à face plus de 2 secondes se croisent en douceur.
- **CL-11** Les **toilettes** de chaque adresse (élément fixe du plan) servent aux clients de passage; elles n'ont aucun effet de jeu.
- **CL-12** Au plus **huit habitués** sont attendus dans une journée (son.md): les autres reviendront.

### 4.5 Commandes, tickets, préparation, gestes et qualité

- **CO-01** **Prendre une commande**: au comptoir, le joueur regarde le client de face et agit: le client dit sa commande (bulle de texte, sans voix), le ticket s'imprime et monte sur le rail, l'encaissement est fait (2,5 s, plus 0,4 s par article au-delà du premier). À table: même geste à la table (2,5 s), le ticket part au rail.
- **CO-02** **Ce que commande un groupe**: chaque personne prend une boisson dans les familles de ses envies présentes à l'ardoise (poids 3 pour l'envie principale, 1 pour une secondaire; à défaut, n'importe quelle boisson de l'ardoise), puis, selon son profil, quelque chose à manger. Les bruncheurs prennent la formule brunch quand elle est à l'ardoise.
- **CO-03** **Le rail des tickets** est un objet au-dessus du comptoir, visible du bar et de la caisse. Un ticket montre ses articles et leurs options, la table ou « comptoir », et le temps d'attente (son papier jaunit doucement). Prendre un ticket le teinte à la couleur du joueur ou de l'employé; n'importe qui peut encore aider à le préparer. Un article prêt posé sur le passe rejoint seul son ticket.
- **CO-04** **Préparer**: chaque recette est une suite d'étapes, chacune à un poste (table `recettes`): une partie active (le joueur agit), une partie passive (la machine travaille seule, le joueur peut faire autre chose) et parfois un geste pour finir (arrêter l'extraction, sortir la gaufre). Une étape occupe une place du poste (table `postes`: deux groupes à la machine du village, trois ensuite). Les étapes d'une boisson au lait se font en parallèle (le lait se mousse pendant que l'extraction coule); celles d'un croque se suivent (monter, puis enfourner).
- **CO-05** **Fenêtres des gestes** (jugées sur la machine du joueur qui les fait, C16):
  - **extraction**: le café est prêt à 12 s; l'arrêter entre 12 et 14 s donne un espresso « Parfait »; de 14 à 18 s, il blondit: « Bien »; au-delà, « Correct »; avant 10 s, sous-extrait: « Correct »; la machine coupe seule à 20 s. La machine à arrêt programmé (niveau 3) s'arrête seule au bon moment (« Bien », un quart des tasses « Parfait »);
  - **lait**: tenir la buse jusqu'à 58 à 65 °C donne « Parfait »; de 52 à 58 °C ou de 65 à 70 °C, « Bien »; la buse coupe à 72 °C (le lait siffle): « Correct » (valeurs du sound-designer, son.md). La buse automatique (niveau 3) coupe seule à 62 °C;
  - **thé**: verser l'eau à la bonne température (vert à 80 °C, noir et infusions à 95 °C): la bouilloire simple demande d'attendre le bon trait, la bouilloire à température le fait seule;
  - **four, crêpière, gaufrier**: sortir ou retourner pendant la fenêtre « dorée » (2 s), sinon « Correct »; rien ne brûle;
  - **dessin sur le lait** (facultatif, après le moussage): un tracé à la souris de 2 s, qui donne un cœur, une feuille ou une tulipe.
- **CO-06** **Qualité** d'un article: « Parfait », « Bien » ou « Correct », jamais raté. Elle s'affiche en petit chez le seul joueur qui a fait le geste, sans aucun son (son.md); l'article lui-même montre sa qualité à qui le regarde (crème dorée, mousse lisse). « Correct » reste un bon café: le client le boit sans rien dire.
- **CO-07** **Aide « Gestes simplifiés »**, propre à chaque joueur et invisible pour l'autre: un clic par geste, les machines s'arrêtent seules, qualité « Bien » assurée. Aides « Rappel des options » (la bouteille de lait d'avoine ou le moulin à déca s'éclairent) et « Guide du poste » (le prochain objet à prendre brille).
- **CO-08** **Options** (version 1, question Q6): « lait d'avoine » pour les boissons au lait (8 % des commandes) et « déca » pour les cafés (5 %), écrites sur le ticket. Un article préparé sans l'option est servi quand même; le client le remarque gentiment (« C'était avec du lait d'avoine, mais ce n'est pas grave »): -8 à sa satisfaction et un mot possible au livre d'or. Non simulé (effet borné).
- **CO-09** **Un article en trop** (deux joueurs ont préparé la même boisson) reste sur le passe avec une étiquette « Prêt »: il part au prochain client qui commande la même chose, ou s'offre à un habitué (lien +10). Rien ne se perd.
- **CO-10** Une main tient un objet; un plateau en porte quatre (le grand plateau de Paris, six). Un objet est tenu, posé sur un emplacement déclaré ou rangé: rien ne tombe ni ne se renverse (C12).
- **CO-11** **Vaisselle**: chaque article demande sa pièce (tasse, verre, assiette; une théière et sa tasse comptent pour deux). Sans pièce propre de la bonne sorte, on ne peut pas commencer la recette: la pile vide se voit au bar.

### 4.6 Service, encaissement, pourboires

- **SE-01** **Servir au comptoir**: poser la commande complète sur le passe (1 s); le client la prend et va s'asseoir. **Servir à table**: charger le plateau (quatre articles), aller à la table, poser (0,8 s, plus 0,4 s par article); un plateau plein ou un second voyage pour une grande table.
- **SE-02** **Encaisser**: au comptoir, à la commande; en salle, en servant (terminal portable). Aucun rendu de monnaie: le client paie par carte ou laisse le compte juste dans la soucoupe.
- **SE-03** **Pourboires**: un groupe content (satisfaction de 75 et plus) laisse un pourboire une fois sur deux, 5 % de l'addition (10 % à 88 et plus), multiplié par la générosité du profil (table `profils`). Les pièces tombent dans le pot à pourboires du comptoir, visible des deux; elles rejoignent la caisse au bilan. Comme en France, les pourboires restent modestes (section 4.21).
- **SE-04** **Parler**: regarder un client à 2,5 m au plus et agir ouvre deux répliques (2 s). Un voisin ou un habitué à qui l'on a parlé pendant son séjour gagne +12 de satisfaction; un habitué gagne aussi du lien (HA-02).
- **SE-05** **« Comme d'habitude ? »**: servir à un habitué sa commande fétiche avant qu'il ne l'ait passée (préparée en le voyant entrer) donne +10 de satisfaction et du lien.

### 4.7 Débarrasser et vaisselle

- **PL-01** Quand un groupe part, sa table garde sa vaisselle: **débarrasser** (1,5 s à la table) met les pièces sur le plateau, puis à la plonge. Une table pas débarrassée reste utilisable (CL-07).
- **PL-02** **À l'évier**: laver quatre pièces à la fois, 1,5 s par pièce; elles vont à l'égouttoir puis à leur pile.
- **PL-03** **Au lave-vaisselle** (achat du bourg): charger (0,3 s par pièce, 24 pièces), le cycle tourne seul 45 s, vider (4 s). Lave-vaisselle à capot (ville): 40 pièces, 25 s. L'évier reste utilisable en renfort.
- **PL-04** Rien ne casse, rien ne se perd (C12). Le stock de vaisselle s'agrandit par achat (« Service de vaisselle », +24 pièces) et se compte en piles (une pile est un seul objet, C7).

### 4.8 Stock, fournisseurs, livraisons, invendus

- **ST-01** **Produits**: grains (mélange de la maison, puis origines et « notre mélange »), lait, lait d'avoine, crème, thés et plantes, chocolat, sucre, farine, beurre, œufs, fruits de saison, agrumes, fromage et jambon, légumes de saison, viennoiseries et tartes du boulanger (tant qu'il n'y a pas de four). Le coût en matières de chaque recette est dans la table `recettes`.
- **ST-02** **Commander**: à la fermeture, sur la tablette. Elle propose la « commande habituelle » calculée sur les trois dernières journées et l'ardoise prévue; on la valide d'un geste ou on la retouche. Les fournisseurs livrent le lendemain, avant la préparation.
- **ST-03** **Fournisseurs**: un visage et un véhicule chacun (bible, 7.5). Au village, Armelle la laitière (triporteur), Lucas le boulanger de la place, Joseph le petit torréfacteur de la vallée; au bourg, Marion la maraîchère du jeudi en plus; en ville, Aïcha Benali (café de spécialité); à Paris, Rémi le grossiste (blouse, diable) et Zoé, livreuse en vélo cargo. Ils déposent les cartons à la porte de service et disent un mot.
- **ST-04** **Ranger la livraison**: chaque carton se porte jusqu'à sa place (réserve, frigo, étagère du bar) et se range d'un geste; un carton lourd (sacs de grains, caisses de lait, gros meuble) se porte à deux (1,2 m/s au plus, C14), ou seul plus lentement (0,9 m/s). Plus tard, un commis range à la place des joueurs.
- **ST-05** **Rupture**: une recette dont un produit manque se grise sur l'ardoise; ses clients choisissent une autre recette de leurs envies. Dépannage: un appel sur la tablette (l'épicerie du village, la boulangerie, le grossiste à Paris) livre dans l'heure de jeu, au prix +30 %.
- **ST-06** **Fraîcheur et invendus**: viennoiseries, pâtisseries, quiches et soupes sont du jour; lait, crème et fruits se gardent une semaine au frigo. À la fermeture, ce qui ne se garde pas part au « panier du soir » (une association du quartier inventée, ou des habitués): +1 point de réputation par article donné, 20 par jour au plus. Rien ne se jette.
- **ST-07** **Fournées**: le four cuit 6, 12 puis 24 pièces à la fois; une fournée se lance en préparation ou aux heures creuses (cuisson de 30 à 40 s réelles, à sortir dans sa fenêtre dorée). Le fait maison coûte moins cher en matières (un croissant maison 0,30 € au lieu de 0,70 € acheté) et plaît (+3 de satisfaction).
- **ST-08** **Avant le four** (le village), viennoiseries et tartes s'achètent au boulanger: moins de marge, aucune fournée.

### 4.9 Ambiance

- **AM-01** L'**ambiance** d'un café (0 à 100) s'additionne ainsi:

| Composante | Points | Calcul |
|---|---|---|
| Décor | 0 à 40 | charme des meubles et objets posés (catalogue) par mètre carré ouvert au public, 40 points à 1,2 de charme par m²; au-delà, un objet de plus n'ajoute rien (« un ensemble cohérent vaut mieux qu'un entassement ») |
| Cohérence | 0 à 20 | 20 x cohérence du style (AM-02) |
| Confort | 0 à 15 | 30 x part des places confortables (fauteuils, banquettes, coussins), 15 au plus |
| Lumière | 0 à 10 | luminaires posés au regard du besoin de la salle (un pour 8 m², moins de jour près des vitrines); seuls quatre éclairent vraiment à la fois (C9), tous comptent |
| Musique | 0 à 5 | 5 si la liste jouée va avec le style dominant (son.md), 2 pour une autre liste, 0 en silence: le silence ne pénalise pas |
| Propreté | 0 à 10 | 10, moins 2 par table pas débarrassée depuis plus de 30 s, moins 3 si le sol n'a pas été balayé de la journée |
| Fréquentation | 0 à -5 | -5 si moins d'une place sur dix est occupée en plein service (« Un peu vide »), -5 si le café est complet (« On s'entend à peine ») |

  La simulation agrège décor, cohérence, confort et lumière en paliers de +10 achetés (table `ambiance`), et retient une propreté et une musique moyennes.
- **AM-02** **Cohérence du style** (règle chiffrée de la roue des styles de la bible, section 8): chaque meuble ou objet stylé porte ses points de charme dans un seul style; les objets neutres (plantes, livres, horloges simples) ne comptent pas. Le style dominant est celui qui a le plus de points. Sur la roue (campagne, jardin, nordique, rétro, bistrot, atelier), ses deux voisins **s'accordent** (leurs points comptent à moitié), l'opposé **se heurte** (ses points comptent à moitié en moins), les deux autres **se côtoient** (ils ne comptent pas).
  Cohérence = (points du dominant + 0,5 x points des voisins - 0,5 x points de l'opposé) / points de tous les objets stylés, bornée de 0 à 1.
  Exemple au village: 40 points de campagne, 12 de jardin (voisin), 8 de rétro (opposé), 10 de bistrot (se côtoie): (40 + 6 - 4) / 70 = 60 %, « cohérent »; les profils qui aiment le style campagne y gagnent x0,10 sur le lieu (AT-05). Un style seul, ou deux voisins à parts égales, dépasse 75 % (« harmonieux »).
- **AM-03** L'ambiance se dit en mots, jamais en chiffres dans le café: « Un peu vide » (0 à 29), « Sympathique » (30 à 49), « Chaleureuse » (50 à 69), « Charmante » (70 à 84), « Exceptionnelle » (85 et plus). La tablette dit ce qui la tire vers le bas (« Les tables attendent d'être débarrassées »).
- **AM-04** L'ambiance pèse deux fois: sur l'attrait (facteur lieu, AT-05) et sur la satisfaction ((ambiance - 50) / 5, de -10 à +10, RE-01).
- **AM-05** La **musique** vient d'un appareil acheté comme un meuble (une radio à deux stations au village, un tourne-disque au bourg, une platine par salle en ville, une sonorisation à Paris, son.md); la maison garde ses disques d'une adresse à l'autre. La porte reste ouverte l'été: la rue entre dans le café.

### 4.10 Satisfaction, livre d'or, réputation et renommée

- **RE-01** La **satisfaction** d'un groupe (0 à 100) se calcule à son départ (table `satisfaction`): base 70; attente au-delà de l'attente sans gêne de son profil (-0,5 par seconde, -30 au plus); qualité moyenne de ses articles (+10, +4 ou -4; double pour les connaisseurs); dessin sur le lait (+4); fait maison (+3); prix ressenti; place (voulue +5, debout alors qu'il voulait s'asseoir -10, table pas débarrassée -6); ambiance; deux mots échangés (+12); « Comme d'habitude ? » (+10); option oubliée (-8, CO-08).
- **RE-02** Le **livre d'or** est posé sur le comptoir. Un client ravi (85 et plus) y écrit une fois sur huit, un client déçu (45 et moins) une fois sur dix, un habitué une fois sur trois. Chaque mot est écrit à la main et dit la raison principale, bonne ou mauvaise (« Le cappuccino avait un cœur dessus ! », « Pas trouvé de place pour m'asseoir, dommage »). Il se lit à la fermeture, chez les deux. Les mots préférés s'épinglent (« Nos mots préférés »); la maison en garde 300 (technique, section 6.1). Aucun mot ne nomme un joueur.
- **RE-03** La **réputation** d'un café se compte en demi-tasses, de une à cinq. Chaque groupe servi lui apporte (satisfaction - 50) / 10 points, jamais moins de zéro: un client content la fait monter, un client déçu ne la fait pas baisser. Les points se cumulent par café; la demi-tasse k au-dessus de la réputation d'arrivée demande pas x k x (k + 1) / 2 points (table `reputation`): chaque palier est un peu plus long que le précédent. **La réputation ne baisse jamais.** Raison: aucun service raté ne se paie plus tard, et rien ne désigne le joueur « responsable » d'une mauvaise journée.
- **RE-04** L'**humeur de la veille** (satisfaction moyenne d'hier) ajoute ou retire jusqu'à 10 % de passants le lendemain (AT-05): la seule trace, passagère, d'une journée difficile.
- **RE-05** **Rattrapage**: après 12 jours ouverts à une adresse, les points de réputation du jour comptent 5 % de plus par jour au-delà, jusqu'au double (le bouche-à-oreille des habitués). Effet mesuré: les duos médians n'y arrivent presque jamais; les duos tranquilles y gagnent une semaine à certaines adresses.
- **RE-06** La **renommée de la maison** est la somme des points de réputation gagnés dans tous ses cafés, plus 45 % des points quotidiens moyens de chaque succursale et une prime à chaque défi local (table `defis`). Elle ne baisse jamais. Elle fait arriver la lettre de l'adresse suivante (PR-01).
- **RE-07** **Réputation d'arrivée**: la maison est connue avant d'ouvrir (1,5 tasse au village, 2 au bourg, 2,5 en ville, 3 au café d'angle, 3,5 à la maison parisienne).

### 4.11 Habitués

- **HA-01** Chaque adresse a cinq habitués (section 6.5), plus ceux qui suivent la maison. Un habitué a un prénom, un profil, une commande fétiche, ses jours et ses heures; il se reconnaît de dos à 6 m par un trait que personne d'autre ne porte (bible, 7.3). Son prénom s'affiche quand on le regarde de près, une fois qu'on l'a servi.
- **HA-02** **Lien** (0 à 800 points): +10 par visite servie, +15 si l'on a servi sa fétiche, +20 pour « Comme d'habitude ? », +10 pour deux mots échangés. Cinq niveaux, à 50, 150, 300, 500 et 800 points: Connaissance, Voisinage, Amitié, Grande amitié, Comme la famille.
- **HA-03** **Histoire**: chaque niveau ouvre une étape de son histoire, une courte scène en place (deux à six répliques, sans cinématique, C22), parfois un cadeau: une recette (table `recettes`), un objet de décor unique, un contact de fournisseur. Une étape ne se perd jamais: un habitué pas servi un jour revient le lendemain.
- **HA-04** **Au plus huit** habitués sont attendus par journée (CL-12); un habitué dont c'est le jour vient à son heure, quelle que soit l'ardoise (il prend autre chose si sa fétiche manque).
- **HA-05** **Qui suit la maison**: certains passent aux adresses suivantes (section 6.5), à leurs jours; tous viennent à la fête de la maison.
- **HA-06** Simone, la première habituée, est aussi la voix des premiers jours: elle explique les gestes en situation (« Attends que la crème soit dorée, et coupe »), puis se tait quand on n'a plus besoin d'elle.

### 4.12 Décoration et aménagement

- **DE-01** Le **mode aménagement** s'ouvre à tout moment, service compris; on y pose, déplace, tourne et range meubles et objets. Un meuble occupé (client assis, objet d'un client dessus) ne bouge pas pendant le service.
- **DE-02** **Grille**: les meubles se posent au sol sur une grille de 25 cm (technique, section 5.8), tournent par quarts de tour (ou par 15° pour les fauteuils et les plantes); les objets muraux se posent sur les murs libres (ni fenêtre, ni porte, ni vitrine), les suspensions au plafond, les petits objets sur les emplacements déclarés des meubles.
- **DE-03** **Circulation**: un meuble ne se pose pas s'il coupe l'accès à une place, un poste, la caisse, la porte, la porte de service, les toilettes ou la réserve. Passages: 0,9 m jusqu'à chaque place, 1,2 m pour l'allée principale, les portes de livraison et les escaliers publics, jamais moins de 0,6 m (C13, normes du level designer). Le refus dit pourquoi (« Les clients ne pourraient plus passer jusqu'à la fenêtre »). Raison: les clients doivent pouvoir marcher partout où ils s'assoient; un passage de moins de 0,6 m n'existe pas pour eux (grille de 25 cm).
- **DE-04** **Postes et raccordements**: une machine qui a besoin d'eau, d'évacuation ou d'une prise renforcée (machine à espresso, plonge, lave-vaisselle, four) ne se pose que sur un emplacement technique déclaré par la coque du level designer (là où arrivent l'eau et le courant: le conduit du four de Mérelles monte le long du mur mitoyen, par exemple). Les petits appareils (bouilloire, presse-agrumes, blender, crêpière, gaufrier) se posent sur un plan de travail à 1,5 m au plus d'une prise déclarée. L'électricien ou le plombier peut ajouter une prise ou un point d'eau dans les limites du plan, le lundi (travaux).
- **DE-05** **Meubles lourds** (banquette, vaisselier, enfilade, poêle, grande table, four, vitrine réfrigérée): ils se portent à deux, sans échec (C14: 1,2 m/s au plus, pas de demi-tour sur place, porteurs l'un derrière l'autre dans les passages étroits). Seul, on peut les faire glisser de 1 m au plus.
- **DE-06** **Terrasse**: les meubles de terrasse ne se posent que dans la zone de terrasse du plan, ouverte par l'extension correspondante (autorisation de la mairie).
- **DE-07** **Limites**: 60 meubles et objets au village, 120 au bourg, 200 en ville, 180 au café d'angle, 350 à la maison parisienne, et 150 visibles au plus dans une même vue (C6); la tablette dit « De la place pour 12 objets de plus ». Les objets mobiles (vaisselle, viennoiseries, cartons) restent sous les plafonds C7.
- **DE-08** **Rien ne se perd**: un meuble rangé va dans la remise de la maison (sans limite) et peut partir vers une autre adresse le lundi.
- **DE-09** **Brocante** (le lundi): douze pièces de caractère tirées chaque semaine, à -30 %, charme x1,5, souvent dans un style rare.
- **DE-10** **Accord**: un achat important (EC-05) se propose à l'autre, qui l'accepte ou le refuse; poser ou déplacer ne demande aucun accord, mais la position fantôme se voit chez les deux, à la couleur du joueur.

### 4.13 Employés

- **EM-01** **Quand**: aucun au village; au bourg, un coup de main (rôle commis) pour les jours d'affluence (marché du jeudi et week-end); à partir de la ville, une équipe (12 personnes au plus par adresse, C5). Chaque café parisien se reprend avec une partie de son équipe (quatre personnes au café des Plumassiers, six à la Graineterie, déjà au niveau 2): un café d'angle se vend d'ordinaire avec son personnel.
- **EM-02** **Embaucher**: la tablette affiche chaque lundi trois candidatures (prénom, rôle, deux traits, niveau). On embauche d'un geste; le salaire se paie par jour travaillé. Le duo de la simulation embauche quand plus de 12 % des groupes repartent trois jours de suite et qu'il a cinq jours de salaire en caisse (table `equipe`): c'est une conduite prudente, pas une règle du jeu.
- **EM-03** **Rôles** (table `employes`): service en salle (commandes, service, débarrasser), barista (machine, buse, thés, presse, blender, méthodes douces), commis (plonge, débarrasser, réserve, livraisons, vitrine), pâtisserie (four, plan, crêpière, gaufrier, fournées), plonge (vaisselle et débarrasser), gérance (une succursale). Un employé ne fait que les tâches de son rôle et laisse les autres aux joueurs.
- **EM-04** **Horaires**: tous les jours d'ouverture, ou seulement les jours d'affluence (marché et week-end), ou des jours choisis. Chacun prend une pause d'une heure de jeu au milieu de la journée, à tour de rôle.
- **EM-05** **Progrès**: un employé est plus rapide qu'un joueur débutant (x1 au niveau 1, x1,2 au niveau 2 après 8 jours travaillés, x1,35 au niveau 3 après 24 jours). Il apprend une recette en voyant un joueur la faire une fois devant lui (« montrer une recette ») ou seul en trois jours.
- **EM-06** **Humeur, sans dureté**: après deux heures de coup de feu sans pause, un employé ralentit de 10 % et le dit (« Je prendrais bien cinq minutes »); une pause le remet d'aplomb. Ni grève, ni démission fâchée, ni licenciement brutal: on lui propose une autre adresse, ou une fin de contrat en fin de semaine, avec un mot d'au revoir.
- **EM-07** Un employé cède toujours son poste à un joueur qui s'en approche et passe à la tâche suivante de son rôle. Il signale ce qui coince à voix haute (« Il me faut quelqu'un au bar ! »).
- **EM-08** **Traits** (deux par employé, noms épicènes): Main sûre (plus de gestes parfaits), Pied léger (marche 15 % plus vite), Sourire (pourboires x1,2), Bonne mémoire (reconnaît les habitués: « Comme d'habitude ? »), Sang-froid (ne ralentit jamais), Curiosité (apprend deux fois plus vite), Lève-tôt (plus vif le matin), Couche-tard (plus vif le soir), Patience d'ange (les clients de sa salle attendent 20 % plus volontiers), Douceur (familles +5 de satisfaction). Non simulés, sauf la vitesse.

### 4.14 Succursales

- **SU-01** Quand le duo quitte une adresse, son café reste ouvert, confié à quelqu'un: Simone au village, Léa (la nièce de René) au bourg, puis l'employé de son choix ailleurs (rôle gérance).
- **SU-02** **Résultat quotidien** d'une succursale, calculé une fois par jour à la fermeture du café joué, sans clients individuels (C25): 45 % du résultat moyen des sept dernières journées que le duo y a jouées, jamais négatif (le gérant ajuste ses achats). Sa renommée: 45 % de ses points de réputation quotidiens moyens. Raison: sans vous, le café tourne bien, mais moins bien; y revenir une journée reste utile. Si un ADR le demande, la fonction pure de l'architecte (technique, section 7.1) peut tirer flux, carte et équipe des mêmes tables; la version 1 garde cette règle lisible.
- **SU-03** **Régler** une succursale depuis la tablette: ardoise, prix, équipe, achats (livrés le lundi). Chaque réglage compte dès la journée jouée suivante sur place, et dans la moyenne des sept jours.
- **SU-04** **Y jouer**: choisir l'adresse à l'aube (TE-13). La journée s'y joue normalement et entre dans sa moyenne.
- **SU-05** Le jeu ne tourne pas entre les séances: une succursale ne rapporte que les jours joués par le duo (TE-12).

### 4.15 Économie

- **EC-01** **Une caisse** pour la maison. Recettes, pourboires, résultats des succursales y entrent; matières, loyer, charges, salaires, achats en sortent.
- **EC-02** **Prix**: section 4.3 (AT-03). Ordres de grandeur au comptoir: espresso 1,40 € à Ormeval, 2,50 € au café d'angle, 2,80 € à la maison parisienne; en salle, x1,2.
- **EC-03** **Coûts**: matières à chaque article (table `recettes`, x1 au village à x1,2 à Paris); loyer mensuel (table `adresses`), prélevé chaque jour au 28e, lundi compris; charges par jour ouvert (eau, énergie, assurance); salaires par jour travaillé (table `employes`, x1,2 à Paris).
- **EC-04** **Réserve**: un achat ne peut entamer ce qu'il faut pour payer deux jours de charges fixes (loyer, charges, salaires); la tablette affiche « Disponible » et « Gardé pour les charges ».
- **EC-05** **Achats importants**: un achat supérieur aux recettes moyennes d'une journée du café joué (300 € au moins) se propose à l'autre joueur, qui l'accepte ou le refuse; la somme est réservée pendant la proposition. Les déménagements et les embauches demandent toujours l'accord des deux.
- **EC-06** **Pas de faillite.** Si la caisse ne suffit pas à payer les charges du jour à la fermeture, le reste devient « à régler », sans intérêt ni pénalité: il se retire d'abord des résultats des jours suivants. Tant qu'il reste quelque chose à régler, les achats du catalogue et les embauches attendent, mais les fournisseurs livrent la commande habituelle (« On vous fait confiance »), et l'on peut toujours servir, ce qui rapporte toujours plus que les matières. La tablette propose une piste (« Votre équipe est plus grande que ce que la salle demande en semaine »). Il n'existe aucun état d'échec: le pire est une journée calme. Mesuré: aucun duo simulé n'a jamais eu de somme à régler.
- **EC-07** **Tirelire du déménagement**: quand la lettre de l'adresse suivante est arrivée et l'extension du défi payée, la tablette propose de mettre de côté une part du résultat de chaque journée (60 % par défaut, réglable de 0 à 100 %). L'argent de la tirelire sort quand on veut, d'un commun accord.
- **EC-08** **Installation**: s'installer à une adresse coûte une somme (table `adresses`: caution et premiers frais, 600 € au bourg à 3 000 € à la maison parisienne), modeste parce que chaque lieu est confié par quelqu'un qui veut qu'il revive (René, Agathe, Antoine, Éliane). Elle comprend l'équipement de départ (table `depart`). **Ormeval fait exception** (demande du client du 2026-11-08): pas d'installation à payer, mais une boutique vide et 1 800 € d'épargne; ce qui tient aux murs reste (comptoir, évier, toilettes, arrivées techniques, rideaux), tout le reste s'achète, en partie à Simone pour pas cher (sa vieille machine, ses tables et ses chaises), et rien ne permet d'ouvrir sans caisse, sans vaisselle et sans au moins une ligne servable à l'ardoise (`demo/depart-cellule-vide-v0-3.md`, sections 4 et 7).

### 4.16 Progression et déblocages

- **PR-01** **L'offre**: quand la renommée de la maison atteint le seuil de l'adresse suivante (table `adresses`), une lettre arrive au courrier du matin (« Une boutique se libère place de la Halle »). Elle ouvre le projet « Partir pour… » dans « Nos projets ».
- **PR-02** **Le défi local** de chaque adresse (table `defis`): quand la réputation du café atteint son seuil et que l'extension où il se tient est ouverte, il se tient au prochain jour prévu (dimanche, ou jeudi de marché au bourg). Ce jour-là, l'affluence est de x1,6; le défi réussit toujours (c'est une fête), la renommée gagne sa prime et le livre d'or ses plus beaux mots.
- **PR-03** **L'extension du défi** passe en tête des achats proposés par la tablette dès que la lettre de l'adresse suivante est arrivée.
- **PR-04** **Le déménagement**: quand l'offre est là, le défi tenu et la tirelire suffisante, le duo choisit de partir (accord des deux); il part le lundi suivant. Rien ne presse: on peut rester aussi longtemps qu'on veut. L'ancien café devient une succursale (SU-01).
- **PR-05** **Recettes** (table `recettes`): connues au départ; fiches du catalogue (20 à 80 €); offertes par un habitué à un niveau de lien; apportées par une machine (presse-agrumes: le jus pressé); découvertes de saison (offertes par un fournisseur le premier jour de la saison, si l'adresse convient); propres à une adresse (le brunch arrive avec l'atelier, notre mélange avec la torréfaction).
- **PR-06** **Équipement**: chaque poste a trois niveaux (à la main, machine, machine avancée, table `postes`); chaque adresse s'équipe à neuf (le café quitté garde ses machines); la table `achats` donne le catalogue des machines et leurs effets.
- **PR-07** **Extensions**: deux à quatre par adresse, celles des plans du level designer (table `extensions`), commandées sur la tablette, construites le lundi suivant. Certaines apportent un poste ou une recette (la cuisine du brunch, la torréfaction, le laboratoire).
- **PR-08** **La fin de l'histoire**: à la maison parisienne, quand la réputation atteint 4,5 tasses et que la maison est au complet (la torréfaction, le laboratoire, les salons de l'étage, le jardin et sa serre), le Guide de la Tasse passe incognito dans la semaine (un client au carnet de cuir qui revient chaque jour); le lundi suivant, la lettre annonce la Tasse d'or, et la fête de la maison réunit les habitués de toutes les adresses.
- **PR-09** **Le jeu libre**: après la fête, rien ne s'arrête. Les cafés restent, « Nos projets » garde ses objectifs de jeu libre (section 6.10), les saisons tournent.
- **PR-10** **Jamais bloqué**: aucune condition ne peut devenir impossible (réputation qui ne baisse pas, rattrapage, fournisseurs qui font crédit, tirelire qui grossit chaque jour ouvert).

### 4.17 Cas limites: actions simultanées, pause, absence, déconnexion, fin de séance

| # | Cas | Règle |
|---|---|---|
| SI-01 | Les deux prennent le même objet unique au même instant (cette tasse sur ce passe, cette assiette sur cette table) | le premier reçu par l'hôte l'obtient; chez l'autre, l'objet revient en 0,2 s et il lit « Déjà pris par Sacha » (technique, section 5.5). Les piles (tasses propres, assiettes) donnent un exemplaire à chacun et ne se disputent jamais |
| SI-02 | Les deux prennent le même ticket | le premier le teinte à sa couleur; l'autre lit « Ticket pris par Sacha » et peut encore aider à le préparer (CO-03) |
| SI-03 | Les deux préparent le même article | le premier fini rejoint le ticket; le second devient un article « en trop » (CO-09) |
| SI-04 | Les deux veulent la même place d'un poste (le même groupe de la machine) | l'hôte réserve la place au premier; l'autre lit « Ce groupe est pris » et prend l'autre groupe s'il est libre |
| SI-05 | Les deux servent la même commande | la première livraison compte; le plateau du second garde ses articles, qui deviennent « en trop » s'ils doublent |
| SI-06 | Les deux achètent avec une caisse qui ne suffit qu'à un achat | le premier reçu passe; le second est refusé sans rien débiter (« Il manque 40 € ») |
| SI-07 | Les deux déplacent le même meuble ou écrivent la même ligne de l'ardoise | l'objet ou la ligne se verrouille à la couleur du premier jusqu'à ce qu'il le relâche; l'autre lit « Sacha déplace ce meuble » |
| SI-08 | Un porteur lâche une charge portée à deux | elle se pose doucement là où elle est; si elle barre un passage, elle glisse à la place libre la plus proche; rien ne s'abîme |
| SI-09 | Donner un objet à l'autre qui a déjà les mains prises | refusé (« Camille a déjà les mains prises »); poser sur le passe reste possible |
| SI-10 | Deux propositions à la fois | une proposition par joueur; une nouvelle remplace la sienne; une proposition se répond par l'un ou l'autre bouton, jamais par Échap |
| SI-11 | Un joueur approche d'un poste tenu par un employé | l'employé lui cède la place et passe à la tâche suivante de son rôle (EM-07) |
| PA-01 | Pause (Échap, chez l'un ou l'autre) | la plateforme fige tout des deux côtés, service compris (clients, minuteries, machines); reprise quand les deux l'ont demandée (F05); le jeu enregistre à la mise en pause |
| PA-02 | Panneaux du jeu (tablette, aménagement, livre d'or) | ils ne mettent jamais en pause; ils se ferment par leur propre touche ou un clic, jamais par Échap (C19, C20) |
| PA-03 | Perte du focus ou fenêtre réduite | pas de pause; les touches sont relâchées, l'avatar s'arrête; un déverrouillage involontaire du pointeur devient une demande de pause (technique, section 2.2) |
| PA-04 | Absence d'un joueur pendant le service: aucune entrée depuis 60 s | son avatar s'assoit au bout du comptoir; la pancarte passe à « Petite pause, on revient vite »: plus personne n'entre, l'horloge et la patience des clients s'arrêtent. L'autre finit ce qui est en cours (commandes de ceux qui sont déjà là, préparation, service, plonge) et peut décorer. La moindre entrée de l'absent relance tout après un décompte de 3 s. Raison: un joueur seul ne gagne rien de plus que ce qui était déjà commencé, et le jeu ne se joue jamais seul. Hors service, l'horloge est déjà arrêtée: après 180 s, seul un indicateur « absent » s'affiche |
| PA-05 | Déconnexion | la plateforme met en pause des deux côtés et attend sans limite (F06); à la reconnexion, chacun retrouve son avatar et le service à la seconde près (porte, verrous et ports à deux relâchés). Si l'application de l'hôte s'est fermée, la maison reprend à sa dernière sauvegarde: 2 minutes au plus en arrière pendant un service, ou la fin de la journée précédente |
| PA-06 | Un joueur absent du jeu pendant des jours | rien ne bouge (TE-12): ni client qui attend, ni succursale qui tourne, ni stock qui se perd |
| PA-07 | Une autre maison (autre emplacement) | les maisons sont indépendantes; chacune garde son état exact |
| PA-08 | Fin de séance | au bilan du soir, chacun choisit « Continuer » ou « Finir la séance » et voit le choix de l'autre; la séance finit quand les deux ont choisi « Finir ». À tout moment, « Retour au salon » ou la fermeture de Duo finissent aussi la séance, état exact compris, même en plein service; la séance suivante reprend à la même seconde, après « Le service reprend » et un décompte de 3 s. Dans tous ces cas, c'est une séance normale de l'historique, pas une partie interrompue (à signaler à la plateforme: hypothèses H-11 et H-20) |
| PA-09 | Un seul joueur | impossible: une séance ne démarre qu'à deux (plateforme); si l'un part, PA-05 |
| PA-10 | Une machine dont l'identifiant n'est plus reconnu (réinstallée) | l'écran « Qui joue qui ? » s'ouvre chez les deux: chacun choisit son avatar, les deux confirment, la liaison est enregistrée |
| PA-11 | Fin de séance au milieu d'un port à deux, d'un geste ou de l'aménagement | la charge se pose (SI-08), le geste en cours reprend à son début, le mode aménagement se ferme sans rien perdre |

### 4.18 Mémoire de la maison: sauvegardes, historique, progression commune

- **SV-01** **Emplacements**: trois maisons par duo. Une sauvegarde appartient au duo, existe sur les deux machines et se reprend quelle que soit la machine qui héberge (F07).
- **SV-02** **Ce qui s'enregistre**: tout l'état de la section 4.1, y compris le service en cours (clients, tickets, articles, minuteries, positions et regards des joueurs), l'état du générateur aléatoire, les propositions en attente, les aides de chaque joueur. Ce qui ne s'enregistre pas: les réglages de chaque machine (touches, volumes, champ de vision, F10), les panneaux ouverts.
- **SV-03** **Quand** (manifeste: `moments: ["level-end", "auto", "exit"]`, `autosaveSeconds: 120`, technique, section 6.2): à la fin de chaque journée, après le bilan; toutes les 2 minutes et à chaque pause; en quittant. Libellé fourni à la plateforme, 40 caractères au plus: « Jour 34 · L'atelier, 14 h 20 ».
- **SV-04** **Liaison des avatars**: chaque avatar est rattaché à l'identifiant stable du joueur, jamais au rôle d'hôte ou d'invité (PA-10).
- **SV-05** **Taille**: environ 200 Ko en fin d'histoire (estimation de l'architecte, technique, section 6.1); `maxBytes` à 4 Mio.
- **SV-06** **Versions**: format daté (`dataSchema`), migrations testées sur des sauvegardes de référence. Un service en cours ne se migre pas: une sauvegarde faite en plein service par une version plus ancienne reprend à la fin de cette journée, le reste du service calculé par la règle des succursales (technique, section 6.2). Tout identifiant de contenu (recette, meuble, habitué) reste valable pour toujours.
- **SV-07** **Historique** (F08, `play: "session"`): chaque séance s'inscrit avec ses journées (« du mardi 3 au jeudi 5 du printemps, année 1 »), l'adresse jouée, trois statistiques (journées tenues, clients servis, mots au livre d'or, proposition de l'architecte retenue) et au plus trois faits marquants partagés de 60 caractères au plus, par priorité: arrivée à une adresse (« Ouverture de l'atelier »), défi tenu (« La fête du Tilleul »), Tasse d'or, nouvelle tasse de réputation (« Quatre tasses à Mérelles »), habitué à un nouveau niveau (« Simone: Comme la famille »), extension ouverte, première embauche, recette apprise. Aucun fait individuel, aucune statistique par joueur.
- **SV-08** **Progression commune** (F09): `progress` = projets réalisés / projets de « Nos projets » dans la version installée, affichée « Nos projets: 23 sur 60 ». Raison, plutôt que la formule par adresse proposée par l'architecte: elle continue de monter dans le jeu libre, ne reste jamais à 1 tant qu'il reste quelque chose à faire, et dit en mots ce que le duo a accompli. Quand une version ajoute des projets, le total grandit.

### 4.19 Métriques de jeu

| Mesure | Valeur | Remarque |
|---|---|---|
| Hauteur des yeux | 1,65 m | plans du level designer, technique, section 2.3 |
| Champ de vision | 60° en vertical (91,5° en horizontal à 1366 x 768), réglable de 50 à 75° | technique, section 2.3 |
| Marche | 2,8 m/s, sans course | un café se traverse en 3 à 5 s; personne ne court entre les tables |
| Port à deux | 1,2 m/s au plus, sans demi-tour sur place | C14 |
| Carton lourd porté seul | 0,9 m/s | porter à deux reste plus rapide |
| Portée d'une action (viser un objet, un poste, un client) | 1,8 m | le comptoir et le poste d'à côté |
| Donner de la main à la main | 1,5 m | technique, section 5.5 |
| Parler | 2,5 m | SE-04 |
| Lire le prénom d'un habitué | 3 m | HA-01 |
| Faire signe (repère chez les deux) | point visé à 15 m au plus, visible 10 s | |
| Mains | un objet, ou un plateau de quatre articles (six à Paris) | CO-10 |
| File d'attente | six places sur une ligne déclarée du plan | C4 |
| Gestes et marches | tables `gestes` et `recettes` | secondes réelles |

### 4.20 Tables d'équilibrage

Toutes ces valeurs deviendront des fichiers de configuration typés (CLAUDE.md, technique, section 8.2). Elles sont la copie exacte des données de `simulations/cosy_cafe.py` (contrôle croisé, section 4.21). Les tables `recettes`, `achats` et `profils` sont en section 6.

**Temps, séance, mémoire**

<!-- table:reglages -->
| Clé | Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|---|
| `secondesParMinute` | Durée d'une minute de jeu | 1 | s réelle | 0,8 à 1,25 | une heure de jeu = une minute réelle: le service du village dure 10 min, celui de Paris 13 min |
| `rythmePaisible` | Rythme paisible (réglage du duo) | 1,25 | s par minute de jeu | 1,0 à 1,5 | 25 % de temps réel en plus par heure de jeu: le même flux, moins serré |
| `joursParSaison` | Jours par saison | 28 | jours | 21 à 35 | quatre semaines, chaque saison commence un lundi (jour de fermeture) |
| `joursParSemaine` | Jours ouverts par semaine | 6 | jours | fixe | fermé le lundi: travaux, brocante, visite des autres cafés |
| `fermetureDouce` | Fermeture douce | 15 | min de jeu | 0 à 30 | après l'heure de fermeture, les clients installés finissent tranquillement |
| `seuilAbsenceService` | Seuil d'absence pendant le service | 60 | s réelles sans entrée | 30 à 180 | en plein service, une minute sans rien toucher n'arrive que si l'on s'est levé |
| `seuilAbsenceCalme` | Seuil d'absence hors service | 180 | s réelles sans entrée | 60 à 600 | horloge déjà arrêtée: seul l'indicateur « absent » change |
| `sauvegardeService` | Sauvegarde automatique pendant le service | 120 | s réelles | 60 à 300 | au plus deux minutes rejouées si l'hôte s'arrête net |
| `decompteReprise` | Décompte à la reprise d'un service | 3 | s réelles | 0 à 5 | le temps de reprendre la souris avant que les clients ne bougent |
| `reserveCharges` | Réserve pour les charges | 2 | jours de charges fixes | 0 à 5 | un achat ne peut entamer ce qu'il faut pour payer loyer, salaires et charges |
| `partSuccursale` | Résultat d'une succursale | 0,45 | part de vos sept dernières journées | 0,3 à 0,6 | sans vous, le café tourne bien mais moins bien: y revenir reste utile |
| `partEpargne` | Épargne conseillée après une offre | 0,6 | part du résultat du jour | 0,4 à 0,8 | la tablette propose de mettre de côté pour le déménagement (simulation: duo médian) |

**Adresses** (village et bourg: plans du level designer; ville et Paris: hypothèses, sous les plafonds de l'architecte)

<!-- table:adresses -->
| Adresse | Nom (plans) | Surface | Ouverture | Marché | Prix | Coûts | Loyer par mois | Charges par jour | Installation | Renommée de l'offre | Tasses au départ | Tasses du défi | Lignes d'ardoise | Places à l'arrivée (dedans + dehors) | Places au maximum | Debout au comptoir | Présents au plus (C2) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `village` | Ormeval, le café de la place du Tilleul | 38 m² | 8 h à 18 h | aucun | x1 | x1 | 520 € | 8 € | aucune | 0 | 1,5 | 3,0 | 8 | 8 + 2 | 12 + 6 | 3 | 24 |
| `bourg` | Mérelles, la boutique de la place de la Halle | 81 m² | 7 h 30 à 19 h | jeudi | x1,1 | x1 | 1 150 € | 16 € | 600 € | 500 | 2,0 | 3,5 | 12 | 11 + 0 | 21 + 18 | 4 | 48 |
| `ville` | Montaurel, l'Imprimerie | 165 m² | 8 h à 20 h | samedi | x1,3 | x1,05 | 2 900 € | 34 € | 1 200 € | 2 200 | 2,5 | 4,0 | 16 | 23 + 4 | 35 + 10 | 6 | 72 |
| `paris-quartier` | Paris, le café de l'angle des Plumassiers | 96 m² | 7 h 30 à 20 h 30 | mardi, vendredi | x1,8 | x1,15 | 6 500 € | 60 € | 2 500 € | 4 500 | 3,0 | 4,0 | 16 | 18 + 6 | 29 + 16 | 8 | 80 |
| `paris-maison` | Paris, la Graineterie du boulevard des Horticulteurs | 300 m² | 8 h à 21 h | dimanche | x2 | x1,2 | 15 000 € | 140 € | 3 000 € | 10 000 | 3,5 | 4,5 | 20 | 41 + 12 | 64 + 24 | 8 | 120 |

Ormeval depuis la démo v0.3 (2026-11-08): « Installation: aucune » et « Places à l'arrivée: 8 + 2 » décrivent l'ancien départ équipé, gardé ici parce que la simulation longue le lit. Dans le jeu, la boutique est vide: 0 + 2 places (le banc de Simone), 1 800 € d'épargne, tout à équiper (`demo/depart-cellule-vide-v0-3.md`).

**Équipement fourni à l'arrivée** (compris dans l'installation)

<!-- table:depart -->
| Adresse | Postes et niveaux | Plonge | Terminaux | Équipements | Employés repris | Vaisselle |
|---|---|---|---|---|---|---|
| `village` | machine 1, buse 1, bouilloire 1, vitrine 1, plan 1, frigo du bar 1 | évier | 1 | aucun | 0 | 36 |
| `bourg` | machine 1, buse 1, bouilloire 1, vitrine 1, plan 1, frigo du bar 1 | évier | 1 | gobelets | 0 | 70 |
| `ville` | machine 2, buse 2, bouilloire 2, vitrine 2, plan 2, frigo du bar 2, four 1, presse-agrumes 1 | lave-vaisselle | 1 | gobelets, wifi | 0 | 120 |
| `paris-quartier` | machine 2, buse 2, bouilloire 2, vitrine 2, plan 2, frigo du bar 2, four 1, presse-agrumes 1 | lave-vaisselle | 1 | gobelets, wifi, mange_debout | 4 | 160 |
| `paris-maison` | machine 3, buse 2, bouilloire 2, vitrine 2, plan 2, frigo du bar 2, four 2, presse-agrumes 2 | lave-vaisselle à capot | 2 | gobelets, wifi | 6 | 260 |

Ormeval depuis la démo v0.3: rien de cette ligne n'est fourni, tout s'achète le jour 1 (`demo/depart-cellule-vide-v0-3.md`, section 4.2: la vieille dame de Simone 450 € ou une machine révisée 800 €, moulin 140 €, caisse 80 €, vaisselle 24 pièces 30 € ou 36 pièces 110 €, réfrigérateur 180 €, bouilloire 25 €, cloche 35 €). Seuls l'évier et le rail à tickets restent avec le local.

**Extensions**

<!-- table:extensions -->
| Adresse | Extension | Coût | Places (comptoir, tables, confort, terrasse) | Ambiance | Raison |
|---|---|---|---|---|---|
| `village` | E1, la terrasse sous le store | 450 € | 0, 0, 0, +4 | +3 | autorisation de la mairie et deux tables sous le store: la place du Tilleul est la richesse du village |
| `village` | E2, la pièce du fond, au coin du feu | 900 € | 0, +2, +2, 0 | +4 | la pièce fermée derrière la salle, rouverte avec sa cheminée |
| `bourg` | E1, la terrasse de la halle | 800 € | 0, 0, 0, +10 | +3 | sous le store, face à la halle: le jeudi, le marché passe devant |
| `bourg` | E2, la salle de la remise | 1 800 € | 0, +8, 0, 0 | +5 | la remise débarrassée, avec sa grande table de ferme |
| `bourg` | E3, la cour sous la treille | 1 400 € | 0, 0, 0, +8 | +4 | la cour derrière la boutique, à l'ombre de la treille |
| `ville` | E1, l'atelier entier | 2 500 € | 0, +8, +4, 0 | +5 | les presses rangées, l'atelier sous ses sheds s'ouvre en entier |
| `ville` | E2, la cuisine du brunch | 2 000 € | 0, 0, 0, 0 | +2 | la salle de composition devenue cuisine: le brunch a besoin de ses feux |
| `ville` | E3, la cour sous la glycine | 2 000 € | 0, 0, 0, +6 | +4 | la cour de l'imprimerie, à l'abri de la rue des Facultés |
| `paris-quartier` | E1, la salle du fond | 6 000 € | +3, +5, +3, 0 | +5 | la cordonnerie voisine rachetée et ouverte sur le café (96 m² en tout) |
| `paris-quartier` | E2, la terrasse sur les deux rues | 5 000 € | 0, 0, 0, +10 | +3 | l'angle donne sur deux rues: la mairie d'arrondissement autorise la rue des Coudriers |
| `paris-maison` | E1, la torréfaction | 4 000 € | +4, 0, 0, 0 | +5 | le torréfacteur sous la verrière, et son comptoir de dégustation |
| `paris-maison` | E2, le laboratoire de pâtisserie | 4 000 € | 0, 0, 0, 0 | +2 | le laboratoire vide du graineur, équipé d'un four à soles |
| `paris-maison` | E3, les salons de l'étage | 8 000 € | 0, +11, +6, 0 | +6 | le grand et le petit salon, fermés depuis des années, par l'escalier de la maison (second niveau, C17) |
| `paris-maison` | E4, le jardin et sa serre | 6 000 € | 0, 0, +2, +12 | +6 | le jardin en friche derrière la halle, et sa serre où l'on s'assoit par tous les temps |

**Flux de base** (groupes intéressés par jour, à attrait 1, jour ordinaire, temps couvert)

<!-- table:flux -->
| Profil | village | bourg | ville | Paris, quartier | Paris, maison |
|---|---|---|---|---|---|
| `presses` | 6 | 10 | 15 | 30 | 30 |
| `voisins` | 7 | 7 | 6 | 10 | 8 |
| `flaneurs` | 5 | 6 | 8 | 15 | 18 |
| `familles` | 3 | 4,5 | 6 | 7 | 8 |
| `gourmands` | 4 | 5 | 8 | 13 | 16 |
| `promeneurs` | 4 | 4 | 5 | 15 | 14 |
| `etudiants` | 0 | 2 | 18 | 8 | 8 |
| `teletravail` | 1,5 | 2 | 8 | 14 | 16 |
| `brunch` | 0 | 0 | 4 | 8 | 8 |
| `connaisseurs` | 1 | 1 | 5 | 10 | 16 |
| total | 31,5 | 41,5 | 83 | 130 | 142 |

**Poids horaires** (ramenés aux heures d'ouverture de l'adresse)

<!-- table:courbes -->
| Profil | 7 h | 8 h | 9 h | 10 h | 11 h | 12 h | 13 h | 14 h | 15 h | 16 h | 17 h | 18 h | 19 h | 20 h |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `presses` | 1,6 | 2,0 | 1,2 | 0,5 | 0,4 | 0,8 | 0,8 | 0,4 | 0,3 | 0,4 | 0,6 | 0,6 | 0,3 | 0,1 |
| `voisins` | 1,0 | 1,4 | 1,2 | 1,0 | 0,8 | 0,4 | 0,4 | 0,5 | 0,6 | 0,7 | 1,0 | 0,9 | 0,4 | 0,1 |
| `flaneurs` | 0,1 | 0,4 | 0,9 | 1,3 | 1,2 | 0,6 | 0,6 | 1,0 | 1,3 | 1,2 | 0,9 | 0,6 | 0,4 | 0,2 |
| `familles` |  | 0,2 | 0,3 | 0,6 | 0,6 | 0,3 | 0,3 | 0,6 | 0,9 | 1,8 | 1,6 | 0,6 | 0,2 |  |
| `gourmands` |  |  | 0,3 | 0,7 | 0,6 | 0,3 | 0,4 | 0,8 | 1,4 | 1,8 | 1,4 | 0,6 | 0,3 | 0,2 |
| `promeneurs` |  | 0,2 | 0,5 | 1,0 | 1,3 | 1,2 | 1,0 | 1,1 | 1,3 | 1,2 | 0,8 | 0,4 | 0,2 |  |
| `etudiants` |  | 0,3 | 0,6 | 0,9 | 0,9 | 1,2 | 1,0 | 1,3 | 1,4 | 1,4 | 1,2 | 1,0 | 0,7 | 0,4 |
| `teletravail` |  | 0,4 | 1,4 | 1,6 | 1,0 | 0,6 | 1,0 | 1,4 | 1,0 | 0,6 | 0,3 |  |  |  |
| `brunch` |  |  | 0,4 | 1,4 | 2,0 | 2,0 | 1,4 | 0,6 |  |  |  |  |  |  |
| `connaisseurs` | 0,5 | 1,3 | 1,4 | 1,1 | 0,8 | 0,4 | 0,5 | 1,0 | 1,1 | 0,9 | 0,5 | 0,3 |  |  |

**Jours de la semaine** (multiplicateurs; le jour de marché s'ajoute)

<!-- table:jours -->
| Profil | mardi | mercredi | jeudi | vendredi | samedi | dimanche | jour de marché |
|---|---|---|---|---|---|---|---|
| `presses` | 1 | 1 | 1 | 1 | 0,5 | 0,3 | 1 |
| `voisins` | 1 | 1 | 1 | 1 | 1 | 1,1 | 1,3 |
| `flaneurs` | 1 | 1 | 1 | 1 | 1,2 | 1,3 | 1,3 |
| `familles` | 0,8 | 1,6 | 0,8 | 0,8 | 1,5 | 1,7 | 1,1 |
| `gourmands` | 0,9 | 0,9 | 0,9 | 0,9 | 1,3 | 1,5 | 1,1 |
| `promeneurs` | 0,7 | 0,7 | 0,7 | 0,7 | 1,5 | 1,8 | 1,2 |
| `etudiants` | 1,15 | 1,15 | 1,15 | 1,15 | 0,6 | 0,4 | 1 |
| `teletravail` | 1,2 | 1,2 | 1,2 | 1,2 | 0,2 | 0,1 | 1 |
| `brunch` | 0 | 0 | 0 | 0 | 1,8 | 2,2 | 1 |
| `connaisseurs` | 1 | 1 | 1 | 1 | 1,2 | 1 | 1 |

**Météo** (probabilités par saison, terrasse, multiplicateurs par profil)

<!-- table:meteo -->
|  | soleil | couvert | pluie | chaleur | froid | neige |
|---|---|---|---|---|---|---|
| probabilité au printemps | 40 % | 35 % | 25 % | 0 % | 0 % | 0 % |
| probabilité en été | 55 % | 20 % | 10 % | 15 % | 0 % | 0 % |
| probabilité en automne | 25 % | 40 % | 35 % | 0 % | 0 % | 0 % |
| probabilité en hiver | 20 % | 35 % | 25 % | 0 % | 15 % | 5 % |
| terrasse ouverte | oui | oui | non | oui | non | non |
| `presses` | 1 | 1 | 1,05 | 1 | 1 | 0,9 |
| `voisins` | 1 | 1 | 0,9 | 1 | 1 | 0,8 |
| `flaneurs` | 1,1 | 1 | 1,15 | 0,9 | 1,1 | 1 |
| `familles` | 1,1 | 1 | 0,8 | 1 | 0,9 | 0,9 |
| `gourmands` | 1 | 1 | 1,1 | 0,8 | 1,15 | 1,2 |
| `promeneurs` | 1,4 | 1 | 0,35 | 1,1 | 0,6 | 0,4 |
| `etudiants` | 1 | 1 | 1,1 | 1 | 1 | 1 |
| `teletravail` | 1 | 1 | 1,1 | 1 | 1 | 1 |
| `brunch` | 1,2 | 1 | 0,8 | 1,1 | 0,9 | 0,9 |
| `connaisseurs` | 1 | 1 | 1 | 1 | 1 | 1 |

**Saisons** (multiplicateurs par profil)

<!-- table:saisons -->
| Profil | printemps | été | automne | hiver |
|---|---|---|---|---|
| `presses` | 1 | 0,9 | 1 | 1 |
| `voisins` | 1 | 1 | 1 | 1 |
| `flaneurs` | 1 | 1,1 | 1 | 1 |
| `familles` | 1 | 1,2 | 1 | 0,9 |
| `gourmands` | 1 | 0,9 | 1 | 1,2 |
| `promeneurs` | 1,1 | 1,5 | 0,9 | 0,5 |
| `etudiants` | 1 | 0,35 | 1,3 | 1,1 |
| `teletravail` | 1 | 0,8 | 1 | 1 |
| `brunch` | 1 | 1,1 | 1 | 0,9 |
| `connaisseurs` | 1 | 1 | 1 | 1 |

**Attrait**

<!-- table:attrait -->
| Facteur | Valeur | Raison |
|---|---|---|
| Carte: points d'envie 0 à 7 et plus | 0: 0,00 ; 1: 0,35 ; 2: 0,55 ; 3: 0,75 ; 4: 0,90 ; 5: 1,00 ; 6: 1,10 ; 7: 1,20 | envie principale 3 points, chaque envie secondaire 1, variété (trois recettes de l'envie principale) 1 |
| Réputation: tasses | 1,0: 0,7 ; 1,5: 0,775 ; 2,0: 0,85 ; 2,5: 0,925 ; 3,0: 1 ; 3,5: 1,075 ; 4,0: 1,15 ; 4,5: 1,225 ; 5,0: 1,3 | de x0,7 à x1,3: la réputation compte sans tout écraser |
| Lieu | 0,75 + 0,25 x ambiance / 100; style aimé +0,10 (cohérence 50 %) ou +0,15 (75 %); +0,08 par équipement recherché, 2 au plus | de x0,75 (lieu nu) à x1,31 |
| Prix | 1 - sensibilité x (indice de prix - 1), borné de 0,40 à 1,25 | l'indice est le prix choisi sur le prix conseillé |
| Humeur de la veille | 1 + (satisfaction moyenne d'hier - 70) x 0,01, borné à ±10 % | une bonne journée se dit au village le lendemain |
| Estimation de l'attente à l'entrée | 25 s par groupe qui attend, divisées par les personnes qui servent; file de 6 places au plus (C4) | on n'entre pas devant une attente plus longue que sa patience |

**Satisfaction, pourboires, livre d'or**

<!-- table:satisfaction -->
| Composante (0 à 100) | Valeur | Raison |
|---|---|---|
| base | 70 | un client servi normalement est content |
| attente au-delà de l'attente sans gêne du profil | -0,5 par seconde, -30 au plus | l'attente pèse sans jamais tout gâcher |
| qualité (moyenne des articles): parfait, bien, correct | +10, +4, -4 | la précision récompense; « correct » n'est pas un échec |
| dessin sur le lait | +4 | geste de savoir-faire facultatif |
| fait maison | +3 | à partir du four du bourg |
| prix ressenti | (1 - indice) x sensibilité x 40, borné à ±12 | un prix doux plaît surtout aux sensibles |
| place: voulue, autre, debout alors qu'on voulait s'asseoir, table pas débarrassée | +5, 0, -10, -6 | le livre d'or dit ce qui a manqué |
| ambiance | (ambiance - 50) / 5 | de -10 à +10 |
| deux mots échangés (voisins, habitués) | +12 | le poste calme compte autant que le bar |
| « Comme d'habitude ? » (fétiche servi sans attendre la commande) | +10 | se souvenir de ses habitués |
| pourboire | satisfaction 75 et plus: 5 % de l'addition, 88 et plus: 10 %, une fois sur 2, x le pourboire du profil | le pot à pourboires du comptoir se remplit à vue |
| mot au livre d'or | 12 % des clients à 85 et plus, 10 % à 45 et moins; habitués 35 % | assez de mots pour lire chaque soir, pas trop pour qu'ils restent précieux |

**Réputation** (points cumulés par café pour chaque demi-tasse)

<!-- table:reputation -->
| Adresse | Tasses à l'arrivée | Pas (points) | Points cumulés pour chaque demi-tasse |
|---|---|---|---|
| `village` | 1,5 | 150 | 2,0: 150 ; 2,5: 450 ; 3,0: 900 ; 3,5: 1 500 ; 4,0: 2 250 ; 4,5: 3 150 ; 5,0: 4 200 |
| `bourg` | 2,0 | 130 | 2,5: 130 ; 3,0: 390 ; 3,5: 780 ; 4,0: 1 300 ; 4,5: 1 950 ; 5,0: 2 730 |
| `ville` | 2,5 | 300 | 3,0: 300 ; 3,5: 900 ; 4,0: 1 800 ; 4,5: 3 000 ; 5,0: 4 500 |
| `paris-quartier` | 3,0 | 700 | 3,5: 700 ; 4,0: 2 100 ; 4,5: 4 200 ; 5,0: 7 000 |
| `paris-maison` | 3,5 | 1 400 | 4,0: 1 400 ; 4,5: 4 200 ; 5,0: 8 400 |

**Défis et fin de l'histoire**

<!-- table:defis -->
| Adresse | Défi | Lieu (extension ou achats) | Jour | Tasses | Renommée gagnée |
|---|---|---|---|---|---|
| `village` | La fête du Tilleul | `village_terrasse` | dimanche | 3,0 | 150 |
| `bourg` | La foire de la halle | `bourg_terrasse` | jeudi | 3,5 | 300 |
| `ville` | Le grand brunch de l'Imprimerie | `ville_cuisine` | dimanche | 4,0 | 600 |
| `paris-quartier` | Le vide-grenier de la rue des Plumassiers | `pq_terrasse` | dimanche | 4,0 | 1 000 |
| `paris-maison` | La visite du guide, puis la fête de la maison | `pm_torrefaction` et `pm_labo` et `pm_salons` et `pm_jardin` | la semaine où tout est prêt, fête le lundi | 4,5 | fin de l'histoire principale |

**Postes** (places simultanées par niveau)

<!-- table:postes -->
| Poste | Nom | Places à la main, avec machine, machine avancée | Remarque |
|---|---|---|---|
| `caisse` | Comptoir et caisse | 1 / 1 / 2 | un terminal, deux à Paris |
| `espresso` | Machine à espresso | 2 / 2 / 3 | deux groupes (la vieille machine de Simone), trois ensuite |
| `vapeur` | Buse vapeur | 1 / 2 / 2 | une buse par machine, deux dès la machine à deux groupes |
| `bouilloire` | Eau chaude et thés | 1 / 2 / 2 | bouilloire, puis bouilloire à température |
| `vitrine` | Vitrine | 2 / 2 / 3 | deux personnes s'y servent à la fois |
| `agrumes` | Presse-agrumes | 1 / 1 / 2 | à levier, puis électrique |
| `blender` | Blender | 1 / 2 / 2 |  |
| `creperie` | Crêpière | 1 / 2 / 2 | une plaque, puis deux |
| `gaufrier` | Gaufrier | 1 / 2 / 2 |  |
| `plan` | Plan de travail | 1 / 2 / 3 | chaque place est un mètre de plan |
| `four` | Four | 6 / 12 / 24 | pièces à la fois |
| `douce` | Bar à méthodes douces | 2 / 3 / 4 | cônes |
| `frigo` | Réfrigérateur du bar | 2 / 2 / 3 | bouteilles et carafes |

**Gestes autour des commandes**

<!-- table:gestes -->
| Clé | Geste | Valeur | Unité |
|---|---|---|---|
| `commandeComptoir` | prendre une commande au comptoir et encaisser | 2,5 | s |
| `commandeTable` | prendre une commande à table | 2,5 | s |
| `servirComptoir` | servir au comptoir | 1 | s |
| `servirTable` | servir à table | 0,8 | s |
| `servirParArticle` | par article de plus | 0,4 | s |
| `plateau` | articles par plateau | 4 |  |
| `debarrasser` | débarrasser une table | 1,5 | s |
| `laverMain` | laver une pièce à l'évier | 1,5 | s |
| `laverLot` | pièces par passage à l'évier | 4 |  |
| `chargerLave` | charger une pièce au lave-vaisselle | 0,3 | s |
| `cycleLave` | cycle du lave-vaisselle (évier, lave-vaisselle, à capot) | 0 / 45 / 25 | s |
| `capaciteLave` | pièces par cycle | 0 / 24 / 40 |  |
| `viderLave` | vider le lave-vaisselle | 4 | s |
| `marcheBar` | pas entre deux postes du bar | 0,6 | s |
| `parfaitRetard` | retard toléré pour un geste parfait | 2 | s |
| `correctRetard` | au-delà, le geste est « correct » | 6 | s |

**Employés**

<!-- table:employes -->
| Rôle | Nom | Salaire et charges par jour travaillé | À Paris | Postes | Raison |
|---|---|---|---|---|---|
| `salle` | Service en salle | 95 € | 114 € | commandes, service, débarrasser, encaisser | le rôle le plus demandé dès deux salles |
| `barista` | Barista | 105 € | 126 € | machine, buse, thés, presse, blender, méthodes douces | libère le bar aux heures de pointe |
| `commis` | Commis | 85 € | 102 € | plonge, débarrasser, réserve, livraisons, vitrine | le premier coup de main, le moins cher |
| `patisserie` | Pâtisserie | 110 € | 132 € | four, plan, crêpière, gaufrier, fournées | rend le fait maison possible à grande échelle |
| `plonge` | Plonge | 80 € | 96 € | vaisselle et débarrasser | à partir de deux salles, la vaisselle devient un poste |
| `gerance` | Gérance | 130 € | 156 € | tient une succursale | la personne à qui l'on confie un café |

**Équipe du duo simulé** (conduite de la simulation, pas une règle)

<!-- table:equipe -->
| Adresse | Employés au plus (plan du duo simulé) | Ordre d'embauche |
|---|---|---|
| `village` | 0 | aucun employé |
| `bourg` | 1 | commis (marché et week-end) |
| `ville` | 5 | salle (tous les jours); plonge (tous les jours); barista (tous les jours); salle (marché et week-end); commis (tous les jours) |
| `paris-quartier` | 7 | salle (tous les jours), repris; salle (tous les jours), repris; barista (tous les jours), repris; plonge (tous les jours), repris; commis (tous les jours); salle (marché et week-end); barista (marché et week-end) |
| `paris-maison` | 10 | salle (tous les jours), repris; salle (tous les jours), repris; salle (tous les jours), repris; barista (tous les jours), repris; plonge (tous les jours), repris; barista (tous les jours), repris; commis (tous les jours); patisserie (tous les jours); salle (marché et week-end); salle (marché et week-end) |

**Ambiance achetée** (paliers de la simulation, AM-01)

<!-- table:ambiance -->
| Adresse | Ambiance à l'arrivée | Premier palier de +10 | Paliers suivants |
|---|---|---|---|
| `village` | 30 | 250 € | +20 % par palier, 95 au plus |
| `bourg` | 25 | 500 € | +20 % par palier, 95 au plus |
| `ville` | 30 | 1 000 € | +20 % par palier, 95 au plus |
| `paris-quartier` | 35 | 1 800 € | +20 % par palier, 95 au plus |
| `paris-maison` | 35 | 1 200 € | +20 % par palier, 95 au plus |

**Duos simulés** (hypothèses à recaler au prototype, CA-51)

<!-- table:duos -->
| Duo | Nom | Vitesse des gestes | Hésitation par tâche | Gestes parfaits | Préparation | Fermeture | Lundi | Épargne après l'offre | Palier d'ambiance | Achats d'abord |
|---|---|---|---|---|---|---|---|---|---|---|
| `lent` | Duo tranquille | x0,8 | 0,8 s | 20 % | 6,0 min | 5,0 min | 4,0 min | 50 % | après chaque achat | équilibre |
| `median` | Duo médian | x1 | 0,3 s | 40 % | 4,0 min | 3,5 min | 2,5 min | 60 % | tous les 2 achats | équilibre |
| `rapide` | Duo rapide | x1,2 | 0,0 s | 60 % | 2,5 min | 2,0 min | 1,0 min | 70 % | tous les 4 achats | capacité |

**Divers**

<!-- table:divers -->
| Paramètre | Valeur | Raison |
|---|---|---|
| Rattrapage de réputation | après 12 jours ouverts à l'adresse, +5 % de points par jour, x2,0 au plus | aide les duos qui prennent leur temps; ne change presque rien au duo médian |
| Points de réputation d'un groupe servi | (satisfaction - 50) / 10, jamais négatif | un client content fait monter la réputation; un client déçu ne la fait pas baisser |
| Caisse au départ | 300 € | Simone la laisse « pour la monnaie et le premier lait » |
| Affluence d'un défi | x1,6 | tout le pays vient: le coup de feu de l'adresse |
| Prix en salle | x1,2 | à la française: le comptoir est moins cher que la salle et la terrasse |
| Employés: vitesse aux niveaux 1, 2, 3 | x1 / x1,2 / x1,35 | des professionnels, plus rapides que nous au départ |
| Employés: jours travaillés pour les niveaux 2 et 3 | 8 et 24 | on les voit progresser |
| Embauche du duo simulé | pertes de plus de 12 % sur 3 jours et 5 jours de salaire en caisse | comportement prudent, pas une règle du jeu |

Caisse au départ, Ormeval depuis la démo v0.3: 1 800 € d'épargne, celle du duo, et plus de réserve de Simone; la valeur de 300 € ci-dessus reste celle de la simulation longue, à recaler à sa prochaine relance.

### 4.21 Simulation

Un script en Python, bibliothèque standard, graines fixes: `docs/jeux/cosy-cafe/simulations/cosy_cafe.py`. Résultats complets: `docs/jeux/cosy-cafe/simulations/resultats.md`.

- **Ce qu'il fait**: chaque journée ouverte est une simulation à événements discrets, client par client: arrivées selon l'attrait (AT-07), entrée ou renoncement (CL-02, CL-03), commande, chaque étape de chaque recette à son poste, service, séjour, recommandes, départ, débarrassage, plonge; deux joueurs et les employés prennent les tâches par priorités. Entre les journées: achats, embauches, épargne, offres, défis, déménagements, succursales. <!-- val:parties -->120 parties (40 par duo), soit plus de 12 000 journées jouées client par client.
- **Commandes**, depuis la racine du dépôt: `python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats docs/jeux/cosy-cafe/simulations/resultats.md` (environ 3 minutes); `--croise docs/jeux/cosy-cafe/cahier-des-charges.md` (moins d'une seconde) compare chaque table de ce cahier aux données du script et aux résultats, vérifie que les résultats correspondent aux données (empreinte), et sort en erreur au premier écart; `--remplir` recopie dans ce cahier les tables et les valeurs citées après un changement de données (jamais à la main); `--tableaux` réimprime les tables; sans option, un résumé de la progression.
- **Hypothèses**: les trois duos (table `duos`) et la conduite du duo simulé (ordre d'achat, embauches, épargne) sont des suppositions raisonnables, à recaler au prototype (CA-51). Non simulés: options de commande (CO-08), traits des employés (sauf la vitesse), ruptures de stock (le duo commande assez), événements de saison au-delà des multiplicateurs, dessin sur le lait, brocante.

**Progression** (jour du jeu et heures réelles à chaque arrivée, médiane, entre crochets le premier et le neuvième décile)

<!-- table:res_progression -->
| Duo | Arrivée au bourg | En ville | À Paris (quartier) | À la maison parisienne | Fête de la maison | Parties finies |
|---|---|---|---|---|---|---|
| Duo tranquille | jour 36 [29-36], 11,7 h [9,4-11,8] | jour 64 [57-64], 21,6 h [19,2-21,7] | jour 92 [85-92], 31,8 h [29,4-31,9] | jour 113 [106-120], 40,0 h [37,6-42,4] | jour 148 [141-155], 53,1 h [50,7-55,5] | 40 sur 40 |
| Duo médian | jour 22 [22-22], 5,8 h [5,7-5,8] | jour 43 [43-50], 11,9 h [11,9-13,8] | jour 64 [64-71], 18,3 h [18,2-20,2] | jour 85 [85-92], 25,0 h [24,9-27,0] | jour 113 [113-120], 34,0 h [33,8-36,2] | 40 sur 40 |
| Duo rapide | jour 22 [22-22], 4,7 h [4,6-4,7] | jour 43 [43-43], 9,8 h [9,7-9,8] | jour 64 [64-64], 15,0 h [15,0-15,1] | jour 85 [78-85], 20,7 h [18,9-20,8] | jour 113 [106-113], 28,3 h [26,4-28,4] | 40 sur 40 |

Lectures: le duo médian passe trois semaines dans chacune des quatre premières adresses et quatre à la Graineterie; il arrive à Paris après <!-- val:arr_h_paris-quartier_median -->18,3 h et fête la maison après <!-- val:fin_h_median -->34,0 h, soit <!-- val:seances_median -->51 séances de 40 minutes. On déménage le lundi: les écarts entre duos se comptent en semaines. Un duo tranquille met <!-- val:fin_h_lent -->53,1 h, surtout parce que ses journées sont plus longues (préparation et fermeture flâneuses) et que son épargne vient plus lentement.

**Ce qui décide de chaque départ** (part des parties où la dernière condition remplie était celle-ci)

<!-- table:res_blocage -->
| Duo | Départ | Réputation du défi | Extension du défi | Épargne | Offre |
|---|---|---|---|---|---|
| Duo tranquille | village vers bourg | 0 % | 25 % | 75 % | 0 % |
| Duo tranquille | bourg vers ville | 0 % | 0 % | 100 % | 0 % |
| Duo tranquille | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo tranquille | Paris, quartier vers Paris, maison | 30 % | 0 % | 70 % | 0 % |
| Duo médian | village vers bourg | 80 % | 12 % | 8 % | 0 % |
| Duo médian | bourg vers ville | 18 % | 0 % | 82 % | 0 % |
| Duo médian | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo médian | Paris, quartier vers Paris, maison | 80 % | 20 % | 0 % | 0 % |
| Duo rapide | village vers bourg | 90 % | 10 % | 0 % | 0 % |
| Duo rapide | bourg vers ville | 32 % | 57 % | 10 % | 0 % |
| Duo rapide | ville vers Paris, quartier | 100 % | 0 % | 0 % | 0 % |
| Duo rapide | Paris, quartier vers Paris, maison | 68 % | 8 % | 25 % | 0 % |

Lectures: au village, c'est la réputation du défi qui fixe le départ du duo médian; au bourg, l'épargne pour l'Imprimerie; en ville et à Paris, la réputation surtout. L'offre n'est jamais ce qui retient: la lettre arrive toujours avant que le duo soit prêt.

**Le service, à la main puis avec machines, puis avec employés** (duo médian, six premières et six dernières journées à chaque adresse)

<!-- table:res_service -->
| Adresse | Période | Groupes venus par jour | Groupes servis | Repartis sans entrer | Attente moyenne | Attente, 9 sur 10 en dessous | Satisfaction | Charge de chaque joueur | Employés présents | Personnages présents (moyenne des pointes / plus haut) | Plafond C2 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| village | première semaine | 24 | 23 | 2 % | 33 s | 49 s | 76 | 58 % | 0 | 14 / 24 | 24 |
| village | dernière semaine | 38 | 33 | 10 % | 44 s | 71 s | 79 | 77 % | 0 | 18 / 24 | 24 |
| bourg | première semaine | 35 | 32 | 6 % | 40 s | 63 s | 72 | 72 % | 0 | 18 / 36 | 48 |
| bourg | dernière semaine | 54 | 44 | 16 % | 59 s | 98 s | 73 | 82 % | 0 | 25 / 38 | 48 |
| ville | première semaine | 63 | 48 | 22 % | 63 s | 102 s | 71 | 78 % | 0 | 27 / 38 | 72 |
| ville | dernière semaine | 96 | 73 | 23 % | 65 s | 113 s | 69 | 79 % | 3 | 40 / 47 | 72 |
| Paris, quartier | première semaine | 121 | 89 | 26 % | 60 s | 107 s | 70 | 74 % | 4 | 39 / 47 | 80 |
| Paris, quartier | dernière semaine | 147 | 101 | 29 % | 70 s | 132 s | 68 | 75 % | 5 | 46 / 59 | 80 |
| Paris, maison | première semaine | 144 | 130 | 8 % | 51 s | 88 s | 74 | 83 % | 6 | 61 / 78 | 120 |
| Paris, maison | dernière semaine | 221 | 160 | 26 % | 110 s | 200 s | 75 | 83 % | 9 | 90 / 115 | 120 |

Lectures: au village, les deux joueurs sont occupés à 58 % la première semaine et 77 % la dernière; le coup de feu est tendu (un groupe sur dix repart sans entrer, surtout aux heures de pointe et faute de place) mais tenable (44 s d'attente en moyenne). Au village et au bourg, c'est la charge des deux joueurs qui monte d'une semaine à l'autre (de 58 à 77 %, de 72 à 82 %); à partir de la ville, la dernière semaine sert bien plus de monde que la première avec une charge presque égale: machines et employés absorbent la croissance. Au café des Plumassiers, près de trois groupes sur dix trouvent en dernière semaine le café complet ou l'attente trop longue: la demande parisienne dépasse ce que 45 places peuvent accueillir, et l'adresse suivante se fait désirer. Les dimanches de la maison parisienne sont de vrais coups de feu, jusqu'au plafond de 120 personnages.

**Ce que l'équipe change**

<!-- table:res_sans_employes -->
| Adresse | Équipe | Employés | Groupes servis par jour | Repartis | Attente moyenne | Satisfaction | Service fini après la fermeture |
|---|---|---|---|---|---|---|---|
| ville | avec l'équipe | 3 | 95 | 40 % | 63 s | 69 | 61 s |
| ville | à deux, sans employés | 0 | 52 | 67 % | 99 s | 64 | 135 s |
| Paris, quartier | avec l'équipe | 5 | 139 | 43 % | 64 s | 71 | 59 s |
| Paris, quartier | à deux, sans employés | 0 | 63 | 74 % | 91 s | 67 | 102 s |
| Paris, maison | avec l'équipe | 10 | 159 | 26 % | 128 s | 74 | 142 s |
| Paris, maison | à deux, sans employés | 0 | 63 | 71 % | 81 s | 85 | 45 s |

Lecture: à deux seulement, l'Imprimerie refuse <!-- val:equipe_ville_sans -->67 % de ses groupes et la maison parisienne <!-- val:equipe_paris-maison_sans -->71 %; les employés ne remplacent pas les joueurs, ils rendent les grandes adresses possibles.

**Une journée moyenne, par adresse** (duo médian)

<!-- table:res_economie -->
| Adresse | Recettes | Pourboires | Matières | Loyer (lundi compris) | Salaires | Charges | Résultat | Succursales (en plus) |
|---|---|---|---|---|---|---|---|---|
| village | 197 € | 3 € | 43 € | 22 € | 0 € | 8 € | 127 € | 0 € |
| bourg | 313 € | 3 € | 45 € | 48 € | 17 € | 16 € | 190 € | 71 € |
| ville | 781 € | 6 € | 95 € | 121 € | 169 € | 34 € | 368 € | 178 € |
| Paris, quartier | 1 549 € | 9 € | 147 € | 271 € | 482 € | 60 € | 597 € | 385 € |
| Paris, maison | 3 068 € | 51 € | 285 € | 625 € | 806 € | 140 € | 1 263 € | 708 € |

**Argent à l'arrivée**

<!-- table:res_epargne -->
| Arrivée à | Installation payée | Caisse le jour de l'arrivée (médiane) | 9 duos sur 10 entre |
|---|---|---|---|
| bourg | 600 € | 252 € | 110 € à 347 € |
| ville | 1 200 € | 477 € | 273 € à 787 € |
| Paris, quartier | 2 500 € | 966 € | 767 € à 1 473 € |
| Paris, maison | 3 000 € | 2 196 € | 1 729 € à 2 938 € |

**Réglages du duo** (un duo tranquille, sa dernière configuration)

<!-- table:res_aides -->
| Adresse | Réglage du duo | Service réel | Groupes servis | Repartis | Attente moyenne | Satisfaction | Charge de chaque joueur |
|---|---|---|---|---|---|---|---|
| bourg | normal | 11,5 min | 42 | 14 % | 82 s | 70 | 80 % |
| bourg | rythme paisible | 14,4 min | 45 | 6 % | 70 s | 72 | 76 % |
| bourg | patience grande | 11,5 min | 44 | 9 % | 96 s | 67 | 81 % |
| bourg | les deux | 14,4 min | 47 | 3 % | 77 s | 70 | 76 % |
| Paris, quartier | normal | 13,0 min | 123 | 31 % | 80 s | 69 | 77 % |
| Paris, quartier | rythme paisible | 16,2 min | 138 | 24 % | 63 s | 71 | 77 % |
| Paris, quartier | patience grande | 13,0 min | 128 | 29 % | 86 s | 69 | 77 % |
| Paris, quartier | les deux | 16,2 min | 139 | 23 % | 70 s | 70 | 76 % |

Lecture: au bourg, le rythme paisible et la patience grande ensemble font passer les groupes repartis de <!-- val:aides_bourg_normal -->14 % à <!-- val:aides_bourg_les_deux -->3 %, contre un service réel de 14,4 minutes au lieu de 11,5.

**Personnages présents et plafonds de l'architecte**

<!-- table:res_presence -->
| Adresse | Présents au plus, 99 jours sur 100 | Présents au plus | Plafond C2 | Employés au plus | Plafond C5 | Respecté |
|---|---|---|---|---|---|---|
| village | 24 | 24 | 24 | 0 | 12 | oui |
| bourg | 34 | 39 | 48 | 1 | 12 | oui |
| ville | 45 | 47 | 72 | 5 | 12 | oui |
| Paris, quartier | 58 | 65 | 80 | 7 | 12 | oui |
| Paris, maison | 111 | 119 | 120 | 10 | 12 | oui |

**Profils horaires** (un dimanche de la dernière semaine au village; un mardi de la dernière semaine à la maison parisienne)

<!-- table:res_heures_village -->
| Heure de jeu | Groupes venus | Servis | Repartis | Attente moyenne | Personnages présents au plus |
|---|---|---|---|---|---|
| 8 h | 2,9 | 1,6 | 0,0 | 23 s | 5 |
| 9 h | 4,2 | 3,0 | 0,2 | 32 s | 9 |
| 10 h | 5,4 | 3,5 | 0,8 | 45 s | 13 |
| 11 h | 5,5 | 3,6 | 1,3 | 58 s | 15 |
| 12 h | 3,4 | 3,5 | 0,8 | 55 s | 15 |
| 13 h | 3,5 | 2,8 | 0,6 | 55 s | 13 |
| 14 h | 4,8 | 3,2 | 1,0 | 60 s | 14 |
| 15 h | 6,3 | 3,4 | 2,1 | 72 s | 16 |
| 16 h | 7,8 | 3,3 | 3,7 | 87 s | 18 |
| 17 h | 7,0 | 8,9 | 3,4 | 89 s | 18 |

<!-- table:res_heures_maison -->
| Heure de jeu | Groupes venus | Servis | Repartis | Attente moyenne | Personnages présents au plus |
|---|---|---|---|---|---|
| 8 h | 17,5 | 8,6 | 0,1 | 31 s | 24 |
| 9 h | 19,1 | 14,7 | 1,1 | 44 s | 35 |
| 10 h | 19,4 | 15,7 | 1,3 | 54 s | 48 |
| 11 h | 15,7 | 13,8 | 1,2 | 69 s | 58 |
| 12 h | 12,8 | 12,7 | 2,3 | 75 s | 60 |
| 13 h | 13,3 | 10,6 | 1,8 | 79 s | 59 |
| 14 h | 16,5 | 11,4 | 1,9 | 83 s | 60 |
| 15 h | 19,1 | 12,1 | 3,3 | 102 s | 67 |
| 16 h | 19,8 | 11,6 | 6,0 | 125 s | 72 |
| 17 h | 16,3 | 11,0 | 5,9 | 136 s | 75 |
| 18 h | 9,3 | 9,8 | 3,1 | 133 s | 72 |
| 19 h | 4,3 | 9,7 | 1,0 | 114 s | 65 |
| 20 h | 2,4 | 15,0 | 0,1 | 87 s | 52 |

**Rythme réel**

<!-- table:res_rythme -->
| Duo | village | bourg | ville | Paris, quartier | Paris, maison | Journée ouverte moyenne |
|---|---|---|---|---|---|---|
| Duo tranquille | 35 jours, 11,7 h | 28 jours, 9,9 h | 28 jours, 10,2 h | 28 jours, 10,5 h | 35 jours, 13,1 h | 24,3 min |
| Duo médian | 21 jours, 5,8 h | 21 jours, 6,2 h | 21 jours, 6,3 h | 21 jours, 6,7 h | 28 jours, 8,9 h | 20,4 min |
| Duo rapide | 21 jours, 4,7 h | 21 jours, 5,1 h | 21 jours, 5,3 h | 21 jours, 5,7 h | 28 jours, 7,6 h | 17,1 min |

Lecture: une journée ouverte du duo médian dure <!-- val:journee_median_min -->20 minutes réelles; une séance de 40 minutes en fait près de deux. Aucun duo simulé n'a jamais eu de somme à régler (<!-- val:a_regler -->0 partie sur 120).

## 5. Contrôles (game-designer, ux-ui-designer)

### 5.1 Touches

Les touches définitives, les panneaux et le HUD relèvent de `docs/jeux/cosy-cafe/ux.md` (ux-ui-designer), qui fait foi. Proposition du game designer, pour le prototype, en suivant les règles communes: touches lues par leur position (`KeyboardEvent.code`), libellés affichés selon le clavier réel; lettres qui ne bougent pas entre AZERTY et QWERTY (sauf ZQSD, lus par position); jamais la rangée des chiffres en passage obligé; Échap réservé à la pause de Duo (C19).

| Action | Touche (libellé AZERTY, code) | Souris |
|---|---|---|
| Se déplacer | Z, Q, S, D (`KeyW`, `KeyA`, `KeyS`, `KeyD`) ou les flèches | |
| Regarder | | déplacer la souris (pointeur verrouillé) |
| Prendre, poser, utiliser un poste, parler, servir | E (`KeyE`) | clic gauche |
| Geste à maintien (moudre, mousser, verser, porter) | maintenir E | maintenir le clic gauche |
| Reposer ce qu'on tient à sa place, ou lâcher une charge à deux | R (`KeyR`) | clic droit |
| Dessiner sur le lait | | tracer en tenant le clic gauche |
| Tablette de la maison (ardoise, commandes, catalogue, équipe, bilan, « Nos projets ») | Tab | |
| Aménagement (poser, tourner, ranger) | B (`KeyB`) pour entrer et sortir; poser E, ranger R, tourner A (`KeyQ`) | clic gauche pose, clic droit range, molette tourne |
| Faire signe (repère chez les deux) | G (`KeyG`) | clic molette |
| Ouvrir ou fermer (pancarte), « À demain » | F (`KeyF`) en regardant la pancarte | clic sur la pancarte |
| Fermer un panneau du jeu | sa touche, ou Retour arrière | clic hors du panneau |
| Pause | Échap (plateforme) | |

- Tout se fait aussi à la souris seule (viser et cliquer; boutons des panneaux), et tout au clavier (E et R sur ce qu'on vise, panneaux au clavier).
- Aucune combinaison de touches simultanées n'est exigée.
- Reconfiguration: toutes les actions, dans les réglages de Duo (F10).

### 5.2 Retour de chaque action

Principe du sound-designer, repris ici: aucun son ne juge la qualité d'un geste ni un client déçu (les deux machines sont dans la même pièce, un son n'est jamais personnel); le retour de qualité reste visuel et chez le seul joueur concerné.

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Marcher | balancement léger de la vue (réglable, coupé avec « Réduire les animations ») | pas selon le sol (tomette, parquet, béton, mosaïque, pavés) |
| Viser un objet ou un poste | contour doux, nom de l'action au centre de l'écran; grisé et raison si l'action est impossible | aucun |
| Prendre, poser | l'objet passe en main, ou se pose sur son emplacement | tintement de porcelaine, verre ou bois selon l'objet |
| Prendre une commande | le client parle (bulle de texte), le ticket s'imprime et monte au rail | imprimante à ticket, clochette du rail |
| Prendre un ticket | le ticket se teinte à la couleur du joueur | froissement du papier |
| Moudre | la mouture tombe, la jauge de dose monte (chez le joueur) | moulin |
| Tasser, lancer l'extraction | le porte-filtre s'enclenche, le café coule | « clac » du porte-filtre, pompe, ruban de café |
| L'extraction blondit | le filet s'amincit et pâlit | le filet crachote (son de la machine, pas un jugement) |
| Arrêter l'extraction | la crème se pose; « Parfait », « Bien » ou « Correct » en petit chez le joueur | la pompe se tait, la vanne souffle |
| Mousser le lait | le pichet tourne, l'aiguille du thermomètre monte (chez le joueur) | sifflement qui change avec la température (son.md) |
| Dessiner sur le lait | le dessin apparaît sur la tasse, visible par qui la regarde | aucun |
| Verser l'eau du thé | vapeur, couleur du thé dans la théière, sablier posé | eau qui coule |
| Presser, mixer | jus qui coule, blender qui tourne | presse, moteur du blender |
| Crêpe, gaufre, fournée | la pâte dore; la fenêtre « dorée » se voit à la couleur | grésillement, minuterie du four |
| Poser une commande sur le passe | l'article rejoint son ticket, qui se coche | petit « clac » sur le zinc |
| Servir à table | les articles se posent un à un | porcelaine sur le bois |
| Encaisser | le terminal s'allume, le ticket se tamponne « Payé » | bip doux du terminal |
| Pourboire | les pièces tombent dans le pot à pourboires du comptoir | tintement des pièces (un plus beau pour un gros pourboire, son.md) |
| Parler à un client | il se tourne, deux répliques en bulles | aucun mot prononcé; murmure de la salle |
| « Comme d'habitude ? » | l'habitué sourit, son prénom s'affiche, le lien progresse | motif musical de l'habitué |
| Débarrasser | la vaisselle passe sur le plateau, la table redevient propre | tasses empilées |
| Laver, charger, vider le lave-vaisselle | la pile sale baisse, la pile propre monte | eau, porte du lave-vaisselle, cycle |
| Ranger un carton | le carton s'ouvre, son contenu va sur l'étagère; un carton lourd porté à deux se balance doucement | carton posé, souffle des porteurs |
| Écrire l'ardoise | la craie trace la ligne et son prix, l'ardoise de trottoir suit | crissement de craie |
| Retourner la pancarte | « Ouvert » ou « Fermé »; chez l'autre, « On ouvre ? » | grelot de la porte |
| Poser un meuble | fantôme à la couleur du joueur, vert si la pose est possible, raison sinon; puis le meuble apparaît | bois posé, tissu |
| Acheter | l'objet entre dans la liste des livraisons de demain | carnet qui se tourne |
| Proposer un achat important | carte de proposition chez l'autre; tampon « D'accord » ou carte qui se replie | sonnette douce |
| Faire signe | repère à la couleur du joueur, onde au sol, chez les deux | carillon léger chez les deux |
| Nouveau mot au livre d'or | une plume s'agite sur le livre posé sur le comptoir | page tournée (pendant le service, très bas) |
| Lire le livre d'or | les mots écrits à la main, la page du jour | pages |
| Nouvelle demi-tasse de réputation | à la fermeture, une tasse se remplit sur l'enseigne de la tablette, chez les deux | court motif de la maison |
| Lettre d'une nouvelle adresse | une enveloppe au courrier du matin, sur le comptoir | papier, motif de l'adresse |
| Absence de l'autre | son avatar s'assoit; pancarte « Petite pause » | aucun (pour ne pas réveiller la pièce) |
| Enregistrement | indicateur « Progression enregistrée » de la plateforme | aucun |

## 6. Contenu de la version 1 (game-designer, level-designer)

### 6.1 Les adresses

Plans, éléments fixes, circulation, extensions et quartiers: `docs/jeux/cosy-cafe/adresses.md` et `docs/jeux/cosy-cafe/plans/` (level-designer), qui font foi. Résumé:

| Ordre | Adresse | Lieu | Intention | Ce qui arrive | Difficulté (1 à 5) |
|---|---|---|---|---|---|
| 1 | `village` | Ormeval, le café de la place du Tilleul: 38 m², vitrine au sud, banc de la patronne, pièce du fond fermée, logement à l'étage | apprendre ensemble, sans presse: tout est à portée de main | le service au comptoir, la machine à deux groupes, l'ardoise, le livre d'or, les habitués, la décoration; E1 la terrasse sous le store, E2 la pièce du fond au coin du feu | 1 |
| 2 | `bourg` | Mérelles, l'ancienne pâtisserie de la place de la Halle: 81 m², vitrine à l'est face à la halle, laboratoire qui attend son four | le premier vrai coup de feu, le fait maison | le four et les fournées, le service en salle, le marché du jeudi, le coup de main, les gros meubles portés à deux; E1 la terrasse de la halle, E2 la salle de la remise, E3 la cour sous la treille | 2 |
| 3 | `ville` | Montaurel, l'Imprimerie: ancienne imprimerie de la rue des Facultés, une boutique sur la rue et un atelier sous ses sheds, 165 m² | apprendre à mener une équipe | les employés, le brunch, le café de spécialité, la rentrée des étudiants, la première succursale; E1 l'atelier entier, E2 la cuisine du brunch, E3 la cour sous la glycine | 3 |
| 4 | `paris-quartier` | le café de l'angle des Plumassiers, au pied d'un immeuble de rapport d'un quartier inventé, entrée dans le pan coupé, 68 m² (96 avec la salle du fond) | le flux parisien, les touristes, l'équipe reprise | loyer et prix parisiens, l'ardoise traduite, trois cafés à tenir; E1 la salle du fond, E2 la terrasse sur les deux rues | 4 |
| 5 | `paris-maison` | la Graineterie du boulevard des Horticulteurs: la maison d'un ancien graineur, boutique sur le boulevard, halle sous verrière, salons à l'étage, jardin, 300 m² sur deux niveaux | la maison au complet, la reconnaissance | notre mélange, le laboratoire de pâtisserie, la visite du Guide de la Tasse, la fête de la maison; E1 la torréfaction, E2 le laboratoire de pâtisserie, E3 les salons de l'étage, E4 le jardin et sa serre | 4 |

Les places et les surfaces de la table `adresses` reprennent les plans du level designer du 2026-11-07, sous les plafonds de l'architecte (C2, C6). Paris se reconnaît à sa matière, jamais à un lieu réel (bible, section 9): rues, commerces et personnes sont inventés (question Q3).

### 6.2 Recettes (47)

Dix familles. Prix conseillé au comptoir du village et de la maison parisienne (les autres adresses suivent l'indice de la table `adresses`; en salle, x1,2). Gestes: secondes réelles à la main, avec machine, avec machine avancée. Vaisselle: pièces par article.

<!-- table:recettes -->
| Recette | Nom | Famille | Gestes (à la main / machine / machine avancée) | Prix conseillé au comptoir (village / Paris, maison) | Matières | Vaisselle | Adresse | Déblocage | Saison |
|---|---|---|---|---|---|---|---|---|---|
| `espresso` | Espresso (petit noir) | Cafés noirs | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s | 1,40 € / 2,80 € | 0,22 € | 1 | village | départ | toute l'année |
| `allonge` | Café allongé | Cafés noirs | espresso 4/2,5/2 s + 14/14/14 s seul, finir 0,5/0,5/0 s | 1,60 € / 3,20 € | 0,24 € | 1 | village | départ | toute l'année |
| `noisette` | Noisette | Cafés noirs | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; vapeur 2/1,5/1 s + 0/0/2 s seul | 1,70 € / 3,40 € | 0,27 € | 1 | village | Simone, jour 2 | toute l'année |
| `double` | Double espresso | Cafés noirs | espresso 4/2,5/2 s + 14/14/14 s seul, finir 0,5/0,5/0 s | 2,50 € / 5,00 € | 0,40 € | 1 | bourg | fiche, 40 € | toute l'année |
| `creme` | Café crème | Cafés au lait | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; vapeur 5/4/1 s + 0/0/5 s seul | 2,40 € / 4,80 € | 0,38 € | 1 | village | départ | toute l'année |
| `cappuccino` | Cappuccino | Cafés au lait | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; vapeur 6/5/1 s + 0/0/6 s seul | 2,90 € / 5,80 € | 0,42 € | 1 | village | fiche, 30 € | toute l'année |
| `viennois` | Café viennois | Cafés au lait | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; plan 2,5/2/1,5 s | 3,20 € / 6,40 € | 0,55 € | 1 | bourg | fiche, 40 € | toute l'année |
| `latte` | Latte | Cafés au lait | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; vapeur 6,5/5,5/1 s + 0/0/6 s seul | 3,10 € / 6,20 € | 0,48 € | 1 | ville | fiche, 50 € | toute l'année |
| `flat_white` | Flat white | Cafés au lait | espresso 4/2,5/2 s + 14/14/14 s seul, finir 0,5/0,5/0 s ; vapeur 5/4/1 s + 0/0/5 s seul | 3,30 € / 6,60 € | 0,50 € | 1 | ville | Aïcha, lien 2 | toute l'année |
| `the_noir` | Thé noir | Thés et infusions | bouilloire 4/2,5/2 s | 2,50 € / 5,00 € | 0,25 € | 2 | village | départ | toute l'année |
| `the_vert` | Thé vert | Thés et infusions | bouilloire 4,5/2,5/2 s | 2,60 € / 5,20 € | 0,28 € | 2 | village | fiche, 20 € | toute l'année |
| `infusion` | Infusion du jardin de Simone | Thés et infusions | bouilloire 4/2,5/2 s | 2,40 € / 4,80 € | 0,18 € | 2 | village | Simone, lien 1 | toute l'année |
| `chai` | Chaï latte | Thés et infusions | bouilloire 2,5/2/1,5 s ; vapeur 5/4/1 s + 0/0/5 s seul | 3,40 € / 6,80 € | 0,55 € | 1 | ville | Agathe, lien 2 | toute l'année |
| `the_glace` | Thé glacé maison | Thés et infusions | frigo 2,5/2/2 s | 3,00 € / 6,00 € | 0,35 € | 1 | bourg | découverte de l'été | été |
| `chocolat` | Chocolat chaud | Chocolats | vapeur 6,5/5,5/1,5 s + 0/0/6 s seul | 2,80 € / 5,60 € | 0,45 € | 1 | village | départ | toute l'année |
| `chocolat_viennois` | Chocolat viennois | Chocolats | vapeur 6,5/5,5/1,5 s + 0/0/6 s seul ; plan 2,5/2/1,5 s | 3,40 € / 6,80 € | 0,60 € | 1 | bourg | fiche, 40 € | toute l'année |
| `chocolat_epices` | Chocolat aux épices | Chocolats | vapeur 7/6/1,5 s + 0/0/6 s seul | 3,60 € / 7,20 € | 0,65 € | 1 | village | découverte de l'hiver | hiver |
| `jus_orange` | Jus d'orange pressé | Boissons fraîches | agrumes 5/2,5/2 s | 3,50 € / 7,00 € | 1,00 € | 1 | village | presse-agrumes | toute l'année |
| `citronnade` | Citronnade maison | Boissons fraîches | frigo 2,5/2/2 s | 3,00 € / 6,00 € | 0,40 € | 1 | village | Bastien, lien 1 | toute l'année |
| `limonade` | Limonade artisanale | Boissons fraîches | frigo 1,5/1,5/1,5 s | 3,20 € / 6,40 € | 1,20 € | 1 | village | réfrigérateur vitré | toute l'année |
| `smoothie` | Smoothie de saison | Boissons fraîches | blender 3/2,5/2 s + 8/8/6 s seul, finir 1/1/1 s | 4,20 € / 8,40 € | 1,20 € | 1 | ville | blender | toute l'année |
| `milkshake` | Milk-shake | Boissons fraîches | blender 3/2,5/2 s + 8/8/6 s seul, finir 1/1/1 s | 4,00 € / 8,00 € | 0,90 € | 1 | ville | fiche, 50 € | toute l'année |
| `frappe` | Café frappé | Boissons fraîches | espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; blender 2/1,5/1,5 s + 6/6/5 s seul, finir 1/1/1 s | 3,80 € / 7,60 € | 0,60 € | 1 | ville | découverte de l'été | été |
| `croissant` | Croissant | Viennoiseries et tartines | vitrine 1,5/1,5/1,2 s | 1,20 € / 2,40 € | 0,70 € (maison 0,30 €) | 1 | village | départ (boulanger), maison dès le four | toute l'année |
| `pain_chocolat` | Pain au chocolat | Viennoiseries et tartines | vitrine 1,5/1,5/1,2 s | 1,30 € / 2,60 € | 0,75 € (maison 0,32 €) | 1 | village | départ (boulanger), maison dès le four | toute l'année |
| `tartine` | Tartine beurre-confiture | Viennoiseries et tartines | plan 4/3/2,5 s | 2,20 € / 4,40 € | 0,35 € | 1 | village | départ | toute l'année |
| `pain_raisins` | Pain aux raisins | Viennoiseries et tartines | vitrine 1,5/1,5/1,2 s | 1,50 € / 3,00 € | 0,38 € | 1 | bourg | René, lien 2 | toute l'année |
| `chausson` | Chausson aux pommes | Viennoiseries et tartines | vitrine 1,5/1,5/1,2 s | 1,60 € / 3,20 € | 0,40 € | 1 | bourg | Marion, lien 1 | toute l'année |
| `tarte_fruits` | Tarte aux fruits de saison | Pâtisseries | vitrine 2/2/1,5 s | 3,20 € / 6,40 € | 1,60 € (maison 0,55 €) | 1 | village | départ (boulanger), maison dès le four | toute l'année |
| `crepe` | Crêpe | Pâtisseries | creperie 3/2,5/2 s + 9/8/7 s seul, finir 1,5/1,5/1,5 s | 2,50 € / 5,00 € | 0,25 € | 1 | village | crêpière | toute l'année |
| `gaufre` | Gaufre | Pâtisseries | gaufrier 1,5/1,5/1,2 s + 10/9/8 s seul, finir 1/1/1 s | 2,80 € / 5,60 € | 0,30 € | 1 | bourg | gaufrier | toute l'année |
| `fondant` | Fondant au chocolat | Pâtisseries | vitrine 2/2/1,5 s | 3,50 € / 7,00 € | 0,55 € | 1 | bourg | fiche, 40 € | toute l'année |
| `madeleines` | Madeleines | Pâtisseries | vitrine 1,5/1,5/1,2 s | 2,40 € / 4,80 € | 0,30 € | 1 | bourg | René, lien 1 | toute l'année |
| `cookie` | Cookie | Pâtisseries | vitrine 1,2/1,2/1 s | 2,20 € / 4,40 € | 0,30 € | 1 | ville | Thao, lien 1 | toute l'année |
| `cannele` | Cannelé | Pâtisseries | vitrine 1,2/1,2/1 s | 2,20 € / 4,40 € | 0,35 € | 1 | ville | fiche, 50 € | toute l'année |
| `eclair` | Éclair au café | Pâtisseries | vitrine 1,5/1,5/1,2 s | 4,00 € / 8,00 € | 0,70 € | 1 | Paris, quartier | employé pâtissier | toute l'année |
| `tarte_citron` | Tarte au citron meringuée | Pâtisseries | vitrine 2/2/1,5 s | 4,20 € / 8,40 € | 0,75 € | 1 | Paris, quartier | fiche, 80 € | toute l'année |
| `entremets` | Le gâteau de la maison | Pâtisseries | vitrine 2,5/2/2 s | 6,00 € / 12,00 € | 1,20 € | 1 | Paris, maison | E2, le laboratoire | toute l'année |
| `croque` | Croque-monsieur | Salé | plan 4/3/2,5 s puis four 1/1/1 s + 15/12/10 s seul, finir 1,5/1,5/1 s | 5,50 € / 11,00 € | 1,10 € | 1 | bourg | four | toute l'année |
| `quiche` | Part de quiche | Salé | four 1,5/1,5/1 s + 8/7/6 s seul, finir 1/1/1 s | 5,00 € / 10,00 € | 0,90 € | 1 | bourg | fiche, 40 € | toute l'année |
| `soupe` | Soupe du jour | Salé | plan 3/2,5/2 s | 4,50 € / 9,00 € | 0,70 € | 1 | bourg | découverte de l'hiver | hiver |
| `salade` | Salade composée | Salé | plan 8/7/6 s | 7,50 € / 15,00 € | 2,00 € | 1 | ville | découverte de l'été | été |
| `tartine_avocat` | Tartine avocat-œuf | Salé | plan 6/5/4 s | 7,00 € / 14,00 € | 1,80 € | 1 | ville | fiche, 60 € | toute l'année |
| `brunch` | Formule brunch | Brunch | plan 6/5/4 s ; frigo 1,5/1,5/1,5 s ; espresso 3,5/2/1,5 s + 12/12/12 s seul, finir 0,5/0,5/0 s ; vapeur 4/3/1 s + 0/0/4 s seul | 19,00 € / 38,00 € | 5,00 € | 4 | ville | E2, la cuisine du brunch | toute l'année |
| `filtre` | Café filtre de spécialité | Café de spécialité | douce 9/6/4 s + 15/15/12 s seul, finir 1/1/1 s | 3,80 € / 7,60 € | 0,80 € | 1 | ville | Aïcha, lien 1 | toute l'année |
| `espresso_origine` | Espresso d'origine | Café de spécialité | espresso 4/2,5/2 s + 14/14/14 s seul, finir 0,5/0,5/0 s | 2,60 € / 5,20 € | 0,50 € | 1 | ville | bar à méthodes douces | toute l'année |
| `notre_melange` | Notre mélange | Café de spécialité | espresso 4/2,5/2 s + 14/14/14 s seul, finir 0,5/0,5/0 s | 3,00 € / 6,00 € | 0,45 € | 1 | Paris, maison | E1, la torréfaction | toute l'année |

### 6.3 Catalogue

Meubles et objets se modélisent selon la bible (section 13.4); chacun existe dans un seul style ou reste neutre. Les prix ne dépendent pas de l'adresse. Charme: points comptés par la règle AM-01 (décor) et AM-02 (cohérence). Ces valeurs deviendront `meubles.json`.

| Famille | Contenu de la version 1 | Par style | Prix | Charme |
|---|---|---|---|---|
| Assises | chaise, tabouret, banc ou banquette, fauteuil | 4 x 6 styles = 24 | chaise 40 à 90 €, tabouret 50 à 80 €, banquette 400 à 700 €, fauteuil 180 à 320 € | 1, 1, 4, 3 |
| Tables | table de deux, table de quatre, grande table (bourg et ville) | 2 x 6 = 12, plus 2 grandes tables | 90 à 160 €, 150 à 260 €, 900 € | 2, 2, 4 |
| Luminaires | suspension, applique ou lampe | 2 x 6 = 12 | 40 à 180 € | 2, 1 (quatre éclairent vraiment à la fois, C9) |
| Rangements et pièces maîtresses | étagère; vaisselier (campagne), banquette sous miroir peint (bistrot), poêle à bois (nordique), olivier en pot et treillage (jardin), établi devenu comptoir (atelier), enfilade et tourne-disque (rétro) | 2 à 3 x 6 = 15 | étagère 80 à 200 €, pièce maîtresse 300 à 900 € | 2, 6 |
| Décoration neutre | plantes (8), cadres et affiches (8), miroirs à reflet peint (2, C11), tapis (4), objets (vases, livres, horloges simples, boîte à livres: 10) | 32 | 10 à 300 € | 1 à 3 |
| Revêtements | peintures (12 teintes), papiers peints (un par style), sols (un par style) | 24 | peinture 40 € le mur, papier peint 90 € le mur, sol 25 € le m² | papier peint 3 par mur, sol 1 par 5 m² |
| Extérieur | store, jardinières, enseigne (au nom de la maison), ardoise de trottoir, parasol, mange-debout, range-vélos, plaids de terrasse | 10 | 40 à 600 € | 1 à 3 |
| Musique | radio à deux stations (village), tourne-disque (bourg), platine (une par salle, ville), sonorisation (Paris); la maison garde ses disques (son.md) | 4 | 60 à 1 200 € | 0 (la musique compte en AM-01) |
| Équipements recherchés par les profils | gobelets, tabourets de comptoir, mange-debout, journal du jour, étagère à livres, fauteuils, chaise haute, coin des enfants, vitrine réfrigérée, range-vélos, ardoise traduite (Oscar), wifi, prises, grande table, moulin de spécialité | 15 | 40 à 3 200 € | 0 à 2 |
| Pièces uniques | cadeaux des habitués (l'aquarelle de Simone, les dessins de Noé, l'horloge de gare de Karim, les affiches de l'Imprimerie, les photos d'autrefois d'Antoine...) et pièces de brocante | 15 environ | offertes, ou -30 % à la brocante | 4 à 6 (x1,5 à la brocante) |

Postes, machines et extensions achetés par le duo simulé (table du script; les rangs disent l'ordre d'achat d'un duo qui équilibre, puis d'un duo qui veut d'abord servir plus):

<!-- table:achats -->
| Adresse | Achat | Nom | Prix | Effet | Rang (duo équilibré) | Rang (duo capacité) |
|---|---|---|---|---|---|---|
| `village` | `gobelets` | Gobelets et couvercles (vente à emporter) | 40 € | equip:gobelets | 1 | 1 |
| `village` | `fiche_cappuccino` | Fiche « cappuccino » | 30 € | recette:cappuccino | 2 | 3 |
| `village` | `fiche_the_vert` | Fiche « thé vert » | 20 € | recette:the_vert | 3 | 9 |
| `village` | `moulin_dose` | Moulin à dose | 380 € | poste:espresso:2 | 6 | 2 |
| `village` | `pichet` | Pichet thermomètre | 60 € | poste:vapeur:2 | 4 | 4 |
| `village` | `presse` | Presse-agrumes à levier | 120 € | poste:agrumes:1 | 5 | 5 |
| `village` | `creperie` | Crêpière | 180 € | poste:creperie:1 | 7 | 7 |
| `village` | `tabourets` | Deux tabourets de comptoir | 120 € | equip:tabourets | 8 | 10 |
| `village` | `frigo_vitre` | Réfrigérateur vitré | 350 € | recette:limonade | 12 | 12 |
| `village` | `fauteuils` | Deux fauteuils (à la place de deux chaises) | 380 € | places:0,-2,2,0; equip:fauteuils | 9 | 11 |
| `village` | `livres` | Étagère à livres | 150 € | equip:livres | 10 | 13 |
| `village` | `velos` | Range-vélos | 180 € | equip:range_velos | 11 | 8 |
| `village` | `enfants` | Chaise haute et coin des enfants | 260 € | equip:chaise_haute; equip:coin_enfants | 13 | 14 |
| `village` | `village_terrasse` | E1, la terrasse sous le store | 450 € | ext:village_terrasse | 15 | 15 |
| `village` | `village_fond` | E2, la pièce du fond, au coin du feu | 900 € | ext:village_fond | 16 | 16 |
| `village` | `bouilloire` | Bouilloire à température | 90 € | poste:bouilloire:2 | 17 | 17 |
| `bourg` | `four` | Four de pâtissier d'occasion | 700 € | poste:four:1 | 1 | 1 |
| `bourg` | `lave` | Lave-vaisselle d'occasion | 900 € | plonge:2 | 2 | 2 |
| `bourg` | `salle` | Service en salle (carnet et plateaux) | 80 € | salle | 3 | 6 |
| `bourg` | `moulin_dose` | Moulin à dose | 380 € | poste:espresso:2 | 4 | 3 |
| `bourg` | `presse` | Presse-agrumes à levier | 120 € | poste:agrumes:1 | 5 | 5 |
| `bourg` | `tables` | Une table de plus | 160 € | places:0,1,0,0 | 6 | 4 |
| `bourg` | `gaufrier` | Gaufrier | 250 € | poste:gaufrier:1 | 7 | 9 |
| `bourg` | `vitrine` | Vitrine réfrigérée | 900 € | poste:vitrine:2; equip:vitrine | 8 | 8 |
| `bourg` | `buse2` | Seconde buse vapeur | 450 € | poste:vapeur:2 | 9 | 7 |
| `bourg` | `fiches_bourg` | Fiches du bourg (double, viennois, chocolat viennois, fondant, quiche) | 200 € | recette:double; recette:viennois; recette:chocolat_viennois; recette:fondant; recette:quiche | 10 | 10 |
| `bourg` | `wifi` | Wifi et prises (électricien) | 420 € | equip:wifi; equip:prises | 11 | 11 |
| `bourg` | `fauteuils` | Deux fauteuils (à la place de deux chaises) | 380 € | places:0,-2,2,0; equip:fauteuils | 12 | 13 |
| `bourg` | `bourg_terrasse` | E1, la terrasse de la halle | 800 € | ext:bourg_terrasse | 13 | 12 |
| `bourg` | `bourg_remise` | E2, la salle de la remise | 1 800 € | ext:bourg_remise; equip:grande_table | 14 | 14 |
| `bourg` | `bourg_cour` | E3, la cour sous la treille | 1 400 € | ext:bourg_cour | 16 | 16 |
| `bourg` | `vaisselle` | Service de vaisselle (+24 pièces) | 160 € | vaisselle:24 | 15 | 15 |
| `ville` | `trois_groupes` | Machine à trois groupes d'occasion, arrêt programmé | 3 800 € | poste:espresso:3 | 1 | 1 |
| `ville` | `buse_auto` | Buses automatiques | 1 200 € | poste:vapeur:3 | 5 | 2 |
| `ville` | `capot` | Lave-vaisselle à capot | 2 800 € | plonge:3 | 7 | 4 |
| `ville` | `blender` | Blender | 300 € | poste:blender:1 | 2 | 3 |
| `ville` | `douce` | Bar à méthodes douces et moulin de spécialité | 2 400 € | poste:douce:1; equip:moulin_specialite | 3 | 5 |
| `ville` | `grande_table` | Grande table d'atelier | 900 € | equip:grande_table | 4 | 6 |
| `ville` | `fiches_ville` | Fiches de la ville (latte, milk-shake, cannelé, tartine avocat-œuf) | 210 € | recette:latte; recette:milkshake; recette:cannele; recette:tartine_avocat | 6 | 7 |
| `ville` | `four2` | Four ventilé | 3 500 € | poste:four:2 | 9 | 9 |
| `ville` | `tables` | Deux fauteuils (à la place de deux chaises) | 380 € | places:0,-2,2,0; equip:fauteuils | 8 | 8 |
| `ville` | `ville_cuisine` | E2, la cuisine du brunch | 2 000 € | ext:ville_cuisine | 10 | 10 |
| `ville` | `ville_atelier` | E1, l'atelier entier | 2 500 € | ext:ville_atelier | 11 | 11 |
| `ville` | `ville_cour` | E3, la cour sous la glycine | 2 000 € | ext:ville_cour | 12 | 12 |
| `paris-quartier` | `trois_groupes` | Machine à trois groupes, arrêt programmé | 6 500 € | poste:espresso:3 | 1 | 1 |
| `paris-quartier` | `buse_auto` | Buses automatiques | 1 200 € | poste:vapeur:3 | 2 | 2 |
| `paris-quartier` | `caisse2` | Second terminal de paiement | 600 € | caisse:2 | 3 | 3 |
| `paris-quartier` | `capot` | Lave-vaisselle à capot | 4 200 € | plonge:3 | 4 | 4 |
| `paris-quartier` | `blender` | Blender | 300 € | poste:blender:1 | 5 | 5 |
| `paris-quartier` | `douce` | Bar à méthodes douces et moulin de spécialité | 3 200 € | poste:douce:1; equip:moulin_specialite | 6 | 6 |
| `paris-quartier` | `fiche_citron` | Fiche « tarte au citron meringuée » | 80 € | recette:tarte_citron | 7 | 8 |
| `paris-quartier` | `tables` | Une banquette (à la place de trois chaises) | 600 € | places:0,-3,3,0 | 8 | 7 |
| `paris-quartier` | `pq_terrasse` | E2, la terrasse sur les deux rues | 5 000 € | ext:pq_terrasse | 9 | 9 |
| `paris-quartier` | `pq_fond` | E1, la salle du fond | 6 000 € | ext:pq_fond | 10 | 10 |
| `paris-maison` | `buse_auto` | Buses automatiques | 1 200 € | poste:vapeur:3 | 1 | 1 |
| `paris-maison` | `douce` | Bar à méthodes douces et moulin de spécialité | 3 200 € | poste:douce:1; equip:moulin_specialite | 2 | 2 |
| `paris-maison` | `blender` | Blender | 300 € | poste:blender:1 | 3 | 3 |
| `paris-maison` | `tables` | Deux banquettes de halle (à la place de quatre chaises) | 1 200 € | places:0,-4,4,0 | 4 | 4 |
| `paris-maison` | `pm_torrefaction` | E1, la torréfaction | 4 000 € | ext:pm_torrefaction | 5 | 6 |
| `paris-maison` | `pm_labo` | E2, le laboratoire de pâtisserie | 4 000 € | ext:pm_labo | 6 | 7 |
| `paris-maison` | `pm_salons` | E3, les salons de l'étage | 8 000 € | ext:pm_salons | 7 | 5 |
| `paris-maison` | `pm_jardin` | E4, le jardin et sa serre | 6 000 € | ext:pm_jardin | 8 | 8 |

### 6.4 Profils de clients (10)

Un profil se définit par ce qu'il cherche, jamais par un stéréotype; chaque profil mêle toutes les statures, peaux, âges adultes et coiffures (bible, 7.2). Le profil `voisins` est nouveau (section 1.3): proposition de signe pour la bible, le cabas du marché ou le journal plié sous le bras, accoudé au comptoir.

<!-- table:profils -->
| Profil | Nom | Ce qu'il cherche | Envie principale (3 points) | Envies secondaires (1 point) | Place voulue | Sensibilité au prix | Patience | Attente sans gêne | Séjour | Taille du groupe | Prend à manger | Emporte | Recommande | Styles aimés | Équipements recherchés | Pourboire |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `presses` | Les pressés | un bon café, vite, au comptoir ou à emporter | Cafés noirs | Viennoiseries et tartines, Cafés au lait | comptoir | 1,2 | 35 s | 30 s | 5 à 10 min | 1 (100 %) | 40 % | 50 % | non | bistrot, atelier | mange_debout, gobelets | 0,6 |
| `voisins` | Les voisins | deux mots avec vous et un petit noir au comptoir | Cafés noirs | Viennoiseries et tartines, Thés et infusions | comptoir | 1,3 | 120 s | 90 s | 20 à 35 min | 1 (85 %), 2 (15 %) | 30 % | 0 % | 20 min, 30 % | bistrot, campagne | tabourets, journal | 0,8 |
| `flaneurs` | Les flâneurs | prendre le temps: un crème, un fauteuil, un livre, la rue qui passe | Cafés au lait | Thés et infusions, Pâtisseries, Viennoiseries et tartines | confort | 0,8 | 90 s | 90 s | 70 à 130 min | 1 (60 %), 2 (40 %) | 50 % | 0 % | 50 min, 50 % | retro, bistrot | livres, fauteuils | 1,0 |
| `familles` | Les familles | un goûter tous ensemble, une grande table, de quoi occuper les enfants | Chocolats | Boissons fraîches, Pâtisseries, Viennoiseries et tartines | table | 1,1 | 60 s | 75 s | 40 à 60 min | 2 (25 %), 3 (45 %), 4 (30 %) | 80 % | 0 % | non | campagne, jardin | chaise_haute, coin_enfants | 0,9 |
| `gourmands` | Les gourmands | une belle part de gâteau, choisie dans une vitrine qui donne envie | Pâtisseries | Chocolats, Cafés au lait, Viennoiseries et tartines | table | 0,7 | 70 s | 90 s | 35 à 55 min | 1 (40 %), 2 (60 %) | 100 % | 10 % | non | retro, campagne | vitrine | 1,1 |
| `promeneurs` | Les promeneurs | une pause en chemin: à boire frais, à manger, une terrasse au soleil | Boissons fraîches | Salé, Viennoiseries et tartines, Cafés noirs | terrasse | 1,0 | 60 s | 75 s | 30 à 50 min | 1 (20 %), 2 (50 %), 3 (30 %) | 60 % | 15 % | non | jardin, bistrot | range_velos, ardoise_traduite | 0,9 |
| `etudiants` | Les étudiants | un prix doux, une grande table, du wifi et des prises pour réviser longtemps | Cafés au lait | Boissons fraîches, Salé, Viennoiseries et tartines | table | 1,6 | 80 s | 90 s | 100 à 200 min | 1 (40 %), 2 (35 %), 3 (25 %) | 50 % | 10 % | 70 min, 50 % | atelier, nordique | wifi, prises, grande_table | 0,5 |
| `teletravail` | Les télétravailleurs | une table au calme près d'une prise, une théière qui dure, un déjeuner sur place | Thés et infusions | Cafés au lait, Salé, Pâtisseries | table | 0,9 | 90 s | 100 s | 150 à 270 min | 1 (100 %) | 40 % | 0 % | 75 min, 70 % | nordique, atelier | wifi, prises | 0,8 |
| `brunch` | Les bruncheurs | le grand repas du week-end, à plusieurs, sans se presser | Brunch | Boissons fraîches, Cafés au lait, Salé | table | 0,8 | 90 s | 150 s | 70 à 110 min | 2 (50 %), 3 (20 %), 4 (30 %) | 0 % | 0 % | non | jardin, nordique | grande_table | 1,1 |
| `connaisseurs` | Les connaisseurs | un café d'exception et le plaisir de voir le geste du barista | Café de spécialité | Cafés noirs, Pâtisseries | comptoir | 0,5 | 60 s | 120 s | 25 à 45 min | 1 (70 %), 2 (30 %) | 30 % | 10 % | non | atelier, nordique | moulin_specialite | 1,2 |

### 6.5 Habitués (24, et ceux qui suivent la maison)

Chaque habitué est rattaché à une adresse; ses cinq étapes s'ouvrent aux niveaux de lien (HA-02). Trait visible: proposition à caler avec la bible (7.3), qui en donne déjà trois (l'ancienne patronne, le randonneur et son chien, la maraîchère du jeudi).

| Habitué | Adresse | Profil | Commande fétiche | Quand | Trait visible (proposition) | Son histoire | Suit la maison |
|---|---|---|---|---|---|---|---|
| Simone | village | voisins | noisette, au comptoir | tous les jours, 8 h 30 et 17 h | long gilet prune, chignon piqué d'un crayon, lunettes à chaînette, panier d'osier; son banc sous la vitrine | propriétaire des murs, elle habite au-dessus du café qu'elle a fermé il y a trois ans; elle vous loue la boutique vide, vous vend pour pas cher sa vieille machine (« la vieille dame ») et ses tables, et vous montre les gestes; libérée du comptoir, elle se met à l'aquarelle et vous offre la place du Tilleul peinte; elle reprend la gérance quand vous partez | oui: chaque inauguration, « Un an déjà », la fête |
| Mathis | village | pressés | espresso et pain au chocolat | du mardi au samedi, 8 h 10 | sacoche de facteur jaune moutarde, vélo appuyé à la vitrine | toujours en retard sur sa tournée, il prépare un concours le soir au café; le jour où il le réussit, il offre une tournée de cafés à la salle; muté en ville, il retrouve votre comptoir à l'Imprimerie | oui: l'Imprimerie |
| Farida et Noé | village | familles | chocolat chaud et crêpe au sucre | mercredi 16 h, samedi 10 h | ciré moutarde (Farida), bonnet à pompon (Noé) | Noé, timide, dessine sur un coin de l'ardoise; ses dessins finissent encadrés au mur; sa classe vient goûter un mercredi | non |
| Bastien et Gribouille | village | promeneurs | jus d'orange pressé et tartine | dimanche 11 h | bâtons de marche, chien couché sous la table (pose fixe) | il balise un sentier qui passe par la place; le range-vélos et l'écuelle installés, il amène son club; il vous donne sa recette de citronnade | non |
| Lise | village | flâneurs | café crème et tarte du jour | samedi 10 h, mardi 15 h | cardigan vert bouteille, piles de livres | bibliothécaire de l'école, elle remplit l'étagère à livres et monte une boîte à livres avec vous; elle écrit l'histoire du café pour le bulletin du village | non |
| René | bourg | gourmands | tarte aux fruits et café crème | tous les jours, 15 h 30 | toque pliée dans la poche, moustache blanche, canne | l'ancien pâtissier vous loue sa boutique; il regarde le premier feu de son four, vous apprend les madeleines puis le pain aux raisins; « La boutique sent de nouveau le beurre » | oui: le laboratoire parisien |
| Marion | bourg | voisins | café allongé et chausson aux pommes | jeudi 7 h 45, avant le marché | tablier de marché vert, cagette sous le bras | ses pommes donnent le chausson; elle vous propose ses paniers de saison (fruits moins chers); sa nièce Léa devient votre coup de main | non |
| Karim | bourg | pressés | double espresso | du mardi au samedi, 7 h 35 | casquette et gilet de la gare | la salle d'attente de la gare est froide: vous lui préparez un thermos chaque matin; il vous offre la vieille horloge de la gare | non |
| Yanis et sa bande | bourg | étudiants | chocolat viennois et gaufre | mardi et vendredi, 17 h | casques audio, sacs couverts de badges | ils révisent le bac sur la grande table de la remise; le jour des résultats, la bande dessine la boutique et la signe | non |
| Chantal | bourg | flâneurs | thé noir et madeleines | samedi 16 h, après la répétition | écharpe de chœur rouge, partitions | sa chorale répète à la halle; à la foire de la halle, elle chante sur la terrasse; elle vous offre une partition encadrée | non |
| Agathe | ville | télétravail | chaï latte | du mardi au vendredi, 9 h | lunettes rondes, mains tachées d'encre | l'Imprimerie était celle de sa famille; elle garde un coin de la grande table de l'atelier, imprime vos cartes et vos affiches sur la vieille presse, vous apprend le chaï | non |
| Thao | ville | étudiants | latte et cookie | du mardi au jeudi, 14 h | rouleau de plans, carnet de croquis | étudiante en architecture, elle dessine le café, vous donne sa recette de cookies; en stage à Paris, elle dessine la réouverture des salons de l'étage de la Graineterie | oui: la maison parisienne |
| Oscar | ville | télétravail | thé vert et part de quiche | du mardi au vendredi, 10 h | écharpe longue, ordinateur couvert d'autocollants | traducteur, toujours à la table près de la prise; il traduit l'ardoise pour les touristes (l'ardoise traduite de Paris) | oui: le café d'angle, puis la maison |
| Aïcha | ville | connaisseurs | café filtre de spécialité | mercredi et samedi, 10 h | tablier de toile kaki, sac de jute | torréfactrice, elle goûte votre espresso, vous apprend les méthodes douces puis le flat white; à Paris, elle crée avec vous notre mélange | oui: la maison parisienne |
| La famille Martin-Diallo | ville | brunch | formule brunch | dimanche 11 h | grands-parents compris, la grand-mère en chapeau | ils fêtent les 80 ans de la grand-mère au café et reviennent nombreux au grand brunch de l'Imprimerie | non |
| Antoine | Paris, quartier | voisins | espresso au zinc | tous les jours, 7 h 30 | béret, mouchoir à carreaux | l'ancien patron vous cède son café d'angle avec son équipe; il garde les photos du café en 1960 (décor « Le café d'autrefois »); il organise avec vous le vide-grenier | oui: la fête |
| Clémence | Paris, quartier | promeneurs | jus d'orange pressé et éclair au café | samedi 11 h, avec un groupe | parapluie levé de guide | guide-conférencière, elle amène ses groupes le samedi, demande l'ardoise traduite, vous montre un passage oublié du quartier | non |
| Malik | Paris, quartier | pressés | café allongé à emporter et pain aux raisins | tous les jours, 7 h 35 | le kiosque d'en face, gants mitaines | il échange le journal du jour contre son café; il garde un double de vos clés | non |
| Louise | Paris, quartier | flâneurs | thé noir et tarte au citron | mardi et jeudi, 15 h | étui à partitions | pianiste du conservatoire voisin, elle joue au vide-grenier, puis à la fête de la maison | oui: la fête |
| Hugo et Samir | Paris, quartier | gourmands | chocolat chaud et éclair au café | vendredi 16 h | sacs de la librairie | libraires de la rue des Coudriers, ils prêtent des livres au coin lecture du café; pour leurs dix ans ensemble, ils commandent un gâteau | non |
| Éliane | Paris, maison | connaisseurs | thé vert et le gâteau de la maison | mardi et samedi, 16 h | gants de fil, broche ancienne | petite-fille du graineur, elle vous confie la maison de son grand-père; quand les salons de l'étage rouvrent, elle y retrouve les goûters de son enfance | non (c'est chez elle) |
| Bérénice | Paris, maison | brunch | formule brunch et jus pressé | dimanche 11 h 30 | lunettes de soleil sur la tête, foulard | styliste du quartier, elle fait de la maison le rendez-vous du dimanche et prête des tissus pour la fête | non |
| Jo | Paris, maison | télétravail | notre mélange et part de quiche | du mardi au vendredi, 13 h | sacoche de régie, ruban adhésif au poignet | à la régie du théâtre voisin, Jo vient avant les représentations et règle les lumières de la fête | non |
| Wu Lan | Paris, maison | flâneurs | espresso d'origine et cannelé | jeudi 10 h | carnet de dégustation, châle bleu nuit | ancienne professeure de chimie, elle parle des grains comme d'une expérience et vous aide à régler la torréfaction | non |

Les prénoms évitent ceux de La Petite Ligne et ceux qui servent d'exemples de pseudos (Camille, Sacha).

### 6.6 Employés

Candidats de la version 1 (les petites annonces en tirent trois chaque lundi; les employés repris sont fixes). Prénoms variés, traits épicènes (EM-08).

| Prénom | Rôle | Traits | Où |
|---|---|---|---|
| Léa | commis (coup de main), puis gérance du bourg | Lève-tôt, Sourire | Mérelles, nièce de Marion |
| Tom | service en salle | Pied léger, Bonne mémoire | candidatures de l'Imprimerie |
| Inaya | plonge | Patience d'ange, Sang-froid | candidatures de l'Imprimerie |
| Baptiste | barista | Main sûre, Curiosité | candidatures de l'Imprimerie |
| Maëlle | service en salle | Sourire, Couche-tard | candidatures de l'Imprimerie |
| Sofiane | commis | Pied léger, Lève-tôt | candidatures de l'Imprimerie |
| Capucine | pâtisserie | Main sûre, Douceur | candidatures de l'Imprimerie et de Paris |
| Josiane | service en salle, reprise | Bonne mémoire, Sang-froid | café d'angle, vingt-cinq ans de maison |
| Dimitri | barista, repris | Main sûre, Couche-tard | café d'angle |
| Awa | service en salle, reprise | Sourire, Pied léger | café d'angle |
| Gaspard | plonge, repris | Patience d'ange, Lève-tôt | café d'angle |
| Arthur | pâtisserie | Curiosité, Main sûre | candidatures de Paris (il apporte l'éclair au café) |
| Mathilde | service en salle, reprise | Patience d'ange, Sourire | maison parisienne |
| Yusuf | barista, repris | Sang-froid, Main sûre | maison parisienne |
| Clara | service en salle, reprise | Sourire, Lève-tôt | maison parisienne |
| Lucien | plonge, repris | Lève-tôt, Patience d'ange | maison parisienne |
| Ninon | service en salle, reprise | Bonne mémoire, Douceur | maison parisienne |
| Rayan | barista, repris | Main sûre, Couche-tard | maison parisienne |
| Elsa | gérance | Sang-froid, Bonne mémoire | candidatures de Paris (pour une succursale) |

### 6.7 Fournisseurs

| Fournisseur | Ce qu'il livre | Adresses | Visage et véhicule (bible, 7.5) |
|---|---|---|---|
| Armelle, la laitière | lait, crème, beurre, œufs | village, bourg | foulard rouge doux, bouteilles de verre dans un panier, triporteur |
| Lucas, le boulanger de la place | viennoiseries et tartes (tant qu'il n'y a pas de four), pain | village | tablier fariné, panière |
| Joseph, le petit torréfacteur de la vallée | grains, thés | village, bourg | casquette, sacs de jute |
| Marion, la maraîchère du jeudi | fruits et légumes de saison | bourg | tablier de marché vert, cagette |
| Aïcha Benali | cafés de spécialité, puis grains verts pour notre mélange | ville, Paris | tablier de toile kaki, sac de jute |
| Rémi, le grossiste | tout le sec et le frais en gros | Paris | blouse, diable |
| Zoé, la livreuse en vélo cargo | les commandes du matin dans Paris, le dépannage dans l'heure | Paris | caisse à la couleur de sa coopérative inventée |

### 6.8 Événements

| Quand | Événement | Effet |
|---|---|---|
| Chaque lundi | Fermeture: travaux, brocante, visite d'une succursale | TE-08 |
| Jour de marché (Mérelles le jeudi, Montaurel le samedi, les Plumassiers le mardi et le vendredi, le boulevard des Horticulteurs le dimanche) | Le marché | voisins, flâneurs et promeneurs plus nombreux (table `jours`) |
| Mercredi après-midi; mardi, jeudi, vendredi à 16 h 30 | Les enfants: après-midi libre, sortie d'école | le goûter des familles |
| Samedi et dimanche | Le week-end | promeneurs, familles, gourmands; brunch dès la cuisine de l'Imprimerie |
| Premier jour de soleil du printemps | « Les premières terrasses » | terrasse pleine, x1,2 ce jour-là |
| Un samedi du printemps | « Le marché aux fleurs » | plantes du catalogue à -20 % la semaine |
| Été (toute la saison) | « Les grandes vacances » | étudiants x0,35, promeneurs x1,5, familles x1,2 (table `saisons`) |
| 21e jour de l'été | « La soirée des musiciens » | une heure d'ouverture de plus, musique en terrasse, flâneurs x1,3 |
| Premier lundi de l'automne | « La rentrée » | une lettre de l'université; étudiants x1,3 toute la saison |
| Deuxième semaine de l'automne | « La semaine des pommes » | chausson et tarte aux pommes à l'honneur, chez Marion |
| 8e jour de l'hiver | « La Chandeleur » | les crêpes demandées deux fois plus ce jour-là |
| Troisième week-end de l'hiver | « Le marché d'hiver » | chocolat aux épices à l'honneur, gourmands x1,2 |
| Jour 113 (premier jour du printemps de l'année 2) | « Un an déjà » | une lettre de Simone et son aquarelle; gâteau offert aux clients de la journée |
| Défis locaux | La fête du Tilleul (village, dimanche), la foire de la halle (bourg, jeudi), le grand brunch de l'Imprimerie (dimanche), le vide-grenier de la rue des Plumassiers (dimanche), la semaine du Guide de la Tasse et la fête de la maison | PR-02, PR-08 |

Les événements de saison ne sont pas simulés au-delà des multiplicateurs (effets bornés à une journée, ±30 %).

### 6.9 Fil conducteur: les scènes clés

Toutes en place, par dialogues, sans cinématique (C22); un fondu seulement pour changer de lieu.

1. **Jour 1, un lundi: l'installation**. Sur la place, devant le café fermé depuis trois ans, rideaux baissés, vitrines passées au blanc. Simone sort de chez elle, au-dessus, les clés à la main: les trois phrases du but (section 3). On lève le rideau à deux; dedans, des draps sur le comptoir et sur les tables, chaises retournées, poussière, trois ans de courrier. On choisit à deux sur le téléphone, avec 1 800 € d'épargne, la machine (la vieille dame de Simone ou une machine révisée), le moulin, la caisse, la vaisselle, les tables (celles de Simone pour pas cher, ou neuves); Gaby livre devant la vitrine; on porte, on pose, on raccorde; la machine chauffe et l'on fait à Simone son premier noisette. On balaie, on lave les vitrines, on écrit la première ardoise, on commande le stock pour mardi, on nomme la maison à deux (l'un propose, l'autre accepte ou propose à son tour), puis l'emblème et les couleurs. Détail: `demo/depart-cellule-vide-v0-3.md`.
2. **Jour 2, le grand jour**: on lève le rideau à deux, puis la pancarte se retourne. Simone est la première cliente (« Comme d'habitude ? »). Le soir, le premier mot du livre d'or.
3. **La première semaine**: Mathis, Farida et Noé, Bastien et son chien, Lise; Simone se tait peu à peu.
4. **La lettre de Mérelles**: René, l'ancien pâtissier, cherche quelqu'un pour rallumer son four.
5. **La fête du Tilleul**, un dimanche, sous le store: tout le village; le soir, Simone: « Je vous le garde au chaud. »
6. **Mérelles**: le laboratoire vide; le four d'occasion livré et porté à deux; la première fournée sous l'œil de René. La foire de la halle, la chorale de Chantal sur la terrasse.
7. **La lettre de Montaurel**: Agathe cherche à qui confier l'imprimerie de sa famille.
8. **L'Imprimerie**: la première embauche (un entretien au comptoir, trois candidatures); la cuisine du brunch et le premier brunch; Mathis au comptoir; la rentrée. Le grand brunch de l'Imprimerie.
9. **La lettre de Paris**: Antoine prend sa retraite et veut que son café de l'angle des Plumassiers reste un café.
10. **Paris**: l'équipe d'Antoine vous accueille; Zoé et son vélo cargo; l'ardoise traduite d'Oscar; la cordonnerie voisine devenue salle du fond; le vide-grenier de la rue des Plumassiers.
11. **La lettre d'Éliane**: la Graineterie de son grand-père, fermée depuis des années: le jardin en friche, l'étage fermé, le laboratoire vide.
12. **La Graineterie**: notre mélange, torréfié avec Aïcha et Wu Lan; le laboratoire, que René vient visiter; les salons de l'étage rouverts (Éliane se souvient); le jardin et sa serre.
13. **« Un an déjà »**, si le jour 113 tombe pendant l'histoire: la lettre de Simone.
14. **La semaine du Guide**: un client au carnet de cuir revient chaque jour; le lundi, la lettre: « La Tasse d'or, pour la maison … ».
15. **La fête de la maison**: les habitués de toutes les adresses dans la halle et le jardin de la Graineterie; Louise au piano; Simone lève sa tasse: « À vous deux, et à la maison. » Puis le jeu continue.

### 6.10 « Nos projets »

Le carnet commun des rêves du duo, sur la tablette; il sert de liste d'objectifs et de progression commune (SV-08). Trois projets à la fois sont épinglés (choisis par le duo, sinon les trois prochains de l'histoire). Un projet réussi ne se perd jamais; certains donnent une pièce unique.

| Adresse | Projets (condition) |
|---|---|
| Village (12) | « Un nom sur la porte » (nommer la maison); « Notre ardoise » (écrire la première ardoise); « Notre premier client » (servir Simone); « Un premier mot » (un mot au livre d'or); « Comme d'habitude » (servir une fétiche sans commande); « Deux tasses » (2 tasses à Ormeval); « La Chandeleur avant l'heure » (crêpière et 20 crêpes servies); « Sous le store » (E1); « Au coin du feu » (E2); « Trois tasses au village »; « La fête du Tilleul » (défi); « Partir pour Mérelles » |
| Bourg (10) | « Le four de René » (four et première fournée); « Croissants maison » (50 servis); « Le jeudi de Marion » (50 groupes un jour de marché); « En salle » (service en salle); « La terrasse de la halle » (E1); « La salle de la remise » (E2); « Sous la treille » (E3); « Un coup de main » (embaucher Léa); « La foire de la halle » (défi); « Partir pour Montaurel » |
| Ville (10) | « Notre première embauche »; « La cuisine du brunch » (E2); « Le brunch du dimanche » (30 brunchs un dimanche); « Café de spécialité » (méthodes douces et 20 filtres); « Trois groupes » (la machine à trois groupes); « L'atelier entier » (E1); « Sous la glycine » (E3); « Deux cafés, une maison » (le village tourne en succursale); « Le grand brunch » (défi); « Partir pour Paris » |
| Paris, quartier (8) | « Ouvrir à Paris »; « L'équipe au complet » (7 employés); « La salle du fond » (E1); « Sur deux rues » (E2); « L'ardoise en trois langues »; « Trois cafés »; « Le vide-grenier » (défi); « Partir pour la Graineterie » |
| Paris, maison (8) | « La Graineterie »; « Notre mélange » (E1 et 50 tasses); « Le laboratoire » (E2 et le gâteau de la maison servi); « Les salons de l'étage » (E3); « Le jardin et sa serre » (E4); « Cinq tasses à Paris »; « La Tasse d'or »; « La fête de la maison » |
| Partout, et le jeu libre (12) | « Cent clients en un jour »; « Mille sourires » (1 000 clients ravis); « Le livre d'or plein » (100 mots); « Toutes les recettes » (47); « Quatre styles » (quatre cafés harmonieux, de quatre styles différents); « Comme la famille » (cinq habitués au dernier niveau); « Tous nos habitués » (toutes les histoires finies); « Cinq tasses partout »; « Une année ensemble » (jour 113); « Le dessin parfait » (100 dessins sur le lait); « Rien ne se perd » (500 articles au panier du soir); « La maison au complet » (toutes les extensions) |

Total de la version 1: 60 projets.

### 6.11 Écriture

- **Ton**: chaleureux, simple, un humour doux; des phrases courtes, des gens qui ont une vie. Aucune moquerie d'un profil; aucun texte ne compare les deux joueurs.
- **Adresse aux joueurs**: le jeu tutoie chaque joueur (« Tu tiens le plateau »); un personnage qui parle aux deux dit « vous » (« Vous voilà chez vous »).
- **Écriture neutre**: rien ne s'accorde au genre d'un joueur. Formes à proscrire et leurs remplacements (carnet du game designer): « prêt » ou « prête » (« On ouvre ? », « Oui, on ouvre »), « tous les deux » (« à deux »), « chacun » (« chaque joueur », « l'un et l'autre »), « fatigué » (« La fatigue se fait sentir »), un participe après « vous » (« Vous avez fait la fête » plutôt que « Vous êtes venus »).
- **Exemples**: ticket « Table 4: deux crèmes (un au lait d'avoine), un chocolat »; tablette « Disponible: 1 240 €. Gardé pour les charges: 180 € »; livre d'or « Le cappuccino avait un cœur dessus ! », « Pas trouvé de place pour m'asseoir, dommage », « On reviendra pour la tarte aux mirabelles »; refus de pose « Les clients ne pourraient plus passer jusqu'à la fenêtre »; employé « J'ai besoin de quelqu'un au bar ! »; Simone « Attends que la crème soit dorée, et coupe. »
- **Aucune marque réelle**, aucun établissement réel; Paris sans nom de rue réel.

## 7. Direction artistique (directeur-artistique)

Document de référence: `docs/jeux/cosy-cafe/bible-artistique.md`, planches dans `docs/jeux/cosy-cafe/bible/` (vues des cinq adresses, palette, moments, styles, silhouettes, caméra et échelle, contrôles en gris et daltoniens).

- **Intention**: une « maquette peinte à la main », en vraie 3D temps réel. Trois piliers: chaleureux, arrondi, fait main. Les planches sont des dessins 2D qui fixent couleurs, placements et lisibilité, pas le rendu: le rendu se juge sur l'essai de style 3D (section 7.1).
- **Lisibilité**: ce qui se prend, se sert ou se lit (porcelaine, papier, mousse de lait) est très clair, le café et l'encre très sombres, et tout se pose sur des surfaces moyennes à sombres; le décor reste au milieu de l'échelle. Vérifié en niveaux de gris et sous trois daltonismes.
- **Les deux joueurs** (décision du client du 2026-11-08, Q14): une tenue de travail normale aux couleurs sourdes de la maison, comme l'équipe, avec au plus un détail discret. La couleur de chaque joueur dans Duo ne sert que là où le jeu en a besoin: la pince de son ticket sur le rail et les indicateurs de l'interface. La bible proposait un tablier et un écusson à la couleur du joueur: à reprendre.
- **Les personnages** (même date): clients, habitués, employés et avatars au niveau de détail du décor: visages aux traits lisibles, mains formées, vêtements avec plis et volumes, coiffures et silhouettes variées.
- **Caméra**: yeux à 1,65 m, champ vertical de 60°, ni roulis ni balancement par défaut.
- **Lumière**: chaude, précalculée sur la coque, taches de soleil cuites, 4 lumières réelles au plus (C9), aucune ombre ni aucun reflet calculés en direct (C10, C11).
- **Six styles** de décoration avec leur roue des compatibilités, identité propre à chaque adresse et à sa rue (tomettes et tilleul à Ormeval, zinc et pan coupé à Paris, verrière à la Graineterie), sans aucun monument ni aucune enseigne réelle.
- **Liste des assets de la version 1** avec specs et budgets: environ 65 meubles sur six styles, 22 postes, 15 modules de comptoir, 24 pièces de vaisselle, 30 de nourriture, 40 décorations.

### 7.1 Essai de style 3D (en cours, 2026-11-07)

Le client a demandé à voir le rendu réel avant de choisir. L'artiste 3D construit le café d'Ormeval dans le moteur du jeu (Three.js, vue subjective, trois points de vue), en deux variantes de la même scène: **A stylisé chaleureux** (formes arrondies, couleurs douces, lumière dorée) et **B semi-réaliste** (proportions et matières réelles, textures réduites), avec les mesures de budget de chacune. **Décision du client (2026-11-08, Q17): variante B, semi-réaliste.** La bible est à reprendre en ce sens par le directeur artistique avant l'alpha: matières réelles et textures réduites à la place des aplats, personnages détaillés (Meshy), même palette de lumière chaude, budgets du PC à tenir (mesures de l'essai dans `docs/jeux/cosy-cafe/essai-style/`).

### 7.2 Fabrication des assets 3D avec Meshy

Fiche de référence du studio: `docs/production/meshy.md` (inventaire des 28 outils, coûts, limites, chaîne de fabrication), essai réel dans `docs/production/essais-meshy/`.

- **Ce qui se fait par Meshy**, depuis une image de référence du directeur artistique, en topologie intelligente au plafond de triangles de la catégorie (C8): meubles aux formes organiques, plantes, décoration, nourriture, ébauches des machines, accessoires et coiffures des personnages. **Par Blender scripté**: les coques des adresses aux cotes des plans, les modules de comptoir, tout ce qui demande une cote exacte. **En mixte**: les machines (ébauche Meshy, reprise dans Blender).
- **Personnages**: corps et squelette communs du studio, accessoires à part. L'essai a montré qu'un personnage entier fait par Meshy fond ses accessoires au corps (le gobelet ne quitte pas la main). Les squelettes de Meshy sont identiques d'un personnage à l'autre (24 os): une animation de sa bibliothèque (678 actions) achetée une fois peut servir à tous.
- **Mise en conformité** obligatoire (scripts de l'essai): échelle réelle (la taille donnée par Meshy est fausse), trous bouchés, couleurs ramenées à la palette, pièces de jeu séparées, contrôle automatique et revue visuelle sur quatre angles en gris. Mesuré sur l'essai: machine à espresso de 1 358 triangles (135 Ko), client de 3 960 triangles avec 5 animations (624 Ko).
- **Crédits**: budget fixé dans chaque brief, aperçu le moins cher avant tout affinage, jamais de texture 8K. Estimation pour la version 1: environ 3 600 crédits, soit un peu plus d'un mois de l'abonnement du client (3 058 crédits par mois). Essai du 2026-11-07: 62 crédits.
- **Licence**: offre payante du client, les modèles lui appartiennent (page des tarifs de Meshy). Chaque asset garde sa fiche de génération versionnée à côté de lui; les fichiers bruts ne se versionnent pas.

## 8. Direction sonore (sound-designer)

Document de référence: `docs/jeux/cosy-cafe/son.md` (sections 8.1 à 8.12).

- **Piliers**: le geste s'entend; douillet même au coup de feu; la salle vit sans couvrir les gestes; la musique sort d'un appareil du café; un son n'est jamais secret (les deux machines sont dans la même pièce); on se parle par-dessus.
- **Ambiances** des cinq adresses sous 16 moments (pluie, hiver, marché, sortie d'école, brunch, fête...), porte ouverte ou fermée; une rumeur de salle sans paroles, qui suit le nombre de clients et reste sous les gestes.
- **Musique diégétique**: radio au village, tourne-disque au bourg, platines en ville, sonorisation à Paris; six listes, une par style de décoration, 24 morceaux originaux (une heure) en version 1, synchronisés sur les deux machines.
- **Environ 300 événements sonores** avec leur priorité; la buse vapeur change de son avec la température du lait. Aucun son ne juge la qualité d'un geste ni ne signale un client déçu, pour ne jamais comparer les deux joueurs.
- **Budget**: 58,7 Mo de son décodé au pire (plafond 64 Mo), environ 30 Mo dans le paquet du jeu.

## 9. Interface et HUD (ux-ui-designer)

Document de référence: `docs/jeux/cosy-cafe/ux.md`; maquettes basse fidélité dans `design/maquettes/cosy-cafe/` (HUD, tablette, ardoise, bilan; planche `planche.png`). En cas d'écart avec la section 5 de ce cahier, `ux.md` fait foi pour les touches et le HUD.

- **Parcours**: salon de Duo, première fois (nom de la maison choisi à deux, avatars, confort), matin et choix de l'adresse, préparation, « On ouvre ? », service, bilan du soir (le livre d'or avant les chiffres), fin de séance, déménagement.
- **HUD minimal**: point de visée, invite contextuelle, objet en main en bas à droite, heure, tickets pris, où est l'autre et ce qu'il tient quand on ne le voit pas, alertes douces. Le reste vit dans le monde: ardoise, rail à tickets aux pinces de couleur, caisse, livre d'or, tablette de la maison.
- **À deux**: proposition d'achat et accord de l'autre, panneaux partagés, absence, déconnexion gérée par Duo.
- **Échap**: Chromium l'avale pour rendre la souris; le jeu le change en pause de Duo chez les deux; au retour, « Clique pour reprendre la souris », sans effet dans le café. Les panneaux du jeu se ferment par leur touche, Retour arrière ou un clic à côté.
- **Confort et accessibilité**: champ de vision réglable, balancement coupé par défaut, aide à viser sans jamais tourner la caméra, gestes simplifiés, lettres du monde d'au moins 18 px à 1366x768, couleurs des joueurs toujours doublées de leur symbole.
- **Vérifié**: 616 contrôles de mise en page de 911x512 à 1920x1080 à 150 %, 92 au clavier seul, contrastes AA, daltonismes.

## 10. Technique (architecte-technique, dev-reseau, tech-artist)

Document de référence: `docs/jeux/cosy-cafe/technique.md`, dont la section 11 (contraintes C1 à C26) que ce cahier respecte.

- **Moteur**: Three.js en vue subjective dans Duo (Electron); l'hôte fait autorité (ADR 0007), chaque joueur prédit son propre avatar, l'autre et les clients sont interpolés.
- **Plafonds principaux pour le design**: 40 personnages animés visibles à la fois (C1); personnages présents au plus 24, 48, 72, 80 et 120 selon l'adresse (C2); file de 6 places (C4); 12 employés au plus (C5); meubles posés 60 à 350 selon l'adresse, 150 visibles (C6); triangles par catégorie (C8); aucune physique, ombre ni reflet calculés (C10 à C12); un seul café à la fois pour les deux (C24).
- **Mesures d'essai**: animer 40 personnages coûte environ 0,35 ms par image sur le processeur du cloud; les messages réseau de la plus grande adresse tiennent sous 9 Ko par domaine. Le coût de dessin sur l'Intel UHD 620 ne se mesure que sur le PC: un banc de mesure part chez le client dès le prototype.
- **Sauvegarde** toutes les 2 minutes, reprise en plein service, succursales calculées une fois par jour (C23, C25). Paquet du jeu: 40 Mo au prototype, 80 Mo à la 1.0.
- **Piège trouvé dans le code de Chromium**: le premier Échap rend la souris au lieu de mettre en pause; parade dans le SDK (section 9).
- **À écrire avant le prototype**: quatre ADR, dont celle de la vue subjective pour toute la plateforme.

## 11. Périmètre (game-designer, manager)

- **Version 1** (jusqu'à Paris, comme demandé):
  - les cinq adresses et leurs extensions (quatorze), leurs défis, la visite du Guide de la Tasse et la fête de la maison; le jeu libre ensuite;
  - la journée en trois temps, le lundi, la semaine, quatre saisons, la météo et l'annonce du lendemain, les événements de la section 6.8;
  - l'ardoise, les prix, l'attrait des dix profils, la découverte des goûts;
  - le service au comptoir et en salle, le rail des tickets, les gestes à la main et leurs fenêtres, trois niveaux d'équipement par poste, la qualité sans échec, le dessin sur le lait, les options lait d'avoine et déca (si Q6 les garde);
  - la plonge, le stock, les sept fournisseurs, les livraisons à ranger, le dépannage, le panier du soir;
  - 47 recettes, le catalogue de la section 6.3, la brocante, l'aménagement et ses règles de circulation et de raccordement, la roue des styles;
  - l'ambiance, la satisfaction, le livre d'or, la réputation en tasses, la renommée;
  - 24 habitués et leurs histoires en cinq étapes, ceux qui suivent la maison;
  - les employés (six rôles, dix traits, trois niveaux), l'équipe reprise à Paris, les succursales;
  - la caisse, la réserve, la tirelire, les achats à deux, l'absence de faillite;
  - « Nos projets » (60), les aides de chaque joueur et les réglages du duo;
  - trois maisons, sauvegardes en plein service, séances à l'historique, progression commune.
- **Plus tard** (bonus, mises à jour du soir): une sixième adresse ou une ville étrangère; des saisons de plus (fêtes, recettes); des commandes spéciales d'habitués (gâteaux d'anniversaire préparés à la demande); des concours (le croissant de l'arrondissement); un mode « café du dimanche » plus lent; des tenues et coiffures en plus; des disques en plus; un carnet de photos souvenirs.
- **Hors périmètre**, avec la raison: alcool et tabac (un café et salon de thé douillet, des clients de tous âges); combat, vol, dangers, salissures dégoûtantes, clients méchants (le ton); faillite, perte définitive, note qui baisse (le ton, et rien à reprocher à l'autre joueur); licenciements secs, grèves (« gérer sans dureté »); deux joueurs dans deux cafés à la fois en version 1 (C24, pilier 1); physique des objets, vaisselle cassée, liquides renversés (C12); mode solo, plus de deux joueurs, jeu par Internet (plateforme); manette (plateforme); voix enregistrées (question S2 du son); marques réelles, lieux et établissements réels (création originale); génération procédurale des adresses (les plans sont dessinés); cinématiques en vue subjective (C22); achats dans le jeu, publicité, classements.

## 12. Critères d'acceptation (qa-testeur)

Proposition de critères de conception, que qa-testeur reprendra, rendra testables dans sa forme et complétera avec les critères techniques. Modes proposés: U (simulation sous Node à graine fixe), P2 (deux contextes dans le faux hôte), E ou EL (application), M (chez le client), D (relecture).

| # | Étant donné | Quand | Alors | Vérification |
|---|---|---|---|---|
| CA-01 | un nouveau duo | la première scène s'achève | chaque joueur peut dire le but en une phrase (servir, faire venir du monde par l'ardoise, faire grandir la maison), en moins d'une minute | M |
| CA-02 | le service ouvert, les deux joueurs actifs | 60 s réelles passent | l'horloge avance d'une heure de jeu, identique chez les deux (1,25 s par minute avec le rythme paisible) | U, P2 |
| CA-03 | la préparation | un seul joueur retourne la pancarte | elle ne se retourne pas; l'autre voit « On ouvre ? »; elle s'ouvre quand l'autre répond | P2 |
| CA-04 | l'heure de fermeture | elle sonne | plus aucun groupe n'entre; les commandes prises sont servies; les clients partent au plus tard 15 minutes de jeu après (5 après leur service s'ils sont servis plus tard) | U |
| CA-05 | une partie à la même graine, le même état et les mêmes réglages | on rejoue la même journée deux fois | même nombre de groupes par profil et par heure (loi de Poisson autour de AT-07); même empreinte d'état | U |
| CA-06 | un profil sans aucune de ses envies à l'ardoise | une journée passe | aucun groupe de ce profil n'entre | U |
| CA-07 | l'exemple de la règle AT-07 | on calcule les groupes attendus | on retrouve les valeurs de la table `res_exemple`, à 0,01 près | U |
| CA-08 | une file de six places pleine | un groupe arrive | il n'entre pas et compte parmi les repartis | U, P2 |
| CA-09 | un café au plafond C2 de son adresse | un groupe arrive | il n'entre pas; jamais plus de personnages présents que le plafond (village 24, bourg 48, ville 72, café d'angle 80, maison 120) | U |
| CA-10 | un groupe qui a commandé | sa commande tarde de 5 minutes | il attend, ne repart pas, n'affiche jamais la colère; sa satisfaction baisse au plus de 30 | U, P2 |
| CA-11 | un espresso lancé à la main | le joueur l'arrête à 13 s, à 16 s, à 19 s, ou ne fait rien | qualités « Parfait », « Bien », « Correct », « Correct » (arrêt seul à 20 s), affichées chez ce joueur seul | P2 |
| CA-12 | le lait à la buse | le joueur relâche à 60 °C, 68 °C, ou attend | « Parfait », « Bien », « Correct » (coupure à 72 °C) | P2 |
| CA-13 | un geste jugé chez l'invité avec 150 ms de latence | il arrête l'extraction à 13 s sur son écran | la qualité est « Parfait » chez lui comme chez l'hôte (C16) | EL |
| CA-14 | l'aide « Gestes simplifiés » chez un joueur | il fait vingt gestes | tous « Bien »; aucune trace de l'aide sur l'écran de l'autre | P2 |
| CA-15 | n'importe quel geste raté de toutes les façons possibles | on termine la recette | l'article existe et se sert; aucun état d'échec | U |
| CA-16 | toutes les actions de la section 5.2 | chacune est déclenchée | chacune a son retour visuel et son retour sonore (relevés par le crochet de test); aucun son ne dépend de la qualité d'un geste ni d'un client déçu | P2, M |
| CA-17 | les deux joueurs prennent la même tasse à moins de 50 ms d'écart | l'hôte traite les deux intentions | une seule tasse dans une seule main; l'autre lit « Déjà pris par … »; une pile en donne une à chacun | P2 |
| CA-18 | deux joueurs préparent le même article | les deux le posent sur le passe | un seul rejoint le ticket, l'autre reste « en trop » et part au prochain client qui le commande | U, P2 |
| CA-19 | une caisse de 600 € | les deux achètent chacun un objet à 400 € en même temps | un achat passe, l'autre est refusé sans débit; la caisse finit à 200 € | U, P2 |
| CA-20 | un achat important | un joueur le lance | une proposition s'affiche chez l'autre, la somme est réservée; un refus ne débite rien | P2 |
| CA-21 | un meuble que l'on pose en coupant l'accès à une place ou à la porte | on tente la pose | elle est refusée avec sa raison; passages de 0,9 m jusqu'aux places, 1,2 m pour l'allée principale, jamais moins de 0,6 m | U |
| CA-22 | une machine à espresso et un emplacement sans eau ni prise renforcée | on tente la pose | refusée, avec la raison | U |
| CA-23 | un meuble lourd | un joueur seul tente de le porter | il ne peut que le faire glisser d'un mètre au plus; à deux, il se porte à 1,2 m/s au plus, sans demi-tour sur place | P2 |
| CA-24 | un café au plafond C6 de meubles et objets | on tente d'en poser un de plus | refusé avec « Plus de place pour un objet de plus ici »; aucune vue n'en montre plus de 150 | U |
| CA-25 | une cohérence calculée sur l'exemple AM-02 (40 campagne, 12 jardin, 8 rétro, 10 bistrot) | on calcule | 60 % | U |
| CA-26 | cent journées d'un même café | on relit la réputation chaque soir | elle ne baisse jamais; elle suit les seuils de la table `reputation` | U |
| CA-27 | un habitué dont c'est le jour | le duo lui sert sa fétiche avant qu'il commande | +10 de satisfaction, +20 de lien, son prénom s'affiche, « Comme d'habitude ? » | P2 |
| CA-28 | une journée quelconque | elle se termine | jamais plus de huit habitués venus | U |
| CA-29 | une caisse vide et des charges à payer | la fermeture arrive | la différence devient « à régler »; les fournisseurs livrent la commande habituelle; le service du lendemain a lieu; aucun écran d'échec | U, P2 |
| CA-30 | une succursale aux sept dernières journées jouées connues | une journée passe ailleurs | elle rapporte 45 % de leur résultat moyen, jamais moins de zéro, calculé une fois | U |
| CA-31 | la maison avec plusieurs cafés | l'aube d'une journée | l'écran du choix de l'adresse s'affiche chez les deux; le chargement prend 5 s au plus | P2, EL |
| CA-32 | une lettre d'offre reçue, le défi tenu, la tirelire pleine | les deux acceptent le déménagement | il a lieu le lundi suivant, par un fondu; l'ancien café devient une succursale avec sa gérance | U, P2 |
| CA-33 | le défi local d'une adresse | sa réputation et son extension sont là | il se tient le prochain jour prévu, à l'affluence x1,6; il ne peut pas échouer | U |
| CA-34 | les aides et réglages de chaque joueur | on parcourt l'écran de l'autre (HUD, tablette, panneaux) | aucune trace des aides de l'autre; aucune statistique par joueur nulle part | P2, D |
| CA-35 | un joueur sans entrée depuis 60 s en plein service | la 60e seconde passe | la pancarte « Petite pause »; plus personne n'entre, l'horloge et la patience s'arrêtent; l'autre finit les commandes en cours; une entrée de l'absent relance tout après 3 s | U, P2 |
| CA-36 | une coupure réseau en plein port à deux | le lien revient | la charge est posée, rien n'est perdu, chacun à sa place; le service reprend à la seconde | EL |
| CA-37 | « Retour au salon » en plein service | on relance la séance | elle reprend à la même seconde après le décompte; l'historique inscrit une séance normale, pas une partie interrompue | P2, EL |
| CA-38 | l'application de l'hôte tuée en plein service | Duo est relancé | la maison reprend à la dernière sauvegarde, 2 minutes au plus avant l'arrêt | EL |
| CA-39 | une sauvegarde écrite par le Mac hôte | le PC héberge et la charge | chaque joueur retrouve son avatar; empreinte d'état identique | EL, M |
| CA-40 | une sauvegarde d'une version ancienne, faite en plein service | la version suivante la charge | elle reprend en fin de journée, le reste du service calculé comme une succursale; rien de durable ne disparaît | U, CI |
| CA-41 | la fin d'une séance | la plateforme reçoit le résultat | journées, adresse, trois statistiques (journées tenues, clients servis, mots au livre d'or), au plus trois faits partagés de 60 caractères; aucun fait individuel | U, EL |
| CA-42 | 100 séances simulées | on relit la progression | `progress` vaut projets réalisés / projets de la version; affichée « Nos projets: n sur 60 » | U |
| CA-43 | tous les textes du jeu | relecture et contrôle automatique | aucun accord au genre d'un joueur, tutoiement de chaque joueur, « vous » pour les deux, aucune marque ni aucun lieu réel, aucun tiret cadratin ni demi-cadratin | D, U |
| CA-44 | le jeu complet | on le joue à la souris seule, puis au clavier seul | tout est faisable; aucune touche de la rangée des chiffres n'est exigée; Échap ne ferme jamais un panneau du jeu | P2, M |
| CA-45 | `cosy_cafe.py --croise` lancé sur ce cahier | il s'exécute | aucun écart: chaque table d'équilibrage est la copie des données, chaque résultat celui du fichier de résultats, et les résultats correspondent aux données | U |
| CA-46 | les tables de configuration du jeu, relues par le script | `cosy_cafe.py --resultats` s'exécute | le duo médian fête la maison entre 32 et 38 h; neuf duos tranquilles sur dix avant 58 h; tous les plafonds C2 et C5 tenus | U |
| CA-47 | le service du village, deux joueurs, la dernière semaine du duo médian | on le simule | moins de 15 % de groupes repartis et moins de 60 s d'attente moyenne: tendu mais tenable | U |
| CA-48 | dix séances de prototype chez le client | on mesure la durée d'une journée ouverte | 20 minutes à 4 minutes près; sinon on recale la minute de jeu ou les heures d'ouverture | M |
| CA-49 | les séances de prototype | on observe le duo pendant les coups de feu | les deux se parlent pour se répartir le travail (au moins une phrase par minute de pointe); les deux disent n'avoir jamais attendu sans rien faire | M |
| CA-50 | le livre d'or d'une journée où des clients n'ont pas trouvé de place | on le lit à la fermeture | au moins un mot en donne la raison, si un client déçu a écrit; aucun mot ne nomme un joueur | U, P2 |
| CA-51 | les mesures du prototype (gestes par minute, durée de préparation et de fermeture, part épargnée) | on les reporte dans la table `duos` | la simulation relancée redonne une durée médiane entre 32 et 38 h, ou l'on recale les seuils (réputation, installations) et l'on met ce cahier à jour | U, M |

## 13. Jalons (manager)

| Jalon | Contenu attendu | Date visée | Validé le |
|---|---|---|---|
| Prototype | jouable à deux en réseau, formes simples, au café d'Ormeval seulement: la machine à deux groupes, la buse, la bouilloire, la vitrine, la caisse, le rail, le passe, la plonge à l'évier; huit recettes (espresso, allongé, noisette, crème, cappuccino, thé noir, chocolat, croissant); le service au comptoir; l'ardoise et son attrait pour quatre profils (pressés, voisins, flâneurs, familles); les gestes à la main avec leurs fenêtres et l'aide « Gestes simplifiés »; la satisfaction, le livre d'or (dix mots), la réputation; Simone et Mathis; la livraison du matin (un carton lourd à deux); la caisse et deux achats (moulin à dose, terrasse); la pause, l'absence, la sauvegarde en plein service et la reprise en changeant d'hôte; la séance à l'historique. Questions à trancher: le coup de feu à deux est-il amusant, tendu sans être stressant ? se parle-t-on ? les gestes ont-ils du goût ? Mesures: CA-48, CA-49, et les paramètres de la table `duos` (CA-51) | | |
| Alpha | toutes les fonctions et tout le contenu de la version 1 (section 11), assets provisoires, textes en premier jet, plans de la ville et de Paris du level designer, simulation relancée sur les fichiers de configuration du jeu (CA-45, CA-46) | | |
| Bêta | assets définitifs, son et musiques, textes relus, budgets tenus sur le PC (C1 à C26), aucun bug bloquant; l'histoire complète jouable du village à la fête | | |
| 1.0 | recette réussie sur les deux machines, jeu publié dans Duo | | |

## 14. Questions ouvertes et décisions

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|
| Q1 | Le titre | « Cosy Café »; « Deux Tabliers »; « L'Ardoise du jour »; « Comptoir à deux »; « Petit noir, grand crème »; « Les Deux Tasses » | « Deux Tabliers »: aucun jeu, livre, film ni marque trouvés sous ce nom; il dit le couple, le métier et la douceur. « Cosy Café » se perdrait parmi des jeux existants (section 1.1). L'identifiant `cosy-cafe` peut rester | « Deux Tabliers » | 2026-11-08 |
| Q2 | La durée de l'histoire principale | environ 34 h (ce cahier: 34,0 h pour un duo médian, 28,3 à 53,1 h selon les duos); plus courte (environ 25 h: seuils et coûts allégés); plus longue (environ 50 h: une semaine de plus par adresse) | environ 34 h: une cinquantaine de soirées de 40 minutes, puis le jeu libre; on recale au prototype sur vos vraies séances (CA-51) | | |
| Q3 | Paris réel ou métropole inventée | Paris réel, avec des rues, des commerces et des personnes inventés; une grande ville inventée | Paris réel aux rues inventées: c'est le rêve de la demande (« jusqu'à Paris »); la bible le rend reconnaissable par sa matière seule, sans aucun lieu réel | | |
| Q4 | Les deux joueurs toujours dans le même café | toujours ensemble; libres d'être dans deux cafés à la fois | toujours ensemble en version 1: le coup de feu à deux est le cœur du jeu, et deux cafés à la fois coûteraient un lot de développement et doubleraient les tests (technique, section 7.2, C24); à rouvrir après la bêta si vous le souhaitez en jouant | | |
| Q5 | Les anciens cafés | gardés en succursales; revendus pour financer le suivant; au choix | gardés en succursales: on ne perd rien de ce qu'on a construit, on peut y retourner jouer, et la maison grandit vraiment (cinq cafés à la fin); la revente ne serait qu'une perte déguisée | | |
| Q6 | Les options de commande (lait d'avoine, déca) | en version 1; plus tard; jamais | en version 1: elles donnent une raison de lire le ticket et un petit soin à apporter, sans jamais faire échouer une commande (CO-08) | | |
| Q7 | Les aides de gestes | proposées dès la première séance à chaque joueur; cachées dans les réglages | proposées au premier geste de chaque joueur, sur son seul écran (« Veux-tu des gestes simplifiés ? »), puis réglables à tout moment: personne n'a à le demander devant l'autre | | |
| Q8 | Les prix | plausibles en euros, plus chers à Paris (ce cahier: espresso à 1,40 € au village, 2,80 € à la maison parisienne); sans unité (« pièces ») | plausibles en euros: ils parlent tout de suite et rendent Paris crédible; les loyers et les salaires sont réalistes, seules les installations et les travaux sont modestes, justifiés par l'histoire (les lieux sont confiés) | | |
| Q9 | Le dixième profil, « les voisins » (deux mots au comptoir) | le garder; s'en tenir aux neuf profils du cadrage | le garder: il donne au poste calme (parler aux gens) un vrai effet sur le jeu, et fait vivre le zinc à chaque adresse | | |
| Q10 | Les textes s'accordent-ils au genre de vos avatars ? | rédaction neutre pour tous (comme Duo et La Petite Ligne); un choix « il » ou « elle » | rédaction neutre: un seul texte à écrire et à tester, déjà éprouvé au jeu 1 | | |
| Q11 | Combien de musique en version 1 (son, S1) | 24 morceaux (une heure); moins; plus | 24 morceaux, environ 21 Mo, puis un second volume de 12 morceaux par une mise à jour si les listes lassent | | |
| Q12 | Des voix dans le jeu (son, S2) | aucune voix: rumeur sans paroles, clients qui s'expriment par leurs gestes et quelques notes; des voix enregistrées | aucune voix, comme La Petite Ligne; on juge la rumeur à l'écoute dès le prototype | | |
| Q13 | Mains visibles en vue subjective (bible) | mains stylisées; objet tenu seul | objet seul au prototype, mains stylisées à l'alpha | | |
| Q14 | Les signes des joueurs (bible) | figés (bandeau, bretelles croisées, écusson) avec un haut clair ou sombre imposé selon la paire; libres | figés: c'est ce qui garantit qu'on se reconnaît de dos | non: tenue de travail normale aux couleurs sourdes de la maison, au plus un détail discret; la couleur du joueur reste seulement là où elle sert au jeu (pince du ticket, indicateurs de l'interface). « On sait entre nous qui on est » | 2026-11-08 |
| Q15 | La maison parisienne (bible, plans) | sous une verrière; sur un boulevard | la verrière, pour sa lumière unique (c'est celle des plans: la Graineterie) | | |
| Q16 | Le second rang de terrasse au café d'angle (plans) | un seul rang (16 places); deux rangs (26) si l'architecte valide une foule lointaine simplifiée | un rang au prototype; on décide après la mesure sur le PC | | |
| Q17 | La direction de rendu (essai de style 3D) | A stylisé chaleureux; B semi-réaliste; un mélange | à décider sur les images de l'essai, en cours | B semi-réaliste | 2026-11-08 |
| Q18 | Les réglages de souris et de champ de vision (UX, U1) | dans Duo, communs à tous les jeux; dans chaque jeu | dans Duo, par ordinateur; d'ici là, dans la tablette | | |
| Q19 | L'annonce du départ (UX, U2) | « Café de la place cherche repreneurs »; « Café de la place à reprendre » | « à reprendre »: l'autre forme suppose des joueurs au masculin. Si Q20 est validée, la question tombe: l'annonce devient l'inscription « À LOUER · s'adresser au-dessus » tracée dans le blanc de la vitrine | | |
| Q20 | Simone dans le nouveau départ | ancienne patronne propriétaire des murs, qui habite au-dessus et loue la boutique vide; une autre voisine (l'épicière fait doublon avec Mireille) | ancienne patronne propriétaire des murs: elle garde son rôle (première cliente, guide, future gérante) et rend le départ chaleureux | | |
| Q21 | Un prêt pour démarrer | aucun en démo; un prêt avec mensualité | aucun dans la démo (deux mensualités en deux semaines: tout le monde le prendrait, le choix disparaît); à proposer à partir de Mérelles | | |
| Q22 | L'épargne de départ et les prix d'installation | 1 800 €, prix de village et d'occasion (vieille machine 450 €, machine révisée 800 €); plus; moins | 1 800 €: la simulation y trouve quatre façons d'ouvrir qui se valent sans piège (1 500 € est trop dur pour un duo tranquille, 2 100 € ôte le choix) | | |
| Q23 | Les meubles et la machine de Simone sous les draps | à racheter pour pas cher; une boutique tout à fait nue | les garder: l'image du café fermé, la voie économique pour un duo prudent, des modèles déjà faits | | |
| Q24 | Les livraisons du jour de l'installation | le jour même, par Gaby, en moins d'une minute; le lendemain matin | le jour même: sinon le premier jour se passerait à attendre | | |
| Q25 | Les adresses suivantes | à équiper de zéro aussi; équipées comme aujourd'hui; à moitié | à moitié: on garde ce qui tient aux murs et fait l'histoire du lieu (le four de René, les presses de l'Imprimerie), le reste s'achète; à décider avant de produire Mérelles | | |
| Q26 | Le ménage de l'installation | facultatif mais visible (ambiance, passants); obligatoire; absent | facultatif mais visible: on le fait volontiers à deux, personne n'est bloqué | | |

## 15. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-11-08 | 0.2.4 | Retour du client sur la démo: « le jeu devait commencer sur une cellule vide et le café fermé, un budget pour démarrer et acheter meubles, et stock pour commencer ». Ormeval devient une boutique fermée depuis trois ans: arrivée sur la place, rideau levé à deux, installation le jour 1 (13 à 24 minutes), 1 800 € d'épargne au lieu de l'équipement fourni et des 300 € de caisse, aucune réserve offerte, Simone propriétaire des murs qui vend sa vieille machine et ses tables, garde-fous d'ouverture, guide de l'installation. Conception et simulation: `demo/depart-cellule-vide-v0-3.md`, `demo/simulations/depart_v0_3.py`. Mis à jour: En bref, 1.3, 2.5, 3, TE-08, EC-08, notes sous les tables `adresses`, `depart` et `divers`, 6.5 (Simone), 6.9 (scènes 1 et 2), Q19 à Q26. Les tables marquées de la simulation longue ne changent pas (contrôle `--croise`), à recaler à la prochaine relance | client |
| 2026-11-08 | 0.2.3 | Décision du client: direction de rendu B, semi-réaliste (Q17) | client |
| 2026-11-08 | 0.2.2 | Retours du client sur l'essai 3D: personnages (clients et avatars) au niveau de détail du décor (visages, mains, vêtements, coiffures variées); couleurs des joueurs retirées des tenues (Q14). La bible (section 4) est à reprendre en ce sens par le directeur artistique | client |
| 2026-11-08 | 0.2.1 | Décision du client: titre « Deux Tabliers » (Q1) | client |
| 2026-11-08 | 0.2 | Consolidation par le manager: résumés des sections 7 à 10, essai de style 3D (7.1), fabrication avec Meshy (7.2), questions Q11 à Q19 venues du son, de la bible, des plans et de l'UX, arbitrages entre membres (section 16) | manager |
| 2026-11-07 | 0.1 | Première rédaction des sections de conception (1 à 6, 11, 13, 14, proposition de la 12), à partir du cadrage du manager; simulation client par client jointe (`simulations/cosy_cafe.py`, `resultats.md`); alignement sur les plans des cinq adresses (level-designer: noms, places, extensions, équipes reprises), les contraintes C1 à C26 (architecte), la bible (roue des styles, fournisseurs, habitués) et les hypothèses du son (fenêtres du lait, aucun son de qualité) | game-designer, sur brief du manager |

## 16. Arbitrages du manager (2026-11-08)

Écarts relevés entre les documents de l'équipe, et ce qui fait foi.

| Sujet | Écart | Décision | Raison |
|---|---|---|---|
| Touches et HUD | section 5 de ce cahier et `ux.md` | `ux.md` fait foi: balancement de tête coupé par défaut, pancarte « Ouvert » par E maintenu (pas de touche F), aperçu de pose qui dit par sa forme et un texte si la pose est possible | confort en vue subjective et une touche de moins à apprendre |
| Horaires | `son.md` suppose 8 h à 19 h partout | les horaires par adresse de la section 4.2 font foi; le son suit | les règles de jeu priment |
| Employés à l'arrivée en ville | 2 sur le plan, 0 dans ce cahier | 0: la première embauche est un moment de jeu; le plan s'ajuste à l'alpha | progression voulue |
| Coup de main au bourg | jours de marché (plan) ou aussi le week-end (cahier) | le cahier (marché et week-end) | la simulation l'emploie ainsi et tient le plafond C2 |
| Progression commune dans Duo (F09) | formule par adresse (technique) ou projets réalisés (cahier) | projets réalisés sur les 60 de « Nos projets » | elle continue de monter dans le jeu libre |
| Signe du profil « voisins » | absent de la bible | journal plié ou cabas, accoudé au comptoir, à dessiner à l'alpha | cohérent avec les autres profils |
| Surfaces | ville à 165 m² et café d'angle à 29 places assises (plus 3 ou 4 debout au zinc), hors des fourchettes du cadrage | les plans font foi | tenus par le validateur et par les plafonds C1 à C3 |
| Sorties brutes de Meshy | la bible demande de les versionner, la fiche Meshy non | non versionnées (fiche de génération seulement) | plusieurs Mo par modèle, et l'asset conformé se reprend sans elles |
| Couleur des modèles Meshy | une couleur par face (bible) ou par pièce (fiche Meshy) | par pièce par défaut, par face pour les pièces vraiment multicolores | l'éclairage peint dans les textures de Meshy tache les couleurs face par face |
| Critères d'acceptation | proposés ici (CA-01 à CA-51) | à rendre testables par le qa-testeur après la validation du client | le contenu peut encore bouger |
