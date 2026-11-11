// Aides des parcours du contenu d'Aubrune (commerce, maison, endurance, décision, nuit, récolte):
// marche au clavier avec une caméra cadrée plein nord (lacet 0: Z monte vers le nord, D va à
// l'est, comme le suppose `walkBoth`), entrée par une porte, appuis jusqu'à une condition du
// monde, lecture du HUD. `LPL2_STRICT=1`: une marche impossible fait échouer le parcours au lieu
// d'être contournée par une mise en place (téléportation), comptée alors comme défaut.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Duo, ProbeWorld, Side } from './duo';
import {
  loadMap,
  me,
  seats,
  standSpots,
  tapToward,
  walkBoth,
  windowSize,
  type Journal,
  type PlaceMap,
  type Point,
  type Seat,
  type UiContext,
} from './prologue';

export const STRICT = process.env.LPL2_STRICT === '1';

/** Annexe des intérieurs d'Aubrune: tout ce qui est au sud de cette ligne est dans une pièce. */
export const ANNEX_Y = 208;

interface ProbeExtra {
  __lplSonde?: Record<string, ((...args: unknown[]) => unknown) | undefined>;
}

/** Appelle une méthode de la sonde de cette machine (réglages chez l'hôte seulement). */
export async function probeCall(side: Side, method: string, ...args: unknown[]): Promise<unknown> {
  return await side
    .game()
    .evaluate(([m, a]) => (window as unknown as ProbeExtra).__lplSonde?.[m]?.(...a) ?? null, [
      method,
      args,
    ] as const);
}

/**
 * Cadre la vue des deux machines plein nord (lacet 0, `width` mètres) et attend que le lieu soit
 * construit et ses tuiles chargées chez les deux. Les fenêtres restent petites (320 x 180) pour
 * tout le parcours: en rendu logiciel sur une machine chargée, une vue de 960 x 540 qui charge
 * ses tuiles (départ, caméra tournée) réveillait le chien de garde du faux hôte (« Le jeu ne
 * répond plus », plus de 5 s sans battement).
 */
export async function settle(duo: Duo, place: string, width = 14): Promise<void> {
  await windowSize(duo, true);
  for (const side of [duo.host, duo.guest]) await probeCall(side, 'setCamera', 0, width);
  for (const side of [duo.host, duo.guest]) {
    const t0 = Date.now();
    for (;;) {
      const stats = (await probeCall(side, 'stats')) as {
        readonly place: string | null;
        readonly tiles: { readonly pending: number } | null;
      } | null;
      if (stats?.place === place && (stats.tiles?.pending ?? 0) === 0) break;
      if (Date.now() - t0 > 120_000) throw new Error(`lieu « ${place} » pas prêt (${side.who})`);
      await side.page.waitForTimeout(1000);
    }
  }
  await duo.host.page.waitForTimeout(1500);
}

/**
 * Capture d'une machine en taille réelle (960 x 540): la fenêtre ne grandit que le temps de la
 * capture, le reste du parcours se joue en petite fenêtre (voir `settle`).
 */
export async function shot(side: Side, name: string): Promise<string> {
  await side.page.setViewportSize({ width: 960, height: 540 });
  await side.page.waitForTimeout(2500);
  const path = await side.shot(name);
  await side.page.setViewportSize({ width: 320, height: 180 });
  return path;
}

export function newUiContext(journal: Journal, slug: string): UiContext {
  return {
    journal,
    slug,
    gender: { hôte: 'Homme', invité: 'Femme' },
    shown: new Map(),
    lines: [],
    current: new Map(),
  };
}

/**
 * Mise en place explicite (permise en mode strict): place un joueur au début d'une étape, pour
 * ne pas traverser le bourg au clavier. Sur cette machine partagée, la simulation de l'hôte
 * tourne au quinzième du temps réel pendant le rendu logiciel (10 h -> 10 h 14 en 3 min): une
 * marche de 40 m y prenait plus de trois minutes. Le geste étudié (porte, comptoir, action) se
 * joue toujours au clavier.
 */
export async function placeAt(
  duo: Duo,
  journal: Journal,
  player: number,
  at: Point,
  label: string,
  facing?: number,
): Promise<void> {
  journal.log(
    `mise en place: joueur ${String(player)} en ${String(at.x)}; ${String(at.y)} (${label})`,
  );
  await duo.teleport(player, at.x, at.y, facing);
  await duo.until(
    duo.host,
    `mise en place (${label})`,
    (w) =>
      Math.hypot((w.players[player]?.body.x ?? 0) - at.x, (w.players[player]?.body.y ?? 0) - at.y) <
      0.2,
  );
}

