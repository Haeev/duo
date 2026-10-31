// Gauntlet, tour 2, risque B: une sauvegarde refusée au chargement n'est jamais écrasée. La séance
// joue une partie provisoire sans rien écrire (ni sauvegarde automatique, ni aube, ni fin), et le
// refus est écrit au journal.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { startLocalDuo } from '@duo/sdk-dev';
import type { DuoContext, SaveSnapshot } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import { createSession, type GameAction } from '../src/session';
import { DATA_SCHEMA, SIM_DT } from '../src/simulation/constantes';
import { createRobot, contentAndMap } from './aides';

const FOLDER = new URL('./donnees/sauvegardes/', import.meta.url);

/** La référence la plus récente, abîmée comme dans `sauvegardes-reference.test.ts`. */
function damagedSave(): unknown {
  const file = readdirSync(FOLDER).filter((f) => f.endsWith('.json')).sort().filter((f) => {
    const raw = JSON.parse(readFileSync(fileURLToPath(new URL(f, FOLDER)), 'utf8')) as { dataSchema: unknown };
    return raw.dataSchema === DATA_SCHEMA;
  }).at(-1);
  if (file === undefined) throw new Error('aucune référence du format en cours');
  const raw = JSON.parse(readFileSync(fileURLToPath(new URL(file, FOLDER)), 'utf8')) as { data: Record<string, unknown> };
  const data = raw.data;
  const characters = data.characters as Record<string, unknown>[];
  delete characters[0]?.bag;
  delete data.counters;
  return data;
}

describe('sauvegarde refusée au chargement', () => {
  it('la séance n’écrit plus rien, même après la sauvegarde automatique et l’aube', async () => {
    const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 }, seed: 9 });
    try {
      await duo.start();
      const writes: string[] = [];
      const box: { provider: (() => SaveSnapshot | null) | null } = { provider: null };
      const errors: string[] = [];
      const real = duo.hostGame;
      // Le contexte réel de l'hôte, avec une sauvegarde abîmée chargée et des écritures espionnées.
      const host = Object.create(real) as DuoContext<GameAction>;
      Object.defineProperty(host, 'saves', {
        value: {
          slot: 1,
          loaded: { slot: 1, label: 'abîmée', dataSchema: DATA_SCHEMA, data: damagedSave() },
          provide: (p: () => SaveSnapshot | null) => {
            box.provider = p;
          },
          write: (moment: string) => {
            writes.push(moment);
            return Promise.resolve('ok' as const);
          },
        },
      });
      Object.defineProperty(host, 'log', {
        value: { ...real.log, error: (message: string) => errors.push(message), warn: () => undefined, info: () => undefined },
      });
      const { content, map } = contentAndMap();
      const clock = { now: 0 };
      const session = createSession({ duo: host, content, map, robot: createRobot(), now: () => clock.now });
      const guest = createSession({ duo: duo.guestGame, content, map, robot: createRobot(), now: () => clock.now });
      const sim = session.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      expect(errors.some((e) => e.includes('sauvegarde refusée'))).toBe(true);
      const autosaves: (SaveSnapshot | null)[] = [];
      let seq = 0;
      // Jouer au-delà de l'aube du jour 2 (point de sauvegarde), avec une demande automatique par minute de jeu réel.
      for (let i = 0; i < 30 * 60 * 25 && sim.world.clock.day < 3; i++) {
        session.step({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
        guest.step({ seq, moveX: 0, moveY: 0, actHeld: false });
        clock.now += SIM_DT * 1000;
        session.beforeFrame(1);
        guest.beforeFrame(1);
        if (i % (30 * 60) === 0 && box.provider !== null) autosaves.push(box.provider());
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(sim.world.clock.day).toBeGreaterThanOrEqual(3);
      expect(autosaves.length).toBeGreaterThan(5);
      expect(autosaves.every((s) => s === null), 'aucune sauvegarde automatique fournie').toBe(true);
      expect(writes, 'aucune écriture (aube, fin)').toEqual([]);
      session.dispose();
      guest.dispose();
    } finally {
      duo.dispose();
    }
  }, 300_000);
});
