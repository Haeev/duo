import { createVitestConfig } from '@duo/config/vitest';

export default createVitestConfig({ test: { testTimeout: 120_000 } });
