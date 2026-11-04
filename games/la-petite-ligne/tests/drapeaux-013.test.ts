// Effets en jeu des drapeaux de quête de la 0.13 (`reglages.flagEffects`): scie affûtée, banc
// d'Hortense, chaises du café, menuiserie du samedi, soupe du jour, souper de la pension, jumelles
// prêtées, roue du moulin. Chaque essai pose le drapeau à la main et regarde l'effet, sans partie.
import { describe, expect, it } from 'vitest';
import { weekdayOf } from '../src/donnees/calendrier';
import { flagSeats, flaggedWorks } from '../src/etat/drapeaux';
import type { Sim } from '../src/simulation/contexte';
import { character } from '../src/simulation/contexte';
import { placeCharacter, refreshBlockers } from '../src/simulation/deplacement';
import { mealAtPoint, morningFlagEffects, orderMeal, raiseAutoFlags } from '../src/simulation/drapeaux';
import { sitDown, freeSeatsNear, playerBench } from '../src/simulation/bancs';
import { updateCrafting } from '../src/simulation/intentions';
import { buildingOpen } from '../src/simulation/interieurs';
import { countInBag } from '../src/simulation/sac';
import { contentAndMap, newSim } from './aides';

function raise(sim: Sim, flag: string): void {
  if (!sim.world.flags.includes(flag)) sim.world.flags.push(flag);
}

/** Le jour de la partie qui tombe ce jour de la semaine (le jour 1 est un samedi). */
function dayOf(weekday: number): number {
  return 1 + weekday + 7;
}

function minutes(h: number): number {
  return h * 60;
}

function sawPlanks(sim: Sim): number {
  const c = character(sim, 'p1');
  const before = countInBag(c, 'plank');
  c.crafting = { recipe: 'saw_plank', endsAt: sim.world.tick };
  updateCrafting(sim, c);
  return countInBag(c, 'plank') - before;
}

