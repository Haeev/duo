#!/usr/bin/env node
// @ts-check
// Contrôle du dépôt (`pnpm verifier`, ADR 0002 point 5). Sans dépendance, pour
// tourner avant même `pnpm install`, sous macOS, Windows et Linux.
//
// Règles:
// - aucun tiret cadratin ni demi-cadratin dans un fichier texte (CLAUDE.md,
//   dont le grep reste la référence);
// - dans le code: aucun affichage de débogage ni point d'arrêt laissé, aucun
//   marqueur de tâche sans référence de ticket (forme attendue: `(#12)`);
// - règles de dépendance entre paquets (ADR 0002 point 3).
//
// Les motifs sont assemblés par morceaux pour que ce fichier ne se signale pas
// lui-même.

import { execFileSync } from 'node:child_process';
import { existsSync, openSync, readFileSync, readSync, closeSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * @typedef {{ file: string, line: number, column: number, rule: string, message: string }} Issue
 * @typedef {{ dir: string, name: string, dependencies: Record<string, string>, devDependencies: Record<string, string> }} WorkspacePackage
 */

const FORBIDDEN_CHARACTERS = [
  { character: '—', label: 'tiret cadratin (U+2014)' },
  { character: '–', label: 'tiret demi-cadratin (U+2013)' },
];

/** Dossiers jamais parcourus (équivalents des exclusions du grep de CLAUDE.md, plus les produits de construction). */
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'dist',
  'out',
  'coverage',
  'test-results',
  'playwright-report',
  '.pnpm-store',
  '__pycache__',
]);

const BINARY_EXTENSIONS = new Set(
  (
    'png jpg jpeg gif webp avif psd kra aseprite ase icns ico hdr exr ktx2 basis ' +
    'glb bin blend blend1 fbx ogg opus m4a mp3 wav flac aiff mid midi sf2 ' +
    'woff woff2 ttf otf zip gz tgz 7z duogame dmg exe dll so dylib node pdf pyc'
  )
    .split(' ')
    .map((extension) => `.${extension}`),
);

/** Fichiers de code JavaScript et TypeScript. */
const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

/** Fichiers où un marqueur de tâche doit porter une référence. */
const MARKER_EXTENSIONS = new Set([
  ...SCRIPT_EXTENSIONS,
  '.css',
  '.html',
  '.sh',
  '.ps1',
  '.yml',
  '.yaml',
]);

/**
 * Zones exclues des contrôles du code (pas du contrôle des tirets): sources des
 * assets et documents de conception, produits par d'autres outils.
 * @param {string} file chemin relatif, séparateurs `/`
 * @returns {boolean}
 */
export function isOutsideCodeChecks(file) {
  return (
    file.startsWith('design/') ||
    file.startsWith('docs/') ||
    file.split('/').includes('assets-src') ||
    file.endsWith('.py')
  );
}

const DEBUG_PRINT = new RegExp('\\bconsole\\s*\\.\\s*' + 'log\\b');
const BREAKPOINT = new RegExp('(?:^|[;{}])\\s*' + 'debugger\\s*(?:;|$|//)');
const TASK_MARKER = new RegExp('\\b(' + 'TO' + 'DO|FIX' + 'ME)\\b(?!\\(#\\d+\\))', 'g');

/**
 * @param {string} file chemin relatif, séparateurs `/`
 * @returns {boolean}
 */
export function isBinaryPath(file) {
  return BINARY_EXTENSIONS.has(path.extname(file).toLowerCase());
}

/**
 * Contrôle le contenu d'un fichier texte.
 * @param {string} file chemin relatif, séparateurs `/`
 * @param {string} content contenu décodé en UTF-8
 * @returns {Issue[]}
 */
