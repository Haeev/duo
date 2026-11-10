// Banc de gigue (lot L1): hôte et invité sur un lien virtuel (20, 80, 200 ms; 0 et 5 % de pertes).
// L'invité marche puis s'arrête: réponse locale immédiate, ni recul ni à-coup, arrivée chez l'hôte.
import { afterAll, describe, expect, it } from 'vitest';
import { createGuest, type Guest } from '../src/reseau/invite';
import { createHost, type Host } from '../src/reseau/hote';
import { NET_SETTINGS } from '../src/reseau/reglages';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import type { Sim } from '../src/simulation/noyau/pas';
import { MEMBERS, gameContent, newSim } from './aides';
import {
  FAKE_PREDICTOR,
  WALK_SPEED,
  createVirtualLink,
  fakeAdvance,
  memoryLog,
  type Conditions,
  type VirtualLink,
} from './aides-reseau';

const content = gameContent();
const FRAME_MS = 1000 / 60;
const PER_FRAME = WALK_SPEED / 60;

interface Bench {
  readonly sim: Sim;
  readonly host: Host;
  readonly guest: Guest;
  readonly link: VirtualLink;
  readonly log: ReturnType<typeof memoryLog>;
  readonly events: GameEvent[];
  /** Avance d'une image; renvoie la position x affichée du joueur de l'invité. */
  frame(moveX: number, intent?: Intent): number;
  /** Heure simulée (ms). */
  now(): number;
}

function createBench(conditions: Conditions, seed: number): Bench {
  const sim = newSim(content);
  const clock = { now: 0 };
  const link = createVirtualLink(conditions, seed, () => clock.now);
  const log = memoryLog();
  const host = createHost(sim, link.host, log, 0, { advance: fakeAdvance });
  const guest = createGuest(content, link.guest, MEMBERS[1].id, {
    predictor: FAKE_PREDICTOR,
    now: () => clock.now,
  });
  const events: GameEvent[] = [];
  guest.onEvent((event) => events.push(event));
  host.sendAll();
  let count = 0;
  let seq = 0;
  return {
    sim,
    host,
    guest,
    link,
    log,
    events,
    now: () => clock.now,
    frame(moveX, intent) {
      clock.now += FRAME_MS;
      link.deliver(clock.now);
      if (intent !== undefined) guest.queueIntent(intent);
      // Pas à 30 Hz, images à 60: un pas toutes les deux images.
      if (count % 2 === 0) {
        host.step(idleInput(0));
        seq += 1;
        guest.step({ seq, moveX, moveY: 0, run: false, act: false });
      }
      link.deliver(clock.now);
      const alpha = count % 2 === 0 ? 0 : 0.5;
      count += 1;
      const shown = guest.render(clock.now, alpha);
      return shown?.players[1].body.x ?? Number.NaN;
    },
  };
}

interface WalkRun {
  /** Images entre l'appui et le premier mouvement affiché. */
  readonly responseFrames: number;
  /** Plus grand recul d'une image (m) pendant l'arrêt. */
  readonly worstBack: number;
  /** Plus grand écart (m) entre l'affiché et ce que les commandes du joueur donnent. */
  readonly worstGap: number;
  /** Écart d'une image au pas nominal, en part de ce pas, pendant la marche. */
  readonly worstStride: number;
  /** Écart final (m) entre l'affiché et l'hôte. */
  readonly finalGap: number;
}

