# Habitants

Un habitant vit si sa fiche a un bloc `life` (schéma `src/donnees/schemas/vie-habitant.ts`, gabarit commenté `donnees/_gabarits/habitant.jsonc`). Sans `life`, il reste planté à `stands`. Le moteur ne nomme aucun habitant.

| Fichier       | Rôle                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.ts`    | le système: présence, planning, marche, places assises, regard, bonjour, réactions; intention `give_gift`                                       |
| `planning.ts` | ligne en cours (heure, jour de la semaine, météo, saison, conditions d'histoire), but exact (point, place assise, devant ou derrière un meuble) |
| `chemins.ts`  | trajet sur le graphe des chemins de la carte (`map.graph`: nœuds et arêtes du plan) ou, à défaut, A* sur la grille; portes franchissables       |
| `presence.ts` | regard, premier bonjour du jour, réactions déclarées, cadeaux                                                                                   |
| `lecture.ts`  | lecture pure pour le rendu, l'interface et les commerces: `villagerView`, `isShopOpen`, `hasSomethingFor`                                       |
| `valider.ts`  | contrôle au chargement (branché dans `donnees/valider.ts`)                                                                                      |
| `reglages.ts` | valeurs de jeu (marche 1,4 m/s, rayons, fréquences, points des cadeaux)                                                                         |

## Règles

- **Planning**: la première ligne qui convient l'emporte. Les lignes sans filtre couvrent les 24 heures (contrôlé), et à 3 h il est chez lui (`home`). Le jour 1 est un lundi; une saison dure `clock.seasonDays` jours, en partant du printemps.
- **Jamais dans le vide**: une ligne se tient à un point de la carte, sur une place d'un meuble à brique `sit` (même placement que la brique), ou devant ou derrière un meuble. Un point déjà tenu par un autre habitant: il prend une place libre de la couronne autour.
- **Commerces**: une ligne `shop` ouvre le commerce quand le commerçant est arrivé à son poste (`isShopOpen`). Un commerçant sans `life` suit les heures du commerce.
- **Mémoire** (faits datés, lisibles par la condition `remembered`): `habitants.<id>.salut.j<n>` (bonjour du jour), `habitants.<id>.cadeau.j<n>` (dernier cadeau, valeur: l'objet), `habitants.<id>.cadeaux.j<n>` (compteur), `habitants.<id>.adore.j<n>`, `habitants.<id>.arrive`, `habitants.<id>.parti`. L'amitié passe par `dialogues/amitie.ts` (`addBond`).
- **Train**: `arrives` faux, il attend hors de la carte (`offstage`, ni visible ni visable); vrai, il descend au point d'arrivée de la gare et marche jusqu'à son poste. `leaves`: il marche jusqu'au quai et disparaît.
- **Économe**: à plus de `nearRadius` des deux joueurs, un pas sur `farEveryTicks`; le planning se relit tous les `planEveryTicks`. Chemins et minuteries ne sont pas dans l'état: à la reprise d'une sauvegarde ou au retour dans le lieu, chacun est posé à son poste du moment.

## Pour le rendu (lecture seule, chez l'hôte et l'invité)

`villagerView(look, id)`: `visible`, `pose` (`stand`, `walk`, `sit`), `activity`, `gesture` (clip en boucle à son poste), `emote` (onomatopée en cours), `gaze` (joueur 0 ou 1, ou identifiant d'un habitant: la tête suit). Position, cap et vitesse: `body`, canal rapide. Événements: `villager_greeted`, `villager_reacted`, `villager_gift`, `villager_door`, `villager_arrived`, `villager_left`.
