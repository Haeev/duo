# Bâtiments d'Aubrune: jeu de pièces et assembleur

Style encré validé (référence: la maison de Firmin de la scène d'essai, `src/rendu/demo-encre/bati.ts`), porté en pièces Blender réutilisables. Identité du lieu: pierre, crépi, tuiles, bois, rustique. Ces pièces ne servent qu'à Aubrune; un autre lieu aura son dossier, son nuancier et ses pièces.

```text
bash games/la-petite-ligne-2/assets-src/decors/batiments-aubrune/construire.sh        (tout, 15 s)
bash games/la-petite-ligne-2/assets-src/decors/batiments-aubrune/construire.sh firmin (une fiche)
```

Sorties, dans `assets/lieux/aubrune/batiments/` (convention de `assets/README.md`: le décor d'un lieu est chargé à l'arrivée): `<id>.glb` par fiche, `batiments.json` (manifeste), `pieces/pieces-aubrune.glb` et `.json` (les pièces seules). Le script finit par `VERIFICATION batiments: ... 0 erreur(s)`.

## Ajouter un bâtiment (aucun code)

1. `pnpm nouveau batiment <id> aubrune`: copie le gabarit dans `donnees/lieux/aubrune/batiments/<id>.json`. `<id>` est celui du bâtiment dans la carte (`buildings`).
2. Ouvre `donnees/_gabarits/batiment.jsonc` à côté: chaque champ y est expliqué.
3. Remplis: emprise du plan, niveaux, finition, couleurs, toit, porte (façade et place du plan).
4. Liste les ouvertures de chaque façade, de gauche à droite vues de dehors: elles se répartissent seules.
5. Ajoute les options: cheminée au-dessus du foyer, enseigne, auvent, lucarne.
6. Écris `detail`: ce qui le fait reconnaître de haut, et pourquoi.
7. `bash assets-src/decors/batiments-aubrune/construire.sh <id>`: le modèle, le manifeste, le contrôle (budget, emprise et porte du plan). Une fiche impossible est refusée avec la raison (« 6,30 m d'ouvertures pour 5,40 m de mur libre »).
8. Regarde-le: `duo-python apercu.py <id>.glb <image.png>` (rapide), ou la planche encrée (`planche/planche.sh`).
9. `pnpm test`: `tests/batiments.test.ts` vérifie fiche, modèle, emprise et porte.

## Ce que le rendu doit lire

- **Manifeste** `batiments.json` (`BuildingManifestSchema` de `src/donnees/schemas/batiment.ts`): par identifiant de bâtiment de la carte, `fichier`, `noeud`, `emprise`, `hauteur`, `triangles`, `porte` (façade, seuil en mètres depuis le centre de l'emprise), `fenetres` (rez-de-chaussée: x, appui, z, largeur, hauteur, normale: de quoi jeter leur lumière dehors la nuit, mêmes champs que `WindowLight` de l'essai).
- **Pose**: origine au centre de l'emprise, au sol; rotation 0 (les façades sont déjà dans le repère du monde); x est, y haut, z sud. Position: `rect.x + w / 2`, `rect.y + h / 2`.
- **Matériaux**: un maillage, une primitive par matériau, aux noms stables. La couche de traits se tire du nom (table de `planche/planche.mjs`, `MATERIAUX`):

| Matériau  | Emploi                                               | Couche de traits | Nature |
| --------- | ---------------------------------------------------- | ---------------- | ------ |
| `pierre`  | pierres posées une à une (soubassement, angles)      | `face`           |        |
| `moellon` | peau d'un mur en pierre apparente (appareil dessiné) | `slab`           |        |
| `crepi`   | peau d'un mur enduit                                 | `wall`           |        |
| `tuile`   | tuiles, faîtières, mitres, briques                   | `roof`           |        |
| `bois`    | une pièce de bois (linteau, chevron, poteau)         | `grain`          |        |
| `bardage` | peau d'un mur en planches                            | `wood`           |        |
| `volet`   | menuiserie peinte (volets, portes, devantures)       | `grain`          |        |
| `vitre`   | vitres (et l'eau du bassin)                          | `plain`          | vitre  |
| `metal`   | fer, zinc, laiton                                    | `plain`          |        |

- **Couleur**: `COLOR_0` (linéaire, comme le veut glTF) porte la teinte de chaque pièce; les matériaux n'ont pas de couleur propre. La passer en valeurs d'écran pour la matière encrée.
- **UV**: `TEXCOORD_0` en mètres divisés par 4 (un carreau de traits = 4 m), u le long du fil du bois et des rangs de tuiles: aucun quart de tour à faire.
- **Morceaux**: chaque pierre, tuile, planche est un morceau d'un seul tenant; `connectedParts` (sommets communs à 1 mm) les retrouve. La peau d'un mur est un seul morceau; la vitre est 4 mm derrière le tableau pour rester à part.
- **Faces absentes**: les dessous et les faces noyées dans le mur ne sont pas faits (la caméra plonge de 35 à 50 degrés). Le matériau de profondeur des ombres doit rester en double face, comme dans l'essai, sinon les débords de toit ne portent plus d'ombre.
- **Appels de dessin**: 5 à 8 primitives par bâtiment. À fusionner au chargement (même matière encrée, couche posée par sommet d'après le nom) pour un appel par bâtiment.

## Conventions des pièces

- Pas de la grille: 1 m. Pans de mur de 1, 2, 3 ou 4 m; niveau de 2,70 m au rez-de-chaussée, 2,30 m à l'étage.
- Repère d'une pièce de façade: origine au pied du mur, au milieu; x vers la droite vu de dehors; +z vers le dehors; le nu du mur est le plan z = 0.
- Cotes humaines: porte de 2,06 x 1,00 m sur une marche de 17 cm; appui de fenêtre à 1 m; marches de 17 cm pour 28 à 32 cm de giron.
- Raisons d'être: la souche de cheminée est sur le faîtage, près du pignon où est le foyer; la cheminée de four monte du sol le long d'un pignon; la gouttière court sous chaque égout et sa descente finit par un dauphin sur une pierre d'éclaboussure; un poteau de bois repose sur un dé de pierre; une porte charretière n'a pas de marche.
- Relief dans la géométrie: moellons du soubassement en saillie de 5 à 11 cm, chaînes d'angle de 7 cm, encadrements de 15 à 25 cm, vitres 14 cm en retrait, tuiles de 7,5 cm relevées rang par rang, débord de toit de 45 cm sur chevrons.
- Teintes: `teintes.json`, deux à quatre tons par matière (une pièce tire le sien), trois familles de crépi, deux de pierre, deux de bardage, deux de toit, douze peintures.

## Fichiers

| Fichier                          | Rôle                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `atelier.py`                     | formes (boîte, prisme, fût, peau), tremblé, UV, faces cachées omises; numpy seul         |
| `pieces.py`                      | murs percés, pierres, fenêtres, portes, devanture, enseignes, cheminées, détails propres |
| `toits.py`                       | pans de tuiles, faîtage, arêtiers, rives, gouttières, lucarne                            |
| `assembleur.py`                  | de la fiche à la géométrie: corps, façades, répartition des ouvertures, options          |
| `jeu_de_pieces.py`               | la liste des pièces sorties une à une (une ligne par pièce)                              |
| `construire.py`, `construire.sh` | écriture des GLB et du manifeste par Blender, puis contrôle                              |
| `verifier.py`                    | contrôle sans Blender (GLB, budgets, emprise et porte du plan, poids)                    |
| `compter.py`, `apercu.py`        | triangles d'une fiche sans Blender; aperçu Cycles                                        |
| `planche/`                       | page de contrôle (matière de la scène d'essai), captures, montage de la planche          |
