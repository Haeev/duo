/**
 * Musique par moment (son.md 3.2 et 3.3), logique pure.
 *
 * `chooseBed` dit quelle musique de fond convient au moment (phase, heure,
 * veillée, lieu du personnage, train). `MusicDirector` la fait jouer: fondus,
 * passage du matin à l'après-midi à la même position (même grille), repos
 * après une boucle complète pour laisser place aux ambiances, puis retour en
 * fondu. Il ne touche pas au Web Audio: il produit des commandes que le moteur
 * applique, sur une ligne de temps virtuelle (le moteur rattrape le temps de
 * décodage en avançant la position de départ).
 */
import type { RandomSource } from '@duo/sdk/sim';
import type { CharacterStatus, Phase } from '../etat/types';
import type { MusicDef } from './catalogue';

/** Identifiants des musiques de `sons.json` que le jeu appelle par leur rôle. */
export const MUSIC = {
  title: 'titre',
  breakfast: 'petit-dejeuner',
  morning: 'halte-matin',
  afternoon: 'halte-apres-midi',
  saturday: 'samedi',
  veillee: 'veillee',
  night: 'nuit',
  fanfare: 'fanfare-train',
  ending: 'fin',
} as const;

/** Musiques qui partagent tempo, tonalité, grille et longueur: on passe de l'une à l'autre à la même position. */
export const SAME_GRID: readonly (readonly string[])[] = [[MUSIC.morning, MUSIC.afternoon]];

export interface MomentRules {
  dayStart: number;
  /** Le thème passe du matin à l'après-midi (minutes). */
  afternoonFrom: number;
  veilleeFrom: number;
  lastDay: { day: number; end: number };
}

export interface MusicMoment {
  phase: Phase;
  day: number;
  minutes: number;
  veillee: boolean;
  localStatus: CharacterStatus;
  /** Le personnage local est près du quai ou sur la place (hystérésis faite par l'appelant). */
  nearSaturdaySpot: boolean;
  /** Train à quai: musique du samedi permise (après la fanfare, avant le départ). */
  saturdayWindow: boolean;
  /** Silence imposé par une séquence (avant la fanfare, après le départ), avec la durée du fondu. */
  silence: { fadeOut: number } | null;
  /** Musique retenue jusqu'à un instant (réveil: petit-déjeuner à 3,5 s; coucher: nuit à 2,5 s). */
  hold: { music: string; until: number; fadeOut: number | null } | null;
  /** Temps courant (même horloge que `hold.until`). */
  now: number;
}

export interface BedWish {
  id: string | null;
  /** Repos permis (musique du jour). */
  rest: boolean;
  /** Fondu de sortie de la musique en cours, ou `null` pour celui de `sons.json`. */
  fadeOut: number | null;
}

/** La musique de fond du moment, pour le joueur de cette machine. */
export function chooseBed(m: MusicMoment, rules: MomentRules, resting: ReadonlySet<string>, out: BedWish): BedWish {
  out.fadeOut = null;
  let id: string | null = null;
  switch (m.phase) {
    case 'creation':
      id = MUSIC.title;
      break;
    case 'ended':
      id = null;
      break;
    case 'night':
      id = MUSIC.night;
      break;
    case 'breakfast':
      id = MUSIC.breakfast;
      break;
    case 'day':
      id = dayBed(m, rules);
      break;
  }
  if (m.phase === 'day' && m.localStatus === 'breakfast') id = MUSIC.breakfast;
  if (m.hold !== null && id === m.hold.music && m.now < m.hold.until) {
    id = null;
    out.fadeOut = m.hold.fadeOut;
  }
  if (m.silence !== null && m.phase === 'day' && id !== null && id !== MUSIC.veillee) {
    id = null;
    out.fadeOut = m.silence.fadeOut;
  }
  out.id = id;
  out.rest = id !== null && resting.has(id);
  return out;
}

function dayBed(m: MusicMoment, rules: MomentRules): string | null {
  if (m.localStatus === 'sleeping' || m.localStatus === 'night') return null;
  if (m.day >= rules.lastDay.day && m.minutes >= rules.lastDay.end) return null;
  if (m.veillee) return MUSIC.veillee;
  if (m.minutes >= rules.veilleeFrom) return null;
  if (m.saturdayWindow && m.nearSaturdaySpot) return MUSIC.saturday;
  return m.minutes < rules.afternoonFrom ? MUSIC.morning : MUSIC.afternoon;
}

// ---------------------------------------------------------------------------
// Directeur

export type MusicCommand =
  | { kind: 'start'; id: string; offset: number; fadeIn: number; at: number }
  | { kind: 'stop'; id: string; fadeOut: number }
  | { kind: 'once'; id: string; at: number }
  | { kind: 'prefetch'; id: string };

interface Track {
  id: string;
  /** Instant où la lecture était à `offset` (s). */
  startedAt: number;
  offset: number;
}

type DirectorState =
  | { mode: 'idle' }
  | { mode: 'playing'; track: Track; rest: boolean; sessionStart: number }
  | { mode: 'resting'; from: string; until: number };

export interface DirectorOptions {
  music: ReadonlyMap<string, MusicDef>;
  /** Boucles jouées avant un repos, et durée du silence (s), de `plan.rest`. */
  restLoops: number;
  restSeconds: readonly [number, number];
  /** Fondu enchaîné et retour après un repos (s). */
  crossfadeSeconds: number;
  /** Avance pour décoder la musique suivante avant la fin d'un repos (s). */
  prefetchSeconds: number;
  random: RandomSource;
}

