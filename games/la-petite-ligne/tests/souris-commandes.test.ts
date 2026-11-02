// Choix de la cible à la souris côté entrées (R11): `createControls` envoie à l'hôte ce que survole la
// souris (`point_at`) quand la cible change, rend la visée au clavier dès que Z Q S D bougent, suit le
// sol sous la souris pendant l'aménagement, où le clic droit tourne le meuble.
import { HOUSE_BUILDING } from '../src/etat/carte';
import { parseManifest, type Input } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { createInputState, type InputState } from '../../../packages/sdk/src/input-state';
import manifest from '../duo-game.json';
import { createControls, hoverTarget } from '../src/entrees/commandes';
import type { Intent } from '../src/etat/actions';
import type { GameView, PickResult, Renderer } from '../src/etat/vue';
import type { GameAction } from '../src/session';
import { type Sim, character } from '../src/simulation/contexte';
import { newSim } from './aides';

interface Pointer {
  x: number;
  y: number;
  inside: boolean;
  right: boolean;
}

function inputOf(state: InputState, pointer: Pointer): Input<GameAction> {
  const full = {
    ...pointer,
    ndcX: 0,
    ndcY: 0,
    left: false,
    middle: false,
    wheel: 0,
    locked: false,
    movementX: 0,
    movementY: 0,
  };
  return {
    isDown: (action) => state.isDown(action),
    wasPressed: (action) => state.wasPressed(action),
    wasReleased: (action) => state.wasReleased(action),
    // Le pointeur du SDK est lu à chaque pas: on renvoie l'objet partagé, modifié par le test.
    get pointer() {
      return Object.assign(full, pointer);
    },
    frame: () =>
      ({
        ...state.frame(),
        pointer: { ndcX: 0, ndcY: 0, inside: pointer.inside, wheel: 0 },
      }) as ReturnType<Input<GameAction>['frame']>,
    attach: () => undefined,
    lockPointer: () => undefined,
    unlockPointer: () => undefined,
    keyLabel: (code) => code,
    actionLabel: (action) => action,
    keysOf: (action) => state.keysOf(action),
  };
}

/** Banc: un monde réel (lu par les commandes), un rendu qui « voit » ce que le test décide sous la souris. */
function bench(): {
  sent: Intent[];
  pointer: Pointer;
  keys: InputState;
  under: { pick: PickResult | null; ground: { x: number; y: number } | null };
  view: GameView;
  sim: Sim;
  step(): void;
} {
  const sim = newSim();
  for (const c of sim.world.characters) c.created = true;
  const sent: Intent[] = [];
  const view = {
    world: () => sim.world,
    localCharacter: () => 'p1',
    send: (intent: Intent) => sent.push(intent),
  } as unknown as GameView; // Les commandes ne lisent que l'état, le personnage local et l'envoi.
  const under: { pick: PickResult | null; ground: { x: number; y: number } | null } = {
    pick: null,
    ground: null,
  };
  const renderer = {
    cameraYaw: () => (-3 * Math.PI) / 4,
    camera: () => undefined,
    pick: () => under.pick,
    pickGround: () => under.ground,
  } as unknown as Renderer; // Le reste du contrat (scène, chargement) n'est jamais appelé par les commandes.
  const parsed = parseManifest(manifest);
  if (!parsed.ok) throw new Error('manifeste invalide');
  const keys = createInputState(parsed.manifest.actions, {});
  const pointer: Pointer = { x: 200, y: 150, inside: true, right: false };
  const controls = createControls({
    input: inputOf(keys, pointer),
    renderer: () => renderer,
    ui: () => null,
    canvasRect: () => ({ left: 0, top: 0 }),
  });
  return {
    sent,
    pointer,
    keys,
    under,
    view,
    sim,
    step: () => {
      controls.step(view);
      keys.endStep();
    },
  };
}

const pointAts = (sent: readonly Intent[]): Intent[] => sent.filter((i) => i.type === 'point_at');

