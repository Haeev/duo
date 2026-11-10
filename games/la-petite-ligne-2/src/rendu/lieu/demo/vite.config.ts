import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Page de démonstration des grands lieux: elle fabrique Aubrune depuis le plan dans la page, avec
 * l'outil `outils/plan-vers-lieu.ts`. Ses imports Node (lecture et écriture de fichiers, jamais
 * appelées ici) sont remplacés par des fonctions vides.
 *   pnpm exec vite --config src/rendu/lieu/demo/vite.config.ts
 * puis http://localhost:5174/src/rendu/lieu/demo/index.html
 */
const stub = fileURLToPath(new URL('./node-vide.ts', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('../../../..', import.meta.url)),
  base: './',
  server: { port: 5174 },
  resolve: { alias: { 'node:fs': stub, 'node:url': stub } },
  define: { 'process.argv': '[]' },
});
