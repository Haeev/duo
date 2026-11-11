# Écriture jouable: la vie quotidienne des habitants d'Aubrune

Auteur: game-designer, 2026-11-11. Suite de `ecriture-suites-secondaires.md`. Source: cahier des charges, section 4.9 (R39 à R44) et 6.2. Tout est en fiches de données, aucune ligne de moteur; contrôle: `tests/habitants-aubrune.test.ts`.

## En bref

- 21 habitants écrits (les 20 du cahier et Martial Roques, qui arrive après la Veillée): 504 dialogues, 1 237 répliques dans `donnees/lieux/aubrune/dialogues/`.
- Chacun a au moins 12 souvenirs (277 en tout, dont 217 nouveaux), 4 au moins sur ce qu'a fait l'autre joueur, un secret confié par amitié, des goûts, et des répliques selon l'heure, le lieu de son planning, la pluie et la brume.
- Sept secrets nouveaux, en deux paliers (1 cœur, puis 2 cœurs): Anatole, Barnabé, Berthe, Léon, Margot, Paulin, Rosalie. Martial a le sien.
- Deux trains réguliers font revenir les habitants de passage: celui du samedi (Rosalie) et l'autorail de 5 h 12 (le Contrôleur). Sans eux, leurs répliques ne s'entendraient jamais.

## 1. Comment c'est fait

| Sorte              | Fichier                                  | Priorité                | Condition                                                  |
| ------------------ | ---------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Souvenir           | `<habitant>-souvenir-<sujet>`            | 30, une fois par joueur | un fait que le moteur ou l'histoire écrit                  |
| Secret             | `<habitant>-secret-<n>`                  | 40, une fois par joueur | 100 points d'amitié, puis 200 et le premier palier entendu |
| Première rencontre | `<habitant>-arrivee`                     | 50, une fois par joueur | son arrivée                                                |
| Quotidien          | `<habitant>-quotidien` (`anatole-arret`) | 0                       | bonjour en tournante, puis le moment                       |

Tout reste sous les étapes d'histoire (52 et plus): un souvenir ne masque jamais une étape. Seule la remarque d'hygiène (90) passe devant, comme avant.

Les huit souvenirs que chacun a, dans sa voix:

| Sujet    | Ce que les joueurs ont fait                                                            | Fait lu                                      |
| -------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| `cadeau` | un premier cadeau venu de la maison                                                    | `habitants.<id>.cadeaux.j0` ou `.j1`         |
| `adore`  | un cadeau adoré                                                                        | `habitants.<id>.adore.j0` ou `.j1`           |
| `pluie`  | une visite sous la pluie ou l'orage                                                    | `weather_is`                                 |
| `ami`    | trois cœurs                                                                            | `bond_at_least` 300                          |
| `jaloux` | ta moitié a un cœur avec lui, toi pas encore                                           | `amitie.<id>.coeur-1` et pas 100 points      |
| `savon`  | l'un des deux est venu sale, et revient propre                                         | `entendu.aubrune.<id>-hygiene`, hygiène à 60 |
| `veille` | une visite après 22 h (Rosalie: à la dernière minute; le Contrôleur: lanterne en main) | `time_is`, `item_in_bag`                     |
| `piece`  | une pièce de la maison payée                                                           | `aubrune.maison-du-garde.<pièce>`            |

Les autres tiennent aux étapes et aux issues des suites (gué, registre, concours, brioche, fanfare, cloche, draisine, Veillée, les deux fins de la Baronne, la première visite à l'étal).

**Ce qu'a fait ta moitié.** Un souvenir à variante commence par un aiguillage: si les deux joueurs ont déjà ouvert ce dialogue, c'est le second qui parle, et il entend « Ta moitié est passée avant toi ». Quatre par habitant: `cadeau`, `pluie`, `veille` et `jaloux`.

**Le moment.** Après le bonjour, un aiguillage choisit: pluie ou brume une conversation sur deux (les valeurs impaires de la tournante), sinon la réplique de la ligne de planning en cours (« à la coupe », « au fournil à cinq heures », « au grenier, au-dessus de la meule »). Les lignes conditionnées du planning ont leur réplique: les Delmas à la grève tant que le gué manque, Barnabé apprenti, Martial à la grosse caisse le samedi.

## 2. Les habitants

Trois lignes par habitant: la voix, le secret, ce qui change avec l'amitié (à 3 cœurs, et ce qu'il dit de ta moitié).

