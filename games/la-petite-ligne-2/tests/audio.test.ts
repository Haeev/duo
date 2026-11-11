/** Son (lot L9): tables, événements vers sons, babil, espace, pas, ambiances, moteur sur contexte factice. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { layerGains, daylight } from '../src/audio/ambiance';
import { Babbler } from '../src/audio/babil';
import { place } from '../src/audio/espace';
import { createAudioEngine, type AudioEngineOptions } from '../src/audio/moteur';
import { StepTracker, stepSound } from '../src/audio/pas';
import { loadSettings } from '../src/audio/reglages';
import { soundForEvent, soundsForEvent } from '../src/audio/regles';
import { loadTables, parseTables, type AudioTables } from '../src/audio/table';
import { loadContent } from '../src/donnees/charger';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { dataFiles } from './aides';

const SON_DIR = fileURLToPath(new URL('../assets/commun/son/', import.meta.url));
const tables = loadTables();
const rng = { float: (a: number, b: number): number => (a + b) / 2, int: (a: number): number => a };

describe('tables sonores', () => {
  it('sont valides et chaque fichier nommé existe', () => {
    const files = new Set<string>();
    for (const s of Object.values(tables.sounds)) s.files.forEach((f) => files.add(f));
    for (const t of Object.values(tables.voices.timbres)) files.add(t.file);
    for (const l of Object.values(tables.ambience.layers)) files.add(l.file);
    for (const f of files) expect(existsSync(join(SON_DIR, f)), f).toBe(true);
  });

  it('offrent au moins quatre timbres, tous utilisés par une voix', () => {
    const timbres = Object.keys(tables.voices.timbres);
    expect(timbres.length).toBeGreaterThanOrEqual(4);
    const used = new Set(Object.values(tables.voices.voices).map((v) => v.timbre));
    expect([...used].sort()).toEqual([...timbres].sort());
  });

  it('nomment la voix de chaque habitant des données', () => {
    const content = loadContent(dataFiles());
    for (const p of Object.values(content.places)) {
      for (const villager of p.villagers)
        expect(tables.voices.voices[villager.voice], villager.id).toBeDefined();
    }
  });

  it('refusent une référence inconnue en nommant le fichier et le champ', () => {
    const raw = {
      sounds: structuredClone(tables.sounds),
      events: structuredClone(tables.events),
      voices: tables.voices,
      ambience: tables.ambience,
      tuning: tables.tuning,
    };
    raw.events.rules.push({
      on: 'unstuck',
      where: {},
      sound: 'inconnu',
      actor: 'player',
      audience: 'own',
      placed: false,
    });
    expect(() => parseTables(raw)).toThrow(/evenements\.json: rules\.\d+: son inconnu/);
  });
});

function withDummy(): AudioTables {
  // Recette du README: une entrée de sons.json, une ligne d'événements, un fichier. Aucun code.
  const sounds = {
    ...tables.sounds,
    factice: { ...tables.sounds.reussite, files: ['effets/reussite.ogg'] },
  };
  const events = {
    ...tables.events,
    rules: [
      {
        on: 'unstuck',
        where: {},
        sound: 'factice',
        actor: 'player' as const,
        audience: 'both' as const,
        placed: true,
      },
      ...tables.events.rules,
    ],
  };
  return parseTables({
    sounds,
    events,
    voices: tables.voices,
    ambience: tables.ambience,
    tuning: tables.tuning,
  });
}

describe('événement vers son', () => {
  const done = (player: 0 | 1, clip: string): GameEvent => ({
    type: 'gesture_done',
    player,
    clip,
    target: null,
  });

  it('choisit le cas précis avant le général', () => {
    expect(soundForEvent(tables.events, done(0, 'pickup'), 0)?.sound).toBe('ramasser');
    expect(soundForEvent(tables.events, done(0, 'dig'), 0)?.sound).toBe('reussite');
  });

  it('distingue ses gestes de ceux de l autre joueur', () => {
    expect(soundForEvent(tables.events, done(0, 'dig'), 0)).toMatchObject({
      own: true,
      placed: true,
    });
    expect(soundForEvent(tables.events, done(1, 'dig'), 0)).toMatchObject({
      own: false,
      placed: true,
    });
  });

  it('garde les retours privés pour leur joueur', () => {
    const refused: GameEvent = { type: 'refused', player: 1, reason: 'x', target: null };
    expect(soundForEvent(tables.events, refused, 0)).toBeNull();
    expect(soundForEvent(tables.events, refused, 1)?.sound).toBe('refus');
  });

  it('lit les bornes et les paliers', () => {
    const gain: GameEvent = { type: 'money_changed', who: 0, delta: 250 };
    expect(soundForEvent(tables.events, gain, 0)?.sound).toBe('pieces-vente');
    expect(
      soundForEvent(tables.events, { type: 'money_changed', who: 0, delta: -40 }, 0)?.sound,
    ).toBe('pieces-achat');
    expect(
      soundForEvent(tables.events, { type: 'money_changed', who: 'chest', delta: 5 }, 0),
    ).toBeNull();
    const tier = (state: 'low' | 'bonus' | 'neutral'): GameEvent => ({
      type: 'need_tier',
      player: 0,
      need: 'hunger',
      state,
    });
    expect(soundForEvent(tables.events, tier('low'), 0)?.sound).toBe('palier-bas');
    expect(soundForEvent(tables.events, tier('bonus'), 0)?.sound).toBe('palier-bonus');
    expect(soundForEvent(tables.events, tier('neutral'), 0)).toBeNull();
    expect(
      soundForEvent(tables.events, { type: 'train_boarded', player: 0, to: null }, 0),
    ).toBeNull();
    expect(
      soundForEvent(tables.events, { type: 'train_boarded', player: 0, to: 'ailleurs' }, 0)?.sound,
    ).toBe('embarquement');
  });

  it('une règle `also` laisse le même événement jouer la suivante (factice, tables seules)', () => {
    const rule = (sound: string, also: boolean): (typeof tables.events.rules)[number] => ({
      on: 'unstuck',
      where: {},
      sound,
      actor: 'player',
      audience: 'both',
      placed: false,
      ...(also ? { also: true } : {}),
    });
    const table = {
      ...tables.events,
      rules: [rule('reussite', true), rule('ramasser', false), rule('refus', false)],
    };
    const event: GameEvent = { type: 'unstuck', player: 0 };
    expect(soundsForEvent(table, event, 0).map((hit) => hit.sound)).toEqual([
      'reussite',
      'ramasser',
    ]);
    // Sans `also`, le premier gabarit décide seul, comme avant.
    expect(soundForEvent(table, event, 0)?.sound).toBe('reussite');
    expect(() =>
      parseTables({ ...tables, sounds: tables.sounds, events: table, tuning: tables.tuning }),
    ).not.toThrow();
  });
});

describe('sons d Aubrune (deuxième lot)', () => {
  it('relie pêche, cuisine, déco, portes et scènes aux sons par les seules tables', () => {
    const sound = (event: GameEvent): string | undefined =>
      soundForEvent(tables.events, event, 0)?.sound;
    expect(sound({ type: 'fish_hooked', player: 1 })).toBe('peche-touche');
    expect(sound({ type: 'fish_lost', player: 0, reason: 'escaped' })).toBe('peche-casse');
    const dish = (quality: number): GameEvent => ({
      type: 'dish_cooked',
      player: 0,
      recipe: 'soupe',
      quality,
      item: 'soupe',
      count: 1,
      first: false,
      shared: false,
    });
    expect(sound(dish(1))).toBe('plat-rate');
    expect(sound(dish(3))).toBe('plat-reussi');
    expect(
      sound({ type: 'deco_changed', player: 0, action: 'store', prop: null, item: 'chaise' }),
    ).toBe('meuble-ranger');
    expect(sound({ type: 'scene_beat', scene: 'la-sonnerie-de-5h12', beat: 1 })).toBe('cinq-douze');
    expect(sound({ type: 'scene_beat', scene: 'la-sonnerie-de-5h12', beat: 0 })).toBeUndefined();
    expect(tables.events.cues['cuisine-chop']).toBe('cuisine-decoupe');
  });
});

describe('babil', () => {
  const babbler = new Babbler(tables.voices, rng);

  it('donne une note par lettre, plus longue sur une voyelle, muette sur une espace', () => {
    const a = babbler.syllable('p1', 'medium', 'a', 0);
    const t = babbler.syllable('p1', 'medium', 't', 1000);
    expect(a).not.toBeNull();
    expect(t).not.toBeNull();
    expect(a?.durationMs ?? 0).toBeGreaterThan(t?.durationMs ?? 0);
    expect(babbler.syllable('p1', 'medium', ' ', 2000)).toBeNull();
  });

  it('respecte le débit et garde chaque voix sur son timbre', () => {
    expect(babbler.syllable('p2', 'medium', 'a', 0)).not.toBeNull();
    expect(babbler.syllable('p2', 'medium', 'e', 10)).toBeNull();
    expect(babbler.syllable('p2', 'medium', 'e', 500)).not.toBeNull();
    const low = babbler.syllable('p3', 'low', 'o', 0);
    const high = babbler.syllable('p4', 'high', 'o', 0);
    expect(low?.timbreFile).not.toBe(high?.timbreFile);
    expect(low?.midi ?? 99).toBeLessThan(high?.midi ?? 0);
  });

  it('monte sur une question et retombe sur un point', () => {
    const q = babbler.syllable('p5', 'medium', '?', 0);
    const dot = babbler.syllable('p6', 'medium', '.', 0);
    expect(q?.midi ?? 0).toBeGreaterThan(dot?.midi ?? 99);
  });

  it('reste dans une octave du timbre (lecture accélérée sans artefact)', () => {
    for (const id of Object.keys(tables.voices.voices)) {
      const b = new Babbler(tables.voices, rng);
      for (const [i, c] of Array.from('aeioubcdfghjklmnpqrstvwxz?!.,').entries()) {
        const s = b.syllable(id, id, c, i * 1000);
        expect(s?.rate ?? 1, `${id} ${c}`).toBeGreaterThan(0.45);
        expect(s?.rate ?? 1, `${id} ${c}`).toBeLessThan(2.3);
      }
    }
  });
});

describe('espace, pas et ambiances', () => {
  const space = tables.tuning.space;

  it('baisse avec la distance, coupe au loin et panoramique selon le lacet', () => {
    const near = place(space, { x: 0, y: 0 }, { x: 1, y: 0 }, 0);
    const far = place(space, { x: 0, y: 0 }, { x: 20, y: 0 }, 0);
    expect(near.gain).toBe(1);
    expect(far.gain).toBeLessThan(near.gain);
    expect(place(space, { x: 0, y: 0 }, { x: 90, y: 0 }, 0).audible).toBe(false);
    expect(place(space, { x: 0, y: 0 }, { x: 5, y: 0 }, 0).pan).toBeGreaterThan(0);
    // Caméra tournée d'un quart de tour: la même source passe de droite à devant, puis à gauche.
    expect(Math.abs(place(space, { x: 0, y: 0 }, { x: 5, y: 0 }, Math.PI / 2).pan)).toBeLessThan(
      1e-9,
    );
    expect(place(space, { x: 0, y: 0 }, { x: 5, y: 0 }, Math.PI).pan).toBeLessThan(0);
  });

  it('cale un pas sur chaque foulée et se tait à l arrêt', () => {
    const tracker = new StepTracker(tables.tuning.steps);
    let steps = 0;
    for (let i = 0; i <= 40; i += 1) steps += tracker.update({ x: i * 0.1, y: 0, speed: 3 });
    expect(steps).toBe(Math.floor(4 / tables.tuning.steps.strideMeters));
    expect(tracker.update({ x: 4, y: 0, speed: 0 })).toBe(0);
    expect(stepSound(tables.tuning.steps, 'paved')).toBe('pas-pave');
    // Surfaces du rendu (`SurfaceKind`): plancher, gué, galets.
    expect(stepSound(tables.tuning.steps, 'bois')).toBe('pas-bois');
    expect(stepSound(tables.tuning.steps, 'eau')).toBe('pas-eau');
    expect(stepSound(tables.tuning.steps, 'gravier')).toBe('pas-gravier');
    expect(stepSound(tables.tuning.steps, 'inconnue')).toBe('pas-herbe');
  });

  it('fond le jour et la nuit selon l heure, et le trajet couvre tout', () => {
    expect(daylight(tables.ambience, 12 * 60)).toBe(1);
    expect(daylight(tables.ambience, 2 * 60)).toBe(0);
    const dusk = daylight(tables.ambience, 20 * 60);
    expect(dusk).toBeGreaterThan(0);
    expect(dusk).toBeLessThan(1);
    const g = layerGains(tables.ambience, 20 * 60, false);
    expect((g.jour ?? 0) ** 2 + (g.nuit ?? 0) ** 2).toBeCloseTo(1, 6);
    const trip = layerGains(tables.ambience, 12 * 60, true);
    expect(trip).toEqual({ jour: 0, nuit: 0, trajet: 1 });
  });

  it('relit des réglages abîmés sans planter', () => {
    const bad = { getItem: (): string => '{"master":9}' };
    expect(loadSettings(tables.tuning, bad)).toEqual({ ...tables.tuning.defaults, muted: false });
  });
});

/** Contexte audio factice: compte les sources lancées et garde leurs réglages. */
function fakeHost(): {
  host: AudioEngineOptions['host'];
  started: { rate: number; gain: number; loop: boolean }[];
} {
  const started: { rate: number; gain: number; loop: boolean }[] = [];
  const param = (): {
    value: number;
    setTargetAtTime(): void;
    setValueAtTime(): void;
    cancelScheduledValues(): void;
    linearRampToValueAtTime(): void;
  } => ({
    value: 0,
    setTargetAtTime: () => undefined,
    setValueAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
    linearRampToValueAtTime: () => undefined,
  });
  const node = (): Record<string, unknown> => ({
    connect: () => undefined,
    disconnect: () => undefined,
  });
  const context = {
    currentTime: 0,
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: { value: 0 } }),
    createBufferSource: () => {
      const rate = { value: 1, setTargetAtTime: (): void => undefined };
      const source: Record<string, unknown> = {
        ...node(),
        buffer: null,
        playbackRate: rate,
        loop: false,
        onended: null,
        stop: () => undefined,
        start: () => {
          started.push({ rate: rate.value, gain: 0, loop: source.loop === true });
        },
      };
      return source;
    },
  } as unknown as BaseAudioContext;
  return { host: { context, bus: () => node() as unknown as AudioNode }, started };
}

