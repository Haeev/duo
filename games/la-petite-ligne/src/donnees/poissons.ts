/**
 * Données de la pêche de la 0.12 (conception, sections 3 et 9): fiche `fish` des objets poissons
 * et règles de `reglages.fishing` (raretés, ombres, coin qui frémit, guet, grands). Lecture typée
 * et contrôlée, valeurs par défaut de la conception quand une clé manque.
 */
import { FISH_RARITIES, type FishRarity, SHADOW_SIZES, type ShadowSize } from '../etat/peche';
import type { Weather } from '../etat/types';
import type { Reader } from './lecteur';
import type { Season } from './types';

const SEASONS: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
const WEATHERS: readonly Weather[] = ['sunny', 'cloudy', 'rain'];

/** Condition de présence d'un grand (section 4.3). */
export type GrandCondition = 'any' | 'dry' | 'wet' | 'mist' | 'misty_or_wet' | 'night_dry';
const GRAND_CONDITIONS: readonly GrandCondition[] = ['any', 'dry', 'wet', 'mist', 'misty_or_wet', 'night_dry'];

/** Favori: double le poids parmi ceux de sa rareté (pluie, brume du matin, ou une saison). */
export type FishFavorite = 'rain' | 'mist' | Season;

export interface FishDef {
  rarity: FishRarity;
  zones: string[];
  seasons: Season[];
  /** Plages d'heures, en minutes depuis minuit, fin exclue. */
  hours: [number, number][];
  weather: Weather[];
  /** Toute heure sous la pluie (la loche franche). */
  rainAnyHour: boolean;
  favorite: FishFavorite[];
  shadow: ShadowSize;
  lengthCm: [number, number];
  /** Remis à l'eau: au carnet, jamais au sac (espèce protégée, mythique). */
  released: boolean;
  description: string;
  hint: string;
  /** Grands seulement (légendaires et mythiques). */
  grand: { presence: number; condition: GrandCondition; prerequisite: string | null; rumorDialogue: string | null } | null;
}

export interface FishingRules {
  priceScale: number;
  rarity: {
    tierWeights: { common: number; rare: number; epic: number };
    hotSpot: TierBonus;
    rain: TierBonus;
    mist: TierBonus & { until: number };
    goldenHours: TierBonus & { ranges: [number, number][] };
    together: TierBonus & { maxBobberGap: number };
    maxShare: TierBonus;
    favoriteFactor: number;
    unseenFactor: { common: number; rare: number; epic: number };
    unseenEpicTier: number;
    streak: { length: number; factor: number };
    maxSameSpecies: number;
    pityAfterCommons: number;
  };
  shadows: {
    perZone: Record<string, number>;
    wakeRadius: number;
    sleepRadius: number;
    sleepAfterSeconds: number;
    lifeSeconds: [number, number];
    respawnSeconds: [number, number];
    fadeSeconds: number;
    minShoreDistance: number;
    minBobberDistance: number;
    attractRadius: number;
    attractRadiusSmallWater: number;
    approachSpeed: number;
    minBiteAfterArrival: number;
    noShadowSpawnDistance: number;
    noShadowWaitFactor: number;
    fleeSpeed: number;
    fleeSeconds: number;
    assistConeDegrees: number;
    assistOffset: number;
    sizes: Record<ShadowSize, number>;
    /** Rayon de nage laissé au rendu autour de l'ancre (m), selon la rareté. */
    roam: Record<FishRarity, number>;
  };
  /** Coin qui frémit (section 6): tirage, et signes que dessine le rendu (secondes, mètres). */
  hotSpot: {
    notSameAsYesterday: boolean;
    drawKey: string;
    ringEverySeconds: [number, number];
    ringElsewhereSeconds: [number, number];
    maxRings: number;
    bubbleEverySeconds: [number, number];
    birdEverySeconds: [number, number];
    signsRadius: number;
  };
  watch: { stillSeconds: number; waterRadius: number; glintRadius: number };
  grands: {
    fromDay: number;
    maxLegendaryPerDay: number;
    unseenPresenceFactor: number;
    presenceMax: number;
    attractRadius: number;
    biteWaitSeconds: [number, number];
    mythic: { presence: number; watchRange: number; biteWaitSeconds: [number, number]; netSeconds: number; netSecondsEasy: number; netRange: number };
  };
  /** Distance (m) sous laquelle l'autre compte comme présent à une première prise (« ensemble »). */
  togetherRadius: number;
}

export interface TierBonus {
  rare: number;
  epic: number;
}

