// Collections: carnet par joueur et commun, insectes au filet, photo, gabarits factices, taille.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadContent, type Content } from '../src/donnees/charger';
import type { Find } from '../src/donnees/schemas/collections';
import { byteLength } from '../src/reseau/tranches';
import { collectionSystem } from '../src/simulation/collections/index';
import { collectionBook, recordFind, revealHint } from '../src/simulation/collections/registre';
import { stepInsects } from '../src/simulation/collections/insectes';
import { morningWeather } from '../src/simulation/monde/meteo';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { giveItem } from '../src/simulation/sac/actions';
import { fromTemplate } from '../outils/nouveau';
import { contextOf, act, newSim } from './aides-l3';
import { dataFiles, gameContent } from './aides';
import { run, put } from './aides-noyau';
import type { Sim } from '../src/simulation/noyau/pas';

const content = gameContent();
const PLACE = 'essai-gare';

function inHand(sim: Sim, player: 0 | 1, item: string): void {
  sim.world.players[player].toolbar[0] = { item, count: 1 };
  sim.world.players[player].selected = 0;
}

/** Un jour de printemps au beau temps (ou couvert) pour cette graine, à 10 h. */
function niceSpringMorning(sim: Sim): void {
  run(sim, 1 / 30);
  let day = 1;
  while (!['clear', 'overcast'].includes(morningWeather(sim.content, sim.world.seed, PLACE, day)))
    day++;
  expect(calendarOf(sim.content, day).season).toBe('spring');
  sim.world.common.day = day;
  sim.world.minutes = 600;
  run(sim, 1 / 30);
}

function placeOf(sim: Sim): NonNullable<Sim['world']['places'][string]> {
  const place = sim.world.places[PLACE];
  if (place === undefined) throw new Error('lieu absent');
  return place;
}

/** Fait apparaître des insectes tout de suite (essais d'apparition répétés). */
function spawn(sim: Sim, rounds: number): void {
  const ctx = contextOf(sim);
  for (let i = 0; i < rounds; i++) {
    const place = placeOf(sim);
    if (place.insects !== undefined) place.insects.at = 0;
    stepInsects(ctx, place);
  }
}

