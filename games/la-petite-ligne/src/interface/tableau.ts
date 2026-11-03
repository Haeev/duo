/**
 * Le tableau du quai (tour 9, sections 1.6, 2.3 et 2.6): le catalogue de la semaine par rayons,
 * puis, dès la lettre de Firmin (jour 16), les onglets « Annonces » et « Chantiers ». A et E
 * changent d'onglet, comme au comptoir. Le bloc de commande des chantiers de la maisonnette
 * (`chantierActions`) sert aussi à l'établi de Basile.
 */
import { catalogueWindow } from '../donnees/commandes';
import { CURRENCY } from '../donnees/monnaie';
import type { ReadonlyWorld } from '../etat/types';
import type { PanelTab, UiHost } from './composant';
import { UI_SETTINGS } from './config';
import { nameOf } from './contexte';
import { button, chip, el, icon, token } from './dom';
import { defaultProduct } from './focus';
import { hourLabel, itemName } from './format';
import { purseModel } from './modele';
import type { ProductModel } from './modele-panneaux';
import { catalogueDelivered, catalogueOpen } from './modele-panneaux';
import {
  type AnnonceModel,
  BOARD_TABS,
  type BoardTab,
  type ChantierModel,
  type BuiltChantier,
  boardAnnonces,
  boardOpen,
  catalogueShelves,
  chantiersPage,
} from './modele-tableau';
import { Panel, backKeys, purseBadge } from './panneau';
import { itemFacts } from './modele-vitrine';
import { type VitrineItem, Vitrine, detailActions, detailHead, flyCoin, pastille, pastilles } from './vitrine';
import { SOUND_ATTR } from './sons';

/** Dernier onglet ouvert du tableau, gardé d'une ouverture à l'autre (`null`: les annonces, une fois le tableau ouvert). */
let lastTab: BoardTab | null = null;

/** Onglet du prochain tableau ouvert (page de démonstration, captures). */
export function rememberBoardTab(tab: BoardTab): void {
  lastTab = tab;
}

const TAB_ICONS: Readonly<Record<BoardTab, string>> = {
  catalogue: 'ui-notebook',
  annonces: 'ui-notice',
  chantiers: 'ui-hammer',
};

export class BoardPanel extends Panel {
  private tab: BoardTab;
  private readonly tabs: HTMLDivElement;
  private readonly tabButtons: Record<BoardTab, HTMLButtonElement>;
  private readonly purseSlot: HTMLSpanElement;
  private readonly partnerNote: HTMLSpanElement;
  private withTabs: boolean | null = null;
  /** Patch 0.12.2: le catalogue en vignettes, par pages de 24. */
  private readonly catalogue: Vitrine;
  private lastWorld: ReadonlyWorld | null = null;

  constructor(host: UiHost, tab: PanelTab | undefined) {
    const { ctx } = host;
    super(host, {
      icon: 'ui-notebook',
      title: ctx.t(ctx.texts.game.ui.catalogue.title),
      subtitle: ctx.t(ctx.texts.game.ui.catalogue.subtitle),
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.tab =
      tab === 'catalogue' || tab === 'annonces' || tab === 'chantiers'
        ? tab
        : (lastTab ?? 'annonces');
    const b = ctx.texts.extra.board;
    const g = ctx.texts.game.ui.board;
    const make = (id: BoardTab, label: string): HTMLButtonElement =>
      button(
        [icon(TAB_ICONS[id]), label],
        () => {
          this.select(id);
        },
        {
          class: 'lpl-tab',
          attrs: {
            role: 'tab',
            'aria-selected': 'false',
            tabindex: '-1',
            'data-tab': id,
            [SOUND_ATTR]: 'none',
          },
        },
      );
    this.tabButtons = {
      catalogue: make('catalogue', ctx.t(b.catalogueTab)),
      annonces: make('annonces', ctx.t(g.annonces)),
      chantiers: make('chantiers', ctx.t(g.chantiers)),
    };
    this.tabs = el(
      'div',
      { class: 'lpl-tabs lpl-board__tabs', role: 'tablist', 'aria-label': ctx.t(b.tabsLabel) },
      [
        el('span', {
          class: 'lpl-key lpl-tabs__key',
          'aria-hidden': 'true',
          text: ctx.key('KeyQ'),
        }),
        this.tabButtons.catalogue,
        this.tabButtons.annonces,
        this.tabButtons.chantiers,
        el('span', {
          class: 'lpl-key lpl-tabs__key',
          'aria-hidden': 'true',
          text: ctx.key('KeyE'),
        }),
      ],
    );
    this.purseSlot = el('span', { class: 'lpl-panel__close' });
    this.closeButton.classList.remove('lpl-panel__close');
    this.header.insertBefore(this.tabs, this.closeButton);
    this.header.insertBefore(this.purseSlot, this.closeButton);
    this.partnerNote = el('span');
    this.root.classList.add('lpl-board', 'lpl-panel--vitrine');
    this.catalogue = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.catalogPerPage, label: ctx.t(ctx.texts.extra.catalogue.shelvesLabel), variant: 'lpl-vitrine--catalog' });
  }

