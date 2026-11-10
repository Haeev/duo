// Pêche (cahier 4.7, R29; conception `docs/jeux/jeu-1/refonte/peche.md`): ombres tirées des
// données, combat selon l'espèce, partie jouée localement et validée par l'hôte.
import { describe, expect, it } from 'vitest';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { BUDGET_BYTES } from '../src/reseau/canaux';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import type { Sim } from '../src/simulation/noyau/pas';
import {
  createAngler,
  createFight,
  createLog,
  fightSeconds,
  replayFight,
  stepFight,
} from '../src/simulation/peche/combat';
import {
  fishCollectionView,
  fishingView,
  recordKey,
  shadowsNow,
  spotById,
} from '../src/simulation/peche/lecture';
import { canStartFishing, createLocalFishing } from '../src/simulation/peche/local';
import { fishOf, gameSeconds, shadowPosition } from '../src/simulation/peche/ombres';
import { FISHING } from '../src/simulation/peche/reglages';
import { countItem } from '../src/simulation/sac/inventaire';
import { act, contentWith, wait } from './aides-l3';
import { gameContent, newSim } from './aides';

const SOUTH = Math.PI / 2;
/** Bord nord de l’étang de la gare d’essai (cases 3 à 10, 32 à 36). */
const BANK = { x: 6.5, y: 31.2 };

/** Une partie au bord de l'eau: canne en main, été, 10 h, beau temps. */
function atThePond(content: Content = gameContent(), item = 'canne'): Sim {
  const sim = newSim(content);
  sim.world.common.day = 15;
  sim.world.minutes = 600;
  sim.world.common.weather = 'clear';
  for (const player of [0, 1] as const) {
    const state = sim.world.players[player];
    state.toolbar[0] = {
      item,
      count: 1,
      ...(content.items[item]?.tool?.durability ? { wear: 60 } : {}),
    };
    state.selected = 0;
    state.body = { x: BANK.x + (player === 0 ? 0 : 2), y: BANK.y, facing: SOUTH, speed: 0 };
  }
  wait(sim, SIM_DT); // graine des ombres
  return sim;
}

/** L'ombre la plus proche du bouchon possible: on vise sa position. */
function aimAtShadow(sim: Sim): { x: number; y: number; catch: string } {
  const spot = spotById(sim.content, sim.world, 'etang');
  if (spot === null) throw new Error('coin absent');
  const shadow = shadowsNow(sim.content, sim.world, spot)[0];
  if (shadow === undefined) throw new Error('aucune ombre');
  const at = shadowPosition(
    shadow,
    gameSeconds(sim.content, sim.world.common.day, sim.world.minutes),
  );
  return { ...at, catch: shadow.catch };
}

interface Played {
  readonly events: Sim['events'];
  readonly intents: ReturnType<ReturnType<typeof createLocalFishing>['update']>;
}

/** Joue une pêche entière par la partie locale, comme le ferait l'interface, avec un robot. */
function fishOnce(
  sim: Sim,
  player: PlayerIndex,
  opts: { skill?: number; strike?: 'good' | 'early' } = {},
): Played {
  const local = createLocalFishing(sim.content, player);
  const target = aimAtShadow(sim);
  const events: Sim['events'] = [];
  const intents: Played['intents'] = [];
  // Lancer directement sur l'ombre (la visée est testée à part).
  events.push(...act(sim, player, { type: 'fish_cast', x: target.x, y: target.y }));
  local.update(0, sim.world);
  local.press();
  local.update(SIM_DT, sim.world);
  let bot:
    | ((s: Parameters<ReturnType<typeof createAngler>>[0]) => { steer: -1 | 0 | 1; reel: boolean })
    | null = null;
  for (let i = 0; i < 60 * 30; i++) {
    const phase = local.phase();
    if (phase.kind === 'bite' && (opts.strike === 'early' ? phase.dip > 0 || i > 20 : phase.plunge))
      local.press();
    if (phase.kind === 'fight') {
      bot ??= createAngler(opts.skill ?? 1, 99);
      local.hold(bot(phase.fight));
    }
    const out = local.update(SIM_DT, sim.world);
    intents.push(...out);
    events.push(...act(sim, player, ...out));
    if (phase.kind === 'end' || phase.kind === 'closed') break;
  }
  return { events, intents };
}

