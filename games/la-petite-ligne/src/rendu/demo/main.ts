/**
 * Page de démonstration du rendu seul (`rendu.html`): charge la carte du level
 * designer et un état d'exemple, sans simulation ni réseau. Sert à travailler
 * le rendu, et aux captures de Playwright.
 *
 * Paramètres de l'adresse: `heure` (10.5 ou 17:15), `meteo` (sunny, cloudy,
 * rain), `orientation` (0 à 3), `zoom` (0 à 2), `interieur` (1), `repare` (1),
 * `train` (away, arriving, stopped, departing), `vie` (0 fige la promenade),
 * `panneau` (1 montre les réglages), `x` et `y` (point de vue), `rendu=leger`
 * (mode léger, comme le jeu), `cycles` (essai d'endurance), `repere=1`,
 * `peche=attente|touche`, `absent=1` (signes P1),
 * `scene=rencontre|place|repas|banc|banc-quai` (petites scènes, dont les deux joueurs assis au quai), `coins=1` (coin à soi des
 * deux joueurs, avec `interieur=1`), `moment=<id>` (moment rare: `heron`, `geese`, `ladder`, `tits`,
 * `fox`, `glowworms`) avec `t=<s>` (instant de l'apogée, figé), `phase=attente|apres` et `joue=1`
 * (la chorégraphie avance depuis `t`); l'heure par défaut est alors dans la fenêtre du moment.
 * `vue=x,y` pose la caméra sur un point sans déplacer les joueurs; `noms=1`: Camille connaît le nom
 * des poules (étiquettes au-dessus d'elles, chez elle seule). `jour=<n>` ou
 * `saison=printemps|ete|automne|hiver` (tour 8: palette et lumière de la saison; le même jour de
 * la saison, les âges des souches gardés), `brume=1` (brume du matin, levée de 9 h à 10 h 30). Tour 9:
 * `chantiers=tous|<ids>`, `cadeaux=1`, `outil=<objet>`, `maison9=1`, `cueillette9=1`,
 * `assis=gue|pignon|ponton` (voir `tour9-exemple.ts`). Pêche de la 0.12: `peche12=1`, avec
 * `coin=<id>`, `guet=1`, `approche=1` (voir `peche12-exemple.ts`). Touches: G repère, J lancer,
 * K poisson pris, L poisson échappé.
 */
import { applyBreedingExample } from './elevage-exemple';
import type { CameraCommand } from '../camera';
import { loadContent } from '../../donnees/contenu';
import { MAP_FILES } from '../../donnees/cartes-fichiers';
import { CONTENT_FILES } from '../../donnees/fichiers';
import { loadMap } from '../../donnees/carte';
import type { GameMap } from '../../etat/carte';
import type { CharacterId, WorldEvent } from '../../etat/types';
import type { GameView } from '../../etat/vue';
import { RenderEngine } from '../moteur';
import {
  DEMO_ACTIONS,
  DEMO_SCENES,
  animateExampleWorld,
  createExampleWorld,
  type DemoOptions,
} from './etat-exemple';
import { applyEdgeExample } from './lisiere-exemple';
import { applyTour9Example } from './tour9-exemple';
import { applyTour10Example } from './tour10-exemple';
import { createPeche12Demo } from './peche12-exemple';
import { dayOfSeason, SEASONS } from '../../donnees/calendrier';
import type { Wear, WorldState } from '../../etat/types';

const MINUTES_PER_HOUR = 60;
const DEFAULT_MINUTES = 10.5 * MINUTES_PER_HOUR;
/** Minutes de jeu par seconde réelle quand « le temps passe » (accéléré pour voir la journée). */
const DEMO_MINUTES_PER_SECOND = 12;
const MINUTES_PER_DAY = 1440;
const WALK_SPEED = 3.5;
const ENDURANCE_FRAMES = 30;
/** Geste de houe de la démo: 0,5 s à 30 pas par seconde, comme la simulation. */
const HOE_TICKS = 15;
const MAX_STEP = 0.1;
const MS_PER_SECOND = 1000;
/** Durée d'un repère (15 s) à 30 pas par seconde. */
const PIN_TICKS = 450;
const ENDURANCE_FPS = 60;
/** Noms des poules d'Odette (`habitants.json`), pour les étiquettes de la démonstration. */
const HEN_NAMES = ['Bichette', 'Cocotte', 'la Duchesse'];
/** Moment de la démonstration: l'heure par défaut, tant de minutes après l'ouverture de sa fenêtre. */
const MOMENT_MINUTES_IN = 20;
/** Noms des saisons dans l'adresse (`saison=`), dans l'ordre du calendrier. */
const SEASON_PARAMS = ['printemps', 'ete', 'automne', 'hiver'] as const;