/** Valeurs de la conception (section 9). */
export const DEFAULT_FISHING_RULES: FishingRules = {
  priceScale: 1,
  rarity: {
    tierWeights: { common: 72, rare: 24, epic: 4 },
    hotSpot: { rare: 1.6, epic: 2.5 },
    rain: { rare: 1.15, epic: 1 },
    mist: { rare: 1, epic: 1.3, until: 630 },
    goldenHours: { rare: 1.2, epic: 1.2, ranges: [[360, 540], [1020, 1260]] },
    together: { rare: 1.2, epic: 1.25, maxBobberGap: 10 },
    maxShare: { rare: 0.4, epic: 0.15 },
    favoriteFactor: 2,
    unseenFactor: { common: 4, rare: 4, epic: 8 },
    unseenEpicTier: 1.5,
    streak: { length: 3, factor: 1 / 3 },
    maxSameSpecies: 2,
    pityAfterCommons: 10,
  },
  shadows: {
    perZone: { ford: 3, sands: 3, pontoon: 4, confluence: 3, ru: 2, upstream: 3, downstream: 3 },
    wakeRadius: 12,
    sleepRadius: 16,
    sleepAfterSeconds: 30,
    lifeSeconds: [60, 120],
    respawnSeconds: [6, 10],
    fadeSeconds: 2,
    minShoreDistance: 0.4,
    minBobberDistance: 2,
    attractRadius: 1.5,
    attractRadiusSmallWater: 1,
    approachSpeed: 0.4,
    minBiteAfterArrival: 1.5,
    noShadowSpawnDistance: 3,
    noShadowWaitFactor: 1.5,
    fleeSpeed: 2,
    fleeSeconds: 1,
    assistConeDegrees: 20,
    assistOffset: 0.5,
    sizes: { small: 0.3, medium: 0.5, large: 0.8, huge: 1.2 },
    roam: { common: 0.6, rare: 0.8, epic: 0.4, legendary: 0.8, mythic: 0.6 },
  },
  hotSpot: {
    notSameAsYesterday: true,
    drawKey: 'coin_peche',
    ringEverySeconds: [5, 9],
    ringElsewhereSeconds: [20, 40],
    maxRings: 3,
    bubbleEverySeconds: [8, 15],
    birdEverySeconds: [40, 80],
    signsRadius: 20,
  },
  watch: { stillSeconds: 1.5, waterRadius: 3, glintRadius: 8 },
  grands: {
    fromDay: 16,
    maxLegendaryPerDay: 1,
    unseenPresenceFactor: 1.5,
    presenceMax: 0.6,
    attractRadius: 1,
    biteWaitSeconds: [8, 20],
    mythic: { presence: 0.25, watchRange: 6, biteWaitSeconds: [6, 12], netSeconds: 5, netSecondsEasy: 10, netRange: 2.5 },
  },
  togetherRadius: 15,
};

function pair(r: Reader): [number, number] {
  const [a, b, ...rest] = r.numberList();
  if (a === undefined || b === undefined || rest.length > 0 || a > b) return r.fail('[min, max] attendu');
  return [a, b];
}

function timeRanges(r: Reader): [number, number][] {
  return r.items().map((range) => {
    const [from, to, ...rest] = range.items();
    if (from === undefined || to === undefined || rest.length > 0) return range.fail('["HH:MM", "HH:MM"] attendu');
    const a = from.time();
    const b = to.time();
    if (b <= a) return range.fail('la fin doit suivre le début');
    return [a, b];
  });
}

/** Fiche `fish` d'un objet poisson (section 9). */
export function parseFishDef(r: Reader): FishDef {
  const rarity = r.at('rarity').oneOf(FISH_RARITIES);
  const zones = r.at('zones').stringList();
  if (zones.length === 0) r.at('zones').fail('au moins un coin');
  const seasons = r.at('seasons').items().map((s) => s.oneOf(SEASONS));
  if (seasons.length === 0) r.at('seasons').fail('au moins une saison');
  const hours = timeRanges(r.at('hours'));
  if (hours.length === 0) r.at('hours').fail('au moins une plage');
  const weather = r.at('weather').items().map((w) => w.oneOf(WEATHERS));
  if (weather.length === 0) r.at('weather').fail('au moins une météo');
  const length = pair(r.at('lengthCm'));
  const grandRarity = rarity === 'legendary' || rarity === 'mythic';
  const presence = r.opt('presence');
  if (grandRarity !== (presence !== null)) r.fail('`presence` pour un légendaire ou un mythique, et pour eux seuls');
  const prerequisite = r.opt('prerequisite');
  const rumor = r.opt('rumorDialogue');
  return {
    rarity,
    zones,
    seasons,
    hours,
    weather,
    rainAnyHour: r.opt('rainAnyHour')?.boolean() ?? false,
    favorite: (r.opt('favorite')?.items() ?? []).map((f) => f.oneOf<FishFavorite>(['rain', 'mist', ...SEASONS])),
    shadow: r.at('shadow').oneOf(SHADOW_SIZES),
    lengthCm: length,
    released: r.at('released').boolean(),
    description: r.at('description').string(),
    hint: r.at('hint').string(),
    grand:
      presence === null
        ? null
        : {
            presence: presence.number(),
            condition: r.at('condition').oneOf(GRAND_CONDITIONS),
            prerequisite: prerequisite === null || prerequisite.isNull() ? null : prerequisite.string(),
            rumorDialogue: rumor === null || rumor.isNull() ? null : rumor.string(),
          },
  };
}

