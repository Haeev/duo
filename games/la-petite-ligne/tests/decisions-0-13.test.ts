// 0.13, mission « décisions à deux » (`docs/jeux/jeu-1/v0-13-habitants.md`, section 5.2; HB-16):
// ouverture par effet ou par l'étape d'une quête, accord après 2 s, désaccord sans décision, un
// absent fait attendre, effets de l'option, `decision_made` avec ou sans option, même résultat
// chez l'hôte et chez l'invité, reprise d'une sauvegarde sans décisions ouvertes.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Intent } from '../src/etat/actions';
import type { CharacterId, WorldEvent } from '../src/etat/types';
import { villageShapeError } from '../src/sauvegarde/voisins';
import { createSession, type GameAction } from '../src/session';
import { evaluate, NO_CONTEXT } from '../src/simulation/conditions';
import { SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import type { Sim } from '../src/simulation/contexte';
import { runEffects } from '../src/simulation/effets';
import { step } from '../src/simulation/pas';
import { startQuest } from '../src/simulation/quetes';
import { contentAndMap, newSim } from './aides';

function daySim(sim: Sim = newSim()): Sim {
  const w = sim.world;
  w.phase = 'day';
  w.clock.running = false;
  // Les scènes qui se lancent d'elles-mêmes (l'arrivée de Firmin) sont passées: rien ne suspend les effets.
  for (let i = 0; i < 5; i++) {
    settleScene(sim);
    step(sim, { controls: {}, intents: [] });
  }
  settleScene(sim);
  return sim;
}

/** Marque vue la scène en cours et rend la main aux deux joueurs. */
function settleScene(sim: Sim): void {
  const w = sim.world;
  const scene = w.scene;
  if (scene !== null) w.dialoguesDone.push(scene.dialogue);
  w.scene = null;
  for (const c of w.characters) {
    c.created = true;
    c.status = 'active';
    c.lastInputTick = w.tick;
  }
}

/** Un pas avec ces intentions; les deux joueurs restent présents (`present`) ou non. */
function tick(sim: Sim, intents: { by: CharacterId; intent: Intent }[] = [], present = true): WorldEvent[] {
  if (present) for (const c of sim.world.characters) c.lastInputTick = sim.world.tick;
  step(sim, { controls: {}, intents });
  return [...sim.events];
}

const vote = (by: CharacterId, option: string | null, decision = 'minute'): { by: CharacterId; intent: Intent } => ({
  by,
  intent: { type: 'decision_vote', decision, option },
});

describe('décisions à deux', () => {
  it('donne les cinq décisions de la conception (et le nom du chat), avec leurs options', () => {
    const { content } = contentAndMap();
    const ids = content.decisions.list.map((d) => [d.id, d.villager, d.options.map((o) => o.id)]);
    expect(ids).toEqual([
      ['minute', 'ambroise', ['now', 'letter']],
      ['mouture', 'berthe', ['weighing', 'watch']],
      ['robe', 'marthe', ['marthe', 'shared']],
      ['cat_name', 'margot', ['pompon', 'grisaille', 'mistral']],
      ['cabane', 'jeanne', ['shared', 'jeanne']],
    ]);
    expect(content.decisions.agreeSeconds).toBe(2);
  });

  it('se prend 2 s après l\'accord, jamais sur un désaccord', () => {
    const sim = daySim();
    const w = sim.world;
    runEffects(sim, [{ type: 'open_decision', decision: 'minute' }], null);
    expect(w.decisionsOpen.minute).toEqual({});
    expect(w.characters.every((c) => c.notifications.at(-1)?.key === 'decision_opened')).toBe(true);
    tick(sim, [vote('p1', 'now'), vote('p2', 'letter')]);
    for (let i = 0; i < 5 * SIM_HZ; i++) tick(sim);
    expect(w.decisions.minute).toBeUndefined();
    expect(w.decisionsOpen.minute).toEqual({ p1: 'now', p2: 'letter' });
    // Une option inconnue ou une décision fermée ne changent rien.
    tick(sim, [vote('p2', 'jamais'), vote('p2', 'weighing', 'mouture')]);
    expect(w.decisionsOpen.minute?.p2).toBe('letter');
    expect(w.decisionsOpen.mouture).toBeUndefined();

    const agreed = tick(sim, [vote('p2', 'now')]);
    expect(agreed.some((e) => e.type === 'decision_agreed')).toBe(true);
    const wait = 2 * SIM_HZ;
    for (let i = 1; i < wait; i++) tick(sim);
    expect(w.decisions.minute).toBeUndefined();
    const taken = tick(sim);
    expect(taken).toContainEqual({ type: 'decision_taken', decision: 'minute', option: 'now' });
    expect(w.decisions.minute).toBe('now');
    expect(w.decisionsOpen.minute).toBeUndefined();
    expect(w.flags).toContain('clocks_reconciled');
    const made = (option: string | null): boolean => evaluate(sim, { type: 'decision_made', decision: 'minute', option }, NO_CONTEXT);
    expect([made(null), made('now'), made('letter')]).toEqual([true, true, false]);
    // Prise, elle ne se rouvre plus.
    runEffects(sim, [{ type: 'open_decision', decision: 'minute' }], null);
    expect(w.decisionsOpen.minute).toBeUndefined();
  });

  it('un changement d\'avis pendant les 2 s défait l\'accord', () => {
    const sim = daySim();
    runEffects(sim, [{ type: 'open_decision', decision: 'cabane' }], null);
    tick(sim, [vote('p1', 'shared', 'cabane'), vote('p2', 'shared', 'cabane')]);
    for (let i = 0; i < SIM_HZ; i++) tick(sim);
    tick(sim, [vote('p2', null, 'cabane')]);
    for (let i = 0; i < 3 * SIM_HZ; i++) tick(sim);
    expect(sim.world.decisions.cabane).toBeUndefined();
    expect(sim.world.decisionsOpen.cabane).toEqual({ p1: 'shared' });
  });

  it('un joueur absent fait attendre la décision, même d\'accord', () => {
    const sim = daySim();
    const w = sim.world;
    runEffects(sim, [{ type: 'open_decision', decision: 'robe' }], null);
    tick(sim, [vote('p1', 'shared', 'robe'), vote('p2', 'shared', 'robe')]);
    const p2 = w.characters.find((c) => c.id === 'p2');
    if (p2 === undefined) throw new Error('p2 absent du monde');
    for (let i = 0; i < 4 * SIM_HZ; i++) {
      const p1 = w.characters.find((c) => c.id === 'p1');
      if (p1 !== undefined) p1.lastInputTick = w.tick;
      p2.lastInputTick = -1e9;
      tick(sim, [], false);
    }
    expect(p2.absent).toBe(true);
    expect(w.decisions.robe).toBeUndefined();
    for (let i = 0; i <= 2 * SIM_HZ; i++) tick(sim);
    expect(w.decisions.robe).toBe('shared');
    expect(w.flags).toContain('sisters_reconciled');
  });

  it("s'ouvre d'elle-même quand l'étape d'une quête l'attend, et l'étape se finit avec elle", () => {
    const files = structuredClone(CONTENT_FILES);
    const quests = (files.quetes as { quests: unknown[] }).quests;
    quests.push({
      id: 'test_mouture',
      kind: 'side',
      tier: 'P0',
      title: 'La part du meunier',
      giver: 'berthe',
      start: { byEffect: true },
      steps: [{ id: 'decide', objective: 'Décider à deux.', conditions: [{ type: 'decision_made', decision: 'mouture' }] }],
      completionText: 'Fait.',
    });
    const sim = daySim(newSim(7, loadContent(files)));
    startQuest(sim, 'test_mouture');
    const opened = tick(sim);
    expect(opened).toContainEqual({ type: 'decision_opened', decision: 'mouture', villager: 'berthe' });
    tick(sim, [vote('p1', 'watch', 'mouture'), vote('p2', 'watch', 'mouture')]);
    for (let i = 0; i <= 2 * SIM_HZ; i++) tick(sim);
    expect(sim.world.decisions.mouture).toBe('watch');
    expect(sim.world.flags).toContain('mouture_settled');
    expect(sim.world.quests.find((q) => q.id === 'test_mouture')?.status).toBe('done');
  });

  it("« La montre d'Émile »: l'étape `decide` ouvre `minute` (options sous un `any`)", () => {
    const sim = daySim();
    startQuest(sim, 'ambroise_emile_watch');
    const q = sim.world.quests.find((x) => x.id === 'ambroise_emile_watch');
    if (q === undefined) throw new Error('quête absente des données');
    expect(sim.world.decisionsOpen.minute).toBeUndefined();
    q.step = 1;
    tick(sim);
    expect(sim.world.decisionsOpen.minute).toEqual({});
    tick(sim, [vote('p1', 'letter'), vote('p2', 'letter')]);
    for (let i = 0; i <= 2 * SIM_HZ; i++) tick(sim);
    expect(q.status).toBe('done');
    expect(sim.world.flags).not.toContain('clocks_reconciled');
  });

  it('accepte une sauvegarde du format 14 sans décisions ouvertes, refuse une forme abîmée', () => {
    const w = daySim().world as unknown as Record<string, unknown>;
    delete w.decisionsOpen;
    expect(villageShapeError(w)).toBeNull();
    w.decisionsOpen = { minute: { p1: 3 } };
    expect(villageShapeError(w)).toBe('décisions');
  });

  it("donne le même résultat chez l'hôte et chez l'invité", async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const { content, map } = contentAndMap();
      const clock = { now: 0 };
      const host = createSession({ duo: duo.hostGame, content, map, now: () => clock.now });
      const guest = createSession({ duo: duo.guestGame, content, map, now: () => clock.now });
      let seq = 0;
      const idle = (): { seq: number; moveX: number; moveY: number; actHeld: boolean } => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
      const run = async (n: number): Promise<void> => {
        for (let i = 0; i < n; i++) {
          host.step(idle());
          guest.step(idle());
          clock.now += SIM_DT * 1000;
          host.beforeFrame(1);
          guest.beforeFrame(1);
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      };
      await run(20);
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      daySim(sim);
      runEffects(sim, [{ type: 'open_decision', decision: 'cabane' }], null);
      await run(15);
      expect(guest.view.world().decisionsOpen.cabane).toEqual({});
      host.view.send({ type: 'decision_vote', decision: 'cabane', option: 'jeanne' });
      guest.view.send({ type: 'decision_vote', decision: 'cabane', option: 'jeanne' });
      await run(15);
      expect(guest.view.world().decisionsOpen.cabane?.agreedAt).toBeTypeOf('number');
      await run(3 * SIM_HZ);
      expect(sim.world.decisions.cabane).toBe('jeanne');
      expect(guest.view.world().decisions).toEqual(sim.world.decisions);
      expect(guest.view.world().decisionsOpen).toEqual({});
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
