/**
 * Le chat du bourg tel que le rendu le lit (0.13, lot H7, section 7.4): simulé par l'hôte
 * (`simulation/chat.ts`), transmis à l'invité avec les positions rapides. Même forme que la vue
 * `CatView` du rendu (`rendu/chat.ts`).
 */
import type { Vec2 } from './types';

export type CatPoseName = 'idle' | 'walk' | 'sleep' | 'roll';

export const CAT_POSES: readonly CatPoseName[] = ['idle', 'walk', 'sleep', 'roll'];

export interface CatSnapshot {
  readonly pos: Readonly<Vec2>;
  readonly prev: Readonly<Vec2>;
  /** Cap (radians, convention des personnages: 0 vers l'est). */
  readonly facing: number;
  readonly speed: number;
  readonly pose: CatPoseName;
  /** Pas de la simulation où la pose a commencé (roulade jouée une fois depuis là). */
  readonly since: number;
  /** Toujours dehors pour l'instant. */
  readonly inside: string | null;
}
