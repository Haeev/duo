/**
 * Démonstration du rendu par tuiles (ADR 0022): Aubrune fabriquée dans la page depuis le plan du
 * level designer (`plan.json`, par l'outil `plan-vers-lieu.ts`), sans réseau ni simulation. On s'y
 * promène sans collisions; le panneau montre les tuiles chargées et leurs compteurs.
 *
 * Touches (`KeyboardEvent.code`, donc AZERTY): Z Q S D marcher, Maj courir (trois fois plus vite
 * ici, pour traverser), A et E tourner, molette ou flèches zoomer, N une heure de plus, V vue haute
 * de contrôle.
 *
 * Paramètres d'URL: `x`, `y` (m), `lacet` (degrés), `largeur` (m), `minute`, `haute` (largeur de
 * la vue haute, m), `qualite`, `panneau=0`.
 */
import plan from '../../../../../../docs/jeux/jeu-1/refonte/carte-aubrune/plan.json';
import { planToMap } from '../../../../outils/plan-vers-lieu';
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { WorldState } from '../../../etat/monde';
import type { GameView } from '../../../session';
import { createPlaceState, createWorld } from '../../../simulation/noyau/monde';
import { createRenderer, type RenderStats } from '../../index';
import { type GraphicsPreset, DEFAULT_GRAPHICS_OPTIONS } from '../../options';
import { TILE_SETTINGS } from '../reglages-tuiles';

const PLACE = 'aubrune';
const PRESETS: readonly GraphicsPreset[] = ['auto', 'high', 'medium', 'low'];

interface Memory {
  geometries: number;
  /** Géométries hors des tuiles chargées: doit revenir à sa valeur de départ. */
  outsideTiles: number;
  textures: number;
  programs: number;
  tiles: number;
}

export interface TilesDemoApi {
  ready: boolean;
  stats(): RenderStats | null;
  /** Pose le joueur local (m) et laisse passer quelques images. */
  goto(x: number, y: number, frames?: number): RenderStats | null;
  /**
   * Traversées complètes de la carte en serpentin (pas de 4 m, une image par pas), chacune suivie
   * d'un retour au départ: compteurs de mémoire avant, puis après chaque traversée (le même
   * chemin laisse le même anneau: les compteurs doivent être égaux d'une traversée à l'autre),
   * pire tuile vue, temps de construction maximal.
   */
  traverse(rounds: number): {
    before: Memory;
    after: Memory[];
    worstTriangles: number;
    worstCalls: number;
    maxLoaded: number;
    maxBuildMs: number;
    maxStepMs: number;
  } | null;
}

declare global {
  interface Window {
    tuiles: TilesDemoApi;
  }
}

const api: TilesDemoApi = {
  ready: false,
  stats: () => null,
  goto: () => null,
  traverse: () => null,
};
window.tuiles = api;

const canvas = document.getElementById('scene');
const panel = document.getElementById('panneau');
if (!(canvas instanceof HTMLCanvasElement) || panel === null) throw new Error('page incomplète');
const params = new URLSearchParams(window.location.search);
const numberParam = (name: string): number | null => {
  const raw = params.get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
};

const { map } = planToMap(plan, { place: PLACE, annex: 48 });
const files: Record<string, unknown> = { ...DATA_FILES };
files[`lieux/${PLACE}/carte.json`] = JSON.parse(JSON.stringify(map)) as unknown;
files[`lieux/${PLACE}/lieu.json`] = {
  schema: 1,
  id: PLACE,
  name: 'Aubrune',
  station: { arrival: 'quai', platform: 'quai', platformRadius: 3 },
  links: [],
  activities: [],
  music: null,
};
const content = loadContent(files);
const world: WorldState = createWorld(content, 7, [
  { id: 'demo-a', name: 'Joueur 1' },
  { id: 'demo-b', name: 'Joueur 2' },
]);
const place = content.places[PLACE];
if (place === undefined) throw new Error('Aubrune absente');
world.places[PLACE] = createPlaceState(content, place);
world.common.place = PLACE;
const start = place.map.points.quai ?? { x: 140, y: 102 };
const me = world.players[0];
const other = world.players[1];
me.body.x = numberParam('x') ?? start.x;
me.body.y = numberParam('y') ?? start.y;
// Le second joueur reste au quai: chaque machine ne charge que les tuiles de SON joueur.
other.body.x = start.x + 1.5;
other.body.y = start.y;
world.minutes = numberParam('minute') ?? 600;

const view: GameView = {
  content,
  role: 'host',
  world: () => world,
  frame: () => world,
  aim: () => null,
  localIndex: () => 0,
  send: () => undefined,
  onEvent: () => () => undefined,
};

const preset = PRESETS.find((p) => p === params.get('qualite')) ?? 'high';
const renderer = createRenderer({
  canvas,
  view,
  playerColors: ['#d9654f', '#4f8fd9'],
  graphics: { ...DEFAULT_GRAPHICS_OPTIONS, preset },
});

