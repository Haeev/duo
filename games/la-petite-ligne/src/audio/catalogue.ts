/**
 * Lecture et contrôle de `assets/son/sons.json` (généré par le sound designer,
 * `assets-src/son/generer.py`). Le fichier est empaqueté avec le jeu mais reste
 * une donnée externe: il est validé à l'exécution, puis converti dans les types
 * du moteur (secondes, gains, boucles).
 */
import * as v from 'valibot';
import type { Season } from '../donnees/types';

const Finite = v.pipe(v.number(), v.finite());
const NonNegative = v.pipe(Finite, v.minValue(0));

const SpatialSchema = v.object({
  distanceModel: v.picklist(['inverse', 'linear', 'exponential']),
  refDistance: v.pipe(Finite, v.minValue(0.01)),
  rolloffFactor: NonNegative,
  maxDistance: v.pipe(Finite, v.minValue(0.01)),
  cullBeyondM: NonNegative,
  minGainDb: v.optional(Finite),
});

const LoopSchema = v.object({
  startSeconds: NonNegative,
  endSeconds: NonNegative,
});

const SoundSchema = v.object({
  event: v.optional(v.string()),
  // `music`: motif court et accordé (étoiles, vers luisants, saisons), réglé avec la musique (son.md, S3).
  bus: v.picklist(['effects', 'ui', 'ambience', 'music']),
  priority: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
  files: v.pipe(v.array(v.string()), v.minLength(1)),
  pick: v.picklist(['shuffle-no-repeat', 'single']),
  pitchVariation: NonNegative,
  gainVariationDb: NonNegative,
  volumeDb: Finite,
  minIntervalMs: NonNegative,
  maxVoices: v.pipe(v.number(), v.integer(), v.minValue(1)),
  duckMusicDb: Finite,
  channels: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2)),
  spatial: v.nullable(SpatialSchema),
  durationMs: v.array(NonNegative),
  loop: v.optional(LoopSchema),
  playFromSeconds: v.optional(NonNegative),
  // Moments rares (tour 6): moment et nom du son dans la fiche, niveau d'attente, montée à l'apogée.
  moment: v.optional(v.string()),
  momentSound: v.optional(v.string()),
  waitingDb: v.optional(Finite),
  climaxRampMs: v.optional(NonNegative),
});

const MusicSchema = v.object({
  bus: v.literal('music'),
  file: v.string(),
  volumeDb: Finite,
  loop: v.nullable(LoopSchema),
  playFromSeconds: v.optional(NonNegative),
  durationSeconds: v.optional(NonNegative),
  fadeInMs: NonNegative,
  fadeOutMs: NonNegative,
});

const StepSchema = v.object({
  at: NonNegative,
  play: v.optional(v.string()),
  farVariant: v.optional(v.string()),
  kind: v.optional(v.literal('music')),
  until: v.optional(v.string()),
  stop: v.optional(v.string()),
  stopMusic: v.optional(v.string()),
  fadeMs: v.optional(NonNegative),
  when: v.optional(v.string()),
});

const SeasonSchema = v.picklist(['spring', 'summer', 'autumn', 'winter']);

const AmbienceRuleSchema = v.object({
  ambience: v.string(),
  hours: v.optional(v.tuple([Finite, Finite])),
  when: v.optional(v.string()),
  notWhen: v.optional(v.string()),
  volumeDb: Finite,
  // Tour 8: seulement ces saisons, ou pas pendant celles-ci (l'ambiance de la saison prend sa place).
  seasons: v.optional(v.array(SeasonSchema)),
  exceptSeasons: v.optional(v.array(SeasonSchema)),
});

const MorningMistSchema = v.object({
  ambience: v.string(),
  volumeDb: Finite,
  alsoLowerDb: v.record(v.string(), Finite),
});

