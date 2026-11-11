// Points d'accroche du son: sol sous les pas, gestes de cuisine, tourner un meuble, cloche des
// heures, sonnerie du passage à niveau. Chaque test est court (quelques secondes simulées).
import { describe, expect, it } from 'vitest';
import { surfaceUnder } from '../src/audio/sol';
import { soundForEvent } from '../src/audio/regles';
import { loadTables } from '../src/audio/table';
import type { CookStepKind } from '../src/donnees/schemas/recette';
import { strokesFor, BELL } from '../src/simulation/monde/reglages-cloche';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { newSim } from './aides';
import { wait } from './aides-l3';

const tables = loadTables();
const none = (): string | null => 'herbe';

describe('sol sous les pas', () => {
  const small = {
    interiors: [],
    map: {
      width: 4,
      height: 2,
      floor: {
        nature: 'plancher',
        areas: [{ x: 0, y: 0, w: 1, h: 2, nature: 'tapis-de-couloir' }],
      },
    },
  };
  const big = {
    interiors: [{ id: 'cafe', at: { x: 10, y: 10 }, width: 5, height: 4 }],
    map: { width: 40, height: 40, terrain: {} },
  };

  it('lit le plancher et le tapis d un petit lieu', () => {
    // Forme réduite d'un lieu: seuls les champs lus par le résolveur sont fournis.
    const place = small as never;
    expect(surfaceUnder(place, 0.5, 0.5, none)).toBe('tapis');
    expect(surfaceUnder(place, 2.5, 1.5, none)).toBe('bois');
    expect(surfaceUnder(place, 9, 9, none)).toBeNull();
  });

  it('joue le plancher dans une pièce et le sol dessiné dehors', () => {
    const place = big as never;
    expect(surfaceUnder(place, 12, 11, () => 'pave')).toBe('bois');
    expect(surfaceUnder(place, 3, 3, () => 'pave')).toBe('pave');
  });
});

describe('gestes de cuisine', () => {
  const step = (player: 0 | 1, kind?: CookStepKind): GameEvent => ({
    type: 'cook_step_done',
    player,
    recipe: 'r',
    part: 0,
    step: 0,
    grade: 2,
    early: false,
    ...(kind === undefined ? {} : { kind }),
  });

  it('l autre joueur entend le geste, pas soi (qui a eu son signal)', () => {
    expect(soundForEvent(tables.events, step(1, 'chop'), 0)?.sound).toBe('cuisine-decoupe');
    expect(soundForEvent(tables.events, step(1, 'stir'), 0)?.sound).toBe('cuisine-mijote');
    expect(soundForEvent(tables.events, step(1, 'heat'), 0)?.sound).toBe('cuisine-friture');
    expect(soundForEvent(tables.events, step(0, 'chop'), 0)).toBeNull();
    expect(soundForEvent(tables.events, step(1), 0)).toBeNull();
  });

  it('les signaux de l interface existent', () => {
    for (const kind of ['chop', 'stir', 'heat'])
      expect(tables.events.cues[`cuisine-${kind}`]).toBeDefined();
    expect(tables.events.cues['peche-moulinet']).toBeDefined();
  });
});

describe('tourner un meuble', () => {
  it('a sa règle propre', () => {
    const turn: GameEvent = {
      type: 'deco_changed',
      player: 0,
      action: 'rotate',
      prop: null,
      item: 'table',
    };
    expect(soundForEvent(tables.events, turn, 0)?.sound).toBe('meuble-tourner');
  });
});

describe('cloche des heures', () => {
  it('compte les coups sur douze heures', () => {
    expect([7, 12, 13, 19].map(strokesFor)).toEqual([7, 12, 1, 7]);
  });

  it('sonne coup par coup à l heure, en retard de quatre minutes, de jour seulement', () => {
    const sim = newSim();
    sim.world.common.place = BELL.place;
    sim.world.common.phase = 'day';
    // 8 h 03 (cloche) puis 8 h 04: la cloche en retard sonne 8 h à 8 h 04 de jeu.
    sim.world.minutes = 8 * 60 + 3;
    wait(sim, 1 / 30);
    const events = wait(sim, 11);
    const coups = events.filter((e) => e.type === 'clock_struck');
    expect(coups).toHaveLength(3);
    expect(coups[0]).toMatchObject({ hour: 8, stroke: 1, strokes: 8 });
    expect(soundForEvent(tables.events, coups[0] as GameEvent, 0)?.sound).toBe(
      'cloche-marthe-coup',
    );
    // La nuit (3 h), rien.
    const night = newSim();
    night.world.common.place = BELL.place;
    night.world.common.phase = 'day';
    night.world.minutes = 3 * 60 + 59;
    expect(wait(night, 8).filter((e) => e.type === 'clock_struck')).toHaveLength(0);
  });
});

