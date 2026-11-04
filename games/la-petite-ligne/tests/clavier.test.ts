// Chaîne clavier sans rendu (contre-recette du 2026-10-31, 9.3): touches par `KeyboardEvent.code`
// dans l'état d'entrée du SDK, puis `createControls` avec la caméra de départ, puis la séance de
// l'hôte (faux hôte en mémoire). Le personnage marche jusqu'au potager et bêche avec Espace, y
// compris après une pause (tout relâché, comme le fait le SDK) et avec un appui plus court qu'un pas.
import { startLocalDuo } from '@duo/sdk-dev';
import { parseManifest, type Input } from '@duo/sdk';
import { describe, expect, it } from 'vitest';
import { createInputState, type InputState } from '../../../packages/sdk/src/input-state';
import manifest from '../duo-game.json';
import { createControls } from '../src/entrees/commandes';
import type { ControlFrame } from '../src/etat/actions';
import type { Vec2, WorldEvent } from '../src/etat/types';
import type { Renderer } from '../src/etat/vue';
import { createSession, type GameAction, type Session, type SessionOptions } from '../src/session';
import { SIM_DT } from '../src/simulation/constantes';
import { character } from '../src/simulation/contexte';
import { placeCharacter } from '../src/simulation/deplacement';
import { createRobot } from '../src/simulation/robot';
import { contentAndMap, demoGarden } from './aides';

const STEP_MS = SIM_DT * 1000;
/** Orientation de la caméra au départ (convention de `cameraYaw()`, ETAT.md, demande 1 du rendu). */
const START_YAW = (-3 * Math.PI) / 4;

/** L'entrée du SDK telle que le jeu la voit, branchée sur l'état d'entrée (sans DOM, pointeur hors du jeu). */
function inputOf(state: InputState): Input<GameAction> {
  const pointer = { x: 0, y: 0, ndcX: 0, ndcY: 0, inside: false, left: false, middle: false, right: false, wheel: 0, locked: false, movementX: 0, movementY: 0 };
  return {
    isDown: (action) => state.isDown(action),
    wasPressed: (action) => state.wasPressed(action),
    wasReleased: (action) => state.wasReleased(action),
    pointer,
    frame: () => ({ ...state.frame(), pointer: { ndcX: 0, ndcY: 0, inside: false, wheel: 0 } }) as ReturnType<Input<GameAction>['frame']>,
    attach: () => undefined,
    lockPointer: () => undefined,
    unlockPointer: () => undefined,
    keyLabel: (code) => code,
    actionLabel: (action) => action,
    keysOf: (action) => state.keysOf(action),
  };
}

/** Rendu réduit à la caméra: `createControls` ne lit que `cameraYaw`, `camera` et `pick`. */
function cameraOnly(): Renderer {
  const camera: Pick<Renderer, 'cameraYaw' | 'camera' | 'pick'> = {
    cameraYaw: () => START_YAW,
    camera: () => undefined,
    pick: () => null,
  };
  // Le reste du contrat `Renderer` (scène, chargement) n'est jamais appelé par les commandes.
  return camera as unknown as Renderer;
}

interface Bench {
  host: Session;
  guest: Session;
  keys: InputState;
  events: WorldEvent[];
  /** Un pas des deux machines; l'hôte prend ses commandes au clavier (fin de pas: appuis consommés). */
  step(): Promise<void>;
  dispose(): void;
}