if (renderer === null) {
  panel.textContent = 'WebGL2 indisponible.';
  api.ready = true;
} else {
  renderer.setCamera(numberParam('lacet') ?? 45, numberParam('largeur') ?? 20);
  let overview = numberParam('haute');
  renderer.setOverview(overview);
  if (params.get('panneau') === '0') panel.hidden = true;

  const keys = new Set<string>();
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.repeat) return;
    if (event.code === 'KeyN') world.minutes = (world.minutes + 60) % 1440;
    if (event.code === 'KeyV') {
      overview = overview === null ? 180 : null;
      renderer.setOverview(overview);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      renderer.pushCameraInput({ wheel: Math.sign(event.deltaY) });
    },
    { passive: false },
  );
  const held = (code: string): number => (keys.has(code) ? 1 : 0);

  const walk = (dt: number): void => {
    const right = held('KeyD') - held('KeyA');
    const up = held('KeyW') - held('KeyS');
    const { walkSpeed, runSpeed } = content.settings.movement;
    const moving = right !== 0 || up !== 0;
    const speed = moving ? (keys.has('ShiftLeft') ? runSpeed * 3 : walkSpeed) : 0;
    me.body.speed = speed;
    if (!moving) return;
    const norm = Math.hypot(right, up);
    const move = renderer.moveToWorld(right / norm, up / norm);
    me.body.x = Math.min(place.map.width - 1, Math.max(1, me.body.x + move.x * speed * dt));
    me.body.y = Math.min(207, Math.max(1, me.body.y + move.y * speed * dt));
    me.body.facing = Math.atan2(move.y, move.x);
  };

  const describe = (stats: RenderStats): string => {
    const t = stats.tiles;
    const b = TILE_SETTINGS.budget;
    const lines = [
      `Aubrune (plan non validé), ${String(Math.floor(world.minutes / 60))} h, joueur en ${me.body.x.toFixed(0)}, ${me.body.y.toFixed(0)}: ${renderer.surfaceAt(me.body.x, me.body.y) ?? '?'}`,
      `image: ${String(stats.calls)} appels, ${String(stats.triangles)} triangles, ${String(stats.programs)} programmes, ${String(stats.geometries)} géométries`,
    ];
    if (t !== null) {
      lines.push(
        `tuiles: ${String(t.loaded)} chargées, ${String(t.pending)} en attente, construction ${t.buildMs.toFixed(1)} ms (étape la plus longue ${t.maxStepMs.toFixed(1)} ms)`,
        `total construit: ${String(t.triangles)} triangles, ${String(t.calls)} appels; lointain et repères ${String(t.farTriangles)} tr., ${String(t.farCalls)} appels`,
        `pire tuile: ${String(t.worstTriangles)} / ${String(b.tileTriangles)} triangles, ${String(t.worstCalls)} / ${String(b.tileCalls)} appels`,
        ...t.tiles.map(
          (tile) =>
            `  tuile ${String(tile.tile)}: ${String(tile.triangles)} tr., ${String(tile.calls)} appels`,
        ),
      );
    }
    return lines.join('\n');
  };

  const memory = (): Memory => {
    const s = renderer.stats();
    return {
      geometries: s.geometries,
      outsideTiles: s.geometries - (s.tiles?.geometries ?? 0),
      textures: s.textures,
      programs: s.programs,
      tiles: s.tiles?.loaded ?? 0,
    };
  };
  const settle = (frames: number): void => {
    for (let i = 0; i < frames; i++) renderer.frame(1 / 60);
  };
  api.stats = () => renderer.stats();
  api.goto = (x, y, frames = 30) => {
    me.body.x = x;
    me.body.y = y;
    settle(frames);
    return renderer.stats();
  };
  api.traverse = (rounds) => {
    me.body.x = start.x;
    me.body.y = start.y;
    settle(60);
    const before = memory();
    let worstTriangles = 0;
    let worstCalls = 0;
    let maxLoaded = 0;
    let maxBuildMs = 0;
    const after: Memory[] = [];
    for (let r = 0; r < rounds; r++) {
      for (let y = 4; y < 208; y += 24) {
        const forward = (y / 24) % 2 === 0;
        for (let k = 0; k <= place.map.width; k += 4) {
          me.body.x = Math.min(place.map.width - 1, forward ? k : place.map.width - k);
          me.body.y = y;
          renderer.frame(1 / 60);
          const t = renderer.stats().tiles;
          if (t === null) continue;
          worstTriangles = Math.max(worstTriangles, t.worstTriangles);
          worstCalls = Math.max(worstCalls, t.worstCalls);
          maxLoaded = Math.max(maxLoaded, t.loaded);
          maxBuildMs = Math.max(maxBuildMs, t.buildMs);
        }
      }
      me.body.x = start.x;
      me.body.y = start.y;
      settle(60);
      after.push(memory());
    }
    const maxStepMs = renderer.stats().tiles?.maxStepMs ?? 0;
    return { before, after, worstTriangles, worstCalls, maxLoaded, maxBuildMs, maxStepMs };
  };

  let last = performance.now();
  let frames = 0;
  const tick = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    walk(dt);
    renderer.pushCameraInput({
      turn: held('KeyE') - held('KeyQ'),
      zoom: held('ArrowUp') - held('ArrowDown'),
    });
    renderer.frame(dt);
    frames += 1;
    if (!panel.hidden && frames % 10 === 0) panel.textContent = describe(renderer.stats());
    if (frames === 30) api.ready = true;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
