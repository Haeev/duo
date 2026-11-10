// P19 partie neuve: du train de nuit au quai d'Aubrune. Deux joueurs (hôte « Loïc », invité
// « Zoé ») jouent le prologue entier d'une vraie partie neuve, sans sauvegarde de départ: ils
// marchent au clavier, lisent les répliques par la touche d'action, passent par l'éditeur de
// personnage, mangent, dorment, descendent. Le parcours s'écrit sur les identifiants (quête
// `terminus`, scènes, étapes, points de la carte), jamais sur des positions: la planification se
// fait sur la carte du lieu lue dans ses données. Il relève dans un journal (`p19-releves.txt`) ce
// qui cloche pour un vrai joueur; les contournements (téléportation quand la marche est
// impossible) sont comptés comme défauts. `LPL2_STRICT=1`: un contournement fait échouer le parcours.
import { expect, test } from '@playwright/test';
import { startDuo, type Duo, type ProbeWorld } from '../aides-e2e/duo';
import {
  Journal,
  loadMap,
  playUi,
  point,
  seats,
  snapshot,
  walkBoth,
  calibrateYaw,
  tapToward,
  windowSize,
  me,
  type Point,
  type UiContext,
} from '../aides-e2e/prologue';

const QUEST = 'terminus';
const PLACE = 'train-de-nuit';
const STRICT = process.env.LPL2_STRICT === '1';

const hhmm = (minutes: number): string => {
  const m = Math.floor(minutes) % 1440;
  return `${String(Math.floor(m / 60))} h ${String(m % 60).padStart(2, '0')}`;
};
const passed = (w: ProbeWorld): readonly string[] => w.progress?.quests[QUEST]?.passed ?? [];
const stepOf = (w: ProbeWorld): string => w.progress?.quests[QUEST]?.step ?? '?';

