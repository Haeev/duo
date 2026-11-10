/**
 * Page de démonstration du rendu seul (lot L4): ni réseau ni simulation. Elle fabrique un monde à
 * partir des vraies données, le montre par une `GameView` de façade et joue ce que les autres lots
 * apporteront: le déplacement (sans collisions) et la visée (`PlayerState.aim`, que la simulation
 * du lot L2 calculera). Les murs, le toit et les arbres d'essai sont des volumes fabriqués ici:
 * les cartes ne décrivent pas encore de bâtiments.
 *
 * Touches (lues par `KeyboardEvent.code`, donc AZERTY): Z Q S D marcher, Maj courir, A et E
 * tourner la caméra, flèches haut et bas ou molette zoomer, bouton droit glissé tourner,
 * N avancer d'une heure, L changer de lieu, 1 à 4 préréglages Auto, Haute, Moyenne, Basse.
 *
 * Paramètres d'URL: `lieu`, `x`, `y`, `cap` (degrés), `lacet` (degrés), `largeur` (m), `minute`,
 * `qualite` (auto, high, medium, low), `vise` (identifiant visé imposé), `panneau=0`.
 */
import { loadContent } from '../../donnees/charger';
import { DATA_FILES } from '../../donnees/fichiers';
import type { WorldState } from '../../etat/monde';
import type { GameView } from '../../session';
import { createPlaceState, createWorld } from '../../simulation/noyau/monde';
import { createRenderer, gameDecorModels, type RenderStats, type SceneVolume } from '../index';
import { type GraphicsPreset, DEFAULT_GRAPHICS_OPTIONS } from '../options';

const SEED = 7;
const PLAYER_COLORS = ['#d9654f', '#4f8fd9'] as const;
const PRESETS: readonly GraphicsPreset[] = ['auto', 'high', 'medium', 'low'];

/** Maison d'essai: quatre murs (une porte au sud) et un toit, pour voir le fondu sous tous les angles. */
function demoHouse(x: number, y: number, w: number, h: number): SceneVolume[] {
  const wall = { model: null, base: 0, height: 2.6, shape: 'box', rotation: 0 } as const;
  const flags = { occludes: true, aimable: false, color: '#ebdcbf' } as const;
  const t = 0.3;
  const door = 1.2;
  const side = (w - door) / 2;
  return [
    { id: 'demo-mur-nord', x: x + w / 2, y: y + t / 2, w, h: t, ...wall, ...flags },
    { id: 'demo-mur-ouest', x: x + t / 2, y: y + h / 2, w: t, h, ...wall, ...flags },
    { id: 'demo-mur-est', x: x + w - t / 2, y: y + h / 2, w: t, h, ...wall, ...flags },
    { id: 'demo-mur-sud-a', x: x + side / 2, y: y + h - t / 2, w: side, h: t, ...wall, ...flags },
    {
      id: 'demo-mur-sud-b',
      x: x + w - side / 2,
      y: y + h - t / 2,
      w: side,
      h: t,
      ...wall,
      ...flags,
    },
    {
      id: 'demo-toit',
      model: null,
      x: x + w / 2,
      y: y + h / 2,
      w: w + 0.6,
      h: h + 0.6,
      rotation: 0,
      base: 2.6,
      height: 0.35,
      shape: 'box',
      color: '#b86b4f',
      occludes: true,
      aimable: false,
    },
  ];
}

/** Arbre d'essai: un tronc et un houppier en boule de mousse (bible 7.1). */
function demoTree(id: string, x: number, y: number): SceneVolume[] {
  const common = { model: null, x, y, rotation: 0, aimable: false } as const;
  return [
    {
      id: `${id}-tronc`,
      ...common,
      w: 0.35,
      h: 0.35,
      base: 0,
      height: 1.7,
      shape: 'post',
      color: '#7a5a3f',
      occludes: false,
    },
    {
      id: `${id}-houppier`,
      ...common,
      w: 2.6,
      h: 2.6,
      base: 1.4,
      height: 2.4,
      shape: 'ball',
      color: '#7f9c79',
      occludes: true,
    },
  ];
}

function demoExtras(): readonly SceneVolume[] {
  return [
    ...demoHouse(22, 24, 6, 5),
    ...demoTree('demo-arbre-a', 16, 25),
    ...demoTree('demo-arbre-b', 31, 31),
  ];
}

