import { createEslintConfig } from './eslint.js';

export default createEslintConfig({ tsconfigRootDir: import.meta.dirname });
