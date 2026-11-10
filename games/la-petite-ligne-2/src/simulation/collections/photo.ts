/**
 * Photo (cahier 4.7): l'appareil en main, la touche d'action déclenche. Un sujet valable
 * (`commun/photos/<id>.json`) dans le cadre devient une carte postale du carnet. Le cadre est un
 * cône devant le personnage (`temps.json`, `photo`); à égalité, le sujet le plus près de l'axe.
 */
import type { PhotoSubjectDef } from '../../donnees/schemas/collections';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { PlaceState } from '../../etat/lieu';
import type { SimContext } from '../noyau/systemes';
import { activeEvents } from '../monde/agenda';
import { evaluateAll } from '../regles/conditions';
import { recordFind } from './registre';
import { heldToolKind, inCone, offAxis } from './visee';

/** Positions où se trouve le sujet dans le lieu courant (`[]`: absent; `null`: partout, un événement). */
function positionsOf(
  sim: SimContext,
  place: PlaceState,
  subject: PhotoSubjectDef,
): { x: number; y: number }[] | null {
  const placeId = sim.world.common.place;
  const map = sim.content.places[placeId]?.map;
  const t = subject.target;
  switch (t.type) {
    case 'point': {
      const point = t.place === placeId ? map?.points[t.point] : undefined;
      return point === undefined ? [] : [point];
    }
    case 'object': {
      const object = t.place === placeId ? map?.objects.find((o) => o.id === t.object) : undefined;
      return object === undefined ? [] : [object];
    }
    case 'villager': {
      const villager = place.villagers[t.villager];
      return villager === undefined ? [] : [villager.body];
    }
    case 'insect':
      return (place.insects?.list ?? []).filter((i) => i.s === t.insect);
    case 'event':
      return activeEvents(sim).some((e) => e.id === t.event) ? null : [];
  }
}

/** Déclenche l'appareil. Renvoie le sujet photographié, `null` si rien de valable dans le cadre. */
export function takePhoto(sim: SimContext, player: PlayerIndex, place: PlaceState): string | null {
  const actor = sim.world.players[player];
  if (heldToolKind(sim.content, actor) !== 'camera') return null;
  const { range, halfAngleDeg } = sim.content.time.file.photo;
  let best: PhotoSubjectDef | null = null;
  let bestAxis = Infinity;
  for (const subject of Object.values(sim.content.book.photos)) {
    const positions = positionsOf(sim, place, subject);
    if (positions !== null && positions.length === 0) continue;
    if (!evaluateAll({ world: sim.world, content: sim.content, actor: player }, subject.conditions))
      continue;
    let axis = positions === null ? halfAngleDeg : Infinity;
    for (const p of positions ?? []) {
      if (inCone(actor.body, p.x, p.y, range, halfAngleDeg) === null) continue;
      axis = Math.min(axis, (offAxis(actor.body, p.x, p.y) * 180) / Math.PI);
    }
    if (axis < bestAxis) {
      best = subject;
      bestAxis = axis;
    }
  }
  sim.emit({ type: 'photo_taken', player, subject: best?.id ?? null });
  if (best === null) return null;
  recordFind(sim, player, best.entry);
  return best.id;
}
