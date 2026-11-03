// Tour 8, section 1: étapes, choix à deux, reprise, migration, limite du jour 43 (T8-01 à T8-05),
// non-régression des jours 1 à 15 (T8-04, I-07) et habitants d'été (T8-09).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Intent } from '../src/etat/actions';
import { stageScreen } from '../src/etat/semaine';
import type { CharacterId, WorldState } from '../src/etat/types';
import type { Content } from '../src/donnees/types';
import { decodeSave, restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import type { Sim } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { placeVillagers } from '../src/simulation/habitants';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, newSim, play, SEED } from './aides';
import { letterTextOf, letterTitleOf } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
const HOUR = 60;

function reference(file: string): { dataSchema: number; data: unknown } {
  const raw = JSON.parse(
    readFileSync(fileURLToPath(new URL(`./donnees/sauvegardes/${file}`, import.meta.url)), 'utf8'),
  ) as {
    dataSchema: number;
    data: unknown;
  };
  return { dataSchema: raw.dataSchema, data: raw.data };
}

function load(file: string, content: Content = contentAndMap().content): Sim {
  const ref = reference(file);
  return restoreWorld(
    content,
    contentAndMap().map,
    decodeSave(structuredClone(ref.data)),
    ref.dataSchema,
    [A, B],
  );
}

/** Un pas avec les intentions données (l'ordre d'arrivée chez l'hôte). */
function send(sim: Sim, intents: [CharacterId, Intent][]): void {
  step(sim, { controls: {}, intents: intents.map(([by, intent]) => ({ by, intent })) });
}

const choose = (choice: 'stay' | 'finish' | null): Intent => ({ type: 'stage_choice', choice });

describe("écran d'étape et choix à deux (T8-01, T8-03)", () => {
  it("T8-01: au jour 15, après le train et les scènes, l'écran s'ouvre avec « Rester »; d'accord, la journée reprend", () => {
    const sim = load('format-5-fin-de-la-demo.json');
    const w = sim.world;
    expect(w.phase).toBe('ended');
    expect(w.clock.day).toBe(15);
    expect(w.clock.minutes).toBeGreaterThanOrEqual(16 * HOUR);
    expect(w.stages.current).toBe('demo');
    const screen = stageScreen(w, sim.content);
    expect(screen?.canStay).toBe(true);
    expect(screen?.title).toBe("Deux semaines à la Halte d'Aubrune");
    expect(screen?.next).toBeNull();
    expect(screen?.orders).toBe(2);
    expect(screen?.linesDone).toBe(w.orderHistory.reduce((n, o) => n + o.linesDone, 0));
    send(sim, [['p1', choose('stay')]]);
    expect(w.phase).toBe('ended');
    expect(w.stages.choice).toEqual({ p1: 'stay', p2: null });
    const events: string[] = [];
    send(sim, [['p2', choose('stay')]]);
    events.push(...sim.events.map((e) => e.type));
    expect(w.phase).toBe('day');
    expect(w.clock.day).toBe(15);
    expect(w.stages.passed).toEqual(['demo']);
    expect(w.stages.current).toBeNull();
    expect(events).toContain('stage_continue');
    expect(events).not.toContain('session_finish');
    expect(
      w.characters.every(
        (c) =>
          c.notifications.at(-1)?.text === 'La Halte continue. Prochain train: samedi 22, 10 h.',
      ),
    ).toBe(true);
    const before = w.clock.minutes;
    for (let i = 0; i < SIM_HZ; i++) step(sim, { controls: {}, intents: [] });
    expect(w.clock.running).toBe(true);
    expect(w.clock.minutes).toBeGreaterThan(before);
    // L'étape franchie ne revient pas: `end_stage demo` ne fait plus rien.
    expect(stageScreen(w, sim.content)).toBeNull();
  });

  it("T8-03: tant que les choix diffèrent, rien; on peut changer d'avis; les deux « Finir » ferment la séance, qui revient sur l'écran", () => {
    const sim = load('format-5-fin-de-la-demo.json');
    const w = sim.world;
    send(sim, [
      ['p1', choose('stay')],
      ['p2', choose('finish')],
    ]);
    expect(w.phase).toBe('ended');
    expect(sim.events.some((e) => e.type === 'session_finish')).toBe(false);
    expect(w.stages.choice).toEqual({ p1: 'stay', p2: 'finish' });
    send(sim, [['p1', choose(null)]]);
    expect(w.stages.choice.p1).toBeNull();
    send(sim, [['p1', choose('finish')]]);
    expect(sim.events.filter((e) => e.type === 'session_finish')).toHaveLength(1);
    expect(w.phase).toBe('ended');
    expect(w.stages.passed).toEqual([]);
    // Au prochain lancement: le même écran, avec « Rester à la Halte », choix remis à zéro.
    const again = restoreWorld(
      sim.content,
      sim.map,
      structuredClone(snapshotOf(sim).data),
      snapshotOf(sim).dataSchema,
      [B, A],
    );
    expect(again.world.phase).toBe('ended');
    expect(again.world.stages).toMatchObject({
      current: 'demo',
      passed: [],
      choice: { p1: null, p2: null },
    });
    expect(stageScreen(again.world, again.content)?.canStay).toBe(true);
    // L'ancien « Continuer » de l'écran de fin vaut « Finir la séance ».
    send(again, [
      ['p1', { type: 'end_ready', ready: true }],
      ['p2', { type: 'end_ready', ready: true }],
    ]);
    expect(again.events.filter((e) => e.type === 'session_finish')).toHaveLength(1);
  });

  it("les deux « Rester » au même pas: le premier accord s'applique, le second ne fait rien", () => {
    const sim = load('format-5-fin-de-la-demo.json');
    send(sim, [
      ['p1', choose('stay')],
      ['p2', choose('stay')],
      ['p1', choose('stay')],
    ]);
    expect(sim.world.phase).toBe('day');
    expect(sim.events.filter((e) => e.type === 'stage_continue')).toHaveLength(1);
  });
});

