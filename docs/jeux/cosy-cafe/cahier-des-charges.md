# Cahier des charges: Cosy Café (titre de travail)

| Champ | Valeur |
|---|---|
| Identifiant | `cosy-cafe` (provisoire; l'architecte rappelle qu'il peut rester même si le titre change, section 1.1) |
| Statut | brouillon |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-11-07 |
| Rédaction | game-designer: sections 1 à 6, 11, 13, 14 et proposition de la section 12; sections 7 à 10: renvois vers les documents de leurs responsables, résumés à écrire par le manager |
| Documents liés | cadrage: `docs/jeux/cosy-cafe/cadrage.md`; plans et adresses: `docs/jeux/cosy-cafe/plans/`, `docs/jeux/cosy-cafe/adresses.md`; bible: `docs/jeux/cosy-cafe/bible-artistique.md`; son: `docs/jeux/cosy-cafe/son.md`; interface: `docs/jeux/cosy-cafe/ux.md`; technique: `docs/jeux/cosy-cafe/technique.md`; simulation: `docs/jeux/cosy-cafe/simulations/cosy_cafe.py` et `resultats.md`; plateforme: `docs/plateforme/cahier-des-charges.md` (F05 à F09) |

> Mode d'emploi: copier ce modèle dans `docs/jeux/<id-du-jeu>/cahier-des-charges.md`. Chaque section indique ses responsables. Le manager consolide, le client valide. Une fois validé, ce document est le contrat: toute modification passe par le manager et s'inscrit dans l'historique (section 15).

## En bref

- **Le jeu**: à deux, en vue à la première personne, vous reprenez le petit café d'un village et vous le tenez ensemble: l'un au comptoir, l'autre à la machine, ou l'inverse, comme vous voulez. Ce que vous écrivez sur l'ardoise décide de qui pousse la porte; les meubles, la décoration et la musique décident de l'envie de rester. On sert, on encaisse, on débarrasse, on lave, on range la livraison du matin, on lit le livre d'or le soir.
- **La progression**: cinq adresses, chacune plus grande et plus vivante. Ormeval, le café de la place du Tilleul (38 m², 8 places à l'arrivée); Mérelles, l'ancienne pâtisserie face à la halle (le four, le service en salle, le marché du jeudi); l'atelier d'une ville universitaire (les employés, le brunch, le café de spécialité); un café d'angle à Paris (l'équipe reprise, les touristes); la grande maison parisienne sous sa verrière (notre mélange, le laboratoire de pâtisserie, la visite d'un guide). Chaque café quitté reste ouvert, confié à quelqu'un: à la fin, la maison en tient cinq.
- **La durée**: l'histoire principale dure <!-- val:fin_h_median -->36,4 h pour un duo médian (de <!-- val:fin_h_rapide -->28,5 h pour un duo rapide à <!-- val:fin_h_lent -->56,2 h pour un duo qui prend son temps), soit une soixantaine de séances de 40 minutes; puis le jeu continue sans fin. Une journée ouverte dure environ 21 minutes réelles: un service de 10 à 13 minutes entre une préparation et une fermeture à votre rythme.
- **Ce qui le rend unique**: l'ardoise qui fait la clientèle; le coup de feu à deux, réglé à la voix parce que chacun ne voit que ce qu'il regarde; des habitués qui ont un prénom, une commande fétiche et une histoire; un style de décoration cohérent qui compte vraiment; des fournisseurs qui ont un visage; aucune faillite, aucune partie perdue, rien qui compare les deux joueurs.
- **Chiffres sortis d'une simulation**: chaque journée de chaque partie simulée est jouée client par client (`simulations/cosy_cafe.py`, 120 parties); les tables de ce cahier en sont la copie exacte, vérifiée par un contrôle automatique.
- **À trancher** (section 14): le titre (cinq propositions), la durée de l'histoire, Paris réel ou inventé, deux cafés à la fois, garder ou revendre les anciens cafés, les options de commande (lait d'avoine, déca), la place des aides.

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
- pas de prix fixés article par article sur des étagères: une ardoise de six à vingt lignes, écrite chaque matin, qui décide des profils qui entrent;
- pas de note étoilée qui tombe après une mauvaise journée: une réputation en tasses qui ne baisse jamais, et un livre d'or écrit à la main qui dit ce qui a plu ou manqué;
- pas de dette ni de faillite: le pire est une journée calme;
- le couple au centre: deux postes qui ne se voient pas, des gros meubles portés à deux, les grandes décisions prises ensemble, et rien qui compare les deux joueurs.