const CatalogueSchema = v.object({
  version: v.literal(1),
  sampleRate: v.pipe(v.number(), v.integer(), v.minValue(8000)),
  mix: v.object({
    duck: v.object({ attackMs: NonNegative, releaseMs: NonNegative }),
    masterLimiter: v.object({
      thresholdDb: Finite,
      kneeDb: NonNegative,
      ratio: v.pipe(Finite, v.minValue(1)),
      attackMs: NonNegative,
      releaseMs: NonNegative,
    }),
    musicCrossfadeMs: NonNegative,
    maxEffectVoices: v.pipe(v.number(), v.integer(), v.minValue(1)),
  }),
  sounds: v.record(v.string(), SoundSchema),
  music: v.record(v.string(), MusicSchema),
  plan: v.object({
    rest: v.object({
      playLoops: v.pipe(v.number(), v.integer(), v.minValue(1)),
      silenceSeconds: v.tuple([NonNegative, NonNegative]),
    }),
    musicByMoment: v.array(v.object({ moment: v.string(), music: v.string(), rest: v.optional(v.boolean()), once: v.optional(v.boolean()) })),
    ambienceByTime: v.array(AmbienceRuleSchema),
    morningMist: v.optional(MorningMistSchema),
    // Tour 9: cris lointains du soir (l'effraie, `owl-far`), une fois par soir à un instant tiré.
    eveningCalls: v.optional(
      v.array(
        v.object({
          sound: v.string(),
          seasons: v.array(v.picklist(['spring', 'summer', 'autumn', 'winter'])),
          hours: v.tuple([Finite, Finite]),
          timesPerEvening: v.pipe(Finite, v.minValue(0)),
          notWhen: v.optional(v.string()),
          notWithMoment: v.optional(v.string()),
        }),
      ),
    ),
    interior: v.object({ ambienceLowpassHz: v.pipe(Finite, v.minValue(10)), ambienceDb: Finite, rampMs: NonNegative }),
    // Tour 10 (ADR 0016, son.md 4.8): le dehors entendu de chaque bâtiment visitable, son ambiance de pièce.
    interiorByBuilding: v.optional(
      v.object({
        rampMs: NonNegative,
        buildings: v.record(
          v.string(),
          v.object({
            roomTone: v.nullable(v.string()),
            roomToneDb: v.optional(Finite),
            outdoorLowpassHz: v.pipe(Finite, v.minValue(10)),
            outdoorDb: Finite,
            rain: v.optional(v.string()),
          }),
        ),
        otherPlayerInside: v.optional(v.object({ lowpassHz: v.pipe(Finite, v.minValue(10)), db: Finite })),
      }),
    ),
    // Tour 10: le ru de la Côte, des sources placées tous les `spacingM` m.
    stream: v.optional(
      v.object({
        sound: v.string(),
        x: Finite,
        fromY: Finite,
        toY: Finite,
        spacingM: v.pipe(Finite, v.minValue(1)),
        fordPoint: v.optional(v.object({ x: Finite, y: Finite })),
        fordBoostDb: v.optional(Finite),
      }),
    ),
    peer: v.object({ peerWorldSoundsDb: Finite }),
    sequences: v.record(v.string(), v.object({ steps: v.array(StepSchema) })),
  }),
});

// ---------------------------------------------------------------------------
// Types du moteur

export type SoundBus = 'effects' | 'ui' | 'ambience' | 'music';
export type Priority = 1 | 2 | 3 | 4;

export interface SpatialDef {
  model: 'inverse' | 'linear' | 'exponential';
  refDistance: number;
  rolloff: number;
  maxDistance: number;
  /** On ne lance pas le son au-delà (m). */
  cullBeyond: number;
  /** Niveau plancher garanti (dB), ou `null`. */
  minGainDb: number | null;
}

export interface LoopDef {
  start: number;
  end: number;
}

