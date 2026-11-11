// Accord des instruments (cahier 4.5): l'instrument se désaccorde à l'usage, sonne de plus en
// plus faux et rapporte un peu moins, jamais rien de sec; Armand l'accorde (dialogue), le
// diapason aussi (geste au cahier de fanfare, seul ou l'autre tenant le diapason). État porté
// par la pile (`wear`): même chez l'hôte et l'invité, sauvegardé, lu « juste » s'il manque.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MIDI_DIR, deriveScore, parseMidi, type AirSource } from '../outils/partition-air';
import { plan } from '../outils/nouveau';
import type { PlayerIndex } from '../src/donnees/schemas/communs';
import type { Stack } from '../src/etat/joueur';
import { createGuest } from '../src/reseau/invite';
import { createHost } from '../src/reseau/hote';
import { restoreWorld, snapshotOf } from '../src/sauvegarde/sauvegarde';
import { isPlanKnown } from '../src/simulation/fabrication/plans';
import {
  airsSinceTuning,
  createTuningGesture,
  toleranceFor,
  tuneCents,
  tuneSpan,
  tuneState,
  wearTune,
} from '../src/simulation/musique/accord';
import { botPresses } from '../src/simulation/musique/local';
import { createDesk, type Desk, type StageSound } from '../src/simulation/musique/poste';
import { MUSIC } from '../src/simulation/musique/reglages';
import { SIM_DT } from '../src/simulation/noyau/constantes';
import { idleInput, type Intent } from '../src/simulation/noyau/entrees';
import type { GameEvent } from '../src/simulation/noyau/evenements';
import { step, type AuthoredIntent, type Sim } from '../src/simulation/noyau/pas';
import { evaluate } from '../src/simulation/regles/conditions';
import { applyEffects } from '../src/simulation/regles/effets';
import { giveEntry } from '../src/simulation/regles/recompenses';
import { contentWith, contextOf } from './aides-l3';
import { MEMBERS, gameContent, newSim } from './aides';
import { createVirtualLink, memoryLog } from './aides-reseau';

type Json = Record<string, unknown>;
const TEMPLATE_DIR = fileURLToPath(new URL('../donnees/_gabarits/', import.meta.url));
const STEP_MS = SIM_DT * 1000;

/** Un pupitre entre les deux joueurs, et un air factice de 8 s au troisième rang du cahier. */
const content = contentWith((files) => {
  const objects = files['lieux/essai-gare/carte.json']?.objects as Json[];
  objects.push({ id: 'pupitre-1', type: 'pupitre', x: 20, y: 20.9, rotation: 0 });
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
});

const cornet = content.items.cornet?.instrument ?? missing();

function missing(): never {
  throw new Error('donnée absente');
}

/** Les deux joueurs devant le pupitre, cornet en main (`wear`: accord qui reste, absent: juste). */
function stageSim(wear?: number): Sim {
  const sim = newSim(content);
  Object.assign(sim.world.players[0].body, { x: 18.5, y: 20 });
  Object.assign(sim.world.players[1].body, { x: 21.5, y: 20 });
  for (const player of sim.world.players) {
    player.toolbar[0] =
      wear === undefined ? { item: 'cornet', count: 1 } : { item: 'cornet', count: 1, wear };
    player.selected = 0;
  }
  giveEntry(contextOf(sim), 0, 'air-factice');
  return sim;
}

function cornetOf(sim: Pick<Sim, 'world'>, player: PlayerIndex): Stack {
  return sim.world.players[player].toolbar[0] ?? missing();
}

