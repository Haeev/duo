/**
 * Regard à la souris et pointeur verrouillé (technique 2.2, ux 2.3 et 9.4).
 * - Le regard s'applique à chaque image, sur cette machine, sans attendre la simulation.
 * - Échap pointeur verrouillé: Chromium rend la souris sans transmettre la touche; le SDK y voit
 *   un déverrouillage involontaire et demande la pause de Duo (`unlockPointer` sinon).
 * - Le clic (ou Entrée) qui reprend la souris n'agit jamais dans le café.
 * - Un panneau du jeu rend le pointeur à l'ouverture et le reprend à la fermeture, sans geste.
 */
import type { Input } from '@duo/sdk';
import type { GameAction } from '../actions';

/** Au-delà, un déplacement de souris en un seul événement est un artefact (pixels CSS). */
const MOVEMENT_SPIKE = 300;

export interface Look {
  yawDeg: number;
  pitchDeg: number;
}

export interface LookControl {
  readonly look: Look;
  /** Le pointeur est verrouillé: le regard suit la souris. */
  locked(): boolean;
  /** Un panneau du jeu a le curseur. */
  panelOpen(): boolean;
  /** Vrai une fois après le clic qui a repris la souris: cet appui d'« Agir » est ignoré. */
  consumeResumeClick(): boolean;
  /** Demande de reprise (Entrée, ou fermeture d'un panneau). */
  grab(): void;
  /** Le jeu rend le pointeur (pause de Duo, panneau ouvert). */
  release(): void;
  setPanelOpen(open: boolean): void;
  dispose(): void;
}

export function createLookControl(
  canvas: HTMLCanvasElement,
  input: Input<GameAction>,
  options: { degPerPixel: number; pitchLimitDeg: number; start: Look; active: () => boolean },
): LookControl {
  const look: Look = { ...options.start };
  let panel = false;
  let swallowing = false;

  const onMove = (event: PointerEvent): void => {
    if (document.pointerLockElement !== canvas) return;
    // Chromium envoie parfois un saut aberrant juste après le verrouillage: on l'ignore.
    if (Math.abs(event.movementX) > MOVEMENT_SPIKE || Math.abs(event.movementY) > MOVEMENT_SPIKE)
      return;
    look.yawDeg = (((look.yawDeg - event.movementX * options.degPerPixel) % 360) + 360) % 360;
    look.pitchDeg = Math.max(
      -options.pitchLimitDeg,
      Math.min(options.pitchLimitDeg, look.pitchDeg - event.movementY * options.degPerPixel),
    );
  };
  const onDown = (event: PointerEvent): void => {
    if (document.pointerLockElement === canvas || panel || !options.active()) return;
    if (event.target !== canvas) return;
    swallowing = true;
    input.lockPointer();
  };
  window.addEventListener('pointermove', onMove);
  // En capture: avant que le SDK compte l'appui comme « Agir ».
  window.addEventListener('pointerdown', onDown, { capture: true });

  return {
    look,
    locked: () => document.pointerLockElement === canvas,
    panelOpen: () => panel,
    consumeResumeClick() {
      const was = swallowing;
      swallowing = false;
      return was;
    },
    grab() {
      if (!panel) input.lockPointer();
    },
    release() {
      input.unlockPointer();
    },
    setPanelOpen(open) {
      panel = open;
      if (open) input.unlockPointer();
      else input.lockPointer();
    },
    dispose() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, { capture: true });
    },
  };
}
