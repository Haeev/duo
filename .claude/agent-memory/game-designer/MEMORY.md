# Carnet du game designer

Apprentissages durables (pièges, conventions, repères vérifiés). Pas d'avancement ici.

## Conventions de rédaction

- Dans les documents que lit le client, ne pas nommer les jeux qu'il cite en référence: écrire « le jeu de référence « île paisible » » ou « le jeu de référence de simulation de vie », et lister les éléments emblématiques écartés de façon générique.
- Tutoiement: le jeu tutoie chaque joueur; un personnage qui s'adresse aux deux joueurs à la fois dit « vous » (pluriel), ce qui reste conforme.
- Chiffres d'un plan de sortie: vérifier que version 1 + épisodes + activités transversales retombent sur le total annoncé (erreur commise puis corrigée le 2026-10-30).

## Homonymies et concepts déjà pris (à vérifier avant de proposer)

- Village bâti sur le dos d'une créature géante qui marche: existe déjà (city builder sorti en 2022).
- Taverne ou auberge avec ferme, brassage et coopération en ligne: genre encombré, plusieurs jeux existants; s'en distinguer nettement.
- « Les Discrets »: nom d'un groupe de musique français; éviter comme titre.
- « La Petite Ligne » (vérifié le 2026-10-30): aucun jeu, film, livre ni marque; expression courante (« petites lignes » ferroviaires), donc peu distinctive. Voisin: podcast « Monsieur Petites Lignes ». « Aubrune », « Samedi, le train », « Les Saisons d'Aubrune »: aucun résultat.
- Piège de l'outil de recherche: son résumé peut affirmer « de mémoire », sans source, qu'une œuvre existe. Ne jamais le reprendre sans une page qui le confirme; le signaler comme non vérifié.

## Écriture neutre (Duo ne connaît pas le genre des joueurs)

- Noms de traits épicènes qui marchent: Bonne fourchette, Craint le froid, Lève-tôt, Couche-tard, Langue bien pendue, Tête dans les nuages, Nid douillet, Nez au vent. Niveaux de forme: Petite forme, Ça va, En forme, Pleine forme, Forme rayonnante. Liens: Connaissance, Voisinage, Amitié, Grande amitié, Comme la famille.
- « Plus d'énergie » plutôt que « épuisé », « La fatigue se fait sentir » plutôt que « tu es fatigué ».
- Relire aussi les textes de conception: « deux habitantes » pour un homme et une femme est passé une fois.
- Pièges passés en recette (LPL-R04) et tournures neutres qui les remplacent: « les nouveaux » (de nouvelles têtes, les gens de la maisonnette), « tous les deux » (à deux, Retrouvez-vous à la maison), « des débutants » (pour un premier toit), « Chers nouveaux gardiens » (Bonjour à la nouvelle équipe), « Vous êtes les premiers voyageurs » (Personne n'était descendu ici). « Personne » et « quelqu'un » s'accordent comme pronoms, pas au joueur: permis.
- Le validateur des données de La Petite Ligne avertit de ces tournures et lit aussi le README: ne pas y citer de mauvais exemples, sinon il avertit sur le README lui-même.

## Libellés d'interface dans les données

- Avant de changer un libellé de `textes.json`, chercher dans `tests/e2e/` (Playwright clique par `getByRole(..., { name })`) et dans le code qui le réutilise: `ui.hud.day` sert aussi au libellé de la sauvegarde dans la bibliothèque de Duo (« samedi, jour 1, 14 h 20 »), où « jour N » distingue l'heure du jeu de la date réelle.
- Un brief peut demander un texte qui existe déjà (passe précédente non reportée dans ETAT.md): regarder `git log -S` avant d'écrire, puis améliorer et donner l'avant/après.
- Le manager peut committer pendant la mission: vérifier `git diff HEAD` avant le compte rendu pour dire ce qui reste à committer.
- « Chacun » est un masculin générique: l'éviter dans les textes du jeu (« Un goujon pour chaque canne », « à tour de rôle », « un pain par joueur »).

## Ajouter du contenu à La Petite Ligne (vérifié le 2026-10-31, semaine 2)

- Un objet dont le modèle n'a pas de substitut dans `src/rendu/substituts.ts` fait échouer `src/rendu/rendu.test.ts`, même si le GLB existe: le signaler au dev rendu à chaque nouveau modèle d'objet.
- Une nouvelle construction guidée ne s'affiche pas sans code de rendu dédié (`src/rendu/maison.ts`): pour du contenu « sans nouveau modèle », passer par dons (`given`), nuits (`nights_passed`) et scènes partagées.
- Le validateur lit le nombre de jours dans `reglages.clock.lastDay.day` et accepte `order.trains` et `order_complete` avec `day`.
- Le bois est fini (12 arbres, sans repousse, environ 7 abattus en semaine 1): ne pas remettre de planches dans une commande tardive.

## Repères de rythme (script `docs/jeux/jeu-1/simulations/rythme_et_collections.py`)

- Une journée de jeu d'environ 17 minutes réelles et quatre saisons d'environ 20 jours donnent environ 24 heures par année de jeu: 100 heures font environ 4 années de jeu et 150 séances de 40 minutes.
- À 2 heures de jeu par semaine, 100 heures font environ un an de vie réelle.
- Jeu 1, cahier v0.1 (`docs/jeux/jeu-1/simulations/economie_et_chapitres.py`): 0,8 s par minute de jeu, journée de 16,6 min en moyenne, 21 jours par saison, 23,3 h par année; 100 h = 361 journées.

## Collections tirées au hasard

- Sans aide, avec raretés (poids 6, 3, 1) et disponibilité saisonnière, atteindre 100 % prend 2 à 4 fois plus longtemps qu'atteindre 90 %: la fin traîne et ennuie.
- Un coup de pouce (poids x4 pour les entrées jamais vues) ramène l'achèvement juste après le dernier contenu débloqué. En faire la règle par défaut, réglable dans les tables d'équilibrage.

## Pièges de simulation

- Ne pas déduire un numéro de saison par division d'un temps en virgule flottante: au retour sur une frontière (6,6 x 3), l'arrondi peut bloquer la boucle sans fin. Compter les saisons par un entier.
- Pour une collection, seul compte l'instant de la prochaine entrée nouvelle: simuler cet événement (loi exponentielle entre deux changements d'état) est exact et des centaines de fois plus rapide que de simuler chaque tirage.