/** Son factice: l'horloge de l'air suit l'heure de session; notes et accordage retenus. */
function fakeSound(now: () => number) {
  let startAt: number | null = null;
  const notes: { who: string; cents: number }[] = [];
  const tunings: ({ cents: number; holding: boolean } | null)[] = [];
  const sound: StageSound = {
    level: () => undefined,
    start(spec) {
      startAt = spec.startAtMs;
    },
    airNow: () => (startAt === null ? null : now() - startAt),
    note(spec) {
      notes.push({ who: spec.who, cents: spec.cents });
      return notes.length;
    },
    sour: () => undefined,
    stop() {
      startAt = null;
    },
    tuning(spec) {
      tunings.push(spec === null ? null : { cents: spec.cents, holding: spec.holding });
    },
  };
  return { sound, notes, tunings };
}

/** Banc sans réseau: la simulation de l'hôte et le poste du joueur 0. */
function bench(sim: Sim) {
  const queue: AuthoredIntent[] = [];
  const now = (): number => sim.world.tick * STEP_MS;
  const fake = fakeSound(now);
  const desk: Desk = createDesk({
    content,
    world: () => sim.world,
    local: () => 0,
    send: (intent: Intent) => queue.push({ player: 0, intent }),
    sessionNow: now,
    sound: fake.sound,
  });
  const events: GameEvent[] = [];
  let presses: { lane: number; atMs: number }[] = [];
  const tick = (): void => {
    step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], queue.splice(0));
    for (const event of sim.events) {
      events.push(event);
      desk.onEvent(event);
    }
    desk.frame(STEP_MS);
    const view = desk.view();
    if (view.kind === 'play')
      while ((presses[0]?.atMs ?? Infinity) <= view.airMs) {
        const press = presses.shift();
        if (press !== undefined) desk.press(press.lane, press.atMs);
      }
  };
  return {
    desk,
    fake,
    events,
    queue,
    tick,
    open(): void {
      queue.push({
        player: 0,
        intent: { type: 'use_brick', target: 'pupitre-1', brick: 'perform' },
      });
      tick();
    },
    /** Joue l'air factice au robot parfait jusqu'au mot de la fin. */
    play(): Extract<GameEvent, { type: 'music_finished' }> {
      desk.move(2);
      desk.confirm();
      tick();
      const view = desk.view();
      if (view.kind !== 'play') throw new Error(`air non lancé: ${JSON.stringify(events)}`);
      presses = botPresses(view.mine.notes, 'perfect');
      for (let i = 0; i < 60 / SIM_DT; i++) {
        tick();
        const done = events.find((e) => e.type === 'music_finished');
        if (done?.type === 'music_finished') return done;
      }
      throw new Error('air jamais fini');
    },
  };
}

