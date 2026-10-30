# Jeu 1: trois pistes de concept

| Champ | Valeur |
|---|---|
| Statut | proposition, en attente du choix du client |
| Version du document | 0.1 |
| Dernière mise à jour | 2026-10-30 |
| Rédaction | game-designer |
| Suite | cahier des charges de la piste choisie (`docs/jeux/<id>/cahier-des-charges.md`) |

## En bref

L'idée du client: une vie de village paisible, une ferme, une maison qu'on construit, des personnages qui ont des besoins et des métiers, le tout en coopération, avec une histoire principale, des quêtes secondaires et une centaine d'heures de jeu sans ennui. Trois façons très différentes de la réaliser:

- **A. La Petite Ligne**: vous vous installez au terminus d'une petite ligne de train qui rouvre et vous faites revivre la vallée gare après gare. Vie à deux, chacun son rythme, des rendez-vous qui donnent envie d'être ensemble. C'est la piste la plus fidèle à l'idée.
- **B. Le Puits aux Étoiles**: vous tenez un caravansérail dans une oasis. Le jour, chacun cultive et construit à sa guise; le soir, vous servez les voyageurs en brigade, l'un en salle, l'autre aux fourneaux, et chacun voit ce que l'autre ne voit pas. C'est la piste qui fait le plus parler, et la moins chère à produire.
- **C. Les Nuits de Brumecombe**: vous êtes deux lutins qui veillent en secret sur un village. La nuit, vous réparez, cultivez et exaucez des vœux sans vous faire voir; au matin, vous regardez les habitants découvrir vos cadeaux. C'est la piste la plus originale et la plus complice.

| | A. La Petite Ligne | B. Le Puits aux Étoiles | C. Les Nuits de Brumecombe |
|---|---|---|---|
| Univers | vallée rurale, époque douce et indéfinie | désert et oasis, monde inventé | village de conte au bord d'une forêt |
| Ton | tendre, nostalgique, drôle | chaleureux, coloré, parfum de voyage | espiègle, merveilleux, un peu mélancolique |
| Coopération | deux vies entrelacées | brigade aux rôles complémentaires | complices: tours à deux, dons qui se complètent |
| Besoin de se parler | modéré, surtout pour s'organiser | fort pendant le service du soir | fort pendant la tournée de nuit |
| Le temps | horloge partagée, veillée hors du temps | journée en phases, service lancé à deux | nuits chronométrées, journée libre au terrier |
| Fidélité à l'idée | très forte | moyenne: les besoins sont ceux des hôtes | partielle: vous aidez des vies plus que vous n'en menez une |
| Originalité | bonne (le train comme colonne vertébrale) | bonne (le genre « auberge » existe déjà) | très forte |
| Coût de production | gros | moyen | moyen à gros, risque technique le plus haut |

Recommandation: **la piste A**, argumentée en section 6. Les questions pour le client sont en section 7, les simulations en section 5.

## 1. Socle commun aux trois pistes

### 1.1 Ce que nous gardons de l'idée

Le genre et l'intention: la simulation de vie paisible, la ferme, la construction et l'aménagement d'une maison, les besoins des personnages, les métiers, un village avec ses habitants, une progression, une histoire principale, des quêtes secondaires, une centaine d'heures. Le tout pensé pour deux, jamais pour un.

### 1.2 Ce que nous écartons dans les trois pistes (règle de création originale)

Le client a cité deux jeux connus comme références de genre: un jeu de vie paisible sur une île et un jeu de simulation de vie. Aucune piste ne reprend leur nom, leur univers, leurs personnages, leur présentation ni leurs mécaniques emblématiques. Concrètement, dans aucune piste:

- pas d'île ni d'arrivée « en vacances » sur une terre vierge;
- pas de voisins animaux qui parlent;
- pas de prêt immobilier à rembourser à un commerçant;
- pas d'horloge calée sur l'heure et le calendrier réels;
- pas de musée auquel on donne poissons, insectes et fossiles, pas de chasse aux insectes à collectionner;
- pas de tableau de bord de jauges de besoins, pas de symbole flottant au-dessus des têtes, pas de langue inventée en charabia;
- pas de métiers exercés hors de l'écran pendant que le personnage disparaît;
- et, par prudence vis-à-vis des grands jeux de ferme du même genre: pas de ferme héritée d'un aïeul par une lettre, pas de bâtiment communautaire à restaurer en y déposant des lots d'objets, pas de mine à étages.

Chaque piste précise en plus ce qui la distingue (sections A6, B6, C6). Les noms sont provisoires: une vérification d'homonymie sera faite avant le nom définitif.

### 1.3 Règles communes

