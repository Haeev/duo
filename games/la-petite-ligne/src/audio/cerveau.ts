/**
 * Le « cerveau » du son: à chaque image, il lit l'état et les événements et
 * décide de ce qui doit sonner (sons ponctuels, boucles, musique, ambiances,
 * séquences du train, du réveil et du coucher). Sans Web Audio: le moteur
 * (`moteur.ts`) applique ses décisions, et les tests le font jouer toute la
 * démo avec le robot de la simulation.
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { Content } from '../donnees/types';
import type { GameMap, Rect } from '../etat/carte';
import type { CharacterId, ReadonlyWorld, Vec2, WorldEvent } from '../etat/types';
import { type AmbienceInput, ambienceLevels, ambienceZones, type AmbienceZones } from './ambiances';
import { seasonOfDay, secondsPerGameMinuteOn } from '../donnees/calendrier';
import { mistAmount } from '../etat/meteo';
import { unitDraw } from '../etat/tirage';
import { type Catalogue, type SequenceStep, sequenceOf, stepTime, stopTime } from './catalogue';
import { type EventSignals, type LoopWish, type SoundRequest, StateWatcher, type TriggerContext, noSignals, soundsForEvent } from './declencheurs';
import { distanceBetween, distanceToRect, earPosition } from './espace';
import { MomentSounds } from './moments';
import { type BedWish, MUSIC, type MomentRules, type MusicCommand, MusicDirector, type MusicMoment, chooseBed } from './musique';
import type { AudioSettings } from './reglages';
import { type SequenceCatalogue, type SequenceShot, SequenceRun } from './sequences';
import { type TrainGeometry, type TrainRules, type TrainTimeline, TrainTracker, locomotivePosition } from './train';

const SEQ = {
  arrival: 'train-arrival',
  departure: 'train-departure',
  wake: 'wake-up',
  bed: 'go-to-bed',
} as const;

const TRAIN_IDLE = 'train-idle-loop';
/** Le thème du jour passe à l'après-midi à 13 h (son.md 2). */
const AFTERNOON_FROM_MINUTES = 13 * 60;
/** Avance du décodage d'une musique avant la fin d'un repos (s). */
const MUSIC_PREFETCH_SECONDS = 12;
/** Attente après la fin d'un fondu de sortie avant de décoder la musique suivante (s): la précédente est libérée. */
const PREFETCH_AFTER_FADE_SECONDS = 1;

export interface BrainOptions {
  catalogue: Catalogue;
  settings: AudioSettings;
  content: Content;
  map: GameMap;
  random: RandomSource;
}

export interface BrainInput {
  world: ReadonlyWorld;
  local: CharacterId;
  events: readonly WorldEvent[];
  dt: number;
  alpha: number;
  /** Temps de jeu (s), pauses de la plateforme exclues: séquences, poules. */
  gameTime: number;
  /** Temps de la musique (s): l'horloge du contexte audio (la musique joue pendant la pause, atténuée). */
  musicTime: number;
  /** Orientation de la caméra (`cameraYaw()` du rendu). */
  yaw: number;
}

export interface SyncState {
  tag: string;
  sound: string;
  /** Position voulue dans le fichier (s), ou `null` quand la séquence l'a fini. */
  expected: number | null;
  /** Où est la source (la locomotive), ou `null` pour un son non placé. */
  at: Vec2 | null;
}

export interface BrainFrame {
  listener: { at: Vec2; ear: Vec2; yaw: number; inHouse: boolean };
  shots: SoundRequest[];
  loops: LoopWish[];
  music: readonly MusicCommand[];
  /** Niveau visé de chaque ambiance (gain linéaire). */
  ambience: Map<string, number>;
  /** Ambiances à décoder (actives ou bientôt). */
  ambienceNeeded: Set<string>;
  syncs: SyncState[];
  /** Sons du train à garder décodés (jours de train). */
  trainDay: boolean;
  /** Fichiers du moment rare du jour à garder décodés. */
  momentFiles: ReadonlySet<string>;
  /** Musique atténuée pendant l'apogée d'un moment (dB, 0 sinon), et ses temps de descente et de remontée (s). */
  momentDuck: { db: number; attackSeconds: number; releaseSeconds: number };
  /** Diagnostic. */
  bed: string | null;
  timeline: TrainTimeline;
}

