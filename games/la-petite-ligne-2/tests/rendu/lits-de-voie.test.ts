// Lits de voie d'Aubrune (`rendu/lieu/lits-de-voie.ts`): modules le long du tracé réel, coupés
// aux passages à niveau, tranchée à l'approche du tunnel, raccords sans jour d'un module à
// l'autre, ballast sous les traverses, et gabarit (une sorte factice ajoutée par les données).
import { BoxGeometry, type BufferGeometry, Float32BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/donnees/charger';
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
