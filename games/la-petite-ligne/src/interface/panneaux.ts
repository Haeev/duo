/**
 * Panneaux d'échange: caisse de la coopérative et commande du samedi,
 * catalogue, comptoir d'Odette, établi de Basile, réchaud, coffre de la
 * maison (maquettes `caisse.html`, `catalogue.html`; les trois derniers
 * reprennent les mêmes composants, README des maquettes, section 5).
 */
import { currentOrder } from '../donnees/commandes';
import { letterText } from '../etat/courrier';
import type { Quality, ReadonlyWorld } from '../etat/types';
import type { PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf, nameOf } from './contexte';
import { button, chip, el, icon, setText } from './dom';
import { defaultCrateLine, defaultProduct } from './focus';
import { countIn, hourLabel, itemName, lowerFirst } from './format';
import { linesText, orderFullAmount, orderLines } from './modele';
import {
  foodEntries,
  grocerBudget,
  missingText,
  partnerAtHome,
  recipeEntries,
  counterShop,
  haberdasheryIsOpen,
  shopBuyEntries,
  shopIsOpen,
  shopSellEntries,
  stackEntries,
} from './modele-panneaux';
import { type BasileModel, basileModel } from './modele-tableau';
import { basileRoomsModel } from './modele-maison';
import { basileRoomsSection } from './maison';
import { Panel, backKeys, price } from './panneau';
import { builtList, chantierCard } from './tableau';
import { SOUND_ATTR } from './sons';

// ---------------------------------------------------------------------------
// Caisse de la coopérative

export class CratePanel extends Panel {
  private readonly takeBackHint: HTMLSpanElement;

