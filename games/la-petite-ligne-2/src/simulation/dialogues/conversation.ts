/**
 * Conversation d'un joueur avec un habitant. Chacun parle de son côté: l'état ne porte que le
 * nœud affiché de chaque joueur (`player.talk`). Les nœuds sans texte (aiguillage, effets) se
 * traversent d'un coup; une réplique ou un choix s'arrête et part en événement `talk_page`
 * (le babil et le défilement sont locaux).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef, DialogueNode } from '../../donnees/schemas/dialogue';
import type { Effect } from '../../donnees/schemas/regles';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Content } from '../../donnees/charger';
import type { SimContext } from '../noyau/systemes';
import { evaluateAll, type RuleContext } from '../regles/conditions';
import { applyEffects } from '../regles/effets';
import { recall, remember } from '../regles/memoire';
import { RULES } from '../regles/reglages';
import { greet } from './amitie';

/** Au-delà, un parcours sans texte est une faute de données: on s'arrête plutôt que boucler. */
const MAX_SILENT_NODES = 32;

function placeContent(content: Content, world: ReadonlyWorld): PlaceContent | null {
  return content.places[world.common.place] ?? null;
}

function ruleContext(sim: SimContext, player: PlayerIndex): RuleContext {
  return { world: sim.world, content: sim.content, actor: player };
}

/** Clé du « déjà joué » d'un dialogue `once`. */
export function onceKey(place: string, dialogue: DialogueDef, player: PlayerIndex): string {
  const base = `dialogues.${place}.${dialogue.id}`;
  return dialogue.once === 'player' ? `${base}.j${String(player)}` : base;
}

/** Le dialogue à jouer: le plus prioritaire dont les conditions sont vraies et qui n'est pas épuisé. */
export function pickDialogue(
  sim: SimContext,
  player: PlayerIndex,
  villager: string,
): DialogueDef | null {
  const place = placeContent(sim.content, sim.world);
  if (place === null) return null;
  const ctx = ruleContext(sim, player);
  let best: DialogueDef | null = null;
  for (const dialogue of place.dialogues) {
    if (dialogue.villager !== villager) continue;
    if (
      dialogue.once !== null &&
      recall(sim.world, onceKey(place.def.id, dialogue, player)) !== null
    )
      continue;
    if (!evaluateAll(ctx, dialogue.when)) continue;
    if (best === null || dialogue.priority > best.priority) best = dialogue;
  }
  return best;
}

/** Une option est un échange (effets qui comptent) et l'hygiène du joueur la fait échouer. */
export function failsForHygiene(
  world: ReadonlyWorld,
  player: PlayerIndex,
  effects: readonly Effect[],
): boolean {
  if (!RULES.dialogue.failHygiene.includes(world.players[player].tiers.hygiene)) return false;
  return effects.some((effect) => RULES.dialogue.exchangeEffects.includes(effect.type));
}

function currentDialogue(sim: SimContext, player: PlayerIndex): DialogueDef | null {
  const talk = sim.world.players[player].talk;
  if (talk === null) return null;
  return (
    placeContent(sim.content, sim.world)?.dialogues.find((d) => d.id === talk.dialogue) ?? null
  );
}

export function endTalk(sim: SimContext, player: PlayerIndex): void {
  const state = sim.world.players[player];
  const talk = state.talk;
  if (talk === null) return;
  state.talk = null;
  const villager = sim.world.places[sim.world.common.place]?.villagers[talk.villager];
  if (villager?.talkingWith === player) {
    const other: PlayerIndex = player === 0 ? 1 : 0;
    villager.talkingWith = sim.world.players[other].talk?.villager === talk.villager ? other : null;
    sim.touch('place');
  }
  sim.touch('players');
  sim.emit({ type: 'talk_ended', player, villager: talk.villager });
}

/** Avance jusqu'à la prochaine réplique ou au prochain choix; `null`: fin du dialogue. */
function enter(
  sim: SimContext,
  player: PlayerIndex,
  dialogue: DialogueDef,
  start: string | null,
): void {
  const ctx = ruleContext(sim, player);
  let id = start;
  for (let guard = 0; id !== null && guard < MAX_SILENT_NODES; guard++) {
    const node: DialogueNode | undefined = dialogue.nodes[id];
    if (node === undefined) break;
    switch (node.kind) {
      case 'branch':
        id = node.cases.find((c) => evaluateAll(ctx, c.when))?.next ?? node.otherwise;
        continue;
      case 'effects':
        applyEffects(sim, player, node.effects);
        id = node.next;
        continue;
      case 'line':
      case 'choice': {
        const talk = sim.world.players[player].talk;
        if (talk === null) return;
        talk.node = id;
        sim.touch('players');
        sim.emit({
          type: 'talk_page',
          player,
          villager: talk.villager,
          node: id,
          speaker: node.kind === 'line' ? node.speaker : 'player',
        });
        return;
      }
    }
  }
  endTalk(sim, player);
}

