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
    };

export interface Desk {
  onEvent(event: GameEvent): void;
  /** Une image: notes passées, voix de l'autre, écran de fin qui se referme. */
  frame(dtMs: number): void;
  /** Déplacer le choix dans le cahier (`-1`, `1`). */
  move(delta: number): void;
  /** Valider: lancer l'air choisi, ou fermer le mot de la fin. */
  confirm(): void;
  /** Quitter: ranger l'instrument, à tout moment. */
  leave(): void;
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
      mine: { voice: VoiceId; game: Performance; timbre: string };
      partner: Heard | null;
      last: { verdict: Verdict; lane: number; atMs: number } | null;
    }
  | {
      kind: 'result';
      age: number;
      view: Extract<DeskView, { kind: 'result' }>;
    };

const RESULT_MS = 9000;
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
    state = { kind: 'closed' };
  }

  function heardOf(score: AirScore, voice: VoiceId, player: PlayerIndex): Heard {
    const notes = notesOf(score, voice);
    return {
      voice,
      notes,
      verdicts: notes.map(() => null),
      plan: createPartnerVoice(notes),
      timbre: timbreOf(player),
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
        } else if (state.kind === 'book' && state.target === event.target) state.partner = true;
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
          },
        };
        break;
      }
      case 'music_closed':
        if (event.player === me || (state.kind === 'listen' && event.player === state.performer))
          close();
        else if (state.kind === 'book' && state.target === event.target) state.partner = false;
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
    leave() {
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
        });
      return hit;
    },
    view() {
      switch (state.kind) {
        case 'closed':
        case 'listen':
          return { kind: 'closed' };
        case 'book':
          return {
            kind: 'book',
            lines: lines(),
            selected: state.selected,
            partner: state.partner,
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
