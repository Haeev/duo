// Lits de voie d'Aubrune (`rendu/lieu/lits-de-voie.ts`): modules le long du tracé réel, coupés
// aux passages à niveau, tranchée à l'approche du tunnel, raccords sans jour d'un module à
// l'autre, ballast sous les traverses, et gabarit (une sorte factice ajoutée par les données).
import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/donnees/charger';
import { KIND } from '../../src/rendu/encre/couches';
import { DECOR_MANIFEST, type DecorManifest } from '../../src/rendu/lieu/decors-manifeste';
import { layTrackBeds, trackBedGeometry } from '../../src/rendu/lieu/lits-de-voie';
import { TRACK_BED } from '../../src/rendu/lieu/reglages-files';
import { TILE_SETTINGS } from '../../src/rendu/lieu/reglages-tuiles';
import { groundField } from '../../src/rendu/lieu/terrain-rendu';
import { gameDataFiles } from '../aides';

const content = loadContent(gameDataFiles());
const place = content.places.aubrune;
if (place === undefined) throw new Error('aubrune absente');
const { map } = place;
const field = groundField(map);
const all = (): boolean => true;

/** Module factice: le profil du lit (bords à 3,5 m, crête à 3,5 cm), un mètre le long de z. */
function fakeModule(half = 3.5): BufferGeometry {
  const geometry = new BoxGeometry(half * 2, 0.035, 1, 4, 1, 1).translate(0, 0.0175, 0);
  const count = geometry.getAttribute('position').count;
  geometry.setAttribute(
    'aInk',
    new Float32BufferAttribute(new Float32Array(count * 2).fill(64), 2),
  );
  return geometry;
}

/** Teintes (linéaires) du module de tranchée factice: ballast, banquette, eau du fossé, herbe. */
const BALLAST = [0.25, 0.23, 0.19] as const;
const EARTH = [0.33, 0.22, 0.12] as const;
const WATER = [0.074, 0.195, 0.254] as const;
const GRASS = [0.27, 0.42, 0.1] as const;
/** Demi-profil de la tranchée factice (distance à l'axe, hauteur): le fossé de 2,35 à 2,9 m. */
const CUTTING: readonly (readonly [number, number])[] = [
  [1.3, 0.035],
  [2.35, 0],
  [2.9, 0],
  [3.1, 0.12],
  [4.8, 1.35],
  [5.5, 1.6],
  [6.3, 1.05],
  [7.2, 0],
];

/**
 * Module de tranchée factice, bâti comme le modèle livré: un mètre le long de z, une face par
 * intervalle du profil (ses quatre sommets à elle, sa teinte), le tout d'un seul morceau.
 */
function fakeCutting(): BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const inks: number[] = [];
  const index: number[] = [];
  const face = (x0: number, y0: number, x1: number, y1: number, color: readonly number[]): void => {
    const at = positions.length / 3;
    for (const [x, y, z] of [
      [x0, y0, -0.5],
      [x1, y1, -0.5],
      [x1, y1, 0.5],
      [x0, y0, 0.5],
    ] as const) {
      positions.push(x, y, z);
      normals.push(0, 1, 0);
      colors.push(...color);
      inks.push(9, 1, 0, 35);
    }
    index.push(at, at + 2, at + 1, at, at + 3, at + 2);
  };
  const first = CUTTING[0] ?? [0, 0];
  face(-first[0], first[1], first[0], first[1], BALLAST);
  for (const sign of [-1, 1])
    for (let k = 0; k + 1 < CUTTING.length; k++) {
      const [x0, y0] = CUTTING[k] ?? [0, 0];
      const [x1, y1] = CUTTING[k + 1] ?? [0, 0];
      const color = x1 <= 2.35 ? BALLAST : x1 <= 2.9 ? WATER : x1 <= 3.1 ? EARTH : GRASS;
      face(sign * x0, y0, sign * x1, y1, color);
    }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aInk', new Float32BufferAttribute(inks, 4));
  geometry.setIndex(index);
  return geometry;
}

