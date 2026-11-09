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
| `aim.stationRadius` | m | rayon minimal de la sphère de visée d'un poste (8 et 0,18 depuis les retours du 2026-11-08: plus besoin d'être pile sur le groupe ou la buse) |
| `mouse.degPerPixel` | degrés | sensibilité du regard |
| `seating.tableReach` | m | portée, de centre à centre, entre une assise et la table qu'elle regarde |
| `seating.sip.fingerCupWristDeg`, `seating.sip.fingerGlassWristDeg` | degrés | personnages à doigts: place du poignet autour de la tasse, du verre, de la droite vers l'avant (négatif: vers soi, la main reste sous l'œil aux lèvres) |
| `seating.sip.elbowOut`, `seating.sip.elbowBack`, `seating.sip.elbowDown` | m | coude visé par le bras qui boit, depuis l'épaule |
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

`{ "ingredients": [{ "id", "label", "unit", "unitCost", "supplier", "storage", "shelfDays", "cartonUnits", "heavy" }] }`: `storage` (`frigo`, `reserve`, `vitrine`) dit où le carton se range; `cartonUnits`, ce qu'apporte un carton; `heavy`, un gros carton; `shelfDays`: jours de vente d'un lot (le jour de livraison compris, réalisme v0.2). `label` et `shelfDays` recopient ceux de `clientele/fournisseurs.json` (même source, `outils/service-donnees.mjs`).

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

## Aménagement (chantier c): `catalogue.json` et `amenagement.json`

Lus par `src/amenagement/donnees.ts`. Chaque objet posable du catalogue devient aussi un type de meuble (même identifiant), ajouté au catalogue des meubles au chargement: le cœur le dessine et en tient compte aux collisions. Deux types de plus: `carton` et `carton-lourd`.

### `catalogue.json` (généré)

Converti de `docs/jeux/cosy-cafe/demo/donnees/` par `python3 games/deux-tabliers/outils/convertir-catalogue.py`, puis prettier. Ne pas retoucher à la main: changer la démo ou le script.

