/**
 * Système de la pêche, chez l'hôte (conception: `docs/jeux/jeu-1/refonte/peche.md`). Il tient
 * la graine des ombres, accepte les lancers (l'ombre qui viendra, la graine de la touche et du
 * combat), puis valide le résultat joué chez le pêcheur en rejouant son journal de touches.
 * Appâts et prises uniques: `uniques.ts`; pêche à deux (jugée ici, gestes des deux): `a-deux.ts`.
 */
import { recordFind } from '../collections/registre';
import { deriveSeed, createRandom } from '@duo/sdk/sim';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { FishingSpot } from '../../donnees/schemas/peche';
import type { FishingLine, FishingPlaceState } from '../../etat/peche';
import type { PlaceState } from '../../etat/lieu';
import { modifiersOf } from '../besoins/jauges';
import { SIM_DT } from '../noyau/constantes';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { giveItem } from '../sac/actions';
import { wearTool } from '../sac/outils';
import { biteSchedule, fightSeconds, judgeStrike, replayFight, strikeDeadline } from './combat';
import {
  heldRod,
  helpOf,
  insideSpot,
  recordKey,
  shadowsNow,
  spotById,
  spotInFront,
} from './lecture';
import { fishOf, gameSeconds, shadowPosition, waveOf, type Shadow } from './ombres';
import { FISHING } from './reglages';
import { noteFirstCatch } from '../regles/souvenirs';
import { countHeld } from '../regles/conditions';
import { remember } from '../regles/memoire';
import { removeItem } from '../sac/inventaire';
import type { DeepReadonly } from '../../etat/monde';
import { judgeNet, missNet, stepPair, type Lane } from './a-deux';
import { baitFactor, uniqueOf } from './uniques';
import { assistFactor } from '../aide/index';

type FishingIntent = Extract<Intent, { type: `fish_${string}` }>;

function placeOf(sim: SimContext): PlaceState | null {
  return sim.world.places[sim.world.common.place] ?? null;
}

/** L'état de pêche du lieu, créé au premier besoin (graine des ombres). */
function fishingOf(sim: SimContext): FishingPlaceState | null {
  const place = placeOf(sim);
  if (place === null) return null;
  if (place.fishing === undefined) {
    place.fishing = { seed: sim.random.int(0, 2 ** 31), taken: [], lines: [null, null] };
    sim.touch('place');
  }
  return place.fishing;
}

function endLine(
  sim: SimContext,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  scare: boolean,
): void {
  const line = fishing.lines[player];
  if (line === null) return;
  // Une prise unique ne s'effraie pas: ratée, on peut la retenter tout de suite.
  const unique = uniqueOf(sim.content, line.catch) !== null;
  if (scare && !unique && !fishing.taken.includes(line.shadow)) fishing.taken.push(line.shadow);
  fishing.lines[player] = null;
  sim.touch('place');
}

/** L'autre joueur peut-il tenir l'épuisette ? (près de la canne, sans ligne à l'eau.) */
function netterReady(sim: SimContext, fishing: FishingPlaceState, player: PlayerIndex): boolean {
  const mate: PlayerIndex = player === 0 ? 1 : 0;
  const a = sim.world.players[player].body;
  const b = sim.world.players[mate].body;
  return fishing.lines[mate] === null && Math.hypot(a.x - b.x, a.y - b.y) <= FISHING.pair.radius;
}

/** Une prise unique vient-elle à cette ligne ? (son appât, et l'épuisette si elle la demande.) */
function uniqueBites(
  sim: SimContext,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  catchId: string,
  bait: string | null,
): boolean {
  const def = uniqueOf(sim.content, catchId);
  if (def === null) return true;
  if (def.unique.bait !== null && def.unique.bait !== bait) return false;
  return def.unique.crew === 'solo' || netterReady(sim, fishing, player);
}

/**
 * L'ombre qui viendra au bouchon. Une prise unique qui veut de cette ligne passe devant tout (son
 * appât l'attire de tout le coin). Sinon la plus proche à portée de touche (la plus rare si la
 * chance sourit), un appât rapprochant les poissons qu'il attire; à défaut, la plus proche.
 */
