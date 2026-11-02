#!/usr/bin/env node
// @ts-check
// Contrôle de l'application empaquetée par electron-builder (ADR 0011,
// section 3.8; ADR 0013, point 1). Sans dépendance, sous macOS, Windows et Linux:
//
//   node scripts/verifier-paquet.mjs --plateforme mac|win|linux [--app <chemin>] [--dist <dossier>]
//   node scripts/verifier-paquet.mjs --uuid-attendu
//
// `--app` désigne Duo.app (macOS) ou le dossier qui contient l'exécutable
// (Windows, Linux); par défaut, le dossier produit dans `dist`, et les
// installateurs de `dist` sont contrôlés aussi. `--uuid-attendu` affiche l'UUID
// que doit porter l'exécutable macOS, sous la forme de `dwarfdump --uuid`. Les
// signatures macOS se vérifient à part, avec codesign, dans le workflow.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CPU_TYPES, duoExecutableUuid, locateMachOUuid, readMachOUuid } from './after-pack.mjs';

/** Sentinelle qui précède le câblage des fusibles dans le binaire d'Electron. */
const FUSE_SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';

/**
 * Câblage attendu, dans l'ordre d'Electron 45 (`build/fuses/fuses.json5`):
 * `0` coupé, `1` actif (ADR 0011, section 3.5).
 * @type {readonly (readonly [string, '0' | '1'])[]}
 */
export const EXPECTED_FUSES = [
  ['runAsNode', '0'],
  ['cookieEncryption', '0'],
  ['nodeOptions', '0'],
  ['nodeCliInspect', '0'],
  ['embeddedAsarIntegrityValidation', '1'],
  ['onlyLoadAppFromAsar', '1'],
  ['loadBrowserProcessSpecificV8Snapshot', '0'],
  ['grantFileProtocolExtraPrivileges', '0'],
  ['wasmTrapHandlers', '1'],
];

/**
 * Marqueurs des crochets de test et clé publique de test des paquets de jeux
 * (packages/paquet/cle-test), interdits dans une version publiée (ADR 0013, point 1).
 */
export const FORBIDDEN_MARKERS = ['__duoTest', 'BykDvRBr0nsJcew7Ilc4Dc4KYzGIyXYyLlJPAqBQxfs='];

/** Seules entrées admises à la racine de app.asar. */
const ASAR_TOP_LEVEL = new Set(['out', 'package.json']);

/** Budget par installateur (architecture, section 13.2): avertissement au-delà. */
const INSTALLER_BUDGET_BYTES = 150 * 1024 * 1024;

const APP_ID = 'io.github.haeev.duo';
const PRODUCT_NAME = 'Duo';

/**
 * Câblage des fusibles relu dans un binaire d'Electron.
 * @param {Buffer} buffer
 * @returns {{ version: number, wire: string }}
 */
export function readFuseWire(buffer) {
  const sentinel = Buffer.from(FUSE_SENTINEL, 'ascii');
  const start = buffer.indexOf(sentinel);
  if (start === -1) throw new Error('sentinelle des fusibles introuvable');
  if (buffer.indexOf(sentinel, start + 1) !== -1)
    throw new Error('sentinelle des fusibles présente deux fois');
  const versionOffset = start + sentinel.length;
  const version = buffer.readUInt8(versionOffset);
  const length = buffer.readUInt8(versionOffset + 1);
  const wire = buffer.subarray(versionOffset + 2, versionOffset + 2 + length).toString('latin1');
  if (!/^[01r]*$/.test(wire))
    throw new Error(`câblage des fusibles illisible: ${JSON.stringify(wire)}`);
  return { version, wire };
}

/**
 * Écarts entre un câblage et l'attendu.
 * @param {string} wire
 * @returns {string[]}
 */
export function fuseProblems(wire) {
  if (wire.length !== EXPECTED_FUSES.length) {
    return [
      `${wire.length} fusibles au lieu de ${EXPECTED_FUSES.length}: nouvelle version d'Electron, revoir la liste des fusibles (ADR 0011, section 3.5)`,
    ];
  }
  return EXPECTED_FUSES.flatMap(([name, expected], index) => {
    const actual = wire[index];
    return actual === expected ? [] : [`${name}: ${actual ?? '?'} au lieu de ${expected}`];
  });
}

/**
 * En-tête d'une archive asar: un entier (4), la taille de l'en-tête, puis un
 * « pickle » qui contient le JSON de l'arborescence.
 * @param {Buffer} buffer
 * @returns {unknown}
 */
