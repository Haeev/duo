// Sac, barre, piles, sol, don, rangement et usure des outils (lot L3, cahier 4.5).
import { describe, expect, it } from 'vitest';
import { equipBag, giveItem } from '../src/simulation/sac/actions';
import { addItem, countItem, roomFor } from '../src/simulation/sac/inventaire';
import {
  repairTool,
  toolCondition,
  toolGestureSeconds,
  wearTool,
} from '../src/simulation/sac/outils';
import { applyEffect } from '../src/simulation/regles/effets';
import { remember } from '../src/simulation/regles/memoire';
import { mealPerkKey } from '../src/simulation/besoins/repas';
import { act, contentWith, contextOf, withTestProps } from './aides-l3';
import { gameContent, newSim } from './aides';

const content = gameContent();
const bar = (index: number) => ({ area: 'toolbar' as const, index });
const bag = (index: number) => ({ area: 'bag' as const, index });

describe('sac et barre', () => {
  it('pas de sac au début: 5 cases de barre, piles limitées par la fiche de l’objet', () => {
    const sim = newSim(content);
    const a = sim.world.players[0];
    expect(a.bag).toBeNull();
    expect(roomFor(content, a, 'buche')).toBe(25);
    expect(addItem(content, a, 'buche', 7)).toBe(0);
    expect(a.toolbar.slice(0, 2)).toEqual([
      { item: 'buche', count: 5 },
      { item: 'buche', count: 2 },
    ]);
    expect(addItem(content, a, 'hache-forgee', 1)).toBe(0);
    expect(a.toolbar[2]).toEqual({ item: 'hache-forgee', count: 1, wear: 120 });
  });

  it('poches pleines: le reste tombe au sol, brille et se ramasse quand il y a de la place', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    expect(giveItem(ctx, 0, 'planche', 60)).toBe(50);
    expect(sim.events).toContainEqual({ type: 'pockets_full', player: 0, item: 'planche' });
    const ground = sim.world.places['essai-gare']?.ground ?? [];
    expect(ground).toHaveLength(1);
    expect(ground[0]?.stack).toEqual({ item: 'planche', count: 10 });
    expect(act(sim, 0, { type: 'pick_up', ground: 0 })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'pockets-full',
      target: null,
    });
    sim.world.players[0].toolbar[0] = null;
    act(sim, 0, { type: 'pick_up', ground: 0 });
    expect(countItem(sim.world.players[0], 'planche')).toBe(50);
    expect(sim.world.places['essai-gare']?.ground).toEqual([]);
  });

  it('les sacs s’enchaînent par amélioration (4, 6, 10, 15, 20) et gardent leur contenu', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    expect(
      act(sim, 0, { type: 'move_stack', from: bar(0), to: bag(0) }).map((e) => e.type),
    ).toEqual(['refused']);
    const sizes = content.bags.bags.map((b) => b.slots);
    expect(sizes).toEqual([4, 6, 10, 15, 20]);
    applyEffect(ctx, 0, { type: 'give_bag', bag: 'besace' });
    sim.world.players[0].bag?.slots.splice(3, 1, { item: 'pomme', count: 4 });
    equipBag(ctx, 0, 'sac-de-toile');
    expect(sim.world.players[0].bag?.slots).toHaveLength(6);
    expect(countItem(sim.world.players[0], 'pomme')).toBe(4);
  });

  it('déplacer: les piles du même objet se rejoignent jusqu’à leur limite, sinon les cases s’échangent', () => {
    const sim = newSim(content);
    const a = sim.world.players[0];
    a.toolbar[0] = { item: 'buche', count: 4 };
    a.toolbar[1] = { item: 'buche', count: 3 };
    a.toolbar[2] = { item: 'pomme', count: 1 };
    act(sim, 0, { type: 'move_stack', from: bar(1), to: bar(0) });
    expect(a.toolbar.slice(0, 2)).toEqual([
      { item: 'buche', count: 5 },
      { item: 'buche', count: 2 },
    ]);
    act(sim, 0, { type: 'move_stack', from: bar(2), to: bar(0) });
    expect(a.toolbar[0]).toEqual({ item: 'pomme', count: 1 });
    expect(a.toolbar[2]).toEqual({ item: 'buche', count: 5 });
    act(sim, 0, { type: 'drop', from: bar(2) });
    expect(a.toolbar[2]).toBeNull();
    expect(sim.world.places['essai-gare']?.ground[0]?.stack).toEqual({ item: 'buche', count: 5 });
  });

  it('donner à l’autre joueur: à portée de main seulement, refus si ses poches sont pleines', () => {
    const sim = newSim(content);
    const [a, b] = sim.world.players;
    a.toolbar[0] = { item: 'pomme', count: 3 };
    expect(act(sim, 0, { type: 'give_stack', from: bar(0) })[0]).toMatchObject({
      reason: 'too-far',
    });
    b.body.x = a.body.x + 1;
    b.body.y = a.body.y;
    expect(act(sim, 0, { type: 'give_stack', from: bar(0) })).toContainEqual({
      type: 'item_given',
      from: 0,
      to: 1,
      item: 'pomme',
      count: 3,
    });
    expect(countItem(b, 'pomme')).toBe(3);
    b.toolbar.fill({ item: 'hache', count: 1 });
    a.toolbar[0] = { item: 'pomme', count: 1 };
    expect(act(sim, 0, { type: 'give_stack', from: bar(0) })[0]).toMatchObject({
      reason: 'other-pockets-full',
    });
  });

  it('ranger dans un meuble de rangement et reprendre, mêmes piles que le sac', () => {
    const sim = newSim(contentWith(withTestProps));
    const a = sim.world.players[0];
    a.body.x = 19.5;
    a.body.y = 20;
    a.toolbar[0] = { item: 'buche', count: 5 };
    a.toolbar[1] = { item: 'buche', count: 3 };
    act(sim, 0, { type: 'store_put', target: 'coffre', from: bar(0) });
    act(sim, 0, { type: 'store_put', target: 'coffre', from: bar(1) });
    expect(sim.world.places['essai-gare']?.objects.coffre?.store).toEqual([
      { item: 'buche', count: 5 },
      { item: 'buche', count: 3 },
      null,
    ]);
    act(sim, 0, { type: 'store_take', target: 'coffre', index: 1 });
    expect(countItem(a, 'buche')).toBe(3);
    a.body.x += 5;
    expect(act(sim, 0, { type: 'store_take', target: 'coffre', index: 0 })[0]).toMatchObject({
      reason: 'too-far',
    });
  });

  it('un objet ajouté par un seul fichier suit sa propre limite de pile, sans code', () => {
    const custom = contentWith((files) => {
      files['commun/objets/galet.json'] = {
        schema: 1,
        id: 'galet',
        name: 'Galet',
        family: 'material',
        stack: 4,
        food: null,
        tool: null,
      };
    });
    const sim = newSim(custom);
    giveItem(contextOf(sim), 1, 'galet', 9);
    expect(sim.world.players[1].toolbar.slice(0, 3)).toEqual([
      { item: 'galet', count: 4 },
      { item: 'galet', count: 4 },
      { item: 'galet', count: 1 },
    ]);
  });
});

