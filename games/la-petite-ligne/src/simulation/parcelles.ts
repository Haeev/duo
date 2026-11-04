/**
 * Parcelles libres (0.13, `parcelles-libres-0-13.md`): poser et reprendre au cordeau, maintien
 * pour arracher une culture, friche défrichée à la houe, rayon d'Odette. L'hôte valide chaque case
 * avec les règles pures de `etat/parcelles.ts` (les mêmes que l'aperçu des deux machines).
 */
import type { Cell, Character, GardenCell, Quality } from '../etat/types';
import {
  PLOT_REFUSAL_TEXT,
  fricheToClear,
  giftedPlots,
  plotPlacement,
  plotSettings,
  plotsFree,
  plotsRoom,
  spotTouchesPlots,
} from '../etat/parcelles';
import type { GardenPlotsSettings } from '../donnees/types';
import { type Sim, bump, emit, notifyKey, partnerName, say, secondsToTicks } from './contexte';
import { queueHint } from './astuces';
import { spendPoints } from './besoins';
import { gardenCellAt, gesture } from './potager';
import { addToBag, heldItem } from './sac';
import { storeAtHome } from './rangement';
import { ITEM } from './ids';

/** Au plus tant de cases par tracé (le pré et la friche tiennent dans un rectangle de 24 x 8). */
export const PLOT_RECT_MAX = 256;

function settingsOf(sim: Sim): GardenPlotsSettings | null {
  return plotSettings(sim.content);
}

export function holdsGardenLine(c: Character): boolean {
  return heldItem(c) === ITEM.gardenLine;
}

function canWork(c: Character): boolean {
  return c.created && c.status === 'active' && c.seat === null;
}

function newPlot(sim: Sim, cell: Cell): GardenCell {
  const index = sim.world.plots.nextIndex;
  sim.world.plots.nextIndex += 1;
  return { index, cell: { cx: cell.cx, cy: cell.cy }, soil: 'grass', wet: false, crop: null, lastHarvest: null };
}

/**
 * Poser des parcelles (clic, Espace ou rectangle tracé): dans l'ordre reçu, chaque case valide
 * jusqu'à épuisement des parcelles libres; les cases interdites sont sautées. Un refus n'est dit
 * qu'une fois (la première raison), avec l'événement qui fait trembler l'aperçu.
 */
export function placePlots(sim: Sim, c: Character, cells: readonly Cell[]): number {
  const s = settingsOf(sim);
  if (s === null || !canWork(c) || !holdsGardenLine(c) || sim.world.phase !== 'day') return 0;
  const placed: Cell[] = [];
  let refusal: { cell: Cell; reason: keyof typeof PLOT_REFUSAL_TEXT } | null = null;
  for (const cell of cells.slice(0, PLOT_RECT_MAX)) {
    const reason = plotPlacement(sim.content, sim.map, sim.world, cell);
    if (reason !== null) {
      refusal ??= { cell, reason };
      if (reason === 'none') break;
      continue;
    }
    sim.world.garden.push(newPlot(sim, cell));
    placed.push({ cx: cell.cx, cy: cell.cy });
  }
  if (placed.length > 0) {
    bump(sim, 'plots_placed', c.id, placed.length);
    emit(sim, { type: 'plot_placed', by: c.id, cells: placed });
    queueHint(sim, c.id, { on: 'plot_placed' });
  }
  // Un refus au milieu d'un tracé qui a posé quelque chose ne se dit pas: les cases sautées se voyaient en rouge.
  if (refusal !== null && (placed.length === 0 || refusal.reason === 'none')) {
    say(sim, c.id, PLOT_REFUSAL_TEXT[refusal.reason]);
    emit(sim, { type: 'plot_refused', by: c.id, cell: refusal.cell, reason: refusal.reason });
  }
  return placed.length;
}

/** Ce que rend une culture arrachée (section 2.6): la récolte si elle est mûre, sinon sa graine. */
function cropReturn(sim: Sim, g: GardenCell): { item: string; quality: Quality; count: number; ripe: boolean } | null {
  const crop = g.crop;
  if (crop === null) return null;
  const def = sim.content.crops[crop.crop];
  if (def === undefined) return null;
  if (crop.ripe) return { item: def.harvest, quality: crop.wateredEveryDay ? 'fine' : 'ordinary', count: def.yieldPerCell, ripe: true };
  return { item: def.seed, quality: 'ordinary', count: 1, ripe: false };
}

