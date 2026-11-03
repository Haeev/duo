// Orientation (demande du 2026-11-03: « le personnage se tourne vers ce qu'il fait »): la
// simulation tourne le personnage au début d'une action, l'habitant vers qui lui parle puis le
// rend à son cap, et l'habitant posté regarde où son poste le dit.
import { describe, expect, it } from 'vitest';
import type { AuthoredIntent, Intent } from '../src/etat/actions';
import type { CharacterId } from '../src/etat/types';
import { type Sim, character } from '../src/simulation/contexte';
import { SCHEDULE_PERIOD_TICKS, SIM_DT } from '../src/simulation/constantes';
import { placeCharacter } from '../src/simulation/deplacement';
import { dialogueClose, talkTo } from '../src/simulation/dialogues';
import { updateVillagers } from '../src/simulation/habitants';
import { step } from '../src/simulation/pas';
import { addToBag } from '../src/simulation/sac';
import { newSim } from './aides';

/** Écart d'angle ramené à [0, PI]. */
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

function towards(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Monde au jour 1, les deux personnages créés, scène d'arrivée passée. */
function started(): Sim {
  const sim = newSim();
  const intents: AuthoredIntent[] = [
    { by: 'p1', intent: { type: 'create_character', name: 'Camille', hair: 0, outfit: 0 } },
    { by: 'p2', intent: { type: 'create_character', name: 'Sacha', hair: 1, outfit: 1 } },
  ];
  step(sim, { controls: {}, intents });
  for (let i = 0; i < 40 && sim.world.scene !== null; i++) {
    const scene = sim.world.scene;
    const next: AuthoredIntent[] = (['p1', 'p2'] as CharacterId[]).map((by) => ({
      by,
      intent: scene.choices.length > 0 ? { type: 'dialogue_choice', choice: scene.choices[0]?.id ?? '' } : { type: 'dialogue_next' },
    }));
    step(sim, { controls: {}, intents: next });
  }
  return sim;
}

function act(sim: Sim, by: CharacterId, intent: Intent): void {
  step(sim, { controls: {}, intents: [{ by, intent }] });
}

describe('orientation au début d’une action', () => {
  it('fabriquer à l’établi: tourné vers l’établi, même ouvert de biais', () => {
    const sim = started();
    const c = character(sim, 'p1');
    const recipe = Object.values(sim.content.recipes).find((r) => r.station === 'workbench');
    const bench = sim.map.props.find((p) => p.id === 'sawmill_workbench');
    const front = sim.map.points.sawmill_workbench;
    if (recipe === undefined || bench === undefined || front === undefined) throw new Error('établi absent');
    if (!sim.world.unlockedRecipes.includes(recipe.id)) sim.world.unlockedRecipes.push(recipe.id);
    for (const input of recipe.inputs) addToBag(sim, c, input.item, 'ordinary', input.count);
    placeCharacter(sim, c, { x: front.x + 1, y: front.y });
    c.facing = 0;
    act(sim, 'p1', { type: 'craft', recipe: recipe.id });
    expect(c.crafting).not.toBeNull();
    expect(angleGap(c.facing, towards(c.pos, bench.pos))).toBeLessThan(1e-6);
  });

  it('donner à l’autre: le donneur se tourne vers lui', () => {
    const sim = started();
    const a = character(sim, 'p1');
    const b = character(sim, 'p2');
    placeCharacter(sim, a, { x: 40.5, y: 22.5 });
    placeCharacter(sim, b, { x: 40.5, y: 23.7 });
    a.facing = 0;
    addToBag(sim, a, 'radish', 'ordinary', 1);
    act(sim, 'p1', { type: 'give', to: 'p2', item: 'radish', quality: 'ordinary', count: 1 });
    expect(angleGap(a.facing, Math.PI / 2)).toBeLessThan(1e-6);
  });
});

describe('interlocuteur', () => {
  it('l’habitant se tourne vers le joueur qui lui parle, puis reprend son cap', () => {
    const sim = started();
    const c = character(sim, 'p1');
    const v = sim.world.villagers.find((x) => x.visible);
    if (v === undefined) throw new Error('aucun habitant visible');
    placeCharacter(sim, c, { x: v.pos.x + 1.2, y: v.pos.y + 0.4 });
    v.facing = -2;
    expect(talkTo(sim, c, v.id)).toBe(true);
    expect(angleGap(v.facing, towards(v.pos, c.pos))).toBeLessThan(1e-6);
    expect(angleGap(c.facing, towards(c.pos, v.pos))).toBeLessThan(1e-6);
    dialogueClose(sim, c);
    expect(v.talkingWith).toEqual([]);
    expect(v.facing).toBe(-2);
  });

  it('l’habitant posté regarde où son poste le dit (Basile vers son établi, à l’ouest)', () => {
    const sim = started();
    const v = sim.world.villagers.find((x) => x.id === 'basile');
    const post = sim.map.points.basile_at_workbench;
    if (v === undefined || post === undefined) throw new Error('Basile ou son poste absent');
    expect(angleGap(sim.map.pointFacings.basile_at_workbench ?? 0, Math.PI)).toBeLessThan(1e-9);
    expect(angleGap(sim.map.pointFacings.salon_chair ?? 0, Math.PI)).toBeLessThan(1e-9);
    // Arrivé (trajet vide), en dehors d'un pas de relecture de l'emploi du temps.
    sim.world.tick = SCHEDULE_PERIOD_TICKS * 10 + 1;
    v.pos.x = post.x;
    v.pos.y = post.y;
    v.target = 'basile_at_workbench';
    v.visible = true;
    v.talkingWith = [];
    v.facing = 0;
    sim.runtime.villagerPaths[v.id] = { target: v.target, path: [] };
    updateVillagers(sim, SIM_DT);
    expect(angleGap(v.facing, Math.PI)).toBeLessThan(1e-9);
  });
});
