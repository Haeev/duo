// G2 (gauntlet, tour 8): des sauvegardes de référence de chaque époque, rechargées puis jouées
// jusqu'au samedi 43 par les robots qui restent à la Halte, avec sauvegarde et reprise à chaque
// aube (hôte et invité inversés une fois sur deux): aucune aube ne diffère après la reprise, la
// partie arrive à l'écran « Six semaines ». La vraie sauvegarde du jour 15 finie (format 4, celle
// du client) rouvre d'abord l'écran d'étape avec « Rester à la Halte ».
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashState } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import { stageScreen } from '../../src/etat/semaine';
import { decodeSave, restoreWorld, snapshotOf } from '../../src/sauvegarde/sauvegarde';
import { SIM_HZ } from '../../src/simulation/constantes';
import { step } from '../../src/simulation/pas';
import { contentAndMap, createRobot } from '../aides';
import { lasting } from './aides-ete';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };

function reference(file: string): { dataSchema: number; data: unknown } {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL(`../donnees/sauvegardes/${file}`, import.meta.url)), 'utf8')) as {
    dataSchema: number;
    data: unknown;
  };
  return raw;
}

const CASES = [
  { file: 'format-1-milieu-semaine-1.json', day: 4 },
  { file: 'format-3-fin-semaine-1.json', day: 8 },
  { file: 'format-4-fin-de-la-demo.json', day: 15 },
  { file: 'format-5-ete-jour-25.json', day: 25 },
];

describe('G2: sauvegardes de référence jouées jusqu’au samedi 43, reprise à chaque aube', () => {
  for (const c of CASES) {
    it(`${c.file}: du jour ${String(c.day)} au samedi 43`, () => {
      const { content, map } = contentAndMap();
      const ref = reference(c.file);
      let sim = restoreWorld(content, map, decodeSave(structuredClone(ref.data)), ref.dataSchema, [A, B]);
      expect(sim.world.clock.day).toBe(c.day);
      if (c.day === 15) {
        // La sauvegarde du client: l'écran d'étape revient, « Rester » est proposé.
        expect(sim.world.phase).toBe('ended');
        expect(stageScreen(sim.world, content)?.canStay).toBe(true);
        expect(stageScreen(sim.world, content)?.title).toBe("Deux semaines à la Halte d'Aubrune");
      }
      let robot = createRobot({ stages: 'stay' });
      const mismatches: number[] = [];
      let day = sim.world.clock.day;
      let swap = true;
      let dawns = 0;
      const max = SIM_HZ * 60 * 60 * 30;
      for (let t = 0; t < max; t++) {
        if (sim.world.phase === 'ended' && sim.world.stages.current === 'summer_end') break;
        step(sim, robot.decide(sim));
        if (sim.world.clock.day !== day && sim.world.phase === 'breakfast') {
          day = sim.world.clock.day;
          dawns++;
          const snap = snapshotOf(sim);
          const before = hashState(lasting(snap.data));
          sim = restoreWorld(content, map, structuredClone(snap.data), snap.dataSchema, swap ? [B, A] : [A, B]);
          swap = !swap;
          if (hashState(lasting(sim.world)) !== before) mismatches.push(day);
          robot = createRobot({ stages: 'stay' });
        }
      }
      expect(sim.world.clock.day).toBe(43);
      expect(sim.world.stages.current).toBe('summer_end');
      expect(sim.world.stages.passed).toContain('demo');
      expect(dawns).toBe(43 - c.day);
      expect(mismatches, 'aubes qui diffèrent après la reprise').toEqual([]);
      expect(sim.world.orderHistory.at(-1)?.day).toBe(43);
    }, 1_200_000);
  }
});