function chooseShadow(
  sim: SimContext,
  spot: FishingSpot,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  x: number,
  y: number,
  bait: string | null,
): { shadow: Shadow; distance: number } | null {
  const other = fishing.lines[player === 0 ? 1 : 0];
  const seconds = gameSeconds(sim.content, sim.world.common.day, sim.world.minutes);
  const at = { x: 0, y: 0 };
  const near: {
    shadow: Shadow;
    distance: number;
    reach: number;
    rarity: number;
    lure: number;
  }[] = [];
  let best: { shadow: Shadow; distance: number; reach: number } | null = null;
  const order = { common: 0, uncommon: 1, rare: 2 } as const;
  for (const shadow of shadowsNow(sim.content, sim.world, spot)) {
    if (other !== null && other.spot === spot.id && other.shadow === shadow.id) continue;
    shadowPosition(shadow, seconds, at);
    const distance = Math.hypot(at.x - x, at.y - y);
    const def = fishOf(sim.content, shadow.catch);
    if (def === null) continue;
    if (def.unique !== undefined) {
      if (uniqueBites(sim, fishing, player, def.id, bait)) return { shadow, distance };
      continue;
    }
    // Distance ramenée par l'attrait de l'appât: `factor` 2, elle vient de deux fois plus loin.
    const lure = baitFactor(def, bait);
    const reach = distance / lure;
    if (reach <= FISHING.biteRadius)
      near.push({ shadow, distance, reach, rarity: order[def.rarity], lure });
    if (best === null || reach < best.reach) best = { shadow, distance, reach };
  }
  if (near.length > 0) {
    const lucky = modifiersOf(sim.content, sim.world, player).rareLuck > 1;
    // Les poissons que l'appât attire passent devant, puis la chance, puis la distance.
    near.sort((a, b) => b.lure - a.lure || (lucky ? b.rarity - a.rarity : 0) || a.reach - b.reach);
    const first = near[0];
    if (first !== undefined) return { shadow: first.shadow, distance: first.distance };
  }
  return best === null ? null : { shadow: best.shadow, distance: best.distance };
}

/** L'appât de la ligne est mangé à la touche (s'il est encore au sac). */
function eatBait(sim: SimContext, player: PlayerIndex, line: FishingLine): void {
  if (line.bait === undefined) return;
  if (removeItem(sim.world.players[player], line.bait, 1)) sim.touch('players');
}

function cast(
  sim: SimContext,
  player: PlayerIndex,
  x: number,
  y: number,
  wanted: string | undefined,
): void {
  const fishing = fishingOf(sim);
  if (fishing?.lines[player] !== null) return;
  const body = sim.world.players[player].body;
  const spot = spotInFront(sim.content, sim.world, player);
  const help = helpOf(sim.content, sim.world, player);
  // Un appât qu'on n'a plus au sac ne compte pas: la ligne part sans.
  const bait =
    wanted !== undefined && countHeld(sim.world.players[player], wanted) > 0 ? wanted : null;
  const chosen =
    spot === null || !insideSpot(spot, x, y)
      ? null
      : chooseShadow(sim, spot, fishing, player, x, y, bait);
  let refusal: string | null = null;
  if (help === 0) refusal = 'need-rod';
  else if (spot === null || !insideSpot(spot, x, y)) refusal = 'fish-no-water';
  else if (Math.hypot(x - body.x, y - body.y) > FISHING.cast.max + 1) refusal = 'too-far';
  else if (chosen === null) refusal = 'fish-none';
  if (refusal !== null || spot === null || chosen === null) {
    sim.emit({ type: 'refused', player, reason: refusal ?? 'fish-none', target: null });
    return;
  }
  const extra = Math.max(0, chosen.distance - FISHING.biteRadius);
  const line: FishingLine = {
    spot: spot.id,
    x,
    y,
    stanceX: body.x,
    stanceY: body.y,
    shadow: chosen.shadow.id,
    catch: chosen.shadow.catch,
    seed: sim.random.int(0, 2 ** 31),
    tick: sim.world.tick,
    approach: Math.min(
      FISHING.approach.max,
      FISHING.approach.base + extra * FISHING.approach.perMeter,
    ),
    help,
    hooked: false,
    ...(bait === null ? {} : { bait }),
  };
  fishing.lines[player] = line;
  sim.touch('place');
  sim.emit({ type: 'fish_cast', player, x, y });
}

/** Résultat joué chez le pêcheur: accepté seulement si l'hôte le retrouve en rejouant. */
function result(
  sim: SimContext,
  player: PlayerIndex,
  intent: Extract<FishingIntent, { type: 'fish_result' }>,
): void {
  const fishing = placeOf(sim)?.fishing;
  const line = fishing?.lines[player] ?? null;
  // Une pêche à deux se juge ici, chez l'hôte (`fish_net`): aucun résultat n'est attendu.
  if (fishing === undefined || line === null || pairWanted(sim, line)) return;
  if (intent.outcome !== 'landed') {
    endLine(sim, fishing, player, true);
    sim.emit({ type: 'fish_lost', player, reason: intent.outcome });
    return;
  }
  const def = fishOf(sim.content, line.catch);
  const fight = def === null ? null : replayFight(def.fish, line.seed, line.help, intent.log);
  const elapsed = (sim.world.tick - line.tick) * SIM_DT;
  if (
    def === null ||
    fight?.outcome !== 'landed' ||
    judgeStrike(biteSchedule(line.seed, def.fish), line.approach, intent.strike, line.help) !==
      'hooked' ||
    elapsed + FISHING.timingSlack < intent.strike + fightSeconds(fight)
  ) {
    endLine(sim, fishing, player, true);
    sim.emit({ type: 'fish_lost', player, reason: 'invalid' });
    return;
  }
  land(sim, fishing, player, line, def, fight.outside);
}

