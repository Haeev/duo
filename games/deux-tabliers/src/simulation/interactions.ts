/**
 * Cadre d'interaction (technique 5.5): une main, un objet tenu (un plateau en porte plusieurs),
 * prendre, poser sur un emplacement déclaré, donner à l'autre, utiliser un poste.
 * `planAct` est pur: l'invite de chaque machine s'en sert pour nommer l'action, l'hôte le
 * recalcule sur son état au moment d'exécuter (premier arrivé chez l'hôte l'emporte).
 */
import type { Content } from '../donnees/charger';
import type { ObjectState, PlayerIndex, World } from '../etat/monde';
import type { Target } from './entrees';
import { seatTaken } from './assise';
import {
  furnitureById,
  furnitureType,
  heldObject,
  objectById,
  objectOnSlot,
  objectsOnTray,
  objectPosition,
} from './monde';

export type ActPlan =
  | { readonly kind: 'take'; readonly object: number }
  | {
      readonly kind: 'take-to-tray';
      readonly object: number;
      readonly tray: number;
      readonly place: number;
    }
  | {
      readonly kind: 'take-source';
      readonly furniture: string;
      readonly objectType: string;
      readonly tray: number | null;
      readonly place: number;
    }
  | {
      readonly kind: 'place';
      readonly object: number;
      readonly furniture: string;
      readonly slot: string;
    }
  | { readonly kind: 'give'; readonly object: number; readonly to: PlayerIndex }
  | { readonly kind: 'use'; readonly furniture: string; readonly station: string }
  | { readonly kind: 'sit'; readonly furniture: string }
  | { readonly kind: 'refuse'; readonly reason: string };

export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);

function freeTrayPlace(content: Content, world: World, tray: ObjectState): number | null {
  const places = content.objects.get(tray.type)?.tray?.places ?? 0;
  const used = new Set(
    objectsOnTray(world, tray.id).map((o) => (o.at.kind === 'tray' ? o.at.place : -1)),
  );
  for (let i = 0; i < places; i++) if (!used.has(i)) return i;
  return null;
}

function isTray(content: Content, object: ObjectState): boolean {
  return (content.objects.get(object.type)?.tray ?? null) !== null;
}

/** Ce que ferait « Agir » sur la cible. */
export function planAct(
  content: Content,
  world: World,
  player: PlayerIndex,
  target: Target,
): ActPlan {
  const held = heldObject(world, player);
  const heldTray = held !== undefined && isTray(content, held) ? held : undefined;
  switch (target.kind) {
    case 'object': {
      const object = objectById(world, target.id);
      if (object === undefined) return { kind: 'refuse', reason: 'Plus là' };
      if (object.at.kind === 'hand') return { kind: 'refuse', reason: 'Déjà pris' };
      if (object.at.kind === 'tray' && object.at.tray === heldTray?.id) {
        return { kind: 'refuse', reason: 'Déjà sur ton plateau' };
      }
      if (held === undefined) return { kind: 'take', object: object.id };
      if (heldTray !== undefined && !isTray(content, object)) {
        const place = freeTrayPlace(content, world, heldTray);
        if (place !== null)
          return { kind: 'take-to-tray', object: object.id, tray: heldTray.id, place };
        return { kind: 'refuse', reason: 'Plateau plein' };
      }
      return { kind: 'refuse', reason: 'Tes mains sont prises' };
    }
    case 'source': {
      const placed = furnitureById(world, target.furniture);
      const source = placed === undefined ? null : furnitureType(content, placed).source;
      if (source === null) return { kind: 'refuse', reason: 'Rien à prendre' };
      if (held === undefined)
        return {
          kind: 'take-source',
          furniture: target.furniture,
          objectType: source,
          tray: null,
          place: 0,
        };
      if (heldTray !== undefined) {
        const place = freeTrayPlace(content, world, heldTray);
        if (place !== null)
          return {
            kind: 'take-source',
            furniture: target.furniture,
            objectType: source,
            tray: heldTray.id,
            place,
          };
        return { kind: 'refuse', reason: 'Plateau plein' };
      }
      return { kind: 'refuse', reason: 'Tes mains sont prises' };
    }
    case 'slot': {
      if (objectOnSlot(world, target.furniture, target.slot) !== undefined)
        return { kind: 'refuse', reason: 'Place prise' };
      if (held === undefined) return { kind: 'refuse', reason: 'Rien en main' };
      // Plateau garni: « Agir » pose le dernier objet du plateau; « Reposer » pose le plateau.
      const onTray = heldTray === undefined ? [] : objectsOnTray(world, heldTray.id);
      const last = onTray[onTray.length - 1];
      const object = last ?? held;
      return { kind: 'place', object: object.id, furniture: target.furniture, slot: target.slot };
    }
    case 'station': {
      const placed = furnitureById(world, target.furniture);
      const station = placed === undefined ? null : furnitureType(content, placed).station;
      const type = station === null ? undefined : content.stations.get(station);
      if (type === undefined || station === null)
        return { kind: 'refuse', reason: 'Rien à faire ici' };
      const busy = world.players.findIndex(
        (p, i) => i !== player && p.use?.furniture === target.furniture,
      );
      if (busy >= 0) return { kind: 'refuse', reason: 'Poste occupé' };
      const onSlot = objectOnSlot(world, target.furniture, type.slot);
      if (
        type.transforms.length > 0 &&
        (onSlot === undefined || !type.transforms.some((t) => t.from === onSlot.type))
      ) {
        const wanted =
          content.objects.get(type.transforms[0]?.from ?? '')?.label.toLowerCase() ?? 'un objet';
        return { kind: 'refuse', reason: `Pose d'abord : ${wanted}` };
      }
      return { kind: 'use', furniture: target.furniture, station };
    }
    case 'seat': {
      const placed = furnitureById(world, target.furniture);
      if (placed === undefined || furnitureType(content, placed).kind !== 'seat')
        return { kind: 'refuse', reason: 'Rien à faire ici' };
      if (seatTaken(world, target.furniture, player))
        return { kind: 'refuse', reason: 'Place prise' };
      if (held !== undefined) return { kind: 'refuse', reason: 'Tes mains sont prises' };
      if (world.players[player].seat === target.furniture)
        return { kind: 'refuse', reason: 'Tu y es assis' };
      return { kind: 'sit', furniture: target.furniture };
    }
    case 'player': {
      if (target.player === player) return { kind: 'refuse', reason: 'Rien à faire' };
      if (held === undefined) return { kind: 'refuse', reason: 'Rien à donner' };
      if (heldObject(world, target.player) !== undefined)
        return { kind: 'refuse', reason: 'Ses mains sont prises' };
      return { kind: 'give', object: held.id, to: target.player };
    }
  }
}

