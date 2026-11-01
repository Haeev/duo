/**
 * Mise en place globale du robot longue vie: efface les relevés d'avant, mesure la durée de la
 * suite, puis écrit `test-results/longue-vie.json` et `test-results/longue-vie.md` (section 6.4)
 * à partir des relevés de chaque partie. Les parties manquantes (test filtré) sont absentes du rapport.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { invariantsOf, measuresOf, objectivesOf, reportMarkdown, type Threshold } from './bilan';
import type { LongRun } from './partie';

const RESULTS = fileURLToPath(new URL('../../test-results/', import.meta.url));
const FOLDER = `${RESULTS}longue-vie/`;
const ORDER = ['median-20261030', 'median-1', 'median-2', 'median-3', 'assidu-99', 'glouton-2026', 'rythme-08-5'];
let started = 0;

export function setup(): void {
  rmSync(FOLDER, { recursive: true, force: true });
  mkdirSync(`${FOLDER}parties/`, { recursive: true });
  started = Date.now();
}

export function teardown(): void {
  const seconds = (Date.now() - started) / 1000;
  const parts = `${FOLDER}parties/`;
  if (!existsSync(parts)) return;
  const runs = readdirSync(parts)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(`${parts}${f}`, 'utf8')) as LongRun)
    .sort((a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name))
    .map((run) => ({ run, m: measuresOf(run) }));
  if (runs.length === 0) return;
  let i07: Threshold | null = null;
  if (existsSync(`${FOLDER}i07.json`)) {
    const r = JSON.parse(readFileSync(`${FOLDER}i07.json`, 'utf8')) as { dawns: number; differing: number[] };
    i07 = {
      id: 'I-07',
      label: 'jours 1 à 15 identiques à une partie sans les systèmes nouveaux (graine 1, reprises comprises)',
      value: `${String(r.dawns)} aubes comparées, ${r.differing.length === 0 ? 'aucune ne diffère' : `diffèrent: ${r.differing.join(', ')}`}`,
      threshold: '14 aubes, 0 écart',
      held: r.dawns === 14 && r.differing.length === 0,
    };
  }
  const full = runs.length === ORDER.length;
  const json = {
    suiteSeconds: full ? seconds : null,
    invariants: Object.fromEntries(runs.map(({ run }) => [run.name, invariantsOf(run)])),
    i07,
    objectives: objectivesOf(runs, full ? seconds : null),
    measures: runs.map(({ m }) => m),
    runs: runs.map(({ run }) => run),
  };
  writeFileSync(`${RESULTS}longue-vie.json`, `${JSON.stringify(json)}\n`);
  writeFileSync(`${RESULTS}longue-vie.md`, reportMarkdown(runs, full ? seconds : null, i07));
}