describe('passage à niveau', () => {
  it('sonne tant que la sonnerie de la simulation sonne, et se tait ensuite', () => {
    const on: GameEvent = { type: 'crossing_bell', place: 'aubrune', ringing: true };
    const off: GameEvent = { type: 'crossing_bell', place: 'aubrune', ringing: false };
    expect(soundForEvent(tables.events, on, 0)).toMatchObject({
      sound: 'passage-a-niveau',
      stop: false,
    });
    expect(soundForEvent(tables.events, off, 1)).toMatchObject({
      sound: 'passage-a-niveau',
      stop: true,
    });
    // La sonnerie est tenue: elle reprend sur ses coups jusqu'à ce qu'on la fasse taire.
    const bell = tables.sounds['passage-a-niveau'];
    expect(bell?.loop?.to).toBeGreaterThan(bell?.loop?.from ?? Number.POSITIVE_INFINITY);
    // L'arrivée d'un train ne sonne plus d'elle-même: c'est la rame qui approche qui sonne.
    const started: GameEvent = {
      type: 'calendar_started',
      place: 'aubrune',
      event: 'train-du-samedi',
    };
    expect(soundForEvent(tables.events, started, 0)).toBeNull();
  });
});

describe('draisine', () => {
  const stroke = (kind: 'push' | 'jam' | 'same' | 'alone'): GameEvent => ({
    type: 'vehicle_stroke',
    vehicle: 'draisine',
    player: 1,
    kind,
    quality: 1,
  });

  it('un coup de balancier grince, deux coups ensemble font un choc sourd', () => {
    expect(soundForEvent(tables.events, stroke('push'), 0)).toMatchObject({
      sound: 'draisine-balancier',
      own: false,
      placed: true,
    });
    expect(soundForEvent(tables.events, stroke('alone'), 1)?.sound).toBe('draisine-balancier');
    expect(soundForEvent(tables.events, stroke('jam'), 0)?.sound).toBe('draisine-bloque');
    expect(tables.sounds['draisine-balancier']?.files.length).toBeGreaterThanOrEqual(2);
  });

  it('roule tant qu il avance, se tait à l arrêt ou quand un train le range', () => {
    const roll = 'draisine-roulement-moyenne';
    const started: GameEvent = { type: 'vehicle_started', vehicle: 'draisine' };
    const stopped: GameEvent = {
      type: 'vehicle_stopped',
      vehicle: 'draisine',
      stop: null,
      end: true,
    };
    const putAway: GameEvent = { type: 'vehicle_in', vehicle: 'draisine', reason: 'train' };
    expect(soundForEvent(tables.events, started, 0)).toMatchObject({ sound: roll, stop: false });
    expect(soundForEvent(tables.events, stopped, 0)).toMatchObject({ sound: roll, stop: true });
    expect(soundForEvent(tables.events, putAway, 1)).toMatchObject({ sound: roll, stop: true });
    for (const pace of ['lente', 'moyenne', 'rapide']) {
      const loop = tables.sounds[`draisine-roulement-${pace}`]?.loop;
      expect(loop?.to, pace).toBeGreaterThan(loop?.from ?? Number.POSITIVE_INFINITY);
    }
  });

  it('l annonce d un train n est pas une sonnerie tenue', () => {
    const warning: GameEvent = { type: 'vehicle_warning', vehicle: 'draisine' };
    const hit = soundForEvent(tables.events, warning, 0);
    expect(hit?.sound).toBe('draisine-avertissement');
    expect(tables.sounds[hit?.sound ?? '']?.loop).toBeUndefined();
  });
});

describe('fin d un air joué', () => {
  const finished = (rating: 0 | 1 | 2 | 3, listeners: number): GameEvent => ({
    type: 'music_finished',
    target: 'estrade',
    air: 'air-marche-de-la-halte',
    rating,
    duo: false,
    together: false,
    first: false,
    listeners,
    results: [null, null],
  });

  it('les habitants applaudissent selon le mot, personne n applaudit sans auditeur', () => {
    expect(soundForEvent(tables.events, finished(3, 4), 0)?.sound).toBe(
      'applaudissements-enthousiastes',
    );
    expect(soundForEvent(tables.events, finished(2, 2), 1)?.sound).toBe(
      'applaudissements-chaleureux',
    );
    expect(soundForEvent(tables.events, finished(1, 1), 0)?.sound).toBe('applaudissements-polis');
    expect(soundForEvent(tables.events, finished(0, 3), 0)?.sound).toBe('applaudissements-polis');
    expect(soundForEvent(tables.events, finished(3, 0), 0)).toBeNull();
  });
});

describe('pêche à deux', () => {
  it('l épuisette a son plongeon réussi et son plongeon raté', () => {
    const caught: GameEvent = {
      type: 'fish_caught',
      player: 0,
      catch: 'gardon',
      sizeMm: 120,
      quality: 1,
      count: 1,
      isNew: false,
      record: false,
      together: true,
      big: false,
    };
    expect(soundForEvent(tables.events, caught, 1)?.sound).toBe('epuisette-plonge');
    expect(soundForEvent(tables.events, { ...caught, together: false }, 1)?.sound).toBe(
      'peche-prise',
    );
    const missed: GameEvent = { type: 'fish_net_missed', player: 1, reason: 'side' };
    expect(soundForEvent(tables.events, missed, 0)?.sound).toBe('epuisette-rate');
  });
});