function bonus(r: Reader | null, fallback: TierBonus): TierBonus {
  if (r === null) return { ...fallback };
  return { rare: r.at('rare').number(), epic: r.at('epic').number() };
}

function num(r: Reader | null, key: string, fallback: number): number {
  return r?.opt(key)?.number() ?? fallback;
}

function pairOr(r: Reader | null, key: string, fallback: [number, number]): [number, number] {
  const v = r?.opt(key) ?? null;
  return v === null ? [fallback[0], fallback[1]] : pair(v);
}

/** Règles de `reglages.fishing` de la 0.12 (clés absentes: valeurs de la conception). */
export function parseFishingRules(fishing: Reader): FishingRules {
  const d = DEFAULT_FISHING_RULES;
  const rarity = fishing.opt('rarity');
  const tiers = rarity?.opt('tierWeights') ?? null;
  const mist = rarity?.opt('mist') ?? null;
  const golden = rarity?.opt('goldenHours') ?? null;
  const together = rarity?.opt('together') ?? null;
  const unseen = rarity?.opt('unseenFactor') ?? null;
  const streak = rarity?.opt('streak') ?? null;
  const sh = fishing.opt('shadows');
  const perZone = sh?.opt('perZone') ?? null;
  const sizes = sh?.opt('sizes') ?? null;
  const hot = fishing.opt('hotSpot');
  const watch = fishing.opt('watch');
  const grands = fishing.opt('grands');
  const mythic = grands?.opt('mythic') ?? null;
  return {
    priceScale: num(fishing, 'priceScale', d.priceScale),
    rarity: {
      tierWeights: { common: num(tiers, 'common', d.rarity.tierWeights.common), rare: num(tiers, 'rare', d.rarity.tierWeights.rare), epic: num(tiers, 'epic', d.rarity.tierWeights.epic) },
      hotSpot: bonus(rarity?.opt('hotSpot') ?? null, d.rarity.hotSpot),
      rain: bonus(rarity?.opt('rain') ?? null, d.rarity.rain),
      mist: { ...bonus(mist, d.rarity.mist), until: mist?.opt('until')?.time() ?? d.rarity.mist.until },
      goldenHours: { ...bonus(golden, d.rarity.goldenHours), ranges: golden === null ? d.rarity.goldenHours.ranges.map(([a, b]) => [a, b]) : timeRanges(golden.at('ranges')) },
      together: { ...bonus(together, d.rarity.together), maxBobberGap: num(together, 'maxBobberGap', d.rarity.together.maxBobberGap) },
      maxShare: bonus(rarity?.opt('maxShare') ?? null, d.rarity.maxShare),
      favoriteFactor: num(rarity, 'favoriteFactor', d.rarity.favoriteFactor),
      unseenFactor: { common: num(unseen, 'common', d.rarity.unseenFactor.common), rare: num(unseen, 'rare', d.rarity.unseenFactor.rare), epic: num(unseen, 'epic', d.rarity.unseenFactor.epic) },
      unseenEpicTier: num(rarity, 'unseenEpicTier', d.rarity.unseenEpicTier),
      streak: { length: streak?.opt('length')?.integer(1) ?? d.rarity.streak.length, factor: num(streak, 'factor', d.rarity.streak.factor) },
      maxSameSpecies: rarity?.opt('maxSameSpecies')?.integer(1) ?? d.rarity.maxSameSpecies,
      pityAfterCommons: rarity?.opt('pityAfterCommons')?.integer(1) ?? d.rarity.pityAfterCommons,
    },
    shadows: {
      perZone: perZone === null ? { ...d.shadows.perZone } : Object.fromEntries(perZone.entries().map(([k, v]) => [k, v.integer(0, 12)])),
      wakeRadius: num(sh, 'wakeRadius', d.shadows.wakeRadius),
      sleepRadius: num(sh, 'sleepRadius', d.shadows.sleepRadius),
      sleepAfterSeconds: num(sh, 'sleepAfterSeconds', d.shadows.sleepAfterSeconds),
      lifeSeconds: pairOr(sh, 'lifeSeconds', d.shadows.lifeSeconds),
      respawnSeconds: pairOr(sh, 'respawnSeconds', d.shadows.respawnSeconds),
      fadeSeconds: num(sh, 'fadeSeconds', d.shadows.fadeSeconds),
      minShoreDistance: num(sh, 'minShoreDistance', d.shadows.minShoreDistance),
      minBobberDistance: num(sh, 'minBobberDistance', d.shadows.minBobberDistance),
      attractRadius: num(sh, 'attractRadius', d.shadows.attractRadius),
      attractRadiusSmallWater: num(sh, 'attractRadiusSmallWater', d.shadows.attractRadiusSmallWater),
      approachSpeed: num(sh, 'approachSpeed', d.shadows.approachSpeed),
      minBiteAfterArrival: num(sh, 'minBiteAfterArrival', d.shadows.minBiteAfterArrival),
      noShadowSpawnDistance: num(sh, 'noShadowSpawnDistance', d.shadows.noShadowSpawnDistance),
      noShadowWaitFactor: num(sh, 'noShadowWaitFactor', d.shadows.noShadowWaitFactor),
      fleeSpeed: num(sh, 'fleeSpeed', d.shadows.fleeSpeed),
      fleeSeconds: num(sh, 'fleeSeconds', d.shadows.fleeSeconds),
      assistConeDegrees: num(sh, 'assistConeDegrees', d.shadows.assistConeDegrees),
      assistOffset: num(sh, 'assistOffset', d.shadows.assistOffset),
      sizes: sizes === null ? { ...d.shadows.sizes } : { small: sizes.at('small').number(), medium: sizes.at('medium').number(), large: sizes.at('large').number(), huge: sizes.at('huge').number() },
      roam: { ...d.shadows.roam },
    },
    hotSpot: {
      notSameAsYesterday: hot?.opt('notSameAsYesterday')?.boolean() ?? d.hotSpot.notSameAsYesterday,
      drawKey: hot?.opt('drawKey')?.string() ?? d.hotSpot.drawKey,
      ringEverySeconds: pairOr(hot, 'ringEverySeconds', d.hotSpot.ringEverySeconds),
      ringElsewhereSeconds: pairOr(hot, 'ringElsewhereSeconds', d.hotSpot.ringElsewhereSeconds),
      maxRings: hot?.opt('maxRings')?.integer(0) ?? d.hotSpot.maxRings,
      bubbleEverySeconds: pairOr(hot, 'bubbleEverySeconds', d.hotSpot.bubbleEverySeconds),
      birdEverySeconds: pairOr(hot, 'birdEverySeconds', d.hotSpot.birdEverySeconds),
      signsRadius: num(hot, 'signsRadius', d.hotSpot.signsRadius),
    },
    watch: { stillSeconds: num(watch, 'stillSeconds', d.watch.stillSeconds), waterRadius: num(watch, 'waterRadius', d.watch.waterRadius), glintRadius: num(watch, 'glintRadius', d.watch.glintRadius) },
    grands: {
      fromDay: grands?.opt('fromDay')?.integer(1) ?? d.grands.fromDay,
      maxLegendaryPerDay: grands?.opt('maxLegendaryPerDay')?.integer(0) ?? d.grands.maxLegendaryPerDay,
      unseenPresenceFactor: num(grands, 'unseenPresenceFactor', d.grands.unseenPresenceFactor),
      presenceMax: num(grands, 'presenceMax', d.grands.presenceMax),
      attractRadius: num(grands, 'attractRadius', d.grands.attractRadius),
      biteWaitSeconds: pairOr(grands, 'biteWaitSeconds', d.grands.biteWaitSeconds),
      mythic: {
        presence: num(mythic, 'presence', d.grands.mythic.presence),
        watchRange: num(mythic, 'watchRange', d.grands.mythic.watchRange),
        biteWaitSeconds: pairOr(mythic, 'biteWaitSeconds', d.grands.mythic.biteWaitSeconds),
        netSeconds: num(mythic, 'netSeconds', d.grands.mythic.netSeconds),
        netSecondsEasy: num(mythic, 'netSecondsEasy', d.grands.mythic.netSecondsEasy),
        netRange: num(mythic, 'netRange', d.grands.mythic.netRange),
      },
    },
    togetherRadius: num(fishing, 'togetherRadius', d.togetherRadius),
  };
}
