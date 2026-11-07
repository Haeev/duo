// Aménagement (chantier c), tests courts: simulation pure de l'hôte, graine fixe, quelques secondes.
import { createRandom } from '@duo/sdk';
import { startLocalDuo } from '@duo/sdk-dev';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { createSession } from '../src/session';
import { describe, expect, it } from 'vitest';
import { computeAmbiance } from '../src/amenagement/ambiance';
import { seatFacingIssues } from '../src/amenagement/assises';
import { passageProblem, checkPlacement } from '../src/amenagement/regles';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import type { World } from '../src/etat/monde';
import { IDLE_INPUT, type Intent, type StepInput } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);

function setup(): {
  world: World;
  step: (intents?: QueuedIntent[], inputs?: [StepInput, StepInput]) => GameEvent[];
} {
  const world = createWorld(content, ['a', 'b']);
  const random = createRandom(7);
  const step = (
    intents: QueuedIntent[] = [],
    inputs: [StepInput, StepInput] = [IDLE_INPUT, IDLE_INPUT],
  ): GameEvent[] => {
    const events: GameEvent[] = [];
    stepWorld(content, world, inputs, intents, DT, random, (e) => events.push(e));
    return events;
  };
  step();
  return { world, step };
}

const as0 = (intent: Intent): QueuedIntent => ({ player: 0, intent });

