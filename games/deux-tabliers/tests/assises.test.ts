// Assises, sons placés, textes des scènes (correctifs du 2026-11-08 avant la séance du client),
// tests courts: chaque client et chaque avatar s'assoit sur l'assise déclarée du meuble, face à
// sa table, et ne traverse pas la table pour s'y rendre ou en repartir.
import { createRandom } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { placeSound } from '../src/audio/espace';
import { ctxOf } from '../src/clientele';
import { hostWalkers, seat, spawnGroup } from '../src/clientele/clients';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { seatAnchor, seatTable } from '../src/etat/assises';
import type { PlacedFurniture, World } from '../src/etat/monde';
import { IDLE_INPUT, type StepInput } from '../src/simulation/entrees';
import { planAct } from '../src/simulation/interactions';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

const DT = 1 / 60;
const content = loadContent(DATA_FILES);

function insideTable(world: World, x: number, z: number, margin: number): string | null {
  for (const t of world.furniture) {
    const type = content.furniture.get(t.type);
    if (type?.kind !== 'table') continue;
    const r = (t.rotDeg * Math.PI) / 180;
    const dx = x - t.x;
    const dz = z - t.z;
    const lx = dx * Math.cos(r) - dz * Math.sin(r);
    const lz = dx * Math.sin(r) + dz * Math.cos(r);
    if (
      Math.abs(lx) < type.footprint[0] / 2 - margin &&
      Math.abs(lz) < type.footprint[1] / 2 - margin
    )
      return t.id;
  }
  return null;
}

function seats(world: World): PlacedFurniture[] {
  return world.furniture.filter((f) => content.furniture.get(f.type)?.kind === 'seat');
}