  /** Pied: touches de l'onglet (A et E pour les pages dès que le tableau a ses onglets). */
  private footerFor(tabs: boolean): void {
    const { ctx } = this.host;
    const a = ctx.texts.extra.keys.arrows;
    const n = ctx.texts.extra.notebook;
    const groups: { keys: readonly string[]; text: string }[] = [];
    if (tabs) groups.push({ keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: n.keysPages });
    groups.push({ keys: [...a], text: n.keysChoose });
    if (this.currentTab(tabs) === 'catalogue')
      groups.push({ keys: [ctx.key('Enter')], text: ctx.texts.extra.catalogue.keysOrder });
    else if (this.currentTab(tabs) === 'chantiers')
      groups.push({ keys: [ctx.key('Enter')], text: ctx.texts.extra.board.keysPay });
    this.setFooter([backKeys(this.host, groups), this.partnerNote]);
  }

  private currentTab(tabs: boolean): BoardTab {
    return tabs ? this.tab : 'catalogue';
  }

  private markTabs(): void {
    for (const id of BOARD_TABS) {
      const btn = this.tabButtons[id];
      btn.setAttribute('aria-selected', String(id === this.tab));
      btn.tabIndex = id === this.tab ? 0 : -1;
    }
  }

  private select(tab: BoardTab): void {
    if (tab === this.tab || this.withTabs !== true) return;
    this.host.sound('ui-tab');
    this.tab = tab;
    lastTab = tab;
    this.markTabs();
    this.footerFor(true);
    this.host.invalidate();
  }

  override key(code: string): boolean {
    // A et E: les pages du catalogue d'abord, puis l'onglet voisin.
    if ((code === 'KeyQ' || code === 'KeyE') && this.currentTab(this.withTabs === true) === 'catalogue' && this.catalogue.turn(code === 'KeyQ' ? -1 : 1)) return true;
    if ((code === 'KeyQ' || code === 'KeyE') && this.withTabs === true) {
      const index = BOARD_TABS.indexOf(this.tab);
      const next =
        BOARD_TABS[(index + (code === 'KeyQ' ? -1 : 1) + BOARD_TABS.length) % BOARD_TABS.length] ??
        'catalogue';
      this.select(next);
      return true;
    }
    return false;
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    this.lastWorld = world;
    const tabs = boardOpen(world, ctx);
    if (tabs !== this.withTabs) {
      this.withTabs = tabs;
      this.tabs.toggleAttribute('hidden', !tabs);
      this.titleEl.textContent = tabs
        ? ctx.t(ctx.texts.extra.board.title)
        : ctx.t(ctx.texts.game.ui.catalogue.title);
      this.markTabs();
      this.footerFor(tabs);
    }
    const amount = purseModel(world).amount;
    if (this.purseSlot.dataset.amount !== String(amount)) {
      this.purseSlot.dataset.amount = String(amount);
      this.purseSlot.replaceChildren(purseBadge(this.host, world));
    }
    const tab = this.currentTab(tabs);
    if (tab === 'annonces') this.renderAnnonces(world);
    else if (tab === 'chantiers') this.renderChantiers(world);
    else this.renderCatalogue(world);
  }

