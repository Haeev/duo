/** Contrôles croisés des plans, appelés par `donnees/valider.ts`: chaque faute nomme son fichier. */
import type { Content } from '../../donnees/charger';

export function checkPlans(content: Content): string[] {
  const problems: string[] = [];
  const stations = new Set<string>();
  for (const prop of Object.values(content.props))
    for (const brick of prop.bricks) if (brick.brick === 'craft') stations.add(brick.station);
  for (const plan of Object.values(content.plans)) {
    const at = `commun/plans/${plan.id}.json`;
    const known = (item: string, what: string): void => {
      if (!(item in content.items)) problems.push(`${at}: ${what} inconnu « ${item} »`);
    };
    for (const m of plan.materials) known(m.item, 'matériau');
    if (plan.paper !== undefined) known(plan.paper, 'plan papier');
    if (plan.source === 'start' && plan.paper !== undefined)
      problems.push(`${at}: un plan connu dès le début n'a pas de plan papier`);
    if (!stations.has(plan.station))
      problems.push(`${at}: aucun meuble n'a de poste « ${plan.station} » (brique craft)`);
    switch (plan.makes.kind) {
      case 'furniture':
        for (const variant of plan.makes.variants) {
          known(variant.item, 'meuble');
          const family = content.items[variant.item]?.family;
          if (family !== undefined && family !== 'furniture')
            problems.push(`${at}: « ${variant.item} » n'est pas un meuble (famille furniture)`);
        }
        break;
      case 'item':
        known(plan.makes.item, 'objet');
        break;
      case 'upgrade': {
        known(plan.makes.from, 'outil');
        if ((content.items[plan.makes.from]?.tool?.work?.upgrade ?? null) === null)
          problems.push(`${at}: « ${plan.makes.from} » n'a pas d'amélioration (tool.work.upgrade)`);
        if (plan.materials.length > 0)
          problems.push(
            `${at}: les matériaux d'une amélioration sont ceux de l'outil (tool.work.upgrade)`,
          );
        break;
      }
    }
    if (plan.delay !== undefined && plan.makes.kind !== 'upgrade')
      problems.push(`${at}: « delay » ne vaut que pour une amélioration`);
  }
  return problems;
}
