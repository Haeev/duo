/**
 * Système « collections »: inscrit au carnet ce que les autres systèmes donnent (`item_gained`),
 * les recettes réussies en cuisine (`dish_cooked`) ou reçues (`reward_given`), et les airs
 * entendus (`calendar_started`), fait vivre les insectes, sert le filet et l'appareil photo.
 * Placé après les systèmes de la cuisine et des quêtes dans `SYSTEMS`.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { Intent } from '../noyau/entrees';
import type { GameSystem, SimContext } from '../noyau/systemes';
import { currentPlace } from '../sac/actions';
import { stepInsects, swingNet } from './insectes';
import { takePhoto } from './photo';
import { isFound, recordFind } from './registre';
import { heldToolKind } from './visee';

interface SourceIndex {
  /** Entrée inscrite par chaque objet (source `item`). */
  readonly byItem: ReadonlyMap<string, string>;
  /** Entrée inscrite par chaque recette (source `recipe`). */
  readonly byRecipe: ReadonlyMap<string, string>;
}

const sourceCache = new WeakMap<Content, SourceIndex>();

function sourcesOf(content: Content): SourceIndex {
  let index = sourceCache.get(content);
  if (index === undefined) {
    const byItem = new Map<string, string>();
    const byRecipe = new Map<string, string>();
    for (const entry of Object.values(content.book.entries))
      if (entry.source.type === 'item') byItem.set(entry.source.item, entry.id);
      else if (entry.source.type === 'recipe') byRecipe.set(entry.source.recipe, entry.id);
    index = { byItem, byRecipe };
    sourceCache.set(content, index);
  }
  return index;
}

function step(sim: SimContext): void {
  const events = sim.events ?? [];
  const count = events.length;
  for (let i = 0; i < count; i++) {
    const event = events[i];
    if (event === undefined) continue;
    if (event.type === 'item_gained') {
      const entry = sourcesOf(sim.content).byItem.get(event.item);
      if (entry !== undefined) recordFind(sim, event.player, entry);
    } else if (event.type === 'dish_cooked') {
      // Première réussite de ce joueur: une seule inscription, les suivantes ne comptent pas.
      const entry = sourcesOf(sim.content).byRecipe.get(event.recipe);
      const counts = entry === undefined ? undefined : sim.world.progress.album?.f[entry];
      const mine = counts === undefined || counts[5 + event.player] === 0;
      if (entry !== undefined && mine) recordFind(sim, event.player, entry);
    } else if (event.type === 'reward_given' && event.kind === 'recipe') {
      const entry = sourcesOf(sim.content).byRecipe.get(event.id);
      if (entry !== undefined && !isFound(sim.world, entry)) recordFind(sim, event.by, entry);
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
