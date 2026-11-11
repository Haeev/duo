/** Musique: table, choix par lieu, heure, météo, rythme des silences, jingles, régie sur contexte factice. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bandOf, choose, jingleForEvent, type MusicContext } from '../src/audio/musique/choix';
import { createMusicDirector, type MusicOptions } from '../src/audio/musique/regie';
import { Pacer } from '../src/audio/musique/rythme';
import { loadMusicTable, parseMusicTable } from '../src/audio/musique/table';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { gameContent } from './aides';

const SON_DIR = fileURLToPath(new URL('../assets/commun/son/', import.meta.url));
const SRC_DIR = fileURLToPath(new URL('../assets-src/son/musique/', import.meta.url));
const table = loadMusicTable();

const base: MusicContext = {
  place: 'aubrune',
  zone: null,
  hour: 10,
  weather: 'clear',
  season: 'spring',
  phase: 'day',
  scene: null,
  events: [],
};
const at = (patch: Partial<MusicContext>): MusicContext => ({ ...base, ...patch });

describe('table de musique', () => {
  it('est valide, et chaque fichier nommé existe', () => {
    const files = [
      ...Object.values(table.tracks).flatMap((t) => Object.values(t.stems).map((s) => s.file)),
      ...Object.values(table.jingles).map((j) => j.file),
    ];
    expect(files.length).toBeGreaterThanOrEqual(26);
    for (const f of files) expect(existsSync(join(SON_DIR, f)), f).toBe(true);
  });

  it('annonce les durées que le rendu a mesurées', () => {
    const index = JSON.parse(readFileSync(join(SON_DIR, 'musique/index.json'), 'utf8')) as Record<
      string,
      { seconds: number }
    >;
    for (const [id, track] of Object.entries(table.tracks))
      expect(index[id]?.seconds, id).toBe(track.seconds);
    for (const [id, jingle] of Object.entries(table.jingles)) {
      const rendered = Object.entries(index).find(([name]) => name.endsWith(id))?.[1];
      expect(Math.abs((rendered?.seconds ?? 0) - jingle.seconds), id).toBeLessThan(0.05);
    }
  });

  it('livre des morceaux de 60 à 90 s et des jingles courts, sans dépasser 12 Mo', () => {
    for (const [id, track] of Object.entries(table.tracks)) {
      expect(track.seconds, id).toBeGreaterThanOrEqual(60);
      expect(track.seconds, id).toBeLessThanOrEqual(90);
    }
    for (const [id, jingle] of Object.entries(table.jingles)) {
      expect(jingle.seconds, id).toBeGreaterThanOrEqual(2);
      expect(jingle.seconds, id).toBeLessThanOrEqual(6);
    }
    const index = JSON.parse(readFileSync(join(SON_DIR, 'musique/index.json'), 'utf8')) as object;
    expect(Object.keys(index).length).toBe(Object.keys(table.tracks).length + 7);
  });

  it('refuse un morceau, un rythme ou un jingle inconnu en nommant le champ', () => {
    const copy = structuredClone(table);
    copy.rules.push({ id: 'faute', when: {}, play: 'inconnu', pacing: 'normal' });
    expect(() => parseMusicTable(copy)).toThrow(/rules\.\d+ \(faute\): morceau inconnu/);
    const other = structuredClone(table);
    other.arrivals.ailleurs = 'nulle-part';
    expect(() => parseMusicTable(other)).toThrow(/arrivals\.ailleurs: jingle inconnu/);
  });

  it('tient dans le budget des mesures: -16 LUFS, crêtes sous -1 dBFS', () => {
    const lines = readFileSync(join(SRC_DIR, 'mesures.csv'), 'utf8').trim().split('\n');
    const head = (lines[0] ?? '').split(',');
    const col = (name: string): number => head.indexOf(name);
    for (const line of lines.slice(1)) {
      const cells = line.split(',');
      const id = cells[col('id')] ?? '';
      expect(Math.abs(Number(cells[col('sonie_lufs')]) + 16), id).toBeLessThan(0.7);
      expect(Number(cells[col('crete_vraie_dbtp')]), id).toBeLessThan(-1);
      expect(Number(cells[col('crete_echantillon_dbfs')]), id).toBeLessThan(-1);
    }
  });
});

describe('choix de la musique', () => {
  it('lit les tranches horaires, minuit compris', () => {
    expect(bandOf(table, 6)).toBe('aube');
    expect(bandOf(table, 10)).toBe('matin');
    expect(bandOf(table, 15)).toBe('apres-midi');
    expect(bandOf(table, 19)).toBe('soir');
    expect(bandOf(table, 23)).toBe('nuit');
    expect(bandOf(table, 2)).toBe('nuit');
    expect(bandOf(table, 5.1)).toBe('cinq-douze');
  });

  it('décline le bourg en cinq moments, du même lieu', () => {
    const played = [6, 10, 15, 19, 23].map((hour) => choose(table, at({ hour })).track);
    expect(played).toEqual([
      'bourg-aube',
      'bourg-matin',
      'bourg-apres-midi',
      'bourg-soir',
      'bourg-nuit',
    ]);
  });

  it('passe à la pluie en journée, puis feutre au lieu de changer de morceau la nuit', () => {
    const rain = choose(table, at({ weather: 'rain', hour: 15 }));
    expect(rain.track).toBe('bourg-pluie');
    expect(rain.modifiers).toContain('temps-couvert');
    expect(rain.lowpassHz).toBeLessThan(5000);
    const night = choose(table, at({ hour: 23 }));
    expect(night.stemsDb.air).toBeLessThan(-3);
    const stormNight = choose(table, at({ hour: 23, weather: 'storm' }));
    expect(stormNight.lowpassHz).toBe(3000);
    expect(stormNight.stemsDb.air).toBe(-9);
  });

  it('suit les lieux, les scènes, le voyage et les fêtes', () => {
    expect(choose(table, at({ zone: 'riviere' })).track).toBe('riviere');
    expect(choose(table, at({ zone: 'riviere', hour: 23 })).rule).toBe('riviere-la-nuit');
    expect(choose(table, at({ phase: 'travel' })).track).toBe('train');
    expect(choose(table, at({ scene: 'sonnerie', hour: 15 })).track).toBe('mystere');
    expect(choose(table, at({ hour: 5.1 })).track).toBe('mystere');
    expect(choose(table, at({ events: ['fete-d-essai'], hour: 20 })).track).toBe('fete');
  });

  it("se tait dans un lieu sans règle (l'ambiance reste)", () => {
    expect(choose(table, at({ place: 'hautefonte' })).track).toBeNull();
  });

  it('prend la saison, comme les autres conditions, dans une règle ajoutée aux données', () => {
    const copy = structuredClone(table);
    copy.rules.unshift({
      id: 'neige-du-soir',
      when: { seasons: ['winter'], bands: ['soir'] },
      play: 'bourg-aube',
      pacing: 'rare',
    });
    const t = parseMusicTable(copy);
    expect(choose(t, at({ season: 'winter', hour: 19 })).track).toBe('bourg-aube');
    expect(choose(t, at({ season: 'summer', hour: 19 })).track).toBe('bourg-soir');
  });
});

describe('jingles', () => {
  const found = (first: boolean, player: 0 | 1): GameEvent => ({
    type: 'collection_found',
    player,
    entry: 'x',
    category: 'poissons',
    first,
    mine: true,
  });

  it("fête une prise nouvelle chez les deux, l'autre un peu plus bas, pas une prise connue", () => {
    expect(jingleForEvent(table, found(true, 0), 0)).toEqual({
      jingle: 'prise-nouvelle',
      own: true,
    });
    expect(jingleForEvent(table, found(true, 1), 0)).toEqual({
      jingle: 'prise-nouvelle',
      own: false,
    });
    expect(jingleForEvent(table, found(false, 0), 0)).toBeNull();
  });

  it('garde le repas partagé pour son joueur, marque les étapes de quête', () => {
    const meal = (player: 0 | 1): GameEvent => ({
      type: 'meal_shared',
      player,
      perk: 'extra_catch',
    });
    expect(jingleForEvent(table, meal(1), 0)).toBeNull();
    expect(jingleForEvent(table, meal(0), 0)?.jingle).toBe('repas-partage');
    const step: GameEvent = { type: 'quest_step_done', quest: 'q', step: 's', by: 1 };
    expect(jingleForEvent(table, step, 0)).toEqual({ jingle: 'etape-quete', own: false });
    expect(jingleForEvent(table, { type: 'day_started', day: 2, slept: true }, 0)?.jingle).toBe(
      'reveil',
    );
    expect(jingleForEvent(table, { type: 'day_started', day: 2, slept: false }, 0)).toBeNull();
  });
});

describe('rythme des silences', () => {
  const rng = {
    float: (a: number, b: number): number => (a + b) / 2,
  } as unknown as ConstructorParameters<typeof Pacer>[0];
  const pacing: { playSeconds: [number, number]; quietSeconds: [number, number] } = {
    playSeconds: [10, 10],
    quietSeconds: [5, 5],
  };

  it('joue, se tait, puis revient', () => {
    const pacer = new Pacer(rng);
    const seen: (string | null)[] = [];
    for (let i = 0; i < 40; i++) seen.push(pacer.update(1, 'a', pacing).track);
    expect(seen.slice(0, 9).every((t) => t === 'a')).toBe(true);
    expect(seen.slice(9, 14).every((t) => t === null)).toBe(true);
    expect(seen.slice(14, 23).every((t) => t === 'a')).toBe(true);
    expect(seen[24]).toBeNull();
  });

  it('change de morceau sans repartir de zéro, et ne se tait jamais sans rythme', () => {
    const pacer = new Pacer(rng);
    for (let i = 0; i < 6; i++) pacer.update(1, 'a', pacing);
    for (let i = 0; i < 3; i++) expect(pacer.update(1, 'b', pacing).track).toBe('b');
    expect(pacer.update(1, 'b', pacing).track).toBeNull();
    for (let i = 0; i < 50; i++) expect(pacer.update(1, 'b', null).track).toBe('b');
  });
});

interface Started {
  readonly offset: number | undefined;
  readonly loopStart: number;
  readonly loopEnd: number;
}

function fakeHost(): { host: MusicOptions['host']; started: Started[] } {
  const started: Started[] = [];
  const param = (): Record<string, unknown> => ({
    value: 0,
    setTargetAtTime: () => undefined,
    setValueAtTime: () => undefined,
    cancelScheduledValues: () => undefined,
  });
  const node = (): Record<string, unknown> => ({
    connect: () => undefined,
    disconnect: () => undefined,
  });
  const context = {
    currentTime: 0,
    createGain: () => ({ ...node(), gain: param() }),
    createStereoPanner: () => ({ ...node(), pan: { value: 0 } }),
    createBiquadFilter: () => ({ ...node(), frequency: param(), Q: { value: 1 }, type: 'lowpass' }),
    createBufferSource: () => {
      const source: Record<string, unknown> = {
        ...node(),
        buffer: null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        onended: null,
        stop: () => undefined,
      };
      source.start = (_when: number, offset?: number): void => {
        started.push({
          offset,
          loopStart: source.loopStart as number,
          loopEnd: source.loopEnd as number,
        });
      };
      return source;
    },
  } as unknown as BaseAudioContext;
  return { host: { context, bus: () => node() as unknown as AudioNode }, started };
}

describe('régie', () => {
  const content = gameContent();
  const rand = {
    int: (a: number): number => a,
    float: (a: number, b: number): number => (a + b) / 2,
  } as unknown as MusicOptions['random'];

  function setup(
    tableToUse = table,
    minutes = 10 * 60,
  ): {
    director: ReturnType<typeof createMusicDirector>;
    started: Started[];
    send: (e: GameEvent) => void;
  } {
    const { host, started } = fakeHost();
    const listeners: ((e: GameEvent) => void)[] = [];
    const body = { x: 0, y: 0, facing: 0, speed: 0 };
    const view = {
      content,
      localIndex: () => 0,
      world: () => ({
        minutes,
        common: { phase: 'day', place: 'essai-gare', day: 1, weather: 'clear' },
        players: [{ body }, { body }],
      }),
      onEvent: (l: (e: GameEvent) => void) => {
        listeners.push(l);
        return () => undefined;
      },
    } as unknown as MusicOptions['view'];
    const director = createMusicDirector({
      host,
      view,
      table: tableToUse,
      assetUrl: (f) => `/${f}`,
      random: rand,
      load: () =>
        Promise.resolve({ duration: 70, length: 1, numberOfChannels: 1 } as unknown as AudioBuffer),
    });
    return {
      director,
      started,
      send: (e) => {
        for (const l of listeners) l(e);
      },
    };
  }

  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

  it("joue le thème d'arrivée, attend, puis lance le morceau du moment avec toutes ses tiges", async () => {
    const { director, started } = setup();
    await director.ready();
    for (let i = 0; i < 4; i++) director.frame(1);
    await settle();
    expect(started.length).toBe(1); // le thème d'arrivée seul: la musique attend
    expect(director.state().track).toBeNull();
    for (let i = 0; i < 6; i++) director.frame(1);
    await settle();
    expect(director.state()).toMatchObject({ track: 'bourg-matin', rule: 'bourg-matin' });
    const loops = started.slice(1);
    expect(loops.length).toBe(2);
    for (const loop of loops) {
      expect(loop.offset).toBe(1);
      expect(loop.loopStart).toBe(1);
      expect(loop.loopEnd).toBe(81);
    }
    director.dispose();
  });

  it('se tait selon le rythme puis revient, et joue un jingle sur un événement', async () => {
    const copy = structuredClone(table);
    copy.pacings.normal = { playSeconds: [20, 20], quietSeconds: [10, 10] };
    const { director, started, send } = setup(parseMusicTable(copy));
    await director.ready();
    for (let i = 0; i < 12; i++) director.frame(1);
    await settle();
    expect(director.state().track).toBe('bourg-matin');
    for (let i = 0; i < 20; i++) director.frame(1);
    await settle();
    expect(director.state()).toMatchObject({ track: null, quiet: true });
    for (let i = 0; i < 12; i++) director.frame(1);
    await settle();
    expect(director.state().track).toBe('bourg-matin');
    const before = started.length;
    send({ type: 'quest_done', quest: 'q' });
    expect(started.length).toBe(before + 1);
    director.dispose();
  });

  it("écoute un air du carnet: l'ambiance s'efface, l'air passe une fois, l'ambiance revient", async () => {
    const { director, started } = setup();
    await director.ready();
    for (let i = 0; i < 12; i++) director.frame(1);
    await settle();
    expect(director.state().track).toBe('bourg-matin');
    expect(director.listenable('air-marche-de-la-halte')).toBe(true);
    expect(director.listenable('air-inconnu')).toBe(false);
    expect(director.listen('air-inconnu')).toBe(false);
    const before = started.length;
    expect(director.listen('air-marche-de-la-halte')).toBe(true);
    await settle();
    expect(director.listening()).toBe('air-marche-de-la-halte');
    expect(director.state()).toMatchObject({ track: null, listening: 'air-marche-de-la-halte' });
    expect(started.length).toBe(before + 2); // ses deux tiges
    // Les ticks suivants ne relancent pas l'ambiance pendant l'écoute.
    for (let i = 0; i < 10; i++) director.frame(1);
    await settle();
    expect(director.state().track).toBeNull();
    // Arrêter: l'ambiance revient tout de suite.
    director.stopListening();
    await settle();
    expect(director.listening()).toBeNull();
    expect(director.state().track).toBe('bourg-matin');
    // Écoutée jusqu'au bout, elle s'arrête seule.
    director.listen('air-marche-de-la-halte');
    await settle();
    for (let i = 0; i < 70; i++) director.frame(1);
    await settle();
    expect(director.listening()).toBeNull();
    director.dispose();
  });

  it('garde un réglage de volume séparé', () => {
    const { director } = setup();
    expect(director.settings().music).toBe(0.8);
    director.setSettings({ music: 0.3 });
    expect(director.settings().music).toBe(0.3);
    director.dispose();
  });

  it('exemplaire factice: un morceau, un jingle et une règle ajoutés aux seules données se jouent', async () => {
    const copy = structuredClone(table);
    copy.tracks.factice = structuredClone(table.tracks['bourg-aube'] ?? { seconds: 64, stems: {} });
    copy.jingles.factice = structuredClone(
      table.jingles.reveil ?? { file: '', volumeDb: 0, duckDb: 0, seconds: 1 },
    );
    copy.rules.unshift({
      id: 'factice',
      when: { places: ['essai-gare'] },
      play: 'factice',
      pacing: 'steady',
    });
    copy.jingleRules.unshift({
      on: 'unstuck',
      where: {},
      jingle: 'factice',
      actor: 'player',
      audience: 'own',
    });
    const t = parseMusicTable(copy);
    const { director, started, send } = setup(t);
    await director.ready();
    for (let i = 0; i < 12; i++) director.frame(1);
    await settle();
    expect(director.state().track).toBe('factice');
    const before = started.length;
    send({ type: 'unstuck', player: 0 });
    expect(started.length).toBe(before + 1);
    director.dispose();
  });
});
