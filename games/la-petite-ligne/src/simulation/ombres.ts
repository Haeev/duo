/**
 * Ombres de poissons, coin qui frémit, guet et grands du jour (pêche 0.12, sections 4 à 7 de
 * `docs/jeux/jeu-1/peche-0-12-conception.md`). Tous les tirages passent par `unitDraw` (jamais
 * `sim.rng`): les autres systèmes gardent leur déroulé, et l'invité affiche ce que tire l'hôte.
 *
 * L'état ne change qu'aux événements (apparition, réservation, départ): le rendu fait nager les
 * ombres dans leur disque `roam`, garanti dans l'eau par `spotsOf`.
 */
import { type FishingZone, type GameMap, cellIndex, groundAt, inMap, mapMaxX, mapMaxY, mapMinX, mapMinY } from '../etat/carte';
import type { FishRarity, FishShadow, FishingState, ShadowSize } from '../etat/peche';
import { emptyFishing, shadowPosAt } from '../etat/peche';
import { unitDraw } from '../etat/tirage';
import type { Character, CharacterId, ItemId, Vec2 } from '../etat/types';
import { CHARACTER_IDS } from '../etat/types';
import { seasonOfDay } from '../donnees/calendrier';
import type { FishDef, FishingRules } from '../donnees/poissons';
import type { ItemDef } from '../donnees/types';
import { type Sim, distance, secondsToTicks } from './contexte';
import { weatherOf } from './meteo';
import { queueHint } from './astuces';

// ---------------------------------------------------------------------------
// Géométrie des coins (calculée une fois par carte)

/** Une place possible pour une ombre: point d'eau et marge libre autour (m). */
export interface Spot {
  x: number;
  y: number;
  clear: number;
}

interface ZoneGeometry {
  zones: FishingZone[];
  /** Rang du coin de chaque case (`-1` hors coin ou hors de l'eau). */
  zoneOfCell: Int16Array;
  /** Places possibles, par rang de coin. */
  spots: Spot[][];
}

const GEOMETRY = new WeakMap<GameMap, ZoneGeometry>();
/** Pas du quadrillage des places (m). */
const SPOT_STEP = 0.5;
/** Marge minimale laissée à la nage autour d'une place (m). */
const MIN_ROAM = 0.1;
/** Deux ombres ne naissent pas plus près que ça l'une de l'autre (m). */
const SHADOW_GAP = 1;

/**
 * Cap d'une ombre au millième de radian (0,06 degré): le rendu ne voit pas la différence, et
 * l'état transmis à l'invité perd une douzaine de chiffres par ombre (0.12.1).
 */
function roundHeading(radians: number): number {
  return Math.round(radians * 1000) / 1000;
}

function geometry(map: GameMap, minShore: number, castRange: number): ZoneGeometry {
  const known = GEOMETRY.get(map);
  if (known !== undefined) return known;
  const zones = map.fishingZones ?? [];
  const zoneOfCell = new Int16Array(map.width * map.height).fill(-1);
  zones.forEach((z, i) => {
    for (const r of z.rects) {
      for (let cy = r.y; cy < r.y + r.h; cy++) {
        for (let cx = r.x; cx < r.x + r.w; cx++) {
          if (!inMap(map, cx, cy)) continue;
          const k = cellIndex(map, cx, cy);
          if (map.ground[k] === 'water' && zoneOfCell[k] === -1) zoneOfCell[k] = i;
        }
      }
    }
  });
  // Ce qui n'est pas de l'eau libre: la terre, et ce qui couvre l'eau (ponton, ouvrages du ru, chantiers).
  const covered = new Uint8Array(map.width * map.height);
  const cover = (x0: number, y0: number, w: number, h: number): void => {
    for (let cy = y0; cy < y0 + h; cy++) for (let cx = x0; cx < x0 + w; cx++) if (inMap(map, cx, cy)) covered[cellIndex(map, cx, cy)] = 1;
  };
  for (const p of map.props) if (p.rect !== null) cover(p.rect.x, p.rect.y, p.rect.w, p.rect.h);
  for (const c of map.crossings) cover(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
  for (const imp of Object.values(map.improvements ?? {})) for (const c of imp.cells) cover(c.cx, c.cy, 1, 1);
  const openWater = (cx: number, cy: number): boolean =>
    inMap(map, cx, cy) && map.ground[cellIndex(map, cx, cy)] === 'water' && covered[cellIndex(map, cx, cy)] === 0;
  const standable = (cx: number, cy: number): boolean =>
    inMap(map, cx, cy) && !map.blocked[cellIndex(map, cx, cy)] && map.ground[cellIndex(map, cx, cy)] !== 'water';
  const spots: Spot[][] = zones.map(() => []);
  const reach = Math.ceil(castRange);
  for (let cy = mapMinY(map); cy <= mapMaxY(map); cy++) {
    for (let cx = mapMinX(map); cx <= mapMaxX(map); cx++) {
      const zi = zoneOfCell[cellIndex(map, cx, cy)] ?? -1;
      if (zi < 0 || !openWater(cx, cy)) continue;
      for (const [ox, oy] of [[0, 0], [SPOT_STEP, 0], [0, SPOT_STEP], [SPOT_STEP, SPOT_STEP]] as const) {
        const x = cx + ox;
        const y = cy + oy;
        // Marge: distance au plus proche carré qui n'est pas de l'eau libre (3 cases autour).
        let clear = 3;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            const nx = Math.floor(x) + dx;
            const ny = Math.floor(y) + dy;
            if (openWater(nx, ny)) continue;
            const ex = Math.max(nx - x, 0, x - (nx + 1));
            const ey = Math.max(ny - y, 0, y - (ny + 1));
            clear = Math.min(clear, Math.hypot(ex, ey));
          }
        }
        if (clear < minShore + MIN_ROAM) continue;
        let near = false;
        for (let dy = -reach; dy <= reach && !near; dy++) {
          for (let dx = -reach; dx <= reach && !near; dx++) {
            const nx = Math.floor(x) + dx;
            const ny = Math.floor(y) + dy;
            if (standable(nx, ny) && Math.hypot(nx + 0.5 - x, ny + 0.5 - y) <= castRange - 0.5) near = true;
          }
        }
        if (near) spots[zi]?.push({ x, y, clear });
      }
    }
  }
  // Dans l'eau étroite (le ru), seulement le milieu du lit: les places les plus dégagées du coin.
  spots.forEach((list, i) => {
    const best = list.reduce((m, s) => Math.max(m, s.clear), 0);
    if (best < 1.5) spots[i] = list.filter((s) => s.clear >= best - 1e-6);
  });
  const geo = { zones, zoneOfCell, spots };
  GEOMETRY.set(map, geo);
  return geo;
}

