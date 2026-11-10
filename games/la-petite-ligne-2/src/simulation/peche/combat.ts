/**
 * Touche et combat: fonctions pures d'une graine, d'un caractère de poisson et des touches.
 * Elles tournent sur la machine du pêcheur (réponse immédiate) et chez l'hôte, qui rejoue le
 * journal des touches pour valider le résultat (`technique.md`: mini-jeux locaux).
 */
import { createRandom, deriveSeed, type RandomSource } from '@duo/sdk/sim';
import type { FishTraits } from '../../donnees/schemas/peche';
import { FISHING } from './reglages';

// --- Touche --------------------------------------------------------------------------------

export interface Dip {
  /** Secondes depuis l'arrivée de l'ombre au bouchon. */
  readonly at: number;
  readonly kind: 'feint' | 'plunge';
}

/** Les creux du bouchon: des feintes puis le plongeon. */
export function biteSchedule(seed: number, fish: FishTraits): Dip[] {
  const random = createRandom(deriveSeed(seed, 'touche'));
  const feints = Math.min(random.int(0, fish.feints + 1), FISHING.bite.maxFeintsSeen);
  const dips: Dip[] = [];
  let at = 0;
  for (let i = 0; i <= feints; i++) {
    at += random.float(FISHING.bite.gapMin, FISHING.bite.gapMax);
    dips.push({ at, kind: i === feints ? 'plunge' : 'feint' });
  }
  return dips;
}

export type StrikeVerdict = 'hooked' | 'early' | 'late';

/**
 * Jugement d'un appui sur Espace à `seconds` depuis le lancer (`approach`: temps d'arrivée de
 * l'ombre). `help` élargit la fenêtre (canne, repos, aide).
 */
export function judgeStrike(
  dips: readonly Dip[],
  approach: number,
  seconds: number,
  help: number,
): StrikeVerdict {
  const plunge = dips[dips.length - 1];
  if (plunge === undefined) return 'early';
  const t = seconds - approach;
  const open = plunge.at;
  const close = plunge.at + FISHING.bite.strikeWindow * help;
  if (t < open) return 'early';
  return t <= close ? 'hooked' : 'late';
}

/** Instant (s depuis le lancer) où la touche est perdue faute d'appui. */
export function strikeDeadline(dips: readonly Dip[], approach: number, help: number): number {
  const plunge = dips[dips.length - 1];
  return approach + (plunge?.at ?? 0) + FISHING.bite.strikeWindow * help;
}

// --- Combat --------------------------------------------------------------------------------

export type FightOutcome = 'landed' | 'escaped';

/** Commande d'un pas du combat: Q (-1) ou D (+1) pour contrer, Espace pour mouliner. */
export interface FightInput {
  readonly steer: -1 | 0 | 1;
  readonly reel: boolean;
}

export interface FightState {
  readonly fish: FishTraits;
  readonly zoneHalf: number;
  readonly random: RandomSource;
  steps: number;
  /** Aiguille de -1 (gauche) à 1 (droite), et sa vitesse. */
  needle: number;
  velocity: number;
  /** Le poisson tire (élan) ou souffle. */
  pulling: boolean;
  phaseLeft: number;
  direction: -1 | 1;
  /** Réserve de forces, de 1 à 0. */
  stamina: number;
  /** Distance gagnée, de 0 à 1 (1: sorti de l'eau). */
  progress: number;
  /** Cumul hors du vert (s), et total sur tout le combat. */
  strain: number;
  outside: number;
  outcome: FightOutcome | null;
}

/** Secteur vert: base, aides de la canne et du joueur (`help`). */
export function zoneHalfOf(help: number): number {
  return Math.min(0.9, FISHING.fight.zoneHalf * help);
}

export function createFight(fish: FishTraits, seed: number, help: number): FightState {
  const random = createRandom(deriveSeed(seed, 'combat'));
  const state: FightState = {
    fish,
    zoneHalf: zoneHalfOf(help),
    random,
    steps: 0,
    needle: 0,
    velocity: 0,
    pulling: true,
    phaseLeft: 0,
    direction: random.chance(0.5) ? 1 : -1,
    stamina: 1,
    progress: FISHING.fight.startProgress,
    strain: 0,
    outside: 0,
    outcome: null,
  };
  state.phaseLeft = phaseLength(state);
  return state;
}

function phaseLength(state: FightState): number {
  const { rhythm } = state.fish;
  const base = state.pulling
    ? rhythm.pull * (FISHING.fight.tiredPull + (1 - FISHING.fight.tiredPull) * state.stamina)
    : rhythm.rest;
  return base * state.random.float(0.7, 1.3);
}

