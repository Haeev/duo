/**
 * Contrôle des verrous et des portes au chargement (branché dans `donnees/valider.ts`): l'objet
 * visible existe et porte la brique `passage`, une porte à la touche d'action a son objet, le
 * commerce d'une porte existe. Une faute nomme le lieu et l'élément.
 */
import type { Content, PlaceContent } from '../../donnees/charger';

function passageProblem(content: Content, place: PlaceContent, object: string): string | null {
  const found = place.map.objects.find((o) => o.id === object);
  if (found === undefined) return `objet inconnu « ${object} »`;
  const def = content.props[found.type];
  if (def?.bricks.some((b) => b.brick === 'passage') !== true)
    return `l'objet « ${object} » (${found.type}) n'a pas la brique passage`;
  return null;
}

function checkPlace(content: Content, place: PlaceContent, problems: string[]): void {
  const at = `lieu ${place.def.id}`;
  const users = new Map<string, string>();
  const claim = (object: string, by: string): void => {
    const other = users.get(object);
    if (other !== undefined)
      problems.push(`${at}, ${by}: l'objet « ${object} » sert déjà à ${other}`);
    users.set(object, by);
  };
  for (const [id, lock] of Object.entries(place.map.locks ?? {})) {
    if (lock.object === null) continue;
    const problem = passageProblem(content, place, lock.object);
    if (problem !== null) problems.push(`${at}, verrou ${id}: ${problem}`);
    claim(lock.object, `verrou ${id}`);
  }
  for (const [id, door] of Object.entries(place.map.doors ?? {})) {
    const where = `${at}, porte ${id}`;
    if (door.enter === 'act' && door.object === undefined)
      problems.push(`${where}: une porte à la touche d'action demande un objet visible`);
    if (door.object !== undefined) {
      const problem = passageProblem(content, place, door.object);
      if (problem !== null) problems.push(`${where}: ${problem}`);
      claim(door.object, `porte ${id}`);
    }
    if (door.shop !== undefined && !(door.shop in place.shops))
      problems.push(`${where}: commerce inconnu « ${door.shop} »`);
  }
}

export function validatePassages(content: Content): string[] {
  const problems: string[] = [];
  for (const place of Object.values(content.places)) checkPlace(content, place, problems);
  return problems;
}
