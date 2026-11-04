import { describe, expect, it } from 'vitest';
import type { TrainPhase } from '../etat/types';
import { type TrainRules, TrainTracker, arrivalLead, locomotivePosition } from './train';

const RULES: TrainRules = {
  days: [1, 8],
  arrival: 600,
  departure: 960,
  firstDay: 1,
  secondsPerGameMinute: 0.35,
  slideSeconds: 6,
  arrivalStopAt: 18.3,
  departureMoveAt: 4.6,
};

function world(day: number, minutes: number, phase: TrainPhase, progress: number): Parameters<TrainTracker['update']>[0] {
  return { phase: 'day', day, minutes, train: { phase, progress } };
}

describe('horloge des séquences du train', () => {
  it('commence l arrivée assez tôt pour que l arrêt tombe sur le jet de vapeur', () => {
    expect(arrivalLead(RULES)).toBeCloseTo(12.3);
    const tracker = new TrainTracker(RULES);
    const startMinutes = 600 - 12.3 / 0.35;
    expect(tracker.update(world(8, startMinutes - 1, 'away', 0), 0).arrival).toBeNull();
    expect(tracker.update(world(8, startMinutes, 'away', 0), 0).arrival).toBeCloseTo(0);
    expect(tracker.update(world(8, startMinutes + 10, 'away', 0), 3.5).arrival).toBeCloseTo(3.5);
    // À 10 h la simulation fait entrer le train: la séquence suit sa progression.
    expect(tracker.update(world(8, 600, 'arriving', 0), 12.3).arrival).toBeCloseTo(12.3);
    expect(tracker.update(world(8, 601, 'arriving', 0.5), 15.3).arrival).toBeCloseTo(15.3);
    expect(tracker.update(world(8, 602, 'stopped', 1), 18.3).arrival).toBeCloseTo(18.3);
    // À l'arrêt, elle avance en temps réel.
    expect(tracker.update(world(8, 640, 'stopped', 1), 32.3).arrival).toBeCloseTo(32.3);
  });

  it('s arrête avec l horloge du jeu avant l entrée du train', () => {
    const tracker = new TrainTracker(RULES);
    const m = 600 - 20;
    const a = tracker.update(world(8, m, 'away', 0), 100).arrival;
    const b = tracker.update(world(8, m, 'away', 0), 130).arrival;
    expect(a).toBe(b);
  });

  it('le départ: le train s ébranle à 4,6 s, à 16 h', () => {
    const tracker = new TrainTracker(RULES);
    const start = 960 - 4.6 / 0.35;
    expect(tracker.update(world(8, start - 1, 'stopped', 1), 0).departure).toBeNull();
    expect(tracker.update(world(8, start, 'stopped', 1), 0).departure).toBeCloseTo(0);
    expect(tracker.update(world(8, 960, 'stopped', 1), 0).departure).toBeCloseTo(4.6);
    expect(tracker.update(world(8, 960, 'departing', 1), 0).departure).toBeCloseTo(4.6);
    expect(tracker.update(world(8, 960, 'departing', 0), 6).departure).toBeCloseTo(10.6);
    expect(tracker.update(world(8, 960, 'away', 0), 6).departure).toBeCloseTo(10.6);
    expect(tracker.update(world(8, 960, 'away', 0), 16).departure).toBeCloseTo(20.6);
  });

  it('le premier jour, le train est déjà à quai: pas d arrivée, mais un départ', () => {
    const tracker = new TrainTracker(RULES);
    const t = tracker.update(world(1, 650, 'stopped', 1), 0);
    expect(t.arrival).toBeNull();
    expect(tracker.update(world(1, 958, 'stopped', 1), 0).departure).not.toBeNull();
  });

  it('une partie reprise train à quai ne rejoue pas l arrivée', () => {
    const tracker = new TrainTracker(RULES);
    expect(tracker.update(world(8, 700, 'stopped', 1), 0).arrival).toBe(Number.POSITIVE_INFINITY);
  });

  it('rien les autres jours', () => {
    const tracker = new TrainTracker(RULES);
    expect(tracker.update(world(4, 590, 'away', 0), 0)).toEqual({ arrival: null, departure: null });
  });

  it('place la locomotive comme le rendu à l entrée, au bord de la carte dehors', () => {
    const g = { stop: { x: 47, y: 13.5 }, slideDistance: 70, departureDirection: -1 as const, offMapX: 0, maxX: 64 };
    const out = { x: 0, y: 0 };
    expect(locomotivePosition(g, 'away', 0, out).x).toBe(0);
    // Arrivée par l'est (le bord opposé au départ): toujours le même sens de marche (retour R06).
    expect(locomotivePosition(g, 'arriving', 0, out).x).toBe(64);
    expect(locomotivePosition(g, 'arriving', 0.5, out).x).toBeGreaterThan(47);
    expect(locomotivePosition(g, 'arriving', 1, out).x).toBe(47);
    expect(locomotivePosition(g, 'stopped', 1, out)).toEqual({ x: 47, y: 13.5 });
    expect(locomotivePosition(g, 'departing', 1, out).x).toBe(47);
    expect(locomotivePosition(g, 'departing', 0, out).x).toBe(0);
  });
});
