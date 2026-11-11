// Endurance (réponse du client du 2026-11-11): vidage en courant, seuil de reprise, recharge selon
// la posture, renforts des plats, sauvegardes d'avant l'endurance, même jauge chez l'invité.
import { startLocalDuo } from '@duo/sdk-dev';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { loadContent } from '../src/donnees/charger';
import { ItemSchema } from '../src/donnees/schemas/objets';
import { WorldSchema } from '../src/etat/monde';
import { staminaView } from '../src/interface/endurance';
import { fastMessage } from '../src/reseau/tranches';
import { readSave } from '../src/sauvegarde/format';
import { createSession } from '../src/session';
import {
  applyFoodStamina,
  canRun,
  stepStamina,
  type StaminaPosture,
} from '../src/simulation/besoins/endurance';
import { SIM_DT, SIM_HZ } from '../src/simulation/noyau/constantes';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { step, type Sim } from '../src/simulation/noyau/pas';
import { createPredictor } from '../src/simulation/noyau/prediction';
import { contextOf } from './aides-l3';
import { put, run, send } from './aides-noyau';
import { dataFiles, gameContent, newSim } from './aides';
import { referenceSave } from './aides-sauvegarde';

const content = gameContent();
const settings = content.needs.stamina;
const { walkSpeed, runSpeed } = content.settings.movement;

/** Besoins au palier neutre: ni bonus ni malus de vitesse. */
function neutral(sim: Sim): void {
  for (const p of sim.world.players) Object.assign(p.needs, { hunger: 40, sleep: 40, hygiene: 40 });
  run(sim, SIM_DT);
}

/** Un joueur sur le quai, face à l'est, avec 100 m dégagés devant lui. */
function onQuay(): Sim {
  const sim = newSim(content);
  neutral(sim);
  put(sim, 0, 5, 20, 0);
  put(sim, 1, 5, 25, 0);
  return sim;
}