describe('accord: l’instrument se désaccorde comme réglé', () => {
  it('juste pendant sa tenue (20 airs), un peu faux, puis faux, plafonné au pire', () => {
    const sim = stageSim();
    const stack = cornetOf(sim, 0);
    const ctx = contextOf(sim);
    expect(cornet.holds).toBe(20);
    expect(tuneState(cornet, stack)).toBe('just');
    for (let i = 0; i < 19; i++) wearTune(ctx, cornet, stack);
    expect(airsSinceTuning(cornet, stack)).toBe(19);
    expect(tuneState(cornet, stack)).toBe('just');
    expect(tuneCents(cornet, stack)).toBe(0);
    wearTune(ctx, cornet, stack);
    expect(tuneState(cornet, stack)).toBe('slight');
    expect(tuneCents(cornet, stack)).toBe(MUSIC.tuning.cents.first);
    for (let i = 0; i < MUSIC.tuning.slideAirs * MUSIC.tuning.slightBelow; i++)
      wearTune(ctx, cornet, stack);
    expect(tuneState(cornet, stack)).toBe('off');
    for (let i = 0; i < 40; i++) wearTune(ctx, cornet, stack);
    expect(stack.wear).toBe(0);
    expect(tuneCents(cornet, stack)).toBe(MUSIC.tuning.cents.worst);
    expect(ctx.touched.has('players')).toBe(true);
    // Un instrument qui déclare une tenue de 0 ne se désaccorde jamais.
    const steady = { ...cornet, holds: 0 };
    const other: Stack = { item: 'cornet', count: 1 };
    wearTune(ctx, steady, other);
    expect(other.wear).toBeUndefined();
    expect(tuneState(steady, other)).toBe('just');
  });

  it('un air joué jusqu’au bout use un air d’accord', () => {
    const sim = stageSim();
    const b = bench(sim);
    b.open();
    b.play();
    expect(cornetOf(sim, 0).wear).toBe(tuneSpan(cornet) - 1);
  });

  it('désaccordé: toutes ses notes sont décalées, il rapporte moins, jamais rien, et les auditeurs le disent gentiment', () => {
    const runs = [undefined, 0].map((wear) => {
      const sim = stageSim(wear);
      const b = bench(sim);
      b.open();
      const done = b.play();
      return { done, b, view: b.desk.view() };
    });
    const [just, off] = runs;
    if (just === undefined || off === undefined) throw new Error('deux airs attendus');
    // La cheffe de gare écoute dans les deux cas.
    expect(just.done.listeners).toBe(1);
    expect(off.done.listeners).toBe(1);
    expect(just.done.results[0]).toMatchObject({ rating: 3 });
    expect(off.done.results[0]).toMatchObject({ rating: 3 });
    const fullHat = MUSIC.hat.centsPerListener[3];
    expect(just.done.results[0]?.cents).toBe(fullHat);
    const reduced = Math.round((fullHat * MUSIC.tuning.reward.off) / 5) * 5;
    expect(off.done.results[0]?.cents).toBe(reduced);
    expect(reduced).toBeGreaterThan(0);
    expect(off.done.results[0]?.friends).toBe(1);
    const mine = (r: typeof just): number[] =>
      r.b.fake.notes.filter((n) => n.who === 'me').map((n) => n.cents);
    expect(new Set(mine(just))).toEqual(new Set([0]));
    expect(new Set(mine(off))).toEqual(new Set([MUSIC.tuning.cents.worst]));
    // Le mot de la fin sait que l'instrument était faux (l'écran en tire la phrase des auditeurs).
    expect(off.view).toMatchObject({ kind: 'result', tune: 'off' });
    expect(just.view).toMatchObject({ kind: 'result', tune: 'just' });
  });
});

describe('accord: chez Armand', () => {
  it('son dialogue paraît quand l’instrument est faux, l’accorde gratuitement et donne le plan du diapason', () => {
    const real = gameContent();
    const sim = newSim(real);
    sim.world.players[0].toolbar[0] = { item: 'clarinette', count: 1, wear: 3 };
    sim.world.players[0].bag?.slots.splice(0, 1, { item: 'cornet', count: 1, wear: 0 });
    const dialogue =
      real.places.aubrune?.dialogues.find((d) => d.id === 'armand-accordage') ?? missing();
    const ctx = { world: sim.world, content: real, actor: 0 as const };
    expect(dialogue.when.every((c) => evaluate(ctx, c))).toBe(true);
    expect(dialogue.when.every((c) => evaluate({ ...ctx, actor: 1 as const }, c))).toBe(false);
    const money = sim.world.players[0].money;
    for (const node of Object.values(dialogue.nodes))
      if (node.kind === 'effects') applyEffects(contextOf(sim), 0, node.effects);
    expect(sim.world.players[0].toolbar[0]).toEqual({ item: 'clarinette', count: 1 });
    if (sim.world.players[0].bag !== null)
      expect(sim.world.players[0].bag.slots[0]).toEqual({ item: 'cornet', count: 1 });
    expect(sim.world.players[0].money).toBe(money);
    expect(isPlanKnown(sim.world, real.plans.diapason ?? missing())).toBe(true);
    expect(dialogue.when.every((c) => evaluate(ctx, c))).toBe(false);
  });
});

