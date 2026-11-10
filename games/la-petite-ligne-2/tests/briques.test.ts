// Les briques livrées par le noyau: s'asseoir, ranger, ramasser, parler, dormir. Un test par brique.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { WorldSchema } from '../src/etat/monde';
import { aimOf } from '../src/simulation/briques/visee';
import { gameContent, newSim } from './aides';
import { contentWith, NORTH, put, run, send } from './aides-noyau';

const content = gameContent();

/** Un banc à deux places, un coffre et un lit posés au sud de la gare d'essai. */
const furnished = contentWith(
  [
    { id: 'coffre-essai', bricks: [{ brick: 'store', slots: 2 }] },
    { id: 'lit-essai', size: { w: 2, h: 2 }, bricks: [{ brick: 'sleep', places: 2, wakeAt: 90 }] },
  ],
  [
    { id: 'banc-sud', type: 'banc', x: 20, y: 25.5 },
    { id: 'coffre', type: 'coffre-essai', x: 30.5, y: 25.5 },
    { id: 'lit', type: 'lit-essai', x: 35, y: 26 },
  ],
);

function placeOf(sim: ReturnType<typeof newSim>): NonNullable<(typeof sim.world.places)[string]> {
  const state = sim.world.places[sim.world.common.place];
  if (state === undefined) throw new Error('lieu absent');
  return state;
}

describe('brique sit', () => {
  it('assoit chaque joueur à une place, refuse le troisième appui, relève à la première direction', () => {
    const sim = newSim(furnished);
    put(sim, 0, 19.6, 26.6, NORTH);
    put(sim, 1, 20.4, 26.6, NORTH);
    run(sim, 0.1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'banc-sud', action: 'sit', verb: 'S’asseoir' });
    const events = send(sim, 0, { type: 'act' });
    expect(events).toContainEqual({
      type: 'brick_used',
      player: 0,
      target: 'banc-sud',
      brick: 'sit',
    });
    send(sim, 1, { type: 'act' });
    expect(placeOf(sim).objects['banc-sud']?.sit).toEqual([0, 1]);
    // Assis sur le banc, face à sa façade (le sud), chacun à sa moitié.
    expect(sim.world.players[0].body).toMatchObject({ x: 19.5, y: 25.5, facing: Math.PI / 2 });
    expect(sim.world.players[1].body).toMatchObject({ x: 20.5, y: 25.5 });
    expect(aimOf(sim, 0)).toBeNull();

    const before = sim.world.players[0].needs.sleep;
    sim.world.players[0].needs.sleep = before - 10;
    run(sim, 1);
    expect(sim.world.players[0].needs.sleep).toBeCloseTo(before - 10 + 6 / 60, 6);

    run(sim, 0.5, { moveY: 1 });
    expect(placeOf(sim).objects['banc-sud']?.sit).toEqual([null, 1]);
    expect(sim.world.players[0].body.y).toBeGreaterThan(26.3);
    expect(v.safeParse(WorldSchema, sim.world).success).toBe(true);
  });

  it('montre le refus avant l’appui quand toutes les places sont prises', () => {
    const sim = newSim(furnished);
    placeOf(sim).objects['banc-sud'] = { sit: [1, 1] };
    put(sim, 0, 20, 26.6, NORTH);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'banc-sud', refusal: 'seat-taken' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'seat-taken',
      target: 'banc-sud',
    });
  });
});

describe('brique store', () => {
  it('ouvre le rangement, y dépose une pile de la barre et la reprend', () => {
    const sim = newSim(furnished);
    const player = sim.world.players[0];
    player.toolbar[2] = { item: 'pomme', count: 4 };
    put(sim, 0, 30.5, 26.6, NORTH);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'coffre', action: 'store', verb: 'Ouvrir' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'store_opened',
      player: 0,
      target: 'coffre',
    });
    const place = sim.revisions.place;
    send(sim, 0, { type: 'store_put', target: 'coffre', from: { area: 'toolbar', index: 2 } });
    expect(player.toolbar[2]).toBeNull();
    expect(placeOf(sim).objects.coffre?.store).toEqual([{ item: 'pomme', count: 4 }, null]);
    expect(sim.revisions.place).toBeGreaterThan(place);
    const events = send(sim, 0, { type: 'store_take', target: 'coffre', index: 0 });
    expect(events).toContainEqual({ type: 'item_gained', player: 0, item: 'pomme', count: 4 });
    expect(player.toolbar[0]).toEqual({ item: 'pomme', count: 4 });
    expect(placeOf(sim).objects.coffre?.store).toEqual([null, null]);
  });

  it('ne sert pas de loin', () => {
    const sim = newSim(furnished);
    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 1 };
    put(sim, 0, 30.5, 30, NORTH);
    send(sim, 0, { type: 'store_put', target: 'coffre', from: { area: 'toolbar', index: 0 } });
    expect(placeOf(sim).objects.coffre?.store).toEqual([null, null]);
  });
});

