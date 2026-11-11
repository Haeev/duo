# Tests

Suite rapide (`pnpm test`): un fichier court par nouveauté, au plus 60 s de jeu simulées, moins de 5 s; un test de plus de 20 s échoue. `aides.ts`: contenu, partie neuve, données modifiables; les tests partent de la gare d'essai (`TEST_START`), le vrai départ du jeu (prologue) se lit par `gameDataFiles`.

- `donnees.test.ts`: validateurs. `gabarits.test.ts`: un exemplaire factice par gabarit paraît en jeu sans code.
- `pas.test.ts`: pas de simulation, unions, sauvegarde. `tailles.test.ts`: budgets des messages sur l'état au pire.
- `reseau.test.ts`: deux instances du SDK en mémoire.
- `points-de-quete.test.ts`: règle d'accès de tout lieu (aucun point de quête inaccessible depuis l'arrivée, `aides-acces.ts`), et la marche réelle des deux joueurs dans le wagon du prologue. `reprise-positions.test.ts`: quitter puis reprendre replace chacun où il était, intérieurs compris.
- `aides-prologue.ts`: jouer le prologue par les données (lits par la brique `sleep`, jamais par un identifiant de décor ni une position).
- `aides-visite.ts`: aller parler à un habitant ou ouvrir un comptoir comme un joueur (portes et leurs refus, place libre rejointe à pied, visée de la touche d'action); les tests d'histoire d'Aubrune passent par là. `parler-aux-commercants.test.ts`: chaque commerçant à son poste se laisse aborder.
- `photo-prologue.test.ts`: la photo du prologue (silhouettes, réplique qui ouvre l'éditeur, révélation par `reveal_look`, rechargement avant et après, migration des parties de la version 1, dialogue factice du gabarit). `e2e/photo.spec.ts` (P19c): le même moment joué à deux dans le navigateur, avec ses captures en 1366 x 768.
- `longues/`: `*.longue.ts`, à la demande (`pnpm test:longues`).
