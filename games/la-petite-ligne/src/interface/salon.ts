/**
 * Panneaux du bourg du tour 10: le fauteuil du salon de Solange (coupes, couleurs, barbe, prix,
 * proposition depuis le banc) et le guichet du fournil d'Achille. Les intentions et l'état propres
 * au salon et au fournil sont ceux du lot L3: le panneau les lit et les envoie par un « port »
 * (`SalonPort`, `BakeryPort`), branché dans `interface.ts` sur les menus du jeu.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { characterOf, nameOf } from './contexte';
import { CURRENCY } from '../donnees/monnaie';
import { PREVIEW_DRAG, PREVIEW_STEP, type PanelPreview } from './apercu';
import { button, el, icon, keycap, portrait, setPortrait, token } from './dom';
import {
  type BakeryOffer,
  type SalonLook,
  type SalonOption,
  bakeryOffers,
  bakerySubtitle,
  salonOptions,
  salonPrice,
  salonProposalText,
} from './modele-salon';
import { Panel, backKeys, price, purseBadge } from './panneau';
import { playerColors, portraitSvg } from './portrait';
import { SOUND_ATTR } from './sons';
import { pastille } from './vitrine';

// ---------------------------------------------------------------------------
// Salon de Solange (section 2.3; patch 0.12.2: aperçu 3D, choix en vignettes, sans défilement)

/** Ce que le salon lit et envoie (lot L3). */
export interface SalonPort {
  /** Au fauteuil (on choisit pour soi), ou sur le banc (on propose à l'autre, qui est au fauteuil). */
  seat(world: ReadonlyWorld): 'chair' | 'bench';
  /** La première coupe est offerte (quête `solange_first_cut`). */
  firstFree(world: ReadonlyWorld): boolean;
  /** Proposition reçue de l'autre depuis le banc (chez qui est au fauteuil), ou `null`. */
  received(world: ReadonlyWorld): SalonLook | null;
  apply(look: SalonLook): void;
  keep(): void;
  propose(look: SalonLook): void;
  /** Répond à la proposition reçue (« Essayer » l'accepte dans l'aperçu, « Non merci » la retire). */
  answer(accept: boolean): void;
  /** L'aperçu 3D du rendu (`outfitPreview`), ou `null` en mode secours et tant que le rendu n'est pas prêt. */
  createPreview(): PanelPreview | null;
}

type Group = 'hair' | 'hairColor' | 'beard';

/** Le panneau retente l'aperçu 3D toutes les demi-secondes tant qu'il montre le petit portrait. */
const SALON_UPGRADE_MS = 500;

export class SalonPanel extends Panel {
  private readonly port: SalonPort;
  /** Le choix en cours (aperçu), `null` tant que rien n'est touché: la coiffure actuelle. */
  private choice: SalonLook | null = null;
  /** Aperçu 3D, ou `null`: le petit portrait 2D (mode secours). */
  private preview: PanelPreview | null;
  private readonly portrait: HTMLSpanElement;
  private readonly viewport: HTMLDivElement;
  private readonly stage: HTMLElement;
  private angle = 0;
  private lastUpgrade = 0;
  private drag: { x: number; angle: number; id: number } | null = null;