interface ActiveSync {
  tag: string;
  sound: string;
  at: number;
  run: 'arrival' | 'departure';
  duration: number;
  placed: boolean;
}

export class AudioBrain {
  private readonly watcher: StateWatcher;
  private readonly moments: MomentSounds;
  private readonly director: MusicDirector;
  private readonly tracker: TrainTracker;
  private readonly rules: MomentRules;
  private readonly trainRules: TrainRules;
  private readonly geometry: TrainGeometry;
  private readonly stopPoint: Vec2;
  private readonly zones: AmbienceZones;
  private readonly saturdayRects: Rect[];
  private readonly seq: Record<keyof typeof SEQ, readonly SequenceStep[]>;
  private readonly seqCatalogue: SequenceCatalogue;
  private readonly anchors: {
    fanfareAt: number | null;
    saturdayFrom: number;
    idleFrom: number;
    idleStop: number;
    saturdayStop: { at: number; fade: number };
    breakfastAt: number;
    nightAt: number;
    veilleeFade: number | null;
  };

  private arrivalRun: { day: number; run: SequenceRun } | null = null;
  private departureRun: { day: number; run: SequenceRun; restSeconds: number } | null = null;
  private wakeRun: { start: number; run: SequenceRun } | null = null;
  private bedRun: { start: number; run: SequenceRun } | null = null;
  private readonly syncs: ActiveSync[] = [];
  private nearSaturday = false;
  private musicNow = 0;
  private lastDoorAt = Number.NEGATIVE_INFINITY;
  /** Tour 9: jour du dernier cri lointain du soir, par son (`plan.eveningCalls`). */
  private readonly eveningDone = new Map<string, number>();

  private readonly frame: BrainFrame;
  private readonly shotsBuffer: SequenceShot[] = [];
  private readonly signals: EventSignals = { morning: false, wentToBed: false, demoEnded: false, hensFed: false };
  private readonly wish: BedWish = { id: null, rest: false, fadeOut: null };
  private readonly moment: MusicMoment;
  private readonly loco = { x: 0, y: 0 };
  private readonly levelsSoon = new Map<string, number>();
  private readonly ambienceInput: AmbienceInput = {
    minutes: 0,
    weather: 'sunny',
    season: 'spring',
    mist: 0,
    inHouse: false,
    at: { x: 0, y: 0 },
  };
  private triggerContext: TriggerContext | null = null;

