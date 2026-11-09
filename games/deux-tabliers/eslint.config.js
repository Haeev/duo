import { createEslintConfig } from '@duo/config/eslint';

// `outils/`: scripts de génération des données (Node et Python), hors du projet TypeScript.
export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  environment: 'browser',
  ignores: ['outils/**'],
});
