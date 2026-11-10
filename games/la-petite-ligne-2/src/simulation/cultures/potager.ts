/**
 * Brique `field`: la terre cultivable du logement (cahier 4.7, R30). Chaque mètre carré de
 * l'emprise peut devenir une parcelle, où l'on veut, jusqu'au nombre permis par les
 * améliorations. La touche d'action fait la bonne chose selon la case devant le personnage et ce
 * qu'il tient: bêche, bêcher; graine, semer; arrosoir, arroser; plante mûre, récolter.
 * Rien ne meurt: une plante oubliée attend, hors saison elle ne pousse plus mais reste.
 */
import type { Brick } from '../../donnees/schemas/briques';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { CropDef } from '../../donnees/schemas/recolte';
import type { FieldState, Plot } from '../../donnees/schemas/recolte-briques';
import type { DeepReadonly } from '../../etat/monde';
import type { BrickBehaviour, BrickView, Look } from '../briques/types';
import { findProp, footprintOf } from '../noyau/obstacles';
import type { SimContext } from '../noyau/systemes';
import { recall } from '../regles/memoire';
import { giveItem } from '../sac/actions';
import {
  cellsOf,
  heldOf,
  luckOf,
  powerOf,
  strike,
  strokeSeconds,
  type Held,
} from '../outils/outils';
import { HARVEST_TUNING } from '../outils/reglages';
import { allows, isRaining, seasonOf } from '../outils/saison';

type FieldBrick = Extract<Brick, { brick: 'field' }>;
type ReadField = DeepReadonly<FieldState>;
type ReadPlot = DeepReadonly<Plot>;

export type FieldAction = 'till' | 'sow' | 'water' | 'reap';

const VERBS: Readonly<Record<FieldAction, string>> = {
  till: 'Bêcher',
  sow: 'Semer',
  water: 'Arroser',
  reap: 'Récolter',
};

/** Grille de la terre cultivable: coin nord-ouest et taille, rotation comprise. */
interface Grid {
  readonly left: number;
  readonly top: number;
  readonly w: number;
  readonly h: number;
}

function gridOf(
  look: Look,
  target: { type: string; x: number; y: number; rotation: number },
): Grid {
  const def = look.content.props[target.type];
  const size = def === undefined ? { w: 1, h: 1 } : footprintOf(def, target.rotation);
  return { left: target.x - size.w / 2, top: target.y - size.h / 2, w: size.w, h: size.h };
}

/** Case visée: juste devant le personnage, ramenée dans l'emprise. Pour la surbrillance aussi. */
export function aimedCell(
  look: Look,
  player: PlayerIndex,
  target: { type: string; x: number; y: number; rotation: number },
): number {
  const grid = gridOf(look, target);
  const { x, y, facing } = look.world.players[player].body;
  const ax = x + Math.cos(facing) * HARVEST_TUNING.cellAhead;
  const ay = y + Math.sin(facing) * HARVEST_TUNING.cellAhead;
  const cx = Math.max(0, Math.min(grid.w - 1, Math.floor(ax - grid.left)));
  const cy = Math.max(0, Math.min(grid.h - 1, Math.floor(ay - grid.top)));
  return cy * grid.w + cx;
}

/** Centre d'une case dans le monde (m), pour le rendu. */
export function cellCenter(
  look: Look,
  target: { type: string; x: number; y: number; rotation: number },
  cell: number,
): { x: number; y: number } {
  const grid = gridOf(look, target);
  return { x: grid.left + (cell % grid.w) + 0.5, y: grid.top + Math.floor(cell / grid.w) + 0.5 };
}

/**
 * Cases traitées d'un coup qui en couvre `count`: en ligne devant soi jusqu'à 3, au-delà en
 * bandes de 3 de large (9: un carré de 3 sur 3; 18: 3 sur 6).
 */
