# Tests

Suite rapide (`pnpm test`): un fichier court par nouveauté, au plus 60 s de jeu simulées, moins de 5 s; un test de plus de 20 s échoue. `aides.ts`: contenu, partie neuve, données modifiables; les tests partent de la gare d'essai (`TEST_START`), le vrai départ du jeu (prologue) se lit par `gameDataFiles`.

- `donnees.test.ts`: validateurs. `gabarits.test.ts`: un exemplaire factice par gabarit paraît en jeu sans code.
- `pas.test.ts`: pas de simulation, unions, sauvegarde. `tailles.test.ts`: budgets des messages sur l'état au pire.
- `reseau.test.ts`: deux instances du SDK en mémoire.
- `points-de-quete.test.ts`: règle d'accès de tout lieu (aucun point de quête inaccessible depuis l'arrivée, `aides-acces.ts`), et la marche réelle des deux joueurs dans le wagon du prologue. `reprise-positions.test.ts`: quitter puis reprendre replace chacun où il était, intérieurs compris.
- `aides-prologue.ts`: jouer le prologue par les données (lits par la brique `sleep`, jamais par un identifiant de décor ni une position).
- `longues/`: `*.longue.ts`, à la demande (`pnpm test:longues`).
