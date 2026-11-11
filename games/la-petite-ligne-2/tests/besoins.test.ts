// Besoins (lot L3, cahier 4.4): pertes, paliers, modificateurs, manger, se laver, dormir, repas à deux.
import { describe, expect, it } from 'vitest';
import { modifiersOf } from '../src/simulation/besoins/jauges';
import { mealPerkOf, shareSpecialMeal } from '../src/simulation/besoins/repas';
import { soil, wakeUp } from '../src/simulation/besoins/soins';
import { hasPerk } from '../src/simulation/besoins/repas';
import { idleInput } from '../src/simulation/noyau/entrees';
import { createPlaceState } from '../src/simulation/noyau/monde';
import { RULES } from '../src/simulation/regles/reglages';
import { act, contentWith, contextOf, wait, withTestProps } from './aides-l3';
import { NORTH, put } from './aides-noyau';
import { gameContent, newSim } from './aides';

const content = gameContent();

describe('besoins', () => {
  it('baissent au fil du temps selon les données, plus vite pendant un effort', () => {
    const sim = newSim(content);
    wait(sim, 60);
    const [a] = sim.world.players;
    expect(a.needs.hunger).toBeCloseTo(70 - 2, 1);
    expect(a.needs.sleep).toBeCloseTo(70 - 1.6, 1);
    expect(a.needs.hygiene).toBeCloseTo(70 - 1, 1);
    const running = newSim(content);
    // Course vers l'est.
    const run = { ...idleInput(0), moveX: 1, run: true };
    // 10 s sur le quai dégagé: la course coûte quand on court pour de bon (pas contre un mur, ni
    // essoufflé), et dure moins qu'une jauge d'endurance (`besoins.json`, `stamina.runSeconds`).
    put(running, 0, 5, 20, 0);
    wait(running, 10, [run, idleInput(0)]);
    expect(running.world.players[0].needs.hunger).toBeCloseTo(70 - 0.5, 1);
    expect(running.world.players[1].needs.hunger).toBeCloseTo(70 - 1 / 3, 1);
  });

  it('change de palier sous 20 et à 0, avec un événement et la tranche « joueurs »', () => {
    const sim = newSim(content);
    sim.world.players[0].needs.hunger = 21.02;
    const revision = sim.revisions.players;
    const events = wait(sim, 2);
    expect(events).toContainEqual({ type: 'need_tier', player: 0, need: 'hunger', state: 'low' });
    expect(sim.world.players[0].tiers.hunger).toBe('low');
    expect(sim.revisions.players).toBeGreaterThan(revision);
    sim.world.players[0].needs.hunger = 0.01;
    expect(wait(sim, 1)).toContainEqual({
      type: 'need_tier',
      player: 0,
      need: 'hunger',
      state: 'blocked',
    });
    const mods = modifiersOf(content, sim.world, 0);
    // Faim à 0 (moitié de la vitesse), sommeil toujours en bonus (plus 10 %).
    expect(mods.speed).toBeCloseTo(0.55, 6);
  });

  it('garde un bonus tant que la jauge reste au-dessus du seuil moins la marge', () => {
    const tolerant = contentWith((files) => {
      (files['commun/besoins.json'] as { hysteresis: number }).hysteresis = 5;
    });
    const sim = newSim(tolerant);
    expect(sim.world.players[0].tiers.sleep).toBe('bonus');
    sim.world.players[0].needs.sleep = 48;
    wait(sim, 0.1);
    expect(sim.world.players[0].tiers.sleep).toBe('bonus');
    sim.world.players[0].needs.sleep = 45.5;
    wait(sim, 0.1);
    expect(sim.world.players[0].tiers.sleep).toBe('neutral');
  });

  it('expose des modificateurs nommés, bonus plafonnés, pleine forme et amitié nulle si sale', () => {
    const sim = newSim(content);
    const mods = modifiersOf(content, sim.world, 0);
    expect(mods).toMatchObject({ speed: 1.1, toolSpeed: 1.15, minigame: 1.15, bond: 1.2 });
    expect(mods.rareLuck).toBe(content.needs.allBonusRareLuck);
    sim.world.players[0].tiers.hygiene = 'low';
    expect(modifiersOf(content, sim.world, 0)).toMatchObject({ bond: 0, rareLuck: 1 });
    const greedy = contentWith((files) => {
      const needs = (
        files['commun/besoins.json'] as { needs: { tiers: { modifiers: object }[] }[] }
      ).needs;
      const bonus = needs[0]?.tiers[3];
      if (bonus !== undefined) bonus.modifiers = { speed: 1.5 };
    });
    expect(modifiersOf(greedy, newSim(greedy).world, 0).speed).toBe(greedy.needs.maxBonus);
  });

  it('manger une case remonte la faim; ce qui ne se mange pas est refusé', () => {
    const sim = newSim(content);
    const a = sim.world.players[0];
    a.needs.hunger = 30;
    a.toolbar[0] = { item: 'pain', count: 2 };
    a.toolbar[1] = { item: 'buche', count: 1 };
    expect(act(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 0 } })).toContainEqual({
      type: 'ate',
      player: 0,
      item: 'pain',
    });
    expect(a.needs.hunger).toBeCloseTo(55, 0);
    expect(a.toolbar[0]).toEqual({ item: 'pain', count: 1 });
    expect(act(sim, 0, { type: 'eat', from: { area: 'toolbar', index: 1 } })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-edible',
      target: null,
    });
  });

  it('se laver pendant le geste long: le gain vient pas à pas, plafonné, et reste si on sort avant', () => {
    const sim = newSim(content);
    const a = sim.world.players[0];
    a.needs.hygiene = 10;
    a.gesture = { clip: 'wash', target: 'pompe', until: 999, long: true };
    wait(sim, 1);
    expect(a.needs.hygiene).toBeGreaterThan(18);
    expect(a.needs.hygiene).toBeLessThan(22);
    a.gesture = null;
    const kept = a.needs.hygiene;
    wait(sim, 0.1);
    expect(a.needs.hygiene).toBeCloseTo(kept, 0);
    a.gesture = { clip: 'wash', target: 'pompe', until: 999, long: true };
    wait(sim, 10);
    expect(a.needs.hygiene).toBeCloseTo(60, 0);
  });

  it('dormir: réveil au niveau du lit, faim et hygiène en baisse; se reposer assis; se salir', () => {
    const sim = newSim(contentWith(withTestProps));
    const ctx = contextOf(sim);
    wakeUp(ctx, 1, 100);
    expect(sim.world.players[1].needs).toEqual({ hunger: 55, sleep: 100, hygiene: 60 });
    soil(ctx, 1, 3);
    expect(sim.world.players[1].needs.hygiene).toBe(57);
    sim.world.players[0].needs.sleep = 20;
    const seats = sim.world.places['essai-gare']?.objects.banc?.sit;
    if (seats !== undefined) seats[0] = 0;
    wait(sim, 60);
    expect(sim.world.players[0].needs.sleep).toBeCloseTo(26, 0);
  });

  it('repas spécial à deux à table: faim pleine et bonus exclusif tant que la faim reste au-dessus de 50', () => {
    const sim = newSim(contentWith(withTestProps));
    const ctx = contextOf(sim);
    expect(shareSpecialMeal(ctx, 'banc', 'no_tool_wear')).toBe('not-together');
    const seats = sim.world.places['essai-gare']?.objects.banc?.sit;
    if (seats !== undefined) seats.splice(0, 2, 0, 1);
    expect(shareSpecialMeal(ctx, 'banc', 'no_tool_wear')).toBeNull();
    expect(sim.world.players.map((p) => p.needs.hunger)).toEqual([100, 100]);
    expect(hasPerk(sim.world, 1, 'no_tool_wear')).toBe(true);
    expect(ctx.touched.has('progress')).toBe(true);
    sim.world.players[0].needs.hunger = RULES.needs.specialMealKeepAbove;
    wait(sim, 0.1);
    expect(mealPerkOf(sim.world, 0)).toBeNull();
    expect(mealPerkOf(sim.world, 1)).toBe('no_tool_wear');
  });

  it('se laver à la pompe par la touche d’action: geste long, gain jusqu’au plafond, sans refus à la fin', () => {
    const sim = newSim(content);
    put(sim, 0, 28.5, 23.6, NORTH);
    sim.world.players[0].needs.hygiene = 15;
    expect(act(sim, 0, { type: 'act' })).toContainEqual({
      type: 'gesture_started',
      player: 0,
      clip: 'wash',
      target: 'pompe',
    });
    expect(sim.world.players[0].gesture?.long).toBe(true);
    const events = wait(sim, 4.5);
    expect(sim.world.players[0].needs.hygiene).toBeCloseTo(55, 0);
    expect(events.filter((e) => e.type === 'refused')).toEqual([]);
    expect(sim.world.players[0].gesture).toBeNull();
  });

  it('fait sa toilette au baquet de la maison du garde: hygiène à 100 en 4 s (cahier 4.4)', () => {
    const sim = newSim(content);
    const aubrune = content.places.aubrune;
    if (aubrune === undefined) throw new Error('Aubrune absente');
    // Le baquet est un meuble des joueurs, déjà posé à la création de la maison (`furnished`).
    sim.world.common.place = 'aubrune';
    sim.world.places.aubrune = createPlaceState(content, aubrune);
    wait(sim, 1 / 30);
    const tub = sim.world.places.aubrune.placed.find((p) => p.type === 'baquet');
    if (tub === undefined) throw new Error('baquet absent de la maison');
    // Façade à l'ouest (rotation 3): on se tient entre le refend et le baquet, tourné vers lui.
    put(sim, 0, tub.x - 1, tub.y, 0);
    sim.world.players[0].needs.hygiene = 12;
    expect(act(sim, 0, { type: 'act' })).toContainEqual({
      type: 'gesture_started',
      player: 0,
      clip: 'wash',
      target: tub.id,
    });
    wait(sim, 4.5);
    expect(sim.world.players[0].needs.hygiene).toBeCloseTo(100, 0);
  });

  it('un repas spécial ajouté par un seul fichier se sert à deux à table et donne son bonus', () => {
    const custom = contentWith((files) => {
      withTestProps(files);
      files['commun/objets/tourte-essai.json'] = {
        schema: 1,
        id: 'tourte-essai',
        name: 'Tourte',
        family: 'food',
        stack: 1,
        food: { hunger: 60, stamina: { capacity: { extra: 0.5, seconds: 60 } } },
        tool: null,
        meal: { perk: 'better_prices' },
      };
    });
    const sim = newSim(custom);
    sim.world.players[0].toolbar[0] = { item: 'tourte-essai', count: 1 };
    const serve = {
      type: 'serve_meal',
      from: { area: 'toolbar', index: 0 },
      target: 'banc',
    } as const;
    expect(act(sim, 0, serve)).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-together',
      target: 'banc',
    });
    const seats = sim.world.places['essai-gare']?.objects.banc?.sit;
    if (seats !== undefined) seats.splice(0, 2, 0, 1);
    expect(sim.world.players[1].staminaMods.capacity).toBeNull();
    act(sim, 0, serve);
    expect(sim.world.players[0].toolbar[0]).toBeNull();
    expect(modifiersOf(custom, sim.world, 1).sellPrice).toBe(RULES.needs.betterPrices);
    // Le renfort d'endurance du plat, pour les deux convives.
    for (const p of [0, 1] as const)
      expect(sim.world.players[p].staminaMods.capacity?.extra).toBe(0.5);
  });
});
