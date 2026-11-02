// Le ru de la Côte (tour 10): creusé dans ses colonnes, sauf sous le remblai de la voie; berges qui
// rejoignent le sol voisin; eau entre 1,2 et 1,5 m de large; embouchure dans le lit de la rivière.
import { describe, expect, it } from 'vitest';
import { MeshBasicMaterial } from 'three';
import { loadMap } from '../donnees/carte';
import { MAP_FILES } from '../donnees/cartes-fichiers';
import { isStreamCell, streamHeight, streamLayout } from './ru';
import { roomStage } from './interieurs';
import type { SharedMaterials } from './materiaux';
import { RENDER_SETTINGS } from './reglages';
import { ResourceTracker } from './ressources';
import { Terrain } from './terrain';

const map = loadMap(MAP_FILES).map;
const EXT = RENDER_SETTINGS.terrain.extension;
const SURFACE = RENDER_SETTINGS.terrain.waterSurface;

describe('le ru de la Côte', () => {
  const layout = streamLayout(map, EXT);

  it('se creuse des colonnes 63 et 64 jusqu à l embouchure, pas sous la voie', () => {
    expect(layout).not.toBeNull();
    if (layout === null) return;
    expect([layout.x0, layout.x1]).toEqual([63, 65]);
    expect(layout.mouthY).toBe(38);
    expect([...layout.embankment].sort()).toEqual([12, 13, 14]);
    expect(isStreamCell(layout, 63, 13)).toBe(false);
    // Sous le pont, la passerelle et le gué de pierres: creusé.
    for (const cy of [21, 30, 34, 35, -10]) expect(isStreamCell(layout, 64, cy)).toBe(true);
    expect(isStreamCell(layout, 62, 20)).toBe(false);
  });

  it('a des berges qui rejoignent le sol et une eau de 1,2 à 1,5 m de large', () => {
    if (layout === null) return;
    for (let y = 0; y < 36; y += 0.5) {
      expect(streamHeight(layout, layout.x0, y, 0)).toBeCloseTo(0, 6);
      expect(streamHeight(layout, layout.x1, y, 0)).toBeCloseTo(0, 6);
      let wet = 0;
      for (let x = layout.x0; x < layout.x1; x += 0.01) if (streamHeight(layout, x, y, 0) < SURFACE) wet += 0.01;
      expect(wet).toBeGreaterThan(1.2);
      expect(wet).toBeLessThan(1.55);
    }
  });

  it('n est plus un chemin de sable: le terrain le creuse et pose sa surface d eau', () => {
    const materials = { palette: new MeshBasicMaterial(), water: new MeshBasicMaterial() } as unknown as SharedMaterials;
    const terrain = new Terrain(map, materials, new ResourceTracker());
    expect(terrain.streamWater.length).toBeGreaterThan(0);
    // Le creux du ru est dans les morceaux du sol (même matériau, un appel par morceau).
    expect(terrain.isStream(64, 27)).toBe(true);
    expect(terrain.waterLevelAt(64, 27)).toBe(SURFACE);
    // Aucun maillage du sol ou de l'eau d'un seul tenant (ADR 0016).
    expect(terrain.group.children.filter((child) => child.name.startsWith('sol ')).length).toBeGreaterThan(4);
    expect(terrain.water.length).toBeGreaterThan(2);
  });
});

describe('pièces de la maisonnette', () => {
  it('le site paraît au matin qui suit la commande, la pièce est bâtie au jour dit', () => {
    expect(roomStage(undefined, 10)).toBe('none');
    const ordered = { ordered: 10, elementsBuilt: [], beamPlaced: false, builtDay: null };
    expect(roomStage(ordered, 10)).toBe('none');
    expect(roomStage(ordered, 11)).toBe('site');
    expect(roomStage({ ...ordered, builtDay: 14 }, 14)).toBe('built');
  });
});
