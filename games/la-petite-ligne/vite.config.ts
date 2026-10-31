import { defineConfig } from 'vite';

// base './': le jeu est servi depuis un sous-dossier (duo-game:// dans Duo, /jeu/ dans le faux hôte).
export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: { target: 'es2024', assetsInlineLimit: 0 },
});
