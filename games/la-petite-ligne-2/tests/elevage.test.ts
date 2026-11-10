// Basse-cour (cahier 4.7, réponse 31, R20): une semaine simulée avec et sans grain, les gestes
// (remplir, ramasser, caresser, acheter), le rattrapage des jours passés ailleurs, la promenade,
// et une espèce et un abri factices ajoutés par les seules données.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent, type Content } from '../src/donnees/charger';
import { WorldSchema } from '../src/etat/monde';
import { shelterView } from '../src/simulation/elevage/abri';
import { animalSpots } from '../src/simulation/elevage/promenade';
import type { Sim } from '../src/simulation/noyau/pas';
import { dataFiles, gameContent, newSim } from './aides';

const game = gameContent();
import { run, send } from './aides-noyau';

const COOP = 'poulailler';

/**
 * Le poulailler d'essai vit à la halte d'essai; pour les tests, le même est posé au lieu de
 * départ (la tranche « lieu » du pire cas des habitants n'a plus de marge, voir le compte rendu).
 */
function coopContent(): Content {
  const files = dataFiles();
  const map = files['lieux/essai-gare/carte.json'] as { objects: unknown[] };
  map.objects.push({ id: COOP, type: 'poulailler-d-essai', x: 5.5, y: 24, rotation: 0 });
  return loadContent(files);
}
const content = coopContent();

function nextDay(sim: Sim, days = 1): void {
  sim.world.common.day += days;
  run(sim, 1 / 30);
}

function shelter(
  sim: Sim,
): NonNullable<NonNullable<Sim['world']['places'][string]>['objects'][string]['shelter']> {
  const state = sim.world.places[sim.world.common.place]?.objects[COOP]?.shelter;
  if (state === undefined) throw new Error('poulailler absent');
  return state;
}

function count(sim: Sim, item: string): number {
  const p = sim.world.players[0];
  return [...p.toolbar, ...(p.bag?.slots ?? [])].reduce(
    (sum, stack) => sum + (stack?.item === item ? stack.count : 0),
    0,
  );
}