  constructor(host: UiHost, port: SalonPort) {
    const { ctx } = host;
    const s = ctx.texts.extra.salon;
    const c = ctx.texts.extra.clothes;
    const left = ctx.key('KeyQ');
    const right = ctx.key('KeyE');
    super(host, {
      icon: 'ui-star',
      title: ctx.t(s.title),
      width: '60rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.port = port;
    this.root.classList.add('lpl-panel--vitrine', 'lpl-salon-panel');
    this.preview = port.createPreview();
    this.portrait = portrait('', 'large');
    this.viewport = el('div', { class: 'lpl-salon__viewport', role: 'img', 'aria-label': ctx.t(c.previewLabel) }, [this.preview?.element ?? this.portrait]);
    this.viewport.toggleAttribute('data-3d', this.preview !== null);
    this.viewport.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, angle: this.angle, id: e.pointerId };
      this.viewport.setPointerCapture(e.pointerId);
    });
    this.viewport.addEventListener('pointermove', (e) => {
      if (this.drag?.id !== e.pointerId) return;
      this.setAngle(this.drag.angle + (e.clientX - this.drag.x) * PREVIEW_DRAG);
    });
    const endDrag = (e: PointerEvent): void => {
      if (this.drag?.id === e.pointerId) this.drag = null;
    };
    this.viewport.addEventListener('pointerup', endDrag);
    this.viewport.addEventListener('pointercancel', endDrag);
    const turn = (dir: -1 | 1, key: string, label: string): HTMLButtonElement =>
      button(dir < 0 ? [keycap(key), icon('ui-rotate-left')] : [icon('ui-rotate-right'), keycap(key)], () => {
        this.setAngle(this.angle + dir * PREVIEW_STEP);
      }, { class: 'lpl-button lpl-clothes__turn', attrs: { 'aria-label': label, title: label, tabindex: '-1', [SOUND_ATTR]: 'none' } });
    this.stage = el('div', { class: 'lpl-salon__stage' }, [this.viewport, el('div', { class: 'lpl-salon__turns' }, [turn(-1, left, ctx.t(c.rotateLeft)), turn(1, right, ctx.t(c.rotateRight))])]);
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
    this.setAngle(this.angle + (code === 'KeyQ' ? -1 : 1) * PREVIEW_STEP);
    return true;
  }

  private setAngle(angle: number): void {
    const tau = Math.PI * 2;
    this.angle = angle - tau * Math.floor((angle + Math.PI) / tau);
    this.preview?.setAngle(this.angle);
  }

  dispose(): void {
    this.preview?.dispose();
  }

  /** Petit portrait en attendant le rendu: on retente l'aperçu 3D toutes les demi-secondes. */
  private tryUpgrade(): void {
    if (this.preview !== null) return;
    const now = this.host.now();
    if (now - this.lastUpgrade < SALON_UPGRADE_MS) return;
    this.lastUpgrade = now;
    const next = this.port.createPreview();
    if (next === null) return;
    this.portrait.replaceWith(next.element);
    this.preview = next;
    this.viewport.toggleAttribute('data-3d', true);
    this.preview.setAngle(this.angle);
  }

  /** La personne au fauteuil: soi, ou l'autre quand on propose depuis le banc. */
  private sitter(world: ReadonlyWorld): ReturnType<typeof characterOf> {
    const { ctx } = this.host;
    return characterOf(world, this.port.seat(world) === 'chair' ? ctx.me : ctx.partner);
  }

  update(world: ReadonlyWorld): void {
    const { ctx } = this.host;
    const sitter = this.sitter(world);
    if (sitter === null) return;
    this.tryUpgrade();
    const current: SalonLook = { hair: sitter.appearance.hair, hairColor: sitter.appearance.hairColor, beard: sitter.appearance.beard };
    const choice = this.choice ?? current;
    const seat = this.port.seat(world);
    const received = seat === 'chair' ? this.port.received(world) : null;
    const priceModel = salonPrice(world, ctx, current, choice, seat === 'chair' && this.port.firstFree(world));
    const look = { ...sitter.appearance, ...choice };
    if (this.preview !== null) {
      if (this.viewport.isConnected) this.preview.fit(this.viewport.clientWidth, this.viewport.clientHeight);
      this.preview.show({ character: sitter.id, appearance: look });
    } else {
      setPortrait(this.portrait, portraitSvg(playerColors(sitter.id, look, ctx.content.clothes), 'great', ''));
    }
    const partner = nameOf(world, ctx.partner);
    const sig = JSON.stringify([current, choice, seat, received, priceModel, partner, world.purse]);
    this.renderBody(sig, () => {
      const s = ctx.texts.extra.salon;
      const options = salonOptions(ctx);
      const nodes: HTMLElement[] = [];
      if (received !== null) {
        nodes.push(
          el('div', { class: 'lpl-proposal lpl-salon__proposal', role: 'note' }, [
            token('other', this.host.symbol('other'), 'small'),
            el('strong', { text: salonProposalText(ctx, partner, received) }),
            button(ctx.t(s.try), () => {
              this.choice = received;
              this.port.answer(true);
              this.host.invalidate();
            }, { class: 'lpl-button lpl-button--primary', attrs: { 'data-nav-item': true, 'data-key': 'proposal-try' } }),
            button(ctx.t(s.decline), () => {
              this.port.answer(false);
            }, { attrs: { 'data-nav-item': true, 'data-key': 'proposal-decline' } }),
          ]),
        );
      }
      /** Une rangée de vignettes (boutons radio): mini-portrait ou pastille de couleur, le nom au survol. */
      const group = (key: Group, title: string, list: readonly SalonOption[]): HTMLElement => {
        const box = el('div', { class: `lpl-salon__options lpl-salon__options--${key}`, 'data-nav': 'row' });
        const name = `salon-${key}`;
        for (const o of list) {
          const input = el('input', {
            type: 'radio',
            name,
            value: String(o.index),
            class: 'lpl-salon__radio',
            'aria-label': o.salonOnly ? `${o.name} (${ctx.t(s.salonOnly)})` : o.name,
            'data-nav-item': true,
            'data-key': `${key}:${String(o.index)}`,
            'data-autofocus': key === 'hair' && o.index === choice.hair,
          });
          input.checked = choice[key] === o.index;
          input.addEventListener('change', () => {
            this.choice = { ...choice, [key]: o.index };
            this.host.invalidate();
          });
          const optionLook = { ...sitter.appearance, ...choice, [key]: o.index };
          const visual =
            key === 'hairColor'
              ? el('span', { class: 'lpl-salon__swatch', style: `--lpl-swatch: ${o.color ?? 'transparent'}` })
              : portrait(portraitSvg(playerColors(sitter.id, optionLook, ctx.content.clothes), 'good', ''), 'small');
          box.append(
            el('label', { class: 'lpl-salon__option', title: o.salonOnly ? `${o.name} · ${ctx.t(s.salonOnly)}` : o.name, 'data-current': current[key] === o.index ? 'true' : null }, [
              input,
              visual,
              o.salonOnly ? el('span', { class: 'lpl-salon__new', 'aria-hidden': 'true' }, [icon('ui-star')]) : null,
              el('span', { class: 'lpl-tile__name', 'aria-hidden': 'true', text: o.name }),
            ]),
          );
        }
        const chosen = list.find((o) => o.index === choice[key])?.name ?? '';
        return el('fieldset', { class: 'lpl-salon__group' }, [
          el('legend', { class: 'lpl-salon__legend' }, [el('span', { text: title }), el('span', { class: 'lpl-salon__chosen', text: chosen })]),
          box,
        ]);
      };
      const actions: HTMLElement[] = [];
      if (seat === 'chair') {
        const changed = priceModel.cut || priceModel.color;
        actions.push(
          button(changed ? ctx.t(ctx.texts.extra.vitrine.validate) : ctx.t(s.keep), () => {
            if (changed) this.port.apply(choice);
            else this.port.keep();
          }, { class: 'lpl-button lpl-button--primary lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': 'confirm', 'aria-disabled': priceModel.missing > 0 ? 'true' : null, 'aria-label': priceModel.missing > 0 ? ctx.t(s.missing, { missing: priceModel.missing }) : changed ? priceModel.confirm : ctx.t(s.keep) } }),
        );
        if (changed) {
          actions.push(
            button([icon('ui-rotate-left'), ctx.t(s.keep)], () => {
              this.choice = null;
              this.port.keep();
            }, { class: 'lpl-button lpl-button--quiet', attrs: { 'data-nav-item': true, 'data-key': 'keep' } }),
          );
        }
      } else {
        actions.push(
          button([token('other', this.host.symbol('other'), 'small'), ctx.t(s.propose, { partner })], () => {
            this.port.propose(choice);
          }, { class: 'lpl-button lpl-button--primary lpl-button--wide', attrs: { 'data-nav-item': true, 'data-key': 'propose' } }),
        );
      }
      const changed = priceModel.cut || priceModel.color;
      const price = changed
        ? priceModel.free
          ? pastille({ icon: 'ui-star', text: ctx.t(ctx.texts.extra.vitrine.free), tone: 'ok', label: ctx.t(s.free) })
          : priceModel.missing > 0
            ? pastille({ icon: CURRENCY.icon, text: `${String(world.purse)}/${String(priceModel.price)}`, tone: 'missing', crossed: true, label: ctx.t(s.missing, { missing: priceModel.missing }) })
            : pastille({ icon: CURRENCY.icon, text: String(priceModel.price), tone: 'price', label: priceModel.line })
        : null;
      const marks = price === null ? null : el('div', { class: 'lpl-detail__pastilles' }, [price]);
      nodes.push(
        el('div', { class: 'lpl-salon' }, [
          el('div', { class: 'lpl-salon__left' }, [
            this.stage,
            el('p', { class: 'lpl-overline lpl-salon__who', text: seat === 'chair' ? ctx.t(s.current) : sitter.name }),
            marks,
            el('div', { class: 'lpl-salon__actions' }, actions),
          ]),
          el('div', { class: 'lpl-salon__choices' }, [
            group('hair', ctx.t(s.cut), options.cuts),
            group('hairColor', ctx.t(s.color), options.colors),
            group('beard', ctx.t(s.beard), options.beards),
          ]),
        ]),
      );
      return nodes;
    });
  }
}

