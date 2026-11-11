// Outils, gestes de récolte et potager (cahier 4.5 et 4.7): un test court par geste, une croissance
// complète en quelques jours simulés, les gabarits « culture » et « ressource ».
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { WorldSchema } from '../src/etat/monde';
import { gestureOf } from '../src/simulation/briques/geste';
import { aimOf } from '../src/simulation/briques/visee';
import { fieldView } from '../src/simulation/cultures/potager';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { rainedOn, weatherOfSlot } from '../src/simulation/monde/meteo';
import { drawLoot, lootAvailable } from '../src/simulation/outils/butin';
import { HARVEST_TUNING } from '../src/simulation/outils/reglages';
import { resourceReady } from '../src/simulation/outils/ressources';
import { contentWith, contextOf } from './aides-l3';
import { dataFiles, gameContent, newSim } from './aides';
import { NORTH, put, run, send, SOUTH } from './aides-noyau';

const content = gameContent();

function hold(sim: Sim, item: string, count = 1, player: PlayerIndex = 0): void {
  const durability = sim.content.items[item]?.tool?.durability ?? 0;
  sim.world.players[player].toolbar[0] =
    durability > 0 ? { item, count, wear: durability } : { item, count };
  sim.world.players[player].selected = 0;
}

/** Un appui puis la fin du geste: les événements nés. */
function stroke(sim: Sim, player: PlayerIndex = 0): GameEvent[] {
  return [...send(sim, player, { type: 'act' }), ...run(sim, 1.6)];
}

function count(sim: Sim, item: string, player: PlayerIndex = 0): number {
  const state = sim.world.players[player];
  return [...state.toolbar, ...(state.bag?.slots ?? [])].reduce(
    (sum, stack) => sum + (stack?.item === item ? stack.count : 0),
    0,
  );
}

function objects(sim: Sim): NonNullable<Sim['world']['places'][string]>['objects'] {
  const place = sim.world.places[sim.world.common.place];
  if (place === undefined) throw new Error('lieu absent');
  return place.objects;
}

function nextDay(sim: Sim, days = 1): void {
  sim.world.common.day += days;
  run(sim, 1 / 30);
}

const hits = (events: readonly GameEvent[]): GameEvent[] =>
  events.filter((event) => event.type === 'work_hit');

