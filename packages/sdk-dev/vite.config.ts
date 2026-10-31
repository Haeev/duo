import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Pages du faux hôte (navigateur): accueil du réseau local et deux vues locales.
export default defineConfig({
  root: resolve(import.meta.dirname, 'src/coque'),
  base: './',
  server: { port: 5180, host: true },
  build: {
    outDir: resolve(import.meta.dirname, 'dist/coque'),
    emptyOutDir: true,
    target: 'es2024',
    rolldownOptions: {
      input: {
        accueil: resolve(import.meta.dirname, 'src/coque/index.html'),
        'deux-vues': resolve(import.meta.dirname, 'src/coque/deux-vues.html'),
      },
    },
  },
});
