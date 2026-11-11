/**
 * Le poste d'un joueur à l'instrument: tout ce que sa machine sait et fait pendant un air, sans
 * écran ni carte son (pur, testé dans Node avec un réseau lent). Il lit les événements de l'hôte,
 * juge les frappes du joueur (`local.ts`), fait entendre l'autre (`partenaire.ts`), et rend un
 * modèle à dessiner. Celui qui ne joue pas entend l'autre jouer quand il est à portée (même
 * chemin que la voix de l'autre dans un duo), plus bas à mesure qu'il s'éloigne. L'écran (`interface/musique/`) et le son (`audio/musique/scene.ts`) ne font
 * que le servir.
 */
import type { Content } from '../../donnees/charger';
import type { AirNote, AirScore } from '../../donnees/schemas/air';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ReadonlyWorld } from '../../etat/monde';
import { assistFactor } from '../aide';
import { modifiersOf } from '../besoins/jauges';
import type { Intent } from '../noyau/entrees';
import type { GameEvent } from '../noyau/evenements';
import {
  beatHz,
  createTuningGesture,
  forkFor,
  toleranceFor,
  tuneCents,
  tuneState,
  type TuneState,
  type TuningGesture,
} from './accord';
import type { MusicResult, VoiceId } from './evenements';
import { windowScaleOf, windowsOf } from './jugement';
import { heldInstrument, leadMs, notesOf, songbook, type SongbookLine } from './lecture';
import { createPerformance, type Hit, type Performance } from './local';
import { createPartnerVoice, type PartnerVoice } from './partenaire';
import { MUSIC, type Rating, type Verdict } from './reglages';

/** Ce que le poste demande au son de la machine. */
export interface StageSound {
  /**
   * L'accompagnement de l'air, programmé pour que son premier temps tombe à `startAtMs` sur
   * l'heure de session commune, après un décompte de `leadMs`.
   */
  start(spec: {
    readonly air: string;
    readonly score: AirScore;
    readonly startAtMs: number;
    readonly leadMs: number;
  }): void;
  /** Horloge de l'air telle que le joueur l'entend (ms depuis le premier temps), `null` hors d'un air. */
  airNow(): number | null;
  /**
   * Une note d'instrument. `atMs`: instant de l'air, `null`: tout de suite. `sour`: elle sonne
   * faux. Rend un numéro pour `sour`.
   */
  note(spec: {
    readonly who: 'me' | 'partner';
    readonly timbre: string;
    readonly midi: number;
    readonly atMs: number | null;
    readonly ms: number;
    readonly sour: boolean;
    /** Décalage de hauteur de l'instrument désaccordé (cents, 0: juste). */
    readonly cents: number;
  }): number;
  /** Une note déjà partie se met à sonner faux. */
  sour(id: number): void;
  /**
   * Niveau de tout l'air (accompagnement et notes), de 0 à 1: 1 pour qui joue, selon la distance
   * pour qui écoute. Appelé au lancement, puis à chaque image pour qui écoute.
   */
  level(gain: number): void;
  /** Fin ou abandon: l'accompagnement s'efface, la musique du lieu revient. */
  stop(): void;
  /**
   * L'accordage au diapason: le diapason sonne sa note (`midi`), l'instrument la tient, décalé de
   * `cents`, tant que `holding`; le battement entre les deux s'entend de lui-même. `null`: tout se
   * tait. Appelé à chaque image du geste. Absent: accordage silencieux (le repère visuel suffit).
   */
  tuning?(
    spec: {
      readonly timbre: string;
      readonly midi: number;
      readonly cents: number;
      readonly holding: boolean;
    } | null,
  ): void;
}

export interface DeskOptions {
  readonly content: Content;
  world(): ReadonlyWorld | null;
  local(): PlayerIndex | null;
  send(intent: Intent): void;
  /** Heure de session commune aux deux machines (`net.sessionTimeMs`). */
  sessionNow(): number;
  readonly sound: StageSound;
}

export interface VoiceView {
  readonly name: string;
  readonly notes: readonly AirNote[];
  readonly verdicts: readonly (Verdict | null)[];
}

