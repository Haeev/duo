// Relief du sol des grands lieux: hauteur pure et déterministe tirée des données du lieu, sol
// plan sous les bâtiments et devant les portes, chemins creusés, quai en marche, dallage continu
// d'une tuile à l'autre, maillage sans fente, et gabarit (une nature factice ajoutée par données).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it, vi } from 'vitest';
import { MapSchema, type MapDef } from '../../src/donnees/schemas/lieu';
import { EDGE_SETTINGS } from '../../src/rendu/lieu/reglages-lisieres';
import { RELIEF_SETTINGS, type ReliefProfile } from '../../src/rendu/lieu/reglages-relief';
import { createRelief, type Relief } from '../../src/rendu/lieu/relief';
import { reliefGround } from '../../src/rendu/lieu/relief-sol';
import { groundField, kindAt, railSegments } from '../../src/rendu/lieu/terrain-rendu';
import { tileRect } from '../../src/rendu/lieu/tuiles';

const MAP = fileURLToPath(new URL('../../donnees/lieux/aubrune/carte.json', import.meta.url));
const map: MapDef = v.parse(MapSchema, JSON.parse(readFileSync(MAP, 'utf8')) as unknown);
const field = groundField(map);
const relief = createRelief(field, map);

/** Tuiles du quai et de la place du bourg (32 m de côté, 12 colonnes). */
const QUAY_TILE = 3 * 12 + 6;
const QUAY_RECT = tileRect(map, QUAY_TILE);

function geometryOf(source: Relief, rect: { x0: number; y0: number; x1: number; y1: number }) {
  const steps = reliefGround(source, rect);
  let step = steps.next();
  while (step.done !== true) step = steps.next();
  if (step.value === null) throw new Error('sol vide');
  return step.value;
}