  constructor(host: UiHost) {
    const { ctx } = host;
    const time = hourLabel(ctx.content.settings.train.departure, ctx.texts.game.ui.hud.time);
    super(host, {
      icon: 'parcel',
      title: ctx.t(ctx.texts.game.ui.crate.title),
      subtitle: ctx.t(ctx.texts.extra.crate.board, { day: ctx.content.settings.order.trains[0]?.day ?? 0, time }),
      narrow: true,
      width: '46rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.crate.keysDeposit },
      ]),
      null,
    ]);
    this.takeBackHint = el('span', { text: ctx.t(ctx.texts.extra.crate.canTakeBack) });
    this.footer.append(this.takeBackHint);
  }

  private deposit(world: ReadonlyWorld, item: string, count: number): void {
    const me = characterOf(world, this.host.ctx.me);
    if (me === null) return;
    // Les ordinaires d'abord: la commande les paie au même prix que les belles.
    let left = count;
    for (const quality of ['ordinary', 'fine'] as const) {
      const n = Math.min(left, countIn(me.bag, item, quality));
      if (n > 0) this.host.send({ type: 'crate_deposit', item, quality, count: n });
      left -= n;
    }
  }

  private takeBack(world: ReadonlyWorld, item: string): void {
    for (const quality of ['fine', 'ordinary'] as const) {
      const n = countIn(world.crate, item, quality);
      if (n > 0) {
        this.host.send({ type: 'crate_take', item, quality, count: n });
        return;
      }
    }
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const c = ctx.texts.extra.crate;
    const lines = orderLines(world, ctx);
    const result = world.orderResult;
    // Le soir du départ, la simulation prépare déjà la commande suivante: la caisse montre celle qui vient de partir
    // (son jour est gardé dans le résultat, commandes générées comprises).
    const coming = currentOrder(ctx.content.settings, world).day;
    const orderDay = result === null ? coming : result.day;
    const nextComing = result !== null && coming > result.day;
    this.takeBackHint.toggleAttribute('hidden', result !== null);
    this.setSubtitle(ctx.t(c.board, { day: orderDay, time: hourLabel(ctx.content.settings.train.departure, ctx.texts.game.ui.hud.time) }));
    const recap = world.letters.find((l) => l.day === world.clock.day && result !== null && letterText(ctx.content, l).includes(String(result.amount)));
    const sig = JSON.stringify([lines, result, world.clock.day, recap?.id]);
    this.renderBody(sig, () => {
      const done = lines.filter((l) => l.done).length;
      const total = lines.length;
      const amount = orderFullAmount(ctx, world);
      const time = hourLabel(ctx.content.settings.train.departure, ctx.texts.game.ui.hud.time);
      const daysLeft = orderDay - world.clock.day;
      let summary: HTMLElement;
      if (result !== null) {
        // Expédiée: le détail ligne par ligne est parti avec le train; restent le résultat et la suite.
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', { text: ctx.t(c.gone) }),
          el('span', { class: 'lpl-stamp', text: ctx.t(c.shipped) }),
          el('span', { text: ctx.t(c.shippedResult, { lines: linesText(ctx, result.linesDone, result.linesTotal), amount: result.amount }) }),
          recap === undefined ? null : el('span', { text: ctx.t(`« ${letterText(ctx.content, recap)} »`) }),
        ]);
        return [summary, nextComing ? el('p', { class: 'lpl-field__help', text: ctx.t(c.nextOrder) }) : null];
      } else if (done === total) {
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', { text: linesText(ctx, done, total) }),
          el('span', { class: 'lpl-stamp lpl-stamp--green', text: ctx.t(c.complete) }),
          el('span', { text: ctx.t(c.completeText, { amount, time }) }),
        ]);
      } else {
        const text = done === 0 && lines.every((l) => l.inCrate === 0)
          ? ctx.t(c.empty, { time })
          : daysLeft <= 0
            ? ctx.t(c.today, { time, amount })
            : daysLeft === 1
              ? ctx.t(c.dayLeft, { amount })
              : ctx.t(c.daysLeft, { days: daysLeft, amount });
        summary = el('div', { class: 'lpl-order__summary' }, [el('strong', { text: linesText(ctx, done, total) }), el('span', { text })]);
      }
      const focusIndex = defaultCrateLine(lines.map((l) => ({ canDeposit: !l.done && l.inBag > 0 })));
      const list = el('ul', { class: 'lpl-order', 'data-nav': 'list', 'aria-label': c.linesLabel });
      lines.forEach((l, i) => {
        const filled = l.done;
        const remaining = Math.max(0, l.need - l.inCrate);
        const give = Math.min(remaining, l.inBag);
        const small = l.done
          ? c.deliveredLine
          : l.inBag > 0
            ? ctx.t(ctx.texts.extra.common.inBag, { count: l.inBag })
            : ctx.texts.extra.common.noneInBag;
        let action: HTMLElement;
        if (l.done) action = el('span', { class: 'lpl-stamp lpl-stamp--green', text: ctx.t(c.delivered) });
        else if (give > 0) {
          action = button(ctx.t(c.depositCount, { count: give, item: itemName(ctx.content.items[l.item], give, l.item) }), () => {
            this.deposit(world, l.item, give);
          }, { class: 'lpl-button lpl-button--primary lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': `deposit:${l.item}`, 'data-autofocus': i === focusIndex } });
        } else {
          action = button(ctx.t(c.nothing), () => undefined, {
            class: 'lpl-button lpl-button--wide',
            attrs: { 'aria-disabled': 'true', 'data-nav-item': true, 'data-key': `nothing:${l.item}`, 'data-autofocus': i === focusIndex },
          });
        }
        const takeBack =
          l.inCrate > 0 && !l.done
            ? button(ctx.t(c.takeBack), () => {
                this.takeBack(world, l.item);
              }, { class: 'lpl-button lpl-button--quiet', attrs: { 'data-nav-item': true, 'data-key': `take:${l.item}` } })
            : null;
        list.append(
          el('li', { class: 'lpl-order__line', 'data-state': filled ? 'done' : null }, [
            el('span', { class: 'lpl-order__box', role: 'img', 'aria-label': filled ? c.lineDone : c.lineTodo }, [icon('ui-check')]),
            icon(l.icon, 'lpl-order__icon'),
            el('span', { class: 'lpl-order__name' }, [l.name, small === '' ? null : el('small', { text: ctx.t(small) })]),
            el('span', { class: 'lpl-order__progress' }, [
              el('span', { class: 'lpl-order__count' }, [String(Math.min(l.inCrate, l.need)), ' ', el('small', { text: ctx.t(ctx.texts.extra.common.outOf, { total: l.need }) })]),
              el('span', { class: 'lpl-order__bar' }, [el('span', { style: `--lpl-value: ${Math.round((Math.min(l.inCrate, l.need) / l.need) * 100)}%` })]),
            ]),
            el('span', { class: 'lpl-order__action' }, [action, takeBack]),
          ]),
        );
      });
      return [summary, list];
    });
  }
}