describe('commandes à la souris', () => {
  it('la cible survolée part une fois, puis quand elle change; Z Q S D rendent la visée au clavier', () => {
    const b = bench();
    b.under.pick = { kind: 'tree', tree: 'tree_03' };
    b.step();
    b.step();
    expect(pointAts(b.sent)).toEqual([
      { type: 'point_at', target: { kind: 'tree', tree: 'tree_03' } },
    ]);
    // Un habitant passe sous la souris immobile: la cible change.
    b.under.pick = { kind: 'villager', villager: 'odette' };
    b.step();
    expect(pointAts(b.sent).at(-1)).toEqual({
      type: 'point_at',
      target: { kind: 'villager', villager: 'odette' },
    });
    // Z (KeyW): la visée revient au clavier, une seule fois, et la souris immobile ne la reprend pas.
    b.keys.keyDown('KeyW');
    b.step();
    b.step();
    b.keys.keyUp('KeyW');
    b.step();
    b.step();
    expect(pointAts(b.sent).at(-1)).toEqual({ type: 'point_at', target: null });
    expect(pointAts(b.sent)).toHaveLength(3);
    // La souris bouge: elle vise de nouveau.
    b.pointer.x += 5;
    b.step();
    expect(pointAts(b.sent).at(-1)).toEqual({
      type: 'point_at',
      target: { kind: 'villager', villager: 'odette' },
    });
  });

  it('le sol se vise par case; soi-même ne se vise pas; la souris sortie du jeu rend la visée', () => {
    const b = bench();
    b.under.pick = { kind: 'ground', x: 8.2, y: 28.3 };
    b.step();
    b.under.pick = { kind: 'ground', x: 8.7, y: 28.9 };
    b.pointer.x += 3;
    b.step();
    expect(pointAts(b.sent)).toEqual([
      { type: 'point_at', target: { kind: 'ground', x: 8.2, y: 28.3 } },
    ]);
    b.under.pick = { kind: 'character', character: 'p1' };
    b.pointer.x += 3;
    b.step();
    expect(pointAts(b.sent).at(-1)).toEqual({ type: 'point_at', target: null });
    b.under.pick = { kind: 'ground', x: 9.5, y: 28.5 };
    b.pointer.x += 3;
    b.step();
    b.pointer.inside = false;
    b.step();
    expect(pointAts(b.sent).slice(-2)).toEqual([
      { type: 'point_at', target: { kind: 'ground', x: 9.5, y: 28.5 } },
      { type: 'point_at', target: null },
    ]);
  });

  it('clic gauche: la cible du clic est celle survolée, envoyée avant lui', () => {
    const b = bench();
    b.under.pick = { kind: 'ground_item', groundItem: 'g1' };
    b.keys.mouseDown('left');
    b.keys.mouseUp('left');
    b.step();
    expect(b.sent).toEqual([
      { type: 'point_at', target: { kind: 'ground_item', groundItem: 'g1' } },
      { type: 'move_to', target: { kind: 'ground_item', groundItem: 'g1' }, act: true },
    ]);
  });

  it('aménagement: le sol sous la souris (à travers les meubles), clic pour poser, clic droit pour tourner', () => {
    const b = bench();
    const me = character(b.sim, 'p1');
    me.placement = {
      item: 'chair',
      cell: { cx: 8, cy: 23 },
      rotation: 0,
      valid: true,
      blocked: null,
    };
    me.inside = HOUSE_BUILDING;
    b.under.pick = { kind: 'furniture', furniture: 'f1' };
    b.under.ground = { x: 9.3, y: 24.6 };
    b.step();
    expect(pointAts(b.sent)).toEqual([
      { type: 'point_at', target: { kind: 'ground', x: 9.3, y: 24.6 } },
    ]);
    // Une demi-case plus loin seulement: l'empreinte se recentre, la cible repart.
    b.under.ground = { x: 9.6, y: 24.6 };
    b.pointer.x += 4;
    b.step();
    expect(pointAts(b.sent)).toHaveLength(2);
    b.keys.mouseDown('left');
    b.keys.mouseUp('left');
    b.step();
    expect(b.sent.at(-1)).toEqual({ type: 'act' });
    b.pointer.right = true;
    b.keys.mouseDown('right');
    b.step();
    b.pointer.right = false;
    b.keys.mouseUp('right');
    b.step();
    expect(b.sent.filter((i) => i.type === 'rotate_furniture')).toEqual([
      { type: 'rotate_furniture', delta: 1 },
    ]);
    expect(b.sent.some((i) => i.type === 'examine')).toBe(false);
  });

  it('clic droit sur un meuble posé, dans la maison: le reprend (comme X devant lui)', () => {
    const b = bench();
    const me = character(b.sim, 'p1');
    me.inside = HOUSE_BUILDING;
    b.under.pick = { kind: 'furniture', furniture: 'f7' };
    b.pointer.right = true;
    b.keys.mouseDown('right');
    b.step();
    expect(b.sent.filter((i) => i.type === 'take_furniture' || i.type === 'examine')).toEqual([
      { type: 'take_furniture', furniture: 'f7' },
    ]);
  });

  it('`hoverTarget`: une clé par entité, par case au sol, par demi-case en aménagement', () => {
    const at = (
      pick: PickResult | null,
      ground: { x: number; y: number } | null = null,
    ): Pick<Renderer, 'pick' | 'pickGround'> => ({
      pick: () => pick,
      pickGround: () => ground,
    });
    expect(hoverTarget(at({ kind: 'ground', x: 3.9, y: 4.1 }), 0, 0, false, 'p1')?.key).toBe(
      'ground:3:4',
    );
    expect(hoverTarget(at({ kind: 'tree', tree: 't' }), 0, 0, false, 'p1')?.key).toBe('tree:t');
    expect(hoverTarget(at({ kind: 'character', character: 'p2' }), 0, 0, false, 'p1')?.key).toBe(
      'character:p2',
    );
    expect(hoverTarget(at({ kind: 'character', character: 'p1' }), 0, 0, false, 'p1')).toBeNull();
    expect(
      hoverTarget(at({ kind: 'tree', tree: 't' }, { x: 3.9, y: 4.1 }), 0, 0, true, 'p1')?.key,
    ).toBe('place:7:8');
    expect(hoverTarget(at(null, null), 0, 0, true, 'p1')).toBeNull();
  });
});
