// Ce que l'outil du plan exporte pour le rendu des grands lieux (plan version 3): la nature des
// parcelles dans le terrain, les tracés des voies ferrées, la nature des repères.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { decodeTerrain } from '../src/donnees/carte';
import { MapSchema } from '../src/donnees/schemas/lieu';
import { planToMap } from '../outils/plan-vers-lieu';

const PLAN = fileURLToPath(new URL('../donnees/lieux/aubrune/plan.json', import.meta.url));
const plan = JSON.parse(readFileSync(PLAN, 'utf8')) as Record<string, unknown>;
const map = v.parse(
  MapSchema,
  JSON.parse(JSON.stringify(planToMap(plan, { place: 'aubrune', annex: 48 }).map)),
);

/** Nature du terrain sous (x, y). */
function groundAt(x: number, y: number): string | undefined {
  const cells = decodeTerrain(map);
  return map.terrain?.legend[cells?.[Math.floor(y) * map.width + Math.floor(x)] ?? 0];
}

describe('plan vers lieu: ce que le rendu lit', () => {
  it('les parcelles portent leur nature, ajoutée au bout de la légende', () => {
    const legend = map.terrain?.legend ?? [];
    expect(legend.slice(0, 3)).toEqual(['hors-jeu', 'herbe', 'champ']);
    for (const name of ['place', 'cimetiere', 'pre', 'labour', 'cour', 'potager'])
      expect(legend.indexOf(name), name).toBeGreaterThanOrEqual(14);
    // Le cimetière, les champs des Delmas, la pâture: plus aucune parcelle en `champ`.
    expect(groundAt(286, 72)).toBe('cimetiere');
    expect(groundAt(240, 176)).toBe('labour');
    expect(groundAt(160, 168)).toBe('pre');
    expect(decodeTerrain(map)?.includes(legend.indexOf('champ'))).toBe(false);
  });

  it('les voies ferrées sont tracées, voies de garage et ligne de l’ouest comprises', () => {
    const rails = map.rails ?? [];
    expect(rails.map((r) => r.id)).toEqual(['ligne', 'ligne-tunnel', 'garage', 'remise']);
    const ligne = rails.find((r) => r.id === 'ligne');
    expect(ligne?.points[0]).toEqual([0, 97.5]);
    expect(rails.find((r) => r.id === 'ligne-tunnel')?.tunnel).toBe(true);
    expect(rails.find((r) => r.id === 'garage')?.points.length).toBeGreaterThanOrEqual(2);
  });

  it('chaque repère dit ce qu’il est: le Vieux Chêne est un arbre, le clocher un clocher', () => {
    const marks = map.landmarks ?? {};
    expect(marks['vieux-chene']?.kind).toBe('arbre');
    expect(marks['gros-noyer']?.kind).toBe('arbre');
    expect(marks.clocher?.kind).toBe('clocher');
    expect(Object.values(marks).every((m) => m.kind !== undefined)).toBe(true);
  });

  it('un plan sans nature ni rail garde l’ancien export', () => {
    const bare = structuredClone(plan) as {
      parcelles: { nature?: string }[];
      reperes: { nature?: string }[];
      rails: unknown[];
    };
    for (const p of bare.parcelles) delete p.nature;
    for (const r of bare.reperes) delete r.nature;
    bare.rails = [];
    const old = planToMap(bare, { place: 'aubrune', annex: 48 }).map as {
      terrain: { legend: string[] };
      rails: unknown[];
    };
    expect(old.terrain.legend).toHaveLength(14);
    expect(old.rails).toEqual([]);
  });
});
