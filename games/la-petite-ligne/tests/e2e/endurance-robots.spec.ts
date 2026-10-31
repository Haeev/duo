// Endurance à deux navigateurs (qa-testeur, 2026-10-31): les robots du jeu jouent chez l'hôte et chez
// l'invité, reliés par le faux hôte, pendant de longues minutes. On relève les erreurs et les
// avertissements de la console, les arrêts de la plateforme, les écarts entre les deux écrans
// (jour, heure, bourse), les tâches longues, le tas JavaScript, et une capture à chaque matin.
//
// Le robot n'existe qu'en développement (`import.meta.env.DEV`): construire le jeu ainsi, puis
//   NODE_ENV=development pnpm --filter @duo/la-petite-ligne exec vite build --outDir <dossier>/dist
//   LPL_E2E_JEU=<dossier> LPL_E2E_ENDURANCE_MIN=40 pnpm --filter @duo/la-petite-ligne test:e2e endurance
// (<dossier> contient aussi une copie de duo-game.json et de package.json). Sans
// LPL_E2E_ENDURANCE_MIN, le test est sauté.
import { writeFileSync } from 'node:fs';
import { expect, test, type FrameLocator } from '@playwright/test';
import { heapUsed, longTasks, startDuo } from './sonde';

const MINUTES = Number(process.env.LPL_E2E_ENDURANCE_MIN ?? 0);
/** Intervalle entre deux relevés. */
const SAMPLE_MS = 15_000;
/** Intervalle entre deux mesures du tas. */
const HEAP_EVERY_MS = 5 * 60_000;

interface Hud {
  day: number | null;
  minutes: number | null;
  purse: number | null;
}

interface Sample {
  t: number;
  host: Hud;
  guest: Hud;
  world: { phase: string; day: number; minutes: number; purse: number; tick: number } | null;
}

async function readHud(game: FrameLocator): Promise<Hud> {
  const text = async (selector: string): Promise<string | null> =>
    game
      .locator(selector)
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);
  const [day, time, purse] = await Promise.all([text('.lpl-clock__day'), text('.lpl-clock__time'), text('.lpl-purse__amount')]);
  const dayMatch = day === null ? null : /jour\s+(\d+)/.exec(day);
  const timeMatch = time === null ? null : /(\d+)\s*h\s*(\d+)/.exec(time);
  const purseDigits = purse === null ? '' : purse.replace(/\D/g, '');
  return {
    day: dayMatch?.[1] === undefined ? null : Number(dayMatch[1]),
    minutes: timeMatch?.[1] === undefined || timeMatch[2] === undefined ? null : Number(timeMatch[1]) * 60 + Number(timeMatch[2]),
    purse: purseDigits === '' ? null : Number(purseDigits),
  };
}

function countByText(lines: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of lines) out[line.slice(0, 200)] = (out[line.slice(0, 200)] ?? 0) + 1;
  return out;
}

