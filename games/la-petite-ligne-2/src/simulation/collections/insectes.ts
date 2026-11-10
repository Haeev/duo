/**
 * Insectes au filet (cahier 4.7): ils se posent dans les zones de terrain du lieu (`nature.json`)
 * selon l'heure, la météo et la saison de leur espèce; un joueur qui court près d'eux les fait
 * s'envoler; un coup de filet devant soi, filet en main, attrape le plus proche. L'état ne garde
 * que le point de pose: le vol autour (`wander`) et l'envol (`insect_fled`) se jouent au rendu.
 */
import type { InsectDef, InsectState, InsectsState } from '../../donnees/schemas/collections';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PlaceState } from '../../etat/lieu';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Content } from '../../donnees/charger';
import type { SimContext } from '../noyau/systemes';
import { calendarOf, minutesSinceDawn } from '../monde/calendrier';
import { giveItem } from '../sac/actions';
import { wearTool } from '../sac/outils';
import { boostedWeight, rarityMet, recordFind } from './registre';
import { heldToolKind, inCone } from './visee';

/** L'espèce peut être là maintenant, dans ce lieu et sur ce terrain. */
export function insectEligible(
  content: Content,
  world: ReadonlyWorld,
  insect: InsectDef,
  place: string,
  terrain: string,
): boolean {
  return (
    insect.places.includes(place) &&
    insect.terrains.includes(terrain) &&
    rarityMet(
      insect.rarity,
      world.minutes,
      world.common.weather,
      calendarOf(content, world.common.day).season,
    )
  );
}

function absoluteMinute(sim: SimContext): number {
  return sim.world.common.day * 1440 + minutesSinceDawn(sim.content, sim.world.minutes);
}

function stateOf(sim: SimContext, place: PlaceState): InsectsState {
  place.insects ??= { list: [], next: 0, at: absoluteMinute(sim) };
  return place.insects;
}

function pickSpecies(sim: SimContext, place: string, terrain: string): InsectDef | null {
  const options = Object.values(sim.content.book.insects).filter((i) =>
    insectEligible(sim.content, sim.world, i, place, terrain),
  );
  let total = 0;
  const weights = options.map((i) => {
    const w = boostedWeight(sim, i.entry, i.weight);
    total += w;
    return w;
  });
  let roll = sim.random.next() * total;
  for (let i = 0; i < options.length; i++) {
    const w = weights[i] ?? 0;
    if (roll < w) return options[i] ?? null;
    roll -= w;
  }
  return null;
}

function remove(sim: SimContext, state: InsectsState, insect: InsectState): void {
  state.list.splice(state.list.indexOf(insect), 1);
  sim.touch('place');
}

/** Un pas: départs (hors de leurs conditions), envols (joueur qui court), apparitions. */
export function stepInsects(sim: SimContext, place: PlaceState): void {
  const { content, world } = sim;
  const placeId = world.common.place;
  const zones = content.book.nature[placeId]?.zones ?? [];
  if (zones.length === 0 && place.insects === undefined) return;
  const state = stateOf(sim, place);
  const terrainOf = new Map(zones.map((z) => [z.id, z.terrain]));

  for (const insect of [...state.list]) {
    const def = content.book.insects[insect.s];
    const terrain = terrainOf.get(insect.z);
    if (
      def === undefined ||
      terrain === undefined ||
      !insectEligible(content, world, def, placeId, terrain)
    ) {
      remove(sim, state, insect);
      continue;
    }
    for (const player of world.players) {
      const dx = insect.x - player.body.x;
      const dy = insect.y - player.body.y;
      const distance = Math.hypot(dx, dy);
      if (player.body.speed <= content.time.file.insects.runThreshold || distance > def.alertRadius)
        continue;
      remove(sim, state, insect);
      const norm = distance > 0 ? distance : 1;
      sim.emit({
        type: 'insect_fled',
        id: insect.id,
        insect: insect.s,
        x: insect.x,
        y: insect.y,
        dx: dx / norm,
        dy: dy / norm,
        speed: def.fleeSpeed,
      });
      break;
    }
  }

  const { spawnEveryMinutes, spawnChance } = content.time.file.insects;
  const now = absoluteMinute(sim);
  if (now - state.at < spawnEveryMinutes) return;
  state.at = now;
  sim.touch('place');
  for (const zone of zones) {
    const count = state.list.filter((i) => i.z === zone.id).length;
    if (count >= zone.max || sim.random.next() >= spawnChance) continue;
    const species = pickSpecies(sim, placeId, zone.terrain);
    if (species === null) continue;
    state.list.push({
      id: state.next,
      s: species.id,
      z: zone.id,
      x: zone.area.x + sim.random.next() * zone.area.w,
      y: zone.area.y + sim.random.next() * zone.area.h,
    });
    state.next += 1;
  }
}

/** Coup de filet devant soi. Renvoie l'espèce prise, `null` si le filet passe à côté (ou s'il n'est pas en main). */
export function swingNet(sim: SimContext, player: PlayerIndex, place: PlaceState): string | null {
  const actor = sim.world.players[player];
  if (heldToolKind(sim.content, actor) !== 'net') return null;
  const { netReach, netHalfAngleDeg } = sim.content.time.file.insects;
  const list = place.insects?.list ?? [];
  let best: InsectState | null = null;
  let bestDistance = Infinity;
  for (const insect of list) {
    const distance = inCone(actor.body, insect.x, insect.y, netReach, netHalfAngleDeg);
    if (distance !== null && distance < bestDistance) {
      best = insect;
      bestDistance = distance;
    }
  }
  if (actor.selected !== null) wearTool(sim, player, actor.selected);
  const caught = best === null ? null : (sim.content.book.insects[best.s] ?? null);
  sim.emit({ type: 'net_swung', player, insect: caught?.id ?? null });
  if (best === null || caught === null || place.insects === undefined) return null;
  remove(sim, place.insects, best);
  if (caught.item !== null) giveItem(sim, player, caught.item, 1);
  recordFind(sim, player, caught.entry);
  return caught.id;
}
