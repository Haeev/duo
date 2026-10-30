import { createEslintConfig } from '@duo/config/eslint';

export default createEslintConfig({ tsconfigRootDir: import.meta.dirname, environment: 'both' });