| Clé | Sens |
|---|---|
| `styles` | la roue des styles dans l'ordre du cahier (AM-02): campagne, jardin, nordique, rétro, bistrot, atelier. Voisins à 1 cran (comptent à moitié), opposé à 3 crans (moitié en moins), les autres se côtoient (ne comptent pas) |
| `tiers` | paliers `t0` à `t3`: `cups` (réputation) ou `orDay` (jour), le premier des deux. Le pont de l'économie (clientèle) décide; sans lui, le jour seul |
| `brocante` | `piecesPerMonday`, `discount` (-30 %), `charmFactor` (x1,5) |
| `ambiance` | barème de la démo 6.3 (décor, cohérence, confort, lumière, musique, propreté) et `words` (« Un peu vide » à « Exceptionnelle », AM-03) |
| `extensions` | `village-terrasse` (450 €, `t1`, une nuit) et `village-fond` (600 €, `t2`, deux nuits), surface ouverte au public |
| `items[]` | `id` (traits d'union), `label`, `model` (identifiant d'origine, nom du GLB de l'artiste), `category`, `style` (ou `neutre`), `price`, `charm`, `size` `[largeur, profondeur, hauteur]` (m; `null` pour un revêtement), `placement`, `rotationStep` (90, 15, ou 0 pour un objet mural), `heavy` (se porte à deux), `unlock` (`tier`, `brocante`, `regular` ou `event` avec `ref`), `text`, `color` (substitut, teinte des revêtements), `seats` (`type`: `table`, `comfort`, `counter`; `count`), `renovationPrice`, `priceUnit` (`wall`: prix par mur de la pièce; `m2`), `charmPerM2`, `unique` |

`placement`: `floor` (sol de la salle et des pièces ouvertes), `floor_terrace` (aussi la terrasse), `floor_wall` (sol, dos au mur), `floor_under` (tapis, sous les meubles), `terrace` (terrasse seulement), `wall` (pan de mur libre), `ceiling`, `surface` (dessus d'un meuble), `counter` et `counter_tip` (comptoir côté clients), `window_sill` (appui de la vitrine), `vitrine` (sur la vitre), `facade` (au-dessus de la vitrine), `terrace_store` (sous le store), `wall_cover` et `floor_cover` (revêtements, appliqués directement). `street` n'est pas encore posable.

### `amenagement.json` (à la main)

| Clé | Sens |
|---|---|
| `rules.grid` | m, grille de pose et de passage (0,25) |
| `rules.clearanceToSeat`, `rules.mainAisle`, `rules.minPassage`, `rules.seatReach` | m: passage jusqu'à chaque place (0,9), allée de la porte au comptoir (1,2), étroiture des derniers pas (0,6), longueur de ces derniers pas (0,7), C13 |
| `rules.outletReach`, `rules.waterReach` | m: distance à une prise, à un point d'eau (DE-04) |
| `rules.objectLimit` | meubles et objets posés au plus (60 au village, C6; revêtements, postes fixes et cartons ne comptent pas) |
| `rules.bigPurchase` | € : seuil d'un achat proposé à l'autre (DE-10), si la clientèle ne fixe pas le sien |
| `rules.wallSnap` | m: un bord à moins de cette distance d'un mur s'y colle |
| `rules.reach` | m: portée du mode aménagement (visée et pose) |
| `rules.ceiling`, `rules.storeHeight`, `rules.facadeY`, `rules.vitrineY`, `rules.wallItemMinY`, `rules.wallItemMaxY` | m: hauteurs de pose (plafond, store, enseigne, lettres sur la vitre, cadres) |
| `carry` | port à deux: `maxSpeed` (1,2 m/s au plus, C14), `turnDegPerSecond`, `handleGap` (poignée à cette distance du bord), `grabReach` |
| `cartons` | `small` et `heavy`: libellé, taille, couleur |
| `delivery.areas` | rectangles `[x, z, largeur, profondeur]` de la cour où le livreur dépose les cartons, et `why` |
| `rooms[]` | pièces: `space` (rectangle), `free` (où poser au sol), `outdoor`, `walls` (murs à peindre), `surfaceM2`, `extension` (qui l'ouvre, `null` pour la salle), `why` |
| `keepClear[]` | zone du plan à laisser libre (`zone`) et la phrase du refus |
| `entrance`, `aisleTargets` | point d'entrée des clients, points à rejoindre par l'allée (passe, caisse) |
| `outlets`, `waterPoints`, `needs` | prises, points d'eau, et articles qui en ont besoin (`power` ou `water`) |
| `surfaces` | par type de meuble: dessus où poser la décoration (`x`, `z`, `y`, `w`, `d` dans le repère du meuble; `placement`: `surface` ou `counter`) |
| `simone` | mobilier de départ (types de `meubles.json`) relié au catalogue: `item` (style, charme, modèle), sinon `style` et `charm`; `worn` (charme à moitié jusqu'à la rénovation), `renovationPrice` |
| `startPieces` | objets posés à l'arrivée (horloge, applique, bocal), avec leur raison (`why`) |
| `extensionWorks` | par extension: éléments du plan retirés, ajoutés ou restylés (arche, store), meubles de Simone retirés, meubles posés à l'ouverture, raison |

## Départ dans une cellule vide (démo v0.3): `installation.json` et `departs/<adresse>-cellule.json`

Lus par `src/installation/donnees.ts` (conception: `docs/jeux/cosy-cafe/demo/depart-cellule-vide-v0-3.md`). Une nouvelle partie du jeu part de la cellule (`createSession({ start: 'cellule' })` dans `main.ts`); les tests et les robots gardent le départ équipé (`departs/<adresse>.json`, valeur par défaut). Écrits à la main: aucun importeur ne les régénère.

`departs/<adresse>-cellule.json` a les clés d'un départ (`address`, `spawns`, `furniture`, `objects`), plus `spawnYawDeg` (cap des deux joueurs à l'arrivée, 0: vers le nord) et le bloc `installation`, propre au local:

| Clé | Sens |
|---|---|
| `economy` | `startCash` (€, remplace la caisse de `economie.json`), `simoneGift` (`[ingrédient, unités]`, donné quand la machine est chaude, lot daté du premier jour ouvert), `startDecor` (`[article, nombre, usé]`, décor de départ de la maison), `keepPieces` (pièces de départ de l'aménagement gardées: ce qui est scellé au mur) |
| `simone` | porte du logement et bout du comptoir (`[x, z]`), raison |
| `shutters` | rideaux métalliques (meubles posés), `door`: celui de la porte, à lever à deux |
| `shutterHandle` | poignée basse du rideau de la porte (`x`, `y`, `z`) et portée au sol (`reach`, m) |
| `sheets` | draps (meubles posés), meubles qu'ils couvrent, point visé |
| `mail`, `tools` | courrier, balai (`broom`) et seau à éponge (`sponge`): meuble posé et point visé |
| `dust` | taches de poussière (meubles `poussiere`), dans l'ordre que lit `rendu/cafe-ferme.ts` |
| `panes` | vitres blanchies (meubles `vitre-*`, identifiants des éléments du plan: `window-2`...), point visé, `sign` (« À LOUER ») |
| `lots` | lots de Simone: table, chaises retournées (meuble), drap, chaises une fois descendues (`seats`), décor qu'ils apportent |
| `oldMachine` | machine de Simone déjà en place (meuble posé) |
| `appliances` | place unique de chaque appareil (DE-04): type, identifiant du meuble posé, pose, clé de la phrase de refus (`texts.spots`) |
| `machineParts` | pièces de `service/reglages.json` (`installation`) posées quand la machine est chaude |
| `serviceDeferred` | pièces de `service/reglages.json` que le service ne pose pas d'office (arrivent avec leur appareil) |
| `deliveryArea`, `deliveryWhy` | zone du trottoir où Gaby pose les cartons `[x, z, largeur, profondeur]`, et pourquoi là |
| `nightCartonSpot`, `nightCartonWhy` | où Gaby rentre un carton oublié dehors le soir |

`installation.json` (commun à toutes les adresses):

| Clé | Sens |
|---|---|
| `rules` | durées et réglages de la section 11: `deliveryFirstSec`, `deliveryNextSec`, `deliveryJoinSec`, `heatSec`, `connectHoldSec`, `shutterHoldSec`, `sweepHoldSec`, `wipeHoldSec`, `buyHoldSec`, `returnHoldSec`, `chairsDownSec` (s); `soloLift` (m: le rideau soulevé seul); `dustCleanliness` (propreté de l'ambiance tant qu'il reste de la poussière); `whitewashPassers` (facteur des passants tant qu'une vitre est blanchie); `seatsAdvised`; `sweepRadius`, `spotReach`, `snapRadius` (m); `lookLineAfterSec`, `lookLineReach` (répliques de Simone); `budgetLineAbove` (€); `perfectBonusSec` (fenêtre « Parfait » en plus de la machine révisée) |
| `purchases` | achats « Pour ouvrir »: `id`, `name`, `price` (€), `need`, `seller`, `delivery` (`en-place`, `simone`, `gaby`), `furniture` (type que devient le carton), `heavy` (gros carton à deux), `dishes` (pièces de vaisselle), `lot`, `exclusive` (une seule machine), `text`. Ajoutés au catalogue de la clientèle au chargement (proposition à l'autre, caisse, réserve), sans effet propre: l'installation les livre et les pose |
| `needs`, `required` | besoins pour ouvrir (libellés du téléphone), et ceux qui sont obligatoires |
| `credit` | achat nécessaire, et qui fait crédit quand la caisse ne suffit plus (EC-06) |
| `texts` | répliques de Simone, courrier, invites, phrases de refus des places, pancarte, catalogue, guide d'installation (`guide`), libellé de sauvegarde |

## Régénérer le départ

## Clientèle (`clientele/`, chantier b)

Générés par `outils/importer-clientele.py` depuis les données de la démo (`docs/jeux/cosy-cafe/demo/donnees/`), les constantes de la simulation du cahier (`simulations/cosy_cafe.py`) et, pour `remises.json` et `marketing.json`, les blocs JSON du document des remises (et l'achat `cartes_fidelite` ajouté à `economie.json`); ne pas les retoucher à la main. Attention (relevé le 2026-11-08): `regles.json` a reçu des clés à la main (`queue`, `looks`, `lookWindow`, `reportMissedBelow`, `warmup`) que le script ne connaît pas encore; après l'avoir relancé, restaurer `regles.json` (`git checkout`): modifier la source ou le script, relancer, puis `npx prettier --write games/deux-tabliers/donnees/clientele`. Lus par `src/clientele/donnees.ts` (clés inconnues ignorées). Sommes en euros dans les fichiers, en centimes dans l'état.

| Fichier | Contenu |
|---|---|
| `profils.json` | les 10 profils: envies (`mainCraving`, `secondaryCravings`, familles de `carte.json`), place voulue (`counter`, `table`, `comfort`, `terrace`), sensibilité au prix, patience et attente sans gêne (s réelles), séjour (min de jeu), tailles de groupe `[taille, part]`, part qui mange, part à emporter, recommande `[toutes les n min, probabilité]`, styles, équipements recherchés, générosité, flux d'Ormeval (`groupsPerDay`), poids horaires `[heure, poids]`, facteurs des jours (mardi à dimanche), de la météo et de la saison, couleur du substitut, modèles (`client-<profil>`) |
| `regles.json` | lignes de l'ardoise (8), présents au plus (24, C2, joueurs compris), places debout au zinc, file (6, C4), estimation de l'attente, fermeture douce, points et facteurs de l'ardoise, bornes du prix, facteur du lieu, facteurs de réputation `[tasses, facteur]`, humeur, satisfaction, pourboires, livre d'or, replis des places, météo du printemps (chances, terrasse ouverte, jours forcés), portée pour parler, habitués par jour, marche des clients (grille de 25 cm, vitesse, zones interdites), places debout, attente au passe, pique-nique de la fontaine, passage de la place, vitrine, `fallbackPrepSeconds` (service d'office sans chantier a; `null` en jeu), délai de grâce de la fermeture, prise en main des premiers jours ouverts (`warmup`: par jour, groupes calmes un à la fois jusqu'à `calmUntil`, profils, taille, premier client, écart après le dernier servi, affluence ensuite, patience, part de l'affluence prévue par la commande proposée) |
| `carte.json` | les 17 recettes vues de la caisse: famille, prix conseillé, coût des matières, ingrédients `[id, quantité]`, postes, pièces de vaisselle, déblocage (`start`, `purchase` et `item`, `regular` et `level`). **Fait foi pour la carte et les prix** (le service ne lit de `service/recettes.json` que les gestes); mêmes recettes et ingrédients que le service, identifiants à tiret bas (`src/branchement/index.ts`, vérifié par `tests/journee.test.ts`) |
| `fournisseurs.json` | fournisseurs: heure de livraison, dépannage (`emergency`, vrai pour les cinq: Mireille dépanne de tout), jours de passage `days` (`tue`... de `journees.json`; personne ne livre un jour fermé), `franco` et `shipping` (euros: port ajouté à la livraison quand le total du fournisseur est sous le franco, 0 et 0 sans port); 21 ingrédients: nom au conditionnement, `pack` (libellé du carton pour la tablette, « caisse de 6 bouteilles d'1 L »), coût unitaire, rangement, conservation `shelfDays` (un lot livré le jour N se vend jusqu'au jour N + `shelfDays` - 1, jeté le matin suivant), unités par carton, carton lourd; règles de commande `ordering`: dépannage (minutes de jeu, `emergencySurcharge` appliqué au prix entier du carton), panier du soir (`basketReputationPerItem`, `basketMaxPerDay` 6, `basketSupplier`: les pièces de ce fournisseur qui finissent le soir), portions de base du premier jour, jours d'historique, `margin` (1,2) et `freshMargin` (1,1, pour `shelfDays` 2 au plus) de la commande habituelle |
| `economie.json` | caisse de départ, `startStock` (réserve de Simone: `[ingrédient, cartons]`, offerte, datée du premier jour ouvert), loyer, `charges` (liste `{ "id", "name", "perOpenDay" }` en euros, détaillée au bilan, 9 € par jour ouvert; remplace `chargesPerOpenDay`), réserve (`reserveDaysOfCharges` jours de loyer et de charges), pas de prix (-3 à +5, 10 %), seuil des achats importants, réputation (pas, pivot, rattrapage), offre de Mérelles, fête du Tilleul, ambiance (démo 6.3), brocante, marché aux fleurs, fin de la démo, paliers t0 à t3, postes et vaisselle de départ, équipements (`effects`: `poste:<poste>:<niveau>`, `equip:<x>`, `recette:<id>`, `vaisselle:<n>`, `renovate:<meuble>`), extensions (prix, palier, nuits de travaux, places), catalogue de la démo (catégorie, style, prix, charme, palier ou source), décor de départ |
| `journees.json` | heures d'ouverture et de fermeture (min de jeu), secondes par minute de jeu (et rythme paisible), jours de la semaine, les 15 jours (ouvert, titre, habitués, événement, événement du village, projets, conseils de Simone, fin de la démo), « Nos projets » |
| `habitues.json` | niveaux de lien, gains, les 6 habitués: profil, taille, fétiche et repli, horaires `[[jours], [minutes]]`, premier jour ou événement qui l'amène, répliques, conseils (Simone), étapes d'histoire (niveau, scène, récompense, tasses au moins), modèle (`habitue-<id>`) |
| `evenements.json` | les 11 événements: jour, à partir du jour, jour de repli, minute de jeu, annonce de la veille, distribution, scène, but, limite et aide (s réelles), critères, issues, récompenses (`euros`, `points`, `renown`, `affluence` `[facteur, jours]`), objets offerts, mot du livre d'or, effets du jour, `staging` (mise en scène chiffrée du studio: profil et taille des groupes, commandes, fenêtres, indices) |
| `textes.json` | dialogues (prologue, lettre de René, `simone_fete_order` le soir de l'avant-veille de la fête, `simone_first_loss` au premier lot jeté), mots du livre d'or par raison, textes d'interface de la démo |
| `remises.json` | remises v0.2 (bloc `donnees:remises` de `docs/jeux/cosy-cafe/demo/remises-marketing-v0-2.md`, section 7, recopié tel quel, plus `texts`): `floorAtCost` (jamais sous le revient arrondi au dixième supérieur), `satisfactionWeight` (part du terme de prix gagnée par une remise); `happyHour` (heures de début, durées en h, taux, réglage par défaut, familles de boissons remisées); `dailyOffer` (taux, taux par défaut, `familyWeightBonus` ajouté au poids de la famille dans le choix des clients, `pickWeight` de la recette dans sa famille, `suggestWhenLeftOverUsual`: la tablette suggère l'offre quand le reste d'un lot qui finit demain dépasse ce multiple des ventes habituelles); `profileRates` (tarif réduit d'un profil: `profile`, taux, jours par défaut; grisé si le profil n'a aucun groupe au village); `loyaltyCard` (achat `purchase` de `economie.json`, tampons, familles tamponnées, profils porteurs, part de porteurs: départ, plus par jour ouvert avec la carte, plafond; `attractionBonusMax` à la part maximale, satisfaction et chance du mot du livre d'or du café offert); `formulas` (P1, lues plus tard); `texts`: noms des remises (ticket, bilan), libellés des tarifs, raison d'un tarif grisé, mots du livre d'or des remises |
| `marketing.json` | actions pour faire connaître le café (bloc `donnees:marketing`, section 7, plus `name`, `blurb` et `guestbook` de la section 5): `maxBoost` (facteur d'un profil `1 + maxBoost x (1 - exp(-E / maxBoost))`, `E` somme des suppléments), `repeatFactor` et `repeatCooldownDays` (relancée moins de N jours après sa fin: effet multiplié), chance et satisfaction minimale du mot du livre d'or, `bigProposalEuros` (au-delà, l'action est proposée à l'autre). Par action: `tier` (seules les P0 se lancent), `cost` (euros, payés au lancement), `delayDays` (premier effet N jours après le soir du lancement), `launchWeekdays` (jour de lancement effectif: le soir de ce jour ou du prochain), `deadlineWeekday` et `publishWeekday` (bouclage et parution d'un hebdomadaire), `durationDays`, `peak` et `halfLifeDays` (supplément `peak x poids x 0,5^(t / demi-vie)`), `profiles` (poids par profil); les clés P1 (`requires`, `burst`, `unlockEvent`...) sont lues plus tard |

Remises et marketing (v0.2, `src/clientele/remises.ts`): le réglage de l'onglet (`discounts`, `null` tant qu'on n'y a pas touché) est copié à l'ouverture (`activeDiscounts`) et vaut toute la journée; l'offre du jour est consommée à l'ouverture. Une seule remise par ligne (la plus forte), prix arrondi au dixième inférieur; l'heure douce se lit à l'arrivée du groupe (une recommande: à son heure). Le café offert de la carte est le moins cher de la commande; les tampons des habitués sont gardés (`stamps`). Une action se paie au lancement (`today.marketing`, ligne « Publicité » du bilan du jour, même lancée après le bilan); `campaigns` garde les actions lancées. Le compteur « Venus grâce à » ajoute pour chaque groupe servi (habitués et invités de scène exclus) la part `(F - 1) / F`, répartie entre les actions au prorata de leur supplément. Sans remise ni action, aucun tirage au hasard de plus: l'économie est celle du réalisme v0.2 au centime (`recette-quinze-jours.test.ts`, RM-01).

Gestion du café (réalisme v0.2, `docs/jeux/cosy-cafe/demo/realisme-v0-2.md`): la marchandise se paie à la livraison du matin (cartons et port), jamais à la vente; la commande du soir vaut pour le prochain jour ouvert et seuls les fournisseurs qui passent ce jour-là livrent; elle est mise de côté dans la caisse (`availableCents`). Le stock de l'état (`world.clientele.stock`) reste la somme des lots datés (`lots`: `[quantité, dernier jour]`, du plus ancien au plus récent), consommés du plus ancien au plus récent. Pas de TVA (franchise en base, dit au bilan), pas de cotisations sociales en v0.2.



Régénérer après un changement du plan: `python3 games/deux-tabliers/outils/importer-plan.py`, puis `npx prettier --write games/deux-tabliers/donnees`. Le départ est régénéré en entier: une retouche à la main de `departs/` se perd, la faire dans le script.
