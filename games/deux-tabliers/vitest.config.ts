import { createVitestConfig } from '@duo/config/vitest';

// Tests courts seulement (règle du 2026-11-04): aucune longue partie de robots ici.
export default createVitestConfig({ test: { testTimeout: 60_000 } });
