/**
 * Z Q S D tournés selon la caméra (`entrees/commandes.ts` et `cameraYaw()` du
 * rendu): pour chaque orientation, Z mène vers le haut de l'écran, S vers le
 * bas, Q vers la gauche et D vers la droite. Et A, E ne tournent la caméra que
 * si l'interface ne les prend pas (onglets du carnet, demande 8).
 */
import type { Input, PointerState } from '@duo/sdk';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createControls } from '../entrees/commandes';
import type { GameInterface, GameView, Renderer } from '../etat/vue';
import type { GameAction } from '../session';
import { IsoCameraRig } from './camera';

const FOCUS = { x: 20, y: 20 };
/** Écart toléré hors de l'axe attendu, en unités d'écran normalisées. */
const OFF_AXIS = 1e-6;

const POINTER: PointerState = {
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

/** Entrées du SDK simulées: les actions tenues et celles enfoncées à ce pas. */
function fakeInput(down: Set<GameAction>, pressed: Set<GameAction>): Input<GameAction> {
  const input: Partial<Input<GameAction>> = {
    isDown: (action) => down.has(action),
    wasPressed: (action) => pressed.has(action),
    wasReleased: () => false,
    pointer: POINTER,
  };
  // Le pas de commandes ne lit que ces quatre membres.
  return input as Input<GameAction>;
}

function fakeRenderer(rig: IsoCameraRig): Renderer {
  const renderer: Partial<Renderer> = {
    cameraYaw: () => rig.yaw(),
    camera: (command) => {
      rig.command(command);
    },
    pick: () => null,
  };
  return renderer as Renderer;
}

function fakeView(): GameView {
  const world = {
    characters: [{ id: 'p1', menu: null, placement: null, bag: [], selected: 0, pos: { ...FOCUS }, facing: 0 }],
  };
  const view: Partial<GameView> = {
    world: () => world as unknown as ReturnType<GameView['world']>,
    localCharacter: () => 'p1',
    send: () => undefined,
  };
  return view as GameView;
}

/** Direction à l'écran (x vers la droite, y vers le haut) d'un déplacement au sol. */
function screenDirection(
  rig: IsoCameraRig,
  moveX: number,
  moveY: number,
): { x: number; y: number } {
  const from = new Vector3(FOCUS.x, 0, FOCUS.y).project(rig.camera);
  const to = new Vector3(FOCUS.x + moveX, 0, FOCUS.y + moveY).project(rig.camera);
  return { x: to.x - from.x, y: to.y - from.y };
}

describe('Z Q S D selon la caméra', () => {
  for (const quarter of [0, 1, 2, 3]) {
    it(`orientation ${quarter}: Z en haut, S en bas, Q à gauche, D à droite`, () => {
      const rig = new IsoCameraRig(true);
      rig.setAspect(16 / 9);
      for (let i = 0; i < quarter; i += 1) {
        rig.command('rotate_right');
      }
      rig.update(0, FOCUS.x, FOCUS.y, 0, 0, null);
      expect(rig.quarter()).toBe(quarter);
      const cases: [GameAction, (d: { x: number; y: number }) => void][] = [
        [
          'up',
          (d) => {
            expect(d.y).toBeGreaterThan(0);
            expect(Math.abs(d.x)).toBeLessThan(OFF_AXIS);
          },
        ],
        [
          'down',
          (d) => {
            expect(d.y).toBeLessThan(0);
            expect(Math.abs(d.x)).toBeLessThan(OFF_AXIS);
          },
        ],
        [
          'left',
          (d) => {
            expect(d.x).toBeLessThan(0);
            expect(Math.abs(d.y)).toBeLessThan(OFF_AXIS);
          },
        ],
        [
          'right',
          (d) => {
            expect(d.x).toBeGreaterThan(0);
            expect(Math.abs(d.y)).toBeLessThan(OFF_AXIS);
          },
        ],
      ];
      for (const [action, check] of cases) {
        const controls = createControls({
          input: fakeInput(new Set([action]), new Set()),
          renderer: () => fakeRenderer(rig),
          ui: () => null,
          canvasRect: () => ({ left: 0, top: 0 }),
        });
        const frame = controls.step(fakeView());
        check(screenDirection(rig, frame.moveX, frame.moveY));
      }
    });
  }

  it('S et Q ensemble mènent au sud dans l’orientation de départ (séquence de la QA)', () => {
    const rig = new IsoCameraRig(true);
    rig.update(0, FOCUS.x, FOCUS.y, 0, 0, null);
    const controls = createControls({
      input: fakeInput(new Set<GameAction>(['down', 'left']), new Set()),
      renderer: () => fakeRenderer(rig),
      ui: () => null,
      canvasRect: () => ({ left: 0, top: 0 }),
    });
    const frame = controls.step(fakeView());
    expect(frame.moveY).toBeCloseTo(1, 6);
    expect(frame.moveX).toBeCloseTo(0, 6);
  });
});

describe('A et E', () => {
  function stepWith(rig: IsoCameraRig, action: GameAction, uiTakesIt: boolean): void {
    const ui: Partial<GameInterface> = {
      handleKey: () => uiTakesIt,
      capturesMovement: () => false,
    };
    const controls = createControls({
      input: fakeInput(new Set(), new Set([action])),
      renderer: () => fakeRenderer(rig),
      ui: () => ui as GameInterface,
      canvasRect: () => ({ left: 0, top: 0 }),
    });
    controls.step(fakeView());
  }

  it('tournent la caméra quand l’interface ne les prend pas', () => {
    const rig = new IsoCameraRig(true);
    stepWith(rig, 'camera-right', false);
    expect(rig.quarter()).toBe(1);
    stepWith(rig, 'camera-left', false);
    expect(rig.quarter()).toBe(0);
  });

  it('ne tournent pas la caméra quand un panneau les prend (onglets)', () => {
    const rig = new IsoCameraRig(true);
    stepWith(rig, 'camera-right', true);
    stepWith(rig, 'camera-left', true);
    expect(rig.quarter()).toBe(0);
  });
});
