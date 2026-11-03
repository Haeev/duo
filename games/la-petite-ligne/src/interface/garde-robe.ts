/**
 * Mercerie et confection (menu `clothes_shop`) et garde-robe de la maison (0.12, contrat
 * `docs/jeux/jeu-1/garde-robe-0-12.md`). À gauche l'aperçu de son personnage, qui porte la pièce
 * survolée ou essayée et se tourne avec A et E (libellés du clavier réel), les boutons ou la
 * souris; à droite les rayons par emplacement et leurs vignettes. Les modèles sont dans
 * `modele-garde-robe.ts`; l'état et les intentions passent par un port (`ClothesPort`).
 */
import type { ClothingSlot, ReadonlyWorld, Wear } from '../etat/types';
import { type PanelPreview, PREVIEW_DRAG, PREVIEW_STEP } from './apercu';
import type { UiHost } from './composant';
import { characterOf } from './contexte';
import { button, chip, el, icon, keycap, setText } from './dom';
import {
  type ClothesTab,
  type ClothesView,
  type ClothingCard,
  CLOTHING_SLOTS,
  clothesShopModel,
  isOptionalSlot,
  wardrobeModel,
  withWear,
} from './modele-garde-robe';
import { Panel, backKeys, price, purseBadge } from './panneau';
import { SOUND_ATTR } from './sons';

/** Ce que la mercerie et la garde-robe lisent et envoient (intentions `clothes_buy` et `wear`). */
export interface ClothesPort {
  view(world: ReadonlyWorld): ClothesView | null;
  buy(item: string): void;
  wear(slot: ClothingSlot, item: string | null): void;
  /** Aperçu du personnage: 3D du rendu s'il est prêt, sinon silhouette 2D de repli. */
  createPreview(): PanelPreview;
  /** L'aperçu 3D s'il est devenu disponible (rendu chargé après l'ouverture du panneau), sinon `null`. */
  upgradePreview(): PanelPreview | null;
}

export type ClothesMode = 'shop' | 'wardrobe';

const UPGRADE_MS = 500;

/** Dernier rayon ouvert, par mode: on retrouve sa place en rouvrant le panneau. */
const lastSlot: Record<ClothesMode, ClothingSlot> = { shop: 'top', wardrobe: 'top' };

export class ClothesPanel extends Panel {
  private readonly port: ClothesPort;
  private readonly mode: ClothesMode;
  private slot: ClothingSlot;
  /** Pièces essayées (mercerie): la tenue de l'aperçu, `null` tant que rien n'est essayé. */
  private tried: Wear | null = null;
  /** Pièce survolée ou focalisée, montrée dans l'aperçu sans être essayée. */
  private hover: string | null = null;
  private angle = 0;
  private preview: PanelPreview;
  private lastUpgrade = 0;
  private readonly viewport: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly caption: HTMLParagraphElement;
  private readonly stageActions: HTMLDivElement;
  private stageSig = '';
  private view: ClothesView | null = null;
  private world: ReadonlyWorld | null = null;
  private drag: { x: number; angle: number; id: number } | null = null;

