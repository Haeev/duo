/**
 * Quêtes du carnet en cartes (patch 0.12.2, `docs/jeux/jeu-1/interface-imagee-0-12-2.md`): pour
 * chaque quête, l'habitant ou le thème, l'étape en cours en une ligne, les conditions en icônes et
 * compteurs (« 3/8 » planches), le lieu en picto et la récompense en pastille. Fonctions pures sur
 * l'état, testées dans Node; `carnet.ts` les affiche.
 */
import type { Condition, QuestDef } from '../donnees/types';
import { questBaselines, questChecklist } from '../etat/quete';
import type { DeepReadonly, QuestState, ReadonlyWorld } from '../etat/types';
import { QUEST_COUNTER_ICONS, QUEST_GIVER_ICONS, QUEST_PLACES } from './config';
import type { UiContext } from './contexte';
import { capitalize, countIn, itemName, itemTitle } from './format';
import {
  type QuestModel,
  itemIcon,
  linesText,
  nextObjective,
  notebookQuests,
  orderFullAmount,
  orderLines,
  orderQuest,
} from './modele';
import type { SecretView } from './modele-secrets';
import { firstSentence } from './modele-vitrine';
import { villagerColors } from './portrait';

/** Une condition de l'étape: un compteur « fait / requis », ou une case à cocher. */
export interface QuestNeedModel {
  kind: 'count' | 'check';
  /** Symbole du sprite; `villager` a la priorité (portrait d'un habitant à qui parler). */
  icon: string;
  villager: string | null;
  have: number;
  need: number;
  done: boolean;
  /** Nom accessible complet (« 4 plumes : 1 sur 4 »). */
  label: string;
}

export interface QuestPlaceModel {
  icon: string;
  /** Habitant chez qui aller (portrait), ou `null`. */
  villager: string | null;
  label: string;
}

export interface QuestRewardModel {
  icon: string;
  text: string;
  label: string;
  tone: 'price' | 'info';
}

export type QuestGroup = 'main' | 'side' | 'annonce';

export interface QuestCardModel {
  id: string;
  group: QuestGroup;
  title: string;
  /** L'étape en cours en une phrase (la première du texte complet). */
  step: string;
  /** Le texte complet de l'étape (ou de la fin), pour le détail seulement. */
  text: string;
  done: boolean;
  withdrawn: boolean;
  /** Quête du prochain objectif du HUD. */
  current: boolean;
  /** Habitant au portrait dessiné, sinon `null` et `icon` (métier ou thème). */
  giver: string | null;
  giverName: string;
  icon: string;
  needs: QuestNeedModel[];
  /**
   * Les conditions de la carte: toutes jusqu'à trois; au-delà, un seul compteur « faites /
   * toutes » (les lignes de la commande: « 3/4 »), le détail les montrant une à une.
   */
  cardNeeds: QuestNeedModel[];
  place: QuestPlaceModel | null;
  rewards: QuestRewardModel[];
  secret: SecretView | null;
}

/** Au-delà de ce nombre de conditions, la carte les résume en un compteur. */
const CARD_NEEDS_MAX = 3;

export interface QuestBoardModel {
  open: number;
  done: number;
  cards: QuestCardModel[];
  /** Carte choisie à l'ouverture: l'objectif du HUD, sinon la première quête ouverte. */
  focus: string | null;
}

/** Objet d'un compteur d'étape (`given:basile:plank`, `crafted:craft_crate`...), ou `null`. */
function counterItem(ctx: UiContext, key: string): string | null {
  const [head = '', a, b] = key.split(':');
  switch (head) {
    case 'given':
      return b ?? null;
    case 'caught':
    case 'harvested':
    case 'picked':
    case 'placed':
    case 'ate':
    case 'stall_given':
      return a ?? null;
    case 'sowed':
      return a === undefined ? null : (ctx.content.crops[a]?.harvest ?? null);
    case 'crafted':
      return a === undefined ? null : (ctx.content.recipes[a]?.output.item ?? null);
    default:
      return null;
  }
}

function counterNow(
  world: ReadonlyWorld,
  state: DeepReadonly<QuestState>,
  key: string,
  since: string,
): number {
  const now = world.counters.duo[key] ?? 0;
  if (since === 'day_start') return world.countersToday.duo[key] ?? 0;
  if (since === 'step_start') return now - (questBaselines(state)[`duo:${key}`] ?? 0);
  return now;
}

/** Les conditions à plat (`all` ouvert; `any` et `not` gardés entiers, lus par leur case à cocher). */
function flatten(list: readonly Condition[]): Condition[] {
  return list.flatMap((c) => (c.type === 'all' ? flatten(c.conditions) : [c]));
}

function villagerLabel(ctx: UiContext, id: string): string {
  return ctx.content.villagers.find((v) => v.id === id)?.label ?? '';
}