interface InteriorFile {
  readonly at: Point;
  readonly width: number;
  readonly height: number;
  readonly blocked: readonly { x: number; y: number; w: number; h: number }[];
  readonly doors: Readonly<Record<string, Point>>;
  readonly objects: readonly {
    readonly id: string;
    readonly type: string;
    readonly x: number;
    readonly y: number;
    readonly rotation: number;
    readonly when?: unknown;
  }[];
}

interface PropFile {
  readonly size: { readonly w: number; readonly h: number };
  readonly solid: boolean;
  readonly bricks: readonly { readonly brick: string }[];
}

/**
 * La carte d'un lieu avec ses intérieurs: `carte.json` ne décrit que le dehors et une annexe vide
 * (au sud de `outdoor`); les pièces viennent de `interieurs/<id>.json`, posées en `at`. Hors des
 * pièces, l'annexe est bloquée; dans une pièce, ses cases bloquées et ses meubles solides
 * (ceux qui ont une condition `when` sont supposés absents: une cuisinière pas encore posée).
 */
export function loadMapWithInteriors(place: string): PlaceMap {
  const base = loadMap(place);
  const root = join(import.meta.dirname, '../../donnees');
  const dir = join(root, 'lieux', place, 'interieurs');
  const rooms = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as InteriorFile);
  const outdoorH =
    (base as PlaceMap & { readonly outdoor?: { readonly h: number } }).outdoor?.h ?? base.height;
  const blocked = [...base.blocked];
  const inRoom = (cx: number, cy: number): boolean =>
    rooms.some(
      (r) => cx >= r.at.x && cx < r.at.x + r.width && cy >= r.at.y && cy < r.at.y + r.height,
    );
  for (let cy = outdoorH; cy < base.height; cy++) {
    let from: number | null = null;
    for (let cx = 0; cx <= base.width; cx++) {
      const wall = cx < base.width && !inRoom(cx, cy);
      if (wall && from === null) from = cx;
      if (!wall && from !== null) {
        blocked.push({ x: from, y: cy, w: cx - from, h: 1 });
        from = null;
      }
    }
  }
  const props = join(root, 'commun', 'meubles');
  const objects = [...base.objects];
  const edge = 1e-6;
  for (const r of rooms) {
    for (const b of r.blocked) blocked.push({ ...b, x: b.x + r.at.x, y: b.y + r.at.y });
    for (const o of r.objects) {
      const def = JSON.parse(readFileSync(join(props, `${o.type}.json`), 'utf8')) as PropFile;
      const x = o.x + r.at.x;
      const y = o.y + r.at.y;
      objects.push({
        id: o.id,
        type: o.type,
        x,
        y,
        rotation: o.rotation,
        bricks: def.bricks.map((b) => b.brick),
      });
      if (!def.solid || o.when !== undefined) continue;
      const w = o.rotation % 2 === 0 ? def.size.w : def.size.h;
      const h = o.rotation % 2 === 0 ? def.size.h : def.size.w;
      const x0 = Math.floor(x - w / 2 + edge);
      const y0 = Math.floor(y - h / 2 + edge);
      blocked.push({
        x: x0,
        y: y0,
        w: Math.floor(x + w / 2 - edge) - x0 + 1,
        h: Math.floor(y + h / 2 - edge) - y0 + 1,
      });
    }
  }
  // Les portes des pièces aussi: les éviter en marchant (`doorCells`), sinon on ressort.
  const doors: Record<string, Point> = {
    ...(base as PlaceMap & { readonly doors?: Readonly<Record<string, Point>> }).doors,
  };
  for (const r of rooms)
    for (const [id, d] of Object.entries(r.doors)) doors[id] = { x: d.x + r.at.x, y: d.y + r.at.y };
  return { ...base, blocked, objects, doors } as PlaceMap;
}

/** Cases des portes d'un lieu (`doors` de `carte.json`, dehors comme dedans). */
export function doorCells(map: PlaceMap): Point[] {
  const doors = (map as PlaceMap & { readonly doors?: Readonly<Record<string, Point>> }).doors;
  return Object.values(doors ?? {}).map((d) => ({ x: d.x, y: d.y }));
}

/**
 * Marche au clavier des deux joueurs (`null`: ce joueur ne bouge pas). Hors du mode strict, une
 * marche qui n'aboutit pas est finie par une mise en place, notée comme défaut au journal.
 */
