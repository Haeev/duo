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

  Lecture: à 8 h, une heure et demie de clients attendus parmi les pressés, un peu plus d'un parmi les voisins; au goûter, les gourmands ne trouvent qu'une envie secondaire et pas de pâtisserie: écrire « tarte du jour » sur l'ardoise leur ferait gagner 3 points (x0,75 vers x1,1).
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
