/**
 * Contrôle « cohérence du monde » (CLAUDE.md): liste les éléments posés sans note de placement
 * (`pourquoi`): le lieu lui-même, chaque meuble de la carte, chaque objet au sol, chaque
 * intérieur. Il informe et ne bloque jamais (code de sortie 0); le moteur ignore ces notes.
 *   pnpm pourquoi            -> tous les lieux
 *   pnpm pourquoi essai-gare -> un seul lieu
 * Lancé par Node tel quel (types effacés): aucun import d'un autre fichier TypeScript.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type Files = Readonly<Record<string, unknown>>;

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function hasReason(value: unknown): boolean {
  const reason = asRecord(value).pourquoi;
  return typeof reason === 'string' && reason.trim() !== '';
}

function idOf(value: unknown): string {
  const id = asRecord(value).id;
  return typeof id === 'string' ? id : '?';
}

function listOf(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

/**
 * Les éléments sans `pourquoi`, en phrases lisibles, dans l'ordre des lieux. `files` est la table
 * des fichiers de données par chemin relatif à `donnees/` (celle de `loadContent`).
 */
export function missingReasons(files: Files, only: string | null = null): string[] {
  const out: string[] = [];
  const places = Object.keys(files)
    .map((path) => /^lieux\/([^/]+)\/lieu\.json$/.exec(path)?.[1])
    .filter((id): id is string => id !== undefined)
    .sort();
  for (const place of places) {
    if (only !== null && place !== only) continue;
    const base = `lieux/${place}`;
    if (!hasReason(files[`${base}/lieu.json`])) out.push(`lieu ${place}: le lieu lui-même`);
    const maps: { where: string; map: unknown }[] = [
      { where: '', map: files[`${base}/carte.json`] },
    ];
    for (const path of Object.keys(files).sort()) {
      if (!path.startsWith(`${base}/interieurs/`)) continue;
      const room = files[path];
      if (!hasReason(room)) out.push(`lieu ${place}, intérieur ${idOf(room)}: la pièce`);
      maps.push({ where: `intérieur ${idOf(room)}, `, map: room });
    }
    for (const { where, map } of maps) {
      for (const object of listOf(asRecord(map).objects))
        if (!hasReason(object)) out.push(`lieu ${place}, ${where}meuble ${idOf(object)}`);
      for (const ground of listOf(asRecord(map).groundItems))
        if (!hasReason(ground)) out.push(`lieu ${place}, ${where}objet au sol ${idOf(ground)}`);
    }
  }
  return out;
}

function readData(dir: string, prefix = ''): Record<string, unknown> {
  const files: Record<string, unknown> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(files, readData(path, `${prefix}${entry.name}/`));
    else if (entry.name.endsWith('.json'))
      files[`${prefix}${entry.name}`] = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  }
  return files;
}

function main(args: readonly string[]): void {
  const data = join(dirname(fileURLToPath(import.meta.url)), '..', 'donnees');
  if (!existsSync(data)) throw new Error('dossier donnees/ introuvable');
  const missing = missingReasons(readData(data), args[0] ?? null);
  if (missing.length === 0) {
    process.stdout.write('Tous les éléments posés ont leur « pourquoi ».\n');
    return;
  }
  process.stdout.write(`${String(missing.length)} élément(s) sans « pourquoi »:\n`);
  for (const line of missing) process.stdout.write(`- ${line}\n`);
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