export function strokeCells(
  look: Look,
  player: PlayerIndex,
  target: { type: string; x: number; y: number; rotation: number },
  count: number,
): number[] {
  const grid = gridOf(look, target);
  const first = aimedCell(look, player, target);
  const facing = look.world.players[player].body.facing;
  const horizontal = Math.abs(Math.cos(facing)) >= Math.abs(Math.sin(facing));
  const dx = horizontal ? Math.sign(Math.cos(facing)) : 0;
  const dy = horizontal ? 0 : Math.sign(Math.sin(facing));
  const width = count >= 9 ? 3 : 1;
  const depth = Math.ceil(count / width);
  const x0 = first % grid.w;
  const y0 = Math.floor(first / grid.w);
  const out: number[] = [];
  for (let i = 0; i < depth; i++) {
    for (let j = -(width - 1) / 2; j <= (width - 1) / 2; j++) {
      if (out.length >= count) break;
      const x = x0 + dx * i + (horizontal ? 0 : j);
      const y = y0 + dy * i + (horizontal ? j : 0);
      if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) continue;
      out.push(y * grid.w + x);
    }
  }
  return out;
}

/** Parcelles permises: la plus grande valeur de `plots` dont le fait est retenu. */
export function plotLimit(look: Look, params: FieldBrick): number {
  let limit = 0;
  for (const step of params.plots) {
    const fact = step.fact === null ? null : recall(look.world, step.fact);
    if (step.fact === null || (fact !== null && fact.v !== false && fact.v !== 0))
      limit = Math.max(limit, step.cells);
  }
  return limit;
}

function tilledCount(field: ReadField | undefined): number {
  return field?.cells.reduce((sum, cell) => sum + (cell === null ? 0 : 1), 0) ?? 0;
}

/** Points de pousse au début de chaque stade, puis la maturité (dernier élément). */
function thresholds(crop: CropDef): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const points of crop.stages) {
    sum += points;
    out.push(sum);
  }
  return out;
}

/** Stade d'une plante: 0 au semis, `stages.length` à maturité. */
export function stageOf(crop: CropDef, growth: number): number {
  let stage = 0;
  for (const threshold of thresholds(crop)) if (growth >= threshold) stage += 1;
  return stage;
}

export function isRipe(crop: CropDef, growth: number): boolean {
  return stageOf(crop, growth) >= crop.stages.length;
}

/** Ce que voit le rendu et l'interface d'une parcelle. */
export interface PlotView {
  readonly cell: number;
  /** `bare`: bêchée sans culture. */
  readonly state: 'bare' | 'growing' | 'ripe';
  readonly crop: string | null;
  readonly stage: number;
  readonly stages: number;
  /** Elle boirait volontiers: semée, pas mûre, pas arrosée aujourd'hui. */
  readonly thirsty: boolean;
  readonly watered: boolean;
}

export function plotView(look: Look, cell: number, plot: ReadPlot): PlotView {
  const crop = plot.crop === null ? undefined : look.content.crops[plot.crop];
  if (crop === undefined)
    return {
      cell,
      state: 'bare',
      crop: null,
      stage: 0,
      stages: 0,
      thirsty: false,
      watered: plot.watered,
    };
  const ripe = isRipe(crop, plot.growth);
  return {
    cell,
    state: ripe ? 'ripe' : 'growing',
    crop: crop.id,
    stage: stageOf(crop, plot.growth),
    stages: crop.stages.length,
    thirsty: !ripe && !plot.watered,
    watered: plot.watered,
  };
}

/** Les parcelles d'une terre cultivable du lieu courant (`null`: pas une terre cultivable). */
export function fieldView(look: Look, id: string): PlotView[] | null {
  const place = look.content.places[look.world.common.place];
  const state = look.world.places[look.world.common.place];
  if (place === undefined || state === undefined || findProp(place, state, id) === null)
    return null;
  const field = state.objects[id]?.field;
  const out: PlotView[] = [];
  field?.cells.forEach((plot, cell) => {
    if (plot !== null) out.push(plotView(look, cell, plot));
  });
  return out;
}

/** La culture semée par l'objet tenu, `null` si ce n'est pas une graine. */
function cropOfSeed(look: Look, held: Held | null): CropDef | null {
  if (held === null) return null;
  for (const crop of Object.values(look.content.crops)) if (crop.seed === held.item.id) return crop;
  return null;
}

