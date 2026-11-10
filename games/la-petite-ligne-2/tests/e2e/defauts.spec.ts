// Défauts signalés à confirmer (rapport de recette, D2 et D3). D2 constate le défaut: il passe
// tant que le défaut existe et devra être retourné à la correction. D3 est un relevé (mesures.txt).
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

test('D2 la boutique de la gare s’ouvre par la cheffe de gare, pas seulement par le comptoir', async ({
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
  // 2e conversation: attendu, l'accueil « Alors, cette besace ? » avec « Je regarde ta buvette ».
  const second = await talkToChief(duo, 'b');
  const text = second.join('|');
  expect(text, 'D2: le dialogue de quête passe avant l’accueil').toContain('sonner');
  expect(text, 'D2: aucune entrée vers la buvette').not.toContain('buvette');
  expect(await host.game().locator('.lpl-ui .boutique, .lpl-ui .shop').count()).toBe(0);
  // Par le comptoir, la boutique s'ouvre.
  await duo.teleport(hi, COMPTOIR.x - 1.5, COMPTOIR.y, 0);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toBe('comptoir-buvette');
  await host.press('Space');
  await host.page.waitForTimeout(1500);
  await host.shot('c-comptoir');
  await duo.close();
});

test('D3 relevé: les habitants d’Aubrune autour des joueurs sur le quai', async ({ browser }) => {
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
  for (let i = 0; i < 6; i++) {
    await host.press('KeyA', 800);
    await host.page.waitForTimeout(700);
    await near(`marche ${i}`);
  }
  await host.shot('3-apres-marche');
  appendFileSync(join(CAPTURES, 'mesures.txt'), `D3 relevé:\n${lines.join('\n')}\n`);
  await duo.close();
});
