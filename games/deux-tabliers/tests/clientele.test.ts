// Chantier clientèle, test court (quelques secondes): une journée accélérée dans Node, sans réseau,
// graine fixe; le service est remplacé par la préparation d'office de `regles.json`.
import { createRandom } from '@duo/sdk';
import { startLocalDuo } from '@duo/sdk-dev';
import { describe, expect, it } from 'vitest';
import manifest from '../duo-game.json';
import type { GameAction } from '../src/actions';
import { standingPose, type CustomerPose } from '../src/clientele/reseau';
import { createSession } from '../src/session';
import { cartonStowed, clockMinutes, jumpToDay, takeServiceOutbox } from '../src/clientele';
import { loadContent, type Content } from '../src/donnees/charger';
import { DATA_FILES } from '../src/donnees/fichiers';
import { IDLE_INPUT, type Intent } from '../src/simulation/entrees';
import type { GameEvent } from '../src/simulation/evenements';
import { createWorld } from '../src/simulation/monde';
import { stepWorld, type QueuedIntent } from '../src/simulation/pas';
import type { SimContext } from '../src/simulation/systemes';

// Sans la prise en main des premiers jours (`warmup`, testée par `premier-jour.test.ts`): ce
// fichier vérifie d'autres règles sur des chiffres relevés avec l'affluence pleine dès le mardi.
const FULL_FILES = {
  ...DATA_FILES,
  'clientele/regles.json': {
    ...(DATA_FILES['clientele/regles.json'] as Record<string, unknown>),
    warmup: [],
  },
};

const DT = 1 / 60;

function withAutoService(content: Content): Content {
  const cc = content.clientele;
  return { ...content, clientele: { ...cc, rules: { ...cc.rules, fallbackPrepSeconds: 4 } } };
}

