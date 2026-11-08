/**
 * Tablette de la maison (CC10, ux 4.7, maquette `tablette.html`): Tab l'ouvre et la ferme,
 * Retour arrière ou un clic à côté la ferment aussi, jamais Échap. Sections à gauche (A et E),
 * pied avec les touches. Le café continue derrière. Sections de la démo: Accueil, Commandes,
 * Catalogue, Carte et prix, Nos projets, Réglages (pour toi, puis pour vous deux).
 */
import type { LayerSpec } from './calques';
import { footer } from './calques';
import type { TabletSection, UiContext } from './contexte';
import { button, h, icon, keycap, type IconName } from './dom';
import type { CatalogueItemView, InterfaceModel, ProjectView } from './modele';
import { horizontalFov, TEXT_SCALE, type PlayerSettings, type SettingKey } from './reglages';
import { T, WEEKDAYS } from './textes';
import { capital, euros, fill, heure } from './typo';

const SECTIONS: readonly (readonly [TabletSection, string, IconName])[] = [
  ['home', T.tablet.sections.home, 'tablet'],
  ['orders', T.tablet.sections.orders, 'box'],
  ['catalogue', T.tablet.sections.catalogue, 'star'],
  ['menu', T.tablet.sections.menu, 'chat'],
  ['reports', T.tablet.sections.reports, 'book'],
  ['projects', T.tablet.sections.projects, 'heart'],
  ['settings', T.tablet.sections.settings, 'gear'],
];

/** Nombre de choses à faire (pastille d'Accueil). */
function todoCount(model: InterfaceModel): number {
  const answers = model.proposals.filter((p) => p.from !== model.local).length;
  const order = model.orders !== null && !model.orders.sent ? 1 : 0;
  return answers + order;
}

export function tabletLayer(ctx: UiContext, start: TabletSection = 'home'): LayerSpec {
  let section: TabletSection = start;
  let family: string | null = null;
  let style: string | null = null;
  let confirm: CatalogueItemView | null = null;

  const announce = (): void => {
    ctx.send({
      type: 'ui-place',
      place: `Sur la tablette : ${sectionLabel(section).toLowerCase()}`,
    });
  };

  const spec: LayerSpec = {
    id: 'tablette',
    closeKey: 'Tab',
    render(root, layer) {
      const model = ctx.model();
      const house = model.house;
      const clock = model.clock;
      const head = h('header', { class: 'dt-panel-head' });
      head.append(
        h(
          'h2',
          { style: 'font-size: 1.15em; display: flex; gap: 0.4em; align-items: center' },
          icon('tablet'),
          house === null ? 'Tablette de la maison' : `${house.name} · ${house.place}`,
        ),
      );
      if (clock !== null)
        head.append(
          h(
            'span',
            null,
            `${capital(WEEKDAYS[clock.weekday] ?? '')} ${String(clock.day)} · printemps · ${heure(clock.minutes)}`,
          ),
        );
      if (house !== null) {
        head.append(
          h('strong', null, fill(T.tablet.cash, { amount: euros(house.cashCents, true) })),
        );
        if (house.reservedCents > 0)
          head.append(
            h(
              'span',
              null,
              `· ${fill(T.tablet.reserved, { amount: euros(house.reservedCents, true) })}`,
            ),
          );
      }
      root.append(head);

      const nav = h('nav', { role: 'tablist', 'aria-orientation': 'vertical' });
      const count = todoCount(model);
      for (const [id, label, ic] of SECTIONS) {
        const tab = h(
          'button',
          {
            type: 'button',
            class: 'dt-tab',
            role: 'tab',
            'aria-selected': id === section ? 'true' : 'false',
            'data-key': `tab-${id}`,
          },
          icon(ic),
          label,
          id === 'home' && count > 0
            ? h(
                'span',
                { class: 'dt-count', 'aria-label': `${String(count)} à faire` },
                String(count),
              )
            : null,
        );
        tab.addEventListener('click', () => {
          section = id;
          announce();
          layer.refresh();
        });
        nav.append(tab);
      }
      const body = h('section', { role: 'tabpanel', 'data-scroll': `tablette-${section}` });
      const sectionBuilders: Record<TabletSection, () => void> = {
        home: () => {
          homeSection(body, ctx, model, (s) => {
            section = s;
            announce();
            layer.refresh();
          });
        },
        orders: () => {
          ordersSection(body, ctx, model);
        },
        catalogue: () => {
          catalogueSection(
            body,
            ctx,
            model,
            { family, style },
            (f, s) => {
              family = f;
              style = s;
              layer.refresh();
            },
            (item) => {
              confirm = item;
              layer.refresh();
            },
          );
        },
        menu: () => {
          menuSection(body, ctx, model);
        },
        reports: () => {
          reportsSection(body, ctx, model);
        },
        projects: () => {
          projectsSection(body, ctx, model);
        },
        settings: () => {
          settingsSection(body, ctx, model, () => {
            layer.refresh();
          });
        },
      };
      sectionBuilders[section]();
      root.append(h('div', { class: 'dt-tablet' }, nav, body));
      root.append(
        footer(
          [
            [['A', 'E'], T.keys.sections],
            [['flèches', 'ou', 'Z', 'Q', 'S', 'D'], T.keys.choose],
            [['Entrée'], T.keys.validate],
            [['Tab', 'ou', 'Retour arrière'], T.keys.close],
          ],
          T.tablet.footer,
        ),
      );
      if (confirm !== null)
        root.append(
          confirmWindow(ctx, model, confirm, () => {
            confirm = null;
            layer.refresh();
          }),
        );
    },
    back() {
      if (confirm !== null) {
        confirm = null;
        ctx.layers.refresh('tablette');
        return true;
      }
      return false;
    },
    section(delta) {
      if (confirm !== null) return;
      const i = SECTIONS.findIndex(([id]) => id === section);
      const next = SECTIONS[(i + delta + SECTIONS.length) % SECTIONS.length];
      if (next === undefined) return;
      section = next[0];
      announce();
      ctx.layers.refresh('tablette');
      document
        .querySelector<HTMLElement>(`[data-layer="tablette"] [data-key="tab-${section}"]`)
        ?.focus();
    },
    defaultFocus(root) {
      return (
        root.querySelector<HTMLElement>('[data-default]') ??
        root.querySelector<HTMLElement>('section button:not([disabled])') ??
        root.querySelector<HTMLElement>('[aria-selected="true"]')
      );
    },
    onClose() {
      ctx.send({ type: 'ui-place', place: null });
    },
  };
  announce();
  return spec;
}

