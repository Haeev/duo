// Endurance (qa-testeur, recette de la démo du 2026-10-31): les robots jouent la démo entière sur
// plusieurs graines. Chaque partie doit finir (commande payée), sans blocage de l'horloge, sans
// état incohérent, et l'état doit toujours tenir dans un message de 64 Kio (ADR 0007).
import { describe, expect, it } from 'vitest';
import type { WorldState } from '../src/etat/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import type { Sim } from '../src/simulation/contexte';
import { SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, fullOrderAmount, newSim } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/** Borne de sécurité: deux heures de jeu réel. */
const MAX_TICKS = SIM_HZ * 60 * 120;
/** Taille maximale de l'état transmis à l'invité (ADR 0007). */
const MAX_STATE_BYTES = 64 * 1024;
/** Blocage: l'heure de jeu n'avance plus pendant cinq minutes réelles. */
const STALL_TICKS = SIM_HZ * 60 * 5;
/** Contrôle de taille et de cohérence toutes les dix secondes réelles. */
const CHECK_EVERY = SIM_HZ * 10;

const SEEDS = [1, 7, 42, 99, 2026, 31_337, 123_456, 20_261_031];

interface Run {
  ticks: number;
  maxBytes: number;
  longestStall: number;
}

/** Heure de jeu absolue, en minutes depuis le jour 1 à minuit. */
function gameTime(w: WorldState): number {
  return w.clock.day * 24 * 60 + w.clock.minutes;
}

function checkCoherent(w: WorldState): void {
  expect(w.characters).toHaveLength(2);
  expect(w.purse).toBeGreaterThanOrEqual(0);
  for (const c of w.characters) {
    expect(Number.isFinite(c.pos.x) && Number.isFinite(c.pos.y), `${c.id} position finie`).toBe(true);
    expect(c.pos.x, `${c.id} dans la carte`).toBeGreaterThanOrEqual(0);
    expect(c.pos.y, `${c.id} dans la carte`).toBeGreaterThanOrEqual(0);
  }
}

/**
 * Joue jusqu'à la fin de la démo en surveillant l'horloge et la taille de l'état.
 * `onDawn` est appelé à chaque nouveau jour (sauvegarde et reprise).
 */
function playToEnd(start: Sim, riddle: boolean, onDawn?: (sim: Sim) => Sim): { sim: Sim; run: Run } {
  let sim = start;
  let robot = createRobot({ riddle });
  let ticks = 0;
  let maxBytes = 0;
  let lastTime = gameTime(sim.world);
  let lastProgressTick = 0;
  let longestStall = 0;
  let day = sim.world.clock.day;
  while (sim.world.phase !== 'ended' && ticks < MAX_TICKS) {
    step(sim, robot.decide(sim));
    ticks++;
    const now = gameTime(sim.world);
    if (now !== lastTime) {
      expect(now, 'l’heure de jeu ne recule jamais').toBeGreaterThan(lastTime);
      longestStall = Math.max(longestStall, ticks - lastProgressTick);
      lastTime = now;
      lastProgressTick = ticks;
    }
    if (ticks - lastProgressTick > STALL_TICKS) {
      throw new Error(
        `Blocage: horloge arrêtée depuis ${STALL_TICKS} pas (phase ${sim.world.phase}, jour ${sim.world.clock.day}, ` +
          `${sim.world.clock.minutes} min, arrêt ${String(sim.world.clock.stoppedBy)}, robots: ` +
          `${robot.job('p1')} / ${robot.job('p2')})`,
      );
    }
    if (ticks % CHECK_EVERY === 0) {
      maxBytes = Math.max(maxBytes, JSON.stringify(sim.world).length);
      checkCoherent(sim.world);
    }
    if (onDawn !== undefined && sim.world.clock.day !== day && sim.world.phase === 'breakfast') {
      day = sim.world.clock.day;
      sim = onDawn(sim);
      robot = createRobot({ riddle });
    }
  }
  maxBytes = Math.max(maxBytes, JSON.stringify(sim.world).length);
  return { sim, run: { ticks, maxBytes, longestStall } };
}

function expectDemoFinished(sim: Sim, run: Run, keyExpected: boolean): void {
  const w = sim.world;
  expect(w.phase, 'la démo se termine').toBe('ended');
  expect(run.ticks).toBeLessThan(MAX_TICKS);
  const { content } = contentAndMap();
  const last = content.settings.clock.lastDay.day;
  expect(w.clock.day).toBe(last);
  expect(w.orderHistory, 'une commande payée par train').toHaveLength(content.settings.order.trains.length);
  expect(w.orderHistory[0], 'commande 1 complète, 540 sous').toMatchObject({ complete: true, amount: 540 });
  w.orderHistory.forEach((o, i) => {
    expect(o.complete, `commande ${i + 1} complète`).toBe(true);
    expect(o.amount, `commande ${i + 1} payée en entier`).toBeGreaterThanOrEqual(fullOrderAmount(content, i));
  });
  expect(w.ending?.days).toBe(last);
  expect(w.ending?.linesDone).toBe(w.ending?.linesTotal);
  expect(w.ending?.keyFound).toBe(keyExpected);
  expect(w.characters.every((c) => c.created)).toBe(true);
  expect(run.maxBytes, 'état sous 64 Kio').toBeLessThan(MAX_STATE_BYTES);
  checkCoherent(w);
}

describe('endurance des robots', () => {
  for (const seed of SEEDS) {
    it(`graine ${seed}: la démo se termine, commande payée, sans blocage`, () => {
      const { sim, run } = playToEnd(newSim(seed), true);
      expectDemoFinished(sim, run, true);
    });
  }

  for (const seed of [3, 5150]) {
    it(`graine ${seed}, sans l’énigme d’Émile: la démo se termine quand même (D-08)`, () => {
      const { sim, run } = playToEnd(newSim(seed), false);
      expectDemoFinished(sim, run, false);
      expect(sim.world.worldStates.handcar_shed).toBe('closed');
    });
  }

  it('sauvegarde et reprise à chaque aube en inversant hôte et invité: la démo se termine', () => {
    const { content, map } = contentAndMap();
    let swapped = false;
    const { sim, run } = playToEnd(newSim(777), true, (current) => {
      const snap = snapshotOf(current);
      const data = JSON.parse(JSON.stringify(snap.data)) as unknown;
      swapped = !swapped;
      const restored = restoreWorld(content, map, data, snap.dataSchema, swapped ? [B, A] : [A, B]);
      // Chacun retrouve son personnage, quelle que soit la machine qui héberge.
      expect(restored.world.characters.find((c) => c.playerId === A.id)?.id).toBe('p1');
      expect(restored.world.characters.find((c) => c.playerId === B.id)?.id).toBe('p2');
      return restored;
    });
    expectDemoFinished(sim, run, true);
  });
});