  constructor(private readonly options: BrainOptions) {
    const { catalogue, settings, content, map, random } = options;
    const clock = content.settings.clock;
    this.watcher = new StateWatcher(settings, random);
    this.moments = new MomentSounds(catalogue, settings, content, map, random);
    this.director = new MusicDirector({
      music: catalogue.music,
      restLoops: catalogue.rest.playLoops,
      restSeconds: catalogue.rest.silenceSeconds,
      crossfadeSeconds: catalogue.mix.crossfadeSeconds,
      prefetchSeconds: MUSIC_PREFETCH_SECONDS,
      random,
    });
    this.rules = { dayStart: clock.dayStart, afternoonFrom: AFTERNOON_FROM_MINUTES, veilleeFrom: clock.veilleeFrom, lastDay: clock.lastDay };
    this.seq = {
      arrival: sequenceOf(catalogue, SEQ.arrival),
      departure: sequenceOf(catalogue, SEQ.departure),
      wake: sequenceOf(catalogue, SEQ.wake),
      bed: sequenceOf(catalogue, SEQ.bed),
    };
    const arrivalStopAt = stepTime(this.seq.arrival, settings.train.arrivalStopSound) ?? 0;
    const departureMoveAt = stepTime(this.seq.departure, settings.train.departureMoveSound) ?? 0;
    this.trainRules = {
      days: content.settings.train.days,
      arrival: content.settings.train.arrival,
      departure: content.settings.train.departure,
      firstDay: clock.firstDay.day,
      secondsPerGameMinute: secondsPerGameMinuteOn(content.settings, clock.firstDay.day),
      slideSeconds: content.settings.feel.trainSlideSeconds,
      arrivalStopAt,
      departureMoveAt,
    };
    this.tracker = new TrainTracker(this.trainRules);
    const stop = map.points[settings.train.stopPoint] ?? { x: map.width / 2, y: 0 };
    this.stopPoint = { x: stop.x, y: stop.y };
    this.geometry = {
      stop: { x: stop.x + settings.train.locomotiveOffsetM, y: trackY(map) ?? stop.y },
      slideDistance: settings.train.slideDistanceM,
      departureDirection: settings.train.departureDirection,
      offMapX: settings.train.offMapX,
      maxX: map.width,
    };
    this.zones = ambienceZones(map, settings.ambience);
    this.saturdayRects = settings.music.saturdayZones.map((z) => map.zones[z]).filter((r): r is Rect => r !== undefined);
    const saturdayStop = stopTime(this.seq.departure, MUSIC.saturday);
    this.anchors = {
      fanfareAt: stepTime(this.seq.arrival, MUSIC.fanfare),
      saturdayFrom: stepTime(this.seq.arrival, MUSIC.saturday) ?? arrivalStopAt,
      idleFrom: stepTime(this.seq.arrival, TRAIN_IDLE) ?? arrivalStopAt,
      idleStop: stopTime(this.seq.departure, TRAIN_IDLE)?.at ?? departureMoveAt,
      saturdayStop: { at: saturdayStop?.at ?? departureMoveAt, fade: saturdayStop?.fade ?? catalogue.mix.crossfadeSeconds },
      breakfastAt: stepTime(this.seq.wake, MUSIC.breakfast) ?? 0,
      nightAt: stepTime(this.seq.bed, MUSIC.night) ?? 0,
      veilleeFade: stopTime(this.seq.bed, MUSIC.veillee)?.fade ?? null,
    };
    this.seqCatalogue = {
      duration: (id) => catalogue.sounds.get(id)?.durations[0] ?? catalogue.music.get(id)?.duration ?? 0,
      isBedMusic: (id) => catalogue.music.get(id)?.loop !== null && catalogue.music.has(id),
      isSynced: (id) => settings.sequences.syncedSounds.includes(id),
      lateTolerance: settings.sequences.lateToleranceSeconds,
    };
    this.moment = {
      phase: 'creation',
      day: 1,
      minutes: 0,
      veillee: false,
      localStatus: 'active',
      nearSaturdaySpot: false,
      saturdayWindow: false,
      silence: null,
      hold: null,
      now: 0,
    };
    this.frame = {
      listener: { at: { x: 0, y: 0 }, ear: { x: 0, y: 0 }, yaw: 0, inHouse: false },
      shots: [],
      loops: [],
      music: [],
      ambience: new Map(),
      ambienceNeeded: new Set(),
      syncs: [],
      trainDay: false,
      momentFiles: this.moments.files(),
      momentDuck: {
        db: 0,
        attackSeconds: content.settings.moments.musicDuckInSeconds,
        releaseSeconds: content.settings.moments.musicDuckOutSeconds,
      },
      bed: null,
      timeline: { arrival: null, departure: null },
    };
  }

  /**
   * Les cris lointains du soir (tour 9, `plan.eveningCalls`: l'effraie les soirs d'automne sans la
   * dame blanche): une fois par soir, à un instant tiré par la graine et le jour, le même chez les
   * deux; non placés.
   */
  private eveningCalls(world: ReadonlyWorld, shots: SoundRequest[]): void {
    if (world.phase !== 'day') return;
    const { content, catalogue } = this.options;
    const day = world.clock.day;
    for (const call of catalogue.eveningCalls) {
      if (call.times < 1 || this.eveningDone.get(call.sound) === day) continue;
      if (!call.seasons.includes(seasonOfDay(content.settings, day))) continue;
      if (call.notInRain && world.weather === 'rain') continue;
      if (call.notWithMoment !== null && world.moments.today?.id === call.notWithMoment) continue;
      const at = call.from + unitDraw(world.seed, `evening:${call.sound}`, day) * (call.to - call.from);
      const m = world.clock.minutes;
      if (m < at || m >= call.to) continue;
      this.eveningDone.set(call.sound, day);
      shots.push({ sound: call.sound, at: null, gainDb: 0, delay: 0, offset: 0, tag: null });
    }
  }

