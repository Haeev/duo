#!/usr/bin/env node
// @ts-check
// Fabrique le paquet signé d'un jeu (ADR 0010, point 1), en CI ou en local:
//
//   node outils/paquet-jeu.mjs <dossier-du-jeu-construit> --sortie <dossier>
//
// Le dossier donné est le paquet du jeu (`games/<id>`, avec `duo-game.json` et
// le site construit dans `dist/`) ou directement son `dist/`: le manifeste est
// alors cherché dans `dist/`, puis dans le dossier parent (gabarit actuel des
// jeux: Vite ne copie pas `duo-game.json` dans `dist/`).
// Clé privée Ed25519 (PEM PKCS8) dans `DUO_CLE_PAQUETS`, identifiant de clé dans
// `DUO_CLE_PAQUETS_ID` (défaut `duo-2026`). Écrit `<id>-<version>.duogame` dans
// la sortie et affiche une ligne JSON sur la sortie standard:
// {"id","version","fichier","taille","sha256","manifeste":{nom,description,mode,duree,sdk}}

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPackage } from '@duo/paquet';

const DEFAULT_KEY_ID = 'duo-2026';
/** Même règle que `duo-files.sig` (`KeyIdSchema` de @duo/paquet). */
const KEY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;

/**
 * @param {string} file
 * @returns {boolean}
 */
function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function isDirectory(dir) {
  return existsSync(dir) && statSync(dir).isDirectory();
}

/**
 * Site et manifeste d'un jeu construit.
 * @param {string} folder dossier absolu
 * @returns {{ siteDir: string, manifestFile: string }}
 */
export function resolveBuiltGame(folder) {
  if (!isDirectory(folder)) throw new Error(`dossier introuvable: ${folder}`);
  const dist = path.join(folder, 'dist');
  if (isDirectory(dist)) {
    const manifestFile = [
      path.join(dist, 'duo-game.json'),
      path.join(folder, 'duo-game.json'),
    ].find(isFile);
    if (manifestFile !== undefined) return { siteDir: dist, manifestFile };
  }
  const manifestFile = [
    path.join(folder, 'duo-game.json'),
    path.join(path.dirname(folder), 'duo-game.json'),
  ].find(isFile);
  if (manifestFile === undefined) {
    throw new Error(`duo-game.json introuvable dans ${folder}, ni dans son dossier parent`);
  }
  return { siteDir: folder, manifestFile };
}

/**
 * @param {readonly string[]} argv arguments après le nom du script
 * @returns {{ folder: string, outDir: string }}
 */
export function parseArguments(argv) {
  /** @type {string | null} */
  let folder = null;
  /** @type {string | null} */
  let outDir = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--sortie') {
      outDir = argv[index + 1] ?? null;
      index += 1;
    } else if (argument !== undefined && !argument.startsWith('--') && folder === null) {
      folder = argument;
    } else {
      throw new Error(`argument inattendu: ${String(argument)}`);
    }
  }
  if (folder === null || outDir === null) {
    throw new Error(
      'usage: node outils/paquet-jeu.mjs <dossier-du-jeu-construit> --sortie <dossier>',
    );
  }
  return { folder: path.resolve(folder), outDir: path.resolve(outDir) };
}

/**
 * @param {readonly string[]} argv
 * @param {NodeJS.ProcessEnv} env
 * @returns {Promise<string>} ligne JSON du paquet écrit
 */
export async function run(argv, env) {
  const { folder, outDir } = parseArguments(argv);
  const privateKeyPem = env.DUO_CLE_PAQUETS;
  if (privateKeyPem === undefined || privateKeyPem.trim() === '') {
    throw new Error('DUO_CLE_PAQUETS absente: clé privée Ed25519 attendue (PEM PKCS8)');
  }
  const keyId = env.DUO_CLE_PAQUETS_ID ?? DEFAULT_KEY_ID;
  if (!KEY_ID.test(keyId)) throw new Error(`DUO_CLE_PAQUETS_ID invalide: ${keyId}`);
  const { siteDir, manifestFile } = resolveBuiltGame(folder);
  const created = await createPackage({ siteDir, manifestFile, outDir, privateKeyPem, keyId });
  const { manifest } = created;
  return JSON.stringify({
    id: created.id,
    version: created.version,
    fichier: created.file,
    taille: created.size,
    sha256: created.sha256,
    manifeste: {
      nom: manifest.name,
      description: manifest.description,
      mode: manifest.mode,
      duree: manifest.durationMinutes,
      sdk: manifest.sdk,
    },
  });
}

const invoked = process.argv[1];
if (invoked !== undefined && import.meta.url === pathToFileURL(path.resolve(invoked)).href) {
  run(process.argv.slice(2), process.env).then(
    (line) => {
      process.stdout.write(`${line}\n`);
    },
    (/** @type {unknown} */ error) => {
      process.stderr.write(
        `paquet-jeu: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    },
  );
}