/**
 * `jour=<n>` ou `saison=<nom>`: change le jour de l'exemple. Les arbres abattus gardent leur âge
 * (souche, rejet), pour comparer les saisons au même état du bourg.
 */
function applyDemoDay(world: WorldState, params: URLSearchParams, content: ReturnType<typeof loadContent>): void {
  const current = world.clock.day;
  let day = current;
  const asked = Number(params.get('jour'));
  const season = SEASON_PARAMS.indexOf(params.get('saison') as (typeof SEASON_PARAMS)[number]);
  if (params.has('jour') && Number.isInteger(asked) && asked >= 1) {
    day = asked;
  } else if (season >= 0 && season < SEASONS.length) {
    day = season * content.settings.calendar.seasonDays + dayOfSeason(content.settings, current);
  }
  const shift = day - current;
  world.clock.day = day;
  for (const tree of world.trees) {
    if (tree.felledDay !== null) tree.felledDay += shift;
  }
  if (params.get('brume') === '1') world.morningMist = true;
}

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
  return loadMap(MAP_FILES).map;
}

interface DemoHandle {
  ready: boolean;
  stats(): ReturnType<RenderEngine['detailedStats']>;
  missing(): string[];
  breakdown(detail?: boolean): Record<string, number>;
  programs(): string[];
  /** Programmes utilisés par la scène dans l'état courant (hors variantes en cache). */
  programsInUse(): number;
  /** Triangles d'une image, passe d'ombre à part. */
  triangleSplit(): ReturnType<RenderEngine['triangleSplit']>;
  /** Qualité en vigueur et palier de résolution (essai du repli automatique, `adaptatif=1`). */
  quality(): { mode: 'normal' | 'light'; scale: number; pixelRatio: number };
  /** Avance la page d'une image de `dt` secondes (mode `manuel=1`). */
  advance(dt: number): void;
  /** Envoie un événement au rendu comme la simulation (captures: prise d'un poisson). */
  emit(event: WorldEvent): void;
  pick(x: number, y: number): ReturnType<RenderEngine['pick']>;
  destination(): { x: number; y: number } | null;
  frames: number;
  /** Monde affiché, pour les planches d'animation (mode `manuel=1`). */
  world(): WorldState;
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
  const momentId = params.get('moment');
  const momentDef = content.moments.find((m) => m.id === momentId);
  const phaseParam = params.get('phase');
  const moment: DemoOptions['moment'] =
    momentDef === undefined
      ? undefined
      : {
          id: momentDef.id,
          phase: phaseParam === 'attente' ? 'waiting' : phaseParam === 'apres' ? 'after' : 'climax',
          t: Math.max(0, Number(params.get('t') ?? '0') || 0),
        };
  const options: DemoOptions = {
    minutes:
      momentDef !== undefined && !params.has('heure')
        ? momentDef.window.from + MOMENT_MINUTES_IN
        : parseHour(params.get('heure')),
    weather: weatherParam === 'rain' || weatherParam === 'cloudy' ? weatherParam : 'sunny',
    inside: params.get('interieur') === '1',
    repaired: params.get('repare') === '1',
    train:
      params.get('train') === 'away' ||
      params.get('train') === 'arriving' ||
      params.get('train') === 'departing'
        ? (params.get('train') as 'away' | 'arriving' | 'departing')
        : 'stopped',
    pin: params.get('repere') === '1',
    fishing:
      params.get('peche') === 'touche'
        ? 'bite'
        : params.get('peche') === 'attente'
          ? 'waiting'
          : 'none',
    absent: params.get('absent') === '1',
    scene: DEMO_SCENES.find((scene) => scene === params.get('scene')),
    corners: params.get('coins') === '1',
    handcarParked: params.get('draisine') === 'posee',
    moment,
    bedRotation: Number(params.get('lit') ?? '0') || 0,
    fishingSpot: params.get('peche_lieu') ?? undefined,
    tool: params.get('outil') ?? undefined,
    toolAction: DEMO_ACTIONS.find((action) => action === params.get('geste')),
  };
  const world = createExampleWorld(map, content, options);
  // `lisiere=1` (tour 8): souche, rejets et cueillettes posées un jour d'été.
  if (params.get('lisiere') === '1') applyEdgeExample(world, map, content);
  applyDemoDay(world, params, content);
  // Tour 9: chantiers, cadeaux, outils, objets de maison, cueillettes, assis (`tour9-exemple.ts`).
  applyTour9Example(world, map, content, params);
  if (params.get('marche') === '1') {
    // `marche=1` (0.12): l'étal posé et garni, la balance achetée, la sacoche de Lucie au banc du quai.
    world.flags.push('market_open', 'stall_six_slots');
    world.market = {
      day: world.clock.day,
      level: 'fair',
      stall: [
        { item: 'radish', quality: 'ordinary', count: 6 },
        { item: 'egg', quality: 'ordinary', count: 4 },
        { item: 'blackberry_jam', quality: 'ordinary', count: 2 },
        { item: 'fresh_cheese', quality: 'ordinary', count: 2 },
        { item: 'carrot', quality: 'ordinary', count: 3 },
      ],
      buyers: [],
    };
    world.cellar.push({ item: 'market_scale', quality: 'ordinary', count: 1 });
    world.mail = { day: world.clock.day, items: [{ kind: 'letter', to: 'basile', taken: false, delivered: false }], carryOver: 0 };
  }
  if (params.get('noms') === '1') {
    // `noms=1`: Camille connaît le nom des poules (étiquettes chez elle seule, quête des noms).
    world.hens.forEach((hen, index) => {
      hen.name = HEN_NAMES[index] ?? hen.name;
      hen.nameKnownBy = ['p1'];
    });
  }
  const focusX = Number(params.get('x'));
  const focusY = Number(params.get('y'));
  const p1 = world.characters[0];
  if (
    p1 !== undefined &&
    params.has('x') &&
    params.has('y') &&
    Number.isFinite(focusX) &&
    Number.isFinite(focusY)
  ) {
    p1.pos = { x: focusX, y: focusY };
    p1.prev = { x: focusX, y: focusY };
  }
  // Tour 10: intérieurs, ru, pièces, rideaux, rangement, coiffures (`tour10-exemple.ts`), après `x` et `y`.
  applyTour10Example(world, map, content, params);
  // 0.12: `tenue=complete`, les deux joueurs habillés de pied en cap (mesure du budget de triangles).
  if (params.get('tenue') === 'complete') {
    const full: Wear[] = [
      { top: 'pull_moutarde', bottom: 'pantalon_bleu', shoes: 'bottes_jaunes', outer: 'cire_marine', hat: 'bonnet_rouge' },
      { top: 'chemise_lin', bottom: 'jupe_prune', shoes: 'bottines_brunes', outer: 'veste_brune', hat: 'paille_ruban_rouge' },
    ];
    world.characters.forEach((c, i) => {
      const wear = full[i];
      if (wear !== undefined) c.appearance.wear = wear;
    });
  }
  // 0.12: l'élevage (`elevage=1`, ou `elevage=mene` pour la chèvre menée), après `x` et `y`.
  const breeding = params.get('elevage');
  if (breeding !== null) applyBreedingExample(world, map, breeding);
  const listeners = new Set<(event: WorldEvent) => void>();
  const local: CharacterId = 'p1';
  const peche12 = createPeche12Demo(params, local);
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