/** Ouvre la conversation (touche d'action sur un habitant). `false` s'il n'a rien à dire. */
export function startTalk(sim: SimContext, player: PlayerIndex, villager: string): boolean {
  const state = sim.world.players[player];
  const place = placeContent(sim.content, sim.world);
  const villagerState = sim.world.places[sim.world.common.place]?.villagers[villager];
  if (state.talk !== null || place === null || villagerState === undefined) return false;
  const dialogue = pickDialogue(sim, player, villager);
  if (dialogue === null) {
    sim.emit({ type: 'refused', player, reason: 'nothing-to-say', target: villager });
    return false;
  }
  if (dialogue.once !== null)
    remember(
      sim,
      onceKey(place.def.id, dialogue, player),
      true,
      dialogue.once === 'duo' ? 'duo' : player,
    );
  state.talk = { villager, dialogue: dialogue.id, node: dialogue.start };
  villagerState.met[player] = true;
  villagerState.talkingWith = player;
  sim.touch('players');
  sim.touch('place');
  greet(sim, player, villager);
  sim.emit({ type: 'talk_started', player, villager, dialogue: dialogue.id });
  enter(sim, player, dialogue, dialogue.start);
  return true;
}

/** Réplique lue: au nœud suivant. Sans effet sur un choix (il attend `choose`). */
export function talkNext(sim: SimContext, player: PlayerIndex): void {
  const talk = sim.world.players[player].talk;
  const dialogue = currentDialogue(sim, player);
  if (talk === null) return;
  if (dialogue === null) {
    endTalk(sim, player);
    return;
  }
  const node = dialogue.nodes[talk.node];
  if (node?.kind !== 'line') return;
  enter(sim, player, dialogue, node.next);
}

/** Choix d'une option visible; un échange que l'hygiène fait échouer est refusé et le choix reste. */
export function talkChoose(sim: SimContext, player: PlayerIndex, optionId: string): void {
  const talk = sim.world.players[player].talk;
  const dialogue = currentDialogue(sim, player);
  if (talk === null || dialogue === null) return;
  const node = dialogue.nodes[talk.node];
  if (node?.kind !== 'choice') return;
  const option = node.options.find((o) => o.id === optionId);
  if (option === undefined || !evaluateAll(ruleContext(sim, player), option.when)) return;
  if (failsForHygiene(sim.world, player, option.effects)) {
    sim.emit({ type: 'refused', player, reason: 'too-dirty', target: talk.villager });
    return;
  }
  applyEffects(sim, player, option.effects);
  enter(sim, player, dialogue, option.next);
}

/** Ce que la fenêtre de dialogue (lot L7) affiche pour ce joueur, ou `null`. */
export interface TalkView {
  readonly villager: string;
  readonly node: string;
  /** Identifiant de l'habitant, ou `player`. Texte brut: les accords se résolvent à l'affichage. */
  readonly speaker: string;
  readonly text: string | null;
  readonly emote: string | null;
  /** Options visibles; `fails`: l'échange échouera (goutte barrée), on sait pourquoi avant de choisir. */
  readonly options: readonly { id: string; text: string; fails: 'hygiene' | null }[];
}

export function talkView(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): TalkView | null {
  const talk = world.players[player].talk;
  if (talk === null) return null;
  const dialogue = placeContent(content, world)?.dialogues.find((d) => d.id === talk.dialogue);
  const node = dialogue?.nodes[talk.node];
  if (node === undefined) return null;
  if (node.kind === 'line')
    return {
      villager: talk.villager,
      node: talk.node,
      speaker: node.speaker,
      text: node.text,
      emote: node.emote,
      options: [],
    };
  if (node.kind !== 'choice') return null;
  const ctx: RuleContext = { world, content, actor: player };
  const options = node.options
    .filter((o) => evaluateAll(ctx, o.when))
    .map((o) => ({
      id: o.id,
      text: o.text,
      fails: failsForHygiene(world, player, o.effects) ? ('hygiene' as const) : null,
    }));
  return {
    villager: talk.villager,
    node: talk.node,
    speaker: 'player',
    text: null,
    emote: null,
    options,
  };
}