export type DeskView =
  | { readonly kind: 'closed' }
  /** Le cahier de fanfare: on choisit l'air; `partner`: l'autre a rejoint, ce sera un duo. */
  | {
      readonly kind: 'book';
      readonly lines: readonly SongbookLine[];
      readonly selected: number;
      readonly partner: boolean;
      /** Accord de l'instrument en main. */
      readonly tune: TuneState;
      /** Un diapason est à portée (dans ses poches, ou en main de l'autre tout près). */
      readonly tuner: boolean;
    }
  /**
   * L'accordage au diapason: tenir la note jusqu'à ce que le battement cesse. `beatHz`: le
   * battement (0: plus rien), pour le repère visuel; `result`: le dernier lâcher.
   */
  | {
      readonly kind: 'tune';
      readonly cents: number;
      readonly beatHz: number;
      readonly holding: boolean;
      /** L'autre tient le diapason. */
      readonly pair: boolean;
      readonly result: 'tuned' | 'again' | null;
    }
  /** On a rejoint l'autre, qui choisit l'air. */
  | { readonly kind: 'wait' }
  | {
      readonly kind: 'play';
      readonly air: string;
      readonly score: AirScore;
      /** Horloge de l'air (ms), négative pendant le décompte. */
      readonly airMs: number;
      readonly leadMs: number;
      readonly mine: VoiceView;
      readonly partner: (VoiceView & { readonly playing: boolean }) | null;
      /** Dernière frappe jugée, pour le mot qui s'efface. */
      readonly last: {
        readonly verdict: Verdict;
        readonly lane: number;
        readonly atMs: number;
      } | null;
    }
  | {
      readonly kind: 'result';
      readonly air: string;
      readonly rating: Rating;
      readonly duo: boolean;
      readonly together: boolean;
      readonly first: boolean;
      readonly listeners: number;
      readonly mine: MusicResult;
      readonly other: MusicResult | null;
      /** Accord de son instrument pendant l'air: les auditeurs en disent un mot gentil. */
      readonly tune: TuneState;
    };

export interface Desk {
  onEvent(event: GameEvent): void;
  /** Une image: notes passées, voix de l'autre, écran de fin qui se referme. */
  frame(dtMs: number): void;
  /** Déplacer le choix dans le cahier (`-1`, `1`). */
  move(delta: number): void;
  /** Valider: lancer l'air choisi, ou fermer le mot de la fin. */
  confirm(): void;
  /** Quitter: ranger l'instrument, à tout moment (pendant l'accordage: revenir au cahier). */
  leave(): void;
  /** Depuis le cahier: prendre le diapason, si l'instrument n'est pas juste et qu'il y en a un. */
  tune(): void;
  /** Accordage: tenir (`true`) ou lâcher (`false`) la note. */
  hold(down: boolean): void;
  /** Frappe d'une touche de jeu à l'instant `airMs` de l'air. */
  press(lane: number, airMs: number): Hit | null;
  view(): DeskView;
  isOpen(): boolean;
}

/** La voix de l'autre telle que cette machine la fait entendre (duo, ou écoute à distance). */
interface Heard {
  readonly voice: VoiceId;
  readonly notes: readonly AirNote[];
  readonly verdicts: (Verdict | null)[];
  readonly plan: PartnerVoice;
  readonly timbre: string;
  readonly cents: number;
  /** Notes de l'autre déjà parties, par rang, pour les faire sonner faux après coup. */
  readonly sounding: Map<number, number>;
}

type State =
  | { kind: 'closed' }
  /** L'autre joue sans nous: on l'entend d'où l'on est, sans écran. */
  | { kind: 'listen'; target: string; startAtMs: number; performer: PlayerIndex; heard: Heard }
  | { kind: 'book'; target: string; selected: number; partner: boolean }
  | { kind: 'wait'; target: string }
  | {
      kind: 'play';
      target: string;
      air: string;
      score: AirScore;
      lead: number;
      startAtMs: number;
      mine: { voice: VoiceId; game: Performance; timbre: string; cents: number; tune: TuneState };
      partner: Heard | null;
      last: { verdict: Verdict; lane: number; atMs: number } | null;
    }
  | {
      kind: 'result';
      age: number;
      view: Extract<DeskView, { kind: 'result' }>;
    }
  | {
      kind: 'tune';
      target: string;
      partner: boolean;
      gesture: TuningGesture;
      fork: { readonly midi: number; readonly pair: boolean };
      timbre: string;
      result: 'tuned' | 'again' | null;
      /** Temps depuis le dernier lâcher (ms): « c'est juste » reste un instant, puis le cahier revient. */
      age: number;
    };

const RESULT_MS = 9000;
const TUNED_MS = 1600;
const FALLBACK_TIMBRE = 'cornet';

