# Cahier des charges: La Petite Ligne (titre provisoire)

| Champ | Valeur |
|---|---|
| Identifiant | `jeu-1` (provisoire: l'identifiant définitif suivra le titre retenu) |
| Statut | brouillon |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |
| Rédaction | game-designer (sections 1 à 6, 11, proposition de la section 12); sections 7 à 10 à compléter par leurs responsables |
| Documents liés | piste A et décisions du client: `docs/jeux/jeu-1/pistes-concept.md`; simulations: `docs/jeux/jeu-1/simulations/`; plateforme: `docs/plateforme/cahier-des-charges.md` (F05 à F09, F13), `docs/plateforme/architecture.md` (section 14) |

> Mode d'emploi: copier ce modèle dans `docs/jeux/<id-du-jeu>/cahier-des-charges.md`. Chaque section indique ses responsables. Le manager consolide, le client valide. Une fois validé, ce document est le contrat: toute modification passe par le manager et s'inscrit dans l'historique (section 15).

## En bref

- **Le jeu**: une vie à deux au bout d'une petite ligne de train qui rouvre. Chacun mène sa journée à son rythme (potager, bêtes, bois, cuisine, pêche), le samedi le train apporte une commande à remplir ensemble, du courrier et des visiteurs, et chaque chantier commun rouvre une gare de plus dans la vallée.
- **Version 1**: deux gares (la Halte d'Aubrune, les Vergers) et la voie qui les relie, cinq métiers aux rangs 1 à 3, dix habitants, vingt cultures et quatre arbres fruitiers, trois sortes de bêtes, trente recettes, quatre fêtes, une année de jeu. L'histoire des deux chapitres se termine en 16 h pour un duo médian (de 14 h à 20 h selon les duos), l'année complète dure 23 h.
- **Jeu complet**: quatre épisodes d'une gare chacun et du contenu au long cours, soit 100 h recalculées (section 4.17).
- **Sans punition**: rien ne meurt, rien ne se perd, rien ne compare les deux joueurs; le monde ne bouge que quand vous jouez à deux.
- **Changements par rapport à la piste A** (question Q3): Artisanat et Cheminot passent aux épisodes, 24 plantes au lieu de 30, croisement des semences reporté. Raison: une version 1 réaliste pour un studio qui produit tout par le code, avec moins de systèmes mais chacun complet.
- **Titre**: aucun jeu, film, livre ni marque connus sous « La Petite Ligne » (section 1.1). Quatre questions pour le client (section 14).
- **Démo d'une heure, livrée en premier** (priorité du client): la première semaine, du train du samedi au train du samedi suivant, décrite dans `docs/jeux/jeu-1/demo.md`.

## 1. Résumé (game-designer)

- **Pitch**: à deux, installez-vous au bout d'une petite ligne de train qui rouvre et faites revivre la vallée gare après gare: votre ferme, votre maison, vos métiers et vos voisins.
- **Fantasme du joueur**: « On se construit une vie à deux, à notre rythme, et chaque samedi le train nous ramène du monde, des nouvelles et de quoi rêver plus grand. »
- **Genre**: simulation de vie et de ferme en coopération.
- **Vue**: 3D aux formes simples (low poly), vue isométrique à caméra orthographique, quatre orientations par quarts de tour, trois niveaux de zoom, murs et toits coupés quand on entre. À confirmer par l'essai de style (directeur-artistique, tech-artist, architecte-technique). Aucune règle ne dépend de la vue: tout se joue sur une grille de cases d'un mètre, découpée en zones; une vue isométrique en sprites 2D suivrait les mêmes règles.
- **Mode à deux**: coopération, avec une asymétrie douce (chaque métier voit ce que l'autre ne voit pas). Manifeste: `mode: coop`, résultat `progress`.
- **Durée d'une partie**: séance libre de 10 à 45 minutes, que l'on quitte à tout moment sans rien perdre. Une journée de jeu dure 16,6 minutes réelles en moyenne, une séance de 40 minutes en fait 2,4.
- **Piliers**:
  1. **Deux vies qui s'entrelacent**: chacun son rythme et son métier, des rendez-vous qui donnent envie d'être ensemble (la commande du samedi, les gestes à deux, la veillée).
  2. **La vallée revit grâce à nous**: chaque samedi apporte du nouveau, chaque chantier change le paysage, chaque gare rouverte agrandit le monde.
  3. **Rien ne se perd**: pas de combat, pas de mort, pas d'échec; une erreur ou une absence coûte au plus un peu de temps.

### 1.1 Titre et vérification d'homonymie

Recherche web du 2026-10-30, requêtes en français et en anglais (jeux vidéo, dont des requêtes ciblant Steam et itch.io; films, livres, séries; marques et commerces; associations et trains touristiques):

- aucun jeu, film, livre, série ni marque connus sous le titre « La Petite Ligne »;
- titres voisins sans conflit: un podcast ferroviaire « Monsieur Petites Lignes », la Petite Ceinture de Paris, de nombreux « petits trains » touristiques;
- « petites lignes » est une expression courante (les lignes ferroviaires de campagne, sujet politique récurrent): le titre est libre, mais peu distinctif dans un moteur de recherche;
- un résumé automatique de recherche a évoqué, « de mémoire » et sans source, un petit jeu de casse-tête ferroviaire nommé « Petite Ligne »: aucune page de boutique ne l'a confirmé. À revérifier avant le titre définitif.

Titres de rechange, vérifiés par une recherche web du même jour (aucun résultat): « Samedi, le train », « Les Saisons d'Aubrune », « Le Train d'Aubrune ». « Aubrune » seul ne renvoie à aucune œuvre ni à aucun lieu connu (les rivières Aube, Aubette et Aubance sont proches, sans confusion possible). Décision: question Q1.

### 1.2 Ce qui le distingue des jeux de référence

Le client a cité deux jeux connus comme références de genre (un jeu de vie paisible sur une île, un jeu de simulation de vie). On garde le genre et l'intention; on écarte leurs signes reconnaissables:

- une vallée qu'on remonte en train, pas une île ni une terre vierge: la progression est géographique et ferroviaire, chaque épisode ajoute une gare;
- des habitants humains écrits, dont la vie change; aucun voisin animal qui parle, aucune langue inventée en charabia;
- on finance des chantiers collectifs avec le village; aucune dette envers un commerçant;
- le temps n'avance que quand on joue à deux; aucune horloge réelle;
- trois besoins lus sur le visage et dans le carnet; ni tableau de jauges, ni symbole flottant au-dessus des têtes;
- on construit de ses mains, sur un chantier, en portant les poutres à deux; pas d'éditeur payé en argent;
- les métiers se pratiquent à l'écran; personne ne disparaît « au travail »;
- pas de ferme héritée par une lettre, pas de bâtiment communautaire restauré par dépôt de lots d'objets, pas de mine à étages, pas de musée de collections; les oiseaux s'observent et restent libres;
- le couple est au centre: gestes à deux, envies à deux, veillée commune, aucune romance avec les habitants.

### 1.3 Changements par rapport à la piste A

| Piste A (pistes-concept.md, A8) | Ce cahier | Raison |
|---|---|---|
| Six métiers aux rangs 1 à 3, plus Cheminot au chapitre 2 | Cinq métiers aux rangs 1 à 3; Artisanat (poterie, tissage) à l'épisode Lac-Clair, Cheminot à l'épisode La Tourbière | deux systèmes de moins à produire, tester et équilibrer; la voie se rouvre quand même au chapitre 2, par la draisine et les gestes à deux |
| 30 cultures | 20 cultures et 4 arbres fruitiers | chaque plante demande un modèle à cinq stades et une ligne d'équilibrage; 24 suffisent à quatre saisons variées |
| Croisement des semences et conservatoire | reportés à l'épisode La Tourbière | système profond qui mérite son épisode; la profondeur du potager tient en version 1 par le sol, les rotations et la qualité |
| 22 heures | histoire en 16 h (duo médian), année complète en 23,3 h | heures recalculées par simulation (section 4.17) |

Ces changements sont soumis au client (question Q3).

## 2. Expérience à deux (game-designer)

### 2.1 Rôles

- Aucun rôle imposé. Les deux personnages savent tout faire à un niveau de base: bêcher, semer, nourrir les bêtes, couper du bois, cuisiner, pêcher, construire.
- Chacun choisit un **métier principal** parmi cinq: Maraîchage, Élevage, Bois et charpente, Cuisine et conserverie, Pêche et cueillette. Le métier principal progresse deux fois plus vite, monte jusqu'au rang 3 (les autres s'arrêtent au rang 2) et donne le **regard du métier** (section 4.5). On en change au début de chaque saison, sans rien perdre.
- **Pot commun**: une bourse, un cellier, un carnet. Chacun a son propre sac.
- **Interdépendance**: les fabrications croisent les métiers. La maison demande les planches du bois, la soupe les légumes du potager, le fromage le lait des chèvres, le chantier de la gare tous les métiers à la fois. Un joueur seul avance, deux joueurs qui se complètent vont deux fois plus loin.
- Les deux peuvent être dans deux gares différentes; chaque écran suit son propre personnage.

### 2.2 Ce que montre chaque écran

| Information | Chez les deux | Chez un seul |
|---|---|---|
| Heure, jour, saison, météo du jour | oui | |
| Météo du lendemain (le poste à galène, au souper) | oui | |
| Météo à deux jours, heure exacte de la pluie, aléa du surlendemain | | métier principal Pêche et cueillette |
| Vigueur exacte du sol, famille à planter ensuite | une terre très fatiguée (vigueur sous 30) paraît grise chez tous | Maraîchage |
| Ce que veut chaque bête, son amitié | | Élevage |
| Usure des bâtiments, arbres mûrs pour la coupe | | Bois et charpente |
| Goûts de chaque habitant, son plat du jour | | Cuisine et conserverie |
| Bancs de poissons, cueillettes cachées sous les feuilles | | Pêche et cueillette |
| Son envie du jour | | chacun la sienne; l'envie à deux s'affiche chez les deux |
| Forme du jour: expression du portrait | les deux portraits | la phrase du carnet n'est que chez soi |
| Aides réglées | | chacun les siennes, invisibles pour l'autre |
| Bourse, cellier, commande, carnet, plan de la maison | oui | |
| Courrier | lettres adressées aux deux | lettres d'un habitant à l'un des deux |
| Où est l'autre et ce qu'il fait | indicateur du HUD (« Sacha pêche à l'étang ») et carte | |

### 2.3 Ce qui pousse à se parler

1. **La commande du samedi**: quatre à sept lignes, réparties sur trois métiers au moins, à livrer avant le départ du train. Il faut se répartir le travail: « Je fais les œufs et le pain, tu t'occupes des truites ? »
2. **Le regard du métier**: « Le champ du haut est fatigué, plantons des fèves » ne peut venir que du maraîcher; « Mme Ferrand adore la tarte aux pommes en ce moment » que du cuisinier; « Il pleut demain à 14 h, n'arrose pas » que du pêcheur.
3. **Les envies du jour**: personne ne voit celle de l'autre. « Tu as envie de quoi, aujourd'hui ? » est la première phrase de la journée.
4. **Les gestes à deux**: porter une poutre, lever une charpente, pomper la draisine, danser au bal. Ils demandent d'être côte à côte et de se coordonner à la voix (« à gauche ! »), sans aucune adresse.
5. **Les gros achats et les réglages du monde**: ils demandent l'accord des deux.
6. **Le repère**: on peut planter une épingle visible chez l'autre (« viens voir ici »), utile quand on n'est pas dans la même gare.

### 2.4 Deux niveaux différents

- **Des métiers d'exigence différente**: Pêche et cueillette, Élevage sont contemplatifs et pardonnent tout; Maraîchage (sol, rotations, qualité) et Bois et charpente (plans, chantiers) récompensent l'optimisation. Chacun prend celui qui lui va.
- **Des aides propres à chaque joueur**, invisibles pour l'autre (section 4.3): endurance généreuse, arrosage assisté, ferrage facile, plans tout faits, guide vers l'objectif.
- **Des réglages du duo**, décidés à deux: rythme de la journée, taille de la commande du samedi.
- **Des rattrapages automatiques**: le village donne un coup de main aux chantiers qui durent, un habitant vient à votre rencontre quand son lien est la dernière chose qui bloque un chapitre, les collections favorisent les entrées manquantes.
- **Rien ne compare les joueurs**: tout va au pot commun, l'historique et la progression ne retiennent que des faits partagés, le samedi célèbre le duo.
- Aucune action ne demande de réflexe: pas de chronomètre serré, une fenêtre de ferrage généreuse (1,5 s, 3 s avec l'aide), des gestes à deux qui ne peuvent pas rater.

### 2.5 Aucun temps mort subi

| Situation | Ce que fait celui qui attend |
|---|---|
| L'autre parle longuement à un habitant ou lit son courrier | l'horloge tourne pour les deux: chacun continue sa journée |
| Une scène d'histoire à deux attend au point de rendez-vous | elle attend aussi longtemps qu'il faut; on la déclenche quand les deux y sont, sans fenêtre horaire qui se perdrait |
| L'un se couche avant l'autre | au lit, le carnet reste ouvert: plan de la maison, carte, commande, préparation du lendemain; on peut se relever à tout moment |
| L'un s'absente du clavier | après 3 minutes, l'horloge s'arrête et attend; l'autre peut continuer à agir tant qu'il lui reste de l'endurance (section 4.13) |
| Création des personnages | chacun crée le sien en même temps; celui qui finit le premier voit l'aperçu de l'autre et lit la lettre de la coopérative |
| Petit-déjeuner | chacun le quitte quand il veut, l'horloge part dès que l'un sort |
| Trajet entre les deux gares | 24 secondes par le sentier, 8 secondes en draisine |

## 3. Boucles de jeu (game-designer)

- **Boucle de 30 secondes**: biner, semer et arroser trois cases; ramasser les œufs; poser deux planches sur le chantier; échanger deux mots avec une voisine; lancer sa ligne. Chaque geste a son retour visuel et sonore (section 5.2), et presque chaque geste remplit le sac.
- **Boucle d'une journée** (16,6 minutes en moyenne): au petit-déjeuner, chacun découvre sa forme et son envie, et le maraîcher ou le pêcheur annonce le temps. Le matin, soins et récoltes. Le jour, travail de métier, livraisons à la caisse de la halte, une annonce ou un service au village. À partir de 19 h, la veillée, horloge arrêtée: le souper partagé (qui fait la forme du lendemain), la décoration, les plans, l'établi, le courrier. La journée finit quand les deux se couchent; l'écran de nuit propose de continuer ou de finir la séance.
- **Boucle d'une semaine** (sept journées, 1 h 56): le samedi, le train. Il arrive à 10 h avec le courrier, les colis du catalogue et un à trois visiteurs; il repart à 16 h avec la commande. C'est le pouls du jeu.
- **Boucle d'une saison** (21 journées, 5,8 h): trois samedis, une fête le 16e jour, des cultures et des cueillettes propres à la saison, un changement possible de métier principal.
- **Boucle d'un chapitre** (une gare): rencontrer ses habitants, réunir la confiance de la coopérative, mener le chantier collectif, fêter l'inauguration. Chapitre 1: trois semaines; chapitre 2: environ cinq semaines (duo médian).
- **Long terme**: la maison qui grandit, les liens avec les habitants et leurs histoires, les rangs de métier, le carnet de la vallée, puis les gares des épisodes suivants.
- **Entre les séances**: le monde est figé. On le retrouve à la minute près, quelle que soit la machine qui héberge.

Comprendre le but en moins d'une minute: la première scène (Firmin sur le quai, les clés de la maisonnette) le dit en trois phrases (« La ligne rouvre. Faites revivre la halte, et le train ira plus loin. Le premier samedi, on compte sur vous. »), et le carnet affiche toujours le prochain objectif.

## 4. Règles (game-designer)

Les règles sont numérotées pour la recette (préfixe par système). « Le duo » désigne les deux joueurs ensemble; « un joueur » suffit quand l'un des deux suffit.

### 4.1 Entités et états

| Entité | États et données |
|---|---|
| Monde (un par emplacement de sauvegarde, trois emplacements) | date (année, saison, jour, heure, minute), météo du jour et du lendemain, aléa annoncé, réglages du duo, bourse, cellier, confiance, chapitre et étapes, carnet |
| Personnage (deux) | identifiant du joueur, prénom, apparence, deux traits, position (zone, case, orientation), endurance, Ventre, Sommeil, Cœur, forme, métier principal, expérience et rang de chaque métier, spécialités, sac, outils et leurs niveaux, aides, envie du jour, état: actif, en menu, en conversation, en scène, en geste à deux, absent, couché |
| Zone | La Halte d'Aubrune, La voie des Vergers, Les Vergers, intérieurs; chaque zone porte ses cases, objets, arbres, bâtiments, bêtes |
| Case (1 m) | sol (herbe, friche, bêchée, chemin, construit), vigueur 0 à 100, dernière famille récoltée, culture, stade, jours de pousse, arrosée ce jour, engrais, série de soins |
| Culture | espèce, stade (graine, pousse, jeune, adulte, mûre), saison, prête à récolter, hors saison (en attente) |
| Bête | espèce, nom, amitié 0 à 1000, nourrie ce jour, produit ce jour |
| Bâtiment | plan (éléments posés en fantôme), avancement de chaque élément, pièces reconnues, coin à soi de chaque joueur |
| Habitant | lien du duo 0 à 1000, étape de son histoire 0 à 5, emploi du temps, cadeaux reçus cette semaine, souvenirs (qui a fait quoi) |
| Visiteur | modèle, demande, jour de départ |
| Commande | lignes (produit, quantité, qualité minimale, livré), samedi d'échéance |
| Chantier collectif | matériaux requis et apportés, points de travail requis et faits, gestes à deux faits, jour d'ouverture |
| Proposition | gros achat ou réglage du duo en attente de l'accord de l'autre |

### 4.2 Le temps

- **TE-01** L'horloge est partagée: les deux joueurs vivent la même heure. Une minute de jeu dure 0,8 s réelle (réglage du duo « Rythme paisible »: 1,0 s).
- **TE-02** La journée commence à 6 h. La semaine commence le samedi: le jour 1 du monde est un samedi, et chaque saison commence un samedi (21 jours, trois semaines). L'année compte quatre saisons: printemps, été, automne, hiver.
- **TE-03** L'horloge s'arrête quand: les deux joueurs sont à la fois dans un menu, une conversation ou une scène; une scène d'histoire est en cours; c'est la veillée (TE-06); un joueur est absent (PA-04); la plateforme a mis la partie en pause (Échap, déconnexion). Elle tourne dans tous les autres cas, y compris quand un seul joueur est dans un menu.
- **TE-04** Le petit-déjeuner (6 h): écran de chacun avec sa forme, son envie, le temps du jour et le courrier arrivé. L'horloge reste à 6 h 00 jusqu'à ce que l'un des deux commence sa journée.
- **TE-05** Les trains: le samedi, le train arrive à la halte à 10 h et repart à 16 h. Son sifflet s'entend dans toute la vallée.
- **TE-06** La veillée: dès 19 h, si les deux personnages sont dans la maison, l'horloge s'arrête et la veillée commence. On peut y cuisiner, manger, décorer, dessiner les plans, fabriquer à l'établi, lire le courrier, sans limite de temps. Si l'un ressort, l'horloge repart.
- **TE-07** Le coucher: un joueur se couche en allant au lit. Celui qui s'est couché peut se relever à tout moment. La journée finit quand les deux sont couchés: l'écran de nuit apparaît chez les deux (PA-08), puis vient le petit-déjeuner du lendemain.
- **TE-08** Minuit: un personnage encore dehors à 24 h rentre seul à la maison (« Il se fait tard, tu rentres par le sentier. ») et dort moins bien (Sommeil -30). La veillée reste possible après ce retour.
- **TE-09** Le monde n'avance jamais hors des séances jouées à deux: aucune horloge réelle, aucun temps qui passe entre deux séances.
- **TE-10** Les fêtes ont lieu le 16e jour de chaque saison (un dimanche), de 10 h à 22 h. Les inaugurations ont lieu le dimanche qui suit l'achèvement d'un chapitre (HI-03).

### 4.3 Personnages, besoins et forme

- **PE-01** Création: chaque joueur crée son personnage sur sa machine, en même temps que l'autre: prénom (1 à 16 caractères, le pseudo Duo par défaut), apparence (gabarit, visage, coiffure, couleurs de peau, de cheveux et de tenue; aucun choix de genre), deux traits différents, un métier principal. Le foulard du personnage porte la couleur et le symbole du profil Duo du joueur.
- **PE-02** Traits (choisis à la création, modifiables au début de chaque saison):

| Trait | Effet |
|---|---|
| Bonne fourchette | le Ventre compte double dans la forme; un dessert donne Cœur +5 |
| Craint le froid | en hiver et les jours de pluie, Cœur -10 sauf si la maison a un poêle allumé; un plat chaud compte double au Ventre (plafonné à 100) |
| Lève-tôt | Sommeil +10 si couché avant 22 h |
| Couche-tard | pas de pénalité de Sommeil au retour de minuit |
| Langue bien pendue | les conversations comptent double au Cœur |
| Tête dans les nuages | la beauté de la maison et les oiseaux observés comptent double au Cœur |
| Nid douillet | le confort de la maison et du coin à soi compte double au Cœur |
| Nez au vent | chaque nouvelle page du carnet donne Cœur +5 (au lieu de +2) |

  Lève-tôt et Couche-tard ne se combinent pas.
- **PE-03** Trois besoins, de 0 à 100, jamais affichés en jauges: ils se lisent sur l'expression du portrait (cinq expressions) et dans une phrase du carnet (« Tu as mal dormi: le lit grince et le vent passe sous la porte. Un vrai matelas, peut-être ? »).
  - **Ventre**, fixé par le souper: aucun souper 30, plat simple 60, dessert seul 50, mijoté 80, souper complet (un mijoté et un dessert, ou un plat de qualité superbe) 100.
  - **Sommeil**, fixé par le lit et l'heure: paillasse 50, lit 70, lit avec matelas 85, avec matelas et édredon 100; retour de minuit -30.
  - **Cœur**, recalculé chaque nuit: 40, plus le confort de la maison (0 à 20), plus les moments de la journée (envie réalisée +15, envie à deux réalisée +25 chacun, geste à deux +10 une fois par jour, souper partagé +5, conversation +5 jusqu'à 15, cadeau reçu de l'autre +10, nouvelle page du carnet +2), plafonné à 100.
- **PE-04** Forme du matin = 0,35 Ventre + 0,35 Sommeil + 0,30 Cœur (un trait qui fait compter double un besoin double son poids, puis les poids sont ramenés à 1). Cinq niveaux, aux noms épicènes: Petite forme (moins de 40), Ça va (40 à 59), En forme (60 à 79), Pleine forme (80 à 94), Forme rayonnante (95 et plus).
- **PE-05** Endurance du jour = 80 + 0,4 x forme, soit de 80 à 120 points. La plus mauvaise forme ne retire que 20 % à une journée moyenne. Forme rayonnante: en plus, le premier coup de chaque outil ne coûte rien pendant la matinée.
- **PE-06** Chaque action a un coût d'endurance (section 4.16). À 0, on n'est jamais bloqué: les actions prennent deux fois plus de temps (« Plus d'énergie: tout prend deux fois plus de temps. Un en-cas ? »). Exception pendant une absence de l'autre (PA-04).
- **PE-07** Manger un en-cas rend de l'endurance (pain +10, plat simple +20, dessert +25, mijoté +35), sans changer le Ventre du soir.
- **PE-08** Aides de chaque joueur, réglées dans son carnet, invisibles pour l'autre, modifiables à tout moment: Endurance généreuse (endurance x1,5); Arrosage assisté (l'arrosoir arrose 3x3 cases dès le niveau 1); Ferrage facile (fenêtre de ferrage de 3 s); Plans tout faits (huit modèles de pièces prêts à poser); Guide (chemin tracé vers le prochain objectif). Aucune aide ne retire quoi que ce soit au duo.
- **PE-09** Les personnages ne se bloquent pas entre eux ni avec les habitants: ils se traversent.
- **PE-10** Sac de 24 cases, piles de 99 par objet et par qualité. Un objet qui ne rentre pas tombe au sol à côté du personnage. Un objet au sol ne disparaît jamais; s'il reste trois jours hors de la ferme, Lucie le rapporte au cellier (« Lucie a rapporté ce que vous aviez oublié au bord de l'Aubrune. »).
- **PE-11** Donner à l'autre: agir sur l'autre personnage avec un objet en main fait passer la pile dans son sac (au sol à ses pieds s'il n'a pas la place).

### 4.4 Ferme

- **FE-01** Le potager de départ compte 24 cases bêchables autour de la maisonnette (6x4). On l'agrandit en défrichant (3 points d'endurance par case) jusqu'à 96 cases à la Halte. Aux Vergers, le duo reçoit un lopin de 48 cases et un verger en terrasses de 12 places d'arbres (étape 2.4). La serre (chapitre 2) ajoute 8 cases.
- **FE-02** Une culture se sème sur une case bêchée, en saison. Elle pousse d'un jour chaque matin si elle a été arrosée la veille (la pluie arrose toutes les cases dehors). Non arrosée, elle attend sans dépérir.
- **FE-03** Hors saison, une culture ne pousse plus; elle attend sa saison suivante. L'arracher rend sa graine (100 %). Rien ne meurt au changement de saison.
- **FE-04** Récolter une culture mûre la met dans le sac (rendement de la section 6.4). Les cultures à repousse restent en place et redonnent tous les N jours tant qu'elles sont en saison. Le fraisier est vivace: il repart chaque printemps sans être resemé.
- **FE-05** Vigueur du sol, de 0 à 100 par case: 60 à la première bêche. Chaque récolte consomme selon la famille (Racines -15, Verdures -10, Fruits -20, Fleurs -5) et la divise par deux si la famille diffère de la précédente sur cette case (rotation). Les Légumineuses rendent +20. Une case vide regagne +1 par jour. Un engrais (du composteur: cinq déchets de récolte ou un fumier) rend +25.
- **FE-06** Qualité, déterministe (aucun hasard): score de soin = vigueur au semis + 20 si la culture a été arrosée chaque jour de sa pousse + 15 si elle a reçu un engrais au semis (+10 avec le rang 3 de Maraîchage). Ordinaire sous 75, belle de 75 à 109, superbe à partir de 110. Prix: x1, x1,5, x2.
- **FE-07** Bêtes. Poules (Halte, chapitre 1): un œuf par jour si elles sont nourries (grain: deux sous par poule et par jour, ou du blé). Chèvres (Vergers, chapitre 2): un pot de lait par jour, à traire; elles broutent dans leur enclos du printemps à l'automne, mangent du foin l'hiver (quatre sous par chèvre et par jour). Ruches (Vergers, chapitre 2): un pot de miel tous les quatre jours du printemps à l'automne, x1,5 si des fleurs (bleuets, tournesols, arbres en fleur) poussent à 10 m. Amitié de 0 à 1000 (caresser +10 par jour, nourrir +5): produits beaux à 300, superbes à 700. Une bête non nourrie ne produit pas ce jour-là; c'est tout. Aucune bête ne tombe malade, ne meurt, ne fuit pour de bon ni n'est abattue.
- **FE-08** Arbres fruitiers (Vergers): un plant acheté à Hélène, planté dans le verger, porte au bout de 14 jours; en sa saison, il donne 6 fruits tous les 2 jours. Vivace, il ne meurt jamais.
- **FE-09** Météo par saison (soleil, nuages, pluie, orage, neige), tirée la veille avec la graine du monde et annoncée au souper par le poste à galène:

| Saison | Soleil | Nuages | Pluie | Orage | Neige |
|---|---|---|---|---|---|
| Printemps | 45 % | 25 % | 30 % | 0 % | 0 % |
| Été | 60 % | 20 % | 10 % | 10 % | 0 % |
| Automne | 35 % | 30 % | 30 % | 5 % | 0 % |
| Hiver | 30 % | 30 % | 10 % | 0 % | 30 % |

- **FE-10** Aléas doux, toujours annoncés la veille (le pêcheur les voit le surlendemain), au plus un par semaine et un de chaque sorte par saison, jamais un jour de fête ni d'inauguration:
  - Grêle (été, 25 % de chances par saison): les cultures et fruits sur pied non protégés par une cloche de verre perdent un cran de qualité sur leur prochaine récolte (jamais sous ordinaire).
  - Coup de sec (été, 25 %, trois jours): une case doit être arrosée avant et après midi pour pousser, sauf si elle est paillée.
  - Gel tardif (printemps, 20 %): les semis de moins de trois jours prennent un jour de retard, sauf sous paille ou sous cloche.
  - Orage (été et automne, selon la météo): arrose tout, les poissons mordent 1,5 fois plus vite, la draisine reste à la remise pendant les deux heures de l'orage.
  - Brouillard (automne, 20 %): jusqu'à 11 h, les oiseaux rares se montrent deux fois plus.
- **FE-11** Aucun outil ne détruit par erreur: la houe ne touche pas une culture, la hache ne touche que les arbres, la pioche que les pierres. Retirer une culture se fait à la main (« Arracher »), avec la graine rendue.

### 4.5 Métiers et regard du métier

- **ME-01** Cinq métiers, rangs 1 à 3 en version 1. Chaque action d'un métier donne de l'expérience (section 4.16); le métier principal en reçoit deux fois plus. Rang 2 à 600 points, rang 3 à 4000 points cumulés. Les métiers secondaires s'arrêtent au rang 2 et gardent leur expérience au-delà.
- **ME-02** Le métier principal se choisit à la création et se change au petit-déjeuner du premier jour de chaque saison, ou une fois par saison au tableau des métiers de la halte. Rangs, expérience et spécialités restent acquis.
- **ME-03** Effets des rangs:

| Métier | Rang 2 | Rang 3 | Spécialité au rang 3 (choix entre deux, modifiable chaque saison) |
|---|---|---|---|
| Maraîchage | semer et arroser coûtent moitié moins d'endurance | +10 au score de soin | Semencier: une récolte sur quatre rend sa graine, graines à moitié prix; ou Serriste: serre de 12 cases au lieu de 8, +1 cran de qualité sous serre |
| Élevage | amitié des bêtes x1,5 | une bête d'amitié 700 ou plus produit double un jour sur trois | Fromager: fromage affiné x1,5 en valeur et prêt un jour plus tôt; ou Apiculteur: miel tous les trois jours, deux ruches de plus |
| Bois et charpente | un coup de moins par arbre et par pierre (au moins un) | travail de chantier x1,5 | Charpentier: matériaux des chantiers collectifs -10 %; ou Ébéniste: meubles +1 confort et +1 beauté, essence noyer |
| Cuisine et conserverie | chaque recette donne une portion de plus | plats +1 cran de qualité, Ventre +10 au souper des deux | Cuisinier: les soupers comptent comme souper complet dès qu'un mijoté est servi; ou Conservier: bocaux, confitures et compotes x1,5 en valeur, conserverie deux fois plus rapide |
| Pêche et cueillette | fenêtre de ferrage +0,5 s, une cueillette sur quatre double | espèces rares x1,5 (poissons et oiseaux) | Pêcheur: une nasse qui prend un poisson par jour; ou Cueilleur: les cueillettes cachées se voient de deux fois plus loin, une sur deux double |

- **ME-04** Le regard du métier n'appartient qu'au métier principal, et seulement à l'écran de son joueur (tableau 2.2). Il passe par des teintes au sol, des contours, des animations des bêtes et le texte de l'action Examiner, jamais par un symbole au-dessus d'une tête. Si les deux joueurs ont le même métier principal, ils voient la même chose.
- **ME-05** Atteindre un rang: bannière et page du carnet chez le joueur concerné; chez l'autre, une ligne discrète (« Camille a atteint le rang 2 de Maraîchage. »). Rien ne s'inscrit à l'historique de la plateforme.

### 4.6 Économie, commande du samedi et confiance

- **EC-01** Monnaie: le sou. Bourse commune, jamais négative: un achat sans les fonds est refusé (« Il manque 40 sous. »). Ni dette, ni vol, ni amende.
- **EC-02** Vendre: l'épicerie de Mme Ferrand achète tous les jours à 80 % du prix de base, jusqu'à 300 sous par jour pour le duo; la caisse de la coopérative, sur le quai, achète tout ce qu'on y dépose à 100 %, payé au départ du train du samedi.
- **EC-03** Acheter: l'épicerie vend les graines de la saison, le grain, les clous, le pain; le catalogue de la coopérative (tableau de la halte) vend, dès le jour 1, tuiles, vitres et outils de niveau 2, puis un rayon de plus à chaque niveau de confiance (meubles, graines rares, accessoires de la maison, cloches de verre). Tout ce qui est commandé avant le vendredi 24 h arrive au train du samedi, dans le cellier. Nadia vend les outils de niveau 3 aux Vergers.
- **EC-04** Gros achat: tout achat de 500 sous ou plus (réglage du duo, de 100 à 2000, ou « jamais ») devient une proposition affichée chez l'autre (« Sacha propose d'acheter deux chèvres pour 1200 sous. D'accord ? »). La somme est réservée pendant l'attente. L'autre accepte ou refuse; le proposant peut retirer sa proposition; une proposition sans réponse s'annule à la nuit. Refuser ne coûte rien.
- **EC-05** La commande du samedi s'affiche au tableau de la halte au départ du train (samedi 16 h), pour le samedi suivant. La première est affichée le jour 1, pour le jour 8. Chaque ligne: un produit, une quantité (lot de la section 6.4, x(1 + 0,1 x niveau de confiance), x0,6 ou x1,4 selon le réglage du duo « taille de la commande »), une qualité minimale (à partir du niveau de confiance 3, une ligne sur trois demande « belle »).
- **EC-06** Nombre de lignes: 4 + (niveau de confiance divisé par 2, arrondi à l'entier inférieur), au plus 8, au moins 3.
- **EC-07** Composition (vérifiée par simulation, section 4.17): seuls les produits que le duo a déjà obtenus au moins une fois, et en saison pour les produits frais; aucun produit présent dans les deux commandes précédentes; deux lignes au plus par métier; trois métiers au moins tant que c'est possible; les métiers absents de la commande d'abord (poids 3 contre 1); un produit de la semaine précédente deux fois moins souvent. Si les candidats manquent, la commande compte moins de lignes, jamais moins de trois.
- **EC-08** Livrer: on dépose les produits dans la caisse de la halte n'importe quel jour; on peut les reprendre jusqu'au départ du train. Au départ (16 h): chaque ligne remplie est payée 1,5 fois le prix de base; une commande complète rapporte 25 % de plus; une ligne incomplète n'est pas payée en commande, mais ses produits sont achetés au prix de base; rien n'est perdu. Le récapitulatif arrive au courrier (« La coopérative a reçu 4 lignes sur 5: 412 sous. Merci ! »).
- **EC-09** Confiance de la coopérative: +1 point par ligne remplie, +2 pour une commande complète. Niveaux à 4, 9, 15, 24, 36, 50 et 66 points. Elle ne baisse jamais. Elle ouvre les chapitres (niveau 2 pour le chapitre 1, niveau 3 pour le chantier de la gare des Vergers) et les rayons du catalogue (EC-03).
- **EC-10** Petites annonces: le tableau de la halte en affiche trois au plus, renouvelées chaque matin (livraisons, réparations, recherches). N'importe quel joueur les accepte et les remplit pour le duo. Récompense: 60 à 200 sous et +50 de lien avec le demandeur. Une annonce non faite reste affichée sept jours, puis cède la place, sans conséquence.
- **EC-11** Réglages du duo (rythme de la journée, taille de la commande, seuil des gros achats, seuil d'absence): un changement devient une proposition chez l'autre, comme un gros achat (EC-04), et s'applique dès qu'il l'accepte; la taille de la commande vaut à partir de la commande suivante.

### 4.7 Maison, plan et chantiers

- **MA-01** La maison est un plan sur une grille de 14x12 cases, sur deux niveaux au plus (rez-de-chaussée et grenier aménageable). Au départ, la maisonnette compte une pièce de 5x4 cases au toit percé (étape 1.2).
- **MA-02** Le plan s'édite à deux, en même temps: chacun voit le curseur de l'autre à sa couleur. On pose des éléments (murs, sols, portes, fenêtres, escalier, meubles); ils apparaissent en fantôme, sans rien coûter. Le toit se calcule à partir des murs.
- **MA-03** Construire: un élément fantôme se bâtit en travaillant dessus (maintenir l'action) pendant sa durée, avec ses matériaux, pris dans le sac de celui qui travaille puis dans le cellier. Deux joueurs sur le même élément vont deux fois plus vite. Une poutre (portée de plus de 4 m) demande le geste à deux « porter ».
- **MA-04** Démolir un élément bâti rend 100 % de ses matériaux. Démolir un élément posé par l'autre est permis dans les parties communes; l'autre en est prévenu par une ligne discrète.
- **MA-05** Pièces reconnues (espace fermé par des murs, avec une porte, un sol et les meubles nécessaires): cuisine (fourneau et table: recettes mijotées et desserts), chambre (un lit: Sommeil), salle commune (table, deux chaises, poêle: confort +5 au Cœur des deux), atelier (établi: meubles et améliorations), cellier (deux étagères: conserverie), serre (murs et toit vitrés, plan offert à l'étape 2.7: 8 cases qui poussent en toute saison). Une pièce reconnue affiche son nom à la craie et remplit une page du carnet.
- **MA-06** Le coin à soi: chaque joueur désigne au plus une pièce ou une alcôve fermée d'au moins 2x2 cases comme « mon coin ». Seul son propriétaire y pose, déplace ou retire des objets, et modifie ses murs, portes et fenêtres. L'autre peut y entrer, regarder, et laisser un cadeau par jour sur un meuble; le propriétaire le découvre au petit-déjeuner (« Sacha t'a laissé un cadeau dans ton coin. »). Le confort du coin compte double dans le Cœur de son propriétaire. Désigner son coin remplit une page du carnet.
- **MA-07** Confort et beauté: chaque meuble a 0 à 5 points de confort et de beauté. Confort de la maison pour le Cœur = somme des points de confort des pièces reconnues, divisée par 10, plafonnée à 20.
- **MA-08** Chantiers collectifs: un panneau et une caisse sur le site affichent les matériaux attendus, les points de travail et les gestes à deux. N'importe quel joueur apporte des matériaux ou travaille; tout compte pour le duo. Coup de main du village: quand un chantier est ouvert depuis 10 jours (chapitre 1) ou 15 jours (chapitre 2), chaque samedi au départ du train les habitants apportent 15 % des matériaux restants, et chaque dimanche deux habitants viennent travailler (100 points). Ils le disent: « Les gens du bourg ont monté des tuiles pendant la nuit. »

### 4.8 Habitants, visiteurs, envies

- **HA-01** Chaque habitant a un lien avec le duo, de 0 à 1000, nourri par les deux joueurs: conversation +10 (une par joueur, par habitant et par jour), cadeau adoré +60, aimé +30, autre +10 (un par joueur, par habitant et par jour), annonce remplie +50, scène de son histoire +100. Le lien ne baisse jamais; un cadeau qui ne plaît pas reçoit un merci poli.
- **HA-02** Niveaux de lien à 100, 250, 450, 700 et 1000 (Connaissance, Voisinage, Amitié, Grande amitié, Comme la famille). Chaque niveau ouvre l'étape suivante de l'histoire de l'habitant (cinq étapes). Les étapes 3 et 5 sont des scènes à deux.
- **HA-03** L'habitant se souvient de qui a fait quoi et le dit (« Camille m'a apporté des radis hier, tu lui diras merci. »), sans jamais comparer les deux joueurs.
- **HA-04** Rattrapage: quand le lien avec un habitant est la seule condition qui manque à une étape de chapitre depuis sept jours, cet habitant vient à la maison chaque jour (lien +40 par visite) jusqu'à l'atteindre.
- **HA-05** Pas de romance avec les habitants. On peut aider deux habitants à se rapprocher (Rose et Victor, section 6.3).
- **HA-06** Visiteurs du samedi: un à trois par train, composés à partir de douze modèles (section 6.9), chacun avec une demande (un produit, un lieu à montrer, un oiseau à voir, une photo à prendre). Ils restent jusqu'au train suivant à la pension de Mme Ferrand. Demande remplie: une récompense (graine rare, recette, meuble, carte postale) et une lettre plus tard. Demande non remplie: le visiteur repart content quand même.
- **HA-07** Envies: chaque matin, chaque joueur reçoit une envie personnelle, tirée parmi celles de la saison et de ses traits, jamais la même deux fois en sept jours. Un jour sur trois, une envie à deux s'ajoute, la même chez les deux (« Pique-niquer au bord de l'étang avec toi »). Réalisée: Cœur +15 (+25 chacun pour l'envie à deux). Non réalisée: rien.
- **HA-08** Scènes et dialogues: les choix de dialogue changent le ton et la réponse de l'habitant, jamais l'issue d'une étape. Dans une scène à deux, chacun choisit sa réplique sur son écran et voit le choix de l'autre; si les deux choisissent la même, elle est dite une fois; sinon, les deux sont dites l'une après l'autre et l'habitant réagit aux deux.

### 4.9 Carnet de la vallée

- **CN-01** Le carnet est commun: toute découverte de l'un remplit la page pour le duo, avec la date, le lieu et « ensemble » si les deux étaient à moins de 15 m.
- **CN-02** Il compte 165 pages en version 1 (section 6.10): étapes d'histoire, étapes des habitants, fêtes vécues, pièces de la maison, oiseaux, poissons, cueillettes, recettes, points de vue, énigmes du chef de gare. Le nombre de pages remplies est la progression commune (SV-08).
- **CN-03** Oiseaux: ils apparaissent selon le lieu, la saison, l'heure et la météo. Observer: jumelles en main, garder l'oiseau dans le cercle de visée pendant 2 s. L'oiseau ne fuit pas pendant l'observation et reste libre. Les rapaces nocturnes se montrent de 21 h à 24 h.
- **CN-04** Coup de pouce: une entrée encore jamais vue a plus de chances d'apparaître (x6 pour les oiseaux, x4 pour les poissons et les cueillettes), parmi celles possibles à cet endroit et à ce moment. Raretés: poids 6 (commun), 3 (peu commun), 1 (rare).
- **CN-05** Pêche: lancer sur une eau à moins de 6 m; touche au bout de 3 à 15 s (plus vite avec un appât, un orage, un bon coin); ferrer dans la fenêtre (1,5 s; 3 s avec l'aide). Manqué: le poisson repart, l'appât reste, on relance. Aucune épreuve d'adresse après le ferrage.
- **CN-06** Cueillettes: elles repoussent chaque matin dans leurs coins selon la saison; certaines sont cachées sous les feuilles (le cueilleur les voit de plus loin).
- **CN-07** Points de vue: huit cartes postales anciennes, trouvées au fil de l'histoire de Lucie, montrent un paysage. Se tenir à l'endroit exact et regarder dans la bonne direction remplit la page (la carte s'anime et se colore).
- **CN-08** Énigmes du chef de gare: trois cartes rédigées par Émile Lacombe, l'ancien chef de gare, trouvées dans une boîte en fer au grenier de la maisonnette (étape 1.2). Chacune se résout par l'observation du monde (une heure, une ombre, un alignement) et mène à un objet caché. La troisième ne se résout qu'aux Vergers. Aucune ne bloque l'histoire.

### 4.10 Gestes à deux et déplacements

- **GE-01** Un geste à deux demande les deux personnages à moins de 2 m de son point, chacun maintenant l'action. La progression est commune; relâcher la met en pause sans rien perdre. Aucun geste ne peut échouer.
- **GE-02** Porter (poutres, gros meubles, troncs de la voie): les deux portent ensemble; le déplacement suit la moyenne des deux directions demandées (même direction: 1,8 m/s; un seul qui avance: 0,9 m/s; directions opposées: on ne bouge pas). Lâcher pose l'objet au sol, intact.
- **GE-03** Lever (charpente, marquise, cloche): maintenir ensemble pendant la durée du geste (5 s), avec une courte animation partagée.
- **GE-04** Pomper la draisine: les deux à bord; maintenir l'action fait avancer à 4,5 m/s; alterner en rythme (un coup chacun, à 0,3 s près) donne 6 m/s. La draisine ne part qu'avec les deux à bord tant que la voie n'est pas rouverte; après le chapitre 2, un joueur seul la pompe à 3 m/s.
- **GE-05** Danser (fêtes), se tenir la main en marchant, s'asseoir ensemble sur un banc, se faire un câlin à la veillée: gestes contemplatifs (Cœur +10, une fois par jour pour l'ensemble des gestes à deux). Leur liste dépend de la question Q4.
- **GE-06** Déplacements: marche à 3,5 m/s (pas de course). Pendant le chapitre 2, la voie des Vergers est une zone qu'on parcourt en draisine (400 m, un peu plus d'une minute de pompage). Une fois la voie rouverte, on passe d'une gare à l'autre en fondu: par le sentier (30 minutes de jeu, soit 24 s réelles) ou en draisine depuis la remise (10 minutes de jeu, soit 8 s). Sortir d'une zone par un bord la charge sur la machine de ce joueur seulement.
- **GE-07** Le repère: un joueur plante une épingle à sa couleur à l'endroit visé (dans le monde ou sur la carte), visible chez les deux pendant 15 s, avec un carillon chez l'autre. Une épingle par joueur à la fois.

### 4.11 Histoire et chapitres

- **HI-01** Le chapitre en cours et sa prochaine étape s'affichent toujours dans le carnet. Les étapes d'un chapitre peuvent avancer en parallèle quand leurs conditions le permettent (section 6.2).
- **HI-02** Une scène d'histoire se déclenche quand les deux joueurs sont à son point de rendez-vous. Elle ne s'impose jamais à un joueur occupé, n'a pas d'heure limite, et peut attendre des jours.
- **HI-03** Un chapitre s'achève par son inauguration, le dimanche qui suit le jour où toutes ses conditions sont remplies. Si ce dimanche est un jour de fête de saison, la fête se tient sur le lieu de l'inauguration et les deux pages se remplissent.
- **HI-04** Après le chapitre 2, la vallée continue sans fin: saisons, fêtes, commandes, histoires des habitants, carnet. Une lettre de la coopérative annonce la suite de la ligne (« La voie de Lac-Clair attend des bras. Patience: les rails arrivent. »). Elle se transforme en chapitre 3 quand l'épisode est installé (SV-06).

### 4.12 Mémoire de la vallée: sauvegardes, séances, progression commune

- **SV-01** Emplacements: trois mondes par duo, déclarés à la plateforme. Une sauvegarde appartient au duo, existe sur les deux machines (F07) et se reprend quelle que soit la machine qui héberge.
- **SV-02** Ce qui se sauvegarde: l'état complet et exact du monde (entités de la section 4.1), y compris la position et l'orientation de chaque personnage, l'heure à la minute, l'état du générateur aléatoire, les propositions en attente, les aides de chaque joueur et son orientation de caméra. Ce qui ne se sauvegarde pas: les touches, les volumes et l'affichage (réglages de chaque machine, F10), les fenêtres de menu ouvertes, une scène en cours (elle reprend à son début).
- **SV-03** Quand:
  - à l'aube de chaque journée, après le petit-déjeuner (point de reprise principal);
  - toutes les 5 minutes réelles de séance (sauvegarde automatique de la plateforme);
  - à chaque pause demandée par Échap;
  - après chaque étape d'histoire et chaque inauguration;
  - à la fin de la séance (écran de nuit, retour au salon, fermeture de Duo).
  - Libellé fourni à la plateforme pour ses messages: « Enregistré le 5 du printemps, année 1, à 14 h 20 ».
- **SV-04** Liaison des personnages: chaque personnage est rattaché à l'identifiant stable du joueur fourni par la plateforme (profil de sa machine), jamais au rôle d'hôte ou d'invité. Au chargement, chacun retrouve son personnage. Si un identifiant n'est pas reconnu (machine réinstallée qui n'a pas repris la place de l'ancienne), un écran demande « Qui joue qui ? »: chacun choisit son personnage, les deux confirment, la liaison est enregistrée. Le même écran permet d'échanger les personnages à la demande des deux.
- **SV-05** Taille: un monde en fin de version 1 pèse moins de 1 Mo en JSON lisible (669 Ko mesurés sur un monde synthétique, 78 Ko compressé), et moins de 2 Mo à 100 heures (1,6 Mo). Script: `simulations/taille_sauvegarde.py`.
- **SV-06** Versions et épisodes:
  - la sauvegarde porte la version de son format (`dataSchema`) et la liste des contenus installés (`episodes`); chaque version du jeu migre pas à pas les formats précédents, migrations testées en intégration continue sur des sauvegardes de référence;
  - tout contenu a un identifiant stable, jamais réutilisé ni retiré: un épisode ajoute des gares, des habitants, des objets et des règles, il ne retire rien et ne réinitialise rien;
  - au premier chargement d'un monde par une version qui apporte un épisode: si le chapitre précédent est achevé, la lettre de la coopérative arrive au train suivant et ouvre le chapitre de l'épisode; sinon, elle arrive après l'inauguration du chapitre en cours. Une nouvelle règle (un métier, un rang) s'annonce par le courrier et une courte scène;
  - les valeurs d'équilibrage peuvent changer d'une version à l'autre sans rien retirer de ce que le duo possède;
  - une version plus ancienne n'ouvre jamais une sauvegarde plus récente et ne l'écrase pas: la plateforme joue la version la plus récente présente sur l'une des deux machines (F13).
- **SV-07** Historique (F08): le jeu inscrit des séances, sans victoire ni défaite. À la fin d'une séance, il envoie: la progression (pages remplies et pages disponibles), les journées vécues (« du 3 au 5 du printemps, année 1 », et leur nombre), au plus trois faits marquants partagés (60 caractères au plus) et trois statistiques pour l'écran de fin (journées vécues, pages ajoutées, moments à deux: gestes à deux, envies à deux réalisées et soupers partagés). Faits marquants, par priorité: inauguration (« Gare des Vergers rouverte »), fête vécue, histoire d'un habitant achevée, chantier collectif achevé, pièce reconnue, espèce rare observée ou pêchée, nouvelle bête. Aucun fait individuel (rang, record) n'y figure. Une séance interrompue par un plantage est inscrite « interrompue » par la plateforme; le monde reprend alors à sa dernière sauvegarde.
- **SV-08** Score cumulé (F09): la progression commune « Carnet de la vallée: 87 pages sur 165 ». La valeur est toujours celle de la sauvegarde écrite au même moment. Le total suit le contenu installé: quand un épisode arrive, il augmente (le carnet a de nouvelles pages à remplir). Jamais de score individuel ni de comparaison entre les deux joueurs.

### 4.13 Actions simultanées, pause, absence, déconnexion, fin de séance

L'hôte fait autorité (architecture, section 7): il reçoit les intentions des deux joueurs et les applique dans leur ordre d'arrivée. Les règles ci-dessous disent ce que voit chaque joueur.

| # | Cas | Règle |
|---|---|---|
| SI-01 | Les deux récoltent, ramassent ou cueillent le même objet au même instant | le premier reçu l'obtient; l'autre voit l'objet sauter dans le sac de l'autre et la ligne « Déjà pris par Sacha »; rien n'est perdu, tout est au duo |
| SI-02 | Les deux achètent le dernier exemplaire d'un objet, ou dépensent plus que la bourse à eux deux | le premier achat reçu passe; le second est refusé sans rien débiter (« Il manque 40 sous. ») |
| SI-03 | Les deux posent ou retirent sur la même case du plan | la case sélectionnée par l'un est verrouillée à sa couleur jusqu'à ce qu'il la relâche; l'autre voit « Sacha modifie ici » |
| SI-04 | Les deux travaillent sur le même élément ou le même geste | leurs efforts s'additionnent (MA-03, GE-01) |
| SI-05 | Les deux répondent à une même proposition ou en font deux à la fois | une seule proposition par joueur à la fois; une nouvelle remplace la sienne |
| SI-06 | Les deux parlent au même habitant | chacun a sa conversation sur son écran; l'habitant se tourne vers le dernier venu |
| SI-07 | Les deux déposent dans la caisse pendant le départ du train | tout ce qui est reçu avant 16 h 00 part; le reste attend le samedi suivant |
| PA-01 | Pause (Échap, chez l'un ou l'autre) | la plateforme fige tout le monde des deux côtés; reprise quand les deux l'ont demandée (F05). Le jeu sauvegarde à la mise en pause (SV-03) |
| PA-02 | Menus du jeu | ils ne mettent jamais la partie en pause; ils arrêtent l'horloge seulement si les deux joueurs y sont à la fois (TE-03). Échap ne ferme pas un menu du jeu: on le ferme par sa touche ou par Retour arrière |
| PA-03 | Perte du focus ou fenêtre réduite | pas de pause; les touches sont relâchées, le personnage s'arrête (F05) |
| PA-04 | Absence d'un joueur: aucune entrée depuis 3 minutes (réglage du duo, de 1 à 10) alors que l'horloge tourne | son personnage s'assoit ou s'adosse; l'horloge s'arrête pour les deux; l'autre voit « L'horloge attend Camille » et peut continuer à agir tant qu'il lui reste de l'endurance (à 0, seules les actions gratuites restent possibles: parler, observer, décorer, plan). La moindre entrée de l'absent relance l'horloge |
| PA-05 | Déconnexion | la plateforme met en pause des deux côtés et attend sans limite (F06); à la reconnexion, chacun retrouve son personnage là où il était, à la minute près, y compris en plein geste à deux, en scène ou dans le plan (les verrous du plan sont relâchés). Si l'application de l'hôte s'est fermée, le monde reprend à sa dernière sauvegarde (5 minutes au plus en arrière, ou l'aube) |
| PA-06 | Un joueur absent du jeu pendant des jours ou des semaines | le monde ne bouge pas (TE-09): ni culture qui sèche, ni bête qui attend, ni habitant qui s'impatiente. Il n'y a pas de jeu seul: une séance demande les deux |
| PA-07 | L'un lance une autre partie avec un autre emplacement | les mondes sont indépendants; chacun garde son état exact |
| PA-08 | Fin de séance | à l'écran de nuit (les deux couchés), chacun choisit « Continuer » ou « Finir la séance » et voit le choix de l'autre; la séance finit quand les deux ont choisi « Finir ». À tout moment, « Retour au salon » ou la fermeture de Duo finissent aussi la séance, avec l'état exact du moment. Dans les deux cas, c'est une séance normale de l'historique, pas une partie interrompue |

### 4.14 Victoire, défaite, égalités

- Ni victoire, ni défaite, ni égalité: c'est une coopération sans fin de partie. Les réussites sont les étapes et les inaugurations, toujours partagées.
- Aucun état d'échec: pas de mort, pas de faillite, pas de culture morte, pas de bête perdue, pas d'habitant fâché, pas de chapitre raté. Ce qui n'est pas fait aujourd'hui attend.
- La « fin » de la version 1 est l'inauguration des Vergers; le jeu continue ensuite (HI-04).

### 4.15 Métriques de gameplay

| Mesure | Valeur | Remarque |
|---|---|---|
| Case | 1 m | grille de toutes les règles |
| Taille d'un personnage | 1,7 m | gabarits de 1,6 à 1,8 m |
| Vitesse de marche | 3,5 m/s | pas de course |
| Portage à deux | 1,8 m/s | 0,9 m/s si un seul avance |
| Draisine | 6 m/s en rythme, 4,5 m/s à deux, 3 m/s seul (après le chapitre 2) | sur la voie du chapitre 2; ensuite, trajet en fondu de 10 minutes de jeu |
| Portée d'une action | 1,5 m | la case devant soi et ses voisines |
| Portée d'une conversation | 2,5 m | |
| Portée d'un geste à deux | 2 m du point du geste | |
| Lancer de pêche | 6 m au plus | |
| Jumelles | 18 m de portée, cercle de visée de 2 m | |
| Zones de la version 1 | Halte 120x90 m, Vergers 110x80 m, voie 400 m de long | enveloppes dans lesquelles level-designer dessine les cartes (section 6.1) |
| Caméra | orthographique, quatre orientations, trois zooms (16, 24 et 36 m de largeur de vue) | à confirmer par l'essai de style |

### 4.16 Tables d'équilibrage

Toutes ces valeurs vivent dans des fichiers de configuration typés (CLAUDE.md), jamais en dur. Les simulations (section 4.17) relisent les mêmes valeurs.

**Temps et rythme**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Durée d'une minute de jeu | 0,8 | s réelle | 0,6 à 1,2 | dehors de 6 h à 21 h en 12 min; journée complète de 16,6 min en moyenne, 2,4 journées par séance de 40 min |
| Rythme paisible (réglage du duo) | 1,0 | s par minute de jeu | 0,8 à 1,2 | 25 % de temps en plus pour flâner |
| Début de la veillée possible | 19 h | heure de jeu | 18 h à 20 h | 13 h de jeu (10,4 min) avant la première veillée |
| Retour forcé | 24 h | heure de jeu | fixe | fin de journée lisible |
| Jours par saison | 21 | jours | 14 à 28 | trois trains par saison, 5,8 h par saison |
| Fêtes | 16e jour de la saison | | 9e à 20e | un dimanche, lendemain du troisième train |
| Train | arrivée 10 h, départ 16 h | heure de jeu | 8 h à 18 h | six heures pour livrer le samedi même |
| Seuil d'absence | 3 | min réelles sans entrée | 1 à 10 | assez pour lire une lettre, trop court pour laisser filer une heure de jeu |
| Pénalité du retour de minuit | -30 | Sommeil | 0 à -50 | sentir la nuit trop courte sans punir |

**Personnages et besoins**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Endurance | 80 + 0,4 x forme | points | 80 à 120 | une mauvaise forme ne retire que 20 % |
| Aide Endurance généreuse | x1,5 | | x1,25 à x2 | un joueur moins à l'aise garde le rythme de l'autre |
| Poids de la forme (Ventre, Sommeil, Cœur) | 0,35, 0,35, 0,30 | | 0,2 à 0,5 chacun | trois besoins également sensibles |
| Ventre selon le souper | 30, 50, 60, 80, 100 | | | aucun, dessert seul, simple, mijoté, complet: cuisiner le soir compte |
| Sommeil selon le lit | 50, 70, 85, 100 | | | paillasse, lit, matelas, édredon: quatre achats lisibles |
| Cœur de base | 40 | | 30 à 50 | une journée vide donne « Ça va » avec un bon lit et un souper |
| Envie réalisée | +15, envie à deux +25 chacun | Cœur | +5 à +30 | une raison quotidienne de se retrouver |
| Geste à deux | +10, une fois par jour | Cœur | +5 à +15 | |
| Confort de la maison | points de confort / 10, au plus 20 | Cœur | plafond 10 à 30 | la maison compte sans tout décider |
| En-cas | pain 10, simple 20, dessert 25, mijoté 35 | endurance | | |
| Endurance à 0 | durée des actions x2 | | x1,5 à x3 | jamais bloqué |

**Coûts d'endurance et expérience**

| Action | Endurance | Expérience | Métier |
|---|---|---|---|
| Bêcher une case | 2 | 2 | Maraîchage |
| Défricher une case | 3 | 3 | Maraîchage |
| Semer une case | 1 | 1 | Maraîchage |
| Arroser (un coup d'arrosoir) | 1 | 1 | Maraîchage |
| Récolter | 0 | 1 | Maraîchage |
| Nourrir une bête | 0 | 1 | Élevage |
| Caresser une bête | 0 | 2 | Élevage |
| Traire, récolter le miel | 1 | 3 | Élevage |
| Ramasser un œuf | 0 | 1 | Élevage |
| Coup de hache, coup de pioche | 3 | 3 | Bois et charpente |
| Scier une planche à l'établi | 2 | 2 | Bois et charpente |
| Travailler à une construction | 1 par seconde | 1 par seconde | Bois et charpente |
| Fabriquer un meuble | 0 | 10 | Bois et charpente |
| Cuisiner une recette simple, un mijoté ou un dessert | 0 | 5, 10 | Cuisine et conserverie |
| Mettre en bocal, affiner un fromage | 0 | 5 | Cuisine et conserverie |
| Lancer la ligne | 1 | 1, et 4 par prise | Pêche et cueillette |
| Cueillir | 0 | 2 | Pêche et cueillette |
| Observer un oiseau jamais vu | 0 | 5 | Pêche et cueillette |
| Parler, offrir, pomper, porter | 0 | 0 | aucun |

Cible: environ 70 points d'expérience de base pour une journée consacrée à son métier (140 pour le métier principal), soit le rang 2 au jour 5 et le rang 3 vers le jour 28. Les valeurs par action se recalent au prototype sur cette cible.

**Métiers**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Rang 2 | 600 | expérience cumulée | 400 à 900 | une première promotion dès la deuxième séance |
| Rang 3 | 4000 | expérience cumulée | 3000 à 5000 | une saison et une semaine de métier principal: un à deux métiers au rang 3 par joueur dans l'année, les autres pour les années suivantes |
| Multiplicateur du métier principal | x2 | | x1,5 à x3 | se spécialiser se sent |
| Plafond des métiers secondaires | rang 2 | | | |
| Changement de métier principal | 1 | par saison | 1 à 3 | identité stable, changement sans regret |

**Ferme**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Potager de départ | 24 | cases | 16 à 36 | de quoi remplir la première commande sans y passer la journée |
| Potager maximal (Halte), lopin des Vergers, verger, serre | 96, 48, 12 arbres, 8 | cases | | |
| Vigueur au défrichage | 60 | | 50 à 70 | « belle » accessible avec un arrosage régulier, « superbe » demande engrais et rotations |
| Consommation par récolte | Racines 15, Verdures 10, Fruits 20, Fleurs 5; Légumineuses +20 | vigueur | 0 à 30 | quatre à six récoltes avant une terre fatiguée |
| Rotation | consommation divisée par 2 | | /1,5 à /3 | récompenser la planification |
| Récupération | +1 par jour vide, engrais +25 | vigueur | | |
| Seuils de qualité | belle 75, superbe 110 | score de soin | | aucun hasard: le résultat suit les soins |
| Prix selon la qualité | x1, x1,5, x2 | | | |
| Valeur nette d'une case | 2,95 en moyenne, de 2,10 à 3,71 (fraisier: 1,43 la première année, 3,81 ensuite) | sous par jour | | calcul de la partie 4 de `economie_et_chapitres.py`; légumineuses plus basses, elles soignent le sol |
| Poule, chèvre, ruche | 150, 600, 12 planches et 20 sous | sous | | |
| Grain, foin | 2 par poule, 4 par chèvre en hiver | sous par jour | | entretien sensible, jamais ruineux |
| Seuils d'amitié des bêtes | belle 300, superbe 700 | amitié | | un mois de soins pour le superbe |
| Probabilités des aléas | grêle 25 %, coup de sec 25 %, gel 20 %, brouillard 20 % | par saison | 0 à 50 % | un aléa par saison en moyenne |
| Protections | cloche de verre 8 sous, réutilisable; une botte de paille par récolte de blé, qui paille 3 cases | | | se protéger des aléas sans grosse dépense |

**Économie et commande**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Épicerie | 80 % du prix, 300 sous par jour au plus | | 60 à 100 %, 200 à 500 | de l'argent tous les jours, mais le samedi reste le jour des affaires |
| Caisse du train | 100 % du prix | | | |
| Ligne de commande remplie | x1,5 | prix de base | x1,25 à x2 | la commande rapporte 23 à 32 % des revenus selon les duos, 27 % pour un duo médian |
| Commande complète | +25 % | | 10 à 50 % | |
| Lignes | 4 + niveau / 2, de 3 à 8 | lignes | | 4 au début, 6 ou 7 en fin d'année |
| Lot | section 6.4, x(1 + 0,1 x niveau) | unités | | 80 à 110 sous par lot au départ (92 en moyenne) |
| Taille de la commande (réglage du duo) | petite x0,6, normale x1, grande x1,4 | | | duo tranquille: chapitre 2 au jour 65 au lieu de 72 avec la commande petite et une aide |
| Confiance | +1 par ligne, +2 par commande complète | points | | |
| Niveaux de confiance | 4, 9, 15, 24, 36, 50, 66 | points | | duo médian: niveau 2 au deuxième samedi (deux fois sur trois), niveau 3 au troisième ou au quatrième, niveau 6 en fin d'année |
| Gros achat | 500 | sous | 100 à 2000, ou jamais | les chèvres et les outils de niveau 3, pas les graines |
| Annonces | 3 au plus, 60 à 200 sous, lien +50 | | | |
| Outils, niveau 2 et niveau 3 | 300 et 900 | sous par outil | 200 à 1200 | |

**Chantiers et chapitres**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Quai et marquise (chapitre 1) | 60 planches, 40 tuiles, 30 pierres taillées, 20 clous, une lanterne de quai (1200 sous en valeur); 300 points de travail; le geste « lever la marquise » | | | ouvert après la première commande (jour 8), achevé une à deux semaines plus tard: chapitre 1 en trois semaines |
| Draisine | 500 | sous de pièces | 300 à 800 | |
| Voie des Vergers | quatre obstacles, un par jour au plus; le pont de la Combe demande 40 planches, 20 clous et 2 poutres (600 sous) | | | une sortie à deux par obstacle |
| Gare des Vergers | 200 planches, 120 tuiles, 100 pierres taillées, 60 clous, 4 poutres, 12 vitres, une cloche (4000 sous en valeur); 800 points de travail; les gestes « lever la charpente » et « hisser la cloche » | | | trois à quatre semaines de chantier pour un duo médian |
| Confiance pour le chantier de la gare | niveau 3 | | 2 à 4 | |
| Coup de main du village | après 10 jours (chapitre 1) ou 15 jours (chapitre 2): 15 % des matériaux restants chaque samedi, 100 points de travail chaque dimanche | | 5 à 30 % | proportionnel à ce qui reste: presque rien pour un duo médian, 3 % des matériaux pour un duo tranquille |

**Construction de la maison**

| Élément | Matériaux | Travail |
|---|---|---|
| Mur, 1 m | 4 planches ou 4 pierres | 6 s |
| Sol, 1 m² | 2 planches | 3 s |
| Porte | 8 planches, 2 clous | 8 s |
| Fenêtre | 4 planches, 1 vitre | 6 s |
| Toit, 1 m² | 2 tuiles, 1 planche | 2 s |
| Escalier | 12 planches, 4 clous | 10 s |
| Poutre | 1 poutre (geste « porter ») | 5 s à deux |

Deux joueurs sur le même élément: travail deux fois plus rapide.

**Habitants et carnet**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Conversation, cadeau adoré, aimé, autre | 10, 60, 30, 10 | lien | | un habitant vu chaque jour par les deux atteint le niveau 2 en deux semaines |
| Niveaux de lien | 100, 250, 450, 700, 1000 | lien | | cinq étapes par habitant, la dernière vers la fin de l'année |
| Rattrapage d'un lien | après 7 jours, +40 par visite | | | |
| Raretés | 6, 3, 1 | poids | | |
| Coup de pouce | oiseaux x6, poissons et cueillettes x4 | | x1 à x8 | 95 % des duos finissent le carnet d'oiseaux dans l'année (10 % sans coup de pouce) |
| Observation d'un oiseau | 2 | s dans le cercle | 1 à 3 | |
| Fenêtre de ferrage | 1,5 (3 avec l'aide) | s | 1 à 4 | |
| Attente d'une touche | 3 à 15 | s | | |

**Réglages et seuils divers**

| Paramètre | Valeur | Unité | Plage | Raison |
|---|---|---|---|---|
| Sauvegarde automatique | 5 | min réelles | 2 à 10 | au plus 5 minutes perdues si l'hôte s'arrête |
| Épingle du repère | 15 | s | 5 à 30 | |
| Envie à deux | un jour sur trois | | un sur deux à un sur cinq | rare pour rester un petit événement |
| Objet oublié rapporté | 3 | jours | 1 à 7 | |

### 4.17 Simulations

Trois scripts, bibliothèque standard de Python, graines fixes. Commandes, depuis `docs/jeux/jeu-1/simulations/`:

- `python3 economie_et_chapitres.py` (8 s): rythme, économie et chapitres, commande du samedi, cultures et lots;
- `python3 collections_v1.py` (3 s): carnet d'oiseaux, poissons, cueillettes;
- `python3 taille_sauvegarde.py` (moins d'une seconde): taille d'une sauvegarde.

**Rythme** (journée modélisée: petit-déjeuner de 0,4 min; retour à la maison entre 19 h et 23 h 30, le plus souvent vers 20 h 30; 1 min d'horloge arrêtée en journée; veillée de 3 min en moyenne; coucher de 0,2 min):

| Mesure | Valeur |
|---|---|
| Journée réelle | 16,6 min en moyenne (9 sur 10 entre 14,4 et 19,1 min), dont 10,4 à 14 min dehors |
| Saison, année | 5,8 h, 23,3 h |
| Séance de 10, 25, 40, 45 min | 0,6, 1,5, 2,4, 2,7 journées |
| Version 1 (une année, 84 journées) | 23,3 h, 35 séances de 40 min |
| Un épisode (53 journées: un chapitre d'une saison et demie, puis une saison de vie à la nouvelle gare) | 14,7 h; quatre épisodes: 58,7 h |
| Long terme (le reste pour 100 h) | 18,1 h, 65 journées |
| 100 h | 361 journées, 4,3 années de jeu, 150 séances de 40 min |

**Économie et chapitres** (2000 parties par cas; jour de jeu, heure de jeu cumulée; entre crochets, le premier et le neuvième décile). Profils supposés, à recaler au prototype: tranquille (65 % du rendement possible, 35 % des revenus aux chantiers, 70 % des lignes remplies), médian (85 %, 50 %, 85 %), optimiseur (105 %, 60 %, 95 %); « tranquille avec aides »: les mêmes joueurs avec la commande petite et l'endurance généreuse chez l'un des deux. Avec le coup de main du village:

| Duo | Fin du chapitre 1 | Arrivée aux Vergers | Fin du chapitre 2 | Chapitre 2 avant la fin de l'année |
|---|---|---|---|---|
| Tranquille | jour 23 [23-30], 6,2 h | jour 35 [30-44], 9,6 h | jour 72 [65-79], 19,8 h | 98 % (93 % sans le coup de main) |
| Tranquille avec aides | jour 23 [23-23], 6,2 h | jour 33 [29-38], 9,0 h | jour 65 [58-65], 17,9 h | 100 % |
| Médian | jour 23 [23-23], 6,2 h | jour 30 [28-35], 8,2 h | jour 58 [51-58], 15,9 h | 100 % |
| Optimiseur | jour 23 [16-23], 6,2 h | jour 28 [21-30], 7,6 h | jour 51 [44-51], 14,0 h | 100 % |

Lectures:

- le chapitre 1 dure trois semaines pour presque tous les duos: le chantier du quai ne s'ouvre qu'après la première commande (jour 8), son travail et la confiance demandent encore une à deux semaines, et l'inauguration attend le dimanche; un duo optimiseur peut l'achever une semaine plus tôt;
- le chapitre 2 s'étale de 14 h à 20 h selon les duos; le coup de main du village et les aides resserrent la queue sans rien changer pour un duo médian (le village apporte 0 % de ses matériaux, 3 % pour un duo tranquille);
- rang 2 du métier principal au jour 5 ou 6, rang 3 au jour 26 (optimiseur), 28 (médian), 36 (tranquille);
- la commande du samedi pèse 23 % des revenus d'un duo optimiseur, 27 % d'un médian, 29 % d'un tranquille: elle compte pour tous, sans écraser le reste;
- les inaugurations tombent un dimanche: l'écart entre deux duos se compte par semaines.

**Commande du samedi** (2000 années, 22 000 commandes): aucun produit trois semaines de suite, aucune commande à moins de trois métiers, aucune commande plus courte que prévu; 16,8 produits différents en moyenne sur quatre samedis pour 22,4 lignes (au moins 9).

**Collections** (2000 parties, arrivée aux Vergers tirée partie par partie de la simulation du duo médian, de 8,2 à 8,4 h en médiane selon le tirage; heures de jeu, médiane et, entre parenthèses, 9 parties sur 10 en dessous):

| Collection | Tirage | 50 % | 90 % | 100 % | Finie dans l'année 1 |
|---|---|---|---|---|---|
| Oiseaux (24) | au hasard | 9 (10) | 20 (35) | 43 (83) | 10 % |
| | coup de pouce x6 | 4 (6) | 13 (14) | 15 (20) | 95 % |
| Poissons (12) | au hasard | 9 (10) | 14 (19) | 19 (38) | 72 % |
| | coup de pouce x4 | 8 (10) | 12 (14) | 14 (16) | 100 % |
| Cueillettes (12) | au hasard | 9 (10) | 13 (14) | 14 (18) | 94 % |
| | coup de pouce x4 | 8 (10) | 12 (13) | 13 (14) | 100 % |

Règle de contenu tirée de la simulation: on arrive aux Vergers en plein été, donc chaque entrée des Vergers est visible en automne ou en hiver, et les espèces de printemps vivent à la Halte. Avec une première version du contenu (quatre oiseaux des Vergers réservés au printemps et à l'été, deux oiseaux visibles seulement l'hiver), 17 % seulement des duos finissaient le carnet d'oiseaux dans l'année avec un coup de pouce x4; le passage à x6 et la règle ci-dessus portent ce chiffre à 95 %.

**Sauvegarde**: monde synthétique de fin de version 1 (trois zones, dix habitants, 165 pages, 84 jours de journal), 669 Ko en JSON lisible et 78 Ko compressé; à 100 h (sept zones, trente habitants, 485 pages, 361 jours), 1618 Ko et 182 Ko. C'est une borne haute (clés explicites, aucune optimisation, la voie comptée comme une gare entière).

## 5. Contrôles (game-designer, ux-ui-designer)

### 5.1 Touches

Touches lues par leur position (`KeyboardEvent.code`), libellés affichés selon la disposition réelle du clavier. Dans ce tableau, la touche est nommée par son libellé AZERTY, avec son code entre parenthèses.

| Action | Touche (clavier AZERTY) | Souris |
|---|---|---|
| Se déplacer | Z, Q, S, D (KeyW, KeyA, KeyS, KeyD), ou les flèches | clic gauche sur le sol: y aller |
| Agir: outil en main, ou parler, ouvrir, ramasser, donner | Espace, sur la case ou la personne en face | clic gauche sur la cible: y aller et agir |
| Maintenir: geste à deux, observer, travailler au chantier | maintenir Espace | maintenir le clic gauche |
| Examiner (et lire le regard du métier) | X (KeyX) | clic droit |
| Changer d'outil | 1 à 0 de la rangée du haut (Digit1 à Digit0), raccourci facultatif | molette, ou clic sur la barre d'outils |
| Tourner la caméra d'un quart de tour | A et E (KeyQ, KeyE) | flèches de rotation du HUD |
| Rapprocher, éloigner la caméra | R et F (KeyR, KeyF) | Maj et molette |
| Carnet (sac, pages, métiers, courrier, aides, réglages du monde) | Tab | icône du carnet |
| Carte de la vallée | C (KeyC) | icône de la carte |
| Plan de la maison (dans la maison et sur un chantier) | B (KeyB) | icône du plan |
| Faire signe (repère) | G (KeyG), à l'endroit visé | clic molette |
| Dans un menu ou un dialogue: choisir, valider | flèches, Entrée ou Espace | clic |
| Fermer un menu du jeu | sa touche (Tab, C, B) ou Retour arrière | clic hors du menu |
| Dans le plan: déplacer le curseur, poser, retirer | flèches ou ZQSD, Espace, X | clic gauche pose, clic droit retire |
| Pause | Échap (réservé à la plateforme) | |

- La rangée des chiffres n'est jamais obligatoire: tout outil se choisit à la molette ou par un clic sur la barre.
- Tout le jeu se joue à la souris seule (aller et agir d'un clic, icônes pour les menus et la caméra) et au clavier seul (Espace sur la case en face, X pour examiner, menus au clavier).
- Aucune combinaison de touches simultanées n'est exigée, sauf Maj et molette pour le zoom, qui a aussi R et F.
- Reconfiguration des touches: oui, toutes les actions, dans les réglages de Duo (F10). Pas de manette.

### 5.2 Retour de chaque action

| Action | Retour visuel | Retour sonore |
|---|---|---|
| Se déplacer | animation de marche, traces dans la neige et la boue | pas selon le sol (terre, herbe, bois, pierre, neige) |
| Clic sur le sol | repère de destination au sol pendant 1 s | clic doux |
| Viser avec un outil | case surlignée, icône d'action au curseur; case grisée et raison en infobulle si l'action est impossible | aucun |
| Bêcher, défricher | motte retournée, la case fonce | « tchac » de terre |
| Semer | graines qui tombent, petit monticule | froissement |
| Arroser | jet d'eau, la case fonce et brille; arrosoir vide: plus d'eau | eau qui coule; son creux quand il est vide |
| Une culture a poussé (le matin) | stade suivant visible | aucun |
| Récolter | le légume saute vers le sac, +1 au sac | « pop », un tintement pour « belle », deux pour « superbe » |
| Arracher | plante retirée, graine qui saute au sac | froissement |
| Couper un arbre | copeaux à chaque coup, l'arbre tremble puis tombe doucement | coups de hache, craquement, chute |
| Casser une pierre | éclats | tintement de pioche |
| Lancer la ligne | ligne qui part, bouchon qui se pose | sifflement, « plouf » |
| Touche | bouchon qui plonge, rides | « ploc » |
| Ferrer à temps | le poisson saute vers le sac, son nom s'affiche | éclaboussure; air du carnet si l'espèce est nouvelle |
| Ferrer trop tard | le bouchon remonte, « Il s'est échappé. » | petit « flop » |
| Observer un oiseau | cercle qui se remplit en 2 s; espèce nouvelle: page du carnet qui se tourne | chant de l'oiseau; air du carnet si nouvelle |
| Cueillir | l'objet saute au sac | froissement de feuilles |
| Nourrir une bête | mangeoire remplie, la bête vient manger | picorement, mastication |
| Caresser | la bête se frotte, gonfle ses plumes ou remue la queue | gloussement ou bêlement doux |
| Ramasser un œuf, traire | l'objet au sac, le seau se remplit | « ting » du lait |
| Parler à un habitant | il se tourne, boîte de dialogue | petit motif instrumental propre à l'habitant |
| Offrir un cadeau | l'objet passe dans ses mains, sourire ou éclat de rire | motif de l'habitant, rire pour un cadeau adoré |
| Donner à l'autre | la pile passe d'un personnage à l'autre | froissement de sac |
| Poser ou retirer dans le plan | fantôme qui apparaît ou s'efface, curseur à la couleur du joueur | crayon, gomme |
| Travailler sur un élément | l'élément passe du fantôme au solide, barre de progression | coups de marteau (deux marteaux à deux) |
| Élément terminé | nuage de poussière, l'élément devient solide | « tchonk » |
| Pièce reconnue | son nom s'écrit à la craie au sol pendant 2 s, page du carnet | accord |
| Geste à deux | les deux se placent, barre commune; à la fin, ils se tapent dans la main | « hop », souffle de l'effort, petit air « à deux » |
| Pomper la draisine | balancier, vitesse visible, petits accents quand c'est en rythme | grincement rythmé |
| Déposer dans la caisse | l'objet entre, la ligne de commande se coche | coup de tampon |
| Arrivée et départ du train | fumée, train qui entre ou repart | sifflet, roulement |
| Acheter, vendre | pièces qui passent, objet au sac | tintement de monnaie |
| Proposer un gros achat | carte de proposition chez l'autre; tampon « D'accord » ou carte qui se replie | sonnette douce |
| Manger | le personnage mange 2 s, l'endurance remonte | croque |
| Se coucher | fondu sur le lit, écran de nuit quand les deux sont couchés | bâillement, berceuse de nuit |
| Faire signe | épingle à la couleur du joueur, onde au sol, visible chez les deux | carillon chez les deux |
| Changer d'outil | la barre défile, l'outil passe en main | cliquetis |
| Tourner la caméra, zoomer | rotation en 0,3 s, zoom en 0,2 s (instantanés avec « Réduire les animations ») | léger souffle à la rotation |
| Ouvrir le carnet | le carnet s'ouvre sur le dernier onglet | pages |
| Envie réalisée | le portrait sourit, la phrase s'écrit au carnet | carillon doux |
| Absence de l'autre | son personnage s'assoit; « L'horloge attend Camille » | aucun (pour ne pas réveiller la pièce) |
| Rang atteint | bannière chez le joueur, ligne discrète chez l'autre | courte fanfare chez le joueur |
| Sauvegarde | indicateur « Progression enregistrée » de la plateforme | aucun |

## 6. Contenu (game-designer, level-designer)

### 6.1 Zones de la version 1

| Zone | Intention | Lieux | Difficulté (1 à 5) |
|---|---|---|---|
| La Halte d'Aubrune (bourg) | le premier chez-soi: tout est proche, rien ne presse | la halte et son quai (caisse de la coopérative, tableau des annonces, tableau des métiers, catalogue), la maisonnette du garde-barrière et son terrain (potager, poulailler), la place du bourg (épicerie-pension Ferrand, maison de Firmin, scierie de Basile), la rivière Aubrune et son gué (pêche), le bois de la Côte (cueillette, bois, oiseaux), la remise de la draisine | 1 |
| La voie des Vergers | la première expédition à deux | 400 m de voie envahie: deux arbres couchés, l'éboulis de la tranchée, le pont de la Combe; puis le trajet rapide en draisine | 2 |
| Les Vergers | un hameau endormi qu'on réveille | la gare en ruine (chantier), les vergers en terrasses, le lopin du duo, l'étang des Vergers, la chèvrerie de Rose, le rucher d'Augustin, la maison d'Hélène, le kiosque de Victor, l'atelier de Nadia | 2 |
| Intérieurs | la vie de tous les jours | la maison du duo (évolutive), l'épicerie-pension, la scierie, la chèvrerie, la gare des Vergers après son chantier | 1 |

Les cartes détaillées (placement des lieux, des biotopes d'oiseaux et de poissons, des cueillettes, des points de vue) reviennent à level-designer, dans les enveloppes de la section 4.15, livrées à l'alpha.

### 6.2 Chapitres et étapes

**Chapitre 1: La Halte d'Aubrune** (trois semaines)

| # | Étape | Condition | Ce qui se passe |
|---|---|---|---|
| 1.1 | Le premier train | jour 1, 10 h | scène à deux: Firmin vous accueille sur le quai, vous remet les clés de la maisonnette et dit le but |
| 1.2 | Un toit sur nos têtes | chantier guidé du toit et de la porte (12 planches offertes par Basile, deux poutres à porter), puis dormir | au grenier, une boîte en fer: les trois énigmes du chef de gare |
| 1.3 | Premières pousses | une récolte et au moins une ligne de la première commande livrée (jour 8) | Mme Ferrand offre trois poules; le poulailler se construit (20 planches, 4 clous) |
| 1.4 | Les gens du bourg | avoir parlé aux cinq habitants de la Halte | Firmin ouvre le tableau des annonces |
| 1.5 | La confiance de la coopérative | confiance niveau 2 | le catalogue gagne son rayon de meubles; le chantier du quai peut se finir |
| 1.6 | Le quai en fête | chantier du quai et de la marquise achevé (ouvert dès les étapes 1.3 et 1.4) et étape 1.5 | inauguration le dimanche suivant: musique, lampions, premier bal; Firmin lit la lettre de la coopérative: « Si la voie des Vergers est dégagée, le train ira jusque là-haut. » |

**Chapitre 2: Les Vergers** (environ cinq semaines)

| # | Étape | Condition | Ce qui se passe |
|---|---|---|---|
| 2.1 | La draisine | 500 sous de pièces, que Mme Ferrand fait venir dans la journée | Basile et Firmin la remettent sur les rails |
| 2.2 | La voie des Vergers | quatre obstacles dégagés à deux, un par jour au plus (chaque nuit, Firmin et Basile consolident la voie derrière vous) | arbres coupés puis portés à deux, éboulis déblayé à deux, pont de la Combe reconstruit; arrivée aux Vergers |
| 2.3 | Le hameau endormi | avoir parlé aux cinq habitants des Vergers | Nadia vous montre le lopin et la gare en ruine |
| 2.4 | Le verger d'Hélène | lien avec Hélène niveau 2, puis scène à deux: tailler le vieux pommier ensemble | Hélène vous confie le verger en terrasses et deux plants (un pommier, un cerisier) |
| 2.5 | Les chèvres de Rose | lien avec Rose niveau 2, puis scène à deux: rentrer le troupeau | deux chevrettes, qui vivent chez Rose tant que vous n'avez pas d'enclos (30 planches, 10 piquets) |
| 2.6 | Le rucher d'Augustin | lien avec Augustin niveau 2, puis scène à deux: l'un enfume, l'autre lève les cadres | une ruche |
| 2.7 | La gare des Vergers | chantier collectif achevé (ouvert à l'arrivée, avec la confiance niveau 3) | Nadia vous offre le plan de la serre |
| 2.8 | Le premier train des Vergers | étapes 2.3 à 2.7 achevées | inauguration le dimanche suivant; le train du samedi monte désormais jusqu'aux Vergers; Firmin retrouve dans la gare le carnet de son oncle, dont une page parle de Lac-Clair et d'une gare « qui n'est sur aucune carte » |

### 6.3 Habitants

Chaque habitant a une fiche (caractère, emploi du temps par jour de semaine et par météo, goûts, cinq étapes d'histoire, phrases du quotidien), écrite par game-designer avant l'alpha. Les étapes 3 et 5 sont des scènes à deux.

| Habitant | Lieu, rôle | Caractère | Adore, aime | Histoire en cinq étapes | Mentor de |
|---|---|---|---|---|---|
| Odette Ferrand | Halte, épicière et logeuse | gourmande, bavarde, rieuse | tarte aux pommes; confiture, miel, fleurs | sa recette secrète; le moule de sa mère; rouvrir la salle à manger de la pension; un visiteur qui cherche sa sœur (Gustave, son frère perdu de vue); les retrouvailles | Cuisine et conserverie |
| Firmin Lacombe | Halte, chef de halte bénévole, ancien cheminot | bourru, ponctuel, tendre | pain de campagne, truite grillée; planches, bûches | la montre arrêtée de son oncle Émile; la pendule de la halte; l'uniforme ressorti; la lettre d'Émile; la casquette à l'inauguration | la ligne, la draisine |
| Lucie Arnaud | Halte, factrice à vélo | curieuse, pressée, rêve de photographie | cartes postales, mûres; pain, fleurs | le vieil appareil photo; les huit points de vue (CN-07); la chambre noire; l'exposition à la halte; une photo du duo sur le quai | les points de vue |
| Basile Cornu | Halte, menuisier retraité, scierie | taiseux, patient | potée au chou; noisettes, planches de chêne | la scie à remettre en marche; l'apprentissage; le banc de la place; le pont de la Combe qu'il a bâti jeune; il rouvre son atelier | Bois et charpente |
| Jeanne Ribot | Halte, 10 ans, nièce de Lucie, en séjour pour l'année | intrépide, pose mille questions | fraises des bois, mûres; plumes, bonbons de miel | les jumelles de son grand-père (elle vous les prête: le carnet d'oiseaux s'ouvre); le martin-pêcheur; la cabane d'observation; le dessin d'oiseaux de la Veillée des contes; elle décide de rester dans la vallée | Pêche et cueillette, oiseaux |
| Hélène Vernet | Vergers, arboricultrice revenue de la ville | décidée, humour sec | crumble aux prunes; bleuets, pommes | le verger de son père; la greffe du vieux pommier; le jus de pomme d'automne; la fête des Vergers; elle reste | Maraîchage |
| Augustin Pellerin | Vergers, apiculteur dont la vue baisse | doux, philosophe, raconteur | fleur de sureau, miel; tournesols | les ruches orphelines; la reine perdue; les lunettes commandées à la ville (au catalogue); il vous confie le rucher; il se souvient d'une gare cachée (fil rouge) | Élevage (ruches) |
| Rose Tellier | Vergers, chevrière | énergique, chante faux | fromage de chèvre, pain; lentilles, fleurs | Câpre, la chèvre fugueuse (toujours retrouvée); le fromage de la Foire; le vieux chalet d'alpage; Victor (vous les aidez à se rapprocher); la valse | Élevage (chèvres) |
| Victor Galland | Vergers, ancien chef de fanfare, pêcheur de l'étang | rêveur, timide | friture de l'étang; miel, tarte | l'accordéon muet; le kiosque à réparer; le brochet légendaire; une valse pour Rose; le bal des Vergers | Pêche (étang) |
| Nadia Benali | Vergers, mécanicienne arrivée il y a deux ans | pragmatique, drôle | châtaignes; clous, piquets | le vélo de livraison; la pompe de la fontaine; le vieux locotracteur au fond de la gare (amorce du métier Cheminot); une boîte à outils pour le duo; elle ouvre son atelier au public | outils (niveau 3) |

### 6.4 Cultures, arbres, bêtes et produits

**Cultures** (graine par case, prix par unité en qualité ordinaire; calcul de la valeur nette dans `economie_et_chapitres.py`, partie 4):

| Culture | Saison | Famille | Jours | Repousse | Rendement | Graine | Prix | Lot | Net par case et par jour |
|---|---|---|---|---|---|---|---|---|---|
| Radis | printemps | Racines | 4 | non | 3 | 6 | 7 | 12 | 3,57 |
| Laitue | printemps | Verdures | 6 | non | 1 | 8 | 32 | 3 | 3,43 |
| Fèves | printemps | Légumineuses | 9 | non | 4 | 10 | 8 | 12 | 2,10 |
| Carotte | printemps | Racines | 8 | non | 3 | 12 | 16 | 6 | 3,43 |
| Bleuet | printemps | Fleurs | 7 | non | 2 | 10 | 16 | 6 | 3,14 |
| Fraisier (vivace) | printemps | Fruits | 10 | 3 jours | 2 | 50 | 10 | 8 | 1,43 la première année, 3,81 ensuite |
| Tomate | été | Fruits | 10 | 3 jours | 3 | 30 | 9 | 10 | 3,71 |
| Haricot vert | été | Légumineuses | 8 | 3 jours | 4 | 25 | 4 | 20 | 2,62 |
| Courgette | été | Fruits | 6 | 2 jours | 2 | 25 | 6 | 15 | 3,38 |
| Melon | été | Fruits | 12 | non | 1 | 40 | 110 | 1 | 3,33 |
| Blé | été | Verdures | 10 | non | 3 | 6 | 12 | 8 | 2,86 |
| Tournesol | été | Fleurs | 9 | non | 1 | 12 | 40 | 2 | 2,67 |
| Fines herbes | été | Verdures | 5 | 3 jours | 3 | 20 | 4 | 20 | 2,48 |
| Potiron | automne | Fruits | 13 | non | 1 | 30 | 100 | 1 | 3,33 |
| Betterave | automne | Racines | 7 | non | 2 | 10 | 17 | 6 | 3,43 |
| Chou | automne | Verdures | 10 | non | 1 | 15 | 50 | 2 | 3,33 |
| Pomme de terre | automne | Racines | 9 | non | 4 | 12 | 11 | 8 | 3,05 |
| Lentille | automne | Légumineuses | 9 | non | 4 | 10 | 8 | 12 | 2,10 |
| Poireau | hiver | Verdures | 10 | non | 2 | 15 | 24 | 4 | 3,14 |
| Mâche | hiver | Verdures | 5 | non | 3 | 8 | 7 | 12 | 2,48 |

**Arbres fruitiers** (Vergers, chapitre 2; 6 fruits tous les 2 jours en saison):

| Arbre | Saison | Plant | Prix du fruit | Lot | Revenu par saison de récolte |
|---|---|---|---|---|---|
| Cerisier | été | 240 | 5 | 18 | 300 |
| Prunier | été | 200 | 4 | 24 | 240 |
| Pommier | automne | 220 | 5 | 18 | 300 |
| Poirier | automne | 260 | 6 | 15 | 360 |

**Bêtes**: poules (Halte, jusqu'à 8), chèvres (Vergers, jusqu'à 6), ruches (Vergers, jusqu'à 6, 8 pour l'Apiculteur). Chaque bête a un nom choisi par le duo.

**Autres produits commandables** (prix, lot): œufs (8, 12), lait de chèvre en pot (15, 6), miel en pot (30, 3); planches (6, 15), piquets (4, 20), bûches (5, 20, automne et hiver), caisses (30, 3), chaises (90, 1); pain (15, 6), confiture (30, 3), soupe de légumes en pot (20, 5), bocaux de tomates (25, 4, été et automne), fromage de chèvre (35, 3), compote (20, 5, automne et hiver); goujons (8, 12), truites (30, 3, sauf l'hiver), chevesnes (15, 6), gardons (10, 9), perches (15, 6); pissenlits (4, 20), ail des ours (8, 12), mûres (3, 30), noisettes (3, 30), girolles (12, 8), châtaignes (3, 30), cynorhodons (5, 18). Les autres poissons et cueillettes se vendent (prix en section 6.5) sans être commandés.

### 6.5 Collections

**Oiseaux** (24; c commun, pc peu commun, r rare; P, E, A, H pour printemps, été, automne, hiver; T toute l'année):

| La Halte d'Aubrune | Saisons | Rareté | Les Vergers | Saisons | Rareté |
|---|---|---|---|---|---|
| Moineau domestique | T | c | Pinson des arbres | T | c |
| Merle noir | T | c | Mésange charbonnière | T | c |
| Mésange bleue | T | c | Chardonneret élégant | P, E, A | c |
| Rouge-gorge | P, A, H | c | Geai des chênes | T | c |
| Hirondelle rustique | P, E | c | Rougequeue noir | P, E, A | pc |
| Bergeronnette grise | P, E, A | pc | Grive musicienne | A, H | pc |
| Héron cendré | T | pc | Torcol fourmilier | E, A | pc |
| Pic vert | T | pc | Buse variable | A, H | pc |
| Rossignol philomèle | P, E | pc | Grosbec casse-noyaux | A, H | pc |
| Martin-pêcheur | T | r | Huppe fasciée | P, E, A | r |
| Chouette hulotte (nuit) | T | r | Grand-duc d'Europe (nuit) | A, H | r |
| Loriot d'Europe | P, E | r | Bouvreuil pivoine | A, H | r |

**Poissons** (12; prix de vente):

| Rivière Aubrune (Halte) | Saisons | Rareté | Prix | Étang des Vergers | Saisons | Rareté | Prix |
|---|---|---|---|---|---|---|---|
| Goujon | T | c | 8 | Gardon | T | c | 10 |
| Vairon | T | c | 4 | Perche | T | c | 15 |
| Chevesne | T | pc | 15 | Tanche | E, A | pc | 25 |
| Truite fario | P, E, A | pc | 30 | Carpe | E, A | pc | 35 |
| Barbeau | E, A | pc | 20 | Brochet | A, H | r | 70 |
| Ombre commun | A, H | r | 60 | Anguille (nuit) | E, A | r | 60 |

**Cueillettes** (12; prix de vente):

| La Halte d'Aubrune | Saisons | Rareté | Prix | Les Vergers | Saisons | Rareté | Prix |
|---|---|---|---|---|---|---|---|
| Pissenlit | P | c | 4 | Fraise des bois | E | pc | 5 |
| Ail des ours | P | pc | 8 | Girolle | E, A | pc | 12 |
| Morille | P | pc | 40 | Châtaigne | A | c | 3 |
| Mûre | E | c | 3 | Pleurote | A, H | r | 15 |
| Fleur de sureau | P, E | pc | 6 | | | | |
| Noisette | A | c | 3 | | | | |
| Cèpe | A | r | 45 | | | | |
| Cynorhodon | A, H | pc | 5 | | | | |

Ces tables et `collections_v1.py` sont tenus identiques: toute modification de l'un se reporte dans l'autre et se resimule.

### 6.6 Recettes (30)

- **Simples** (10; en-cas +20, Ventre 60): pain de campagne, omelette aux fines herbes, salade du potager, radis à la croque-au-sel, soupe de légumes, purée de pommes de terre, crêpes, truite grillée, poêlée de girolles, fromage frais au miel.
- **Mijotés** (10; en-cas +35, Ventre 80): potée au chou, ratatouille du jardin, gratin de courgettes, velouté de potiron, lentilles aux carottes, tarte aux poireaux, friture de l'étang, brochet au four, soupe de fèves, gratin de pommes de terre au fromage de chèvre.
- **Desserts** (6; en-cas +25, Ventre 50 seul): tarte aux pommes de Mme Ferrand, clafoutis aux cerises, crumble aux prunes, gâteau aux noisettes, compote de poires, melon au miel.
- **Conserves** (4; à vendre ou à cuisiner): confiture (de n'importe quel fruit), bocal de tomates, fromage de chèvre affiné, châtaignes au sirop.
- On apprend une recette auprès d'un habitant, d'un visiteur, d'une fête ou dans le courrier. Cuisiner se fait au réchaud de la pièce unique au début (recettes simples), puis dans la cuisine. Une recette donne deux portions (trois au rang 2). Le souper partagé (les deux à table, le même plat) donne Cœur +5 à chacun. Aucune recette ne contient de viande: les bêtes du duo ne sont jamais abattues.

### 6.7 Maison: pièces, meubles, outils

- **Pièces**: cuisine, chambre, salle commune, atelier, cellier, serre, et le coin à soi de chacun (section 4.7).
- **Meubles** (24 modèles, chacun en trois essences, sapin, chêne et merisier, et en six teintes de tissu quand il en a): paillasse, lit simple, lit double, matelas, édredon, table, chaise, banc, fauteuil, buffet, étagère, coffre, commode, fourneau, poêle, établi, tapis, rideaux, lampe à pétrole, horloge, miroir, pot de fleurs, cadre à cartes postales, poste à galène. Chacun a son coût en planches et accessoires, ses points de confort et de beauté (table de production, game-designer, avant l'alpha). Les fêtes et les visiteurs offrent huit meubles uniques en plus (la marquise miniature, le banc de Basile, l'horloge d'Émile...).
- **Outils** (barre de dix cases): main, houe, arrosoir, hache, pioche, canne à pêche, jumelles, marteau, et deux cases libres (graines, en-cas). Niveaux 1 à 3 pour la houe (1 case, 3 en ligne, 3x3), l'arrosoir (1 case, 3 en ligne, 3x3; 10, 20, 40 coups), la hache et la pioche (un coup de moins par niveau), la canne (fenêtre de ferrage +0,3 s par niveau), le marteau (travail x1, x1,25, x1,5).

### 6.8 Fêtes (quatre, une par saison, le 16e jour)

| Fête | Lieu | Activités (toutes facultatives, toutes à deux ou contre les habitants, jamais entre les joueurs) |
|---|---|---|
| Fête des semailles (printemps) | place du bourg | planter l'arbre de mai (geste à deux), la bourse aux graines (trois graines rares), le premier bal du soir |
| Les Feux de la mi-été (été) | bord de l'Aubrune | la pêche du duo (prises cumulées, ruban si le duo atteint le seuil), les lanternes sur la rivière (chacun écrit un vœu), le bal |
| La Foire aux bêtes et aux fruits (automne) | place du bourg, ou les Vergers le jour de leur inauguration (HI-03) | présenter une bête (rubans selon l'amitié), la plus belle courge (selon la qualité), l'étal du duo (ventes x1,5) |
| La Veillée des contes (hiver) | salle de l'épicerie | le conte à deux (chacun choisit à son tour la suite de l'histoire; les habitants applaudissent), l'échange de cadeaux d'hiver entre les deux joueurs, le chocolat chaud |

Une fête est « vécue » quand le duo a fait au moins une de ses activités ensemble. Une fête manquée revient l'année suivante.

### 6.9 Envies, annonces, visiteurs, courrier

| Contenu | Quantité en version 1 | Règle |
|---|---|---|
| Envies personnelles | 30 générales et 16 liées aux traits (deux par trait) | HA-07 |
| Envies à deux | 14 | HA-07 |
| Modèles d'annonces | 30 (livraisons, réparations, recherches) | EC-10 |
| Modèles de visiteurs | 12: randonneuse, colporteur, cousin de passage, peintre du dimanche, ornithologue amateur, photographe, inspecteur de la coopérative, vieux cheminot nostalgique, famille en pique-nique, botaniste, musicien ambulant, étudiante en géographie; plus Gustave, écrit à la main (histoire d'Odette) | HA-06 |
| Lettres | 40 (coopérative, habitants, visiteurs repartis) | arrivent au train ou par Lucie |
| Phrases du carnet pour la forme et les besoins | 45 (trois besoins, cinq niveaux, trois variantes) | PE-03 |

Volume d'écriture estimé: 1500 répliques et textes courts, écrits par game-designer, relus par le manager.

### 6.10 Pages du carnet de la vallée (165)

| Rubrique | Pages |
|---|---|
| Étapes de l'histoire (6 + 8) | 14 |
| Étapes des habitants (10 x 5) | 50 |
| Fêtes vécues | 4 |
| Pièces de la maison (6) et coins à soi (2) | 8 |
| Oiseaux | 24 |
| Poissons | 12 |
| Cueillettes | 12 |
| Recettes | 30 |
| Points de vue | 8 |
| Énigmes du chef de gare | 3 |
| **Total** | **165** |

### 6.11 Épisodes suivants

Un épisode = une gare, un chapitre (environ une saison et demie), cinq habitants, un terroir, un chantier collectif, une fête, une nouveauté de système. 53 journées et 14,7 h chacun (section 4.17).

| Épisode | Gare | Nouveauté | Contenu |
|---|---|---|---|
| 2 | Lac-Clair | métier Artisanat (poterie à l'argile du lac, tissage) | barque, pêche au lac, lavoir à rebâtir, Fête des lanternes du lac |
| 3 | La Tourbière | métier Cheminot (voie, signaux, wagons); croisement des semences et conservatoire | herboristerie, brumes, ruches de bruyère, wagon-serre |
| 4 | Les Hauts | rangs 4 et 5 de tous les métiers | estives, brebis et vaches, fromagerie, transhumance à deux, lauzes |
| 5 | Le Terminus oublié | fin de l'histoire | la gare qui n'est sur aucune carte, wagon-salon, grand concours de la vallée |
| Au long cours, réparti sur les épisodes | | | wagons restaurés (boutique, serre, salon), conservatoire complet, maison idéale, électrification de la vallée (premières ampoules), vélo |

Total: version 1 (23,3 h) + quatre épisodes (58,7 h) + long terme (18,1 h) = 100,1 h.

### 6.12 Univers, ton et écriture

- **Univers**: la vallée de l'Aubrune, imaginaire, entre moyenne montagne et campagne. Époque douce et indéfinie: vélos, poste à galène, lampes à pétrole, aucun écran. La ligne a fermé il y a vingt ans; une coopérative de cheminots retraités la rouvre, un train par semaine. Le duo arrive par le premier train avec les clés de la maisonnette du garde-barrière.
- **Ton**: tendre, nostalgique, drôle. Les petits bonheurs, des habitants attachants et un peu cabossés, une énigme légère en fil rouge.
- **Règles d'écriture**:
  - le jeu tutoie chaque joueur; un habitant qui s'adresse aux deux dit « vous »;
  - rédaction neutre, comme l'interface de Duo (question Q2): aucun texte ne s'accorde au genre d'un joueur. On écrit « Tu as mal dormi », « La fatigue se fait sentir », « Camille a rejoint la fête », jamais « tu es fatigué » ni « Camille est arrivée »; les noms des traits et des niveaux de forme sont épicènes;
  - phrases courtes, vocabulaire concret (outils, plantes, plats), pas de jargon de jeu vidéo dans les textes du monde (« endurance » reste dans les menus, les habitants parlent de fatigue);
  - pas de tiret cadratin ni demi-cadratin (CLAUDE.md);
  - pas de charabia: les habitants n'ont pas de voix, seulement leur motif musical et des sons non verbaux (rire, soupir).
- **Avant-goût**:
  - Firmin, au quai: « La ligne rouvre. Faites revivre la halte, et le train ira plus loin. Le premier samedi, on compte sur vous. »
  - Le tableau de la halte: « Commande de la coopérative pour samedi: 12 radis, 12 œufs, 15 planches, 3 truites. Le train part à 16 h, il n'attend personne, mais il revient. »
  - Le carnet, au réveil: « Tu as bien dormi et le souper était bon: pleine forme. Ton envie du jour: voir un martin-pêcheur. »
  - Mme Ferrand: « Vous deux, vous avez remis de la vie dans ma rue. Tenez, ma recette de tarte. Ne la donnez à personne. »
  - Basile, devant le pont: « Je l'ai bâti à vingt ans, ce pont. Il a tenu quarante hivers. À vous de lui en offrir quarante autres. »
  - Le récapitulatif du samedi: « La coopérative a reçu 4 lignes sur 5: 412 sous. Merci ! Les truites ont fait sensation à la ville. »
  - Absence: « L'horloge attend Camille. »

## 7. Direction artistique (directeur-artistique)

À compléter par directeur-artistique, après l'essai de style avec tech-artist. Exigences de conception qui doivent la guider:

- Lisibilité de la grille: on voit d'un coup d'œil les cases bêchées, arrosées (sol plus sombre et brillant), fatiguées (gris), les cinq stades de chaque culture, et la qualité d'une récolte quand elle saute au sac.
- Le regard du métier passe par des teintes au sol, des contours et des animations, distinguables par les daltoniens (luminosité et motif, pas seulement la teinte); aucun symbole au-dessus des têtes.
- Les deux personnages se reconnaissent à la couleur et au symbole de leur profil Duo (foulard, curseur du plan, épingle du repère, puce sur la carte), lisibles en vision daltonienne.
- Cinq expressions du portrait, lisibles en petit dans le HUD.
- Lumière du jour qui suit l'heure (matin, midi, soir, nuit) et palette par saison; une seule lumière directionnelle et des ombres légères (budgets de la plateforme).
- Un style par gare: pierre et bois à la Halte, colombages et tuiles aux Vergers; la maison du duo dans un kit de modules (murs pierre, bois, colombage; sols; toits calculés; portes; fenêtres).
- Murs et toits coupés dès qu'un personnage entre: chaque joueur voit l'intérieur où se trouve son personnage.
- Personnages et habitants sur un squelette commun; animations: marcher, porter à deux, bêcher, semer, arroser, couper, piocher, lancer, attendre et ferrer, cueillir, observer aux jumelles, marteler, scier, cuisiner, manger, s'asseoir, dormir, caresser, traire, parler, offrir, danser à deux, pomper, se taper dans la main, cinq expressions.
- Inventaire indicatif pour l'alpha: 2 personnages et 10 habitants personnalisables, 12 visiteurs assemblés à partir des mêmes pièces, 20 cultures à cinq stades, 4 arbres fruitiers à quatre états, une vingtaine d'arbres et arbustes du décor, 3 bêtes (poule, chèvre, ruche et abeilles), le train (locomotive, deux voitures, fourgon), la draisine, 24 meubles en trois essences, une centaine d'accessoires, 24 oiseaux, 12 poissons, 12 cueillettes.

## 8. Direction sonore (sound-designer)

À compléter par sound-designer. Exigences de conception:

- Le sifflet du train est le battement de cœur du jeu: audible dans toute la vallée le samedi à 10 h et à 16 h.
- Chaque action a son son (tableau 5.2); un tintement distinct pour les qualités « belle » et « superbe »; un air court pour chaque nouvelle page du carnet.
- Musiques par moment: petit-déjeuner, journée (un thème par gare, une couleur par saison), samedi, veillée (intime, pour deux), nuit, fêtes, scènes d'histoire; jamais de tension.
- Un petit motif instrumental par habitant, joué à l'ouverture d'une conversation; aucune voix, aucun charabia.
- Les chants des 24 oiseaux, reconnaissables.
- Priorités: 1. train, signal de l'autre (repère), proposition de gros achat, scène; 2. gestes à deux, récoltes, prises, nouvelles pages; 3. outils et pas; 4. ambiances (rivière, vent, insectes, pluie).

## 9. Interface et HUD (ux-ui-designer)

À compléter par ux-ui-designer. Exigences de conception:

- **Écrans du jeu**: création des personnages (simultanée, aperçu de l'autre), petit-déjeuner, partie, carnet (onglets sac, pages, métiers, courrier, carte, aides, réglages du monde), plan de la maison (deux curseurs), tableau de la halte (commande, annonces, catalogue, métiers), caisse, dialogues et scènes à deux (choix des deux visibles), propositions, écran de nuit (Continuer, Finir la séance, choix de l'autre visible), « Qui joue qui ? ». Les écrans de pause, de déconnexion et de fin restent ceux de la plateforme.
- **HUD**: horloge (jour de la semaine, date, heure, météo du jour, icône du lendemain), portrait et son expression, endurance discrète, barre d'outils de dix cases, bourse, indicateur de l'autre (portrait, lieu, activité), prochain objectif, ligne de notifications, flèches de rotation de la caméra.
- États à signaler: horloge arrêtée (veillée, absence de l'autre: « L'horloge attend Camille »), proposition en attente, commande du samedi (lignes cochées), catalogue livré, cadeau dans le coin.
- Aides de chaque joueur dans son carnet, sans trace chez l'autre.
- Textes neutres, tutoiement, taille de l'interface de la plateforme (100, 125, 150 %) appliquée au HUD, lisibilité en 1366x768, « Réduire les animations » respecté, tout faisable au clavier seul et à la souris seule (section 5).

## 10. Technique (architecte-technique, dev-reseau, tech-artist)

À compléter par leurs responsables. Besoins de conception à traiter (chacun appelle une décision technique, à poser à architecte-technique via le manager):

- Les deux joueurs peuvent être dans deux zones différentes: l'hôte fait vivre tout le monde (horloge, cultures, bêtes, habitants, train), chaque machine n'affiche que la zone de son joueur.
- Synchronisation d'un monde de plusieurs milliers d'objets: événements et instantanés par zone, pas d'instantané complet 30 fois par seconde (architecture, section 14). La simulation du monde peut tourner à un pas lent (les cultures changent le matin, les habitants marchent); seuls les déplacements des personnages demandent de la fluidité.
- Sauvegardes de 1 à 2 Mo (section 4.12), écrites sans figer l'image, plus une sauvegarde automatique toutes les 5 minutes; migrations testées en intégration continue sur des sauvegardes de référence de chaque version.
- Pour ce jeu à séances, « Retour au salon » et « Quitter Duo » closent une séance normale (PA-08), pas une partie interrompue: à confirmer avec la plateforme (hypothèse H-20 des critères de la plateforme).
- La liaison d'un personnage à son joueur demande un identifiant stable fourni par la plateforme, qui survit au changement d'hôte et, si possible, à la réinstallation d'une machine (H-18); sinon l'écran « Qui joue qui ? » prend le relais.
- Génération aléatoire du monde (météo, envies, commande, visiteurs) par le générateur à graine du SDK, état compris dans la sauvegarde.
- Budgets du PC de référence: une zone chargée à la fois par machine, cultures et arbres instanciés, une lumière directionnelle, ombres légères; changement de zone en 2 s au plus derrière un fondu.
- Poids du paquet: musiques par gare et par moment; à estimer avec sound-designer contre les 100 Mo de la plateforme.

## 11. Périmètre (game-designer, manager)

- **Version 1** (indispensable):
  - création simultanée des personnages, traits, trois besoins, forme, envies;
  - horloge partagée, journée, semaine, saisons, veillée, nuit, absence, fin de séance;
  - deux gares (la Halte d'Aubrune, les Vergers), la voie entre elles, les intérieurs;
  - chapitres 1 et 2 (14 étapes), deux chantiers collectifs, la draisine, les inaugurations;
  - cinq métiers aux rangs 1 à 3, dix spécialités, le regard du métier;
  - 20 cultures, 4 arbres, poules, chèvres, ruches; sol, rotations, qualité, aléas;
  - maison en plan à deux, six types de pièces, coins à soi, 24 meubles, outils à trois niveaux;
  - commande du samedi, confiance, catalogue, épicerie, annonces, gros achats;
  - dix habitants en cinq étapes, douze modèles de visiteurs, 40 lettres;
  - carnet de la vallée (165 pages): 24 oiseaux, 12 poissons, 12 cueillettes, 30 recettes, 8 points de vue, 3 énigmes;
  - quatre fêtes;
  - gestes à deux: porter, lever, pomper, danser et les gestes contemplatifs retenus en Q4;
  - aides de chaque joueur et réglages du duo;
  - trois mondes, sauvegardes, migrations, séances à l'historique, progression commune.
- **Plus tard** (bonus et épisodes): les quatre épisodes de la section 6.11; métiers Artisanat et Cheminot; rangs 4 et 5; croisement des semences et conservatoire; wagons; électrification; vélo; jeux de veillée (cartes, dames); variétés anciennes; photos souvenirs exportables; nouvelles fêtes et nouveaux visiteurs.
- **Hors périmètre**: combat, dangers, mort, maladie, perte définitive; romance avec les habitants; abattage des bêtes; horloge réelle et temps qui passe hors des séances; mode solo, plus de deux joueurs, jeu par Internet; génération procédurale de la vallée; écran partagé; manette; voix enregistrées et langue inventée; achats dans le jeu; classements; tout ce qui reprendrait les signes des jeux de référence (section 1.2).

## 12. Critères d'acceptation (qa-testeur)

Proposition de critères de conception, que qa-testeur reprendra, rendra testables dans sa forme (étant donné, quand, alors) et complétera avec les critères techniques. Modes proposés: U (simulation sous Node avec graine fixe), P2 (deux contextes dans le faux hôte), E ou EL (application), M (chez le client), D (relecture).

| # | Étant donné | Quand | Alors | Vérification proposée |
|---|---|---|---|---|
| CA-J1-001 | une partie en cours, les deux joueurs dehors à 10 h | 60 s réelles s'écoulent | l'horloge des deux avance de 75 minutes de jeu, identique sur les deux écrans | U, P2 |
| CA-J1-002 | un joueur dans un menu, l'autre dehors | 30 s s'écoulent | l'horloge avance; elle s'arrête dès que les deux sont dans un menu à la fois | U, P2 |
| CA-J1-003 | 19 h passées, les deux dans la maison | 5 min réelles s'écoulent | l'horloge ne bouge pas (veillée); elle repart quand l'un sort | U, P2 |
| CA-J1-004 | un personnage dehors à 23 h 59 | minuit sonne | il est à la maison, son Sommeil du lendemain a baissé de 30 (sauf Couche-tard) | U |
| CA-J1-005 | les deux couchés | l'écran de nuit s'affiche et l'un choisit « Finir », l'autre « Continuer » | la séance continue et chacun voit le choix de l'autre; elle finit quand les deux ont choisi « Finir » | P2 |
| CA-J1-006 | un joueur sans aucune entrée depuis 3 min, horloge en marche | la troisième minute s'achève | l'horloge s'arrête pour les deux, l'autre voit « L'horloge attend Camille » et peut agir; à 0 d'endurance, seules les actions gratuites restent possibles; une entrée de l'absent relance l'horloge | U, P2 |
| CA-J1-007 | un monde sauvegardé au jour 12 à 14 h 20 | les joueurs ne jouent pas pendant une semaine réelle puis le rechargent | le monde est à l'identique: jour 12, 14 h 20, mêmes cultures, mêmes positions (empreinte d'état identique) | U, E |
| CA-J1-008 | une sauvegarde écrite par une partie hébergée par le Mac | le PC héberge et charge cette sauvegarde | chaque joueur retrouve son propre personnage, à la même place; empreinte d'état identique au chargement chez le Mac | EL, M |
| CA-J1-009 | une sauvegarde dont l'identifiant d'un joueur n'est plus reconnu | elle est chargée | l'écran « Qui joue qui ? » s'affiche chez les deux; après confirmation des deux, la liaison est enregistrée et ne redemande rien au chargement suivant | P2 |
| CA-J1-010 | une coupure du réseau en plein geste « porter » | le lien revient et les deux reprennent | la poutre est au même endroit, la progression intacte, chacun à sa place | EL |
| CA-J1-011 | l'application de l'hôte tuée en pleine journée | Duo est relancé et la partie reprise | le monde reprend à la dernière sauvegarde, datée de 5 min au plus avant l'arrêt | EL |
| CA-J1-012 | une sauvegarde de chaque version publiée (sauvegardes de référence) | la version suivante la charge | la migration réussit, rien de ce que possède le duo ne disparaît (inventaire, bourse, rangs, liens, pages comparés) | U, CI |
| CA-J1-013 | un monde dont le chapitre 2 est achevé | une version avec un épisode de test le charge | la lettre de la coopérative arrive au train suivant et ouvre le nouveau chapitre; rien n'est réinitialisé | U |
| CA-J1-014 | la fin d'une séance | la plateforme reçoit le résultat | il contient pages remplies et disponibles, journées vécues, au plus trois faits marquants partagés de 60 caractères au plus, trois statistiques; aucun fait individuel | U, EL |
| CA-J1-015 | 100 séances simulées | le score cumulé est relu | la progression affichée est égale aux pages remplies de la dernière sauvegarde; aucun chiffre propre à un joueur | U |
| CA-J1-016 | 10 000 commandes générées sur des années simulées | on les compare | aucun produit dans trois commandes successives; trois métiers au moins dès que trois métiers ont des candidats; deux lignes au plus par métier; jamais moins de trois lignes | U |
| CA-J1-017 | une commande de cinq lignes dont quatre remplies | le train part à 16 h | quatre lignes payées x1,5, les produits de la cinquième payés au prix de base, confiance +4, rien de perdu; récapitulatif au courrier | U, P2 |
| CA-J1-018 | les deux récoltent la même culture à moins de 50 ms d'écart | l'hôte traite les deux intentions | une seule récolte, dans le sac du premier; l'autre voit « Déjà pris par Sacha » | U, P2 |
| CA-J1-019 | une bourse de 600 sous | les deux achètent chacun un objet à 400 sous en même temps | un achat passe, l'autre est refusé sans débit; la bourse finit à 200 | U, P2 |
| CA-J1-020 | un achat de 500 sous ou plus | un joueur le lance | une proposition s'affiche chez l'autre, la somme est réservée; refus ou nuit: rien n'est débité | P2 |
| CA-J1-021 | les deux sur la même case du plan | l'un la sélectionne | elle se verrouille à sa couleur chez les deux jusqu'à ce qu'il la relâche | P2 |
| CA-J1-022 | le coin à soi de Camille | Sacha tente d'y déplacer un meuble, puis y dépose un cadeau | le déplacement est refusé avec une raison; le cadeau est annoncé à Camille au petit-déjeuner | P2 |
| CA-J1-023 | une culture non arrosée pendant dix jours, puis hors saison | les jours passent | elle ne meurt pas; l'arracher rend sa graine | U |
| CA-J1-024 | une bête non nourrie pendant dix jours | les jours passent | elle est toujours là, en bonne santé, et produit dès qu'on la nourrit | U |
| CA-J1-025 | toutes les actions de la section 5.2 | chacune est déclenchée | chacune produit son retour visuel et son retour sonore (relevés par le crochet de test) | P2, M |
| CA-J1-026 | le jeu complet de la version 1 | on le joue à la souris seule, puis au clavier seul | chaque étape des chapitres 1 et 2 est faisable, aucune touche de la rangée des chiffres n'est utilisée | P2, M |
| CA-J1-027 | un clavier AZERTY | on appuie sur Z, Q, S, D | le personnage va en haut, à gauche, en bas, à droite; les libellés affichés sont ceux du clavier réel | E, M |
| CA-J1-028 | Échap pendant qu'un menu du jeu est ouvert | la touche est pressée | la plateforme met en pause; le menu du jeu ne s'est pas fermé à la place | P2 |
| CA-J1-029 | une scène à deux dont le point de rendez-vous est à la Halte, l'un des deux aux Vergers | trois jours de jeu passent | la scène attend, toujours annoncée; elle se déclenche quand les deux sont au point | P2 |
| CA-J1-030 | une scène à deux avec choix | les deux choisissent des répliques différentes | les deux répliques sont dites l'une après l'autre; l'issue de l'étape est la même que pour un choix identique | P2 |
| CA-J1-031 | l'aide Endurance généreuse activée chez un joueur | on parcourt l'écran de l'autre (HUD, carnet, menus) | aucune trace de l'aide n'y figure | P2 |
| CA-J1-032 | un geste à deux commencé | l'un relâche 30 s puis reprend | la progression est intacte, le geste se termine; aucun geste ne peut échouer | U, P2 |
| CA-J1-033 | la simulation `economie_et_chapitres.py` relancée sur les tables de configuration du jeu | elle s'exécute | le duo médian achève le chapitre 2 entre les jours 51 et 65, 95 % au moins des duos tranquilles avant le jour 84 | U |
| CA-J1-034 | la simulation `collections_v1.py` relancée sur les tables du jeu | elle s'exécute | 90 % au moins des duos médians finissent chaque collection dans l'année 1 | U |
| CA-J1-035 | 10 séances de prototype chez le client | on mesure la durée des journées | 16,6 min en moyenne, à 3 min près; sinon la durée d'une minute de jeu est recalée | M |
| CA-J1-036 | les séances de prototype chez le client | on mesure le temps passé à moins de 15 m l'un de l'autre et les rendez-vous (commande, gestes, veillée) | au moins un rendez-vous par journée de jeu; les deux joueurs disent n'avoir jamais attendu sans rien faire | M |
| CA-J1-037 | tous les textes du jeu | relecture et contrôle automatique | aucun accord au genre d'un joueur (liste de formes interdites), tutoiement de chaque joueur, « vous » pour les deux, aucun tiret cadratin ni demi-cadratin | D, U |
| CA-J1-038 | un nouveau joueur qui découvre le jeu | la première scène s'achève | il peut dire en une phrase ce qu'il faut faire (observé chez le client, moins d'une minute) | M |
| CA-J1-039 | un objet laissé au sol au bord de la rivière | trois jours passent | il est au cellier, avec la phrase de Lucie au courrier | U |
| CA-J1-040 | une sauvegarde de fin de version 1 générée par le jeu | on la mesure | elle pèse moins de 2 Mo | U |

## 13. Jalons (manager)

| Jalon | Contenu attendu | Date visée | Validé le |
|---|---|---|---|
| Démo d'une heure (avant le prototype) | la première semaine, du train du jour 1 au train du jour 8, avec quatre habitants, trois cultures, douze meubles, la commande du samedi en point d'orgue; périmètre, textes, assets et réglages dans `docs/jeux/jeu-1/demo.md` | | |
| Prototype | jouable à deux en réseau, formes simples, une à deux heures de jeu: la Halte réduite, la maisonnette et le chantier d'une pièce, trois cultures (radis, laitue, carotte), les poules, deux habitants (Mme Ferrand, et Firmin pour le train), l'horloge partagée, la veillée, le souper et la forme, la commande du samedi (trois lignes), le regard de deux métiers (Maraîchage, Cuisine), le geste « porter une poutre », l'absence, la sauvegarde et la reprise en changeant d'hôte, la séance à l'historique. Questions à trancher: la journée à deux est-elle agréable et bien rythmée ? passe-t-on assez de temps ensemble ? le regard du métier fait-il parler ? Mesures pour recaler l'économie (CA-J1-035, CA-J1-036) | | |
| Alpha | toutes les fonctions et tout le contenu de la version 1 (section 11), assets provisoires, tous les textes en premier jet, cartes de level-designer, simulations relancées sur les tables du jeu | | |
| Bêta | assets définitifs, son et musiques, textes relus, finitions, budgets tenus sur le PC, aucun bug bloquant; une année complète jouable; migration éprouvée avec un épisode de test | | |
| 1.0 | recette réussie sur les deux machines, jeu publié dans Duo | | |

## 14. Questions ouvertes et décisions

| # | Question | Options | Recommandation | Décision du client | Date |
|---|---|---|---|---|---|
| Q1 | Le titre | « La Petite Ligne »; « Samedi, le train »; « Les Saisons d'Aubrune »; « Le Train d'Aubrune » | garder « La Petite Ligne »: aucun conflit trouvé, et le titre dit le cœur du jeu; le confirmer à la bêta après une dernière vérification | | |
| Q2 | Les textes s'accordent-ils au genre de vos personnages ? | rédaction neutre pour tous (comme Duo); ou un choix « il » ou « elle » à la création | rédaction neutre: cohérente avec Duo, un seul texte à écrire et à tester; elle reste naturelle (« Tu as mal dormi », « La fatigue se fait sentir ») | | |
| Q3 | Le périmètre de la version 1 | celui de la piste A (six métiers et Cheminot, 30 cultures, croisement des semences); ou celui de ce cahier (cinq métiers, 24 plantes, Artisanat et Cheminot aux épisodes 2 et 3) | celui de ce cahier: moins de systèmes, mais chacun complet, pour une version 1 plus tôt entre vos mains; rien n'est abandonné | | |
| Q4 | Jusqu'où va la tendresse entre vos deux personnages ? | complices (danser, s'asseoir sur un banc, échanger des cadeaux, lit double); tendres en plus (se tenir la main en marchant, câlin à la veillée); aucun geste entre eux | complices et tendres en douceur: les gestes de la deuxième option, rien de plus explicite; tous facultatifs, on ne les fait que si l'on veut | | |

## 15. Historique

| Date | Version | Changement | Demandé par |
|---|---|---|---|
| 2026-10-30 | 0.1 | Première rédaction des sections de conception (1 à 6, 11, proposition de la 12), simulations jointes, quatre questions | game-designer, sur brief du manager |
| 2026-10-30 | 0.1 | Ajout du jalon « Démo d'une heure », détaillé dans `demo.md` | client, via le manager |
