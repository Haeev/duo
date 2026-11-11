/**
 * Conversation d'un joueur avec un habitant. Chacun parle de son côté: l'état ne porte que le
 * nœud affiché de chaque joueur (`player.talk`). Les nœuds sans texte (aiguillage, effets) se
 * traversent d'un coup; une réplique ou un choix s'arrête et part en événement `talk_page`
 * (le babil et le défilement sont locaux).
 */
import type { PlaceContent } from '../../donnees/charger';
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { DialogueDef, DialogueNode, DialogueScreenId } from '../../donnees/schemas/dialogue';
import type { Effect } from '../../donnees/schemas/regles';
import type { ReadonlyWorld } from '../../etat/monde';
import type { Content } from '../../donnees/charger';
import type { SimContext } from '../noyau/systemes';
import { evaluateAll, type RuleContext } from '../regles/conditions';
import { applyEffects } from '../regles/effets';
import { recall, remember } from '../regles/memoire';
import { RULES } from '../regles/reglages';
import { choiceOf, decisionState } from '../quetes/decisions';
import { agreeFor } from './accords';
import { greet } from './amitie';
import { faceToFace, shopClosedLine, shopOffered, talkingShop } from './commerce';
import { exchangeRefusal, type ExchangeRefusal } from './echanges';
import { DIALOGUES } from './reglages';
import { orderOffered } from '../commandes/lecture';

/** Au-delà, un parcours sans texte est une faute de données: on s'arrête plutôt que boucler. */
const MAX_SILENT_NODES = 32;

function placeContent(content: Content, world: ReadonlyWorld): PlaceContent | null {
  return content.places[world.common.place] ?? null;
}

function ruleContext(sim: SimContext, player: PlayerIndex): RuleContext {
  return { world: sim.world, content: sim.content, actor: player };
}

/**
 * Clé du « déjà joué » d'un dialogue `once`. Le fait vaut `true` quand le dialogue est allé au
 * bout; tant qu'il est entamé, il vaut le nœud affiché: un dialogue fermé avant sa fin (touche
 * Retour, partie quittée puis reprise) se reprend là où il s'était arrêté, sans rejouer ses
 * effets déjà appliqués. Sans cela, une étape de quête qui attend sa fin restait bloquée.
 */
export function onceKey(place: string, dialogue: DialogueDef, player: PlayerIndex): string {
  const base = `dialogues.${place}.${dialogue.id}`;
  return dialogue.once === 'player' ? `${base}.j${String(player)}` : base;
}

function onceAuthor(dialogue: DialogueDef, player: PlayerIndex): PlayerIndex | 'duo' {
  return dialogue.once === 'duo' ? 'duo' : player;
}

/** Nœud où reprendre un dialogue `once` entamé, `null`: jamais ouvert (ou nœud disparu des données). */
function resumeNode(
  world: ReadonlyWorld,
  place: string,
  dialogue: DialogueDef,
  player: PlayerIndex,
): string | null {
  const at = recall(world, onceKey(place, dialogue, player))?.v;
  return typeof at === 'string' && Object.hasOwn(dialogue.nodes, at) ? at : null;
}

/** Le dialogue à jouer: le plus prioritaire dont les conditions sont vraies et qui n'est pas épuisé. */
export function pickDialogue(
  sim: { readonly world: ReadonlyWorld; readonly content: Content },
  player: PlayerIndex,
  villager: string,
): DialogueDef | null {
  const place = placeContent(sim.content, sim.world);
  if (place === null) return null;
  const ctx: RuleContext = { world: sim.world, content: sim.content, actor: player };
  let best: DialogueDef | null = null;
  for (const dialogue of place.dialogues) {
    if (dialogue.villager !== villager) continue;
    if (dialogue.once !== null) {
      const played = recall(sim.world, onceKey(place.def.id, dialogue, player));
      // Allé au bout: épuisé. Entamé: il se reprend, sauf si l'autre le lit en ce moment (`duo`).
      const other: PlayerIndex = player === 0 ? 1 : 0;
      const busy = sim.world.players[other].talk?.dialogue === dialogue.id;
      if (played !== null && (typeof played.v !== 'string' || (dialogue.once === 'duo' && busy)))
        continue;
    }
    if (!evaluateAll(ctx, dialogue.when)) continue;
    if (best === null || dialogue.priority > best.priority) best = dialogue;
  }
  return best;
}

