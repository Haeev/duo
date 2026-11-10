# Tests

Suite rapide (`pnpm test`): un fichier court par nouveauté, au plus 60 s de jeu simulées, moins de 5 s; un test de plus de 20 s échoue. `aides.ts`: contenu, partie neuve, données modifiables; les tests partent de la gare d'essai (`TEST_START`), le vrai départ du jeu (prologue) se lit par `gameDataFiles`.

- `donnees.test.ts`: validateurs. `gabarits.test.ts`: un exemplaire factice par gabarit paraît en jeu sans code.
- `pas.test.ts`: pas de simulation, unions, sauvegarde. `tailles.test.ts`: budgets des messages sur l'état au pire.
- `reseau.test.ts`: deux instances du SDK en mémoire.
- `longues/`: `*.longue.ts`, à la demande (`pnpm test:longues`).