/** Ce que ferait l'appui sur la case visée, et ce qui manque. Pur. */
export function fieldIntent(
  look: Look,
  player: PlayerIndex,
  target: BrickView<FieldBrick>,
): { action: FieldAction; refusal: string | null; cell: number } {
  const cell = aimedCell(look, player, target);
  const field = target.states.field;
  const plot = field?.cells[cell] ?? null;
  const cropId = plot?.crop ?? null;
  const crop = cropId === null ? undefined : look.content.crops[cropId];
  if (plot !== null && crop !== undefined && isRipe(crop, plot.growth))
    return { action: 'reap', refusal: null, cell };
  const held = heldOf(look, player);
  const kind = held?.tool?.kind;
  if (kind === 'spade' && target.params.tools.includes('spade')) {
    if (plot !== null) return { action: 'till', refusal: 'already-tilled', cell };
    if (tilledCount(field) >= plotLimit(look, target.params))
      return { action: 'till', refusal: 'no-more-plots', cell };
    return { action: 'till', refusal: null, cell };
  }
  if (kind === 'can' && target.params.tools.includes('can')) {
    if (plot === null || crop === undefined)
      return { action: 'water', refusal: 'nothing-to-water', cell };
    return { action: 'water', refusal: plot.watered ? 'already-watered' : null, cell };
  }
  const seed = cropOfSeed(look, held);
  if (seed !== null) {
    if (plot === null) return { action: 'sow', refusal: 'needs-tilling', cell };
    if (plot.crop !== null) return { action: 'sow', refusal: 'plot-taken', cell };
    const season = seasonOf(look.content.settings.clock, look.world.common.day);
    if (!allows(seed.seasons, season)) return { action: 'sow', refusal: 'wrong-season', cell };
    return { action: 'sow', refusal: null, cell };
  }
  if (plot === null) return { action: 'till', refusal: 'needs-spade', cell };
  if (crop === undefined) return { action: 'sow', refusal: 'needs-seed', cell };
  return { action: 'reap', refusal: 'not-ripe', cell };
}

/** Qualité atteinte: la meilleure dont la part de jours arrosés est atteinte. */
export function qualityOf(crop: CropDef, plot: ReadPlot): number {
  const share = plot.days === 0 ? (plot.watered ? 1 : 0) : plot.wet / plot.days;
  let best = 0;
  crop.qualities.forEach((quality, index) => {
    if (share >= quality.wateredShare) best = index;
  });
  return best;
}

function cellsOfField(sim: SimContext, target: BrickView<FieldBrick>): (Plot | null)[] {
  const place = sim.world.places[sim.world.common.place];
  const states = place?.objects[target.id];
  if (states === undefined) return [];
  const field = (states.field ??= { cells: [], work: null });
  const grid = gridOf(sim, target);
  while (field.cells.length < grid.w * grid.h) field.cells.push(null);
  return field.cells;
}

function till(sim: SimContext, player: PlayerIndex, target: BrickView<FieldBrick>): void {
  const held = heldOf(sim, player);
  const states = sim.world.places[sim.world.common.place]?.objects[target.id];
  if (held === null || states === undefined) return;
  const cells = cellsOfField(sim, target);
  const field = states.field;
  if (field === undefined) return;
  const first = aimedCell(sim, player, target);
  const { till: rule } = HARVEST_TUNING;
  strike(sim, player, held.slot, rule.effort, rule.dirty);
  const points = (field.work?.cell === first ? field.work.points : 0) + powerOf(held);
  const done = points >= rule.work;
  field.work = done ? null : { cell: first, points };
  sim.emit({
    type: 'work_hit',
    player,
    target: target.id,
    action: 'till',
    progress: Math.min(1, points / rule.work),
    done,
  });
  if (!done) return;
  const limit = plotLimit(sim, target.params);
  let count = tilledCount(field);
  const day = sim.world.common.day;
  for (const cell of strokeCells(sim, player, target, cellsOf(held))) {
    if (count >= limit) break;
    if (cells[cell] !== null) continue;
    cells[cell] = { crop: null, growth: 0, watered: false, days: 0, wet: 0, day };
    count += 1;
    sim.emit({ type: 'plot_changed', player, target: target.id, cell, action: 'till' });
  }
}

