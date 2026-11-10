# Lieux: zones, verrous d'histoire, portes, intérieurs (mission M2, ADR 0022)

Tout se lit dans la carte (`src/donnees/schemas/lieu.ts`) et la progression: aucun état nouveau, rien de plus sur le réseau ni dans la sauvegarde. Le moteur ne nomme aucun lieu.

| Fichier       | Rôle                                                                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verrous.ts`  | état des verrous (`isLockOpen`, `closedLocks`), déduit de leurs conditions `opens`; cases des verrous fermés, ajoutées aux obstacles par `noyau/obstacles.ts` (couche refaite quand un verrou change) |
| `zones.ts`    | zones ouvertes ou fermées (`zoneViews`, `isZoneOpen`, `zoneAt`), masque des cases atteignables (`reachMask`) pour hachurer la carte du carnet                                                         |
| `portes.ts`   | intérieur de chaque joueur (`playerInterior`, `interiorAt`), porte fermée (`doorRefusal`), passage (`passDoor`)                                                                                       |
| `passage.ts`  | brique `passage`: l'objet visible d'un verrou ou d'une porte à la touche d'action; `passageSays`                                                                                                      |
| `chemins.ts`  | `edgePassable`, `closedLockSet`: ce que reçoivent les trajets des habitants (`habitants/chemins.ts`)                                                                                                  |
| `index.ts`    | le système: événements `lock_opened` et `lock_closed`, portes passées en marchant                                                                                                                     |
| `valider.ts`  | contrôle au chargement: objets et briques des passages, commerce d'une porte                                                                                                                          |
| `reglages.ts` | portée d'une porte, recul à l'arrivée, part d'une zone qui la dit ouverte                                                                                                                             |

## Règles

- **Verrou**: fermé, ses rectangles bloquent comme un mur, et son objet visible (`object`, un meuble à brique `passage`) aussi s'il est solide. La touche d'action sur l'objet refuse avec `not-yet`; l'interface montre `passageSays(look, objet)`, la phrase `says` du verrou (« pas encore »), ou un texte générique. Ouvert, l'objet n'est plus une cible (`inert` de la brique) et ne bloque plus; `lock_opened` part chez les deux joueurs (animation de l'obstacle, son).
- **Zone**: ouverte quand on rejoint à pied, depuis le point d'arrivée du lieu, au moins `zoneOpenShare` de ses cases libres. Le remplissage n'est refait que quand un verrou change.
- **Porte**: `walk` (défaut), on la passe en avançant vers sa case; `act`, par la touche d'action sur son objet. On arrive devant l'autre porte de la paire, tourné vers son `facing`, le dos à la porte: on ne repart pas sans le vouloir. `opens` (conditions) et `shop` (heures du commerce) la ferment dans ce sens seulement: on ressort toujours. Refus: `door-locked` ou `shop-closed`, un seul par approche, avec la phrase `says`. Événement `door_passed` (joueur, porte, arrivée, intérieur) pour le fondu de sa machine et le son.
- **Deux joueurs séparés**: chacun a sa position, donc son intérieur ou le dehors; le rendu de chaque machine suit son joueur (`playerInterior`).

## Ajouter un verrou, une porte, un intérieur

Rien ici. Verrou: une entrée `locks` dans `carte.json` (produite par `outils/plan-vers-lieu.ts`; `object` et `says` à poser), plus le meuble de l'obstacle (gabarit `meuble`, brique `{ "brick": "passage" }`). Porte et intérieur: gabarit `interieur` (`pnpm nouveau interieur <id> <lieu>`), et la porte du dehors dans `carte.json`. Exemplaire factice: `tests/lieux-portes.test.ts`.
