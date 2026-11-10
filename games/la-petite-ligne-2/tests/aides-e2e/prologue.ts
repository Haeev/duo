// Aides du parcours P19 (partie neuve, prologue entier): deux joueurs qui marchent au clavier
// (planification sur la carte du lieu, lue dans ses données, jamais de position en dur), lisent
// les répliques, passent par l'éditeur de personnage, et un journal de tout ce qui cloche.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Duo, ProbePlayer, ProbeWorld, Side } from './duo';
import { CAPTURES } from './duo';

const PLACES = join(import.meta.dirname, '../../donnees/lieux');
const PROPS = join(import.meta.dirname, '../../donnees/commun/meubles');

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Un meuble de la carte, avec les briques de sa fiche (ce qu'on peut y faire). */
export interface MapObject extends Point {
  readonly id: string;
  readonly type: string;
  readonly rotation: number;
  readonly bricks: readonly string[];
}

export interface PlaceMap {
  readonly width: number;
  readonly height: number;
  /** Cases bloquées: les murs de la carte et l'emprise des meubles solides. */
  readonly blocked: readonly { x: number; y: number; w: number; h: number }[];
  readonly points: Readonly<Record<string, Point>>;
  readonly objects: readonly MapObject[];
}

interface PropFile {
  readonly id: string;
  readonly size: { readonly w: number; readonly h: number };
  readonly solid: boolean;
  readonly bricks: readonly { readonly brick: string }[];
}

function loadProps(): Map<string, PropFile> {
  const props = new Map<string, PropFile>();
  for (const name of readdirSync(PROPS)) {
    if (!name.endsWith('.json')) continue;
    const prop = JSON.parse(readFileSync(join(PROPS, name), 'utf8')) as PropFile;
    props.set(prop.id, prop);
  }
  return props;
}

/**
 * La carte d'un lieu, lue dans ses données (les points ont des identifiants stables). Les meubles
 * solides comptent parmi les cases bloquées, par la même règle que le jeu (`noyau/obstacles.ts`:
 * toute case que leur emprise touche): un wagon dont les parois sont des meubles se planifie ainsi.
 */
export function loadMap(place: string): PlaceMap {
  const raw = JSON.parse(readFileSync(join(PLACES, place, 'carte.json'), 'utf8')) as Omit<
    PlaceMap,
    'objects'
  > & { readonly objects?: readonly Omit<MapObject, 'bricks'>[] };
  const props = loadProps();
  const blocked = [...raw.blocked];
  const objects: MapObject[] = [];
  const edge = 1e-6;
  for (const o of raw.objects ?? []) {
    const def = props.get(o.type);
    objects.push({ ...o, bricks: def?.bricks.map((b) => b.brick) ?? [] });
    if (def?.solid !== true) continue;
    const w = o.rotation % 2 === 0 ? def.size.w : def.size.h;
    const h = o.rotation % 2 === 0 ? def.size.h : def.size.w;
    const x0 = Math.floor(o.x - w / 2 + edge);
    const y0 = Math.floor(o.y - h / 2 + edge);
    blocked.push({
      x: x0,
      y: y0,
      w: Math.floor(o.x + w / 2 - edge) - x0 + 1,
      h: Math.floor(o.y + h / 2 - edge) - y0 + 1,
    });
  }
  return { ...raw, blocked, objects };
}

/** Une étape de quête telle qu'écrite: sa phrase et sa cible (point de la carte ou habitant). */
export interface QuestStep {
  readonly id: string;
  readonly objective: string;
  readonly target: { readonly point?: string; readonly villager?: string } | null;
}

/** Les étapes d'une suite d'un lieu, lues dans ses données. */
export function loadSteps(place: string, quest: string): readonly QuestStep[] {
  const line = JSON.parse(readFileSync(join(PLACES, place, 'quetes', `${quest}.json`), 'utf8')) as {
    readonly chapters: readonly { readonly steps: readonly QuestStep[] }[];
  };
  return line.chapters.flatMap((c) => c.steps);
}

function isFree(map: PlaceMap, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return false;
  return !map.blocked.some((b) => cx >= b.x && cx < b.x + b.w && cy >= b.y && cy < b.y + b.h);
}

/**
 * Où se tenir près d'un endroit (habitant, meuble): les centres des `count` cases libres les plus
 * proches, hors des cases où quelqu'un se tient déjà (`taken`). Vide si rien n'est libre à 3 m.
 */
export function standSpots(
  map: PlaceMap,
  at: Point,
  count: number,
  taken: readonly Point[] = [],
): Point[] {
  const spots: { p: Point; d: number }[] = [];
  for (let cy = Math.floor(at.y) - 3; cy <= Math.floor(at.y) + 3; cy++)
    for (let cx = Math.floor(at.x) - 3; cx <= Math.floor(at.x) + 3; cx++) {
      if (!isFree(map, cx, cy)) continue;
      const p = { x: cx + 0.5, y: cy + 0.5 };
      if (taken.some((t) => Math.floor(t.x) === cx && Math.floor(t.y) === cy)) continue;
      spots.push({ p, d: Math.hypot(p.x - at.x, p.y - at.y) });
    }
  return spots
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((s) => s.p);
}

export function point(map: PlaceMap, id: string): Point {
  const p = map.points[id];
  if (p === undefined) throw new Error(`point « ${id} » absent de la carte`);
  return p;
}

/**
 * Chemin de cases (centres) entre deux points, en 8 directions sans couper un coin. Nul si la
 * carte ne laisse aucun passage: c'est alors un défaut de la carte, pas du parcours.
 */
export function planPath(
  map: PlaceMap,
  from: Point,
  to: Point,
  avoid: readonly Point[] = [],
): Point[] | null {
  const free = (cx: number, cy: number): boolean => {
    if (cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) return false;
    // Un habitant barre le passage: on le contourne (sauf si c'est le but lui-même).
    if (
      avoid.some(
        (a) =>
          Math.hypot(a.x - (cx + 0.5), a.y - (cy + 0.5)) < 0.85 &&
          Math.hypot(a.x - to.x, a.y - to.y) > 1.2,
      )
    )
      return false;
    return isFree(map, cx, cy);
  };
  const key = (cx: number, cy: number): number => cy * map.width + cx;
  const start = { x: Math.floor(from.x), y: Math.floor(from.y) };
  const goal = { x: Math.floor(to.x), y: Math.floor(to.y) };
  const prev = new Map<number, number>([[key(start.x, start.y), -1]]);
  const queue: { x: number; y: number }[] = [start];
  // La file grandit pendant le parcours: un `for...of` voit les ajouts.
  for (const cur of queue) {
    if (cur.x === goal.x && cur.y === goal.y) break;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!free(nx, ny) || prev.has(key(nx, ny))) continue;
      if (dx !== 0 && dy !== 0 && (!free(cur.x + dx, cur.y) || !free(cur.x, cur.y + dy))) continue;
      prev.set(key(nx, ny), key(cur.x, cur.y));
      queue.push({ x: nx, y: ny });
    }
  }
  if (!prev.has(key(goal.x, goal.y))) return null;
  const cells: Point[] = [];
  for (let k = key(goal.x, goal.y); k !== -1; k = prev.get(k) ?? -1)
    cells.push({ x: (k % map.width) + 0.5, y: Math.floor(k / map.width) + 0.5 });
  cells.reverse();
  return [...cells.slice(1, -1), to];
}

