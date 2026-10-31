/**
 * Notifications: retrouver de quel message de `textes.json` vient un texte
 * (pour choisir l'icône et le style), et décider lesquelles sont à l'écran.
 * Fonctions pures; le composant du HUD tient les horloges réelles.
 */
import type { GameNotification, NotificationKind } from '../etat/types';
import { notificationKey } from './adaptateur';

export type ToastVariant = '' | 'error' | 'event';

export interface ToastVisual {
  variant: ToastVariant;
  icon: string;
  /** Le jeton de l'autre joueur à la place de l'icône (« Déjà pris par Sacha. »). */
  partnerToken: boolean;
}

const plain = (icon: string): ToastVisual => ({ variant: '', icon, partnerToken: false });
const error = (icon: string): ToastVisual => ({ variant: 'error', icon, partnerToken: false });
const event = (icon: string): ToastVisual => ({ variant: 'event', icon, partnerToken: false });

/** Style de chaque message de `textes.json` (clé absente: style selon la sorte de notification). */
const MESSAGE_VISUALS: Readonly<Record<string, ToastVisual>> = {
  already_taken: { variant: '', icon: '', partnerToken: true },
  not_enough_money: error('ui-warning'),
  bag_full: error('ui-warning'),
  grocer_not_buying: error('ui-warning'),
  grocer_daily_cap: error('ui-warning'),
  catalogue_closed: error('ui-lock'),
  no_energy: error('ui-stamina'),
  needs_both: error('ui-warning'),
  train_arrived: event('ui-train'),
  train_leaves_soon: event('ui-train'),
  train_left: event('ui-train'),
  midnight_return: event('ui-moon'),
  roof_attic_glint: event('ui-star'),
  riddle_found: event('key'),
  clock_waits: plain('ui-hourglass'),
  partner_waits_scene: plain('ui-hourglass'),
  scene_waits: plain('ui-pin'),
  big_purchase_proposal: plain('ui-coin'),
  big_purchase_accepted: plain('ui-check'),
  big_purchase_declined: plain('ui-cross'),
  big_purchase_cancelled: plain('ui-cross'),
  catalogue_ordered: plain('parcel'),
  crate_deposited: plain('parcel'),
  recipe_unlocked: plain('ui-note'),
  plan_unlocked: plain('ui-note'),
  envie_done: plain('ui-heart'),
  quest_started: plain('ui-flag'),
  quest_step_done: plain('ui-flag'),
  quest_done: plain('ui-check'),
  letter_received: plain('ui-letter'),
  built: plain('ui-house'),
  hens_arrived: plain('egg'),
  eggs_found: plain('egg'),
  fine_quality: plain('ui-star'),
  riddle_not_yet: plain('ui-hourglass'),
  nothing_here: plain('ui-note'),
};

const KIND_VISUALS: Readonly<Record<NotificationKind, ToastVisual>> = {
  hint: plain('ui-note'),
  message: plain('ui-note'),
  quest: plain('ui-flag'),
  letter: plain('ui-letter'),
  proposal: plain('ui-coin'),
  envie: plain('ui-heart'),
};

const compiled = new WeakMap<Readonly<Record<string, string>>, readonly { key: string; pattern: RegExp }[]>();

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patterns(messages: Readonly<Record<string, string>>): readonly { key: string; pattern: RegExp }[] {
  let list = compiled.get(messages);
  if (list === undefined) {
    list = Object.entries(messages).map(([key, template]) => {
      const source = template
        .split(/\{[a-zA-Z]+\}/)
        .map(escapeRegExp)
        .join('(.+?)');
      return { key, pattern: new RegExp(`^${source}$`, 'su') };
    });
    compiled.set(messages, list);
  }
  return list;
}

/** Clé du message de `textes.json` dont vient ce texte, ou `null`. */
export function messageKeyOf(text: string, messages: Readonly<Record<string, string>>): string | null {
  for (const { key, pattern } of patterns(messages)) if (pattern.test(text)) return key;
  return null;
}

export function toastVisual(notification: Readonly<GameNotification>, messages: Readonly<Record<string, string>>): ToastVisual {
  const key = notificationKey(notification) ?? messageKeyOf(notification.text, messages);
  return (key === null ? undefined : MESSAGE_VISUALS[key]) ?? KIND_VISUALS[notification.kind];
}

/**
 * Notifications à montrer: les plus récentes arrivées depuis moins de
 * `durationMs` (horloge réelle), au plus `max`, la plus récente en bas.
 * `seenAt`: instant où l'interface a vu chaque notification la première fois.
 */
export function visibleToasts<T extends { id: number }>(
  list: readonly T[],
  seenAt: ReadonlyMap<number, number>,
  now: number,
  durationMs: number,
  max: number,
): T[] {
  const fresh = list.filter((n) => {
    const at = seenAt.get(n.id);
    return at !== undefined && now - at < durationMs;
  });
  return fresh.slice(Math.max(0, fresh.length - max));
}
