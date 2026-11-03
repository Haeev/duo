/**
 * Clavier et souris (par le SDK) vers commandes et intentions: Z Q S D tournés
 * selon la caméra, Espace ou clic pour agir, molette pour l'outil ou le
 * meuble, A et E pour la caméra, R et F pour le zoom (section 6 de `demo.md`).
 *
 * Survol (R11): la cible sous la souris part vers l'hôte (`point_at`) quand
 * elle change; l'hôte la met en évidence s'il y a un geste à y faire, et le
 * clic comme Espace la prennent. Pendant l'aménagement, c'est le point du sol
 * sous la souris: l'aperçu du meuble le suit. Z Q S D rendent la main au
 * clavier jusqu'au prochain mouvement de la souris.
 */
import { isHome } from '../etat/interieurs';
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

/**
 * Ce que survole la souris, et sa clé (une nouvelle clé seulement part vers l'hôte): l'entité par
 * son identifiant, le sol par case; en aménagement, le sol par demi-case (l'empreinte se centre sur
 * le point, son coin change aux cases entières et aux demi-cases). Un petit objet en main (S03)
 * vise aussi le meuble porteur survolé (table, coffre), pour se poser sur son dessus.
 */
export function hoverTarget(
  renderer: Pick<Renderer, 'pick' | 'pickGround'>,
  clientX: number,
  clientY: number,
  placing: boolean,
  self: string,
  small = false,
): { key: string; target: ClickTarget } | null {
  if (placing && small) {
    const pick = renderer.pick(clientX, clientY);
    if (pick?.kind === 'furniture') return { key: `furniture:${pick.furniture}`, target: { kind: 'furniture', furniture: pick.furniture } };
  }
  if (placing) {
    const ground = renderer.pickGround?.(clientX, clientY) ?? null;
    if (ground === null) return null;
    return { key: `place:${Math.floor(ground.x * 2)}:${Math.floor(ground.y * 2)}`, target: { kind: 'ground', x: ground.x, y: ground.y } };
  }
  const pick = renderer.pick(clientX, clientY);
  if (pick === null || (pick.kind === 'character' && pick.character === self)) return null;
  const target = toTarget(pick);
  switch (target.kind) {
    case 'ground':
      return { key: `ground:${Math.floor(target.x)}:${Math.floor(target.y)}`, target };
    case 'villager':
      return { key: `villager:${target.villager}`, target };
    case 'character':
      return { key: `character:${target.character}`, target };
    case 'furniture':
      return { key: `furniture:${target.furniture}`, target };
    case 'ground_item':
      return { key: `item:${target.groundItem}`, target };
    case 'tree':
      return { key: `tree:${target.tree}`, target };
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
  let rightWasDown = false;
  /** Clé de la dernière cible survolée envoyée à l'hôte, `null`: visée au clavier. */
  let hoverKey: string | null = null;
  let lastPointerX = Number.NaN;
  let lastPointerY = Number.NaN;

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

      // Survol: la souris qui bouge vise; Z Q S D, un menu ou la souris hors du jeu rendent la visée au clavier.
      const pointer = input.pointer;
      const placing = me?.placement !== null && me?.placement !== undefined;
      const pointerMoved = pointer.x !== lastPointerX || pointer.y !== lastPointerY;
      lastPointerX = pointer.x;
      lastPointerY = pointer.y;
      const keyboardMove = mx !== 0 || my !== 0;
      let hovered: ClickTarget | null | undefined;
      if (!pointer.inside || captured || renderer === null || me === undefined || keyboardMove) hovered = null;
      else if (pointerMoved || hoverKey !== null) {
        // Tant que la souris vise, on revise à chaque pas: un habitant passe sous elle, l'aperçu change de taille.
        const rect = options.canvasRect();
        const hit = hoverTarget(renderer, rect.left + pointer.x, rect.top + pointer.y, placing, me.id, me.placement?.small === true);
        if (hit === null) hovered = null;
        else if (hit.key !== hoverKey) {
          hoverKey = hit.key;
          view.send({ type: 'point_at', target: hit.target });
        }
      }
      if (hovered === null && hoverKey !== null) {
        hoverKey = null;
        view.send({ type: 'point_at', target: null });
      }

      // Clic gauche: aller là et agir; Espace: agir sur ce qui est visé. Le clic est une action du
      // manifeste (`click`), mémorisée par le SDK jusqu'au pas: une tape de pavé tactile
      // plus courte qu'un pas compte aussi.
      const leftPressed = input.wasPressed('click');
      const rightPressed = pointer.right && !rightWasDown;
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
      if (!clicked && input.wasPressed('act') && !captured) view.send({ type: 'act' });
      // Clic droit: en aménagement, tourne le meuble; sur un meuble posé, le reprend; sinon examine (comme X).
      if (rightPressed && pointer.inside && !captured) {
        const rect = options.canvasRect();
        const pick = placing || renderer === null ? null : renderer.pick(rect.left + pointer.x, rect.top + pointer.y);
        if (placing) view.send({ type: 'rotate_furniture', delta: 1 });
        else if (pick?.kind === 'furniture' && me !== undefined && isHome(me)) view.send({ type: 'take_furniture', furniture: pick.furniture });
        else view.send({ type: 'examine' });
      } else if (input.wasPressed('examine') && !rightPressed) view.send({ type: 'examine' });

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

      // Espace ou clic gauche tenus: porter la poutre, bâtir.
      const actHeld = !captured && (input.isDown('act') || input.isDown('click'));
      return { seq, moveX: mx, moveY: my, actHeld };
    },
  };
}
