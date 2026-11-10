// Le prédicteur fourni au réseau refait exactement le pas de l'hôte; séance à deux de bout en bout.
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { createSession } from '../src/session';
import { idleInput, type StepInput } from '../src/simulation/noyau/entrees';
import { step } from '../src/simulation/noyau/pas';
import { createPredictor } from '../src/simulation/noyau/prediction';
import { gameContent, newSim } from './aides';
import { put, send } from './aides-noyau';

const content = gameContent();
const predictor = createPredictor(content);

describe('prédicteur', () => {
  it('marche comme l’hôte, au bit près, murs et meubles compris', () => {
    const sim = newSim(content);
    // Vers le pommier (case 10, 22), en courant puis en biais: accélération, coin, glissement.
    put(sim, 1, 10.9, 25, 0);
    const body = { ...sim.world.players[1].body };
    for (let i = 0; i < 90; i++) {
      const input: StepInput = {
        ...idleInput(i),
        moveX: i < 60 ? -0.3 : 1,
        moveY: i < 75 ? -1 : 0,
        run: i % 40 < 20,
      };
      expect(predictor.canWalk(sim.world, 1)).toBe(true);
      predictor.walk(sim.world, 1, body, input);
      step(sim, [idleInput(i), input], []);
      expect(body).toEqual(sim.world.players[1].body);
    }
    expect(body.y).toBeLessThan(25);
  });

  it('annonce le geste que l’hôte lancera, et rien quand l’appui sera refusé ou sans cible', () => {
    const sim = newSim(content);
    const state = sim.world.places['essai-gare'];
    if (state === undefined) throw new Error('lieu absent');
    put(sim, 1, 30, 30, 0);
    expect(predictor.gesture(sim.world, 1, { type: 'act' })).toBeNull();
    state.ground.push({ id: 4, stack: { item: 'pomme', count: 1 }, x: 30.8, y: 30 });
    const predicted = predictor.gesture(sim.world, 1, { type: 'act' });
    expect(predicted).toEqual({ clip: 'pickup', target: 'sol-4', ticks: 15, long: false });
    send(sim, 1, { type: 'act' });
    expect(sim.world.players[1].gesture).toMatchObject({
      clip: 'pickup',
      target: 'sol-4',
      until: sim.world.tick + 15,
    });
    // Pendant le geste: ni marche ni nouveau geste.
    expect(predictor.canWalk(sim.world, 1)).toBe(false);
    expect(predictor.gesture(sim.world, 1, { type: 'act' })).toBeNull();
  });
});

describe('séance à deux', () => {
  it('fait marcher l’invité chez l’hôte et lui montre sa cible avant l’appui', async () => {
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
      const start = { ...sim.world.players[1].body };
      // L'invité descend vers le sud; l'hôte ne touche à rien.
      for (let i = 1; i <= 60; i++) {
        host.step(idleInput(i));
        guest.step({ ...idleInput(i), moveY: 1 });
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      expect(sim.world.players[1].body.y).toBeGreaterThan(start.y + 2);
      expect(sim.world.players[0].body.y).toBe(start.y);
      const shown = guest.view.frame(1);
      expect(shown?.players[1].body.y).toBeGreaterThan(start.y + 2);
      // L'invité s'arrête (les commandes en file s'épuisent), puis on le pose face à l'habitante.
      for (let i = 61; i <= 75; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      // Posé face à l'habitante, l'invité lit sa cible et son verbe sur son propre état.
      sim.world.players[1].body = { x: 20, y: 16, facing: -Math.PI / 2, speed: 0 };
      for (let i = 76; i <= 95; i++) {
        host.step(idleInput(i));
        guest.step(idleInput(i));
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
      expect(guest.view.world()?.players[1].aim).toBe('cheffe-de-gare');
      expect(guest.view.aim(1)).toMatchObject({ id: 'cheffe-de-gare', verb: 'Parler' });
      host.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  });
});
