// Musique jouée (cahier 4.5 et 4.7): jugement des frappes, partitions tirées du MIDI, air factice
// ajouté par les seules données, air joué seul puis à deux sur un réseau lent, auditeurs,
// récompenses du jour, sauvegarde et reprise.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRandom } from '@duo/sdk/sim';
import { describe, expect, it } from 'vitest';
import {
  AIR_DIR,
  MIDI_DIR,
  deriveScore,
  formatAir,
  parseMidi,
  type AirSource,
} from '../outils/partition-air';
import { plan } from '../outils/nouveau';
import { loadMusicTable } from '../src/audio/musique/table';
import { loadTimbres, parseTimbres } from '../src/audio/musique/timbres';
import type { Content } from '../src/donnees/charger';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import { createGuest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { aimOf } from '../src/simulation/briques/visee';
import { bondOf } from '../src/simulation/dialogues/amitie';
import { listeningTo } from '../src/simulation/habitants/ecoute';
import { recitalOf } from '../src/simulation/musique/index';
import {
  accuracyOf,
  judge,
  ratingOf,
  tallyOf,
  windowScaleOf,
  windowsOf,
} from '../src/simulation/musique/jugement';
import { bestRating, leadMs, notesOf, songbook } from '../src/simulation/musique/lecture';
import { botPresses, createPerformance, type Press } from '../src/simulation/musique/local';
import { createPartnerVoice } from '../src/simulation/musique/partenaire';
import { createDesk, type Desk, type StageSound } from '../src/simulation/musique/poste';
import { MUSIC, type AssistLevel } from '../src/simulation/musique/reglages';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { step, type AuthoredIntent, type Sim } from '../src/simulation/noyau/pas';
import { giveEntry } from '../src/simulation/regles/recompenses';
import { contentWith, contextOf } from './aides-l3';
import { MEMBERS, newSim } from './aides';
import { createVirtualLink, memoryLog } from './aides-reseau';

type Json = Record<string, unknown>;

const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const MARCH = 'air-marche-de-la-halte';
const CANON = 'air-canon-de-la-repetition';
const STEP_MS = SIM_DT * 1000;

/** Un pupitre entre les deux départs des joueurs (18,5 ; 20) et (21,5 ; 20), un banc et une estrade plus loin. */
function stageFiles(files: Record<string, Json>): void {
  const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
  objects.push({ id: 'pupitre-1', type: 'pupitre', x: 20, y: 20.9, rotation: 0 });
  objects.push({ id: 'banc-1', type: 'banc', x: 26, y: 24, rotation: 0 });
  objects.push({ id: 'estrade-1', type: 'estrade-de-fanfare', x: 12, y: 24, rotation: 0 });
}

/**
 * Un air factice de 8 s: le gabarit, sa fiche du carnet, et la partition que le script en tire.
 * Il prend le troisième rang du cahier (la berceuse recule): un cornet de base sait le jouer.
 */
function fakeAirFiles(files: Record<string, Json>): void {
  Object.assign(files['commun/airs/air-chanson-des-marmites.json'] ?? {}, { order: 50 });
  for (const file of plan(TEMPLATE_DIR, 'air-jouable', 'air-factice', null)) {
    const air = file.value as Json & AirSource;
    Object.assign(air, { order: 3, source: { ...air.source, bars: 8 } });
    const midi = parseMidi(new Uint8Array(readFileSync(join(MIDI_DIR, air.source.midi))));
    files[file.path] = { ...air, score: deriveScore(air, midi) };
  }
  files['commun/carnet/air-factice.json'] = {
    schema: 1,
    id: 'air-factice',
    category: 'musiques',
    name: 'Air factice',
    place: 'essai-gare',
    source: { type: 'tune' },
    rarity: null,
    text: 'Un air ajouté par le test.',
  };
}

const content = contentWith((files) => {
  stageFiles(files);
  fakeAirFiles(files);
});

/** Partie neuve: les deux joueurs devant le pupitre, cornet en main, les airs appris. */
function stageSim(c: Content = content, airs: readonly string[] = ['air-factice']): Sim {
  const sim = newSim(c);
  Object.assign(sim.world.players[0].body, { x: 18.5, y: 20 });
  Object.assign(sim.world.players[1].body, { x: 21.5, y: 20 });
  for (const player of sim.world.players) {
    player.toolbar[0] = { item: 'cornet', count: 1 };
    player.selected = 0;
  }
  for (const air of airs) giveEntry(contextOf(sim), 0, air);
  return sim;
}

interface Heard {
  readonly who: 'me' | 'partner';
  readonly midi: number;
  readonly atMs: number | null;
  readonly sour: boolean;
  /** Instant de l'air où la note a été demandée. */
  readonly askedAt: number;
}

/** Son factice: l'horloge de l'air suit l'heure de session, les notes demandées sont retenues. */
function fakeSound(now: () => number): StageSound & { heard: Heard[]; soured: number[] } {
  let startAt: number | null = null;
  const heard: Heard[] = [];
  const soured: number[] = [];
  return {
    heard,
    soured,
    start(spec) {
      startAt = spec.startAtMs;
    },
    airNow: () => (startAt === null ? null : now() - startAt),
    note(spec) {
      heard.push({
        who: spec.who,
        midi: spec.midi,
        atMs: spec.atMs,
        sour: spec.sour,
        askedAt: startAt === null ? 0 : now() - startAt,
      });
      return heard.length;
    },
    sour(id) {
      soured.push(id);
    },
    stop() {
      startAt = null;
    },
  };
}

interface Seat {
  readonly desk: Desk;
  readonly sound: ReturnType<typeof fakeSound>;
  presses: Press[];
}

function seat(
  c: Content,
  player: () => PlayerIndex | null,
  world: () => Sim['world'] | null,
  send: (intent: Intent) => void,
  now: () => number,
  assist: AssistLevel = 0,
): Seat {
  const sound = fakeSound(now);
  const desk = createDesk({
    content: c,
    world,
    local: player,
    send,
    sessionNow: now,
    assist: () => assist,
    sound,
  });
  return { desk, sound, presses: [] };
}

/** Le robot frappe ce qui est dû à l'instant de l'air de son poste. */
function robot(seat: Seat): void {
  const view = seat.desk.view();
  if (view.kind !== 'play') return;
  while ((seat.presses[0]?.atMs ?? Infinity) <= view.airMs) {
    const press = seat.presses.shift();
    if (press !== undefined) seat.desk.press(press.lane, press.atMs);
  }
}

/** Banc sans réseau: la simulation de l'hôte et un poste par joueur, sur une horloge commune. */
function localBench(sim: Sim, players: readonly PlayerIndex[], assist: AssistLevel = 0) {
  const queue: AuthoredIntent[] = [];
  const now = (): number => sim.world.tick * STEP_MS;
  const seats = new Map<PlayerIndex, Seat>();
  for (const p of players)
    seats.set(
      p,
      seat(
        sim.content,
        () => p,
        () => sim.world,
        (intent) => queue.push({ player: p, intent }),
        now,
        assist,
      ),
    );
  const events: GameEvent[] = [];
  const tick = (): void => {
    step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], queue.splice(0));
    for (const event of [...sim.events]) {
      events.push(event);
      for (const s of seats.values()) s.desk.onEvent(event);
    }
    for (const s of seats.values()) {
      s.desk.frame(STEP_MS);
      robot(s);
    }
  };
  return {
    events,
    seats,
    queue,
    tick,
    run(seconds: number): void {
      for (let i = 0; i < Math.round(seconds / SIM_DT); i++) tick();
    },
    /** Joue jusqu'au mot de la fin (ou 90 s). */
    untilFinished(): Extract<GameEvent, { type: 'music_finished' }> {
      for (let i = 0; i < 90 / SIM_DT; i++) {
        tick();
        const done = events.find((e) => e.type === 'music_finished');
        if (done?.type === 'music_finished') return done;
      }
      throw new Error(`air jamais fini: ${JSON.stringify(events.slice(-5))}`);
    },
    open(player: PlayerIndex, target = 'pupitre-1'): void {
      queue.push({ player, intent: { type: 'use_brick', target, brick: 'perform' } });
      tick();
    },
  };
}