- **Deux joueurs, deux écrans**: chacun a son personnage (apparence, prénom, deux traits de caractère), lié à son profil Duo. Chaque écran suit son propre personnage: les deux peuvent être à deux endroits différents du monde.
- **Pas de punition**: rien ne se perd définitivement par erreur ou par absence. Une culture oubliée attend, un habitant déçu se rattrape, une soirée ratée rapporte moins mais ne retire rien.
- **Le temps n'avance que quand vous jouez à deux**: le monde est figé entre les séances (voir la question Q2 de la section 7).
- **Rythme des séances**: une journée de jeu dure environ 17 minutes réelles, veillée comprise. Une séance de 40 minutes fait donc deux à trois journées, et une séance de 10 minutes reste possible car on peut quitter à tout moment sans rien perdre.
- **Sauvegarde du duo**: un monde par duo (trois emplacements, pour avoir plusieurs mondes). Sauvegarde automatique au début de chaque journée (A et B) ou à chaque aube (C), à la fin de chaque chapitre, et en quittant, avec l'état exact du moment. Chaque personnage est rattaché au profil de son joueur, pas au rôle d'hôte ou d'invité: que la partie soit hébergée par le Mac ou par le PC, chacun retrouve son personnage. Les épisodes s'ajoutent à un monde existant sans recommencer la partie (format de sauvegarde versionné, à confirmer par l'architecte).
- **Déconnexion**: la plateforme met la partie en pause; à la reprise, chacun retrouve son personnage là où il était.
- **Résultat d'une séance** (historique de la plateforme): durée, journées jouées, trois faits marquants au plus (« Gare des Vergers rouverte », « Première nuit sans se faire voir »), progression commune en pour cent. **Score cumulé**: la progression commune du duo (chapitres terminés, collections), jamais un score individuel ni une comparaison entre les deux joueurs.
- **Contrôles**: déplacement par ZQSD (touches lues par leur position, libellés affichés selon le clavier réel), action et interaction à la souris, outils à la molette. La rangée des chiffres demande la touche Maj sur un clavier AZERTY: elle reste un raccourci facultatif, jamais un passage obligé. Toutes les touches sont reconfigurables.
- **Textes**: en français, le jeu tutoie chaque joueur; un habitant qui s'adresse aux deux à la fois dit « vous ».
- **Machine de référence**: le PC supposé Intel Core i3 de 2018 à graphique intégré. Toutes les vues proposées visent 60 images par seconde sur cette machine.

## 2. Piste A: La Petite Ligne

### A1. Identité

- **Nom provisoire**: La Petite Ligne.
- **Pitch**: installez-vous à deux au terminus d'une petite ligne de train qui rouvre, et faites revivre la vallée gare après gare: votre ferme, votre maison, vos métiers et vos voisins.
- **Fantasme du joueur**: « On se construit une vie à deux, à notre rythme, et chaque samedi le train nous ramène du monde, des nouvelles et de quoi rêver plus grand. »
- **Univers**: la vallée de l'Aubrune, imaginaire, quelque part entre moyenne montagne et campagne. Époque douce et indéfinie: vélos, poste à galène, lampes à pétrole et premières ampoules, aucun écran. La ligne de train a fermé il y a vingt ans et les hameaux se sont vidés. Une coopérative de cheminots retraités la rouvre, avec un seul train par semaine, le samedi. Le duo arrive par le premier train avec les clés de la maisonnette du garde-barrière, au bourg, et devient le gardien de la halte. Six gares attendent d'être rouvertes en remontant la vallée.
- **Ton**: tendre, nostalgique et drôle. Les petits bonheurs du quotidien, des habitants humains attachants et un peu cabossés, une légère énigme en fil rouge.
- **Avant-goût des textes**:
  - « Le train de samedi apporte trois lettres, une caisse de semis et un monsieur qui cherche sa sœur. »
  - « Tu as mal dormi: le lit grince et le vent passe sous la porte. Un vrai matelas, peut-être ? »
  - « Mme Ferrand: Vous deux, vous avez remis de la vie dans ma rue. Tenez, ma recette de tarte. Ne la donnez à personne. »

### A2. Coopération: deux vies qui s'entrelacent

- **Ce que chacun fait**: aucun rôle imposé. Au départ, les deux personnages savent tout faire à un niveau de base. Chacun choisit un métier principal, qui va plus vite et plus loin, et peut en changer à chaque saison en gardant ses niveaux. Bourse et cellier sont communs.
- **Interdépendance**: les fabrications croisent les métiers. La charpente demande les planches du bûcheron, la conserverie les légumes du maraîcher, le tissage la laine de l'éleveur. On peut tout faire seul, mais on va deux fois plus loin en se complétant.
- **Ce qui pousse à se parler**:
  1. **La commande du samedi**: chaque semaine, la coopérative de la ville envoie une liste de quatre à huit produits bien payés, à livrer avant le passage du train. Il faut se répartir le travail.
  2. **Le regard du métier** (asymétrie douce): chaque métier voit sur son écran ce que l'autre ne voit pas. Le maraîcher voit la vigueur du sol, le cuisinier les goûts des habitants, le charpentier l'usure des bâtiments, le pêcheur le temps du lendemain. « Le champ du haut est fatigué, plantons des fèves » ne peut venir que de lui.
  3. **Les gestes à deux**: porter une poutre, lever une charpente, pomper la draisine, danser au bal. Ils demandent les deux personnages côte à côte, sans aucune adresse (maintenir une touche ensemble).
  4. **Les gros achats**: ils demandent l'accord des deux.
- **Si les niveaux diffèrent**: les métiers n'ont pas la même exigence. Pêche, cueillette et élevage sont contemplatifs; maraîchage (sols, rotations, semences) et charpente (plans) récompensent l'optimisation. Chacun règle ses propres aides (endurance, arrosage assisté, plans tout faits) sans que l'autre le voie. Rien ne compare les joueurs: tout va au pot commun, et le samedi célèbre le duo.
- **Le temps**: une horloge partagée. La journée va de 6 h à minuit et dure 14 minutes réelles. Elle s'arrête quand les deux joueurs sont dans un menu ou une conversation, ou quand l'un demande la pause. Quand l'un parle à un habitant et que l'autre bêche, l'horloge tourne pour les deux, comme dans la vraie vie. Les scènes d'histoire ne s'imposent jamais à un joueur occupé: elles attendent au point de rendez-vous que les deux y soient. **La veillée**: dès 19 h, quand les deux sont chez eux, l'horloge s'arrête. On cuisine le souper, on décore, on dessine les plans, on fabrique, on lit le courrier, sans compter. La journée se termine quand les deux se couchent; celui qui s'est couché le premier peut se relever à tout moment. À minuit, qui est encore dehors rentre tout seul (« Il se fait tard, tu rentres par le sentier ») et dort moins bien.

### A3. Boucles

- **30 secondes**: biner, semer et arroser une planche; ramasser les œufs; poser une planche sur le chantier; échanger deux mots avec une voisine. Chaque geste a son retour: son, petite animation, objet qui saute dans le sac.
- **Une journée** (17 minutes): au petit-déjeuner, chacun découvre son envie du jour; soins et récoltes; travail de métier; livraison à la halte; un service rendu au village; veillée, souper partagé qui donne la forme du lendemain, décoration et plans.
- **Une semaine** (7 jours, 2 heures, environ trois séances): le samedi, le train. Commande à livrer, courrier, visiteurs, marché sur le quai. C'est le pouls du jeu.
- **Une saison** (3 semaines, 6 heures) **et un chapitre** (une gare, une saison et demie environ): rouvrir la gare suivante. Chantier collectif avec les habitants, nouveaux voisins, nouveaux produits, fête d'inauguration.
- **Le long terme**: six gares, une vallée qui reprend vie, une maison qui grandit d'année en année, un conservatoire de semences, des wagons restaurés et le mystère du terminus oublié.

### A4. Systèmes

**Ferme**
- Contenu: cultures (30 dans la version 1, 80 au total), vergers, ruches, poules, chèvres, brebis, vaches et ânes. La ferme s'étend le long de la ligne: un verger aux Vergers, des ruches à la Tourbière, des brebis aux Hauts.
- Profondeur: vigueur du sol et familles de cultures (rotations), arrosage, qualité des récoltes; croisement de semences sur trois caractères (taille, goût, résistance) pour obtenir des variétés anciennes à inscrire au conservatoire.
- Renouvellement: saisons; chaque gare apporte son terroir; aléas doux annoncés la veille (grêle, coup de sec).

**Construction et aménagement**
- Contenu: la maisonnette en ruine devient la maison du duo, pièce par pièce, puis atelier, grange, serre, poulailler, jardin. Les meubles se fabriquent (essence de bois, teinte, tissu).
- Profondeur: un plan sur grille que les deux éditent ensemble (chacun voit le curseur de l'autre), puis un vrai chantier: chaque élément posé en transparence se bâtit avec des matériaux et quelques secondes de travail, deux fois plus vite à deux; les poutres se portent à deux. Les pièces reconnues (cuisine, chambre, atelier, serre) débloquent des fonctions; confort et beauté nourrissent les besoins.
- Renouvellement: un style par gare (colombages des Vergers, bois clair du lac, pierre et lauzes des Hauts), décorations de saison, chantiers collectifs du village (lavoir, kiosque, pont, gares).

**Besoins des personnages**
- Contenu: trois besoins, Ventre, Sommeil et Cœur, lus sur le visage du portrait et dans une phrase du carnet, jamais comme des jauges.
- Profondeur: le matin, ils donnent la forme du jour (endurance, petits bonus). Le Cœur se nourrit du confort de la maison, des loisirs et des liens. Les deux traits de caractère choisis à la création (frileux, gourmand, rêveur, bavard...) changent ce qui compte. Chaque matin, chacun a une petite envie, parfois à deux: « pique-niquer au bord du lac avec toi ».
- Renouvellement: nouveaux loisirs, recettes et conforts; envies qui suivent la saison et l'histoire.

**Métiers**
- Contenu: Maraîchage, Élevage, Bois et charpente, Cuisine et conserverie, Pêche et cueillette, Artisanat (poterie, tissage), puis Cheminot à partir du chapitre 2 (voie, signaux, wagons).
- Profondeur: cinq rangs par métier; aux rangs 3 et 5, une spécialité à choisir entre deux (le maraîcher devient semencier ou serriste).
- Renouvellement: changer de métier principal à chaque saison; deux spécialités par métier, que les deux joueurs peuvent se répartir pour se compléter.

**Habitants**
- Contenu: trente habitants écrits à la main (cinq par gare), chacun avec son emploi du temps, ses goûts et une histoire en cinq étapes; des visiteurs du samedi tirés au hasard (randonneuse, colporteur, cousin de passage).
- Profondeur: une relation entre chaque habitant et chaque joueur; certaines scènes demandent les deux joueurs. Pas de romance avec les habitants: le couple, ce sont les joueurs. En revanche, on peut aider deux habitants à se trouver.
- Renouvellement: les habitants changent avec les chapitres (un mariage, un départ, un nouveau commerce).

**Histoire principale**
- Contenu: six chapitres, six gares: La Halte d'Aubrune, Les Vergers, Lac-Clair, La Tourbière, Les Hauts, Le Terminus oublié. Fil rouge: le carnet du dernier chef de gare, et une gare qui ne figure sur aucune carte.
- Renouvellement: chaque chapitre change l'économie (nouveaux produits, nouvelles demandes, nouveaux habitants).

**Quêtes secondaires**
- Histoires des habitants; petites annonces du panneau de la halte (livraisons, réparations, recherches), tirées au hasard parmi des modèles; commande du samedi; une fête par saison (Fête des semailles, Foire aux bêtes, Fête des lanternes du lac, Veillée des contes d'hiver).

**Propre à la piste: le train, la draisine et le carnet**
- Le train du samedi rythme l'économie et les arrivées, et sert à voyager entre les gares rouvertes. La draisine à bras se pompe à deux pour explorer les tronçons encore fermés. Plus tard, on restaure des wagons (wagon-boutique, wagon-serre, wagon-salon) qui roulent avec le train.
- Le Carnet de la vallée: oiseaux observés aux jumelles et laissés libres, cartes postales de chaque gare, tampons, recettes, variétés de semences.

### A5. D'où viennent les 100 heures

| Bloc | Heures | Contenu |
|---|---|---|
| Version 1: gares 1 et 2, une année de jeu | 22 | installation, maison, six métiers aux rangs 1 à 3, dix habitants, quatre fêtes |
| Gares 3 à 6, une par épisode | 60 | chaque gare: un terroir, cinq habitants, un chantier collectif, une fête, des rangs de métier |
| Long terme, réparti sur les épisodes et après la fin | 18 | wagons, conservatoire complet, grand concours de la vallée, maison idéale |

Simulation (section 5): 100 heures font environ 4,2 années de jeu et 150 séances de 40 minutes. Parade contre la répétition:

- chaque année, les saisons reviennent avec une nouvelle gare: jamais deux fois le même printemps;
- les gestes répétitifs s'automatisent avec la progression (arroseurs, apprentis, chèvre de levage): on passe du geste au plan;
- la commande du samedi se compose au hasard parmi les produits débloqués, sans jamais répéter une ligne trois semaines de suite;
- les collections ont un « coup de pouce » vers les entrées manquantes. Sans lui, le carnet d'oiseaux s'achève vers 200 heures (un duo sur dix au-delà de 300); avec lui, vers 106 heures, juste après l'ouverture de la dernière gare.

### A6. Ce qui la distingue des jeux de référence

- Une vallée qu'on remonte en train, pas une île: la progression est géographique et ferroviaire, et chaque épisode ajoute une gare.
- Des habitants humains, écrits, dont la vie change; aucun voisin animal.
- On finance des chantiers collectifs avec le village; aucune dette envers un commerçant.
- Le temps n'avance que quand on joue ensemble; aucune horloge réelle.
- Trois besoins lus sur le visage et dans le carnet; ni tableau de jauges, ni symbole au-dessus des têtes, ni charabia.
- On construit de ses mains, sur un chantier, en portant les poutres à deux; pas d'éditeur payé en argent.
- Les métiers se pratiquent à l'écran, de ses mains; personne ne disparaît « au travail ».
- Le couple est au centre: gestes à deux, envies à deux, veillée commune, aucune romance avec les habitants.

### A7. Vue suggérée

**3D aux formes simples (low poly), vue isométrique, caméra orientable par quarts de tour, murs coupés quand on entre.**

- La construction en modules (murs, planchers, toits, meubles) se produit très bien par scripts Blender, et un toit se calcule à partir des murs.
- Un seul squelette animé pour tous les personnages: les habitants se varient par pièces et couleurs, sans redessiner chaque animation.
- La vallée découpée en gares donne de petites scènes chargées une à une, bien adaptées au PC de référence.
- Le train et la draisine sont simples à modéliser et à animer en 3D.
- Budget indicatif, à valider par l'architecte et le directeur artistique: moins de 150 appels de dessin, moins de 200 000 triangles affichés, cultures et arbres instanciés, ombres légères ou précalculées, résolution réglable.

### A8. Risques, coût et plan de sortie

- **Coût: gros**. Six zones, trente habitants écrits, beaucoup de systèmes. Le découpage en gares permet de le payer épisode par épisode.
- **Risques et parades**:
  - trop de systèmes, aucun profond: la version 1 se limite à six métiers aux rangs 1 à 3, et chaque épisode n'ajoute qu'un système;
  - coopération trop lâche, chacun dans son coin: commande du samedi, gestes à deux, veillée commune; au prototype, on mesure le temps passé ensemble;
  - volume d'écriture (trente habitants en cinq étapes): étapes courtes, modèles réutilisables pour les annonces et les visiteurs;
  - performances de la 3D sur le PC: une gare chargée à la fois, instanciation, pas d'effets lourds.
- **Prototype** (formes simples, une à deux heures de jeu): la halte et la maisonnette, trois planches, trois cultures, des poules, une habitante, l'horloge partagée et la veillée, le chantier d'une pièce, un geste à deux (porter une poutre), une commande du samedi simplifiée. Question à trancher: la journée à deux est-elle agréable et bien rythmée ?
- **Version 1** (22 heures, une année de jeu): gares 1 et 2, six métiers aux rangs 1 à 3, Cheminot, dix habitants, trente cultures, six types de pièces, quatre fêtes, commande du samedi complète, vingt-quatre oiseaux au carnet.
- **Épisodes** (15 heures chacun): 2. Lac-Clair (barque, pêche au lac, lavoir); 3. La Tourbière (herboristerie, brumes, wagon-serre); 4. Les Hauts (estives, fromagerie, transhumance à deux, rangs 4 et 5); 5. Le Terminus oublié (fin de l'histoire, wagons, concours de la vallée). Total: 22 heures de version 1, 60 heures d'épisodes et 18 heures de long terme réparties sur les épisodes (section A5), soit environ 100 heures.

## 3. Piste B: Le Puits aux Étoiles

### B1. Identité

- **Nom provisoire**: Le Puits aux Étoiles.
- **Pitch**: tenez à deux un caravansérail au cœur d'une oasis: cultivez les jardins, agrandissez la maison et choyez les voyageurs, qui vous rapportent en échange leurs histoires et le monde entier.
- **Fantasme du joueur**: « Nous sommes les hôtes les plus chaleureux du désert: notre maison est la halte que tout le monde espère, et le monde vient à nous. »
- **Univers**: les Sables d'Ocre, un monde inventé. Une grande route caravanière relie la côte aux montagnes. À mi-chemin, un vieux caravansérail entoure un puits si profond qu'on y voit les étoiles en plein midi. Le puits s'est tu, son eau baisse, et les caravanes passent au large. Le duo gagne les clés du caravansérail en battant aux dés son vieux propriétaire, qui reste dans les parages pour commenter. Huit peuples inventés empruntent la route: les Salinières, les Bergers des Hautes-Terres, les Lettrés de l'Observatoire, les Nomades des Dunes Rousses, les Bateliers du Fleuve Lent, les Verriers de la Côte, les Pèlerins du Vent, les Colporteurs. Aucun ne copie une culture réelle (point de vigilance pour la direction artistique).
- **Ton**: chaleureux, coloré, parfum de conte de voyage, humour doux, une pointe de merveilleux (le puits, le ciel).
- **Avant-goût des textes**:
  - « Une marchande de sel, fourbue, demande une chambre fraîche et un plat qui ne pique pas. Elle a l'air d'avoir une histoire. »
  - « Ce soir, le vieux cartographe raconte la route des Salines. Tu notes: une oasis perdue, au sud, après trois dunes jumelles. »
  - « Une lettre arrive par pigeon: "Je pense encore à votre soupe aux dattes. Je vous envoie des graines de chez moi." »

### B2. Coopération: la brigade

- **Ce que chacun fait**: deux temps dans la journée. Pendant les **temps libres** (matinée, après-midi), chacun fait ce qu'il veut: jardins, bêtes, chantier, troc avec la caravane du jour, petite excursion. Pendant le **service du soir**, chacun prend un rôle au porte-tabliers:
  - **l'Accueil** (cour, salle, chambres): accueille, installe, sert, divertit. Lui seul voit les désirs et l'humeur des voyageurs, leurs coutumes, leurs anecdotes;
  - **les Fourneaux** (cuisine, cellier): lui seul voit les réserves, les cuissons et les recettes. Il compose les plats: chaud ou froid, épicé ou doux, copieux ou léger.
  - Les rôles s'échangent chaque soir. Quand la halte grandit, le hammam et les écuries deviennent des postes, et des employés tiennent ceux que vous laissez libres.
- **Ce qui pousse à se parler**: l'Accueil peut transmettre une commande simple par ticket (le nom du plat), mais les nuances ne passent qu'à la voix: « pas trop épicé, il a froid, quelque chose qui lui rappelle chez lui ». Les servir rapporte gros, sans être obligatoire. Les Fourneaux annoncent les manques: « Plus de dattes, je peux faire au miel. »
- **Si les niveaux diffèrent**: l'Accueil demande de l'écoute plus que des réflexes, les Fourneaux un peu d'organisation; chacun choisit le sien. Le rythme du service se règle (nombre de voyageurs, patience). Aucun voyageur ne part furieux: mal servi, il donne moins, c'est tout. Aides par rôle (recettes guidées, désirs plus explicites). Le duo peut décider « ce soir, on ferme » pour une journée tranquille, sans autre perte que la recette du soir.
- **Le temps**: une journée en phases. **Aube** (départs des voyageurs, cadeaux et mots d'adieu, 30 secondes). **Matinée et après-midi libres** (10 minutes au total, l'horloge tourne; de midi à 14 h, la chaleur ralentit le travail dehors, c'est l'heure de l'atelier et de la décoration). À 18 h, la cloche annonce la caravane: **le service commence quand les deux ont pris leur tablier**, ou à 19 h 30 au plus tard; celui qui est loin revient d'un geste par le chemin du puits. Pendant le service, l'horloge est figée: il dure le temps de servir, six minutes en moyenne. **Veillée aux étoiles** (une à deux minutes): un conte de voyageur, le courrier, le plan du lendemain. Chacun vaque librement en journée, et les deux temps forts (service, veillée) se vivent ensemble par construction.

### B3. Boucles

- **30 secondes**: accueillir une voyageuse, deviner ce qu'elle désire, le dire à l'autre; faire sauter des galettes; ouvrir une vanne pour irriguer une planche.
- **Une journée** (17 minutes et demie): départs et cadeaux; jardins et bêtes; chantier ou troc; service du soir; veillée et conte.
- **Une saison** (20 jours, 6 heures): Saison douce, Saison des caravanes (afflux), Saison des vents (tempêtes: on protège et on bâtit), Saison des pluies (le désert fleurit, cueillettes rares). **Un chapitre**: une route rouverte, avec ses peuples et ses marchandises.
- **Le long terme**: la réputation auprès de chaque peuple, les habitués qui reviennent, le livre d'or, le hameau qui grandit autour de la halte, la source à retrouver.

### B4. Systèmes

**Production**
- Contenu: jardins d'oasis en trois étages (palmiers, arbres fruitiers, légumes et herbes); chèvres, poules, abeilles, pigeons voyageurs, et les dromadaires des voyageurs aux écuries; four à pain, pressoir, séchoir, mélanges d'épices, eaux florales.
- Profondeur: l'ombre des étages hauts permet ceux du bas; l'eau du puits se répartit par des rigoles et des vannes que le duo creuse et règle: c'est le casse-tête de la ferme.
- Renouvellement: saisons très marquées, graines rapportées par les voyageurs, débit du puits qui augmente avec l'histoire.

**Construction et aménagement**
- Contenu: le caravansérail autour de sa cour: chambres, cuisine, hammam, écuries, terrasse, observatoire, et l'appartement du duo dans la tour. Autour, le hameau des habitants qui s'installent.
- Profondeur: chaque chambre a un thème et un confort, et chaque peuple ses goûts: on décore pour attirer qui l'on veut. La disposition compte (distance cuisine-salle, fraîcheur des chambres).
- Renouvellement: matériaux et motifs rapportés des routes, nouvelles ailes à chaque chapitre.

**Besoins des personnages**
- Contenu: ce sont surtout ceux des hôtes: faim, soif, repos, propreté, température (chaud le jour, froid la nuit), distraction, curiosité. Le duo a seulement une fatigue légère, effacée par la veillée.
- Profondeur: chaque voyageur est un petit problème à résoudre: peuple, métier, deux traits, un désir, une anecdote.
- Renouvellement: voyageurs composés au hasard (des milliers de combinaisons) et tirés sans doublon de désir dans une même soirée; habitués écrits à la main.

**Métiers**
- Contenu: Jardinage, Cuisine, Hospitalité (coutumes, contes, musique), Artisanat (tapis, poterie, lanternes), Commerce (troc, contrats), Caravanier (excursions). Chacun progresse dans tous, et se spécialise en pratiquant.
- Profondeur: les **employés**, voyageurs qui posent leurs bagages, avec leurs traits, leurs besoins et leur progression. Ils prennent la relève des postes que le duo délègue.
- Renouvellement: on passe peu à peu de « faire » à « organiser »; nouveaux postes et recettes à chaque chapitre.

**Habitants et voyageurs**
- Contenu: douze habitants du hameau et vingt habitués écrits à la main, qui reviennent chaque saison et dont l'histoire avance à chaque visite; les voyageurs de passage, composés au hasard.
- Profondeur: une réputation auprès de chaque peuple, qui décide qui vient.
- Renouvellement: les habitués changent de vie, amènent leurs proches, écrivent.

**Histoire principale**
- « Le Puits qui s'est tu », cinq chapitres: Rouvrir la halte; La Route des Salines; La Saison des vents (sauver une caravane perdue); L'Observatoire (lire le ciel pour retrouver la rivière souterraine); La Source (descendre dans le puits). Chaque chapitre rouvre une route, avec de nouveaux peuples et de nouveaux produits.

**Quêtes secondaires**
- Contes de veillée qui ouvrent des quêtes; commandes des caravanes; histoires des habitués; lettres des anciens hôtes, arrivées par pigeon, avec cadeaux et demandes; banquets de saison.

**Propre à la piste: livre d'or, carte, excursions, ciel**
- Le livre d'or: chaque sorte de voyageur bien servie le signe (160 entrées).
- La carte des routes: elle se dessine au fil des récits.
- Les excursions (5 à 10 minutes, à deux ou chacun de son côté): dunes, salines, ruines, canyon; on y cueille, on y trouve, on y secourt.
- Le ciel: soixante constellations à reconnaître depuis la terrasse; elles guident les excursions.

### B5. D'où viennent les 100 heures

| Bloc | Heures | Contenu |
|---|---|---|
| Version 1: chapitres 1 et 2, une année | 20 | la halte rouverte, quatre peuples (le quatrième arrive par la route des Salines), trente recettes, premiers employés |
| Épisodes 2 à 4 (Vents, Observatoire, Source) | 45 | excursions, ciel, nouvelles ailes, un peuple de plus par épisode, fin de l'histoire |
| Épisode 5: Les Grandes Caravanes | 15 | le huitième peuple, réputation légendaire, banquets, hameau complet |
| Activités transversales | 20 | livre d'or, constellations, histoires des habitués, aménagement |

Simulation (section 5): 100 heures font environ 4,3 années de jeu et 150 séances de 40 minutes. Parade contre la répétition:

- le service change de nature avec la croissance: de trois à douze voyageurs, de deux postes à cinq, de l'exécution à l'organisation;
- les voyageurs sont composés au hasard, les habitués écrits, les événements de saison (caravane royale, tempête) bousculent la routine;
- les soirs de fermeture et les excursions cassent la répétition des services;
- le livre d'or a un coup de pouce vers les sortes de voyageurs jamais servies: sans lui, il s'achève vers 166 heures (un duo sur dix au-delà de 230); avec lui, vers 93 heures.

### B6. Ce qui la distingue des jeux de référence

- Une halte sur une route, au désert: le monde vient à vous; aucune île, aucune installation en vacances.
- Les besoins à combler sont ceux des hôtes: un art de l'hospitalité, pas la surveillance de jauges sur ses propres personnages.
- Des rôles à information séparée pendant le service, propres à un jeu sur deux écrans.
- La construction est celle d'un caravansérail qui fonctionne (circulation, fraîcheur, goûts des peuples), pas d'une maison libre.
- Aucun voisin animal, aucune dette, aucune horloge réelle, aucun musée.
- Vigilance: le genre « tenir une taverne ou une auberge » compte déjà plusieurs jeux. On s'en distingue par le désert et l'eau, par les voyageurs qui portent l'histoire et écrivent des lettres, par les rôles à deux écrans; on évite les codes de la taverne médiévale (chopes de bière, bagarres, quêtes de mercenaires).

### B7. Vue suggérée

**3D aux formes simples (low poly), caméra fixe façon diorama sur la cour, toits et murs avant qui s'effacent quand on entre, palette chaude.**

- Un lieu central unique, très soigné, produit une fois et enrichi par ailes.
- Des voyageurs assemblés sur un squelette commun (silhouettes, tenues, couleurs par peuple), avec des animations partagées (s'asseoir, manger, dormir, se baigner). En 2D, chaque animation de chaque peuple serait à dessiner dans chaque direction.
- Très peu de zones: le plus léger des trois pour le PC de référence.

### B8. Risques, coût et plan de sortie

- **Coût: moyen**. Un lieu central, des voyageurs composés au hasard, peu de zones. En contrepartie: beaucoup de recettes, d'objets et une interface de service soignée.
- **Risques et parades**:
  - le service devient une corvée ou un stress, contraire à la vie paisible: aucun échec, rythme réglable, fermeture possible, délégation aux employés; c'est la première question du prototype;
  - répétition des services sur 100 heures: croissance de la halte, habitués, événements, délégation;
  - un rôle paraît moins riche que l'autre: chacun a ses découvertes (coutumes et contes pour l'Accueil, recettes et épices pour les Fourneaux) et l'on échange chaque soir;
  - représentation des peuples: tous inventés, relus par la direction artistique.
- **Prototype** (une à deux heures): la cour, deux chambres, la cuisine, quatre planches irriguées, un service par jour, trois voyageurs de deux peuples, six recettes, rôles Accueil et Fourneaux avec information séparée. Question à trancher: le service à deux est-il drôle, bavard et sans stress ?
- **Version 1** (20 heures, une année): chapitres 1 et 2, quatre peuples, trente recettes, six types de pièces, hammam, huit habitués, quatre habitants, premiers employés.
- **Épisodes** (15 heures chacun): 2. La Saison des vents (excursions, sauvetage); 3. L'Observatoire (ciel, constellations); 4. La Source (fin de l'histoire); 5. Les Grandes Caravanes (après-histoire). Total: 20 heures de version 1, 60 heures d'épisodes et 20 heures d'activités transversales réparties sur les épisodes (section B5), soit environ 100 heures.

## 4. Piste C: Les Nuits de Brumecombe

### C1. Identité

- **Nom provisoire**: Les Nuits de Brumecombe.
- **Pitch**: vous êtes deux lutins qui veillent en secret sur un village: la nuit, vous cultivez, réparez et exaucez les vœux des habitants sans vous faire voir; au matin, vous les regardez découvrir vos cadeaux et changer de vie grâce à vous.
- **Fantasme du joueur**: « Être les bons génies d'un village, complices et espiègles: préparer une surprise à deux dans le noir, et voir au matin un visage s'éclairer. »
- **Univers**: Brumecombe, un village au bord d'une grande forêt, climat frais, brumes, toits de chaume, un moulin et un ruisseau. Autrefois, les Discrets, le petit peuple de la forêt, aidaient les villageois en échange d'une écuelle de lait laissée sur le seuil. Le pacte s'est oublié, les Discrets sont partis, le village décline. Le duo incarne deux jeunes Discrets venus s'installer sous les racines du vieux chêne. Ils sont hauts comme un genou: un dé à coudre fait un bol, une cuillère une pelle.
- **Ton**: espiègle et merveilleux, tendre, avec une pointe de mélancolie (le temps passe, les enfants grandissent). Beaucoup d'humour dans les rumeurs que le village invente sur vous.
- **Avant-goût des textes**:
  - « Le boulanger a retrouvé sa pâte pétrie au matin. Il jure que c'est l'œuvre de sa grand-mère. Sa femme, elle, a laissé un bol de lait sur la fenêtre. »
  - « Chut. Le chien dort d'un œil. Si tu passes par le potager, je l'occupe avec le grelot. »
  - « Le petit Anselme a glissé un mot sous l'escalier: "Je sais que vous existez. Vous pouvez réparer mon cerf-volant ? Je laisse des gâteaux." »

### C2. Coopération: les complices

- **Ce que chacun fait**: les deux lutins sortent ensemble chaque nuit pour une tournée. Chacun a un **don** choisi à la création, et en apprend d'autres plus tard, en moins puissant:
  - **Oreille fine**: entend les vœux et les rêves derrière les murs;
  - **Œil de chat**: voit dans le noir, sait qui dort et qui veille, voit la portée des regards et des lanternes;
  - **Main verte**: voit ce dont chaque plante a besoin;
  - **Doigts de fée**: répare et fabrique plus vite et plus finement.
  - Chaque écran montre ce que révèle son don, et lui seul.
- **Ce qui pousse à se parler**: les vœux ne s'entendent qu'avec l'Oreille fine, les dangers ne se voient qu'avec l'Œil de chat. « La meunière voudrait que son fils rentre. Et toi, tu vois quoi ? » « Le chien bouge, attends. » S'y ajoutent les **tours à deux**: la courte échelle pour atteindre une fenêtre, porter à deux, faire le guet (l'un voit par la fenêtre ce que l'autre ne voit pas), la diversion (l'un attire le chien, l'autre passe), tenir la lanterne (l'autre répare mieux).
- **Si les niveaux diffèrent**: la discrétion n'est jamais une épreuve d'adresse. Le guetteur guide l'autre à la voix. Les tâches des champs et de la forêt sont sans risque. Le sommeil des habitants se règle (profond, normal, léger). Être vu ne punit pas: tu disparais dans un petit nuage de fumée, tu réapparais au terrier, et le lendemain le village a une nouvelle rumeur. Les tours à deux se font en maintenant une touche ensemble, avec un petit bonus facultatif si le geste est bien synchronisé.
- **Le temps**: la nuit est le temps du jeu. Du crépuscule à l'aube, de 9 minutes réelles en été à 15 en hiver (12 en moyenne): les nuits d'hiver sont longues mais froides. Horloge partagée, qui s'arrête quand les deux joueurs sont dans un menu. À l'aube, il faut être rentré au terrier ou dans une cachette; sinon, retour automatique et le village « a vu quelque chose ». **Le jour**: une courte suite de scènes (une à deux minutes, que l'on passe si les deux le veulent) montre les réactions des habitants à votre nuit. Puis **le terrier**, hors du temps: fabriquer, décorer, préparer les remèdes, lire les mots des habitants, et préparer la tournée sur la carte du village, où chacun plante des épingles que l'autre voit. La nuit tombe quand les deux sont prêts.

### C3. Boucles

- **30 secondes**: se faufiler jusqu'à une maison, écouter un vœu à travers le mur, faire la courte échelle, glisser un remède sur une table de chevet, filer avant que la chandelle ne s'allume.
- **Une nuit et un jour** (16 minutes et demie): préparer la tournée au terrier; tournée dans les jardins, chez les habitants et en forêt; retour avant l'aube; scènes du matin (cadeaux découverts, rumeurs, offrandes); terrier.
- **Une lune** (8 nuits, 2 heures) **et une saison** (3 lunes, 6 heures et demie): la lune change chaque nuit. À la nouvelle lune, il fait noir et l'on passe inaperçu; à la pleine lune, tout est visible mais les plantes magiques poussent, et le marché des Discrets se tient sous la pierre levée. Chaque saison change le travail: semailles, moissons, bois de chauffe, neige.
- **Le long terme**: le village vit et vieillit. Un enfant devient apprenti, deux voisins se marient, une famille arrive si le village prospère. Le pacte se renoue et d'autres Discrets reviennent.

### C4. Systèmes

**Production**
- Contenu: les jardins et les champs des villageois, entretenus en secret (désherber, arroser, soigner avec la rosée de lune); le jardin secret du duo (herbes, champignons, fleurs de lune) qui fournit remèdes et cadeaux; la cueillette nocturne en forêt.
- Profondeur: vos soins changent les récoltes des habitants, donc leur humeur et leur prospérité.
- Renouvellement: saisons, huit phases de lune, plantes qui ne s'ouvrent qu'à certaines lunes.

**Construction et aménagement**
- Contenu: le terrier sous le chêne, agrandi salle par salle et meublé de trouvailles (un bouton fait une table, une boîte d'allumettes un lit); les **ouvrages de nuit** pour le village: un toit, une clôture, et sur plusieurs nuits un pont, la roue du moulin, une fontaine, que les habitants découvrent au matin.
- Profondeur: un grand ouvrage se prépare (plans, matériaux, nuits sans lune) et change la vie du village.
- Renouvellement: plans trouvés, ouvrages qui ouvrent de nouvelles histoires.

**Besoins des personnages**
- Contenu: ceux des villageois (faim, repos, chaleur, santé, moral, liens). Jamais en jauges: entendus comme des vœux (Oreille fine) ou vus comme des signes (cheminée froide, volet cassé, enfant qui pleure). Les lutins n'ont qu'une fatigue, l'endurance de la nuit.
- Profondeur: les villageois vivent seuls leur vie (travail, repas, visites, fêtes) selon des emplois du temps écrits, modulés par leurs besoins; vous l'influencez, vous ne la dirigez pas.
- Renouvellement: les besoins changent avec la saison et la vie de chacun.

**Métiers**
- Contenu: cinq arts que chacun apprend en pratiquant, quel que soit son don: Jardinier de nuit, Rebouteux (remèdes), Bricoleur (ouvrages), Tisseur de rêves, Messager (amitié avec le chat, la chouette, le chien). Et les métiers des villageois (boulanger, meunière, forgeron, bergère, maîtresse d'école), dont la carrière progresse grâce à vous: un apprenti devient maître.
- Renouvellement: quatre dons et cinq arts à répartir entre les deux joueurs, carrières des villageois qui évoluent.

**Habitants**
- Contenu: vingt villageois en huit foyers au départ, écrits à la main (caractère, histoire, emploi du temps), puis des nouveaux venus; les bêtes, qui ne parlent pas et se comprennent par gestes.
- Profondeur: la **croyance**. Chaque villageois croit plus ou moins aux Discrets. Ceux qui y croient laissent des offrandes (lait, miel, gâteaux: c'est votre monnaie) et des mots (vos quêtes).
- Renouvellement: les vies avancent, naissances, mariages, apprentissages, départs. Un jeune inventeur curieux pose des pièges pour vous apercevoir, et change de ruse chaque année. Pas de mort à l'écran: les anciens partent vivre chez leurs enfants, à la ville.

**Histoire principale**
- « Le Pacte oublié », six chapitres: S'installer; Le Moulin arrêté; L'Hiver long (un enfant malade, le remède des anciens); Le Grand Bal (rapprocher deux cœurs, faire revivre la fête); La Forêt profonde (retrouver les autres Discrets); Le Pacte (le village choisit de laisser la porte ouverte).

**Quêtes secondaires**
- Vœux composés à partir des besoins et des caractères; mots laissés par les villageois, écrits à la main; rêves; commérages du lavoir à démêler; services rendus aux bêtes.

**Propre à la piste: discrétion, lune, rêves, trouvailles**
- La discrétion: lumière, bruit, sommeil, regards; le chien et les oies donnent l'alerte, le chat est un allié.
- La lune: huit phases qui changent chaque nuit.
- Les rêves: entrer à deux dans le rêve d'un villageois, un petit monde onirique assemblé à partir de ses souvenirs, pour dénouer un cauchemar et découvrir son passé.
- Les trouvailles: 120 petits objets perdus à collectionner (billes, boutons, clés, médailles).

### C5. D'où viennent les 100 heures

| Bloc | Heures | Contenu |
|---|---|---|
| Version 1: chapitres 1 et 2, une année | 20 | le terrier, le village de base, quatre dons, les premiers ouvrages |
| Épisodes 2 à 4 (Hiver long, Grand Bal, Forêt profonde) | 45 | remèdes et rêves, fêtes et rapprochements, apprentis Discrets à envoyer en mission |
| Épisode 5: Le Pacte | 15 | fin de l'histoire, nouvelle génération du village |
| Activités transversales | 20 | trouvailles, grimoire, aménagement du terrier, vies des villageois |

Simulation (section 5): 100 heures font environ 3,8 années de jeu: les enfants du début sont apprentis à la fin. Parade contre la répétition:

- la lune et les saisons changent chaque nuit les conditions de la tournée;
- le village ne reste jamais le même: prospérité, nouvelles familles, carrières, mariages;
- en prospérant, les villageois ont moins besoin d'aide: on passe aux grands ouvrages, aux rêves, puis aux apprentis qu'on envoie en mission;
- les trouvailles ont un coup de pouce vers les objets manquants: sans lui, la collection s'achève vers 260 heures (un duo sur dix au-delà de 400); avec lui, vers 82 heures.

### C6. Ce qui la distingue des jeux de référence

- Vous n'êtes pas des nouveaux venus qui s'installent sur une terre vierge, mais des aides invisibles qui agissent pour les autres, en cachette.
- La vie autonome des habitants est un mécanisme du genre; ici on ne la dirige jamais: pas de commande directe des villageois, pas de construction libre de leurs maisons, pas de jauges. On l'influence en secret, et on la lit dans des vœux et des signes.
- Un jeu de nuit et de discrétion: absent des deux références.
- Un folklore du petit peuple (contes populaires, domaine public) et un univers inventé: Brumecombe, les Discrets, le pacte.
- Aucune île, aucun voisin animal qui parle (les bêtes restent des bêtes), aucune dette, aucune horloge réelle, aucun musée.

### C7. Vue suggérée

**2D en vue de dessus légèrement inclinée, style livre de contes: décors et personnages vectoriels (SVG) animés par pièces articulées, nuit rendue par calques (obscurité, halos de lanterne, fenêtres éclairées).**

- La discrétion demande une lecture parfaite de qui voit quoi et où porte la lumière: la vue de dessus en 2D est la plus claire.
- Une nuit pleine de petites lumières coûte cher en 3D sur un graphique intégré, presque rien en 2D.
- Des personnages en pièces articulées: un squelette, des pièces interchangeables, donc des villageois variés qui grandissent et vieillissent en changeant de pièces.
- Le style livre de contes sert le folklore et se produit par scripts SVG.
- Contreparties: toits qui s'effacent pour les intérieurs, trois vues par personnage (face, dos, profil).

### C8. Risques, coût et plan de sortie

- **Coût: moyen à gros**, avec le risque technique le plus élevé des trois pistes.
- **Risques et parades**:
  - la vie autonome des habitants est le système le plus complexe des trois pistes: emplois du temps écrits à la main, modulés par quelques besoins, plutôt qu'une intelligence entièrement libre;
  - la discrétion peut frustrer le joueur le moins à l'aise: réglages, aucune punition, rôle de guetteur; à mesurer au prototype;
  - écart avec l'idée du client: vos personnages n'ont ni métier ni maison au sens habituel, leur vie à eux passe par le terrier et les dons;
  - monotonie de la nuit: lune, saisons, lanternes, scènes du matin en plein jour;
  - tristesse du temps qui passe: pas de mort à l'écran, des départs racontés avec douceur.
- **Prototype** (une à deux heures): une rue, trois maisons, deux foyers, le terrier, une nuit suivie de son matin, la discrétion (sommeil, bruit, lumière, un chien), trois tours à deux, deux dons (Oreille fine, Œil de chat), six sortes de vœux. Question à trancher: la tournée de nuit est-elle drôle, bavarde et sans frustration ?
- **Version 1** (20 heures, une année): le village de base (huit foyers, vingt habitants), chapitres 1 et 2, lune et saisons, quatre dons, cinq sortes de rêves, terrier en six salles.
- **Épisodes** (15 heures chacun): 2. L'Hiver long; 3. Le Grand Bal; 4. La Forêt profonde; 5. Le Pacte. Total: 20 heures de version 1, 60 heures d'épisodes et 20 heures d'activités transversales réparties sur les épisodes (section C5), soit environ 100 heures.

## 5. Simulations: rythme et collections

Script: `docs/jeux/jeu-1/simulations/rythme_et_collections.py` (bibliothèque standard de Python, graine fixe, 16 secondes). Commande: `python3 docs/jeux/jeu-1/simulations/rythme_et_collections.py`.

### Rythme: ce que représentent 100 heures

Hypothèses: A, journée de 14 minutes plus 3 minutes de veillée, saisons de 21 jours; B, 10 minutes de temps libres, 6 minutes de service, 1 minute et demie de veillée, saisons de 20 jours; C, nuit de 12 minutes en moyenne, 1 minute et demie de scènes du matin, 3 minutes de terrier, saisons de 24 nuits. Quatre saisons par an.

| Piste | Minutes par journée | Heures par saison | Heures par année | Années pour 100 h | Journées | Séances de 40 min | Journées par séance de 40 min |
|---|---|---|---|---|---|---|---|
| A | 17,0 | 6,0 | 23,8 | 4,2 | 353 | 150 | 2,4 |
| B | 17,5 | 5,8 | 23,3 | 4,3 | 343 | 150 | 2,3 |
| C | 16,5 | 6,6 | 26,4 | 3,8 | 364 | 150 | 2,4 |

À deux heures de jeu par semaine, 100 heures représentent 50 semaines, soit environ un an de soirées.

### Collections: pourquoi un « coup de pouce »

Une collection tirée au hasard se remplit vite au début puis traîne: les dernières entrées, rares ou saisonnières, peuvent manquer pendant des dizaines d'heures. C'est une source classique d'ennui sur un jeu long. Modèle: trois raretés (45 % d'entrées communes, 40 % peu communes, 15 % rares, de poids 6, 3 et 1), saisons et déblocages propres à chaque piste, 2000 parties simulées. Le coup de pouce donne quatre fois plus de chances aux entrées jamais vues.

| Collection | Tirage | 50 % atteint | 90 % atteint | 100 % atteint |
|---|---|---|---|---|
| A: carnet d'oiseaux (72 espèces, 5 observations par heure, 2 saisons sur 4, dernière gare à 81 h) | au hasard | 45 h (49) | 99 h (109) | 200 h (305) |
| | coup de pouce | 40 h (44) | 85 h (89) | 106 h (132) |
| B: livre d'or (160 sortes, 17 voyageurs par heure, peuples débloqués jusqu'à 75 h) | au hasard | 31 h (32) | 81 h (84) | 166 h (230) |
| | coup de pouce | 24 h (30) | 76 h (76) | 93 h (109) |
| C: trouvailles (120 objets, 6 par heure, 3 saisons sur 4) | au hasard | 15 h (18) | 65 h (79) | 260 h (409) |
| | coup de pouce | 11 h (13) | 30 h (35) | 82 h (120) |

Lecture: valeur médiane, et entre parenthèses la durée sous laquelle se trouvent neuf duos sur dix.

Conclusions pour le cahier des charges:

- toute collection tirée au hasard aura un coup de pouce vers les entrées manquantes, réglable dans les tables d'équilibrage;
- son achèvement visé se place juste après le dernier contenu débloqué, pas au-delà de 100 heures;
- dans la piste C, le coup de pouce rend les trouvailles trop rapides au début (90 % en 30 heures): il faudra plus d'objets rares ou un rythme de découverte plus lent, à régler dans le cahier des charges si C est choisie.

## 6. Recommandation

**Je recommande la piste A, La Petite Ligne.**

1. **Elle tient toutes les promesses de l'idée**: sa ferme, sa maison bâtie de ses mains, ses propres besoins, ses métiers, un village et une histoire. Les pistes B et C déplacent une partie de ces promesses (les besoins vers les hôtes, la vie à soi vers les autres), ce qui est séduisant mais s'éloigne de ce que le client a décrit.
2. **Sa coopération convient à 100 heures et à deux niveaux différents**: chacun garde sa liberté et son rythme, et le jeu crée des rendez-vous qui donnent envie d'être ensemble (commande du samedi, gestes à deux, veillée) au lieu d'imposer une coordination de tous les instants, épuisante sur la durée.
3. **Sa structure est faite pour une sortie par épisodes**: chaque épisode ajoute une gare, donc un terroir, des habitants et un chapitre. La plateforme prévoit la mise à jour d'un jeu sans réinstaller l'application, et la sauvegarde suit le duo d'épisode en épisode.
4. **Son coût est le plus élevé, mais il se découpe**: la version 1 à deux gares est raisonnable, et chaque épisode se finance seul.

Deux idées des autres pistes se greffent sans dénaturer A: les visiteurs composés au hasard de B, qui descendent du train du samedi, et les tours à deux de C, déjà présents sous forme de gestes à deux. Si le client préfère être surpris plutôt que servi, la piste C est la plus forte, au prix du plus grand risque. Si le coût de production devient la priorité, la piste B est la plus économique.

## 7. Questions pour le client

| # | Question | Options | Recommandation |
|---|---|---|---|
| Q1 | Quelle piste ? | A, B, C, ou une piste avec un seul élément greffé d'une autre | A, pour les raisons de la section 6 |
| Q2 | Le monde avance-t-il quand vous ne jouez pas ? | seulement quand vous jouez à deux; selon l'heure et le calendrier réels | seulement quand vous jouez à deux: aucune pression entre les séances, rien de perdu pendant une semaine sans jouer, et c'est une vraie différence avec le jeu de référence « île paisible » |
| Q3 | Vos deux personnages vivent-ils ensemble ? | une maison commune; deux maisons voisines | une maison commune avec un coin à soi pour chacun (atelier, recoin à décorer), et pas de romance avec les habitants: le couple, c'est vous |
| Q4 | Quelle part de défi ? | aucune; légère; réelle (dangers, combats) | légère: exploration, petites énigmes, aléas annoncés la veille, jamais de combat ni de perte définitive |
| Q5 | Quel style visuel vous attire ? | 3D aux formes simples; 2D illustrée ou pixel art | 3D aux formes simples pour A et B, la plus adaptée à nos moyens de production et au PC; la décision finale revient au directeur artistique et à l'architecte, votre goût les guidera |
