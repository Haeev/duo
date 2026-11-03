/**
 * La lisière après la démo (tour 8, sections 5.1 et 5.2): les arbres abattus repoussent (souche,
 * rejet, arbre adulte), la hache refuse ce qui est trop jeune, et les coins de cueillette se
 * garnissent chaque matin selon la saison.
 */
import { drawForage, forageInSeason } from '../etat/cueillette';
import { treeGrowth } from '../etat/repousse';
import type { Character, Tree, Vec2 } from '../etat/types';
import { isSheltered } from '../etat/interieurs';
import { type Sim, distance, emit, sayIfWritten } from './contexte';
import { queueHint } from './astuces';
import { weatherOf } from './meteo';
import { dropAt } from './sac';

/** Un objet posé à moins de tant d'un coin l'occupe (m): le coin ne se garnit pas (règle 4). */
export const FORAGE_CORNER_RADIUS = 0.75;

/** Au matin: les arbres dont le temps est venu redeviennent adultes; les rejets bloquent leur case. */
export function morningTrees(sim: Sim): void {
  const { world } = sim;
  const trees = sim.content.settings.trees;
  if (!trees.regrow) return;
  let changed = false;
  for (const tree of world.trees) {
    if (!tree.felled) continue;
    changed = true;
    if (treeGrowth(trees, tree, world.clock.day).stage !== 'adult') continue;
    tree.felled = false;
    tree.felledDay = null;
    tree.hits = 0;
    emit(sim, { type: 'tree_regrown', tree: tree.id });
  }
  if (changed) sim.runtime.dynamicDirty = true;
}

/**
 * Au chargement (R19, 0.12.2): la repousse plus rapide rend adultes, dès la reprise, des souches
 * d'une sauvegarde faite sous l'ancienne règle. Elles se relèvent tout de suite, comme au matin:
 * sinon elles resteraient jusqu'au lendemain des souches qui bloquent leur case sans se couper.
 */
export function settleRegrownTrees(sim: Sim): void {
  morningTrees(sim);
}

/** Une souche ou un rejet (un arbre abattu qui n'est pas redevenu adulte). */
export function treeStage(sim: Sim, tree: Tree): 'adult' | 'stump' | 'sapling' {
  return treeGrowth(sim.content.settings.trees, tree, sim.world.clock.day).stage;
}

/** Ce qui bloque la case d'un arbre: l'arbre debout et le rejet; la souche se traverse. */
export function treeBlocks(sim: Sim, tree: Tree): boolean {
  return treeStage(sim, tree) !== 'stump';
}

/** La hache sur une souche ou un rejet: rien ne se coupe, on dit pourquoi (section 9). */
export function refuseChop(sim: Sim, c: Character, tree: Tree): void {
  const stage = treeStage(sim, tree);
  if (stage === 'adult') return;
  c.facing = Math.atan2(tree.pos.y - c.pos.y, tree.pos.x - c.pos.x);
  if (stage === 'sapling') tree.lastHitTick = sim.world.tick;
  sayIfWritten(sim, c.id, stage === 'stump' ? 'stump_hint' : 'tree_too_young');
  emit(sim, {
    type: 'chop_refused',
    by: c.id,
    tree: tree.id,
    reason: stage === 'stump' ? 'stump' : 'young',
  });
}

/** Un objet est-il posé sur ce coin ? */
function cornerTaken(sim: Sim, at: Vec2): boolean {
  return sim.world.groundItems.some((g) => distance(g.pos, at) <= FORAGE_CORNER_RADIUS);
}

/**
 * Au matin, à partir de `forage.fromDay`: les cueillettes hors de saison s'en vont pendant la nuit
 * (sans message), puis chaque coin vide tire la sienne (règles 1 à 4).
 */
export function morningForage(sim: Sim): void {
  const { world } = sim;
  const s = sim.content.settings;
  const forage = s.forage;
  const day = world.clock.day;
  if (forage === null || day < forage.fromDay) return;
  const corners = forage.points
    .map((p) => ({ id: p.point, at: sim.map.points[p.point] }))
    .filter((p): p is { id: string; at: Vec2 } => p.at !== undefined);
  const before = world.groundItems.length;
  world.groundItems = world.groundItems.filter(
    (g) =>
      forageInSeason(s, g.item, day) ||
      !corners.some((p) => distance(g.pos, p.at) <= FORAGE_CORNER_RADIUS),
  );
  if (world.groundItems.length !== before) sim.runtime.changed = true;
  const picked = new Set(
    forage.items
      .map((i) => i.item)
      .filter((item) => (world.counters.duo[`picked:${item}`] ?? 0) > 0),
  );
  const yesterday = weatherOf(sim, day - 1);
  for (const corner of corners) {
    if (cornerTaken(sim, corner.at)) continue;
    const draw = drawForage(s, corner.id, {
      seed: world.seed,
      day,
      pickedBefore: picked,
      yesterday,
    });
    if (draw === null) continue;
    dropAt(sim, corner.at.x, corner.at.y, draw.item, 'ordinary', draw.count);
    sim.runtime.changed = true;
  }
}

/** Distance à laquelle une cueillette posée donne l'astuce `forage_hint` (m). */
const FORAGE_HINT_RADIUS = 6;

/** L'astuce de la lisière, la première fois qu'un joueur passe près d'une cueillette posée. */
export function forageHints(sim: Sim): void {
  const forage = sim.content.settings.forage;
  if (forage === null || sim.world.phase !== 'day' || sim.world.clock.day < forage.fromDay) return;
  const items = new Set(forage.items.map((i) => i.item));
  for (const c of sim.world.characters) {
    if (isSheltered(c) || !c.created) continue;
    const near = sim.world.groundItems.some(
      (g) => items.has(g.item) && distance(c.pos, g.pos) <= FORAGE_HINT_RADIUS,
    );
    if (near) queueHint(sim, c.id, { on: 'near_forage' });
  }
}
