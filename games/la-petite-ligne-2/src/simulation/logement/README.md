# Logement et mode déco

Le moteur ne nomme aucun logement: tout vient de `donnees/lieux/<lieu>/logements/<id>.json` (gabarit `_gabarits/logement.jsonc`, schéma `src/donnees/schemas/logement.ts`) et de la section `deco` des meubles. L'état vit dans `PlaceState.housing` (`src/etat/logement.ts`), créé au premier pas dans le lieu.

| Fichier | Rôle |
|---|---|
| `reglages.ts` | pas de grille, seuil des portes, vitesse à deux, paliers de confort, bonus de sommeil |
| `pose.ts` | règles de pose pures (aperçu chez chacun, décision chez l'hôte): zone, pièce restaurée, fonction débloquée, couche, surface, mur, porte, passage libre. `housingPart`: le morceau du logement autour d'un point (rez-de-chaussée, étage, cave, jardin) |
| `chantier.ts` | brique `worksite` (l'objet du chantier d'une pièce), lectures pures de l'étape en cours et de son refus, portée de la pièce ou de son chantier |
| `etat.ts` | création, confort, palier, logement d'un point |
| `index.ts` | le système: intentions `housing_supply`, `housing_pay`, `housing_work`, `furniture_stow`, `deco_*`; travail par pas; bonus de sommeil à l'aube |
| `valider.ts` | contrôles entre fichiers (objets, meubles, pièces, chantiers, objets meubles et leur fiche) |

Restauration: une étape demande ses matériaux (apportés par l'un ou l'autre, en plusieurs fois), son prix (coffre commun, puis la bourse de qui paie), son travail (plus vite à deux, bouger l'arrête) et ses conditions d'histoire. La dernière étape restaure la pièce et retient le fait `<lieu>.<logement>.<pièce>`. Une pièce `absent` est un agrandissement (nouvelle pièce, étage); un appartement n'a que des pièces `restored`.

Confort: pièces restaurées et meubles posés par les joueurs (les copies d'un même meuble au-delà de deux comptent pour moitié). Chaque palier atteint retient `<lieu>.<logement>.confort-<n>` (condition `remembered` des quêtes), jamais retiré. Au réveil dans un lit du logement: sommeil plus `palier x sleepBonusPerLevel`.

Mode déco à deux: le meuble en main (`held`) est le verrou; sa position part dans la tranche « lieu », l'autre voit le geste. Ce qui est posé sur une surface la suit quand on la déplace; une table chargée, un coffre plein, une chaise occupée ne se rangent pas.

Chantier jouable: une pièce nomme son chantier (`site`: un objet de la carte à brique `worksite`, l'ardoise de devis). Devant lui, la touche d'action émet `worksite_opened`; l'écran (`src/interface/chantier/`) envoie les trois intentions et écrit en clair chaque refus (`room-nothing-to-give`, `not-enough-money`, `room-missing-materials`, `room-not-paid`, `room-needs-other`, `room-story-not-yet` avec la phrase `says` de l'étape). Le chantier peut se tenir hors de la pièce: on est à portée près du sol de la pièce ou près de son chantier. Le travail ne compte que si l'étape a ses matériaux et son argent; une étape finie pose les marteaux si la suivante demande autre chose.

Passage libre: jugé dans le morceau du logement où l'on pose, par rapport à ce qui communiquait avant (deux portes reliées le restent, un lit atteignable le reste, un lit posé a un côté atteignable). Les autres morceaux, le reste de la carte du lieu et les meubles de carte conditionnés absents ne comptent pas.

Meubles obtenables: un objet du sac qui déclare sa fiche (`prop`, famille `furniture`) entre dans l'inventaire de la maison à l'ouverture du mode déco chez soi (tous ceux du sac et de la barre) ou par `furniture_stow` (« Ranger à la maison »), événement `furniture_stowed`. Repris en mode déco, il retourne à l'inventaire, pas au sac. Recette d'ajout: `donnees/commun/meubles/README.md`.
