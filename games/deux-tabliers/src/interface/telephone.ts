/**
 * Le téléphone tenu en main, en vue subjective (`docs/jeux/cosy-cafe/ux-telephone.md`): Tab le
 * sort et le range, Retour arrière revient d'un cran jusqu'à le ranger, A et E passent à l'appli
 * voisine, Origine ramène à l'accueil, un clic à côté le range; jamais Échap. Barre d'état du
 * jeu (heure, jour, caisse), accueil « À faire » et grille des dix applis, barre du bas
 * « Retour » et « Accueil », bannière des notifications, aide des touches à gauche.
 * Le contenu des applis vit dans `telephone-applis.ts`, `telephone-remises.ts` et ici
 * (Messages); la pile de navigation et les messages dans `telephone-etat.ts`.
 */
import type { LayerHandle, LayerSpec } from './calques';
import { focusElement } from './calques';
import type { PhoneApp, ThreadId, UiContext } from './contexte';
import { button, h, icon, keycap, token, type IconName } from './dom';
import type { InterfaceModel, ProposalView } from './modele';
import {
  catalogueApp,
  menuApp,
  ordersApp,
  projectsApp,
  reportsApp,
  settingsApp,
  stockApp,
  type PhoneNav,
} from './telephone-applis';
import {
  currentScreen,
  markRead,
  PHONE_APPS,
  popScreen,
  pushScreen,
  screenKey,
  switchApp,
  unread,
  type PhoneScreen,
} from './telephone-etat';
import { discountsApp, marketingApp } from './telephone-remises';
import { T, WEEKDAYS } from './textes';
import { euros, fill, heure, lowerFirst } from './typo';

export const PHONE_LAYER = 'telephone';

const P = T.phone;
const MS = T.messages;

/** Pastille de chaque appli: icône au trait et teinte d'émail (ux-telephone 3.4, H7). */
export const APP_LOOK: Readonly<Record<PhoneApp, readonly [IconName, string]>> = {
  home: ['home', 'reglages'],
  orders: ['box', 'commandes'],
  stock: ['shelf', 'reserve'],
  catalogue: ['stall', 'catalogue'],
  menu: ['menu', 'carte'],
  discounts: ['tag', 'remises'],
  marketing: ['poster', 'connaitre'],
  reports: ['book', 'bilans'],
  projects: ['heart', 'projets'],
  messages: ['chat', 'messages'],
  settings: ['gear', 'reglages'],
};

export function appLabel(app: PhoneApp): string {
  return P.apps[app];
}

export function pastille(app: PhoneApp, small = false): HTMLElement {
  const [ic, tint] = APP_LOOK[app];
  return h(
    'span',
    { class: `dt-app-dot c-${tint}${small ? ' small' : ''}`, 'aria-hidden': 'true' },
    icon(ic),
  );
}

/** Propositions de l'autre auxquelles répondre (achats, actions, « On ouvre ? »). */
export function toAnswer(model: InterfaceModel): ProposalView[] {
  return model.proposals.filter((p) => p.from !== model.local);
}

/** Nombre de choses à faire (pastille d'« À faire »): propositions à répondre et commande. */
export function todoCount(model: InterfaceModel): number {
  const order = model.orders !== null && !model.orders.sent ? 1 : 0;
  return toAnswer(model).length + order;
}

/** « de tarte aux fruits », « d'eau » (élision devant une voyelle ou un h muet). */
function ofItem(name: string): string {
  const lower = name.toLowerCase();
  return /^[aeiouyhéèêâîôû]/.test(lower) ? `d'${lower}` : `de ${lower}`;
}

/** Une proposition est-elle une action de Faire connaître (« Voir dans Faire connaître »)? */
function isCampaign(model: InterfaceModel, p: ProposalView): boolean {
  return model.marketing?.actions.some((a) => a.name === p.item) ?? false;
}

export interface PhoneLayerOptions {
  /** Bannière en cours, posée par les notifications (`null`: aucune). */
  banner(): PhoneBanner | null;
  /** Survol de la bannière: le délai s'arrête (ux-telephone 3.4). */
  holdBanner(held: boolean): void;
  /** Bannière choisie (clic ou Entrée): elle se range. */
  dismissBanner(): void;
}

export interface PhoneBanner {
  readonly title: string;
  readonly text: string;
  readonly app: PhoneApp;
  readonly thread?: ThreadId | undefined;
}

