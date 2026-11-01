/**
 * Repousse des arbres de la lisière (tour 8, section 5.1): souche, rejet (chêne) ou jeune sapin
 * replanté (sapin), puis arbre adulte. Pur: la simulation, le rendu et les tests lisent la même
 * règle, d'après le jour de l'abattage et le jour en cours.
 */
import type { Settings } from '../donnees/types';
import type { DeepReadonly, Tree } from './types';

export type TreeStage = 'adult' | 'stump' | 'sapling';

export interface TreeGrowth {
  stage: TreeStage;
  /** Taille du rejet (part de l'arbre adulte), 1 debout, 0 pour une souche. */
  scale: number;
}

const ADULT: TreeGrowth = { stage: 'adult', scale: 1 };
const STUMP: TreeGrowth = { stage: 'stump', scale: 0 };

/**
 * Jours de pousse d'un arbre abattu le jour `felledDay`, au jour `day`. Avant `regrowFromDay`,
 * rien ne pousse; ce jour-là, une souche plus ancienne compte au plus `catchUpDays` jours.
 */
export function growthDays(trees: Settings['trees'], felledDay: number, day: number): number {
  if (!trees.regrow || day < trees.regrowFromDay) return 0;
  const counted = Math.max(felledDay, trees.regrowFromDay - trees.catchUpDays);
  return Math.max(0, day - counted);
}

/** Ce qu'est l'arbre aujourd'hui. Un arbre abattu sans jour connu reste une souche. */
export function treeGrowth(
  trees: Settings['trees'],
  tree: Pick<DeepReadonly<Tree>, 'felled' | 'felledDay'>,
  day: number,
): TreeGrowth {
  if (!tree.felled) return ADULT;
  if (tree.felledDay === null) return STUMP;
  const age = growthDays(trees, tree.felledDay, day);
  if (age < trees.stumpDays) return STUMP;
  const young = age - trees.stumpDays;
  if (young < trees.saplingDays) {
    const s = trees.saplingScale;
    return { stage: 'sapling', scale: Math.min(s.max, s.first + s.perDay * young) };
  }
  return ADULT;
}

/** Jour où l'arbre abattu redevient adulte (abattable), ou `null` s'il ne repousse pas. */
export function adultAgainOn(trees: Settings['trees'], felledDay: number): number | null {
  if (!trees.regrow) return null;
  const counted = Math.max(felledDay, trees.regrowFromDay - trees.catchUpDays);
  return Math.max(trees.regrowFromDay, counted + trees.stumpDays + trees.saplingDays);
}