describe('Deux Tabliers, clientèle', () => {
  it('jour 1 fermé, « On ouvre ? » à deux, une journée servie, bilan, lundi suivant', () => {
    const content = withAutoService(loadContent(FULL_FILES));
    const world = createWorld(content, ['a', 'b']);
    const random = createRandom(7);
    const events: GameEvent[] = [];
    const step = (intents: QueuedIntent[] = []): void => {
      stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, (e) =>
        events.push(e),
      );
    };
    const both = (intent: Intent): void => {
      step([
        { player: 0, intent },
        { player: 1, intent },
      ]);
    };
    step();
    const s = world.clientele;
    expect(s.day).toBe(1);
    expect(s.phase).toBe('monday');
    expect(s.slate.length).toBe(8);
    expect(s.cash).toBe(30000 - 1857);

    both({ type: 'clientele-vote', topic: 'next-day', yes: true });
    expect(s.day).toBe(2);
    expect(s.phase).toBe('prep');
    expect(s.weather).toBe('soleil');
    expect(Object.keys(s.stock).length).toBeGreaterThan(5);

    // Un seul vote n'ouvre pas: l'autre voit « On ouvre ? ».
    step([{ player: 0, intent: { type: 'clientele-vote', topic: 'open', yes: true } }]);
    expect(s.phase).toBe('prep');
    expect(events.some((e) => e.type === 'clientele-ask' && e.topic === 'open')).toBe(true);
    step([{ player: 1, intent: { type: 'clientele-vote', topic: 'open', yes: true } }]);
    expect(s.phase).toBe('service');
    expect(s.arrivals.length).toBeGreaterThan(10);

    // Le service pris par le robot: chaque groupe en tête de file passe commande à la caisse.
    let maxPresent = 0;
    let guard = 0;
    while (s.phase !== 'evening' && guard++ < 60 * 60 * 14) {
      const atRegister = s.groups.some((g) => g.stage === 'register');
      step(
        atRegister && guard % 90 === 0
          ? [{ player: 0, intent: { type: 'clientele-take-order' } }]
          : [],
      );
      const box = takeServiceOutbox(world);
      for (const [ing] of box.cartons) cartonStowed(world, ing);
      maxPresent = Math.max(
        maxPresent,
        s.groups.reduce((n, g) => n + g.size, 0),
      );
    }
    expect(s.phase).toBe('evening');
    expect(clockMinutes(content.clientele, s)).toBeGreaterThanOrEqual(18 * 60);
    const report = s.report;
    expect(report?.served).toBeGreaterThan(5);
    expect(report?.revenue).toBeGreaterThan(0);
    expect(maxPresent).toBeLessThanOrEqual(content.clientele.rules.presentMax - 2);
    // Jamais de joueur bloqué (C15): les clients n'entrent pas dans les collisions des joueurs.
    expect(world.players[0].x).toBeCloseTo(content.start.spawns[0][0], 5);
    expect(s.points).toBeGreaterThan(0);

    both({ type: 'clientele-vote', topic: 'next-day', yes: true });
    expect(s.day).toBe(3);
  }, 60_000);

  it('chaque événement de la démo finit « Réussi » ou « Formidable » sans geste du duo (D-07), puis la fin', () => {
    const content = withAutoService(loadContent(FULL_FILES));
    const world = createWorld(content, ['a', 'b']);
    const random = createRandom(11);
    const events: GameEvent[] = [];
    const step = (intents: QueuedIntent[] = []): void => {
      stepWorld(content, world, [IDLE_INPUT, IDLE_INPUT], intents, DT, random, (e) =>
        events.push(e),
      );
    };
    const sim: SimContext = {
      world,
      content,
      dt: DT,
      random,
      inputs: [IDLE_INPUT, IDLE_INPUT],
      emit: (e) => events.push(e),
    };
    step();
    const s = world.clientele;
    // La terrasse posée, pour l'averse (jours 9 à 13, un jour couvert terrasse ouverte).
    s.purchases.push(['village_terrasse', 1, 1]);
    const days: [number, string[]][] = [
      [4, ['le_car_de_8h12']],
      [6, ['la_vieille_dame_tousse']],
      [7, ['les_godillots']],
      [10, ['le_carnet_vert', 'jules_a_perdu_sa_mamie']],
      [11, ['l_inspection']],
      [12, ['le_cafe_d_honneur']],
      [13, ['le_coeur_de_lait', 'l_averse_de_trois_heures']],
      [14, ['la_fete_du_tilleul']],
    ];
    for (const [day, ids] of days) {
      jumpToDay(sim, day);
      step([
        { player: 0, intent: { type: 'clientele-vote', topic: 'open', yes: true } },
        { player: 1, intent: { type: 'clientele-vote', topic: 'open', yes: true } },
      ]);
      expect(s.phase).toBe('service');
      let guard = 0;
      while (s.phase !== 'evening' && guard++ < 60 * 60 * 14) {
        const atRegister = s.groups.some((g) => g.stage === 'register');
        step(
          atRegister && guard % 90 === 0
            ? [{ player: 0, intent: { type: 'clientele-take-order' } }]
            : [],
        );
        takeServiceOutbox(world);
      }
      expect(s.phase, `jour ${String(day)}`).toBe('evening');
      for (const id of ids)
        expect(['reussi', 'formidable'], `${id} (jour ${String(day)})`).toContain(s.eventsDone[id]);
    }
    // La lettre de René est arrivée au plus tard le soir de la fête (D-03).
    expect(s.letterDay).toBeGreaterThan(0);
    expect(s.letterDay).toBeLessThanOrEqual(14);
    jumpToDay(sim, 15);
    expect(s.phase).toBe('monday');
    step([{ player: 0, intent: { type: 'clientele-vote', topic: 'next-day', yes: true } }]);
    expect(s.day).toBe(15);
    step([
      { player: 0, intent: { type: 'clientele-vote', topic: 'merelles', yes: true } },
      { player: 1, intent: { type: 'clientele-vote', topic: 'merelles', yes: false } },
    ]);
    expect(s.demoEnded).toBe(true);
    expect(s.phase).toBe('end');
  }, 60_000);

  it('à deux: le domaine et les positions des clients debout (canal 7) arrivent chez l’invité', async () => {
    const content = withAutoService(loadContent(FULL_FILES));
    const duo = await startLocalDuo<GameAction>({
      manifest,
      conditions: { latencyMs: 5, jitterMs: 0, spikeProbability: 0 },
      seed: 4,
    });
    try {
      await duo.start();
      const t0 = performance.now();
      const now = (): number => performance.now() - t0;
      const host = createSession({ duo: duo.hostGame, content, now });
      const guest = createSession({ duo: duo.guestGame, content, now });
      const world = host.hostWorld();
      if (world === null) throw new Error('hôte sans monde');
      const vote = (topic: 'next-day' | 'open'): Intent => ({
        type: 'clientele-vote',
        topic,
        yes: true,
      });
      let seq = 0;
      const tick = async (h: Intent[] = [], g: Intent[] = []): Promise<void> => {
        seq++;
        host.step({ ...IDLE_INPUT, seq }, h, DT);
        guest.step({ ...IDLE_INPUT, seq }, g, DT);
        guest.beforeFrame(1, DT);
        await new Promise((resolve) => setTimeout(resolve, 1));
      };
      await tick();
      await tick([vote('next-day')], [vote('next-day')]);
      for (let i = 0; i < 10; i++) await tick();
      await tick([vote('open')], [vote('open')]);
      for (let i = 0; i < 10; i++) await tick();
      expect(world.clientele.phase).toBe('service');
      // Un voisin entre tout de suite: il marche vers la file.
      world.clientele.arrivals.unshift([0, 'voisins', 1, false]);
      for (let i = 0; i < 90; i++) await tick();
      const g = world.clientele.groups[0];
      expect(g?.stage).toMatch(/entering|queue|register/);
      const seen = guest.view.world().clientele;
      expect(seen.day).toBe(2);
      expect(seen.groups.map((x) => x.id)).toContain(g?.id);
      const pose: CustomerPose = { x: 0, z: 0, yawDeg: 0, anim: 'idle' };
      expect(standingPose(guest.view.world(), g?.id ?? -1, now(), pose)).toBe(true);
      const hostPose: CustomerPose = { x: 0, z: 0, yawDeg: 0, anim: 'idle' };
      standingPose(world, g?.id ?? -1, now(), hostPose);
      expect(Math.hypot(pose.x - hostPose.x, pose.z - hostPose.z)).toBeLessThan(0.6);
    } finally {
      duo.dispose();
    }
  }, 30_000);
});
