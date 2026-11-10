// Rendu par tuiles des grands lieux (ADR 0022): anneau avec hystérésis, natures du sol et surface
// sous les pas, bâtiments (porte du bon côté), décor semé sous le budget de chaque tuile.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { tileGrid } from '../../src/donnees/carte';
import { MapSchema, type MapDef } from '../../src/donnees/schemas/lieu';
import { TILE_SETTINGS } from '../../src/rendu/lieu/reglages-tuiles';
import {
  buildingShape,
  groundField,
  railPieces,
  surfaceAt,
  tileDecor,
} from '../../src/rendu/lieu/terrain-rendu';
import { TileRing } from '../../src/rendu/lieu/tuiles';
import { planToMap } from '../../outils/plan-vers-lieu';

const PLAN = fileURLToPath(new URL('../../donnees/lieux/aubrune/plan.json', import.meta.url));

function aubrune(): MapDef {
  const plan = JSON.parse(readFileSync(PLAN, 'utf8')) as unknown;
  const { map } = planToMap(plan, { place: 'aubrune', annex: 48 });
  return v.parse(MapSchema, JSON.parse(JSON.stringify(map)));
}

describe('anneau de tuiles', () => {
  const map = { width: 320, height: 256 };

  it('charge autour du joueur, la plus proche d’abord, 9 au plus pour la vue la plus large', () => {
    const ring = new TileRing(map);
    const { load, unload } = ring.update(140, 102, 24);
    expect(unload).toEqual([]);
    expect(load.length).toBeLessThanOrEqual(9);
    expect(load[0]).toBe(3 * 10 + 4);
  });

  it('ne décharge pas au bord d’une tuile (hystérésis), décharge loin', () => {
    const ring = new TileRing(map);
    ring.update(140, 102, 12);
    const held = ring.tiles();
    // Aller-retour de 10 m: rien ne sort.
    expect(ring.update(150, 102, 12).unload).toEqual([]);
    expect(ring.update(140, 102, 12).unload).toEqual([]);
    expect(ring.tiles()).toEqual(expect.arrayContaining(held));
    // Au bout de la carte: tout l’ancien anneau s’en va, le nouveau est petit.
    const far = ring.update(310, 200, 12);
    expect(far.unload).toEqual(expect.arrayContaining(held));
    expect(ring.size).toBeLessThanOrEqual(9);
  });

  it('une traversée complète ne garde rien en trop', () => {
    const ring = new TileRing(map);
    let loaded = 0;
    let unloaded = 0;
    for (let y = 4; y < 208; y += 8)
      for (let x = 0; x < 320; x += 2) {
        const change = ring.update(y % 16 === 4 ? x : 320 - x, y, 20);
        loaded += change.load.length;
        unloaded += change.unload.length;
        expect(ring.size).toBeLessThanOrEqual(16);
      }
    expect(loaded - unloaded).toBe(ring.size);
  });
});

describe('Aubrune par tuiles', () => {
  const map = aubrune();
  const field = groundField(map);

  it('donne la surface sous les pas', () => {
    const quai = map.points.quai;
    expect(quai).toBeDefined();
    if (quai === undefined) return;
    expect(surfaceAt(field, quai.x, quai.y)).toBe('pave');
    expect(surfaceAt(field, 150, 134)).toBe('eau');
    expect(surfaceAt(field, 112, 44)).toBe('herbe');
    // La grève borde l’eau, les parcelles deviennent labour, pré ou cour.
    const names = new Set([...field.cells].map((c) => field.names[c]));
    for (const name of ['greve', 'labour', 'pre', 'cour']) expect(names).toContain(name);
  });

  it('pose chaque porte du côté donné par le plan, et un toit sur le grand côté', () => {
    const halte = map.buildings?.halte;
    expect(halte).toBeDefined();
    if (halte === undefined) return;
    const shape = buildingShape('halte', halte);
    expect(shape.doorSide).toBe('south');
    expect(shape.roof?.alongX).toBe(true);
    const door = shape.walls.find((w) => w.color === TILE_SETTINGS.building.door.color);
    expect(door?.z).toBeGreaterThan(halte.rect.y + halte.rect.h - 0.3);
    for (const [id, b] of Object.entries(map.buildings ?? {})) {
      if (b.door === null) continue;
      const s = buildingShape(id, b);
      const d = s.walls.find((w) => w.color === TILE_SETTINGS.building.door.color);
      expect(d, id).toBeDefined();
      if (d === undefined) continue;
      expect(Math.hypot(d.x - b.door.x, d.z - b.door.y), id).toBeLessThan(1);
    }
  });

  it('tient chaque tuile sous son budget de triangles, de façon déterministe', () => {
    const { cols, rows } = tileGrid(map);
    // Triangles par instance: boîte 10 (sans dessous), tronc 24, boule 80; sol 2 par case.
    let worst = 0;
    for (let tile = 0; tile < cols * rows; tile++) {
      const decor = tileDecor(field, map, tile);
      const triangles =
        32 * 32 * 2 +
        decor.boxes.length * 10 +
        decor.trees.length * (24 + 80) +
        decor.bushes.length * 80 +
        railPieces(map, tile).length * 10;
      worst = Math.max(worst, triangles);
    }
    expect(worst).toBeLessThan(TILE_SETTINGS.budget.tileTriangles);
    expect(tileDecor(field, map, 34)).toEqual(tileDecor(field, map, 34));
  });
});
