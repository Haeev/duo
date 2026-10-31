import { createEslintConfig } from '@duo/config/eslint';

// ui-maquettes/: maquettes HTML du designer UX/UI, hors du code livré.
export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  environment: 'browser',
  ignores: ['ui-maquettes/**'],
});