export interface DemoApi {
  ready: boolean;
  /** Vrai si WebGL2 manque: la page affiche le repli. */
  fallback: boolean;
  stats(): RenderStats | null;
  /** Dix bascules de lieu, compteurs avant et après (contrôle de fuite). */
  leakTest(): { before: RenderStats; after: RenderStats } | null;
}

declare global {
  interface Window {
    demo: DemoApi;
  }
}

const api: DemoApi = { ready: false, fallback: false, stats: () => null, leakTest: () => null };
window.demo = api;

const canvas = document.getElementById('scene');
const panel = document.getElementById('panneau');
if (!(canvas instanceof HTMLCanvasElement) || panel === null) throw new Error('page incomplète');

const params = new URLSearchParams(window.location.search);
const numberParam = (name: string): number | null => {
  const raw = params.get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
};

const content = loadContent(DATA_FILES);
const world: WorldState = createWorld(content, SEED, [
  { id: 'demo-a', name: 'Joueur 1' },
  { id: 'demo-b', name: 'Joueur 2' },
]);
const placeIds = Object.keys(content.places).sort();
const firstPlace = world.common.place;

function enterPlace(id: string): void {
  const place = content.places[id];
  if (place === undefined) return;
  world.places[id] ??= createPlaceState(content, place);
  world.common.place = id;
  const arrival = place.map.points[place.def.station.arrival];
  if (arrival === undefined) return;
  world.players[0].body.x = arrival.x - 0.8;
  world.players[0].body.y = arrival.y;
  world.players[1].body.x = arrival.x + 0.8;
  world.players[1].body.y = arrival.y;
  world.players[0].aim = null;
}

const wantedPlace = params.get('lieu');
if (wantedPlace !== null && wantedPlace !== firstPlace) enterPlace(wantedPlace);
const me = world.players[0];
me.body.x = numberParam('x') ?? me.body.x;
me.body.y = numberParam('y') ?? me.body.y;
const heading = numberParam('cap');
if (heading !== null) me.body.facing = (heading * Math.PI) / 180;
world.minutes = numberParam('minute') ?? world.minutes;
const forcedAim = params.get('vise');

const view: GameView = {
  content,
  role: 'host',
  world: () => world,
  frame: () => world,
  // La visée simulée de la page (`me.aim`), sous la forme que rend la simulation.
  aim: (player) => {
    const id = world.players[player].aim;
    return id === null
      ? null
      : { kind: 'prop', id, action: 'talk', verb: '', refusal: null, x: 0, y: 0 };
  },
  localIndex: () => 0,
  send: () => undefined,
  onEvent: () => () => undefined,
};

await gameDecorModels().ready;
const presetParam = PRESETS.find((p) => p === params.get('qualite')) ?? 'auto';
const renderer = createRenderer({
  canvas,
  view,
  playerColors: PLAYER_COLORS,
  graphics: { ...DEFAULT_GRAPHICS_OPTIONS, preset: presetParam },
  extras: (placeId) => (placeId === firstPlace ? demoExtras() : []),
});

