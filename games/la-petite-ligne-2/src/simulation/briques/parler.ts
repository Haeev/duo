/**
 * Action `talk`: ouvrir un dialogue avec un habitant. Le noyau choisit le dialogue, tourne
 * l'habitant vers le joueur et pose `player.talk`; le graphe (répliques, choix, effets) appartient
 * au lot L3 (`dialogues/`), qui avance et ferme le dialogue.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef } from '../../donnees/schemas/dialogue';
import type { SimContext } from '../noyau/systemes';
import type { EntityBehaviour, Look } from './types';

/**
 * Le dialogue que cet habitant ouvre: le plus prioritaire (à priorité égale, le premier des
 * données). Les conditions `when` et `once` seront évaluées ici par le moteur de règles du lot L3
 * (`regles/`); en l'attendant, seuls les dialogues sans condition sont candidats.
 */
export function openingDialogue(look: Look, villager: string): DialogueDef | null {
  const place = look.content.places[look.world.common.place];
  let best: DialogueDef | null = null;
  for (const dialogue of place?.dialogues ?? []) {
    if (dialogue.villager !== villager || dialogue.when.length > 0) continue;
    if (best === null || dialogue.priority > best.priority) best = dialogue;
  }
  return best;
}

export const talkBehaviour: EntityBehaviour = {
  verb: 'Parler',
  refuse(look, _player, id) {
    const state = look.world.places[look.world.common.place];
    if (state?.villagers[id] === undefined) return 'gone';
    return openingDialogue(look, id) === null ? 'nothing-to-say' : null;
  },
  use(sim, player, id) {
    const villager = sim.world.places[sim.world.common.place]?.villagers[id];
    const dialogue = openingDialogue(sim, id);
    if (villager === undefined || dialogue === null) return;
    const actor = sim.world.players[player];
    actor.talk = { villager: id, dialogue: dialogue.id, node: dialogue.start };
    villager.talkingWith = player;
    villager.met[player] = true;
    villager.body.facing = Math.atan2(
      actor.body.y - villager.body.y,
      actor.body.x - villager.body.x,
    );
    sim.touch('players');
    sim.touch('place');
    sim.emit({ type: 'talk_started', player, villager: id, dialogue: dialogue.id });
  },
};

/** Ferme le dialogue de ce joueur et libère l'habitant. Sans effet s'il ne parle pas. */
export function endTalk(sim: SimContext, player: PlayerIndex): void {
  const actor = sim.world.players[player];
  const talk = actor.talk;
  if (talk === null) return;
  actor.talk = null;
  sim.touch('players');
  const villager = sim.world.places[sim.world.common.place]?.villagers[talk.villager];
  if (villager?.talkingWith === player) {
    villager.talkingWith = null;
    sim.touch('place');
  }
  sim.emit({ type: 'talk_ended', player, villager: talk.villager });
}