function stepNeeds(
  world: ReadonlyWorld,
  ctx: UiContext,
  def: QuestDef,
  state: DeepReadonly<QuestState>,
): { needs: QuestNeedModel[]; place: QuestPlaceModel | null } {
  const v = ctx.texts.extra.vitrine;
  const step = def.steps[state.step];
  if (step === undefined) return { needs: [], place: null };
  const checklist = questChecklist(state);
  const needs: QuestNeedModel[] = [];
  let place: QuestPlaceModel | null = null;
  const placeAt = (key: string): void => {
    const p = QUEST_PLACES[key];
    if (p === undefined || place !== null) return;
    place = {
      icon: p.icon,
      villager: null,
      label: ctx.texts.extra.partner.places[p.place] ?? ctx.t(v.questPlaceSomewhere),
    };
  };
  for (const c of flatten(step.conditions)) {
    const checked = c.label === undefined ? undefined : checklist.find((i) => i.label === c.label);
    if (c.type === 'counter') {
      const [head, who] = c.key.split(':');
      if (head === 'given' && who !== undefined && place === null) {
        const name = villagerLabel(ctx, who);
        place = {
          icon: QUEST_GIVER_ICONS[who] ?? 'ui-pin',
          villager: villagerColors(who) === null ? null : who,
          label: ctx.t(v.questPlaceVillager, { villager: name }),
        };
      }
      if (head === 'talked' && who !== undefined) {
        const done = counterNow(world, state, c.key, c.since) >= c.count;
        const label = c.label ?? villagerLabel(ctx, who);
        needs.push({
          kind: 'check',
          icon: QUEST_GIVER_ICONS[who] ?? 'ui-letter',
          villager: villagerColors(who) === null ? null : who,
          have: done ? 1 : 0,
          need: 1,
          done,
          label: ctx.t(done ? v.questCheckDone : v.questCheckTodo, { label }),
        });
        continue;
      }
      const item = counterItem(ctx, c.key);
      const icon = item === null ? (QUEST_COUNTER_ICONS[head ?? ''] ?? null) : itemIcon(ctx, item);
      if (icon === null && c.label === undefined) continue;
      const have = Math.max(0, Math.min(c.count, counterNow(world, state, c.key, c.since)));
      const label =
        c.label ??
        (item === null
          ? ''
          : `${String(c.count)} ${itemName(ctx.content.items[item], c.count, item)}`);
      needs.push({
        kind: 'count',
        icon: icon ?? 'ui-check',
        villager: null,
        have,
        need: c.count,
        done: have >= c.count,
        label: ctx.t(v.questNeedLabel, { label, have, need: c.count }),
      });
      continue;
    }
    if (c.type === 'item_in_bag' || c.type === 'item_owned') {
      const bags = world.characters.map((ch) => countIn(ch.bag, c.item));
      const have = Math.min(
        c.count,
        c.type === 'item_in_bag'
          ? Math.max(0, ...bags)
          : bags.reduce((a, b) => a + b, 0) + countIn(world.cellar, c.item),
      );
      const label =
        c.label ?? `${String(c.count)} ${itemName(ctx.content.items[c.item], c.count, c.item)}`;
      needs.push({
        kind: 'count',
        icon: itemIcon(ctx, c.item),
        villager: null,
        have,
        need: c.count,
        done: have >= c.count,
        label: ctx.t(v.questNeedLabel, { label, have, need: c.count }),
      });
      continue;
    }
    if (c.type === 'stayed_at') placeAt(c.point);
    if (c.type === 'inside') placeAt(`building:${c.building}`);
    // Une condition nommée sans compteur lisible (poules appelées, choix): sa case à cocher.
    if (checked !== undefined && c.label !== undefined) {
      needs.push({
        kind: 'check',
        icon: c.type === 'hens_named' ? 'hen' : 'ui-check',
        villager: null,
        have: checked.done ? 1 : 0,
        need: 1,
        done: checked.done,
        label: ctx.t(checked.done ? v.questCheckDone : v.questCheckTodo, { label: c.label }),
      });
    }
  }
  return { needs, place };
}

function rewardsOf(ctx: UiContext, def: QuestDef): QuestRewardModel[] {
  const v = ctx.texts.extra.vitrine;
  const out: QuestRewardModel[] = [];
  const money = def.completionEffects.reduce(
    (n, e) => n + (e.type === 'give_money' ? e.amount : 0),
    0,
  );
  if (money > 0)
    out.push({
      icon: 'ui-coin',
      text: String(money),
      label: ctx.t(v.questReward, { amount: money }),
      tone: 'price',
    });
  for (const e of def.completionEffects) {
    if (out.length >= 2) break;
    if (e.type === 'give_item') {
      out.push({
        icon: itemIcon(ctx, e.item),
        text: e.count > 1 ? `×${String(e.count)}` : '',
        label: ctx.t(v.questGift, { item: itemTitle(ctx.content.items[e.item], e.count, e.item) }),
        tone: 'info',
      });
    } else if (e.type === 'unlock_recipe') {
      const output = ctx.content.recipes[e.recipe]?.output.item;
      if (output !== undefined)
        out.push({
          icon: itemIcon(ctx, output),
          text: '',
          label: ctx.t(v.questRecipe, { item: itemTitle(ctx.content.items[output], 1, output) }),
          tone: 'info',
        });
    }
  }
  return out;
}

