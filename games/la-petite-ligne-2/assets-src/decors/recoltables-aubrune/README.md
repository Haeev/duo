# Récoltables d'Aubrune: tout ce qu'on récolte et tout ce qui pousse dehors

Style encré validé (référence: la végétation de la scène d'essai, `src/rendu/demo-encre/vegetation.ts`), porté en modèles livrés. Identité du lieu: campagne, herbe tendre, terre blonde, bois miel. Un autre lieu aura son dossier, son nuancier et ses essences.

```text
bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/construire.sh     (tout, 10 s)
bash games/la-petite-ligne-2/assets-src/decors/recoltables-aubrune/planche/planche.sh (planche, 3 min)
```

Sorties, dans `assets/commun/decors/` (les fiches de meubles de `donnees/commun/` servent dans plusieurs lieux et `DecorModels` charge ce dossier une fois; le nom du fichier porte le lieu): `aubrune-arbres.glb`, `aubrune-recoltes.glb`, `aubrune-potager.glb`, et leurs entrées dans le manifeste commun `decors.json` (`source: "recoltables-aubrune"`, tables `materials` et `crops`). Le script finit par `VERIFICATION recoltables: ... 0 erreur(s)`.

## Ajouter un récoltable (aucun code)

1. Ouvre `recoltables.toml` et copie l'entrée `[[modeles]]` la plus proche (même `famille`: arbre, buisson, rocher, fleur, bois, repere, parcelle, culture).
2. Change `id` (anglais, minuscules, traits d'union) et `graine` (elle fixe la forme).
3. Arbre: choisis ou copie une `[essences.<nom>]` (fût, houppier, teintes, fruits). Culture: `culture` est l'identifiant de sa fiche `donnees/commun/cultures/`, dont le nombre de stades est lu.
4. Ajoute au besoin `variantes` (autres formes tirées à la pose) et `etats` (`stump`, `winter`, `bare`, `chipped`; pour un arbre semé, `far` et `shade`: ses versions allégées, réglées par `[allege.far]` et `[allege.shade]`, que le rendu pose loin du couloir de jeu et dont il fait les ombres portées).
   `pose = { cap = true, echelle = [a, b] }`: écarts de pose propres au modèle et à ses variantes, à la place de ceux de la famille (un modèle trop petit à la caméra de jeu se grossit ici, sans retoucher les formes).
5. Une teinte nouvelle: une ligne dans `[teintes]` (deux ou trois tons, une pièce tire le sien).
6. `bash construire.sh`: modèles, manifeste et contrôle (budget, sol, matériaux, états attendus par les fiches).
7. Branche la fiche: `"model": "<id>"` dans `donnees/commun/meubles/<meuble>.json`, ou `"model": "crop-<culture>"` dans la fiche de la culture.
8. Regarde-le: ajoute-le à une vue de `planche/monter.py`, puis `planche/planche.sh`.
9. `pnpm exec vitest run tests/rendu/recoltables.test.ts`: aucune ressource des données sans modèle.

## Ce que le rendu lit

- **Modèle d'un meuble**: `model` de sa fiche (inchangé). `DecorModels.instantiate(model, clé, état)` tire la forme (`variants`), le cap et l'échelle (`jitter`) de la clé de l'exemplaire (son identifiant dans le lieu: la même forme chez les deux joueurs); l'état garde ce cap et cette échelle. Ce que le jeu lit dans l'état transmis: `src/rendu/lieu/recoltes.ts` (README du dossier).
- **États** (`decors-manifeste.ts`): `stateModel(model, état)` rend le modèle de `stump` (arbre abattu), `bare` (sans fruits, tas vide), `winter` (sans feuilles), `chipped` (rocher entamé), `tilled` et `watered` (case bêchée, arrosée, de 1 m, à poser sur le potager); `null`: il ne reste rien (`after: "gone"`).
- **Cultures**: `cropModel(crop.model, stade, à arroser)` rend le modèle d'une case (le stade `stages.length` est mûr). Les plants sont posés sur les billons: même origine que la case bêchée.
- **Matériaux** (table `materials` du manifeste, lue par `mergeNamed` de `decors.ts`): la couche de traits et la prise au vent viennent du NOM; la teinte de `COLOR_0`. Chaque modèle est fusionné au chargement en un seul maillage (un appel de dessin par exemplaire).

| Matériau    | Emploi                                 | Couche  | Vent                  |
| ----------- | -------------------------------------- | ------- | --------------------- |
| `feuillage` | touffes, feuilles des ronces           | `leaf`  | plie et frémit        |
| `ecorce`    | tronc et branches d'un arbre vivant    | `bark`  | plie avec le houppier |
| `bois`      | souche, bûche, piquet, branche morte   | `grain` |                       |
| `pierre`    | rochers, cailloux, éclats              | `face`  |                       |
| `mousse`    | plaques de mousse                      | `leaf`  |                       |
| `terre`     | friche, billons, mottes, flaques       | `dirt`  |                       |
| `tige`      | tiges, herbes, feuilles des plants     | `plain` | plie                  |
| `fruit`     | pommes, mûres, radis, tomates          | `plain` | plie                  |
| `fleur`     | corolles, ombelles, massettes, bouchon | `plain` | plie                  |
| `flamme`    | langues de flamme, verre des lampes    | `plain` | luit (`flame`)        |
| `braise`    | braises et lit de braise d'un feu      | `plain` | luit (`flame`)        |

Feux (`feu.py`, remarques du client du 2026-11-11: « le feu est mal fait, il doit être animé »): marmite, four, grand chaudron, brasero, poêle et lumignon brûlent d'un même foyer: bûches croisées (`bois`) qui reposent les unes sur les autres, lit de cendre, braises (`braise`), et des langues de flamme (`flamme`) de taille inégale, chacune une pièce à part (un morceau d'un seul tenant, pied enfoncé de 1 cm dans la braise ou dans le bois), la plus haute au milieu, jamais au-dessus du plafond (cul de la marmite, linteau du four). Rien n'est animé ici: le nuanceur du jeu peut animer les morceaux de `flamme`. Attention: `mergeNamed` fusionne le modèle et ne garde que la nature (`flame`) du matériau, commune à `flamme` et `braise`; pour animer les seules flammes, le rendu devra garder le nom (ou une nature à part). Un feu éteint (`vif = False`: four `bare`, grand chaudron `bare`) garde ses bûches noircies sur la cendre, sans braise ni flamme.

- **Vent**: le nuanceur du jeu plie ce qui est souple selon la hauteur au-dessus de l'origine du modèle (le pied). Il n'y a donc pas d'attribut de poids dans les GLB: l'origine au pied suffit.
- **Normales**: imposées. À plat pour la pierre et le bois; rayonnant du coeur de chaque touffe pour le feuillage (l'ombre dessine une masse); lissées pour la terre (pas d'arête tracée entre deux billons).
- **Faces absentes**: ni dessous ni UV (la caméra plonge de 35 à 50 degrés, la matière encrée projette ses traits).

## Raisons d'être

- Le houppier commence à la hauteur du fût (2,9 m pour le chêne): on passe dessous. À 50 degrés de plongée il cache quand même le haut du personnage qui travaille au pied: l'effacement du rendu doit suivre `size` du manifeste (largeur réelle du houppier), pas la case du tronc.
- Une branche finit dans une touffe; une ronce retombe sur son fourré; les fruits sont posés sur le dessus des masses, là où la caméra les voit.
- Une case bêchée est une planche de terre relevée de 7 cm (plus haute que les bosses de la friche qu'elle recouvre) qui porte trois billons; les plants poussent sur les crêtes; l'eau brille au fond des sillons d'une case arrosée; une plante à arroser a les feuilles tombantes et jaunies, sur une terre claire.
- Le piquet d'un pied de tomate est planté dès la première vraie feuille et dépasse toujours la plante.
- Repères: la fouille se voit à ses éclats clairs sur une motte, la pêche à son bouchon rouge et blanc pendu au piquet, le coin à insectes à ses ombelles blanches.

## Fichiers

| Fichier                          | Rôle                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `recoltables.toml`               | budgets, matériaux, nuancier, essences, modèles: la seule chose à modifier    |
| `formes.py`                      | atelier des formes (touffe, fût, galet, feuille), numpy et scipy              |
| `familles.py`                    | une fonction par famille, variantes et états                                  |
| `amenagements.py`                | haies, talus, rangs du labour, voie, meubles, ouvrages (repères)              |
| `plantes.py`                     | ports des cultures: carotte, poireau, pomme de terre, fleurs                  |
| `fetes.py`                       | décor des fêtes (meubles du dehors, lumières)                                 |
| `construire.py`, `construire.sh` | écriture des GLB par Blender, manifeste, puis contrôle                        |
| `verifier.py`                    | contrôle sans Blender (GLB, budgets, sol, fiches du jeu, volumes)             |
| `controle_volumes.py`            | trous vus de dos, pièces qui flottent, pièces qui en traversent une autre     |
| `feu.py`                         | foyer commun: bûches, braises, langues de flamme                              |
| `mobilier.py`                    | mobilier repris de l'ancienne chaîne (lits, armoire, pompe, voiture du train) |

## Contrôle des volumes (ce que le client voit en tournant autour)

Le client regarde chaque modèle dans une visionneuse, de tous les côtés et de près. `verifier.py` lit chaque GLB et cherche (`controle_volumes.py`, numpy seul, deux processus):

- **trou**: d'un point de vue de côté (8 degrés) jusqu'à l'aplomb, le premier triangle touché est vu de dos (face manquante, plaque à simple face vue de derrière, bout de tube ouvert, dedans d'un volume ouvert). Pas compté: ce qui touche le sol (2 cm), les bouts d'un module de file, le dos d'un objet contre le mur (`appui = "mur"` dans l'entrée, ou couche `wall` de la fiche).
- **flotte**: une pièce (morceau d'un seul tenant) reliée au sol (au billon pour une culture, au mur pour un objet mural) par aucune chaîne de pièces distantes de moins d'un centimètre. Les bords libres sont refermés pour juger l'appui (un plateau sans dessous repose sur ses pieds).
- **traverse**: une pièce en perce une autre de part en part (une même arête entre et ressort, et passe à 5 mm au moins de sa surface): pied qui ressort d'un plateau, jambe de trépied à travers un chaudron. Une pièce posée, enfoncée ou accrochée par ses deux bouts (anse) ne compte pas.

Pièges vus: deux boîtes jointives au même plan (faces confondues) et le tremblé font de fausses percées; décaler de 1 à 2 mm (joint) ou enfoncer franchement. Un tube ouvert (`bouts`) se voit par son bout. Une boîte penchée sans dessous (`sans="y-"` par défaut de `s.box`) montre son dedans: `sans=""`.

`[volumes] a_reprendre` (dans `recoltables.toml`) liste les modèles dont les défauts sont connus et pas encore repris: leurs défauts s'affichent en `A REPRENDRE` sans faire échouer la construction; tout autre modèle doit être net. La liste ne fait que rétrécir.

## Mobilier repris de l'ancienne chaîne (`mobilier.py`, `aubrune-mobilier.glb`)

Famille `mobilier`: les meubles que des fiches posent encore et qui venaient de l'ancienne chaîne arrondie (retirée, voir `../README.md`), refaits en style encré sous leurs identifiants: `bed-double`, `bed-single`, `chair-farm`, `table-farm`, `wardrobe`, `chest`, `bench-platform`, `tub`, `fence`, `platform-sign`, `water-pump`, et la voiture du train de nuit (`train-*`). Le manifeste reçoit `seat` (assise: hauteur, bord avant), `bed` (couchage) et `top` (plateau). Ajouter: copier l'entrée de la même `sorte`, changer `id` et `graine`; une forme nouvelle est une branche de `_un_meuble`.

| `planche/` | page de contrôle sur le rendu encré du jeu, captures, montage |

## Aménagements: haies, berges, labour, meubles, repères (`amenagements.py`)

Ce qui restait en blocs provisoires, dans la même chaîne (mêmes teintes, mêmes règles, même contrôle). Fichiers: `aubrune-lisieres.glb` (modules de file), `aubrune-meubles.glb`, `aubrune-ouvrages.glb`. Planche: `bash planche/provisoires.sh` (2 min 30), qui écrit `docs/jeux/jeu-1/refonte/planches/provisoires-aubrune.png`.

| Famille   | Modèles                                                                                                                                                                                 | Budget | Branché en jeu                                 |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------- |
| `haie`    | `hedge` (et `-b`, `-c`), `hedge-end`, `hedge-corner`                                                                                                                                    | 60     | oui, en files fusionnées (voir plus bas)       |
| `talus`   | `bank` (et `-b`), `bank-end`, `bank-corner`, `bank-corner-inner`                                                                                                                        | 60     | oui, même chaîne                               |
| `rang`    | `field-row` (et `-b`): un mètre de rang du labour, le long de z                                                                                                                         | 60     | oui, même chaîne                               |
| `meuble`  | `four`, `cuisiniere`, `plan-de-travail`, `rechaud`, `comptoir` et `comptoir-*`, `ratelier` et `ratelier-forge`, `enclume`, `etabli`, `meule`, `poulailler`, `etal`, `miroir`, `marmite` | 600    | oui, par le champ `model` des fiches           |
| `ouvrage` | `water-tower`, `water-crane`, `semaphore`, `mill-wheel`, `tunnel-portal`, `dovecote`                                                                                                    | 2 500  | oui, sauf `water-crane` (pas de place au plan) |

Ajouter un meuble: copier l'entrée `[[modeles]]` de la même `sorte` (ou une garniture de comptoir: `buvette`, `epicerie`, `fournil`, `mercerie`, `cafe`), changer `id` et `graine`, `etats = ["bare"]` si la fiche a un stock qui se vide, puis `construire.sh` (il refuse un meuble qui sort des cases de sa fiche) et `"model": "<id>"` dans la fiche. Une forme nouvelle de meuble est une branche de `_meuble`.

### Ajouter une sorte de lampe (aucun code)

1. Dans `recoltables.toml`, copier une entrée `famille = "luminaire"` (`street-lantern`, `platform-lantern`, `door-lantern`), changer `id`, `graine`, `pourquoi`; `lumiere = { rayon = 5.0 }` (rayon de la flaque, m), au besoin `couleur = "#rrggbb"` et `force`. Le verre se peint en `flamme`: il luit quand la lampe est allumée.
2. `construire.sh`: le manifeste reçoit `light` (foyer calculé par la forme, rayon, couleur).
3. Copier une fiche `donnees/commun/meubles/reverbere.json`, changer `id`, `name` et `"model": "<id>"`.
4. Poser des meubles de ce type dans `carte.json` du lieu, chacun avec son `pourquoi` (où l'on passe la nuit).
5. Rendu (`src/rendu/encre/lumieres.ts`): au dehors, la lampe s'allume à son rang à la tombée du jour (`INK_SETTINGS.lamps`); contre une façade (`attachReach`), elle suit l'éclairage du bâtiment.
6. Fenêtres: un commerce s'éclaire à ses heures, une maison selon le planning de ses habitants; un bâtiment sans habitant déclare `eclairage` (plages `de`, `a`, `niveau`, `force`) dans sa fiche de `batiments/`.
7. Borne: les `MAX_LAMPS` (6) lampes et `MAX_WINDOWS` (8) fenêtres allumées les plus proches du point visé posent leur lumière; les autres gardent leur verre allumé.
8. Test: `tests/rendu/eclairage.test.ts`.

Modules de file (haie, talus, rang): chaque module court d'ouest en est sur exactement 1 m (le rang, du nord au sud), ses deux bouts ont le même profil, sans tremblé, et des normales tirées du profil seul: n'importe quelle suite de formes se raccorde. `bout` ferme la file à l'est, `angle` tourne de l'ouest vers le nord (haie), `angle` et `angle_rentrant` suivent l'eau au sud et à l'est (talus); le rendu les tourne d'un quart de tour pour les autres côtés. Le contrôle refuse un module qui ne commence pas à -0,5 m ou qui sort de sa case.

Branchement en jeu (`src/rendu/lieu/files.ts`, données dans `reglages-files.ts`, recette dans `src/rendu/lieu/README.md`):

- Haies, talus, rangs: une file par cases (`RUN_SORTS`), un module par case choisi d'après ses voisines (forme tirée de la case, bout, angle, quart de tour, miroir du bout de talus, côté de l'eau), chaque sorte fusionnée en un maillage par tuile, chaque file d'une seule pièce de contour.
- Repères: un modèle par nature (`LANDMARK_LOOKS`: `chateau-d-eau`, `signal`, `roue`, `portail`, `pigeonnier`), orienté par la voie ou le bief. La grue à eau `water-crane` n'est pas posée: le plan ne donne pas sa place (à ajouter au plan par le level designer, puis une nature de repère).

## Objets d'intérieur (`interieurs.py`, `aubrune-objets.glb`)

29 objets qui densifient les pièces (budget 150, 300 pour `coat-rack`, `dresser`, `wood-stove`, `vegetable-crate`), chacun avec sa fiche posable dans `donnees/commun/meubles/` (`deco.layer`). Origine au centre de l'emprise, avant vers +z; selon la couche: `floor` et `rug` au plancher, `top` à y = 0 sur le plateau qui le porte (le rendu doit l'élever au `top` du meuble porteur), `wall` contre le mur en z = -0,5 avec ses hauteurs réelles (cadre à 1,62 m, régulateur à 2 m). Lampes (`table-lamp`, `oil-lamp`, `wood-stove`): verre ou abat-jour en `flamme`, `lumiere` dans l'entrée, comme les lampes du dehors. Le contrôle refuse un objet qui sort des cases de sa fiche.

Ajouter un objet: copier l'entrée `famille = "objet"` la plus proche dans `recoltables.toml` (même `sorte`, ou `forme` pour un cadre, `groupe` pour les bocaux), changer `id` et `graine`, `construire.sh`, puis copier une fiche voisine (`lampe-de-table.json`, `cadre-portrait.json`) avec `"model": "<id>"`. Une forme nouvelle est une branche de `_objet`.

## Trains vus du dehors (`vehicules.py`, `aubrune-trains.glb`)

`railcar` (l'autorail du 5 h 12), et le train du samedi: `tank-engine`, `passenger-coach`, `luggage-van` (budget 2 500 par véhicule). Origine au centre du véhicule au niveau du ballast, longueur le long de z, avant vers +z; mesures de la voie du jeu: roues sur le rail (dessus à 0,26 m, rails à 0,72 m de l'axe), caisse de 2,7 m (15 cm de jeu au nez du quai à 1,5 m de l'axe), plancher à 1 m, deux marches de 29 cm sous chaque porte, portes des deux côtés. Les vitres des voyageurs sont en `vitrage` (verre qui s'allume avec les lampes, comme `flamme`): la nuit la caisse est éclairée; `lumiere` pose la flaque de la voiture sur le quai. Tampon contre tampon: autorail 14,52 m, locomotive 8,9 m (tampons de 4,46 m à l'avant et 4,61 m à l'arrière du centre), voiture 12,92 m, fourgon 9,92 m. Branchés par les données: le champ `train` d'un événement cite ses véhicules par identifiant (`donnees/lieux/aubrune/evenements/`), `src/rendu/lieu/trains.ts` les pose sur la voie. La scène du trajet du prologue (`src/rendu/voyage/`) montre `railcar` (`train` de ses réglages).

Planche: `bash planche/trains-interieurs.sh` (11 vues, environ 3 min), qui écrit `docs/jeux/jeu-1/refonte/planches/trains-et-interieurs.png`.

## Cultures, fêtes, voie (troisième lot)

Planche: `bash planche/cultures-fetes.sh` (9 vues, environ 3 min), qui écrit `docs/jeux/jeu-1/refonte/planches/cultures-fetes-reprises.png`.

- **Cultures** (`plantes.py`, ports à côté de `rosette` et `tuteur`): `fanes` (carotte), `eventail` (poireau), `touffe` (pomme de terre), `fleur` (les douze fleurs des collections). Une fleur se règle dans son entrée: `forme` (silhouette vue de haut: etoile, marguerite, capitule, pompon, pensee, coupe, cornet, collerette, frange, rose, grappe, clochettes), `feuillage` (lance, ronde, larges, fines, buisson), `fleurs` par plant, `rayon` d'une tête, teintes `corolle`, `coeur`, `feuille`. Ajouter une fleur: copier l'entrée la plus proche, changer `id`, `culture`, `graine` et les teintes, `construire.sh`, puis `"model": "crop-<id>"` dans sa fiche. Une culture sans fiche (`carotte`, `poireau`, `pomme-de-terre` aujourd'hui) donne `stades`: la fiche le remplace dès qu'elle existe. Têtes de 4 à 8 cm de rayon, un peu tournées vers le sud: plus petites, elles se perdent dans leur trait à la caméra de jeu.
- **Fêtes** (`fetes.py`, famille `fete`, `aubrune-fetes.glb`, budget 600): `festival-candle` (lumignon), `lampion-garland` (4 cases, poteau ouest; `lampion-pole` ferme la file à l'est), `bandstand` (4 x 3), `festival-cauldron` (2 x 2, état `bare`), `brazier`, `crossing-gate-flowered` (5 x 1, bras le long de x: tourner la fiche pour qu'il barre la route), `festival-banner` (4 x 1), `banquet-table` (3 x 1), `tapped-barrel`, `chalk-board`. Ce qui brûle est en `flamme`, avec `lumiere`. Fiches dans `donnees/commun/meubles/` (seul `lumignon` est posable par les joueurs); rien n'est posé sur les cartes.
- **Voie** (famille `voie`, `aubrune-lisieres.glb`): `rail-cutting` (et `-b`, tranchée: ballast, fossés d'eau, talus de 1,6 m et son revers) et `rail-bed` (au ras du pré), un mètre le long de z, sous les traverses du jeu. Posés par le moteur le long du tracé des voies (`TRACK_BED` de `src/rendu/lieu/reglages-files.ts`, `lits-de-voie.ts`).
- **Reprises** (revue visuelle du 2026-11-11): `tunnel-portal` porte son coteau modelé (crête à 9 m, flancs retenus par les murs en aile, rochers, arbustes, deux jeunes arbres); `comptoir-fournil` est une vitrine (bas de bois, caisse vitrée à cadre, pains visibles par le dessus); comptoirs de l'épicerie au vert des volets, de la mercerie à la tuile, du café en bois (nuancier-v02, `aubrune_jour`).

## Livrés sans fiche de jeu (à brancher par le game designer et le level designer)

`berry-bush` (buisson à baies), `rock`, `rock-mossy`, `boulder`, `boulder-mossy` et leurs états `chipped` (aucune ressource de pierre à miner dans les données), `wild-herbs`. Les états `winter` attendent que le rendu lise la saison.

Branchés sans meuble: `fishing-spot` sur la berge de chaque coin de pêche de `lieu.json`, `insect-spot` dans les zones de `nature.json` (`markers` de `src/rendu/lieu/reglages-recoltes.ts`); `oak-tree`, `ash-tree`, `birch-tree` et `berry-bush-bare` pour la végétation semée par tuile (`semis`).