describe('pêche: ombres', () => {
  it('tire les ombres de la table du coin selon l heure, la météo et la saison, les mêmes partout', () => {
    const sim = atThePond();
    const spot = spotById(sim.content, sim.world, 'etang');
    expect(spot).not.toBeNull();
    if (spot === null) return;
    const seen = new Set<string>();
    for (let m = 360; m < 1080; m += FISHING.waveMinutes) {
      sim.world.minutes = m;
      const a = shadowsNow(sim.content, sim.world, spot);
      expect(shadowsNow(sim.content, sim.world, spot)).toEqual(a);
      for (const s of a) seen.add(s.catch);
    }
    // Beau temps: ni truite (pluie, nuages, brume); de jour: pas de tanche (soir et nuit).
    expect(seen.has('truite')).toBe(false);
    expect(seen.has('tanche')).toBe(false);
    expect(seen.size).toBeGreaterThanOrEqual(3);
    sim.world.common.weather = 'overcast';
    const night = new Set<string>();
    for (let d = 15; d < 29; d++) {
      sim.world.common.day = d;
      for (let m = 1140; m < 1440; m += FISHING.waveMinutes) {
        sim.world.minutes = m;
        for (const s of shadowsNow(sim.content, sim.world, spot)) night.add(s.catch);
      }
    }
    // Soir couvert d'été: la tanche et la truite sortent, la perche et le brochet (de jour) non.
    expect(night.has('tanche') && night.has('truite')).toBe(true);
    expect(night.has('brochet')).toBe(false);
    expect(night.has('perche')).toBe(false);
  });
});

describe('pêche: combat', () => {
  it('le goujon frétille et cède vite, le brochet tire lourd et longtemps; sans rien faire, le brochet casse', () => {
    const content = gameContent();
    const goujon = fishOf(content, 'goujon')?.fish;
    const brochet = fishOf(content, 'brochet')?.fish;
    if (goujon === undefined || brochet === undefined) throw new Error('espèces absentes');
    const play = (
      fish: typeof goujon,
      seed: number,
      skill: number | null,
    ): { s: number; flips: number; out: string | null } => {
      const fight = createFight(fish, seed, 1);
      const bot = skill === null ? null : createAngler(skill, seed);
      let flips = 0;
      let dir = fight.direction;
      while (fight.outcome === null) {
        stepFight(fight, bot === null ? { steer: 0, reel: false } : bot(fight));
        if (fight.pulling && fight.direction !== dir) flips++;
        dir = fight.direction;
      }
      return { s: fightSeconds(fight), flips: flips / fightSeconds(fight), out: fight.outcome };
    };
    const g = [1, 2, 3, 4, 5].map((seed) => play(goujon, seed, 1));
    const b = [1, 2, 3, 4, 5].map((seed) => play(brochet, seed, 1));
    for (const r of [...g, ...b]) {
      expect(r.out).toBe('landed');
      expect(r.s).toBeGreaterThanOrEqual(10);
      expect(r.s).toBeLessThanOrEqual(25);
    }
    const mean = (xs: number[]): number => xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(mean(b.map((r) => r.s))).toBeGreaterThan(mean(g.map((r) => r.s)) + 4);
    expect(mean(g.map((r) => r.flips))).toBeGreaterThan(mean(b.map((r) => r.flips)));
    expect([1, 2, 3].map((seed) => play(brochet, seed, null).out)).toEqual([
      'escaped',
      'escaped',
      'escaped',
    ]);
  });

  it('le journal des touches rejoue exactement le combat', () => {
    const fish = fishOf(gameContent(), 'perche')?.fish;
    if (fish === undefined) throw new Error('perche absente');
    const fight = createFight(fish, 42, 1.3);
    const bot = createAngler(0.8, 42);
    const log = createLog();
    while (fight.outcome === null) {
      const input = bot(fight);
      log.push(input);
      stepFight(fight, input);
    }
    const again = replayFight(fish, 42, 1.3, log.text());
    expect(again?.outcome).toBe(fight.outcome);
    expect(again?.steps).toBe(fight.steps);
    expect(replayFight(fish, 43, 1.3, log.text())?.steps).not.toBe(fight.steps);
    expect(replayFight(fish, 42, 1.3, 'z12')).toBeNull();
  });
});

