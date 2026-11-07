// Création du monde et lectures communes (positions des objets, emplacements, main d'un joueur).
import type { Content } from '../donnees/charger';
import type { FurnitureType, Slot } from '../donnees/schemas';
import { createArrangementState } from '../amenagement/etat';
import { createClienteleState } from '../clientele/etat';
import { createServiceState } from '../service/etat';
import type { ObjectState, PlacedFurniture, PlayerIndex, World } from '../etat/monde';
import { localToWorld } from './geometrie';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function createWorld(content: Content, memberIds: readonly [string, string]): World {
  const { start } = content;
  const players = ([0, 1] as const).map((i) => ({
    memberId: memberIds[i],
    x: start.spawns[i][0],
    z: start.spawns[i][1],
    // Les deux commencent derrière le comptoir, face à la salle (sud).
    yawDeg: 180,
    pitchDeg: -10,
    use: null,
  }));
  const [host, guest] = players;
  if (host === undefined || guest === undefined) throw new Error('deux joueurs attendus');
  const objects: ObjectState[] = start.objects.map((o, id) => ({
    id,
    type: o.type,
    at: { kind: 'slot', furniture: o.furniture, slot: o.slot },
  }));
  return {
    tick: 0,
    address: start.address,
    players: [host, guest],
    objects,
    nextObjectId: objects.length,
    furniture: start.furniture.map((f) => ({ ...f })),
    service: createServiceState(),
    clientele: createClienteleState(),
    arrangement: createArrangementState(),
  };
}

export function furnitureById(world: World, id: string): PlacedFurniture | undefined {
  return world.furniture.find((f) => f.id === id);
}

export function furnitureType(content: Content, placed: PlacedFurniture): FurnitureType {
  const type = content.furniture.get(placed.type);
  if (type === undefined) throw new Error(`meuble inconnu ${placed.type}`);
  return type;
}

export function objectById(world: World, id: number): ObjectState | undefined {
  return world.objects.find((o) => o.id === id);
}

/** Objet tenu en main (un seul: une main, technique 5.5). */
export function heldObject(world: World, player: PlayerIndex): ObjectState | undefined {
  return world.objects.find((o) => o.at.kind === 'hand' && o.at.player === player);
}

export function objectOnSlot(
  world: World,
  furniture: string,
  slot: string,
): ObjectState | undefined {
  return world.objects.find(
    (o) => o.at.kind === 'slot' && o.at.furniture === furniture && o.at.slot === slot,
  );
}

export function objectsOnTray(world: World, tray: number): ObjectState[] {
  return world.objects.filter((o) => o.at.kind === 'tray' && o.at.tray === tray);
}

/** Position du dessus d'un emplacement, dans le monde. */
export function slotPosition(placed: PlacedFurniture, slot: Slot): Vec3 {
  const p = localToWorld(placed.x, placed.z, placed.rotDeg, slot.x, slot.z);
  return { x: p.x, y: placed.y + slot.y, z: p.z };
}

/** Position de la base d'un objet dans le monde (main: devant le joueur, à hauteur de taille). */
export function objectPosition(
  content: Content,
  world: World,
  object: ObjectState,
  depth = 0,
): Vec3 | null {
  const at = object.at;
  if (at.kind === 'hand') {
    const p = world.players[at.player];
    const yaw = (p.yawDeg * Math.PI) / 180;
    return { x: p.x - Math.sin(yaw) * 0.35, y: 1.0, z: p.z - Math.cos(yaw) * 0.35 };
  }
  if (at.kind === 'slot') {
    const placed = furnitureById(world, at.furniture);
    if (placed === undefined) return null;
    const slot = furnitureType(content, placed).slots.find((s) => s.id === at.slot);
    return slot === undefined ? null : slotPosition(placed, slot);
  }
  const tray = objectById(world, at.tray);
  if (tray === undefined || depth > 2) return null;
  const base = objectPosition(content, world, tray, depth + 1);
  if (base === null) return null;
  const trayType = content.objects.get(tray.type);
  const places = trayType?.tray?.places ?? 1;
  const width = trayType?.size[0] ?? 0.3;
  const offset = ((at.place + 0.5) / places - 0.5) * width;
  // Les places s'alignent sur la largeur du plateau: la droite du joueur qui le tient, sinon l'axe x.
  const yaw = tray.at.kind === 'hand' ? (world.players[tray.at.player].yawDeg * Math.PI) / 180 : 0;
  return {
    x: base.x + Math.cos(yaw) * offset,
    y: base.y + (trayType?.size[2] ?? 0.02),
    z: base.z - Math.sin(yaw) * offset,
  };
}