export type Gravity = 'bloquant' | 'majeur' | 'mineur' | 'cosmétique' | 'note';

export interface Finding {
  readonly gravity: Gravity;
  readonly title: string;
  readonly detail: string;
  readonly shot?: string;
}

/** Journal du parcours: défauts, durées par étape, relevés, écrits dans `p19-releves.txt`. */
export class Journal {
  readonly findings: Finding[] = [];
  readonly timings: { label: string; seconds: number }[] = [];
  private readonly seen = new Set<string>();
  private readonly file: string;
  private readonly t0 = Date.now();
  private mark = Date.now();

  constructor(name = 'p19-releves.txt') {
    this.file = join(CAPTURES, name);
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, '');
  }

  log(text: string): void {
    appendFileSync(this.file, `[${((Date.now() - this.t0) / 1000).toFixed(1)} s] ${text}\n`);
  }

  /** Un défaut; `once` évite de répéter le même relevé à chaque image. */
  find(gravity: Gravity, title: string, detail: string, shot?: string): void {
    const id = `${title}|${detail}`;
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.findings.push({ gravity, title, detail, ...(shot === undefined ? {} : { shot }) });
    this.log(
      `${gravity.toUpperCase()} ${title}: ${detail}${shot === undefined ? '' : ` (${shot})`}`,
    );
  }

  /** Clôt une étape: durée depuis la précédente. */
  lap(label: string): void {
    const seconds = (Date.now() - this.mark) / 1000;
    this.mark = Date.now();
    this.timings.push({ label, seconds });
    this.log(`ÉTAPE ${label}: ${seconds.toFixed(1)} s`);
  }

  elapsed(): number {
    return (Date.now() - this.t0) / 1000;
  }
}