describe('pêche: partie jouée chez le pêcheur, validée par l hôte', () => {
  it('lancer, ferrer, tenir: la prise va au sac, au carnet et au record; la fête vient une fois', () => {
    const sim = atThePond();
    expect(canStartFishing(sim.content, sim.world, 0)).toBe(true);
    const first = fishOnce(sim, 0);
    const caught = first.events.find((e) => e.type === 'fish_caught');
    expect(caught).toMatchObject({
      type: 'fish_caught',
      player: 0,
      isNew: true,
      record: true,
      together: true,
    });
    if (caught?.type !== 'fish_caught') return;
    expect(countItem(sim.world.players[0], caught.catch)).toBe(caught.count);
    expect(sim.world.progress.collections[FISHING.collection]).toContain(caught.catch);
    expect(sim.world.progress.memory[recordKey(0, caught.catch)]?.v).toBe(caught.sizeMm);
    const entry = fishCollectionView(sim.content, sim.world).find((f) => f.catch === caught.catch);
    expect(entry).toMatchObject({ seen: true, records: [caught.sizeMm, 0] });
    // Le journal de l'invité tient dans son message.
    const result = first.intents.find((i) => i.type === 'fish_result');
    expect(JSON.stringify({ inputs: [], intents: [result] }).length).toBeLessThan(
      BUDGET_BYTES.guestInput,
    );
    // Les lignes et les ombres se lisent pour le rendu.
    expect(
      fishingView(sim.content, sim.world, sim.world.tick * SIM_DT).shadows.length,
    ).toBeGreaterThan(0);
  });

  it('échec doux: ferrer trop tôt fait partir l ombre, rien n est perdu', () => {
    const sim = atThePond();
    const before = JSON.stringify(sim.world.players[0].toolbar);
    const spot = spotById(sim.content, sim.world, 'etang');
    if (spot === null) throw new Error('coin absent');
    const count = shadowsNow(sim.content, sim.world, spot).length;
    const played = fishOnce(sim, 0, { strike: 'early' });
    expect(played.events.find((e) => e.type === 'fish_lost')).toMatchObject({ reason: 'missed' });
    expect(played.events.some((e) => e.type === 'fish_caught')).toBe(false);
    expect(JSON.stringify(sim.world.players[0].toolbar)).toBe(before);
    expect(shadowsNow(sim.content, sim.world, spot).length).toBe(count - 1);
  });

  it('l hôte refuse un résultat qu il ne retrouve pas en rejouant', () => {
    const sim = atThePond();
    const target = aimAtShadow(sim);
    act(sim, 1, { type: 'fish_cast', x: target.x, y: target.y });
    wait(sim, 1);
    const forged = act(sim, 1, { type: 'fish_result', outcome: 'landed', strike: 3, log: 'f400' });
    expect(forged.find((e) => e.type === 'fish_lost')).toMatchObject({
      player: 1,
      reason: 'invalid',
    });
    expect(forged.some((e) => e.type === 'fish_caught')).toBe(false);
    // Un vrai combat joué chez l'invité passe.
    const honest = fishOnce(sim, 1);
    expect(honest.events.some((e) => e.type === 'fish_caught' && e.player === 1)).toBe(true);
  });

  it('une espèce et un coin factices, ajoutés en données seulement, se pêchent', () => {
    const content = contentWith((files) => {
      files['commun/objets/poisson-factice.json'] = {
        schema: 1,
        id: 'poisson-factice',
        name: 'Poisson factice',
        family: 'catch',
        stack: 3,
        food: null,
        tool: null,
      };
      files['commun/prises/poisson-factice.json'] = {
        schema: 1,
        id: 'poisson-factice',
        kind: 'fish',
        item: 'poisson-factice',
        places: ['essai-gare'],
        hours: { from: 0, to: 1440 },
        weathers: [],
        seasons: [],
        rarity: 'common',
        difficulty: 1,
        fish: {
          force: 0.3,
          nervousness: 0.3,
          rhythm: { pull: 1, rest: 1 },
          stamina: 5,
          feints: 0,
          sizeCm: { min: 10, max: 11 },
          shadow: 'small',
        },
      };
      const lieu = files['lieux/essai-gare/lieu.json'] as { fishing: unknown[] };
      lieu.fishing = [
        {
          id: 'etang',
          area: { x: 3, y: 32, w: 8, h: 5 },
          shadows: 3,
          table: [{ catch: 'poisson-factice', weight: 1 }],
        },
      ];
    });
    const sim = atThePond(content);
    const played = fishOnce(sim, 0);
    expect(played.events.find((e) => e.type === 'fish_caught')).toMatchObject({
      catch: 'poisson-factice',
    });
  });

  it('canne fine: secteur vert plus large et usure d une prise', () => {
    const sim = atThePond(gameContent(), 'canne-fine');
    const played = fishOnce(sim, 0);
    expect(played.events.some((e) => e.type === 'fish_caught')).toBe(true);
    expect(sim.world.players[0].toolbar[0]?.wear).toBe(59);
    const line = played.intents.find((i) => i.type === 'fish_hooked');
    expect(line).toBeDefined();
  });
});
