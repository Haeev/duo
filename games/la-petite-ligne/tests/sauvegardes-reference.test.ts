// Sauvegardes de référence (risque 3 du gauntlet, tour 2): de vraies sauvegardes de chaque format,
// gardées dans `tests/donnees/sauvegardes/`, rechargées et jouées jusqu'au lendemain à chaque
// `pnpm test`; et une sauvegarde abîmée en profondeur, refusée proprement au lieu de planter.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { WorldState } from '../src/etat/types';
import {
  decodeSave,
  restoreWorld,
  SaveError,
  snapshotOf,
  TRIAL_STEPS,
} from '../src/sauvegarde/sauvegarde';
import { wrapWorld } from '../src/simulation/contexte';
import { DATA_SCHEMA, SIM_HZ } from '../src/simulation/constantes';
import { step } from '../src/simulation/pas';
import { contentAndMap, createRobot, play } from './aides';

const A = { id: 'membre-a', name: 'Camille', color: '#e07a5f' };
const B = { id: 'membre-b', name: 'Sacha', color: '#3d85c6' };
/** Borne: une journée de jeu dure bien moins d'une heure réelle. */
const MAX_TICKS = SIM_HZ * 60 * 60;
const FOLDER = new URL('./donnees/sauvegardes/', import.meta.url);

interface Reference {
  file: string;
  dataSchema: number;
  data: unknown;
}

function readReference(file: string): Reference {
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL(file, FOLDER)), 'utf8')) as {
    dataSchema: unknown;
    data: unknown;
  };
  if (typeof raw.dataSchema !== 'number') throw new Error(`${file}: dataSchema absent`);
  return { file, dataSchema: raw.dataSchema, data: raw.data };
}

const REFERENCES = readdirSync(FOLDER)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map(readReference);

function dayOf(data: unknown): number {
  const day = (data as { clock?: { day?: unknown } } | null)?.clock?.day;
  if (typeof day !== 'number') throw new Error('jour absent');
  return day;
}

describe('sauvegardes de référence', () => {
  it('existent pour chaque format, du premier au format en cours', () => {
    const formats = [...new Set(REFERENCES.map((r) => r.dataSchema))].sort((a, b) => a - b);
    expect(formats).toEqual(Array.from({ length: DATA_SCHEMA }, (_, i) => i + 1));
  });

  for (const ref of REFERENCES) {
    it(`${ref.file}: se recharge et se joue jusqu'au lendemain, au format en cours`, () => {
      const { content, map } = contentAndMap();
      const day = dayOf(ref.data);
      // L'autre machine héberge cette fois: chacun retrouve quand même son personnage.
      const sim = restoreWorld(
        content,
        map,
        decodeSave(structuredClone(ref.data)),
        ref.dataSchema,
        [B, A],
      );
      expect(sim.world.clock.day).toBe(day);
      expect(sim.world.characters.find((c) => c.playerId === A.id)?.id).toBe('p1');
      // Une partie finie sur l'écran d'étape (jour 15) reprend par « Rester à la Halte » (tour 8).
      const ticks = play(
        sim,
        createRobot({ stages: 'stay' }),
        (s) =>
          s.world.clock.day > day || (s.world.phase === 'ended' && s.world.stages.current === null),
        MAX_TICKS,
      );
      expect(ticks, 'le lendemain arrive').toBeLessThan(MAX_TICKS);
      expect(sim.world.clock.day).toBe(day + 1);
      expect(snapshotOf(sim).dataSchema).toBe(DATA_SCHEMA);
    });
  }
});

describe('sauvegarde abîmée en profondeur', () => {
  const idle = { controls: {}, intents: [] };
  const latest = REFERENCES.filter((r) => r.dataSchema === DATA_SCHEMA).at(-1);

  /** La sauvegarde la plus récente, privée du sac d'un personnage et des compteurs. */
  function damaged(): Record<string, unknown> {
    if (latest === undefined) throw new Error('aucune référence du format en cours');
    const data = structuredClone(latest.data) as Record<string, unknown>;
    const characters = data.characters as Record<string, unknown>[];
    delete characters[0]?.bag;
    delete data.counters;
    return data;
  }

  it('ferait planter le premier pas sans garde-fou (preuve que le cas est réel)', () => {
    const { content, map } = contentAndMap();
    const sim = wrapWorld(content, map, damaged() as unknown as WorldState);
    expect(() => {
      for (let i = 0; i < TRIAL_STEPS; i++) step(sim, idle);
    }).toThrow(TypeError);
  });

  it('est refusée par une SaveError, sans rien changer de la sauvegarde lue', () => {
    const { content, map } = contentAndMap();
    const data = damaged();
    const before = JSON.stringify(data);
    expect(() => restoreWorld(content, map, data, DATA_SCHEMA, [A, B])).toThrow(SaveError);
    expect(() => restoreWorld(content, map, data, DATA_SCHEMA, [A, B])).toThrow(/ne se rejoue pas/);
    expect(JSON.stringify(data)).toBe(before);
  });

  it("une sauvegarde saine sort de l'essai intacte: rien n'avance avant la partie", () => {
    if (latest === undefined) throw new Error('aucune référence du format en cours');
    const { content, map } = contentAndMap();
    const data = structuredClone(latest.data) as WorldState;
    const sim = restoreWorld(content, map, data, DATA_SCHEMA, [A, B]);
    expect(sim.world.tick).toBe((latest.data as WorldState).tick);
    expect(sim.world.rng).toEqual((latest.data as WorldState).rng);
    expect(sim.world.clock).toEqual({ ...(latest.data as WorldState).clock });
  });
});
