// Jeux disponibles sur cette machine. Pour le prototype: jeux embarqués dans les
// ressources de l'application, jeux installés dans le dossier de données
// (ADR 0010, lot L11), et en développement `games/<jeu>/dist` du dépôt.
// Un manifeste invalide rend le jeu illisible sans toucher aux autres (M-12).
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { bridgeCovers, checkManifest, type GameManifest } from './manifest';

export type GameSource = 'extra' | 'dev' | 'installed' | 'bundled';

/**
 * Dossier qui contient un sous-dossier par jeu, nommé par son identifiant: paquet
 * installé (`<id>/duo-game.json` et le site à côté) ou paquet du dépôt
 * (`<id>/duo-game.json` à la racine du paquet, site construit dans `<id>/dist/`).
 */
export interface GameRoot {
  readonly source: GameSource;
  readonly dir: string;
}

export interface GameEntry {
  readonly manifest: GameManifest;
  /** Dossier servi par `duo-game://<id>/`. */
  readonly root: string;
  readonly source: GameSource;
  /** Faux si le jeu exige une version du pont que l'application n'a pas (M-13). */
  readonly compatible: boolean;
}

export interface CatalogProblem {
  readonly folder: string;
  readonly problems: readonly string[];
}

export interface Catalog {
  readonly games: readonly GameEntry[];
  readonly problems: readonly CatalogProblem[];
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function listFolders(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.'),
      )
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

async function locate(
  root: GameRoot,
  folder: string,
): Promise<{ manifestFile: string; served: string } | null> {
  const base = path.join(root.dir, folder);
  const dist = path.join(base, 'dist');
  const distManifest = path.join(dist, 'duo-game.json');
  if (await isFile(distManifest)) return { manifestFile: distManifest, served: dist };
  const manifestFile = path.join(base, 'duo-game.json');
  if (!(await isFile(manifestFile))) return null;
  return { manifestFile, served: (await isDirectory(dist)) ? dist : base };
}

/** Chemin relatif au paquet, sans sortie du dossier servi. */
function insidePackage(relative: string): boolean {
  const segments = relative.split('/');
  return (
    !relative.startsWith('/') &&
    !relative.includes('\\') &&
    !segments.includes('..') &&
    !/^[A-Za-z]:/.test(relative)
  );
}

async function readEntry(
  root: GameRoot,
  folder: string,
): Promise<GameEntry | CatalogProblem | null> {
  const located = await locate(root, folder);
  if (located === null) return null;
  const label = path.join(root.dir, folder);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(located.manifestFile, 'utf8'));
  } catch {
    return { folder: label, problems: ['duo-game.json illisible (JSON invalide)'] };
  }
  const check = checkManifest(raw);
  if (!check.ok) return { folder: label, problems: check.problems };
  const { manifest } = check;
  if (manifest.id !== folder) {
    return {
      folder: label,
      problems: [`id « ${manifest.id} » différent du dossier « ${folder} »`],
    };
  }
  if (!insidePackage(manifest.entry) || !insidePackage(manifest.thumbnail)) {
    return {
      folder: label,
      problems: ['entry et thumbnail: chemins relatifs au paquet, sans « .. »'],
    };
  }
  if (!(await isFile(path.join(located.served, ...manifest.entry.split('/'))))) {
    return {
      folder: label,
      problems: [`page d'entrée absente: ${manifest.entry} (jeu construit ?)`],
    };
  }
  return {
    manifest,
    root: located.served,
    source: root.source,
    compatible: bridgeCovers(manifest.sdk),
  };
}

/** Parcourt les dossiers dans l'ordre donné: le premier jeu trouvé pour un identifiant l'emporte. */
export async function scanGames(roots: readonly GameRoot[]): Promise<Catalog> {
  const games = new Map<string, GameEntry>();
  const problems: CatalogProblem[] = [];
  for (const root of roots) {
    for (const folder of await listFolders(root.dir)) {
      if (games.has(folder)) continue;
      const entry = await readEntry(root, folder);
      if (entry === null) continue;
      if ('manifest' in entry) {
        games.set(folder, entry);
      } else {
        problems.push(entry);
      }
    }
  }
  return { games: [...games.values()], problems };
}
