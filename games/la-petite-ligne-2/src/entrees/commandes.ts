/**
 * Du clavier vers la simulation: les commandes tenues du pas (`StepInput`, déplacement déjà
 * tourné par la caméra, dans le repère du monde) et les intentions ponctuelles. Les touches sont
 * des actions du manifeste, lues par position (`KeyboardEvent.code`) par le SDK: Z, Q, S, D d'un
 * clavier AZERTY sont `KeyW`, `KeyA`, `KeyS`, `KeyD`. Le déplacement est au clavier seul.
 */
import type { Input } from '@duo/sdk';
import type { GameAction } from '../actions';
import type { CameraInput } from '../rendu/camera';
import type { GameView } from '../session';
import type { StepInput } from '../simulation/noyau/entrees';
import { boardingChoices } from '../simulation/voyage/index';

/** Ce que les commandes demandent au rendu 3D: la caméra et le repère de l'écran. */
export interface ControlsCamera {
  pushCameraInput(input: CameraInput): void;
  /** Déplacement relatif à l'écran (`right`, `up` de -1 à 1) vers le repère de la carte. */
  moveToWorld(right: number, up: number): { x: number; y: number };
}

export interface ControlsOptions {
  readonly input: Pick<Input<GameAction>, 'isDown' | 'wasPressed' | 'pointer'>;
  readonly view: GameView;
  /**
   * Lacet affiché de la caméra, en radians (fourni par le rendu, lot L4). 0: le haut de l'écran
   * regarde le nord de la carte (y décroissant) et la droite l'est. Positif: la vue a tourné vers
   * l'est (sens horaire vu du dessus), donc à PI/2 le haut de l'écran regarde l'est.
   */
  readonly cameraYaw?: () => number;
  /** Rendu 3D: s'il est là, il reçoit les commandes de caméra et donne le repère de l'écran. */
  readonly camera?: ControlsCamera | null;
}

export interface Controls {
  /** À appeler une fois par pas de simulation: envoie les intentions, renvoie les commandes tenues. */
  step(): StepInput;
}

const SLOTS: readonly GameAction[] = ['slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'];

/**
 * Tourne la commande du joueur (avant ou arrière, droite ou gauche, à l'écran) dans le repère du
 * monde (x vers l'est, y vers le sud) selon le lacet de la caméra. Vecteur unitaire, ou nul.
 */
export function worldMove(
  forward: number,
  side: number,
  yaw: number,
  out: { moveX: number; moveY: number },
): void {
  const length = Math.hypot(forward, side);
  if (length === 0) {
    out.moveX = 0;
    out.moveY = 0;
    return;
  }
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  // Avant: (sin, -cos). Droite: (cos, sin).
  out.moveX = (forward * sin + side * cos) / length;
  out.moveY = (-forward * cos + side * sin) / length;
}

export function createControls(options: ControlsOptions): Controls {
  const { input, view } = options;
  const camera = options.camera ?? null;
  let seq = 0;
  const move = { moveX: 0, moveY: 0 };
  const cameraInput = { turn: 0, zoom: 0, dragPixels: 0, wheel: 0 };

  return {
    step() {
      seq += 1;
      const world = view.world();
      const local = view.localIndex();
      const me = world === null || local === null ? null : world.players[local];

      const forward = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
      const side = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      if (camera === null) worldMove(forward, side, options.cameraYaw?.() ?? 0, move);
      else {
        const length = Math.hypot(forward, side);
        const world = length === 0 ? null : camera.moveToWorld(side / length, forward / length);
        move.moveX = world?.x ?? 0;
        move.moveY = world?.y ?? 0;
        // Caméra: A et E tournent (tenues), flèches haut et bas zooment, glissé au bouton droit,
        // molette. Le pointeur et la molette du SDK s'accumulent sur un pas.
        const pointer = input.pointer;
        cameraInput.turn =
          (input.isDown('camera-right') ? 1 : 0) - (input.isDown('camera-left') ? 1 : 0);
        cameraInput.zoom = (input.isDown('zoom-in') ? 1 : 0) - (input.isDown('zoom-out') ? 1 : 0);
        cameraInput.dragPixels = pointer.right ? pointer.movementX : 0;
        cameraInput.wheel = pointer.wheel;
        camera.pushCameraInput(cameraInput);
      }

      if (input.wasPressed('act')) {
        // Provisoire, jusqu'à la fenêtre de dialogue du lot L7: Espace referme le dialogue ouvert.
        if (me !== null && me.talk !== null) view.send({ type: 'talk_close' });
        else view.send({ type: 'act' });
      }
      SLOTS.forEach((action, slot) => {
        if (input.wasPressed(action)) view.send({ type: 'select_slot', slot });
      });
      if (input.wasPressed('stow')) view.send({ type: 'select_slot', slot: null });

      // Provisoire, jusqu'à l'invite « Monter » du lot L7: Entrée sur le quai monte dans le train
      // vers le premier lieu desservi, ou en redescend.
      if (input.wasPressed('confirm') && world !== null && local !== null) {
        if (world.common.travel?.boarded[local] === true) view.send({ type: 'board', to: null });
        else {
          const to = boardingChoices({ content: view.content, world }, local)[0];
          if (to !== undefined) view.send({ type: 'board', to });
        }
      }

      return {
        seq,
        moveX: move.moveX,
        moveY: move.moveY,
        run: input.isDown('run'),
        act: input.isDown('act'),
      };
    },
  };
}