### 1.3 Écarts avec le cadrage

| Cadrage | Ce cahier | Raison |
|---|---|---|
| Neuf profils de clients | dix: ajout des **voisins** [`voisins`], qui viennent pour deux mots au comptoir | donne un vrai poids au poste calme (parler aux gens) et fait vivre le zinc à chaque adresse; un profil de plus à habiller pour la bible (7.2) |
| Journée de 15 à 20 minutes | journée ouverte de 21 minutes en moyenne (17 à 25 selon le duo), lundi de fermeture en plus | mesuré par la simulation: service de 10 à 13 minutes selon l'adresse, préparation et fermeture du duo médian (4 et 3,5 minutes) |
| Saisons de 28 jours, 35 h pour l'histoire | 28 jours confirmés; histoire principale en 36,4 h pour un duo médian | simulation, section 4.21 |
| Places assises (ordre de grandeur) | village et bourg: plans du level designer (8 puis 18 places; 12 puis 39); ville, Paris: hypothèses de la simulation (table `adresses`), sous les plafonds de l'architecte (C2) | les plans font foi; la ville et Paris attendent les leurs |
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
- **Des réglages du duo**, décidés à deux: rythme paisible (une heure de jeu dure 75 secondes au lieu de 60), patience des clients grande (une fois et demie), affluence douce (x0,8). Mesuré sur un duo tranquille au bourg: les clients repartis passent de 15 % à 5 % avec le rythme paisible et la patience grande (section 4.21).
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
| Le lundi (fermé) | brocante, travaux, visite d'une succursale: activités faites ensemble, ou « Passer à mardi » d'un commun accord |
| Un client parle longuement à l'un | l'autre continue; l'horloge ne s'arrête pas pour une conversation |
| L'un s'absente du clavier | après 60 secondes de service sans entrée, la pancarte passe à « Petite pause »; l'autre finit les commandes en cours (PA-04) |
| Déménagement | une scène commune en place, puis un fondu: aucun écran d'attente au-delà du chargement (5 s au plus, C23) |

## 3. Boucles de jeu (game-designer)

- **Boucle de 30 secondes**: une commande au comptoir, un espresso lancé, le lait moussé pendant que l'extraction coule, le service, une table débarrassée. « Deux crèmes et un chocolat ! », « Ça part ! ». Chaque geste a son retour visuel et sonore (section 5.2).
- **Boucle d'une journée** (21 minutes réelles en moyenne):
  1. **Préparation**, horloge arrêtée à l'heure d'ouverture: ranger la livraison du matin, fournées et carafes, ardoise du jour (la tablette propose une carte, on la retouche), décoration, achats. 2 à 6 minutes.
  2. **Service**, horloge en marche dès que la pancarte se retourne: trois coups de feu dans la journée (le café du matin, le déjeuner dès le bourg, le goûter), des heures plus calmes entre eux. 10 à 13 minutes selon l'adresse.
  3. **Fermeture**, horloge arrêtée: les derniers clients finissent tranquillement, puis le bilan (caisse, clients, mots du livre d'or), la commande aux fournisseurs, les achats et travaux, « Nos projets ». 2 à 5 minutes. La journée finit quand les deux joueurs ont dit « À demain ».
- **Boucle d'une semaine**: lundi fermé (brocante, travaux, visite d'une succursale), jour de marché, mercredi des familles, sorties d'école, week-end des promeneurs et, dès la ville, du brunch. Un défi local tombe un dimanche ou un jour de marché.
- **Boucle d'une saison** (28 jours, quatre semaines): météo et envies de saison (boissons chaudes l'hiver, terrasse et boissons glacées l'été), une recette découverte chaque saison, deux événements.
- **Boucle d'une adresse** (trois à cinq semaines pour un duo médian): arriver et rencontrer la personne qui vous confie le lieu; équiper et décorer; gagner la réputation; ouvrir la première extension; tenir le défi local (une journée de fête, toujours réussie); recevoir la lettre de l'adresse suivante, mettre de côté, déménager un lundi. Le café quitté devient une succursale.
- **Long terme**: la maison et ses cinq cafés, les histoires des habitués, les recettes, la visite du Guide de la Tasse et la fête de la maison; puis le jeu libre: retourner jouer dans chaque café, finir « Nos projets », tout décorer.
- **Entre les séances**: rien ne bouge. Pas d'horloge réelle, pas de succursale qui tourne sans vous. On retrouve la maison à la seconde près, quelle que soit la machine qui héberge.

