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
  loadSteps,
  playUi,
  point,
  shareSpots,
  standSpots,
  seats,
  snapshot,
  waitDialoguesClosed,
  walkBoth,
  actOn,
  calibrateYaw,
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
  const steps = loadSteps(PLACE, QUEST);
  /** La cible d'une étape, telle que la quête l'écrit (c'est elle que suit le repère du joueur). */
  const targetOf = (id: string): { point?: string; villager?: string } => {
    const step = steps.find((s) => s.id === id);
    if (step?.target === null || step === undefined)
      throw new Error(`étape « ${id} » sans cible dans la quête`);
    return step.target;
  };
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

  /** Deux places pour deux joueurs, sans se croiser dans le couloir. */
  const share = async (spots: readonly Point[]): Promise<readonly [Point, Point]> =>
    await shareSpots(duo, map, spots, await crowd());

  /** Marche des deux; en cas d'échec: constat, capture, puis contournement par téléportation. */
  const goTo = async (
    label: string,
    targets: readonly [Point | null, Point | null],
    facing: number,
    tolerance = 0.55,
    stop?: (w: ProbeWorld) => boolean,
  ): Promise<void> => {
    await windowSize(duo, true);
    const avoid = await crowd();
    let result = await walkBoth(duo, targets, {
      map,
      journal,
      label,
      tolerance,
      avoid,
      ...(stop === undefined ? {} : { stop }),
    });
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
    // La bulle doit dire « Parler » à cet habitant, sans refus: une couchette voisine peut
    // prendre la visée, et l'on n'appuie que sur la bonne cible, comme un joueur qui lit la bulle.
    const aimed = async (): Promise<boolean> => {
      const aim = await side.aim(seat.index);
      return (aim?.id ?? '').includes(villager) && (aim?.refusal ?? null) === null;
    };
    const talking = async (): Promise<boolean> =>
      count() > before || (await snapshot(side)).dialogue !== null;
    const opened = await actOn(duo, seat, await villagerAt(villager), aimed, talking, journal);
    if (!opened) {
      const w = await side.world();
      const p = w === null ? null : me(w, seat);
      journal.log(
        `parler à ${villager} impossible chez ${side.who}: corps ${JSON.stringify(p?.body)}, cible ${JSON.stringify(await side.aim(seat.index))}, talk ${JSON.stringify(p?.talk)}, habitant ${JSON.stringify(w?.places[PLACE]?.villagers?.[villager])}`,
      );
      await side.shot(`parler-impossible-${villager}-${side.who}`);
      throw new Error(`parler à ${villager} impossible (${side.who})`);
    }
    await side.shot(`bulle-${villager}-${side.who}`);
    // Fini: une réplique lue, le bandeau fermé et la conversation close chez l'hôte (autorité).
    await playUntil(
      `échange avec ${villager} fini (${side.who})`,
      async (w) =>
        count() > before && (await snapshot(side)).dialogue === null && me(w, seat).talk === null,
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
  // Chacun sur une case libre à côté de lui (lues sur la carte), puis on se tourne vers lui.
  await goTo('papiers: aller au Contrôleur', await share(standSpots(map, ctrl, 2, [ctrl])), 0);
  await Promise.all([host.shot('2-au-controleur-hote'), guest.shot('2-au-controleur-invite')]);
  await talkTo('controleur', seatH);
  await talkTo('controleur', seatG);
  const afterPapers = await playUntil(
    'étape papiers franchie',
    (w) => passed(w).includes('papiers'),
    60_000,
  );
  await waitDialoguesClosed(duo, ctx);
  for (const side of [host, guest])
    if (!ctx.shown.has(`editeur:${side.who}`))
      journal.find(
        'majeur',
        'l’éditeur de personnage ne s’ouvre pas à la photo d’identité',
        `${side.who}: le Contrôleur dit « Regarde l’objectif » (nœud photo) mais aucun éditeur ne s’ouvre; apparence du joueur: ${JSON.stringify(afterPapers.players.map((p) => ((p as unknown as { look: unknown }).look === null ? 'aucune' : 'définie')))}`,
      );
  journal.lap('étape papiers (marche, dialogue, éditeur chez les deux)');
  journal.log(`après papiers: ${hhmm(afterPapers.minutes)}, étape ${stepOf(afterPapers)}`);

  // 2. chariot: suivre la cible de l'étape, telle que la quête l'écrit, et trouver là celui qui
  // sert (D6: la cible désignait un point où il n'y avait personne).
  const cart = targetOf('chariot');
  const cartAt =
    cart.villager !== undefined ? await villagerAt(cart.villager) : point(map, cart.point ?? '');
  const ctrl2 = await villagerAt('controleur');
  journal.log(
    `étape chariot: cible ${JSON.stringify(cart)} en ${cartAt.x.toFixed(1)}; ${cartAt.y.toFixed(1)}, Contrôleur en ${ctrl2.x.toFixed(1)}; ${ctrl2.y.toFixed(1)}`,
  );
  await goTo(
    'chariot: suivre la cible de la quête',
    await share(standSpots(map, cartAt, 2, [ctrl2])),
    0,
  );
  const reach = Math.hypot(cartAt.x - ctrl2.x, cartAt.y - ctrl2.y);
  await Promise.all([host.shot('3-chariot-hote'), guest.shot('3-chariot-invite')]);
  if (reach > 1.2) {
    const there = await snapshot(host);
    journal.find(
      'majeur',
      'chariot: personne au point que la quête désigne',
      `étape « chariot »: cible ${JSON.stringify(cart)}, le Contrôleur est à ${reach.toFixed(1)} m; bulle: « ${there.prompt} »`,
    );
    if (STRICT) throw new Error('chariot: personne là où la quête envoie les joueurs (D6)');
  }
  await talkTo('controleur', seatH);
  const gotSandwich = await playUntil(
    'sandwich servi',
    (w) =>
      passed(w).includes('chariot') ||
      w.players.some((p) => p.toolbar.some((s) => s?.item === 'sandwich')),
    60_000,
  );
  await waitDialoguesClosed(duo, ctx);
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

  // 4. dormir: suivre la cible de l'étape, puis chacun se couche sur un lit (les meubles à
  // brique `sleep` de la carte). L'étape ne passe que les deux couchés (D7), alors la nuit saute.
  const day0 = ate.common.day;
  const minutesBeforeSleep = ate.minutes;
  const beds = map.objects.filter((o) => o.bricks.includes('sleep'));
  const [bedH, bedG] = beds;
  if (bedH === undefined || bedG === undefined) throw new Error('il faut un lit par joueur');
  const night = targetOf('dormir');
  journal.log(
    `étape dormir: cible ${JSON.stringify(night)}, lits ${beds.map((b) => b.id).join(', ')}`,
  );
  const spotH = standSpots(map, bedH, 1)[0];
  const spotG = spotH === undefined ? undefined : standSpots(map, bedG, 1, [spotH])[0];
  if (spotH === undefined || spotG === undefined)
    throw new Error('aucune case libre près des lits');
  const nightAt = point(map, night.point ?? '');
  for (const spot of [spotH, spotG]) {
    const far = Math.hypot(spot.x - nightAt.x, spot.y - nightAt.y);
    if (far > 2)
      journal.find(
        'majeur',
        'dormir: la cible de l’étape est loin des lits',
        `cible ${JSON.stringify(night)} à ${far.toFixed(1)} m de la place devant un lit`,
      );
  }
  // La scène du tunnel s'ouvre avec l'étape: on la lit d'abord (personne ne marche pendant une scène).
  await playUntil('scène du tunnel finie', (w) => (w.common.story?.scene ?? null) === null, 90_000);
  await goTo('dormir: aller aux couchettes', [spotH, spotG], -Math.PI / 2);
  await Promise.all([host.shot('6-couchettes-hote'), guest.shot('6-couchettes-invite')]);
  const lying = async (seat: typeof seatH): Promise<boolean> => {
    const objects = (await host.world())?.places[PLACE]?.objects ?? {};
    return Object.values(objects).some((o) => o.sleep?.includes(seat.index) === true);
  };
  /** Se tourner vers son lit, puis la touche d'action; vrai si le joueur est couché. */
  const lieDown = async (seat: typeof seatH, bed: (typeof beds)[number]): Promise<boolean> => {
    const aimed = async (): Promise<boolean> => {
      const aim = await seat.side.aim(seat.index);
      return aim?.id === bed.id && (aim.refusal ?? null) === null;
    };
    const done = await actOn(duo, seat, bed, aimed, () => lying(seat), journal);
    journal.log(`lit ${bed.id} (${seat.side.who}): couché ${String(done)}`);
    return done;
  };
  if (!(await lieDown(seatH, bedH)))
    journal.find('majeur', 'dormir: impossible de se coucher', `hôte devant ${bedH.id}`);
  await host.shot('7-un-seul-couche');
  // D7: un seul couché, l'étape attend l'autre et la nuit ne saute pas.
  const alone = await host.world();
  if (alone !== null && (passed(alone).includes('dormir') || alone.common.day > day0)) {
    journal.find(
      'majeur',
      'dormir: l’étape passe avec un seul joueur couché',
      `étape ${stepOf(alone)}, jour ${String(alone.common.day)}, ${hhmm(alone.minutes)}`,
    );
    if (STRICT) throw new Error('dormir: étape franchie avec un seul joueur couché (D7)');
  }
  if (!(await lieDown(seatG, bedG)))
    journal.find('majeur', 'dormir: impossible de se coucher', `invité devant ${bedG.id}`);
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
  journal.lap('étape dormir (couchettes, saut de nuit, scènes)');

  // 5. descendre: les deux devant la porte du wagon.
  const door = point(map, 'porte');
  const beforeDoor = await host.world();
  journal.log(
    `avant la porte: ${beforeDoor === null ? '?' : hhmm(beforeDoor.minutes)}, étape ${beforeDoor === null ? '?' : stepOf(beforeDoor)}`,
  );
  await goTo(
    'descendre: devant la porte',
    await share([
      { x: door.x - 0.4, y: door.y },
      { x: door.x + 0.4, y: door.y },
    ]),
    Math.PI / 2,
    0.6,
    // Les deux devant la porte: l'étape passe et le train repart, la marche s'arrête là.
    (w) => passed(w).includes('descendre') || w.common.place !== PLACE,
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
  // D9: Firmin peut nier le train (c'est le mystère du cahier), pas l'ignorer: sa réplique du car
  // doit dire qu'il n'y a plus de train.
  const carLine = welcomeLines.find((l) => l.text.includes('par le car'))?.text;
  if (carLine !== undefined && !/train/i.test(carLine))
    journal.find(
      'mineur',
      'Firmin parle d’un car et d’un banc sans nier le train par lequel on arrive',
      `réplique: « ${carLine} »`,
    );
  journal.log(`répliques lues: ${String(ctx.lines.length)}`);
  for (const l of ctx.lines) journal.log(`  ${l.who} ${l.kind} (${String(l.ms)} ms): ${l.text}`);
  journal.log(`durée totale du parcours: ${journal.elapsed().toFixed(0)} s`);
  expect((await host.world())?.common.place).toBe('aubrune');
  expect(duo.errors).toEqual([]);
  await duo.close();
});
