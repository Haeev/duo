// État des actions, sans DOM: les événements clavier et souris y entrent, les pas le consultent.
import type { ManifestAction } from '@duo/protocol';
import type { InputFrame, MouseInput } from './api';

export interface InputState {
  /** Code de touche enfoncé; renvoie `true` si la touche appartient à une action. */
  keyDown(code: string): boolean;
  keyUp(code: string): void;
  mouseDown(button: MouseInput): void;
  mouseUp(button: MouseInput): void;
  /** Un cran de molette: appui bref de l'action liée, vu pendant un pas. */
  wheel(direction: 'wheel-up' | 'wheel-down'): void;
  isDown(action: string): boolean;
  wasPressed(action: string): boolean;
  wasReleased(action: string): boolean;
  /** Fin d'un pas: les appuis et relâchements vus sont consommés. */
  endStep(): void;
  /** Tout relâcher (perte du focus, pause). */
  releaseAll(): void;
  keysOf(action: string): readonly string[];
  mouseOf(action: string): readonly MouseInput[];
  setBindings(bindings: Readonly<Record<string, readonly string[]>>): void;
  frame(): Omit<InputFrame, 'pointer'>;
}

export function createInputState(
  actions: readonly ManifestAction[],
  initialBindings: Readonly<Record<string, readonly string[]>>,
): InputState {
  const actionIds = actions.map((a) => a.id);
  let keysByAction = new Map<string, readonly string[]>();
  let actionsByKey = new Map<string, string[]>();
  const mouseByAction = new Map<string, readonly MouseInput[]>();
  const actionsByMouse = new Map<MouseInput, string[]>();

  for (const action of actions) {
    const mouse = action.mouse ?? [];
    mouseByAction.set(action.id, mouse);
    for (const button of mouse) {
      const list = actionsByMouse.get(button) ?? [];
      list.push(action.id);
      actionsByMouse.set(button, list);
    }
  }

  // Nombre de sources (touches, boutons) qui tiennent chaque action.
  const holders = new Map<string, number>();
  const heldKeys = new Set<string>();
  const heldButtons = new Set<MouseInput>();
  const pressed = new Set<string>();
  const released = new Set<string>();

  const applyBindings = (bindings: Readonly<Record<string, readonly string[]>>): void => {
    keysByAction = new Map();
    actionsByKey = new Map();
    for (const action of actions) {
      const rebound = action.rebindable === false ? undefined : bindings[action.id];
      const keys = rebound ?? action.keys;
      keysByAction.set(action.id, keys);
      for (const key of keys) {
        const list = actionsByKey.get(key) ?? [];
        list.push(action.id);
        actionsByKey.set(key, list);
      }
    }
  };

  const hold = (action: string): void => {
    const count = holders.get(action) ?? 0;
    holders.set(action, count + 1);
    if (count === 0) pressed.add(action);
  };
  const unhold = (action: string): void => {
    const count = holders.get(action) ?? 0;
    if (count <= 0) return;
    if (count === 1) {
      holders.delete(action);
      released.add(action);
    } else {
      holders.set(action, count - 1);
    }
  };

  const releaseAll = (): void => {
    for (const action of holders.keys()) released.add(action);
    holders.clear();
    heldKeys.clear();
    heldButtons.clear();
  };

  applyBindings(initialBindings);

  return {
    keyDown(code) {
      const bound = actionsByKey.get(code);
      if (bound === undefined) return false;
      if (heldKeys.has(code)) return true;
      heldKeys.add(code);
      for (const action of bound) hold(action);
      return true;
    },
    keyUp(code) {
      if (!heldKeys.delete(code)) return;
      for (const action of actionsByKey.get(code) ?? []) unhold(action);
    },
    mouseDown(button) {
      if (heldButtons.has(button)) return;
      heldButtons.add(button);
      for (const action of actionsByMouse.get(button) ?? []) hold(action);
    },
    mouseUp(button) {
      if (!heldButtons.delete(button)) return;
      for (const action of actionsByMouse.get(button) ?? []) unhold(action);
    },
    wheel(direction) {
      for (const action of actionsByMouse.get(direction) ?? []) {
        pressed.add(action);
        released.add(action);
      }
    },
    isDown(action) {
      return holders.has(action);
    },
    wasPressed(action) {
      return pressed.has(action);
    },
    wasReleased(action) {
      return released.has(action);
    },
    endStep() {
      pressed.clear();
      released.clear();
    },
    releaseAll,
    keysOf(action) {
      return keysByAction.get(action) ?? [];
    },
    mouseOf(action) {
      return mouseByAction.get(action) ?? [];
    },
    setBindings(bindings) {
      releaseAll();
      applyBindings(bindings);
    },
    frame() {
      return {
        down: actionIds.filter((id) => holders.has(id)),
        pressed: actionIds.filter((id) => pressed.has(id)),
        released: actionIds.filter((id) => released.has(id)),
      };
    },
  };
}
