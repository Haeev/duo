# État du jeu (lot L0)

L'état est découpé en tranches (ADR 0019): `commun.ts`, `joueur.ts`, `progression.ts`, `lieu.ts`, réunies dans `monde.ts`. `briques.ts`: l'état des briques d'un meuble. Chaque tranche a son schéma: il valide la sauvegarde à la lecture et les messages chez l'invité.

Champs rapides (`body`, `needs`, `minutes`): ils partent à chaque pas sur le canal rapide et ne figurent pas dans les tranches lentes. Tout le reste: appeler `touch(tranche)` après l'avoir modifié.

Un lot a besoin d'un champ: il le demande au manager, qui le fait ajouter ici (schéma, création dans `simulation/noyau/monde.ts`, borne de taille dans `tests/tailles.test.ts`).
