/**
 * Comptoir d'Odette, côté simulation (0.12, section 2.2): l'offre qui s'oublie à l'aube, l'ardoise
 * du jour tirée à 7 h, et la liste des articles que le duo a déjà eus. Les prix: `etat/epicerie.ts`.
 */
import { dynamicPrices, seasonFactor } from '../etat/epicerie';
import { unitDraw } from '../etat/tirage';
import type { ItemStack } from '../etat/types';
import { type Sim, emit } from './contexte';

/** Une vente à Odette: l'offre de l'article et l'ardoise comptent ces unités. */
export function recordGrocerSale(sim: Sim, item: string, count: number): void {
  const { world } = sim;
  if (!dynamicPrices(sim.content, world.clock.day)) return;
  world.grocerSupply[item] = (world.grocerSupply[item] ?? 0) + count;
  const a = world.ardoise;
  if (a !== null && a.day === world.clock.day && a.item === item) a.sold += count;
  noteGoodsSeen(sim, [{ item, quality: 'ordinary', count }]);
}

/** Ajoute aux articles déjà eus ce qui se vend (Odette ou marché) parmi ces piles. */
export function noteGoodsSeen(sim: Sim, stacks: Iterable<ItemStack | null>): void {
  const seen = sim.world.goodsSeen;
  for (const s of stacks) {
    if (s === null || seen.includes(s.item)) continue;
    const def = sim.content.items[s.item];
    if (def === undefined || def.sellPrice === null) continue;
    seen.push(s.item);
  }
}

function scanGoods(sim: Sim): void {
  const { world } = sim;
  noteGoodsSeen(sim, world.cellar);
  noteGoodsSeen(sim, world.crate);
  for (const c of world.characters) noteGoodsSeen(sim, c.bag);
  world.goodsSeen.sort();
}

/** À l'aube: Odette a écoulé la moitié de ce qu'on lui a vendu; ce que le duo a en main compte comme déjà eu. */
export function grocerDawn(sim: Sim): void {
  const { world } = sim;
  if (!dynamicPrices(sim.content, world.clock.day)) return;
  const decay = sim.content.settings.economy.grocer.supply.dawnDecay;
  const kept: Record<string, number> = {};
  for (const [item, n] of Object.entries(world.grocerSupply)) {
    const left = Math.floor(n * decay);
    if (left > 0) kept[item] = left;
  }
  world.grocerSupply = kept;
  scanGoods(sim);
}

/**
 * L'ardoise du jour, à partir de 7 h (si Odette achète): un article de saison déjà eu, tiré par la
 * graine, jamais celui de la veille. Aussi à la reprise d'une partie après 7 h.
 */
export function postArdoise(sim: Sim): void {
  const { world, content } = sim;
  const g = content.settings.economy.grocer;
  const day = world.clock.day;
  if (!dynamicPrices(content, day) || world.clock.minutes < g.ardoise.time) return;
  if (world.ardoise?.day === day || !world.flags.includes(g.buysAfterFlag)) return;
  scanGoods(sim);
  const yesterday =
    world.ardoise !== null && world.ardoise.day === day - 1 ? world.ardoise.item : null;
  const goods = world.goodsSeen.filter(
    (item) => item !== yesterday && typeof content.items[item]?.sellPrice === 'number',
  );
  const inSeason = goods.filter((item) => seasonFactor(content, item, day) <= 1);
  const pool = inSeason.length > 0 ? inSeason : goods;
  const item =
    pool[Math.min(pool.length - 1, Math.floor(unitDraw(world.seed, 'ardoise', day) * pool.length))];
  if (item === undefined) return;
  world.ardoise = { day, item, sold: 0 };
  sim.runtime.changed = true;
  emit(sim, { type: 'ardoise_posted', item });
}
