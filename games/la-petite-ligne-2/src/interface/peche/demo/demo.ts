/**
 * Démonstration du mini-jeu de pêche: une vraie simulation d'hôte sur la gare d'essai, l'étang
 * vu de dessus en 2D à la place du rendu 3D, et l'interface complète par-dessus. Jouable au
 * clavier (Espace, Q, D, Retour arrière). `#robot`: un robot appuie sur les touches (captures).
 * Servie par `pnpm --filter @duo/la-petite-ligne-2 dev` à `/src/interface/peche/demo/index.html`.
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
import { aimOf } from '../../../simulation/briques/visee';
import { createInterface } from '../../index';

const content = loadContent(DATA_FILES);
const world = createWorld(content, 11, [
  { id: 'a', name: 'Camille' },
  { id: 'b', name: 'Sacha' },
]);
world.common.day = 15;
world.minutes = 10 * 60;
for (const player of [0, 1] as const) {
  const state = world.players[player];
  state.toolbar[0] = {
    item: player === 0 ? 'canne' : 'canne-fine',
    count: 1,
    ...(player === 1 ? { wear: 60 } : {}),
  };
  state.selected = 0;
  state.look = null;
  state.body = { x: player === 0 ? 6.5 : 8.8, y: 31.2, facing: Math.PI / 2, speed: 0 };
}
const sim = createSim(content, world);
const robot = location.hash.startsWith('#robot');
// `#robot-connu`: toutes les espèces déjà au carnet, pour voir la fête courte.
if (location.hash === '#robot-connu')
  world.progress.collections.fish = Object.keys(content.catches);

const canvas = document.getElementById('monde');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('#monde absent');
const ctx = canvas.getContext('2d');
if (ctx === null) throw new Error('2d absent');

/** Cadre du monde montré: l'étang et sa berge. */
const VIEW = { x: 0, y: 26, w: 14, h: 12 };
let scale = 1;
let ox = 0;
let oy = 0;
function resize(): void {
  if (!(canvas instanceof HTMLCanvasElement)) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  scale = Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h);
  ox = (innerWidth - VIEW.w * scale) / 2 - VIEW.x * scale;
  oy = (innerHeight - VIEW.h * scale) / 2 - VIEW.y * scale;
}
resize();
addEventListener('resize', resize);
const project = (x: number, y: number): { x: number; y: number } => ({
  x: ox + x * scale,
  y: oy + y * scale,
});

const listeners = new Set<(event: GameEvent) => void>();
const queue: AuthoredIntent[] = [];
const root = document.getElementById('ui');
if (!(root instanceof HTMLElement)) throw new Error('#ui absent');
const ui = createInterface({
  root,
  view: {
    content,
    world: () => sim.world,
    localIndex: (): PlayerIndex => 0,
    aim: (player) => aimOf(sim, player),
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
  send(intent) {
    queue.push({ player: 0, intent });
  },
  cameraYaw: () => 0,
  projectToScreen: (x, y) => project(x, y),
});

const SIZES = { small: 0.35, medium: 0.55, large: 0.85, huge: 1.2 } as const;
function draw(): void {
  if (ctx === null || !(canvas instanceof HTMLCanvasElement)) return;
  ctx.fillStyle = '#8fae62';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const spot = content.places[sim.world.common.place]?.def.fishing?.[0];
  if (spot !== undefined) {
    const a = project(spot.area.x, spot.area.y);
    ctx.fillStyle = '#4f86a3';
    ctx.beginPath();
    ctx.roundRect(a.x, a.y, spot.area.w * scale, spot.area.h * scale, scale * 1.2);
    ctx.fill();
  }
  const view = fishingView(content, sim.world, sim.world.tick * SIM_DT);
  for (const s of view.shadows) {
    const p = project(s.x, s.y);
    const len = SIZES[s.size] * scale;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(s.heading);
    ctx.fillStyle = 'rgba(20, 38, 52, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 0, len / 2, len / 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const player of [0, 1] as const) {
    const body = sim.world.players[player].body;
    const p = project(body.x, body.y);
    const line = view.lines.find((l) => l.player === player);
    if (line !== undefined) {
      const b = project(line.bobberX, line.bobberY);
      ctx.strokeStyle = line.hooked ? '#2a2522' : 'rgba(42,37,34,0.6)';
      ctx.lineWidth = line.hooked ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#a4463b';
      ctx.beginPath();
      ctx.arc(b.x, b.y, scale * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = player === 0 ? '#5ce1e6' : '#8d6cff';
    ctx.strokeStyle = '#2a2522';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, scale * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// --- Robot: il lit l'interface comme un joueur (repère, bouchon, aiguille) et appuie sur les touches.
const held = new Set<string>();
function key(code: string, down: boolean): void {
  if (down === held.has(code)) return;
  if (down) held.add(code);
  else held.delete(code);
  dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));
}
function tap(code: string): void {
  key(code, true);
  key(code, false);
}
let robotWait = 0;
function drive(dt: number): void {
  const peche = document.querySelector<HTMLElement>('.lpl-peche');
  const phase = peche?.dataset.phase ?? 'closed';
  robotWait -= dt;
  if (phase === 'closed' && robotWait <= 0) {
    tap('Space');
    robotWait = 1.5;
  } else if (phase === 'aim') {
    const marker = document.querySelector<HTMLElement>('.lpl-peche__repere');
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(marker?.style.transform ?? '');
    if (m !== null) {
      const view = fishingView(content, sim.world, sim.world.tick * SIM_DT);
      const near = view.shadows.some((s) => {
        const p = project(s.x, s.y);
        return Math.hypot(p.x - Number(m[1]), p.y - Number(m[2])) < scale * 0.8;
      });
      if (near) tap('Space');
    }
  } else if (phase === 'bite') {
    if (peche?.classList.contains('lpl-peche--plonge') === true) tap('Space');
  } else if (phase === 'fight') {
    const needle = document.querySelector('.lpl-peche__aiguille');
    const deg = Number(
      /rotate\(([-\d.]+)\)/.exec(needle?.getAttribute('transform') ?? '')?.[1] ?? 0,
    );
    key('KeyA', deg > 9);
    key('KeyD', deg < -9);
    key('Space', peche?.classList.contains('lpl-peche--souffle') === true && Math.abs(deg) < 18);
  } else {
    for (const code of [...held]) key(code, false);
  }
}

let last = performance.now();
let accumulator = 0;
function loop(t: number): void {
  const dt = Math.min(0.25, (t - last) / 1000);
  last = t;
  accumulator += dt;
  while (accumulator >= SIM_DT) {
    accumulator -= SIM_DT;
    step(sim, [idleInput(sim.world.tick), idleInput(sim.world.tick)], queue.splice(0));
    for (const event of sim.events) for (const listener of listeners) listener(event);
  }
  if (robot) drive(dt);
  draw();
  ui.frame(dt);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