/** Position de lecture d'une piste (s dans le fichier), boucle comprise. */
export function positionOf(def: MusicDef, track: { startedAt: number; offset: number }, now: number): number {
  const raw = track.offset + Math.max(0, now - track.startedAt);
  const loop = def.loop;
  if (loop === null || raw < loop.end) return raw;
  const span = loop.end - loop.start;
  return loop.start + ((raw - loop.start) % span);
}

/** Temps de lecture avant le repos: de `playFrom` à la fin de la boucle, plus les boucles suivantes. */
export function playTimeBeforeRest(def: MusicDef, loops: number): number {
  const loop = def.loop;
  if (loop === null) return def.duration - def.playFrom;
  return loop.end - def.playFrom + (loops - 1) * (loop.end - loop.start);
}

function sameGrid(a: string, b: string): boolean {
  return SAME_GRID.some((group) => group.includes(a) && group.includes(b));
}

export class MusicDirector {
  private state: DirectorState = { mode: 'idle' };
  private readonly commands: MusicCommand[] = [];
  private readonly pendingOnce: MusicCommand[] = [];
  private prefetched: string | null = null;

  constructor(private readonly options: DirectorOptions) {}

  /** Musique de fond jouée en ce moment (pour le diagnostic). */
  current(): string | null {
    return this.state.mode === 'playing' ? this.state.track.id : null;
  }

  resting(): boolean {
    return this.state.mode === 'resting';
  }

  /** Une musique jouée une fois par-dessus (fanfare, air de fin). */
  once(id: string, now: number): void {
    if (this.options.music.has(id)) this.pendingOnce.push({ kind: 'once', id, at: now });
  }

  /** Avance d'une image; renvoie les commandes à appliquer (tableau réutilisé). */
  update(wish: BedWish, now: number): readonly MusicCommand[] {
    this.commands.length = 0;
    for (const command of this.pendingOnce) this.commands.push(command);
    this.pendingOnce.length = 0;
    const { state } = this;
    const music = this.options.music;
    if (wish.id === null || !music.has(wish.id)) {
      if (state.mode === 'playing') this.stop(state.track.id, wish.fadeOut);
      this.state = { mode: 'idle' };
      return this.drain();
    }
    const wanted = wish.id;
    switch (state.mode) {
      case 'idle':
        this.start(wanted, now, wish.rest);
        break;
      case 'resting':
        if (!sameGrid(state.from, wanted) && state.from !== wanted) {
          this.start(wanted, now, wish.rest);
        } else if (now >= state.until) {
          this.start(wanted, now, wish.rest, this.options.crossfadeSeconds);
        } else if (now >= state.until - this.options.prefetchSeconds && this.prefetched !== wanted) {
          this.prefetched = wanted;
          this.commands.push({ kind: 'prefetch', id: wanted });
        }
        break;
      case 'playing': {
        const track = state.track;
        if (track.id === wanted) {
          if (wish.rest && state.rest) this.maybeRest(state, now);
          break;
        }
        const from = music.get(track.id);
        if (from !== undefined && sameGrid(track.id, wanted)) {
          // Même grille: on enchaîne à la même position, le compte de la boucle continue.
          const position = positionOf(from, track, now);
          const fade = this.options.crossfadeSeconds;
          this.commands.push({ kind: 'stop', id: track.id, fadeOut: fade });
          this.commands.push({ kind: 'start', id: wanted, offset: position, fadeIn: fade, at: now });
          this.state = { mode: 'playing', track: { id: wanted, startedAt: now, offset: position }, rest: wish.rest, sessionStart: state.sessionStart };
          break;
        }
        this.stop(track.id, wish.fadeOut);
        this.start(wanted, now, wish.rest);
        break;
      }
    }
    return this.drain();
  }

  /** Après le temps prévu, la musique s'efface à la fin de sa boucle et laisse place aux ambiances. */
  private maybeRest(state: Extract<DirectorState, { mode: 'playing' }>, now: number): void {
    const def = this.options.music.get(state.track.id);
    if (def === undefined) return;
    const fade = this.options.crossfadeSeconds;
    const restAt = state.sessionStart + playTimeBeforeRest(def, this.options.restLoops);
    if (now < restAt - fade) return;
    this.commands.push({ kind: 'stop', id: state.track.id, fadeOut: Math.max(0.05, restAt - now) });
    const [low, high] = this.options.restSeconds;
    const silence = high > low ? this.options.random.float(low, high) : low;
    this.state = { mode: 'resting', from: state.track.id, until: restAt + silence };
    this.prefetched = null;
  }

  private start(id: string, now: number, rest: boolean, fadeIn?: number): void {
    const def = this.options.music.get(id);
    if (def === undefined) return;
    this.commands.push({ kind: 'start', id, offset: def.playFrom, fadeIn: fadeIn ?? def.fadeInSeconds, at: now });
    this.state = { mode: 'playing', track: { id, startedAt: now, offset: def.playFrom }, rest, sessionStart: now };
  }

  private stop(id: string, fadeOut: number | null): void {
    const def = this.options.music.get(id);
    this.commands.push({ kind: 'stop', id, fadeOut: fadeOut ?? def?.fadeOutSeconds ?? this.options.crossfadeSeconds });
  }

  private drain(): readonly MusicCommand[] {
    return this.commands;
  }
}
