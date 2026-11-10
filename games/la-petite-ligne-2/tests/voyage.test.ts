// Horloge (jour, nuit, lendemain) et voyage en train entre les deux lieux d'essai.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { WorldSchema } from '../src/etat/monde';
import { aimOf } from '../src/simulation/briques/visee';
import { canSkipNight, isNight } from '../src/simulation/noyau/horloge';
import { boardingChoices, tripSeconds } from '../src/simulation/voyage/index';
import { gameContent, newSim } from './aides';
import { contentWith, put, run, send, SOUTH } from './aides-noyau';

const content = gameContent();
const { clock, travel } = content.settings;

describe('horloge', () => {
  it('donne un jour de 30 minutes réelles et une nuit de 20, de 6 h à 20 h 30', () => {
    expect(clock.dayStart).toBe(6 * 60);
    expect(clock.nightStart).toBe(20 * 60 + 30);
    const daySeconds = ((clock.nightStart - clock.dayStart) / 60) * clock.secondsPerHour;
    const nightSeconds = 24 * clock.secondsPerHour - daySeconds;
    expect(daySeconds / 60).toBeCloseTo(30, 0);
    expect(nightSeconds / 60).toBeCloseTo(20, 0);
    expect(daySeconds + nightSeconds).toBe(50 * 60);
    expect(isNight(clock, clock.nightStart)).toBe(true);
    expect(isNight(clock, 3 * 60)).toBe(true);
    expect(isNight(clock, 12 * 60)).toBe(false);
    expect(canSkipNight(clock, 14 * 60 + 59)).toBe(false);
    expect(canSkipNight(clock, 15 * 60)).toBe(true);
    expect(canSkipNight(clock, 2 * 60)).toBe(true);
  });

  it('passe au lendemain tout seul à l’aube, sans que personne dorme', () => {
    const sim = newSim(content);
    sim.world.minutes = clock.dayStart - 0.2;
    const events = run(sim, 1);
    expect(events).toContainEqual({ type: 'day_started', day: 2, slept: false });
    expect(sim.world.common.day).toBe(2);
    expect(sim.world.common.phase).toBe('day');
  });
});