/** Cette ligne se joue-t-elle à deux ? (prise unique `crew: "pair"`.) */
function pairWanted(sim: SimContext, line: DeepReadonly<FishingLine>): boolean {
  return uniqueOf(sim.content, line.catch)?.unique.crew === 'pair';
}

function land(
  sim: SimContext,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  line: FishingLine,
  def: NonNullable<ReturnType<typeof fishOf>>,
  outside: number,
): void {
  const mods = modifiersOf(sim.content, sim.world, player);
  const random = createRandom(deriveSeed(line.seed, 'prise'));
  // Les grandes tailles sont rares; la chance (`rareLuck`) les rapproche.
  const share = Math.pow(random.next(), 1.6 / Math.max(1, mods.rareLuck));
  const { min, max } = def.fish.sizeCm;
  const sizeMm = Math.max(1, Math.round((min + (Math.max(max, min) - min) * share) * 10));
  const unique = def.unique;
  // Une prise unique ne se double pas.
  const count = unique === undefined && random.chance(mods.extraCatch) ? 2 : 1;
  const me = sim.world.players[player].body;
  const mate = sim.world.players[player === 0 ? 1 : 0].body;
  const together =
    line.pair !== undefined || Math.hypot(me.x - mate.x, me.y - mate.y) <= FISHING.together.radius;
  const quality = Math.min(
    FISHING.quality.max,
    1 + (outside <= FISHING.quality.cleanSeconds ? 1 : 0) + (together ? 1 : 0),
  );

  const progress = sim.world.progress;
  // Une seule source des espèces vues: l'album des collections (taille en cm pour son record).
  // Une prise unique n'est pas une espèce: ni carnet ni record, son fait la retient.
  const isNew = unique === undefined && progress.album?.f[def.id] === undefined;
  let record = false;
  if (unique === undefined) {
    recordFind(sim, player, def.id, sizeMm / 10);
    const key = recordKey(player, def.id);
    const previous = progress.memory[key]?.v;
    record = typeof previous !== 'number' || sizeMm > previous;
    if (record) progress.memory[key] = { v: sizeMm, by: player, day: sim.world.common.day };
    if (isNew || record) sim.touch('progress');
  } else remember(sim, unique.fact, true, unique.crew === 'pair' ? 'duo' : player);
  noteFirstCatch(sim, player, def.id);

  const rod = heldRod(sim.content, sim.world, player);
  if (rod !== null) for (let i = 0; i < FISHING.wearPerCatch; i++) wearTool(sim, player, rod.slot);
  endLine(sim, fishing, player, true);
  if (unique?.toBag !== false) giveItem(sim, player, def.item, count);
  sim.emit({
    type: 'fish_caught',
    player,
    catch: def.id,
    sizeMm,
    quality,
    count,
    isNew,
    record,
    together,
    big: unique !== undefined || share >= FISHING.bigShare,
  });
}

/** La touche d'une pêche à deux: l'hôte la ferre lui-même au plongeon du bouchon. */
function hookPair(sim: SimContext, player: PlayerIndex, line: FishingLine): void {
  line.hooked = true;
  const netter: PlayerIndex = player === 0 ? 1 : 0;
  line.pair = {
    netter,
    since: sim.world.tick,
    held: 0,
    down: false,
    tired: null,
    misses: 0,
    // Chacun son aide: la canne tient moins longtemps, l'épuisette voit la remontée plus longtemps.
    rodAid: assistFactor(sim.world, player),
    netAid: assistFactor(sim.world, netter),
  };
  eatBait(sim, player, line);
  sim.touch('place');
  sim.emit({ type: 'fish_hooked', player });
}

