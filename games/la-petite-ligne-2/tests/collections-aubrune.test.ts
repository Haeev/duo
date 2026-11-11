// Collections d'Aubrune (cahier 4.8, `docs/jeux/jeu-1/refonte/collections-aubrune.md`): les comptes
// par collection, et chaque entrée atteignable par une brique existante (lieu réel, condition
// satisfiable avec le climat d'Aubrune, source branchée sur une quête, un commerce, la carte).
import { describe, expect, it } from 'vitest';
import type { Content, PlaceContent } from '../src/donnees/charger';
import type { CollectionEntryDef } from '../src/donnees/schemas/collections';
import { gameContent } from './aides';

const content: Content = gameContent();
const PLACE = 'aubrune';

function aubrune(): PlaceContent {
  const place = content.places[PLACE];
  if (place === undefined) throw new Error('Aubrune absente des données');
  return place;
}

const COUNTS: Readonly<Record<string, number>> = {
  poissons: 16,
  insectes: 16,
  tresors: 12,
  fleurs: 12,
  'cartes-postales': 12,
  musiques: 8,
  recettes: 18,
};

function entries(category: string): CollectionEntryDef[] {
  return Object.values(content.book.entries).filter(
    (e) => e.place === PLACE && e.category === category,
  );
}

/** Saisons et météos possibles à Aubrune (poids positif au climat du lieu). */
function possible(weathers: readonly string[], seasons: readonly string[]): boolean {
  const climate = content.time.climates[PLACE];
  if (climate === undefined) return false;
  return Object.entries(climate.seasons).some(
    ([season, def]) =>
      (seasons.length === 0 || seasons.includes(season)) &&
      Object.entries(def.weights).some(
        ([weather, weight]) => weight > 0 && (weathers.length === 0 || weathers.includes(weather)),
      ),
  );
}

/** Tous les effets des quêtes d'Aubrune, au début et à la fin de chaque étape. */
function questEffects(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const quest of Object.values(aubrune().quests))
    for (const chapter of quest.chapters)
      for (const step of chapter.steps)
        for (const effect of [...step.onStart, ...step.onDone]) out.push(effect);
  return out;
}

const sold = new Set(
  Object.values(aubrune().shops).flatMap((s) => s.sells.map((l) => ('item' in l ? l.item : ''))),
);
const onMap = new Set(aubrune().map.objects.map((o) => o.type));
const looted = new Set(
  Object.values(content.resources)
    .filter((r) => onMap.has(r.id))
    .flatMap((r) => r.loot.filter((l) => possible(l.weathers, l.seasons)).map((l) => l.item)),
);
const fished = new Set(
  (aubrune().def.fishing ?? []).flatMap((spot) => spot.table.map((row) => row.catch)),
);
const given = new Set(
  questEffects()
    .filter((e) => e.type === 'give_item')
    .map((e) => String(e.item)),
);
const laid = new Set(
  Object.values(content.species).flatMap((s) => s.product.qualities.map((q) => q.item)),
);
const crops = Object.values(content.crops);
const grown = new Set(crops.flatMap((c) => c.qualities.map((q) => q.item)));

/** Un objet qu'on peut avoir à Aubrune: acheté, récolté sur la carte, pêché, pondu, cultivé, donné. */
function obtainable(item: string, depth = 0): boolean {
  if (sold.has(item) || looted.has(item) || fished.has(item) || laid.has(item)) return true;
  if (given.has(item)) return true;
  if (depth > 1) return false;
  return crops.some(
    (c) =>
      c.qualities.some((q) => q.item === item) && possible([], c.seasons) && obtainable(c.seed, 1),
  );
}

