/**
 * Horloge du décor (lumière du jour, passants), chez l'hôte comme chez l'invité, sans réseau.
 *
 * - `minute()`: minute de jeu de la journée, continue (480 pour 8 h). En service et à la fermeture,
 *   celle de l'état partagé (`serviceSec`, seconde entière) lissée entre deux secondes; avant
 *   l'ouverture (`monday`, `prep`), l'heure d'ouverture; le soir (`evening`, `end`), elle continue
 *   d'avancer au même rythme depuis la dernière heure affichée, jusqu'à `eveningCapMinute`: la nuit
 *   tombe derrière le bilan sans jamais revenir en arrière.
 * - `timeline()`: secondes d'une frise propre à la phase (`segment()`), partagée par les deux
 *   machines en service (`serviceSec`), locale sinon. Les passants naissent sur cette frise.
 */
import type { World } from '../etat/monde';

export interface DecorClockSettings {
  /** Minute d'ouverture et secondes réelles par minute de jeu (`journees.json`). */
  readonly openMinute: number;
  readonly secondsPerGameMinute: number;
  readonly peacefulSecondsPerGameMinute: number;
  /** Plus tard que cela, le soir n'avance plus (19 h 15 par défaut). */
  readonly eveningCapMinute: number;
}

export interface DecorClock {
  /** Avance de `dt` secondes réelles et relit l'état. */
  update(world: World, dt: number): void;
  minute(): number;
  /** Clé de la frise en cours (jour et phase): une autre clé, une autre frise. */
  segment(): string;
  timeline(): number;
  /** Vrai si la frise est celle de l'état partagé (service, fermeture). */
  shared(): boolean;
}

export function createDecorClock(s: DecorClockSettings): DecorClock {
  let minute = s.openMinute;
  let segment = '';
  let timeline = 0;
  let shared = false;
  /** Fraction locale de la seconde de service (l'état n'a que la seconde entière). */
  let frac = 0;
  let lastSec = -1;
  return {
    update(world, dt) {
      const c = world.clientele;
      const spm = c.pace === 'peaceful' ? s.peacefulSecondsPerGameMinute : s.secondsPerGameMinute;
      const live = c.phase === 'service' || c.phase === 'closing';
      const key = `${String(c.day)}:${live ? 'service' : c.phase}`;
      if (key !== segment) {
        segment = key;
        timeline = 0;
        frac = 0;
        lastSec = -1;
      }
      if (live) {
        if (c.serviceSec !== lastSec) {
          lastSec = c.serviceSec;
          frac = 0;
        } else frac = Math.min(0.999, frac + dt);
        timeline = c.serviceSec + frac;
        minute = s.openMinute + timeline / spm;
        shared = true;
        return;
      }
      shared = false;
      timeline += dt;
      if (c.phase === 'evening' || c.phase === 'end') {
        // Depuis l'heure de la fermeture (seconde de service figée), même après une reprise.
        const closed = s.openMinute + c.serviceSec / spm;
        minute = Math.min(Math.max(minute, closed) + dt / spm, s.eveningCapMinute);
      } else minute = s.openMinute;
    },
    minute: () => minute,
    segment: () => segment,
    timeline: () => timeline,
    shared: () => shared,
  };
}
