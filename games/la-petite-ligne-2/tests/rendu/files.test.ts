// Files de modules (haies, talus, rangs du labour) et repères livrés d'Aubrune: choix des
// modules d'après les cases voisines, pièce de contour par file, fusion par tuile, poses des
// repères, et gabarits (une sorte de file et une nature de repère factices, sans code).
import { BoxGeometry, type BufferGeometry, type Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/donnees/charger';
import { tileGrid, tileOf } from '../../src/donnees/carte';
import { inkTag } from '../../src/rendu/encre/conversion';
import { DECOR_MANIFEST, type DecorManifest } from '../../src/rendu/lieu/decors-manifeste';
import { KeepOut } from '../../src/rendu/lieu/emprises';
import { landmarkPoses, layRuns, turned } from '../../src/rendu/lieu/files';
import {
  LANDMARK_LOOKS,
  RUN_SORTS,
  type RunSort,
  type Side4,
} from '../../src/rendu/lieu/reglages-files';
import { TILE_SETTINGS } from '../../src/rendu/lieu/reglages-tuiles';
import { groundField, tileDecor, tileSemis } from '../../src/rendu/lieu/terrain-rendu';
import { buildTile, type TileKit } from '../../src/rendu/lieu/tuile';
import { createPlaceState } from '../../src/simulation/noyau/monde';
import { describeDynamic, hidingFootprints } from '../../src/rendu/lieu/description';
import { gameDataFiles } from '../aides';

const content = loadContent(gameDataFiles());

function aubrune(): NonNullable<(typeof content.places)[string]> {
  const place = content.places.aubrune;
  if (place === undefined) throw new Error('aubrune absente');
  return place;
}

const SIDES: readonly Side4[] = ['n', 's', 'e', 'w'];

describe('files de modules', () => {
  const { map } = aubrune();
  const field = groundField(map);
  const layout = layRuns(field);
  const cells = [...layout.cells.values()];

  it('pose une haie ou un rang, ou réserve un talus, sur chaque case qui portait une boîte', () => {
    const count = (sort: string): number => cells.filter((c) => c.sort === sort).length;
    // 233 haies et 144 talus en boîtes: la lisière qui ne touche l'eau que par un coin est
    // devenue l'angle rentrant de sa berge. Le talus n'a plus de module: ses cases sont
    // réservées (ni boîte ni haie), le relief du sol y descend en berge.
    expect(count('haie')).toBe(232);
    expect(count('talus')).toBe(0);
    expect(layout.reserved.size).toBe(145);
    for (const i of layout.reserved) {
      expect(layout.cells.has(i)).toBe(false);
      expect(layout.covers(i % field.width, Math.floor(i / field.width))).toBe(true);
    }
    expect(count('rang')).toBeGreaterThan(100);
    const { cols, rows } = tileGrid(map);
    for (let tile = 0; tile < cols * rows; tile++) {
      const boxes = tileDecor(field, map, tile, TILE_SETTINGS, null, false, layout).boxes;
      const colors: readonly string[] = [
        TILE_SETTINGS.decor.hedgeColor,
        TILE_SETTINGS.decor.bankColor,
        TILE_SETTINGS.decor.cropColor,
      ];
      expect(boxes.filter((box) => colors.includes(box.color))).toEqual([]);
    }
  });

  it('ne laisse aucun raccord ouvert vers une case sans file', () => {
    const at = (x: number, y: number): string | undefined =>
      layout.cells.get(y * field.width + x)?.sort;
    let ends = 0;
    const alone: string[] = [];
    for (const cell of cells) {
      const linked = SIDES.filter((side) => {
        const [dx, dz] = turned(side, 0);
        return at(cell.x + dx, cell.y + dz) === cell.sort;
      }).length;
      // Une case seule de sa sorte (un talus d'une case entre deux haies) ne peut tout fermer.
      if (linked === 0) {
        if (cell.sort !== 'rang') alone.push(`${cell.model} ${String(cell.x)},${String(cell.y)}`);
        continue;
      }
      const sort = RUN_SORTS[cell.sort];
      const module = sort?.modules.find(
        (m) =>
          m.model === cell.model || DECOR_MANIFEST.models[m.model]?.variants?.includes(cell.model),
      );
      if (sort === undefined || module === undefined) throw new Error(cell.model);
      // Un rang de culture n'a pas de bout: sa butte s'arrête au bord du labour.
      const closable = sort.modules.some((m) => m.links.length === 1);
      for (const link of closable ? module.links : []) {
        const [dx, dz] = turned(link, cell.quarter, cell.mirror);
        expect(
          at(cell.x + dx, cell.y + dz),
          `${cell.model} ${String(cell.x)},${String(cell.y)}`,
        ).toBe(cell.sort);
      }
      if (module.links.length === 1) ends += 1;
      expect(linked).toBeLessThanOrEqual(2);
    }
    expect(ends).toBeGreaterThan(0);
    // Cases seules: la lisière coupée par un ru ou un gué (un talus d'une case de chaque côté).
    expect(alone.length).toBeLessThanOrEqual(10);
  });

  it('donne à toute une file le même numéro de pièce, les mêmes formes à chaque pose', () => {
    const again = layRuns(groundField(map));
    for (const cell of cells) {
      expect(again.cells.get(cell.y * field.width + cell.x)).toEqual(cell);
      for (const side of SIDES) {
        const [dx, dz] = turned(side, 0);
        const next = layout.cells.get((cell.y + dz) * field.width + cell.x + dx);
        if (next?.sort === cell.sort) expect(next.piece).toBe(cell.piece);
      }
    }
    // Trois formes de haie tirées, pas une seule.
    expect(new Set(cells.filter((c) => c.sort === 'haie').map((c) => c.model)).size).toBe(5);
  });

  it('fusionne chaque sorte en un maillage par tuile, d’une seule pièce par file', () => {
    // Géométrie d'essai: une boîte à un morceau par modèle, avec sa pièce d'origine.
    const shapes = new Map<string, BufferGeometry>();
    const geometryOf = (model: string): BufferGeometry | null => {
      if (DECOR_MANIFEST.models[model] === undefined) return null;
      const known = shapes.get(model) ?? inkTag(new BoxGeometry(1, 1, 0.5), { piece: 7 });
      shapes.set(model, known);
      return known;
    };
    const material = new MeshStandardMaterial();
    const box = new BoxGeometry(1, 1, 1);
    const hedge = cells.find((c) => c.sort === 'haie');
    if (hedge === undefined) throw new Error('aucune haie');
    const tile = tileOf(map, hedge.x, hedge.y);
    const kit: TileKit = {
      map,
      field,
      settings: TILE_SETTINGS,
      buildings: new Map(),
      materials: { ground: material, water: material, instanced: material, glass: material },
      shapes: { box, trunk: box, blob: box },
      plants: { geometryOf },
      runs: layout,
    };
    const work = buildTile(kit, tile);
    let step = work.next();
    while (step.done !== true) step = work.next();
    const view = step.value;
    const mesh = view.group.getObjectByName('file-haie') as Mesh | undefined;
    if (mesh === undefined) throw new Error('file-haie absente');
    const pieces = new Set<number>();
    const ink = mesh.geometry.getAttribute('aInk');
    for (let i = 0; i < ink.count; i++) pieces.add(ink.getY(i) % 64);
    const expected = new Set([...(layout.inTile(map, tile).get('haie') ?? [])].map((c) => c.piece));
    expect(pieces).toEqual(expected);
    view.dispose();
  });

  it('écarte le semis des modules posés', () => {
    const keepOut = new KeepOut(field, layout.footprints(), 1);
    const inside = layout.footprints();
    const { cols, rows } = tileGrid(map);
    for (let tile = 0; tile < cols * rows; tile++) {
      const semis = tileSemis(field, map, tile, TILE_SETTINGS, keepOut);
      for (const tuft of semis.tufts)
        expect(
          inside.some((r) => tuft.x > r.x0 && tuft.x < r.x1 && tuft.z > r.z0 && tuft.z < r.z1),
        ).toBe(false);
    }
  });

  it('sort un objet au sol d’une haie et du pied du château d’eau', () => {
    const place = aubrune();
    const hedge = cells.find((c) => c.sort === 'haie');
    if (hedge === undefined) throw new Error('aucune haie');
    const state = createPlaceState(content, place);
    state.ground.push(
      { id: 0, stack: { item: 'pomme', count: 1 }, x: hedge.x + 0.5, y: hedge.y + 0.5 },
      { id: 1, stack: { item: 'pomme', count: 1 }, x: 189, y: 87 },
    );
    const hiding = hidingFootprints(content, place, state);
    const under = (x: number, y: number): boolean =>
      hiding.some((r) => x > r.x0 && x < r.x1 && y > r.z0 && y < r.z1);
    for (const volume of describeDynamic(content, state, undefined, place))
      expect(under(volume.x, volume.y), volume.id).toBe(false);
  });

  it('gabarit: une sorte de file factice s’ajoute par une entrée de données', () => {
    const manifest: DecorManifest = {
      ...DECOR_MANIFEST,
      models: {
        ...DECOR_MANIFEST.models,
        'fake-wall': {
          file: 'f.glb',
          family: 'muret',
          triangles: 12,
          size: { w: 1, d: 0.4, h: 0.6 },
        },
      },
    };
    const wall: RunSort = {
      pourquoi: 'muret factice le long des chemins',
      on: ['chemin'],
      modules: [{ model: 'fake-wall', links: ['w', 'e'] }],
    };
    const fake = layRuns(field, { muret: wall }, manifest);
    const walls = [...fake.cells.values()];
    expect(walls.length).toBeGreaterThan(0);
    expect(walls.every((c) => c.model === 'fake-wall')).toBe(true);
  });
});

describe('repères livrés', () => {
  const { map } = aubrune();
  const field = groundField(map);
  const poses = landmarkPoses(map, field, () => true);
  const pose = (id: string): (typeof poses)[number] => {
    const found = poses.find((p) => p.id === id);
    if (found === undefined) throw new Error(id);
    return found;
  };

  it('pose un modèle par nature, tourné par la voie ou l’eau', () => {
    expect(poses.map((p) => p.model).sort()).toEqual(
      ['dovecote', 'mill-wheel', 'semaphore', 'tunnel-portal', 'water-crane', 'water-tower'].sort(),
    );
    // Vidange et bras vers la voie, au sud; roue en travers du bief qui coule le long de x.
    expect(pose('chateau-eau').yaw).toBeCloseTo(0, 5);
    expect(pose('semaphore').yaw).toBeCloseTo(0, 5);
    expect(pose('roue').yaw).toBeCloseTo(0, 5);
    expect(pose('pigeonnier').yaw).toBe(0);
    // La bouche du tunnel regarde la ligne qui arrive du sud-ouest.
    const portal = pose('portail-tunnel');
    expect(Math.sin(portal.yaw)).toBeLessThan(0);
    expect(Math.cos(portal.yaw)).toBeGreaterThan(0.9);
    // Emprise: le modèle tourné, autour du point du repère.
    const tower = pose('chateau-eau');
    expect(tower.footprint.x1 - tower.footprint.x0).toBeCloseTo(4.9, 1);
    // La grue à eau, posée par le plan en face du château d'eau: son bras vers la voie, au sud.
    expect(pose('grue-eau').yaw).toBeCloseTo(0, 5);
  });

  it('gabarit: une nature de repère factice prend son modèle sans code', () => {
    const looks = {
      ...LANDMARK_LOOKS,
      factice: {
        pourquoi: 'essai',
        model: 'fake-mark',
        facing: { rule: 'fixed', yaw: 1 } as const,
        sink: 0,
        fitHeight: true,
      },
    };
    const manifest: DecorManifest = {
      ...DECOR_MANIFEST,
      models: {
        ...DECOR_MANIFEST.models,
        'fake-mark': {
          file: 'f.glb',
          family: 'ouvrage',
          triangles: 12,
          size: { w: 2, d: 2, h: 4 },
        },
      },
    };
    const fakeMap = {
      ...map,
      landmarks: { essai: { name: 'essai', x: 10, y: 10, height: 8, kind: 'factice' } },
    };
    const [only] = landmarkPoses(fakeMap, field, () => true, looks, manifest);
    expect(only?.model).toBe('fake-mark');
    expect(only?.yaw).toBe(1);
    expect(only?.scale).toBe(2);
  });
});
