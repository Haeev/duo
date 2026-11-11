/**
 * Présence au joueur: regard, premier bonjour du jour, réactions à des actes déclarés, cadeaux.
 * Les souvenirs s'écrivent en faits datés (`habitants.<id>.<sujet>.j<joueur>`) que les dialogues
 * lisent par la condition `remembered`.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { VillagerDef } from '../../donnees/schemas/habitant';
import type { VillagerLife } from '../../donnees/schemas/vie-habitant';
import type { VillagerLifeState } from '../../etat/habitants';
import type { VillagerState } from '../../etat/lieu';
import { addBond } from '../dialogues/amitie';
import type { SimContext } from '../noyau/systemes';
import { bump, recall, remember } from '../regles/memoire';
import { takeOne } from '../sac/inventaire';
import { VILLAGERS } from './reglages';

export type GiftTaste = 'loved' | 'liked' | 'neutral' | 'disliked';

/** Clé d'un fait retenu par un habitant au sujet d'un joueur. */
export function villagerFactKey(villager: string, topic: string, player: PlayerIndex): string {
  return `habitants.${villager}.${topic}.j${String(player)}`;
}

export function showEmote(sim: SimContext, life: VillagerLifeState, emote: string): void {
  life.emote = emote;
  life.emoteUntil = sim.world.tick + Math.round(VILLAGERS.emoteSeconds / sim.dt);
  sim.touch('place');
}

function angleTo(from: { x: number; y: number }, to: { x: number; y: number }): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Tourne `facing` vers `target` d'au plus `turnSpeed * dt` (chemin le plus court). */
export function turnToward(facing: number, target: number, dt: number): number {
  let d = target - facing;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  const max = VILLAGERS.turnSpeed * dt;
  return facing + Math.max(-max, Math.min(max, d));
}

/** Le joueur le plus proche à moins de `radius`, ou `null`. */
function closestPlayer(sim: SimContext, x: number, y: number, radius: number): PlayerIndex | null {
  let best: PlayerIndex | null = null;
  let bestD = radius;
  for (const p of [0, 1] as const) {
    const b = sim.world.players[p].body;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Regard, bonjour et réactions, de près seulement. `still`: il n'est pas en marche (il peut
 * alors se tourner de tout le corps; assis ou en chemin, seul le regard suit).
 */
export function attend(
  sim: SimContext,
  def: VillagerDef,
  life: VillagerLife,
  villager: VillagerState,
  state: VillagerLifeState,
  still: boolean,
  partner: { x: number; y: number; id: string } | null,
  lastReact: Map<string, number>,
  listening: PlayerIndex | null = null,
): void {
  const body = villager.body;
  const talking = villager.talkingWith;
  // Celui à qui il parle, sinon celui qu'il écoute jouer, sinon le joueur le plus proche.
  const near = talking ?? listening ?? closestPlayer(sim, body.x, body.y, VILLAGERS.noticeRadius);
  const gaze: VillagerLifeState['gaze'] = near ?? partner?.id ?? null;
  if (state.gaze !== gaze) {
    state.gaze = gaze;
    sim.touch('place');
  }
  if (still && state.pose === 'stand') {
    const target = near !== null ? sim.world.players[near].body : partner;
    if (target !== null) body.facing = turnToward(body.facing, angleTo(body, target), sim.dt);
  }
  for (const p of [0, 1] as const) {
    const player = sim.world.players[p];
    const d = Math.hypot(player.body.x - body.x, player.body.y - body.y);
    if (d < VILLAGERS.greetRadius) {
      const key = villagerFactKey(def.id, 'salut', p);
      if (recall(sim.world, key)?.day !== sim.world.common.day) {
        remember(sim, key, true, p);
        showEmote(sim, state, life.greeting);
        sim.emit({ type: 'villager_greeted', villager: def.id, player: p, emote: life.greeting });
        continue;
      }
    }
    if (d >= VILLAGERS.reactRadius) continue;
    for (const reaction of life.reactions) {
      const seen =
        reaction.act === 'runs'
          ? player.body.speed > VILLAGERS.runSpeed
          : reaction.act === 'dirty'
            ? VILLAGERS.dirtyTiers.includes(player.tiers.hygiene)
            : player.gesture !== null && player.gesture.clip === reaction.clip;
      if (!seen) continue;
      const key = `${reaction.act}.${String(p)}`;
      const last = lastReact.get(key);
      const cooldown = Math.round(VILLAGERS.reactCooldown / sim.dt);
      if (last !== undefined && sim.world.tick - last < cooldown) continue;
      lastReact.set(key, sim.world.tick);
      showEmote(sim, state, reaction.emote);
      sim.emit({
        type: 'villager_reacted',
        villager: def.id,
        player: p,
        act: reaction.act,
        emote: reaction.emote,
      });
      break;
    }
  }
}

export function tasteOf(life: VillagerLife, item: string): GiftTaste {
  if (life.gifts.loved.includes(item)) return 'loved';
  if (life.gifts.liked.includes(item)) return 'liked';
  if (life.gifts.disliked.includes(item)) return 'disliked';
  return 'neutral';
}

/**
 * Offre l'objet en main. Un cadeau par jour, par joueur et par habitant (cahier 4.9). Refus
 * (événement `refused`) si mains vides, trop loin, déjà offert aujourd'hui, ou habitant absent.
 */
export function giveGift(
  sim: SimContext,
  player: PlayerIndex,
  def: VillagerDef,
  life: VillagerLife,
  villager: VillagerState,
  state: VillagerLifeState,
): void {
  const actor = sim.world.players[player];
  const stack = actor.selected === null ? null : (actor.toolbar[actor.selected] ?? null);
  const refuse = (reason: string): void => {
    sim.emit({ type: 'refused', player, reason, target: def.id });
  };
  if (state.presence !== 'here') {
    refuse('gone');
    return;
  }
  if (stack === null) {
    refuse('empty-hands');
    return;
  }
  const d = Math.hypot(actor.body.x - villager.body.x, actor.body.y - villager.body.y);
  if (d > VILLAGERS.giftReach) {
    refuse('too-far');
    return;
  }
  const key = villagerFactKey(def.id, 'cadeau', player);
  if (recall(sim.world, key)?.day === sim.world.common.day) {
    refuse('gift-already-today');
    return;
  }
  const item = stack.item;
  if (
    actor.selected === null ||
    takeOne(actor, { area: 'toolbar', index: actor.selected }) === null
  ) {
    refuse('empty-hands');
    return;
  }
  sim.touch('players');
  const taste = tasteOf(life, item);
  const rule = VILLAGERS.gift[taste];
  const points = rule.points > 0 ? addBond(sim, player, def.id, rule.points) : 0;
  remember(sim, key, item, player);
  bump(sim, villagerFactKey(def.id, 'cadeaux', player), player);
  if (taste === 'loved') remember(sim, villagerFactKey(def.id, 'adore', player), item, player);
  showEmote(sim, state, rule.emote);
  villager.body.facing = angleTo(villager.body, actor.body);
  sim.emit({ type: 'villager_gift', villager: def.id, player, item, taste, points });
}
