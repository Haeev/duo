/**
 * Applis du téléphone (ux-telephone 6): Commandes en cartes par fournisseur, Réserve, Catalogue,
 * Carte et prix, Bilans, Nos projets, Réglages. Une colonne, des cartes, aucun tableau. Elles
 * lisent les mêmes vues que la tablette d'avant (`modele.ts`) et envoient les mêmes actions.
 */
import type { UiContext } from './contexte';
import { button, h, icon, token } from './dom';
import type { CatalogueItemView, InterfaceModel, OrderProductView, ProjectView } from './modele';
import { horizontalFov, TEXT_SCALE, type PlayerSettings, type SettingKey } from './reglages';
import type { PhoneScreen } from './telephone-etat';
import { T, WEEKDAYS } from './textes';
import { euros, fill, heure } from './typo';

/** Ce que les applis demandent au téléphone. */
export interface PhoneNav {
  go(screen: PhoneScreen): void;
  refresh(): void;
  /** Range le téléphone. */
  close(): void;
  /** Fenêtre de confirmation dans l'écran du téléphone; `focus` la reçoit. */
  confirm(box: HTMLElement, focus: HTMLElement): void;
  closeConfirm(): void;
}

const O = T.apps.orders;
const R = T.apps.stock;
const C = T.apps.catalogue;
const MENU = T.apps.menu;

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