describe('sauvegarde du jour 15 du format 4 (T8-02, section 1.6)', () => {
  it("se charge sur l'écran d'étape; « Rester » chez les deux la reprend; la lettre de la commande du samedi 22 arrive à 18 h", () => {
    const sim = load('format-4-fin-de-la-demo.json');
    const w = sim.world;
    expect(w.schema === 4 || w.schema === 5).toBe(true);
    expect(w.phase).toBe('ended');
    expect(w.stages).toEqual({ passed: [], current: 'demo', choice: { p1: null, p2: null } });
    expect(stageScreen(w, sim.content)?.canStay).toBe(true);
    // Migration: commandes numérotées et datées, totaux, commande 3 tirée pour le samedi 22.
    expect(w.orderHistory.map((o) => [o.number, o.day])).toEqual([
      [1, 8],
      [2, 15],
    ]);
    expect(w.orderTotals.orders).toBe(2);
    expect(w.orderTotals.amount).toBe(w.orderHistory.reduce((n, o) => n + o.amount, 0));
    expect(w.order.generated?.train).toBe(22);
    expect(w.order.generated?.number).toBe(3);
    expect(w.quests.find((q) => q.id === 'weekly_order')).toMatchObject({
      status: 'active',
      train: 22,
    });
    send(sim, [
      ['p1', choose('stay')],
      ['p2', choose('stay')],
    ]);
    expect(w.phase).toBe('day');
    expect(w.letters.some((l) => l.id.startsWith('coop_order_generated'))).toBe(false);
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) => s.world.letters.some((l) => l.id === 'coop_order_generated@22'),
      SIM_HZ * 60 * 20,
    );
    const letter = w.letters.find((l) => l.id === 'coop_order_generated@22');
    expect(letterTitleOf(sim, letter)).toBe('Commande pour samedi 22');
    expect(w.clock.day).toBe(15);
    expect(w.clock.minutes).toBeGreaterThanOrEqual(18 * HOUR);
    expect(letterTextOf(sim, letter)).not.toContain('{');
    // Au matin du jour 16, la caisse rouvre pour la commande 3.
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) => s.world.clock.day === 16 && s.world.phase === 'day',
      SIM_HZ * 60 * 60,
    );
    expect(w.orderResult).toBeNull();
    expect(w.weather).toBe('sunny');
  });

  it('une sauvegarde reprise plus tard que 18 h reçoit la lettre aussitôt', () => {
    const sim = load('format-4-fin-de-la-demo.json');
    sim.world.clock.minutes = 20 * HOUR;
    send(sim, [
      ['p1', choose('stay')],
      ['p2', choose('stay')],
    ]);
    step(sim, { controls: {}, intents: [] });
    expect(sim.world.letters.some((l) => l.id === 'coop_order_generated@22')).toBe(true);
  });
});

describe('étape du samedi 43 (T8-05, devenue T9-16 au tour 9)', () => {
  it('commande payée, scène de Firmin, écran « Six semaines » qui propose « Rester », texte réécrit; « Rester » chez les deux mène au jour 44', () => {
    const sim = load('format-5-ete-jour-25.json');
    play(
      sim,
      createRobot({ stages: 'finish' }),
      (s) => s.world.phase === 'ended',
      SIM_HZ * 60 * 60 * 30,
    );
    const w = sim.world;
    expect(w.clock.day).toBe(43);
    expect(w.stages.current).toBe('summer_end');
    expect(w.orderHistory.at(-1)?.day).toBe(43);
    expect(w.dialoguesDone).toContain('firmin_stage_summer');
    expect(w.letters.some((l) => l.id === 'coop_recap_generated@43')).toBe(true);
    const screen = stageScreen(w, sim.content);
    expect(screen?.canStay).toBe(true);
    expect(screen?.title).toBe("Six semaines à la Halte d'Aubrune");
    expect(screen?.text).toBe("Restez pour l'automne: le bois roussit, les noisettes tombent, et le bourg a des projets pour vous.");
    expect(w.session.highlights).toContain('Six semaines à la Halte');
    send(sim, [
      ['p1', choose('stay')],
      ['p2', choose('stay')],
    ]);
    play(
      sim,
      createRobot({ stages: 'stay' }),
      (s) => s.world.clock.day === 44,
      SIM_HZ * 60 * 60 * 2,
    );
    expect(sim.world.clock.day).toBe(44);
    expect(sim.world.stages.passed).toEqual(['demo', 'summer_end']);
    expect(sim.world.order.generated?.train).toBe(50);
  }, 600_000);
});

