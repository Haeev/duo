/**
 * Prix du comptoir d'Odette (0.12, section 2.2 de `v0-12-conception.md`), lus par la simulation
 * et par le panneau de vente (même calcul des deux côtés). Fonctions pures.
 *
 * Prix d'une unité = arrondi de `sellPrice x qualité x buyRate x saison x offre (x ardoise)`, au
 * moins 1 aubrin; l'offre baisse à chaque unité vendue, le prix se recalcule donc unité par unité.
 * Avant `pricesFromDay`, le prix reste celui de la démo: `sellPrice x qualité x buyRate`, arrondi
 * sur le lot entier.
 */
import { seasonIndexOf } from '../donnees/calendrier';
import type { Content } from '../donnees/types';
import type { Quality, ReadonlyWorld } from './types';

type GrocerWorld = Pick<ReadonlyWorld, 'clock' | 'grocerSupply' | 'ardoise' | 'grocerSoldToday'>;

export function dynamicPrices(content: Content, day: number): boolean {
  return day >= content.settings.economy.grocer.pricesFromDay;
}

/** Unités au bout desquelles l'article a perdu `slope` de son prix. */
export function saturationOf(content: Content, item: string): number {
  const s = content.settings.economy.grocer.supply;
  const category = content.items[item]?.category ?? '';
  return s.saturation[item] ?? s.categorySaturation[category] ?? s.defaultSaturation;
}

/** Facteur d'offre après `sold` unités vendues: `max(floor, 1 - slope x sold / saturation)`. */
export function supplyFactor(content: Content, item: string, sold: number): number {
  const s = content.settings.economy.grocer.supply;
  return Math.max(s.floor, 1 - (s.slope * sold) / saturationOf(content, item));
}

export function seasonFactor(content: Content, item: string, day: number): number {
  const row = content.settings.economy.grocer.seasonFactor[item];
  return row?.[seasonIndexOf(content.settings, day)] ?? 1;
}

/** L'article de l'ardoise du jour, ou `null`. */
export function ardoiseItem(world: Pick<ReadonlyWorld, 'clock' | 'ardoise'>): string | null {
  const a = world.ardoise;
  return a !== null && a.day === world.clock.day ? a.item : null;
}

function basePrice(content: Content, item: string, quality: Quality): number | null {
  const def = content.items[item];
  if (def?.sellPrice === null || def === undefined) return null;
  return (
    def.sellPrice *
    content.qualities[quality].priceMultiplier *
    content.settings.economy.grocer.buyRate
  );
}

/** Prix des `count` prochaines unités, une par une (`[]` si Odette n'achète pas cet article). */
export function grocerUnitPrices(
  content: Content,
  world: GrocerWorld,
  item: string,
  quality: Quality,
  count: number,
): number[] {
  const base = basePrice(content, item, quality);
  if (base === null || count < 1) return [];
  const day = world.clock.day;
  if (!dynamicPrices(content, day)) {
    // Démo: le lot entier est arrondi une fois (règle du tour 9); une unité de plus ajoute la différence.
    return Array.from(
      { length: count },
      (_, i) => Math.round(base * (i + 1)) - Math.round(base * i),
    );
  }
  const g = content.settings.economy.grocer;
  const season = seasonFactor(content, item, day);
  const sold = world.grocerSupply[item] ?? 0;
  const onArdoise = ardoiseItem(world) === item;
  const ardoiseLeft = onArdoise ? Math.max(0, g.ardoise.max - (world.ardoise?.sold ?? 0)) : 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const boost = i < ardoiseLeft ? g.ardoise.factor : 1;
    out.push(
      Math.max(1, Math.round(base * season * supplyFactor(content, item, sold + i) * boost)),
    );
  }
  return out;
}

/** Ce que paie Odette pour `count` unités (plafond du jour non compris). */
export function grocerTotal(
  content: Content,
  world: GrocerWorld,
  item: string,
  quality: Quality,
  count: number,
): number {
  return grocerUnitPrices(content, world, item, quality, count).reduce((a, b) => a + b, 0);
}

/** Combien d'unités, au plus `count`, tiennent dans ce qui reste du plafond du jour, et pour quelle somme. */
export function grocerAffordable(
  content: Content,
  world: GrocerWorld,
  item: string,
  quality: Quality,
  count: number,
): { count: number; price: number } {
  const room = content.settings.economy.grocer.dailyCap - world.grocerSoldToday;
  let n = 0;
  let price = 0;
  for (const p of grocerUnitPrices(content, world, item, quality, count)) {
    if (price + p > room) break;
    n++;
    price += p;
  }
  return { count: n, price };
}

export type GrocerWord = 'ardoise' | 'plenty' | 'wanted' | null;

/** Le mot du panneau de vente (section 2.2): ardoise, « Odette en a déjà beaucoup », « Recherché », ou rien. */
export function grocerWord(content: Content, world: GrocerWorld, item: string): GrocerWord {
  const day = world.clock.day;
  if (!dynamicPrices(content, day)) return null;
  if (ardoiseItem(world) === item) return 'ardoise';
  const w = content.settings.economy.grocer.words;
  const supply = supplyFactor(content, item, world.grocerSupply[item] ?? 0);
  if (supply <= w.plentyAtMost) return 'plenty';
  if (supply * seasonFactor(content, item, day) >= w.wantedFrom) return 'wanted';
  return null;
}