describe('ressources du monde', () => {
  it('chêne: verbe montré avant, 6 coups à la hache de base, il tombe, repousse 3 jours plus tard', () => {
    const sim = newSim(content);
    hold(sim, 'hache');
    put(sim, 0, 3.5, 35.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'chene', verb: 'Couper', refusal: null });
    const hunger = sim.world.players[0].needs.hunger;
    const all: GameEvent[] = [];
    for (let i = 0; i < 6; i++) all.push(...stroke(sim));
    expect(all.filter((e) => e.type === 'gesture_started')).toHaveLength(6);
    expect(hits(all).map((e) => (e.type === 'work_hit' ? e.done : null))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    expect(all).toContainEqual(
      expect.objectContaining({ type: 'harvested', resource: 'chene', item: 'buche' }),
    );
    expect(count(sim, 'buche')).toBeGreaterThanOrEqual(3);
    expect(sim.world.players[0].needs.hunger).toBeLessThan(hunger - 6 * 0.3 + 1e-9);
    expect(resourceReady(sim, objects(sim).chene?.harvest)).toBe(false);
    expect(aimOf(sim, 0)?.refusal).toBe('not-yet-back');
    nextDay(sim, 3);
    expect(resourceReady(sim, objects(sim).chene?.harvest)).toBe(true);
    expect(aimOf(sim, 0)?.refusal).toBeNull();
  });

  it('hache forgée: 4 coups et usure; émoussée, 9 coups; le gros chêne refuse la hache de base', () => {
    const sim = newSim(content);
    hold(sim, 'hache-forgee');
    put(sim, 0, 3.5, 35.4, SOUTH);
    run(sim, 0.1);
    const forged = Array.from({ length: 4 }, () => stroke(sim)).flat();
    expect(hits(forged).at(-1)).toMatchObject({ done: true });
    expect(sim.world.players[0].toolbar[0]?.wear).toBe(116);

    const blunt = newSim(content);
    hold(blunt, 'hache-forgee');
    const tool = blunt.world.players[0].toolbar[0];
    if (tool) tool.wear = 0;
    put(blunt, 0, 3.5, 35.4, SOUTH);
    run(blunt, 0.1);
    const slow = Array.from({ length: 9 }, () => stroke(blunt)).flat();
    expect(
      hits(slow)
        .map((e) => (e.type === 'work_hit' ? e.done : null))
        .indexOf(true),
    ).toBe(8);

    const weak = newSim(content);
    hold(weak, 'hache');
    put(weak, 0, 7, 34.4, SOUTH);
    run(weak, 0.1);
    expect(aimOf(weak, 0)).toMatchObject({ id: 'gros-chene', refusal: 'tool-too-weak' });
    hold(weak, 'beche');
    expect(aimOf(weak, 0)?.refusal).toBe('needs-axe');
  });

  it('caillou et branches à mains nues, réapparition le lendemain; coquelicots refusés hors saison', () => {
    const sim = newSim(content);
    put(sim, 0, 12.5, 36.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'caillou', verb: 'Ramasser' });
    stroke(sim);
    expect(count(sim, 'pierre')).toBe(1);
    expect(aimOf(sim, 0)?.refusal).toBe('not-yet-back');
    nextDay(sim);
    expect(aimOf(sim, 0)?.refusal).toBeNull();

    put(sim, 0, 15.5, 36.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'coquelicots', verb: 'Cueillir', refusal: null });
    sim.world.common.day = 43; // hiver
    expect(aimOf(sim, 0)?.refusal).toBe('nothing-now');
  });

  it('fouille: la bêche creuse le sol qui scintille, salit, et sort une trouvaille de la table', () => {
    const sim = newSim(content);
    hold(sim, 'beche');
    put(sim, 0, 33.5, 35.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'point-de-fouille', verb: 'Creuser' });
    const hygiene = sim.world.players[0].needs.hygiene;
    const events = [...stroke(sim), ...stroke(sim)];
    expect(hits(events).at(-1)).toMatchObject({ action: 'dig', done: true });
    expect(sim.world.players[0].needs.hygiene).toBeLessThan(hygiene - 1.5);
    const found = events.find((e) => e.type === 'harvested');
    // La trouvaille sort de la table du sol qui scintille (pièces, fossiles et trésors du lieu).
    const table = content.resources['point-de-fouille']?.loot.map((l) => l.item) ?? [];
    expect(table).toContain(found?.type === 'harvested' && found.item);
  });

  it('fouille propre à un endroit: le point déclare sa fiche, la trouvaille sort de sa table', () => {
    const own = contentWith((files) => {
      const objects = files['lieux/essai-gare/carte.json']?.objects as Record<string, unknown>[];
      objects.push({
        id: 'fouille-de-la-roche',
        type: 'point-de-fouille',
        x: 17.5,
        y: 37.5,
        rotation: 0,
        resource: 'fouille-roche',
      });
    });
    const sim = newSim(own);
    hold(sim, 'beche');
    put(sim, 0, 17.5, 36.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'fouille-de-la-roche', verb: 'Creuser' });
    const found = [...stroke(sim), ...stroke(sim)].find((e) => e.type === 'harvested');
    expect(found).toMatchObject({ resource: 'fouille-roche' });
    const table = own.resources['fouille-roche']?.loot.map((l) => l.item) ?? [];
    expect(table).toContain(found?.type === 'harvested' && found.item);
    // Les autres points gardent la table commune.
    put(sim, 0, 33.5, 35.4, SOUTH);
    run(sim, 0.1);
    const common = [...stroke(sim), ...stroke(sim)].find((e) => e.type === 'harvested');
    expect(common).toMatchObject({ resource: 'point-de-fouille' });
    // Fiche d'un autre geste refusée au chargement (le rendu suit la fiche du meuble).
    expect(() =>
      contentWith((files) => {
        const objects = files['lieux/essai-gare/carte.json']?.objects as Record<string, unknown>[];
        objects.push({
          id: 'x',
          type: 'point-de-fouille',
          x: 17.5,
          y: 37.5,
          rotation: 0,
          resource: 'coquelicots',
        });
      }),
    ).toThrow(/geste et le reste/);
  });

  it('coquelicots posés par le plan d’Aubrune: ils se cueillent à la main et repoussent le lendemain', () => {
    const aubrune = contentWith((files) => {
      const settings = files['commun/reglages.json'] as { start: Record<string, unknown> };
      settings.start = { ...settings.start, place: 'aubrune', minute: 600 };
    });
    const sim = newSim(aubrune);
    run(sim, 0.2);
    const story = sim.world.common.story;
    if (story !== undefined) story.scene = null;
    put(sim, 0, 305.5, 125.4, NORTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({
      id: 'coquelicots-verger',
      verb: 'Cueillir',
      refusal: null,
    });
    stroke(sim);
    expect(count(sim, 'coquelicot')).toBeGreaterThan(0);
    expect(aimOf(sim, 0)?.refusal).toBe('not-yet-back');
    nextDay(sim);
    expect(aimOf(sim, 0)?.refusal).toBeNull();
  });

  it('table de butin: chance des besoins sur les rares (`rareLuck`) et exemplaire en plus (`extraCatch`)', () => {
    const sim = newSim(content);
    const resource = content.resources['point-de-fouille'];
    if (resource === undefined) throw new Error('ressource absente');
    const ctx = contextOf(sim);
    const rares = (luck: number): number => {
      let n = 0;
      for (let i = 0; i < 400; i++) if (drawLoot(ctx, resource, luck, 0)[0]?.rare === true) n++;
      return n;
    };
    expect(rares(20)).toBeGreaterThan(rares(1) * 2);
    sim.world.common.weather = 'rain';
    expect(rares(1)).toBeGreaterThan(80); // poids 1 + 3 sous la pluie, contre 6
    expect(drawLoot(ctx, resource, 1, 1)[0]?.count).toBe(2);
  });

  it('« il a plu hier » (`rainedYesterday`): la veille, pas le temps du moment; même calcul chez l’invité', () => {
    const sim = newSim(content);
    const place = sim.world.common.place;
    const minutes = HARVEST_TUNING.rainedYesterdayMinutes;
    const { dayStart, nightStart } = content.settings.clock;
    const slots = content.time.file.weatherSlots;
    const watering = content.time.file.wateringWeathers;
    // Référence directe: une tranche de pluie couvrant au moins une heure du jour.
    const expected = (day: number): boolean =>
      slots.some((start, i) => {
        const end = slots[i + 1] ?? (slots[0] ?? 0) + 1440;
        const overlap = Math.min(end, nightStart) - Math.max(start, dayStart);
        return (
          overlap >= minutes &&
          watering.includes(weatherOfSlot(content, sim.world.seed, place, day, i))
        );
      });
    let wet = 0;
    let dry = 0;
    for (let day = 1; day <= 40 && (wet === 0 || dry === 0); day++) {
      if (rainedOn(content, sim.world.seed, place, day, minutes)) wet = day;
      else dry = day;
      expect(rainedOn(content, sim.world.seed, place, day, minutes)).toBe(expected(day));
    }
    expect(wet).toBeGreaterThan(0);
    expect(dry).toBeGreaterThan(0);
    const line = {
      item: 'coquille-de-riviere',
      min: 2,
      max: 3,
      weight: 1,
      rare: false,
      hours: null,
      weathers: [],
      seasons: [],
    };
    const after = { ...line, rainedYesterday: true };
    const before = { ...line, rainedYesterday: false };
    // Le lendemain d'un jour de pluie, même sous le soleil: la ligne « après la pluie » s'ouvre.
    sim.world.common.day = wet + 1;
    sim.world.common.weather = 'clear';
    expect(lootAvailable(content, sim.world, after)).toBe(true);
    expect(lootAvailable(content, sim.world, before)).toBe(false);
    expect(lootAvailable(content, sim.world, line)).toBe(true);
    // Le lendemain d'un jour sec, même sous la pluie: seule la ligne « jour sec » s'ouvre.
    sim.world.common.day = dry + 1;
    sim.world.common.weather = 'rain';
    expect(lootAvailable(content, sim.world, after)).toBe(false);
    expect(lootAvailable(content, sim.world, before)).toBe(true);
    // Les trouvailles de berge qui le demandent (plan d'Aubrune, section 19) l'utilisent.
    for (const id of ['coquilles-de-greve', 'limnees-de-l-etang', 'laisse-de-crue', 'girolles'])
      expect(content.resources[id]?.loot.some((e) => e.rainedYesterday === true)).toBe(true);
    // Premier jour: pas de veille.
    expect(rainedOn(content, sim.world.seed, place, 0, minutes)).toBe(false);
  });

  it('arbre fruitier: secouer fait tomber les pommes au sol autour de lui', () => {
    const sim = newSim(content);
    put(sim, 0, 36.5, 35.4, SOUTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'fruitier', verb: 'Secouer' });
    stroke(sim);
    const ground = sim.world.places[sim.world.common.place]?.ground ?? [];
    expect(ground.filter((g) => g.stack.item === 'pomme').length).toBeGreaterThan(0);
    for (const g of ground) expect(Math.hypot(g.x - 36.5, g.y - 36.5)).toBeLessThan(1);
  });

  it('`toolSpeed`: un coup de hache plus court en bonus, plus long au palier bas', () => {
    const sim = newSim(content);
    hold(sim, 'hache');
    put(sim, 0, 3.5, 35.4, SOUTH);
    const seconds = (tier: 'low' | 'neutral' | 'bonus'): number => {
      sim.world.players[0].tiers.hunger = tier;
      return gestureOf(sim, 0, 'prop', 'chene', 'harvest')?.seconds ?? 0;
    };
    expect(seconds('neutral')).toBeCloseTo(1, 6);
    expect(seconds('bonus')).toBeLessThan(1);
    expect(seconds('low')).toBeGreaterThan(1);
  });
});

