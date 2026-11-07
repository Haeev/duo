/**
 * Coque provisoire de l'adresse, en blocs, aux cotes du plan du level designer: sols, plafonds,
 * murs, cloisons, allèges et linteaux, éléments fixes, arbres. Une géométrie fusionnée par
 * couleur (une poignée d'appels de dessin). Les vrais modèles et la lumière cuite la remplaceront
 * (technique 3.4).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SphereGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Plan, PlanElement } from '../donnees/schemas';

const CEILING = 2.7;
const DOOR_HEIGHT = 2.1;

const COLORS: Readonly<Record<string, string>> = {
  wall: '#efe6d6',
  partition: '#e6dccb',
  window: '#efe6d6',
  door: '#8b6a4c',
  ceiling: '#f6f1e7',
  wood: '#a87b52',
  tiles: '#d9d4c7',
  closed: '#8c8478',
  neighbour: '#b9b1a3',
  courtyard: '#b7ad9c',
  grass: '#8fae6b',
  pavement: '#a9a39a',
  fixture: '#c9c2b6',
  trunk: '#6b4f36',
  crown: '#6f9655',
};

function rectOf(el: PlanElement): [number, number, number, number] | null {
  return 'rect' in el.shape ? el.shape.rect : null;
}

/** Un mur touche la porte par un de ses côtés (même alignement, à 5 cm près). */
function inWall(
  door: readonly [number, number, number, number],
  elements: readonly PlanElement[],
): boolean {
  const [x, z, w, d] = door;
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.05;
  return elements.some((el) => {
    if (el.kind !== 'wall' || !('rect' in el.shape)) return false;
    const [wx, wz, ww, wd] = el.shape.rect;
    const sameRow = near(wz, z) && near(wd, d) && (near(wx + ww, x) || near(wx, x + w));
    const sameColumn = near(wx, x) && near(ww, w) && (near(wz + wd, z) || near(wz, z + d));
    return sameRow || sameColumn;
  });
}

export function buildShell(plan: Plan): { group: Group; dispose(): void } {
  const parts = new Map<string, BufferGeometry[]>();
  const add = (color: string, geometry: BufferGeometry): void => {
    const list = parts.get(color) ?? [];
    list.push(geometry);
    parts.set(color, list);
  };
  const block = (
    color: string,
    x: number,
    z: number,
    w: number,
    d: number,
    y0: number,
    y1: number,
  ): void => {
    if (y1 - y0 <= 0) return;
    const g = new BoxGeometry(w, y1 - y0, d);
    g.translate(x + w / 2, (y0 + y1) / 2, z + d / 2);
    add(color, g);
  };

  for (const level of plan.levels) {
    for (const el of level.elements) {
      const r = rectOf(el);
      switch (el.kind) {
        case 'ground':
          if (r !== null)
            block(
              COLORS[el.style ?? ''] ?? COLORS.pavement ?? '#999999',
              r[0],
              r[1],
              r[2],
              r[3],
              -0.02,
              0,
            );
          break;
        case 'floor':
          if (r === null) break;
          block(
            COLORS[el.style ?? ''] ?? COLORS.wood ?? '#999999',
            r[0],
            r[1],
            r[2],
            r[3],
            -0.01,
            0.005,
          );
          block(COLORS.ceiling ?? '#ffffff', r[0], r[1], r[2], r[3], CEILING, CEILING + 0.02);
          break;
        case 'wall':
          if (r !== null) block(COLORS.wall ?? '#ffffff', r[0], r[1], r[2], r[3], 0, CEILING);
          break;
        case 'partition':
          if (r !== null)
            block(COLORS.partition ?? '#ffffff', r[0], r[1], r[2], r[3], 0, el.height ?? CEILING);
          break;
        case 'window':
          if (r === null) break;
          // Allège jusqu'à l'appui, linteau au-dessus de l'ouverture; pas de vitre dans le squelette.
          block(COLORS.window ?? '#ffffff', r[0], r[1], r[2], r[3], 0, el.sill ?? 0.9);
          block(COLORS.window ?? '#ffffff', r[0], r[1], r[2], r[3], el.height ?? 2.4, CEILING);
          break;
        case 'door':
          if (r === null) break;
          // Linteau seulement pour une porte percée dans un mur: un portillon de comptoir ou le
          // portail d'une clôture n'a rien au-dessus de lui.
          if (inWall(r, level.elements))
            block(
              COLORS.wall ?? '#ffffff',
              r[0],
              r[1],
              r[2],
              r[3],
              el.height ?? DOOR_HEIGHT,
              CEILING,
            );
          if (el.access === 'closed')
            block(COLORS.door ?? '#000000', r[0], r[1], r[2], r[3], 0, el.height ?? DOOR_HEIGHT);
          break;
        case 'fixture':
          if (r !== null)
            block(
              COLORS.fixture ?? '#cccccc',
              r[0],
              r[1],
              r[2],
              r[3],
              0,
              Math.max(0.05, el.height ?? 1),
            );
          else if ('circle' in el.shape) {
            const [x, z, rad] = el.shape.circle;
            const g = new CylinderGeometry(rad, rad, Math.max(0.05, el.height ?? 1), 16);
            g.translate(x, Math.max(0.05, el.height ?? 1) / 2, z);
            add(COLORS.fixture ?? '#cccccc', g);
          }
          break;
        case 'tree':
          if ('circle' in el.shape) {
            const [x, z, rad] = el.shape.circle;
            const h = el.height ?? 5;
            const trunk = new CylinderGeometry(rad, rad * 1.2, h * 0.6, 8);
            trunk.translate(x, h * 0.3, z);
            add(COLORS.trunk ?? '#000000', trunk);
            const crownRadius = typeof el.crown === 'number' ? el.crown : 1.5;
            const crown = new SphereGeometry(crownRadius, 12, 8);
            crown.translate(x, h * 0.6 + crownRadius * 0.6, z);
            add(COLORS.crown ?? '#000000', crown);
          }
          break;
        default:
          break;
      }
    }
  }

  const group = new Group();
  group.name = 'coque';
  const disposables: { dispose(): void }[] = [];
  for (const [color, list] of parts) {
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    const material = new MeshLambertMaterial({ color });
    group.add(new Mesh(merged, material));
    disposables.push(merged, material);
  }
  return {
    group,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}