export interface SoundDef {
  id: string;
  bus: SoundBus;
  priority: Priority;
  /** Chemins relatifs à `assets/son/`. */
  files: readonly string[];
  shuffle: boolean;
  pitchVariation: number;
  gainVariationDb: number;
  volumeDb: number;
  minIntervalSeconds: number;
  maxVoices: number;
  /** Atténuation de la musique pendant le son (dB, 0 si aucune). */
  duckDb: number;
  channels: number;
  spatial: SpatialDef | null;
  /** Durée de chaque fichier (s). */
  durations: readonly number[];
  loop: LoopDef | null;
  playFrom: number;
  /** Moment rare auquel ce son appartient (`moments.json`), et son nom dans la fiche, ou `null`. */
  moment: { id: string; sound: string; waitingDb: number; climaxRampSeconds: number } | null;
}

export interface MusicDef {
  id: string;
  file: string;
  volumeDb: number;
  loop: LoopDef | null;
  playFrom: number;
  /** Durée du fichier (s). */
  duration: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
}

export interface SequenceStep {
  at: number;
  play: string | null;
  farVariant: string | null;
  music: boolean;
  until: string | null;
  stop: string | null;
  stopMusic: string | null;
  fadeSeconds: number | null;
}

export interface AmbienceRule {
  ambience: string;
  /** Heures [début, fin[ (au-delà de 24: le lendemain matin), ou `null` pour une règle météo. */
  hours: readonly [number, number] | null;
  /** Seulement sous la pluie, dehors (`outdoor`) ou dans la maisonnette (`indoor`). */
  rain: 'outdoor' | 'indoor' | null;
  /** Se tait sous la pluie. */
  silentInRain: boolean;
  volumeDb: number;
  /** Seulement pendant ces saisons (`null`: toute l'année), et jamais pendant celles-ci (tour 8). */
  seasons: readonly Season[] | null;
  exceptSeasons: readonly Season[];
}

/** Matins de brume (tour 8): l'ambiance suit la nappe; d'autres ambiances baissent tant qu'elle dure. */
export interface MorningMistRule {
  ambience: string;
  volumeDb: number;
  lowerDb: Readonly<Record<string, number>>;
}

export interface Catalogue {
  sampleRate: number;
  sounds: ReadonlyMap<string, SoundDef>;
  music: ReadonlyMap<string, MusicDef>;
  mix: {
    duckAttackSeconds: number;
    duckReleaseSeconds: number;
    limiter: { thresholdDb: number; kneeDb: number; ratio: number; attackSeconds: number; releaseSeconds: number };
    crossfadeSeconds: number;
    maxEffectVoices: number;
  };
  rest: { playLoops: number; silenceSeconds: readonly [number, number] };
  /** Musiques du jour qui laissent place aux ambiances après une boucle. */
  restingMusic: ReadonlySet<string>;
  ambienceRules: readonly AmbienceRule[];
  morningMist: MorningMistRule | null;
  /** Tour 9: un cri lointain par soir (`plan.eveningCalls`): heures en minutes de jeu. */
  eveningCalls: readonly EveningCall[];
  interior: { lowpassHz: number; ambienceDb: number; rampSeconds: number };
  /**
   * Tour 10: étouffement du dehors et ambiance de pièce par bâtiment visitable (`listener.inside`);
   * un bâtiment absent prend `interior`. `peer`: l'autre joueur dans un autre bâtiment.
   */
  interiors: {
    rampSeconds: number;
    buildings: ReadonlyMap<string, InteriorSound>;
    peer: { lowpassHz: number; db: number } | null;
  };
  /** Tour 10: sources du ru de la Côte (`plan.stream`), `null` sans ru. */
  stream: StreamPlan | null;
  peerDb: number;
  sequences: ReadonlyMap<string, readonly SequenceStep[]>;
}

export interface InteriorSound {
  roomTone: string | null;
  roomToneDb: number;
  lowpassHz: number;
  outdoorDb: number;
}

export interface StreamPlan {
  sound: string;
  sources: readonly { at: { x: number; y: number }; gainDb: number }[];
}

