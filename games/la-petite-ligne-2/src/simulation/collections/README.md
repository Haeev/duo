# Collections, insectes, photo

Données: `commun/collections.json` (catégories), `commun/carnet/<id>.json` (entrées), `commun/insectes/<id>.json`, `commun/photos/<id>.json`, `lieux/<lieu>/nature.json` (zones de terrain). Schémas: `src/donnees/schemas/collections.ts`. État: `progress.album` (carnet commun, compact) et `place.insects`.

| Fichier       | Rôle                                                                                                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registre.ts` | `recordFind(sim, joueur, entrée, record?)`, `revealHint`, `collectionBook` (lecture du carnet par catégorie), `rarityMet`, `boostedWeight` (coup de pouce x4 d'une entrée jamais prise)                                         |
| `insectes.ts` | apparition par zone (heure, météo, saison, terrain), envol si on court, `swingNet`                                                                                                                                              |
| `photo.ts`    | `takePhoto`: le sujet valable le plus près de l'axe du cadre devient une carte postale                                                                                                                                          |
| `visee.ts`    | outil en main, cône devant le personnage                                                                                                                                                                                        |
| `index.ts`    | le système: `item_gained` inscrit l'entrée de l'objet, `calendar_started` inscrit l'air de l'événement pour les deux, insectes; intentions `net_swing`, `photo_take`, et `act` quand rien n'est visé, filet ou appareil en main |

Carnet: une entrée trouvée est un tuple `[premier, jour, minute, météo, saison, prises j0, prises j1, record?, joueur du record?]` (index dans `WEATHERS` et `SEASONS`). Chacun voit ce que l'autre a trouvé, avec son prénom.

## Brancher

- Pêche, fouilles, cueillette, tenues: donner l'objet (`item_gained`) suffit si l'entrée a la source `item`; sinon appeler `recordFind` (source `manual`), avec la mesure pour un record.
- Recettes: source `recipe`; l'entrée s'inscrit à la première réussite en cuisine de chaque joueur (`dish_cooked`) ou par l'effet `give_recipe` (`reward_given`), jamais par un plat acheté.
- Interface: `collection_found` (`first`: présentation complète, sinon rapide), `collection_record`, `collection_completed` (trophée); `collectionBook(world, content, lieu?)` pour l'onglet.
- Rendu: `place.insects.list` (point de pose; vol autour selon `wander`), `insect_fled` (direction, vitesse), `net_swung`, `photo_taken`.

## Ajouter

`pnpm nouveau entree-de-collection <id>`, `pnpm nouveau insecte <id>`, `pnpm nouveau sujet-photo <id>`. Aucun changement de code.
