// K1 compatibilité des deux jeux (ADR 0006, `src/reseau/compatibilite.ts`): même numéro de
// version, fabrications différentes. L'empreinte de fabrication est écrite par Vite dans le code
// du jeu (`__LPL_BUILD_FINGERPRINT__`); chez l'invité seulement, le parcours la remplace dans les
// fichiers servis (route Playwright), comme un jeu refait d'un seul côté. Attendu: le message
// clair chez les deux, la partie arrêtée avant de démarrer (plus aucun pas, ni chez l'hôte ni
// chez l'invité).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';
import { shot } from '../aides-e2e/contenu';

test.use({ viewport: { width: 320, height: 180 } });

const ROOT = join(import.meta.dirname, '../..');

/** Même calcul que `vite.config.ts` (sources, données, manifeste), pour retrouver l'empreinte. */
function buildFingerprint(): string {
  const files: string[] = [];
  for (const entry of ['src', 'donnees', 'duo-game.json']) {
    const full = join(ROOT, entry);
    if (statSync(full).isFile()) files.push(entry);
    else
      for (const item of readdirSync(full, { recursive: true, withFileTypes: true }))
        if (item.isFile())
          files.push(relative(ROOT, join(item.parentPath, item.name)).split(sep).join('/'));
  }
  const hash = createHash('sha256');
  for (const file of files.sort()) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(join(ROOT, file)));
  }
  return hash.digest('hex').slice(0, 16);
}

const ALERT = '[data-net-alert="incompatible"]';

test('K1 deux fabrications différentes sous le même numéro: message clair, partie arrêtée', async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const fingerprint = buildFingerprint();
  let rewritten = 0;
  const duo = await startDuo(browser, 'k1-compatibilite', {
    save: 'aubrune-recette',
    guestWorld: false,
    onGuestPage: (page) => {
      void page.route(
        (url) => url.pathname.includes('/jeu/') && url.pathname.endsWith('.js'),
        async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          if (body.includes(fingerprint)) rewritten += 1;
          await route.fulfill({ response, body: body.replaceAll(fingerprint, '0123456789abcdef') });
        },
      );
    },
  });
  const { host, guest } = duo;
  expect(
    rewritten,
    'empreinte trouvée dans le jeu servi (sinon: refaire `vite build`)',
  ).toBeGreaterThan(0);

  // Le message clair, chez l'invité et chez l'hôte.
  for (const side of [guest, host]) {
    const alert = side.game().locator(ALERT);
    await expect(alert, `message chez ${side.who}`).toBeVisible({ timeout: 60_000 });
    await expect(alert).toContainText('pas tout à fait les mêmes');
    await expect(alert).toContainText('relancez Duo');
  }
  await shot(guest, '1-message-invite');
  await shot(host, '1-message-hote');

  // La partie ne démarre pas à moitié: plus aucun pas chez l'hôte ni chez l'invité (l'invité a
  // pu recevoir un premier état avant le verdict; il reste figé sous le voile).
  const [h0, g0] = [(await host.world())?.tick ?? -1, (await guest.world())?.tick ?? -1];
  await host.page.waitForTimeout(6000);
  const [h1, g1] = [(await host.world())?.tick ?? -1, (await guest.world())?.tick ?? -1];
  expect(h1, 'aucun pas chez l’hôte').toBe(h0);
  expect(g1, 'aucun pas chez l’invité').toBe(g0);
  await duo.close();
});