/** Le sac d'abord, sinon le coffre de la maisonnette: jamais au sol, jamais perdu. */
function giveBack(sim: Sim, c: Character, item: string, quality: Quality, count: number): void {
  const left = addToBag(sim, c, item, quality, count);
  if (left > 0) {
    storeAtHome(sim, item, quality, left);
    say(sim, c.id, 'bag_full_to_chest');
  }
}

/** Retire la parcelle (à soi) et rend ce qu'elle portait. */
function takeUp(sim: Sim, c: Character, g: GardenCell): void {
  const index = sim.world.garden.indexOf(g);
  if (index < 0) return;
  const back = cropReturn(sim, g);
  const sower = g.crop?.sownBy ?? null;
  sim.world.garden.splice(index, 1);
  if (back !== null) {
    giveBack(sim, c, back.item, back.quality, back.count);
    if (back.ripe) {
      for (const key of ['harvested', `harvested:${back.item}`, `harvested:q:${back.quality}`, `harvested:${back.item}:q:${back.quality}`]) {
        bump(sim, key, c.id, back.count);
      }
    }
  }
  bump(sim, 'plots_removed', c.id);
  emit(sim, {
    type: 'plot_removed',
    by: c.id,
    cell: { ...g.cell },
    returned: back === null ? null : { item: back.item, quality: back.quality, count: back.count },
  });
  // L'autre l'avait semée: une information, pas un reproche (section 2.6).
  if (sower !== null && sower !== c.id && back !== null && !back.ripe) {
    notifyKey(sim, sower, 'message', 'plot_taken_by_partner', { partner: partnerName(sim, sower) });
  }
}

/** Refus de reprise: une parcelle louée reste (lot P6). */
function removable(sim: Sim, c: Character, g: GardenCell): boolean {
  if (g.kind !== 'rented') return true;
  say(sim, c.id, 'plot_rented_locked');
  return false;
}

/**
 * X ou clic droit pressé sur une parcelle: vide, elle part tout de suite; avec une culture, le
 * maintien commence (`removeHoldSeconds`). `cell` `null`: relâché, le maintien en cours s'annule.
 */
export function holdPlot(sim: Sim, c: Character, cell: Cell | null): void {
  const s = settingsOf(sim);
  if (s === null) return;
  if (cell === null) {
    if (sim.runtime.plotHold[c.id] !== null) sim.runtime.plotHold[c.id] = null;
    return;
  }
  if (!canWork(c) || !holdsGardenLine(c) || sim.world.phase !== 'day') return;
  const g = gardenCellAt(sim, cell);
  if (g === null || !removable(sim, c, g)) return;
  if (g.crop === null) {
    takeUp(sim, c, g);
    return;
  }
  sim.runtime.plotHold[c.id] = { cell: { cx: cell.cx, cy: cell.cy }, since: sim.world.tick };
}

/** Le maintien de chaque joueur: au bout de `removeHoldSeconds`, la culture est arrachée et la parcelle reprise. */
export function updatePlotHolds(sim: Sim): void {
  const s = settingsOf(sim);
  if (s === null) return;
  const ticks = secondsToTicks(s.removeHoldSeconds);
  for (const c of sim.world.characters) {
    const hold = sim.runtime.plotHold[c.id];
    if (hold === null) continue;
    if (!canWork(c) || !holdsGardenLine(c) || sim.world.phase !== 'day') {
      sim.runtime.plotHold[c.id] = null;
      continue;
    }
    const g = gardenCellAt(sim, hold.cell);
    // L'autre l'a reprise ou récoltée pendant le maintien: plus rien à arracher (la reprise d'une vide reste possible).
    if (g === null) {
      sim.runtime.plotHold[c.id] = null;
      continue;
    }
    if (sim.world.tick - hold.since < ticks) continue;
    sim.runtime.plotHold[c.id] = null;
    takeUp(sim, c, g);
  }
}

/** Clic droit glissé (section 2.5): reprend les parcelles vides du rectangle, celles qui portent une culture restent. */
export function removePlots(sim: Sim, c: Character, cells: readonly Cell[]): number {
  if (settingsOf(sim) === null || !canWork(c) || !holdsGardenLine(c) || sim.world.phase !== 'day') return 0;
  let removed = 0;
  const kept: Cell[] = [];
  for (const cell of cells.slice(0, PLOT_RECT_MAX)) {
    const g = gardenCellAt(sim, cell);
    if (g === null || g.kind === 'rented') continue;
    if (g.crop !== null) {
      kept.push({ cx: cell.cx, cy: cell.cy });
      continue;
    }
    takeUp(sim, c, g);
    removed += 1;
  }
  if (kept.length > 0) emit(sim, { type: 'plot_kept', by: c.id, cells: kept });
  return removed;
}

