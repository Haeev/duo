/**
 * Parcelles libres (0.13, `docs/jeux/jeu-1/parcelles-libres-0-13.md`): la terre à soi, les règles
 * de pose et le compteur, en fonctions pures. La simulation (validation de l'hôte), le rendu
 * (aperçu vert ou rouge sous la souris, chez l'hôte comme chez l'invité), l'interface (compteur,
 * vignette d'Odette) et les robots lisent les mêmes règles: l'aperçu de l'invité n'est qu'une
 * prévision, l'hôte tranche avec ce même calcul.
 */
import { type GameMap, cellIndex, inMap } from './carte';
import type { Cell, CharacterId, CropStage, DeepReadonly, GardenCell, PlotsState, WorldState } from './types';
import type { Content, GardenPlotsSettings } from '../donnees/types';

/** Raison d'un refus de pose (clé `placement_plot_<raison>` des textes). */
export type PlotRefusal = 'outside' | 'occupied' | 'hens' | 'goat' | 'friche' | 'exists' | 'ground_item' | 'none';

/** Clé du texte de chaque refus (`textes.json`, messages). */
export const PLOT_REFUSAL_TEXT: Readonly<Record<PlotRefusal, string>> = {
  outside: 'placement_plot_outside',
  occupied: 'placement_plot_occupied',
  hens: 'placement_plot_hens',
  goat: 'placement_plot_goat',
  friche: 'placement_plot_friche',
  exists: 'placement_plot_exists',
  ground_item: 'placement_plot_ground_item',
  none: 'placement_plot_none',
};

/** Zone des poules (refus à part: « Le coin des poules »). */
const HEN_ZONE = 'hen_pen';

/** Ce que les règles lisent du monde (l'état complet, ou sa copie en lecture seule). */
export type PlotWorld = DeepReadonly<Pick<WorldState, 'garden' | 'plots' | 'groundItems' | 'breeding'>>;

/** Terre posable de la carte, calculée une fois par carte et par réglages. */
interface Land {
  /** Cases du pré du jardin (zone `land.zone`), posables si rien ne les occupe. */
  meadow: ReadonlySet<number>;
  /** Cases de friche (parcelles de la carte de nature `land.clearable`), posables une fois défrichées. */
  friche: ReadonlySet<number>;
  /** Cases occupées par un objet, un chantier déclaré ou un obstacle fixe. */
  occupied: ReadonlySet<number>;
  /** Cases des zones interdites, et la raison (poules, ou hors de ta terre). */
  forbidden: ReadonlyMap<number, 'hens' | 'outside'>;
  /** Les cases de départ, dans l'ordre de pose. */
  start: readonly Cell[];
}

const landCache = new WeakMap<GameMap, WeakMap<GardenPlotsSettings, Land>>();

export function plotSettings(content: Pick<Content, 'settings'>): GardenPlotsSettings | null {
  return content.settings.garden.plots;
}

function key(map: GameMap, cx: number, cy: number): number {
  return cellIndex(map, cx, cy);
}

function buildLand(map: GameMap, s: GardenPlotsSettings): Land {
  const meadow = new Set<number>();
  const zone = map.zones[s.land.zone];
  if (zone !== undefined) {
    for (let cy = zone.y; cy < zone.y + zone.h; cy++) {
      for (let cx = zone.x; cx < zone.x + zone.w; cx++) if (inMap(map, cx, cy)) meadow.add(key(map, cx, cy));
    }
  } else {
    // Carte sans pré du jardin (carte de secours, anciennes cartes): le potager fixe sert de terre.
    for (const c of map.garden) meadow.add(key(map, c.cx, c.cy));
  }
  const friche = new Set<number>();
  for (const area of map.plotAreas ?? []) {
    if (area.nature !== s.land.clearable) continue;
    for (const c of area.cells) if (inMap(map, c.cx, c.cy)) friche.add(key(map, c.cx, c.cy));
  }
  const occupied = new Set<number>();
  const mark = (cx: number, cy: number): void => {
    if (inMap(map, cx, cy)) occupied.add(key(map, cx, cy));
  };
  for (const set of [meadow, friche]) {
    for (const k of set) if (map.blocked[k] === true) occupied.add(k);
  }
  for (const prop of map.props) {
    const r = prop.rect;
    if (r === null) continue;
    for (let cy = r.y; cy < r.y + r.h; cy++) for (let cx = r.x; cx < r.x + r.w; cx++) mark(cx, cy);
  }
  for (const imp of Object.values(map.improvements ?? {})) for (const c of imp.cells) mark(c.cx, c.cy);
  const forbidden = new Map<number, 'hens' | 'outside'>();
  for (const id of s.forbiddenZones) {
    const r = map.zones[id];
    if (r === undefined) continue;
    for (let cy = r.y; cy < r.y + r.h; cy++) {
      for (let cx = r.x; cx < r.x + r.w; cx++) if (inMap(map, cx, cy)) forbidden.set(key(map, cx, cy), id === HEN_ZONE ? 'hens' : 'outside');
    }
  }
  const start: Cell[] = [];
  const rect = s.startRect;
  for (let cy = rect.y; cy < rect.y + rect.h; cy++) {
    for (let cx = rect.x; cx < rect.x + rect.w; cx++) {
      const k = inMap(map, cx, cy) ? key(map, cx, cy) : -1;
      if (meadow.has(k) && !occupied.has(k) && !forbidden.has(k)) start.push({ cx, cy });
    }
  }
  // Rectangle de départ hors de la terre de cette carte (carte de secours): le potager fixe.
  if (start.length < s.start) {
    start.length = 0;
    for (const c of map.garden) start.push({ cx: c.cx, cy: c.cy });
  }
  return { meadow, friche, occupied, forbidden, start: start.slice(0, s.start) };
}