describe('action pickup', () => {
  it('joue un geste court, puis l’objet entre dans les poches', () => {
    const sim = newSim(content);
    placeOf(sim).ground.push({ id: 3, stack: { item: 'pomme', count: 2 }, x: 30.8, y: 30 });
    put(sim, 0, 30, 30, 0);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'sol-3', action: 'pickup', verb: 'Ramasser' });
    const started = send(sim, 0, { type: 'act' });
    expect(started).toContainEqual({
      type: 'gesture_started',
      player: 0,
      clip: 'pickup',
      target: 'sol-3',
    });
    // Pendant le geste, on ne marche pas et rien n'est encore pris.
    run(sim, 0.2, { moveX: 1 });
    expect(sim.world.players[0].body.x).toBe(30);
    expect(placeOf(sim).ground).toHaveLength(1);
    const done = run(sim, content.settings.gestures.pickSeconds);
    expect(done).toContainEqual({
      type: 'gesture_done',
      player: 0,
      clip: 'pickup',
      target: 'sol-3',
    });
    expect(done).toContainEqual({ type: 'item_gained', player: 0, item: 'pomme', count: 2 });
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'pomme', count: 2 });
    expect(sim.world.players[0].gesture).toBeNull();
    expect(placeOf(sim).ground).toHaveLength(0);
  });

  it('deux joueurs sur le même objet: le premier appui gagne, l’autre reçoit un refus', () => {
    const sim = newSim(content);
    placeOf(sim).ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 30, y: 30 });
    put(sim, 0, 29.3, 30, 0);
    put(sim, 1, 30.7, 30, Math.PI);
    send(sim, 0, { type: 'act' });
    send(sim, 1, { type: 'act' });
    const events = run(sim, 1);
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'pomme', count: 1 });
    expect(sim.world.players[1].toolbar[0]).toBeNull();
    expect(events).toContainEqual({ type: 'refused', player: 1, reason: 'gone', target: 'sol-0' });
  });

  it('poches pleines: le refus se lit avant l’appui et l’objet reste au sol', () => {
    const sim = newSim(content);
    const player = sim.world.players[0];
    player.toolbar.fill({ item: 'hache', count: 1 });
    placeOf(sim).ground.push({ id: 0, stack: { item: 'pomme', count: 1 }, x: 30.8, y: 30 });
    put(sim, 0, 30, 30, 0);
    expect(aimOf(sim, 0)?.refusal).toBe('pockets-full');
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'pockets-full',
      target: 'sol-0',
    });
    expect(placeOf(sim).ground).toHaveLength(1);
  });
});

describe('action talk', () => {
  it('ouvre le dialogue de l’habitant, qui se tourne vers le joueur; on ne marche pas en parlant', () => {
    const sim = newSim(content);
    put(sim, 0, 20, 16, NORTH);
    const events = send(sim, 0, { type: 'act' });
    expect(events).toContainEqual({
      type: 'talk_started',
      player: 0,
      villager: 'cheffe-de-gare',
      dialogue: 'accueil',
    });
    expect(sim.world.players[0].talk).toEqual({
      villager: 'cheffe-de-gare',
      dialogue: 'accueil',
      node: 'tri',
    });
    const villager = placeOf(sim).villagers['cheffe-de-gare'];
    expect(villager).toMatchObject({ met: [true, false], talkingWith: 0 });
    expect(villager?.body.facing).toBeCloseTo(Math.PI / 2, 6);
    run(sim, 0.3, { moveX: 1 });
    expect(sim.world.players[0].body.x).toBe(20);
    expect(send(sim, 0, { type: 'talk_close' })).toContainEqual({
      type: 'talk_ended',
      player: 0,
      villager: 'cheffe-de-gare',
    });
    expect(sim.world.players[0].talk).toBeNull();
    expect(placeOf(sim).villagers['cheffe-de-gare']?.talkingWith).toBeNull();
  });
});

describe('brique sleep', () => {
  function bothInBed(minutes: number): ReturnType<typeof newSim> {
    const sim = newSim(furnished);
    sim.world.minutes = minutes;
    sim.world.players[0].needs.sleep = 20;
    sim.world.players[1].needs.sleep = 95;
    put(sim, 0, 34.6, 27.6, NORTH);
    put(sim, 1, 35.4, 27.6, NORTH);
    return sim;
  }

  it('avant l’heure permise, se coucher à deux est une sieste: la nuit ne saute pas', () => {
    const sim = bothInBed(14 * 60);
    send(sim, 0, { type: 'act' });
    send(sim, 1, { type: 'act' });
    run(sim, 1);
    expect(placeOf(sim).objects.lit?.sleep).toEqual([0, 1]);
    expect(sim.world.common.day).toBe(1);
    expect(sim.world.minutes).toBeGreaterThan(14 * 60);
  });

  it('à partir de 15 h, seul on attend l’autre; à deux, réveil à 6 h le lendemain', () => {
    const sim = bothInBed(15 * 60 + 1);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'lit', action: 'sleep', verb: 'Se coucher' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual({ type: 'sleep_waiting', player: 0 });
    run(sim, 1);
    expect(sim.world.common.day).toBe(1);
    const events = send(sim, 1, { type: 'act' });
    expect(events).toContainEqual({ type: 'day_started', day: 2, slept: true });
    expect(sim.world.common.day).toBe(2);
    expect(sim.world.minutes).toBe(furnished.settings.clock.dayStart);
    // Chacun se réveille avec le sommeil du lit, jamais moins que ce qu'il avait.
    expect(sim.world.players[0].needs.sleep).toBe(90);
    expect(sim.world.players[1].needs.sleep).toBe(95);
    run(sim, 1);
    expect(sim.world.common.day).toBe(2);
  });
});
