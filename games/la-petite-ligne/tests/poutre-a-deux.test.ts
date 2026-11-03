/**
 * Retour S01 (2026-11-02): la poutre se prenait mal à deux. Elle mesure 4,5 m, mais la portée se
 * comptait depuis son centre (2 m): qui la prenait par un bout restait les mains vides. Et, soulevée,
 * elle pivotait vers la ligne des deux porteurs.
 */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../src/etat/types';
import { SIM_HZ } from '../src/simulation/constantes';
import { character, type Sim } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { step } from '../src/simulation/pas';
import { createRobot, newSim, play } from './aides';

/** Jour 1, scène finie, la poutre au sol devant la scierie. */
function atBeam(): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  return sim;
}

const beamOf = (sim: Sim): NonNullable<Sim['world']['beam']> => {
  const b = sim.world.beam;
  if (b === null) throw new Error('poutre absente');
  return b;
};

/** Point à `along` m le long de la poutre et `across` m de côté. */
function besideBeam(sim: Sim, along: number, across: number): Vec2 {
  const b = beamOf(sim);
  const ux = Math.cos(b.facing);
  const uy = Math.sin(b.facing);
  return { x: b.pos.x + ux * along - uy * across, y: b.pos.y + uy * along + ux * across };
}

/** Les deux tiennent Espace (appui au premier pas), et poussent selon (mx, my). */
function hold(sim: Sim, ticks: number, mx = 0, my = 0): void {
  for (let i = 0; i < ticks; i++) {
    const frame = { seq: i, moveX: mx, moveY: my, actHeld: true };
    step(sim, {
      controls: { p1: frame, p2: frame },
      intents: i === 0 ? [{ by: 'p1', intent: { type: 'act' } }, { by: 'p2', intent: { type: 'act' } }] : [],
    });
  }
}

function place(sim: Sim, p1: Vec2, p2: Vec2): void {
  placeCharacter(sim, character(sim, 'p1'), p1);
  placeCharacter(sim, character(sim, 'p2'), p2);
  for (const id of ['p1', 'p2'] as const) character(sim, id).action = { kind: 'idle', since: sim.world.tick, duration: 0, target: null };
}

describe('la poutre portée à deux (S01)', () => {
  it('se prend par les deux bouts, sans pivoter, et se porte', () => {
    const sim = atBeam();
    const beam = beamOf(sim);
    const facing = beam.facing;
    // Chacun devant un bout, juste au-delà de l'extrémité (2,25 m du centre).
    place(sim, besideBeam(sim, -2.5, 0.2), besideBeam(sim, 2.5, -0.2));
    hold(sim, 3);
    expect(beam.carried).toBe(true);
    expect(beam.facing).toBeCloseTo(facing, 6);
    // Rangés contre la poutre, chacun de son côté, les mains sur le bois (pas au-delà du bout).
    for (const id of ['p1', 'p2'] as const) {
      const c = character(sim, id);
      const t = (c.pos.x - beam.pos.x) * Math.cos(facing) + (c.pos.y - beam.pos.y) * Math.sin(facing);
      expect(Math.abs(t)).toBeLessThanOrEqual(2.25);
      expect(Math.abs(t)).toBeGreaterThan(1.5);
    }
    const start = { ...beam.pos };
    hold(sim, SIM_HZ, 0, 1);
    expect(beam.carried).toBe(true);
    expect(Math.hypot(beam.pos.x - start.x, beam.pos.y - start.y)).toBeGreaterThan(1);
  });

  it('prise de part et d\'autre du milieu: elle ne tourne pas vers les porteurs', () => {
    const sim = atBeam();
    const beam = beamOf(sim);
    const facing = beam.facing;
    place(sim, besideBeam(sim, -0.5, -0.8), besideBeam(sim, 0.5, 0.8));
    hold(sim, 3);
    expect(beam.carried).toBe(true);
    expect(beam.facing).toBeCloseTo(facing, 6);
  });

  it('trop loin de la poutre, rien ne se soulève', () => {
    const sim = atBeam();
    place(sim, besideBeam(sim, -2.5, 2.5), besideBeam(sim, 2.5, -2.5));
    hold(sim, 3);
    expect(beamOf(sim).carried).toBe(false);
  });
});