describe('endurance', () => {
  it('des réglages tranquilles: une traversée du bourg d’une traite, la reprise avant la jauge pleine', () => {
    // La Grand-Route d'Aubrune, de la maison à l'arrêt du car: 150 m environ (plan d'Aubrune).
    expect(settings.runSeconds * runSpeed).toBeGreaterThan(150);
    expect(settings.recoverAt).toBeLessThan(0.5);
    const { walk, still, seated, lying } = settings.refillSeconds;
    expect(walk).toBeGreaterThan(still);
    expect(still).toBeGreaterThan(seated);
    expect(seated).toBeGreaterThan(lying);
  });

  it('se vide en courant, puis on marche sans autre peine', () => {
    const sim = onQuay();
    const a = sim.world.players[0];
    sim.world.players[0].stamina = 3 / settings.runSeconds;
    run(sim, 1, { moveX: 1, run: true });
    expect(a.body.speed).toBeCloseTo(runSpeed, 6);
    // Une seconde, dont l'élan: un peu plus d'une seconde de course mangée, pas plus.
    expect(a.stamina).toBeLessThan(2.6 / settings.runSeconds);
    run(sim, 2.5, { moveX: 1, run: true });
    expect(a.stamina).toBe(0);
    expect(a.staminaMods.winded).toBe(true);
    expect(canRun(sim.world, 0)).toBe(false);
    run(sim, 1, { moveX: 1, run: true });
    expect(a.body.speed).toBeCloseTo(walkSpeed, 6);
  });

  it('ne reprend la course qu’au seuil de reprise: pas de clignotement', () => {
    const sim = onQuay();
    const a = sim.world.players[0];
    a.stamina = 0.5 / settings.runSeconds;
    let switches = 0;
    let winded = a.staminaMods.winded;
    let windedSteps = 0;
    for (let i = 0; i < 40 * SIM_HZ; i++) {
      run(sim, SIM_DT, { moveX: 1, run: true });
      if (a.staminaMods.winded !== winded) switches += 1;
      winded = a.staminaMods.winded;
      if (winded) {
        windedSteps += 1;
        expect(a.stamina).toBeLessThan(settings.recoverAt + 1e-9);
      }
      a.body.x = 5; // Sur place: la course ne finit pas dans un mur.
    }
    // Essoufflé une fois, repris une fois, au seuil: il remarche le temps de remonter.
    expect(switches).toBe(2);
    const walkRefill = settings.refillSeconds.walk * settings.recoverAt;
    expect(windedSteps * SIM_DT).toBeGreaterThan(walkRefill * 0.9);
    expect(a.staminaMods.winded).toBe(false);
  });

  it('se recharge selon la posture: marche, arrêt, assis, couché; et au réveil', () => {
    const gained = (posture: StaminaPosture): number => {
      const sim = newSim(content);
      const ctx = contextOf(sim);
      sim.world.players[0].stamina = 0;
      for (let i = 0; i < 2 * SIM_HZ; i++) stepStamina(ctx, 0, posture);
      return sim.world.players[0].stamina;
    };
    const [walk, still, seated, lying] = (['walk', 'still', 'seated', 'lying'] as const).map(
      gained,
    );
    expect(walk).toBeCloseTo(2 / settings.refillSeconds.walk, 6);
    expect(still).toBeCloseTo(2 / settings.refillSeconds.still, 6);
    expect(seated).toBeCloseTo(2 / settings.refillSeconds.seated, 6);
    expect(lying).toBeCloseTo(2 / settings.refillSeconds.lying, 6);
    // Dans la vraie boucle: arrêté, la jauge remonte plus vite qu'en marchant.
    const sim = onQuay();
    sim.world.players[0].stamina = 0.2;
    sim.world.players[1].stamina = 0.2;
    run(sim, 3, { moveX: 1 }, {});
    const [walker, stander] = sim.world.players;
    expect(stander.stamina - 0.2).toBeGreaterThan(2 * (walker.stamina - 0.2));
  });

  it('un plat la renforce: recharge immédiate, capacité et recharge plus rapide pendant une durée', () => {
    const sim = onQuay();
    const a = sim.world.players[0];
    const b = sim.world.players[1];
    a.stamina = 0;
    a.staminaMods.winded = true;
    b.stamina = 0;
    a.toolbar[0] = { item: 'pot-au-feu', count: 1 };
    b.toolbar[0] = { item: 'pomme', count: 1 };
    send(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 0 } });
    send(sim, 1, { type: 'eat', from: { area: 'toolbar', index: 0 } });
    // Un plat chaud nourrit mieux qu'une pomme.
    expect(a.stamina).toBeGreaterThan(b.stamina + 0.5);
    expect(a.staminaMods.winded).toBe(false);
    expect(a.staminaMods.capacity?.extra).toBe(0.5);
    expect(a.staminaMods.recovery?.factor).toBe(1.5);
    expect(staminaView(content, sim.world, 0)).toMatchObject({
      length: 1.5,
      capacityBoost: true,
      recoveryBoost: true,
      idle: false,
    });
    // La capacité augmentée se remplit: plus de secondes de course qu'une jauge de base.
    run(sim, 60);
    expect(a.stamina).toBeCloseTo(1.5, 6);
    const until = a.staminaMods.capacity?.until ?? 0;
    run(sim, (until - sim.world.tick + 1) * SIM_DT);
    expect(a.staminaMods.capacity).toBeNull();
    expect(a.staminaMods.recovery).toBeNull();
    expect(a.stamina).toBe(1);
    expect(staminaView(content, sim.world, 0).idle).toBe(true);
  });

  it('deux renforts du même genre gardent le plus fort et la fin la plus tardive', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    applyFoodStamina(ctx, 0, { capacity: { extra: 0.5, seconds: 60 } });
    applyFoodStamina(ctx, 0, { capacity: { extra: 0.25, seconds: 120 } });
    expect(sim.world.players[0].staminaMods.capacity).toEqual({
      extra: 0.5,
      until: sim.world.tick + 120 * SIM_HZ,
    });
  });

  it('le renfort se déclare en données, validé par schéma; un plat factice en profite sans code', () => {
    const fx = (stamina: unknown): boolean =>
      v.safeParse(ItemSchema, {
        schema: 1,
        id: 'poire',
        name: 'Poire',
        family: 'food',
        stack: 5,
        food: { hunger: 10, stamina },
        tool: null,
      }).success;
    expect(fx({ refill: 0.2 })).toBe(true);
    expect(fx({ recovery: { factor: 1.5, seconds: 120 } })).toBe(true);
    expect(fx({})).toBe(false);
    expect(fx({ refill: 3 })).toBe(false);
    expect(fx({ capacity: { extra: 0.5 } })).toBe(false);
    const files = dataFiles();
    files['commun/objets/poire-essai.json'] = {
      schema: 1,
      id: 'poire-essai',
      name: 'Poire',
      family: 'food',
      stack: 5,
      food: { hunger: 10, stamina: { refill: 0.4 } },
      tool: null,
    };
    const withPear = loadContent(files);
    const sim = newSim(withPear);
    sim.world.players[0].stamina = 0.1;
    sim.world.players[0].toolbar[0] = { item: 'poire-essai', count: 1 };
    send(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 0 } });
    expect(sim.world.players[0].stamina).toBeCloseTo(0.5, 2);
  });

  it('les sauvegardes d’avant l’endurance se chargent avec une jauge pleine', () => {
    for (const version of [1, 2]) {
      const read = readSave(referenceSave(version));
      if (!read.ok) throw new Error(read.reason);
      for (const p of read.world.players) {
        expect(p.stamina).toBe(1);
        expect(p.staminaMods).toEqual({ winded: false, capacity: null, recovery: null });
      }
    }
    // Les deux joueurs ne partagent pas le même objet par défaut.
    const read = readSave(referenceSave(2));
    if (!read.ok) throw new Error(read.reason);
    expect(read.world.players[0].staminaMods).not.toBe(read.world.players[1].staminaMods);
    // Et l'état courant fait l'aller-retour.
    const sim = newSim(content);
    sim.world.players[1].stamina = 0.42;
    sim.world.players[1].staminaMods.winded = true;
    const again = v.parse(WorldSchema, JSON.parse(JSON.stringify(sim.world)));
    expect(again.players[1].stamina).toBe(0.42);
    expect(again.players[1].staminaMods.winded).toBe(true);
  });

  it('l’invité prédit l’essoufflement au bit près', () => {
    const predictor = createPredictor(content);
    const sim = onQuay();
    sim.world.players[1].stamina = 0.5 / settings.runSeconds;
    const body = { ...sim.world.players[1].body };
    let winded = false;
    for (let i = 0; i < 60; i++) {
      const input: StepInput = { ...idleInput(i), moveX: 1, run: true };
      predictor.walk(sim.world, 1, body, input);
      step(sim, [idleInput(i), input], []);
      expect(body).toEqual(sim.world.players[1].body);
      winded ||= sim.world.players[1].staminaMods.winded;
    }
    expect(winded).toBe(true);
  });

  it('l’invité voit la même jauge et les mêmes renforts que l’hôte', async () => {
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 5,
    });
    try {
      await duo.start();
      const host = createSession({ duo: duo.hostGame, content });
      const guest = createSession({ duo: duo.guestGame, content });
      const sim = host.hostSim();
      if (sim === null) throw new Error('hôte sans simulation');
      const turn = async (from: number, to: number): Promise<void> => {
        for (let i = from; i <= to; i++) {
          host.step(idleInput(i));
          guest.step(idleInput(i));
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      };
      await turn(1, 20);
      sim.world.players[1].stamina = 0.05;
      applyFoodStamina(contextOf(sim), 1, {
        refill: 0.25,
        capacity: { extra: 0.25, seconds: 60 },
      });
      sim.revisions.players += 1;
      await turn(21, 40);
      const seen = guest.view.world();
      if (seen === null) throw new Error('invité sans état');
      const truth = sim.world.players[1];
      // Le dernier instantané reçu a un pas de retard au plus: même valeur à la recharge près.
      expect(seen.players[1].stamina).toBeCloseTo(truth.stamina, 2);
      expect(seen.players[1].staminaMods).toEqual(truth.staminaMods);
      expect(fastMessage(sim.world, content, -1).stamina).toEqual([
        sim.world.players[0].stamina,
        truth.stamina,
      ]);
      expect(duo.logs.filter((entry) => entry.level === 'error')).toEqual([]);
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
