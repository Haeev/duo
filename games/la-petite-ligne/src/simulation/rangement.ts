/**
 * Rangement de la nuit (QA8-02, taille de l'état I-06). À partir de `tidy.fromDay`, ce qui traîne
 * par terre rentre au coffre de la maisonnette pendant la nuit, comme un duo qui ramasse ses
 * affaires avant d'aller se coucher: un sac plein ne sème plus des tas qui restent des semaines
 * (et grossissent la sauvegarde sans limite). Restent dehors les objets qui ont leur place au sol:
 * ceux de l'histoire (catégorie `quest`, posés par les quêtes), les œufs au poulailler (on les
 * ramasse le matin) et les cueillettes à leur coin de la lisière (le coin ne se regarnit pas tant
 * qu'elles y sont).
 */
import type { GroundItem } from '../etat/types';
import { type Sim, distance, notifyKey, point } from './contexte';
import { ITEM, POINT } from './ids';
import { FORAGE_CORNER_RADIUS } from './lisiere';
import { addStack } from './sac';

/** Où les poules pondent (même décalage que `morningEggs`). */
const EGG_OFFSET = { x: 0.5, y: -0.6 };
/** Un œuf à moins de cette distance du nid est encore au poulailler (m). */
const NEST_RADIUS = 0.5;

function staysOnGround(sim: Sim, g: GroundItem): boolean {
  const def = sim.content.items[g.item];
  if (def?.category === 'quest') return true;
  if (g.item === ITEM.egg) {
    const coop = point(sim, POINT.chickenCoop);
    return distance(g.pos, { x: coop.x + EGG_OFFSET.x, y: coop.y + EGG_OFFSET.y }) <= NEST_RADIUS;
  }
  if (def?.category === 'forage') {
    const corners = sim.content.settings.forage?.points ?? [];
    return corners.some((p) => {
      const at = sim.map.points[p.point];
      return at !== undefined && distance(g.pos, at) <= FORAGE_CORNER_RADIUS;
    });
  }
  return false;
}

/** La nuit: les piles qui traînent rentrent au coffre (qualités gardées), un mot au petit-déjeuner. */
export function tidyGround(sim: Sim): void {
  const from = sim.content.settings.tidy.fromDay;
  const { world } = sim;
  if (from === null || world.clock.day < from) return;
  const kept: GroundItem[] = [];
  let moved = false;
  for (const g of world.groundItems) {
    if (staysOnGround(sim, g)) {
      kept.push(g);
      continue;
    }
    addStack(world.cellar, g.item, g.quality, g.count);
    moved = true;
  }
  if (!moved) return;
  world.groundItems = kept;
  sim.runtime.changed = true;
  notifyKey(sim, 'both', 'message', 'ground_tidied', {});
}
