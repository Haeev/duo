// P18 début du jeu et de l'acte 1 à Aubrune. P18 départ: une vraie partie neuve commence dans le
// train de nuit (prologue); la fin du prologue (sauvegarde `train-de-nuit-porte`, fabriquée par la
// simulation) mène les deux sur le quai d'Aubrune. P18a et P18b partent de parties posées à
// Aubrune (`fabrique-sauvegardes.prep.ts`). P18a: la scène d'accueil démarre chez les deux avec
// l'étape « quai ». P18b: après la scène, Firmin reçoit la lettre et l'étape avance. D1 (corrigé):
// les répliques de la scène s'affichent chez les deux et avancent quand les deux ont lu.
import { expect, test } from '@playwright/test';
import { SIM_DT } from '../../src/simulation/noyau/constantes';
import { STORY } from '../../src/simulation/quetes/reglages';
import { startDuo, type ProbeWorld, type Side } from '../aides-e2e/duo';

const QUEST = 'le-train-de-5h12';

const passed = (w: { progress?: { quests: Record<string, { passed?: readonly string[] }> } }) =>
  w.progress?.quests[QUEST]?.passed ?? [];

test('P18 départ: une partie neuve commence dans le train de nuit', async ({ browser }) => {
  const duo = await startDuo(browser, 'depart', { save: null });
  const { host, guest } = duo;
  for (const side of [host, guest]) {
    const w = await duo.until(
      side,
      `prologue chez ${side.who}`,
      (x) => x.common.place === 'train-de-nuit',
    );
    expect(w.minutes, 'départ à 21 h 30').toBeGreaterThanOrEqual(21 * 60 + 30);
    expect(w.common.day).toBe(1);
  }
  await duo.until(
    host,
    'scène du compartiment',
    (w) => w.common.story?.scene?.id === 'le-compartiment',
  );
  await host.page.waitForTimeout(2500);
  await Promise.all([host.shot('1-train-de-nuit-hote'), guest.shot('1-train-de-nuit-invite')]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('P18 départ: la fin du prologue mène les deux sur le quai d’Aubrune', async ({ browser }) => {
  const duo = await startDuo(browser, 'depart', { save: 'train-de-nuit-porte' });
  const { host, guest } = duo;
  await duo.until(host, 'dans le train', (w) => w.common.place === 'train-de-nuit');
  // Les deux se retrouvent devant la porte du wagon (point `porte`, 8,35; 5,35): l'étape
  // « descendre » finit le prologue, dont l'effet fait partir le train vers Aubrune.
  await duo.teleport(0, 8.05, 5.35, Math.PI / 2);
  await duo.teleport(1, 8.65, 5.35, Math.PI / 2);
  await duo.until(host, 'en route', (w) => w.common.phase === 'travel');
  for (const side of [host, guest])
    await duo.until(
      side,
      `quai d’Aubrune chez ${side.who}`,
      (w) => w.common.place === 'aubrune' && w.common.phase === 'day',
      40_000,
    );
  const arrived = await host.world();
  // « On arrive toujours au matin »: le train de nuit dépose les deux à 8 h (« Il est 8 h »).
  expect(arrived?.minutes ?? 0, 'arrivée à 8 h').toBeGreaterThanOrEqual(8 * 60);
  expect(arrived?.minutes ?? 0, 'arrivée à 8 h').toBeLessThan(8 * 60 + 5);
  for (const p of arrived?.players ?? [])
    expect(Math.hypot(p.body.x - 204, p.body.y - 102.5), 'sur le quai').toBeLessThan(1.5);
  await duo.until(
    host,
    'scène d’accueil',
    (w) => w.common.story?.scene?.id === 'firmin-en-pantoufles',
  );
  await host.page.waitForTimeout(2500);
  await Promise.all([host.shot('2-quai-aubrune-hote'), guest.shot('2-quai-aubrune-invite')]);
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('P18a acte 1: les deux arrivent sur le quai, la scène d’accueil démarre', async ({
  browser,
}) => {
  const duo = await startDuo(browser, 'p18a-acte-1', { save: 'aubrune' });
  const { host, guest } = duo;
  const start = await duo.until(host, 'partie à Aubrune', (w) => w.common.place === 'aubrune');
  expect(start.common.day).toBe(1);
  expect(start.minutes, 'matin d’arrivée').toBeLessThan(7 * 60);
  const scene = (w: { common: { story?: { scene?: { id: string } | null } | null } }) =>
    w.common.story?.scene?.id;
  await duo.until(host, 'scène d’accueil chez l’hôte', (w) => scene(w) === 'firmin-en-pantoufles');
  await duo.until(
    guest,
    'scène d’accueil chez l’invité',
    (w) => scene(w) === 'firmin-en-pantoufles',
  );
  expect(passed(start), 'étape « quai » pas encore franchie').toEqual([]);
  await host.page.waitForTimeout(1500);
  await host.shot('1-quai-scene');
  await guest.shot('1-quai-scene');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('P18b acte 1: la lettre à Firmin fait avancer la première étape', async ({ browser }) => {
  const duo = await startDuo(browser, 'p18b-acte-1', { save: 'aubrune-apres-scene' });
  const { host, guest } = duo;
  const [hi, gi] = [await host.local(), await guest.local()];
  const start = await duo.until(
    host,
    'scène finie',
    (w) => (w.common.story?.scene ?? null) === null,
  );
  expect(passed(start)).toEqual(['quai']);
  const firmin = start.places.aubrune?.villagers?.firmin;
  if (firmin === undefined) throw new Error('Firmin absent d’Aubrune');
  // Côté ouest: le poteau de quai (« Monter ») est à l'est de Firmin et prendrait la cible.
  await duo.teleport(hi, firmin.body.x - 1, firmin.body.y, 0);
  await duo.teleport(gi, firmin.body.x - 1.2, firmin.body.y + 1, 0);
  await expect
    .poll(async () => (await host.aim(hi))?.id ?? null, { timeout: 20_000 })
    .toContain('firmin');
  await host.shot('1-bulle-firmin');
  await host.press('Space');
  const box = host.game().locator('.lpl-ui .dialogue');
  await expect(box).toBeVisible();
  const choices = host.game().locator('.lpl-ui .choice');
  for (let i = 0; i < 12 && !(await choices.first().isVisible()); i++) {
    await host.press('Space');
    await host.page.waitForTimeout(600);
  }
  await expect(choices.first(), 'la lettre se montre par un choix').toBeVisible();
  await host.shot('2-choix-lettre');
  await host.press('Enter');
  for (let i = 0; i < 12 && (await box.isVisible()); i++) {
    await host.press('Space');
    await host.page.waitForTimeout(600);
  }
  const after = await duo.until(
    host,
    'étape « lettre » franchie',
    (w) => passed(w).includes('lettre'),
    15_000,
  );
  expect(passed(after)).toEqual(['quai', 'lettre']);
  await duo.until(guest, 'avancée vue par l’invité', (w) => passed(w).includes('lettre'), 15_000);
  await host.shot('3-lettre-montree');
  expect(duo.errors).toEqual([]);
  await duo.close();
});

test('D1 les répliques de la scène d’accueil s’affichent et avancent quand les deux ont lu', async ({
  browser,
}) => {
  const duo = await startDuo(browser, 'd1-scene-repliques', { save: 'aubrune' });
  const { host, guest } = duo;
  const line = (side: Side) => side.game().locator('.lpl-ui .scene-line');
  // La première réplique de Firmin arrive après sa marche: on laisse 25 s.
  for (const side of [host, guest]) {
    await expect(line(side).getByText(/Personne n.est descendu ici/)).toBeVisible({
      timeout: 25_000,
    });
    await expect(line(side).locator('.dlg__plate')).toContainText('Firmin');
    await expect(line(side).locator('.dlg__bust svg')).toBeVisible();
  }
  await host.shot('1-replique');
  // L'hôte lit (Espace: tout afficher, puis « lu »): il attend l'invité, qui voit qu'il a lu.
  const waiting = line(host).locator('.scene-line__wait');
  for (let i = 0; i < 4 && !(await waiting.isVisible()); i++) {
    await host.press('Space');
    await host.page.waitForTimeout(400);
  }
  await expect(waiting).toContainText('On attend');
  await expect(line(guest).locator('.scene-line__read--done')).toContainText('a lu');
  await expect(line(guest).getByText(/Personne n.est descendu ici/)).toBeVisible();
  // Pas de capture ici: en rendu logiciel chargé, deux captures peuvent durer plus que les 8 s de
  // jeu du délai du lecteur seul, et la réplique passait d'elle-même avant que l'invité ne lise.
  // L'invité lit à son tour: la réplique suivante arrive chez les deux, sans attendre le délai.
  // Mesuré en pas de simulation (l'horloge murale s'étire sous charge en rendu logiciel): le temps
  // suivant commence avant la fin du délai du lecteur seul (`soloReadSeconds` depuis la lecture
  // de l'hôte), donc par la lecture de l'invité.
  const next = /par le car/;
  const before = await host.world();
  const beat0 = before?.common.story?.scene?.beat ?? -1;
  const readAt = before?.common.story?.scene?.readAt;
  expect(readAt, 'lecture de l’hôte notée').toBeDefined();
  const advanced = (w: ProbeWorld): boolean => (w.common.story?.scene?.beat ?? -1) > beat0;
  for (let i = 0; i < 4; i++) {
    const now = await host.world();
    if (now !== null && advanced(now)) break;
    await guest.press('Space');
    await guest.page.waitForTimeout(400);
  }
  const after = await duo.until(host, 'réplique suivante chez l’hôte', advanced, 15_000);
  const since = after.common.story?.scene?.since ?? Infinity;
  expect(
    (since - (readAt ?? 0)) * SIM_DT,
    'avance par la lecture des deux, avant le délai du lecteur seul (s de jeu)',
  ).toBeLessThan(STORY.soloReadSeconds);
  // La réplique s'écrit lettre à lettre en temps de l'interface, lui aussi étiré sous charge.
  for (const side of [host, guest])
    await expect(line(side).getByText(next)).toBeVisible({ timeout: 15_000 });
  await guest.shot('3-replique-suivante');
  // Réplique du récit pour un seul rôle: l'un la lit, l'autre voit qu'on la lit.
  for (const side of [host, guest])
    for (let i = 0; i < 4 && (await line(side).getByText(next).isVisible()); i++) {
      await side.press('Space');
      await side.page.waitForTimeout(400);
    }
  const only = (side: Side) => side.game().locator('.lpl-ui .scene-other');
  await expect
    .poll(async () => (await only(host).isVisible()) || (await only(guest).isVisible()), {
      timeout: 10_000,
    })
    .toBe(true);
  const reader = (await only(host).isVisible()) ? guest : host;
  await expect(line(reader).getByText(/billet poinçonné/)).toBeVisible();
  await expect(line(reader).locator('.scene-line__only')).toBeVisible();
  await reader.shot('4-rien-que-pour-toi');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