  /** Une image. Le résultat est réutilisé d'une image à l'autre: le lire tout de suite. */
  update(input: BrainInput): BrainFrame {
    const { world, local } = input;
    const { catalogue, settings, content, map } = this.options;
    const f = this.frame;
    this.musicNow = input.musicTime;
    f.shots.length = 0;
    f.loops.length = 0;
    f.syncs.length = 0;

    // Oreille: le personnage local (position affichée).
    const me = world.characters.find((c) => c.id === local);
    if (me !== undefined) {
      f.listener.at.x = me.prev.x + (me.pos.x - me.prev.x) * input.alpha;
      f.listener.at.y = me.prev.y + (me.pos.y - me.prev.y) * input.alpha;
      f.listener.inHouse = me.inHouse;
    }
    f.listener.yaw = input.yaw;
    earPosition(f.listener.at, input.yaw, settings.listener.backOffsetM, f.listener.ear);

    // Événements, puis ce qui se lit dans l'état.
    const ctx = (this.triggerContext ??= {
      world,
      local,
      content,
      map,
      peerDb: catalogue.peerDb,
      hasSound: (id) => catalogue.sounds.has(id),
    });
    ctx.world = world;
    ctx.local = local;
    const signals = noSignals(this.signals);
    for (const event of input.events) {
      if (event.type === 'door') {
        if (input.gameTime - this.lastDoorAt < settings.delays.doorRepeatSeconds) continue;
        this.lastDoorAt = input.gameTime;
      }
      soundsForEvent(event, ctx, settings, f.shots, signals);
    }
    if (signals.hensFed) this.watcher.excite(input.gameTime);
    this.watcher.update(ctx, input.dt, input.gameTime, f.shots, f.loops);
    this.moments.update(world, input.gameTime, f.shots, f.loops, f.syncs);
    f.momentDuck.db = this.moments.duckDb();
    this.eveningCalls(world, f.shots);

    // Réveil et coucher.
    // La musique qui suit est connue d'avance: on la décode pendant le coq ou l'endormissement.
    if (signals.morning) {
      this.wakeRun = { start: input.gameTime, run: new SequenceRun(SEQ.wake, this.seq.wake, this.seqCatalogue) };
      this.bedRun = null;
      this.director.prefetch(MUSIC.breakfast);
    }
    if (signals.wentToBed) {
      this.bedRun = { start: input.gameTime, run: new SequenceRun(SEQ.bed, this.seq.bed, this.seqCatalogue) };
      this.director.prefetch(MUSIC.night);
    }
    this.runPersonal(input.gameTime);

    // Train.
    const timeline = this.tracker.update(
      { phase: world.phase, day: world.clock.day, minutes: world.clock.minutes, train: world.train },
      input.gameTime,
    );
    f.timeline = timeline;
    f.trainDay = this.trainRules.days.includes(world.clock.day);
    this.runTrain(world, timeline);

    // Musique.
    this.updateNearSaturday(f.listener.at);
    const m = this.moment;
    m.phase = world.phase;
    m.day = world.clock.day;
    m.minutes = world.clock.minutes;
    m.veillee = world.clock.veillee;
    m.localStatus = me?.status ?? 'active';
    m.nearSaturdaySpot = this.nearSaturday;
    m.saturdayWindow = this.saturdayWindow(world, timeline);
    m.silence = this.silence(timeline);
    m.now = input.gameTime;
    m.hold = this.hold();
    const wish = chooseBed(m, this.rules, catalogue.restingMusic, this.wish);
    if (wish.id === null && m.localStatus === 'sleeping' && this.bedRun !== null && wish.fadeOut === null) {
      wish.fadeOut = this.anchors.veilleeFade;
    }
    if (signals.demoEnded) this.director.once(MUSIC.ending, input.musicTime);
    f.music = this.director.update(wish, input.musicTime);
    f.bed = this.director.current();

    // Ambiances: maintenant et bientôt (pour décoder à l'avance).
    const amb = this.ambienceInput;
    const rules = this.options.content.settings;
    amb.minutes = world.clock.minutes;
    amb.weather = world.weather;
    amb.season = seasonOfDay(rules, world.clock.day);
    amb.mist = mistAmount(rules, world.morningMist, world.clock.minutes);
    amb.inHouse = f.listener.inHouse;
    amb.at = f.listener.at;
    ambienceLevels(catalogue.ambienceRules, amb, this.zones, settings.ambience, f.ambience, catalogue.morningMist);
    amb.minutes = world.clock.minutes + settings.ambience.prefetchMinutes;
    amb.mist = mistAmount(rules, world.morningMist, amb.minutes);
    ambienceLevels(catalogue.ambienceRules, amb, this.zones, settings.ambience, this.levelsSoon, catalogue.morningMist);
    f.ambienceNeeded.clear();
    for (const [id, gain] of f.ambience) if (gain > 0) f.ambienceNeeded.add(id);
    for (const [id, gain] of this.levelsSoon) if (gain > 0) f.ambienceNeeded.add(id);
    return f;
  }

