// Ressenti des commandes (gauntlet, tour 2, revue `docs/jeux/jeu-1/gauntlet/revues/tour-01-ressenti.md`):
// fin de geste, appui mémorisé pendant un geste, Espace tenu le long d'une rangée, tape de pavé
// tactile, correction de coin (arbre isolé, porte d'une case).
import { parseManifest, type Input } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { createInputState } from '../../../packages/sdk/src/input-state';
import manifest from '../duo-game.json';
import { createControls } from '../src/entrees/commandes';
import type { AuthoredIntent, ControlFrame, Intent } from '../src/etat/actions';
import type { GameMap } from '../src/etat/carte';
import type { Vec2, WorldEvent } from '../src/etat/types';
import type { GameView, Renderer } from '../src/etat/vue';
import type { GameAction } from '../src/session';
import type { Sim } from '../src/simulation/contexte';
import { character, secondsToTicks } from '../src/simulation/contexte';
import { SIM_DT, SIM_HZ } from '../src/simulation/constantes';
import { placeCharacter, walkStep } from '../src/simulation/deplacement';
import type { Blockers } from '../src/simulation/grille';
import { step } from '../src/simulation/pas';
import { createRobot, newSim, play } from './aides';

/** Jour 1, scène finie; Sacha au comptoir; Camille à `at`, tournée vers `facing`, l'outil `tool` en main. */
function camille(at: Vec2, facing: number, tool: string): Sim {
  const sim = newSim(5);
  play(sim, createRobot(), (s) => s.world.phase === 'day' && s.world.clock.running && s.world.scene === null, SIM_HZ * 600);
  const counter = sim.map.points.grocery_counter;
  if (counter === undefined) throw new Error('comptoir absent');
  placeCharacter(sim, character(sim, 'p2'), counter);
  const c = character(sim, 'p1');
  placeCharacter(sim, c, at);
  c.facing = facing;
  const slot = c.bag.findIndex((s) => s?.item === tool);
  if (slot < 0 || slot >= 10) throw new Error(`${tool} absent de la barre`);
  c.selected = slot;
  c.water = 8;
  for (const g of sim.world.garden) {
    g.soil = 'grass';
    g.crop = null;
  }
  step(sim, { controls: {}, intents: [] });
  return sim;
}

const idle = (seq: number): ControlFrame => ({ seq, moveX: 0, moveY: 0, actHeld: false });

function stepWith(sim: Sim, intents: Intent[], frame: ControlFrame = idle(0)): WorldEvent[] {
  const authored: AuthoredIntent[] = intents.map((intent) => ({ by: 'p1', intent }));
  step(sim, { controls: { p1: frame }, intents: authored });
  return [...sim.events];
}

describe('fin de geste', () => {
  it('bêcher: l’action dure le geste, puis repasse à idle (le rendu le joue une fois, de since à since + duration)', () => {
    const sim = camille({ x: 8.5, y: 31.5 }, -Math.PI / 2, 'hoe');
    const c = character(sim, 'p1');
    expect(stepWith(sim, [{ type: 'act' }]).some((e) => e.type === 'tilled')).toBe(true);
    const { kind, since, duration } = c.action;
    expect(kind).toBe('till');
    expect(duration).toBe(secondsToTicks(sim.content.settings.feel.actionSeconds.till ?? 0));
    while (sim.world.tick < since + duration - 1) stepWith(sim, []);
    expect(c.action.kind).toBe('till');
    stepWith(sim, []);
    expect(c.action.kind).toBe('idle');
    for (let i = 0; i < 40; i++) stepWith(sim, []);
    expect(c.action.kind).toBe('idle');
  });
});

