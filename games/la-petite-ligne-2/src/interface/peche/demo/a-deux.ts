/**
 * Démonstration de la pêche à deux: une simulation d'hôte sur la gare d'essai, avec une prise
 * unique factice (« la vieille carpe », à la pomme, à deux), et les deux écrans côte à côte:
 * à gauche la canne (joueur 0), à droite l'épuisette (joueur 1). Chaque moitié a son interface
 * et son clavier. `#robot`: deux joueurs automatiques qui se parlent bien (captures); ils ne
 * plongent pas (`#robot-sortie`: si). Servie par `pnpm --filter @duo/la-petite-ligne-2 dev` à
 * `/src/interface/peche/demo/a-deux.html`.
 */
import { loadContent } from '../../../donnees/charger';
import { DATA_FILES } from '../../../donnees/fichiers';
import type { PlayerIndex } from '../../../donnees/schemas/communs';
import type { AuthoredIntent } from '../../../simulation/noyau/pas';
import { createSim, step } from '../../../simulation/noyau/pas';
import { createWorld } from '../../../simulation/noyau/monde';
import { idleInput } from '../../../simulation/noyau/entrees';
import type { GameEvent } from '../../../simulation/noyau/evenements';
import { SIM_DT } from '../../../simulation/noyau/constantes';
import { fishingView } from '../../../simulation/peche/lecture';
import { pairPhase, pairWarning } from '../../../simulation/peche/a-deux';
import { aimOf } from '../../../simulation/briques/visee';
import { createInterface } from '../../index';