  // -------------------------------------------------------------------------
  // Catalogue

  private renderCatalogue(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const k = ctx.texts.extra.catalogue;
    const shelves = catalogueShelves(world, ctx);
    const products = shelves.flatMap((s) => s.products);
    const open = catalogueOpen(world, ctx);
    const delivered = catalogueDelivered(world, ctx);
    const partnerName = nameOf(world, ctx.partner);
    this.partnerNote.textContent = open ? ctx.t(k.partnerSees, { partner: partnerName }) : '';
    const inChest = products.filter((p) => p.state === 'delivered').length;
    this.setSubtitle(
      delivered && inChest > 0
        ? ctx.t(k.deliveredSubtitle)
        : open
          ? ctx.t(ctx.texts.game.ui.catalogue.subtitle)
          : ctx.t(k.closedSubtitle),
    );
    const vitrine = this.catalogue;
    const sig = JSON.stringify(['catalogue', shelves, open, delivered, partnerName, world.purse, vitrine.page]);
    this.renderBody(sig, () => {
      const strip: HTMLElement[] = [];
      if (delivered && inChest > 0) {
        strip.push(el('p', { class: 'lpl-vitrine__notice' }, [icon('parcel'), inChest === 1 ? ctx.t(k.deliveredOne) : ctx.t(k.delivered, { count: inChest })]));
      } else if (!open) {
        const time = hourLabel(catalogueWindow(ctx.content.settings, world.clock.day).delivery.time, ctx.texts.game.ui.hud.time);
        strip.push(el('p', { class: 'lpl-vitrine__notice' }, [icon('ui-lock'), ctx.t(k.closed), ' ', pastille({ icon: 'ui-train', text: time, tone: 'info', label: ctx.t(k.closedText, { time }) })]));
      } else {
        const ordered = products.filter((p) => p.ordered > 0);
        const list = ordered.map((p) => `${itemName(ctx.content.items[p.item], p.ordered, p.item)}, ${ctx.t(ctx.texts.game.ui.shop.price, { price: p.price * p.ordered })}`).join(' · ');
        const total = ordered.reduce((sum, p) => sum + p.price * p.ordered, 0);
        const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
        const big = pastille({ icon: null, text: `≥ ${String(threshold)}`, tone: 'info', label: ctx.t(k.bigPurchase, { amount: threshold }) });
        big.prepend(token('other', this.host.symbol('other'), 'small'));
        strip.push(
          el('div', { class: 'lpl-vitrine__strip' }, [
            pastille({ icon: 'parcel', text: ordered.length === 0 ? '0' : `${String(ordered.reduce((n, p) => n + p.ordered, 0))} · ${String(total)}`, tone: ordered.length === 0 ? 'count' : 'ok', label: ordered.length === 0 ? ctx.t(k.orderedNone) : ctx.t(k.ordered, { list }) }),
            big,
          ]),
        );
      }
      const focusItem = products[defaultProduct(products)]?.item ?? null;
      const items = products.map((p) => this.productItem(p, partnerName, shelves.find((s) => s.shelf === p.shelf)?.title ?? ''));
      const mine = products.some((p) => p.state === 'waiting');
      const withdraw = mine
        ? el('div', { class: 'lpl-sheet__actions' }, [
            button(ctx.t(k.withdraw), () => {
              this.host.send({ type: 'proposal_withdraw' });
            }, { attrs: { 'data-nav-item': true, 'data-key': 'withdraw' } }),
          ])
        : null;
      return [...strip, vitrine.build(items, focusItem === null ? null : `product:${focusItem}`), withdraw];
    });
  }

