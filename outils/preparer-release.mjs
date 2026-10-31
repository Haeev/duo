#!/usr/bin/env node
// @ts-check
// Prépare la release GitHub de l'application (ADR 0011, section 3.7), dans le
// job « publication » de publication.yml. Sans dépendance:
//
//   node outils/preparer-release.mjs --tag v0.1.0 --fichiers <installateurs> --sortie <dossier>
//   node outils/preparer-release.mjs --tag v0.1.0 --controle-seul
//
// Contrôle que le tag égale la version de apps/duo/package.json, extrait la
// section de cette version de apps/duo/CHANGELOG.md, puis écrit dans la sortie:
// notes.md (notes de la release, en français), SHA256SUMS.txt et
// duo-version.json (fichier lu par l'avis de nouvelle version de Duo).
// `--controle-seul` s'arrête après les contrôles du tag et du CHANGELOG: le
// workflow le lance avant la fabrication, qui dure une vingtaine de minutes.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Fichiers joints à chaque release de l'application, aux noms stables (ADR 0011, 3.1). */
export const RELEASE_FILES = /** @type {const} */ ({
  mac: 'Duo-macOS.dmg',
  macZip: 'Duo-macOS.zip',
  windows: 'Duo-Windows.exe',
});

/** Systèmes minimaux d'Electron 45. */
const REQUIRES = { darwin: '13.0', win32: '10.0' };

const FORBIDDEN = [String.fromCharCode(0x2014), String.fromCharCode(0x2013)];

/**
 * Section d'une version dans un CHANGELOG au format Keep a Changelog:
 * `## [0.1.0] - 2026-10-31`, jusqu'au titre de niveau 2 suivant.
 * @param {string} markdown
 * @param {string} version
 * @returns {{ date: string, body: string } | null}
 */
export function extractChangelogSection(markdown, version) {
  const lines = markdown.split(/\r?\n/);
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`^## \\[${escaped}\\] - (\\d{4}-\\d{2}-\\d{2})\\s*$`);
  const start = lines.findIndex((line) => heading.test(line));
  if (start === -1) return null;
  const date = heading.exec(lines[start] ?? '')?.[1] ?? '';
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith('## ') || /^\[[^\]]+\]: /.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  return body === '' ? null : { date, body };
}

/**
 * Première phrase du premier paragraphe (avant les sous-titres): le résumé de l'avis M-35.
 * @param {string} body
 * @returns {string}
 */
