/**
 * Panneaux de la maison du tour 10: le rangement à cases (coffre, étagères, râtelier), le chantier
 * d'une pièce (cellier, chambre) et la commande « Agrandir la maisonnette » à l'établi de Basile.
 * Les modèles sont dans `modele-maison.ts`; ici, le DOM seulement.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { KeyInfo, UiHost } from './composant';
import { STORAGE_FAMILY_ICONS, UI_SETTINGS } from './config';
import { characterOf } from './contexte';
import { button, chip, clear, el, icon, keycap } from './dom';
import { capitalize, itemTitle } from './format';
import { type StackEntry, stackEntries } from './modele-panneaux';
import {
  type BasileRoomsModel,
  type RoomOrderModel,
  type RoomSiteModel,
  type StorageCellModel,
  type StorageModel,
  roomSiteModel,
  storageModel,
} from './modele-maison';
import { type VitrineItem, Vitrine, detailActions, detailFigure, pastille, pastilles } from './vitrine';
import { Panel, backKeys } from './panneau';

// ---------------------------------------------------------------------------
// Rangement de la maison (section 5; patch 0.12.2: en vignettes)

type StorageSide = 'store' | 'rack' | 'bag';

/**
 * Le rangement en vignettes (patch 0.12.2): la grille du rangement à côté de celle du sac, le
 * râtelier dans une rangée à part, les places en pastilles (« 18/26 »). Entrée sur une vignette, ou
 * un clic sur la vignette déjà choisie, prend la case ou dépose la pile d'un geste; le détail
 * de la vignette choisie, sous les grilles, montre son nom et « Prendre 1 » ou « Déposer 1 ».
 */
export class StoragePanel extends Panel {
  private readonly store: Vitrine;
  private readonly rack: Vitrine;
  private readonly bag: Vitrine;
  /** Côté du focus: le détail montre sa vignette choisie. */
  private side: StorageSide = 'store';
  private detailBox: HTMLElement | null = null;
  private last: { model: StorageModel; bag: StackEntry[]; inBag: Map<string, number> } | null = null;