describe('accord: au diapason', () => {
  it('tenir la note jusqu’à ce que le battement cesse: lâcher trop tôt ne coûte rien, lâcher au calme accorde', () => {
    const sim = stageSim(0);
    sim.world.players[0].toolbar[1] = { item: 'diapason', count: 1 };
    const b = bench(sim);
    b.open();
    expect(b.desk.view()).toMatchObject({ kind: 'book', tune: 'off', tuner: true });
    b.desk.tune();
    expect(b.desk.view()).toMatchObject({ kind: 'tune', holding: false, pair: false });
    // Un appui bref: la note glisse un peu, le battement reste, rien n'est envoyé ni perdu.
    b.desk.hold(true);
    for (let i = 0; i < 5; i++) b.tick();
    b.desk.hold(false);
    b.tick();
    expect(b.desk.view()).toMatchObject({ kind: 'tune', result: 'again' });
    expect(cornetOf(sim, 0).wear).toBe(0);
    // On tient jusqu'au calme (la machine entend le battement se taire), puis on lâche.
    b.desk.hold(true);
    let seconds = 0;
    for (; seconds < 10; seconds += SIM_DT) {
      b.tick();
      const view = b.desk.view();
      if (view.kind === 'tune' && view.beatHz < 0.5) break;
    }
    expect(seconds).toBeLessThan(5);
    b.desk.hold(false);
    b.tick();
    expect(b.desk.view()).toMatchObject({ kind: 'tune', result: 'tuned' });
    b.tick();
    expect(cornetOf(sim, 0)).toEqual({ item: 'cornet', count: 1 });
    // Le son a fait entendre le diapason et la note tenue, puis s'est tu au retour au cahier.
    expect(b.fake.tunings.some((t) => t?.holding === true)).toBe(true);
    for (let i = 0; i < 2 / SIM_DT; i++) b.tick();
    expect(b.desk.view()).toMatchObject({ kind: 'book', tune: 'just' });
    expect(b.fake.tunings.at(-1)).toBeNull();
  });

  it('sans diapason: pas d’accordage, et l’hôte refuse une annonce; l’autre peut tenir le sien, à deux on s’entend mieux', () => {
    const sim = stageSim(0);
    const b = bench(sim);
    b.open();
    expect(b.desk.view()).toMatchObject({ kind: 'book', tune: 'off', tuner: false });
    b.desk.tune();
    expect(b.desk.view().kind).toBe('book');
    b.queue.push({ player: 0, intent: { type: 'music_tune', cents: 0 } });
    b.tick();
    expect(b.events.some((e) => e.type === 'refused' && e.reason === 'need-tuner')).toBe(true);
    expect(cornetOf(sim, 0).wear).toBe(0);
    // L'autre joueur, à 3 m, tient le diapason en main.
    sim.world.players[1].toolbar[1] = { item: 'diapason', count: 1 };
    sim.world.players[1].selected = 1;
    b.tick();
    expect(b.desk.view()).toMatchObject({ kind: 'book', tuner: true });
    const alone = toleranceFor(sim.world, 0, false);
    const pair = toleranceFor(sim.world, 0, true);
    expect(pair).toBeCloseTo(alone * MUSIC.tuning.gesture.pairFactor);
    // L'aide du joueur élargit aussi la tolérance.
    sim.world.players[0].assist = 'big';
    expect(toleranceFor(sim.world, 0, false)).toBeCloseTo(alone * 1.5);
    // Une annonce hors tolérance ne change rien; dans la tolérance, l'instrument est juste.
    b.queue.push({ player: 0, intent: { type: 'music_tune', cents: Math.ceil(pair * 1.5) + 1 } });
    b.tick();
    expect(cornetOf(sim, 0).wear).toBe(0);
    b.queue.push({ player: 0, intent: { type: 'music_tune', cents: Math.floor(pair) } });
    b.tick();
    expect(cornetOf(sim, 0).wear).toBeUndefined();
  });

  it('le geste pur: la note revient vers le diapason, le dépasse si l’on insiste, et ne s’égare jamais', () => {
    const gesture = createTuningGesture(-40, 3);
    expect(gesture.release()).toBeNull();
    gesture.press();
    for (let i = 0; i < 400; i++) gesture.advance(20);
    expect(gesture.cents()).toBe(MUSIC.tuning.gesture.maxCents);
    expect(gesture.release()).toBe('again');
    // Repris de l'autre côté, il redescend.
    gesture.press();
    gesture.advance(100);
    expect(gesture.cents()).toBeLessThan(MUSIC.tuning.gesture.maxCents);
  });
});