/** Ce que voit un joueur à l'écran, relevé en une fois dans la page du jeu. */
export interface UiSnapshot {
  readonly editor: boolean;
  readonly dialogue: {
    readonly text: string;
    readonly speaker: string;
    readonly choices: readonly string[];
    readonly typing: boolean;
  } | null;
  readonly scene: {
    readonly text: string;
    readonly speaker: string;
    readonly reads: string;
    readonly wait: string;
    readonly only: boolean;
    readonly typing: boolean;
  } | null;
  readonly sceneOther: boolean;
  readonly fin: boolean;
  readonly prompt: string;
  readonly notice: string;
  readonly clock: string;
  /** Textes cassés relevés dans l'interface visible: balises d'accord, espaces réservés, coupures. */
  readonly broken: readonly string[];
}

export async function snapshot(side: Side): Promise<UiSnapshot> {
  return await side.game().evaluate(() => {
    const visible = (e: Element | null): e is HTMLElement =>
      e instanceof HTMLElement && !e.hidden && e.checkVisibility();
    const txt = (e: Element | null): string => (e?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const q = (s: string): HTMLElement | null => document.querySelector<HTMLElement>(s);
    const editor = visible(q('.lpl-ui .lpl-ed'));
    const dlgLayer = q('.lpl-ui .dialogue');
    const dialogue = visible(dlgLayer)
      ? {
          text: txt(dlgLayer.querySelector('.dlg__text')),
          speaker: txt(dlgLayer.querySelector('.dlg__plate')),
          choices: Array.from(dlgLayer.querySelectorAll('.choice')).map((c) => txt(c)),
          typing:
            dlgLayer.querySelectorAll('.choice').length === 0 &&
            !visible(dlgLayer.querySelector('.dlg__next')),
        }
      : null;
    const sceneBand = q('.lpl-ui .scene-line');
    const scene = visible(sceneBand)
      ? {
          text: txt(sceneBand.querySelector('.dlg__text')),
          speaker: txt(sceneBand.querySelector('.dlg__plate')),
          reads: txt(sceneBand.querySelector('.scene-line__reads')),
          wait: txt(sceneBand.querySelector('.scene-line__wait')),
          only: visible(sceneBand.querySelector('.scene-line__only')),
          typing: !visible(sceneBand.querySelector('.dlg__next')),
        }
      : null;
    const broken: string[] = [];
    const rawTag = /\[\[|\]\]|\{[a-z]+\}|undefined|null|NaN|\[object/;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.lpl-ui *'))) {
      if (!el.checkVisibility() || el.children.length > 0 || el.closest('.lpl-ed__grid') !== null)
        continue;
      const t = txt(el);
      if (t === '') continue;
      if (rawTag.test(t)) broken.push(`balise ou valeur brute: « ${t.slice(0, 80)} »`);
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1)
        broken.push(`hors de l'écran: « ${t.slice(0, 60)} » (${el.className})`);
      else if (
        (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) &&
        getComputedStyle(el).overflow !== 'visible'
      )
        broken.push(`texte coupé: « ${t.slice(0, 60)} » (${el.className})`);
    }
    return {
      editor,
      dialogue,
      scene,
      sceneOther: visible(q('.lpl-ui .scene-other')),
      fin: visible(q('.lpl-ui .fin')),
      prompt: txt(visible(q('.lpl-ui .prompt')) ? q('.lpl-ui .prompt') : null),
      notice: txt(visible(q('.lpl-ui .notice')) ? q('.lpl-ui .notice') : null),
      clock: txt(q('.lpl-ui .hud-clock')),
      broken,
    };
  });
}

