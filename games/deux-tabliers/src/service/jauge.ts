/**
 * Lectures pour l'interface (chantier d), sur les deux machines, depuis `view.world()`: la jauge
 * du geste en cours (chez son seul joueur, C16), l'invite d'un poste, le dessin sur le lait.
 * Fonctions pures, sans DOM.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex, World } from '../etat/monde';
import { furnitureById } from '../simulation/monde';
import type { Quality } from './etat';
import type { LATTE_SHAPES } from './intentions';
import {
  kettleTemperature,
  perfectBonus,
  recipeOf,
  secondsSince,
  steamTemperature,
} from './regles';

export type ServiceGauge =
  /** Maintien d'Agir: avancement de 0 à 1. */
  | { readonly kind: 'hold'; readonly furniture: string; readonly progress: number }
  /** Thermomètre du pichet: zones « Parfait » et « Bien », coupure. */
  | {
      readonly kind: 'steam';
      readonly furniture: string;
      readonly temperatureC: number;
      readonly perfectC: readonly [number, number];
      readonly goodC: readonly [number, number];
      readonly cutC: number;
    }
  /** Aiguille de l'extraction: prête à `readySeconds`, idéale pendant `perfectSeconds`. */
  | {
      readonly kind: 'extraction';
      readonly furniture: string;
      readonly seconds: number;
      readonly readySeconds: number;
      readonly perfectSeconds: number;
      readonly autoStopSeconds: number;
    }
  /** Crêpe: dorée de `readySeconds` à `readySeconds + goldenSeconds`. */
  | {
      readonly kind: 'cook';
      readonly furniture: string;
      readonly seconds: number;
      readonly readySeconds: number;
      readonly goldenSeconds: number;
    };

/** Jauge du geste que mène ce joueur (un seul à la fois), ou `null`. `dt`: durée d'un pas. */
export function serviceGauge(
  content: Content,
  world: World,
  player: PlayerIndex,
  dt: number,
): ServiceGauge | null {
  const s = world.service;
  const g = s.gestures[player];
  if (g !== null && g.kind === 'steam') {
    const st = content.service.settings.gestures.steam;
    return {
      kind: 'steam',
      furniture: g.furniture,
      temperatureC: steamTemperature(content, world, g, dt),
      perfectC: st.perfectC,
      goodC: st.goodC,
      cutC: st.cutC,
    };
  }
  if (g !== null) {
    const elapsed = secondsSince(world, g.startTick, dt);
    return {
      kind: 'hold',
      furniture: g.furniture,
      progress: g.seconds <= 0 ? 1 : Math.min(1, elapsed / g.seconds),
    };
  }
  const p = s.processes.filter((q) => q.player === player).at(-1);
  if (p === undefined) return null;
  const seconds = secondsSince(world, p.startTick, dt);
  if (p.kind === 'extraction') {
    const ex = content.service.settings.gestures.extraction;
    return {
      kind: 'extraction',
      furniture: p.furniture,
      seconds,
      readySeconds: p.readySeconds,
      perfectSeconds: ex.perfectSeconds + perfectBonus(content, world),
      autoStopSeconds: ex.autoStopSeconds,
    };
  }
  return {
    kind: 'cook',
    furniture: p.furniture,
    seconds,
    readySeconds: p.readySeconds,
    goldenSeconds: content.service.settings.gestures.cook.goldenSeconds,
  };
}

/** Température d'une bouilloire posée (visible de tous, en la regardant), ou `null`. */
export function kettleReading(
  content: Content,
  world: World,
  furniture: string,
  dt: number,
): number | null {
  return kettleTemperature(content, world, furniture, dt);
}

/**
 * Invite d'un poste du service, plus précise que le verbe de `postes.json` (« Arrêter
 * l'extraction », « Prendre la commande (3 articles) »). `null`: garder l'invite du cœur.
 */
