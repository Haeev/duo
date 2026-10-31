/**
 * Clavier et souris (par le SDK) vers commandes et intentions: Z Q S D tournés
 * selon la caméra, Espace ou clic pour agir, molette pour l'outil ou le
 * meuble, A et E pour la caméra, R et F pour le zoom (section 6 de `demo.md`).
 */
import type { Input } from '@duo/sdk';
import type { ClickTarget, ControlFrame } from '../etat/actions';
import { TOOLBAR_SLOTS } from '../etat/types';
import type { GameInterface, GameView, PickResult, Renderer } from '../etat/vue';
import type { GameAction } from '../session';

export interface Controls {
  /** Commandes du pas et intentions qui en découlent (envoyées par `view.send`). */
  step(view: GameView): ControlFrame;
}

export interface ControlsOptions {
  input: Input<GameAction>;
  renderer: () => Renderer | null;
  ui: () => GameInterface | null;
  /** Position du canevas à l'écran (le pointeur du SDK est relatif à lui). */
  canvasRect: () => { left: number; top: number };
}

/** Touches transmises à l'interface (elle décide si elle les consomme). */
const UI_KEYS: readonly [GameAction, string][] = [
  ['notebook', 'Tab'],
  ['back', 'Backspace'],
  ['confirm', 'Enter'],
];

/** Distance devant soi d'un repère planté au clavier, sans souris sur le jeu (m). */
const PIN_AHEAD = 2;

/** Distance devant soi du centre du coin désigné au clavier, sans souris sur le jeu (m). */
const CORNER_AHEAD = 1;

/** Position au sol de ce que la souris vise. */
function pickPosition(view: GameView, pick: PickResult): { x: number; y: number } | null {
  const w = view.world();
  switch (pick.kind) {
    case 'ground':
      return { x: pick.x, y: pick.y };
    case 'villager':
      return w.villagers.find((v) => v.id === pick.villager)?.pos ?? null;
    case 'character':
      return w.characters.find((c) => c.id === pick.character)?.pos ?? null;
    case 'ground_item':
      return w.groundItems.find((g) => g.id === pick.groundItem)?.pos ?? null;
    case 'tree':
      return w.trees.find((t) => t.id === pick.tree)?.pos ?? null;
    case 'furniture': {
      const f = w.furniture.find((x) => x.id === pick.furniture);
      return f === undefined ? null : { x: f.cell.cx + 0.5, y: f.cell.cy + 0.5 };
    }
  }
}

function toTarget(pick: PickResult): ClickTarget {
  switch (pick.kind) {
    case 'ground':
      return { kind: 'ground', x: pick.x, y: pick.y };
    case 'villager':
      return { kind: 'villager', villager: pick.villager };
    case 'character':
      return { kind: 'character', character: pick.character };
    case 'furniture':
      return { kind: 'furniture', furniture: pick.furniture };
    case 'ground_item':
      return { kind: 'ground_item', groundItem: pick.groundItem };
    case 'tree':
      return { kind: 'tree', tree: pick.tree };
  }
}

