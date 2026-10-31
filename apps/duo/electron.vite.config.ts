import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';

// Version de test (ADR 0013, point 1): DUO_TEST=1 au moment de la construction
// compile les crochets de test; sinon ils disparaissent par élimination du code mort.
const testBuild = process.env.DUO_TEST === '1';
const root = import.meta.dirname;

export default defineConfig({
  main: {
    define: {
      DUO_TEST: JSON.stringify(testBuild),
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
});
