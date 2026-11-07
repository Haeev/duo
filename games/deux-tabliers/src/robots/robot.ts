/**
 * Robot de test (ADR 0013): il joue le joueur d'une machine par une liste de tâches, avec les
 * mêmes entrées et intentions qu'un joueur. Sans DOM: sert aux tests Vitest et au faux hôte.
 */
import type { GameView } from '../reseau/vue';
import type { Intent, StepInput, Target } from '../simulation/entrees';

export type RobotTask =
  | { readonly kind: 'walk'; readonly x: number; readonly z: number; readonly fast?: boolean }
  | { readonly kind: 'act'; readonly target: Target }
  | { readonly kind: 'drop'; readonly target: Target }
  /** Tenir « Agir » pendant `steps` pas (poste à maintien). */
  | { readonly kind: 'hold'; readonly target: Target; readonly steps: number }
  | { readonly kind: 'wait'; readonly steps: number };

export interface Robot {
  next(view: GameView, seq: number): { input: StepInput; intents: Intent[] };
  done(): boolean;
}

const ARRIVED = 0.12;

export function createRobot(tasks: readonly RobotTask[]): Robot {
  let index = 0;
  let counter = 0;
  return {
    done: () => index >= tasks.length,
    next(view, seq) {
      const pose = view.pose(view.local);
      const input: StepInput = {
        seq,
        moveX: 0,
        moveZ: 0,
        fast: false,
        yawDeg: pose.yawDeg,
        pitchDeg: pose.pitchDeg,
        actHeld: false,
      };
      const intents: Intent[] = [];
      const task = tasks[index];
      if (task === undefined) return { input, intents };
      switch (task.kind) {
        case 'walk': {
          const self = view.world().players[view.local];
          const dx = task.x - self.x;
          const dz = task.z - self.z;
          if (Math.hypot(dx, dz) < ARRIVED) {
            index++;
            break;
          }
          // Avant = (-sin, -cos) du cap.
          input.yawDeg = (Math.atan2(-dx, -dz) * 180) / Math.PI;
          input.moveZ = 1;
          input.fast = task.fast ?? false;
          break;
        }
        case 'act':
          intents.push({ type: 'act', target: task.target });
          index++;
          break;
        case 'drop':
          intents.push({ type: 'drop', target: task.target });
          index++;
          break;
        case 'hold':
          if (counter === 0) intents.push({ type: 'act', target: task.target });
          input.actHeld = true;
          if (++counter >= task.steps) {
            counter = 0;
            index++;
          }
          break;
        case 'wait':
          if (++counter >= task.steps) {
            counter = 0;
            index++;
          }
          break;
      }
      return { input, intents };
    },
  };
}