export interface EveningCall {
  sound: string;
  seasons: readonly string[];
  from: number;
  to: number;
  times: number;
  /** Jamais sous la pluie (`notWhen` qui parle de pluie). */
  notInRain: boolean;
  /** Jamais le soir de ce moment. */
  notWithMoment: string | null;
}

export class CatalogueError extends Error {
  override readonly name = 'CatalogueError';
}

const RAIN_WORDS = /pluie/i;
const INDOOR_WORDS = /maisonnette|intérieur|dedans/i;

function loopOf(loop: { startSeconds: number; endSeconds: number } | null | undefined): LoopDef | null {
  if (loop === null || loop === undefined) return null;
  if (loop.endSeconds <= loop.startSeconds) throw new CatalogueError(`boucle vide (${loop.startSeconds} à ${loop.endSeconds} s)`);
  return { start: loop.startSeconds, end: loop.endSeconds };
}

/** Durée d'un fichier de boucle: amorce de chaque côté, de la longueur du début de boucle (son.md 6). */
function loopFileSeconds(loop: LoopDef): number {
  return loop.end + loop.start;
}

/** Contrôle `sons.json` et le convertit. Lève `CatalogueError` avec le chemin fautif. */
export function parseCatalogue(raw: unknown): Catalogue {
  const result = v.safeParse(CatalogueSchema, raw);
  if (!result.success) {
    const issue = result.issues[0];
    const path = issue.path?.map((p) => String(p.key)).join('.') ?? '';
    throw new CatalogueError(`sons.json: ${path}: ${issue.message}`);
  }
  const data = result.output;
  const sounds = new Map<string, SoundDef>();
  for (const [id, s] of Object.entries(data.sounds)) {
    const loop = loopOf(s.loop);
    // Pour une boucle, `durationMs` donne la longueur de la boucle: le fichier a en plus ses amorces.
    const durations = s.files.map((_, i) => (loop === null ? (s.durationMs[i] ?? 0) / 1000 : loopFileSeconds(loop)));
    sounds.set(id, {
      id,
      bus: s.bus,
      priority: s.priority as Priority,
      files: s.files,
      shuffle: s.pick === 'shuffle-no-repeat',
      pitchVariation: s.pitchVariation,
      gainVariationDb: s.gainVariationDb,
      volumeDb: s.volumeDb,
      minIntervalSeconds: s.minIntervalMs / 1000,
      maxVoices: s.maxVoices,
      duckDb: Math.min(0, s.duckMusicDb),
      channels: s.channels,
      spatial:
        s.spatial === null
          ? null
          : {
              model: s.spatial.distanceModel,
              refDistance: s.spatial.refDistance,
              rolloff: s.spatial.rolloffFactor,
              maxDistance: s.spatial.maxDistance,
              cullBeyond: s.spatial.cullBeyondM,
              minGainDb: s.spatial.minGainDb ?? null,
            },
      durations,
      loop,
      playFrom: s.playFromSeconds ?? loop?.start ?? 0,
      moment:
        s.moment === undefined
          ? null
          : {
              id: s.moment,
              sound: s.momentSound ?? id.replaceAll('-', '_'),
              waitingDb: s.waitingDb ?? 0,
              climaxRampSeconds: (s.climaxRampMs ?? 0) / 1000,
            },
    });
  }
  const music = new Map<string, MusicDef>();
  for (const [id, m] of Object.entries(data.music)) {
    const loop = loopOf(m.loop);
    const duration = m.durationSeconds ?? (loop === null ? 0 : loopFileSeconds(loop));
    if (duration <= 0) throw new CatalogueError(`sons.json: music.${id}: durée inconnue`);
    music.set(id, {
      id,
      file: m.file,
      volumeDb: m.volumeDb,
      loop,
      playFrom: m.playFromSeconds ?? loop?.start ?? 0,
      duration,
      fadeInSeconds: m.fadeInMs / 1000,
      fadeOutSeconds: m.fadeOutMs / 1000,
    });
  }
  const sequences = new Map<string, SequenceStep[]>();
  for (const [id, seq] of Object.entries(data.plan.sequences)) {
    const steps = seq.steps
      .map((s) => ({
        at: s.at,
        play: s.play ?? null,
        farVariant: s.farVariant ?? null,
        music: s.kind === 'music',
        until: s.until ?? null,
        stop: s.stop ?? null,
        stopMusic: s.stopMusic ?? null,
        fadeSeconds: s.fadeMs === undefined ? null : s.fadeMs / 1000,
      }))
      .sort((a, b) => a.at - b.at);
    for (const step of steps) {
      const target = step.play ?? step.stop;
      if (target !== null && !sounds.has(target) && !music.has(target)) {
        throw new CatalogueError(`sons.json: plan.sequences.${id}: son inconnu « ${target} »`);
      }
    }
    sequences.set(id, steps);
  }
  const ambienceRules: AmbienceRule[] = data.plan.ambienceByTime.map((r) => {
    if (!sounds.has(r.ambience)) throw new CatalogueError(`sons.json: plan.ambienceByTime: ambiance inconnue « ${r.ambience} »`);
    const rainRule = r.hours === undefined && r.when !== undefined && RAIN_WORDS.test(r.when);
    return {
      ambience: r.ambience,
      hours: r.hours ?? null,
      rain: rainRule ? (INDOOR_WORDS.test(r.when ?? '') ? 'indoor' : 'outdoor') : null,
      silentInRain: r.notWhen !== undefined && RAIN_WORDS.test(r.notWhen),
      volumeDb: r.volumeDb,
      seasons: r.seasons ?? null,
      exceptSeasons: r.exceptSeasons ?? [],
    };
  });
  const mist = data.plan.morningMist;
  if (mist !== undefined) {
    for (const id of [mist.ambience, ...Object.keys(mist.alsoLowerDb)]) {
      if (!sounds.has(id)) throw new CatalogueError(`sons.json: plan.morningMist: ambiance inconnue « ${id} »`);
    }
  }
  const morningMist: MorningMistRule | null =
    mist === undefined ? null : { ambience: mist.ambience, volumeDb: mist.volumeDb, lowerDb: { ...mist.alsoLowerDb } };
  const restingMusic = new Set(data.plan.musicByMoment.filter((m) => m.rest === true).map((m) => m.music));
  for (const id of restingMusic) {
    if (!music.has(id)) throw new CatalogueError(`sons.json: plan.musicByMoment: musique inconnue « ${id} »`);
  }
  const limiter = data.mix.masterLimiter;
  return {
    sampleRate: data.sampleRate,
    sounds,
    music,
    mix: {
      duckAttackSeconds: data.mix.duck.attackMs / 1000,
      duckReleaseSeconds: data.mix.duck.releaseMs / 1000,
      limiter: {
        thresholdDb: limiter.thresholdDb,
        kneeDb: limiter.kneeDb,
        ratio: limiter.ratio,
        attackSeconds: limiter.attackMs / 1000,
        releaseSeconds: limiter.releaseMs / 1000,
      },
      crossfadeSeconds: data.mix.musicCrossfadeMs / 1000,
      maxEffectVoices: data.mix.maxEffectVoices,
    },
    rest: { playLoops: data.plan.rest.playLoops, silenceSeconds: data.plan.rest.silenceSeconds },
    restingMusic,
    ambienceRules,
    morningMist,
    eveningCalls: (data.plan.eveningCalls ?? []).map((e) => {
      if (!sounds.has(e.sound)) throw new CatalogueError(`sons.json: plan.eveningCalls: son inconnu « ${e.sound} »`);
      return {
        sound: e.sound,
        seasons: e.seasons,
        from: e.hours[0] * 60,
        to: e.hours[1] * 60,
        times: e.timesPerEvening,
        notInRain: e.notWhen !== undefined && RAIN_WORDS.test(e.notWhen),
        notWithMoment: e.notWithMoment ?? null,
      };
    }),
    interior: {
      lowpassHz: data.plan.interior.ambienceLowpassHz,
      ambienceDb: data.plan.interior.ambienceDb,
      rampSeconds: data.plan.interior.rampMs / 1000,
    },
    interiors: parseInteriors(data.plan.interiorByBuilding, data.plan.interior, sounds),
    stream: parseStream(data.plan.stream, sounds),
    peerDb: data.plan.peer.peerWorldSoundsDb,
    sequences,
  };
}

