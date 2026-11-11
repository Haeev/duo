// Aide réglable par joueur (cahier 2.4, CA-23): chaque cran sur chaque mini-jeu, un joueur aidé
// et l'autre non. L'hôte applique le cran envoyé par la machine du joueur (`set_assist`).
import { describe, expect, it } from 'vitest';
import { ASSIST_LEVELS, type AssistLevel } from '../src/etat/joueur';
import { createAssistSync, loadUiSettings, saveUiSettings } from '../src/interface/carnet/memoire';
import { DEFAULT_UI_SETTINGS } from '../src/interface/carnet/lectures';
import { assistFactor, ASSIST } from '../src/simulation/aide/index';
import { stepInsects } from '../src/simulation/collections/insectes';
import { createMinigame, windowScaleOf } from '../src/simulation/cuisine/minijeu';
import { calendarOf } from '../src/simulation/monde/calendrier';
import { morningWeather } from '../src/simulation/monde/meteo';
import type { Sim } from '../src/simulation/noyau/pas';
import {
  pairFatigue,
  pairHoldSeconds,
  pairPhaseAt,
  stepPair,
} from '../src/simulation/peche/a-deux';
import { judgeStrike, zoneHalfOf, type Dip } from '../src/simulation/peche/combat';
import { helpOf } from '../src/simulation/peche/lecture';
import { FISHING } from '../src/simulation/peche/reglages';
import type { FishingLine, PairFight } from '../src/etat/peche';
import { act, contextOf, newSim } from './aides-l3';
import { gameContent } from './aides';
import { put, run } from './aides-noyau';

const content = gameContent();

/** Joueur 0 au cran `level`, joueur 1 laissé à « normal », comme l'hôte le reçoit. */
function aided(level: AssistLevel): Sim {
  const sim = newSim(content);
  act(sim, 0, { type: 'set_assist', level });
  return sim;
}

describe('aide réglable: le cran', () => {
  it('l’hôte range le cran de chacun; l’autre garde le sien', () => {
    for (const level of ASSIST_LEVELS) {
      const sim = aided(level);
      expect(sim.world.players[0].assist ?? 'normal').toBe(level);
      expect(sim.world.players[1].assist).toBeUndefined();
      expect(assistFactor(sim.world, 0)).toBe(ASSIST.factor[level]);
      expect(assistFactor(sim.world, 1)).toBe(1);
    }
    expect(ASSIST.factor).toEqual({ normal: 1, nudge: 1.25, big: 1.5 });
  });

  it('est gardé d’une séance à l’autre et redit à l’hôte tant qu’il ne le porte pas', () => {
    const table = new Map<string, string>();
    const storage = {
      getItem: (k: string): string | null => table.get(k) ?? null,
      setItem: (k: string, v: string): void => void table.set(k, v),
    };
    expect(loadUiSettings(storage, DEFAULT_UI_SETTINGS)).toEqual(DEFAULT_UI_SETTINGS);
    saveUiSettings(storage, { ...DEFAULT_UI_SETTINGS, assist: 'big', toolbarAlways: true });
    const back = loadUiSettings(storage, DEFAULT_UI_SETTINGS);
    expect(back).toMatchObject({ assist: 'big', toolbarAlways: true, shake: true });
    table.set('la-petite-ligne-2.reglages', '{"assist":"tricher"}');
    expect(loadUiSettings(storage, DEFAULT_UI_SETTINGS).assist).toBe('normal');

    const sim = newSim(content);
    const sync = createAssistSync();
    expect(sync.frame(0, sim.world, 1, 'normal')).toBeNull();
    expect(sync.frame(0, sim.world, 1, 'nudge')).toEqual({ type: 'set_assist', level: 'nudge' });
    expect(sync.frame(500, sim.world, 1, 'nudge')).toBeNull();
    expect(sync.frame(1200, sim.world, 1, 'nudge')).not.toBeNull();
    act(sim, 1, { type: 'set_assist', level: 'nudge' });
    expect(sync.frame(1300, sim.world, 1, 'nudge')).toBeNull();
  });
});

describe('aide réglable: pêche seule', () => {
  it('élargit la fenêtre du ferrage et le secteur vert du joueur aidé seul (CA-23)', () => {
    const dips: Dip[] = [{ at: 1, kind: 'plunge' }];
    for (const level of ASSIST_LEVELS) {
      const sim = aided(level);
      for (const p of [0, 1] as const) {
        sim.world.players[p].toolbar[0] = { item: 'canne', count: 1 };
        sim.world.players[p].selected = 0;
      }
      const ratio = helpOf(content, sim.world, 0) / helpOf(content, sim.world, 1);
      expect(ratio).toBeCloseTo(ASSIST.factor[level], 6);
      const mine = helpOf(content, sim.world, 0);
      const other = helpOf(content, sim.world, 1);
      expect(zoneHalfOf(mine) / zoneHalfOf(other)).toBeCloseTo(ASSIST.factor[level], 6);
      const late = 1 + FISHING.bite.strikeWindow * other * 1.4;
      // Un ferrage tardif de 40 %: pris au grand coup de pouce seulement.
      expect(judgeStrike(dips, 0, late, mine)).toBe(level === 'big' ? 'hooked' : 'late');
      expect(judgeStrike(dips, 0, late, other)).toBe('late');
    }
  });
});

