// Gabarits des lieux (mission M2): un verrou, des portes et un intérieur d'essai ajoutés par des
// données seulement fonctionnent sans toucher au moteur.
import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/donnees/charger';
import { aimOf } from '../src/simulation/briques/visee';
import { findRoute } from '../src/simulation/habitants/chemins';
import { isShopOpen } from '../src/simulation/habitants/lecture';
import {
  closedLockSet,
  edgePassable,
  isLockOpen,
  passageSays,
  playerInterior,
} from '../src/simulation/lieux/index';
import { createSim } from '../src/simulation/noyau/pas';
import { createWorld } from '../src/simulation/noyau/monde';
import { SIM_HZ } from '../src/simulation/noyau/constantes';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { dataFiles, MEMBERS } from './aides';
import { NORTH, put, run, send, SOUTH } from './aides-noyau';

const FACT = 'essai-gare.verrou.essai';

/** Marche vers le sud jusqu'au premier passage de porte (2 s au plus); renvoie ses événements. */
function walkSouthToDoor(sim: ReturnType<typeof createSim>): GameEvent[] {
  for (let i = 0; i < 2 * SIM_HZ; i++) {
    const events = run(sim, 1 / SIM_HZ, { moveY: 1 });
    if (events.some((e) => e.type === 'door_passed')) return events;
  }
  return [];
}

function trial(): ReturnType<typeof createSim> {
  const files = dataFiles() as Record<string, Record<string, unknown>>;
  for (const id of ['barriere-essai', 'portail-essai'])
    files[`commun/meubles/${id}.json`] = {
      schema: 1,
      id,
      name: 'Passage d’essai',
      model: 'essai',
      size: { w: 1, h: 1 },
      solid: true,
      placeable: false,
      series: null,
      bricks: [{ brick: 'passage' }],
    };
  const map = files['lieux/essai-gare/carte.json'];
  if (map === undefined) throw new Error('carte absente');
  map.height = 56;
  map.outdoor = { x: 0, y: 0, w: 40, h: 40 };
  (map.blocked as unknown[]).push({ x: 0, y: 40, w: 40, h: 1 });
  (map.objects as unknown[]).push(
    { id: 'barriere-du-verger', type: 'barriere-essai', x: 4.5, y: 25.5, rotation: 0 },
    { id: 'portail-de-cave', type: 'portail-essai', x: 34.5, y: 28.5, rotation: 0 },
  );
  map.locks = {
    essai: {
      rects: [{ x: 2, y: 24, w: 6, h: 2 }],
      object: 'barriere-du-verger',
      opens: [{ type: 'remembered', key: FACT, equals: true }],
      says: 'La barrière est cadenassée. Pas encore.',
    },
  };
  map.doors = {
    'porte-dehors': { x: 26, y: 28, facing: 0, to: 'porte-salle' },
    'porte-cave': {
      x: 34,
      y: 29,
      facing: 0,
      to: 'porte-cave-salle',
      enter: 'act',
      object: 'portail-de-cave',
      opens: [{ type: 'remembered', key: 'essai-gare.cave.clef', equals: true }],
      says: 'Fermé à clé.',
    },
    'porte-buvette': {
      x: 10,
      y: 28,
      facing: 0,
      to: 'porte-buvette-salle',
      shop: 'buvette-de-la-gare',
    },
  };
  files['lieux/essai-gare/interieurs/salle-d-essai.json'] = {
    schema: 1,
    id: 'salle-d-essai',
    name: "Salle d'essai",
    width: 8,
    height: 6,
    at: { x: 2, y: 44 },
    blocked: [],
    points: {},
    objects: [],
    doors: {
      'porte-salle': { x: 4, y: 5, facing: 2, to: 'porte-dehors' },
      'porte-cave-salle': { x: 1, y: 5, facing: 2, to: 'porte-cave' },
      'porte-buvette-salle': { x: 7, y: 5, facing: 2, to: 'porte-buvette' },
    },
  };
  const content = loadContent(files);
  return createSim(content, createWorld(content, 7, MEMBERS));
}