/** Une machine et son joueur dans le monde. */
export interface Seat {
  readonly side: Side;
  readonly index: number;
}

export async function seats(duo: Duo): Promise<readonly [Seat, Seat]> {
  return [
    { side: duo.host, index: await duo.host.local() },
    { side: duo.guest, index: await duo.guest.local() },
  ];
}

export function me(world: ProbeWorld, seat: Seat): ProbePlayer {
  const p = world.players[seat.index];
  if (p === undefined) throw new Error('joueur absent du monde');
  return p;
}

/** Ce que fait un joueur devant l'interface; renvoie ce qu'il a fait (pour le journal). */
export interface UiContext {
  readonly journal: Journal;
  /** Nom de la capture quand un défaut d'affichage est relevé. */
  readonly slug: string;
  /** Genre à choisir dans l'éditeur, par rôle (les accords sont ensuite relus). */
  readonly gender: Readonly<Record<'hôte' | 'invité', 'Femme' | 'Homme'>>;
  /** Mémoire des répliques vues (texte -> instant de la première vue). */
  readonly shown: Map<string, number>;
  readonly lines: {
    who: string;
    kind: 'scène' | 'dialogue';
    text: string;
    ms: number;
    at: number;
  }[];
  /** Dernière réplique suivie par machine (le texte s'écrit lettre par lettre: il grandit). */
  readonly current: Map<string, { entry: UiContext['lines'][number]; since: number }>;
}

/** Suit la réplique affichée: une nouvelle réplique commence quand le texte n'est plus la suite du précédent. */
function track(
  ctx: UiContext,
  side: Side,
  kind: 'scène' | 'dialogue',
  text: string,
): { seenMs: number; fresh: boolean } {
  const key = `${side.who}:${kind}`;
  const cur = ctx.current.get(key);
  const grows =
    cur !== undefined && (text.startsWith(cur.entry.text) || cur.entry.text.startsWith(text));
  if (cur === undefined || !grows) {
    const entry = { who: side.who, kind, text, ms: 0, at: Date.now() };
    ctx.lines.push(entry);
    ctx.current.set(key, { entry, since: Date.now() });
    return { seenMs: 0, fresh: true };
  }
  if (text.length > cur.entry.text.length) cur.entry.text = text;
  cur.entry.ms = Date.now() - cur.since;
  return { seenMs: Date.now() - cur.since, fresh: false };
}

const dwell = (text: string): number => Math.min(2200, 500 + text.length * 22);

/**
 * Un tour de lecture pour un joueur: referme l'éditeur, lit la réplique de scène ou de dialogue,
 * valide la fin de chapitre. Renvoie vrai si le joueur a fait quelque chose.
 */
