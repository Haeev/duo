# La Petite Ligne: état du code (démo)

Point d'avancement du dev gameplay, du plus récent au plus ancien.

## Demandes du rendu

Tenue par le dev rendu 3D (`src/rendu/`). Chaque point dit ce que le rendu fait en attendant.

1. `cameraYaw()` (convention proposée par le rendu): angle, dans le repère du sol et avec la convention de `facing` (0 vers l'est, PI/2 vers le sud), de la direction « haut de l'écran » posée au sol. Z (haut): `(cos yaw, sin yaw)`; D (droite): `(cos(yaw + PI/2), sin(yaw + PI/2))`; S et Q à l'opposé. La valeur suit l'orientation visée (pas l'animation de 0,3 s), pour que la marche tourne d'un coup avec la touche. Première orientation: caméra au sud-est, `yaw = -3 PI/4` (Z part vers le nord-ouest).
2. `GameMap.props[i]`: ajouter `height` (la `hauteur` du type dans la carte) et `category` (`categorie`: `batiment`, `sol`, `equipement`, `mobilier`, `decor`, `arbre`). Le rendu en a besoin pour poser les personnages sur les sols surélevés (`platform` 0,4 m, `pontoon` 0,5 m) et pour dimensionner les substituts. En attendant: table de secours dans `src/rendu/reglages.ts` (`floorProps`).
3. Arbres: le rendu suppose que `map.trees` ne contient que les 12 arbres à couper de la lisière, et que les autres arbres de la carte (`tree_oak`, `tree_fir`) restent dans `map.props` (décor fusionné, jamais abattu).
4. Rotation des meubles (`PlacedFurniture.rotation`, `PlacementPreview.rotation`): le rendu applique la convention de la carte (`rotation.y = rotation x PI/2`, 0 face au sud, 1 face à l'est). À confirmer: `types.ts` dit « sens horaire vu de dessus », ce qui donnerait l'ouest pour 1.
5. Facultatif: savoir quelles cases sont en « herbe haute » (`,` de la carte) pour y pousser des touffes plus denses. En attendant, les touffes suivent un bruit déterministe.

## Demandes de l'interface

Tenue par le dev interface (`src/interface/`). Chaque point dit ce que l'interface fait en attendant (adaptateur: `src/interface/adaptateur.ts`).

1. Barre d'outils de 10 cases (brief du manager, maquettes): `TOOLBAR_SLOTS = 10` dans la simulation (`selected` de 0 à 9), idéalement exporté depuis `etat/` pour que l'interface le lise. En attendant: l'interface montre 10 cases; un clic sur la 9e ou la 10e est ignoré par la simulation actuelle.
2. Polices: `@fontsource-variable/fraunces` et `@fontsource-variable/nunito-sans` 5.3.0 ajoutées au paquet du jeu (`pnpm add`, 2026-10-31, aucun autre `pnpm install` en cours à ce moment). L'interface les importe elle-même.

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