describe('voyage en train', () => {
  it('ne propose le train que sur le quai, et le refuse la nuit', () => {
    const sim = newSim(content);
    expect(boardingChoices(sim, 0)).toEqual(['essai-halte']);
    put(sim, 0, 20, 20, SOUTH);
    expect(boardingChoices(sim, 0)).toEqual([]);
    expect(send(sim, 0, { type: 'board', to: 'essai-halte' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-on-platform',
      target: null,
    });
    sim.world.minutes = travel.to + 30;
    expect(send(sim, 1, { type: 'board', to: 'essai-halte' })).toContainEqual({
      type: 'refused',
      player: 1,
      reason: 'no-train-now',
      target: null,
    });
    expect(sim.world.common.phase).toBe('day');
  });

  it('attend l’autre sans limite, et laisse redescendre en donnant une direction', () => {
    const sim = newSim(content);
    send(sim, 0, { type: 'board', to: 'essai-halte' });
    expect(sim.world.common).toMatchObject({
      phase: 'boarding',
      travel: { to: 'essai-halte', boarded: [true, false] },
    });
    run(sim, 3);
    expect(sim.world.common.phase).toBe('boarding');
    expect(sim.world.common.place).toBe('essai-gare');
    const x = sim.world.players[0].body.x;
    const events = run(sim, 0.5, { moveY: 1 });
    expect(events).toContainEqual({ type: 'train_boarded', player: 0, to: null });
    expect(sim.world.common).toMatchObject({ phase: 'day', travel: null });
    expect(sim.world.players[0].body.y).toBeGreaterThan(5);
    expect(sim.world.players[0].body.x).toBe(x);
  });

  it('part quand les deux sont montés, bascule de lieu, arrive, puis permet le retour', () => {
    const sim = newSim(content);
    const gare = sim.world.places['essai-gare'];
    if (gare === undefined) throw new Error('lieu de départ absent');
    gare.ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 12, y: 12 });
    const minutes = sim.world.minutes;
    send(sim, 0, { type: 'board', to: 'essai-halte' });
    const departed = send(sim, 1, { type: 'board', to: 'essai-halte' });
    expect(departed).toContainEqual({
      type: 'train_departed',
      from: 'essai-gare',
      to: 'essai-halte',
    });
    // Déchargement et chargement: un seul lieu courant, l'ancien figé au jour du départ.
    expect(sim.world.common).toMatchObject({ phase: 'travel', place: 'essai-halte' });
    expect(gare.leftOn).toBe(1);
    expect(sim.world.places['essai-halte']?.objects.banc).toEqual({ sit: [null, null] });
    expect(sim.world.players.map((p) => p.body.x)).toEqual([15.2, 16.8]);
    expect(sim.world.players[0].body.y).toBe(5);

    // Tant que les deux machines n'ont pas chargé, on reste dans le wagon, sans bouger.
    send(sim, 0, { type: 'place_loaded', place: 'essai-halte' });
    run(sim, travel.minSeconds + 1, { moveY: 1 });
    expect(sim.world.common.phase).toBe('travel');
    expect(sim.world.players[0].body.y).toBe(5);
    const arrived = send(sim, 1, { type: 'place_loaded', place: 'essai-halte' });
    expect(arrived).toContainEqual({ type: 'train_arrived', place: 'essai-halte' });
    expect(sim.world.common.phase).toBe('arrival');
    // L'horloge s'arrête dans le wagon, puis prend les heures du trajet d'un coup.
    expect(sim.world.minutes - minutes).toBeCloseTo(travel.clockHours * 60, 0);
    expect(sim.world.progress.opened).toEqual(['essai-gare', 'essai-halte']);
    run(sim, 1.2);
    expect(sim.world.common).toMatchObject({ phase: 'day', travel: null });
    run(sim, 1, { moveY: 1 });
    expect(sim.world.players[0].body.y).toBeGreaterThan(6);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);

    // Retour: le lieu quitté se retrouve tel qu'on l'a laissé.
    put(sim, 0, 15.2, 5, SOUTH);
    send(sim, 0, { type: 'board', to: 'essai-gare' });
    send(sim, 1, { type: 'board', to: 'essai-gare' });
    send(sim, 0, { type: 'place_loaded', place: 'essai-gare' });
    send(sim, 1, { type: 'place_loaded', place: 'essai-gare' });
    run(sim, travel.minSeconds + 1.5);
    expect(sim.world.common).toMatchObject({ phase: 'day', place: 'essai-gare', travel: null });
    expect(sim.world.places['essai-gare']).toBe(gare);
    expect(gare.leftOn).toBeNull();
    expect(gare.ground).toHaveLength(1);
    expect(sim.world.places['essai-halte']?.leftOn).toBe(1);
    expect(sim.world.players.map((p) => p.body.x)).toEqual([19.2, 20.8]);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
  });

  it('dure 12 s au plus, et se passe plus tôt quand les deux appuient sur la touche d’action', () => {
    expect(travel.minSeconds).toBeLessThanOrEqual(12);
    const sim = newSim(content);
    send(sim, 0, { type: 'board', to: 'essai-halte' });
    send(sim, 1, { type: 'board', to: 'essai-halte' });
    send(sim, 0, { type: 'place_loaded', place: 'essai-halte' });
    send(sim, 1, { type: 'place_loaded', place: 'essai-halte' });
    run(sim, 2);
    expect(tripSeconds(sim)).toBeCloseTo(2 + 2 / 30, 1);
    // Une seule voix ne suffit pas: on reste dans le train.
    send(sim, 0, { type: 'act' });
    send(sim, 0, { type: 'act' });
    run(sim, 1);
    expect(sim.world.common.phase).toBe('travel');
    expect(sim.world.common.travel?.skip).toEqual([true, false]);
    expect(send(sim, 1, { type: 'act' })).toContainEqual({
      type: 'train_arrived',
      place: 'essai-halte',
    });
    expect(tripSeconds(sim)).toBe(0);

    // Sans personne pour passer: l'arrivée tombe à la durée réglée, pas plus tard.
    const slow = newSim(content);
    send(slow, 0, { type: 'board', to: 'essai-halte' });
    send(slow, 1, { type: 'board', to: 'essai-halte' });
    send(slow, 0, { type: 'place_loaded', place: 'essai-halte' });
    send(slow, 1, { type: 'place_loaded', place: 'essai-halte' });
    const events = run(slow, travel.minSeconds + 0.1);
    expect(events).toContainEqual({ type: 'train_arrived', place: 'essai-halte' });
  });

  it('prévient quand le chargement de l’autre machine dure', () => {
    const sim = newSim(content);
    send(sim, 0, { type: 'board', to: 'essai-halte' });
    send(sim, 1, { type: 'board', to: 'essai-halte' });
    send(sim, 0, { type: 'place_loaded', place: 'essai-halte' });
    const events = run(sim, travel.slowLoadSeconds + 0.5);
    expect(events).toContainEqual({ type: 'train_waiting', loaded: [true, false] });
    expect(sim.world.common.phase).toBe('travel');
  });
});

describe('brique travel', () => {
  it('un poteau du quai se vise et fait monter dans le train vers le premier lieu desservi', () => {
    const withPole = contentWith(
      [{ id: 'poteau-essai', bricks: [{ brick: 'travel' }] }],
      [{ id: 'poteau', type: 'poteau-essai', x: 22.5, y: 4.5 }],
    );
    const sim = newSim(withPole);
    put(sim, 0, 21.4, 4.5, 0);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'poteau', verb: 'Monter', refusal: null });
    send(sim, 0, { type: 'act' });
    expect(sim.world.common.travel?.boarded[0]).toBe(true);
    expect(sim.world.common.travel?.to).toBe('essai-halte');
    // À bord, la même touche sur le même poteau fait redescendre (plus de touche Entrée provisoire).
    expect(aimOf(sim, 0)).toMatchObject({ id: 'poteau', verb: 'Descendre', refusal: null });
    send(sim, 0, { type: 'act' });
    expect(sim.world.common.travel?.boarded[0] ?? false).toBe(false);
  });
});
