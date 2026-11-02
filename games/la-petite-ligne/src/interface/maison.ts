/**
 * Panneaux de la maison du tour 10: le rangement à cases (coffre, étagères, râtelier), le chantier
 * d'une pièce (cellier, chambre) et la commande « Agrandir la maisonnette » à l'établi de Basile.
 * Les modèles sont dans `modele-maison.ts`; ici, le DOM seulement.
 */
import type { Quality, ReadonlyWorld } from '../etat/types';
import type { KeyInfo, UiHost } from './composant';
import { characterOf } from './contexte';
import { button, chip, el, focusElement, icon, keycap } from './dom';
import { capitalize } from './format';
import { stackEntries } from './modele-panneaux';
import {
  type BasileRoomsModel,
  type RoomOrderModel,
  type RoomSiteModel,
  type StorageCellModel,
  type StorageModel,
  roomSiteModel,
  storageModel,
} from './modele-maison';
import { Panel, backKeys } from './panneau';

// ---------------------------------------------------------------------------
// Rangement de la maison (section 5)

/** Colonnes de la grille des cases (20 cases du coffre: deux rangées). */
const STORAGE_COLUMNS = 10;

export class StoragePanel extends Panel {
  /** Case choisie: `cell:<index>` ou `hook:<index>`. */
  private selected: string | null = null;