  constructor(host: UiHost, port: ClothesPort, mode: ClothesMode) {
    const { ctx } = host;
    const c = ctx.texts.extra.clothes;
    const left = ctx.key('KeyQ');
    const right = ctx.key('KeyE');
    super(host, {
      icon: mode === 'shop' ? 'ui-coin' : 'chest',
      title: ctx.t(mode === 'shop' ? c.title : c.wardrobeTitle),
      subtitle: mode === 'shop' ? ctx.t(c.subtitle, { left, right }) : ctx.t(c.wardrobeSubtitle),
      width: '64rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.port = port;
    this.mode = mode;
    this.slot = lastSlot[mode];
    this.root.classList.add('lpl-clothes-panel');
    this.preview = port.createPreview();
    this.caption = el('p', { class: 'lpl-clothes__caption', 'aria-live': 'polite' });
    this.stageActions = el('div', { class: 'lpl-clothes__stage-actions' });
    const turn = (dir: -1 | 1, key: string, label: string): HTMLButtonElement =>
      button(
        dir < 0 ? [keycap(key), icon('ui-rotate-left')] : [icon('ui-rotate-right'), keycap(key)],
        () => {
          this.rotate(dir);
        },
        {
          class: 'lpl-button lpl-clothes__turn',
          attrs: { 'aria-label': label, title: label, [SOUND_ATTR]: 'none' },
        },
      );
    const viewport = el(
      'div',
      { class: 'lpl-clothes__viewport', role: 'img', 'aria-label': ctx.t(c.previewLabel) },
      [this.preview.element],
    );
    this.viewport = viewport;
    viewport.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, angle: this.angle, id: e.pointerId };
      viewport.setPointerCapture(e.pointerId);
    });
    viewport.addEventListener('pointermove', (e) => {
      if (this.drag?.id !== e.pointerId) return;
      this.setAngle(this.drag.angle + (e.clientX - this.drag.x) * PREVIEW_DRAG);
    });
    const endDrag = (e: PointerEvent): void => {
      if (this.drag?.id === e.pointerId) this.drag = null;
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    // Les boutons de rotation se posent au pied de l'aperçu (place comptée à 150 %).
    const turns = el('div', { class: 'lpl-clothes__turns' }, [
      turn(-1, left, ctx.t(c.rotateLeft)),
      turn(1, right, ctx.t(c.rotateRight)),
    ]);
    this.stage = el('div', { class: 'lpl-clothes__stage' }, [
      el('div', { class: 'lpl-clothes__preview' }, [viewport, turns]),
      this.caption,
      this.stageActions,
    ]);
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [left, right], text: ctx.t(c.rotate) },
        { keys: [...a], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
  }

  override key(code: string): boolean {
    if (code !== 'KeyQ' && code !== 'KeyE') return false;
    this.rotate(code === 'KeyQ' ? -1 : 1);
    return true;
  }

  private rotate(dir: -1 | 1): void {
    this.setAngle(this.angle + dir * PREVIEW_STEP);
  }

  private setAngle(angle: number): void {
    // Ramené dans ]-PI, PI]: la silhouette 2D se retourne de dos passé le quart de tour.
    const tau = Math.PI * 2;
    this.angle = angle - tau * Math.floor((angle + Math.PI) / tau);
    this.preview.setAngle(this.angle);
  }

  dispose(): void {
    lastSlot[this.mode] = this.slot;
    this.preview.dispose();
  }

  /** La tenue de l'aperçu: la tenue portée, les pièces essayées, puis la pièce survolée. */
  private previewWear(view: ClothesView): Wear {
    const base = this.tried ?? view.wear;
    const def = this.hover === null ? undefined : view.catalogue.get(this.hover);
    return def === undefined ? base : withWear(base, def.slot, def.id);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const view = this.port.view(world);
    const me = characterOf(world, ctx.me);
    if (view === null || me === null) return;
    this.view = view;
    this.world = world;
    // Une pièce essayée puis achetée et portée: l'essayage se termine de lui-même.
    if (this.tried !== null && CLOTHING_SLOTS.every((s) => this.tried?.[s] === view.wear[s]))
      this.tried = null;
    const pinned = this.tried ?? view.wear;
    const model =
      this.mode === 'shop'
        ? clothesShopModel(ctx, view, this.slot, pinned)
        : wardrobeModel(ctx, view, this.slot, pinned);
    const removable =
      this.mode === 'wardrobe' && isOptionalSlot(this.slot) && view.wear[this.slot] !== null;
    const sig = JSON.stringify([
      this.mode,
      model.tabs,
      model.cards,
      model.slot,
      removable,
      world.purse,
    ]);
    this.renderBody(sig, () => [
      el('div', { class: 'lpl-clothes' }, [this.stage, this.shelf(world, model.tabs, model.cards)]),
    ]);
    this.updateStage(world, view);
  }

