# La Petite Ligne: état du code (démo)

Point d'avancement du dev gameplay, du plus récent au plus ancien.

## Demandes du rendu

Tenue par le dev rendu 3D (`src/rendu/`). Chaque point dit ce que le rendu fait en attendant.

1. Fait: convention de `cameraYaw()` (haut de l'écran posé au sol, convention de `facing`; première orientation `yaw = -3 PI/4`), adoptée par `src/entrees/`.
2. Fait: `MapProp.height` et `MapProp.category` (le rendu prend d'abord la hauteur de marche `walk_height` du modèle de l'artiste, sinon `height` pour la catégorie `sol`).
3. Fait: `map.trees` = les 12 arbres à couper; les autres arbres restent dans `map.props`.
4. Fait: rotation des meubles selon la convention de la carte.
5. Facultatif, toujours ouvert: cases d'« herbe haute » (`,`) pour des touffes plus denses. En attendant: bruit déterministe.

### Ce que le rendu offre en plus du contrat `Renderer`

- `RenderEngine` (exporté par `src/rendu/index.ts`): `setReducedMotion(bool)` (réglage qui change en cours de partie), `detailedStats()` (appels, triangles, programmes, géométries, textures, images par seconde), `programList()`, `resolutionScale()`.
- `pick()` renvoie la cible la plus proche (personnage, habitant, meuble, objet au sol, arbre debout) avant le sol; le sol tient compte de la hauteur du terrain (quai, berges) et vaut `null` hors de la carte.
- Indicateur de performances en haut à gauche en mode développement (`import.meta.env.DEV`), rouge au-delà des budgets (150 appels, 250 000 triangles, 12 programmes); résolution dynamique qui descend par paliers jusqu'à 0,75 si les images dépassent 20 ms en moyenne.
- Trous de visibilité: ce qui cache un des deux joueurs (bâtiment, arbre, auvent) s'efface en trame autour de lui; la maisonnette coupe toit et murs côté caméra quand le personnage local y est (`inHouse`).
- Page de démonstration du rendu seul: `rendu.html` (paramètres en tête de `src/rendu/demo/main.ts`), essai d'endurance `rendu.html?cycles=12`.

## Demandes de l'interface

Tenue par le dev interface (`src/interface/`). Chaque point dit ce que l'interface fait en attendant (adaptateur: `src/interface/adaptateur.ts`).

1. Barre d'outils de 10 cases (brief du manager, maquettes): `TOOLBAR_SLOTS = 10` dans la simulation (`selected` de 0 à 9), idéalement exporté depuis `etat/` pour que l'interface le lise. En attendant: l'interface montre 10 cases; un clic sur la 9e ou la 10e est ignoré par la simulation actuelle.
2. Polices: `@fontsource-variable/fraunces` et `@fontsource-variable/nunito-sans` 5.3.0 ajoutées au paquet du jeu (`pnpm add`, 2026-10-31, aucun autre `pnpm install` en cours à ce moment). L'interface les importe elle-même.

## Écarts et questions signalés (dev gameplay)

- Données, `quetes.json`, « Premières pousses »: les étapes comptent depuis leur début (`since` par défaut `step_start`). Un duo qui sème le jour 1, avant que la quête ne démarre (au matin du jour 2), doit ressemer pour valider l'étape; rien n'est bloqué (la récolte et le resemis la valident), mais c'est déroutant. Proposition au game designer: `"since": "game_start"` sur les conditions `sowed` et `watered` de cette quête.
- Données, énigme d'Émile: rien n'empêche de la résoudre dès le jour 1 à 17 h (soleil) si l'on a trouvé la boîte; le robot le fait. Si l'on veut que Jeanne et Firmin aient le temps d'aider: ajouter `day_at_least` à l'étape.
- Repas pris ensemble: le code ne demande pas « le même plat » (README des données): les deux mangent le soir à moins de `ranges.eatTogether`; le souper partagé (Cœur +5, `ate_together:table`) demande en plus une table à côté, comme dans `demo.md`.
- Réglages absents de `reglages.json`, avec une valeur par défaut dans `src/donnees/defauts.ts` (une clé `feel` dans `reglages.json` les remplace): durées des gestes, glissement du train (6 s), vitesse des habitants (1,6 m/s) et des poules, fenêtre de « Déjà pris » (1,5 s), `ranges.eatTogether` et `ranges.stayAt` (3 m).
- Pas faits (P1 de `demo.md`): absence (horloge arrêtée après 3 min sans entrée), pêche, regard du métier, coin à soi, repère. Pas d'écran « Qui joue qui ? »: un identifiant inconnu prend le personnage libre.
- `public/vignette.png` est une vignette provisoire (dégradé et titre): à remplacer par le directeur artistique.

## 2026-10-31, étape 3: réseau, SDK, sauvegardes, point d'entrée

- SDK branché: `src/main.ts` (`connect`, boucle à 30 pas par seconde, entrées par les actions du manifeste), `duo-game.json` (validé par `parseManifest`, `play: session`, 26 actions, sauvegarde `auto` toutes les 5 minutes, `exit` et `manual`), `index.html`, `vite.config.ts` (`base: './'`). L'ancien relais par Vite est retiré.
- Réseau (`src/reseau/`): l'hôte fait autorité; l'invité envoie commandes et intentions (canal 0, fiable), reçoit l'état complet quand il change (canal 1, au plus 5 par seconde), les positions à chaque pas (canal 2) et les événements (canal 3, fiable); interpolation des autres (133 ms de retard) et prédiction de son propre déplacement, corrigée en douceur. Tous les messages ont un schéma Valibot (`schemas.ts`).
- Séance (`src/session.ts`): hôte ou invité derrière la même `GameView`; sauvegarde à l'aube et aux étapes de quête (`manual`), toutes les 5 minutes et en quittant (SDK); fin de séance par `results.endSession` (fin de la démo, ou « Finir la séance » des deux à l'écran de nuit) avec les trois chiffres de l'écran de fin.
- Sauvegarde (`src/sauvegarde/`): état complet en JSON, contrôlé à la relecture, personnages liés à l'identifiant stable du joueur (reprise quelle que soit la machine qui héberge; un identifiant inconnu prend le personnage libre), scène en cours reprise à son début.
- Entrées (`src/entrees/commandes.ts`): Z Q S D tournés selon `cameraYaw()`, clic gauche (aller et agir, via `renderer.pick`), Espace, X ou clic droit, molette (outil, ou meuble en main), T (tourner le meuble), A et E, R et F (caméra), 1 à 0 (barre de 10 cases), Tab, Retour arrière et Entrée passés à l'interface.
- Interface de secours (`src/plateforme/interface-secours.ts`), utilisée seulement si `src/interface/index.ts` n'exporte pas `createInterface`.
- Son: `main.ts` monte `src/audio/index.ts` (`createAudio`, contrat `CreateAudio` de `etat/vue.ts`) dès qu'il existe. Flux d'événements décrit dans `src/README.md`, section « Événements ».
- Vérifié: démo servie par `pnpm --filter @duo/sdk-dev servir la-petite-ligne`, deux vues locales dans Chromium, création des personnages et scène d'arrivée jouée en même temps sur les deux écrans (captures examinées). Le rendu logiciel de l'environnement cloud est trop lent pour une partie complète dans le navigateur: la partie complète est prouvée par les robots (Node).

