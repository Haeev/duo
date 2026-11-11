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
import { INPUT_TUNING, type InputTuning } from './reglages';

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
  /**
   * Un écran de l'interface (dialogue, carnet, rangement) a pris le clavier: ni déplacement, ni
   * action, ni caméra ne partent à la simulation tant que c'est vrai.
   */
  readonly captured?: () => boolean;
  /** Horloge en temps réel, en millisecondes (essais). */
  readonly now?: () => number;
  readonly tuning?: InputTuning;
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
  /** Capture au pas précédent: l'appui qui referme un écran ne doit pas agir sur le monde. */
  let wasCaptured = false;
  const now = options.now ?? (() => performance.now());
  const tuning = options.tuning ?? INPUT_TUNING;
  // Après la fermeture d'un écran, l'action reste verrouillée jusqu'à ce que la touche soit
  // relâchée et que le délai en temps réel soit passé: un Espace tardif ne rouvre pas la conversation.
  let actLocked = false;
  let unlockAt = 0;

  return {
    step() {
      seq += 1;
      const world = view.world();
      const local = view.localIndex();
      const me = world === null || local === null ? null : world.players[local];

      const captured = wasCaptured || (options.captured?.() ?? false);
      const nowCaptured = options.captured?.() ?? false;
      if (wasCaptured && !nowCaptured) {
        actLocked = true;
        unlockAt = now() + tuning.actReleaseGuardMs;
      }
      if (nowCaptured) actLocked = false;
      wasCaptured = nowCaptured;

      const forward = captured ? 0 : (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
      const side = captured ? 0 : (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
      if (camera === null) worldMove(forward, side, options.cameraYaw?.() ?? 0, move);
      else {
        const length = Math.hypot(forward, side);
        const world = length === 0 ? null : camera.moveToWorld(side / length, forward / length);
        move.moveX = world?.x ?? 0;
        move.moveY = world?.y ?? 0;
        // Caméra: A et E tournent (tenues), flèches haut et bas zooment, glissé au bouton droit,
        // molette. Le pointeur et la molette du SDK s'accumulent sur un pas.
        const pointer = input.pointer;
        cameraInput.turn = captured
          ? 0
          : (input.isDown('camera-right') ? 1 : 0) - (input.isDown('camera-left') ? 1 : 0);
        cameraInput.zoom = captured
          ? 0
          : (input.isDown('zoom-in') ? 1 : 0) - (input.isDown('zoom-out') ? 1 : 0);
        cameraInput.dragPixels = pointer.right && !captured ? pointer.movementX : 0;
        cameraInput.wheel = captured ? 0 : pointer.wheel;
        camera.pushCameraInput(cameraInput);
      }

      // Les appuis sont toujours lus (ils ne restent pas en attente), mais ignorés sous capture.
      let act = input.wasPressed('act');
      if (actLocked) {
        if (!input.isDown('act') && now() >= unlockAt) actLocked = false;
        else act = false;
      }
      const next = input.wasPressed('slot-next');
      const stow = input.wasPressed('stow');
      const picked = SLOTS.map((action) => input.wasPressed(action));
      if (!captured) {
        if (act) view.send({ type: 'act' });
        picked.forEach((pressed, slot) => {
          if (pressed) view.send({ type: 'select_slot', slot });
        });
        if (next && me !== null && me.toolbar.length > 0)
          view.send({ type: 'select_slot', slot: ((me.selected ?? -1) + 1) % me.toolbar.length });
        if (stow) view.send({ type: 'select_slot', slot: null });
      }

      return {
        seq,
        moveX: captured ? 0 : move.moveX,
        moveY: captured ? 0 : move.moveY,
        run: !captured && input.isDown('run'),
        act: !captured && !actLocked && input.isDown('act'),
      };
    },
  };
}