export async function walk(
  duo: Duo,
  journal: Journal,
  map: PlaceMap,
  targets: readonly [Point | null, Point | null],
  label: string,
  options: { readonly tolerance?: number; readonly timeoutMs?: number } = {},
): Promise<void> {
  await windowSize(duo, true);
  const result = await walkBoth(duo, targets, {
    map,
    journal,
    label,
    tolerance: options.tolerance ?? 0.45,
    timeoutMs: options.timeoutMs ?? 60_000,
    // Les cases des portes ne sont pas des passages: y marcher fait entrer dans la pièce.
    avoid: doorCells(map),
  });
  const [seatH, seatG] = await seats(duo);
  const end = await duo.host.world();
  if (end !== null)
    journal.log(
      `marche « ${label} »: ${result.state.join(', ')}; hôte ${me(end, seatH).body.x.toFixed(1)}; ${me(end, seatH).body.y.toFixed(1)}, invité ${me(end, seatG).body.x.toFixed(1)}; ${me(end, seatG).body.y.toFixed(1)}`,
    );
  for (const [i, seat] of [seatH, seatG].entries()) {
    const target = targets[i];
    const state = result.state[i];
    if (target === null || target === undefined || state === 'arrivé') continue;
    const text = `marche « ${label} » (${seat.side.who}): ${state ?? '?'}`;
    if (STRICT) throw new Error(text);
    journal.find('majeur', 'contournement', text);
    await duo.teleport(seat.index, target.x, target.y);
  }
}

/** Tient des touches (noms Playwright) sur une machine jusqu'à une condition du monde de l'hôte. */
export async function holdUntil(
  duo: Duo,
  side: Side,
  keys: readonly string[],
  done: (w: ProbeWorld) => boolean,
  timeoutMs = 15_000,
): Promise<boolean> {
  await side.game().evaluate(() => {
    window.focus();
    document.body.focus();
  });
  for (const key of keys) await side.page.keyboard.down(key);
  const t0 = Date.now();
  let ok = false;
  try {
    while (Date.now() - t0 < timeoutMs) {
      const w = await duo.host.world();
      if (w !== null && done(w)) {
        ok = true;
        break;
      }
      await side.page.waitForTimeout(150);
    }
  } finally {
    for (const key of keys) await side.page.keyboard.up(key);
  }
  return ok;
}

/**
 * Passer une porte au clavier: se placer dans l'axe de la porte (à `step` de sa case, du côté
 * opposé à `key`), puis tenir la touche vers elle jusqu'à changer de côté (`inside`). La case
 * d'une porte fait un mètre: un joueur arrêté à 0,7 m de l'axe pousse le mur; on se recale et on
 * réessaie, comme un joueur.
 */
export async function passDoor(
  duo: Duo,
  journal: Journal,
  map: PlaceMap,
  seat: Seat,
  door: Point,
  key: 'w' | 'a' | 's' | 'd',
  inside: (w: ProbeWorld) => boolean,
): Promise<boolean> {
  const away = ({ w: [0, 1], s: [0, -1], a: [1, 0], d: [-1, 0] } as const)[key];
  const approach = { x: door.x + away[0] * 1.1, y: door.y + away[1] * 1.1 };
  for (let attempt = 0; attempt < 3; attempt++) {
    const targets: [Point | null, Point | null] =
      seat.side === duo.host ? [approach, null] : [null, approach];
    await walk(duo, journal, map, targets, `devant la porte (${seat.side.who})`, {
      tolerance: 0.2,
    });
    const before = await doorReport(duo, seat, door);
    if (await holdUntil(duo, seat.side, [key], inside, 15_000)) return true;
    journal.log(
      `porte pas passée (${seat.side.who}, essai ${String(attempt + 1)}): parti de ${before}; resté en ${await doorReport(duo, seat, door)}`,
    );
    await seat.side.shot(`porte-pas-passee-${String(attempt + 1)}`);
  }
  return false;
}

/** Relevé devant une porte: où est le joueur chez l'hôte, et qui se tient à moins de 2 m d'elle. */
async function doorReport(duo: Duo, seat: Seat, door: Point): Promise<string> {
  const w = await duo.host.world();
  if (w === null) return 'monde absent';
  const here = me(w, seat).body;
  const near = [
    ...w.players.map((p, i) => ({ id: `joueur ${String(i)}`, body: p.body })),
    ...Object.entries(w.places[w.common.place]?.villagers ?? {}).map(([id, v]) => ({
      id,
      body: v.body,
    })),
  ]
    .filter((b) => Math.hypot(b.body.x - door.x, b.body.y - door.y) < 2)
    .map((b) => `${b.id} ${b.body.x.toFixed(2)}; ${b.body.y.toFixed(2)}`);
  return `${here.x.toFixed(2)}; ${here.y.toFixed(2)} (près de la porte: ${near.join(', ') || 'personne'})`;
}