describe('hauteur du sol', () => {
  it('est pure et déterministe: deux reliefs du même lieu donnent le même sol, sans hasard', () => {
    const random = vi.spyOn(Math, 'random');
    const other = createRelief(groundField(map), map);
    for (let k = 0; k < 4000; k++) {
      const x = 160 + ((k * 37) % 1000) / 10;
      const y = 84 + ((k * 91) % 500) / 10;
      expect(other.heightAt(x, y)).toBe(relief.heightAt(x, y));
    }
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
  });

  it('reste dans des amplitudes faibles, et vaut 0 hors de la carte', () => {
    let low = Infinity;
    let high = -Infinity;
    for (let y = 60.05; y < 140; y += 0.37)
      for (let x = 150.05; x < 270; x += 0.41) {
        const h = relief.heightAt(x, y);
        low = Math.min(low, h);
        high = Math.max(high, h);
      }
    expect(low).toBeGreaterThan(-0.7);
    expect(high).toBeLessThan(0.16);
    expect(relief.heightAt(-3, 10)).toBe(0);
    expect(relief.heightAt(10, 9999)).toBe(0);
  });

  it('est continue d’une case souple à l’autre (aucune fente, aucune marche dans un pré)', () => {
    const e = 1e-4;
    let worst = 0;
    for (let cy = 86; cy < 132; cy++)
      for (let cx = 162; cx < 258; cx++) {
        if (!relief.isSoft(cx, cy)) continue;
        for (const t of [0.13, 0.5, 0.87]) {
          if (relief.isSoft(cx + 1, cy))
            worst = Math.max(
              worst,
              Math.abs(relief.heightAt(cx + 1 - e, cy + t) - relief.heightAt(cx + 1 + e, cy + t)),
            );
          if (relief.isSoft(cx, cy + 1))
            worst = Math.max(
              worst,
              Math.abs(relief.heightAt(cx + t, cy + 1 - e) - relief.heightAt(cx + t, cy + 1 + e)),
            );
        }
      }
    expect(worst).toBeLessThan(0.002);
  });

  it('tient les bâtiments sur un sol plan et met chaque porte de plain-pied', () => {
    for (const [id, building] of Object.entries(map.buildings ?? {})) {
      if (building.door === null) continue;
      const { rect, door } = building;
      for (const [x, y] of [
        [rect.x + 0.1, rect.y + 0.1],
        [rect.x + rect.w / 2, rect.y + rect.h / 2],
        [rect.x + rect.w - 0.1, rect.y + rect.h - 0.1],
      ] as const)
        expect(relief.heightAt(x, y), id).toBe(0);
      expect(Math.abs(relief.heightAt(door.x, door.y)), `porte de ${id}`).toBeLessThan(0.012);
    }
    for (const door of Object.values(map.doors ?? {}))
      expect(Math.abs(relief.heightAt(door.x, door.y))).toBeLessThan(0.012);
  });

  it('creuse le chemin de terre et relève un petit talus d’herbe sur son bord', () => {
    // Le chemin de la scierie court d'ouest en est (cases 185 à 213, rangs 90 à 93).
    expect(kindAt(field, 195.5, 91.5)).toBe('chemin');
    expect(kindAt(field, 195.5, 88.5)).not.toBe('chemin');
    const path = relief.heightAt(195.5, 92);
    const meadow = relief.heightAt(195.5, 86.5);
    expect(meadow - path).toBeGreaterThan(0.03);
    expect(meadow - path).toBeLessThan(0.12);
    let rim = -Infinity;
    for (let y = 89.2; y < 90; y += 0.05) rim = Math.max(rim, relief.heightAt(195.5, y));
    expect(rim).toBeGreaterThan(relief.heightAt(195.5, 88.4) + 0.01);
  });

  it('pose le quai une marche au-dessus de la rue, bordé de pierres', () => {
    const quay = map.buildings?.['quai-b'];
    if (quay === undefined) throw new Error('quai absent de la carte');
    const { rect } = quay;
    const level = RELIEF_SETTINGS.profiles.quai?.level ?? 0;
    expect(relief.heightAt(rect.x + rect.w / 2, rect.y + rect.h / 2)).toBe(level);
    expect(relief.heightAt(rect.x + rect.w / 2, rect.y + rect.h + 0.5)).toBe(0);
    expect(relief.kerbOn(rect.x + 5, rect.y + rect.h - 1, 1)).not.toBeNull();
    expect(relief.kerbOn(rect.x + 5, rect.y + 1, 1)).toBeNull();
  });

  it('garde les rails à niveau sur le ballast, la route et le passage du chemin', () => {
    for (const [ax, ay, bx, by] of railSegments(map)) {
      const length = Math.hypot(bx - ax, by - ay);
      for (let d = 0; d <= length; d += 1.7) {
        const x = ax + ((bx - ax) * d) / length;
        const y = ay + ((by - ay) * d) / length;
        if (x < 1 || y < 1 || x > map.width - 1 || y > map.height - 1) continue;
        // Sur un pont ou un quai la voie est portée: seuls les sols souples sont à tenir.
        if (!relief.isSoft(Math.floor(x), Math.floor(y))) continue;
        expect(Math.abs(relief.heightAt(x, y)), `${x.toFixed(1)}, ${y.toFixed(1)}`).toBeLessThan(
          0.012,
        );
      }
    }
  });
});