## Contrôles

- En AZERTY, la rangée des chiffres demande Maj: ne jamais en faire un passage obligé (barre d'outils à la molette, chiffres en raccourci facultatif).
- Entre AZERTY et QWERTY, seules A/Q, Z/W et M changent de place (le M AZERTY est le code `Semicolon`). Choisir les touches par défaut parmi les lettres qui ne bougent pas (B, C, E, F, G, R, X, Tab...), plus ZQSD par position et A et E (`KeyQ`, `KeyE`) pour tourner la caméra.
- Échap est réservé à la pause de la plateforme: un menu du jeu se ferme par sa propre touche ou par Retour arrière, jamais par Échap.

## Règles pour un jeu sans fin de partie sur Duo

- Horloge arrêtée pendant l'absence d'un joueur: plafonner ce que l'autre peut faire (endurance), sinon le temps figé devient un temps infini exploitable.
- La plateforme (H-11) inscrit « interrompue » une partie arrêtée par « Retour au salon »; pour un jeu à séances (H-20), c'est la fin normale d'une séance. À signaler au manager à chaque jeu de ce type.
- Rattacher chaque personnage à l'identifiant stable du joueur, jamais au rôle d'hôte, et prévoir un écran « Qui joue qui ? » quand l'identifiant n'est plus reconnu.

## Méthode de simulation (vérifiée sur le jeu 1)

- Des étapes calées sur un événement hebdomadaire (inauguration le dimanche) font des durées en marches d'une semaine: écrire « jour 23 [23-30] », pas une moyenne. Avant de rédiger une lecture (« c'est la confiance qui fixe le chapitre 1 »), mesurer quelle condition bloque vraiment: une première lecture était fausse.
- Une zone débloquée en cours de saison: ses entrées de collection doivent rester visibles les saisons suivantes, sinon l'achèvement glisse d'une année entière (17 % au lieu de 95 % sur le carnet d'oiseaux). Un coup de pouce par collection (x6 pour la plus grande, x4 ailleurs) vaut mieux qu'un seul réglage.
- Tenir les tables du cahier et les données des scripts identiques, et le prouver par un contrôle croisé automatique (analyse des tableaux Markdown contre les données du script).
- Un rattrapage proportionnel à ce qui reste (15 % des matériaux restants chaque samedi) ne change presque rien pour un duo médian et resserre la queue des duos lents: c'est le bon profil.
- `python3 script.py | head` lève BrokenPipeError: c'est le tube, pas le script.

## Démos courtes

- Une démo d'une heure qui couvre une semaine de jeu demande une horloge accélérée (0,35 s par minute de jeu pour 8 journées en 63 min, script `docs/jeux/jeu-1/simulations/demo_rythme.py`). Avec une horloge rapide, la marche mange la journée: carte compacte (64x48 m) et distances données en secondes.
- Pour une démo, fixer la commande et la météo (déroulé identique pour tous), et caler chaque quête sur un jour précis pour qu'il y ait une nouveauté par journée.
- Un objet livré au dernier jour (catalogue au train final) n'a pas d'effet jouable: mettre ce qui change la forme (le lit) en fabrication au milieu de la semaine.

## Données de jeu chargées par le code (La Petite Ligne, 2026-10-30)

- Conventions retenues: identifiants anglais en `snake_case`, clés en `camelCase` (comme `duo-game.json`), `tier` P0 ou P1 pour la priorité de production (ne pas l'appeler `priority`, déjà pris par la priorité numérique des dialogues). Schéma et vocabulaire des conditions et effets: `games/la-petite-ligne/donnees/README.md`; validateur: `games/la-petite-ligne/outils/valider_donnees.py`.
- Une valeur à un seul endroit: la commande vit dans `reglages.json` et les textes la citent par `{order}`; ne pas redire dans les réglages des conditions de quête.
- Piège: dans le contenu passé à l'outil d'écriture de fichiers, `"\u2014"` peut arriver comme un vrai tiret cadratin. Dans du code, écrire `chr(0x2014)`, puis relancer le contrôle typographique de CLAUDE.md.
- Après un effet qui vide un état (paiement de la commande), toute condition évaluée ensuite doit garder la valeur d'avant: le préciser dans le schéma.

## Anti-répétition sur 100 heures (script `docs/jeux/jeu-1/simulations/plan_100_heures.py`, 2026-10-31)

- Répliques du quotidien: le tirage « la moins récente pour ce joueur » divise par deux les redites récentes; une réserve par niveau de lien (8), par saison (10) et par temps (3), plus 40 % de souvenirs à variables, ramène les redites à moins de 28 jours à 0,7 %. Coût: environ 107 phrases par habitant, plus 20 par année vécue ensuite.
- Envies: une réserve fixe (même 24 par saison, même avec coup de pouce) est épuisée dès l'année 2; il faut un apport par arc (6 par saison) pour garder un tiers d'envies neuves.
- Volume d'écriture pour 100 h sans redite: environ 9 000 textes, six fois l'estimation naïve du cahier 0.1. Toujours chiffrer les réserves par habitant, pas un total global.
- Calendrier de référence de La Petite Ligne: 0,35 s par minute de jeu jusqu'au jour 23 (démo et J1), 0,8 s ensuite: 372 journées, 4,4 années, 99,9 h. Jour 16 = fête des semailles (dimanche), jour 22 = premier jour de l'été (samedi), jour 23 = inauguration.
- Piège mesuré par la revue du tour 1: le moteur de dialogues de la démo ne tire que parmi les répliques de plus haute priorité, d'où 55 % de redites; vérifier que la règle de tirage a changé avant d'en déduire un besoin d'écriture.
- Avant de nommer une quête, lister les titres de `quetes.json`: « Le quai en fête » et « Les gens du bourg » sont déjà pris par des quêtes de la démo.
- Constructions de la démo: format `elements` (`inputs`, `seconds`), deux joueurs vont deux fois plus vite; une bûche donne quatre planches à l'établi. Exprimer les chantiers dans ces unités, pas en « points de travail ».

## Mesurer les redites du quotidien (2026-10-31, tour 3)

- Script jetable `/tmp/lpl-gd/redites.test.ts` (lancé par `npx vitest run --root games/la-petite-ligne --dir /tmp/lpl-gd`): robots de `tests/aides.ts`, un joueur parle à chaque habitant visible à 13 h (ou 9, 13 et 17 h), règle ancienne et règle R4. Repère: 55 % de redites avant, 0 % après 14 répliques nouvelles par habitant avec R4.
- Avec R4, seules les répliques datées (jour du train, pluie, veille de pluie) restent en priorité 5 et plus; tout le quotidien en priorité 1. Une réplique quotidienne sans condition ne doit pas dire « ce matin » sans `time_is`.

## Ce que la caméra montre (La Petite Ligne, vérifié le 2026-10-31, tour 6)

- Caméra isométrique (élévation 35,26°, vues de 16, 24 et 36 m de large): le ciel ne se voit pas. Un objet à h mètres d'altitude monte de 0,82 h à l'écran; une volée « très haut » est hors champ. Faire passer les oiseaux bas, près des joueurs.
- Une cible à moins de 6 m de chaque joueur est à l'écran chez les deux, à tous les zooms et dans les quatre orientations (6 x 0,577 + 0,82 < 4,5 m de demi-hauteur au zoom serré). Au-delà, seulement aux zooms 2 et 3.
- Depuis l'intérieur de la maisonnette, le mur nord (environ 3 m) cache le sol sur 4 m derrière lui: un moment « vu de la maison » doit se jouer devant, ou exiger d'être dehors.
- L'Aubrune coule vers l'est (`flow` de l'eau +x dans `reglages-ambiance.ts`): l'amont est à l'ouest. Le gué (x 16 à 20) est la seule eau basse; une anse de sable au sud (x 23 à 31, y 42) et une langue de sable au nord (x 27 à 34, y 38).
- Seuls les 12 arbres `tree_edge_*` se coupent; `tree_oak_01` (52,5 ; 5,5), près de la remise, est un vieux chêne de décor sûr pour y accrocher quelque chose.

## Informations propres (R16)

- Les deux machines sont dans la même pièce: un son n'est jamais secret. Une information propre est visuelle ou textuelle, et l'autre écran ne doit jamais l'afficher.
- Les conversations sont déjà personnelles (SI-06): un dialogue réservé à un rôle suffit à confier un secret. L'état du monde entier part chez l'invité: le filtrage se fait dans l'interface (et peut se durcir côté hôte).
- `p1` est `players[0]` de `createWorld`, pas forcément l'hôte: écrire « premier joueur de la liste », jamais « l'hôte ».
- Un choix à N réponses permet au plus N - 1 erreurs: régler le coup de coude en dessous, sinon il ne sort jamais.
- Un nom propre qui commence par une minuscule (« la Duchesse ») ne doit jamais ouvrir une phrase par un espace réservé.

## Revues de textes (vérifié au tour 6)

- Accord caché au genre des joueurs: un participe après « vous » (« Le héron vous a vus ») s'accorde aux joueurs. Réécrire avec « avoir » et un objet (« Vous avez vu le héron »).
- Un texte qui dit où est un habitant (« Firmin est sur le quai ») doit tenir sur toute la plage horaire de la condition: comparer avec l'emploi du temps dans `habitants.json`.
- Des tests vérifient des phrases exactes (`src/interface/tests/moments.test.ts`, `tests/secrets.test.ts`): grep la phrase dans `tests/` et `src/**/tests/` avant de la changer; sinon la proposer au manager avec la ligne du test.
- Un texte d'apogée ou de récompense doit partir quand la chose est vue, pas quand elle commence: vérifier où le code émet la notification (`startClimax` l'envoyait au tick 0 au tour 6).

## Géométrie des moments (vérifié le 2026-11-01, tour 7)

- Outil: `docs/jeux/jeu-1/simulations/moments_tour7_geometrie.py` (M-02, cadre des zooms, ligne de vue dans les 4 orientations, cases des points). Il retrouve au centième les mesures du jeu (héron 3,6 s, oies 3,75, renard 3,6, mésanges 3,7): le réutiliser avant de proposer un lieu, plutôt que raisonner de tête.
- « Zoom 1 » = zoom de départ (`initialZoom: 1`, 24 m de large, 57 px par mètre à 1366 px); le zoom 0 fait 16 m. La caméra vise le pied du joueur.
- Rayon vers la caméra en orientation 0: chaque mètre vers l'est et vers le sud fait monter d'un mètre (x + s, y + s, z + s). Un objet de h mètres au sud-est d'un point, à moins de h mètres en diagonale, le cache. La remise et le houppier du chêne cachent la bande nord entre Firmin et la remise.
- Le test M-02 du jeu compte n'importe quel acteur et prend `watch.radius` comme seuil (3 m pour l'échelle); un acteur à 2,3 m de haut sort du cadre du zoom 0 depuis 4,5 m au sud-est (mésanges).
- Le modèle à boîtes pleines jusqu'au faîtage est prudent: « 0 % caché » est sûr, un fort pourcentage se recoupe par capture.

## Réserve de moments au long cours (simulation du tour 7)

- Avec 12 moments: 9 possibles au printemps, 8 en été, 4 en automne, 2 en hiver. Une chance fixe fait repasser les mêmes bêtes tous les 11 jours en hiver: réduire la chance quand la réserve de la saison est petite (`seasonPoolFull` 9).
- Fenêtre de 10 jours dès J2: écart médian en été de 18 à 21 jours sans perdre de moments; baisser la chance en retire.
- Après l'année 1, il faut 2 moments neufs par saison et par année pour garder une première fois dans 9 saisons sur 10 (coup de pouce x 3 aux jamais vus compris).
- Une quête à variante (l'échelle au jour 10, variante 1) qui débloque un moment (mésanges) prive la moitié des graines de ce moment: prévoir un rattrapage.
- `world.moments.history` grandit à chaque occurrence: proposer une mémoire bornée par moment (taille de l'état transmis).

## Relire un tour produit (vérifié au tour 7)

- Un texte de HUD écrit dans la conception peut exister dans `textes.json` sans être lu par le code: grep chaque clé nouvelle dans `src/` (hors tests). Au tour 7, `moment_freeze_*`, `moment_opposite_same_bank` et `moment_face_partner` étaient orphelins et la brume affichait « Sans bouger… » avec un anneau vide.
- Tester ce qu'affiche le HUD: test jetable dans `/tmp/<dossier>` qui importe `tests/aides` et `src/interface/tests/aides` (`uiContext`) par chemins absolus et appelle `watchModel`; lancer `games/la-petite-ligne/node_modules/.bin/vitest run --dir /tmp/<dossier>` depuis le dossier du jeu. La sortie console est masquée: écrire les résultats dans un fichier.
- La rumeur de l'onglet Souvenirs s'affiche sous « On dit au bourg… » (épinglé par un test): elle commence par « que » ou « qu' », en minuscule.
- Capturer l'onglet sans écraser les preuves des devs: copier `ui-maquettes/outils/capturer-souvenirs.cjs` dans `/tmp` avec `SORTIE` changé, Vite sur un port libre (le 5197 peut servir un autre arbre de travail), `NODE_PATH=$(npm root -g)`.

## Monde après le jour 15 (vérifié au tour 8, script `simulations/tour8_suite.py`)

- Les robots de la démo restent oisifs après le jour 15 (bourse figée, plus aucun arbre abattu, presque aucune réplique quotidienne entendue): mesurer avec un test jetable avant d'affirmer ce qu'ils « jouent ». Vitesse mesurée: 0,79 s par journée et par graine.
- `unitDraw(seed, clé, jour)` (`src/etat/tirage.ts`) est porté à l'identique en Python dans `tour8_suite.py`: tout tirage nouveau passe par lui (jamais `sim.rng`), ce qui garde les jours 1 à 15 identiques et permet d'épingler une graine dans un test.
- Des garde-fous de météo (pluie plafonnée, soleil forcé) faussent les fréquences: caler une table de tirage distincte de la table visée (boucle d'ajustement multiplicatif, 10 itérations suffisent). Un garde-fou « 5 jours sans soleil » force trop souvent en hiver; 6 est plus doux.
- `sendLetter` ne part qu'une fois par identifiant et `world.letters` ne se vide jamais: une lettre hebdomadaire demande un identifiant d'instance et une liste bornée.
- Une commande valorisée au prix du marché varie du simple au quadruple (goujon à 2 sous): payer chaque ligne au moins sa part d'effort. Interdire un plat et son ingrédient (ou deux plats du même légume) dans la même commande, sinon une semaine de radis.
- Avec une météo tirée, une réplique datée de pluie (priorité 5) se redirait à chaque pluie: règle « datée seulement si pas entendue depuis 28 jours ».
- Un bouton « continuer » qui laisse jouer au-delà d'un jalon futur rend caduques ses dates absolues: ancrer le contenu futur par conditions (saison, jour de semaine, premier jour joué avec la version).
- Pièges de cohérence trouvés en écrivant: le bourg n'a ni chats ni mois; l'hirondelle est un oiseau prévu de la Halte (ne pas écrire qu'il n'y en a pas); l'eau de l'Aubrune ne baisse pas l'été; ne pas dire « à l'ombre » d'un banc sans l'avoir vérifié.
- Charger le script par `importlib` avec des `dataclass`: enregistrer le module dans `sys.modules` avant `exec_module`.

## Quand la limite de la partie bouge (vérifié au tour 8)

- Chercher toute durée écrite en dur: `title.ticket` (`textes-interface.json`), `ui.questKinds.main` (titre de groupe du carnet), `endScreen` (lu par `src/plateforme/interface-secours.ts` et, pour `stats`, par l'historique de Duo). Au tour 8, les trois disaient encore « Deux semaines » ou « Fin de la démo ».
- Une astuce cite la touche par jeton (`{act}`, `{examine}`, `{move}`, `{notebook}`, `src/interface/format.ts`), jamais par un nom de verbe (« fais Agir »).
- Un coût de commande « par unité » tiré d'une probabilité (poisson) doit suivre la saison des poids: la truite d'été (poids 1 sur 11) coûtait deux fois la part prévue au poids de printemps.
- Une monnaie gagnée chaque semaine sans nouvel usage se voit au bout de deux semaines de jeu: compter le total des prix en vente face aux gains d'une commande avant de livrer une économie.

## Économie après la démo (vérifié au tour 9, script `simulations/tour9_automne.py`)

- Mesurer la bourse des robots par un test jetable (`/tmp/<dossier>/bourse.test.ts`, `newSim` et `createRobot({ stages: 'stay' })` de `tests/aides.ts`, `lastDay` porté dans le contenu du test, événements `order_paid` et `sold`): 99 s pour 63 jours par graine. Repère à `757c3b0`: 6 825 et 7 561 sous au jour 63, aucune vente à Odette, aucun achat sauf des graines.
- Le modèle de commande du tour 8 paie environ 12 % de mieux que les robots: le caler (x 0,88) avant tout équilibrage de prix.
- Ce n'est pas le plafond d'Odette (300 sous par jour) qui limite ses achats, c'est la production du duo (environ 400 sous par semaine au plus).
- La pièce de la maisonnette fait 5 x 4 cases et se remplit vite: l'argent ne peut pas partir dans des meubles au sol; objets muraux, outils, poules, cadeaux et chantiers posés sur la carte.
- Zones réservées de la carte à ne jamais occuper: `house_plan_reserved` (2, 15, 14 x 12) et `garden_extension_reserved` (2, 28, 12 x 8).

## Carte: pièges trouvés en posant des objets (tour 9)

- Cases déjà prises qu'on ne voit pas sur la grille des sols: clôture de la rive nord (x 10 à 15, y 36), panneau de la gare (x 45 et 46, y 18), cases (22, 36) et (35, 18). Toujours passer les cases par `GEO.load_map(...).cell()` (outil du tour 7) avant d'écrire une position.
- En orientation 0, la pension d'Odette (x 23 à 30, y 23 à 32, haute) cache tout l'ouest du quai et le passage à niveau (lanternes, places des joueurs): placer un moment à l'est du quai ou sur la place.
- `moments.maxSyncGapSeconds` n'est lu par aucun code de jeu (tour 9): un geste « au même instant » demande un champ nouveau.

## Objectifs de moments sur un horizon court

- Dans une saison de 21 jours, un moment qui passe deux fois a forcément un écart de moins de 21 jours: un écart médian de 19 jours (M-22, O-06) ne se mesure que sur plusieurs années. Sur 84 jours, mesurer plutôt la part des passages qui redisent un moment de la même saison et le nombre de moments différents vus par saison.
- `seasonPoolFull` à 9 laisse l'automne à six moments avec une chance sur trois par jour: une partie sur dix y voit moins de deux moments différents; à 7, trois sur cent.

## Démarrer une mission dans un arbre isolé (vérifié le 2026-11-01, tour 10)

- L'arbre de travail du membre peut partir d'un commit plus ancien que la branche de la session: un fichier cité par le brief (retours, conception du tour précédent) peut manquer. Comparer `git log -1` avec la branche de session (`git branch -a`, le `+` marque les branches ouvertes ailleurs) et avancer par `git merge --ff-only <branche>` avant de lire.
- Dans cet arbre isolé, une commande qui contient le mot « git » (même `--exclude-dir=.git` du contrôle des tirets), un `cd` vers le dépôt principal ou une commande composée trop longue est refusée: faire le contrôle des tirets par un petit script Python dans `/tmp` qui parcourt l'arbre en sautant `.git` et `node_modules`, et passer les retouches de documents par des scripts dans `/tmp` lancés avec le chemin en argument.

## Repères du monde vérifiés au tour 10

- Le pain n'est vendu nulle part à `77c2f3c`: il n'est que donné par des quêtes (`buyPrice` nul, aucune boutique). Les besoins cachés existent déjà dans `reglages.needs` (Ventre selon le souper, Sommeil du lit, Cœur de la journée, poids de la forme).
- La maisonnette a cinq fenêtres dans son modèle (`assets-src/modeles/bourg.py`, `gatekeeper_house`): deux au sud, une au nord, une à l'ouest, une à l'est; celle de l'est est centrée sur la limite de deux cases. Pour accrocher quelque chose à une fenêtre, demander des nœuds d'ancrage à l'artiste plutôt qu'une liste de cases.
- Apparence à `77c2f3c`: trois coiffures (`player_hair_short`, `_bob`, `_bun`), aucune couleur de cheveux, quatre couleurs de tenue.
- `house_plan_reserved` sert justement à agrandir la maison: le cellier (x 2 à 4) et la chambre (y 16 à 21) du tour 10 y sont; la colonne x 13 (sentier du jardin) et la case x 12 (banc du pignon, tour 9) restent libres.
- Rendre visible un besoin caché sans le durcir: garder le plancher de nuit actuel et faire compter double le souper; sinon une baisse par heure fait chuter les valeurs de nuit sous la règle en place (premier jet du tour 10: souper simple à 30 au lieu de 60).
- Dans une simulation d'achats, l'ordre des priorités du duo décide de tout: avec la chambre après les chantiers du bourg, elle n'arrive jamais avant le jour 64. Toujours simuler au moins deux ordres de priorité.
- Noms d'états de besoins: « Rassasié », « Plein d'élan », « calé » s'accordent au joueur; écrire des noms (« Ventre plein », « Pleine énergie », « Petit creux », « Envie de compagnie »).

## Pêche (conception 0.12, vérifié le 2026-11-03)

- Rythme réel de la pêche: environ 12 s par prise (lancer, attente moyenne de 9 s, prise), soit 17 minutes de jeu à 0,7 s par minute: une heure de jeu fait 3,5 prises par joueur. Raisonner les fenêtres d'un poisson en secondes réelles (une fenêtre de 3 h de jeu = 2 min).
- Les cases du gué (`g`) sont du gravier: on n'y lance pas; seules les cases `water` (rivière `~`, ru `r`) se pêchent.
- La partie s'arrête au jour 64 à 16 h (premier jour de l'hiver): tout contenu d'hiver est injouable tant que la limite ne bouge pas.
- `fishCost` des commandes se rapporte à la saison de référence: un poisson absent de cette saison aurait un coût nul. Avec beaucoup d'espèces, la part de chacune chute (goujon de 54 % à 10 %): revoir minimums, plafonds et ressource rivière des commandes.
- R10 sur une collection à épiques saisonniers: le coup de pouce par espèce (x8) ne suffit pas, il faut aussi un bonus sur la rareté quand un épique possible ici manque (x1,5). Mesurer sur 400 duos: à 100, le 90e centile bruite de plusieurs heures.
