import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

// Planche de décision: sert l'ancien personnages.glb (0.12) à la place du nouveau quand LPL_ANCIEN est posé.
const OLD = process.env.LPL_ANCIEN;

function oldCharacters(): Plugin {
  return {
    name: 'lpl-anciens-personnages',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Seule la demande du fichier lui-même (pas le module `?url` qui en donne l'adresse).
        const url = req.url ?? '';
        if (OLD !== undefined && OLD !== '' && url.endsWith('/assets/modeles/personnages.glb')) {
          res.setHeader('Content-Type', 'model/gltf-binary');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readFileSync(OLD));
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  cacheDir: process.env.LPL_CACHE ?? 'node_modules/.vite',
  plugins: [oldCharacters()],
  server: { port: Number(process.env.LPL_PORT ?? 5948), host: '127.0.0.1', strictPort: true, hmr: false, watch: null },
});