**Comprendre le but en moins d'une minute**: la première scène le dit en trois phrases. Simone, l'ancienne patronne, tend les clés sur le seuil: « Vous voilà chez vous. Faites de ce café l'endroit où l'on aime s'arrêter: écrivez votre carte, servez vos clients, et la maison grandira. Demain, on retourne la pancarte à 8 heures. » Ensuite, « Nos projets » affiche toujours les trois prochains objectifs.

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
- **TE-08** Le lundi, l'horloge est arrêtée toute la journée: travaux (les extensions commandées se construisent), brocante (des pièces uniques à prix doux), visite d'une succursale (dialogue avec la gérance, réglages), commandes. La journée finit quand les deux ont choisi « Passer à mardi ». Raison: un vrai café ferme un jour par semaine; c'est le jour des chantiers et des flâneries.
- **TE-09** Jours particuliers de la semaine (multiplicateurs: table `jours`):
  - jour de marché: Mérelles le jeudi, l'atelier le samedi, le café d'angle le mardi et le vendredi, la maison parisienne le dimanche; Ormeval n'a pas de marché;
  - mercredi: les enfants n'ont pas classe l'après-midi, les familles viennent;
  - mardi, jeudi, vendredi: la sortie d'école à 16 h 30 fait le goûter;
  - samedi et dimanche: promeneurs, familles et, dès l'atelier, brunch; les pressés se font rares.
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
| à remplir |

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
- **SE-03** **Pourboires**: un groupe content (satisfaction de 75 et plus) laisse un pourboire une fois sur deux, 5 % de l'addition (10 % à 88 et plus), multiplié par la générosité du profil (table `profils`). Les pièces tombent dans la tirelire du comptoir, visible des deux; elles rejoignent la caisse au bilan. Comme en France, les pourboires restent modestes (section 4.21).
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
- **RE-05** **Rattrapage**: à partir du 12e jour ouvert à une adresse, les points de réputation du jour comptent 5 % de plus par jour au-delà, jusqu'au double (le bouche-à-oreille des habitués). Effet mesuré: les duos médians n'y arrivent presque jamais; les duos tranquilles y gagnent une semaine à certaines adresses.
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

- **EM-01** **Quand**: aucun au village; au bourg, un coup de main (rôle commis) pour les jours d'affluence (marché du jeudi et week-end); à partir de la ville, une équipe (12 personnes au plus par adresse, C5). Chaque café parisien se reprend avec une partie de son équipe (trois personnes au café d'angle, cinq à la maison parisienne, déjà au niveau 2): un café d'angle se vend d'ordinaire avec son personnel.
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
- **EC-08** **Installation**: s'installer à une adresse coûte une somme (table `adresses`: caution et premiers frais, 600 € au bourg à 3 000 € à la maison parisienne), modeste parce que chaque lieu est confié par quelqu'un qui veut qu'il revive (René, Agathe, Antoine, Éliane). Elle comprend l'équipement de départ (table `depart`).

### 4.16 Progression et déblocages