function sectionLabel(section: TabletSection): string {
  return SECTIONS.find(([id]) => id === section)?.[1] ?? '';
}

function homeSection(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  go: (s: TabletSection) => void,
): void {
  const partner = ctx.partner.name;
  body.append(h('h3', null, T.tablet.home.title));
  const grid = h('div', { class: 'dt-grid' });
  const todo = h('div', { class: 'dt-tile' }, h('h3', null, icon('alert'), T.tablet.home.todo));
  let any = false;
  for (const p of model.proposals.filter((x) => x.from !== model.local)) {
    any = true;
    const what =
      p.kind === 'open'
        ? T.proposal.openTitle
        : p.kind === 'close-early'
          ? T.proposal.closeTitle
          : fill(T.tablet.home.proposes, {
              partner,
              item: (p.item ?? '').toLowerCase(),
              amount: euros(p.amountCents ?? 0, true),
            });
    todo.append(h('div', null, what));
    const b = button(
      T.tablet.home.answer,
      () => {
        ctx.openProposal(p.id);
      },
      { primary: true },
    );
    if (todo.querySelector('[data-default]') === null) b.dataset.default = '';
    todo.append(b);
  }
  if (model.orders !== null && !model.orders.sent) {
    any = true;
    todo.append(h('div', null, T.tablet.home.orderPending));
    todo.append(
      button(T.tablet.home.prepareOrder, () => {
        go('orders');
      }),
    );
  }
  if (!any) todo.append(h('div', { class: 'dt-second' }, T.tablet.home.nothing));
  grid.append(todo);

  const clock = model.clock;
  if (clock !== null) {
    const service = h(
      'div',
      { class: 'dt-tile' },
      h('h3', null, icon('clock'), T.tablet.home.service),
    );
    if (clock.phase === 'service' || clock.phase === 'soft-closing')
      service.append(
        h('div', null, fill(T.tablet.home.closingAt, { time: heure(clock.closingMinutes) })),
      );
    else service.append(h('div', { class: 'dt-second' }, T.tablet.home.notOpenYet));
    grid.append(service);
    grid.append(
      h(
        'div',
        { class: 'dt-tile' },
        h(
          'h3',
          null,
          icon(
            clock.weather.kind === 'sun'
              ? 'sun'
              : clock.weather.kind === 'clouds'
                ? 'clouds'
                : 'rain',
          ),
          clock.weather.label,
        ),
      ),
    );
  }
  if (model.house !== null) {
    const half = model.house.halfCups;
    grid.append(
      h(
        'div',
        { class: 'dt-tile' },
        h('h3', null, icon('cup'), fill(T.tablet.home.reputation, { cups: cupsText(half) })),
        cupsRow(half),
      ),
    );
  }
  const pinned = model.projects?.current.find((p) => p.pinned) ?? null;
  if (pinned !== null) {
    grid.append(
      h(
        'div',
        { class: 'dt-tile' },
        h('h3', null, icon('heart'), T.tablet.home.pinned),
        h(
          'div',
          null,
          fill(T.tablet.projects.progress, {
            title: pinned.title,
            done: pinned.done,
            total: pinned.total,
          }),
        ),
        pinned.missing === null
          ? null
          : h(
              'div',
              { class: 'dt-second' },
              fill(T.tablet.projects.missing, { missing: pinned.missing }),
            ),
        button(T.tablet.home.seeProjects, () => {
          go('projects');
        }),
      ),
    );
  }
  body.append(grid);
}

