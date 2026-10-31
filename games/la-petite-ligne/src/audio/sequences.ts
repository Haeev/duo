/**
 * Séquences de `plan.sequences` (train, réveil, coucher), logique pure: chaque
 * image, on donne l'instant de la séquence et l'on reçoit les sons ponctuels à
 * lancer. Les boucles (`until`), les arrêts (`stop`, `stopMusic`) et les
 * musiques de fond sont des états: l'appelant les lit avec `stepTime` et
 * `stopTime` de `catalogue.ts`.
 */
import type { SequenceStep } from './catalogue';

export interface SequenceShot {
  sound: string;
  /** Version lointaine du son, à jouer si l'on est loin. */
  farVariant: string | null;
  /** Musique jouée une fois (fanfare). */
  music: boolean;
  /** Instant prévu dans la séquence (s). */
  at: number;
  /** Position de départ dans le fichier (s), pour un long son recalé. */
  offset: number;
  /** Son recalé sur l'horloge de la séquence. */
  synced: boolean;
}

export interface SequenceCatalogue {
  /** Durée du son ou de la musique (s). */
  duration(id: string): number;
  /** Musique de fond (en boucle), qui n'est pas un pas ponctuel. */
  isBedMusic(id: string): boolean;
  /** Long son recalé sur l'horloge (approche, départ du train). */
  isSynced(id: string): boolean;
  lateTolerance: number;
}

/** Marge de fin: un son recalé qu'il ne reste plus que cela à jouer n'est pas lancé (s). */
const SYNC_TAIL_SECONDS = 0.5;

export class SequenceRun {
  private readonly fired: boolean[];

  constructor(
    readonly id: string,
    private readonly steps: readonly SequenceStep[],
    private readonly catalogue: SequenceCatalogue,
  ) {
    this.fired = steps.map(() => false);
  }

  /** Lance les pas atteints à l'instant `t` de la séquence (`Infinity`: tout est passé, rien n'est joué). */
  advance(t: number, out: SequenceShot[]): void {
    for (let i = 0; i < this.steps.length; i += 1) {
      const step = this.steps[i];
      if (step === undefined || this.fired[i] === true || step.at > t) continue;
      this.fired[i] = true;
      if (!Number.isFinite(t)) continue;
      const sound = step.play;
      if (sound === null || step.until !== null) continue;
      if (step.music && this.catalogue.isBedMusic(sound)) continue;
      const late = t - step.at;
      const synced = !step.music && this.catalogue.isSynced(sound);
      if (synced) {
        if (late < this.catalogue.duration(sound) - SYNC_TAIL_SECONDS) {
          out.push({ sound, farVariant: step.farVariant, music: false, at: step.at, offset: late, synced: true });
        }
        continue;
      }
      if (late > this.catalogue.lateTolerance) continue;
      out.push({ sound, farVariant: step.farVariant, music: step.music, at: step.at, offset: 0, synced: false });
    }
  }

  /** Tous les pas ont été passés. */
  done(): boolean {
    return this.fired.every(Boolean);
  }
}