export function phoneLayer(
  ctx: UiContext,
  options: PhoneLayerOptions,
  /** Sorti par-dessus l'écran du matin ou le bilan: Retour arrière le range dès la première appli. */
  overScreen = false,
): LayerSpec & { changed(): void } {
  const phone = ctx.phone;
  let handle: LayerHandle | null = null;
  let shownKey = '';
  let confirm: HTMLElement | null = null;
  let confirmFocus: HTMLElement | null = null;

  const announce = (): void => {
    ctx.send({
      type: 'ui-place',
      place: fill(T.partner.onPhone, { app: appLabel(currentScreen(phone).app) }),
    });
  };

  const rootEl = (): HTMLElement | null =>
    document.querySelector<HTMLElement>(`.dt-tel[data-layer="${PHONE_LAYER}"]`);

  const focusDefault = (): void => {
    const root = rootEl();
    if (root === null) return;
    const target = spec.defaultFocus?.(root) ?? null;
    if (target !== null) focusElement(target);
  };

  /** Change d'écran: nouveau rendu, focus par défaut de l'écran (ux-telephone 4.3). */
  const changed = (): void => {
    confirm = null;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    announce();
    handle?.refresh();
    focusDefault();
  };

  const nav: PhoneNav = {
    go(screen: PhoneScreen) {
      pushScreen(phone, screen);
      changed();
    },
    refresh() {
      handle?.refresh();
    },
    close() {
      handle?.close();
    },
    confirm(box, focus) {
      confirm = box;
      confirmFocus = focus;
      handle?.refresh();
      confirmFocus.focus({ preventScroll: true });
    },
    closeConfirm() {
      confirm = null;
      handle?.refresh();
      focusDefault();
    },
  };

  const spec: LayerSpec = {
    id: PHONE_LAYER,
    phone: true,
    label: P.name,
    closeKey: 'Tab',
    render(root, layer) {
      handle = layer;
      const model = ctx.model();
      const screen = currentScreen(phone);
      const key = screenKey(screen);
      root.append(...hands());
      const screenEl = h('div', { class: 'dt-tel-ecran' });
      root.append(h('div', { class: 'dt-tel-coque' }, screenEl));
      screenEl.append(statusBar(model));
      const banner = options.banner();
      if (banner !== null) screenEl.append(bannerElement(banner, options, nav));
      const body = h('main', { class: 'dt-corps', 'data-scroll': `tel-${key}` });
      body.addEventListener('scroll', () => {
        phone.scroll.set(key, body.scrollTop);
      });
      screenEl.append(body);
      if (screen.app !== 'home') body.append(appHead(ctx, model, screen));
      APP_BODY[screen.app](body, ctx, model, nav, screen);
      screenEl.append(
        bottomBar(
          nav,
          () => spec.back?.() ?? false,
          () => {
            layer.close();
          },
        ),
      );
      if (confirm !== null) screenEl.append(confirm);
      if (ctx.settings.get().phoneKeys) root.append(keysHelp());
      if (shownKey !== key) {
        shownKey = key;
        const top = phone.scroll.get(key) ?? 0;
        queueMicrotask(() => {
          body.scrollTop = top;
        });
      }
    },
    back() {
      if (confirm !== null) {
        nav.closeConfirm();
        return true;
      }
      if (overScreen && phone.stack.length <= 1) return false;
      if (!popScreen(phone)) return false;
      changed();
      return true;
    },
    section(delta) {
      if (confirm !== null) return;
      switchApp(phone, delta);
      changed();
    },
    home() {
      if (currentScreen(phone).app === 'home') return;
      phone.stack = [];
      changed();
    },
    defaultFocus(root) {
      if (confirm !== null) return confirmFocus;
      const body = root.querySelector('.dt-corps');
      return (
        root.querySelector<HTMLElement>('.dt-corps [data-default]:not([disabled])') ??
        body?.querySelector<HTMLElement>('button:not([disabled]), input:not([disabled])') ??
        root.querySelector<HTMLElement>('.dt-tel-nav button')
      );
    },
    onClose() {
      ctx.send({ type: 'ui-place', place: null });
    },
  };
  announce();
  return Object.assign(spec, { changed });
}

