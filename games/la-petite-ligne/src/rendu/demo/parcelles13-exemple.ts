/**
 * Page de rendu, parcelles libres de la 0.13 (`parcelles-libres-0-13.md`): `parcelles=6|20|40` pose
 * autant de parcelles sur la terre du garde-barrière, au plus près de la porte comme le robot, avec
 * des cultures à tous les stades; `friche=<n>` défriche les n premières cases de la friche (les
 * ronciers s'en vont). `apercu=vert|rouge|rect|reprise`: le cordeau en main de Camille et l'aperçu
 * qu'un joueur verrait (une case libre, une case refusée, un rectangle qui dépasse les parcelles
 * libres, un rectangle de reprise sur des cultures). Les règles sont celles du jeu (`etat/parcelles.ts`).
 */
import type { GameMap } from '../../etat/carte';
import { fricheCells, landCells, plotPlacement, rectCells } from '../../etat/parcelles';
import type { Cell, CropStage, GardenCell, WorldState } from '../../etat/types';
import type { PlotPreview } from '../../etat/vue';
import type { Content } from '../../donnees/types';

const CROPS = ['radish', 'lettuce', 'carrot'] as const;
const STAGES: readonly (CropStage | null)[] = ['seed', 'sprout', 'young', 'ripe', null];
const GARDEN_LINE = 'garden_line';

function parcel(index: number, cell: Cell): GardenCell {
  const stage = STAGES[index % STAGES.length] ?? null;
  return {
    index,
    cell: { cx: cell.cx, cy: cell.cy },
    soil: index % 7 === 6 ? 'grass' : 'tilled',
    wet: index % 3 === 0,
    crop:
      stage === null || index % 7 === 6
        ? null
        : { crop: CROPS[Math.floor(index / 5) % CROPS.length] ?? 'radish', days: 1, stage, ripe: stage === 'ripe', wateredEveryDay: true, sownDay: 1, sownBy: 'p1' },
    lastHarvest: null,
  };
}

/** Pose l'exemple dans le monde; rend l'aperçu à donner au moteur (`setPlotPreview`), ou `null`. */
export function applyPlotsExample(world: WorldState, map: GameMap, content: Content, params: URLSearchParams): PlotPreview | null {
  const cleared = Number(params.get('friche') ?? '0');
  if (Number.isInteger(cleared) && cleared > 0) {
    world.plots.clearedCells = fricheCells(content, map)
      .slice(0, cleared)
      .map((c): [number, number] => [c.cx, c.cy]);
  }
  const count = Number(params.get('parcelles') ?? '0');
  if (Number.isInteger(count) && count > 0) {
    const door = map.points.house_door ?? { x: 8.5, y: 27.5 };
    world.garden = [];
    world.breeding.goats = [];
    world.groundItems = [];
    const cells = landCells(content, map)
      .filter((cell) => plotPlacement(content, map, world, cell, true) === null)
      .sort((a, b) => Math.hypot(a.cx + 0.5 - door.x, a.cy + 0.5 - door.y) - Math.hypot(b.cx + 0.5 - door.x, b.cy + 0.5 - door.y) || a.cy - b.cy || a.cx - b.cx)
      .slice(0, count);
    world.garden = cells.map((cell, i) => parcel(i, cell));
    world.plots.base = Math.max(world.plots.base, count);
    world.plots.nextIndex = count;
  }
  const preview = params.get('apercu');
  if (preview === null) return null;
  const me = world.characters[0];
  if (me !== undefined) {
    const slot = me.bag.findIndex((s) => s?.item === GARDEN_LINE);
    if (slot >= 0) me.selected = slot;
    else {
      me.bag[3] = { item: GARDEN_LINE, quality: 'ordinary', count: 1 };
      me.selected = 3;
    }
    me.aim = null;
    me.action = { kind: 'idle', since: 0, duration: 0, target: null };
  }
  // Deux parcelles libres au compteur (posées + 2), pour que l'aperçu vert ait de quoi poser.
  world.plots.bought = Math.max(0, world.garden.length + 2 - world.plots.base);
  const pointer = { x: 0, y: 0 };
  switch (preview) {
    case 'vert':
      return { mode: 'place', cells: [{ cx: 4, cy: 31 }], dragging: false, hold: null, pointer };
    case 'rouge':
      // Le coin des poules: refusé, contour hachuré, croix et icône de la poule.
      return { mode: 'place', cells: [{ cx: 13, cy: 32 }], dragging: false, hold: null, pointer };
    case 'rect':
      // De (2, 30) à (6, 33): le rocher en (3, 33) refusé, deux parcelles libres, le reste en trop.
      return { mode: 'place', cells: rectCells({ cx: 2, cy: 30 }, { cx: 6, cy: 33 }), dragging: true, hold: null, pointer };
    case 'reprise':
      return { mode: 'remove', cells: rectCells({ cx: 7, cy: 28 }, { cx: 10, cy: 30 }), dragging: true, hold: null, pointer };
    default:
      return null;
  }
}
