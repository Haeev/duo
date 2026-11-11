/**
 * Mini-jeu de cuisine, joué sur la machine du joueur (technique.md: mini-jeux locaux) à partir de
 * la graine de l'hôte. Logique pure, sans DOM ni horloge: l'interface lui passe les touches
 * (`KeyboardEvent.code`) et le temps écoulé, et dessine sa vue. Tolérant: chaque geste est noté
 * de 1 à 3, un geste manqué compte 1, une étape finit toujours.
 */
import { createRandom, type RandomSource } from '@duo/sdk/sim';
import type { CookStep, CookStepKind } from '../../donnees/schemas/recette';
import { qualityOf } from './recettes';
import { COOKING, type CookingSettings } from './reglages';

/** Touches lues par position: Espace, Q et D (KeyA et KeyD en AZERTY), Z Q S D pour dresser. */
export const COOK_KEYS = {
  action: 'Space',
  left: 'KeyA',
  right: 'KeyD',
  arrows: ['KeyW', 'KeyA', 'KeyS', 'KeyD'],
} as const;

export interface MinigameView {
  readonly kind: CookStepKind;
  readonly step: number;
  readonly steps: number;
  /** Gestes faits et à faire dans l'étape. */
  readonly done: number;
  readonly count: number;
  /** Lecture de la frise avant le premier geste. */
  readonly leadIn: boolean;
  /** Jauge principale de 0 à 1: battement, cuillère, feu, aiguille, ou avancée de l'assiette. */
  readonly gauge: number;
  /** Zone visée sur la jauge (cuire, assaisonner), et son cœur « parfait ». */
  readonly zone: { readonly from: number; readonly to: number } | null;
  readonly sweet: { readonly from: number; readonly to: number } | null;
  /** Touche attendue (remuer, dresser), `null`: Espace. */
  readonly expect: string | null;
  /** Suite à refaire (dresser). */
  readonly arrows: readonly string[];
  /** Dernière note de geste et son âge (s), pour le petit retour « Parfait ». */
  readonly lastMark: number | null;
  readonly lastMarkAge: number;
  readonly finished: boolean;
  /** Remuer: premier appui fait. Cuire: feu tenu. */
  readonly started: boolean;
  readonly holding: boolean;
}

export interface Minigame {
  /** Touche enfoncée (`down`) ou relâchée; `true` si le mini-jeu s'en sert. */
  key(code: string, down: boolean): boolean;
  /** Avance de `dt` secondes; rend la note d'une étape finie pendant ce temps, sinon `null`. */
  update(dt: number): number | null;
  view(): MinigameView;
  readonly grades: readonly number[];
}

interface StepState {
  t: number;
  marks: number[];
  /** Couper: battements déjà notés. Remuer: instant du dernier appui. Cuire: feu tenu. */
  scored: boolean[];
  last: number | null;
  holding: boolean;
  gauge: number;
  center: number;
  arrows: string[];
  arrowStart: number;
  mistakes: number;
  expect: string;
}

export interface MinigameOptions {
  readonly steps: readonly CookStep[];
  readonly seed: number;
  /** Élargissement des fenêtres: bonus des besoins x aide x cuisine tranquille (borné). */
  readonly windowScale: number;
  readonly settings?: CookingSettings;
}

/**
 * Élargissement total, borné: `minigame` des besoins, aide du joueur (`assistFactor` de
 * `simulation/aide`: 1, 1,25 ou 1,5), cuisine tranquille.
 */
export function windowScaleOf(
  needs: number,
  assist: number,
  calm: boolean,
  settings: CookingSettings = COOKING,
): number {
  const scale = needs * assist * (calm ? settings.calm : 1);
  return Math.max(0.5, Math.min(settings.maxWindowScale, scale));
}

