# Données de Deux Tabliers: schéma

Toutes les valeurs de jeu vivent ici, en JSON, jamais dans le code. Chaque fichier est lu au chargement par un schéma Valibot (`src/donnees/schemas.ts`), puis contrôlé dans son ensemble (`src/donnees/charger.ts`: références croisées). Un fichier invalide arrête le chargement avec la liste des problèmes en français; le test de fumée (`tests/fumee.test.ts`) les lit aussi.

Conventions:

- Clés en anglais (identifiants du code), textes affichés en français, tutoiement.
- Unités: mètres, secondes, degrés. Repère du monde: celui des plans du level designer, `x` vers l'est, `z` (le `y` des plans) vers le sud, hauteur `y` vers le haut, origine au coin nord-ouest du cadre du plan.
- Identifiants: minuscules, chiffres et traits d'union (`tasse-espresso`). Un identifiant publié n'est jamais réattribué (il peut être cité par une sauvegarde).
- Couleurs: `#RRGGBB`, utilisées par le substitut quand le modèle GLB manque.
- `model`: nom du fichier `assets/modeles/<model>.glb` sans extension. Absent: un bloc de la couleur et des dimensions déclarées le remplace.

## `reglages.json`

| Clé | Type | Sens |
|---|---|---|
| `player.walkSpeed`, `player.fastSpeed` | m/s | marche, marche rapide (Maj) |
| `player.radius` | m | rayon du corps contre murs et meubles (0,3 au moins, technique 2.3) |
| `player.eyeHeight` | m | hauteur des yeux (1,65) |
| `player.fovDeg` | degrés | champ vertical par défaut (60) |
| `player.pitchLimitDeg` | degrés | inclinaison maximale du regard, vers le haut et vers le bas |
| `player.reach` | m | portée d'une main (des yeux au point visé) |
| `player.giveReach` | m | distance au plus pour donner à l'autre (1,5) |
| `aim.coneDeg` | degrés | aimant de visée (3 léger, 6 fort, ux 8.3) |
| `aim.targetRadius` | m | rayon de la sphère de visée d'un objet ou d'un emplacement |
| `mouse.degPerPixel` | degrés | sensibilité du regard |
| `seating.tableReach` | m | portée, de centre à centre, entre une assise et la table qu'elle regarde |
| `net.movesEvery` | pas | un instantané de déplacements tous les N pas (3: 20 par seconde) |
| `net.domainsEvery` | pas | examen des domaines changés tous les N pas (6: 10 par seconde) |
| `net.interpolationMs` | ms | retard d'affichage de l'autre joueur chez l'invité |

## `objets.json`: objets mobiles

`{ "objects": [ObjectType, ...] }`

| Clé | Type | Sens |
|---|---|---|
| `id` | identifiant | `tasse`, `tasse-espresso`, `plateau` |
| `label` | texte | nom affiché dans l'invite (« Tasse ») |
| `model` | nom de modèle | facultatif |
| `size` | `[largeur, profondeur, hauteur]` | m; sert au substitut et à la visée |
| `color` | couleur | substitut |
| `tray` | `{ "places": n }` ou `null` | contenant à n places (plateau): tenu, il reçoit les objets pris |

## `meubles.json`: catalogue des meubles et des postes

`{ "furniture": [FurnitureType, ...] }`

