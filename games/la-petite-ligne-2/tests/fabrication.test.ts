// Fabrication à l'établi et atelier de l'artisan (cahier 4.5 et 4.7): tests courts, graine fixe.
import { describe, expect, it } from 'vitest';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { Intent } from '../src/simulation/noyau/entrees';
import type { Sim } from '../src/simulation/noyau/pas';
import { jobAt } from '../src/simulation/fabrication/index';
import { orderOf, planKey, repairPrice, stationOf } from '../src/simulation/fabrication/plans';
import { workshopModel } from '../src/interface/atelier/modele';
import { act, contentWith, newSim, wait } from './aides-l3';
import { gameContent } from './aides';

const BENCH = 'etabli-de-gare';
const FORGE = 'forge-d-essai';
const GRINDSTONE = 'meule-d-essai';

/** Place le joueur devant un poste du lieu d'essai. */
function standAt(sim: Sim, player: PlayerIndex, target: string): void {
  const station = stationOf(sim, target);
  if (station === null) throw new Error(`poste absent: ${target}`);
  sim.world.players[player].body.x = station.x + (player === 0 ? -0.2 : 0.2);
  sim.world.players[player].body.y = station.y + 1;
}

/** Frappe jusqu'à la fin de l'ouvrage, au rythme d'un coup par seconde pour chaque joueur. */
function hammer(sim: Sim, players: readonly PlayerIndex[], target: string, max = 30): number {
  let strikes = 0;
  for (let i = 0; i < max && jobAt(sim.world, target) !== null; i++) {
    for (const p of players) {
      if (jobAt(sim.world, target) === null) break;
      act(sim, p, { type: 'craft_strike', target });
      strikes += 1;
    }
    wait(sim, 1);
  }
  return strikes;
}

function intent(sim: Sim, player: PlayerIndex, i: Intent): string[] {
  return act(sim, player, i).flatMap((e) => (e.type === 'refused' ? [e.reason] : []));
}