// ---------------------------------------------------------------------------
// Comptoir d'Odette

export class ShopPanel extends Panel {
  private tab: 'buy' | 'sell';
  /** Le comptoir ouvert: l'épicerie d'Odette, ou la mercerie de Solange (achats seulement). */
  private shop: 'grocery' | 'haberdashery' = 'grocery';
  private readonly tabs: HTMLDivElement;
  private readonly tabButtons: Record<'buy' | 'sell', HTMLButtonElement>;

  constructor(host: UiHost, tab: PanelTab | undefined) {
    const { ctx } = host;
    const s = ctx.texts.game.ui.shop;
    super(host, {
      icon: 'ui-coin',
      title: ctx.t(s.title),
      narrow: true,
      width: '46rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.tab = tab === 'sell' ? 'sell' : 'buy';
    const make = (id: 'buy' | 'sell', label: string, iconId: string): HTMLButtonElement =>
      button([icon(iconId), label], () => {
        this.select(id);
      }, { class: 'lpl-tab', attrs: { role: 'tab', 'aria-selected': 'false', tabindex: '-1', [SOUND_ATTR]: 'none' } });
    this.tabButtons = { buy: make('buy', ctx.t(s.buy), 'seed-radish'), sell: make('sell', ctx.t(s.sell), 'ui-coin') };
    this.tabs = el('div', { class: 'lpl-tabs', role: 'tablist' }, [
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyQ') }),
      this.tabButtons.buy,
      this.tabButtons.sell,
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyE') }),
    ]);
    this.header.insertBefore(this.tabs, this.closeButton);
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: ctx.texts.extra.notebook.keysPages },
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
    this.markTabs();
  }

  /**
   * Le comptoir où l'on est: dans sa boutique, la mercerie de Solange (titre à elle, achats
   * seulement: Solange vend, elle n'achète pas), sinon l'épicerie d'Odette.
   */
  private chooseShop(shop: 'grocery' | 'haberdashery'): void {
    if (shop === this.shop) return;
    this.shop = shop;
    const { ctx } = this.host;
    setText(this.titleEl, ctx.t(shop === 'haberdashery' ? ctx.texts.extra.shop.haberdasheryTitle : ctx.texts.game.ui.shop.title));
    this.tabs.hidden = shop === 'haberdashery';
    if (shop === 'haberdashery') this.tab = 'buy';
    this.markTabs();
  }

  private markTabs(): void {
    for (const id of ['buy', 'sell'] as const) {
      const b = this.tabButtons[id];
      b.setAttribute('aria-selected', String(id === this.tab));
      b.tabIndex = id === this.tab ? 0 : -1;
    }
  }

  private select(tab: 'buy' | 'sell'): void {
    if (tab === this.tab) return;
    this.host.sound('ui-tab');
    this.tab = tab;
    this.markTabs();
    this.host.invalidate();
  }

  override key(code: string): boolean {
    if ((code === 'KeyQ' || code === 'KeyE') && this.shop === 'grocery') {
      this.select(this.tab === 'buy' ? 'sell' : 'buy');
      return true;
    }
    return false;
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const k = ctx.texts.extra.shop;
    this.chooseShop(counterShop(world, ctx));
    const open = this.shop === 'haberdashery' ? haberdasheryIsOpen(world, ctx) : shopIsOpen(world, ctx);
    const partnerName = nameOf(world, ctx.partner);
    if (this.tab === 'buy') {
      const entries = shopBuyEntries(world, ctx, this.shop);
      const sig = JSON.stringify(['buy', entries, open, world.purse, partnerName]);
      this.renderBody(sig, () => {
        const focusIndex = defaultProduct(entries);
        const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
        entries.forEach((e, i) => {
          const actions: HTMLElement[] = [];
          if (e.waiting) {
            actions.push(chip(ctx.t(ctx.texts.extra.catalogue.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass'));
          } else if (e.missing > 0) {
            actions.push(button(ctx.t(ctx.texts.extra.common.missingMoney, { missing: e.missing }), () => undefined, {
              class: 'lpl-button lpl-button--wide',
              attrs: { 'aria-disabled': 'true', 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'data-autofocus': i === focusIndex },
            }));
          } else if (e.big) {
            actions.push(button(ctx.t(k.propose, { partner: partnerName }), () => {
              this.host.send({ type: 'buy', item: e.item, count: 1 });
            }, { class: 'lpl-button lpl-button--primary lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'data-autofocus': i === focusIndex } }));
          } else {
            actions.push(button(ctx.t(k.buyCount, { count: 1 }), () => {
              this.host.send({ type: 'buy', item: e.item, count: 1 });
            }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'data-autofocus': i === focusIndex } }));
            const bulk = UI_SETTINGS.shopBulk;
            if (e.price * bulk <= world.purse && (ctx.content.items[e.item]?.stack ?? 1) >= bulk) {
              actions.push(button(ctx.t(k.buyCount, { count: bulk }), () => {
                this.host.send({ type: 'buy', item: e.item, count: bulk });
              }, { attrs: { 'data-nav-item': true, 'data-key': `bulk:${e.item}` } }));
            }
          }
          list.append(
            el('li', { class: 'lpl-order__line lpl-shop__line' }, [
              icon(e.icon, 'lpl-order__icon'),
              el('span', { class: 'lpl-order__name' }, [e.name, e.info === '' ? null : el('small', { text: e.info })]),
              el('span', { class: 'lpl-order__count' }, [price(this.host, e.price)]),
              el('span', { class: 'lpl-order__action lpl-shop__actions' }, actions),
            ]),
          );
        });
        const closed = this.shop === 'haberdashery' ? k.haberdasheryClosed : k.closedNotice;
        const notice = open ? null : el('div', { class: 'lpl-order__summary' }, [el('strong', { text: ctx.t(closed) })]);
        const big = el('p', { class: 'lpl-field__help', text: ctx.t(ctx.texts.extra.catalogue.bigPurchase, { amount: ctx.content.settings.economy.bigPurchaseThreshold }) });
        return [notice, list, big];
      });
      return;
    }
    const entries = shopSellEntries(world, ctx);
    const budget = grocerBudget(world, ctx);
    const sig = JSON.stringify(['sell', entries, budget, open]);
    this.renderBody(sig, () => {
      const rate = Math.round(ctx.content.settings.economy.grocer.buyRate * 100);
      let summary: HTMLElement;
      if (!budget.buys) {
        summary = el('div', { class: 'lpl-order__summary' }, [el('strong', { text: ctx.t(ctx.texts.messages.grocer_not_buying ?? '') })]);
      } else {
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', { text: budget.room > 0 ? ctx.t(k.room, { amount: budget.room }) : ctx.t(k.roomNone) }),
          el('span', { text: ctx.t(k.rate, { percent: rate }) }),
          budget.ardoise === null ? null : el('span', { class: 'lpl-shop__ardoise', text: ctx.t(k.ardoiseBoard, { item: budget.ardoise }) }),
        ]);
      }
      if (entries.length === 0) return [summary, el('div', { class: 'lpl-empty', text: ctx.t(k.nothingToSell) })];
      const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
      entries.forEach((e, i) => {
        const canSell = budget.buys && budget.room >= e.unit && open;
        const sellOne = button(ctx.t(k.sellOne), () => {
          this.host.send({ type: 'sell', item: e.item, quality: e.quality, count: 1 });
        }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `sell:${e.item}:${e.quality}`, 'aria-disabled': canSell ? null : 'true', 'data-autofocus': i === 0 } });
        const sellAll =
          e.count > 1
            ? button(ctx.t(k.sellAll, { amount: e.total }), () => {
                this.host.send({ type: 'sell', item: e.item, quality: e.quality, count: e.count });
              }, { attrs: { 'data-nav-item': true, 'data-key': `sellall:${e.item}:${e.quality}`, 'aria-disabled': canSell ? null : 'true' } })
            : null;
        list.append(
          el('li', { class: 'lpl-order__line lpl-shop__line' }, [
            icon(e.icon, 'lpl-order__icon'),
            el('span', { class: 'lpl-order__name' }, [
              e.name,
              e.quality === 'fine' ? el('span', { class: 'lpl-shop__fine' }, [icon('ui-star'), ctx.texts.extra.common.fine]) : null,
              el('small', { text: ctx.t(ctx.texts.extra.common.inBag, { count: e.count }) }),
            ]),
            el('span', { class: 'lpl-order__count' }, [
              el('small', { text: ctx.t(k.unitPrice, { price: e.unit }) }),
              e.word === null ? null : el('small', { class: `lpl-shop__word lpl-shop__word--${e.word}`, text: ctx.t(k[GROCER_WORD_KEYS[e.word]]) }),
            ]),
            el('span', { class: 'lpl-order__action lpl-shop__actions' }, [sellOne, sellAll]),
          ]),
        );
      });
      return [summary, list];
    });
  }
}

// ---------------------------------------------------------------------------
// Établi et réchaud

/** Clé de `textes-interface.json` (`shop`) de chaque mot du panneau de vente. */
const GROCER_WORD_KEYS = { ardoise: 'ardoiseLine', plenty: 'plenty', wanted: 'wanted' } as const;

export class StationPanel extends Panel {
  private readonly station: 'workbench' | 'stove';