describe('dallage et maillage', () => {
  it('pose des dalles qui ne se chevauchent pas et continuent d’une tuile à l’autre', () => {
    const west = relief.slabs(QUAY_RECT);
    const east = relief.slabs({ ...QUAY_RECT, x0: QUAY_RECT.x1, x1: QUAY_RECT.x1 + 32 });
    const both = relief.slabs({ ...QUAY_RECT, x1: QUAY_RECT.x1 + 32 });
    expect(west.length).toBeGreaterThan(200);
    expect(west.length + east.length).toBe(both.length);
    const rows = new Map<number, { x0: number; x1: number }[]>();
    for (const slab of both) {
      // Le plus petit morceau: un tiers de pavé de rue (25 cm), joint déduit.
      expect(slab.x1 - slab.x0).toBeGreaterThan(0.05);
      expect(slab.z1 - slab.z0).toBeGreaterThan(0.08);
      const row = rows.get(slab.z0) ?? [];
      row.push(slab);
      rows.set(slab.z0, row);
    }
    for (const row of rows.values()) {
      row.sort((a, b) => a.x0 - b.x0);
      for (let k = 0; k + 1 < row.length; k++)
        expect(row[k + 1]?.x0 ?? 0).toBeGreaterThan(row[k]?.x1 ?? 0);
    }
  });

  it('maille le sol sous le budget d’une tuile, sans sommet égaré', () => {
    const geometry = geometryOf(relief, QUAY_RECT);
    const triangles = (geometry.index?.count ?? 0) / 3;
    expect(triangles).toBeGreaterThan(2048);
    expect(triangles).toBeLessThan(30_000);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      expect(Number.isFinite(position.getY(i))).toBe(true);
      expect(position.getY(i)).toBeGreaterThan(-0.6);
      expect(position.getY(i)).toBeLessThan(0.2);
    }
    geometry.dispose();
  });
});

describe('gabarit: une nature de sol de plus', () => {
  // Une carte de 8 x 8 cases d'herbe avec, au milieu, 4 x 4 cases d'une nature inconnue du moteur.
  const runs: number[] = [];
  for (let y = 0; y < 8; y++)
    if (y < 2 || y > 5) runs.push(0, 8);
    else runs.push(0, 2, 1, 4, 0, 2);
  const small = {
    width: 8,
    height: 8,
    terrain: { legend: ['herbe', 'mare-factice'], runs },
  };
  const factice: ReliefProfile = {
    pourquoi: 'exemplaire factice du test',
    level: -0.3,
    edge: 'souple',
    bumps: 0,
    spread: 0.5,
    rim: { height: 0.05, width: 0.5 },
  };
  const settings = {
    ...RELIEF_SETTINGS,
    profiles: { ...RELIEF_SETTINGS.profiles, 'mare-factice': factice },
  };

  it('apparaît dans la hauteur et dans le maillage par une seule entrée de données', () => {
    // Limites sur la grille (aucun couple lissé): le profil se vérifie au bord même des cases.
    const own = createRelief(groundField(small), small, settings, { ...EDGE_SETTINGS, pairs: [] });
    expect(own.heightAt(4, 4)).toBeCloseTo(-0.3, 5);
    // L'herbe voisine descend vers elle en pente douce, sans qu'aucun code ne la connaisse: à
    // mi-pente sur leur bord commun, et le pré intact une case plus loin.
    expect(own.heightAt(1.999, 4)).toBeLessThan(-0.14);
    expect(own.heightAt(1.999, 4)).toBeGreaterThan(-0.21);
    expect(own.heightAt(0.5, 4)).toBeGreaterThan(-0.09);
    const geometry = geometryOf(own, { x0: 0, y0: 0, x1: 8, y1: 8 });
    const position = geometry.getAttribute('position');
    let lowest = Infinity;
    for (let i = 0; i < position.count; i++) lowest = Math.min(lowest, position.getY(i));
    expect(lowest).toBeCloseTo(-0.3, 3);
    geometry.dispose();
    // Sans l'entrée, la même carte prend le profil de la surface (un pré): rien ne casse.
    expect(createRelief(groundField(small), small).heightAt(4, 4)).toBeGreaterThan(-0.1);
  });

  it('refuse un profil hors bornes', () => {
    const wrong = {
      ...RELIEF_SETTINGS,
      profiles: { ...RELIEF_SETTINGS.profiles, 'mare-factice': { ...factice, spread: 3 } },
    };
    expect(() => createRelief(groundField(small), small, wrong)).toThrow(/mare-factice/);
  });
});
