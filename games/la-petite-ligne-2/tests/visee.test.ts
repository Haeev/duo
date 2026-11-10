// Visée de la touche d'action: une cible, toujours un objet, choisie selon l'axe et l'outil en main.
import { describe, expect, it } from 'vitest';
import { BRICK_BEHAVIOURS } from '../src/simulation/briques/registre';
import type { BrickRegistry } from '../src/simulation/briques/types';
import { aimOf } from '../src/simulation/briques/visee';
import { gameContent, newSim } from './aides';
import { contentWith, NORTH, put, run, SOUTH } from './aides-noyau';

const content = gameContent();
const reach = content.settings.reach.action;

/** Registre d'essai: la brique `gather` y répond, pour viser les meubles des données. */
const withGather: BrickRegistry = {
  ...BRICK_BEHAVIOURS,
  gather: {
    verb: 'Prendre',
    refuse: () => null,
    use: () => undefined,
  },
};

describe('cible de la touche d’action', () => {
  it('n’existe jamais sans objet: rien devant, pas de cible', () => {
    const sim = newSim(content);
    put(sim, 0, 5, 30, 0);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toBeNull();
    expect(sim.world.players[0].aim).toBeNull();
  });

  it('montre l’habitant devant soi avec son verbe, et l’écrit dans l’état', () => {
    const sim = newSim(content);
    // La cheffe de gare se tient au guichet (20, 15).
    put(sim, 0, 20, 16, NORTH);
    const revision = sim.revisions.players;
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({
      kind: 'villager',
      id: 'cheffe-de-gare',
      action: 'talk',
      verb: 'Parler',
      refusal: null,
    });
    expect(sim.world.players[0].aim).toBe('cheffe-de-gare');
    expect(sim.revisions.players).toBe(revision + 1);
    expect(sim.world.players[1].aim).toBeNull();
  });

  it('ne vise ni dans son dos ni hors de portée', () => {
    const sim = newSim(content);
    put(sim, 0, 20, 16, SOUTH);
    expect(aimOf(sim, 0)).toBeNull();
    put(sim, 0, 20, 15 + reach + 0.1, NORTH);
    expect(aimOf(sim, 0)).toBeNull();
  });

  it('ignore un meuble dont aucune brique n’a de comportement', () => {
    const sim = newSim(content);
    put(sim, 0, 10.5, 23.5, NORTH);
    expect(aimOf(sim, 0, {})).toBeNull();
    expect(aimOf(sim, 0, withGather)).toMatchObject({
      kind: 'prop',
      id: 'pommier',
      action: 'gather',
      verb: 'Cueillir',
    });
  });

  it('entre deux cibles, prend la plus proche de l’axe du regard', () => {
    const sim = newSim(content);
    const state = sim.world.places['essai-gare'];
    if (state === undefined) throw new Error('lieu absent');
    state.ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 30.9, y: 30.2 });
    state.ground.push({ id: 1, stack: { item: 'buche', count: 1 }, x: 30.6, y: 30.9 });
    put(sim, 0, 30, 30, 0);
    expect(aimOf(sim, 0)?.id).toBe('sol-0');
    put(sim, 0, 30, 30, SOUTH);
    expect(aimOf(sim, 0)?.id).toBe('sol-1');
  });

  it('préfère ce qui sert l’outil tenu en main', () => {
    const custom = contentWith(
      [
        {
          id: 'souche-essai',
          bricks: [
            {
              brick: 'gather',
              verb: 'Fendre',
              clip: 'chop',
              seconds: 1,
              gives: { item: 'buche', count: 1 },
              stock: null,
              tool: 'axe',
            },
          ],
        },
      ],
      [{ id: 'souche', type: 'souche-essai', x: 31.5, y: 30.9 }],
    );
    const sim = newSim(custom);
    const state = sim.world.places['essai-gare'];
    if (state === undefined) throw new Error('lieu absent');
    // Une pomme au sol, pile dans l'axe; la souche est sur le côté.
    state.ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 30.9, y: 30 });
    put(sim, 0, 30, 30, 0);
    expect(aimOf(sim, 0, withGather)?.id).toBe('sol-0');
    sim.world.players[0].toolbar[0] = { item: 'hache', count: 1 };
    sim.world.players[0].selected = 0;
    expect(aimOf(sim, 0, withGather)).toMatchObject({ id: 'souche', verb: 'Fendre' });
  });

  it('ne vise pas à travers un mur', () => {
    const sim = newSim(content);
    const state = sim.world.places['essai-gare'];
    if (state === undefined) throw new Error('lieu absent');
    // Le bâtiment de la gare finit à x = 26: la pomme est derrière son angle.
    state.ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 25.6, y: 13.3 });
    put(sim, 0, 26.3, 12.4, Math.atan2(0.9, -0.7));
    expect(aimOf(sim, 0)).toBeNull();
    put(sim, 0, 25.6, 14.2, NORTH);
    expect(aimOf(sim, 0)?.id).toBe('sol-0');
  });
});