/** Ce que vise la touche d'action de ce joueur, vu de sa machine. */
export async function aimOf(
  seat: Seat,
): Promise<{ id?: string; verb?: string; refusal?: string | null } | null> {
  return await seat.side.aim(seat.index);
}

/**
 * Ce que vise ce joueur quand sa machine et l'hôte sont d'accord (même cible, même verbe), `null`
 * sinon. La machine de l'invité prédit son propre corps: juste après un petit pas, sa bulle peut
 * montrer une cible que l'hôte, qui fait autorité, ne lui donne pas (le pas s'est perdu en route);
 * la touche d'action n'y ferait rien.
 */
export async function agreedAim(
  duo: Duo,
  seat: Seat,
): Promise<{ id?: string; verb?: string; refusal?: string | null } | null> {
  const mine = await aimOf(seat);
  if (seat.side === duo.host) return mine;
  const theirs = await duo.host.aim(seat.index);
  return mine !== null && mine.id === theirs?.id && mine.verb === theirs?.verb ? mine : null;
}

/**
 * Se tourner par petits pas vers `at` jusqu'à viser `id` (comme un joueur qui rectifie son cap);
 * vrai si la cible est prise.
 */
export async function aimAt(
  duo: Duo,
  seat: Seat,
  at: Point,
  id: string,
  journal: Journal,
): Promise<boolean> {
  const aimed = async (): Promise<boolean> => (await agreedAim(duo, seat))?.id === id;
  if (await aimed()) return true;
  await tapToward(duo, seat, at, aimed, journal, 8);
  return await aimed();
}

/**
 * Viser un habitant qui bouge (à son établi, derrière son comptoir): sa position est relue à
 * chaque tour; trop loin, on se rapproche au clavier, puis on se tourne vers lui par petits pas.
 */
export async function aimAtVillager(
  duo: Duo,
  seat: Seat,
  villager: string,
  map: PlaceMap,
  journal: Journal,
): Promise<boolean> {
  // Un comptoir tenu se vise aussi: la touche y parle au commerçant, par-dessus le comptoir.
  const aimed = async (): Promise<boolean> => {
    const a = await agreedAim(duo, seat);
    // « Parler » seulement: l'établi de Basile (`basile-etabli`) contient aussi son nom.
    return (
      a?.verb === 'Parler' &&
      (a.id?.includes(villager) === true || a.id?.includes('comptoir') === true)
    );
  };
  for (let round = 0; round < 6; round++) {
    if (await aimed()) return true;
    const w = await duo.host.world();
    const at = w?.places[w.common.place]?.villagers?.[villager]?.body;
    if (w === null || at === undefined) return false;
    const here = me(w, seat).body;
    // Premier tour sans marcher: par-dessus un comptoir, on vise sans s'approcher.
    if (round > 0 && Math.hypot(here.x - at.x, here.y - at.y) > 1.6) {
      const spot = standSpots(map, at, 1)[0];
      if (spot !== undefined)
        await walk(
          duo,
          journal,
          map,
          seat.side === duo.host ? [spot, null] : [null, spot],
          `vers ${villager}`,
          {
            tolerance: 0.35,
          },
        );
    }
    await tapToward(duo, seat, at, aimed, journal, 2);
  }
  return await aimed();
}

/** Texte visible d'un élément de l'interface de cette machine (`''` s'il est caché). */
export async function uiText(side: Side, selector: string): Promise<string> {
  return await side.game().evaluate((s) => {
    const node = document.querySelector<HTMLElement>(s);
    if (!node?.checkVisibility()) return '';
    return node.textContent.replace(/\s+/g, ' ').trim();
  }, selector);
}

export function player(w: ProbeWorld, seat: Seat): ReturnType<typeof me> {
  return me(w, seat);
}

export function countOf(w: ProbeWorld, seat: Seat, item: string): number {
  const p = me(w, seat) as ReturnType<typeof me> & {
    readonly bag: { readonly slots: readonly ({ item: string; count: number } | null)[] } | null;
  };
  let n = 0;
  for (const stack of [...p.toolbar, ...(p.bag?.slots ?? [])])
    if (stack?.item === item) n += stack.count;
  return n;
}
