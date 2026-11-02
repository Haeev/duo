#!/usr/bin/env node
// @ts-check
// Publication des jeux (ADR 0010, point 3), sans dépendance. Sous-commandes:
//
//   node outils/publication-jeu.mjs controle <tag>            tag jeu-<id>-v<version> conforme au jeu
//   node outils/publication-jeu.mjs tag <id>                  tag attendu pour la version actuelle
//   node outils/publication-jeu.mjs notes <id> --sortie <f>   notes de la release (en français)
//   node outils/publication-jeu.mjs entree <ligne> --sortie <f>
//        valide la ligne JSON de outils/paquet-jeu.mjs et écrit l'entrée du catalogue
//   node outils/publication-jeu.mjs catalogue --entree <f> [--actuel <f>] --sortie <f>
//        remplace l'entrée du jeu dans catalogue.json (jamais de retour en arrière, ADR 0006)
//   node outils/publication-jeu.mjs monter <id> patch|minor|major
//        monte la version dans duo-game.json et package.json du jeu
//
// `controle` et `tag` écrivent `id=...`, `version=...` et `tag=...` sur la
// sortie standard, une par ligne, au format de $GITHUB_OUTPUT.

import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPOSITORY = 'Haeev/duo';
export const CATALOGUE_SCHEMA = 1;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

/**
 * @typedef {{ nom: string, description: string, mode: string, duree: unknown, sdk: string }} Extrait
 * @typedef {{ id: string, version: string, manifeste: Extrait, taille: number, url: string, sha256: string }} Entree
 * @typedef {{ schema: number, jeux: Entree[] }} Catalogue
 */

/**
 * @param {string} tag
 * @returns {{ id: string, version: string } | null}
 */
export function parseTag(tag) {
  // Identifiant gourmand: la dernière occurrence de « -v » suivie d'une version l'emporte.
  const match = new RegExp(`^jeu-(.+)-v(${SEMVER_PATTERN.source.slice(1, -1)})$`).exec(tag);
  if (match === null) return null;
  const [, id = '', version = ''] = match;
  if (!ID_PATTERN.test(id) || !SEMVER_PATTERN.test(version)) return null;
  return { id, version };
}

/**
 * @param {string} id
 * @param {string} version
 * @returns {string}
 */
export function tagOf(id, version) {
  return `jeu-${id}-v${version}`;
}

/**
 * Adresse directe du paquet dans sa release (ADR 0010, point 2).
 * @param {string} id
 * @param {string} version
 * @returns {string}
 */
export function packageUrl(id, version) {
  return `https://github.com/${REPOSITORY}/releases/download/${tagOf(id, version)}/${id}-${version}.duogame`;
}

/**
 * Comparaison SemVer (préversions comprises): négatif si a < b.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareVersions(a, b) {
  const pa = SEMVER_PATTERN.exec(a);
  const pb = SEMVER_PATTERN.exec(b);
  if (pa === null || pb === null)
    throw new Error(`version SemVer invalide: ${pa === null ? a : b}`);
  for (let i = 1; i <= 3; i += 1) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff;
  }
  const ra = pa[4];
  const rb = pb[4];
  if (ra === undefined || rb === undefined) return ra === rb ? 0 : ra === undefined ? 1 : -1;
  const ia = ra.split('.');
  const ib = rb.split('.');
  for (let i = 0; i < Math.max(ia.length, ib.length); i += 1) {
    const x = ia[i];
    const y = ib[i];
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * @param {string} version
 * @param {string} level
 * @returns {string}
 */
export function bumpVersion(version, level) {
  const match = SEMVER_PATTERN.exec(version);
  if (match === null || match[4] !== undefined)
    throw new Error(`version ${version}: seule une version x.y.z se monte ainsi`);
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'major') return `${major + 1}.0.0`;
  throw new Error(`niveau inconnu: ${level} (patch, minor ou major)`);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Valide la ligne JSON de outils/paquet-jeu.mjs et en tire l'entrée du catalogue.
 * @param {unknown} line
 * @returns {Entree}
 */
