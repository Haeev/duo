// Cohérence du monde: un meuble à tuyau (`backToWall`, le poêle à bois) se pose dos à un mur,
// tourné vers la pièce; au milieu de la pièce, la pose est refusée avec sa raison.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/contenu';
import { CONTENT_FILES } from '../src/donnees/fichiers';
import type { Content } from '../src/donnees/types';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { placementProblem } from '../src/simulation/amenagement';
import type { Sim } from '../src/simulation/contexte';
import { contentAndMap, newSim } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

/** Le contenu du jeu, le poêle à bois marqué `backToWall` (que les données le portent déjà ou non). */
function withBackToWall(): Content {
  const base = loadContent(CONTENT_FILES);
  const stove = base.items.wood_stove;
  if (stove === undefined) throw new Error('poêle à bois absent');
  return { ...base, items: { ...base.items, wood_stove: { ...stove, backToWall: true } } };
}

function emptyRoom(content: Content): Sim {
  const sim = newSim(5, content);
  sim.world.furniture = [];
  for (const c of sim.world.characters) c.pos = { x: 0.5, y: 0.5 };
  return sim;
}

describe('pose dos au mur', () => {
  const content = withBackToWall();

  it('au milieu de la pièce: refusée (raison `back_wall`)', () => {
    const sim = emptyRoom(content);
    const room = sim.map.house.room;
    const middle = { cx: room.x + Math.floor(room.w / 2), cy: room.y + Math.floor(room.h / 2) };
    for (const rotation of [0, 1, 2, 3]) expect(placementProblem(sim, 'wood_stove', middle, rotation)).toBe('back_wall');
  });

  it('contre un mur, dos au mur: acceptée; tourné vers le mur: refusée', () => {
    const sim = emptyRoom(content);
    const room = sim.map.house.room;
    const north = { cx: room.x + 1, cy: room.y };
    // Rotation 0: tourné vers le sud, donc dos au mur nord.
    expect(placementProblem(sim, 'wood_stove', north, 0)).toBeNull();
    expect(placementProblem(sim, 'wood_stove', north, 2)).toBe('back_wall');
    expect(placementProblem(sim, 'wood_stove', { cx: room.x, cy: room.y + 1 }, 1)).toBeNull();
    expect(placementProblem(sim, 'wood_stove', { cx: room.x + room.w - 1, cy: room.y + 1 }, 3)).toBeNull();
    expect(placementProblem(sim, 'wood_stove', { cx: room.x + 1, cy: room.y + room.h - 1 }, 2)).toBeNull();
  });

  it('les autres meubles ne changent pas (une table au milieu)', () => {
    const sim = emptyRoom(content);
    const room = sim.map.house.room;
    expect(placementProblem(sim, 'table', { cx: room.x + 1, cy: room.y + 1 }, 0)).toBeNull();
  });

  it('une sauvegarde avec un poêle déjà posé au milieu se relit, le poêle reste à sa place', () => {
    const sim = emptyRoom(content);
    const room = sim.map.house.room;
    const middle = { cx: room.x + Math.floor(room.w / 2), cy: room.y + Math.floor(room.h / 2) };
    sim.world.furniture.push({ id: 'f-poele', item: 'wood_stove', cell: middle, rotation: 0, placedBy: 'p1' });
    const { map } = contentAndMap();
    const snap = snapshotOf(sim);
    const restored = restoreWorld(content, map, JSON.parse(JSON.stringify(snap.data)) as unknown, snap.dataSchema, [A, B]);
    expect(restored.world.furniture.find((f) => f.id === 'f-poele')?.cell).toEqual(middle);
  });
});