  /** Aperçu, légende et actions de gauche: mis à jour sans reconstruire le rayon (survol). */
  private updateStage(world: ReadonlyWorld, view: ClothesView): void {
    const { ctx } = this.host;
    const c = ctx.texts.extra.clothes;
    const me = characterOf(world, ctx.me);
    if (me === null) return;
    const wear = this.previewWear(view);
    this.tryUpgrade();
    // La place de l'aperçu suit la taille de l'interface (100 ou 150 %) et de la fenêtre.
    this.preview.fit(this.viewport.clientWidth, this.viewport.clientHeight);
    this.preview.show({ character: me.id, appearance: { ...me.appearance, wear } });
    const changed = CLOTHING_SLOTS.filter((s) => wear[s] !== view.wear[s]);
    const names = changed
      .map((s) => wear[s])
      .map((id) => (id === null ? null : (view.catalogue.get(id)?.nom ?? null)))
      .filter((n): n is string => n !== null);
    const removable =
      this.mode === 'wardrobe' && isOptionalSlot(this.slot) && view.wear[this.slot] !== null;
    const sig = JSON.stringify([names, this.tried !== null, removable, this.slot]);
    setText(
      this.caption,
      names.length === 0 ? ctx.t(c.current) : ctx.t(c.trying, { name: names.join(', ') }),
    );
    if (sig === this.stageSig) return;
    this.stageSig = sig;
    this.stageActions.replaceChildren();
    if (this.tried !== null) {
      this.stageActions.append(
        button(
          ctx.t(c.reset),
          () => {
            this.tried = null;
            this.host.invalidate();
          },
          { attrs: { 'data-nav-item': true, 'data-key': 'reset' } },
        ),
      );
    }
    if (removable) {
      const slot = this.slot;
      this.stageActions.append(
        button(
          ctx.t(c.remove),
          () => {
            this.port.wear(slot, null);
          },
          { attrs: { 'data-nav-item': true, 'data-key': 'remove' } },
        ),
      );
    }
  }

  /** Silhouette 2D en attendant le rendu: on retente l'aperçu 3D toutes les demi-secondes. */
  private tryUpgrade(): void {
    if (this.preview.is3d) return;
    const now = this.host.now();
    if (now - this.lastUpgrade < UPGRADE_MS) return;
    this.lastUpgrade = now;
    const next = this.port.upgradePreview();
    if (next === null) return;
    this.preview.element.replaceWith(next.element);
    this.preview.dispose();
    this.preview = next;
    this.preview.setAngle(this.angle);
  }

  private setHover(id: string | null): void {
    if (this.hover === id) return;
    this.hover = id;
    if (this.world !== null && this.view !== null) this.updateStage(this.world, this.view);
  }

  private select(slot: ClothingSlot): void {
    if (slot === this.slot) return;
    this.host.sound('ui-tab');
    this.slot = slot;
    this.hover = null;
    this.host.invalidate();
  }

  private shelf(
    world: ReadonlyWorld,
    tabs: readonly ClothesTab[],
    cards: readonly ClothingCard[],
  ): HTMLElement {
    const { ctx } = this.host;
    const c = ctx.texts.extra.clothes;
    const tabList = el('div', { class: 'lpl-clothes__tabs', role: 'tablist', 'data-nav': 'row' });
    for (const t of tabs) {
      const selected = t.slot === this.slot;
      tabList.append(
        button(
          [
            t.label,
            el('span', { class: 'lpl-clothes__tab-count', text: String(t.count) }),
            t.fresh
              ? el('span', {
                  class: 'lpl-clothes__tab-fresh',
                  title: ctx.t(c.freshTab),
                  'aria-label': ctx.t(c.freshTab),
                })
              : null,
          ],
          () => {
            this.select(t.slot);
          },
          {
            class: 'lpl-tab lpl-clothes__tab',
            attrs: {
              role: 'tab',
              'aria-selected': String(selected),
              'data-nav-item': true,
              'data-key': `tab:${t.slot}`,
              [SOUND_ATTR]: 'none',
              'data-autofocus': selected && cards.length === 0,
            },
          },
        ),
      );
    }
    const head = el('div', { class: 'lpl-clothes__head' }, [
      purseBadge(this.host, world),
      this.mode === 'shop'
        ? el('span', { class: 'lpl-field__help', text: ctx.t(c.stockNote) })
        : null,
    ]);
    if (cards.length === 0) {
      return el('div', { class: 'lpl-clothes__shelf' }, [
        tabList,
        head,
        el('div', {
          class: 'lpl-empty',
          text: ctx.t(this.mode === 'shop' ? c.empty : c.wardrobeEmpty),
        }),
      ]);
    }
    const grid = el('ul', { class: 'lpl-clothes__grid', role: 'list' });
    // Le focus va à la première vignette où il y a quelque chose à faire (la pièce portée n'a pas de bouton).
    const focus = Math.max(
      0,
      cards.findIndex((card) => card.state !== 'worn'),
    );
    cards.forEach((card, i) => {
      grid.append(this.card(card, i === focus));
    });
    return el('div', { class: 'lpl-clothes__shelf' }, [tabList, head, grid]);
  }

