/**
 * Système de la pêche, chez l'hôte (conception: `docs/jeux/jeu-1/refonte/peche.md`). Il tient
 * la graine des ombres, accepte les lancers (l'ombre qui viendra, la graine de la touche et du
 * combat), puis valide le résultat joué chez le pêcheur en rejouant son journal de touches.
 */
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
  if (scare && !fishing.taken.includes(line.shadow)) fishing.taken.push(line.shadow);
  fishing.lines[player] = null;
  sim.touch('place');
}

/** L'ombre qui viendra au bouchon: la plus proche à portée de touche (la plus rare si la chance sourit), sinon la plus proche. */
function chooseShadow(
  sim: SimContext,
  spot: FishingSpot,
  fishing: FishingPlaceState,
  player: PlayerIndex,
  x: number,
  y: number,
): { shadow: Shadow; distance: number } | null {
  const other = fishing.lines[player === 0 ? 1 : 0];
  const seconds = gameSeconds(sim.content, sim.world.common.day, sim.world.minutes);
  const at = { x: 0, y: 0 };
  const near: { shadow: Shadow; distance: number; rarity: number }[] = [];
  let best: { shadow: Shadow; distance: number } | null = null;
  const order = { common: 0, uncommon: 1, rare: 2 } as const;
  for (const shadow of shadowsNow(sim.content, sim.world, spot)) {
    if (other !== null && other.spot === spot.id && other.shadow === shadow.id) continue;
    shadowPosition(shadow, seconds, at);
    const distance = Math.hypot(at.x - x, at.y - y);
    const def = fishOf(sim.content, shadow.catch);
    if (distance <= FISHING.biteRadius)
      near.push({ shadow, distance, rarity: def === null ? 0 : order[def.rarity] });
    if (best === null || distance < best.distance) best = { shadow, distance };
  }
  if (near.length > 0) {
    const lucky = modifiersOf(sim.content, sim.world, player).rareLuck > 1;
    near.sort((a, b) => (lucky ? b.rarity - a.rarity : 0) || a.distance - b.distance);
    const first = near[0];
    if (first !== undefined) return { shadow: first.shadow, distance: first.distance };
  }
  return best;
}

function cast(sim: SimContext, player: PlayerIndex, x: number, y: number): void {
  const fishing = fishingOf(sim);
  if (fishing?.lines[player] !== null) return;
  const body = sim.world.players[player].body;
  const spot = spotInFront(sim.content, sim.world, player);
  const help = helpOf(sim.content, sim.world, player);
  const chosen =
    spot === null || !insideSpot(spot, x, y)
      ? null
      : chooseShadow(sim, spot, fishing, player, x, y);
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
  if (fishing === undefined || line === null) return;
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
  const count = random.chance(mods.extraCatch) ? 2 : 1;
  const me = sim.world.players[player].body;
  const mate = sim.world.players[player === 0 ? 1 : 0].body;
  const together = Math.hypot(me.x - mate.x, me.y - mate.y) <= FISHING.together.radius;
  const quality = Math.min(
    FISHING.quality.max,
    1 + (outside <= FISHING.quality.cleanSeconds ? 1 : 0) + (together ? 1 : 0),
  );

  const progress = sim.world.progress;
  const seen = (progress.collections[FISHING.collection] ??= []);
  const isNew = !seen.includes(def.id);
  if (isNew) seen.push(def.id);
  const key = recordKey(player, def.id);
  const previous = progress.memory[key]?.v;
  const record = typeof previous !== 'number' || sizeMm > previous;
  if (record) progress.memory[key] = { v: sizeMm, by: player, day: sim.world.common.day };
  if (isNew || record) sim.touch('progress');

  const rod = heldRod(sim.content, sim.world, player);
  if (rod !== null) for (let i = 0; i < FISHING.wearPerCatch; i++) wearTool(sim, player, rod.slot);
  endLine(sim, fishing, player, true);
  giveItem(sim, player, def.item, count);
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
    big: share >= FISHING.bigShare,
  });
}

export const fishingSystem: GameSystem = {
  id: 'peche',
  intent(sim, player, intent) {
    if (intent.type === 'fish_cast') cast(sim, player, intent.x, intent.y);
    else if (intent.type === 'fish_result') result(sim, player, intent);
    else if (intent.type === 'fish_hooked') {
      const fishing = placeOf(sim)?.fishing;
      const line = fishing?.lines[player] ?? null;
      if (line === null || line.hooked) return;
      line.hooked = true;
      sim.touch('place');
      sim.emit({ type: 'fish_hooked', player });
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
      // Filet de sécurité: un résultat qui n'arrive jamais (machine partie) range la ligne.
      const limit =
        def === null
          ? 0
          : strikeDeadline(biteSchedule(line.seed, def.fish), line.approach, line.help) +
            FISHING.fight.maxSeconds +
            10;
      const late = (sim.world.tick - line.tick) * SIM_DT > limit;
      if (moved || spot === null || heldRod(sim.content, sim.world, player) === null || late) {
        endLine(sim, fishing, player, false);
        sim.emit({ type: 'fish_lost', player, reason: 'cancelled' });
      }
    }
  },
};