function landOf(map: GameMap, s: GardenPlotsSettings): Land {
  let bySettings = landCache.get(map);
  if (bySettings === undefined) {
    bySettings = new WeakMap();
    landCache.set(map, bySettings);
  }
  let land = bySettings.get(s);
  if (land === undefined) {
    land = buildLand(map, s);
    bySettings.set(s, land);
  }
  return land;
}

/** Les cases des parcelles de départ d'une partie neuve (rangée par rangée). */
export function startPlotCells(content: Pick<Content, 'settings'>, map: GameMap): Cell[] {
  const s = plotSettings(content);
  if (s === null) return map.garden.map((c) => ({ cx: c.cx, cy: c.cy }));
  return landOf(map, s).start.map((c) => ({ cx: c.cx, cy: c.cy }));
}

/** Toutes les cases de friche de la carte, et le nombre de cases du pré posables (sans parcelle). */
export function fricheCells(content: Pick<Content, 'settings'>, map: GameMap): Cell[] {
  const s = plotSettings(content);
  if (s === null) return [];
  const out: Cell[] = [];
  for (const area of map.plotAreas ?? []) {
    if (area.nature === s.land.clearable) for (const c of area.cells) out.push({ cx: c.cx, cy: c.cy });
  }
  return out;
}

/** Une case de la friche (défrichée ou non). */
export function isFriche(content: Pick<Content, 'settings'>, map: GameMap, cell: Cell): boolean {
  const s = plotSettings(content);
  return s !== null && inMap(map, cell.cx, cell.cy) && landOf(map, s).friche.has(key(map, cell.cx, cell.cy));
}

export function isCleared(world: DeepReadonly<Pick<WorldState, 'plots'>>, cell: Cell): boolean {
  return world.plots.clearedCells.some(([cx, cy]) => cx === cell.cx && cy === cell.cy);
}

/** La friche encore à défricher à cette case. */
export function fricheToClear(content: Pick<Content, 'settings'>, map: GameMap, world: DeepReadonly<Pick<WorldState, 'plots'>>, cell: Cell): boolean {
  return isFriche(content, map, cell) && !isCleared(world, cell);
}

/** Les cases de la terre où une parcelle peut aller un jour (pré et friche), sans les objets ni les zones interdites. */
export function landCells(content: Pick<Content, 'settings'>, map: GameMap): Cell[] {
  const s = plotSettings(content);
  if (s === null) return [];
  const land = landOf(map, s);
  const out: Cell[] = [];
  for (const set of [land.meadow, land.friche]) {
    for (const k of set) {
      if (land.occupied.has(k) || land.forbidden.has(k)) continue;
      out.push({ cx: (k % map.width) + map.originX, cy: Math.floor(k / map.width) + map.originY });
    }
  }
  return out;
}

/** Cases de la terre posables sur cette carte (sans compter parcelles, objets au sol ni chèvre). */
export function landCounts(content: Pick<Content, 'settings'>, map: GameMap): { meadow: number; friche: number } {
  const s = plotSettings(content);
  if (s === null) return { meadow: map.garden.length, friche: 0 };
  const land = landOf(map, s);
  const free = (set: ReadonlySet<number>): number => [...set].filter((k) => !land.occupied.has(k) && !land.forbidden.has(k)).length;
  return { meadow: free(land.meadow), friche: free(land.friche) };
}