  constructor(host: UiHost) {
    const { ctx } = host;
    const s = ctx.texts.extra.storage;
    const v = ctx.texts.extra.vitrine;
    super(host, {
      icon: 'chest',
      title: ctx.t(s.title),
      subtitle: ctx.t(s.subtitle),
      width: UI_SETTINGS.vitrine.storageWidth,
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.root.classList.add('lpl-panel--vitrine');
    this.store = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.storagePerPage, label: ctx.t(s.cellsLabel), variant: 'lpl-vitrine--store', noDetail: true });
    this.rack = new Vitrine(host, { perPage: ctx.content.settings.storage?.rackHooks ?? 12, label: ctx.t(s.rack), variant: 'lpl-vitrine--rack', noDetail: true });
    this.bag = new Vitrine(host, { perPage: UI_SETTINGS.vitrine.storageBagPerPage, label: ctx.t(v.bagTitle), variant: 'lpl-vitrine--store-bag', noDetail: true });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [ctx.key('KeyQ'), ctx.key('KeyE')], text: ctx.texts.extra.notebook.keysPages },
        { keys: [...a], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: v.keysStore },
      ]),
    ]);
    // Le focus dit le côté (rangement, râtelier, sac): le détail suit, sans reconstruire les grilles.
    this.body.addEventListener('focusin', (e) => {
      const tile = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>('.lpl-tile[data-key]') : null;
      const side = sideOf(tile?.dataset.key);
      if (side === null || tile === null) return;
      this.side = side;
      this.markSide();
      this.fillDetail();
    });
  }

  override key(code: string, info: KeyInfo): boolean {
    if (!info.inside || (code !== 'KeyQ' && code !== 'KeyE')) return false;
    // A et E: les pages du rangement (au-delà de 28 cases).
    this.store.turn(code === 'KeyQ' ? -1 : 1);
    return true;
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const model = storageModel(world, ctx);
    const bag = stackEntries(ctx, me.bag, true);
    const inBag = new Map<string, number>();
    for (const e of bag) inBag.set(e.item, (inBag.get(e.item) ?? 0) + e.count);
    this.last = { model, bag, inBag };
    // 0.12: la garde-robe se range ici (armoire ou coffre de la maison), dès qu'on a une tenue.
    const wardrobe = ctx.content.clothes.list.length > 0;
    const sig = JSON.stringify([model, bag, wardrobe, this.store.page]);
    this.renderBody(sig, () => this.nodes(model, bag, wardrobe));
  }

  private nodes(model: StorageModel, bag: readonly StackEntry[], wardrobe: boolean): HTMLElement[] {
    const { ctx } = this.host;
    const s = ctx.texts.extra.storage;
    const v = ctx.texts.extra.vitrine;
    const filled = model.cells.filter((c) => c.item !== null);
    const hooks = model.rack.filter((c) => c.item !== null);
    const placesText = model.total === null ? String(model.used) : `${String(model.used)}/${String(model.total)}`;
    const placesLabel = model.overflow ? model.count : model.total === null ? ctx.t(v.placesFreeLabel, { used: model.used }) : ctx.t(v.placesLabel, { used: model.used, total: model.total });
    const strip = el('div', { class: 'lpl-vitrine__strip lpl-storage__strip', 'data-state': model.overflow ? 'overflow' : model.full ? 'full' : null }, [
      pastille({ icon: 'chest', text: placesText, tone: model.overflow ? 'missing' : model.full ? 'wait' : 'count', crossed: model.overflow, label: placesLabel }),
      pastille({ icon: 'tool-rack', text: `${String(hooks.length)}/${String(model.rack.length)}`, tone: 'count', label: ctx.t(v.hooksLabel, { used: hooks.length, total: model.rack.length }) }),
      // Plein ou débordé: une ligne qui dit quoi faire (la pastille barrée seule ne le dirait pas).
      model.overflow || model.full ? el('p', { class: 'lpl-storage__alert', 'data-state': model.overflow ? 'overflow' : 'full' }, [icon('ui-warning'), model.overflow ? model.count : ctx.t(s.full)]) : null,
      el('span', { class: 'lpl-storage__spacer' }),
      button([icon('ui-check'), ctx.t(s.sort)], () => {
        this.host.send({ type: 'storage_sort' });
      }, { class: 'lpl-button lpl-button--quiet', attrs: { 'data-nav-item': true, 'data-key': 'sort', title: ctx.t(s.sortHelp) } }),
      wardrobe
        ? button([icon('chest'), ctx.t(ctx.texts.extra.clothes.open)], () => {
            this.host.openWardrobe();
          }, { attrs: { 'data-nav-item': true, 'data-key': 'wardrobe' } })
        : null,
    ]);
    // Le rangement: les cases prises en vignettes, puis les cases libres en pointillé jusqu'à la capacité.
    const storeItems = filled.map((c) => this.cellItem(c, `cell:${c.index}`, model.overflow));
    const store = this.store.build(storeItems, null);
    const free = model.total === null ? 0 : Math.max(0, model.total - filled.length);
    this.pad(store, free, this.store, filled.length, UI_SETTINGS.vitrine.storagePerPage);
    const rackItems = hooks.map((c) => this.cellItem(c, `hook:${c.index}`, false));
    const rack = this.rack.build(rackItems, null);
    this.pad(rack, model.rack.length - hooks.length, this.rack, hooks.length, model.rack.length);
    const bagItems = bag.map((e, i) => this.bagItem(e, i, model.overflow));
    const bagGrid = this.bag.build(bagItems, null);
    // Les pages du rangement: dans la rangée du titre, pour que la grille garde toute sa hauteur.
    const pager = store.querySelector('.lpl-pager');
    const left = el('section', { class: 'lpl-storage__column', 'data-side': 'store' }, [
      el('div', { class: 'lpl-storage__head' }, [el('h3', { class: 'lpl-vitrine__row-title' }, [icon('chest'), ctx.t(v.storeTitle)]), pager]),
      filled.length === 0 && free === 0 ? el('p', { class: 'lpl-vitrine__notice lpl-vitrine__notice--quiet', text: ctx.t(s.emptyStorage) }) : store,
    ]);
    const families = model.families.map((f) =>
      button([icon(STORAGE_FAMILY_ICONS[f.family] ?? 'parcel'), el('span', { class: 'lpl-storage__family-count', text: `×${String(f.count)}` })], () => {
        this.host.send({ type: 'storage_deposit_family', family: f.family });
      }, {
        class: 'lpl-button lpl-storage__family',
        attrs: {
          'data-nav-item': true,
          'data-key': `family:${f.family}`,
          'aria-label': ctx.t(v.depositFamilyLabel, { family: s.families[f.family] ?? f.family, count: f.count }),
          title: ctx.t(v.depositFamilyLabel, { family: s.families[f.family] ?? f.family, count: f.count }),
          'aria-disabled': model.overflow ? 'true' : null,
        },
      }),
    );
    const right = el('section', { class: 'lpl-storage__column', 'data-side': 'bag' }, [
      el('h3', { class: 'lpl-vitrine__row-title' }, [icon('grain-sack'), ctx.t(v.bagTitle)]),
      bag.length === 0 ? el('p', { class: 'lpl-vitrine__notice lpl-vitrine__notice--quiet', text: ctx.t(s.emptyBag) }) : bagGrid,
      families.length === 0 ? null : el('div', { class: 'lpl-storage__families', role: 'group', 'aria-label': ctx.t(v.depositGroup) }, [el('span', { class: 'lpl-storage__families-title', text: ctx.t(v.depositGroup) }), ...families]),
    ]);
    const rackRow = el('section', { class: 'lpl-storage__rack-row', 'data-side': 'rack' }, [
      el('h3', { class: 'lpl-vitrine__row-title', title: ctx.t(s.rackHelp) }, [icon('tool-rack'), ctx.t(v.rackTitle)]),
      rack,
    ]);
    this.detailBox = el('div', { class: 'lpl-storage__detail', 'aria-live': 'polite' });
    // Le côté du focus: celui d'avant s'il a encore des vignettes, sinon le rangement, puis le sac.
    const has = { store: storeItems.length > 0, rack: rackItems.length > 0, bag: bagItems.length > 0 };
    if (!has[this.side]) this.side = has.store ? 'store' : has.bag ? 'bag' : 'rack';
    const grids = el('div', { class: 'lpl-storage__grids' }, [left, right]);
    const root = el('div', { class: 'lpl-storage-v' }, [strip, grids, rackRow, this.detailBox]);
    this.markSide(root);
    this.fillDetail();
    return [root];
  }

  /** Cases libres en pointillé après les vignettes, sur la dernière page seulement. */
  private pad(box: HTMLElement, free: number, vitrine: Vitrine, count: number, perPage: number): void {
    const grid = box.querySelector('.lpl-vitrine__grid');
    if (grid === null || vitrine.page < vitrine.pagesFor(count) - 1) return;
    const room = Math.min(free, perPage - (count - vitrine.page * perPage));
    for (let i = 0; i < room; i++) grid.append(el('span', { class: 'lpl-tile lpl-tile--free', 'aria-hidden': 'true' }));
  }

  private cellItem(c: StorageCellModel, key: string, overflow: boolean): VitrineItem {
    const { ctx } = this.host;
    const item = c.item ?? '';
    return {
      key,
      tile: {
        icon: c.icon ?? 'parcel',
        name: capitalize(itemTitle(ctx.content.items[item], 1, item)),
        label: c.label,
        badge: c.count > 1 ? { icon: null, text: `×${String(c.count)}`, tone: 'count' } : null,
        corner: c.over ? 'ui-warning' : c.quality === 'fine' ? 'ui-star' : null,
        state: c.over ? 'missing' : null,
        className: c.quality === 'fine' ? 'lpl-tile--store lpl-tile--fine' : 'lpl-tile--store',
        attrs: { 'data-over': c.over ? 'true' : null, 'data-overflow': overflow ? 'true' : null },
      },
      detail: () => [],
      act: () => {
        if (c.item === null) return false;
        this.host.send({ type: 'chest_take', item: c.item, quality: c.quality, count: c.count });
        return true;
      },
    };
  }

  private bagItem(e: StackEntry, index: number, overflow: boolean): VitrineItem {
    const { ctx } = this.host;
    return {
      key: `bag:${String(index)}`,
      tile: {
        icon: e.icon,
        name: capitalize(itemTitle(ctx.content.items[e.item], 1, e.item)),
        label: `${e.name}${e.quality === 'fine' ? `, ${ctx.texts.extra.common.fineQuality}` : ''}, ${String(e.count)}`,
        badge: e.count > 1 ? { icon: null, text: `×${String(e.count)}`, tone: 'count' } : null,
        corner: e.quality === 'fine' ? 'ui-star' : null,
        state: overflow ? 'missing' : null,
        className: e.quality === 'fine' ? 'lpl-tile--store lpl-tile--fine' : 'lpl-tile--store',
      },
      detail: () => [],
      act: () => {
        if (overflow) return false;
        this.host.send({ type: 'chest_deposit', item: e.item, quality: e.quality, count: e.count });
        return true;
      },
    };
  }

  /** Le côté actif porte la sélection visible et le focus par défaut (après un dépôt, il y reste). */
  private markSide(root: HTMLElement = this.body): void {
    for (const section of root.querySelectorAll<HTMLElement>('[data-side]')) {
      const on = section.dataset.side === this.side;
      section.toggleAttribute('data-active', on);
      for (const t of section.querySelectorAll<HTMLElement>('.lpl-tile[data-selected]')) t.toggleAttribute('data-autofocus', on);
    }
  }

  private fillDetail(): void {
    const box = this.detailBox;
    const last = this.last;
    if (box === null || last === null) return;
    clear(box);
    const { ctx } = this.host;
    const s = ctx.texts.extra.storage;
    const v = ctx.texts.extra.vitrine;
    const key = (this.side === 'store' ? this.store : this.side === 'rack' ? this.rack : this.bag).selection;
    if (key === null) {
      box.append(el('p', { class: 'lpl-detail__line', text: ctx.t(last.bag.length === 0 ? s.emptyStorage : s.emptyBag) }));
      return;
    }
    if (this.side === 'bag') {
      const e = last.bag[Number(key.split(':')[1])];
      if (e === undefined) return;
      const tool = ctx.content.items[e.item]?.category === 'tool';
      const stored = last.model.cells.reduce((n, c) => n + (c.item === e.item ? c.count : 0), 0);
      const refused = last.model.overflow;
      box.append(
        ...this.detailHead(e.icon, e.item, e.quality === 'fine'),
        pastilles([
          { icon: 'grain-sack', text: `×${String(e.count)}`, tone: 'count', label: ctx.t(ctx.texts.extra.common.inBag, { count: e.count }) },
          tool ? { icon: 'tool-rack', text: '', tone: 'info', label: ctx.t(v.toRackLabel) } : { icon: 'chest', text: `×${String(stored)}`, tone: 'count', label: ctx.t(v.inStoreLabel, { count: stored }) },
        ]) ?? el('span'),
        detailActions([
          button([ctx.t(s.deposit), ' ', keycap(ctx.key('Enter'))], () => {
            this.host.send({ type: 'chest_deposit', item: e.item, quality: e.quality, count: e.count });
          }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': 'deposit', 'aria-disabled': refused ? 'true' : null } }),
          e.count > 1
            ? button(ctx.t(v.depositOne), () => {
                this.host.send({ type: 'chest_deposit', item: e.item, quality: e.quality, count: 1 });
              }, { attrs: { 'data-nav-item': true, 'data-key': 'deposit-one', 'aria-disabled': refused ? 'true' : null } })
            : null,
        ]),
      );
      return;
    }
    const list = this.side === 'store' ? last.model.cells : last.model.rack;
    const c = list.find((x) => `${this.side === 'store' ? 'cell' : 'hook'}:${String(x.index)}` === key);
    if (c === undefined || c.item === null) return;
    const item = c.item;
    const inBag = last.inBag.get(item) ?? 0;
    box.append(
      ...this.detailHead(c.icon ?? 'parcel', item, c.quality === 'fine'),
      pastilles([
        c.count > 1 ? { icon: this.side === 'store' ? 'chest' : 'tool-rack', text: `×${String(c.count)}`, tone: 'count', label: c.label } : null,
        { icon: 'grain-sack', text: `×${String(inBag)}`, tone: 'count', label: inBag === 0 ? ctx.texts.extra.common.noneInBag : ctx.t(ctx.texts.extra.common.inBag, { count: inBag }) },
        c.over ? { icon: 'ui-warning', text: '', tone: 'missing', label: ctx.t(s.overflowCell) } : null,
      ]) ?? el('span'),
      detailActions([
        button([ctx.t(s.take), ' ', keycap(ctx.key('Enter'))], () => {
          this.host.send({ type: 'chest_take', item, quality: c.quality, count: c.count });
        }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': 'take-cell' } }),
        c.count > 1
          ? button(ctx.t(s.takeOne), () => {
              this.host.send({ type: 'chest_take', item, quality: c.quality, count: 1 });
            }, { attrs: { 'data-nav-item': true, 'data-key': 'take-one' } })
          : null,
      ]),
    );
  }

  /** Dessin et nom de l'objet choisi (le nom n'apparaît qu'ici et au survol). */
  private detailHead(figure: string, item: string, fine: boolean): HTMLElement[] {
    const { ctx } = this.host;
    return [
      detailFigure(figure),
      el('div', { class: 'lpl-storage__detail-name' }, [
        el('h3', { class: 'lpl-detail__name', text: capitalize(itemTitle(ctx.content.items[item], 1, item)) }),
        fine ? pastille({ icon: 'ui-star', text: '', tone: 'price', label: ctx.t(ctx.texts.extra.vitrine.fineLabel) }) : null,
      ]),
    ];
  }
}

/** Côté d'une vignette du rangement d'après sa clé. */
function sideOf(key: string | undefined): StorageSide | null {
  if (key === undefined) return null;
  if (key.startsWith('cell:')) return 'store';
  if (key.startsWith('hook:')) return 'rack';
  if (key.startsWith('bag:')) return 'bag';
  return null;
}

// ---------------------------------------------------------------------------
// Chantier d'une pièce (section 4.3)

const ELEMENT_ICONS: Readonly<Record<RoomSiteModel['elements'][number]['state'], string>> = {
  built: 'ui-check',
  working: 'ui-hammer',
  ready: 'plank',
  blocked: 'ui-lock',
};

/** Le panneau du chantier: éléments, supports, caisse, panne faîtière. Ouvert par l'invite (Entrée ou clic). */
export class RoomPanel extends Panel {
  constructor(host: UiHost) {
    const { ctx } = host;
    super(host, {
      icon: 'ui-hammer',
      title: '',
      narrow: true,
      width: '44rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const model = roomSiteModel(world, this.host.ctx);
    if (model === null) {
      this.close();
      return;
    }
    this.titleEl.textContent = model.title;
    const sig = JSON.stringify(model);
    this.renderBody(sig, () => roomNodes(this.host, model));
  }
}

function roomNodes(host: UiHost, m: RoomSiteModel): HTMLElement[] {
  const { ctx } = host;
  const r = ctx.texts.extra.rooms;
  const summary = el('div', { class: 'lpl-order__summary lpl-room__summary' }, [
    el('strong', { text: m.progress }),
    m.tonight ? chip(ctx.t(r.tonight), 'ready', 'ui-check') : null,
    el('span', { class: 'lpl-order__bar lpl-room__bar' }, [
      el('span', { style: `--lpl-value: ${Math.round(m.ratio * 100)}%` }),
    ]),
    el('span', { text: m.bring }),
    el('small', { text: m.crate }),
  ]);
  const firstDeposit = m.deposits.findIndex((d) => d.count > 0);
  const deposits = el(
    'div',
    { class: 'lpl-room__deposits' },
    m.deposits.map((d, i) =>
      button(
        [icon(d.icon), d.text],
        () => {
          if (d.count > 0)
            host.send({ type: 'room_deposit', room: m.id, item: d.item, count: d.count });
        },
        {
          class: `lpl-button${d.count > 0 ? ' lpl-button--primary' : ''}`,
          attrs: {
            'data-nav-item': true,
            'data-key': `deposit:${d.item}`,
            'aria-disabled': d.count > 0 ? null : 'true',
            'data-autofocus': i === Math.max(0, firstDeposit),
          },
        },
      ),
    ),
  );
  const beam =
    m.beam === null
      ? null
      : el('p', { class: 'lpl-room__beam', 'data-state': m.beam.done ? 'done' : null }, [
          icon(m.beam.done ? 'ui-check' : 'beam'),
          el('span', {}, [
            el('strong', { text: m.beam.text }),
            m.beam.done ? null : el('small', { text: m.beam.help }),
          ]),
        ]);
  const list = el('ul', {
    class: 'lpl-order lpl-room__elements',
    'data-nav': 'list',
    'aria-label': ctx.t(r.elementsLabel),
  });
  for (const e of m.elements) {
    list.append(
      el(
        'li',
        {
          class: 'lpl-order__line lpl-room__element',
          'data-state': e.state,
          tabindex: '0',
          'data-nav-item': true,
          'data-key': `element:${e.id}`,
        },
        [
          icon(ELEMENT_ICONS[e.state], 'lpl-order__icon'),
          el('span', { class: 'lpl-order__name' }, [
            capitalize(e.name),
            el('small', { text: e.text }),
          ]),
          e.state === 'working'
            ? el('span', { class: 'lpl-order__bar' }, [
                el('span', { style: `--lpl-value: ${Math.round(e.progress * 100)}%` }),
              ])
            : el('span'),
        ],
      ),
    );
  }
  const help = el('p', {
    class: 'lpl-field__help',
    text: ctx.t(r.panelSubtitle, { act: ctx.key('Space') }),
  });
  return [
    summary,
    deposits,
    help,
    ...(beam === null ? [] : [beam]),
    el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(r.elementsLabel) }),
    list,
  ];
}

// ---------------------------------------------------------------------------
// « Agrandir la maisonnette » à l'établi de Basile (section 4.3), et le grand coffre (section 5.2)

export function basileRoomsSection(host: UiHost, m: BasileRoomsModel): HTMLElement[] {
  const { ctx } = host;
  const r = ctx.texts.extra.rooms;
  const nodes: HTMLElement[] = [];
  const line = (o: RoomOrderModel): HTMLLIElement => {
    let action: HTMLElement;
    if (o.state === 'orderable') {
      action = button(
        o.text,
        () => {
          host.send({ type: 'improvement_pay', improvement: o.id, amount: null });
        },
        {
          class: 'lpl-button lpl-button--primary lpl-button--wide',
          attrs: { 'data-nav-item': true, 'data-key': `order:${o.id}` },
        },
      );
    } else if (o.state === 'too_expensive') {
      action = button(o.text, () => undefined, {
        class: 'lpl-button lpl-button--wide',
        attrs: { 'aria-disabled': 'true', 'data-nav-item': true, 'data-key': `order:${o.id}` },
      });
    } else {
      const variant =
        o.state === 'built' || o.state === 'tonight'
          ? 'ready'
          : o.state === 'waiting'
            ? 'waiting'
            : '';
      const iconId =
        o.state === 'built'
          ? 'ui-check'
          : o.state === 'busy'
            ? 'ui-lock'
            : o.state === 'waiting'
              ? 'ui-hourglass'
              : 'ui-hammer';
      action = chip(o.text, variant, iconId);
    }
    return el(
      'li',
      { class: 'lpl-order__line lpl-shop__line lpl-room-order', 'data-state': o.state },
      [
        icon(o.id === 'oak_chest' ? 'chest' : 'ui-house', 'lpl-order__icon'),
        el('span', { class: 'lpl-order__name' }, [o.line, el('small', { text: o.use })]),
        el('span'),
        el('span', { class: 'lpl-order__action' }, [action]),
      ],
    );
  };
  if (m.rooms.length > 0) {
    const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
    for (const o of m.rooms) list.append(line(o));
    nodes.push(
      el('h3', { class: 'lpl-section-title lpl-section-gap', text: ctx.t(r.orderTitle) }),
      list,
      el('p', { class: 'lpl-field__help', text: ctx.t(r.help) }),
    );
  }
  if (m.oakChest !== null) {
    const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' }, [line(m.oakChest)]);
    nodes.push(
      el('h3', { class: 'lpl-section-title lpl-section-gap', text: m.oakChest.title }),
      list,
    );
  }
  return nodes;
}
