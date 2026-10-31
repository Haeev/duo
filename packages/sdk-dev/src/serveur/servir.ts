// Serveur de démo sur le réseau local: sert les pages du faux hôte et le jeu construit, relaie les
// messages entre les deux navigateurs par WebSocket, garde sauvegardes et historique sur ce disque.
//
//   pnpm --filter @duo/sdk-dev servir <jeu> [--port 8080] [--donnees <dossier>] [--construire]
//
// <jeu>: identifiant (games/<id> ou games/_essais/<id>), dossier du paquet du jeu, ou dossier construit.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, networkInterfaces } from 'node:os';
import { extname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import * as v from 'valibot';
import { WebSocketServer, type WebSocket } from 'ws';
import { createDiskStore } from './disque.ts';
import { createRelay, MAX_RELAY_FRAME_BYTES } from './relais.ts';
import { HistoryEntrySchema, MAX_SAVE_BODY_BYTES, StoredSaveSchema } from './schemas.ts';

const PACKAGE_DIR = resolve(import.meta.dirname, '../..');
const REPO_ROOT = resolve(PACKAGE_DIR, '../..');
const SHELL_DIR = join(PACKAGE_DIR, 'dist', 'coque');

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.wasm': 'application/wasm',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

interface Options {
  readonly game: string;
  readonly port: number;
  readonly dataDir: string | null;
  readonly build: boolean;
}

function parseArgs(argv: readonly string[]): Options {
  let game: string | null = null;
  let port = 8080;
  let dataDir: string | null = null;
  let build = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port') port = Number(argv[++i]);
    else if (arg === '--donnees') dataDir = argv[++i] ?? null;
    else if (arg === '--construire') build = true;
    else if (arg !== undefined && !arg.startsWith('--')) game = arg;
  }
  if (game === null) {
    throw new Error(
      'Indique le jeu: pnpm --filter @duo/sdk-dev servir <jeu> (par exemple la-petite-ligne)',
    );
  }
  if (!Number.isInteger(port) || port < 1 || port > 65_535)
    throw new Error(`Port invalide: ${port}`);
  return { game, port, dataDir, build };
}

/** Dossier du paquet du jeu et dossier construit qu'on sert. */
function locateGame(game: string): { packageDir: string; distDir: string } {
  const base = process.env.INIT_CWD ?? process.cwd();
  const candidates = isAbsolute(game)
    ? [game]
    : [
        resolve(base, game),
        join(REPO_ROOT, 'games', game),
        join(REPO_ROOT, 'games', '_essais', game),
      ];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isDirectory()) continue;
    if (existsSync(join(candidate, 'package.json')))
      return { packageDir: candidate, distDir: join(candidate, 'dist') };
    if (existsSync(join(candidate, 'index.html')))
      return { packageDir: resolve(candidate, '..'), distDir: candidate };
  }
  throw new Error(`Jeu introuvable: ${game} (essayé: ${candidates.join(', ')})`);
}

/** Chemin d'un fichier sous `root`, ou null s'il en sortirait. */
function safePath(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const path = normalize(join(root, decoded));
  return path === root || path.startsWith(root + sep) ? path : null;
}

function send(
  res: ServerResponse,
  status: number,
  body: string | Buffer,
  type = 'text/plain; charset=utf-8',
): void {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  send(res, status, JSON.stringify(value), MIME['.json']);
}

async function sendFile(res: ServerResponse, path: string | null): Promise<boolean> {
  if (path === null) return false;
  let file = path;
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) return false;
  send(
    res,
    200,
    await readFile(file),
    MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
  );
  return true;
}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('trop gros'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolveBody(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', reject);
  });
}