/** Une case de friche encore à défricher, à la houe (verbe `clear`). */
export function canClear(sim: Sim, cell: Cell): boolean {
  return settingsOf(sim) !== null && gardenCellAt(sim, cell) === null && fricheToClear(sim.content, sim.map, sim.world, cell);
}

/**
 * Défricher (section 2.3): 1,2 s, 3 points d'endurance; la case devient de l'herbe posable; toutes
 * les `clearCellsPerPlot` cases, une parcelle de plus (tant que le plafond n'est pas atteint).
 */
export function clearFriche(sim: Sim, c: Character, cell: Cell): void {
  const s = settingsOf(sim);
  if (s === null || !canClear(sim, cell)) return;
  const p = sim.world.plots;
  const room = plotsRoom(sim.content, sim.world);
  const before = giftedPlots(s, p);
  p.clearedCells.push([cell.cx, cell.cy]);
  const gift = giftedPlots(s, p) > before && room > 0;
  spendPoints(sim, c, s.clearEndurance);
  gesture(sim, c, 'till', s.clearSeconds, { x: cell.cx + 0.5, y: cell.cy + 0.5 });
  bump(sim, 'friche_cleared', c.id);
  emit(sim, { type: 'friche_cleared', by: c.id, cell: { cx: cell.cx, cy: cell.cy }, gift });
  if (gift) emit(sim, { type: 'plot_gained', by: c.id, source: 'friche', count: 1 });
  queueHint(sim, c.id, { on: 'tool_used' });
}

/** Parcelles achetées chez Odette (livraison d'un achat, ou d'un gros achat accepté): au plus le rayon et le plafond. */
export function deliverPlots(sim: Sim, c: Character, count: number): number {
  const s = settingsOf(sim);
  if (s === null) return 0;
  const p = sim.world.plots;
  const n = Math.max(0, Math.min(count, p.stock, plotsRoom(sim.content, sim.world)));
  if (n === 0) return 0;
  p.stock -= n;
  p.bought += n;
  bump(sim, 'plots_bought', c.id, n);
  emit(sim, { type: 'plot_gained', by: c.id, source: 'shop', count: n });
  return n;
}

/** Combien de parcelles on peut acheter maintenant (rayon, plafond). */
export function plotsBuyable(sim: Sim): number {
  return Math.min(sim.world.plots.stock, plotsRoom(sim.content, sim.world));
}

/** L'aube (section 2.3): le rayon gagne `restockPerDay`, au plus `stockMax`. */
export function restockPlots(sim: Sim): void {
  const s = settingsOf(sim);
  if (s === null) return;
  const p = sim.world.plots;
  if (p.lastRestockDay >= sim.world.clock.day) return;
  p.stock = Math.min(s.stockMax, p.stock + s.restockPerDay);
  p.lastRestockDay = sim.world.clock.day;
}

/**
 * Astuces de la journée: une parcelle libre sans le cordeau en main, la houe en main près de la
 * friche. Appelé à chaque pas de la journée (la file d'astuces ne garde que la première fois).
 */
export function plotHints(sim: Sim): void {
  const s = settingsOf(sim);
  if (s === null) return;
  const free = plotsFree(sim.content, sim.world);
  for (const c of sim.world.characters) {
    if (!c.created || c.status !== 'active') continue;
    if (free > 0 && !holdsGardenLine(c) && sim.world.clock.day > sim.content.settings.clock.firstDay.day) queueHint(sim, c.id, { on: 'plot_free' });
    if (heldItem(c) === ITEM.hoe) {
      const cell = { cx: Math.floor(c.pos.x), cy: Math.floor(c.pos.y) };
      for (const [dx, dy] of NEIGHBOURS) {
        if (canClear(sim, { cx: cell.cx + dx, cy: cell.cy + dy })) {
          queueHint(sim, c.id, { on: 'near_friche' });
          break;
        }
      }
    }
  }
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Une place de pâture qui recevrait le piquet: refusée si son cercle touche une parcelle (section 2.4). */
export function spotRefusedForPlots(sim: Sim, spot: string): boolean {
  const goats = sim.content.settings.goats;
  return settingsOf(sim) !== null && goats !== null && spotTouchesPlots(sim.map, goats.ropeLength, spot, sim.world);
}