if (renderer === null) {
  api.fallback = true;
  api.ready = true;
  panel.textContent = 'WebGL2 indisponible: le jeu afficherait son écran de repli.';
} else {
  const yawParam = numberParam('lacet');
  const widthParam = numberParam('largeur');
  if (yawParam !== null || widthParam !== null)
    renderer.setCamera(yawParam ?? 45, widthParam ?? 14);
  if (params.get('panneau') === '0') panel.hidden = true;

  const keys = new Set<string>();
  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    if (event.code.startsWith('Arrow') || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'KeyN') world.minutes = (world.minutes + 60) % 1440;
    if (event.code === 'KeyL') {
      const next = placeIds[(placeIds.indexOf(world.common.place) + 1) % placeIds.length];
      if (next !== undefined) enterPlace(next);
    }
    const preset = PRESETS[Number(event.code.replace('Digit', '')) - 1];
    if (event.code.startsWith('Digit') && preset !== undefined)
      renderer.setGraphics({ ...renderer.graphics(), preset });
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      renderer.pushCameraInput({ ...heldCamera(), wheel: Math.sign(event.deltaY) });
    },
    { passive: false },
  );
  canvas.addEventListener('pointermove', (event) => {
    if ((event.buttons & 2) !== 0)
      renderer.pushCameraInput({ ...heldCamera(), dragPixels: event.movementX });
  });

  const held = (code: string): number => (keys.has(code) ? 1 : 0);
  const heldCamera = (): { turn: number; zoom: number } => ({
    turn: held('KeyE') - held('KeyQ'),
    zoom: held('ArrowUp') - held('ArrowDown'),
  });

  /** Ce que la simulation (lot L2) fera: marcher dans le repère de la carte, sans collisions ici. */
  const walk = (dt: number): void => {
    const right = held('KeyD') - held('KeyA');
    const up = held('KeyW') - held('KeyS');
    const moving = right !== 0 || up !== 0;
    const { walkSpeed, runSpeed } = content.settings.movement;
    const speed = moving ? (keys.has('ShiftLeft') ? runSpeed : walkSpeed) : 0;
    me.body.speed = speed;
    if (!moving) return;
    const norm = Math.hypot(right, up);
    const move = renderer.moveToWorld(right / norm, up / norm);
    me.body.x += move.x * speed * dt;
    me.body.y += move.y * speed * dt;
    me.body.facing = Math.atan2(move.y, move.x);
  };

  /** Visée simulée: l'objet de la carte ou l'habitant le plus proche, à portée et devant soi. */
  const aim = (): void => {
    if (forcedAim !== null) {
      me.aim = forcedAim;
      return;
    }
    const place = content.places[world.common.place];
    const state = world.places[world.common.place];
    if (place === undefined || state === undefined) return;
    const { action, aimHalfAngleDeg } = content.settings.reach;
    let best: string | null = null;
    let bestDistance = action;
    const consider = (id: string, x: number, y: number): void => {
      const dx = x - me.body.x;
      const dy = y - me.body.y;
      const distance = Math.hypot(dx, dy);
      if (distance > bestDistance) return;
      const off = Math.atan2(dy, dx) - me.body.facing;
      const angle = Math.abs(Math.atan2(Math.sin(off), Math.cos(off)));
      if (distance > 0.6 && angle > (aimHalfAngleDeg * Math.PI) / 180) return;
      best = id;
      bestDistance = distance;
    };
    for (const object of place.map.objects) consider(object.id, object.x, object.y);
    for (const [id, villager] of Object.entries(state.villagers))
      consider(id, villager.body.x, villager.body.y);
    me.aim = best;
  };

  const describe = (stats: RenderStats): string =>
    [
      `lieu ${stats.place ?? 'aucun'}, ${String(Math.floor(world.minutes / 60))} h ${String(Math.floor(world.minutes % 60)).padStart(2, '0')}, qualité ${renderer.graphics().preset}`,
      `lacet ${((renderer.cameraYaw() * 180) / Math.PI).toFixed(0)} degrés, visée ${me.aim ?? 'aucune'}`,
      `${String(stats.calls)} appels, ${String(stats.triangles)} triangles, ${String(stats.programs)} programmes`,
      `${String(stats.geometries)} géométries, ${String(stats.textures)} textures, ${String(stats.volumes)} volumes dont ${String(stats.standIns)} provisoires, ${String(stats.fading)} en fondu`,
      `tampon ${String(stats.width)} x ${String(stats.height)}, ombres ${stats.shadows ? 'oui' : 'non'}, ${stats.frameMs.toFixed(1)} ms par image`,
    ].join('\n');

  api.stats = () => renderer.stats();
  api.leakTest = () => {
    const home = world.common.place;
    const other = placeIds.find((id) => id !== home);
    if (other === undefined) return null;
    // Même point de vue avant et après (le point d'arrivée): Three.js ne compte que ce qu'il a
    // dessiné, la comparaison n'a de sens qu'à vue égale. Deux images: les fondus se posent.
    const settle = (): RenderStats => {
      enterPlace(home);
      for (let i = 0; i < 40; i += 1) renderer.frame(1 / 60);
      return renderer.stats();
    };
    // Un aller-retour d'abord: la mesure de départ se fait sur un lieu fraîchement chargé.
    enterPlace(other);
    renderer.frame(1 / 60);
    const before = settle();
    for (let i = 0; i < 10; i += 1) {
      enterPlace(i % 2 === 0 ? other : home);
      renderer.frame(1 / 60);
    }
    return { before, after: settle() };
  };

  let last = performance.now();
  let frames = 0;
  const tick = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    walk(dt);
    aim();
    renderer.pushCameraInput(heldCamera());
    renderer.frame(dt);
    frames += 1;
    if (!panel.hidden && frames % 10 === 0) panel.textContent = describe(renderer.stats());
    // Quelques images pour que les fondus et la caméra soient en place avant une capture.
    if (frames === 30) api.ready = true;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