describe('potager', () => {
  /** Devant la première rangée du potager de la gare d'essai, tourné vers lui. */
  function atField(sim: Sim, column = 0): void {
    put(sim, 0, 21.5 + column, 33.5, SOUTH);
    run(sim, 0.05);
  }

  it('bêcher (2 coups), semer, arroser, puis croissance complète: mûr en 2 jours arrosés, meilleure qualité', () => {
    const sim = newSim(content);
    atField(sim);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'potager', verb: 'Bêcher', refusal: 'needs-spade' });
    hold(sim, 'beche');
    expect(aimOf(sim, 0)).toMatchObject({ verb: 'Bêcher', refusal: null });
    const hygiene = sim.world.players[0].needs.hygiene;
    expect(hits(stroke(sim))[0]).toMatchObject({ action: 'till', done: false });
    expect(stroke(sim)).toContainEqual(expect.objectContaining({ type: 'plot_changed', cell: 0 }));
    expect(sim.world.players[0].needs.hygiene).toBeLessThan(hygiene - 1.5);
    expect(fieldView(sim, 'potager')).toEqual([
      expect.objectContaining({ cell: 0, state: 'bare' }),
    ]);

    hold(sim, 'graines-radis', 3);
    expect(aimOf(sim, 0)).toMatchObject({ verb: 'Semer', refusal: null });
    stroke(sim);
    expect(count(sim, 'graines-radis')).toBe(2);
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({
      state: 'growing',
      stage: 0,
      thirsty: true,
    });

    hold(sim, 'arrosoir');
    expect(aimOf(sim, 0)?.verb).toBe('Arroser');
    stroke(sim);
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ thirsty: false, watered: true });
    expect(aimOf(sim, 0)?.refusal).toBe('already-watered');

    nextDay(sim);
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ stage: 1, thirsty: true });
    stroke(sim);
    nextDay(sim);
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ state: 'ripe', stage: 2 });
    expect(aimOf(sim, 0)).toMatchObject({ verb: 'Récolter', refusal: null });
    const events = stroke(sim);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'crop_reaped',
        item: 'radis-croquant',
        count: 2,
        quality: 2,
      }),
    );
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ state: 'bare' });
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
  });

  it('sans arrosage: rien ne meurt, 4 jours secs, qualité simple; la pluie arrose; hors saison, la plante attend', () => {
    const sim = newSim(content);
    atField(sim);
    hold(sim, 'beche');
    stroke(sim);
    stroke(sim);
    hold(sim, 'graines-radis');
    stroke(sim);
    nextDay(sim, 10); // dix jours d'absence: comptés secs
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ state: 'ripe' });
    put(sim, 0, 21.5, 33.5, SOUTH);
    expect(stroke(sim)).toContainEqual(
      expect.objectContaining({ type: 'crop_reaped', item: 'radis', count: 1, quality: 0 }),
    );

    // La météo vient du climat du lieu (lot du temps du monde): un printemps toujours pluvieux.
    const files = dataFiles() as Record<string, { seasons: Record<string, { weights: object }> }>;
    const climate = files['lieux/essai-gare/climat.json'];
    if (climate?.seasons.spring === undefined) throw new Error('climat absent');
    climate.seasons.spring.weights = { rain: 1 };
    const rainy = newSim(loadContent(files));
    atField(rainy);
    hold(rainy, 'beche');
    stroke(rainy);
    stroke(rainy);
    hold(rainy, 'graines-radis');
    stroke(rainy);
    expect(rainy.world.common.weather).toBe('rain');
    expect(fieldView(rainy, 'potager')?.[0]).toMatchObject({ watered: true });

    // Semé le 13e jour, l'été arrive le 15e: la pousse s'arrête, la plante reste.
    const late = newSim(content);
    late.world.common.day = 13;
    atField(late);
    hold(late, 'beche');
    stroke(late);
    stroke(late);
    hold(late, 'graines-radis');
    stroke(late);
    nextDay(late, 5);
    expect(fieldView(late, 'potager')?.[0]).toMatchObject({ state: 'growing', crop: 'radis' });
    hold(late, 'graines-radis');
    put(late, 0, 22.5, 33.5, SOUTH);
    expect(aimOf(late, 0)?.refusal).toBe('needs-tilling');
  });

  it('6 parcelles au départ, 12 après amélioration; la bêche forgée bêche 3 cases en ligne d’un coup', () => {
    const sim = newSim(content);
    hold(sim, 'beche-forgee');
    put(sim, 0, 21.5, 33.5, SOUTH);
    run(sim, 0.05);
    expect(stroke(sim).filter((e) => e.type === 'plot_changed')).toHaveLength(3);
    put(sim, 0, 22.5, 33.5, SOUTH);
    stroke(sim);
    expect(fieldView(sim, 'potager')).toHaveLength(6);
    put(sim, 0, 23.5, 33.5, SOUTH);
    run(sim, 0.05);
    expect(aimOf(sim, 0)?.refusal).toBe('no-more-plots');
    sim.world.progress.memory['logement.potager.agrandi'] = { v: true, by: 'duo', day: 1 };
    expect(aimOf(sim, 0)?.refusal).toBeNull();
    stroke(sim);
    expect(fieldView(sim, 'potager')).toHaveLength(9);
    expect(sim.world.players[0].toolbar[0]?.wear).toBe(147);
  });

  it('une parcelle pleine de 64 cases reste petite dans la tranche « lieu »', () => {
    const plot = {
      crop: 'graines-tomate',
      growth: 999,
      watered: true,
      days: 999,
      wet: 999,
      day: 999,
    };
    const field = { cells: Array.from({ length: 64 }, () => ({ ...plot })), work: null };
    expect(JSON.stringify({ field }).length).toBeLessThan(6000);
  });
});