type PlanData = v.InferOutput<typeof CatalogueSchema>['plan'];

function parseInteriors(
  data: PlanData['interiorByBuilding'],
  fallback: PlanData['interior'],
  sounds: ReadonlyMap<string, SoundDef>,
): Catalogue['interiors'] {
  const buildings = new Map<string, InteriorSound>();
  for (const [id, b] of Object.entries(data?.buildings ?? {})) {
    if (b.roomTone !== null && !sounds.has(b.roomTone)) {
      throw new CatalogueError(`sons.json: plan.interiorByBuilding.${id}: ambiance inconnue « ${b.roomTone} »`);
    }
    buildings.set(id, {
      roomTone: b.roomTone,
      roomToneDb: b.roomToneDb ?? 0,
      lowpassHz: b.outdoorLowpassHz,
      outdoorDb: b.outdoorDb,
    });
  }
  return {
    rampSeconds: (data?.rampMs ?? fallback.rampMs) / 1000,
    buildings,
    peer: data?.otherPlayerInside === undefined ? null : { lowpassHz: data.otherPlayerInside.lowpassHz, db: data.otherPlayerInside.db },
  };
}

/** Sources du ru, du nord au sud, tous les `spacingM` m; la plus proche du gué renforcée. */
function parseStream(data: PlanData['stream'], sounds: ReadonlyMap<string, SoundDef>): StreamPlan | null {
  if (data === undefined) return null;
  if (!sounds.has(data.sound)) throw new CatalogueError(`sons.json: plan.stream: son inconnu « ${data.sound} »`);
  const sources: { at: { x: number; y: number }; gainDb: number }[] = [];
  for (let y = data.fromY; y <= data.toY + 1e-6; y += data.spacingM) {
    sources.push({ at: { x: data.x, y }, gainDb: 0 });
  }
  const ford = data.fordPoint;
  if (ford !== undefined && sources.length > 0) {
    let best = sources[0];
    for (const source of sources) {
      if (best === undefined || Math.abs(source.at.y - ford.y) < Math.abs(best.at.y - ford.y)) best = source;
    }
    if (best !== undefined) {
      best.at = { x: ford.x, y: ford.y };
      best.gainDb = data.fordBoostDb ?? 0;
    }
  }
  return { sound: data.sound, sources };
}

/** Pas d'une séquence, ou erreur si `sons.json` ne la contient pas. */
export function sequenceOf(catalogue: Catalogue, id: string): readonly SequenceStep[] {
  const steps = catalogue.sequences.get(id);
  if (steps === undefined) throw new CatalogueError(`sons.json: séquence « ${id} » absente`);
  return steps;
}

/** Instant du premier pas qui joue `sound` dans une séquence. */
export function stepTime(steps: readonly SequenceStep[], sound: string): number | null {
  for (const s of steps) if (s.play === sound) return s.at;
  return null;
}

/** Instant du premier pas qui arrête la boucle ou la musique `id`. */
export function stopTime(steps: readonly SequenceStep[], id: string): { at: number; fade: number | null } | null {
  for (const s of steps) if (s.stop === id || s.stopMusic === id) return { at: s.at, fade: s.fadeSeconds };
  return null;
}