/** Main droite provisoire: quatre bouts de doigts à gauche, le pouce à droite (ux-telephone 2.4). */
function hands(): SVGSVGElement[] {
  const NS = 'http://www.w3.org/2000/svg';
  const make = (cls: string, viewBox: string, shapes: readonly string[]): SVGSVGElement => {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', viewBox);
    svg.setAttribute('aria-hidden', 'true');
    for (const d of shapes) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', '#B98262');
      path.setAttribute('stroke', '#7A4E37');
      path.setAttribute('stroke-width', '1.5');
      svg.append(path);
    }
    return svg;
  };
  const finger = (y: number, hgt: number, x = 2): string =>
    `M${String(x + 18)} ${String(y)}h${String(20 - x)}v${String(hgt)}h-${String(20 - x)}a18 ${String(hgt / 2)} 0 0 1 0-${String(hgt)}z`;
  return [
    make('dt-tel-doigts', '0 0 40 240', [
      finger(0, 54),
      finger(62, 56, 0),
      finger(126, 52),
      finger(186, 44, 6),
    ]),
    make('dt-tel-pouce', '0 0 40 100', ['M14 4Q36 2 38 30L40 100L6 100Q0 60 4 30Q6 6 14 4z']),
  ];
}

function statusBar(model: InterfaceModel): HTMLElement {
  const clock = model.clock;
  const bar = h('div', { class: 'dt-etat', role: 'group', 'aria-label': P.status });
  if (clock !== null) {
    bar.append(
      h('span', { class: 'dt-etat-heure' }, heure(clock.minutes)),
      h(
        'span',
        { class: 'dt-second' },
        `${(WEEKDAYS[clock.weekday] ?? '').slice(0, 3)}. ${String(clock.day)}`,
      ),
    );
  }
  if (model.house !== null)
    bar.append(
      h(
        'span',
        { class: 'dt-etat-caisse' },
        icon('cash'),
        fill(P.cash, { amount: euros(model.house.cashCents, true) }),
        model.house.dueCents > 0
          ? h(
              'span',
              { class: 'dt-second' },
              `· ${fill(P.due, { amount: euros(model.house.dueCents, true) })}`,
            )
          : null,
      ),
    );
  return bar;
}

function bannerElement(b: PhoneBanner, options: PhoneLayerOptions, nav: PhoneNav): HTMLElement {
  const el = h(
    'button',
    { type: 'button', class: 'dt-banniere', 'data-key': 'banniere' },
    pastille(b.app, true),
    h('b', null, b.title),
    h('span', null, b.text),
  );
  el.addEventListener('mouseenter', () => {
    options.holdBanner(true);
  });
  el.addEventListener('mouseleave', () => {
    options.holdBanner(false);
  });
  el.addEventListener('click', () => {
    options.dismissBanner();
    nav.go({ app: b.app, thread: b.thread });
  });
  return el;
}

function appHead(ctx: UiContext, model: InterfaceModel, screen: PhoneScreen): HTMLElement {
  const title = appTitle(ctx, model, screen);
  const head = h(
    'div',
    { class: 'dt-appli-tete' },
    screen.app === 'messages' && screen.thread === 'partner'
      ? token(ctx.partner.color)
      : pastille(screen.app, true),
    h('h2', null, title),
  );
  // L'autre a la même appli ouverte: on le dit sous la tête (les verrous par ligne restent).
  const same = fill(T.partner.onPhone, { app: appLabel(screen.app) });
  if (model.partner.place === same)
    head.append(
      h(
        'p',
        { class: 'dt-second dt-meme' },
        token(ctx.partner.color),
        fill(P.sameApp, { player: ctx.partner.name }),
      ),
    );
  return head;
}

function appTitle(ctx: UiContext, model: InterfaceModel, screen: PhoneScreen): string {
  if (screen.app === 'orders' && model.orders !== null)
    return fill(T.apps.orders.title, { weekday: WEEKDAYS[model.orders.deliveryWeekday] ?? '' });
  if (screen.app === 'stock') {
    const phase = model.clock?.phase;
    return phase === 'closed' || phase === 'evening' ? T.apps.stock.evening : T.apps.stock.title;
  }
  if (screen.app === 'messages' && screen.thread !== undefined)
    return threadName(ctx, screen.thread);
  return appLabel(screen.app);
}

