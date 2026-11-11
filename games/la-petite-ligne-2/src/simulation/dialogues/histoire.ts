/**
 * Ce qui passe avant la boutique au comptoir tenu (`commerces/brique.ts`): la seule réplique
 * d'HISTOIRE du commerçant. Un commerçant a toujours quelque chose à dire (souvenirs, confidences,
 * cadeaux, fêtes): si tout cela passait d'abord, on n'achèterait plus sans épuiser ses répliques.
 * Tout le reste se dit par « Parler » de l'écran de boutique, ou en face de lui.
 *
 * Rien à déclarer dans les dialogues: l'histoire se lit dans les suites de quêtes du lieu.
 * Pur: l'hôte s'en sert pour agir, l'invité et l'interface pour afficher le même verbe.
 */
import type { Content, PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import type { ReadonlyWorld } from '../../etat/monde';
import { activeSteps } from '../quetes/moteur';
import { countHeld } from '../regles/conditions';
import { awaitsAnswer, heardThisDay, playableDialogues } from './conversation';

interface StoryLook {
  readonly content: Content;
  readonly world: ReadonlyWorld;
}

/** Étape d'une suite qui attend un dialogue ou qui l'ouvre. */
interface StoryLink {
  readonly quest: string;
  readonly step: string;
}

const LINKS = new WeakMap<PlaceContent, ReadonlyMap<string, readonly StoryLink[]>>();

/**
 * Pour chaque dialogue du lieu, les étapes qui en font une réplique d'histoire, lues une fois
 * dans les données: l'étape l'attend (`talked` de son `done`), ou elle l'ouvre (un `remember` de
 * son `onStart` écrit le fait que le `when` du dialogue lit avec `equals`).
 */
function storyLinks(place: PlaceContent): ReadonlyMap<string, readonly StoryLink[]> {
  const known = LINKS.get(place);
  if (known !== undefined) return known;
  const links = new Map<string, StoryLink[]>();
  const add = (dialogue: string, link: StoryLink): void => {
    const list = links.get(dialogue);
    if (list === undefined) links.set(dialogue, [link]);
    else list.push(link);
  };
  for (const line of Object.values(place.quests))
    for (const chapter of line.chapters)
      for (const step of chapter.steps) {
        const link: StoryLink = { quest: line.id, step: step.id };
        for (const c of step.done) if (c.type === 'talked') add(c.dialogue, link);
        for (const effect of step.onStart) {
          if (effect.type !== 'remember') continue;
          for (const dialogue of place.dialogues)
            if (
              dialogue.when.some(
                (c) => c.type === 'remembered' && c.key === effect.key && c.equals === effect.value,
              )
            )
              add(dialogue.id, link);
        }
      }
  LINKS.set(place, links);
  return links;
}

/**
 * Ce dialogue est une réplique d'histoire pour ce joueur, en ce moment: une étape OUVERTE d'une
 * suite en cours du lieu l'attend ou l'a ouvert, ou attend que ce joueur remette à cet habitant
 * les objets qu'il tient (`deliver`). L'étape franchie, il redevient une réplique ordinaire.
 */
export function isStoryLine(look: StoryLook, player: PlayerIndex, dialogue: DialogueDef): boolean {
  const place = look.content.places[look.world.common.place];
  if (place === undefined) return false;
  const quests = look.world.progress.quests;
  for (const link of storyLinks(place).get(dialogue.id) ?? []) {
    const state = quests[link.quest];
    const line = place.quests[link.quest];
    if (state === undefined || state.done || line === undefined) continue;
    if (activeSteps(line, state.passed ?? []).some((step) => step.id === link.step)) return true;
  }
  const actor = look.world.players[player];
  for (const line of Object.values(place.quests)) {
    const state = quests[line.id];
    if (state === undefined || state.done) continue;
    for (const step of activeSteps(line, state.passed ?? []))
      for (const c of step.done)
        if (
          c.type === 'deliver' &&
          c.villager === dialogue.villager &&
          countHeld(actor, c.item) >= c.count
        )
          return true;
  }
  return false;
}

/**
 * Ce dialogue soulage sans rien demander un besoin à 0 de ce joueur (la soupe offerte à qui a
 * faim et pas un sou): au besoin à 0, la touche d'action ne sert qu'à ce qui le soulage (cahier
 * 4.4), le comptoir compris. Une réplique qui fait payer ou prend un objet ne compte pas: la
 * boutique sert alors mieux.
 */
function relievesBlockedNeed(
  world: ReadonlyWorld,
  player: PlayerIndex,
  dialogue: DialogueDef,
): boolean {
  const tiers = world.players[player].tiers;
  for (const node of Object.values(dialogue.nodes)) {
    const lists =
      node.kind === 'effects'
        ? [node.effects]
        : node.kind === 'choice'
          ? node.options.map((o) => o.effects)
          : [];
    for (const effects of lists) {
      if (effects.some((e) => e.type === 'take_money' || e.type === 'take_item')) continue;
      if (
        effects.some((e) => e.type === 'change_need' && e.amount > 0 && tiers[e.need] === 'blocked')
      )
        return true;
    }
  }
  return false;
}

/**
 * La réplique que ce commerçant dit par-dessus son comptoir avant d'ouvrir la boutique, `null`:
 * la boutique s'ouvre. Parmi ses dialogues jouables, du plus prioritaire au moins prioritaire:
 *
 * - une décision à deux qui attend la réponse de ce joueur passe, même déjà entendue;
 * - une réplique d'histoire (`isStoryLine`) ou de secours (`relievesBlockedNeed`) passe une fois:
 *   un dialogue `once` s'épuise de lui-même, un dialogue à volonté ne repasse pas le jour où ce
 *   joueur l'a entendu;
 * - un dialogue à volonté plus prioritaire (la remarque d'hygiène) masque l'histoire, comme en
 *   face: la boutique s'ouvre;
 * - un dialogue `once` qui n'est pas de l'histoire (souvenir, confidence, cadeau) ne compte pas:
 *   il attend « Parler ».
 */
export function counterDialogue(
  look: StoryLook,
  player: PlayerIndex,
  villager: string,
): DialogueDef | null {
  for (const dialogue of playableDialogues(look, player, villager)) {
    if (awaitsAnswer(look.world, player, dialogue)) return dialogue;
    if (isStoryLine(look, player, dialogue) || relievesBlockedNeed(look.world, player, dialogue)) {
      if (dialogue.once !== null) return dialogue;
      return heardThisDay(look.world, player, dialogue) ? null : dialogue;
    }
    if (dialogue.once === null) return null;
  }
  return null;
}