describe('collections d’Aubrune', () => {
  it('compte 16 poissons, 16 insectes, 12 trésors, 12 fleurs, 12 cartes, 8 musiques, 18 recettes', () => {
    for (const [category, count] of Object.entries(COUNTS))
      expect(entries(category).length, category).toBe(count);
  });

  it('chaque poisson se pêche à un coin d’Aubrune, à une heure, une météo et une saison possibles', () => {
    for (const entry of entries('poissons')) {
      const fish = content.catches[entry.id];
      expect(fish?.fish, entry.id).toBeDefined();
      expect(fish?.places, entry.id).toContain(PLACE);
      expect(fished.has(entry.id), entry.id).toBe(true);
      expect(possible(fish?.weathers ?? [], fish?.seasons ?? []), entry.id).toBe(true);
      expect(fish?.hours.from, entry.id).not.toBe(fish?.hours.to);
    }
  });

  it('chaque insecte a une zone de son terrain, posée sur des cases libres de la carte', () => {
    const zones = content.book.nature[PLACE]?.zones ?? [];
    const { width, height, blocked } = aubrune().map;
    for (const zone of zones) {
      const { x, y, w, h } = zone.area;
      expect(x >= 0 && y >= 0 && x + w <= width && y + h <= height, zone.id).toBe(true);
      const overlaps = blocked.some(
        (b) => b.x < x + w && x < b.x + b.w && b.y < y + h && y < b.y + b.h,
      );
      expect(overlaps, zone.id).toBe(false);
    }
    expect(zones.reduce((n, z) => n + z.max, 0)).toBeLessThanOrEqual(40);
    const terrains = new Set(zones.map((z) => z.terrain));
    for (const entry of entries('insectes')) {
      const insect = Object.values(content.book.insects).find((i) => i.entry === entry.id);
      expect(insect?.places, entry.id).toContain(PLACE);
      expect(
        insect?.terrains.some((t) => terrains.has(t)),
        entry.id,
      ).toBe(true);
      expect(possible(insect?.rarity.weathers ?? [], insect?.rarity.seasons ?? []), entry.id).toBe(
        true,
      );
    }
    for (const zone of zones)
      expect(
        Object.values(content.book.insects).some(
          (i) => i.places.includes(PLACE) && i.terrains.includes(zone.terrain),
        ),
        zone.id,
      ).toBe(true);
  });

  it('chaque trésor sort d’une fouille de la carte ou d’une étape d’histoire', () => {
    const story = new Set(
      questEffects()
        .filter((e) => e.type === 'give_entry')
        .map((e) => String(e.entry)),
    );
    for (const entry of entries('tresors')) {
      if (entry.source.type === 'item') expect(looted.has(entry.source.item), entry.id).toBe(true);
      else expect(story.has(entry.id), entry.id).toBe(true);
    }
  });

  it('chaque fleur pousse d’une graine achetée ou reçue à Aubrune, et ne se revend pas', () => {
    const bought = new Set(
      Object.values(aubrune().shops).flatMap((s) => s.buys.map((l) => ('item' in l ? l.item : ''))),
    );
    for (const entry of entries('fleurs')) {
      expect(entry.source.type, entry.id).toBe('item');
      if (entry.source.type !== 'item') continue;
      expect(grown.has(entry.source.item), entry.id).toBe(true);
      expect(obtainable(entry.source.item), entry.id).toBe(true);
      expect(bought.has(entry.source.item), entry.id).toBe(false);
    }
  });

  it('chaque recette s’apprend (début, essai, livre en rayon, habitant) et ses ingrédients s’obtiennent', () => {
    const taught = new Set(
      questEffects()
        .filter((e) => e.type === 'give_recipe')
        .map((e) => String(e.recipe)),
    );
    for (const entry of entries('recettes')) {
      if (entry.source.type !== 'recipe')
        throw new Error(`${entry.id}: source attendue « recipe »`);
      const recipe = content.recipes[entry.source.recipe];
      expect(recipe, entry.id).toBeDefined();
      if (recipe === undefined) continue;
      const book = recipe.learn?.book;
      const learnable =
        recipe.known === 'start' ||
        recipe.learn?.trial === true ||
        (book !== undefined && sold.has(book)) ||
        taught.has(recipe.id);
      expect(learnable, entry.id).toBe(true);
      for (const input of recipe.inputs)
        expect(obtainable(input.item), `${entry.id}: ${input.item}`).toBe(true);
    }
  });

  it('chaque carte postale vise un point réel d’Aubrune, à une condition qui peut être vraie', () => {
    const facts = new Set([
      ...questEffects()
        .filter((e) => e.type === 'remember')
        .map((e) => String(e.key)),
      ...(content.time.events[PLACE] ?? []).flatMap((e) => e.activates.facts.map((f) => f.key)),
    ]);
    expect(JSON.stringify(aubrune().dialogues)).toContain('"appareil-photo"');
    for (const entry of entries('cartes-postales')) {
      const photo = Object.values(content.book.photos).find((p) => p.entry === entry.id);
      expect(photo, entry.id).toBeDefined();
      const target = photo?.target;
      expect(target?.type === 'point' && target.place === PLACE, entry.id).toBe(true);
      if (target?.type === 'point')
        expect(aubrune().map.points[target.point], entry.id).toBeDefined();
      for (const c of photo?.conditions ?? []) {
        if (c.type === 'weather_is') expect(possible(c.weathers, []), entry.id).toBe(true);
        else if (c.type === 'season_is') expect(possible([], c.seasons), entry.id).toBe(true);
        else if (c.type === 'remembered') expect(facts.has(c.key), entry.id).toBe(true);
        else expect(c.type, entry.id).toBe('time_is');
      }
    }
  });

  it('chaque musique s’inscrit par une étape d’histoire ou un événement d’Aubrune', () => {
    const story = new Set(
      questEffects()
        .filter((e) => e.type === 'give_entry')
        .map((e) => String(e.entry)),
    );
    const tunes = new Set((content.time.events[PLACE] ?? []).map((e) => e.activates.tune));
    for (const entry of entries('musiques'))
      expect(story.has(entry.id) || tunes.has(entry.id), entry.id).toBe(true);
  });
});