function sow(sim: SimContext, player: PlayerIndex, target: BrickView<FieldBrick>): void {
  const actor = sim.world.players[player];
  const held = heldOf(sim, player);
  const crop = cropOfSeed(sim, held);
  const cell = aimedCell(sim, player, target);
  const plot = cellsOfField(sim, target)[cell] ?? null;
  if (held === null || crop === null || plot === null) return;
  const stack = actor.toolbar[held.slot] ?? null;
  if (stack === null) return;
  if (stack.count <= 1) actor.toolbar[held.slot] = null;
  else stack.count -= 1;
  sim.touch('players');
  Object.assign(plot, {
    crop: crop.id,
    growth: 0,
    watered: isRaining(sim),
    days: 0,
    wet: 0,
    day: sim.world.common.day,
  });
  sim.emit({ type: 'work_hit', player, target: target.id, action: 'sow', progress: 1, done: true });
  sim.emit({ type: 'plot_changed', player, target: target.id, cell, action: 'sow' });
}

function water(sim: SimContext, player: PlayerIndex, target: BrickView<FieldBrick>): void {
  const held = heldOf(sim, player);
  if (held === null) return;
  const cells = cellsOfField(sim, target);
  strike(sim, player, held.slot, HARVEST_TUNING.water.effort, false);
  sim.emit({
    type: 'work_hit',
    player,
    target: target.id,
    action: 'water',
    progress: 1,
    done: true,
  });
  for (const cell of strokeCells(sim, player, target, cellsOf(held))) {
    const plot = cells[cell] ?? null;
    if ((plot?.crop ?? null) === null || plot?.watered !== false) continue;
    plot.watered = true;
    sim.emit({ type: 'plot_changed', player, target: target.id, cell, action: 'water' });
  }
}

function reap(sim: SimContext, player: PlayerIndex, target: BrickView<FieldBrick>): void {
  const cell = aimedCell(sim, player, target);
  const plot = cellsOfField(sim, target)[cell] ?? null;
  const cropId = plot?.crop ?? null;
  const crop = cropId === null ? undefined : sim.content.crops[cropId];
  if (plot === null || crop === undefined) return;
  const level = qualityOf(crop, plot);
  const quality = crop.qualities[level] ?? crop.qualities[0];
  if (quality === undefined) return;
  const { extraCatch } = luckOf(sim, player);
  const count = quality.count + (extraCatch > 0 && sim.random.chance(extraCatch) ? 1 : 0);
  giveItem(sim, player, quality.item, count);
  if (crop.regrowStage === null) Object.assign(plot, { crop: null, growth: 0 });
  else plot.growth = crop.regrowStage === 0 ? 0 : (thresholds(crop)[crop.regrowStage - 1] ?? 0);
  plot.days = 0;
  plot.wet = 0;
  sim.emit({
    type: 'work_hit',
    player,
    target: target.id,
    action: 'reap',
    progress: 1,
    done: true,
  });
  sim.emit({
    type: 'crop_reaped',
    player,
    target: target.id,
    cell,
    crop: crop.id,
    item: quality.item,
    count,
    quality: level,
  });
  sim.emit({ type: 'plot_changed', player, target: target.id, cell, action: 'reap' });
}

export const fieldBehaviour: BrickBehaviour<FieldBrick> = {
  verb: VERBS.till,
  verbOf(look, player, target) {
    return VERBS[fieldIntent(look, player, target).action];
  },
  gesture(look, player, target) {
    const { action } = fieldIntent(look, player, target);
    const held = heldOf(look, player);
    if (action === 'sow')
      return { clip: HARVEST_TUNING.sow.clip, seconds: HARVEST_TUNING.sow.seconds };
    if (action === 'reap')
      return { clip: HARVEST_TUNING.reap.clip, seconds: HARVEST_TUNING.reap.seconds };
    const clip = action === 'till' ? HARVEST_TUNING.till.clip : HARVEST_TUNING.water.clip;
    return { clip, seconds: strokeSeconds(look, player, held, HARVEST_TUNING.sow.seconds) };
  },
  refuse(look, player, target) {
    return fieldIntent(look, player, target).refusal;
  },
  use(sim, player, target) {
    const { action } = fieldIntent(sim, player, target);
    if (action === 'till') till(sim, player, target);
    else if (action === 'sow') sow(sim, player, target);
    else if (action === 'water') water(sim, player, target);
    else reap(sim, player, target);
    sim.touch('place');
  },
};
