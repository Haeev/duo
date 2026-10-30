# @duo/config

Configurations partagées du dépôt (ADR 0002): TypeScript strict, ESLint typé, Vitest, Prettier.

## Ajouter un paquet

Un dossier sous `apps/`, `packages/`, `games/` ou `games/_essais/` avec un `package.json` est pris en compte par `pnpm install`: aucun fichier racine à modifier.

1. `package.json`: `"private": true`, `"type": "module"`, et les scripts communs qui s'appliquent au paquet (la racine les lance tous par `pnpm --recursive --if-present`):

   ```json
   "scripts": {
     "dev": "...",
     "build": "...",
     "lint": "eslint .",
     "typecheck": "tsc --noEmit",
     "test": "vitest run"
   },
   "devDependencies": {
     "@duo/config": "workspace:*",
     "eslint": "catalog:",
     "typescript": "catalog:",
     "vite": "catalog:",
     "vitest": "catalog:"
   }
   ```

   Toute dépendance est déclarée par le paquet qui l'importe (pnpm refuse les dépendances fantômes). Versions: `catalog:` pour celles de l'ADR 0001 (liste dans `pnpm-workspace.yaml`), sinon une version exacte, sans `^` ni `~`. Un paquet interne: `"@duo/sdk": "workspace:*"`.

2. `tsconfig.json`: étendre la variante qui correspond à l'endroit où le code s'exécute, et fixer `include`.

   ```json
   {
     "extends": "@duo/config/tsconfig.browser.json",
     "include": ["src", "tests", "*.ts"]
   }
   ```

   - `tsconfig.node.json`: Node (outils, processus principal d'Electron, simulations testées dans Node), avec les types de `@types/node` (à déclarer dans le paquet).
   - `tsconfig.browser.json`: page web (lanceur, jeux, preloads), avec le DOM.
   - `tsconfig.base.json`: ni l'un ni l'autre (code pur, comme `@duo/protocol`).

3. `eslint.config.js`:

   ```js
   import { createEslintConfig } from '@duo/config/eslint';

   export default createEslintConfig({ tsconfigRootDir: import.meta.dirname, environment: 'browser' });
   ```

   `environment` vaut `node` (par défaut), `browser` ou `both`. Les fichiers `*.config.*` sont analysés sans les règles typées; les dossiers `dist/`, `out/`, `build/`, `coverage/` et `assets-src/` sont ignorés.

4. `vitest.config.ts` (si le paquet a des tests):

   ```ts
   import { createVitestConfig } from '@duo/config/vitest';

   export default createVitestConfig();
   ```

   Tests unitaires: `*.test.ts`. Tests Playwright: `*.spec.ts` dans `tests/e2e/`, que Vitest ignore. Un paquet dont le script `test` ne trouve aucun test échoue: ne déclarer `test` qu'avec au moins un test.

## Règles appliquées

- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`; cible et bibliothèque ES2024 (ce que Node 22 et le Chromium d'Electron 45 exécutent tous deux).
- ESLint: `strictTypeChecked` et `stylisticTypeChecked` de typescript-eslint, plus `explicit-module-boundary-types`, `switch-exhaustiveness-check`, `consistent-type-imports`, `no-console` et `no-debugger` (console permise dans les tests). Une dérogation donne sa raison: `// eslint-disable-next-line règle -- raison`, sinon erreur.
- `pnpm verifier` (racine): tirets cadratin et demi-cadratin partout; affichage de débogage, point d'arrêt et marqueur de tâche sans `(#ticket)` dans le code, hors `design/`, `docs/`, `assets-src/` et Python; règles de dépendance entre jeux, application et `@duo/protocol`.
- Prettier: `pnpm format` (code et configuration; documents Markdown, `docs/` et `design/` exclus).