function lanAddresses(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) out.push(item.address);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { packageDir, distDir } = locateGame(options.game);

  if (options.build) {
    const result = spawnSync('pnpm', ['run', 'build'], {
      cwd: packageDir,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0) throw new Error('La construction du jeu a échoué.');
  }
  if (!existsSync(join(distDir, 'index.html'))) {
    throw new Error(
      `Jeu non construit: ${join(distDir, 'index.html')} absent. Lance « pnpm --filter <jeu> build » ou ajoute --construire.`,
    );
  }
  if (!existsSync(join(SHELL_DIR, 'index.html'))) {
    throw new Error(
      `Pages du faux hôte absentes (${SHELL_DIR}): lance « pnpm --filter @duo/sdk-dev build ».`,
    );
  }
  const manifestPath = [join(distDir, 'duo-game.json'), join(packageDir, 'duo-game.json')].find(
    (p) => existsSync(p),
  );
  if (manifestPath === undefined)
    throw new Error(`duo-game.json introuvable dans ${distDir} ni ${packageDir}`);
  const manifest: unknown = JSON.parse(await readFile(manifestPath, 'utf8'));
  const gameId =
    typeof manifest === 'object' &&
    manifest !== null &&
    'id' in manifest &&
    typeof manifest.id === 'string'
      ? manifest.id
      : 'jeu';
  const dataDir = options.dataDir ?? join(homedir(), 'Duo-demo', gameId);
  const store = createDiskStore(dataDir);
  const relay = createRelay();

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      try {
        if (path === '/api/serveur' && req.method === 'GET') {
          sendJson(res, 200, {
            addresses: lanAddresses(),
            port: options.port,
            hostPresent: relay.hostPresent(),
          });
          return;
        }
        if (path === '/api/sauvegardes' && req.method === 'GET') {
          sendJson(res, 200, await store.list());
          return;
        }
        const slotMatch = /^\/api\/sauvegardes\/(\d{1,2})$/.exec(path);
        if (slotMatch !== null) {
          const slot = Number(slotMatch[1]);
          if (req.method === 'GET') {
            const save = await store.read(slot);
            if (save === null) send(res, 404, 'aucune sauvegarde');
            else sendJson(res, 200, save);
            return;
          }
          if (req.method === 'PUT') {
            const parsed = v.safeParse(
              StoredSaveSchema,
              JSON.parse(await readBody(req, MAX_SAVE_BODY_BYTES)),
            );
            if (!parsed.success || parsed.output.slot !== slot) {
              send(res, 400, 'sauvegarde invalide');
              return;
            }
            await store.write(parsed.output);
            send(res, 204, '');
            return;
          }
        }
        if (path === '/api/historique' && req.method === 'POST') {
          const parsed = v.safeParse(
            HistoryEntrySchema,
            JSON.parse(await readBody(req, 64 * 1024)),
          );
          if (!parsed.success) {
            send(res, 400, 'entrée invalide');
            return;
          }
          await store.appendHistory(parsed.output);
          send(res, 204, '');
          return;
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          send(res, 405, 'méthode refusée');
          return;
        }
        if (path === '/jeu') {
          res.writeHead(302, { location: '/jeu/' });
          res.end();
          return;
        }
        if (path.startsWith('/jeu/')) {
          const relative = path.slice('/jeu/'.length);
          if (relative === 'duo-game.json') {
            send(res, 200, await readFile(manifestPath), MIME['.json']);
            return;
          }
          if (await sendFile(res, safePath(distDir, relative))) return;
          send(res, 404, 'introuvable');
          return;
        }
        if (await sendFile(res, safePath(SHELL_DIR, path === '/' ? 'index.html' : path.slice(1))))
          return;
        send(res, 404, 'introuvable');
      } catch (error) {
        process.stderr.write(`Erreur sur ${req.method ?? ''} ${path}: ${String(error)}\n`);
        if (!res.headersSent) send(res, 500, 'erreur du serveur');
      }
    })();
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_RELAY_FRAME_BYTES });
  const alive = new WeakMap<WebSocket, boolean>();
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const role = url.searchParams.get('role');
    if (url.pathname !== '/relais' || (role !== 'host' && role !== 'guest')) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const joined = relay.join(role, {
        send: (text) => {
          if (ws.readyState === ws.OPEN) ws.send(text);
        },
        close: (code, reason) => {
          ws.close(code, reason);
        },
      });
      if (!joined.ok) {
        ws.send(JSON.stringify({ t: 'refused', message: joined.message }));
        ws.close(4000, 'refusé');
        return;
      }
      alive.set(ws, true);
      ws.on('pong', () => alive.set(ws, true));
      ws.on('message', (data, isBinary) => {
        if (isBinary) return;
        const text = Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.isBuffer(data)
            ? data.toString('utf8')
            : Buffer.from(data).toString('utf8');
        joined.member.onText(text);
      });
      ws.on('close', () => {
        joined.member.onClose();
      });
      ws.on('error', () => {
        joined.member.onClose();
      });
      process.stdout.write(
        `${role === 'host' ? 'Hôte' : 'Invité'} connecté (${req.socket.remoteAddress ?? '?'}).\n`,
      );
    });
  });
  // Une connexion Wi-Fi peut mourir sans fermeture propre: ping toutes les 5 s, coupure sans réponse.
  const pinger = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, 5000);
  server.on('close', () => {
    clearInterval(pinger);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    process.stderr.write(
      error.code === 'EADDRINUSE'
        ? `Le port ${options.port} est pris: relance avec --port 8081.\n`
        : `${String(error)}\n`,
    );
    process.exit(1);
  });
  server.listen(options.port, '0.0.0.0', () => {
    const lines = [
      '',
      `Duo, faux hôte: ${gameId} servi depuis ${distDir}`,
      `Sauvegardes et historique: ${dataDir}`,
      '',
      'Sur cet ordinateur, ouvre:',
      `  http://localhost:${options.port}/`,
      'Sur l’autre ordinateur du même réseau, ouvre:',
      ...lanAddresses().map((address) => `  http://${address}:${options.port}/`),
      '',
      `Deux vues sur un seul écran (essais): http://localhost:${options.port}/deux-vues.html`,
      'Ctrl+C pour arrêter.',
      '',
    ];
    process.stdout.write(lines.join('\n'));
  });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
