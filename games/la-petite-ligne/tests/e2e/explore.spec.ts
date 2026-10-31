import { test } from '@playwright/test';
import { startDuo } from './sonde';
const S = '/tmp/claude-0/-home-user-duo/b3ee61bc-3861-5260-aa93-3be311a5b80d/scratchpad/shots';
test('exploration', async ({ browser }) => {
  const duo = await startDuo(browser);
  const { hostGame, guestGame, probe } = duo;
  await hostGame.getByRole('button', { name: 'Commencer la semaine' }).click();
  await guestGame.getByRole('button', { name: 'Commencer la semaine' }).click();
  await duo.host.waitForTimeout(2500);
  await duo.host.screenshot({ path: `${S}/x-hote-creation.png` });
  console.log(await hostGame.locator('body').ariaSnapshot());
  const w = probe.world();
  console.log(JSON.stringify({ phase: w?.phase, clock: w?.clock, chars: w?.characters.map((c) => ({ n: c.name, t: c.titleReady, cr: c.created })) }));
  await duo.close();
});
