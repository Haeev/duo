/**
 * Coussin de gigue et interpolation des instantanés rapides chez l'invité (reprise relue de
 * l'ancien `invite.ts`, avec un retard qui suit la gigue mesurée au lieu d'une valeur fixe).
 *
 * Chaque instantané arrive à l'heure locale `at` pour le pas `tick` de l'hôte. `at - tick * pas`
 * vaut un décalage constant plus le retard du trajet: le plus petit décalage récent sert de base
 * (le trajet le plus rapide), et le 95e centile de l'excès donne le coussin. On affiche le monde
 * de l'hôte à `base + coussin`: assez tard pour avoir presque toujours l'instantané suivant.
 */
import { SIM_DT } from '../simulation/noyau/constantes';
import type { FastMessage } from './canaux';
import type { NetSettings } from './reglages';

export interface Mover {
  x: number;
  y: number;
  facing: number;
  speed: number;
}

interface Received {
  readonly snap: FastMessage;
  readonly at: number;
}

export interface Interpolated {
  /** Les deux instantanés encadrants et la part (0 à 1) de l'un vers l'autre. */
  readonly a: FastMessage;
  readonly b: FastMessage;
  readonly t: number;
}

export interface SnapshotBuffer {
  push(snap: FastMessage, at: number): void;
  /** Instantanés encadrant l'heure `now` diminuée du coussin, `null` sans instantané. */
  sample(now: number): Interpolated | null;
  latest(): FastMessage | null;
  /** Coussin courant, en pas (mesure, affichage de développement). */
  delayTicks(): number;
  /** Changement de lieu, reprise: on oublie les instantanés (aucun reste appliqué au nouveau lieu). */
  clear(): void;
}

const STEP_MS = SIM_DT * 1000;

export function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

/** Mobile du canal rapide (`[x, y, cap, vitesse]`) interpolé. */
export function lerpMover(
  a: readonly [number, number, number, number],
  b: readonly [number, number, number, number],
  t: number,
  out: Mover,
): void {
  out.x = a[0] + (b[0] - a[0]) * t;
  out.y = a[1] + (b[1] - a[1]) * t;
  out.facing = lerpAngle(a[2], b[2], t);
  out.speed = a[3] + (b[3] - a[3]) * t;
}

export function createSnapshotBuffer(settings: NetSettings['interpolation']): SnapshotBuffer {
  const received: Received[] = [];
  const offsets: number[] = [];
  let delay = settings.minDelayTicks + settings.extraTicks;
  let lastSample: number | null = null;

  function target(): number {
    if (offsets.length === 0) return delay;
    const base = Math.min(...offsets);
    const excess = offsets.map((o) => o - base).sort((p, q) => p - q);
    const p95 = excess[Math.min(excess.length - 1, Math.floor(excess.length * 0.95))] ?? 0;
    const wanted = p95 / STEP_MS + settings.extraTicks;
    return Math.max(settings.minDelayTicks, Math.min(settings.maxDelayTicks, wanted));
  }

  return {
    push(snap, at) {
      const last = received[received.length - 1];
      // Mode `latest`: un instantané plus ancien que le dernier n'apporte rien.
      if (last !== undefined && snap.tick <= last.snap.tick) return;
      received.push({ snap, at });
      if (received.length > settings.kept) received.shift();
      offsets.push(at - snap.tick * STEP_MS);
      if (offsets.length > settings.window) offsets.shift();
    },
    sample(now) {
      const last = received[received.length - 1];
      if (last === undefined) return null;
      // Le coussin suit sa cible lentement: un changement brusque ferait sauter les autres.
      const dt = lastSample === null ? 0 : Math.max(0, (now - lastSample) / 1000);
      lastSample = now;
      const goal = target();
      const stepMax = settings.followTicksPerSecond * dt;
      delay += Math.max(-stepMax, Math.min(stepMax, goal - delay));
      if (dt === 0) delay = Math.max(delay, settings.minDelayTicks);
      const base = offsets.length === 0 ? last.at - last.snap.tick * STEP_MS : Math.min(...offsets);
      const renderTick = (now - base) / STEP_MS - delay;
      let a = received[0] ?? last;
      let b = a;
      for (let i = received.length - 1; i > 0; i--) {
        const later = received[i];
        const earlier = received[i - 1];
        if (later === undefined || earlier === undefined) continue;
        if (earlier.snap.tick <= renderTick) {
          a = earlier;
          b = later;
          break;
        }
      }
      if (renderTick >= last.snap.tick) {
        // Instantané suivant pas encore là: on reste sur le dernier (jamais d'extrapolation).
        a = last;
        b = last;
      }
      const span = b.snap.tick - a.snap.tick;
      const t = span <= 0 ? 0 : Math.max(0, Math.min(1, (renderTick - a.snap.tick) / span));
      return { a: a.snap, b: b.snap, t };
    },
    latest() {
      return received[received.length - 1]?.snap ?? null;
    },
    delayTicks() {
      return delay;
    },
    clear() {
      received.length = 0;
      offsets.length = 0;
      lastSample = null;
    },
  };
}
