// R20 (patch 0.12.2, retours du 3 novembre): « On a suivi Basile pour tenir son échelle, et il a
// disparu en arrivant près de l'établi. » Cause: après 18 h, Basile rentrait à la scierie (activité
// `home`, donc caché) alors qu'il venait de demander qu'on lui tienne l'échelle, et rien ne disait
// que l'échelle reprendrait le lendemain. Parties jouées par le robot sur deux graines, de midi du
// jour 10 jusqu'au nichoir redressé (30 aubrins, drapeau `nest_box_straight`).
import { beforeAll, describe, expect, it } from 'vitest';
import type { ControlFrame } from '../src/etat/actions';
import type { WorldEvent } from '../src/etat/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { evaluateAll, NO_CONTEXT, variantOf } from '../src/simulation/conditions';
import { type Sim, character } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { dialogueClose, talkTo } from '../src/simulation/dialogues';
import { step } from '../src/simulation/pas';
import type { Robot } from '../src/simulation/robot';
import { contentAndMap, createRobot, newSim, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const QUEST = 'basile_lost';
const HOUR = 60;

/** Les deux premières graines où le jour 10 tire « Où est passé Basile ? ». */
const SEEDS: number[] = [];
for (let s = 1; SEEDS.length < 2; s++) if (variantOf(s, 'afternoon_d10', 2) === 1) SEEDS.push(s);

function questOf(sim: Sim): { status: string; step: number } | undefined {
  return sim.world.quests.find((q) => q.id === QUEST);
}

function basile(sim: Sim): Sim['world']['villagers'][number] {
  const v = sim.world.villagers.find((x) => x.id === 'basile');
  if (v === undefined) throw new Error('Basile absent');
  return v;
}

function oak(sim: Sim): { x: number; y: number } {
  const p = sim.map.points.nest_oak_basile;
  if (p === undefined) throw new Error('point nest_oak_basile absent');
  return p;
}

/** La réplique d'étape « help » que Basile peut dire maintenant (une seule à la fois). */
function helpLine(sim: Sim): string[] {
  return ['basile_lost_help', 'basile_lost_help_noon', 'basile_lost_help_tomorrow'].filter((id) => {
    const def = sim.content.dialogues[id];
    return def !== undefined && evaluateAll(sim, def.when, NO_CONTEXT);
  });
}

const still = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

/** Parle à Basile sans marcher jusqu'à lui (partie scriptée) et finit la réplique; rend son id. */
function talkToBasile(sim: Sim): string {
  const c = character(sim, 'p1');
  expect(talkTo(sim, c, 'basile')).toBe(true);
  const id = c.dialogue?.dialogue ?? '';
  const d = c.dialogue;
  if (d !== null) d.line = d.lines.length - 1;
  dialogueClose(sim, c);
  step(sim, { controls: { p1: still(0), p2: still(0) }, intents: [] });
  return id;
}

/** Ce qu'on relève pendant que le robot joue. */
interface Watch {
  events: WorldEvent[];
  /** Pas où Basile était caché alors que l'étape « help » était ouverte entre midi et 18 h. */
  hiddenInWindow: number;
  /** Distance de Basile à son point au départ de chaque apogée. */
  climaxDistances: number[];
  /** Hausse de la bourse au pas où la quête s'est finie. */
  rewardAtDone: number | null;
  /** Positions de Basile (une par minute de jeu) le jour `followDay`, de midi à l'apogée. */
  walk: { x: number; y: number; visible: boolean }[];
}

function playWatching(
  sim: Sim,
  robot: Robot,
  until: (s: Sim) => boolean,
  maxTicks: number,
  followDay: number | null = null,
): Watch {
  const w: Watch = {
    events: [],
    hiddenInWindow: 0,
    climaxDistances: [],
    rewardAtDone: null,
    walk: [],
  };
  let lastMinute = -1;
  for (let i = 0; i < maxTicks && !until(sim); i++) {
    const before = sim.world.purse;
    const wasDone = questOf(sim)?.status === 'done';
    step(sim, robot.decide(sim));
    w.events.push(...sim.events);
    const q = questOf(sim);
    const m = sim.world.clock.minutes;
    const v = basile(sim);
    if (
      q?.status === 'active' &&
      q.step === 1 &&
      sim.world.phase === 'day' &&
      m >= 12 * HOUR &&
      m < 18 * HOUR &&
      !v.visible
    )
      w.hiddenInWindow += 1;
    if (sim.events.some((e) => e.type === 'moment_climax'))
      w.climaxDistances.push(Math.hypot(v.pos.x - oak(sim).x, v.pos.y - oak(sim).y));
    if (!wasDone && q?.status === 'done') w.rewardAtDone = sim.world.purse - before;
    const minute = Math.floor(m);
    const climaxDone = w.climaxDistances.length > 0;
    if (
      followDay !== null &&
      sim.world.clock.day === followDay &&
      m >= 12 * HOUR &&
      !climaxDone &&
      minute !== lastMinute
    ) {
      lastMinute = minute;
      w.walk.push({ x: v.pos.x, y: v.pos.y, visible: v.visible });
    }
  }
  return w;
}

function expectQuestFinished(sim: Sim, w: Watch): void {
  expect(questOf(sim)?.status).toBe('done');
  expect(sim.world.flags).toContain('nest_box_straight');
  expect(w.rewardAtDone).toBe(30);
  expect(w.hiddenInWindow).toBe(0);
  // L'apogée part de Basile arrêté au pied de son échelle: il n'y saute pas depuis son trajet.
  expect(w.climaxDistances).toHaveLength(1);
  expect(w.climaxDistances[0]).toBeLessThan(0.06);
}

describe.each(SEEDS)('R20: l’échelle de Basile, graine %i', (seed) => {
  const { content, map } = contentAndMap();
  let snap: ReturnType<typeof snapshotOf>;

  // Le robot joue jusqu'au jour 10 à 11 h 30, juste avant le départ de la quête; chaque cas repart
  // de cette sauvegarde (reprise comprise).
  beforeAll(() => {
    const sim = newSim(seed);
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) =>
        s.world.clock.day >= 10 &&
        s.world.phase === 'day' &&
        s.world.clock.minutes >= 11 * HOUR + 30,
      SIM_HZ * 60 * 60 * 3,
    );
    expect(sim.world.clock.day).toBe(10);
    expect(questOf(sim)).toBeUndefined();
    snap = snapshotOf(sim);
  }, 300_000);

  const fresh = (): Sim =>
    restoreWorld(content, map, structuredClone(snap.data), snap.dataSchema, [A, B]);

  it('trouvé l’après-midi: Basile reste visible au grand chêne et la quête se finit le jour même', () => {
    const sim = fresh();
    const robot = createRobot({ stages: 'stay' });
    const w = playWatching(
      sim,
      robot,
      (s) => questOf(s)?.status === 'done' || s.world.clock.day > 10,
      SIM_HZ * 60 * 60 * 2,
    );
    expect(sim.world.clock.day).toBe(10);
    expect(sim.world.dialoguesDone.some((d) => d.startsWith('basile_lost_found@'))).toBe(true);
    expectQuestFinished(sim, w);
  });

  it('trouvé après 18 h: « demain à midi », il le fait vraiment le lendemain, et on peut le suivre jusqu’au chêne', () => {
    const sim = fresh();
    // L'après-midi passe sans les joueurs (horloge avancée), la quête démarre à 18 h 10.
    sim.world.clock.minutes = 18 * HOUR + 10;
    for (let i = 0; i < SIM_HZ && questOf(sim) === undefined; i++)
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    expect(questOf(sim)).toMatchObject({ status: 'active', step: 0 });
    // Basile rentre chez lui (emploi du temps relu toutes les quelques secondes): on l'arrête en chemin.
    for (let i = 0; i < SIM_HZ * 10 && basile(sim).target !== 'sawmill_yard'; i++)
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
    expect(basile(sim).visible).toBe(true);
    expect(basile(sim).target).toBe('sawmill_yard');
    expect(talkToBasile(sim)).toBe('basile_lost_found_late');
    expect(content.dialogues.basile_lost_found_late?.lines[0]?.text).toContain('Demain à midi');
    expect(questOf(sim)).toMatchObject({ status: 'active', step: 1 });
    expect(helpLine(sim)).toEqual(['basile_lost_help_tomorrow']);

    // Le robot joue jusqu'au lendemain 9 h: rien ne se passe au chêne ce soir.
    const robot = createRobot({ stages: 'stay' });
    const evening = playWatching(
      sim,
      robot,
      (s) =>
        s.world.clock.day === 11 && s.world.phase === 'day' && s.world.clock.minutes >= 9 * HOUR,
      SIM_HZ * 60 * 60 * 2,
    );
    expect(evening.events.some((e) => e.type === 'moment_climax')).toBe(false);
    expect(questOf(sim)).toMatchObject({ status: 'active', step: 1 });
    expect(sim.world.moments.today?.id).toBe('ladder');
    // Le matin, à son établi, il donne rendez-vous à midi.
    expect(basile(sim).visible).toBe(true);
    expect(helpLine(sim)).toEqual(['basile_lost_help_noon']);

    // Sauvegarde et reprise le matin, puis la quête se finit l'après-midi du jour 11.
    const saved = snapshotOf(sim);
    const back = restoreWorld(content, map, structuredClone(saved.data), saved.dataSchema, [A, B]);
    const w = playWatching(
      back,
      createRobot({ stages: 'stay' }),
      (s) => questOf(s)?.status === 'done' || s.world.clock.day > 11,
      SIM_HZ * 60 * 60 * 2,
      11,
    );
    expect(back.world.clock.day).toBe(11);
    expect(back.world.clock.minutes).toBeGreaterThanOrEqual(12 * HOUR);
    expect(back.world.clock.minutes).toBeLessThan(18 * HOUR);
    expectQuestFinished(back, w);
    // De son poste du matin (établi ou remise de la draisine) au chêne, il marche à découvert (on
    // peut le suivre) et finit à son point.
    expect(w.walk.length).toBeGreaterThan(2);
    expect(w.walk.every((p) => p.visible)).toBe(true);
    const first = w.walk[0];
    const last = w.walk.at(-1);
    if (first === undefined || last === undefined) throw new Error('trajet vide');
    expect(Math.hypot(first.x - oak(back).x, first.y - oak(back).y)).toBeGreaterThan(3);
    expect(Math.hypot(last.x - oak(back).x, last.y - oak(back).y)).toBeLessThan(0.06);
  });

  it('l’étape ouverte à 18 h: Basile annonce demain midi, la quête ne se bloque pas et se finit le lendemain', () => {
    const sim = fresh();
    const robot = createRobot({ stages: 'stay' });
    // Le robot trouve Basile, puis les joueurs le laissent là jusqu'à 17 h 58.
    play(sim, robot, (s) => questOf(s)?.step === 1, SIM_HZ * 60 * 60);
    expect(questOf(sim)).toMatchObject({ status: 'active', step: 1 });
    for (const c of sim.world.characters) {
      c.holding = null;
      c.menu = null;
      c.dialogue = null;
      c.status = 'active';
    }
    sim.world.clock.minutes = 17 * HOUR + 58;
    const events: WorldEvent[] = [];
    for (let i = 0; i < SIM_HZ * 60 && sim.world.clock.minutes < 18 * HOUR + 1; i++) {
      step(sim, { controls: { p1: still(i), p2: still(i) }, intents: [] });
      events.push(...sim.events);
    }
    expect(sim.world.clock.minutes).toBeGreaterThanOrEqual(18 * HOUR);
    expect(events.some((e) => e.type === 'moment_climax')).toBe(false);
    expect(sim.world.moments.today?.phase).toBe('gone');
    for (const c of sim.world.characters)
      expect(c.notifications.some((n) => n.key === 'moment_ladder_missed')).toBe(true);
    expect(content.texts.messages.moment_ladder_missed).toContain('demain à midi');
    expect(questOf(sim)).toMatchObject({ status: 'active', step: 1 });
    expect(helpLine(sim)).toEqual(['basile_lost_help_tomorrow']);

    const w = playWatching(
      sim,
      robot,
      (s) => questOf(s)?.status === 'done' || s.world.clock.day > 11,
      SIM_HZ * 60 * 60 * 3,
    );
    expect(sim.world.clock.day).toBe(11);
    expectQuestFinished(sim, w);
  });
});
