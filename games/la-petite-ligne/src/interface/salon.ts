/**
 * Panneaux du bourg du tour 10: le fauteuil du salon de Solange (coupes, couleurs, barbe, prix,
 * proposition depuis le banc) et le guichet du fournil d'Achille. Les intentions et l'état propres
 * au salon et au fournil sont ceux du lot L3: le panneau les lit et les envoie par un « port »
 * (`SalonPort`, `BakeryPort`), branché dans `interface.ts` sur les menus du jeu.
 */
import type { ReadonlyWorld } from '../etat/types';
import type { UiHost } from './composant';
import { characterOf, nameOf } from './contexte';
import { button, chip, el, icon, portrait, setPortrait } from './dom';
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

// ---------------------------------------------------------------------------
// Salon de Solange (section 2.3)

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
}

type Group = 'hair' | 'hairColor' | 'beard';

export class SalonPanel extends Panel {
  private readonly port: SalonPort;
  /** Le choix en cours (aperçu), `null` tant que rien n'est touché: la coiffure actuelle. */
  private choice: SalonLook | null = null;
  private readonly preview: HTMLSpanElement;

  constructor(host: UiHost, port: SalonPort) {
    const { ctx } = host;
    const s = ctx.texts.extra.salon;
    super(host, {
      icon: 'ui-star',
      title: ctx.t(s.title),
      width: '60rem',
      closeKeyLabel: ctx.key('Backspace'),
      closeAria: `${ctx.texts.extra.common.close} (${ctx.key('Backspace')})`,
    });
    this.port = port;
    this.preview = portrait('', 'large');
    const a = ctx.texts.extra.keys.arrows;
    this.setFooter([
      backKeys(host, [
        { keys: [...a], text: ctx.texts.extra.notebook.keysChoose },
        { keys: [ctx.key('Enter')], text: ctx.texts.extra.notebook.keysActivate },
      ]),
    ]);
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
    const current: SalonLook = {
      hair: sitter.appearance.hair,
      hairColor: sitter.appearance.hairColor,
      beard: sitter.appearance.beard,
    };
    const choice = this.choice ?? current;
    const seat = this.port.seat(world);
    const received = seat === 'chair' ? this.port.received(world) : null;
    const priceModel = salonPrice(
      world,
      ctx,
      current,
      choice,
      seat === 'chair' && this.port.firstFree(world),
    );
    setPortrait(
      this.preview,
      portraitSvg(playerColors(sitter.id, { ...sitter.appearance, ...choice }, ctx.content.clothes), 'great', ''),
    );
    const partner = nameOf(world, ctx.partner);
    const sig = JSON.stringify([current, choice, seat, received, priceModel, partner, world.purse]);
    this.renderBody(sig, () => {
      const s = ctx.texts.extra.salon;
      const options = salonOptions(ctx);
      const nodes: HTMLElement[] = [];
      if (received !== null) {
        nodes.push(
          el('div', { class: 'lpl-proposal lpl-salon__proposal', role: 'note' }, [
            el('strong', { text: salonProposalText(ctx, partner, received) }),
            button(
              ctx.t(s.try),
              () => {
                this.choice = received;
                this.port.answer(true);
                this.host.invalidate();
              },
              {
                class: 'lpl-button lpl-button--primary',
                attrs: { 'data-nav-item': true, 'data-key': 'proposal-try' },
              },
            ),
            button(
              ctx.t(s.decline),
              () => {
                this.port.answer(false);
              },
              { attrs: { 'data-nav-item': true, 'data-key': 'proposal-decline' } },
            ),
          ]),
        );
      }
      const group = (key: Group, title: string, list: readonly SalonOption[]): HTMLElement => {
        const box = el('div', {
          class: 'lpl-choice-group__options lpl-choice-group__options--compact',
          'data-nav': 'row',
        });
        const name = `salon-${key}`;
        for (const o of list) {
          const input = el('input', {
            type: 'radio',
            name,
            value: String(o.index),
            'data-nav-item': true,
            'data-key': `${key}:${o.index}`,
            'data-autofocus': key === 'hair' && o.index === choice.hair,
          });
          input.checked = choice[key] === o.index;
          input.addEventListener('change', () => {
            this.choice = { ...choice, [key]: o.index };
            this.host.invalidate();
          });
          const look = { ...sitter.appearance, ...choice, [key]: o.index };
          const visual =
            key === 'hairColor'
              ? el('span', {
                  class: 'lpl-option__swatch',
                  style: `--lpl-swatch: ${o.color ?? 'transparent'}`,
                })
              : portrait(portraitSvg(playerColors(sitter.id, look, ctx.content.clothes), 'good', ''), 'small');
          box.append(
            el('label', { class: 'lpl-option', title: o.salonOnly ? ctx.t(s.salonOnly) : null }, [
              input,
              visual,
              o.name,
              o.salonOnly ? icon('ui-star', 'lpl-icon lpl-salon__new') : null,
            ]),
          );
        }
        return el('fieldset', { class: 'lpl-choice-group' }, [el('legend', { text: title }), box]);
      };
      const actions: HTMLElement[] = [];
      if (seat === 'chair') {
        const changed = priceModel.cut || priceModel.color;
        actions.push(
          button(
            priceModel.missing > 0
              ? ctx.t(s.missing, { missing: priceModel.missing })
              : priceModel.confirm,
            () => {
              if (changed) this.port.apply(choice);
              else this.port.keep();
            },
            {
              class: 'lpl-button lpl-button--primary',
              attrs: {
                'data-nav-item': true,
                'data-key': 'confirm',
                'aria-disabled': priceModel.missing > 0 ? 'true' : null,
              },
            },
          ),
        );
        if (changed) {
          actions.push(
            button(
              ctx.t(s.keep),
              () => {
                this.choice = null;
                this.port.keep();
              },
              { attrs: { 'data-nav-item': true, 'data-key': 'keep' } },
            ),
          );
        }
      } else {
        actions.push(
          button(
            ctx.t(s.propose, { partner }),
            () => {
              this.port.propose(choice);
            },
            {
              class: 'lpl-button lpl-button--primary',
              attrs: { 'data-nav-item': true, 'data-key': 'propose' },
            },
          ),
        );
      }
      nodes.push(
        el('div', { class: 'lpl-salon' }, [
          el('div', { class: 'lpl-salon__preview' }, [
            this.preview,
            el('p', {
              class: 'lpl-overline',
              text: seat === 'chair' ? ctx.t(s.current) : sitter.name,
            }),
            el('p', { class: 'lpl-salon__price', text: priceModel.line }),
            priceModel.free ? chip(ctx.t(s.free), 'ready', 'ui-star') : null,
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
