# Tour 1: revue des piliers 6 (contenu et rythme) et 7 (coopération)

| Champ | Valeur |
|---|---|
| Relecteur | level-designer (auteur de la carte, pas du contenu ni des règles) |
| Date | 2026-10-31 |
| Version lue | données de `games/la-petite-ligne/donnees/` et code de `src/simulation/` de l'arbre de travail du matin |
| Barème | `docs/modeles/gauntlet-qualite.md`: 10 = aucune différence de soin avec les références; 8 = un joueur ne remarque aucun manque; 5 = fonctionne mais nu; 3 = provisoire |

## Notes

| Pilier | Note | En une phrase |
|---|---|---|
| 6. Contenu et rythme | **5 / 10** | La semaine 1 est bien rythmée et bien écrite, mais les habitants se répètent vite, la fin de la semaine 2 est vide et la structure ne porte pas encore 100 heures. |
| 7. Coopération | **6 / 10** | On lit très bien ce que fait l'autre et tout se partage, mais en quinze jours un seul geste demande vraiment les deux joueurs, et rien n'oblige à se retrouver en journée. |

## Méthode et preuves

- Lecture: `demo.md`, `semaine-2.md`, `cahier-des-charges.md` (2.3 à 2.5, 4.8, 4.17, 6.9 à 6.11), les neuf fichiers de `donnees/`, `src/simulation/dialogues.ts` (choix de la réplique) et `envies.ts` (tirage des envies), le rapport de recette `recette/2026-10-31-demo.md`.
- Mesure: un script jetable (`/tmp/lpl/mesure.test.ts`, non versionné, lancé par `npx vitest run --root games/la-petite-ligne --dir /tmp/lpl`) fait jouer les robots de `tests/aides.ts` sur toute la démo (graine 20261030 avec l'énigme, graine 7 sans l'énigme; 70 minutes de jeu chacune, fin atteinte). Il relève les événements de chaque joueur, ses envies chaque matin, la distance entre les deux, et, à 9 h, 13 h et 17 h de chaque jour, la réplique que chaque habitant choisirait (même règle que `pickDialogue`, sans toucher au tirage).
- Limite: les robots vont droit au but, ne bavardent pas, ne se promènent pas et ne posent que trois meubles. Leurs temps creux montrent ce que la structure **exige**, pas ce qu'un duo humain fera de son temps libre. Les écarts dus aux robots sont signalés à chaque mesure.

## Pilier 6: contenu et rythme (5 / 10)

### Ce qui est déjà au niveau

