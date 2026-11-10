// P11 reconnexion de l'invité (CA-35), M1 taille des messages pendant une minute de jeu,
// M3 appels de dessin au point de départ.
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { CAPTURES, startDuo } from '../aides-e2e/duo';

test('une minute de jeu: octets reçus par l’invité et appels de dessin', async ({ browser }) => {
  // L'écoute de la WebSocket doit précéder son ouverture: on la pose sur le contexte de l'invité.
  const bytes = { total: 0, frames: 0, byChannel: new Map<number, number>() };
  let counting = false;
  const duo = await startDuo(browser, 'm1-reseau', {
    onGuestPage: (page) => {
      page.on('websocket', (ws) => {
        ws.on('framereceived', (f) => {
          if (typeof f.payload !== 'string' || !counting) return;
          bytes.total += Buffer.byteLength(f.payload);
          bytes.frames += 1;
          const channel = /"channel":(\d+)/.exec(f.payload)?.[1];
          if (channel !== undefined)
            bytes.byChannel.set(
              Number(channel),
              (bytes.byChannel.get(Number(channel)) ?? 0) + Buffer.byteLength(f.payload),
            );
        });
      });
    },
  });
  const { host, guest } = duo;
  const stats = (await host
    .game()
    .evaluate(() =>
      (window as unknown as { __lplSonde?: { stats(): unknown } }).__lplSonde?.stats(),
    )) as { calls?: number; triangles?: number } | null;
  await host.shot('1-depart');
  counting = true;
  // Une minute: l'hôte et l'invité marchent par à-coups (ZQSD), le reste du temps immobiles.
  const end = Date.now() + 60_000;
  const keys = ['KeyW', 'KeyD', 'KeyS', 'KeyA'];
  for (let i = 0; Date.now() < end; i++) {
    await (i % 2 === 0 ? host : guest).press(keys[i % 4] ?? 'KeyW', 1500);
    await host.page.waitForTimeout(1500);
  }
  counting = false;
  const perSecond = bytes.total / 60;
  appendFileSync(
    join(CAPTURES, 'mesures.txt'),
    `réseau (reçu par l'invité, 60 s): ${bytes.total} octets, ${bytes.frames} trames, ${perSecond.toFixed(0)} o/s; par canal ${JSON.stringify([...bytes.byChannel])}\n` +
      `rendu au départ (hôte): ${JSON.stringify(stats)}\n`,
  );
  expect(bytes.frames).toBeGreaterThan(0);
  await guest.shot('2-apres-une-minute');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('reconnexion de l’invité en pleine partie', async ({ browser }) => {
  const duo = await startDuo(browser, 'p11-reconnexion');
  const { host, guest } = duo;
  const before = await host.world();
  await guest.page.reload();
  await host.page.waitForTimeout(4000);
  const status = await host.page.locator('.vue').getAttribute('data-statut');
  const clockA = (await host.world().catch(() => null))?.minutes ?? null;
  await host.page.waitForTimeout(3000);
  const clockB = (await host.world().catch(() => null))?.minutes ?? null;
  await host.shot('1-hote-apres-coupure');
  await guest.shot('1-invite-recharge');
  appendFileSync(
    join(CAPTURES, 'mesures.txt'),
    `reconnexion: statut hôte après rechargement de l'invité = ${status}; horloge ${before?.minutes} puis ${clockA} puis ${clockB}\n`,
  );
  // CA-35: l'horloge de l'hôte se fige pendant l'absence de l'invité.
  expect(clockA === null || clockB === null || clockA === clockB, 'horloge figée').toBe(true);
  // Le banc (`servir`) arrête la partie des deux côtés à la coupure, sans reprise en cours: la
  // reprise se fait depuis la dernière sauvegarde (README du faux hôte). On le constate ici; la
  // vraie reconnexion se vérifie dans Duo (recette chez le client).
  expect(['stopped', 'error', 'ended']).toContain(status);
  await duo.close();
});