/** Ce que ferait « Reposer » (R, clic droit): l'objet tenu entier, plateau compris. */
export function planDrop(world: World, player: PlayerIndex, target: Target): ActPlan {
  const held = heldObject(world, player);
  if (held === undefined) return { kind: 'refuse', reason: 'Rien en main' };
  if (target.kind !== 'slot') return { kind: 'refuse', reason: 'Vise une place libre' };
  if (objectOnSlot(world, target.furniture, target.slot) !== undefined)
    return { kind: 'refuse', reason: 'Place prise' };
  return { kind: 'place', object: held.id, furniture: target.furniture, slot: target.slot };
}

/** Texte de l'invite (« Prendre : Tasse »). */
export function planLabel(content: Content, world: World, plan: ActPlan): string {
  const name = (id: number): string => {
    const o = objectById(world, id);
    return o === undefined ? '' : (content.objects.get(o.type)?.label ?? o.type);
  };
  switch (plan.kind) {
    case 'take':
    case 'take-to-tray':
      return `Prendre : ${name(plan.object)}`;
    case 'take-source':
      return `Prendre : ${content.objects.get(plan.objectType)?.label ?? plan.objectType}`;
    case 'place':
      return `Poser : ${name(plan.object)}`;
    case 'give':
      return `Donner : ${name(plan.object)}`;
    case 'use':
      return content.stations.get(plan.station)?.verb ?? 'Utiliser';
    case 'sit':
      return "S'asseoir";
    case 'refuse':
      return plan.reason;
  }
}

/** Distance des yeux au point de la cible, ou `null` si la cible n'existe plus. */
export function targetDistance(
  content: Content,
  world: World,
  player: PlayerIndex,
  target: Target,
): number | null {
  const p = world.players[player];
  const eye = content.settings.player.eyeHeight;
  let x: number;
  let y: number;
  let z: number;
  if (target.kind === 'object') {
    const o = objectById(world, target.id);
    const pos = o === undefined ? null : objectPosition(content, world, o);
    if (pos === null) return null;
    ({ x, y, z } = pos);
  } else if (target.kind === 'player') {
    const q = world.players[target.player];
    x = q.x;
    y = 1.2;
    z = q.z;
  } else {
    const placed = furnitureById(world, target.furniture);
    if (placed === undefined) return null;
    x = placed.x;
    z = placed.z;
    // Les emplacements et les meubles se mesurent au bord de l'empreinte: un comptoir profond
    // reste à portée de main.
    const type = furnitureType(content, placed);
    const half = Math.max(type.footprint[0], type.footprint[1]) / 2;
    return Math.max(0, Math.hypot(x - p.x, z - p.z) - half);
  }
  return Math.hypot(x - p.x, y - eye, z - p.z);
}
