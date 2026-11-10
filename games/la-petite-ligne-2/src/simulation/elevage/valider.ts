/** Contrôles croisés de la basse-cour, appelés par `donnees/valider.ts`. */
import type { Content } from '../../donnees/charger';

export function validateFarmContent(content: Content): string[] {
  const problems: string[] = [];
  for (const species of Object.values(content.species)) {
    const at = `commun/especes/${species.id}.json`;
    if (content.items[species.food] === undefined)
      problems.push(`${at}, food: objet « ${species.food} » inconnu`);
    let previous = -1;
    for (const quality of species.product.qualities) {
      if (content.items[quality.item] === undefined)
        problems.push(`${at}, product: objet « ${quality.item} » inconnu`);
      if (quality.hearts <= previous)
        problems.push(`${at}, product: les cœurs des qualités doivent monter`);
      if (quality.hearts > species.affection.hearts)
        problems.push(`${at}, product: ${String(quality.hearts)} cœurs, plus que le maximum`);
      previous = quality.hearts;
    }
    if (species.roam.out >= species.roam.in)
      problems.push(`${at}, roam: la sortie doit précéder la rentrée`);
    if (new Set(species.robes.map((robe) => robe.id)).size !== species.robes.length)
      problems.push(`${at}, robes: identifiant en double`);
  }
  for (const prop of Object.values(content.props))
    for (const brick of prop.bricks) {
      if (brick.brick !== 'shelter') continue;
      const at = `commun/meubles/${prop.id}.json, shelter`;
      const species = content.species[brick.species];
      if (species === undefined) {
        problems.push(`${at}: espèce « ${brick.species} » inconnue`);
        continue;
      }
      const first = brick.places[0]?.count ?? 0;
      if (brick.starters.length > first)
        problems.push(`${at}: plus de bêtes au départ que de places`);
      for (const starter of brick.starters)
        if (!species.robes.some((robe) => robe.id === starter.robe))
          problems.push(`${at}: robe « ${starter.robe} » inconnue de « ${species.id} »`);
    }
  return problems;
}
