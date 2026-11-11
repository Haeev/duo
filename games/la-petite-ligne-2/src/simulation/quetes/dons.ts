/**
 * Dons d'histoire des scènes et des lettres (`give_item`): comme ceux des dialogues et des étapes,
 * ils ne tombent jamais au sol. Une scène ne s'arrête pas pour autant: si les poches de quelqu'un
 * n'ont pas la place pour tout, rien ne lui est donné et le don attend, retenu par le fait
 * `dons.<lieu>.<source>.j<n>` (valeur `scene-<temps>` ou `lettre`). Il part dès qu'il y a de la
 * place, avec le refus « poches pleines » redit toutes les 5 s en attendant. La mémoire part chez
 * l'invité et se sauvegarde: rien de plus à transmettre, et une partie reprise garde ses dons.
 */
import type { PlayerIndex } from '../../donnees/schemas/communs';
import type { StepEffect } from '../../donnees/schemas/quete';
import type { Effect } from '../../donnees/schemas/regles';
import { exchangeRefusal, effectTargets } from '../dialogues/echanges';
import type { SimContext } from '../noyau/systemes';
import { applyEffects } from '../regles/effets';
import { forget, playerFactKey, remember } from '../regles/memoire';
import { STORY } from './reglages';

type Gift = Extract<Effect, { type: 'give_item' }>;

const PREFIX = 'dons';
const LETTER = 'lettre';
const SCENE = 'scene-';

/** Les dons de ces effets qui reviennent à `player`, à lui donner en propre. */
function giftsFor(effects: readonly StepEffect[], actor: PlayerIndex, player: PlayerIndex): Gift[] {
  const out: Gift[] = [];
  for (const e of effects)
    if (e.type === 'give_item' && effectTargets(actor, e.to).includes(player))
      out.push({ type: 'give_item', item: e.item, count: e.count });
  return out;
}

/** Donne tout, ou rien et le don attend (poches pleines). */
function giveOrKeep(
  sim: SimContext,
  player: PlayerIndex,
  gifts: readonly Gift[],
  key: string,
  value: string,
): void {
  if (gifts.length === 0) return;
  const refused = exchangeRefusal(sim, player, gifts);
  if (refused === null) {
    applyEffects(sim, player, gifts);
    return;
  }
  remember(sim, playerFactKey(key, player), value, player);
  sim.emit({ type: 'refused', player, reason: 'pockets-full', target: null });
}

/**
 * Applique les effets d'une scène ou d'une lettre: les dons à chacun, tout ou rien, le reste
 * comme d'habitude (`apply`). `source`: identifiant de la scène ou de la lettre dans `place`.
 */
export function applyWithGifts<E extends StepEffect>(
  sim: SimContext,
  actor: PlayerIndex,
  effects: readonly E[],
  from: { readonly place: string; readonly source: string; readonly beat: number | null },
  apply: (rest: readonly E[]) => void,
): void {
  apply(effects.filter((e) => e.type !== 'give_item'));
  const key = `${PREFIX}.${from.place}.${from.source}`;
  const value = from.beat === null ? LETTER : `${SCENE}${String(from.beat)}`;
  for (const p of [0, 1] as const) giveOrKeep(sim, p, giftsFor(effects, actor, p), key, value);
}

/** Les dons que retient ce fait en attente, `null` si sa source n'existe plus. */
function waitingGifts(sim: SimContext, key: string, value: unknown): Gift[] | null {
  const [, place, source] = key.split('.');
  const content = place === undefined ? undefined : sim.content.places[place];
  if (content === undefined || source === undefined) return null;
  if (value === LETTER) {
    const letter = content.orders?.letters[source];
    return letter === undefined ? null : giftsFor(letter.attach, 0, 0);
  }
  if (typeof value !== 'string' || !value.startsWith(SCENE)) return null;
  const beat = content.scenes[source]?.beats[Number(value.slice(SCENE.length))];
  return beat?.do === 'effects' ? giftsFor(beat.effects, 0, 0) : null;
}

/** Donne les dons en attente qui tiennent maintenant dans les poches (hôte, à chaque contrôle). */
export function payWaitingGifts(sim: SimContext): void {
  const memory = sim.world.progress.memory;
  for (const key in memory) {
    if (!key.startsWith(`${PREFIX}.`)) continue;
    const player: PlayerIndex | null = key.endsWith('.j0') ? 0 : key.endsWith('.j1') ? 1 : null;
    if (player === null) continue;
    const gifts = waitingGifts(sim, key, memory[key]?.v);
    if (gifts === null) {
      forget(sim, key);
      continue;
    }
    if (exchangeRefusal(sim, player, gifts) === null) {
      applyEffects(sim, player, gifts);
      forget(sim, key);
    } else if (sim.world.tick % STORY.giftReminderTicks < STORY.checkEveryTicks)
      sim.emit({ type: 'refused', player, reason: 'pockets-full', target: null });
  }
}