export async function playUi(side: Side, ctx: UiContext): Promise<boolean> {
  const s = await snapshot(side);
  // Les bandeaux glissent à l'ouverture: on ne juge leur place qu'une fois posés.
  const tracked =
    s.scene !== null
      ? track(ctx, side, 'scène', s.scene.text)
      : s.dialogue !== null
        ? track(ctx, side, 'dialogue', s.dialogue.text)
        : null;
  if (tracked === null) {
    ctx.current.delete(`${side.who}:scène`);
    ctx.current.delete(`${side.who}:dialogue`);
  }
  const settling = tracked !== null && tracked.seenMs < 900;
  // Un défaut d'affichage doit durer: on ne le retient qu'après trois relevés d'affilée.
  const streak = ctx.shown.get(`casse:${side.who}`) ?? 0;
  const current = settling ? [] : s.broken;
  ctx.shown.set(`casse:${side.who}`, current.length > 0 ? streak + 1 : 0);
  if (streak + 1 >= 3)
    for (const b of current) {
      const shot = await side.shot(`defaut-${ctx.lines.length}-${side.who}`);
      ctx.journal.find('mineur', 'texte cassé à l’écran', `${side.who}: ${b}`, shot);
    }
  if (s.editor) {
    const first = !ctx.shown.has(`editeur:${side.who}`);
    if (first) {
      ctx.shown.set(`editeur:${side.who}`, Date.now());
      await side.shot('editeur-ouvert');
      const gender = ctx.gender[side.who];
      await side
        .game()
        .locator('.lpl-ed__grid')
        .getByText(gender, { exact: true })
        .first()
        .click({ timeout: 8000, force: true })
        .catch((e: unknown) => {
          ctx.journal.find(
            'mineur',
            'éditeur: case du genre introuvable',
            `${side.who}: pas de case « ${gender} » (${String(e).slice(0, 120)})`,
          );
        });
      await side.page.waitForTimeout(500);
      await side.shot('editeur-genre');
    }
    await side
      .game()
      .locator('.lpl-ed__button--primary')
      .click({ timeout: 8000, force: true })
      .catch((e: unknown) => {
        ctx.journal.find(
          'majeur',
          'éditeur: « Valider » introuvable',
          `${side.who}: ${String(e).slice(0, 160)}`,
        );
      });
    await side.page.waitForTimeout(800);
    return true;
  }
  if (s.scene !== null) {
    if (s.scene.typing || (tracked?.seenMs ?? 0) < dwell(s.scene.text)) {
      await side.page.waitForTimeout(250);
      return true;
    }
    await side.press('Space');
    await side.page.waitForTimeout(350);
    return true;
  }
  if (s.dialogue !== null) {
    if (s.dialogue.typing || (tracked?.seenMs ?? 0) < dwell(s.dialogue.text)) {
      await side.page.waitForTimeout(250);
      return true;
    }
    await side.press(s.dialogue.choices.length > 0 ? 'Enter' : 'Space');
    await side.page.waitForTimeout(350);
    return true;
  }
  if (s.fin) {
    await side.shot('fin-de-chapitre');
    await side.press('Enter');
    await side.page.waitForTimeout(500);
    return true;
  }
  return false;
}

/**
 * Deux places pour deux joueurs: chacun prend celle qui évite de se croiser dans un couloir d'un
 * mètre (la répartition dont le plus long des deux trajets est le plus court).
 */
export async function shareSpots(
  duo: Duo,
  map: PlaceMap,
  spots: readonly Point[],
  avoid: readonly Point[] = [],
): Promise<readonly [Point, Point]> {
  const [a, b] = spots;
  if (a === undefined || b === undefined) throw new Error('il faut deux places libres');
  const w = await duo.host.world();
  if (w === null) throw new Error('monde absent');
  const [first, second] = await seats(duo);
  const cost = (seat: Seat, to: Point): number =>
    planPath(map, me(w, seat).body, to, avoid)?.length ?? Number.POSITIVE_INFINITY;
  const straight = Math.max(cost(first, a), cost(second, b));
  const crossed = Math.max(cost(first, b), cost(second, a));
  return straight <= crossed ? [a, b] : [b, a];
}

export interface WalkResult {
  /** Par joueur: arrivé, ou bloqué (aucun chemin sur la carte, ou aucun progrès pendant 3 s). */
  readonly state: readonly [WalkState, WalkState];
}
export type WalkState = 'arrivé' | 'bloqué' | 'sans cible' | 'trop long';

const STUCK_MS = 5000;
/** Distance au but sous laquelle on avance par petits pas, et durée d'un appui (ms). */
const NEAR_M = 1.2;
const PULSE_MS = 160;
/** Dernier lacet de caméra déduit, par machine: il survit d'une marche à l'autre. */
const YAW = new WeakMap<Side, number>();

