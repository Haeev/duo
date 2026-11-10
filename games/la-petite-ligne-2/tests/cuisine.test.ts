// Cuisine (cahier 4.4 et 4.7, docs/jeux/jeu-1/refonte/cuisine.md): recettes simples, mini-jeu,
// apprentissage, repas à deux sur deux postes, recette factice ajoutée par les seules données.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { BRICK_BEHAVIOURS } from '../src/simulation/briques/registre';
import { cookingOf } from '../src/simulation/cuisine/index';
import { botAct, createMinigame, windowScaleOf } from '../src/simulation/cuisine/minijeu';
import { bestQuality, partOf, recipeSeconds } from '../src/simulation/cuisine/recettes';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { addItem, countItem } from '../src/simulation/sac/inventaire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';

type Json = Record<string, unknown>;

/** Une petite cuisine à côté des départs des joueurs (18,5 ; 20) et (21,5 ; 20). */
function kitchenFiles(files: Record<string, Json>): void {
  const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
  objects.push({ id: 'rechaud-1', type: 'rechaud', x: 18.5, y: 21.5, rotation: 0 });
  objects.push({ id: 'plan-1', type: 'plan-de-travail', x: 19, y: 18.5, rotation: 0 });
  objects.push({ id: 'cuisiniere-1', type: 'cuisiniere', x: 21.5, y: 21.5, rotation: 0 });
  objects.push({ id: 'four-1', type: 'four', x: 21.5, y: 18.5, rotation: 0 });
}

const content = contentWith(kitchenFiles);

/** Partie neuve, les deux joueurs debout dans la cuisine. */
function kitchenSim(c: Content = content): Sim {
  const sim = newSim(c);
  Object.assign(sim.world.players[0].body, { x: 18.5, y: 20 });
  Object.assign(sim.world.players[1].body, { x: 21.5, y: 20 });
  return sim;
}

function give(sim: Sim, player: PlayerIndex, item: string, count: number): void {
  addItem(sim.content, sim.world.players[player], item, count);
}

/** Joue le mini-jeu de la part lancée par `started`, au rythme de la simulation; rend les événements. */
function playPart(
  sim: Sim,
  started: Extract<GameEvent, { type: 'cook_started' }>,
  sloppy = false,
): GameEvent[] {
  const recipe = sim.content.recipes[started.recipe];
  const def = recipe === undefined ? null : partOf(recipe, started.part);
  if (def === null) throw new Error('part inconnue');
  const game = createMinigame({ steps: def.steps, seed: started.seed, windowScale: 1 });
  const events: GameEvent[] = [];
  for (let i = 0; i < 60 * 30 && !game.view().finished; i++) {
    botAct(game, sloppy);
    const grade = game.update(SIM_DT);
    events.push(
      ...(grade === null
        ? wait(sim, SIM_DT)
        : act(sim, started.player, { type: 'cook_step', grade })),
    );
  }
  return events;
}

function startedOf(events: readonly GameEvent[]): Extract<GameEvent, { type: 'cook_started' }> {
  const found = events.find((e) => e.type === 'cook_started');
  if (found?.type !== 'cook_started') throw new Error(`pas de départ: ${JSON.stringify(events)}`);
  return found;
}