  constructor(host: UiHost) {
    const { ctx } = host;
    const s = ctx.texts.extra.storage;
    super(host, {
      icon: 'chest',
      title: ctx.t(s.title),
      subtitle: ctx.t(s.subtitle),
      width: '62rem',
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

  private take(item: string, quality: Quality, count: number): void {
    if (count > 0) this.host.send({ type: 'chest_take', item, quality, count });
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const model = storageModel(world, ctx);
    const inBag = stackEntries(ctx, me.bag, true);
    const all = [
      ...model.cells.map((c) => ({ key: `cell:${c.index}`, c })),
      ...model.rack.map((c) => ({ key: `hook:${c.index}`, c })),
    ];
    if (
      this.selected !== null &&
      (all.find((x) => x.key === this.selected)?.c.item ?? null) === null
    )
      this.selected = null;
    this.selected ??= all.find((x) => x.c.item !== null)?.key ?? null;
    const sig = JSON.stringify([model, inBag, this.selected]);
    this.renderBody(sig, () =>
      this.nodes(model, inBag, all.find((x) => x.key === this.selected)?.c ?? null),
    );
  }

  private nodes(
    model: StorageModel,
    inBag: ReturnType<typeof stackEntries>,
    selected: StorageCellModel | null,
  ): HTMLElement[] {
    const { ctx } = this.host;
    const s = ctx.texts.extra.storage;
    const summary = el(
      'div',
      {
        class: 'lpl-order__summary lpl-storage__summary',
        'data-state': model.overflow ? 'overflow' : model.full ? 'full' : null,
      },
      [
        el('strong', { text: model.count }),
        model.full && !model.overflow ? chip(ctx.t(s.full), 'alert', 'ui-warning') : null,
        button(
          [icon('ui-check'), ctx.t(s.sort)],
          () => {
            this.host.send({ type: 'storage_sort' });
          },
          {
            class: 'lpl-button lpl-button--quiet',
            attrs: { 'data-nav-item': true, 'data-key': 'sort', title: ctx.t(s.sortHelp) },
          },
        ),
      ],
    );
    const grid = el('div', {
      class: 'lpl-inventory lpl-storage__cells',
      role: 'group',
      'aria-label': ctx.t(s.cellsLabel),
      style: `--lpl-columns: ${STORAGE_COLUMNS}`,
    });
    for (const c of model.cells) grid.append(this.cell(c, `cell:${c.index}`));
    const rack = el('div', {
      class: 'lpl-inventory lpl-storage__rack',
      role: 'group',
      'aria-label': ctx.t(s.rack),
      style: `--lpl-columns: ${STORAGE_COLUMNS}`,
    });
    for (const c of model.rack) rack.append(this.cell(c, `hook:${c.index}`));
    const left = el('section', { class: 'lpl-storage__store', 'data-nav': 'grid' }, [
      el('h3', { class: 'lpl-section-title', text: ctx.t(s.cellsLabel) }),
      model.cells.length === 0
        ? el('div', { class: 'lpl-empty', text: ctx.t(s.emptyStorage) })
        : grid,
      el('h3', { class: 'lpl-section-title lpl-section-gap' }, [
        ctx.t(s.rack),
        ' ',
        el('small', { class: 'lpl-storage__rack-count', text: model.rackCount }),
      ]),
      rack,
      el('p', { class: 'lpl-field__help', text: ctx.t(s.rackHelp) }),
    ]);
    const right = el('section', { class: 'lpl-storage__side' }, [
      this.detail(selected),
      ...this.bagNodes(model, inBag),
    ]);
    return [summary, el('div', { class: 'lpl-storage' }, [left, right])];
  }

  private cell(c: StorageCellModel, key: string): HTMLElement {
    if (c.item === null || c.icon === null) {
      return el('span', {
        class: 'lpl-slot lpl-slot--empty',
        role: 'img',
        'aria-label': c.label,
        'data-hook': key.startsWith('hook') ? true : null,
      });
    }
    const b = button(
      [icon(c.icon, 'lpl-slot__icon')],
      () => {
        this.selected = key;
        this.host.invalidate();
      },
      {
        class: 'lpl-slot',
        attrs: {
          'data-nav-item': true,
          'data-key': key,
          'aria-label': c.label,
          title: c.label,
          'aria-pressed': String(key === this.selected),
          'data-state': c.over ? 'over' : null,
          'data-autofocus': key === this.selected,
        },
      },
    );
    if (c.count > 1) b.append(el('span', { class: 'lpl-slot__count', text: String(c.count) }));
    if (c.quality === 'fine') b.append(icon('ui-star', 'lpl-slot__quality'));
    return b;
  }

  private detail(c: StorageCellModel | null): HTMLElement {
    const { ctx } = this.host;
    const s = ctx.texts.extra.storage;
    const item = c?.item ?? null;
    if (c === null || item === null) {
      return el('aside', { class: 'lpl-item-detail', 'aria-label': ctx.t(s.selected) }, [
        el('p', { class: 'lpl-item-detail__meta', text: ctx.t(s.emptyStorage) }),
      ]);
    }
    const quality = c.quality;
    const actions = el('div', { class: 'lpl-item-detail__actions' }, [
      button(
        [c.count > 1 ? ctx.t(s.takeCell) : ctx.t(s.take), ' ', keycap(ctx.key('Enter'))],
        () => {
          this.take(item, quality, c.count);
        },
        {
          class: 'lpl-button lpl-button--primary',
          attrs: { 'data-nav-item': true, 'data-key': 'take-cell' },
        },
      ),
      c.count > 1
        ? button(
            ctx.t(s.takeOne),
            () => {
              this.take(item, quality, 1);
            },
            { attrs: { 'data-nav-item': true, 'data-key': 'take-one' } },
          )
        : null,
    ]);
    return el(
      'aside',
      {
        class: 'lpl-item-detail',
        'aria-label': ctx.t(s.selected),
        'data-state': c.over ? 'over' : null,
      },
      [
        el('div', { class: 'lpl-item-detail__head' }, [
          icon(c.icon ?? 'parcel', ''),
          el('div', {}, [
            el('p', { class: 'lpl-item-detail__name', text: c.label }),
            c.over
              ? el('p', { class: 'lpl-item-detail__meta', text: ctx.t(s.overflowCell) })
              : null,
          ]),
        ]),
        actions,
      ],
    );
  }

  private bagNodes(model: StorageModel, inBag: ReturnType<typeof stackEntries>): HTMLElement[] {
    const { ctx } = this.host;
    const s = ctx.texts.extra.storage;
    const nodes: HTMLElement[] = [];
    if (model.families.length > 0) {
      const families = el('div', {
        class: 'lpl-storage__families',
        role: 'group',
        'aria-label': ctx.t(s.depositLabel),
      });
      for (const f of model.families) {
        families.append(
          button(
            [f.label, ' ', el('small', { text: String(f.count) })],
            () => {
              this.host.send({ type: 'storage_deposit_family', family: f.family });
            },
            {
              class: 'lpl-button',
              attrs: {
                'data-nav-item': true,
                'data-key': `family:${f.family}`,
                'aria-disabled': model.overflow ? 'true' : null,
              },
            },
          ),
        );
      }
      nodes.push(families);
    }
    nodes.push(el('h3', { class: 'lpl-section-title', text: ctx.t(s.inBag) }));
    if (inBag.length === 0) {
      nodes.push(el('div', { class: 'lpl-empty', text: ctx.t(s.emptyBag) }));
      return nodes;
    }
    const list = el('ul', { class: 'lpl-order lpl-storage__bag', 'data-nav': 'list' });
    for (const e of inBag) {
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
          ]),
          el('span', { class: 'lpl-order__count', text: String(e.count) }),
          el('span', { class: 'lpl-order__action' }, [
            button(
              ctx.t(s.deposit),
              () => {
                this.host.send({
                  type: 'chest_deposit',
                  item: e.item,
                  quality: e.quality,
                  count: e.count,
                });
              },
              {
                class: 'lpl-button',
                attrs: {
                  'data-nav-item': true,
                  'data-key': `deposit:${e.item}:${e.quality}`,
                  'aria-disabled': model.overflow ? 'true' : null,
                },
              },
            ),
          ]),
        ]),
      );
    }
    nodes.push(list);
    return nodes;
  }

  override key(code: string, info: KeyInfo): boolean {
    if (!info.inside || info.repeat || (code !== 'Enter' && code !== 'NumpadEnter')) return false;
    const active = document.activeElement;
    const key = active instanceof HTMLElement ? active.dataset.key : undefined;
    if (key === undefined || (!key.startsWith('cell:') && !key.startsWith('hook:'))) return false;
    // Entrée sur une case: la choisir, puis prendre ce qu'elle tient.
    if (this.selected !== key) {
      this.selected = key;
      this.host.invalidate();
      return true;
    }
    focusElement(this.body.querySelector<HTMLElement>('[data-key="take-cell"]'));
    return true;
  }
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