  constructor(host: UiHost, station: 'workbench' | 'stove') {
    const { ctx } = host;
    const title = station === 'workbench' ? ctx.texts.game.ui.workbench.title : ctx.texts.game.ui.stove.title;
    super(host, {
      icon: station === 'workbench' ? 'plank' : 'stove',
      title: ctx.t(title),
      subtitle: station === 'workbench' ? ctx.t(ctx.texts.extra.workbench.fromCellar) : '',
      narrow: true,
      width: '46rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.station = station;
    if (station === 'stove') this.setSubtitle('');
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: station === 'workbench' ? ctx.texts.extra.workbench.keysCraft : lowerFirst(ctx.texts.game.ui.stove.cook) },
      ]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const w = ctx.texts.extra.workbench;
    const { entries, locked } = recipeEntries(world, ctx, this.station);
    const food = this.station === 'stove' ? foodEntries(world, ctx) : [];
    const together = partnerAtHome(world, ctx);
    // Tour 9: la commande des chantiers de la maisonnette, à l'établi de Basile (dès la lettre `basile_works`).
    const basile = this.station === 'workbench' ? basileModel(world, ctx) : null;
    // 0.12: les abris des bêtes, une file à part chez Basile.
    const animals = this.station === 'workbench' ? basileModel(world, ctx, 'elevage') : null;
    // Tour 10: « Agrandir la maisonnette » (cellier, chambre) et le grand coffre de chêne.
    const rooms = this.station === 'workbench' ? basileRoomsModel(world, ctx) : null;
    const partnerName = nameOf(world, ctx.partner);
    const sig = JSON.stringify([entries, locked, food, together, basile, animals, rooms, partnerName, world.purse]);
    this.renderBody(sig, () => {
      const craftLabel = this.station === 'workbench' ? ctx.texts.game.ui.workbench.craft : ctx.texts.game.ui.stove.cook;
      const focusIndex = defaultProduct(entries);
      const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
      entries.forEach((r, i) => {
        let action: HTMLElement;
        if (r.progress !== null) {
          action = el('span', { class: 'lpl-order__progress' }, [
            el('span', { class: 'lpl-order__count' }, [el('small', { text: ctx.t(w.inProgress) })]),
            el('span', { class: 'lpl-order__bar' }, [el('span', { style: `--lpl-value: ${Math.round(r.progress * 100)}%` })]),
          ]);
        } else if (r.missing.length > 0) {
          action = button(ctx.t(ctx.texts.game.ui.workbench.missing, { missing: missingText(ctx, r.missing) }), () => undefined, {
            class: 'lpl-button lpl-button--wide',
            attrs: { 'aria-disabled': 'true', 'data-nav-item': true, 'data-key': `craft:${r.id}`, 'data-autofocus': i === focusIndex },
          });
        } else {
          action = button(ctx.t(craftLabel), () => {
            this.host.send({ type: 'craft', recipe: r.id });
          }, {
            class: 'lpl-button lpl-button--primary lpl-button--wide',
            attrs: { 'aria-disabled': r.available ? null : 'true', 'data-nav-item': true, 'data-key': `craft:${r.id}`, 'data-autofocus': i === focusIndex },
          });
        }
        list.append(
          el('li', { class: 'lpl-order__line lpl-shop__line' }, [
            icon(r.icon, 'lpl-order__icon'),
            el('span', { class: 'lpl-order__name' }, [
              r.name,
              el('small', { text: r.makes }),
              r.fromChest === null ? null : el('small', { class: 'lpl-order__chest', text: r.fromChest }),
            ]),
            el('span'),
            el('span', { class: 'lpl-order__action' }, [action]),
          ]),
        );
      });
      const nodes: (Node | null)[] = [];
      if (this.station === 'stove') nodes.push(el('h3', { class: 'lpl-section-title', text: ctx.t(ctx.texts.extra.stove.cookSection) }));
      nodes.push(entries.length === 0 ? el('div', { class: 'lpl-empty', text: ctx.t(w.noRecipes) }) : list);
      if (locked > 0 && this.station === 'workbench') nodes.push(el('p', { class: 'lpl-field__help', text: ctx.t(w.lockedPlans) }));
      if (basile !== null) nodes.push(...basileSection(this.host, basile, partnerName));
      if (animals !== null) nodes.push(...basileSection(this.host, animals, partnerName, { title: ctx.texts.extra.farm.basileTitle, allBuilt: ctx.texts.extra.farm.basileAllBuilt }));
      if (rooms !== null) nodes.push(...basileRoomsSection(this.host, rooms));
      if (this.station === 'stove') {
        nodes.push(el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(ctx.texts.extra.stove.eatSection) }));
        if (food.length === 0) nodes.push(el('div', { class: 'lpl-empty', text: ctx.t(ctx.texts.extra.stove.nothingToEat) }));
        else {
          const eat = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
          for (const f of food) {
            eat.append(
              el('li', { class: 'lpl-order__line lpl-shop__line' }, [
                icon(f.icon, 'lpl-order__icon'),
                el('span', { class: 'lpl-order__name' }, [f.name, el('small', { text: ctx.t(ctx.texts.extra.common.inBag, { count: f.count }) })]),
                el('span'),
                el('span', { class: 'lpl-order__action' }, [
                  button(ctx.t(together ? ctx.texts.game.ui.stove.eatTogether : ctx.texts.game.ui.stove.eat), () => {
                    this.host.send({ type: 'eat', item: f.item });
                  }, { class: 'lpl-button lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': `eat:${f.item}` } }),
                ]),
              ]),
            );
          }
          nodes.push(eat);
        }
      }
      return nodes;
    });
  }
}

