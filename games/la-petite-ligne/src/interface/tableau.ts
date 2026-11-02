/**
 * Le tableau du quai (tour 9, sections 1.6, 2.3 et 2.6): le catalogue de la semaine par rayons,
 * puis, dès la lettre de Firmin (jour 16), les onglets « Annonces » et « Chantiers ». A et E
 * changent d'onglet, comme au comptoir. Le bloc de commande des chantiers de la maisonnette
 * (`chantierActions`) sert aussi à l'établi de Basile.
 */
import { catalogueWindow } from '../donnees/commandes';
import type { ReadonlyWorld } from '../etat/types';
import type { PanelTab, UiHost } from './composant';
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
import { Panel, backKeys, price, purseBadge } from './panneau';
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
    this.root.classList.add('lpl-board');
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
    const sig = JSON.stringify(['catalogue', shelves, open, delivered, partnerName, world.purse]);
    this.renderBody(sig, () => {
      let summary: HTMLElement;
      if (delivered && inChest > 0) {
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', {}, [
            icon('parcel'),
            ' ',
            inChest === 1 ? ctx.t(k.deliveredOne) : ctx.t(k.delivered, { count: inChest }),
          ]),
          el('span', { text: ctx.t(k.deliveredText) }),
        ]);
      } else if (!open) {
        const time = hourLabel(
          catalogueWindow(ctx.content.settings, world.clock.day).delivery.time,
          ctx.texts.game.ui.hud.time,
        );
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', {}, [icon('ui-lock'), ' ', ctx.t(k.closed)]),
          el('span', { text: ctx.t(k.closedText, { time }) }),
        ]);
      } else {
        const ordered = products.filter((p) => p.ordered > 0);
        const list = ordered
          .map(
            (p) =>
              `${itemName(ctx.content.items[p.item], p.ordered, p.item)}, ${ctx.t(ctx.texts.game.ui.shop.price, { price: p.price * p.ordered })}`,
          )
          .join(' · ');
        summary = el('div', { class: 'lpl-order__summary' }, [
          el('strong', {
            text: ordered.length === 0 ? ctx.t(k.orderedNone) : ctx.t(k.ordered, { list }),
          }),
          el('span', {
            text: ctx.t(k.bigPurchase, {
              amount: ctx.content.settings.economy.bigPurchaseThreshold,
            }),
          }),
        ]);
      }
      const focusItem = products[defaultProduct(products)]?.item ?? null;
      const sections = shelves.map((s, i) =>
        el(
          'section',
          { class: `lpl-shelf${i > 0 ? ' lpl-section-gap' : ''}`, 'aria-label': s.title },
          [
            el('h3', { class: 'lpl-section-title', text: s.title }),
            el(
              'div',
              { class: 'lpl-catalog', 'data-nav': 'grid' },
              s.products.map((p) => this.product(p, partnerName, p.item === focusItem)),
            ),
          ],
        ),
      );
      const mine = products.some((p) => p.state === 'waiting');
      const withdraw = mine
        ? el('div', { class: 'lpl-sheet__actions', style: 'margin-top: 0.75rem' }, [
            button(
              ctx.t(k.withdraw),
              () => {
                this.host.send({ type: 'proposal_withdraw' });
              },
              { attrs: { 'data-nav-item': true, 'data-key': 'withdraw' } },
            ),
          ])
        : null;
      return [
        summary,
        el(
          'div',
          { class: 'lpl-shelves', role: 'region', 'aria-label': ctx.t(k.shelvesLabel) },
          sections,
        ),
        withdraw,
      ];
    });
  }

  private product(p: ProductModel, partnerName: string, autofocus: boolean): HTMLButtonElement {
    const { ctx } = this.host;
    const k = ctx.texts.extra.catalogue;
    const status = el('span', { class: 'lpl-product__status' });
    let stamp: HTMLElement | null = null;
    let pressed = false;
    let disabled = false;
    let waiting = false;
    switch (p.state) {
      case 'ordered':
        pressed = true;
        status.append(price(this.host, p.price), ` · ${ctx.t(k.statusOrdered)}`);
        stamp = el('span', { class: 'lpl-stamp lpl-stamp--green', text: ctx.t(k.stampOrdered) });
        break;
      case 'delivered':
        status.append(ctx.t(k.inChest));
        stamp = el('span', { class: 'lpl-stamp', text: ctx.t(k.stampDelivered) });
        break;
      case 'waiting':
        waiting = true;
        status.append(
          el('span', { class: 'lpl-product__price' }, [
            icon('ui-coin'),
            ctx.t(k.reserved, { amount: p.price }),
          ]),
          el('br'),
          chip(ctx.t(k.waitingPartner, { partner: partnerName }), 'waiting', 'ui-hourglass'),
        );
        break;
      case 'partner_waiting':
        disabled = true;
        status.append(
          price(this.host, p.price),
          el('br'),
          chip(ctx.t(k.proposedBy, { partner: partnerName }), 'waiting', 'ui-hourglass'),
        );
        break;
      case 'too_expensive':
        disabled = true;
        status.append(
          price(this.host, p.price),
          el('br'),
          el('span', {
            class: 'lpl-text-alert',
            text: ctx.t(ctx.texts.extra.common.missingMoney, { missing: p.missing }),
          }),
        );
        break;
      case 'closed':
        disabled = true;
        status.append(price(this.host, p.price), ` · ${ctx.t(k.closedStatus)}`);
        break;
      case 'orderable':
        status.append(price(this.host, p.price));
        if (p.big) {
          const askChip = chip(ctx.t(k.askPartner, { partner: partnerName }));
          askChip.prepend(token('other', this.host.symbol('other'), 'small'));
          status.append(el('br'), askChip);
        } else {
          status.append(` · ${ctx.t(k.enterToOrder, { key: ctx.key('Enter') })}`);
        }
        break;
    }
    // Outils (deux exemplaires, un par joueur): ce qu'il en reste, et ce qui part déjà au train.
    const copies =
      p.copies > 1 && p.state !== 'ordered'
        ? el('span', { class: 'lpl-product__copies' }, [
            ctx.t(k.copiesLeft, { left: p.left, copies: p.copies }),
            p.ordered > 0 ? ` · ${ctx.t(k.orderedCount, { count: p.ordered })}` : '',
          ])
        : null;
    return button(
      [
        icon(p.icon, 'lpl-product__icon'),
        el('span', { class: 'lpl-product__name', text: p.name }),
        el('span', { class: 'lpl-product__effect', text: p.effect }),
        copies,
        status,
        stamp,
      ],
      () => {
        if (p.state === 'orderable') this.host.send({ type: 'catalogue_order', item: p.item });
      },
      {
        class: 'lpl-product',
        attrs: {
          'data-nav-item': true,
          'data-key': `product:${p.item}`,
          'data-shelf': p.shelf,
          'aria-pressed': pressed ? 'true' : 'false',
          'aria-disabled': disabled ? 'true' : null,
          'data-state': waiting ? 'waiting' : null,
          'data-autofocus': autofocus,
        },
      },
    );
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
