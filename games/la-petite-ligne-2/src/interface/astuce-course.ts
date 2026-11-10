/**
 * Rappel de la touche de course, une seule fois par machine: quand on a marché sans courir
 * pendant `walkSeconds` d'affilée dans un lieu ouvert (une longue marche dehors, où courir sert).
 * Qui a déjà couru connaît la touche: le rappel ne vient plus. Le modèle est pur (testé dans
 * `tests/astuce-course.test.ts`); le souvenir passe par un stockage injecté (`localStorage`).
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';

export interface RunHintTuning {
  /** Marche continue (s, temps de l'interface) avant le rappel. */
  readonly walkSeconds: number;
  /** Sous cette vitesse (m/s), on est arrêté. */
  readonly movingSpeed: number;
  /**
   * Arrêt plus long que cela (s): la marche continue repart de zéro. Les brefs creux (état de
   * l'invité reçu par à-coups) ne comptent pas.
   */
  readonly stillSeconds: number;
  /** Clé du souvenir « rappel vu » dans le stockage de la machine. */
  readonly storageKey: string;
}

export const RUN_HINT: RunHintTuning = {
  walkSeconds: 8,
  movingSpeed: 0.2,
  stillSeconds: 1,
  storageKey: 'la-petite-ligne-2.rappel-course',
};

/** Le peu de stockage dont le rappel a besoin (`localStorage` en jeu, une table en test). */
export interface HintStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface RunHint {
  /** Une image: `true` quand le rappel doit paraître (une seule fois). */
  frame(dt: number, world: ReadonlyWorld, me: PlayerIndex, busy: boolean): boolean;
}

/** Ce que fait le joueur de cette machine: arrêté, marche, court. */
function gait(
  content: Content,
  world: ReadonlyWorld,
  me: PlayerIndex,
  tuning: RunHintTuning,
): 'still' | 'walk' | 'run' {
  const speed = world.players[me].body.speed;
  if (speed < tuning.movingSpeed) return 'still';
  const { walkSpeed, runSpeed } = content.settings.movement;
  // À mi-chemin de la marche et de la course: les besoins changent les deux de 10 à 50 %.
  return speed > (walkSpeed + runSpeed) / 2 ? 'run' : 'walk';
}

export function createRunHint(
  content: Content,
  storage: HintStorage | null,
  tuning: RunHintTuning = RUN_HINT,
): RunHint {
  // Stockage refusé (cadre isolé) ou plein: le rappel ne vaut alors que pour cette partie.
  let done = false;
  try {
    done = storage?.getItem(tuning.storageKey) === 'vu';
  } catch {
    // Pas de souvenir lisible: le rappel pourra venir une fois dans cette partie.
  }
  let walked = 0;
  let still = 0;
  const remember = (): void => {
    done = true;
    try {
      storage?.setItem(tuning.storageKey, 'vu');
    } catch {
      // Le souvenir ne s'écrit pas: `done` suffit pour cette partie.
    }
  };
  return {
    frame(dt, world, me, busy) {
      if (done) return false;
      const indoor = content.places[world.common.place]?.def.ambience?.indoor === true;
      const now = gait(content, world, me, tuning);
      if (now === 'run') {
        remember();
        return false;
      }
      if (busy || indoor || world.common.phase !== 'day') {
        walked = 0;
        return false;
      }
      still = now === 'still' ? still + dt : 0;
      if (still > tuning.stillSeconds) walked = 0;
      else walked += dt;
      if (walked < tuning.walkSeconds) return false;
      remember();
      return true;
    },
  };
}