export function checkText(file, content) {
  /** @type {Issue[]} */
  const issues = [];
  const extension = path.extname(file).toLowerCase();
  const checkScripts = SCRIPT_EXTENSIONS.has(extension) && !isOutsideCodeChecks(file);
  const checkMarkers = MARKER_EXTENSIONS.has(extension) && !isOutsideCodeChecks(file);
  const lines = content.split(/\r?\n/);

  lines.forEach((text, index) => {
    const line = index + 1;
    for (const { character, label } of FORBIDDEN_CHARACTERS) {
      let column = text.indexOf(character);
      while (column !== -1) {
        issues.push({
          file,
          line,
          column: column + 1,
          rule: 'tirets',
          message: `${label} interdit: remplacer par deux-points, parenthèses, virgule ou une nouvelle phrase`,
        });
        column = text.indexOf(character, column + 1);
      }
    }
    if (checkScripts) {
      const print = DEBUG_PRINT.exec(text);
      if (print) {
        issues.push({
          file,
          line,
          column: print.index + 1,
          rule: 'debogage',
          message: 'affichage de débogage laissé dans le code',
        });
      }
      const breakpoint = BREAKPOINT.exec(text);
      if (breakpoint) {
        issues.push({
          file,
          line,
          column: text.indexOf('debugger') + 1,
          rule: 'debogage',
          message: "point d'arrêt laissé dans le code",
        });
      }
    }
    if (checkMarkers) {
      for (const marker of text.matchAll(TASK_MARKER)) {
        const word = marker[1] ?? '';
        issues.push({
          file,
          line,
          column: marker.index + 1,
          rule: 'marqueurs',
          message: `${word} sans référence: écrire ${word}(#numéro du ticket)`,
        });
      }
    }
  });
  return issues;
}

/**
 * Règles de dépendance de l'ADR 0002 (point 3): un jeu ne dépend ni d'un autre
 * jeu ni de l'application; l'application ne dépend d'aucun jeu; `@duo/protocol`
 * ne dépend que de Valibot.
 * @param {WorkspacePackage[]} packages
 * @returns {Issue[]}
 */
export function checkDependencyRules(packages) {
  /** @type {Issue[]} */
  const issues = [];
  const games = new Set(packages.filter((p) => p.dir.startsWith('games/')).map((p) => p.name));
  const apps = new Set(packages.filter((p) => p.dir.startsWith('apps/')).map((p) => p.name));

  for (const workspacePackage of packages) {
    const file = `${workspacePackage.dir}/package.json`;
    const all = { ...workspacePackage.dependencies, ...workspacePackage.devDependencies };
    /** @param {string} message */
    const report = (message) => {
      issues.push({ file, line: 1, column: 1, rule: 'dependances', message });
    };
    for (const dependency of Object.keys(all)) {
      if (workspacePackage.dir.startsWith('games/')) {
        if (games.has(dependency) && dependency !== workspacePackage.name) {
          report(`un jeu ne dépend pas d'un autre jeu (${dependency}): le code partagé monte dans un paquet`);
        }
        if (apps.has(dependency)) {
          report(`un jeu ne dépend pas de l'application (${dependency})`);
        }
      }
      if (workspacePackage.dir.startsWith('apps/') && games.has(dependency)) {
        report(`l'application ne dépend d'aucun jeu (${dependency}): il est copié comme paquet signé (ADR 0010)`);
      }
    }
    if (workspacePackage.name === '@duo/protocol') {
      for (const dependency of Object.keys(workspacePackage.dependencies)) {
        if (dependency !== 'valibot') {
          report(`@duo/protocol ne dépend que de valibot (trouvé: ${dependency})`);
        }
      }
    }
  }
  return issues;
}

/**
 * Lit la liste `packages:` de `pnpm-workspace.yaml` (motifs `dossier/*` ou `dossier`).
 * @param {string} yaml
 * @returns {string[]}
 */
export function parseWorkspacePatterns(yaml) {
  /** @type {string[]} */
  const patterns = [];
  let inPackages = false;
  for (const raw of yaml.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (/^packages:\s*$/.test(line)) {
      inPackages = true;
      continue;
    }
    if (!inPackages) continue;
    const item = /^\s+-\s+['"]?([^'"]+?)['"]?\s*$/.exec(line);
    if (item?.[1]) {
      patterns.push(item[1]);
    } else if (/^\S/.test(line)) {
      inPackages = false;
    }
  }
  return patterns;
}

/**
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function asDependencyMap(value) {
  if (typeof value !== 'object' || value === null) return {};
  /** @type {Record<string, string>} */
  const map = {};
  for (const [name, version] of Object.entries(value)) {
    if (typeof version === 'string') map[name] = version;
  }
  return map;
}

/**
 * @param {string} root
 * @returns {WorkspacePackage[]}
 */
