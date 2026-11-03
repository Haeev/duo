/**
 * Réglages du marché du dimanche (`donnees/marche.json`, 0.12, section 2.3 de
 * `v0-12-conception.md`), lus et contrôlés au chargement du contenu.
 */
import type { Reader } from './lecteur';

export type MarketLevel = 'soft' | 'fair' | 'strong';
export const MARKET_LEVELS: readonly MarketLevel[] = ['soft', 'fair', 'strong'];

export interface MarketBuyerDef {
  villager: string;
  /** Articles cherchés (la liste du dimanche est tirée parmi ceux que le duo a déjà eus). */
  wants: string[];
  /** Ce qu'il prend à la place d'un article de sa liste qui manque à l'étal. */
  likes: string;
}

export interface MarketSettings {
  enabledFlag: string;
  /** Jour de la semaine (0: samedi, comme `weekdayOf`). */
  weekday: number;
  opens: number;
  closes: number;
  arrivals: { from: number; to: number; minGapMinutes: number };
  slots: number;
  slotsWithCrates: number;
  cratesFlag: string;
  /** Les cagettes de la quête `market_crates`: posées sur l'étal, elles en deviennent les cases. */
  crateItem: string;
  levels: Record<MarketLevel, { factor: number; accept: number; bond: number }>;
  defaultLevel: MarketLevel;
  list: { minLines: number; maxLines: number; minCount: number; maxCount: number };
  waitMinutes: number;
  returnAfterMinutes: number;
  /** Portée (m) d'un joueur « derrière l'étal », qui peut servir. */
  serveRange: number;
  /** Portée (m) pour garnir l'étal. */
  stallRange: number;
  rainStayHome: number;
  hallImprovement: string;
  garlandFlag: string;
  scaleItem: string;
  scaleCategories: string[];
  /** Où se pose l'étal: le point de la carte, sinon un point de repli décalé (en attendant le level designer). */
  stall: {
    point: string;
    fallbackPoint: string;
    fallbackOffset: readonly [number, number];
    length: number;
    facing: number;
  };
  buyers: MarketBuyerDef[];
}

const WEEKDAYS = [
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
] as const;

export function parseMarket(r: Reader): MarketSettings {
  const arrivals = r.at('arrivals');
  const levels = r.at('levels');
  const level = (k: MarketLevel): MarketSettings['levels'][MarketLevel] => {
    const l = levels.at(k);
    return {
      factor: l.at('factor').number(),
      accept: l.at('accept').number(),
      bond: l.at('bond').integer(0),
    };
  };
  const list = r.at('list');
  const stall = r.at('stall');
  const offset = stall.at('fallbackOffset').numberList();
  if (offset.length !== 2) stall.at('fallbackOffset').fail('deux nombres attendus');
  return {
    enabledFlag: r.at('enabledFlag').string(),
    weekday: WEEKDAYS.indexOf(r.at('weekday').oneOf(WEEKDAYS)),
    opens: r.at('opens').time(),
    closes: r.at('closes').time(),
    arrivals: {
      from: arrivals.at('from').time(),
      to: arrivals.at('to').time(),
      minGapMinutes: arrivals.at('minGapMinutes').integer(0),
    },
    slots: r.at('slots').integer(1),
    slotsWithCrates: r.at('slotsWithCrates').integer(1),
    cratesFlag: r.at('cratesFlag').string(),
    crateItem: r.at('crateItem').string(),
    levels: { soft: level('soft'), fair: level('fair'), strong: level('strong') },
    defaultLevel: r.at('defaultLevel').oneOf(MARKET_LEVELS),
    list: {
      minLines: list.at('minLines').integer(1),
      maxLines: list.at('maxLines').integer(1),
      minCount: list.at('minCount').integer(1),
      maxCount: list.at('maxCount').integer(1),
    },
    waitMinutes: r.at('waitMinutes').number(),
    returnAfterMinutes: r.at('returnAfterMinutes').number(),
    serveRange: r.at('serveRange').number(),
    stallRange: r.at('stallRange').number(),
    rainStayHome: r.at('rainStayHome').number(),
    hallImprovement: r.at('hallImprovement').string(),
    garlandFlag: r.at('garlandFlag').string(),
    scaleItem: r.at('scaleItem').string(),
    scaleCategories: r.at('scaleCategories').stringList(),
    stall: {
      point: stall.at('point').string(),
      fallbackPoint: stall.at('fallbackPoint').string(),
      fallbackOffset: [offset[0] ?? 0, offset[1] ?? 0],
      length: stall.at('length').number(),
      facing: stall.at('facing').number(),
    },
    buyers: r
      .at('buyers')
      .items()
      .map((b) => ({
        villager: b.at('villager').string(),
        wants: b.at('wants').stringList(),
        likes: b.at('likes').string(),
      })),
  };
}
