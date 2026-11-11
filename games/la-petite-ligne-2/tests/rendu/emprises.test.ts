// Emprises et budget du bois (`rendu/lieu/emprises.ts`, semis des tuiles): rien ne pousse dans un
// meuble, un potager, un bâtiment ni à cheval sur le bord d'un chemin; un objet au sol sort de
// l'emprise d'un meuble; la clôture de la voie est un modèle livré; loin du couloir de jeu un
// arbre semé prend sa version allégée, et près de lui elle porte son ombre.
import { BoxGeometry, type BufferGeometry, type InstancedMesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/donnees/charger';
import { tileGrid } from '../../src/donnees/carte';
import type { MapDef } from '../../src/donnees/schemas/lieu';
import { SHADOW_ONLY } from '../../src/rendu/encre/ombres';
import type { DecorManifest } from '../../src/rendu/lieu/decors-manifeste';
import { describeDynamic, hidingFootprints } from '../../src/rendu/lieu/description';
import { clearOf, type Footprint, KeepOut } from '../../src/rendu/lieu/emprises';
import { fenceVolumes } from '../../src/rendu/lieu/recoltes';
import { HARVEST_LOOK } from '../../src/rendu/lieu/reglages-recoltes';
import { GROUND_LOOKS, TILE_SETTINGS } from '../../src/rendu/lieu/reglages-tuiles';
import {
  fenceRuns,
  type GroundField,
  groundField,
  tileDecor,
  tileSemis,
} from '../../src/rendu/lieu/terrain-rendu';
import { buildTile, type TileKit, type TileView } from '../../src/rendu/lieu/tuile';
import { createPlaceState } from '../../src/simulation/noyau/monde';
import { gameDataFiles } from '../aides';

const content = loadContent(gameDataFiles());

function aubrune(): NonNullable<(typeof content.places)[string]> {
  const place = content.places.aubrune;
  if (place === undefined) throw new Error('aubrune absente');
  return place;
}

/** Emprises des meubles de la carte et des bâtiments, comme le moteur les donne au grand lieu. */
function footprintsOf(map: MapDef): Footprint[] {
  const out: Footprint[] = [];
  for (const object of map.objects) {
    const prop = content.props[object.type];
    if (prop === undefined) continue;
    const w = object.rotation % 2 === 0 ? prop.size.w : prop.size.h;
    const h = object.rotation % 2 === 0 ? prop.size.h : prop.size.w;
    out.push({
      x0: object.x - w / 2,
      z0: object.y - h / 2,
      x1: object.x + w / 2,
      z1: object.y + h / 2,
    });
  }
  for (const { rect } of Object.values(map.buildings ?? {}))
    out.push({ x0: rect.x, z0: rect.y, x1: rect.x + rect.w, z1: rect.y + rect.h });
  return out;
}

/** Champ d'essai de 8 x 4: herbe partout, un chemin sur la colonne 4. */
function strip(): GroundField {
  const names = ['herbe', 'chemin'];
  const cells = new Uint8Array(32);
  for (let y = 0; y < 4; y++) cells[y * 8 + 4] = 1;
  return {
    width: 8,
    height: 4,
    names,
    looks: names.map((name) => GROUND_LOOKS[name] ?? { color: '#000000', surface: 'herbe' }),
    cells,
    wild: new Uint8Array(32),
  };
}

describe('emprises', () => {
  it('refuse une place dans une emprise, à moins de sa garde, ou à cheval sur une autre surface', () => {
    const keepOut = new KeepOut(strip(), [{ x0: 1, z0: 1, x1: 2, z1: 2 }], 1);
    expect(keepOut.free(1.5, 1.5, 0.1)).toBe(false);
    expect(keepOut.free(2.2, 1.5, 0.3)).toBe(false);
    expect(keepOut.free(2.5, 1.5, 0.3)).toBe(true);
    // Le brin d'herbe ne mord pas sur le chemin, le caillou du chemin ne roule pas dans l'herbe.
    expect(keepOut.free(3.8, 3.5, 0.3)).toBe(false);
    expect(keepOut.free(3.6, 3.5, 0.3)).toBe(true);
    expect(keepOut.free(4.5, 3.5, 0.12)).toBe(true);
    expect(keepOut.free(4.05, 3.5, 0.12)).toBe(false);
    expect(keepOut.free(-1, 0, 0)).toBe(false);
  });

  it('ne sème rien à Aubrune dans un meuble, un potager ni un bâtiment (et le semis y poussait)', () => {
    const { map } = aubrune();
    const field = groundField(map);
    const footprints = footprintsOf(map);
    const reach = Math.max(...Object.values(TILE_SETTINGS.semis.clear));
    const keepOut = new KeepOut(field, footprints, reach);
    const inside = (x: number, z: number): boolean =>
      footprints.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    const { cols, rows } = tileGrid(map);
    let before = 0;
    let kept = 0;
    for (let tile = 0; tile < cols * rows; tile++) {
      const wild = tileSemis(field, map, tile);
      before += [...wild.tufts, ...wild.pebbles].filter((item) => inside(item.x, item.z)).length;
      before += tileDecor(field, map, tile).trees.filter((tree) => inside(tree.x, tree.z)).length;
      const semis = tileSemis(field, map, tile, TILE_SETTINGS, keepOut);
      const decor = tileDecor(field, map, tile, TILE_SETTINGS, keepOut);
      for (const item of [...semis.tufts, ...semis.pebbles, ...decor.trees, ...decor.bushes]) {
        expect(inside(item.x, item.z), `${String(item.x)}, ${String(item.z)}`).toBe(false);
        kept += 1;
      }
      // Aucune touffe ne dépasse sur une autre surface que la sienne.
      for (const tuft of semis.tufts)
        expect(keepOut.free(tuft.x, tuft.z, TILE_SETTINGS.semis.clear.tufts)).toBe(true);
    }
    expect(before).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(1000);
  });

  it('gabarit: un meuble factice posé dans l’herbe fait place nette, sans autre changement', () => {
    const { map } = aubrune();
    const field = groundField(map);
    // Une tuile d'herbe semée: on y pose un meuble factice de 4 x 4 là où pousse une touffe.
    const { cols, rows } = tileGrid(map);
    let tile = -1;
    let spot: { x: number; z: number } | undefined;
    for (let t = 0; t < cols * rows && spot === undefined; t++) {
      spot = tileSemis(field, map, t).tufts[0];
      tile = t;
    }
    if (spot === undefined) throw new Error('aucune touffe');
    const fake = { x0: spot.x - 2, z0: spot.z - 2, x1: spot.x + 2, z1: spot.z + 2 };
    const keepOut = new KeepOut(field, [fake], 1);
    const hit = (item: { x: number; z: number }): boolean =>
      item.x > fake.x0 && item.x < fake.x1 && item.z > fake.z0 && item.z < fake.z1;
    expect(tileSemis(field, map, tile).tufts.some(hit)).toBe(true);
    expect(tileSemis(field, map, tile, TILE_SETTINGS, keepOut).tufts.some(hit)).toBe(false);
  });
});

describe('objets au sol', () => {
  it('sort un objet de l’emprise d’un meuble par le plus court, sans toucher aux autres', () => {
    const bench = { x0: 1, z0: 2, x1: 3, z1: 2.5 };
    expect(clearOf(2, 2.4, 0.1, 0.05, [bench])).toEqual({ x: 2, z: 2.65 });
    expect(clearOf(1.02, 2.25, 0.1, 0.05, [bench])).toEqual({ x: 0.85, z: 2.25 });
    expect(clearOf(5, 5, 0.1, 0.05, [bench])).toEqual({ x: 5, z: 5 });
  });

  it('un ballot demandé sous le banc du ponton d’Aubrune s’affiche devant lui', () => {
    const place = aubrune();
    const bench = place.map.objects.find((object) => object.id === 'banc-ponton');
    if (bench === undefined) throw new Error('banc-ponton absent');
    const state = createPlaceState(content, place);
    state.ground.push(
      { id: 0, stack: { item: 'pomme', count: 3 }, x: bench.x - 0.1, y: bench.y },
      { id: 1, stack: { item: 'pomme', count: 1 }, x: bench.x, y: bench.y + 3 },
    );
    const hiding = hidingFootprints(content, place, state);
    const under = (x: number, y: number): boolean =>
      hiding.some((r) => x > r.x0 && x < r.x1 && y > r.z0 && y < r.z1);
    expect(under(bench.x - 0.1, bench.y)).toBe(true);
    const volumes = describeDynamic(content, state, undefined, place);
    const moved = volumes.find((v) => v.id === 'sol-0');
    const still = volumes.find((v) => v.id === 'sol-1');
    if (moved === undefined || still === undefined) throw new Error('volumes absents');
    expect(under(moved.x, moved.y)).toBe(false);
    expect(Math.hypot(moved.x - (bench.x - 0.1), moved.y - bench.y)).toBeLessThan(0.6);
    expect([still.x, still.y]).toEqual([bench.x, bench.y + 3]);
    // Le potager est plat: ce qu'on y pose se voit, rien ne bouge.
    const garden = place.map.objects.find((object) => object.id === 'potager');
    if (garden === undefined) throw new Error('potager absent');
    expect(under(garden.x, garden.y)).toBe(false);
  });
});

describe('clôture de la voie', () => {
  it('pose le modèle livré le long de chaque suite de cases, sans trou ni recouvrement', () => {
    const { map } = aubrune();
    const field = groundField(map);
    const runs = fenceRuns(field);
    expect(runs.length).toBeGreaterThan(0);
    const volumes = fenceVolumes(runs);
    expect(volumes.length).toBeGreaterThan(0);
    for (const run of runs.filter((r) => r.alongX)) {
      const mine = volumes.filter((v) => v.y === run.y0 + 0.5 && v.x > run.x0 && v.x < run.x1);
      const total = mine.reduce((sum, v) => sum + v.w, 0);
      expect(total).toBeCloseTo(run.x1 - run.x0, 5);
    }
    // Avec le modèle, les tuiles ne posent plus de piquets en boîtes.
    const { cols, rows } = tileGrid(map);
    const posts = (fences: boolean): number => {
      let count = 0;
      for (let tile = 0; tile < cols * rows; tile++)
        count += tileDecor(field, map, tile, TILE_SETTINGS, null, fences).boxes.filter(
          (box) => box.color === TILE_SETTINGS.decor.fenceColor,
        ).length;
      return count;
    };
    expect(posts(true)).toBeGreaterThan(0);
    expect(posts(false)).toBe(0);
    // Gabarit: un modèle absent du manifeste ne pose rien (les boîtes restent).
    expect(fenceVolumes(runs, 'modele-absent')).toEqual([]);
  });
});

describe('budget du bois', () => {
  const sheet = { file: 'f.glb', family: 'arbre', triangles: 1000, size: { w: 4, d: 4, h: 5 } };
  const manifest: DecorManifest = {
    format: 'duo-decors/1',
    models: {
      'fake-tree': { ...sheet, states: { far: 'fake-tree-far' } },
      'fake-tree-far': { ...sheet, triangles: 400 },
      'fake-bush': sheet,
    },
  };
  const shapes = new Map<string, BufferGeometry>();
  const geometryOf = (model: string): BufferGeometry | null => {
    if (manifest.models[model] === undefined) return null;
    const known = shapes.get(model) ?? new BoxGeometry(1, 1, 1);
    shapes.set(model, known);
    return known;
  };

  function build(map: MapDef, field: GroundField, tile: number, light: boolean): TileView {
    const material = new MeshStandardMaterial();
    const box = new BoxGeometry(1, 1, 1);
    const kit: TileKit = {
      map,
      field,
      settings: TILE_SETTINGS,
      buildings: new Map(),
      materials: { ground: material, water: material, instanced: material, glass: material },
      shapes: { box, trunk: box, blob: box },
      plants: { geometryOf },
      manifest,
      look: {
        ...HARVEST_LOOK,
        semis: {
          trees: ['fake-tree'],
          bushes: ['fake-bush'],
          chunk: 32,
          light: light
            ? {
                state: 'far',
                beyond: 5,
                shadow: true,
                shadowShrink: 0.96,
                shadowChunk: 32,
                deepShadow: null,
                variants: false,
              }
            : null,
        },
      },
    };
    const work = buildTile(kit, tile);
    for (;;) {
      const step = work.next();
      if (step.done === true) return step.value;
    }
  }

  it('note la distance de chaque arbre au couloir de jeu', () => {
    const { map } = aubrune();
    const field = groundField(map);
    const decor = tileDecor(field, map, 0);
    expect(decor.trees.length).toBeGreaterThan(50);
    // La tuile 0 est au coeur du bois hors jeu: tout y est loin du couloir.
    expect(Math.min(...decor.trees.map((tree) => tree.away ?? 0))).toBeGreaterThan(5);
  });

  it('allège le bois hors du couloir et porte l’ombre des arbres proches par la version allégée', () => {
    const { map } = aubrune();
    const field = groundField(map);
    const { cols, rows } = tileGrid(map);
    // Une tuile de lisière: des arbres de part et d'autre de la limite.
    let edge = -1;
    for (let tile = 0; tile < cols * rows && edge < 0; tile++) {
      const trees = tileDecor(field, map, tile).trees;
      if (trees.some((t) => (t.away ?? 0) > 5) && trees.some((t) => (t.away ?? 0) <= 5))
        edge = tile;
    }
    expect(edge).toBeGreaterThanOrEqual(0);
    const trees = tileDecor(field, map, edge).trees;
    const deep = trees.filter((t) => (t.away ?? 0) > 5).length;
    const view = build(map, field, edge, true);
    const named = (name: string): InstancedMesh | undefined =>
      view.instanced.find((mesh) => mesh.name === name);
    const full = named('fake-tree');
    const far = named('fake-tree-far');
    const twin = named('fake-tree-far-ombre');
    expect(far?.count).toBe(deep);
    expect(full?.count).toBe(trees.length - deep);
    // Une ombre par arbre, entier ou allégé, toutes portées par la version allégée.
    expect(twin?.count).toBe(trees.length);
    expect(twin?.geometry).toBe(far?.geometry);
    expect(twin?.userData[SHADOW_ONLY]).toBe(true);
    view.setShadows(true);
    expect(full?.castShadow).toBe(false);
    expect(far?.castShadow).toBe(false);
    expect(twin?.castShadow).toBe(true);
    // Un buisson sans version allégée porte son ombre lui-même.
    expect(named('fake-bush')?.castShadow ?? true).toBe(true);
    // Chaque houppier garde son instance effaçable, entière ou allégée.
    expect(Object.keys(view.crownSlots).length).toBe(trees.length);
    // Sans version allégée (réglage `light: null`): tout en entier, comme avant.
    const plain = build(map, field, edge, false);
    expect(plain.instanced.find((mesh) => mesh.name === 'fake-tree')?.count).toBe(trees.length);
    expect(plain.instanced.some((mesh) => mesh.name.endsWith('-ombre'))).toBe(false);
    expect(view.triangles).toBeGreaterThan(0);
  });
});
