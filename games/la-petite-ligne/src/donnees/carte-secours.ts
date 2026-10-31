/**
 * Carte de secours du bourg d'Aubrune, tracée d'après les places indicatives
 * de `demo.md` (section 1.2) en attendant celle du level designer
 * (`donnees/cartes/`). Elle a tous les points et zones que les données
 * attendent (README des données, section 5).
 */
import type { GameMap, GroundKind, MapProp, MapTree, Rect } from '../etat/carte';
import type { Vec2 } from '../etat/types';

const WIDTH = 64;
const HEIGHT = 48;

interface Builder {
  ground: GroundKind[];
  blocked: boolean[];
}

function fill(b: Builder, rect: Rect, ground: GroundKind | null, blocked: boolean | null): void {
  for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      if (cx < 0 || cy < 0 || cx >= WIDTH || cy >= HEIGHT) continue;
      const i = cy * WIDTH + cx;
      if (ground !== null) b.ground[i] = ground;
      if (blocked !== null) b.blocked[i] = blocked;
    }
  }
}

function p(x: number, y: number): Vec2 {
  return { x, y };
}

/** Construit la carte de secours (même résultat à chaque appel). */
export function buildFallbackMap(): GameMap {
  const b: Builder = {
    ground: new Array<GroundKind>(WIDTH * HEIGHT).fill('grass'),
    blocked: new Array<boolean>(WIDTH * HEIGHT).fill(false),
  };

  // La voie le long du bord nord (infranchissable), le ballast juste au sud.
  fill(b, { x: 0, y: 0, w: WIDTH, h: 2 }, 'rail', true);
  fill(b, { x: 0, y: 2, w: WIDTH, h: 1 }, 'gravel', null);
  // Le quai et la halte.
  fill(b, { x: 24, y: 2, w: 20, h: 5 }, 'wood', null);
  fill(b, { x: 33, y: 6, w: 6, h: 3 }, 'stone', true);
  // La remise de la draisine, au bout est du quai.
  fill(b, { x: 44, y: 2, w: 6, h: 5 }, 'wood', true);

  // Chemins: maisonnette, quai, place, scierie, lisière, rivière.
  fill(b, { x: 8, y: 14, w: 2, h: 2 }, 'path', null);
  fill(b, { x: 8, y: 15, w: 20, h: 2 }, 'path', null);
  fill(b, { x: 26, y: 7, w: 2, h: 10 }, 'path', null);
  fill(b, { x: 26, y: 16, w: 14, h: 12 }, 'gravel', null);
  fill(b, { x: 40, y: 26, w: 12, h: 2 }, 'path', null);
  fill(b, { x: 50, y: 26, w: 2, h: 10 }, 'path', null);
  fill(b, { x: 29, y: 28, w: 2, h: 14 }, 'path', null);

  // La maisonnette: murs (pièce intérieure de 5x4), porte au sud.
  fill(b, { x: 5, y: 8, w: 7, h: 6 }, 'stone', true);
  fill(b, { x: 6, y: 9, w: 5, h: 4 }, 'floor', false);
  fill(b, { x: 8, y: 13, w: 1, h: 1 }, 'floor', false);
  // Le tonneau d'eau, à l'angle sud-est.
  fill(b, { x: 12, y: 13, w: 1, h: 1 }, null, true);

  // Le potager (12 cases, 4x3) et le poulailler.
  fill(b, { x: 4, y: 16, w: 4, h: 3 }, 'dirt', null);
  fill(b, { x: 13, y: 16, w: 2, h: 1 }, 'wood', true);

  // La maison de Firmin.
  fill(b, { x: 18, y: 10, w: 6, h: 5 }, 'stone', true);
  // Le puits au centre de la place.
  fill(b, { x: 33, y: 22, w: 1, h: 1 }, 'stone', true);
  // L'épicerie d'Odette (façade et comptoir sur la place).
  fill(b, { x: 40, y: 16, w: 8, h: 8 }, 'stone', true);
  // La scierie de Basile, l'établi sous son auvent.
  fill(b, { x: 54, y: 26, w: 7, h: 5 }, 'wood', true);
  fill(b, { x: 52, y: 29, w: 1, h: 1 }, 'wood', true);

  // La rivière Aubrune le long du bord sud, et son gué.
  fill(b, { x: 0, y: 44, w: WIDTH, h: 4 }, 'water', true);
  fill(b, { x: 29, y: 44, w: 3, h: 2 }, 'gravel', false);

  // Les 12 arbres de la lisière (chênes et sapins en alternance).
  const trees: MapTree[] = [];
  const xs = [51, 54, 57, 60];
  const ys = [37, 40, 43];
  ys.forEach((ty, row) => {
    xs.forEach((tx, col) => {
      const n = row * xs.length + col;
      trees.push({ id: `tree_${n + 1}`, kind: n % 2 === 0 ? 'oak' : 'fir', pos: p(tx + 0.5, ty + 0.5) });
    });
  });

  const garden = [];
  for (let cy = 16; cy < 19; cy++) {
    for (let cx = 4; cx < 8; cx++) garden.push({ cx, cy });
  }

  const props: MapProp[] = [
    { id: 'halte', model: 'halte', pos: p(36, 7.5), rotation: 0, rect: { x: 33, y: 6, w: 6, h: 3 } },
    { id: 'handcar_shed', model: 'handcar_shed', pos: p(47, 4.5), rotation: 0, rect: { x: 44, y: 2, w: 6, h: 5 } },
    { id: 'house', model: 'house', pos: p(8.5, 11), rotation: 0, rect: { x: 5, y: 8, w: 7, h: 6 } },
    { id: 'water_barrel', model: 'water_barrel', pos: p(12.5, 13.5), rotation: 0, rect: null },
    { id: 'chicken_coop', model: 'chicken_coop', pos: p(14, 16.5), rotation: 0, rect: { x: 13, y: 16, w: 2, h: 1 } },
    { id: 'firmin_house', model: 'firmin_house', pos: p(21, 12.5), rotation: 0, rect: { x: 18, y: 10, w: 6, h: 5 } },
    { id: 'well', model: 'well', pos: p(33.5, 22.5), rotation: 0, rect: { x: 33, y: 22, w: 1, h: 1 } },
    { id: 'grocery', model: 'grocery', pos: p(44, 20), rotation: 1, rect: { x: 40, y: 16, w: 8, h: 8 } },
    { id: 'sawmill', model: 'sawmill', pos: p(57.5, 28.5), rotation: 0, rect: { x: 54, y: 26, w: 7, h: 5 } },
    { id: 'workbench', model: 'workbench', pos: p(52.5, 29.5), rotation: 0, rect: { x: 52, y: 29, w: 1, h: 1 } },
    { id: 'quay_bell', model: 'bell_post', pos: p(36.5, 3.5), rotation: 0, rect: null },
    { id: 'quay_bench', model: 'bench', pos: p(39.5, 3.5), rotation: 0, rect: null },
    { id: 'coop_crate', model: 'coop_crate', pos: p(30.5, 3.5), rotation: 0, rect: null },
    { id: 'notice_board', model: 'notice_board', pos: p(32.5, 5.5), rotation: 0, rect: null },
  ];

  return {
    id: 'aubrune_secours',
    name: "Halte d'Aubrune (carte de secours)",
    width: WIDTH,
    height: HEIGHT,
    ground: b.ground,
    blocked: b.blocked,
    points: {
      train_stop: p(28.5, 3.5),
      quay_bell: p(36.5, 4.5),
      quay_bench: p(39.5, 4.5),
      bell_shadow_spot: p(40.5, 4.5),
      coop_crate: p(30.5, 4.5),
      notice_board: p(32.5, 5.5),
      handcar_shed: p(43.5, 5.5),
      house_door: p(8.5, 14.5),
      house_beam_spot: p(13.5, 11.5),
      house_attic: p(10.5, 9.5),
      beam_pickup: p(16.5, 6.5),
      water_barrel: p(12.5, 14.5),
      chicken_coop: p(14, 18),
      hen_feeder: p(12.5, 17.5),
      village_square: p(30.5, 20.5),
      well: p(33.5, 23.5),
      grocery_counter: p(39.5, 20.5),
      grocery_door: p(41.5, 24.5),
      grocery_terrace: p(37.5, 25.5),
      firmin_house: p(21.5, 15.5),
      sawmill_workbench: p(52.5, 30.5),
      sawmill_yard: p(56.5, 32.5),
      riverbank: p(26.5, 42.5),
      river_ford: p(30.5, 43.5),
      offstage: p(-20, -20),
    },
    zones: {
      garden: { x: 4, y: 16, w: 4, h: 3 },
      forest_edge: { x: 50, y: 36, w: 14, h: 8 },
      quay: { x: 24, y: 2, w: 20, h: 5 },
      square: { x: 26, y: 16, w: 14, h: 12 },
      river: { x: 0, y: 44, w: WIDTH, h: 4 },
      house_interior: { x: 6, y: 9, w: 5, h: 4 },
      hen_pen: { x: 11, y: 17, w: 5, h: 3 },
    },
    house: { room: { x: 6, y: 9, w: 5, h: 4 }, door: { cx: 8, cy: 13 }, spawn: p(8.5, 11.5) },
    garden,
    trees,
    props,
    startFurniture: [
      { item: 'straw_mattress', cell: { cx: 6, cy: 9 }, rotation: 0 },
      { item: 'straw_mattress', cell: { cx: 7, cy: 9 }, rotation: 0 },
      { item: 'chest', cell: { cx: 10, cy: 12 }, rotation: 0 },
      { item: 'stove', cell: { cx: 6, cy: 12 }, rotation: 0 },
    ],
  };
}
