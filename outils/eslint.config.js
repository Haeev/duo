import { createEslintConfig } from '@duo/config/eslint';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  // Page web autonome (scripts classiques de navigateur, hors du tsconfig): contrôlée par son banc d'essai.
  ignores: ['tableau-de-bord/**'],
});