  const cycles = Number(params.get('cycles') ?? '0');
  if (cycles > 0) {
    await endurance(cycles, view, container);
    loading?.remove();
    return;
  }

  const engine = new RenderEngine({
    view,
    container,
    reducedMotion: false,
    showStats: params.get('stats') !== '0',
    quality: params.get('rendu') === 'leger' ? 'light' : 'normal',
    // Captures reproductibles: qualité fixe, sauf `adaptatif=1` (essai du repli automatique).
    adaptive: params.get('adaptatif') === '1',
    ...(peche12 === null ? {} : { fishing: peche12.source }),
  });
  const handle: DemoHandle = {
    ready: false,
    stats: () => engine.detailedStats(),
    missing: () => engine.missingModels(),
    breakdown: (detail?: boolean) => engine.breakdown(detail === true),
    programs: () => engine.programList(),
    programsInUse: () => engine.programsInUse(),
    triangleSplit: () => engine.triangleSplit(),
    quality: () => ({
      mode: engine.renderQuality(),
      scale: engine.resolutionScale(),
      pixelRatio: engine.pixelRatio(),
    }),
    advance: () => undefined,
    emit: (event: WorldEvent) => {
      emit(event);
    },
    pick: (x: number, y: number) => engine.pick(x, y),
    destination: () => world.characters[0]?.destination ?? null,
    frames: 0,
    world: () => world,
  };
  window.lplRendu = handle;
  await engine.load(() => undefined);
  loading?.remove();
  if (params.get('repli') === '1') {
    // `adaptatif=1&repli=1`: image d'un PC à la peine (dernier palier, ombres coupées).
    engine.forceQualityFallback();
  }
  const focus = /^(-?[\d.]+),(-?[\d.]+)$/.exec(params.get('vue') ?? '');
  if (focus !== null) {
    // `vue=x,y`: caméra posée sur ce point (gros plans), les joueurs restent où ils sont.
    engine.setFocusOverride({ x: Number(focus[1]), y: Number(focus[2]) });
  }
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
  // `largeur=<m>` (tour 10): gros plan des captures (coiffures, rideaux), de 2 à 36 m.
  const inspect = Number(params.get('largeur'));
  if (params.has('largeur') && Number.isFinite(inspect) && inspect >= 2 && inspect <= 36) {
    engine.inspect(inspect);
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
      // Comme la simulation: un geste de houe à durée, l'événement au pas de l'appui.
      me.action = { kind: 'till', since: world.tick, duration: HOE_TICKS, target: null };
      me.speed = 0;
      emit({ type: 'tilled', by: 'p1', cell });
    } else if (event.code === 'KeyT') {
      const tree = world.trees[1];
      if (tree !== undefined) {
        tree.hits += 1;
        tree.lastHitTick = world.tick;
        tree.felled = tree.hits >= 3;
        emit({ type: 'chop', by: 'p1', tree: tree.id, felled: tree.felled });
      }
    } else if (event.code === 'KeyG') {
      const pos = { x: me.pos.x + Math.cos(me.facing) * 2, y: me.pos.y + Math.sin(me.facing) * 2 };
      me.pin = { pos, since: world.tick, until: world.tick + PIN_TICKS };
      emit({ type: 'pin', by: 'p1', pos });
    } else if (event.code === 'KeyJ' || event.code === 'KeyK' || event.code === 'KeyL') {
      const angler = world.characters[1];
      const line = angler?.fishing ?? null;
      if (angler !== undefined && line !== null) {
        if (event.code === 'KeyJ') {
          emit({ type: 'cast', by: 'p2', at: { ...line.bobber } });
        } else if (event.code === 'KeyK') {
          angler.fishing = null;
          // 0.12: la longueur tirée (`cm`), lue par le rendu du poisson tenu.
          const caught = { type: 'caught', by: 'p2', item: 'trout', cm: 38 } as const;
          emit(caught);
        } else {
          angler.fishing = null;
          emit({ type: 'escaped', by: 'p2' });
        }
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
  const guestLike = params.get('invite') === '1';
  const playMoment = params.get('joue') === '1';
  if (playMoment && world.moments.today !== null) {
    world.moments.today.paused = false;
  }
  const step = (dt: number): void => {
    seconds += dt;
    const today = world.moments.today;
    if (playMoment && today !== null && momentDef !== undefined && today.phase === 'climax') {
      // `joue=1`: la chorégraphie avance comme dans la simulation (temps de jeu en secondes).
      today.elapsed = Math.min(momentDef.climax.seconds, today.elapsed + dt);
    }
    if (autoInput?.checked === true) {
      world.clock.minutes = (world.clock.minutes + dt * DEMO_MINUTES_PER_SECOND) % MINUTES_PER_DAY;
      if (hourInput !== null) {
        hourInput.value = String(world.clock.minutes);
      }
    }
    const me = world.characters[0];
    const moveUp =
      (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) -
      (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
    const moveRight =
      (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) -
      (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
    const steering = moveUp !== 0 || moveRight !== 0;
    for (const event of animateExampleWorld(
      world,
      map,
      seconds,
      lifeInput?.checked !== false && !steering,
      options,
    )) {
      emit(event);
    }
    if (me !== undefined && steering) {
      // Z Q S D tournés selon la caméra: la convention de `cameraYaw` (ETAT.md, demande 1).
      const yaw = engine.cameraYaw();
      const dx = Math.cos(yaw) * moveUp + Math.cos(yaw + Math.PI / 2) * moveRight;
      const dy = Math.sin(yaw) * moveUp + Math.sin(yaw + Math.PI / 2) * moveRight;
      const length = Math.hypot(dx, dy);
      me.prev = { ...me.pos };
      me.pos = {
        x: me.pos.x + (dx / length) * WALK_SPEED * dt,
        y: me.pos.y + (dy / length) * WALK_SPEED * dt,
      };
      me.facing = Math.atan2(dy, dx);
      me.speed = WALK_SPEED;
      me.action = { kind: 'walk', since: 0, duration: 0, target: null };
    } else if (me?.action.kind === 'walk' && lifeInput?.checked === false) {
      me.prev = { ...me.pos };
      me.speed = 0;
      // `invite=1`: comme chez l'invité, l'état complet dit encore « marche » après l'arrêt.
      if (!guestLike) {
        me.action = { kind: 'idle', since: 0, duration: 0, target: null };
      }
    }
    if (
      me !== undefined &&
      me.action.duration > 0 &&
      world.tick >= me.action.since + me.action.duration
    ) {
      me.action = { kind: 'idle', since: 0, duration: 0, target: null };
    }
    peche12?.step(world, dt);
    engine.frame(dt);
    handle.frames += 1;
  };
  const loop = (now: number): void => {
    step(Math.min(MAX_STEP, (now - last) / MS_PER_SECOND));
    last = now;
    window.requestAnimationFrame(loop);
  };
  // `manuel=1`: le temps n'avance que par `lplRendu.advance(dt)` (planches d'images successives).
  handle.advance = (dt: number): void => {
    step(dt);
  };
  handle.ready = true;
  if (!params.has('manuel')) {
    window.requestAnimationFrame(loop);
  }
}

/** Mémoire du tas JavaScript (Chromium seulement), en octets. */
function heapBytes(): number {
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return memory?.usedJSHeapSize ?? 0;
}

/** Résultat de l'essai d'endurance (`?cycles=N`), lu par Playwright. */
interface EnduranceReport {
  cycles: number;
  geometries: number[];
  textures: number[];
  heap: number[];
  canvases: number;
}

/**
 * Essai d'endurance: crée le rendu, dessine, le libère, `cycles` fois de
 * suite. Chaque tour doit retrouver les mêmes nombres de géométries et de
 * textures, et ne laisser aucun canevas derrière lui.
 */
async function endurance(cycles: number, view: GameView, container: HTMLElement): Promise<void> {
  const report: EnduranceReport = {
    cycles: 0,
    geometries: [],
    textures: [],
    heap: [],
    canvases: 0,
  };
  (window as Window & { lplEndurance?: EnduranceReport }).lplEndurance = report;
  for (let i = 0; i < cycles; i += 1) {
    const engine = new RenderEngine({ view, container, reducedMotion: false, showStats: false });
    await engine.load(() => undefined);
    for (let frame = 0; frame < ENDURANCE_FRAMES; frame += 1) {
      engine.frame(1 / ENDURANCE_FPS);
    }
    const stats = engine.detailedStats();
    report.geometries.push(stats.geometries);
    report.textures.push(stats.textures);
    engine.dispose();
    report.heap.push(heapBytes());
    report.cycles = i + 1;
  }
  report.canvases = container.querySelectorAll('canvas').length;
}

void main();
