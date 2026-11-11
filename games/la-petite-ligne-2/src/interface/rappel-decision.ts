/**
 * Rappel durable d'une décision à deux (cahier 4.10): tant qu'elle est ouverte et que l'un au
 * moins a choisi, un bandeau discret du HUD et une ligne de l'onglet Quêtes nomment la décision,
 * le choix de l'autre et comment répondre; en désaccord, les deux choix. L'avis de 4 s
 * (`decision_changed`) ne fait qu'annoncer le changement. Lecture pure de l'état reçu: l'hôte et
 * l'invité affichent la même chose, chacun de son point de vue.
 */
import type { Content } from '../donnees/charger';
import type { PlayerIndex } from '../donnees/schemas/communs';
import type { ReadonlyWorld } from '../etat/monde';
import { decisionReminders, type DecisionReminder } from '../simulation/quetes/lecture';
import { el, icon, setText } from './dom';
import { UI_TUNING } from './reglages';
import { fill, TEXTS } from './textes';

const T = TEXTS.notices.decisionReminder;

export interface ReminderText {
  /** « Décision à deux : <titre de la suite> ». */
  readonly head: string;
  readonly body: string;
}

/** Les deux lignes du rappel, du point de vue de qui lit; `other`: le prénom de l'autre joueur. */
export function reminderText(reminder: DecisionReminder, other: string): ReminderText {
  const habitant = reminder.villager?.name ?? T.nobody;
  const head = fill(T.head, { titre: reminder.title });
  const values = { nom: other, habitant };
  if (reminder.state === 'split')
    return {
      head,
      body: fill(T.split, { ...values, mien: reminder.mine ?? '', sien: reminder.theirs ?? '' }),
    };
  return reminder.theirs !== null
    ? { head, body: fill(T.theirs, { ...values, choix: reminder.theirs }) }
    : { head, body: fill(T.mine, { ...values, choix: reminder.mine ?? '' }) };
}

/** Le rappel de chaque décision ouverte pour ce joueur, dans l'ordre des suites. */
export function decisionReminderTexts(
  world: ReadonlyWorld,
  content: Content,
  me: PlayerIndex,
): readonly (ReminderText & { readonly quest: string; readonly split: boolean })[] {
  const other = world.players[me === 0 ? 1 : 0].name;
  return decisionReminders(world, content, me).map((r) => ({
    ...reminderText(r, other),
    quest: r.quest,
    split: r.state === 'split',
  }));
}

export interface DecisionBanner {
  /** `hidden`: un menu couvre l'écran; `now`: horloge de l'interface (ms). */
  frame(world: ReadonlyWorld, me: PlayerIndex, hidden: boolean, now: number): void;
  dispose(): void;
}

/** Bandeau du HUD, en haut au centre: la première décision ouverte (rarement plus d'une). */
export function createDecisionBanner(root: HTMLElement, content: Content): DecisionBanner {
  const head = el('b', { class: 'decision-rappel__titre' });
  const body = el('span', { class: 'decision-rappel__texte' });
  const banner = el('div', { class: 'decision-rappel', role: 'status', 'aria-live': 'polite' }, [
    icon('info'),
    el('div', {}, [head, body]),
  ]);
  banner.hidden = true;
  root.append(banner);
  let drawn = '';
  let readAt = -Infinity;
  let first: ReturnType<typeof decisionReminderTexts>[number] | undefined;
  return {
    frame(world, me, hidden, now) {
      // Relu quelques fois par seconde: les suites et leurs dialogues ne se parcourent pas à chaque image.
      if (now - readAt >= UI_TUNING.reminderReadMs || now < readAt) {
        readAt = now;
        first = decisionReminderTexts(world, content, me)[0];
      }
      const shown = hidden ? undefined : first;
      const signature = shown === undefined ? '' : `${shown.head}|${shown.body}`;
      if (signature === drawn) return;
      drawn = signature;
      banner.hidden = shown === undefined;
      if (shown === undefined) return;
      setText(head, shown.head);
      setText(body, shown.body);
      banner.classList.toggle('decision-rappel--desaccord', shown.split);
    },
    dispose() {
      banner.remove();
    },
  };
}