export function serviceStationPrompt(
  content: Content,
  world: World,
  furniture: string,
): string | null {
  const placed = furnitureById(world, furniture);
  const station =
    placed === undefined ? null : (content.furniture.get(placed.type)?.station ?? null);
  const s = world.service;
  if (station === null) return null;
  switch (station) {
    case 'groupe':
      return s.processes.some((p) => p.furniture === furniture)
        ? 'Arrêter l’extraction'
        : 'Lancer l’extraction';
    case 'vapeur':
      return 'Mousser le lait (maintenir)';
    case 'moulin':
      return `Moudre (maintenir), ${s.doses} dose${s.doses > 1 ? 's' : ''} prête${s.doses > 1 ? 's' : ''}`;
    case 'caisse': {
      const order = s.waiting[0];
      if (order === undefined) return 'Personne à la caisse';
      const n = order.articles.length;
      return `Prendre la commande (${n} article${n > 1 ? 's' : ''})`;
    }
    case 'bouilloire': {
      const t = kettleTemperature(content, world, furniture, 1 / 60);
      return t === null ? 'Faire chauffer l’eau' : `Verser l’eau (${Math.round(t)} °C)`;
    }
    case 'vaisselle':
      return `Prendre : tasse (${s.clean.tasse}), verre (${s.clean.verre}), assiette (${s.clean.assiette})`;
    case 'rail': {
      const free = s.tickets.filter((t) => t.taker === null).length;
      return free === 0
        ? 'Aucun ticket libre'
        : `Prendre un ticket (${free} libre${free > 1 ? 's' : ''})`;
    }
    case 'plonge': {
      const b = s.dirtyBacklog.tasse + s.dirtyBacklog.verre + s.dirtyBacklog.assiette;
      return b > 0 ? `Laver (maintenir), ${b} en attente` : 'Laver (maintenir)';
    }
    default:
      return null;
  }
}

/** Libellé d'un article pour le ticket (« Cappuccino, lait d'avoine »). */
export function articleLabel(content: Content, recipe: string, options: readonly string[]): string {
  const OPTION: Readonly<Record<string, string>> = {
    'oat-milk': 'lait d’avoine',
    decaf: 'déca',
  };
  const name = recipeOf(content, recipe)?.label ?? recipe;
  return options.length === 0 ? name : `${name}, ${options.map((o) => OPTION[o] ?? o).join(', ')}`;
}

export const QUALITY_LABEL: Readonly<Record<Quality, string>> = {
  parfait: 'Parfait',
  bien: 'Bien',
  correct: 'Correct',
};

export interface TracePoint {
  readonly x: number;
  readonly y: number;
  /** Secondes depuis le début du tracé. */
  readonly t: number;
}

/**
 * Dessin sur le lait (CO-05), jugé chez le joueur qui trace (technique 5.6): un tracé de 2 s
 * environ, ni trop court ni haché. Rend la forme reconnue et un score de 0 à 1 pour l'intention
 * `service-latte-art`. Un cœur est un tracé qui revient près de son départ; une feuille, un
 * zigzag (beaucoup de changements de sens); une tulipe, le reste.
 */
export function judgeLatteArt(points: readonly TracePoint[]): {
  shape: (typeof LATTE_SHAPES)[number];
  score: number;
} {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined || points.length < 3)
    return { shape: 'tulipe', score: 0 };
  let length = 0;
  let turns = 0;
  let prevDx = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a === undefined || b === undefined) continue;
    const dx = b.x - a.x;
    length += Math.hypot(dx, b.y - a.y);
    if (dx * prevDx < 0) turns++;
    if (dx !== 0) prevDx = dx;
  }
  const duration = last.t - first.t;
  const closure = length > 0 ? Math.hypot(last.x - first.x, last.y - first.y) / length : 1;
  const shape = closure < 0.15 ? 'coeur' : turns >= 4 ? 'feuille' : 'tulipe';
  const timing = Math.max(0, 1 - Math.abs(duration - 2) / 2);
  const smooth = Math.min(1, length / 200);
  return { shape, score: Math.round(timing * smooth * 100) / 100 };
}
