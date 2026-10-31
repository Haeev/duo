import { createVitestConfig } from '@duo/config/vitest';

export default createVitestConfig({
  define: {
    DUO_TEST: 'true',
  },
});
