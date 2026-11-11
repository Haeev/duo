// Défauts de la recette du jalon 1, retournés après correction: D2 (la buvette de la cheffe de gare
// reste ouvrable après son dialogue de quête, par le comptoir tenu) et D3 (personne collé au joueur au point d'arrivée; relevé
// des distances dans mesures.txt).
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, startDuo, type Duo } from '../aides-e2e/duo';

const GUICHET = { x: 20, y: 15 };
const COMPTOIR = { x: 23, y: 15 };

/** Parle à la cheffe de gare et lit les pages jusqu'à la fin (choix: premier). */
async function talkToChief(duo: Duo, label: string): Promise<string[]> {
  const { host } = duo;
  const hi = await host.local();
  await duo.teleport(hi, GUICHET.x, GUICHET.y + 1, -Math.PI / 2);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toBe('cheffe-de-gare');
  await host.press('Space');
  const box = host.game().locator('.lpl-ui .dialogue');
  await expect(box).toBeVisible();
  const pages: string[] = [];
  const choices = host.game().locator('.lpl-ui .choice');
  for (let i = 0; i < 14 && (await box.isVisible()); i++) {
    await host.page.waitForTimeout(1300);
    pages.push((await box.innerText()).replace(/\s+/g, ' ').trim());
    if (i === 0) await host.shot(`${label}-1-premiere-page`);
    if (await choices.first().isVisible()) {
      await host.shot(`${label}-2-choix`);
      pages.push(`CHOIX: ${(await choices.allInnerTexts()).join(' / ').replace(/\s+/g, ' ')}`);
      await host.press('Enter');
    } else await host.press('Space');
  }
  return pages;
}

test('D2 la boutique de la gare s’ouvre au comptoir, après le dialogue de quête de la cheffe', async ({
  browser,
}) => {
  const duo = await startDuo(browser, 'd2-boutique');
  const { host } = duo;
  const hi = await host.local();
  // 1re conversation: l'accueil donne la besace, ce qui démarre la quête « sonnerie ».
  const first = await talkToChief(duo, 'a');
  expect(first.join('|')).toContain('Bienvenue');
  await duo.until(host, 'besace', (w) => w.players[hi]?.bag !== null);
  await host.page.waitForTimeout(2000);
  // 2e conversation: le dialogue de quête (la sonnerie) passe, sans offre de boutique derrière lui
  // (une réplique d'histoire ou de quête ne débouche jamais sur la boutique). Une fois cette
  // réplique entendue, la touche d'action sur le comptoir tenu ouvre la buvette.
  const second = await talkToChief(duo, 'b');
  const text = second.join('|');
  expect(text, 'le dialogue de quête passe d’abord').toContain('sonner');
  expect(text, 'pas d’offre de boutique derrière une réplique de quête').not.toContain(
    'Je regarde ta buvette.',
  );
  await duo.teleport(hi, COMPTOIR.x - 1.3, COMPTOIR.y, 0);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toBe('comptoir-buvette');
  await host.press('Space');
  const shop = host.game().locator('.lpl-ui .shop');
  await expect(shop).toBeVisible();
  await host.page.waitForTimeout(800);
  await host.shot('c-boutique-par-la-cheffe');
  await duo.close();
});

test('D3 aucun habitant d’Aubrune collé aux joueurs sur le quai (relevé)', async ({ browser }) => {
  const duo = await startDuo(browser, 'd3-habitant-colle', { save: 'aubrune-apres-scene' });
  const { host } = duo;
  const hi = await host.local();
  await duo.until(host, 'scène finie', (w) => (w.common.story?.scene ?? null) === null);
  const lines: string[] = [];
  const near = async (label: string): Promise<void> => {
    const w = await host.world();
    const me = w?.players[hi];
    if (w === null || me === undefined) return;
    const villagers = Object.entries(w.places.aubrune?.villagers ?? {})
      .map(([id, v]) => ({ id, d: Math.hypot(v.body.x - me.body.x, v.body.y - me.body.y) }))
      .filter((v) => v.d < 3)
      .map((v) => `${v.id} ${v.d.toFixed(2)} m`);
    lines.push(
      `${label}: joueur (${me.body.x.toFixed(1)}; ${me.body.y.toFixed(1)}) ${villagers.join(', ') || 'personne à moins de 3 m'}`,
    );
  };
  await near('départ');
  await host.shot('1-depart');
  // Dix secondes immobile, puis quelques pas vers l'ouest, relevés chaque seconde.
  for (let i = 0; i < 6; i++) {
    await host.page.waitForTimeout(1500);
    await near(`immobile ${i}`);
  }
  await host.shot('2-immobile');
  // D3 corrigé: personne ne stationne contre le joueur au point d'arrivée.
  const still = await host.world();
  const me = still?.players[hi];
  const closest = Math.min(
    ...Object.values(still?.places.aubrune?.villagers ?? {}).map((v) =>
      me === undefined ? Infinity : Math.hypot(v.body.x - me.body.x, v.body.y - me.body.y),
    ),
  );
  expect(closest, 'D3: aucun habitant collé au joueur sur le quai').toBeGreaterThan(1.3);
  for (let i = 0; i < 6; i++) {
    await host.press('KeyA', 800);
    await host.page.waitForTimeout(700);
    await near(`marche ${i}`);
  }
  await host.shot('3-apres-marche');
  appendFileSync(join(CAPTURES, 'mesures.txt'), `D3 relevé:\n${lines.join('\n')}\n`);
  await duo.close();
});