  /** Une vignette du catalogue: le dessin, le prix en pastille, l'état en marque (coche, colis, sablier). */
  private productItem(p: ProductModel, partnerName: string, shelfTitle: string): VitrineItem {
    const { ctx } = this.host;
    const k = ctx.texts.extra.catalogue;
    const v = ctx.texts.extra.vitrine;
    const order = (from: Element | null): boolean => {
      if (p.state !== 'orderable') return false;
      this.host.send({ type: 'catalogue_order', item: p.item });
      if (from !== null && !p.big) flyCoin(from, 'buy');
      return true;
    };
    let corner: string | Node | null = null;
    let state: 'missing' | 'done' | 'wait' | 'locked' | null = null;
    let status: HTMLElement | null = null;
    switch (p.state) {
      case 'ordered':
        corner = 'ui-check';
        state = 'done';
        status = el('span', { class: 'lpl-stamp lpl-stamp--green', text: ctx.t(k.stampOrdered) });
        break;
      case 'delivered':
        corner = 'parcel';
        state = 'done';
        status = el('span', { class: 'lpl-stamp', text: ctx.t(k.stampDelivered) });
        break;
      case 'waiting':
        corner = 'ui-hourglass';
        state = 'wait';
        status = chip(ctx.t(k.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass');
        break;
      case 'partner_waiting':
        corner = 'ui-hourglass';
        state = 'locked';
        status = chip(ctx.t(k.proposedBy, { partner: partnerName }), 'waiting', 'ui-hourglass');
        break;
      case 'too_expensive':
        state = 'missing';
        break;
      case 'closed':
        corner = 'ui-lock';
        state = 'locked';
        break;
      case 'orderable':
        corner = p.big ? token('other', this.host.symbol('other'), 'small') : null;
        break;
    }
    const label =
      p.state === 'too_expensive'
        ? ctx.t(v.missingLabel, { name: p.name, price: p.price, missing: p.missing })
        : p.state === 'orderable' && p.big
          ? ctx.t(v.bigLabel, { name: p.name, price: p.price, partner: partnerName })
          : `${ctx.t(v.priceLabel, { name: p.name, price: p.price })}${status === null ? '' : `, ${status.textContent}`}`;
    return {
      key: `product:${p.item}`,
      tile: {
        icon: p.icon,
        name: p.name,
        label,
        badge: { icon: null, text: String(p.price), tone: p.state === 'too_expensive' ? 'missing' : 'price' },
        corner,
        state,
        attrs: { 'data-shelf': p.shelf },
      },
      detail: () => {
        const purse = this.lastWorld === null ? 0 : purseModel(this.lastWorld).amount;
        const actions: (HTMLElement | null)[] = [status];
        if (p.state === 'orderable' || p.state === 'too_expensive') {
          const content = p.big ? [token('other', this.host.symbol('other'), 'small'), ctx.t(ctx.texts.extra.shop.propose, { partner: partnerName })] : [ctx.t(v.order)];
          const orderButton = button(content, () => {
            order(orderButton);
          }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': `order:${p.item}`, 'aria-disabled': p.state === 'orderable' ? null : 'true' } });
          actions.push(orderButton);
        }
        return [
          el('span', { class: 'lpl-overline', text: shelfTitle }),
          ...detailHead(p.icon, p.name, p.effect),
          pastilles([
            p.state === 'too_expensive'
              ? { icon: CURRENCY.icon, text: `${String(purse)}/${String(p.price)}`, tone: 'missing', crossed: true, label: ctx.t(ctx.texts.extra.common.missingMoney, { missing: p.missing }) }
              : { icon: CURRENCY.icon, text: String(p.price), tone: 'price', label: ctx.t(ctx.texts.game.ui.shop.price, { price: p.price }) },
            p.copies > 1 && p.state !== 'ordered' ? { icon: p.icon, text: `${String(p.left)}/${String(p.copies)}`, tone: 'count', label: ctx.t(k.copiesLeft, { left: p.left, copies: p.copies }) } : null,
            p.ordered > 0 && p.copies > 1 ? { icon: 'parcel', text: `×${String(p.ordered)}`, tone: 'ok', label: ctx.t(k.orderedCount, { count: p.ordered }) } : null,
            ...itemFacts(ctx, p.item),
          ]),
          detailActions(actions),
        ];
      },
      act: (tile) => order(tile),
    };
  }
  // -------------------------------------------------------------------------
  // Annonces

  private renderAnnonces(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const b = ctx.texts.extra.board;
    this.partnerNote.textContent = '';
    this.setSubtitle(ctx.t(b.annoncesSubtitle));
    const model = boardAnnonces(world, ctx);
    const sig = JSON.stringify(['annonces', model]);
    this.renderBody(sig, () => {
      if (model.current === null) {
        return [
          el(
            'div',
            {
              class: 'lpl-empty',
              tabindex: '0',
              'data-nav-item': true,
              'data-key': 'annonce:none',
              'data-autofocus': true,
            },
            [icon('ui-notice'), ctx.t(b.noAnnonce)],
          ),
        ];
      }
      const nodes: HTMLElement[] = [
        el('h3', { class: 'lpl-section-title', text: ctx.t(b.current) }),
        annonceCard(this.host, model.current, true),
      ];
      if (model.previous !== null) {
        nodes.push(
          el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(b.previous) }),
          annonceCard(this.host, model.previous, false),
        );
      }
      return nodes;
    });
  }

  // -------------------------------------------------------------------------
  // Chantiers du bourg

  private renderChantiers(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const b = ctx.texts.extra.board;
    const partnerName = nameOf(world, ctx.partner);
    this.partnerNote.textContent = '';
    this.setSubtitle(ctx.t(b.chantiersSubtitle));
    const page = chantiersPage(world, ctx);
    const sig = JSON.stringify(['chantiers', page, partnerName, world.purse]);
    this.renderBody(sig, () => {
      const nodes: HTMLElement[] = [
        el('h3', {
          class: 'lpl-section-title',
          text: ctx.t(ctx.texts.game.ui.board.chantiersTitle),
        }),
      ];
      if (page.open !== null) nodes.push(chantierCard(this.host, page.open, partnerName, true));
      else {
        nodes.push(
          el(
            'div',
            {
              class: 'lpl-empty',
              tabindex: '0',
              'data-nav-item': true,
              'data-key': 'chantier:none',
              'data-autofocus': true,
            },
            [icon('ui-hammer'), ctx.t(page.allBuilt ? b.allBuilt : b.nextTomorrow)],
          ),
        );
      }
      if (page.home !== '')
        nodes.push(
          el('p', { class: 'lpl-field__help lpl-chantier__home' }, [
            icon('ui-house'),
            ' ',
            page.home,
          ]),
        );
      if (page.built.length > 0)
        nodes.push(
          el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(b.builtTitle) }),
          builtList(page.built),
        );
      return nodes;
    });
  }
}