const files: Record<string, unknown> = { ...DATA_FILES };
// La partie commence à la gare d'essai, au bord de son étang.
const settings = DATA_FILES['commun/reglages.json'] as { start: Record<string, unknown> };
files['commun/reglages.json'] = { ...settings, start: { ...settings.start, place: 'essai-gare' } };
files['commun/prises/vieille-carpe.json'] = {
  schema: 1,
  id: 'vieille-carpe',
  kind: 'fish',
  item: 'carpe',
  places: ['essai-gare'],
  hours: { from: 0, to: 1440 },
  weathers: [],
  seasons: [],
  rarity: 'rare',
  difficulty: 4,
  fish: {
    force: 0.8,
    nervousness: 0.4,
    rhythm: { pull: 2, rest: 1.2 },
    stamina: 15,
    feints: 1,
    sizeCm: { min: 60, max: 70 },
    shadow: 'huge',
  },
  unique: {
    spot: 'etang',
    when: [],
    bait: 'pomme',
    crew: 'pair',
    fact: 'essai-gare.carpe.sortie',
    toBag: true,
  },
};
const content = loadContent(files);
const world = createWorld(content, 11, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
world.common.day = 15;
world.minutes = 19 * 60 + 20;
for (const player of [0, 1] as const) {
  const state = world.players[player];
  state.toolbar[0] = { item: 'canne', count: 1 };
  if (player === 0) state.toolbar[1] = { item: 'pomme', count: 2 };
  state.selected = 0;
  state.look = null;
  state.body = { x: player === 0 ? 6.5 : 8.6, y: 28.2, facing: Math.PI / 2, speed: 0 };
}
const sim = createSim(content, world);
const robot = location.hash.startsWith('#robot');
const robotNets = location.hash === '#robot-sortie';

/** Cadre du monde montré dans chaque moitié: l'étang et sa berge. */
const VIEW = { x: 0, y: 25, w: 14, h: 12 };
const listeners = new Set<(event: GameEvent) => void>();
const queue: AuthoredIntent[] = [];

interface Half {
  readonly player: PlayerIndex;
  readonly canvas: HTMLCanvasElement;
  readonly keys: EventTarget;
  readonly ui: ReturnType<typeof createInterface>;
  scale: number;
  ox: number;
  oy: number;
}

function makeHalf(player: PlayerIndex, id: string): Half {
  const box = document.getElementById(id);
  const canvas = box?.querySelector('canvas');
  const root = box?.querySelector('.ui');
  if (!(canvas instanceof HTMLCanvasElement) || !(root instanceof HTMLElement))
    throw new Error(`#${id} incomplet`);
  const keys = new EventTarget();
  const half: Half = {
    player,
    canvas,
    keys,
    scale: 1,
    ox: 0,
    oy: 0,
    ui: createInterface({
      root,
      view: {
        content,
        world: () => sim.world,
        localIndex: (): PlayerIndex => player,
        aim: (p) => aimOf(sim, p),
        onEvent(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      send(intent) {
        queue.push({ player, intent });
      },
      cameraYaw: () => 0,
      projectToScreen: (x, y) => ({ x: half.ox + x * half.scale, y: half.oy + y * half.scale }),
      keyTarget: keys,
      editorAtStart: false,
    }),
  };
  return half;
}
const halves = [makeHalf(0, 'canne'), makeHalf(1, 'epuisette')] as const;

function resize(): void {
  for (const half of halves) {
    const { canvas } = half;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    half.scale = Math.min(canvas.width / VIEW.w, canvas.height / VIEW.h);
    half.ox = (canvas.width - VIEW.w * half.scale) / 2 - VIEW.x * half.scale;
    half.oy = (canvas.height - VIEW.h * half.scale) / 2 - VIEW.y * half.scale;
  }
}
resize();
addEventListener('resize', resize);

/** Le monde vu de dessus, sans ombre de poisson (le rendu du jeu n'en dessine pas non plus). */
function draw(half: Half): void {
  const ctx = half.canvas.getContext('2d');
  if (ctx === null) return;
  const p = (x: number, y: number): { x: number; y: number } => ({
    x: half.ox + x * half.scale,
    y: half.oy + y * half.scale,
  });
  ctx.fillStyle = '#6f8a52';
  ctx.fillRect(0, 0, half.canvas.width, half.canvas.height);
  const spot = content.places[sim.world.common.place]?.def.fishing?.[0];
  if (spot !== undefined) {
    const a = p(spot.area.x, spot.area.y);
    ctx.fillStyle = '#2f5a70';
    ctx.beginPath();
    ctx.roundRect(a.x, a.y, spot.area.w * half.scale, spot.area.h * half.scale, half.scale * 1.2);
    ctx.fill();
  }
  const view = fishingView(content, sim.world, sim.world.tick * SIM_DT);
  for (const player of [0, 1] as const) {
    const body = sim.world.players[player].body;
    const at = p(body.x, body.y);
    const line = view.lines.find((l) => l.player === player);
    if (line !== undefined) {
      const b = p(line.bobberX, line.bobberY);
      ctx.strokeStyle = line.hooked ? '#2a2522' : 'rgba(42,37,34,0.6)';
      ctx.lineWidth = line.hooked ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(at.x, at.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.fillStyle = player === 0 ? '#5ce1e6' : '#8d6cff';
    ctx.strokeStyle = '#2a2522';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(at.x, at.y, half.scale * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// --- Robots: ils appuient sur les touches de chaque moitié, comme deux joueurs qui se parlent.
const held = [new Set<string>(), new Set<string>()] as const;
function key(half: Half, code: string, down: boolean): void {
  const set = held[half.player];
  if (down === set.has(code)) return;
  if (down) set.add(code);
  else set.delete(code);
  half.keys.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
}
function tap(half: Half, code: string): void {
  key(half, code, true);
  key(half, code, false);
}
let castIn = 1;
let netLane = 0;
let netted = -1;
function drive(dt: number): void {
  const [rod, netter] = halves;
  const fishing = sim.world.places[sim.world.common.place]?.fishing;
  const line = fishing?.lines[0] ?? null;
  const pair = line?.pair;
  if (line === null) {
    castIn -= dt;
    const phase = document.querySelector<HTMLElement>('#canne .lpl-peche')?.dataset.phase;
    if (castIn <= 0 && (phase === 'closed' || phase === 'aim')) {
      tap(rod, 'Space');
      castIn = 0.9;
    }
    return;
  }
  if (pair === undefined) return;
  const phase = pairPhase(line, pair, sim.world.tick * SIM_DT);
  // La canne tient pendant les élans, puis toujours une fois qu'elle est fatiguée.
  key(rod, 'Space', pair.tired !== null || phase.kind === 'pull');
  // L'épuisette va du côté que la canne lui dit, puis plonge à la remontée.
  const want = phase.kind === 'rise' || pairWarning(phase) ? phase.side : netLane;
  if (want !== netLane) {
    tap(netter, want < netLane ? 'KeyA' : 'KeyD');
    netLane += want < netLane ? -1 : 1;
  }
  if (robotNets && phase.kind === 'rise' && phase.into > 0.5 && netted !== pair.tired) {
    netted = pair.tired ?? -1;
    tap(netter, 'Space');
  }
}

/** Pour les captures: la remontée bien visible, l'épuisette en place, la canne tenue. */
Object.assign(window, {
  demoPeche: {
    moment(): boolean {
      const line = sim.world.places[sim.world.common.place]?.fishing?.lines[0] ?? null;
      const pair = line?.pair;
      if (line === null || pair === undefined) return false;
      const phase = pairPhase(line, pair, sim.world.tick * SIM_DT);
      return phase.kind === 'rise' && phase.into > 0.5 && phase.side === netLane && pair.down;
    },
    /** Un élan franc, avant la fatigue (le ressenti de la canne). */
    pulling(): boolean {
      const line = sim.world.places[sim.world.common.place]?.fishing?.lines[0] ?? null;
      const pair = line?.pair;
      if (line === null || pair?.tired !== null) return false;
      const phase = pairPhase(line, pair, sim.world.tick * SIM_DT);
      return phase.kind === 'pull' && phase.side !== 0 && phase.into > 0.4 && pair.held > 1;
    },
    /** La fête sur les deux écrans, après la sortie (`#robot-sortie`). */
    fete(): boolean {
      return [...document.querySelectorAll<HTMLElement>('.lpl-peche')].every(
        (e) => e.dataset.phase === 'fete',
      );
    },
    pause(): void {
      paused = true;
    },
  },
});

let paused = false;
let last = performance.now();
let accumulator = 0;
function loop(t: number): void {
  const dt = Math.min(0.25, (t - last) / 1000);
  last = t;
  if (!paused) {
    accumulator += dt;
    while (accumulator >= SIM_DT) {
      accumulator -= SIM_DT;
      step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], queue.splice(0));
      for (const event of sim.events) for (const listener of listeners) listener(event);
    }
    if (robot) drive(dt);
    for (const half of halves) {
      draw(half);
      half.ui.frame(dt);
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