- **La semaine 1, jour par jour**: chaque journée apporte du neuf (jour 2, le potager et deux quêtes; jour 3, Jeanne et l'énigme; jour 4, la pluie annoncée la veille par le genou d'Odette, les radis et les poules; jour 5, les œufs et le souper; jour 6, les carottes; jour 7, le dernier jour du catalogue et l'indice; jour 8, le train). Les cultures sont réglées pour que les récoltes tombent sur des jours différents. C'est le niveau de soin visé.
- **Trois horizons présents en semaine 1**: la minute (arroser, récolter, scier), la journée (l'envie du matin, une quête d'habitant), la semaine (la commande au tableau, le train du samedi, le catalogue à choisir à deux).
- **Des voix propres**: Odette et son refrain « Comme les gens », Firmin et ses vingt ans d'attente (« La dernière fois, j'avais encore mes cheveux »), Basile laconique, Jeanne et ses dix ans et demi. Les rappels d'une semaine à l'autre (l'uniforme repassé deux fois, puis une seule) sont dans l'esprit des références.
- **Des fins qui se souviennent**: six répliques de fin en semaine 2 selon la draisine, le carnet d'Émile et la lettre de Lucie.
- **Les énigmes d'Émile**: une par l'ombre et la météo, une par l'heure. Ce sont les meilleures surprises de la démo, sans équivalent copié chez les références.

### Ce qui manque

Les cinq défauts les plus sensibles sont détaillés plus bas (D1, D3, D4, D5). En résumé: une réplique sur deux est déjà entendue, quatre jours de suite sans nouveauté en fin de démo, une trame de la semaine 2 qui disparaît sans la clé, une réserve d'envies qui s'épuise, et aucun aléa (la recette le note: les huit graines donnent exactement la même partie).

### Capacité de la structure à porter 100 heures

Faible en l'état. Le cahier prévoit le volume (1500 répliques, 46 envies personnelles et 14 à deux, 30 annonces, 12 visiteurs pour la version 1), mais la démo montre que le moteur use ce contenu vite (voir « Vers 100 heures »).

## Pilier 7: coopération (6 / 10)

### Ce qui est déjà au niveau

- **Ce que fait l'autre se lit d'un coup d'œil**: la carte de l'autre joueur décrit son activité en une quarantaine d'états (« Arrose le potager », « Au comptoir d'Odette », « Parle avec Basile », « Fait une pause depuis 3 min »), et le repère (épingle à la couleur du profil) est branché au rendu. Au niveau des références, voire au-dessus.
- **Personne n'attend**: le petit-déjeuner se quitte quand on veut, les scènes à deux partent d'elles-mêmes quand les deux sont au rendez-vous, l'horloge s'arrête quand les deux sont dans un menu ou après 3 minutes d'absence, la création se fait en parallèle.
- **Récompenses partagées**: bourse commune (avec « dont X réservés »), caisse commune, accord des deux au-delà de 100 sous, construction deux fois plus rapide à deux, envies à deux (+25 de Cœur chacun), pain « un par joueur ». Rien ne compare les joueurs.
- **Un vrai levier de conversation**: l'envie du matin est secrète (« Sacha ne la voit pas. Demande-lui la sienne ! »).
- **Les scènes à deux** avec une réplique au choix sur chaque écran.

### Ce qui manque

- **Un seul geste exige les deux joueurs en quinze jours**: porter la poutre, le jour 1. La draisine « qu'on pousse à deux » (`basile_handcar_scene`) est une scène de dialogue: Basile le dit, le narrateur le raconte, personne ne pousse. Détail en D2.
- **Rien n'oblige à se retrouver en journée**, hors des trois scènes (arrivée, souper du jour 5, draisine) et des deux trains. Les envies à deux (jours 2, 5, 7, 9, 11, 13) sont facultatives. Mesure chez les robots, qui se répartissent le travail: en semaine 2, les deux joueurs passent de 2 à 15 % du temps de jour à moins de 6 m l'un de l'autre (jour 9: 13 %; jours 12 à 14: 2 à 3 %). Le chantier du poulailler est construit par un seul robot (50 avancées contre 0), le toit à deux (12 et 12) parce que la poutre les a réunis.
- **Une seule information que seul l'un voit**: l'envie secrète. Le « regard du métier » (cases qui ont soif chez le jardinier, P1 de `demo.md`) n'est pas codé (aucune trace dans `src/simulation` ni `src/interface`).

## Les cinq défauts les plus sensibles, classés par impact

### D1. Les habitants répètent la même phrase jour après jour (pilier 6)

- **Constat**: pour les répliques du quotidien, `pickDialogue` ne tire qu'entre celles de **plus haute priorité**. Dès qu'une réplique de priorité 2 ou 3 est valable, toutes celles de priorité 1 deviennent inaudibles. En semaine 2, chaque habitant n'a donc plus qu'une phrase pour six jours. Les indices et rappels sans `once` passent avant tout et se répètent à chaque conversation.
- **Preuves** (relevé à 13 h, graine 20261030):
  - un joueur qui parle une fois par jour à chaque habitant présent: 58 conversations, 26 répliques différentes, **55 % de redites**; trois fois par jour: 170 conversations, 34 répliques, **80 % de redites**;
  - Odette: « Petite mine, ce matin. Un vrai lit, ça change une vie. » (`odette_daily_bed`, priorité 3) **9 jours sur 14**, à toute heure, « ce matin » compris à 17 h; avec le lit posé, c'est « Jeanne est encore passée me poser cent questions » seule les jours 4, 6 et 7; `odette_daily_prices` n'est plus jamais dite après le jour 1;
  - Firmin: « Une deuxième commande ! Je l'ai lue trois fois. » les jours 9, 10, 11, 13 et 14; Jeanne: « Ma tante Lucie dit que Firmin est le seul à dire bonjour au train » les jours 9 à 14; Basile: « Il reste quelques arbres à la lisière » les jours 11 à 14 (ou « La draisine d'Émile dort dans la remise » les jours 9 à 14 sans la clé);
  - Jeanne: `jeanne_hint_shadow` (indice, sans `once`, priorité 8) remplace tout son quotidien tant que l'énigme 1 est ouverte, souvent du jour 3 au jour 7;
  - **réplique morte**: `firmin_day15` (« Cette fois, je n'ai repassé mon uniforme qu'une fois. Je progresse. », priorité 6) n'est jamais dite, car `firmin_day8_morning` (jours 8 et 15, priorité 7) passe devant. Le rappel le plus réussi de la semaine 2 est perdu.