/** Carte d'une annonce: titre, mot de l'habitant, liste à cocher, échéance, récompense, tampon. */
export function annonceCard(host: UiHost, a: AnnonceModel, current: boolean): HTMLElement {
  const { ctx } = host;
  const b = ctx.texts.extra.board;
  const titleId = `annonce-${a.gabarit}-${current ? 'cur' : 'prev'}`;
  const stamp =
    a.stamp === null
      ? null
      : el(
          'span',
          {
            class: 'lpl-stamp lpl-annonce__stamp',
            'data-player': a.by,
            'data-state': a.state,
            role: 'img',
            'aria-label': a.stampLabel ?? a.stamp,
          },
          [a.by === null ? null : token(a.by, host.symbol(a.by), 'small'), a.stamp],
        );
  const lines = el('ul', {
    class: 'lpl-order lpl-annonce__lines',
    'aria-label': ctx.t(b.linesLabel),
  });
  for (const l of a.lines) {
    lines.append(
      el(
        'li',
        { class: 'lpl-order__line lpl-annonce__line', 'data-state': l.done ? 'done' : null },
        [
          el(
            'span',
            {
              class: 'lpl-order__box',
              role: 'img',
              'aria-label': ctx.t(l.done ? b.lineDone : b.lineTodo),
            },
            [icon('ui-check')],
          ),
          icon(l.icon, 'lpl-order__icon'),
          el('span', { class: 'lpl-order__name' }, [
            l.text,
            a.state === 'open' && !l.done
              ? el('small', {
                  text:
                    l.inBag > 0
                      ? ctx.t(ctx.texts.extra.common.inBag, { count: l.inBag })
                      : ctx.t(ctx.texts.extra.common.noneInBag),
                })
              : null,
          ]),
          el('span', { class: 'lpl-order__count' }, [
            ctx.t(b.lineGiven, { have: l.have, need: l.need }),
          ]),
        ],
      ),
    );
  }
  if (a.scene !== null) {
    const done = a.state === 'done';
    lines.append(
      el('li', { class: 'lpl-order__line lpl-annonce__line', 'data-state': done ? 'done' : null }, [
        el(
          'span',
          {
            class: 'lpl-order__box',
            role: 'img',
            'aria-label': ctx.t(done ? b.lineDone : b.lineTodo),
          },
          [icon('ui-check')],
        ),
        icon('ui-heart', 'lpl-order__icon'),
        el('span', {
          class: 'lpl-order__name',
          text: ctx.t(a.lines.length === 0 ? b.sceneOnly : b.sceneLine),
        }),
        el('span'),
      ]),
    );
  }
  return el(
    'article',
    {
      class: `lpl-annonce${current ? '' : ' lpl-annonce--previous'}`,
      'data-state': a.state,
      'data-kind': a.kind,
      tabindex: '0',
      'data-nav-item': true,
      'data-key': `annonce:${a.gabarit}:${current ? 'current' : 'previous'}`,
      'data-autofocus': current,
      'aria-labelledby': titleId,
    },
    [
      el('div', { class: 'lpl-annonce__head' }, [
        chip(
          a.kindLabel,
          a.kind === 'together' ? 'ready' : '',
          a.kind === 'together' ? 'ui-heart' : 'ui-notice',
        ),
        el('h4', { class: 'lpl-annonce__title', id: titleId, text: a.title }),
        stamp,
      ]),
      current || a.state === 'open' ? el('p', { class: 'lpl-annonce__text', text: a.text }) : null,
      current || a.state === 'open' ? lines : null,
      el('p', { class: 'lpl-annonce__meta' }, [
        a.state === 'open' ? el('span', {}, [icon('ui-hourglass'), ' ', a.deadline]) : null,
        el('span', {}, [icon('ui-coin'), ' ', a.reward]),
      ]),
      a.help === '' ? null : el('p', { class: 'lpl-annonce__help', text: a.help }),
    ],
  );
}