function bottomBar(nav: PhoneNav, back: () => boolean, close: () => void): HTMLElement {
  const backBtn = h('button', { type: 'button', 'data-key': 'nav-retour' }, icon('back'), P.back);
  backBtn.addEventListener('click', () => {
    if (!back()) close();
  });
  const homeBtn = h('button', { type: 'button', 'data-key': 'nav-accueil' }, icon('home'), P.home);
  homeBtn.addEventListener('click', () => {
    nav.go({ app: 'home' });
  });
  return h('nav', { class: 'dt-tel-nav', 'aria-label': P.name }, backBtn, homeBtn);
}

function keysHelp(): HTMLElement {
  const box = h('div', { class: 'dt-card dt-tel-aide', 'aria-hidden': 'true' });
  for (const [keys, text] of P.keys) {
    const line = h('p', null);
    for (const k of keys === 'A E' ? ['A', 'E'] : [keys]) line.append(keycap(k));
    line.append(` ${text}`);
    box.append(line);
  }
  box.append(h('p', null, P.keysMove), h('p', { class: 'dt-second' }, P.keysTail));
  return box;
}

type AppBody = (
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
  screen: PhoneScreen,
) => void;

const APP_BODY: Readonly<Record<PhoneApp, AppBody>> = {
  home: homeApp,
  orders: ordersApp,
  stock: stockApp,
  catalogue: catalogueApp,
  menu: menuApp,
  discounts: discountsApp,
  marketing: marketingApp,
  reports: reportsApp,
  projects: projectsApp,
  messages: messagesApp,
  settings: settingsApp,
};

function task(
  lead: Node,
  text: string,
  action: string,
  onClick: () => void,
  key: string,
): HTMLButtonElement {
  const b = h(
    'button',
    { type: 'button', class: 'dt-tache', 'data-key': key },
    lead,
    h('span', null, text, h('b', null, action)),
    icon('chevron'),
  );
  b.addEventListener('click', onClick);
  return b;
}

function homeApp(body: HTMLElement, ctx: UiContext, model: InterfaceModel, nav: PhoneNav): void {
  const house = model.house;
  body.append(
    h(
      'div',
      { class: 'dt-accueil-tete' },
      h('span', { class: 'dt-embleme', 'aria-hidden': 'true' }, icon('cup')),
      h(
        'div',
        null,
        h('h2', null, house?.name ?? P.name),
        house === null ? null : h('p', { class: 'dt-second dt-petit' }, house.place),
      ),
    ),
  );
  const list = h('div', { class: 'dt-afaire' });
  for (const p of toAnswer(model)) {
    const text =
      p.kind === 'open'
        ? T.proposal.openTitle
        : p.kind === 'close-early'
          ? T.proposal.closeTitle
          : fill(P.todo.proposal, {
              player: ctx.partner.name,
              name: lowerFirst(p.item ?? ''),
              amount: euros(p.amountCents ?? 0, true),
            });
    list.append(
      task(
        token(ctx.partner.color),
        text,
        P.todo.answer,
        () => {
          nav.go({ app: 'messages', thread: 'partner' });
        },
        `todo-${p.id}`,
      ),
    );
  }
  const orders = model.orders;
  if (orders !== null && !orders.sent)
    list.append(
      task(
        icon('box'),
        fill(P.todo.order, { weekday: WEEKDAYS[orders.deliveryWeekday] ?? '' }),
        P.todo.prepare,
        () => {
          nav.go({ app: 'orders' });
        },
        'todo-order',
      ),
    );
  // Lot à finir demain sans offre du jour: la réserve le montre (ux-telephone 6.1).
  if (orders !== null && (model.discounts?.settings.dailyOffer ?? null) === null) {
    const first = orders.suppliers.flatMap((s) => s.products).find((p) => p.useFirst);
    if (first !== undefined)
      list.append(
        task(
          icon('shelf'),
          fill(P.todo.useFirst, { n: first.stock, item: ofItem(first.name) }),
          P.todo.seeStock,
          () => {
            nav.go({ app: 'stock' });
          },
          'todo-stock',
        ),
      );
  }
  const first = list.querySelector<HTMLElement>('button');
  if (first !== null) first.dataset.default = '';
  else list.append(h('p', { class: 'dt-second' }, P.todo.empty));
  body.append(h('section', { class: 'dt-carte' }, h('h3', null, P.todo.title), list));

  const grid = h('nav', { class: 'dt-grille', 'aria-label': P.appsLabel });
  const news =
    unread(ctx.phone) +
    toAnswer(model).filter((p) => p.kind === 'purchase' || p.kind === 'move').length;
  for (const app of PHONE_APPS) {
    const b = h(
      'button',
      { type: 'button', class: 'dt-app', 'data-key': `app-${app}` },
      app === 'messages' && news > 0
        ? h('span', { class: 'dt-badge', 'aria-hidden': 'true' }, String(news))
        : null,
      pastille(app),
      appLabel(app),
      app === 'messages' && news > 0
        ? h(
            'span',
            { class: 'dt-sr' },
            ` (${fill(news > 1 ? P.newMessages : P.newMessage, { n: news })})`,
          )
        : null,
    );
    if (first === null && ctx.phone.lastApp === app) b.dataset.default = '';
    b.addEventListener('click', () => {
      nav.go({ app });
    });
    grid.append(b);
  }
  body.append(grid);
}