- **Correction proposée**:
  1. tout de suite (données): `firmin_day8_morning` limité au jour 8, ou `firmin_day15` en priorité 8; `odette_daily_bed` limitée au matin (`time_is` 6 h à 11 h) et à un jour sur deux;
  2. moteur: parmi les répliques du quotidien, tirer entre **toutes** celles qui sont valables et que ce joueur n'a pas entendues depuis N jours (réglage, 3 par défaut), la priorité ne servant qu'aux répliques datées (jour du train, pluie); un indice déjà entendu aujourd'hui laisse la place au quotidien;
  3. données: quatre répliques du quotidien de plus par habitant et par semaine (32), dont une qui réagit à ce que le duo a fait la veille (HA-03).
- **Membres**: game-designer (données et écriture), dev-gameplay-3d (règle de tirage dans `dialogues.ts`, réglage dans `reglages.json`).
- **Effort**: 5 min (1), 30 min (2, avec test), 60 min (3).
- **Gain attendu**: +1 sur le pilier 6 (redites mesurées sous 25 % à une conversation par jour).

### D2. Un seul geste à deux en quinze jours (pilier 7)

- **Constat**: la promesse du cahier (2.3, point 4: « porter une poutre, lever une charpente, pomper la draisine ») tient en une minute, le jour 1. La remise en route de la draisine, sommet coopératif de la semaine 2, se joue en cliquant des répliques.
- **Preuves**: `GE` de `demo.md` (2.1): « Geste à deux: porter la poutre (jour 1) », seul. `basile_handcar_scene`: « À deux, on pousse », puis une ligne du narrateur. Code: le seul passage à l'état `gesture` est le port de la poutre (`src/simulation/deplacement.ts`); aucune autre donnée ne demande de geste.
- **Correction proposée**: réutiliser la mécanique de la poutre (maintenir l'action ensemble, avancer à deux) pour **pousser la draisine** sur 10 à 15 m de rail devant la remise, avant la scène de Basile; et un second porté sur un objet déjà modélisé: le colis du poste à galène ou du poêle à bois, livré au train (jours 8 et 15), trop lourd pour un seul. Le level designer place les points de départ et d'arrivée (`handcar_shed`, quai), avec une vérification de parcours.
- **Membres**: dev-gameplay-3d (geste générique paramétré par l'objet), game-designer (déclencheurs et répliques), level-designer (points et parcours).
- **Effort**: 90 à 120 min (dev), 20 min (données), 20 min (carte et validation).
- **Gain attendu**: +1 sur le pilier 7 (trois gestes à deux, un par semaine au moins, et un sommet coopératif en semaine 2).

### D3. Les jours 11 à 14 n'apportent rien de neuf (pilier 6)

- **Constat**: les quatre quêtes d'habitants de la semaine 2 s'ouvrent les jours 9 et 10 (`odette_fry` et `lucie_note` au 9, `firmin_flowers` et `basile_omelette` au 10). Ensuite, plus aucune quête, scène ni personne nouvelle jusqu'au train: seulement la pluie du 12 et un rappel du catalogue le 13. La semaine attend les carottes.
- **Preuves**: robots, graine 20261030: toutes les quêtes de la semaine 2, hors la commande, finies le jour 11 (trois le jour 9, plus le pari de Jeanne); aucun `quest_done` ni `scene_started` des jours 12 à 14. Activité des robots: dernier événement utile vers 7 h à 9 h les jours 10, 11 et 13, soit environ 11 h de jeu (4 minutes réelles) sans rien d'exigé jusqu'à la veillée; même creux au jour 6 (tout fait à 6 h). Un duo humain comblera une partie de ce temps (pêche, meubles), mais sans but nouveau à se donner.
- **Correction proposée** (conditions existantes, aucun moteur): étaler les ouvertures (friture au 9, omelette au 10, lettre de Lucie au 11, fleurs du quai au 12) et donner à chacun des jours 12 à 14 un petit événement écrit: au 12, Jeanne s'abrite de la pluie sous la marquise et raconte la ligne d'avant; au 13, Lucie passe en personne au quai (suite de la lettre); au 14, Basile propose d'essayer la draisine au soleil couchant (lien avec D2). Le jour 6 gagne une demande d'Odette (des carottes pour la soupe).
- **Membres**: game-designer.
- **Effort**: 60 min (dont la relecture des robots: la fin doit rester atteinte sur toutes les graines).
- **Gain attendu**: +0,5 à +1 sur le pilier 6.

### D4. Sans la clé de l'énigme 1, la semaine 2 perd sa trame (piliers 6 et 7)

- **Constat**: `handcar` et `emile_riddle_2` démarrent sur le drapeau `shed_open`. Un duo qui n'a pas trouvé l'ombre de la cloche (un jour de soleil, entre 17 h et 17 h 30) n'a ni la draisine, ni la deuxième énigme, ni leurs deux répliques de fin, ni la seule scène à deux de la semaine 2. Les indices plus directs de la semaine 2 aident, mais rien ne garantit le déblocage.
- **Preuves**: robots sans l'énigme (graine 7): aucune scène à deux des jours 9 à 14, seulement les quatre quêtes d'apport; fins `basile_end2_handcar` et `firmin_end2_logbook` absentes. Courrier `basile_handcar` dans sa version « La remise est toujours fermée ? ».
- **Correction proposée**: un rattrapage dans l'esprit de HA-04: si la remise est encore fermée au matin du jour 11, Jeanne vient à la maisonnette avec la solution (« J'ai trouvé ! Il faut être sur le banc à cinq heures ! ») et l'énigme reste à faire à deux le jour même; au jour 12 (pluie), Basile force la serrure. La trame est toujours jouée, la récompense de l'énigme reste réelle pour ceux qui l'ont trouvée seuls.
- **Membres**: game-designer.
- **Effort**: 25 min.
- **Gain attendu**: +0,5 sur le pilier 6, et le geste à deux de D2 assuré pour tous les duos.

### D5. La réserve d'envies s'épuise, et c'est la seule information propre à chacun (piliers 6 et 7)

- **Constat**: la démo applique « jamais la même envie deux fois » sur toute la partie (`noRepeatForSamePlayer`), alors que le cahier dit « jamais deux fois en sept jours » (HA-07). Seize envies personnelles, souvent conditionnées, pour quatorze matins: la réserve se vide. Comme l'envie secrète est le seul savoir qu'un joueur a et pas l'autre (le regard du métier n'est pas codé), le levier « Tu as envie de quoi aujourd'hui ? » s'éteint avec elle.
- **Preuves**: graine 7, jour 15: « AUCUNE » envie chez les deux joueurs. Graine 20261030: chaque joueur tire 14 envies différentes sur 16 possibles. Robots: de 2 à 5 envies réalisées par joueur en 15 jours.
- **Correction proposée**: appliquer la fenêtre de sept jours du cahier (réglage `noRepeatWindowDays`); ajouter huit envies personnelles qui touchent l'autre joueur (« Offrir un radis à Sacha », « Montrer la rivière à Sacha », réalisées quand l'autre est à moins de 6 m) et deux envies à deux de plus; coder le regard du métier P1 (cases qui ont soif visibles chez le seul jardinier), deuxième information à se transmettre.
- **Membres**: game-designer (envies), dev-gameplay-3d (fenêtre de répétition, regard du métier), ux-ui-designer (affichage du regard).
- **Effort**: 40 min (envies et réglage), 60 à 90 min (regard du métier).
- **Gain attendu**: +0,5 sur le pilier 6 et +0,5 sur le pilier 7.