// ---------------------------------------------------------------------------
// Coffre de la maison (cellier commun)

export class ChestPanel extends Panel {
  constructor(host: UiHost) {
    const { ctx } = host;
    const k = ctx.texts.extra.chest;
    super(host, {
      icon: 'chest',
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

  private move(kind: 'chest_take' | 'chest_deposit', item: string, quality: Quality, count: number): void {
    this.host.send({ type: kind, item, quality, count });
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const k = ctx.texts.extra.chest;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const inChest = stackEntries(ctx, world.cellar, true);
    const inBag = stackEntries(ctx, me.bag);
    const sig = JSON.stringify([inChest, inBag]);
    this.renderBody(sig, () => {
      const column = (title: string, entries: typeof inChest, empty: string, kind: 'chest_take' | 'chest_deposit'): HTMLElement => {
        const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
        entries.forEach((e, i) => {
          const label = kind === 'chest_take' ? k.take : k.store;
          list.append(
            el('li', { class: 'lpl-order__line lpl-chest__line' }, [
              icon(e.icon, 'lpl-order__icon'),
              el('span', { class: 'lpl-order__name' }, [
                e.name,
                e.quality === 'fine' ? el('span', { class: 'lpl-shop__fine' }, [icon('ui-star'), ctx.texts.extra.common.fine]) : null,
              ]),
              el('span', { class: 'lpl-order__count', text: String(e.count) }),
              el('span', { class: 'lpl-order__action lpl-shop__actions' }, [
                button(ctx.t(label), () => {
                  this.move(kind, e.item, e.quality, kind === 'chest_take' ? 1 : e.count);
                }, {
                  class: `lpl-button${kind === 'chest_take' ? ' lpl-button--primary' : ''}`,
                  attrs: { 'data-nav-item': true, 'data-key': `${kind}:${e.item}:${e.quality}`, 'data-autofocus': kind === 'chest_take' && i === 0 },
                }),
                kind === 'chest_take' && e.count > 1
                  ? button(ctx.t(k.takeAll), () => {
                      this.move(kind, e.item, e.quality, e.count);
                    }, { attrs: { 'data-nav-item': true, 'data-key': `all:${e.item}:${e.quality}` } })
                  : null,
              ]),
            ]),
          );
        });
        return el('section', { class: 'lpl-chest__column' }, [
          el('h3', { class: 'lpl-section-title', text: ctx.t(title) }),
          entries.length === 0 ? el('div', { class: 'lpl-empty', text: ctx.t(empty) }) : list,
        ]);
      };
      return [
        el('div', { class: 'lpl-chest' }, [
          column(k.inChest, inChest, k.emptyChest, 'chest_take'),
          column(k.inBag, inBag, k.emptyBag, 'chest_deposit'),
        ]),
      ];
    });
  }
}

/**
 * « Commander à Basile » (tour 9, section 2.6): le chantier de la maisonnette ouvert, les planches
 * apportées (10 aubrins de moins chacune, 20 au plus), la commande payée d'un coup.
 */
function basileSection(host: UiHost, m: BasileModel, partnerName: string, labels: { title: string; allBuilt: string } | null = null): HTMLElement[] {
  const { ctx } = host;
  const k = ctx.texts.extra.basile;
  const nodes: HTMLElement[] = [el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(labels?.title ?? ctx.texts.game.ui.basile.order) })];
  const c = m.chantier;
  if (c === null) {
    nodes.push(el('p', { class: 'lpl-field__help', text: ctx.t(m.allBuilt ? (labels?.allBuilt ?? k.allBuilt) : ctx.texts.extra.board.nextTomorrow) }));
  } else {
    const extra: (HTMLElement | null)[] = [];
    if (!c.funded && c.pending === null) {
      const label = m.planksFull ? k.planksFull : m.bring === 0 ? k.noPlanks : m.bring === 1 ? k.bringOne : k.bring;
      extra.push(
        button(ctx.t(label, { count: m.bring }), () => {
          if (m.bring > 0) host.send({ type: 'improvement_planks', improvement: c.id, count: m.bring });
        }, { class: 'lpl-button', attrs: { 'data-nav-item': true, 'data-key': `planks:${c.id}`, 'aria-disabled': m.bring > 0 ? null : 'true' } }),
      );
    }
    const discount = ctx.content.settings.improvements?.plankDiscount ?? 0;
    const max = ctx.content.settings.improvements?.plankDiscountMax ?? 1;
    nodes.push(
      chantierCard(host, c, partnerName, false, extra, { title: m.priceLine, progress: m.planksLine, percent: Math.round((c.planks / Math.max(1, max)) * 100) }),
      el('p', { class: 'lpl-field__help', text: `${ctx.t(k.subtitle)} ${ctx.t(k.help, { discount })}` }),
    );
  }
  if (m.built.length > 0) nodes.push(el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(ctx.texts.extra.board.builtTitle) }), builtList(m.built));
  return nodes;
}