function seatOf(bench: ReturnType<typeof localBench>, player: PlayerIndex): Seat {
  const found = bench.seats.get(player);
  if (found === undefined) throw new Error('poste absent');
  return found;
}

/** Seul au pupitre: ouvre le cahier, lance l'air de rang `selected`, le robot joue. */
function playSolo(
  sim: Sim,
  style: 'perfect' | 'clumsy' | 'silent',
  selected = 0,
): {
  finished: Extract<GameEvent, { type: 'music_finished' }>;
  bench: ReturnType<typeof localBench>;
} {
  const bench = localBench(sim, [0]);
  const mine = seatOf(bench, 0);
  bench.open(0);
  mine.desk.move(selected);
  mine.desk.confirm();
  bench.tick();
  const view = mine.desk.view();
  if (view.kind !== 'play') throw new Error(`air non lancé: ${JSON.stringify(bench.events)}`);
  if (style !== 'silent') mine.presses = botPresses(view.mine.notes, style, createRandom(3));
  return { finished: bench.untilFinished(), bench };
}

describe('musique jouée: jugement', () => {
  const w = windowsOf(1);

  it('juge juste, tôt, tard, fausse et manquée selon l’écart et la touche', () => {
    expect(judge(0, true, w)).toBe('just');
    expect(judge(-MUSIC.windows.just, true, w)).toBe('just');
    expect(judge(-(MUSIC.windows.just + 1), true, w)).toBe('early');
    expect(judge(MUSIC.windows.near, true, w)).toBe('late');
    expect(judge(MUSIC.windows.near + 1, true, w)).toBe('false');
    expect(judge(20, false, w)).toBe('false');
    expect(judge(MUSIC.windows.loose + 1, true, w)).toBe('missed');
    expect(judge(null, true, w)).toBe('missed');
  });

  it('élargit les fenêtres de 25 et 50 % avec l’aide du joueur, sans dépasser le plafond', () => {
    expect([0, 1, 2].map((level) => windowScaleOf(level as AssistLevel))).toEqual([1, 1.25, 1.5]);
    const late = MUSIC.windows.near + 20;
    expect(judge(late, true, windowsOf(windowScaleOf(0)))).toBe('false');
    expect(judge(late, true, windowsOf(windowScaleOf(2)))).toBe('late');
    expect(windowScaleOf(2, 3)).toBe(MUSIC.maxWindowScale);
  });

  it('ne punit jamais: une frappe en l’air ne coûte rien, une mauvaise touche sonne faux et passe', () => {
    const notes = notesOf(content.airs['air-factice']?.score ?? missing(), 'solo');
    const game = createPerformance(notes, w);
    const first = notes[0] ?? missing();
    const second = notes[1] ?? missing();
    expect(game.press(first[1], first[0] - 2000)).toBeNull();
    expect(game.press((first[1] + 1) % 4, first[0] + 10)?.verdict).toBe('false');
    expect(game.press(second[1], second[0] - 100)).toMatchObject({ verdict: 'early', index: 1 });
    // Le temps passe: tout le reste est manqué, l'air va au bout.
    const missed = game.advance(1e9);
    expect(missed).toHaveLength(notes.length - 2);
    expect(game.done()).toBe(true);
    const tally = tallyOf(game.verdicts(), notes.length);
    expect(tally).toMatchObject({ just: 0, near: 1, false: 1, missed: notes.length - 2 });
    expect(ratingOf(accuracyOf(tally))).toBe(0);
  });

  it('un robot parfait joue tout juste, un robot maladroit fait de tout', () => {
    const notes = notesOf(content.airs[MARCH]?.score ?? missing(), 'solo');
    const perfect = createPerformance(notes, w);
    for (const press of botPresses(notes, 'perfect')) perfect.press(press.lane, press.atMs);
    expect(tallyOf(perfect.verdicts(), notes.length).just).toBe(notes.length);
    const clumsy = createPerformance(notes, w);
    for (const press of botPresses(notes, 'clumsy', createRandom(5))) {
      clumsy.advance(press.atMs);
      clumsy.press(press.lane, press.atMs);
    }
    clumsy.advance(1e9);
    const tally = tallyOf(clumsy.verdicts(), notes.length);
    for (const count of Object.values(tally)) expect(count).toBeGreaterThan(0);
  });
});