/** Un pas d'une ligne à deux; rend vrai si la ligne est finie. */
function stepPairLine(
  sim: SimContext,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  line: FishingLine,
): boolean {
  const def = fishOf(sim.content, line.catch);
  if (def === null) return false;
  const pair = line.pair;
  if (pair === undefined) {
    const elapsed = (sim.world.tick - line.tick) * SIM_DT;
    const plunge = biteSchedule(line.seed, def.fish).at(-1)?.at ?? 0;
    if (elapsed >= line.approach + plunge) hookPair(sim, player, line);
    return false;
  }
  const { changed, escaped } = stepPair(line, pair, sim.world.tick);
  if (changed) sim.touch('place');
  const netter = sim.world.players[pair.netter].body;
  const gone = Math.hypot(netter.x - line.stanceX, netter.y - line.stanceY) > FISHING.pair.radius;
  if (!escaped && !gone) return false;
  endLine(sim, fishing, player, true);
  sim.emit({ type: 'fish_lost', player, reason: 'escaped' });
  return true;
}

/** Plongeon d'épuisette de `netter` sur la ligne de l'autre joueur. */
function plungeNet(sim: SimContext, netter: PlayerIndex, at: Lane): void {
  const fishing = placeOf(sim)?.fishing;
  const angler: PlayerIndex = netter === 0 ? 1 : 0;
  const line = fishing?.lines[angler] ?? null;
  const pair = line?.pair;
  if (fishing === undefined || line === null || pair?.netter !== netter) return;
  const verdict = judgeNet(line, pair, sim.world.tick, at);
  if (verdict === 'landed') {
    const def = fishOf(sim.content, line.catch);
    if (def !== null) land(sim, fishing, angler, line, def, pair.misses);
    return;
  }
  missNet(pair);
  sim.touch('place');
  sim.emit({ type: 'fish_net_missed', player: netter, reason: verdict });
}

export const fishingSystem: GameSystem = {
  id: 'peche',
  intent(sim, player, intent) {
    if (intent.type === 'fish_cast') cast(sim, player, intent.x, intent.y, intent.bait);
    else if (intent.type === 'fish_result') result(sim, player, intent);
    else if (intent.type === 'fish_hooked') {
      const fishing = placeOf(sim)?.fishing;
      const line = fishing?.lines[player] ?? null;
      // À deux, c'est l'hôte qui ferre (`hookPair`).
      if (line === null || line.hooked || pairWanted(sim, line)) return;
      line.hooked = true;
      eatBait(sim, player, line);
      sim.touch('place');
      sim.emit({ type: 'fish_hooked', player });
    } else if (intent.type === 'fish_hold') {
      const pair = placeOf(sim)?.fishing?.lines[player]?.pair;
      if (pair === undefined || pair.down === intent.down) return;
      pair.down = intent.down;
      sim.touch('place');
    } else if (intent.type === 'fish_net') {
      plungeNet(sim, player, intent.lane);
    } else if (intent.type === 'fish_cancel') {
      const fishing = placeOf(sim)?.fishing;
      if (fishing === undefined || fishing.lines[player] === null) return;
      endLine(sim, fishing, player, false);
      sim.emit({ type: 'fish_lost', player, reason: 'cancelled' });
    }
  },
  step(sim) {
    const place = placeOf(sim);
    if (
      place === null ||
      (sim.content.places[sim.world.common.place]?.def.fishing ?? []).length === 0
    )
      return;
    const fishing = fishingOf(sim);
    if (fishing === null) return;
    // Les ombres parties d'une vague passée ne servent plus.
    const wave = String(waveOf(sim.world.common.day, sim.world.minutes));
    if (fishing.taken.some((id) => !id.startsWith(`${wave}-`))) {
      fishing.taken = fishing.taken.filter((id) => id.startsWith(`${wave}-`));
      sim.touch('place');
    }
    for (const player of [0, 1] as const) {
      const line = fishing.lines[player];
      if (line === null) continue;
      const body = sim.world.players[player].body;
      const def = fishOf(sim.content, line.catch);
      const moved = Math.hypot(body.x - line.stanceX, body.y - line.stanceY) > 1;
      const spot = spotById(sim.content, sim.world, line.spot);
      if (pairWanted(sim, line) && stepPairLine(sim, fishing, player, line)) continue;
      // Filet de sécurité: un résultat qui n'arrive jamais (machine partie) range la ligne.
      const fightLimit = pairWanted(sim, line) ? FISHING.pair.maxSeconds : FISHING.fight.maxSeconds;
      const limit =
        def === null
          ? 0
          : strikeDeadline(biteSchedule(line.seed, def.fish), line.approach, line.help) +
            fightLimit +
            10;
      const late = (sim.world.tick - line.tick) * SIM_DT > limit;
      if (moved || spot === null || heldRod(sim.content, sim.world, player) === null || late) {
        endLine(sim, fishing, player, false);
        sim.emit({ type: 'fish_lost', player, reason: 'cancelled' });
      }
    }
  },
};
