// Petit serveur statique de la scène d'essai (les modules ES sont refusés en file://).
// Racine: docs/jeux/cosy-cafe/essai-style/. Trois préfixes de plus:
//   /three/    -> le paquet three 0.187 (THREE_DIR, sinon games/la-petite-ligne/node_modules/three)
//   /polices/  -> les polices de la bible (bible/node_modules/@fontsource-variable), embarquées, sans réseau
// Usage: node serveur.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = path.dirname(fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
const depot = path.resolve(racine, '..', '..', '..', '..');
const candidats = [process.env.THREE_DIR, path.join(depot, 'games', 'la-petite-ligne', 'node_modules', 'three'), path.join(depot, 'node_modules', 'three')].filter(Boolean);
const threeDir = candidats.find((d) => existsSync(path.join(d, 'package.json')));
const polices = path.resolve(racine, '..', 'bible', 'node_modules', '@fontsource-variable');
const polices2 = path.resolve(racine, '..', 'bible', 'node_modules', '@fontsource');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.woff2': 'font/woff2' };

export function demarrer(port = 0) {
  if (!threeDir) throw new Error('three introuvable: installer les dépendances du jeu ou donner THREE_DIR');
  const serveur = createServer(async (req, res) => {
    try {
      const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let fichier;
      if (url.startsWith('/three/')) fichier = path.join(threeDir, url.slice(7));
      else if (url.startsWith('/polices/')) fichier = path.join(polices, url.slice(9));
      else if (url.startsWith('/polices2/')) fichier = path.join(polices2, url.slice(10));
      else fichier = path.join(racine, url);
      const base = url.startsWith('/three/') ? threeDir : url.startsWith('/polices/') ? polices : url.startsWith('/polices2/') ? polices2 : racine;
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
  return new Promise((resolve) => serveur.listen(port, '127.0.0.1', () => resolve(serveur)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await demarrer(Number(process.argv[2] || 8765));
  process.stdout.write(`http://127.0.0.1:${s.address().port}/scene/?v=A&vue=1\n`);
}
