// Rendu du village agrandi (0.13, lot L3): chaque type de la carte a son modèle (ou un substitut
// dédié, jamais la caisse rayée), les variantes et les poses de l'artiste sont respectées, le bief
// est creusé et porte son eau, le sous-bois a ses semis.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BoxGeometry, Mesh, MeshBasicMaterial, type Color, type InstancedMesh } from 'three';
import { describe, expect, it } from 'vitest';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { cellIndex, mapMaxX, mapMaxY, mapMinX, mapMinY } from '../etat/carte';
import { inReach, millraceReaches } from './bief';
import { crossingProps } from './decor';
import type { SharedMaterials } from './materiaux';
import { MODEL_BY_PROP, MODEL_VARIANTS } from './modeles';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { hasDedicatedSubstitute } from './substituts';
import { Terrain } from './terrain';
import { Vegetation } from './vegetation';

const map = loadMap(MAP_FILES).map;
const SURFACE = RENDER_SETTINGS.terrain.waterSurface;
const EXT = RENDER_SETTINGS.terrain.extension;

interface GltfJson {
  nodes: { name?: string; extras?: Record<string, unknown>; children?: number[] }[];
  animations?: { name?: string; channels: { target: { node: number } }[] }[];
}

function glb(file: string): GltfJson {
  const data = readFileSync(fileURLToPath(new URL(`../../assets/modeles/${file}`, import.meta.url)));
  const length = data.readUInt32LE(12);
  return JSON.parse(data.subarray(20, 20 + length).toString('utf8')) as GltfJson;
}

const FILES = ['bourg.glb', 'village013.glb', 'foret013.glb', 'ferme.glb', 'elevage.glb', 'marche.glb', 'maison.glb', 'train.glb'];
const nodes = new Map<string, { file: string; extras: Record<string, unknown> }>();
for (const file of FILES) {
  for (const n of glb(file).nodes) {
    if (n.name !== undefined && !nodes.has(n.name)) nodes.set(n.name, { file, extras: n.extras ?? {} });
  }
}

/** Nœud qui dessine un type de la carte (comme `ModelLibrary.resolve`), ou `null`. */
function resolved(model: string): string | null {
  const variant = (MODEL_VARIANTS[model] ?? []).find((name) => nodes.has(name));
  if (variant !== undefined) return variant;
  return nodes.has(model) ? model : null;
}

/** Types de la carte sans modèle à ce jour, chacun avec son substitut dédié (signalés au compte rendu). */
const KNOWN_SUBSTITUTES = ['cemetery_gate', 'clothesline', 'field_gate', 'log_bench', 'straw_bale'];

describe('0.13: chaque type de la carte rendu par son modèle', () => {
  it('tous les types et ouvrages ont un nœud de l’artiste, sauf les substituts connus (dédiés)', () => {
    const drawnElsewhere = new Set(RENDER_SETTINGS.propsDrawnElsewhere);
    const missing = new Set<string>();
    for (const prop of [...map.props, ...crossingProps(map)]) {
      if (drawnElsewhere.has(prop.model)) continue;
      if (resolved(prop.model) === null) missing.add(prop.model);
    }
    expect([...missing].sort()).toEqual(KNOWN_SUBSTITUTES);
    for (const name of KNOWN_SUBSTITUTES) expect(hasDedicatedSubstitute(name), name).toBe(true);
  });

  it('variantes: quatre tombes, framboisiers des hôtes de la cueillette, maisons aux volets clos', () => {
    for (const name of MODEL_VARIANTS.grave ?? []) expect(nodes.get(name)?.file, name).toBe('foret013.glb');
    expect(MODEL_VARIANTS.grave).toEqual(['grave_a', 'grave_b', 'grave_c', 'grave_d']);
    expect(MODEL_BY_PROP.forage_wood_02_host).toBe('raspberry_bush');
    expect(MODEL_BY_PROP.forage_wood_04_host).toBe('raspberry_bush');
    const byId = new Map(map.props.map((prop) => [prop.id, prop]));
    expect(byId.get('hamlet_house_b')?.model).toBe('village_house_a_shuttered');
    expect(byId.get('rail_cottage_east')?.model).toBe('lineman_house_shuttered');
  });

  it('angles du mur du cimetière: pile d’angle, rotations du compte rendu de l’artiste', () => {
    const corners = map.props
      .filter((prop) => prop.model === 'cemetery_wall_corner')
      .map((prop) => `${prop.pos.x - 0.5},${prop.pos.y - 0.5}:${prop.rotation}`)
      .sort();
    expect(corners).toEqual(['108,-20:0', '108,-4:1', '124,-20:3', '124,-4:2']);
    // Plus aucun tronçon droit dans un angle.
    const walls = new Set(map.props.filter((prop) => prop.model === 'cemetery_wall').map((p) => `${p.pos.x - 0.5},${p.pos.y - 0.5}`));
    for (const corner of ['108,-20', '124,-20', '108,-4', '124,-4']) expect(walls.has(corner), corner).toBe(false);
  });

  it('fruits et fleurs: enfants à saisons connues', () => {
    const seasons = new Set(['spring', 'summer', 'autumn', 'winter']);
    let count = 0;
    for (const [name, node] of nodes) {
      const list = node.extras.seasons;
      if (!Array.isArray(list) || node.file !== 'foret013.glb') continue;
      count += 1;
      for (const season of list) expect(seasons.has(String(season)), name).toBe(true);
    }
    expect(count).toBeGreaterThanOrEqual(7);
  });

  it('roue du moulin: le clip en boucle fait tourner le rotor et la lanterne', () => {
    const village = glb('village013.glb');
    expect(nodes.get('mill_wheel')?.extras.animation).toBe('mill_wheel_turn');
    const clip = village.animations?.find((a) => a.name === 'mill_wheel_turn');
    const targets = new Set(clip?.channels.map((c) => village.nodes[c.target.node]?.name));
    expect([...targets].sort()).toEqual(['mill_wheel_lantern', 'mill_wheel_rotor']);
  });

  it('les ouvrages du bief gardent le sens de l’artiste (la vanne en amont), la passerelle du ru tourne', () => {
    const rotations = new Map(crossingProps(map).map((prop) => [prop.id, prop.rotation]));
    expect(rotations.get('mill_sluice_footbridge')).toBe(0);
    expect(rotations.get('mill_tailrace_planks')).toBe(0);
    expect(rotations.get('ru_footbridge')).toBe(2);
  });
});