export function threadName(ctx: UiContext, thread: ThreadId): string {
  return thread === 'partner' ? ctx.partner.name : MS.threads[thread];
}

/** « Aujourd'hui, 17 h 21 » ou « mardi 9, 18 h 10 ». */
function stamp(model: InterfaceModel, day: number, minutes: number): string {
  const today = model.clock?.day ?? day;
  if (day === today) return fill(MS.today, { time: heure(minutes) });
  const weekday =
    model.clock === null
      ? ''
      : (WEEKDAYS[(((model.clock.weekday - (today - day)) % 7) + 7) % 7] ?? '');
  return fill(MS.dayAt, { weekday, day, time: heure(minutes) });
}

function messagesApp(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
  screen: PhoneScreen,
): void {
  if (screen.thread === undefined) {
    messageList(body, ctx, model, nav);
    return;
  }
  const thread = screen.thread;
  markRead(ctx.phone, thread);
  const fil = h('div', { class: 'dt-fil' });
  let lastStamp = '';
  for (const m of ctx.phone.messages.filter((x) => x.thread === thread)) {
    const s = stamp(model, m.day, m.minutes);
    // Un séparateur par heure pleine, pas à chaque message.
    const hourKey = `${String(m.day)}-${String(Math.floor(m.minutes / 60))}`;
    if (hourKey !== lastStamp) {
      lastStamp = hourKey;
      fil.append(h('p', { class: 'dt-bulle nouvelle' }, s));
    }
    fil.append(
      h('p', { class: thread === 'partner' ? 'dt-bulle nouvelle' : 'dt-bulle elle' }, m.text),
    );
  }
  if (thread === 'partner') {
    for (const p of toAnswer(model)) fil.append(proposalCard(ctx, model, p, nav));
    if (toAnswer(model).length > 0)
      fil.append(h('p', { class: 'dt-second dt-petit' }, MS.proposal.later));
    for (const p of model.proposals.filter((x) => x.from === model.local)) {
      const withdraw = button(T.proposal.withdraw, () => {
        ctx.send({ type: 'proposal-withdraw', id: p.id });
      });
      fil.append(
        h(
          'div',
          { class: 'dt-carte attente' },
          h('p', { class: 'dt-qui' }, fill(MS.proposal.mine, { player: ctx.partner.name })),
          p.item === null ? null : h('h3', null, p.item),
          p.amountCents === null ? null : h('p', null, euros(p.amountCents, true)),
          withdraw,
        ),
      );
    }
  }
  if (fil.childElementCount === 0) fil.append(h('p', { class: 'dt-second' }, MS.none));
  body.append(fil);
}

