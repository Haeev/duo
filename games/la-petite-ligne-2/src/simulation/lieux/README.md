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
| `reglages.ts` | franchissement d'un seuil, recul à l'arrivée, réarmement, part d'une zone qui la dit ouverte                                                                                                          |

## Règles

- **Verrou**: fermé, ses rectangles bloquent comme un mur, et son objet visible (`object`, un meuble à brique `passage`) aussi s'il est solide. La touche d'action sur l'objet refuse avec `not-yet`; l'interface montre `passageSays(look, objet)`, la phrase `says` du verrou (« pas encore »), ou un texte générique. Ouvert, l'objet n'est plus une cible (`inert` de la brique) et ne bloque plus; `lock_opened` part chez les deux joueurs (animation de l'obstacle, son).
- **Zone**: ouverte quand on rejoint à pied, depuis le point d'arrivée du lieu, au moins `zoneOpenShare` de ses cases libres. Le remplissage n'est refait que quand un verrou change.
- **Porte**: son **seuil** se déduit de la carte (`donnees/seuils.ts`): porte de façade (la case derrière elle est un mur), le bord de sa case contre ce mur; porte de cloison (sa case est un mur), la face de cette case du côté où l'on arrive; porte au sol (escalier, trappe, aucun mur), le milieu de sa case. `walk` (défaut): on la passe en **franchissant le seuil**, le corps contre le mur dans la largeur du passage (`width`, 1 m par défaut) et en avançant vers lui (`sillReach`, `sillHeadingDeg`), jamais un mètre avant; toute porte se passe aussi par la touche d'action sur son objet visible, et `act` ne laisse que cela. Une porte sans `object` reçoit d'office au chargement le meuble `DOORS.prop` (`commun/meubles/porte.json`, brique `passage`) posé sur son seuil: elle est donc visible, visée et nommée (« Entrer », « Sortir ») sans rien écrire dans la carte. On arrive devant l'autre porte de la paire, à `arriveOffset` de son seuil, tourné vers son `facing`; la direction encore tenue ne fait pas repasser (`rearmDistance`). `opens` (conditions) et `shop` (heures du commerce) la ferment dans ce sens seulement: on ressort toujours. Refus: `door-locked` ou `shop-closed`, un seul par approche, avec la phrase `says`. Événement `door_passed` (joueur, porte, arrivée, intérieur) pour le fondu de sa machine et le son.
- **Deux joueurs séparés**: chacun a sa position, donc son intérieur ou le dehors; le rendu de chaque machine suit son joueur (`playerInterior`).

## Ajouter un verrou, une porte, un intérieur

Rien ici. Verrou: une entrée `locks` dans `carte.json` (produite par `outils/plan-vers-lieu.ts`; `object` et `says` à poser), plus le meuble de l'obstacle (gabarit `meuble`, brique `{ "brick": "passage" }`). Porte et intérieur: gabarit `interieur` (`pnpm nouveau interieur <id> <lieu>`), et la porte du dehors dans `carte.json`. Exemplaire factice: `tests/lieux-portes.test.ts`.
