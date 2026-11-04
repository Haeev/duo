/**
 * Panneaux d'échange: caisse de la coopérative et commande du samedi,
 * comptoir d'Odette et mercerie de Solange, établi de Basile, réchaud, coffre de la
 * maison. Patch 0.12.2: comptoir, établi et réchaud en vignettes (`vitrine.ts`,
 * `docs/jeux/jeu-1/interface-imagee-0-12-2.md`).
 */
import { currentOrder } from '../donnees/commandes';
import { CURRENCY } from '../donnees/monnaie';
import { letterText } from '../etat/courrier';
import type { Quality, ReadonlyWorld } from '../etat/types';
import type { PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { characterOf, nameOf } from './contexte';
import { button, chip, el, focusElement, icon, setText, token } from './dom';
import { defaultCrateLine, defaultProduct } from './focus';
import { countIn, hourLabel, itemName, lowerFirst } from './format';
import { linesText, orderFullAmount, orderLines } from './modele';
import {
  type BuyEntry,
  type FoodEntry,
  type SellEntry,
  foodEntries,
  grocerBudget,
  partnerAtHome,
  counterShop,
  haberdasheryIsOpen,
  shopBuyEntries,
  shopIsOpen,
  shopSellEntries,
  stackEntries,
} from './modele-panneaux';
import { type RecipeCardModel, ingredientLabel, itemFacts, recipeCards } from './modele-vitrine';
import { type BasileModel, basileModel } from './modele-tableau';
import { basileRoomsModel } from './modele-maison';
import { basileRoomsSection } from './maison';
import { Panel, backKeys } from './panneau';
import { builtList, chantierCard } from './tableau';
import { SOUND_ATTR } from './sons';
import { type VitrineItem, Vitrine, detailActions, detailHead, flyCoin, need, pastille, pastilles } from './vitrine';
import { type PlotCounterModel, plotCounter } from './modele-parcelles';
import { plotsRoom } from '../etat/parcelles';
import { categoryRoom } from '../etat/epicerie';

/** La parcelle de la vitrine d'Odette (0.13, `ITEM.plot`). */
const PLOT_ITEM = 'plot';

interface PlotShopModel {
  stock: number;
  /** Ce qui s'achète maintenant: le rayon, borné par le plafond. */
  buyable: number;
  atCap: boolean;
  counter: PlotCounterModel;
}

function plotShop(world: ReadonlyWorld, ctx: UiHost['ctx']): PlotShopModel | null {
  const counter = plotCounter(world, ctx);
  if (counter === null) return null;
  const room = plotsRoom(ctx.content, world);
  return { stock: world.plots.stock, buyable: Math.min(world.plots.stock, room), atCap: room === 0, counter };
}


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
// Comptoir d'Odette et mercerie de Solange (0.12.2: grille de vignettes, détail de la sélection)

/** Les touches A et E: page précédente ou suivante (`KeyQ` est le A d'un clavier AZERTY). */
function pageDelta(code: string): number {
  return code === 'KeyQ' ? -1 : code === 'KeyE' ? 1 : 0;
}

export class ShopPanel extends Panel {
  private tab: 'buy' | 'sell';
  /** Le comptoir ouvert: l'épicerie d'Odette, ou la mercerie de Solange (achats seulement). */
  private shop: 'grocery' | 'haberdashery' = 'grocery';
  private readonly tabs: HTMLDivElement;
  private readonly tabButtons: Record<'buy' | 'sell', HTMLButtonElement>;
  private readonly vitrines: Record<'buy' | 'sell', Vitrine>;

  constructor(host: UiHost, tab: PanelTab | undefined) {
    const { ctx } = host;
    const s = ctx.texts.game.ui.shop;
    super(host, {
      icon: 'ui-coin',
      title: ctx.t(s.title),
      narrow: true,
      width: UI_SETTINGS.vitrine.shopWidth,
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.tab = tab === 'sell' ? 'sell' : 'buy';
    const v = ctx.texts.extra.vitrine;
    this.vitrines = {
      buy: new Vitrine(host, { perPage: UI_SETTINGS.vitrine.shopPerPage, label: ctx.t(v.goods) }),
      sell: new Vitrine(host, { perPage: UI_SETTINGS.vitrine.shopPerPage, label: ctx.t(v.goods) }),
    };
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
    this.root.classList.add('lpl-panel--vitrine');
    this.markTabs();
  }

  /** Pied: A et E à l'épicerie (pages et onglets), Entrée « acheter » ou « vendre » selon l'onglet. */
  private footerFor(): void {
    const { ctx } = this.host;
    const a = ctx.texts.extra.keys.arrows;
    const groups: { keys: readonly string[]; text: string }[] = [];
    if (this.shop === 'grocery') groups.push({ keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: ctx.texts.extra.notebook.keysPages });
    groups.push({ keys: [...a], text: ctx.texts.extra.notebook.keysChoose });
    groups.push({ keys: [ctx.key('Enter')], text: this.tab === 'sell' ? ctx.texts.extra.vitrine.keysSell : ctx.texts.extra.shop.keysBuy });
    this.setFooter([backKeys(this.host, groups)]);
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
    this.footerFor();
  }

  private select(tab: 'buy' | 'sell'): void {
    if (tab === this.tab) return;
    this.host.sound('ui-tab');
    this.tab = tab;
    this.markTabs();
    this.host.invalidate();
    window.requestAnimationFrame(() => {
      focusElement(this.defaultFocus());
    });
  }

  /** A et E: les pages de l'onglet, puis l'onglet voisin (le pied dit « pages » pour les deux). */
  override key(code: string): boolean {
    const delta = pageDelta(code);
    if (delta === 0) return false;
    const vitrine = this.vitrines[this.tab];
    if (vitrine.turn(delta)) return true;
    if (this.shop === 'grocery') {
      const next = this.tab === 'buy' ? 'sell' : 'buy';
      this.vitrines[next].page = delta > 0 ? 0 : Number.MAX_SAFE_INTEGER;
      this.select(next);
    }
    return true;
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const k = ctx.texts.extra.shop;
    this.chooseShop(counterShop(world, ctx));
    const open = this.shop === 'haberdashery' ? haberdasheryIsOpen(world, ctx) : shopIsOpen(world, ctx);
    const partnerName = nameOf(world, ctx.partner);
    if (this.tab === 'buy') {
      const entries = shopBuyEntries(world, ctx, this.shop);
      const me = characterOf(world, ctx.me);
      const owned = Object.fromEntries(entries.map((e) => [e.item, me === null ? 0 : countIn(me.bag, e.item)]));
      const vitrine = this.vitrines.buy;
      // 0.13: la vignette « Parcelle » suit le rayon et le compteur (parcelles libres).
      const plots = plotShop(world, ctx);
      const sig = JSON.stringify(['buy', entries, open, world.purse, partnerName, owned, vitrine.page, plots]);
      this.renderBody(sig, () => {
        const focus = entries[defaultProduct(entries)]?.item ?? null;
        const items = entries.map((e) =>
          e.item === PLOT_ITEM && plots !== null ? this.plotItem(e, plots, world.purse, partnerName) : this.buyItem(e, world.purse, partnerName, owned[e.item] ?? 0),
        );
        const closed = this.shop === 'haberdashery' ? k.haberdasheryClosed : k.closedNotice;
        const notice = open ? null : el('p', { class: 'lpl-vitrine__notice' }, [icon('ui-lock'), ctx.t(closed)]);
        return [notice, vitrine.build(items, focus === null ? null : `item:${focus}`)];
      });
      return;
    }
    const entries = shopSellEntries(world, ctx);
    const budget = grocerBudget(world, ctx);
    const vitrine = this.vitrines.sell;
    const sig = JSON.stringify(['sell', entries, budget, open, vitrine.page]);
    this.renderBody(sig, () => {
      const v = ctx.texts.extra.vitrine;
      const rate = Math.round(ctx.content.settings.economy.grocer.buyRate * 100);
      const strip: (HTMLElement | null)[] = [];
      if (!budget.buys) strip.push(el('p', { class: 'lpl-vitrine__notice' }, [icon('ui-lock'), ctx.t(ctx.texts.messages.grocer_not_buying ?? '')]));
      else {
        strip.push(
          el('div', { class: 'lpl-vitrine__strip' }, [
            pastille({ icon: CURRENCY.icon, text: String(budget.room), tone: budget.room > 0 ? 'price' : 'missing', crossed: budget.room === 0, label: budget.room > 0 ? ctx.t(v.room, { amount: budget.room }) : ctx.t(k.roomNone) }),
            pastille({ icon: 'ui-coin', text: `${String(rate)} %`, tone: 'info', label: ctx.t(k.rate, { percent: rate }) }),
            budget.ardoise === null ? null : pastille({ icon: 'ui-notice', text: '×1,5', tone: 'ok', label: ctx.t(k.ardoiseBoard, { item: budget.ardoise }) }),
          ]),
        );
      }
      if (!open) strip.push(el('p', { class: 'lpl-vitrine__notice' }, [icon('ui-lock'), ctx.t(k.closedNotice)]));
      if (entries.length === 0) return [...strip, el('div', { class: 'lpl-empty', text: ctx.t(k.nothingToSell) })];
      // 0.13: le garde-fou d'une catégorie (250 aubrins de légumes par jour) grise aussi la vignette.
      const canSell = (e: SellEntry): boolean => budget.buys && budget.room >= e.unit && categoryRoom(ctx.content, world, e.item) >= e.unit && open;
      const items = entries.map((e) => this.sellItem(e, canSell(e)));
      return [...strip, vitrine.build(items, entries[0] === undefined ? null : `item:${entries[0].item}:${entries[0].quality}`)];
    });
  }

  /**
   * 0.13 (parcelles libres, section 5.3): la vignette « Parcelle ». Prix, rayon et compteur en
   * pastilles; « Acheter 1 », et « Acheter 4 » (ou ce qui reste en rayon), qui part en proposition à
   * l'autre au-delà du seuil des gros achats. Rayon vide: grisée, la lune (« demain »). Plafond: barrée.
   */
  private plotItem(e: BuyEntry, plots: PlotShopModel, purse: number, partnerName: string): VitrineItem {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const k = ctx.texts.extra.shop;
    const t = ctx.texts.extra.plots;
    const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
    const bulk = Math.min(UI_SETTINGS.shopBulk, plots.buyable);
    const blocked = plots.buyable === 0;
    const buy = (count: number, from: Element | null): boolean => {
      if (e.waiting || blocked || e.price * count > purse) return false;
      this.host.send({ type: 'buy', item: e.item, count });
      if (from !== null) flyCoin(from, 'buy');
      return true;
    };
    const stockPastille = {
      icon: 'shelf',
      text: ctx.t(t.stock, { count: plots.stock }),
      tone: plots.stock === 0 ? ('missing' as const) : ('count' as const),
      crossed: plots.stock === 0,
      label: ctx.t(plots.stock === 0 ? t.stockEmpty : t.stockLabel, { count: plots.stock }),
    };
    const counterPastille = {
      icon: 'garden-line',
      text: plots.counter.text,
      tone: plots.atCap ? ('missing' as const) : ('info' as const),
      crossed: plots.atCap,
      label: plots.atCap ? ctx.t(t.capReached, { owned: plots.counter.owned }) : plots.counter.label,
    };
    const label = plots.atCap
      ? ctx.t(t.capReached, { owned: plots.counter.owned })
      : plots.stock === 0
        ? ctx.t(t.stockEmpty)
        : e.missing > 0
          ? ctx.t(v.missingLabel, { name: e.name, price: e.price, missing: e.missing })
          : ctx.t(v.priceLabel, { name: e.name, price: e.price });
    return {
      key: `item:${e.item}`,
      tile: {
        icon: e.icon,
        name: e.name,
        label,
        badge: plots.atCap
          ? { icon: null, text: plots.counter.text, tone: 'missing', crossed: true }
          : { icon: null, text: String(e.price), tone: e.missing > 0 ? 'missing' : 'price' },
        corner: e.waiting ? 'ui-hourglass' : plots.atCap ? 'ui-lock' : plots.stock === 0 ? 'ui-moon' : null,
        state: e.waiting ? 'wait' : blocked ? 'locked' : e.missing > 0 ? 'missing' : null,
      },
      detail: () => {
        const actions: (HTMLElement | null)[] = [];
        if (e.waiting) actions.push(chip(ctx.t(ctx.texts.extra.catalogue.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass'));
        else {
          const one = button(ctx.t(k.buyCount, { count: 1 }), () => {
            buy(1, one);
          }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'aria-disabled': blocked || e.missing > 0 ? 'true' : null } });
          actions.push(one);
          if (bulk > 1) {
            const big = e.price * bulk >= threshold;
            const label = big ? [token('other', this.host.symbol('other'), 'small'), ctx.t(k.propose, { partner: partnerName })] : ctx.t(k.buyCount, { count: bulk });
            const many = button(label, () => {
              buy(bulk, big ? null : many);
            }, { attrs: { 'data-nav-item': true, 'data-key': `bulk:${e.item}`, 'aria-disabled': e.price * bulk > purse ? 'true' : null } });
            actions.push(many);
          }
        }
        return [
          ...detailHead(e.icon, e.name, e.info),
          pastilles([
            e.missing > 0
              ? { icon: CURRENCY.icon, text: `${String(purse)}/${String(e.price)}`, tone: 'missing', crossed: true, label: ctx.t(ctx.texts.extra.common.missingMoney, { missing: e.missing }) }
              : { icon: CURRENCY.icon, text: String(e.price), tone: 'price', label: ctx.t(ctx.texts.game.ui.shop.price, { price: e.price }) },
            stockPastille,
            counterPastille,
          ]),
          detailActions(actions),
        ];
      },
      act: (tile) => buy(1, tile),
    };
  }

  private buyItem(e: BuyEntry, purse: number, partnerName: string, owned: number): VitrineItem {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const k = ctx.texts.extra.shop;
    const bulk = UI_SETTINGS.shopBulk;
    const canBulk = (ctx.content.items[e.item]?.stack ?? 1) >= bulk && !e.big;
    // Un gros achat part en proposition à l'autre: pas encore de pièce qui vole.
    const buy = (count: number, from: Element | null): boolean => {
      if (e.waiting || e.price * count > purse) return false;
      this.host.send({ type: 'buy', item: e.item, count });
      if (from !== null) flyCoin(from, 'buy');
      return true;
    };
    const label = e.waiting
      ? ctx.t(v.waitingLabel, { name: e.name, partner: partnerName })
      : e.missing > 0
        ? ctx.t(v.missingLabel, { name: e.name, price: e.price, missing: e.missing })
        : e.big
          ? ctx.t(v.bigLabel, { name: e.name, price: e.price, partner: partnerName })
          : ctx.t(v.priceLabel, { name: e.name, price: e.price });
    const isSeed = ctx.content.items[e.item]?.plants !== null;
    return {
      key: `item:${e.item}`,
      tile: {
        icon: e.icon,
        name: e.name,
        label,
        badge: { icon: null, text: String(e.price), tone: e.missing > 0 ? 'missing' : 'price' },
        corner: e.waiting ? 'ui-hourglass' : e.big ? token('other', this.host.symbol('other'), 'small') : null,
        state: e.waiting ? 'wait' : e.missing > 0 ? 'missing' : null,
      },
      detail: () => {
        const actions: (HTMLElement | null)[] = [];
        if (e.waiting) actions.push(chip(ctx.t(ctx.texts.extra.catalogue.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass'));
        else if (e.big) {
          actions.push(
            button([token('other', this.host.symbol('other'), 'small'), ctx.t(k.propose, { partner: partnerName })], () => {
              buy(1, null);
            }, { class: 'lpl-button lpl-button--primary lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'aria-disabled': e.missing > 0 ? 'true' : null } }),
          );
        } else {
          const one = button(ctx.t(k.buyCount, { count: 1 }), () => {
            buy(1, one);
          }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `buy:${e.item}`, 'aria-disabled': e.missing > 0 ? 'true' : null } });
          actions.push(one);
          if (canBulk) {
            const four = button(ctx.t(k.buyCount, { count: bulk }), () => {
              buy(bulk, four);
            }, { attrs: { 'data-nav-item': true, 'data-key': `bulk:${e.item}`, 'aria-disabled': e.price * bulk > purse ? 'true' : null } });
            actions.push(four);
          }
        }
        return [
          ...detailHead(e.icon, e.name, isSeed ? null : e.info),
          pastilles([
            e.missing > 0
              ? { icon: CURRENCY.icon, text: `${String(purse)}/${String(e.price)}`, tone: 'missing', crossed: true, label: ctx.t(ctx.texts.extra.common.missingMoney, { missing: e.missing }) }
              : { icon: CURRENCY.icon, text: String(e.price), tone: 'price', label: ctx.t(ctx.texts.game.ui.shop.price, { price: e.price }) },
            ...itemFacts(ctx, e.item),
            owned > 0 ? { icon: 'grain-sack', text: `×${String(owned)}`, tone: 'count', label: ctx.t(ctx.texts.extra.common.inBag, { count: owned }) } : null,
          ]),
          detailActions(actions),
        ];
      },
      act: (tile) => buy(1, e.big ? null : tile),
    };
  }

  private sellItem(e: SellEntry, canSell: boolean): VitrineItem {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const k = ctx.texts.extra.shop;
    const sell = (count: number, from: Element): boolean => {
      if (!canSell) return false;
      this.host.send({ type: 'sell', item: e.item, quality: e.quality, count });
      flyCoin(from, 'sell');
      return true;
    };
    const fine = e.quality === 'fine';
    const name = fine ? `${e.name} (${ctx.texts.extra.common.fine})` : e.name;
    const word = e.word === null ? null : ctx.t(k[GROCER_WORD_KEYS[e.word]]);
    return {
      key: `item:${e.item}:${e.quality}`,
      tile: {
        icon: e.icon,
        name,
        label: ctx.t(v.sellLabel, { name, count: e.count, price: e.unit }),
        badge: { icon: null, text: `×${String(e.count)}`, tone: 'count' },
        corner: fine ? 'ui-star' : e.word === 'ardoise' || e.word === 'wanted' ? 'ui-notice' : null,
        state: canSell ? null : 'missing',
      },
      detail: () => {
        const one = button(ctx.t(k.sellOne), () => {
          sell(1, one);
        }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `sell:${e.item}:${e.quality}`, 'aria-disabled': canSell ? null : 'true' } });
        const all =
          e.count > 1
            ? button([icon(CURRENCY.icon), ctx.t(k.sellAll, { amount: e.total })], () => {
                sell(e.count, all ?? one);
              }, { attrs: { 'data-nav-item': true, 'data-key': `sellall:${e.item}:${e.quality}`, 'aria-disabled': canSell ? null : 'true' } })
            : null;
        return [
          ...detailHead(e.icon, name, word),
          pastilles([
            { icon: CURRENCY.icon, text: String(e.unit), tone: 'price', label: ctx.t(k.unitPrice, { price: e.unit }) },
            { icon: 'grain-sack', text: `×${String(e.count)}`, tone: 'count', label: ctx.t(ctx.texts.extra.common.inBag, { count: e.count }) },
            fine ? { icon: 'ui-star', text: '', tone: 'ok', label: ctx.texts.extra.common.fineQuality } : null,
          ]),
          detailActions([one, all]),
        ];
      },
      act: (tile) => sell(1, tile),
    };
  }
}

// ---------------------------------------------------------------------------
// Établi et réchaud (0.12.2: une carte par recette, ingrédients en icônes « possédés / requis »)

/** Clé de `textes-interface.json` (`shop`) de chaque mot du panneau de vente. */
const GROCER_WORD_KEYS = { ardoise: 'ardoiseLine', plenty: 'plenty', wanted: 'wanted' } as const;

export class StationPanel extends Panel {
  private readonly station: 'workbench' | 'stove';
  /** Établi: « Fabriquer », puis les commandes de Basile (chantiers, abris, pièces) dès qu'il y en a. */
  private tab: 'craft' | 'basile' = 'craft';
  private readonly tabs: HTMLDivElement;
  private readonly tabButtons: Record<'craft' | 'basile', HTMLButtonElement>;
  private withBasile: boolean | null = null;
  private readonly recipesPage: Vitrine;

  constructor(host: UiHost, station: 'workbench' | 'stove') {
    const { ctx } = host;
    const title = station === 'workbench' ? ctx.texts.game.ui.workbench.title : ctx.texts.game.ui.stove.title;
    super(host, {
      icon: station === 'workbench' ? 'plank' : 'stove',
      title: ctx.t(title),
      narrow: true,
      width: UI_SETTINGS.vitrine.stationWidth,
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.station = station;
    const v = ctx.texts.extra.vitrine;
    // Les cartes de recettes portent leur bouton: la vitrine ne sert ici qu'aux pages.
    this.recipesPage = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.recipesPerPage, label: ctx.t(v.recipes), noDetail: true });
    const make = (id: 'craft' | 'basile', label: string, iconId: string): HTMLButtonElement =>
      button([icon(iconId), label], () => {
        this.selectTab(id);
      }, { class: 'lpl-tab', attrs: { role: 'tab', 'aria-selected': 'false', tabindex: '-1', [SOUND_ATTR]: 'none' } });
    this.tabButtons = { craft: make('craft', ctx.t(v.craftTab), 'ui-hammer'), basile: make('basile', ctx.t(v.basileTab), 'ui-house') };
    this.tabs = el('div', { class: 'lpl-tabs', role: 'tablist', hidden: true }, [
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyQ') }),
      this.tabButtons.craft,
      this.tabButtons.basile,
      el('span', { class: 'lpl-key lpl-tabs__key', 'aria-hidden': 'true', text: ctx.key('KeyE') }),
    ]);
    this.header.insertBefore(this.tabs, this.closeButton);
    this.root.classList.add('lpl-panel--vitrine');
    this.markTabs();
  }

  private footerPages: boolean | null = null;

  /** Pied: A et E seulement quand il y a des pages ou l'onglet de Basile. */
  private footerFor(pages: boolean): void {
    if (pages === this.footerPages) return;
    this.footerPages = pages;
    const { ctx } = this.host;
    const a = ctx.texts.extra.keys.arrows;
    const groups: { keys: readonly string[]; text: string }[] = [];
    if (pages) groups.push({ keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: ctx.texts.extra.notebook.keysPages });
    groups.push({ keys: [...a], text: ctx.texts.extra.notebook.keysChoose });
    groups.push({ keys: [ctx.key('Enter')], text: this.station === 'workbench' ? ctx.texts.extra.workbench.keysCraft : lowerFirst(ctx.texts.game.ui.stove.cook) });
    this.setFooter([backKeys(this.host, groups)]);
  }

  private markTabs(): void {
    for (const id of ['craft', 'basile'] as const) {
      const b = this.tabButtons[id];
      b.setAttribute('aria-selected', String(id === this.tab));
      b.tabIndex = id === this.tab ? 0 : -1;
    }
  }

  private selectTab(tab: 'craft' | 'basile'): void {
    if (tab === this.tab || this.withBasile !== true) return;
    this.host.sound('ui-tab');
    this.tab = tab;
    this.markTabs();
    this.host.invalidate();
    window.requestAnimationFrame(() => {
      focusElement(this.defaultFocus());
    });
  }

  override key(code: string): boolean {
    const delta = pageDelta(code);
    if (delta === 0) return false;
    if (this.tab === 'craft' && this.recipesPage.turn(delta)) return true;
    if (this.withBasile === true) {
      const next = this.tab === 'craft' ? 'basile' : 'craft';
      if (next === 'craft') this.recipesPage.page = delta > 0 ? 0 : Number.MAX_SAFE_INTEGER;
      this.selectTab(next);
    }
    return true;
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const { cards, locked } = recipeCards(world, ctx, this.station);
    const food = this.station === 'stove' ? foodEntries(world, ctx) : [];
    const together = partnerAtHome(world, ctx);
    // Tour 9: la commande des chantiers de la maisonnette, à l'établi de Basile (dès la lettre `basile_works`).
    const basile = this.station === 'workbench' ? basileModel(world, ctx) : null;
    // 0.12: les abris des bêtes, une file à part chez Basile.
    const animals = this.station === 'workbench' ? basileModel(world, ctx, 'elevage') : null;
    // Tour 10: « Agrandir la maisonnette » (cellier, chambre) et le grand coffre de chêne.
    const rooms = this.station === 'workbench' ? basileRoomsModel(world, ctx) : null;
    const withBasile = basile !== null || animals !== null || rooms !== null;
    if (withBasile !== this.withBasile) {
      this.withBasile = withBasile;
      this.tabs.toggleAttribute('hidden', !withBasile);
      if (!withBasile) this.tab = 'craft';
      this.markTabs();
    }
    this.footerFor(withBasile || this.recipesPage.pagesFor(cards.length + (locked > 0 && this.station === 'workbench' ? 1 : 0)) > 1);
    const partnerName = nameOf(world, ctx.partner);
    if (this.tab === 'basile') {
      const sig = JSON.stringify(['basile', basile, animals, rooms, partnerName, world.purse]);
      this.renderBody(sig, () => {
        const nodes: HTMLElement[] = [];
        if (basile !== null) nodes.push(...basileSection(this.host, basile, partnerName));
        if (animals !== null) nodes.push(...basileSection(this.host, animals, partnerName, { title: ctx.texts.extra.farm.basileTitle, allBuilt: ctx.texts.extra.farm.basileAllBuilt }));
        if (rooms !== null) nodes.push(...basileRoomsSection(this.host, rooms));
        // La première section n'a pas d'écart au-dessus d'elle.
        nodes[0]?.classList.remove('lpl-section-gap');
        return nodes;
      });
      return;
    }
    const sig = JSON.stringify([cards, locked, food, together, this.recipesPage.page]);
    this.renderBody(sig, () => {
      const nodes: (Node | null)[] = [];
      if (cards.length === 0) nodes.push(el('div', { class: 'lpl-empty', text: ctx.t(ctx.texts.extra.workbench.noRecipes) }));
      else {
        const focus = cards[defaultProduct(cards)]?.id ?? null;
        const items: VitrineItem[] = cards.map((r) => ({ key: `recipe:${r.id}`, tile: { icon: r.icon, name: r.name, label: r.name }, detail: () => [] }));
        // La vitrine choisit la page et la carte du focus; les cartes, plus riches que des vignettes, sont construites ici.
        const page = this.recipesPage.build(items, focus === null ? null : `recipe:${focus}`);
        const grid = page.querySelector('.lpl-vitrine__grid');
        if (grid !== null) {
          const shown = new Set([...grid.querySelectorAll<HTMLElement>('[data-key]')].map((t) => t.dataset.key));
          const chosen = this.recipesPage.selection;
          grid.replaceChildren(...cards.filter((r) => shown.has(`recipe:${r.id}`)).map((r) => this.recipeCard(r, `recipe:${r.id}` === chosen)));
          if (locked > 0 && this.station === 'workbench') grid.append(this.lockedCard(locked));
        }
        page.classList.add('lpl-vitrine--recipes');
        nodes.push(page);
      }
      if (this.station === 'stove') nodes.push(this.foodRow(food, together));
      return nodes;
    });
  }

  /** Une recette: le plat en grand, ses ingrédients « possédés / requis », un seul bouton. */
  private recipeCard(r: RecipeCardModel, autofocus: boolean): HTMLElement {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const craftLabel = this.station === 'workbench' ? ctx.texts.game.ui.workbench.craft : ctx.texts.game.ui.stove.cook;
    const busy = r.progress !== null;
    const state = busy ? 'busy' : r.ready ? (r.available ? 'ready' : 'wait') : 'missing';
    const label = busy ? ctx.t(v.recipeBusy, { name: r.name }) : r.ready ? ctx.t(v.recipeReady, { name: r.name }) : ctx.t(v.recipeMissing, { name: r.name, count: r.missingKinds });
    const ingredients = el(
      'span',
      { class: 'lpl-recipe__inputs' },
      r.inputs.map((i) => need({ icon: i.icon, have: i.have, need: i.need, label: ingredientLabel(ctx, i) })),
    );
    const action = button(
      busy ? [el('span', { class: 'lpl-recipe__progress', style: `--lpl-value: ${String(Math.round((r.progress ?? 0) * 100))}%` }), ctx.t(ctx.texts.extra.workbench.inProgress)] : ctx.t(craftLabel),
      () => {
        if (r.available) this.host.send({ type: 'craft', recipe: r.id });
      },
      {
        class: `lpl-button lpl-recipe__button${r.available ? ' lpl-button--primary' : ''}`,
        attrs: { 'data-nav-item': true, 'data-key': `craft:${r.id}`, 'aria-disabled': r.available ? null : 'true', 'data-autofocus': autofocus, 'aria-label': `${ctx.t(craftLabel)} : ${label}` },
      },
    );
    return el('div', { class: 'lpl-recipe', 'data-state': state }, [
      el('span', { class: 'lpl-recipe__name', 'aria-hidden': 'true', text: r.name }),
      el('span', { class: 'lpl-recipe__dish', 'aria-hidden': 'true' }, [
        icon(r.icon, 'lpl-recipe__icon'),
        el('span', { class: 'lpl-recipe__yield' }, [pastille({ icon: null, text: `×${String(r.output.count)}`, tone: 'count', label: '' })]),
        r.fromChest === null ? null : el('span', { class: 'lpl-recipe__chest' }, [pastille({ icon: 'chest', tone: 'info', label: r.fromChest })]),
      ]),
      el('span', { class: 'lpl-recipe__arrow', 'aria-hidden': 'true' }, [ingredients]),
      action,
    ]);
  }

  /** Les plans encore à venir de Basile: une carte au cadenas, « +3 ». */
  private lockedCard(count: number): HTMLElement {
    const { ctx } = this.host;
    return el('div', { class: 'lpl-recipe lpl-recipe--locked', 'data-state': 'locked', tabindex: '0', 'data-nav-item': true, 'data-key': 'recipe:locked', role: 'img', 'aria-label': ctx.t(ctx.texts.extra.workbench.lockedPlans) }, [
      el('span', { class: 'lpl-recipe__dish', 'aria-hidden': 'true' }, [icon('ui-lock', 'lpl-recipe__icon')]),
      el('span', { class: 'lpl-recipe__locked-count', 'aria-hidden': 'true', text: `+${String(count)}` }),
    ]);
  }

  /** « Manger »: une rangée de vignettes; un clic ou Entrée mange. */
  private foodRow(food: readonly FoodEntry[], together: boolean): HTMLElement {
    const { ctx } = this.host;
    const v = ctx.texts.extra.vitrine;
    const st = ctx.texts.game.ui.stove;
    const head = el('h3', { class: 'lpl-vitrine__row-title' }, [
      icon('bread'),
      el('span', { text: ctx.t(ctx.texts.extra.stove.eatSection) }),
      together ? el('span', { class: 'lpl-vitrine__together' }, [token('self', this.host.symbol('self'), 'small'), token('other', this.host.symbol('other'), 'small')]) : null,
    ]);
    if (food.length === 0) return el('section', { class: 'lpl-food' }, [head, el('p', { class: 'lpl-vitrine__notice lpl-vitrine__notice--quiet', text: ctx.t(ctx.texts.extra.stove.nothingToEat) })]);
    const row = el(
      'div',
      { class: 'lpl-food__row', 'data-nav': 'grid' },
      food.map((f) =>
        button(
          [
            el('span', { class: 'lpl-tile__figure', 'aria-hidden': 'true' }, [icon(f.icon, 'lpl-tile__icon')]),
            el('span', { class: 'lpl-tile__badge', 'aria-hidden': 'true' }, [pastille({ icon: null, text: `×${String(f.count)}`, tone: 'count', label: '' })]),
            el('span', { class: 'lpl-tile__below', 'aria-hidden': 'true' }, [pastille({ icon: 'ui-stamina', text: `+${String(f.snack)}`, tone: 'ok', label: '' })]),
            el('span', { class: 'lpl-tile__name', 'aria-hidden': 'true', text: f.name }),
          ],
          () => {
            this.host.send({ type: 'eat', item: f.item });
          },
          {
            class: 'lpl-tile lpl-tile--food',
            attrs: {
              'data-nav-item': true,
              'data-key': `eat:${f.item}`,
              'aria-label': `${ctx.t(together ? st.eatTogether : st.eat)} : ${ctx.t(v.eatLabel, { name: f.name, count: f.count, snack: f.snack })}`,
            },
          },
        ),
      ),
    );
    return el('section', { class: 'lpl-food' }, [head, row]);
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
