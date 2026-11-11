// Appâts, prises uniques et pêche à deux (briques de la pêche): une prise factice ajoutée aux
// données, sans une ligne de moteur, paraît dans son coin, mord à son appât et se pêche à deux.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import { FishingPlaceStateSchema } from '../src/etat/peche';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import type { Sim } from '../src/simulation/noyau/pas';
import { judgeNet, pairPhaseAt } from '../src/simulation/peche/a-deux';
import { shadowsNow, spotById } from '../src/simulation/peche/lecture';
import { gameSeconds, shadowPosition } from '../src/simulation/peche/ombres';
import { FISHING } from '../src/simulation/peche/reglages';
import { remember } from '../src/simulation/regles/memoire';
import { countItem } from '../src/simulation/sac/inventaire';
import { act, contentWith, contextOf, wait } from './aides-l3';
import { newSim } from './aides';
import { playPair, rodInHand } from './aides-peche-a-deux';

type Json = Record<string, unknown>;
const SOUTH = Math.PI / 2;
const BANK = { x: 6.5, y: 28.2 };
const FACT = 'essai-gare.carpe.sortie';

/** Une vieille carpe unique de l'étang de la gare d'essai, de 10 h à 12 h, à la pomme, à deux. */
function withOldCarp(files: Record<string, Json>): void {
  files['commun/prises/vieille-carpe.json'] = {
    schema: 1,
    id: 'vieille-carpe',
    kind: 'fish',
    item: 'carpe',
    places: ['essai-gare'],
    hours: { from: 600, to: 720 },
    weathers: [],
    seasons: [],
    rarity: 'rare',
    difficulty: 4,
    fish: {
      force: 0.8,
      nervousness: 0.4,
      rhythm: { pull: 2, rest: 1.2 },
      stamina: 15,
      feints: 1,
      sizeCm: { min: 60, max: 70 },
      shadow: 'huge',
    },
    unique: {
      spot: 'etang',
      when: [{ type: 'remembered', key: 'essai-gare.carpe.affut' }],
      bait: 'pomme',
      crew: 'pair',
      fact: FACT,
      toBag: true,
    },
  };
}

function atThePond(content: Content): Sim {
  const sim = newSim(content);
  sim.world.common.day = 15;
  sim.world.minutes = 630;
  sim.world.common.weather = 'clear';
  rodInHand(sim, 0, { x: BANK.x, y: BANK.y, facing: SOUTH });
  rodInHand(sim, 1, { x: BANK.x + 2, y: BANK.y, facing: SOUTH });
  wait(sim, SIM_DT);
  return sim;
}

function carpShadow(sim: Sim): boolean {
  const spot = spotById(sim.content, sim.world, 'etang');
  if (spot === null) throw new Error('etang');
  return shadowsNow(sim.content, sim.world, spot).some((s) => s.catch === 'vieille-carpe');
}

function lineOf(sim: Sim, player: 0 | 1): { catch: string; bait?: string } | null {
  return sim.world.places[sim.world.common.place]?.fishing?.lines[player] ?? null;
}

const CAST = { x: BANK.x + 1, y: BANK.y + 3.5 };

describe('pêche: appâts', () => {
  it('un appât fait passer devant les poissons qu’il attire, et se mange à la touche', () => {
    const content = contentWith((files) => {
      const perch = files['commun/prises/perche.json'] as Json;
      perch.baits = [{ item: 'pomme', factor: 5 }];
    });
    const sim = atThePond(content);
    const spot = spotById(content, sim.world, 'etang');
    if (spot === null) throw new Error('etang');
    // Une vague où une perche nage loin d'une autre ombre, sur laquelle on lance.
    let target: { x: number; y: number } | null = null;
    for (let m = 600; m < 1080 && target === null; m += FISHING.waveMinutes) {
      sim.world.minutes = m;
      const shadows = shadowsNow(content, sim.world, spot);
      const seconds = gameSeconds(content, sim.world.common.day, sim.world.minutes);
      const perch = shadows.find((s) => s.catch === 'perche');
      const other = shadows.find((s) => s.catch !== 'perche');
      if (perch === undefined || other === undefined) continue;
      const a = shadowPosition(perch, seconds);
      const b = shadowPosition(other, seconds);
      if (Math.hypot(a.x - b.x, a.y - b.y) > FISHING.biteRadius * 1.5) target = b;
    }
    if (target === null) throw new Error('aucune vague utile');
    for (const p of [0, 1] as const) sim.world.players[p].body.y = BANK.y;
    const plain = act(sim, 0, { type: 'fish_cast', ...target });
    expect(plain.find((e) => e.type === 'refused')).toBeUndefined();
    expect(lineOf(sim, 0)?.catch).not.toBe('perche');
    act(sim, 0, { type: 'fish_cancel' });

    expect(countItem(sim.world.players[0], 'pomme')).toBe(0);
    // Sans pomme au sac, l'appât demandé ne compte pas.
    act(sim, 0, { type: 'fish_cast', ...target, bait: 'pomme' });
    expect(lineOf(sim, 0)?.bait).toBeUndefined();
    act(sim, 0, { type: 'fish_cancel' });

    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 2 };
    act(sim, 0, { type: 'fish_cast', ...target, bait: 'pomme' });
    expect(lineOf(sim, 0)).toMatchObject({ catch: 'perche', bait: 'pomme' });
    // Ligne rangée avant la touche: l'appât reste au sac; à la touche, il est mangé.
    act(sim, 0, { type: 'fish_cancel' });
    expect(countItem(sim.world.players[0], 'pomme')).toBe(2);
    act(sim, 0, { type: 'fish_cast', ...target, bait: 'pomme' });
    act(sim, 0, { type: 'fish_hooked' });
    expect(countItem(sim.world.players[0], 'pomme')).toBe(1);
  });
});