export function entryFromToolLine(line) {
  if (!isRecord(line)) throw new Error('ligne de paquet-jeu: objet JSON attendu');
  const { id, version, fichier, taille, sha256, manifeste } = line;
  if (typeof id !== 'string' || !ID_PATTERN.test(id))
    throw new Error('ligne de paquet-jeu: id invalide');
  if (typeof version !== 'string' || !SEMVER_PATTERN.test(version))
    throw new Error('ligne de paquet-jeu: version invalide');
  if (fichier !== undefined && typeof fichier !== 'string')
    throw new Error('ligne de paquet-jeu: fichier invalide');
  if (typeof fichier === 'string' && path.basename(fichier) !== `${id}-${version}.duogame`)
    throw new Error(`ligne de paquet-jeu: fichier ${fichier} au lieu de ${id}-${version}.duogame`);
  if (typeof taille !== 'number' || !Number.isSafeInteger(taille) || taille <= 0)
    throw new Error('ligne de paquet-jeu: taille invalide');
  if (typeof sha256 !== 'string' || !SHA256_PATTERN.test(sha256))
    throw new Error('ligne de paquet-jeu: sha256 invalide');
  if (!isRecord(manifeste)) throw new Error('ligne de paquet-jeu: manifeste absent');
  const { nom, description, mode, duree, sdk } = manifeste;
  if (typeof nom !== 'string' || typeof description !== 'string' || typeof mode !== 'string')
    throw new Error('ligne de paquet-jeu: nom, description ou mode invalide');
  if (typeof sdk !== 'string' || !/^\d+\.\d+$/.test(sdk))
    throw new Error('ligne de paquet-jeu: sdk invalide');
  if (duree === undefined) throw new Error('ligne de paquet-jeu: duree absente');
  return {
    id,
    version,
    manifeste: { nom, description, mode, duree, sdk },
    taille,
    url: packageUrl(id, version),
    sha256,
  };
}

/**
 * Remplace l'entrée du jeu. Refuse un retour en arrière (ADR 0006) et une même
 * version d'empreinte différente (une version publiée ne se republie jamais).
 * @param {unknown} current catalogue actuel, ou null s'il n'existe pas encore
 * @param {Entree} entry
 * @returns {Catalogue}
 */
export function mergeCatalogue(current, entry) {
  /** @type {Entree[]} */
  let games = [];
  if (current !== null) {
    if (!isRecord(current) || current.schema !== CATALOGUE_SCHEMA || !Array.isArray(current.jeux))
      throw new Error(
        `catalogue actuel illisible ou de schéma inconnu (attendu: ${CATALOGUE_SCHEMA})`,
      );
    games = /** @type {Entree[]} */ (current.jeux.filter(isRecord));
  }
  const previous = games.find((game) => game.id === entry.id);
  if (previous !== undefined && typeof previous.version === 'string') {
    const order = compareVersions(entry.version, previous.version);
    if (order < 0)
      throw new Error(
        `catalogue: ${entry.id} y est déjà en ${previous.version}, plus récente que ${entry.version}`,
      );
    if (order === 0 && previous.sha256 !== entry.sha256)
      throw new Error(`catalogue: ${entry.id} ${entry.version} y figure avec une autre empreinte`);
  }
  const others = games.filter((game) => game.id !== entry.id);
  const jeux = [...others, entry].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { schema: CATALOGUE_SCHEMA, jeux };
}

/**
 * @param {string} id
 * @returns {{ dir: string, manifest: Record<string, unknown>, pkg: Record<string, unknown> }}
 */
function readGame(id) {
  if (!ID_PATTERN.test(id)) throw new Error(`identifiant de jeu invalide: ${id}`);
  const dir = path.join(ROOT, 'games', id);
  const manifestFile = path.join(dir, 'duo-game.json');
  if (!existsSync(manifestFile)) throw new Error(`jeu inconnu: games/${id}/duo-game.json absent`);
  /** @type {unknown} */
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  /** @type {unknown} */
  const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  if (!isRecord(manifest) || !isRecord(pkg)) throw new Error(`games/${id}: JSON inattendu`);
  if (manifest.id !== id) throw new Error(`games/${id}/duo-game.json: id ${String(manifest.id)}`);
  if (typeof manifest.version !== 'string' || !SEMVER_PATTERN.test(manifest.version))
    throw new Error(`games/${id}/duo-game.json: version invalide`);
  if (pkg.version !== manifest.version)
    throw new Error(
      `games/${id}: version ${String(pkg.version)} dans package.json, ${manifest.version} dans duo-game.json`,
    );
  return { dir, manifest, pkg };
}

/**
 * Remplace la première valeur de "version" sans toucher au reste du fichier (mise en forme gardée).
 * @param {string} text
 * @param {string} version
 * @returns {string}
 */
