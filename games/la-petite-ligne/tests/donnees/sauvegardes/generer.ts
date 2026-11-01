// Fabrique les sauvegardes de référence du format en cours (`DATA_SCHEMA`), jouées par le robot.
// Lancement: voir `generer.config.ts`. Un fichier qui existe déjà n'est jamais réécrit: une
// référence garde la forme exacte d'une version publiée. Quand le format change, on ajoute des
// références du nouveau format et les anciennes restent, pour prouver que la migration les relit.
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { snapshotOf } from '../../../src/sauvegarde/sauvegarde';
import type { Sim } from '../../../src/simulation/contexte';
import { DATA_SCHEMA, SIM_HZ } from '../../../src/simulation/constantes';
import { createRobot, newSim, play } from '../../aides';

const MAX_TICKS = SIM_HZ * 60 * 120;
const NOON = 12 * 60;

interface Reference {
  file: string;
  seed: number;
  until: (sim: Sim) => boolean;
  /** Format à partir duquel la référence existe (la suite après le jour 15: format 5). */
  fromSchema?: number;
  /** Seul format pour lequel la référence se fabrique (une étape qui a changé ensuite). */
  onlySchema?: number;
}

const REFERENCES: readonly Reference[] = [
  {
    // Fin de la semaine 1: commande du jour 8 payée, le train parti, aucune scène en cours.
    file: `format-${String(DATA_SCHEMA)}-fin-semaine-1.json`,
    seed: 42,
    until: (s) =>
      s.world.orderHistory.length === 1 && s.world.scene === null && s.world.scripts.length === 0,
  },
  {
    // Milieu de la semaine 2: jour 11 à midi.
    file: `format-${String(DATA_SCHEMA)}-milieu-semaine-2.json`,
    seed: 7,
    until: (s) => s.world.clock.day === 11 && s.world.clock.minutes >= NOON,
  },
  {
    // Fin de la démo (tour 8): jour 15, commande 2 payée, scènes jouées, écran de fin ou d'étape.
    file: `format-${String(DATA_SCHEMA)}-fin-de-la-demo.json`,
    seed: 42,
    until: (s) => s.world.phase === 'ended',
  },
  {
    // Été (tour 8): la partie restée à la Halte, mardi 25 à midi, commande générée du samedi 29 en cours.
    file: `format-${String(DATA_SCHEMA)}-ete-jour-25.json`,
    seed: 7,
    until: (s) => s.world.clock.day === 25 && s.world.clock.minutes >= NOON,
    fromSchema: 5,
  },
  {
    // Fin de l'été (tour 8, pour le tour 9): écran d'étape du jour 43, « Six semaines », sans « Rester ».
    file: `format-${String(DATA_SCHEMA)}-fin-ete-jour-43.json`,
    seed: 7,
    until: (s) => s.world.phase === 'ended' && s.world.stages.current === 'summer_end',
    onlySchema: 5,
  },
  {
    // Fin de l'automne (tour 9): restés à la Halte, jeudi 62 à midi, commande du samedi 64 en cours.
    file: `format-${String(DATA_SCHEMA)}-automne-jour-62.json`,
    seed: 7,
    until: (s) => s.world.clock.day === 62 && s.world.clock.minutes >= NOON,
    fromSchema: 6,
  },
];

it('fabrique les sauvegardes de référence manquantes', () => {
  for (const ref of REFERENCES) {
    const path = fileURLToPath(new URL(ref.file, import.meta.url));
    if (existsSync(path) || DATA_SCHEMA < (ref.fromSchema ?? 1) || (ref.onlySchema !== undefined && DATA_SCHEMA !== ref.onlySchema)) continue;
    const sim = newSim(ref.seed);
    play(sim, createRobot({ stages: 'stay' }), ref.until, MAX_TICKS * 12);
    expect(ref.until(sim), `${ref.file}: moment atteint`).toBe(true);
    writeFileSync(path, `${JSON.stringify(snapshotOf(sim), null, 2)}\n`);
  }
});
