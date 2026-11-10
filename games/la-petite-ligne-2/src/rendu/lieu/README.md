# Lieu courant (lot L4)

Tout ce qui appartient au lieu affiché: `description.ts` traduit les données et l'état du lieu en volumes (logique pure), `formes.ts` fabrique les formes provisoires quand le modèle manque, `lieu.ts` construit la scène du lieu et la libère en entier au départ (un `ResourceTracker` par lieu, ADR 0018). Les modèles livrés arrivent par `ModelSource` (`lieu.ts`): le moteur ne connaît aucun nom de modèle.

## Sol des petits lieux

Un petit lieu (sans `terrain`) peut déclarer son sol dans sa carte (`floor`: une nature de base, puis des rectangles); `sol.ts` le dessine aux couleurs de `GROUND_LOOKS` (lames d'un plancher, cases `vide` non dessinées, tranche au bord). Sans `floor`: la plaque d'essai en damier.

Ajouter une nature de sol (le plancher d'une maison, un carrelage): une ligne dans `GROUND_LOOKS` de `reglages-tuiles.ts` (couleur, surface entendue sous les pas, `planks` pour des lames, `hidden` pour ne rien dessiner), puis la citer dans `floor` d'une carte. `tests/train-de-nuit.test.ts` vérifie que chaque nature citée par une carte est connue.

## Grands lieux par tuiles (ADR 0022)

Une carte qui a un `terrain` (produite par `outils/plan-vers-lieu.ts`) est rendue par tuiles de 32 m; les meubles et objets posés passent toujours par `lieu.ts`.

| Fichier              | Rôle                                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tuiles.ts`          | anneau autour du joueur local (`TileRing`): chargement à rayon de vue + 8 m, déchargement au-delà de + 32 m (logique pure)                                                                        |
| `terrain-rendu.ts`   | nature dessinée de chaque case, `surfaceAt(field, x, y)` pour le son des pas, décor semé par tuile, rails, volumes des bâtiments (logique pure, déterministe)                                     |
| `reglages-tuiles.ts` | couleurs par nature, densités, hauteurs, budgets (technique 3.10)                                                                                                                                 |
| `geometrie.ts`       | géométries fusionnées à couleurs de sommets; `FadingMesh`: un maillage fusionné dont une partie (un bâtiment) s'efface sans rien recréer                                                          |
| `tuile.ts`           | une tuile: sol (berges et rails compris), eau, boîtes, troncs, boules instanciés, murs, vitres, toits: 8 appels au plus                                                                           |
| `grand-lieu.ts`      | `TiledPlace`: anneau, construction étalée (4 ms par image, sauf tuile déjà vue), sol lointain simplifié, repères, occultation des murs, toits et houppiers, lueur des fenêtres la nuit, compteurs |

Le moteur expose `surfaceAt(x, y)` (`null` hors grand lieu), `stats().tiles` (compteurs par tuile et au total) et `setOverview(largeur)` (vue haute de contrôle).

Déductions provisoires, faute d'information dans la carte (à remplacer quand la carte la portera): les parcelles `champ` deviennent labour (1 000 cases et plus), pré, ou cour de terre battue (300 et moins); les rails suivent les arêtes `voie` et `interieur` du graphe; un repère est un grand arbre s'il est loin de tout aménagement, sinon une tour.

Page de démonstration: `pnpm exec vite --config src/rendu/lieu/demo/vite.config.ts`, puis `http://localhost:5174/src/rendu/lieu/demo/index.html` (Aubrune fabriquée dans la page depuis `plan.json`; touches et paramètres en tête de `demo/main.ts`; `window.tuiles.traverse(n)` pour le contrôle de fuite).

## Rendu encré (ADR 0023)

En style encré, `grand-lieu.ts` prend ses matériaux dans `../encre/` et ajoute: la carte du sol du lieu (`../encre/sol.ts`), le semis de cailloux et de touffes (`tileSemis`, réglages `semis`), les pièces (voir plus bas), et les bâtiments livrés (`batiments.ts`: manifeste `assets/lieux/<lieu>/batiments/batiments.json`, un modèle par identifiant de `buildings`; sans modèle, les volumes provisoires). Les voies suivent `rails` de la carte quand il existe.

## Pièces: un monde clos à l'écran

Les pièces sont rangées côte à côte sur la grille du lieu, hors du dehors, mais on n'en dessine qu'une: celle du joueur local (`espaces.ts`: `Spaces.at`, `shows`, `bounds`). Dedans: son sol, ses murs, ses cloisons, ses meubles et les personnages qui s'y trouvent, sur une nappe sombre et chaude (`ROOM_SETTINGS.backdrop`); ni le dehors, ni les tuiles, ni les pièces voisines, et la vue reste dans ses bornes. Dehors: aucune pièce. Le moteur bascule par `TiledPlace.showRoom` et `PlaceScene.showWhere`.

Une pièce se construit à sa première visite, en deux temps:

| Fichier              | Rôle                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pieces.ts`          | le plan (logique pure): portes aux seuils, fenêtres déclarées par la pièce ou déduites des façades de son bâtiment (`roomFacades`, manifeste des bâtiments; sinon une par travée), jamais derrière un meuble haut ni contre une cloison; appliques; tapis |
| `piece-geometrie.ts` | les maillages: sol posé lame par lame ou carreau par carreau, chaque mur en deux formes (entier: enduit, plinthe, lambris, pan de bois, embrasures, menuiseries, rideaux, appliques; coupé: soubassement bas à tranche d'encre), coque d'ombre, nappe     |
| `reglages-pieces.ts` | les styles (`ROOM_STYLES`) et les réglages communs (`ROOM_SETTINGS`)                                                                                                                                                                                      |

- Murs: les deux murs qui tournent le dos à la caméra sont entiers, les deux autres coupés à `cut` (`TiledPlace.viewRoom`, à chaque image); une porte se coupe avec son mur (`PlaceScene.cutDoors`), elle reste la cible de la touche d'action.
- Lumière: la coque d'ombre (plafond et murs pleins, jamais dessinés, `SHADOW_ONLY`) ne laisse entrer le soleil que par les fenêtres, croisillon compris; la nappe de lumière suit l'heure (ambiances `piece`, `INK_SETTINGS.roomSun`). Le soir, les appliques. Une pièce sans fenêtre (cave) garde l'ambiance de la nuit à toute heure. Dans une pièce, seules ses lampes éclairent.
- Budget (maison de 10 x 7 m, toutes passes): 40 appels, 25 000 triangles; une pièce seule: 7 appels, 3 000 à 8 000 triangles.

### Ajouter un style de pièce, ou en changer (aucun code)

1. Choisir un style: dans `donnees/lieux/<lieu>/interieurs/<id>.json`, ajouter `"style": "commerce"` (styles livrés: `aubrune` par défaut, `commerce`, `atelier`, `cave`, `eglise`).
2. Créer un style: copier une entrée de `ROOM_STYLES` (`reglages-pieces.ts`) sous un nouveau nom; elle part de `base`, n'écrire que ce qui change.
3. Murs: `height` (murs du fond), `cut` (murs du devant), `wall` (teinte et couche de traits de l'enduit), `wainscot` (lambris ou `null`), `plinth`, `timber` (pan de bois ou `null`).
4. Sol: `floor.kind` (`lames`, `carreaux`, `dalles`), ses teintes, sa taille, son joint.
5. Fenêtres: `windows.rule` (`facades` ou `aucune`), cotes par défaut, menuiserie, rideaux. Pour imposer les fenêtres d'une pièce: `"windows": [{ "side": "nord", "at": 2.5 }]` dans son fichier.
6. Lampes: `lamps` (espacement, hauteur, rayon) ou `null`. Tapis: `"rugs": [{ "x": 2, "y": 3, "w": 1.5, "h": 1.2 }]` dans le fichier de la pièce.
7. Noter l'intention dans `pourquoi`, puis `pnpm exec vitest run tests/rendu/pieces.test.ts` (une pièce factice au style factice y est construite; chaque style cité par un intérieur doit exister).

Portes (`doorVolumes` de `description.ts`, formes dans `formes.ts`): l'objet visible d'une porte est dessiné sur son seuil (`donnees/seuils.ts`) tant qu'aucun modèle n'est livré pour son meuble. Dans une pièce: encadrement et vantail à taille humaine (la cible de la touche d'action), dans le vide de son mur quand il est entier, coupés avec lui quand il est devant la caméra, et paillasson, lisible au sol dans les deux cas. Dehors: le paillasson seul, le bâtiment portant déjà sa porte. Porte au sol: cadre bas et marches. Réglages: `interior.door`, `mat`, `hatch`.

Passage (`../passage.ts`): quand le joueur local est déplacé d'un coup (porte, replacement), l'image d'avant reste et s'éteint (`passage.outSeconds`), la caméra et les personnages se posent au noir, puis l'image revient (`inSeconds`). L'autre joueur disparaît à la porte sans glisser.
