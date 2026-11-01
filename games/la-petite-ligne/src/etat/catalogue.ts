/**
 * Le catalogue de la semaine (tour 9, section 2.3): ce qui est en vente ce jour-là. Pur, lu par la
 * simulation (achat), l'interface (rayons) et le robot.
 *
 * Règle des pages: chaque samedi à l'heure de la livraison, la page de la semaine de saison
 * (1, 2 ou 3) paraît; ses articles restent tant qu'il en reste à acheter. Un article de saison
 * s'en va à la fin de sa saison et revient à la même page l'année d'après (s'il en reste).
 * L'ancrage se fait par saison et semaine de saison: une partie reprise voit toutes les pages déjà
 * parues. Un cadeau (« Pour offrir ») ne paraît qu'une fois le souhait de l'habitant entendu.
 */
import { SEASONS, seasonIndexOf } from '../donnees/calendrier';
import type { CatalogueDef, Content, Season, Settings } from '../donnees/types';

export type ShelfKind = 'tools' | 'hens' | 'house' | 'gifts';

export interface CatalogueOffer {
  item: string;
  shelf: ShelfKind;
  price: number;
  /** Exemplaires encore à acheter (commandes en attente d'accord comprises). */
  left: number;
  /** Le cadeau de cet habitant (rayon « Pour offrir »), sinon `null`. */
  villager: string | null;
}

/** Ce que le catalogue lit de la partie. */
export interface CatalogueWorld {
  readonly clock: { readonly day: number; readonly minutes: number };
  readonly catalogueBought: Readonly<Record<string, number>>;
  readonly dialoguesDone: readonly string[];
  readonly hens: readonly { readonly arrivedDay?: number }[];
  readonly proposals: readonly { readonly purchase: { readonly source: string; readonly item: string } }[];
}

type Rules = Pick<Settings, 'calendar' | 'economy' | 'hens'>;

/** Premier jour de la saison `season` de l'année `year` (0 pour la première). */
function seasonStart(settings: Pick<Settings, 'calendar'>, season: Season, year: number): number {
  const c = settings.calendar;
  return 1 + (year * c.seasonsPerYear + SEASONS.indexOf(season)) * c.seasonDays;
}

/** Jour (et heure) où la page (saison, semaine) paraît l'année `year`: le samedi de cette semaine. */
export function pageDay(settings: Pick<Settings, 'calendar'>, season: Season, week: number, year: number): number {
  return seasonStart(settings, season, year) + 7 * (week - 1);
}

function reached(settings: Rules, clock: CatalogueWorld['clock'], day: number): boolean {
  const time = settings.economy.catalogue.repeatWeekly?.deliveryTime ?? 0;
  return clock.day > day || (clock.day === day && clock.minutes >= time);
}

/** La page (saison, semaine) est-elle déjà parue (une année ou une autre) ? */
export function pagePublished(settings: Rules, clock: CatalogueWorld['clock'], season: Season, week: number): boolean {
  return reached(settings, clock, pageDay(settings, season, week, 0));
}

/** Pour un article de saison: sa page est parue cette saison-ci (et la saison n'est pas finie). */
function seasonalOnShelf(settings: Rules, clock: CatalogueWorld['clock'], season: Season, week: number): boolean {
  const c = settings.calendar;
  const index = seasonIndexOf(settings, clock.day);
  if (SEASONS[index % SEASONS.length] !== season) return false;
  const year = Math.floor((Math.max(1, clock.day) - 1) / (c.seasonDays * c.seasonsPerYear));
  return reached(settings, clock, pageDay(settings, season, week, year));
}

function shelfOf(content: Pick<Content, 'items'>, cat: CatalogueDef, item: string): ShelfKind {
  if (cat.gifts.some((g) => g.item === item)) return 'gifts';
  const def = content.items[item];
  if (def?.category === 'tool') return 'tools';
  if (def?.category === 'animal_order') return 'hens';
  return 'house';
}

/** Exemplaires en vente en tout (`copies`, 1 par défaut). */
export function copiesOf(cat: CatalogueDef, item: string): number {
  return cat.copies[item] ?? 1;
}

/** Exemplaires encore à acheter: en vente moins achetés moins en attente d'accord. */
export function copiesLeft(cat: CatalogueDef, world: Pick<CatalogueWorld, 'catalogueBought' | 'proposals'>, item: string): number {
  const pending = world.proposals.filter((p) => p.purchase.source === 'catalogue' && p.purchase.item === item).length;
  return Math.max(0, copiesOf(cat, item) - (world.catalogueBought[item] ?? 0) - pending);
}

/** Le souhait de cet habitant a-t-il été entendu par l'un des deux ? */
export function wishHeard(world: Pick<CatalogueWorld, 'dialoguesDone'>, wish: string): boolean {
  return world.dialoguesDone.includes(wish);
}

/** Les articles du catalogue de la semaine en vente maintenant, dans l'ordre des pages puis des cadeaux. */
export function catalogueOffers(settings: Rules, content: Pick<Content, 'items' | 'catalogue'>, world: CatalogueWorld): CatalogueOffer[] {
  const cat = content.catalogue;
  if (cat === null) return [];
  const out: CatalogueOffer[] = [];
  const push = (item: string, villager: string | null): void => {
    const def = content.items[item];
    if (def?.buyPrice === null || def === undefined) return;
    const left = copiesLeft(cat, world, item);
    if (left <= 0) return;
    // Plafond du poulailler (`hens.max`): plus de poule à commander une fois plein.
    if (def.category === 'animal_order') {
      const proposed = world.proposals.filter((p) => content.items[p.purchase.item]?.category === 'animal_order').length;
      const bought = Object.entries(world.catalogueBought).filter(([id]) => content.items[id]?.category === 'animal_order').reduce((n, [, k]) => n + k, 0);
      const delivered = world.hens.filter((h) => h.arrivedDay !== undefined).length;
      if (world.hens.length + Math.max(0, bought - delivered) + proposed >= settings.hens.max) return;
    }
    out.push({ item, shelf: shelfOf(content, cat, item), price: def.buyPrice, left, villager });
  };
  for (const page of cat.pages) {
    for (const item of page.items) {
      const season = cat.seasonal[item];
      const visible = season === undefined ? pagePublished(settings, world.clock, page.season, page.week) : seasonalOnShelf(settings, world.clock, season, page.week);
      if (visible) push(item, null);
    }
  }
  for (const g of cat.gifts) if (wishHeard(world, g.wish)) push(g.item, g.villager);
  return out;
}

/** Cet article du catalogue de la semaine est-il en vente maintenant ? (`true` pour un article d'avant le tour 9.) */
export function onWeeklyCatalogue(settings: Rules, content: Pick<Content, 'items' | 'catalogue'>, world: CatalogueWorld, item: string): boolean {
  const cat = content.catalogue;
  if (cat === null) return true;
  const listed = cat.pages.some((p) => p.items.includes(item)) || cat.gifts.some((g) => g.item === item);
  if (!listed) return true;
  return catalogueOffers(settings, content, world).some((o) => o.item === item);
}