test('P19 partie neuve: du train de nuit au quai d’Aubrune', async ({ browser }) => {
  test.setTimeout(900_000);
  const journal = new Journal();
  const map = loadMap(PLACE);
  const duo: Duo = await startDuo(browser, 'p19', { save: null });
  const { host, guest } = duo;
  const [seatH, seatG] = await seats(duo);
  const ctx: UiContext = {
    journal,
    slug: 'p19',
    gender: { hôte: 'Femme', invité: 'Homme' },
    shown: new Map(),
    lines: [],
    current: new Map(),
  };

  /** Les deux joueurs lisent tout ce qui se présente jusqu'à ce que la condition soit vraie. */
  const playUntil = async (
    label: string,
    predicate: (w: ProbeWorld) => boolean | Promise<boolean>,
    timeoutMs = 60_000,
  ): Promise<ProbeWorld> => {
    const t0 = Date.now();
    for (;;) {
      const w = await host.world();
      if (w !== null && (await predicate(w))) return w;
      if (Date.now() - t0 > timeoutMs) {
        await Promise.all([host.shot(`delai-${label}-hote`), guest.shot(`delai-${label}-invite`)]);
        throw new Error(
          `Délai dépassé: ${label} (étape ${w === null ? '?' : stepOf(w)}, lieu ${w?.common.place ?? '?'}, phase ${w?.common.phase ?? '?'})`,
        );
      }
      const did = await Promise.all([playUi(host, ctx), playUi(guest, ctx)]);
      if (!did.some(Boolean)) await host.page.waitForTimeout(250);
    }
  };

  /** Les habitants du lieu, à contourner en marchant. */
  const crowd = async (): Promise<Point[]> => {
    const w = await host.world();
    return Object.values(w?.places[PLACE]?.villagers ?? {}).map((v) => ({
      x: v.body.x,
      y: v.body.y,
    }));
  };

  /** Marche des deux; en cas d'échec: constat, capture, puis contournement par téléportation. */
  const goTo = async (
    label: string,
    targets: readonly [Point | null, Point | null],
    facing: number,
    tolerance = 0.55,
  ): Promise<void> => {
    await windowSize(duo, true);
    const avoid = await crowd();
    let result = await walkBoth(duo, targets, { map, journal, label, tolerance, avoid });
    if (result.state.includes('bloqué')) {
      // La carte ne donne aucun passage: le joueur essaie quand même, droit devant lui, 8 s.
      const retry = await walkBoth(
        duo,
        [
          result.state[0] === 'bloqué' ? (targets[0] ?? null) : null,
          result.state[1] === 'bloqué' ? (targets[1] ?? null) : null,
        ],
        {
          map,
          journal,
          avoid,
          label: `${label} (droit devant)`,
          tolerance,
          straight: true,
          timeoutMs: 8000,
        },
      );
      result = {
        state: [
          result.state[0] === 'bloqué' ? retry.state[0] : result.state[0],
          result.state[1] === 'bloqué' ? retry.state[1] : result.state[1],
        ],
      };
    }
    await windowSize(duo, false);
    for (const [i, st] of result.state.entries()) {
      const target = targets[i];
      if (st === 'arrivé' || st === 'sans cible' || target === null || target === undefined)
        continue;
      const who = i === 0 ? 'hôte' : 'invité';
      const shot = await (i === 0 ? host : guest).shot(`marche-impossible-${label}-${who}`);
      const w = await host.world();
      const p = w === null ? null : me(w, i === 0 ? seatH : seatG).body;
      journal.find(
        'bloquant',
        `marche impossible: ${label}`,
        `${who} ${st} en ${p?.x.toFixed(1) ?? '?'}; ${p?.y.toFixed(1) ?? '?'} vers ${target.x.toFixed(1)}; ${target.y.toFixed(1)}; contournement par téléportation`,
        shot,
      );
      if (STRICT) throw new Error(`marche impossible: ${label} (${who})`);
      await duo.teleport(i, target.x, target.y, facing);
    }
  };

  // 0. Partie neuve: les deux dans le train de nuit, la scène du compartiment.
  for (const side of [host, guest]) {
    const w = await duo.until(side, `prologue chez ${side.who}`, (x) => x.common.place === PLACE);
    expect(w.common.day).toBe(1);
  }
  const start = await host.world();
  if (start === null) throw new Error('monde absent');
  journal.log(
    `départ: ${hhmm(start.minutes)}, jour ${String(start.common.day)}, étape ${stepOf(start)}, besoins ${JSON.stringify(start.players.map((p) => p.needs))}`,
  );
  await Promise.all([host.shot('1-depart-hote'), guest.shot('1-depart-invite')]);
  await playUntil(
    'scène du compartiment finie',
    (w) => (w.common.story?.scene ?? null) === null,
    90_000,
  );
  journal.lap('scène du compartiment (lecture à deux)');

  // 1. papiers: marcher jusqu'au Contrôleur, lui parler, passer par l'éditeur (chacun le sien).
  const hud = await snapshot(host);
  journal.log(`HUD au départ: ${hud.clock}; invite: ${hud.prompt}`);
  /** Parle, puis lit jusqu'à la fin de l'échange de ce joueur (au moins une réplique lue, bandeau fermé). */
  const talkTo = async (villager: string, seat: typeof seatH): Promise<void> => {
    const side = seat.side;
    const count = (): number =>
      ctx.lines.filter((l) => l.who === side.who && l.kind === 'dialogue').length;
    const before = count();
    const aimed = async (): Promise<boolean> =>
      ((await side.aim(seat.index))?.id ?? '').includes(villager);
    if (!(await aimed())) {
      // Comme un joueur: se tourner vers lui par petits pas.
      await windowSize(duo, true);
      await tapToward(duo, seat, await villagerAt(villager), aimed, journal);
      await windowSize(duo, false);
    }
    await expect
      .poll(aimed, { timeout: 10_000 })
      .toBe(true)
      .catch(async (e: unknown) => {
        const w = await side.world();
        const p = w === null ? null : me(w, seat);
        journal.log(
          `cible ${villager} introuvable chez ${side.who}: corps ${JSON.stringify(p?.body)}, cible ${JSON.stringify(await side.aim(seat.index))}, talk ${JSON.stringify(p?.talk)}, habitant ${JSON.stringify(w?.places[PLACE]?.villagers?.[villager])}`,
        );
        throw e;
      });
    await side.shot(`bulle-${villager}-${side.who}`);
    const verb = (await side.aim(seat.index))?.verb ?? '';
    journal.log(`cible ${villager} chez ${side.who}: verbe « ${verb} »`);
    // Un appui qui tombe entre deux images (2 images par seconde ici) peut se perdre: on recommence.
    let presses = 0;
    while (presses < 4 && count() === before && (await snapshot(side)).dialogue === null) {
      await side.press('Space', 400);
      presses += 1;
      await side.page.waitForTimeout(2500);
    }
    if (presses > 1)
      journal.log(`parler à ${villager} (${side.who}): ${String(presses)} appuis nécessaires`);
    await playUntil(
      `échange avec ${villager} fini (${side.who})`,
      async () => count() > before && (await snapshot(side)).dialogue === null,
      90_000,
    );
  };
  const villagerAt = async (id: string): Promise<Point> => {
    const w = await host.world();
    const v = w?.places[PLACE]?.villagers?.[id];
    if (v === undefined) throw new Error(`habitant ${id} absent de ${PLACE}`);
    return v.body;
  };

  await windowSize(duo, true);
  await calibrateYaw(duo, journal);
  await windowSize(duo, false);
  const ctrl = await villagerAt('controleur');
  journal.log(`Contrôleur en ${ctrl.x.toFixed(1)}; ${ctrl.y.toFixed(1)}`);
  // Se placer à l'ouest du Contrôleur, face à lui: on arrive en marchant vers l'est.
  await goTo(
    'papiers: aller au Contrôleur',
    [
      { x: ctrl.x - 1.1, y: ctrl.y },
      { x: ctrl.x - 1.1, y: ctrl.y + 0.5 },
    ],
    0,
  );
  await Promise.all([host.shot('2-au-controleur-hote'), guest.shot('2-au-controleur-invite')]);
  await talkTo('controleur', seatH);
  await talkTo('controleur', seatG);
  const afterPapers = await playUntil(
    'étape papiers franchie',
    (w) => passed(w).includes('papiers'),
    60_000,
  );
  await playUntil('dialogues fermés', () => true, 1);
  for (const side of [host, guest])
    if (!ctx.shown.has(`editeur:${side.who}`))
      journal.find(
        'majeur',
        'l’éditeur de personnage ne s’ouvre pas à la photo d’identité',
        `${side.who}: le Contrôleur dit « Regarde l’objectif » (nœud photo) mais aucun éditeur ne s’ouvre; apparence du joueur: ${JSON.stringify(afterPapers.players.map((p) => ((p as unknown as { look: unknown }).look === null ? 'aucune' : 'définie')))}`,
      );
  journal.lap('étape papiers (marche, dialogue, éditeur chez les deux)');
  journal.log(`après papiers: ${hhmm(afterPapers.minutes)}, étape ${stepOf(afterPapers)}`);

  // 2. chariot: suivre la cible de l'étape (le point `chariot`), puis demander un sandwich.
  const chariot = point(map, 'chariot');
  await goTo(
    'chariot: suivre la cible de la quête',
    [
      { x: chariot.x - 0.6, y: chariot.y },
      { x: chariot.x - 0.6, y: chariot.y + 0.5 },
    ],
    0,
    0.7,
  );
  const there = await snapshot(host);
  const aimThere = await host.aim(seatH.index);
  await host.shot('3-au-point-chariot');
  if (!aimThere?.id?.includes('controleur'))
    journal.find(
      'majeur',
      'chariot: personne au point que la quête désigne',
      `étape « chariot » désigne le point « chariot », mais cible d'action à cet endroit: ${JSON.stringify(aimThere)}; bulle: « ${there.prompt} »`,
      'recette-prologue-chariot-vide',
    );
  const ctrl2 = await villagerAt('controleur');
  journal.log(`Contrôleur pendant l'étape chariot: ${ctrl2.x.toFixed(1)}; ${ctrl2.y.toFixed(1)}`);
  await goTo(
    'chariot: aller au Contrôleur',
    [
      { x: ctrl2.x - 1.1, y: ctrl2.y },
      { x: ctrl2.x - 1.1, y: ctrl2.y + 0.5 },
    ],
    0,
  );
  await talkTo('controleur', seatH);
  const gotSandwich = await playUntil(
    'sandwich servi',
    (w) =>
      passed(w).includes('chariot') ||
      w.players.some((p) => p.toolbar.some((s) => s?.item === 'sandwich')),
    60_000,
  );
  await playUntil('dialogue chariot fermé', () => true, 1);
  journal.lap('étape chariot (chercher le Contrôleur, sandwich)');
  journal.log(`sandwich: besoins ${JSON.stringify(gotSandwich.players.map((p) => p.needs))}`);

  // 3. manger: la jauge de faim, le sandwich par le carnet.
  const hungerBefore = (await host.world())?.players[seatH.index]?.needs.hunger ?? 0;
  const stepNow = (await host.world()) ?? gotSandwich;
  journal.log(`avant de manger: étape ${stepOf(stepNow)}, faim hôte ${hungerBefore.toFixed(0)}`);
  if (!passed(stepNow).includes('manger')) {
    await host.press('KeyC');
    await expect(host.game().locator('.lpl-ui .carnet')).toBeVisible();
    await host.page.waitForTimeout(600);
    await host.shot('4-carnet-sandwich');
    const slot =
      (await host.world())?.players[seatH.index]?.toolbar.findIndex(
        (s) => s?.item === 'sandwich',
      ) ?? -1;
    if (slot < 0)
      journal.find(
        'majeur',
        'manger: pas de sandwich dans la barre',
        'étape « manger » sans sandwich pour l’hôte',
      );
    for (let i = 0; i < Math.max(slot, 0); i += 1) await host.press('KeyD');
    await host.press('Enter');
    await host.page.waitForTimeout(1500);
    await host.press('Backspace');
    await host.page.waitForTimeout(600);
  }
  const ate = await playUntil('manger franchi', (w) => passed(w).includes('manger'), 30_000).catch(
    async (e: unknown) => {
      const w = await host.world();
      journal.find(
        'majeur',
        'manger: étape pas franchie après le sandwich',
        `faim ${String(w?.players[seatH.index]?.needs.hunger)}; ${String(e)}`,
      );
      throw e;
    },
  );
  journal.log(`après manger: faim ${ate.players.map((p) => p.needs.hunger.toFixed(0)).join('/')}`);
  await host.shot('5-apres-manger-hote');
  journal.lap('étape manger');

  // 4. dormir: retour au compartiment, les deux sur une banquette, saut de nuit.
  const day0 = ate.common.day;
  const minutesBeforeSleep = ate.minutes;
  const room = point(map, 'compartiment');
  await goTo(
    'dormir: retour au compartiment',
    [
      { x: room.x - 2, y: room.y - 0.5 },
      { x: room.x + 2, y: room.y - 0.5 },
    ],
    -Math.PI / 2,
    0.9,
  );
  await playUntil('scène du tunnel finie', (w) => (w.common.story?.scene ?? null) === null, 90_000);
  await Promise.all([host.shot('6-compartiment-hote'), guest.shot('6-compartiment-invite')]);
  const asleep = async (seat: typeof seatH): Promise<void> => {
    await expect
      .poll(async () => (await seat.side.aim(seat.index))?.verb ?? null, { timeout: 15_000 })
      .not.toBeNull();
    journal.log(`banquette: cible ${JSON.stringify(await seat.side.aim(seat.index))}`);
    await seat.side.press('Space');
  };
  await asleep(seatH).catch(() => {
    journal.find(
      'majeur',
      'dormir: aucune cible de banquette',
      'depuis le compartiment, aucune action possible sur une banquette (hôte)',
    );
  });
  await host.page.waitForTimeout(1500);
  await host.shot('7-un-seul-couche');
  await asleep(seatG).catch(() => {
    journal.find(
      'majeur',
      'dormir: aucune cible de banquette',
      'depuis le compartiment, aucune action possible sur une banquette (invité)',
    );
  });
  const woke = await playUntil(
    'réveil',
    (w) => w.common.day > day0 || passed(w).includes('dormir'),
    90_000,
  );
  journal.log(
    `réveil: jour ${String(woke.common.day)} ${hhmm(woke.minutes)} (avant: ${hhmm(minutesBeforeSleep)}), besoins ${JSON.stringify(woke.players.map((p) => p.needs))}`,
  );
  await Promise.all([host.shot('8-reveil-hote'), guest.shot('8-reveil-invite')]);
  await playUntil('étape dormir franchie', (w) => passed(w).includes('dormir'), 60_000);
  await playUntil(
    'scène de l’arrêt finie',
    (w) => (w.common.story?.scene ?? null) === null,
    90_000,
  );
  journal.lap('étape dormir (banquettes, saut de nuit, scènes)');

  // 5. descendre: les deux devant la porte du wagon.
  const door = point(map, 'porte');
  const beforeDoor = await host.world();
  journal.log(
    `avant la porte: ${beforeDoor === null ? '?' : hhmm(beforeDoor.minutes)}, étape ${beforeDoor === null ? '?' : stepOf(beforeDoor)}`,
  );
  await goTo(
    'descendre: devant la porte',
    [
      { x: door.x - 0.4, y: door.y },
      { x: door.x + 0.4, y: door.y },
    ],
    Math.PI / 2,
    0.45,
  );
  await Promise.all([host.shot('9-porte-hote'), guest.shot('9-porte-invite')]);
  journal.lap('étape descendre (marche jusqu’à la porte)');

  // 6. Le départ, le trajet, l'arrivée sur le quai, la scène d'accueil.
  await playUntil(
    'en route',
    (w) => w.common.phase === 'travel' || w.common.place !== PLACE,
    60_000,
  );
  await host.shot('10-en-route-hote');
  const arrived = await playUntil(
    'arrivée à Aubrune',
    (w) => w.common.place === 'aubrune' && w.common.phase === 'day',
    90_000,
  );
  journal.log(`arrivée à Aubrune: jour ${String(arrived.common.day)}, ${hhmm(arrived.minutes)}`);
  journal.lap('trajet vers Aubrune');
  const welcome = await duo.until(
    host,
    'scène d’accueil',
    (w) => w.common.story?.scene?.id === 'firmin-en-pantoufles',
    60_000,
  );
  await duo.until(
    guest,
    'scène d’accueil chez l’invité',
    (w) => w.common.story?.scene?.id === 'firmin-en-pantoufles',
    20_000,
  );
  await host.page.waitForTimeout(2500);
  await Promise.all([host.shot('11-quai-hote'), guest.shot('11-quai-invite')]);
  const clock = hhmm(welcome.minutes);
  journal.log(`scène d'accueil à ${clock} (Firmin annonce « 8 h et des poussières »)`);
  // Lire toute la scène d'accueil chez les deux joueurs: une réplique à la fois, comme à l'écran.
  const firstWelcome = ctx.lines.length;
  const done = await playUntil(
    'scène d’accueil lue',
    (w) => (w.common.story?.scene ?? null) === null,
    150_000,
  );
  journal.lap('scène d’accueil lue à deux');
  const welcomeLines = ctx.lines.slice(firstWelcome).filter((l) => l.who === 'hôte');
  const said = welcomeLines.map((l) => l.text).join(' ');
  const hourSaid = /Il est (\d+) h/.exec(said);
  const hourShown = Math.floor((done.minutes % 1440) / 60);
  journal.log(
    `Firmin dit « ${hourSaid?.[0] ?? '(pas d’heure)'} », l’horloge du jeu marque ${hhmm(done.minutes)}`,
  );
  if (hourSaid?.[1] !== undefined && Math.abs(Number(hourSaid[1]) - hourShown) > 1)
    journal.find(
      'majeur',
      'heure dite par Firmin différente de l’horloge',
      `Firmin: « ${hourSaid[0]} », horloge: ${hhmm(done.minutes)}`,
    );
  if (/par le car|sur le banc/.test(said))
    journal.find(
      'mineur',
      'Firmin parle d’un car et d’un banc alors qu’on arrive en train',
      `réplique: « ${welcomeLines.find((l) => l.text.includes('par le car'))?.text ?? '?'} »`,
    );
  journal.log(`répliques lues: ${String(ctx.lines.length)}`);
  for (const l of ctx.lines) journal.log(`  ${l.who} ${l.kind} (${String(l.ms)} ms): ${l.text}`);
  journal.log(`durée totale du parcours: ${journal.elapsed().toFixed(0)} s`);
  expect((await host.world())?.common.place).toBe('aubrune');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
