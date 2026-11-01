/**
 * Écran d'étape (tour 8, section 1.2): ce que voit chaque joueur quand le train de l'étape est
 * reparti (jour 15, puis jour 43). Modèle pur, testé dans Node; `ecrans.ts` l'affiche.
 * Les textes de l'étape viennent de `etat/semaine.ts` (`stageScreen`), les libellés des
 * actions de `textes-interface.json` (`end`).
 */
import { stageDef } from '../donnees/calendrier';
import type { StageId } from '../donnees/types';
import { stageScreen } from '../etat/semaine';
import type { ReadonlyWorld, StageChoice } from '../etat/types';
import { type UiContext, characterOf, nameOf } from './contexte';
import { hourLabel, weekdayOf } from './format';

/** Ligne sous les cartes des joueurs: ce qu'il reste à faire, ou ce que l'autre a choisi. */
export type StageMessage =
  | { kind: 'help'; text: string }
  | { kind: 'waiting'; text: string }
  | { kind: 'partner'; strong: string; text: string }
  | { kind: 'done'; text: string };

export interface StagePlayer {
  name: string;
  choice: StageChoice | null;
  /** « Veut rester », « Veut finir », ou « Pas encore ». */
  chip: string;
}

export interface StageModel {
  stage: StageId;
  /** « Samedi 15, 16 h 00 · le train est reparti ». */
  ticket: string;
  title: string;
  subtitle: string;
  text: string;
  /** Pourquoi « Rester à la Halte » manque (dernière étape de cette version), sinon `null`. */
  next: string | null;
  canStay: boolean;
  days: number;
  linesDone: number;
  linesTotal: number;
  furniture: number;
  /** « samedi 8 : 4 sur 4 · samedi 15 : 5 sur 5 », ou le nombre de commandes si l'historique est borné. */
  detail: string;
  /** Nom accessible des compteurs (récapitulatif de `textes.json`). */
  countersLabel: string;
  self: StagePlayer;
  other: StagePlayer;
  message: StageMessage;
  /** Note sous les actions: ce que fait chaque bouton. */
  after: string;
}

/** Au-delà de ce nombre de commandes, le détail laisse place à un résumé (l'écran tient sans défiler). */
const DETAIL_MAX_ORDERS = 3;

/**
 * Détail sous le total des lignes, tiré de l'historique (qui garde le jour de chaque train):
 * « samedi 8 : 4 sur 4 · samedi 15 : 5 sur 5 » jusqu'à trois commandes, puis un résumé
 * (« 6 commandes, dont 4 complètes »); seulement leur nombre si l'historique borné ne les
 * couvre plus toutes.
 */
export function stageOrdersDetail(
  ctx: UiContext,
  history: readonly { day: number; linesDone: number; linesTotal: number; complete: boolean }[],
  orders: number,
): string {
  const e = ctx.texts.extra.end;
  if (orders < 2) return '';
  if (history.length < orders) return ctx.t(e.ordersCount, { orders });
  if (orders > DETAIL_MAX_ORDERS) {
    const complete = history.filter((o) => o.complete).length;
    const template =
      complete === orders
        ? e.ordersAllComplete
        : complete === 0
          ? e.ordersCount
          : complete === 1
            ? e.ordersOneComplete
            : e.ordersSomeComplete;
    return ctx.t(template, { orders, complete });
  }
  return history
    .map((o) =>
      ctx.t(e.perOrder, {
        weekday: weekdayOf(o.day, ctx.texts.weekdays),
        day: o.day,
        done: o.linesDone,
        total: o.linesTotal,
      }),
    )
    .join(' · ');
}

function player(ctx: UiContext, name: string, choice: StageChoice | null): StagePlayer {
  const e = ctx.texts.extra.end;
  const chip =
    choice === 'stay'
      ? e.chipStay
      : choice === 'finish'
        ? e.chipFinish
        : ctx.texts.extra.common.notYet;
  return { name, choice, chip: ctx.t(chip) };
}

function messageOf(
  ctx: UiContext,
  me: StageChoice | null,
  other: StageChoice | null,
  partner: string,
  canStay: boolean,
): StageMessage {
  const e = ctx.texts.extra.end;
  if (me !== null && me === other)
    return { kind: 'done', text: ctx.t(me === 'stay' ? e.bothStay : e.bothFinish) };
  if (other === null) {
    return me === null
      ? { kind: 'help', text: ctx.t(canStay ? e.help : e.helpLast, { partner }) }
      : { kind: 'waiting', text: ctx.t(ctx.texts.extra.common.waitingFor, { partner }) };
  }
  const strong = ctx.t(other === 'stay' ? e.partnerStay : e.partnerFinish, { partner });
  if (me === null)
    return {
      kind: 'partner',
      strong,
      text: ctx.t(other === 'stay' ? e.partnerStayHelp : e.partnerFinishHelp),
    };
  return { kind: 'partner', strong, text: ctx.t(e.disagree) };
}

/** L'écran d'étape de ce joueur (phase `ended`), ou `null`. */
export function stageModel(world: ReadonlyWorld, ctx: UiContext): StageModel | null {
  const screen = stageScreen(world, ctx.content);
  if (screen === null) return null;
  const e = ctx.texts.extra.end;
  const game = ctx.texts.game.endScreen;
  const ending = world.ending;
  const def = stageDef(ctx.content.settings, screen.stage);
  const day = def?.day ?? screen.days;
  const time = hourLabel(
    def?.time ?? ctx.content.settings.train.departure,
    ctx.texts.game.ui.hud.time,
  );
  const furniture =
    ending?.furniturePlaced ?? world.furniture.filter((f) => f.placedBy !== null).length;
  const partner = nameOf(world, ctx.partner);
  const meChoice = screen.choices[ctx.me];
  const otherChoice = screen.choices[ctx.partner];
  const vars = {
    days: screen.days,
    linesDone: screen.linesDone,
    linesTotal: screen.linesTotal,
    furniture,
  };
  return {
    stage: screen.stage,
    ticket: ctx.t(e.ticket, { day, time }),
    title: ctx.t(screen.title),
    subtitle: ctx.t(screen.subtitle),
    text: ctx.t(screen.text),
    next: screen.next === null ? null : ctx.t(screen.next),
    canStay: screen.canStay,
    days: screen.days,
    linesDone: screen.linesDone,
    linesTotal: screen.linesTotal,
    furniture,
    detail: stageOrdersDetail(ctx, world.orderHistory, screen.orders),
    countersLabel: [
      ctx.t(game.stats.days, vars),
      ctx.t(game.stats.order, vars),
      ctx.t(game.stats.furniture, vars),
    ].join('. '),
    self: player(ctx, characterOf(world, ctx.me)?.name ?? '', meChoice),
    other: player(ctx, partner, otherChoice),
    message: messageOf(ctx, meChoice, otherChoice, partner, screen.canStay),
    after: ctx.t(screen.canStay ? e.after : e.afterLast),
  };
}
