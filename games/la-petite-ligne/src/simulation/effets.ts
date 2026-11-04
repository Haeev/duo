/**
 * Effets des données (README des données, section 4), exécutés dans l'ordre
 * par des suites (`world.scripts`): une scène lancée par `play_dialogue`
 * suspend la suite jusqu'à sa fin.
 */
import type { CharacterId } from '../etat/types';
import type { Effect } from '../donnees/types';
import { evaluate, NO_CONTEXT } from './conditions';
import { type Sim, character, emit, point, notifyKey } from './contexte';
import { sendLetter } from './courrier';
import { startScene } from './dialogues';
import { addBond, revealTaste } from './amitie';
import { payOrder } from './economie';
import { finishStage } from './fin';
import { spawnHens } from './poules';
import { startQuest } from './quetes';
import { dropAt, giveToCharacter, takeFromBag, takeFromStacks } from './sac';
import { storeAtHome } from './rangement';
import { gatherAt } from './deplacement';
import { revealToBoth } from './secrets';
import { secretEntry } from './conditions';
import { revealHabit } from './voisins';

/** Ajoute une suite d'effets et l'exécute tant qu'aucune scène ne l'arrête. */
export function runEffects(sim: Sim, effects: readonly Effect[], actor: CharacterId | null): void {
  if (effects.length === 0) return;
  sim.world.scripts.push({ effects: [...effects], actor });
  pumpScripts(sim);
}

export function pumpScripts(sim: Sim): void {
  if (sim.runtime.pumping) return;
  sim.runtime.pumping = true;
  try {
    const scripts = sim.world.scripts;
    while (scripts.length > 0 && sim.world.scene === null) {
      const script = scripts[0];
      if (script === undefined) break;
      const effect = script.effects.shift();
      if (effect === undefined) {
        scripts.shift();
        continue;
      }
      if (effect.type === 'if') {
        const branch = evaluate(sim, effect.condition, { ...NO_CONTEXT, actor: script.actor }) ? effect.then : effect.else;
        script.effects.unshift(...branch);
        continue;
      }
      if (effect.type === 'play_dialogue') {
        startScene(sim, effect.dialogue);
        continue;
      }
      applyEffect(sim, effect, script.actor);
    }
  } finally {
    sim.runtime.pumping = false;
  }
}

function targets(actor: CharacterId | null): CharacterId[] {
  return actor === null ? ['p1', 'p2'] : [actor];
}

function applyEffect(sim: Sim, effect: Exclude<Effect, { type: 'if' } | { type: 'play_dialogue' }>, actor: CharacterId | null): void {
  const { world } = sim;
  switch (effect.type) {
    case 'give_item':
      if (effect.to === 'cellar') {
        storeAtHome(sim, effect.item, 'ordinary', effect.count);
      } else {
        const entry = effect.to === 'informed' || effect.to === 'doer' ? secretEntry(sim, null) : null;
        const who: CharacterId[] =
          effect.to === 'each' ? ['p1', 'p2'] : effect.to === 'informed' || effect.to === 'doer' ? (entry === null ? targets(actor) : [entry[effect.to]]) : targets(actor);
        for (const id of who) giveToCharacter(sim, character(sim, id), effect.item, 'ordinary', effect.count);
      }
      return;
    case 'take_item': {
      if (effect.from === 'cellar') {
        takeFromStacks(world.cellar, effect.item, effect.count);
        return;
      }
      let left = effect.count;
      const order: CharacterId[] = effect.from === 'actor' ? targets(actor) : actor === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];
      for (const id of order) {
        const taken = takeFromBag(character(sim, id), effect.item, left);
        left -= taken.reduce((sum, s) => sum + s.count, 0);
      }
      return;
    }
    case 'give_money':
      world.purse += effect.amount;
      emit(sim, { type: 'money', amount: effect.amount });
      return;
    case 'take_money':
      // Comme un achat: rien sous zéro (le choix payant a vérifié la bourse avant).
      world.purse -= Math.min(world.purse, effect.amount);
      sim.runtime.changed = true;
      return;
    case 'set_flag':
      if (!world.flags.includes(effect.flag)) {
        world.flags.push(effect.flag);
        // Un drapeau peut poser un ouvrage (le banc d'Hortense): les cases bloquées se refont.
        sim.runtime.dynamicDirty = true;
        sim.runtime.changed = true;
      }
      return;
    case 'start_quest':
      startQuest(sim, effect.quest);
      return;
    case 'send_letter':
      sendLetter(sim, effect.letter);
      return;
    case 'unlock_recipe': {
      if (world.unlockedRecipes.includes(effect.recipe)) return;
      world.unlockedRecipes.push(effect.recipe);
      const recipe = sim.content.recipes[effect.recipe];
      if (recipe !== undefined) {
        const key = recipe.station === 'workbench' ? 'plan_unlocked' : 'recipe_unlocked';
        notifyKey(sim, 'both', 'message', key, { recipe: recipe.name });
      }
      emit(sim, { type: 'unlocked', recipe: effect.recipe });
      return;
    }
    case 'spawn_object': {
      const at = point(sim, effect.point);
      dropAt(sim, at.x, at.y, effect.item, 'ordinary', 1);
      return;
    }
    case 'spawn_animals':
      spawnHens(sim, effect.animal, effect.count, effect.names, effect.point, effect.shuffleVariantsBy);
      return;
    case 'reveal_secret':
      revealToBoth(sim, effect.quest);
      return;
    case 'set_need':
      for (const id of effect.who === 'both' ? (['p1', 'p2'] as const) : targets(actor)) {
        character(sim, id).needsSet[effect.need] = effect.value;
      }
      return;
    case 'gather_players':
      gatherAt(sim, effect.point);
      return;
    case 'show_text':
      notifyKey(sim, 'both', 'message', effect.text);
      return;
    case 'set_world_state':
      world.worldStates[effect.key] = effect.value;
      if (effect.key === 'handcar_shed' && effect.value === 'open') emit(sim, { type: 'shed_opened' });
      return;
    case 'pay_order':
      payOrder(sim);
      return;
    case 'end_stage':
      finishStage(sim, effect.stage);
      return;
    case 'reveal_habit':
      revealHabit(sim, { villager: effect.villager, habit: effect.habit }, 'noted', null, null);
      return;
    case 'add_bond':
      addBond(sim, effect.villager, effect.amount, actor);
      return;
    case 'reveal_taste':
      revealTaste(sim, effect.villager, effect.item, actor);
      return;
  }
}