export function firstSentence(body) {
  const paragraph = body.split(/\n\s*\n/).find((block) => !block.trimStart().startsWith('#')) ?? '';
  const text = paragraph.replace(/\s+/g, ' ').trim();
  const match = /^.*?[.!?](?=\s|$)/.exec(text);
  return match === null ? text : match[0];
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function hasForbiddenDash(text) {
  return FORBIDDEN.some((character) => text.includes(character));
}

/**
 * @typedef {{ name: string, size: number, sha256: string }} FileDigest
 */

/**
 * Lignes au format de `sha256sum` (vérifiables par `sha256sum -c` et `shasum -a 256 -c`).
 * @param {readonly FileDigest[]} files
 * @returns {string}
 */
export function formatChecksums(files) {
  return files.map((file) => `${file.sha256}  ${file.name}\n`).join('');
}

/**
 * Contenu de duo-version.json (ADR 0011, section 3.6).
 * @param {{ version: string, date: string, summary: string, repository: string, mac: FileDigest, windows: FileDigest }} input
 * @returns {object}
 */
export function buildVersionFile({ version, date, summary, repository, mac, windows }) {
  const base = `https://github.com/${repository}`;
  return {
    schema: 1,
    version,
    publishedAt: date,
    summary,
    page: `${base}/releases/tag/v${version}`,
    guide: `${base}/blob/main/docs/guides/installer-duo.md`,
    requires: REQUIRES,
    files: {
      'darwin-arm64': mac,
      'win32-x64': windows,
    },
  };
}

/**
 * Notes de la release: la section du CHANGELOG et un pied fixe pour les joueurs.
 * @param {{ version: string, body: string, repository: string }} input
 * @returns {string}
 */
export function buildNotes({ version, body, repository }) {
  const guide = `https://github.com/${repository}/blob/v${version}/docs/guides/installer-duo.md`;
  return [
    body,
    '',
    '---',
    '',
    '### Installer ou mettre à jour Duo',
    '',
    `Le guide pas à pas: ${guide}`,
    '',
    `- **Mac** (puce Apple): télécharge \`${RELEASE_FILES.mac}\`. Au premier lancement, macOS bloque Duo: ouvre Réglages Système > Confidentialité et sécurité, puis clique sur « Ouvrir quand même ».`,
    `- **PC Windows**: télécharge \`${RELEASE_FILES.windows}\`. Si Windows affiche « Windows a protégé votre ordinateur », clique sur « Informations complémentaires », puis sur « Exécuter quand même ».`,
    '',
    "Ces alertes viennent de ce que Duo n'a pas de signature payante: elles reviennent à chaque nouvelle version. Pour mettre Duo à jour, télécharge le nouvel installateur et installe-le par-dessus l'ancien: tes parties et tes réglages sont gardés.",
    '',
    `Les fichiers \`${RELEASE_FILES.macZip}\`, \`SHA256SUMS.txt\` et \`duo-version.json\` servent aux vérifications: tu n'en as pas besoin.`,
    '',
  ].join('\n');
}

/**
 * @param {string} file
 * @returns {Promise<FileDigest>}
 */
async function digest(file) {
  // Lecture d'un bloc: les installateurs restent sous 150 Mo.
  const content = await readFile(file);
  return {
    name: path.basename(file),
    size: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  };
}

/**
 * @typedef {{ tag: string, checkOnly: true } | { tag: string, checkOnly: false, files: string, output: string, repository: string }} Arguments
 */

/**
 * @param {readonly string[]} argv
 * @returns {Arguments}
 */
function parseArguments(argv) {
  /** @type {Record<string, string>} */
  const values = {};
  let checkOnly = false;
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (key === '--controle-seul') {
      checkOnly = true;
    } else if (key !== undefined && key.startsWith('--') && value !== undefined) {
      values[key.slice(2)] = value;
      index += 1;
    } else {
      throw new Error(`argument inattendu: ${String(key)}`);
    }
  }
  const { tag, fichiers, sortie } = values;
  if (tag === undefined) throw new Error('--tag vX.Y.Z attendu');
  if (checkOnly) return { tag, checkOnly };
  if (fichiers === undefined || sortie === undefined) {
    throw new Error(
      'usage: --tag vX.Y.Z --fichiers <dossier> --sortie <dossier> [--depot propriétaire/dépôt]',
    );
  }
  const repository = values.depot ?? process.env.GITHUB_REPOSITORY ?? 'Haeev/duo';
  return {
    tag,
    checkOnly,
    files: path.resolve(fichiers),
    output: path.resolve(sortie),
    repository,
  };
}

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = parseArguments(process.argv.slice(2));

  /** @type {unknown} */
  const appPackage = JSON.parse(
    readFileSync(path.join(root, 'apps', 'duo', 'package.json'), 'utf8'),
  );
  const version =
    typeof appPackage === 'object' &&
    appPackage !== null &&
    'version' in appPackage &&
    typeof appPackage.version === 'string'
      ? appPackage.version
      : null;
  if (version === null) throw new Error('apps/duo/package.json: version absente');
  if (args.tag !== `v${version}`) {
    throw new Error(
      `le tag ${args.tag} ne correspond pas à la version de l'application (v${version})`,
    );
  }

  const changelogFile = path.join(root, 'apps', 'duo', 'CHANGELOG.md');
  const section = extractChangelogSection(readFileSync(changelogFile, 'utf8'), version);
  if (section === null) {
    throw new Error(
      `apps/duo/CHANGELOG.md: aucune section « ## [${version}] - AAAA-MM-JJ » non vide`,
    );
  }
  if (hasForbiddenDash(section.body))
    throw new Error('apps/duo/CHANGELOG.md: tiret cadratin ou demi-cadratin dans les notes');
  if (args.checkOnly) {
    process.stdout.write(
      `Tag ${args.tag} conforme: version ${version} du ${section.date}, ${firstSentence(section.body)}\n`,
    );
    return;
  }

  /** @type {FileDigest[]} */
  const digests = [];
  for (const name of Object.values(RELEASE_FILES)) {
    const file = path.join(args.files, name);
    if (!existsSync(file)) throw new Error(`fichier de la release absent: ${file}`);
    digests.push(await digest(file));
  }
  const byName = new Map(digests.map((entry) => [entry.name, entry]));
  const mac = byName.get(RELEASE_FILES.mac);
  const windows = byName.get(RELEASE_FILES.windows);
  if (mac === undefined || windows === undefined) throw new Error('empreintes incomplètes');

  const summary = firstSentence(section.body);
  await mkdir(args.output, { recursive: true });
  await writeFile(
    path.join(args.output, 'notes.md'),
    buildNotes({ version, body: section.body, repository: args.repository }),
  );
  await writeFile(path.join(args.output, 'SHA256SUMS.txt'), formatChecksums(digests));
  const versionFile = buildVersionFile({
    version,
    date: section.date,
    summary,
    repository: args.repository,
    mac,
    windows,
  });
  await writeFile(
    path.join(args.output, 'duo-version.json'),
    `${JSON.stringify(versionFile, null, 2)}\n`,
  );

  process.stdout.write(`Release v${version} du ${section.date} prête: ${summary}\n`);
  for (const entry of digests)
    process.stdout.write(`  ${entry.name}: ${entry.size} octets, ${entry.sha256}\n`);
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entryPoint)).href) {
  main().catch((/** @type {unknown} */ error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
