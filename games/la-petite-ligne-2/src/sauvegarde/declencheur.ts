/**
 * Déclencheur des sauvegardes de l'hôte: à l'aube (`day_started`), à chaque arrivée en train
 * (`train_arrived`) et sur demande. Les sauvegardes périodiques, de pause et de sortie passent par
 * le fournisseur du SDK (`saves.provide`), pas par ici.
 *
 * L'écriture ne se lance jamais dans le pas de simulation: les événements sont notés, l'écriture
 * part au tour de boucle suivant, une seule à la fois (une demande arrivée pendant une écriture en
 * fait repartir une dernière, qui voit l'état le plus récent).
 */
import type { SaveSnapshot, SaveStatus } from '@duo/sdk';
import type { GameEvent } from '../simulation/noyau/evenements';

export interface SaveTarget {
  write(moment: 'auto' | 'manual', snapshot: SaveSnapshot): Promise<SaveStatus>;
}

export interface SaveTriggerOptions {
  readonly target: SaveTarget;
  readonly snapshot: () => SaveSnapshot;
  readonly warn: (message: string, details?: unknown) => void;
  /** Reporte l'écriture hors du pas en cours (`setTimeout` 0 par défaut; les tests donnent le leur). */
  readonly defer?: (run: () => void) => void;
}

export interface SaveTrigger {
  /** À appeler avec les événements d'un pas: note ceux qui demandent une sauvegarde. */
  notify(events: readonly GameEvent[]): void;
  /** Sauvegarde sur demande des joueurs; résout avec le statut du SDK. */
  saveNow(): Promise<SaveStatus>;
  /** Résout quand plus aucune écriture n'est en attente ni en cours. */
  idle(): Promise<void>;
  dispose(): void;
}

/** Événements qui déclenchent une sauvegarde automatique. */
export function wantsSave(event: GameEvent): boolean {
  return event.type === 'day_started' || event.type === 'train_arrived';
}

export function createSaveTrigger(options: SaveTriggerOptions): SaveTrigger {
  const defer = options.defer ?? ((run: () => void): void => void setTimeout(run, 0));
  let pending = false;
  let writing: Promise<void> | null = null;
  let disposed = false;

  const attempt = async (moment: 'auto' | 'manual'): Promise<SaveStatus> => {
    try {
      const status = await options.target.write(moment, options.snapshot());
      if (status !== 'ok') options.warn(`sauvegarde ${moment} non écrite`, { status });
      return status;
    } catch (error) {
      options.warn(`sauvegarde ${moment} impossible`, { error: String(error) });
      return 'write-error';
    }
  };

  const flush = (): void => {
    if (disposed || !pending || writing !== null) return;
    pending = false;
    writing = attempt('auto').then(() => {
      writing = null;
      flush();
    });
  };

  return {
    notify(events) {
      if (disposed || !events.some(wantsSave)) return;
      pending = true;
      defer(flush);
    },
    saveNow() {
      if (disposed) return Promise.resolve('refused');
      return attempt('manual');
    },
    async idle() {
      while (writing !== null) await writing;
    },
    dispose() {
      disposed = true;
    },
  };
}