Bilan attendu si les cinq passent: pilier 6 vers 7 à 7,5, pilier 7 vers 7,5. Pour 8, il faudra en plus de l'aléa (événements du jour tirés dans une réserve) et une cadence de surprises par semaine, ce qui relève du plan des 100 heures.

## Vers 100 heures: les trois risques de répétition de la structure actuelle

Repère du cahier (4.17): 100 h = 361 journées, 51 trains du samedi, 150 séances de 40 minutes.

1. **La voix des habitants s'use en quelques heures.** Avec la règle actuelle (priorité stricte, aucun souvenir de ce qui a été entendu), la démo redit déjà 55 % de ses répliques en deux semaines. Le cahier prévoit 1500 textes pour 84 journées et dix habitants, soit moins de deux par habitant et par journée tout compris (quêtes, scènes, lettres); à 361 journées et trente habitants, aucun volume d'écriture ne suffit sans un moteur qui: tire en évitant ce que ce joueur a entendu, réagit à l'état (saison, météo, ce que le duo a fait la veille, ce que l'autre joueur a fait: HA-03), fait parler les habitants entre eux, et garde des répliques rares. À trancher avant d'écrire la version 1.
2. **La semaine est toujours la même.** Train à 10 h, départ à 16 h, une commande à remplir par apport d'objets: 51 fois en 100 h. Dans la démo, 8 quêtes sur 17 se résument à « apporter N objets à quelqu'un », et 6 sur 7 en semaine 2. Les moments les plus mémorables sont ailleurs: les deux énigmes (lieu, heure, météo), la poutre, la scène du souper. Il faut des samedis qui diffèrent (visiteur à accueillir, commande à thème, fête, panne sur la ligne, train qui amène quelqu'un) et des quêtes d'une autre forme (observer, retrouver, attendre le bon moment, se coordonner à deux), avec une règle d'écriture: jamais deux quêtes d'apport de suite chez le même habitant. Les énigmes du chef de gare (3 pages dans le carnet de la version 1) sont trop rares pour ce qu'elles apportent.
3. **Les réserves finies et les réserves trop petites.** La démo coupe des arbres qui ne repoussent pas (« Trente ans, à peu près »), épuise ses envies en 14 matins, et n'a aucun aléa (huit graines, une seule partie). À l'échelle de la version 1, 34 envies personnelles utiles par joueur (hypothèse: 30 générales et 4 liées à ses deux traits, sans compter le filtre des saisons, qui réduit encore la réserve) reviendraient chacune 10 à 11 fois en 100 h, les 14 envies à deux 8 à 9 fois (un jour sur trois). La coopération en souffre aussi: si les envies et les gestes à deux se répètent, le temps passé ensemble devient une routine. Il faut des réserves qui se renouvellent (repousse, saisons, épisodes) et une part de tirage (petits événements du jour, visiteurs, météo libre hors démo), avec, pour la coopération, au moins un geste à deux nouveau par épisode et des envies qui impliquent l'autre joueur.

## Remarques hors note

- Robot de la recette: le second robot (`p2`) ouvre et ferme la porte de la maisonnette environ 900 fois par jour les jours 10 à 13 (3 200 événements `door` sur la partie, contre 36 chez `p1`). Ce n'est pas un défaut du jeu, mais le robot tourne en rond quand il n'a plus rien à faire: à signaler à qa-testeur (le test d'endurance ne le voit pas).
- Mesure de proximité: les valeurs hautes des jours 6 et 7 chez les robots (96 à 100 %) viennent de deux robots qui attendent au même endroit, pas d'une activité commune. Elle ne vaut que pour la semaine 2.

## Non vérifié

- Le ressenti réel du rythme (durée d'une journée humaine, temps passé à bavarder ou à pêcher): les robots ne jouent pas comme des humains; à observer chez le client.
- Les textes de l'interface (astuces, notifications) n'ont été lus que pour la carte de l'autre joueur et l'envie secrète.
