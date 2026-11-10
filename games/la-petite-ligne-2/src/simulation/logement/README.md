# Logement et mode déco

Le moteur ne nomme aucun logement: tout vient de `donnees/lieux/<lieu>/logements/<id>.json` (gabarit `_gabarits/logement.jsonc`, schéma `src/donnees/schemas/logement.ts`) et de la section `deco` des meubles. L'état vit dans `PlaceState.housing` (`src/etat/logement.ts`), créé au premier pas dans le lieu.

| Fichier | Rôle |
|---|---|
| `reglages.ts` | pas de grille, seuil des portes, vitesse à deux, paliers de confort, bonus de sommeil |
| `pose.ts` | règles de pose pures (aperçu chez chacun, décision chez l'hôte): zone, pièce restaurée, fonction débloquée, couche, surface, mur, porte, passage libre vers l'entrée, les portes et un côté de chaque lit |
| `etat.ts` | création, confort, palier, logement d'un point |
| `index.ts` | le système: intentions `housing_supply`, `housing_pay`, `housing_work`, `deco_*`; travail par pas; bonus de sommeil à l'aube |
| `valider.ts` | contrôles entre fichiers (objets, meubles, pièces) |

Restauration: une étape demande ses matériaux (apportés par l'un ou l'autre, en plusieurs fois), son prix (coffre commun, puis la bourse de qui paie), son travail (plus vite à deux, bouger l'arrête) et ses conditions d'histoire. La dernière étape restaure la pièce et retient le fait `<lieu>.<logement>.<pièce>`. Une pièce `absent` est un agrandissement (nouvelle pièce, étage); un appartement n'a que des pièces `restored`.

Confort: pièces restaurées et meubles posés par les joueurs (les copies d'un même meuble au-delà de deux comptent pour moitié). Chaque palier atteint retient `<lieu>.<logement>.confort-<n>` (condition `remembered` des quêtes), jamais retiré. Au réveil dans un lit du logement: sommeil plus `palier x sleepBonusPerLevel`.

Mode déco à deux: le meuble en main (`held`) est le verrou; sa position part dans la tranche « lieu », l'autre voit le geste. Ce qui est posé sur une surface la suit quand on la déplace; une table chargée, un coffre plein, une chaise occupée ne se rangent pas.