/** Parcelles offertes par la friche défrichée. */
export function giftedPlots(s: GardenPlotsSettings, plots: DeepReadonly<PlotsState>): number {
  return Math.floor(plots.clearedCells.length / s.clearCellsPerPlot);
}

/** Parcelles possédées (au plus `max`), sans compter les louées. */
export function plotsOwned(content: Pick<Content, 'settings'>, world: DeepReadonly<Pick<WorldState, 'plots' | 'garden'>>): number {
  const s = plotSettings(content);
  if (s === null) return world.garden.length;
  const p = world.plots;
  return Math.min(s.max, p.base + p.bought + giftedPlots(s, p));
}

/** Parcelles à soi posées sur la carte. */
export function plotsPlaced(world: DeepReadonly<Pick<WorldState, 'garden'>>): number {
  let n = 0;
  for (const g of world.garden) if (g.kind !== 'rented') n++;
  return n;
}

export function plotsRented(world: DeepReadonly<Pick<WorldState, 'garden'>>): number {
  return world.garden.length - plotsPlaced(world);
}

/** Parcelles possédées encore à poser. */
export function plotsFree(content: Pick<Content, 'settings'>, world: DeepReadonly<Pick<WorldState, 'plots' | 'garden'>>): number {
  return Math.max(0, plotsOwned(content, world) - plotsPlaced(world));
}

/** Combien de parcelles le duo peut encore acquérir avant le plafond (achat ou friche). */
export function plotsRoom(content: Pick<Content, 'settings'>, world: DeepReadonly<Pick<WorldState, 'plots' | 'garden'>>): number {
  const s = plotSettings(content);
  if (s === null) return 0;
  const p = world.plots;
  return Math.max(0, s.max - (p.base + p.bought + giftedPlots(s, p)));
}

/** Une place de pâture dont le cercle de corde couvre cette case (règle du script d'équilibrage: centre à `corde + 0,5`). */
export function spotCovers(map: GameMap, ropeLength: number, spot: string, cell: Cell): boolean {
  const at = map.points[spot];
  return at !== undefined && Math.hypot(cell.cx + 0.5 - at.x, cell.cy + 0.5 - at.y) <= ropeLength + 0.5;
}

/** Une place de pâture dont le cercle touche une parcelle: elle ne reçoit plus le piquet. */
export function spotTouchesPlots(map: GameMap, ropeLength: number, spot: string, world: DeepReadonly<Pick<WorldState, 'garden'>>): boolean {
  return world.garden.some((g) => spotCovers(map, ropeLength, spot, g.cell));
}

export function gardenCellAtIn(world: DeepReadonly<Pick<WorldState, 'garden'>>, cell: Cell): DeepReadonly<GardenCell> | null {
  return world.garden.find((g) => g.cell.cx === cell.cx && g.cell.cy === cell.cy) ?? null;
}

/**
 * Peut-on poser une parcelle sur cette case ? `null` si oui, sinon la raison (section 2.4).
 * `ignoreCount`: sans la règle « plus de parcelle libre » (cases en trop d'un rectangle).
 */
export function plotPlacement(
  content: Pick<Content, 'settings'>,
  map: GameMap,
  world: PlotWorld,
  cell: Cell,
  ignoreCount = false,
): PlotRefusal | null {
  const s = plotSettings(content);
  if (s === null) return 'outside';
  if (gardenCellAtIn(world, cell) !== null) return 'exists';
  if (!inMap(map, cell.cx, cell.cy)) return 'outside';
  const land = landOf(map, s);
  const k = key(map, cell.cx, cell.cy);
  const inMeadow = land.meadow.has(k);
  const inFriche = land.friche.has(k);
  if (!inMeadow && !inFriche) return 'outside';
  const forbidden = land.forbidden.get(k);
  if (forbidden === 'outside') return 'outside';
  if (land.occupied.has(k)) return 'occupied';
  if (forbidden === 'hens') return 'hens';
  if (inFriche && !inMeadow && !isCleared(world, cell)) return 'friche';
  const goats = content.settings.goats;
  if (goats !== null) {
    for (const g of world.breeding.goats) {
      if (!g.home && g.led === null && spotCovers(map, goats.ropeLength, g.stake, cell)) return 'goat';
    }
  }
  if (world.groundItems.some((i) => Math.floor(i.pos.x) === cell.cx && Math.floor(i.pos.y) === cell.cy)) return 'ground_item';
  if (!ignoreCount && plotsFree(content, world) <= 0) return 'none';
  return null;
}

