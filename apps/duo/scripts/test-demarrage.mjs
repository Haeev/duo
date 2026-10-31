#!/usr/bin/env node
// @ts-check
// Test de lancement de l'application empaquetée (ADR 0011, section 3.5; ADR 0013, point 5).
// Les fusibles ferment les options d'inspection: Playwright ne peut pas piloter
// cette version. On la lance donc avec un dossier de données temporaire et on
// attend, dans son journal (ADR 0015), l'événement `launcher-ready`.
//
//   node scripts/test-demarrage.mjs <exécutable> [--delai <secondes>] [--jeu <id>]... [--jeux-embarques] [--garder] [-- <options pour Duo>]
//
// `--jeux-embarques` exige tous les jeux de electron-builder.config.mjs.
//
// Le dossier de données porte une espace, des accents et une apostrophe, comme
// un nom de compte réel. Échec si Duo s'arrête avant d'être prêt, s'il n'est pas
// prêt dans le délai, si un jeu demandé manque au catalogue, ou s'il laisse un
// rapport de plantage.

import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { configuredGames } from './verifier-paquet.mjs';

/**
 * @typedef {{ event: string, level: string, details: unknown }} JournalLine
 */

/**
 * Lignes du journal JSON Lines; une ligne illisible (écriture en cours) est ignorée.
 * @param {string} text
 * @returns {JournalLine[]}
 */
export function parseJournal(text) {
  /** @type {JournalLine[]} */
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    try {
      /** @type {unknown} */
      const value = JSON.parse(raw);
      if (
        typeof value === 'object' &&
        value !== null &&
        'event' in value &&
        typeof value.event === 'string'
      ) {
        const level = 'level' in value && typeof value.level === 'string' ? value.level : '';
        lines.push({
          event: value.event,
          level,
          details: 'details' in value ? value.details : undefined,
        });
      }
    } catch {
      // Ligne en cours d'écriture: relue au tour suivant.
    }
  }
  return lines;
}

/**
 * Jeux du catalogue qui viennent des ressources de l'application, d'après
 * l'événement `catalog` (`<id>@<version> (bundled)`).
 * @param {readonly JournalLine[]} lines
 * @returns {string[]} identifiants
 */
export function bundledGamesInCatalog(lines) {
  const catalog = lines.find((line) => line.event === 'catalog');
  if (catalog === undefined || typeof catalog.details !== 'object' || catalog.details === null)
    return [];
  const games = 'games' in catalog.details ? catalog.details.games : undefined;
  if (!Array.isArray(games)) return [];
  return games.flatMap((entry) => {
    const match = typeof entry === 'string' ? /^([a-z0-9-]+)@\S+ \(bundled\)$/.exec(entry) : null;
    return match?.[1] === undefined ? [] : [match[1]];
  });
}

/**
 * @param {string} dir
 * @returns {Promise<JournalLine[]>}
 */
async function readJournalDir(dir) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((name) => name.endsWith('.jsonl')).sort();
  const texts = await Promise.all(
    files.map((name) => readFile(path.join(dir, name), 'utf8').catch(() => '')),
  );
  return texts.flatMap(parseJournal);
}

/**
 * Rapports de plantage (minidumps de Crashpad) laissés dans le dossier de données.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function findCrashDumps(dir) {
  /** @type {string[]} */
  const found = [];
  const entries = await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.dmp'))
      found.push(path.join(entry.parentPath, entry.name));
  }
  return found;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Arrête Duo et ses processus enfants.
 * @param {import('node:child_process').ChildProcess} child
 * @returns {Promise<void>}
 */
async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {
        resolve(undefined);
      });
    });
  } else {
    child.kill('SIGTERM');
  }
  const timeout = sleep(15_000).then(() => 'délai');
  if ((await Promise.race([exited, timeout])) === 'délai') child.kill('SIGKILL');
}

/**
 * @param {readonly string[]} argv
 * @returns {{ executable: string, timeoutSeconds: number, games: string[], bundled: boolean, keep: boolean, extra: string[] }}
 */
