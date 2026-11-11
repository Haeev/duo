/**
 * Ce que lisent le rendu, l'interface, le son et les commerces, chez l'hôte comme chez l'invité:
 * fonctions pures de l'état transmis et du contenu.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { VillagerLifeState } from '../../etat/habitants';
import { pickDialogue } from '../dialogues/conversation';
import { closedByEvent } from '../monde/agenda';
import { inRange, type Look } from './planning';
import { VILLAGERS } from './reglages';

/** Pour le rendu: posture, activité, geste, émotion et regard d'un habitant. */
export interface VillagerView {
  /** `false`: absent du lieu (pas encore arrivé, reparti): ne pas le dessiner. */
  readonly visible: boolean;
  readonly pose: VillagerLifeState['pose'];
  readonly activity: string | null;
  readonly gesture: string | null;
  /** Onomatopée affichée au-dessus de la tête, `null`: aucune. */
  readonly emote: string | null;
  /** Joueur ou habitant regardé (la tête suit), `null`: droit devant. */
  readonly gaze: PlayerIndex | string | null;
}

const STILL: VillagerView = {
  visible: true,
  pose: 'stand',
  activity: null,
  gesture: null,
  emote: null,
  gaze: null,
};

export function villagerView(look: Look, villager: string): VillagerView | null {
  const state = look.world.places[look.world.common.place]?.villagers[villager];
  if (state === undefined) return null;
  const life = state.life;
  if (life === undefined) return { ...STILL, gaze: state.talkingWith };
  return {
    visible: life.presence !== 'away',
    pose: life.pose,
    activity: life.activity,
    gesture: life.gesture,
    emote: look.world.tick < life.emoteUntil ? life.emote : null,
    gaze: life.gaze,
  };
}

/**
 * Commerce ouvert: son commerçant est à son poste sur une ligne de planning qui tient ce commerce.
 * Un commerçant sans planning suit les heures écrites du commerce. Un événement qui le ferme
 * (`closes`) l'emporte.
 */
export function isShopOpen(look: Look, shop: string): boolean {
  const place = look.content.places[look.world.common.place];
  const def = place?.shops[shop];
  if (place === undefined || def === undefined || closedByEvent(look, shop)) return false;
  const keeper = place.villagers.find((v) => v.id === def.keeper);
  const state = look.world.places[look.world.common.place]?.villagers[def.keeper];
  if (keeper === undefined || state === undefined) return false;
  if (keeper.life === undefined || state.life === undefined)
    return inRange(look.world.minutes, def.hours.from, def.hours.to);
  const entry = keeper.life.schedule[state.life.entry];
  return state.life.presence === 'here' && state.life.activity !== null && entry?.shop === shop;
}

/**
 * Bulle « a quelque chose pour toi » au-dessus de l'habitant, pour ce joueur: un dialogue
 * prioritaire l'attend, ou l'étape en cours d'une suite de quêtes le désigne.
 */
export function hasSomethingFor(look: Look, villager: string, player: PlayerIndex): boolean {
  const state = look.world.places[look.world.common.place]?.villagers[villager];
  if (state === undefined || state.life?.presence === 'away') return false;
  const dialogue = pickDialogue(look, player, villager);
  if (dialogue !== null && dialogue.priority >= VILLAGERS.bubblePriority) return true;
  const place = look.content.places[look.world.common.place];
  for (const [id, progress] of Object.entries(look.world.progress.quests)) {
    if (progress.done) continue;
    const line = place?.quests[id];
    const chapter = line?.chapters.find((c) => c.id === progress.chapter);
    const step = chapter?.steps.find((s) => s.id === progress.step);
    const target = step?.target;
    if (
      target !== null &&
      target !== undefined &&
      'villager' in target &&
      target.villager === villager
    )
      return true;
  }
  return false;
}