describe('aide réglable: pêche à deux', () => {
  const line = { seed: 4321 } as unknown as FishingLine;
  function fight(rodAid: number, netAid: number): PairFight {
    return { netter: 1, since: 0, held: 0, down: true, tired: null, misses: 0, rodAid, netAid };
  }

  it('la canne aidée fatigue plus vite, l’épuisette aidée voit la remontée plus longtemps', () => {
    for (const level of ASSIST_LEVELS) {
      const f = ASSIST.factor[level];
      // Canne aidée, épuisette non, puis l'inverse.
      for (const [rod, net] of [
        [f, 1],
        [1, f],
      ] as const) {
        const pair = fight(rod, net);
        expect(pairHoldSeconds(pair)).toBeCloseTo(FISHING.pair.holdSeconds / rod, 6);
        let ticks = 0;
        while (pair.tired === null && ticks < 30 * 60) stepPair(line, pair, ++ticks);
        expect(pairFatigue(pair)).toBe(1);
        // Remontée: un plongeon de départ, puis la remontée de durée `rise` x aide de l'épuisette.
        const dive = pairPhaseAt(line.seed, 10, 0, undefined, net);
        const rise = pairPhaseAt(line.seed, 10, dive.length + 0.01, undefined, net);
        expect(rise.kind).toBe('rise');
        expect(rise.length).toBeCloseTo(FISHING.pair.rise * net, 6);
        expect(dive.warn).toBeCloseTo(Math.min(dive.length, FISHING.pair.warn * net), 6);
      }
    }
    // Tenir pendant les élans: même suite de phases, moins de pas avec la canne aidée.
    const plain = fight(1, 1);
    const helped = fight(1.5, 1);
    let a = 0;
    let b = 0;
    while (plain.tired === null && a < 3600) stepPair(line, plain, ++a);
    while (helped.tired === null && b < 3600) stepPair(line, helped, ++b);
    expect(b).toBeLessThan(a);
  });

  it('un combat d’avant, sans aides figées, se lit au cran normal', () => {
    const old = { netter: 1, since: 0, held: 0, down: false, tired: null, misses: 0 } as const;
    expect(pairHoldSeconds(old)).toBe(FISHING.pair.holdSeconds);
  });
});

describe('aide réglable: cuisine', () => {
  it('élargit les fenêtres du cuisinier aidé seul', () => {
    for (const level of ASSIST_LEVELS) {
      const sim = aided(level);
      const zone = (player: 0 | 1): number => {
        const game = createMinigame({
          steps: [{ kind: 'heat', count: 1 }],
          seed: 3,
          windowScale: windowScaleOf(1, assistFactor(sim.world, player), false),
        });
        const z = game.view().zone;
        return z === null ? 0 : z.to - z.from;
      };
      expect(zone(0) / zone(1)).toBeCloseTo(ASSIST.factor[level], 6);
    }
  });
});

describe('aide réglable: filet à insectes', () => {
  const PLACE = 'essai-gare';
  /** Un papillon posé, seul, à `distance` m devant le joueur `player` (l'autre loin). */
  function butterflyAt(sim: Sim, player: 0 | 1, distance: number): void {
    run(sim, 1 / 30);
    let day = 1;
    while (!['clear', 'overcast'].includes(morningWeather(content, sim.world.seed, PLACE, day)))
      day++;
    expect(calendarOf(content, day).season).toBe('spring');
    sim.world.common.day = day;
    sim.world.minutes = 600;
    run(sim, 1 / 30);
    const place = sim.world.places[PLACE];
    if (place === undefined) throw new Error('lieu absent');
    const ctx = contextOf(sim);
    for (let i = 0; i < 12 && (place.insects?.list.length ?? 0) === 0; i++) {
      if (place.insects !== undefined) place.insects.at = 0;
      stepInsects(ctx, place);
    }
    const first = place.insects?.list[0];
    if (first === undefined || place.insects === undefined) throw new Error('aucun insecte');
    place.insects.list = [first];
    put(sim, player, first.x - distance, first.y, 0);
    put(sim, player === 0 ? 1 : 0, first.x + 30, first.y + 30, 0);
    sim.world.players[player].toolbar[0] = { item: 'filet', count: 1 };
    sim.world.players[player].selected = 0;
  }
  function swing(sim: Sim, player: 0 | 1): string | null {
    const events = act(sim, player, { type: 'net_swing' });
    const swung = events.find((e) => e.type === 'net_swung');
    return swung?.type === 'net_swung' ? swung.insect : null;
  }

  it('allonge la portée du filet du joueur aidé seul', () => {
    // La portée se lit dans la fiche du filet tenu (1 m pour le filet de base), puis l'aide l'allonge.
    const reach = content.items['filet']?.tool?.reach ?? content.time.file.insects.netReach;
    for (const level of ASSIST_LEVELS) {
      const f = ASSIST.factor[level];
      // Juste au-delà de la portée normale, en deçà de la portée aidée (et l'inverse).
      for (const share of [1.15, 1.4]) {
        const sim = aided(level);
        butterflyAt(sim, 0, reach * share);
        expect(swing(sim, 0) !== null).toBe(share < f);
        const other = aided(level);
        butterflyAt(other, 1, reach * share);
        expect(swing(other, 1)).toBeNull();
      }
    }
  });
});