| Habitant      | Voix                                            | Secret                                                                                                                          | Avec l'amitié                                             |
| ------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Firmin        | parle en horaires et en règlement               | annonce encore l'horaire de 1987, le soir, tout bas (existant)                                                                  | une patère à ton nom dans le bureau, à côté de la sienne  |
| Odette        | bavarde, sait tout, goûte tout                  | les deux couverts réservés par Émile (existant)                                                                                 | le bocal de derrière: les cerises de sa mère              |
| Basile        | trois mots par phrase                           | parle à ses planches (existant)                                                                                                 | te prête son rabot. « Personne d'autre. »                 |
| Achille       | à moitié endormi, poète de la pâte              | la brioche « pour ceux qui partent » (existant)                                                                                 | te garde le quignon tous les matins                       |
| Solange       | moqueuse, vocabulaire de théâtre                | a quitté la scène par trac (existant)                                                                                           | te coiffe sans commenter, un privilège                    |
| Mado          | rit fort, tape, s'impatiente                    | écrit à Barnabé sur des fers à cheval (existant)                                                                                | te laisse taper sur son enclume                           |
| Ambroise      | ronchon pointilleux, tendre malgré lui          | la clé de la pendule dans sa poche (existant)                                                                                   | te laisse remonter une horloge: « tu n'es plus personne » |
| Honorine      | ment pour s'amuser, dates à l'appui             | pourquoi elle ment; le salut d'Émile (existant)                                                                                 | promet de te dire quand elle ment, « de temps en temps »  |
| Marthe        | sèche, exacte, drôle sans le vouloir            | un coup de cloche en moins pour sa sœur (existant)                                                                              | te fait tirer la corde, une fois                          |
| Jeanne        | parie sur tout                                  | la seule nuit à 5 h 13 (existant)                                                                                               | t'inscrit page des gens sûrs, avec Solange et un chat     |
| Lucie         | pressée, rit fort (« Ha ! »)                    | photographie les cartes postales (existant)                                                                                     | elle qui ne s'assoit jamais ralentit pour toi             |
| Colette       | chaleureuse et franche                          | son café est de la chicorée (existant)                                                                                          | le tabouret du bout devient le tien                       |
| Armand        | bafouille dehors, sûr au pupitre (« Enfin... ») | fait la leçon au squelette (existant)                                                                                           | finit une phrase sans « enfin ». Presque                  |
| Paulin        | dit non d'abord                                 | il se perd dans ses champs par brume; les rubans rouges de ses piquets, c'est Margot qui les noue, et ils n'en ont jamais parlé | tu peux marcher dans ses rangs                            |
| Margot        | traduit Paulin, diplomate                       | tient un cahier des 214 « non » de Paulin et de la date où il a fini par dire oui; le premier: « Danser ? Non. »                | Paulin a dit ton prénom sans grogner: « de la famille »   |
| Léon          | fanfaron qui se corrige (« Enfin... »)          | fils de fermier, il a peur des poules, surtout la rousse                                                                        | te confie le meilleur foin pour sauter                    |
| Berthe        | franche, parle au nom de sa meule               | sa meule s'appelle Marguerite, comme sa mère, à qui elle ne répondait jamais                                                    | la meule te salue d'un « clac » en retard                 |
| Barnabé       | colosse doux, chante en travaillant             | garde les 31 fers de Mado cloués dans sa cabane, et lui répondait par des bûches posées debout                                  | te met dans sa chanson, troisième couplet                 |
| Rosalie       | gouailleuse, parle de Georgette, sa locomotive  | sa montre retarde de trois minutes, exprès, pour ceux qui courent sur le quai                                                   | te laisse tirer le sifflet                                |
| Le Contrôleur | cite des articles, phrases courtes              | son prénom, Anatole; puis les confettis de sa pince, un bocal par gare: celui d'Aubrune en contient deux, les vôtres            | t'autorise le tutoiement « pendant l'arrêt »              |
| Martial       | curé à vélo, parle en côtes et en vent de face  | ne sait pas réparer une crevaison (« je médite »); puis: il a demandé Aubrune, que l'évêché prend pour une punition             | te confie son vélo                                        |

Aucun secret nouveau ne touche à l'histoire principale ni aux six suites. Deux s'appuient sur l'écrit existant: Barnabé répond au secret de Mado (les fers), Paulin à sa première réplique sur le quai (« je trouverai », « il ne trouvera pas »).

## 3. Les comptes

