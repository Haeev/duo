// Longues parties de robots (démo entière, 42 jours, endurance): hors de `pnpm test` depuis le
// 2026-11-04, à la demande du client. Chaque nouveauté se teste par une simulation courte et
// ciblée; les vraies parties longues se jouent en séance. À lancer à la demande:
//   pnpm test:longues
import { defineConfig } from 'vitest/config';
import { LONG_TESTS } from './vitest.longues';

export default defineConfig({
  test: {
    include: [...LONG_TESTS],
    environment: 'node',
    retry: 0,
    testTimeout: 900_000,
    hookTimeout: 900_000,
  },
});