/**
 * Marche des deux joueurs, chacun au clavier de sa machine. Le déplacement est relatif à la
 * caméra: le lacet se déduit du dernier déplacement observé et de la commande donnée.
 */
export async function walkBoth(
  duo: Duo,
  targets: readonly [Point | null, Point | null],
  options: {
    readonly map: PlaceMap;
    readonly journal: Journal;
    readonly label: string;
    readonly timeoutMs?: number;
    readonly tolerance?: number;
    /** Chemin libre: ignore la carte et marche droit vers la cible (pour constater un blocage). */
    readonly straight?: boolean;
    /** Points à contourner (habitants). */
    readonly avoid?: readonly Point[];
    /** La marche n'a plus lieu d'être (étape franchie, lieu quitté): on s'arrête, arrivés. */
    readonly stop?: (w: ProbeWorld) => boolean;
  },
): Promise<WalkResult> {
  const { map, journal } = options;
  const tolerance = options.tolerance ?? 0.55;
  const timeout = options.timeoutMs ?? 40_000;
  const duoSeats = await seats(duo);
  const state: WalkState[] = targets.map((t) => (t === null ? 'sans cible' : 'trop long'));
  const held: Set<string>[] = [new Set(), new Set()];
  const yaw = [YAW.get(duoSeats[0].side) ?? 0, YAW.get(duoSeats[1].side) ?? 0];
  const last: (Point | null)[] = [null, null];
  const paths: Point[][] = [[], []];
  const stuckSince = [0, 0];
  const t0 = Date.now();
  await Promise.all(
    duoSeats.map((seat) =>
      seat.side.game().evaluate(() => {
        window.focus();
        document.body.focus();
      }),
    ),
  );
  const setKeys = async (i: number, want: ReadonlySet<string>): Promise<void> => {
    const seat = duoSeats[i];
    const mine = held[i];
    if (seat === undefined || mine === undefined) return;
    for (const key of [...mine])
      if (!want.has(key)) {
        await seat.side.page.keyboard.up(key);
        mine.delete(key);
      }
    for (const key of want)
      if (!mine.has(key)) {
        await seat.side.page.keyboard.down(key);
        mine.add(key);
      }
  };
  const initial = await duo.host.world();
  const initialGuest = initial;
  for (const [i, seat] of duoSeats.entries()) {
    const target = targets[i];
    const w = i === 0 ? initial : initialGuest;
    if (target === null || target === undefined || w === null) continue;
    const here = me(w, seat).body;
    const route =
      options.straight === true ? [target] : planPath(map, here, target, options.avoid ?? []);
    if (route === null) {
      state[i] = 'bloqué';
      journal.log(`aucun chemin sur la carte (${options.label}, joueur ${String(i)})`);
    } else paths[i] = route;
  }
  try {
    for (;;) {
      // Positions lues chez l'hôte (autorité): la vue de l'invité sur son propre corps est en retard.
      const w = await duo.host.world();
      if (w !== null && options.stop?.(w) === true) {
        for (const [i, st] of state.entries()) if (st !== 'sans cible') state[i] = 'arrivé';
        break;
      }
      for (const [i, seat] of duoSeats.entries()) {
        const target = targets[i];
        if (state[i] !== 'trop long' || target === null || target === undefined || w === null)
          continue;
        const here = me(w, seat).body;
        const path = paths[i] ?? [];
        while (
          path.length > 1 &&
          Math.hypot((path[0]?.x ?? 0) - here.x, (path[0]?.y ?? 0) - here.y) < 0.4
        )
          path.shift();
        const remaining = Math.hypot(target.x - here.x, target.y - here.y);
        if (remaining < tolerance) {
          state[i] = 'arrivé';
          await setKeys(i, new Set());
          continue;
        }
        const before = last[i] ?? null;
        if (before === null || Math.hypot(here.x - before.x, here.y - before.y) > 0.06)
          last[i] = { x: here.x, y: here.y };
        const goal = path[0] ?? target;
        const psi = Math.atan2(goal.y - here.y, goal.x - here.x) - (yaw[i] ?? 0);
        const s = Math.cos(psi);
        const f = -Math.sin(psi);
        const want = new Set<string>();
        if (f > 0.38) want.add('w');
        if (f < -0.38) want.add('s');
        if (s > 0.38) want.add('d');
        if (s < -0.38) want.add('a');
        if (remaining > 4) want.add('Shift');
        await setKeys(i, want);
        // Près du but, de petits pas: en rendu logiciel une image dure jusqu'à un quart de seconde
        // de jeu, une touche tenue ferait dépasser la cible de près d'un mètre.
        if (remaining < NEAR_M) {
          await seat.side.page.waitForTimeout(PULSE_MS);
          await setKeys(i, new Set());
        }
        const moved = before === null || Math.hypot(here.x - before.x, here.y - before.y) > 0.02;
        stuckSince[i] = moved ? 0 : stuckSince[i] === 0 ? Date.now() : (stuckSince[i] ?? 0);
        if (stuckSince[i] !== 0 && Date.now() - (stuckSince[i] ?? 0) > STUCK_MS) {
          state[i] = 'bloqué';
          await setKeys(i, new Set());
          journal.log(
            `bloqué en ${here.x.toFixed(2)}; ${here.y.toFixed(2)} (${options.label}, joueur ${String(i)})`,
          );
        }
      }
      if (state.every((st) => st !== 'trop long')) break;
      if (Date.now() - t0 > timeout) break;
      await duo.host.page.waitForTimeout(120);
    }
  } finally {
    for (const [i, seat] of duoSeats.entries()) YAW.set(seat.side, yaw[i] ?? 0);
    await setKeys(0, new Set());
    await setKeys(1, new Set());
  }
  return { state: [state[0] ?? 'sans cible', state[1] ?? 'sans cible'] };
}

