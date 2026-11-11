// P19b et P20, compagnons du parcours P19 (`prologue.spec.ts`).
// P19b: une vraie partie neuve SANS la sonde de recette (comme chez un joueur): on entre droit
// dans le wagon de nuit, sans éditeur de personnage (il vient à la photo du Contrôleur, P19), et
// la première scène se lit sur des silhouettes.
// P20 (CA-34): quitter au milieu du prologue puis reprendre rend l'état de la dernière sauvegarde,
// sans objet ni euro dupliqué, chacun là où il était (D11). Les joueurs y marchent au clavier:
// aucune téléportation.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startDuo, type ProbeWorld } from '../aides-e2e/duo';
import {
  actOn,
  calibrateYaw,
  Journal,
  loadMap,
  me,
  playUi,
  seats,
  shareSpots,
  snapshot,
  standSpots,
  walkBoth,
  windowSize,
  type UiContext,
} from '../aides-e2e/prologue';

const QUEST = 'terminus';
const PLACE = 'train-de-nuit';

const newContext = (journal: Journal): UiContext => ({
  journal,
  slug: 'p20',
  gender: { hôte: 'Femme', invité: 'Homme' },
  shown: new Map(),
  lines: [],
  current: new Map(),
});

test('P19b partie neuve sans sonde: pas d’éditeur au démarrage, le wagon tout de suite', async ({
  browser,
}) => {
  test.setTimeout(240_000);
  const journal = new Journal('p19b-releves.txt');
  const duo = await startDuo(browser, 'p19b', { save: null, probe: false });
  const { host, guest } = duo;
  await host.page.waitForTimeout(6000);
  const [sh, sg] = [await snapshot(host), await snapshot(guest)];
  journal.log(
    `P19b éditeur ouvert au démarrage: hôte ${String(sh.editor)}, invité ${String(sg.editor)}`,
  );
  journal.log(
    `P19b scène visible derrière: hôte ${String(sh.scene !== null)}, invité ${String(sg.scene !== null)}`,
  );
  journal.log(`P19b textes coupés: ${JSON.stringify([...sh.broken, ...sg.broken])}`);
  await Promise.all([host.shot('p19b-1-demarrage-hote'), guest.shot('p19b-1-demarrage-invite')]);
  expect(sh.editor, 'pas d’éditeur au démarrage chez l’hôte').toBe(false);
  expect(sg.editor, 'pas d’éditeur au démarrage chez l’invité').toBe(false);
  expect(sh.scene, 'la première scène se lit chez l’hôte').not.toBeNull();
  expect(sg.scene, 'la première scène se lit chez l’invité').not.toBeNull();
  // Les deux lisent la scène du compartiment: toujours pas d'éditeur, et le jeu rend la main.
  const ctx = newContext(journal);
  for (let i = 0; i < 60; i++) {
    const [h, g] = [await snapshot(host), await snapshot(guest)];
    expect(h.editor || g.editor, 'aucun éditeur pendant la scène').toBe(false);
    if (h.scene === null && g.scene === null) break;
    await Promise.all([playUi(host, ctx), playUi(guest, ctx)]);
  }
  await host.page.waitForTimeout(1500);
  const [ah, ag] = [await snapshot(host), await snapshot(guest)];
  journal.log(
    `P19b après la scène: éditeur chez l'hôte ${String(ah.editor)}, chez l'invité ${String(ag.editor)}; scène hôte ${ah.scene?.text ?? 'aucune'}, invité ${ag.scene?.text ?? 'aucune'}`,
  );
  await Promise.all([
    host.shot('p19b-2-apres-scene-hote'),
    guest.shot('p19b-2-apres-scene-invite'),
  ]);
  expect(ah.editor).toBe(false);
  expect(ag.editor).toBe(false);
  expect(ah.scene, 'la scène du compartiment est finie chez l’hôte').toBeNull();
  await duo.close();
});

