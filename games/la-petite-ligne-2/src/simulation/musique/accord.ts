/**
 * Accord des instruments (cahier 4.5): un instrument ne s'use pas, il se désaccorde à l'usage.
 * Après sa tenue d'accord (20 airs), toutes ses notes descendent un peu, puis de plus en plus;
 * il reste jouable, il rapporte un peu moins (chapeau, amitié des auditeurs), jamais rien de sec.
 * Armand l'accorde gratuitement (effet `tune_instrument` de ses dialogues); avec un diapason, on
 * l'accorde soi-même depuis le cahier de fanfare (`music_tune`), en tenant la note jusqu'à ce que
 * le battement cesse.
 *
 * L'état est porté par la pile, comme l'usure d'un outil, dans le même champ `wear`: l'accord qui
 * reste, en airs. Absent: juste (instrument neuf, accordé, ou d'une partie d'avant). Le champ est
 * déjà sauvegardé, transmis à l'invité et gardé quand la pile change de case: ni la sauvegarde ni
 * l'état transmis ne changent de forme. Un instrument n'a jamais de bloc `tool` (validateur).
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { ItemDef } from '../../donnees/schemas/objets';
import type { Stack } from '../../etat/joueur';
import type { ReadonlyWorld } from '../../etat/monde';
import { assistFactor } from '../aide';
import type { SimContext } from '../noyau/systemes';
import { MUSIC } from './reglages';

type Instrument = NonNullable<ItemDef['instrument']>;

/** Juste, un peu faux, faux: le mot du sac et du cahier de fanfare. */
export type TuneState = 'just' | 'slight' | 'off';

/** Airs joués avant que l'instrument ne se désaccorde; 0: jamais. */
export function holdsOf(instrument: Instrument): number {
  return instrument.holds ?? MUSIC.tuning.holdAirs;
}

/** Valeur pleine du compteur d'accord (tenue puis glissade), 0 pour un instrument qui tient. */
export function tuneSpan(instrument: Instrument): number {
  const holds = holdsOf(instrument);
  return holds === 0 ? 0 : holds + MUSIC.tuning.slideAirs;
}

/** Airs joués depuis le dernier accord (plafonnés à la glissade complète). */
export function airsSinceTuning(instrument: Instrument, stack: Readonly<Stack>): number {
  const span = tuneSpan(instrument);
  if (span === 0) return 0;
  return span - Math.max(0, Math.min(span, stack.wear ?? span));
}

/** Où en est le désaccord: `null` juste, sinon de 0 (vient de lâcher) à 1 (le pire). */
export function detuneOf(instrument: Instrument, stack: Readonly<Stack>): number | null {
  const holds = holdsOf(instrument);
  if (holds === 0) return null;
  const played = airsSinceTuning(instrument, stack);
  if (played < holds) return null;
  return Math.min(1, (played - holds) / MUSIC.tuning.slideAirs);
}

export function tuneState(instrument: Instrument, stack: Readonly<Stack>): TuneState {
  const detune = detuneOf(instrument, stack);
  if (detune === null) return 'just';
  return detune < MUSIC.tuning.slightBelow ? 'slight' : 'off';
}

/** Décalage de hauteur de toutes les notes de cet instrument (cents, négatif: trop bas). */
export function tuneCents(instrument: Instrument, stack: Readonly<Stack>): number {
  const detune = detuneOf(instrument, stack);
  if (detune === null) return 0;
  const { first, worst } = MUSIC.tuning.cents;
  return first + (worst - first) * detune;
}

/** Ce que l'air rapporte selon l'accord (chapeau et amitié des auditeurs multipliés). */
export function tuneReward(state: TuneState): number {
  return MUSIC.tuning.reward[state];
}

/** Un air joué jusqu'au bout: l'accord qui reste baisse d'un air. */
export function wearTune(sim: SimContext, instrument: Instrument, stack: Stack): void {
  const span = tuneSpan(instrument);
  if (span === 0) return;
  const left = Math.max(0, Math.min(span, stack.wear ?? span));
  if (left === 0) return;
  stack.wear = left - 1;
  sim.touch('players');
}

/** Les instruments que porte un joueur (barre et sac). */
function carried(
  content: Content,
  player: ReadonlyWorld['players'][number],
): { readonly stack: Readonly<Stack>; readonly instrument: Instrument }[] {
  const found: { stack: Readonly<Stack>; instrument: Instrument }[] = [];
  for (const slots of [player.toolbar, player.bag?.slots ?? []])
    for (const stack of slots) {
      const instrument = stack === null ? undefined : content.items[stack.item]?.instrument;
      if (stack !== null && instrument !== undefined) found.push({ stack, instrument });
    }
  return found;
}