function rulesOf(sim: Sim): FishingRules | null {
  return sim.content.settings.fishing?.rules ?? null;
}

function geo(sim: Sim): ZoneGeometry {
  const f = sim.content.settings.fishing;
  return geometry(sim.map, f?.rules.shadows.minShoreDistance ?? 0.4, f?.castRange ?? 6);
}

/** Coin de pêche de la case qui contient le point, ou `null`. */
export function fishingZoneAt(sim: Sim, x: number, y: number): FishingZone | null {
  const g = geo(sim);
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (!inMap(sim.map, cx, cy)) return null;
  return g.zones[g.zoneOfCell[cellIndex(sim.map, cx, cy)] ?? -1] ?? null;
}

/** Places possibles d'un coin (tests, rendu de démonstration). */
export function zoneSpots(sim: Sim, zone: string): readonly Spot[] {
  const g = geo(sim);
  return g.spots[g.zones.findIndex((z) => z.id === zone)] ?? [];
}

export function hasFishingZones(sim: Sim): boolean {
  return geo(sim).zones.length > 0 && rulesOf(sim) !== null;
}

/** Distance (m) d'un point au plus proche rectangle d'un coin. */
function distanceToZone(zone: FishingZone, p: Vec2): number {
  let best = Number.POSITIVE_INFINITY;
  for (const r of zone.rects) {
    const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
    const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

// ---------------------------------------------------------------------------
// Ce qui est possible ici et maintenant

const TIERS: readonly ('common' | 'rare' | 'epic')[] = ['common', 'rare', 'epic'];

function fishDefs(sim: Sim): [ItemId, FishDef][] {
  const out: [ItemId, FishDef][] = [];
  for (const def of Object.values(sim.content.items)) if (def.fish !== null) out.push([def.id, def.fish]);
  return out;
}

function inHours(def: FishDef, minutes: number, rain: boolean): boolean {
  if (def.rainAnyHour && rain) return true;
  return def.hours.some(([a, b]) => minutes >= a && minutes < b);
}

function mistNow(sim: Sim, rules: FishingRules): boolean {
  return sim.world.morningMist && sim.world.clock.minutes < rules.rarity.mist.until;
}

/** Le poisson peut-il mordre dans ce coin, maintenant (saison, heure, météo) ? */
export function fishPossible(sim: Sim, def: FishDef, zone: string): boolean {
  const { world } = sim;
  if (!def.zones.includes(zone)) return false;
  if (!def.seasons.includes(seasonOfDay(sim.content.settings, world.clock.day))) return false;
  if (!def.weather.includes(world.weather)) return false;
  return inHours(def, world.clock.minutes, world.weather === 'rain');
}

function shadowSizeIn(zone: string, size: ShadowSize): ShadowSize {
  // Dans le ru, une grande ombre de la rivière qui remonterait est ramenée à moyenne (section 5.1).
  return zone === 'ru' && (size === 'large' || size === 'huge') ? 'medium' : size;
}

/** Les deux lignes à l'eau dans ce coin, bouchons à moins de `maxBobberGap` (section 4.2). */
export function fishingTogether(sim: Sim, zone: string): boolean {
  const rules = rulesOf(sim);
  if (rules === null) return false;
  const lines = sim.world.characters.map((c) => c.fishing).filter((f) => f !== null);
  if (lines.length < 2) return false;
  const [a, b] = lines;
  if (a === undefined || b === undefined) return false;
  if (fishingZoneAt(sim, a.bobber.x, a.bobber.y)?.id !== zone || fishingZoneAt(sim, b.bobber.x, b.bobber.y)?.id !== zone) return false;
  return distance(a.bobber, b.bobber) <= rules.rarity.together.maxBobberGap;
}

function inGoldenHours(rules: FishingRules, minutes: number): boolean {
  return rules.rarity.goldenHours.ranges.some(([a, b]) => minutes >= a && minutes < b);
}

/** Part de chaque rareté pour une ombre qui apparaît dans ce coin (après bonus et plafonds). */
export function tierShares(sim: Sim, zone: string): Record<'common' | 'rare' | 'epic', number> {
  const rules = rulesOf(sim);
  const out = { common: 0, rare: 0, epic: 0 };
  if (rules === null) return out;
  const r = rules.rarity;
  const { world } = sim;
  const possible = fishDefs(sim).filter(([, d]) => fishPossible(sim, d, zone));
  const has = (t: FishRarity): boolean => possible.some(([, d]) => d.rarity === t);
  let rare = r.tierWeights.rare;
  let epic = r.tierWeights.epic;
  const bonus = (b: { rare: number; epic: number }): void => {
    rare *= b.rare;
    epic *= b.epic;
  };
  if (world.fishing.hotSpot?.zone === zone) bonus(r.hotSpot);
  if (world.weather === 'rain') bonus(r.rain);
  if (mistNow(sim, rules)) bonus(r.mist);
  if (inGoldenHours(rules, world.clock.minutes)) bonus(r.goldenHours);
  if (fishingTogether(sim, zone)) bonus(r.together);
  if (possible.some(([id, d]) => d.rarity === 'epic' && world.fishing.log[id] === undefined)) epic *= r.unseenEpicTier;
  const w = { common: has('common') ? r.tierWeights.common : 0, rare: has('rare') ? rare : 0, epic: has('epic') ? epic : 0 };
  // Filet des communs: après `pityAfterCommons` communs de suite, l'ombre suivante du coin du dernier preneur est au moins rare.
  if (world.fishing.commonsInRow >= r.pityAfterCommons && world.fishing.lastCatchZone === zone && (w.rare > 0 || w.epic > 0)) w.common = 0;
  const total = w.common + w.rare + w.epic;
  if (total <= 0) return out;
  out.common = w.common / total;
  out.rare = w.rare / total;
  out.epic = w.epic / total;
  // Plafonds: l'excédent revient au commun (s'il y en a un ici).
  let excess = 0;
  if (out.epic > r.maxShare.epic) {
    excess += out.epic - r.maxShare.epic;
    out.epic = r.maxShare.epic;
  }
  if (out.rare > r.maxShare.rare) {
    excess += out.rare - r.maxShare.rare;
    out.rare = r.maxShare.rare;
  }
  if (w.common > 0) out.common += excess;
  else {
    const kept = out.rare + out.epic;
    if (kept > 0) {
      out.rare /= kept;
      out.epic /= kept;
    }
  }
  return out;
}

/**
 * Le poisson d'une ombre nouvelle (section 4.1): la rareté, puis le poisson parmi ceux de cette
 * rareté possibles ici et maintenant. `n`: numéro de l'ombre (clé du tirage). `null`: rien ne mord ici.
 */
export function drawShadowFish(sim: Sim, zone: string, n: number): { fish: ItemId; rarity: FishRarity } | null {
  const rules = rulesOf(sim);
  if (rules === null) return null;
  const { world } = sim;
  const r = rules.rarity;
  const shares = tierShares(sim, zone);
  const key = `ombre:${zone}:${String(n)}`;
  const u = unitDraw(world.seed, `${key}:rarete`, world.clock.day);
  let tier: 'common' | 'rare' | 'epic' = 'common';
  let acc = 0;
  for (const t of TIERS) {
    acc += shares[t];
    if (shares[t] > 0) tier = t;
    if (u < acc) break;
  }
  const season = seasonOfDay(sim.content.settings, world.clock.day);
  const live = world.fishing.shadows.filter((s) => s.zone === zone && s.state !== 'leaving' && s.state !== 'fleeing');
  let candidates = fishDefs(sim).filter(([, d]) => d.rarity === tier && fishPossible(sim, d, zone));
  const varied = candidates.filter(([id]) => live.filter((s) => s.fish === id).length < r.maxSameSpecies);
  if (varied.length > 0) candidates = varied;
  if (candidates.length === 0) return null;
  const mist = mistNow(sim, rules);
  const weights = candidates.map(([id, d]) => {
    let w = 1;
    const favorite = d.favorite.some((f) => (f === 'rain' ? world.weather === 'rain' : f === 'mist' ? mist : f === season));
    if (favorite) w *= r.favoriteFactor;
    if (world.fishing.log[id] === undefined) w *= tier === 'epic' ? r.unseenFactor.epic : tier === 'rare' ? r.unseenFactor.rare : r.unseenFactor.common;
    if (CHARACTER_IDS.some((c) => { const s = world.fishing.streak[c]; return s !== null && s.fish === id && s.count >= r.streak.length; })) w *= r.streak.factor;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = unitDraw(world.seed, `${key}:poisson`, world.clock.day) * total;
  for (let i = 0; i < candidates.length; i++) {
    roll -= weights[i] ?? 0;
    const c = candidates[i];
    if (roll < 0 && c !== undefined) return { fish: c[0], rarity: tier };
  }
  const last = candidates[candidates.length - 1];
  return last === undefined ? null : { fish: last[0], rarity: tier };
}

// ---------------------------------------------------------------------------
// Coin qui frémit et grands du jour

/** Coin qui frémit d'un jour (section 6.1): jamais celui de la veille, le même chez les deux. */
export function hotSpotOn(sim: Sim, day: number): string | null {
  const rules = rulesOf(sim);
  const zones = geo(sim).zones;
  if (rules === null || zones.length === 0) return null;
  const n = zones.length;
  const pick = (d: number): number => Math.floor(unitDraw(sim.world.seed, rules.hotSpot.drawKey, d) * n) % n;
  let idx = pick(1);
  for (let d = 2; d <= day; d++) {
    if (!rules.hotSpot.notSameAsYesterday || n < 2) idx = pick(d);
    else idx = (idx + 1 + (Math.floor(unitDraw(sim.world.seed, rules.hotSpot.drawKey, d) * (n - 1)) % (n - 1))) % n;
  }
  return zones[idx]?.id ?? null;
}

/** Rang de la saison depuis le début de la partie (année comprise). */
export function seasonSerial(sim: Sim, day: number): number {
  return Math.floor((Math.max(1, day) - 1) / sim.content.settings.calendar.seasonDays);
}

export function yearOf(sim: Sim, day: number): number {
  const c = sim.content.settings.calendar;
  return Math.floor((Math.max(1, day) - 1) / (c.seasonDays * c.seasonsPerYear));
}

function grandConditionMet(sim: Sim, def: FishDef): boolean {
  const { world } = sim;
  const grand = def.grand;
  if (grand === null) return false;
  const rain = world.weather === 'rain';
  switch (grand.condition) {
    case 'any':
      return true;
    case 'dry':
    case 'night_dry':
      return !rain;
    case 'wet':
      return rain || weatherOf(sim, world.clock.day - 1) === 'rain';
    case 'mist':
      return world.morningMist;
    case 'misty_or_wet':
      return world.morningMist || world.weather !== 'sunny';
  }
}

/** Le grand peut-il encore être pris (limites par saison et par année, prérequis) ? */
export function grandAllowed(sim: Sim, id: ItemId, def: FishDef): boolean {
  const { world } = sim;
  const day = world.clock.day;
  const last = world.fishing.grandsCaught[id];
  if (def.rarity === 'mythic') {
    if (last !== undefined && yearOf(sim, last) === yearOf(sim, day)) return false;
    const pre = def.grand?.prerequisite ?? null;
    if (pre !== null && world.fishing.log[pre] === undefined) return false;
  } else if (last !== undefined && seasonSerial(sim, last) === seasonSerial(sim, day)) return false;
  return true;
}

/** À l'aube (ou au premier pas d'un jour): coin qui frémit, grands présents, ombres effacées. */
export function fishingDawn(sim: Sim): void {
  const rules = rulesOf(sim);
  const { world } = sim;
  const f = world.fishing;
  const day = world.clock.day;
  f.shadows = [];
  f.zones = {};
  f.landing = null;
  const zone = hotSpotOn(sim, day);
  f.hotSpot = zone === null ? null : { day, zone };
  f.grands = { day, list: [] };
  if (rules === null || day < rules.grands.fromDay) return;
  const season = seasonOfDay(sim.content.settings, day);
  for (const [id, def] of fishDefs(sim)) {
    const grand = def.grand;
    if (grand === null || !def.seasons.includes(season) || !grandConditionMet(sim, def) || !grandAllowed(sim, id, def)) continue;
    let p = grand.presence;
    if (def.rarity === 'legendary' && f.log[id] === undefined) p = Math.min(rules.grands.presenceMax, p * rules.grands.unseenPresenceFactor);
    if (unitDraw(world.seed, `grand:${id}`, day) >= p) continue;
    const home = def.zones[0];
    if (home !== undefined) f.grands.list.push({ fish: id, zone: home, gone: false });
  }
}

// ---------------------------------------------------------------------------
// Vie des ombres

function draw(sim: Sim, key: string, [a, b]: readonly [number, number]): number {
  return a + (b - a) * unitDraw(sim.world.seed, key, sim.world.clock.day);
}

function fishDef(sim: Sim, id: ItemId): ItemDef['fish'] {
  return sim.content.items[id]?.fish ?? null;
}

/** Une place libre du coin: loin des bouchons et des autres ombres; `near`: la plus proche de cette distance au point. */
function pickSpot(sim: Sim, zoneIndex: number, key: string, near: { at: Vec2; dist: number } | null): Spot | null {
  const rules = rulesOf(sim);
  const spots = geo(sim).spots[zoneIndex] ?? [];
  if (rules === null || spots.length === 0) return null;
  const { world } = sim;
  const bobbers = world.characters.map((c) => c.fishing?.bobber).filter((b) => b !== undefined);
  const taken = world.fishing.shadows.map((s) => s.pos);
  const free = (s: Spot): boolean =>
    bobbers.every((b) => Math.hypot(b.x - s.x, b.y - s.y) >= (near === null ? rules.shadows.minBobberDistance : 1.5)) &&
    taken.every((t) => Math.hypot(t.x - s.x, t.y - s.y) >= SHADOW_GAP);
  if (near !== null) {
    let best: Spot | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    const jitter = unitDraw(world.seed, `${key}:place`, world.clock.day);
    spots.forEach((s, i) => {
      if (!free(s)) return;
      const score = Math.abs(Math.hypot(s.x - near.at.x, s.y - near.at.y) - near.dist) + (((i * 0.618 + jitter) % 1) * 0.05);
      if (score < bestScore) {
        bestScore = score;
        best = s;
      }
    });
    return best;
  }
  const start = Math.floor(unitDraw(world.seed, `${key}:place`, world.clock.day) * spots.length);
  for (let i = 0; i < Math.min(spots.length, 24); i++) {
    const s = spots[(start + i * 37) % spots.length];
    if (s !== undefined && free(s)) return s;
  }
  return null;
}

/** Fait naître une ombre dans un coin (poisson tiré, ou le grand donné). */
function spawnShadow(sim: Sim, zoneIndex: number, grand: ItemId | null, near: { at: Vec2; dist: number } | null): FishShadow | null {
  const rules = rulesOf(sim);
  const zone = geo(sim).zones[zoneIndex];
  if (rules === null || zone === undefined) return null;
  const { world } = sim;
  const n = world.fishing.nextShadow;
  const key = `ombre:${zone.id}:${String(n)}`;
  let fish: ItemId;
  let rarity: FishRarity;
  if (grand !== null) {
    const def = fishDef(sim, grand);
    if (def === null) return null;
    fish = grand;
    rarity = def.rarity;
  } else {
    const drawn = drawShadowFish(sim, zone.id, n);
    if (drawn === null) return null;
    fish = drawn.fish;
    rarity = drawn.rarity;
    if (rarity !== 'common' && world.fishing.commonsInRow >= rules.rarity.pityAfterCommons && world.fishing.lastCatchZone === zone.id) world.fishing.commonsInRow = 0;
  }
  const def = fishDef(sim, fish);
  if (def === null) return null;
  const spot = pickSpot(sim, zoneIndex, key, near);
  if (spot === null) return null;
  world.fishing.nextShadow = n + 1;
  const tick = world.tick;
  const shadow: FishShadow = {
    id: n,
    zone: zone.id,
    fish,
    rarity,
    size: shadowSizeIn(zone.id, def.shadow),
    pos: { x: spot.x, y: spot.y },
    roam: Math.max(0, Math.min(rules.shadows.roam[rarity], spot.clear - rules.shadows.minShoreDistance)),
    heading: roundHeading(unitDraw(world.seed, `${key}:cap`, world.clock.day) * Math.PI * 2),
    state: 'free',
    born: tick,
    ends: grand !== null ? Number.MAX_SAFE_INTEGER : tick + secondsToTicks(draw(sim, `${key}:vie`, rules.shadows.lifeSeconds)),
    ...(rarity === 'mythic' ? { watchOnly: true as const } : {}),
  };
  world.fishing.shadows.push(shadow);
  sim.runtime.changed = true;
  return shadow;
}

/** Fait partir une ombre (fin de vie: elle glisse vers le fond et s'efface). */
function startLeaving(sim: Sim, s: FishShadow, seconds: number): void {
  s.state = 'leaving';
  delete s.line;
  s.ends = sim.world.tick + secondsToTicks(seconds);
  scheduleRespawn(sim, s.zone);
  sim.runtime.changed = true;
}

/** Ferrage manqué: l'ombre file en ligne droite, loin du bouchon, et s'efface. */
export function fleeShadow(sim: Sim, id: number, from: Vec2): void {
  const rules = rulesOf(sim);
  const s = sim.world.fishing.shadows.find((x) => x.id === id);
  if (s === undefined || rules === null) return;
  const tick = sim.world.tick;
  const at = shadowPosAt(s, tick);
  const away = Math.atan2(at.y - from.y, at.x - from.x) || s.heading;
  // Elle file droit devant elle, loin du pêcheur, sans jamais sortir de l'eau (le ru est étroit).
  let run = rules.shadows.fleeSpeed * rules.shadows.fleeSeconds;
  const wet = (d: number): boolean => {
    const cx = Math.floor(at.x + Math.cos(away) * d);
    const cy = Math.floor(at.y + Math.sin(away) * d);
    return groundAt(sim.map, cx, cy) === 'water';
  };
  while (run > 0 && !wet(run)) run = Math.max(0, run - 0.25);
  s.move = { from: at, since: tick, until: tick + secondsToTicks(rules.shadows.fleeSeconds) };
  s.pos = { x: at.x + Math.cos(away) * run, y: at.y + Math.sin(away) * run };
  s.heading = roundHeading(away);
  s.state = 'fleeing';
  delete s.line;
  s.roam = 0;
  s.ends = s.move.until;
  scheduleRespawn(sim, s.zone);
  markGone(sim, s.fish);
  sim.runtime.changed = true;
}

/** L'ombre sort de l'eau (prise): retirée, le coin en refera une. */
export function removeShadow(sim: Sim, id: number): void {
  const f = sim.world.fishing;
  const i = f.shadows.findIndex((s) => s.id === id);
  if (i < 0) return;
  const [s] = f.shadows.splice(i, 1);
  if (s !== undefined) scheduleRespawn(sim, s.zone);
  sim.runtime.changed = true;
}

/** Ligne remontée avant la touche: l'ombre perd l'intérêt et retourne nager à une place du coin. */
export function releaseShadow(sim: Sim, id: number): void {
  const rules = rulesOf(sim);
  const s = sim.world.fishing.shadows.find((x) => x.id === id);
  if (s === undefined || rules === null) return;
  const tick = sim.world.tick;
  const at = shadowPosAt(s, tick);
  const zi = geo(sim).zones.findIndex((z) => z.id === s.zone);
  const spots = geo(sim).spots[zi] ?? [];
  let best: Spot | null = null;
  for (const sp of spots) if (best === null || Math.hypot(sp.x - at.x, sp.y - at.y) < Math.hypot(best.x - at.x, best.y - at.y)) best = sp;
  s.state = 'free';
  delete s.line;
  if (best !== null) {
    const d = Math.hypot(best.x - at.x, best.y - at.y);
    s.move = { from: at, since: tick, until: tick + secondsToTicks(d / rules.shadows.approachSpeed) };
    s.pos = { x: best.x, y: best.y };
    s.roam = Math.max(0, Math.min(rules.shadows.roam[s.rarity], best.clear - rules.shadows.minShoreDistance));
  }
  if (s.watchOnly === true || s.rarity === 'legendary') s.ends = Number.MAX_SAFE_INTEGER;
  else s.ends = Math.max(s.ends, tick + secondsToTicks(rules.shadows.fadeSeconds * 5));
  sim.runtime.changed = true;
}

function scheduleRespawn(sim: Sim, zone: string): void {
  const rules = rulesOf(sim);
  const z = sim.world.fishing.zones[zone];
  if (rules === null || z === undefined) return;
  const n = sim.world.fishing.nextShadow;
  const next = sim.world.tick + secondsToTicks(draw(sim, `reapparition:${zone}:${String(n)}`, rules.shadows.respawnSeconds));
  // Une réapparition déjà prévue garde son heure: un second départ ne retarde pas le premier.
  if (z.nextSpawn <= sim.world.tick) z.nextSpawn = next;
}

/** Le grand ne reparaîtra plus aujourd'hui (pris ou manqué). */
export function markGone(sim: Sim, fish: ItemId): void {
  for (const g of sim.world.fishing.grands.list) if (g.fish === fish) g.gone = true;
}

/** Un joueur près de l'eau ce pas-ci (dehors, pas assoupi). */
function present(c: Character): boolean {
  return c.inside === null && c.status !== 'sleeping' && !c.absent;
}

/** Une ombre libre peut-elle venir à ce bouchon (rayon d'attraction selon l'eau et la rareté) ? */
function attractRadius(rules: FishingRules, s: FishShadow): number {
  if (s.rarity === 'legendary' || s.rarity === 'mythic') return rules.grands.attractRadius;
  return s.zone === 'ru' ? rules.shadows.attractRadiusSmallWater : rules.shadows.attractRadius;
}

/**
 * Lancer assisté (section 5.4): l'ombre libre la plus proche du regard, à moins de
 * `assistConeDegrees` et à portée; le bouchon tombe à `assistOffset` devant elle, côté pêcheur.
 */
export function assistedBobber(sim: Sim, c: Character): Vec2 | null {
  const rules = rulesOf(sim);
  const fishing = sim.content.settings.fishing;
  if (rules === null || fishing === null) return null;
  const cone = (rules.shadows.assistConeDegrees * Math.PI) / 180;
  let best: FishShadow | null = null;
  let bestAngle = cone;
  for (const s of sim.world.fishing.shadows) {
    if (s.state !== 'free') continue;
    const d = Math.hypot(s.pos.x - c.pos.x, s.pos.y - c.pos.y);
    if (d > fishing.castRange || d < 0.5) continue;
    let a = Math.atan2(s.pos.y - c.pos.y, s.pos.x - c.pos.x) - c.facing;
    a = Math.abs(Math.atan2(Math.sin(a), Math.cos(a)));
    if (a <= bestAngle) {
      bestAngle = a;
      best = s;
    }
  }
  if (best === null) return null;
  const d = Math.hypot(best.pos.x - c.pos.x, best.pos.y - c.pos.y);
  const k = Math.max(0, d - rules.shadows.assistOffset) / d;
  const at = { x: c.pos.x + (best.pos.x - c.pos.x) * k, y: c.pos.y + (best.pos.y - c.pos.y) * k };
  const water = (p: Vec2): boolean => {
    const cx = Math.floor(p.x);
    const cy = Math.floor(p.y);
    return groundAt(sim.map, cx, cy) === 'water';
  };
  if (water(at)) return at;
  return water(best.pos) ? { x: best.pos.x, y: best.pos.y } : null;
}

/**
 * Le bouchon tombe (section 5.3): l'ombre libre la plus proche dans son rayon le remarque et vient
 * dessous; sinon une ombre nouvelle naît à `noShadowSpawnDistance` et vient (attente x 1,5).
 * Renvoie l'ombre réservée et le pas où elle arrive sous le bouchon.
 */
export function attractShadow(sim: Sim, c: Character, bobber: Vec2): { shadow: FishShadow; arrives: number; fresh: boolean } | null {
  const rules = rulesOf(sim);
  if (rules === null) return null;
  const zone = fishingZoneAt(sim, bobber.x, bobber.y);
  if (zone === null) return null;
  const zi = geo(sim).zones.indexOf(zone);
  wakeZone(sim, zone.id);
  const tick = sim.world.tick;
  let best: FishShadow | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const s of sim.world.fishing.shadows) {
    if (s.state !== 'free' || s.zone !== zone.id) continue;
    const at = shadowPosAt(s, tick);
    const d = Math.hypot(at.x - bobber.x, at.y - bobber.y);
    if (d <= attractRadius(rules, s) && d < bestD) {
      bestD = d;
      best = s;
    }
  }
  let fresh = false;
  if (best === null) {
    best = spawnShadow(sim, zi, null, { at: bobber, dist: rules.shadows.noShadowSpawnDistance });
    fresh = true;
  }
  if (best === null) return null;
  const from = shadowPosAt(best, tick);
  const d = Math.hypot(from.x - bobber.x, from.y - bobber.y);
  best.move = { from, since: tick, until: tick + secondsToTicks(d / rules.shadows.approachSpeed) };
  best.pos = { x: bobber.x, y: bobber.y };
  best.heading = roundHeading(Math.atan2(bobber.y - from.y, bobber.x - from.x));
  best.roam = 0;
  best.state = 'approach';
  best.line = c.id;
  sim.runtime.changed = true;
  return { shadow: best, arrives: best.move.until, fresh };
}

function wakeZone(sim: Sim, zone: string): void {
  const f = sim.world.fishing;
  const z = f.zones[zone];
  if (z === undefined) {
    f.zones[zone] = { sleepAt: null, nextSpawn: sim.world.tick };
    sim.runtime.changed = true;
  } else if (z.sleepAt !== null) {
    z.sleepAt = null;
    sim.runtime.changed = true;
  }
}

/** Guet (section 7.2): immobile au bord depuis `stillSeconds`, à moins de `waterRadius` de l'eau d'un coin, sans ligne. */
function updateWatch(sim: Sim, rules: FishingRules): void {
  const f = sim.world.fishing;
  const tick = sim.world.tick;
  for (const c of sim.world.characters) {
    let zone: string | null = null;
    if (c.fishing === null && c.speed === 0 && c.status === 'active' && c.inside === null && !c.absent && sim.world.phase === 'day') {
      const r = Math.ceil(rules.watch.waterRadius);
      let best = Number.POSITIVE_INFINITY;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const x = Math.floor(c.pos.x) + dx + 0.5;
          const y = Math.floor(c.pos.y) + dy + 0.5;
          const d = Math.hypot(x - c.pos.x, y - c.pos.y);
          if (d > rules.watch.waterRadius + 0.5 || d >= best) continue;
          const z = fishingZoneAt(sim, x, y);
          if (z !== null) {
            best = d;
            zone = z.id;
          }
        }
      }
    }
    const w = f.watch[c.id];
    if (zone === null) {
      if (w !== null) {
        f.watch[c.id] = null;
        sim.runtime.changed = true;
      }
    } else if (w?.zone !== zone) {
      f.watch[c.id] = { zone, since: tick, active: false };
      sim.runtime.changed = true;
    } else if (!w.active && tick - w.since >= secondsToTicks(rules.watch.stillSeconds)) {
      w.active = true;
      sim.runtime.changed = true;
      queueHint(sim, c.id, { on: 'fishing_watch' });
    }
  }
}

/** Un guetteur (pas le pêcheur) à moins de `range` m du point. */
export function watcherNear(sim: Sim, angler: CharacterId, at: Vec2, range: number): Character | null {
  for (const c of sim.world.characters) {
    if (c.id === angler || sim.world.fishing.watch[c.id]?.active !== true) continue;
    if (Math.hypot(c.pos.x - at.x, c.pos.y - at.y) <= range) return c;
  }
  return null;
}

/** Un pas de la pêche du monde: aube, éveil et sommeil des coins, vie des ombres, guet. */
export function updateFishingWorld(sim: Sim): void {
  const rules = rulesOf(sim);
  const { world } = sim;
  if (rules === null || !hasFishingZones(sim)) return;
  const f = world.fishing;
  if (f.hotSpot?.day !== world.clock.day || f.grands.day !== world.clock.day) fishingDawn(sim);
  updateWatch(sim, rules);
  if (world.phase !== 'day' || !world.clock.running) return;
  const tick = world.tick;
  const g = geo(sim);
  const people = world.characters.filter(present);
  // Éveil et sommeil.
  g.zones.forEach((zone) => {
    const near = (r: number): boolean => people.some((c) => distanceToZone(zone, c.pos) <= r);
    const z = f.zones[zone.id];
    if (near(rules.shadows.wakeRadius)) wakeZone(sim, zone.id);
    else if (z !== undefined && !near(rules.shadows.sleepRadius)) {
      const busy = f.shadows.some((s) => s.zone === zone.id && s.line !== undefined);
      if (busy) return;
      if (z.sleepAt === null) {
        z.sleepAt = tick + secondsToTicks(rules.shadows.sleepAfterSeconds);
        sim.runtime.changed = true;
      } else if (tick >= z.sleepAt) {
        f.zones = Object.fromEntries(Object.entries(f.zones).filter(([id]) => id !== zone.id));
        f.shadows = f.shadows.filter((s) => s.zone !== zone.id);
        sim.runtime.changed = true;
      }
    } else if (z !== undefined && z.sleepAt !== null) {
      z.sleepAt = null;
      sim.runtime.changed = true;
    }
  });
  // Fins de vie, départs et grands hors de leurs heures.
  for (let i = f.shadows.length - 1; i >= 0; i--) {
    const s = f.shadows[i];
    if (s === undefined) continue;
    if ((s.state === 'leaving' || s.state === 'fleeing') && tick >= s.ends) {
      f.shadows.splice(i, 1);
      sim.runtime.changed = true;
      continue;
    }
    if (s.state !== 'free') continue;
    const def = fishDef(sim, s.fish);
    const grandOver = (def?.grand ?? null) !== null && (!fishPossibleGrand(sim, s.fish) || f.grands.list.some((x) => x.fish === s.fish && x.gone));
    if (tick >= s.ends || grandOver) startLeaving(sim, s, rules.shadows.fadeSeconds);
  }
  // Naissances: le compte du coin, au plus une manquante en attendant la réapparition.
  g.zones.forEach((zone, zi) => {
    const z = f.zones[zone.id];
    if (z === undefined) return;
    const want = rules.shadows.perZone[zone.id] ?? 0;
    const live = (): number => f.shadows.filter((s) => s.zone === zone.id && !s.watchOnly && s.rarity !== 'legendary' && s.state !== 'leaving' && s.state !== 'fleeing').length;
    let guard = want + 1;
    while (guard-- > 0 && live() < want && (tick >= z.nextSpawn || live() < want - 1)) {
      if (spawnShadow(sim, zi, null, null) === null) break;
      if (live() < want) z.nextSpawn = Math.max(z.nextSpawn, tick);
    }
    for (const grand of f.grands.list) {
      if (grand.gone || grand.zone !== zone.id || f.shadows.some((s) => s.fish === grand.fish)) continue;
      if (fishPossibleGrand(sim, grand.fish)) spawnShadow(sim, zi, grand.fish, null);
    }
  });
}

/** Un grand est-il dans ses heures (la présence du jour est tirée à l'aube) ? */
function fishPossibleGrand(sim: Sim, id: ItemId): boolean {
  const def = fishDef(sim, id);
  if (def === null) return false;
  return inHours(def, sim.world.clock.minutes, sim.world.weather === 'rain');
}

/** Pour une partie d'avant la 0.12 (migration) ou un monde neuf. */
export function freshFishing(): FishingState {
  return emptyFishing();
}