- **PR-01** **L'offre**: quand la renommée de la maison atteint le seuil de l'adresse suivante (table `adresses`), une lettre arrive au courrier du matin (« Une boutique se libère place de la Halle »). Elle ouvre le projet « Partir pour… » dans « Nos projets ».
- **PR-02** **Le défi local** de chaque adresse (table `defis`): quand la réputation du café atteint son seuil et que l'extension où il se tient est ouverte, il se tient au prochain jour prévu (dimanche, ou jeudi de marché au bourg). Ce jour-là, l'affluence est de x1,6; le défi réussit toujours (c'est une fête), la renommée gagne sa prime et le livre d'or ses plus beaux mots.
- **PR-03** **L'extension du défi** passe en tête des achats proposés par la tablette dès que la lettre de l'adresse suivante est arrivée.
- **PR-04** **Le déménagement**: quand l'offre est là, le défi tenu et la tirelire suffisante, le duo choisit de partir (accord des deux); il part le lundi suivant. Rien ne presse: on peut rester aussi longtemps qu'on veut. L'ancien café devient une succursale (SU-01).
- **PR-05** **Recettes** (table `recettes`): connues au départ; fiches du catalogue (20 à 80 €); offertes par un habitué à un niveau de lien; apportées par une machine (presse-agrumes: le jus pressé); découvertes de saison (offertes par un fournisseur le premier jour de la saison, si l'adresse convient); propres à une adresse (le brunch arrive avec l'atelier, notre mélange avec la torréfaction).
- **PR-06** **Équipement**: chaque poste a trois niveaux (à la main, machine, machine avancée, table `postes`); chaque adresse s'équipe à neuf (le café quitté garde ses machines); la table `achats` donne le catalogue des machines et leurs effets.
- **PR-07** **Extensions**: deux ou trois par adresse (table `extensions`), commandées sur la tablette, construites le lundi suivant.
- **PR-08** **La fin de l'histoire**: à la maison parisienne, quand la réputation atteint 4,5 tasses et que la verrière restaurée, la mezzanine, le laboratoire et la torréfaction sont ouverts, le Guide de la Tasse passe incognito dans la semaine (un client au carnet de cuir qui revient chaque jour); le lundi suivant, la lettre annonce la Tasse d'or, et la fête de la maison réunit les habitués de toutes les adresses.
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
- **SV-08** **Progression commune** (F09): `progress` = projets réalisés / projets de « Nos projets » dans la version installée, affichée « Nos projets: 23 sur 64 ». Raison, plutôt que la formule par adresse proposée par l'architecte: elle continue de monter dans le jeu libre, ne reste jamais à 1 tant qu'il reste quelque chose à faire, et dit en mots ce que le duo a accompli. Quand une version ajoute des projets, le total grandit.

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
| à remplir |

**Adresses** (village et bourg: plans du level designer; ville et Paris: hypothèses, sous les plafonds de l'architecte)

<!-- table:adresses -->
| à remplir |

**Équipement fourni à l'arrivée** (compris dans l'installation)

<!-- table:depart -->
| à remplir |

**Extensions**

<!-- table:extensions -->
| à remplir |

**Flux de base** (groupes intéressés par jour, à attrait 1, jour ordinaire, temps couvert)

<!-- table:flux -->
| à remplir |

**Poids horaires** (ramenés aux heures d'ouverture de l'adresse)

<!-- table:courbes -->
| à remplir |

**Jours de la semaine** (multiplicateurs; le jour de marché s'ajoute)

<!-- table:jours -->
| à remplir |

**Météo** (probabilités par saison, terrasse, multiplicateurs par profil)

<!-- table:meteo -->
| à remplir |

**Saisons** (multiplicateurs par profil)

<!-- table:saisons -->
| à remplir |

**Attrait**

<!-- table:attrait -->
| à remplir |

**Satisfaction, pourboires, livre d'or**

<!-- table:satisfaction -->
| à remplir |

**Réputation** (points cumulés par café pour chaque demi-tasse)

<!-- table:reputation -->
| à remplir |

**Défis et fin de l'histoire**

<!-- table:defis -->
| à remplir |

**Postes** (places simultanées par niveau)

<!-- table:postes -->
| à remplir |

**Gestes autour des commandes**

<!-- table:gestes -->
| à remplir |

**Employés**

<!-- table:employes -->
| à remplir |

**Équipe du duo simulé** (conduite de la simulation, pas une règle)

<!-- table:equipe -->
| à remplir |

**Ambiance achetée** (paliers de la simulation, AM-01)

<!-- table:ambiance -->
| à remplir |

**Duos simulés** (hypothèses à recaler au prototype, CA-58)

<!-- table:duos -->
| à remplir |

**Divers**

<!-- table:divers -->
| à remplir |

### 4.21 Simulation

Un script en Python, bibliothèque standard, graines fixes: `docs/jeux/cosy-cafe/simulations/cosy_cafe.py`. Résultats complets: `docs/jeux/cosy-cafe/simulations/resultats.md`.

- **Ce qu'il fait**: chaque journée ouverte est une simulation à événements discrets, client par client: arrivées selon l'attrait (AT-07), entrée ou renoncement (CL-02, CL-03), commande, chaque étape de chaque recette à son poste, service, séjour, recommandes, départ, débarrassage, plonge; deux joueurs et les employés prennent les tâches par priorités. Entre les journées: achats, embauches, épargne, offres, défis, déménagements, succursales. <!-- val:parties -->120 parties (40 par duo), soit environ 15 000 journées jouées client par client.
- **Commandes**, depuis la racine du dépôt: `python3 -I docs/jeux/cosy-cafe/simulations/cosy_cafe.py --resultats docs/jeux/cosy-cafe/simulations/resultats.md` (environ 5 minutes); `--croise docs/jeux/cosy-cafe/cahier-des-charges.md` (moins d'une seconde) compare chaque table de ce cahier aux données du script et aux résultats, vérifie que les résultats correspondent aux données (empreinte), et sort en erreur au premier écart; `--tableaux` réimprime les tables; sans option, un résumé de la progression.
- **Hypothèses**: les trois duos (table `duos`) et la conduite du duo simulé (ordre d'achat, embauches, épargne) sont des suppositions raisonnables, à recaler au prototype (CA-58). Non simulés: options de commande (CO-08), traits des employés (sauf la vitesse), ruptures de stock (le duo commande assez), événements de saison au-delà des multiplicateurs, dessin sur le lait, brocante.

**Progression** (jour du jeu et heures réelles à chaque arrivée, médiane, entre crochets le premier et le neuvième décile)

<!-- table:res_progression -->
| à remplir |

Lectures: le duo médian passe trois semaines dans chacune des quatre premières adresses et cinq à la maison parisienne; il arrive à Paris après <!-- val:arr_h_paris-quartier_median -->18,4 h et fête la maison après <!-- val:fin_h_median -->36,4 h, soit <!-- val:seances_median -->55 séances de 40 minutes. On déménage le lundi: les écarts entre duos se comptent en semaines. Un duo tranquille met <!-- val:fin_h_lent -->56,2 h, surtout parce que ses journées sont plus longues (préparation et fermeture flâneuses) et que son épargne vient plus lentement.

**Ce qui décide de chaque départ** (part des parties où la dernière condition remplie était celle-ci)

<!-- table:res_blocage -->
| à remplir |

Lectures: au village, c'est la réputation du défi qui fixe le départ du duo médian; au bourg, l'épargne pour l'atelier; en ville, la réputation; à Paris, l'une ou l'autre. L'offre n'est jamais ce qui retient: la lettre arrive toujours avant que le duo soit prêt.

**Le service, à la main puis avec machines, puis avec employés** (duo médian, six premières et six dernières journées à chaque adresse)

<!-- table:res_service -->
| à remplir |

Lectures: au village, les deux joueurs sont occupés à 58 % la première semaine et 77 % la dernière; le coup de feu est tendu (un groupe sur dix repart aux heures de pointe, faute de place) mais tenable (44 s d'attente en moyenne). À chaque adresse, la dernière semaine sert plus de monde que la première avec une charge des joueurs presque égale: machines et employés absorbent la croissance. Les dimanches de la maison parisienne sont de vrais coups de feu, jusqu'au plafond de 120 personnages.

**Ce que l'équipe change**

<!-- table:res_sans_employes -->
| à remplir |

Lecture: à deux seulement, l'atelier refuse <!-- val:equipe_ville_sans -->65 % de ses groupes et la maison parisienne <!-- val:equipe_paris-maison_sans -->70 %; les employés ne remplacent pas les joueurs, ils rendent les grandes adresses possibles.

**Une journée moyenne, par adresse** (duo médian)

<!-- table:res_economie -->
| à remplir |

**Argent à l'arrivée**

<!-- table:res_epargne -->
| à remplir |

**Réglages du duo** (un duo tranquille, sa dernière configuration)

<!-- table:res_aides -->
| à remplir |

Lecture: au bourg, le rythme paisible et la patience grande ensemble font passer les groupes repartis de <!-- val:aides_bourg_normal -->15 % à <!-- val:aides_bourg_les_deux -->5 %, contre un service réel de 14,4 minutes au lieu de 11,5.

**Personnages présents et plafonds de l'architecte**

<!-- table:res_presence -->
| à remplir |

**Profils horaires** (un dimanche de la dernière semaine au village; un mardi de la dernière semaine à la maison parisienne)

<!-- table:res_heures_village -->
| à remplir |

<!-- table:res_heures_maison -->
| à remplir |

**Rythme réel**

<!-- table:res_rythme -->
| à remplir |

Lecture: une journée ouverte du duo médian dure <!-- val:journee_median_min -->21 minutes réelles; une séance de 40 minutes en fait près de deux. Aucun duo simulé n'a jamais eu de somme à régler (<!-- val:a_regler -->0 partie sur 120).

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
| Aménagement (poser, tourner, ranger) | B (`KeyB`); tourner: A et E (`KeyQ`, `KeyE`) en mode aménagement | molette pour tourner |
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
| Pourboire | les pièces tombent dans la tirelire du comptoir | tintement des pièces (un plus beau pour un gros pourboire, son.md) |
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