function messageList(
  body: HTMLElement,
  ctx: UiContext,
  model: InterfaceModel,
  nav: PhoneNav,
): void {
  const answers = toAnswer(model);
  if (answers.length > 0) {
    body.append(h('h3', { class: 'dt-rubrique' }, MS.toAnswer));
    for (const p of answers) {
      const b = task(
        token(ctx.partner.color),
        p.kind === 'purchase' || p.kind === 'move'
          ? fill(P.todo.proposal, {
              player: ctx.partner.name,
              name: lowerFirst(p.item ?? ''),
              amount: euros(p.amountCents ?? 0, true),
            })
          : p.kind === 'open'
            ? T.proposal.openTitle
            : T.proposal.closeTitle,
        P.todo.answer,
        () => {
          nav.go({ app: 'messages', thread: 'partner' });
        },
        `answer-${p.id}`,
      );
      if (body.querySelector('[data-default]') === null) b.dataset.default = '';
      body.append(b);
    }
  }
  body.append(h('h3', { class: 'dt-rubrique' }, MS.title));
  const threads: readonly ThreadId[] = ['partner', 'simone', 'suppliers', 'regulars'];
  for (const thread of threads) {
    const all = ctx.phone.messages.filter((m) => m.thread === thread);
    const last = all[all.length - 1];
    const fresh = unread(ctx.phone, thread);
    const lead =
      thread === 'partner'
        ? token(ctx.partner.color)
        : icon(thread === 'simone' ? 'person' : thread === 'suppliers' ? 'box' : 'cup');
    const row = h(
      'button',
      { type: 'button', class: 'dt-conv', 'data-key': `fil-${thread}` },
      lead,
      h(
        'span',
        null,
        h('b', null, threadName(ctx, thread)),
        h('span', { class: 'dt-second' }, last?.text ?? MS.none),
      ),
      h(
        'span',
        { class: 'dt-conv-heure' },
        last === undefined ? '' : heure(last.minutes),
        fresh > 0 ? h('span', { class: 'dt-nonlu', 'aria-hidden': 'true' }) : null,
        fresh > 0 ? h('span', { class: 'dt-sr' }, MS.new) : null,
      ),
    );
    if (fresh > 0 && body.querySelector('[data-default]') === null) row.dataset.default = '';
    row.addEventListener('click', () => {
      nav.go({ app: 'messages', thread });
    });
    body.append(row);
  }
}

function proposalCard(
  ctx: UiContext,
  model: InterfaceModel,
  p: ProposalView,
  nav: PhoneNav,
): HTMLElement {
  const partner = ctx.partner.name;
  const answer = (accept: boolean): void => {
    ctx.send({ type: 'proposal-answer', id: p.id, accept });
  };
  const card = h(
    'div',
    {
      class: 'dt-proposition',
      role: 'group',
      'aria-label': fill(MS.proposal.head, { player: partner }),
    },
    h(
      'p',
      { class: 'dt-qui' },
      token(ctx.partner.color),
      fill(MS.proposal.head, { player: partner }),
    ),
  );
  let yes: HTMLButtonElement;
  if (p.kind === 'open' || p.kind === 'close-early') {
    const open = p.kind === 'open';
    card.append(
      h('h3', null, open ? T.proposal.openTitle : T.proposal.closeTitle),
      h('p', null, fill(open ? T.proposal.openLine : T.proposal.closeLine, { partner })),
      h(
        'p',
        { class: 'dt-second dt-petit' },
        open ? T.proposal.openDetail : T.proposal.closeDetail,
      ),
    );
    yes = button(
      open ? T.proposal.openYes : T.proposal.closeYes,
      () => {
        answer(true);
      },
      { primary: true },
    );
    card.append(
      h(
        'div',
        { class: 'dt-actions' },
        yes,
        button(T.proposal.notYet, () => {
          answer(false);
        }),
      ),
    );
  } else {
    const campaign = isCampaign(model, p);
    card.append(h('h3', null, p.item ?? ''));
    if (p.amountCents !== null)
      card.append(
        h(
          'p',
          { class: 'dt-montant' },
          fill(MS.proposal.cash, {
            amount: euros(p.amountCents, true),
            left: euros(p.remainingCents ?? 0, true),
          }),
        ),
      );
    if (p.benefit !== null) card.append(h('p', { class: 'dt-petit' }, p.benefit));
    const when = p.when ?? (campaign ? MS.proposal.paidTonight : null);
    if (when !== null) card.append(h('p', { class: 'dt-second dt-petit' }, when));
    const item = p.item ?? '';
    yes = button(
      MS.proposal.yes,
      () => {
        answer(true);
        const day = model.clock?.day ?? 0;
        const minutes = model.clock?.minutes ?? 0;
        ctx.phone.messages.push({
          id: ctx.phone.nextId++,
          thread: 'partner',
          text: fill(MS.youAgreed, { name: lowerFirst(item) }),
          day,
          minutes,
          read: true,
        });
        nav.refresh();
      },
      { primary: true },
    );
    const see = campaign ? 'marketing' : 'catalogue';
    card.append(
      h(
        'div',
        { class: 'dt-actions' },
        yes,
        button(MS.proposal.no, () => {
          answer(false);
        }),
        button(
          fill(MS.proposal.see, { app: appLabel(see) }),
          () => {
            nav.go({ app: see });
          },
          { className: 'dt-btn-lien' },
        ),
      ),
    );
  }
  yes.dataset.default = '';
  return card;
}
