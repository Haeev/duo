/**
 * Page de démonstration du rendu seul (`rendu.html`): charge la carte du level
 * designer et un état d'exemple, sans simulation ni réseau. Sert à travailler
 * le rendu, et aux captures de Playwright.
 *
 * Paramètres de l'adresse: `heure` (10.5 ou 17:15), `meteo` (sunny, cloudy,
 * rain), `orientation` (0 à 3), `zoom` (0 à 2), `interieur` (1), `repare` (1),
 * `train` (away, arriving, stopped, departing), `vie` (0 fige la promenade),
 * `panneau` (1 montre les réglages), `x` et `y` (point de vue).
 */
import type { CameraCommand } from '../camera';
import { loadContent } from '../../donnees/contenu';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { loadMap } from '../../donnees/carte';
import type { GameMap } from '../../etat/carte';
import type { CharacterId, WorldEvent } from '../../etat/types';
import type { GameView } from '../../etat/vue';
import { RenderEngine } from '../moteur';
import { parseDemoMap } from './carte-demo';
import { animateExampleWorld, createExampleWorld, type DemoOptions } from './etat-exemple';

const MINUTES_PER_HOUR = 60;
const DEFAULT_MINUTES = 10.5 * MINUTES_PER_HOUR;
/** Minutes de jeu par seconde réelle quand « le temps passe » (accéléré pour voir la journée). */
const DEMO_MINUTES_PER_SECOND = 12;
const MINUTES_PER_DAY = 1440;
const WALK_SPEED = 3.5;
const KEY_TO_COMMAND: Record<string, CameraCommand> = {
  KeyQ: 'rotate_left',
  KeyE: 'rotate_right',
  KeyR: 'zoom_in',
  KeyF: 'zoom_out',
};

function parseHour(raw: string | null): number {
  if (raw === null) {
    return DEFAULT_MINUTES;
  }
  const clock = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (clock !== null) {
    return Number(clock[1]) * MINUTES_PER_HOUR + Number(clock[2]);
  }
  const hours = Number(raw);
  return Number.isFinite(hours) ? hours * MINUTES_PER_HOUR : DEFAULT_MINUTES;
}

function pickMap(): GameMap {
  for (const raw of Object.values(MAP_FILES)) {
    const parsed = parseDemoMap(raw);
    if (parsed !== null) {
      return parsed;
    }
  }
  return loadMap(MAP_FILES).map;
}

interface DemoHandle {
  ready: boolean;
  stats(): ReturnType<RenderEngine['detailedStats']>;
  missing(): string[];
  breakdown(): Record<string, number>;
  frames: number;
}

