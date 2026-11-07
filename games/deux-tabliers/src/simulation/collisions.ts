// Obstacles des joueurs: la coque (plan du level designer) et les meubles posés.
import type { Content } from '../donnees/charger';
import type { PlanElement } from '../donnees/schemas';
import type { World } from '../etat/monde';
import { box, type Obstacle } from './geometrie';

/** Éléments du plan qui arrêtent un joueur (les meubles du plan viennent de `departs/`). */
const SHELL_KINDS = new Set(['wall', 'partition', 'window', 'fixture', 'tree', 'door']);

function isShellObstacle(el: PlanElement): boolean {
  if (!SHELL_KINDS.has(el.kind)) return false;
  if (el.kind === 'door') return el.access === 'closed';
  return el.blocks;
}

function elementObstacle(el: PlanElement): Obstacle {
  if ('rect' in el.shape) {
    const [x, z, w, d] = el.shape.rect;
    return box(x + w / 2, z + d / 2, w, d, 0);
  }
  const [x, z, r] = el.shape.circle;
  return { kind: 'disc', x, z, r };
}

const shellCache = new WeakMap<Content, readonly Obstacle[]>();

export function shellObstacles(content: Content): readonly Obstacle[] {
  const cached = shellCache.get(content);
  if (cached !== undefined) return cached;
  const level = content.plan.levels[0];
  const list = (level?.elements ?? []).filter(isShellObstacle).map(elementObstacle);
  // Cadre du plan: on ne sort pas de la carte.
  if (level !== undefined) {
    const [fx, fz, fw, fd] = level.frame;
    const t = 1;
    list.push(
      box(fx + fw / 2, fz - t / 2, fw + 2 * t, t, 0),
      box(fx + fw / 2, fz + fd + t / 2, fw + 2 * t, t, 0),
    );
    list.push(box(fx - t / 2, fz + fd / 2, t, fd, 0), box(fx + fw + t / 2, fz + fd / 2, t, fd, 0));
  }
  shellCache.set(content, list);
  return list;
}

interface FurnitureCache {
  key: number;
  list: readonly Obstacle[];
}
const furnitureCache = new WeakMap<World['furniture'], FurnitureCache>();

/** Empreinte bon marché de l'aménagement: on ne reconstruit que si un meuble a bougé. */
function furnitureKey(world: World): number {
  let key = world.furniture.length;
  for (const f of world.furniture) key = (key * 31 + f.x * 1000 + f.z * 7919 + f.rotDeg) % 1e9;
  return key;
}

export function furnitureObstacles(content: Content, world: World): readonly Obstacle[] {
  const key = furnitureKey(world);
  const cached = furnitureCache.get(world.furniture);
  if (cached?.key === key) return cached.list;
  const list: Obstacle[] = [];
  for (const f of world.furniture) {
    const type = content.furniture.get(f.type);
    if (type?.blocks !== true) continue;
    list.push(box(f.x, f.z, type.footprint[0], type.footprint[1], f.rotDeg));
  }
  furnitureCache.set(world.furniture, { key, list });
  return list;
}
