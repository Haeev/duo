// P18 début de l'acte 1 à Aubrune. Départ: parties posées à Aubrune (le départ réglé du jeu est
// la gare d'essai; voir `fabrique-sauvegardes.prep.ts`), le voyage lui-même étant joué par P04 et
// P16. P18a: les deux sont sur le quai, la scène d'accueil démarre chez les deux avec l'étape
// « quai ». P18b: après la scène, Firmin reçoit la lettre et l'étape avance. D1: les répliques de
// la scène devraient s'afficher (défaut connu, voir le rapport).
import { expect, test } from '@playwright/test';
import { startDuo } from '../aides-e2e/duo';

const QUEST = 'le-train-de-5h12';

const passed = (w: { progress?: { quests: Record<string, { passed?: readonly string[] }> } }) =>
  w.progress?.quests[QUEST]?.passed ?? [];

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

test('D1 les répliques de la scène d’accueil s’affichent (défaut connu)', async ({ browser }) => {
  // Attendu en échec tant que rien ne dessine les répliques `say` des scènes (rapport, défaut D1):
  // le test échoue, donc passe en « échec attendu »; dès la correction il faudra retirer `fail`.
  test.fail(true, 'D1: les répliques de scène ne sont dessinées par aucune couche de l’interface');
  const duo = await startDuo(browser, 'd1-scene-muette', { save: 'aubrune' });
  const { host } = duo;
  try {
    // La première réplique de Firmin arrive après sa marche: on laisse 25 s.
    await expect(host.game().getByText(/Personne n.est descendu ici/)).toBeVisible({
      timeout: 25_000,
    });
  } finally {
    await host.shot('1-scene-sans-texte');
    await duo.close();
  }
});
