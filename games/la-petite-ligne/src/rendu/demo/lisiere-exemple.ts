/**
 * La lisière d'après la démo (tour 8, sections 5.1 et 5.2) sur la page de démonstration
 * (`lisiere=1`): un jour d'été, une souche fraîche, un rejet de chêne et un jeune sapin qui
 * poussent, et une cueillette posée à chaque coin (mûres sur leur roncier). Les jours d'abattage
 * sont choisis pour que `etat/repousse.ts` donne chaque stade, comme en jeu.
 */
import type { Content } from '../../donnees/types';
import type { GameMap } from '../../etat/carte';
import type { WorldState } from '../../etat/types';

/** Un jour d'été (saison 2): mûres et girolles de saison. */
const EDGE_DAY = 30;

/** Arbre de la lisière, et depuis combien de jours il est abattu (0: souche du jour). */
const FELLED: readonly { tree: string; daysAgo: number }[] = [
  // Souche: abattu aujourd'hui.
  { tree: 'tree_edge_09', daysAgo: 0 },
  // Rejet de chêne à mi-pousse (0,6 de l'arbre adulte).
  { tree: 'tree_edge_11', daysAgo: 7 },
  // Jeune sapin replanté par Basile (0,4).
  { tree: 'tree_edge_08', daysAgo: 5 },
  // Rejet de chêne tout jeune (0,3), le premier jour.
  { tree: 'tree_edge_03', daysAgo: 4 },
];

/** Cueillettes posées aux coins (été: mûres, girolles; l'ail et la noisette pour la comparaison). */
const PICKS: readonly { point: string; item: string; count: number }[] = [
  { point: 'forage_edge_01', item: 'wild_garlic', count: 2 },
  { point: 'forage_edge_02', item: 'hazelnut', count: 3 },
  { point: 'forage_edge_03', item: 'blackberry', count: 3 },
  { point: 'forage_edge_04', item: 'blackberry', count: 2 },
  { point: 'forage_edge_05', item: 'chanterelle', count: 2 },
];

export function applyEdgeExample(world: WorldState, map: GameMap, content: Content): void {
  world.clock.day = EDGE_DAY;
  for (const t of world.trees) {
    const felled = FELLED.find((f) => f.tree === t.id);
    t.felled = felled !== undefined;
    t.felledDay = felled === undefined ? null : EDGE_DAY - felled.daysAgo;
    t.hits = felled === undefined ? 0 : content.settings.trees.chopsPerTree;
  }
  world.groundItems = world.groundItems.filter((g) => content.items[g.item]?.category !== 'forage');
  PICKS.forEach((pick, index) => {
    const at = map.points[pick.point];
    if (at === undefined) return;
    world.groundItems.push({
      id: `lisiere-${String(index)}`,
      item: pick.item,
      quality: 'ordinary',
      count: pick.count,
      pos: { x: at.x, y: at.y },
    });
  });
}