  /** Les musiques demandées: celles à décoder au plus tôt. */
  musicDirector(): MusicDirector {
    return this.director;
  }

  private runPersonal(now: number): void {
    const f = this.frame;
    const shots = this.shotsBuffer;
    for (const entry of [this.wakeRun, this.bedRun]) {
      if (entry === null) continue;
      shots.length = 0;
      entry.run.advance(now - entry.start, shots);
      for (const shot of shots) {
        if (shot.music) continue;
        f.shots.push({ sound: shot.sound, at: null, gainDb: 0, delay: 0, offset: 0, tag: null });
      }
    }
  }

  private hold(): MusicMoment['hold'] {
    const now = this.moment.now;
    if (this.wakeRun !== null && now - this.wakeRun.start < this.anchors.breakfastAt) {
      return { music: MUSIC.breakfast, until: this.wakeRun.start + this.anchors.breakfastAt, fadeOut: this.options.settings.music.nightFadeOutSeconds };
    }
    if (this.bedRun !== null && now - this.bedRun.start < this.anchors.nightAt) {
      return { music: MUSIC.night, until: this.bedRun.start + this.anchors.nightAt, fadeOut: this.anchors.veilleeFade };
    }
    return null;
  }

  private runTrain(world: ReadonlyWorld, timeline: TrainTimeline): void {
    const day = world.clock.day;
    if (timeline.arrival !== null && this.arrivalRun?.day !== day) {
      this.arrivalRun = { day, run: new SequenceRun(SEQ.arrival, this.seq.arrival, this.seqCatalogue) };
    }
    if (timeline.departure !== null && this.departureRun?.day !== day) {
      const [low, high] = this.options.settings.train.afterDepartureRestSeconds;
      this.departureRun = {
        day,
        run: new SequenceRun(SEQ.departure, this.seq.departure, this.seqCatalogue),
        restSeconds: high > low ? this.options.random.float(low, high) : low,
      };
    }
    const train = world.train;
    const departed = timeline.departure !== null && train.phase === 'away';
    locomotivePosition(this.geometry, departed ? 'departing' : train.phase, departed ? 0 : train.progress, this.loco);
    if (this.arrivalRun !== null && timeline.arrival !== null) {
      // Pendant la fanfare, une fois le thème du jour effacé et libéré, la musique du samedi se décode (elle part à 32 s).
      const fanfare = this.anchors.fanfareAt;
      if (fanfare !== null && timeline.arrival >= fanfare + PREFETCH_AFTER_FADE_SECONDS && timeline.arrival < this.anchors.saturdayFrom) {
        this.director.prefetch(MUSIC.saturday);
      }
      this.fire('arrival', this.arrivalRun.run, timeline.arrival);
    }
    if (this.departureRun !== null && timeline.departure !== null) this.fire('departure', this.departureRun.run, timeline.departure);

    // Recalage des longs sons sur l'horloge de leur séquence.
    const f = this.frame;
    for (let i = this.syncs.length - 1; i >= 0; i -= 1) {
      const s = this.syncs[i];
      if (s === undefined) continue;
      const t = s.run === 'arrival' ? timeline.arrival : timeline.departure;
      const expected = t === null || !Number.isFinite(t) ? null : t - s.at;
      const at = s.placed ? { x: this.loco.x, y: this.loco.y } : null;
      if (expected === null || expected >= s.duration) {
        f.syncs.push({ tag: s.tag, sound: s.sound, expected: null, at });
        this.syncs.splice(i, 1);
      } else {
        f.syncs.push({ tag: s.tag, sound: s.sound, expected, at });
      }
    }

    // La locomotive à l'arrêt.
    const a = this.anchors;
    const idle =
      train.phase === 'stopped' &&
      (timeline.arrival === null || timeline.arrival >= a.idleFrom) &&
      (timeline.departure === null || timeline.departure < a.idleStop);
    if (idle) f.loops.push({ key: 'train', sound: TRAIN_IDLE, at: { x: this.loco.x, y: this.loco.y }, gainDb: 0 });
  }