describe('forge', () => {
  it('améliore la hache à côté d’une meule: prix payé, bûches prises, nouvel outil neuf', () => {
    const files = dataFiles() as Record<string, Record<string, unknown>>;
    files['commun/meubles/meule-essai.json'] = {
      schema: 1,
      id: 'meule-essai',
      name: 'Meule',
      model: 'meule',
      size: { w: 1, h: 1 },
      solid: true,
      placeable: false,
      series: null,
      bricks: [{ brick: 'repair', tools: ['axe', 'spade'], seconds: 1 }],
    };
    (files['lieux/essai-gare/carte.json']?.objects as unknown[]).push({
      id: 'meule',
      type: 'meule-essai',
      x: 18.5,
      y: 33.5,
      rotation: 0,
    });
    const sim = newSim(loadContent(files));
    hold(sim, 'hache');
    sim.world.players[0].toolbar[1] = { item: 'buche', count: 3 };
    put(sim, 0, 18.5, 32.4, SOUTH);
    sim.world.players[0].money = 5000;
    const money = sim.world.players[0].money;
    send(sim, 0, { type: 'tool_upgrade', target: 'meule', slot: 0 });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'hache-forgee', count: 1, wear: 120 });
    expect(sim.world.players[0].money).toBe(money - 3000);
    expect(count(sim, 'buche')).toBe(1);
    const events = send(sim, 0, { type: 'tool_upgrade', target: 'meule', slot: 0 });
    expect(events).toContainEqual(expect.objectContaining({ reason: 'cannot-upgrade' }));
    put(sim, 0, 18.5, 28, NORTH);
    expect(send(sim, 0, { type: 'tool_repair_paid', target: 'meule', slot: 0 })).toContainEqual(
      expect.objectContaining({ reason: 'too-far' }),
    );
  });
});