function groupOf(q: QuestModel): QuestGroup {
  return q.id.startsWith('annonce') ? 'annonce' : q.kind;
}

/** Les quêtes du carnet en cartes: d'abord celles en cours (la semaine, les coups de main, les annonces), puis les finies. */
export function questBoard(world: ReadonlyWorld, ctx: UiContext): QuestBoardModel {
  const groups = notebookQuests(world, ctx);
  const order = orderQuest(ctx, world);
  const currentId = nextObjective(world, ctx)?.id ?? null;
  const all = [...groups.main, ...groups.side, ...groups.annonces];
  const sorted = [...all.filter((q) => !q.done), ...all.filter((q) => q.done)];
  const weekly = ctx.content.quests.find((q) => q.repeat === 'each_train') ?? null;
  const cards = sorted.map((q): QuestCardModel => {
    const synthetic = q.id.startsWith('order:') || q.id.startsWith('annonce:');
    const def = synthetic
      ? q.id.startsWith('order:')
        ? weekly
        : null
      : (ctx.content.quests.find((d) => d.id === q.id) ?? null);
    const state = world.quests.find((s) => s.id === q.id) ?? null;
    const isOrder =
      q.id.startsWith('order:') ||
      (order !== null && q.id === order.id) ||
      def?.repeat === 'each_train' ||
      (def?.steps.some((s) => s.resolve === 'at_deadline') ?? false);
    let needs: QuestNeedModel[] = [];
    let place: QuestPlaceModel | null = null;
    let rewards: QuestRewardModel[] = [];
    if (!q.done && def !== null && state !== null) {
      if (isOrder && q.id === order?.id) {
        needs = orderLines(world, ctx).map((l) => ({
          kind: 'count' as const,
          icon: l.icon,
          villager: null,
          have: Math.min(l.inCrate, l.need),
          need: l.need,
          done: l.done,
          label: ctx.t(ctx.texts.extra.vitrine.questNeedLabel, {
            label: capitalize(l.name),
            have: Math.min(l.inCrate, l.need),
            need: l.need,
          }),
        }));
        const crate = QUEST_PLACES.coop_crate;
        place =
          crate === undefined
            ? null
            : {
                icon: crate.icon,
                villager: null,
                label: ctx.texts.extra.partner.places[crate.place] ?? '',
              };
        const amount = orderFullAmount(ctx, world);
        rewards = [
          {
            icon: 'ui-coin',
            text: String(amount),
            label: ctx.t(ctx.texts.extra.vitrine.questOrderReward, { amount }),
            tone: 'price',
          },
        ];
      } else {
        ({ needs, place } = stepNeeds(world, ctx, def, state));
        rewards = rewardsOf(ctx, def);
      }
    }
    const giverId = def?.giver ?? '';
    const portrait = giverId !== '' && villagerColors(giverId) !== null;
    const group = groupOf(q);
    const icon = isOrder
      ? 'ui-train'
      : (QUEST_GIVER_ICONS[giverId] ??
        (group === 'annonce' ? 'ui-notice' : group === 'main' ? 'ui-flag' : 'ui-heart'));
    const doneNeeds = needs.filter((n) => n.done).length;
    const summary: QuestNeedModel = {
      kind: 'count',
      icon: isOrder ? 'crate' : 'ui-check',
      villager: null,
      have: doneNeeds,
      need: needs.length,
      done: doneNeeds === needs.length,
      label: isOrder
        ? linesText(ctx, doneNeeds, needs.length)
        : ctx.t(ctx.texts.extra.common.countOf, { have: doneNeeds, need: needs.length }),
    };
    return {
      id: q.id,
      group,
      title: q.title,
      step: q.text === '' ? '' : firstSentence(q.text),
      text: q.text,
      done: q.done,
      withdrawn: q.withdrawn,
      current: q.id === currentId,
      giver: portrait && !isOrder ? giverId : null,
      giverName: villagerLabel(ctx, giverId),
      icon,
      needs,
      cardNeeds: needs.length <= CARD_NEEDS_MAX ? needs : [summary],
      place,
      rewards,
      secret: q.secret,
    };
  });
  const open = cards.filter((c) => !c.done).length;
  // Un secret à transmettre n'est lu que par ce joueur: sa quête passe devant l'objectif du HUD.
  const focus =
    cards.find((c) => !c.done && c.secret?.kind === 'mine')?.id ??
    cards.find((c) => c.current)?.id ??
    cards.find((c) => !c.done)?.id ??
    cards[0]?.id ??
    null;
  return { open, done: cards.length - open, cards, focus };
}