describe('fabrication', () => {
  it("les dix plans d'essai se chargent, avec un établi, une forge et une meule au lieu d'essai", () => {
    const content = gameContent();
    expect(Object.keys(content.plans).length).toBeGreaterThanOrEqual(10);
    const sim = newSim(content);
    for (const id of [BENCH, FORGE, GRINDSTONE]) expect(stationOf(sim, id)).not.toBeNull();
  });

  it("fabrique un meuble à l'établi: matériaux du sac et du coffre, fête la première fois", () => {
    const sim = newSim();
    const me = sim.world.players[0];
    standAt(sim, 0, BENCH);
    me.toolbar[0] = { item: 'planche', count: 1 };
    // Le coffre de la gare (la maison d'essai) prête la planche qui manque.
    act(sim, 0, { type: 'use_brick', target: 'coffre-de-gare', brick: 'store' });
    const chest = sim.world.places[sim.world.common.place]?.objects['coffre-de-gare']?.store;
    if (chest === undefined) throw new Error('coffre absent');
    chest[0] = { item: 'planche', count: 3 };
    const opened = act(sim, 0, { type: 'use_brick', target: BENCH, brick: 'craft' });
    expect(opened.some((e) => e.type === 'workshop_opened')).toBe(true);
    expect(
      intent(sim, 0, { type: 'craft_start', target: BENCH, plan: 'tabouret-campagne', variant: 1 }),
    ).toEqual([]);
    const strikes = hammer(sim, [0], BENCH);
    expect(strikes).toBe(6); // 24 points, 4 par coup à mains nues
    expect(me.toolbar.some((s) => s?.item === 'tabouret-sauge')).toBe(true);
    expect(me.toolbar.some((s) => s?.item === 'planche')).toBe(false);
    expect(chest[0]).toEqual({ item: 'planche', count: 2 });
    expect(sim.world.progress.memory[planKey('tabouret-campagne')]?.v).toBe(1);
  });

  it('va deux fois plus vite à deux sur le même établi, et le marteau aide', () => {
    const sim = newSim();
    standAt(sim, 0, BENCH);
    standAt(sim, 1, BENCH);
    sim.world.players[0].toolbar[0] = { item: 'planche', count: 3 };
    sim.world.players[1].toolbar[0] = { item: 'marteau', count: 1 };
    sim.world.players[1].selected = 0;
    act(sim, 0, {
      type: 'craft_start',
      target: BENCH,
      plan: 'table-de-chevet-campagne',
      variant: 0,
    });
    const events: string[] = [];
    let rounds = 0;
    while (jobAt(sim.world, BENCH) !== null && rounds < 20) {
      for (const p of [0, 1] as const)
        for (const e of act(sim, p, { type: 'craft_strike', target: BENCH })) events.push(e.type);
      wait(sim, 1);
      rounds += 1;
    }
    // 36 points: 4 + 6 par tour à deux, donc 4 tours (seul et sans marteau: 9 coups).
    expect(rounds).toBe(4);
    expect(sim.world.players[0].toolbar.some((s) => s?.item === 'table-de-chevet-miel')).toBe(true);
  });

  it('refuse clairement: plan inconnu, matériaux manquants, trop loin, poste occupé', () => {
    const sim = newSim();
    standAt(sim, 0, BENCH);
    expect(
      intent(sim, 0, { type: 'craft_start', target: BENCH, plan: 'etagere-campagne', variant: 0 }),
    ).toEqual(['unknown-plan']);
    expect(
      intent(sim, 0, { type: 'craft_start', target: BENCH, plan: 'tabouret-campagne', variant: 0 }),
    ).toEqual(['missing-materials']);
    expect(
      intent(sim, 1, { type: 'craft_start', target: BENCH, plan: 'tabouret-campagne', variant: 0 }),
    ).toEqual(['too-far']);
    sim.world.players[0].toolbar[0] = { item: 'planche', count: 2 };
    intent(sim, 0, { type: 'craft_start', target: BENCH, plan: 'tabouret-campagne', variant: 0 });
    standAt(sim, 1, BENCH);
    sim.world.players[1].toolbar[0] = { item: 'planche', count: 2 };
    expect(
      intent(sim, 1, { type: 'craft_start', target: BENCH, plan: 'tabouret-campagne', variant: 0 }),
    ).toEqual(['busy']);
    // Laisser l'ouvrage ne coûte rien.
    act(sim, 0, { type: 'craft_cancel', target: BENCH });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'planche', count: 2 });
  });

  it("apprend un plan papier en ouvrant l'atelier", () => {
    const sim = newSim();
    standAt(sim, 0, BENCH);
    sim.world.players[0].toolbar[2] = { item: 'plan-de-lanterne', count: 1 };
    const events = act(sim, 0, { type: 'use_brick', target: BENCH, brick: 'craft' });
    expect(events.some((e) => e.type === 'plan_learned' && e.plan === 'lanterne')).toBe(true);
    expect(sim.world.players[0].toolbar[2]).toBeNull();
  });

  it('améliore un outil à la forge, tout de suite ou prêt demain', () => {
    const sim = newSim();
    const me = sim.world.players[0];
    standAt(sim, 0, FORGE);
    me.money = 2000;
    me.toolbar[0] = { item: 'hache', count: 1 };
    me.toolbar[1] = { item: 'buche', count: 2 };
    expect(intent(sim, 0, { type: 'craft_tool', target: FORGE, slot: 0, job: 'upgrade' })).toEqual([
      'not-enough-money',
    ]);
    me.money = 7000;
    expect(intent(sim, 0, { type: 'craft_tool', target: FORGE, slot: 0, job: 'upgrade' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'hache-forgee', count: 1, wear: 120 });
    expect(me.money).toBe(4000);
    // La bêche forgée est prête le lendemain: l'outil reste chez l'artisan.
    me.toolbar[0] = { item: 'beche', count: 1 };
    me.toolbar[1] = { item: 'buche', count: 2 };
    expect(intent(sim, 0, { type: 'craft_tool', target: FORGE, slot: 0, job: 'upgrade' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toBeNull();
    expect(me.money).toBe(1000);
    expect(orderOf(sim.world, 0)).toEqual({ item: 'beche-forgee', day: sim.world.common.day + 1 });
    act(sim, 0, { type: 'use_brick', target: FORGE, brick: 'craft' });
    expect(me.toolbar.some((s) => s?.item === 'beche-forgee')).toBe(false);
    sim.world.common.day += 1;
    act(sim, 0, { type: 'use_brick', target: FORGE, brick: 'craft' });
    expect(me.toolbar.some((s) => s?.item === 'beche-forgee')).toBe(true);
    expect(orderOf(sim.world, 0)).toBeNull();
  });

  it("répare en payant selon l'usure, affûte gratuitement à la meule jusqu'à la moitié", () => {
    const sim = newSim();
    const me = sim.world.players[0];
    me.money = 1000;
    me.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 90 };
    const quarter = repairPrice(sim.content, { item: 'hache-forgee', count: 1, wear: 90 });
    const full = repairPrice(sim.content, { item: 'hache-forgee', count: 1, wear: 0 });
    expect(quarter).toBeLessThan(full ?? 0);
    standAt(sim, 0, FORGE);
    expect(intent(sim, 0, { type: 'craft_tool', target: FORGE, slot: 0, job: 'repair' })).toEqual(
      [],
    );
    expect(me.toolbar[0]).toEqual({ item: 'hache-forgee', count: 1, wear: 120 });
    expect(me.money).toBe(1000 - (quarter ?? 0));
    expect(intent(sim, 0, { type: 'craft_tool', target: FORGE, slot: 0, job: 'repair' })).toEqual([
      'already-sharp',
    ]);
    // La meule: des tours d'une seconde, jusqu'à la moitié de l'usure, sans payer.
    me.toolbar[0] = { item: 'hache-forgee', count: 1, wear: 0 };
    standAt(sim, 0, GRINDSTONE);
    let turns = 0;
    for (let i = 0; i < 10; i++) {
      const refused = intent(sim, 0, {
        type: 'craft_tool',
        target: GRINDSTONE,
        slot: 0,
        job: 'sharpen',
      });
      if (refused.includes('sharp-enough')) break;
      turns += 1;
      wait(sim, 1);
    }
    expect(me.toolbar[0]).toEqual({ item: 'hache-forgee', count: 1, wear: 60 });
    expect(turns).toBe(4);
    expect(me.money).toBe(1000 - (quarter ?? 0));
    me.toolbar[1] = { item: 'hache', count: 1 };
    expect(
      intent(sim, 0, { type: 'craft_tool', target: GRINDSTONE, slot: 1, job: 'sharpen' }),
    ).toEqual(['cannot-sharpen']);
  });

  it('un plan factice ajouté par les données fonctionne sans autre changement', () => {
    const content = contentWith((files) => {
      files['commun/plans/plan-factice.json'] = {
        schema: 1,
        id: 'plan-factice',
        name: 'Caisse factice',
        makes: { kind: 'item', item: 'nichoir', count: 1 },
        station: 'workbench',
        materials: [{ item: 'buche', count: 1 }],
        work: 8,
        source: 'start',
        series: null,
      };
    });
    const sim = newSim(content);
    standAt(sim, 0, BENCH);
    sim.world.players[0].toolbar[0] = { item: 'buche', count: 1 };
    const station = stationOf(sim, BENCH);
    if (station === null) throw new Error('établi absent');
    const model = workshopModel(content, sim.world, 0, {
      target: BENCH,
      tab: 'make',
      focus: 0,
      variant: 0,
    });
    expect(model?.tiles.some((t) => t.id === 'plan-factice' && t.state === 'ok')).toBe(true);
    act(sim, 0, { type: 'craft_start', target: BENCH, plan: 'plan-factice', variant: 0 });
    hammer(sim, [0], BENCH);
    expect(sim.world.players[0].toolbar.some((s) => s?.item === 'nichoir')).toBe(true);
  });

  it('refuse au chargement un plan aux références fausses', () => {
    expect(() =>
      contentWith((files) => {
        files['commun/plans/plan-faux.json'] = {
          schema: 1,
          id: 'plan-faux',
          name: 'Faux',
          makes: { kind: 'upgrade', from: 'pomme' },
          station: 'loom',
          materials: [{ item: 'rien', count: 1 }],
          work: 8,
          source: 'start',
          series: null,
        };
      }),
    ).toThrow(/plan-faux\.json/);
  });
});