export function createMinigame(options: MinigameOptions): Minigame {
  const settings = options.settings ?? COOKING;
  const scale = Math.max(0.5, Math.min(settings.maxWindowScale, options.windowScale));
  const random: RandomSource = createRandom(options.seed >>> 0);
  const grades: number[] = [];
  let index = 0;
  let lastMark: number | null = null;
  let lastMarkAge = 0;
  let state = fresh();

  function step(): CookStep | undefined {
    return options.steps[index];
  }
  function beatOf(current: CookStep): number {
    return settings.steps[current.kind].beat / (current.pace ?? 1);
  }
  function zoneCenter(kind: CookStepKind): number {
    return kind === 'heat' ? random.float(0.5, 0.85) : random.float(0.2, 0.8);
  }
  function fresh(): StepState {
    const current = options.steps[index];
    const arrows: string[] = [];
    if (current?.kind === 'plate')
      for (let i = 0; i < current.count; i++) arrows.push(random.pick(COOK_KEYS.arrows));
    return {
      t: 0,
      marks: [],
      scored: [],
      last: null,
      holding: false,
      gauge: 0,
      center: current === undefined ? 0.5 : zoneCenter(current.kind),
      arrows,
      arrowStart: settings.leadIn,
      mistakes: 0,
      expect: COOK_KEYS.left,
    };
  }
  function tuning(current: CookStep): { perfect: number; good: number; patience: number } {
    const base = settings.steps[current.kind];
    const cap = current.kind === 'heat' || current.kind === 'season' ? 0.3 : beatOf(current) / 2;
    return {
      perfect: Math.min(cap, base.perfect * scale),
      good: Math.min(cap, base.good * scale),
      patience: base.patience,
    };
  }
  function gradeOf(error: number, current: CookStep): number {
    const { perfect, good } = tuning(current);
    if (error <= perfect) return 3;
    if (error <= good) return 2;
    return 1;
  }
  function mark(grade: number): void {
    state.marks.push(grade);
    lastMark = grade;
    lastMarkAge = 0;
  }
  function playing(): boolean {
    return state.t >= settings.leadIn;
  }

  function onPress(code: string, current: CookStep): boolean {
    const t = state.t - settings.leadIn;
    const beat = beatOf(current);
    switch (current.kind) {
      case 'chop': {
        if (code !== COOK_KEYS.action) return false;
        const k = Math.round(t / beat);
        if (k < 0 || k >= current.count || state.scored[k] === true) return true;
        state.scored[k] = true;
        mark(gradeOf(Math.abs(t - k * beat), current));
        return true;
      }
      case 'stir': {
        if (code !== COOK_KEYS.left && code !== COOK_KEYS.right) return false;
        if (code !== state.expect) return true;
        if (state.last !== null) mark(gradeOf(Math.abs(t - state.last - beat), current));
        state.last = t;
        state.expect = code === COOK_KEYS.left ? COOK_KEYS.right : COOK_KEYS.left;
        return true;
      }
      case 'heat':
        if (code !== COOK_KEYS.action) return false;
        state.holding = true;
        return true;
      case 'season': {
        if (code !== COOK_KEYS.action) return false;
        mark(gradeOf(Math.abs(state.gauge - state.center), current));
        state.center = zoneCenter('season');
        state.last = t;
        return true;
      }
      case 'plate': {
        if (!(COOK_KEYS.arrows as readonly string[]).includes(code)) return false;
        const wanted = state.arrows[state.marks.length];
        if (wanted === undefined) return true;
        if (code !== wanted) {
          state.mistakes += 1;
          return true;
        }
        const slow = state.t - state.arrowStart > beat;
        mark(state.mistakes === 0 ? (slow ? 2 : 3) : state.mistakes === 1 ? 2 : 1);
        state.mistakes = 0;
        state.arrowStart = state.t;
        return true;
      }
    }
  }

  function onRelease(code: string, current: CookStep): boolean {
    if (current.kind !== 'heat' || code !== COOK_KEYS.action || !state.holding) return false;
    state.holding = false;
    mark(gradeOf(Math.abs(state.gauge - state.center), current));
    state.gauge = 0;
    state.center = zoneCenter('heat');
    state.last = state.t - settings.leadIn;
    return true;
  }

  /** Avance l'étape en cours de `dt`; gestes manqués comptés 1. */
  function advance(dt: number, current: CookStep): void {
    state.t += dt;
    if (!playing()) return;
    const t = state.t - settings.leadIn;
    const beat = beatOf(current);
    const { patience } = tuning(current);
    switch (current.kind) {
      case 'chop':
        for (let k = 0; k < current.count; k++)
          if (state.scored[k] !== true && t > k * beat + beat / 2) {
            state.scored[k] = true;
            mark(1);
          }
        state.gauge = (((t / beat) % 1) + 1) % 1;
        break;
      case 'stir':
        if (t - (state.last ?? 0) > patience) {
          mark(1);
          state.last = t;
        }
        state.gauge = state.last === null ? 0 : Math.min(1, (t - state.last) / beat);
        break;
      case 'heat':
        if (state.holding) {
          state.gauge += dt / beat;
          if (state.gauge >= 1) {
            state.holding = false;
            state.gauge = 0;
            state.center = zoneCenter('heat');
            state.last = t;
            mark(1);
          }
        } else if (t - (state.last ?? 0) > patience) {
          state.last = t;
          mark(1);
        }
        break;
      case 'season': {
        const phase = (t / beat) % 2;
        state.gauge = phase < 1 ? phase : 2 - phase;
        if (t - (state.last ?? 0) > patience) {
          state.last = t;
          mark(1);
        }
        break;
      }
      case 'plate':
        if (state.t - state.arrowStart > patience) {
          mark(1);
          state.mistakes = 0;
          state.arrowStart = state.t;
        }
        state.gauge = state.marks.length / current.count;
        break;
    }
  }

  return {
    grades,
    key(code, down) {
      const current = step();
      if (current === undefined || !playing()) return false;
      return down ? onPress(code, current) : onRelease(code, current);
    },
    update(dt) {
      lastMarkAge += dt;
      const current = step();
      if (current === undefined) return null;
      advance(dt, current);
      if (state.marks.length < current.count) return null;
      const grade = qualityOf(state.marks.slice(0, current.count), settings);
      grades.push(grade);
      index += 1;
      state = fresh();
      return grade;
    },
    view() {
      const current = step();
      const kind = current?.kind ?? 'plate';
      const { perfect, good } = current === undefined ? { perfect: 0, good: 0 } : tuning(current);
      const zoned = kind === 'heat' || kind === 'season';
      const expect =
        kind === 'stir'
          ? state.expect
          : kind === 'plate'
            ? (state.arrows[state.marks.length] ?? null)
            : null;
      return {
        kind,
        step: index,
        steps: options.steps.length,
        done: state.marks.length,
        count: current?.count ?? 0,
        leadIn: !playing(),
        gauge: state.gauge,
        zone: zoned ? { from: state.center - good, to: state.center + good } : null,
        sweet: zoned ? { from: state.center - perfect, to: state.center + perfect } : null,
        expect,
        arrows: state.arrows,
        lastMark,
        lastMarkAge,
        finished: current === undefined,
        started: state.last !== null,
        holding: state.holding,
      };
    },
  };
}