describe('Deux Tabliers, assises', () => {
  it("chaque assise du départ: hauteur de l'assise du modèle, face à sa table", () => {
    const world = createWorld(content, ['a', 'b']);
    expect(seats(world).length).toBeGreaterThan(0);
    for (const f of seats(world)) {
      const a = seatAnchor(content, world.furniture, f);
      // Chaise paillée et banc de ferme: assise à 0,45 m (`modeles.json`).
      expect(a.y).toBeCloseTo(0.45, 2);
      const t = seatTable(content, world.furniture, f);
      if (t === null) continue;
      const d = Math.hypot(t.x - a.x, t.z - a.z);
      expect((a.fx * (t.x - a.x) + a.fz * (t.z - a.z)) / d).toBeGreaterThan(0.7);
      // Cap des joueurs (0 regarde -z): le même sens que l'avant de l'assise.
      const yaw = (a.yawDeg * Math.PI) / 180;
      expect(-Math.sin(yaw)).toBeCloseTo(a.fx, 5);
      expect(-Math.cos(yaw)).toBeCloseTo(a.fz, 5);
    }
  });

  it("un banc sans dossier avec sa table au nord: on s'y assoit face au nord", () => {
    const world = createWorld(content, ['a', 'b']);
    const bench = world.furniture.find((f) => f.type === 'banc');
    expect(bench).toBeDefined();
    if (bench === undefined) return;
    world.furniture.push({
      id: 'table-n',
      type: 'gueridon',
      x: bench.x,
      z: bench.z - 0.6,
      y: 0,
      rotDeg: 0,
    });
    const a = seatAnchor(content, world.furniture, bench);
    expect(a.fz).toBeLessThan(-0.9);
  });

  it("un client va à sa chaise sans traverser la table, s'assoit sur l'assise et repart", () => {
    const world = createWorld(content, ['a', 'b']);
    const random = createRandom(5);
    const step = (intents: QueuedIntent[] = []): void => {
      stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, () => undefined);
    };
    step();
    for (const topic of ['next-day', 'open'] as const)
      step([
        { player: 0, intent: { type: 'clientele-vote', topic, yes: true } },
        { player: 1, intent: { type: 'clientele-vote', topic, yes: true } },
      ]);
    world.clientele.arrivals = [];
    world.clientele.expected = [];
    const sim: SimContext = {
      world,
      content,
      dt: DT,
      random,
      inputs: [IDLE_INPUT, IDLE_INPUT],
      emit: () => undefined,
    };
    const ctx = ctxOf(sim);
    const g = spawnGroup(ctx, { profile: 'teletravail', size: 1, items: ['espresso'] });
    g.paid = 0;
    seat(ctx, g);
    const chair = g.seats[0];
    expect(chair).toBeDefined();
    const f = world.furniture.find((x) => x.id === chair);
    expect(f).toBeDefined();
    if (f === undefined) return;
    const a = seatAnchor(content, world.furniture, f);
    const crossed: string[] = [];
    for (let i = 0; i < 60 * 40 && g.stage !== 'seated'; i++) {
      step();
      const w = hostWalkers(world).get(g.id);
      const t = w === undefined ? null : insideTable(world, w.x, w.z, 0.02);
      if (t !== null) crossed.push(t);
    }
    expect(g.stage).toBe('seated');
    const w = hostWalkers(world).get(g.id);
    expect(w?.x).toBeCloseTo(a.x, 3);
    expect(w?.z).toBeCloseTo(a.z, 3);
    g.leaveAt = world.clientele.serviceSec;
    g.open = 0;
    for (let i = 0; i < 60 * 40 && world.clientele.groups.includes(g); i++) {
      step();
      const v = hostWalkers(world).get(g.id);
      const t = v === undefined ? null : insideTable(world, v.x, v.z, 0.02);
      if (t !== null) crossed.push(t);
    }
    expect(world.clientele.groups.includes(g)).toBe(false);
    expect(crossed).toEqual([]);
  });

  it("un avatar s'assoit sur une assise libre, face à la table, et se relève en marchant", () => {
    const world = createWorld(content, ['a', 'b']);
    const random = createRandom(3);
    const chair = world.furniture.find((f) => f.id === 'seat-1');
    expect(chair).toBeDefined();
    if (chair === undefined) return;
    const target = { kind: 'seat', furniture: chair.id } as const;
    expect(planAct(content, world, 0, target).kind).toBe('sit');
    world.players[0].x = chair.x - 0.6;
    world.players[0].z = chair.z;
    const move = (moveZ: -1 | 0 | 1): StepInput => ({ ...IDLE_INPUT, moveZ, yawDeg: 90 });
    stepWorld(
      content,
      world,
      [IDLE_INPUT, IDLE_INPUT],
      [{ player: 0, intent: { type: 'act', target } }],
      DT,
      random,
      () => undefined,
    );
    const a = seatAnchor(content, world.furniture, chair);
    const p = world.players[0];
    expect(p.seat).toBe(chair.id);
    expect(p.x).toBeCloseTo(a.x, 5);
    expect(p.z).toBeCloseTo(a.z, 5);
    expect(p.yawDeg).toBeCloseTo(a.yawDeg, 5);
    // L'autre ne peut pas s'y asseoir.
    expect(planAct(content, world, 1, target)).toEqual({ kind: 'refuse', reason: 'Place prise' });
    stepWorld(content, world, [move(1), IDLE_INPUT], [], DT, random, () => undefined);
    expect(p.seat).toBeNull();
    expect(insideTable(world, p.x, p.z, -content.settings.player.radius + 0.05)).toBeNull();
  });
});

describe('Deux Tabliers, sons placés et textes des scènes', () => {
  it("le son s'atténue avec la distance et vient du bon côté", () => {
    const s = {
      distanceModel: 'inverse',
      refDistance: 1,
      rolloffFactor: 1,
      maxDistance: 12,
      cullBeyondM: 12,
    };
    const out = { gain: 0, pan: 0 };
    // Qui écoute regarde le nord (-z): l'est (+x) est à sa droite.
    const listener = { x: 0, z: 0, yawDeg: 0 };
    expect(placeSound(s, listener, 0, -1, out).gain).toBeCloseTo(1, 5);
    expect(placeSound(s, listener, 4, 0, out).gain).toBeCloseTo(0.25, 5);
    expect(out.pan).toBeGreaterThan(0.5);
    expect(placeSound(s, listener, -4, 0, out).pan).toBeLessThan(-0.5);
    expect(placeSound(s, listener, 13, 0, out).gain).toBe(0);
  });

  it("aucune durée dite dans une scène ne contredit l'horloge (1 s par minute de jeu)", () => {
    const text = JSON.stringify(DATA_FILES['clientele/evenements.json'] ?? '');
    expect(text.length).toBeGreaterThan(100);
    expect(text).not.toMatch(/dans vingt minutes|trente secondes/);
  });
});