describe('moteur', () => {
  it('joue un son factice ajouté par les seules tables, au bon joueur', async () => {
    const { host, started } = fakeHost();
    const listeners: ((e: GameEvent) => void)[] = [];
    const body = { x: 0, y: 0, facing: 0, speed: 0 };
    const view = {
      content: { places: {} },
      localIndex: () => 0,
      world: () => ({
        minutes: 600,
        common: { phase: 'day' },
        players: [{ body }, { body: { ...body, x: 6 } }],
      }),
      aim: () => null,
      onEvent: (l: (e: GameEvent) => void) => {
        listeners.push(l);
        return () => undefined;
      },
    } as unknown as AudioEngineOptions['view'];
    const engine = createAudioEngine({
      host,
      view,
      tables: withDummy(),
      assetUrl: (f) => `/${f}`,
      random: {
        int: (a: number) => a,
        float: (a: number, b: number) => (a + b) / 2,
        pick: <T>(l: readonly T[]) => l[0] as T,
      } as unknown as AudioEngineOptions['random'],
      cameraYaw: () => 0,
      load: () =>
        Promise.resolve({
          duration: 0.3,
          length: 1,
          numberOfChannels: 1,
        } as unknown as AudioBuffer),
    });
    await engine.ready();
    expect(engine.stats().missing).toEqual([]);
    const base = started.length; // les ambiances ne démarrent qu'à la première image
    listeners[0]?.({ type: 'unstuck', player: 1 });
    expect(started.length).toBe(base + 1);
    engine.cue('carnet-ouvre');
    expect(started.length).toBe(base + 2);
    engine.dispose();
  });

  it('fond les allures du roulement selon la vitesse de la draisine, et se tait à l arrêt', async () => {
    const { host, started } = fakeHost();
    const body = { x: 0, y: 0, facing: 0, speed: 0 };
    const draisine = { out: true, speed: 0 };
    const world = {
      minutes: 600,
      common: { phase: 'day', place: 'aubrune' },
      players: [{ body }, { body }],
      places: { aubrune: { vehicles: { draisine } } },
    };
    const view = {
      content: { places: {} },
      localIndex: () => 0,
      world: () => world,
      aim: () => null,
      onEvent: () => () => undefined,
    } as unknown as AudioEngineOptions['view'];
    const engine = createAudioEngine({
      host,
      view,
      tables: loadTables(),
      assetUrl: (f) => `/${f}`,
      random: {
        int: (a: number) => a,
        float: (a: number, b: number) => (a + b) / 2,
      } as unknown as AudioEngineOptions['random'],
      cameraYaw: () => 0,
      load: () => Promise.resolve({ duration: 5.5, length: 1, numberOfChannels: 1 } as AudioBuffer),
    });
    await engine.ready();
    const loops = (): number => started.filter((s) => s.loop).length;
    engine.frame(1 / 60);
    const still = loops();
    // Au pas: l'allure lente, un peu ralentie; puis la moyenne prend le relais (fondu croisé).
    draisine.speed = 1;
    engine.frame(1 / 60);
    expect(loops()).toBe(still + 1);
    expect(started.at(-1)?.rate).toBeCloseTo(0.9 + 0.2 * (0.7 / 3.2), 5);
    engine.frame(1 / 60);
    expect(loops()).toBe(still + 1);
    draisine.speed = 7;
    engine.frame(1 / 60);
    expect(loops()).toBe(still + 2);
    // À l'arrêt, rien ne repart; la boucle en cours s'éteint d'elle-même.
    draisine.speed = 0;
    engine.frame(1 / 60);
    engine.frame(1 / 60);
    expect(loops()).toBe(still + 2);
    engine.dispose();
  });

  it('tient la sonnerie du passage à niveau tant qu elle sonne, puis la fait taire', async () => {
    const { host, started } = fakeHost();
    const listeners: ((e: GameEvent) => void)[] = [];
    const view = {
      content: { places: {} },
      localIndex: () => 0,
      world: () => null,
      aim: () => null,
      onEvent: (l: (e: GameEvent) => void) => {
        listeners.push(l);
        return () => undefined;
      },
    } as unknown as AudioEngineOptions['view'];
    const engine = createAudioEngine({
      host,
      view,
      tables: loadTables(),
      assetUrl: (f) => `/${f}`,
      random: {
        int: (a: number) => a,
        float: (a: number, b: number) => (a + b) / 2,
      } as unknown as AudioEngineOptions['random'],
      cameraYaw: () => 0,
      load: () => Promise.resolve({ duration: 4.6, length: 1, numberOfChannels: 1 } as AudioBuffer),
    });
    await engine.ready();
    listeners[0]?.({ type: 'crossing_bell', place: 'aubrune', ringing: true });
    expect(started.at(-1)?.loop).toBe(true);
    expect(engine.stats().voices).toBe(1);
    listeners[0]?.({ type: 'crossing_bell', place: 'aubrune', ringing: false });
    expect(engine.stats().voices).toBe(0);
    engine.dispose();
  });
});