/** « du mardi au dimanche » (jours qui se suivent) ou « mardi, jeudi et samedi ». */
export function daysText(days: readonly number[]): string {
  const names = days.map((d) => WEEKDAYS[d] ?? '');
  const sorted = [...days].sort((a, b) => a - b);
  const consecutive = sorted.every((d, i) => i === 0 || d === (sorted[i - 1] ?? -2) + 1);
  if (names.length >= 3 && consecutive)
    return `du ${WEEKDAYS[sorted[0] ?? 0] ?? ''} au ${WEEKDAYS[sorted[sorted.length - 1] ?? 0] ?? ''}`;
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} et ${names[names.length - 1] ?? ''}`;
}

/** « Moins de croissants », pas à pas de quantité (− valeur +). */
function stepper(
  value: string,
  less: { name: string; disabled: boolean; run: () => void },
  more: { name: string; disabled: boolean; run: () => void },
): HTMLElement {
  const minus = button('', less.run, {
    name: less.name,
    disabled: less.disabled,
    className: 'dt-rond',
  });
  minus.append(icon('minus'));
  const plus = button('', more.run, {
    name: more.name,
    disabled: more.disabled,
    className: 'dt-rond',
  });
  plus.append(icon('plus'));
  return h('span', { class: 'dt-pas' }, minus, h('output', null, value), plus);
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}

export function ordersApp(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const orders = model.orders;
  const weekday = orders === null ? '' : (WEEKDAYS[orders.deliveryWeekday] ?? '');
  body.append(h('p', { class: 'dt-intro' }, O.intro));
  if (orders === null) {
    body.append(h('p', null, O.empty));
    return;
  }
  if (orders.overMonday) body.append(h('p', { class: 'dt-douce' }, icon('info'), O.monday));
  if (orders.sent)
    body.append(h('p', { class: 'dt-douce ok' }, icon('check'), fill(O.sent, { weekday })));
  const passing = orders.suppliers.filter((s) => s.passes);
  const resting = orders.suppliers.filter((s) => !s.passes);
  for (const supplier of passing) {
    const card = h(
      'article',
      { class: 'dt-carte' },
      h(
        'div',
        { class: 'dt-fournisseur' },
        h('span', { class: 'dt-portrait', 'aria-hidden': 'true' }, initial(supplier.name)),
        h(
          'div',
          null,
          h('h3', null, supplier.name),
          h(
            'p',
            { class: 'dt-second dt-petit' },
            fill(O.supplierDays, { days: daysText(supplier.days) }),
          ),
        ),
      ),
    );
    for (const p of supplier.products) card.append(orderLine(ctx, model, supplier.id, p));
    if (supplier.hasFranco)
      card.append(
        supplier.toFrancoCents > 0
          ? h(
              'p',
              { class: 'dt-port' },
              fill(O.franco, {
                shipping: euros(supplier.shippingCents),
                amount: euros(supplier.toFrancoCents),
              }),
            )
          : h('p', { class: 'dt-port ok' }, icon('check'), O.francoOk),
      );
    body.append(card);
  }
  for (const supplier of resting)
    body.append(
      h(
        'article',
        { class: 'dt-carte lue' },
        h(
          'div',
          { class: 'dt-fournisseur' },
          h('span', { class: 'dt-portrait', 'aria-hidden': 'true' }, initial(supplier.name)),
          h(
            'div',
            null,
            h('h3', null, supplier.name),
            h(
              'p',
              { class: 'dt-second dt-petit' },
              fill(O.supplierDays, { days: daysText(supplier.days) }),
            ),
          ),
        ),
        h(
          'p',
          { class: 'dt-port dt-second' },
          fill(O.notTomorrow, {
            weekday,
            next: supplier.next === null ? '' : (WEEKDAYS[supplier.next] ?? ''),
          }),
        ),
      ),
    );
  const send = button(
    orders.sent ? O.edit : fill(O.send, { weekday }),
    () => {
      ctx.send({ type: 'order-send' });
    },
    { primary: !orders.sent, className: 'dt-plein' },
  );
  send.dataset.default = '';
  body.append(
    h(
      'div',
      { class: 'dt-collant' },
      h(
        'p',
        { class: 'dt-total' },
        h('span', null, O.total),
        h('span', null, euros(orders.totalCents)),
      ),
      send,
      button(
        O.usual,
        () => {
          ctx.send({ type: 'order-usual' });
        },
        { className: 'dt-btn-lien dt-plein' },
      ),
      h(
        'p',
        { class: 'dt-second dt-petit' },
        fill(O.reserved, { amount: euros(orders.totalCents) }),
      ),
    ),
  );
  const missing = orders.totalCents - Math.max(0, orders.payableCents);
  if (missing > 0)
    body.querySelector('.dt-collant')?.before(
      h(
        'p',
        { class: 'dt-douce', role: 'status' },
        icon('info'),
        fill(O.overCash, {
          payable: euros(Math.max(0, orders.payableCents)),
          missing: euros(missing),
        }),
      ),
    );
}

function orderLine(
  ctx: UiContext,
  model: InterfaceModel,
  supplier: string,
  p: OrderProductView,
): HTMLElement {
  const locked = p.lockedBy !== null && p.lockedBy !== model.local;
  const lower = p.name.toLowerCase();
  const set = (q: number): void => {
    ctx.send({ type: 'order-quantity', supplier, product: p.id, quantity: Math.max(0, q) });
  };
  // « par 10 · en réserve : 4 · habituelle : 3 · 21,00 € »; un lot à finir passe en ambre.
  const info = h(
    'span',
    { class: 'dt-ligne-info' },
    `${p.pack} · `,
    p.useFirst
      ? h('span', { class: 'dt-ambre' }, fill(O.lineUseFirst, { stock: p.stock }))
      : fill(O.lineStock, { stock: p.stock }),
    ` · ${fill(O.lineUsual, { usual: p.usual })} · `,
    h('span', { class: 'dt-prix' }, euros(p.quantity * p.unitCents)),
  );
  const line = h(
    'div',
    { class: `dt-ligne${locked ? ' tenue' : ''}` },
    h('span', { class: 'dt-ligne-nom' }, p.name),
    stepper(
      String(p.quantity),
      {
        name: fill(O.less, { item: lower }),
        disabled: locked || p.quantity <= 0,
        run: () => {
          set(p.quantity - 1);
        },
      },
      {
        name: fill(O.more, { item: lower }),
        disabled: locked,
        run: () => {
          set(p.quantity + 1);
        },
      },
    ),
    info,
  );
  if (locked)
    line.append(
      h(
        'span',
        { class: 'dt-verrou' },
        token(ctx.partner.color),
        fill(O.lockedBy, { partner: ctx.partner.name }),
      ),
    );
  return line;
}

/** « bon jusqu'à jeudi 4 », ou « se garde longtemps » au-delà de deux semaines. */
function goodUntilText(day: number, today: number): string {
  if (day - today > 13) return O.stockLong;
  return fill(R.goodUntil, {
    weekday: `${WEEKDAYS[(((day - 1) % 7) + 7) % 7] ?? ''} ${String(day)}`,
  });
}

export function stockApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const orders = model.orders;
  const rows =
    orders?.suppliers.map((s) => ({
      supplier: s,
      products: s.products.filter((p) => p.goodUntil !== null || p.outOfStock === true),
    })) ?? [];
  if (orders === null || rows.every((r) => r.products.length === 0)) {
    body.append(h('p', null, R.empty));
    return;
  }
  if (orders.emergencyOpen) body.append(h('p', { class: 'dt-intro' }, R.emergencyHelp));
  const suggestion = model.discounts?.suggestion ?? null;
  for (const { supplier, products } of rows) {
    if (products.length === 0) continue;
    const card = h('article', { class: 'dt-carte' }, h('h3', null, supplier.name));
    for (const p of products) {
      const line = h(
        'div',
        { class: 'dt-ligne' },
        h('span', { class: 'dt-ligne-nom' }, p.name),
        h('span', { class: 'dt-prix' }, p.outOfStock === true ? R.outOfStock : p.stock),
        h(
          'span',
          { class: 'dt-ligne-info' },
          p.pack,
          ' · ',
          p.useFirst
            ? h('span', { class: 'dt-ambre' }, R.useFirst)
            : p.goodUntil === null
              ? ''
              : goodUntilText(p.goodUntil, orders.today),
        ),
      );
      if (p.outOfStock === true && p.emergencyOnTheWay === true)
        line.append(h('span', { class: 'dt-ligne-info' }, R.onTheWay));
      else if (p.outOfStock === true && orders.emergencyOpen) {
        const b = button(
          R.emergency,
          () => {
            emergencyConfirm(ctx, model, p, nav);
          },
          { name: fill(R.emergencyName, { item: p.name.toLowerCase() }) },
        );
        if (body.querySelector('[data-default]') === null) b.dataset.default = '';
        line.append(h('span', { class: 'dt-ligne-action' }, b));
      }
      if (
        p.useFirst &&
        suggestion !== null &&
        (model.discounts?.settings.dailyOffer ?? null) === null
      )
        line.append(
          h(
            'span',
            { class: 'dt-ligne-action' },
            button(R.toOffer, () => {
              const d = model.discounts;
              if (d !== undefined && d !== null)
                ctx.send({
                  type: 'discounts-set',
                  settings: {
                    ...d.settings,
                    dailyOffer: [suggestion.recipe, d.dailyOffer.defaultRate],
                  },
                });
              nav.go({ app: 'discounts' });
            }),
          ),
        );
      card.append(line);
    }
    body.append(card);
  }
}

function emergencyConfirm(
  ctx: UiContext,
  model: InterfaceModel,
  p: OrderProductView,
  nav: PhoneNav,
): void {
  const at = (model.clock?.minutes ?? 0) + 60;
  const yes = button(
    R.emergency,
    () => {
      ctx.send({ type: 'emergency', product: p.id });
      nav.closeConfirm();
    },
    { primary: true },
  );
  const box = h(
    'div',
    { class: 'dt-confirmer', role: 'alertdialog', 'aria-label': R.emergency },
    h(
      'div',
      { class: 'dt-carte' },
      h(
        'p',
        null,
        fill(R.emergencyConfirm, {
          item: p.name.toLowerCase(),
          pack: p.pack,
          amount: euros(p.emergencyCents ?? 0),
          time: heure(Math.round(at / 5) * 5),
        }),
      ),
      h(
        'div',
        { class: 'dt-actions' },
        yes,
        button(R.cancel, () => {
          nav.closeConfirm();
        }),
      ),
    ),
  );
  nav.confirm(box, yes);
}

export function catalogueApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const cat = model.catalogue;
  const partner = ctx.partner.name;
  if (cat === null) {
    body.append(h('p', null, C.empty));
    return;
  }
  const filters = ctx.phone.catalogue;
  body.append(
    h(
      'p',
      { class: 'dt-intro' },
      fill(C.rule, { amount: euros(cat.thresholdCents, true), partner }),
    ),
  );
  if (cat.banner !== null) body.append(h('p', { class: 'dt-douce' }, icon('info'), cat.banner));
  const chips = (
    label: string,
    values: readonly (string | null)[],
    current: string | null,
    all: string,
    pick: (v: string | null) => void,
  ): HTMLElement => {
    const row = h('div', { class: 'dt-puces', role: 'group', 'aria-label': label });
    for (const v of values) {
      const b = h(
        'button',
        { type: 'button', class: 'dt-puce', 'aria-pressed': String(current === v) },
        v ?? all,
      );
      b.addEventListener('click', () => {
        pick(v);
        nav.refresh();
      });
      row.append(b);
    }
    return row;
  };
  body.append(
    chips(C.families, [null, ...cat.families], filters.family, C.all, (v) => {
      filters.family = v;
    }),
    chips(C.styles, [null, ...cat.styles], filters.style, C.allStyles, (v) => {
      filters.style = v;
    }),
  );
  const items = cat.items.filter(
    (i) =>
      (filters.family === null || i.family === filters.family) &&
      (filters.style === null || i.style === filters.style),
  );
  for (const item of items) body.append(catalogueCard(ctx, model, item, nav));
  const firstBuy = body.querySelector<HTMLElement>('.dt-carte .dt-btn:not([disabled])');
  if (firstBuy !== null) firstBuy.dataset.default = '';
}

function catalogueCard(
  ctx: UiContext,
  model: InterfaceModel,
  item: CatalogueItemView,
  nav: PhoneNav,
): HTMLElement {
  const partner = ctx.partner.name;
  const st = item.state;
  const card = h(
    'article',
    {
      class: `dt-carte${st.kind === 'pending-mine' || st.kind === 'pending-theirs' ? ' attente' : ''}`,
    },
    h(
      'div',
      { class: 'dt-carte-tete' },
      h('h3', null, item.name),
      h('span', { class: 'dt-prix' }, euros(item.priceCents, true)),
    ),
    h('p', { class: 'dt-second dt-petit' }, `${item.family} · ${item.style}`),
    h('p', { class: 'dt-petit' }, item.brings),
    item.needs === null
      ? null
      : h('p', { class: 'dt-second dt-petit' }, fill(C.needs, { needs: item.needs })),
    item.deal === null ? null : h('p', { class: 'dt-petit dt-ambre' }, item.deal),
  );
  let action: HTMLElement;
  switch (st.kind) {
    case 'buy':
      action = button(
        C.buy,
        () => {
          ctx.send({ type: 'buy', item: item.id });
        },
        { primary: true },
      );
      break;
    case 'propose':
      action = button(fill(C.propose, { partner }), () => {
        buyConfirm(ctx, model, item, nav);
      });
      break;
    case 'missing':
      action = button(fill(C.missing, { amount: euros(st.missingCents, true) }), () => undefined, {
        disabled: true,
      });
      break;
    case 'locked':
      action = button(st.reason, () => undefined, { disabled: true });
      break;
    case 'pending-mine':
      card.append(h('p', { class: 'dt-petit' }, fill(C.pendingMine, { partner })));
      action = button(C.withdraw, () => {
        const mine = model.proposals.find((p) => p.from === model.local);
        if (mine !== undefined) ctx.send({ type: 'proposal-withdraw', id: mine.id });
      });
      break;
    case 'pending-theirs':
      card.append(
        h(
          'p',
          { class: 'dt-petit dt-qui' },
          token(ctx.partner.color),
          fill(C.pendingTheirs, { partner, amount: euros(item.priceCents, true) }),
        ),
      );
      action = button(
        fill(C.answer, { partner }),
        () => {
          nav.go({ app: 'messages', thread: 'partner' });
        },
        { primary: true },
      );
      break;
    case 'bought':
      action = h('p', { class: 'dt-ok' }, icon('check'), C.bought);
      break;
  }
  card.append(h('div', { class: 'dt-carte-action' }, action));
  return card;
}

function buyConfirm(
  ctx: UiContext,
  model: InterfaceModel,
  item: CatalogueItemView,
  nav: PhoneNav,
): void {
  const partner = ctx.partner.name;
  const remaining =
    (model.house?.cashCents ?? 0) -
    (model.house?.reservedCents ?? 0) -
    (model.house?.dueCents ?? 0) -
    item.priceCents;
  const send = button(
    fill(C.propose, { partner }),
    () => {
      ctx.send({ type: 'propose-buy', item: item.id });
      nav.closeConfirm();
    },
    { primary: true },
  );
  const box = h(
    'div',
    { class: 'dt-confirmer', role: 'alertdialog', 'aria-label': fill(C.confirmTitle, { partner }) },
    h(
      'div',
      { class: 'dt-carte' },
      h('h3', null, fill(C.confirmTitle, { partner })),
      h('p', null, `${item.name} · ${euros(item.priceCents, true)}`),
      h(
        'p',
        { class: 'dt-second dt-petit' },
        fill(C.confirmText, { partner, remaining: euros(remaining, true) }),
      ),
      h(
        'div',
        { class: 'dt-actions' },
        send,
        button(C.cancel, () => {
          nav.closeConfirm();
        }),
      ),
    ),
  );
  nav.confirm(box, send);
}

/** Bornes de prix de l'ardoise (comme `ardoise.ts`): 70 à 150 % du prix suggéré, par 10 centimes. */
const PRICE_MIN = 0.7;
const PRICE_MAX = 1.5;
const PRICE_STEP = 10;

export function menuApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const slate = model.slate;
  body.append(h('p', { class: 'dt-intro' }, MENU.intro));
  const write = button(
    MENU.writeSlate,
    () => {
      nav.close();
      ctx.openSlate();
    },
    { className: 'dt-plein' },
  );
  if (slate === null || slate.lines.length === 0) {
    body.append(h('p', null, MENU.empty), h('div', { class: 'dt-collant' }, write));
    return;
  }
  // H1: pendant le service, un prix se prépare et s'écrit sur l'ardoise à la fermeture.
  const service = slate.readOnly;
  if (service) body.append(h('p', { class: 'dt-douce' }, icon('clock'), MENU.duringService));
  body.append(
    h(
      'h3',
      { class: 'dt-rubrique' },
      fill(MENU.count, { n: slate.lines.length, max: slate.maxLines }),
    ),
  );
  const stars = slate.lines.filter((l) => ctx.phone.pending.get(l.recipe)?.star ?? l.star).length;
  let first = true;
  for (const line of slate.lines) {
    const recipe = slate.recipes.find((r) => r.id === line.recipe);
    const name = recipe?.name ?? line.recipe;
    const lower = name.toLowerCase();
    const pending = ctx.phone.pending.get(line.recipe);
    const price = pending?.priceCents ?? line.priceCents;
    const star = pending?.star ?? line.star;
    const changed = pending?.priceCents !== undefined && pending.priceCents !== line.priceCents;
    const locked = line.lockedBy !== null && line.lockedBy !== model.local;
    const suggested = recipe?.suggestedCents ?? line.priceCents;
    const min = Math.round((suggested * PRICE_MIN) / PRICE_STEP) * PRICE_STEP;
    const max = Math.round((suggested * PRICE_MAX) / PRICE_STEP) * PRICE_STEP;
    const setPrice = (cents: number): void => {
      const bounded = Math.max(min, Math.min(max, cents));
      if (service) {
        ctx.phone.pending.set(line.recipe, { ...pending, priceCents: bounded });
        nav.refresh();
      } else ctx.send({ type: 'slate-price', recipe: line.recipe, priceCents: bounded });
    };
    const starBtn = h(
      'button',
      {
        type: 'button',
        class: 'dt-puce',
        'aria-pressed': String(star),
        'aria-label': fill(T.slate.star, { item: lower }),
        disabled: locked || (!star && stars >= slate.maxStars),
      },
      `${star ? '★' : '☆'} ${MENU.star}`,
    );
    starBtn.addEventListener('click', () => {
      if (service) {
        ctx.phone.pending.set(line.recipe, { ...pending, star: !star });
        nav.refresh();
      } else ctx.send({ type: 'slate-star', recipe: line.recipe, star: !star });
    });
    const steps = stepper(
      euros(price),
      {
        name: fill(T.slate.lower, { item: lower }),
        disabled: locked || price <= min,
        run: () => {
          setPrice(price - PRICE_STEP);
        },
      },
      {
        name: fill(T.slate.raise, { item: lower }),
        disabled: locked || price >= max,
        run: () => {
          setPrice(price + PRICE_STEP);
        },
      },
    );
    const lessBtn = steps.querySelector<HTMLElement>('button:not([disabled])');
    if (first && lessBtn !== null) {
      lessBtn.dataset.default = '';
      first = false;
    }
    const margin = price - line.costCents;
    const info = h(
      'span',
      { class: 'dt-ligne-info' },
      changed ? `${fill(MENU.today, { amount: euros(line.priceCents) })} · ` : '',
      fill(MENU.line, {
        cost: euros(line.costCents),
        amount: euros(margin),
        pct: price > 0 ? Math.round((100 * margin) / price) : 0,
      }),
      line.priceNote === ''
        ? ''
        : ` · ${line.priceNote.charAt(0).toLowerCase()}${line.priceNote.slice(1)}`,
    );
    body.append(
      h(
        'div',
        { class: `dt-ligne carte-prix${locked ? ' tenue' : ''}` },
        h('span', { class: 'dt-ligne-nom' }, name),
        starBtn,
        steps,
        h('span', { class: 'dt-second dt-petit' }, changed ? MENU.tomorrow : ''),
        info,
        locked
          ? h(
              'span',
              { class: 'dt-verrou' },
              token(ctx.partner.color),
              fill(T.slate.lock, { partner: ctx.partner.name }),
            )
          : null,
      ),
    );
  }
  body.append(h('div', { class: 'dt-collant' }, write));
}

export function reportsApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const RP = T.apps.reports;
  const clock = model.clock;
  const today = h('article', { class: 'dt-carte' }, h('h3', null, RP.today));
  if (clock !== null) {
    today.append(
      h(
        'p',
        null,
        clock.phase === 'service' || clock.phase === 'soft-closing'
          ? `${RP.service} · ${fill(RP.closingAt, { time: heure(clock.closingMinutes) })}`
          : RP.notOpenYet,
      ),
      h('p', { class: 'dt-second dt-petit' }, clock.weather.label),
    );
  }
  if (model.house !== null)
    today.append(
      h(
        'p',
        { class: 'dt-petit' },
        fill(RP.reputation, { cups: cupsText(model.house.halfCups) }),
        ' ',
        cupsRow(model.house.halfCups),
      ),
    );
  body.append(today);
  const evening = model.evening;
  if (evening === null) {
    body.append(h('p', { class: 'dt-second' }, RP.empty));
    return;
  }
  const again = button(
    RP.open,
    () => {
      nav.close();
      ctx.openEvening();
    },
    { primary: true },
  );
  again.dataset.default = '';
  body.append(
    h(
      'article',
      { class: 'dt-carte' },
      h(
        'h3',
        null,
        fill(RP.evening, {
          weekday: (WEEKDAYS[evening.weekday] ?? '').replace(/^./, (c) => c.toUpperCase()),
          day: evening.day,
          amount: `${evening.figures.resultCents >= 0 ? '+' : ''}${euros(evening.figures.resultCents)}`,
        }),
      ),
      h(
        'div',
        { class: 'dt-actions' },
        again,
        button(RP.goodNight, () => {
          ctx.send({ type: 'evening-choice', goodNight: true });
        }),
      ),
    ),
  );
}

export function projectsApp(body: HTMLElement, ctx: UiContext, model: InterfaceModel): void {
  const PR = T.apps.projects;
  body.append(h('p', { class: 'dt-intro' }, PR.intro));
  const projects = model.projects;
  if (projects === null) {
    body.append(h('p', null, PR.none));
    return;
  }
  const list = (items: readonly ProjectView[], pinnable: boolean): void => {
    for (const p of items) {
      const card = h(
        'article',
        { class: 'dt-carte' },
        h('h3', null, p.title),
        h('p', null, `${String(p.done)} sur ${String(p.total)}`),
        p.missing === null
          ? null
          : h('p', { class: 'dt-second dt-petit' }, fill(PR.missing, { missing: p.missing })),
      );
      if (pinnable) {
        const b = button(p.pinned ? PR.pinned : PR.pin, () => {
          ctx.send({ type: 'project-pin', project: p.id, pinned: !p.pinned });
        });
        b.setAttribute('aria-pressed', String(p.pinned));
        b.prepend(icon('pin'));
        card.append(h('div', { class: 'dt-carte-action' }, b));
      }
      body.append(card);
    }
  };
  list(projects.current, true);
  if (projects.later.length > 0) {
    body.append(h('h3', { class: 'dt-rubrique' }, PR.later));
    list(projects.later, true);
  }
  body.append(h('h3', { class: 'dt-rubrique' }, PR.achieved));
  if (projects.achieved.length === 0) body.append(h('p', { class: 'dt-second' }, PR.none));
  else list(projects.achieved, false);
}

type Choice<K extends SettingKey> = readonly (readonly [PlayerSettings[K], string])[];

function segmented<K extends SettingKey>(
  ctx: UiContext,
  key: K,
  options: Choice<K>,
  refresh: () => void,
): HTMLElement {
  const current = ctx.settings.get()[key];
  const group = h('div', { class: 'dt-puces', role: 'radiogroup' });
  for (const [value, label] of options) {
    const b = h(
      'button',
      {
        type: 'button',
        class: 'dt-puce',
        role: 'radio',
        'aria-checked': String(current === value),
      },
      label,
    );
    b.addEventListener('click', () => {
      ctx.settings.set(key, value);
      refresh();
    });
    group.append(b);
  }
  return group;
}

type BoolKey = { [K in SettingKey]: PlayerSettings[K] extends boolean ? K : never }[SettingKey];

/** Interrupteur (`role="switch"`), l'état est aussi écrit. */
export function switchButton(
  on: boolean,
  labels: readonly [string, string],
  flip: () => void,
  options: { disabled?: boolean; name?: string } = {},
): HTMLButtonElement {
  const b = h(
    'button',
    {
      type: 'button',
      class: 'dt-inter',
      role: 'switch',
      'aria-checked': String(on),
      'aria-label': options.name ?? null,
      disabled: options.disabled === true,
    },
    h('span', { class: 'dt-inter-piste', 'aria-hidden': 'true' }),
    on ? labels[0] : labels[1],
  );
  b.addEventListener('click', () => {
    if (!b.disabled) flip();
  });
  return b;
}

function toggle(ctx: UiContext, key: BoolKey, refresh: () => void): HTMLElement {
  const on = ctx.settings.get()[key];
  return switchButton(on, [T.settings.on, T.settings.off], () => {
    ctx.settings.set(key, !on);
    refresh();
  });
}

function setting(label: string, control: HTMLElement, help?: string): HTMLElement {
  const id = `dt-set-${label.replace(/\W+/g, '-')}`;
  control.setAttribute('aria-labelledby', id);
  return h(
    'div',
    { class: 'dt-reglage' },
    h('span', { id }, label),
    control,
    help === undefined ? null : h('p', { class: 'dt-second dt-petit' }, help),
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
  const out = h('output', null, show(value));
  input.addEventListener('input', () => {
    const next = Number(input.value);
    ctx.settings.set(key, next);
    out.textContent = show(next);
  });
  input.addEventListener('change', refresh);
  return h('span', { class: 'dt-curseur' }, input, out);
}

export function settingsApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const partner = ctx.partner.name;
  const S = T.settings;
  const refresh = (): void => {
    nav.refresh();
  };
  body.append(
    h('h3', { class: 'dt-rubrique' }, S.mine),
    h('p', { class: 'dt-intro' }, fill(S.mineHelp, { partner })),
  );
  body.append(
    setting(S.phoneKeys, toggle(ctx, 'phoneKeys', refresh)),
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
    setting(
      S.ambience,
      range(ctx, 'ambience', 0, 100, 10, (v) => `${String(v)} %`, refresh),
      S.ambienceHelp,
    ),
    setting(S.headphones, toggle(ctx, 'headphones', refresh), S.headphonesHelp),
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
    h('h3', { class: 'dt-rubrique' }, S.duo),
    h('p', { class: 'dt-intro' }, fill(S.duoHelp, { partner })),
  );
  const duo = model.duoSettings ?? { pace: 'normal', crowd: 'normal', radio: 'both' };
  const duoSeg = (
    key: 'pace' | 'crowd' | 'radio',
    options: readonly (readonly [string, string])[],
  ): HTMLElement => {
    const group = h('div', { class: 'dt-puces', role: 'radiogroup' });
    for (const [value, label] of options) {
      const b = h(
        'button',
        {
          type: 'button',
          class: 'dt-puce',
          role: 'radio',
          'aria-checked': String(duo[key] === value),
        },
        label,
      );
      b.addEventListener('click', () => {
        ctx.send({ type: 'duo-setting', key, value });
      });
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
    h('p', { class: 'dt-second dt-petit' }, S.duoLine),
  );
}