/** Clé du fait « entendu » d'un dialogue qui se répète et qui a quelque chose à dire. */
export function heardKey(place: string, dialogue: DialogueDef, player: PlayerIndex): string {
  return `${DIALOGUES.heardPrefix}.${place}.${dialogue.id}.j${String(player)}`;
}

/**
 * Fois où ce joueur a ouvert ce dialogue aujourd'hui, d'après le fait « entendu » (sa valeur
 * compte les écoutes du jour; `true`, d'une sauvegarde d'avant le compte, vaut une).
 */
function heardToday(world: ReadonlyWorld, key: string): number {
  const fact = recall(world, key);
  if (fact?.day !== world.common.day) return 0;
  return typeof fact.v === 'number' ? fact.v : 1;
}

/**
 * Ce joueur réentend ce dialogue d'histoire ou de quête: il l'avait déjà ouvert aujourd'hui avant
 * cette conversation-ci. La boutique lui est alors proposée derrière, comme après le quotidien.
 */
export function heardAgain(
  look: { readonly world: ReadonlyWorld },
  player: PlayerIndex,
  dialogue: DialogueDef,
): boolean {
  if (dialogue.once !== null) return false;
  return heardToday(look.world, heardKey(look.world.common.place, dialogue, player)) >= 2;
}

/** Ce dialogue a quelque chose à dire (histoire, quête, souvenir), au-delà du quotidien. */
export function hasNews(dialogue: DialogueDef): boolean {
  return dialogue.priority >= DIALOGUES.pendingPriority;
}

/**
 * Ce dialogue attend encore la réponse de ce joueur à une décision à deux qu'il offre (option à
 * effet `choose`): il n'a rien choisi, ou les deux avis divergent et il peut changer d'avis.
 */
function awaitsAnswer(world: ReadonlyWorld, player: PlayerIndex, dialogue: DialogueDef): boolean {
  for (const node of Object.values(dialogue.nodes)) {
    if (node.kind !== 'choice') continue;
    for (const option of node.options)
      for (const effect of option.effects) {
        if (effect.type !== 'choose') continue;
        const state = decisionState(world, effect.decision);
        if (state === 'split') return true;
        if (state !== 'agreed' && choiceOf(world, effect.decision, player) === null) return true;
      }
  }
  return false;
}

/**
 * Le dialogue que cet habitant a en attente pour ce joueur, `null` s'il n'a que le quotidien à
 * dire: le plus prioritaire, s'il a quelque chose à dire et n'a pas déjà été entendu ce jour (un
 * dialogue `once` ne se rejoue jamais, il est donc toujours neuf). Une décision à deux qui attend
 * la réponse de ce joueur le garde en attente, même entendu.
 */