/** Le plus faux des instruments que porte ce joueur (`just` s'il n'en a pas). */
export function worstTune(content: Content, world: ReadonlyWorld, player: PlayerIndex): TuneState {
  let worst: TuneState = 'just';
  for (const { stack, instrument } of carried(content, world.players[player])) {
    const state = tuneState(instrument, stack);
    if (state === 'off') return 'off';
    if (state === 'slight') worst = 'slight';
  }
  return worst;
}

/** Remet un instrument juste; `false` s'il l'était déjà. */
export function tuneStack(sim: SimContext, stack: Stack): boolean {
  if (stack.wear === undefined) return false;
  delete stack.wear;
  sim.touch('players');
  return true;
}

/** Accorde tous les instruments que porte ce joueur (Armand). Rend le nombre d'instruments accordés. */
export function tunePlayer(sim: SimContext, player: PlayerIndex): number {
  let count = 0;
  const state = sim.world.players[player];
  for (const slots of [state.toolbar, state.bag?.slots ?? []])
    for (const stack of slots)
      if (stack !== null && sim.content.items[stack.item]?.instrument !== undefined)
        if (tuneStack(sim, stack)) count += 1;
  return count;
}

/** Le diapason dont ce joueur dispose: dans ses poches, ou tenu en main par l'autre tout près. */
export function forkFor(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): { readonly midi: number; readonly pair: boolean } | null {
  const me = world.players[player];
  for (const slots of [me.toolbar, me.bag?.slots ?? []])
    for (const stack of slots) {
      const tuner = stack === null ? undefined : content.items[stack.item]?.tuner;
      if (tuner !== undefined) return { midi: tuner.midi, pair: false };
    }
  const mate = world.players[player === 0 ? 1 : 0];
  const held = mate.selected === null ? null : (mate.toolbar[mate.selected] ?? null);
  const tuner = held === null ? undefined : content.items[held.item]?.tuner;
  const distance = Math.hypot(mate.body.x - me.body.x, mate.body.y - me.body.y);
  if (tuner === undefined || distance > MUSIC.tuning.gesture.pairReach) return null;
  return { midi: tuner.midi, pair: true };
}

/** Écart (cents) sous lequel lâcher la note accorde: aide du joueur, et l'autre qui tient le diapason. */
export function toleranceFor(world: ReadonlyWorld, player: PlayerIndex, pair: boolean): number {
  const { toleranceCents, pairFactor } = MUSIC.tuning.gesture;
  return toleranceCents * assistFactor(world, player) * (pair ? pairFactor : 1);
}

/** Battement entendu (Hz) entre le diapason et la note décalée de `cents`. */
export function beatHz(referenceMidi: number, cents: number): number {
  const hz = 440 * 2 ** ((referenceMidi - 69) / 12);
  return hz * Math.abs(2 ** (cents / 1200) - 1);
}

export interface TuningGesture {
  /** Écart de la note tenue au diapason (cents). */
  cents(): number;
  holding(): boolean;
  done(): boolean;
  /** On tient la note: elle remonte (ou redescend) vers le diapason, et la dépasse si l'on insiste. */
  press(): void;
  /** On lâche: `tuned` si le battement s'était tu, sinon `again` (rien de perdu, on reprend). */
  release(): 'tuned' | 'again' | null;
  advance(dtMs: number): void;
}

/**
 * Le geste au diapason, pur: le même sur la machine du joueur (son, repère visuel) et dans les
 * tests. Une oreille, pas un chronomètre: la note glisse plus vite loin du diapason, lentement
 * tout près; le battement ralentit puis cesse, c'est là qu'on lâche.
 */
export function createTuningGesture(startCents: number, tolerance: number): TuningGesture {
  const { baseCentsPerSecond, centsPerSecondPerCent, maxCents } = MUSIC.tuning.gesture;
  let cents = startCents;
  let direction = 1;
  let holding = false;
  let done = false;
  return {
    cents: () => cents,
    holding: () => holding,
    done: () => done,
    press() {
      if (done || holding) return;
      holding = true;
      direction = cents < 0 ? 1 : -1;
    },
    release() {
      if (!holding) return null;
      holding = false;
      // Arrondi au cent, comme l'écart annoncé à l'hôte (`music_tune`): même verdict des deux côtés.
      if (Math.abs(Math.round(cents)) <= tolerance) {
        done = true;
        return 'tuned';
      }
      return 'again';
    },
    advance(dtMs) {
      if (!holding) return;
      const speed = baseCentsPerSecond + centsPerSecondPerCent * Math.abs(cents);
      cents = Math.max(-maxCents, Math.min(maxCents, cents + (direction * speed * dtMs) / 1000));
    },
  };
}