describe('accord: réseau, sauvegarde', () => {
  it('l’invité voit le même accord que l’hôte, et s’accorde au diapason par le même chemin', () => {
    const sim = stageSim(0);
    sim.world.players[1].toolbar[1] = { item: 'diapason', count: 1 };
    const clock = { now: 0 };
    const now = (): number => clock.now;
    const link = createVirtualLink({ latencyMs: 50, jitterMs: 10, lossPercent: 0 }, 11, now);
    const log = memoryLog();
    const host = createHost(sim, link.host, log, 0);
    const guest = createGuest(content, link.guest, MEMBERS[1].id, { now });
    host.sendAll();
    const fake = fakeSound(now);
    const desk = createDesk({
      content,
      world: () => guest.world(),
      local: () => guest.localIndex(),
      send: (i) => {
        guest.queueIntent(i);
      },
      sessionNow: now,
      sound: fake.sound,
    });
    guest.onEvent((event) => {
      desk.onEvent(event);
    });
    let n = 0;
    const run = (seconds: number, each?: () => void): void => {
      for (let i = 0; i < seconds / SIM_DT; i++) {
        clock.now += STEP_MS;
        link.deliver(clock.now);
        host.step(idleInput(n));
        guest.step(idleInput((n += 1)));
        link.deliver(clock.now);
        desk.frame(STEP_MS);
        each?.();
      }
    };
    run(1);
    expect(guest.ready()).toBe(true);
    expect(guest.world()?.players[1].toolbar[0]).toEqual(cornetOf(sim, 1));
    guest.queueIntent({ type: 'use_brick', target: 'pupitre-1', brick: 'perform' });
    run(0.5);
    expect(desk.view()).toMatchObject({ kind: 'book', tune: 'off', tuner: true });
    desk.tune();
    desk.hold(true);
    let calm = false;
    run(6, () => {
      const view = desk.view();
      if (!calm && view.kind === 'tune' && view.beatHz < 0.5) {
        calm = true;
        desk.hold(false);
      }
    });
    expect(calm).toBe(true);
    expect(cornetOf(sim, 1)).toEqual({ item: 'cornet', count: 1 });
    expect(guest.world()?.players[1].toolbar[0]).toEqual({ item: 'cornet', count: 1 });
    expect(log.entries.filter((entry) => entry.level === 'error')).toEqual([]);
    host.dispose();
    guest.dispose();
  });

  it('l’accord se sauvegarde et se reprend; un instrument d’une partie d’avant (sans état) est juste', () => {
    const sim = stageSim(5);
    sim.world.players[1].toolbar[0] = { item: 'cornet', count: 1 };
    const saved = JSON.parse(JSON.stringify(snapshotOf(sim.world, content))) as {
      dataSchema: number;
      data: unknown;
    };
    const restored = restoreWorld(content, saved, MEMBERS);
    if (!restored.ok) throw new Error(restored.reason);
    const again = { world: restored.world };
    expect(cornetOf(again, 0)).toEqual({ item: 'cornet', count: 1, wear: 5 });
    expect(tuneState(cornet, cornetOf(again, 0))).toBe('slight');
    expect(cornetOf(again, 1)).toEqual({ item: 'cornet', count: 1 });
    expect(tuneState(cornet, cornetOf(again, 1))).toBe('just');
    expect(airsSinceTuning(cornet, cornetOf(again, 1))).toBe(0);
  });
});