declare global {
  interface Window {
    lplRendu?: DemoHandle;
  }
}

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const container = document.getElementById('scene');
  const loading = document.getElementById('chargement');
  const panel = document.getElementById('panneau');
  if (container === null) {
    return;
  }
  const content = loadContent(CONTENT_FILES);
  const map = pickMap();
  const weatherParam = params.get('meteo');
  const options: DemoOptions = {
    minutes: parseHour(params.get('heure')),
    weather: weatherParam === 'rain' || weatherParam === 'cloudy' ? weatherParam : 'sunny',
    inside: params.get('interieur') === '1',
    repaired: params.get('repare') === '1',
    train:
      params.get('train') === 'away' || params.get('train') === 'arriving' || params.get('train') === 'departing'
        ? (params.get('train') as 'away' | 'arriving' | 'departing')
        : 'stopped',
  };
  const world = createExampleWorld(map, content, options);
  const focusX = Number(params.get('x'));
  const focusY = Number(params.get('y'));
  const p1 = world.characters[0];
  if (p1 !== undefined && params.has('x') && params.has('y') && Number.isFinite(focusX) && Number.isFinite(focusY)) {
    p1.pos = { x: focusX, y: focusY };
    p1.prev = { x: focusX, y: focusY };
  }
  const listeners = new Set<(event: WorldEvent) => void>();
  const local: CharacterId = 'p1';
  const view: GameView = {
    content,
    map,
    localCharacter: () => local,
    world: () => world,
    alpha: () => 1,
    send: () => undefined,
    onEvent: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    keyLabel: (code) => code,
    role: 'host',
  };
  const emit = (event: WorldEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const engine = new RenderEngine({ view, container, reducedMotion: false, showStats: params.get('stats') !== '0' });
  const handle: DemoHandle = { ready: false, stats: () => engine.detailedStats(),
    missing: () => [],
    breakdown: () => engine.breakdown(),
    frames: 0,
  };
  window.lplRendu = handle;
  await engine.load(() => undefined);
  loading?.remove();
  const quarter = Number(params.get('orientation') ?? '0');
  for (let i = 0; i < quarter; i += 1) {
    engine.camera('rotate_right');
  }
  const zoom = Number(params.get('zoom') ?? '1');
  if (zoom === 0) {
    engine.camera('zoom_in');
  } else if (zoom === 2) {
    engine.camera('zoom_out');
  }

  const hourInput = document.getElementById('heure') as HTMLInputElement | null;
  const weatherInput = document.getElementById('meteo') as HTMLSelectElement | null;
  const autoInput = document.getElementById('auto') as HTMLInputElement | null;
  const lifeInput = document.getElementById('vie') as HTMLInputElement | null;
  if (panel !== null && params.get('panneau') === '1') {
    panel.hidden = false;
  }
  if (hourInput !== null) {
    hourInput.value = String(world.clock.minutes);
    hourInput.addEventListener('input', () => {
      world.clock.minutes = Number(hourInput.value);
    });
  }
  if (weatherInput !== null) {
    weatherInput.value = world.weather;
    weatherInput.addEventListener('change', () => {
      const value = weatherInput.value;
      world.weather = value === 'rain' || value === 'cloudy' ? value : 'sunny';
    });
  }
  if (lifeInput !== null) {
    lifeInput.checked = params.get('vie') !== '0';
  }

  const held = new Set<string>();
  window.addEventListener('keydown', (event) => {
    const command = KEY_TO_COMMAND[event.code];
    if (command !== undefined && !event.repeat) {
      engine.camera(command);
    }
    held.add(event.code);
    const me = world.characters[0];
    const cell = world.garden[1]?.cell ?? { cx: 0, cy: 0 };
    if (me === undefined || event.repeat) {
      return;
    }
    if (event.code === 'KeyH') {
      emit({ type: 'harvested', by: 'p1', cell, item: 'radish', quality: 'fine', count: 3 });
    } else if (event.code === 'KeyB') {
      emit({ type: 'tilled', by: 'p1', cell });
    } else if (event.code === 'KeyT') {
      const tree = world.trees[1];
      if (tree !== undefined) {
        tree.hits += 1;
        tree.lastHitTick = world.tick;
        tree.felled = tree.hits >= 3;
        emit({ type: 'chop', by: 'p1', tree: tree.id, felled: tree.felled });
      }
    } else if (event.code === 'KeyC') {
      emit({ type: 'element_built', construction: 'house_roof', element: 'roof_4' });
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
  });
  container.addEventListener('click', (event) => {
    const picked = engine.pick(event.clientX, event.clientY);
    const me = world.characters[0];
    if (picked?.kind === 'ground' && me !== undefined) {
      me.destination = { x: picked.x, y: picked.y };
    }
  });

  let last = performance.now();
  let seconds = 0;
  const tick = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    seconds += dt;
    if (autoInput?.checked === true) {
      world.clock.minutes = (world.clock.minutes + dt * DEMO_MINUTES_PER_SECOND) % MINUTES_PER_DAY;
      if (hourInput !== null) {
        hourInput.value = String(world.clock.minutes);
      }
    }
    const me = world.characters[0];
    const moveUp = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    const moveRight = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    const steering = moveUp !== 0 || moveRight !== 0;
    for (const event of animateExampleWorld(world, map, seconds, lifeInput?.checked !== false && !steering)) {
      emit(event);
    }
    if (me !== undefined && steering) {
      // Z Q S D tournés selon la caméra: la convention de `cameraYaw` (ETAT.md, demande 1).
      const yaw = engine.cameraYaw();
      const dx = Math.cos(yaw) * moveUp + Math.cos(yaw + Math.PI / 2) * moveRight;
      const dy = Math.sin(yaw) * moveUp + Math.sin(yaw + Math.PI / 2) * moveRight;
      const length = Math.hypot(dx, dy);
      me.prev = { ...me.pos };
      me.pos = { x: me.pos.x + (dx / length) * WALK_SPEED * dt, y: me.pos.y + (dy / length) * WALK_SPEED * dt };
      me.facing = Math.atan2(dy, dx);
      me.speed = WALK_SPEED;
      me.action = { kind: 'walk', since: 0, duration: 0, target: null };
    } else if (me !== undefined && me.action.kind === 'walk' && lifeInput?.checked === false) {
      me.speed = 0;
      me.action = { kind: 'idle', since: 0, duration: 0, target: null };
    }
    engine.frame(dt);
    handle.frames += 1;
    window.requestAnimationFrame(tick);
  };
  handle.ready = true;
  window.requestAnimationFrame(tick);
}

void main();
