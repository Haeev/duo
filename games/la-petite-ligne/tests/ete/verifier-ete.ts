/**
 * Invariants d'une partie d'été des robots (tour 8, sections 6.1 et 6.4: I-01 à I-04, I-06) et
 * relevé écrit dans `test-results/robots-ete/` pour le rapport (objectifs mesurés, non bloquants).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import type { SummerRun } from './aides-ete';

/** I-06: l'état reste sous 52 000 octets à chaque aube (borne du tour 9, section 3.8). */
const MAX_STATE_BYTES = 52_000;

export function expectSummer(run: SummerRun, name: string): void {
  const where = `${name} (graine ${String(run.seed)})`;
  expect(run.stalled, `${where}: aucune journée bloquée`).toBeNull();
  expect(run.day, `${where}: jour 43 atteint`).toBe(43);
  expect(run.stage, `${where}: écran « Six semaines »`).toBe('summer_end');
  expect(run.resumeMismatches, `${where}: reprise identique à chaque aube`).toEqual([]);
  // I-03: météo.
  expect(run.weather[16]?.weather, `${where}: jour 16 au soleil`).toBe('sunny');
  let rain = 0;
  let noSun = 0;
  for (let d = 16; d <= 43; d++) {
    const w = run.weather[d];
    if (w === undefined) continue;
    rain = w.weather === 'rain' ? rain + 1 : 0;
    noSun = w.weather === 'sunny' ? 0 : noSun + 1;
    expect(rain, `${where}: pluie le jour ${String(d)}`).toBeLessThanOrEqual(3);
    expect(noSun, `${where}: sans soleil le jour ${String(d)}`).toBeLessThanOrEqual(6);
    if (w.weather === 'rain') expect(w.mist).toBe(false);
  }
  // I-04: commandes tirées (la vérification complète sur 1 000 graines est dans `suite-commande.test.ts`).
  for (let i = 0; i < run.drawn.length; i++) {
    const order = run.drawn[i];
    const before = i === 0 ? null : run.drawn[i - 1];
    if (order === undefined) continue;
    expect(order.lines.length, `${where}: commande ${String(order.number)}`).toBeGreaterThanOrEqual(
      3,
    );
    if (before !== null && before !== undefined) {
      const ids = (o: typeof order): string =>
        o.lines
          .map((l) => l.item)
          .sort()
          .join();
      expect(
        ids(order),
        `${where}: commande ${String(order.number)} différente de la précédente`,
      ).not.toBe(ids(before));
    }
  }
  expect(
    run.orders.map((o) => o.day),
    `${where}: un paiement par samedi`,
  ).toEqual([8, 15, 22, 29, 36, 43]);
  for (const [day, bytes] of Object.entries(run.bytesByDay))
    expect(bytes, `${where}: état au jour ${day}`).toBeLessThan(MAX_STATE_BYTES);
  if (run.profile === 'median') expectMedianGoals(run, where);
  if (run.profile === 'glouton') expectGluttonTrees(run, where);
}

/**
 * Profil médian (seconde vague du tour 8): T8-16, les commandes 3 à 6 complètes (80 % sur les huit
 * graines, vérifié ici graine par graine: au moins 3 sur 4); T8-20, au moins 6 arbres abattables le
 * jour 42, jamais aucun à partir du jour 16 (repousse).
 */
function expectMedianGoals(run: SummerRun, where: string): void {
  const generated = run.orders.filter((o) => o.number >= 3 && o.number <= 6);
  expect(generated, `${where}: commandes 3 à 6 payées`).toHaveLength(4);
  expect(
    generated.filter((o) => o.complete).length,
    `${where}: commandes 3 à 6 complètes (T8-16)`,
  ).toBeGreaterThanOrEqual(3);
  expect(
    run.treesByDay[42] ?? 0,
    `${where}: arbres abattables le jour 42 (T8-20)`,
  ).toBeGreaterThanOrEqual(6);
  for (const [day, trees] of Object.entries(run.treesByDay)) {
    if (Number(day) >= 16)
      expect(trees, `${where}: arbres abattables le jour ${day} (T8-20)`).toBeGreaterThan(0);
  }
}

/** Profil glouton (section 5.1): tout ce qui est debout abattu chaque jour, au plus 5 jours sans arbre. */
function expectGluttonTrees(run: SummerRun, where: string): void {
  let without = 0;
  for (let day = 16; day <= 43; day++) {
    const trees = run.treesByDay[day];
    if (trees === undefined) continue;
    without = trees === 0 ? without + 1 : 0;
    expect(without, `${where}: jours sans arbre au jour ${String(day)}`).toBeLessThanOrEqual(5);
  }
}

/** Relevé lisible d'une partie (objectifs mesurés, section 6.4). */
export function writeSummer(run: SummerRun, name: string): void {
  const folder = fileURLToPath(new URL('../../test-results/robots-ete/', import.meta.url));
  mkdirSync(folder, { recursive: true });
  const generated = run.orders.filter((o) => o.day >= 22);
  const repeats: Record<string, number> = {};
  for (const id of ['p1', 'p2'] as const) {
    const lastHeard = new Map<string, number>();
    let redites = 0;
    for (const [day, line] of run.dailyLines[id]) {
      const before = lastHeard.get(line);
      if (day >= 16 && before !== undefined && day - before < 28) redites++;
      lastHeard.set(line, day);
    }
    const after = run.dailyLines[id].filter(([d]) => d >= 16).length;
    repeats[id] = after === 0 ? 0 : Math.round((1000 * redites) / after) / 10;
  }
  const summary = {
    name,
    seed: run.seed,
    profile: run.profile,
    realSeconds: Math.round(run.realMs / 100) / 10,
    secondsPerDay: Math.round(run.realMs / 43) / 1000,
    generatedOrdersComplete: `${String(generated.filter((o) => o.complete).length)}/${String(generated.length)}`,
    generatedLines: `${String(generated.reduce((n, o) => n + o.linesDone, 0))}/${String(generated.reduce((n, o) => n + o.linesTotal, 0))}`,
    treesDay42: run.treesByDay[42] ?? null,
    minTreesFrom16: Math.min(
      ...Object.entries(run.treesByDay)
        .filter(([d]) => Number(d) >= 16)
        .map(([, n]) => n),
    ),
    maxStateBytes: Math.max(...Object.values(run.bytesByDay)),
    stateBytesDay43MinusDay15: (run.bytesByDay[43] ?? 0) - (run.bytesByDay[15] ?? 0),
    dailyLinesRepeatedPercent: repeats,
  };
  writeFileSync(`${folder}${name}.json`, `${JSON.stringify({ summary, run }, null, 1)}\n`);
}