/** Un pas fixe (`FISHING.fight.dt`). Sans effet une fois le combat fini. */
export function stepFight(state: FightState, input: FightInput): void {
  if (state.outcome !== null) return;
  const f = FISHING.fight;
  const dt = f.dt;
  const { fish, random } = state;
  state.steps++;

  state.phaseLeft -= dt;
  if (state.phaseLeft <= 0) {
    state.pulling = !state.pulling;
    if (state.pulling && random.chance(0.5)) state.direction = state.direction === 1 ? -1 : 1;
    state.phaseLeft = phaseLength(state);
  } else if (state.pulling && random.chance(fish.nervousness * 1.6 * dt)) {
    state.direction = state.direction === 1 ? -1 : 1;
  }
  // Le hasard est tiré à chaque pas, élan ou non: la suite ne dépend pas des touches.
  const jitter = random.float(-1, 1) * f.jitter * fish.nervousness;

  const strength = 0.55 + 0.45 * state.stamina;
  const pull = state.pulling ? state.direction * fish.force * f.pullGain * strength : 0;
  let accel =
    pull +
    jitter +
    input.steer * f.steerGain -
    f.damping * state.velocity -
    f.centering * state.needle;
  if (input.reel && state.pulling)
    accel += (state.needle >= 0 ? 1 : -1) * f.reelStrain * fish.force;
  state.velocity += accel * dt;
  state.needle += state.velocity * dt;
  if (state.needle > 1 || state.needle < -1) {
    state.needle = Math.max(-1, Math.min(1, state.needle));
    state.velocity = 0;
  }

  const inZone = Math.abs(state.needle) <= state.zoneHalf;
  if (inZone) {
    state.stamina = Math.max(0, state.stamina - (dt / fish.stamina) * (state.pulling ? 1.5 : 0.5));
    state.strain = Math.max(0, state.strain - f.recoverPerSecond * dt);
    if (input.reel)
      state.progress +=
        (state.pulling ? f.reelPull : f.reelRest) * dt * (1.4 - 0.4 * state.stamina);
  } else {
    state.strain += dt;
    state.outside += dt;
  }
  if (state.pulling && !input.reel)
    state.progress = Math.max(0, state.progress - f.slack * fish.force * dt);

  if (state.progress >= 1) state.outcome = 'landed';
  else if (state.strain >= f.escapeSeconds || state.steps * dt >= f.maxSeconds)
    state.outcome = 'escaped';
}

export function fightSeconds(state: FightState): number {
  return state.steps * FISHING.fight.dt;
}

// --- Journal des touches -------------------------------------------------------------------

const CODES = 'abcdef';

export function inputCode(input: FightInput): string {
  return CODES.charAt((input.steer + 1) * 2 + (input.reel ? 1 : 0));
}

function inputOf(code: string): FightInput | null {
  const index = CODES.indexOf(code);
  if (index < 0) return null;
  return { steer: (Math.floor(index / 2) - 1) as -1 | 0 | 1, reel: index % 2 === 1 };
}

/** Journal compact: une lettre par commande, suivie du nombre de pas où elle est tenue. */
export function createLog(): { push(input: FightInput): void; text(): string } {
  let text = '';
  let current = '';
  let count = 0;
  return {
    push(input) {
      const code = inputCode(input);
      if (code === current) {
        count++;
        return;
      }
      if (count > 0) text += current + String(count);
      current = code;
      count = 1;
    },
    text() {
      return count > 0 ? text + current + String(count) : text;
    },
  };
}

/** Commandes d'un journal, une par pas, ou `null` s'il est mal formé. */
export function readLog(text: string, maxSteps: number): FightInput[] | null {
  const out: FightInput[] = [];
  const pattern = /([a-f])(\d{1,4})/gy;
  let match: RegExpExecArray | null;
  let read = 0;
  while ((match = pattern.exec(text)) !== null) {
    const input = inputOf(match[1] ?? '');
    const count = Number(match[2]);
    if (input === null || count < 1 || out.length + count > maxSteps) return null;
    for (let i = 0; i < count; i++) out.push(input);
    read = pattern.lastIndex;
  }
  return read === text.length ? out : null;
}

/** Rejoue un combat entier: c'est la validation de l'hôte. */
export function replayFight(
  fish: FishTraits,
  seed: number,
  help: number,
  log: string,
): FightState | null {
  const maxSteps = Math.ceil(FISHING.fight.maxSeconds / FISHING.fight.dt);
  const inputs = readLog(log, maxSteps);
  if (inputs === null) return null;
  const state = createFight(fish, seed, help);
  for (const input of inputs) {
    if (state.outcome !== null) return null;
    stepFight(state, input);
  }
  return state;
}

/**
 * Un pêcheur robot (tests, mode robot): il contre quand l'aiguille s'écarte et ne mouline qu'au
 * souffle. `skill` de 0 à 1: en dessous de 1, il réagit avec retard (il garde sa commande
 * précédente une partie du temps). Son hasard est le sien: il ne touche pas à celui du combat.
 */
export function createAngler(skill: number, seed: number): (state: FightState) => FightInput {
  const random = createRandom(deriveSeed(seed, 'pecheur'));
  let last: FightInput = { steer: 0, reel: false };
  return (state) => {
    if (random.chance((1 - skill) * 0.85)) return last;
    const watch = state.zoneHalf * 0.4;
    const lead = state.needle + state.velocity * 0.12;
    const steer: -1 | 0 | 1 = lead > watch ? -1 : lead < -watch ? 1 : 0;
    last = { steer, reel: !state.pulling && Math.abs(state.needle) < state.zoneHalf };
    return last;
  };
}