describe('tranchée du tunnel', () => {
  const layout = layTrackBeds(map, field, all);
  const ligne = layout.tracks.findIndex((t) => t.id === 'ligne');
  const track = layout.tracks[ligne];
  if (track === undefined) throw new Error('ligne absente');
  const talus = TRACK_BED.sorts[0]?.talus;
  if (talus === undefined) throw new Error('la tranchée n’a plus de talus');
  // Les modules où le talus a toute sa hauteur (au-delà de la rampe), sol plat à zéro.
  const full = layout.modules.filter(
    (m) =>
      m.track === ligne &&
      m.model.startsWith('rail-cutting') &&
      layout.toMouth(ligne, m.s1) < (TRACK_BED.sorts[0]?.nearTunnel ?? 0) - talus.ramp,
  );
  const built = trackBedGeometry(
    layout,
    full,
    () => fakeCutting(),
    () => 0,
    field,
  );
  if (built === null) throw new Error('tranchée vide');
  const position = built.getAttribute('position');
  const normal = built.getAttribute('normal');
  const ink = built.getAttribute('aInk');
  const color = built.getAttribute('color');
  /** Écart du sommet à l'axe de la voie: distance, et direction qui s'en éloigne. */
  const off = (i: number): { d: number; x: number; z: number } => {
    let best = { d: Number.POSITIVE_INFINITY, x: 0, z: 0 };
    for (let k = 0; k + 1 < track.xs.length; k++) {
      const ax = track.xs[k] ?? 0;
      const az = track.ys[k] ?? 0;
      const dx = (track.xs[k + 1] ?? ax) - ax;
      const dz = (track.ys[k + 1] ?? az) - az;
      const len2 = dx * dx + dz * dz || 1;
      const t = Math.min(
        1,
        Math.max(0, ((position.getX(i) - ax) * dx + (position.getZ(i) - az) * dz) / len2),
      );
      const ox = position.getX(i) - (ax + dx * t);
      const oz = position.getZ(i) - (az + dz * t);
      const d = Math.hypot(ox, oz);
      if (d < best.d) best = { d, x: ox / (d || 1), z: oz / (d || 1) };
    }
    return best;
  };

  it('il y a des modules à pleine hauteur avant la bouche', () => {
    expect(full.length).toBeGreaterThan(8);
  });

  it('le talus est du sol (nature du sol, ni pièce ni morceau), le lit reste un ouvrage', () => {
    let ground = 0;
    for (let i = 0; i < position.count; i++) {
      const d = off(i).d;
      if (d > 3.2) {
        expect(ink.getZ(i)).toBe(KIND.ground);
        expect(ink.getW(i)).toBe(0);
        ground += 1;
      }
      if (d < 3) expect(ink.getZ(i)).toBe(0);
    }
    // Quatre faces de talus de chaque côté, quatre sommets chacune, moins les quatre du pied.
    expect(ground).toBe(full.length * 28);
  });

  it('coupe les normales à la crête: le versant de la voie penche vers elle, le revers s’en détourne', () => {
    let inner = 0;
    let outer = 0;
    for (let i = 0; i < position.count; i++) {
      const o = off(i);
      if (Math.abs(o.d - talus.crest) > 0.02) continue;
      const lean = normal.getX(i) * o.x + normal.getZ(i) * o.z;
      // Aucune normale moyenne (droit vers le ciel) à la crête: deux versants francs.
      expect(Math.abs(lean)).toBeGreaterThan(0.15);
      if (lean < 0) inner += 1;
      else outer += 1;
    }
    expect(inner).toBeGreaterThan(0);
    expect(inner).toBe(outer);
  });

  it('fait onduler la hauteur de la crête et le pied du revers, dans l’emprise annoncée', () => {
    const crests: number[] = [];
    let near = Number.POSITIVE_INFINITY;
    let far = 0;
    for (let i = 0; i < position.count; i++) {
      const o = off(i);
      if (Math.abs(o.d - talus.crest) < 0.02) crests.push(position.getY(i));
      // Pied du revers: les sommets du bord, passés sous le sol.
      if (position.getY(i) < -0.05 && o.d > talus.crest) {
        near = Math.min(near, o.d);
        far = Math.max(far, o.d);
      }
    }
    const top = 1.6 + TRACK_BED.lift;
    expect(Math.min(...crests)).toBeGreaterThanOrEqual(top * (1 - talus.swell) - 0.02);
    expect(Math.max(...crests)).toBeLessThanOrEqual(top * (1 + talus.swell) + 0.02);
    expect(Math.max(...crests) - Math.min(...crests)).toBeGreaterThan(0.15);
    // Le pied n'est plus une droite: il s'écarte de plus d'un mètre d'un endroit à l'autre.
    expect(far - near).toBeGreaterThan(1);
    const widest = talus.crest + (7.2 - talus.crest) * talus.spread[1];
    expect(far).toBeLessThanOrEqual(widest + 1e-6);
    const half = Math.max(
      ...layout.footprints().map((f) => Math.min(f.x1 - f.x0, f.z1 - f.z0) / 2),
    );
    expect(half).toBeGreaterThanOrEqual(widest - 1e-6);
  });

  it('le fossé est sec hors de l’eau du plan: plus aucun sommet à la teinte de l’eau', () => {
    const dry = new Color(TRACK_BED.ditch.dry);
    let ditch = 0;
    for (let i = 0; i < color.count; i++) {
      expect(color.getZ(i) > color.getY(i) * 1.15 && color.getZ(i) > color.getX(i) * 2).toBe(false);
      if (Math.abs(color.getX(i) - dry.r) < 1e-4 && Math.abs(color.getY(i) - dry.g) < 1e-4)
        ditch += 1;
    }
    expect(ditch).toBe(full.length * 8);
  });
});

