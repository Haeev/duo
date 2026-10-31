import { defineConfig } from 'vite';
import { relaisVite } from './src/plateforme/relais-vite';

// base './': le jeu est servi depuis duo-game:// dans l'application, et depuis n'importe quel
// dossier en secours (ADR 0005).
export default defineConfig({
  base: './',
  plugins: [relaisVite()],
  server: { host: true },
  build: { target: 'es2024', assetsInlineLimit: 0 },
});