/** « 2,5 » tasses depuis des demi-tasses. */
export function cupsText(halfCups: number): string {
  return halfCups % 2 === 0 ? String(halfCups / 2) : `${String(Math.floor(halfCups / 2))},5`;
}

export function cupsRow(halfCups: number): HTMLElement {
  const row = h('span', { class: 'dt-cups', 'aria-hidden': 'true' });
  for (let i = 0; i < 5; i++) {
    const full = halfCups >= (i + 1) * 2;
    const half = !full && halfCups === i * 2 + 1;
    const ic = icon('cup', undefined, full);
    if (half) ic.style.opacity = '0.75';
    row.append(ic);
  }
  return row;
}

/** « mardi, jeudi et samedi ». */
function daysText(days: readonly number[]): string {
  const names = days.map((d) => WEEKDAYS[d] ?? '');
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1] ?? ''}`;
}

function ordersSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const orders = model.orders;
  const weekday = orders === null ? '' : (WEEKDAYS[orders.deliveryWeekday] ?? '');
  body.append(
    h('h3', null, fill(T.tablet.orders.title, { weekday })),
    h('p', { class: 'dt-second' }, T.tablet.orders.intro),
  );
  if (orders === null) {
    body.append(h('p', null, T.tablet.orders.empty));
    return;
  }
  if (orders.overMonday)
    body.append(h('p', { class: 'dt-alert' }, icon('info'), T.tablet.orders.monday));
  if (orders.sent)
    body.append(
      h('div', { class: 'dt-banner' }, icon('check'), fill(T.tablet.orders.sent, { weekday })),
    );
  body.append(
    button(T.tablet.orders.usual, () => {
      ctx.send({ type: 'order-usual' });
    }),
  );
  for (const supplier of orders.suppliers) {
    body.append(
      h(
        'h4',
        null,
        fill(T.tablet.orders.supplier, { name: supplier.name, days: daysText(supplier.days) }),
      ),
    );
    if (!supplier.passes)
      body.append(
        h(
          'p',
          { class: 'dt-second' },
          fill(T.tablet.orders.notTomorrow, {
            weekday,
            next: supplier.next === null ? '' : (WEEKDAYS[supplier.next] ?? ''),
          }),
        ),
      );
    else if (supplier.hasFranco)
      body.append(
        h(
          'p',
          { class: 'dt-second' },
          supplier.toFrancoCents > 0
            ? fill(T.tablet.orders.franco, {
                shipping: euros(supplier.shippingCents),
                amount: euros(supplier.toFrancoCents),
              })
            : T.tablet.orders.francoOk,
        ),
      );
    const table = h('table', { class: 'dt-table' });
    const head = h('tr');
    T.tablet.orders.cols.forEach((c, i) => {
      head.append(h('th', { class: i > 0 ? 'dt-num' : null }, c));
    });
    table.append(h('thead', null, head));
    const tbody = h('tbody');
    for (const p of supplier.products) {
      const locked = p.lockedBy !== null && p.lockedBy !== model.local;
      const readOnly = !supplier.passes;
      const qty = h('span', { class: 'dt-stepper' });
      const set = (q: number): void => {
        ctx.send({
          type: 'order-quantity',
          supplier: supplier.id,
          product: p.id,
          quantity: Math.max(0, q),
        });
      };
      qty.append(
        button(
          '',
          () => {
            set(p.quantity - 1);
          },
          {
            name: fill(T.tablet.orders.less, { item: p.name.toLowerCase() }),
            disabled: readOnly || locked || p.quantity <= 0,
          },
        ),
        h('span', { class: 'dt-num', style: 'min-width: 1.6em' }, String(p.quantity)),
        button(
          '',
          () => {
            set(p.quantity + 1);
          },
          {
            name: fill(T.tablet.orders.more, { item: p.name.toLowerCase() }),
            disabled: readOnly || locked,
          },
        ),
      );
      const btns = qty.querySelectorAll('button');
      btns[0]?.append(icon('minus'));
      btns[1]?.append(icon('plus'));
      tbody.append(
        h(
          'tr',
          null,
          h(
            'td',
            null,
            p.name,
            h('div', { class: 'dt-second', style: 'font-size: 0.85em' }, p.pack),
            locked
              ? h(
                  'div',
                  { class: 'dt-lock' },
                  fill(T.tablet.orders.lockedBy, { partner: ctx.partner.name }),
                )
              : null,
          ),
          h('td', { class: 'dt-num' }, p.stock),
          h('td', { class: 'dt-num' }, readOnly ? '' : String(p.usual)),
          h('td', { class: 'dt-num' }, readOnly ? '' : qty),
          h('td', { class: 'dt-num' }, readOnly ? '' : euros(p.quantity * p.unitCents)),
        ),
      );
    }
    table.append(tbody);
    body.append(table);
  }
  inventory(body, orders);
  if (orders.emergencyOpen) body.append(h('p', { class: 'dt-second' }, T.tablet.orders.emergency));
  const send = button(
    orders.sent ? T.tablet.orders.edit : fill(T.tablet.orders.send, { weekday }),
    () => {
      ctx.send({ type: 'order-send' });
    },
    { primary: !orders.sent },
  );
  send.dataset.default = '';
  body.append(
    h(
      'div',
      {
        class: 'dt-row',
        style:
          'position: sticky; bottom: 0; background: var(--dt-expresso); padding: 0.6em 0; justify-content: flex-end; flex-wrap: wrap',
      },
      h(
        'span',
        { style: 'display: flex; flex-direction: column; align-items: flex-end' },
        h('strong', null, fill(T.tablet.orders.total, { amount: euros(orders.totalCents) })),
        h(
          'span',
          { class: 'dt-second', style: 'font-size: 0.875em' },
          fill(T.tablet.orders.reserved, { amount: euros(orders.totalCents) }),
        ),
      ),
      send,
    ),
  );
}

/** « bon jusqu'à jeudi 4 », ou « se garde longtemps » au-delà de deux semaines. */
function goodUntilText(day: number, today: number): string {
  if (day - today > 13) return T.tablet.orders.stockLong;
  return fill(T.tablet.orders.stockDate, {
    weekday: `${WEEKDAYS[(((day - 1) % 7) + 7) % 7] ?? ''} ${String(day)}`,
  });
}

/** « La réserve ce soir » (P0-3): quantité et date du lot le plus proche, rien à compter. */
function inventory(body: HTMLElement, orders: NonNullable<InterfaceModel['orders']>): void {
  const rows = orders.suppliers.flatMap((s) => s.products).filter((p) => p.goodUntil !== null);
  body.append(h('h4', null, T.tablet.orders.inventory));
  if (rows.length === 0) {
    body.append(h('p', { class: 'dt-second' }, T.tablet.orders.inventoryEmpty));
    return;
  }
  const table = h('table', { class: 'dt-table' });
  const head = h('tr');
  T.tablet.orders.inventoryCols.forEach((c, i) => {
    head.append(h('th', { class: i > 0 ? 'dt-num' : null }, c));
  });
  table.append(h('thead', null, head));
  const tbody = h('tbody');
  for (const p of rows)
    tbody.append(
      h(
        'tr',
        null,
        h('td', null, p.name),
        h('td', { class: 'dt-num' }, p.stock),
        h(
          'td',
          { class: 'dt-num' },
          p.useFirst
            ? h('strong', { style: 'color: var(--dt-or)' }, T.tablet.orders.useFirst)
            : goodUntilText(p.goodUntil ?? 0, orders.today),
        ),
      ),
    );
  table.append(tbody);
  body.append(table);
}

function catalogueSection(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  filters: { family: string | null; style: string | null },
  setFilters: (family: string | null, style: string | null) => void,
  askConfirm: (item: CatalogueItemView) => void,
): void {
  const cat = model.catalogue;
  const partner = ctx.partner.name;
  body.append(h('h3', null, T.tablet.catalogue.title));
  if (cat === null) {
    body.append(h('p', null, T.tablet.catalogue.empty));
    return;
  }
  body.append(
    h(
      'p',
      { class: 'dt-second' },
      fill(T.tablet.catalogue.rule, { amount: euros(cat.thresholdCents, true), partner }),
    ),
  );
  if (cat.banner !== null) body.append(h('div', { class: 'dt-banner' }, icon('info'), cat.banner));
  const famRow = h(
    'div',
    { class: 'dt-row', role: 'group', 'aria-label': T.tablet.catalogue.families },
    h('span', { class: 'dt-second' }, `${T.tablet.catalogue.families} :`),
  );
  for (const f of [null, ...cat.families]) {
    const b = button(f ?? T.tablet.catalogue.all, () => {
      setFilters(f, filters.style);
    });
    b.setAttribute('aria-pressed', String(filters.family === f));
    famRow.append(b);
  }
  const styleRow = h(
    'div',
    {
      class: 'dt-row',
      role: 'group',
      'aria-label': T.tablet.catalogue.styles,
      style: 'margin: 0.5em 0 0.8em',
    },
    h('span', { class: 'dt-second' }, `${T.tablet.catalogue.styles} :`),
  );
  for (const s of [null, ...cat.styles]) {
    const b = button(s ?? T.tablet.catalogue.allStyles, () => {
      setFilters(filters.family, s);
    });
    b.setAttribute('aria-pressed', String(filters.style === s));
    styleRow.append(b);
  }
  body.append(famRow, styleRow);
  const grid = h('div', { class: 'dt-grid' });
  const items = cat.items.filter(
    (i) =>
      (filters.family === null || i.family === filters.family) &&
      (filters.style === null || i.style === filters.style),
  );
  let defaulted = false;
  for (const item of items) {
    const tile = h(
      'div',
      { class: 'dt-tile' },
      h('h3', null, item.name),
      h('div', { class: 'dt-second' }, `${item.family} · ${item.style}`),
      h('div', null, item.brings),
      item.needs === null
        ? null
        : h('div', { class: 'dt-second' }, fill(T.tablet.catalogue.needs, { needs: item.needs })),
      h(
        'div',
        { class: 'dt-row' },
        h('strong', null, euros(item.priceCents, true)),
        item.deal === null ? null : h('span', { class: 'dt-chip' }, item.deal),
      ),
    );
    const st = item.state;
    let action: HTMLElement;
    switch (st.kind) {
      case 'buy':
        action = button(
          T.tablet.catalogue.buy,
          () => {
            ctx.send({ type: 'buy', item: item.id });
          },
          { primary: true },
        );
        break;
      case 'propose':
        action = button(fill(T.tablet.catalogue.propose, { partner }), () => {
          askConfirm(item);
        });
        break;
      case 'missing':
        action = button(
          fill(T.tablet.catalogue.missing, { amount: euros(st.missingCents, true) }),
          () => undefined,
          { disabled: true },
        );
        break;
      case 'locked':
        action = button(st.reason, () => undefined, { disabled: true });
        break;
      case 'pending-mine':
        tile.append(
          h('div', { class: 'dt-chip dashed' }, fill(T.tablet.catalogue.pendingMine, { partner })),
        );
        action = button(T.tablet.catalogue.withdraw, () => {
          const mine = model.proposals.find((p) => p.from === model.local);
          if (mine !== undefined) ctx.send({ type: 'proposal-withdraw', id: mine.id });
        });
        break;
      case 'pending-theirs':
        tile.append(
          h(
            'div',
            { class: 'dt-chip' },
            fill(T.tablet.catalogue.pendingTheirs, {
              partner,
              amount: euros(item.priceCents, true),
            }),
          ),
        );
        action = button(
          fill(T.tablet.catalogue.answer, { partner }),
          () => {
            ctx.openProposal(st.proposal);
          },
          { primary: true },
        );
        break;
      case 'bought':
        action = h('div', { class: 'dt-ok' }, icon('check'), T.tablet.catalogue.bought);
        break;
    }
    if (!defaulted && action instanceof HTMLButtonElement && !action.disabled) {
      action.dataset.default = '';
      defaulted = true;
    }
    tile.append(action);
    grid.append(tile);
  }
  body.append(grid);
}

function confirmWindow(
  ctx: UiContext,
  model: InterfaceModel,
  item: CatalogueItemView,
  done: () => void,
): HTMLElement {
  const partner = ctx.partner.name;
  const remaining =
    (model.house?.cashCents ?? 0) - (model.house?.reservedCents ?? 0) - item.priceCents;
  const send = button(
    fill(T.tablet.catalogue.propose, { partner }),
    () => {
      ctx.send({ type: 'propose-buy', item: item.id });
      done();
    },
    { primary: true },
  );
  send.dataset.default = '';
  const box = h(
    'div',
    {
      class: 'dt-card',
      role: 'alertdialog',
      style:
        'position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(28em, 90%); padding: 1em 1.2em; border: 2px solid var(--dt-creme-2); z-index: 2',
    },
    h('h3', null, fill(T.tablet.catalogue.confirmTitle, { partner })),
    h('p', null, `${item.name} · ${euros(item.priceCents, true)}`),
    h(
      'p',
      { class: 'dt-second' },
      fill(T.tablet.catalogue.confirmText, { partner, remaining: euros(remaining, true) }),
    ),
    h('div', { class: 'dt-row' }, send, button(T.tablet.catalogue.cancel, done)),
  );
  queueMicrotask(() => {
    send.focus();
  });
  return box;
}

function menuSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const slate = model.slate;
  body.append(
    h('h3', null, T.tablet.menu.title),
    h('p', { class: 'dt-second' }, T.tablet.menu.intro),
    h('p', { class: 'dt-second' }, T.tablet.menu.help),
  );
  const edit = button(
    T.tablet.menu.edit,
    () => {
      ctx.openSlate();
    },
    { primary: true },
  );
  edit.dataset.default = '';
  if (slate === null || slate.lines.length === 0) {
    body.append(h('p', null, T.tablet.menu.empty), edit);
    return;
  }
  body.append(
    h('h4', null, fill(T.tablet.menu.count, { n: slate.lines.length, max: slate.maxLines })),
  );
  const table = h('table', { class: 'dt-table' });
  const head = h('tr');
  T.tablet.menu.cols.forEach((c, i) => {
    head.append(h('th', { class: i > 0 ? 'dt-num' : null }, c));
  });
  table.append(h('thead', null, head));
  const tbody = h('tbody');
  for (const line of slate.lines) {
    const recipe = slate.recipes.find((r) => r.id === line.recipe);
    tbody.append(
      h(
        'tr',
        null,
        h('td', null, recipe?.name ?? line.recipe),
        h('td', { class: 'dt-num' }, euros(line.priceCents)),
        h('td', { class: 'dt-num' }, euros(line.costCents)),
        h(
          'td',
          { class: 'dt-num' },
          fill(T.tablet.menu.margin, {
            amount: euros(line.priceCents - line.costCents),
            pct:
              line.priceCents > 0
                ? Math.round((100 * (line.priceCents - line.costCents)) / line.priceCents)
                : 0,
          }),
        ),
        h('td', { class: 'dt-num' }, line.star ? icon('star', T.tablet.menu.star, true) : ''),
      ),
    );
  }
  table.append(tbody);
  body.append(table, h('div', { style: 'margin-top: 0.8em' }, edit));
}

function reportsSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  body.append(h('h3', null, T.tablet.reports.title));
  if (model.evening === null) {
    body.append(h('p', null, T.tablet.reports.empty));
    return;
  }
  const again = button(
    T.tablet.reports.open,
    () => {
      ctx.layers.close('tablette');
      ctx.openEvening();
    },
    { primary: true },
  );
  again.dataset.default = '';
  body.append(
    h(
      'div',
      { class: 'dt-row' },
      again,
      button(T.tablet.reports.goodNight, () => {
        ctx.send({ type: 'evening-choice', goodNight: true });
      }),
    ),
  );
}

function projectsSection(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  body.append(
    h('h3', null, T.tablet.projects.title),
    h('p', { class: 'dt-second' }, T.tablet.projects.intro),
  );
  const projects = model.projects;
  const list = (items: readonly ProjectView[], pinnable: boolean): HTMLElement => {
    const grid = h('div', { class: 'dt-grid' });
    for (const p of items) {
      const tile = h(
        'div',
        { class: 'dt-tile' },
        h('h3', null, icon('heart'), p.title),
        h('div', null, `${String(p.done)} sur ${String(p.total)}`),
        p.missing === null
          ? null
          : h(
              'div',
              { class: 'dt-second' },
              fill(T.tablet.projects.missing, { missing: p.missing }),
            ),
      );
      if (pinnable) {
        const b = button(p.pinned ? T.tablet.projects.pinned : T.tablet.projects.pin, () => {
          ctx.send({ type: 'project-pin', project: p.id, pinned: !p.pinned });
        });
        b.setAttribute('aria-pressed', String(p.pinned));
        b.prepend(icon('pin'));
        tile.append(b);
      }
      grid.append(tile);
    }
    return grid;
  };
  if (projects === null) {
    body.append(h('p', null, T.tablet.projects.none));
    return;
  }
  body.append(list(projects.current, true));
  if (projects.later.length > 0)
    body.append(h('h4', null, T.tablet.projects.later), list(projects.later, true));
  body.append(h('h4', null, T.tablet.projects.achieved));
  if (projects.achieved.length === 0)
    body.append(h('p', { class: 'dt-second' }, T.tablet.projects.none));
  else body.append(list(projects.achieved, false));
}

type Choice<K extends SettingKey> = readonly (readonly [PlayerSettings[K], string])[];

function segmented<K extends SettingKey>(
  ctx: UiContext,
  key: K,
  options: Choice<K>,
  refresh: () => void,
): HTMLElement {
  const current = ctx.settings.get()[key];
  const group = h('div', { class: 'dt-seg', role: 'radiogroup' });
  for (const [value, label] of options) {
    const b = button(label, () => {
      ctx.settings.set(key, value);
      refresh();
    });
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(current === value));
    group.append(b);
  }
  return group;
}

type BoolKey = { [K in SettingKey]: PlayerSettings[K] extends boolean ? K : never }[SettingKey];

function toggle(ctx: UiContext, key: BoolKey, refresh: () => void): HTMLElement {
  const on = ctx.settings.get()[key];
  const b = button(
    on ? T.settings.on : T.settings.off,
    () => {
      ctx.settings.set(key, !on);
      refresh();
    },
    { className: 'dt-switch' },
  );
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  return b;
}

function setting(label: string, control: HTMLElement, help?: string): HTMLElement {
  const id = `dt-set-${label.replace(/\W+/g, '-')}`;
  const name = h('span', { id }, label);
  control.setAttribute('aria-labelledby', id);
  return h(
    'div',
    { class: 'dt-setting' },
    name,
    control,
    help === undefined ? null : h('div', { class: 'dt-second' }, help),
  );
}

function range(
  ctx: UiContext,
  key: 'fovDeg' | 'sensitivity' | 'ambience',
  min: number,
  max: number,
  step: number,
  show: (value: number) => string,
  refresh: () => void,
): HTMLElement {
  const value = ctx.settings.get()[key];
  const input = h('input', { type: 'range', min, max, step, value, class: 'dt-range' });
  const out = h(
    'output',
    { style: 'min-width: 3.2em; text-align: right; font-weight: 700' },
    show(value),
  );
  input.addEventListener('input', () => {
    const next = Number(input.value);
    ctx.settings.set(key, next);
    out.textContent = show(next);
  });
  input.addEventListener('change', refresh);
  const wrap = h('span', { class: 'dt-row' }, input, out);
  return wrap;
}

function settingsSection(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  refresh: () => void,
): void {
  const partner = ctx.partner.name;
  const S = T.settings;
  body.append(h('h3', null, S.mine), h('p', { class: 'dt-second' }, fill(S.mineHelp, { partner })));
  body.append(h('h4', null, S.view));
  body.append(
    setting(
      S.fov,
      range(ctx, 'fovDeg', 50, 75, 5, (v) => `${String(horizontalFov(v, ctx.aspect()))}°`, refresh),
      S.fovHelp,
    ),
    setting(
      S.headBob,
      segmented(
        ctx,
        'headBob',
        [
          ['off', S.headBobOptions[0]],
          ['light', S.headBobOptions[1]],
        ],
        refresh,
      ),
    ),
    setting(
      S.crosshair,
      segmented(
        ctx,
        'crosshair',
        [
          ['small', S.crosshairOptions[0]],
          ['medium', S.crosshairOptions[1]],
          ['large', S.crosshairOptions[2]],
        ],
        refresh,
      ),
    ),
    setting(
      S.aim,
      segmented(
        ctx,
        'aimAssist',
        [
          ['none', S.aimOptions[0]],
          ['light', S.aimOptions[1]],
          ['strong', S.aimOptions[2]],
        ],
        refresh,
      ),
      S.aimHelp,
    ),
  );
  body.append(h('h4', null, S.mouse));
  body.append(
    setting(
      S.sensitivity,
      range(ctx, 'sensitivity', 0.2, 3, 0.1, (v) => v.toFixed(1).replace('.', ','), refresh),
    ),
    setting(
      S.invert,
      segmented(
        ctx,
        'invertY',
        [
          [false, S.invertOptions[0]],
          [true, S.invertOptions[1]],
        ],
        refresh,
      ),
    ),
  );
  body.append(h('h4', null, S.gestures));
  body.append(
    setting(
      S.simplified,
      toggle(ctx, 'simplifiedGestures', refresh),
      fill(S.simplifiedHelp, { partner }),
    ),
    setting(S.options, toggle(ctx, 'optionReminder', refresh), S.optionsHelp),
    setting(S.guide, toggle(ctx, 'stationGuide', refresh), S.guideHelp),
    setting(
      S.hold,
      segmented(
        ctx,
        'holdMode',
        [
          ['hold', S.holdOptions[0]],
          ['toggle', S.holdOptions[1]],
        ],
        refresh,
      ),
    ),
    setting(
      S.fast,
      segmented(
        ctx,
        'fastMode',
        [
          ['hold', S.fastOptions[0]],
          ['toggle', S.fastOptions[1]],
        ],
        refresh,
      ),
    ),
  );
  body.append(h('h4', null, S.sound));
  body.append(
    setting(
      S.ambience,
      range(ctx, 'ambience', 0, 100, 10, (v) => `${String(v)} %`, refresh),
      S.ambienceHelp,
    ),
    setting(S.headphones, toggle(ctx, 'headphones', refresh), S.headphonesHelp),
  );
  body.append(h('h4', null, S.reading));
  body.append(
    setting(
      S.handwriting,
      segmented(
        ctx,
        'handwriting',
        [
          ['handwritten', S.handwritingOptions[0]],
          ['readable', S.handwritingOptions[1]],
        ],
        refresh,
      ),
      S.handwritingHelp,
    ),
    setting(
      S.textSize,
      segmented(
        ctx,
        'textSize',
        (['normal', 'large', 'larger'] as const).map(
          (k, i) =>
            [
              k,
              `${S.textSizeOptions[i] ?? ''} (${String(Math.round(TEXT_SCALE[k] * 100))} %)`,
            ] as const,
        ),
        refresh,
      ),
      S.textSizeHelp,
    ),
    setting(S.soundCues, toggle(ctx, 'soundCues', refresh), fill(S.soundCuesHelp, { partner })),
    setting(
      S.clockShow,
      segmented(
        ctx,
        'clockDisplay',
        [
          ['always', S.clockOptions[0]],
          ['service', S.clockOptions[1]],
          ['never', S.clockOptions[2]],
        ],
        refresh,
      ),
    ),
    setting(S.tips, toggle(ctx, 'tips', refresh)),
    setting(S.fps, toggle(ctx, 'showFps', refresh), S.fpsHelp),
  );

  body.append(
    h('h3', { style: 'margin-top: 1.2em' }, S.duo),
    h('p', { class: 'dt-second' }, fill(S.duoHelp, { partner })),
  );
  const duo = model.duoSettings ?? { pace: 'normal', crowd: 'normal', radio: 'both' };
  const duoSeg = (
    key: 'pace' | 'crowd' | 'radio',
    options: readonly (readonly [string, string])[],
  ): HTMLElement => {
    const group = h('div', { class: 'dt-seg', role: 'radiogroup' });
    for (const [value, label] of options) {
      const b = button(label, () => {
        ctx.send({ type: 'duo-setting', key, value });
      });
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(duo[key] === value));
      group.append(b);
    }
    return group;
  };
  body.append(
    setting(
      S.pace,
      duoSeg('pace', [
        ['normal', S.paceOptions[0]],
        ['calm', S.paceOptions[1]],
      ]),
      S.paceHelp,
    ),
    setting(
      S.crowd,
      duoSeg('crowd', [
        ['soft', S.crowdOptions[0]],
        ['normal', S.crowdOptions[1]],
        ['lively', S.crowdOptions[2]],
      ]),
      S.crowdHelp,
    ),
    setting(
      S.radio,
      duoSeg('radio', [
        ['both', S.radioOptions[0]],
        ['host', fill(S.radioOptions[1], { host: ctx.hostName })],
      ]),
      S.radioHelp,
    ),
  );
  body.append(
    h(
      'p',
      { class: 'dt-second', style: 'margin-top: 1em' },
      keycap('Échap'),
      " puis Réglages de Duo : volumes, plein écran, taille de l'interface, touches.",
    ),
  );
}