/** Niveau d'un air entendu à `distance` mètres de qui le joue (`MUSIC.listen`), de 0 à 1. */
export function listenGain(distance: number): number {
  const { nearM, farM } = MUSIC.listen;
  if (distance <= nearM) return 1;
  if (distance >= farM) return 0;
  return (farM - distance) / (farM - nearM);
}

function voiceName(content: Content, air: string, voice: VoiceId): string {
  const voices = content.airs[air]?.voices;
  if (voices === undefined) return '';
  return voice === 'solo' || voices.duo === undefined ? voices.solo.name : voices.duo[voice].name;
}

export function createDesk(options: DeskOptions): Desk {
  const { content, sound } = options;
  let state: State = { kind: 'closed' };
  /** Airs appris par le duo, annoncés par l'hôte à l'ouverture du cahier. */
  let known: readonly string[] = [];

  function close(): void {
    if (state.kind === 'play' || state.kind === 'listen') sound.stop();
    if (state.kind === 'tune') sound.tuning?.(null);
    state = { kind: 'closed' };
  }

  function backToBook(target: string, partner: boolean): void {
    sound.tuning?.(null);
    state = { kind: 'book', target, selected: 0, partner };
  }

  function heardOf(score: AirScore, voice: VoiceId, player: PlayerIndex): Heard {
    const notes = notesOf(score, voice);
    return {
      voice,
      notes,
      verdicts: notes.map(() => null),
      plan: createPartnerVoice(notes),
      timbre: timbreOf(player),
      cents: centsOf(player),
      sounding: new Map(),
    };
  }

  /** Les notes de l'autre à programmer d'ici l'avance de programmation. */
  function schedule(heard: Heard, now: number): void {
    for (const command of heard.plan.plan(now)) {
      const written = heard.notes[command.index];
      if (written === undefined || command.type !== 'play') continue;
      heard.sounding.set(
        command.index,
        sound.note({
          who: 'partner',
          timbre: heard.timbre,
          midi: written[2],
          atMs: command.atMs,
          ms: written[3],
          sour: false,
          cents: heard.cents,
        }),
      );
    }
  }

  /** Un verdict de l'autre validé par l'hôte: sa voix se corrige (couac, silence, reprise). */
  function correct(heard: Heard, index: number, verdict: Verdict): void {
    heard.verdicts[index] = verdict;
    const written = heard.notes[index];
    for (const command of heard.plan.result(index, verdict, clock())) {
      if (written === undefined) continue;
      if (command.type === 'sour') {
        const id = heard.sounding.get(command.index);
        if (id !== undefined) sound.sour(id);
      } else
        heard.sounding.set(
          command.index,
          sound.note({
            who: 'partner',
            timbre: heard.timbre,
            midi: written[2],
            atMs: command.type === 'play' && !command.late ? command.atMs : null,
            ms: written[3],
            sour: command.type === 'couac',
            cents: heard.cents,
          }),
        );
    }
  }

  /** Niveau de l'air pour qui écoute: selon sa distance à qui joue. */
  function listenLevel(performer: PlayerIndex): number {
    const world = options.world();
    const me = options.local();
    if (world === null || me === null) return 0;
    const a = world.players[me].body;
    const b = world.players[performer].body;
    return listenGain(Math.hypot(a.x - b.x, a.y - b.y));
  }

  function timbreOf(player: PlayerIndex): string {
    const world = options.world();
    const held = world === null ? null : heldInstrument(content, world, player);
    return held?.instrument.timbre ?? FALLBACK_TIMBRE;
  }

  /** Décalage de hauteur de l'instrument en main de ce joueur (désaccord), 0 s'il est juste. */
  function centsOf(player: PlayerIndex): number {
    const world = options.world();
    const held = world === null ? null : heldInstrument(content, world, player);
    return held === null ? 0 : tuneCents(held.instrument, held.stack);
  }

  function tuneOf(player: PlayerIndex): TuneState {
    const world = options.world();
    const held = world === null ? null : heldInstrument(content, world, player);
    return held === null ? 'just' : tuneState(held.instrument, held.stack);
  }

  function forkOf(): { readonly midi: number; readonly pair: boolean } | null {
    const world = options.world();
    const me = options.local();
    return world === null || me === null ? null : forkFor(content, world, me);
  }

  function lines(): SongbookLine[] {
    const world = options.world();
    const me = options.local();
    return world === null || me === null ? [] : songbook(content, world, me, known);
  }

  function clock(): number {
    if (state.kind !== 'play' && state.kind !== 'listen') return 0;
    return sound.airNow() ?? options.sessionNow() - state.startAtMs;
  }

  function sendHit(hit: Hit): void {
    options.send({ type: 'music_note', index: hit.index, lane: hit.lane, offsetMs: hit.offsetMs });
  }

  function onEvent(event: GameEvent): void {
    const me = options.local();
    if (me === null) return;
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- le poste ne lit que la musique
    switch (event.type) {
      case 'music_opened':
        if (event.player === me) {
          known = event.airs;
          if (state.kind === 'listen') sound.stop();
          state =
            event.leader === me
              ? { kind: 'book', target: event.target, selected: 0, partner: false }
              : { kind: 'wait', target: event.target };
        } else if (
          (state.kind === 'book' || state.kind === 'tune') &&
          state.target === event.target
        )
          state.partner = true;
        break;
      case 'music_started': {
        const voice = event.voices[me];
        const score = content.airs[event.air]?.score;
        if (score === undefined) break;
        const mate: PlayerIndex = me === 0 ? 1 : 0;
        const mateVoice = event.voices[mate];
        const lead = leadMs(score);
        if (voice === null) {
          // L'autre joue sans nous: on l'entend d'où l'on est (rien à l'écran).
          if (mateVoice === null || (state.kind !== 'closed' && state.kind !== 'result')) break;
          state = {
            kind: 'listen',
            target: event.target,
            startAtMs: event.startAtMs,
            performer: mate,
            heard: heardOf(score, mateVoice, mate),
          };
          sound.start({ air: event.air, score, startAtMs: event.startAtMs, leadMs: lead });
          sound.level(listenLevel(mate));
          break;
        }
        if (state.kind !== 'book' && state.kind !== 'wait') break;
        const world = options.world();
        const needs = world === null ? 1 : modifiersOf(content, world, me).minigame;
        // Aide réglable du joueur (`simulation/aide/`): l'hôte la fige au même instant.
        const assist = world === null ? 1 : assistFactor(world, me);
        state = {
          kind: 'play',
          target: event.target,
          air: event.air,
          score,
          lead,
          startAtMs: event.startAtMs,
          mine: {
            voice,
            game: createPerformance(notesOf(score, voice), windowsOf(windowScaleOf(assist, needs))),
            timbre: timbreOf(me),
            cents: centsOf(me),
            tune: tuneOf(me),
          },
          partner: mateVoice === null ? null : heardOf(score, mateVoice, mate),
          last: null,
        };
        sound.start({ air: event.air, score, startAtMs: event.startAtMs, leadMs: lead });
        sound.level(1);
        break;
      }
      case 'music_note': {
        if (event.player === me) break;
        if (state.kind === 'play' && state.partner !== null)
          correct(state.partner, event.index, event.verdict);
        else if (state.kind === 'listen' && event.player === state.performer)
          correct(state.heard, event.index, event.verdict);
        break;
      }
      case 'music_finished': {
        if (state.kind === 'listen' && state.target === event.target) {
          close();
          break;
        }
        if (state.kind !== 'play' || state.target !== event.target) break;
        const mine = event.results[me];
        const tune = state.mine.tune;
        sound.stop();
        if (mine === null) {
          state = { kind: 'closed' };
          break;
        }
        state = {
          kind: 'result',
          age: 0,
          view: {
            kind: 'result',
            air: event.air,
            rating: event.rating,
            duo: event.duo,
            together: event.together,
            first: event.first,
            listeners: event.listeners,
            mine,
            other: event.results[me === 0 ? 1 : 0],
            tune,
          },
        };
        break;
      }
      case 'music_closed':
        if (event.player === me || (state.kind === 'listen' && event.player === state.performer))
          close();
        else if ((state.kind === 'book' || state.kind === 'tune') && state.target === event.target)
          state.partner = false;
        break;
      case 'refused':
        // L'instrument de l'un ne sait pas cet air, l'air n'est pas prêt: le cahier reste ouvert.
        break;
      default:
        break;
    }
  }

  return {
    onEvent,
    frame(dtMs) {
      if (state.kind === 'tune') {
        state.gesture.advance(dtMs);
        state.age += dtMs;
        if (state.result === 'tuned' && state.age > TUNED_MS) {
          backToBook(state.target, state.partner);
          return;
        }
        sound.tuning?.({
          timbre: state.timbre,
          midi: state.fork.midi,
          cents: state.result === 'tuned' ? 0 : state.gesture.cents(),
          holding: state.gesture.holding(),
        });
        return;
      }
      if (state.kind === 'result') {
        state.age += dtMs;
        if (state.age > RESULT_MS) state = { kind: 'closed' };
        return;
      }
      if (state.kind === 'listen') {
        sound.level(listenLevel(state.performer));
        schedule(state.heard, clock());
        return;
      }
      if (state.kind !== 'play') return;
      const now = clock();
      for (const hit of state.mine.game.advance(now)) sendHit(hit);
      if (state.partner !== null) schedule(state.partner, now);
    },
    move(delta) {
      if (state.kind !== 'book') return;
      const count = lines().length;
      state.selected = Math.max(0, Math.min(count - 1, state.selected + delta));
    },
    confirm() {
      if (state.kind === 'result') {
        state = { kind: 'closed' };
        return;
      }
      if (state.kind !== 'book') return;
      const line = lines()[state.selected];
      if (line === undefined || !line.known || !line.allowed || line.air.score === undefined)
        return;
      options.send({
        type: 'music_go',
        air: line.air.id,
        startAtMs: Math.round(options.sessionNow() + leadMs(line.air.score)),
      });
    },
    tune() {
      if (state.kind !== 'book') return;
      const me = options.local();
      const world = options.world();
      const fork = forkOf();
      if (me === null || world === null || fork === null || tuneOf(me) === 'just') return;
      sound.level(1);
      state = {
        kind: 'tune',
        target: state.target,
        partner: state.partner,
        gesture: createTuningGesture(centsOf(me), toleranceFor(world, me, fork.pair)),
        fork,
        timbre: timbreOf(me),
        result: null,
        age: 0,
      };
    },
    hold(down) {
      if (state.kind !== 'tune' || state.result === 'tuned') return;
      if (down) {
        state.gesture.press();
        return;
      }
      const result = state.gesture.release();
      if (result === null) return;
      state.result = result;
      state.age = 0;
      if (result === 'tuned')
        options.send({ type: 'music_tune', cents: Math.round(state.gesture.cents()) });
    },
    leave() {
      if (state.kind === 'tune') {
        backToBook(state.target, state.partner);
        return;
      }
      if (state.kind === 'closed' || state.kind === 'listen') return;
      if (state.kind !== 'result') options.send({ type: 'music_leave' });
      close();
    },
    press(lane, airMs) {
      if (state.kind !== 'play') return null;
      const { game, timbre } = state.mine;
      const hit = game.press(lane, airMs + MUSIC.sound.inputOffsetMs);
      if (hit === null) return null;
      const written = game.notes[hit.index];
      state.last = { verdict: hit.verdict, lane, atMs: airMs };
      sendHit(hit);
      if (written !== undefined && hit.verdict !== 'missed')
        sound.note({
          who: 'me',
          timbre,
          midi: written[2],
          atMs: null,
          ms: written[3],
          sour: hit.verdict === 'false',
          cents: state.mine.cents,
        });
      return hit;
    },
    view() {
      switch (state.kind) {
        case 'closed':
        case 'listen':
          return { kind: 'closed' };
        case 'book': {
          const me = options.local();
          return {
            kind: 'book',
            lines: lines(),
            selected: state.selected,
            partner: state.partner,
            tune: me === null ? 'just' : tuneOf(me),
            tuner: forkOf() !== null,
          };
        }
        case 'tune':
          return {
            kind: 'tune',
            cents: state.gesture.cents(),
            beatHz: state.result === 'tuned' ? 0 : beatHz(state.fork.midi, state.gesture.cents()),
            holding: state.gesture.holding(),
            pair: state.fork.pair,
            result: state.result,
          };
        case 'wait':
          return { kind: 'wait' };
        case 'play':
          return {
            kind: 'play',
            air: state.air,
            score: state.score,
            airMs: clock(),
            leadMs: state.lead,
            mine: {
              name: voiceName(content, state.air, state.mine.voice),
              notes: state.mine.game.notes,
              verdicts: state.mine.game.verdicts(),
            },
            partner:
              state.partner === null
                ? null
                : {
                    name: voiceName(content, state.air, state.partner.voice),
                    notes: state.partner.notes,
                    verdicts: state.partner.verdicts,
                    playing: state.partner.plan.playing(),
                  },
            last: state.last,
          };
        case 'result':
          return state.view;
      }
    },
    isOpen: () => state.kind !== 'closed' && state.kind !== 'listen',
  };
}