/**
 * Joueur automatique (mode bot des tests de fumée): joue juste, au geste près. Appelé à chaque
 * image avant `update`; `sloppy` le fait jouer à côté (qualité « correct »).
 */
export function botAct(game: Minigame, sloppy = false): void {
  const view = game.view();
  if (view.finished || view.leadIn) return;
  const center = view.zone === null ? 0 : (view.zone.from + view.zone.to) / 2;
  const off = sloppy ? 0.45 : 0;
  switch (view.kind) {
    case 'chop':
      if (sloppy ? Math.abs(view.gauge - 0.5) < 0.05 : view.gauge < 0.08)
        game.key(COOK_KEYS.action, true);
      return;
    case 'stir':
      if (!view.started || view.gauge >= 1 - off) game.key(view.expect ?? COOK_KEYS.left, true);
      return;
    case 'heat':
      if (!view.holding) game.key(COOK_KEYS.action, true);
      else if (view.gauge >= center - off) game.key(COOK_KEYS.action, false);
      return;
    case 'season':
      if (Math.abs(view.gauge - (sloppy ? 1 - center : center)) < 0.02)
        game.key(COOK_KEYS.action, true);
      return;
    case 'plate':
      game.key(sloppy ? COOK_KEYS.action : (view.expect ?? COOK_KEYS.action), true);
      return;
  }
}
