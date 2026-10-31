import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

const root = import.meta.dirname;

// Version de test (ADR 0013, point 1): `electron-vite build --mode test` compile
// les crochets de test; sinon ils disparaissent par élimination du code mort.
export default defineConfig(({ mode }) => ({
  main: {
    define: {
      DUO_TEST: JSON.stringify(mode === 'test'),
    },
    build: {
      // Principal empaqueté avec ses dépendances: aucun node_modules dans l'archive.
      externalizeDeps: false,
      rolldownOptions: {
        input: { index: resolve(root, 'src/main/index.ts') },
      },
    },
  },
  preload: {
    build: {
      // Un preload en bac à sable ne charge ni module ES ni fichier voisin:
      // chaque preload est un seul fichier CommonJS.
      externalizeDeps: false,
      isolatedEntries: true,
      rolldownOptions: {
        input: {
          platform: resolve(root, 'src/preload/platform.ts'),
          game: resolve(root, 'src/preload/game.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    oxc: {
      jsx: { runtime: 'automatic', importSource: 'preact' },
    },
    build: {
      outDir: resolve(root, 'out/renderer'),
      rolldownOptions: {
        input: resolve(root, 'src/renderer/index.html'),
      },
    },
  },
}));
