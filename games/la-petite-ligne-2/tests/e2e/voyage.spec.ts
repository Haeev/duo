// P04 voyage aller et retour regardé à l'écran (CA-01, CA-02) et mesure du chargement d'un lieu.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { BOARDING, CAPTURES, startDuo, type Duo, type ProbeWorld } from '../aides-e2e/duo';

/** Ce qui doit survivre au voyage (CA-02), par joueur. */
function kept(w: ProbeWorld): string {
  return JSON.stringify({
    chest: w.common.chest,
    players: w.players.map((p) => ({ money: p.money, toolbar: p.toolbar, bag: p.bag })),
  });
}

async function travel(
  duo: Duo,
  from: string,
  to: string,
  label: string,
  skip = false,
): Promise<number> {
  const { host, guest } = duo;
  const [hi, gi] = [await host.local(), await guest.local()];
  const { stand, facing } = BOARDING[from] ?? { stand: [], facing: 0 };
  await duo.teleport(hi, stand[0]?.x ?? 0, stand[0]?.y ?? 0, facing);
  await duo.teleport(gi, stand[1]?.x ?? 0, stand[1]?.y ?? 0, facing);
  await host.page.waitForTimeout(800);
  // CA-01: un seul joueur monte, le train ne part pas.
  await host.press('Space');
  await host.page.waitForTimeout(3000);
  const alone = await host.world();
  expect(alone?.common.place, `${label}: un seul joueur monté, on reste`).toBe(from);
  expect(alone?.common.phase, `${label}: pas de voyage à un seul`).not.toBe('travel');
  await host.shot(`${label}-1-un-seul-monte`);
  await guest.press('Space');
  const start = Date.now();
  await duo.until(host, `${label}: départ`, (w) => w.common.phase === 'travel', 15_000);
  await host.page.waitForTimeout(500);
  await host.shot(`${label}-2-wagon`);
  await guest.shot(`${label}-2-wagon`);
  // Le trajet (10 s) se passe à deux: chacun vote à la touche d'action.
  if (skip) {
    await host.press('Space');
    await guest.press('Space');
  }
  try {
    await duo.until(
      host,
      `${label}: arrivée hôte`,
      (w) => w.common.place === to && w.common.phase !== 'travel',
      70_000,
    );
  } catch (error) {
    const w = await host.world();
    const placed = await Promise.all(
      [host, guest].map((s) =>
        s
          .game()
          .evaluate(
            () =>
              (
                window as unknown as { __lplSonde?: { placeId(): string | null } }
              ).__lplSonde?.placeId() ?? null,
          ),
      ),
    );
    await host.shot(`${label}-x-bloque`);
    await guest.shot(`${label}-x-bloque`);
    throw new Error(
      `${String(error)}; travel ${JSON.stringify(w?.common.travel)}; lieu construit hôte ${placed[0]}, invité ${placed[1]}`,
      { cause: error },
    );
  }
  await duo.until(
    guest,
    `${label}: arrivée invité`,
    (w) => w.common.place === to && w.common.phase !== 'travel',
    15_000,
  );
  const seconds = (Date.now() - start) / 1000;
  await host.page.waitForTimeout(1500);
  await host.shot(`${label}-3-arrivee`);
  await guest.shot(`${label}-3-arrivee`);
  return seconds;
}

test('voyage aller et retour à deux', async ({ browser }) => {
  const duo = await startDuo(browser, 'p04-voyage');
  const start = await duo.host.world();
  if (start === null) throw new Error('monde absent');
  const aller = await travel(duo, 'essai-gare', 'essai-halte', 'aller');
  // Le retour se passe à deux (vote): il arrive avant la fin des 10 s du trajet.
  const retour = await travel(duo, 'essai-halte', 'essai-gare', 'retour', true);
  expect(retour, 'trajet passé à deux plus court qu’à l’aller').toBeLessThan(aller);
  const back = await duo.host.world();
  if (back === null) throw new Error('monde absent');
  expect(kept(back), 'CA-02: sacs, bourses, coffre identiques').toBe(kept(start));
  appendFileSync(
    join(CAPTURES, 'mesures.txt'),
    `voyage: aller ${aller.toFixed(1)} s, retour ${retour.toFixed(1)} s (appui du second joueur jusqu'à l'arrivée vue par les deux)\n`,
  );
  expect(duo.errors).toEqual([]);
  await duo.close();
});
