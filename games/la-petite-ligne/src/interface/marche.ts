/**
 * Panneau de l'étal du dimanche (0.12, section 2.3): ce qui est sur l'étal et son prix, ce qu'on
 * peut y poser depuis son sac, le prix de tout l'étal (Doux, Juste, Fort), les clients qui
 * attendent avec leur liste. Les deux joueurs garnissent le même étal.
 */
import { MARKET_LEVELS, type MarketLevel } from '../donnees/marche';
import { stallSlots, stallUnitPrice } from '../etat/marche';
import type { Quality, ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { characterOf } from './contexte';
import { button, el, icon } from './dom';
import { itemName } from './format';
import { stackEntries } from './modele-panneaux';
import { Panel, backKeys } from './panneau';

export interface StallLine {
  item: string;
  quality: Quality;
  icon: string;
  name: string;
  count: number;
  /** Prix d'une unité au niveau choisi (0 pour une ligne du sac qui ne se vend pas). */
  unit: number;
}

export interface StallModel {
  level: MarketLevel;
  slots: number;
  used: number;
  onStall: StallLine[];
  inBag: StallLine[];
  /** Clients devant l'étal: prénom et liste (« 2 mûres, 1 œuf »). */
  waiting: { name: string; list: string }[];
}

export function stallModel(world: ReadonlyWorld, host: UiHost): StallModel | null {
  const { ctx } = host;
  const m = ctx.content.market;
  const market = world.market;
  const me = characterOf(world, ctx.me);
  if (m === null || me === null) return null;
  const level = market?.level ?? m.defaultLevel;
  const price = (item: string, quality: Quality): number =>
    stallUnitPrice(ctx.content, item, quality, level);
  const onStall = stackEntries(ctx, market?.stall ?? []).map((e) => ({
    ...e,
    unit: price(e.item, e.quality),
  }));
  const inBag = stackEntries(ctx, me.bag)
    .filter((e) => typeof ctx.content.items[e.item]?.sellPrice === 'number')
    .map((e) => ({ ...e, unit: price(e.item, e.quality) }));
  const today = market !== null && market.day === world.clock.day;
  const waiting = today
    ? market.buyers
        .filter((b) => b.status === 'waiting')
        .map((b) => ({
          name: ctx.content.villagers.find((v) => v.id === b.villager)?.firstName ?? b.villager,
          list: b.list
            .map(
              (l) => `${String(l.count)} ${itemName(ctx.content.items[l.item], l.count, l.item)}`,
            )
            .join(', '),
        }))
    : [];
  return {
    level,
    slots: stallSlots(ctx.content, world),
    used: market?.stall.length ?? 0,
    onStall,
    inBag,
    waiting,
  };
}

export class StallPanel extends Panel {
  constructor(host: UiHost) {
    const { ctx } = host;
    const k = ctx.texts.extra.market;
    super(host, {
      icon: 'ui-coin',
      title: ctx.t(k.title),
      subtitle: ctx.t(k.subtitle),
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [...a], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const k = ctx.texts.extra.market;
    const model = stallModel(world, this.host);
    if (model === null) return;
    this.renderBody(JSON.stringify(model), () => {
      const levels = el(
        'div',
        { class: 'lpl-market__levels', role: 'group', 'aria-label': ctx.t(k.levelLabel) },
        MARKET_LEVELS.map((level) =>
          button(
            ctx.t(k[level]),
            () => {
              this.host.send({ type: 'market_level', level });
            },
            {
              class: `lpl-button${model.level === level ? ' lpl-button--primary' : ''}`,
              attrs: {
                'data-nav-item': true,
                'data-key': `level:${level}`,
                'aria-pressed': model.level === level ? 'true' : 'false',
              },
            },
          ),
        ),
      );
      const column = (
        title: string,
        lines: StallLine[],
        empty: string,
        take: boolean,
      ): HTMLElement => {
        const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
        for (const e of lines) {
          list.append(
            el('li', { class: 'lpl-order__line lpl-chest__line' }, [
              icon(e.icon, 'lpl-order__icon'),
              el('span', { class: 'lpl-order__name' }, [
                e.name,
                e.quality === 'fine'
                  ? el('span', { class: 'lpl-shop__fine' }, [
                      icon('ui-star'),
                      ctx.texts.extra.common.fine,
                    ])
                  : null,
                el('small', { text: ctx.t(k.unitPrice, { price: e.unit }) }),
              ]),
              el('span', { class: 'lpl-order__count', text: String(e.count) }),
              el('span', { class: 'lpl-order__action lpl-shop__actions' }, [
                button(
                  ctx.t(take ? k.takeBack : k.put),
                  () => {
                    this.host.send({
                      type: take ? 'stall_take' : 'stall_deposit',
                      item: e.item,
                      quality: e.quality,
                      count: e.count,
                    });
                  },
                  {
                    attrs: {
                      'data-nav-item': true,
                      'data-key': `${take ? 'take' : 'put'}:${e.item}:${e.quality}`,
                    },
                  },
                ),
              ]),
            ]),
          );
        }
        return el('section', { class: 'lpl-chest__column' }, [
          el('h3', { class: 'lpl-section-title', text: ctx.t(title) }),
          lines.length === 0 ? el('div', { class: 'lpl-empty', text: ctx.t(empty) }) : list,
        ]);
      };
      const queue =
        model.waiting.length === 0
          ? el('p', { class: 'lpl-field__help', text: ctx.t(k.noBuyer) })
          : el(
              'ul',
              { class: 'lpl-market__queue' },
              model.waiting.map((w) =>
                el('li', { text: ctx.t(k.buyer, { name: w.name, list: w.list }) }),
              ),
            );
      return [
        levels,
        el('p', {
          class: 'lpl-field__help',
          text: ctx.t(k.slots, { used: model.used, slots: model.slots }),
        }),
        queue,
        el('div', { class: 'lpl-chest' }, [
          column(k.onStall, model.onStall, k.emptyStall, true),
          column(k.inBag, model.inBag, k.emptyBag, false),
        ]),
      ];
    });
  }
}