describe('cuisine', () => {
  it('la brique `cook` ouvre le livre du poste visé', () => {
    const sim = kitchenSim();
    const behaviour = BRICK_BEHAVIOURS.cook;
    const params = { brick: 'cook', station: 'stove' } as const;
    const target = {
      id: 'rechaud-1',
      type: 'rechaud',
      x: 18.5,
      y: 21.5,
      rotation: 0 as const,
      params,
      states: {},
    };
    behaviour?.use(contextOf(sim), 0, target);
    expect(sim.events).toContainEqual({
      type: 'kitchen_opened',
      player: 0,
      target: 'rechaud-1',
      station: 'stove',
    });
  });

  it('recette simple au réchaud: aussitôt, fêtée la première fois seulement', () => {
    const sim = kitchenSim();
    give(sim, 0, 'pomme', 2);
    const first = act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'pomme-cuite' });
    expect(first).toContainEqual(
      expect.objectContaining({ type: 'dish_cooked', item: 'pomme-cuite', first: true }),
    );
    const again = act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'pomme-cuite' });
    expect(again).toContainEqual(expect.objectContaining({ type: 'dish_cooked', first: false }));
    expect(countItem(sim.world.players[0], 'pomme-cuite')).toBe(2);
    expect(countItem(sim.world.players[0], 'pomme')).toBe(0);
    // Ni ingrédient, ni bon poste, ni recette inconnue.
    const refusals = [
      act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'pomme-cuite' }),
      act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'soupe-de-legumes' }),
      act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'pommes-sautees' }),
    ].map((events) => events.find((e) => e.type === 'refused'));
    expect(refusals.map((e) => (e?.type === 'refused' ? e.reason : null))).toEqual([
      'missing-ingredients',
      'wrong-station',
      'recipe-unknown',
    ]);
  });

  it('apprend par essai et par un livre lu', () => {
    const sim = kitchenSim();
    give(sim, 0, 'oeuf', 1);
    const trial = act(sim, 0, { type: 'cook_start', target: 'rechaud-1', recipe: 'oeuf-au-plat' });
    expect(trial).toContainEqual({
      type: 'recipe_learned',
      player: 0,
      recipe: 'oeuf-au-plat',
      how: 'trial',
    });
    give(sim, 0, 'livre-de-cuisine', 1);
    const slot = sim.world.players[0].toolbar.findIndex((s) => s?.item === 'livre-de-cuisine');
    const read = act(sim, 0, { type: 'cook_read', from: { area: 'toolbar', index: slot } });
    expect(read.flatMap((e) => (e.type === 'recipe_learned' ? [e.recipe] : []))).toEqual(
      expect.arrayContaining(['pommes-sautees', 'tarte-aux-pommes']),
    );
  });

  it('mini-jeu: bien joué donne un plat parfait (et plus), mal joué un plat correct, jamais rien', () => {
    for (const [sloppy, quality, count] of [
      [false, 3, 2],
      [true, 1, 1],
    ] as const) {
      const sim = kitchenSim();
      give(sim, 1, 'carotte', 1);
      give(sim, 1, 'poireau', 1);
      give(sim, 1, 'pomme-de-terre', 1);
      const started = startedOf(
        act(sim, 1, { type: 'cook_start', target: 'cuisiniere-1', recipe: 'soupe-de-legumes' }),
      );
      const events = playPart(sim, started, sloppy);
      expect(events).toContainEqual(
        expect.objectContaining({ type: 'dish_cooked', quality, count }),
      );
      expect(countItem(sim.world.players[1], 'soupe-de-legumes')).toBe(count);
      expect(bestQuality(sim.world, 'soupe-de-legumes')).toBe(quality);
    }
  });

  it('borne les notes: une part finie trop vite est refusée, quitter ne coûte rien', () => {
    const sim = kitchenSim();
    give(sim, 1, 'oeuf', 2);
    sim.world.progress.memory['cuisine.recette.omelette-aux-herbes'] = { v: 0, by: 'duo', day: 1 };
    act(sim, 1, { type: 'cook_start', target: 'cuisiniere-1', recipe: 'omelette-aux-herbes' });
    const fast = [1, 2, 3].flatMap(() => act(sim, 1, { type: 'cook_step', grade: 3 }));
    expect(fast).toContainEqual(expect.objectContaining({ type: 'refused', reason: 'too-fast' }));
    expect(countItem(sim.world.players[1], 'oeuf')).toBe(2);
    act(sim, 1, { type: 'cook_start', target: 'cuisiniere-1', recipe: 'omelette-aux-herbes' });
    expect(act(sim, 1, { type: 'cook_cancel' })).toContainEqual({
      type: 'cook_cancelled',
      player: 1,
      recipe: 'omelette-aux-herbes',
    });
    expect(cookingOf(sim.world, 1)).toBeNull();
    expect(countItem(sim.world.players[1], 'oeuf')).toBe(2);
  });

  it("repas à deux: deux postes, l'ordre compte un peu, plat partagé puis servi à table", () => {
    const sim = kitchenSim();
    sim.world.progress.memory['cuisine.recette.pot-au-feu-du-dimanche'] = {
      v: 0,
      by: 'duo',
      day: 1,
    };
    give(sim, 0, 'carotte', 2);
    give(sim, 0, 'poireau', 1);
    give(sim, 1, 'boeuf', 1);
    give(sim, 1, 'pomme-de-terre', 2);
    const a = startedOf(
      act(sim, 0, { type: 'cook_start', target: 'plan-1', recipe: 'pot-au-feu-du-dimanche' }),
    );
    const b = startedOf(
      act(sim, 1, { type: 'cook_start', target: 'cuisiniere-1', recipe: 'pot-au-feu-du-dimanche' }),
    );
    expect([a.part, b.part]).toEqual([0, 1]);
    // La seconde part commence trop tôt: sa première cuisson attend la découpe.
    const early = act(sim, 1, { type: 'cook_step', grade: 3 });
    expect(early).toContainEqual(
      expect.objectContaining({ type: 'cook_step_done', part: 1, step: 0, grade: 2, early: true }),
    );
    const events = playPart(sim, a);
    expect(events).toContainEqual(expect.objectContaining({ type: 'cook_part_done', player: 0 }));
    const meal = content.recipes['pot-au-feu-du-dimanche'];
    const steps = meal === undefined ? [] : (partOf(meal, 1)?.steps ?? []);
    const rest = createMinigame({ steps: steps.slice(1), seed: 1, windowScale: 1 });
    const done: GameEvent[] = [];
    for (let i = 0; i < 1800 && !rest.view().finished; i++) {
      botAct(rest);
      const grade = rest.update(SIM_DT);
      done.push(
        ...(grade === null ? wait(sim, SIM_DT) : act(sim, 1, { type: 'cook_step', grade })),
      );
    }
    const cooked = done.filter((e) => e.type === 'dish_cooked');
    expect(cooked.map((e) => e.player).sort()).toEqual([0, 1]);
    expect(cooked[0]).toMatchObject({ item: 'pot-au-feu', shared: true });
    expect(countItem(sim.world.players[1], 'pot-au-feu')).toBe(1);
    expect(countItem(sim.world.players[0], 'carotte')).toBe(0);
    // Servi à table, les deux assis (système des besoins): faim pleine et bonus pour les deux.
    const place = sim.world.places[sim.world.common.place];
    if (place !== undefined) place.objects.banc = { sit: [0, 1] };
    const slot = sim.world.players[1].toolbar.findIndex((s) => s?.item === 'pot-au-feu');
    const served = act(sim, 1, {
      type: 'serve_meal',
      from: { area: 'toolbar', index: slot },
      target: 'banc',
    });
    expect(served.filter((e) => e.type === 'meal_shared')).toHaveLength(2);
  });

  it('repas à deux fait seul: les deux parts à la suite, deux fois plus long', () => {
    const sim = kitchenSim();
    sim.world.progress.memory['cuisine.recette.pot-au-feu-du-dimanche'] = {
      v: 0,
      by: 'duo',
      day: 1,
    };
    for (const [item, n] of [
      ['carotte', 2],
      ['poireau', 1],
      ['boeuf', 1],
      ['pomme-de-terre', 2],
    ] as const)
      give(sim, 0, item, n);
    playPart(
      sim,
      startedOf(
        act(sim, 0, { type: 'cook_start', target: 'plan-1', recipe: 'pot-au-feu-du-dimanche' }),
      ),
    );
    sim.world.players[0].body.x = 21.5;
    const second = startedOf(
      act(sim, 0, { type: 'cook_start', target: 'cuisiniere-1', recipe: 'pot-au-feu-du-dimanche' }),
    );
    expect(second.part).toBe(1);
    const events = playPart(sim, second);
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'dish_cooked', player: 0, shared: false, quality: 3 }),
    );
  });

  it('une recette factice ajoutée par les données fonctionne sans autre changement', () => {
    const custom: Content = contentWith((files) => {
      kitchenFiles(files);
      files['commun/objets/gaufre-factice.json'] = {
        schema: 1,
        id: 'gaufre-factice',
        name: 'Gaufre factice',
        family: 'food',
        stack: 3,
        food: { hunger: 50 },
        tool: null,
      };
      files['commun/recettes/gaufre-factice.json'] = {
        schema: 1,
        id: 'gaufre-factice',
        name: 'Gaufre factice',
        station: 'oven',
        inputs: [{ item: 'farine', count: 1 }],
        output: { item: 'gaufre-factice', count: 1 },
        seconds: 16,
        known: 'start',
        steps: [
          { kind: 'season', count: 4 },
          { kind: 'heat', count: 4 },
        ],
      };
    });
    const sim = kitchenSim(custom);
    sim.world.players[1].body.y = 19.5;
    give(sim, 1, 'farine', 1);
    const events = playPart(
      sim,
      startedOf(act(sim, 1, { type: 'cook_start', target: 'four-1', recipe: 'gaufre-factice' })),
    );
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'dish_cooked', item: 'gaufre-factice', first: true }),
    );
  });

  it("mini-jeux de 15 à 40 s, fenêtres élargies par le bonus, l'aide et la cuisine tranquille", () => {
    for (const recipe of Object.values(content.recipes))
      if (recipe.steps !== undefined) {
        const seconds = recipeSeconds(recipe);
        expect(seconds).toBeGreaterThanOrEqual(15);
        expect(seconds).toBeLessThanOrEqual(40);
      }
    expect(windowScaleOf(1, 0, false)).toBe(1);
    expect(windowScaleOf(1.15, 2, true)).toBeCloseTo(2.5, 6);
    const narrow = createMinigame({ steps: [{ kind: 'heat', count: 1 }], seed: 3, windowScale: 1 });
    const wide = createMinigame({ steps: [{ kind: 'heat', count: 1 }], seed: 3, windowScale: 2 });
    const width = (g: typeof narrow): number => {
      const zone = g.view().zone;
      return zone === null ? 0 : zone.to - zone.from;
    };
    expect(width(wide)).toBeCloseTo(width(narrow) * 2, 6);
  });
});
