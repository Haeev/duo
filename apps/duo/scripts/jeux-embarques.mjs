// @ts-check
// Jeux copiés dans les ressources de l'application (ADR 0011, section 3.1).
// L'application les lit dans `<ressources>/games/<id>/duo-game.json` (source
// « bundled » du catalogue). Le contrôle a lieu à la lecture de la
// configuration: un jeu non construit fait échouer la fabrication tout de
// suite, au lieu de livrer une application sans jeu.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * @typedef {object} BundledGame
 * @property {string} id identifiant du manifeste, donc nom du dossier dans les ressources
 * @property {string} version version du jeu
 * @property {string} folder dossier du paquet du jeu
 * @property {string} dist dossier construit par Vite
 * @property {string} manifest fichier `duo-game.json` retenu
 */

/** Même règle que le catalogue: pas de dossier caché ni de dossier d'essai (`_`). */
const GAME_ID = /^[a-z0-9][a-z0-9-]*$/;

/**
 * @param {string} file
 * @returns {boolean}
 */
function isFile(file) {
  return existsSync(file) && statSync(file).isFile();
}

/**
 * Lit et contrôle un jeu à embarquer.
 * @param {string} folder dossier du paquet du jeu (absolu)
 * @returns {BundledGame}
 */
export function resolveBundledGame(folder) {
  const label = path.basename(folder);
  const dist = path.join(folder, 'dist');
  // Le manifeste construit l'emporte; sinon celui du paquet (gabarit actuel des jeux).
  const manifest = [path.join(dist, 'duo-game.json'), path.join(folder, 'duo-game.json')].find(
    isFile,
  );
  if (manifest === undefined) {
    throw new Error(
      `jeu embarqué « ${label} »: duo-game.json introuvable dans ${folder} ni dans son dossier dist`,
    );
  }
  /** @type {unknown} */
  let raw;
  try {
    raw = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch (error) {
    throw new Error(`jeu embarqué « ${label} »: ${manifest} n'est pas du JSON valide`, {
      cause: error,
    });
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error(`jeu embarqué « ${label} »: manifeste vide ou invalide`);
  }
  const { id, version, entry } = /** @type {Record<string, unknown>} */ (raw);
  if (typeof id !== 'string' || !GAME_ID.test(id)) {
    throw new Error(`jeu embarqué « ${label} »: identifiant manquant ou invalide (${String(id)})`);
  }
  if (typeof version !== 'string' || version === '') {
    throw new Error(`jeu embarqué « ${id} »: version manquante`);
  }
  if (typeof entry !== 'string' || entry === '' || entry.includes('..')) {
    throw new Error(`jeu embarqué « ${id} »: page d'entrée manquante ou invalide`);
  }
  if (!isFile(path.join(dist, ...entry.split('/')))) {
    throw new Error(
      `jeu embarqué « ${id} »: ${entry} absent de ${dist}. Construis le jeu avant l'application (pnpm build:app).`,
    );
  }
  return { id, version, folder, dist, manifest };
}

/**
 * Lit tous les jeux à embarquer et refuse deux jeux au même identifiant.
 * @param {string} repoRoot racine du dépôt
 * @param {readonly string[]} folders dossiers des jeux, relatifs à la racine, séparés par `/`
 * @returns {BundledGame[]}
 */
export function resolveBundledGames(repoRoot, folders) {
  const games = folders.map((folder) =>
    resolveBundledGame(path.join(repoRoot, ...folder.split('/'))),
  );
  const seen = new Set();
  for (const game of games) {
    if (seen.has(game.id)) throw new Error(`jeu embarqué « ${game.id} » listé deux fois`);
    seen.add(game.id);
  }
  return games;
}

/**
 * Entrées `extraResources` d'electron-builder pour ces jeux. Les entrées sont
 * copiées en parallèle: le manifeste est exclu de la copie du dossier, puis
 * copié seul, pour qu'un même fichier ne soit jamais écrit deux fois.
 * @param {readonly BundledGame[]} games
 * @returns {{ from: string, to: string, filter?: string[] }[]}
 */
export function extraResourcesFor(games) {
  return games.flatMap((game) => [
    { from: game.dist, to: `games/${game.id}`, filter: ['**/*', '!**/*.map', '!duo-game.json'] },
    { from: game.manifest, to: `games/${game.id}/duo-game.json` },
  ]);
}

/**
 * Liste des jeux: la variable d'environnement `DUO_JEUX_EMBARQUES` (dossiers
 * séparés par des virgules, vide pour aucun jeu) remplace la liste par défaut.
 * @param {readonly string[]} defaults
 * @param {NodeJS.ProcessEnv} env
 * @returns {string[]}
 */
export function bundledGameFolders(defaults, env) {
  const override = env.DUO_JEUX_EMBARQUES;
  if (override === undefined) return [...defaults];
  return override
    .split(',')
    .map((folder) => folder.trim())
    .filter((folder) => folder !== '');
}