export function readAsarHeader(buffer) {
  if (buffer.length < 16 || buffer.readUInt32LE(0) !== 4) throw new Error('archive asar illisible');
  const headerSize = buffer.readUInt32LE(4);
  const jsonLength = buffer.readUInt32LE(12);
  if (16 + jsonLength > 8 + headerSize || 8 + headerSize > buffer.length) {
    throw new Error('en-tête asar tronqué');
  }
  return JSON.parse(buffer.subarray(16, 16 + jsonLength).toString('utf8'));
}

/**
 * Fichiers d'une arborescence asar, chemins séparés par `/`.
 * @param {unknown} node
 * @param {string} [prefix]
 * @returns {string[]}
 */
export function listAsarFiles(node, prefix = '') {
  if (typeof node !== 'object' || node === null || !('files' in node)) return [];
  const { files } = node;
  if (typeof files !== 'object' || files === null) return [];
  return Object.entries(files).flatMap(([name, child]) => {
    const childPath = prefix === '' ? name : `${prefix}/${name}`;
    return typeof child === 'object' && child !== null && 'files' in child
      ? listAsarFiles(child, childPath)
      : [childPath];
  });
}

/**
 * Valeurs simples d'un `Info.plist` XML: chaînes et booléens, et présence des
 * autres clés de premier niveau (dictionnaires, tableaux).
 * @param {string} xml
 * @returns {Map<string, string | boolean | null>}
 */
export function readPlist(xml) {
  /** @type {Map<string, string | boolean | null>} */
  const values = new Map();
  const pattern =
    /<key>([^<]+)<\/key>\s*(?:<string>([^<]*)<\/string>|<(true|false)\/>|<(dict|array)\b)/g;
  for (const match of xml.matchAll(pattern)) {
    const [, key, text, flag] = match;
    if (key === undefined || values.has(key)) continue;
    values.set(
      key,
      text !== undefined ? decodeXml(text) : flag !== undefined ? flag === 'true' : null,
    );
  }
  return values;
}

/**
 * @param {string} text
 * @returns {string}
 */
function decodeXml(text) {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Processeur d'un exécutable Windows (champ `Machine` de l'en-tête PE).
 * @param {Buffer} buffer
 * @returns {number}
 */
export function readPeMachine(buffer) {
  if (buffer.length < 64 || buffer.toString('ascii', 0, 2) !== 'MZ')
    throw new Error('pas un exécutable Windows');
  const peOffset = buffer.readUInt32LE(0x3c);
  if (peOffset + 6 > buffer.length || buffer.readUInt32LE(peOffset) !== 0x00004550) {
    throw new Error('en-tête PE introuvable');
  }
  return buffer.readUInt16LE(peOffset + 4);
}

/** @typedef {{ status: 'ok' | 'echec' | 'avertissement' | 'info', message: string }} Result */

class Report {
  /** @type {Result[]} */
  results = [];

  /** @param {string} message */
  ok(message) {
    this.results.push({ status: 'ok', message });
  }

  /** @param {string} message */
  fail(message) {
    this.results.push({ status: 'echec', message });
  }

  /** @param {string} message */
  warn(message) {
    this.results.push({ status: 'avertissement', message });
  }

  /** @param {string} message */
  info(message) {
    this.results.push({ status: 'info', message });
  }

  /**
   * @param {boolean} condition
   * @param {string} message
   * @param {string} [detail] précision ajoutée en cas d'échec
   */
  check(condition, message, detail) {
    if (condition) this.ok(message);
    else this.fail(detail === undefined ? message : `${message} (${detail})`);
  }