describe('usure des outils', () => {
  it('l’outil amélioré s’use, s’émousse sans casser, se répare; l’outil de base ne s’use jamais', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    const a = sim.world.players[0];
    a.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 2 };
    a.toolbar[1] = { item: 'hache', count: 1 };
    wearTool(ctx, 0, 0);
    wearTool(ctx, 0, 1);
    expect(a.toolbar[1]).toEqual({ item: 'hache', count: 1 });
    expect(toolCondition(content, { item: 'hache', count: 1 })).toBe('base');
    wearTool(ctx, 0, 0);
    expect(sim.events).toContainEqual({ type: 'tool_blunt', player: 0, item: 'hache-forgee' });
    wearTool(ctx, 0, 0);
    const stack = sim.world.players[0].toolbar[0] ?? null;
    if (stack === null) throw new Error('la hache a disparu');
    expect(stack).toEqual({ item: 'hache-forgee', count: 1, wear: 0 });
    expect(toolCondition(content, stack)).toBe('blunt');
    expect(toolGestureSeconds(content, stack)).toBe(1.5);
    expect(repairTool(ctx, 0, stack)).toBe(true);
    expect(stack.wear).toBe(120);
    expect(toolGestureSeconds(content, stack)).toBe(0.7);
  });

  it('le bonus de repas « mains sûres » empêche l’usure', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    sim.world.players[0].toolbar[0] = { item: 'hache-forgee', count: 1, wear: 5 };
    remember(ctx, mealPerkKey(0), 'no_tool_wear', 'duo');
    wearTool(ctx, 0, 0);
    expect(sim.world.players[0].toolbar[0]).toMatchObject({ wear: 5 });
  });
});
