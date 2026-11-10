/**
 * File des commandes de l'invité chez l'hôte (reprise relue de l'ancien `hote.ts`, 0.13).
 *
 * Règle d'or de la prédiction de l'invité: il compte chaque commande jusqu'à `ack` comme jouée
 * telle quelle et ne rejoue que les suivantes. Toute commande que l'hôte écarte ou remplace sans
 * la jouer doit donc être sans effet (immobile, action inchangée), sinon l'invité recule à l'arrêt.
 */
import { idleInput, type StepInput } from '../simulation/noyau/entrees';
import type { NetSettings } from './reglages';

export interface CommandQueue {
  /** Commandes reçues (dans l'ordre d'envoi; les doublons et les anciennes sont ignorés). */
  push(frames: readonly StepInput[]): void;
  /** La commande à jouer à ce pas: la vraie, une devinée, ou immobile. */
  next(): StepInput;
  /** Dernière commande jouée (`-1` avant la première): l'accusé du canal rapide. */
  ack(): number;
  /** Commandes en attente (mesures, tests). */
  size(): number;
  /** Reprise de la liaison: on oublie l'attente, l'accusé reste. */
  reset(): void;
}

function moving(frame: StepInput, deadzone: number): boolean {
  return Math.hypot(frame.moveX, frame.moveY) >= deadzone;
}

export function createCommandQueue(settings: NetSettings['input']): CommandQueue {
  const frames: StepInput[] = [];
  let last: StepInput | null = null;
  let lastQueued = -1;
  let ack = -1;
  let stale = 0;

  /** La commande ne change rien après `before`: ni pas, ni appui ou relâchement de l'action. */
  function idleAfter(frame: StepInput, before: StepInput | null): boolean {
    return !moving(frame, settings.moveDeadzone) && frame.act === (before?.act ?? false);
  }

  /**
   * Rattrapage d'un retard (rafale après un trou): on écarte d'abord les commandes sans effet.
   * Un pas de marche n'est écarté qu'au-delà du plafond (machine figée): l'invité reculerait.
   */
  function catchUp(): void {
    let before = last;
    for (let i = 0; i < frames.length && frames.length > settings.idleBuffered;) {
      const frame = frames[i];
      if (frame === undefined) break;
      if (idleAfter(frame, before)) frames.splice(i, 1);
      else {
        before = frame;
        i += 1;
      }
    }
    if (frames.length > settings.maxBuffered)
      frames.splice(0, frames.length - settings.maxBuffered);
  }

  return {
    push(incoming) {
      for (const frame of incoming) {
        if (frame.seq <= lastQueued) continue;
        lastQueued = frame.seq;
        frames.push(frame);
      }
    },
    next() {
      // Une commande déjà jouée d'avance (devinée) est écartée à son arrivée.
      while ((frames[0]?.seq ?? Number.POSITIVE_INFINITY) <= ack) frames.shift();
      catchUp();
      const frame = frames.shift();
      if (frame !== undefined) {
        last = frame;
        ack = frame.seq;
        stale = 0;
        return frame;
      }
      stale += 1;
      if (last === null || stale > settings.guessTicks) return idleInput(Math.max(ack, 0));
      // Commande en retard: on rejoue le déplacement de la dernière. Si elle marchait, la devinée
      // compte pour le numéro suivant (sinon un pas de trop à chaque retard, rattrapé par un
      // à-coup); immobile, on attend la vraie sans avancer le numéro (un départ ne se perd pas).
      // L'action ne se devine jamais: un geste lancé un pas plus tard ne se voit pas.
      if (moving(last, settings.moveDeadzone)) ack += 1;
      return { seq: ack, moveX: last.moveX, moveY: last.moveY, run: last.run, act: false };
    },
    ack() {
      return ack;
    },
    size() {
      return frames.length;
    },
    reset() {
      frames.length = 0;
      stale = settings.guessTicks + 1;
    },
  };
}
