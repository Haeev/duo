// Argent, conditions, effets et mémoire des faits (lot L3, cahier 4.6 et 4.9).
import { describe, expect, it } from 'vitest';
import type { Condition } from '../src/donnees/schemas/regles';
import { deposit, earn, formatEuros, pay, withdraw } from '../src/simulation/sac/argent';
import { evaluate, type RuleContext } from '../src/simulation/regles/conditions';
import { applyEffects } from '../src/simulation/regles/effets';
import { bump, recall, remember } from '../src/simulation/regles/memoire';
import { RULES } from '../src/simulation/regles/reglages';
import { act, contextOf } from './aides-l3';
import { gameContent, newSim } from './aides';

const content = gameContent();
const NBSP = String.fromCharCode(0xa0);

describe('argent', () => {
  it('formate les centimes en euros, à la française', () => {
    expect(formatEuros(120)).toBe(`1,20${NBSP}€`);
    expect(formatEuros(5)).toBe(`0,05${NBSP}€`);
    expect(formatEuros(123456)).toBe(`1${NBSP}234,56${NBSP}€`);
    expect(formatEuros(-50)).toBe(`-0,50${NBSP}€`);
  });

  it('bourse par joueur et coffre commun: payer, verser, retirer, refus propres', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    const [a, b] = sim.world.players;
    a.money = 0;
    b.money = 0;
    expect(earn(ctx, 0, 500)).toBe(500);
    expect(pay(ctx, 0, 600)).toBe('not-enough-money');
    expect(pay(ctx, 0, 120)).toBeNull();
    expect(deposit(ctx, 0, 300)).toBeNull();
    expect(a.money).toBe(80);
    expect(sim.world.common.chest).toBe(300);
    expect(withdraw(ctx, 1, 200)).toBeNull();
    expect(b.money).toBe(200);
    expect(withdraw(ctx, 1, 200)).toBe('chest-empty');
    expect(ctx.touched).toEqual(new Set(['players', 'common']));
    expect(act(sim, 0, { type: 'chest_deposit', amount: 1000 })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-enough-money',
      target: null,
    });
    act(sim, 1, { type: 'chest_deposit', amount: 50 });
    expect(sim.world.common.chest).toBe(150);
  });
});

describe('conditions et effets', () => {
  it('évalue mémoire, besoins, sac, lieu et heure (plage qui passe minuit)', () => {
    const sim = newSim(content);
    const ctx: RuleContext = { world: sim.world, content, actor: 1 };
    const night: Condition = { type: 'time_is', from: 1320, to: 120 };
    sim.world.minutes = 30;
    expect(evaluate(ctx, night)).toBe(true);
    sim.world.minutes = 600;
    expect(evaluate(ctx, night)).toBe(false);
    sim.world.players[1].toolbar[0] = { item: 'pomme', count: 3 };
    expect(evaluate(ctx, { type: 'item_in_bag', item: 'pomme', count: 3 })).toBe(true);
    expect(evaluate({ ...ctx, actor: 0 }, { type: 'item_in_bag', item: 'pomme', count: 1 })).toBe(
      false,
    );
    expect(
      evaluate(ctx, {
        type: 'all',
        conditions: [
          { type: 'place_is', place: 'essai-gare' },
          { type: 'not', condition: { type: 'need_at_least', need: 'hygiene', value: 90 } },
          { type: 'any', conditions: [{ type: 'remembered', key: 'essai-gare.vu' }] },
        ],
      }),
    ).toBe(false);
  });

  it('applique les effets au nom du joueur qui agit, chacun par son système', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    sim.world.players[0].needs.hygiene = 30;
    applyEffects(ctx, 0, [
      { type: 'give_item', item: 'pomme', count: 2 },
      { type: 'take_item', item: 'pomme', count: 1 },
      { type: 'give_money', amount: 250 },
      { type: 'change_need', need: 'hygiene', amount: 40, cap: 60 },
      { type: 'remember', key: 'essai-gare.vu', value: true, by: 'duo' },
    ]);
    const a = sim.world.players[0];
    expect(a.toolbar[0]).toEqual({ item: 'pomme', count: 1 });
    expect(a.money).toBe(content.settings.start.money + 250);
    expect(a.needs.hygiene).toBe(60);
    expect(recall(sim.world, 'essai-gare.vu')).toEqual({ v: true, by: 'duo', day: 1 });
  });

  it('la mémoire compte, refuse les clés mal formées et ne grossit pas au-delà de sa garde', () => {
    const sim = newSim(content);
    const ctx = contextOf(sim);
    expect(bump(ctx, 'essai-gare.oeufs-vendus', 1, 12)).toBe(12);
    expect(bump(ctx, 'essai-gare.oeufs-vendus', 1)).toBe(13);
    expect(remember(ctx, 'Mauvaise clé', true, 0)).toBe(false);
    const memory = sim.world.progress.memory;
    for (let i = Object.keys(memory).length; i < RULES.memory.maxFacts; i++)
      memory[`remplissage.f${String(i)}`] = { v: true, by: 0, day: 1 };
    expect(remember(ctx, 'essai-gare.nouveau', true, 0)).toBe(false);
    expect(remember(ctx, 'essai-gare.oeufs-vendus', 14, 1)).toBe(true);
    expect(Object.keys(memory)).toHaveLength(RULES.memory.maxFacts);
  });
});