| Habitant      | Souvenirs          | dont ta moitié | Paliers de secret           | Bonjours | Moments (pluie et brume compris) | Répliques |
| ------------- | ------------------ | -------------- | --------------------------- | -------- | -------------------------------- | --------- |
| Achille       | 13                 | 4              | 1                           | 6        | 6                                | 80        |
| Ambroise      | 12                 | 4              | 1                           | 6        | 6                                | 47        |
| Le Contrôleur | 14                 | 4              | 2                           | 4        | 4                                | 30        |
| Armand        | 12                 | 4              | 1                           | 6        | 6                                | 38        |
| Barnabé       | 13                 | 4              | 2                           | 4        | 6                                | 40        |
| Basile        | 13                 | 4              | 1                           | 6        | 6                                | 80        |
| Berthe        | 12                 | 4              | 2                           | 4        | 6                                | 42        |
| Colette       | 14 (13 par partie) | 4              | 1                           | 6        | 6                                | 79        |
| Firmin        | 14                 | 4              | 1 (et l'aveu de l'histoire) | 6        | 6                                | 120       |
| Honorine      | 15                 | 4              | 2                           | 6        | 6                                | 80        |
| Jeanne        | 13                 | 4              | 1                           | 6        | 7                                | 66        |
| Léon          | 13                 | 4              | 2                           | 4        | 6                                | 42        |
| Lucie         | 12                 | 4              | 1                           | 6        | 6                                | 57        |
| Mado          | 14                 | 4              | 1                           | 6        | 6                                | 70        |
| Margot        | 13                 | 4              | 2                           | 4        | 6                                | 43        |
| Marthe        | 14                 | 4              | 1                           | 6        | 6                                | 69        |
| Martial       | 13                 | 4              | 2                           | 6        | 12                               | 46        |
| Odette        | 14                 | 4              | 1                           | 6        | 6                                | 85        |
| Paulin        | 12                 | 4              | 2                           | 4        | 6                                | 34        |
| Rosalie       | 14                 | 4              | 2                           | 3        | 5                                | 36        |
| Solange       | 13                 | 4              | 1                           | 6        | 6                                | 53        |

Goûts du Contrôleur: il adore son billet poinçonné, aime la lanterne, la soupe aux herbes, l'œuf au plat et la tartine (du chaud, pour qui travaille la nuit), et déteste le sandwich (il en vend depuis trente ans) et le goujon.

## 4. Martial Roques

Curé de six clochers, à vélo, 47 ans. Il descend du train une fois la Veillée passée (`aubrune.acte3.fini`). Apparence composée du catalogue, sans modèle nouveau: silhouette `adult-m-medium` (la seule chez les hommes du bourg), col roulé noir, pantalon anthracite, cheveux courts gris. Pas de vélo à l'écran: il en parle.

| Heures                                   | Lieu du plan                   | Pourquoi là                                            |
| ---------------------------------------- | ------------------------------ | ------------------------------------------------------ |
| 6 h 30 à 7 h                             | parvis (`pv`)                  | ouvre l'église, juste avant l'arrivée de Marthe        |
| 7 h à 9 h                                | cimetière (`ci`)               | arrose et lit les noms                                 |
| 9 h à 12 h                               | bout de la Grand-Route (`gr9`) | tournée des écarts, jusqu'à la maison du bout          |
| 12 h à 13 h 30                           | devant le café (`gr6`)         | déjeune chez Colette                                   |
| 13 h 30 à 16 h 30                        | croix de chemin (`croix`)      | la vieille route continuait: il regarde où elle allait |
| 16 h 30 à 19 h                           | place (`pl`)                   | « un curé, ça se croise »                              |
| 19 h à 20 h 30                           | parvis (`pv`)                  | ferme l'église, après le départ de Marthe              |
| nuit                                     | devant le presbytère (`pv-o`)  | le presbytère n'a pas encore d'intérieur               |
| dimanche, 9 h à 11 h 30                  | parvis ouest (`pv-o`)          | accueille pour la messe                                |
| samedi, 9 h 30 à 14 h 40, fanfare fondée | quai ouest (`quai-o`)          | attend le train à la grosse caisse                     |

Sa réplique d'arrivée dans la fanfare (`martial-fanfare`, quand `aubrune.fanfare.fondee`): il a entendu le concert depuis la côte et réclame la grosse caisse, restée sans personne.

## 5. Les deux trains réguliers (`evenements/`)