describe('appui mémorisé pendant un geste', () => {
  /** Case (8, 30) bêchée, arrosoir en main, Camille au sud face à elle. */
  function watering(): Sim {
    const sim = camille({ x: 8.5, y: 31.5 }, -Math.PI / 2, 'watering_can');
    const g = sim.world.garden.find((x) => x.cell.cx === 8 && x.cell.cy === 30);
    if (g === undefined) throw new Error('case absente');
    g.soil = 'tilled';
    return sim;
  }
  const waterings = (events: WorldEvent[]): number => events.filter((e) => e.type === 'watered').length;

  it('Espace un pas avant la fin du geste: joué à la fin', () => {
    const sim = watering();
    const c = character(sim, 'p1');
    let events = stepWith(sim, [{ type: 'act' }]);
    const end = c.action.since + c.action.duration;
    while (sim.world.tick < end - 2) events = [...events, ...stepWith(sim, [])];
    events = [...events, ...stepWith(sim, [{ type: 'act' }])];
    for (let i = 0; i < 10; i++) events = [...events, ...stepWith(sim, [])];
    expect(waterings(events)).toBe(2);
  });

  it('clic à portée pendant le geste (dans la mémoire de 0,3 s avant la fin): joué à la fin', () => {
    const sim = watering();
    const c = character(sim, 'p1');
    let events = stepWith(sim, [{ type: 'act' }]);
    const end = c.action.since + c.action.duration;
    while (sim.world.tick < end - 4) events = [...events, ...stepWith(sim, [])];
    events = [...events, ...stepWith(sim, [{ type: 'move_to', target: { kind: 'ground', x: 8.5, y: 30.5 }, act: true }])];
    for (let i = 0; i < 20; i++) events = [...events, ...stepWith(sim, [])];
    expect(waterings(events)).toBe(2);
  });

  it('un appui plus vieux que la mémoire (feel.inputBufferSeconds) est oublié', () => {
    const sim = watering();
    const c = character(sim, 'p1');
    // Un geste allongé (endurance nulle): l'appui du début est trop vieux à la fin.
    let events = stepWith(sim, [{ type: 'act' }]);
    c.action.duration = secondsToTicks(sim.content.settings.feel.inputBufferSeconds) + 10;
    events = [...events, ...stepWith(sim, [{ type: 'act' }])];
    for (let i = 0; i < c.action.duration + 5; i++) events = [...events, ...stepWith(sim, [])];
    expect(waterings(events)).toBe(1);
  });
});

describe('Espace tenu', () => {
  it('bêche case après case en longeant une rangée du potager', () => {
    // Sur la rangée y = 29, à l'ouest, face à l'est: (8, 29), (9, 29), (10, 29) devant.
    const sim = camille({ x: 7.5, y: 29.5 }, 0, 'hoe');
    let events = stepWith(sim, [{ type: 'act' }], { seq: 1, moveX: 0, moveY: 0, actHeld: true });
    for (let i = 0; i < SIM_HZ * 3; i++) events = [...events, ...stepWith(sim, [], { seq: i + 2, moveX: 1, moveY: 0, actHeld: true })];
    const cells = events.flatMap((e) => (e.type === 'tilled' ? [`${e.cell.cx},${e.cell.cy}`] : []));
    expect(cells).toEqual(['8,29', '9,29', '10,29']);
  });

  it('sans Espace tenu, marcher le long de la rangée ne bêche rien', () => {
    const sim = camille({ x: 7.5, y: 29.5 }, 0, 'hoe');
    let events = stepWith(sim, [{ type: 'act' }], { seq: 1, moveX: 0, moveY: 0, actHeld: false });
    for (let i = 0; i < SIM_HZ * 3; i++) events = [...events, ...stepWith(sim, [], { seq: i + 2, moveX: 1, moveY: 0, actHeld: false })];
    expect(events.filter((e) => e.type === 'tilled')).toHaveLength(1);
  });
});