  /**
   * Lance un contrôle qui peut lever une erreur.
   * @param {string} label
   * @param {() => void} run
   */
  guard(label, run) {
    try {
      run();
    } catch (error) {
      this.fail(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  get failed() {
    return this.results.some((result) => result.status === 'echec');
  }
}

/**
 * @typedef {'mac' | 'win' | 'linux'} Platform
 * @typedef {{ appRoot: string, resources: string, executable: string, fuseBinary: string }} Layout
 */

/**
 * Emplacements dans l'application empaquetée.
 * @param {Platform} platform
 * @param {string} appRoot Duo.app, ou dossier de l'exécutable
 * @returns {Layout}
 */
export function packagedLayout(platform, appRoot) {
  switch (platform) {
    case 'mac': {
      const contents = path.join(appRoot, 'Contents');
      return {
        appRoot,
        resources: path.join(contents, 'Resources'),
        executable: path.join(contents, 'MacOS', PRODUCT_NAME),
        // Sous macOS, le câblage des fusibles est dans le binaire du cadre Electron.
        fuseBinary: path.join(
          contents,
          'Frameworks',
          'Electron Framework.framework',
          'Electron Framework',
        ),
      };
    }
    case 'win': {
      const executable = path.join(appRoot, `${PRODUCT_NAME}.exe`);
      return {
        appRoot,
        resources: path.join(appRoot, 'resources'),
        executable,
        fuseBinary: executable,
      };
    }
    case 'linux': {
      const executable = path.join(appRoot, 'duo');
      return {
        appRoot,
        resources: path.join(appRoot, 'resources'),
        executable,
        fuseBinary: executable,
      };
    }
  }
}

/**
 * Dossier de l'application dans `dist` (noms d'electron-builder pour les cibles de Duo).
 * @param {Platform} platform
 * @param {string} dist
 * @returns {string}
 */
export function defaultAppRoot(platform, dist) {
  switch (platform) {
    case 'mac':
      return path.join(dist, 'mac-arm64', `${PRODUCT_NAME}.app`);
    case 'win':
      return path.join(dist, 'win-unpacked');
    case 'linux':
      return path.join(dist, 'linux-unpacked');
  }
}

/** Installateurs attendus dans `dist`, par système. @type {Record<Platform, string[]>} */
export const INSTALLERS = {
  mac: ['Duo-macOS.dmg', 'Duo-macOS.zip'],
  win: ['Duo-Windows.exe'],
  linux: [],
};

/**
 * @param {Report} report
 * @param {Layout} layout
 */
function checkFuses(report, layout) {
  report.guard('fusibles', () => {
    const { wire } = readFuseWire(readFileSync(layout.fuseBinary));
    const problems = fuseProblems(wire);
    report.check(problems.length === 0, `fusibles: ${wire}`, problems.join('; '));
  });
}

/**
 * @param {Report} report
 * @param {Layout} layout
 * @param {string} version
 */
function checkAsar(report, layout, version) {
  const archive = path.join(layout.resources, 'app.asar');
  if (!existsSync(archive)) {
    report.fail(`app.asar absent de ${layout.resources}`);
    return;
  }
  report.guard('app.asar', () => {
    const buffer = readFileSync(archive);
    const files = listAsarFiles(readAsarHeader(buffer));
    report.check(files.includes('out/main/index.js'), 'app.asar contient out/main/index.js');
    const topLevel = [...new Set(files.map((file) => file.split('/')[0] ?? file))];
    const unexpected = topLevel.filter((entry) => !ASAR_TOP_LEVEL.has(entry));
    report.check(
      unexpected.length === 0,
      'app.asar ne contient que out/ et package.json',
      `en trop: ${unexpected.join(', ')}`,
    );
    const maps = files.filter((file) => file.endsWith('.map'));
    report.check(
      maps.length === 0,
      'app.asar sans carte de sources',
      `${maps.length} fichier(s) .map`,
    );
    for (const marker of FORBIDDEN_MARKERS) {
      report.check(
        !buffer.includes(Buffer.from(marker, 'utf8')),
        `app.asar sans le marqueur de test ${marker}`,
      );
    }
    report.info(
      `app.asar: ${files.length} fichiers, ${formatSize(buffer.length)}, version attendue ${version}`,
    );
  });
  report.check(
    !existsSync(path.join(layout.resources, 'app-update.yml')),
    'aucun app-update.yml (pas de publication par electron-builder)',
  );
  report.check(
    !existsSync(path.join(layout.resources, 'app')),
    'aucun dossier app/ à côté de app.asar',
  );
}

/**
 * @param {Report} report
 * @param {Layout} layout
 * @param {readonly { id: string, version: string }[]} games
 */
function checkGames(report, layout, games) {
  const gamesDir = path.join(layout.resources, 'games');
  for (const game of games) {
    report.guard(`jeu ${game.id}`, () => {
      const manifestFile = path.join(gamesDir, game.id, 'duo-game.json');
      /** @type {unknown} */
      const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
      if (typeof manifest !== 'object' || manifest === null) throw new Error('manifeste invalide');
      const { id, version, entry } = /** @type {Record<string, unknown>} */ (manifest);
      report.check(
        id === game.id && version === game.version,
        `jeu ${game.id} ${game.version} embarqué`,
        `manifeste: ${String(id)} ${String(version)}`,
      );
      report.check(
        typeof entry === 'string' && existsSync(path.join(gamesDir, game.id, ...entry.split('/'))),
        `jeu ${game.id}: page d'entrée présente`,
      );
      report.info(`jeu ${game.id}: ${formatSize(directorySize(path.join(gamesDir, game.id)))}`);
    });
  }
}

/**
 * @param {Report} report
 * @param {Layout} layout
 * @param {{ version: string, electronVersion: string }} expected
 */
function checkMac(report, layout, expected) {
  report.guard('Info.plist', () => {
    const plist = readPlist(
      readFileSync(path.join(layout.appRoot, 'Contents', 'Info.plist'), 'utf8'),
    );
    report.check(
      plist.get('CFBundleIdentifier') === APP_ID,
      `CFBundleIdentifier ${APP_ID}`,
      String(plist.get('CFBundleIdentifier')),
    );
    report.check(
      plist.get('CFBundleExecutable') === PRODUCT_NAME,
      `CFBundleExecutable ${PRODUCT_NAME}`,
    );
    report.check(
      plist.get('CFBundleShortVersionString') === expected.version,
      `version ${expected.version}`,
      String(plist.get('CFBundleShortVersionString')),
    );
    report.check(
      plist.get('LSMinimumSystemVersion') === '13.0',
      'LSMinimumSystemVersion 13.0',
      String(plist.get('LSMinimumSystemVersion')),
    );
    const usage = plist.get('NSLocalNetworkUsageDescription');
    report.check(
      typeof usage === 'string' && usage.startsWith('Duo '),
      'NSLocalNetworkUsageDescription en français',
      String(usage),
    );
    report.check(!plist.has('NSBonjourServices'), 'pas de NSBonjourServices');
    report.check(
      plist.has('ElectronAsarIntegrity'),
      "ElectronAsarIntegrity (empreinte de l'archive)",
    );
  });
  report.guard('exécutable principal', () => {
    const buffer = readFileSync(layout.executable);
    const { cpuType } = locateMachOUuid(buffer);
    report.check(
      cpuType === CPU_TYPES.arm64,
      'exécutable arm64',
      `processeur 0x${cpuType.toString(16)}`,
    );
    const uuid = readMachOUuid(buffer);
    const wanted = duoExecutableUuid({
      appId: APP_ID,
      electronVersion: expected.electronVersion,
      arch: 'arm64',
    });
    report.check(uuid === wanted, `UUID propre à Duo ${wanted}`, `lu: ${uuid}`);
  });
  report.guard('cadre Electron', () => {
    const { cpuType } = locateMachOUuid(readFileSync(layout.fuseBinary));
    report.check(
      cpuType === CPU_TYPES.arm64,
      'cadre Electron arm64',
      `processeur 0x${cpuType.toString(16)}`,
    );
  });
}

/**
 * @param {Report} report
 * @param {Layout} layout
 */
function checkWindows(report, layout) {
  report.guard('Duo.exe', () => {
    const buffer = readFileSync(layout.executable);
    report.check(readPeMachine(buffer) === 0x8664, 'Duo.exe est un exécutable x64');
    report.check(
      buffer.includes(Buffer.from('ELECTRONASAR', 'utf16le')),
      "ressource ELECTRONASAR (empreinte de l'archive)",
    );
    report.check(
      buffer.includes(Buffer.from('asInvoker', 'utf8')),
      'manifeste de Duo.exe: asInvoker',
    );
    report.check(
      !buffer.includes(Buffer.from('requireAdministrator', 'utf8')),
      'Duo.exe ne demande pas les droits administrateur',
    );
  });
}

/**
 * @param {Report} report
 * @param {Platform} platform
 * @param {string} dist
 */
function checkInstallers(report, platform, dist) {
  for (const name of INSTALLERS[platform]) {
    const file = path.join(dist, name);
    if (!existsSync(file)) {
      report.fail(`${name} absent de ${dist}`);
      continue;
    }
    const size = statSync(file).size;
    if (size > INSTALLER_BUDGET_BYTES)
      report.warn(`${name}: ${formatSize(size)}, au-delà du budget de 150 Mo`);
    else report.ok(`${name}: ${formatSize(size)}`);
    if (platform === 'win') {
      // Le lanceur de NSIS est un exécutable 32 bits, même pour une application x64.
      const buffer = readFileSync(file);
      for (const level of ['requireAdministrator', 'highestAvailable']) {
        report.check(
          !buffer.includes(Buffer.from(level, 'utf8')),
          `${name} ne demande pas ${level}`,
        );
      }
    }
  }
}

/**
 * @param {string} dir
 * @returns {number}
 */
function directorySize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = path.join(dir, entry.name);
    total += entry.isDirectory() ? directorySize(child) : entry.isFile() ? statSync(child).size : 0;
  }
  return total;
}

/**
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Lance tous les contrôles.
 * @param {{ platform: Platform, appRoot: string, dist: string, version: string, electronVersion: string, games: readonly { id: string, version: string }[], installers: boolean }} options
 * @returns {Report}
 */
export function verifyPackage(options) {
  const report = new Report();
  const layout = packagedLayout(options.platform, options.appRoot);
  if (!existsSync(layout.executable)) {
    report.fail(`exécutable introuvable: ${layout.executable}`);
    return report;
  }
  checkFuses(report, layout);
  checkAsar(report, layout, options.version);
  checkGames(report, layout, options.games);
  if (options.platform === 'mac') checkMac(report, layout, options);
  if (options.platform === 'win') checkWindows(report, layout);
  if (options.installers) checkInstallers(report, options.platform, options.dist);
  return report;
}

/**
 * @param {readonly string[]} argv
 * @returns {{ platform: Platform | null, app: string | null, dist: string, installers: boolean, printUuid: boolean }}
 */
function parseArguments(argv) {
  /** @type {Platform | null} */
  let platform = null;
  /** @type {string | null} */
  let app = null;
  let dist = 'dist';
  let installers = true;
  let printUuid = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (argument === '--uuid-attendu') {
      printUuid = true;
    } else if (
      argument === '--plateforme' &&
      (value === 'mac' || value === 'win' || value === 'linux')
    ) {
      platform = value;
      index += 1;
    } else if (argument === '--app' && value !== undefined) {
      app = value;
      index += 1;
    } else if (argument === '--dist' && value !== undefined) {
      dist = value;
      index += 1;
    } else if (argument === '--sans-installateurs') {
      installers = false;
    } else {
      throw new Error(`argument inconnu: ${String(argument)}`);
    }
  }
  if (platform === null && !printUuid) throw new Error('--plateforme mac, win ou linux attendu');
  return { platform, app, dist, installers, printUuid };
}