describe('verrou d’essai', () => {
  it('bloque, se vise avec sa phrase, puis s’ouvre au fait d’histoire chez les deux joueurs', () => {
    const sim = trial();
    put(sim, 0, 5, 27.5, NORTH);
    run(sim, 2, { moveY: -1 });
    expect(sim.world.players[0].body.y).toBeGreaterThan(26);
    const aim = aimOf(sim, 0);
    expect(aim).toMatchObject({ id: 'barriere-du-verger', action: 'passage', refusal: 'not-yet' });
    expect(passageSays(sim, 'barriere-du-verger')).toBe('La barrière est cadenassée. Pas encore.');
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'not-yet',
      target: 'barriere-du-verger',
    });
    sim.world.progress.memory[FACT] = { v: true, by: 'duo', day: 1 };
    const events = run(sim, 2, { moveY: -1 });
    expect(events).toContainEqual({
      type: 'lock_opened',
      lock: 'essai',
      object: 'barriere-du-verger',
    });
    expect(isLockOpen(sim, 'essai')).toBe(true);
    // Ouvert: on passe, et la barrière n'est plus une cible.
    expect(sim.world.players[0].body.y).toBeLessThan(24);
    put(sim, 0, 4.5, 27, NORTH);
    expect(aimOf(sim, 0)?.id).not.toBe('barriere-du-verger');
  });
});

describe('portes et intérieur d’essai', () => {
  it('en marchant dessus: on entre, on ressort; l’autre joueur reste dehors', () => {
    const sim = trial();
    put(sim, 0, 26.5, 26.5, SOUTH);
    const entering = walkSouthToDoor(sim);
    expect(entering).toContainEqual({
      type: 'door_passed',
      player: 0,
      door: 'porte-dehors',
      to: 'porte-salle',
      interior: 'salle-d-essai',
    });
    expect(playerInterior(sim, 0)).toBe('salle-d-essai');
    expect(playerInterior(sim, 1)).toBeNull();
    // Arrivé dans la salle, le dos à la porte: il n'en ressort pas sans le vouloir.
    run(sim, 0.5);
    expect(playerInterior(sim, 0)).toBe('salle-d-essai');
    const leaving = walkSouthToDoor(sim);
    expect(leaving.find((e) => e.type === 'door_passed')).toMatchObject({ interior: null });
    expect(playerInterior(sim, 0)).toBeNull();
    // Dehors, le dos à la porte: il continue sans y être renvoyé.
    expect(run(sim, 1, { moveY: 1 }).some((e) => e.type === 'door_passed')).toBe(false);
    expect(sim.world.players[0].body.y).toBeGreaterThan(30);
  });

  it('à la touche d’action, fermée à clé par une condition', () => {
    const sim = trial();
    put(sim, 0, 34.5, 29.9, NORTH);
    expect(aimOf(sim, 0)).toMatchObject({ id: 'portail-de-cave', refusal: 'door-locked' });
    expect(send(sim, 0, { type: 'act' })).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'door-locked',
      target: 'portail-de-cave',
    });
    expect(passageSays(sim, 'portail-de-cave')).toBe('Fermé à clé.');
    sim.world.progress.memory['essai-gare.cave.clef'] = { v: true, by: 0, day: 1 };
    expect(aimOf(sim, 0)).toMatchObject({ verb: 'Entrer', refusal: null });
    const events = send(sim, 0, { type: 'act' });
    expect(events.find((e) => e.type === 'door_passed')).toMatchObject({ door: 'porte-cave' });
    expect(playerInterior(sim, 0)).toBe('salle-d-essai');
  });

  it('d’un commerce: fermée hors de ses heures, un seul refus par approche', () => {
    const sim = trial();
    sim.world.minutes = 23 * 60;
    expect(isShopOpen(sim, 'buvette-de-la-gare')).toBe(false);
    put(sim, 0, 10.5, 26.5, SOUTH);
    const events = run(sim, 2, { moveY: 1 });
    const refusals = events.filter((e) => e.type === 'refused');
    expect(refusals).toEqual([
      { type: 'refused', player: 0, reason: 'shop-closed', target: 'porte-buvette' },
    ]);
    expect(playerInterior(sim, 0)).toBeNull();
  });
});

describe('habitants et verrous', () => {
  it('une arête à verrou fermé ne se parcourt pas; la grille non plus', () => {
    const sim = trial();
    const closed = closedLockSet(sim);
    expect([...closed]).toEqual(['essai']);
    expect(edgePassable({ a: 'a', b: 'b', kind: 'chemin', lock: 'essai' }, closed)).toBe(false);
    expect(edgePassable({ a: 'a', b: 'b', kind: 'chemin', lock: null }, closed)).toBe(true);
    const place = sim.content.places['essai-gare'];
    const state = sim.world.places['essai-gare'];
    if (place === undefined || state === undefined) throw new Error('lieu absent');
    // Du sud de la barrière au nord: le trajet contourne les cases du verrou fermé.
    const route = findRoute(sim.content, place, state, 4.5, 27.5, 4.5, 21.5, closed);
    for (const p of route.points)
      expect(p.x >= 2 && p.x < 8 && p.y >= 24 && p.y < 26, `${p.x},${p.y}`).toBe(false);
  });
});