/** Le contenu sans les systèmes du tour 8: limite au jour 15, aucune commande tirée, trains écrits seulement. */
function withoutTour8(content: Content): Content {
  const c = structuredClone(content);
  c.settings.clock.lastDay = { day: 15, end: 16 * HOUR };
  c.settings.stages = [{ id: 'demo', day: 15, time: 16 * HOUR, texts: 'demo' }];
  c.settings.order.generated = null;
  c.settings.train.repeatEveryDays = 0;
  c.settings.economy.catalogue.repeatWeekly = null;
  c.settings.moments.festivalDays = [16, 23];
  return c;
}

/** L'état sans les champs du tour 8 (comparaison des jours 1 à 15). */
function comparable(w: WorldState): unknown {
  const copy = structuredClone(w) as Partial<WorldState>;
  delete copy.weatherLog;
  delete copy.morningMist;
  delete copy.stages;
  delete copy.orderTotals;
  delete copy.order;
  delete copy.letterVariants;
  delete copy.content;
  return copy;
}

describe('jours 1 à 15 inchangés (T8-04, I-07)', () => {
  it('même graine, mêmes robots: chaque aube des jours 2 à 15 identique à une partie sans les systèmes nouveaux', () => {
    const { content } = contentAndMap();
    const runs = [newSim(SEED, content), newSim(SEED, withoutTour8(content))].map((sim) => {
      const robot = createRobot();
      const dawns: unknown[] = [];
      let day = sim.world.clock.day;
      play(
        sim,
        { decide: (s) => robot.decide(s), job: (id) => robot.job(id) },
        (s) => {
          if (s.world.clock.day !== day && s.world.phase === 'breakfast') {
            day = s.world.clock.day;
            dawns.push(comparable(s.world));
          }
          return s.world.phase === 'ended';
        },
        SIM_HZ * 60 * 120,
      );
      return { sim, dawns };
    });
    const [now, before] = runs;
    if (now === undefined || before === undefined) throw new Error('deux parties attendues');
    expect(now.dawns).toHaveLength(14);
    now.dawns.forEach((d, i) => {
      expect(d, `aube du jour ${String(i + 2)}`).toEqual(before.dawns[i]);
    });
    // Au jour 15: même commande payée, même bourse; seule la commande 3 tirée et la quête de la semaine en plus.
    expect(now.sim.world.orderHistory).toEqual(before.sim.world.orderHistory);
    expect(now.sim.world.purse).toBe(before.sim.world.purse);
    expect(now.sim.world.rng).toEqual(before.sim.world.rng);
    expect(before.sim.world.order.generated).toBeNull();
    expect(now.sim.world.order.generated?.train).toBe(22);
    expect(now.sim.world.weatherLog).toEqual([]);
    expect(now.sim.world.morningMist).toBe(false);
  }, 300_000);
});

describe("habitants d'été et samedis (T8-09, section 2.4)", () => {
  function at(
    day: number,
    minutes: number,
    weather: 'sunny' | 'rain' = 'sunny',
  ): Record<string, string> {
    const sim = newSim(SEED);
    sim.world.phase = 'day';
    sim.world.clock.day = day;
    sim.world.clock.minutes = minutes;
    sim.world.weather = weather;
    placeVillagers(sim);
    return Object.fromEntries(
      sim.world.villagers.map((v) => [v.id, `${v.target}:${v.visible ? 'vu' : 'caché'}`]),
    );
  }

  it('en été à 20 h 30, Jeanne sur la place et Odette sous la tonnelle; au printemps, Jeanne est rentrée', () => {
    const summer = at(24, 20 * HOUR + 30);
    expect(summer.jeanne).toBe('village_square:vu');
    expect(summer.odette).toBe('grocery_terrace:vu');
    const spring = at(17, 20 * HOUR + 30);
    expect(spring.jeanne?.startsWith('village_square')).toBe(false);
    expect(at(24, 19 * HOUR).firmin).toBe('quay_bench:vu');
    expect(at(24, 18 * HOUR + 30).basile).toBe('sawmill_yard:vu');
  });

  it("un samedi d'été, les quatre attendent le train comme les jours 8 et 15; Jeanne s'abrite sur le banc du quai les jours de pluie", () => {
    for (const day of [8, 15, 29]) {
      const t = at(day, 11 * HOUR);
      expect(t.firmin, `jour ${String(day)}`).toBe('train_stop:vu');
      expect(t.basile, `jour ${String(day)}`).toBe('train_stop:vu');
      expect(t.jeanne, `jour ${String(day)}`).toBe('train_stop:vu');
      expect(t.odette, `jour ${String(day)}`).toBe('grocery_inside_counter:vu');
    }
    expect(at(20, 13 * HOUR, 'rain').jeanne).toBe('quay_bench:vu');
    expect(at(20, 13 * HOUR, 'sunny').jeanne).toBe('riverbank:vu');
  });
});
