// Bâtiments d'un lieu: chaque fiche est valide, a son modèle livré sous budget et tient l'emprise
// et la porte du plan; une fiche factice tirée du gabarit donne un bâtiment sans une ligne de code.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { plan } from '../outils/nouveau';
import {
  BuildingManifestSchema,
  BuildingSheetSchema,
  type BuildingSheet,
} from '../src/donnees/schemas/batiment';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SHEETS = join(ROOT, 'donnees', 'lieux', 'aubrune', 'batiments');
const MODELS = join(ROOT, 'assets', 'lieux', 'aubrune', 'batiments');
const SOURCES = join(ROOT, 'assets-src', 'decors', 'batiments-aubrune');
const TEMPLATES = join(ROOT, 'donnees', '_gabarits');
/** Noms de matériaux stables: le rendu encré en tire la couche de traits. */
const MATERIALS = [
  'pierre',
  'moellon',
  'crepi',
  'tuile',
  'bois',
  'bardage',
  'volet',
  'vitre',
  'metal',
];
const WEIGHT_BUDGET = 25_000_000;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

interface GlbJson {
  readonly materials?: readonly { readonly name: string }[];
  readonly nodes: readonly { readonly name: string }[];
  readonly scenes: readonly { readonly nodes: readonly number[] }[];
}

/** La partie JSON d'un GLB, lue à la main (GLTFLoader ne tourne pas sous Node). */
function glbJson(path: string): GlbJson {
  const data = readFileSync(path);
  expect(data.toString('latin1', 0, 4)).toBe('glTF');
  return JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12))) as GlbJson;
}

const PlanSchema = v.object({
  batiments: v.array(
    v.object({
      id: v.string(),
      rect: v.tuple([v.number(), v.number(), v.number(), v.number()]),
      porte: v.nullable(v.tuple([v.number(), v.number()])),
      gabarit: v.object({ facade_porte: v.optional(v.string()) }),
    }),
  ),
});

const TintsSchema = v.object({
  murs: v.record(v.string(), v.record(v.string(), v.array(v.string()))),
  toit: v.record(v.string(), v.array(v.string())),
  peinture: v.record(v.string(), v.string()),
});

const sheets: BuildingSheet[] = readdirSync(SHEETS)
  .filter((name) => name.endsWith('.json'))
  .map((name) => {
    const sheet = v.parse(BuildingSheetSchema, readJson(join(SHEETS, name)));
    expect(`${sheet.id}.json`, name).toBe(name);
    return sheet;
  });
const manifest = v.parse(BuildingManifestSchema, readJson(join(MODELS, 'batiments.json')));
const map = v.parse(PlanSchema, readJson(join(ROOT, 'donnees', 'lieux', 'aubrune', 'plan.json')));
const tints = v.parse(TintsSchema, readJson(join(SOURCES, 'teintes.json')));