/**
 * Les cases d'un rectangle tracé, dans l'ordre de pose (section 2.5): rangée par rangée depuis le
 * coin du clic (`from`) vers la case sous le pointeur (`to`).
 */
export function rectCells(from: Cell, to: Cell, max = Number.POSITIVE_INFINITY): Cell[] {
  const dx = to.cx >= from.cx ? 1 : -1;
  const dy = to.cy >= from.cy ? 1 : -1;
  const out: Cell[] = [];
  for (let cy = from.cy; ; cy += dy) {
    for (let cx = from.cx; ; cx += dx) {
      if (out.length >= max) return out;
      out.push({ cx, cy });
      if (cx === to.cx) break;
    }
    if (cy === to.cy) break;
  }
  return out;
}

/** L'aperçu d'un tracé: chaque case et son état (posée, interdite et pourquoi, en trop). */
export type PlotPreviewState = { kind: 'ok' } | { kind: 'refused'; reason: PlotRefusal } | { kind: 'extra' };

/** État de chaque case d'un tracé de pose, dans l'ordre (les cases valides au-delà des parcelles libres sont « en trop »). */
export function previewPlacement(content: Pick<Content, 'settings'>, map: GameMap, world: PlotWorld, cells: readonly Cell[]): PlotPreviewState[] {
  let free = plotsFree(content, world);
  return cells.map((cell) => {
    const reason = plotPlacement(content, map, world, cell, true);
    if (reason !== null) return { kind: 'refused', reason };
    if (free <= 0) return free === 0 && cells.length === 1 ? { kind: 'refused', reason: 'none' } : { kind: 'extra' };
    free -= 1;
    return { kind: 'ok' };
  });
}

// ---------------------------------------------------------------------------
// Forme compacte du potager dans l'état transmis (section 6.5, lot P1)

const STAGES: readonly CropStage[] = ['seed', 'sprout', 'young', 'ripe'];

/**
 * Une parcelle dans le message d'état: `[index, cx, cy, sol]` sans culture, puis `culture, jours,
 * stade, drapeaux, jour du semis, semée par` avec une culture. `sol`: 0 herbe, 1 bêchée, 2 bêchée
 * et mouillée, 3 herbe mouillée, plus 4 pour une parcelle louée. Drapeaux: 1 mûre, 2 arrosée
 * chaque jour (belle). `semée par`: 1 ou 2. La dernière récolte reste chez l'hôte (« Déjà pris »).
 */
export type SentPlot =
  | [index: number, cx: number, cy: number, soil: number]
  | [index: number, cx: number, cy: number, soil: number, crop: string, days: number, stage: number, flags: number, sownDay: number, sownBy: number];

export function sendPlot(g: DeepReadonly<GardenCell>): SentPlot {
  const soil = (g.soil === 'tilled' ? (g.wet ? 2 : 1) : g.wet ? 3 : 0) + (g.kind === 'rented' ? 4 : 0);
  const crop = g.crop;
  if (crop === null) return [g.index, g.cell.cx, g.cell.cy, soil];
  return [
    g.index,
    g.cell.cx,
    g.cell.cy,
    soil,
    crop.crop,
    crop.days,
    Math.max(0, STAGES.indexOf(crop.stage)),
    (crop.ripe ? 1 : 0) + (crop.wateredEveryDay ? 2 : 0),
    crop.sownDay,
    crop.sownBy === 'p1' ? 1 : 2,
  ];
}

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Relit une parcelle du message d'état (chez l'invité); une valeur abîmée prend un défaut sûr. */
export function readPlot(p: readonly unknown[]): GardenCell {
  const soil = finite(p[3]);
  const base = soil % 4;
  const out: GardenCell = {
    index: finite(p[0]),
    cell: { cx: finite(p[1]), cy: finite(p[2]) },
    soil: base === 1 || base === 2 ? 'tilled' : 'grass',
    wet: base === 2 || base === 3,
    crop: null,
    lastHarvest: null,
  };
  if (soil >= 4) out.kind = 'rented';
  if (typeof p[4] === 'string') {
    const flags = finite(p[7]);
    const by: CharacterId = p[9] === 1 ? 'p1' : 'p2';
    out.crop = {
      crop: p[4],
      days: finite(p[5]),
      stage: STAGES[finite(p[6])] ?? 'seed',
      ripe: (flags & 1) !== 0,
      wateredEveryDay: (flags & 2) !== 0,
      sownDay: finite(p[8]),
      sownBy: by,
    };
  }
  return out;
}