// ---------------------------------------------------------------------------
// Guichet du fournil (section 1.5)

export interface BakeryPort {
  /** Ce que ce joueur a déjà acheté aujourd'hui, par objet (plafonds `dailyCapPerPlayer`). */
  bought(world: ReadonlyWorld): Readonly<Record<string, number>>;
  buy(item: string): void;
}

export class BakeryPanel extends Panel {
  private readonly port: BakeryPort;

  constructor(host: UiHost, port: BakeryPort) {
    const { ctx } = host;
    super(host, {
      icon: 'bread',
      title: ctx.t(ctx.texts.extra.bakery.title),
      subtitle: bakerySubtitle(ctx),
      narrow: true,
      width: '40rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.port = port;
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [a[0], a[1]], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
  }

  update(world: ReadonlyWorld): void {
    const offers = bakeryOffers(world, this.host.ctx, this.port.bought(world)) ?? [];
    const sig = JSON.stringify([offers, world.purse]);
    this.renderBody(sig, () => {
      const list = el('ul', { class: 'lpl-order', 'data-nav': 'list' });
      const first = offers.findIndex((o) => o.state === 'buy');
      offers.forEach((o, i) => {
        list.append(this.line(o, i === Math.max(0, first)));
      });
      return [el('div', { class: 'lpl-order__summary' }, [purseBadge(this.host, world)]), list];
    });
  }

  private line(o: BakeryOffer, autofocus: boolean): HTMLLIElement {
    const action =
      o.state === 'buy'
        ? button(
            o.action,
            () => {
              this.port.buy(o.item);
            },
            {
              class: 'lpl-button lpl-button--primary lpl-button--wide',
              attrs: {
                'data-nav-item': true,
                'data-key': `buy:${o.item}`,
                'data-autofocus': autofocus,
              },
            },
          )
        : button(o.state === 'too_expensive' ? o.action : o.note, () => undefined, {
            class: 'lpl-button lpl-button--wide',
            attrs: {
              'aria-disabled': 'true',
              'data-nav-item': true,
              'data-key': `buy:${o.item}`,
              'data-autofocus': autofocus,
            },
          });
    return el('li', { class: 'lpl-order__line lpl-shop__line', 'data-state': o.state }, [
      icon(o.icon, 'lpl-order__icon'),
      el('span', { class: 'lpl-order__name' }, [
        o.name,
        o.note === '' || o.state !== 'buy' ? null : el('small', { text: o.note }),
      ]),
      el('span', { class: 'lpl-order__count' }, [price(this.host, o.price)]),
      el('span', { class: 'lpl-order__action' }, [action]),
    ]);
  }
}