describe('0.13: bief du moulin et sous-bois', () => {
  const materials = {
    palette: new MeshBasicMaterial(),
    water: new MeshBasicMaterial(),
    paletteColor: (_cell: string, out: Color): Color => out.setRGB(1, 1, 1),
    onPaletteChange: (): (() => void) => () => undefined,
  } as unknown as SharedMaterials;
  const terrain = new Terrain(map, materials, new ResourceTracker());

  it('le bief court d’ouest en est jusqu’au moulin, le canal de fuite descend à la rivière', () => {
    const reaches = millraceReaches(map, RENDER_SETTINGS.terrain.millrace.bandReach).map(({ axis, across0, across1, along0, along1, mouth }) => ({
      axis,
      across0,
      across1,
      along0,
      along1,
      mouth,
    }));
    expect(reaches).toEqual([
      { axis: 'x', across0: 35, across1: 37, along0: -24 - RENDER_SETTINGS.terrain.millrace.bandReach, along1: -8, mouth: false },
      { axis: 'y', across0: -9, across1: -7, along0: 36, along1: 38, mouth: true },
    ]);
  });

  it('il est creusé: de l’eau au milieu, des berges qui rejoignent le sol, une surface d’eau', () => {
    for (const x of [-22.5, -18.5, -14, -10.5]) {
      expect(terrain.isStream(Math.floor(x), 35), `${x}`).toBe(true);
      expect(terrain.waterLevelAt(x, 36)).toBe(SURFACE);
      // Sous l'eau au milieu du bief (heightAt rend la surface où le fond est plus bas).
      expect(terrain.heightAt(x, 36)).toBeCloseTo(SURFACE, 6);
      // Hors du bief, le sol du pré au nord.
      expect(terrain.heightAt(x, 34.5)).toBeGreaterThanOrEqual(0);
    }
    expect(terrain.heightAt(-8.0, 37.5)).toBeCloseTo(SURFACE, 6);
    expect(terrain.millraceWater.length).toBeGreaterThan(0);
    // La roue tourne dans l'eau du bief.
    const wheel = map.props.find((prop) => prop.model === 'mill_wheel');
    expect(wheel !== undefined && millraceReaches(map, EXT).some((r) => inReach(r, wheel.pos.x, wheel.pos.y))).toBe(true);
  });

  it('les petites eaux dormantes sont creusées en bassins, la mare du bois garde ses rives de sable', () => {
    const basins = terrain.channels
      .filter((reach) => reach.still)
      .map((r) => `${r.axis}:${r.across0}-${r.across1}:${r.along0}-${r.along1}`)
      .sort();
    // Bassin de la source (x 62 à 65, y -23 et -22), mare de la pâture (x 130 et 131, y 33 et 34).
    expect(basins).toEqual(['x:-23--21:62-66', 'x:33-35:130-132']);
    expect(terrain.isStream(44, -20)).toBe(false);
    expect(terrain.pondWater.length).toBeGreaterThan(0);
    expect(terrain.heightAt(64, -22)).toBeCloseTo(SURFACE, 6);
  });

  it('sous-bois et sentier de forêt ont leur aspect; le bief aussi', () => {
    const styles = new Map<string, number>();
    for (let cy = mapMinY(map); cy <= mapMaxY(map); cy += 1) {
      for (let cx = mapMinX(map); cx <= mapMaxX(map); cx += 1) {
        const style = map.groundStyles?.[cellIndex(map, cx, cy)] ?? null;
        if (style !== null) styles.set(style, (styles.get(style) ?? 0) + 1);
      }
    }
    expect(styles.get('undergrowth') ?? 0).toBeGreaterThan(1500);
    expect(styles.get('forestPath') ?? 0).toBeGreaterThan(200);
    expect(styles.get('millrace')).toBe(29);
  });

  it('sous-bois: des fougères, aucune fleur des prés', () => {
    const fern = new BoxGeometry(0.4, 0.4, 0.4).toNonIndexed();
    const vegetation = new Vegetation(map, terrain, materials, new ResourceTracker(), 1, { large: fern, small: fern });
    vegetation.group.updateMatrixWorld(true);
    const ferns = vegetation.group.children.filter((child) => child.name.startsWith('fougeres'));
    expect(ferns.length).toBeGreaterThan(3);
    for (const child of vegetation.group.children) {
      if (!child.name.startsWith('fleurs') || !(child instanceof Mesh)) continue;
      const mesh = child as InstancedMesh;
      const matrix = mesh.matrix.clone();
      for (let i = 0; i < mesh.count; i += 1) {
        mesh.getMatrixAt(i, matrix);
        const [x, y] = [matrix.elements[12], matrix.elements[14]];
        expect(terrain.isUndergrowth(Math.floor(x), Math.floor(y)), `${x}, ${y}`).toBe(false);
      }
    }
  });
});
