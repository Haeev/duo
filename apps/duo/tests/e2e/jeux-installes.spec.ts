// Mise à jour d'un jeu sans réinstaller Duo (ADR 0010), de bout en bout sur
// l'application réelle (version de test): paquets fabriqués par l'outil de la
// CI avec la clé de test, faux catalogue servi en local. Au démarrage, Duo
// installe le jeu du catalogue; un import de la même version est refusé; une
// version plus récente publiée ensuite est installée, avec sa notification.
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import {
  APP_DIR,
  FIXTURE_GAMES,
  SCREENSHOTS,
  closeDuo,
  launchDuo,
  seedProfile,
  tempDataDir,
} from './duo';

const REPO = path.resolve(APP_DIR, '..', '..');

interface Built {
  readonly fichier: string;
  readonly taille: number;
  readonly sha256: string;
  readonly manifeste: Record<string, unknown>;
}

/** Paquet signé par la clé de test, fabriqué par `outils/paquet-jeu.mjs` (contrat de la CI). */
async function buildPackage(work: string, version: string): Promise<Built> {
  const game = path.join(work, `jeu ${version}`, 'essai-pont');
  await cp(path.join(FIXTURE_GAMES, 'essai-pont'), path.join(game, 'dist'), { recursive: true });
  // Disposition d'un jeu du dépôt: manifeste à la racine du paquet, site construit dans dist/.
  const manifest = JSON.parse(
    await readFile(path.join(game, 'dist', 'duo-game.json'), 'utf8'),
  ) as object;
  await rm(path.join(game, 'dist', 'duo-game.json'));
  await writeFile(path.join(game, 'duo-game.json'), JSON.stringify({ ...manifest, version }));
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [path.join(REPO, 'outils', 'paquet-jeu.mjs'), game, '--sortie', path.join(work, 'sortie')],
    {
      env: {
        ...process.env,
        DUO_CLE_PAQUETS: await readFile(
          path.join(REPO, 'packages', 'paquet', 'cle-test', 'duo-test.pem'),
          'utf8',
        ),
        DUO_CLE_PAQUETS_ID: 'duo-test',
      },
    },
  );
  return JSON.parse(stdout) as Built;
}

test('Duo installe un jeu du catalogue, puis sa mise à jour, sans réinstallation', async () => {
  const work = await mkdtemp(path.join(tmpdir(), 'duo paquets é '));
  const v1 = await buildPackage(work, '1.0.0');
  const v2 = await buildPackage(work, '1.1.0');
  const published: Built[] = [v1];
  const server = createServer((request, response) => {
    const name = decodeURIComponent((request.url ?? '').slice(1));
    if (name === 'catalogue.json') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          schema: 1,
          jeux: published.map((built) => ({
            id: 'essai-pont',
            version: path.basename(built.fichier).replace(/^essai-pont-|\.duogame$/g, ''),
            manifeste: built.manifeste,
            taille: built.taille,
            url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/${path.basename(built.fichier)}`,
            sha256: built.sha256,
          })),
        }),
      );
      return;
    }
    const built = [v1, v2].find((candidate) => path.basename(candidate.fichier) === name);
    if (built === undefined) {
      response.statusCode = 404;
      response.end();
      return;
    }
    void readFile(built.fichier).then((bytes) => response.end(bytes));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.DUO_TEST_CATALOGUE_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}/catalogue.json`;
  process.env.DUO_TEST_FICHIER_JEU = v1.fichier;

  const dataDir = await tempDataDir('paquets');
  await seedProfile(dataDir, 'Hélène', 'sun');
  const duo = await launchDuo({ dataDir, port: 41290 });
  try {
    const { platform } = duo;
    await expect(platform.getByTestId('ecran-accueil')).toBeVisible();
    // Recherche lancée une fois le lanceur affiché: nouveau jeu installé tout seul.
    const notification = platform.getByTestId('notification');
    await expect(notification.filter({ hasText: 'Nouveau jeu' })).toContainText(
      'Essai du pont est dans la bibliothèque.',
    );
    await platform.getByTestId('onglet-bibliotheque').click();
    await expect(platform.getByTestId('jeu-essai-pont')).toBeVisible();

    // Import du même paquet: refusé (jamais de version égale ou plus ancienne).
    await platform.getByTestId('installer-fichier').click();
    await expect(notification.filter({ hasText: 'Tu as déjà' })).toContainText('version 1.0.0');

    // Version plus récente publiée: la recherche suivante (toutes les 6 h) l'installe.
    published.push(v2);
    await duo.app.evaluate(async () => {
      await (
        globalThis as unknown as { __duoTest: { checkGames: () => Promise<unknown> } }
      ).__duoTest.checkGames();
    });
    await expect(notification.filter({ hasText: 'mise à jour installée' })).toContainText(
      'Essai du pont',
    );
    await expect(notification.filter({ hasText: 'mise à jour installée' })).toContainText(
      '(version 1.1.0).',
    );
    await platform.screenshot({ path: path.join(SCREENSHOTS, 'jeux-mise-a-jour.png') });

    const pointer = JSON.parse(
      await readFile(path.join(dataDir, 'games', 'essai-pont', 'current.json'), 'utf8'),
    ) as { version: string };
    expect(pointer.version).toBe('1.1.0');
    // Vignette servie par duo-game:// depuis le dossier de la nouvelle version.
    await expect
      .poll(() =>
        platform.evaluate(
          () =>
            document.querySelector<HTMLImageElement>('[data-testid="jeu-essai-pont"] img')
              ?.naturalWidth ?? 0,
        ),
      )
      .toBeGreaterThan(0);
  } finally {
    await closeDuo(duo);
    server.close();
    delete process.env.DUO_TEST_CATALOGUE_URL;
    delete process.env.DUO_TEST_FICHIER_JEU;
  }
});
