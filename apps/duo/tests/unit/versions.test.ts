import { describe, expect, it } from 'vitest';
import type { AppUpdateView } from '../../src/shared/app-update';
import type { Journal } from '../../src/main/journal';
import {
  AppVersionChecker,
  compareSemver,
  compareSystemVersions,
  evaluateVersionFile,
  parseVersionFile,
  type FetchLike,
  type MachineContext,
  type VersionFile,
} from '../../src/main/versions';

interface FileDigest {
  name: string;
  size: number;
  sha256: string;
}
/** Fonctions de l'outil de publication (JavaScript avec JSDoc, sans déclarations pour ce programme). */
interface ReleaseTool {
  readonly buildVersionFile: (input: {
    version: string;
    date: string;
    summary: string;
    repository: string;
    mac: FileDigest;
    windows: FileDigest;
  }) => object;
  readonly firstSentence: (body: string) => string;
  readonly extractChangelogSection: (
    markdown: string,
    version: string,
  ) => { date: string; body: string } | null;
}
// Adresse calculée: le contrat est celui du vrai fichier écrit par la publication.
const TOOL_URL = new URL('../../../../outils/preparer-release.mjs', import.meta.url).href;
const { buildVersionFile, firstSentence, extractChangelogSection } = (await import(
  TOOL_URL
)) as ReleaseTool;

const journal: Journal = { write: () => undefined, flush: () => Promise.resolve() };
const SHA = 'a'.repeat(64);

const MAC: MachineContext = {
  appVersion: '0.3.0',
  platform: 'darwin',
  arch: 'arm64',
  systemVersion: '14.6.1',
};
const PC: MachineContext = {
  appVersion: '0.3.0',
  platform: 'win32',
  arch: 'x64',
  systemVersion: '10.0.22631',
};

/** Fichier tel que l'écrit la publication (outils/preparer-release.mjs). */
function published(version: string): Record<string, unknown> {
  return buildVersionFile({
    version,
    date: '2026-11-11',
    summary: 'Duo prévient quand une nouvelle version est prête.',
    repository: 'Haeev/duo',
    mac: { name: 'Duo-macOS.dmg', size: 120_000_000, sha256: SHA },
    windows: { name: 'Duo-Windows.exe', size: 90_000_000, sha256: SHA },
  }) as Record<string, unknown>;
}

function parsed(raw: unknown): VersionFile {
  const check = parseVersionFile(raw);
  if (!check.ok) throw new Error(check.reason);
  return check.file;
}