describe('pêche: prise unique à deux', () => {
  it('paraît à son heure et sous sa condition, ne mord qu’à son appât et avec l’épuisette', () => {
    const sim = atThePond(contentWith(withOldCarp));
    expect(carpShadow(sim)).toBe(false);
    remember(contextOf(sim), 'essai-gare.carpe.affut', true, 'duo');
    expect(carpShadow(sim)).toBe(true);
    sim.world.minutes = 800;
    expect(carpShadow(sim)).toBe(false);
    sim.world.minutes = 630;

    // Sans appât, une autre ombre vient.
    act(sim, 0, { type: 'fish_cast', ...CAST });
    expect(lineOf(sim, 0)?.catch).not.toBe('vieille-carpe');
    act(sim, 0, { type: 'fish_cancel' });
    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 2 };
    // L'autre joueur trop loin pour l'épuisette: elle ne vient pas.
    sim.world.players[1].body.x = BANK.x + FISHING.pair.radius + 2;
    act(sim, 0, { type: 'fish_cast', ...CAST, bait: 'pomme' });
    expect(lineOf(sim, 0)?.catch).not.toBe('vieille-carpe');
    act(sim, 0, { type: 'fish_cancel' });
    sim.world.players[1].body.x = BANK.x + 2;
    act(sim, 0, { type: 'fish_cast', ...CAST, bait: 'pomme' });
    expect(lineOf(sim, 0)?.catch).toBe('vieille-carpe');
    // À deux, le pêcheur ne ferre pas lui-même et n'envoie pas de résultat.
    act(sim, 0, { type: 'fish_hooked' });
    act(sim, 0, { type: 'fish_result', outcome: 'landed', strike: 1, log: '' });
    expect(lineOf(sim, 0)?.catch).toBe('vieille-carpe');

    const events = playPair(sim, 0, { wrongNets: 2 });
    expect(events.filter((e) => e.type === 'fish_net_missed')).toHaveLength(2);
    expect(events.find((e) => e.type === 'fish_caught')).toMatchObject({
      catch: 'vieille-carpe',
      player: 0,
      together: true,
      isNew: false,
      record: false,
    });
    expect(countItem(sim.world.players[0], 'pomme')).toBe(1);
    expect(countItem(sim.world.players[0], 'carpe')).toBe(1);
    expect(sim.world.progress.memory[FACT]).toMatchObject({ v: true, by: 'duo' });
    // Sortie une fois, jamais plus: ni ce soir, ni un autre jour.
    expect(carpShadow(sim)).toBe(false);
    sim.world.common.day = 16;
    expect(carpShadow(sim)).toBe(false);
  });

  it('échouer ne coûte que l’appât: elle repart et revient aussitôt', () => {
    const sim = atThePond(contentWith(withOldCarp));
    remember(contextOf(sim), 'essai-gare.carpe.affut', true, 'duo');
    sim.world.players[0].toolbar[0] = { item: 'pomme', count: 2 };
    act(sim, 0, { type: 'fish_cast', ...CAST, bait: 'pomme' });
    const events = playPair(sim, 0, { slack: true });
    expect(events.find((e) => e.type === 'fish_lost')).toMatchObject({ reason: 'escaped' });
    expect(events.find((e) => e.type === 'fish_caught')).toBeUndefined();
    expect(sim.world.progress.memory[FACT]).toBeUndefined();
    expect(carpShadow(sim)).toBe(true);
    act(sim, 0, { type: 'fish_cast', ...CAST, bait: 'pomme' });
    expect(lineOf(sim, 0)?.catch).toBe('vieille-carpe');
  });

  it('juge l’épuisette: au fond, à côté, canne molle, puis la bonne', () => {
    const seed = 1234;
    const at = { kind: 'pull' as const, side: 0 as const, into: 0, length: 1, warn: 0 };
    const phase = pairPhaseAt(seed, 10, 0, { ...at });
    expect(phase.kind).toBe('dive');
    const riseAt = phase.length + 0.5;
    const rise = pairPhaseAt(seed, 10, riseAt, { ...at });
    expect(rise.kind).toBe('rise');
    const line = { seed } as Parameters<typeof judgeNet>[0];
    const tick = 10 + Math.round(riseAt / SIM_DT);
    const pair = { netter: 1, since: 0, held: 3, down: true, tired: 10, misses: 0 } as const;
    expect(judgeNet(line, pair, 10, rise.side)).toBe('deep');
    const wrong = rise.side === 1 ? -1 : 1;
    expect(judgeNet(line, pair, tick, wrong)).toBe('side');
    expect(judgeNet(line, { ...pair, down: false }, tick, rise.side)).toBe('slack');
    expect(judgeNet(line, pair, tick, rise.side)).toBe('landed');
  });
});

describe('pêche: sauvegardes', () => {
  it('une ligne d’avant (sans appât ni pêche à deux) se relit', () => {
    const old = {
      seed: 7,
      taken: ['12-3'],
      lines: [
        {
          spot: 'fosse',
          x: 134,
          y: 127,
          stanceX: 133,
          stanceY: 131,
          shadow: '12-1',
          catch: 'perche',
          seed: 99,
          tick: 1000,
          approach: 2,
          help: 1,
          hooked: false,
        },
        null,
      ],
    };
    expect(v.safeParse(FishingPlaceStateSchema, old).success).toBe(true);
  });
});