describe('lits de voie', () => {
  const layout = layTrackBeds(map, field, all);

  it('pose des modules d’un mètre le long des voies à ciel ouvert, coupés aux passages à niveau', () => {
    const ligne = layout.tracks.findIndex((t) => t.id === 'ligne');
    const modules = layout.modules.filter((m) => m.track === ligne);
    for (const m of modules) expect(m.s1 - m.s0).toBeGreaterThan(0.6);
    for (const m of modules) expect(m.s1 - m.s0).toBeLessThan(1.4);
    // La voie de 0 à 304 court à y = 97,5: aucun module sur la route du passage du garde (180 à 185).
    expect(modules.some((m) => m.s0 < 184.5 && m.s1 > 180.5)).toBe(false);
    expect(modules.some((m) => m.s0 < 179 && m.s1 > 178)).toBe(true);
    // Le tunnel n'a pas de lit; sa voie non plus n'est pas dans la liste.
    expect(layout.tracks.some((t) => t.id === 'ligne-tunnel')).toBe(false);
  });

  it('met la voie en tranchée près de la bouche du tunnel, au ras du pré ailleurs', () => {
    const ligne = layout.tracks.findIndex((t) => t.id === 'ligne');
    const track = layout.tracks[ligne];
    if (track === undefined) throw new Error('ligne absente');
    expect(track.mouths).toEqual([false, true]);
    const near = TRACK_BED.sorts[0]?.nearTunnel ?? 0;
    for (const m of layout.modules.filter((x) => x.track === ligne)) {
      const cutting = m.model.startsWith('rail-cutting');
      expect(cutting).toBe(layout.toMouth(ligne, (m.s0 + m.s1) / 2) <= near);
    }
    expect(layout.modules.filter((m) => m.model.startsWith('rail-cutting')).length).toBe(near);
  });

  it('raccorde deux modules voisins sans jour, et porte le ballast sous les traverses', () => {
    const ligne = layout.tracks.findIndex((t) => t.id === 'ligne');
    const line = layout.modules.filter((m) => m.track === ligne);
    const at = line.findIndex((m) => m.s0 >= 196);
    const pair = line.slice(at, at + 2);
    expect(pair).toHaveLength(2);
    const flat = (): number => 0;
    const one = (m: (typeof pair)[number]): BufferGeometry => {
      const g = trackBedGeometry(layout, [m], () => fakeModule(), flat, field);
      if (g === null) throw new Error('module vide');
      return g;
    };
    const [a, b] = pair.map(one);
    const ends = (g: BufferGeometry | undefined, x: number): string[] => {
      const p = g?.getAttribute('position');
      const out: string[] = [];
      for (let i = 0; i < (p?.count ?? 0); i++)
        if (Math.abs((p?.getX(i) ?? 0) - x) < 1e-6)
          out.push(`${(p?.getY(i) ?? 0).toFixed(4)}:${(p?.getZ(i) ?? 0).toFixed(4)}`);
      return [...new Set(out)].sort();
    };
    const joint = pair[0]?.s1 ?? 0;
    expect(ends(a, joint)).toEqual(ends(b, joint));
    // Au droit des traverses (à 1,25 m de l'axe), le dessus du lit est au-dessus du sol: elles
    // s'y enfoncent de quelques centimètres et portent les rails.
    const p = a?.getAttribute('position');
    let crest = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < (p?.count ?? 0); i++)
      if (Math.abs((p?.getZ(i) ?? 0) - 97.5) < 1.3) crest = Math.max(crest, p?.getY(i) ?? 0);
    expect(crest).toBeGreaterThan(0.03);
    expect(crest).toBeLessThan(TILE_SETTINGS.rail.sleeper.h);
    // Le bord extérieur passe sous le sol: aucune lame posée sur l'herbe.
    let edge = Number.POSITIVE_INFINITY;
    for (let i = 0; i < (p?.count ?? 0); i++)
      if (Math.abs((p?.getZ(i) ?? 0) - 97.5) > 3.4) edge = Math.min(edge, p?.getY(i) ?? 0);
    expect(edge).toBeLessThan(0);
  });

  it('tient le budget de la vue du quai (12 000 triangles de plus au plus)', () => {
    // La vue du quai charge les tuiles 29, 30, 41 et 42 (relevé du banc `ensemble`, voie-quai).
    const triangles = [29, 30, 41, 42]
      .flatMap((tile) => layout.inTile(tile))
      .reduce((sum, m) => sum + (DECOR_MANIFEST.models[m.model]?.triangles ?? 0), 0);
    expect(triangles).toBeGreaterThan(3000);
    expect(triangles).toBeLessThan(12000);
  });

  it('pose une sorte factice ajoutée par les seules données', () => {
    const manifest: DecorManifest = {
      ...DECOR_MANIFEST,
      models: {
        ...DECOR_MANIFEST.models,
        'lit-factice': {
          ...(DECOR_MANIFEST.models['rail-bed'] ?? { size: { w: 7, h: 0.1, d: 1 } }),
        },
      },
    } as DecorManifest;
    const settings = {
      ...TRACK_BED,
      sorts: [{ pourquoi: 'essai', model: 'lit-factice' }],
    } as unknown as typeof TRACK_BED;
    const fake = layTrackBeds(map, field, all, settings, manifest);
    expect(fake.modules.length).toBeGreaterThan(300);
    expect(fake.modules.every((m) => m.model === 'lit-factice')).toBe(true);
  });
});