describe('compareSemver', () => {
  it('ordonne les versions numériquement', () => {
    expect(compareSemver('0.4.0', '0.3.1')).toBeGreaterThan(0);
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.3.0', '0.4.0')).toBeLessThan(0);
  });
  it('place une préversion avant sa version', () => {
    expect(compareSemver('1.0.0-rc.1', '1.0.0')).toBeLessThan(0);
    expect(compareSemver('1.0.0-rc.2', '1.0.0-rc.10')).toBeLessThan(0);
    expect(compareSemver('1.0.0-alpha', '1.0.0-alpha.1')).toBeLessThan(0);
    expect(compareSemver('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0);
  });
  it('refuse une version illisible', () => {
    expect(compareSemver('0.4', '0.3.0')).toBeNull();
    expect(compareSemver('v0.4.0', '0.3.0')).toBeNull();
  });
  it('compare les versions de système champ à champ', () => {
    expect(compareSystemVersions('12.7.6', '13.0')).toBeLessThan(0);
    expect(compareSystemVersions('13.0.1', '13.0')).toBeGreaterThan(0);
    expect(compareSystemVersions('10.0.22631', '10.0')).toBeGreaterThan(0);
  });
});

describe('fichier de version', () => {
  it('accepte le fichier produit par la publication', () => {
    expect(parseVersionFile(published('0.4.0')).ok).toBe(true);
  });
  it.each([
    ['schéma inconnu', { ...published('0.4.0'), schema: 2 }],
    ['version illisible', { ...published('0.4.0'), version: 'quatre' }],
    ['résumé vide', { ...published('0.4.0'), summary: '  ' }],
    ['page hors du dépôt', { ...published('0.4.0'), page: 'https://exemple.com/duo' }],
    [
      'nom de fichier inattendu',
      {
        ...published('0.4.0'),
        files: { 'darwin-arm64': { name: '../Duo.dmg', size: 1, sha256: SHA } },
      },
    ],
    ['pas un objet', 'Duo 0.4.0'],
    ['null', null],
  ])('écarte un fichier invalide (%s)', (_label, raw) => {
    expect(parseVersionFile(raw).ok).toBe(false);
  });
});

describe('evaluateVersionFile', () => {
  it('annonce une version plus récente avec l’installateur du Mac', () => {
    const result = evaluateVersionFile(parsed(published('0.4.0')), MAC);
    expect(result).toEqual({
      kind: 'notice',
      notice: {
        view: {
          kind: 'download',
          version: '0.4.0',
          summary: 'Duo prévient quand une nouvelle version est prête.',
          file: 'Duo-macOS.dmg',
        },
        url: 'https://github.com/Haeev/duo/releases/download/v0.4.0/Duo-macOS.dmg',
      },
    });
  });
  it('donne au PC le lien de Duo-Windows.exe', () => {
    const result = evaluateVersionFile(parsed(published('0.4.0')), PC);
    expect(result.kind === 'notice' ? result.notice.url : null).toBe(
      'https://github.com/Haeev/duo/releases/download/v0.4.0/Duo-Windows.exe',
    );
  });
  it('se tait quand la version est la même ou plus ancienne', () => {
    expect(evaluateVersionFile(parsed(published('0.3.0')), MAC).kind).toBe('none');
    expect(evaluateVersionFile(parsed(published('0.2.1')), MAC).kind).toBe('none');
  });
  it('ignore une préversion, même plus récente', () => {
    expect(evaluateVersionFile(parsed(published('0.5.0-rc.1')), MAC)).toEqual({
      kind: 'none',
      reason: 'prerelease',
    });
  });
  it('annonce la version finale à une préversion installée', () => {
    const result = evaluateVersionFile(parsed(published('1.0.0')), {
      ...MAC,
      appVersion: '1.0.0-rc.2',
    });
    expect(result.kind).toBe('notice');
  });
  it('dit quand le système est trop ancien, sans lien', () => {
    const result = evaluateVersionFile(parsed(published('0.4.0')), {
      ...MAC,
      systemVersion: '12.7.6',
    });
    expect(result).toMatchObject({
      kind: 'notice',
      notice: { view: { kind: 'unsupported', system: 'macOS', minimum: '13.0' }, url: null },
    });
  });
  it('renvoie à la page de la release sans installateur pour ce système', () => {
    const result = evaluateVersionFile(parsed(published('0.4.0')), {
      ...MAC,
      platform: 'linux',
      arch: 'x64',
    });
    expect(result).toMatchObject({
      kind: 'notice',
      notice: {
        view: { kind: 'page' },
        url: 'https://github.com/Haeev/duo/releases/tag/v0.4.0',
      },
    });
  });
});

describe('AppVersionChecker', () => {
  function setup(fetch: FetchLike, machine: MachineContext = MAC) {
    const views: (AppUpdateView | null)[] = [];
    const checker = new AppVersionChecker({
      url: 'https://github.com/Haeev/duo/releases/latest/download/duo-version.json',
      fetch,
      machine,
      journal,
      onChange: (view) => views.push(view),
      config: { timeoutMs: 50, intervalMs: 60_000, maxBytes: 64 * 1024 },
    });
    return { checker, views };
  }
  const serve =
    (body: unknown, status = 200): FetchLike =>
    () =>
      Promise.resolve(
        new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
      );

  it('montre l’avis puis le met de côté avec « Plus tard » jusqu’au prochain lancement', async () => {
    const { checker, views } = setup(serve(published('0.4.0')));
    await checker.check();
    expect(views.at(-1)).toMatchObject({ kind: 'download', version: '0.4.0' });
    expect(checker.downloadUrl()).toContain('/v0.4.0/Duo-macOS.dmg');
    checker.later();
    expect(views.at(-1)).toBeNull();
    expect(checker.downloadUrl()).toBeNull();
    await checker.check();
    expect(views.at(-1)).toBeNull();
  });

  it('revient après « Plus tard » si une version plus récente encore paraît', async () => {
    let version = '0.4.0';
    const { checker, views } = setup(() =>
      Promise.resolve(new Response(JSON.stringify(published(version)))),
    );
    await checker.check();
    checker.later();
    version = '0.4.1';
    await checker.check();
    expect(views.at(-1)).toMatchObject({ version: '0.4.1' });
  });

  it('ne montre rien hors ligne, ni après un délai dépassé', async () => {
    const offline = setup(() => Promise.reject(new TypeError('net::ERR_INTERNET_DISCONNECTED')));
    await offline.checker.check();
    expect(offline.views).toEqual([]);
    const slow = setup(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new Error('délai dépassé'));
          });
        }),
    );
    await slow.checker.check();
    expect(slow.views).toEqual([]);
  });

  it('ne montre rien si le fichier est absent ou invalide', async () => {
    for (const fetch of [
      serve('Not Found', 404),
      serve('{ pas du JSON'),
      serve({ ...published('0.4.0'), schema: 9 }),
      serve('x'.repeat(70 * 1024)),
    ]) {
      const { checker, views } = setup(fetch);
      await checker.check();
      expect(views).toEqual([]);
    }
  });

  it('ignore une préversion publiée', async () => {
    const { checker, views } = setup(serve(published('0.5.0-rc.1')));
    await checker.check();
    expect(views).toEqual([null]);
  });
});

describe('notes de la 0.4.0', () => {
  it('la première phrase du CHANGELOG devient le résumé de l’avis', async () => {
    const { readFile } = await import('node:fs/promises');
    const changelog = await readFile(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
    const { version } = JSON.parse(
      await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    const section = extractChangelogSection(changelog, version);
    expect(section).not.toBeNull();
    const summary = firstSentence(section?.body ?? '');
    const file = parsed(
      buildVersionFile({
        version,
        date: section?.date ?? '',
        summary,
        repository: 'Haeev/duo',
        mac: { name: 'Duo-macOS.dmg', size: 1, sha256: SHA },
        windows: { name: 'Duo-Windows.exe', size: 1, sha256: SHA },
      }),
    );
    expect(file.summary).toBe(summary);
    expect(summary.length).toBeLessThanOrEqual(400);
    expect(evaluateVersionFile(file, MAC).kind).toBe('notice');
  });
});