  private fire(run: 'arrival' | 'departure', sequence: SequenceRun, t: number): void {
    const shots = this.shotsBuffer;
    shots.length = 0;
    sequence.advance(t, shots);
    const f = this.frame;
    const { settings, catalogue } = this.options;
    const far = distanceBetween(f.listener.at, this.stopPoint) > settings.train.nearQuayM;
    for (const shot of shots) {
      if (shot.music) {
        this.director.once(shot.sound, this.musicNow);
        continue;
      }
      const useFar = far && shot.farVariant !== null && catalogue.sounds.has(shot.farVariant);
      const sound = useFar && shot.farVariant !== null ? shot.farVariant : shot.sound;
      const tag = shot.synced ? `${run}:${sound}` : null;
      f.shots.push({ sound, at: useFar ? null : { x: this.loco.x, y: this.loco.y }, gainDb: 0, delay: 0, offset: shot.offset, tag });
      if (tag !== null) {
        this.syncs.push({ tag, sound, at: shot.at, run, duration: catalogue.sounds.get(sound)?.durations[0] ?? 0, placed: !useFar });
      }
    }
  }

  /** Musique du samedi permise: train à quai (après la fanfare), ou qui part (jusqu'au fondu de la séquence de départ). */
  private saturdayWindow(world: ReadonlyWorld, timeline: TrainTimeline): boolean {
    const a = this.anchors;
    const phase = world.train.phase;
    const present = phase === 'stopped' || (timeline.departure !== null && phase !== 'arriving');
    return (
      present &&
      (timeline.arrival === null || timeline.arrival >= a.saturdayFrom) &&
      (timeline.departure === null || timeline.departure < a.saturdayStop.at)
    );
  }

  private silence(timeline: TrainTimeline): MusicMoment['silence'] {
    const a = this.anchors;
    const bedFade = this.options.settings.train.bedFadeBeforeFanfareSeconds;
    const arrival = timeline.arrival;
    if (arrival !== null && a.fanfareAt !== null && arrival >= a.fanfareAt - bedFade && arrival < a.saturdayFrom) {
      return { fadeOut: bedFade };
    }
    const departure = timeline.departure;
    const rest = this.departureRun?.restSeconds ?? 0;
    if (departure !== null && departure >= a.saturdayStop.at && departure < a.saturdayStop.at + rest) {
      return { fadeOut: a.saturdayStop.fade };
    }
    return null;
  }

  private updateNearSaturday(at: Vec2): void {
    const m = this.options.settings.music;
    let d = Number.POSITIVE_INFINITY;
    for (const r of this.saturdayRects) d = Math.min(d, distanceToRect(at, r));
    this.nearSaturday = this.nearSaturday ? d <= m.leaveMarginM : d <= m.enterMarginM;
  }
}

/** Milieu des rangées de rails de la carte (comme le rendu), ou `null`. */
function trackY(map: GameMap): number | null {
  const rows: number[] = [];
  for (let cy = 0; cy < map.height; cy += 1) {
    let rails = 0;
    for (let cx = 0; cx < map.width; cx += 1) if (map.ground[cy * map.width + cx] === 'rail') rails += 1;
    if (rails > map.width / 2) rows.push(cy);
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  return first === undefined || last === undefined ? null : (first + last + 1) / 2;
}
