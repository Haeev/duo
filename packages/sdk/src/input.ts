// Module `input`: clavier par `KeyboardEvent.code`, souris, molette; tout relâché à la perte du focus.
import type { ManifestAction } from '@duo/protocol';
import type { Input, InputFrame } from './api';
import { createInputState } from './input-state';
import { keyLabel, mouseLabel, readLayoutMap, type LayoutMap } from './keys';

const BUTTONS: readonly ('left' | 'middle' | 'right' | undefined)[] = ['left', 'middle', 'right'];

export interface InputHooks {
  /** Échap pressée: la plateforme décide de la pause (faux hôte; Duo l'intercepte avant le jeu). */
  onEscape(): void;
  /** Vrai quand Échap appartient à un champ du SDK (carnet de séance ouvert): ni pause ni appui. */
  escapeTaken?(): boolean;
  /**
   * Pointeur rendu sans que le jeu l'ait demandé, fenêtre visible et active: c'est l'Échap que
   * Chromium avale pour rendre la souris (technique de Deux Tabliers, section 2.2).
   */
  onPointerEscape?(): void;
}

/** Ce qu'on sait d'un déverrouillage du pointeur, une image après l'événement. */
export interface UnlockFacts {
  /** Le jeu l'a demandé (`unlockPointer`). */
  readonly requested: boolean;
  readonly visible: boolean;
  readonly focused: boolean;
}

/**
 * Un déverrouillage involontaire, page visible et document actif, vaut Échap; avec perte du focus
 * (Alt+Tab, Cmd+Tab, notification), ce n'est pas une pause (ADR 0004, point 4).
 */
export function unlockMeansEscape(facts: UnlockFacts): boolean {
  return !facts.requested && facts.visible && facts.focused;
}

export interface InputInternal<TAction extends string> extends Input<TAction> {
  endStep(): void;
  releaseAll(): void;
  setBindings(bindings: Readonly<Record<string, readonly string[]>>): void;
  dispose(): void;
}

interface MutablePointer {
  x: number;
  y: number;
  ndcX: number;
  ndcY: number;
  inside: boolean;
  left: boolean;
  middle: boolean;
  right: boolean;
  wheel: number;
  locked: boolean;
  movementX: number;
  movementY: number;
}

export function createInput<TAction extends string>(
  actions: readonly ManifestAction[],
  bindings: Readonly<Record<string, readonly string[]>>,
  hooks: InputHooks,
): InputInternal<TAction> {
  const state = createInputState(actions, bindings);
  const pointer: MutablePointer = {
    x: 0,
    y: 0,
    ndcX: 0,
    ndcY: 0,
    inside: false,
    left: false,
    middle: false,
    right: false,
    wheel: 0,
    locked: false,
    movementX: 0,
    movementY: 0,
  };
  // Sans DOM (tests dans Node, robot), les entrées restent au repos.
  const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
  let target: HTMLElement | null = hasDom ? document.body : null;
  let layout: LayoutMap | null = null;
  void readLayoutMap().then((map) => {
    layout = map;
  });

  const isTypingTarget = (event: Event): boolean => {
    const el = event.target;
    return (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      (el instanceof HTMLElement && el.isContentEditable)
    );
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === 'Escape') {
      if (hooks.escapeTaken?.() === true) return;
      event.preventDefault();
      if (!event.repeat) hooks.onEscape();
      return;
    }
    // Un champ de saisie du jeu (prénom du personnage) garde ses touches.
    if (isTypingTarget(event)) return;
    if (state.keyDown(event.code)) event.preventDefault();
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    state.keyUp(event.code);
  };
  const updatePosition = (event: MouseEvent): void => {
    if (target === null) return;
    const rect = target.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.inside =
      pointer.x >= 0 && pointer.y >= 0 && pointer.x < rect.width && pointer.y < rect.height;
    pointer.ndcX = rect.width > 0 ? (pointer.x / rect.width) * 2 - 1 : 0;
    pointer.ndcY = rect.height > 0 ? -((pointer.y / rect.height) * 2 - 1) : 0;
  };
  const onPointerMove = (event: PointerEvent): void => {
    pointer.movementX += event.movementX;
    pointer.movementY += event.movementY;
    updatePosition(event);
  };
  const onPointerDown = (event: PointerEvent): void => {
    updatePosition(event);
    if (isTypingTarget(event)) return;
    const button = BUTTONS[event.button];
    if (button === undefined) return;
    pointer[button] = true;
    state.mouseDown(button);
  };
  const onPointerUp = (event: PointerEvent): void => {
    const button = BUTTONS[event.button];
    if (button === undefined) return;
    pointer[button] = false;
    state.mouseUp(button);
  };
  const onWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) return;
    const step = Math.sign(event.deltaY);
    pointer.wheel += step;
    state.wheel(step < 0 ? 'wheel-up' : 'wheel-down');
  };
  const onContextMenu = (event: Event): void => {
    event.preventDefault();
  };
  const releaseAll = (): void => {
    state.releaseAll();
    pointer.left = false;
    pointer.middle = false;
    pointer.right = false;
  };
  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') releaseAll();
  };
  // Vrai entre `unlockPointer` et l'événement qui le confirme.
  let unlockRequested = false;
  const onLockChange = (): void => {
    const wasLocked = pointer.locked;
    pointer.locked = document.pointerLockElement !== null;
    if (!wasLocked || pointer.locked) return;
    const requested = unlockRequested;
    unlockRequested = false;
    // L'ordre de `blur` et de `pointerlockchange` varie: on décide une image plus tard,
    // quand `document.hasFocus()` est fixé.
    requestAnimationFrame(() => {
      const facts: UnlockFacts = {
        requested,
        visible: document.visibilityState === 'visible',
        focused: document.hasFocus(),
      };
      if (unlockMeansEscape(facts)) hooks.onPointerEscape?.();
    });
  };

  if (hasDom) {
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('pointerlockchange', onLockChange);
  }

  const firstLabel = (action: string): string => {
    const key = state.keysOf(action)[0];
    if (key !== undefined) return keyLabel(key, layout);
    const button = state.mouseOf(action)[0];
    return button === undefined ? '' : mouseLabel(button);
  };

  return {
    isDown: (action) => state.isDown(action),
    wasPressed: (action) => state.wasPressed(action),
    wasReleased: (action) => state.wasReleased(action),
    pointer,
    frame(): InputFrame<TAction> {
      const base = state.frame() as Omit<InputFrame<TAction>, 'pointer'>;
      return {
        ...base,
        pointer: {
          ndcX: pointer.ndcX,
          ndcY: pointer.ndcY,
          inside: pointer.inside,
          wheel: pointer.wheel,
        },
      };
    },
    attach(element) {
      target = element;
    },
    lockPointer() {
      void target?.requestPointerLock();
    },
    unlockPointer() {
      if (!hasDom || document.pointerLockElement === null) return;
      unlockRequested = true;
      document.exitPointerLock();
    },
    keyLabel: (code) => keyLabel(code, layout),
    actionLabel: firstLabel,
    keysOf: (action) => state.keysOf(action),
    endStep() {
      state.endStep();
      pointer.wheel = 0;
      pointer.movementX = 0;
      pointer.movementY = 0;
    },
    releaseAll,
    setBindings: (next) => {
      state.setBindings(next);
    },
    dispose() {
      if (!hasDom) return;
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