| Événement                                           | Quand                        | Condition                                          | Écrit                                      |
| --------------------------------------------------- | ---------------------------- | -------------------------------------------------- | ------------------------------------------ |
| `train-du-samedi`, puis `depart-du-train-du-samedi` | samedi, 10 h 04 à 14 h 40    | l'acte 2 est fini                                  | `aubrune.train.en-gare`, vrai puis faux    |
| `autorail-de-5h12`, puis `depart-de-l-autorail`     | chaque nuit, 5 h 12 à 5 h 45 | le premier départ est fait (`aubrune.depart.fait`) | `aubrune.autorail.en-gare`, vrai puis faux |

La présence de Rosalie et du Contrôleur (`arrives`, `leaves`) n'a pas changé: ils descendent et repartent sur ces deux faits, comme dans l'histoire. Le rendu ne lit pas encore ces faits: ils sont sur le quai sans train visible.

## 6. Ce que le moteur ne permet pas encore

Mise à jour du 2026-11-11: les points 1 à 6 ont leurs briques (`src/simulation/regles/README.md`, « Faits par joueur, durées, compteurs »): `"of": "actor" | "other"` sur `remembered`, `days_since`, `fact_at_least` et l'effet `bump`; faits des commerces (premier achat, première vente, totaux vendus), dernier jour de conversation (`amitie.<id>.jour`), première prise, nuit blanche, pluie passée dehors ensemble. Cinq souvenirs s'en servent déjà (cadeau et jaloux de Colette et de Margot, étal de Margot). Restent la tenue portée (point 5) et les points 7 et 8.

1. **Qui parle.** Aucune condition ne dit « ce fait vient de celui qui agit » ou « de l'autre » (`remembered` avec `by: mine | theirs`, ou une clé à motif `{moi}`, `{moitie}`). Les répliques sur ta moitié passent par l'ordre de passage et par l'écart de cœurs; « Ta moitié m'a vendu douze œufs hier » reste hors de portée.
2. **Absence et retard.** Les faits sont datés, mais aucune condition ne compare des jours (`days_since` d'un fait, par exemple du dernier bonjour `habitants.<id>.salut.j<n>`). Pas de « trois jours sans te voir ».
3. **Premier achat.** Les commerces n'écrivent aucun fait (achat, vente, total). Les souvenirs de Colette et de Margot lisent la première visite à l'étal, pas un achat.
4. **Compteurs.** `remembered` ne lit que l'égalité: pas de « au moins 5 cadeaux » (`fact_at_least`).
5. **Tenue portée, nuit blanche, première prise** (R41): aucun fait ni condition.
6. **Météo d'un souvenir.** `pluie` se dit sous la pluie; « tu te souviens de l'averse ? », dit par beau temps, demanderait un fait écrit par le moteur un jour de pluie partagé.
7. **Rendu des trains réguliers** et **vélo de Martial**: rien à l'écran.
8. **Planning de Jeanne et de Léon à l'école**, lit de chaque habitant, intérieur du presbytère: les plannings n'ont pas été retouchés (hors Martial); la nuit, la plupart dorment encore à leur porte.

## 7. Choix laissés au client (par le manager)

1. **Le train du samedi et l'autorail de chaque nuit reviennent seuls** après l'histoire. Recommandation: garder; le cahier promet le train du samedi, et un autorail qui s'arrête chaque nuit à 5 h 12 est la récompense de la Veillée. À retirer: quatre fichiers.
2. **Le Contrôleur s'appelle Anatole**, et il le dit à un cœur. Recommandation: garder, c'est la première fois que quelqu'un lui demande.
3. **Paulin se perd dans ses champs** et Margot noue ses rubans. Recommandation: garder; c'est le pendant tendre de son « non ».
4. **Martial arrive dès la Veillée**, pendant que la fanfare peut encore se jouer; il n'y entre qu'une fois le concert donné. Recommandation: garder, il n'attend pas le départ pour Hautefonte.
5. **Les secrets nouveaux ont deux paliers** (1 et 2 cœurs) là où les treize premiers n'en ont qu'un. Recommandation: garder, et passer les anciens à deux paliers à l'occasion.

## 8. Contrôles

`tests/habitants-aubrune.test.ts` (2 s, 7 essais): 21 habitants; pour chacun, 12 souvenirs dont la condition est faite de faits que les données ou le moteur écrivent, vérifiée par l'évaluateur du jeu dans un monde mis dans l'état demandé; 4 sur l'autre joueur; le second des deux à venir entend bien la variante (conversation jouée chez Lucie); une réplique par heure et par temps, pluie et brume une fois sur deux; un secret par amitié; des goûts connus; aucune réplique du quotidien au-dessus de la priorité 50 et aucune étape en dessous; pages de 150 caractères au plus, sans tiret long; les deux trains réguliers écrivent et retirent leurs faits.