describe('drapeaux de la 0.13', () => {
  it('scie affûtée: 4 planches par bûche, 5 avec la lame de Basile', () => {
    const sim = newSim(11);
    expect(sawPlanks(sim)).toBe(4);
    raise(sim, 'saw_blade_sharp');
    expect(sawPlanks(sim)).toBe(5);
  });

  it("banc d'Hortense: absent, puis posé sous le tilleul avec ses deux places et ses cases bloquées", () => {
    const sim = newSim(12);
    expect(flaggedWorks(sim.content.settings.flagEffects, sim.world.flags)).toEqual([]);
    expect(playerBench(sim, 'hortense_bench')).toBeNull();
    raise(sim, 'hortense_bench');
    sim.runtime.dynamicDirty = true;
    const bench = playerBench(sim, 'hortense_bench');
    expect(bench).not.toBeNull();
    expect(Math.hypot((bench?.pos.x ?? 0) - 50.5, (bench?.pos.y ?? 0) - 24.5)).toBeLessThan(3);
    const blockers = refreshBlockers(sim);
    expect(blockers.dynamic.some((v) => v !== 0)).toBe(true);
    const near = freeSeatsNear(sim, bench?.pos ?? { x: 0, y: 0 }, 1.4);
    expect(near.filter((s) => s.bench === 'hortense_bench')).toHaveLength(2);
  });

  it('chaises du café: on ne s\'assoit qu\'une fois le drapeau levé', () => {
    const sim = newSim(13);
    sim.world.phase = 'day';
    const c = character(sim, 'p1');
    expect(playerBench(sim, 'cafe_chair_west_table_south')).toBeNull();
    raise(sim, 'cafe_chairs_mended');
    const seats = flagSeats(sim.content.settings.flagEffects, sim.world.flags);
    expect(seats).toHaveLength(3);
    const chair = playerBench(sim, 'cafe_chair_west_table_south');
    expect(chair).not.toBeNull();
    placeCharacter(sim, c, { x: 87.5, y: 23.3 });
    expect(sitDown(sim, c, 'cafe_chair_west_table_south', 0)).toBe(true);
    // Une chaise n'a qu'une place.
    expect(sitDown(sim, character(sim, 'p2'), 'cafe_chair_west_table_south', 1)).toBe(false);
  });

  it('menuiserie: fermée, puis ouverte le samedi seulement aux heures des réglages', () => {
    const sim = newSim(14);
    const joinery = sim.map.buildings.joinery;
    if (joinery === undefined) throw new Error('menuiserie absente');
    sim.world.clock.day = dayOf(0);
    sim.world.clock.minutes = minutes(10);
    expect(buildingOpen(sim, joinery)).toBe(false);
    raise(sim, 'joinery_open');
    expect(weekdayOf(sim.world.clock.day)).toBe(0);
    expect(buildingOpen(sim, joinery)).toBe(true);
    sim.world.clock.minutes = minutes(13);
    expect(buildingOpen(sim, joinery)).toBe(false);
    sim.world.clock.minutes = minutes(15);
    expect(buildingOpen(sim, joinery)).toBe(true);
    sim.world.clock.day = dayOf(1);
    expect(buildingOpen(sim, joinery)).toBe(false);
  });

  it('souper de la pension: le dimanche, 15 aubrins chacun, le Ventre se remplit mieux à deux', () => {
    const sim = newSim(15);
    const meal = sim.content.settings.flagEffects.meals.find((m) => m.id === 'pension_supper');
    if (meal === undefined) throw new Error('souper absent');
    const at = sim.map.points[meal.point];
    if (at === undefined) throw new Error('porte de la salle à manger absente');
    expect(mealAtPoint(sim, meal.point)).toBeNull();
    raise(sim, 'pension_dining_open');
    expect(mealAtPoint(sim, meal.point)?.id).toBe('pension_supper');
    sim.world.clock.day = dayOf(1);
    sim.world.clock.minutes = minutes(18);
    sim.world.purse = 100;
    const [a, b] = [character(sim, 'p1'), character(sim, 'p2')];
    for (const c of [a, b]) {
      placeCharacter(sim, c, { x: at.x, y: at.y + 0.5 });
      c.inside = meal.building;
      c.needs.belly = 0;
    }
    orderMeal(sim, a, meal);
    const alone = a.needs.belly;
    orderMeal(sim, b, meal);
    expect(sim.world.purse).toBe(70);
    expect(alone).toBeGreaterThan(30);
    // Le second profite du repas pris ensemble (+10 de plus que seul), la première aussi.
    expect(b.needs.belly).toBeGreaterThan(alone);
    expect(a.needs.belly).toBeGreaterThan(alone);
    // Une part par personne, puis plus rien.
    orderMeal(sim, a, meal);
    expect(sim.world.purse).toBe(70);
    // Le lundi, c'est fermé.
    sim.world.clock.day = dayOf(2);
    b.needs.belly = 0;
    sim.world.countersToday.p2 = {};
    orderMeal(sim, b, meal);
    expect(sim.world.purse).toBe(70);
  });

  it('soupe du jour: 12 aubrins au comptoir du café, deux bols par jour et par personne', () => {
    const sim = newSim(16);
    const meal = sim.content.settings.flagEffects.meals.find((m) => m.id === 'cafe_soup');
    const at = meal === undefined ? undefined : sim.map.points[meal.point];
    if (meal === undefined || at === undefined) throw new Error('soupe absente');
    raise(sim, 'soup_of_the_day');
    sim.world.clock.day = dayOf(4);
    sim.world.clock.minutes = minutes(12);
    sim.world.purse = 100;
    const c = character(sim, 'p1');
    placeCharacter(sim, c, { x: at.x, y: at.y + 0.8 });
    c.inside = meal.building;
    c.needs.belly = 10;
    orderMeal(sim, c, meal);
    orderMeal(sim, c, meal);
    orderMeal(sim, c, meal);
    expect(sim.world.purse).toBe(76);
    expect(c.needs.belly).toBeGreaterThan(40);
  });

  it('jumelles: prêtées le mercredi matin à chacun, reprises le lendemain', () => {
    const sim = newSim(17);
    raise(sim, 'binoculars_lent');
    sim.world.clock.day = dayOf(4);
    morningFlagEffects(sim);
    for (const c of sim.world.characters) expect(countInBag(c, 'binoculars')).toBe(1);
    sim.world.clock.day = dayOf(5);
    morningFlagEffects(sim);
    for (const c of sim.world.characters) expect(countInBag(c, 'binoculars')).toBe(0);
  });

  // 0.13 (v0-13-habitants.md, `mill` et `berthe_sluice`): le moulin est arrêté jusqu'à la vanne
  // levée de la première quête de Berthe, qui pose `mill_running`; le départ d'office ne vaut
  // plus que si aucune donnée ne pose le drapeau.
  it('moulin: arrêté tant que la quête de Berthe peut lever la vanne; sans elle, la roue part d’office', () => {
    const sim = newSim(18);
    raiseAutoFlags(sim);
    expect(sim.world.flags).not.toContain('mill_running');
    const content = structuredClone(contentAndMap().content);
    content.quests = content.quests.map((q) => ({
      ...q,
      completionEffects: q.completionEffects.filter((e) => !(e.type === 'set_flag' && e.flag === 'mill_running')),
    }));
    const without = newSim(18, content);
    expect(without.world.flags).not.toContain('mill_running');
    raiseAutoFlags(without);
    expect(without.world.flags).toContain('mill_running');
  });
});
