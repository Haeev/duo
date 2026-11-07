/**
 * Extensions de l'adresse (terrasse, pièce du fond): le plan du level designer change quand les
 * travaux sont finis (arche percée, store posé). Fonctions pures, cache par jeu d'extensions:
 * les collisions (`simulation/collisions.ts`) et le rendu de la coque lisent le plan ouvert.
 */
import type { Content } from '../donnees/charger';
import type { Plan, PlanElement } from '../donnees/schemas';
import type { World } from '../etat/monde';

const cache = new WeakMap<Content, Map<string, Plan>>();

function keyOf(opened: readonly string[]): string {
  return [...opened].sort().join('|');
}

/** Plan de l'adresse avec les extensions `opened` construites. */
export function planWith(content: Content, opened: readonly string[]): Plan {
  if (opened.length === 0) return content.plan;
  let byKey = cache.get(content);
  if (byKey === undefined) {
    byKey = new Map();
    cache.set(content, byKey);
  }
  const key = keyOf(opened);
  const hit = byKey.get(key);
  if (hit !== undefined) return hit;
  const remove = new Set<string>();
  const add: PlanElement[] = [];
  const restyle = new Map<string, string>();
  for (const id of opened) {
    const works = content.arrangement.extensions.get(id)?.works;
    if (works === undefined) continue;
    for (const r of works.planRemove) remove.add(r);
    for (const el of works.planAdd) add.push(el);
    for (const [el, style] of Object.entries(works.planRestyle ?? {})) restyle.set(el, style);
  }
  const [first, ...rest] = content.plan.levels;
  if (first === undefined) return content.plan;
  const elements = first.elements
    .filter((el) => !remove.has(el.id))
    .map((el) => {
      const style = restyle.get(el.id);
      return style === undefined ? el : { ...el, style };
    });
  const plan: Plan = {
    ...content.plan,
    levels: [{ ...first, elements: [...elements, ...add] }, ...rest],
  };
  byKey.set(key, plan);
  return plan;
}

/** Plan en vigueur dans ce monde. */
export function currentPlan(content: Content, world: World): Plan {
  return planWith(content, world.arrangement.extensions);
}

/** Une pièce de l'adresse est ouverte au public (la salle toujours, une extension une fois finie). */
export function roomOpen(world: World, extension: string | null): boolean {
  return extension === null || world.arrangement.extensions.includes(extension);
}