export function replaceVersionField(text, version) {
  const pattern = /("version"\s*:\s*)"[^"]*"/;
  if (!pattern.test(text)) throw new Error('champ "version" introuvable');
  return text.replace(pattern, `$1"${version}"`);
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | undefined}
 */
function option(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string}
 */
function required(argv, name) {
  const value = option(argv, name);
  if (value === undefined || value === '') throw new Error(`option ${name} attendue`);
  return value;
}

/** @param {Record<string, string>} values */
function printOutputs(values) {
  for (const [key, value] of Object.entries(values)) process.stdout.write(`${key}=${value}\n`);
}

/**
 * @param {string[]} argv
 * @returns {Promise<void>}
 */
async function main(argv) {
  const [command = '', first = ''] = argv;
  switch (command) {
    case 'controle': {
      const parsed = parseTag(first);
      if (parsed === null) throw new Error(`tag ${first}: forme attendue jeu-<id>-v<x.y.z>`);
      const { manifest } = readGame(parsed.id);
      if (manifest.version !== parsed.version)
        throw new Error(
          `tag ${first}: games/${parsed.id}/duo-game.json est en version ${String(manifest.version)}`,
        );
      printOutputs({ id: parsed.id, version: parsed.version, tag: first });
      return;
    }
    case 'tag': {
      const { manifest } = readGame(first);
      const version = String(manifest.version);
      printOutputs({ id: first, version, tag: tagOf(first, version) });
      return;
    }
    case 'notes': {
      const { manifest } = readGame(first);
      const name = typeof manifest.name === 'string' ? manifest.name : first;
      const news = typeof manifest.whatsNew === 'string' ? manifest.whatsNew.trim() : '';
      const notes = [
        `${name}, version ${String(manifest.version)}.`,
        '',
        news !== '' ? news : typeof manifest.description === 'string' ? manifest.description : '',
        '',
        'Duo installe ce jeu tout seul quand Internet répond. Sans Internet: copie depuis l’autre ordinateur, ou « Installer un jeu depuis un fichier » avec le fichier .duogame ci-dessous.',
        '',
      ].join('\n');
      await writeFile(required(argv, '--sortie'), notes);
      return;
    }
    case 'entree': {
      const lines = readFileSync(first, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      const last = lines.at(-1);
      if (last === undefined) throw new Error(`${first}: aucune ligne JSON`);
      /** @type {unknown} */
      const parsed = JSON.parse(last);
      const entry = entryFromToolLine(parsed);
      await writeFile(required(argv, '--sortie'), `${JSON.stringify(entry, null, 2)}\n`);
      printOutputs({ id: entry.id, version: entry.version, sha256: entry.sha256 });
      return;
    }
    case 'catalogue': {
      /** @type {unknown} */
      const raw = JSON.parse(readFileSync(required(argv, '--entree'), 'utf8'));
      const entry = entryFromToolLine({ ...(isRecord(raw) ? raw : {}), fichier: undefined });
      const currentFile = option(argv, '--actuel');
      /** @type {unknown} */
      const current =
        currentFile !== undefined && existsSync(currentFile)
          ? JSON.parse(readFileSync(currentFile, 'utf8'))
          : null;
      const catalogue = mergeCatalogue(current, entry);
      await writeFile(required(argv, '--sortie'), `${JSON.stringify(catalogue, null, 2)}\n`);
      process.stdout.write(
        `Catalogue: ${catalogue.jeux.map((game) => `${game.id} ${game.version}`).join(', ')}\n`,
      );
      return;
    }
    case 'monter': {
      const level = argv[2] ?? '';
      const { dir, manifest } = readGame(first);
      const next = bumpVersion(String(manifest.version), level);
      for (const name of ['duo-game.json', 'package.json']) {
        const file = path.join(dir, name);
        await writeFile(file, replaceVersionField(readFileSync(file, 'utf8'), next));
      }
      process.stdout.write(
        `${first}: ${String(manifest.version)} -> ${next} (duo-game.json et package.json). Pense au champ whatsNew.\n`,
      );
      return;
    }
    default:
      throw new Error(
        'sous-commande attendue: controle, tag, notes, entree, catalogue ou monter (voir l’en-tête du fichier)',
      );
  }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPoint)).href) {
  main(process.argv.slice(2)).catch((/** @type {unknown} */ error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