/**
 * Carte d'un chantier (tableau du quai et établi de Basile): progression, puis les versements
 * possibles; au-delà du seuil, l'accord de l'autre (proposition, comme un gros achat).
 */
export function chantierCard(
  host: UiHost,
  c: ChantierModel,
  partnerName: string,
  autofocus: boolean,
  extra: readonly (HTMLElement | null)[] = [],
  /** À l'établi de Basile: le prix restant en titre, les planches apportées sous la barre. */
  basile: { title: string; progress: string; percent: number } | null = null,
): HTMLElement {
  const { ctx } = host;
  const b = ctx.texts.extra.board;
  const k = ctx.texts.extra.catalogue;
  const threshold = ctx.content.settings.economy.bigPurchaseThreshold;
  const actions: (HTMLElement | null)[] = [...extra];
  let note: HTMLElement | null = null;
  if (c.funded) note = chip(ctx.t(ctx.texts.game.ui.board.funded), 'ready', 'ui-check');
  else if (c.pending === 'mine') {
    note = chip(ctx.t(k.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass');
    actions.push(
      button(
        ctx.t(k.withdraw),
        () => {
          host.send({ type: 'proposal_withdraw' });
        },
        { attrs: { 'data-nav-item': true, 'data-key': `withdraw:${c.id}` } },
      ),
    );
  } else if (c.pending === 'partner')
    note = chip(ctx.t(k.proposedBy, { partner: partnerName }), 'waiting', 'ui-hourglass');
  const rest = c.options.length - 1;
  c.options.forEach((o, i) => {
    const missing = o.missing > 0;
    const label =
      o.big && !missing ? [o.label, ' ', token('other', host.symbol('other'), 'small')] : o.label;
    actions.push(
      button(
        label,
        () => {
          host.send({ type: 'improvement_pay', improvement: c.id, amount: o.amount });
        },
        {
          class: `lpl-button${i === rest ? ' lpl-button--primary' : ''}`,
          attrs: {
            'data-nav-item': true,
            'data-key': o.key,
            'aria-disabled': missing ? 'true' : null,
            'aria-label':
              o.big && !missing
                ? `${o.label}. ${ctx.t(k.askPartner, { partner: partnerName })}`
                : null,
            'data-autofocus': autofocus && i === 0,
          },
        },
      ),
    );
  });
  const missingOption = c.options.find((o) => o.missing > 0);
  const help: (HTMLElement | null)[] = [];
  if (c.options.some((o) => o.big && o.missing === 0))
    help.push(
      el('p', {
        class: 'lpl-field__help',
        text: ctx.t(b.bigPay, { amount: threshold, partner: partnerName }),
      }),
    );
  if (missingOption !== undefined) {
    help.push(
      el('p', {
        class: 'lpl-text-alert lpl-chantier__missing',
        text: ctx.t(basile === null ? b.missingFor : ctx.texts.extra.common.missingMoney, {
          missing: missingOption.missing,
          amount: missingOption.sum,
        }),
      }),
    );
  }
  const focusable = actions.every((a) => a === null);
  return el(
    'article',
    {
      class: 'lpl-chantier',
      'data-state': c.funded ? 'funded' : c.pending !== null ? 'pending' : null,
      tabindex: focusable ? '0' : null,
      'data-nav-item': focusable ? true : null,
      'data-key': focusable ? `chantier:${c.id}` : null,
      'data-autofocus': focusable && autofocus ? true : null,
    },
    [
      el('div', { class: 'lpl-chantier__head' }, [
        icon(c.queue === 'bourg' ? 'ui-hammer' : 'ui-house'),
        el('h4', { class: 'lpl-chantier__title', text: basile?.title ?? c.name }),
      ]),
      el('div', { class: 'lpl-order__progress lpl-chantier__progress' }, [
        basile === null
          ? el('span', { class: 'lpl-order__count' }, [
              ctx.t(b.progressLabel, { paid: c.price - c.remaining, price: c.price }),
              c.planksNote === '' ? null : el('small', { text: ` ${c.planksNote}` }),
            ])
          : el('span', { class: 'lpl-chantier__planks', text: basile.progress }),
        el(
          'span',
          { class: 'lpl-order__bar', role: 'img', 'aria-label': basile?.progress ?? c.progress },
          [el('span', { style: `--lpl-value: ${basile?.percent ?? c.percent}%` })],
        ),
      ]),
      note === null ? null : el('p', { class: 'lpl-chantier__note' }, [note]),
      actions.some((a) => a !== null)
        ? el('div', { class: 'lpl-chantier__actions', 'data-nav': 'row' }, actions)
        : null,
      ...help,
    ],
  );
}

/** Les chantiers déjà bâtis, du plus récent au plus ancien. */
export function builtList(built: readonly BuiltChantier[]): HTMLElement {
  return el(
    'ul',
    { class: 'lpl-built' },
    built.map((x) =>
      el('li', { class: 'lpl-built__item' }, [
        icon('ui-check', 'lpl-icon lpl-quest__done'),
        el('span', { class: 'lpl-built__name', text: x.name }),
        el('small', { class: 'lpl-built__when', text: x.when }),
        x.text === '' ? null : el('span', { class: 'lpl-built__text', text: x.text }),
      ]),
    ),
  );
}