async function bench(): Promise<Bench> {
  const duo = await startLocalDuo<GameAction>({ manifest, conditions: { latencyMs: 0, jitterMs: 0, spikeProbability: 0 }, seed: 3 });
  await duo.start();
  const { content, map } = contentAndMap();
  const clock = { now: 0 };
  const now = (): number => clock.now;
  // Le robot joue l'hôte jusqu'au jour 1 (création, scène d'arrivée), puis le clavier prend la main.
  const hostOptions: SessionOptions = { duo: duo.hostGame, content, map, robot: createRobot(), now };
  const host = createSession(hostOptions);
  const guest = createSession({ duo: duo.guestGame, content, map, robot: createRobot(), now });
  const parsed = parseManifest(manifest);
  if (!parsed.ok) throw new Error('manifeste invalide');
  const keys = createInputState(parsed.manifest.actions, {});
  const controls = createControls({ input: inputOf(keys), renderer: cameraOnly, ui: () => null, canvasRect: () => ({ left: 0, top: 0 }) });
  const events: WorldEvent[] = [];
  host.view.onEvent((e) => events.push(e));
  let seq = 0;
  const idle = (): ControlFrame => ({ seq: (seq += 1), moveX: 0, moveY: 0, actHeld: false });
  const step = async (): Promise<void> => {
    host.step(hostOptions.robot === null ? controls.step(host.view) : idle());
    keys.endStep();
    guest.step(idle());
    clock.now += STEP_MS;
    host.beforeFrame(1);
    guest.beforeFrame(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const sim = host.hostSim();
  if (sim === null) throw new Error('hôte sans monde');
  for (let i = 0; i < 30 * 300 && !(sim.world.phase === 'day' && sim.world.clock.running && sim.world.scene === null); i++) await step();
  expect(sim.world.phase).toBe('day');
  hostOptions.robot = null;
  return {
    host,
    guest,
    keys,
    events,
    step,
    dispose: () => {
      host.dispose();
      guest.dispose();
      duo.dispose();
    },
  };
}

/** Appuie sur ces touches (codes physiques), pas après pas, jusqu'à `until` ou `maxSteps`. */
async function holdKeys(b: Bench, codes: readonly string[], until: () => boolean, maxSteps: number): Promise<void> {
  for (const code of codes) b.keys.keyDown(code);
  for (let i = 0; i < maxSteps && !until(); i++) await b.step();
  for (const code of codes) b.keys.keyUp(code);
}

/** Appui bref, enfoncé et relâché entre deux pas (plus court qu'une image). */
async function tap(b: Bench, code: string): Promise<void> {
  b.keys.keyDown(code);
  b.keys.keyUp(code);
  await b.step();
}

describe('chaîne clavier: SDK, commandes, séance', () => {
  it('marche jusqu’au potager et bêche avec Espace, avant et après une pause', async () => {
    const b = await bench();
    try {
      const sim = b.host.hostSim();
      if (sim === null) throw new Error('hôte sans monde');
      const me = character(sim, b.host.view.localCharacter());
      demoGarden(sim);
      // Départ sur l'herbe, à 5 m à l'ouest du potager (rangée sud, y = 30).

      const start: Vec2 = { x: 3.5, y: 31.5 };
      placeCharacter(sim, me, start);
      const hoe = me.bag.findIndex((s) => s?.item === 'hoe');
      expect(hoe).toBeGreaterThanOrEqual(0);
      expect(hoe).toBeLessThan(10);
      await tap(b, `Digit${(hoe + 1) % 10}`);
      expect(me.selected).toBe(hoe);

      // Caméra de départ (-3 PI/4): S et D ensemble mènent plein est (Q S D Z d'un clavier AZERTY).
      await holdKeys(b, ['KeyS', 'KeyD'], () => me.pos.x >= 5.5, 30 * 3);
      expect(me.pos.x).toBeGreaterThanOrEqual(5.5);
      expect(Math.abs(me.pos.y - start.y)).toBeLessThan(0.05);

      // Pause au milieu de la marche, touches tenues: le SDK relâche tout, aucun pas ne passe.
      b.keys.keyDown('KeyS');
      b.keys.keyDown('KeyD');
      await b.step();
      b.keys.releaseAll();
      const paused = { x: me.pos.x, y: me.pos.y };
      // Reprise: les touches sont réappuyées, la marche repart.
      await holdKeys(b, ['KeyS', 'KeyD'], () => me.pos.x >= 8.4, 30 * 3);
      expect(me.pos.x).toBeGreaterThan(paused.x + 2);
      expect(me.pos.x).toBeLessThan(9);

      // Z et D: un pas vers le nord, pour faire face au potager.
      await holdKeys(b, ['KeyW', 'KeyD'], () => false, 1);
      expect(Math.sin(me.facing)).toBeLessThan(-0.99);
      expect(me.aim).toMatchObject({ cell: { cx: 8, cy: 30 }, verb: 'till' });

      // Espace plus bref qu'un pas.
      await tap(b, 'Space');
      for (let i = 0; i < 30; i++) await b.step();
      expect(b.events.filter((e) => e.type === 'tilled')).toEqual([{ type: 'tilled', by: me.id, cell: { cx: 8, cy: 30 } }]);

      // Nouvelle pause, puis reprise: une case plus à l'est, Espace tenu un peu cette fois.
      b.keys.releaseAll();
      await holdKeys(b, ['KeyS', 'KeyD'], () => me.pos.x >= 9.4, 30 * 2);
      await holdKeys(b, ['KeyW', 'KeyD'], () => false, 1);
      expect(me.aim).toMatchObject({ cell: { cx: 9, cy: 30 }, verb: 'till' });
      await holdKeys(b, ['Space'], () => false, 5);
      for (let i = 0; i < 30; i++) await b.step();
      expect(b.events.filter((e) => e.type === 'tilled').map((e) => e.cell)).toEqual([
        { cx: 8, cy: 30 },
        { cx: 9, cy: 30 },
      ]);
      expect(b.events.some((e) => e.type === 'build_progress')).toBe(false);
    } finally {
      b.dispose();
    }
  }, 60_000);
});