| Clé | Type | Sens |
|---|---|---|
| `id`, `label`, `model`, `color` | | comme les objets |
| `footprint` | `[largeur, profondeur]` | m, empreinte au sol à rotation nulle (largeur selon `x`, profondeur selon `z`) |
| `height` | m | hauteur au-dessus de sa base |
| `kind` | `seat`, `table`, `other` | assise et table: une assise posée regarde toujours la table la plus proche à moins de `seating.tableReach` (règle du client, 2026-11-07); le chargement refuse une assise dos à sa table |
| `blocks` | booléen | arrête les joueurs (faux pour un tapis, un cadre au mur) |
| `fixed` | booléen | ne se déplace pas en aménagement (comptoir, plonge) |
| `carry` | `none`, `one`, `two` | porté seul, à deux, ou pas du tout |
| `price` | nombre | prix au catalogue (chantier aménagement) |
| `slots` | liste de `{ "id", "x", "y", "z" }` | emplacements où poser un objet, en coordonnées du meuble (centre de l'empreinte au sol, `y` = hauteur de la surface) |
| `station` | identifiant de `postes.json` ou `null` | le meuble est un poste |
| `source` | identifiant d'objet ou `null` | pile inépuisable: « Prendre » crée un exemplaire (tasses propres) |

Rotation: un meuble posé tourne autour de son centre; à 0°, sa face avant regarde le sud (`+z`); 90° la tourne vers l'est (`+x`).

## `postes.json`: ce que fait un poste

`{ "stations": [StationType, ...] }`

| Clé | Type | Sens |
|---|---|---|
| `id`, `label` | | `machine`, « Machine à espresso » |
| `verb` | texte | invite (« Faire un espresso ») |
| `use` | `click` ou `hold` | un appui, ou maintenir pendant `seconds` |
| `seconds` | s | durée du maintien (0 pour un clic) |
| `slot` | identifiant d'emplacement du meuble | où se trouve l'objet transformé |
| `transforms` | liste de `{ "from", "to" }` | l'objet posé sur `slot` passe du type `from` au type `to` |

Ce format couvre le prototype; le chantier « postes et gestes » le complète (ingrédients, gestes de précision, qualité). Toute clé ajoutée s'écrit ici en même temps que dans le schéma.

## `adresses/<adresse>.json`: plan de la coque

Copie telle quelle d'un plan de `docs/jeux/cosy-cafe/plans/plans.json` (format `cosy-cafe-plans` du level designer, un plan par fichier: `village.json` est `village-arrivee`). Le jeu en lit:

- `levels[].elements[]`: `kind`, `shape` (`{ "rect": [x, z, largeur, profondeur] }` ou `{ "circle": [x, z, rayon] }`), `height`, `blocks`, `access` des portes;
- coque solide: `wall`, `partition`, `window`, `fixture`, `tree`, et les portes `access: "closed"`;
- sols: `floor`, `ground`;
- les éléments meubles du plan (`table`, `seat`, `counter`, `backbar`, `station`, `furniture`) ne sont pas lus: ils deviennent des meubles posés dans `departs/` (outil `outils/importer-plan.py`).

## `departs/<adresse>.json`: aménagement à l'arrivée

| Clé | Type | Sens |
|---|---|---|
| `address` | identifiant | fichier de `adresses/` |
| `spawns` | `[[x, z], [x, z]]` | départ de l'hôte, puis de l'invité |
| `furniture` | liste de `{ "id", "type", "x", "z", "y", "rotDeg" }` | meubles posés: identifiant unique dans l'adresse, type du catalogue, centre au sol, base (`y`, 0 au sol, 1,1 sur le comptoir), rotation en degrés |
| `objects` | liste de `{ "type", "furniture", "slot" }` | objets posés à l'arrivée |

## `sons.json`: sons des événements

`{ "events": { "<type d'événement>": "<identifiant du son>" } }`: l'identifiant est le nom d'un fichier `assets/son/**/<id>.ogg` sans extension (sound designer). Un son absent ne joue rien et ne bloque rien.

## Fichiers des chantiers

Chaque chantier ajoute ses fichiers ici (`recettes.json`, `profils.json`, `catalogue.json`...), les lit dans `src/<chantier>/donnees.ts` avec `readFile` et les décrit dans une section de ce document. Un fichier `service.json`, `clientele.json` ou `amenagement.json` déposé avant son lecteur est signalé au chargement.

## Service (chantier a): `service/*.json`

Lu par `src/service/donnees.ts`. `recettes.json`, `ingredients.json` et `equipements.json` sont **générés** depuis les données de la démo du game designer (`docs/jeux/cosy-cafe/demo/donnees/`) par `node games/deux-tabliers/outils/service-donnees.mjs`, puis `npx prettier --write games/deux-tabliers/donnees/service games/deux-tabliers/donnees/*.json`: ne pas les retoucher à la main. Le même script tient à jour, par identifiant et sans réécrire le reste, les objets, meubles et postes du service dans `objets.json`, `meubles.json` et `postes.json` (relançable après une fusion). Identifiants du game designer (`pain_chocolat`) écrits avec des traits d'union (`pain-chocolat`).

### `service/recettes.json`

`{ "recipes": [Recipe, ...] }`

| Clé | Type | Sens |
|---|---|---|
| `id`, `label` | | recette, et objet du même identifiant dans `objets.json` (l'article fini) |
| `family` | identifiant | famille du cahier (`black-coffee`, `milk-coffee`, `tea`, `chocolate`, `cold-drink`, `pastry-bread`, `cake`) |
| `price`, `cost` | euros | prix conseillé, coût des matières (somme des ingrédients) |
| `vessel` | `tasse`, `verre`, `assiette` | vaisselle de l'article (boissons chaudes, froides, le reste) |
| `dishes` | entier | pièces de vaisselle (un thé: la tasse et sa théière, 2) |
| `ingredients` | liste de `{ "id", "qty" }` | prélevés au stock quand l'article commence |
| `steps` | liste | étapes dans l'ordre: `station` (poste du game designer: `espresso`, `vapeur`, `bouilloire`, `vitrine`, `plan`, `frigo`, `agrumes`, `creperie`), `activeSeconds`, `passiveSeconds`, `finishSeconds` (trois valeurs: niveau 1, 2, 3 du poste), `waterC` (thé: eau visée, CO-05) |
| `unlock` | `{ "kind": "start" }`, `{ "kind": "purchase", "item" }`, `{ "kind": "regular", "regular", "level" }` | déblocage |
| `options` | liste | options possibles (`oat-milk`, `decaf`), écrites sur le ticket |

### `service/ingredients.json`

`{ "ingredients": [{ "id", "label", "unit", "unitCost", "supplier", "storage", "shelfDays", "cartonUnits", "heavy" }] }`: `storage` (`frigo`, `reserve`, `vitrine`) dit où le carton se range; `cartonUnits`, ce qu'apporte un carton; `heavy`, un gros carton; `shelfDays` 1 au plus: part au panier du soir.

### `service/equipements.json`

`{ "purchases": [{ "id", "label", "price", "tier", "effects", "furniture", "text" }] }`. `effects`: `{ "kind": "recipe", "recipe" }`, `{ "kind": "dishes", "count" }`, `{ "kind": "station-level", "station", "level" }`, `{ "kind": "equip", "equip" }`. `furniture`: meuble du service posé par l'achat (`moulin-dose`, `presse-agrumes`, `crepiere`, `bouilloire-temperature`), ou `null`.

### `service/reglages.json` (écrit à la main)

| Clé | Sens |
|---|---|
| `stationOf` | poste du game designer vers poste de `postes.json` (`espresso` et `vapeur`: `groupe` et `vapeur`, pièces de la machine; `plan` et `frigo`: le réfrigérateur et son plan) |
| `levels` | meuble posé qui monte un poste de niveau (`moulin-dose`: espresso 2) |
| `installation` | matériel posé au premier pas: `{ "id", "type", "anchor", "x", "z", "y", "rotDeg" }`, en coordonnées du meuble `anchor` (identifiant de `departs/`, `y` depuis sa base), ou du monde si `anchor` est `null` |
| `purchaseSpots` | place d'un meuble acheté: `{ "replaces": "<type>" }` (le moulin à dose prend la place du moulin) ou une place comme `installation` |
| `gestures.grind` | moulin: maintien (s), doses au plus, doses du moulin à dose |
| `gestures.extraction` | s: sous-extrait avant `underSeconds` (Correct); prête à `passiveSeconds` de la recette (12); « Parfait » pendant `perfectSeconds`, « Bien » jusqu'à `goodSeconds` après; coupure à `autoStopSeconds`; l'aide arrête `assistStopAfterSeconds` après « prête » |
| `gestures.steam` | °C: départ, relâché trop tôt sous `minC` (rien n'est fait), zones `perfectC` et `goodC`, coupure `cutC`, arrêt de l'aide `assistC`; la montée dure `activeSeconds` de l'étape jusqu'à `assistC` |
| `gestures.kettle` | °C: départ, maximum, degrés par seconde, écarts « Parfait » et « Bien » autour de `waterC` |
| `gestures.cook` | crêpe: fenêtre dorée (s), maintien au chaud au-delà |
| `gestures.order`, `wash`, `dishwasher` | caisse (2,5 s plus 0,4 s par article, CO-01), plonge (1,5 s par pièce, PL-02), lave-vaisselle (24 pièces, 45 s, PL-03) |
| `vessels` | objets propre et sale de chaque vaisselle |
| `cleanAtStart` | vaisselle propre à l'arrivée (36 pièces, `stationsAtStart.dishes`) |
| `afterEspresso` | objet d'une tasse dont le café est fait et qui attend son lait |
| `storage` | types de meubles où se range chaque sorte de carton |
| `passe`, `palette`, `cartons` | meubles du passe et de la palette des livraisons, objets carton léger et lourd |
| `startCartons` | cartons de chaque ingrédient déjà rangés à l'arrivée |

Postes du service dans `postes.json`: tous `"use": "click"`; le service mène lui-même les maintiens et écrit leur avancement dans `players[].use` pour l'anneau du HUD (`seconds`: 600, l'échelle de l'anneau, jamais atteinte). Un poste dont `transforms` recopie un objet à l'identique (`tasse` vers `tasse`) n'est une cible que si cet objet est posé sur son emplacement.

## Régénérer le départ

Régénérer après un changement du plan: `python3 games/deux-tabliers/outils/importer-plan.py`, puis `npx prettier --write games/deux-tabliers/donnees`. Le départ est régénéré en entier: une retouche à la main de `departs/` se perd, la faire dans le script.