function parseArguments(argv) {
  const separator = argv.indexOf('--');
  const own = separator === -1 ? argv : argv.slice(0, separator);
  const extra = separator === -1 ? [] : argv.slice(separator + 1);
  /** @type {string | null} */
  let executable = null;
  let timeoutSeconds = 60;
  /** @type {string[]} */
  const games = [];
  let keep = false;
  let bundled = false;
  for (let index = 0; index < own.length; index += 1) {
    const argument = own[index];
    const value = own[index + 1];
    if (argument === '--delai' && value !== undefined && /^\d+$/.test(value)) {
      timeoutSeconds = Number(value);
      index += 1;
    } else if (argument === '--jeu' && value !== undefined) {
      games.push(value);
      index += 1;
    } else if (argument === '--jeux-embarques') {
      bundled = true;
    } else if (argument === '--garder') {
      keep = true;
    } else if (executable === null && argument !== undefined && !argument.startsWith('--')) {
      executable = argument;
    } else {
      throw new Error(`argument inconnu: ${String(argument)}`);
    }
  }
  if (executable === null) throw new Error("chemin de l'exécutable de Duo attendu");
  return { executable: path.resolve(executable), timeoutSeconds, games, bundled, keep, extra };
}

/** @param {string} message */
function say(message) {
  process.stdout.write(`${message}\n`);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  if (!existsSync(args.executable)) throw new Error(`exécutable introuvable: ${args.executable}`);
  if (args.bundled) {
    const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    for (const game of await configuredGames(appDir))
      if (!args.games.includes(game.id)) args.games.push(game.id);
  }
  const parent = await mkdtemp(path.join(os.tmpdir(), "Duo essai d'été "));
  const dataDir = path.join(parent, 'données');
  const journalDir = path.join(dataDir, 'logs');
  say(`Lancement de ${args.executable}`);
  say(`Dossier de données: ${dataDir}`);

  let output = '';
  const started = Date.now();
  const child = spawn(args.executable, [`--duo-data-dir=${dataDir}`, ...args.extra], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: false,
  });
  child.stdout.on('data', (/** @type {Buffer} */ chunk) => {
    output += chunk.toString('utf8');
  });
  child.stderr.on('data', (/** @type {Buffer} */ chunk) => {
    output += chunk.toString('utf8');
  });
  // Dans un objet: TypeScript ne voit pas les affectations faites dans un rappel.
  const launch = { error: /** @type {Error | null} */ (null) };
  child.once('error', (error) => {
    launch.error = error;
  });

  /** @type {string[]} */
  const problems = [];
  /** @type {JournalLine[]} */
  let lines = [];
  let ready = false;
  while (Date.now() - started < args.timeoutSeconds * 1000) {
    lines = await readJournalDir(journalDir);
    if (lines.some((line) => line.event === 'launcher-ready')) {
      ready = true;
      break;
    }
    if (launch.error !== null || child.exitCode !== null || child.signalCode !== null) break;
    await sleep(250);
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  if (ready) {
    say(`Lanceur prêt en ${elapsed} s.`);
    // Quelques secondes de plus: un plantage juste après l'affichage compte aussi.
    await sleep(3000);
    if (child.exitCode !== null || child.signalCode !== null) {
      problems.push(
        `Duo s'est arrêté juste après le lancement (code ${String(child.exitCode)}, signal ${String(child.signalCode)})`,
      );
    }
    lines = await readJournalDir(journalDir);
    const bundled = bundledGamesInCatalog(lines);
    say(`Jeux embarqués vus par Duo: ${bundled.length === 0 ? 'aucun' : bundled.join(', ')}`);
    for (const game of args.games) {
      if (!bundled.includes(game))
        problems.push(`jeu ${game} absent du catalogue (source « bundled »)`);
    }
  } else if (launch.error !== null) {
    problems.push(`lancement impossible: ${String(launch.error)}`);
  } else if (child.exitCode !== null || child.signalCode !== null) {
    problems.push(
      `Duo s'est arrêté avant d'être prêt (code ${String(child.exitCode)}, signal ${String(child.signalCode)})`,
    );
  } else {
    problems.push(`lanceur pas prêt après ${args.timeoutSeconds} s`);
  }

  await stop(child);
  const dumps = await findCrashDumps(dataDir);
  if (dumps.length > 0) problems.push(`rapport(s) de plantage: ${dumps.join(', ')}`);

  say('Journal de Duo (événements):');
  for (const line of lines) say(`  ${line.level} ${line.event}`);
  for (const line of lines.filter((entry) => entry.level === 'error')) {
    say(`  erreur: ${line.event} ${JSON.stringify(line.details)}`);
  }
  if (problems.length > 0) {
    say('Sorties de Duo:');
    say(output.trim() === '' ? '  (rien)' : output.trimEnd());
  }

  if (args.keep) {
    say(`Dossier gardé: ${parent}`);
  } else {
    await rm(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }).catch(
      () => undefined,
    );
  }

  if (problems.length > 0) {
    for (const problem of problems) process.stderr.write(`ÉCHEC: ${problem}\n`);
    process.exitCode = 1;
    return;
  }
  say('Test de démarrage réussi.');
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPoint)).href) {
  main().catch((/** @type {unknown} */ error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
