// Serveur statique de la visionneuse de contrôle (les modules ES sont refusés en file://).
// Racine: games/deux-tabliers/ (assets/ et assets-src/). /three/ -> paquet three 0.187 (THREE_DIR, sinon celui de La Petite Ligne).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..', '..', '..', '..');
const depot = path.resolve(racine, '..', '..');
const threeDir = [process.env.THREE_DIR, path.join(depot, 'games', 'la-petite-ligne', 'node_modules', 'three')].filter(Boolean).find((d) => existsSync(path.join(d, 'package.json')));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg' };

export function demarrer(port = 0) {
  const serveur = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const base = url.startsWith('/three/') ? threeDir : racine;
      let fichier = url.startsWith('/three/') ? path.join(threeDir, url.slice(7)) : path.join(racine, url);
      if (!path.resolve(fichier).startsWith(base)) throw new Error('hors racine');
      if ((await stat(fichier)).isDirectory()) fichier = path.join(fichier, 'index.html');
      const data = await readFile(fichier);
      res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((ok) => serveur.listen(port, '127.0.0.1', () => ok(serveur)));
}
