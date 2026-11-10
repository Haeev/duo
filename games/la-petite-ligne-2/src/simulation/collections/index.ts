/**
 * Système « collections »: inscrit au carnet ce que les autres systèmes donnent (`item_gained`)
 * et les airs entendus (`calendar_started`), fait vivre les insectes, sert le filet et
 * l'appareil photo. Placé après le système du temps du monde dans `SYSTEMS`.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { currentPlace } from '../sac/actions';
import { stepInsects, swingNet } from './insectes';
import { takePhoto } from './photo';
import { recordFind } from './registre';
import { heldToolKind } from './visee';

const byItemCache = new WeakMap<Content, ReadonlyMap<string, string>>();

/** Entrée inscrite par chaque objet (source `item`). */
function entryByItem(content: Content): ReadonlyMap<string, string> {
  let map = byItemCache.get(content);
  if (map === undefined) {
    const built = new Map<string, string>();
    for (const entry of Object.values(content.book.entries))
      if (entry.source.type === 'item') built.set(entry.source.item, entry.id);
    map = built;
    byItemCache.set(content, map);
  }
  return map;
}

function step(sim: SimContext): void {
  const events = sim.events ?? [];
  const count = events.length;
  for (let i = 0; i < count; i++) {
    const event = events[i];
    if (event === undefined) continue;
    if (event.type === 'item_gained') {
      const entry = entryByItem(sim.content).get(event.item);
      if (entry !== undefined) recordFind(sim, event.player, entry);
    } else if (event.type === 'calendar_started') {
      const def = sim.content.time.events[event.place]?.find((e) => e.id === event.event);
      const tune = def?.activates.tune ?? null;
      if (tune !== null) for (const p of [0, 1] as const) recordFind(sim, p, tune);
    }
  }
  if (sim.world.common.phase !== 'day') return;
  const place = currentPlace(sim);
  if (place !== null) stepInsects(sim, place);
}

function intent(sim: SimContext, player: PlayerIndex, intent: Intent): void {
  if (sim.world.common.phase !== 'day') return;
  const place = currentPlace(sim);
  if (place === null) return;
  const actor = sim.world.players[player];
  if (actor.gesture !== null || actor.talk !== null) return;
  let kind: 'net' | 'camera' | null = null;
  if (intent.type === 'net_swing') kind = 'net';
  else if (intent.type === 'photo_take') kind = 'camera';
  else if (intent.type === 'act' && actor.aim === null) {
    const held = heldToolKind(sim.content, actor);
    if (held === 'net' || held === 'camera') kind = held;
  }
  if (kind === 'net') swingNet(sim, player, place);
  else if (kind === 'camera') takePhoto(sim, player, place);
}

export const collectionSystem: GameSystem = { id: 'collections', step, intent };