describe('basse-cour', () => {
  it('le poulailler d’essai est posé à la halte d’essai', () => {
    expect(game.places['essai-halte']?.map.objects.find((o) => o.id === COOP)?.type).toBe(
      'poulailler-d-essai',
    );
  });

  it('le poulailler d’essai a trois poules, une mangeoire pleine et un nid vide', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    const view = shelterView(sim, COOP);
    expect(view?.animals.map((a) => a.name)).toEqual(['Bichette', 'Noisette', 'Plume']);
    expect(view?.feeder).toMatchObject({ rations: 20, capacity: 20, days: 6, level: 'full' });
    expect(view?.nest.count).toBe(0);
    expect(view?.places).toBe(4);
  });

  it('une semaine nourrie: un œuf par poule et par jour, la mangeoire baisse, le nid plafonne à 12', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    nextDay(sim);
    expect(shelterView(sim, COOP)?.nest.count).toBe(3);
    expect(shelterView(sim, COOP)?.animals.every((a) => a.laidToday && a.mood === 'happy')).toBe(
      true,
    );
    for (let i = 0; i < 5; i++) nextDay(sim);
    const view = shelterView(sim, COOP);
    expect(view?.feeder.rations).toBe(2);
    expect(view?.feeder.level).toBe('empty');
    expect(view?.nest).toMatchObject({ count: 12, full: true });
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
  });

  it('une semaine sans grain: personne ne meurt ni ne part; elles pondent moins puis plus du tout, et le disent', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    shelter(sim).feed = 0;
    const laid: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = shelterView(sim, COOP)?.nest.count ?? 0;
      nextDay(sim);
      laid.push((shelterView(sim, COOP)?.nest.count ?? 0) - before);
    }
    expect(laid).toEqual([0, 3, 0, 0, 0, 0, 0]);
    const view = shelterView(sim, COOP);
    expect(view?.animals).toHaveLength(3);
    expect(view?.animals.every((a) => a.mood === 'hungry' && a.sound === '??')).toBe(true);
  });

  it('remplir en un geste prend le grain du sac puis du coffre; ramasser prend tout le nid', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    shelter(sim).feed = 2;
    sim.world.players[0].toolbar[2] = { item: 'grain', count: 10 };
    const chest = sim.world.places[sim.world.common.place]?.objects['coffre-de-gare']?.store;
    if (chest === undefined) throw new Error('coffre absent');
    chest[0] = { item: 'grain', count: 30 };
    const events = send(sim, 0, { type: 'shelter_fill', target: COOP });
    expect(events).toContainEqual(expect.objectContaining({ type: 'shelter_filled', rations: 18 }));
    expect(count(sim, 'grain')).toBe(0);
    expect(chest[0]).toEqual({ item: 'grain', count: 22 });
    expect(send(sim, 0, { type: 'shelter_fill', target: COOP })).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'feeder-full' }),
    );
    nextDay(sim, 1);
    nextDay(sim, 1);
    expect(send(sim, 1, { type: 'shelter_collect', target: COOP })).toContainEqual(
      expect.objectContaining({ type: 'shelter_collected', count: 6 }),
    );
    expect(shelterView(sim, COOP)?.nest.count).toBe(0);
    expect(send(sim, 1, { type: 'shelter_collect', target: COOP })).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'nest-empty' }),
    );
  });

  it('caresses: une par jour et par joueur, les cœurs montent, et à 4 cœurs les œufs sont roux', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    expect(send(sim, 0, { type: 'animal_pet', target: COOP, animal: 0 })).toContainEqual(
      expect.objectContaining({ type: 'animal_petted', hearts: 0 }),
    );
    expect(send(sim, 0, { type: 'animal_pet', target: COOP, animal: 0 })).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'already-petted' }),
    );
    send(sim, 1, { type: 'animal_pet', target: COOP, animal: 0 });
    const first = shelter(sim).animals[0];
    if (first === undefined) throw new Error('poule absente');
    first.love = 12;
    shelter(sim).feed = 20;
    nextDay(sim);
    expect(shelter(sim).nest).toContainEqual({ item: 'oeuf-roux', count: 1 });
    expect(shelterView(sim, COOP)?.animals[0]?.hearts).toBe(4);
  });

  it('acheter une poule: payée, robe tirée, limite des places, agrandissement par un fait', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    sim.world.players[0].money = 5000;
    expect(send(sim, 0, { type: 'animal_buy', target: COOP })).toContainEqual(
      expect.objectContaining({ type: 'animal_arrived', by: 0, animal: 3 }),
    );
    expect(sim.world.players[0].money).toBe(4200);
    expect(shelterView(sim, COOP)?.animals[3]?.name).toBe('Griotte');
    expect(send(sim, 0, { type: 'animal_buy', target: COOP })).toContainEqual(
      expect.objectContaining({ type: 'refused', reason: 'shelter-full' }),
    );
    sim.world.progress.memory['logement.poulailler.agrandi'] = { v: true, by: 'duo', day: 1 };
    expect(shelterView(sim, COOP)?.places).toBe(6);
    send(sim, 1, { type: 'animal_rename', target: COOP, animal: 3, name: 'Duchesse' });
    expect(shelterView(sim, COOP)?.animals[3]?.name).toBe('Duchesse');
  });

  it('dix jours ailleurs se rattrapent d’un coup au retour, sans rien perdre au-delà du nid', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    nextDay(sim, 10);
    const view = shelterView(sim, COOP);
    expect(view?.nest.count).toBe(12);
    expect(view?.feeder.rations).toBe(0);
    expect(view?.animals).toHaveLength(3);
  });

  it('promenade: dans l’enclos le jour, dans l’abri la nuit, identique d’un appel à l’autre', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    const day = animalSpots(sim, COOP, 600);
    expect(day).toHaveLength(3);
    for (const spot of day) {
      expect(spot.x).toBeGreaterThanOrEqual(2.5);
      expect(spot.x).toBeLessThanOrEqual(8.5);
      expect(spot.y).toBeGreaterThanOrEqual(25.2);
      expect(spot.y).toBeLessThanOrEqual(29.2);
    }
    expect(animalSpots(sim, COOP, 600)).toEqual(day);
    expect(animalSpots(sim, COOP, 1300).every((s) => s.pose === 'roost')).toBe(true);
  });

  it('une espèce et un abri factices, ajoutés en données seulement, vivent pareil', () => {
    const files = dataFiles() as Record<string, Record<string, unknown>>;
    const hen = files['commun/especes/poule.json'] ?? {};
    files['commun/especes/lapin-d-essai.json'] = {
      ...hen,
      id: 'lapin-d-essai',
      name: 'Lapin',
      food: 'carotte',
      product: { every: 2, qualities: [{ hearts: 0, item: 'radis' }], pettedChance: 0 },
      robes: [{ id: 'grise', name: 'Grise', color: '#888888' }],
      names: ['Pompon'],
    };
    const coop = files['commun/meubles/poulailler-d-essai.json'] as {
      bricks: Record<string, unknown>[];
    };
    files['commun/meubles/clapier-d-essai.json'] = {
      ...coop,
      id: 'clapier-d-essai',
      name: 'Clapier',
      bricks: [
        {
          ...coop.bricks[0],
          species: 'lapin-d-essai',
          feeder: 6,
          starters: [{ name: 'Pompon', robe: 'grise' }],
        },
      ],
    };
    const gare = files['lieux/essai-gare/carte.json'] as { objects: unknown[] };
    gare.objects.push({ id: 'clapier', type: 'clapier-d-essai', x: 30.5, y: 27, rotation: 1 });
    const sim = newSim(loadContent(files));
    run(sim, 1 / 30);
    nextDay(sim);
    nextDay(sim);
    expect(shelterView(sim, 'clapier')).toMatchObject({
      species: 'lapin-d-essai',
      food: 'carotte',
      feeder: { rations: 4 },
      nest: { items: [{ item: 'radis', count: 1 }] },
    });
    expect(animalSpots(sim, 'clapier', 600)).toHaveLength(1);
  });
});