/**
 * Lacet de la caméra de chaque machine, déduit d'un pas en arrière (touche S, vers le bas de l'écran, qui reste dans la pièce): l'écran
 * tourne le déplacement. À faire une fois en terrain dégagé; les entrées de l'invité arrivent
 * avec du retard en rendu logiciel, d'où l'attente avant de lire la position.
 */
export async function calibrateYaw(duo: Duo, journal: Journal): Promise<void> {
  const duoSeats = await seats(duo);
  const before = await duo.host.world();
  if (before === null) throw new Error('monde absent');
  await Promise.all(
    duoSeats.map((seat) =>
      seat.side.game().evaluate(() => {
        window.focus();
        document.body.focus();
      }),
    ),
  );
  // Dans un couloir d'un mètre, un pas de biais glisse le long des parois: une seule touche ne
  // dit pas le lacet. Deux touches (arrière, puis droite) départagent les huit lacets possibles
  // (la caméra repose sur des multiples de 45 degrés): on garde celui qui explique le mieux les
  // deux déplacements, glissement compris.
  const moves: { key: string; from: ProbeWorld; to: ProbeWorld }[] = [];
  let from = before;
  for (const key of ['s', 'd']) {
    await Promise.all(duoSeats.map((seat) => seat.side.page.keyboard.down(key)));
    await duo.host.page.waitForTimeout(1000);
    await Promise.all(duoSeats.map((seat) => seat.side.page.keyboard.up(key)));
    await duo.host.page.waitForTimeout(2500);
    const to = await duo.host.world();
    if (to === null) throw new Error('monde absent');
    moves.push({ key, from, to });
    from = to;
  }
  for (const seat of duoSeats) {
    let best = 0;
    let bestScore = Number.NEGATIVE_INFINITY;
    const seen: string[] = [];
    for (let k = 0; k < 8; k++) {
      const yaw = (k * Math.PI) / 4;
      let score = 0;
      for (const move of moves) {
        const a = me(move.from, seat).body;
        const b = me(move.to, seat).body;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (k === 0) seen.push(`${move.key}: ${dx.toFixed(2)}; ${dy.toFixed(2)}`);
        if (d < 0.15) continue;
        // Arrière: (-sin, cos). Droite: (cos, sin) (`entrees/commandes.ts`).
        const vx = move.key === 's' ? -Math.sin(yaw) : Math.cos(yaw);
        const vy = move.key === 's' ? Math.cos(yaw) : Math.sin(yaw);
        score += (dx * vx + dy * vy) / d;
      }
      if (score > bestScore + 1e-6) {
        bestScore = score;
        best = yaw;
      }
    }
    YAW.set(seat.side, best);
    journal.log(
      `lacet de caméra ${seat.side.who}: ${best.toFixed(2)} rad (déplacements ${seen.join(' | ')})`,
    );
  }
}

