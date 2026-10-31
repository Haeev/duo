/**
 * Notifications: retrouver de quel message de `textes.json` vient un texte
 * (pour choisir l'icône et le style), et décider lesquelles sont à l'écran.
 * Fonctions pures; le composant du HUD tient les horloges réelles.
 */
import type { GameNotification, NotificationKind } from '../etat/types';
import { type RefusalTexts, isRefusal } from './refus';
import { fill, type TextVars } from './format';

/**
 * `moment`: l'apogée d'un moment rare, vue à deux; `whisper`: ce qui n'est dit qu'à un seul
 * (confidence du matin, coup de coude de R16); `hen`: une poule qui réagit à son nom.
 */
export type ToastVariant = '' | 'error' | 'event' | 'moment' | 'whisper' | 'hen';

export interface ToastVisual {
  variant: ToastVariant;
  icon: string;
  /** Le jeton de l'autre joueur à la place de l'icône (« Déjà pris par Sacha. »). */
  partnerToken: boolean;
  /** Réplique de la poule à ajouter (un mauvais nom: « Cot ? »). */
  henAside?: boolean;
}

const plain = (icon: string): ToastVisual => ({ variant: '', icon, partnerToken: false });
const error = (icon: string): ToastVisual => ({ variant: 'error', icon, partnerToken: false });
const event = (icon: string): ToastVisual => ({ variant: 'event', icon, partnerToken: false });
const moment = (): ToastVisual => ({ variant: 'moment', icon: 'ui-eye', partnerToken: false });
const whisper = (): ToastVisual => ({ variant: 'whisper', icon: 'ui-whisper', partnerToken: false });

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
  placement_not_yours: error('ui-warning'),
  corner_not_yours: error('ui-warning'),
  corner_taken: error('ui-warning'),
  corner_partner_things: error('ui-warning'),
  corner_outside: error('ui-warning'),
  corner_set: plain('ui-check'),
  corner_moved: plain('ui-check'),
  corner_removed: plain('ui-cross'),
  corner_partner_set: { variant: '', icon: '', partnerToken: true },
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
  // Moments rares (tour 6): l'apogée et l'invitation à montrer, la pause de l'échelle.
  heron_seen: moment(),
  geese_seen: moment(),
  moment_notice: event('ui-eye'),
  ladder_hold_on: plain('ui-eye'),
  ladder_hold_taken: { variant: '', icon: '', partnerToken: true },
  // Informations propres (R16): ce qui n'est dit qu'à un seul, et les poules qui répondent.
  secret_nudge_hens: whisper(),
  secret_nudge_lucie: whisper(),
  hen_names_informed_call: whisper(),
  secret_first_try: event('ui-star'),
  hen_named_right: { variant: 'hen', icon: 'hen', partnerToken: false },
  hen_named_wrong: { variant: 'hen', icon: 'hen', partnerToken: false, henAside: true },
};

/** Textes des moments rares nommés par motif (`moment_<id>_climax`, `moment_<id>_hint`): un moment ajouté a son style. */
const MOMENT_PATTERNS: readonly { pattern: RegExp; visual: ToastVisual }[] = [
  { pattern: /^moment_[a-z_]+_climax$/, visual: moment() },
  { pattern: /^moment_[a-z_]+_hint$/, visual: whisper() },
];

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

export function toastVisual(
  notification: Readonly<GameNotification>,
  messages: Readonly<Record<string, string>>,
  refusal: RefusalTexts = { missingTemplate: null },
): ToastVisual {
  const key = notification.key ?? messageKeyOf(notification.text, messages);
  const known = key === null ? undefined : (MESSAGE_VISUALS[key] ?? MOMENT_PATTERNS.find((p) => p.pattern.test(key))?.visual);
  if (known !== undefined) return known;
  // Un refus sans style propre (refus de pose, coin de l'autre, matériaux manquants): le style d'erreur.
  if (isRefusal({ kind: notification.kind, key, text: notification.text }, refusal)) return error('ui-warning');
  return KIND_VISUALS[notification.kind];
}

/**
 * Texte à afficher. Sans texte dans `textes.json`, la simulation donne la clé
 * du message (coin à soi): l'interface prend alors le sien, si elle l'a.
 */
export function toastText(n: Readonly<GameNotification>, messages: Readonly<Record<string, string>>, vars: TextVars): string {
  const template = n.key !== null && n.text === n.key ? messages[n.key] : undefined;
  return template === undefined ? n.text : fill(template, vars);
}

/** Deux notifications de même sorte et de même texte n'en font qu'une à l'écran. */
export function toastKey(n: Readonly<{ kind: string; text: string }>): string {
  return `${n.kind}|${n.text}`;
}

/**
 * Une seule notification par texte (la plus récente: son délai repart de
 * zéro), dans l'ordre d'arrivée de cette dernière. La simulation peut répéter
 * un message (« Camille t'attend pour la suite. » à chaque appui, « Rien
 * ici… » à chaque coup de bêche): l'écran ne l'empile pas.
 */
export function dedupeToasts<T extends { id: number; kind: string; text: string }>(list: readonly T[]): T[] {
  const latest = new Map<string, T>();
  for (const n of list) {
    const key = toastKey(n);
    const known = latest.get(key);
    if (known === undefined || n.id > known.id) latest.set(key, n);
  }
  return [...latest.values()].sort((a, b) => a.id - b.id);
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
