// Marche à 1,5 m/s et course à part (décision du client): vitesses de la configuration, passage
// doux de l'une à l'autre, effet des besoins, prix de la course, prédiction de l'invité.
import { describe, expect, it } from 'vitest';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { speedFactorOf } from '../src/simulation/noyau/deplacement';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { createPredictor } from '../src/simulation/noyau/prediction';
import { VILLAGERS } from '../src/simulation/habitants/reglages';
import { gameContent, newSim } from './aides';
import { put, run } from './aides-noyau';

const content = gameContent();
const { walkSpeed, runSpeed, runShiftSeconds } = content.settings.movement;

/** Les trois jauges au palier neutre (21 à 50): ni bonus ni malus de vitesse. */
function neutral(sim: Sim): void {
  for (const p of sim.world.players) Object.assign(p.needs, { hunger: 40, sleep: 40, hygiene: 40 });
  run(sim, SIM_DT);
}

describe('marche et course', () => {
  it('marche à 1,5 m/s par défaut, court à part en maintenant la touche', () => {
    expect(walkSpeed).toBe(1.5);
    expect(runSpeed).toBeGreaterThan(walkSpeed * 2);
    const sim = newSim(content);
    neutral(sim);
    expect(speedFactorOf(content, sim.world, 0)).toBe(1);
    put(sim, 0, 5, 20, 0);
    run(sim, 1, { moveX: 1 });
    expect(sim.world.players[0].body.speed).toBeCloseTo(1.5, 6);
    run(sim, 1, { moveX: 1, run: true });
    expect(sim.world.players[0].body.speed).toBeCloseTo(runSpeed, 6);
  });

  it('passe de la marche à la course en douceur, et revient de même', () => {
    const sim = newSim(content);
    neutral(sim);
    put(sim, 0, 5, 20, 0);
    run(sim, 0.5, { moveX: 1 });
    const body = sim.world.players[0].body;
    const shift = runShiftSeconds ?? 0;
    expect(shift).toBeGreaterThan(0.2);
    const most = ((runSpeed - walkSpeed) / shift) * SIM_DT + 1e-9;
    let previous = body.speed;
    let steps = 0;
    while (body.speed < runSpeed - 1e-6 && steps < 60) {
      run(sim, SIM_DT, { moveX: 1, run: true });
      expect(body.speed - previous).toBeLessThanOrEqual(most);
      previous = body.speed;
      steps += 1;
    }
    expect(steps * SIM_DT).toBeCloseTo(shift, 1);
    run(sim, SIM_DT, { moveX: 1 });
    expect(previous - body.speed).toBeLessThanOrEqual(most);
    expect(body.speed).toBeGreaterThan(walkSpeed);
    run(sim, shift + SIM_DT, { moveX: 1 });
    expect(body.speed).toBeCloseTo(walkSpeed, 6);
  });

  it('les besoins règlent la vitesse: bien reposé plus vite, affamé plus lent', () => {
    const sim = newSim(content);
    neutral(sim);
    sim.world.players[0].needs.sleep = 90;
    sim.world.players[1].needs.hunger = 0;
    run(sim, SIM_DT);
    expect(speedFactorOf(content, sim.world, 0)).toBeCloseTo(1.1, 6);
    expect(speedFactorOf(content, sim.world, 1)).toBeCloseTo(0.5, 6);
    put(sim, 0, 5, 20, 0);
    put(sim, 1, 5, 25, 0);
    run(sim, 1, { moveX: 1 }, { moveX: 1, run: true });
    expect(sim.world.players[0].body.speed).toBeCloseTo(1.65, 6);
    expect(sim.world.players[1].body.speed).toBeCloseTo(runSpeed * 0.5, 6);
  });

  it('la course creuse l’appétit (faim 1,5 fois plus vite), sans fatigue ni jauge d’endurance', () => {
    const hunger = content.needs.needs.find((n) => n.id === 'hunger');
    const sleep = content.needs.needs.find((n) => n.id === 'sleep');
    expect(hunger?.effortFactor).toBe(1.5);
    expect(sleep?.effortFactor).toBe(1);
    const sim = newSim(content);
    neutral(sim);
    put(sim, 0, 5, 20, 0);
    put(sim, 1, 5, 25, 0);
    run(sim, 6, { moveX: 1, run: true }, { moveX: 1 });
    const [a, b] = sim.world.players;
    expect(40 - a.needs.hunger).toBeCloseTo(1.5 * (40 - b.needs.hunger), 2);
    expect(a.needs.sleep).toBeCloseTo(b.needs.sleep, 6);
  });

  it('« il court » (habitants, insectes) se lit entre la marche reposée et la course fatiguée', () => {
    const fastestWalk = walkSpeed * content.needs.maxBonus;
    const slowestRun = runSpeed * 0.8;
    for (const threshold of [VILLAGERS.runSpeed, content.time.file.insects.runThreshold]) {
      expect(threshold).toBeGreaterThan(fastestWalk);
      expect(threshold).toBeLessThan(slowestRun);
    }
  });

  it('l’invité prédit au bit près, facteur des besoins compris', () => {
    const predictor = createPredictor(content);
    const sim = newSim(content);
    neutral(sim);
    sim.world.players[1].needs.hunger = 10;
    run(sim, SIM_DT);
    expect(speedFactorOf(content, sim.world, 1)).toBeCloseTo(0.8, 6);
    put(sim, 1, 5, 25, 0);
    const body = { ...sim.world.players[1].body };
    for (let i = 0; i < 60; i++) {
      const input: StepInput = { ...idleInput(i), moveX: 1, run: i >= 20 };
      predictor.walk(sim.world, 1, body, input);
      step(sim, [idleInput(i), input], []);
      expect(body).toEqual(sim.world.players[1].body);
    }
  });
});
