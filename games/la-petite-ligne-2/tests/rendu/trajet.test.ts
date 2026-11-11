// Scène du trajet: le train entre en gare, on monte, il roule, il arrive, on descend. Tout se
// déduit du temps de la scène lu dans l'état: l'hôte et l'invité voient la même image.
import { describe, expect, it } from 'vitest';
import { TRIP_SETTINGS } from '../../src/rendu/voyage/reglages';
import { createTripFrame, doorX, tripFrame } from '../../src/rendu/voyage/sequence';
import { tripSeconds } from '../../src/simulation/voyage/index';
import { gameContent, newSim } from '../aides';
import { run, send } from '../aides-noyau';

const content = gameContent();
const total = content.settings.travel.minSeconds;

function at(seconds: number): ReturnType<typeof createTripFrame> {
  return tripFrame(seconds, total, createTripFrame());
}

describe('scène du trajet', () => {
  it('enchaîne quai, montée, trajet et arrivée en 12 s au plus', () => {
    expect(total).toBeLessThanOrEqual(12);
    const p = TRIP_SETTINGS.parts;
    expect(p.arrive + p.board + p.ride + p.alight).toBeCloseTo(1);

    const start = at(0);
    expect(start.stage).toBe('arrive');
    expect(start.trainX).toBeLessThan(-20);
    expect(start.players.map((a) => a.where)).toEqual(['quay', 'quay']);

    // À la fin de l'entrée en gare, le train est arrêté au quai.
    const docked = at(total * p.arrive - 0.01);
    expect(docked.trainX).toBeCloseTo(0, 1);
    expect(docked.trainSpeed).toBeLessThan(0.5);

    // On marche vers la portière, puis on est à bord.
    const walking = at(total * (p.arrive + p.board * 0.3));
    expect(walking.stage).toBe('board');
    expect(walking.players[0].speed).toBeGreaterThan(0.3);
    const aboard = at(total * (p.arrive + p.board * 0.95));
    expect(aboard.players.map((a) => a.where)).toEqual(['inside', 'inside']);

    // Le train roule: le décor défile, les personnages restent à leur fenêtre.
    const riding = at(total * (p.arrive + p.board + p.ride / 2));
    expect(riding.stage).toBe('ride');
    expect(riding.trainSpeed).toBeGreaterThan(10);
    expect(riding.worldX).toBeCloseTo(-TRIP_SETTINGS.rideDistance / 2, 0);
    for (const actor of riding.players) {
      const train = TRIP_SETTINGS.train;
      expect(Math.abs(actor.y)).toBeLessThan(train.halfWidth - 0.3);
      // Dans la salle, entre les deux portes de la caisse (pas dans une cabine).
      expect(actor.x).toBeGreaterThan(doorX() + 0.4);
      expect(actor.x).toBeLessThan(train.center + train.door - 0.4);
    }

    // Arrivée: quai d'arrivée en face, les deux descendus et immobiles, et cela tient ensuite.
    for (const seconds of [total, total + 5]) {
      const end = at(seconds);
      expect(end.stage).toBe('alight');
      expect(end.worldX).toBe(-TRIP_SETTINGS.rideDistance);
      expect(end.players.map((a) => a.where)).toEqual(['arrived', 'arrived']);
      expect(end.players.map((a) => a.speed)).toEqual([0, 0]);
      expect(end.players[0].y).toBeGreaterThan(TRIP_SETTINGS.ground.trackHalfWidth);
    }
  });

  it('lit le temps de la scène dans l’état: la même image chez l’hôte et chez l’invité', () => {
    const sim = newSim(content);
    send(sim, 0, { type: 'board', to: 'essai-halte' });
    send(sim, 1, { type: 'board', to: 'essai-halte' });
    run(sim, 4);
    const seconds = tripSeconds(sim);
    expect(seconds).toBeGreaterThan(3.9);
    // L'invité reçoit le même pas et le même départ: copie de l'état, même image.
    const guest = structuredClone(sim.world);
    expect(at(tripSeconds({ world: guest }))).toEqual(at(seconds));
  });
});
