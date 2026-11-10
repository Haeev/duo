// Lieux d'essai (lot L8): de quoi essayer chaque brique, un départ lisible, tout atteignable à pied.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { resolveAgreement } from '../src/simulation/dialogues/accords';
import { gameContent } from './aides';

const content: Content = gameContent();
const PLACES = ['essai-gare', 'essai-halte'] as const;

function placeOf(id: string): NonNullable<Content['places'][string]> {
  const place = content.places[id];
  if (place === undefined) throw new Error(id);
  return place;
}

function bricksAt(id: string): Set<string> {
  const found = new Set<string>();
  for (const object of placeOf(id).map.objects)
    for (const brick of content.props[object.type]?.bricks ?? []) found.add(brick.brick);
  return found;
}

/** Cases de 1 m occupées par un meuble solide ou par une zone bloquée. */
function blockedCells(id: string): Set<string> {
  const { map } = placeOf(id);
  const cells = new Set<string>();
  for (const r of map.blocked)
    for (let x = r.x; x < r.x + r.w; x++)
      for (let y = r.y; y < r.y + r.h; y++) cells.add(`${String(x)},${String(y)}`);
  for (const object of map.objects) {
    const prop = content.props[object.type];
    if (!prop?.solid) continue;
    const turned = object.rotation % 2 === 1;
    const w = turned ? prop.size.h : prop.size.w;
    const h = turned ? prop.size.w : prop.size.h;
    for (let x = Math.round(object.x - w / 2); x < Math.round(object.x + w / 2); x++)
      for (let y = Math.round(object.y - h / 2); y < Math.round(object.y + h / 2); y++)
        cells.add(`${String(x)},${String(y)}`);
  }
  return cells;
}

function reachable(id: string): Set<string> {
  const { map, def } = placeOf(id);
  const blocked = blockedCells(id);
  const start = map.points[def.station.arrival];
  if (start === undefined) throw new Error('arrivée');
  const first = `${String(Math.floor(start.x))},${String(Math.floor(start.y))}`;
  const seen = new Set([first]);
  const queue = [first];
  while (queue.length > 0) {
    const [x = 0, y = 0] = (queue.shift() ?? '').split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const key = `${String(x + dx)},${String(y + dy)}`;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      if (blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}

describe('lieux d’essai', () => {
  it.each(PLACES)(
    '%s: un poteau de quai au quai, un banc et un habitant à moins de 6 m de l’arrivée',
    (id) => {
      const place = placeOf(id);
      const { map, def } = place;
      const arrival = map.points[def.station.arrival];
      const quay = map.points[def.station.platform];
      if (arrival === undefined || quay === undefined) throw new Error('points de gare');
      const near = (x: number, y: number, from: { x: number; y: number }): number =>
        Math.hypot(x - from.x, y - from.y);
      const pole = map.objects.find((o) => o.type === 'poteau-de-quai');
      expect(pole && near(pole.x, pole.y, quay)).toBeLessThan(def.station.platformRadius);
      const benches = map.objects.filter((o) => o.type === 'banc');
      expect(Math.min(...benches.map((o) => near(o.x, o.y, arrival)))).toBeLessThan(6);
      const standing = place.villagers
        .map((v) => map.points[v.stands])
        .filter((p) => p !== undefined);
      expect(Math.min(...standing.map((p) => near(p.x, p.y, arrival)))).toBeLessThan(6);
    },
  );

  it.each(PLACES)('%s: toutes les briques utiles sont à essayer', (id) => {
    const bricks = bricksAt(id);
    for (const brick of ['travel', 'sit', 'sleep', 'store', 'relieve', 'gather'])
      expect(bricks, `${id} sans ${brick}`).toContain(brick);
    expect(placeOf(id).map.objects.some((o) => o.type === 'table-a-manger')).toBe(true);
  });

  it.each(PLACES)(
    '%s: chaque meuble et chaque habitant touche une case libre atteignable',
    (id) => {
      const { map } = placeOf(id);
      const blocked = blockedCells(id);
      const free = reachable(id);
      const touches = (x: number, y: number, w: number, h: number): boolean => {
        for (let cx = Math.floor(x - w / 2) - 1; cx <= Math.ceil(x + w / 2); cx++)
          for (let cy = Math.floor(y - h / 2) - 1; cy <= Math.ceil(y + h / 2); cy++)
            if (
              free.has(`${String(cx)},${String(cy)}`) &&
              !blocked.has(`${String(cx)},${String(cy)}`)
            )
              return true;
        return false;
      };
      for (const o of map.objects) {
        const size = content.props[o.type]?.size ?? { w: 1, h: 1 };
        expect(touches(o.x, o.y, size.w, size.h), `${id}: ${o.id} inaccessible`).toBe(true);
      }
      for (const v of placeOf(id).villagers) {
        const at = map.points[v.stands];
        expect(at && free.has(`${String(Math.floor(at.x))},${String(Math.floor(at.y))}`)).toBe(
          true,
        );
      }
    },
  );

  it('les plats, les outils et les sacs d’essai existent', () => {
    expect(content.items['tourte-du-quai']?.meal?.perk).toBe('no_tool_wear');
    expect(content.items['soupe-aux-herbes']?.meal).toBeUndefined();
    expect(content.items.hache?.tool?.durability).toBe(0);
    expect(content.items['hache-forgee']?.tool?.durability).toBeGreaterThan(0);
    expect(content.bags.bags.filter((b) => b.slots === 4 || b.slots === 6)).toHaveLength(2);
  });

  it('les deux habitants d’essai ont un look composé et un dialogue de 3 à 5 pages à choix, accord compris', () => {
    for (const [place, villager] of [
      ['essai-gare', 'odilon'],
      ['essai-halte', 'prune'],
    ] as const) {
      const def = placeOf(place).villagers.find((v) => v.id === villager);
      expect(def?.look?.pieces.length).toBeGreaterThan(4);
      const dialogue = placeOf(place).dialogues.find((d) => d.villager === villager);
      const nodes = Object.values(dialogue?.nodes ?? {});
      const lines = nodes.filter((n) => n.kind === 'line');
      // Pages d'une conversation: le chemin le plus long (réplique, choix, réplique).
      expect(lines.length).toBeGreaterThanOrEqual(3);
      expect(nodes.some((n) => n.kind === 'choice')).toBe(true);
      const text = lines.map((n) => n.text).join(' ');
      expect(text).toMatch(/\[\[[^|\]]+\|[^|\]]+\]\]/);
      expect(resolveAgreement(text, 'f', ['f', 'f'])).not.toContain('[[');
    }
  });
});
