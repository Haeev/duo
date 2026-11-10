/**
 * Contrôles croisés des recettes de cuisine, appelés par `donnees/valider.ts`: une faute nomme son
 * fichier et son champ.
 */
import type { Content } from '../../donnees/charger';
import { recipeSeconds } from './recettes';

/** Durée d'un mini-jeu de cuisine (interface.md 5.6, mission cuisine): 15 à 40 s. */
const MINIGAME_SECONDS = { min: 15, max: 40 } as const;

export function checkRecipes(content: Content): string[] {
  const problems: string[] = [];
  for (const recipe of Object.values(content.recipes)) {
    const at = `commun/recettes/${recipe.id}.json`;
    const items = [
      ...(recipe.second?.inputs ?? []),
      ...(recipe.quality?.good === undefined ? [] : [recipe.quality.good]),
      ...(recipe.quality?.perfect === undefined ? [] : [recipe.quality.perfect]),
      ...(recipe.learn?.book === undefined ? [] : [{ item: recipe.learn.book }]),
    ];
    for (const { item } of items)
      if (!(item in content.items)) problems.push(`${at}: objet inconnu « ${item} »`);
    if (recipe.station === 'workbench') continue;
    const first = recipe.steps?.length ?? 0;
    for (const step of recipe.second?.steps ?? [])
      if (step.after !== undefined && step.after >= first)
        problems.push(
          `${at}: second.steps: « after » ${String(step.after)} sans étape de la première part`,
        );
    if (recipe.second !== undefined && content.items[recipe.output.item]?.meal === undefined)
      problems.push(`${at}: un repas à deux donne un objet « meal »`);
    if (recipe.second !== undefined && recipe.steps === undefined)
      problems.push(`${at}: un repas à deux a des étapes`);
    if (recipe.steps !== undefined) {
      const seconds = recipeSeconds(recipe);
      if (seconds < MINIGAME_SECONDS.min || seconds > MINIGAME_SECONDS.max)
        problems.push(
          `${at}: steps: mini-jeu de ${seconds.toFixed(1)} s, attendu entre ${String(MINIGAME_SECONDS.min)} et ${String(MINIGAME_SECONDS.max)} s`,
        );
    }
  }
  return problems;
}