describe('tape de pavé tactile', () => {
  it('appui et relâchement entre deux pas: aller là et agir (move_to), pas agir devant soi', () => {
    const parsed = parseManifest(manifest);
    if (!parsed.ok) throw new Error('manifeste invalide');
    const keys = createInputState(parsed.manifest.actions, {});
    const pointer = { x: 100, y: 100, ndcX: 0, ndcY: 0, inside: true, left: false, middle: false, right: false, wheel: 0, locked: false, movementX: 0, movementY: 0 };
    const input: Input<GameAction> = {
      isDown: (a) => keys.isDown(a),
      wasPressed: (a) => keys.wasPressed(a),
      wasReleased: (a) => keys.wasReleased(a),
      pointer,
      frame: () => ({ ...keys.frame(), pointer: { ndcX: 0, ndcY: 0, inside: true, wheel: 0 } }) as ReturnType<Input<GameAction>['frame']>,
      attach: () => undefined,
      lockPointer: () => undefined,
      unlockPointer: () => undefined,
      keyLabel: (code) => code,
      actionLabel: (a) => a,
      keysOf: (a) => keys.keysOf(a),
    };
    const picking: Pick<Renderer, 'cameraYaw' | 'camera' | 'pick'> = {
      cameraYaw: () => (-3 * Math.PI) / 4,
      camera: () => undefined,
      pick: () => ({ kind: 'ground', x: 8.5, y: 30.5 }),
    };
    const sim = newSim(5);
    const sent: Intent[] = [];
    const view: Pick<GameView, 'world' | 'localCharacter' | 'send'> = {
      world: () => sim.world,
      localCharacter: () => 'p1',
      send: (intent) => sent.push(intent),
    };
    const controls = createControls({
      input,
      // Les commandes n'appellent du rendu que la caméra et le pointage.
      renderer: () => picking as unknown as Renderer,
      ui: () => null,
      canvasRect: () => ({ left: 0, top: 0 }),
    });
    // Le SDK reçoit l'appui et le relâchement avant le pas: `pointer.left` est déjà retombé.
    keys.mouseDown('left');
    keys.mouseUp('left');
    // La vue n'est lue que par `world`, `localCharacter` et `send`.
    controls.step(view as unknown as GameView);
    keys.endStep();
    expect(sent).toEqual([{ type: 'move_to', target: { kind: 'ground', x: 8.5, y: 30.5 }, act: true }]);
  });
});

describe('correction de coin', () => {
  /** Grille de 12 x 12 cases, `blocked` les cases pleines. */
  function grid(blocked: [number, number][]): Blockers {
    const width = 12;
    const height = 12;
    const cells = new Array<boolean>(width * height).fill(false);
    for (const [cx, cy] of blocked) cells[cy * width + cx] = true;
    // `moveBody` ne lit de la carte que sa taille et ses cases bloquées.
    const map = { width, height, blocked: cells } as unknown as GameMap;
    return { map, dynamic: new Uint8Array(width * height) };
  }

  function walkEast(b: Blockers, start: Vec2, seconds: number): Vec2 {
    const pos = { ...start };
    for (let i = 0; i < seconds * SIM_HZ; i++) walkStep(b, pos, 1, 0, 3.5, SIM_DT);
    return pos;
  }

  it('glisse autour d’un arbre (case isolée) chevauché de 5 à 20 cm', () => {
    const tree = grid([[5, 5]]);
    for (const overlap of [0.05, 0.1, 0.2]) {
      // Sous l'arbre: le corps (rayon 0,3 m) déborde de `overlap` sur la case (5, 5).
      const end = walkEast(tree, { x: 3.5, y: 6 + 0.3 - overlap }, 1.5);
      expect(end.x, `chevauchement ${overlap} m`).toBeGreaterThan(7);
    }
  });

  it('passe une porte d’une case jusqu’à 30 cm de décalage', () => {
    // Mur en x = 5, sauf la case (5, 5).
    const wall = grid(Array.from({ length: 12 }, (_, y): [number, number] => [5, y]).filter(([, y]) => y !== 5));
    for (const offset of [0, 0.15, 0.25, 0.3, -0.3]) {
      const end = walkEast(wall, { x: 3.5, y: 5.5 + offset }, 1.5);
      expect(end.x, `décalage ${offset} m`).toBeGreaterThan(7);
    }
  });

  it('un mur plein arrête toujours (pas de passage fantôme)', () => {
    const wall = grid(Array.from({ length: 12 }, (_, y): [number, number] => [5, y]));
    const end = walkEast(wall, { x: 3.5, y: 5.5 }, 1.5);
    expect(end.x).toBeLessThan(4.8);
  });
});