function walkRun(conditions: Conditions, seed: number, walkFrames: number): WalkRun {
  const bench = createBench(conditions, seed);
  // Nombre pair d'images avant l'appui: la première image de marche porte un pas.
  for (let i = 0; i < 59; i++) bench.frame(0);
  const start = bench.frame(0);
  const shown: number[] = [];
  const ideal: number[] = [];
  let walked = 0;
  for (let i = 0; i < walkFrames; i++) {
    shown.push(bench.frame(1));
    // Un pas toutes les deux images, affiché à mi-chemin l'image suivante.
    if (i % 2 === 0) walked += 1;
    ideal.push(start + (walked - (i % 2 === 0 ? 1 : 0.5)) * WALK_SPEED * (1 / 30));
  }
  const stopAt = shown.length;
  for (let i = 0; i < 120; i++) {
    shown.push(bench.frame(0));
    ideal.push(start + walked * WALK_SPEED * (1 / 30));
  }
  const responseFrames = shown.findIndex((x) => x > start + 1e-4) + 1;
  let worstBack = 0;
  for (let i = stopAt; i < shown.length; i++)
    worstBack = Math.max(worstBack, (shown[i - 1] ?? 0) - (shown[i] ?? 0));
  let worstGap = 0;
  for (let i = 4; i < shown.length; i++)
    worstGap = Math.max(worstGap, Math.abs((shown[i] ?? 0) - (ideal[i] ?? 0)));
  let worstStride = 0;
  for (let i = 4; i < stopAt; i++)
    worstStride = Math.max(
      worstStride,
      Math.abs((shown[i] ?? 0) - (shown[i - 1] ?? 0) - PER_FRAME) / PER_FRAME,
    );
  const last = shown[shown.length - 1] ?? 0;
  const finalGap = Math.abs(last - bench.sim.world.players[1].body.x);
  expect(bench.log.entries.filter((e) => e.level === 'error')).toEqual([]);
  bench.host.dispose();
  bench.guest.dispose();
  return { responseFrames, worstBack, worstGap, worstStride, finalGap };
}

const MEASURES: Record<string, string> = {};

afterAll(() => {
  process.stdout.write(`banc de gigue: ${JSON.stringify(MEASURES, null, 1)}\n`);
});

describe('banc de gigue', () => {
  for (const latencyMs of [20, 80, 200])
    for (const lossPercent of [0, 5])
      it(`${String(latencyMs)} ms, gigue ${String(latencyMs / 4)} ms, ${String(lossPercent)} % de pertes: réponse immédiate, ni recul ni à-coup`, () => {
        const conditions = { latencyMs, jitterMs: latencyMs / 4, lossPercent };
        let worst = { response: 0, back: 0, gap: 0, stride: 0, final: 0 };
        for (let seed = 1; seed <= 6; seed++)
          for (const walkFrames of [20, 90]) {
            const run = walkRun(conditions, seed, walkFrames);
            worst = {
              response: Math.max(worst.response, run.responseFrames),
              back: Math.max(worst.back, run.worstBack),
              gap: Math.max(worst.gap, run.worstGap),
              stride: Math.max(worst.stride, run.worstStride),
              final: Math.max(worst.final, run.finalGap),
            };
          }
        MEASURES[`${String(latencyMs)}ms-${String(lossPercent)}%`] =
          `réponse ${(worst.response * FRAME_MS).toFixed(0)} ms, recul ${(worst.back * 1000).toFixed(2)} mm, ` +
          `écart ${(worst.gap * 1000).toFixed(2)} mm, foulée ${(worst.stride * 100).toFixed(0)} %, ` +
          `final ${(worst.final * 1000).toFixed(2)} mm`;
        // Réponse locale: le premier mouvement s'affiche dans le dixième de seconde.
        expect(worst.response * FRAME_MS).toBeLessThan(100);
        // Aucun recul visible à l'arrêt (moins d'un millimètre par image).
        expect(worst.back).toBeLessThan(0.001);
        // L'affiché suit les commandes du joueur, à un glissement près après l'arrêt: les
        // commandes devinées par l'hôte pendant un retard (un pas chacune, 5 cm), jamais plus.
        const guessed = NET_SETTINGS.input.guessTicks * WALK_SPEED * SIM_DT;
        expect(worst.gap).toBeLessThan(guessed + 0.001);
        expect(worst.stride).toBeLessThan(0.6);
        expect(worst.final).toBeLessThan(0.001);
      });
});