export function pendingDialogue(
  look: { readonly world: ReadonlyWorld; readonly content: Content },
  player: PlayerIndex,
  villager: string,
): DialogueDef | null {
  const dialogue = pickDialogue(look, player, villager);
  if (dialogue === null || !hasNews(dialogue)) return null;
  if (dialogue.once !== null || awaitsAnswer(look.world, player, dialogue)) return dialogue;
  const heard = recall(look.world, heardKey(look.world.common.place, dialogue, player));
  return heard !== null && heard.day === look.world.common.day ? null : dialogue;
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

/** Montre la page réservée qui propose la boutique du commerçant (`commerce.ts`), si elle s'offre. */
function offerShop(sim: SimContext, player: PlayerIndex, dialogue: DialogueDef): boolean {
  const talk = sim.world.players[player].talk;
  if (talk === null) return false;
  const again = heardAgain(sim, player, dialogue) && faceToFace(sim, player, talk.villager);
  let speaker = 'player';
  // Qui reçoit la commande de la semaine la propose d'abord, tant qu'il y a de quoi faire.
  if (orderOffered(sim, talk.villager)) talk.node = DIALOGUES.orderOffer.node;
  else if (shopOffered(sim, talk.villager, dialogue, again) !== null)
    talk.node = DIALOGUES.shopOffer.node;
  else if (shopClosedLine(sim, talk.villager, dialogue, again) !== null) {
    // Fermé par un événement: le commerçant le dit, à la place de l'offre.
    talk.node = DIALOGUES.shopClosed.node;
    speaker = talk.villager;
  } else return false;
  sim.touch('players');
  sim.emit({ type: 'talk_page', player, villager: talk.villager, node: talk.node, speaker });
  return true;
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
      case 'effects': {
        const refused =
          node.otherwise === undefined ? null : exchangeRefusal(sim, player, node.effects);
        if (refused !== null) {
          const villager = sim.world.players[player].talk?.villager ?? null;
          sim.emit({ type: 'refused', player, reason: refused, target: villager });
          id = node.otherwise ?? null;
          continue;
        }
        applyEffects(sim, player, node.effects);
        id = node.next;
        continue;
      }
      case 'line':
      case 'choice': {
        const talk = sim.world.players[player].talk;
        if (talk === null) return;
        talk.node = id;
        if (dialogue.once !== null)
          remember(
            sim,
            onceKey(sim.world.common.place, dialogue, player),
            id,
            onceAuthor(dialogue, player),
          );
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
  // Allé au bout (ou arrêté par une faute de données): un dialogue `once` ne se rejouera plus.
  if (dialogue.once !== null)
    remember(
      sim,
      onceKey(sim.world.common.place, dialogue, player),
      true,
      onceAuthor(dialogue, player),
    );
  // Fin naturelle (et non faute de données): le commerçant propose encore sa boutique.
  if (id === null && offerShop(sim, player, dialogue)) return;
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
  // Un dialogue `once` entamé puis fermé reprend au nœud où il s'était arrêté.
  const from =
    dialogue.once === null
      ? dialogue.start
      : (resumeNode(sim.world, place.def.id, dialogue, player) ?? dialogue.start);
  if (dialogue.once !== null)
    remember(sim, onceKey(place.def.id, dialogue, player), from, onceAuthor(dialogue, player));
  else if (hasNews(dialogue)) {
    // Fois entendues ce jour (une ancienne sauvegarde a `true`: une fois).
    const key = heardKey(place.def.id, dialogue, player);
    remember(sim, key, heardToday(sim.world, key) + 1, player);
  }
  state.talk = { villager, dialogue: dialogue.id, node: from };
  villagerState.met[player] = true;
  villagerState.talkingWith = player;
  sim.touch('players');
  sim.touch('place');
  greet(sim, player, villager);
  sim.emit({ type: 'talk_started', player, villager, dialogue: dialogue.id });
  enter(sim, player, dialogue, from);
  return true;
}

/** Réplique lue: au nœud suivant. Sans effet sur un choix (il attend `choose`). */
export function talkNext(sim: SimContext, player: PlayerIndex): void {
  const talk = sim.world.players[player].talk;
  const dialogue = currentDialogue(sim, player);
  if (talk === null) return;
  if (dialogue === null || talk.node === DIALOGUES.shopClosed.node) {
    endTalk(sim, player);
    return;
  }
  const node = dialogue.nodes[talk.node];
  if (node?.kind !== 'line') return;
  enter(sim, player, dialogue, node.next);
}

/**
 * Choix d'une option visible; un échange que l'hygiène fait échouer, ou impossible (poches
 * pleines, argent insuffisant, objet manquant), est refusé avec sa raison et le choix reste.
 */
export function talkChoose(sim: SimContext, player: PlayerIndex, optionId: string): void {
  const talk = sim.world.players[player].talk;
  const dialogue = currentDialogue(sim, player);
  if (talk === null || dialogue === null) return;
  if (talk.node === DIALOGUES.orderOffer.node) {
    const { open, leave } = DIALOGUES.orderOffer;
    if (optionId === open)
      sim.emit({ type: 'order_opened', player, place: sim.world.common.place });
    else if (optionId !== leave) return;
    endTalk(sim, player);
    return;
  }
  if (talk.node === DIALOGUES.shopOffer.node) {
    const shop = talkingShop(sim, talk.villager);
    // L'effet refuse lui-même une boutique fermée entre-temps (`shop-closed`).
    if (shop !== null && optionId === DIALOGUES.shopOffer.open)
      applyEffects(sim, player, [{ type: 'open_shop', shop: shop.id }]);
    else if (optionId !== DIALOGUES.shopOffer.leave) return;
    endTalk(sim, player);
    return;
  }
  const node = dialogue.nodes[talk.node];
  if (node?.kind !== 'choice') return;
  const option = node.options.find((o) => o.id === optionId);
  if (option === undefined || !evaluateAll(ruleContext(sim, player), option.when)) return;
  if (failsForHygiene(sim.world, player, option.effects)) {
    sim.emit({ type: 'refused', player, reason: 'too-dirty', target: talk.villager });
    return;
  }
  const refused = exchangeRefusal(sim, player, option.effects);
  if (refused !== null) {
    sim.emit({ type: 'refused', player, reason: refused, target: talk.villager });
    return;
  }
  applyEffects(sim, player, option.effects);
  enter(sim, player, dialogue, option.next);
}

/** Ce que la fenêtre de dialogue (lot L7) affiche pour ce joueur, ou `null`. */
export interface TalkView {
  readonly villager: string;
  readonly node: string;
  /** Identifiant de l'habitant, ou `player`. Texte déjà accordé au genre des joueurs (cahier 1.5). */
  readonly speaker: string;
  readonly text: string | null;
  readonly emote: string | null;
  /**
   * Options visibles; `fails`: l'échange échouera (goutte barrée), on sait pourquoi avant de
   * choisir; `blocked`: l'échange est impossible pour l'instant (raison de refus, texte `refusals`).
   */
  readonly options: readonly {
    id: string;
    text: string;
    fails: 'hygiene' | null;
    blocked: ExchangeRefusal | null;
  }[];
  /** Écran que cette réplique ouvre une fois lue (`opens` du nœud), `null`: aucun. */
  readonly opens: DialogueScreenId | null;
}

/** La page qui propose la boutique: deux options, textes du commerce, rien d'échangé. */
function shopOfferView(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
  villager: string,
): TalkView | null {
  const shop = talkingShop({ content, world }, villager);
  if (shop?.talk === undefined) return null;
  const { node, open, leave } = DIALOGUES.shopOffer;
  return {
    villager,
    node,
    speaker: 'player',
    text: null,
    emote: null,
    options: [
      { id: open, text: agreeFor(world, player, shop.talk.open), fails: null, blocked: null },
      { id: leave, text: agreeFor(world, player, shop.talk.leave), fails: null, blocked: null },
    ],
    opens: null,
  };
}

/** La page qui propose la livraison: deux options, textes du guichet (`commande.json`). */
function orderOfferView(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
  villager: string,
): TalkView | null {
  const desk = content.places[world.common.place]?.orders?.desk;
  if (desk === undefined) return null;
  const { node, open, leave } = DIALOGUES.orderOffer;
  return {
    villager,
    node,
    speaker: 'player',
    text: null,
    emote: null,
    options: [
      { id: open, text: agreeFor(world, player, desk.talk.open), fails: null, blocked: null },
      { id: leave, text: agreeFor(world, player, desk.talk.leave), fails: null, blocked: null },
    ],
    opens: null,
  };
}

export function talkView(
  content: Content,
  world: ReadonlyWorld,
  player: PlayerIndex,
): TalkView | null {
  const talk = world.players[player].talk;
  if (talk === null) return null;
  if (talk.node === DIALOGUES.orderOffer.node)
    return orderOfferView(content, world, player, talk.villager);
  if (talk.node === DIALOGUES.shopOffer.node)
    return shopOfferView(content, world, player, talk.villager);
  if (talk.node === DIALOGUES.shopClosed.node) {
    const text = talkingShop({ content, world }, talk.villager)?.lines?.closed;
    if (text === undefined) return null;
    return {
      villager: talk.villager,
      node: talk.node,
      speaker: talk.villager,
      text: agreeFor(world, player, text),
      emote: null,
      options: [],
      opens: null,
    };
  }
  const dialogue = placeContent(content, world)?.dialogues.find((d) => d.id === talk.dialogue);
  const node = dialogue?.nodes[talk.node];
  if (node === undefined) return null;
  if (node.kind === 'line')
    return {
      villager: talk.villager,
      node: talk.node,
      speaker: node.speaker,
      text: agreeFor(world, player, node.text),
      emote: node.emote,
      options: [],
      opens: node.opens ?? null,
    };
  if (node.kind !== 'choice') return null;
  const ctx: RuleContext = { world, content, actor: player };
  const options = node.options
    .filter((o) => evaluateAll(ctx, o.when))
    .map((o) => ({
      id: o.id,
      text: agreeFor(world, player, o.text),
      fails: failsForHygiene(world, player, o.effects) ? ('hygiene' as const) : null,
      blocked: exchangeRefusal({ world, content }, player, o.effects),
    }));
  return {
    villager: talk.villager,
    node: talk.node,
    speaker: 'player',
    text: null,
    emote: null,
    options,
    opens: null,
  };
}