describe('collections', () => {
  it('inscrit la première prise de chaque objet, par joueur et pour le duo, avec ses conditions', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    const ctx = { ...contextOf(sim), events: sim.events };
    sim.events.length = 0;
    giveItem(ctx, 0, 'fossile-d-essai', 1);
    collectionSystem.step?.(ctx);
    expect(sim.events.find((e) => e.type === 'collection_found')).toMatchObject({
      player: 0,
      entry: 'fossile-d-essai',
      category: 'tresors',
      first: true,
      mine: true,
    });
    expect(recordFind(ctx, 1, 'fossile-d-essai')).toEqual({ first: false, mine: true });
    expect(recordFind(ctx, 0, 'fossile-d-essai')).toEqual({ first: false, mine: false });
    const find = sim.world.progress.album?.f['fossile-d-essai'];
    expect(find?.slice(0, 2)).toEqual([0, 1]);
    expect(find?.slice(5, 7)).toEqual([2, 1]);
    const tresors = collectionBook(sim.world, content).find((c) => c.id === 'tresors');
    expect(tresors).toMatchObject({ found: 1, total: 1 });
    expect(tresors?.entries[0]).toMatchObject({ by: [true, true], firstBy: 0 });
    expect(
      sim.events.some((e) => e.type === 'collection_completed' && e.category === 'tresors'),
    ).toBe(true);
    // Indice d'un habitant: les conditions se montrent avant la prise.
    const insects = (): unknown =>
      collectionBook(sim.world, content)
        .find((c) => c.id === 'insectes')
        ?.entries.find((e) => e.id === 'luciole-d-essai')?.rarity;
    expect(insects()).toBeNull();
    revealHint(ctx, 'luciole-d-essai');
    expect(insects()).not.toBeNull();
  });

  it('tient un record par entrée dans une catégorie qui en a un', () => {
    const files = dataFiles();
    files['commun/carnet/gardon-d-essai.json'] = {
      ...(files['commun/carnet/fossile-d-essai.json'] as object),
      id: 'gardon-d-essai',
      category: 'poissons',
      source: { type: 'manual' },
    };
    const sim = newSim(loadContent(files));
    const ctx = contextOf(sim);
    recordFind(ctx, 0, 'gardon-d-essai', 12);
    recordFind(ctx, 1, 'gardon-d-essai', 18);
    recordFind(ctx, 0, 'gardon-d-essai', 15);
    expect(sim.world.progress.album?.f['gardon-d-essai']?.slice(7)).toEqual([18, 1]);
    expect(sim.events.filter((e) => e.type === 'collection_record')).toHaveLength(2);
  });

  it('fait apparaître les insectes selon l’heure, la météo et la saison (CA-07)', () => {
    const sim = newSim(content);
    niceSpringMorning(sim);
    spawn(sim, 12);
    const list = placeOf(sim).insects?.list ?? [];
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((i) => i.s === 'papillon-citron')).toBe(true);
    // La nuit, le papillon s'en va et la luciole (été) ne vient pas au printemps.
    sim.world.minutes = 1300;
    spawn(sim, 12);
    expect(placeOf(sim).insects?.list).toEqual([]);
  });

  it('s’envole si on court près de lui, se laisse prendre au filet si on approche en marchant', () => {
    const sim = newSim(content);
    niceSpringMorning(sim);
    spawn(sim, 12);
    const first = placeOf(sim).insects?.list[0];
    if (first === undefined) throw new Error('aucun insecte');
    // Au pas, à côté de lui: il reste.
    put(sim, 0, first.x - 1, first.y, 0);
    put(sim, 1, 30, 30, 0);
    run(sim, 1 / 30);
    expect(placeOf(sim).insects?.list.some((i) => i.id === first.id)).toBe(true);
    // Filet en main, coup de filet devant soi: prise nouvelle fêtée.
    inHand(sim, 0, 'filet');
    const events = act(sim, 0, { type: 'net_swing' });
    expect(events.find((e) => e.type === 'net_swung')).toMatchObject({ insect: 'papillon-citron' });
    expect(events.find((e) => e.type === 'collection_found')).toMatchObject({
      entry: 'papillon-citron',
      first: true,
    });
    // Un autre, approché en courant: il s'envole.
    spawn(sim, 12);
    const other = placeOf(sim).insects?.list[0];
    if (other === undefined) throw new Error('aucun insecte');
    put(sim, 1, other.x - 2.5, other.y, 0);
    const fled = run(sim, 0.5, {}, { moveX: 1, run: true });
    expect(fled.some((e) => e.type === 'insect_fled' && e.id === other.id)).toBe(true);
  });

  it('photographie un sujet valable et en fait une carte postale', () => {
    const sim = newSim(content);
    run(sim, 1 / 30);
    sim.world.minutes = 420;
    const quai = content.places[PLACE]?.map.points.quai;
    if (quai === undefined) throw new Error('quai absent');
    put(sim, 0, quai.x, quai.y + 8, -Math.PI / 2);
    // Sans appareil, la touche d'action ne photographie pas.
    expect(act(sim, 0, { type: 'photo_take' }).some((e) => e.type === 'photo_taken')).toBe(false);
    inHand(sim, 0, 'appareil-photo');
    // Dos au sujet: photo sans sujet.
    put(sim, 0, quai.x, quai.y + 8, Math.PI / 2);
    expect(act(sim, 0, { type: 'photo_take' }).find((e) => e.type === 'photo_taken')).toMatchObject(
      { subject: null },
    );
    put(sim, 0, quai.x, quai.y + 8, -Math.PI / 2);
    const events = act(sim, 0, { type: 'photo_take' });
    expect(events.find((e) => e.type === 'photo_taken')).toMatchObject({ subject: 'vue-du-quai' });
    expect(events.find((e) => e.type === 'collection_found')).toMatchObject({
      entry: 'carte-du-quai',
      category: 'cartes-postales',
    });
    // Hors de ses conditions (l'après-midi), le sujet ne compte pas.
    sim.world.minutes = 900;
    expect(act(sim, 0, { type: 'photo_take' }).find((e) => e.type === 'photo_taken')).toMatchObject(
      { subject: null },
    );
  });

  it('gabarits: une entrée, un insecte, un sujet et un événement factices marchent sans autre changement', () => {
    const dir = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
    const read = (name: string, id: string): Record<string, unknown> =>
      fromTemplate(readFileSync(dir + name, 'utf8'), id);
    const files = dataFiles();
    const entry = read('entree-de-collection.jsonc', 'mouche-factice');
    entry.source = { type: 'insect' };
    entry.category = 'insectes';
    files['commun/carnet/mouche-factice.json'] = entry;
    const insect = read('insecte.jsonc', 'mouche-factice');
    insect.entry = 'mouche-factice';
    insect.weight = 100;
    files['commun/insectes/mouche-factice.json'] = insect;
    files['commun/photos/sujet-factice.json'] = read('sujet-photo.jsonc', 'sujet-factice');
    const event = read('evenement.jsonc', 'fete-factice');
    event.when = { type: 'date', season: 'spring', day: 2 };
    files['lieux/essai-gare/evenements/fete-factice.json'] = event;
    const loaded: Content = loadContent(files);
    expect(loaded.book.insects['mouche-factice']?.entry).toBe('mouche-factice');
    const sim = newSim(loaded);
    niceSpringMorning(sim);
    spawn(sim, 20);
    expect(placeOf(sim).insects?.list.some((i) => i.s === 'mouche-factice')).toBe(true);
    sim.world.common.day = 2;
    sim.world.minutes = 700;
    const events = run(sim, 2 / 30);
    expect(events.some((e) => e.type === 'calendar_started' && e.event === 'fete-factice')).toBe(
      true,
    );
  });

  // Cahier 4.8: environ 230 entrées hors tenues pour les trois lieux, plus les tenues: 320 au pire.
  it('garde un carnet compact: 320 entrées trouvées, valeurs au pire, tiennent en 20 Ko', () => {
    const find: Find = [1, 999, 1439, 5, 3, 9999, 9999, 123.5, 1];
    const f: Record<string, Find> = {};
    for (let i = 0; i < 320; i++) f[`entree-du-car-${String(i).padStart(4, '0')}`] = find;
    const album = { f, h: [] };
    expect(byteLength(album)).toBeLessThan(20 * 1024);
    const sim = newSim(content);
    sim.world.progress.album = album;
    expect(byteLength(sim.world.progress)).toBeLessThan(32 * 1024);
  });
});
