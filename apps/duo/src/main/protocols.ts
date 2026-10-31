// Protocoles (ADR 0003, point 5; ADR 0004): `duo://app/` sert l'interface du
// lanceur, `duo-game://<id>/` sert un jeu. Aucun `file://`. Chaque réponse porte
// sa CSP; les chemins sont contrôlés pour ne jamais sortir du dossier servi.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { protocol, type Session } from 'electron';

export const APP_SCHEME = 'duo';
export const GAME_SCHEME = 'duo-game';
export const APP_ORIGIN = 'duo://app';

export const LAUNCHER_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: duo-game:; " +
  "font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

export const GAME_CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; " +
  "img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

export function mimeType(file: string): string {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Résout le chemin d'une adresse dans `root`. `null` si le chemin sort du
 * dossier, contient un octet nul, une barre oblique inverse ou un encodage invalide.
 */
export function resolveInside(root: string, urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const segments = decoded.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.some((segment) => segment === '..' || /^[A-Za-z]:$/.test(segment))) return null;
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, ...segments);
  if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) return null;
  return target;
}

export interface ByteRange { readonly start: number; readonly end: number }

/** Lit un en-tête `Range: bytes=...` (une seule plage). `null`: pas de plage; `'invalid'`: 416. */
export function parseRange(header: string | null, size: number): ByteRange | null | 'invalid' {
  if (header === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match === null) return 'invalid';
  const [, startText = '', endText = ''] = match;
  if (startText === '' && endText === '') return 'invalid';
  let start: number;
  let end: number;
  if (startText === '') {
    const suffix = Number(endText);
    if (suffix === 0) return 'invalid';
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(startText);
    end = endText === '' ? size - 1 : Math.min(Number(endText), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

function textResponse(status: number, text: string, csp: string): Response {
  return new Response(text, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'content-security-policy': csp },
  });
}

/** Sert un fichier, avec les requêtes partielles (lecture en flux des musiques). */
export async function serveFile(file: string, request: Request, csp: string): Promise<Response> {
  let size: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return textResponse(404, 'Introuvable', csp);
    size = info.size;
  } catch {
    return textResponse(404, 'Introuvable', csp);
  }
  const headers: Record<string, string> = {
    'content-type': mimeType(file),
    'content-security-policy': csp,
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache',
    'x-content-type-options': 'nosniff',
  };
  const range = parseRange(request.headers.get('range'), size);
  if (range === 'invalid') {
    return new Response(null, { status: 416, headers: { ...headers, 'content-range': `bytes */${size}` } });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers: { ...headers, 'content-length': String(size) } });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  const body =
    size === 0
      ? null
      : (Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>);
  if (range === null) {
    return new Response(body, { status: 200, headers: { ...headers, 'content-length': String(size) } });
  }
  return new Response(body, {
    status: 206,
    headers: {
      ...headers,
      'content-length': String(end - start + 1),
      'content-range': `bytes ${start}-${end}/${size}`,
    },
  });
}

/** À appeler avant `app.whenReady()`. */
export function registerSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
    {
      scheme: GAME_SCHEME,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

export function handleAppProtocol(target: Session, rendererDir: string): void {
  target.protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app') return textResponse(404, 'Introuvable', LAUNCHER_CSP);
    const file = resolveInside(rendererDir, url.pathname === '/' ? '/index.html' : url.pathname);
    if (file === null) return textResponse(403, 'Refusé', LAUNCHER_CSP);
    return serveFile(file, request, LAUNCHER_CSP);
  });
}

export function handleGameProtocol(target: Session, rootFor: (id: string) => string | null): void {
  target.protocol.handle(GAME_SCHEME, async (request) => {
    const url = new URL(request.url);
    const root = rootFor(url.host);
    if (root === null) return textResponse(404, 'Jeu introuvable', GAME_CSP);
    const file = resolveInside(root, url.pathname);
    if (file === null) return textResponse(403, 'Refusé', GAME_CSP);
    return serveFile(file, request, GAME_CSP);
  });
}
