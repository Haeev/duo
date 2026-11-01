/** Écriture des relevés du robot longue vie (une partie par fichier de test, en parallèle). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import { invariantsOf } from './bilan';
import { type LongOptions, playLong } from './partie';

export const RUNS_FOLDER = fileURLToPath(new URL('../../test-results/longue-vie/parties/', import.meta.url));

/** Joue la partie, écrit son relevé, puis fait échouer le test sur chaque invariant non tenu. */
export function playAndCheck(options: LongOptions): void {
  const run = playLong(options);
  mkdirSync(RUNS_FOLDER, { recursive: true });
  writeFileSync(`${RUNS_FOLDER}${options.name}.json`, `${JSON.stringify(run)}\n`);
  for (const t of invariantsOf(run)) expect.soft(t.held, `${options.name}, ${t.id} ${t.label}: ${t.value}`).toBe(true);
}