describe('gabarits culture et ressource', () => {
  it('une culture et une ressource factices, ajoutées en données seulement, se sèment, poussent et se récoltent', () => {
    const files = dataFiles() as Record<string, Record<string, unknown>>;
    const item = (id: string, family: string): void => {
      files[`commun/objets/${id}.json`] = {
        schema: 1,
        id,
        name: id,
        family,
        stack: 10,
        food: null,
        tool: null,
      };
    };
    item('graines-factices', 'seed');
    item('legume-factice', 'crop');
    item('caillou-factice', 'material');
    files['commun/cultures/factice.json'] = {
      schema: 1,
      id: 'factice',
      name: 'Factice',
      seed: 'graines-factices',
      seasons: [],
      stages: [1],
      regrowStage: 0,
      qualities: [{ wateredShare: 0, item: 'legume-factice', count: 1 }],
    };
    files['commun/ressources/filon-factice.json'] = {
      schema: 1,
      id: 'filon-factice',
      name: 'Filon',
      kind: 'pick',
      verb: 'Gratter',
      clip: 'pickup',
      seconds: 0.4,
      tool: null,
      minTier: 0,
      work: 2,
      dirty: false,
      effort: 0,
      after: 'gone',
      respawnDays: 1,
      toGround: false,
      rolls: 1,
      loot: [
        {
          item: 'caillou-factice',
          min: 2,
          max: 2,
          weight: 1,
          rare: false,
          hours: null,
          weathers: [],
          seasons: [],
        },
      ],
    };
    files['commun/meubles/filon.json'] = {
      schema: 1,
      id: 'filon',
      name: 'Filon',
      model: 'caillou',
      size: { w: 1, h: 1 },
      solid: false,
      placeable: false,
      series: null,
      bricks: [{ brick: 'harvest', resource: 'filon-factice' }],
    };
    (files['lieux/essai-gare/carte.json']?.objects as unknown[]).push({
      id: 'filon',
      type: 'filon',
      x: 18.5,
      y: 36.5,
      rotation: 0,
    });
    const sim = newSim(loadContent(files));
    put(sim, 0, 18.5, 35.4, SOUTH);
    run(sim, 0.05);
    expect(aimOf(sim, 0)?.verb).toBe('Gratter');
    stroke(sim);
    stroke(sim);
    expect(count(sim, 'caillou-factice')).toBe(2);

    put(sim, 0, 21.5, 33.5, SOUTH);
    hold(sim, 'beche');
    stroke(sim);
    stroke(sim);
    hold(sim, 'graines-factices');
    stroke(sim);
    nextDay(sim);
    stroke(sim);
    expect(count(sim, 'legume-factice')).toBe(1);
    // Récolte qui repousse: la plante reste, revenue au semis.
    expect(fieldView(sim, 'potager')?.[0]).toMatchObject({ crop: 'factice', state: 'growing' });
  });

  it('une faute nomme son fichier: graine inconnue, ressource inconnue', () => {
    const files = dataFiles() as Record<string, Record<string, unknown>>;
    files['commun/cultures/fautive.json'] = {
      schema: 1,
      id: 'fautive',
      name: 'Fautive',
      seed: 'graine-absente',
      seasons: [],
      stages: [1],
      regrowStage: null,
      qualities: [{ wateredShare: 0, item: 'pomme', count: 1 }],
    };
    expect(() => loadContent(files)).toThrow(/commun\/cultures\/fautive\.json: objet inconnu/);
  });
});