function missing(): never {
  throw new Error('donnée absente');
}

describe('musique jouée: partitions', () => {
  it('chaque partition livrée est celle que le script tire du MIDI de l’air', () => {
    const files = readdirSync(AIR_DIR).filter((name) => name.endsWith('.json'));
    const orders: number[] = [];
    for (const name of files) {
      const text = readFileSync(join(AIR_DIR, name), 'utf8');
      const air = JSON.parse(text) as Json & AirSource & { order: number };
      orders.push(air.order);
      const midi = parseMidi(new Uint8Array(readFileSync(join(MIDI_DIR, air.source.midi))));
      expect(formatAir(air, deriveScore(air, midi)), name).toBe(text);
    }
    // Les huit airs d'Aubrune, un rang chacun.
    expect(orders.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('tient chaque air entre 20 et 45 s, sans frappe plus serrée que son écart minimal', () => {
    for (const air of Object.values(gameAirs())) {
      const score = air.score ?? missing();
      expect(score.lengthMs, air.id).toBeGreaterThanOrEqual(20_000);
      expect(score.lengthMs, air.id).toBeLessThanOrEqual(45_000);
      for (const notes of [score.solo, ...(score.duo ?? [])]) {
        expect(notes.length, air.id).toBeGreaterThanOrEqual(10);
        // Quatre touches, toutes servies au moins une fois dans l'air.
        expect(new Set(notes.map((n) => n[1])).size, air.id).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('air factice: le gabarit et sa fiche du carnet suffisent, il paraît au cahier de fanfare', () => {
    const sim = stageSim();
    const book = songbook(sim.content, sim.world, 0);
    const line = book.find((l) => l.air.id === 'air-factice');
    expect(line).toMatchObject({ name: 'Air factice', known: true, allowed: true, best: null });
    // Un air pas encore appris reste au cahier, fermé.
    expect(book.find((l) => l.air.id === MARCH)).toMatchObject({ known: false });
  });
});

function gameAirs(): Content['airs'] {
  return Object.fromEntries(Object.entries(content.airs).filter(([id]) => id !== 'air-factice'));
}

describe('musique jouée: son', () => {
  it('chaque instrument nomme un timbre de la table, chaque air tient dans son accompagnement', () => {
    const timbres = loadTimbres();
    const instruments = Object.values(content.items).filter((item) => item.instrument);
    expect(instruments.map((item) => item.id).sort()).toEqual(['clarinette', 'cornet']);
    for (const item of instruments)
      expect(timbres.timbres[item.instrument?.timbre ?? ''], item.id).toBeDefined();
    expect(() => parseTimbres({ ...timbres, fallback: 'inconnu' })).toThrow(/repli/);
    const table = loadMusicTable();
    for (const air of Object.values(gameAirs())) {
      const track = table.tracks[air.id];
      const score = air.score ?? missing();
      expect(track?.stems.fond, air.id).toBeDefined();
      expect((score.startMs + score.lengthMs) / 1000, air.id).toBeLessThanOrEqual(
        track?.seconds ?? 0,
      );
    }
  });
});

describe('musique jouée: où et avec quoi', () => {
  it('« jouer ici »: sur un banc avec l’instrument en main, sinon on s’assoit; l’estrade le réclame', () => {
    const sim = stageSim();
    const body = sim.world.players[0].body;
    Object.assign(body, { x: 26, y: 25.2, facing: -Math.PI / 2 });
    expect(aimOf(sim, 0)).toMatchObject({ id: 'banc-1', action: 'perform', refusal: null });
    sim.world.players[0].selected = null;
    expect(aimOf(sim, 0)).toMatchObject({ id: 'banc-1', action: 'sit' });
    Object.assign(body, { x: 12, y: 26.2, facing: -Math.PI / 2 });
    expect(aimOf(sim, 0)).toMatchObject({
      id: 'estrade-1',
      action: 'perform',
      refusal: 'need-instrument',
    });
  });

  it('un instrument de base ne joue que les trois premiers rangs du cahier', () => {
    const sim = stageSim(content, ['air-factice', MARCH, 'air-valse-de-la-minute']);
    const book = songbook(sim.content, sim.world, 0);
    expect(book.filter((l) => l.allowed).map((l) => l.air.order)).toEqual([1, 2, 3]);
    const bench = localBench(sim, [0]);
    bench.open(0);
    bench.queue.push({
      player: 0,
      intent: { type: 'music_go', air: 'air-valse-de-la-minute', startAtMs: 5000 },
    });
    bench.tick();
    expect(bench.events).toContainEqual({
      type: 'refused',
      player: 0,
      reason: 'instrument-too-simple',
      target: 'pupitre-1',
    });
    // La clarinette (niveau 1) l'ouvre.
    sim.world.players[0].toolbar[0] = { item: 'clarinette', count: 1 };
    expect(
      songbook(sim.content, sim.world, 0)
        .filter((l) => l.allowed)
        .map((l) => l.air.order),
    ).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('musique jouée: un air seul', () => {
  it('robot parfait: tout juste, le plus beau mot, l’air retenu au carnet du duo', () => {
    const sim = stageSim();
    const { finished, bench } = playSolo(sim, 'perfect', 2);
    const total = notesOf(content.airs['air-factice']?.score ?? missing(), 'solo').length;
    expect(finished).toMatchObject({ air: 'air-factice', rating: 3, duo: false, first: true });
    expect(finished.results[0]).toMatchObject({ just: total, near: 0, false: 0, missed: 0 });
    expect(finished.results[1]).toBeNull();
    expect(bestRating(sim.world, 'air-factice')).toBe(3);
    // Le joueur s'entend: chaque note sonne tout de suite, juste.
    const mine = seatOf(bench, 0);
    expect(mine.sound.heard.filter((n) => n.who === 'me' && !n.sour)).toHaveLength(total);
    expect(mine.desk.view().kind).toBe('result');
    expect(recitalOf(sim.world, 0)).toBeNull();
  });

  it('robot muet ou maladroit: l’air va au bout quand même, avec un mot gentil', () => {
    const silent = playSolo(stageSim(), 'silent', 2).finished;
    expect(silent.rating).toBe(0);
    expect(silent.results[0]?.missed).toBeGreaterThan(0);
    const clumsy = playSolo(stageSim(), 'clumsy', 2);
    expect(clumsy.finished.results[0]?.false).toBeGreaterThan(0);
    // Les fausses notes ont sonné faux chez le joueur.
    const sour = seatOf(clumsy.bench, 0).sound.heard.filter((n) => n.sour).length;
    expect(sour).toBe(clumsy.finished.results[0]?.false);
  });

  it('les habitants proches s’arrêtent et écoutent; le chapeau et leur amitié, une fois par jour', () => {
    const sim = stageSim();
    const before = sim.world.players[0].money;
    const bench = localBench(sim, [0]);
    const mine = seatOf(bench, 0);
    bench.open(0);
    mine.desk.move(2);
    mine.desk.confirm();
    bench.run(3);
    // La cheffe de gare, à son guichet à 6,5 m, écoute le joueur.
    expect(listeningTo(sim.world, 'cheffe-de-gare')).toBe(0);
    const view = mine.desk.view();
    if (view.kind === 'play') mine.presses = botPresses(view.mine.notes, 'perfect');
    const first = bench.untilFinished();
    expect(first.listeners).toBe(1);
    expect(first.results[0]).toMatchObject({ cents: MUSIC.hat.centsPerListener[3], friends: 1 });
    expect(sim.world.players[0].money).toBe(before + MUSIC.hat.centsPerListener[3]);
    expect(bondOf(sim, 'cheffe-de-gare', 0)).toBeGreaterThan(0);
    const bond = bondOf(sim, 'cheffe-de-gare', 0);
    // Le même jour: on rejoue pour le plaisir, sans chapeau ni amitié de plus.
    const again = playSolo(sim, 'perfect', 2).finished;
    expect(again.results[0]).toMatchObject({ rating: 3, cents: 0, friends: 0 });
    expect(again.first).toBe(false);
    expect(bondOf(sim, 'cheffe-de-gare', 0)).toBe(bond);
    // Le lendemain, le chapeau tourne de nouveau.
    sim.world.common.day += 1;
    expect(playSolo(sim, 'perfect', 2).finished.results[0]?.cents).toBeGreaterThan(0);
  });

  it('s’éloigner ou ranger l’instrument arrête de jouer sans rien coûter', () => {
    const sim = stageSim();
    const bench = localBench(sim, [0]);
    bench.open(0);
    expect(recitalOf(sim.world, 0)).toMatchObject({ target: 'pupitre-1', air: null });
    sim.world.players[0].selected = null;
    bench.tick();
    expect(recitalOf(sim.world, 0)).toBeNull();
    expect(seatOf(bench, 0).desk.isOpen()).toBe(false);
  });

  it('l’hôte tient l’horloge: une note annoncée hors de son heure est manquée', () => {
    const sim = stageSim();
    const bench = localBench(sim, [0]);
    bench.open(0);
    bench.queue.push({
      player: 0,
      intent: { type: 'music_go', air: 'air-factice', startAtMs: 4000 },
    });
    bench.tick();
    // Bien avant le premier temps, la dernière note de l'air « jouée juste »: refusée.
    const notes = notesOf(content.airs['air-factice']?.score ?? missing(), 'solo');
    const last = notes.length - 1;
    bench.queue.push({
      player: 0,
      intent: { type: 'music_note', index: last, lane: notes[last]?.[1] ?? 0, offsetMs: 0 },
    });
    bench.tick();
    expect(bench.events).toContainEqual({
      type: 'music_note',
      player: 0,
      index: last,
      verdict: 'missed',
    });
  });
});

describe('musique jouée: duo', () => {
  it('sans réseau: chacun sa voix, un duo réussi ensemble vaut plus que deux solos', () => {
    const sim = stageSim();
    const bench = localBench(sim, [0, 1]);
    bench.open(0);
    bench.open(1);
    expect(seatOf(bench, 0).desk.view()).toMatchObject({ kind: 'book', partner: true });
    expect(seatOf(bench, 1).desk.view().kind).toBe('wait');
    seatOf(bench, 0).desk.move(2);
    seatOf(bench, 0).desk.confirm();
    bench.tick();
    for (const p of [0, 1] as const) {
      const view = seatOf(bench, p).desk.view();
      if (view.kind !== 'play') throw new Error('duo non lancé');
      expect(view.partner).not.toBeNull();
      seatOf(bench, p).presses = botPresses(view.mine.notes, 'perfect');
    }
    expect(recitalOf(sim.world, 0)?.voice).toBe(0);
    expect(recitalOf(sim.world, 1)?.voice).toBe(1);
    const finished = bench.untilFinished();
    expect(finished).toMatchObject({ duo: true, together: true, rating: 3, listeners: 1 });
    const solo = MUSIC.hat.centsPerListener[3];
    for (const p of [0, 1] as const)
      expect(finished.results[p]?.cents).toBe(Math.round((solo * MUSIC.duo.bonus) / 5) * 5);
    expect((finished.results[0]?.cents ?? 0) + (finished.results[1]?.cents ?? 0)).toBeGreaterThan(
      2 * solo,
    );
  });

  it('entendre l’autre: sa voix tombe en mesure, se tait après une note manquée, revient ensuite', () => {
    const notes = notesOf(content.airs[CANON]?.score ?? missing(), 0);
    const voice = createPartnerVoice(notes);
    const at = (i: number): number => notes[i]?.[0] ?? missing();
    // Les deux premières notes partent d'avance, à leur instant écrit.
    expect(voice.plan(at(0) - 100)).toEqual([{ type: 'play', index: 0, atMs: at(0), late: false }]);
    expect(voice.result(0, 'just', at(0) + 60)).toEqual([]);
    expect(voice.plan(at(1) - 100)).toEqual([{ type: 'play', index: 1, atMs: at(1), late: false }]);
    // La deuxième était fausse: déjà partie, elle se met à sonner faux.
    expect(voice.result(1, 'false', at(1) + 60)).toEqual([{ type: 'sour', index: 1 }]);
    // La troisième est manquée: la voix se tait pour la quatrième.
    voice.plan(at(2) - 100);
    voice.result(2, 'missed', at(2) + 400);
    expect(voice.playing()).toBe(false);
    expect(voice.plan(at(3) - 100)).toEqual([]);
    // Il rejoue la quatrième: apprise 60 ms après, elle s'entend encore; la suite repart d'avance.
    expect(voice.result(3, 'just', at(3) + 60)).toEqual([
      { type: 'play', index: 3, atMs: at(3) + 60, late: true },
    ]);
    expect(voice.plan(at(4) - 100)).toEqual([{ type: 'play', index: 4, atMs: at(4), late: false }]);
  });

  it('réseau à 50 ms: mêmes verdicts chez l’hôte et l’invité, et chacun entend l’autre en mesure', () => {
    const sim = stageSim(content, [CANON]);
    const clock = { now: 0 };
    const now = (): number => clock.now;
    const link = createVirtualLink({ latencyMs: 50, jitterMs: 10, lossPercent: 0 }, 11, now);
    const log = memoryLog();
    const host = createHost(sim, link.host, log, 0);
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now });
    host.sendAll();
    const hostSeat = seat(
      content,
      () => 0,
      () => sim.world,
      (i) => {
        host.queueLocal(i);
      },
      now,
    );
    const guestSeat = seat(
      content,
      () => guest.localIndex(),
      () => guest.world(),
      (i) => {
        guest.queueIntent(i);
      },
      now,
    );
    const seen: GameEvent[] = [];
    guest.onEvent((event) => {
      guestSeat.desk.onEvent(event);
    });
    let n = 0;
    const tick = (): void => {
      clock.now += STEP_MS;
      link.deliver(clock.now);
      for (const event of host.step(idleInput(n))) {
        seen.push(event);
        hostSeat.desk.onEvent(event);
      }
      guest.step(idleInput((n += 1)));
      link.deliver(clock.now);
      for (const s of [hostSeat, guestSeat]) {
        s.desk.frame(STEP_MS);
        robot(s);
      }
    };
    const run = (seconds: number): void => {
      for (let i = 0; i < seconds / SIM_DT; i++) tick();
    };
    run(1);
    expect(guest.ready()).toBe(true);
    // L'invité tient le cahier: l'heure de départ qu'il propose vaut pour les deux machines.
    guest.queueIntent({ type: 'use_brick', target: 'pupitre-1', brick: 'perform' });
    run(0.5);
    host.queueLocal({ type: 'use_brick', target: 'pupitre-1', brick: 'perform' });
    run(0.5);
    expect(guestSeat.desk.view()).toMatchObject({ kind: 'book', partner: true });
    guestSeat.desk.confirm();
    run(0.5);
    const views = [hostSeat, guestSeat].map((s) => s.desk.view());
    const [hostView, guestView] = views;
    if (hostView?.kind !== 'play' || guestView?.kind !== 'play') throw new Error('duo non lancé');
    // Même instant de l'air sur les deux machines, malgré le retard de l'annonce.
    expect(hostView.airMs).toBeCloseTo(guestView.airMs, 5);
    expect(hostView.airMs).toBeLessThan(0);
    hostSeat.presses = botPresses(hostView.mine.notes, 'clumsy', createRandom(8), 120);
    guestSeat.presses = botPresses(guestView.mine.notes, 'perfect');
    const hostNotes = hostView.mine.notes;
    const guestNotes = guestView.mine.notes;
    // Ce que chaque machine a jugé chez elle, pour le comparer à ce que l'hôte a validé.
    let finished: Extract<GameEvent, { type: 'music_finished' }> | undefined;
    let local: { host: readonly unknown[]; guest: readonly unknown[] } | null = null;
    for (let i = 0; i < 60 / SIM_DT && finished === undefined; i++) {
      const [h, g] = [hostSeat.desk.view(), guestSeat.desk.view()];
      if (h.kind === 'play' && g.kind === 'play')
        local = { host: [...h.mine.verdicts], guest: [...g.mine.verdicts] };
      tick();
      const done = seen.find((e) => e.type === 'music_finished');
      if (done?.type === 'music_finished') finished = done;
    }
    if (finished === undefined || local === null) throw new Error('duo jamais fini');
    const validated = (player: PlayerIndex, total: number): (string | null)[] => {
      const verdicts: (string | null)[] = Array.from({ length: total }, () => null);
      for (const e of seen)
        if (e.type === 'music_note' && e.player === player) verdicts[e.index] = e.verdict;
      return verdicts;
    };
    // Égalité hôte et invité: l'hôte valide ce que chaque machine a jugé, sans avantage pour lui.
    expect(validated(0, hostNotes.length)).toEqual(local.host);
    expect(validated(1, guestNotes.length)).toEqual(local.guest);
    expect(finished.results[1]).toMatchObject({ just: guestNotes.length, missed: 0, rating: 3 });
    expect(finished.duo).toBe(true);
    // L'hôte entend l'invité (parfait): chaque note de sa voix, programmée à son instant écrit.
    const heardGuest = hostSeat.sound.heard.filter((h) => h.who === 'partner');
    expect(heardGuest.map((h) => h.atMs)).toEqual(guestNotes.map((note) => note[0]));
    for (const h of heardGuest) expect(h.askedAt).toBeLessThanOrEqual(h.atMs ?? 0);
    // L'invité entend l'hôte (maladroit): la plupart en mesure, et ses fausses notes sonnent faux.
    const heardHost = guestSeat.sound.heard.filter((h) => h.who === 'partner');
    const onTime = heardHost.filter((h) => h.atMs !== null && h.askedAt <= h.atMs).length;
    expect(onTime).toBeGreaterThan(hostNotes.length * 0.6);
    const falseNotes = local.host.filter((verdict) => verdict === 'false').length;
    if (falseNotes > 0)
      expect(
        guestSeat.sound.soured.length + heardHost.filter((h) => h.sour).length,
      ).toBeGreaterThan(0);
    expect(log.entries.filter((entry) => entry.level === 'error')).toEqual([]);
    host.dispose();
    guest.dispose();
  });
});

describe('musique jouée: sauvegarde et reprise', () => {
  it('garde le meilleur mot et le chapeau du jour; un air en cours n’est pas sauvegardé', () => {
    const sim = stageSim();
    playSolo(sim, 'perfect', 2);
    // Un nouvel air est en cours au moment de la sauvegarde.
    const bench = localBench(sim, [0]);
    bench.open(0);
    seatOf(bench, 0).desk.move(2);
    seatOf(bench, 0).desk.confirm();
    bench.run(2);
    expect(recitalOf(sim.world, 0)?.air).toBe('air-factice');
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world, content))) as {
      dataSchema: number;
      data: unknown;
    };
    const restored = restoreWorld(content, saved, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const again = newSim(content);
    Object.assign(again, { world: restored.world });
    expect(recitalOf(again.world, 0)).toBeNull();
    expect(bestRating(again.world, 'air-factice')).toBe(3);
    expect(again.world.players[0].toolbar[0]).toEqual({ item: 'cornet', count: 1 });
    // Le même jour après la reprise: le chapeau a déjà tourné; l'air se rejoue en entier.
    const replay = playSolo(again, 'perfect', 2).finished;
    expect(replay).toMatchObject({ rating: 3, first: false });
    expect(replay.results[0]?.cents).toBe(0);
    expect(leadMs(content.airs['air-factice']?.score ?? missing())).toBeGreaterThanOrEqual(
      MUSIC.countIn.minMs,
    );
  });
});