/**
 * Champ texte d'un objet lu sans garantie de forme (JSON, module importé).
 * @param {unknown} value
 * @param {string} key
 * @returns {string}
 */
function stringField(value, key) {
  if (typeof value !== 'object' || value === null) return '';
  const field = /** @type {Record<string, unknown>} */ (value)[key];
  return typeof field === 'string' ? field : '';
}

/**
 * Jeux attendus: ceux de la configuration (même liste, mêmes manifestes).
 * Import tardif: la configuration refuse de se charger si un jeu n'est pas construit.
 * @param {string} appDir dossier de l'application (apps/duo)
 * @returns {Promise<{ id: string, version: string }[]>}
 */
export async function configuredGames(appDir) {
  /** @type {unknown} */
  const module = await import(pathToFileURL(path.join(appDir, 'electron-builder.config.mjs')).href);
  const list =
    typeof module === 'object' && module !== null && 'bundledGames' in module
      ? module.bundledGames
      : null;
  if (!Array.isArray(list))
    throw new Error('electron-builder.config.mjs: export bundledGames absent');
  return list.map((/** @type {unknown} */ game) => ({
    id: stringField(game, 'id'),
    version: stringField(game, 'version'),
  }));
}

async function main() {
  const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = parseArguments(process.argv.slice(2));
  const dist = path.resolve(appDir, args.dist);
  const version = stringField(
    JSON.parse(readFileSync(path.join(appDir, 'package.json'), 'utf8')),
    'version',
  );
  const electronVersion = stringField(
    createRequire(path.join(appDir, 'package.json'))('electron/package.json'),
    'version',
  );
  if (args.printUuid) {
    // Même forme que `dwarfdump --uuid`, pour la comparaison dans le workflow macOS.
    const uuid = duoExecutableUuid({ appId: APP_ID, electronVersion, arch: 'arm64' });
    process.stdout.write(`${uuid.toUpperCase()}\n`);
    return;
  }
  if (args.platform === null) return;
  const games = await configuredGames(appDir);

  const report = verifyPackage({
    platform: args.platform,
    appRoot: args.app === null ? defaultAppRoot(args.platform, dist) : path.resolve(args.app),
    dist,
    version,
    electronVersion,
    games,
    installers: args.installers && args.app === null,
  });
  const labels = { ok: 'ok     ', echec: 'ÉCHEC  ', avertissement: 'ATTENTION', info: 'info   ' };
  for (const result of report.results) {
    process.stdout.write(`${labels[result.status]} ${result.message}\n`);
  }
  const failures = report.results.filter((result) => result.status === 'echec').length;
  process.stdout.write(
    failures === 0 ? 'Application empaquetée conforme.\n' : `${failures} contrôle(s) en échec.\n`,
  );
  if (report.failed) process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPoint)).href) {
  main().catch((/** @type {unknown} */ error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