export function createControls(options: ControlsOptions): Controls {
  const { input } = options;
  let seq = 0;
  let leftWasDown = false;
  let rightWasDown = false;

  return {
    step(view) {
      seq += 1;
      const renderer = options.renderer();
      const ui = options.ui();
      const world = view.world();
      const me = world.characters.find((c) => c.id === view.localCharacter());

      for (const [action, code] of UI_KEYS) {
        if (input.wasPressed(action)) {
          const used = ui?.handleKey(code) ?? false;
          if (!used && action === 'notebook') view.send({ type: 'menu', menu: me?.menu === 'notebook' ? null : 'notebook' });
          if (!used && action === 'back' && me?.menu !== null && me?.menu !== undefined) view.send({ type: 'menu', menu: null });
        }
      }
      if (renderer !== null) {
        // A et E servent aussi aux onglets (carnet, comptoir): l'interface les prend d'abord.
        if (input.wasPressed('camera-left') && !(ui?.handleKey('KeyQ') ?? false)) renderer.camera('rotate_left');
        if (input.wasPressed('camera-right') && !(ui?.handleKey('KeyE') ?? false)) renderer.camera('rotate_right');
        if (input.wasPressed('zoom-in')) renderer.camera('zoom_in');
        if (input.wasPressed('zoom-out')) renderer.camera('zoom_out');
      }
      const captured = ui?.capturesMovement() ?? false;

      // Déplacement: haut de l'écran posé au sol selon la caméra.
      let mx = 0;
      let my = 0;
      if (!captured) {
        const forward = (input.isDown('up') ? 1 : 0) - (input.isDown('down') ? 1 : 0);
        const side = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
        if (forward !== 0 || side !== 0) {
          const yaw = renderer?.cameraYaw() ?? -Math.PI / 2;
          mx = forward * Math.cos(yaw) + side * Math.cos(yaw + Math.PI / 2);
          my = forward * Math.sin(yaw) + side * Math.sin(yaw + Math.PI / 2);
          const len = Math.hypot(mx, my);
          mx /= len;
          my /= len;
        }
      }

      // Clic gauche: aller là et agir; Espace: agir devant soi.
      const pointer = input.pointer;
      const leftPressed = pointer.left && !leftWasDown;
      const rightPressed = pointer.right && !rightWasDown;
      leftWasDown = pointer.left;
      rightWasDown = pointer.right;
      let clicked = false;
      if (leftPressed && pointer.inside && renderer !== null && !captured) {
        const rect = options.canvasRect();
        const pick = renderer.pick(rect.left + pointer.x, rect.top + pointer.y);
        if (pick !== null) {
          clicked = true;
          if (me?.placement !== null && me?.placement !== undefined) view.send({ type: 'act' });
          else view.send({ type: 'move_to', target: toTarget(pick), act: true });
        }
      }
      if (!clicked && !leftPressed && input.wasPressed('act') && !captured) view.send({ type: 'act' });
      if ((input.wasPressed('examine') && !rightPressed) || (rightPressed && pointer.inside && !captured)) view.send({ type: 'examine' });

      // Molette: le meuble en main tourne, sinon l'outil change. T tourne aussi le meuble.
      const wheel = (input.wasPressed('tool-next') ? 1 : 0) - (input.wasPressed('tool-previous') ? 1 : 0);
      if (wheel !== 0 && !captured) {
        if (me?.placement !== null && me?.placement !== undefined) view.send({ type: 'rotate_furniture', delta: wheel });
        else view.send({ type: 'cycle_slot', delta: wheel });
      }
      if (input.wasPressed('rotate')) view.send({ type: 'rotate_furniture', delta: 1 });
      // Repère et coin à soi: là où vise la souris, sinon devant soi.
      const aimed = (ahead: number): { x: number; y: number } | null => {
        if (me === undefined) return null;
        if (pointer.inside && renderer !== null) {
          const rect = options.canvasRect();
          const pick = renderer.pick(rect.left + pointer.x, rect.top + pointer.y);
          const picked = pick === null ? null : pickPosition(view, pick);
          if (picked !== null) return picked;
        }
        return { x: me.pos.x + Math.cos(me.facing) * ahead, y: me.pos.y + Math.sin(me.facing) * ahead };
      };
      const pinAt = input.wasPressed('pin') ? aimed(PIN_AHEAD) : null;
      if (pinAt !== null) view.send({ type: 'pin', x: pinAt.x, y: pinAt.y });
      const cornerAt = input.wasPressed('corner') && !captured ? aimed(CORNER_AHEAD) : null;
      if (cornerAt !== null) view.send({ type: 'corner', x: cornerAt.x, y: cornerAt.y });
      for (let i = 1; i <= TOOLBAR_SLOTS; i++) {
        if (input.wasPressed(`slot-${i}`)) view.send({ type: 'select_slot', slot: i - 1 });
      }

      const actHeld = !captured && input.isDown('act');
      return { seq, moveX: mx, moveY: my, actHeld };
    },
  };
}