/**
 * Se tourner vers un point par petits pas, comme un joueur qui rectifie son cap: un appui bref
 * vers lui puis une pause pour laisser arriver le résultat (les entrées sont en retard ici).
 */
export async function tapToward(
  duo: Duo,
  seat: Seat,
  at: Point,
  aimed: () => Promise<boolean>,
  journal: Journal,
  maxTaps = 6,
): Promise<void> {
  for (let n = 0; n < maxTaps && !(await aimed()); n++) {
    const w = await duo.host.world();
    if (w === null) return;
    const here = me(w, seat).body;
    const yaw = YAW.get(seat.side) ?? 0;
    const psi = Math.atan2(at.y - here.y, at.x - here.x) - yaw;
    const s = Math.cos(psi);
    const f = -Math.sin(psi);
    const keys: string[] = [];
    if (f > 0.38) keys.push('w');
    if (f < -0.38) keys.push('s');
    if (s > 0.38) keys.push('d');
    if (s < -0.38) keys.push('a');
    await seat.side.game().evaluate(() => {
      window.focus();
      document.body.focus();
    });
    journal.log(
      `TAP ${seat.side.who} ${keys.join('')} depuis ${here.x.toFixed(2)},${here.y.toFixed(2)} cap ${here.facing.toFixed(2)} lacet ${yaw.toFixed(2)}`,
    );
    for (const k of keys) await seat.side.page.keyboard.down(k);
    await seat.side.page.waitForTimeout(170);
    for (const k of keys) await seat.side.page.keyboard.up(k);
    await seat.side.page.waitForTimeout(1000);
  }
}

/**
 * Agir sur une cible comme un joueur qui lit la bulle: tant que la touche d'action ne vise pas ce
 * qu'on veut (`aimed`), se tourner vers lui par petits pas; quand elle le vise, appuyer. S'arrête
 * dès que `done` est vrai. Un appui tombé entre deux images se perd: on recommence.
 */
export async function actOn(
  duo: Duo,
  seat: Seat,
  at: Point,
  aimed: () => Promise<boolean>,
  done: () => Promise<boolean>,
  journal: Journal,
  tries = 8,
): Promise<boolean> {
  for (let n = 0; n < tries && !(await done()); n++) {
    if (!(await aimed())) {
      await windowSize(duo, true);
      await tapToward(duo, seat, at, aimed, journal, 3);
      await windowSize(duo, false);
      continue;
    }
    await seat.side.press('Space', 400);
    await seat.side.page.waitForTimeout(2500);
  }
  return await done();
}

const FULL = { width: 960, height: 540 } as const;
const SMALL = { width: 320, height: 180 } as const;

/**
 * Rapetisse les deux fenêtres pendant la marche: le rendu logiciel coûte par pixel, et à
 * 960 x 540 le jeu tourne à 2 images par seconde (le temps du jeu passe alors au ralenti).
 * À remettre en taille réelle avant de lire l'écran ou de le capturer.
 */
export async function windowSize(duo: Duo, small: boolean): Promise<void> {
  const size = small ? SMALL : FULL;
  await Promise.all([duo.host.page.setViewportSize(size), duo.guest.page.setViewportSize(size)]);
  await duo.host.page.waitForTimeout(small ? 400 : 1200);
}
