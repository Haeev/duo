/**
 * La partie de pêche jouée sur la machine du pêcheur: viser, attendre la touche, ferrer, tenir la
 * ligne. Pure (ni DOM ni horloge): l'interface lui donne le temps et les touches, elle rend les
 * intentions à envoyer. Les tests et le mode robot la conduisent de la même façon.
 */
import type { Content } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DeepReadonly, ReadonlyWorld } from '../../etat/monde';
import type { FishingLine } from '../../etat/peche';
import type { Intent } from '../noyau/entrees';
import {
  biteSchedule,
  createFight,
  createLog,
  judgeStrike,
  stepFight,
  strikeDeadline,
  type Dip,
  type FightInput,
  type FightState,
} from './combat';
import { heldRod, shadowsNow, spotInFront } from './lecture';
import { fishOf } from './ombres';
import { FISHING } from './reglages';
import { baitItems, uniqueOf } from './uniques';
import { countHeld } from '../regles/conditions';

export type LocalPhase =
  /** Le repère va et vient devant le pêcheur. */
  | { readonly kind: 'aim'; readonly x: number; readonly y: number; readonly reach: number }
  /** Pêche à deux, à la canne: on sent ses élans; Espace tenu: la canne tenue (`a-deux.ts`). */
  | { readonly kind: 'pair' }
  /** Bouchon lâché, en attendant que l'hôte donne la ligne. */
  | { readonly kind: 'cast'; readonly x: number; readonly y: number }
  /** L'ombre vient, le bouchon frémit; `dip`: 0 calme, 0 à 1 feinte, 1 plongeon. */
  | {
      readonly kind: 'bite';
      readonly x: number;
      readonly y: number;
      readonly dip: number;
      readonly plunge: boolean;
    }
  | { readonly kind: 'fight'; readonly fight: Readonly<FightState> }
  | { readonly kind: 'end'; readonly outcome: 'landed' | 'escaped' | 'missed' }
  | { readonly kind: 'closed' };

export interface LocalFishing {
  phase(): LocalPhase;
  /** Q (-1), D (+1): visée puis contre; Espace tenu: mouliner. Lu à chaque appel de `update`. */
  hold(input: FightInput): void;
  /** Appui sur Espace (lancer, ferrer). */
  press(): void;
  /** Ranger la ligne (Retour arrière). */
  cancel(): void;
  /** Appât de la prochaine ligne (objet du sac), `null`: sans appât. */
  setBait(item: string | null): void;
  bait(): string | null;
  /** Avance de `dt` secondes avec l'état connu de cette machine; rend les intentions à envoyer. */
  update(dt: number, world: ReadonlyWorld): Intent[];
}

/** Peut-on sortir la canne ici ? (canne en main, eau devant, pas de ligne, des ombres.) */
export function canStartFishing(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): boolean {
  if (heldRod(content, world, player) === null) return false;
  const spot = spotInFront(content, world, player);
  if (spot === null) return false;
  if ((world.places[world.common.place]?.fishing?.lines[player] ?? null) !== null) return false;
  return shadowsNow(content, world, spot).length > 0;
}

/** Appâts possibles pour ce joueur: sans appât, puis chaque objet-appât qu'il a sur lui. */
export function baitChoices(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): (string | null)[] {
  const out: (string | null)[] = [null];
  for (const item of [...baitItems(content)].sort())
    if (countHeld(world.players[player], item) > 0) out.push(item);
  return out;
}

/**
 * Appât proposé en sortant la canne: celui d'une prise unique dont l'ombre est dans le coin
 * devant soi, si on l'a sur soi; sinon aucun.
 */
export function defaultBait(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): string | null {
  const spot = spotInFront(content, world, player);
  if (spot === null) return null;
  for (const shadow of shadowsNow(content, world, spot)) {
    const bait = uniqueOf(content, shadow.catch)?.unique.bait ?? null;
    if (bait !== null && countHeld(world.players[player], bait) > 0) return bait;
  }
  return null;
}

