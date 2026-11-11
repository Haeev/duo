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
| `tuile.ts`           | une tuile: sol (berges et rails compris), eau, boîtes, végétation instanciée (un appel par modèle), murs, vitres, toits                                                                           |
| `grand-lieu.ts`      | `TiledPlace`: anneau, construction étalée (4 ms par image, sauf tuile déjà vue), sol lointain simplifié, repères, occultation des murs, toits et houppiers, lueur des fenêtres la nuit, compteurs |

Le moteur expose `surfaceAt(x, y)` (`null` hors grand lieu), `stats().tiles` (compteurs par tuile et au total) et `setOverview(largeur)` (vue haute de contrôle).

Déductions provisoires, faute d'information dans la carte (à remplacer quand la carte la portera): les parcelles `champ` deviennent labour (1 000 cases et plus), pré, ou cour de terre battue (300 et moins); les rails suivent les arêtes `voie` et `interieur` du graphe; un repère est un grand arbre s'il est loin de tout aménagement, sinon une tour.

Page de démonstration: `pnpm exec vite --config src/rendu/lieu/demo/vite.config.ts`, puis `http://localhost:5174/src/rendu/lieu/demo/index.html` (Aubrune fabriquée dans la page depuis `plan.json`; touches et paramètres en tête de `demo/main.ts`; `window.tuiles.traverse(n)` pour le contrôle de fuite).

## Rendu encré (ADR 0023)

En style encré, `grand-lieu.ts` prend ses matériaux dans `../encre/` et ajoute: la carte du sol du lieu (`../encre/sol.ts`), le semis de cailloux et de touffes (`tileSemis`, réglages `semis`), les pièces (voir plus bas), et les bâtiments livrés (`batiments.ts`: manifeste `assets/lieux/<lieu>/batiments/batiments.json`, un modèle par identifiant de `buildings`; sans modèle, les volumes provisoires). Les voies suivent `rails` de la carte quand il existe.

Végétation semée (rendu encré): les arbres et buissons tirés par `tileDecor` sont des modèles livrés du manifeste des décors (`semis` de `reglages-recoltes.ts`: une essence par place, puis sa variante, son cap et sa taille tirés de la place), un maillage instancié par modèle et par tuile. L'ancien rendu garde ses troncs et ses boules. Un houppier s'efface devant le joueur sur la largeur du modèle posé.

Emprises (`emprises.ts`, logique pure): rien ne se sème (touffes, cailloux, arbres, buissons) dans l'emprise d'un meuble de la carte (un potager en est un), d'un repère ou d'un bâtiment, ni à cheval sur une autre surface que la sienne (une touffe ne dépasse pas sur un chemin ou un dallage, un caillou du chemin reste dans le chemin). Les gardes se règlent dans `semis.clear` de `reglages-tuiles.ts`. Aucun code pour un meuble de plus: son emprise vient de sa fiche. Les meubles posés par les joueurs en cours de partie ne déplacent pas le semis (il est construit avec la tuile).

Budget du bois (`semis.light` de `reglages-recoltes.ts`): à plus de `beyond` cases hors du couloir de jeu (`GroundField.away`, natures `decor.outside`), un arbre semé prend sa version allégée (état `far` du manifeste: même graine, mêmes masses, mêmes festons). L'ombre de tous les arbres semés est portée par des maillages jamais dessinés (`SHADOW_ONLY`), rangés par morceaux de `shadowChunk`: la version `far` pour un arbre entier, la forme `shade` (sans festons) au fond du bois. Une essence sans ces états reste entière et porte son ombre elle-même. Mesures à 1366 x 768 (`ensemble.spec.ts`): bois le plus dense (48, 16) 582 000 triangles et 139 appels avant, 248 000 et 129 après; orée vue du couloir (104, 90) 562 000 et 185 avant, 312 000 et 180 après.

Clôtures de la voie: les cases de lisière qui longent une voie reçoivent le modèle livré `decor.fenceModel` (`fenceRuns`, `fenceVolumes`), resserré pour tomber juste; sans ce modèle, les piquets en boîtes restent. Repères (`landmarks`): un repère qui a déjà son volume (un meuble de la carte à moins de `landmark.sameAs`, un bâtiment livré) n'a plus de volume provisoire.

## Récoltables: états, potager, repères, objets au sol

`recoltes.ts` (logique pure) lit l'état déjà transmis (rien de plus sur le réseau) et `lieu.ts` le montre:

- **Forme stable**: chaque modèle est demandé avec l'identifiant de l'exemplaire (`ModelSource.instantiate(modèle, id, état)`): variante, cap et échelle en sont tirés, les mêmes chez l'hôte et chez l'invité, à chaque visite.
- **États** (`objectState`): ressource récoltée pas encore revenue, l'état `after` de sa fiche (`stump`, `bare`; `gone`: rien n'est dessiné); ressource entamée, `chipped`; stock d'une brique `gather` vide, `bare`. `PlaceScene.setStates` ne refait que les volumes dont l'état change; le moteur relit l'empreinte (`harvestSignature`) à chaque image, sans allocation.
- **Potager** (`fieldVolumes`): une case bêchée ou arrosée (états `tilled`, `watered` du modèle du meuble) par parcelle, et le plant de la culture à son stade, mûr ou à arroser (`cropModel`), sur la grille de la simulation, à la hauteur du potager (`foot`).
- **Repères** (`markerVolumes`): un repère de pêche sur la berge de chaque coin de `lieu.json` (tourné vers l'eau), des touffes à insectes dans les zones de `nature.json`.
- **Objets au sol**: le modèle du meuble qui EST l'objet (ressource qui disparaît et ne donne que lui: pierre, bûche, coquelicot), réduit (`ground.modelScale`); sinon un ballot encré commun (`ballot.ts`), jamais un cube. Un objet dont la place tombe dans l'emprise d'un meuble plus haut que `ground.hideHeight` (sous un banc) est affiché au bord de ce meuble (`hidingFootprints`, `clearOf`); sa place dans l'état ne change pas.
- **Effacement**: la boîte d'occultation d'un volume à modèle est celle du modèle posé (houppier compris), plus son emprise; une souche ne cache plus rien.

Ajouter une culture ou un état: aucune ligne de code. Une culture: sa fiche (`model`) et ses modèles (`assets-src/decors/recoltables-aubrune/README.md`). Un état: le modèle sous `states` du manifeste, et le nom d'état dans la fiche (`after` d'une ressource) ou dans `reglages-recoltes.ts`. Test court: `pnpm exec vitest run tests/rendu/recoltes.test.ts` (ressource, meuble, culture et zone factices). Captures: `pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts recoltes`.

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

## Sol en relief (rendu encré, règle « éviter le plat absolu »)

Le sol d'un grand lieu n'est plus un plan. La hauteur est une affaire d'affichage: la simulation reste en 2D et ne lit rien d'ici (ni collisions, ni cases franchissables, ni vitesses). L'ancien rendu (`?rendu=aplats`) garde son sol plan.

| Fichier              | Rôle                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reglages-relief.ts` | un profil par nature de sol (niveau, bosses, raccord, bourrelet ou fossé, dalles, bordures), emprises à niveau (portes, voies), maillage                                              |
| `relief.ts`          | `Relief`: `heightAt(x, y)` pure et déterministe, tirée de la carte du lieu (natures, bâtiments, portes, voies); dalles et pierres de bordure en données (logique pure, sans Three.js) |
| `relief-sol.ts`      | le maillage: sol souple en nappe lissée, serrée seulement là où le relief change; marches; dalles et bordures en petits volumes (une pièce de contour, un morceau par pierre)         |

Niveaux: les sols posés par l'homme (rue, route, seuils, voie) restent à y = 0, l'herbe est 5 cm plus bas, les chemins de terre encore 7 cm (creusés, talus d'herbe sur leurs bords), le quai 12 cm plus haut, le fond de l'eau à 42 cm. Un sol `rigide` est plan et finit par une marche ou une bordure; un sol `souple` se raccorde en pente douce à ses voisins. Le sol est plan sous l'emprise de chaque bâtiment, de plain-pied devant chaque porte et sous chaque voie. Ce qui suit la hauteur: le maillage des tuiles, le décor et le semis (`tuile.ts`), les meubles et objets posés (`lieu.ts`), les pieds et l'ombre de contact des personnages (`CharacterFrame.ground`), les repères d'interface (`projectToScreen`).

### Ajouter une nature de sol en relief (aucun code)

1. La nature existe dans la légende de la carte (`terrain.legend`) et, pour sa teinte, dans `GROUND_LOOKS` de `reglages-tuiles.ts`.
2. Dans `reglages-relief.ts`, ajoute une entrée à `profiles`, du nom de la nature. Sans entrée, elle prend le profil de sa surface (`bySurface`).
3. `pourquoi`: la raison d'être de ce relief, en une phrase.
4. `level`: hauteur en mètres par rapport au plan de la simulation (négatif: creusé).
5. `edge`: `souple` (terre, herbe, eau) ou `rigide` (sol posé par l'homme).
6. Souple: `bumps` (bosses), `spread` (largeur du raccord, 1 m au plus), `rim` (bourrelet ou fossé posé sur les voisins), `joins` (natures rigides rejointes de plain-pied).
7. Rigide: `apron` (la terre remonte contre lui), `paving` (dalles en volume), `kerb` (bordure de pierre).
8. Copie le profil le plus proche (`chemin` pour un sol creusé, `rue` pour un dallage) et ne change que ce qui diffère.
9. `pnpm exec vitest run tests/rendu/relief.test.ts`: le test ajoute une nature factice et vérifie qu'elle paraît dans la hauteur et le maillage; un profil hors bornes est refusé avec son nom.
10. Regarde le résultat: `pnpm exec vite build`, puis `pnpm exec playwright test --config tests/rendu-encre/playwright.config.ts relief` (captures et compteurs, avec le contrôle de `?rendu=aplats`).