test('endurance à deux navigateurs: les robots jouent chez l’hôte et chez l’invité', async ({ browser }, testInfo) => {
  test.skip(MINUTES <= 0, 'endurance longue: LPL_E2E_ENDURANCE_MIN et une construction de développement (LPL_E2E_JEU)');
  test.setTimeout((MINUTES + 15) * 60_000);

  const started = Date.now();
  const duo = await startDuo(browser, { gameQuery: 'robot=1&rendu=leger' });
  const { host, guest, hostGame, guestGame, probe } = duo;
  const samples: Sample[] = [];
  const mornings: { t: number; day: number; minutes: number }[] = [];
  const heap: { t: number; host: number | null; guest: number | null }[] = [];
  const stops: string[] = [];
  const elapsed = (): number => Math.round((Date.now() - started) / 1000);
  const measureHeap = async (): Promise<void> => {
    heap.push({ t: elapsed(), host: await heapUsed(host).catch(() => null), guest: await heapUsed(guest).catch(() => null) });
  };

  let lastDay = 0;
  let lastHeap = Date.now();
  try {
    await measureHeap();
    const end = started + MINUTES * 60_000;
    while (Date.now() < end) {
      const statuses = await Promise.all([host, guest].map((p) => p.locator('.vue').getAttribute('data-statut').catch(() => null)));
      if (statuses.some((s) => s === 'stopped' || s === 'error')) {
        for (const [who, page] of [['hôte', host], ['invité', guest]] as const) {
          const message = await page.locator('.voile').innerText({ timeout: 2_000 }).catch(() => '');
          stops.push(`${who} (${elapsed()} s): ${message.replace(/\s+/g, ' ').trim()}`);
        }
        break;
      }
      const [h, g] = await Promise.all([readHud(hostGame), readHud(guestGame)]);
      const w = probe.world();
      samples.push({
        t: elapsed(),
        host: h,
        guest: g,
        world: w === null ? null : { phase: w.phase, day: w.clock.day, minutes: Math.round(w.clock.minutes), purse: w.purse, tick: w.tick },
      });
      if (w !== null && w.clock.day > lastDay && w.phase !== 'creation') {
        lastDay = w.clock.day;
        mornings.push({ t: elapsed(), day: w.clock.day, minutes: Math.round(w.clock.minutes) });
        await host.screenshot({ path: testInfo.outputPath(`matin-jour-${w.clock.day}-hote.png`) });
        await guest.screenshot({ path: testInfo.outputPath(`matin-jour-${w.clock.day}-invite.png`) });
      }
      if (w?.phase === 'ended') break;
      if (Date.now() - lastHeap >= HEAP_EVERY_MS) {
        lastHeap = Date.now();
        await measureHeap();
      }
      await host.waitForTimeout(SAMPLE_MS);
    }
    await measureHeap();
    await host.screenshot({ path: testInfo.outputPath('fin-hote.png') });
    await guest.screenshot({ path: testInfo.outputPath('fin-invite.png') });
  } finally {
    const tasks = { host: await longTasks(host).catch(() => []), guest: await longTasks(guest).catch(() => []) };
    const stats = (list: [number, number][]): Record<string, number> => ({
      count: list.length,
      max: Math.max(0, ...list.map(([, d]) => d)),
      over1s: list.filter(([, d]) => d > 1_000).length,
      over5s: list.filter(([, d]) => d > 5_000).length,
    });
    // Écarts entre les deux écrans au même relevé (les deux HUD sont lus en même temps).
    const both = samples.filter((s) => s.host.minutes !== null && s.guest.minutes !== null);
    const clockGaps = both.map((s) => Math.abs((s.host.day ?? 0) * 1440 + (s.host.minutes ?? 0) - ((s.guest.day ?? 0) * 1440 + (s.guest.minutes ?? 0))));
    const purseMismatches = samples.filter((s) => s.host.purse !== null && s.guest.purse !== null && s.host.purse !== s.guest.purse);
    const summary = {
      minutes: Math.round(elapsed() / 6) / 10,
      lastWorld: samples.at(-1)?.world ?? null,
      mornings,
      stops,
      errors: duo.errors,
      warnings: countByText(duo.warnings),
      heap,
      longTasks: { host: stats(tasks.host), guest: stats(tasks.guest) },
      clockGapMinutes: { samples: clockGaps.length, max: Math.max(0, ...clockGaps), over15: clockGaps.filter((d) => d > 15).length },
      purseMismatches: purseMismatches.map((s) => ({ t: s.t, host: s.host.purse, guest: s.guest.purse })),
      maxWorldBytes: probe.maxWorldBytes(),
      samples,
    };
    writeFileSync(testInfo.outputPath('endurance.json'), JSON.stringify(summary, null, 1));
    if (process.env.LPL_E2E_RAPPORT !== undefined) writeFileSync(process.env.LPL_E2E_RAPPORT, JSON.stringify(summary, null, 1));
    await duo.close();
  }

  // Les robots passent l'écran titre, la création et la scène d'arrivée: la journée tourne.
  expect(samples.some((s) => s.world?.phase === 'day' && s.world.minutes > 600), 'la journée 1 avance').toBe(true);
  expect(stops, 'aucun arrêt de la plateforme').toEqual([]);
  expect(duo.errors, 'aucune erreur de page').toEqual([]);
  expect(probe.maxWorldBytes()).toBeLessThan(64 * 1024);
});