function readWorkspacePackages(root) {
  const workspaceFile = path.join(root, 'pnpm-workspace.yaml');
  if (!existsSync(workspaceFile)) return [];
  /** @type {WorkspacePackage[]} */
  const packages = [];
  for (const pattern of parseWorkspacePatterns(readFileSync(workspaceFile, 'utf8'))) {
    /** @type {string[]} */
    let dirs = [];
    if (pattern.endsWith('/*')) {
      const parent = pattern.slice(0, -2);
      const parentPath = path.join(root, ...parent.split('/'));
      if (!existsSync(parentPath)) continue;
      dirs = readdirSync(parentPath, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => `${parent}/${entry.name}`);
    } else {
      dirs = [pattern];
    }
    for (const dir of dirs) {
      const manifestPath = path.join(root, ...dir.split('/'), 'package.json');
      if (!existsSync(manifestPath)) continue;
      /** @type {unknown} */
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (typeof manifest !== 'object' || manifest === null) continue;
      const name = 'name' in manifest && typeof manifest.name === 'string' ? manifest.name : dir;
      packages.push({
        dir,
        name,
        dependencies: asDependencyMap('dependencies' in manifest ? manifest.dependencies : undefined),
        devDependencies: asDependencyMap(
          'devDependencies' in manifest ? manifest.devDependencies : undefined,
        ),
      });
    }
  }
  return packages;
}

/**
 * Fichiers du dépôt: suivis ou nouveaux, hors fichiers ignorés par Git. Sans
 * Git (archive des sources), parcours du dossier.
 * @param {string} root
 * @returns {string[]} chemins relatifs, séparateurs `/`
 */
export function listRepositoryFiles(root) {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const files = new Set(output.split('\0').filter((file) => file !== ''));
    return [...files].filter(
      (file) =>
        !file.split('/').some((segment) => SKIPPED_DIRECTORIES.has(segment)) &&
        existsSync(path.join(root, ...file.split('/'))),
    );
  } catch {
    return walk(root, '');
  }
}

/**
 * @param {string} root
 * @param {string} relative
 * @returns {string[]}
 */
function walk(root, relative) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(path.join(root, ...relative.split('/').filter(Boolean)), {
    withFileTypes: true,
  })) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...walk(root, child));
    } else if (entry.isFile()) {
      files.push(child);
    }
  }
  return files;
}

/**
 * Même règle que `grep -I`: un octet nul dans les 8 premiers Ko signale un binaire.
 * @param {string} absolutePath
 * @returns {boolean}
 */
function looksBinary(absolutePath) {
  const buffer = Buffer.alloc(8192);
  const descriptor = openSync(absolutePath, 'r');
  try {
    const length = readSync(descriptor, buffer, 0, buffer.length, 0);
    return buffer.subarray(0, length).includes(0);
  } finally {
    closeSync(descriptor);
  }
}

/**
 * Lance tous les contrôles sur un dépôt.
 * @param {string} root
 * @returns {{ issues: Issue[], fileCount: number }}
 */
export function verifyRepository(root) {
  /** @type {Issue[]} */
  const issues = [];
  let fileCount = 0;
  for (const file of listRepositoryFiles(root)) {
    if (isBinaryPath(file)) continue;
    const absolutePath = path.join(root, ...file.split('/'));
    if (!statSync(absolutePath).isFile() || looksBinary(absolutePath)) continue;
    fileCount += 1;
    issues.push(...checkText(file, readFileSync(absolutePath, 'utf8')));
  }
  issues.push(...checkDependencyRules(readWorkspacePackages(root)));
  return { issues, fileCount };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { issues, fileCount } = verifyRepository(root);
  if (issues.length === 0) {
    process.stdout.write(`Contrôle du dépôt: ${fileCount} fichiers texte lus, aucun problème.\n`);
    return;
  }
  for (const issue of issues) {
    process.stderr.write(`${issue.file}:${issue.line}:${issue.column} [${issue.rule}] ${issue.message}\n`);
  }
  process.stderr.write(
    `Contrôle du dépôt: ${issues.length} problème${issues.length > 1 ? 's' : ''} dans ${fileCount} fichiers texte lus.\n`,
  );
  process.exitCode = 1;
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPoint)).href) {
  main();
}