describe('aménagement', () => {
  it('le café d’arrivée respecte les passages, et l’ambiance part de « Sympathique »', () => {
    const { world } = setup();
    expect(passageProblem(content, world, world.furniture, null)).toBeNull();
    const ambiance = computeAmbiance(content, world, { music: 2, cleanliness: 8 });
    expect(ambiance.dominantStyle).toBe('campagne');
    expect(ambiance.label).toBe('Sympathique');
    // La démo annonce 41 à l'arrivée (6.3); 42 ici, avec la propreté à 8 et la radio à 2.
    expect(ambiance.score).toBeGreaterThanOrEqual(38);
    expect(ambiance.score).toBeLessThanOrEqual(46);
  });

  it('achat livré le lendemain en carton, déballé, posé; refus d’un passage bouché', () => {
    const { world, step } = setup();
    step([as0({ type: 'amenagement-acheter', item: 'chaise-cintree', room: null })]);
    expect(world.arrangement.orders).toHaveLength(1);
    world.clientele.day = 2;
    const morning = step();
    expect(morning.some((e) => e.type === 'amenagement-livraison')).toBe(true);
    const carton = world.arrangement.cartons[0];
    expect(carton).toBeDefined();
    if (carton === undefined) return;
    const box = world.furniture.find((f) => f.id === carton.furniture);
    if (box === undefined) throw new Error('carton absent');
    world.players[0].x = box.x;
    world.players[0].z = box.z + 0.8;
    step([as0({ type: 'amenagement-prendre', furniture: carton.furniture })]);
    expect(world.arrangement.held[0]?.piece.type).toBe('chaise-cintree');
    // Dans l'allée de la porte au comptoir: refusé, avec une phrase claire.
    world.players[0].x = 9.4;
    world.players[0].z = 11.5;
    const refused = step([
      as0({ type: 'amenagement-poser', at: { x: 9.4, z: 11.2, y: 0, rotDeg: 0, support: null } }),
    ]);
    const reason = refused.find((e) => e.type === 'refused');
    expect(reason?.type === 'refused' ? reason.reason : '').toMatch(
      /salle|porte|passe|file|passage/,
    );
    // Près d'une table: posée, et tournée vers elle.
    world.players[0].x = 6.0;
    world.players[0].z = 10.6;
    const ok = step([
      as0({ type: 'amenagement-poser', at: { x: 6.4, z: 11.6, y: 0, rotDeg: 90, support: null } }),
    ]);
    const why = ok.find((e) => e.type === 'refused');
    expect(why?.type === 'refused' ? why.reason : 'posée').toBe('posée');
    const chair = world.furniture.find((f) => f.type === 'chaise-cintree');
    expect(chair?.rotDeg).toBe(0);
    // Une table qu'on range: aucune assise ne reste dos à sa nouvelle voisine.
    world.players[0].x = 6.4;
    world.players[0].z = 11.0;
    step([as0({ type: 'amenagement-ranger', furniture: 'table-2' })]);
    expect(world.furniture.some((f) => f.id === 'table-2')).toBe(false);
    expect(
      seatFacingIssues(world.furniture, content.furniture, content.settings.seating.tableReach),
    ).toEqual([]);
  });

  it('une table posée au milieu de la salle est refusée là où elle ferme un passage, avec sa cote', () => {
    const { world } = setup();
    const reasons = new Set<string>();
    let accepted = 0;
    for (let x = 4.375; x < 8.8; x += 0.25)
      for (let z = 9.575; z < 12.5; z += 0.25) {
        const v = checkPlacement(
          content,
          world,
          { type: 'table-bistrot-quatre', x, z, y: 0, rotDeg: 0, support: null },
          new Set(),
        );
        if (v.ok) accepted++;
        else reasons.add(v.reason);
      }
    expect(accepted).toBeGreaterThan(0);
    expect([...reasons].some((r) => /passage de \d+ cm/.test(r))).toBe(true);
  });

  it('port à deux: 1,2 m/s au plus, puis pose; un meuble lourd ne se prend pas seul en main', () => {
    const { world, step } = setup();
    world.arrangement.stock.push({ id: 'piece-banc', type: 'banc-ferme', worn: false });
    step([as0({ type: 'amenagement-sortir', piece: 'piece-banc' })]);
    const carton = world.arrangement.cartons[0];
    if (carton === undefined) throw new Error('gros carton absent');
    const load = world.furniture.find((f) => f.id === carton.furniture);
    if (load === undefined) throw new Error('charge absente');
    world.players[0].x = load.x - 0.9;
    world.players[0].z = load.z + 0.3;
    world.players[1].x = load.x + 0.9;
    world.players[1].z = load.z + 0.3;
    step([as0({ type: 'amenagement-prendre', furniture: load.id })]);
    expect(world.arrangement.carry?.handles[0]).not.toBeNull();
    step([{ player: 1, intent: { type: 'amenagement-prendre', furniture: load.id } }]);
    expect(world.arrangement.carry?.handles[1]).not.toBeNull();
    // Les deux poussent vers le sud (cap 180: regard vers +z) pendant une seconde.
    const push: StepInput = { ...IDLE_INPUT, moveZ: 1, fast: true, yawDeg: 180 };
    const z0 = load.z;
    for (let i = 0; i < 60; i++) step([], [push, push]);
    const moved = load.z - z0;
    expect(moved).toBeGreaterThan(0.5);
    expect(moved).toBeLessThanOrEqual(1.2 + 1e-6);
    const placeIt = step([
      as0({ type: 'amenagement-poser', at: { x: 0, z: 0, y: 0, rotDeg: 0, support: null } }),
    ]);
    expect(placeIt.some((e) => e.type === 'amenagement-port' || e.type === 'refused')).toBe(true);
  });

  it('une assise posée dos à sa table se retourne; un cadre se pose sur un mur libre', () => {
    const { world } = setup();
    const v = checkPlacement(
      content,
      world,
      { type: 'chaise-paillee', x: 4.35, z: 10.875, y: 0, rotDeg: 0, support: null },
      new Set(['seat-8']),
    );
    if (v.ok) expect(v.rotDeg).toBe(180);
    const frame = checkPlacement(
      content,
      world,
      { type: 'affiche-tilleul-1962', x: 4.015, z: 9.9, y: 1.4, rotDeg: 90, support: null },
      new Set(),
    );
    expect(frame.ok).toBe(true);
  });

  it('à deux en réseau: l’invité achète, l’hôte livre, le domaine et l’événement arrivent chez l’invité', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const t0 = performance.now();
      const now = (): number => performance.now() - t0;
      const host = createSession({ duo: duo.hostGame, content, now });
      const guest = createSession({ duo: duo.guestGame, content, now });
      const world = host.hostWorld();
      if (world === null) throw new Error('hôte sans monde');
      const seen: GameEvent[] = [];
      guest.view.onEvent((e) => seen.push(e));
      let seq = 0;
      const run = async (steps: number, guestIntents: Intent[] = []): Promise<void> => {
        for (let i = 0; i < steps; i++) {
          seq++;
          host.step({ ...IDLE_INPUT, seq }, [], DT);
          guest.step({ ...IDLE_INPUT, seq }, i === 0 ? guestIntents : [], DT);
          host.beforeFrame(1, DT);
          guest.beforeFrame(1, DT);
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      };
      await run(30, [{ type: 'amenagement-acheter', item: 'bouquet-champetre', room: null }]);
      await run(30);
      expect(world.arrangement.orders).toHaveLength(1);
      expect(guest.view.world().arrangement.orders).toHaveLength(1);
      expect(seen.some((e) => e.type === 'amenagement-achat' && e.player === 1)).toBe(true);
      world.clientele.day = 2;
      await run(40);
      expect(guest.view.world().arrangement.cartons).toHaveLength(1);
      expect(guest.view.world().furniture.some((f) => f.type === 'carton')).toBe(true);

      // Port à deux en réseau: la position de l'invité vient de la charge, sans prédiction.
      world.arrangement.stock.push({ id: 'piece-table', type: 'table-ferme', worn: false });
      host.step(
        { ...IDLE_INPUT, seq: ++seq },
        [{ type: 'amenagement-sortir', piece: 'piece-table' }],
        DT,
      );
      const cartonId = world.arrangement.cartons.find(
        (c) => c.piece.id === 'piece-table',
      )?.furniture;
      const load = world.furniture.find((f) => f.id === cartonId);
      if (load === undefined) throw new Error('gros carton absent');
      world.players[0].x = load.x - 0.85;
      world.players[0].z = load.z;
      world.players[1].x = load.x + 0.85;
      world.players[1].z = load.z;
      await run(20);
      host.step(
        { ...IDLE_INPUT, seq: ++seq },
        [{ type: 'amenagement-prendre', furniture: load.id }],
        DT,
      );
      await run(20, [{ type: 'amenagement-prendre', furniture: load.id }]);
      expect(world.arrangement.carry?.handles).toEqual([0, 1]);
      const z0 = load.z;
      for (let i = 0; i < 60; i++) {
        seq++;
        const push = { ...IDLE_INPUT, seq, moveZ: 1 as const, yawDeg: 180 };
        host.step(push, [], DT);
        guest.step(push, [], DT);
        host.beforeFrame(1, DT);
        guest.beforeFrame(1, DT);
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      await run(30);
      expect(load.z - z0).toBeGreaterThan(0.5);
      expect(load.z - z0).toBeLessThanOrEqual(1.2 + 1e-6);
      const shown = guest.view.pose(1);
      expect(Math.hypot(shown.x - world.players[1].x, shown.z - world.players[1].z)).toBeLessThan(
        0.1,
      );
    } finally {
      duo.dispose();
    }
  });
});