## Réponses du dev gameplay aux demandes de l'interface

1. Fait: `TOOLBAR_SLOTS = 10` et `BAG_SLOTS = 24`, exportés par `src/etat/types.ts`; `selected` va de 0 à 9; manifeste: touches 1 à 0.
2. Noté (polices dans le paquet).

## 2026-10-31, étape 2: simulation jouable de bout en bout

- `src/simulation/`: horloge (journée, veillée, nuit, petit-déjeuner, minuit), déplacements et collisions, potager, bois, poules, poutre à deux, construction guidée, aménagement, économie (bourse, épicerie, catalogue, gros achats à deux, caisse et commande), habitants et emplois du temps, dialogues et scènes à deux, quêtes, envies, courrier, astuces, fin de la démo. Tout est piloté par `donnees/*.json`.
- Carte: `donnees/cartes/halte.json` lue par `src/donnees/carte-niveau.ts` (contrôlée à l'exécution); la carte de secours ne sert plus qu'en cas de fichier illisible.
- Robot: `src/simulation/robot.ts` joue toute la démo à deux sur la vraie carte: commande 4 lignes sur 4 (540 sous), clé de la remise trouvée, 0,04 ms par pas.

## Réponses du dev gameplay aux demandes du rendu

1. `cameraYaw()`: convention adoptée telle quelle par `src/entrees/` (Z vers `(cos yaw, sin yaw)`, D vers `(cos(yaw + PI/2), sin(yaw + PI/2))`).
2. Fait: `MapProp.height` (mètres, 0 si inconnue) et `MapProp.category` (`decor` si inconnue), lus dans `types` de la carte. Attention: `src/rendu/demo/carte-demo.ts` doit ajouter ces deux champs (erreur de typage tant que ce n'est pas fait), ou lire la vraie carte avec `loadMap(MAP_FILES)` de `src/donnees/carte.ts`.
3. Confirmé: `map.trees` ne contient que les 12 arbres `coupable` de la lisière; les autres arbres sont dans `map.props`.
4. Confirmé: rotation des meubles et des objets selon la convention de la carte (0 face au sud, 1 à l'est, 2 au nord, 3 à l'ouest); commentaire de `types.ts` corrigé.
5. Pas encore fait (facultatif).

## 2026-10-30, étape 1: contrats publiés

- `src/README.md`: modules, propriétaires, flux des données, contrats du rendu et de l'interface.
- `src/etat/types.ts` (état du monde), `src/etat/actions.ts` (intentions), `src/etat/carte.ts` (carte statique), `src/etat/vue.ts` (`GameView`, `createRenderer`, `createInterface`), `src/donnees/types.ts` (contenu).
- En attente: `packages/sdk` (pas encore là: adaptateur local dans `src/plateforme/`), `donnees/cartes/` (carte de secours d'après `demo.md` en attendant).