  private card(card: ClothingCard, first: boolean): HTMLLIElement {
    const { ctx } = this.host;
    const c = ctx.texts.extra.clothes;
    const actions: HTMLElement[] = [];
    const owned = card.state === 'owned' || card.state === 'worn';
    if (this.mode === 'shop') {
      if (card.state !== 'worn') {
        actions.push(
          button(
            ctx.t(c.try),
            () => {
              const view = this.view;
              if (view === null) return;
              this.tried = withWear(this.tried ?? view.wear, card.slot, card.id);
              this.host.invalidate();
            },
            {
              class: `lpl-button${card.trying ? ' lpl-clothes__trying' : ''}`,
              attrs: {
                'aria-label': ctx.t(c.tryAria, { name: card.name }),
                'aria-pressed': String(card.trying),
                'data-nav-item': true,
                'data-key': `try:${card.id}`,
                'data-autofocus': first,
              },
            },
          ),
        );
      }
      if (card.state === 'buy' || card.state === 'too_expensive') {
        const short = card.state === 'too_expensive';
        actions.push(
          button(
            ctx.t(c.buy),
            () => {
              if (!short) this.port.buy(card.id);
            },
            {
              class: `lpl-button${short ? '' : ' lpl-button--primary'}`,
              attrs: {
                'aria-disabled': short ? 'true' : null,
                title: short
                  ? ctx.t(ctx.texts.extra.common.missingMoney, { missing: card.missing })
                  : null,
                'data-nav-item': true,
                'data-key': `buy:${card.id}`,
              },
            },
          ),
        );
      }
    }
    if (card.state === 'owned') {
      actions.push(
        button(
          ctx.t(c.wear),
          () => {
            this.port.wear(card.slot, card.id);
            if (this.tried !== null) this.tried = withWear(this.tried, card.slot, card.id);
          },
          {
            class: `lpl-button${this.mode === 'wardrobe' ? ' lpl-button--primary' : ''}`,
            attrs: {
              'data-nav-item': true,
              'data-key': `wear:${card.id}`,
              'data-autofocus': first && this.mode === 'wardrobe',
            },
          },
        ),
      );
    }
    // Dans la garde-robe, tout est à toi: seule la pièce portée garde sa pastille.
    const status = owned
      ? card.state === 'worn' || this.mode === 'shop'
        ? chip(ctx.t(card.state === 'worn' ? c.worn : c.owned), 'ready', 'ui-check')
        : null
      : el(
          'span',
          {
            class: `lpl-clothes__price${card.state === 'too_expensive' ? ' lpl-clothes__price--short' : ''}`,
          },
          [
            price(this.host, card.price),
            card.state === 'too_expensive'
              ? el('small', {
                  text: ctx.t(ctx.texts.extra.common.missingMoney, { missing: card.missing }),
                })
              : null,
          ],
        );
    const item = el(
      'li',
      {
        class: 'lpl-clothes__card',
        'data-state': card.state,
        'data-trying': card.trying ? 'true' : null,
      },
      [
        el('span', {
          class: 'lpl-clothes__swatch',
          style: `--lpl-swatch-a: ${card.colors.principale}; --lpl-swatch-b: ${card.colors.secondaire}`,
          'aria-hidden': 'true',
        }),
        el('span', { class: 'lpl-clothes__name' }, [
          el('strong', { text: card.name }),
          el('span', { class: 'lpl-clothes__flags' }, [
            card.fresh ? el('span', { class: 'lpl-clothes__fresh', text: ctx.t(c.fresh) }) : null,
            card.seasonal
              ? el('span', { class: 'lpl-clothes__seasonal', text: ctx.t(c.seasonal) })
              : null,
          ]),
        ]),
        status,
        el('span', { class: 'lpl-clothes__actions' }, actions),
      ],
    );
    item.addEventListener('pointerenter', () => {
      this.setHover(card.id);
    });
    item.addEventListener('pointerleave', () => {
      if (!item.contains(document.activeElement)) this.setHover(null);
    });
    item.addEventListener('focusin', () => {
      this.setHover(card.id);
    });
    item.addEventListener('focusout', (e) => {
      const next = e.relatedTarget;
      if (!(next instanceof Node) || !item.contains(next)) this.setHover(null);
    });
    return item;
  }
}