test('P20 quitter et reprendre au milieu du prologue (CA-34)', async ({ browser }) => {
  test.setTimeout(480_000);
  const journal = new Journal('p20-releves.txt');
  const ctx = newContext(journal);
  const first = await startDuo(browser, 'p20', { save: null, keepServer: true });
  const [seatH, seatG] = await seats(first);
  const readAll = async (
    d: typeof first,
    until: (w: ProbeWorld) => boolean,
    timeoutMs: number,
  ): Promise<ProbeWorld> => {
    const t0 = Date.now();
    for (;;) {
      const w = await d.host.world();
      if (w !== null && until(w)) return w;
      if (Date.now() - t0 > timeoutMs) throw new Error('délai dépassé (lecture)');
      const did = await Promise.all([playUi(d.host, ctx), playUi(d.guest, ctx)]);
      if (!did.some(Boolean)) await d.host.page.waitForTimeout(250);
    }
  };
  // La scène d'ouverture lue, puis chacun marche jusqu'au Contrôleur (cases libres à côté de lui,
  // lues sur la carte) et lui montre ses papiers.
  await readAll(first, (w) => (w.common.story?.scene ?? null) === null, 90_000);
  const w0 = await first.host.world();
  const ctrl = w0?.places[PLACE]?.villagers?.controleur;
  if (ctrl === undefined) throw new Error('Contrôleur absent');
  const map = loadMap(PLACE);
  await windowSize(first, true);
  await calibrateYaw(first, journal);
  const spots = await shareSpots(first, map, standSpots(map, ctrl.body, 2, [ctrl.body]), [
    ctrl.body,
  ]);
  const walk = await walkBoth(first, spots, {
    map,
    journal,
    label: 'P20: aller au Contrôleur',
    avoid: [ctrl.body],
  });
  await windowSize(first, false);
  expect(walk.state, 'les deux arrivent à pied près du Contrôleur').toEqual(['arrivé', 'arrivé']);
  for (const seat of [seatH, seatG]) {
    // On n'appuie que si la bulle vise le Contrôleur (une couchette voisine peut prendre la visée).
    const aimed = async (): Promise<boolean> => {
      const aim = await seat.side.aim(seat.index);
      return (aim?.id ?? '').includes('controleur') && (aim?.refusal ?? null) === null;
    };
    const talking = async (): Promise<boolean> => (await snapshot(seat.side)).dialogue !== null;
    expect(
      await actOn(first, seat, ctrl.body, aimed, talking, journal),
      `${seat.side.who}: le dialogue du Contrôleur s’ouvre`,
    ).toBe(true);
    await readAll(
      first,
      (w) => w.players[seat.index]?.toolbar.some((s) => s?.item === 'billet-poinconne') === true,
      60_000,
    );
    await readAll(first, () => true, 1);
    await first.host.page.waitForTimeout(2000);
    for (let i = 0; i < 6 && (await snapshot(seat.side)).dialogue !== null; i++)
      await playUi(seat.side, ctx);
  }
  const before = await first.host.world();
  if (before === null) throw new Error('monde absent');
  const quest = (w: ProbeWorld): { step: string; passed: readonly string[] } => ({
    step: w.progress?.quests[QUEST]?.step ?? '?',
    passed: w.progress?.quests[QUEST]?.passed ?? [],
  });
  const items = (w: ProbeWorld, i: number): string =>
    JSON.stringify(w.players[i]?.toolbar.map((s) => (s === null ? null : [s.item, s.count])));
  journal.log(
    `P20 avant de quitter: ${JSON.stringify(quest(before))}, minute ${before.minutes.toFixed(0)}, bourses ${before.players.map((p) => p.money).join('/')}, barre hôte ${items(before, 0)}, barre invité ${items(before, 1)}`,
  );
  await Promise.all([
    first.host.shot('p20-1-avant-quitter-hote'),
    first.guest.shot('p20-1-avant-quitter-invite'),
  ]);
  // Quitter comme un joueur: Échap (pause), puis « Quitter la partie ».
  await first.host.press('Escape', 200);
  const quit = first.host.page.getByRole('button', { name: 'Quitter la partie' });
  await expect(quit).toBeVisible({ timeout: 20_000 });
  await first.host.shot('p20-2-pause-hote');
  await quit.click();
  await first.host.page.waitForTimeout(3000);
  const slot = join(first.server.dataDir, 'sauvegardes', 'emplacement-1.json');
  const saved = existsSync(slot);
  journal.log(`P20 sauvegarde écrite à la sortie: ${String(saved)}`);
  if (!saved) {
    journal.find(
      'bloquant',
      'quitter ne sauvegarde pas',
      'après « Quitter la partie » au milieu du prologue, aucun fichier de sauvegarde: la reprise est impossible',
    );
  }
  expect(saved, 'une sauvegarde existe après avoir quitté').toBe(true);
  const file = JSON.parse(readFileSync(slot, 'utf8')) as { savedAt?: string; label?: string };
  journal.log(`P20 sauvegarde: « ${file.label ?? '?'} », ${file.savedAt ?? '?'}`);
  const raw = JSON.parse(readFileSync(slot, 'utf8')) as { data?: string };
  const savedWorld = (typeof raw.data === 'string' ? JSON.parse(raw.data) : null) as {
    players?: { body: { x: number; y: number } }[];
  } | null;
  journal.log(
    `P20 positions dans le fichier: ${JSON.stringify(savedWorld?.players?.map((p) => [p.body.x.toFixed(1), p.body.y.toFixed(1)]))}`,
  );
  await first.close();

  // Reprendre: nouveau lancement des deux machines sur le même dossier de données.
  const second = await startDuo(browser, 'p20b', { server: first.server });
  const after = await second.host.world();
  if (after === null) throw new Error('monde absent après la reprise');
  journal.log(
    `P20 après la reprise: ${JSON.stringify(quest(after))}, minute ${after.minutes.toFixed(0)}, bourses ${after.players.map((p) => p.money).join('/')}, barre hôte ${items(after, 0)}, barre invité ${items(after, 1)}, lieu ${after.common.place}`,
  );
  await Promise.all([
    second.host.shot('p20-3-reprise-hote'),
    second.guest.shot('p20-3-reprise-invite'),
  ]);
  expect(after.common.place).toBe(PLACE);
  expect(quest(after)).toEqual(quest(before));
  // La photo était faite avant de quitter: chacun retrouve son personnage, pas une silhouette,
  // chez l'hôte comme chez l'invité.
  const faces = (w: ProbeWorld): unknown =>
    w.players.map((p, i) => ({
      revealed: w.progress?.memory?.[`joueurs.apparence.j${String(i)}`]?.v === true,
      look: p.look ?? null,
    }));
  journal.log(`P20 visages avant ${JSON.stringify(faces(before))}`);
  expect(
    before.players.map((_, i) => before.progress?.memory?.[`joueurs.apparence.j${String(i)}`]?.v),
    'les deux ont fait leur photo avant de quitter',
  ).toEqual([true, true]);
  expect(faces(after), 'personnages retrouvés à la reprise (hôte)').toEqual(faces(before));
  const guestAfter = await second.guest.world();
  expect(guestAfter === null ? null : faces(guestAfter), 'et chez l’invité').toEqual(faces(before));
  expect(after.players.map((p) => p.money)).toEqual(before.players.map((p) => p.money));
  for (const i of [0, 1]) {
    expect(items(after, i), `barre du joueur ${String(i)}: aucun objet dupliqué ni perdu`).toBe(
      items(before, i),
    );
    const a = after.players[i];
    const b = before.players[i];
    if (a === undefined || b === undefined) throw new Error('joueur absent');
    journal.log(
      `P20 joueur ${String(i)}: position avant ${b.body.x.toFixed(2)}; ${b.body.y.toFixed(2)}, après ${a.body.x.toFixed(2)}; ${a.body.y.toFixed(2)}`,
    );
    // D11: chacun reparaît là où il était (30 cm de marge: le Contrôleur écarte qui le serre).
    const saved = savedWorld?.players?.[i]?.body;
    expect(saved, `position du joueur ${String(i)} dans le fichier`).toBeDefined();
    expect(
      Math.hypot(a.body.x - (saved?.x ?? 0), a.body.y - (saved?.y ?? 0)),
      `joueur ${String(i)}: reparaît où la sauvegarde le place`,
    ).toBeLessThan(0.3);
    expect(
      Math.hypot(a.body.x - b.body.x, a.body.y - b.body.y),
      `joueur ${String(i)}: reparaît où il était en quittant`,
    ).toBeLessThan(0.3);
  }
  expect(me(after, seatH).name.length).toBeGreaterThan(0);
  expect(second.errors).toEqual([]);
  journal.log('P20 fin des contrôles');
  await second.close();
  journal.log('P20 fermé');
});