describe('coussin de gigue', () => {
  for (const latencyMs of [20, 80, 200])
    it(`${String(latencyMs)} ms, gigue ${String(latencyMs / 4)} ms: l’autre joueur avance sans recul ni bond`, () => {
      const conditions = { latencyMs, jitterMs: latencyMs / 4, lossPercent: 0 };
      const bench = createBench(conditions, 5);
      for (let i = 0; i < 60; i++) bench.frame(0);
      // L'hôte marche vers l'est: son personnage est le 0, vu chez l'invité.
      let seq = 0;
      const shown: number[] = [];
      for (let i = 0; i < 150; i++) {
        if (i % 2 === 0)
          bench.sim.world.players[0].body.x += WALK_SPEED * SIM_DT * (i < 90 ? 1 : 0);
        bench.frame(0);
        shown.push(bench.guest.render(bench.now(), 0)?.players[0].body.x ?? Number.NaN);
        seq += 1;
      }
      let back = 0;
      let bound = 0;
      for (let i = 1; i < shown.length; i++) {
        const d = (shown[i] ?? 0) - (shown[i - 1] ?? 0);
        back = Math.max(back, -d);
        bound = Math.max(bound, d / PER_FRAME);
      }
      MEASURES[`autre-${String(latencyMs)}ms`] =
        `recul ${(back * 1000).toFixed(2)} mm, plus grande foulée ${bound.toFixed(2)} fois la normale, ` +
        `coussin ${bench.guest.stats().delayTicks.toFixed(1)} pas, ${String(seq)} images`;
      expect(back).toBeLessThan(0.001);
      expect(bound).toBeLessThan(2.1);
    });
});

describe('prédiction du début de geste', () => {
  function armed(conditions: Conditions): Bench {
    const bench = createBench(conditions, 3);
    bench.sim.world.players[1].aim = 'pommier';
    bench.sim.revisions.players += 1;
    for (let i = 0; i < 40; i++) bench.frame(0);
    return bench;
  }

  for (const latencyMs of [20, 80, 200])
    it(`${String(latencyMs)} ms: le geste part à l’appui, l’hôte confirme sans doublon`, () => {
      const bench = armed({ latencyMs, jitterMs: latencyMs / 4, lossPercent: 5 });
      const pressedAt = bench.now();
      bench.frame(0, { type: 'act' });
      const started = bench.events.findIndex((e) => e.type === 'gesture_started' && e.player === 1);
      expect(started).toBeGreaterThanOrEqual(0);
      // Réponse dans l'image même de l'appui: moins d'un dixième de seconde.
      expect(bench.now() - pressedAt).toBeLessThan(100);
      expect(bench.guest.render(bench.now(), 0)?.players[1].gesture?.clip).toBe('reach');
      for (let i = 0; i < 60; i++) bench.frame(0);
      expect(bench.sim.world.players[1].gesture).not.toBeNull();
      expect(
        bench.events.filter((e) => e.type === 'gesture_started' && e.player === 1),
      ).toHaveLength(1);
      expect(bench.events.filter((e) => e.type === 'refused')).toEqual([]);
    });

  it('un refus de l’hôte coupe le geste prédit et se joue', () => {
    const bench = armed({ latencyMs: 80, jitterMs: 20, lossPercent: 0 });
    // L'autre joueur a pris la cible: l'hôte le sait, l'invité pas encore.
    bench.sim.world.players[1].aim = null;
    bench.frame(0, { type: 'act' });
    expect(bench.guest.render(bench.now(), 0)?.players[1].gesture).not.toBeNull();
    for (let i = 0; i < 30; i++) bench.frame(0);
    expect(bench.events.map((e) => e.type)).toEqual(['gesture_started', 'refused']);
    expect(bench.guest.render(bench.now(), 0)?.players[1].gesture).toBeNull();
  });
});