describe("bâtiments d'Aubrune", () => {
  it('ont chacun une fiche valide aux teintes du nuancier du lieu', () => {
    expect(sheets.length).toBeGreaterThanOrEqual(15);
    for (const sheet of sheets) {
      for (const body of [sheet, ...(sheet.annexes ?? [])]) {
        const colours = body.couleurs ?? {};
        if (colours.murs !== undefined)
          expect(Object.keys(tints.murs[body.finition] ?? {}), `${sheet.id}: murs`).toContain(
            colours.murs,
          );
        if (colours.toit !== undefined)
          expect(Object.keys(tints.toit), `${sheet.id}: toit`).toContain(colours.toit);
        for (const slot of ['volets', 'porte', 'menuiseries', 'enseigne'] as const) {
          const tint = colours[slot];
          if (tint !== undefined)
            expect(Object.keys(tints.peinture), `${sheet.id}: ${slot}`).toContain(tint);
        }
      }
    }
  });

  it('ont chacun leur modèle livré, sous son budget, aux matériaux nommés', () => {
    let weight = 0;
    for (const sheet of sheets) {
      const entry = manifest.batiments[sheet.id];
      expect(entry, `${sheet.id}: absent du manifeste, relancer construire.sh`).toBeDefined();
      if (entry === undefined) continue;
      expect(entry.triangles, sheet.id).toBeLessThanOrEqual(sheet.budget ?? 6000);
      expect(entry.emprise, sheet.id).toEqual(sheet.emprise);
      const path = join(MODELS, entry.fichier);
      expect(existsSync(path), path).toBe(true);
      const glb = glbJson(path);
      expect(
        glb.scenes[0]?.nodes.map((index) => glb.nodes[index]?.name),
        sheet.id,
      ).toEqual([sheet.id]);
      for (const material of glb.materials ?? [])
        expect(MATERIALS, `${sheet.id}: matériau`).toContain(material.name);
      weight += entry.octets;
    }
    expect(Object.keys(manifest.batiments).sort()).toEqual(sheets.map((s) => s.id).sort());
    expect(weight).toBeLessThan(WEIGHT_BUDGET);
  });

  it("tiennent l'emprise et la porte du plan", () => {
    for (const building of map.batiments) {
      if (building.porte === null) continue;
      const id = building.id.replaceAll('_', '-');
      const entry = manifest.batiments[id];
      expect(entry, `${id}: bâtiment du plan sans modèle`).toBeDefined();
      if (entry === undefined) continue;
      const [x, y, w, h] = building.rect;
      expect(entry.emprise, id).toEqual({ largeur: w, profondeur: h });
      expect(entry.porte?.facade, id).toBe(building.gabarit.facade_porte);
      expect(entry.porte?.x ?? NaN, `${id}: porte x`).toBeCloseTo(building.porte[0] - x - w / 2, 1);
      expect(entry.porte?.z ?? NaN, `${id}: porte z`).toBeCloseTo(building.porte[1] - y - h / 2, 1);
    }
  });
});

describe('gabarit de bâtiment', () => {
  const planned = plan(TEMPLATES, 'batiment', 'maison-factice', 'aubrune');

  it('donne une fiche valide, au bon endroit', () => {
    expect(planned.map((file) => file.path)).toEqual([
      'lieux/aubrune/batiments/maison-factice.json',
    ]);
    const sheet = v.parse(BuildingSheetSchema, planned[0]?.value);
    expect(sheet.id).toBe('maison-factice');
  });

  // Sans la boîte à outils du studio (Blender), le modèle ne se construit pas: le test passe son tour.
  const hasBlender = spawnSync('duo-python', ['-c', 'import bpy']).status === 0;
  it.skipIf(!hasBlender)(
    'une fiche factice produit un bâtiment valide, sans code',
    () => {
      const folder = mkdtempSync(join(tmpdir(), 'batiment-'));
      try {
        const sheetPath = join(folder, 'maison-factice.json');
        writeFileSync(sheetPath, JSON.stringify(planned[0]?.value));
        execFileSync(
          'duo-python',
          [join(SOURCES, 'construire.py'), '--fiches', sheetPath, '--sortie', folder],
          { stdio: 'pipe' },
        );
        const built = v.parse(BuildingManifestSchema, readJson(join(folder, 'batiments.json')));
        const entry = built.batiments['maison-factice'];
        expect(entry?.triangles ?? 0).toBeGreaterThan(1000);
        expect(entry?.triangles ?? Infinity).toBeLessThanOrEqual(6000);
        expect(entry?.porte).toMatchObject({ facade: 'sud', x: 0, z: 3 });
        expect(entry?.hauteur ?? 0).toBeGreaterThan(7);
        const glb = glbJson(join(folder, 'maison-factice.glb'));
        expect(glb.materials?.map((m) => m.name).sort()).toEqual(
          ['bois', 'crepi', 'metal', 'pierre', 'tuile', 'vitre', 'volet'].sort(),
        );
      } finally {
        rmSync(folder, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