/** Commence la visée; le pêcheur se tient où il est, tourné vers l'eau. */
export function createLocalFishing(content: Content, player: PlayerIndex): LocalFishing {
  let phase: LocalPhase = { kind: 'aim', x: 0, y: 0, reach: 0 };
  let held: FightInput = { steer: 0, reel: false };
  let pressed = false;
  let cancelled = false;
  let aimClock = 0;
  let turn = 0;
  /** Secondes depuis l'appui du lancer: l'horloge de la touche, la même que celle de l'hôte. */
  let sinceCast = 0;
  let line: DeepReadonly<FishingLine> | null = null;
  let dips: Dip[] = [];
  let fight: FightState | null = null;
  let log = createLog();
  let strike = 0;
  let accumulator = 0;
  let bait: string | null = null;
  /** Pêche à deux: dernier état de la canne envoyé à l'hôte. */
  let sentDown = false;

  function lineOf(world: ReadonlyWorld): DeepReadonly<FishingLine> | null {
    return world.places[world.common.place]?.fishing?.lines[player] ?? null;
  }

  return {
    phase: () => phase,
    hold(input) {
      held = input;
    },
    press() {
      pressed = true;
    },
    cancel() {
      cancelled = true;
    },
    setBait(item) {
      bait = item;
    },
    bait: () => bait,
    update(dt, world) {
      const out: Intent[] = [];
      const press = pressed;
      pressed = false;
      if (phase.kind === 'closed') return out;
      if (cancelled) {
        cancelled = false;
        if (phase.kind !== 'aim' && phase.kind !== 'end') out.push({ type: 'fish_cancel' });
        phase = { kind: 'closed' };
        return out;
      }
      if (phase.kind === 'aim') {
        const body = world.players[player].body;
        aimClock += dt;
        turn = Math.max(
          -FISHING.cast.turnMax,
          Math.min(FISHING.cast.turnMax, turn + held.steer * FISHING.cast.turnPerSecond * dt),
        );
        const cycle = (aimClock / FISHING.cast.sweepSeconds) % 2;
        const reach = cycle < 1 ? cycle : 2 - cycle;
        const distance = FISHING.cast.min + (FISHING.cast.max - FISHING.cast.min) * reach;
        const heading = body.facing + turn;
        const x = body.x + Math.cos(heading) * distance;
        const y = body.y + Math.sin(heading) * distance;
        phase = { kind: 'aim', x, y, reach };
        if (press) {
          out.push({ type: 'fish_cast', x, y, ...(bait === null ? {} : { bait }) });
          phase = { kind: 'cast', x, y };
          sinceCast = 0;
        }
        return out;
      }
      sinceCast += dt;
      if (phase.kind === 'cast') {
        const found = lineOf(world);
        if (found !== null) {
          line = found;
          const def = fishOf(content, found.catch);
          dips = def === null ? [] : biteSchedule(found.seed, def.fish);
          phase = { kind: 'bite', x: found.x, y: found.y, dip: 0, plunge: false };
        } else if (sinceCast > 2.5) {
          // Lancer refusé par l'hôte (pas d'ombre, trop loin): on range sans bruit.
          phase = { kind: 'closed' };
        }
        return out;
      }
      if (phase.kind === 'pair') {
        const now = lineOf(world);
        if (now?.pair === undefined) {
          phase = { kind: 'closed' };
          return out;
        }
        if (held.reel !== sentDown) {
          sentDown = held.reel;
          out.push({ type: 'fish_hold', down: sentDown });
        }
        return out;
      }
      if (phase.kind === 'bite' && line !== null) {
        const now = lineOf(world);
        if (now === null) {
          phase = { kind: 'closed' };
          return out;
        }
        // À deux, l'hôte ferre lui-même au plongeon: on attend sa touche, sans délai à tenir.
        const together = uniqueOf(content, line.catch)?.unique.crew === 'pair';
        if (now.pair !== undefined) {
          phase = { kind: 'pair' };
          sentDown = false;
          return out;
        }
        const t = sinceCast - line.approach;
        let dip = 0;
        let plunge = false;
        for (const d of dips) {
          const into = t - d.at;
          const length =
            d.kind === 'plunge' ? FISHING.bite.strikeWindow * line.help : FISHING.bite.feintSeconds;
          if (into >= 0 && into <= length) {
            plunge = d.kind === 'plunge';
            dip = plunge ? 1 : Math.sin((into / length) * Math.PI) * 0.45;
          }
        }
        phase = { kind: 'bite', x: line.x, y: line.y, dip, plunge };
        const def = fishOf(content, line.catch);
        if (together) return out;
        if (press && def !== null) {
          strike = sinceCast;
          if (judgeStrike(dips, line.approach, strike, line.help) === 'hooked') {
            fight = createFight(def.fish, line.seed, line.help);
            log = createLog();
            accumulator = 0;
            phase = { kind: 'fight', fight };
            out.push({ type: 'fish_hooked' });
          } else {
            phase = { kind: 'end', outcome: 'missed' };
            out.push({ type: 'fish_result', outcome: 'missed', strike, log: '' });
          }
        } else if (sinceCast > strikeDeadline(dips, line.approach, line.help)) {
          phase = { kind: 'end', outcome: 'missed' };
          out.push({ type: 'fish_result', outcome: 'missed', strike: sinceCast, log: '' });
        }
        return out;
      }
      if (phase.kind === 'fight' && fight !== null) {
        accumulator += dt;
        while (accumulator >= FISHING.fight.dt && fight.outcome === null) {
          accumulator -= FISHING.fight.dt;
          log.push(held);
          stepFight(fight, held);
        }
        phase = { kind: 'fight', fight };
        if (fight.outcome !== null) {
          out.push({ type: 'fish_result', outcome: fight.outcome, strike, log: log.text() });
          phase = { kind: 'end', outcome: fight.outcome };
        }
      }
      return out;
    },
  };
}
