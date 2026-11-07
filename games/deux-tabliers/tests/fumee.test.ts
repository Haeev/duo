// Test de fumée (quelques secondes): données valides, puis le jeu chargé à deux par le faux hôte,
// avec un déplacement prédit par l'invité, une prise d'objet et l'arbitrage d'une prise simultanée.
import { parseManifest } from '@duo/sdk';
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { loadContent } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { createRobot, type Robot } from '../src/robots/robot';
import { createSession } from '../src/session';
import type { GameEvent } from '../src/simulation/evenements';
import { WORLD_FORMAT } from '../src/etat/monde';
import { heldObject } from '../src/simulation/monde';

const DT = 1 / 60;

describe('Deux Tabliers, fumée', () => {
  it('a un manifeste et des données valides', () => {
    expect(parseManifest(manifest)).toMatchObject({ ok: true });
    const content = loadContent(DATA_FILES);
    expect(content.plan.title).toContain('Ormeval');
    expect(content.start.furniture.length).toBeGreaterThan(20);
  });

  it('à deux: l’invité marche, prend une tasse; deux prises du même objet, une seule gagne', async () => {
    const content = loadContent(DATA_FILES);
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 3,
    });
    try {
      await duo.start();
      const t0 = performance.now();
      const now = (): number => performance.now() - t0;
      const host = createSession({ duo: duo.hostGame, content, now });
      const guest = createSession({ duo: duo.guestGame, content, now });
      const world = host.hostWorld();
      if (world === null) throw new Error('hôte sans monde');
      const guestEvents: GameEvent[] = [];
      guest.view.onEvent((e) => guestEvents.push(e));

      let seq = 0;
      const run = async (hostRobot: Robot, guestRobot: Robot, maxSteps: number): Promise<void> => {
        for (let i = 0; i < maxSteps && !(hostRobot.done() && guestRobot.done()); i++) {
          seq++;
          const h = hostRobot.next(host.view, seq);
          const g = guestRobot.next(guest.view, seq);
          host.step(h.input, h.intents, DT);
          guest.step(g.input, g.intents, DT);
          host.beforeFrame(1, DT);
          guest.beforeFrame(1, DT);
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
        // Laisser arriver les derniers messages.
        const idle = createRobot([{ kind: 'wait', steps: 30 }]);
        for (let i = 0; i < 30; i++) {
          seq++;
          host.step(idle.next(host.view, seq).input, [], DT);
          guest.step(idle.next(guest.view, seq).input, [], DT);
          guest.beforeFrame(1, DT);
          await new Promise((resolve) => setTimeout(resolve, 2));
        }
      };
      const sit = (): Robot => createRobot([{ kind: 'wait', steps: 1 }]);

      // L'invité longe l'arrière-comptoir vers l'ouest et prend la tasse posée en « b ».
      const start = { x: world.players[1].x, z: world.players[1].z };
      await run(
        sit(),
        createRobot([
          { kind: 'walk', x: 8.9, z: 8.2 },
          { kind: 'act', target: { kind: 'object', id: 2 } },
        ]),
        400,
      );
      expect(guest.ready()).toBe(true);
      expect(
        Math.hypot(world.players[1].x - start.x, world.players[1].z - start.z),
      ).toBeGreaterThan(0.4);
      // Prédiction et hôte d'accord à quelques centimètres près.
      const predicted = guest.view.world().players[1];
      expect(
        Math.hypot(predicted.x - world.players[1].x, predicted.z - world.players[1].z),
      ).toBeLessThan(0.05);
      expect(heldObject(world, 1)?.id).toBe(2);
      expect(heldObject(guest.view.world(), 1)?.id).toBe(2);

      // Les deux visent la même tasse « a » au même pas: l'hôte l'emporte, l'invité lit « Déjà pris ».
      const same = { kind: 'object', id: 1 } as const;
      await run(
        createRobot([{ kind: 'act', target: same }]),
        createRobot([
          { kind: 'drop', target: { kind: 'slot', furniture: 'backbar-1', slot: 'b' } },
          { kind: 'act', target: same },
        ]),
        10,
      );
      expect(heldObject(world, 0)?.id).toBe(1);
      expect(heldObject(world, 1)).toBeUndefined();
      expect(world.objects.filter((o) => o.id === 1)).toHaveLength(1);
      expect(
        guestEvents.some((e) => e.type === 'refused' && e.player === 1 && e.reason === 'Déjà pris'),
      ).toBe(true);
      expect(host.snapshot()?.dataSchema).toBe(WORLD_FORMAT);
    } finally {
      duo.dispose();
    }
  });
});
